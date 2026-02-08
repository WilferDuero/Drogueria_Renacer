const express = require("express");
const cors = require("cors");
const { dbPromise } = require("./db");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const toNumber = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const toInt = (v, fallback = 0) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
};

const toBoolInt = (v) =>
  v === true || v === "true" || v === 1 || v === "1" ? 1 : 0;

app.get("/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

/* ============================
   Productos
============================ */
app.get("/products", async (req, res) => {
  const db = await dbPromise;
  const rows = await db.all("SELECT * FROM products ORDER BY id DESC");
  res.json(
    rows.map((r) => ({
      ...r,
      ofertaActiva: !!r.ofertaActiva,
    }))
  );
});

app.post("/products", async (req, res) => {
  const p = req.body || {};
  if (!p.nombre) return res.status(400).json({ error: "Nombre requerido" });

  const db = await dbPromise;
  const result = await db.run(
    `
    INSERT INTO products
    (nombre, descripcion, categoria, disponibilidad, imagen,
     precioCaja, precioSobre, precioUnidad, sobresXCaja, unidadesXSobre, stockCajas,
     ofertaActiva, ofertaTexto, ofertaPrecioCaja, ofertaPrecioSobre, updatedAt)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, CURRENT_TIMESTAMP)
    `,
    [
      p.nombre,
      p.descripcion || "",
      p.categoria || "",
      p.disponibilidad || "Disponible",
      p.imagen || "",
      toNumber(p.precioCaja),
      toNumber(p.precioSobre),
      toNumber(p.precioUnidad),
      toInt(p.sobresXCaja),
      toInt(p.unidadesXSobre),
      toInt(p.stockCajas),
      toBoolInt(p.ofertaActiva),
      p.ofertaTexto || "",
      toNumber(p.ofertaPrecioCaja),
      toNumber(p.ofertaPrecioSobre),
    ]
  );

  res.json({ id: result.lastID });
});

app.put("/products/:id", async (req, res) => {
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ error: "ID inválido" });

  const p = req.body || {};
  const db = await dbPromise;

  await db.run(
    `
    UPDATE products SET
      nombre = ?, descripcion = ?, categoria = ?, disponibilidad = ?, imagen = ?,
      precioCaja = ?, precioSobre = ?, precioUnidad = ?, sobresXCaja = ?, unidadesXSobre = ?, stockCajas = ?,
      ofertaActiva = ?, ofertaTexto = ?, ofertaPrecioCaja = ?, ofertaPrecioSobre = ?, updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
    `,
    [
      p.nombre || "",
      p.descripcion || "",
      p.categoria || "",
      p.disponibilidad || "Disponible",
      p.imagen || "",
      toNumber(p.precioCaja),
      toNumber(p.precioSobre),
      toNumber(p.precioUnidad),
      toInt(p.sobresXCaja),
      toInt(p.unidadesXSobre),
      toInt(p.stockCajas),
      toBoolInt(p.ofertaActiva),
      p.ofertaTexto || "",
      toNumber(p.ofertaPrecioCaja),
      toNumber(p.ofertaPrecioSobre),
      id,
    ]
  );

  res.json({ ok: true });
});

app.delete("/products/:id", async (req, res) => {
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ error: "ID inválido" });

  const db = await dbPromise;
  await db.run("DELETE FROM products WHERE id = ?", [id]);
  res.json({ ok: true });
});

/* ============================
   Pedidos
============================ */
app.get("/orders", async (req, res) => {
  const db = await dbPromise;
  const status = req.query.estado;
  const rows = status
    ? await db.all("SELECT * FROM orders WHERE estado = ? ORDER BY id DESC", [status])
    : await db.all("SELECT * FROM orders ORDER BY id DESC");
  res.json(rows);
});

app.post("/orders", async (req, res) => {
  const o = req.body || {};
  const items = Array.isArray(o.items) ? o.items : [];
  const total = toNumber(o.total);

  const db = await dbPromise;
  const result = await db.run(
    `
    INSERT INTO orders
    (clienteNombre, clienteTelefono, clienteDireccion, items, total, estado)
    VALUES (?,?,?,?,?,?)
    `,
    [
      o.clienteNombre || "",
      o.clienteTelefono || "",
      o.clienteDireccion || "",
      JSON.stringify(items),
      total,
      o.estado || "pendiente",
    ]
  );

  res.json({ id: result.lastID });
});

app.put("/orders/:id/status", async (req, res) => {
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ error: "ID inválido" });

  const estado = (req.body?.estado || "").toLowerCase();
  if (!estado) return res.status(400).json({ error: "Estado requerido" });

  const db = await dbPromise;
  await db.run("UPDATE orders SET estado = ? WHERE id = ?", [estado, id]);
  res.json({ ok: true });
});

/* ============================
   Reseñas
============================ */
app.get("/reviews", async (_req, res) => {
  const db = await dbPromise;
  const rows = await db.all("SELECT * FROM reviews ORDER BY id DESC");
  res.json(rows);
});

app.post("/reviews", async (req, res) => {
  const r = req.body || {};
  const db = await dbPromise;
  const result = await db.run(
    `
    INSERT INTO reviews (nombre, telefono, rating, texto, verificada)
    VALUES (?,?,?,?,?)
    `,
    [
      r.nombre || "",
      r.telefono || "",
      toInt(r.rating),
      r.texto || "",
      toBoolInt(r.verificada),
    ]
  );

  res.json({ id: result.lastID });
});

app.listen(PORT, () => {
  console.log(`API lista en http://localhost:${PORT}`);
});
