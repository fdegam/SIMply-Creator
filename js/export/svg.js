// Exportación SVG vectorial de la vista actual (algoritmo del pintor):
// proyecta cada triángulo con la cámara, descarta caras traseras, ordena de
// atrás hacia delante y rellena con un sombreado plano.
import * as THREE from 'three';
import { collectTriangles } from './geometry.js';

const LIGHT = new THREE.Vector3(-0.45, 0.75, 0.55).normalize(); // en espacio de cámara

const hex = (c) => '#' + c.getHexString();
const r2 = (n) => Math.round(n * 100) / 100;

/**
 * @param {THREE.Object3D} root
 * @param {THREE.Camera} camera
 * @param {{height?:number, background?:string|null, padding?:number}} opts
 */
export function exportSVG(root, camera, { height = 1000, background = null, padding = 0.04 } = {}) {
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  const view = camera.matrixWorldInverse;
  const proj = camera.projectionMatrix;
  const tris = collectTriangles(root);

  const faces = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const ndc = (p) => p.clone().applyMatrix4(view).applyMatrix4(proj);

  for (const t of tris) {
    const va = t.a.clone().applyMatrix4(view), vb = t.b.clone().applyMatrix4(view), vc = t.c.clone().applyMatrix4(view);
    if (va.z > -camera.near || vb.z > -camera.near || vc.z > -camera.near) continue; // detrás de la cámara
    const n = new THREE.Vector3().subVectors(vb, va).cross(new THREE.Vector3().subVectors(vc, va)).normalize();
    // Cara trasera: la normal apunta en sentido contrario a la cámara
    const toCam = va.clone().negate();
    const facing = n.dot(toCam);
    if (facing <= 0 && !t.double) continue;
    const nn = facing < 0 ? n.negate() : n;

    const pa = ndc(t.a), pb = ndc(t.b), pc = ndc(t.c);
    const shade = 0.52 + 0.48 * Math.max(0, nn.dot(LIGHT));
    const col = t.color.clone().multiplyScalar(shade);
    // Un toque de luz de relleno frío en las sombras
    col.r = Math.min(1, col.r); col.g = Math.min(1, col.g); col.b = Math.min(1, col.b);
    faces.push({
      pts: [pa, pb, pc],
      depth: (va.z + vb.z + vc.z) / 3 + t.bias,
      fill: hex(col),
      opacity: t.opacity,
      layer: t.layer,
    });
    for (const p of [pa, pb, pc]) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
  }
  if (!faces.length) throw new Error('No hay geometría visible para exportar');

  // Recorte ajustado al dibujo (NDC -> píxeles, con Y invertida)
  const aspect = camera.aspect || 1;
  const sx = aspect * 500, sy = 500; // escala relativa; solo importan las proporciones
  const X = (x) => x * sx, Y = (y) => -y * sy;
  const bx0 = X(minX), bx1 = X(maxX), by0 = Y(maxY), by1 = Y(minY);
  const pad = Math.max(bx1 - bx0, by1 - by0) * padding;
  const vbX = bx0 - pad, vbY = by0 - pad, vbW = bx1 - bx0 + pad * 2, vbH = by1 - by0 + pad * 2;
  const outH = height, outW = Math.round((height * vbW) / vbH);

  // Orden del pintor: lejos (z más negativo) primero
  faces.sort((a, b) => a.depth - b.depth);

  const lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${outW}" height="${outH}" viewBox="${r2(vbX)} ${r2(vbY)} ${r2(vbW)} ${r2(vbH)}">`);
  lines.push('<title>SIMply Creator</title>');
  if (background) lines.push(`<rect x="${r2(vbX)}" y="${r2(vbY)}" width="${r2(vbW)}" height="${r2(vbH)}" fill="${background}"/>`);
  lines.push('<g stroke-linejoin="round" stroke-width="0.6">');
  for (const fc of faces) {
    const d = fc.pts.map((p) => `${r2(X(p.x))},${r2(Y(p.y))}`).join(' ');
    const op = fc.opacity < 1 ? ` fill-opacity="${r2(fc.opacity)}" stroke-opacity="${r2(fc.opacity)}"` : '';
    lines.push(`<polygon points="${d}" fill="${fc.fill}" stroke="${fc.fill}"${op}/>`);
  }
  lines.push('</g>');
  lines.push('</svg>');
  return { text: lines.join('\n') + '\n', triangles: faces.length, width: outW, height: outH };
}
