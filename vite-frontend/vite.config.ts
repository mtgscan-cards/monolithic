// vite-frontend/vite.config.ts

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import Inspect from 'vite-plugin-inspect';

export default defineConfig({
  plugins: [
    react(),
    Inspect(),
  ],
  build: {
    modulePreload: { polyfill: false },
    target: 'esnext',
  },
  esbuild: {
    target: 'esnext',
  },
});