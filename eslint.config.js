//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  {
    ignores: [
      '*.config.js',
      '.output/**',
      '.playwright-cli/**',
      '**/types/database.ts',
      'convex/_generated/**',
    ],
  },
  {
    files: ['src/components/**/*.tsx', 'src/routes/**/*.tsx'],
    ignores: [
      'src/components/ui/**',
      'src/components/app-surface.tsx',
      'src/components/component-example.tsx',
      'src/theme/**',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "JSXAttribute[name.name='className'] Literal[value=/var\\(--glotcap-/]",
          message:
            'Use semantic classes from `@/theme/semantic` instead of raw `--glotcap-*` tokens in feature surfaces.',
        },
      ],
    },
  },
  ...tanstackConfig,
]
