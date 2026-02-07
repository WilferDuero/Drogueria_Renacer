/* ==========================================================
   DROGUERÍA RENACER — script.js (PRO)
   Versión: Fase 4 (PRO) + Reviews (promedio + anti-spam + verificado)
   Reglas:
   - Inventario se maneja en "cajas" como unidad base.
   - Cliente crea pedidos (estado: pendiente).
   - Stock y ventas solo se afectan cuando admin acepta.
   - Admin puede aceptar parcial, rechazar o cancelar (revirtiendo).
========================================================== */

const LS_KEY = "productos_renacer_v1";
const CART_KEY = "cart_renacer";
const ADMIN_FLAG = "admin_logged";
const WHATS_NUMBER = "573133585508";

/* Umbral de alerta de stock (basado en cajas disponibles) */
const STOCK_BAJO_LIMIT = 2;

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
  maximumFractionDigits: 0
});

/* ==========================================================
   Estado
========================================================== */
let products = [
  {
    id: "I1",
    nombre: "Ibuprofeno 400mg",
    descripcion: "Analgésico y antiinflamatorio.",
    categoria: "Medicamentos",
    disponibilidad: "Disponible",
    imagen: "https://i.ibb.co/rfffNXs3/Ibuprofeno.jpg",
    precioCaja: 120000,
    precioSobre: 12000,
    precioUnidad: 600,
    sobresXCaja: 10,
    unidadesXSobre: 20,
    stockCajas: 10
  },
  {
    id: "I2",
    nombre: "Vitamina C 1000mg",
    descripcion: "Refuerzo del sistema inmune.",
    categoria: "Suplementos",
    disponibilidad: "Disponible",
    imagen: "https://i.ibb.co/FLf1gr2G/Vitamina-C.jpg",
    precioCaja: 250000,
    precioSobre: 25000,
    precioUnidad: 0,
    sobresXCaja: 10,
    unidadesXSobre: 0,
    stockCajas: 8
  },
  {
    id: "I3",
    nombre: "Multivitamínico",
    descripcion: "Complejo diario",
    categoria: "Suplementos",
    disponibilidad: "Disponible",
    imagen: "https://i.ibb.co/zHXvLJvW/Multivitaminico.webp",
    precioCaja: 0,
    precioSobre: 8000,
    precioUnidad: 0,
    sobresXCaja: 0,
    unidadesXSobre: 0,
    stockCajas: 15
  },
  {
    id: "I4",
    nombre: "Advil",
    descripcion: "Alivio rápido",
    categoria: "Medicamentos",
    disponibilidad: "Disponible",
    imagen: "https://i.ibb.co/MDQxM2rR/Advil.jpg",
    precioCaja: 50000,
    precioSobre: 5000,
    precioUnidad: 500,
    sobresXCaja: 10,
    unidadesXSobre: 10,
    stockCajas: 3
  },
  {
    id: "I5",
    nombre: "Acetaminofén",
    descripcion: "Caja x 20",
    categoria: "Medicamentos",
    disponibilidad: "Disponible",
    imagen: "https://i.ibb.co/1DTYtDT/Acetaminofen.jpg",
    precioCaja: 350000,
    precioSobre: 35000,
    precioUnidad: 0,
    sobresXCaja: 10,
    unidadesXSobre: 0,
    stockCajas: 20
  }
];

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
  return COP.format(n);
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
   HELPERS PRO: pedidos / WhatsApp / impresión
========================================================== */
function nowISO() {
  return new Date().toISOString();
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

/* Evita doble envío (WhatsApp) por accidente */
function canSendOnce(order, key) {
  if (!order || !key) return false;
  order._sent = order._sent || {};
  if (order._sent[key]) return false;
  order._sent[key] = nowISO();
  return true;
}

/* Patch de pedido por id (auditoría y flags) */
function updateOrderById(orderId, patch = {}) {
  const orders = loadOrders();
  const idx = orders.findIndex(o => o.id === orderId);
  if (idx < 0) return null;
  orders[idx] = { ...orders[idx], ...patch };
  saveOrders(orders);
  return orders[idx];
}

/* ==========================================================
   Storage: productos
========================================================== */
function loadSavedProductsArray() {
  return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
}
function saveSavedProductsArray(arr) {
  localStorage.setItem(LS_KEY, JSON.stringify(arr));
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
  const orders = loadOrders().filter(o => String(o.id || "").includes(`DR-${datePart}`));
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
  const cajasNecesarias = cajasNecesariasParaVenta(producto, tipo, cantidad);
  if (!Number.isFinite(cajasNecesarias)) {
    return { ok: false, cajasNecesarias: 0, msg: "Presentación inválida para este producto." };
  }
  if ((producto.stockCajas || 0) < cajasNecesarias) {
    return {
      ok: false,
      cajasNecesarias,
      msg: `Stock insuficiente: requiere ${cajasNecesarias} caja(s) y hay ${producto.stockCajas || 0}.`
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
  if (!Number.isFinite(cajas) || cajas <= 0) return { ok: false, cajas: 0, msg: "No se pudo calcular cajas a revertir." };
  producto.stockCajas = (producto.stockCajas || 0) + cajas;
  return { ok: true, cajas, msg: "" };
}

/* ==========================================================
   Estadísticas del panel admin
========================================================== */
function updateStats() {
  const saved = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  const totalProds = saved.length;

  const statTotalProds = document.getElementById("statTotalProds");
  if (statTotalProds) statTotalProds.textContent = totalProds;

  const categorias = new Set(saved.map(p => p.categoria || ""));
  const statCategs = document.getElementById("statCategs");
  if (statCategs) statCategs.textContent = categorias.size;

  const statPromedio = document.getElementById("statPromedio");
  if (statPromedio) {
    const prices = [];
    saved.forEach(p => {
      if ((p.precioCaja || 0) > 0) prices.push(p.precioCaja);
      if ((p.precioSobre || 0) > 0) prices.push(p.precioSobre);
      if ((p.precioUnidad || 0) > 0) prices.push(p.precioUnidad);
    });
    const avg = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
    statPromedio.textContent = formatCOP(avg);
  }

  const hoy = new Date();
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const inicioAño = new Date(hoy.getFullYear(), 0, 1);

  const ingresosDiarios = sales.reduce((sum, v) => {
    const fechaVenta = new Date(v.fecha.split(", ")[0].split("/").reverse().join("-"));
    return fechaVenta >= inicioHoy ? sum + v.total : sum;
  }, 0);

  const ingresosMensuales = sales.reduce((sum, v) => {
    const fechaVenta = new Date(v.fecha.split(", ")[0].split("/").reverse().join("-"));
    return fechaVenta >= inicioMes ? sum + v.total : sum;
  }, 0);

  const ingresosAnuales = sales.reduce((sum, v) => {
    const fechaVenta = new Date(v.fecha.split(", ")[0].split("/").reverse().join("-"));
    return fechaVenta >= inicioAño ? sum + v.total : sum;
  }, 0);

  const statIngresosDiarios = document.getElementById("statIngresosDiarios");
  if (statIngresosDiarios) statIngresosDiarios.textContent = formatCOP(ingresosDiarios);

  const statIngresosMensuales = document.getElementById("statIngresosMensuales");
  if (statIngresosMensuales) statIngresosMensuales.textContent = formatCOP(ingresosMensuales);

  const statIngresosAnuales = document.getElementById("statIngresosAnuales");
  if (statIngresosAnuales) statIngresosAnuales.textContent = formatCOP(ingresosAnuales);

  const alertas = saved.filter(p => (Number(p.stockCajas) || 0) <= STOCK_BAJO_LIMIT).length;
  const statAlertas = document.getElementById("statAlertas");
  if (statAlertas) statAlertas.textContent = alertas;

  updateVentasStats();
}

function updateVentasStats() {
  const totalVentas = sales.length;
  const ingresosVentas = sales.reduce((sum, v) => sum + v.total, 0);

  const statVentas = document.getElementById("statVentasTotales");
  if (statVentas) statVentas.textContent = totalVentas;

  const statIngresos = document.getElementById("statIngresosVentas");
  if (statIngresos) statIngresos.textContent = formatCOP(ingresosVentas);
}

/* ==========================================================
   Carga inicial de productos
========================================================== */
(function loadSavedProducts() {
  const raw = JSON.parse(localStorage.getItem(LS_KEY) || "[]");

  if (!Array.isArray(raw) || raw.length === 0) {
    localStorage.setItem(LS_KEY, JSON.stringify(products));
    return;
  }

  const normalized = raw.map((p, i) => ({
    id: p.id || ("A" + Date.now() + i),
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
    stockCajas: parseInt(p.stockCajas) || 0
  }));

  products = normalized;
})();

/* ==========================================================
   Tienda: render de productos (SIN onclick)
========================================================== */
const productsGrid = document.getElementById("productsGrid");

function renderProducts(list = products) {
  if (!productsGrid) return;
  productsGrid.innerHTML = "";
  if (!Array.isArray(list) || list.length === 0) {
    productsGrid.innerHTML = "<p>No hay productos.</p>";
    return;
  }

  list.forEach((p) => {
    const stockBajo = (Number(p.stockCajas) || 0) <= STOCK_BAJO_LIMIT;

    const card = document.createElement("article");
    card.className = "card";

    // imagen + badge stock bajo
    const imgWrap = document.createElement("div");
    imgWrap.style.position = "relative";

    const img = document.createElement("img");
    img.src = p.imagen || "https://via.placeholder.com/200";
    img.alt = p.nombre;
    imgWrap.appendChild(img);

    if (stockBajo) {
      const badge = document.createElement("div");
      badge.className = "product-badge badge-danger";
      badge.textContent = `Stock Bajo (≤ ${STOCK_BAJO_LIMIT} cajas)`;
      imgWrap.appendChild(badge);
    }

    const h = document.createElement("h4");
    h.style.margin = "0";
    h.textContent = p.nombre;

    const desc = document.createElement("p");
    desc.style.margin = "0";
    desc.style.fontSize = "13px";
    desc.style.color = "var(--color-text-secondary)";
    desc.textContent = p.descripcion || "";

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.flexDirection = "column";
    actions.style.gap = "8px";
    actions.style.marginTop = "12px";

    // botones presentaciones
    if (p.precioCaja > 0) {
      const b = document.createElement("button");
      b.className = "btn primary";
      b.style.padding = "8px 12px";
      b.style.fontSize = "12px";
      b.textContent = `Caja - ${formatCOP(p.precioCaja)}`;
      b.addEventListener("click", () => addToCartById(p.id, "caja"));
      actions.appendChild(b);
    }

    if (p.precioSobre > 0) {
      const b = document.createElement("button");
      b.className = "btn primary";
      b.style.padding = "8px 12px";
      b.style.fontSize = "12px";
      b.textContent = `Sobre - ${formatCOP(p.precioSobre)}`;
      b.addEventListener("click", () => addToCartById(p.id, "sobre"));
      actions.appendChild(b);
    }

    card.appendChild(imgWrap);
    card.appendChild(h);
    card.appendChild(desc);
    card.appendChild(actions);
    productsGrid.appendChild(card);
  });
}

/* ==========================================================
   Carrito: agregar, editar, eliminar
========================================================== */
function addToCartById(productId, presentacion) {
  const prod = products.find(p => p.id === productId);
  if (!prod) return;

  let precio = 0;
  let label = presentacion.charAt(0).toUpperCase() + presentacion.slice(1);

  if (presentacion === "caja") precio = prod.precioCaja;
  else if (presentacion === "sobre") precio = prod.precioSobre;
  else if (presentacion === "unidad") precio = prod.precioUnidad;

  if (precio <= 0) {
    showToast("Esta presentación no está disponible");
    return;
  }

  const existing = cart.find(c => c.id === prod.id && c.presentacion === presentacion);
  if (existing) existing.cantidad++;
  else {
    cart.push({
      id: prod.id,
      nombre: prod.nombre,
      presentacion,
      precioUnit: precio,
      cantidad: 1
    });
  }

  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  renderCart();
  updateCartCount();
  showToast(prod.nombre + " (" + label + ") agregado");
}

function updateCartCount() {
  const btn = document.getElementById("cartCount");
  if (btn) btn.textContent = cart.reduce((sum, i) => sum + i.cantidad, 0);
}

function renderCart() {
  const cartItems = document.getElementById("cartItems");
  const cartTotal = document.getElementById("cartTotal");
  if (!cartItems) return;

  cartItems.innerHTML = "";
  let total = 0;

  if (cart.length === 0) {
    cartItems.innerHTML = "<p>Tu carrito está vacío</p>";
    if (cartTotal) cartTotal.textContent = "-";
    return;
  }

  cart.forEach((it, idx) => {
    const subtotal = it.precioUnit * it.cantidad;
    total += subtotal;
    const label = it.presentacion.charAt(0).toUpperCase() + it.presentacion.slice(1);

    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <div style="flex: 1;">
        <h4 style="margin: 0 0 4px 0;">${it.nombre} (${label})</h4>
        <p style="margin: 0; font-size: 12px; color: var(--color-text-secondary);">${formatCOP(it.precioUnit)} x ${it.cantidad} = ${formatCOP(subtotal)}</p>
      </div>
      <div>
        <input type="number" value="${it.cantidad}" min="1"
          style="width: 60px; padding: 6px; border: 1px solid var(--color-border);" data-cart-qty="${idx}">
      </div>
      <button
        style="background: #ef4444; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer;"
        data-cart-remove="${idx}">X</button>
    `;
    cartItems.appendChild(row);
  });

  // listeners (sin onclick)
  cartItems.querySelectorAll("[data-cart-qty]").forEach(inp => {
    inp.addEventListener("change", () => {
      const idx = parseInt(inp.getAttribute("data-cart-qty"), 10);
      updateCartQty(idx, inp.value);
    });
  });
  cartItems.querySelectorAll("[data-cart-remove]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-cart-remove"), 10);
      removeFromCart(idx);
    });
  });

  if (cartTotal) cartTotal.textContent = formatCOP(total);
}

function updateCartQty(idx, val) {
  const qty = parseInt(val) || 0;
  if (qty <= 0) {
    removeFromCart(idx);
    return;
  }
  cart[idx].cantidad = qty;
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  renderCart();
  updateCartCount();
}

function removeFromCart(idx) {
  cart.splice(idx, 1);
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  renderCart();
  updateCartCount();
}

/* ==========================================================
   Pedidos (cliente)
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

  const items = cart.map(it => ({
    id: it.id,
    nombre: it.nombre,
    presentacion: it.presentacion,
    precioUnit: it.precioUnit,
    cantidad: it.cantidad,
    subtotal: it.precioUnit * it.cantidad
  }));

  const total = items.reduce((sum, it) => sum + it.subtotal, 0);

  const order = {
    id: generateOrderId(),
    cliente: { nombre, telefono, direccion },
    items,
    total,
    fechaISO: new Date().toISOString(),
    estado: "pendiente",
    motivoRechazo: "",

    itemsAceptados: [],
    itemsRechazados: [],
    totalAceptado: 0,
    esParcial: false,

    fechaCancelacionISO: "",

    fechaAceptacionISO: "",
    fechaRechazoISO: "",
    fechaConfirmacionClienteISO: ""
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
   ✅ Cliente: recordar datos + borrar + autocompletar + filtro por teléfono
========================================================== */
function loadCustomer() {
  try { return JSON.parse(localStorage.getItem(CUSTOMER_KEY) || "{}"); }
  catch { return {}; }
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
    direccion: saved.direccion || ""
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
    ["input", "change", "blur"].forEach(evt => {
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

/* ✅ Enviar pedido + guardar opcional + limpiar carrito automático */
document.getElementById("sendWhatsapp")?.addEventListener("click", () => {
  if (!cart || cart.length === 0) {
    alert("Tu carrito está vacío");
    return;
  }

  const cliente = getCustomerInputs();

  if (!cliente.nombre || !cliente.telefono) {
    alert("Por favor completa Nombre y Teléfono antes de enviar el pedido.");
    return;
  }

  if (isRememberEnabled()) saveCustomer(cliente);

  const order = createPendingOrderFromCart(cliente);
  if (!order) return;

  sendOrderToWhatsApp(order);
  showToast(`Pedido ${order.id} enviado (Pendiente)`);

  cart = [];
  localStorage.removeItem(CART_KEY);
  renderCart();
  updateCartCount();

  closeModal("cartModal");
});

/* ==========================================================
   Modales (carrito + mis pedidos) con UX PRO
   - Click afuera cierra
   - ESC cierra
   - body.modal-open
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

  // si no hay ningún modal abierto, quitar scroll lock
  const anyOpen = Array.from(document.querySelectorAll(".cart-modal")).some(m => !m.classList.contains("hidden"));
  if (!anyOpen) document.body.classList.remove("modal-open");
}

document.getElementById("cartBtn")?.addEventListener("click", () => openModal("cartModal"));
document.getElementById("closeCart")?.addEventListener("click", () => closeModal("cartModal"));

document.getElementById("clearCart")?.addEventListener("click", () => {
  if (confirm("¿Vaciar carrito?")) {
    cart = [];
    localStorage.removeItem(CART_KEY);
    renderCart();
    updateCartCount();
    showToast("Carrito vacío");
  }
});

// Click afuera (carrito)
document.getElementById("cartModal")?.addEventListener("click", (e) => {
  const modal = document.getElementById("cartModal");
  if (!modal) return;
  if (e.target === modal) closeModal("cartModal");
});

// ESC (cierra el que esté abierto)
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;

  if (!document.getElementById("myOrdersModal")?.classList.contains("hidden")) closeModal("myOrdersModal");
  else if (!document.getElementById("cartModal")?.classList.contains("hidden")) closeModal("cartModal");
});

/* ==========================================================
   Categorías / filtros
========================================================== */
const categorySelect = document.getElementById("categorySelect");
if (categorySelect) {
  const cats = [...new Set(products.map(p => p.categoria))];
  cats.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    categorySelect.appendChild(opt);
  });

  categorySelect.addEventListener("change", () => {
    const selected = categorySelect.value;
    const filtered = selected === "all" ? products : products.filter(p => p.categoria === selected);
    renderProducts(filtered);
  });
}

/* ==========================================================
   Búsqueda tienda
========================================================== */
document.getElementById("searchInput")?.addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase();
  const filtered = products.filter(p =>
    p.nombre.toLowerCase().includes(query) ||
    (p.descripcion || "").toLowerCase().includes(query)
  );
  renderProducts(filtered);
});

/* ==========================================================
   Tabs admin (SAFE)
========================================================== */
(function initAdminTabs() {
  const tabBtns = Array.from(document.querySelectorAll(".tab-btn"));
  if (!tabBtns.length) return; // no estamos en admin (o no hay tabs)

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabName = btn?.dataset?.tab;
      if (!tabName) return;

      // ocultar tabs
      document.querySelectorAll(".tab-content").forEach((tab) => {
        tab.style.display = "none";
      });

      // mostrar tab objetivo
      const targetTab = document.getElementById("tab-" + tabName);
      if (targetTab) targetTab.style.display = "block";

      // estilos botones tabs
      tabBtns.forEach((b) => {
        b.style.borderBottomColor = "transparent";
        b.style.color = "var(--color-text-secondary)";
      });

      btn.style.borderBottomColor = "var(--color-primary)";
      btn.style.color = "var(--color-primary)";

      // render seguro según pestaña
      try {
        if (tabName === "lista" && typeof renderListaProductos === "function") renderListaProductos();
        if (tabName === "ventas" && typeof renderListaVentas === "function") renderListaVentas();
        if (tabName === "pedidos" && typeof renderOrdersAdmin === "function") renderOrdersAdmin();
      } catch (err) {
        console.error("Error al cambiar pestaña admin:", err);
        alert("Ocurrió un error al abrir esta pestaña. Revisa la consola.");
      }
    });
  });
})();


/* ==========================================================
   Admin: agregar / editar producto
========================================================== */
document.getElementById("btnAgregar")?.addEventListener("click", () => {
  const nombre = document.getElementById("nombreProducto")?.value?.trim();
  const descripcion = document.getElementById("descripcionProducto")?.value?.trim();
  const precioCaja = parsePriceInput(document.getElementById("precioCajaProducto")?.value);
  const precioSobre = parsePriceInput(document.getElementById("precioSobreProducto")?.value);
  const precioUnidad = parsePriceInput(document.getElementById("precioUnidadProducto")?.value);
  const sobresXCaja = parseInt(document.getElementById("sobresXCajaProducto")?.value) || 0;
  const unidadesXSobre = parseInt(document.getElementById("unidadesXSobreProducto")?.value) || 0;
  const categoria = document.getElementById("categoriaProducto")?.value;
  const disponibilidad = document.getElementById("disponibilidadProducto")?.value;
  const imagen = document.getElementById("imagenProducto")?.value?.trim();
  const stockCajas = parseInt(document.getElementById("stockCajasProducto")?.value) || 0;

  if (!nombre) {
    alert("El nombre del producto es requerido");
    return;
  }

  if (precioCaja <= 0 && precioSobre <= 0 && precioUnidad <= 0) {
    alert("Debe ingresar al menos un precio (Caja, Sobre o Unidad)");
    return;
  }

  const saved = JSON.parse(localStorage.getItem(LS_KEY) || "[]");

  if (editingIdx >= 0) {
    saved[editingIdx] = {
      id: saved[editingIdx].id,
      nombre,
      descripcion,
      precioCaja,
      precioSobre,
      precioUnidad,
      sobresXCaja,
      unidadesXSobre,
      categoria: categoria || "Otro",
      disponibilidad: disponibilidad || "Disponible",
      imagen: imagen || "",
      stockCajas
    };
    editingIdx = -1;
    const btn = document.getElementById("btnCancelarEdicion");
    if (btn) btn.style.display = "none";
    showToast("Producto actualizado");
  } else {
    saved.push({
      id: "A" + Date.now(),
      nombre,
      descripcion,
      precioCaja,
      precioSobre,
      precioUnidad,
      sobresXCaja,
      unidadesXSobre,
      categoria: categoria || "Otro",
      disponibilidad: disponibilidad || "Disponible",
      imagen: imagen || "",
      stockCajas
    });
    showToast("Producto agregado");
  }

  localStorage.setItem(LS_KEY, JSON.stringify(saved));
  document.getElementById("nombreProducto").value = "";
  document.getElementById("descripcionProducto").value = "";
  document.getElementById("precioCajaProducto").value = "";
  document.getElementById("precioSobreProducto").value = "";
  document.getElementById("precioUnidadProducto").value = "";
  document.getElementById("sobresXCajaProducto").value = "";
  document.getElementById("unidadesXSobreProducto").value = "";
  document.getElementById("imagenProducto").value = "";
  document.getElementById("stockCajasProducto").value = "";
  document.getElementById("btnAgregar").textContent = "Guardar Producto";

  updateStats();
  renderListaProductos();
});

/* ==========================================================
   Admin: listado de productos
========================================================== */
function renderListaProductos(filter = "") {
  const lista = document.getElementById("listaProductos");
  if (!lista) return;

  let saved = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  if (filter) {
    saved = saved.filter(p =>
      (p.nombre || "").toLowerCase().includes(filter.toLowerCase()) ||
      (p.categoria || "").toLowerCase().includes(filter.toLowerCase())
    );
  }

  lista.innerHTML = "";
  if (saved.length === 0) {
    lista.innerHTML = "<p style=\"text-align: center; color: var(--color-text-secondary);\">No hay productos guardados</p>";
    return;
  }

  saved.forEach((p, i) => {
    const stock = calcularStockTotalUnidades(p);
    const stockBajo = (Number(p.stockCajas) || 0) <= STOCK_BAJO_LIMIT;

    const div = document.createElement("div");
    div.style.cssText = `background: var(--color-surface); padding: 12px; border-radius: 8px; border: ${stockBajo ? "2px solid #ef4444" : "1px solid var(--color-card-border)"}`;

    div.innerHTML = `
      <h4 style="margin: 0 0 8px 0;">${p.nombre}</h4>
      <p style="margin: 0 0 8px 0; font-size: 13px; color: var(--color-text-secondary);">${p.descripcion || ""}</p>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; font-size: 12px;">
        <div><strong>Categoría:</strong> ${p.categoria || "-"}</div>
        <div><strong>Disponibilidad:</strong> ${p.disponibilidad || "-"}</div>
      </div>
      <div style="background: #f5f5f5; padding: 12px; border-radius: 6px; margin-bottom: 12px; font-size: 12px;">
        <div style="margin-bottom: 8px;"><strong>PRESENTACIONES:</strong></div>
        ${p.precioCaja > 0 ? `<div>📦 Caja: ${formatCOP(p.precioCaja)} (${p.sobresXCaja} sobres)</div>` : ""}
        ${p.precioSobre > 0 ? `<div>📄 Sobre: ${formatCOP(p.precioSobre)} (${p.unidadesXSobre} unidades)</div>` : ""}
        ${p.precioUnidad > 0 ? `<div>💊 Unidad: ${formatCOP(p.precioUnidad)}</div>` : ""}
      </div>
      <div style="background: #e8f5e9; padding: 12px; border-radius: 6px; margin-bottom: 12px; font-size: 12px;">
        <strong>STOCK (base en cajas):</strong><br>
        ${stock.cajas} cajas = ${stock.sobres} sobres = ${stock.unidades} unidades
      </div>
      ${stockBajo ? `<div style="background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 8px; border-radius: 6px; margin-bottom: 8px; font-weight: 500;">🚨 ALERTA: Stock bajo (≤ ${STOCK_BAJO_LIMIT} cajas). ¡Reponer pronto!</div>` : ""}
      <div style="display: flex; gap: 8px;">
  <button
    style="flex: 1; padding: 8px; background: #10b981; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600;"
    data-action="sell"
    data-id="${p.id}"
    data-idx="${i}"
  >✓ Vender</button>

  <button
    style="flex: 1; padding: 8px; background: #fbbf24; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;"
    data-action="edit"
    data-idx="${i}"
  >✏ Editar</button>

  <button
    style="flex: 1; padding: 8px; background: #ef4444; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600;"
    data-action="delete"
    data-idx="${i}"
  >🗑 Eliminar</button>
</div>

    `;
    lista.appendChild(div);
    // ✅ Listeners PRO (sin onclick)
div.querySelectorAll("button[data-action]").forEach(btn => {
  btn.addEventListener("click", () => {
    const action = btn.dataset.action;
    const idx = parseInt(btn.dataset.idx, 10);
    const id = btn.dataset.id;

    if (action === "sell") venderProducto(id, idx);
    if (action === "edit") editProducto(idx);
    if (action === "delete") deleteProducto(idx);
  });
});

  });
}

/* ==========================================================
   Admin: registrar venta manual
========================================================== */
function venderProducto(productId, idx) {
  const saved = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  const producto = saved[idx];

  const presentacion = prompt("¿Qué presentación?\n1 = Caja\n2 = Sobre\n3 = Unidad\n\nEscribe el número:");
  if (!presentacion) return showToast("Venta cancelada");

  let tipo = "";
  let cantidad = 0;

  if (presentacion === "1" && producto.precioCaja > 0) {
    tipo = "caja";
    const qty = prompt("¿Cuántas CAJAS?");
    if (qty === null) return showToast("Venta cancelada");
    cantidad = parseInt(qty) || 1;
  } else if (presentacion === "2" && producto.precioSobre > 0) {
    tipo = "sobre";
    const qty = prompt("¿Cuántos SOBRES?");
    if (qty === null) return showToast("Venta cancelada");
    cantidad = parseInt(qty) || 1;
  } else if (presentacion === "3" && producto.precioUnidad > 0) {
    tipo = "unidad";
    const qty = prompt("¿Cuántas UNIDADES?");
    if (qty === null) return showToast("Venta cancelada");
    cantidad = parseInt(qty) || 1;
  } else {
    return showToast("Presentación no disponible");
  }

  if (cantidad <= 0) return showToast("Cantidad inválida");

  const resStock = descontarStock(producto, tipo, cantidad);
  if (!resStock.ok) return showToast(`¡Stock insuficiente! ${resStock.msg}`);

  saveSavedProductsArray(saved);

  const precioReal = tipo === "caja" ? producto.precioCaja : (tipo === "sobre" ? producto.precioSobre : producto.precioUnidad);
  const venta = {
    id: "V" + Date.now(),
    producto: producto.nombre,
    presentacion: tipo.charAt(0).toUpperCase() + tipo.slice(1),
    cantidad,
    precioUnit: precioReal,
    total: precioReal * cantidad,
    fecha: new Date().toLocaleString("es-CO")
  };
  sales.push(venta);
  localStorage.setItem(SALES_KEY, JSON.stringify(sales));

  renderListaProductos();
  updateStats();
  showToast(`✅ Vendido ${cantidad} ${tipo}(s) de ${producto.nombre}`);
}

/* Editar producto */
function editProducto(idx) {
  const saved = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  const p = saved[idx];

  document.getElementById("nombreProducto").value = p.nombre;
  document.getElementById("descripcionProducto").value = p.descripcion;
  document.getElementById("precioCajaProducto").value = p.precioCaja;
  document.getElementById("precioSobreProducto").value = p.precioSobre;
  document.getElementById("precioUnidadProducto").value = p.precioUnidad;
  document.getElementById("sobresXCajaProducto").value = p.sobresXCaja;
  document.getElementById("unidadesXSobreProducto").value = p.unidadesXSobre;
  document.getElementById("categoriaProducto").value = p.categoria;
  document.getElementById("disponibilidadProducto").value = p.disponibilidad;
  document.getElementById("imagenProducto").value = p.imagen;
  document.getElementById("stockCajasProducto").value = p.stockCajas || 0;

  editingIdx = idx;
  document.getElementById("btnAgregar").textContent = "Actualizar Producto";
  document.getElementById("btnCancelarEdicion").style.display = "block";
  document.querySelector("[data-tab='agregar']")?.click();
  showToast("Editando producto");
}

/* Cancelar edición */
document.getElementById("btnCancelarEdicion")?.addEventListener("click", () => {
  editingIdx = -1;
  document.getElementById("nombreProducto").value = "";
  document.getElementById("descripcionProducto").value = "";
  document.getElementById("precioCajaProducto").value = "";
  document.getElementById("precioSobreProducto").value = "";
  document.getElementById("precioUnidadProducto").value = "";
  document.getElementById("sobresXCajaProducto").value = "";
  document.getElementById("unidadesXSobreProducto").value = "";
  document.getElementById("imagenProducto").value = "";
  document.getElementById("stockCajasProducto").value = "";
  document.getElementById("btnAgregar").textContent = "Guardar Producto";
  document.getElementById("btnCancelarEdicion").style.display = "none";
  showToast("Edición cancelada");
});

/* Eliminar producto */
function deleteProducto(idx) {
  if (confirm("¿Eliminar este producto?")) {
    const saved = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
    saved.splice(idx, 1);
    localStorage.setItem(LS_KEY, JSON.stringify(saved));
    updateStats();
    renderListaProductos();
    showToast("Producto eliminado");
  }
}

/* Limpiar productos (confirmación) */
document.getElementById("btnLimpiarLocal")?.addEventListener("click", () => {
  if (confirm("¿Eliminar TODOS los productos? Esta acción no se puede deshacer.")) {
    localStorage.removeItem(LS_KEY);
    updateStats();
    renderListaProductos();
    showToast("Base de datos limpia");
  }
});

document.getElementById("searchListaProductos")?.addEventListener("input", (e) => {
  renderListaProductos(e.target.value);
});

/* ==========================================================
   Historial de ventas
========================================================== */
function renderListaVentas(filter = "") {
  const lista = document.getElementById("listaVentas");
  if (!lista) return;

  let filteredSales = sales.filter(s =>
    (s.producto || "").toLowerCase().includes(filter.toLowerCase()) ||
    (s.fecha || "").toLowerCase().includes(filter.toLowerCase())
  );

  lista.innerHTML = "";
  if (filteredSales.length === 0) {
    lista.innerHTML = '<p style="text-align: center; color: var(--color-text-secondary);">No hay ventas registradas</p>';
    return;
  }

  filteredSales.forEach(venta => {
    const div = document.createElement("div");
    div.style.cssText = "background: var(--color-surface); padding: 16px; border-radius: 8px; border: 1px solid var(--color-card-border); display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: center;";
    div.innerHTML = `
      <div>
        <h4 style="margin: 0 0 4px 0;">${venta.producto}</h4>
        <p style="margin: 0 0 8px 0; font-size: 13px; color: var(--color-text-secondary);">${venta.fecha}</p>
        <div style="display: flex; gap: 8px; font-size: 12px;">
          <span style="background: #3b82f6; color: white; padding: 4px 8px; border-radius: 20px;">${venta.presentacion}</span>
          <span style="background: #10b981; color: white; padding: 4px 8px; border-radius: 20px;">${venta.cantidad}x</span>
          <span style="font-weight: 600;">${formatCOP(venta.total)}</span>
        </div>
      </div>
    `;
    lista.appendChild(div);
  });
}

document.getElementById("btnLimpiarVentas")?.addEventListener("click", () => {
  if (confirm("¿Eliminar TODO el historial de ventas?")) {
    sales = [];
    localStorage.removeItem(SALES_KEY);
    renderListaVentas();
    updateVentasStats();
    showToast("Historial limpiado");
  }
});

/* ==========================================================
   Login / sesión admin
========================================================== */
document.getElementById("loginBtn")?.addEventListener("click", () => {
  const userInput = document.getElementById("loginUser");
  const passInput = document.getElementById("loginPass");
  if (!userInput || !passInput) return;

  const user = userInput.value.trim();
  const pass = passInput.value.trim();

  if (user === "admin" && pass === "wilfer1234") {
    sessionStorage.setItem(ADMIN_FLAG, "true");
    window.location.href = "admin.html";
    showToast("Bienvenido admin");
  } else {
    const err = document.getElementById("loginError");
    if (err) err.style.display = "block";
  }
});

document.getElementById("logoutBtn")?.addEventListener("click", () => {
  sessionStorage.removeItem(ADMIN_FLAG);
  window.location.href = "admin_login.html";
  showToast("Sesión cerrada");
});

document.getElementById("backToStore")?.addEventListener("click", () => {
  window.location.href = "index.html";
});

/* ==========================================================
   ✅ FIX + FEATURE: "MIS PEDIDOS" (CLIENTE)
========================================================== */
function updateMyOrdersCount() {
  const badge = document.getElementById("myOrdersCount");
  if (!badge) return;
  const orders = loadOrders();
  badge.textContent = String(orders.length);
}

function buildClientOrderCard(order) {
  const estado = String(order.estado || "pendiente");
  const estadoColor =
    estado === "pendiente" ? "#f59e0b" :
    estado === "aceptado" ? "#10b981" :
    estado === "rechazado" ? "#ef4444" :
    estado === "cancelado" ? "#6b7280" :
    "#64748b";

  const total = (estado === "aceptado" && Number(order.totalAceptado) > 0)
    ? order.totalAceptado
    : (order.total || 0);

  const parcialTag = order.esParcial ? " (PARCIAL)" : "";

  const items = Array.isArray(order.itemsAceptados) && order.itemsAceptados.length
    ? order.itemsAceptados
    : (order.items || []);

  return `
    <div class="box" style="padding:14px;">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center;">
        <div>
          <div style="font-weight:800;">${order.id}</div>
          <div class="muted" style="font-size:12px;">${new Date(order.fechaISO).toLocaleString("es-CO")}</div>
        </div>
        <div style="padding:6px 10px;border-radius:999px;background:${estadoColor};color:white;font-weight:800;font-size:12px;">
          ${estado.toUpperCase()}${parcialTag}
        </div>
      </div>

      <div style="margin-top:8px;font-size:13px;">
        <div><b>Total:</b> ${formatCOP(total)}</div>
        <div class="muted" style="font-size:12px;margin-top:4px;">
          Cliente: ${order.cliente?.nombre || "-"} · ${order.cliente?.telefono || "-"}
        </div>
      </div>

      <details style="margin-top:10px;">
        <summary style="cursor:pointer;font-weight:800;">Ver productos (${items.length})</summary>
        <div style="display:grid;gap:6px;margin-top:8px;">
          ${items.map(it => {
            const label = (it.presentacion || "").charAt(0).toUpperCase() + (it.presentacion || "").slice(1);
            return `
              <div style="padding:10px;border:1px solid var(--color-card-border);border-radius:10px;">
                <div style="font-weight:800;">${it.nombre} <span class="muted" style="font-weight:600;">(${label})</span></div>
                <div class="muted" style="font-size:12px;">${formatCOP(it.precioUnit)} x ${it.cantidad} = <b>${formatCOP(it.subtotal)}</b></div>
              </div>
            `;
          }).join("")}
        </div>
      </details>
    </div>
  `;
}

function renderMyOrders() {
  const list = document.getElementById("myOrdersList");
  if (!list) return;

  const filterSel = document.getElementById("myOrdersFilter");
  const filter = filterSel ? (filterSel.value || "all") : "all";

  const onlyMineChk = document.getElementById("myOrdersOnlyMine");
  const phoneInput = document.getElementById("myOrdersPhoneFilter");

  const savedCustomer = loadCustomer();
  const savedPhone = normPhoneDigits(savedCustomer.telefono || "");

  let phoneToUse = normPhoneDigits(phoneInput?.value || "");
  if (onlyMineChk?.checked && !phoneToUse && savedPhone) phoneToUse = savedPhone;

  let orders = loadOrders();
  if (filter !== "all") orders = orders.filter(o => String(o.estado) === filter);

  if (onlyMineChk?.checked || phoneToUse) {
    orders = orders.filter(o => normPhoneDigits(o?.cliente?.telefono) === phoneToUse);
  }

  list.innerHTML = "";

  if (!orders.length) {
    list.innerHTML = `<div class="box"><p class="muted" style="margin:0;">No hay pedidos para mostrar.</p></div>`;
    return;
  }

  list.innerHTML = orders.map(buildClientOrderCard).join("");
}

(function initClientOrdersModal() {
  closeModal("cartModal");
  closeModal("myOrdersModal");

  const btn = document.getElementById("myOrdersBtn");
  const closeBtn = document.getElementById("closeMyOrders");
  const refreshBtn = document.getElementById("btnRefreshMyOrders");
  const filterSel = document.getElementById("myOrdersFilter");

  const onlyMineChk = document.getElementById("myOrdersOnlyMine");
  const phoneInput = document.getElementById("myOrdersPhoneFilter");

  if (btn) {
    btn.addEventListener("click", () => {
      updateMyOrdersCount();

      const saved = loadCustomer();
      if (phoneInput && !phoneInput.value) phoneInput.value = saved.telefono || "";
      if (onlyMineChk && saved.telefono) onlyMineChk.checked = true;

      renderMyOrders();
      openModal("myOrdersModal");
    });
  }

  closeBtn?.addEventListener("click", () => closeModal("myOrdersModal"));

  refreshBtn?.addEventListener("click", () => {
    updateMyOrdersCount();
    renderMyOrders();
  });

  filterSel?.addEventListener("change", () => renderMyOrders());

  onlyMineChk?.addEventListener("change", () => renderMyOrders());
  phoneInput?.addEventListener("input", () => renderMyOrders());

  document.getElementById("myOrdersModal")?.addEventListener("click", (e) => {
    const modal = document.getElementById("myOrdersModal");
    if (modal && e.target === modal) closeModal("myOrdersModal");
  });

  updateMyOrdersCount();
})();

/* ==========================================================
   ✅ REVIEWS PRO:
   - Guardar en localStorage
   - Mostrar promedio de estrellas
   - Anti-spam: 1 opinión por teléfono
   - Verificada si existe pedido real con ese teléfono
========================================================== */
function loadReviews() {
  try { return JSON.parse(localStorage.getItem(REVIEWS_KEY) || "[]"); }
  catch { return []; }
}
function saveReviews(arr) {
  localStorage.setItem(REVIEWS_KEY, JSON.stringify(arr));
}
function starsText(rating) {
  const r = Math.max(0, Math.min(5, Number(rating) || 0));
  return "★★★★★☆☆☆☆☆".slice(5 - r, 10 - r);
}
function hasRealOrderByPhone(phoneDigits) {
  if (!phoneDigits) return false;
  const orders = loadOrders();
  return orders.some(o => normPhoneDigits(o?.cliente?.telefono) === phoneDigits);
}
function calcAvgRating(reviews) {
  if (!reviews.length) return { avg: 0, count: 0 };
  const sum = reviews.reduce((a, r) => a + (Number(r.rating) || 0), 0);
  return { avg: sum / reviews.length, count: reviews.length };
}

function renderAvgRatingUI() {
  const reviews = loadReviews();
  const { avg, count } = calcAvgRating(reviews);

  const numEl = document.getElementById("avgRatingNum");
  const starsEl = document.getElementById("avgRatingStars");
  const countEl = document.getElementById("avgRatingCount");

  if (numEl) numEl.textContent = (count ? avg.toFixed(1) : "0.0");
  if (starsEl) starsEl.textContent = starsText(Math.round(avg));
  if (countEl) countEl.textContent = String(count);
}

function renderReviews() {
  const grid = document.getElementById("reviewsGrid");
  if (!grid) return;

  const reviews = loadReviews().slice().sort((a, b) => (b.fechaISO || "").localeCompare(a.fechaISO || ""));
  grid.innerHTML = "";

  if (!reviews.length) {
    grid.innerHTML = `<div class="box"><div class="muted">Aún no hay opiniones. ¡Sé el primero en dejar una!</div></div>`;
    renderAvgRatingUI();
    return;
  }

  grid.innerHTML = reviews.map(r => {
    const verified = !!r.verified;
    const date = r.fechaISO ? new Date(r.fechaISO).toLocaleDateString("es-CO") : "";
    const st = starsText(r.rating);

    return `
      <div class="box review">
        <div class="review-top">
          <div class="review-name">${escapeHTML(r.nombre || "Cliente")}</div>
          <div class="review-stars">${st}</div>
        </div>

        <div class="muted">“${escapeHTML(r.texto || "")}”</div>

        <div class="review-badges">
          ${verified ? `<span class="pill pill-verified">🧾 Opinión verificada</span>` : `<span class="pill pill-local">💾 Guardada aquí (demo)</span>`}
          ${date ? `<span class="pill">📅 ${date}</span>` : ``}
        </div>
      </div>
    `;
  }).join("");

  renderAvgRatingUI();
}

function escapeHTML(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function initStarsPicker() {
  const wrap = document.getElementById("reviewStars");
  const input = document.getElementById("reviewRating");
  if (!wrap || !input) return;

  wrap.innerHTML = "";
  const setRating = (val) => {
    input.value = String(val);
    wrap.querySelectorAll(".star-btn").forEach((b, i) => {
      b.classList.toggle("active", i < val);
    });
  };

  for (let i = 1; i <= 5; i++) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "star-btn";
    b.textContent = "★";
    b.addEventListener("click", () => setRating(i));
    wrap.appendChild(b);
  }

  setRating(0);
}

function fillReviewPhoneFromCustomer() {
  const phoneEl = document.getElementById("reviewPhone");
  if (!phoneEl) return;

  // si el usuario tiene datos guardados, autollenar
  const saved = loadCustomer();
  if (!phoneEl.value && saved.telefono) phoneEl.value = saved.telefono;

  // si escribe en teléfono cliente del carrito, también sugerir
  const telCliente = document.getElementById("clienteTelefono");
  telCliente?.addEventListener("input", () => {
    if (!phoneEl.value && telCliente.value) phoneEl.value = telCliente.value;
  });
}

document.getElementById("submitReview")?.addEventListener("click", () => {
  const nameEl = document.getElementById("reviewName");
  const phoneEl = document.getElementById("reviewPhone");
  const ratingEl = document.getElementById("reviewRating");
  const textEl = document.getElementById("reviewText");

  if (!nameEl || !phoneEl || !ratingEl || !textEl) return;

  const nombre = (nameEl.value || "").trim();
  const telefonoDigits = normPhoneDigits(phoneEl.value || "");
  const rating = Number(ratingEl.value || 0);
  const texto = (textEl.value || "").trim();

  if (!nombre) return alert("Por favor escribe tu nombre.");
  if (!telefonoDigits) return alert("Por favor escribe tu teléfono (para evitar spam).");
  if (rating < 1 || rating > 5) return alert("Selecciona una calificación (1 a 5 estrellas).");
  if (!texto || texto.length < 6) return alert("Escribe un comentario un poquito más largo (mínimo 6 caracteres).");

  const reviews = loadReviews();
  const already = reviews.some(r => String(r.telefonoDigits) === telefonoDigits);
  if (already) {
    alert("Ya existe 1 opinión registrada con este teléfono en este dispositivo. Gracias 🙌");
    return;
  }

  const verified = hasRealOrderByPhone(telefonoDigits);

  const review = {
    id: "R" + Date.now(),
    nombre,
    telefonoDigits,
    rating,
    texto,
    verified,
    fechaISO: nowISO()
  };

  reviews.unshift(review);
  saveReviews(reviews);

  // limpiar form
  textEl.value = "";
  document.getElementById("reviewRating").value = "0";
  initStarsPicker();

  showToast(verified ? "✅ Opinión enviada (verificada)" : "✅ Opinión enviada");
  renderReviews();
});

document.getElementById("clearReviewsLocal")?.addEventListener("click", () => {
  if (!confirm("¿Borrar reseñas guardadas en este dispositivo?")) return;
  localStorage.removeItem(REVIEWS_KEY);
  showToast("🧹 Reseñas borradas");
  renderReviews();
});

/* ==========================================================
   ✅ ADMIN: PEDIDOS (render + aceptar parcial + rechazar + cancelar)
========================================================== */

function maxQtyByStock(prod, tipo) {
  const cajas = Number(prod.stockCajas) || 0;
  const sobresXCaja = Number(prod.sobresXCaja) || 0;
  const unidadesXSobre = Number(prod.unidadesXSobre) || 0;

  if (tipo === "caja") return cajas;
  if (tipo === "sobre") return cajas * sobresXCaja;
  if (tipo === "unidad") return cajas * sobresXCaja * unidadesXSobre;
  return 0;
}

function ensureSalesLoaded() {
  try { sales = JSON.parse(localStorage.getItem(SALES_KEY) || "[]"); }
  catch { sales = []; }
}

function renderOrdersAdmin() {
  const list = document.getElementById("ordersList");
  if (!list) return;

  const filterSel = document.getElementById("ordersFilter");
  const filter = filterSel ? (filterSel.value || "all") : "all";

  let orders = loadOrders();
  if (filter !== "all") orders = orders.filter(o => String(o.estado) === filter);

  list.innerHTML = "";

  if (!orders.length) {
    list.innerHTML = `<div class="box"><div class="muted">No hay pedidos para mostrar.</div></div>`;
    return;
  }

  list.innerHTML = orders.map(o => buildAdminOrderCard(o)).join("");

  // listeners botones
  list.querySelectorAll("[data-ord-accept]").forEach(b => {
    b.addEventListener("click", () => acceptOrder(b.getAttribute("data-ord-accept"), false));
  });
  list.querySelectorAll("[data-ord-accept-partial]").forEach(b => {
    b.addEventListener("click", () => acceptOrder(b.getAttribute("data-ord-accept-partial"), true));
  });
  list.querySelectorAll("[data-ord-reject]").forEach(b => {
    b.addEventListener("click", () => rejectOrder(b.getAttribute("data-ord-reject")));
  });
  list.querySelectorAll("[data-ord-cancel]").forEach(b => {
    b.addEventListener("click", () => cancelOrder(b.getAttribute("data-ord-cancel")));
  });
}

function buildAdminOrderCard(order) {
  const estado = String(order.estado || "pendiente");

  const estadoColor =
    estado === "pendiente" ? "#f59e0b" :
    estado === "aceptado" ? "#10b981" :
    estado === "rechazado" ? "#ef4444" :
    estado === "cancelado" ? "#6b7280" :
    "#64748b";

  const totalMostrado =
    (estado === "aceptado" && Number(order.totalAceptado) > 0) ? order.totalAceptado : (order.total || 0);

  const parcialTag = order.esParcial ? " (PARCIAL)" : "";

  const items = Array.isArray(order.items) ? order.items : [];
  const itemsAceptados = Array.isArray(order.itemsAceptados) ? order.itemsAceptados : [];

  const puedeCancelar = (estado === "aceptado");

  return `
    <div class="box" style="padding:14px;">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center;">
        <div>
          <div style="font-weight:900;">${order.id}</div>
          <div class="muted" style="font-size:12px;">${order.fechaISO ? new Date(order.fechaISO).toLocaleString("es-CO") : ""}</div>
          <div class="muted" style="font-size:12px;margin-top:4px;">
            👤 ${order.cliente?.nombre || "-"} · 📞 ${order.cliente?.telefono || "-"} ${order.cliente?.direccion ? `· 📍 ${order.cliente.direccion}` : ""}
          </div>
        </div>
        <div style="padding:6px 10px;border-radius:999px;background:${estadoColor};color:white;font-weight:900;font-size:12px;">
          ${estado.toUpperCase()}${parcialTag}
        </div>
      </div>

      <div style="margin-top:10px;font-size:13px;">
        <div><b>Total:</b> ${formatCOP(totalMostrado)}</div>
        ${order.motivoRechazo ? `<div class="muted" style="font-size:12px;margin-top:6px;"><b>Motivo:</b> ${escapeHTML(order.motivoRechazo)}</div>` : ""}
      </div>

      <details style="margin-top:10px;">
        <summary style="cursor:pointer;font-weight:900;">Ver productos (${items.length})</summary>
        <div style="display:grid;gap:8px;margin-top:10px;">
          ${items.map(it => {
            const label = (it.presentacion || "").charAt(0).toUpperCase() + (it.presentacion || "").slice(1);
            const accepted = itemsAceptados.find(a => a.id === it.id && a.presentacion === it.presentacion);
            const acceptedTxt = accepted ? ` · ✅ Aceptado: <b>${accepted.cantidad}</b>` : "";
            return `
              <div style="padding:10px;border:1px solid var(--color-card-border);border-radius:10px;">
                <div style="font-weight:900;">${escapeHTML(it.nombre)} <span class="muted" style="font-weight:700;">(${label})</span></div>
                <div class="muted" style="font-size:12px;">
                  ${formatCOP(it.precioUnit)} x ${it.cantidad} = <b>${formatCOP(it.subtotal)}</b>${acceptedTxt}
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </details>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
        ${estado === "pendiente" ? `
          <button class="btn primary" type="button" data-ord-accept="${order.id}">✅ Aceptar todo</button>
          <button class="btn ghost" type="button" data-ord-accept-partial="${order.id}">🧩 Aceptar parcial</button>
          <button class="btn danger" type="button" data-ord-reject="${order.id}">❌ Rechazar</button>
        ` : ``}

        ${puedeCancelar ? `
          <button class="btn danger" type="button" data-ord-cancel="${order.id}">↩️ Cancelar (revertir)</button>
        ` : ``}
      </div>
    </div>
  `;
}

function acceptOrder(orderId, partial) {
  const orders = loadOrders();
  const idx = orders.findIndex(o => o.id === orderId);
  if (idx < 0) return;

  const order = orders[idx];
  if (String(order.estado) !== "pendiente") {
    alert("Este pedido ya no está pendiente.");
    return;
  }

  // cargar productos actuales
  const savedProducts = loadSavedProductsArray();

  const accepted = [];
  const rejected = [];

  // Para aceptar: validar y descontar stock SOLO de aceptados
  for (const it of (order.items || [])) {
    const prod = savedProducts.find(p => p.id === it.id);
    if (!prod) {
      rejected.push({ ...it, motivo: "Producto no existe" });
      continue;
    }

    const tipo = it.presentacion;
    const requested = Number(it.cantidad) || 0;

    let qtyAccept = requested;

    if (partial) {
      const maxPossible = maxQtyByStock(prod, tipo);
      const suggestion = Math.min(requested, maxPossible);
      const input = prompt(`Pedido ${order.id}\n${it.nombre} (${tipo})\nSolicitado: ${requested}\nMáximo posible por stock: ${maxPossible}\n\n¿Cuánto vas a ACEPTAR? (0 a ${requested})`, String(suggestion));
      if (input === null) return; // canceló el proceso
      qtyAccept = Math.max(0, Math.min(requested, parseInt(input, 10) || 0));
    }

    if (qtyAccept <= 0) {
      rejected.push({ ...it, motivo: "No aceptado" });
      continue;
    }

    // ajustar si por stock no alcanza
    const maxPossible = maxQtyByStock(prod, tipo);
    if (qtyAccept > maxPossible) qtyAccept = maxPossible;

    // descontar stock por cajas necesarias
    const res = descontarStock(prod, tipo, qtyAccept);
    if (!res.ok) {
      // si no alcanza (por redondeo de cajas), marcar como rechazado
      rejected.push({ ...it, motivo: "Stock insuficiente" });
      continue;
    }

    accepted.push({
      ...it,
      cantidad: qtyAccept,
      subtotal: (Number(it.precioUnit) || 0) * qtyAccept
    });

    // si aceptó menos que solicitado => lo restante queda rechazado
    const rest = requested - qtyAccept;
    if (rest > 0) {
      rejected.push({
        ...it,
        cantidad: rest,
        subtotal: (Number(it.precioUnit) || 0) * rest,
        motivo: "Parcial"
      });
    }
  }

  if (!accepted.length) {
    alert("No se pudo aceptar nada (stock / selección).");
    return;
  }

  // guardar productos con stock actualizado
  saveSavedProductsArray(savedProducts);

  // registrar venta SOLO por lo aceptado
  ensureSalesLoaded();
  const ventaId = "V" + Date.now();
  const totalAceptado = accepted.reduce((s, a) => s + (a.subtotal || 0), 0);

  sales.push({
    id: ventaId,
    orderId: order.id,
    total: totalAceptado,
    fecha: new Date().toLocaleString("es-CO"),
    items: accepted.map(a => ({
      id: a.id,
      nombre: a.nombre,
      presentacion: a.presentacion,
      cantidad: a.cantidad,
      precioUnit: a.precioUnit,
      subtotal: a.subtotal
    }))
  });
  localStorage.setItem(SALES_KEY, JSON.stringify(sales));

  // actualizar pedido
  order.estado = "aceptado";
  order.itemsAceptados = accepted;
  order.itemsRechazados = rejected;
  order.totalAceptado = totalAceptado;
  order.esParcial = !!rejected.length;
  order.fechaAceptacionISO = nowISO();
  order.ventaIds = Array.isArray(order.ventaIds) ? order.ventaIds : [];
  order.ventaIds.push(ventaId);

  orders[idx] = order;
  saveOrders(orders);

  showToast(order.esParcial ? `✅ Pedido ${order.id} aceptado (parcial)` : `✅ Pedido ${order.id} aceptado`);
  updateStats();
  renderOrdersAdmin();
}

function rejectOrder(orderId) {
  const orders = loadOrders();
  const idx = orders.findIndex(o => o.id === orderId);
  if (idx < 0) return;

  const order = orders[idx];
  if (String(order.estado) !== "pendiente") {
    alert("Este pedido ya no está pendiente.");
    return;
  }

  const motivo = prompt("Motivo de rechazo (opcional):", "") || "";
  order.estado = "rechazado";
  order.motivoRechazo = motivo.trim();
  order.fechaRechazoISO = nowISO();

  orders[idx] = order;
  saveOrders(orders);

  showToast(`❌ Pedido ${order.id} rechazado`);
  renderOrdersAdmin();
}

function cancelOrder(orderId) {
  if (!confirm("¿Cancelar este pedido y revertir stock + venta?")) return;

  const orders = loadOrders();
  const idx = orders.findIndex(o => o.id === orderId);
  if (idx < 0) return;

  const order = orders[idx];
  if (String(order.estado) !== "aceptado") {
    alert("Solo se puede cancelar un pedido ACEPTADO.");
    return;
  }

  // revertir stock por items aceptados
  const savedProducts = loadSavedProductsArray();
  const itemsAceptados = Array.isArray(order.itemsAceptados) ? order.itemsAceptados : [];

  itemsAceptados.forEach(it => {
    const prod = savedProducts.find(p => p.id === it.id);
    if (!prod) return;
    revertirStock(prod, it.presentacion, it.cantidad);
  });

  saveSavedProductsArray(savedProducts);

  // borrar venta(s) asociadas
  ensureSalesLoaded();
  const ventaIds = Array.isArray(order.ventaIds) ? order.ventaIds : [];
  if (ventaIds.length) {
    sales = sales.filter(v => !ventaIds.includes(v.id));
  } else {
    // fallback por orderId
    sales = sales.filter(v => v.orderId !== order.id);
  }
  localStorage.setItem(SALES_KEY, JSON.stringify(sales));

  // actualizar pedido
  order.estado = "cancelado";
  order.fechaCancelacionISO = nowISO();

  orders[idx] = order;
  saveOrders(orders);

  showToast(`↩️ Pedido ${order.id} cancelado`);
  updateStats();
  renderOrdersAdmin();
}

/* UI pedidos admin */
(function initAdminOrdersUI() {
  const refresh = document.getElementById("btnRefreshOrders");
  const filterSel = document.getElementById("ordersFilter");
  const clearBtn = document.getElementById("btnClearOrders");

  refresh?.addEventListener("click", () => renderOrdersAdmin());
  filterSel?.addEventListener("change", () => renderOrdersAdmin());

  clearBtn?.addEventListener("click", () => {
    if (!confirm("¿Borrar TODOS los pedidos? (solo pruebas)")) return;
    localStorage.removeItem(ORDERS_KEY);
    showToast("🧹 Pedidos borrados");
    renderOrdersAdmin();
    updateMyOrdersCount?.();
  });
})();


/* ==========================================================
   Inicialización según página
========================================================== */
if (productsGrid) {
  renderProducts();
  updateStats();
  renderCart();
  updateCartCount();
}

/* Reviews init (solo si existe sección) */
if (document.getElementById("reviewsSection")) {
  initStarsPicker();
  fillReviewPhoneFromCustomer();
  renderReviews();
}

if (sessionStorage.getItem(ADMIN_FLAG)) {
  // solo admin
  if (window.location.pathname.includes("admin.html")) {
    renderListaProductos();
    updateStats();
    renderOrdersAdmin();
  }
} else if (window.location.pathname.includes("admin.html")) {
  window.location.href = "admin_login.html";
}

