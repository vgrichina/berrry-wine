const Module = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
const filename = path.resolve(__dirname, '../repo/test/test-keyboard-message-lparam.js');
const m = new Module(filename);
m.filename = filename;
m.paths = Module._nodeModulePaths(path.dirname(filename));
m._compile(fs.readFileSync(path.join(__dirname, 'legacy-keyboard-message-lparam.cjs'), 'utf8'), filename);
