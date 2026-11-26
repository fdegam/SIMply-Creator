// Helpers comunes: construcción de piezas low-poly y cálculo del "layout"
// (posiciones de articulaciones) a partir del perfil de proporciones.
import * as THREE from 'three';
import { mats, MATERIAL_LAYER } from './materials.js';

const Y = new THREE.Vector3(0, 1, 0);
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

/** Crea un mesh con su capa de exportación. */
export function mesh(geo, mat, name = '') {
  const m = new THREE.Mesh(geo, mat);
  m.name = name;
  const key = Object.keys(mats).find((k) => mats[k] === mat);
  m.userData.layer = MATERIAL_LAYER[key] || 'DETALLE';
  return m;
}

/** Cilindro cónico entre dos puntos (r1 en `a`, r2 en `b`). */
export function between(a, b, r1, r2, mat, seg = 6, name = '') {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const m = mesh(new THREE.CylinderGeometry(r2, r1, len, seg, 1), mat, name);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(Y, dir.normalize());
  return m;
}

/** Elipsoide low-poly. */
export function ellipsoid(c, rx, ry, rz, mat, ws = 8, hs = 6, name = '') {
  const m = mesh(new THREE.SphereGeometry(1, ws, hs), mat, name);
  m.scale.set(rx, ry, rz);
  m.position.copy(c);
  return m;
}

/** Sección de torso: de y0 a y1, radios elípticos distintos arriba y abajo. */
export function loft(y0, y1, [rx0, rz0], [rx1, rz1], mat, seg = 8, name = '') {
  const geo = new THREE.CylinderGeometry(1, 1, y1 - y0, seg, 1);
  const k = 1 / Math.cos(Math.PI / seg); // las caras planas quedan en el radio nominal
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const top = p.getY(i) > 0;
    p.setX(i, p.getX(i) * (top ? rx1 : rx0) * k);
    p.setZ(i, p.getZ(i) * (top ? rz1 : rz0) * k);
  }
  geo.rotateY(Math.PI / seg); // una cara plana mira al frente
  geo.translate(0, (y0 + y1) / 2, 0);
  geo.computeVertexNormals();
  return mesh(geo, mat, name);
}

export function box(w, h, d, pos, mat, name = '') {
  const m = mesh(new THREE.BoxGeometry(w, h, d), mat, name);
  m.position.copy(pos);
  return m;
}

export function group(name, ...children) {
  const g = new THREE.Group();
  g.name = name;
  children.flat().filter(Boolean).forEach((c) => g.add(c));
  return g;
}

export const BASE = { height: 1, shoulder: 1, waist: 1, hip: 1, limb: 1, belly: 0, neck: 1, bust: 0, depth: 1, head: 1.25 };

export function lerpProfile(a, b, t) {
  const out = {};
  for (const k of Object.keys(BASE)) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
}

/** Combina el perfil de complexión con los modificadores de género. */
export function resolveProfile(complexionProfile, genderMods = {}) {
  const p = { ...BASE, ...complexionProfile };
  for (const [k, v] of Object.entries(genderMods)) {
    if (k === 'bust' || k === 'belly') p[k] += v;
    else p[k] *= v;
  }
  return p;
}

/**
 * Posiciones clave del cuerpo en metros. +Y arriba, +Z frente, personaje centrado en X.
 * Todas las categorías (cabeza, ropa, accesorios) se anclan a este layout.
 */
export function layout(profile, pose = 'stand') {
  const s = profile.height;
  const shoulderW = 0.185 * profile.shoulder;
  const waistW = 0.125 * profile.waist;
  const hipW = 0.15 * profile.hip;
  const depth = 0.62 * profile.depth;
  const limb = profile.limb;
  const waistD = waistW * depth * (1 + 0.4 * profile.belly); // la barriga profundiza la cintura
  const sit = pose === 'sit';
  const drop = sit ? 0.32 * s : 0; // sentado: todo el tronco baja hasta la altura del asiento

  const L = {
    s, profile, limb, pose,
    shoulderW, waistW, hipW, depth, waistD,
    ankleY: 0.08 * s,
    kneeY: 0.46 * s,
    crotchY: 0.82 * s - drop,
    waistY: 1.06 * s - drop,
    chestY: 1.43 * s - drop,
    neckTopY: 1.5 * s - drop,
    head: { r: 0.105 * s * profile.head, c: v3(0, 1.5 * s - drop + 0.095 * s * profile.head, 0) },
    sides: {},
  };
  L.head.rx = L.head.r * 0.88; L.head.ry = L.head.r * 1.05; L.head.rz = L.head.r * 0.95;
  L.topY = L.head.c.y + L.head.ry;
  const up = 0.28 * s, fo = 0.25 * s;

  for (const side of [-1, 1]) {
    const shoulder = v3(side * (shoulderW + 0.012), L.chestY - 0.05 * s, 0);
    let elbow, wrist, hand;
    if (pose === 'stand') {
      // Brazo en A suave
      const a1 = THREE.MathUtils.degToRad(9), a2 = THREE.MathUtils.degToRad(5);
      elbow = shoulder.clone().add(v3(side * Math.sin(a1) * up, -Math.cos(a1) * up, 0));
      wrist = elbow.clone().add(v3(side * Math.sin(a2) * fo, -Math.cos(a2) * fo, 0.015 * s));
      hand = wrist.clone().add(v3(side * 0.004, -0.06 * s, 0.01));
    } else {
      // Antebrazos hacia delante (manos sobre los aros / agarrando las muletas)
      const d1 = sit ? v3(side * 0.14, -0.95, 0.1) : v3(side * 0.12, -0.97, 0.12);
      const d2 = sit ? v3(side * 0.05, -0.28, 0.96) : v3(side * 0.04, -0.82, 0.57);
      elbow = shoulder.clone().add(d1.normalize().multiplyScalar(up));
      wrist = elbow.clone().add(d2.normalize().multiplyScalar(fo));
      hand = wrist.clone().add(v3(0, sit ? -0.02 : -0.05, sit ? 0.05 : 0.03).multiplyScalar(s));
    }
    const hip = v3(side * hipW * 0.5, L.crotchY + 0.06 * s, 0);
    const knee = sit ? v3(side * hipW * 0.46, hip.y - 0.03 * s, 0.42 * s) : v3(side * hipW * 0.46, L.kneeY, 0.008);
    const ankle = sit ? v3(side * hipW * 0.42, 0.16 * s, knee.z + 0.07 * s) : v3(side * hipW * 0.42, L.ankleY, 0);
    L.sides[side] = { shoulder, elbow, wrist, hand, hip, knee, ankle };
  }
  if (sit) L.kneeY = L.sides[1].knee.y;
  L.armR = [0.043 * limb, 0.035 * limb, 0.028 * limb]; // hombro, codo, muñeca
  L.legR = [0.078 * limb, 0.052 * limb, 0.036 * limb]; // cadera, rodilla, tobillo
  return L;
}

/** z del cráneo (elipsoide) en una posición x,y relativa al centro de la cabeza. */
export function headZ(L, x, y) {
  const { rx, ry, rz } = L.head;
  const t = 1 - (x / rx) ** 2 - (y / ry) ** 2;
  return rz * Math.sqrt(Math.max(0, t));
}

/** Marca las mallas de una prenda con su margen exterior (afecta solo al orden de dibujado del SVG). */
export function withBias(g, bias) {
  g.traverse((o) => { if (o.isMesh) o.userData.bias = bias; });
  return g;
}

/** Prenda de torso: sigue la silueta del cuerpo con un pequeño margen. */
export function torsoGarment(L, mat, { hemY, sleeves = 'short', grow = 0.014, collar = true } = {}) {
  const g = new THREE.Group();
  const gr = grow;
  const hem = hemY ?? L.waistY - 0.1 * L.s;
  const chestTop = L.chestY + 0.004;
  g.add(loft(L.waistY, chestTop, [L.waistW + gr, L.waistD + gr], [L.shoulderW + gr, L.shoulderW * L.depth + gr], mat, 8, 'torso-prenda'));
  if (hem < L.waistY) {
    // Tramo de cadera (sigue la silueta real) y, si baja más, un vuelo hacia el bajo
    const yHip = Math.max(hem, L.crotchY);
    const t = (L.waistY - yHip) / (L.waistY - L.crotchY);
    const rxH = L.waistW + (L.hipW - L.waistW) * t;
    g.add(loft(yHip, L.waistY, [rxH + gr, rxH * L.depth + gr], [L.waistW + gr, L.waistD + gr], mat, 8, 'falda-prenda'));
    if (hem < L.crotchY) {
      const flare = 1 + 0.5 * Math.min(1, (L.crotchY - hem) / (0.3 * L.s));
      g.add(loft(hem, L.crotchY, [L.hipW * flare + gr, L.hipW * flare * L.depth + gr], [L.hipW + gr, L.hipW * L.depth + gr], mat, 8, 'vuelo-prenda'));
    }
  }
  if (L.profile.bust > 0) {
    for (const side of [-1, 1]) g.add(ellipsoid(v3(side * L.shoulderW * 0.42, L.chestY - 0.15 * L.s, L.shoulderW * L.depth * 0.62), 0.04 * L.profile.bust + gr * 0.6, 0.038 * L.profile.bust + gr * 0.6, 0.04 * L.profile.bust + gr * 0.6, mat, 7, 5, 'pecho-prenda'));
  }
  if (sleeves !== 'none') {
    const long = sleeves === 'long';
    for (const side of [-1, 1]) {
      const S = L.sides[side];
      g.add(ellipsoid(S.shoulder, (L.armR[0] + gr) * 0.93, (L.armR[0] + gr) * 0.93, (L.armR[0] + gr) * 0.93, mat, 6, 4, 'hombro-prenda'));
      const end = long ? S.wrist.clone().lerp(S.elbow, 0.12) : S.shoulder.clone().lerp(S.elbow, 0.62);
      const rEnd = long ? L.armR[2] + gr * 1.3 : L.armR[0] + (L.armR[1] - L.armR[0]) * 0.62 + gr;
      if (long) {
        g.add(between(S.shoulder, S.elbow, L.armR[0] + gr, L.armR[1] + gr, mat, 6, 'manga-sup'));
        g.add(between(S.elbow, end, L.armR[1] + gr, rEnd, mat, 6, 'manga-inf'));
      } else {
        g.add(between(S.shoulder, end, L.armR[0] + gr, rEnd, mat, 6, 'manga'));
      }
    }
  }
  if (collar) {
    const c = mesh(new THREE.CylinderGeometry(0.052 * L.profile.neck + 0.01, 0.062 * L.profile.neck + 0.014, 0.03 * L.s, 8, 1, true), mat, 'cuello-prenda');
    c.position.set(0, L.chestY + 0.012 * L.s, 0);
    c.material = mat;
    g.add(c);
  }
  return withBias(g, gr);
}

/** Pantalón o pantalón corto. */
export function legGarment(L, mat, { shorts = false, grow = 0.012 } = {}) {
  const g = new THREE.Group();
  const gr = grow;
  const hipRx = L.hipW + gr, waistRx = L.waistW + gr;
  g.add(loft(L.crotchY - 0.01 * L.s, L.waistY + 0.012 * L.s, [hipRx, hipRx * L.depth + gr * 0.5], [waistRx, L.waistD + gr], mat, 8, 'cadera-prenda'));
  for (const side of [-1, 1]) {
    const S = L.sides[side];
    g.add(ellipsoid(S.hip.clone().setY(S.hip.y - 0.03 * L.s), (L.legR[0] + gr) * 0.88, (L.legR[0] + gr) * 0.88, (L.legR[0] + gr) * 0.88, mat, 6, 4, 'ingle-prenda'));
    if (shorts) {
      const end = S.hip.clone().lerp(S.knee, 0.55);
      g.add(between(S.hip, end, L.legR[0] + gr, L.legR[0] + (L.legR[1] - L.legR[0]) * 0.55 + gr, mat, 7, 'pernera'));
    } else {
      g.add(between(S.hip, S.knee, L.legR[0] + gr, L.legR[1] + gr, mat, 7, 'pernera-sup'));
      g.add(ellipsoid(S.knee, (L.legR[1] + gr) * 0.9, (L.legR[1] + gr) * 0.9, (L.legR[1] + gr) * 0.9, mat, 6, 4, 'rodilla-prenda'));
      const a = S.ankle.clone(); a.y += 0.035 * L.s;
      g.add(between(S.knee, a, L.legR[1] + gr, L.legR[2] + gr * 1.4, mat, 7, 'pernera-inf'));
    }
  }
  return withBias(g, gr);
}

/** Calzado simple. */
export function shoes(L, mat = mats.shoes) {
  const g = new THREE.Group();
  for (const side of [-1, 1]) {
    const S = L.sides[side];
    const w = 0.085 * L.limb, len = 0.23 * L.s, h = 0.075 * L.s;
    const gy = S.ankle.y - 0.08 * L.s; // suela
    const m = box(w, h, len, v3(S.ankle.x, gy + h / 2, S.ankle.z + 0.045 * L.s), mat, 'zapato');
    g.add(m);
    g.add(box(w * 0.92, h * 0.55, len * 0.45, v3(S.ankle.x, gy + h * 0.7, S.ankle.z + 0.1 * L.s), mat, 'puntera'));
  }
  return g;
}
