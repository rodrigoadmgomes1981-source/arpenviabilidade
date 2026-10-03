import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `npm run build:single` gera um único index.html (útil para abrir sem servidor)
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  build: { chunkSizeWarningLimit: 1500, ...(mode === 'single' ? { assetsInlineLimit: 100000000, outDir: 'dist-single' } : {}) },
}))
