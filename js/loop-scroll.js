import { mountStory } from "./storyboard.js?v=e39702f978afab47";
import { mountFigure } from "./loop-figure.js?v=e39702f978afab47";
window.aprLoad.when(document.querySelector("#storyboard"), "capabilities", mountStory).catch((error) => console.warn("Capability poster remains visible:", error));
const section = document.querySelector("#agentic-loop");
const view = section.querySelector(".loop-window");
const motion = matchMedia("(prefers-reduced-motion: reduce)");
let renderFigure = () => {
};
let frame = 0;
let distance = 0;
let previousY = scrollY;
function draw() {
  frame = 0;
  renderFigure(distance, motion.matches);
}
function schedule() {
  if (!frame) frame = requestAnimationFrame(draw);
}
function onScroll() {
  const y = scrollY;
  const bounds = view.getBoundingClientRect();
  const start = y + bounds.top - innerHeight;
  const end = y + bounds.bottom;
  if (!motion.matches && !document.hidden) {
    distance += Math.max(0, Math.min(Math.max(y, previousY), end) - Math.max(Math.min(y, previousY), start));
  }
  previousY = y;
  schedule();
}
function syncView() {
  previousY = scrollY;
  schedule();
}
addEventListener("scroll", onScroll, { passive: true });
addEventListener("resize", syncView, { passive: true });
document.addEventListener("visibilitychange", syncView);
motion.addEventListener("change", syncView);
const showFallback = () => {
  section.dataset.fallback = "true";
};
window.aprLoad.when(section, "blueprint", () => mountFigure(document.querySelector("#scroll-loop-art"))).then((render) => {
  renderFigure = render;
  distance = 0;
  section.dataset.enhanced = "true";
  delete section.dataset.fallback;
  syncView();
}).catch((error) => {
  showFallback();
  console.warn("Construction loop uses its static image:", error);
});
