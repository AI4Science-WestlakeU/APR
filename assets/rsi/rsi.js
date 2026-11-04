(() => {
  "use strict";
  const base = new URL(".", document.currentScript.src);
  const query = new URL(document.currentScript.src).search;
  const hosts = [...document.querySelectorAll("[data-apr-rsi]")].filter((host) => !host.dataset.rsiLoading && !host.dataset.rsiReady);
  if (!hosts.length) return;
  hosts.forEach((host) => {
    host.dataset.rsiLoading = "true";
  });
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  function mount(host, fragment) {
    const stage = document.createElement("div");
    stage.innerHTML = fragment;
    const svg = stage.querySelector(".apr-rsi__art");
    const prefix = "apr-rsi-" + crypto.randomUUID() + "-";
    const ids = new Map([...svg.querySelectorAll("[id]")].map((node) => [node.id, prefix + node.id]));
    svg.querySelectorAll("*").forEach((node) => {
      for (const attr of [...node.attributes]) {
        const value = attr.value.replace(/url\(#([^)]*)\)/g, (match, id) => ids.has(id) ? "url(#" + ids.get(id) + ")" : match);
        if (value !== attr.value) node.setAttribute(attr.name, value);
      }
      if (node.id) node.id = ids.get(node.id);
    });
    const images = [...svg.querySelectorAll("image")].map((node) => new Promise((resolve, reject) => {
      const url = new URL(node.getAttribute("href"), base).href;
      node.setAttribute("href", url);
      const image = new Image();
      image.onload = resolve;
      image.onerror = () => reject(new Error("RSI image could not load: " + url));
      image.src = url;
    }));
    return Promise.all(images).then(() => {
      const particles = [...svg.querySelectorAll(".apr-rsi__particle")].map((node) => {
        const path = svg.querySelector('path[data-route="' + node.dataset.route + '"]');
        return { node, path, length: path.getTotalLength(), phase: Number(node.dataset.phase) };
      });
      let frame = 0, last = 0, elapsed = 0;
      function render() {
        particles.forEach((p) => {
          const progress = (elapsed / 12e3 + p.phase) % 1;
          const point = p.path.getPointAtLength(progress * p.length);
          p.node.setAttribute("transform", "translate(" + point.x + " " + point.y + ")");
          p.node.dataset.progress = progress.toFixed(5);
        });
        svg.dataset.elapsed = elapsed.toFixed(1);
      }
      function tick(now) {
        if (!host.isConnected) {
          cleanup();
          return;
        }
        if (last) elapsed += Math.min(now - last, 100);
        last = now;
        render();
        frame = requestAnimationFrame(tick);
      }
      function sync() {
        cancelAnimationFrame(frame);
        last = 0;
        const fixed = media.matches || host.hasAttribute("data-rsi-static");
        svg.dataset.motion = fixed ? "reduced" : document.hidden ? "hidden" : "running";
        render();
        if (!fixed && !document.hidden) frame = requestAnimationFrame(tick);
      }
      function cleanup() {
        cancelAnimationFrame(frame);
        media.removeEventListener("change", sync);
        document.removeEventListener("visibilitychange", sync);
      }
      media.addEventListener("change", sync);
      document.addEventListener("visibilitychange", sync);
      host.replaceChildren(...stage.childNodes);
      sync();
      delete host.dataset.rsiLoading;
      host.dataset.rsiReady = "true";
      host.dispatchEvent(new CustomEvent("apr-rsi:ready"));
    });
  }
  const variants = { imagegen: "fragment-imagegen.html", native: "fragment-native.html" };
  const requests = /* @__PURE__ */ new Map();
  function load(host) {
    const file = variants[host.dataset.rsiHero] || "fragment.html";
    if (!requests.has(file)) requests.set(file, fetch(new URL(file + query, base)).then((response) => {
      if (!response.ok) throw new Error("RSI fragment returned HTTP " + response.status);
      return response.text();
    }));
    return requests.get(file).then((fragment) => mount(host, fragment));
  }
  Promise.all(hosts.map((host, index) => window.aprLoad ? window.aprLoad.when(host, "rsi-" + index, () => load(host)) : load(host))).catch((error) => {
    hosts.filter((host) => !host.dataset.rsiReady).forEach((host) => {
      delete host.dataset.rsiLoading;
      host.dataset.rsiError = "load";
    });
    console.error(error);
  });
})();
