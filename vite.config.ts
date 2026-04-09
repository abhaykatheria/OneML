import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/OneML/',
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    exclude: ['pyodide']
  },
  worker: { format: 'es' }
})
