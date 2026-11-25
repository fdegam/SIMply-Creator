// Categoría GÉNERO: modifica las proporciones (mods) y añade rasgos asociados
// (cejas, pestañas, nuez, labios...). `mods` se multiplica sobre el perfil de
// complexión; `bust` y `belly` se suman.
import * as THREE from 'three';
import { mats } from './materials.js';
import { box, ellipsoid, group, headZ, between } from './common.js';

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

function brows(L, { thick, arch, gap }) {
  const g = new THREE.Group();
  const H = L.head;
  const y = H.r * 0.3;
  for (const side of [-1, 1]) {
    const x = side * H.r * gap;
    const m = box(H.r * 0.4, H.r * thick, H.r * 0.07, v3(x, H.c.y + y + (arch ? H.r * 0.02 : 0), headZ(L, x, y) - 0.001), mats.hair, 'ceja');
    m.rotation.z = side * -arch;
    g.add(m);
  }
  return g;
}

function lashes(L) {
  const g = new THREE.Group();
  const H = L.head;
  for (const side of [-1, 1]) {
    const x = side * H.r * 0.4, y = H.r * 0.12;
    const m = box(H.r * 0.3, H.r * 0.035, H.r * 0.05, v3(x, H.c.y + y, headZ(L, x, y) + 0.003), mats.dark, 'pestana');
    m.rotation.z = side * -0.15;
    g.add(m);
  }
  return g;
}

export const options = {
  masculino: {
    id: 'masculino', label: 'Masculino',
    mods: { shoulder: 1.08, waist: 1.02, hip: 0.95, neck: 1.1, bust: 0, height: 1.02, head: 1.0 },
    build: (L) => group('genero-masculino',
      brows(L, { thick: 0.1, arch: 0.05, gap: 0.4 }),
      ellipsoid(v3(0, L.neckTopY - 0.005 * L.s, L.head.rz * 0.35 + 0.005), 0.014, 0.016, 0.014, mats.skin, 5, 4, 'nuez')),
  },
  femenino: {
    id: 'femenino', label: 'Femenino',
    mods: { shoulder: 0.9, waist: 0.84, hip: 1.1, neck: 0.9, bust: 1, height: 0.98, head: 0.96, limb: 0.92 },
    build: (L) => group('genero-femenino',
      brows(L, { thick: 0.06, arch: 0.18, gap: 0.4 }),
      lashes(L)),
  },
  neutro: {
    id: 'neutro', label: 'Neutro',
    mods: {},
    build: (L) => group('genero-neutro', brows(L, { thick: 0.08, arch: 0.02, gap: 0.4 })),
  },
};

export const category = {
  id: 'gender',
  label: 'Género',
  groups: [{ id: 'gender', label: 'Género', options: Object.values(options) }],
};
