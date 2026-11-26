// Exportación del SIM como BLOQUE de AutoCAD (DXF R12 / AC1009).
//
// - Una definición BLOCK con punto base (0,0) entre los pies, a nivel de suelo.
// - Una inserción INSERT en el espacio modelo, con atributos (NOMBRE, GENERO,
//   PROFESION, MOVILIDAD, VISTA) que se pueden editar en AutoCAD.
// - Capas: SIM-PERIMETRO (polilíneas con grosor), SIM-INTERIOR, SIM-SOMBRA.
// - Unidades: mm a escala real (1 unidad = 1 mm). Los grosores se dan en mm de
//   PLOTEO y se multiplican por la escala elegida (p. ej. 0,18 mm a 1:50 = 9 mm).
// - Se eliminan las líneas ocultas: cada polilínea se recorta con las siluetas de
//   las piezas que tiene delante, para que el bloque se vea igual que la vista previa.
import { part, flatten } from './kit.js';
import { partMatrix, proceduralPaths } from './render.js';

/** Subdivide tramos largos para que el recorte por ocultación sea preciso. */
function densify(poly, maxLen) {
  const out = [poly[0]];
  for (let i = 1; i < poly.length; i++) {
    const [ax, ay] = poly[i - 1], [bx, by] = poly[i];
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) / maxLen);
    for (let k = 1; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  return out;
}

function bboxOf(polys) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of polys) for (const [x, y] of p) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1 };
}

/**
 * Máscara de ocultación rasterizada (2 mm/píxel). Se rellena de delante hacia atrás:
 * cada pieza consulta la máscara (lo que tiene delante) y luego añade su silueta.
 */
class OcclusionMask {
  constructor(bb, res = 2) {
    this.res = res; this.x0 = bb.x0 - 20; this.y0 = bb.y0 - 20;
    this.w = Math.ceil((bb.x1 - bb.x0 + 40) / res); this.h = Math.ceil((bb.y1 - bb.y0 + 40) / res);
    const c = document.createElement('canvas'); c.width = this.w; c.height = this.h;
    this.ctx = c.getContext('2d', { willReadFrequently: true });
    this.data = null;
  }
  /** Añade anillos (regla par-impar); clipY opcional: solo por encima. */
  add(rings, clipY) {
    const g = this.ctx;
    g.save();
    if (clipY != null) { g.beginPath(); g.rect(0, 0, this.w, this.toPy(clipY)); g.clip(); }
    g.beginPath();
    for (const r of rings) r.forEach(([x, y], k) => (k ? g.lineTo : g.moveTo).call(g, this.toPx(x), this.toPy(y)));
    g.fillStyle = '#000'; g.fill('evenodd');
    g.restore();
    this.data = null;
  }
  toPx(x) { return (x - this.x0) / this.res; }
  toPy(y) { return this.h - (y - this.y0) / this.res; }
  hidden(x, y) {
    if (!this.data) this.data = this.ctx.getImageData(0, 0, this.w, this.h).data;
    const px = Math.floor(this.toPx(x)), py = Math.floor(this.toPy(y));
    if (px < 0 || py < 0 || px >= this.w || py >= this.h) return false;
    return this.data[(py * this.w + px) * 4 + 3] > 128;
  }
}

/** Trocea una polilínea quitando los tramos ocultos. */
function visibleRuns(poly, isHidden) {
  const runs = [];
  let cur = [];
  for (const pt of poly) {
    if (isHidden(pt[0], pt[1])) { if (cur.length > 1) runs.push(cur); cur = []; } else cur.push(pt);
  }
  if (cur.length > 1) runs.push(cur);
  return runs;
}

/**
 * @param {{items:Array, view:string}} fig
 * @param {{perim:number, inner:number, shadow:boolean}} style  grosores en mm de ploteo
 * @param {{scale:number, attrs:Record<string,string>, blockName:string}} opts
 */
export function exportBlockDXF(fig, style, { scale = 50, attrs = {}, blockName = 'SIM' } = {}) {
  const items = fig.items;
  // Geometría de cada pieza en mm de modelo
  const geo = items.map((it) => {
    const m = partMatrix(it);
    const src = it.name.startsWith('@') ? proceduralPaths(it) : part(it.name);
    const sil = flatten(src.sil, m).filter((r) => r.length > 2);
    const lin = flatten(src.lin, m).filter((r) => r.length > 2);
    const ink = !it.name.startsWith('@') && part(it.name).mode === 'ink';
    return { it, m, sil, lin, ink, clipY: it.clipY };
  });
  const step = 6; // mm de modelo
  const all = bboxOf(geo.flatMap((g) => g.sil));
  if (style.shadow) all.x1 += (all.y1 - all.y0) * 0.65;
  const mask = new OcclusionMask(all);
  const ents = []; // { layer, pts, width }
  const emit = (layer, rings, width, clipY) => {
    for (const r of rings) {
      for (const run of visibleRuns(densify([...r, r[0]], step), (x, y) => (clipY != null && y < clipY) || mask.hidden(x, y))) {
        ents.push({ layer, pts: run, width });
      }
    }
  };
  // De delante hacia atrás
  for (let i = geo.length - 1; i >= 0; i--) {
    const g = geo[i];
    if (g.it.layer === 'RASGO') emit('SIM-INTERIOR', g.sil, 0, g.clipY);      // rasgos: trazo fino
    else if (!g.ink) emit('SIM-PERIMETRO', g.sil, style.perim * scale, g.clipY);
    emit('SIM-INTERIOR', g.lin, 0, g.clipY);
    mask.add(g.sil, g.clipY);
  }
  // Sombra: detrás de todo
  if (style.shadow) {
    for (let i = geo.length - 1; i >= 0; i--) {
      const rings = geo[i].sil.map((r) => r.map(([x, y]) => [x + 0.62 * y, 0.28 * y]));
      emit('SIM-SOMBRA', rings, 0);
      mask.add(rings);
    }
  }
  // Orden natural de dibujo (atrás -> delante) en el archivo
  ents.reverse();

  return writeDXF(ents, { blockName, attrs, scale });
}

/* ----------------------------------------------------------- Escritura R12 */
function writeDXF(ents, { blockName, attrs, scale }) {
  const out = [];
  const w = (c, v) => out.push(String(c), String(v));
  const n = (v) => (Math.abs(v) < 1e-9 ? 0 : v).toFixed(2);
  const b = bboxOf(ents.map((e) => e.pts));
  const txtH = 2.5 * scale; // 2,5 mm de ploteo

  w(0, 'SECTION'); w(2, 'HEADER');
  w(9, '$ACADVER'); w(1, 'AC1009');
  w(9, '$INSUNITS'); w(70, 4);
  w(9, '$EXTMIN'); w(10, n(b.x0)); w(20, n(b.y0)); w(30, 0);
  w(9, '$EXTMAX'); w(10, n(b.x1)); w(20, n(b.y1)); w(30, 0);
  w(0, 'ENDSEC');

  w(0, 'SECTION'); w(2, 'TABLES');
  w(0, 'TABLE'); w(2, 'LTYPE'); w(70, 1);
  w(0, 'LTYPE'); w(2, 'CONTINUOUS'); w(70, 0); w(3, 'Solid line'); w(72, 65); w(73, 0); w(40, 0);
  w(0, 'ENDTAB');
  const layers = [['SIM-PERIMETRO', 7], ['SIM-INTERIOR', 7], ['SIM-SOMBRA', 8], ['SIM-ATRIBUTOS', 8]];
  w(0, 'TABLE'); w(2, 'LAYER'); w(70, layers.length);
  for (const [name, col] of layers) { w(0, 'LAYER'); w(2, name); w(70, 0); w(62, col); w(6, 'CONTINUOUS'); }
  w(0, 'ENDTAB');
  w(0, 'ENDSEC');

  // Definición del bloque
  w(0, 'SECTION'); w(2, 'BLOCKS');
  w(0, 'BLOCK'); w(8, '0'); w(2, blockName); w(70, Object.keys(attrs).length ? 2 : 0);
  w(10, 0); w(20, 0); w(30, 0); w(3, blockName);
  for (const e of ents) {
    w(0, 'POLYLINE'); w(8, e.layer); w(66, 1); w(10, 0); w(20, 0); w(30, 0); w(70, 0);
    if (e.width) { w(40, n(e.width)); w(41, n(e.width)); }
    for (const [x, y] of e.pts) { w(0, 'VERTEX'); w(8, e.layer); w(10, n(x)); w(20, n(y)); w(30, 0); }
    w(0, 'SEQEND'); w(8, e.layer);
  }
  let ay = b.y0 - txtH * 2;
  for (const [tag, val] of Object.entries(attrs)) {
    w(0, 'ATTDEF'); w(8, 'SIM-ATRIBUTOS'); w(10, n(b.x0)); w(20, n(ay)); w(30, 0); w(40, n(txtH));
    w(1, val); w(3, tag.charAt(0) + tag.slice(1).toLowerCase()); w(2, tag); w(70, 1); // 1 = invisible
    ay -= txtH * 1.6;
  }
  w(0, 'ENDBLK'); w(8, '0');
  w(0, 'ENDSEC');

  // Inserción en el modelo, con los valores de los atributos
  w(0, 'SECTION'); w(2, 'ENTITIES');
  w(0, 'INSERT'); w(8, '0'); w(66, Object.keys(attrs).length ? 1 : 0); w(2, blockName);
  w(10, 0); w(20, 0); w(30, 0);
  if (Object.keys(attrs).length) {
    ay = b.y0 - txtH * 2;
    for (const [tag, val] of Object.entries(attrs)) {
      w(0, 'ATTRIB'); w(8, 'SIM-ATRIBUTOS'); w(10, n(b.x0)); w(20, n(ay)); w(30, 0); w(40, n(txtH));
      w(1, val); w(2, tag); w(70, 1);
      ay -= txtH * 1.6;
    }
    w(0, 'SEQEND'); w(8, '0');
  }
  w(0, 'ENDSEC');
  w(0, 'EOF');
  return { text: out.join('\n') + '\n', polylines: ents.length };
}
