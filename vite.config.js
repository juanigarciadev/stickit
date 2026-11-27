import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { licenses } from './licenses.js'
import { seo } from './seo.js'

export default defineConfig({
  plugins: [react(), seo(), licenses()],
  // ffmpeg.wasm carga su worker con una ruta relativa que se rompe si Vite lo pre-empaqueta.
  optimizeDeps: { exclude: ['@ffmpeg/ffmpeg'] },
})
