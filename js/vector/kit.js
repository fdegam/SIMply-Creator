// Carga del kit de partes vectoriales (assets/parts) y utilidades de trazados.
// Cada parte tiene: sil (silueta, se rellena de blanco y lleva el trazo de perímetro)
// y lin (líneas interiores, áreas rellenas). Unidades: píxeles de la imagen recortada.

const BASE = new URL('../../assets/parts/', import.meta.url);
const cache = new Map();
let manifest = null;

export async function loadKit(names) {
  if (!manifest) manifest = await (await fetch(new URL('manifest.json', BASE))).json();
  await Promise.all(names.filter((n) => !cache.has(n)).map(async (n) => {
    const txt = await (await fetch(new URL(n + '.svg', BASE))).text();
    const doc = new DOMParser().parseFromString(txt, 'image/svg+xml');
    const m = manifest[n];
    cache.set(n, {
      name: n, w: m.w, h: m.h, stroke: m.stroke, mode: m.mode || 'sil',
      sil: doc.querySelector('.sil')?.getAttribute('d') || '',
      lin: doc.querySelector('.lin')?.getAttribute('d') || '',
    });
  }));
}

export function part(name) {
  const p = cache.get(name);
  if (!p) throw new Error(`Parte no cargada: ${name}`);
  return p;
}

export const partNames = () => Object.keys(manifest || {});

/**
 * Convierte un "d" (solo M, L, C, Z absolutos, como los genera tools/vectorize.py)
 * en polilíneas cerradas, aplicando una transformación afín [a,b,c,d,e,f].
 */
export function flatten(d, m = [1, 0, 0, 1, 0, 0], segs = 6) {
  const out = [];
  let cur = null, x = 0, y = 0;
  const T = (px, py) => [m[0] * px + m[2] * py + m[4], m[1] * px + m[3] * py + m[5]];
  const re = /([MLCZ])([^MLCZ]*)/g;
  let mt;
  while ((mt = re.exec(d))) {
    const nums = mt[2].trim() ? mt[2].trim().split(/[\s,]+/).map(Number) : [];
    switch (mt[1]) {
      case 'M': cur = [T(nums[0], nums[1])]; out.push(cur); [x, y] = nums; break;
      case 'L': for (let i = 0; i < nums.length; i += 2) { cur.push(T(nums[i], nums[i + 1])); [x, y] = [nums[i], nums[i + 1]]; } break;
      case 'C':
        for (let i = 0; i < nums.length; i += 6) {
          const [x1, y1, x2, y2, x3, y3] = nums.slice(i, i + 6);
          for (let k = 1; k <= segs; k++) {
            const t = k / segs, u = 1 - t;
            const px = u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3;
            const py = u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3;
            cur.push(T(px, py));
          }
          [x, y] = [x3, y3];
        }
        break;
      case 'Z': break;
    }
  }
  return out;
}
