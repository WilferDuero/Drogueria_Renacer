/* ==========================================================
  DROGUERÍA RENACER — core.js
  Compartido: storage, utilidades, stock, pedidos, modales, stats
========================================================== */

const LS_KEY = "productos_renacer_v1";
const CART_KEY = "cart_renacer";
const ADMIN_FLAG = "admin_logged";
const ADMIN_SESSION_TS_KEY = "admin_session_ts_v1";
const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 horas
const ADMIN_TOKEN_KEY = "admin_token_v1";
const ADMIN_USER_KEY = "admin_user_v1";
const WHATS_NUMBER = "573133585508";
const DEMO_MODE = true;
const API_BASE_DEFAULT =
  !location.hostname || location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "http://localhost:3001"
    : "https://drogueria-renacer.onrender.com";
const API_BASE_STORED = localStorage.getItem("API_BASE");
const IS_LOCAL_HOST =
  !location.hostname || location.hostname === "localhost" || location.hostname === "127.0.0.1";
let API_BASE = API_BASE_STORED || API_BASE_DEFAULT;
if (!IS_LOCAL_HOST && API_BASE_STORED && /localhost|127\.0\.0\.1/i.test(API_BASE_STORED)) {
  API_BASE = API_BASE_DEFAULT;
  localStorage.setItem("API_BASE", API_BASE);
}
const API_ENABLED = (() => {
  const v = localStorage.getItem("API_ENABLED");
  return v === null ? true : v !== "false";
})();

/* Umbral de alerta de stock (basado en cajas disponibles) */
const STOCK_BAJO_LIMIT = 2;

/* ==========================================================
  Presentaciones por canal
========================================================== */
const SALE_CHANNELS = {
  WEB: {
    allow: ["caja", "sobre"], // ❌ unidades NO online
  },
  FISICA: {
    allow: ["caja", "sobre", "unidad"],
  },
};

const SALES_KEY = "ventas_renacer";
const ORDERS_KEY = "pedidos_renacer_v1";

/* ✅ Cliente (recordar / borrar) */
const CUSTOMER_KEY = "cliente_renacer_v1";
const CUSTOMER_PREF_KEY = "cliente_remember_enabled_v1";

/* ✅ Reviews */
const REVIEWS_KEY = "reviews_renacer_v1";

/* Formateador COP */
const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

/* ==========================================================
  Estado
========================================================== */
// Base vacia: los productos se crean desde el panel admin.
let products = [];

let cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
let sales = JSON.parse(localStorage.getItem(SALES_KEY) || "[]");
let editingIdx = -1;

/* ==========================================================
  Utilidades generales
========================================================== */
function parsePriceInput(v) {
  if (!v && v !== 0) return 0;
  if (typeof v === "number") return Math.round(v);

  let s = String(v).trim().replace(/\s/g, "").replace(/\./g, "").replace(/,/g, ".");
  const n = Number(s);
  return Number.isNaN(n) ? 0 : Math.round(n);
}

function formatCOP(n) {
  return COP.format(Number(n) || 0);
}

/* Toast */
function showToast(text = "¡Hecho!") {
  const n = document.getElementById("notif");
  if (!n) return;
  n.textContent = text;
  n.classList.add("show");
  setTimeout(() => n.classList.remove("show"), 1300);
}

/* ==========================================================
  Fecha
========================================================== */
function nowISO() {
  return new Date().toISOString();
}

/* ==========================================================
  ✅ Lock de pedidos (anti doble click / doble procesamiento)
  - Versión estable con localStorage + TTL
========================================================== */
const ORDER_LOCK_PREFIX = "order_lock_v1_";
const ORDER_LOCK_TTL_MS = 12000; // 12s

function acquireOrderLock(orderId) {
  try {
    const key = ORDER_LOCK_PREFIX + String(orderId || "");
    const now = Date.now();

    const raw = localStorage.getItem(key);
    if (raw) {
      const data = JSON.parse(raw);
      const ts = Number(data?.ts || 0);
      if (ts && now - ts < ORDER_LOCK_TTL_MS) return false;
    }

    localStorage.setItem(key, JSON.stringify({ ts: now }));
    return true;
  } catch (e) {
    console.warn("acquireOrderLock error:", e);
    return true; // degradación suave
  }
}

function releaseOrderLock(orderId) {
  try {
    const key = ORDER_LOCK_PREFIX + String(orderId || "");
    localStorage.removeItem(key);
  } catch (e) {
    console.warn("releaseOrderLock error:", e);
  }
}

/* Abre ventana con tolerancia a popup-block */
function openWindowSafe(url = "", target = "_blank") {
  const w = window.open(url, target);
  if (!w) {
    alert("Tu navegador bloqueó la ventana emergente. Permite popups para imprimir/abrir el recibo.");
    return null;
  }
  return w;
}

/* ==========================================================
  API (backend)
========================================================== */
async function apiFetch(path, options = {}) {
  if (!API_ENABLED) throw new Error("API deshabilitada");
  const url = API_BASE.replace(/\/$/, "") + path;
  const controller = new AbortController();
  const isRemote = /onrender\.com|railway\.app|vercel\.app/i.test(API_BASE);
  const timeout = setTimeout(() => controller.abort(), isRemote ? 10000 : 4000);

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(url, { ...options, headers, signal: controller.signal });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } finally {
    clearTimeout(timeout);
  }
}

async function apiLogin(username, password) {
  return apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

async function apiMe() {
  return apiFetch("/auth/me");
}

function normalizeApiOrder(o) {
  const items = Array.isArray(o?.items) ? o.items : [];
  const nombre = o?.clienteNombre || o?.clientenombre || "";
  const telefono = o?.clienteTelefono || o?.clientetelefono || "";
  const direccion = o?.clienteDireccion || o?.clientedireccion || "";
  return {
    id: o?.externalId || String(o?.id || ""),
    cliente: {
      nombre,
      telefono,
      direccion,
    },
    items,
    total: Number(o?.total) || 0,
    estado: o?.estado || "pendiente",
    fechaISO: o?.createdAt || o?.createdat || nowISO(),
    synced: true,
    motivoRechazo: "",
    itemsAceptados: [],
    itemsRechazados: [],
    totalAceptado: 0,
    esParcial: false,
    fechaCancelacionISO: "",
    fechaAceptacionISO: "",
    fechaRechazoISO: "",
    fechaConfirmacionClienteISO: "",
  };
}

async function syncProductsFromApi(options = {}) {
  const allowEmpty = !!options.allowEmpty;
  try {
    const list = await apiFetch("/products");
    if (Array.isArray(list)) {
      const local = loadSavedProductsArray();
      if (!allowEmpty && list.length === 0 && local.length > 0) return null;

      const localMap = new Map(local.map((p) => [p.id, p]));
      const apiIds = new Set();

      const merged = list.map((apiP) => {
        const localP = localMap.get(apiP.id);
        apiIds.add(apiP.id);
        return {
          ...localP,
          ...apiP,
          // preservar historial de precio local (API no lo guarda)
          prevPrecioCaja: localP?.prevPrecioCaja || 0,
          prevPrecioSobre: localP?.prevPrecioSobre || 0,
          priceChangedISO: localP?.priceChangedISO || "",
        };
      });

      // conserva productos locales que aún no existen en la API
      local.forEach((p) => {
        if (!apiIds.has(p.id)) merged.push(p);
      });

      saveSavedProductsArray(merged);
      products = getProductsLocal();
      return merged;
    }
  } catch (e) {}
  return null;
}

async function apiUpsertProduct(p, isUpdate) {
  const payload = { ...p, externalId: p.id };
  const path = isUpdate
    ? `/products/external/${encodeURIComponent(p.id)}`
    : "/products";
  const method = isUpdate ? "PUT" : "POST";
  return apiFetch(path, { method, body: JSON.stringify(payload) });
}

async function apiDeleteProduct(id) {
  return apiFetch(`/products/external/${encodeURIComponent(id)}`, { method: "DELETE" });
}

async function apiCreateOrder(order) {
  const payload = {
    externalId: order.id,
    clienteNombre: order?.cliente?.nombre || "",
    clienteTelefono: order?.cliente?.telefono || "",
    clienteDireccion: order?.cliente?.direccion || "",
    items: order.items || [],
    total: order.total || 0,
    estado: order.estado || "pendiente",
  };
  return apiFetch("/orders", { method: "POST", body: JSON.stringify(payload) });
}

async function syncOrdersFromApi(options = {}) {
  const allowEmpty = !!options.allowEmpty;
  const phoneFilter = normPhoneDigits(options.phoneDigits || "");
  try {
    const list = await apiFetch("/orders");
    if (Array.isArray(list)) {
      let local = loadOrders();
      if (phoneFilter) {
        local = local.filter((o) => normPhoneDigits(o?.cliente?.telefono) === phoneFilter);
      }
      if (!allowEmpty && list.length === 0 && local.length > 0) return null;

      let normalized = list.map(normalizeApiOrder);
      if (phoneFilter) {
        normalized = normalized.filter(
          (o) => normPhoneDigits(o?.cliente?.telefono) === phoneFilter
        );
      }
      const localMap = new Map(local.map((o) => [o.id, o]));
      const apiIds = new Set();

      const merged = normalized.map((apiO) => {
        const localO = localMap.get(apiO.id);
        apiIds.add(apiO.id);
        if (!localO) return apiO;

        return {
          ...localO,
          // actualiza estado desde API sin perder detalles locales
          estado: apiO.estado || localO.estado,
          total: localO.total || apiO.total,
          fechaISO: localO.fechaISO || apiO.fechaISO,
          cliente: localO.cliente?.nombre ? localO.cliente : apiO.cliente,
          items: Array.isArray(localO.items) && localO.items.length ? localO.items : apiO.items,
          synced: true,
        };
      });

      // conserva pedidos locales que aún no existen en la API
      local.forEach((o) => {
        if (!apiIds.has(o.id)) merged.push(o);
      });

      // ordena por fecha (más nuevo primero)
      merged.sort((a, b) => String(b.fechaISO || "").localeCompare(String(a.fechaISO || "")));

      saveOrders(merged);
      return merged;
    }
  } catch (e) {}
  return null;
}

async function apiUpdateOrderStatus(order) {
  const externalId = order?.id || "";
  if (!externalId) return null;
  return apiFetch(`/orders/external/${encodeURIComponent(externalId)}/status`, {
    method: "PUT",
    body: JSON.stringify({ estado: order.estado || "pendiente" }),
  });
}

async function apiClearOrders() {
  return apiFetch("/orders", { method: "DELETE" });
}

async function apiCreateReview(review) {
  const payload = {
    nombre: review?.nombre || "",
    telefono: review?.telefonoDigits || "",
    rating: review?.rating || 0,
    texto: review?.texto || "",
    verificada: review?.verified ? 1 : 0,
  };
  return apiFetch("/reviews", { method: "POST", body: JSON.stringify(payload) });
}

async function apiClearReviews() {
  return apiFetch("/reviews", { method: "DELETE" });
}

async function syncReviewsFromApi(options = {}) {
  const allowEmpty = !!options.allowEmpty;
  try {
    const list = await apiFetch("/reviews");
    if (Array.isArray(list)) {
      let local = [];
      try {
        local = JSON.parse(localStorage.getItem(REVIEWS_KEY) || "[]");
      } catch {
        local = [];
      }

      if (!allowEmpty && list.length === 0 && local.length > 0) return null;

      const normalized = list.map((r) => ({
        id: String(r?.id || r?.externalId || ""),
        nombre: r?.nombre || "Cliente",
        telefonoDigits: normPhoneDigits(r?.telefono || ""),
        rating: Number(r?.rating) || 0,
        texto: r?.texto || "",
        verified: !!r?.verificada,
        fechaISO: r?.createdAt || r?.createdat || nowISO(),
      }));
      localStorage.setItem(REVIEWS_KEY, JSON.stringify(normalized));
      return normalized;
    }
  } catch (e) {}
  return null;
}

async function apiCreateSale(sale) {
  const payload = {
    refId: sale?.refId || "",
    clienteNombre: sale?.cliente?.nombre || "",
    clienteTelefono: sale?.cliente?.telefono || "",
    total: sale?.total || 0,
    items: sale?.items || [],
    metodoPago: sale?.metodoPago || "",
    fechaISO: sale?.fechaISO || nowISO(),
  };
  return apiFetch("/sales", { method: "POST", body: JSON.stringify(payload) });
}

async function apiClearSales() {
  return apiFetch("/sales", { method: "DELETE" });
}

async function syncSalesFromApi() {
  try {
    const list = await apiFetch("/sales");
    if (Array.isArray(list)) return list;
  } catch (e) {}
  return null;
}

/* ==========================================================
  Storage: productos
========================================================== */
function loadSavedProductsArray() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveSavedProductsArray(arr) {
  localStorage.setItem(LS_KEY, JSON.stringify(arr));
  try {
    localStorage.setItem(LS_KEY + "_backup", JSON.stringify(arr.slice(0, 200)));
  } catch (e) {}
  localStorage.setItem(LS_KEY + "_ts", String(Date.now()));
  localStorage.setItem(LS_KEY + "_backup_ts", new Date().toISOString());
}

/* Fuente única de productos (con fallback si storage está vacío) */
function getProductsLocal() {
  const saved = loadSavedProductsArray();
  if (Array.isArray(saved) && saved.length) return saved;

  // fallback: si borraron storage, devolvemos base inicial normalizada
  return products.map((p) => ({
    ...p,
    prevPrecioCaja: 0,
    prevPrecioSobre: 0,
    priceChangedISO: "",
    ofertaActiva: false,
    ofertaTexto: "",
    ofertaPrecioCaja: 0,
    ofertaPrecioSobre: 0,
  }));
}

/* ==========================================================
  Storage: pedidos
========================================================== */
function loadOrders() {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch (err) {
    console.error("loadOrders() error:", err);
    return [];
  }
}

function saveOrders(orders) {
  try {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
    localStorage.setItem(ORDERS_KEY + "_backup", JSON.stringify(orders.slice(0, 30)));
    localStorage.setItem(ORDERS_KEY + "_ts", String(Date.now()));
    localStorage.setItem(ORDERS_KEY + "_backup_ts", new Date().toISOString());
    return true;
  } catch (err) {
    console.error("saveOrders() error:", err);
    alert("⚠️ No se pudo guardar en localStorage. Revisa espacio disponible o consola.");
    return false;
  }
}

/* Genera un ID de pedido con formato DR-YYYYMMDD-#### */
function generateOrderId() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const datePart = `${y}${m}${day}`;

  const orders = loadOrders().filter((o) => String(o.id || "").includes(`DR-${datePart}`));
  const seq = String(orders.length + 1).padStart(4, "0");
  return `DR-${datePart}-${seq}`;
}

/* ==========================================================
  Cálculos de stock (visual)
========================================================== */
function calcularStockTotalUnidades(producto) {
  const cajas = producto.stockCajas || 0;
  const sobres = cajas * (producto.sobresXCaja || 0);
  const unidades = sobres * (producto.unidadesXSobre || 0);
  return { cajas, sobres, unidades, total: unidades };
}

/* ==========================================================
  Manejo de stock (base en cajas)
========================================================== */
function cajasNecesariasParaVenta(producto, tipo, cantidad) {
  const qty = Number(cantidad) || 0;
  if (qty <= 0) return 0;
  if (tipo === "caja") return qty;

  const sobresXCaja = Number(producto.sobresXCaja) || 0;
  const unidadesXSobre = Number(producto.unidadesXSobre) || 0;

  if (tipo === "sobre") {
    if (sobresXCaja <= 0) return Infinity;
    return Math.ceil(qty / sobresXCaja);
  }

  if (tipo === "unidad") {
    const unidadesPorCaja = sobresXCaja * unidadesXSobre;
    if (unidadesPorCaja <= 0) return Infinity;
    return Math.ceil(qty / unidadesPorCaja);
  }

  return Infinity;
}

function validarStockParaItem(producto, tipo, cantidad) {
  if (!producto || !producto.id) {
    return { ok: false, cajasNecesarias: 0, msg: "Producto inválido." };
  }

  if (!["caja", "sobre", "unidad"].includes(tipo)) {
    return { ok: false, cajasNecesarias: 0, msg: "Tipo de venta inválido." };
  }

  if (!Number.isFinite(Number(cantidad)) || Number(cantidad) <= 0) {
    return { ok: false, cajasNecesarias: 0, msg: "Cantidad inválida." };
  }

  const cajasNecesarias = cajasNecesariasParaVenta(producto, tipo, cantidad);

  if (!Number.isFinite(cajasNecesarias)) {
    return { ok: false, cajasNecesarias: 0, msg: "Presentación inválida para este producto." };
  }

  if ((producto.stockCajas || 0) < cajasNecesarias) {
    return {
      ok: false,
      cajasNecesarias,
      msg: `Stock insuficiente: requiere ${cajasNecesarias} caja(s) y hay ${producto.stockCajas || 0}.`,
    };
  }

  return { ok: true, cajasNecesarias, msg: "" };
}

function descontarStock(producto, tipo, cantidad) {
  const res = validarStockParaItem(producto, tipo, cantidad);
  if (!res.ok) return res;

  producto.stockCajas = (producto.stockCajas || 0) - res.cajasNecesarias;
  if (producto.stockCajas < 0) producto.stockCajas = 0;
  return res;
}

function revertirStock(producto, tipo, cantidad) {
  const cajas = cajasNecesariasParaVenta(producto, tipo, cantidad);
  if (!Number.isFinite(cajas) || cajas <= 0) {
    return { ok: false, cajas: 0, msg: "No se pudo calcular cajas a revertir." };
  }
  producto.stockCajas = (producto.stockCajas || 0) + cajas;
  return { ok: true, cajas, msg: "" };
}

/* ==========================================================
  Estadísticas del panel admin
========================================================== */
function ensureSalesLoaded() {
  try {
    sales = JSON.parse(localStorage.getItem(SALES_KEY) || "[]");
  } catch {
    sales = [];
  }
}

function updateVentasStats() {
  ensureSalesLoaded();
  const totalVentas = sales.length;
  const ingresosVentas = sales.reduce((sum, v) => sum + (Number(v.total) || 0), 0);

  const statVentas = document.getElementById("statVentasTotales");
  if (statVentas) statVentas.textContent = totalVentas;

  const statIngresos = document.getElementById("statIngresosVentas");
  if (statIngresos) statIngresos.textContent = formatCOP(ingresosVentas);
}

function updateStats() {
  ensureSalesLoaded();
  const saved = JSON.parse(localStorage.getItem(LS_KEY) || "[]");

  const totalProds = saved.length;
  const statTotalProds = document.getElementById("statTotalProds");
  if (statTotalProds) statTotalProds.textContent = totalProds;

  const categorias = new Set(saved.map((p) => p.categoria || ""));
  const statCategs = document.getElementById("statCategs");
  if (statCategs) statCategs.textContent = categorias.size;

  const hoy = new Date();
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const inicioAño = new Date(hoy.getFullYear(), 0, 1);

  const parseFechaVenta = (v) => {
    if (v && v.fechaISO) {
      const d = new Date(v.fechaISO);
      return isNaN(d.getTime()) ? new Date(0) : d;
    }
    const datePart = String(v?.fecha || "").split(",")[0]?.trim() || "";
    const parts = datePart.split("/");
    if (parts.length !== 3) return new Date(0);
    const [dd, mm, yyyy] = parts;
    const d = new Date(`${yyyy}-${mm}-${dd}`);
    return isNaN(d.getTime()) ? new Date(0) : d;
  };

  const ingresosDiarios = sales.reduce(
    (sum, v) => (parseFechaVenta(v) >= inicioHoy ? sum + (Number(v.total) || 0) : sum),
    0
  );
  const ingresosMensuales = sales.reduce(
    (sum, v) => (parseFechaVenta(v) >= inicioMes ? sum + (Number(v.total) || 0) : sum),
    0
  );
  const ingresosAnuales = sales.reduce(
    (sum, v) => (parseFechaVenta(v) >= inicioAño ? sum + (Number(v.total) || 0) : sum),
    0
  );

  const statIngresosDiarios = document.getElementById("statIngresosDiarios");
  if (statIngresosDiarios) statIngresosDiarios.textContent = formatCOP(ingresosDiarios);

  const statIngresosMensuales = document.getElementById("statIngresosMensuales");
  if (statIngresosMensuales) statIngresosMensuales.textContent = formatCOP(ingresosMensuales);

  const statIngresosAnuales = document.getElementById("statIngresosAnuales");
  if (statIngresosAnuales) statIngresosAnuales.textContent = formatCOP(ingresosAnuales);

  const alertas = saved.filter((p) => (Number(p.stockCajas) || 0) <= STOCK_BAJO_LIMIT).length;
  const statAlertas = document.getElementById("statAlertas");
  if (statAlertas) statAlertas.textContent = alertas;

  updateVentasStats();
}

/* ==========================================================
  Carga inicial de productos (normaliza + añade campos nuevos)
========================================================== */
(function loadSavedProducts() {
  let raw = [];
  try {
    raw = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch (e) {
    console.warn("LS_KEY corrupto, reiniciando productos:", e);
    localStorage.removeItem(LS_KEY);
    raw = [];
  }

  if (!Array.isArray(raw) || raw.length === 0) {
    // primera vez
    const initial = products.map((p) => ({
      ...p,
      prevPrecioCaja: 0,
      prevPrecioSobre: 0,
      priceChangedISO: "",
      ofertaActiva: false,
      ofertaTexto: "",
      ofertaPrecioCaja: 0,
      ofertaPrecioSobre: 0,
    }));
    saveSavedProductsArray(initial);
    products = getProductsLocal();
    return;
  }

  const normalized = raw.map((p, i) => ({
    id: p.id || "A" + Date.now() + i,
    nombre: p.nombre || "Producto",
    descripcion: p.descripcion || "",
    categoria: p.categoria || "Otro",
    disponibilidad: p.disponibilidad || "Disponible",
    imagen: p.imagen || "",

    precioCaja: parsePriceInput(p.precioCaja || 0),
    precioSobre: parsePriceInput(p.precioSobre || 0),
    precioUnidad: parsePriceInput(p.precioUnidad || 0),

    sobresXCaja: parseInt(p.sobresXCaja) || 0,
    unidadesXSobre: parseInt(p.unidadesXSobre) || 0,
    stockCajas: parseInt(p.stockCajas) || 0,

    // ✅ historial (solo para mostrar “bajó X%”)
    prevPrecioCaja: parsePriceInput(p.prevPrecioCaja || 0),
    prevPrecioSobre: parsePriceInput(p.prevPrecioSobre || 0),
    priceChangedISO: p.priceChangedISO || "",

    // ✅ oferta manual (promo real)
    ofertaActiva: !!p.ofertaActiva,
    ofertaTexto: (p.ofertaTexto || "").trim(),
    ofertaPrecioCaja: parsePriceInput(p.ofertaPrecioCaja || 0),
    ofertaPrecioSobre: parsePriceInput(p.ofertaPrecioSobre || 0),
  }));

  saveSavedProductsArray(normalized);
  products = getProductsLocal();
})();

/* ==========================================================
  API pública mínima del core (para tienda/admin)
========================================================== */
window.getProducts = function () {
  return getProductsLocal();
};

window.setProducts = function (arr) {
  if (!Array.isArray(arr)) return;
  saveSavedProductsArray(arr.slice());
  products = getProductsLocal();
};

/* ==========================================================
  Pedidos (cliente): construir + guardar + WhatsApp
========================================================== */
function buildOrderWhatsAppMessage(order) {
  const lines = [];
  lines.push(`🧾 *PEDIDO ${order.id}*`);
  lines.push(`📌 Estado: *PENDIENTE*`);
  lines.push(`🕒 Fecha: ${new Date(order.fechaISO).toLocaleString("es-CO")}`);
  lines.push("");
  lines.push(`👤 Cliente: ${order.cliente.nombre}`);
  lines.push(`📞 Tel: ${order.cliente.telefono}`);
  if (order.cliente.direccion) lines.push(`📍 Dirección: ${order.cliente.direccion}`);
  lines.push("");
  lines.push("🛒 *Productos*");
  order.items.forEach((it, i) => {
    const label = it.presentacion.charAt(0).toUpperCase() + it.presentacion.slice(1);
    lines.push(`${i + 1}. ${it.nombre} (${label}) x${it.cantidad} = ${formatCOP(it.subtotal)}`);
  });
  lines.push("");
  lines.push(`💰 *Total:* ${formatCOP(order.total)}`);
  lines.push("");
  lines.push("✅ Admin: ACEPTAR (total o parcial) o RECHAZAR desde el Panel → Pedidos.");
  return lines.join("\n");
}

function createPendingOrderFromCart(cliente) {
  if (!cart || cart.length === 0) return null;

  const nombre = (cliente?.nombre || "").trim();
  const telefono = (cliente?.telefono || "").trim();
  const direccion = (cliente?.direccion || "").trim();

  if (!nombre || !telefono) {
    alert("Por favor completa Nombre y Teléfono antes de enviar el pedido.");
    return null;
  }

  const items = cart.map((it) => ({
    id: it.id,
    nombre: it.nombre,
    presentacion: it.presentacion,
    precioUnit: it.precioUnit,
    cantidad: it.cantidad,
    subtotal: it.precioUnit * it.cantidad,
  }));

  const total = items.reduce((sum, it) => sum + it.subtotal, 0);

  const order = {
    id: generateOrderId(),
    cliente: { nombre, telefono, direccion },
    items,
    total,
    fechaISO: nowISO(),
    estado: "pendiente",
    synced: false,
    motivoRechazo: "",
    itemsAceptados: [],
    itemsRechazados: [],
    totalAceptado: 0,
    esParcial: false,
    fechaCancelacionISO: "",
    fechaAceptacionISO: "",
    fechaRechazoISO: "",
    fechaConfirmacionClienteISO: "",
  };

  const orders = loadOrders();
  orders.unshift(order);
  saveOrders(orders);

  return order;
}

function sendOrderToWhatsApp(order) {
  const msg = buildOrderWhatsAppMessage(order);
  const url = `https://wa.me/${WHATS_NUMBER}?text=${encodeURIComponent(msg)}`;
  openWindowSafe(url, "_blank");
}

/* ==========================================================
  ✅ WhatsApp al CLIENTE (estado del pedido)
========================================================== */

/* Normaliza teléfono: si viene en 10 dígitos => asume Colombia y agrega 57 */
function normalizeWhatsPhone(phoneDigits) {
  let d = String(phoneDigits || "").replace(/\D/g, "");
  if (!d) return "";
  d = d.replace(/^0+/, "");
  if (d.startsWith("57") && d.length === 13 && d[2] === "0") {
    d = "57" + d.slice(3);
  }
  if (d.length === 10) d = "57" + d;
  if (d.length < 10) return "";
  return d;
}

function buildClientOrderUpdateWhatsAppMessage(order) {
  const estado = String(order.estado || "").toLowerCase();
  const lines = [];

  lines.push(`🧾 *Actualización de tu pedido ${order.id}*`);
  lines.push(`📌 Estado: *${estado.toUpperCase()}${order.esParcial ? " (PARCIAL)" : ""}*`);
  lines.push(`🕒 ${new Date().toLocaleString("es-CO")}`);
  lines.push("");

  const c = order.cliente || {};
  if (c.nombre) lines.push(`👤 Cliente: ${c.nombre}`);
  if (c.telefono) lines.push(`📞 Tel: ${c.telefono}`);
  if (c.direccion) lines.push(`📍 Dir: ${c.direccion}`);
  lines.push("");

  if (estado === "aceptado") {
    const aceptados = Array.isArray(order.itemsAceptados) ? order.itemsAceptados : [];
    const rechazados = Array.isArray(order.itemsRechazados) ? order.itemsRechazados : [];

    const total = Number(order.totalAceptado || 0) > 0 ? Number(order.totalAceptado || 0) : Number(order.total || 0);

    if (order.esParcial && (aceptados.length || rechazados.length)) {
      lines.push("✅ *Pedido aceptado PARCIALMENTE*");
      lines.push("");

      if (aceptados.length) {
        lines.push("🟢 *Disponibles ahora*");
        aceptados.forEach((it, i) => {
          const label = (it.presentacion || "").charAt(0).toUpperCase() + (it.presentacion || "").slice(1);
          lines.push(`${i + 1}. ${it.nombre} (${label}) x${it.cantidad} = ${formatCOP(it.subtotal)}`);
        });
        lines.push("");
      }

      if (rechazados.length) {
        lines.push("🔴 *No disponibles por ahora*");
        rechazados.forEach((it, i) => {
          const label = (it.presentacion || "").charAt(0).toUpperCase() + (it.presentacion || "").slice(1);
          lines.push(`${i + 1}. ${it.nombre} (${label}) x${it.cantidad}`);
        });
        lines.push("");
      }

      lines.push(`💰 *Total actualizado:* ${formatCOP(total)}`);
      lines.push("");
      lines.push("Por favor confirma por WhatsApp:");
      lines.push("✅ Responde: *SI* para aceptar el pedido parcial");
      lines.push("❌ Responde: *NO* para cancelar el pedido");
      return lines.join("\n");
    }

    // Aceptado completo
    const items =
      Array.isArray(order.itemsAceptados) && order.itemsAceptados.length ? order.itemsAceptados : order.items || [];
    lines.push("✅ *Pedido aceptado*");
    lines.push("Productos:");
    items.forEach((it, i) => {
      const label = (it.presentacion || "").charAt(0).toUpperCase() + (it.presentacion || "").slice(1);
      lines.push(`${i + 1}. ${it.nombre} (${label}) x${it.cantidad} = ${formatCOP(it.subtotal)}`);
    });
    lines.push("");
    lines.push(`💰 *Total:* ${formatCOP(total)}`);
    lines.push("Gracias por tu compra 💙");
    return lines.join("\n");
  }

  if (estado === "rechazado") {
    lines.push("❌ *Tu pedido fue rechazado*");
    if (order.motivoRechazo) lines.push(`📝 Motivo: ${order.motivoRechazo}`);
    lines.push("");
    lines.push("Si deseas, puedes hacer un nuevo pedido o escribirnos para ayudarte.");
    return lines.join("\n");
  }

  if (estado === "cancelado") {
    lines.push("🚫 *Tu pedido fue cancelado*");
    lines.push("Si fue un error o deseas reactivar, escríbenos.");
    return lines.join("\n");
  }

  lines.push("⏳ Tu pedido está en revisión.");
  lines.push("Te avisaremos por este medio cuando sea aceptado o rechazado.");
  return lines.join("\n");
}

function sendOrderUpdateToClientWhatsApp(order) {
  const tel = normalizeWhatsPhone(order?.cliente?.telefono || "");
  if (!tel) {
    alert("Este pedido no tiene teléfono del cliente para WhatsApp.");
    return;
  }
  const msg = buildClientOrderUpdateWhatsAppMessage(order);
  const url = `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`;
  openWindowSafe(url, "_blank");
}

/* Exponer para admin.js */
window.sendOrderUpdateToClientWhatsApp = sendOrderUpdateToClientWhatsApp;

/* ==========================================================
  Modales (carrito + mis pedidos)
========================================================== */
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");

  const anyOpen = Array.from(document.querySelectorAll(".cart-modal")).some((m) => !m.classList.contains("hidden"));
  if (!anyOpen) document.body.classList.remove("modal-open");
}

/* ESC global */
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!document.getElementById("myOrdersModal")?.classList.contains("hidden")) closeModal("myOrdersModal");
  else if (!document.getElementById("cartModal")?.classList.contains("hidden")) closeModal("cartModal");
});

/* ==========================================================
  ✅ Cliente: recordar datos + borrar + autocompletar
========================================================== */
function loadCustomer() {
  try {
    return JSON.parse(localStorage.getItem(CUSTOMER_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveCustomer(partial) {
  const current = loadCustomer();
  const next = { ...current, ...partial };
  localStorage.setItem(CUSTOMER_KEY, JSON.stringify(next));
  return next;
}

function setCustomerInputs(values) {
  const nombreEl = document.getElementById("clienteNombre");
  const telEl = document.getElementById("clienteTelefono");
  const dirEl = document.getElementById("clienteDireccion");

  if (nombreEl && values.nombre != null) nombreEl.value = values.nombre;
  if (telEl && values.telefono != null) telEl.value = values.telefono;
  if (dirEl && values.direccion != null) dirEl.value = values.direccion;
}

function getCustomerInputs() {
  return {
    nombre: (document.getElementById("clienteNombre")?.value || "").trim(),
    telefono: (document.getElementById("clienteTelefono")?.value || "").trim(),
    direccion: (document.getElementById("clienteDireccion")?.value || "").trim(),
  };
}

function hydrateCustomerForm() {
  const saved = loadCustomer();
  setCustomerInputs({
    nombre: saved.nombre || "",
    telefono: saved.telefono || "",
    direccion: saved.direccion || "",
  });
}

function clearCustomer() {
  localStorage.removeItem(CUSTOMER_KEY);
  setCustomerInputs({ nombre: "", telefono: "", direccion: "" });
}

function isRememberEnabled() {
  const v = localStorage.getItem(CUSTOMER_PREF_KEY);
  return v === null ? true : v === "true";
}

function setRememberEnabled(val) {
  localStorage.setItem(CUSTOMER_PREF_KEY, val ? "true" : "false");
}

function normPhoneDigits(v) {
  return String(v || "").replace(/\D/g, "");
}

/* init recordar cliente (solo si existen elementos) */
(function initCustomerRememberUI() {
  const chk = document.getElementById("rememberCustomer");
  const btnClear = document.getElementById("clearCustomerBtn");

  if (chk) {
    chk.checked = isRememberEnabled();
    if (chk.checked) hydrateCustomerForm();

    chk.addEventListener("change", () => {
      setRememberEnabled(chk.checked);
      if (!chk.checked) {
        clearCustomer();
        showToast("Datos no se guardarán");
      } else {
        saveCustomer(getCustomerInputs());
        showToast("Datos se guardarán");
      }
    });
  }

  const nombreEl = document.getElementById("clienteNombre");
  const telEl = document.getElementById("clienteTelefono");
  const dirEl = document.getElementById("clienteDireccion");

  if (nombreEl && telEl && dirEl) {
    const saveNow = () => {
      if (!isRememberEnabled()) return;
      saveCustomer(getCustomerInputs());
    };
    ["input", "change", "blur"].forEach((evt) => {
      nombreEl.addEventListener(evt, saveNow);
      telEl.addEventListener(evt, saveNow);
      dirEl.addEventListener(evt, saveNow);
    });
  }

  if (btnClear) {
    btnClear.addEventListener("click", () => {
      clearCustomer();
      showToast("Datos borrados");
    });
  }
})();

/* ==========================================================
  Escape HTML (reviews/admin)
========================================================== */
function escapeHTML(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ==========================================================
  Helper DOM
========================================================== */
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);

  Object.entries(attrs || {}).forEach(([k, v]) => {
    if (v == null) return;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, String(v));
  });

  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c == null) return;
    if (typeof c === "string") node.appendChild(document.createTextNode(c));
    else node.appendChild(c);
  });

  return node;
}

/* ==========================================================
  RECIBOS / FACTURA HTML (PRO)
========================================================== */
const RECEIPT_KEY = "recibos_renacer_v1";

function loadReceipts() {
  try {
    return JSON.parse(localStorage.getItem(RECEIPT_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveReceipts(arr) {
  localStorage.setItem(RECEIPT_KEY, JSON.stringify(arr));
  try {
    localStorage.setItem(RECEIPT_KEY + "_backup", JSON.stringify(arr.slice(0, 50)));
  } catch (e) {}
  localStorage.setItem(RECEIPT_KEY + "_ts", String(Date.now()));
  localStorage.setItem(RECEIPT_KEY + "_backup_ts", new Date().toISOString());
}

/** consecutivo simple (por día) */
function nextReceiptNo() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const datePart = `${y}${m}${day}`;
  const receipts = loadReceipts().filter((r) => String(r.no || "").includes(`FR-${datePart}`));
  const seq = String(receipts.length + 1).padStart(4, "0");
  return `FR-${datePart}-${seq}`;
}

function buildReceipt({ tipo, cliente, items, total, refId, extras }) {
  return {
    id: "RC" + Date.now(),
    no: nextReceiptNo(),
    tipo: tipo || "venta",
    refId: refId || "",
    fechaISO: nowISO(),
    negocio: {
      nombre: "Droguería Renacer",
      nit: "NIT: (35532466-9)",
      direccion: "(Calle 2A Este No. 7-04, La Arboleda, Facatativá)",
      telefono: "(313 358 5508)",
    },
    cliente: cliente || { nombre: "Consumidor final", telefono: "", direccion: "" },
    items: Array.isArray(items) ? items : [],
    total: Number(total) || 0,
    extras: extras || { metodoPago: "", descuento: 0, iva: 0, recibido: 0, cambio: 0 },
  };
}

function upsertReceipt(receipt) {
  const all = loadReceipts();
  const idx = all.findIndex((r) => r.refId === receipt.refId && r.tipo === receipt.tipo);
  if (idx >= 0) all[idx] = receipt;
  else all.unshift(receipt);
  saveReceipts(all);
  return receipt;
}

function getReceiptByRef(refId, tipo) {
  const all = loadReceipts();
  return all.find((r) => r.refId === refId && r.tipo === tipo) || null;
}

/* (Tu receiptHTML y funciones WhatsApp quedan igual) */
function receiptHTML(receipt) {
  const fecha = receipt.fechaISO ? new Date(receipt.fechaISO).toLocaleString("es-CO") : "";
  const c = receipt.cliente || {};
  const n = receipt.negocio || {};
  const ex = receipt.extras || {};

  const rows = (receipt.items || [])
    .map((it, i) => {
      const pres = (it.presentacion || "").toString();
      const qty = Number(it.cantidad) || 0;
      const pu = Number(it.precioUnit) || 0;
      const sub = Number(it.subtotal) || pu * qty;

      return `
        <tr>
          <td class="td td-n">${i + 1}</td>
          <td class="td">
            <div class="name">${escapeHTML(it.nombre || "")}</div>
            <div class="muted">${escapeHTML(pres)}</div>
          </td>
          <td class="td td-r">${qty}</td>
          <td class="td td-r">${formatCOP(pu)}</td>
          <td class="td td-r b">${formatCOP(sub)}</td>
        </tr>
      `;
    })
    .join("");

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Recibo ${receipt.no}</title>
  <style>
    :root{ --w: 80mm; }
    body{ margin:0; padding:0; background:#fff; font-family: Arial, Helvetica, sans-serif; color:#111; }
    .ticket{ width: var(--w); margin: 0 auto; padding: 10px; }
    .center{text-align:center}
    .b{font-weight:900}
    .muted{color:#666;font-size:11px}
    .sep{ border-top: 1px dashed #999; margin: 10px 0; }
    table{ width:100%; border-collapse: collapse; font-size:12px; }
    .td{ padding:6px 0; border-bottom:1px solid #eee; vertical-align: top; }
    .td-n{ width: 14px; }
    .td-r{ text-align:right; }
    .name{ font-weight:800; }
    .tot{ display:flex; justify-content:space-between; gap:8px; font-size:13px; margin-top:8px; }
    .actions{ margin-top:10px; display:flex; gap:8px; }
    button{ width:100%; padding:10px; border-radius:10px; border:1px solid #ddd; background:#111; color:#fff; font-weight:900; cursor:pointer; }
    .btn2{ background:#25D366; border-color:#25D366; }
    @media print{
      .actions{ display:none; }
      body{ width: var(--w); }
    }
  </style>
</head>
<body>
  <div class="ticket">
    <div class="center b" style="font-size:16px;">${escapeHTML(n.nombre || "Droguería")}</div>
    <div class="center muted">${escapeHTML(n.nit || "")}</div>
    <div class="center muted">${escapeHTML(n.direccion || "")}</div>
    <div class="center muted">${escapeHTML(n.telefono || "")}</div>

    <div class="sep"></div>

    <div class="muted"><span class="b">Factura:</span> ${escapeHTML(receipt.no)}</div>
    <div class="muted"><span class="b">Fecha:</span> ${fecha}</div>
    ${receipt.refId ? `<div class="muted"><span class="b">Ref:</span> ${escapeHTML(receipt.refId)}</div>` : ""}
    <div class="muted"><span class="b">Tipo:</span> ${escapeHTML(receipt.tipo || "")}</div>

    <div class="sep"></div>

    <div class="b" style="font-size:13px;">Cliente</div>
    <div style="font-size:12px;">${escapeHTML(c.nombre || "Consumidor final")}</div>
    ${c.telefono ? `<div class="muted">${escapeHTML(c.telefono)}</div>` : ""}
    ${c.direccion ? `<div class="muted">${escapeHTML(c.direccion)}</div>` : ""}

    <div class="sep"></div>

    <table>
      <thead>
        <tr>
          <th style="text-align:left;font-size:11px;">#</th>
          <th style="text-align:left;font-size:11px;">Producto</th>
          <th style="text-align:right;font-size:11px;">Cant</th>
          <th style="text-align:right;font-size:11px;">Precio</th>
          <th style="text-align:right;font-size:11px;">Sub</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="sep"></div>

    <div class="tot"><div>Total</div><div class="b">${formatCOP(receipt.total)}</div></div>
    ${Number(ex.descuento) ? `<div class="tot"><div>Descuento</div><div class="b">- ${formatCOP(Number(ex.descuento))}</div></div>` : ""}
    ${Number(ex.iva) ? `<div class="tot"><div>IVA</div><div class="b">${formatCOP(Number(ex.iva))}</div></div>` : ""}
    ${ex.metodoPago ? `<div class="tot"><div>Método</div><div class="b">${escapeHTML(ex.metodoPago)}</div></div>` : ""}
    ${Number(ex.recibido) ? `<div class="tot"><div>Recibido</div><div class="b">${formatCOP(Number(ex.recibido))}</div></div>` : ""}
    ${Number(ex.cambio) ? `<div class="tot"><div>Cambio</div><div class="b">${formatCOP(Number(ex.cambio))}</div></div>` : ""}

    <div class="sep"></div>

    <div class="center muted">Gracias por tu compra 💙</div>

    <div class="actions">
      <button onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
      <button class="btn2" onclick="window.__sendReceiptWhatsApp && window.__sendReceiptWhatsApp()">📲 Enviar por WhatsApp</button>
    </div>
  </div>
</body>
</html>`;
}

function buildReceiptWhatsAppText(receipt) {
  const n = receipt.negocio || {};
  const c = receipt.cliente || {};
  const lines = [];

  lines.push(`🧾 *RECIBO ${receipt.no}*`);
  lines.push(`🏪 ${n.nombre || "Droguería Renacer"}`);
  lines.push(`🕒 ${receipt.fechaISO ? new Date(receipt.fechaISO).toLocaleString("es-CO") : ""}`);
  if (receipt.refId) lines.push(`🔎 Ref: ${receipt.refId}`);

  lines.push("");
  lines.push(`👤 Cliente: ${c.nombre || "Consumidor final"}`);
  if (c.telefono) lines.push(`📞 Tel: ${c.telefono}`);
  if (c.direccion) lines.push(`📍 Dir: ${c.direccion}`);

  lines.push("");
  lines.push("🛒 *Productos*");
  (receipt.items || []).forEach((it, i) => {
    lines.push(`${i + 1}. ${it.nombre} (${it.presentacion}) x${it.cantidad} = ${formatCOP(it.subtotal)}`);
  });

  lines.push("");
  lines.push(`💰 *Total:* ${formatCOP(receipt.total)}`);
  return lines.join("\n");
}

function openReceiptWindow(receipt) {
  const w = openWindowSafe("", "_blank");
  if (!w) return;

  w.document.open();
  w.document.write(receiptHTML(receipt));
  w.document.close();

  w.__sendReceiptWhatsApp = function () {
    const msg = buildReceiptWhatsAppText(receipt);
    const url = `https://wa.me/${WHATS_NUMBER}?text=${encodeURIComponent(msg)}`;
    w.open(url, "_blank");
  };

  w.focus();
}

function sendReceiptToWhatsApp(receipt, phoneDigits) {
  const tel = normalizeWhatsPhone(phoneDigits);
  if (!tel) {
    alert("Teléfono inválido para WhatsApp.");
    return;
  }
  const msg = buildReceiptWhatsAppText(receipt);
  const url = `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`;
  openWindowSafe(url, "_blank");
}

/* ✅ Helpers: productos con stock bajo (para admin) */
function getLowStockProducts() {
  const saved = loadSavedProductsArray();
  return saved.filter((p) => (Number(p.stockCajas) || 0) <= STOCK_BAJO_LIMIT);
}
window.getLowStockProducts = getLowStockProducts;

/* ==========================================================
  Exponer lo que usa admin.js / store.js
========================================================== */
window.parsePriceInput = parsePriceInput;
window.formatCOP = formatCOP;
window.showToast = showToast;

window.loadOrders = loadOrders;
window.saveOrders = saveOrders;
window.generateOrderId = generateOrderId;

window.sendOrderToWhatsApp = sendOrderToWhatsApp;
window.createPendingOrderFromCart = createPendingOrderFromCart;
window.updateStats = updateStats;

window.nowISO = nowISO;
window.openModal = openModal;
window.closeModal = closeModal;

window.el = el;
window.escapeHTML = escapeHTML;

window.descontarStock = descontarStock;
window.revertirStock = revertirStock;

window.acquireOrderLock = acquireOrderLock;
window.releaseOrderLock = releaseOrderLock;

window.buildReceipt = buildReceipt;
window.upsertReceipt = upsertReceipt;
window.openReceiptWindow = openReceiptWindow;
window.getReceiptByRef = getReceiptByRef;
window.sendReceiptToWhatsApp = sendReceiptToWhatsApp;

/* ==========================================================
  ✅ EXPORTS EXTRA (IMPORTANTE para store.js)
========================================================== */
window.LS_KEY = LS_KEY;
window.CART_KEY = CART_KEY;
window.ADMIN_FLAG = ADMIN_FLAG;
window.ADMIN_SESSION_TS_KEY = ADMIN_SESSION_TS_KEY;
window.ADMIN_SESSION_TTL_MS = ADMIN_SESSION_TTL_MS;
window.ADMIN_TOKEN_KEY = ADMIN_TOKEN_KEY;
window.ADMIN_USER_KEY = ADMIN_USER_KEY;
window.WHATS_NUMBER = WHATS_NUMBER;
window.DEMO_MODE = DEMO_MODE;

window.STOCK_BAJO_LIMIT = STOCK_BAJO_LIMIT;
window.SALE_CHANNELS = SALE_CHANNELS;

window.SALES_KEY = SALES_KEY;
window.ORDERS_KEY = ORDERS_KEY;

window.CUSTOMER_KEY = CUSTOMER_KEY;
window.CUSTOMER_PREF_KEY = CUSTOMER_PREF_KEY;
window.REVIEWS_KEY = REVIEWS_KEY;

window.normPhoneDigits = normPhoneDigits;
window.loadCustomer = loadCustomer;
window.saveCustomer = saveCustomer;
window.getCustomerInputs = getCustomerInputs;
window.isRememberEnabled = isRememberEnabled;

// ✅ API helpers (backend)
window.API_BASE = API_BASE;
window.API_ENABLED = API_ENABLED;
window.apiFetch = apiFetch;
window.apiLogin = apiLogin;
window.apiMe = apiMe;
window.syncProductsFromApi = syncProductsFromApi;
window.apiUpsertProduct = apiUpsertProduct;
window.apiDeleteProduct = apiDeleteProduct;
window.apiCreateOrder = apiCreateOrder;
window.syncOrdersFromApi = syncOrdersFromApi;
window.apiUpdateOrderStatus = apiUpdateOrderStatus;
window.apiClearOrders = apiClearOrders;
window.apiCreateReview = apiCreateReview;
window.apiClearReviews = apiClearReviews;
window.syncReviewsFromApi = syncReviewsFromApi;
window.apiCreateSale = apiCreateSale;
window.apiClearSales = apiClearSales;
window.syncSalesFromApi = syncSalesFromApi;

/* Exponer el cart global si lo necesitas en debugging */
window.cart = cart;
