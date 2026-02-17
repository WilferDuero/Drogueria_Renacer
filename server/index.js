require("dotenv").config();

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const https = require("https");
const { dbPromise } = require("./db");

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change";
const TOKEN_TTL = process.env.JWT_TTL || "8h";
const PUSH_LOW_STOCK_THRESHOLD = Math.max(
  1,
  Number.parseInt(process.env.PUSH_LOW_STOCK_THRESHOLD || "2", 10) || 2
);
const PUSH_NOTIFY_ROLES = (() => {
  const allowed = new Set(["owner", "staff"]);
  const configured = String(process.env.PUSH_NOTIFY_ROLES || "owner")
    .split(",")
    .map((v) => String(v || "").trim().toLowerCase())
    .filter((v) => allowed.has(v));
  return configured.length ? configured : ["owner"];
})();

const DEFAULT_CORS_ORIGINS = [
  "https://drogueria-renacer.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "null",
];

const configuredOrigins = String(process.env.CORS_ORIGINS || "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);

const allowedOrigins = new Set(
  (configuredOrigins.length ? configuredOrigins : DEFAULT_CORS_ORIGINS).map((o) =>
    String(o).toLowerCase()
  )
);

const corsOrigin = (origin, callback) => {
  if (!origin) return callback(null, true);
  if (allowedOrigins.has(String(origin).toLowerCase())) return callback(null, true);
  return callback(null, false);
};

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
    origin: corsOrigin,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204,
  })
);
app.use(express.json({ limit: "1mb" }));

const toNumber = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const formatMoneyCop = (value) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(toNumber(value, 0));

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

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_REQUEST_TIMEOUT_MS = 15000;

const isExpoPushToken = (token) =>
  /^ExponentPushToken\[[^\]]+\]$/.test(token) || /^ExpoPushToken\[[^\]]+\]$/.test(token);

const maskPushToken = (token) => {
  const value = String(token || "").trim();
  if (!value) return "";
  if (value.length <= 24) return value;
  return `${value.slice(0, 18)}...${value.slice(-6)}`;
};

const chunkArray = (items, chunkSize) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
};

const runNonBlocking = (label, taskFn) => {
  Promise.resolve()
    .then(taskFn)
    .catch((error) => {
      console.error(`[push:${label}]`, error?.message || error);
    });
};

const sanitizePushRoleList = (roles) => {
  const safeRoles = Array.isArray(roles) ? roles : PUSH_NOTIFY_ROLES;
  return safeRoles
    .map((role) => String(role || "").trim().toLowerCase())
    .filter((role) => role === "owner" || role === "staff");
};

async function listPushTokensByRoles(db, roles) {
  const roleList = sanitizePushRoleList(roles);
  if (!roleList.length) return [];
  const placeholders = roleList.map(() => "?").join(",");
  const rows = await db.all(
    `SELECT token, platform FROM push_tokens WHERE active = 1 AND role IN (${placeholders})`,
    roleList
  );
  return rows
    .map((row) => ({
      token: String(row?.token || "").trim(),
      platform: String(row?.platform || "").trim().toLowerCase(),
    }))
    .filter((entry) => entry.token.length > 0);
}

async function disablePushTokens(db, tokens) {
  if (!tokens.length) return;
  const placeholders = tokens.map(() => "?").join(",");
  await db.run(
    `UPDATE push_tokens SET active = 0, updatedAt = CURRENT_TIMESTAMP WHERE token IN (${placeholders})`,
    tokens
  );
}

function postJsonWithHttps(url, jsonBody) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(jsonBody),
        },
      },
      (response) => {
        let raw = "";
        response.on("data", (chunk) => {
          raw += String(chunk);
        });
        response.on("end", () => {
          let payload = null;
          try {
            payload = raw ? JSON.parse(raw) : null;
          } catch {
            payload = null;
          }
          resolve({
            ok: Number(response.statusCode) >= 200 && Number(response.statusCode) < 300,
            status: Number(response.statusCode) || 500,
            payload,
          });
        });
      }
    );

    request.setTimeout(EXPO_PUSH_REQUEST_TIMEOUT_MS, () => {
      request.destroy(new Error("Timeout enviando push a Expo"));
    });
    request.on("error", reject);
    request.write(jsonBody);
    request.end();
  });
}

async function sendExpoPushChunk(chunk) {
  const body = JSON.stringify(chunk);
  let payload = null;
  let status = 0;
  let ok = false;

  if (typeof fetch === "function") {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body,
    });
    payload = await response.json().catch(() => null);
    status = Number(response.status) || 500;
    ok = !!response.ok;
  } else {
    const fallbackResponse = await postJsonWithHttps(EXPO_PUSH_URL, body);
    payload = fallbackResponse.payload;
    status = fallbackResponse.status;
    ok = fallbackResponse.ok;
  }

  if (!ok) {
    throw new Error(
      payload?.errors?.[0]?.message || payload?.error || `Error enviando push. HTTP ${status}`
    );
  }

  return Array.isArray(payload?.data) ? payload.data : [];
}

async function sendPushToRoles({ roles, title, body, data = {} }) {
  const db = await dbPromise;
  const pushDevices = await listPushTokensByRoles(db, roles);
  if (!pushDevices.length) {
    console.log(
      `[push] roles=${sanitizePushRoleList(roles).join(",")} targets=0 sent=0 inactive=0 reason=no-active-tokens`
    );
    return { sent: 0, inactive: 0 };
  }

  const validPushDevices = pushDevices.filter((entry) => isExpoPushToken(entry.token));
  if (!validPushDevices.length) {
    console.warn("[push] no hay tokens Expo validos activos para envio.");
    console.log(
      `[push] roles=${sanitizePushRoleList(roles).join(",")} targets=0 sent=0 inactive=0 reason=no-valid-expo-tokens`
    );
    return { sent: 0, inactive: 0 };
  }

  const uniqueDevices = [];
  const seenTokens = new Set();
  for (const entry of validPushDevices) {
    if (seenTokens.has(entry.token)) continue;
    seenTokens.add(entry.token);
    uniqueDevices.push(entry);
  }

  const messages = uniqueDevices.map((entry) => ({
    to: entry.token,
    // Android requiere canal para mostrar notificaciones de forma consistente.
    channelId: entry.platform === "android" ? "default" : undefined,
    sound: "default",
    priority: "high",
    title: String(title || "").slice(0, 120),
    body: String(body || "").slice(0, 400),
    data,
  }));

  let sent = 0;
  const staleTokens = [];
  const chunks = chunkArray(messages, 100);
  for (const chunk of chunks) {
    const tickets = await sendExpoPushChunk(chunk);
    sent += chunk.length;
    tickets.forEach((ticket, index) => {
      const isDeviceNotRegistered =
        ticket?.status === "error" && ticket?.details?.error === "DeviceNotRegistered";
      if (isDeviceNotRegistered) {
        staleTokens.push(chunk[index]?.to);
      }
      if (ticket?.status === "error" && !isDeviceNotRegistered) {
        console.warn(
          `[push] ticket error: ${ticket?.details?.error || "unknown"} - ${
            ticket?.message || "sin mensaje"
          }`
        );
      }
    });
  }

  const uniqueStale = [...new Set(staleTokens.filter(Boolean))];
  if (uniqueStale.length) {
    await disablePushTokens(db, uniqueStale);
  }
  console.log(
    `[push] roles=${sanitizePushRoleList(roles).join(",")} targets=${uniqueDevices.length} sent=${sent} inactive=${uniqueStale.length}`
  );
  return { sent, inactive: uniqueStale.length };
}

const isLowStock = (stock) => {
  const normalized = toInt(stock, 0);
  return normalized >= 0 && normalized <= PUSH_LOW_STOCK_THRESHOLD;
};

const crossedIntoLowStock = (beforeStock, afterStock) =>
  !isLowStock(beforeStock) && isLowStock(afterStock);

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
   Notificaciones push
============================ */
app.post("/notifications/register", authRequired, async (req, res) => {
  const token = String(req.body?.token || "").trim();
  const platform = String(req.body?.platform || "").trim().toLowerCase();
  const deviceId = String(req.body?.deviceId || "").trim();
  if (!isExpoPushToken(token)) {
    console.warn(
      `[push-register] rejected user=${req.user?.id || "?"} role=${req.user?.role || "?"} platform=${platform || "-"} token=${maskPushToken(
        token
      )}`
    );
    return res.status(400).json({ error: "Token push invalido" });
  }

  const db = await dbPromise;
  const existing = await db.get("SELECT id FROM push_tokens WHERE token = ?", [token]);
  if (existing?.id) {
    await db.run(
      `
      UPDATE push_tokens
      SET userId = ?, role = ?, platform = ?, deviceId = ?, active = 1, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [req.user.id, req.user.role, platform || null, deviceId || null, existing.id]
    );
    console.log(
      `[push-register] ok user=${req.user.id} role=${req.user.role} platform=${platform || "-"} updated=true token=${maskPushToken(
        token
      )}`
    );
    return res.json({ ok: true, updated: true });
  }

  await db.run(
    `
    INSERT INTO push_tokens (userId, role, platform, deviceId, token, active, updatedAt)
    VALUES (?,?,?,?,?,1,CURRENT_TIMESTAMP)
    `,
    [req.user.id, req.user.role, platform || null, deviceId || null, token]
  );
  console.log(
    `[push-register] ok user=${req.user.id} role=${req.user.role} platform=${platform || "-"} updated=false token=${maskPushToken(
      token
    )}`
  );
  return res.json({ ok: true });
});

app.post("/notifications/unregister", authRequired, async (req, res) => {
  const token = String(req.body?.token || "").trim();
  if (!token) {
    return res.status(400).json({ error: "Token push requerido" });
  }

  const db = await dbPromise;
  await db.run(
    `
    UPDATE push_tokens
    SET active = 0, updatedAt = CURRENT_TIMESTAMP
    WHERE token = ? AND userId = ?
    `,
    [token, req.user.id]
  );
  console.log(
    `[push-unregister] ok user=${req.user.id} role=${req.user.role} token=${maskPushToken(token)}`
  );
  return res.json({ ok: true });
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
  const targetUser = await db.get("SELECT id, role FROM users WHERE id = ?", [id]);
  if (!targetUser) return res.status(404).json({ error: "Usuario no encontrado" });
  const nextRoleRaw = role ? String(role).trim().toLowerCase() : "";
  if (nextRoleRaw && !["owner", "staff"].includes(nextRoleRaw)) {
    return res.status(400).json({ error: "Rol invalido" });
  }
  const currentRole = String(targetUser.role || "").trim().toLowerCase();
  if (nextRoleRaw === "staff" && currentRole === "owner") {
    const ownersRow = await db.get("SELECT COUNT(*) as c FROM users WHERE role = 'owner'");
    const ownerCount = Number(ownersRow?.c ?? ownersRow?.count ?? 0);
    if (ownerCount <= 1) {
      return res.status(409).json({ error: "No se puede cambiar el ultimo owner a staff." });
    }
  }

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

  if (nextRoleRaw) {
    await db.run("UPDATE users SET role = ? WHERE id = ?", [nextRoleRaw, id]);
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
    const existing = await db.get(
      "SELECT id, nombre, stockCajas FROM products WHERE externalId = ?",
      [externalId]
    );
    if (existing && existing.id) {
      const previousStock = toInt(existing.stockCajas, Number.MAX_SAFE_INTEGER);
      const nextStock = toInt(p.stockCajas, 0);
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
      if (crossedIntoLowStock(previousStock, nextStock)) {
        runNonBlocking("stock-low-external-upsert", async () => {
          await sendPushToRoles({
            roles: PUSH_NOTIFY_ROLES,
            title: "Alerta de stock bajo",
            body: `${p.nombre || existing.nombre || "Producto"} quedo en ${nextStock} cajas.`,
            data: {
              type: "stock_low",
              externalId,
              productName: p.nombre || existing.nombre || "",
              stockCajas: nextStock,
              threshold: PUSH_LOW_STOCK_THRESHOLD,
            },
          });
        });
      }
      return res.json({ id: existing.id, updated: true });
    }
  }
  const initialStock = toInt(p.stockCajas, 0);
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

  if (isLowStock(initialStock)) {
    runNonBlocking("stock-low-create", async () => {
      await sendPushToRoles({
        roles: PUSH_NOTIFY_ROLES,
        title: "Alerta de stock bajo",
        body: `${p.nombre || "Producto"} quedo en ${initialStock} cajas.`,
        data: {
          type: "stock_low",
          productId: result.lastID,
          externalId,
          productName: p.nombre || "",
          stockCajas: initialStock,
          threshold: PUSH_LOW_STOCK_THRESHOLD,
        },
      });
    });
  }

  res.json({ id: result.lastID });
});

app.put("/products/:id", authRequired, async (req, res) => {
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ error: "ID inválido" });

  const p = req.body || {};
  const db = await dbPromise;
  const existing = await db.get(
    "SELECT id, nombre, stockCajas, externalId FROM products WHERE id = ?",
    [id]
  );
  const previousStock = toInt(existing?.stockCajas, Number.MAX_SAFE_INTEGER);
  const nextStock = toInt(p.stockCajas, 0);

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

  if (existing?.id && crossedIntoLowStock(previousStock, nextStock)) {
    runNonBlocking("stock-low-id-update", async () => {
      await sendPushToRoles({
        roles: PUSH_NOTIFY_ROLES,
        title: "Alerta de stock bajo",
        body: `${p.nombre || existing.nombre || "Producto"} quedo en ${nextStock} cajas.`,
        data: {
          type: "stock_low",
          productId: id,
          externalId: existing.externalId || null,
          productName: p.nombre || existing.nombre || "",
          stockCajas: nextStock,
          threshold: PUSH_LOW_STOCK_THRESHOLD,
        },
      });
    });
  }

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

  const nextStock = toInt(p.stockCajas, 0);
  if (isLowStock(nextStock)) {
    runNonBlocking("stock-low-external-update", async () => {
      await sendPushToRoles({
        roles: PUSH_NOTIFY_ROLES,
        title: "Alerta de stock bajo",
        body: `${p.nombre || "Producto"} quedo en ${nextStock} cajas.`,
        data: {
          type: "stock_low",
          externalId,
          productName: p.nombre || "",
          stockCajas: nextStock,
          threshold: PUSH_LOW_STOCK_THRESHOLD,
        },
      });
    });
  }

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
  const status = String(o.estado || "pendiente").toLowerCase();

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
      status,
    ]
  );
  console.log(
    `[orders] created id=${result.lastID} externalId=${externalId || "-"} estado=${status} total=${toNumber(total, 0)}`
  );

  if (status === "pendiente") {
    runNonBlocking("order-created", async () => {
      const orderRef = externalId || `#${result.lastID}`;
      const customer = String(o.clienteNombre || "").trim() || "Cliente";
      await sendPushToRoles({
        roles: PUSH_NOTIFY_ROLES,
        title: "Nuevo pedido pendiente",
        body: `${customer} envio ${orderRef} por ${formatMoneyCop(total)}.`,
        data: {
          type: "new_order",
          orderId: result.lastID,
          externalId,
          customerName: customer,
          total,
          estado: status,
        },
      });
    });
  }

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
