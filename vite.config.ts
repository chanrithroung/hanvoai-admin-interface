import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In development the Spring Boot API is proxied through Vite, so the dashboard and /v1 share one origin.
// The browser's Origin header is dropped on the way through: to the API these are same-origin calls, and this
// port doesn't need to be in CORS_ORIGINS.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/v1': {
        target: process.env.HANVO_API ?? 'http://localhost:8080',
        changeOrigin: true,
        configure: (proxy) => proxy.on('proxyReq', (req) => req.removeHeader('origin')),
      },
    },
  },
})
