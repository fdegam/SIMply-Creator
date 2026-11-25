# SIMply Creator

Generador 3D **low-poly** de personajes en el navegador (Three.js, sin build ni dependencias de npm).
Elige complexión, género, rasgos y profesión; personaliza los colores; gira el modelo en 3D y
**exporta a DXF (CAD) y SVG (vector)**.

![Vista previa](assets/preview.png)

## Uso

Los módulos ES necesitan un servidor HTTP (no funcionan abriendo el archivo con `file://`):

```bash
python3 -m http.server 8000
# abre http://localhost:8000
```

Funciona tal cual en **GitHub Pages** (Settings → Pages → *Deploy from a branch* → `main` / root).
Three.js está incluido en `js/vendor/`, así que no hay dependencia de CDN.

## Controles

| Control | Qué hace |
|---|---|
| Complexión | Delgada · Normal · Atlética · Robusta · Corpulenta |
| Género | Masculino · Femenino · Neutro (proporciones, cejas, pestañas, busto…) |
| Rasgos | Peinado (7) · Ojos (4) · Nariz (4) · Rasgo facial (barba, bigote, perilla, gafas, pecas) |
| Profesión | Casual · Arquitecto · Chef · Médico · Bombero · Artista · Astronauta |
| Colores | Piel, pelo, ojos, ropa, acento, pantalón (se aplican al instante) |
| 🎲 Aleatorizar / ↺ Resetear | Combinación y colores al azar / estado inicial |
| ⬇ DXF / ⬇ SVG | Exportan el personaje actual |

Al cambiar la complexión o el género las proporciones se **morfan** de forma animada; el resto de
piezas entra con un pop elástico. Elegir una profesión aplica sus colores por defecto (luego puedes cambiarlos).

## Estructura

```
index.html            estructura: visor 3D, controles, botones
css/style.css
js/
  main.js             escena, interfaz y eventos
  character.js        ensambla las piezas según el estado y anima las transiciones
  common.js           helpers low-poly + layout del cuerpo (articulaciones) + prendas base
  materials.js        materiales compartidos, colores y paletas
  complexion.js       categoría: cuerpo base según proporciones
  gender.js           categoría: modificadores y rasgos asociados
  traits.js           categoría: peinado, ojos, nariz, rasgo facial
  profession.js       categoría: vestuario y accesorios
  export/
    dxf.js            exportador DXF
    svg.js            exportador SVG
    geometry.js       extracción de triángulos en coordenadas de mundo + descarga
  vendor/             three.module.js (r160) + OrbitControls
```

Cada módulo de categoría exporta `options` (un objeto 3D por opción: `build(L) → THREE.Group`)
y `category` (metadatos que `main.js` usa para generar la interfaz automáticamente). Para añadir
una opción basta con añadir una entrada en el módulo correspondiente.

## Exportación

* **DXF** — ASCII R12 (`AC1009`), unidades en **mm**, Z hacia arriba, vista frontal hacia +Y.
  Cada triángulo es una entidad `3DFACE`; hay una capa por material (`PIEL`, `PELO`, `ROPA`,
  `PANTALON`, `ACENTO`, `CALZADO`…) y color ACI por cara. Verificado con `ezdxf` (lectura + auditoría sin errores).
* **SVG** — vista actual de la cámara: proyección, descarte de caras traseras, orden del pintor y
  sombreado plano. Recortado al dibujo, fondo transparente.

> **Nota sobre librerías.** `three-dxf` es un *visor* de DXF (lee, no escribe) y `three-svg-renderer`
> exige bundler y dependencias pesadas (`three-mesh-bvh`…) que rompen el enfoque sin build. Por eso los
> exportadores son propios (≈100 líneas cada uno, sin dependencias). El SVG usa el algoritmo del
> pintor, así que en intersecciones muy complejas puede haber alguna astilla; el DXF no tiene ese problema.

## Integración en el portfolio

`portfolio/card.html` contiene una tarjeta lista para pegar en el índice del portfolio.
Si el portfolio es otro repositorio, copia el fragmento y cambia el `href` por la URL publicada
(p. ej. `https://<usuario>.github.io/SIMply-Creator/`). También se puede incrustar con un `<iframe>`:

```html
<iframe src="https://<usuario>.github.io/SIMply-Creator/" title="SIMply Creator"
        style="width:100%;height:720px;border:0" loading="lazy" allow="fullscreen"></iframe>
```

## Licencia

Código del proyecto: libre uso. Three.js: MIT (`js/vendor/LICENSE-three`).
