import { readFigure } from "./loop-figure.js?v=4e21205885936d83";
import { drawHatchFallback } from "./hatch-fallback.js";
const clamp = (value) => Math.max(0, Math.min(1, value));
const ease = (value) => value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2;
export async function mountStory() {
  const board = document.querySelector("#storyboard");
  const stage = board.querySelector("#story-stage");
  const copy = board.querySelector(".story-copy");
  const canvas = board.querySelector(".story-watermark");
  const items = [...board.querySelectorAll(".capability-item")];
  const definitions = [...board.querySelectorAll(".definition")];
  const poses = [...board.querySelectorAll(".story-pose")];
  const actionFrames = poses.map((pose) => [...pose.querySelectorAll(".story-frame")]);
  const frameHold = 800;
  const frameFade = 150;
  const status = board.querySelector("#story-status");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const fullBox = [0, 0, 3780, 1620];
  const frames = [
    [570, 500, 610, 750],
    [1055, 555, 600, 685],
    [1485, 490, 660, 755],
    [2125, 980, 900, 680],
    [2970, 175, 685, 640]
  ];
  const sample = document.createElement("canvas");
  const input = sample.getContext("2d", { willReadFrequently: true });
  const output = canvas.getContext("2d");
  let reduced = motion.matches;
  let source = null;
  let readable = true;
  let width = 0;
  let height = 0;
  let selected = 0;
  let elapsed = 0;
  let hovered = copy.matches(":hover") && matchMedia("(hover: hover)").matches;
  let focused = board.contains(document.activeElement);
  let inView = false;
  let frameId = 0;
  let lastTick = null;
  let camera = null;
  let currentBox = [...fullBox];
  const duration = () => 8e3;
  function targetBox() {
    const aspect = width / height || 1;
    const [x, y, w, h] = frames[Math.min(selected, 4)];
    const fitWidth = Math.max(w, h * aspect);
    const fitHeight = Math.max(h, w / aspect);
    return [x + w / 2 - fitWidth * 0.71, y + h / 2 - fitHeight * (width <= 760 ? 0.61 : 0.48), fitWidth, fitHeight];
  }
  function renderMap() {
    if (!source || !width || !height) return;
    input.filter = "none";
    input.fillStyle = "white";
    input.fillRect(0, 0, width, height);
    input.filter = "blur(2.5px)";
    const scale = width / currentBox[2];
    input.drawImage(source, -currentBox[0] * scale, -currentBox[1] * scale, 3780 * scale, 1620 * scale);
    let pixels;
    if (readable) {
      try {
        pixels = input.getImageData(0, 0, width, height).data;
      } catch (error) {
        readable = false;
        canvas.dataset.hatchFallback = "true";
        console.warn("Storyboard uses a striped image fallback:", error);
      }
    }
    if (!pixels) {
      drawHatchFallback(output, sample, width, height);
      return;
    }
    const paths = [new Path2D(), new Path2D()];
    const bands = [new Float32Array(Math.ceil(width / 2) + 1), new Float32Array(Math.ceil(width / 2) + 1)];
    for (let y = 2.5; y < height; y += 5) {
      for (let i = 0; i < bands[0].length; i++) {
        const offset = (Math.floor(y) * width + Math.min(i * 2, width - 1)) * 4;
        const r = pixels[offset] / 255;
        const g = pixels[offset + 1] / 255;
        const b = pixels[offset + 2] / 255;
        const yellow = Math.min(clamp((r - b - 0.06) * 10), clamp((g - b - 0.03) * 10));
        const ink = (1 - (0.2126 * r + 0.7152 * g + 0.0722 * b)) * (1 - yellow);
        bands[0][i] = ink < 8e-3 ? 0 : 1.5 * ink ** 0.65;
        bands[1][i] = yellow < 8e-3 ? 0 : 1.5 * yellow ** 0.65;
      }
      bands.forEach((band, channel) => {
        const path = paths[channel];
        path.moveTo(0, y - band[0]);
        for (let i = 1; i < band.length; i++) path.lineTo(i * 2, y - band[i]);
        for (let i = band.length - 1; i >= 0; i--) path.lineTo(i * 2, y + band[i]);
        path.closePath();
      });
    }
    output.clearRect(0, 0, width, height);
    ["#2c557b", "#efd159"].forEach((color, channel) => {
      output.fillStyle = color;
      output.fill(paths[channel]);
    });
  }
  const visible = () => inView && !document.hidden;
  const canAdvance = () => visible() && !motion.matches && !hovered && !focused;
  const canMoveCamera = () => camera && visible() && !motion.matches && (camera.manual || canAdvance());
  const needsTick = () => canAdvance() || canMoveCamera();
  function drawProgress() {
    board.style.setProperty("--progress", motion.matches ? 0 : clamp(elapsed / duration()));
  }
  function drawPose() {
    const sequence = actionFrames[selected];
    const period = frameHold + frameFade;
    const current = Math.min(Math.floor(elapsed / period), sequence.length - 1);
    const blend = current < sequence.length - 1 ? clamp((elapsed % period - frameHold) / frameFade) : 0;
    sequence.forEach((frame, index) => {
      const opacity = motion.matches ? Number(index === sequence.length - 1) : index === current ? 1 - blend : index === current + 1 ? blend : 0;
      const value = String(Math.round(opacity * 1e3) / 1e3);
      if (frame.style.opacity !== value) frame.style.opacity = value;
    });
  }
  function syncClock() {
    if (syncMotion()) return;
    board.dataset.paused = String(!canAdvance());
    board.dataset.pauseReason = document.hidden ? "hidden" : !inView ? "offscreen" : motion.matches ? "reduced-motion" : hovered ? "hover" : focused ? "focus" : "none";
    board.dataset.reducedMotion = String(motion.matches);
    if (needsTick()) {
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
  function moveCamera(manual = false, instant = false) {
    const destination = targetBox();
    if (instant || motion.matches) {
      camera = null;
      currentBox = destination;
      renderMap();
    } else {
      camera = { from: [...currentBox], to: destination, elapsed: 0, duration: 1100, manual };
    }
    syncClock();
  }
  function selectStep(next, { manual = false, instant = false } = {}) {
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
    definitions.forEach((definition, index) => {
      definition.hidden = index !== selected;
    });
    poses.forEach((pose, index) => {
      pose.hidden = index !== selected;
      pose.dataset.current = String(index === selected);
    });
    drawPose();
    drawProgress();
    moveCamera(manual, instant);
  }
  function tick(now) {
    frameId = 0;
    if (syncMotion()) return;
    const delta = lastTick === null ? 0 : Math.min(now - lastTick, 100);
    lastTick = now;
    if (canAdvance()) {
      elapsed += delta;
      if (elapsed >= duration()) selectStep((selected + 1) % items.length);
    }
    if (canMoveCamera()) {
      camera.elapsed += delta;
      const progress = clamp(camera.elapsed / camera.duration);
      const amount = ease(progress);
      currentBox = camera.from.map((start, index) => start + (camera.to[index] - start) * amount);
      renderMap();
      if (progress === 1) camera = null;
    }
    drawPose();
    drawProgress();
    if (needsTick() && !frameId) frameId = requestAnimationFrame(tick);
    else if (!frameId) lastTick = null;
  }
  let parallaxFrame = 0;
  const drawParallax = () => {
    parallaxFrame = 0;
    const box = board.getBoundingClientRect();
    const progress = clamp((innerHeight - box.top) / (innerHeight + box.height));
    stage.style.setProperty("--watermark-shift", `${motion.matches ? 0 : ((progress - 0.5) * 36).toFixed(2)}px`);
  };
  const scheduleParallax = () => {
    if (!parallaxFrame && !document.hidden) parallaxFrame = requestAnimationFrame(drawParallax);
  };
  function syncMotion() {
    if (reduced === motion.matches) return false;
    reduced = motion.matches;
    selectStep(0, { instant: true });
    scheduleParallax();
    return true;
  }
  items.forEach((item, index) => item.querySelector("button").addEventListener("click", (event) => {
    if (event.detail > 0) event.currentTarget.blur();
    focused = board.contains(document.activeElement);
    selectStep(index, { manual: true });
    const label = event.currentTarget.textContent.trim();
    status.textContent = `${label}. ${motion.matches ? "Automatic playback is off." : focused ? "Move focus out of the scene to resume playback." : hovered ? "Move the pointer away from the text to resume playback." : "Playback loops continuously from this step."}`;
  }));
  copy.addEventListener("pointerenter", (event) => {
    if (event.pointerType === "touch") return;
    hovered = true;
    syncClock();
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
  document.addEventListener("visibilitychange", () => {
    syncClock();
    scheduleParallax();
  });
  motion.addEventListener("change", syncMotion);
  new IntersectionObserver((entries) => {
    const entry = entries[entries.length - 1];
    inView = entry.isIntersecting && entry.intersectionRatio >= 0.1;
    syncClock();
  }, { threshold: [0, 0.1] }).observe(board);
  new ResizeObserver(() => {
    width = Math.round(stage.clientWidth);
    height = Math.round(stage.clientHeight);
    const ratio = Math.min(devicePixelRatio || 1, 2);
    sample.width = width;
    sample.height = height;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    output.setTransform(ratio, 0, 0, ratio, 0, 0);
    moveCamera(false, true);
    scheduleParallax();
  }).observe(stage);
  addEventListener("scroll", scheduleParallax, { passive: true });
  addEventListener("resize", scheduleParallax, { passive: true });
  selectStep(selected, { instant: true });
  try {
    const figure = await readFigure();
    const decoded = new Image();
    decoded.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(figure));
    await decoded.decode();
    await document.fonts.ready;
    source = decoded;
    renderMap();
    board.dataset.ready = "true";
  } catch (error) {
    board.dataset.error = "true";
    status.textContent = "The animated background could not load. The capability controls and original figure remain available.";
    console.error("Storyboard:", error);
  }
}
