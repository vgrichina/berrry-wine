'use strict';
// Cheap diagnosis regression: production DOM bridge -> renderer -> host ->
// optional Worker RPC bitmap -> compiled production GetDeviceState. No game
// is launched. The existing fixtures supply DOM scaffolding and WAT dependency
// extraction, not keyboard algorithms. Run both modes: node this-file [--rpc].
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Module = require('node:module');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
for (const arg of process.argv.slice(2)) assert(
  ['--rpc', '--control-ack-only', '--control-stale-bitmap'].includes(arg),
  'unexpected option: ' + arg);
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const crypto = require('node:crypto');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const gamePath = 'test/binaries/candidates/tomb-raider-2-demo/game/TOMB2.EXE';
const game = require('../lib/pe').readPE(path.join(root, gamePath));
assert.equal(hash(game.buf), '0811efa84bfab8c458b9e29976088152db4c14601a99ca4910c75a2d009233aa');
const bytes = (va, length) => game.buf.subarray(game.va2off(va), game.va2off(va) + length);
function instruction(va, hex) {
  assert.equal(bytes(va, hex.length / 2).toString('hex'), hex, 'game bytes at ' + va.toString(16));
}
// Static trace of this exact executable. These assertions verify instructions;
// they do not execute the game or establish a poll in the retained original.
instruction(0x4471fc, '57680001000050ff5124'); // GetDeviceState(this,256,out)
instruction(0x44d2b1, '6878b05100e8359fffff'); // input update passes DIK buffer
instruction(0x44d1b2, '849678b05100');          // configured key high-bit test
instruction(0x44d1c1, '6681f99d00');            // right Ctrl -> left fallback
instruction(0x44d1d1, '6683f91d');              // left Ctrl -> right fallback
instruction(0x44d3bf, '6a08e8bafdffff');         // action index 8
instruction(0x44d3cd, '83cb40');                // sets Action mask 0x40
assert.equal(bytes(0x467ef8 + 8 * 2, 2).readUInt16LE(), 0x9d, 'default Action right Ctrl');
console.log(JSON.stringify({staticGame:gamePath,sha256:hash(game.buf),
  getDeviceState:'0x447203',inputUpdate:'0x44d2a0',dikBuffer:'0x51b078',
  keyTest:'0x44d180',actionIndex:8,defaultDik:157,actionMask:64,
  note:'static instructions and file defaults; saved binding and original-time polling unobserved'}));

// Reuse only the DOM fixture scaffolding and real callback wiring. Its old
// renderer hash is historical acceptance, not authority for today's sources.
const domSource = read('test/keyboard-focus-renderer-repaired-pin-oct26.test.cjs');
const domEnd = domSource.indexOf('\n// Expectations come from');
assert(domEnd > 0, 'DOM fixture boundary');
const domModule = { exports: {} };
assert(!process.env.BROWSER_INPUT_SOURCE && !process.env.RENDERER_INPUT_SOURCE,
  'diagnosis must read current production input sources');
let domHarness = domSource.slice(0, domEnd);
const historicalPins = /^assert\.equal\(hash\((?:source|rendererSource)\), '[0-9a-f]{64}'\);$/gm;
assert.equal([...domHarness.matchAll(historicalPins)].length, 2);
domHarness = domHarness.replace(historicalPins, '');
vm.runInNewContext(domHarness + '\nmodule.exports = fixture;', {
  require: Module.createRequire(path.join(root, 'test/keyboard-focus-renderer-repaired-pin-oct26.test.cjs')),
  module: domModule, __dirname: path.join(root, 'test'), process, WebAssembly,
}, { filename: 'tr2-dom-fixture', timeout: 1000 });
const fixture = domModule.exports();

// Extract the actual browser publication function, including its live physical
// state selection. Do not invent a key bitmap in the test.
const bitmapMethod = read('host.js').match(/  _workerKeyBitmap\(\) \{[\s\S]*?\n  \}/);
assert(bitmapMethod, 'production Worker bitmap method');
const Bitmap = vm.runInNewContext('(class {' + bitmapMethod[0] + '})');
const bitmap = new Bitmap();
bitmap.renderer = fixture.renderer;

const fixturePath = path.join(root, 'test/test-directinput-buffered-keyboard.js');
const watSource = fs.readFileSync(fixturePath, 'utf8');
const watEnd = watSource.indexOf('\nconst events=[];');
assert(watEnd > 0, 'compiled production fixture boundary');
let harness = watSource.slice(0, watEnd);
const pickBoundary = 'const picked=new Map(),stubs=new Map();';
assert.equal(harness.split(pickBoundary).length, 2);
harness = harness.replace(pickBoundary, "funcs.add('$di_standard_data_format_size');\n" + pickBoundary);
const exportBoundary = '(func (export "entry")';
assert.equal(harness.split(exportBoundary).length, 2);
harness = harness.replace(exportBoundary,
  '(func (export "formatSize") (param i32 i32) (result i32) (call $di_standard_data_format_size (local.get 0) (local.get 1)))\n' + exportBoundary);
// The shared fixture normally applies test/run.js's CLI override. Exercise the
// browser's unmodified createWindowHost imports here instead.
const cliOverride = "require('vm').runInNewContext(wiring,{h:host,renderer});";
assert.equal(harness.split(cliOverride).length, 2);
harness = harness.replace(cliOverride, '');
const publication = 'publishBoundary=()=>broker.publish({});';
assert.equal(harness.split(publication).length, 2);
harness = harness.replace(publication,
  'publishBoundary=()=>broker.publish({keys: module.actionBitmap._workerKeyBitmap()});');
const testModule = new Module(fixturePath, module);
testModule.filename = fixturePath;
testModule.paths = Module._nodeModulePaths(path.dirname(fixturePath));
testModule.actionFixture = fixture;
testModule.actionBitmap = bitmap;
testModule.actionFormat = { header: bytes(0x458640, 24), objects: bytes(0x457640, 4096) };
testModule._compile(harness + `
// ctx is captured by the actual host imports, which also serve RPC calls.
ctx.renderer = module.actionFixture.renderer;
ctx.getMemory = () => memory.buffer;
const f = module.actionFixture;
const checks = [];
new Uint8Array(memory.buffer).set(module.actionFormat.header,e.g2w(0x458640));
new Uint8Array(memory.buffer).set(module.actionFormat.objects,e.g2w(0x457640));
assert.equal(e.formatSize(e.entry(),0x458640),256,'actual game format selects standard keyboard path');
checks.push('actual game DIDATAFORMAT validates as standard keyboard');
function state() {
  wr(e.reg()+16,0x30000);
  e.getState(obj,256,buf);
  assert.equal(rd(e.reg()),0,'GetDeviceState DI_OK');
  return [0x1d,0x9d].map(dik=>dv.getUint8(e.g2w(buf)+dik));
}
function expect(name, expected) {
  assert.deepEqual(state(),expected,name); checks.push(name);
}
const event=require('../tools/native-key-controls.cjs').eventForKey('Control');
assert.equal(event.code,'ControlLeft'); assert.equal(event.windowsVirtualKeyCode,17);
function edge(type) {
  if(process.argv.includes('--control-ack-only')) return {};
  f.key(type,event.windowsVirtualKeyCode,event.code,{key:event.key,location:1});
  if(!process.argv.includes('--control-stale-bitmap')) publishBoundary();
}
// A successful CDP send is only an ACK. Omitting DOM delivery keeps DIK up.
const ack={}; assert.deepEqual(ack,{});
publishBoundary(); expect('acknowledgment without delivery stays up',[0,0]);
edge('keydown');
assert.equal(f.renderer.peekKeyDownState(17),0x8000);
expect('held Control reaches both production Ctrl DIKs',[128,128]);
expect('a second poll still sees held Control',[128,128]);
assert.equal(host.get_async_key_state(17),0x8001,'async high bit plus press latch');
assert.equal(host.get_async_key_state(17),0x8000,'async held survives latch consumption');
assert.equal(host.get_keyboard_state(e.g2w(buf)),1);
assert.equal(dv.getUint8(e.g2w(buf)+17),128,'Win32 VK snapshot is distinct from DIK array');
checks.push('Win32 async and keyboard consumers also see held Control');
edge('keyup');
assert(f.renderer.inputQueue.length>=2,'messages deliberately undrained');
expect('released undrained Control is up',[0,0]);
assert.equal(host.get_async_key_state(17),0,'async release does not retain high bit');
// An immediate-state poll after a whole down/up pulse cannot recover a hold.
edge('keydown'); edge('keyup');
expect('pulse entirely between polls is absent',[0,0]);
// A queued WM_KEYDOWN alone can be acknowledged/delivered without a live hold.
while(f.renderer.checkInput()) {}
publishBoundary(); expect('draining messages does not revive released Control',[0,0]);
edge('keydown'); f.blur(); publishBoundary();
expect('browser blur releases Control before a poll',[0,0]);
console.log(JSON.stringify({pass:true,rpc:process.argv.includes('--rpc'),event,checks,
  scope:'production DOM callbacks, renderer, createWindowHost, Worker bitmap/RPC if selected, compiled WAT; fixture device/acquire and memory; no original gameplay'}));
`, fixturePath);
