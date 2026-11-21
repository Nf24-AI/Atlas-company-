// Browser smoke / e2e tests. Two servers: the local app (DEMO mode, temp state, no keys)
// and the built static GitHub Pages demo.
import {defineConfig, devices} from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

const APP_PORT = 3199, DEMO_PORT = 4199;
const tmp = path.join(os.tmpdir(), `atlas-e2e-${process.pid}`);
const AUTH = 'test-results/.auth-state.json';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {baseURL: `http://127.0.0.1:${APP_PORT}`, trace: 'retain-on-failure'},
  webServer: [
    {
      command: 'node server.js',
      url: `http://127.0.0.1:${APP_PORT}/api/health`,
      reuseExistingServer: false,
      env: {PORT: String(APP_PORT), HOST: '127.0.0.1', ATLAS_DATA_DIR: tmp, STATE_FILE: path.join(tmp, 'state.json'), GROQ_API_KEY: '', DEEPSEEK_API_KEY: '', ATLAS_E2E: '1'},
    },
    {
      command: `node scripts/build-demo.mjs dist-e2e && node scripts/serve-static.mjs dist-e2e ${DEMO_PORT}`,
      url: `http://127.0.0.1:${DEMO_PORT}/index.html`,
      reuseExistingServer: false,
    },
  ],
  projects: [
    // Creates the CEO account through the UI once and stores the session for the other projects.
    {name: 'setup', testMatch: /auth\.setup\.mjs/},
    ...[['chromium', 'Desktop Chrome'], ['firefox', 'Desktop Firefox'], ['webkit', 'Desktop Safari']].map(([name, device]) =>
      ({name, use: {...devices[device], storageState: AUTH}, dependencies: ['setup'], testMatch: /\.spec\.mjs/})),
    {name: 'mobile-chromium', use: {...devices['Pixel 7'], storageState: AUTH}, dependencies: ['setup'], testMatch: /\.spec\.mjs/, grep: /@mobile/},
  ],
});
