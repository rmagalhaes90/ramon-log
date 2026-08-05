import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

assert.equal(
  process.env.FIREBASE_AUTH_EMULATOR_HOST,
  '127.0.0.1:9099',
  'Refusing to run without the local Auth Emulator',
);
assert.equal(
  process.env.FIRESTORE_EMULATOR_HOST,
  '127.0.0.1:8080',
  'Refusing to run without the local Firestore Emulator (needed once the user is verified and signed in)',
);

const vite = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', '--config', 'vite.config.ts', '--host', '127.0.0.1'],
  {
    env: { ...process.env, VITE_USE_FIREBASE_EMULATORS: 'true' },
    stdio: ['ignore', 'pipe', 'inherit'],
  },
);

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch('http://127.0.0.1:5173');
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Vite did not start');
}

try {
  await waitForServer();
  const playwright = spawn(
    process.execPath,
    ['node_modules/@playwright/test/cli.js', 'test', 'share-emulator.spec.ts'],
    { stdio: 'inherit' },
  );
  const exitCode = await new Promise((resolve) => playwright.on('exit', resolve));
  if (exitCode !== 0) process.exitCode = typeof exitCode === 'number' ? exitCode : 1;
} finally {
  vite.kill();
}
