import { drawHatchFallback } from "./hatch-fallback.js";
const clamp = (value) => Math.max(0, Math.min(1, value));
const SCENES = {
  fidelity_cables: { cx: 800, cy: 540, zoom: 2 },
  fidelity_fluid: {
    cx: 800,
    cy: 650,
    zoom: 2.5,
    flows: [{ x0: 774, x1: 812, y0: 580, y1: 702, speed: 70, wave: 24 }]
  },
  complexity_gears: {
    cx: 890,
    cy: 545,
    zoom: 2.2,
    // Each gear is seen at an angle: its outline is an ellipse about 0.9 as wide
    // as it is tall. Only the tooth band turns; the lever, the paw and the arrow
    // over the small gear stay where they are.
    gears: [
      { x: 787, y: 532, r0: 118, r1: 166, squash: 0.9, speed: 0.2 },
      { x: 1002, y: 561, r0: 96, r1: 142, squash: 0.9, speed: -0.2 * 158 / 133 }
    ],
    still: [
      [[596, 584], [800, 510], [808, 540], [604, 614]],
      [[672, 536], [728, 536], [728, 604], [672, 604]],
      [[928, 440], [960, 426], [1e3, 422], [1042, 428], [1078, 443], [1104, 466], [1100, 488], [1072, 470], [1038, 452], [1e3, 444], [962, 448], [934, 462]]
    ]
  },
  complexity_assembly: { cx: 800, cy: 570, zoom: 2 },
  grounding_tolerance: { cx: 760, cy: 660, zoom: 2.7 },
  // The collapse frame is live SVG; its echo is the intact structure (t = 0),
  // so the falling blocks play against the structure as it stood.
  collapse_echo: { cx: 820, cy: 600, zoom: 2, src: "assets/nearterm/collapse_echo.png?v=51cb0f7bd24b26d9" },
  grounding_budget: {
    cx: 718,
    cy: 190,
    zoom: 2.4,
    flows: [{ x0: 708, x1: 728, y0: 176, y1: 262, speed: 26, wave: 10 }]
  }
};
export function createEcho(board, options = {}) {
  const stage = options.stage || board.querySelector(".near-stage");
  const [sourceWidth, sourceHeight] = options.sourceSize || [1600, 1e3];
  const canvas = document.createElement("canvas");
  canvas.className = options.className || "near-echo";
  canvas.setAttribute("aria-hidden", "true");
  stage.prepend(canvas);
  const output = canvas.getContext("2d");
  const sample = document.createElement("canvas");
  const input = sample.getContext("2d", { willReadFrequently: true });
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let width = 0, height = 0, anchor = [0, 0, 1], current = null, lastDraw = -1e9, drawnKey = "";
  let readable = true, lastUpdate = null;
  function resize() {
    const area = stage.getBoundingClientRect();
    width = Math.max(1, Math.round(area.width));
    height = Math.max(1, Math.round(area.height));
    canvas.width = sample.width = width;
    canvas.height = sample.height = height;
    anchor = [width * 0.6, height * 0.46, width / sourceWidth];
    drawnKey = "";
    if (lastUpdate) update(...lastUpdate);
  }
  new ResizeObserver(resize).observe(stage);
  resize();
  const images = {};
  Object.entries(SCENES).forEach(([name, scene]) => {
    if (options.sceneForFrame || !scene.src) return;
    const image = new Image();
    image.decoding = "async";
    image.addEventListener("load", () => {
      if (lastUpdate) update(...lastUpdate);
    });
    image.src = scene.src;
    images[name] = image;
  });
  function sceneOf(frame) {
    if (options.sceneForFrame) return options.sceneForFrame(frame);
    if (frame?.classList.contains("near-collapse")) {
      const image = images.collapse_echo;
      return image.complete && image.naturalWidth ? { name: "collapse_echo", image, ...SCENES.collapse_echo } : null;
    }
    const match = (frame?.getAttribute("src") || "").match(/nearterm\/([a-z_]+)\.png/);
    return match && SCENES[match[1]] && frame.complete && frame.naturalWidth ? { name: match[1], image: frame, ...SCENES[match[1]] } : null;
  }
  function render(scene, seconds) {
    const scale = anchor[2] * scene.zoom;
    const drift = motion.matches ? 0 : Math.sin(seconds * 0.35) * 14;
    const ox = anchor[0] - scene.cx * scale + drift;
    const oy = anchor[1] - scene.cy * scale + drift * 0.4;
    input.setTransform(1, 0, 0, 1, 0, 0);
    input.filter = "none";
    input.fillStyle = "white";
    input.fillRect(0, 0, width, height);
    input.filter = "blur(2px)";
    input.setTransform(scale, 0, 0, scale, ox, oy);
    input.drawImage(scene.image, 0, 0, sourceWidth, sourceHeight);
    (scene.gears || []).forEach((gear) => {
      const angle = motion.matches ? 0 : seconds * gear.speed;
      const ring = () => {
        input.beginPath();
        input.ellipse(gear.x, gear.y, gear.r1 * gear.squash, gear.r1, 0, 0, Math.PI * 2);
        input.ellipse(gear.x, gear.y, gear.r0 * gear.squash, gear.r0, 0, 0, Math.PI * 2, true);
      };
      input.save();
      ring();
      input.clip("evenodd");
      input.filter = "none";
      input.fillStyle = "white";
      input.fillRect(gear.x - gear.r1, gear.y - gear.r1, gear.r1 * 2, gear.r1 * 2);
      input.filter = "blur(2px)";
      input.translate(gear.x, gear.y);
      input.scale(gear.squash, 1);
      input.rotate(angle);
      input.scale(1 / gear.squash, 1);
      input.translate(-gear.x, -gear.y);
      input.drawImage(scene.image, 0, 0, sourceWidth, sourceHeight);
      input.restore();
    });
    (scene.still || []).forEach((polygon) => {
      input.save();
      input.beginPath();
      polygon.forEach(([x, y], i) => i ? input.lineTo(x, y) : input.moveTo(x, y));
      input.closePath();
      input.clip();
      input.filter = "none";
      input.fillStyle = "white";
      input.fillRect(0, 0, sourceWidth, sourceHeight);
      input.filter = "blur(2px)";
      input.drawImage(scene.image, 0, 0, sourceWidth, sourceHeight);
      input.restore();
    });
    input.setTransform(1, 0, 0, 1, 0, 0);
    let pixels;
    if (readable) {
      try {
        pixels = input.getImageData(0, 0, width, height).data;
      } catch (error) {
        readable = false;
        canvas.dataset.hatchFallback = "true";
        console.warn("Scene echo uses a striped image fallback:", error);
      }
    }
    if (!pixels) {
      drawHatchFallback(output, sample, width, height);
      return;
    }
    const flows = (scene.flows || []).map((flow) => ({
      x0: ox + flow.x0 * scale,
      x1: ox + flow.x1 * scale,
      y0: oy + flow.y0 * scale,
      y1: oy + flow.y1 * scale,
      phase: motion.matches ? 0 : seconds * flow.speed * scale,
      wave: flow.wave * scale
    }));
    const paths = [new Path2D(), new Path2D()];
    const count = Math.ceil(width / 2) + 1;
    const bands = [new Float32Array(count), new Float32Array(count)];
    for (let y = 2.5; y < height; y += 5) {
      for (let i = 0; i < count; i++) {
        const x = Math.min(i * 2, width - 1);
        const offset = (Math.floor(y) * width + x) * 4;
        const r = pixels[offset] / 255, g = pixels[offset + 1] / 255, b = pixels[offset + 2] / 255;
        const yellow = Math.min(clamp((r - b - 0.06) * 10), clamp((g - b - 0.03) * 10));
        let ink = (1 - (0.2126 * r + 0.7152 * g + 0.0722 * b)) * (1 - yellow);
        let gain = 1;
        for (const flow of flows) {
          if (x >= flow.x0 && x <= flow.x1 && y >= flow.y0 && y <= flow.y1) {
            gain = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin((y - flow.y0 - flow.phase) / flow.wave * Math.PI * 2));
          }
        }
        bands[0][i] = ink < 8e-3 ? 0 : 1.5 * (ink * gain) ** 0.65;
        bands[1][i] = yellow < 8e-3 ? 0 : 1.5 * (yellow * gain) ** 0.65;
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
  function update(frame, local, hold, blend, now) {
    lastUpdate = [frame, local, hold, blend, now];
    const scene = sceneOf(frame);
    const fadeIn = motion.matches ? 1 : clamp(local / 350);
    canvas.style.opacity = scene ? String(Math.round(fadeIn * (1 - blend) * 1e3) / 1e3) : "0";
    if (!scene) {
      current = null;
      return;
    }
    const key = `${scene.name}:${width}x${height}`;
    const interval = motion.matches ? Infinity : scene.gears || scene.flows ? 40 : 100;
    if (key === drawnKey && now - lastDraw < interval) return;
    current = scene;
    lastDraw = now;
    drawnKey = key;
    render(scene, now / 1e3);
  }
  stage.addEventListener("load", () => {
    if (lastUpdate) update(...lastUpdate);
  }, true);
  function hide() {
    canvas.style.opacity = "0";
    current = null;
    lastUpdate = null;
  }
  const ready = Promise.allSettled(Object.values(images).map((image) => image.decode()));
  return { update, hide, ready };
}
