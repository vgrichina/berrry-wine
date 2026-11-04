#!/usr/bin/env node
'use strict';
// Original deterministic x86 guest; offline mode NEVER instantiates a module.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { makeFixture: seedPE, iat, BASE } = require('../tools/kernel32-native-fixture');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const POISON = 0xa5a5a5a5;
const option = n => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);

function fixture() {
  const pe = Buffer.alloc(0x18200); seedPE().copy(pe);
  const raw = va => va - BASE - 0x1000 + 0x200;
  const put = (va, n) => pe.writeUInt32LE(n >>> 0, raw(va));
  // Enlarge the existing single executable/read/write section, retaining real
  // kernel32 imports. No imports, API catalog IDs or COM vtables are patched.
  const optional = 0x98, section = optional + 0xe0;
  pe.writeUInt32LE(0x19000, optional + 56);
  pe.writeUInt32LE(0x18000, section + 8);
  pe.writeUInt32LE(0x18000, section + 16);
  pe.writeUInt32LE(0x3000, optional + 16);
  let data = BASE + 0x10000;
  const alloc = (size, poison = false) => {
    const p = data; data += (size + 3) & ~3;
    assert(data < BASE + 0x19000);
    if (poison) pe.fill(0xa5, raw(p), raw(p) + size);
    return p;
  };
  const string = s => { const p = alloc(s.length + 1); pe.write(s, raw(p)); return p; };
  const guid = words => { const p = alloc(16); words.forEach((v, i) => put(p + i * 4, v)); return p; };
  const mem = p => ({ mem: p });
  const code = [], calls = [], caps = [], guards = [], pointers = [];
  const byte = (...v) => code.push(...v);
  const word = n => byte(n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24);
  const baseEsp = alloc(4), completed = alloc(4);
  byte(0x89, 0x25); word(baseEsp); // mov [baseEsp],esp
  // Record BEFORE any restoration. A broken callee stack cannot be hidden by
  // call_func's outer continuation. On HRESULT failure return before deref.
  const failureJumps = [];
  function call(label, args, object, slot, target, expected = 0) {
    for (const arg of [...args].reverse()) {
      if (typeof arg === 'object') { byte(0xff, 0x35); word(arg.mem); }
      else { byte(0x68); word(arg); }
    }
    if (object) {
      byte(0xa1); word(object); byte(0x8b, 0x00, 0xff, 0x90); word(slot * 4);
    } else { byte(0xff, 0x15); word(target); }
    const record = alloc(8, true);
    byte(0xa3); word(record); byte(0x89, 0x25); word(record + 4);
    calls.push({ label, record, expected, args: args.length, slot, object, target });
    if (expected === 0) {
      byte(0x85, 0xc0, 0x0f, 0x85); failureJumps.push(code.length); word(0);
    }
  }
  const com = (label, obj, slot, args, expected = 0) =>
    call(label, [mem(obj), ...args], obj, slot, 0, expected);
  function output() {
    const p = alloc(12, true) + 4;
    guards.push({ p, size: 4 }); pointers.push(p); return p;
  }
  const module = alloc(4), factory = alloc(4);
  call('LoadLibraryA(ddraw.dll)', [string('ddraw.dll')], 0, null, iat('LoadLibraryA'), 'pointer');
  byte(0xa3); word(module);
  call('GetProcAddress(DirectDrawCreate)', [mem(module), string('DirectDrawCreate')],
    0, null, iat('GetProcAddress'), 'pointer');
  byte(0xa3); word(factory);
  const dd = output();
  call('DirectDrawCreate', [0, dd, 0], 0, null, factory);
  com('SetCooperativeLevel NORMAL', dd, 20, [0, 8]);
  const ddsd = alloc(108);
  for (const [o, v] of [[0,108],[4,0x1007],[8,4],[12,4],[72,32],[76,0x40],
    [84,32],[88,0xff0000],[92,0xff00],[96,0xff],[104,0x2040]])
    put(ddsd + o, v); // OFFSCREENPLAIN | 3DDEVICE, 4x4 RGB render target
  const surface = output();
  com('CreateSurface DDSURFACEDESC108', dd, 6, [ddsd, surface, 0]);
  const root2 = output(), dev2 = output();
  const iid2 = guid([0x6aae1ec1,0x11d0662a,0xaa009d88,0x6ab7bb00]);
  const hal = guid([0x84e63de0,0x11cf46aa,0x00006f81,0x6e1520c0]);
  com('QI IDirect3D2', dd, 0, [iid2, root2]);
  com('IDirect3D2 CreateDevice', root2, 8, [hal, mem(surface), dev2]);
  const versions = [
    [1,[0x64108800,0x11d0957d,0xa000ab89,0x294105c9],4],
    [2,null,3],
    [3,[0xb0ab3b60,0x11d133d7,0xc00081a9,0x74b1d74f],3],
    [7,[0xf5049e79,0x11d24861,0xa00007a4,0xa82906c9],3],
  ];
  const acquired = [];
  for (const [version, iid, slot] of versions) {
    const device = iid ? output() : dev2;
    if (iid) { com(`QI Device${version}`, dev2, 0, [guid(iid), device]); acquired.push(device); }
    for (const size of version === 7 ? [236] : [172,204,252]) {
      // Both alignments from the prior source tests, now at real guest addresses.
      for (const skew of [0,1]) {
        const outputs = [];
        for (const side of version === 7 ? ['fixed'] : ['HW','HEL']) {
          const p = alloc(size + 12, true) + 4 + skew;
          if (version !== 7) put(p, size);
          guards.push({ p, size });
          caps.push({ p, size, version, side, route: 'GetCaps' });
          outputs.push(p);
        }
        com(`Device${version} GetCaps ${size} skew${skew}`, device, slot, outputs);
      }
    }
  }
  // Public EnumDevices callbacks copy descriptors while callback storage is live.
  // Copy EVERY callback's HW/HEL descriptors, then CANCEL at HAL.
  // Enumeration order/count is this project's deterministic driver contract.
  const enumPlans = [];
  for (const [version, iid, slot] of [
    [1,[0x3bba0080,0x11cf2421,0xaa001aa3,0x5633b900],4],
    [2,null,3],
    [3,[0xbb223240,0x11d0e72b,0xaa00b4a9,0x3e99c000],3],
    [7,[0xf5049e77,0x11d24861,0xa00007a4,0xa82906c9],3],
  ]) {
    const root = iid ? output() : root2;
    if (iid) { com(`QI IDirect3D${version}`, dd, 0, [guid(iid), root]); acquired.push(root); }
    const count = alloc(4), context = alloc(4), copies = [];
    const expectedCount = version <= 2 ? 3 : version === 3 ? 2 : 1;
    for (const side of version === 7 ? ['fixed'] : ['HW','HEL']) {
      const size = version === 7 ? 236 : 252, stride = size + 8;
      const base = alloc(stride * expectedCount, true) + 4;
      for(let callback=0;callback<expectedCount;callback++) {
        const p=base+callback*stride;
        guards.push({ p, size }); caps.push({ p, size, version, side, callback, route: 'EnumDevices' });
      }
      copies.push({ p:base, size, stride });
    }
    const cbArg = alloc(4);
    // Callback address is patched into PUSH immediate once appended below.
    const start = code.length;
    com(`IDirect3D${version} EnumDevices`, root, slot, [0xfeedface, context]);
    const marker = Buffer.from(code).indexOf(Buffer.from([0x68,0xce,0xfa,0xed,0xfe]), start);
    assert(marker >= start);
    enumPlans.push({ version, count, context, copies, expectedCount, cbArg, patch: marker + 1 });
  }
  for (const obj of [...acquired.reverse(),dev2,root2,surface,dd])
    com('Release', obj, 2, [], 'refcount');
  byte(0xc7, 0x05); word(completed); word(1);
  const end = code.length; byte(0xc3);
  for (const jump of failureJumps) {
    const b = Buffer.alloc(4); b.writeInt32LE(end - (jump + 4));
    code.splice(jump, 4, ...b);
  }
  for (const plan of enumPlans) {
    const address = BASE + 0x3000 + code.length;
    const b = Buffer.alloc(4); b.writeUInt32LE(address); code.splice(plan.patch, 4, ...b);
    const v7 = plan.version === 7;
    // Preserve nonvolatile registers, use EBP for original callback arguments.
    byte(0x55,0x89,0xe5,0x56,0x57,0xfc);
    byte(0xff,0x05); word(plan.count);
    byte(0x8b,0x45,v7 ? 20 : 28,0xa3); word(plan.cbArg);
    for (let i = 0; i < plan.copies.length; i++) {
      byte(0x8b,0x75,v7 ? 16 : 20 + i * 4);
      byte(0xbf); word(plan.copies[i].p);
      byte(0xa1); word(plan.count); byte(0x48,0x69,0xc0); word(plan.copies[i].stride);
      byte(0x01,0xc7); // edi += (count-1)*guarded descriptor stride
      byte(0xb9); word(plan.copies[i].size);
      byte(0xf3,0xa4);
    }
    byte(0xa1); word(plan.count); byte(0x83,0xf8,plan.expectedCount,0x0f,0x92,0xc0,0x0f,0xb6,0xc0);
    byte(0x5f,0x5e,0x5d,0xc2,v7 ? 16 : 24,0);
  }
  assert(code.length < 0xd000);
  Buffer.from(code).copy(pe, raw(BASE + 0x3000));
  return { pe, code: Buffer.from(code), manifest: {
    entry: BASE + 0x3000, baseEsp, completed, calls, guards, pointers, caps, enumPlans,
  } };
}

function verify(m, read) {
  const esp = read(m.baseEsp); assert(esp && esp !== POISON, 'guest entry ESP recorded');
  for (const c of m.calls) {
    const hr = read(c.record);
    if (c.expected === 0) assert.equal(hr, 0, `${c.label}: HRESULT`);
    else if (c.expected === 'pointer') assert(hr && hr !== POISON, `${c.label}: nonnull`);
    else assert.notEqual(hr, POISON, 'Release executed');
    assert.equal(read(c.record + 4), esp, `${c.label}: pre-restore stdcall ESP`);
  }
  assert.equal(read(m.completed), 1, 'guest completed every call');
  for (const p of m.pointers) assert(read(p) && read(p) !== POISON, 'public output pointer');
  for (const { p, size } of m.guards) {
    assert.equal(read(p - 4), POISON, 'leading canary');
    assert.equal(read(p + size), POISON, 'trailing canary');
  }
  for (const c of m.caps) {
    if (c.version !== 7) assert.equal(read(c.p), c.size, 'descriptor dwSize');
    for (const prim of c.version === 7 ? [4,60] : [44,100]) {
      assert.equal(read(c.p + prim), 56, 'D3DPRIMCAPS size');
      assert.equal(read(c.p + prim + 32), process.argv.includes('--expect-projected')?0xf7df:0xf3df,
        'CUBEMAP absent; unsupported PROJECTED absent');
      assert.equal(read(c.p + prim + 36), c.version === 7 ?
        (prim === 60 ? 0x030303ff : 0x030003c3) : 0xc3,
        'point/linear and D3D7 triangle mips retained');
      assert.equal(read(c.p + prim + 44), 0xf7, 'BORDER absent; address modes retained');
    }
    if (c.version === 7) assert.equal(read(c.p + 180), 0xf, 'current texture ops retained');
  }
  for (const p of m.enumPlans) {
    assert.equal(read(p.count), p.expectedCount, 'callback CONTINUE/CANCEL honored');
    assert.equal(read(p.cbArg), p.context, 'callback context argument');
  }
}

function offline(f) {
  assert.deepEqual(f.pe, fixture().pe, 'deterministic PE');
  // Synthetic oracle vectors only, never represented as API execution.
  const m = f.manifest, values = new Map();
  const set = (p,v) => values.set(p,v >>> 0);
  set(m.baseEsp,0x123400); set(m.completed,1);
  for (const c of m.calls) { set(c.record,c.expected === 'pointer' ? 0x7500000 : 0); set(c.record+4,0x123400); }
  for (const p of m.pointers) set(p,0x7500100);
  for (const g of m.guards) { set(g.p-4,POISON); set(g.p+g.size,POISON); }
  for (const c of m.caps) {
    if (c.version !== 7) set(c.p,c.size);
    for (const o of c.version === 7 ? [4,60] : [44,100]) {
      set(c.p+o,56); set(c.p+o+32,0xf3df);
      set(c.p+o+36,c.version === 7 ? (o===60?0x030303ff:0x030003c3) : 0xc3); set(c.p+o+44,0xf7);
    }
    if (c.version === 7) set(c.p+180,0xf);
  }
  for (const p of m.enumPlans) { set(p.count,p.expectedCount); set(p.cbArg,p.context); }
  const read = p => values.get(p) ?? POISON;
  verify(m,read);
  let negatives = 0;
  function reject(p,v,pattern) {
    const old=values.get(p); set(p,v); assert.throws(()=>verify(m,read),pattern);
    if (old === undefined) values.delete(p); else values.set(p,old);
    negatives++;
  }
  for (const c of m.caps) for (const o of c.version === 7 ? [4,60] : [44,100]) {
    reject(c.p+o+32,0xffdf,/CUBEMAP/);
    reject(c.p+o+32,0xf7df,/PROJECTED/);
    for (const bit of [4,8,16,32]) reject(c.p+o+36,read(c.p+o+36)^bit,/mip/);
    for (const bit of [1,2]) reject(c.p+o+36,read(c.p+o+36)&~bit,/point/);
    reject(c.p+o+44,0xff,/BORDER/);
  }
  for (const g of m.guards) { reject(g.p-4,0,/canary/); reject(g.p+g.size,0,/canary/); }
  for (const c of m.calls) {
    reject(c.record+4,0x123404,/stdcall/);
    if (c.expected === 0) reject(c.record,0x80004001,/HRESULT/);
  }
  for (const c of m.caps) if (c.version !== 7) reject(c.p,c.size+4,/dwSize/);
  for (const p of m.enumPlans) { reject(p.count,0,/CANCEL/); reject(p.cbArg,0,/context/); }
  reject(m.completed,0,/completed/);
  return { native: 'UNEXECUTED', negativeControls: negatives, calls: m.calls.length,
    descriptors: m.caps.length, peSHA256: hash(f.pe), codeSHA256: hash(f.code) };
}

// Bounded software rendering through the existing public x86 COM fixture.
// Supplied coordinates through public DrawPrimitive, plus a real native render
// Worker. Pixel expectations are independent rational-coordinate/LOD equations.
async function projected(bytes, out) {
  const vm = require('node:vm');
  const { browserFixture, plan, oracle } = require('./test-legacy-texture-rendered-contract');
  let source = browserFixture.toString();
  const replace = (from, to) => {
    assert.equal(source.split(from).length, 2, 'unique public fixture seam');
    source = source.replace(from, to);
  };
  replace("await ok(com('DrawPrimitive7',device,25,4,0x1c4,vertices,3,0));", `await ok(config.indexed
      ?com('DrawIndexedPrimitive7',device,26,4,0x1e2,vertices,3,indices,3,0)
      :com('DrawPrimitive7',device,25,4,0x1e2,vertices,3,0));`);
  const start = source.indexOf('    const geometry=async uv=>{');
  const end = source.indexOf('    const describe=async()=>{', start);
  assert(start > 0 && end > start);
  replace(source.slice(start, end), `    const matrix=await alloc(64),indices=await alloc(8);
    await words(indices,[0x10000,2]);
    const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
    await words(matrix,identity.map(bits));
    for(const type of [1,2,3])await ok(com('SetTransform7 identity',device,11,type,matrix));
    const geometry=async(sample,state)=>{
      const coords=state.uvs||[sample.uv,sample.uv,sample.uv];
      for(const [i,[x,y]] of [[-1,1],[1,1],[-1,-1]].entries()){
        let [u,v]=coords[i];
        if(state.baked){u/=state.q;v/=state.q;}
        const z=state.clip&&negative!=='unclipped'&&i===0?-.5:(state.geomW?[.2,.8,.6][i]:.5),w=state.geomW?1+.5*z:1;
        await words(vertices+i*32,[bits(x*w),bits(y*w),bits(z),0,
          0xffffffff,0,bits(u),bits(v)]);
      }
    };
    const setState=async state=>{
      const projection=identity.slice();if(state.geomW)projection[11]=.5;
      await words(matrix,projection.map(bits));await ok(com('SetTransform7 projection',device,11,3,matrix));
      const m=identity.slice();m[0]=m[5]=state.scale||1;m[2]=state.qU||0;m[6]=state.qV||0;m[14]=state.q;
      await words(matrix,m.map(bits));
      await ok(com('SetTransform7 TEXTURE0',device,11,16,matrix));
      const got=await guard(64);await ok(com('GetTransform7 TEXTURE0',device,12,16,got.p));
      await got.check();for(let i=0;i<16;i++)eq(await read(got.p+4*i),bits(m[i]),'matrix round trip');
      await tss(11,0);await tss(24,state.flags);
      const flags=await guard(4);await ok(com('GetTextureStageState flags',device,36,0,24,flags.p));
      await flags.check();eq(await read(flags.p),state.flags,'projection flags round trip');
      for(const [id,v] of [[16,1],[17,1],[18,state.mip?2:0],[13,1],[14,1]])await tss(id,v);
    };
`);
  replace('await geometry(sample.uv);await draw();await observe(state.label',
    `await setState(state);await geometry(sample,state);
      await ok(com('Clear7 sample',device,10,0,0,1,0xff0b1621,bits(1),0));await draw();
      if(config.queued){
        // The producer owns the record before returning from Draw. Change
        // TEXTURE0 and flags before the physical Worker receives the batch.
        await setState({...state,q:8,qU:0,qV:0,flags:0});
        if(negative==='live-matrix')corruptQueuedMatrix(nativeEncoder,e,memory);
        inspectQueuedPreparation(nativeEncoder,e,memory,evidence);
        evidence.queued.push({label:state.label,liveMatrixChangedBeforeFence:true});
      }
      await observe(state.label`);
  replace('p=l.pointer+2*l.pitch+2*4','p=l.pointer+sample.y*l.pitch+sample.x*4');
  replace('const expected=expectedColor(config.texture,sample.uv,state.filter,expectedAddress);',
    'const expected=expectedColor(config,state,sample,negative);');
  replace("      eq(actual,expected,'PIXEL ORACLE '+label);",`      if(state.clip){
        const clippedPixel=dibRGBA.slice((1*8+1)*4,(1*8+1)*4+3);
        row.clippedPixel=clippedPixel;
        eq(clippedPixel,[11,22,33],'PIXEL ORACLE CLIP '+label);
      }
      eq(actual,expected,'PIXEL ORACLE '+label);`);
  replace('const texture=await surface(2,2,0x1800);',
    'const texture=await surface(config.mip?16:2,config.mip?16:2,config.mip?0x401008:0x1800);');
  const fillStart=source.indexOf('    const texLock=await lock(texture);');
  const fillEnd=source.indexOf('    const viewport=await alloc(24);',fillStart);
  replace(source.slice(fillStart,fillEnd),`    if(config.mip){
      const levels=[texture],mc=await guard(16);await words(mc.p,[0x401000,0,0,0]);
      for(let i=1;i<5;i++)levels.push(await acquire(out=>com('GetAttachedSurface7 mip '+i,levels[i-1],12,mc.p,out)));
      await mc.check();evidence.levels=levels;
      for(const [i,obj] of levels.entries()){
        const l=await lock(obj),n=16>>i,[r,g,b]=config.colors[i];
        eq(await read(lockDesc.p+12),n,'public mip width');
        for(let y=0;y<n;y++)for(let x=0;x<n;x++)await write(l.pointer+y*l.pitch+x*4,0xff000000|r<<16|g<<8|b);
        await unlock(obj);
      }
    }else{
      const l=await lock(texture);
      for(let i=0;i<4;i++){const [r,g,b]=config.texture[i];await write(l.pointer+(i>>>1)*l.pitch+(i%2)*4,0xff000000|r<<16|g<<8|b);}
      await unlock(texture);
    }
`);
  // Actual production command encoder and render Worker, both using the full
  // supplied module. EndScene remains local until public Lock fences the queue.
  replace('  const held=[];', '  const held=[];let nativeEncoder,nativeWorker;');
  replace('host.memory=memory;host.gpu_gl_call=(...args)=>gpu?gpu.call(...args):0;',
    `host.memory=memory;host.gpu_gl_call=(...args)=>{
      if(!config.queued&&args[0]===0x20000)inspectPreparation(e,memory,args[1],evidence);
      return nativeEncoder?Math.max(0,nativeEncoder.call(...args)):gpu?gpu.call(...args):0;
    };`);
  replace("    const read=async p=>(await raw('guest_read32',p))>>>0;",`    if(config.queued){
      nativeEncoder=new NativeStream.Encoder({module,memory,sigs,strictReady:true,
        guestToWasm:p=>e.guest_to_wasm(p),getImageBase:()=>e.get_image_base(),
        workerFactory:()=>nativeWorker=new NativeWorker(nativeWorkerPath)});
      check(nativeEncoder.ready(),'physical native render Worker ready');
    }
    const read=async p=>(await raw('guest_read32',p))>>>0;`);
  replace("    evidence.status='PASS';return evidence;",`    if(nativeEncoder){evidence.transport=nativeEncoder.snapshot();
      eq(evidence.transport.fallbacks,0,'no native queue fallback');
      check(evidence.transport.replayCommands>0,'actual Worker completed commands');}
    evidence.status='PASS';return evidence;`);
  replace('    if(gpu)gpu.stop();','    if(gpu)gpu.stop();if(nativeEncoder){nativeEncoder.stop();await nativeWorker.terminate();}');
  const p = plan();
  const varying={uvs:[[3/8,5/8],[7/8,1/8],[1/8,7/8]],qU:1,q:.25};
  const config = { ...p, samples: [p.samples[0]], states: [
    {label:'disabled',flags:0,q:.5},
    {label:'projected-unit-q',flags:0x103,q:1},
    {label:'projected-half-q',flags:0x103,q:.5},
    {label:'projected-varying-q',flags:0x103,...varying},
    {label:'projected-near-clipped',flags:0x103,...varying,clip:true},
    {label:'projected-perspective',flags:0x103,...varying,geomW:true},
    {label:'projected-perspective-clipped',flags:0x103,...varying,geomW:true,clip:true},
    {label:'disabled-varying-q',flags:0,...varying},
    {label:'disabled-restored',flags:0,q:.5},
    {label:'application-predivided',flags:0,q:.5,baked:true},
  ].map(s=>({filter:1,address:1,...s})),
    thunkBase:require('../lib/region-map.generated').BASE.THUNK_BASE,
    factoryId:require('../src/api_table.json').find(x=>x.name==='DirectDrawCreateEx').id };
  const pe = fs.readFileSync(path.join(__dirname,'binaries/calc.exe'));
  config.imageBase=pe.readUInt32LE(pe.readUInt32LE(0x3c)+52);
  const routes=new Map([['/legacy-render.wasm',bytes],['/test/binaries/calc.exe',pe],
    ['/lib/host-import-sigs.generated.json',fs.readFileSync(path.join(__dirname,'../lib/host-import-sigs.generated.json'))]]);
  config.samples=[[2,3],[3,2],[3,3]].map(([x,y])=>({...p.samples[0],name:x+','+y,x,y}));
  config.colors=[[240,10,20],[20,230,30],[30,40,220],[210,180,20],[200,30,190]];
  const results=[];
  for(const suite of ['direct','indexed','queued','queued-indexed','mip','queued-mip','ignored-negative','early-divide-negative','fixed-lod-negative','unclipped-negative','queued-live-matrix-negative']) {
    const negative=({'ignored-negative':'ignored','early-divide-negative':'early','fixed-lod-negative':'lod',
      'unclipped-negative':'unclipped','queued-live-matrix-negative':'live-matrix'})[suite]||null;
    const context=vm.createContext({WebAssembly,performance,setTimeout,
      inspectPreparation:projectedPreparation,
      inspectQueuedPreparation:projectedQueuedPreparation,
      corruptQueuedMatrix:(encoder,e,memory)=>{
        for(const item of encoder.buffers)for(let offset=0;offset<item.used;offset+=item.view.getUint32(offset,true)){
          if(item.view.getUint32(offset+12,true)!==4)continue;
          const self=item.view.getUint32(offset+4,true),live=e.d3dim_gpu_supplied_matrix(self)>>>0;
          item.bytes.set(new Uint8Array(memory.buffer,live,64),offset+32+3136);
        }
      },
      NativeStream:require('../lib/d3d-command-stream'),NativeWorker:require('node:worker_threads').Worker,
      nativeWorkerPath:path.join(__dirname,'../lib/d3d-render-worker.js'),
      fetch:async url=>{assert(routes.has(url));const b=routes.get(url);
        return {arrayBuffer:async()=>Uint8Array.from(b).buffer,json:async()=>JSON.parse(b.toString())};},
      document:{createElement:()=>({style:{},getContext:()=>({putImageData(){}})}),body:{append(){}}},
      ImageData:class {constructor(data,width,height){Object.assign(this,{data,width,height});}},
    });
    const run=vm.runInContext('('+source+')',context);
    const mip=suite.includes('mip')||negative==='lod';
    const c={...config,queued:suite.startsWith('queued'),indexed:suite.includes('indexed'),mip,
      states:negative?[config.states[negative==='ignored'?2:negative==='unclipped'?4:3]]:config.states,
    };
    if(mip)c.states=[1,2,4,8].flatMap(scale=>[{}, {clip:true}, {geomW:true}, {geomW:true,clip:true}]
      .map(extra=>({...config.states[3],label:'mip scale '+scale+JSON.stringify(extra),scale,mip:true,...extra})));
    let failure;
    try {await run('software',c,projectedOracle.toString().replace('TEXEL_ORACLE',oracle.toString()),negative);}catch(e){failure=e.stack;}
    const evidence=JSON.parse(JSON.stringify(context.legacyTextureEvidence));
    results.push({suite,negative,failure:failure||null,...evidence});
    if(out) {fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'projected-observed.json'),
      JSON.stringify({wasmSHA256:hash(bytes),calcSHA256:hash(pe),adaptedFixtureSHA256:hash(source),results},null,2)+'\n');}
    if(!negative) {
      assert.equal(failure,undefined,suite);assert.equal(evidence.status,'PASS');
      assert.equal(evidence.observations.length,c.states.length*c.samples.length);
      for(const mask of evidence.advertised.textureCaps)
        assert.equal(mask&0x400,process.argv.includes('--expect-projected')?0x400:0,'public PROJECTED advertisement');
    } else {
      assert(failure?.includes('PIXEL ORACLE'),'negative must fail at rendered pixels: '+failure);
      assert(evidence.calls.some(c=>c.label==='DrawPrimitive7'&&c.result===0));
      const last=evidence.observations.at(-1);
      if(negative==='unclipped')assert.notDeepEqual(last.clippedPixel,[11,22,33]);
      else assert.notDeepEqual(last.actual,last.expected);
    }
  }
  console.log(JSON.stringify({projected:'PASS: supplied-coordinate projection',
    positivePixels:results.filter(r=>!r.negative).reduce((n,r)=>n+r.observations.length,0),
    renderedNegativeControls:5,wasmSHA256:hash(bytes)}));
}

// A recording boundary after the real legacy adapter's preparation/texture
// decoding and before Device.draw. This proves payload/shader-source transport,
// never GLSL acceptance, WebGL execution, GPU pixels or runtime performance.
function projectedPreparation(e,memory,wa,evidence) {
  const descriptor=new DataView(memory.buffer),type=descriptor.getUint32(wa+8,true);
  if(type!==4)return;
  const {D3DIMGpu}=require('../lib/d3dim-gpu');
  const adapter=new D3DIMGpu({getExports:()=>e,getMemory:()=>memory.buffer});
  const target={width:8,height:8,textureKeys:new Set()};
  adapter._target=()=>target;
  adapter._prepare=()=>{}; // no graphics context or target upload in this check
  let draw;
  adapter._submit=(_target,prepared)=>{draw=prepared;return 1;};
  assert.equal(adapter.call(0x20000,wa,0),1,'production GPU preparation accepts internal TL');
  assert(draw,'actual adapter submission');assert.equal(draw.stride,40);
  assert.equal(draw.fixedFunction.stages[0].transformFlags,0x103);
  assert.equal(draw.attributes.find(a=>a.usage===5).type,3);
  const self=descriptor.getUint32(wa,true),vertices=descriptor.getUint32(wa+12,true);
  const src=e.guest_to_wasm(vertices)>>>0,matrixWa=e.d3dim_gpu_supplied_matrix(self)>>>0;
  const matrix=Array.from(new Float32Array(memory.buffer,matrixWa,16));
  const actual=new DataView(draw.vertices.buffer),coordinates=[];
  for(let i=0;i<3;i++){
    const u=descriptor.getFloat32(src+i*32+24,true),v=descriptor.getFloat32(src+i*32+28,true);
    for(const c of [0,1,3])assert.equal(actual.getFloat32(i*40+c*4,true),
      descriptor.getFloat32(src+i*32+c*4,true),'geometric position and rhw independent of texture q');
    const want=Array.from({length:4},(_,c)=>Math.fround(u*matrix[c]+v*matrix[4+c]+matrix[12+c]));
    const got=Array.from({length:4},(_,c)=>actual.getFloat32(i*40+24+c*4,true));
    assert.deepEqual(got,want,'homogeneous texture coordinates retained in owned bytes');
    coordinates.push(got);
  }
  assert.notEqual(draw.vertices.buffer,memory.buffer,'queued GPU payload owns its bytes');
  const shader=require('../lib/d3d9-fixed').compile(draw,new Float32Array([0,0,8,8]));
  assert.match(shader.pixel.source,/ff_uv\.z/,'real fixed compiler divides by texture z');
  evidence.gpuPreparation||=[];
  evidence.gpuPreparation.push({boundary:'adapter payload and fixed GLSL source only',coordinates,
    stride:draw.stride,levels:draw.textures[0].levels?.length||1,
    vertexSHA256:hash(shader.vertex.source),pixelSHA256:hash(shader.pixel.source)});
  // Release only observer-owned texture watches; no renderer target exists.
  for(const texture of adapter.textures.values()){
    texture.watch?.release();texture.paletteWatch?.release();
  }
}

function projectedQueuedPreparation(encoder,e,memory,evidence) {
  // Read the actual production queue record after the live matrix changed.
  // Use the same snapshot override as the GPU render endpoint, at a recording
  // boundary only. The physical native Worker still replays the real record.
  for(const item of encoder.buffers)for(let offset=0;offset<item.used;){
    const read=n=>item.view.getUint32(offset+n,true),size=read(0);
    assert(size>0);
    if(read(12)===4){
      const state=e.guest_alloc(4096)>>>0,vertices=e.guest_alloc(read(24))>>>0,desc=e.guest_alloc(24)>>>0;
      const wa=p=>e.guest_to_wasm(p)>>>0,bytes=new Uint8Array(memory.buffer),view=new DataView(memory.buffer);
      bytes.set(item.bytes.subarray(offset+32,offset+32+4096),wa(state));
      bytes.set(item.bytes.subarray(offset+32+4096,offset+size),wa(vertices));
      [read(4),read(8),4,vertices,read(16),state].forEach((n,i)=>view.setUint32(wa(desc)+4*i,n,true));
      e.d3dim_gpu_state_override(state);
      try {projectedPreparation(e,memory,wa(desc),evidence);}
      finally {e.d3dim_gpu_state_override(0);}
      evidence.gpuPreparation.at(-1).queuedMatrixAfterLiveChange=true;
    }
    offset+=size;
  }
}

function projectedOracle(config,state,sample,negative) {
  const texel=TEXEL_ORACLE;
  const weights=[1-(sample.x+sample.y)/8,sample.x/8,sample.y/8];
  const uv=state.uvs||[sample.uv,sample.uv,sample.uv];
  const scale=state.scale||1,active=state.flags===0x103&&negative!=='ignored';
  const transformed=uv.map(([u,v],i)=>{
    const z=state.clip&&i===0?-.5:(state.geomW?[.2,.8,.6][i]:.5),w=state.geomW?1+.5*z:1;
    const t=state.baked?[u/state.q,v/state.q,1]:
      active?[u*scale,v*scale,state.q+(state.qU||0)*u+(state.qV||0)*v]:[u,v,1];
    return t.map(n=>n/w);
  });
  const interpolate=component=>transformed.reduce((sum,t,i)=>sum+weights[i]*t[component],0);
  const q=interpolate(2),numerator=[interpolate(0),interpolate(1)];
  const coords=negative==='early'?[0,1].map(c=>transformed.reduce((sum,t,i)=>sum+weights[i]*t[c]/t[2],0)):
    numerator.map(v=>v/q);
  if(!config.mip)return texel(config.texture,coords,1,1);
  // Derivatives of affine numerator / affine texture denominator.
  // Clipping preserves these planes at the interior sample.
  const derivatives=[1,2].map(i=>[0,1].map(c=>
    16*((transformed[i][c]-transformed[0][c])/8*q-
      numerator[c]*(transformed[i][2]-transformed[0][2])/8)/(q*q)));
  const rho=Math.max(...derivatives.map(d=>Math.hypot(...d)));
  const level=negative==='lod'?0:Math.min(4,Math.max(0,Math.floor(Math.log2(rho)+.5)));
  return config.colors[level];
}

async function native(f) {
  const file = option('wasm'), expected = option('sha256');
  assert(file && /^[0-9a-f]{64}$/.test(expected || ''), '--wasm and --sha256 required');
  const bytes = fs.readFileSync(file); assert.equal(hash(bytes),expected,'production module hash');
  if(process.argv.includes('--projected')) return projected(bytes,option('out'));
  const { createHostImports } = require('../lib/host-imports');
  const module = await WebAssembly.compile(bytes);
  const memory = new WebAssembly.Memory({ initial:8192, maximum:8192, shared:true });
  const ctx = { getMemory:()=>memory.buffer, renderer:null, resourceJson:{} };
  const imports = createHostImports(ctx); imports.host.memory=memory;
  for (const i of WebAssembly.Module.imports(module)) {
    assert.equal(i.module,'host');
    if (i.kind === 'function' && !imports.host[i.name])
      imports.host[i.name]=()=>{ throw Error(`Unexpected host dependency ${i.name}`); };
  }
  const e = (await WebAssembly.instantiate(module,imports)).exports; ctx.exports=e;
  new Uint8Array(memory.buffer).set(f.pe,e.get_staging()); assert(e.load_pe(f.pe.length),'load original PE');
  // Match host.js/test/run.js: load_pe does not initialize COM method tables.
  // Without this host bootstrap DirectDrawCreate returns an object with lpVtbl=0.
  e.init_dx_com_thunks();
  const stack=(e.guest_alloc(65536)>>>0)+65520;
  e.set_esp(stack); e.call_func(f.manifest.entry,0,0,0,0);
  for (let n=0;n<20000 && e.get_eip();n++) {
    e.run(1000); assert.equal(e.get_yield_reason(),0,'unexpected blocking dependency');
  }
  const out=option('out');
  if (out) {
    fs.mkdirSync(out,{recursive:true});
    const read=p=>e.guest_read32(p)>>>0;
    fs.writeFileSync(path.join(out,'native-observed.json'),JSON.stringify({
      wasmSHA256:expected, peSHA256:hash(f.pe), eip:e.get_eip()>>>0,
      esp:e.get_esp()>>>0, previousEip:e.get_dbg_prev_eip()>>>0,
      baseEsp:read(f.manifest.baseEsp), completed:read(f.manifest.completed),
      pointers:f.manifest.pointers.map(p=>{
        const object=read(p), vtable=read(object);
        return {p,object,vtable,slots:Array.from({length:23},(_,i)=>read(vtable+4*i))};
      }),
      calls:f.manifest.calls.map(c=>({...c,result:read(c.record),esp:read(c.record+4)})),
      descriptors:f.manifest.caps.map(c=>({...c,
        words:Array.from({length:c.size/4},(_,i)=>read(c.p+4*i))})),
      guards:f.manifest.guards.map(g=>({...g,before:read(g.p-4),after:read(g.p+g.size)})),
      callbacks:f.manifest.enumPlans.map(p=>({version:p.version,
        count:read(p.count),context:read(p.cbArg)})),
    },null,2)+'\n');
  }
  assert.equal(e.get_eip(),0,'bounded guest completion');
  verify(f.manifest,p=>e.guest_read32(p)>>>0);
  assert.equal(e.get_esp()>>>0,stack-16,'outer guest RET');
  console.log(JSON.stringify({ native:'PASS', wasmSHA256:expected, peSHA256:hash(f.pe),
    calls:f.manifest.calls.length, descriptors:f.manifest.caps.length }));
}
if (require.main === module) {
  const f=fixture();
  if (process.argv.includes('--offline')) {
    const result=offline(f), out=option('out');
    if (out) {
      fs.mkdirSync(out,{recursive:true});
      for (const [name,b] of [['guest.exe',f.pe],['guest-code.bin',f.code],
        ['manifest.json',JSON.stringify(f.manifest,null,2)+'\n'],
        ['offline.json',JSON.stringify(result,null,2)+'\n']]) fs.writeFileSync(path.join(out,name),b);
    }
    console.log(JSON.stringify(result));
  } else native(f).catch(e=>{ console.error(e); process.exitCode=1; });
}
module.exports={fixture,verify,offline};
