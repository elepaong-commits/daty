import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rolldownOptions: {
      output: {
        // Libraries change far less often than app code, so they get their own long-cached chunk.
        // exifr is only needed when uploading and stays in its own lazy chunk; so do Motion's
        // animation features (see MotionProvider), which the first paint doesn't need.
        codeSplitting: {
          groups: [{ name: 'vendor', test: /node_modules[\\/](?!exifr|motion|framer-motion)/ }],
        },
      },
    },
  },
  server: {
    // Same-origin API calls in dev; the backend runs on :4000 (npm run dev in backend/)
    proxy: {
      '/api': 'http://127.0.0.1:4000',
    },
  },
})
