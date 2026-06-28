'use strict';
const path = require('path');

const PORT      = parseInt(process.env.PORT || '9000', 10);
const directory = path.join(__dirname, '.medusa', 'server');

process.stdout.write(JSON.stringify({
  level:     'info',
  message:   '[start.js] invoking medusa start',
  port:      PORT,
  directory: directory,
  cwd:       process.cwd(),
  node:      process.version,
}) + '\n');

// Call medusa's start() directly with an explicit directory so it finds:
//   - medusa-config.js at  directory/medusa-config.js
//   - admin build at       directory/public/admin/index.html
// This avoids all spawn / binary-path / CWD resolution issues.
require('@medusajs/medusa/commands/start')
  .default({ port: PORT, directory: directory })
  .catch(function (err) {
    process.stdout.write(JSON.stringify({
      level:   'error',
      message: '[start.js] medusa start failed: ' + (err && err.message),
      stack:   err && err.stack,
    }) + '\n');
    process.exit(1);
  });
