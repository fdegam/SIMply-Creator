#!/usr/bin/env python3
"""Vectoriza las partes del kit (línea negra sobre blanco) con potrace.

Uso:  python3 tools/vectorize.py [dir_png] [dir_svg]
      (por defecto assets/parts-src -> assets/parts)

Cada SVG lleva tres trazados, en unidades de píxel de la imagen recortada:
  .sil  silueta exterior (se rellena de blanco para tapar lo que queda detrás;
        su trazo es el PERÍMETRO y su grosor lo elige el usuario)
  .lin  líneas interiores (pliegues, costuras, rasgos), como áreas rellenas
  .per  tinta original del contorno exterior (solo de referencia; el render usa .sil)
Además escribe manifest.json con el tamaño de cada parte y el grosor medio
del contorno original (para que el grosor por defecto se parezca al dibujo).
"""
import os, sys, glob, json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import potrace

PAD = 6

def to_d(path, ox=0, oy=0):
    d = []
    for curve in path:
        s = curve.start_point
        d.append(f"M{s.x-ox:.1f},{s.y-oy:.1f}")
        for seg in curve.segments:
            if seg.is_corner:
                d.append(f"L{seg.c.x-ox:.1f},{seg.c.y-oy:.1f}L{seg.end_point.x-ox:.1f},{seg.end_point.y-oy:.1f}")
            else:
                d.append(f"C{seg.c1.x-ox:.1f},{seg.c1.y-oy:.1f} {seg.c2.x-ox:.1f},{seg.c2.y-oy:.1f} {seg.end_point.x-ox:.1f},{seg.end_point.y-oy:.1f}")
        d.append('Z')
    return ''.join(d)

def bitmap_trace(mask, **opts):
    # Ojo: potracer traza los píxeles en False
    return potrace.Bitmap(~mask).trace(**opts)

def trace(png):
    im = Image.open(png).convert('RGBA')
    bg = Image.new('RGBA', im.size, (255, 255, 255, 255))
    bg.alpha_composite(im)
    g = np.array(bg.convert('L'))
    ink = g < 128
    # Exterior = fondo alcanzable desde el borde
    flood = Image.fromarray(np.pad(np.where(ink, 0, 255).astype('uint8'), 1, constant_values=255)).copy()
    ImageDraw.floodfill(flood, (0, 0), 128)
    outside = np.array(flood)[1:-1, 1:-1] == 128
    sil = ~outside
    # Tinta del perímetro = tinta pegada al exterior (dilatación del exterior)
    ys, xs = np.nonzero(sil)
    if not len(xs):
        raise ValueError(f'{png}: imagen vacía')
    stroke = estimate_stroke(ink, outside)
    size = int(stroke * 1.5 + 2) | 1  # franja de contorno = grosor + margen
    near = np.array(Image.fromarray((outside * 255).astype('uint8')).filter(ImageFilter.MaxFilter(size))) > 0
    per = ink & near
    lin = ink & ~per
    x0, y0 = max(0, xs.min() - PAD), max(0, ys.min() - PAD)
    x1, y1 = min(g.shape[1], xs.max() + PAD + 1), min(g.shape[0], ys.max() + PAD + 1)
    opts = dict(turdsize=4, alphamax=1.0, opticurve=True, opttolerance=0.2)
    # La silueta se traza por el CENTRO del contorno original: se erosiona la mitad del grosor
    sil_mid = np.array(Image.fromarray((sil * 255).astype('uint8')).filter(ImageFilter.MinFilter(max(1, int(stroke) | 1)))) > 0
    W, H = int(x1 - x0), int(y1 - y0)
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">'
           f'<path class="sil" fill="#fff" d="{to_d(bitmap_trace(sil_mid, **opts), x0, y0)}"/>'
           f'<path class="lin" fill="#111" d="{to_d(bitmap_trace(lin, **opts), x0, y0)}"/>'
           f'</svg>')
    return svg, W, H, stroke

def estimate_stroke(ink, outside):
    """Grosor medio (px) del contorno: recorre filas y columnas desde fuera hacia dentro."""
    runs = []
    for arr in (ink, ink.T):
        out = outside if arr is ink else outside.T
        for r in range(0, arr.shape[0], 7):
            row, o = arr[r], out[r]
            idx = np.nonzero(row)[0]
            if not len(idx):
                continue
            for start in (idx[0], idx[-1]):
                step = 1 if start == idx[0] else -1
                if not o[max(0, min(len(o) - 1, start - step))]:
                    continue
                n, i = 0, start
                while 0 <= i < len(row) and row[i]:
                    n += 1; i += step
                if n < 40:
                    runs.append(n)
    return float(np.median(runs)) if runs else 6.0

if __name__ == '__main__':
    src = sys.argv[1] if len(sys.argv) > 1 else 'assets/parts-src'
    dst = sys.argv[2] if len(sys.argv) > 2 else 'assets/parts'
    os.makedirs(dst, exist_ok=True)
    man_path = os.path.join(dst, 'manifest.json')
    manifest = json.load(open(man_path)) if os.path.exists(man_path) else {}
    for png in sorted(glob.glob(os.path.join(src, '*.png'))):
        name = os.path.splitext(os.path.basename(png))[0]
        svg, W, H, stroke = trace(png)
        open(os.path.join(dst, name + '.svg'), 'w').write(svg)
        manifest[name] = {'w': W, 'h': H, 'stroke': round(stroke, 1)}
        print(f'{name}: {W}x{H}, contorno {stroke:.1f}px')
    json.dump(dict(sorted(manifest.items())), open(man_path, 'w'), indent=1)
