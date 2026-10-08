import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    // Same-origin API calls in dev; the backend runs on :4000 (npm run dev in backend/)
    proxy: {
      '/api': 'http://127.0.0.1:4000',
    },
  },
})
