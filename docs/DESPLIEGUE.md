# Despliegue, SEO y GEO

`npm run build` deja un sitio estático en `dist/`. Sirve cualquier hosting con HTTPS (el micrófono lo exige).

## Vercel

Importar el repositorio alcanza: detecta Vite. `vercel.json` cachea `/assets/*` por un año (los nombres llevan hash).

## Dirección pública

El enlace canónico, `og:url`, la imagen para compartir y `sitemap.xml` necesitan una dirección absoluta:

- En Vercel se toma sola de `VERCEL_PROJECT_PRODUCTION_URL`.
- En otro hosting, compilar con `SITE_URL=https://tu-dominio npm run build`.

Sin dirección, esos elementos se omiten.

## Qué se genera (`seo.js`)

- Título, descripción, Open Graph y Twitter.
- Datos estructurados `WebApplication` y `FAQPage`.
- El contenido de la portada dentro del HTML, para quien no ejecuta JavaScript. React lo reemplaza al cargar.
- `robots.txt`, `sitemap.xml` y `llms.txt`.

Los textos salen de `src/i18n.ts`, así que no hay que actualizarlos en dos lados.

## Pendiente

- La versión en inglés no tiene dirección propia, así que los buscadores indexan solo la española.
- Después de publicar: dar de alta el sitio en Google Search Console y enviar el sitemap.
- La imagen `public/og.png` y los iconos PNG son archivos fijos: si cambia la marca, hay que rehacerlos.
