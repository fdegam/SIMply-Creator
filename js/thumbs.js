// Miniaturas de las opciones: cada una renderiza el personaje actual con esa opción
// aplicada, con un renderer propio fuera de pantalla.
import * as THREE from 'three';
import { Character } from './character.js';
import { colors, setColor } from './materials.js';
import { options as professions } from './profession.js';

const W = 192, H = 240;
let renderer, scene, cam;

const FRAMES = {
  body:  { pos: [0.95, 1.05, 3.5], tgt: [0, 0.9, 0] },
  head:  { pos: [0.4, 1.7, 1.15], tgt: [0, 1.64, 0] },
  close: { pos: [0.28, 1.68, 0.78], tgt: [0, 1.64, 0] },
};
const FRAME_OF = { complexion: 'body', gender: 'body', profession: 'body', hair: 'head', facial: 'head', eyes: 'close', nose: 'close' };

function init() {
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H);
  scene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(30, W / H, 0.05, 30);
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a3f4c, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(-2.5, 4, 3.5);
  scene.add(key);
}

/** @returns {string[]} dataURL por opción del grupo, en orden. */
export function renderGroupThumbs(group, state) {
  init();
  const f = FRAMES[FRAME_OF[group.id] || 'body'];
  cam.position.set(...f.pos);
  cam.lookAt(...f.tgt);
  const saved = { ...colors };
  const urls = group.options.map((opt) => {
    // Cada profesión se previsualiza con sus colores propios
    if (group.id === 'profession') for (const [k, v] of Object.entries(professions[opt.id].defaults)) setColor(k, v);
    const ch = new Character();
    ch.set({ ...state, [group.id]: opt.id }, false);
    scene.add(ch.root);
    renderer.render(scene, cam);
    const url = renderer.domElement.toDataURL('image/png');
    scene.remove(ch.root);
    ch.root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    return url;
  });
  for (const [k, v] of Object.entries(saved)) setColor(k, v);
  return urls;
}
