'use strict';
const path = require('path');

// Force CWD to project root so medusa-config.js and .medusa/server/ are always found
// regardless of which directory Hostinger invokes npm start from.
process.chdir(__dirname);

// Ensure PORT is set before any Medusa code loads
process.env.PORT = process.env.PORT || '9000';

console.log('[start.js] CWD: ' + process.cwd());
console.log('[start.js] PORT: ' + process.env.PORT);
console.log('[start.js] NODE_ENV: ' + (process.env.NODE_ENV || 'production'));

// Boot the compiled Medusa server directly.
// medusa start exits after migration scripts without binding HTTP in Hostinger.
// node .medusa/server/index.js is the correct production entry point per Medusa v2 docs:
// it runs pending migration scripts AND starts the HTTP server.
require(path.join(__dirname, '.medusa', 'server', 'index.js'));
