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
  const DEMO_MODE = typeof window.DEMO_MODE === "boolean" ? window.DEMO_MODE : true;

  if (demoBox) demoBox.style.display = DEMO_MODE ? "block" : "none";

  // Credenciales (demo)
  // Credenciales (demo) — cámbialas antes de entregar
  const ADMIN_USER = "admin";
  const ADMIN_PASS = "wilfer1234";


  function setError(show) {
    if (!errEl) return;
    errEl.style.display = show ? "block" : "none";
  }

  function doLogin() {
    const u = (userEl?.value || "").trim();
    const p = (passEl?.value || "").trim();

    if (u === ADMIN_USER && p === ADMIN_PASS) {
      localStorage.setItem(ADMIN_FLAG, "true");
      showToast("✅ Acceso concedido");
      window.location.href = "admin.html";
      return;
    }

    localStorage.removeItem(ADMIN_FLAG);
    setError(true);
    showToast("❌ Credenciales incorrectas");
  }

  // Enter para enviar
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doLogin();
  });

  btnEl?.addEventListener("click", doLogin);

  if (togglePass && passEl) {
    togglePass.addEventListener("click", () => {
      const showing = passEl.type === "text";
      passEl.type = showing ? "password" : "text";
      togglePass.textContent = showing ? "Ver" : "Ocultar";
      togglePass.setAttribute("aria-pressed", String(!showing));
      togglePass.setAttribute("aria-label", showing ? "Mostrar contraseña" : "Ocultar contraseña");
    });
  }

  // Si ya está logueado, redirige
  if (localStorage.getItem(ADMIN_FLAG) === "true") {
    window.location.href = "admin.html";
  }
})();
