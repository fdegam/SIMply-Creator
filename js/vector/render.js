// Composición SVG de la figura con los ajustes de estilo:
//   perim   grosor del perímetro (mm sobre la figura a escala real)
//   inner   grosor extra de las líneas interiores (mm)
//   shading 'ninguno' | 'tono' | 'rayado'  (sombreado del lado en sombra)
//   shadow  sombra proyectada en el suelo
import { part } from './kit.js';

const INK = '#141414';

/** Matriz afín [a,b,c,d,e,f] que lleva la parte (px, Y abajo) a su recuadro (mm, Y arriba). */
export function partMatrix(item) {
  const p = item.name.startsWith('@') ? { w: 100, h: 100 } : part(item.name);
  const { x0, y0, x1, y1 } = item.box;
  const sx = (x1 - x0) / p.w, sy = (y1 - y0) / p.h;
  // Y arriba: el píxel y=0 (arriba) va a y1
  return item.flip ? [-sx, 0, 0, -sy, x1, y1] : [sx, 0, 0, -sy, x0, y1];
}

/** Trazados de una pieza procedural (pies frontales). */
export function proceduralPaths(item) {
  if (item.name === '@pie') {
    // Zapato visto de frente: puntera redondeada, en unidades 0..100
    return { sil: 'M8,100 L8,45 C8,10 92,10 92,45 L92,100 Z', lin: '' };
  }
  return { sil: '', lin: '' };
}

const pathsOf = (it) => (it.name.startsWith('@') ? proceduralPaths(it) : part(it.name));

/** Factor px->mm medio de una pieza (para que el grosor sea uniforme en toda la figura). */
const pxToMm = (it, m) => Math.sqrt(Math.abs(m[0] * m[3]));

export function bounds(items) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const it of items) {
    x0 = Math.min(x0, it.box.x0); x1 = Math.max(x1, it.box.x1);
    y0 = Math.min(y0, it.box.y0); y1 = Math.max(y1, it.box.y1);
  }
  return { x0, y0, x1, y1 };
}

/**
 * @returns {string} documento SVG completo
 */
export function renderSVG(fig, style, { pad = 60, height = null, background = '#fff', title = 'SIMply' } = {}) {
  const { items } = fig;
  const b = bounds(items);
  const shadowLen = style.shadow ? (b.y1 - b.y0) * 0.55 : 0;
  const vb = { x: b.x0 - pad, y: -(b.y1 + pad), w: b.x1 - b.x0 + pad * 2 + shadowLen, h: b.y1 - b.y0 + pad * 2 };
  const uid = Math.random().toString(36).slice(2, 7);
  const out = [];
  const hAttr = height ? ` height="${height}" width="${Math.round((height * vb.w) / vb.h)}"` : '';
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(vb.x)} ${f(vb.y)} ${f(vb.w)} ${f(vb.h)}"${hAttr}>`);
  out.push(`<title>${esc(title)}</title>`);
  out.push(`<defs><pattern id="h${uid}" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="22" stroke="${INK}" stroke-width="2.4"/></pattern></defs>`);
  if (background) out.push(`<rect x="${f(vb.x)}" y="${f(vb.y)}" width="${f(vb.w)}" height="${f(vb.h)}" fill="${background}"/>`);
  // El dibujo se hace en mm con Y arriba; un grupo con scale(1,-1) lo pasa a SVG
  out.push('<g transform="scale(1,-1)">');

  // Sombra proyectada: todas las siluetas aplastadas y cizalladas hacia la derecha
  if (style.shadow) {
    const fill = style.shading === 'rayado' ? `url(#h${uid})` : '#cfcfcf';
    out.push(`<g transform="matrix(1,0,0.62,0.28,0,0)" fill="${fill}" stroke="none" opacity="${style.shading === 'rayado' ? 0.8 : 1}">`);
    for (const it of items) {
      const m = partMatrix(it);
      out.push(`<path transform="${mat(m)}" d="${pathsOf(it).sil}"/>`);
    }
    out.push('</g>');
  }

  for (const it of items) {
    const m = partMatrix(it);
    const k = pxToMm(it, m);
    const { sil, lin } = pathsOf(it);
    // Los rasgos de la cara (ojos, boca...) son detalle interior: llevan el grosor interior
    const p0 = it.name.startsWith('@') ? null : part(it.name);
    // 'ink': la pieza trae su contorno dibujado (pelo, gafas, sillas...): sin trazo de perímetro
    const inkMode = p0 && p0.mode === 'ink';
    const perimPx = inkMode ? 0 : (it.layer === 'RASGO' ? Math.max(style.inner, 1.2) : style.perim) / k;
    const innerPx = style.inner / k;
    // Recorte horizontal (p. ej. flequillo): solo se dibuja lo que queda por encima de clipY
    if (it.clipY != null) {
      const ccid = `y${uid}${items.indexOf(it)}`;
      out.push(`<clipPath id="${ccid}"><rect x="${f(it.box.x0 - 10)}" y="${f(it.clipY)}" width="${f(it.box.x1 - it.box.x0 + 20)}" height="${f(it.box.y1 - it.clipY + 10)}"/></clipPath><g clip-path="url(#${ccid})">`);
    }
    out.push(`<g transform="${mat(m)}" data-part="${it.name}">`);
    out.push(`<path d="${sil}" fill="#fff" stroke="${perimPx ? INK : 'none'}" stroke-width="${f(perimPx)}" stroke-linejoin="round"/>`);
    if (style.shading !== 'ninguno') {
      // Lado en sombra (derecha, luz desde la izquierda): recorte con la silueta
      const cid = `c${uid}${items.indexOf(it)}`;
      const p = it.name.startsWith('@') ? { w: 100, h: 100 } : part(it.name);
      const sx = it.flip ? 0 : p.w * 0.58;   // al voltear, la "derecha" de la pieza queda a la izquierda
      const fill = style.shading === 'rayado' ? `url(#h${uid})` : '#d9d9d9';
      out.push(`<clipPath id="${cid}"><path d="${sil}"/></clipPath>`);
      out.push(`<rect clip-path="url(#${cid})" x="${f(sx)}" y="0" width="${f(p.w * 0.42)}" height="${f(p.h)}" fill="${fill}" opacity="${style.shading === 'rayado' ? 0.55 : 1}"/>`);
      if (perimPx) out.push(`<path d="${sil}" fill="none" stroke="${INK}" stroke-width="${f(perimPx)}" stroke-linejoin="round"/>`);
    }
    if (lin) out.push(`<path d="${lin}" fill="${INK}" stroke="${INK}" stroke-width="${f(innerPx)}" stroke-linejoin="round"/>`);
    out.push('</g>');
    if (it.clipY != null) out.push('</g>');
  }
  out.push('</g></svg>');
  return out.join('\n');
}

const f = (n) => (Math.round(n * 100) / 100).toString();
const mat = (m) => `matrix(${m.map(f).join(',')})`;
const esc = (s) => String(s).replace(/[<&>"]/g, (c) => ({ '<': '&lt;', '&': '&amp;', '>': '&gt;', '"': '&quot;' })[c]);
