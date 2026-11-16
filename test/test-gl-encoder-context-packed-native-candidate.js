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
  const query = (pname, count = 4) => {
    new Uint8Array(memory.buffer, wa(output), 256).fill(0xa5);
    gl('glGetFloatv', [pname, output + 16]);
    assert.deepEqual(Array.from(new Uint8Array(memory.buffer, wa(output), 16)), Array(16).fill(0xa5));
    assert.deepEqual(Array.from(new Uint8Array(memory.buffer, wa(output) + 16 + count * 4, 240 - count * 4)), Array(240 - count * 4).fill(0xa5));
    return Array.from(new Float32Array(memory.buffer, wa(output) + 16, count));
  };
  function bind(context) {
    assert.equal(gl('wglMakeCurrent', [dc, context]), 1);
    assert.equal(gl('wglGetCurrentContext'), context);
    assert.equal(gl('wglGetCurrentDC'), dc);
    gl('glViewport', [0, 0, 16, 16]);
  }
  function publicNoCurrentRefusal() {
    assert.equal(gl('wglGetCurrentContext'),0);
    const before=api('GetPixel',[dc,8,8]),firstPacket=packets.length,firstGeometry=geometries.length;
    gl('glClearColor',[1,0,1,1].map(f));gl('glClear',[0x4000]);
    gl('glColor4f',[1,0,0,1].map(f));gl('glBegin',[4]);
    for(const p of [[-1,-1,0],[1,-1,0],[0,1,0]])gl('glVertex3f',p.map(f));
    gl('glEnd');gl('glFinish');
    assert.equal(gl('wglGetCurrentContext'),0);
    assert.equal(api('GetPixel',[dc,8,8]),before,'GL without a current context leaves the public drawable unchanged');
    observations.push({label:'public no-current refusal; internal fallback wire is not a rendering oracle',
      before,after:before,firstPacket,packetCount:packets.length-firstPacket,
      firstGeometry,geometryCount:geometries.length-firstGeometry});
  }
  function matrixContexts() {
    const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
    bind(a);gl('glMatrixMode',[0x1700]);gl('glTranslatef',[.5,-.25,.125].map(f));
    const translated=[1,0,0,0,0,1,0,0,0,0,1,0,.5,-.25,.125,1];
    assert.deepEqual(query(0xba6,16),translated,'public column-major modelview translation');
    bind(b);assert.deepEqual(query(0xba6,16),identity,'other context modelview remains identity');
    gl('glMatrixMode',[0x1701]);gl('glScalef',[.5,.25,1].map(f));
    const scaled=[.5,0,0,0,0,.25,0,0,0,0,1,0,0,0,0,1];
    assert.deepEqual(query(0xba7,16),scaled,'public projection scale');
    bind(a);assert.deepEqual(query(0xba6,16),translated,'context A restores its matrix');
    assert.deepEqual(query(0xba7,16),identity,'context A projection unchanged');
    assert.deepEqual(query(0xba0,1),[0x1700],'matrix mode restored independently');
    assert.equal(gl('wglMakeCurrent',[dc,0xdead]),0);
    assert.equal(gl('wglGetCurrentContext'),0);assert.equal(gl('wglGetCurrentDC'),0);
    bind(b);assert.deepEqual(query(0xba7,16),scaled,'failed bind preserves former context projection');
    assert.deepEqual(query(0xba0,1),[0x1701],'context B retains projection selection');
    gl('glLoadIdentity');gl('glMatrixMode',[0x1700]);gl('glLoadIdentity');
    assert.deepEqual(query(0xba6,16),identity);assert.deepEqual(query(0xba7,16),identity);
    observations.push({label:'public independent matrix contexts',translated,scaled,restored:true});
  }
  function publicDefaults() {
    const identity = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
    for (const pname of [0xba6,0xba7,0xba8]) assert.deepEqual(query(pname,16),identity,'initial matrix identity');
    assert.deepEqual(query(0xb00),[1,1,1,1],'initial current white');
    assert.deepEqual(query(0xb02,3),[0,0,1],'initial normal');
    assert.deepEqual(query(0xb03),[0,0,0,1],'initial texture coordinates');
    assert.deepEqual(query(0xb54,1),[0x1d01],'initial smooth shade model');
    assert.deepEqual(query(0xb40,2),[0x1b02,0x1b02],'both polygon faces initially fill');
    assert.deepEqual(query(0xb43,1),[1],'initial outgoing edge flag');
  }
  function primitivePixels() {
    gl('glEnable',[0x0b44]);gl('glCullFace',[0x405]);gl('glFrontFace',[0x901]);
    const tri=[[-.75,-.75,0],[.75,-.75,0],[-.75,.75,0]];
    const square=[[-.6875,-.6875,0],[.6875,-.6875,0],[.6875,.6875,0],[-.6875,.6875,0]];
    const cases=[
      {mode:0,p:[[.0625,.0625,0]],xy:[8,8],prov:0},
      {mode:1,p:[[-.6875,.0625,0],[.6875,.0625,0]],xy:[8,8],prov:1},
      {mode:2,p:square,xy:[8,2],prov:1},
      {mode:3,p:square,xy:[8,2],prov:1},
      {mode:4,p:tri,xy:[4,4],prov:2},
      {mode:5,p:[...tri,[.75,.75,0]],xy:[4,4],prov:2},
      {mode:6,p:square,xy:[10,4],prov:2},
      {mode:7,p:square,xy:[8,7],prov:3},
      {mode:8,p:[square[0],square[1],square[3],square[2]],xy:[8,7],prov:3},
      {mode:9,p:square,xy:[8,7],prov:0},
    ];
    const colors=[[1,0,0,1],[0,1,0,1],[0,0,1,1],[1,1,0,1]];
    const readLiteral=(xy,expected,label,tolerance=0)=>{
      new Uint8Array(memory.buffer,wa(output),256).fill(0xa5);
      gl('glReadPixels',[...xy,1,1,0x1908,0x1401,output+16]);
      const actual=Array.from(new Uint8Array(memory.buffer,wa(output)+16,4));
      assert(actual.every((v,i)=>i===3?v===expected[i]:Math.abs(v-expected[i])<=tolerance),label+' native pixel '+JSON.stringify({actual,expected}));
      assert.deepEqual(Array.from(new Uint8Array(memory.buffer,wa(output),16)),Array(16).fill(0xa5));
      assert.deepEqual(Array.from(new Uint8Array(memory.buffer,wa(output)+20,236)),Array(236).fill(0xa5));
      api('SwapBuffers',[dc]);
      const pixel=api('GetPixel',[dc,xy[0],15-xy[1]]);
      const gdi=[pixel&255,(pixel>>>8)&255,(pixel>>>16)&255];
      assert(gdi.every((v,i)=>Math.abs(v-expected[i])<=tolerance),label+' public GDI pixel '+JSON.stringify({gdi,expected}));
      observations.push({label,xy,expected,actual,gdi,tolerance});
    };
    for(const mask of [0,1,8,0x40,9,0x49]){
      gl('glShadeModel',[0x1d01]);gl('glPushAttrib',[mask]);
      gl('glShadeModel',[0x1d00]);gl('glPopAttrib');
      const flat=!(mask&0x40);
      assert.deepEqual(query(0xb54,1),[flat?0x1d00:0x1d01],
        'public shade model restores only GL_LIGHTING_BIT mask '+mask);
      gl('glClearColor',[0,0,0,1].map(f));gl('glClear',[0x4000]);
      gl('glBegin',[4]);tri.forEach((p,i)=>{
        gl('glColor4f',colors[i].map(f));gl('glVertex3f',p.map(f));
      });gl('glEnd');gl('glFinish');
      assert.deepEqual(geometries.at(-1).vertices,tri.flatMap((p,i)=>
        [...p,...colors[flat?2:i],0,0,0,0,1,0,0,1,0,1,0,1]),'literal masked shade vertices '+mask);
      readLiteral([4,4],flat?[0,0,255,255]:[149,53,53,255],
        'public masked shade '+mask,flat?0:1);
    }
    for(const flat of [false,true])for(const c of cases){
      const label=`public primitive ${c.mode} ${flat?'flat':'smooth'}`;
      const first=geometries.length;
      gl('glShadeModel',[flat?0x1d00:0x1d01]);
      gl('glClearColor',[0,0,0,1].map(f));gl('glClear',[0x4000]);
      gl('glBegin',[c.mode]);
      c.p.forEach((p,i)=>{
        gl('glColor4f',(flat?colors[i]:[0,1,1,1]).map(f));
        gl('glVertex3f',p.map(f));
      });
      gl('glEnd');gl('glFinish');
      assert.equal(geometries.length,first+1,label+' one compact record');
      const geometry=geometries.at(-1);
      assert.equal(geometry.opcode,Stream.PACKED_DRAW_OPCODE,label+' exact compact opcode');
      assert.equal(geometry.mode,[0,1,0x1000001,0x1000001,4,4,4,4,4,4][c.mode],label+' exact wire mode');
      const lower=[ [0],[0,1],[0,1,1,2,2,3,3,0],[0,1,1,2,2,3], [0,1,2],
        [0,1,2,2,1,3],[0,1,2,0,2,3],[0,1,2,0,2,3],[0,1,3,0,3,2],[0,1,2,0,2,3] ][c.mode];
      const prov=[ [0],[1,1],[1,1,2,2,3,3,0,0],[1,1,2,2,3,3],[2,2,2],
        [2,2,2,3,3,3],[2,2,2,3,3,3],[3,3,3,3,3,3],[3,3,3,3,3,3],[0,0,0,0,0,0] ][c.mode];
      assert.deepEqual(geometry.vertices,lower.flatMap((i,n)=>[...c.p[i],...(flat?colors[prov[n]]:[0,1,1,1]),0,0,0,0,1,0,0,1,0,1,0,1]),label+' literal topology/provoking/current19 attributes');
      readLiteral(c.xy,(flat?colors[c.prov]:[0,1,1,1]).map(v=>v*255),label);
    }
    gl('glShadeModel',[0x1d01]);
    gl('glClearColor',[0,0,0,1].map(f));gl('glClear',[0x4000]);
    gl('glBegin',[4]);tri.forEach((p,i)=>{gl('glColor4f',colors[i].map(f));gl('glVertex3f',p.map(f));});gl('glEnd');gl('glFinish');
    // At pixel center (4.5,4.5), barycentric RGB weights are (7/12,5/24,5/24).
    // Permit one byte for documented rasterizer conversion/interpolation rounding.
    readLiteral([4,4],[149,53,53,255],'public smooth triangle interpolation',1);
    gl('glClearColor',[0,0,0,1].map(f));gl('glClear',[0x4000]);
    gl('glClearColor',[0,0,0,1].map(f));gl('glClear',[0x4000]);gl('glColor4f',[0,1,1,1].map(f));
    const homogeneous=[[-1,-1,0,2],[1.5,-1,0,2],[-1,1.5,0,2]];
    gl('glBegin',[4]);homogeneous.forEach(p=>gl('glVertex4f',p.map(f)));gl('glEnd');gl('glFinish');
    assert.equal(geometries.at(-1).opcode,Stream.PACKED_DRAW_OPCODE);assert.equal(geometries.at(-1).mode,4);
    assert.deepEqual(geometries.at(-1).vertices,homogeneous.flatMap(p=>[...p.slice(0,3),0,1,1,1,0,0,0,0,1,0,0,2,0,1,0,1]),'literal homogeneous source W retained');
    new Uint8Array(memory.buffer,wa(output),256).fill(0xa5);
    gl('glReadPixels',[4,4,6,6,0x1908,0x1401,output+16]);
    const homogeneousPixels=new Uint8Array(memory.buffer,wa(output)+16,144);
    const positive=Array.from(homogeneousPixels.subarray(0,4)),outside=Array.from(homogeneousPixels.subarray(140,144));
    assert.deepEqual(positive,[0,255,255,255],'positive homogeneous triangle pixel');
    assert.deepEqual(outside,[0,0,0,255],'perspective-divided boundary excludes a pixel that ignoring W would fill');
    assert.deepEqual(Array.from(new Uint8Array(memory.buffer,wa(output),16)),Array(16).fill(0xa5));
    assert.deepEqual(Array.from(new Uint8Array(memory.buffer,wa(output)+160,96)),Array(96).fill(0xa5));
    api('SwapBuffers',[dc]);
    const homogeneousGDI=[api('GetPixel',[dc,4,11]),api('GetPixel',[dc,9,6])];
    assert.deepEqual(homogeneousGDI,[0xffff00,0]);
    observations.push({label:'homogeneous W divide positive and exclusion pixels',positive,outside,gdi:homogeneousGDI});
    gl('glClearColor',[0,0,0,1].map(f));gl('glClear',[0x4000]);
    gl('glColor4f',[1,1,1,1].map(f));gl('glBegin',[4]);
    const clockwise=[tri[0],tri[2],tri[1]];
    clockwise.forEach(p=>gl('glVertex3f',p.map(f)));gl('glEnd');gl('glFinish');
    assert.equal(geometries.at(-1).opcode,Stream.PACKED_DRAW_OPCODE);
    assert.equal(geometries.at(-1).mode,4);
    assert.deepEqual(geometries.at(-1).vertices,clockwise.flatMap(p=>[...p,1,1,1,1,0,0,0,0,1,0,0,1,0,1,0,1]),'literal clockwise geometry is preserved for renderer culling');
    readLiteral([4,4],[0,0,0,255],'clockwise triangle culled');
    gl('glDisable',[0x0b44]);assert.equal(gl('glGetError'),0,'primitive public calls have no ignored GL error');
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
    publicNoCurrentRefusal(); bind(a); publicDefaults(); gl('glColor4f', [1,0,0,1].map(f)); draw([1,0,0,1], 'context A red');
    bind(b); publicDefaults(); assert.deepEqual(query(0x0b00), [1,1,1,1]); draw([1,1,1,1], 'fresh context B white');
    gl('glColor4f', [0,1,0,1].map(f)); draw([0,1,0,1], 'context B green');
    bind(a); assert.deepEqual(query(0x0b00), [1,0,0,1]); draw([1,0,0,1], 'restored context A red');
    assert.equal(gl('wglMakeCurrent', [dc,0xdead]), 0);
    assert.equal(gl('wglGetCurrentContext'), 0, 'failed bind detaches the old context');
    assert.equal(gl('wglGetCurrentDC'), 0, 'failed bind releases its DC');
    const before = packets.length;
    assert.equal(gl('wglDeleteContext', [0xdead]), 0);
    assert.equal(packets.length, before, 'unknown deletion is locally refused without a submission');
    bind(b); assert.deepEqual(query(0x0b00), [0,1,0,1]); draw([0,1,0,1], 'B survived failed bind');
    matrixContexts(); primitivePixels();
    assert.equal(gl('wglMakeCurrent', [0,0]), 1);
    assert.equal(gl('wglDeleteContext', [a]), 1); assert.equal(gl('wglDeleteContext', [b]), 1);
    api('ReleaseDC', [hwnd,dc]); api('DestroyWindow', [hwnd]);
    const native = bridge._webglBackend.gl;
    const environment = { renderer: native.getParameter(native.RENDERER),
      version: native.getParameter(native.VERSION), physicalGPUQualified: false };
    return { moduleName, moduleSHA256: hash(binary), bootstrapPESHA256: hash(pe),
      environment, calls, packets, geometries, observations };
  } catch(error) {
    error.moduleEvidence = {moduleName,moduleSHA256:hash(binary),
      bootstrapPESHA256:hash(pe),calls,packets,geometries,observations,error:String(error.stack||error)};
    throw error;
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
  } catch(error) {
    report.failure = error.moduleEvidence || {error:String(error.stack||error)};
    throw error;
  } finally {
    report.operationWatchdog = await guard.close();
    if (process.env.GL_CONTEXT_PACKED_EVIDENCE) fs.writeFileSync(process.env.GL_CONTEXT_PACKED_EVIDENCE,
      JSON.stringify(report, null, 2));
  }
  console.log('PASS public x86 context lifecycle, literal packed attributes, native pixels and canaries');
})().catch(error => { console.error(error); process.exitCode = 1; });
