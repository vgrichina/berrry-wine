'use strict';
const fs = require('fs');
console.log(JSON.stringify({execPath: process.execPath, version: process.version,
  execArgv: process.execArgv, cwd: process.cwd(), limits: fs.readFileSync('/proc/self/limits','utf8'),
  env: { NODE_OPTIONS: process.env.NODE_OPTIONS || null, LANG: process.env.LANG || null,
    PATH: process.env.PATH, PALETTE_BROWSER_SUPERVISED: !!process.env.PALETTE_BROWSER_SUPERVISED }}));
