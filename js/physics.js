"use strict";
window.aprLoad.when(document.querySelector(".physics-figure"), "verification", async () => {
  const figure = document.querySelector(".physics-figure");
  let simulation;
  try {
    const response = await fetch(figure.dataset.simulation);
    if (!response.ok) return;
    simulation = await response.json();
  } catch {
    return;
  }
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = motion.matches;
  const panels = [...figure.querySelectorAll(".physics-panel")];
  const times = panels.map(() => 0);
  let inView = false;
  let request = 0;
  let previous = null;
  const pointList = (points) => points.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`).join(" ");
  const clamp = (n) => Math.max(0, Math.min(1, n));
  const mix = (a, b, t) => a + (b - a) * t;
  const beam = figure.querySelector("#beam");
  const square = figure.querySelector("#beam-block");
  const cue = figure.querySelector("#tip-cue");
  const labels = [...figure.querySelectorAll("[data-beam-step]")];
  const mascot = figure.querySelector("#beam-mascot");
  const exclamation = figure.querySelector("#exclamation-cue");
  const wobble = (elapsed, amplitude, duration = 1.1) => {
    if (reduced || elapsed < 0 || elapsed >= duration) return 0;
    return amplitude * Math.sin(elapsed / duration * Math.PI * 6) * (1 - elapsed / duration);
  };
  const drawBeam = (seconds) => {
    const t = seconds % 6.4;
    const fall = clamp((t - 1) / 1.4);
    const slide = clamp((t - 2.4) / 1.25);
    const tip = clamp((t - 3.65) / 0.7);
    const scale = 29, length = 7.8, thickness = 1, side = 1.7;
    const pivot = [270.6, 157.4];
    const angle = Math.asin(4.4 / 6.4) * fall * fall;
    const convert = ([x, y]) => [pivot[0] + x * scale, pivot[1] - y * scale];
    const rotate = (x, y, a = angle) => [x * Math.cos(a) + y * Math.sin(a), -x * Math.sin(a) + y * Math.cos(a)];
    beam.setAttribute("points", pointList([[-1.4, 0], [length - 1.4, 0], [length - 1.4, thickness], [-1.4, thickness]].map(([x, y]) => convert(rotate(x, y)))));
    const initialCenter = length / 2 - 1.4;
    const edgeCenter = 6.4 + side / 2 - 1.25;
    const travel = 0.18 * fall * fall + 0.82 * slide;
    const centerAlong = mix(initialCenter, edgeCenter, travel);
    const blockAngle = angle + tip * Math.PI / 12;
    let center;
    if (tip > 0) {
      const edge = rotate(6.4, thickness);
      const offset = rotate(side / 2 - 1.25, side / 2, blockAngle);
      center = [edge[0] + offset[0], edge[1] + offset[1]];
    } else center = rotate(centerAlong, thickness + side / 2);
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => {
      const p = rotate(x * side / 2, y * side / 2, blockAngle);
      return convert([center[0] + p[0], center[1] + p[1]]);
    });
    square.setAttribute("points", pointList(corners));
    cue.setAttribute("opacity", String(tip));
    const activeStep = t < 1 ? "matched" : t < 2.4 ? "running" : "failed";
    labels.forEach((label) => {
      label.dataset.active = String(label.dataset.beamStep === activeStep);
    });
    const pose = fall > 0.2 ? "startled_right_three_quarter_right" : "reach_place_three_quarter_right";
    const href = `assets/poses/${pose}.png`;
    if (mascot.getAttribute("href") !== href) mascot.setAttribute("href", href);
    exclamation.setAttribute("opacity", fall > 0.2 ? "1" : "0");
    exclamation.setAttribute("transform", `translate(45 70) rotate(${16 + wobble(t - 1.28, 12)})`);
    panels[0].dataset.step = activeStep;
    panels[0].dataset.phase = tip > 0 ? "tipping" : slide > 0 ? "sliding" : fall > 0 ? "falling" : "matched";
    panels[0].dataset.time = t.toFixed(3);
  };
  const worldScale = 350, floor = 200, origins = [180, 482];
  const ids = Object.keys(simulation.reference_poses);
  const groups = [figure.querySelector("#simplified-blocks"), figure.querySelector("#realistic-blocks")];
  const blocks = groups.map((group) => ids.map((id) => {
    return group.querySelector(`[data-block="${id}"]`);
  }));
  const gap = figure.querySelector("#gap-cue");
  const puzzled = figure.querySelector("#puzzled-mascot");
  const pullMascot = figure.querySelector("#pull-mascot");
  const question = figure.querySelector("#question-cue");
  const drawPull = (seconds) => {
    const time = clamp((seconds % 5.5 - 0.8) / 2.5);
    const frames = simulation.frames;
    const index = Math.min(frames.length - 1, Math.round(time / simulation.parameters.sample_interval_s));
    const frame = frames[index];
    frame.blocks.forEach((pose2, i) => {
      const id = pose2.id;
      const reference = simulation.reference_poses[id];
      const simplified = id === "support" ? [pose2.x_m, pose2.y_m, pose2.angle_rad] : reference;
      [simplified, [pose2.x_m, pose2.y_m, pose2.angle_rad]].forEach(([x, y, angle], group) => {
        blocks[group][i].setAttribute("transform", `translate(${origins[group] + x * worldScale} ${floor - y * worldScale}) rotate(${-angle * 180 / Math.PI})`);
        blocks[group][i].setAttribute("fill", id === "support" ? "#c86f42" : group && pose2.affected ? "#eac8b6" : "white");
      });
    });
    const release = simulation.parameters.pull_distance_m / simulation.parameters.pull_speed_m_s;
    const removed = time > release;
    const reactionTime = seconds % 5.5 - (0.8 + release * 2.5);
    const pose = removed ? "puzzled_right_three_quarter_right" : "reach_place_three_quarter_right";
    const href = `assets/poses/${pose}.png`;
    if (pullMascot.getAttribute("href") !== href) pullMascot.setAttribute("href", href);
    gap.setAttribute("opacity", removed ? "1" : "0");
    question.setAttribute("opacity", removed ? "1" : "0");
    question.setAttribute("transform", `translate(45 70) rotate(${-16 + wobble(reactionTime, 10)})`);
    puzzled.setAttribute("transform", `rotate(${wobble(reactionTime, 1.8, 1.5)} 39 195)`);
    panels[1].dataset.frame = String(index);
    panels[1].dataset.time = (seconds % 5.5).toFixed(3);
  };
  const renders = [drawBeam, drawPull];
  const runnable = () => inView && !reduced && !document.hidden;
  const tick = (now) => {
    request = 0;
    if (!runnable()) {
      previous = null;
      return;
    }
    const delta = previous === null ? 0 : Math.min((now - previous) / 1e3, 0.05);
    previous = now;
    times.forEach((time, i) => {
      times[i] = time + delta;
      renders[i](times[i]);
    });
    request = requestAnimationFrame(tick);
  };
  const schedule = () => {
    if (!runnable()) {
      cancelAnimationFrame(request);
      request = 0;
      previous = null;
    } else if (!request) request = requestAnimationFrame(tick);
  };
  const syncMotion = (event) => {
    reduced = event ? event.matches : motion.matches;
    if (reduced) times.fill(0);
    renders.forEach((render, i) => render(times[i]));
    schedule();
  };
  syncMotion();
  figure.dataset.ready = "true";
  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    schedule();
  }, { threshold: 0.05 }).observe(figure);
  motion.addEventListener("change", syncMotion);
  document.addEventListener("visibilitychange", schedule);
}, { critical: true }).catch((error) => console.warn("Verification poster remains visible:", error));
