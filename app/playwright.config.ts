// End-to-end tests of real user flows in real browser engines. WebKit (Safari's engine) at iPhone size is
// the closest stand-in for the installed iPhone app; Chromium at Android size covers Chrome.
// Files are *.e2e.ts so Vitest (unit tests) doesn't pick them up.
import { defineConfig, devices } from '@playwright/test'

const PORT = 4180

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // CI machines have 2 CPUs and software WebGL: run one test at a time so the pose-model tests don't starve.
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/gymbro/`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'iphone-webkit', use: { ...devices['iPhone 15'] } },
    {
      name: 'android-chromium',
      use: {
        ...devices['Pixel 7'],
        // A fake camera for the pose tests (e2e/assets.e2e.ts); harmless for the others. On a Mac, use the real GPU:
        // headless Chromium otherwise falls back to software WebGL, about 8× slower for pose detection.
        launchOptions: {
          args: [
            '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
            ...(process.platform === 'darwin' ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : []),
          ],
        },
      },
    },
  ],
  // Production build served like GitHub Pages (under /gymbro/), including the service worker.
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    env: { BASE_PATH: '/gymbro/' },
    url: `http://localhost:${PORT}/gymbro/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
