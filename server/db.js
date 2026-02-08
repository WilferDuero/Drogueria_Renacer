const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcryptjs");
const { open } = require("sqlite");

const dataDir = process.env.SQLITE_DIR || path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });

const dbFile = path.join(dataDir, "app.db");

const dbPromise = open({
  filename: dbFile,
  driver: sqlite3.Database,
}).then(async (db) => {
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

  // seed owner si no existe ninguno
  try {
    const row = await db.get("SELECT COUNT(*) as c FROM users");
    if (!row || !row.c) {
      const username = process.env.ADMIN_USER || "admin";
      const password = process.env.ADMIN_PASS || "wilfer1234";
      const role = process.env.ADMIN_ROLE || "owner";
      const hash = await bcrypt.hash(password, 10);
      await db.run(
        "INSERT INTO users (username, passwordHash, role) VALUES (?,?,?)",
        [username, hash, role]
      );
    }
  } catch (e) {}

  return db;
});

module.exports = { dbPromise };
