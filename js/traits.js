// Categoría RASGOS: peinado, ojos, nariz y rasgo facial.
// Cada opción exporta un `build(L)` que devuelve un THREE.Group anclado a la cabeza.
import * as THREE from 'three';
import { mats } from './materials.js';
import { mesh, box, ellipsoid, between, group, headZ } from './common.js';

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const mk = (id, label, build) => ({ id, label, build });

/* ------------------------------------------------------------ Peinado */

/** Casquete que cubre la parte alta/trasera de la cabeza. */
function cap(L, { grow = 1.07, cover = 0.56, tilt = -0.32, mat = mats.hair } = {}) {
  const H = L.head;
  const geo = new THREE.SphereGeometry(1, 10, 8, 0, Math.PI * 2, 0, Math.PI * cover);
  const m = mesh(geo, mat, 'casquete');
  m.scale.set(H.rx * grow, H.ry * grow, H.rz * grow);
  m.position.copy(H.c);
  m.rotation.x = tilt;
  return m;
}

const hair = {
  calvo: mk('calvo', 'Calvo', () => group('pelo-calvo')),

  corto: mk('corto', 'Corto', (L) => group('pelo-corto', cap(L))),

  largo: mk('largo', 'Largo', (L) => {
    const H = L.head;
    const back = box(H.rx * 2.05, 0.3 * L.s, H.rz * 0.55, v3(0, H.c.y - 0.12 * L.s, -H.rz * 0.72), mats.hair, 'melena');
    const sides = [-1, 1].map((s) => box(H.rz * 0.4, 0.26 * L.s, H.rz * 0.9, v3(s * (H.rx * 1.0), H.c.y - 0.09 * L.s, -H.rz * 0.25), mats.hair, 'mechon'));
    return group('pelo-largo', cap(L, { grow: 1.1 }), back, sides);
  }),

  media: mk('media', 'Media melena', (L) => {
    const H = L.head;
    const back = ellipsoid(v3(0, H.c.y - 0.03 * L.s, -H.rz * 0.35), H.rx * 1.12, H.ry * 0.95, H.rz * 0.95, mats.hair, 9, 6, 'media-melena');
    const fringe = box(H.rx * 1.5, H.r * 0.22, H.r * 0.3, v3(0, H.c.y + H.ry * 0.62, H.rz * 0.72), mats.hair, 'flequillo');
    fringe.rotation.x = -0.3;
    return group('pelo-media', cap(L, { grow: 1.1 }), back, fringe);
  }),

  rizado: mk('rizado', 'Rizado', (L) => {
    const H = L.head;
    const g = group('pelo-rizado', cap(L, { grow: 1.02, cover: 0.5 }));
    const n = 14;
    for (let i = 0; i < n; i++) {
      const th = (i / n) * Math.PI * 2;
      const rr = 0.9 + (i % 2) * 0.1;
      g.add(ellipsoid(v3(Math.sin(th) * H.rx * rr, H.c.y + H.ry * (0.45 + (i % 3) * 0.14), Math.cos(th) * H.rz * rr * (Math.cos(th) > 0.6 ? 0.55 : 1) - H.rz * 0.1), H.r * 0.33, H.r * 0.33, H.r * 0.33, mats.hair, 6, 4, 'rizo'));
    }
    g.add(ellipsoid(v3(0, H.c.y + H.ry * 0.95, -H.rz * 0.1), H.r * 0.55, H.r * 0.4, H.r * 0.6, mats.hair, 6, 4, 'rizo-top'));
    return g;
  }),

  mono: mk('mono', 'Moño', (L) => {
    const H = L.head;
    return group('pelo-mono', cap(L), ellipsoid(v3(0, H.c.y + H.ry * 1.05, -H.rz * 0.15), H.r * 0.42, H.r * 0.42, H.r * 0.42, mats.hair, 7, 5, 'mono'));
  }),

  cresta: mk('cresta', 'Cresta', (L) => {
    const H = L.head;
    const g = group('pelo-cresta', cap(L, { grow: 1.02, cover: 0.42, tilt: -0.2 }));
    for (let i = 0; i < 5; i++) {
      const a = -0.75 + i * 0.4; // de frente a nuca
      const p = v3(0, H.c.y + Math.cos(a) * H.ry * 1.0, Math.sin(a) * H.rz * 0.95 * -1 + H.rz * 0.2);
      const c = mesh(new THREE.ConeGeometry(H.r * 0.17, H.r * (0.62 - Math.abs(a) * 0.15), 4), mats.hair, 'pua');
      c.position.copy(p).add(v3(0, H.r * 0.2, 0));
      g.add(c);
    }
    return g;
  }),
};

/* --------------------------------------------------------------- Ojos */

function eyes(L, { size = 1, tilt = 0, lid = 0, gap = 0.4 }) {
  const g = new THREE.Group();
  const H = L.head;
  const ey = H.r * 0.12;
  for (const side of [-1, 1]) {
    const x = side * H.r * gap;
    const z = headZ(L, x, ey);
    const c = v3(x, H.c.y + ey, z - 0.004);
    const w = H.r * 0.2 * size;
    const eye = group('ojo');
    eye.add(ellipsoid(v3(0, 0, 0), w, w * 0.85, w * 0.5, mats.white, 7, 5, 'esclerotica'));
    eye.add(ellipsoid(v3(0, 0, w * 0.32), w * 0.58, w * 0.58, w * 0.3, mats.eyes, 7, 5, 'iris'));
    eye.add(ellipsoid(v3(0, 0, w * 0.5), w * 0.26, w * 0.26, w * 0.12, mats.dark, 5, 4, 'pupila'));
    if (lid > 0) {
      const l = ellipsoid(v3(0, w * (0.85 - lid * 0.55), w * 0.12), w * 1.08, w * 0.55 * (0.4 + lid), w * 0.58, mats.skin, 7, 4, 'parpado');
      eye.add(l);
    }
    eye.position.copy(c);
    eye.rotation.z = side * -tilt;
    g.add(eye);
  }
  return g;
}

const eyeOptions = {
  normales: mk('normales', 'Normales', (L) => group('ojos-normales', eyes(L, {}))),
  grandes: mk('grandes', 'Grandes', (L) => group('ojos-grandes', eyes(L, { size: 1.35, gap: 0.42 }))),
  rasgados: mk('rasgados', 'Rasgados', (L) => group('ojos-rasgados', eyes(L, { size: 1.05, tilt: 0.28, lid: 0.25 }))),
  somnolientos: mk('somnolientos', 'Somnolientos', (L) => group('ojos-somnolientos', eyes(L, { size: 1.1, lid: 0.55 }))),
};

/* ------------------------------------------------------------- Nariz */

function nose(L, r, h, y = -0.02) {
  const H = L.head;
  const m = mesh(new THREE.ConeGeometry(H.r * r, H.r * h, 4), mats.skin, 'nariz');
  const zf = headZ(L, 0, H.r * y);
  m.rotation.x = Math.PI / 2;
  m.rotation.y = Math.PI / 4;
  m.position.set(0, H.c.y + H.r * y, zf + H.r * h * 0.3);
  return m;
}

const noseOptions = {
  pequena: mk('pequena', 'Pequeña', (L) => group('nariz-pequena', nose(L, 0.1, 0.22))),
  recta: mk('recta', 'Recta', (L) => group('nariz-recta', nose(L, 0.14, 0.38))),
  grande: mk('grande', 'Grande', (L) => group('nariz-grande', nose(L, 0.2, 0.55, -0.05))),
  respingona: mk('respingona', 'Respingona', (L) => {
    const n = nose(L, 0.12, 0.3, -0.03);
    n.rotation.x = Math.PI / 2 + 0.35;
    return group('nariz-respingona', n);
  }),
};

/* ---------------------------------------------------- Rasgo facial */

const facial = {
  ninguno: mk('ninguno', 'Ninguno', () => group('rasgo-ninguno')),

  barba: mk('barba', 'Barba', (L) => {
    const H = L.head;
    // Collarín bajo la línea de la boca; deja visibles boca y mejillas altas
    const geo = new THREE.SphereGeometry(1, 10, 8, 0, Math.PI * 2, Math.PI * 0.69, Math.PI * 0.3);
    const jaw = mesh(geo, mats.hair, 'barba');
    jaw.scale.set(H.rx * 1.07, H.ry * 1.07, H.rz * 1.1);
    jaw.position.copy(H.c);
    const mus = box(H.r * 0.55, H.r * 0.1, H.r * 0.08, v3(0, H.c.y - H.ry * 0.36, headZ(L, 0, -H.ry * 0.36) + 0.004), mats.hair, 'bigote');
    const burns = [-1, 1].map((s) => box(H.r * 0.08, H.ry * 0.6, H.r * 0.3, v3(s * H.rx * 0.97, H.c.y - H.ry * 0.3, H.rz * 0.1), mats.hair, 'patilla'));
    return group('rasgo-barba', jaw, mus, burns);
  }),

  bigote: mk('bigote', 'Bigote', (L) => {
    const H = L.head;
    const y = -H.ry * 0.36;
    const g = group('rasgo-bigote');
    for (const s of [-1, 1]) {
      const m = box(H.r * 0.32, H.r * 0.1, H.r * 0.09, v3(s * H.r * 0.17, H.c.y + y, headZ(L, s * H.r * 0.17, y) + 0.004), mats.hair, 'bigote');
      m.rotation.z = s * -0.25;
      g.add(m);
    }
    return g;
  }),

  perilla: mk('perilla', 'Perilla', (L) => {
    const H = L.head;
    const y = -H.ry * 0.78;
    const c = mesh(new THREE.ConeGeometry(H.r * 0.2, H.r * 0.4, 4), mats.hair, 'perilla');
    c.rotation.x = Math.PI;
    c.rotation.y = Math.PI / 4;
    c.position.set(0, H.c.y + y, headZ(L, 0, y) + H.r * 0.02);
    return group('rasgo-perilla', c);
  }),

  gafas: mk('gafas', 'Gafas', (L) => {
    const H = L.head;
    const g = group('rasgo-gafas');
    const ey = H.r * 0.12;
    const zf = headZ(L, H.r * 0.4, ey) + 0.012;
    for (const s of [-1, 1]) {
      const ring = mesh(new THREE.TorusGeometry(H.r * 0.3, H.r * 0.035, 4, 8), mats.dark, 'montura');
      ring.position.set(s * H.r * 0.4, H.c.y + ey, zf);
      g.add(ring);
      g.add(between(v3(s * H.r * 0.7, H.c.y + ey, zf - 0.005), v3(s * H.rx * 1.0, H.c.y + ey, -H.rz * 0.3), H.r * 0.025, H.r * 0.025, mats.dark, 4, 'patilla'));
    }
    g.add(box(H.r * 0.2, H.r * 0.04, H.r * 0.04, v3(0, H.c.y + ey, zf), mats.dark, 'puente'));
    return g;
  }),

  pecas: mk('pecas', 'Pecas', (L) => {
    const H = L.head;
    const g = group('rasgo-pecas');
    const pts = [[0.45, -0.08], [0.55, -0.02], [0.35, -0.04], [0.5, -0.14], [0.28, -0.12], [0.42, -0.2]];
    for (const s of [-1, 1]) for (const [px, py] of pts) {
      const x = s * H.r * px, y = H.r * py;
      g.add(ellipsoid(v3(x, H.c.y + y, headZ(L, x, y) + 0.001), H.r * 0.035, H.r * 0.035, H.r * 0.02, mats.freckle, 4, 3, 'peca'));
    }
    return g;
  }),
};

export const options = { hair, eyes: eyeOptions, nose: noseOptions, facial };

export const category = {
  id: 'traits',
  label: 'Rasgos',
  groups: [
    { id: 'hair', label: 'Peinado', options: Object.values(hair) },
    { id: 'eyes', label: 'Ojos', options: Object.values(eyeOptions) },
    { id: 'nose', label: 'Nariz', options: Object.values(noseOptions) },
    { id: 'facial', label: 'Rasgo facial', options: Object.values(facial) },
  ],
};
