"use strict";
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const abstract = document.querySelector(".abstract");
if (abstract) {
  const summary = abstract.querySelector("summary");
  const content = abstract.querySelector("#abstract-text");
  let animation = null;
  let expanded = abstract.open;
  const finish = () => {
    animation?.cancel();
    animation = null;
    abstract.open = expanded;
    abstract.classList.remove("is-animating");
    abstract.removeAttribute("data-closing");
  };
  summary.addEventListener("click", (event) => {
    event.preventDefault();
    const start = abstract.getBoundingClientRect().height;
    animation?.cancel();
    expanded = !expanded;
    abstract.open = true;
    abstract.toggleAttribute("data-closing", !expanded);
    if (reducedMotion.matches || !abstract.animate) {
      finish();
      return;
    }
    const end = summary.getBoundingClientRect().height + (expanded ? content.getBoundingClientRect().height : 0);
    abstract.classList.add("is-animating");
    animation = abstract.animate({ height: [`${start}px`, `${end}px`] }, { duration: 200, easing: "ease-out" });
    animation.onfinish = finish;
  });
  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) finish();
  });
  window.addEventListener("hashchange", () => {
    if (location.hash === "#abstract" && !expanded) summary.click();
  });
}
const watermarkFrames = [...document.querySelectorAll("[data-scroll-watermark]")];
let watermarkFrame = 0;
const drawWatermarks = () => {
  watermarkFrame = 0;
  for (const frame of watermarkFrames) {
    const footer = frame.dataset.scrollWatermark === "footer";
    const art = footer ? frame.querySelector(".footer-art") : frame;
    const box = (footer ? frame : frame.closest(".capability-art")).getBoundingClientRect();
    const clamp = (value) => Math.max(0, Math.min(1, value));
    let shift = 0;
    if (!reducedMotion.matches) {
      if (footer) {
        const entry = scrollY + box.top - innerHeight;
        const end = document.documentElement.scrollHeight - innerHeight;
        const progress = clamp((scrollY - entry) / Math.max(1, end - entry));
        const travel = Math.max(60, art.getBoundingClientRect().height - box.height);
        shift = (1 - progress) * travel;
      } else {
        const progress = clamp((innerHeight - box.top) / (innerHeight + box.height));
        shift = (progress - 0.5) * 100;
      }
    }
    art.style.setProperty("--watermark-shift", `${shift.toFixed(2)}px`);
    frame.dataset.watermarkReady = "true";
  }
};
const scheduleWatermarks = () => {
  if (!watermarkFrame && !document.hidden) watermarkFrame = requestAnimationFrame(drawWatermarks);
};
addEventListener("scroll", scheduleWatermarks, { passive: true });
addEventListener("resize", scheduleWatermarks, { passive: true });
document.addEventListener("visibilitychange", scheduleWatermarks);
reducedMotion.addEventListener("change", scheduleWatermarks);
watermarkFrames.forEach((frame) => frame.querySelector("img").addEventListener("load", scheduleWatermarks));
scheduleWatermarks();
const copyButton = document.querySelector("#copy");
const bibtex = document.querySelector("#bibtex");
const copyStatus = document.querySelector("#copy-status");
if (copyButton && bibtex && copyStatus) {
  let feedbackTimer;
  copyButton.hidden = false;
  copyButton.addEventListener("click", async () => {
    clearTimeout(feedbackTimer);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(bibtex.textContent.trim() + "\n");
      copyStatus.textContent = "BibTeX copied.";
      copyButton.textContent = "Copied";
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(bibtex);
      selection.removeAllRanges();
      selection.addRange(range);
      copyStatus.textContent = "Citation selected. Press Control+C or Command+C to copy.";
      copyButton.textContent = "Select again";
    }
    feedbackTimer = setTimeout(() => {
      copyButton.textContent = "Copy BibTeX";
      if (copyStatus.textContent === "BibTeX copied.") copyStatus.textContent = "";
    }, 2e3);
  });
}
const carousel = document.querySelector(".capability-carousel");
if (carousel) {
  const track = carousel.querySelector(".capability-track");
  const slides = [...track.querySelectorAll(".capability-slide")];
  const pages = [...carousel.querySelectorAll("[data-slide]")];
  const status = carousel.querySelector("#carousel-status");
  const slideDuration = 8e3;
  let current = 0;
  let navigating = false;
  let scrolling = false;
  let scrollTimer;
  let drag = null;
  let inView = false;
  let hovered = false;
  let focused = false;
  let interacting = false;
  let elapsed = 0;
  let lastTick = null;
  let animationFrame = 0;
  const canAdvance = () => inView && !document.hidden && !reducedMotion.matches && !hovered && !focused && !interacting && !navigating && !scrolling;
  const renderProgress = () => {
    carousel.style.setProperty("--slide-progress", Math.min(1, elapsed / slideDuration));
  };
  const tick = (now) => {
    animationFrame = 0;
    if (!canAdvance()) {
      syncClock();
      return;
    }
    if (lastTick !== null) elapsed += now - lastTick;
    lastTick = now;
    renderProgress();
    if (elapsed >= slideDuration) goTo(current + 1, false);
    else animationFrame = requestAnimationFrame(tick);
  };
  const syncClock = () => {
    const running = canAdvance();
    carousel.dataset.paused = String(!running);
    carousel.dataset.reducedMotion = String(reducedMotion.matches);
    if (!running) {
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      lastTick = null;
    } else if (!animationFrame) {
      lastTick = null;
      animationFrame = requestAnimationFrame(tick);
    }
  };
  const positionOf = (index) => slides[index].offsetLeft - slides[0].offsetLeft;
  const nearest = () => slides.reduce((best, _, index) => Math.abs(positionOf(index) - track.scrollLeft) < Math.abs(positionOf(best) - track.scrollLeft) ? index : best, 0);
  const update = (index, announce = true) => {
    current = index;
    elapsed = 0;
    lastTick = null;
    renderProgress();
    slides.forEach((slide, i) => {
      slide.dataset.current = String(i === index);
    });
    pages.forEach((button, i) => {
      if (i === index) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    });
    if (announce) status.textContent = slides[index].getAttribute("aria-label");
  };
  const goTo = (index, announce = true) => {
    index = (index + slides.length) % slides.length;
    navigating = Math.abs(positionOf(index) - track.scrollLeft) > 2;
    update(index, announce);
    syncClock();
    track.scrollTo({ left: positionOf(index), behavior: reducedMotion.matches ? "instant" : "smooth" });
  };
  const syncAfterScroll = () => {
    if (drag) return;
    navigating = false;
    scrolling = false;
    const index = nearest();
    if (index !== current) update(index);
    syncClock();
  };
  pages.forEach((button, index) => button.addEventListener("click", () => goTo(index)));
  track.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const targets = { ArrowLeft: current - 1, ArrowRight: current + 1, Home: 0, End: slides.length - 1 };
    if (!(event.key in targets)) return;
    event.preventDefault();
    goTo(targets[event.key]);
  });
  track.addEventListener("scroll", () => {
    scrolling = true;
    syncClock();
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(syncAfterScroll, 150);
  }, { passive: true });
  track.addEventListener("scrollend", syncAfterScroll);
  track.addEventListener("wheel", () => {
    navigating = false;
  }, { passive: true });
  track.addEventListener("pointerdown", (event) => {
    navigating = false;
    interacting = true;
    syncClock();
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    drag = { x: event.clientX, left: track.scrollLeft, index: nearest(), distance: 0 };
    track.classList.add("is-dragging");
    track.setPointerCapture(event.pointerId);
  });
  track.addEventListener("pointermove", (event) => {
    if (!drag) return;
    drag.distance = drag.x - event.clientX;
    track.scrollLeft = drag.left + drag.distance;
    if (Math.abs(drag.distance) > 5) event.preventDefault();
  });
  const endDrag = () => {
    interacting = false;
    syncClock();
    if (!drag) return;
    let index = nearest();
    if (index === drag.index && Math.abs(drag.distance) > 60) index += Math.sign(drag.distance);
    drag = null;
    track.classList.remove("is-dragging");
    goTo(Math.max(0, Math.min(slides.length - 1, index)));
  };
  track.addEventListener("pointerup", endDrag);
  track.addEventListener("pointercancel", endDrag);
  track.addEventListener("lostpointercapture", endDrag);
  track.addEventListener("dragstart", (event) => event.preventDefault());
  carousel.addEventListener("pointerenter", (event) => {
    if (event.pointerType === "touch") return;
    hovered = true;
    syncClock();
  });
  carousel.addEventListener("pointerleave", () => {
    hovered = false;
    syncClock();
  });
  carousel.addEventListener("focusin", () => {
    focused = true;
    syncClock();
  });
  carousel.addEventListener("focusout", () => queueMicrotask(() => {
    focused = carousel.contains(document.activeElement);
    syncClock();
  }));
  document.addEventListener("visibilitychange", syncClock);
  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) {
      track.scrollTo({ left: positionOf(current), behavior: "instant" });
      navigating = false;
    }
    syncClock();
  });
  new ResizeObserver(() => {
    if (!drag) track.scrollTo({ left: positionOf(current), behavior: "instant" });
  }).observe(track);
  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting && entry.intersectionRatio >= 0.2;
    carousel.dataset.inView = String(inView);
    syncClock();
  }, { threshold: 0.2 }).observe(track);
  update(0, false);
  carousel.querySelector(".carousel-toolbar").hidden = false;
}
const gameMount = document.querySelector(".game-mount");
if (gameMount) {
  const frame = gameMount.querySelector("iframe");
  const placeholder = gameMount.querySelector(".game-placeholder");
  let loading = false;
  let loaded = false;
  let coverReady, releaseEngine;
  const revealGame = () => {
    loaded = true;
    loading = false;
    frame.dataset.ready = "true";
    placeholder.hidden = true;
    coverReady?.();
    frame.contentWindow.postMessage({ type: "apr-loading-available" }, "*");
  };
  addEventListener("message", (event) => {
    if (event.source !== frame.contentWindow) return;
    if (loading && event.data?.type === "apr-game-ready") revealGame();
    if (event.data?.type === "apr-game-start") {
      window.aprLoad.run(gameMount, "game-engine", () => new Promise((resolve) => {
        releaseEngine = resolve;
        frame.contentWindow.postMessage({ type: "apr-game-grant" }, "*");
      }), { urgent: true });
    }
    if (event.data?.type === "apr-game-end") {
      releaseEngine?.();
      releaseEngine = null;
    }
  });
  const loadGame = async () => {
    if (loading || loaded) return;
    loading = true;
    const ready = new Promise((resolve) => {
      coverReady = resolve;
    });
    try {
      const response = await fetch(gameMount.dataset.gameSrc, { method: "HEAD", cache: "no-cache" });
      if (!response.ok) return;
      frame.addEventListener("load", async () => {
        frame.hidden = false;
        const gameDocument = frame.contentDocument;
        if (!gameDocument) return;
        const cover = gameDocument.querySelector("#cover");
        const coverURL = cover && frame.contentWindow.getComputedStyle(cover).backgroundImage.match(/^url\(["']?(.*?)["']?\)$/)?.[1];
        const coverImage = new Image();
        if (coverURL) coverImage.src = coverURL;
        await Promise.allSettled([
          ...coverURL ? [coverImage.decode()] : [],
          ...[400, 700].map((weight) => gameDocument.fonts.load(`${weight} 18px "Open Sans SemiCondensed"`))
        ]);
        revealGame();
      }, { once: true });
      frame.loading = "eager";
      frame.hidden = false;
      frame.src = gameMount.dataset.gameSrc;
      await ready;
    } catch {
    } finally {
      if (!frame.hasAttribute("src")) loading = false;
    }
  };
  window.aprLoad.when(gameMount, "game-cover", loadGame, { images: false });
}
