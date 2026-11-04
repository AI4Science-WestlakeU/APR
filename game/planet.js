import * as THREE from "three";
export const RADIUS = 400;
export const CENTER = new THREE.Vector3(0, -RADIUS, 0);
export const UP = new THREE.Vector3(0, 1, 0);
export const radial = (p) => new THREE.Vector3(p.x, p.y, p.z).sub(CENTER).normalize();
export const altitude = (p) => Math.hypot(p.x - CENTER.x, p.y - CENTER.y, p.z - CENTER.z) - RADIUS;
export const atHeight = (p, h) => radial(p).multiplyScalar(RADIUS + h).add(CENTER);
export function surfacePoint(x, z, h = 0) {
  const distance = Math.hypot(x, z), angle = distance / RADIUS;
  const n = distance ? new THREE.Vector3(x / distance * Math.sin(angle), Math.cos(angle), z / distance * Math.sin(angle)) : UP.clone();
  return n.multiplyScalar(RADIUS + h).add(CENTER);
}
export function surfaceQuaternion(p, angle = 0) {
  return new THREE.Quaternion().setFromUnitVectors(UP, radial(p)).multiply(new THREE.Quaternion().setFromAxisAngle(UP, angle));
}
export function transportFrame(frame, previousUp, nextUp) {
  frame.premultiply(new THREE.Quaternion().setFromUnitVectors(previousUp, nextUp)).normalize();
}
export function applyGravity(body, g) {
  if (body.mass === 0 || body.type !== 1 || body.sleepState === 2) return;
  const n = radial(body.position);
  body.force.x -= n.x * body.mass * g;
  body.force.y -= n.y * body.mass * g;
  body.force.z -= n.z * body.mass * g;
}
export function motionSample(body, previousVelocity, dt) {
  const n = radial(body.position), v = body.velocity;
  return {
    speed: v.length(),
    radialVelocity: v.x * n.x + v.y * n.y + v.z * n.z,
    acceleration: ((v.x - previousVelocity.x) * n.x + (v.y - previousVelocity.y) * n.y + (v.z - previousVelocity.z) * n.z) / dt
  };
}
export function smoothMotion(display, sample, dt) {
  const blend = 1 - Math.exp(-dt / 0.16);
  display.speed += (sample.speed - display.speed) * blend;
  display.acceleration += (sample.acceleration - display.acceleration) * blend;
}
