require("dotenv").config();

const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcryptjs");
const { open } = require("sqlite");

const usePostgres = !!process.env.DATABASE_URL;

function replacePlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function seedOwner(db) {
  try {
    const row = await db.get("SELECT COUNT(*) as c FROM users");
    const count = Number(row?.c ?? row?.count ?? 0);
    if (!count) {
      const username = process.env.ADMIN_USER || "admin";
      const password = process.env.ADMIN_PASS || "wilfer1234";
      const role = process.env.ADMIN_ROLE || "owner";
      const hash = await bcrypt.hash(password, 10);
      await db.run("INSERT INTO users (username, passwordHash, role) VALUES (?,?,?)", [
        username,
        hash,
        role,
      ]);
    }
  } catch (e) {}
}

async function initSqlite() {
  const dataDir = process.env.SQLITE_DIR || path.join(__dirname, "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const dbFile = path.join(dataDir, "app.db");
  const db = await open({ filename: dbFile, driver: sqlite3.Database });
  await db.exec("PRAGMA journal_mode = WAL;");

  await db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      externalId TEXT,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      categoria TEXT,
      disponibilidad TEXT,
      imagen TEXT,
      precioCaja REAL,
      precioSobre REAL,
      precioUnidad REAL,
      sobresXCaja INTEGER,
      unidadesXSobre INTEGER,
      stockCajas INTEGER,
      ofertaActiva INTEGER DEFAULT 0,
      ofertaTexto TEXT,
      ofertaPrecioCaja REAL,
      ofertaPrecioSobre REAL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      externalId TEXT,
      clienteNombre TEXT,
      clienteTelefono TEXT,
      clienteDireccion TEXT,
      items TEXT,
      total REAL,
      estado TEXT DEFAULT 'pendiente',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT,
      telefono TEXT,
      rating INTEGER,
      texto TEXT,
      verificada INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      passwordHash TEXT,
      role TEXT DEFAULT 'staff',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      refId TEXT,
      userId INTEGER,
      userName TEXT,
      clienteNombre TEXT,
      clienteTelefono TEXT,
      total REAL,
      items TEXT,
      metodoPago TEXT,
      fechaISO TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try {
    await db.exec("ALTER TABLE products ADD COLUMN externalId TEXT;");
  } catch (e) {}
  try {
    await db.exec("ALTER TABLE orders ADD COLUMN externalId TEXT;");
  } catch (e) {}
  try {
    await db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_externalId ON orders(externalId);");
  } catch (e) {}
  try {
    await db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);");
  } catch (e) {}
  try {
    await db.exec("CREATE INDEX IF NOT EXISTS idx_sales_userId ON sales(userId);");
  } catch (e) {}
  try {
    await db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_ref_user ON sales(refId, userId);");
  } catch (e) {}

  await seedOwner(db);
  return db;
}

async function initPostgres() {
  const { Pool } = require("pg");
  const connectionString = process.env.DATABASE_URL;
  const needsSSL =
    /sslmode=require/i.test(connectionString || "") || process.env.PG_SSL === "true";
  const pool = new Pool({
    connectionString,
    ssl: needsSSL ? { rejectUnauthorized: false } : undefined,
  });

  const statements = [
    `
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      externalId TEXT,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      categoria TEXT,
      disponibilidad TEXT,
      imagen TEXT,
      precioCaja REAL,
      precioSobre REAL,
      precioUnidad REAL,
      sobresXCaja INTEGER,
      unidadesXSobre INTEGER,
      stockCajas INTEGER,
      ofertaActiva INTEGER DEFAULT 0,
      ofertaTexto TEXT,
      ofertaPrecioCaja REAL,
      ofertaPrecioSobre REAL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `,
    `
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      externalId TEXT,
      clienteNombre TEXT,
      clienteTelefono TEXT,
      clienteDireccion TEXT,
      items TEXT,
      total REAL,
      estado TEXT DEFAULT 'pendiente',
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `,
    `
    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      nombre TEXT,
      telefono TEXT,
      rating INTEGER,
      texto TEXT,
      verificada INTEGER DEFAULT 0,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `,
    `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE,
      passwordHash TEXT,
      role TEXT DEFAULT 'staff',
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `,
    `
    CREATE TABLE IF NOT EXISTS sales (
      id SERIAL PRIMARY KEY,
      refId TEXT,
      userId INTEGER,
      userName TEXT,
      clienteNombre TEXT,
      clienteTelefono TEXT,
      total REAL,
      items TEXT,
      metodoPago TEXT,
      fechaISO TEXT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `,
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_externalId ON orders(externalId);",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);",
    "CREATE INDEX IF NOT EXISTS idx_sales_userId ON sales(userId);",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_ref_user ON sales(refId, userId);",
  ];

  for (const stmt of statements) {
    await pool.query(stmt);
  }

  const db = {
    async get(sql, params = []) {
      const text = replacePlaceholders(sql);
      const result = await pool.query(text, params);
      return result.rows[0];
    },
    async all(sql, params = []) {
      const text = replacePlaceholders(sql);
      const result = await pool.query(text, params);
      return result.rows;
    },
    async run(sql, params = []) {
      let text = replacePlaceholders(sql);
      const isInsert = /^\s*insert\s+/i.test(text);
      const hasReturning = /returning\s+/i.test(text);
      if (isInsert && !hasReturning) {
        text = `${text} RETURNING id`;
      }
      const result = await pool.query(text, params);
      return {
        lastID: result.rows?.[0]?.id,
        changes: result.rowCount,
      };
    },
  };

  await seedOwner(db);
  return db;
}

const dbPromise = usePostgres ? initPostgres() : initSqlite();

module.exports = { dbPromise };
