// Genera /licencias.txt: los avisos que piden las licencias de todo lo que se distribuye con la web.
import { existsSync, readFileSync, readdirSync } from 'node:fs'

const FILE = 'licencias.txt'
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const json = (path) => JSON.parse(read(path))

/** Las dependencias de la aplicación y las de ellas (las de desarrollo no se distribuyen). */
function dependencies() {
  const found = new Map()
  const pending = Object.keys(json('./package.json').dependencies)
  while (pending.length) {
    const name = pending.pop()
    const folder = `./node_modules/${name}`
    if (found.has(name) || name.startsWith('@types/') || !existsSync(new URL(`${folder}/package.json`, import.meta.url))) {
      continue
    }
    const info = json(`${folder}/package.json`)
    found.set(name, { ...info, folder })
    pending.push(...Object.keys(info.dependencies ?? {}))
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name))
}

function notices() {
  const packages = dependencies().map(({ name, version, license, repository, folder }) => {
    const file = readdirSync(new URL(`${folder}/`, import.meta.url)).find((entry) => /^(licen[sc]e|copying)/i.test(entry))
    const url = (typeof repository === 'string' ? repository : repository?.url)?.replace(/^git\+|\.git$/g, '')
    // Los paquetes de ffmpeg.wasm no incluyen su licencia: se guarda una copia de la de su repositorio.
    const wasm = /^@ffmpeg\/(ffmpeg|util|types)$/.test(name) ? './licenses/ffmpeg.wasm.txt' : null
    const text = file ? `${folder}/${file}` : wasm
    return [
      `${name} ${version} (${license})`,
      url && `Código fuente / Source: ${url}`,
      text ? read(text).trim() : 'Texto completo: la GPL al final / Full text: the GPL below.',
    ]
      .filter(Boolean)
      .join('\n')
  })

  const core = json('./node_modules/@ffmpeg/core/package.json').version
  const separator = `\n\n${'-'.repeat(78)}\n\n`

  return [
    `StickIt
Copyright (C) 2026 Juan Ignacio García

Software libre bajo GNU GPL v3 o posterior, SIN NINGUNA GARANTÍA. El texto completo está al final.
Free software under the GNU GPL v3 or later, WITHOUT ANY WARRANTY. Full text at the end.

Código fuente / Source code: https://github.com/juanigarciadev/stickit

FFmpeg
Esta aplicación distribuye @ffmpeg/core ${core}, una compilación de FFmpeg (con x264 y otras bibliotecas) a WebAssembly,
bajo GPL-2.0-or-later. Su código fuente y las versiones de cada biblioteca están en:
This application ships @ffmpeg/core ${core}, a WebAssembly build of FFmpeg (with x264 and other libraries) under
GPL-2.0-or-later. Its source and the version of each library:
  https://github.com/ffmpegwasm/ffmpeg.wasm/tree/v${core}   (ver / see Dockerfile)
  https://github.com/FFmpeg/FFmpeg/tree/n5.1.4
  https://github.com/ffmpegwasm/x264/tree/4-cores`,
    ...packages,
    `GNU General Public License, version 3\n\n${read('./LICENSE').trim()}`,
  ].join(separator)
}

export function licenses() {
  return {
    name: 'stickit-licenses',
    configureServer(server) {
      server.middlewares.use(`/${FILE}`, (_request, response) => {
        response.setHeader('Content-Type', 'text/plain; charset=utf-8')
        response.end(notices())
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: FILE, source: notices() })
    },
  }
}
