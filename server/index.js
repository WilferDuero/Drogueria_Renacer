require("dotenv").config();

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { dbPromise } = require("./db");

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change";
const TOKEN_TTL = process.env.JWT_TTL || "8h";

if (process.env.NODE_ENV === "production" && JWT_SECRET === "dev-secret-change") {
  console.error("JWT_SECRET no configurado. Configuralo en variables de entorno.");
  process.exit(1);
}

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});
app.use(
  cors({
    origin: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
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

const safeJson = (val, fallback = []) => {
  if (Array.isArray(val)) return val;
  try {
    const parsed = JSON.parse(val || "[]");
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const pick = (obj, ...keys) => {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
};

function normalizeProductRow(r) {
  const externalId = pick(r, "externalId", "externalid");
  return {
    id: externalId || r.id,
    externalId: externalId || null,
    nombre: pick(r, "nombre") || "",
    descripcion: pick(r, "descripcion") || "",
    categoria: pick(r, "categoria") || "",
    disponibilidad: pick(r, "disponibilidad") || "Disponible",
    imagen: pick(r, "imagen") || "",
    precioCaja: toNumber(pick(r, "precioCaja", "preciocaja")),
    precioSobre: toNumber(pick(r, "precioSobre", "preciosobre")),
    precioUnidad: toNumber(pick(r, "precioUnidad", "preciounidad")),
    sobresXCaja: toInt(pick(r, "sobresXCaja", "sobresxcaja")),
    unidadesXSobre: toInt(pick(r, "unidadesXSobre", "unidadesxsobre")),
    stockCajas: toInt(pick(r, "stockCajas", "stockcajas")),
    ofertaActiva: !!pick(r, "ofertaActiva", "ofertaactiva"),
    ofertaTexto: pick(r, "ofertaTexto", "ofertatexto") || "",
    ofertaPrecioCaja: toNumber(pick(r, "ofertaPrecioCaja", "ofertapreciocaja")),
    ofertaPrecioSobre: toNumber(pick(r, "ofertaPrecioSobre", "ofertapreciosobre")),
    createdAt: pick(r, "createdAt", "createdat"),
    updatedAt: pick(r, "updatedAt", "updatedat"),
  };
}

const signToken = (user) =>
  jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, {
    expiresIn: TOKEN_TTL,
  });

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;
const loginAttempts = new Map();

function getClientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) return xf.split(",")[0].trim();
  return req.ip || req.connection?.remoteAddress || "unknown";
}

function isLoginBlocked(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry) return false;
  const age = Date.now() - entry.firstAt;
  if (age > LOGIN_WINDOW_MS) {
    loginAttempts.delete(ip);
    return false;
  }
  return entry.count >= LOGIN_MAX_ATTEMPTS;
}

function recordLoginFailure(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry) {
    loginAttempts.set(ip, { count: 1, firstAt: Date.now() });
    return;
  }
  const age = Date.now() - entry.firstAt;
  if (age > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAt: Date.now() });
    return;
  }
  entry.count += 1;
  loginAttempts.set(ip, entry);
}

function clearLoginAttempts(ip) {
  loginAttempts.delete(ip);
}

function authRequired(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return res.status(401).json({ error: "No autorizado" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (e) {
    return res.status(401).json({ error: "Token inválido" });
  }
}

function ownerOnly(req, res, next) {
  if (!req.user || req.user.role !== "owner") {
    return res.status(403).json({ error: "No autorizado" });
  }
  return next();
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get("/", (_req, res) => {
  res.type("text").send("API Droguería Renacer OK");
});

/* ============================
   Auth
============================ */
app.post("/auth/login", async (req, res) => {
  const ip = getClientIp(req);
  if (isLoginBlocked(ip)) {
    return res.status(429).json({ error: "Demasiados intentos. Intenta más tarde." });
  }

  const { username = "", password = "" } = req.body || {};
  const u = String(username || "").trim();
  const p = String(password || "").trim();
  if (!u || !p) {
    recordLoginFailure(ip);
    return res.status(400).json({ error: "Usuario y contraseña requeridos" });
  }

  const db = await dbPromise;
  const user = await db.get("SELECT * FROM users WHERE username = ?", [u]);
  if (!user) {
    recordLoginFailure(ip);
    return res.status(401).json({ error: "Credenciales inválidas" });
  }

  const hash = user.passwordHash || user.passwordhash || "";
  const ok = await bcrypt.compare(p, hash);
  if (!ok) {
    recordLoginFailure(ip);
    return res.status(401).json({ error: "Credenciales inválidas" });
  }

  clearLoginAttempts(ip);
  const token = signToken(user);
  res.json({
    token,
    user: { id: user.id, username: user.username, role: user.role },
  });
});

app.get("/auth/me", authRequired, async (req, res) => {
  const db = await dbPromise;
  const user = await db.get("SELECT id, username, role FROM users WHERE id = ?", [req.user.id]);
  if (!user) return res.status(401).json({ error: "Usuario inválido" });
  res.json(user);
});

/* ============================
   Usuarios (owner)
============================ */
app.get("/users", authRequired, ownerOnly, async (_req, res) => {
  const db = await dbPromise;
  const rows = await db.all("SELECT id, username, role, createdAt FROM users ORDER BY id ASC");
  res.json(rows);
});

app.post("/users", authRequired, ownerOnly, async (req, res) => {
  const { username = "", password = "", role = "staff" } = req.body || {};
  const u = String(username || "").trim();
  const p = String(password || "").trim();
  const r = String(role || "staff").trim();
  if (!u || !p) return res.status(400).json({ error: "Usuario y contraseña requeridos" });
  if (!["owner", "staff"].includes(r)) return res.status(400).json({ error: "Rol inválido" });

  const db = await dbPromise;
  const exists = await db.get("SELECT id FROM users WHERE username = ?", [u]);
  if (exists) return res.status(409).json({ error: "Usuario ya existe" });

  const hash = await bcrypt.hash(p, 10);
  const result = await db.run(
    "INSERT INTO users (username, passwordHash, role) VALUES (?,?,?)",
    [u, hash, r]
  );

  res.json({ id: result.lastID, username: u, role: r });
});

app.put("/users/:id", authRequired, ownerOnly, async (req, res) => {
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ error: "ID inválido" });

  const { password, role, username } = req.body || {};
  const db = await dbPromise;

  if (username && String(username).trim()) {
    const u = String(username).trim();
    const exists = await db.get("SELECT id FROM users WHERE username = ? AND id <> ?", [u, id]);
    if (exists) return res.status(409).json({ error: "Usuario ya existe" });
    await db.run("UPDATE users SET username = ? WHERE id = ?", [u, id]);
  }

  if (password && String(password).trim()) {
    const hash = await bcrypt.hash(String(password).trim(), 10);
    await db.run("UPDATE users SET passwordHash = ? WHERE id = ?", [hash, id]);
  }

  if (role && ["owner", "staff"].includes(String(role))) {
    await db.run("UPDATE users SET role = ? WHERE id = ?", [String(role), id]);
  }

  res.json({ ok: true });
});

/* ============================
   Productos
============================ */
app.get("/products", async (_req, res) => {
  const db = await dbPromise;
  const rows = await db.all("SELECT * FROM products ORDER BY id DESC");
  res.json(rows.map(normalizeProductRow));
});

app.post("/products", authRequired, async (req, res) => {
  const p = req.body || {};
  if (!p.nombre) return res.status(400).json({ error: "Nombre requerido" });
  const externalId = p.externalId || p.id || null;

  const db = await dbPromise;
  if (externalId) {
    const existing = await db.get("SELECT id FROM products WHERE externalId = ?", [externalId]);
    if (existing && existing.id) {
      await db.run(
        `
        UPDATE products SET
          nombre = ?, descripcion = ?, categoria = ?, disponibilidad = ?, imagen = ?,
          precioCaja = ?, precioSobre = ?, precioUnidad = ?, sobresXCaja = ?, unidadesXSobre = ?, stockCajas = ?,
          ofertaActiva = ?, ofertaTexto = ?, ofertaPrecioCaja = ?, ofertaPrecioSobre = ?, updatedAt = CURRENT_TIMESTAMP
        WHERE externalId = ?
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
          externalId,
        ]
      );
      return res.json({ id: existing.id, updated: true });
    }
  }
  const result = await db.run(
    `
    INSERT INTO products
    (externalId, nombre, descripcion, categoria, disponibilidad, imagen,
     precioCaja, precioSobre, precioUnidad, sobresXCaja, unidadesXSobre, stockCajas,
     ofertaActiva, ofertaTexto, ofertaPrecioCaja, ofertaPrecioSobre, updatedAt)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, ?, CURRENT_TIMESTAMP)
    `,
    [
      externalId,
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

app.put("/products/:id", authRequired, async (req, res) => {
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

app.put("/products/external/:externalId", authRequired, async (req, res) => {
  const externalId = String(req.params.externalId || "").trim();
  if (!externalId) return res.status(400).json({ error: "externalId inválido" });

  const p = req.body || {};
  const db = await dbPromise;

  await db.run(
    `
    UPDATE products SET
      nombre = ?, descripcion = ?, categoria = ?, disponibilidad = ?, imagen = ?,
      precioCaja = ?, precioSobre = ?, precioUnidad = ?, sobresXCaja = ?, unidadesXSobre = ?, stockCajas = ?,
      ofertaActiva = ?, ofertaTexto = ?, ofertaPrecioCaja = ?, ofertaPrecioSobre = ?, updatedAt = CURRENT_TIMESTAMP
    WHERE externalId = ?
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
      externalId,
    ]
  );

  res.json({ ok: true });
});

app.delete("/products/:id", authRequired, async (req, res) => {
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ error: "ID inválido" });

  const db = await dbPromise;
  await db.run("DELETE FROM products WHERE id = ?", [id]);
  res.json({ ok: true });
});

app.delete("/products/external/:externalId", authRequired, async (req, res) => {
  const externalId = String(req.params.externalId || "").trim();
  if (!externalId) return res.status(400).json({ error: "externalId inválido" });

  const db = await dbPromise;
  await db.run("DELETE FROM products WHERE externalId = ?", [externalId]);
  res.json({ ok: true });
});

/* ============================
   Pedidos
============================ */
app.get("/orders", authRequired, async (req, res) => {
  const db = await dbPromise;
  const status = req.query.estado;
  const rows = status
    ? await db.all("SELECT * FROM orders WHERE estado = ? ORDER BY id DESC", [status])
    : await db.all("SELECT * FROM orders ORDER BY id DESC");
  res.json(
    rows.map((r) => ({
      ...r,
      items: safeJson(r.items, []),
    }))
  );
});

app.post("/orders", async (req, res) => {
  const o = req.body || {};
  const items = Array.isArray(o.items) ? o.items : [];
  const total = toNumber(o.total);
  const externalId = o.externalId || o.id || null;

  const db = await dbPromise;
  if (externalId) {
    const existing = await db.get("SELECT id FROM orders WHERE externalId = ?", [externalId]);
    if (existing && existing.id) {
      return res.json({ id: existing.id, ok: true, existing: true });
    }
  }
  const result = await db.run(
    `
    INSERT INTO orders
    (externalId, clienteNombre, clienteTelefono, clienteDireccion, items, total, estado)
    VALUES (?,?,?,?,?,?,?)
    `,
    [
      externalId,
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

app.put("/orders/:id/status", authRequired, async (req, res) => {
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ error: "ID inválido" });

  const estado = (req.body?.estado || "").toLowerCase();
  if (!estado) return res.status(400).json({ error: "Estado requerido" });

  const db = await dbPromise;
  await db.run("UPDATE orders SET estado = ? WHERE id = ?", [estado, id]);
  res.json({ ok: true });
});

app.put("/orders/external/:externalId/status", authRequired, async (req, res) => {
  const externalId = String(req.params.externalId || "").trim();
  if (!externalId) return res.status(400).json({ error: "externalId inválido" });

  const estado = (req.body?.estado || "").toLowerCase();
  if (!estado) return res.status(400).json({ error: "Estado requerido" });

  const db = await dbPromise;
  await db.run("UPDATE orders SET estado = ? WHERE externalId = ?", [estado, externalId]);
  res.json({ ok: true });
});

app.delete("/orders", authRequired, ownerOnly, async (_req, res) => {
  const db = await dbPromise;
  await db.run("DELETE FROM orders");
  res.json({ ok: true });
});

/* ============================
   Ventas
============================ */
app.get("/sales", authRequired, async (req, res) => {
  const db = await dbPromise;
  const isOwner = req.user?.role === "owner";
  const rows = isOwner
    ? await db.all("SELECT * FROM sales ORDER BY id DESC")
    : await db.all("SELECT * FROM sales WHERE userId = ? ORDER BY id DESC", [req.user.id]);

  res.json(
    rows.map((r) => ({
      ...r,
      items: safeJson(r.items, []),
    }))
  );
});

app.post("/sales", authRequired, async (req, res) => {
  const s = req.body || {};
  const items = Array.isArray(s.items) ? s.items : [];
  const total = toNumber(s.total);
  const refId = s.refId || null;

  const db = await dbPromise;
  if (refId) {
    const existing = await db.get("SELECT id FROM sales WHERE refId = ? AND userId = ?", [
      refId,
      req.user.id,
    ]);
    if (existing && existing.id) {
      return res.json({ id: existing.id, ok: true, existing: true });
    }
  }

  const result = await db.run(
    `
    INSERT INTO sales
    (refId, userId, userName, clienteNombre, clienteTelefono, total, items, metodoPago, fechaISO)
    VALUES (?,?,?,?,?,?,?,?,?)
    `,
    [
      refId,
      req.user.id,
      req.user.username || "",
      s.clienteNombre || "",
      s.clienteTelefono || "",
      total,
      JSON.stringify(items),
      s.metodoPago || "",
      s.fechaISO || new Date().toISOString(),
    ]
  );

  res.json({ id: result.lastID });
});

app.delete("/sales", authRequired, ownerOnly, async (_req, res) => {
  const db = await dbPromise;
  await db.run("DELETE FROM sales");
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

app.delete("/reviews", authRequired, ownerOnly, async (_req, res) => {
  const db = await dbPromise;
  await db.run("DELETE FROM reviews");
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`API lista en http://localhost:${PORT}`);
});
