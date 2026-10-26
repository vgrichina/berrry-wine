const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const filename = path.resolve(__dirname, '../repo/lib/renderer-input.js');
const m = new Module(filename);
m.filename = filename;
m.paths = Module._nodeModulePaths(path.dirname(filename));
m._compile(fs.readFileSync(path.join(__dirname, 'baseline-renderer-input.js'), 'utf8'), filename);
require.cache[filename] = m;
