import { createCollapse } from "./nearterm-collapse.js?v=4e21205885936d83";
import { createEcho } from "./nearterm-echo.js?v=4e21205885936d83";
const board = document.querySelector("#near-board");
window.aprLoad.when(board, "near-term", async () => {
  const copy = board.querySelector(".near-copy");
  const items = [...board.querySelectorAll(".capability-item")];
  const panes = [...board.querySelectorAll(".near-pane")];
  const sequences = panes.map((pane) => [...pane.querySelectorAll(".near-frame")]);
  const wider = board.querySelector(".near-wider");
  const circuits = [...board.querySelectorAll(".near-signal-path")].map((path) => {
    const flow = path.nextElementSibling;
    const length = path.getTotalLength();
    flow.style.strokeDasharray = `80 ${length - 80}`;
    return { flow, length };
  });
  const channels = [...board.querySelectorAll(".near-channel")];
  const mixerCaptions = [...board.querySelectorAll(".near-mixer-caption")];
  const sceneCaption = board.querySelector(".near-scene-caption");
  const status = board.querySelector(".near-status");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const collapseFrame = board.querySelector(".near-collapse");
  const collapse = createCollapse(collapseFrame);
  const echo = createEcho(board);
  const schedules = [
    [4e3, 4e3, 4e3],
    sequences[1].map((frame) => Number(frame.dataset.hold) || 3500),
    sequences[2].map(() => 4e3)
  ];
  const reducedFrames = [2, Math.max(0, sequences[1].indexOf(collapseFrame)), sequences[2].length - 1];
  const clamp = (value) => Math.max(0, Math.min(1, value));
  let selected = 0;
  let elapsed = 0;
  let frameId = 0;
  let lastTick = null;
  let inView = false;
  let hovered = copy.matches(":hover") && matchMedia("(hover: hover)").matches;
  let focused = board.contains(document.activeElement);
  let reduced = motion.matches;
  const duration = () => schedules[selected].reduce((sum, hold) => sum + hold, 0);
  function phaseAt(time) {
    const schedule = schedules[selected];
    let start = 0;
    for (let frame = 0; frame < schedule.length; frame += 1) {
      if (time < start + schedule[frame] || frame === schedule.length - 1) return { frame, local: time - start };
      start += schedule[frame];
    }
  }
  const canAdvance = () => inView && !document.hidden && !motion.matches && !hovered && !focused;
  function draw() {
    const phase = phaseAt(elapsed);
    const frame = motion.matches ? reducedFrames[selected] : phase.frame;
    const local = motion.matches ? 0 : phase.local;
    const hold = schedules[selected][frame];
    board.dataset.frame = String(frame);
    board.style.setProperty("--progress", motion.matches ? 0 : clamp(elapsed / duration()));
    if (selected === 0) {
      wider.dataset.frame = String(frame);
      const descriptions = [
        "Goal-driven design is emphasized; all five capability channels remain active.",
        "Embodied execution is emphasized; all five capability channels remain active.",
        "All five capabilities are emphasized in the full pipeline."
      ];
      wider.setAttribute("aria-label", descriptions[frame]);
      mixerCaptions.forEach((caption) => {
        caption.textContent = ["Goal-driven design emphasized", "Embodied execution emphasized", "Full pipeline"][frame];
      });
      channels.forEach((channel) => {
        channel.dataset.level = String(frame === 2 || Number(channel.dataset.channel) === (frame === 0 ? 0 : 2) ? 1 : 0.25);
      });
      const progress = clamp(local / (hold - 300));
      circuits.forEach(({ flow, length }) => {
        flow.style.strokeDashoffset = String(-progress * length);
      });
    } else {
      const sequence = sequences[selected];
      if (selected === 1) sceneCaption.textContent = sequence[frame].dataset.caption;
      if (sequence[frame] === collapseFrame) {
        collapse.draw(motion.matches ? 4 : Math.max(0, Math.min(4, (local - 800) / 1e3)));
      } else if (sequence[frame + 1] === collapseFrame) {
        collapse.draw(0);
      }
      const blend = !motion.matches && frame < sequence.length - 1 ? clamp((local - hold + 220) / 220) : 0;
      sequence.forEach((image, index) => {
        image.style.opacity = String(index === frame ? 1 - blend : index === frame + 1 ? blend : 0);
        image.setAttribute("aria-hidden", String(index !== frame));
      });
      if (selected === 1) echo.update(sequence[frame], local, hold, blend, performance.now());
    }
    if (selected !== 1) echo.hide();
  }
  function syncClock() {
    board.dataset.paused = String(!canAdvance());
    board.dataset.pauseReason = document.hidden ? "hidden" : !inView ? "offscreen" : motion.matches ? "reduced-motion" : hovered ? "hover" : focused ? "focus" : "none";
    board.dataset.reducedMotion = String(motion.matches);
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
    if (reduced !== motion.matches) {
      syncMotion();
      return;
    }
    const delta = lastTick === null ? 0 : Math.min(now - lastTick, 100);
    lastTick = now;
    if (canAdvance()) {
      elapsed += delta;
      if (elapsed >= duration()) selectStep((selected + 1) % items.length);
    }
    draw();
    if (canAdvance() && !frameId) frameId = requestAnimationFrame(tick);
    else if (!frameId) lastTick = null;
  }
  function syncMotion() {
    reduced = motion.matches;
    selectStep(selected);
  }
  items.forEach((item, index) => item.querySelector("button").addEventListener("click", (event) => {
    if (event.detail > 0) event.currentTarget.blur();
    focused = board.contains(document.activeElement);
    selectStep(index);
    status.textContent = `${event.currentTarget.textContent.trim()}. ${motion.matches ? "Automatic playback is off." : focused ? "Move focus out of the scene to resume playback." : hovered ? "Move the pointer away from the text to resume playback." : "Playback loops continuously from this step."}`;
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
  document.addEventListener("visibilitychange", syncClock);
  motion.addEventListener("change", syncMotion);
  new IntersectionObserver((entries) => {
    const entry = entries[entries.length - 1];
    inView = entry.isIntersecting && entry.intersectionRatio >= 0.1;
    syncClock();
  }, { threshold: [0, 0.1] }).observe(board);
  selectStep(0);
  await Promise.all([collapse.ready, echo.ready]);
  draw();
  board.dataset.ready = "true";
}).catch((error) => console.warn("Near-term poster remains visible:", error));
