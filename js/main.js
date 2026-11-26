// Punto de entrada: escena Three.js, interfaz estilo "creador de personajes" y eventos.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { category as complexionCat } from './complexion.js';
import { category as traitsCat } from './traits.js';
import { category as genderCat } from './gender.js';
import { category as professionCat, options as professions } from './profession.js';
import { category as mobilityCat } from './mobility.js';
import { colors, setColor, resetColors, COLOR_LABELS, PALETTES } from './materials.js';
import { Character } from './character.js';
import { renderGroupThumbs } from './thumbs.js';
import { exportDXF } from './export/dxf.js';
import { exportSVG } from './export/svg.js';
import { download } from './export/geometry.js';

const CATEGORIES = [complexionCat, genderCat, traitsCat, professionCat, mobilityCat];
const GROUPS = CATEGORIES.flatMap((c) => c.groups); // un botón del arco por grupo
const GROUP_ICON = { complexion: 'complexion', gender: 'gender', hair: 'hair', eyes: 'eyes', nose: 'nose', facial: 'facial', profession: 'profession', mobility: 'mobility' };

const DEFAULT_STATE = {
  complexion: 'normal', gender: 'neutro',
  hair: 'corto', eyes: 'normales', nose: 'recta', facial: 'ninguno',
  profession: 'ninguna', mobility: 'ninguna',
  weight: 0, stature: 0,
};
const state = { ...DEFAULT_STATE };
let activeGroup = GROUPS[0];

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (id) => document.getElementById(id);

/* ------------------------------------------------------------------ Escena */
const viewport = $('viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
viewport.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
const HOME = { pos: new THREE.Vector3(0.8, 1.15, 4.0), target: new THREE.Vector3(0, 0.92, 0) };
camera.position.copy(HOME.pos);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(HOME.target);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 1.4;
controls.maxDistance = 7;
controls.maxPolarAngle = Math.PI * 0.56;
controls.autoRotateSpeed = 2.4;

scene.add(new THREE.HemisphereLight(0xeaf4ff, 0x5a7a90, 1.9));
const key = new THREE.DirectionalLight(0xffffff, 2.3);
key.position.set(-2.5, 4, 3.5);
scene.add(key);
const rim = new THREE.DirectionalLight(0xbfe8ff, 1.0);
rim.position.set(3, 2, -3);
scene.add(rim);

// Sombra "blob" bajo los pies (no se exporta: no cuelga del personaje)
{
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 2, 64, 64, 62);
  grd.addColorStop(0, 'rgba(10,40,70,.5)');
  grd.addColorStop(1, 'rgba(10,40,70,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 1.5),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.002;
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
  camera.zoom = camera.aspect < 0.9 ? 0.8 : 1; // en pantallas estrechas se aleja para ver el cuerpo entero
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewport);
resize();

// Giro con las flechas (mantener pulsado)
let rotDir = 0;
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (rotDir) {
    const off = camera.position.clone().sub(controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotDir * dt * 2.2);
    camera.position.copy(controls.target).add(off);
  }
  character.update(dt);
  controls.update();
  renderer.render(scene, camera);
});

/* -------------------------------------------------------------- Historial */
const past = [];
let future = [];
const snapshot = () => JSON.stringify({ state, colors });
function commit() {
  const s = snapshot();
  if (past[past.length - 1] === s) return;
  past.push(s);
  if (past.length > 60) past.shift();
  future = [];
  syncHistoryButtons();
}
function restore(s) {
  const o = JSON.parse(s);
  Object.assign(state, o.state);
  for (const [k, v] of Object.entries(o.colors)) setColor(k, v);
  apply();
}
function undo() { if (past.length > 1) { future.push(past.pop()); restore(past[past.length - 1]); syncHistoryButtons(); } }
function redo() { if (future.length) { const s = future.pop(); past.push(s); restore(s); syncHistoryButtons(); } }
function syncHistoryButtons() {
  $('btn-undo').disabled = past.length <= 1;
  $('btn-redo').disabled = future.length === 0;
}

/* ------------------------------------------------------------- Interfaz */
// Arco de categorías
const arc = $('arc');
const arcBtns = {};
GROUPS.forEach((grp, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'cat';
  b.dataset.label = grp.label;
  b.setAttribute('aria-label', grp.label);
  b.innerHTML = `<svg class="ic"><use href="#i-${GROUP_ICON[grp.id]}"/></svg>`;
  const t = GROUPS.length > 1 ? i / (GROUPS.length - 1) : 0;
  b.style.setProperty('--dx', `${-Math.round(Math.sin(t * Math.PI) * 30)}px`); // curva del arco
  b.addEventListener('click', () => openGroup(grp));
  arc.appendChild(b);
  arcBtns[grp.id] = b;
});

// Panel de tarjetas
const grid = $('grid');
let cards = {};
function openGroup(grp) {
  activeGroup = grp;
  $('panel-title').textContent = grp.label;
  for (const [id, b] of Object.entries(arcBtns)) b.setAttribute('aria-pressed', String(id === grp.id));
  grid.innerHTML = '';
  cards = {};
  for (const opt of grp.options) {
    const c = document.createElement('button');
    c.type = 'button';
    c.className = 'card';
    c.setAttribute('role', 'option');
    c.innerHTML = `<img alt="" width="192" height="240"><span>${opt.label}</span>`;
    c.addEventListener('click', () => choose(grp.id, opt.id));
    grid.appendChild(c);
    cards[opt.id] = c;
  }
  syncUI();
  refreshThumbs(0);
}

let thumbTimer;
function refreshThumbs(delay = 250) {
  clearTimeout(thumbTimer);
  thumbTimer = setTimeout(() => {
    const grp = activeGroup;
    const urls = renderGroupThumbs(grp, state);
    grp.options.forEach((opt, i) => { const img = cards[opt.id]?.querySelector('img'); if (img) img.src = urls[i]; });
  }, delay);
}

// Hexágonos de color
const hexes = $('hexes');
const HEX_POS = { skin: [0, 0], hair: [56, 0], eyes: [112, 0], outfit: [28, 47], accent: [84, 47], pants: [140, 47] };
const colorInputs = {};
for (const k of Object.keys(COLOR_LABELS)) {
  const h = document.createElement('label');
  h.className = 'hex';
  h.title = COLOR_LABELS[k];
  h.style.left = HEX_POS[k][0] + 'px';
  h.style.top = HEX_POS[k][1] + 'px';
  h.innerHTML = '<i class="shape"></i><i class="fill"></i>';
  const input = document.createElement('input');
  input.type = 'color';
  input.value = colors[k];
  input.setAttribute('aria-label', 'Color: ' + COLOR_LABELS[k]);
  input.addEventListener('input', () => { setColor(k, input.value); h.style.setProperty('--c', input.value); refreshThumbs(400); });
  input.addEventListener('change', commit);
  h.appendChild(input);
  hexes.appendChild(h);
  colorInputs[k] = { input, h };
}

// Sliders de cuerpo
for (const [id, key] of [['s-weight', 'weight'], ['s-stature', 'stature']]) {
  const el = $(id);
  el.addEventListener('input', () => { state[key] = parseFloat(el.value); character.set(state, false); refreshThumbs(400); });
  el.addEventListener('change', commit);
  el.addEventListener('dblclick', () => { el.value = 0; state[key] = 0; character.set(state, false); commit(); });
}

function syncUI() {
  for (const [id, c] of Object.entries(cards)) c.setAttribute('aria-selected', String(state[activeGroup.id] === id));
  for (const k of Object.keys(colorInputs)) {
    colorInputs[k].input.value = colors[k];
    colorInputs[k].h.style.setProperty('--c', colors[k]);
  }
  $('s-weight').value = state.weight;
  $('s-stature').value = state.stature;
}

function apply() {
  syncUI();
  character.set(state, !reduceMotion);
  refreshThumbs();
}

function applyProfessionColors(id) {
  for (const [k, v] of Object.entries(professions[id].defaults)) setColor(k, v);
}

function choose(groupId, optionId) {
  if (state[groupId] === optionId) return;
  state[groupId] = optionId;
  if (groupId === 'profession') applyProfessionColors(optionId);
  apply();
  commit();
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function randomize() {
  for (const grp of GROUPS) state[grp.id] = pick(grp.options).id;
  if (Math.random() < 0.75) state.mobility = 'ninguna'; // la movilidad reducida es la excepción
  state.weight = +(Math.random() * 1.2 - 0.6).toFixed(2);
  state.stature = +(Math.random() * 1.2 - 0.6).toFixed(2);
  for (const k of Object.keys(PALETTES)) setColor(k, pick(PALETTES[k]));
  apply();
  commit();
}

function reset() {
  Object.assign(state, DEFAULT_STATE);
  resetColors();
  applyProfessionColors(state.profession);
  camera.position.copy(HOME.pos);
  controls.target.copy(HOME.target);
  apply();
  commit();
}

/* ------------------------------------------------------------- Botones */
const toast = $('toast');
let toastTimer;
function say(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

const slug = () => {
  const n = ($('name').value || 'personaje').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `simply-${n || 'personaje'}`;
};

$('btn-random').addEventListener('click', randomize);
$('btn-reset').addEventListener('click', reset);
$('btn-undo').addEventListener('click', undo);
$('btn-redo').addEventListener('click', redo);

$('btn-dxf').addEventListener('click', () => {
  try {
    character.finish();
    const r = exportDXF(character.root);
    download(`${slug()}.dxf`, r.text, 'application/dxf');
    say(`DXF exportado · ${r.triangles.toLocaleString('es')} caras 3D · mm`);
  } catch (e) { console.error(e); say('No se pudo exportar el DXF'); }
});

$('btn-svg').addEventListener('click', () => {
  try {
    character.finish();
    const r = exportSVG(character.root, camera);
    download(`${slug()}.svg`, r.text, 'image/svg+xml');
    say(`SVG exportado · ${r.triangles.toLocaleString('es')} polígonos`);
  } catch (e) { console.error(e); say('No se pudo exportar el SVG'); }
});

const spin = $('btn-spin');
spin.addEventListener('click', () => {
  controls.autoRotate = !controls.autoRotate;
  spin.setAttribute('aria-pressed', String(controls.autoRotate));
});

for (const [id, dir] of [['rot-l', -1], ['rot-r', 1]]) {
  const b = $(id);
  b.addEventListener('pointerdown', (e) => { rotDir = dir; b.setPointerCapture(e.pointerId); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => { rotDir = 0; });
  b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { rotDir = dir; setTimeout(() => { rotDir = 0; }, 250); e.preventDefault(); } });
}

addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' && e.target.type === 'text') return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
});

/* ---------------------------------------------------------------- Inicio */
applyProfessionColors(state.profession);
openGroup(GROUPS[0]);
commit();

// Para pruebas y depuración desde la consola
window.simply = { state, character, camera, controls, scene, choose, randomize, reset, undo, redo, exportDXF: () => exportDXF(character.root), exportSVG: () => exportSVG(character.root, camera) };
