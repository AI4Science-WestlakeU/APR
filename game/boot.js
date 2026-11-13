(() => {
  const cover = document.querySelector("#cover");
  const coverURL = getComputedStyle(cover).backgroundImage.match(/^url\(["']?(.*?)["']?\)$/)?.[1];
  const coverImage = new Image();
  if (coverURL) coverImage.src = coverURL;
  Promise.allSettled([
    ...coverURL ? [coverImage.decode()] : [],
    ...[400, 700].map((weight) => document.fonts.load(`${weight} 18px "Open Sans SemiCondensed"`))
  ]).then(() => parent.postMessage({ type: "apr-game-ready" }, "*"));
  const button = document.querySelector("#play");
  const status = document.querySelector("#load-status");
  const yard = document.querySelector("#yard"), fullscreen = document.querySelector("#fullscreen");
  if (!yard.requestFullscreen) fullscreen.hidden = true;
  fullscreen.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement === yard) await document.exitFullscreen();
      else await yard.requestFullscreen();
      document.querySelector("#view-status").textContent = "";
    } catch {
      document.querySelector("#view-status").textContent = "Fullscreen unavailable in this browser or embed.";
    }
  });
  document.addEventListener("fullscreenchange", () => {
    const active = document.fullscreenElement === yard;
    fullscreen.setAttribute("aria-pressed", String(active));
    fullscreen.setAttribute("aria-label", active ? "Exit fullscreen" : "Enter fullscreen");
    fullscreen.title = active ? "Exit fullscreen \xB7 Esc" : "Fullscreen";
    yard.dataset.fullscreenChangedAt = String(performance.now());
  });
  let starting = false, queued = false, grant;
  addEventListener("message", (event) => {
    if (event.source !== parent) return;
    if (event.data?.type === "apr-loading-available") queued = true;
    if (event.data?.type === "apr-game-grant") grant?.();
  });
  button.addEventListener("click", async () => {
    if (starting) return;
    const probe = document.createElement("canvas");
    const context = probe.getContext("webgl2", { failIfMajorPerformanceCaveat: false });
    if (!context) {
      status.textContent = "WebGL 2 unavailable. Try another browser.";
      button.hidden = true;
      return;
    }
    context.getExtension("WEBGL_lose_context")?.loseContext();
    if (location.protocol === "file:") {
      status.textContent = "Open this game through a web server.";
      return;
    }
    starting = true;
    button.disabled = true;
    document.querySelector("#play-label").textContent = "Loading\u2026";
    status.textContent = "";
    const start = performance.now();
    try {
      if (queued) await new Promise((resolve) => {
        grant = resolve;
        parent.postMessage({ type: "apr-game-start" }, "*");
      });
      const { startGame } = await import("./main.js?v=066abae662cbf9fa");
      await startGame({ start });
    } catch (error) {
      console.error("The canyon could not start:", error);
      starting = false;
      button.disabled = false;
      document.querySelector("#play-label").textContent = "Try again";
      status.textContent = "Loading failed. Retry.";
    } finally {
      if (queued) parent.postMessage({ type: "apr-game-end" }, "*");
    }
  });
})();
