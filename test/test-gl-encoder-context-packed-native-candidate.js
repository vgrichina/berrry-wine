#!/usr/bin/env node
'use strict';

// Public x86/WGL calls, literal packed attributes and independently chosen
// native pixels. This does not run the bootstrap PE's original entry point.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Worker } = require('node:worker_threads');
const { finished } = require('node:stream/promises');
const { bootRenderHarness } = require('./render-helper');
const { OpenGLHostBridge } = require('../lib/gl-compat');
const { createCanvas } = require('../lib/canvas-compat');
const Stream = require('../lib/gl-command-stream');
const Native = require('../lib/headless-gl');
const { BASE } = require('../lib/region-map.generated');
const apis = require('../src/api_table.json');
const root = path.resolve(__dirname, '..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

async function operationGuard() {
  // Independent thread observes every prearmed deadline even when a native GL
  // call blocks the main event loop. An overdue operation ends this fixture;
  // it cannot submit a later request or rebind a context.
  const shared = new SharedArrayBuffer(32), state = new BigInt64Array(shared);
  const worker = new Worker(`
    const {parentPort,workerData}=require('node:worker_threads');
    const state=new BigInt64Array(workerData);
    parentPort.postMessage({ready:true});
    let seen=0n;
    while(Atomics.load(state,1)!==-1n){
      const wake=Atomics.load(state,0), status=Atomics.load(state,1), seq=status/4n;
      if(seq!==seen&&status%4n===1n){seen=seq;Atomics.store(state,3,seq);Atomics.notify(state,3);}
      if(status%4n===1n&&BigInt(Date.now())>=Atomics.load(state,2)
        &&Atomics.compareExchange(state,1,status,status+1n)===status){
        require('node:fs').writeSync(2,'PERMANENT_UNKNOWN fixed 3s public-operation deadline '+String(seq)+String.fromCharCode(10));
        process.kill(process.pid,'SIGTERM');break;
      }
      Atomics.wait(state,0,wake,1);
    }
    parentPort.close();
  `, { eval: true, workerData: shared, stdout: true, stderr: true });
  const watchdogThreadId = worker.threadId;
  let stdout = '', stderr = '';
  worker.stdout.on('data', b => { stdout += b; });
  worker.stderr.on('data', b => { stderr += b; });
  const exit = new Promise((resolve, reject) => { worker.once('error', reject); worker.once('exit', resolve); });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('deadline watchdog failed to arm within 3s')), 3000);
    worker.once('message', () => { clearTimeout(timer); resolve(); });
    worker.once('error', error => { clearTimeout(timer); reject(error); });
  }).catch(async error => { await worker.terminate(); await exit; throw error; });
  const events = [];
  let sequence = 0n, permanentUnknown = false;
  return {
    get permanentUnknown() { return permanentUnknown; },
    call(name, fn) {
      assert.equal(Atomics.load(state, 1) % 4n, 0n, 'previous operation completed before a new request');
      const seq = ++sequence, armedAt = Date.now(), deadline = armedAt + 3000;
      const active = seq * 4n + 1n;
      Atomics.store(state, 2, BigInt(deadline)); Atomics.store(state, 1, active);
      Atomics.store(state, 0, seq); Atomics.notify(state, 0);
      Atomics.wait(state, 3, seq - 1n, 3000);
      const event = { sequence: Number(seq), name, armedAt, deadline };
      events.push(event);
      try {
        assert.equal(Atomics.load(state, 3), seq, 'independent watchdog acknowledged before public call');
        assert(Date.now() < deadline, 'prearm consumed the operation deadline');
        const value = fn(deadline);
        assert(Date.now() < deadline, 'fixed 3s public-operation deadline');
        assert.equal(Atomics.compareExchange(state, 1, active, seq * 4n), active);
        event.completedAt = Date.now(); event.outcome = 'COMPLETED';
        return value;
      } catch (error) {
        permanentUnknown = true; Atomics.store(state, 1, seq * 4n + 2n);
        event.outcome = 'PERMANENT_UNKNOWN'; throw error;
      }
    },
    async close() {
      Atomics.store(state, 1, -1n); Atomics.add(state, 0, 1n); Atomics.notify(state, 0);
      const code = await exit;
      await Promise.all([finished(worker.stdout), finished(worker.stderr)]);
      assert.equal(code, 0);
      return { kind: 'worker-thread', threadId: watchdogThreadId,
        exit: code, actualWait: true, stdoutEOF: worker.stdout.readableEnded,
        stderrEOF: worker.stderr.readableEnded, stdout, stderr, permanentUnknown, events };
    },
  };
}

async function run(moduleName, guard) {
  assert(Native.available(), Native.unavailableReason());
  const binary = fs.readFileSync(path.join(root, 'build', moduleName));
  const packets = [], calls = [], geometries = [], observations = [];
  let memory, bridge, activeCall;
  const h = await bootRenderHarness({ fonts: 'none', width: 16, height: 16,
    prebuiltModule: new WebAssembly.Module(binary),
    extraHostOverrides: { gpu_gl_call(op, at, length) {
      if (op === 0x10002) {
        // Public GetPixel must resolve the real GPU-owned window surface.
        assert.equal(h.renderer.resolveGpuWindowReadback(at, false), true);
        h.exports.gl_window_set_gpu_owned(at, 0);
        return 1;
      }
      if (op >= 0x20000 && op <= 0x20006) return 0;
      assert.equal(op, Stream.WAT_STREAM_FLUSH_OPCODE);
      const snapshot = Buffer.from(new Uint8Array(memory.buffer, at, length));
      const ops = [];
      Stream.replay({ buffer: snapshot.buffer, byteOffset: snapshot.byteOffset,
        bytes: snapshot.length }, (opcode, mode, capture) => {
        ops.push(opcode);
        if ([Stream.PACKED_DRAW_OPCODE, Stream.EXACT_DRAW_OPCODE, Stream.EDGE_DRAW_OPCODE].includes(opcode)) {
          geometries.push({ call: activeCall, opcode, mode,
            vertices: Array.from(new Float32Array(capture.buffer,
              capture.pointerOffset, capture.pointerLength / 4)) });
        }
        return 0;
      });
      packets.push({ call: activeCall, ops, bytes: length, sha256: hash(snapshot) });
      return bridge.replay(Stream.memoryBatch(memory, at, length));
    } } });
  memory = h.memory;
  const e = h.exports, dv = new DataView(memory.buffer), wa = p => e.guest_to_wasm(p) >>> 0;
  const pe = fs.readFileSync(path.join(root, 'test/binaries/calc.exe'));
  new Uint8Array(memory.buffer, e.get_staging(), pe.length).set(pe);
  assert(e.load_pe(pe.length));
  bridge = new OpenGLHostBridge({ backend: 'webgl', createCanvas,
    getMemory: () => memory.buffer, exports: e, renderer: h.renderer });
  const stack = (e.guest_alloc(8192) >>> 0) + 4096;
  const result = e.guest_alloc(8) >>> 0;
  function invoke(target, args) {
    const code = [], word = n => code.push(n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24);
    for (const v of args.slice().reverse()) { code.push(0x68); word(v); }
    code.push(0xb8); word(target); code.push(0xff, 0xd0, 0xa3); word(result);
    code.push(0x89, 0x25); word(result + 4); code.push(0xc3);
    const address = e.guest_alloc(code.length + 4) >>> 0;
    new Uint8Array(memory.buffer, wa(address), code.length).set(code);
    return guard.call(activeCall, deadline => {
      e.set_esp(stack); e.call_func(address, 0, 0, 0, 0);
      while (e.get_eip() && Date.now() < deadline) e.run(10000);
      assert.equal(e.get_eip(), 0, 'public operation completed within its fixed 3s deadline');
      assert.equal(dv.getUint32(wa(result) + 4, true), stack - 20, 'stdcall cleanup');
      assert.equal(e.get_esp() >>> 0, stack - 16, 'caller RET');
      return dv.getUint32(wa(result), true);
    });
  }
  function api(name, args = []) {
    activeCall = name;
    const old = dv.getUint32(BASE.THUNK_BASE + 4, true);
    const first = packets.length;
    let value;
    try {
      dv.setUint32(BASE.THUNK_BASE + 4, apis.find(a => a.name === name).id, true);
      value = invoke(e.get_thunk_base() >>> 0, args);
    } finally { dv.setUint32(BASE.THUNK_BASE + 4, old, true); }
    calls.push({ name, args, value, firstPacket: first, packetCount: packets.length - first });
    return value;
  }
  function str(text) {
    const p = e.guest_alloc(text.length + 1) >>> 0;
    new Uint8Array(memory.buffer, wa(p), text.length + 1).set(Buffer.from(text + '\0'));
    return p;
  }
  const dll = api('LoadLibraryA', [str('opengl32.dll')]); assert(dll);
  const resolved = new Map();
  function gl(name, args = []) {
    if (!resolved.has(name)) {
      const target = api('GetProcAddress', [dll, str(name)]); assert(target, name);
      assert.equal(e.thunk_word(target, 1), apis.find(a => a.name === name).id);
      resolved.set(name, target);
    }
    activeCall = name;
    const first = packets.length, value = invoke(resolved.get(name), args);
    calls.push({ name, args, value, firstPacket: first, packetCount: packets.length - first });
    return value;
  }
  const bits = new DataView(new ArrayBuffer(4));
  const f = n => { bits.setFloat32(0, n, true); return bits.getUint32(0, true); };
  const hwnd = api('CreateWindowExA', [0,str('STATIC'),str('context packed oracle'),0,0,0,16,16,0,0,0,0]);
  assert(hwnd);
  const dc = api('GetDC', [hwnd]); assert(dc);
  const pfd = e.guest_alloc(40) >>> 0;
  new Uint8Array(memory.buffer, wa(pfd), 40).fill(0);
  dv.setUint16(wa(pfd), 40, true); dv.setUint16(wa(pfd) + 2, 1, true);
  dv.setUint32(wa(pfd) + 4, 0x25, true);
  dv.setUint8(wa(pfd) + 9, 32); dv.setUint8(wa(pfd) + 16, 8); dv.setUint8(wa(pfd) + 23, 16);
  const format = api('ChoosePixelFormat', [dc, pfd]); assert(format);
  assert.equal(api('SetPixelFormat', [dc, format, pfd]), 1);
  const a = gl('wglCreateContext', [dc]), b = gl('wglCreateContext', [dc]);
  assert(a && b && a !== b);
  const output = e.guest_alloc(256) >>> 0;
  const query = pname => {
    new Uint8Array(memory.buffer, wa(output), 256).fill(0xa5);
    gl('glGetFloatv', [pname, output + 16]);
    assert.deepEqual(Array.from(new Uint8Array(memory.buffer, wa(output), 16)), Array(16).fill(0xa5));
    assert.deepEqual(Array.from(new Uint8Array(memory.buffer, wa(output) + 32, 224)), Array(224).fill(0xa5));
    return Array.from(new Float32Array(memory.buffer, wa(output) + 16, 4));
  };
  function bind(context) {
    assert.equal(gl('wglMakeCurrent', [dc, context]), 1);
    assert.equal(gl('wglGetCurrentContext'), context);
    assert.equal(gl('wglGetCurrentDC'), dc);
    gl('glViewport', [0, 0, 16, 16]);
  }
  function draw(color, label) {
    const firstGeometry = geometries.length;
    gl('glClearColor', [0,0,1,1].map(f)); gl('glClear', [0x4000]);
    gl('glBegin', [4]);
    for (const position of [[-1,-1,0], [1,-1,0], [0,1,0]]) gl('glVertex3f', position.map(f));
    gl('glEnd'); gl('glFinish');
    assert.equal(geometries.length, firstGeometry + 1, 'one public triangle emits exactly one draw');
    const geometry = geometries.at(-1);
    assert.equal(geometry.opcode, Stream.PACKED_DRAW_OPCODE, 'bound default context uses compact filled triangles');
    assert.equal(geometry.mode, 4);
    assert.deepEqual(geometry.vertices, [[-1,-1,0], [1,-1,0], [0,1,0]].flatMap(p =>
      [...p, ...color, 0,0, 0,0,1, 0,0, 1, 0,1, 0,1]));
    new Uint8Array(memory.buffer, wa(output), 256).fill(0xa5);
    gl('glReadPixels', [8,7,1,1,0x1908,0x1401,output + 16]);
    const pixel = Array.from(new Uint8Array(memory.buffer, wa(output) + 16, 4));
    assert.deepEqual(pixel, color.map(n => n * 255), label + ' independently chosen center pixel');
    assert.deepEqual(Array.from(new Uint8Array(memory.buffer, wa(output), 16)), Array(16).fill(0xa5));
    assert.deepEqual(Array.from(new Uint8Array(memory.buffer, wa(output) + 20, 236)), Array(236).fill(0xa5));
    api('SwapBuffers', [dc]);
    assert.equal(api('GetPixel', [dc,8,8]), color[0]*255 + color[1]*65280 + color[2]*16711680);
    observations.push({ label, color, pixel });
  }
  try {
    bind(a); gl('glColor4f', [1,0,0,1].map(f)); draw([1,0,0,1], 'context A red');
    bind(b); assert.deepEqual(query(0x0b00), [1,1,1,1]); draw([1,1,1,1], 'fresh context B white');
    gl('glColor4f', [0,1,0,1].map(f)); draw([0,1,0,1], 'context B green');
    bind(a); assert.deepEqual(query(0x0b00), [1,0,0,1]); draw([1,0,0,1], 'restored context A red');
    assert.equal(gl('wglMakeCurrent', [dc,0xdead]), 0);
    assert.equal(gl('wglGetCurrentContext'), 0, 'failed bind detaches the old context');
    assert.equal(gl('wglGetCurrentDC'), 0, 'failed bind releases its DC');
    const before = packets.length;
    assert.equal(gl('wglDeleteContext', [0xdead]), 0);
    assert.equal(packets.length, before, 'unknown deletion is locally refused without a submission');
    bind(b); assert.deepEqual(query(0x0b00), [0,1,0,1]); draw([0,1,0,1], 'B survived failed bind');
    assert.equal(gl('wglMakeCurrent', [0,0]), 1);
    assert.equal(gl('wglDeleteContext', [a]), 1); assert.equal(gl('wglDeleteContext', [b]), 1);
    api('ReleaseDC', [hwnd,dc]); api('DestroyWindow', [hwnd]);
    const native = bridge._webglBackend.gl;
    const environment = { renderer: native.getParameter(native.RENDERER),
      version: native.getParameter(native.VERSION), physicalGPUQualified: false };
    return { moduleName, moduleSHA256: hash(binary), bootstrapPESHA256: hash(pe),
      environment, calls, packets, geometries, observations };
  } finally {
    const native = bridge._webglBackend?.gl;
    if (!guard.permanentUnknown) bridge.destroy();
    if (native) Native.destroyContext(native); // fixture host stop, not NativeQuit
  }
}

(async () => {
  const results = [], guard = await operationGuard();
  const report = { passed: false, results };
  try {
    for (const name of ['wine-assembly.wasm', 'wine-assembly.compat.wasm']) results.push(await run(name, guard));
    report.passed = true;
  } finally {
    report.operationWatchdog = await guard.close();
    if (process.env.GL_CONTEXT_PACKED_EVIDENCE) fs.writeFileSync(process.env.GL_CONTEXT_PACKED_EVIDENCE,
      JSON.stringify(report, null, 2));
  }
  console.log('PASS public x86 context lifecycle, literal packed attributes, native pixels and canaries');
})().catch(error => { console.error(error); process.exitCode = 1; });
