(() => {
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

  const storeLink = document.querySelector(".admin-link");
  if (storeLink && isStandalone) {
    storeLink.addEventListener("click", (e) => {
      e.preventDefault();
      window.open(storeLink.href, "_blank", "noopener");
    });
  }

  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/admin-sw.js")
      .catch(() => {});
  });
})();
