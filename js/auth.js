/* ==========================================================
  auth.js — Login Admin
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
  const FIXED_API_BASE = "https://wisand-core-api.onrender.com";
  const FIXED_TENANT_CODE = "renacer-pharma";

  function enforceFixedApiConfig() {
    localStorage.setItem("API_BASE", FIXED_API_BASE);
    localStorage.setItem("API_ENABLED", "true");
    localStorage.setItem("TENANT_CODE", FIXED_TENANT_CODE);
  }

  enforceFixedApiConfig();

  const isFile = window.location?.protocol === "file:";
  const isLocalHost =
    window.location?.hostname === "localhost" || window.location?.hostname === "127.0.0.1";
  const apiBase = localStorage.getItem("API_BASE") || "";
  const looksLocalApi = /localhost|127\.0\.0\.1/i.test(apiBase);
  const showDemo = DEMO_MODE && (isFile || isLocalHost || looksLocalApi);
  if (demoBox) demoBox.style.display = showDemo ? "block" : "none";
  const DEFAULT_API_BASE = FIXED_API_BASE;

  function updateApiStatus() {
    if (!apiStatus) return;
    const base = localStorage.getItem("API_BASE") || "";
    const enabled = localStorage.getItem("API_ENABLED") !== "false" && !!base;
    const label = enabled ? "API activa" : "API desactivada";
    apiStatus.textContent = base ? `${label}: ${base}` : `${label}: sin URL`;
  }

  function configureApi() {
    enforceFixedApiConfig();
    updateApiStatus();
    showToast("API fija para Renacer");
  }

  async function syncApi() {
    const base = (FIXED_API_BASE || "").trim();
    if (!base) {
      showToast("Configura la API primero");
      return;
    }
    const url = base.replace(/\/$/, "") + "/health";
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`API ${res.status}`);
      localStorage.setItem("API_BASE", base);
      localStorage.setItem("API_ENABLED", "true");
      localStorage.setItem("TENANT_CODE", FIXED_TENANT_CODE);
      updateApiStatus();
      showToast("API OK");
    } catch (e) {
      enforceFixedApiConfig();
      updateApiStatus();
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

    try {
      enforceFixedApiConfig();
      localStorage.setItem("API_ENABLED", "true");
      const data = await apiLogin(u, p);
      if (!data?.token) throw new Error("Sin token");

      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user || {}));
      localStorage.setItem(ADMIN_FLAG, "true");
      localStorage.setItem(SESSION_KEY, String(Date.now()));
      showToast("✅ Acceso concedido");
      window.location.href = "admin.html";
    } catch (e) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(ADMIN_FLAG);
      localStorage.removeItem(SESSION_KEY);
      setError(true);
      showToast("❌ Credenciales incorrectas o API no disponible");
    }
  }

  function setError(show) {
    if (!errEl) return;
    errEl.style.display = show ? "block" : "none";
  }

  // Enter para enviar
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doLogin();
  });

  btnEl?.addEventListener("click", doLogin);
  if (apiPanel) apiPanel.style.display = "none";
  apiBtn?.addEventListener("click", configureApi);
  apiSyncBtn?.addEventListener("click", syncApi);
  updateApiStatus();

  if (togglePass && passEl) {
    togglePass.addEventListener("click", () => {
      const showing = passEl.type === "text";
      passEl.type = showing ? "password" : "text";
      togglePass.classList.toggle("is-open", !showing);
      togglePass.setAttribute("aria-pressed", String(!showing));
      togglePass.setAttribute("aria-label", showing ? "Mostrar contraseña" : "Ocultar contraseña");
    });
  }

  // Si ya está logueado y la sesión sigue viva, redirige
  (function checkSession() {
    if (localStorage.getItem(ADMIN_FLAG) !== "true") return;
    const ts = Number(localStorage.getItem(SESSION_KEY) || 0);
    const token = localStorage.getItem(TOKEN_KEY);
    if (!ts || Date.now() - ts > SESSION_TTL || !token) {
      localStorage.removeItem(ADMIN_FLAG);
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      return;
    }
    window.location.href = "admin.html";
  })();
})();
