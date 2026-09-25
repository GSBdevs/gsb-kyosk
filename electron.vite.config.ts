import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'

export default defineConfig({
  main: {
    build: {
      lib: { entry: resolve(__dirname, 'src/main/index.ts') },
      rollupOptions: { output: { format: 'es' } }
    }
  },
  preload: {
    build: {
      lib: { entry: resolve(__dirname, 'src/preload/index.ts') },
      rollupOptions: { output: { format: 'es' } }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    // Serve o config/ e a mídia como estáticos para permitir verificação no navegador (modo web).
    publicDir: resolve(__dirname, 'public'),
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') }
      }
    },
    resolve: {
      alias: { '@': resolve(__dirname, 'src/renderer/src') }
    }
  }
})
