// Ensamblaje de la figura 2D a partir del kit de partes.
// Coordenadas en milímetros, Y hacia arriba, origen en el suelo entre los pies.
// Cada pieza colocada es { name, box:{x0,y0,x1,y1}, flip, layer } y se dibuja en orden.
import { part } from './kit.js';
import { solveHead } from './proportions.js';

/* ---------------------------------------------------------- Metadatos */
// Geometría de cada cabeza dentro de su imagen (fracciones del recuadro):
// skull = ancho del cráneo sin orejas, top/chin = alto de la cara, neckX = centro del cuello.
const HEADS = {
  'cabeza-frontal':       { skull: [0.06, 0.94], top: 0.0, chin: 0.84, neckX: 0.5 },
  'cabeza-mujer-frontal': { skull: [0.06, 0.94], top: 0.0, chin: 0.82, neckX: 0.5 },
  'cabeza-perfil':        { skull: [0.0, 0.93], top: 0.0, chin: 0.78, neckX: 0.42 },
  'cabeza-perfil-mujer':  { skull: [0.0, 0.91], top: 0.0, chin: 0.73, neckX: 0.40 },
  'cabeza-posterior-corto':  { skull: [0.08, 0.92], top: 0.0, chin: 0.80, neckX: 0.5 },
  'cabeza-posterior-largo':  { skull: [0.05, 0.95], top: 0.0, chin: 0.80, neckX: 0.5 },
  'cabeza-posterior-mono':   { skull: [0.12, 0.88], top: 0.0, chin: 0.82, neckX: 0.5 },
  'cabeza-posterior-rizado': { skull: [0.0, 1.0], top: 0.0, chin: 0.80, neckX: 0.5 },
};

/* ------------------------------------------------------------ Opciones */
export const OPTIONS = {
  view: { label: 'Vista', options: [['frontal', 'Frontal'], ['posterior', 'Posterior'], ['lateral', 'Lateral'], ['planta', 'Planta']] },
  gender: { label: 'Género', options: [['masculino', 'Masculino'], ['femenino', 'Femenino']] },
  hair: { label: 'Peinado', options: [['corto', 'Corto'], ['largo', 'Largo'], ['rizado', 'Rizado'], ['mono', 'Moño'], ['calvo', 'Calvo']] },
  eyes: { label: 'Ojos', options: [['abiertos', 'Abiertos'], ['cerrados', 'Cerrados']] },
  mouth: { label: 'Boca', options: [['sonrisa', 'Sonrisa'], ['neutra', 'Neutra']] },
  facial: { label: 'Rasgo facial', options: [['ninguno', 'Ninguno'], ['barba', 'Barba'], ['gafas', 'Gafas']] },
  top: { label: 'Parte de arriba', options: [['camiseta', 'Camiseta'], ['manga-larga', 'Manga larga'], ['chaqueta', 'Chaqueta']] },
  bottom: { label: 'Parte de abajo', options: [['vaqueros', 'Vaqueros'], ['cargo', 'Cargo'], ['bermudas', 'Bermudas'], ['falda', 'Falda']] },
  shoes: { label: 'Calzado', options: [['zapatillas', 'Zapatillas'], ['botas', 'Botas'], ['tacones', 'Tacones']] },
  profession: { label: 'Profesión', options: [['ninguna', 'Ninguna'], ['arquitecto', 'Arquitecto'], ['chef', 'Chef'], ['medico', 'Médico'], ['jardinero', 'Jardinero']] },
  accessory: { label: 'Accesorio', options: [['ninguno', 'Ninguno'], ['sombrero', 'Sombrero'], ['gorra', 'Gorra'], ['mochila', 'Mochila']] },
  mobility: { label: 'Movilidad', options: [['ninguna', 'Sin ayuda'], ['silla', 'Silla de ruedas'], ['motorizada', 'Silla motorizada'], ['muletas', 'Muletas'], ['baston', 'Bastón'], ['andador', 'Andador']] },
};

export const DEFAULT = {
  view: 'frontal', gender: 'masculino', hair: 'corto', eyes: 'abiertos', mouth: 'sonrisa', facial: 'ninguno',
  top: 'camiseta', bottom: 'vaqueros', shoes: 'zapatillas', profession: 'ninguna', accessory: 'ninguno', mobility: 'ninguna',
  stature: 0, weight: 0,           // -1..1
  eyeSize: 1, mouthSize: 1, noseSize: 1, // multiplicadores pedidos (la regla de proporción decide el resultado)
};

/** Todas las partes que puede necesitar una figura (para precargar). */
export const ALL_PARTS = [
  'cabeza-frontal', 'cabeza-mujer-frontal', 'cabeza-perfil', 'cabeza-perfil-mujer',
  'cabeza-posterior-corto', 'cabeza-posterior-largo', 'cabeza-posterior-mono', 'cabeza-posterior-rizado',
  'pelo-corto', 'pelo-largo', 'pelo-rizado', 'pelo-mono', 'pelo-largo-perfil', 'pelo-corto-perfil',
  'ojos-par', 'ojos-cerrados', 'boca-sonrisa', 'boca-neutra', 'nariz', 'cejas', 'barba-bigote', 'gafas',
  'torso-hombre', 'torso-mujer', 'camisa-manga-larga', 'torso-mujer-manga-larga', 'chaqueta', 'chaqueta-chef',
  'torso-hombre-posterior', 'torso-mujer-posterior', 'torso-hombre-lateral', 'torso-mujer-lateral',
  'brazo', 'brazo-lateral', 'brazo-doblado', 'mano-derecha', 'vaqueros', 'pantalon-cargo', 'bermudas', 'falda', 'vaqueros-posterior',
  'pierna-lateral', 'pierna-sentada', 'zapatillas', 'botas', 'tacones',
  'bata-medico', 'chaleco-reflectante', 'delantal', 'casco-obra', 'gorro-chef', 'sombrero', 'gorra', 'mochila', 'planos', 'pala',
  'silla-de-ruedas', 'silla-motorizada', 'muletas', 'baston', 'andador', 'planta-persona', 'planta-silla-de-ruedas',
];

const FEATURES = new Set(['cejas', 'ojos-par', 'ojos-cerrados', 'nariz', 'boca-sonrisa', 'boca-neutra', 'gafas']);
const SHORT_SLEEVE = new Set(['torso-hombre', 'torso-mujer', 'torso-hombre-posterior']);

/* ------------------------------------------------------------ Ayudas */
const aspect = (n) => part(n).w / part(n).h;

/** Recuadro a partir de un ancla. ax/ay: punto del recuadro (0..1) que cae en (x,y). */
function boxAt(name, { x, y, h, w, ax = 0.5, ay = 0 }) {
  const H = h ?? w / aspect(name);
  const W = w ?? h * aspect(name);
  const x0 = x - W * ax, y0 = y - H * ay;
  return { x0, y0, x1: x0 + W, y1: y0 + H };
}

/* -------------------------------------------------------- Construcción */

/** Devuelve { items, notes, view } para el estado dado. */
export function buildFigure(st) {
  const notes = [];
  let view = st.view;
  const seated = st.mobility === 'silla' || st.mobility === 'motorizada';
  if (seated && (view === 'frontal' || view === 'posterior')) {
    notes.push('La silla de ruedas solo está dibujada en lateral y planta: se muestra la vista lateral.');
    view = 'lateral';
  }
  const S = 1750 * (1 + 0.08 * st.stature);
  const wf = 1 + 0.22 * st.weight;           // factor de anchura
  const female = st.gender === 'femenino';
  const items = [];
  const add = (name, box, o = {}) => items.push({ name, box, flip: !!o.flip, clipY: o.clipY, layer: o.layer || (FEATURES.has(name) ? 'RASGO' : 'FIGURA') });

  // Cabeza: la regla de proporción decide el tamaño real de cada rasgo y, si hace falta,
  // agranda la cabeza entera para que una boca u ojos grandes sigan en proporción.
  const head = solveHead({ eyeWidth: 0.20 * st.eyeSize, mouthWidth: 0.42 * st.mouthSize, noseWidth: 0.16 * st.noseSize });
  notes.push(...head.notes);
  const faceH = S * 0.125 * head.headScale;  // coronilla -> barbilla

  if (view === 'planta') {
    if (seated) add('planta-silla-de-ruedas', boxAt('planta-silla-de-ruedas', { x: 0, y: -550, w: 680 * wf }));
    else add('planta-persona', boxAt('planta-persona', { x: 0, y: -330, w: 560 * wf }));
    return { items, notes, view, S };
  }

  if (view === 'lateral') return { ...side(st, { S, wf, female, faceH, seated, add, items, notes }), view };

  const back = view === 'posterior';

  /* ---- Cuerpo (frontal / posterior) ---- */
  const chinY = S - faceH;
  const shoulderY = chinY - S * 0.035;
  const hipY = S * 0.52;
  const torsoName = back ? (female ? 'torso-mujer-posterior' : 'torso-hombre-posterior') : torsoFront(st, female);
  const torsoW = S * (female ? 0.24 : 0.27) * wf;
  const torsoBox = boxAt(torsoName, { x: 0, y: shoulderY + S * 0.02, w: torsoW, ay: 1 });
  // alto natural limitado: la prenda acaba en la cadera
  torsoBox.y0 = Math.min(torsoBox.y0, hipY);

  // Piernas / prenda inferior
  const bottomName = back ? 'vaqueros-posterior' : ({ vaqueros: 'vaqueros', cargo: 'pantalon-cargo', bermudas: 'bermudas', falda: 'falda' })[st.bottom];
  const pantsTop = S * 0.555;
  const pantsW = S * (female ? 0.2 : 0.21) * wf;
  if (st.bottom === 'bermudas' || st.bottom === 'falda') {
    // Prenda corta: piernas de piel con el pantalón como base y la prenda encima
    add('vaqueros', { x0: -pantsW / 2, y0: S * 0.045, x1: pantsW / 2, y1: pantsTop });
    const h = st.bottom === 'falda' ? S * 0.27 : S * 0.24;
    add(bottomName, boxAt(bottomName, { x: 0, y: pantsTop, h, w: pantsW * (st.bottom === 'falda' ? 1.25 : 1.1), ay: 1 }));
  } else {
    add(bottomName, { x0: -pantsW / 2, y0: S * 0.045, x1: pantsW / 2, y1: pantsTop });
  }
  feetFront(add, S, pantsW, wf);

  // Brazos: con manga corta se dibuja el brazo (su manga queda bajo la del torso);
  // con manga larga la prenda ya trae las mangas y solo asoman las manos.
  const armLen = S * 0.4;
  const armW = armLen * aspect('brazo') * Math.sqrt(wf);
  const shortSleeve = SHORT_SLEEVE.has(torsoName) && !(st.profession === 'medico');
  if (shortSleeve) {
    for (const s of [-1, 1]) {
      const cx = s * (torsoW / 2 - armW * 0.55);
      add('brazo', { x0: cx - armW / 2, y0: shoulderY - armLen - S * 0.02, x1: cx + armW / 2, y1: shoulderY - S * 0.02 }, { flip: s < 0 });
    }
  } else {
    for (const s of [-1, 1]) {
      const hx = s * (torsoW / 2 - torsoW * 0.09);
      add('mano-derecha', boxAt('mano-derecha', { x: hx, y: torsoBox.y0 + S * 0.02, h: S * 0.085, ay: 1 }), { flip: s < 0 });
    }
  }
  if (back && st.accessory === 'mochila') { /* la mochila va encima del torso, más abajo */ }
  add(torsoName, torsoBox);

  // Prendas de profesión encima del torso
  if (!back) professionFront(st, add, { S, torsoBox, torsoW, shoulderY, hipY });
  if (back && st.accessory === 'mochila') add('mochila', boxAt('mochila', { x: 0, y: shoulderY - S * 0.02, w: torsoW * 0.62, ay: 1 }));
  if (back && st.profession === 'medico') add('bata-medico', boxAt('bata-medico', { x: 0, y: shoulderY + S * 0.02, w: torsoW * 1.05, ay: 1 }));

  // Ayudas de movilidad (de pie)
  if (st.mobility === 'muletas') add('muletas', boxAt('muletas', { x: 0, y: 0, h: S * 0.66, w: torsoW + armW * 1.4 }));
  if (st.mobility === 'baston') add('baston', boxAt('baston', { x: torsoW / 2 + armW * 0.3, y: 0, h: S * 0.5 }));
  if (st.mobility === 'andador') add('andador', boxAt('andador', { x: 0, y: 0, h: S * 0.52, w: torsoW * 1.45 }), { layer: 'AYUDA' });

  // Cabeza
  headFront(st, add, { S, chinY, faceH, back, head, female, notes });
  return { items, notes, view, S };
}

function torsoFront(st, female) {
  if (st.profession === 'chef') return 'chaqueta-chef';
  if (st.profession === 'arquitecto' || st.top === 'manga-larga') return female ? 'torso-mujer-manga-larga' : 'camisa-manga-larga';
  if (st.top === 'chaqueta') return 'chaqueta';
  return female ? 'torso-mujer' : 'torso-hombre';
}

function professionFront(st, add, { S, torsoBox, torsoW, shoulderY }) {
  const p = st.profession;
  if (p === 'arquitecto') {
    add('chaleco-reflectante', boxAt('chaleco-reflectante', { x: 0, y: shoulderY + S * 0.005, w: torsoW * 0.78, ay: 1 }));
    add('planos', boxAt('planos', { x: torsoW * 0.55, y: S * 0.47, w: S * 0.2 }));
  }
  if (p === 'medico') add('bata-medico', boxAt('bata-medico', { x: 0, y: shoulderY + S * 0.02, w: torsoW * 1.05, ay: 1 }));
  if (p === 'jardinero') {
    add('delantal', boxAt('delantal', { x: 0, y: shoulderY - S * 0.01, w: torsoW * 0.72, ay: 1 }));
    add('pala', boxAt('pala', { x: torsoW * 0.62, y: 0, h: S * 0.62 }));
  }
}

function feetFront(add, S, pantsW) {
  // Los zapatos frontales no están en el kit: se dibujan como un volumen simple
  for (const s of [-1, 1]) {
    add('@pie', { x0: s * pantsW * 0.25 - S * 0.04, y0: 0, x1: s * pantsW * 0.25 + S * 0.04, y1: S * 0.055 });
  }
}

function headFront(st, add, { S, chinY, faceH, back, head, female }) {
  const name = back
    ? ({ corto: 'cabeza-posterior-corto', largo: 'cabeza-posterior-largo', mono: 'cabeza-posterior-mono', rizado: 'cabeza-posterior-rizado', calvo: 'cabeza-posterior-corto' })[st.hair]
    : (female ? 'cabeza-mujer-frontal' : 'cabeza-frontal');
  const m = HEADS[name];
  const partH = faceH / (m.chin - m.top);
  const box = boxAt(name, { x: 0, y: S - partH, h: partH });
  const W = box.x1 - box.x0;
  const skullW = W * (m.skull[1] - m.skull[0]);
  const top = S;
  // Melena y rizos: detrás de la cabeza; delante solo la parte alta (flequillo/coronilla)
  const big = { largo: ['pelo-largo', 0.06, 1.55], rizado: ['pelo-rizado', 0.16, 1.55] }[st.hair];
  const bigBox = big && boxAt(big[0], { x: 0, y: top + faceH * big[1], w: skullW * big[2], ay: 1 });
  if (big && (!back || st.hair === 'largo')) add(big[0], bigBox);
  add(name, box);
  if (back) { hatFront(st, add, { top, skullW, faceH }); return; }

  // Rasgos con medidas resueltas por la regla de proporción
  const f = head.face;
  const y = (frac) => top - faceH * frac;          // altura a partir de la coronilla
  const brow = f.eyeLine - 0.1;
  add('cejas', boxAt('cejas', { x: 0, y: y(brow), w: skullW * (f.eyeSpacing + f.browWidth) * 1.05, ay: 0.5 }));
  const eyesName = st.eyes === 'cerrados' ? 'ojos-cerrados' : 'ojos-par';
  add(eyesName, boxAt(eyesName, { x: 0, y: y(f.eyeLine), w: skullW * (f.eyeSpacing + f.eyeWidth), ay: 0.5 }));
  add('nariz', boxAt('nariz', { x: 0, y: y(f.noseLine), w: skullW * f.noseWidth, ay: 0 }));
  const mouthName = st.mouth === 'neutra' ? 'boca-neutra' : 'boca-sonrisa';
  add(mouthName, boxAt(mouthName, { x: 0, y: y(f.mouthLine), w: skullW * f.mouthWidth, ay: 0.5 }));
  if (st.facial === 'barba') add('barba-bigote', boxAt('barba-bigote', { x: 0, y: y(f.noseLine + 0.02), w: skullW * 1.02, ay: 1 }));
  if (st.facial === 'gafas') add('gafas', boxAt('gafas', { x: 0, y: y(f.eyeLine), w: skullW * (f.eyeSpacing + f.eyeWidth) * 1.45, ay: 0.5 }));

  // Pelo encima de la cabeza
  const hair = st.hair;
  if (hair === 'corto') add('pelo-corto', boxAt('pelo-corto', { x: 0, y: top + faceH * 0.05, w: skullW * 1.18, ay: 1 }));
  if (big) add(big[0], bigBox, { clipY: top - faceH * 0.2 });
  if (hair === 'mono') add('pelo-mono', boxAt('pelo-mono', { x: 0, y: top - faceH * 0.06, w: skullW * 0.62, ay: 0 }));
  hatFront(st, add, { top, skullW, faceH });
}

function hatFront(st, add, { top, skullW, faceH }) {
  const p = st.profession, a = st.accessory;
  if (p === 'arquitecto') return add('casco-obra', boxAt('casco-obra', { x: 0, y: top - faceH * 0.36, w: skullW * 1.3 }));
  if (p === 'chef') return add('gorro-chef', boxAt('gorro-chef', { x: 0, y: top - faceH * 0.12, w: skullW * 0.98 }));
  if (p === 'jardinero' || a === 'gorra') return add('gorra', boxAt('gorra', { x: 0, y: top - faceH * 0.34, w: skullW * 1.2 }));
  if (a === 'sombrero') return add('sombrero', boxAt('sombrero', { x: 0, y: top - faceH * 0.3, w: skullW * 2.1 }));
}

/* ------------------------------------------------------------ Lateral */
function side(st, { S, wf, female, faceH, seated, add, items, notes }) {
  const headName = female ? 'cabeza-perfil-mujer' : 'cabeza-perfil';
  const m = HEADS[headName];
  const shoes = ({ zapatillas: 'zapatillas', botas: 'botas', tacones: 'tacones' })[st.shoes];

  if (seated) {
    const chair = st.mobility === 'motorizada' ? 'silla-motorizada' : 'silla-de-ruedas';
    const seatY = chair === 'silla-motorizada' ? 560 : 500;
    add(chair, boxAt(chair, { x: -120, y: 0, w: chair === 'silla-motorizada' ? 1100 : 1080 }), { layer: 'AYUDA' });
    const legH = seatY + S * 0.06 - 70;
    add('pierna-sentada', boxAt('pierna-sentada', { x: -170, y: 70, h: legH * Math.sqrt(wf), ax: 0.1 }));
    const torsoName = female ? 'torso-mujer-lateral' : 'torso-hombre-lateral';
    const torsoH = S * 0.31;
    const torsoBox = boxAt(torsoName, { x: -170, y: seatY + S * 0.02, h: torsoH, w: torsoH * aspect(torsoName) * wf });
    add(torsoName, torsoBox);
    add('brazo-doblado', boxAt('brazo-doblado', { x: -150, y: seatY + S * 0.045, h: S * 0.29, ax: 0.25 }));
    const chinY = torsoBox.y1 - S * 0.012;
    headSide(st, add, { headName, m, chinY, faceH, x: -170 + S * 0.015 });
    return { items, notes, S };
  }

  // De pie
  const legTop = S * 0.555;
  if (st.mobility === 'andador') add('andador', boxAt('andador', { x: S * 0.2, y: 0, h: S * 0.52 }), { layer: 'AYUDA' });
  add('pierna-lateral', boxAt('pierna-lateral', { x: 0, y: S * 0.05, h: legTop - S * 0.05, w: (legTop - S * 0.05) * aspect('pierna-lateral') * wf }));
  add(shoes, boxAt(shoes, { x: S * 0.03, y: 0, w: S * 0.17 }));
  const torsoName = female ? 'torso-mujer-lateral' : 'torso-hombre-lateral';
  const chinY = S - faceH;
  const torsoTop = chinY + S * 0.012;
  const torsoBox = boxAt(torsoName, { x: 0, y: torsoTop, h: torsoTop - S * 0.5, w: (torsoTop - S * 0.5) * aspect(torsoName) * wf, ay: 1 });
  add(torsoName, torsoBox);
  add('brazo-lateral', boxAt('brazo-lateral', { x: -S * 0.005, y: torsoTop - S * 0.03, h: S * 0.4, ay: 1 }));
  if (st.mobility === 'baston') add('baston', boxAt('baston', { x: S * 0.1, y: 0, h: S * 0.5 }));
  if (st.mobility === 'muletas') add('muletas', boxAt('muletas', { x: S * 0.03, y: 0, h: S * 0.66, w: S * 0.12 }));
  headSide(st, add, { headName, m, chinY, faceH, x: 0 });
  return { items, notes, S };
}

function headSide(st, add, { headName, m, chinY, faceH, x }) {
  const partH = faceH / (m.chin - m.top);
  const top = chinY + faceH;
  const box = boxAt(headName, { x, y: top - partH, h: partH, ax: m.neckX });
  const W = box.x1 - box.x0;
  const skullW = W * (m.skull[1] - m.skull[0]);
  if (st.hair === 'largo') add('pelo-largo-perfil', boxAt('pelo-largo-perfil', { x: box.x0 + W * 0.42, y: top + faceH * 0.05, h: faceH * 2.0, ay: 1 }));
  add(headName, box);
  if (st.hair === 'corto') add('pelo-corto-perfil', boxAt('pelo-corto-perfil', { x: box.x0 + W * 0.45, y: top + faceH * 0.06, w: skullW * 1.05, ay: 1 }), { flip: true });
  if (st.hair === 'rizado') add('pelo-rizado', boxAt('pelo-rizado', { x: box.x0 + W * 0.42, y: top + faceH * 0.16, w: skullW * 1.3, ay: 1 }));
  if (st.hair === 'mono') add('pelo-mono', boxAt('pelo-mono', { x: box.x0 + W * 0.3, y: top - faceH * 0.1, w: skullW * 0.5, ay: 0 }));
  const p = st.profession, a = st.accessory;
  const hx = box.x0 + W * 0.47;
  if (p === 'arquitecto') add('casco-obra', boxAt('casco-obra', { x: hx, y: top - faceH * 0.36, w: skullW * 1.15 }));
  else if (p === 'chef') add('gorro-chef', boxAt('gorro-chef', { x: hx, y: top - faceH * 0.12, w: skullW * 0.9 }));
  else if (p === 'jardinero' || a === 'gorra') add('gorra', boxAt('gorra', { x: hx, y: top - faceH * 0.34, w: skullW * 1.1 }));
  else if (a === 'sombrero') add('sombrero', boxAt('sombrero', { x: hx, y: top - faceH * 0.3, w: skullW * 1.9 }));
}
