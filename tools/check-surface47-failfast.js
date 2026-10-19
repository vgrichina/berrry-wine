#!/usr/bin/env node
'use strict';
// Source contract only: runtime ABI/conformance remains a separate guest test.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const table = JSON.parse(read('src/api_table.json'));
const dispatch = read('src/09b2-dispatch-table.generated.wat');
const methods = [
  ['IDirectDrawSurface4_SetPrivateData', 5],
  ['IDirectDrawSurface4_GetPrivateData', 4],
  ['IDirectDrawSurface4_FreePrivateData', 2],
  ['IDirectDrawSurface4_GetUniquenessValue', 2],
  ['IDirectDrawSurface4_ChangeUniquenessValue', 1],
  ['IDirectDrawSurface7_SetPriority', 2],
  ['IDirectDrawSurface7_GetPriority', 2],
  ['IDirectDrawSurface7_SetLOD', 2],
  ['IDirectDrawSurface7_GetLOD', 2],
];
for (const [offset, [name, nargs]] of methods.entries()) {
  const id = 4581 + offset, api = table[id];
  assert.strictEqual(api.id, id);
  assert.strictEqual(api.name, name);
  assert.strictEqual(api.nargs, nargs);
  assert.strictEqual(api.convention, 'stdcall');
  assert.strictEqual(api.handler, 'ftm_unimplemented');
  assert.strictEqual(api.stub, undefined);
  const marker = `) ;; ${id}: ${name}\n`;
  const start = dispatch.indexOf(marker);
  assert(start >= 0, name);
  assert.strictEqual(dispatch.slice(start + marker.length).split('\n')[0].trim(),
    '(call $handle_ftm_unimplemented (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))');
}
const ole = read('src/09a7b-ole.wat');
assert.match(ole, /\(func \$handle_ftm_unimplemented[^\n]*\n\s*\(call \$crash_unimplemented \(local.get \$name_ptr\)\)\)/);
assert.match(read('src/10-helpers.wat'), /\(func \$crash_unimplemented \(param \$name_ptr i32\)\s*\(call \$host_crash_unimplemented \(local.get \$name_ptr\)[^\n]+\n\s*\(unreachable\)\)/);
console.log('Surface4/7 fail-fast source contract: nine stable IDs/prototypes, original name_ptr, unchanged guest frame, no return');
