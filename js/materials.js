// Materiales compartidos. Se reutilizan en todas las piezas, de modo que
// cambiar un color actualiza el personaje al instante sin reconstruir geometría.
import * as THREE from 'three';

/** Colores personalizables desde la interfaz. */
export const DEFAULT_COLORS = {
  skin:   '#e0ac86',
  hair:   '#4a2f20',
  eyes:   '#3b7ea1',
  outfit: '#4f7cac',
  accent: '#f2b134',
  pants:  '#3a4560',
};

export const COLOR_LABELS = {
  skin: 'Piel',
  hair: 'Pelo',
  eyes: 'Ojos',
  outfit: 'Ropa',
  accent: 'Acento',
  pants: 'Pantalón',
};

function std(color, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color, flatShading: true, roughness: 0.82, metalness: 0.0, ...extra,
  });
}

/** Materiales por clave. Las claves "personalizables" coinciden con DEFAULT_COLORS. */
export const mats = {
  skin:   std(DEFAULT_COLORS.skin),
  hair:   std(DEFAULT_COLORS.hair, { roughness: 0.95 }),
  eyes:   std(DEFAULT_COLORS.eyes, { roughness: 0.4 }),
  outfit: std(DEFAULT_COLORS.outfit),
  accent: std(DEFAULT_COLORS.accent),
  pants:  std(DEFAULT_COLORS.pants),
  // Fijos / derivados
  freckle: std('#b9774f'),
  shoes:   std('#2c2c33', { roughness: 0.6 }),
  white:   std('#f4f4f1', { roughness: 0.5 }),
  mouth:   std('#a54f5c'),
  dark:    std('#1c1c22', { roughness: 0.5 }),
  metal:   std('#b9c0c8', { roughness: 0.35, metalness: 0.6 }),
  wood:    std('#8a5a33'),
  glass:   std('#bfe6ff', { transparent: true, opacity: 0.35, roughness: 0.1, side: THREE.DoubleSide }),
};

/** Nombre de capa DXF (y grupo SVG) por material. */
export const MATERIAL_LAYER = {
  skin: 'PIEL', freckle: 'PIEL', mouth: 'PIEL',
  hair: 'PELO',
  eyes: 'OJOS', white: 'OJOS',
  outfit: 'ROPA', accent: 'ACENTO', pants: 'PANTALON',
  shoes: 'CALZADO', dark: 'DETALLE', metal: 'METAL', wood: 'MADERA', glass: 'CRISTAL',
};

export const colors = { ...DEFAULT_COLORS };

function shade(hex, factor) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(factor);
  return c;
}

/** Cambia un color personalizable y actualiza los materiales derivados. */
export function setColor(key, hex) {
  colors[key] = hex;
  mats[key].color.set(hex);
  if (key === 'skin') mats.freckle.color.copy(shade(hex, 0.78));
  if (key === 'skin') mats.mouth.color.set(hex).lerp(new THREE.Color('#9a2f45'), 0.55);
}

export function resetColors() {
  for (const k of Object.keys(DEFAULT_COLORS)) setColor(k, DEFAULT_COLORS[k]);
}

// Paletas coherentes para la aleatorización
export const PALETTES = {
  skin: ['#fbe0cc', '#f0c8a0', '#e0ac86', '#c68642', '#a3693d', '#7b4a2b', '#5a3420', '#3d2416'],
  hair: ['#1d1512', '#3b2417', '#4a2f20', '#7a4a2a', '#b9772f', '#d9b36a', '#e9d9a8', '#8a8a8a', '#d6d6d6', '#9a2b2b', '#2f5fa3', '#7b3fa0'],
  eyes: ['#3b7ea1', '#2f5d3a', '#5a3a22', '#2a2a2a', '#6b8fa0', '#7a6a3a'],
  outfit: ['#4f7cac', '#c0463a', '#3f8f5b', '#e0a93b', '#7a5aa6', '#2f3b52', '#d8d3c8', '#e87ea1'],
  accent: ['#f2b134', '#e5533d', '#1fa39a', '#f4f4f1', '#2f6fb3', '#9bc53d'],
  pants: ['#3a4560', '#2b2b30', '#6b5a43', '#4d6a4a', '#7a8794', '#8c3b3b'],
};

setColor('skin', DEFAULT_COLORS.skin);
