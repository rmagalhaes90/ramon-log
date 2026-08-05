import { spawn } from 'node:child_process';

const vite = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', '--config', 'vite.config.ts', '--host', '127.0.0.1'],
  {
    env: { ...process.env, VITE_USE_FIREBASE_EMULATORS: 'true' },
    stdio: 'inherit',
  },
);
vite.on('exit', (code) => process.exit(code ?? 0));
