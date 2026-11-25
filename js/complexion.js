// Categoría COMPLEXIÓN: proporciones del cuerpo y malla base (piel).
// Cada opción define un `profile` (multiplicadores de proporciones) y un
// `build(L)` que devuelve el objeto 3D (THREE.Group) del cuerpo desnudo.
import * as THREE from 'three';
import { mats } from './materials.js';
import { between, ellipsoid, loft, mesh, box, group, headZ } from './common.js';

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

/** Cuerpo base low-poly: torso, cuello, cabeza, brazos, manos y piernas. */
function makeBody(L) {
  const g = new THREE.Group();
  g.name = 'cuerpo';
  const skin = mats.skin;
  const p = L.profile;

  // Pelvis y pecho
  g.add(loft(L.crotchY, L.waistY, [L.hipW, L.hipW * L.depth], [L.waistW, L.waistD], skin, 8, 'pelvis'));
  g.add(loft(L.waistY, L.chestY, [L.waistW, L.waistD], [L.shoulderW, L.shoulderW * L.depth], skin, 8, 'pecho'));
  if (p.bust > 0) {
    for (const side of [-1, 1]) g.add(ellipsoid(v3(side * L.shoulderW * 0.42, L.chestY - 0.15 * L.s, L.shoulderW * L.depth * 0.7), 0.04 * p.bust, 0.038 * p.bust, 0.04 * p.bust, skin, 7, 5, 'busto'));
  }

  // Cuello y cabeza
  const nr = 0.056 * p.neck * Math.max(0.9, L.limb);
  g.add(between(v3(0, L.chestY - 0.02 * L.s, 0), v3(0, L.neckTopY + 0.03 * L.s, 0.006), nr * 1.15, nr, skin, 7, 'cuello'));
  const H = L.head;
  g.add(ellipsoid(H.c, H.rx, H.ry, H.rz, skin, 10, 8, 'cabeza'));
  // Mandíbula suave
  g.add(ellipsoid(v3(0, H.c.y - H.ry * 0.38, H.rz * 0.1), H.rx * 0.78, H.ry * 0.5, H.rz * 0.78, skin, 8, 5, 'mandibula'));
  for (const side of [-1, 1]) {
    g.add(ellipsoid(v3(side * (H.rx * 0.97), H.c.y - H.ry * 0.02, -H.rz * 0.05), H.r * 0.12, H.r * 0.24, H.r * 0.16, skin, 5, 4, 'oreja'));
  }
  // Boca
  const my = -H.ry * 0.5;
  g.add(box(H.r * 0.42, H.r * 0.07, H.r * 0.06, v3(0, H.c.y + my, headZ(L, 0, my) - 0.002), mats.mouth, 'boca'));

  // Brazos
  for (const side of [-1, 1]) {
    const S = L.sides[side];
    g.add(ellipsoid(S.shoulder, L.armR[0] * 0.92, L.armR[0] * 0.92, L.armR[0] * 0.92, skin, 6, 4, 'hombro'));
    g.add(between(S.shoulder, S.elbow, L.armR[0], L.armR[1], skin, 6, 'brazo'));
    g.add(ellipsoid(S.elbow, L.armR[1] * 0.9, L.armR[1] * 0.9, L.armR[1] * 0.9, skin, 6, 4, 'codo'));
    g.add(between(S.elbow, S.wrist, L.armR[1], L.armR[2], skin, 6, 'antebrazo'));
    g.add(ellipsoid(S.hand, 0.034 * L.limb, 0.05 * L.s, 0.025 * L.limb, skin, 6, 5, 'mano'));
  }
  // Piernas
  for (const side of [-1, 1]) {
    const S = L.sides[side];
    g.add(ellipsoid(S.hip.clone().setY(S.hip.y - 0.02 * L.s), L.legR[0] * 0.85, L.legR[0] * 0.85, L.legR[0] * 0.85, skin, 6, 4, 'cadera'));
    g.add(between(S.hip, S.knee, L.legR[0], L.legR[1], skin, 7, 'muslo'));
    g.add(ellipsoid(S.knee, L.legR[1] * 0.9, L.legR[1] * 0.9, L.legR[1] * 0.9, skin, 6, 4, 'rodilla'));
    g.add(between(S.knee, S.ankle, L.legR[1], L.legR[2], skin, 7, 'pantorrilla'));
    g.add(ellipsoid(S.ankle, L.legR[2], 0.03 * L.s, L.legR[2] * 1.2, skin, 6, 4, 'tobillo'));
  }
  return g;
}

const def = (id, label, profile) => ({ id, label, profile, build: (L) => makeBody(L) });

export const options = {
  delgada:    def('delgada', 'Delgada', { height: 1.02, shoulder: 0.9, waist: 0.8, hip: 0.84, limb: 0.82, belly: 0, neck: 0.9, depth: 0.88 }),
  normal:     def('normal', 'Normal', { height: 1.0, shoulder: 1.0, waist: 1.0, hip: 1.0, limb: 1.0, belly: 0, neck: 1.0, depth: 1.0 }),
  atletica:   def('atletica', 'Atlética', { height: 1.03, shoulder: 1.16, waist: 0.92, hip: 0.98, limb: 1.2, belly: 0, neck: 1.2, depth: 1.05 }),
  robusta:    def('robusta', 'Robusta', { height: 0.98, shoulder: 1.1, waist: 1.3, hip: 1.18, limb: 1.2, belly: 0.5, neck: 1.2, depth: 1.18 }),
  corpulenta: def('corpulenta', 'Corpulenta', { height: 0.96, shoulder: 1.18, waist: 1.55, hip: 1.38, limb: 1.4, belly: 1.0, neck: 1.35, depth: 1.32 }),
};

export const category = {
  id: 'complexion',
  label: 'Complexión',
  groups: [{ id: 'complexion', label: 'Complexión', options: Object.values(options) }],
};
