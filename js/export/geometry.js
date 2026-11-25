// Extrae los triángulos del personaje en coordenadas de mundo, con capa y color.
import * as THREE from 'three';

/**
 * @returns {{a:Vector3,b:Vector3,c:Vector3,layer:string,color:Color,opacity:number,double:boolean,bias:number}[]}
 */
export function collectTriangles(root) {
  root.updateMatrixWorld(true);
  const tris = [];
  root.traverse((o) => {
    if (!o.isMesh || o.userData.noExport || !o.visible) return;
    const geo = o.geometry;
    const pos = geo.attributes.position;
    const idx = geo.index;
    const n = idx ? idx.count : pos.count;
    const mat = o.material;
    const layer = o.userData.layer || 'DETALLE';
    const opacity = mat.transparent ? mat.opacity : 1;
    const double = mat.side === THREE.DoubleSide;
    const bias = (o.userData.bias || 0) + (layer === 'PIEL' ? -0.012 : 0); // orden de dibujado SVG: piel detrás, prendas exteriores delante
    const get = (i) => new THREE.Vector3().fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(o.matrixWorld);
    for (let i = 0; i < n; i += 3) {
      const a = get(i), b = get(i + 1), c = get(i + 2);
      // Descarta triángulos degenerados (polos de esferas)
      if (new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).lengthSq() < 1e-14) continue;
      tris.push({ a, b, c, layer, color: mat.color.clone(), opacity, double, bias });
    }
  });
  return tris;
}

export function download(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
