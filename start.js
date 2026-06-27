'use strict';
const path = require('path');
const { spawn } = require('child_process');

// Force CWD to project root
process.chdir(__dirname);

const PORT = String(parseInt(process.env.PORT || '9000', 10));
const medusaBin = path.join(__dirname, 'node_modules', '.bin', 'medusa');

process.stdout.write('[start.js] CWD: ' + process.cwd() + '\n');
process.stdout.write('[start.js] PORT: ' + PORT + '\n');
process.stdout.write('[start.js] NODE_ENV: ' + (process.env.NODE_ENV || 'production') + '\n');

// Spawn medusa start with explicit --port flag.
// This is the documented Medusa v2 way to set the HTTP binding port.
// We also inject PORT in env so medusa-config.js picks it up as fallback.
const child = spawn(medusaBin, ['start', '--port', PORT], {
  stdio: 'inherit',
  cwd: __dirname,
  env: Object.assign({}, process.env, { PORT: PORT }),
});

child.on('error', function (err) {
  process.stderr.write('[start.js] spawn error: ' + err.message + '\n');
  process.exit(1);
});

child.on('exit', function (code) {
  process.exit(code == null ? 1 : code);
});
