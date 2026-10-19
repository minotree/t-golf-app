import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e', timeout: 30000, workers: 1,
  use: { baseURL: process.env.PWA_TEST_URL || 'http://127.0.0.1:4173', channel: process.env.PWA_BROWSER || 'chrome', headless: true,
    launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] } },
  webServer: process.env.PWA_TEST_URL ? undefined : { command: 'node ../../node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173 --strictPort', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI },
});
