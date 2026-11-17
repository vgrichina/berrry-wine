'use strict';
// Shared driver for test/test-d3d9-gps-*.js: the shipped CLI (calc.exe as a
// host process) under --control-stdin, with real x86 CALLs into the D3D9 COM
// thunks (the pattern of test-d3d9-software-cli.js). The old D3D9 path runs
// as the software renderer; --d3d9-gps=<backend> adds the v2 ring.
const path = require('path');
const { startControlSession } = require('../control-session');

const root = path.join(__dirname, '..', '..');

async function openD3d9GpsSession({ gps = 'software', renderer = 'software', size = 8, extra = [] } = {}) {
  const args = ['test/run.js', '--exe=test/binaries/calc.exe', '--no-build'];
  if (renderer) args.push(`--d3d9-renderer=${renderer}`);
  if (gps) args.push(`--d3d9-gps=${gps}`);
  args.push(...extra);
  args.push('--control-stdin', '--frozen', '--quiet-api', '--max-seconds=60',
    '--max-batches=1000000', '--batch-size=100');
  const session = startControlSession(args, { cwd: root, idPrefix: 'd9g' });
  const { child, send, output } = session;
  const deadline = setTimeout(() => { if (child.exitCode === null) child.kill('SIGTERM'); }, 100000);
  const command = (action, fields = {}) => send({ action, ...fields });
  const evaluate = code => command('eval', { code });
  await command('ping');
  // Let calc create its main window: the device presents into it.
  for (let i = 0; i < 400 && !(await evaluate('exports.get_main_hwnd()>>>0')); i++) await command('step', { n: 50 });
  if (!(await evaluate('exports.get_main_hwnd()>>>0'))) throw new Error('calc main window never appeared\n' + output());
  await evaluate(`(()=>{
    const e=exports,alloc=n=>e.guest_alloc(n)>>>0;
    const p=ctx.d9g={out:alloc(4),pp:alloc(64),vertices:alloc(256),marker:alloc(4),stack:alloc(4096),
      lr:alloc(8),rect:alloc(16),surface:alloc(4),ops:{}};
    new Uint8Array(memory.buffer,e.guest_to_wasm(p.pp),64).fill(0);
    // D3DPRESENT_PARAMETERS: ${size}x${size} A8R8G8B8, one buffer, DISCARD,
    // the calc window, windowed, Flags LOCKABLE_BACKBUFFER.
    [${size},${size},21,1,0,0,1,e.get_main_hwnd(),1,0,0,1].forEach((n,i)=>e.guest_write32(p.pp+i*4,n));
    p.view=()=>new DataView(memory.buffer);
    p.f32=(ga,values)=>{const v=p.view(),wa=e.guest_to_wasm(ga);values.forEach((n,i)=>v.setFloat32(wa+i*4,n,true));};
    p.u32=(ga,values)=>{const v=p.view(),wa=e.guest_to_wasm(ga);values.forEach((n,i)=>v.setUint32(wa+i*4,n>>>0,true));};
    const bridge=ctx.d3d9Bridge;
    if(bridge){const call=bridge.call;
      bridge.call=function(op,a,x){p.ops[op]=(p.ops[op]||0)+1;
        const r=call.call(this,op,a,x);
        if(p.onCall)p.onCall(op,a,x);
        return r;};}
    p.call=(name,args)=>{
      const id=ctx.apiTable.find(a=>a.name===name).id,base=e.get_thunk_base()>>>0;
      let thunk=0;for(let i=0;i<e.get_num_thunks();i++){
        if((e.guest_read32(base+i*8)>>>0)===0xcaca0010 && e.guest_read32(base+i*8+4)===id){thunk=base+i*8;break;}
      }
      if(!thunk)throw Error('missing thunk '+name);
      const dword=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255];
      const code=alloc(256),bytes=[...args.slice().reverse().flatMap(n=>[0x68,...dword(n)]),
        0xb8,...dword(thunk),0xff,0xd0,0xa3,...dword(p.marker),0xeb,0xfe];
      new Uint8Array(memory.buffer).set(bytes,e.guest_to_wasm(code));
      e.guest_write32(p.marker,0xdeadbeef);e.set_esp(p.stack+4000);e.clear_yield();e.set_eip(code);
    };
    return true;
  })()`);
  // Run one COM call to completion; its HRESULT.
  const call = async (name, args) => {
    await evaluate(`ctx.d9g.call(${JSON.stringify(name)},${args})`);
    for (let i = 0; i < 200; i++) {
      await command('step', { n: 10 });
      const value = await evaluate('exports.guest_read32(ctx.d9g.marker)>>>0');
      if (value !== 0xdeadbeef) return value >>> 0;
    }
    throw new Error(name + ' did not resume\n' + output());
  };
  const stat = i => evaluate(`exports.d3d9_gps_stat(${i})>>>0`);
  const stats = async () => {
    const names = ['draws', 'prims', 'clears', 'presents', 'gpuFrames', 'oldFrames', 'readbacks',
      'rtUploads', 'texUploads', 'texHits', 'shaders', 'syncs', 'declines', 'oldFail', 'opens', 'dead'];
    const s = {};
    for (let i = 0; i < names.length; i++) s[names[i]] = await stat(i);
    s.reasons = {}; s.sites = {};
    for (let r = 1; r < 32; r++) { const n = await stat(16 + r); if (n) s.reasons[r] = n; }
    for (let k = 0; k < 4; k++) { const n = await stat(48 + k); if (n) s.sites[k] = n; }
    s.oldPresent = {};
    for (let k = 0; k < 4; k++) { const n = await stat(64 + k); if (n) s.oldPresent[k] = n; }
    return s;
  };
  const close = async () => {
    try { await command('quit'); } catch (_) { /* child gone */ }
    const code = await session.exited;
    clearTimeout(deadline);
    if (child.exitCode === null) child.kill('SIGTERM');
    return code;
  };
  return { call, evaluate, command, stats, close, output, child };
}

// Guest writes for the common frame: POSITIONT (XYZRHW | DIFFUSE, stride 20)
// triangle over the upper-left half of an 8x8 target.
const RED = 0xffff0000, BLUE = 0xff0000ff;
const triangleXyzrhw = () => `ctx.d9g.f32(ctx.d9g.vertices,[0,0,.5,1,0, 8,0,.5,1,0, 0,8,.5,1,0]);
  ctx.d9g.u32(ctx.d9g.vertices+16,[${RED}]);ctx.d9g.u32(ctx.d9g.vertices+36,[${RED}]);
  ctx.d9g.u32(ctx.d9g.vertices+56,[${RED}]);true`;
// The same triangle as untransformed XYZ | DIFFUSE (stride 16) in clip space.
const triangleXyz = () => `ctx.d9g.f32(ctx.d9g.vertices,[-1,1,.5,0, 1,1,.5,0, -1,-1,.5,0]);
  ctx.d9g.u32(ctx.d9g.vertices+12,[${RED}]);ctx.d9g.u32(ctx.d9g.vertices+28,[${RED}]);
  ctx.d9g.u32(ctx.d9g.vertices+44,[${RED}]);true`;

module.exports = { openD3d9GpsSession, triangleXyzrhw, triangleXyz, RED, BLUE };
