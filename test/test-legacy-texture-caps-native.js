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
  // Continue to HAL then CANCEL: exercises both HAL and HEL builder variants.
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
    for (const side of version === 7 ? ['fixed'] : ['HW','HEL']) {
      const size = version === 7 ? 236 : 252, p = alloc(size + 8, true) + 4;
      guards.push({ p, size }); caps.push({ p, size, version, side, route: 'EnumDevices' });
      copies.push({ p, size });
    }
    const cbArg = alloc(4), expectedCount = version <= 2 ? 3 : version === 3 ? 2 : 1;
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
    byte(0x83,0x3d); word(plan.count); byte(plan.expectedCount);
    byte(0x74,11); // je copy; otherwise CONTINUE (1), preserving registers
    byte(0xb8); word(1); byte(0x5f,0x5e,0x5d,0xc2,v7 ? 16 : 24,0);
    for (let i = 0; i < plan.copies.length; i++) {
      byte(0x8b,0x75,v7 ? 16 : 20 + i * 4);
      byte(0xbf); word(plan.copies[i].p);
      byte(0xb9); word(plan.copies[i].size);
      byte(0xf3,0xa4);
    }
    byte(0x31,0xc0,0x5f,0x5e,0x5d,0xc2,v7 ? 16 : 24,0);
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
      assert.equal(read(c.p + prim + 32), 0xf7df, 'CUBEMAP absent; PROJECTED retained');
      assert.equal(read(c.p + prim + 36), c.version === 7 ? 0x030003c3 : 0xc3,
        'point/linear retained; unsupported mip bits absent');
      assert.equal(read(c.p + prim + 44), 0xf7, 'BORDER absent; address modes retained');
    }
    if (c.version === 7) assert.equal(read(c.p + 180), 0x3ff, 'texture ops retained');
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
      set(c.p+o,56); set(c.p+o+32,0xf7df);
      set(c.p+o+36,c.version === 7 ? 0x030003c3 : 0xc3); set(c.p+o+44,0xf7);
    }
    if (c.version === 7) set(c.p+180,0x3ff);
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
    reject(c.p+o+32,0xf3df,/PROJECTED/);
    for (const bit of [4,8,16,32]) reject(c.p+o+36,read(c.p+o+36)|bit,/mip/);
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

async function native(f) {
  const file = option('wasm'), expected = option('sha256');
  assert(file && /^[0-9a-f]{64}$/.test(expected || ''), '--wasm and --sha256 required');
  const bytes = fs.readFileSync(file); assert.equal(hash(bytes),expected,'production module hash');
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
      baseEsp:read(f.manifest.baseEsp), completed:read(f.manifest.completed),
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
