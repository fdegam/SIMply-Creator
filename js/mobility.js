// Categoría MOVILIDAD: movilidad reducida con silla de ruedas, muletas o silla
// motorizada. Cada opción define la pose del cuerpo (`pose`) y el objeto 3D de la ayuda.
import * as THREE from 'three';
import { mats } from './materials.js';
import { mesh, box, between, group } from './common.js';

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

/** Rueda vertical (eje X): llanta, buje y radios. */
function wheel(x, y, z, r, { tube = 0.014, spokes = 8, rim = true } = {}) {
  const g = new THREE.Group();
  const t = mesh(new THREE.TorusGeometry(r, tube, 5, 18), mats.dark, 'neumatico');
  t.rotation.y = Math.PI / 2;
  g.add(t);
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 8), mats.metal, 'buje').rotateZ(Math.PI / 2));
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    g.add(between(v3(0, 0, 0), v3(0, Math.sin(a) * r, Math.cos(a) * r), 0.004, 0.004, mats.metal, 3, 'radio'));
  }
  if (rim) {
    const hr = mesh(new THREE.TorusGeometry(r * 0.86, 0.007, 4, 18), mats.metal, 'aro-propulsor');
    hr.rotation.y = Math.PI / 2;
    hr.position.x = Math.sign(x) * 0.035;
    g.add(hr);
  }
  g.position.set(x, y, z);
  return g;
}

function wheelchair(L) {
  const s = L.s;
  const seatTop = L.crotchY - 0.015;
  const hw = Math.max(0.2, L.hipW + 0.05);
  const foot = L.sides[1].ankle;
  const g = group('silla-de-ruedas');
  for (const side of [-1, 1]) {
    const x = side * (hw + 0.045);
    g.add(wheel(x, 0.3, -0.07, 0.3));
    // Ruedas pivotantes delanteras con horquilla
    const cx = side * (hw - 0.02), cz = foot.z - 0.08;
    g.add(wheel(cx, 0.075, cz, 0.075, { tube: 0.012, spokes: 4, rim: false }));
    g.add(between(v3(cx, 0.075, cz), v3(cx, seatTop - 0.06, cz - 0.02), 0.008, 0.008, mats.metal, 4, 'horquilla'));
    // Bastidor: asiento -> reposapiés, asiento -> respaldo, reposabrazos
    g.add(between(v3(side * hw, seatTop - 0.02, -0.2), v3(side * hw, seatTop - 0.02, 0.3 * s), 0.011, 0.011, mats.metal, 5, 'larguero'));
    g.add(between(v3(side * hw, seatTop - 0.02, 0.3 * s), v3(side * (hw - 0.02), 0.11 * s, foot.z + 0.04), 0.011, 0.011, mats.metal, 5, 'reposapiernas'));
    g.add(between(v3(side * hw, seatTop - 0.02, -0.15), v3(side * hw, seatTop + 0.42, -0.17), 0.011, 0.011, mats.metal, 5, 'montante'));
    g.add(between(v3(side * hw, seatTop + 0.42, -0.17), v3(side * hw, seatTop + 0.44, -0.3), 0.011, 0.011, mats.metal, 5, 'empuñadura'));
    g.add(box(0.04, 0.025, 0.28, v3(side * (hw + 0.005), seatTop + 0.2, -0.02), mats.dark, 'reposabrazos'));
    g.add(between(v3(side * (hw + 0.005), seatTop + 0.19, -0.1), v3(side * hw, seatTop - 0.02, -0.1), 0.008, 0.008, mats.metal, 4, 'soporte-brazo'));
  }
  g.add(box(2 * hw, 0.03, 0.5, v3(0, seatTop - 0.015, 0.03), mats.dark, 'asiento'));
  g.add(box(2 * hw, 0.38, 0.03, v3(0, seatTop + 0.21, -0.15), mats.dark, 'respaldo'));
  g.add(box(2 * hw - 0.04, 0.012, 0.22, v3(0, 0.08 * s - 0.006, foot.z + 0.04), mats.metal, 'reposapies'));
  g.add(between(v3(-hw, 0.3, -0.07), v3(hw, 0.3, -0.07), 0.008, 0.008, mats.metal, 4, 'eje'));
  return g;
}

function powerChair(L) {
  const s = L.s;
  const seatTop = L.crotchY - 0.015;
  const hw = Math.max(0.21, L.hipW + 0.06);
  const foot = L.sides[1].ankle;
  const g = group('silla-motorizada');
  // Base / carcasa de baterías
  g.add(box(2 * hw + 0.02, 0.2, 0.5, v3(0, 0.27, 0.0), mats.accent, 'carcasa'));
  g.add(box(2 * hw - 0.06, 0.06, 0.44, v3(0, 0.4, 0.0), mats.dark, 'base-asiento'));
  for (const side of [-1, 1]) {
    const wx = side * (hw + 0.05);
    const w = mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.07, 14), mats.dark, 'rueda-motriz');
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.18, 0.02); g.add(w);
    const hub = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.075, 10), mats.metal, 'llanta');
    hub.rotation.z = Math.PI / 2; hub.position.copy(w.position); g.add(hub);
    const c = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 10), mats.dark, 'rueda-pivotante');
    c.rotation.z = Math.PI / 2; c.position.set(side * (hw - 0.06), 0.075, foot.z - 0.12); g.add(c);
    g.add(between(v3(side * (hw - 0.06), 0.075, foot.z - 0.12), v3(side * (hw - 0.06), 0.3, foot.z - 0.3), 0.01, 0.01, mats.metal, 4, 'soporte-rueda'));
    // Reposabrazos
    g.add(box(0.06, 0.035, 0.34, v3(side * (hw + 0.005), seatTop + 0.2, 0.02), mats.dark, 'reposabrazos'));
    g.add(between(v3(side * (hw + 0.005), seatTop + 0.2, -0.1), v3(side * (hw + 0.005), 0.42, -0.1), 0.012, 0.012, mats.metal, 4, 'soporte-brazo'));
    // Reposapiés
    g.add(between(v3(side * (hw - 0.03), seatTop - 0.04, 0.3 * s), v3(side * (hw - 0.03), 0.09 * s, foot.z + 0.05), 0.012, 0.012, mats.metal, 5, 'reposapiernas'));
  }
  g.add(box(2 * hw - 0.04, 0.09, 0.46, v3(0, seatTop - 0.045, 0.02), mats.dark, 'cojin'));
  g.add(box(2 * hw - 0.04, 0.5, 0.07, v3(0, seatTop + 0.27, -0.17), mats.dark, 'respaldo'));
  g.add(box(0.24, 0.14, 0.08, v3(0, seatTop + 0.58, -0.18), mats.dark, 'reposacabezas'));
  g.add(box(2 * hw - 0.04, 0.02, 0.2, v3(0, 0.08 * s - 0.01, foot.z + 0.04), mats.metal, 'reposapies'));
  // Joystick en el reposabrazos derecho
  const jx = hw + 0.005;
  g.add(box(0.07, 0.05, 0.1, v3(jx, seatTop + 0.235, 0.2), mats.dark, 'mando'));
  g.add(between(v3(jx, seatTop + 0.26, 0.2), v3(jx, seatTop + 0.33, 0.2), 0.008, 0.008, mats.metal, 5, 'joystick'));
  g.add(mesh(new THREE.SphereGeometry(0.018, 6, 4), mats.accent, 'bola').translateX(jx).translateY(seatTop + 0.34).translateZ(0.2));
  return g;
}

function crutches(L) {
  const g = group('muletas');
  for (const side of [-1, 1]) {
    const S = L.sides[side];
    const out = side * 0.045;
    const ground = v3(S.hand.x + out, 0, S.hand.z + 0.05);
    const top = v3(S.elbow.x + out * 0.6, S.elbow.y + 0.05 * L.s, S.elbow.z - 0.03);
    g.add(between(ground, top, 0.011, 0.011, mats.metal, 6, 'tubo'));
    g.add(between(ground, ground.clone().add(v3(0, 0.05, 0)), 0.018, 0.014, mats.dark, 5, 'contera'));
    // Empuñadura horizontal en la mano
    g.add(between(v3(S.hand.x - out * 0.3, S.hand.y + 0.01, S.hand.z), v3(S.hand.x + out * 1.1, S.hand.y + 0.01, S.hand.z), 0.014, 0.014, mats.dark, 6, 'empunadura'));
    // Abrazadera en el antebrazo
    const cuff = mesh(new THREE.TorusGeometry(L.armR[1] + 0.012, 0.009, 4, 10), mats.metal, 'abrazadera');
    const cp = S.elbow.clone().lerp(S.wrist, 0.28);
    cuff.position.copy(cp);
    cuff.quaternion.setFromUnitVectors(v3(0, 0, 1), S.wrist.clone().sub(S.elbow).normalize());
    g.add(cuff);
  }
  return g;
}

export const options = {
  ninguna:    { id: 'ninguna', label: 'Sin ayuda', pose: 'stand', build: () => group('movilidad-ninguna') },
  silla:      { id: 'silla', label: 'Silla de ruedas', pose: 'sit', build: wheelchair },
  motorizada: { id: 'motorizada', label: 'Silla motorizada', pose: 'sit', build: powerChair },
  muletas:    { id: 'muletas', label: 'Muletas', pose: 'crutch', build: crutches },
};

export const category = {
  id: 'mobility',
  label: 'Movilidad',
  groups: [{ id: 'mobility', label: 'Movilidad reducida', options: Object.values(options) }],
};
