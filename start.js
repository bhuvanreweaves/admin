'use strict';
const path = require('path');
const { spawn } = require('child_process');

process.chdir(__dirname);

const PORT = String(parseInt(process.env.PORT || '9000', 10));
const medusaBin = path.join(__dirname, 'node_modules', '.bin', 'medusa');

// Force production mode and explicit port
const env = Object.assign({}, process.env, {
  PORT: PORT,
  NODE_ENV: 'production',
});

process.stdout.write(JSON.stringify({ level: 'info', message: '[start.js] CWD: ' + process.cwd(), port: PORT, node: process.version }) + '\n');

// Pipe stderr through stdout as JSON so Hostinger's log viewer captures errors.
// medusa start crashes silently after migration scripts — we need to see why.
const child = spawn(medusaBin, ['start', '--port', PORT], {
  stdio: ['inherit', 'inherit', 'pipe'],
  cwd: __dirname,
  env: env,
});

child.stderr.on('data', function (chunk) {
  const lines = chunk.toString().split('\n');
  lines.forEach(function (line) {
    if (line.trim()) {
      process.stdout.write(JSON.stringify({ level: 'error', message: '[stderr] ' + line }) + '\n');
    }
  });
});

child.on('error', function (err) {
  process.stdout.write(JSON.stringify({ level: 'error', message: '[start.js] spawn failed: ' + err.message }) + '\n');
  process.exit(1);
});

child.on('exit', function (code, signal) {
  process.stdout.write(JSON.stringify({ level: 'error', message: '[start.js] medusa exited', code: code, signal: signal }) + '\n');
  process.exit(code == null ? 1 : code);
});
