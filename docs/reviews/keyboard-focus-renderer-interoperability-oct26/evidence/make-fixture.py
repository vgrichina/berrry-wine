from common import *
src=(BD/'test/browser-key-focus-release-oct26.test.cjs').read_text()
# Reuse only the pinned DOM/environment scaffolding, never mock key handlers.
dom=src[src.index('  let document, window;'):src.index('  const identity =')]
timers=src[src.index('  const timers ='):src.index('  vm.runInNewContext')]
actions=src[src.index('  const key ='):src.index('  return { key,')]
header="""'use strict';
// Cross-layer Node regression; no browser, guest or runtime qualification.
// DOM scaffolding adapted from browser-key-focus-release-oct26.test.cjs at
// 2b5eaa0b0db6ef12882a38b6cd143291144d4150. No key callback mocks.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const crypto = require('node:crypto');
const bridgePath = process.env.BROWSER_INPUT_SOURCE || path.join(__dirname, '../lib/browser-input.js');
const rendererPath = process.env.RENDERER_INPUT_SOURCE || path.join(__dirname, '../lib/renderer-input.js');
const source = fs.readFileSync(bridgePath, 'utf8');
const rendererSource = fs.readFileSync(rendererPath);
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
// Immutable production inputs and actual require closure, checked before cases.
assert.equal(hash(source), '9732e516772572e3a8e7ce972cdb73477efa6e965ba299654a632c9979b42b05');
assert.equal(hash(rendererSource), '209e06f67ec38940ecab071890a296e665500e43a52b9bd96abd4ec90fccf304');
const { installInputHandlers } = require(rendererPath);
class Input {
  constructor() {
    this.inputQueue = [];
    // One real fixed 64KiB linear memory; no guest module, compile or exports.
    this.wasmMemory = new WebAssembly.Memory({ initial: 1, maximum: 1 });
    this.wasm = { exports: { memory: this.wasmMemory } };
    this.windows = { 1: { hwnd: 1, visible: true, x: 0, y: 0, w: 640, h: 480,
      wasm: this.wasm, wasmMemory: this.wasmMemory } };
    // Select the real renderer's queued guest-worker delivery route. This is
    // an ownership token, not a running worker or a simulated guest handler.
    this._guestWorkerWasms = new Set([this.wasm]);
  }
}
installInputHandlers(Input);
function fixture() {
"""
body=header+dom+'  const renderer = new Input();\n'+timers+"""  vm.runInNewContext(source, context, { filename: bridgePath, timeout: 1000 });
  context.module.exports.wireCanvasInput(canvas, renderer, { runningApps: [{ wine: { running: true } }] });
"""+actions+"""  return { key, blur, hidden, document, window, canvas, proxy, toolbar, Target, dispatch, renderer };
}
"""
out=REPO/'test/keyboard-focus-renderer-interoperability-oct26.test.cjs'
out.parent.mkdir(parents=True,exist_ok=True);out.write_text(body)
write(OPS/'dom-provenance.json',{'donor':str(BD),'revision':BROWSER,'fixturePath':'test/browser-key-focus-release-oct26.test.cjs','fixtureSha256':sha(src.encode()),'copiedSegments':{'DOM':sha(dom.encode()),'timers':sha(timers.encode()),'actions':sha(actions.encode())},'mockRendererCopied':False})
