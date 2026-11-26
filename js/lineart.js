// Render de DIBUJO LINEAL (estilo siluetas de arquitectura) a partir del modelo 3D.
// BORRADOR raster: sirve para fijar el aspecto. La versión final generará las mismas
// líneas como vectores (polilíneas) para el bloque de AutoCAD.
//
//   outline  grosor del perímetro (px a la altura final)
//   inner    grosor de las líneas interiores
//   shading  'none' | 'tone' (tramas de gris planas) | 'hatch' (rayado)
//   shadow   sombra proyectada en el suelo
//   view     'front' | 'back' | 'side' | 'top'
import * as THREE from 'three';
import { mats } from './materials.js';

const SS = 2; // supersampling interno

const SLOT_NAMES = new Set(['body', 'gender', 'hair', 'eyes', 'nose', 'facial', 'profession', 'mobility']);

function slotOf(o) {
  for (let p = o; p; p = p.parent) if (SLOT_NAMES.has(p.name) && p.parent && p.parent.name === 'personaje') return p.name;
  return 'x';
}
const matKey = (m) => Object.keys(mats).find((k) => mats[k] === m) || 'x';

const VIEWS = {
  front: { dir: [0, 0, 1], up: [0, 1, 0] },
  back:  { dir: [0, 0, -1], up: [0, 1, 0] },
  side:  { dir: [1, 0, 0], up: [0, 1, 0] },
  top:   { dir: [0, 1, 0], up: [0, 0, -1] },
};

export function renderLineArt(root, opts = {}) {
  const { view = 'front', outline = 4, inner = 1.4, shading = 'none', shadow = false, crease = 62, height = 900, bg = '#ffffff' } = opts;
  const V = VIEWS[view];

  // Escena propia con una copia del personaje (comparte geometrías y materiales)
  const scene = new THREE.Scene();
  const clone = root.clone(true);
  scene.add(clone);
  clone.updateMatrixWorld(true);

  const idMat = new Map();
  let nextId = 1;
  clone.traverse((o) => {
    if (!o.isMesh) return;
    const key = slotOf(o) + ':' + matKey(o.material);
    if (!idMat.has(key)) {
      const m = new THREE.MeshBasicMaterial();
      m.color.setRGB((nextId * 8) / 255, 0, 0, THREE.LinearSRGBColorSpace);
      idMat.set(key, m);
      nextId++;
    }
    o.userData._origMat = o.material;
    o.material = idMat.get(key);
  });

  // Encuadre ortográfico
  const box = new THREE.Box3().setFromObject(clone);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const dir = new THREE.Vector3(...V.dir), up = new THREE.Vector3(...V.up);
  const right = new THREE.Vector3().crossVectors(up, dir).normalize(); // eje horizontal de pantalla
  const proj = (v) => ({ x: v.dot(right), y: v.dot(up) });
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const p = proj(new THREE.Vector3(x, y, z));
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const padM = 0.06;
  const shadowM = shadow ? (maxY - minY) * 0.55 : 0; // hueco extra a la derecha para la sombra
  const wM = maxX - minX + padM * 2 + shadowM, hM = maxY - minY + padM * 2;
  const pxPerM = (height * SS) / hM;
  const W = Math.ceil(wM * pxPerM), H = Math.ceil(hM * pxPerM);

  const cam = new THREE.OrthographicCamera(-wM / 2, wM / 2, hM / 2, -hM / 2, 0.01, 50);
  const cx = (minX + maxX) / 2 + shadowM / 2, cy = (minY + maxY) / 2;
  const camTarget = center.clone().addScaledVector(right, cx - center.dot(right)).addScaledVector(up, cy - center.dot(up));
  cam.position.copy(camTarget).addScaledVector(dir, 10);
  cam.up.copy(up);
  cam.lookAt(camTarget);
  cam.updateMatrixWorld(true);

  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  const rt = new THREE.WebGLRenderTarget(W, H);
  const read = () => { const buf = new Uint8Array(W * H * 4); renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf); return buf; };

  renderer.setClearColor(0x000000, 1);
  renderer.setRenderTarget(rt);
  renderer.clear();
  renderer.render(scene, cam);
  const idBuf = read();

  scene.overrideMaterial = new THREE.MeshNormalMaterial({ flatShading: true });
  renderer.clear();
  renderer.render(scene, cam);
  const nBuf = read();
  scene.overrideMaterial = null;

  renderer.setRenderTarget(null);
  renderer.dispose();
  rt.dispose();

  // ---- Análisis (la imagen leída está invertida en Y: fila 0 = abajo)
  const idx = (x, y) => ((H - 1 - y) * W + x) * 4;
  const ID = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) ID[y * W + x] = idBuf[idx(x, y)];

  // Luz en espacio de pantalla (arriba-izquierda, hacia el observador)
  const Ld = new THREE.Vector3(-0.5, 0.7, 0.55).normalize();
  const nAt = (x, y) => {
    const i = idx(x, y);
    return [nBuf[i] / 127.5 - 1, nBuf[i + 1] / 127.5 - 1, nBuf[i + 2] / 127.5 - 1];
  };
  const cosCrease = Math.cos((crease * Math.PI) / 180);

  const perim = [], innerE = [];
  for (let y = 0; y < H - 1; y++) {
    for (let x = 0; x < W - 1; x++) {
      const a = ID[y * W + x];
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const b = ID[(y + dy) * W + (x + dx)];
        if (a !== b) {
          if (a === 0) perim.push((y + dy) * W + (x + dx));
          else if (b === 0) perim.push(y * W + x);
          else innerE.push(y * W + x);
        } else if (a !== 0 && crease > 0) {
          const n1 = nAt(x, y), n2 = nAt(x + dx, y + dy);
          if (n1[0] * n2[0] + n1[1] * n2[1] + n1[2] * n2[2] < cosCrease) innerE.push(y * W + x);
        }
      }
    }
  }

  // ---- Composición
  const img = new Uint8ClampedArray(W * H * 4);
  const bgc = new THREE.Color(bg);
  const bgR = Math.round(bgc.r * 255), bgG = Math.round(bgc.g * 255), bgB = Math.round(bgc.b * 255);
  const bgA = bg ? 255 : 0;
  for (let i = 0; i < W * H; i++) { img[i * 4] = 255; img[i * 4 + 1] = 255; img[i * 4 + 2] = 255; img[i * 4 + 3] = bgA; }
  if (bg) for (let i = 0; i < W * H; i++) { img[i * 4] = bgR; img[i * 4 + 1] = bgG; img[i * 4 + 2] = bgB; }
  const put = (x, y, v, a = 255) => { const i = (y * W + x) * 4; img[i] = v; img[i + 1] = v; img[i + 2] = v; img[i + 3] = a; };

  // Sombra proyectada: copia de la silueta aplastada y cizallada hacia la derecha, apoyada en el suelo
  if (shadow) {
    let feetY = 0;
    for (let y = H - 1; y >= 0 && !feetY; y--) for (let x = 0; x < W; x++) if (ID[y * W + x]) { feetY = y; break; }
    const ky = 0.3, kx = 0.5;
    for (let v = 0; v <= Math.min(H - 1, feetY); v++) {
      const h = (feetY - v) / ky;
      const y = Math.round(feetY - h);
      if (y < 0) continue;
      for (let u = 0; u < W; u++) {
        const x = Math.round(u - kx * h);
        if (x < 0 || x >= W) continue;
        if (ID[y * W + x]) {
          const hatch = shading === 'hatch' ? ((u + v) % (7 * SS) < SS * 0.9 ? 70 : 255) : 214;
          put(u, v, hatch);
        }
      }
    }
  }

  // Relleno blanco + sombreado interior
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!ID[y * W + x]) continue;
      let c = 255;
      if (shading !== 'none') {
        const n = nAt(x, y);
        const d = n[0] * Ld.x + n[1] * Ld.y + n[2] * Ld.z;
        const lvl = d < 0.12 ? 2 : d < 0.5 ? 1 : 0;
        if (shading === 'tone') c = [255, 232, 202][lvl];
        else if (shading === 'hatch') {
          const P = 8 * SS;
          if (lvl === 2) c = (x + y) % P < SS * 0.9 || (x - y + 4096) % (P * 2) < SS * 0.7 ? 60 : 255;
          else if (lvl === 1) c = (x + y) % (P * 1.6) < SS * 0.8 ? 90 : 255;
        }
      }
      put(x, y, c);
    }
  }

  // Líneas: se estampan discos sobre las aristas
  const lines = new Uint8Array(W * H);
  const stamp = (list, r) => {
    const R = Math.max(0.5, r);
    const ri = Math.ceil(R);
    const offs = [];
    for (let dy = -ri; dy <= ri; dy++) for (let dx = -ri; dx <= ri; dx++) if (dx * dx + dy * dy <= R * R + 0.25) offs.push([dx, dy]);
    for (const p of list) {
      const px = p % W, py = (p / W) | 0;
      for (const [dx, dy] of offs) {
        const x = px + dx, y = py + dy;
        if (x >= 0 && y >= 0 && x < W && y < H) lines[y * W + x] = 1;
      }
    }
  };
  stamp(innerE, (inner * SS) / 2);
  stamp(perim, (outline * SS) / 2);
  for (let i = 0; i < W * H; i++) if (lines[i]) { img[i * 4] = 17; img[i * 4 + 1] = 17; img[i * 4 + 2] = 17; img[i * 4 + 3] = 255; }

  // Reducción a la altura final (suaviza los bordes)
  const big = document.createElement('canvas');
  big.width = W; big.height = H;
  big.getContext('2d').putImageData(new ImageData(img, W, H), 0, 0);
  const out = document.createElement('canvas');
  out.width = Math.round(W / SS); out.height = Math.round(H / SS);
  const g = out.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(big, 0, 0, out.width, out.height);

  clone.traverse((o) => { if (o.isMesh && o.userData._origMat) o.material = o.userData._origMat; });
  return out;
}
