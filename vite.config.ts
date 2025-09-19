import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/proxy': {
        target: 'https://internal-ai-gateway.ancestryl1.int',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/proxy/, ''),
        secure: false,
      },
      '/v1': {
        target: 'https://internal-ai-gateway.ancestryl1.int',
        changeOrigin: true,
        secure: false,
      },
      '/api/models': {
        target: 'https://internal-ai-gateway.ancestryl1.int',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/models/, '/v1/models'),
        secure: false,
      },
      '/api/chat': {
        target: 'https://internal-ai-gateway.ancestryl1.int',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/chat/, '/v1/chat/completions'),
        secure: false,
      }
    },
    cors: true
  }
})
