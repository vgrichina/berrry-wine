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
const { Worker } = require('node:worker_threads');
const D3D = require('../lib/d3d-command-stream');
const sigs = require('../lib/host-import-sigs.generated.json').sigs;
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
  let memory, bridge, queue, worker;
  // Hold only transport delivery, never rasterization. The untouched production
  // Worker consumes the Encoder's original shared packets after state mutation.
  let held = false;
  const pending = [], packets = [], operations = [];
  const deliver = () => { for (const message of pending.splice(0)) worker.postMessage(message); };
  const release = () => { held = false; deliver(); };
  const h = await bootRenderHarness({ fonts: 'none', width: 8, height: 8,
    prebuiltModule: new WebAssembly.Module(bytes),
    extraHostOverrides: { gpu_gl_call(op, at, size) {
      if (op === Stream.WAT_STREAM_FLUSH_OPCODE)
        return bridge.replay(Stream.memoryBatch(memory, at, size));
      if (op >= 0x20000 && op <= 0x20007) {
        if (!queue) return 0; // context bootstrap precedes worker attachment
        assert(!(held && op===0x20001),'unexpected fence while transport delivery is held');
        operations.push(op);
        return queue.call(op, at, size);
      }
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
  const nextTexel=[224,48,96,192], nextFog=[.875,.125,.25,.875];
  call('glBindTexture',[0xde1,2]);
  for(const p of [0x2800,0x2801]) call('glTexParameteri',[0xde1,p,0x2600]);
  new Uint8Array(memory.buffer,wa(input),4).set(nextTexel);
  call('glTexImage2D',[0xde1,0,0x1908,1,1,0,0x1908,0x1401,input]);
  call('glBindTexture',[0xde1,1]);
  fog.forEach((v, i) => dv.setFloat32(wa(input) + i * 4, v, true));
  call('glFogfv', [0xb66, input]); call('glFogi', [0xb65, 0x2601]);
  call('glFogf', [0xb63, f(0)]); call('glFogf', [0xb64, f(1)]);
  call('glBlendFunc', [0x302, 0x303]);
  call('glTexCoord2f', [.5, .5].map(f)); call('glColor4f', primary.map(f));
  queue = new D3D.Encoder({memory, module:new WebAssembly.Module(bytes), sigs,
    strictReady:true, readyTimeoutMs:10000, guestToWasm:wa, getImageBase:()=>e.get_image_base(),
    workerFactory() {
      worker = new Worker(path.join(root, 'lib/d3d-render-worker.js'));
      const port = {
        postMessage(message) {
          if (message.t === 'batch') {
            // Inspect only the real transport headers; do not generate records.
            const item=queue.buffers[message.index], v=item.view, kinds=[];
            for(let at=0;at<message.bytes;at+=v.getUint32(at,true)) kinds.push(v.getUint32(at+28,true));
            packets.push({index:message.index,seq:message.seq,commands:message.commands,bytes:message.bytes,kinds});
          }
          if(held && message.t==='batch') pending.push(message);
          else worker.postMessage(message);
        },
        terminate:()=>worker.terminate(),
      };
      worker.on('message', data=>port.onmessage?.({data}));
      worker.on('error', error=>{ console.error(error); port.onerror?.(error); });
      return port;
    }});
  try {
    assert(queue.ready(), 'real native consumer is ready');
    const observations=[];
    const read=label=>{
      call('glReadPixels',[0,0,8,8,0x1908,0x1401,output]);
      assert.equal(call('glGetError'),0,'valid GL operations: '+label);
      return Array.from(new Uint8Array(memory.buffer,wa(output),256));
    };
    const check=(pixels,left,right,label)=>{
      const expected=[quantize(left),quantize(right)];
      for(let y=0;y<8;y++) for(let x=0;x<8;x++) {
        const actual=pixels.slice((y*8+x)*4,(y*8+x+1)*4), want=expected[x<4?0:1];
        assert(distance(actual,want)<=3, `${name} ${label} (${x},${y}) ${actual} expected ${want}`);
      }
      observations.push({label,expected,actual:[pixels.slice(0,4),pixels.slice(16,20)]});
    };
    const quad=(left=-1)=>{
      call('glBegin',[7]);
      for(const [x,y] of [[left,-1],[1,-1],[1,1],[left,1]]) call('glVertex3f',[x,y,-.5].map(f));
      call('glEnd');
    };
    for(const cap of [0xde1,0xb60,0xbe2]) call('glEnable',[cap]);
    call('glClearColor',destination.map(f));call('glClear',[0x4000]);
    const before=read('clear before queue');
    held=true;
    const fencesBefore=queue.stats.fences;
    quad();
    assert.equal(queue.stats.glQueued,1,'first draw went through production Encoder');
    assert.equal(pending.length,1,'first real packet held before worker replay');
    assert.equal(Atomics.load(queue.control,D3D.CTRL.COMPLETED),queue.lastSubmitted-1,
      'first draw has not been consumed');

    // Change the bound texture without changing the first texture's storage.
    // Fog vector data is consumed at the setter; reuse its guest scratch too.
    call('glBindTexture',[0xde1,2]);
    nextFog.forEach((v,i)=>dv.setFloat32(wa(input)+i*4,v,true));
    call('glFogfv',[0xb66,input]);
    new Uint8Array(memory.buffer,wa(input),16).fill(0);
    call('glFogf',[0xb64,f(2)]); // second draw: fog factor .75
    call('glBlendFunc',[1,0x303]); // ONE, ONE_MINUS_SRC_ALPHA
    assert.equal(queue.stats.fences,fencesBefore,'state changes did not fence first draw');
    quad(0); // overlap right half: draw order is visible
    assert.equal(queue.stats.glQueued,2,'second draw is queued with changed state');
    assert.equal(queue.stats.fences,fencesBefore,'both draws precede any consumer fence');
    assert.equal(Atomics.load(queue.control,D3D.CTRL.COMPLETED),0,'no packet replayed before mutation');
    // A readback would be a fence; inspect canonical drawable bytes instead.
    // The first snapshot names the actual DxObject render target.
    const item=queue.buffers[packets[0].index];
    const rt=item.view.getUint32(32+952,true);
    const pitch=dv.getUint16(rt+18,true), bits=dv.getUint32(rt+20,true);
    assert(rt && bits && pitch,'real queued snapshot names canonical surface');
    const canonical=new Uint8Array(memory.buffer,bits,pitch*8);
    assert(canonical.every((v,i)=>v===before[(Math.floor(i/pitch)*8+Math.floor((i%pitch)/4))*4+[2,1,0,3][i%4]]),
      'queued draw has not changed destination before delivery');
    release();
    const pixels=read('two queued draws with changed texture binding');
    const first=blend(mist(texture(primary),.5),destination);
    const secondSource=primary.map((v,i)=>v*nextTexel[i]/255)
      .map((v,i)=>i===3?v:.75*v+.25*nextFog[i]);
    const over=d=>secondSource.map((v,i)=>Math.min(1,v+d[i]*(1-secondSource[3])));
    const second=over(first);
    check(pixels,first,second,'old state left / ordered new state right');
    const wrongSecond={
      staleTexture:primary.map((v,i)=>v*texel[i]/255)
        .map((v,i)=>i===3?v:.75*v+.25*nextFog[i]),
      staleFog:mist(primary.map((v,i)=>v*nextTexel[i]/255),.5),
    };
    for(const [label,source] of Object.entries(wrongSecond)) {
      const color=source.map((v,i)=>Math.min(1,v+first[i]*(1-source[3])));
      assert(distance(pixels.slice(16,20),quantize(color))>8,'second draw discriminates '+label);
    }
    assert(distance(pixels.slice(16,20),quantize(blend(secondSource,first)))>8,
      'second draw discriminates stale blend factors');
    const wrong={
      fogBeforeTexture:blend(texture(mist(primary,.5)),destination),
      fogAfterBlend:mist(blend(texture(primary),destination),.5),
      fogChangesAlpha:blend(mist(texture(primary),.5).map((v,i)=>i===3?.5*v+.5*fog[3]:v),destination),
      missingTextureAlpha:blend(mist(texture(primary),.5).map((v,i)=>i===3?primary[3]:v),destination),
      secondWithoutFirst:over(destination),
      reverseDraws:blend(mist(texture(primary),.5),over(destination)),
      firstWithNewState:over(destination),
    };
    for(const [label,color] of Object.entries(wrong)) {
      const actual=pixels.slice(label==='secondWithoutFirst'||label==='reverseDraws'?16:0,
        label==='secondWithoutFirst'||label==='reverseDraws'?20:4);
      assert(distance(actual,quantize(color))>8,'pixels discriminate '+label);
    }
    // A third draw makes each stored destination alpha visible in RGB.
    const overlay=[1,0,0,.25];
    call('glDisable',[0xde1]);call('glDisable',[0xb60]);
    call('glBlendFunc',[0x304,0x305]);call('glColor4f',overlay.map(f));
    quad();
    const witness=d=>overlay.map((v,i)=>v*d[3]+d[i]*(1-d[3]));
    check(read('destination-alpha witness'),witness(first),witness(second),'stored alpha becomes visible in RGB');
    assert.equal(queue.stats.glQueued,3,'third draw also uses real queued consumer');
    const stats=queue.snapshot();
    assert.equal(stats.fallbacks,0,'no native synchronous raster fallback');
    assert.equal(stats.replayCommands,3,'three queued draws consumed');
    assert(stats.glTriangles>=6,'consumer executed real native triangles');
    call('wglMakeCurrent',[0,0]);call('wglDeleteContext',[context]);
    api('ReleaseDC',[hwnd,dc]);api('DestroyWindow',[hwnd]);
    return {name,sha256:hash(bytes),bytes:bytes.length,pe:{path:path.relative(root,pePath),sha256:hash(pe)},
      route:'compiled WAT public x86 GL calls / D3DCommandStream.Encoder / actual worker_threads d3d-render-worker.js / native gl_sw_worker_draw / glReadPixels RGBA8',
      calls,stats,packets,operations,observations,wrongOrderColors:Object.fromEntries(Object.entries(wrong).map(([k,v])=>[k,quantize(v)]))};
  } finally {
    release();
    try { queue.fence(); } finally { await worker.terminate(); }
  }
}
async function main() {
  const results=[];
  for(const name of ['wine-assembly.wasm','wine-assembly.compat.wasm']) {
    try { results.push(await run(name));console.log('PASS',JSON.stringify(results.at(-1))); }
    catch(error) {results.push({name,passed:false,error:String(error)});console.error(name,error);}
  }
  if(process.env.GL_QUEUED_FRAGMENT_COMPOSITION_EVIDENCE)
    fs.writeFileSync(process.env.GL_QUEUED_FRAGMENT_COMPOSITION_EVIDENCE,JSON.stringify({passed:results.every(r=>r.passed!==false),results},null,2));
  assert(results.every(r=>r.passed!==false),'both compiled modules pass queued composition');
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
