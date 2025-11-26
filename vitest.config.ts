import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    environment: 'node',
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', '.next', 'dist', 'archive', 'scripts/**/*.test.ts'],
    testTimeout: 30000, // 30s for database operations
    coverage: {
      provider: 'v8',
      reporter: ["text", "lcov", "html"],
      exclude: [
        "**/tests/**",
        "**/scripts/**",
        "**/node_modules/**",
        "**/*.config.ts",
        "**/coverage/**",
        "**/.next/**"
      ]
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})