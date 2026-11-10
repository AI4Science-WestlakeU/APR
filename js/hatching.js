"use strict";
(() => {
  const baseSpacing = 5;
  const baseMaxWidth = 3;
  const baseBlur = 2.5;
  const owners = [...document.querySelectorAll("[data-hatch]")];
  const pending = /* @__PURE__ */ new Set();
  const sizes = /* @__PURE__ */ new WeakMap();
  let frame = 0;
  function render(owner) {
    const image = owner.querySelector("img");
    if (!image.complete || !image.naturalWidth) return;
    const width = Math.round(image.clientWidth);
    const height = Math.round(image.clientHeight);
    if (!width || !height) return;
    const ratio = Math.min(devicePixelRatio || 1, 3);
    const fine = Math.max(0.55, Math.min(1, width / 900));
    const spacing = baseSpacing * fine;
    const maxWidth = baseMaxWidth * fine;
    const blur = baseBlur * fine;
    const step = fine < 1 ? 1 : 2;
    const style = getComputedStyle(image);
    const key = `${width},${height},${ratio},${style.objectPosition}`;
    if (sizes.get(owner) === key) return;
    const sample = document.createElement("canvas");
    sample.width = width;
    sample.height = height;
    const input = sample.getContext("2d", { willReadFrequently: true });
    input.fillStyle = "white";
    input.fillRect(0, 0, width, height);
    input.filter = owner.classList.contains("footer-art") ? "none" : `blur(${blur}px)`;
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const drawnWidth = image.naturalWidth * scale;
    const drawnHeight = image.naturalHeight * scale;
    const position = style.objectPosition.split(" ").map((value) => parseFloat(value) / 100);
    input.drawImage(image, (width - drawnWidth) * position[0], (height - drawnHeight) * position[1], drawnWidth, drawnHeight);
    let pixels;
    try {
      pixels = input.getImageData(0, 0, width, height).data;
    } catch (error) {
      owner.querySelector("canvas")?.remove();
      owner.classList.remove("hatch-ready");
      owner.classList.add("hatch-fallback");
      sizes.set(owner, key);
      console.warn("Watermark uses its original image:", error);
      return;
    }
    const canvas = owner.querySelector("canvas") || document.createElement("canvas");
    canvas.className = "hatch-canvas";
    canvas.setAttribute("aria-hidden", "true");
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const output = canvas.getContext("2d");
    output.scale(ratio, ratio);
    const paths = [new Path2D(), new Path2D()];
    const clamp = (value) => Math.max(0, Math.min(1, value));
    const knockout = owner.classList.contains("footer-art") && (owner.dataset.hatchMode === "knockout" || new URLSearchParams(location.search).get("footer") === "knockout");
    let rampTop = 0, rampBottom = height;
    if (knockout) {
      const frameBox = owner.closest(".footer-frame").getBoundingClientRect();
      const artBox = owner.getBoundingClientRect();
      rampTop = frameBox.top - artBox.top;
      rampBottom = frameBox.bottom - artBox.top;
      owner.closest(".footer").classList.add("footer-knockout");
    }
    for (let y = spacing / 2; y < height; y += spacing) {
      const bands = [[], []];
      for (let x = 0; x <= width; x += step) {
        const pixel = (Math.floor(y) * width + Math.min(x, width - 1)) * 4;
        const r = pixels[pixel] / 255;
        const g = pixels[pixel + 1] / 255;
        const b = pixels[pixel + 2] / 255;
        const yellow = Math.min(clamp((r - b - 0.06) * 10), clamp((g - b - 0.03) * 10));
        const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const densities = knockout ? [clamp((y - rampTop) / (rampBottom - rampTop)) ** 1.35 * clamp(gray * 1.25 - 0.25), 0] : [(1 - gray) * (1 - yellow), yellow];
        densities.forEach((density, index) => {
          const half = density < 8e-3 ? 0 : knockout ? 3.6 * density / 2 : maxWidth * density ** 0.65 / 2;
          bands[index].push([x, half]);
        });
      }
      bands.forEach((points, index) => {
        const path = paths[index];
        path.moveTo(0, y - points[0][1]);
        points.forEach(([x, half]) => path.lineTo(x, y - half));
        for (let i = points.length - 1; i >= 0; i--) path.lineTo(points[i][0], y + points[i][1]);
        path.closePath();
      });
    }
    ["#2c557b", "#EFD159"].forEach((color, index) => {
      output.fillStyle = color;
      output.fill(paths[index]);
    });
    if (owner.classList.contains("footer-art") && !knockout) {
      output.globalAlpha = 0.16;
      output.globalCompositeOperation = "destination-over";
      output.drawImage(image, 0, 0, width, height);
    }
    if (!canvas.isConnected) owner.append(canvas);
    owner.classList.add("hatch-ready");
    sizes.set(owner, key);
  }
  function schedule(owner) {
    if (owner.classList.contains("hatch-fallback")) return;
    pending.add(owner);
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      for (const item of pending) {
        window.aprLoad.run(item, "hatch-" + owners.indexOf(item), () => render(item)).catch((error) => console.warn("Watermark rendering:", error));
      }
      pending.clear();
    });
  }
  const observer = new ResizeObserver((entries) => {
    entries.forEach((entry) => schedule(entry.target.closest("[data-hatch]")));
  });
  owners.forEach((owner) => {
    const image = owner.querySelector("img");
    observer.observe(image);
    image.addEventListener("load", () => schedule(owner));
    schedule(owner);
  });
  addEventListener("resize", () => owners.forEach(schedule), { passive: true });
})();
