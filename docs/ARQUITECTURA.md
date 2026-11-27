# Arquitectura y decisiones

No hay backend. Es una página estática con dos pantallas según el `hash`: la portada y el editor (`#crear`).
El editor queda montado al volver a la portada, para no perder el trabajo.

## Mapa del código

| Archivo | Responsabilidad |
| --- | --- |
| `src/media.ts` | Leer foto, GIF o video; dibujar el sticker; recortar audio; exportar |
| `src/ffmpeg.ts` | Carga diferida de ffmpeg.wasm, ejecución y cancelación |
| `src/transparent.ts` | WebM con transparencia (Mediabunny + WebCodecs) |
| `src/useRecorder.ts` | Grabación del micrófono y onda en vivo |
| `src/App.tsx` | Estado del editor y generación |
| `src/Controls.tsx` | Pestañas de ajustes (imagen, fondo, texto) |
| `src/PreviewStage.tsx` | Vista previa y editor a pantalla completa |
| `src/Trim.tsx` | Barra de recorte sobre la onda |
| `src/Landing.tsx`, `src/ClosingCard.tsx`, `src/ScrubbableSticker.tsx` | Portada |
| `src/i18n.ts` | Todos los textos (es / en) |
| `seo.js` | Metadatos, datos estructurados y contenido estático, al compilar |

## El dibujo del sticker

Una sola función (`draw`) pinta la vista previa, los cuadros del video y las imágenes finales, sobre un canvas de
512×512 y en este orden: fondo, imagen (con posición, zoom, giro, goma y color quitado), borde, emojis y texto.

Los trazos de la goma se guardan en **coordenadas de la imagen original**, así acompañan a la imagen si después se mueve,
se agranda o se gira.

## Codificación

| Caso | Salida | Cómo |
| --- | --- | --- |
| Con fondo | MP4 (H.264 + AAC), CRF 23 | ffmpeg.wasm a partir de cuadros PNG |
| Transparente | WebM VP9 + Opus | Codificadores del navegador |
| Imagen fija sin sonido | PNG y WebP (hasta 100 KB si se puede) | `canvas.toBlob` |
| Solo audio | M4A | ffmpeg.wasm |

**Por qué el transparente no usa ffmpeg:** en ffmpeg.wasm 0.12, `libvpx` y `libvpx-vp9` con canal alfa fallan con
`memory access out of bounds` en el primer cuadro.

**Cancelar:** ffmpeg no se puede interrumpir, así que se cierra su worker y se vuelve a cargar la próxima vez.

El núcleo de ffmpeg pesa unos 32 MB y se baja recién al generar por primera vez.

## GIFs de la portada

- `src/assets/gifs/*.webp`: los del hero. En cada carga se eligen cinco al azar, con carga diferida.
- `src/assets/sprites/*.webp` + `info.json`: grillas de cuadros (hasta 40, de 160 px, 8 columnas) con la duración real.
  Los usa la tarjeta final, que necesita saltar a cualquier punto; un WebP animado no lo permite.

Para sacarlos o cambiarlos, hay que mantener los mismos nombres en las dos carpetas y en `info.json`
(`frames`, `rows`, `duration`). Para quitarlos todos, vaciar las carpetas, dejar `info.json` como `{}` y hacer que
`closingGif` sea opcional en `src/heroGifs.ts`.

Con "reducir movimiento" activado no se muestran en el hero y la tarjeta final arranca en pausa.

## Accesibilidad y movimiento

Las barras de recorte y de posición funcionan con teclado. Las animaciones de entrada se desactivan con
`prefers-reduced-motion`.
