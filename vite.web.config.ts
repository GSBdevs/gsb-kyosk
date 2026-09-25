import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// Config Vite puro para verificar o renderer no navegador (sem Electron).
// A bridge window.kyosk não existe aqui; o app cai para fetch de arquivos estáticos.
export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  publicDir: resolve(__dirname, 'public'),
  resolve: {
    alias: { '@': resolve(__dirname, 'src/renderer/src') }
  },
  server: { port: 5174, strictPort: true }
})
