'use strict';
// Runs after medusa build+migrate to patch .medusa/server/ for Hostinger.
// Hostinger uses .medusa/server/ as the output directory, so it installs
// node_modules there and runs npm start from there — not from the project root.
// medusa build regenerates .medusa/server/package.json every time, so any
// manual edits to that file are lost. This script patches it post-build.
const fs = require('fs');
const path = require('path');

const serverDir = path.join(__dirname, '.medusa', 'server');

// 1. Write start.js into .medusa/server/ — works when run from that dir.
//    Checks both local (.medusa/server/node_modules) and parent node_modules
//    for the medusa binary since Hostinger may install in either location.
const startScript = `'use strict';
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const PORT = String(parseInt(process.env.PORT || '9000', 10));
const NODE_ENV = process.env.NODE_ENV || 'production';

// Hostinger may install node_modules in the output dir or the project root
const localBin  = path.join(__dirname, 'node_modules', '.bin', 'medusa');
const parentBin = path.join(__dirname, '..', '..', 'node_modules', '.bin', 'medusa');
const medusaBin = fs.existsSync(localBin) ? localBin : parentBin;

const env = Object.assign({}, process.env, { PORT: PORT, NODE_ENV: NODE_ENV });

process.stdout.write(JSON.stringify({
  level:   'info',
  message: '[server] starting medusa',
  port:    PORT,
  bin:     medusaBin,
  cwd:     __dirname,
  node:    process.version,
}) + '\\n');

// cwd = .medusa/server/ so medusa reads the compiled output, not TypeScript source
const child = spawn(medusaBin, ['start', '--port', PORT], {
  stdio: ['inherit', 'inherit', 'pipe'],
  cwd:   __dirname,
  env:   env,
});

child.stderr.on('data', function (chunk) {
  chunk.toString().split('\\n').forEach(function (line) {
    if (line.trim()) {
      process.stdout.write(JSON.stringify({ level: 'error', message: '[stderr] ' + line }) + '\\n');
    }
  });
});

child.on('error', function (err) {
  process.stdout.write(JSON.stringify({ level: 'error', message: '[spawn error] ' + err.message }) + '\\n');
  process.exit(1);
});

child.on('exit', function (code, signal) {
  process.stdout.write(JSON.stringify({
    level: 'error', message: '[server exited]', code: code, signal: signal,
  }) + '\\n');
  process.exit(code == null ? 1 : code);
});
`;

fs.writeFileSync(path.join(serverDir, 'start.js'), startScript);
console.log('post-build: wrote .medusa/server/start.js');

// 2. Patch .medusa/server/package.json — replace "medusa start" with "node start.js"
const pkgPath = path.join(serverDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.scripts = pkg.scripts || {};
pkg.scripts.start = 'node start.js';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
console.log('post-build: patched .medusa/server/package.json start → node start.js');

// 3. Copy medusa-config.js into .medusa/server/ so that when medusa start
//    runs with cwd=.medusa/server/ it can resolve the config (directory defaults
//    to cwd and medusa looks for medusa-config relative to that directory).
const configSrc  = path.join(__dirname, 'medusa-config.js');
const configDest = path.join(serverDir, 'medusa-config.js');
fs.copyFileSync(configSrc, configDest);
console.log('post-build: copied medusa-config.js → .medusa/server/medusa-config.js');
