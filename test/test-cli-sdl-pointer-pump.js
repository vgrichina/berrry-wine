#!/usr/bin/env node
'use strict';
// Isolated native SDL consumer, never an original-game session. The original
// public SDL video/event APIs run against production USER and renderer input.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const { inputEventHwnd } = require('../lib/host-window');
const { createHostImports } = require('../lib/host-imports');
const { Win98Renderer } = require('../lib/renderer');
const { createCanvas } = require('../lib/raster-canvas');
const loader = require('../lib/dll-loader');
const { ThreadManager } = require('../lib/thread-manager');
const { makeFixture } = require('../tools/kernel32-native-fixture');
const root = path.resolve(__dirname, '..');
const game = path.join(root, 'test/binaries/candidates/lmarbles-108/game/LMARBLES');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
(async () => {
  const sdl = fs.readFileSync(path.join(game, 'SDL.dll'));
  assert.equal(hash(sdl), 'd6c4166c6a00525b68ef1e8e5422963c88907589e150c85693518a93722d5d61',
    'authentic SDL consumer');
  const bytes = fs.readFileSync(path.join(root, 'build/wine-assembly.wasm'));
  const module = await WebAssembly.compile(bytes);
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const renderer = new Win98Renderer(createCanvas(1024, 712));
  const context = { console, createHostImports, inputEventHwnd, performance,
    setTimeout, clearTimeout, setInterval, clearInterval, WebAssembly };
  vm.runInNewContext(fs.readFileSync(require.resolve('../host.js'), 'utf8') +
    '\n;globalThis.WineAssembly = WineAssembly;', context);
  const host = new context.WineAssembly();
  host.memory = memory; host.renderer = renderer; host.logToUI = () => {};
  const imports = host.getImports(); imports.host.memory = memory;
  host.instance = await WebAssembly.instantiate(module, imports);
  const e = host.instance.exports;
  renderer.wasm = host.instance; renderer.wasmMemory = memory;
  const b = new Uint8Array(memory.buffer), dv = new DataView(memory.buffer);
  const wa = p => e.guest_to_wasm(p >>> 0) >>> 0;
  const pe = makeFixture(); b.set(pe, e.get_staging()); assert(e.load_pe(pe.length));
  e.init_dx_com_thunks();
  host.threadManager = new ThreadManager(module, memory, host.instance, tid => {
    let instance;
    const imports = host.getImports({ detached: true, threadId: tid,
      instance: () => instance, exports: () => instance?.exports });
    imports.host.memory = memory;
    imports.__setInstance = value => { instance = value; };
    return imports;
  });
  const dlls = ['SDL.dll', 'libgcc_s_sjlj-1.dll', 'libwinpthread-1.dll'].map(name =>
    ({ name, bytes: fs.readFileSync(path.join(game, name)), path: 'C:\\fixture\\' + name }));
  dlls.push({ name: 'msvcrt.dll', bytes: fs.readFileSync(path.join(root,
    'test/binaries/dlls/msvcrt.dll')), path: 'C:\\windows\\system\\msvcrt.dll' });
  const loaded = loader.loadDlls(e, memory.buffer, pe, dlls, () => {});
  const base = loaded.find(x => x.name.toLowerCase() === 'sdl.dll').loadAddr;
  const address = name => loader._test.findDllExport(e, memory.buffer, base, name);
  const stack = e.guest_alloc(65536) + 65520;
  const calls = [];
  function call(name, args = []) {
    const target = address(name); assert(target, name);
    e.set_esp(stack); e.call_func(target, ...Array.from({ length: 4 }, (_, i) => args[i] || 0));
    const entry = e.get_esp() >>> 0;
    for (let i = 4; i < args.length; i++) dv.setUint32(wa(entry + 4 + i * 4), args[i] >>> 0, true);
    for (let n = 0; n < 20000 && e.get_eip(); n++) {
      e.run(1000);
      assert.equal(e.get_yield_reason(), 0, name + ': unexpected yield at ' + e.get_eip().toString(16));
    }
    assert.equal(e.get_eip(), 0, name + ': bounded native return');
    assert.equal(e.get_esp() >>> 0, entry + 4, name + ': public cdecl return');
    calls.push(name); return e.get_eax() >>> 0;
  }
  const init = call('SDL_Init', [0x20]);
  if (init) { const p = wa(call('SDL_GetError')); let end=p; while(b[end] && end<p+1024) end++; throw Error('SDL_Init: '+Buffer.from(b.slice(p,end)).toString()); }
  assert(call('SDL_SetVideoMode', [640, 480, 16, 0]), 'public video surface');
  const event = e.guest_alloc(24), x = e.guest_alloc(4), y = e.guest_alloc(4);
  function drain() {
    const events = [];
    for (let n = 0; n < 64; n++) {
      if (!call('SDL_PollEvent', [event])) return events;
      events.push({ type: b[wa(event)], x: dv.getInt16(wa(event + 4), true),
        y: dv.getInt16(wa(event + 6), true) });
    }
    throw Error('bounded SDL event drain');
  }
  drain();
  const win = Object.values(renderer.windows).find(w => w.visible && !w.isChild);
  assert(win, 'actual SDL HWND');
  const origin = renderer._mouseMsgOriginScreen(win.hwnd);
  renderer.handleMouseMove(origin.x + 80, origin.y + 90);
  const hover = drain();
  const buttons = call('SDL_GetMouseState', [x, y]);
  const state = { buttons, x: dv.getInt32(wa(x), true), y: dv.getInt32(wa(y), true) };
  assert(hover.some(v => v.type === 4 && v.x === 80 && v.y === 90), 'original SDL motion consumed');
  assert.deepEqual(state, { buttons: 0, x: 80, y: 90 });
  let inputNow = 0;
  renderer._inputNowMs = () => inputNow;
  renderer._buttonHoldFloorMs = -1;
  // Disproved queue-only candidate: even explicit WM_MOUSEMOVE before DOWN
  // in one pump cannot make this original consumer emit SDL motion.
  renderer.handleMouseMove(origin.x + 110, origin.y + 120);
  renderer.handleMouseDown(origin.x + 110, origin.y + 120, 1);
  const queueOnly = drain();
  assert(queueOnly.some(v => v.type === 5), 'queue-only control delivers button');
  assert(!queueOnly.some(v => v.type === 4), 'queue-only control suppresses native motion');
  renderer.handleMouseUp(origin.x + 110, origin.y + 120, 1); drain();
  renderer._coordinatePressHoverMs = 30;
  renderer._buttonHoldFloorMs = -1; // actual CLI press/release timing
  renderer.handleMouseDown(origin.x + 140, origin.y + 150, 1);
  const firstPress = drain();
  assert(firstPress.some(v => v.type === 4 && v.x === 140 && v.y === 150),
    'coordinate press must expose native SDL motion before button');
  assert(!firstPress.some(v => v.type === 5), 'button waits for pointer arrival pump');
  const arrivalButtons = call('SDL_GetMouseState', [x, y]);
  assert.equal(arrivalButtons, 0, 'arrival precedes native button state');
  assert.equal(dv.getInt32(wa(x), true), 140);
  assert.equal(dv.getInt32(wa(y), true), 150);
  inputNow = 31;
  const down = drain();
  assert(down.some(v => v.type === 5), 'later pump receives native button');
  assert.equal(call('SDL_GetMouseState', [x, y]), 1);
  renderer.handleMouseUp(origin.x + 140, origin.y + 150, 1);
  const up = drain(); assert(up.some(v => v.type === 6));
  assert.equal(call('SDL_GetMouseState', [x, y]), 0);
  call('SDL_Quit');
  console.log(JSON.stringify({ pass: true, scope: 'isolated public SDL video/event consumer',
    module: hash(bytes), sdl: hash(sdl), hover, state, queueOnly, firstPress, down, up, nativeCalls: calls.length }));
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
