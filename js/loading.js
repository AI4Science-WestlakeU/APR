(() => {
  const limit = 3, jobs = [], running = /* @__PURE__ */ new Map(), imageJobs = /* @__PURE__ */ new WeakMap();
  const groups = /* @__PURE__ */ new Map(), registrations = [], critical = [];
  const metrics = { limit, active: 0, peak: 0, firstScreenAt: null, records: [] };
  let firstScreen = false, idle = 0, scanning = false;
  let resolveFirst;
  const ready = new Promise((resolve) => {
    resolveFirst = resolve;
  });
  const owner = (element) => element?.closest?.("section,footer") || element;
  const distance = (element) => {
    const box = owner(element)?.getBoundingClientRect();
    return box ? Math.max(0, box.top - innerHeight, -box.bottom) : 0;
  };
  const near = (element) => distance(element) <= innerHeight;
  const assetURL = (value) => value.startsWith("apr-asset:") ? window.__apr.url(value.slice(10)) : value;
  function pump() {
    jobs.sort((a, b) => (a.critical ? -1e9 : a.urgent ? -1e8 : distance(a.element)) - (b.critical ? -1e9 : b.urgent ? -1e8 : distance(b.element)) || a.order - b.order);
    while (metrics.active < limit && jobs.length && (firstScreen || jobs[0].critical)) {
      const job = jobs.shift();
      metrics.active++;
      metrics.peak = Math.max(metrics.peak, metrics.active);
      const record = { key: job.key, kind: job.kind, start: performance.now(), end: null };
      metrics.records.push(record);
      Promise.resolve().then(job.work).then((value) => {
        if (job.kind === "decode" && value) Object.assign(record, value);
        job.resolve(value);
      }, (error) => {
        record.error = String(error);
        job.reject(error);
      }).finally(() => {
        record.end = performance.now();
        metrics.active--;
        running.delete(job.key);
        pump();
        idlePrefetch();
      });
    }
  }
  let sequence = 0;
  function run(element, key, work, options = {}) {
    if (running.has(key)) return running.get(key);
    const promise = new Promise((resolve, reject) => {
      jobs.push({ element, key, work, resolve, reject, order: sequence++, kind: options.kind || "init", critical: !!options.critical, urgent: !!options.urgent });
    });
    running.set(key, promise);
    pump();
    return promise;
  }
  let imageNumber = 0;
  function image(element, isCritical = false) {
    if (imageJobs.has(element)) return imageJobs.get(element);
    const promise = run(element, "image-" + imageNumber++, async () => {
      let decoded = element;
      if (element.localName === "image") {
        const ref = element.getAttribute("data-load-href") || element.getAttribute("href");
        if (!ref) return;
        decoded = new Image();
        decoded.decoding = "async";
        decoded.fetchPriority = isCritical ? "high" : near(element) ? "auto" : "low";
        decoded.src = assetURL(ref);
        await decoded.decode();
        element.setAttribute("href", decoded.src);
        element.removeAttribute("data-load-href");
      } else {
        for (const source of element.parentElement?.querySelectorAll("source[data-load-srcset]") || []) {
          source.srcset = assetURL(source.dataset.loadSrcset);
          delete source.dataset.loadSrcset;
        }
        element.loading = "eager";
        element.decoding = "async";
        element.fetchPriority = isCritical ? "high" : near(element) ? "auto" : "low";
        if (element.dataset.loadSrc) {
          element.src = assetURL(element.dataset.loadSrc);
          delete element.dataset.loadSrc;
        }
        await element.decode();
      }
      element.dataset.loadReady = "true";
      return { width: decoded.naturalWidth, height: decoded.naturalHeight };
    }, { critical: isCritical, kind: "decode" }).catch((error) => {
      element.dataset.loadError = "true";
      console.warn("Image remains in its reserved slot:", error);
    });
    imageJobs.set(element, promise);
    return promise;
  }
  function images(element, isCritical = false) {
    return [...element.querySelectorAll("img[data-load-src],image[data-load-href]")].map((node) => image(node, isCritical));
  }
  function activate(registration) {
    if (registration.active) return;
    registration.active = true;
    const waits = registration.options.images === false ? [] : images(registration.element, registration.options.critical);
    Promise.all(waits).then(() => run(registration.element, registration.key, registration.work, registration.options)).then(
      (value) => {
        registration.element?.removeAttribute("aria-busy");
        registration.resolve(value);
      },
      (error) => {
        registration.element?.removeAttribute("aria-busy");
        registration.reject(error);
      }
    );
  }
  function when(element, key, work, options = {}) {
    if (!element) return Promise.resolve();
    let registration;
    const promise = new Promise((resolve, reject) => {
      registration = { element, key, work, options, resolve, reject, active: false };
    });
    registrations.push(registration);
    element.setAttribute("aria-busy", "true");
    if (options.critical) {
      critical.push(promise);
      activate(registration);
    } else if (firstScreen && near(element)) activate(registration);
    return promise;
  }
  function loadGroup(group) {
    if (!group || group.active) return;
    group.active = true;
    images(group.element);
    registrations.filter((reg) => owner(reg.element) === group.element).forEach(activate);
  }
  function scan() {
    scanning = false;
    if (!firstScreen) return;
    groups.forEach((group) => {
      if (near(group.element)) loadGroup(group);
    });
    registrations.forEach((reg) => {
      if (near(reg.element)) activate(reg);
    });
    pump();
    idlePrefetch();
  }
  function scheduleScan() {
    if (!scanning) {
      scanning = true;
      requestAnimationFrame(scan);
    }
  }
  function idlePrefetch() {
    if (!firstScreen || idle || jobs.length || metrics.active || document.hidden) return;
    const next = [...groups.values()].filter((group) => !group.active).sort((a, b) => distance(a.element) - distance(b.element))[0];
    if (!next) return;
    const callback = () => {
      idle = 0;
      if (!document.hidden) {
        loadGroup(next);
        pump();
        idlePrefetch();
      }
    };
    idle = window.requestIdleCallback ? requestIdleCallback(callback) : setTimeout(callback, 100);
  }
  async function start() {
    for (const element of document.querySelectorAll("section,footer")) groups.set(element, { element, active: false });
    const primary = [...document.querySelectorAll("#top img,#problem img,#problem image")].map((element) => image(element, true));
    await Promise.allSettled([...primary, ...critical, document.fonts.ready]);
    metrics.firstScreenAt = performance.now();
    resolveFirst();
    requestAnimationFrame(() => {
      firstScreen = true;
      if ("IntersectionObserver" in window) {
        const observer = new IntersectionObserver((entries) => {
          entries.filter((entry) => entry.isIntersecting).forEach((entry) => loadGroup(groups.get(entry.target)));
          pump();
        }, { rootMargin: `${innerHeight}px 0px` });
        groups.forEach((group) => observer.observe(group.element));
      }
      scan();
    });
  }
  window.aprLoad = { when, run, image, ready, metrics, get pending() {
    return jobs.length;
  } };
  addEventListener("scroll", scheduleScan, { passive: true });
  addEventListener("resize", scheduleScan, { passive: true });
  document.addEventListener("visibilitychange", scheduleScan);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
