import * as THREE from "three";
const bands = new THREE.DataTexture(new Uint8Array([35, 145, 245]), 3, 1, THREE.RedFormat);
bands.minFilter = bands.magFilter = THREE.NearestFilter;
bands.generateMipmaps = false;
bands.needsUpdate = true;
export const INK = 2905467;
export const SUN_DIRECTION = new THREE.Vector3(-0.62, 0.72, 0.3).normalize();
export const toon = (color, options = {}) => new THREE.MeshToonMaterial({ color, gradientMap: bands, ...options });
export function mascotToon(color, options = {}) {
  const material = toon(color, options);
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <lights_fragment_end>",
      "#include <lights_fragment_end>\nreflectedLight.directDiffuse += diffuseColor.rgb * 0.22 * (0.5 + 0.5 * max(dot(normal, normalize(vViewPosition)), 0.0));"
    );
  };
  material.customProgramCacheKey = () => "mascot-camera-fill-v1";
  return material;
}
export function outline(geometry, scale = 1.025) {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }));
  mesh.scale.setScalar(scale);
  mesh.userData.outline = true;
  mesh.raycast = () => {
  };
  return mesh;
}
