"use strict";
const auditTable = document.querySelector(".audit-table");
if (auditTable) {
  const frame = auditTable.closest(".audit-frame");
  const viewport = frame.querySelector(".audit-viewport");
  const scroller = frame.querySelector(".audit-scroll");
  const scrollbar = frame.querySelector(".audit-scrollbar");
  const thumb = frame.querySelector(".audit-thumb");
  const count = frame.querySelector(".audit-count");
  let rows = [];
  let headerHeight = 0;
  const maxScroll = () => Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  const updateScroll = () => {
    const limit = maxScroll();
    const scrollTop = Math.max(0, Math.min(limit, scroller.scrollTop));
    viewport.dataset.more = String(limit - scrollTop > 1);
    scrollbar.hidden = limit <= 1;
    const bounds = scroller.getBoundingClientRect();
    const top = bounds.top + headerHeight;
    const bottom = bounds.bottom;
    const rowBounds = rows.map((row, index) => ({ index, bounds: row.getBoundingClientRect() }));
    const visible = rowBounds.filter((row) => row.bounds.top >= top - 1 && row.bounds.bottom <= bottom + 1);
    const first = visible.length ? visible[0].index + 1 : 0;
    const last = visible.length ? visible[visible.length - 1].index + 1 : 0;
    count.textContent = `${first}\u2013${last} / ${rows.length}`;
    count.setAttribute("aria-label", `Fully visible benchmark rows ${first} to ${last} of ${rows.length}`);
    scrollbar.setAttribute("aria-valuemax", String(limit));
    scrollbar.setAttribute("aria-valuenow", String(Math.round(scrollTop)));
    scrollbar.setAttribute("aria-valuetext", `Rows ${first} to ${last} of ${rows.length}`);
    const trackHeight = scrollbar.getBoundingClientRect().height;
    const visibleRows = rowBounds.reduce((total, row) => total + Math.max(0, Math.min(bottom, row.bounds.bottom) - Math.max(top, row.bounds.top)) / row.bounds.height, 0);
    const thumbHeight = Math.min(trackHeight, Math.max(24, trackHeight * visibleRows / (rows.length || 1)));
    thumb.style.height = `${thumbHeight}px`;
    thumb.style.transform = `translateY(${limit ? scrollTop / limit * (trackHeight - thumbHeight) : 0}px)`;
  };
  const sizeViewport = () => {
    rows = [...auditTable.tBodies[0].rows];
    auditTable.style.setProperty("--audit-row-height", "auto");
    const rowHeight = Math.max(0, ...rows.map((row) => row.getBoundingClientRect().height));
    auditTable.style.setProperty("--audit-row-height", `${rowHeight}px`);
    headerHeight = auditTable.tHead.getBoundingClientRect().height;
    const bodyHeight = rows.slice(0, 5).reduce((height, row) => height + row.getBoundingClientRect().height, 0);
    const halfRow = rows[5] ? rows[5].getBoundingClientRect().height / 2 : 0;
    scroller.style.maxHeight = `${headerHeight + bodyHeight + halfRow}px`;
    frame.style.setProperty("--audit-header-height", `${headerHeight}px`);
    updateScroll();
  };
  let drag = null;
  const dragTo = (clientY) => {
    const track = scrollbar.getBoundingClientRect();
    const travel = track.height - thumb.getBoundingClientRect().height;
    if (travel > 0) scroller.scrollTop = Math.max(0, Math.min(1, (clientY - track.top - drag.offset) / travel)) * maxScroll();
  };
  scrollbar.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    scrollbar.focus({ preventScroll: true });
    const bounds = thumb.getBoundingClientRect();
    drag = { pointerId: event.pointerId, offset: event.target === thumb ? event.clientY - bounds.top : bounds.height / 2 };
    scrollbar.setPointerCapture(event.pointerId);
    scrollbar.classList.add("is-dragging");
    dragTo(event.clientY);
  });
  scrollbar.addEventListener("pointermove", (event) => {
    if (drag && event.pointerId === drag.pointerId) dragTo(event.clientY);
  });
  const stopDrag = () => {
    drag = null;
    scrollbar.classList.remove("is-dragging");
  };
  scrollbar.addEventListener("pointerup", stopDrag);
  scrollbar.addEventListener("pointercancel", stopDrag);
  scrollbar.addEventListener("lostpointercapture", stopDrag);
  scrollbar.addEventListener("keydown", (event) => {
    const step = rows[0]?.getBoundingClientRect().height || 40;
    const page = scroller.clientHeight - headerHeight;
    const offsets = { ArrowUp: -step, ArrowDown: step, PageUp: -page, PageDown: page, Home: -maxScroll(), End: maxScroll() };
    if (!(event.key in offsets)) return;
    event.preventDefault();
    scroller.scrollTop += offsets[event.key];
  });
  scroller.addEventListener("scroll", updateScroll, { passive: true });
  new ResizeObserver(sizeViewport).observe(auditTable);
  document.fonts.ready.then(sizeViewport);
  sizeViewport();
}
