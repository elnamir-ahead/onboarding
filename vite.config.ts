import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/confluence-api': {
        target: 'https://aheadcloudservices.atlassian.net/wiki/rest/api',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/confluence-api/, ''),
      },
    },
  },
})
