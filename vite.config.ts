import { defineConfig } from 'vite'
import { nitro } from 'nitro/vite'
import tailwindcss from '@tailwindcss/vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    nitro({
      preset: 'node-server',
      rollupConfig: {
        external: ['playwright', 'playwright-core'],
      },
    }),
    tailwindcss(),
    tsConfigPaths({ projects: ['./tsconfig.json'] }),
    tanstackStart({ srcDirectory: 'app' }),
    react(),
  ],
  ssr: {
    external: ['playwright', 'playwright-core'],
  },
  optimizeDeps: {
    exclude: ['playwright', 'playwright-core'],
  },
})
