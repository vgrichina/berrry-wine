#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { bootRenderHarness } = require('./render-helper');
const { OpenGLHostBridge } = require('../lib/gl-compat');
const Stream = require('../lib/gl-command-stream');
const {createCanvas}=require('../lib/canvas-compat');
const hgl=require('../lib/headless-gl');
const { BASE } = require('../lib/region-map.generated');
const apis = require('../src/api_table.json');
const root = path.resolve(__dirname, '..');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');

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
  bridge = new OpenGLHostBridge({backend: 'webgl', createCanvas, getMemory: () => memory.buffer, exports: e, renderer});
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
  for (const cap of [0xb50,0xb71,0xb44,0xbd0]) call('glDisable',[cap]);
  call('glEnable',[0xde1]);call('glEnable',[0xbe2]);
  call('glBindTexture',[0xde1,1]);
  for(const pname of [0x2800,0x2801])call('glTexParameteri',[0xde1,pname,0x2600]);
  const input=e.guest_alloc(4)>>>0,output=e.guest_alloc(256)>>>0;
  const source=[64,128,192,255];new Uint8Array(memory.buffer,wa(input),4).set(source);
  call('glTexImage2D',[0xde1,0,0x1907,1,1,0,0x1908,0x1401,input]);
  call('glColor4f',[1,1,1,1].map(f));call('glTexCoord2f',[.5,.5].map(f));
  const observations=[];
  function draw(label,dest,srcFactor,dstFactor,want){
    call('glBlendFunc',[srcFactor,dstFactor]);call('glClearColor',dest.map(f));call('glClear',[0x4000]);
    call('glBegin',[7]);for(const [x,y]of[[-1,-1],[1,-1],[1,1],[-1,1]])call('glVertex3f',[x,y,0].map(f));call('glEnd');
    call('glReadPixels',[0,0,8,8,0x1908,0x1401,output]);
    assert.equal(call('glGetError'),0,label+' GL errors');
    const raw=Array.from(new Uint8Array(memory.buffer,wa(output),4));
    assert(raw.every((v,i)=>Math.abs(v-want[i])<=1),label+' raw '+raw+' expected '+want);
    api('SwapBuffers',[dc]);
    const shown=Array.from(bridge.contexts.get(context).layer.canvas.getContext('2d').getImageData(4,4,1,1).data);
    const opaque=[...want.slice(0,3),255];
    observations.push({label,raw,shown,expected:want,presentationExpected:opaque});
    assert(shown.every((v,i)=>Math.abs(v-opaque[i])<=1),label+' compositor '+shown+' expected '+opaque);
    // Presentation must restore the GL draw FBO and retain its own alpha.
    call('glReadBuffer',[0x404]);call('glReadPixels',[0,0,1,1,0x1908,0x1401,output]);
    const front=Array.from(new Uint8Array(memory.buffer,wa(output),4));
    assert(front.every((v,i)=>Math.abs(v-want[i])<=1),label+' front alpha/storage changed '+front);
    call('glReadBuffer',[0x405]);
  }
  try{
    // Distinct frames reject accidentally reading the restored back FBO.
    draw('opaque reference',[.5,.25,.75,1],1,0,source);
    const dest=[.5,.25,.75,1];
    const decal=dest.map((v,i)=>Math.round(v*(1-source[i]/255)*255));
    draw('ZERO ONE_MINUS_SRC_COLOR decal',dest,0,0x301,decal);
    draw('second distinct decal',[.25,.75,.5,1],0,0x301,[48,95,32,0]);
    call('wglMakeCurrent',[0,0]);call('wglDeleteContext',[context]);
    api('ReleaseDC',[hwnd,dc]);api('DestroyWindow',[hwnd]);
    return {name,sha256:hash(bytes),route:'public x86 GL/WGL + SwapBuffers / native WebGL / actual compositor canvas',calls,observations};
  }finally{const gl=bridge._webglBackend?.gl;bridge.destroy();if(gl)hgl.destroyContext(gl);}
}
(async()=>{
 if(!hgl.available()){console.log('SKIP native window presentation: '+hgl.unavailableReason());return;}
 const results=[];for(const name of ['wine-assembly.wasm','wine-assembly.compat.wasm'])results.push(await run(name));
 if(process.env.GL_WINDOW_PRESENTATION_EVIDENCE)fs.writeFileSync(process.env.GL_WINDOW_PRESENTATION_EVIDENCE,JSON.stringify({passed:true,results},null,2));
 console.log('PASS native window presentation',JSON.stringify(results));
})().catch(e=>{console.error(e);process.exitCode=1;});
