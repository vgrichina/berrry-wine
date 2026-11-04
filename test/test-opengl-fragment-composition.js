#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { bootRenderHarness } = require('./render-helper');
const { OpenGLHostBridge } = require('../lib/gl-compat');
const Stream = require('../lib/gl-command-stream');
const { BASE } = require('../lib/region-map.generated');
const apis = require('../src/api_table.json');
const root = path.resolve(__dirname, '..');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');

// Independent normalized GL equations. No renderer color/packing helpers.
const primary = [.75, .5, .25, .75], texel = [64, 128, 192, 128];
const fog = [.125, .75, .5, .125], destination = [.625, .125, .875, .5];
const texture = c => c.map((v, i) => v * texel[i] / 255);
const mist = (c, f) => c.map((v, i) => i === 3 ? v : f * v + (1 - f) * fog[i]);
const blend = (c, d) => c.map((v, i) => v * c[3] + d[i] * (1 - c[3]));
const quantize = c => c.map(v => Math.round(v * 255));
const distance = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));

async function run(name) {
  const modulePath = path.join(root, 'build', name), bytes = fs.readFileSync(modulePath);
  let memory, bridge;
  const h = await bootRenderHarness({ fonts: 'none', width: 8, height: 8,
    prebuiltModule: new WebAssembly.Module(bytes),
    extraHostOverrides: { gpu_gl_call(op, at, size) {
      if (op === Stream.WAT_STREAM_FLUSH_OPCODE)
        return bridge.replay(Stream.memoryBatch(memory, at, size));
      if (op >= 0x20000 && op <= 0x20006) return 0; // synchronous native rasterizer
      throw Error('unexpected GPU opcode ' + op);
    } } });
  memory = h.memory;
  const e = h.exports, dv = new DataView(memory.buffer), wa = p => e.guest_to_wasm(p) >>> 0;
  const pePath = path.join(root, 'test/binaries/calc.exe'), pe = fs.readFileSync(pePath);
  new Uint8Array(memory.buffer, e.get_staging(), pe.length).set(pe);
  assert(e.load_pe(pe.length), 'ordinary PE initializes public thunk dispatch');
  const renderer = h.renderer;
  bridge = new OpenGLHostBridge({backend: 'software', getMemory: () => memory.buffer, exports: e, renderer});
  const stack = (e.guest_alloc(8192) >>> 0) + 4096, result = e.guest_alloc(8) >>> 0;
  let calls = 0;
  function invoke(target, args) {
    // Actual x86 PUSH/CALL/RET, public Win32 stdcall dispatch, bounded execution.
    const b = [], word = n => b.push(n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24);
    for (const v of args.slice().reverse()) { b.push(0x68); word(v); }
    b.push(0xb8); word(target); b.push(0xff, 0xd0, 0xa3); word(result);
    b.push(0x89, 0x25); word(result + 4); b.push(0xc3);
    const code = e.guest_alloc(b.length + 4) >>> 0;
    new Uint8Array(memory.buffer, wa(code), b.length).set(b);
    e.set_esp(stack); e.call_func(code, 0, 0, 0, 0);
    for (let n = 0; n < 100 && e.get_eip(); n++) e.run(10000);
    assert.equal(e.get_eip(), 0, 'bounded public call completion');
    assert.equal(dv.getUint32(wa(result) + 4, true), stack - 20, 'stdcall argument cleanup');
    assert.equal(e.get_esp() >>> 0, stack - 16, 'caller RET');
    calls++;
    return dv.getUint32(wa(result), true);
  }
  // Bootstrap resolver using the existing catalog thunk, restoring its metadata.
  function api(name, args) {
    const old = dv.getUint32(BASE.THUNK_BASE + 4, true);
    try {
      dv.setUint32(BASE.THUNK_BASE + 4, apis.find(a => a.name === name).id, true);
      return invoke(e.get_thunk_base() >>> 0, args);
    } finally { dv.setUint32(BASE.THUNK_BASE + 4, old, true); }
  }
  function str(s) {
    const p = e.guest_alloc(s.length + 1) >>> 0;
    new Uint8Array(memory.buffer, wa(p), s.length + 1).set(Buffer.from(s + '\0')); return p;
  }
  const dll = api('LoadLibraryA', [str('opengl32.dll')]); assert(dll);
  const resolved = new Map();
  function call(name, args = []) {
    if (!resolved.has(name)) {
      const p = api('GetProcAddress', [dll, str(name)]); assert(p, 'public export ' + name);
      assert.equal(e.thunk_word(p, 1), apis.find(a => a.name === name).id);
      resolved.set(name, p);
    }
    return invoke(resolved.get(name), args);
  }
  const temp = new DataView(new ArrayBuffer(4));
  const f = x => { temp.setFloat32(0, x, true); return temp.getUint32(0, true); };
  const hwnd = api('CreateWindowExA', [0,str('STATIC'),str('fragment composition'),0,0,0,8,8,0,0,0,0]); assert(hwnd);
  const dc = api('GetDC', [hwnd]); assert(dc);
  const pfd = e.guest_alloc(40) >>> 0, pfdWa = wa(pfd);
  new Uint8Array(memory.buffer, pfdWa, 40).fill(0);
  dv.setUint16(pfdWa, 40, true); dv.setUint16(pfdWa+2, 1, true);
  dv.setUint32(pfdWa+4, 0x25, true); // window, OpenGL, double buffer
  dv.setUint8(pfdWa+9, 32); dv.setUint8(pfdWa+16, 8); dv.setUint8(pfdWa+23, 16);
  const pixelFormat = api('ChoosePixelFormat', [dc,pfd]); assert(pixelFormat);
  assert.equal(api('SetPixelFormat', [dc,pixelFormat,pfd]), 1);
  const context = call('wglCreateContext', [dc]); assert(context);
  assert.equal(call('wglMakeCurrent', [dc, context]), 1);
  call('glViewport', [0, 0, 8, 8]);
  for (const mode of [0x1700, 0x1701, 0x1702]) { call('glMatrixMode', [mode]); call('glLoadIdentity'); }
  call('glMatrixMode', [0x1700]);
  for (const cap of [0xb50, 0xb71, 0xb44, 0xbd0]) call('glDisable', [cap]);
  call('glBindTexture', [0xde1, 1]);
  for (const p of [0x2800, 0x2801]) call('glTexParameteri', [0xde1, p, 0x2600]);
  call('glTexEnvi', [0x2300, 0x2200, 0x2100]); // RGBA MODULATE
  const input = e.guest_alloc(16) >>> 0, output = e.guest_alloc(256) >>> 0;
  new Uint8Array(memory.buffer, wa(input), 4).set(texel);
  call('glTexImage2D', [0xde1, 0, 0x1908, 1, 1, 0, 0x1908, 0x1401, input]);
  fog.forEach((v, i) => dv.setFloat32(wa(input) + i * 4, v, true));
  call('glFogfv', [0xb66, input]); call('glFogi', [0xb65, 0x2601]);
  call('glFogf', [0xb63, f(0)]); call('glFogf', [0xb64, f(1)]);
  call('glBlendFunc', [0x302, 0x303]);
  call('glTexCoord2f', [.5, .5].map(f)); call('glColor4f', primary.map(f));
  const observations = [];
  function draw(label, {textured = true, fogged = true, blended = true, z = -.5, dest = destination} = {}) {
    for (const [cap, on] of [[0xde1, textured], [0xb60, fogged], [0xbe2, blended]])
      call(on ? 'glEnable' : 'glDisable', [cap]);
    call('glClearColor', dest.map(f)); call('glClear', [0x4000]);
    call('glBegin', [7]);
    for (const [x, y] of [[-1,-1], [1,-1], [1,1], [-1,1]]) call('glVertex3f', [x,y,z].map(f));
    call('glEnd'); call('glFinish');
    call('glReadPixels', [0,0,8,8,0x1908,0x1401,output]);
    assert.equal(call('glGetError'), 0, 'valid ordinary inputs: ' + label);
    let expected = textured ? texture(primary) : primary.slice();
    if (fogged) expected = mist(expected, 1 - Math.abs(z));
    if (blended) expected = blend(expected, dest);
    const want = quantize(expected), pixels = new Uint8Array(memory.buffer, wa(output), 256);
    for (let i = 0; i < 64; i++) assert(distance(Array.from(pixels.subarray(i*4,i*4+4)), want) <= 2,
      `${name} ${label} pixel ${i}: ${Array.from(pixels.subarray(i*4,i*4+4))} expected ${want}`);
    const actual = Array.from(pixels.subarray(0,4)); observations.push({label, expected: want, actual});
    return actual;
  }
  const composed = draw('texture -> half fog -> source-alpha blend');
  // Make stored alpha visible: the next valid draw weights RGB by destination
  // alpha. A triangle using the RGB-only blend helper previously made this red
  // contribution vanish, even though the first draw's RGB looked correct.
  const overlay = [1,0,0,.25];
  call('glDisable', [0xde1]); call('glDisable', [0xb60]);
  call('glBlendFunc', [0x304,0x305]); call('glColor4f', overlay.map(f));
  call('glBegin', [7]);
  for (const [x,y] of [[-1,-1],[1,-1],[1,1],[-1,1]]) call('glVertex3f', [x,y,-.5].map(f));
  call('glEnd'); call('glReadPixels', [0,0,8,8,0x1908,0x1401,output]);
  const first = blend(mist(texture(primary), .5), destination);
  const witness = quantize(overlay.map((v,i) => v*first[3] + first[i]*(1-first[3])));
  const witnessPixels = new Uint8Array(memory.buffer, wa(output), 256);
  for (let i=0;i<64;i++) assert(distance(Array.from(witnessPixels.subarray(i*4,i*4+4)), witness) <= 2,
    name + ' stored destination alpha contributes to subsequent RGB');
  observations.push({label:'stored alpha becomes visible via DST_ALPHA',expected:witness,actual:Array.from(witnessPixels.subarray(0,4))});
  assert.equal(call('glGetError'), 0, 'valid destination-alpha witness');
  call('glBlendFunc', [0x302,0x303]); call('glColor4f', primary.map(f));
  const wrong = {
    fogBeforeTexture: blend(texture(mist(primary, .5)), destination),
    fogAfterBlend: mist(blend(texture(primary), destination), .5),
    fogChangesAlpha: blend(mist(texture(primary), .5).map((v,i) => i === 3 ? .5*v+.5*fog[3] : v), destination),
    missingTextureAlpha: blend(mist(texture(primary), .5).map((v,i) => i === 3 ? primary[3] : v), destination),
    noDestination: mist(texture(primary), .5).map(v => v * texture(primary)[3]),
  };
  for (const [label, color] of Object.entries(wrong)) {
    assert(distance(composed, quantize(color)) > 8, 'distinguishes ' + label);
  }
  draw('fog disabled', {fogged:false}); draw('texture disabled', {textured:false});
  draw('blend disabled: fog preserves texture alpha', {blended:false});
  draw('zero fog contribution', {z:0}); draw('full fog preserves texture alpha', {z:-1});
  draw('changed blend destination', {dest:[.125,.875,.25,.75]});
  call('wglMakeCurrent', [0,0]); call('wglDeleteContext', [context]);
  api('ReleaseDC', [hwnd,dc]); api('DestroyWindow', [hwnd]);
  return {name, sha256:hash(bytes), bytes:bytes.length, pe:{path:path.relative(root,pePath),sha256:hash(pe)},
    route:'built module / x86 public resolved GL calls / synchronous WAT / glReadPixels RGBA8',
    calls, observations, wrongOrderColors:Object.fromEntries(Object.entries(wrong).map(([k,v]) => [k,quantize(v)]))};
}
async function main() {
  const results = [];
  for (const name of ['wine-assembly.wasm', 'wine-assembly.compat.wasm']) {
    try { results.push(await run(name)); console.log('PASS', JSON.stringify(results.at(-1))); }
    catch (error) { results.push({name, passed:false, error:String(error)}); console.error(name, error); }
  }
  if (process.env.GL_FRAGMENT_COMPOSITION_EVIDENCE)
    fs.writeFileSync(process.env.GL_FRAGMENT_COMPOSITION_EVIDENCE, JSON.stringify({passed:results.every(r => r.passed !== false), results}, null, 2));
  assert(results.every(r => r.passed !== false), 'both built modules pass composition');
}
if (require.main === module) main().catch(error => {console.error(error); process.exitCode = 1;});
