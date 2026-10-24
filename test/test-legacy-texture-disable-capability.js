#!/usr/bin/env node
'use strict';
// Reuse the authentic one-page fixture and byte-exact production excerpts.
// Capability claims must agree with operation semantics, not just a mask literal.
const fs = require('fs'), path = require('path'), Module = require('module');
const file = path.join(__dirname, 'test-legacy-texture-operation-caps.js');
const source = fs.readFileSync(file, 'utf8');
const boundary = source.indexOf('\ntry {\n  const f = makeFixture(assembled);');
if (boundary < 0) throw Error('fixture boundary missing');
const probe = String.raw`
function contract(f) {
  const p = 512;
  new Uint8Array(f.e.memory.buffer, p - 4, 244).fill(0xa5);
  f.e.d3dim_fill_device_desc7(p);
  const mask = f.dv.getUint32(p + 180, true);
  // D3DTEXOPCAPS flags correspond to the D3DTOP operation's ordinal minus one.
  const supportedOps = [1, 2, 3, 4]; // DISABLE, SELECTARG1/2, MODULATE only.
  for (const op of supportedOps)
    assert(mask & (1 << (op - 1)), 'missing supported operation ' + op);
  const proven = supportedOps.reduce((bits, op) => bits | (1 << (op - 1)), 0);
  assert.equal(mask & ~proven, 0, 'unsupported operation advertised');
  assert.equal(f.dv.getUint32(p - 4, true), 0xa5a5a5a5);
  assert.equal(f.dv.getUint32(p + 236, true), 0xa5a5a5a5);
  assert.equal(f.dv.getUint16(p + 184, true), 1, 'one blend stage only');
  assert.equal(f.dv.getUint16(p + 186, true), 1, 'one simultaneous texture only');
  // Nonwhite texture and unequal alpha distinguish DISABLE from MODULATE
  // and independent alpha evaluation. Exercise both actual software routes.
  for (const alpha of [1, 2, 3, 4]) {
    f.setOps(1, alpha);
    assert.equal(f.e.d3dim_texture_stage_combine(tex, diffuse, 1, alpha) >>> 0,
      diffuse, 'advertised DISABLE must preserve diffuse RGBA');
    f.softwareUnbound();
  }
  supported(f); // Existing independent SELECTARG1/2/MODULATE pixel oracle.
  return mask;
}
const result = contract(makeFixture(assembled));
const writer = forms[0];
const maskStore = /\(i32\.store \(i32\.add \(local\.get \$wa\) \(i32\.const 180\)\) \(i32\.const (0x[0-9a-f]+|\d+)\)\)/i;
assert(maskStore.test(writer), 'authentic capability store missing');
function rejectContract(label, changed, pattern) {
  assert.notEqual(changed, assembled, 'mutation must affect authentic excerpt');
  assert.throws(() => contract(makeFixture(changed)),
    e => e instanceof assert.AssertionError && pattern.test(e.message), label);
  receipts.controls.push(label);
}
for (const op of [5, 6, 7, 10, 26, 32]) {
  const changedWriter = writer.replace(maskStore, store => store.replace(
    /\(i32\.const (?:0x[0-9a-f]+|\d+)\)\)$/i,
    '(i32.const ' + ((result | (1 << (op - 1))) >>> 0) + '))'));
  rejectContract('unsupported capability ' + op, assembled.replace(writer, changedWriter),
    /unsupported operation advertised/);
}
const missingSemantics = assembled.replace(
  '(if (i32.eq (i32.and (local.get $colorop) (i32.const 255)) (i32.const 1))',
  '(if (i32.const 0)');
rejectContract('advertised DISABLE without semantics', missingSemantics,
  /advertised DISABLE must preserve diffuse RGBA/);
receipts.status = 'PASS'; receipts.capabilityMask = result;
if (process.env.LEGACY_DISABLE_CAPABILITY_RECEIPT)
  fs.writeFileSync(process.env.LEGACY_DISABLE_CAPABILITY_RECEIPT, JSON.stringify(receipts, null, 2) + '\n');
console.log('PASS capability/operation contract: authentic writer, DISABLE RGBA/routes, enabled pixels, 7 rejecting controls');
`;
const m = new Module(file, module);
m.filename = file; m.paths = Module._nodeModulePaths(path.dirname(file));
m._compile(source.slice(0, boundary) + '\n' + probe, file);
