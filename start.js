'use strict';
const path = require('path');
const { spawn } = require('child_process');

// Ensure we're in the project root
process.chdir(__dirname);

const PORT    = String(parseInt(process.env.PORT || '9000', 10));
// medusa start must run from .medusa/server/ (the compiled output directory).
// When run from the project root it sees TypeScript source and exits after
// migration scripts without starting HTTP. Running from the compiled dir
// makes it serve the pre-built output and bind the HTTP server correctly.
const serverDir = path.join(__dirname, '.medusa', 'server');
// Use the project root's medusa binary (absolute path — not relative to cwd).
const medusaBin = path.join(__dirname, 'node_modules', '.bin', 'medusa');

const env = Object.assign({}, process.env, {
  PORT:     PORT,
  NODE_ENV: 'production',
});

process.stdout.write(JSON.stringify({
  level: 'info',
  message: '[start.js] spawning medusa start',
  cwd: serverDir,
  port: PORT,
  node: process.version,
}) + '\n');

const child = spawn(medusaBin, ['start', '--port', PORT], {
  stdio: ['inherit', 'inherit', 'pipe'],
  cwd:   serverDir,   // ← KEY: run from compiled output, not project root
  env:   env,
});

// Pipe stderr as JSON so Hostinger's log viewer captures it
child.stderr.on('data', function (chunk) {
  chunk.toString().split('\n').forEach(function (line) {
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
