const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
const sub = (a, b) => a.map((x, i) => x - b[i]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const clamp = (x) => Math.max(0, Math.min(1, x));
const points = (vertices) => vertices.map((p) => p.slice(0, 2).map((x) => x.toFixed(3)).join(",")).join(" ");
export function projectPoint(camera, world) {
  const m = camera.matrix_world;
  const relative = world.map((x, i) => x - m[i][3]);
  const axis = (n) => [m[0][n], m[1][n], m[2][n]];
  const scale = camera.resolution[0] / camera.ortho_scale;
  return [
    camera.resolution[0] / 2 + dot(relative, axis(0)) * scale,
    camera.resolution[1] / 2 - dot(relative, axis(1)) * scale,
    dot(relative, axis(2))
  ];
}
function clipHalfPlane(polygon, value) {
  const result = [];
  polygon.forEach((b, i) => {
    const a = polygon[(i + polygon.length - 1) % polygon.length];
    const va = value(a), vb = value(b);
    if (va >= 0 !== vb >= 0) {
      const t = va / (va - vb);
      result.push(a.map((x, j) => x + t * (b[j] - x)));
    }
    if (vb >= 0) result.push(b);
  });
  return result;
}
const signedArea = (polygon) => polygon.reduce((sum, a, i) => {
  const b = polygon[(i + 1) % polygon.length];
  return sum + a[0] * b[1] - b[0] * a[1];
}, 0) / 2;
function intersection(a, b) {
  if (a.length < 3 || b.length < 3) return [];
  let result = a;
  const sign = Math.sign(signedArea(b));
  b.forEach((p, i) => {
    const q = b[(i + 1) % b.length];
    result = clipHalfPlane(result, (r) => sign * ((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])));
  });
  return result;
}
function depthAt(face, p) {
  const a = face.projected[0];
  const n = cross(sub(face.projected[1], a), sub(face.projected[2], a));
  return a[2] - (n[0] * (p[0] - a[0]) + n[1] * (p[1] - a[1])) / n[2];
}
function hull(input) {
  const pts = input.map((p) => [p[0], p[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const turn = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const p of pts) {
    while (lower.length > 1 && turn(lower.at(-2), lower.at(-1), p) <= 0) lower.pop();
    lower.push(p);
  }
  for (const p of pts.reverse()) {
    while (upper.length > 1 && turn(upper.at(-2), upper.at(-1), p) <= 0) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}
function inside(polygon, p) {
  let sign = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const s = Math.sign((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
    if (s && sign && s !== sign) return false;
    if (s) sign = s;
  }
  return true;
}
function surfaceDepth(body, p) {
  let best = -Infinity;
  body.faces.forEach((face) => {
    if (inside(face.projected, p)) best = Math.max(best, depthAt(face, p));
  });
  return best;
}
function compare(a, b) {
  const overlap = intersection(a.outline, b.outline);
  if (Math.abs(signedArea(overlap)) < 1) return 0;
  const c = overlap.reduce((s, p) => [s[0] + p[0] / overlap.length, s[1] + p[1] / overlap.length], [0, 0]);
  let vote = 0;
  [c, ...overlap.map((v) => [c[0] + 0.7 * (v[0] - c[0]), c[1] + 0.7 * (v[1] - c[1])])].forEach((p) => {
    const da = surfaceDepth(a, p), db = surfaceDepth(b, p);
    if (da > -Infinity && db > -Infinity && Math.abs(da - db) > 1e-6) vote += Math.sign(da - db);
  });
  return Math.sign(vote);
}
function orderBodies(bodies) {
  const behind = bodies.map(() => /* @__PURE__ */ new Set());
  bodies.forEach((a, i) => bodies.forEach((b, j) => {
    if (j <= i) return;
    const r = compare(a, b);
    if (r > 0) behind[i].add(j);
    if (r < 0) behind[j].add(i);
  }));
  const order = [], left = new Set(bodies.map((_, i) => i));
  while (left.size) {
    const ready = [...left].filter((i) => [...behind[i]].every((j) => !left.has(j)));
    const pool = ready.length ? ready : [...left];
    const next = pool.reduce((m, i) => bodies[i].depth < bodies[m].depth ? i : m);
    order.push(next);
    left.delete(next);
  }
  return order.map((i) => bodies[i]);
}
export function projectFrame(data, index) {
  const matrix = data.frames[index].matrices;
  const towardsCamera = data.camera.matrix_world.slice(0, 3).map((row) => row[2]);
  const bodies = [];
  data.bodies.forEach((body, i) => {
    const m = matrix[i];
    const world = body.vertices.map((vertex) => m.slice(0, 3).map((row) => dot(row.slice(0, 3), vertex) + row[3]));
    if (body.id === "right_support") world.forEach((v) => {
      v[2] = Math.max(v[2], data.foundationTop);
    });
    const faces = [];
    body.faces.forEach((indices, face) => {
      const corners = indices.map((v) => world[v]);
      const normal = cross(sub(corners[1], corners[0]), sub(corners[2], corners[0]));
      if (dot(normal, towardsCamera) <= 1e-8) return;
      const projected = corners.map((v) => projectPoint(data.camera, v));
      faces.push({
        key: `${body.id}-${face}`,
        body: body.id,
        projected,
        points: points(projected),
        depth: projected.reduce((sum, p) => sum + p[2], 0) / projected.length,
        fill: body.id === "support" ? "#EFD159" : "#fff"
      });
    });
    if (!faces.length) return;
    const all = faces.flatMap((face) => face.projected);
    bodies.push({ faces, outline: hull(all), depth: all.reduce((s, p) => s + p[2], 0) / all.length });
  });
  return orderBodies(bodies).flatMap((body) => body.faces);
}
export function createCollapse(svg) {
  if (!svg) return { draw() {
  }, ready: Promise.resolve() };
  const back = svg.querySelector('[data-collapse-blocks="back"]');
  const front = svg.querySelector('[data-collapse-blocks="front"]');
  const pull = svg.querySelector('[data-collapse-actor="pull"]');
  const surprise = svg.querySelector('[data-collapse-actor="surprise"]');
  const polygons = /* @__PURE__ */ new Map();
  let data, frames, requestedTime = 0, previousIndex = -1;
  const offsets = {
    pull: [Number(pull.dataset.offsetX || 0), Number(pull.dataset.offsetY || 0)],
    surprise: [Number(surprise.dataset.offsetX || 0), Number(surprise.dataset.offsetY || 0)]
  };
  function draw(time) {
    requestedTime = time;
    if (!data) return;
    const index = Math.max(0, Math.min(data.frames.length - 1, Math.round(time * data.fps)));
    const sample = data.frames[index];
    if (index !== previousIndex) {
      if (previousIndex === -1) {
        back.replaceChildren();
        front.replaceChildren();
        svg.querySelector("[data-collapse-fallback]")?.remove();
      }
      frames[index].forEach((face) => {
        let polygon = polygons.get(face.key);
        if (!polygon) {
          polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
          polygon.dataset.body = face.body;
          polygon.dataset.face = face.key;
          polygon.setAttribute("fill", face.fill);
          polygons.set(face.key, polygon);
        }
        polygon.setAttribute("points", face.points);
        (face.depth < data.actorDepth ? back : front).appendChild(polygon);
      });
      const visible = new Set(frames[index].map((face) => face.key));
      polygons.forEach((polygon, key) => {
        if (!visible.has(key)) polygon.remove();
      });
      previousIndex = index;
    }
    const reaction = clamp((sample.t - data.releaseTime / 2) / (data.releaseTime / 2));
    pull.setAttribute("transform", `translate(${offsets.pull[0]} ${offsets.pull[1]})`);
    surprise.setAttribute("transform", `translate(${offsets.surprise[0]} ${offsets.surprise[1]})`);
    pull.setAttribute("opacity", String(1 - reaction));
    surprise.setAttribute("opacity", String(reaction));
    svg.dataset.sample = String(index);
    svg.dataset.time = sample.t.toFixed(3);
    svg.dataset.pose = reaction >= 1 ? "surprised" : "pulling";
    svg.setAttribute("aria-label", sample.t === 0 ? "A mascot holds the handle of a load-bearing yellow support before pulling it out." : sample.t >= data.duration ? "The yellow support lies on the ground. Three blocks rest beside the collapsed beam; the surprised mascot has dropped the handle beside its feet." : "The released yellow support tumbles onto the ground, the beam tips onto the base, and three blocks slide down it.");
  }
  const ready = fetch(svg.dataset.simulation).then((response) => {
    if (!response.ok) throw new Error(`Collapse samples: HTTP ${response.status}`);
    return response.json();
  }).then((result) => {
    data = result;
    frames = data.frames.map((_, index) => projectFrame(data, index));
    svg.dataset.ready = "true";
    draw(requestedTime);
  }).catch((error) => {
    svg.dataset.ready = "error";
    console.error(error);
  });
  return { draw, ready };
}
