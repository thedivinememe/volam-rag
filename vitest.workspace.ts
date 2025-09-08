import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  // API tests - Node environment
  {
    test: {
      name: 'api',
      include: ['api/**/*.test.ts'],
      environment: 'node',
      setupFiles: ['api/src/test/setup.ts'],
    },
  },
  // UI tests - jsdom environment
  {
    test: {
      name: 'ui',
      include: ['ui/**/*.test.{ts,tsx}'],
      environment: 'jsdom',
      setupFiles: ['ui/src/test/setup.ts'],
      globals: true,
    },
  },
])
