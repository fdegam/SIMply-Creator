// Categoría PROFESIÓN: vestuario y accesorios low-poly. Cada opción define los
// colores por defecto (`defaults`) y un `build(L)` que devuelve el atuendo completo
// (prendas, calzado, sombrero y herramienta).
import * as THREE from 'three';
import { mats } from './materials.js';
import { mesh, box, ellipsoid, between, group, loft, withBias, torsoGarment, legGarment, shoes } from './common.js';

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

/* ---------- Piezas reutilizables ---------- */

function dome(L, mat, { grow = 1.12, lift = 0.12, cover = 0.5, name = 'cupula' } = {}) {
  const H = L.head;
  const m = mesh(new THREE.SphereGeometry(1, 10, 8, 0, Math.PI * 2, 0, Math.PI * cover), mat, name);
  m.scale.set(H.rx * grow, H.ry * grow, H.rz * grow);
  m.position.set(0, H.c.y + H.ry * lift, 0);
  return m;
}

function brim(L, mat, { r = 1.3, y = 0.18, h = 0.012, name = 'ala' } = {}) {
  const H = L.head;
  const m = mesh(new THREE.CylinderGeometry(H.rx * r, H.rx * r, h, 12), mat, name);
  m.scale.z = H.rz / H.rx;
  m.position.set(0, H.c.y + H.ry * y, 0);
  return m;
}

function hardHat(L, mat) {
  const H = L.head;
  const visor = box(H.rx * 1.7, 0.012, H.rz * 0.7, v3(0, H.c.y + H.ry * 0.2, H.rz * 1.05), mat, 'visera');
  const ridge = box(H.rx * 0.18, H.ry * 0.12, H.rz * 2.0, v3(0, H.c.y + H.ry * 1.16, 0), mat, 'cresta-casco');
  return group('casco', dome(L, mat, { grow: 1.22, lift: 0.2 }), brim(L, mat, { r: 1.22, y: 0.2 }), visor, ridge);
}

function fireHelmet(L, mat) {
  const H = L.head;
  const back = box(H.rx * 2.1, 0.012, H.rz * 0.9, v3(0, H.c.y + H.ry * 0.12, -H.rz * 0.95), mat, 'cubrenuca');
  back.rotation.x = 0.45;
  const visor = box(H.rx * 1.6, 0.012, H.rz * 0.5, v3(0, H.c.y + H.ry * 0.28, H.rz * 1.0), mat, 'visera');
  visor.rotation.x = -0.15;
  const badge = box(H.rx * 0.5, H.ry * 0.35, 0.01, v3(0, H.c.y + H.ry * 0.62, H.rz * 1.1), mats.metal, 'escudo');
  badge.rotation.x = -0.25;
  return group('casco-bombero', dome(L, mat, { grow: 1.22, lift: 0.22, cover: 0.52 }), brim(L, mat, { r: 1.22, y: 0.22 }), back, visor, badge);
}

function chefHat(L, mat) {
  const H = L.head;
  const h = 0.16 * L.s;
  const band = mesh(new THREE.CylinderGeometry(H.rx * 1.02, H.rx * 1.05, h * 0.6, 10), mat, 'gorro-base');
  band.scale.z = H.rz / H.rx;
  band.position.set(0, H.c.y + H.ry * 0.55 + h * 0.3, 0);
  const puff = ellipsoid(v3(0, H.c.y + H.ry * 0.55 + h * 0.8, 0), H.rx * 1.3, h * 0.55, H.rz * 1.3, mat, 9, 6, 'gorro-copa');
  return group('gorro-chef', band, puff);
}

function beret(L, mat) {
  const H = L.head;
  const m = ellipsoid(v3(H.rx * 0.2, H.c.y + H.ry * 0.78, -H.rz * 0.05), H.rx * 1.3, H.ry * 0.28, H.rz * 1.25, mat, 10, 5, 'boina');
  m.rotation.z = -0.22;
  const tip = box(0.012, 0.02, 0.012, v3(H.rx * 0.2, H.c.y + H.ry * 1.05, -H.rz * 0.05), mat, 'rabito');
  return group('boina', m, tip);
}

function stripe(L, y, mat, h = 0.025) {
  const t = (y - L.crotchY) / (L.waistY - L.crotchY);
  const t2 = (y - L.waistY) / (L.chestY - L.waistY);
  const rx = y < L.waistY ? L.hipW + (L.waistW - L.hipW) * t : L.waistW + (L.shoulderW - L.waistW) * t2;
  return withBias(loft(y - h / 2, y + h / 2, [rx + 0.034, rx * L.depth + 0.034 + L.waistD - L.waistW * L.depth], [rx + 0.034, rx * L.depth + 0.034 + L.waistD - L.waistW * L.depth], mat, 8, 'franja'), 0.04);
}

/** Bloque base común: pantalón, calzado y camiseta. */
function base(L, { top = 'short', shorts = false, hem } = {}) {
  return [
    legGarment(L, mats.pants, { shorts }),
    shoes(L),
    torsoGarment(L, mats.outfit, { sleeves: top, hemY: hem }),
  ];
}

const rightHand = (L) => L.sides[1].hand;
const leftHand = (L) => L.sides[-1].hand;

/* ---------- Opciones ---------- */

export const options = {
  ninguna: {
    id: 'ninguna', label: 'Casual',
    defaults: { outfit: '#4f7cac', accent: '#f2b134', pants: '#3a4560' },
    build: (L) => group('ropa-casual', base(L, { top: 'short' })),
  },

  arquitecto: {
    id: 'arquitecto', label: 'Arquitecto',
    defaults: { outfit: '#d8d3c8', accent: '#f2b134', pants: '#6b5a43' },
    build: (L) => {
      const H = rightHand(L);
      const roll = mesh(new THREE.CylinderGeometry(0.03 * L.limb, 0.03 * L.limb, 0.38 * L.s, 8), mats.white, 'planos');
      roll.rotation.x = Math.PI / 2;
      roll.position.set(H.x, H.y + 0.01, H.z + 0.12 * L.s);
      const band = mesh(new THREE.CylinderGeometry(0.033 * L.limb, 0.033 * L.limb, 0.03, 8), mats.accent, 'cinta-planos');
      band.rotation.x = Math.PI / 2;
      band.position.copy(roll.position);
      band.position.z += 0.1;
      const vest = torsoGarment(L, mats.accent, { sleeves: 'none', hemY: L.waistY - 0.04 * L.s, grow: 0.026, collar: false });
      return group('ropa-arquitecto',
        legGarment(L, mats.pants), shoes(L),
        torsoGarment(L, mats.outfit, { sleeves: 'long' }),
        vest, stripe(L, L.waistY + 0.12 * L.s, mats.white), hardHat(L, mats.accent), roll, band);
    },
  },

  chef: {
    id: 'chef', label: 'Chef',
    defaults: { outfit: '#f4f4f1', accent: '#e5533d', pants: '#2b2b30' },
    build: (L) => {
      const neck = mesh(new THREE.TorusGeometry(0.065 * L.profile.neck, 0.012, 4, 8), mats.accent, 'panuelo');
      neck.rotation.x = Math.PI / 2;
      neck.position.set(0, L.chestY + 0.012 * L.s, 0.004);
      const buttons = [0, 1, 2].map((i) => ellipsoid(v3(0.018 * (i % 2 ? 1 : -1), L.chestY - 0.07 * L.s - i * 0.07 * L.s, L.shoulderW * L.depth * 0.9 + 0.018), 0.008, 0.008, 0.006, mats.dark, 4, 3, 'boton'));
      return group('ropa-chef',
        legGarment(L, mats.pants), shoes(L),
        torsoGarment(L, mats.outfit, { sleeves: 'long', hemY: L.waistY - 0.12 * L.s, grow: 0.02 }),
        neck, buttons, chefHat(L, mats.outfit));
    },
  },

  medico: {
    id: 'medico', label: 'Médico',
    defaults: { outfit: '#f4f4f1', accent: '#1fa39a', pants: '#1fa39a' },
    build: (L) => {
      const ring = mesh(new THREE.TorusGeometry(0.09 * L.profile.neck, 0.008, 4, 10), mats.dark, 'estetoscopio');
      ring.rotation.x = Math.PI / 2 - 0.35;
      ring.position.set(0, L.chestY - 0.02 * L.s, 0.03);
      const piece = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.012, 8), mats.metal, 'campana');
      piece.rotation.x = Math.PI / 2;
      piece.position.set(L.shoulderW * 0.35, L.chestY - 0.17 * L.s, L.shoulderW * L.depth * 0.95 + 0.03);
      const hose = between(v3(0.07, L.chestY - 0.04 * L.s, L.shoulderW * L.depth * 0.9 + 0.03), piece.position, 0.006, 0.006, mats.dark, 4, 'tubo');
      return group('ropa-medico',
        legGarment(L, mats.pants), shoes(L),
        torsoGarment(L, mats.accent, { sleeves: 'short', grow: 0.008 }),
        torsoGarment(L, mats.outfit, { sleeves: 'long', hemY: L.kneeY + 0.12 * L.s, grow: 0.024, collar: true }),
        ring, hose, piece);
    },
  },

  bombero: {
    id: 'bombero', label: 'Bombero',
    defaults: { outfit: '#e0a93b', accent: '#c0463a', pants: '#2b2b30' },
    build: (L) => group('ropa-bombero',
      legGarment(L, mats.pants, { grow: 0.016 }), shoes(L),
      torsoGarment(L, mats.outfit, { sleeves: 'long', hemY: L.crotchY - 0.02 * L.s, grow: 0.026 }),
      stripe(L, L.waistY + 0.08 * L.s, mats.metal, 0.03),
      stripe(L, L.waistY - 0.12 * L.s, mats.metal, 0.03),
      fireHelmet(L, mats.accent)),
  },

  artista: {
    id: 'artista', label: 'Artista',
    defaults: { outfit: '#2f3b52', accent: '#e5533d', pants: '#6b5a43' },
    build: (L) => {
      const LH = leftHand(L), RH = rightHand(L);
      const pal = ellipsoid(v3(LH.x - 0.02, LH.y + 0.02, LH.z + 0.1 * L.s), 0.1 * L.s, 0.01, 0.07 * L.s, mats.wood, 8, 3, 'paleta');
      pal.rotation.z = 0.25;
      const dots = [mats.accent, mats.white, mats.eyes, mats.outfit].map((m, i) => ellipsoid(v3(LH.x - 0.02 + (i - 1.5) * 0.04, LH.y + 0.034, LH.z + 0.1 * L.s + (i % 2 ? 0.02 : -0.02)), 0.014, 0.01, 0.014, m, 5, 3, 'pintura'));
      const brush = between(v3(RH.x, RH.y - 0.02, RH.z + 0.01), v3(RH.x + 0.04, RH.y + 0.15 * L.s, RH.z + 0.1 * L.s), 0.008, 0.008, mats.wood, 4, 'pincel');
      const tip = between(v3(RH.x + 0.04, RH.y + 0.15 * L.s, RH.z + 0.1 * L.s), v3(RH.x + 0.052, RH.y + 0.19 * L.s, RH.z + 0.125 * L.s), 0.012, 0.002, mats.accent, 4, 'pincel-punta');
      return group('ropa-artista',
        legGarment(L, mats.pants), shoes(L),
        torsoGarment(L, mats.outfit, { sleeves: 'long', hemY: L.waistY - 0.14 * L.s, grow: 0.02 }),
        beret(L, mats.accent), pal, dots, brush, tip);
    },
  },

  astronauta: {
    id: 'astronauta', label: 'Astronauta',
    defaults: { outfit: '#f4f4f1', accent: '#2f6fb3', pants: '#e6e6e0' },
    build: (L) => {
      const H = L.head;
      const helmet = mesh(new THREE.SphereGeometry(H.r * 1.5, 12, 9), mats.glass, 'casco-cristal');
      helmet.position.copy(H.c).add(v3(0, 0.005, 0.005));
      const ring = mesh(new THREE.TorusGeometry(H.r * 1.1, H.r * 0.16, 5, 12), mats.metal, 'aro-casco');
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, L.neckTopY - 0.01 * L.s, 0);
      const pack = box(L.shoulderW * 1.5, 0.3 * L.s, 0.12 * L.s, v3(0, L.chestY - 0.17 * L.s, -L.shoulderW * L.depth - 0.08 * L.s), mats.metal, 'mochila');
      const chest = box(L.shoulderW * 0.8, 0.09 * L.s, 0.02, v3(0, L.chestY - 0.15 * L.s, L.shoulderW * L.depth * 0.95 + 0.03), mats.accent, 'panel');
      const patch = [0, 1, 2].map((i) => box(0.018, 0.018, 0.012, v3(-0.05 + i * 0.05, L.chestY - 0.15 * L.s, L.shoulderW * L.depth * 0.95 + 0.045), i === 1 ? mats.white : mats.dark, 'boton'));
      const glove = [-1, 1].map((s) => ellipsoid(L.sides[s].hand.clone().add(v3(0, 0.03, 0)), 0.044 * L.limb, 0.07 * L.s, 0.04 * L.limb, mats.accent, 6, 4, 'guante'));
      return group('ropa-astronauta',
        legGarment(L, mats.pants, { grow: 0.018 }), shoes(L, mats.accent),
        torsoGarment(L, mats.outfit, { sleeves: 'long', hemY: L.waistY - 0.1 * L.s, grow: 0.02 }),
        pack, chest, patch, glove, ring, helmet);
    },
  },
};

export const category = {
  id: 'profession',
  label: 'Profesión',
  groups: [{ id: 'profession', label: 'Profesión', options: Object.values(options) }],
};
