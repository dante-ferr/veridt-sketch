import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// O browser fala com o Vite. /v1 (HTTP e WebSocket) segue para o proxy TLS do Compose.
// secure: false aceita o certificado autoassinado de https://localhost:8443.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/v1': {
        target: 'https://localhost:8443',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
})
