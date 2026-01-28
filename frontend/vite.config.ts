import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    strictPort: true,
    allowedHosts: [
      'mcp-chatbot.local.shadyknollcave.io',
      '.local.shadyknollcave.io',
      '.shadyknollcave.io'
    ],
    // Allow Vite to access files in parent directory
    fs: {
      allow: ['..']
    },
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY || 'http://backend:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    },
    // Inline all assets for air-gap deployment
    assetsInlineLimit: 100000000
  }
})
