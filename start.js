'use strict';
const path = require('path');
const { spawn } = require('child_process');

process.chdir(__dirname);

const PORT = String(parseInt(process.env.PORT || '9000', 10));
const medusaBin = path.join(__dirname, 'node_modules', '.bin', 'medusa');

process.stdout.write('[start.js] CWD: ' + process.cwd() + '\n');
process.stdout.write('[start.js] PORT: ' + PORT + '\n');

// Pass --port explicitly — medusa start reads port ONLY from this flag,
// not from process.env.PORT or from medusa-config http.port.
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
