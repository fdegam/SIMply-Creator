// Sistema de proporciones del kit vectorial.
// Todas las medidas de una parte se expresan en relación con la CABEZA (ancho = 1.0),
// de modo que una boca grande siempre sale dentro de una cara grande y proporcionada.
//
// Un rasgo nunca se escala por sí solo: su tamaño sale de una regla (ratio) respecto a
// su región. Si el resultado se sale de los límites, se recorta y se avisa.

/** Anatomía de referencia de la cara, en fracciones del ancho de cabeza (H). */
export const FACE = {
  eyeSpacing:   { ideal: 0.40, min: 0.34, max: 0.46 },   // distancia entre centros de ojos
  eyeWidth:     { ideal: 0.20, min: 0.14, max: 0.26 },   // ancho de un ojo
  noseWidth:    { ideal: 0.16, min: 0.10, max: 0.22 },
  mouthWidth:   { ideal: 0.42, min: 0.30, max: 0.52 },   // ancho de la boca (≈ distancia entre pupilas)
  browWidth:    { ideal: 0.26, min: 0.18, max: 0.34 },
  earHeight:    { ideal: 0.40, min: 0.32, max: 0.48 },
  // Verticales (alturas en fracciones de la altura de cabeza, Hh = 1.2 H aprox.)
  eyeLine:      { ideal: 0.50, min: 0.45, max: 0.55 },   // altura de los ojos desde arriba
  noseLine:     { ideal: 0.72, min: 0.66, max: 0.78 },
  mouthLine:    { ideal: 0.86, min: 0.80, max: 0.92 },
};

/** Regla de cara: el rasgo debe caber en su región. Cada par = [rasgo, referencia, máximo]. */
export const RULES = [
  // La boca no puede superar la separación entre pupilas más de un 25 %
  { name: 'boca ≤ separación de ojos ×1.25', a: 'mouthWidth', b: 'eyeSpacing', max: 1.25 },
  // Un ojo no puede ser más ancho que la mitad de su separación (si no, se tocan)
  { name: 'ojo ≤ 0,65 × separación', a: 'eyeWidth', b: 'eyeSpacing', max: 0.65 },
  // La nariz no más ancha que la distancia entre ojos
  { name: 'nariz ≤ separación de ojos', a: 'noseWidth', b: 'eyeSpacing', max: 1.0 },
  // La boca no más ancha que dos tercios de la cabeza
  { name: 'boca ≤ 2/3 de la cabeza', a: 'mouthWidth', b: null, max: 0.66 },
];

/**
 * Ajusta un valor a su rango ideal (con límites duros).
 * @returns {{value:number, clamped:boolean}}
 */
export function fit(name, value) {
  const r = FACE[name];
  const v = Math.min(r.max, Math.max(r.min, value));
  return { value: v, clamped: v !== value };
}

/**
 * Calcula las medidas finales de la cara a partir de los valores pedidos (sliders o
 * variantes de parte) y comprueba las reglas. Devuelve medidas coherentes y avisos.
 * @param {Partial<Record<keyof FACE, number>>} requested
 * @param {number} headW  ancho de cabeza en unidades de escena (referencia)
 */
export function solveFace(requested = {}, headW = 1) {
  const out = {};
  const notes = [];
  for (const k of Object.keys(FACE)) {
    const want = requested[k] ?? FACE[k].ideal;
    const { value, clamped } = fit(k, want);
    out[k] = value;
    if (clamped) notes.push(`${k}: ajustado de ${want.toFixed(2)} a ${value.toFixed(2)} (límite)`);
  }
  // Reglas relacionales: si una pieza se sale, se reduce la pieza, no la regla
  for (const r of RULES) {
    if (r.b === null) {
      if (out[r.a] > r.max) { notes.push(`${r.name}: reducido`); out[r.a] = r.max; }
      continue;
    }
    const lim = out[r.b] * r.max;
    if (out[r.a] > lim) { notes.push(`${r.name}: ${r.a} reducido a ${lim.toFixed(2)}`); out[r.a] = lim; }
  }
  return { face: out, headW, notes, ok: notes.length === 0 };
}

/** Escala en unidades absolutas (para colocar partes vectoriales). */
export function toUnits(face, headW) {
  const abs = {};
  for (const [k, v] of Object.entries(face)) abs[k] = v * headW;
  return abs;
}

/** Máximo efectivo de cada rasgo (límite propio y reglas con valores ideales). */
function effectiveMax(k) {
  if (k === 'mouthWidth') return Math.min(FACE.mouthWidth.max, FACE.eyeSpacing.ideal * 1.25, 0.66);
  if (k === 'eyeWidth') return Math.min(FACE.eyeWidth.max, FACE.eyeSpacing.max * 0.65);
  if (k === 'noseWidth') return Math.min(FACE.noseWidth.max, FACE.eyeSpacing.max);
  return FACE[k].max;
}

export const MAX_HEAD_SCALE = 1.2;

/**
 * Resuelve la cara completa. Si un rasgo pedido no cabe en la cara, en lugar de
 * deformarlo se agranda la CABEZA (hasta MAX_HEAD_SCALE) y todos los rasgos se
 * recalculan respecto a la cabeza nueva, de modo que el conjunto sigue en proporción.
 * @param {{eyeWidth?:number, mouthWidth?:number, noseWidth?:number}} req  en fracciones de la cabeza base
 */
export function solveHead(req = {}) {
  let headScale = 1;
  for (const k of ['eyeWidth', 'mouthWidth', 'noseWidth']) {
    if (req[k] != null) headScale = Math.max(headScale, req[k] / effectiveMax(k));
  }
  const notes = [];
  if (headScale > MAX_HEAD_SCALE) {
    notes.push('Rasgo demasiado grande incluso con la cabeza al máximo: se limita.');
    headScale = MAX_HEAD_SCALE;
  }
  const rel = {};
  for (const [k, v] of Object.entries(req)) if (v != null) rel[k] = v / headScale;
  // Ojos grandes separan un poco los ojos para que no se toquen
  // y una boca grande también los separa: la cara entera se adapta
  rel.eyeSpacing = Math.max(FACE.eyeSpacing.ideal, (rel.eyeWidth || 0) / 0.55, (rel.mouthWidth || 0) / 1.25);
  const solved = solveFace(rel);
  if (headScale > 1.001) notes.unshift(`Cabeza ×${headScale.toFixed(2)} para mantener la proporción.`);
  return { headScale, face: solved.face, notes: notes.concat(solved.notes) };
}
