#!/usr/bin/env node
'use strict';
// Exercise the shipped page's actual ordering, without a DOM or GPU. A manual
// browser fixture can accidentally hide a missing dependency by injecting it.
// D3D8/9 run only on the GPU stream v2 executors since the old JS D3D9 path
// (d3d9-host / d3d9-backend) was deleted (d3d9-retire S4); this pins the
// software executor's factory dependencies.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/"(lib\/(?:gpu-backend|gpu-stream[^"/]*|render-clear|d3d[^"/]+)\.js)"/g)].map(m => m[1]);
for (const gone of ['lib/d3d9-host.js', 'lib/d3d9-backend.js'])
  assert(!scripts.includes(gone), `page must not load the deleted ${gone}`);
assert(scripts.includes('lib/render-clear.js'), 'page must load clear validation');
assert(scripts.indexOf('lib/render-clear.js') < scripts.indexOf('lib/d3d9-software-backend.js'),
  'clear validation must exist when the software factory evaluates');
assert(scripts.includes('lib/d3d-command-stream.js'), 'page must load the D3DIM command stream');
assert(scripts.includes('lib/d3d-geometry-batches.js'), 'page must load geometry packing');
assert(scripts.indexOf('lib/d3d-geometry-batches.js') < scripts.indexOf('lib/d3d9-software-backend.js'),
  'geometry packing must exist when software factory evaluates');
assert(scripts.indexOf('lib/d3d-shader-ir.js') < scripts.indexOf('lib/d3d9-software-backend.js'),
  'shader IR must exist when software factory evaluates');
const context = vm.createContext({ console, performance });
for (const file of scripts) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename:file });
vm.runInContext(`
  if (typeof D3D9SoftwareBackend.Device !== 'function')
    throw new Error('shipped software backend did not evaluate its Device');
  if (typeof D3DCommandStream.Encoder !== 'function')
    throw new Error('shipped D3DIM command stream did not evaluate its Encoder');
`, context);
console.log('PASS shipped browser D3D dependency order');
