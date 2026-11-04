import * as THREE from "three";
import * as CANNON from "./vendor/cannon-es/cannon-es.js";
import { altitude } from "./planet.js";
import { toon } from "./style.js";
export const G = 3.71;
export const UNIT = 0.72;
export const COLORS = [{ name: "White", hex: "#f6f2df" }, { name: "Yellow", hex: "#efd159" }, { name: "Navy", hex: "#2c557b" }];
export const SHAPES = [{ name: "1 \xD7 1", x: 1, z: 1, h: 0.42 }, { name: "2 \xD7 1", x: 2, z: 1, h: 0.42 }, { name: "2 \xD7 2", x: 2, z: 2, h: 0.42 }, { name: "Slope", x: 2, z: 1, h: 0.62, slope: true }];
export const label = (item) => `${COLORS[item.color].name} \xB7 ${SHAPES[item.shape].name}`;
export function icon(item) {
  const c = COLORS[item.color].hex, s = SHAPES[item.shape];
  if (s.slope) return `<svg class="block-icon" viewBox="0 0 52 37" aria-hidden="true"><path d="M8 27 L23 11 L45 20 L30 35Z" fill="${c}" stroke="#2c557b"/><path d="M23 11 L23 23 L45 32 L45 20Z" fill="${c}" stroke="#2c557b"/><path d="M30 35 L45 20 L45 32Z" fill="#203e59" opacity=".25"/></svg>`;
  const studs = s.slope ? "" : `<ellipse cx="22" cy="12" rx="4" ry="2.2" fill="${c}" stroke="#2c557b" stroke-width=".8"/>${s.x === 2 ? `<ellipse cx="35" cy="16" rx="4" ry="2.2" fill="${c}" stroke="#2c557b" stroke-width=".8"/>` : ""}${s.z === 2 ? `<ellipse cx="15" cy="17" rx="4" ry="2.2" fill="${c}" stroke="#2c557b" stroke-width=".8"/><ellipse cx="28" cy="21" rx="4" ry="2.2" fill="${c}" stroke="#2c557b" stroke-width=".8"/>` : ""}`;
  return `<svg class="block-icon" viewBox="0 0 52 37" aria-hidden="true"><path d="M8 17 L23 9 L45 17 L30 26Z" fill="${c}" stroke="#2c557b" stroke-width="1"/><path d="M8 17 L30 26 L30 34 L8 25Z" fill="${c}" stroke="#2c557b" stroke-width="1"/><path d="M30 26 L45 17 L45 25 L30 34Z" fill="${c}" stroke="#2c557b" stroke-width="1"/><path d="M30 26 L45 17 L45 25 L30 34Z" fill="#203e59" opacity=".2"/>${studs}</svg>`;
}
const geometryCache = /* @__PURE__ */ new Map(), matCache = /* @__PURE__ */ new Map();
function wedge(w, h, d) {
  const vertices = [[-w / 2, -h / 2, -d / 2], [w / 2, -h / 2, -d / 2], [w / 2, -h / 2, d / 2], [-w / 2, -h / 2, d / 2], [-w / 2, h / 2, d / 2], [w / 2, h / 2, d / 2]];
  const faces = [[0, 1, 2, 3], [3, 2, 5, 4], [1, 5, 2], [0, 3, 4], [0, 4, 5, 1]];
  const positions = [];
  faces.forEach((f) => {
    for (let i = 1; i < f.length - 1; i++) positions.push(...vertices[f[0]], ...vertices[f[i]], ...vertices[f[i + 1]]);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return { geometry, shape: new CANNON.ConvexPolyhedron({ vertices: vertices.map((v) => new CANNON.Vec3(...v)), faces }) };
}
export function dimensions(item) {
  const s = SHAPES[item.shape];
  return { w: s.x * UNIT - 0.04, d: s.z * UNIT - 0.04, h: s.h, mass: s.x * s.z };
}
export function blockMesh(item, ghost = false) {
  const { w, h, d } = dimensions(item), s = SHAPES[item.shape];
  if (!geometryCache.has(item.shape)) geometryCache.set(item.shape, s.slope ? wedge(w, h, d).geometry : new THREE.BoxGeometry(w, h, d));
  if (!geometryCache.has("stud")) geometryCache.set("stud", new THREE.CylinderGeometry(0.115, 0.12, 0.075, 12));
  if (!matCache.has(item.color)) matCache.set(item.color, toon(COLORS[item.color].hex));
  const material = ghost ? new THREE.MeshBasicMaterial({ color: 15716697, transparent: true, opacity: 0.35, depthWrite: false }) : matCache.get(item.color);
  const root = new THREE.Group();
  const body = new THREE.Mesh(geometryCache.get(item.shape), material);
  body.castShadow = !ghost;
  body.receiveShadow = true;
  root.add(body);
  const line = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), new THREE.LineBasicMaterial({ color: 2905467, transparent: true, opacity: ghost ? 0.65 : 0.85 }));
  root.add(line);
  if (!s.slope) for (let x = 0; x < s.x; x++) for (let z = 0; z < s.z; z++) {
    const stud = new THREE.Mesh(geometryCache.get("stud"), material);
    stud.position.set((x - (s.x - 1) / 2) * UNIT, h / 2 + 0.032, (z - (s.z - 1) / 2) * UNIT);
    stud.castShadow = !ghost;
    stud.userData.stud = true;
    root.add(stud);
  }
  return root;
}
export function blockBody(item, material) {
  const { w, h, d, mass } = dimensions(item);
  return new CANNON.Body({ mass, shape: SHAPES[item.shape].slope ? wedge(w, h, d).shape : new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)), material, linearDamping: 0.015, angularDamping: 0.12, allowSleep: true, sleepSpeedLimit: 0.08, sleepTimeLimit: 0.7 });
}
export function energy(body) {
  const height = Math.max(0, altitude(body.position));
  const speed = body.velocity.length();
  return { height, speed, potential: body.mass * G * height, kinetic: 0.5 * body.mass * speed * speed };
}
export function disposeBlock(mesh, ghost = false) {
  mesh.traverse((o) => {
    if (o.isLineSegments) {
      o.geometry.dispose();
      o.material.dispose();
    }
  });
  if (ghost) mesh.children.find((o) => o.isMesh)?.material.dispose();
}
