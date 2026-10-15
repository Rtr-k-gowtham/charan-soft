import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['@dicebear/core', '@dicebear/collection'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://soft.cheransoftgoods.in',
        changeOrigin: true,
        secure: false,
      },
      '/backend': {
        target: 'https://soft.cheransoftgoods.in',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})

