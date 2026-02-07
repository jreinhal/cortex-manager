import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import packageJson from '../package.json' assert { type: 'json' }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(packageJson.version)
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'motion-vendor': ['framer-motion'],
          'ui-vendor': ['lucide-react'],
          'style-vendor': ['clsx', 'tailwind-merge']
        }
      }
    }
  }
})
