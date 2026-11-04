import * as C from "./vendor/cannon-es/cannon-es.js";
export const P = Object.freeze({
  radius: 400,
  gravity: 3.71,
  step: 1 / 120,
  timeLimit: 900,
  rim: 0,
  farRim: 20,
  drop: 5,
  floor: -26,
  halfWidth: 48,
  garageX: -36,
  bridgeZ: 7,
  flagX: 29,
  friction: 0.6,
  rampLength: 6,
  rampHeight: 0.48,
  wheelRadius: 0.44,
  power: 2500,
  torque: 130,
  methaneCapacity: 24,
  mixture: 3.6,
  methanePerKJ: 0.06,
  fillRate: 2,
  pilotMass: 30,
  heatRate: 0.055,
  coolRate: 0.08,
  restartHeat: 0.55,
  bridgeCount: 10,
  bridgeLength: 2.2,
  bridgeMass: 8,
  jointForce: 5e3,
  jointTorque: 16e3
});
export const PARTS = Object.freeze({
  small: { name: "Short chassis", mass: 14, max: 1 },
  long: { name: "Long chassis", mass: 28, max: 1 },
  axle: { name: "Axle mount", mass: 10, max: 2 },
  wheel: { name: "Wheel", mass: 6, max: 4 },
  engine: { name: "Engine", mass: 95, max: 4 },
  tank: { name: "CH\u2084 + LOX tank", mass: 8, max: 2 },
  bridge: { name: "Bridge deck", mass: P.bridgeMass, max: P.bridgeCount }
});
export const KIT = ["small", "long", "axle", "wheel", "engine", "tank", "bridge"];
export const engineMounts = (long) => [1, -1].flatMap((x) => [-1, 1].map((z) => ({ x: x * (long ? 3.7 : 2.8) * 0.35, y: 0.46, z: z * 0.61 })));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const vec = (p) => ({ x: p.x, y: p.y, z: p.z });
export const surfaceY = (x, z, lower = false) => Math.sqrt(Math.max(0, (P.radius - (lower ? P.drop : 0)) ** 2 - x * x - z * z)) - P.radius;
export const rampY = (x, z) => Math.abs(z) < 2.3 && x >= -P.rampLength && x <= 0 ? (x + P.rampLength) / P.rampLength * P.rampHeight : 0;
export const groundY = (x, z) => x <= 0 ? surfaceY(x, z) + rampY(x, z) : x >= P.farRim ? surfaceY(x, z, true) : P.floor;
export function bridgeSlot(index) {
  const startX = -1, endX = startX + P.bridgeCount * P.bridgeLength;
  const startY = surfaceY(startX, P.bridgeZ) + 0.7, endY = surfaceY(endX, P.bridgeZ, true) + 0.3;
  const t = (index - 0.5) / P.bridgeCount;
  return {
    index,
    x: startX + (endX - startX) * t,
    y: startY + (endY - startY) * t - 0.13,
    z: P.bridgeZ,
    angle: Math.atan2(endY - startY, endX - startX),
    length: Math.hypot(endX - startX, endY - startY) / P.bridgeCount,
    startX,
    endX,
    startY,
    endY
  };
}
export function radial(p, result = new C.Vec3()) {
  result.set(p.x, p.y + P.radius, p.z);
  result.normalize();
  return result;
}
export function frameAt(p) {
  const q = new C.Quaternion();
  q.setFromVectors(new C.Vec3(0, 1, 0), radial(p));
  return q;
}
export function gravity(body) {
  if (body.type !== C.Body.DYNAMIC || body.sleepState === C.Body.SLEEPING) return;
  const n = radial(body.position);
  body.force.x -= n.x * body.mass * P.gravity;
  body.force.y -= n.y * body.mass * P.gravity;
  body.force.z -= n.z * body.mass * P.gravity;
}
export class LoadBearingVehicle extends C.RaycastVehicle {
  updateFriction(dt) {
    for (const w of this.wheelInfos) {
      const normal = Math.min(w.suspensionForce, w.maxSuspensionForce);
      w.engineForce = clamp(w.engineForce, -P.friction * normal, P.friction * normal);
    }
    super.updateFriction(dt);
  }
  updateVehicle(dt) {
    super.updateVehicle(dt);
    for (const w of this.wheelInfos) {
      const road = w.raycastResult.body;
      if (!w.isInContact || !road || road.type !== C.Body.DYNAMIC) continue;
      const point = w.raycastResult.hitPointWorld, normal = w.raycastResult.hitNormalWorld;
      const impulse = normal.scale(-Math.min(w.suspensionForce, w.maxSuspensionForce) * dt);
      const axle = w.worldTransform.quaternion.vmult(new C.Vec3(0, 0, 1));
      const forward = normal.cross(axle);
      forward.normalize();
      impulse.vadd(forward.scale(-w.forwardImpulse), impulse);
      road.applyImpulse(impulse, point.vsub(road.position));
    }
  }
}
class FrictionSolver extends C.GSSolver {
  solve(dt, world) {
    for (const e of world.frictionEquations) {
      e.minForce *= dt;
      e.maxForce *= dt;
    }
    return super.solve(dt, world);
  }
}
export class CanyonGame {
  constructor() {
    this.world = new C.World({ gravity: new C.Vec3(), allowSleep: true });
    this.world.broadphase = new C.SAPBroadphase(this.world);
    this.world.solver = new FrictionSolver();
    this.world.solver.iterations = 80;
    this.world.solver.tolerance = 1e-4;
    this.materials = { ground: new C.Material("regolith"), block: new C.Material("construction"), pilot: new C.Material("pilot") };
    const { ground, block, pilot } = this.materials;
    for (const a of [ground, block]) this.world.addContactMaterial(new C.ContactMaterial(a, block, { friction: P.friction, restitution: 0 }));
    for (const a of [ground, block]) this.world.addContactMaterial(new C.ContactMaterial(a, pilot, { friction: 0.6, restitution: 0 }));
    this.world.defaultContactMaterial.friction = 0.6;
    this.world.frictionGravity = new C.Vec3(0, -P.gravity, 0);
    this.terrain = [];
    this.buildTerrain();
    this.pilot = new C.Body({ mass: P.pilotMass, material: pilot, fixedRotation: true, linearDamping: 0, allowSleep: false });
    this.pilot.addShape(new C.Sphere(0.3), new C.Vec3(0, -0.55, 0));
    this.pilot.addShape(new C.Box(new C.Vec3(0.26, 0.45, 0.23)));
    this.pilot.addShape(new C.Sphere(0.29), new C.Vec3(0, 0.48, 0));
    this.world.addBody(this.pilot);
    this.bridges = [];
    this.joints = [];
    this.anchors = [];
    this.events = [];
    this.parts = [];
    this.methane = 0;
    this.oxygen = 0;
    this.car = null;
    this.vehicle = null;
    this.elapsed = 0;
    this.time = 0;
    this.status = "running";
    this.reason = "";
    this.paused = false;
    this.boarded = false;
    this.filling = false;
    this.stress = 0;
    this.grounded = false;
    this.acceleration = 0;
    this.verticalAcceleration = 0;
    this.enginePower = 0;
    this.breakIndex = null;
    this.engineThrottle = 0;
    this.engineHeat = 0;
    this.overheated = false;
    this.resetPilot();
    this.checkpoint = this.configuration();
  }
  buildTerrain() {
    const size = 2;
    for (const [start, end, low] of [[-90, 0, false], [20, 100, true]]) {
      const data = [];
      for (let x = start; x <= end; x += size) {
        const row = [];
        for (let localZ = 0; localZ <= P.halfWidth * 2; localZ += size) {
          const z = P.halfWidth - localZ;
          row.push(surfaceY(x, z, low));
        }
        data.push(row);
      }
      const body = new C.Body({ mass: 0, material: this.materials.ground });
      body.addShape(new C.Heightfield(data, { elementSize: size }));
      body.position.set(start, 0, P.halfWidth);
      body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
      this.world.addBody(body);
      this.terrain.push({ body, data, start, end, size });
    }
    const vertices = [[-6, -0.12, -2.3], [0, -0.12, -2.3], [0, -0.12, 2.3], [-6, -0.12, 2.3], [-6, surfaceY(-6, 0), -2.3], [0, P.rampHeight, -2.3], [0, P.rampHeight, 2.3], [-6, surfaceY(-6, 0), 2.3]];
    const faces = [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]];
    const ramp = new C.Body({ mass: 0, material: this.materials.ground, shape: new C.ConvexPolyhedron({ vertices: vertices.map((v) => new C.Vec3(...v)), faces }) });
    this.world.addBody(ramp);
    this.ramp = { vertices, faces, body: ramp };
    const approachVertices = [
      [-2, -0.3, -1.6],
      [2, -0.3, -1.6],
      [2, -0.3, 1.6],
      [-2, -0.3, 1.6],
      [-2, surfaceY(-5, P.bridgeZ), -1.6],
      [2, surfaceY(-1, P.bridgeZ) + 0.7, -1.6],
      [2, surfaceY(-1, P.bridgeZ) + 0.7, 1.6],
      [-2, surfaceY(-5, P.bridgeZ), 1.6]
    ];
    const approach = new C.Body({ mass: 0, material: this.materials.ground, shape: new C.ConvexPolyhedron({ vertices: approachVertices.map((v) => new C.Vec3(...v)), faces }) });
    approach.collisionFilterGroup = 4;
    approach.position.set(-3, 0, P.bridgeZ);
    this.world.addBody(approach);
    this.approach = { vertices: approachVertices, faces, body: approach };
    const floor = new C.Body({ mass: 0, material: this.materials.ground, shape: new C.Box(new C.Vec3(10, 2, P.halfWidth)) });
    floor.position.set(10, P.floor - 2, 0);
    this.world.addBody(floor);
    for (const body of this.world.bodies) body.aabbNeedsUpdate = true;
  }
  get count() {
    const c = {};
    for (const p of this.parts) c[p] = (c[p] || 0) + 1;
    return c;
  }
  get capacity() {
    return (this.count.tank || 0) * P.methaneCapacity;
  }
  get dryMass() {
    return this.parts.reduce((m, p) => m + PARTS[p].mass, 0);
  }
  get mass() {
    return this.dryMass + this.methane + this.oxygen + (this.boarded ? P.pilotMass : 0);
  }
  get ready() {
    const c = this.count;
    return !!((c.small || c.long) && c.axle === 2 && c.wheel === 4 && c.engine && c.tank);
  }
  get nearGarage() {
    const p = this.boarded ? this.car.position : this.pilot.position;
    return Math.hypot(p.x - P.garageX, p.z) < 9;
  }
  get atStation() {
    return this.car && Math.hypot(this.car.position.x - P.garageX, this.car.position.z) < 6 && this.car.velocity.length() < 0.25 && this.nearGarage;
  }
  get target() {
    return this.boarded && this.car ? this.car : this.pilot;
  }
  get nearBridgehead() {
    return Math.hypot(this.pilot.position.x + 2, this.pilot.position.z - P.bridgeZ) < 5;
  }
  get nextBridgeIndex() {
    return Array.from({ length: P.bridgeCount }, (_, i) => i + 1).find((i) => !this.bridges.some((b) => b.index === i)) ?? null;
  }
  get engines() {
    return Array.from({ length: PARTS.engine.max }, (_, i) => {
      const installed = i < (this.count.engine || 0);
      const fault = this.overheated ? "overheated" : this.methane <= 1e-9 || this.oxygen <= 1e-9 ? "empty" : null;
      const throttle = installed && !fault && !this.paused && this.status === "running" && this.boarded ? this.engineThrottle : 0;
      return { state: !installed ? "absent" : fault || (throttle > 0 ? "active" : "idle"), throttle, heat: installed ? this.engineHeat : 0 };
    });
  }
  message(text) {
    this.events.push({ type: "notice", text });
    return false;
  }
  rayHit(origin, direction, distance) {
    const from = new C.Vec3(origin.x, origin.y, origin.z), to = new C.Vec3(direction.x, direction.y, direction.z).scale(distance).vadd(from);
    const hit = new C.RaycastResult();
    if (!this.world.raycastClosest(from, to, { skipBackfaces: true }, hit)) return null;
    return { bridgeIndex: this.bridges.find((b) => b.body === hit.body)?.index ?? null };
  }
  install(type) {
    if (this.paused || this.status !== "running") return false;
    if (type === "bridge") return this.addBridge();
    if (!this.nearGarage || this.boarded) return this.message("Step out in the garage to change the assembly.");
    const c = this.count;
    if (!PARTS[type]) return false;
    if (type === "small" || type === "long") {
      if (this.parts.length) return this.message("Remove the fitted parts before replacing the chassis.");
    } else if (!c.small && !c.long) return this.message("Start with a chassis. It carries the other parts.");
    if ((c[type] || 0) >= (type === "tank" ? c.long ? 2 : 1 : PARTS[type].max)) return this.message("All mounts occupied.");
    if (type === "wheel" && (c.wheel || 0) >= (c.axle || 0) * 2) return this.message("Fit an axle mount before its two wheels.");
    this.parts.push(type);
    this.rebuildCar();
    this.saveCheckpoint();
    this.events.push({ type: "assembly" });
    return true;
  }
  removePart() {
    if (this.paused || this.status !== "running" || !this.nearGarage || this.boarded || !this.parts.length) return false;
    this.parts.pop();
    this.methane = Math.min(this.methane, this.capacity);
    this.oxygen = this.methane * P.mixture;
    this.rebuildCar();
    this.saveCheckpoint();
    this.events.push({ type: "assembly" });
    return true;
  }
  rebuildCar(position = null) {
    if (this.vehicle) this.vehicle.removeFromWorld(this.world);
    else if (this.car) this.world.removeBody(this.car);
    this.car = null;
    this.vehicle = null;
    if (!this.parts.length) return;
    const c = this.count, length = c.long ? 3.7 : 2.8;
    const body = new C.Body({ mass: this.mass, material: this.materials.block, linearDamping: 2e-3, angularDamping: 0.24, allowSleep: false });
    body.addShape(new C.Box(new C.Vec3(length / 2, 0.14, 0.73)));
    for (const p2 of engineMounts(c.long).slice(0, c.engine || 0)) body.addShape(new C.Box(new C.Vec3(0.29, 0.3, 0.24)), new C.Vec3(p2.x, p2.y, p2.z));
    const p = position || { x: P.garageX, y: surfaceY(P.garageX, 0) + 0.86, z: 0 };
    body.position.copy(p);
    body.quaternion.copy(frameAt(body.position));
    this.car = body;
    if (this.ready) {
      const v = new LoadBearingVehicle({ chassisBody: body, indexRightAxis: 2, indexForwardAxis: 0, indexUpAxis: 1 });
      for (const x of [length * 0.35, -length * 0.35]) for (const z of [-0.93, 0.93]) v.addWheel({
        radius: P.wheelRadius,
        directionLocal: new C.Vec3(0, -1, 0),
        axleLocal: new C.Vec3(0, 0, 1),
        chassisConnectionPointLocal: new C.Vec3(x, -0.08, z),
        suspensionRestLength: 0.35,
        suspensionStiffness: 32,
        dampingRelaxation: 3.5,
        dampingCompression: 4.5,
        frictionSlip: P.friction,
        rollInfluence: 0.08,
        maxSuspensionForce: 1400,
        maxSuspensionTravel: 0.22,
        customSlidingRotationalSpeed: -20,
        useCustomSlidingRotationalSpeed: true
      });
      v.addToWorld(this.world);
      this.vehicle = v;
    } else {
      body.type = C.Body.KINEMATIC;
      this.world.addBody(body);
    }
  }
  updateMass() {
    if (this.car) {
      this.car.mass = this.mass;
      this.car.updateMassProperties();
    }
  }
  board() {
    if (this.paused || this.status !== "running") return false;
    if (this.boarded) {
      if (this.car.velocity.length() > 0.4 || this.vehicle.numWheelsOnGround < 2) return this.message("Stop on solid ground before stepping out.");
      const offset = this.car.quaternion.vmult(new C.Vec3(0, 0.25, 2));
      const p = this.car.position.vadd(offset);
      if (p.x > 0 && p.x < P.farRim) return this.message("Stay seated over the canyon. Stop on either bank to exit.");
      this.boarded = false;
      this.world.addBody(this.pilot);
      this.pilot.position.copy(p);
      this.pilot.velocity.setZero();
      this.updateMass();
      return true;
    }
    if (!this.ready) return this.message("Fit a chassis, 2 axle mounts, 4 wheels, an engine and a tank.");
    if (this.pilot.position.distanceTo(this.car.position) > 5) return this.message("Walk closer to your rover.");
    this.saveCheckpoint();
    this.boarded = true;
    this.world.removeBody(this.pilot);
    this.updateMass();
    return true;
  }
  toggleFuel() {
    if (this.paused || this.status !== "running") return false;
    if (this.filling) {
      this.filling = false;
      this.saveCheckpoint();
      return true;
    }
    if (!this.atStation || !this.capacity) return this.message("Park beside the fuel station with a tank fitted.");
    if (this.methane >= this.capacity - 1e-3) return this.message("Tanks full. Extra propellant adds mass.");
    this.filling = true;
    return true;
  }
  addBridge() {
    if (this.paused || this.status !== "running") return false;
    if (this.boarded) return this.message("Step out to operate the bridge assembly boom.");
    if (!(this.nearGarage || this.nearBridgehead)) return this.message("Build at the garage or near-bank bridgehead.");
    if (this.bridges.some((b) => b.broken)) return this.message("A joint has failed. R restores your last checkpoint.");
    if (this.bridges.length === P.bridgeCount) return this.message("Both banks connected. Walk across or take a light rover.");
    const index = this.nextBridgeIndex, slot = bridgeSlot(index);
    const { startX, endX, startY, endY, angle, length } = slot;
    const body = new C.Body({ mass: P.bridgeMass, material: this.materials.block, linearDamping: 0.025, angularDamping: 0.12, allowSleep: false });
    body.collisionFilterMask = ~4;
    body.addShape(new C.Box(new C.Vec3(length / 2 - 0.014, 0.13, 1.6)));
    body.position.set(slot.x, slot.y, slot.z);
    body.quaternion.setFromEuler(0, 0, angle);
    body.bridgeRest = { position: body.position.clone(), quaternion: body.quaternion.clone() };
    this.world.addBody(body);
    const block = { body, length, index, stress: 0, peak: 0, broken: false };
    this.bridges.push(block);
    this.bridges.sort((a, b) => a.index - b.index);
    if (index === 1) {
      const anchor = new C.Body({ mass: 0 });
      anchor.position.set(startX, startY - 0.13, P.bridgeZ);
      this.world.addBody(anchor);
      this.anchors.push(anchor);
      this.connect(anchor, body, 1);
    }
    const previous = this.bridges.find((b) => b.index === index - 1), next = this.bridges.find((b) => b.index === index + 1);
    if (previous) this.connect(previous.body, body, index);
    if (next) this.connect(body, next.body, index + 1);
    if (index === P.bridgeCount) {
      const anchor = new C.Body({ mass: 0 });
      anchor.position.set(endX, endY - 0.13, P.bridgeZ);
      this.world.addBody(anchor);
      this.anchors.push(anchor);
      this.connect(body, anchor, P.bridgeCount + 1);
    }
    this.supportBridgeTips();
    this.saveCheckpoint();
    this.events.push({ type: "bridge" });
    return true;
  }
  supportBridgeTips() {
    for (const block of this.bridges) {
      const freeStart = block.index > 1 && !this.bridges.some((b) => b.index === block.index - 1);
      const freeEnd = block.index < P.bridgeCount && !this.bridges.some((b) => b.index === block.index + 1);
      const type = freeStart || freeEnd ? C.Body.KINEMATIC : C.Body.DYNAMIC;
      if (block.body.type === type) continue;
      block.body.type = type;
      if (type === C.Body.KINEMATIC) {
        block.body.position.copy(block.body.bridgeRest.position);
        block.body.quaternion.copy(block.body.bridgeRest.quaternion);
        block.body.velocity.setZero();
        block.body.angularVelocity.setZero();
        block.body.aabbNeedsUpdate = true;
      }
      block.body.updateMassProperties();
      block.body.wakeUp();
    }
  }
  connect(a, b, index) {
    const poses = [a, b].map((body) => ({ body, position: body.position.clone(), quaternion: body.quaternion.clone() }));
    for (const { body } of poses) if (body.bridgeRest) {
      body.position.copy(body.bridgeRest.position);
      body.quaternion.copy(body.bridgeRest.quaternion);
    }
    const constraint = new C.LockConstraint(a, b, { maxForce: 1e7 });
    for (const { body, position, quaternion } of poses) {
      body.position.copy(position);
      body.quaternion.copy(quaternion);
    }
    for (const e of constraint.equations) e.setSpookParams(4e7, 5, P.step);
    constraint.collideConnected = false;
    this.world.addConstraint(constraint);
    this.joints.push({ constraint, index, stress: 0, impulse: 0, broken: false });
  }
  clearBridge() {
    for (const j of this.joints) if (!j.broken) this.world.removeConstraint(j.constraint);
    for (const b of this.bridges) this.world.removeBody(b.body);
    for (const b of this.anchors) this.world.removeBody(b);
    this.bridges = [];
    this.joints = [];
    this.anchors = [];
    this.breakIndex = null;
    this.stress = 0;
  }
  removeBridge(index = this.bridges.at(-1)?.index) {
    if (this.paused || this.status !== "running" || this.boarded || !(this.nearGarage || this.nearBridgehead) || !this.bridges.length) return false;
    if (this.breakIndex) return this.message("Joint broken. R restores the checkpoint.");
    const last = this.bridges.find((b) => b.index === index);
    if (!last) return false;
    this.bridges = this.bridges.filter((b) => b !== last);
    for (const j of this.joints.filter((j2) => j2.constraint.bodyA === last.body || j2.constraint.bodyB === last.body)) this.world.removeConstraint(j.constraint);
    this.joints = this.joints.filter((j) => j.constraint.bodyA !== last.body && j.constraint.bodyB !== last.body);
    this.world.removeBody(last.body);
    for (const anchor of [...this.anchors]) if (!this.joints.some((j) => j.constraint.bodyA === anchor || j.constraint.bodyB === anchor)) {
      this.world.removeBody(anchor);
      this.anchors.splice(this.anchors.indexOf(anchor), 1);
    }
    this.supportBridgeTips();
    this.saveCheckpoint();
    this.events.push({ type: "bridge" });
    return true;
  }
  configuration() {
    return { parts: [...this.parts], methane: this.methane, oxygen: this.oxygen, decks: this.bridges.length, deckSlots: this.bridges.map((b) => b.index), atBridge: !this.nearGarage };
  }
  saveCheckpoint() {
    if (this.status !== "running" || this.bridges.some((b) => b.broken)) return;
    if (!this.nearGarage && this.target.position.x > 0) return;
    this.checkpoint = this.configuration();
  }
  resetPilot(atBridge = false) {
    const x = atBridge ? -5.5 : P.garageX - 0.5, z = atBridge ? P.bridgeZ : 2.6;
    this.pilot.position.set(x, surfaceY(x, z) + 0.86, z);
    this.pilot.velocity.setZero();
    this.pilot.angularVelocity.setZero();
    this.pilot.quaternion.copy(frameAt(this.pilot.position));
    this.pilot.aabbNeedsUpdate = true;
    this.grounded = false;
  }
  retry(fresh = false) {
    const checkpoint = fresh ? { parts: [], methane: 0, oxygen: 0, decks: 0, atBridge: false } : this.checkpoint;
    if (!fresh && this.elapsed >= P.timeLimit) return false;
    if (fresh) {
      this.elapsed = 0;
      this.time = 0;
    }
    if (this.boarded) this.world.addBody(this.pilot);
    this.boarded = false;
    this.paused = false;
    this.filling = false;
    this.status = "running";
    this.reason = "";
    this.result = null;
    this.acceleration = 0;
    this.verticalAcceleration = 0;
    this.enginePower = 0;
    this.engineThrottle = 0;
    this.engineHeat = 0;
    this.overheated = false;
    this.clearBridge();
    this.parts = [...checkpoint.parts];
    this.methane = checkpoint.methane;
    this.oxygen = checkpoint.oxygen;
    this.resetPilot();
    this.rebuildCar();
    const slots = checkpoint.deckSlots || Array.from({ length: checkpoint.decks }, (_, i) => i + 1);
    for (let i = 0; i < Math.max(0, ...slots); i++) this.addBridge();
    for (const block of [...this.bridges]) if (!slots.includes(block.index)) this.removeBridge(block.index);
    this.resetPilot(checkpoint.atBridge);
    this.checkpoint = checkpoint;
    this.events.push({ type: "reset" });
    return true;
  }
  advanceClock(dt) {
    if (this.paused || this.status === "pass") return;
    this.elapsed = Math.min(P.timeLimit, this.elapsed + dt);
    if (this.elapsed >= P.timeLimit) this.finish("fail", "Time expired");
  }
  finish(status, reason) {
    if (this.status === "pass" || this.status === status && this.reason === reason) return;
    this.status = status;
    this.reason = reason;
    this.filling = false;
    this.result = { status, reason, elapsed: this.elapsed, mass: this.car ? this.mass : P.pilotMass, parts: this.parts.length + this.bridges.length, route: this.boarded ? "Rover crossing" : "Bridge crossing" };
    this.events.push({ type: "result" });
  }
  step(dt = P.step, input = {}) {
    if (this.paused || this.status !== "running") return;
    this.time += dt;
    const before = this.target.velocity.clone(), vertical = radial(this.target.position);
    if (this.filling) {
      if (!this.atStation) {
        this.filling = false;
        this.saveCheckpoint();
      } else {
        const add = Math.min(P.fillRate * dt, this.capacity - this.methane);
        this.methane += add;
        this.oxygen += add * P.mixture;
        this.updateMass();
        if (this.methane >= this.capacity - 1e-3) {
          this.filling = false;
          this.saveCheckpoint();
        }
      }
    }
    this.enginePower = 0;
    this.engineThrottle = 0;
    if (this.overheated && this.engineHeat <= P.restartHeat) this.overheated = false;
    if (this.vehicle) {
      const throttle = this.boarded && !this.filling ? clamp(input.throttle || 0, -1, 1) : 0;
      const c = this.count, fuelAvailable = this.methane > 1e-9 && this.oxygen > 1e-9 && !this.overheated;
      const speed = this.car.velocity.length(), engines = c.engine || 0;
      let force = fuelAvailable ? throttle * Math.min(P.torque * engines / P.wheelRadius, P.power * engines / Math.max(2, speed)) : 0;
      if (force) {
        const requestedBurn = Math.abs(throttle) * P.power * engines / 1e3 * P.methanePerKJ * dt;
        const burn = Math.min(this.methane, this.oxygen / P.mixture, requestedBurn);
        const fraction = burn / requestedBurn;
        this.engineThrottle = Math.abs(throttle) * fraction;
        force *= fraction;
        this.methane = Math.max(0, this.methane - burn);
        this.oxygen = Math.max(0, this.oxygen - burn * P.mixture);
        this.updateMass();
      }
      this.enginePower = Math.min(P.power * engines, Math.abs(force) * speed);
      for (let i = 0; i < 4; i++) {
        this.vehicle.applyEngineForce(force / 4, i);
        this.vehicle.setSteeringValue(i < 2 ? -0.36 * (input.steer || 0) : 0, i);
        this.vehicle.setBrake(!this.boarded || input.brake || this.filling ? 18 : 0.02, i);
      }
    }
    this.engineHeat = clamp(this.engineHeat + (this.engineThrottle * P.heatRate - (1 - this.engineThrottle) * P.coolRate) * dt, 0, 1);
    if (this.engineHeat >= 1) this.overheated = true;
    if (!this.boarded) {
      const n2 = radial(this.pilot.position);
      this.pilot.quaternion.copy(frameAt(this.pilot.position));
      this.pilot.aabbNeedsUpdate = true;
      this.grounded = this.world.contacts.some((c) => c.bi === this.pilot && c.ni.dot(n2) < -0.45 || c.bj === this.pilot && c.ni.dot(n2) > 0.45);
      const x = input.walkX || 0, y = input.walkY || 0, z = input.walkZ || 0, length = Math.max(1, Math.hypot(x, y, z));
      const desired = new C.Vec3(x / length * 3.8, y / length * 3.8, z / length * 3.8);
      const radialPart = n2.scale(desired.dot(n2));
      desired.vsub(radialPart, desired);
      const velocity = this.pilot.velocity, vr = velocity.dot(n2), tangent = velocity.vsub(n2.scale(vr));
      if (this.grounded) {
        const delta = desired.vsub(tangent);
        delta.scale(Math.min(1, dt * 13) * this.pilot.mass / dt, delta);
        this.pilot.force.vadd(delta, this.pilot.force);
        if (input.jump) {
          velocity.vadd(n2.scale(3.2), velocity);
          this.grounded = false;
        }
      }
    }
    for (const b of this.world.bodies) gravity(b);
    this.world.step(dt);
    this.stress = 0;
    for (const b of this.bridges) b.stress = 0;
    for (const j of this.joints) {
      if (j.broken) continue;
      const e = j.constraint.equations;
      const linear = Math.hypot(...e.slice(0, 3).map((x) => x.multiplier)) * dt;
      const angular = Math.hypot(...e.slice(3).map((x) => x.multiplier)) * dt;
      j.impulse = linear;
      j.stress = Math.max(linear / (P.jointForce * dt), angular / (P.jointTorque * dt));
      this.stress = Math.max(this.stress, j.stress);
      for (const b of this.bridges) if (b.body === j.constraint.bodyA || b.body === j.constraint.bodyB) {
        b.stress = Math.max(b.stress, j.stress);
        b.peak = Math.max(b.peak, j.stress);
      }
      if (j.stress > 1) {
        j.broken = true;
        this.world.removeConstraint(j.constraint);
        this.breakIndex ??= j.index;
        for (const b of this.bridges) if (b.body === j.constraint.bodyA || b.body === j.constraint.bodyB) b.broken = true;
        this.events.push({ type: "break", index: j.index, stress: j.stress });
      }
    }
    for (const b of this.bridges) b.displayStress = Math.max(b.stress, (b.displayStress || 0) * Math.exp(-dt / 0.65));
    const t = this.target, n = radial(t.position), forward = this.boarded ? t.quaternion.vmult(new C.Vec3(1, 0, 0)) : new C.Vec3(1, 0, 0);
    const raw = t.velocity.vsub(before).dot(forward) / dt;
    this.verticalAcceleration = t.velocity.vsub(before).dot(vertical) / dt;
    this.acceleration += (raw - this.acceleration) * (1 - Math.exp(-dt / 0.2));
    if (this.boarded) this.grounded = this.vehicle.numWheelsOnGround > 1;
    const p = t.position;
    if (p.y < -8.5 && p.x < P.farRim + 1 && p.x > -2) this.finish("fail", this.breakIndex ? `Bridge joint ${this.breakIndex} failed` : "Fell into the canyon");
    else if (p.y < P.floor + 0.6 || Math.abs(p.z) > P.halfWidth - 2 || p.x < -86 || p.x > 95) this.finish("fail", "Left the course");
    else if (this.boarded && this.grounded && t.quaternion.vmult(new C.Vec3(0, 1, 0)).dot(n) < 0.1) this.finish("fail", "Rover overturned");
    else if (p.x >= P.flagX && Math.abs(p.z) < 12 && this.grounded && p.y < surfaceY(p.x, p.z, true) + 3) this.finish("pass", "Reached the far-bank flag");
  }
  snapshot() {
    return {
      time: this.time,
      elapsed: this.elapsed,
      remaining: Math.max(0, P.timeLimit - this.elapsed),
      status: this.status,
      reason: this.reason,
      paused: this.paused,
      boarded: this.boarded,
      grounded: this.grounded,
      ready: this.ready,
      filling: this.filling,
      parts: [...this.parts],
      counts: this.count,
      methane: this.methane,
      oxygen: this.oxygen,
      capacity: this.capacity,
      mass: this.mass,
      dryMass: this.dryMass,
      pilotMass: P.pilotMass,
      speed: this.target.velocity.length(),
      acceleration: this.acceleration,
      verticalAcceleration: this.verticalAcceleration,
      power: this.enginePower,
      engines: this.engines,
      stress: this.stress,
      breakIndex: this.breakIndex,
      distance: Math.max(0, P.farRim - this.target.position.x),
      height: this.target.position.y - P.floor,
      pilot: { position: vec(this.pilot.position), velocity: vec(this.pilot.velocity) },
      car: this.car ? { position: vec(this.car.position), velocity: vec(this.car.velocity), quaternion: { ...this.car.quaternion }, contacts: this.vehicle?.numWheelsOnGround || 0, mass: this.car.mass } : null,
      bridges: this.bridges.map((b) => ({ index: b.index, position: vec(b.body.position), stress: b.stress, displayStress: b.displayStress || 0, peak: b.peak, broken: b.broken })),
      joints: this.joints.map((j) => ({ index: j.index, stress: j.stress, impulse: j.impulse, broken: j.broken })),
      checkpoint: { ...this.checkpoint, parts: [...this.checkpoint.parts], deckSlots: [...this.checkpoint.deckSlots || []] },
      result: this.result ? { ...this.result } : null
    };
  }
}
