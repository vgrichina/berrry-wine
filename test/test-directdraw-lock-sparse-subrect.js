#!/usr/bin/env node
// Complete production module and published COM vtables; split guest backing.
'use strict';
const assert=require('assert/strict'), fs=require('fs'), path=require('path'), crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const regions=require(root+'/lib/region-map.generated');
const apis=require(root+'/src/api_table.json');
// Frozen before the first baseline execution. All rows and offsets are literal.
const oracle = {
  base: 0x30000fe0, pitch: 32, width: 5, height: 3, rect: [1,1,4,3],
  guard: 0xa7, decoy: 0xd7,
  cases: [
    { bpp: 8, pointer: 0x30001001, rows: [[1,2,3],[4,5,6]] },
    { bpp: 16, pointer: 0x30001002, rows: [[0,248,224,7,31,0],[255,255,224,255,255,7]] },
    { bpp: 24, pointer: 0x30001003, rows: [[0,0,255,0,255,0,255,0,0],[255,255,255,0,255,255,255,255,0]] },
    { bpp: 32, pointer: 0x30001004, rows: [[0,0,255,0,0,255,0,0,255,0,0,0],[255,255,255,0,0,255,255,0,255,255,0,0]] },
  ],
  rgba: [
    0,0,0,255, 0,0,0,255, 0,0,0,255, 0,0,0,255, 0,0,0,255,
    0,0,0,255, 255,0,0,255, 0,255,0,255, 0,0,255,255, 0,0,0,255,
    0,0,0,255, 255,255,255,255, 255,255,0,255, 0,255,255,255, 0,0,0,255,
  ],
  presents: 1, uploads: 1, attaches: 1, frameEnds: 0,
};

const {bootRenderHarness}=require(root+'/test/render-helper');
(async()=>{
const wasm=process.argv[2]?fs.readFileSync(process.argv[2]):require('./compile-src').compileSrcWasm();
console.log('module',crypto.createHash('sha256').update(wasm).digest('hex'));
let counters={presents:0,uploads:0,attaches:0};
const h=await bootRenderHarness({prebuiltModule:await WebAssembly.compile(wasm),fonts:'none',width:5,height:3,beforeInstantiate(ctx,host){
for(const [name,key] of [['gdi_surface_upload','uploads'],['gdi_surface_attach','attaches']]) {const original=host[name];host[name]=(...args)=>{counters[key]++;return original(...args);};}
const trace=host.dx_trace;host.dx_trace=(...args)=>{if(args[0]===5)counters.presents++;return trace(...args);};
}});
const e=h.exports,memory=h.memory;
const pe=fs.readFileSync(root+'/test/binaries/calc.exe');new Uint8Array(memory.buffer).set(pe,e.get_staging());assert(e.load_pe(pe.length));e.init_dx_com_thunks();
  const read = p => e.guest_read32(p) >>> 0;
  const write = (p, n) => e.guest_write32(p, n >>> 0);
  const alloc = n => { const p = e.guest_alloc(n) >>> 0; assert(p); return p; };
  const snapshot = (p, n) => Array.from({ length: n }, (_, i) => e.guest_read8(p + i));
  const fill = (p, n, value) => { for (let i = 0; i < n; i++) e.guest_write8(p + i, value); };
  const stack = alloc(8192) + 4096;
  let calls = 0;
  function invoke(args, object, slot, target) {
    const code = [], word = n => code.push(n & 255, (n >>> 8) & 255, (n >>> 16) & 255, n >>> 24);
    for (const arg of args.slice().reverse()) { code.push(0x68); word(arg); }
    if (object) {
      assert(read(read(object) + slot * 4), 'published COM method');
      code.push(0xb8); word(object);
      code.push(0x8b, 0x00, 0xff, 0x90); word(slot * 4);
    } else { code.push(0xb8); word(target); code.push(0xff, 0xd0); }
    const result = alloc(8);
    code.push(0xa3); word(result);
    code.push(0x89, 0x25); word(result + 4); code.push(0xc3);
    const pc = alloc(code.length);
    code.forEach((b, i) => e.guest_write8(pc + i, b));
    e.set_esp(stack); e.call_func(pc, 0, 0, 0, 0);
    for (let n = 0; n < 100 && e.get_eip(); n++) e.run(10000);
    assert.equal(e.get_eip(), 0, 'bounded guest return');
    assert.equal(read(result + 4), stack - 20, 'exact COM stdcall cleanup');
    assert.equal(e.get_esp() >>> 0, stack - 16, 'caller RET');
    calls++;
    return read(result);
  }
  const com = (obj, slot, ...args) => invoke([obj, ...args], obj, slot);
  const ok = hr => assert.equal(hr, 0);
  const guid = words => { const p = alloc(16); words.forEach((n, i) => write(p + i * 4, n)); return p; };
  const iid7 = guid([0x15e65ec0, 0x11d23b9c, 0x60002fb9, 0x5bea9797]);
  const out = alloc(4), dv = new DataView(memory.buffer);
  const thunkWa = regions.BASE.THUNK_BASE;
  const thunk = (thunkWa - e.get_guest_base() + e.get_image_base()) >>> 0;
  const saved = dv.getUint32(thunkWa + 4, true);
  try {
    dv.setUint32(thunkWa + 4, apis.find(a => a.name === 'DirectDrawCreateEx').id, true);
    ok(invoke([0, out, iid7, 0], 0, 0, thunk));
  } finally { dv.setUint32(thunkWa + 4, saved, true); }
  const dd = read(out); assert(dd); ok(com(dd, 20, 0, 8));

function api(name,...args){const save=dv.getUint32(thunkWa+4,true);try{dv.setUint32(thunkWa+4,apis.find(a=>a.name===name).id,true);return invoke(args,0,0,thunk);}finally{dv.setUint32(thunkWa+4,save,true);}}
// Interleave commits using real guest VirtualAlloc: adjacent guest pages have
// unrelated physical backing, separated by a live decoy allocation.
assert.equal(api('VirtualAlloc',0x30000000,0x1000,0x1000,4),0x30000000);
assert.equal(api('VirtualAlloc',0x31000000,0x1000,0x3000,4),0x31000000);
assert.equal(api('VirtualAlloc',0x30001000,0x1000,0x1000,4),0x30001000);
console.log('maps', [0x30000000,0x30001000,0x31000000].map(p=>[p,e.guest_to_wasm(p)>>>0]));
assert.notEqual((e.guest_to_wasm(0x30000000)>>>0)+4096,e.guest_to_wasm(0x30001000)>>>0,'fixture must split adjacent guest pages');
const desc=alloc(124), lock=alloc(124), rect=alloc(16), output=alloc(4);
const checks=[];function check(name,got,want){try{assert.deepEqual(got,want);checks.push({name,pass:true});}catch{checks.push({name,pass:false,got,want});}}
const hwnd=0x10001;
h.renderer.createWindow(hwnd,0x10000000,0,0,5,3,'Subrect',0);
e.wnd_table_set(hwnd,0);e.ctrl_set_geom(hwnd,0,0,5,3);e.wnd_set_style_export(hwnd,0x10000000);e.test_gdi_client_rect_set(hwnd,0,0,5,3);
function create(bpp,caps,pixels=0){fill(desc,124,0);for(const[o,v]of [[0,124],[4,pixels?0x180f:0x1007],[8,3],[12,5],[16,32],[36,pixels],[72,32],[76,bpp===8?0x60:0x40],[84,bpp],[88,bpp===16?0xf800:bpp===8?0:0xff0000],[92,bpp===16?0x7e0:bpp===8?0:0xff00],[96,bpp===16?0x1f:bpp===8?0:0xff],[104,caps]])write(desc+o,v);ok(com(dd,6,desc,output,0));return read(output);}
function get(s){fill(lock,124,0xa5);write(lock,124);ok(com(s,22,lock));return [read(lock+36),read(lock+16),read(lock+12),read(lock+8)];}
function open(s,r){write(lock,124);if(r)r.forEach((v,i)=>write(rect+4*i,v));ok(com(s,25,r?rect:0,lock,1,0));return [read(lock+36),read(lock+16),read(lock+12),read(lock+8)];}
for(const c of oracle.cases){
const prefix=c.bpp+'bpp ', bps=c.bpp/8;
e.test_dx_set_process_state(5,3,c.bpp,1,hwnd,1,0);
fill(oracle.base-8,112,oracle.guard);fill(0x31000000,4096,oracle.decoy);
const s=create(c.bpp,0x840,oracle.base);
check(prefix+'GetSurfaceDesc base/pitch/size',get(s),[0,32,5,3]);
check(prefix+'whole Lock base/pitch/size',open(s,null),[oracle.base,32,5,3]);ok(com(s,32,0));
const actual=open(s,oracle.rect);
check(prefix+'subrect pointer/pitch/size',actual,[c.pointer,32,5,3]);
for(let y=0;y<2;y++)c.rows[y].forEach((v,i)=>e.guest_write8(actual[0]+y*32+i,v));
ok(com(s,32,rect));
const want=Array(112).fill(oracle.guard);for(let y=0;y<2;y++)want.splice(8+32+y*32+bps,c.rows[y].length,...c.rows[y]);
check(prefix+'guest pixels/padding/perimeter',snapshot(oracle.base-8,112),want);
check(prefix+'unrelated committed allocation unchanged',snapshot(0x31000000,4096),Array(4096).fill(oracle.decoy));
check(prefix+'post Unlock descriptor stable',get(s),[0,32,5,3]);
// Copy the intended guest rectangle into a real primary and Unlock it.
// This is a software sprite copy; all address reads and writes use the guest
// translator. Canvas conversion and composition are entirely production.
const primary=create(c.bpp,0x200);
if(c.bpp===8){const pal=alloc(1024);fill(pal,1024,0);[0,0x000000ff,0x0000ff00,0x00ff0000,0x00ffffff,0x0000ffff,0x00ffff00].forEach((v,i)=>write(pal+i*4,v));ok(com(dd,5,4,pal,output,0));ok(com(primary,31,read(output)));}
let p=open(primary,null);fill(p[0],p[1]*3,0);ok(com(primary,32,0));h.renderer.repaint();
const before={...counters}, frames=e.get_present_frame_ends();
p=open(primary,oracle.rect);
for(let y=0;y<2;y++)for(let i=0;i<c.rows[y].length;i++)e.guest_write8(p[0]+y*p[1]+i,e.guest_read8(c.pointer+y*32+i));
ok(com(primary,32,rect));h.renderer.repaint();
const primaryBytes=Array(p[1]*3).fill(0);for(let y=0;y<2;y++)primaryBytes.splice((y+1)*p[1]+bps,c.rows[y].length,...c.rows[y]);
check(prefix+'primary native bytes and untouched perimeter',snapshot(p[0]-p[1]-bps,p[1]*3),primaryBytes);
check(prefix+'final composited RGBA',Array.from(h.canvas.getContext('2d').getImageData(0,0,5,3).data),oracle.rgba);
for(const key of ['presents','uploads','attaches'])check(prefix+key,counters[key]-before[key],oracle[key]);
check(prefix+'subrect frame ends',e.get_present_frame_ends()-frames,oracle.frameEnds);
com(primary,2);com(s,2);
}
com(dd,2);
console.log(JSON.stringify({calls,passed:checks.filter(c=>c.pass).length,total:checks.length,checks},null,2));
assert(checks.every(c=>c.pass),'Lock alias subrect contract');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
