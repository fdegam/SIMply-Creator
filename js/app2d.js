// SIMply Creator 2D: interfaz, estado y exportaciones.
import { loadKit } from './vector/kit.js';
import { buildFigure, OPTIONS, DEFAULT, ALL_PARTS } from './vector/figure.js';
import { renderSVG } from './vector/render.js';
import { exportBlockDXF } from './vector/dxf.js';

const $ = (id) => document.getElementById(id);

/* -------------------------------------------------------------- Estado */
const STYLE_DEFAULT = { perim: 0.18, inner: 0.0, shading: 'ninguno', shadow: false, scale: 50 };
const state = { ...DEFAULT };
const style = { ...STYLE_DEFAULT };

/** Categorías del arco: grupos de opciones (tarjetas) y controles propios. */
const CATS = [
  { id: 'body', label: 'Cuerpo', icon: 'body', groups: ['gender'], extra: bodyControls },
  { id: 'hair', label: 'Peinado', icon: 'hair', groups: ['hair'], zoom: true },
  { id: 'face', label: 'Cara', icon: 'face', groups: ['eyes', 'mouth', 'facial'], zoom: true, extra: faceControls },
  { id: 'clothes', label: 'Ropa', icon: 'clothes', groups: ['top', 'bottom', 'shoes'] },
  { id: 'profession', label: 'Profesión', icon: 'profession', groups: ['profession'] },
  { id: 'accessory', label: 'Accesorio', icon: 'accessory', groups: ['accessory'] },
  { id: 'mobility', label: 'Movilidad', icon: 'mobility', groups: ['mobility'] },
  { id: 'style', label: 'Estilo de línea', icon: 'style', groups: [], extra: styleControls },
];
let active = CATS[0];

/** El calzado solo se ve en lateral: la tarjeta de ropa lo enseña en esa vista. */
const THUMB_VIEW = { shoes: 'lateral', mobility: 'lateral' };

/* ------------------------------------------------------------- Render */
function previewStyle() {
  // Los grosores se eligen en mm de ploteo; en el dibujo (mm reales) se multiplican por la escala
  return { perim: style.perim * style.scale, inner: style.inner * style.scale, shading: style.shading, shadow: style.shadow };
}

function draw() {
  const fig = buildFigure(state);
  $('preview').innerHTML = renderSVG(fig, previewStyle(), { title: $('name').value });
  $('note').textContent = fig.notes[0] || '';
  for (const b of $('views').children) b.setAttribute('aria-checked', String(b.dataset.v === state.view));
  $('s-weight').value = state.weight;
  $('s-stature').value = state.stature;
  return fig;
}

function thumb(st, zoom) {
  const fig = buildFigure(st);
  const items = zoom ? fig.items.filter((i) => i.box.y0 > fig.S * 0.72 && !i.name.startsWith('silla')) : fig.items;
  return renderSVG({ ...fig, items: items.length ? items : fig.items }, { ...previewStyle(), shadow: false }, { pad: 30 });
}

/* ------------------------------------------------------------- Panel */
function openCat(cat) {
  active = cat;
  $('panel-title').textContent = cat.label;
  for (const b of $('arc').children) b.setAttribute('aria-pressed', String(b.dataset.id === cat.id));
  renderPanel();
}

function renderPanel() {
  const body = $('panel-body');
  body.innerHTML = '';
  if (active.extra) active.extra(body);
  for (const key of active.groups) {
    const def = OPTIONS[key];
    const wrap = document.createElement('section');
    wrap.innerHTML = `<h3 class="group-label">${def.label}</h3>`;
    const grid = document.createElement('div');
    grid.className = 'grid';
    grid.setAttribute('role', 'listbox');
    grid.setAttribute('aria-label', def.label);
    for (const [val, label] of def.options) {
      const st = { ...state, [key]: val };
      if (THUMB_VIEW[key]) st.view = THUMB_VIEW[key];
      if (st.view === 'planta') st.view = 'frontal';
      const c = document.createElement('button');
      c.type = 'button';
      c.className = 'card';
      c.setAttribute('role', 'option');
      c.setAttribute('aria-selected', String(state[key] === val));
      c.innerHTML = `<div class="thumb">${thumb(st, active.zoom)}</div><span>${label}</span>`;
      c.addEventListener('click', () => set({ [key]: val }));
      grid.appendChild(c);
    }
    wrap.appendChild(grid);
    body.appendChild(wrap);
  }
}

function slider(parent, { label, min, max, step, get, setv, fmt }) {
  const row = document.createElement('label');
  row.className = 'row';
  row.innerHTML = `<span>${label}</span>`;
  const input = Object.assign(document.createElement('input'), { type: 'range', min, max, step, value: get() });
  const out = document.createElement('output');
  out.textContent = fmt(get());
  input.addEventListener('input', () => { setv(parseFloat(input.value)); out.textContent = fmt(get()); draw(); });
  input.addEventListener('change', () => { commit(); renderPanel(); });
  row.append(input, out);
  parent.appendChild(row);
}

function segmented(parent, { label, options, get, setv }) {
  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = `<span>${label}</span>`;
  const seg = document.createElement('div');
  seg.className = 'seg';
  seg.setAttribute('role', 'radiogroup');
  seg.setAttribute('aria-label', label);
  for (const [v, l] of options) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(get() === v));
    b.textContent = l;
    b.addEventListener('click', () => { setv(v); draw(); commit(); renderPanel(); });
    seg.appendChild(b);
  }
  row.appendChild(seg);
  parent.appendChild(row);
}

function toggle(parent, { label, get, setv }) {
  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = `<span>${label}</span>`;
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'switch';
  b.setAttribute('role', 'switch');
  b.setAttribute('aria-label', label);
  b.setAttribute('aria-checked', String(get()));
  b.addEventListener('click', () => { setv(!get()); b.setAttribute('aria-checked', String(get())); draw(); commit(); });
  row.appendChild(b);
  parent.appendChild(row);
}

const box = (parent) => { const d = document.createElement('div'); d.className = 'ctrl'; parent.appendChild(d); return d; };
const pct = (v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)} %`;

function bodyControls(p) {
  const b = box(p);
  slider(b, { label: 'Complexión', min: -1, max: 1, step: 0.05, get: () => state.weight, setv: (v) => { state.weight = v; }, fmt: pct });
  slider(b, { label: 'Estatura', min: -1, max: 1, step: 0.05, get: () => state.stature, setv: (v) => { state.stature = v; }, fmt: (v) => `${Math.round(1750 * (1 + 0.08 * v))} mm` });
}

function faceControls(p) {
  const b = box(p);
  const mul = (v) => `×${v.toFixed(2)}`;
  slider(b, { label: 'Ojos', min: 0.6, max: 1.8, step: 0.05, get: () => state.eyeSize, setv: (v) => { state.eyeSize = v; }, fmt: mul });
  slider(b, { label: 'Boca', min: 0.6, max: 1.8, step: 0.05, get: () => state.mouthSize, setv: (v) => { state.mouthSize = v; }, fmt: mul });
  slider(b, { label: 'Nariz', min: 0.6, max: 1.8, step: 0.05, get: () => state.noseSize, setv: (v) => { state.noseSize = v; }, fmt: mul });
  const h = document.createElement('p');
  h.className = 'hint';
  h.textContent = 'Si un rasgo no cabe en la cara, la cabeza entera crece y el resto se reajusta para mantener la proporción.';
  b.appendChild(h);
}

function styleControls(p) {
  const b = box(p);
  const mm = (v) => `${v.toFixed(2).replace('.', ',')} mm`;
  slider(b, { label: 'Perímetro', min: 0.05, max: 0.6, step: 0.01, get: () => style.perim, setv: (v) => { style.perim = v; }, fmt: mm });
  slider(b, { label: 'Líneas interiores', min: 0, max: 0.25, step: 0.01, get: () => style.inner, setv: (v) => { style.inner = v; }, fmt: (v) => (v ? `+${mm(v)}` : 'original') });
  segmented(b, { label: 'Sombreado interior', options: [['ninguno', 'Ninguno'], ['tono', 'Tono'], ['rayado', 'Rayado']], get: () => style.shading, setv: (v) => { style.shading = v; } });
  toggle(b, { label: 'Sombra proyectada', get: () => style.shadow, setv: (v) => { style.shadow = v; } });
  segmented(b, { label: 'Escala de ploteo', options: [[20, '1:20'], [50, '1:50'], [100, '1:100']], get: () => style.scale, setv: (v) => { style.scale = v; } });
  const h = document.createElement('p');
  h.className = 'hint';
  h.textContent = 'Los grosores son en mm de papel a la escala elegida. El bloque DXF los lleva como grosor de polilínea; el sombreado solo se aplica al SVG.';
  b.appendChild(h);
}

/* ---------------------------------------------------------- Historial */
const past = [];
let future = [];
const snap = () => JSON.stringify({ state, style });
function commit() {
  const s = snap();
  if (past[past.length - 1] === s) return;
  past.push(s);
  if (past.length > 80) past.shift();
  future = [];
  syncHistory();
}
function restore(s) { const o = JSON.parse(s); Object.assign(state, o.state); Object.assign(style, o.style); draw(); renderPanel(); }
function undo() { if (past.length > 1) { future.push(past.pop()); restore(past[past.length - 1]); syncHistory(); } }
function redo() { if (future.length) { const s = future.pop(); past.push(s); restore(s); syncHistory(); } }
function syncHistory() { $('btn-undo').disabled = past.length <= 1; $('btn-redo').disabled = !future.length; }

function set(patch) { Object.assign(state, patch); draw(); renderPanel(); commit(); }

const pick = (a) => a[Math.floor(Math.random() * a.length)];
function randomize() {
  const view = state.view;
  for (const [k, def] of Object.entries(OPTIONS)) if (k !== 'view') state[k] = pick(def.options)[0];
  if (Math.random() < 0.7) state.mobility = 'ninguna';
  if (state.gender === 'masculino' && state.bottom === 'falda' && Math.random() < 0.7) state.bottom = 'vaqueros';
  state.view = view;
  state.weight = +(Math.random() * 1.2 - 0.6).toFixed(2);
  state.stature = +(Math.random() * 1.2 - 0.6).toFixed(2);
  state.eyeSize = state.mouthSize = state.noseSize = 1;
  draw(); renderPanel(); commit();
}
function reset() { Object.assign(state, DEFAULT); Object.assign(style, STYLE_DEFAULT); draw(); renderPanel(); commit(); }

/* ------------------------------------------------------------ Exportar */
let toastTimer;
function say(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}
const label = (key) => OPTIONS[key].options.find(([v]) => v === state[key])?.[1] || state[key];
const slug = (s) => (s || 'sim').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'SIM';

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportDXF() {
  try {
    const fig = buildFigure(state);
    const block = `SIM_${slug($('name').value).toUpperCase()}_${fig.view.toUpperCase()}`;
    const r = exportBlockDXF(fig, { perim: style.perim, inner: style.inner, shadow: style.shadow }, {
      scale: style.scale, blockName: block,
      attrs: { NOMBRE: $('name').value || 'SIM', GENERO: label('gender'), PROFESION: label('profession'), MOVILIDAD: label('mobility'), VISTA: fig.view },
    });
    download(`${block}.dxf`, r.text, 'application/dxf');
    say(`Bloque ${block} · ${r.polylines} polilíneas · mm, 1:${style.scale}`);
  } catch (e) { console.error(e); say('No se pudo exportar el bloque DXF'); }
}

function exportSVG() {
  try {
    const fig = buildFigure(state);
    download(`${slug($('name').value)}_${fig.view}.svg`, renderSVG(fig, previewStyle(), { title: $('name').value }), 'image/svg+xml');
    say('SVG exportado');
  } catch (e) { console.error(e); say('No se pudo exportar el SVG'); }
}

/* -------------------------------------------------------------- Inicio */
function buildChrome() {
  for (const [v, l] of OPTIONS.view.options) {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.v = v; b.textContent = l;
    b.setAttribute('role', 'radio');
    b.addEventListener('click', () => set({ view: v }));
    $('views').appendChild(b);
  }
  CATS.forEach((cat, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'cat'; b.dataset.id = cat.id; b.dataset.label = cat.label;
    b.setAttribute('aria-label', cat.label);
    b.innerHTML = `<svg class="ic"><use href="#i-${cat.icon}"/></svg>`;
    const t = i / (CATS.length - 1);
    b.style.setProperty('--dx', `${-Math.round(Math.sin(t * Math.PI) * 30)}px`);
    b.addEventListener('click', () => openCat(cat));
    $('arc').appendChild(b);
  });
  for (const [id, key] of [['s-weight', 'weight'], ['s-stature', 'stature']]) {
    const el = $(id);
    el.addEventListener('input', () => { state[key] = parseFloat(el.value); draw(); });
    el.addEventListener('change', () => { commit(); renderPanel(); });
    el.addEventListener('dblclick', () => set({ [key]: 0 }));
  }
  $('name').addEventListener('change', draw);
  $('btn-random').addEventListener('click', randomize);
  $('btn-reset').addEventListener('click', reset);
  $('btn-undo').addEventListener('click', undo);
  $('btn-redo').addEventListener('click', redo);
  $('btn-dxf').addEventListener('click', exportDXF);
  $('btn-svg').addEventListener('click', exportSVG);
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'text') return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  });
}

try {
  await loadKit(ALL_PARTS);
  buildChrome();
  draw();
  openCat(CATS[0]);
  commit();
  $('loading').hidden = true;
} catch (e) {
  console.error(e);
  $('loading').textContent = 'No se pudo cargar el kit de piezas. Abre la página desde un servidor (no con file://).';
}

window.simply = { state, style, set, buildFigure: () => buildFigure(state), exportDXF, exportSVG };
