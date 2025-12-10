import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3004,
    strictPort: true, // 🔒 NÃO MUDA DE PORTA! Dá erro se 3004 estiver ocupada
    watch: {
      usePolling: true,
    },
  },
  optimizeDeps: {
    include: ['react-color'],
  },
})
