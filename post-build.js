'use strict';
// Runs after medusa build+migrate to patch .medusa/server/ for Hostinger.
// Hostinger uses .medusa/server/ as the output directory, so it installs
// node_modules there and runs npm start from there — not from the project root.
// medusa build regenerates .medusa/server/package.json every time, so any
// manual edits to that file are lost. This script patches it post-build.
const fs = require('fs');
const path = require('path');

const serverDir = path.join(__dirname, '.medusa', 'server');

// 1. Write start.js into .medusa/server/.
//    Calls medusa's start() directly with directory=__dirname (.medusa/server/).
//    No spawning — avoids binary-path and CWD resolution issues entirely.
//    Node resolves require('@medusajs/medusa/...') up the directory tree to
//    the project root's node_modules, whichever CWD Hostinger uses.
const startScript = `'use strict';
const path = require('path');

const PORT      = parseInt(process.env.PORT || '9000', 10);
const directory = __dirname; // = .medusa/server/ at runtime

process.stdout.write(JSON.stringify({
  level:     'info',
  message:   '[server/start.js] invoking medusa start',
  port:      PORT,
  directory: directory,
  cwd:       process.cwd(),
  node:      process.version,
}) + '\\n');

// Call medusa start() directly so it finds medusa-config.js and the admin
// build at directory/medusa-config.js and directory/public/admin/index.html.
require('@medusajs/medusa/commands/start')
  .default({ port: PORT, directory: directory })
  .catch(function (err) {
    process.stdout.write(JSON.stringify({
      level:   'error',
      message: '[server/start.js] medusa start failed: ' + (err && err.message),
      stack:   err && err.stack,
    }) + '\\n');
    process.exit(1);
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
