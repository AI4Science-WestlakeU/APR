# Vendored browser libraries

All files are pinned, self-hosted, and served from this directory after Play.

| Library | Version | Download source | License |
| --- | --- | --- | --- |
| three.js | 0.180.0 | https://registry.npmjs.org/three/-/three-0.180.0.tgz | `three/LICENSE` (MIT) |
| cannon-es | 0.20.0 | https://registry.npmjs.org/cannon-es/-/cannon-es-0.20.0.tgz | `cannon-es/LICENSE` (MIT) |

The import map in `index.html` resolves `three` and `three/addons/` locally.
The GLTFLoader's only bundled utility dependency is BufferGeometryUtils.
