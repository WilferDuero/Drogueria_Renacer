/* ==========================================================
  auth.js - Login Admin
========================================================== */

(function () {
  const userEl = document.getElementById("loginUser");
  const passEl = document.getElementById("loginPass");
  const btnEl = document.getElementById("loginBtn");
  const errEl = document.getElementById("loginError");
  const demoBox = document.getElementById("demoCredentials");
  const togglePass = document.getElementById("togglePass");
  const apiBtn = document.getElementById("apiConfigBtn");
  const apiSyncBtn = document.getElementById("apiSyncBtn");
  const apiStatus = document.getElementById("apiStatus");
  const apiPanel = document.querySelector(".login-api");
  const DEMO_MODE = typeof window.DEMO_MODE === "boolean" ? window.DEMO_MODE : true;
  const SESSION_KEY = window.ADMIN_SESSION_TS_KEY || "admin_session_ts_v1";
  const SESSION_TTL = window.ADMIN_SESSION_TTL_MS || 8 * 60 * 60 * 1000;
  const TOKEN_KEY = window.ADMIN_TOKEN_KEY || "admin_token_v1";
  const USER_KEY = window.ADMIN_USER_KEY || "admin_user_v1";
  const ADMIN_LOGGED_KEY = window.ADMIN_FLAG || "admin_logged";
  const ADMIN_MODE_KEY = window.ADMIN_MODE_KEY || "wisand_admin_mode_v1";
  const FIXED_API_BASE = "https://wisand-core-api.onrender.com";
  const CLIENT_TENANT_CODE = window.CLIENT_TENANT_CODE || "renacer-pharma";
  const SUPER_TENANT_CODE = window.SUPERUSER_TENANT_CODE || "wisand";
  const SUPER_USERNAME = String(window.SUPERUSER_USERNAME || "wisand2927")
    .trim()
    .toLowerCase();

  function normalizeCode(value) {
    return String(value || "").trim().toLowerCase();
  }

  function clearTenantScopedData() {
    const keys = [
      "productos_renacer_v1",
      "productos_renacer_v1_backup",
      "productos_renacer_v1_ts",
      "productos_renacer_v1_backup_ts",
      "pedidos_renacer_v1",
      "pedidos_renacer_v1_backup",
      "pedidos_renacer_v1_ts",
      "pedidos_renacer_v1_backup_ts",
      "ventas_renacer",
      "reviews_renacer_v1",
      "cart_renacer",
      "cliente_renacer_v1",
      "recibos_renacer_v1",
      "recibos_renacer_v1_backup",
      "recibos_renacer_v1_ts",
      "recibos_renacer_v1_backup_ts",
      "sales_user_id_v1",
    ];
    keys.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {}
      try {
        sessionStorage.removeItem(k);
      } catch {}
    });
  }

  function hasActiveSession() {
    if (localStorage.getItem(ADMIN_LOGGED_KEY) !== "true") return false;
    const ts = Number(localStorage.getItem(SESSION_KEY) || 0);
    const token = localStorage.getItem(TOKEN_KEY);
    if (!ts || !token) return false;
    return Date.now() - ts <= SESSION_TTL;
  }

  function resolveLoginBinding(username) {
    const userNorm = normalizeCode(username);
    const tenantFromQuery = normalizeCode(new URLSearchParams(window.location.search).get("tenant"));
    const requestedTenant =
      tenantFromQuery || (userNorm === SUPER_USERNAME ? SUPER_TENANT_CODE : CLIENT_TENANT_CODE);

    if (requestedTenant === SUPER_TENANT_CODE && userNorm === SUPER_USERNAME) {
      return { tenantCode: SUPER_TENANT_CODE, mode: "superuser" };
    }
    return { tenantCode: CLIENT_TENANT_CODE, mode: "client" };
  }

  function applyApiBinding(binding, options = {}) {
    const tenantCode = normalizeCode(binding?.tenantCode) || CLIENT_TENANT_CODE;
    const mode = binding?.mode === "superuser" ? "superuser" : "client";
    const currentTenant = normalizeCode(localStorage.getItem("TENANT_CODE"));
    const currentMode = normalizeCode(localStorage.getItem(ADMIN_MODE_KEY));
    const changedTenant = !!currentTenant && currentTenant !== tenantCode;
    const changedMode = !!currentMode && currentMode !== mode;

    if (!options.skipClearOnChange && (changedTenant || changedMode)) {
      clearTenantScopedData();
    }

    localStorage.setItem("API_BASE", FIXED_API_BASE);
    localStorage.setItem("API_ENABLED", "true");
    localStorage.setItem("TENANT_CODE", tenantCode);
    localStorage.setItem(ADMIN_MODE_KEY, mode);
    window.API_BASE = FIXED_API_BASE;
    window.TENANT_CODE = tenantCode;
  }

  function canUseTechnicalControls() {
    const draft = resolveLoginBinding(userEl?.value || "");
    if (draft.mode === "superuser") return true;
    return hasActiveSession() && normalizeCode(localStorage.getItem(ADMIN_MODE_KEY)) === "superuser";
  }

  function updateApiStatus() {
    if (!apiStatus) return;
    const base = localStorage.getItem("API_BASE") || "";
    const tenant = normalizeCode(localStorage.getItem("TENANT_CODE") || "");
    const enabled = localStorage.getItem("API_ENABLED") !== "false" && !!base;
    const label = enabled ? "API activa" : "API desactivada";
    apiStatus.textContent = base ? `${label}: ${base} | tenant=${tenant || "-"}` : `${label}: sin URL`;
  }

  function updateTechnicalPanelVisibility() {
    if (apiPanel) apiPanel.style.display = canUseTechnicalControls() ? "block" : "none";
    updateApiStatus();
  }

  function configureApi() {
    if (!canUseTechnicalControls()) return;
    const binding = resolveLoginBinding(userEl?.value || "");
    applyApiBinding(binding);
    updateApiStatus();
    showToast("API fija en WISAND core");
  }

  async function syncApi() {
    if (!canUseTechnicalControls()) return;
    const binding = resolveLoginBinding(userEl?.value || "");
    applyApiBinding(binding);

    const url = FIXED_API_BASE.replace(/\/$/, "") + "/health";
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`API ${res.status}`);
      updateApiStatus();
      showToast("API OK");
    } catch (e) {
      showToast("API no disponible");
    }
  }

  async function doLogin() {
    const u = (userEl?.value || "").trim();
    const p = (passEl?.value || "").trim();

    if (!u || !p) {
      setError(true);
      return;
    }

    const requestedBinding = resolveLoginBinding(u);

    try {
      setError(false);
      applyApiBinding(requestedBinding);
      localStorage.setItem("API_ENABLED", "true");

      const data = await apiLogin(u, p);
      if (!data?.token) throw new Error("Sin token");

      const responseUsername = normalizeCode(data?.user?.username || u);
      const isSuperConfirmed =
        requestedBinding.mode === "superuser" && responseUsername === SUPER_USERNAME;
      const finalBinding = isSuperConfirmed
        ? { tenantCode: SUPER_TENANT_CODE, mode: "superuser" }
        : { tenantCode: CLIENT_TENANT_CODE, mode: "client" };
      applyApiBinding(finalBinding);

      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user || {}));
      localStorage.setItem(ADMIN_LOGGED_KEY, "true");
      localStorage.setItem(SESSION_KEY, String(Date.now()));
      showToast("Acceso concedido");
      window.location.href = "admin.html";
    } catch (e) {
      applyApiBinding({ tenantCode: CLIENT_TENANT_CODE, mode: "client" });
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(ADMIN_LOGGED_KEY);
      localStorage.removeItem(SESSION_KEY);
      setError(true);
      showToast("Credenciales incorrectas o API no disponible");
      updateTechnicalPanelVisibility();
    }
  }

  function setError(show) {
    if (!errEl) return;
    errEl.style.display = show ? "block" : "none";
  }

  const shouldKeepSuperBinding =
    hasActiveSession() && normalizeCode(localStorage.getItem(ADMIN_MODE_KEY)) === "superuser";
  applyApiBinding(
    shouldKeepSuperBinding
      ? { tenantCode: SUPER_TENANT_CODE, mode: "superuser" }
      : { tenantCode: CLIENT_TENANT_CODE, mode: "client" },
    { skipClearOnChange: true }
  );

  const isFile = window.location?.protocol === "file:";
  const isLocalHost =
    window.location?.hostname === "localhost" || window.location?.hostname === "127.0.0.1";
  const apiBase = localStorage.getItem("API_BASE") || "";
  const looksLocalApi = /localhost|127\.0\.0\.1/i.test(apiBase);
  const showDemo = DEMO_MODE && (isFile || isLocalHost || looksLocalApi);
  if (demoBox) demoBox.style.display = showDemo ? "block" : "none";

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doLogin();
  });

  btnEl?.addEventListener("click", doLogin);
  userEl?.addEventListener("input", updateTechnicalPanelVisibility);
  apiBtn?.addEventListener("click", configureApi);
  apiSyncBtn?.addEventListener("click", syncApi);
  updateTechnicalPanelVisibility();

  if (togglePass && passEl) {
    togglePass.addEventListener("click", () => {
      const showing = passEl.type === "text";
      passEl.type = showing ? "password" : "text";
      togglePass.classList.toggle("is-open", !showing);
      togglePass.setAttribute("aria-pressed", String(!showing));
      togglePass.setAttribute("aria-label", showing ? "Mostrar contrase\u00f1a" : "Ocultar contrase\u00f1a");
    });
  }

  // Si ya esta logueado y la sesion sigue viva, redirige
  (function checkSession() {
    if (localStorage.getItem(ADMIN_LOGGED_KEY) !== "true") return;
    const ts = Number(localStorage.getItem(SESSION_KEY) || 0);
    const token = localStorage.getItem(TOKEN_KEY);
    if (!ts || Date.now() - ts > SESSION_TTL || !token) {
      localStorage.removeItem(ADMIN_LOGGED_KEY);
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      applyApiBinding({ tenantCode: CLIENT_TENANT_CODE, mode: "client" });
      updateTechnicalPanelVisibility();
      return;
    }
    window.location.href = "admin.html";
  })();
})();
