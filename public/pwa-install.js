(() => {
  let installPrompt = null;
  let installButton = null;

  const isStandalone = () =>
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  function showInstallButton() {
    if (isStandalone() || installButton) return;
    installButton = document.createElement("button");
    installButton.type = "button";
    installButton.textContent = "安装到手机";
    installButton.setAttribute("aria-label", "将小智视频安装到手机桌面");
    Object.assign(installButton.style, {
      position: "fixed",
      right: "14px",
      top: "max(54px, calc(env(safe-area-inset-top) + 54px))",
      zIndex: "1700",
      border: "1px solid rgba(255,255,255,.18)",
      borderRadius: "999px",
      padding: "12px 18px",
      color: "#fff",
      background: "linear-gradient(135deg,#7c3aed,#0891b2)",
      boxShadow: "0 8px 28px rgba(0,0,0,.32)",
      fontSize: "14px",
      fontWeight: "700",
      cursor: "pointer"
    });
    installButton.addEventListener("click", async () => {
      if (!installPrompt) {
        window.alert("请在浏览器右上角菜单中选择“添加到主屏幕”或“安装应用”。");
        return;
      }
      installButton.disabled = true;
      installPrompt.prompt();
      await installPrompt.userChoice.catch(() => null);
      installPrompt = null;
      installButton.remove();
      installButton = null;
    });
    document.body.appendChild(installButton);
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    showInstallButton();
  });

  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    installButton?.remove();
    installButton = null;
  });

  window.addEventListener("DOMContentLoaded", () => {
    if (!isStandalone()) {
      // Keep a manual install entry available on browsers that do not expose
      // beforeinstallprompt (for example, some Android browser variants).
      showInstallButton();
    }
  });
})();
