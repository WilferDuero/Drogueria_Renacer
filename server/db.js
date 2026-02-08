const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

const dbFile = path.join(__dirname, "data", "app.db");

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
  `);

  try {
    await db.exec("ALTER TABLE products ADD COLUMN externalId TEXT;");
  } catch (e) {}

  try {
    await db.exec("ALTER TABLE orders ADD COLUMN externalId TEXT;");
  } catch (e) {}

  return db;
});

module.exports = { dbPromise };
