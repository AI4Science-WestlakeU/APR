const figureURL = new URL("../assets/construction-loop-web.svg?v=51cb0f7bd24b26d9", import.meta.url);
const figureRequests = /* @__PURE__ */ new Map();
export function readFigure(url = figureURL) {
  const key = String(url);
  if (!figureRequests.has(key)) figureRequests.set(key, (async () => {
    let text;
    if (key.startsWith("data:")) {
      const comma = key.indexOf(","), payload = key.slice(comma + 1);
      text = /;base64/i.test(key.slice(0, comma)) ? new TextDecoder().decode(Uint8Array.from(atob(payload), (char) => char.charCodeAt(0))) : decodeURIComponent(payload);
    } else {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Construction loop HTTP ${response.status}`);
      text = await response.text();
    }
    const svg = new DOMParser().parseFromString(text, "image/svg+xml");
    if (svg.querySelector("parsererror")) throw new Error("Invalid construction loop SVG");
    return svg;
  })());
  return figureRequests.get(key);
}
export async function mountFigure(container) {
  const fallback = container.querySelector("img");
  const source = await readFigure(fallback.src);
  const svg = document.importNode(source.documentElement, true);
  for (const element of svg.querySelectorAll("[id]")) element.id = `apr-loop-${element.id}`;
  for (const element of svg.querySelectorAll("*")) {
    for (const attribute of [...element.attributes]) {
      if (attribute.name === "id" || attribute.value.startsWith("data:")) continue;
      let value = attribute.value.replace(/url\(#([^)]+)\)/g, "url(#apr-loop-$1)");
      if (attribute.localName === "href" && value.startsWith("#")) value = `#apr-loop-${value.slice(1)}`;
      if (value !== attribute.value) element.setAttributeNS(attribute.namespaceURI, attribute.name, value);
    }
  }
  svg.id = "apr-loop-artwork";
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.classList.add("loop-overlay");
  svg.setAttribute("aria-hidden", "true");
  const ns = "http://www.w3.org/2000/svg";
  const paths = [...svg.querySelectorAll("#apr-loop-main-arc, path[id^='apr-loop-path97']")];
  const arrows = paths.map((path) => {
    const main = path.id === "apr-loop-main-arc";
    const success = path.id === "apr-loop-path97-3-9-2-3-2";
    const direction = main ? 1 : -1;
    const group = document.createElementNS(ns, "g");
    path.before(group);
    group.append(path);
    const flow = document.createElementNS(ns, "path");
    flow.setAttribute("d", path.getAttribute("d"));
    flow.setAttribute("class", "loop-flow");
    flow.setAttribute("fill", "none");
    flow.setAttribute("stroke", main ? "#b58d12" : success ? "#2c557b" : "#f5e29a");
    flow.setAttribute("stroke-width", main ? "5.2" : success ? "4.5" : "9");
    flow.setAttribute("stroke-linecap", "round");
    flow.setAttribute("stroke-dasharray", main ? "9 22" : "14 30");
    flow.setAttribute("opacity", success ? ".65" : "1");
    flow.dataset.direction = String(direction);
    group.append(flow);
    return { flow, direction, main };
  });
  const render = (distance, reduced) => {
    for (const arrow of arrows) {
      const { flow, direction, main } = arrow;
      flow.setAttribute("stroke-dashoffset", String(-direction * distance * (main ? 0.32 : 0.72)));
      flow.style.display = reduced ? "none" : "";
      flow.style.opacity = distance === 0 ? "0" : "";
    }
    container.dataset.flowDistance = distance.toFixed(3);
  };
  function keepFlow(parent) {
    for (const child of [...parent.children]) {
      if (child.localName === "defs" || child.classList.contains("loop-flow")) continue;
      if (child.querySelector(".loop-flow")) keepFlow(child);
      else child.remove();
    }
  }
  keepFlow(svg);
  render(0, false);
  container.append(svg);
  container.dataset.ready = "true";
  return render;
}
