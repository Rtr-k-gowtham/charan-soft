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
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('@dicebear')) {
              return 'vendor-dicebear';
            }
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react';
            }
            return 'vendor';
          }
        },
      },
    },
  },
})

