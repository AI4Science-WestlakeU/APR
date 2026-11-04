import * as THREE from "three";
import { toon, outline, SUN_DIRECTION } from "./style.js?v=4e21205885936d83";
export async function makeSky(scene) {
  const texture = await new THREE.TextureLoader().loadAsync("./assets/earth-blue-marble.jpg");
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = toon(16777215, { map: texture });
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      "#include <map_fragment>\ndiffuseColor.rgb = floor(diffuseColor.rgb * 6.0 + 0.5) / 6.0;"
    );
  };
  material.customProgramCacheKey = () => "blue-marble-seven-levels";
  const earth = new THREE.Mesh(new THREE.SphereGeometry(27, 48, 32), material);
  earth.position.set(295, -12, -135);
  earth.rotation.set(0.18, 2.4, 0.13);
  scene.add(earth);
  const ink = outline(earth.geometry, 1.012);
  earth.add(ink);
  const air = new THREE.Mesh(new THREE.SphereGeometry(27.6, 40, 24), new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    vertexShader: "varying vec3 n; varying vec3 v; void main(){vec4 p=modelViewMatrix*vec4(position,1.0); n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}",
    fragmentShader: "varying vec3 n; varying vec3 v; void main(){float rim=pow(1.0-abs(dot(normalize(n),normalize(v))),3.0);gl_FragColor=vec4(0.15,0.38,0.65,rim*0.18);}"
  }));
  air.position.copy(earth.position);
  scene.add(air);
  const moon = new THREE.Mesh(new THREE.IcosahedronGeometry(5.2, 2), toon(12170671));
  moon.geometry.computeVertexNormals();
  moon.add(outline(moon.geometry, 1.025));
  scene.add(moon);
  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = glowCanvas.height = 64;
  const ctx = glowCanvas.getContext("2d"), gradient = ctx.createRadialGradient(32, 32, 1, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,247,211,1)");
  gradient.addColorStop(0.2, "rgba(255,235,165,.9)");
  gradient.addColorStop(0.36, "rgba(255,229,151,.13)");
  gradient.addColorStop(1, "rgba(255,229,151,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(glowCanvas), depthWrite: false, transparent: true }));
  sun.position.copy(SUN_DIRECTION).multiplyScalar(480);
  sun.scale.setScalar(30);
  scene.add(sun);
  function update(time, cameraPosition = null) {
    if (cameraPosition) sun.position.copy(cameraPosition).addScaledVector(SUN_DIRECTION, 480);
    earth.rotation.y = 2.4 + time * 0.018;
    const phase = 0.35 + time * 0.035;
    moon.position.copy(earth.position).add(new THREE.Vector3(Math.cos(phase) * 49, Math.sin(phase) * 15, Math.sin(phase) * 29));
  }
  update(0);
  return { update, earth, moon, sun };
}
