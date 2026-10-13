// Separate runner for the evaluation (not part of `npm test`): npm run form-eval
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tools/form-eval/**/*.eval.ts'],
    testTimeout: 30 * 60_000,
    // Print the report.
    silent: false,
  },
})
