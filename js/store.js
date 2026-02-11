/* ==========================================================
  store.js — SOLO tienda (index.html)
========================================================== */

/* ============================
  DOM refs
============================ */
const productsGrid = document.getElementById("productsGrid");
const offersSection = document.getElementById("offersSection");
const offersGrid = document.getElementById("offersGrid");
const offersCount = document.getElementById("offersCount");
const offersPagination = document.getElementById("offersPagination");
const offersPrev = document.getElementById("offersPrev");
const offersNext = document.getElementById("offersNext");
const offersPageText = document.getElementById("offersPage");
const categorySelect = document.getElementById("categorySelect");
const btnSyncStore = document.getElementById("btnSyncStore");
const btnApiConfigStore = document.getElementById("btnApiConfigStore");
const STORE_ADMIN_TOKEN_KEY = window.ADMIN_TOKEN_KEY || "admin_token_v1";

// Modal detalle producto
const productModal = document.getElementById("productModal");
const productModalImg = document.getElementById("productModalImg");
const productModalName = document.getElementById("productModalName");
const productModalDesc = document.getElementById("productModalDesc");
const productModalPrices = document.getElementById("productModalPrices");
const productModalCategory = document.getElementById("productModalCategory");
const closeProductModal = document.getElementById("closeProductModal");


const OFFERS_PAGE_SIZE = 6;
let offersPage = 1;
let lastOffersBase = null;

/* ============================
  Fuente única de productos (segura)
============================ */
const PRODUCTS_TS_KEY = typeof LS_KEY !== "undefined" ? LS_KEY + "_ts" : "productos_renacer_v1_ts";
let productsCache = null;
let productsCacheTS = 0;

function refreshProductsCache() {
  let list = [];
  try {
    if (typeof getProducts === "function") list = getProducts() || [];
  } catch (e) {}
  if (!Array.isArray(list)) list = [];

  productsCache = list;
  const ts = Number(localStorage.getItem(PRODUCTS_TS_KEY) || 0);
  productsCacheTS = ts || Date.now();
  return productsCache;
}

function getAllProducts() {
  const ts = Number(localStorage.getItem(PRODUCTS_TS_KEY) || 0);
  if (!productsCache || (ts && ts !== productsCacheTS)) return refreshProductsCache();

  return productsCache;
}

/* ============================
  Sync con backend (opcional)
============================ */
async function trySyncProductsFromApi() {
  const enabled = localStorage.getItem("API_ENABLED") !== "false";
  if (!enabled) return false;
  if (typeof syncProductsFromApi !== "function") return false;
  try {
    const synced = await syncProductsFromApi();
    if (synced) {
      refreshProductsCache();
      return true;
    }
  } catch (e) {
    console.warn("syncProductsFromApi error:", e);
  }
  return false;
}

async function trySyncOrdersFromApi(phoneDigits) {
  const enabled = localStorage.getItem("API_ENABLED") !== "false";
  if (!enabled) return false;
  if (!localStorage.getItem(STORE_ADMIN_TOKEN_KEY)) return false;
  if (typeof syncOrdersFromApi !== "function") return false;
  const phone = normPhoneDigits(phoneDigits || "");
  if (!phone) return false;
  try {
    const synced = await syncOrdersFromApi({ phoneDigits: phone });
    return !!synced;
  } catch (e) {
    console.warn("syncOrdersFromApi error:", e);
  }
  return false;
}

/* ==========================================================
  ✅ Auto-sync pedidos (evita que el admin espere a "Mis pedidos")
========================================================== */
const ORDER_SYNC_DELAYS = [4000, 12000, 25000, 45000];
let orderSyncTimer = null;
let orderSyncAttempt = 0;

function hasUnsyncedOrders() {
  const orders = loadOrders();
  return orders.some((o) => o && o.synced === false);
}

function scheduleOrderSync(reason = "") {
  const enabled = localStorage.getItem("API_ENABLED") !== "false";
  if (!enabled) return;
  if (!hasUnsyncedOrders()) {
    orderSyncAttempt = 0;
    return;
  }
  if (orderSyncTimer) return;

  const delay =
    ORDER_SYNC_DELAYS[Math.min(orderSyncAttempt, ORDER_SYNC_DELAYS.length - 1)];
  orderSyncAttempt += 1;

  orderSyncTimer = setTimeout(async () => {
    orderSyncTimer = null;
    try {
      await retryUnsyncedOrders();
    } catch {}
    if (hasUnsyncedOrders()) {
      scheduleOrderSync("retry");
    } else {
      orderSyncAttempt = 0;
    }
  }, delay);
}

async function trySyncReviewsFromApi() {
  const enabled = localStorage.getItem("API_ENABLED") !== "false";
  if (!enabled) return false;
  if (typeof syncReviewsFromApi !== "function") return false;
  try {
    const synced = await syncReviewsFromApi({ allowEmpty: true });
    if (synced) {
      renderReviews();
      return true;
    }
  } catch (e) {
    console.warn("syncReviewsFromApi error:", e);
  }
  return false;
}

function configureApiFromPrompt() {
  const current = localStorage.getItem("API_BASE") || "http://localhost:3001";
  const base = prompt("URL del backend (API_BASE):", current);
  if (base === null) return;
  const trimmed = String(base).trim();
  if (!trimmed) return alert("URL inválida.");

  const enabled = confirm("¿Activar API ahora? (OK = Sí / Cancel = No)");
  localStorage.setItem("API_BASE", trimmed);
  localStorage.setItem("API_ENABLED", enabled ? "true" : "false");
  showToast(enabled ? "✅ API activada" : "⚠️ API desactivada");
  setTimeout(() => window.location.reload(), 300);
}

async function handleStoreSync() {
  if (!btnSyncStore) return;
  const enabled = localStorage.getItem("API_ENABLED") !== "false";
  if (!enabled) {
    showToast("API desactivada");
    return;
  }
  showToast("Sincronizando...");
  const saved = typeof loadCustomer === "function" ? loadCustomer() : {};
  const phone = normPhoneDigits(saved?.telefono || "");
  const [pSynced, oSynced, rSynced] = await Promise.all([
    trySyncProductsFromApi(),
    trySyncOrdersFromApi(phone),
    trySyncReviewsFromApi(),
  ]);
  if (pSynced) {
    const list = getAllProducts();
    offersPage = 1;
    renderOffers(list);
    renderProducts(list);
    initCategories(list);
  }
  if (oSynced) updateMyOrdersCount();
  showToast(pSynced || oSynced || rSynced ? "✅ Sincronizado" : "Sin cambios o sin API");
}

/* ==========================================================
  Helpers: badge de bajó %
========================================================== */
function percentDrop(prev, current) {
  prev = Number(prev) || 0;
  current = Number(current) || 0;
  if (prev <= 0 || current <= 0) return 0;
  if (current >= prev) return 0;
  return Math.round(((prev - current) / prev) * 100);
}

function getPrevPrice(p, presentacion) {
  if (!p) return 0;

  const map = {
    caja: ["precioCajaAnterior", "precioCajaPrev", "prevPrecioCaja", "precioCajaAntes"],
    sobre: ["precioSobreAnterior", "precioSobrePrev", "prevPrecioSobre", "precioSobreAntes"],
  };

  const keys = map[presentacion] || [];
  for (const k of keys) {
    const v = Number(p[k]);
    if (v > 0) return v;
  }
  return 0;
}

/* ==========================================================
  Agregar al carrito con precio custom (OFERTAS)
========================================================== */
function addToCartCustomPrice(productId, presentacion, precioUnit) {
  const prod = getAllProducts().find((p) => p.id === productId);
  if (!prod) return;
  if ((Number(prod.stockCajas) || 0) <= 0) {
    showToast("Sin stock");
    return;
  }

  const precio = Number(precioUnit) || 0;
  if (precio <= 0) {
    showToast("Esta presentación no está disponible");
    return;
  }

  const existing = cart.find((c) => c.id === prod.id && c.presentacion === presentacion);
  if (existing) existing.cantidad++;
  else {
    cart.push({
      id: prod.id,
      nombre: prod.nombre,
      presentacion,
      precioUnit: precio,
      cantidad: 1,
    });
  }

  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  renderCart();
  updateCartCount();

  const label = presentacion.charAt(0).toUpperCase() + presentacion.slice(1);
  showToast(`${prod.nombre} (${label} OFERTA) agregado`);
}

/* ==========================================================
  🔥 OFERTAS PRO: render sección
  - soporta lista filtrada (categoría/búsqueda)
========================================================== */
function renderOffers(listForOffers) {
  if (!offersSection || !offersGrid) return;

  const base = Array.isArray(listForOffers) ? listForOffers : getAllProducts();
  lastOffersBase = base;

  // Solo ofertas válidas (activa + tiene precio oferta en caja o sobre)
  const list = (base || []).filter(
    (p) =>
      !!p.ofertaActiva &&
      ((Number(p.ofertaPrecioCaja) || 0) > 0 || (Number(p.ofertaPrecioSobre) || 0) > 0)
  );

  if (!list.length) {
    offersSection.style.display = "none";
    offersGrid.innerHTML = "";
    if (offersCount) offersCount.textContent = "";
    if (offersPagination) offersPagination.style.display = "none";
    return;
  }

  offersSection.style.display = "block";
  if (offersCount) offersCount.textContent = `${list.length} en oferta`;

  offersGrid.innerHTML = "";

  const allowed = (SALE_CHANNELS?.WEB?.allow || ["caja", "sobre"]).slice();

  const mkPriceRow = (normal, oferta) => {
    const prev = Number(normal) || 0;
    const now = Number(oferta) || 0;
    const pct = percentDrop(prev, now);
    return { prev, now, pct };
  };

  const totalPages = Math.max(1, Math.ceil(list.length / OFFERS_PAGE_SIZE));
  if (offersPage < 1) offersPage = 1;
  if (offersPage > totalPages) offersPage = totalPages;

  const start = (offersPage - 1) * OFFERS_PAGE_SIZE;
  const shown = list.slice(start, start + OFFERS_PAGE_SIZE);

  shown.forEach((p) => {
    const card = document.createElement("article");
    card.className = "offer-card";

    const img = document.createElement("img");
    img.className = "offer-img";
    img.src = p.imagen || "https://via.placeholder.com/200";
    img.alt = p.nombre || "Oferta";
    img.loading = "lazy";
    img.decoding = "async";

    const ribbon = document.createElement("div");
    ribbon.className = "offer-ribbon";
    ribbon.textContent = "🔥 OFERTA";

    const body = document.createElement("div");
    body.className = "offer-body";

    const name = document.createElement("div");
    name.className = "offer-name";
    name.textContent = p.nombre || "Producto";

    const desc = document.createElement("div");
    desc.className = "offer-desc";
    desc.textContent = p.ofertaTexto ? p.ofertaTexto : "Oferta especial por tiempo limitado";

    // badges (descuento + stock bajo)
    const badgesWrap = document.createElement("div");
    badgesWrap.style.display = "flex";
    badgesWrap.style.gap = "8px";
    badgesWrap.style.flexWrap = "wrap";

    const stockCajas = Number(p.stockCajas) || 0;
    const outOfStock = stockCajas <= 0;
    if (stockCajas <= 0) {
      const stock = document.createElement("span");
      stock.className = "offer-stock offer-out";
      stock.textContent = "🚫 Sin stock";
      badgesWrap.appendChild(stock);
    } else if (stockCajas <= STOCK_BAJO_LIMIT) {
      const stock = document.createElement("span");
      stock.className = "offer-stock";
      stock.textContent = `⏳ Últimos ${stockCajas}`;
      badgesWrap.appendChild(stock);
    }

    // acciones
    const actions = document.createElement("div");
    actions.className = "offer-actions";

    const mkBtn = (label, prevPrice, offerPrice, pres) => {
      // Respeta canal (web: caja/sobre)
      if (!allowed.includes(pres)) return null;

      const info = mkPriceRow(prevPrice, offerPrice);

      const wrap = document.createElement("div");
      wrap.style.display = "grid";
      wrap.style.gap = "8px";
      wrap.style.width = "100%";

      // fila precios
      const prices = document.createElement("div");
      prices.className = "offer-prices";

      const normal = document.createElement("div");
      normal.className = "offer-normal";
      normal.textContent = info.prev > 0 ? formatCOP(info.prev) : "";

      const now = document.createElement("div");
      now.className = "offer-now";
      now.textContent = formatCOP(info.now);

      prices.appendChild(normal);
      prices.appendChild(now);

      // % descuento (por presentación)
      if (info.pct > 0) {
        const disc = document.createElement("span");
        disc.className = "offer-discount";
        disc.textContent = `${label} -${info.pct}%`;
        wrap.appendChild(disc);
      }

      // botón
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn primary";
      b.innerHTML = `<span class="small">${label}</span> <span class="price">${formatCOP(info.now)}</span>`;
      if (outOfStock) {
        b.disabled = true;
        b.title = "Sin stock";
      }
      b.addEventListener("click", () => addToCartCustomPrice(p.id, pres, info.now));

      wrap.appendChild(prices);
      wrap.appendChild(b);

      return wrap;
    };

    // Caja oferta
    const cajaPrev = Number(p.precioCaja) || 0;
    const cajaOffer = Number(p.ofertaPrecioCaja) || 0;
    if (cajaOffer > 0) {
      const node = mkBtn("Caja", cajaPrev, cajaOffer, "caja");
      if (node) actions.appendChild(node);
    }

    // Sobre oferta
    const sobrePrev = Number(p.precioSobre) || 0;
    const sobreOffer = Number(p.ofertaPrecioSobre) || 0;
    if (sobreOffer > 0) {
      const node = mkBtn("Sobre", sobrePrev, sobreOffer, "sobre");
      if (node) actions.appendChild(node);
    }

    body.appendChild(name);
    body.appendChild(desc);
    if (badgesWrap.children.length) body.appendChild(badgesWrap);
    body.appendChild(actions);

    card.appendChild(img);
    card.appendChild(ribbon);
    card.appendChild(body);

    offersGrid.appendChild(card);
  });

  // seguridad extra
  if (!offersGrid.children.length) offersSection.style.display = "none";

  if (offersPagination) {
    if (list.length > OFFERS_PAGE_SIZE) {
      offersPagination.style.display = "flex";
      if (offersPageText) offersPageText.textContent = `Página ${offersPage} de ${totalPages}`;
      if (offersPrev) offersPrev.disabled = offersPage <= 1;
      if (offersNext) offersNext.disabled = offersPage >= totalPages;
    } else {
      offersPagination.style.display = "none";
    }
  }
}

if (offersPrev) {
  offersPrev.addEventListener("click", () => {
    offersPage = Math.max(1, offersPage - 1);
    renderOffers(lastOffersBase || getAllProducts());
  });
}

if (offersNext) {
  offersNext.addEventListener("click", () => {
    offersPage = offersPage + 1;
    renderOffers(lastOffersBase || getAllProducts());
  });
}

/* ==========================================================
  Modal detalle producto
========================================================== */
function addPriceRow(label, value) {
  if (!productModalPrices) return;
  const row = document.createElement("div");
  row.className = "product-price-row";
  row.innerHTML = `<span>${label}</span><span>${formatCOP(value)}</span>`;
  productModalPrices.appendChild(row);
}

function openProductModal(prod) {
  if (!productModal) return;
  if (productModalImg) {
    productModalImg.src = prod?.imagen || "https://via.placeholder.com/400";
    productModalImg.alt = prod?.nombre || "Producto";
  }
  if (productModalName) productModalName.textContent = prod?.nombre || "Producto";
  if (productModalDesc) {
    productModalDesc.textContent = prod?.descripcion || "Sin descripción.";
  }
  if (productModalCategory) {
    const cat = (prod?.categoria || "").trim();
    productModalCategory.textContent = cat || "Sin categoría";
    productModalCategory.style.display = cat ? "inline-flex" : "none";
  }

  if (productModalPrices) {
    productModalPrices.innerHTML = "";
    if ((Number(prod?.precioCaja) || 0) > 0) addPriceRow("Caja", Number(prod.precioCaja));
    if ((Number(prod?.precioSobre) || 0) > 0) addPriceRow("Sobre", Number(prod.precioSobre));
    if ((Number(prod?.precioUnidad) || 0) > 0) addPriceRow("Unidad", Number(prod.precioUnidad));
    if (!productModalPrices.children.length) {
      const row = document.createElement("div");
      row.className = "product-price-row";
      row.innerHTML = `<span>Precio</span><span>No disponible</span>`;
      productModalPrices.appendChild(row);
    }
  }

  openModal("productModal");
}

closeProductModal?.addEventListener("click", () => closeModal("productModal"));
productModal?.addEventListener("click", (e) => {
  if (e.target === productModal) closeModal("productModal");
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && productModal && !productModal.classList.contains("hidden")) {
    closeModal("productModal");
  }
});

/* ==========================================================
  Render normal productos (grid principal)
========================================================== */
function renderProducts(list) {
  if (!productsGrid) return;

  const data = Array.isArray(list) ? list : getAllProducts();

  productsGrid.innerHTML = "";
  if (!Array.isArray(data) || data.length === 0) {
    productsGrid.innerHTML = "<p>No hay productos.</p>";
    return;
  }

  const allowed = (SALE_CHANNELS?.WEB?.allow || ["caja", "sobre"]).slice();

  data.forEach((p) => {
    const stockCajas = Number(p.stockCajas) || 0;
    const outOfStock = stockCajas <= 0;
    const stockBajo = stockCajas > 0 && stockCajas <= STOCK_BAJO_LIMIT;

    const card = document.createElement("article");
    card.className = "card product-card";

    const imgWrap = document.createElement("div");
    imgWrap.style.position = "relative";

    const img = document.createElement("img");
    img.src = p.imagen || "https://via.placeholder.com/200";
    img.alt = p.nombre || "Producto";
    img.loading = "lazy";
    img.decoding = "async";
    imgWrap.appendChild(img);

    // badge stock bajo
    if (stockCajas <= 0 || stockBajo) {
      const badge = document.createElement("div");
      badge.className = "product-badge badge-danger";
      badge.textContent =
        stockCajas <= 0 ? "Sin stock" : `Stock Bajo (≤ ${STOCK_BAJO_LIMIT} cajas)`;
      imgWrap.appendChild(badge);
    }

    // badge baja %
    const dropCaja = percentDrop(getPrevPrice(p, "caja"), p.precioCaja);
    const dropSobre = percentDrop(getPrevPrice(p, "sobre"), p.precioSobre);
    const drop = Math.max(dropCaja, dropSobre);

    if (drop > 0) {
      const badge = document.createElement("div");
      badge.className = "product-badge";
      badge.style.position = "absolute";
      badge.style.left = "10px";
      badge.style.top = "10px";
      badge.style.padding = "6px 10px";
      badge.style.borderRadius = "999px";
      badge.style.fontWeight = "900";
      badge.style.fontSize = "12px";
      badge.style.background = "rgba(0,0,0,0.75)";
      badge.style.color = "white";
      badge.textContent = `⬇️ -${drop}%`;
      imgWrap.appendChild(badge);
    }

    const h = document.createElement("h4");
    h.style.margin = "0";
    h.textContent = p.nombre || "Producto";

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

    if ((Number(p.precioCaja) || 0) > 0 && allowed.includes("caja")) {
      const b = document.createElement("button");
      b.className = "btn primary";
      b.type = "button";
      b.style.padding = "8px 12px";
      b.style.fontSize = "12px";
      b.textContent = `Caja - ${formatCOP(p.precioCaja)}`;
      if (outOfStock) {
        b.disabled = true;
        b.title = "Sin stock";
      }
      b.addEventListener("click", () => addToCartById(p.id, "caja"));
      actions.appendChild(b);
    }

    if ((Number(p.precioSobre) || 0) > 0 && allowed.includes("sobre")) {
      const b = document.createElement("button");
      b.className = "btn primary";
      b.type = "button";
      b.style.padding = "8px 12px";
      b.style.fontSize = "12px";
      b.textContent = `Sobre - ${formatCOP(p.precioSobre)}`;
      if (outOfStock) {
        b.disabled = true;
        b.title = "Sin stock";
      }
      b.addEventListener("click", () => addToCartById(p.id, "sobre"));
      actions.appendChild(b);
    }

    card.appendChild(imgWrap);
    card.appendChild(h);
    card.appendChild(desc);
    card.appendChild(actions);

    card.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      openProductModal(p);
    });
    productsGrid.appendChild(card);
  });
}

/* ==========================================================
  Carrito
========================================================== */
function addToCartById(productId, presentacion) {
  const prod = getAllProducts().find((p) => p.id === productId);
  if (!prod) return;
  if ((Number(prod.stockCajas) || 0) <= 0) {
    showToast("Sin stock");
    return;
  }

  let precio = 0;
  const label = presentacion.charAt(0).toUpperCase() + presentacion.slice(1);

  if (presentacion === "caja") precio = Number(prod.precioCaja) || 0;
  else if (presentacion === "sobre") precio = Number(prod.precioSobre) || 0;
  else if (presentacion === "unidad") precio = Number(prod.precioUnidad) || 0;

  if (precio <= 0) {
    showToast("Esta presentación no está disponible");
    return;
  }

  const existing = cart.find((c) => c.id === prod.id && c.presentacion === presentacion);
  if (existing) existing.cantidad++;
  else {
    cart.push({
      id: prod.id,
      nombre: prod.nombre,
      presentacion,
      precioUnit: precio,
      cantidad: 1,
    });
  }

  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  renderCart();
  updateCartCount();
  showToast(`${prod.nombre} (${label}) agregado`);
}

function updateCartCount() {
  const btn = document.getElementById("cartCount");
  if (btn) btn.textContent = cart.reduce((sum, i) => sum + (Number(i.cantidad) || 0), 0);
}

function renderCart() {
  const cartItems = document.getElementById("cartItems");
  const cartTotal = document.getElementById("cartTotal");
  if (!cartItems) return;

  cartItems.innerHTML = "";

  let total = 0;

  if (!Array.isArray(cart) || cart.length === 0) {
    cartItems.innerHTML = "<p>Tu carrito está vacío</p>";
    if (cartTotal) cartTotal.textContent = "-";
    return;
  }

  cart.forEach((it, idx) => {
    const subtotal = (Number(it.precioUnit) || 0) * (Number(it.cantidad) || 0);
    total += subtotal;

    const label = (it.presentacion || "").charAt(0).toUpperCase() + (it.presentacion || "").slice(1);

    const row = el("div", { class: "cart-item" }, [
      el("div", { style: "flex: 1;" }, [
        el("h4", { style: "margin: 0 0 4px 0;", text: `${it.nombre} (${label})` }),
        el("p", { style: "margin: 0; font-size: 12px; color: var(--color-text-secondary);" }, [
          `${formatCOP(it.precioUnit)} x ${it.cantidad} = ${formatCOP(subtotal)}`,
        ]),
      ]),
      el("div", {}, [
        el("input", {
          type: "number",
          value: String(it.cantidad),
          min: "1",
          style: "width: 60px; padding: 6px; border: 1px solid var(--color-border);",
          "data-cart-qty": String(idx),
        }),
      ]),
      el(
        "button",
        {
          style:
            "background: #ef4444; color: white; border: none; padding: 6px 10px; border-radius: 8px; cursor: pointer;",
          "data-cart-remove": String(idx),
          type: "button",
          text: "X",
        },
        []
      ),
    ]);

    cartItems.appendChild(row);
  });

  cartItems.querySelectorAll("[data-cart-qty]").forEach((inp) => {
    inp.addEventListener("change", () => {
      const idx = parseInt(inp.getAttribute("data-cart-qty"), 10);
      updateCartQty(idx, inp.value);
    });
  });

  cartItems.querySelectorAll("[data-cart-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-cart-remove"), 10);
      removeFromCart(idx);
    });
  });

  if (cartTotal) cartTotal.textContent = formatCOP(total);
}

function updateCartQty(idx, val) {
  const qty = parseInt(val, 10) || 0;
  if (qty <= 0) {
    removeFromCart(idx);
    return;
  }
  if (!cart[idx]) return;
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

function markOrderSyncStatus(orderId, synced) {
  if (!orderId) return;
  const orders = loadOrders();
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx < 0) return;
  orders[idx].synced = !!synced;
  saveOrders(orders);
}

async function retryUnsyncedOrders() {
  const enabled = localStorage.getItem("API_ENABLED") !== "false";
  if (!enabled || typeof apiCreateOrder !== "function") return 0;

  const orders = loadOrders();
  const pending = orders.filter((o) => o && o.synced === false);
  let okCount = 0;

  for (const o of pending) {
    try {
      await apiCreateOrder(o);
      markOrderSyncStatus(o.id, true);
      okCount++;
    } catch (e) {
      console.warn("retryUnsyncedOrders error:", e);
    }
  }

  return okCount;
}

function buildOrderApiPayload(order) {
  return {
    externalId: order.id,
    clienteNombre: order?.cliente?.nombre || "",
    clienteTelefono: order?.cliente?.telefono || "",
    clienteDireccion: order?.cliente?.direccion || "",
    items: order.items || [],
    total: order.total || 0,
    estado: order.estado || "pendiente",
  };
}

function trySendOrderBeacon(order) {
  const enabled = localStorage.getItem("API_ENABLED") !== "false";
  if (!enabled) return false;
  if (!("sendBeacon" in navigator)) return false;
  const base =
    localStorage.getItem("API_BASE") ||
    (typeof API_BASE === "string" ? API_BASE : "") ||
    "";
  const trimmed = String(base).trim();
  if (!trimmed) return false;
  const url = trimmed.replace(/\/$/, "") + "/orders";
  try {
    const payload = buildOrderApiPayload(order);
    const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
    return navigator.sendBeacon(url, blob);
  } catch (e) {
    return false;
  }
}

/* ==========================================================
  Enviar pedido WhatsApp (cliente)
========================================================== */
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

  const telDigits = normPhoneDigits(cliente.telefono);
  if (!telDigits || telDigits.length < 10) {
    alert("Escribe un teléfono válido (mínimo 10 dígitos).");
    return;
  }
  cliente.telefono = telDigits;

  if (isRememberEnabled()) saveCustomer(cliente);

  const order = createPendingOrderFromCart(cliente);
  if (!order) return;

  // intento rápido vía beacon (más confiable si el navegador cambia de app)
  trySendOrderBeacon(order);
  scheduleOrderSync("send");

  // ✅ intenta enviar al backend (no bloquea)
  if (typeof apiCreateOrder === "function") {
    apiCreateOrder(order)
      .then(() => markOrderSyncStatus(order.id, true))
      .catch((e) => {
        console.warn("apiCreateOrder error:", e);
        markOrderSyncStatus(order.id, false);
        scheduleOrderSync("send-failed");
      });
  }

  sendOrderToWhatsApp(order);
  showToast(`Pedido ${order.id} enviado (Pendiente)`);

  cart = [];
  localStorage.removeItem(CART_KEY);
  renderCart();
  updateCartCount();
  closeModal("cartModal");
});

/* ==========================================================
  Modales tienda (carrito)
========================================================== */
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
document.getElementById("cartModal")?.addEventListener("click", (e) => {
  const modal = document.getElementById("cartModal");
  if (!modal) return;
  if (e.target === modal) closeModal("cartModal");
});

btnSyncStore?.addEventListener("click", handleStoreSync);
btnApiConfigStore?.addEventListener("click", configureApiFromPrompt);

/* ==========================================================
  Categorías / filtros
========================================================== */
function applyCategoryFilter(value) {
  offersPage = 1;
  const all = getAllProducts();
  const filtered = value === "all" ? all : all.filter((p) => String(p.categoria || "") === value);
  renderOffers(filtered);
  renderProducts(filtered);
}

function initCategories(list) {
  if (!categorySelect) return;

  const base = Array.isArray(list) ? list : getAllProducts();
  const cats = [...new Set((base || []).map((p) => (p.categoria || "").trim()).filter(Boolean))];
  const current = categorySelect.value || "all";

  categorySelect.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "all";
  optAll.textContent = "Todas las categorías";
  categorySelect.appendChild(optAll);

  cats.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    categorySelect.appendChild(opt);
  });

  const hasCurrent = Array.from(categorySelect.options).some((o) => o.value === current);
  categorySelect.value = hasCurrent ? current : "all";

  if (categorySelect.dataset.bound !== "1") {
    categorySelect.addEventListener("change", () => {
      const selected = categorySelect.value;
      applyCategoryFilter(selected);
    });
    categorySelect.dataset.bound = "1";
  }
}

/* Categorias rapidas */
document.querySelectorAll("[data-category]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const value = String(btn.getAttribute("data-category") || "all");
    if (categorySelect) {
      const hasOption = Array.from(categorySelect.options).some((o) => o.value === value);
      categorySelect.value = hasOption ? value : "all";
    }
    applyCategoryFilter(value);
  });
});

/* Búsqueda tienda */
document.getElementById("searchInput")?.addEventListener("input", (e) => {
  offersPage = 1;
  const query = (e.target.value || "").toLowerCase();
  const filtered = getAllProducts().filter(
    (p) =>
      (p.nombre || "").toLowerCase().includes(query) ||
      (p.descripcion || "").toLowerCase().includes(query) ||
      (p.categoria || "").toLowerCase().includes(query) ||
      (p.disponibilidad || "").toLowerCase().includes(query)
  );

  renderOffers(filtered);
  renderProducts(filtered);
});

/* ==========================================================
  ✅ MIS PEDIDOS (CLIENTE)
========================================================== */
function updateMyOrdersCount() {
  const badge = document.getElementById("myOrdersCount");
  if (!badge) return;
  const orders = loadOrders();
  const saved = typeof loadCustomer === "function" ? loadCustomer() : {};
  const phone = normPhoneDigits(saved?.telefono || "");
  const hasAdminToken = !!localStorage.getItem(STORE_ADMIN_TOKEN_KEY);
  const filtered = phone ? orders.filter((o) => normPhoneDigits(o?.cliente?.telefono) === phone) : orders;
  badge.textContent = String(hasAdminToken && !phone ? 0 : filtered.length);
}

function buildClientOrderCard(order) {
  const estado = String(order.estado || "pendiente");
  const estadoColor =
    estado === "pendiente"
      ? "#f59e0b"
      : estado === "aceptado"
      ? "#10b981"
      : estado === "rechazado"
      ? "#ef4444"
      : estado === "cancelado"
      ? "#6b7280"
      : "#64748b";

  const total =
    estado === "aceptado" && Number(order.totalAceptado) > 0
      ? order.totalAceptado
      : order.total || 0;

  const parcialTag = order.esParcial ? " (PARCIAL)" : "";
  const items =
    Array.isArray(order.itemsAceptados) && order.itemsAceptados.length
      ? order.itemsAceptados
      : order.items || [];

  const syncBadge = order.synced === false ? `<span class="pill" style="border-color:#f59e0b;">⚠️ Sin sincronizar</span>` : "";

  return `
    <div class="box" style="padding:14px;">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center;">
        <div>
          <div style="font-weight:800;">${escapeHTML(order.id)}</div>
          <div class="muted" style="font-size:12px;">${
            order.fechaISO ? new Date(order.fechaISO).toLocaleString("es-CO") : ""
          }</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          ${syncBadge}
          <div style="padding:6px 10px;border-radius:999px;background:${estadoColor};color:white;font-weight:800;font-size:12px;">
            ${escapeHTML(estado.toUpperCase())}${parcialTag}
          </div>
        </div>
      </div>

      <div style="margin-top:8px;font-size:13px;">
        <div><b>Total:</b> ${formatCOP(total)}</div>
        <div class="muted" style="font-size:12px;margin-top:4px;">
          Cliente: ${escapeHTML(order.cliente?.nombre || "-")} · ${escapeHTML(order.cliente?.telefono || "-")}
        </div>
      </div>

      <details style="margin-top:10px;">
        <summary style="cursor:pointer;font-weight:800;">Ver productos (${items.length})</summary>
        <div style="display:grid;gap:6px;margin-top:8px;">
          ${items
            .map((it) => {
              const label =
                (it.presentacion || "").charAt(0).toUpperCase() + (it.presentacion || "").slice(1);
              return `
                <div style="padding:10px;border:1px solid var(--color-card-border);border-radius:10px;">
                  <div style="font-weight:800;">
                    ${escapeHTML(it.nombre)} <span class="muted" style="font-weight:600;">(${escapeHTML(label)})</span>
                  </div>
                  <div class="muted" style="font-size:12px;">
                    ${formatCOP(it.precioUnit)} x ${it.cantidad} = <b>${formatCOP(it.subtotal)}</b>
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
      </details>
    </div>
  `;
}

function renderMyOrders() {
  const list = document.getElementById("myOrdersList");
  if (!list) return;

  const filterSel = document.getElementById("myOrdersFilter");
  const filter = filterSel ? filterSel.value || "all" : "all";

  const onlyMineChk = document.getElementById("myOrdersOnlyMine");
  const phoneInput = document.getElementById("myOrdersPhoneFilter");

  const savedCustomer = loadCustomer();
  const savedPhone = normPhoneDigits(savedCustomer.telefono || "");
  const hasAdminToken = !!localStorage.getItem(STORE_ADMIN_TOKEN_KEY);

  let phoneToUse = normPhoneDigits(phoneInput?.value || "");
  if (onlyMineChk?.checked && !phoneToUse && savedPhone) phoneToUse = savedPhone;

  let orders = loadOrders();
  if (filter !== "all") orders = orders.filter((o) => String(o.estado) === filter);

  if (hasAdminToken && !phoneToUse) {
    list.innerHTML = `<div class="box"><p class="muted" style="margin:0;">Escribe tu teléfono o activa “Solo mis pedidos” para ver tus pedidos.</p></div>`;
    return;
  }

  if (onlyMineChk?.checked || phoneToUse) {
    orders = orders.filter((o) => normPhoneDigits(o?.cliente?.telefono) === phoneToUse);
  }

  list.innerHTML = "";
  if (!orders.length) {
    list.innerHTML = `<div class="box"><p class="muted" style="margin:0;">No hay pedidos para mostrar.</p></div>`;
    return;
  }

  list.innerHTML = orders.map(buildClientOrderCard).join("");
}

(function initClientOrdersModal() {
  try {
    closeModal("cartModal");
    closeModal("myOrdersModal");
  } catch {}

  const btn = document.getElementById("myOrdersBtn");
  const closeBtn = document.getElementById("closeMyOrders");
  const refreshBtn = document.getElementById("btnRefreshMyOrders");
  const filterSel = document.getElementById("myOrdersFilter");
  const onlyMineChk = document.getElementById("myOrdersOnlyMine");
  const phoneInput = document.getElementById("myOrdersPhoneFilter");

  if (btn) {
    btn.addEventListener("click", async () => {
      updateMyOrdersCount();
      const saved = loadCustomer();
      if (phoneInput && !phoneInput.value) phoneInput.value = saved.telefono || "";
      if (onlyMineChk && saved.telefono) onlyMineChk.checked = true;
      renderMyOrders();
      openModal("myOrdersModal");

      await retryUnsyncedOrders();
      let phoneForSync = normPhoneDigits(phoneInput?.value || "");
      if (!phoneForSync && onlyMineChk?.checked) {
        phoneForSync = normPhoneDigits(saved.telefono || "");
      }
      const synced = await trySyncOrdersFromApi(phoneForSync);
      if (synced) {
        updateMyOrdersCount();
        renderMyOrders();
      }
    });
  }

  closeBtn?.addEventListener("click", () => closeModal("myOrdersModal"));
  refreshBtn?.addEventListener("click", async () => {
    await retryUnsyncedOrders();
    const phoneForSync = normPhoneDigits(phoneInput?.value || "");
    await trySyncOrdersFromApi(phoneForSync);
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
  ✅ REVIEWS PRO
========================================================== */
function loadReviews() {
  try {
    return JSON.parse(localStorage.getItem(REVIEWS_KEY) || "[]");
  } catch {
    return [];
  }
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
  return orders.some((o) => normPhoneDigits(o?.cliente?.telefono) === phoneDigits);
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

  if (numEl) numEl.textContent = count ? avg.toFixed(1) : "0.0";
  if (starsEl) starsEl.textContent = starsText(Math.round(avg));
  if (countEl) countEl.textContent = String(count);
}

function renderReviews() {
  const grid = document.getElementById("reviewsGrid");
  if (!grid) return;

  const reviews = loadReviews()
    .slice()
    .sort((a, b) => (b.fechaISO || "").localeCompare(a.fechaISO || ""));

  grid.innerHTML = "";

  if (!reviews.length) {
    grid.innerHTML = `<div class="box"><div class="muted">Aún no hay opiniones. ¡Sé el primero en dejar una!</div></div>`;
    renderAvgRatingUI();
    return;
  }

  grid.innerHTML = reviews
    .map((r) => {
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
          <div class="review-badges" style="margin-top:8px;">
            ${
              verified
                ? `<span class="pill pill-verified">🧾 Opinión verificada</span>`
                : `<span class="pill pill-local">💾 Guardada aquí (demo)</span>`
            }
            ${date ? `<span class="pill">📅 ${date}</span>` : ``}
          </div>
        </div>
      `;
    })
    .join("");

  renderAvgRatingUI();
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

  const saved = loadCustomer();
  if (!phoneEl.value && saved.telefono) phoneEl.value = saved.telefono;

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
  if (!texto || texto.length < 6)
    return alert("Escribe un comentario un poquito más largo (mínimo 6 caracteres).");

  const reviews = loadReviews();
  const already = reviews.some((r) => String(r.telefonoDigits) === telefonoDigits);
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
    fechaISO: nowISO(),
  };

  reviews.unshift(review);
  saveReviews(reviews);

  // ✅ enviar al backend si existe (no bloquea)
  if (typeof apiCreateReview === "function") {
    apiCreateReview(review).catch((e) => console.warn("apiCreateReview error:", e));
  }

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
  Inicialización tienda
========================================================== */
(async function initStore() {
  if (!productsGrid) return;

  const isLocalHost =
    !location.hostname || location.hostname === "localhost" || location.hostname === "127.0.0.1";
  const apiBase = typeof API_BASE === "string" ? API_BASE : localStorage.getItem("API_BASE") || "";
  if (!isLocalHost && /localhost|127\.0\.0\.1/i.test(apiBase)) {
    localStorage.setItem("API_BASE", "https://drogueria-renacer.onrender.com");
    localStorage.setItem("API_ENABLED", "true");
    window.location.reload();
    return;
  }
  if (!isLocalHost && localStorage.getItem("API_ENABLED") === "false") {
    localStorage.setItem("API_ENABLED", "true");
  }

  const renderAll = (list) => {
    offersPage = 1;
    renderOffers(list);
    renderProducts(list);
  };

  const list = getAllProducts();
  renderAll(list);
  initCategories(list);

  renderCart();
  updateCartCount();
  updateMyOrdersCount();

  const synced = await trySyncProductsFromApi();
  if (synced) {
    const updated = getAllProducts();
    renderAll(updated);
    initCategories(updated);
  }

  await retryUnsyncedOrders();
  const savedCustomer = typeof loadCustomer === "function" ? loadCustomer() : {};
  const phoneForSync = normPhoneDigits(savedCustomer?.telefono || "");
  await trySyncOrdersFromApi(phoneForSync);
  if (hasUnsyncedOrders()) scheduleOrderSync("init");
})();

/* Reviews init */
if (document.getElementById("reviewsSection")) {
  initStarsPicker();
  fillReviewPhoneFromCustomer();
  renderReviews();
  trySyncReviewsFromApi();
}
