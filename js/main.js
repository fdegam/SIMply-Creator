// Punto de entrada: escena Three.js, interfaz y eventos.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { category as complexionCat } from './complexion.js';
import { category as traitsCat } from './traits.js';
import { category as genderCat } from './gender.js';
import { category as professionCat, options as professions } from './profession.js';
import { colors, setColor, resetColors, COLOR_LABELS, PALETTES } from './materials.js';
import { Character } from './character.js';
import { exportDXF } from './export/dxf.js';
import { exportSVG } from './export/svg.js';
import { download } from './export/geometry.js';

const CATEGORIES = [complexionCat, genderCat, traitsCat, professionCat];
const GROUPS = CATEGORIES.flatMap((c) => c.groups);

const DEFAULT_STATE = {
  complexion: 'normal', gender: 'neutro',
  hair: 'corto', eyes: 'normales', nose: 'recta', facial: 'ninguno',
  profession: 'ninguna',
};
const state = { ...DEFAULT_STATE };

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------------ Escena */
const viewport = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
viewport.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
const HOME = { pos: new THREE.Vector3(1.3, 1.25, 3.6), target: new THREE.Vector3(0, 0.95, 0) };
camera.position.copy(HOME.pos);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(HOME.target);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 1.6;
controls.maxDistance = 7;
controls.maxPolarAngle = Math.PI * 0.56;
controls.autoRotateSpeed = 2.2;

scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a3f4c, 1.6));
const key = new THREE.DirectionalLight(0xffffff, 2.4);
key.position.set(-2.5, 4, 3.5);
scene.add(key);
const rim = new THREE.DirectionalLight(0x9ab7ff, 1.1);
rim.position.set(3, 2, -3);
scene.add(rim);

// Peana y sombra "blob" (no se exportan: no cuelgan del personaje)
const base = new THREE.Mesh(
  new THREE.CylinderGeometry(0.72, 0.76, 0.04, 40),
  new THREE.MeshStandardMaterial({ color: 0x2a2f3c, roughness: 0.9 }),
);
base.position.y = -0.02;
scene.add(base);
{
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grd.addColorStop(0, 'rgba(0,0,0,.55)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, 1.3),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.003;
  scene.add(shadow);
}

const character = new Character();
scene.add(character.root);
character.set(state, false);

function resize() {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewport);
resize();

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  character.update(Math.min(clock.getDelta(), 0.05));
  controls.update();
  renderer.render(scene, camera);
});

/* --------------------------------------------------------------- Interfaz */
const controlsEl = document.getElementById('controls');
const chipRefs = {}; // groupId -> { optionId: button }

for (const cat of CATEGORIES) {
  const sec = document.createElement('section');
  sec.className = 'cat';
  sec.innerHTML = `<h2>${cat.label}</h2>`;
  for (const grp of cat.groups) {
    const sub = document.createElement('div');
    sub.className = 'subgroup';
    if (cat.groups.length > 1) sub.innerHTML = `<h3>${grp.label}</h3>`;
    const row = document.createElement('div');
    row.className = 'options';
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', grp.label);
    chipRefs[grp.id] = {};
    for (const opt of grp.options) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = opt.label;
      b.addEventListener('click', () => choose(grp.id, opt.id));
      row.appendChild(b);
      chipRefs[grp.id][opt.id] = b;
    }
    sub.appendChild(row);
    sec.appendChild(sub);
  }
  controlsEl.appendChild(sec);
}

const colorsEl = document.getElementById('colors');
const colorInputs = {};
for (const key of Object.keys(COLOR_LABELS)) {
  const wrap = document.createElement('label');
  wrap.className = 'color';
  wrap.innerHTML = `<span>${COLOR_LABELS[key]}</span>`;
  const input = document.createElement('input');
  input.type = 'color';
  input.value = colors[key];
  input.addEventListener('input', () => setColor(key, input.value)); // actualiza al instante, sin reconstruir
  wrap.appendChild(input);
  colorsEl.appendChild(wrap);
  colorInputs[key] = input;
}

function syncUI() {
  for (const grp of GROUPS) {
    for (const [id, b] of Object.entries(chipRefs[grp.id])) b.setAttribute('aria-pressed', String(state[grp.id] === id));
  }
  for (const k of Object.keys(colorInputs)) colorInputs[k].value = colors[k];
}

function apply() {
  syncUI();
  character.set(state, !reduceMotion);
}

function applyProfessionColors(id) {
  const d = professions[id].defaults;
  for (const [k, v] of Object.entries(d)) setColor(k, v);
}

function choose(groupId, optionId) {
  if (state[groupId] === optionId) return;
  state[groupId] = optionId;
  if (groupId === 'profession') applyProfessionColors(optionId);
  apply();
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function randomize() {
  for (const grp of GROUPS) state[grp.id] = pick(grp.options).id;
  for (const k of Object.keys(PALETTES)) setColor(k, pick(PALETTES[k]));
  apply();
}

function reset() {
  Object.assign(state, DEFAULT_STATE);
  resetColors();
  applyProfessionColors(state.profession);
  camera.position.copy(HOME.pos);
  controls.target.copy(HOME.target);
  apply();
}

/* ------------------------------------------------------------- Botones */
const toast = document.getElementById('toast');
let toastTimer;
function say(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

const slug = () => `simply-${state.profession}-${state.gender}`;

document.getElementById('btn-random').addEventListener('click', randomize);
document.getElementById('btn-reset').addEventListener('click', reset);

document.getElementById('btn-dxf').addEventListener('click', () => {
  try {
    character.finish();
    const r = exportDXF(character.root);
    download(`${slug()}.dxf`, r.text, 'application/dxf');
    say(`DXF exportado · ${r.triangles.toLocaleString('es')} caras 3D · mm`);
  } catch (e) { console.error(e); say('No se pudo exportar el DXF'); }
});

document.getElementById('btn-svg').addEventListener('click', () => {
  try {
    character.finish();
    const r = exportSVG(character.root, camera);
    download(`${slug()}.svg`, r.text, 'image/svg+xml');
    say(`SVG exportado · ${r.triangles.toLocaleString('es')} polígonos`);
  } catch (e) { console.error(e); say('No se pudo exportar el SVG'); }
});

const spin = document.getElementById('btn-spin');
spin.addEventListener('click', () => {
  controls.autoRotate = !controls.autoRotate;
  spin.setAttribute('aria-pressed', String(controls.autoRotate));
});
document.getElementById('btn-view').addEventListener('click', () => {
  camera.position.copy(HOME.pos);
  controls.target.copy(HOME.target);
});

applyProfessionColors(state.profession);
syncUI();

// Para pruebas y depuración desde la consola
window.simply = { state, character, camera, controls, scene, choose, randomize, reset, exportDXF: () => exportDXF(character.root), exportSVG: () => exportSVG(character.root, camera) };
