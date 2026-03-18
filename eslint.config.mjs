import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'

export default defineConfig([
  ...nextVitals,
  {
    rules: {
      // This repo still uses a few effect-driven hydration/fetch patterns that are valid,
      // but the new rule treats them as hard errors. Keep lint stable until those screens
      // are refactored more systematically.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'coverage/**',
    'docs/screenshots/**',
    'agent/dist/**',
    'public/**',
    'next-env.d.ts',
  ]),
])
