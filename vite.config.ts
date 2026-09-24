import { resolve } from 'node:path'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        algorithms: resolve(import.meta.dirname, 'algorithms.html'),
        scriptText: resolve(import.meta.dirname, 'script-text.html'),
        scriptVisual: resolve(import.meta.dirname, 'script-visual.html'),
        scriptVisual2: resolve(import.meta.dirname, 'script-visual-2.html'),
      },
    },
  },
})
