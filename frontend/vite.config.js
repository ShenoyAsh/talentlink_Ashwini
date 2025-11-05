import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Add this 'test' configuration
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.js', // We will create this file
  },
})