'use strict';
const fs = require('fs');
console.log(JSON.stringify({execPath:process.execPath, version:process.version, execArgv:process.execArgv, nodeOptions:process.env.NODE_OPTIONS, tmpdir:process.env.TMPDIR, limits:fs.readFileSync('/proc/self/limits','utf8'), memoryUsage:process.memoryUsage(), startup:'PASS'}));
