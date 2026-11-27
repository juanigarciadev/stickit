// SEO y GEO (que buscadores y asistentes de IA entiendan la página sin ejecutar JavaScript).
// Todo sale de los mismos textos que usa la interfaz, para que no se desactualice.
import { texts } from './src/i18n.ts'

const t = texts.es
const NAME = 'StickIt'
const TITLE = t.documentTitle
const DESCRIPTION =
  'Creá stickers para WhatsApp desde fotos, GIFs y videos, con o sin sonido. Gratis, sin cuenta y sin subir tus archivos.'

// La dirección pública: SITE_URL, o la de producción que Vercel expone al compilar.
const host = process.env.VERCEL_PROJECT_PRODUCTION_URL
const SITE = (process.env.SITE_URL || (host ? `https://${host}` : '')).replace(/\/$/, '')

const escape = (value) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: NAME,
    description: DESCRIPTION,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web',
    inLanguage: ['es', 'en'],
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    featureList: t.landing.features.map((feature) => feature.title),
    author: { '@type': 'Person', name: 'Juan Ignacio García', url: 'https://github.com/juanigarciadev' },
    ...(SITE && { url: `${SITE}/`, image: `${SITE}/og.png` }),
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: t.landing.faq.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  },
]

/** Lo que se lee antes de que cargue React (y lo que ven los rastreadores sin JavaScript). */
const content = `
      <main style="max-width:48rem;margin:0 auto;padding:2rem 1rem;font-family:system-ui,sans-serif">
        <h1>${escape(`${t.landing.title} ${t.landing.highlight}`)}</h1>
        <p>${escape(t.landing.text)}</p>
        <h2>${escape(t.landing.featuresTitle)}</h2>
        <ul>${t.landing.features.map((f) => `<li><strong>${escape(f.title)}.</strong> ${escape(f.text)}</li>`).join('')}</ul>
        <h2>${escape(t.landing.stepsTitle)}</h2>
        <ol>${t.landing.steps.map((s) => `<li><strong>${escape(s.title)}.</strong> ${escape(s.text)}</li>`).join('')}</ol>
        <h2>${escape(t.landing.faqTitle)}</h2>
        ${t.landing.faq.map((f) => `<h3>${escape(f.question)}</h3><p>${escape(f.answer)}</p>`).join('')}
      </main>
    `

const meta = (key, value, attribute = 'name') => ({ tag: 'meta', attrs: { [attribute]: key, content: value } })
const link = (rel, href, extra = {}) => ({ tag: 'link', attrs: { rel, href, ...extra } })

const llms = `# ${NAME}

> ${DESCRIPTION}

${NAME} es una aplicación web que corre entera en el navegador: las fotos, videos y audios no se envían a ningún servidor.
La interfaz está en español e inglés. No está afiliada a WhatsApp.

## Qué hace
${t.landing.features.map((f) => `- ${f.title}: ${f.text}`).join('\n')}

## Cómo se usa
${t.landing.steps.map((s, i) => `${i + 1}. ${s.title}: ${s.text}`).join('\n')}

## Preguntas frecuentes
${t.landing.faq.map((f) => `### ${f.question}\n${f.answer}`).join('\n\n')}

## Enlaces
${SITE ? `- Aplicación: ${SITE}/\n` : ''}- Código fuente: https://github.com/juanigarciadev/stickit
- Componentes: https://blossomui.vercel.app/
`

export function seo() {
  return {
    name: 'stickit-seo',
    transformIndexHtml(html) {
      return {
        html: html.replace('<div id="root"></div>', () => `<div id="root">${content}</div>`),
        tags: [
          meta('description', DESCRIPTION),
          meta('theme-color', '#15803d'),
          meta('og:type', 'website', 'property'),
          meta('og:site_name', NAME, 'property'),
          meta('og:title', TITLE, 'property'),
          meta('og:description', DESCRIPTION, 'property'),
          meta('og:locale', 'es_AR', 'property'),
          meta('og:locale:alternate', 'en_US', 'property'),
          meta('twitter:card', SITE ? 'summary_large_image' : 'summary'),
          meta('twitter:title', TITLE),
          meta('twitter:description', DESCRIPTION),
          // Las redes piden direcciones absolutas: sin dominio conocido no se agregan.
          ...(SITE
            ? [
                link('canonical', `${SITE}/`),
                meta('og:url', `${SITE}/`, 'property'),
                meta('og:image', `${SITE}/og.png`, 'property'),
                meta('og:image:width', '1200', 'property'),
                meta('og:image:height', '630', 'property'),
                meta('twitter:image', `${SITE}/og.png`),
              ]
            : []),
          link('apple-touch-icon', '/apple-touch-icon.png'),
          link('manifest', '/site.webmanifest'),
          ...jsonLd.map((data) => ({
            tag: 'script',
            attrs: { type: 'application/ld+json' },
            children: JSON.stringify(data).replaceAll('<', '\\u003c'),
          })),
        ],
      }
    },
    generateBundle() {
      const emit = (fileName, source) => this.emitFile({ type: 'asset', fileName, source })
      emit('robots.txt', `User-agent: *\nAllow: /\n${SITE ? `\nSitemap: ${SITE}/sitemap.xml\n` : ''}`)
      emit('llms.txt', llms)
      if (SITE) {
        emit(
          'sitemap.xml',
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${SITE}/</loc></url>\n</urlset>\n`,
        )
      }
    },
  }
}
