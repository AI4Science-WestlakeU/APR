(() => {
  const root = document.querySelector(".safety-panels");
  if (!root) return;
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const flying = root.querySelector(".safety-flying");
  const anims = flying ? [...flying.querySelectorAll("animateMotion, animateTransform")] : [];
  const warnings = [...root.querySelectorAll(".safety-warning")];
  let timer = 0, inView = false;
  const pop = (el) => {
    el.classList.remove("is-popping");
    void el.getBoundingClientRect();
    el.classList.add("is-popping");
  };
  function cycle() {
    if (!inView || motion.matches || document.hidden) return;
    if (flying && anims.length) {
      anims.forEach((a) => {
        try {
          a.beginElement();
        } catch (e) {
        }
      });
      setTimeout(() => pop(warnings[0]), 1300);
    }
    setTimeout(() => warnings[1] && pop(warnings[1]), 900);
    timer = setTimeout(cycle, 5600);
  }
  function sync() {
    clearTimeout(timer);
    const run = inView && !motion.matches && !document.hidden;
    root.dataset.motion = run ? "on" : "off";
    if (!run) anims.forEach((a) => {
      try {
        a.endElement();
      } catch (e) {
      }
    });
    if (run) cycle();
  }
  new IntersectionObserver((entries) => {
    inView = entries[entries.length - 1].isIntersecting;
    sync();
  }, { threshold: 0.35 }).observe(root);
  document.addEventListener("visibilitychange", sync);
  motion.addEventListener("change", sync);
})();
