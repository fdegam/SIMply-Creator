// Exportación DXF (formato ASCII R12 / AC1009, compatible con AutoCAD, LibreCAD,
// FreeCAD, Rhino, Blender...). Cada triángulo se escribe como entidad 3DFACE.
//
// Convención: metros de Three.js (Y arriba) -> milímetros, Z arriba (CAD):
//   X = x,  Y = -z,  Z = y   (la vista "frontal" CAD mira hacia +Y)
import { collectTriangles } from './geometry.js';

/** Paleta ACI (AutoCAD Color Index) 1..255 generada de forma procedural. */
function buildACI() {
  const pal = new Array(256).fill(null);
  const base = [null, [255, 0, 0], [255, 255, 0], [0, 255, 0], [0, 255, 255], [0, 0, 255], [255, 0, 255], [255, 255, 255], [128, 128, 128], [192, 192, 192]];
  for (let i = 1; i <= 9; i++) pal[i] = base[i];
  const hsv = (h, s, v) => {
    const f = (n) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
    return [Math.round(f(5) * 255), Math.round(f(3) * 255), Math.round(f(1) * 255)];
  };
  const vs = [1, 0.65, 0.5, 0.3, 0.15];
  for (let h = 0; h < 24; h++) {
    for (let j = 0; j < 10; j++) {
      pal[10 + h * 10 + j] = hsv(h * 15, j % 2 ? 0.5 : 1, vs[j >> 1]);
    }
  }
  const grays = [51, 91, 132, 173, 214, 255];
  grays.forEach((g, i) => { pal[250 + i] = [g, g, g]; });
  return pal;
}
const ACI = buildACI();

function nearestACI(color) {
  const hexv = color.getHex(); // sRGB
  const r = (hexv >> 16) & 255, g = (hexv >> 8) & 255, b = hexv & 255;
  let best = 7, bd = Infinity;
  for (let i = 1; i < 256; i++) {
    const c = ACI[i];
    if (!c) continue;
    const d = (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

const f = (n) => (Math.abs(n) < 1e-9 ? 0 : n).toFixed(3);

/** Genera el texto DXF del personaje (modelo en mm). */
export function exportDXF(root, { scale = 1000 } = {}) {
  const tris = collectTriangles(root);
  const layers = new Map(); // nombre -> ACI predominante
  const out = [];
  const w = (code, value) => out.push(String(code), String(value));

  // Capas
  const counts = {};
  for (const t of tris) {
    const aci = nearestACI(t.color);
    layers.set(t.layer, aci);
    counts[t.layer] = (counts[t.layer] || 0) + 1;
  }

  w(0, 'SECTION'); w(2, 'HEADER');
  w(9, '$ACADVER'); w(1, 'AC1009');
  w(9, '$INSUNITS'); w(70, 4); // milímetros
  w(0, 'ENDSEC');

  w(0, 'SECTION'); w(2, 'TABLES');
  w(0, 'TABLE'); w(2, 'LTYPE'); w(70, 1);
  w(0, 'LTYPE'); w(2, 'CONTINUOUS'); w(70, 0); w(3, 'Solid line'); w(72, 65); w(73, 0); w(40, 0);
  w(0, 'ENDTAB');
  w(0, 'TABLE'); w(2, 'LAYER'); w(70, layers.size);
  for (const [name, aci] of layers) { w(0, 'LAYER'); w(2, name); w(70, 0); w(62, aci); w(6, 'CONTINUOUS'); }
  w(0, 'ENDTAB');
  w(0, 'ENDSEC');

  w(0, 'SECTION'); w(2, 'ENTITIES');
  const emit = (code0, p) => { w(code0, f(p.x * scale)); w(code0 + 10, f(-p.z * scale)); w(code0 + 20, f(p.y * scale)); };
  for (const t of tris) {
    w(0, '3DFACE');
    w(8, t.layer);
    w(62, nearestACI(t.color));
    emit(10, t.a); emit(11, t.b); emit(12, t.c); emit(13, t.c); // 4.º vértice = 3.º (triángulo)
  }
  w(0, 'ENDSEC');
  w(0, 'EOF');

  return { text: out.join('\n') + '\n', triangles: tris.length, layers: counts };
}
