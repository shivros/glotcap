import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    react(),
    viteTsConfigPaths({ projects: ['./tsconfig.json'] }),
  ] as any,
  test: {
    globals: true,
    environment: 'happy-dom',
    css: true,
    testTimeout: 20000,
    hookTimeout: 20000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/**/*.{ts,tsx}',
        'shared/**/*.ts',
        'convex/mediaTools.ts',
        'convex/mediaToolsActions.ts',
        'convex/mediaTools/**/*.ts',
        'convex/passwordReset.ts',
        'convex/passwordResetInternal.ts',
        'convex/lib/passwordResetAdapters.ts',
        'convex/userPreferences.ts',
        'convex/corrections.ts',
        'convex/vocabulary.ts',
        'convex/tts.ts',
        'convex/ttsStream.ts',
        'convex/costs/structuredOutputCostService.ts',
        'convex/speaking.ts',
        'convex/speakingPolicy.ts',
        'convex/sessionStateMachine.ts',
        'convex/speakingDomain.ts',
      ],
      exclude: [
        'src/routeTree.gen.ts',
        'src/**/*.d.ts',
        'convex/_generated/**',
      ],
      thresholds: {
        statements: 12,
        branches: 10,
        functions: 8,
        lines: 12,
      },
    },
  },
})
