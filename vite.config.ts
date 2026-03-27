import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import type { PluginOption } from 'vite'

const config = defineConfig({
  resolve: {
    dedupe: ['@convex-dev/auth', 'convex', 'react', 'react-dom'],
  },
  plugins: [
    devtools() as PluginOption,
    nitro() as PluginOption,
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }) as PluginOption,
    tailwindcss() as PluginOption,
    tanstackStart() as PluginOption,
    viteReact() as PluginOption,
  ],
})

export default config
