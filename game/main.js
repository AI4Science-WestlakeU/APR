import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { CanyonGame, P, KIT, PARTS, radial, groundY, bridgeSlot } from "./physics.js?v=cb240510343fb7ac";
import { makeLandscape } from "./landscape.js?v=cb240510343fb7ac";
import { makeRover, makeDeck, disposeView } from "./vehicle-view.js?v=cb240510343fb7ac";
import { mascotToon, INK, SUN_DIRECTION } from "./style.js?v=cb240510343fb7ac";
import { makeSky } from "./sky.js?v=cb240510343fb7ac";
const icons = {
  small: '<path d="M7 18 24 10 45 18 28 27Z M7 18v7l21 8 17-9v-6 M28 27v6"/><path d="m16 17 10-4 10 4-10 5Z"/>',
  long: '<path d="M4 19 30 7 49 15 22 29Z M4 19v6l18 8 27-12v-6 M22 29v4"/><path d="m12 18 19-8m-12 12 19-8"/>',
  axle: '<path d="M7 15h9v7H7z M36 15h9v7h-9z M16 17h20v3H16z M22 12h7v15h-7z"/>',
  wheel: '<ellipse cx="26" cy="20" rx="13" ry="14"/><ellipse cx="26" cy="20" rx="7" ry="8"/><path d="m26 12 0 16m-7-8h14"/>',
  engine: '<path d="M10 15h29v15H10z M15 10h18v5H15z M39 19h6v6h-6 M6 19h4v7H6"/><path d="m17 20 0 6m6-6v6m6-6v6"/>',
  tank: '<rect x="10" y="10" width="13" height="23" rx="6"/><rect x="28" y="10" width="13" height="23" rx="6"/><path d="M14 10V6h5v4m13 0V6h5v4M11 19h11m7 0h11"/>',
  bridge: '<path d="M4 16 28 8 48 18 24 28Z M4 16v6l20 10 24-9v-5 M24 28v4"/><path d="m13 13 20 10m-12-13 20 10M6 24l3-5m33 7 3-6"/>'
};
const formatTime = (t) => `${Math.floor(Math.max(0, t) / 60).toString().padStart(2, "0")}:${Math.floor(Math.max(0, t) % 60).toString().padStart(2, "0")}`;
const rounded = (n, d = 1) => (Math.abs(n) < 0.5 * 10 ** -d ? 0 : n).toFixed(d);
export async function startGame({ start = performance.now() } = {}) {
  const $ = (id) => document.getElementById(id), canvas = $("world"), yard = $("yard");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.35));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(198670);
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 1100);
  scene.add(new THREE.AmbientLight(16773343, 0.6));
  const sun = new THREE.DirectionalLight(16774104, 2.1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 0.1, far: 150 });
  sun.shadow.normalBias = 0.035;
  sun.shadow.bias = -2e-4;
  scene.add(sun, sun.target);
  const game = new CanyonGame();
  await document.fonts.load('700 12px "Open Sans SemiCondensed"');
  const landscape = makeLandscape(scene, game);
  const [sky, gltf] = await Promise.all([makeSky(scene), new GLTFLoader().loadAsync("./assets/mascot.gltf")]);
  const actor = new THREE.Group(), mascot = gltf.scene;
  actor.add(mascot);
  scene.add(actor);
  const bounds = new THREE.Box3().setFromObject(mascot), scale = 1.85 / (bounds.max.y - bounds.min.y);
  mascot.scale.setScalar(scale);
  mascot.position.y = -bounds.min.y * scale;
  const white = mascotToon(16777215), navy = mascotToon(INK), yellow = mascotToon(15716697);
  const visor = mascotToon(INK, { emissive: INK, emissiveIntensity: 0.45 });
  const features = new THREE.MeshBasicMaterial({ color: 1058878 }), glints = new THREE.MeshBasicMaterial({ color: 16777215 });
  mascot.traverse((o) => {
    if (!o.isMesh) return;
    const isInk = /Outline|Ink/.test(o.name);
    o.castShadow = !isInk;
    o.receiveShadow = false;
    if (/^Face.*Glint/.test(o.name)) {
      o.material = glints;
      return;
    }
    if (/^Face.*(Eye|Mouth)/.test(o.name)) {
      o.material = features;
      return;
    }
    if (isInk) {
      o.material.color.setHex(INK);
      return;
    }
    if (/^Visor[._]?panel$/.test(o.name)) {
      o.material = visor;
      o.position.z += 4e-3;
      return;
    }
    o.material = /^Antenna[._]?ball$/.test(o.name) ? yellow : o.material.name.includes("Navy") ? navy : white;
  });
  const mixer = new THREE.AnimationMixer(mascot), clip = THREE.AnimationClip.findByName(gltf.animations, "Walk.cycle");
  if (!clip) throw new Error("Mascot walking animation is missing.");
  const walk = mixer.clipAction(clip);
  walk.play();
  walk.setEffectiveWeight(0);
  let rover = null;
  const decks = /* @__PURE__ */ new Map();
  const preview = new THREE.Mesh(new THREE.BoxGeometry(1, 0.26, 3.2), new THREE.MeshBasicMaterial({ color: 15716697, transparent: true, opacity: 0.35, depthWrite: false }));
  preview.add(new THREE.LineSegments(new THREE.EdgesGeometry(preview.geometry), new THREE.LineBasicMaterial({ color: 16771484 })));
  preview.visible = false;
  scene.add(preview);
  const raycaster = new THREE.Raycaster();
  let selected = 0, last = 0, accumulator = 0, uiClock = 0, active = true, visible = true, modal = null;
  let yaw = 0.67, pitch = 0.36, heading = Math.PI / 2, pointer = null, noticeUntil = 0, jump = false;
  let frameHandle = 0, renderTime = 0, frames = [], simCosts = [];
  const keys = /* @__PURE__ */ new Set(), target = new THREE.Vector3(), viewTarget = new THREE.Vector3(), viewGoal = new THREE.Vector3();
  const stick = { x: 0, y: 0, id: null }, touchQuery = matchMedia("(pointer: coarse)");
  let locked = false, lockPending = false, intentionalUnlock = false, lastControls = {};
  const reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");
  const focus = () => canvas.focus({ preventScroll: true });
  const hudModes = ["full", "compact", "hidden"], hudKey = "mission-possible-hud";
  let hudMode = "full";
  try {
    const saved = localStorage.getItem(hudKey);
    if (hudModes.includes(saved)) hudMode = saved;
  } catch {
  }
  function setHUD(mode, save = true) {
    hudMode = mode;
    yard.dataset.hudMode = mode;
    $("hud").inert = mode === "hidden";
    for (const panel of yard.querySelectorAll(".hud-detail")) panel.inert = mode !== "full";
    $("fullscreen").inert = mode === "hidden";
    const next = hudModes[(hudModes.indexOf(mode) + 1) % hudModes.length];
    $("hud-toggle").setAttribute("aria-label", `HUD: ${mode}. Switch to ${next}`);
    $("hud-toggle").title = `HUD: ${mode} \u2192 ${next} \xB7 H`;
    if (save) {
      try {
        localStorage.setItem(hudKey, mode);
      } catch {
      }
    }
  }
  function cycleHUD() {
    setHUD(hudModes[(hudModes.indexOf(hudMode) + 1) % hudModes.length]);
    keys.clear();
    if (modal) $(modal).querySelector("button:not([hidden]):not(:disabled)")?.focus({ preventScroll: true });
    else focus();
  }
  function tell(text, seconds = 5) {
    $("notice").textContent = text;
    noticeUntil = game.time + seconds;
  }
  function rebuild() {
    if (rover) disposeView(rover.root);
    rover = makeRover(game);
    scene.add(rover.root);
    renderChecklist();
  }
  function renderHotbar() {
    $("hotbar").innerHTML = KIT.map((type, i) => `<button class="slot" data-slot="${i}" aria-label="${i + 1}: ${PARTS[type].name}, ${PARTS[type].mass} kg" title="${PARTS[type].name} \xB7 ${PARTS[type].mass} kg" aria-pressed="${selected === i}"><span class="slot-key">${i + 1}</span><svg class="part-icon" viewBox="0 0 52 38" aria-hidden="true">${icons[type]}</svg></button>`).join("");
    const part = PARTS[KIT[selected]];
    $("selection-name").innerHTML = `${part.name.toUpperCase()} <small>${part.mass} kg</small>`;
    $("install").innerHTML = `Fit ${KIT[selected] === "bridge" ? "part" : part.name.toLowerCase()} <kbd>B</kbd>`;
  }
  function renderChecklist() {
    const c = game.count;
    const rows = [["Chassis", c.small || c.long || 0, 1, 1], ["Axle mounts", c.axle || 0, 2, 2], ["Wheels", c.wheel || 0, 4, 4], ["Engines", c.engine || 0, 1, 4], ["Propellant tanks", c.tank || 0, 1, c.long ? 2 : 1]];
    $("assembly-list").innerHTML = rows.map(([name, n, required, max]) => `<div class="assembly-row ${n >= required ? "complete" : ""}"><span><span class="check">${n >= required ? "\u2713" : "\xB7"}</span>${name}</span><output>${n} / ${max}</output></div>`).join("");
    $("part-count").textContent = `${game.parts.length} fitted \xB7 ${game.dryMass} kg dry`;
    $("board").disabled = !game.ready;
  }
  function select(i) {
    selected = (i + KIT.length) % KIT.length;
    renderHotbar();
    focus();
  }
  function install() {
    if (KIT[selected] === "bridge") {
      tell("Aim at the deck outline \xB7 click: place");
      return;
    }
    if (game.install(KIT[selected])) {
      if (KIT[selected] === "bridge") tell(`${game.bridges.length} / 10 decks connected`);
      else tell(game.ready ? "Rover ready \xB7 F: fuel \xB7 E: board" : `${PARTS[KIT[selected]].name} fitted \xB7 +${PARTS[KIT[selected]].mass} kg`);
    }
    events();
    focus();
  }
  function remove() {
    game.removePart();
    events();
    focus();
  }
  function aimedBlock() {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const candidates = [...decks.values()].map((view) => view.deck);
    if (preview.visible) candidates.push(preview);
    const hit = raycaster.intersectObjects(candidates, false)[0];
    if (!hit) return null;
    const obstruction = game.rayHit(raycaster.ray.origin, raycaster.ray.direction, hit.distance - 0.05);
    if (obstruction && obstruction.bridgeIndex !== hit.object.userData.bridgeIndex) return null;
    return { kind: hit.object === preview ? "place" : "remove", index: hit.object.userData.bridgeIndex };
  }
  function placeBlock() {
    if (modal || game.boarded || KIT[selected] !== "bridge") return;
    if (aimedBlock()?.kind !== "place") {
      tell("Aim at the deck outline");
      return;
    }
    if (game.addBridge()) tell(`${game.bridges.length} / 10 decks connected`);
    events();
    syncGraphics(0);
    focus();
  }
  function removeBlock() {
    if (modal || game.boarded) return;
    const hit = aimedBlock();
    if (hit?.kind === "remove") game.removeBridge(hit.index);
    else tell("Aim at a bridge deck");
    events();
    syncGraphics(0);
    focus();
  }
  function releaseMouse() {
    if (document.pointerLockElement === canvas) {
      intentionalUnlock = true;
      document.exitPointerLock();
    }
  }
  function lockMouse() {
    if (modal || touchQuery.matches || document.pointerLockElement === canvas || lockPending) return;
    if (!canvas.requestPointerLock) {
      tell("Mouse lock unavailable \xB7 use keyboard or touch controls");
      return;
    }
    focus();
    lockPending = true;
    try {
      const request = canvas.requestPointerLock();
      request?.catch(() => {
        lockPending = false;
        tell("Click the scene to capture the mouse");
      });
    } catch {
      lockPending = false;
      tell("Mouse lock unavailable in this browser or embed");
    }
  }
  function setBench(open) {
    $("bench-content").hidden = !open;
    $("bench-toggle").textContent = open ? "\u2212" : "+";
    $("bench-toggle").setAttribute("aria-label", `${open ? "Collapse" : "Expand"} assembly panel`);
    $("bench-toggle").setAttribute("aria-expanded", String(open));
  }
  function toggleParts() {
    if (document.pointerLockElement === canvas || $("bench-content").hidden) {
      setHUD("full");
      setBench(true);
      releaseMouse();
      focus();
    } else {
      setBench(false);
      lockMouse();
    }
  }
  function board() {
    if (game.board()) {
      if (game.boarded) {
        const forward = new THREE.Vector3(1, 0, 0).applyQuaternion(game.car.quaternion);
        yaw = Math.atan2(-forward.z, forward.x);
        pitch = 0.3;
      }
      tell(game.boarded ? game.methane ? "W: accelerate \xB7 Space: brake" : "Empty \xB7 F: refuel" : "On foot \xB7 Space: jump");
    }
    events();
    focus();
  }
  function fuel() {
    if (game.toggleFuel()) tell(game.filling ? "Refuelling \xB7 F: stop" : "Fuel saved");
    events();
    focus();
  }
  function setModal(id) {
    modal = id;
    for (const m of ["paused", "help", "result"]) $(m).hidden = m !== id;
    game.paused = id === "paused" || id === "help";
    keys.clear();
    jump = false;
    pointer = null;
    resetStick();
    accumulator = 0;
    last = 0;
    if (id) releaseMouse();
    if (id) $(id).querySelector("button:not([hidden]):not(:disabled)")?.focus({ preventScroll: true });
    else focus();
  }
  function pause(reason = "Physics and timer paused.") {
    if (!active || game.status === "pass") return;
    $("pause-reason").textContent = reason;
    setModal("paused");
  }
  function resume() {
    if (visible && !document.hidden) {
      setModal(game.status === "running" ? null : "result");
      lockMouse();
    }
  }
  function retry(fresh) {
    if (!game.retry(fresh)) {
      tell("The clock expired. Start a new run.");
      return;
    }
    if (fresh) {
      selected = 0;
      renderHotbar();
    }
    setModal(null);
    yaw = 0.67;
    pitch = 0.36;
    viewTarget.copy(game.pilot.position);
    events();
    tell(fresh ? "B: fit \xB7 click: capture mouse" : "Checkpoint restored \xB7 timer kept");
  }
  function result() {
    const r = game.result;
    if (!r) return;
    $("result-title").textContent = r.status.toUpperCase();
    $("result-reason").textContent = r.reason;
    $("result").querySelector(".result-sheet").classList.toggle("fail", r.status === "fail");
    $("result-mass-label").textContent = game.car ? "ROVER MASS" : "PILOT MASS";
    $("result-time").textContent = formatTime(r.elapsed);
    $("result-mass").textContent = `${r.mass.toFixed(1)} kg`;
    $("result-parts").textContent = r.parts;
    $("result-note").textContent = r.status === "pass" ? r.route : r.reason === "Time expired" ? "15-minute limit reached" : "Retry keeps elapsed time \xB7 P: pause";
    $("retry").hidden = r.status === "pass" || game.elapsed >= P.timeLimit;
    setModal("result");
  }
  function events() {
    for (const event of game.events.splice(0)) {
      if (event.type === "notice") tell(event.text);
      if (event.type === "assembly") rebuild();
      if (event.type === "reset") {
        rebuild();
        for (const d of decks.values()) {
          d.deck.material.dispose();
          disposeView(d.root);
        }
        decks.clear();
      }
      if (event.type === "break") tell(`Joint ${event.index} broke at ${Math.round(event.stress * 100)}% load. R restores your checkpoint.`, 7);
      if (event.type === "result") result();
    }
  }
  function input() {
    const down = (...codes) => codes.some((c) => keys.has(c));
    const forward = THREE.MathUtils.clamp(Number(down("KeyW", "ArrowUp")) - Number(down("KeyS", "ArrowDown")) - stick.y, -1, 1);
    const right = THREE.MathUtils.clamp(Number(down("KeyD", "ArrowRight")) - Number(down("KeyA", "ArrowLeft")) + stick.x, -1, 1);
    const up = new THREE.Vector3().copy(radial(game.target.position));
    const ahead = camera.getWorldDirection(new THREE.Vector3());
    ahead.addScaledVector(up, -ahead.dot(up)).normalize();
    const side = new THREE.Vector3().crossVectors(ahead, up).normalize();
    const direction = ahead.multiplyScalar(forward).addScaledVector(side, right);
    if (direction.length() > 1) direction.normalize();
    let throttle = 0, steer = 0;
    if (game.boarded && direction.lengthSq() > 1e-3) {
      throttle = (forward < -0.05 ? -1 : 1) * Math.min(1, Math.hypot(forward, right));
      const carForward = new THREE.Vector3(1, 0, 0).applyQuaternion(game.car.quaternion);
      carForward.addScaledVector(up, -carForward.dot(up)).normalize();
      const carRight = new THREE.Vector3().crossVectors(carForward, up).normalize();
      const desired = direction.clone().multiplyScalar(Math.sign(throttle));
      const error = Math.atan2(desired.dot(carRight), desired.dot(carForward));
      steer = THREE.MathUtils.clamp(error * 1.8 * Math.sign(throttle), -1, 1);
    }
    const value = { throttle, steer, brake: down("Space"), walkX: direction.x, walkY: direction.y, walkZ: direction.z, jump };
    lastControls = value;
    return value;
  }
  function syncGraphics(dt) {
    const body = game.target, up = new THREE.Vector3().copy(radial(body.position));
    if (rover && game.car) {
      rover.root.position.copy(game.car.position);
      rover.root.quaternion.copy(game.car.quaternion);
      if (game.vehicle) for (let i = 0; i < rover.wheels.length; i++) {
        game.vehicle.updateWheelTransform(i);
        const transform = game.vehicle.getWheelTransformWorld(i), wheel2 = rover.wheels[i];
        wheel2.position.copy(transform.position).sub(rover.root.position).applyQuaternion(rover.root.quaternion.clone().invert());
        wheel2.quaternion.copy(rover.root.quaternion).invert().multiply(new THREE.Quaternion().copy(transform.quaternion));
      }
    }
    const existingDecks = new Set(game.bridges.map((b) => b.body.id));
    for (const [id, view] of decks) if (!existingDecks.has(id)) {
      view.deck.material.dispose();
      disposeView(view.root);
      decks.delete(id);
    }
    for (const block of game.bridges) {
      if (!decks.has(block.body.id)) {
        const view2 = makeDeck(block);
        scene.add(view2.root);
        decks.set(block.body.id, view2);
      }
      const view = decks.get(block.body.id);
      view.root.position.copy(block.body.position);
      view.root.quaternion.copy(block.body.quaternion);
      view.deck.userData.bridgeIndex = block.index;
      const color = block.broken || block.displayStress >= 0.8 ? 14120545 : block.displayStress >= 0.35 ? 15058780 : 9420187;
      view.deck.material.color.setHex(color);
    }
    if (game.boarded) {
      actor.position.copy(game.car.position).add(new THREE.Vector3(0.52, 0.31, 0).applyQuaternion(rover.root.quaternion));
      actor.quaternion.copy(game.car.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2));
      actor.scale.setScalar(0.8);
      walk.setEffectiveWeight(0);
    } else {
      actor.scale.setScalar(1);
      actor.position.copy(game.pilot.position).addScaledVector(up, -0.85);
      const velocity = new THREE.Vector3().copy(game.pilot.velocity).applyQuaternion(new THREE.Quaternion().copy(game.pilot.quaternion).invert());
      const moving = game.grounded && Math.hypot(velocity.x, velocity.z) > 0.2;
      if (moving) {
        const next = Math.atan2(velocity.x, velocity.z);
        heading += Math.atan2(Math.sin(next - heading), Math.cos(next - heading)) * Math.min(1, 12 * dt);
      }
      actor.quaternion.copy(game.pilot.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), heading));
      walk.setEffectiveWeight(moving ? 1 : 0);
      walk.setEffectiveTimeScale(Math.max(0.6, Math.hypot(velocity.x, velocity.z) / 2.5));
    }
    if (!game.paused && game.status === "running") mixer.update(dt);
    const ahead = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    ahead.addScaledVector(up, -ahead.dot(up)).normalize();
    const side = new THREE.Vector3().crossVectors(ahead, up).normalize();
    target.copy(body.position).addScaledVector(up, 1).addScaledVector(side, 0.85);
    viewTarget.lerp(target, reducedQuery.matches ? 1 : 1 - Math.exp(-5 * dt));
    const distance = game.boarded ? 12 : 10;
    const look2 = ahead.clone().multiplyScalar(Math.cos(pitch)).addScaledVector(up, -Math.sin(pitch));
    viewGoal.copy(viewTarget).addScaledVector(look2, -distance);
    viewGoal.y = Math.max(viewGoal.y, groundY(viewGoal.x, viewGoal.z) + 0.6, body.position.y + up.y * 3.4);
    camera.position.copy(viewGoal);
    camera.up.copy(up);
    camera.lookAt(viewGoal.clone().add(look2));
    camera.updateMatrixWorld();
    preview.visible = KIT[selected] === "bridge" && !game.boarded && game.nextBridgeIndex !== null && !game.breakIndex;
    if (preview.visible) {
      const slot = bridgeSlot(game.nextBridgeIndex);
      preview.position.set(slot.x, slot.y, slot.z);
      preview.rotation.z = slot.angle;
      preview.scale.x = slot.length - 0.028;
      preview.userData.bridgeIndex = slot.index;
    }
    scene.updateMatrixWorld();
    const aim = aimedBlock();
    $("crosshair").hidden = !!modal || !(locked || touchQuery.matches);
    $("crosshair").dataset.target = aim?.kind || "";
    const lightTarget = new THREE.Vector3().copy(body.position);
    sun.target.position.copy(lightTarget);
    sun.position.copy(lightTarget).addScaledVector(SUN_DIRECTION, 85);
    sun.target.updateMatrixWorld();
    sky.update(reducedQuery.matches ? 0 : game.time, camera.position);
    $("flight-tag").hidden = !game.boarded || game.grounded || game.car.position.x < 1 || game.status !== "running";
  }
  function updateHUD() {
    const s = game.snapshot();
    $("time").textContent = formatTime(Math.ceil(s.remaining));
    $("time").parentElement.classList.toggle("urgent", s.remaining < 60);
    $("methane").innerHTML = `${s.methane.toFixed(1)} <small>kg</small>`;
    $("oxygen").innerHTML = `${s.oxygen.toFixed(1)} <small>kg</small>`;
    $("methane-bar").style.width = `${s.capacity ? s.methane / s.capacity * 100 : 0}%`;
    $("oxygen-bar").style.width = `${s.capacity ? s.oxygen / (s.capacity * P.mixture) * 100 : 0}%`;
    $("mass").innerHTML = `${(game.parts.length ? s.mass : P.pilotMass).toFixed(0)} <small>kg</small>`;
    $("speed").textContent = rounded(s.speed);
    $("kmh").textContent = (s.speed * 3.6).toFixed(0);
    $("speed-arc").style.strokeDasharray = `${Math.min(100, s.speed / 20 * 100)} 100`;
    $("power-arc").style.strokeDasharray = `${Math.min(100, s.power / (P.power * (s.counts.engine || 1)) * 100)} 100`;
    $("needle").style.transform = `rotate(${-90 + Math.min(180, s.speed / 20 * 180)}deg)`;
    $("needle-outline").style.transform = $("needle").style.transform;
    $("power").textContent = `${(s.power / 1e3).toFixed(1)} kW`;
    const engineNames = { absent: "not installed", idle: "idle", active: "thrust", empty: "propellant empty", overheated: "overheated" };
    $("engine-status").setAttribute("aria-label", `Engines: ${s.counts.engine || 0} of 4 installed`);
    for (const [i, indicator] of [...$("engine-status").children].entries()) {
      const engine = s.engines[i];
      indicator.dataset.state = engine.state;
      indicator.style.setProperty("--throttle", engine.throttle);
      indicator.textContent = ["empty", "overheated"].includes(engine.state) ? "\xD7" : "";
      indicator.title = `Engine ${i + 1}: ${engineNames[engine.state]}`;
      indicator.setAttribute("aria-label", indicator.title);
    }
    const pedal = document.querySelector('[data-hold="Space"]');
    pedal.textContent = game.boarded ? "BRAKE" : "JUMP";
    pedal.setAttribute("aria-label", game.boarded ? "Brake" : "Jump");
    $("drive-mode").textContent = game.boarded ? game.overheated ? "COOLING" : s.methane <= 1e-9 || s.oxygen <= 1e-9 ? "EMPTY" : !s.grounded ? "AIRBORNE" : keys.has("Space") ? "BRAKING" : "DRIVE" : "ON FOOT";
    const acceleration = game.boarded ? s.acceleration : s.verticalAcceleration;
    $("acceleration-label").textContent = game.boarded ? "FORWARD a" : "VERTICAL a";
    $("acceleration").innerHTML = `${rounded(acceleration, 2)} <small>m/s\xB2</small>`;
    $("g-force").innerHTML = `${rounded(acceleration / 9.80665, 2)} <small>g</small>`;
    $("hint-move").textContent = game.boarded ? "Drive" : "Walk";
    $("hint-space").textContent = game.boarded ? "Brake" : "Jump";
    $("distance").innerHTML = `${s.distance.toFixed(1)} <small>m</small>`;
    $("height").innerHTML = `${s.height.toFixed(1)} <small>m</small>`;
    $("fuel-state").textContent = s.filling ? "FILLING \u2191" : s.methane < 0.01 ? "EMPTY" : `${s.capacity.toFixed(0)} kg CH\u2084 MAX`;
    $("fuel").innerHTML = `${s.filling ? "Stop refuelling" : "Start refuelling"} <kbd>F</kbd>`;
    $("fuel").disabled = !game.atStation || !s.capacity;
    $("board").innerHTML = `${s.boarded ? "Exit rover" : "Enter rover"} <kbd>E</kbd>`;
    $("zone-name").textContent = s.boarded ? "ROVER" : game.nearGarage ? "GARAGE" : "CANYON";
    $("build-heading").textContent = KIT[selected] === "bridge" ? "Bridge" : s.ready ? "Rover ready" : "Assembly";
    $("build-description").textContent = KIT[selected] === "bridge" ? "Temporary support releases at 10 decks." : "1\u20134 engines \xB7 95 kg / 2.5 kW each";
    $("bridge-count").textContent = `${s.bridges.length} / 10 decks`;
    const stress = Math.max(s.stress, ...s.bridges.map((b) => b.displayStress), s.bridges.some((b) => b.broken) ? 1 : 0);
    $("stress-fill").style.width = `${Math.min(100, stress * 100)}%`;
    $("stress-fill").style.background = stress >= 0.8 ? "var(--red)" : stress >= 0.35 ? "var(--yellow)" : "var(--green)";
    $("stress-label").textContent = s.breakIndex ? `Joint ${s.breakIndex} broken` : s.bridges.length ? `${Math.round(stress * 100)}% maximum connection load` : "No joints yet";
    $("install").disabled = game.boarded || KIT[selected] === "bridge" || !game.nearGarage;
    $("touch-fit").disabled = $("install").disabled;
    $("touch-place").disabled = game.boarded || KIT[selected] !== "bridge" || !(game.nearGarage || game.nearBridgehead);
    $("touch-remove").disabled = game.boarded || !game.bridges.length || !(game.nearGarage || game.nearBridgehead);
    $("remove-part").disabled = game.boarded || !game.nearGarage || !game.parts.length;
    $("remove-part").textContent = "Undo part";
    $("load-caption").textContent = game.boarded ? "Includes 30 kg pilot \xB7 Mars g = 3.71" : "Pilot 30 kg \xB7 Mars g = 3.71 m/s\xB2";
    if (noticeUntil && game.time > noticeUntil) $("notice").textContent = "";
  }
  function frame(now) {
    if (!active) return;
    const raw = last ? Math.max(0, (now - last) / 1e3) : 0;
    last = now;
    if (!game.paused) {
      game.advanceClock(raw);
      const begin = performance.now();
      accumulator += Math.min(raw, 0.1);
      const controls = input();
      let steps = 0;
      while (accumulator >= P.step && steps < 12) {
        game.step(P.step, controls);
        controls.jump = false;
        accumulator -= P.step;
        steps++;
      }
      if (steps) jump = false;
      simCosts.push(performance.now() - begin);
      if (simCosts.length > 1200) simCosts.shift();
      events();
      syncGraphics(Math.min(raw || 1 / 60, 0.1));
      if (raw > 0 && raw < 0.25) {
        frames.push(raw * 1e3);
        if (frames.length > 1200) frames.shift();
      }
    }
    uiClock += raw;
    if (uiClock >= 0.05) {
      updateHUD();
      uiClock = 0;
    }
    if (!game.paused || renderTime === 0) {
      renderer.render(scene, camera);
      renderTime = now;
    }
    frameHandle = requestAnimationFrame(frame);
  }
  function resize() {
    const { width, height } = yard.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }
  new ResizeObserver(resize).observe(yard);
  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting && entries[0].intersectionRatio > 0.05;
    if (!visible) pause("Paused while the game is outside the page view.");
  }, { threshold: [0, 0.05, 0.1] }).observe(yard);
  window.addEventListener("blur", () => pause("Paused while this window is inactive."));
  let wasFullscreen = document.fullscreenElement === yard;
  document.addEventListener("fullscreenchange", () => {
    const fullscreen = document.fullscreenElement === yard;
    if (wasFullscreen && !fullscreen && !modal) pause("Fullscreen closed.");
    wasFullscreen = fullscreen;
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pause("Paused while this tab is hidden.");
  });
  yard.addEventListener("focusout", (e) => {
    if (e.relatedTarget && !yard.contains(e.relatedTarget)) pause("Keyboard released. Resume when ready.");
  });
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    pause("The graphics context was interrupted. Reload this frame to restart.");
    $("resume").disabled = true;
  });
  const keyCode = (e) => e.code || (/^[a-z]$/i.test(e.key) ? `Key${e.key.toUpperCase()}` : /^[1-9]$/.test(e.key) ? `Digit${e.key}` : e.key === " " ? "Space" : e.key);
  window.addEventListener("keydown", (e) => {
    if (!locked && !yard.contains(document.activeElement)) return;
    const code = keyCode(e);
    if (code === "KeyH") {
      e.preventDefault();
      if (!e.repeat) cycleHUD();
      return;
    }
    if (modal) {
      if (code === "KeyP" && !e.repeat) {
        e.preventDefault();
        if (game.paused) resume();
      } else if (code === "Tab") {
        const controls = [...$(modal).querySelectorAll("button:not([hidden]):not(:disabled)")];
        const index = controls.indexOf(document.activeElement);
        e.preventDefault();
        controls[(index + (e.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus();
      }
      return;
    }
    const controlled = ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "KeyB", "KeyE", "KeyF", "KeyR", "KeyP", "KeyH", "Tab", "Escape"];
    if (!controlled.includes(code) && !/^Digit[1-9]$/.test(code)) return;
    e.preventDefault();
    keys.add(code);
    if (e.repeat) return;
    if (/^Digit[1-9]$/.test(code)) {
      const slot = Number(code.at(-1)) - 1;
      if (slot < KIT.length) select(slot);
    }
    if (code === "KeyP" || code === "Escape") pause();
    if (code === "Tab") toggleParts();
    if (code === "KeyB") install();
    if (code === "KeyE") board();
    if (code === "KeyF") fuel();
    if (code === "KeyR") retry(false);
    if (code === "Space" && !game.boarded) jump = true;
  });
  window.addEventListener("keyup", (e) => keys.delete(keyCode(e)));
  document.addEventListener("pointerlockchange", () => {
    const wasLocked = locked;
    locked = document.pointerLockElement === canvas;
    lockPending = false;
    yard.classList.toggle("mouse-locked", locked);
    $("crosshair").hidden = !!modal || !(locked || touchQuery.matches);
    if (locked) {
      intentionalUnlock = false;
      setBench(false);
      focus();
    } else {
      keys.clear();
      jump = false;
      if (wasLocked && !intentionalUnlock && !modal) pause("Mouse released.");
      intentionalUnlock = false;
    }
  });
  document.addEventListener("pointerlockerror", () => {
    lockPending = false;
    tell("Click the scene to capture the mouse");
  });
  const look = (dx, dy) => {
    yaw -= dx * 3e-3;
    pitch = THREE.MathUtils.clamp(pitch + dy * 3e-3, -0.85, 1.15);
  };
  document.addEventListener("mousemove", (e) => {
    if (locked && !modal) look(e.movementX, e.movementY);
  });
  canvas.addEventListener("pointerdown", (e) => {
    if (modal) return;
    focus();
    if (e.pointerType === "touch") {
      const rect = canvas.getBoundingClientRect();
      if (e.clientX < rect.left + rect.width / 2) return;
      e.preventDefault();
      pointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    } else if (!locked) {
      if (e.button === 0) lockMouse();
    } else if (e.button === 0) placeBlock();
    else if (e.button === 2) removeBlock();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!pointer || e.pointerId !== pointer.id || modal) return;
    look(e.clientX - pointer.x, e.clientY - pointer.y);
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  });
  for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) canvas.addEventListener(name, (e) => {
    if (pointer?.id === e.pointerId) {
      pointer = null;
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    }
  });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  const wheel = (e) => {
    if (!modal) {
      e.preventDefault();
      if (e.deltaY) select(selected + (e.deltaY > 0 ? 1 : -1));
    }
  };
  canvas.addEventListener("wheel", (e) => {
    if (locked) wheel(e);
  }, { passive: false });
  $("hotbar").addEventListener("click", (e) => {
    const b = e.target.closest("[data-slot]");
    if (b) select(Number(b.dataset.slot));
  });
  $("hotbar").addEventListener("wheel", wheel, { passive: false });
  $("install").onclick = install;
  $("remove-part").onclick = remove;
  $("touch-place").onclick = placeBlock;
  $("touch-remove").onclick = removeBlock;
  $("touch-fit").onclick = install;
  $("touch-parts").onclick = () => {
    setHUD("full");
    setBench($("bench-content").hidden);
  };
  $("hud-toggle").onclick = cycleHUD;
  $("board").onclick = board;
  $("fuel").onclick = fuel;
  $("pause").onclick = () => pause();
  $("resume").onclick = resume;
  $("help-toggle").onclick = () => setModal("help");
  $("help-close").onclick = resume;
  $("recover").onclick = () => retry(false);
  $("retry").onclick = () => retry(false);
  $("new-run").onclick = () => retry(true);
  $("bench-toggle").onclick = () => setBench($("bench-content").hidden);
  for (const button of document.querySelectorAll("[data-hold]")) {
    const code = button.dataset.hold;
    button.addEventListener("pointerdown", (e) => {
      if (modal) return;
      e.preventDefault();
      focus();
      keys.add(code);
      if (code === "Space" && !game.boarded) jump = true;
      button.setPointerCapture(e.pointerId);
    });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) button.addEventListener(name, () => keys.delete(code));
  }
  function resetStick() {
    stick.x = stick.y = 0;
    stick.id = null;
    $("stick-thumb").style.transform = "translate(0, 0)";
  }
  const joystick = $("joystick");
  function moveStick(e) {
    const r = joystick.getBoundingClientRect(), radius = r.width * 0.32;
    let x = (e.clientX - r.left - r.width / 2) / radius, y = (e.clientY - r.top - r.height / 2) / radius;
    const length = Math.max(1, Math.hypot(x, y));
    x /= length;
    y /= length;
    stick.x = Math.abs(x) < 0.08 ? 0 : x;
    stick.y = Math.abs(y) < 0.08 ? 0 : y;
    $("stick-thumb").style.transform = `translate(${x * radius}px, ${y * radius}px)`;
  }
  joystick.addEventListener("pointerdown", (e) => {
    if (modal) return;
    e.preventDefault();
    focus();
    stick.id = e.pointerId;
    joystick.setPointerCapture(e.pointerId);
    moveStick(e);
  });
  joystick.addEventListener("pointermove", (e) => {
    if (stick.id === e.pointerId) moveStick(e);
  });
  for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) joystick.addEventListener(name, (e) => {
    if (stick.id === e.pointerId) resetStick();
  });
  rebuild();
  renderHotbar();
  viewTarget.copy(game.pilot.position);
  resize();
  syncGraphics(1);
  updateHUD();
  setHUD(hudMode, false);
  renderer.render(scene, camera);
  if (touchQuery.matches) setBench(false);
  $("cover").hidden = true;
  $("hud").hidden = false;
  $("hud-toggle").hidden = false;
  canvas.tabIndex = 0;
  focus();
  tell(touchQuery.matches ? "Parts \xB7 Fit" : "B: fit \xB7 click: capture mouse", 5);
  yard.dataset.ready = "true";
  yard.dataset.loadMs = (performance.now() - start).toFixed(0);
  window.marsCanyon = Object.freeze({
    snapshot: () => ({
      ...game.snapshot(),
      active,
      visible,
      modal,
      hudMode,
      locked,
      heading,
      controls: { ...lastControls },
      aim: aimedBlock(),
      selected: KIT[selected],
      loadMs: Number(yard.dataset.loadMs),
      reducedMotion: reducedQuery.matches,
      camera: { yaw, pitch, forward: { ...camera.getWorldDirection(new THREE.Vector3()) }, position: { ...camera.position }, quaternion: { ...camera.quaternion } },
      preview: preview.visible ? { index: preview.userData.bridgeIndex, position: { ...preview.position }, screen: { ...preview.localToWorld(new THREE.Vector3(0, 0.13, 0)).project(camera) } } : null,
      buildTargets: [...decks.values()].map((view) => ({ index: view.deck.userData.bridgeIndex, screen: { ...view.root.localToWorld(new THREE.Vector3(0, 0.13, 0)).project(camera) } })),
      sky: { earth: { ...sky.earth.position }, moon: { ...sky.moon.position } },
      skyScreen: { earth: { ...sky.earth.position.clone().project(camera) }, moon: { ...sky.moon.position.clone().project(camera) } },
      renderer: { drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, pixelRatio: renderer.getPixelRatio() },
      performance: { frameMs: [...frames], physicsMs: [...simCosts] }
    }),
    capture: () => {
      renderer.render(scene, camera);
      return canvas.toDataURL("image/png");
    }
  });
  frameHandle = requestAnimationFrame(frame);
  return { stop() {
    active = false;
    cancelAnimationFrame(frameHandle);
    renderer.dispose();
  } };
}
