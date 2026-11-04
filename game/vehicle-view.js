import * as THREE from "three";
import { P, engineMounts } from "./physics.js?v=4e21205885936d83";
import { box, material } from "./landscape.js?v=4e21205885936d83";
export function makeRover(game) {
  const root = new THREE.Group(), c = game.count, length = c.long ? 3.7 : 2.8;
  if (!game.parts.length) return { root, wheels: [] };
  box(root, [length, 0.28, 1.46], [0, 0, 0], 15264479, true);
  if (!game.ready) for (const x of [-0.7, 0.7]) {
    box(root, [0.28, 0.65, 0.3], [x, -0.48, 0], 2905467);
    box(root, [0.6, 0.08, 0.6], [x, -0.8, 0], 15716697);
  }
  box(root, [length - 0.25, 0.06, 0.1], [0, 0.16, -0.62], 15716697);
  box(root, [length - 0.25, 0.06, 0.1], [0, 0.16, 0.62], 15716697);
  for (let i = 0; i < (c.axle || 0); i++) box(root, [0.34, 0.2, 1.85], [(i ? -1 : 1) * length * 0.35, -0.16, 0], 3431798, true);
  for (const { x, y, z } of engineMounts(c.long).slice(0, c.engine || 0)) {
    box(root, [0.58, 0.6, 0.48], [x, y, z], 2905467, true);
    box(root, [0.58, 0.1, 0.5], [x, y + 0.35, z], 15716697);
    for (let n = 0; n < 4; n++) box(root, [0.035, 0.27, 0.03], [x - 0.21 + n * 0.14, y, z + Math.sign(z) * 0.25], 10270909);
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 8), material(1652558));
    exhaust.rotation.z = Math.PI / 2;
    exhaust.position.set(x - 0.37, y + 0.1, z);
    root.add(exhaust);
  }
  for (let i = 0; i < (c.tank || 0); i++) {
    const tanks = new THREE.Group();
    tanks.position.set(-0.4, 0.43, c.tank > 1 ? i ? 0.28 : -0.28 : 0);
    for (let n = 0; n < 2; n++) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.65, 12), material(n ? 13689315 : 15716697));
      m.rotation.z = Math.PI / 2;
      m.position.z = n * 0.33 - 0.165;
      tanks.add(m);
    }
    root.add(tanks);
  }
  box(root, [0.7, 0.12, 0.7], [0.5, 0.23, 0], 2905467);
  box(root, [0.12, 0.55, 0.75], [0.12, 0.54, 0], 2905467);
  box(root, [0.14, 0.34, 0.75], [length / 2 - 0.12, 0.2, 0], 2905467);
  for (const z of [-0.5, 0.5]) box(root, [0.04, 0.15, 0.22], [length / 2 + 5e-3, 0.03, z], 16377772);
  const wheels = [];
  for (let i = 0; i < (c.wheel || 0); i++) {
    const group = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(P.wheelRadius, P.wheelRadius, 0.26, 18), material(1322560));
    tire.rotation.x = Math.PI / 2;
    tire.castShadow = true;
    group.add(tire);
    for (const z of [-0.14, 0.14]) {
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.035, 12), material(14865572));
      hub.rotation.x = Math.PI / 2;
      hub.position.z = z;
      group.add(hub);
      for (let n = 0; n < 3; n++) {
        const spoke = box(group, [0.35, 0.045, 0.01], [0, 0, z * 1.15], 2905467);
        spoke.rotation.z = n * Math.PI / 3;
      }
    }
    group.position.set((i < 2 ? 1 : -1) * length * 0.35, -0.38, i % 2 ? 0.93 : -0.93);
    root.add(group);
    wheels.push(group);
  }
  return { root, wheels };
}
export function makeDeck(block) {
  const root = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(block.length - 0.028, 0.26, 3.2), material(12834497).clone());
  root.add(deck);
  deck.castShadow = deck.receiveShadow = true;
  for (const z of [-1.47, 1.47]) {
    box(root, [block.length - 0.03, 0.05, 0.09], [0, 0.155, z], 2309710);
    for (const x of [-block.length / 2 + 0.12, block.length / 2 - 0.12]) box(root, [0.16, 0.1, 0.25], [x, 0.19, z], 15716697);
  }
  box(root, [0.04, 0.015, 2.7], [0, 0.14, 0], 6257785);
  return { root, deck };
}
export function disposeView(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.isLineSegments) o.material.dispose();
  });
  root.parent?.remove(root);
}
