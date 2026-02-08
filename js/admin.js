/* ==========================================================
  admin.js — Panel Admin
  - CRUD productos
  - Ventas + recibos
  - Pedidos (aceptar parcial/total, rechazar, cancelar)
  - Exportaciones (CSV) y "Excel" (CSV compatible)
========================================================== */

(function () {
  /* ---------------------------
    Seguridad: requiere login
  ---------------------------- */
  const SESSION_KEY = window.ADMIN_SESSION_TS_KEY || "admin_session_ts_v1";
  const SESSION_TTL = window.ADMIN_SESSION_TTL_MS || 8 * 60 * 60 * 1000;

  function isSessionValid() {
    if (localStorage.getItem(ADMIN_FLAG) !== "true") return false;
    const ts = Number(localStorage.getItem(SESSION_KEY) || 0);
    if (!ts) return false;
    return Date.now() - ts <= SESSION_TTL;
  }

  function touchSession() {
    if (localStorage.getItem(ADMIN_FLAG) === "true") {
      localStorage.setItem(SESSION_KEY, String(Date.now()));
    }
  }

  if (!isSessionValid()) {
    localStorage.removeItem(ADMIN_FLAG);
    localStorage.removeItem(SESSION_KEY);
    window.location.href = "admin_login.html";
    return;
  }

  // mantener sesión viva con actividad
  ["click", "keydown", "mousemove", "touchstart"].forEach((evt) => {
    document.addEventListener(evt, touchSession, { passive: true });
  });
  setInterval(() => {
    if (!isSessionValid()) {
      localStorage.removeItem(ADMIN_FLAG);
      localStorage.removeItem(SESSION_KEY);
      window.location.href = "admin_login.html";
    }
  }, 60 * 1000);

  /* ---------------------------
    DOM refs
  ---------------------------- */
  const logoutBtn = document.getElementById("logoutBtn");
  const btnSyncAdmin = document.getElementById("btnSyncAdmin");
  const btnApiConfigAdmin = document.getElementById("btnApiConfigAdmin");

  // Tabs
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabAgregar = document.getElementById("tab-agregar");
  const tabLista = document.getElementById("tab-lista");
  const tabVentas = document.getElementById("tab-ventas");
  const tabPedidos = document.getElementById("tab-pedidos");

  // Form producto
  const nombreProducto = document.getElementById("nombreProducto");
  const descripcionProducto = document.getElementById("descripcionProducto");
  const categoriaProducto = document.getElementById("categoriaProducto");
  const disponibilidadProducto = document.getElementById("disponibilidadProducto");
  const imagenProducto = document.getElementById("imagenProducto");
  const precioCajaProducto = document.getElementById("precioCajaProducto");
  const precioSobreProducto = document.getElementById("precioSobreProducto");
  const precioUnidadProducto = document.getElementById("precioUnidadProducto");
  const sobresXCajaProducto = document.getElementById("sobresXCajaProducto");
  const unidadesXSobreProducto = document.getElementById("unidadesXSobreProducto");
  const stockCajasProducto = document.getElementById("stockCajasProducto");

  // ✅ Oferta (promo)
  const ofertaActivaProducto = document.getElementById("ofertaActivaProducto");
  const ofertaTextoProducto = document.getElementById("ofertaTextoProducto");
  const ofertaPrecioCajaProducto = document.getElementById("ofertaPrecioCajaProducto");
  const ofertaPrecioSobreProducto = document.getElementById("ofertaPrecioSobreProducto");

  const btnAgregar = document.getElementById("btnAgregar");
  const btnCancelarEdicion = document.getElementById("btnCancelarEdicion");

  // Lista productos
  const listaProductos = document.getElementById("listaProductos");
  const searchListaProductos = document.getElementById("searchListaProductos");
  const btnLimpiarLocal = document.getElementById("btnLimpiarLocal");
  const btnDescargarExcel = document.getElementById("btnDescargarExcel");

  // ✅ Banner filtro stock bajo + tarjeta alertas
  const lowStockBanner = document.getElementById("lowStockBanner");
  const lowStockBannerText = document.getElementById("lowStockBannerText");
  const btnClearLowStockFilter = document.getElementById("btnClearLowStockFilter");
  const statAlertasCard = document.getElementById("statAlertasCard");

  // Ventas
  const listaVentas = document.getElementById("listaVentas");
  const btnExportVentas = document.getElementById("btnExportVentas");
  const btnLimpiarVentas = document.getElementById("btnLimpiarVentas");
  const btnClearVentas = document.getElementById("btnClearVentas");
  const backupInfoSales = document.getElementById("backupInfoSales");

  // Pedidos
  const ordersList = document.getElementById("ordersList");
  const ordersFilter = document.getElementById("ordersFilter");
  const btnRefreshOrders = document.getElementById("btnRefreshOrders");
  const btnClearOrders = document.getElementById("btnClearOrders");
  const btnExportOrders = document.getElementById("btnExportOrders");
  const backupInfoOrders = document.getElementById("backupInfoOrders");

  // Productos
  const backupInfoProducts = document.getElementById("backupInfoProducts");

  // API status
  const apiStatusEl = document.getElementById("apiStatusAdmin");
  const apiLastSyncEl = document.getElementById("apiLastSyncAdmin");
  const API_LAST_SYNC_KEY = "api_last_sync_admin_v1";
  const BACKUP_PRODUCTS_KEY = "backup_products_ts_v1";
  const BACKUP_SALES_KEY = "backup_sales_ts_v1";
  const BACKUP_ORDERS_KEY = "backup_orders_ts_v1";

  /* ---------------------------
    Estado
  ---------------------------- */
  let savedProducts = loadSavedProductsArray();
  let currentListFilter = "";
  let onlyLowStockMode = false;

  /* ---------------------------
    Utilidades
  ---------------------------- */
  function persistProducts() {
    saveSavedProductsArray(savedProducts);

    // ✅ sincroniza con core (PRO)
    if (typeof window.setProducts === "function") {
      window.setProducts(savedProducts);
    }

    updateStats();
  }

  function resetForm() {
    if (nombreProducto) nombreProducto.value = "";
    if (descripcionProducto) descripcionProducto.value = "";
    if (categoriaProducto) categoriaProducto.value = "Medicamentos";
    if (disponibilidadProducto) disponibilidadProducto.value = "Disponible";
    if (imagenProducto) imagenProducto.value = "";
    if (precioCajaProducto) precioCajaProducto.value = "";
    if (precioSobreProducto) precioSobreProducto.value = "";
    if (precioUnidadProducto) precioUnidadProducto.value = "";
    if (sobresXCajaProducto) sobresXCajaProducto.value = "";
    if (unidadesXSobreProducto) unidadesXSobreProducto.value = "";
    if (stockCajasProducto) stockCajasProducto.value = "0";

    if (ofertaActivaProducto) ofertaActivaProducto.checked = false;
    if (ofertaTextoProducto) ofertaTextoProducto.value = "";
    if (ofertaPrecioCajaProducto) ofertaPrecioCajaProducto.value = "";
    if (ofertaPrecioSobreProducto) ofertaPrecioSobreProducto.value = "";

    editingIdx = -1;
    if (btnCancelarEdicion) btnCancelarEdicion.style.display = "none";
    if (btnAgregar) btnAgregar.textContent = "Guardar Producto";
  }

  function fillForm(p) {
    if (!p) return;
    nombreProducto.value = p.nombre || "";
    descripcionProducto.value = p.descripcion || "";
    categoriaProducto.value = p.categoria || "Otro";
    disponibilidadProducto.value = p.disponibilidad || "Disponible";
    imagenProducto.value = p.imagen || "";
    precioCajaProducto.value = p.precioCaja || "";
    precioSobreProducto.value = p.precioSobre || "";
    precioUnidadProducto.value = p.precioUnidad || "";
    sobresXCajaProducto.value = p.sobresXCaja || 0;
    unidadesXSobreProducto.value = p.unidadesXSobre || 0;
    stockCajasProducto.value = p.stockCajas || 0;

    if (ofertaActivaProducto) ofertaActivaProducto.checked = !!p.ofertaActiva;
    if (ofertaTextoProducto) ofertaTextoProducto.value = p.ofertaTexto || "";
    if (ofertaPrecioCajaProducto) ofertaPrecioCajaProducto.value = p.ofertaPrecioCaja || "";
    if (ofertaPrecioSobreProducto) ofertaPrecioSobreProducto.value = p.ofertaPrecioSobre || "";
  }

  function newId() {
    return "P" + Date.now().toString(36).toUpperCase();
  }

  function toCSV(rows, delimiter = ";") {
    const esc = (v) => {
      let s = String(v ?? "");
      if (s.includes('"')) s = s.replaceAll('"', '""');
      const needsQuotes = new RegExp(`[\"\\n\\r${delimiter}]`).test(s);
      return needsQuotes ? `"${s}"` : s;
    };
    const body = rows.map((r) => r.map(esc).join(delimiter)).join("\n");
    return `sep=${delimiter}\n${body}`;
  }

  function downloadTextFile(filename, text) {
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function formatTime(ts) {
    if (!ts) return "--";
    try {
      return new Date(ts).toLocaleString("es-CO");
    } catch {
      return "--";
    }
  }

  function updateApiLastSyncLabel() {
    if (!apiLastSyncEl) return;
    const ts = Number(localStorage.getItem(API_LAST_SYNC_KEY) || 0);
    apiLastSyncEl.textContent = `Última sync: ${formatTime(ts)}`;
  }

  function updateBackupLabels() {
    if (backupInfoProducts) {
      const ts = Number(localStorage.getItem(BACKUP_PRODUCTS_KEY) || 0);
      backupInfoProducts.textContent = `Último respaldo: ${formatTime(ts)}`;
    }
    if (backupInfoSales) {
      const ts = Number(localStorage.getItem(BACKUP_SALES_KEY) || 0);
      backupInfoSales.textContent = `Último respaldo: ${formatTime(ts)}`;
    }
    if (backupInfoOrders) {
      const ts = Number(localStorage.getItem(BACKUP_ORDERS_KEY) || 0);
      backupInfoOrders.textContent = `Último respaldo: ${formatTime(ts)}`;
    }
  }

  function setApiStatus(state, text) {
    if (!apiStatusEl) return;
    apiStatusEl.classList.remove("is-online", "is-offline", "is-warn");
    if (state) apiStatusEl.classList.add(state);
    const label = apiStatusEl.querySelector(".api-text");
    if (label) label.textContent = text || "API: --";
  }

  async function checkApiHealth() {
    const enabled = localStorage.getItem("API_ENABLED") !== "false";
    if (!enabled) {
      setApiStatus("is-warn", "API: OFF");
      return;
    }
    if (typeof apiFetch !== "function") {
      setApiStatus("is-warn", "API: N/A");
      return;
    }
    try {
      await apiFetch("/health");
      setApiStatus("is-online", "API: OK");
    } catch {
      setApiStatus("is-offline", "API: ERROR");
    }
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

  async function handleAdminSync() {
    showToast("Sincronizando...");
    const [pSynced, oSynced] = await Promise.all([trySyncProductsFromApi(), trySyncOrdersFromApi()]);
    if (pSynced || oSynced) {
      localStorage.setItem(API_LAST_SYNC_KEY, String(Date.now()));
      updateApiLastSyncLabel();
      checkApiHealth();
    }
    showToast(pSynced || oSynced ? "✅ Sincronizado" : "Sin cambios o sin API");
  }

  // ✅ Sync con backend (opcional)
  async function trySyncProductsFromApi() {
    if (typeof syncProductsFromApi !== "function") return false;
    try {
      const synced = await syncProductsFromApi();
      if (synced) {
        savedProducts = loadSavedProductsArray();
        if (tabLista && tabLista.style.display !== "none") renderListProducts();
        updateStats();
        localStorage.setItem(API_LAST_SYNC_KEY, String(Date.now()));
        updateApiLastSyncLabel();
        checkApiHealth();
        return true;
      }
    } catch (e) {
      console.warn("syncProductsFromApi error:", e);
    }
    return false;
  }

  async function trySyncOrdersFromApi() {
    if (typeof syncOrdersFromApi !== "function") return false;
    try {
      const synced = await syncOrdersFromApi();
      if (synced) {
        if (tabPedidos && tabPedidos.style.display !== "none") renderOrders();
        updateStats();
        localStorage.setItem(API_LAST_SYNC_KEY, String(Date.now()));
        updateApiLastSyncLabel();
        checkApiHealth();
        return true;
      }
    } catch (e) {
      console.warn("syncOrdersFromApi error:", e);
    }
    return false;
  }

  // ✅ Mostrar productos con stock bajo (ADMIN)
  window.showLowStockModal = function () {
    onlyLowStockMode = true;

    if (searchListaProductos) searchListaProductos.value = "";
    currentListFilter = "";

    showTab("lista");
    renderListProducts();

    showToast("🚨 Mostrando productos con stock bajo");
  };

  /* ==========================================================
    TABS
  ========================================================== */
  function showTab(name) {
    const map = { agregar: tabAgregar, lista: tabLista, ventas: tabVentas, pedidos: tabPedidos };

    Object.values(map).forEach((el) => el && (el.style.display = "none"));
    if (map[name]) map[name].style.display = "block";

    tabBtns.forEach((b) => b.classList.remove("active"));
    document.querySelector(`.tab-btn[data-tab="${name}"]`)?.classList.add("active");

    if (name === "lista") {
      renderListProducts();
      trySyncProductsFromApi();
    }
    if (name === "ventas") renderSales();
    if (name === "pedidos") {
      renderOrders();
      trySyncOrdersFromApi();
    }
    updateStats();
  }

  tabBtns.forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));

  /* ==========================================================
    LOGOUT
  ========================================================== */
  logoutBtn?.addEventListener("click", () => {
    localStorage.removeItem(ADMIN_FLAG);
    localStorage.removeItem(SESSION_KEY);
    window.location.href = "admin_login.html";
  });

  btnSyncAdmin?.addEventListener("click", handleAdminSync);
  btnApiConfigAdmin?.addEventListener("click", configureApiFromPrompt);

  /* ==========================================================
    CRUD PRODUCTOS
  ========================================================== */
  function getProductFromForm() {
    const nombre = (nombreProducto.value || "").trim();
    if (!nombre) {
      alert("El nombre es obligatorio.");
      return null;
    }

    const precioCaja = Math.max(0, parsePriceInput(precioCajaProducto.value));
    const precioSobre = Math.max(0, parsePriceInput(precioSobreProducto.value));
    const precioUnidad = Math.max(0, parsePriceInput(precioUnidadProducto.value));

    if (precioCaja === 0 && precioSobre === 0 && precioUnidad === 0) {
      const ok = confirm("Todos los precios están en 0. ¿Guardar igual?");
      if (!ok) return null;
    }

    const sobresXCaja = Math.max(0, parseInt(sobresXCajaProducto.value || "0", 10) || 0);
    const unidadesXSobre = Math.max(0, parseInt(unidadesXSobreProducto.value || "0", 10) || 0);
    const stockCajas = Math.max(0, parseInt(stockCajasProducto.value || "0", 10) || 0);

    return {
      id: editingIdx >= 0 ? savedProducts[editingIdx].id : newId(),
      nombre,
      descripcion: (descripcionProducto.value || "").trim(),
      categoria: (categoriaProducto.value || "Otro").trim(),
      disponibilidad: (disponibilidadProducto.value || "Disponible").trim(),
      imagen: (imagenProducto.value || "").trim(),
      precioCaja,
      precioSobre,
      precioUnidad,
      sobresXCaja,
      unidadesXSobre,
      stockCajas,
    };
  }

  btnAgregar?.addEventListener("click", () => {
    const p = getProductFromForm();
    if (!p) return; // ✅ IMPORTANTÍSIMO: antes de tocar p.*

    // ✅ oferta manual (promo real)
    p.ofertaActiva = !!ofertaActivaProducto?.checked;
    p.ofertaTexto = (ofertaTextoProducto?.value || "").trim();
    p.ofertaPrecioCaja = Math.max(0, parsePriceInput(ofertaPrecioCajaProducto?.value || 0));
    p.ofertaPrecioSobre = Math.max(0, parsePriceInput(ofertaPrecioSobreProducto?.value || 0));

    // ✅ Guardar historial SOLO si bajó (no “anunciamos” subidas)
    if (editingIdx >= 0) {
      const prev = savedProducts[editingIdx] || null;
      if (prev) {
        // Caja
        if ((p.precioCaja || 0) > 0 && (prev.precioCaja || 0) > 0 && p.precioCaja < prev.precioCaja) {
          p.prevPrecioCaja = prev.precioCaja;
          p.priceChangedISO = new Date().toISOString();
        } else {
          p.prevPrecioCaja = prev.prevPrecioCaja || 0;
          p.priceChangedISO = prev.priceChangedISO || "";
        }

        // Sobre
        if ((p.precioSobre || 0) > 0 && (prev.precioSobre || 0) > 0 && p.precioSobre < prev.precioSobre) {
          p.prevPrecioSobre = prev.precioSobre;
          p.priceChangedISO = new Date().toISOString();
        } else {
          p.prevPrecioSobre = prev.prevPrecioSobre || 0;
          p.priceChangedISO = prev.priceChangedISO || "";
        }

        // ✅ si no existían campos en un producto viejo, inicialízalos
        if (prev.prevPrecioCaja == null && p.prevPrecioCaja == null) p.prevPrecioCaja = 0;
        if (prev.prevPrecioSobre == null && p.prevPrecioSobre == null) p.prevPrecioSobre = 0;
        if (prev.priceChangedISO == null && p.priceChangedISO == null) p.priceChangedISO = "";
      }
    } else {
      // Nuevo producto: no hay “prev”
      p.prevPrecioCaja = 0;
      p.prevPrecioSobre = 0;
      p.priceChangedISO = "";
    }

    const isUpdate = editingIdx >= 0;

    if (editingIdx >= 0) {
      savedProducts[editingIdx] = p;
      showToast("✅ Producto actualizado");
    } else {
      savedProducts.unshift(p);
      showToast("✅ Producto agregado");
    }

    persistProducts();

    // ✅ enviar al backend (no bloquea)
    if (typeof apiUpsertProduct === "function") {
      apiUpsertProduct(p, isUpdate).catch((e) => console.warn("apiUpsertProduct error:", e));
    }

    resetForm();
    renderListProducts();
    showTab("lista");
  });

  btnCancelarEdicion?.addEventListener("click", () => {
    resetForm();
    showToast("Edición cancelada");
  });

  /* ==========================================================
    LISTAR PRODUCTOS
  ========================================================== */
  function productCardHTML(p, idx) {
    const stockCajas = Number(p.stockCajas) || 0;
    const stockBajo = stockCajas > 0 && stockCajas <= STOCK_BAJO_LIMIT;

    const prices = [];
    if ((p.precioCaja || 0) > 0) prices.push(`Caja: <b>${formatCOP(p.precioCaja)}</b>`);
    if ((p.precioSobre || 0) > 0) prices.push(`Sobre: <b>${formatCOP(p.precioSobre)}</b>`);
    if ((p.precioUnidad || 0) > 0) prices.push(`Unidad: <b>${formatCOP(p.precioUnidad)}</b>`);

    const badge =
      stockCajas <= 0
        ? `<span class="pill" style="background:#fef2f2;border-color:#fecaca;">🚫 Sin stock</span>`
        : stockBajo
        ? `<span class="pill" style="background:#fef2f2;border-color:#fecaca;">🚨 Stock bajo</span>`
        : `<span class="pill">✅ OK</span>`;

    return `
      <div class="box" style="display:flex;gap:12px;align-items:flex-start;">
        <div style="width:92px;flex:0 0 auto;">
          <img src="${escapeHTML(p.imagen || "https://via.placeholder.com/180")}" alt="${escapeHTML(p.nombre)}"
            style="width:92px;height:92px;border-radius:14px;object-fit:cover;border:1px solid var(--color-border);">
        </div>

        <div style="flex:1;">
          <div style="display:flex;gap:10px;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;">
            <div>
              <div style="font-weight:900;">${escapeHTML(p.nombre)}</div>
              <div class="muted" style="font-size:12px;">${escapeHTML(p.descripcion || "")}</div>
              <div class="muted" style="font-size:12px;margin-top:6px;">
                <span class="pill">📂 ${escapeHTML(p.categoria || "Otro")}</span>
                <span class="pill">📦 ${escapeHTML(p.disponibilidad || "Disponible")}</span>
                ${badge}
              </div>
            </div>

            <div style="display:flex;gap:8px;">
              <button class="btn primary" data-edit="${idx}" type="button">✏️ Editar</button>
              <button class="btn danger" data-del="${idx}" type="button">🗑️ Eliminar</button>
            </div>
          </div>

          <div style="margin-top:10px;font-size:13px;">
            ${prices.length ? prices.join(" · ") : `<span class="muted">Sin precios</span>`}
          </div>

          <div class="muted" style="font-size:12px;margin-top:8px;">
            <b>Stock cajas:</b> ${Number(p.stockCajas) || 0}
            · Sobres/caja: ${Number(p.sobresXCaja) || 0}
            · Unid/sobre: ${Number(p.unidadesXSobre) || 0}
          </div>
        </div>
      </div>
    `;
  }

  function renderListProducts() {
    if (!listaProductos) return;

    savedProducts = loadSavedProductsArray();
    const q = (currentListFilter || "").toLowerCase();

    let list = savedProducts.slice();

    // ✅ modo: solo stock bajo
    if (onlyLowStockMode) {
      list = list.filter((p) => (Number(p.stockCajas) || 0) <= STOCK_BAJO_LIMIT);
    }

    if (q) {
      list = list.filter((p) => {
        const n = (p.nombre || "").toLowerCase();
        const d = (p.descripcion || "").toLowerCase();
        const c = (p.categoria || "").toLowerCase();
        return n.includes(q) || d.includes(q) || c.includes(q);
      });
    }

    // ✅ banner filtro activo
    if (lowStockBanner && lowStockBannerText) {
      if (onlyLowStockMode) {
        lowStockBanner.style.display = "block";
        lowStockBannerText.textContent = `🚨 Filtro activo: Stock Bajo (${list.length} producto(s))`;
      } else {
        lowStockBanner.style.display = "none";
      }
    }

    if (!list.length) {
      listaProductos.innerHTML = `<div class="box"><div class="muted">No hay productos para mostrar.</div></div>`;
      updateStats();
      return;
    }

    listaProductos.innerHTML = list
      .map((p) => productCardHTML(p, savedProducts.findIndex((x) => x.id === p.id)))
      .join("");

    listaProductos.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-edit"), 10);
        const p = savedProducts[idx];
        if (!p) return;

        editingIdx = idx;
        fillForm(p);

        if (btnCancelarEdicion) btnCancelarEdicion.style.display = "inline-block";
        if (btnAgregar) btnAgregar.textContent = "Actualizar Producto";
        showTab("agregar");
      });
    });

    listaProductos.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-del"), 10);
        const p = savedProducts[idx];
        if (!p) return;

        if (!confirm(`¿Eliminar "${p.nombre}"?`)) return;
        savedProducts.splice(idx, 1);
        persistProducts();
        if (typeof apiDeleteProduct === "function") {
          apiDeleteProduct(p.id).catch((e) => console.warn("apiDeleteProduct error:", e));
        }
        renderListProducts();
        showToast("🗑️ Producto eliminado");
      });
    });

    updateStats();
  }

  searchListaProductos?.addEventListener("input", (e) => {
    onlyLowStockMode = false; // ✅ si empieza a buscar, vuelve a modo normal
    currentListFilter = e.target.value || "";
    renderListProducts();
  });

  btnClearLowStockFilter?.addEventListener("click", () => {
    onlyLowStockMode = false;
    currentListFilter = "";
    if (searchListaProductos) searchListaProductos.value = "";
    renderListProducts();
    showToast("Filtro quitado");
  });

  btnLimpiarLocal?.addEventListener("click", () => {
    if (!confirm("¿Eliminar TODOS los productos?")) return;
    savedProducts = [];
    persistProducts();
    renderListProducts();
    showToast("🧹 Productos eliminados");
  });

  btnDescargarExcel?.addEventListener("click", () => {
    const rows = [
      [
        "id",
        "nombre",
        "descripcion",
        "categoria",
        "disponibilidad",
        "imagen",
        "precioCaja",
        "precioSobre",
        "precioUnidad",
        "sobresXCaja",
        "unidadesXSobre",
        "stockCajas",

        // ✅ NUEVO
        "prevPrecioCaja",
        "prevPrecioSobre",
        "priceChangedISO",
        "ofertaActiva",
        "ofertaTexto",
        "ofertaPrecioCaja",
        "ofertaPrecioSobre",
      ],
      ...savedProducts.map((p) => [
        p.id,
        p.nombre,
        p.descripcion,
        p.categoria,
        p.disponibilidad,
        p.imagen,
        p.precioCaja,
        p.precioSobre,
        p.precioUnidad,
        p.sobresXCaja,
        p.unidadesXSobre,
        p.stockCajas,

        // ✅ NUEVO
        p.prevPrecioCaja || 0,
        p.prevPrecioSobre || 0,
        p.priceChangedISO || "",
        !!p.ofertaActiva,
        p.ofertaTexto || "",
        p.ofertaPrecioCaja || 0,
        p.ofertaPrecioSobre || 0,
      ]),
    ];

    downloadTextFile("productos_renacer.csv", toCSV(rows, ";"));
    showToast("📥 Exportado: productos_renacer.csv");
    localStorage.setItem(BACKUP_PRODUCTS_KEY, String(Date.now()));
    updateBackupLabels();
  });

  statAlertasCard?.addEventListener("click", () => {
    onlyLowStockMode = true;
    showTab("lista");
    renderListProducts();
    showToast("Mostrando productos con stock bajo");
  });

  /* ==========================================================
    VENTAS (REGISTRO) + RENDER
  ========================================================== */
  function loadSalesSafe() {
    try {
      return JSON.parse(localStorage.getItem(SALES_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveSalesSafe(arr) {
    localStorage.setItem(SALES_KEY, JSON.stringify(arr));
    try {
      localStorage.setItem(SALES_KEY + "_backup", JSON.stringify(arr.slice(0, 50)));
    } catch (e) {}
    localStorage.setItem(SALES_KEY + "_ts", String(Date.now()));
    localStorage.setItem(SALES_KEY + "_backup_ts", new Date().toISOString());
  }

  function renderSales() {
    if (!listaVentas) return;

    const ventas = loadSalesSafe()
      .slice()
      .sort((a, b) => String((b.fechaISO || b.fecha) || "").localeCompare(String((a.fechaISO || a.fecha) || "")));

    if (!ventas.length) {
      listaVentas.innerHTML = `<div class="box"><div class="muted">No hay ventas registradas.</div></div>`;
      updateStats();
      return;
    }

    listaVentas.innerHTML = ventas
      .map((v, idx) => {
        return `
          <div class="box" style="padding:14px;">
            <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center;">
              <div>
                <div style="font-weight:900;">🧾 Venta</div>
                <div class="muted" style="font-size:12px;">${escapeHTML(v.fecha || "")}</div>
                ${v.refId ? `<div class="muted" style="font-size:12px;">Ref: <b>${escapeHTML(v.refId)}</b></div>` : ""}
              </div>
              <div style="font-weight:900;font-size:14px;">${formatCOP(v.total || 0)}</div>
            </div>

            <details style="margin-top:10px;">
              <summary style="cursor:pointer;font-weight:800;">Ver detalle (${(v.items || []).length})</summary>
              <div style="display:grid;gap:8px;margin-top:10px;">
                ${(v.items || [])
                  .map((it) => {
                    return `
                      <div style="padding:10px;border:1px solid var(--color-card-border);border-radius:12px;">
                        <div style="font-weight:900;">${escapeHTML(it.nombre)} <span class="muted" style="font-weight:600;">(${escapeHTML(it.presentacion)})</span></div>
                        <div class="muted" style="font-size:12px;">
                          ${formatCOP(it.precioUnit)} x ${it.cantidad} = <b>${formatCOP(it.subtotal)}</b>
                        </div>
                      </div>
                    `;
                  })
                  .join("")}
              </div>
            </details>

            <div class="inline-row" style="margin-top:12px;">
              <button class="btn ghost" data-receipt="${idx}" type="button">🖨️ Recibo</button>
              <button class="btn whatsapp" data-wa="${idx}" type="button">📲 WhatsApp</button>
            </div>
          </div>
        `;
      })
      .join("");

    // acciones recibo/wa
    listaVentas.querySelectorAll("[data-receipt]").forEach((b) => {
      b.addEventListener("click", () => {
        const idx = parseInt(b.getAttribute("data-receipt"), 10);
        const ventas2 = loadSalesSafe();
        const v = ventas2[idx];
        if (!v) return;

        const receipt = buildReceipt({
          tipo: "venta",
          cliente: v.cliente || { nombre: "Consumidor final", telefono: "", direccion: "" },
          items: v.items || [],
          total: v.total || 0,
          refId: v.refId || "",
          extras: { metodoPago: v.metodoPago || "", descuento: 0, iva: 0, recibido: 0, cambio: 0 },
        });

        upsertReceipt(receipt);
        openReceiptWindow(receipt);
      });
    });

    listaVentas.querySelectorAll("[data-wa]").forEach((b) => {
      b.addEventListener("click", () => {
        const idx = parseInt(b.getAttribute("data-wa"), 10);
        const ventas2 = loadSalesSafe();
        const v = ventas2[idx];
        if (!v) return;

        const receipt =
          getReceiptByRef(v.refId || "", "venta") ||
          buildReceipt({
            tipo: "venta",
            cliente: v.cliente || { nombre: "Consumidor final", telefono: "", direccion: "" },
            items: v.items || [],
            total: v.total || 0,
            refId: v.refId || "",
          });

        upsertReceipt(receipt);
        const tel = normPhoneDigits(receipt.cliente?.telefono || "");
        if (!tel) return alert("Esta venta no tiene teléfono del cliente.");
        sendReceiptToWhatsApp(receipt, tel);
      });
    });

    updateStats();
  }

  btnExportVentas?.addEventListener("click", () => {
    const ventas = loadSalesSafe();
    const rows = [
      ["fecha", "refId", "clienteNombre", "clienteTelefono", "total", "items_json"],
      ...ventas.map((v) => [
        v.fecha || "",
        v.refId || "",
        v.cliente?.nombre || "",
        v.cliente?.telefono || "",
        v.total || 0,
        JSON.stringify(v.items || []),
      ]),
    ];
    downloadTextFile("ventas_renacer.csv", toCSV(rows, ";"));
    showToast("📥 Exportado: ventas_renacer.csv");
    localStorage.setItem(BACKUP_SALES_KEY, String(Date.now()));
    updateBackupLabels();
  });

  btnExportOrders?.addEventListener("click", () => {
    const orders = loadOrders();
    const rows = [
      [
        "id",
        "estado",
        "fechaISO",
        "clienteNombre",
        "clienteTelefono",
        "clienteDireccion",
        "total",
        "totalAceptado",
        "esParcial",
        "items_json",
        "itemsAceptados_json",
        "itemsRechazados_json",
      ],
      ...orders.map((o) => [
        o.id || "",
        o.estado || "",
        o.fechaISO || "",
        o.cliente?.nombre || "",
        o.cliente?.telefono || "",
        o.cliente?.direccion || "",
        o.total || 0,
        o.totalAceptado || 0,
        !!o.esParcial,
        JSON.stringify(o.items || []),
        JSON.stringify(o.itemsAceptados || []),
        JSON.stringify(o.itemsRechazados || []),
      ]),
    ];

    downloadTextFile("pedidos_renacer.csv", toCSV(rows, ";"));
    showToast("📥 Exportado: pedidos_renacer.csv");
    localStorage.setItem(BACKUP_ORDERS_KEY, String(Date.now()));
    updateBackupLabels();
  });

  btnLimpiarVentas?.addEventListener("click", () => {
    if (!confirm("¿Borrar historial de ventas?")) return;
    saveSalesSafe([]);
    showToast("🧹 Ventas borradas");
    renderSales();
  });

  btnClearVentas?.addEventListener("click", () => {
    if (!confirm("¿Limpiar ventas (pruebas)?")) return;
    saveSalesSafe([]);
    showToast("🧹 Ventas (pruebas) borradas");
    renderSales();
  });

  /* ==========================================================
    PEDIDOS (aceptar / rechazar / cancelar)
  ========================================================== */
  function orderBadge(estado, parcial) {
    const e = String(estado || "pendiente");
    const bg =
      e === "pendiente"
        ? "#f59e0b"
        : e === "aceptado"
        ? "#10b981"
        : e === "rechazado"
        ? "#ef4444"
        : e === "cancelado"
        ? "#6b7280"
        : "#64748b";

    return `<span style="padding:6px 10px;border-radius:999px;background:${bg};color:#fff;font-weight:900;font-size:12px;">
      ${escapeHTML(e.toUpperCase())}${parcial ? " (PARCIAL)" : ""}
    </span>`;
  }

  function renderOrders() {
    if (!ordersList) return;

    const filter = ordersFilter ? ordersFilter.value || "all" : "all";
    let orders = loadOrders();

    if (filter !== "all") orders = orders.filter((o) => String(o.estado) === filter);

    if (!orders.length) {
      ordersList.innerHTML = `<div class="box"><div class="muted">No hay pedidos.</div></div>`;
      updateStats();
      return;
    }

    ordersList.innerHTML = orders
      .map((o) => {
        const items = Array.isArray(o.items) ? o.items : [];
        const fecha = o.fechaISO ? new Date(o.fechaISO).toLocaleString("es-CO") : "";

        return `
          <div class="box" style="padding:14px;">
            <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;">
              <div>
                <div style="font-weight:900;">${escapeHTML(o.id)}</div>
                <div class="muted" style="font-size:12px;">${fecha}</div>
                <div class="muted" style="font-size:12px;margin-top:6px;">
                  👤 <b>${escapeHTML(o.cliente?.nombre || "-")}</b> · 📞 ${escapeHTML(o.cliente?.telefono || "-")}
                  ${o.cliente?.direccion ? ` · 📍 ${escapeHTML(o.cliente.direccion)}` : ""}
                </div>
              </div>
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                ${o.synced === false ? `<span class="pill" style="border-color:#f59e0b;">⚠️ Sin sync</span>` : ""}
                ${orderBadge(o.estado, !!o.esParcial)}
                <div style="font-weight:900;">${formatCOP(o.total || 0)}</div>
              </div>
            </div>

            <details style="margin-top:10px;">
              <summary style="cursor:pointer;font-weight:900;">Ver items (${items.length})</summary>
              <div style="display:grid;gap:8px;margin-top:10px;">
                ${items
                  .map((it) => {
                    return `
                      <div style="padding:10px;border:1px solid var(--color-card-border);border-radius:12px;">
                        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;">
                          <div style="font-weight:900;">
                            ${escapeHTML(it.nombre)}
                            <span class="muted" style="font-weight:600;">
                              (${escapeHTML(it.presentacion)})
                            </span>
                          </div>
                          <div style="font-weight:900;">${formatCOP(it.subtotal)}</div>
                        </div>
                        <div class="muted" style="font-size:12px;">
                          ${formatCOP(it.precioUnit)} x ${it.cantidad}
                        </div>

                        ${
                          String(o.estado) === "pendiente"
                            ? `
                              <div class="inline-row" style="margin-top:10px;">
                                <label class="inline-check">
                                  <input
                                    type="checkbox"
                                    data-accept-item="${escapeHTML(o.id)}|${escapeHTML(it.id)}|${escapeHTML(it.presentacion)}"
                                    checked
                                  >
                                  Aceptar este item
                                </label>
                              </div>
                            `
                            : ""
                        }
                      </div>
                    `;
                  })
                  .join("")}
              </div>
            </details>

            <div class="inline-row" style="margin-top:12px;">
              ${
                String(o.estado) === "pendiente"
                  ? `
                    <button class="btn primary" data-order-accept="${escapeHTML(o.id)}" type="button">✅ Aceptar</button>
                    <button class="btn danger" data-order-reject="${escapeHTML(o.id)}" type="button">❌ Rechazar</button>
                  `
                  : ""
              }

              ${
                String(o.estado) === "aceptado"
                  ? `<button class="btn danger" data-order-cancel="${escapeHTML(o.id)}" type="button">🚫 Cancelar (revertir stock)</button>`
                  : ""
              }

              <button class="btn ghost" data-order-wa="${escapeHTML(o.id)}" type="button">📲 WhatsApp Cliente</button>
            </div>

            ${
              String(o.estado) === "rechazado" && o.motivoRechazo
                ? `<div class="muted" style="margin-top:10px;">Motivo: <b>${escapeHTML(o.motivoRechazo)}</b></div>`
                : ""
            }
          </div>
        `;
      })
      .join("");

    // ✅ WhatsApp Cliente
    ordersList.querySelectorAll("[data-order-wa]").forEach((b) => {
      b.addEventListener("click", () => {
        const id = b.getAttribute("data-order-wa");
        const order = loadOrders().find((x) => x.id === id);
        if (!order) return;

        try {
          sendOrderUpdateToClientWhatsApp(order);
        } catch (e) {
          console.warn(e);
          alert("No se pudo abrir WhatsApp del cliente.");
        }
      });
    });

    // ✅ anti doble click (UX)
    ordersList.querySelectorAll("[data-order-accept]").forEach((b) => {
      b.addEventListener("click", () => {
        b.disabled = true;
        acceptOrderFlow(b.getAttribute("data-order-accept"));
        setTimeout(() => (b.disabled = false), 800);
      });
    });

    ordersList.querySelectorAll("[data-order-reject]").forEach((b) => {
      b.addEventListener("click", () => {
        b.disabled = true;
        rejectOrderFlow(b.getAttribute("data-order-reject"));
        setTimeout(() => (b.disabled = false), 800);
      });
    });

    ordersList.querySelectorAll("[data-order-cancel]").forEach((b) => {
      b.addEventListener("click", () => {
        b.disabled = true;
        cancelOrderFlow(b.getAttribute("data-order-cancel"));
        setTimeout(() => (b.disabled = false), 800);
      });
    });

    updateStats();
  }

  // ✅ ACEPTAR (con lock + finally)
  function acceptOrderFlow(orderId) {
    if (!acquireOrderLock(orderId)) {
      showToast("⏳ Ya se está procesando este pedido...");
      return;
    }

    try {
      const orders = loadOrders();
      const order = orders.find((o) => o.id === orderId);
      if (!order) return;

      if (String(order.estado) !== "pendiente") {
        alert("Este pedido ya no está pendiente.");
        return;
      }

      const checks = ordersList.querySelectorAll(`[data-accept-item^="${CSS.escape(orderId)}|"]`);

      const acceptedKeys = new Set();
      checks.forEach((c) => {
        if (c.checked) acceptedKeys.add(c.getAttribute("data-accept-item"));
      });

      const items = Array.isArray(order.items) ? order.items : [];
      const accepted = [];
      const rejected = [];

      items.forEach((it) => {
        const key = `${orderId}|${it.id}|${it.presentacion}`;
        if (acceptedKeys.has(key)) accepted.push(it);
        else rejected.push(it);
      });

      if (!accepted.length) {
        alert("No puedes aceptar 0 items. Si no hay stock, usa Rechazar.");
        return;
      }

      // Validar stock para cada item aceptado
      savedProducts = loadSavedProductsArray();
      const updated = savedProducts.slice();
      const errors = [];

      accepted.forEach((it) => {
        const prod = updated.find((p) => p.id === it.id);
        if (!prod) {
          errors.push(`Producto no encontrado: ${it.nombre}`);
          return;
        }
        const res = validarStockParaItem(prod, it.presentacion, it.cantidad);
        if (!res.ok) errors.push(`${it.nombre} (${it.presentacion}): ${res.msg}`);
      });

      if (errors.length) {
        alert("No se puede aceptar por stock:\n\n- " + errors.join("\n- "));
        return;
      }

      // Descontar stock
      accepted.forEach((it) => {
        const prod = updated.find((p) => p.id === it.id);
        descontarStock(prod, it.presentacion, it.cantidad);
      });

      // Guardar productos
      savedProducts = updated;
      persistProducts();

      const totalAceptado = accepted.reduce((s, it) => s + (it.subtotal || 0), 0);
      if (totalAceptado <= 0) {
        alert("El total aceptado es inválido.");
        return;
      }

      const esParcial = rejected.length > 0;

      order.estado = "aceptado";
      order.esParcial = esParcial;
      order.itemsAceptados = accepted;
      order.itemsRechazados = rejected;
      order.totalAceptado = totalAceptado;
      order.fechaAceptacionISO = nowISO();

      saveOrders(orders);

      if (typeof apiUpdateOrderStatus === "function") {
        apiUpdateOrderStatus(order).catch((e) => console.warn("apiUpdateOrderStatus error:", e));
      }

      // ✅ WhatsApp automático al cliente
      try {
        sendOrderUpdateToClientWhatsApp(order);
      } catch (e) {
        console.warn("No se pudo abrir WhatsApp del cliente:", e);
      }

      // Registrar venta
      const ventas = loadSalesSafe();
      const sale = {
        fecha: new Date().toLocaleString("es-CO"),
        refId: order.id,
        cliente: order.cliente || { nombre: "Consumidor final", telefono: "", direccion: "" },
        items: accepted.map((it) => ({
          nombre: it.nombre,
          presentacion: it.presentacion,
          precioUnit: it.precioUnit,
          cantidad: it.cantidad,
          subtotal: it.subtotal,
        })),
        total: totalAceptado,
        metodoPago: "",
        fechaISO: nowISO(),
      };

      ventas.unshift(sale);
      saveSalesSafe(ventas);

      // Recibo asociado
      const receipt = buildReceipt({
        tipo: "venta",
        cliente: sale.cliente,
        items: sale.items,
        total: sale.total,
        refId: sale.refId,
      });

      upsertReceipt(receipt);

      showToast(esParcial ? "✅ Pedido aceptado (parcial)" : "✅ Pedido aceptado");
      renderOrders();
      renderSales();
      updateStats();
    } finally {
      releaseOrderLock(orderId);
    }
  }

  // ✅ RECHAZAR (con lock + finally)
  function rejectOrderFlow(orderId) {
    if (!acquireOrderLock(orderId)) {
      showToast("⏳ Ya se está procesando este pedido...");
      return;
    }

    try {
      const orders = loadOrders();
      const order = orders.find((o) => o.id === orderId);
      if (!order) return;

      if (String(order.estado) !== "pendiente") {
        alert("Este pedido ya no está pendiente.");
        return;
      }

      const motivo = prompt("Motivo del rechazo (opcional):", "");
      order.estado = "rechazado";
      order.motivoRechazo = (motivo || "").trim();
      order.fechaRechazoISO = nowISO();

      saveOrders(orders);

      if (typeof apiUpdateOrderStatus === "function") {
        apiUpdateOrderStatus(order).catch((e) => console.warn("apiUpdateOrderStatus error:", e));
      }

      // ✅ (opcional pro) avisar al cliente
      try {
        sendOrderUpdateToClientWhatsApp(order);
      } catch (e) {
        console.warn("No se pudo abrir WhatsApp del cliente:", e);
      }

      showToast("❌ Pedido rechazado");
      renderOrders();
      updateStats();
    } finally {
      releaseOrderLock(orderId);
    }
  }

  // ✅ CANCELAR (con lock + finally)
  function cancelOrderFlow(orderId) {
    if (!acquireOrderLock(orderId)) {
      showToast("⏳ Ya se está procesando este pedido...");
      return;
    }

    try {
      const orders = loadOrders();
      const order = orders.find((o) => o.id === orderId);
      if (!order) return;

      if (String(order.estado) !== "aceptado") {
        alert("Solo se pueden cancelar pedidos ACEPTADOS.");
        return;
      }

      if (!confirm("¿Cancelar pedido y revertir stock de los items aceptados?")) return;

      savedProducts = loadSavedProductsArray();
      const updated = savedProducts.slice();

      const toRevert = Array.isArray(order.itemsAceptados) && order.itemsAceptados.length ? order.itemsAceptados : [];

      toRevert.forEach((it) => {
        const prod = updated.find((p) => p.id === it.id);
        if (!prod) return;
        revertirStock(prod, it.presentacion, it.cantidad);
      });

      savedProducts = updated;
      persistProducts();

      order.estado = "cancelado";
      order.fechaCancelacionISO = nowISO();
      saveOrders(orders);

      if (typeof apiUpdateOrderStatus === "function") {
        apiUpdateOrderStatus(order).catch((e) => console.warn("apiUpdateOrderStatus error:", e));
      }

      // ✅ (opcional pro) avisar al cliente
      try {
        sendOrderUpdateToClientWhatsApp(order);
      } catch (e) {
        console.warn("No se pudo abrir WhatsApp del cliente:", e);
      }

      showToast("🚫 Pedido cancelado (stock revertido)");
      renderOrders();
      updateStats();
    } finally {
      releaseOrderLock(orderId);
    }
  }

  ordersFilter?.addEventListener("change", renderOrders);
  btnRefreshOrders?.addEventListener("click", async () => {
    await trySyncOrdersFromApi();
    renderOrders();
  });

  btnClearOrders?.addEventListener("click", () => {
    if (!confirm("¿Borrar TODOS los pedidos (pruebas)?")) return;
    saveOrders([]);
    showToast("🧹 Pedidos borrados");
    renderOrders();
    updateStats();
  });

  /* ==========================================================
    INIT
  ========================================================== */
  savedProducts = loadSavedProductsArray();
  persistProducts();
  resetForm();
  showTab("agregar");

  renderListProducts();
  renderSales();
  renderOrders();
  updateStats();

  trySyncProductsFromApi();
  trySyncOrdersFromApi();
  updateApiLastSyncLabel();
  checkApiHealth();
  updateBackupLabels();
})();

// Tip semanal: exportar para respaldo (solo 1 vez por semana)
(function weeklyBackupTip() {
  const KEY = "renacer_backup_tip_week";
  const now = Date.now();
  const week = Math.floor(now / (7 * 24 * 60 * 60 * 1000));
  const last = Number(localStorage.getItem(KEY) || "-1");

  if (week !== last) {
    localStorage.setItem(KEY, String(week));
    setTimeout(() => {
      alert("🔒 Recomendación: exporta Productos y Ventas (CSV) al menos 1 vez por semana para respaldo.");
    }, 600);
  }
})();

// ✅ Hacer TODA la tarjeta de "Alertas Stock" clickeable
(function bindAlertasStockCard() {
  const stat = document.getElementById("statAlertas");
  if (!stat) return;

  let card = stat;
  for (let i = 0; i < 6; i++) {
    if (!card || !card.parentElement) break;
    card = card.parentElement;
    if (card.classList && card.classList.contains("stat-card")) break;
  }

  if (!card || card === stat) card = stat.parentElement;
  if (!card) return;

  card.style.cursor = "pointer";
  card.title = "Ver productos con stock bajo";

  if (card.dataset.boundLowStock === "1") return;
  card.dataset.boundLowStock = "1";

  card.addEventListener("click", () => {
    try {
      showLowStockModal();
    } catch (e) {
      console.error(e);
      alert("⚠️ No se pudo mostrar la alerta de stock. Revisa consola.");
    }
  });
})();
