import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import Inspect from 'vite-plugin-inspect'
import cssnano from 'cssnano'
import type { Connect } from 'vite'

const simulateImageLag = () => ({
  name: 'simulate-image-lag',
  configureServer(server: any) {
    const middleware: Connect.NextHandleFunction = (req, _res, next) => {
      if (req?.url?.startsWith('/cards/') && req.url.endsWith('.webp')) {
        setTimeout(next, 300)
      } else {
        next()
      }
    }
    server.middlewares.use(middleware)
  },
})

export default defineConfig({
  plugins: [
    react(),
    Inspect(),
    simulateImageLag(),
  ],
  css: {
    postcss: {
      plugins: [
        cssnano({
          preset: 'default',
        }),
      ],
    },
  },
  build: {
    cssCodeSplit: true,
    minify: 'terser',
  },
  esbuild: {
    treeShaking: true,
  },
  server: {
    fs: { strict: true },
  },
})
