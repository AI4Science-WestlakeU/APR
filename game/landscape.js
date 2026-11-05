import * as THREE from "three";
import { P, surfaceY } from "./physics.js?v=bcc17423519306fc";
import { toon, INK } from "./style.js?v=bcc17423519306fc";
const materials = /* @__PURE__ */ new Map();
export function material(color) {
  if (!materials.has(color)) materials.set(color, toon(color));
  return materials.get(color);
}
export function box(parent, size, position, color, edges = false) {
  const geometry = new THREE.BoxGeometry(...size), mesh = new THREE.Mesh(geometry, material(color));
  mesh.position.set(...position);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  if (edges) mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.6 })));
  return mesh;
}
export function sign(parent, text, width, height, position, { ink = "#eaf0ef", background = "#183349", font = 700 } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 768, 128);
  ctx.font = `${font} 58px "Open Sans SemiCondensed", sans-serif`;
  ctx.fillStyle = ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 384, 66);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}
function triangles(vertices, faces) {
  const points = [];
  for (const f of faces) for (let i = 1; i < f.length - 1; i++) points.push(...vertices[f[0]], ...vertices[f[i]], ...vertices[f[i + 1]]);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  g.computeVertexNormals();
  return g;
}
export function makeLandscape(scene, game) {
  for (const [start, end, low] of [[-240, 0, false], [20, 240, true]]) {
    const vertices = [], colors = [], indices = [], step = 4, columns = (end - start) / step + 1, rows = 121;
    for (let i = 0; i < columns; i++) for (let j = 0; j < rows; j++) {
      const x = start + i * step, z = -240 + j * step;
      vertices.push(x, surfaceY(x, z, low), z);
      const color = new THREE.Color(low ? 12606518 : 13003328);
      color.multiplyScalar(1 + 0.045 * Math.sin(i * 13.5 + j * 7.19));
      colors.push(color.r, color.g, color.b);
    }
    for (let i = 0; i < columns - 1; i++) for (let j = 0; j < rows - 1; j++) {
      const a = i * rows + j, b = a + rows;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, toon(16777215, { vertexColors: true }));
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(P.radius - 27, 5), material(9124907));
  shell.position.y = -P.radius;
  scene.add(shell);
  for (const x of [0, 20]) {
    for (let band = 0; band < 5; band++) {
      const points = [], indices = [];
      for (let i = 0; i <= 64; i++) {
        const z = -112 + i * 3.5, top = surfaceY(x, z, x > 0), bottom = Math.min(-27, top - 8);
        const y1 = top + (bottom - top) * band / 5, y2 = top + (bottom - top) * (band + 1) / 5;
        const edge = x + (band ? Math.sin(i * 4.1 + band) * 0.25 : 0);
        points.push(edge, y1, z, edge, y2, z);
        if (i < 64) indices.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, toon([11948592, 8403758, 10635824, 7090736, 9322029][band], { side: THREE.DoubleSide }));
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
  }
  box(scene, [20, 0.2, 190], [10, P.floor - 0.1, 0], 5319211);
  for (const r of [game.ramp, game.approach]) {
    const ramp = new THREE.Mesh(triangles(r.vertices, r.faces), material(13931862));
    ramp.position.copy(r.body.position);
    ramp.receiveShadow = true;
    scene.add(ramp);
  }
  for (let x = -32; x < -3; x += 4) {
    for (const z of [-1.8, 1.8]) {
      const m = box(scene, [1.3, 0.018, 0.08], [x, surfaceY(x, z) + 0.025, z], 15781225);
      m.rotation.z = Math.asin(-x / P.radius);
    }
  }
  const rampLabel = sign(scene, "TAKEOFF  \u2192", 3.4, 0.54, [-3, 0.3, 0], { ink: "#163449", background: "#efd159" });
  rampLabel.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
  rampLabel.position.y = 0.32;
  const garage = new THREE.Group();
  garage.position.set(P.garageX, surfaceY(P.garageX, 0) + 0.015, 0);
  garage.rotation.z = Math.asin(-P.garageX / P.radius);
  scene.add(garage);
  const pad = box(garage, [9, 0.025, 7], [0, -0.01, 0], 2704725);
  for (let x = -4; x <= 4; x++) box(garage, [0.015, 0.018, 6], [x, 0.02, 0], 5534076);
  for (let z = -3; z <= 3; z++) box(garage, [8, 0.018, 0.015], [0, 0.02, z], 5534076);
  for (const z of [-3.5, 3.5]) box(garage, [9, 0.04, 0.07], [0, 0.02, z], 15716697);
  for (const x of [-4.5, 4.5]) box(garage, [0.07, 0.04, 7], [x, 0.02, 0], 15716697);
  const title = sign(garage, "GARAGE", 3.5, 0.55, [-2.5, 0.045, 2.1]);
  title.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
  for (const z of [-3.1, 3.1]) {
    box(garage, [0.1, 2.5, 0.1], [-4.1, 1.25, z], 1455177);
    box(garage, [0.2, 0.08, 0.4], [-4.1, 2.52, z], 15716697);
  }
  const station = new THREE.Group();
  station.position.set(P.garageX - 1, surfaceY(P.garageX - 1, -5), -5);
  scene.add(station);
  box(station, [3, 0.22, 1.65], [0, 0.11, 0], 1585993, true);
  for (const [x, color] of [[-0.65, 15191915], [0.65, 13821156]]) {
    const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.8, 12), material(color));
    cylinder.position.set(x, 1.1, 0);
    cylinder.castShadow = true;
    station.add(cylinder);
    box(station, [0.34, 0.22, 0.38], [x, 2.1, 0], 2377823);
  }
  sign(station, "CH\u2084  /  LOX", 2.7, 0.45, [0, 2.6, 0.05]);
  const hose = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.8, 0.7), new THREE.Vector3(0.6, 0.1, 1.6), new THREE.Vector3(1.8, 0.08, 1.7), new THREE.Vector3(2.1, 0.3, 1)]);
  station.add(new THREE.Mesh(new THREE.TubeGeometry(hose, 16, 0.045, 6, false), material(1585993)));
  const rockGeo = new THREE.DodecahedronGeometry(1, 0), rocks = new THREE.InstancedMesh(rockGeo, material(10244668), 120), transform = new THREE.Object3D();
  let count = 0;
  for (let i = 0; i < 160; i++) {
    const x = -74 + i * 53.79 % 154, z = -42 + i * 23.51 % 84;
    if (x > -3 && x < 24 || Math.abs(z) < 13 && x > -44 && x < 45) continue;
    transform.position.set(x, surfaceY(x, z, x > 20), z);
    transform.rotation.set(i, i * 0.7, i * 0.3);
    const scale = 0.3 + i % 5 * 0.16;
    transform.scale.set(scale * 1.6, scale, scale);
    transform.updateMatrix();
    rocks.setMatrixAt(count++, transform.matrix);
    if (count === 120) break;
  }
  rocks.count = count;
  rocks.castShadow = true;
  scene.add(rocks);
  for (const x of [-1, 21]) {
    const group = new THREE.Group();
    group.position.set(x, surfaceY(x, P.bridgeZ, x > 0), P.bridgeZ);
    scene.add(group);
    box(group, [0.8, 0.25, 4], [0, 0.13, 0], 2505803, true);
    for (const z of [-1.9, 1.9]) box(group, [0.12, 1.6, 0.12], [0, 0.8, z], 15716697);
  }
  const bridgeLabel = sign(scene, "BRIDGE", 3.5, 0.55, [-3, surfaceY(-3, 9) + 1.6, 10]);
  bridgeLabel.rotation.y = -Math.PI / 2;
  const flag = new THREE.Group();
  flag.position.set(P.flagX, surfaceY(P.flagX, 0, true), 0);
  scene.add(flag);
  box(flag, [0.1, 5, 0.1], [0, 2.5, 0], 15330530);
  const cloth = box(flag, [0.04, 1.1, 2.2], [0, 4.25, 1.1], 15716697);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2 === 0) box(flag, [0.05, 0.55, 0.55], [0, 3.98 + j * 0.55, 0.275 + i * 0.55], 1455177);
  const goal = sign(flag, "FINISH", 3, 0.55, [-0.1, 2.6, 0]);
  goal.rotation.y = -Math.PI / 2;
  for (let z = -10; z <= 10; z += 0.8) box(scene, [1, 0.025, 0.4], [P.flagX, surfaceY(P.flagX, z, true) + 0.02, z], z % 1.6 < 0.5 ? 15781225 : 2442581);
  return { garage, station, pad, flag, cloth };
}
