import { createEcho } from "./nearterm-echo.js?v=cb240510343fb7ac";
const board = document.querySelector("#missions-board");
window.aprLoad.when(board, "missions", () => {
  const copy = board.querySelector(".missions-copy");
  const items = [...board.querySelectorAll(".capability-item")];
  const panes = [...board.querySelectorAll(".missions-pane")];
  const frames = [...board.querySelectorAll(".missions-ai4e .missions-frame")];
  const art = board.querySelector(".missions-ai4e");
  const crops = {
    "ai4e-scene1": { cx: 620, cy: 570, zoom: 2.1 },
    "ai4e-scene2": { cx: 535, cy: 635, zoom: 2.25 }
  };
  const echo = createEcho(board, {
    stage: art,
    className: "missions-echo",
    sourceSize: [1024, 1024],
    sceneForFrame(frame) {
      const image = frame?.querySelector("img");
      const name = image?.getAttribute("src").match(/missions\/(ai4e-scene[12])\.png/)?.[1];
      return name && image.complete && image.naturalWidth ? { name: image.currentSrc || image.src, image, ...crops[name] } : null;
    }
  });
  const status = board.querySelector(".missions-status");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const durations = [12e3, 12e3];
  const fade = 450;
  const clamp = (value) => Math.max(0, Math.min(1, value));
  let selected = 0, elapsed = 0, frameId = 0, lastTick = null, inView = false;
  let hovered = copy.matches(":hover") && matchMedia("(hover: hover)").matches;
  let focused = board.contains(document.activeElement);
  const canAdvance = () => inView && !document.hidden && !motion.matches && !hovered && !focused;
  function draw() {
    board.style.setProperty("--progress", motion.matches ? 0 : clamp(elapsed / durations[selected]));
    if (selected === 1) {
      const half = durations[1] / 2;
      const blend = motion.matches ? 0 : clamp((elapsed % half - (half - fade)) / fade);
      const current = motion.matches ? 0 : Math.floor(elapsed / half) % 2;
      frames.forEach((frame, index) => {
        const opacity = index === current ? 1 - blend : index === (current + 1) % 2 ? blend : 0;
        frame.style.opacity = String(Math.round(opacity * 1e3) / 1e3);
      });
      echo.update(frames[current], elapsed % half, half, blend, performance.now());
    } else {
      echo.hide();
    }
  }
  function syncClock() {
    board.dataset.paused = String(!canAdvance());
    if (canAdvance()) {
      if (!frameId) {
        lastTick = null;
        frameId = requestAnimationFrame(tick);
      }
    } else {
      cancelAnimationFrame(frameId);
      frameId = 0;
      lastTick = null;
    }
  }
  function selectStep(next) {
    selected = next;
    elapsed = 0;
    board.dataset.step = String(selected);
    items.forEach((item, index) => {
      const active = index === selected;
      item.dataset.active = String(active);
      const button = item.querySelector("button");
      if (active) {
        item.setAttribute("aria-current", "step");
        button.setAttribute("aria-current", "step");
      } else {
        item.removeAttribute("aria-current");
        button.removeAttribute("aria-current");
      }
    });
    panes.forEach((pane, index) => {
      pane.hidden = index !== selected;
    });
    draw();
    syncClock();
  }
  function tick(now) {
    frameId = 0;
    const delta = lastTick === null ? 0 : Math.min(now - lastTick, 100);
    lastTick = now;
    if (canAdvance()) {
      elapsed += delta;
      if (elapsed >= durations[selected]) selectStep((selected + 1) % items.length);
    }
    draw();
    if (canAdvance() && !frameId) frameId = requestAnimationFrame(tick);
    else if (!frameId) lastTick = null;
  }
  items.forEach((item, index) => item.querySelector("button").addEventListener("click", (event) => {
    if (event.detail > 0) event.currentTarget.blur();
    focused = board.contains(document.activeElement);
    selectStep(index);
    status.textContent = `${event.currentTarget.textContent.trim()}. ${motion.matches ? "Automatic playback is off." : "Playback loops continuously from this mission."}`;
  }));
  copy.addEventListener("pointerenter", (event) => {
    if (event.pointerType !== "touch") {
      hovered = true;
      syncClock();
    }
  });
  copy.addEventListener("pointerleave", () => {
    hovered = false;
    syncClock();
  });
  board.addEventListener("focusin", () => {
    focused = true;
    syncClock();
  });
  board.addEventListener("focusout", () => queueMicrotask(() => {
    focused = board.contains(document.activeElement);
    syncClock();
  }));
  document.addEventListener("visibilitychange", syncClock);
  motion.addEventListener("change", () => selectStep(selected));
  frames.forEach((frame) => {
    const image = frame.querySelector("img");
    const ready = () => image.decode().then(() => {
      image.dataset.imageReady = "true";
      draw();
    }).catch(() => {
    });
    image.addEventListener("load", ready);
    if (image.complete && image.naturalWidth) ready();
  });
  new ResizeObserver(draw).observe(art);
  new IntersectionObserver((entries) => {
    const entry = entries[entries.length - 1];
    inView = entry.isIntersecting && entry.intersectionRatio >= 0.1;
    syncClock();
  }, { threshold: [0, 0.1] }).observe(board);
  selectStep(0);
  board.dataset.ready = "true";
}).catch((error) => console.warn("Mission poster remains visible:", error));
