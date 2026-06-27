'use strict';
const path = require('path');
const { spawn } = require('child_process');

// Force CWD to the project root so medusa can locate medusa-config.js
// and .medusa/server/ regardless of where Hostinger invokes npm start from.
process.chdir(__dirname);

const port = process.env.PORT || '9000';
const medusaBin = path.join(__dirname, 'node_modules', '.bin', 'medusa');

console.log('[start.js] CWD:', __dirname);
console.log('[start.js] PORT:', port);
console.log('[start.js] Starting medusa...');

const child = spawn(medusaBin, ['start'], {
  stdio: 'inherit',
  cwd: __dirname,
  env: { ...process.env, PORT: port },
});

child.on('error', (err) => {
  console.error('[start.js] Failed to start medusa process:', err.message);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code == null ? 1 : code);
});
