'use strict';

// Public x86 COM calls and caller-authored physical renderer input only.
// Contract: https://learn.microsoft.com/en-us/previous-versions/windows/desktop/ee417894(v=vs.85)
// NULL PEEK counts the same selected-object records as a record-producing PEEK.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { bootRenderHarness } = require('./render-helper');
const RPC = require('../lib/guest-rpc');
const signatures = require('../lib/host-import-sigs.generated.json').sigs;
const regions = require('../lib/region-map.generated');
const apis = require('../src/api_table.json');

(async () => {
 const input = process.argv[2] ? fs.readFileSync(process.argv[2]) : require('./compile-src').compileSrcWasm();
 const bytes = input[0] === 31 ? zlib.gunzipSync(input) : input;
 if (process.env.DI_PEEK_MODULE_OUT) fs.writeFileSync(process.env.DI_PEEK_MODULE_OUT, zlib.gzipSync(bytes));
 console.log('module SHA256=' + crypto.createHash('sha256').update(bytes).digest('hex'));
 const module = await WebAssembly.compile(bytes);
 for (const rpc of [false, true]) {
  let rpcCalls = 0;
  const h = await bootRenderHarness({prebuiltModule: module, fonts: 'none', beforeInstantiate(ctx, host) {
   host.get_ticks = () => 1000; ctx.renderer._guestNowMs = () => 1000;
   if (!rpc) return;
   const sigs = Object.fromEntries(['get_mouse_buttons_live', 'di_mouse_receipt', 'queue_mouse_input']
    .map(name => [name, signatures[name]]));
   const broker = RPC.createMainBroker(host.memory, {...host}, sigs);
   const worker = RPC.createWorkerImports(host.memory, sigs, m => {rpcCalls++; broker.serveRpc(m.slot);}, {slot: 2});
   Object.assign(host, worker.imports.host);
  }});
  const {exports: e, memory, renderer} = h;
  const pe = fs.readFileSync(require('node:path').join(__dirname, 'binaries/calc.exe'));
  new Uint8Array(memory.buffer).set(pe, e.get_staging());
  assert(e.load_pe(pe.length)); // Initializes the process; never runs the application.
  e.init_dx_com_thunks();
  const wr = (p,v) => e.guest_write32(p,v>>>0), rd = p => e.guest_read32(p)>>>0;
  const alloc = n => {const p=e.guest_alloc(n)>>>0; assert(p); return p;};
  const stack=alloc(8192)+4096;
  function invoke(args,obj,slot,target) {
   const code=[], word=v=>code.push(v&255,v>>>8&255,v>>>16&255,v>>>24);
   for(const a of args.slice().reverse()){code.push(0x68);word(a);}
   if(obj){assert(rd(rd(obj)+slot*4));code.push(0xb8);word(obj);code.push(0x8b,0,0xff,0x90);word(slot*4);}
   else {code.push(0xb8);word(target);code.push(0xff,0xd0);}
   const result=alloc(8);code.push(0xa3);word(result);code.push(0x89,0x25);word(result+4);code.push(0xc3);
   const pc=alloc(code.length);code.forEach((v,i)=>e.guest_write8(pc+i,v));
   e.set_esp(stack);e.call_func(pc,0,0,0,0);
   for(let i=0;i<100&&e.get_eip();i++)e.run(10000);
   assert.equal(e.get_eip(),0,'bounded x86 caller return');
   assert.equal(rd(result+4),stack-20,'stdcall cleanup');
   assert.equal(e.get_esp()>>>0,stack-16,'caller return stack');return rd(result);
  }
  const com=(obj,slot,...args)=>invoke([obj,...args],obj,slot);
  const out=alloc(4), guid=alloc(16), view=new DataView(memory.buffer);
  const wa=regions.BASE.THUNK_BASE, saved=view.getUint32(wa+4,true);
  try {
   view.setUint32(wa+4,apis.find(a=>a.name==='DirectInputCreateA').id,true);
   assert.equal(invoke([0x400000,0x700,out,0],0,0,(wa-e.get_guest_base()+e.get_image_base())>>>0),0);
  } finally {view.setUint32(wa+4,saved,true);}
  const root=rd(out);
  [0x6f1d2b60,0x11cfd5a0,0x4544c7bf,0x00005453].forEach((v,i)=>wr(guid+i*4,v));
  assert.equal(com(root,3,guid,out,0),0);const mouse=rd(out);
  const fmt=alloc(24), objects=alloc(64), prop=alloc(20), count=alloc(4);
  const area=alloc(288), data=area+16, state=alloc(32);
  const raw=(p,n)=>new Uint8Array(memory.buffer,e.guest_to_wasm(p)>>>0,n);
  function format(list) {
   [24,16,2,32,list.length,objects].forEach((v,i)=>wr(fmt+i*4,v));
   list.forEach(([ofs,type],i)=>[0,ofs,type,0].forEach((v,j)=>wr(objects+i*16+j*4,v)));
   assert.equal(com(mouse,11,fmt),0);
  }
  // Small configured buffer; every phase stays below its documented four-record
  // effective capacity. Omitted objects must not become visible event records.
  format([[12,3],[4,0x103],[28,0x30c]]); // X, Y, left; wheel and right omitted.
  [20,16,0,0,5].forEach((v,i)=>wr(prop+i*4,v));assert.equal(com(mouse,6,1,prop),0);
  assert.equal(com(mouse,7),0);
  function poll(flags,n,expected,pointer=data) {
   raw(area,288).fill(165);wr(count,n);
   assert.equal(com(mouse,10,20,pointer,count,flags),0,'GetDeviceData HRESULT');
   const got=rd(count);assert(got<=5);
   const pairs=pointer?Array.from({length:got},(_,i)=>[rd(data+i*20),rd(data+i*20+4)|0]):null;
   console.log(JSON.stringify({rpc,flags,requested:n,nullOutput:!pointer,count:got,pairs,expected}));
   assert.deepEqual(pointer?pairs:got,expected,'selected-object count/records');
   if(pointer)for(let i=0;i<got;i++)assert.equal(rd(data+i*20+16),0xa5a5a5a5,'stride padding');
   const end=pointer?got*20:0;
   assert([...raw(area,16),...raw(data+end,272-end)].every(v=>v===165),'output guards');
   return pointer?Buffer.from(raw(data,got*20)).toString('hex'):got;
  }
  poll(0,5,[]); // Initialize live button reconciliation through the public method.
  renderer.handleWheel(0,0,1); // Only an omitted object is pending.
  poll(1,0xffffffff,0,0);
  poll(1,5,[]);poll(0,5,[]);
  renderer.handleWheel(0,0,-1);renderer.handleRelativeMouseMove(7,-3,{guestCounts:true});
  renderer.handleMouseDown(0,0,0);renderer.handleMouseUp(0,0,0);
  const records=[[12,7],[4,-3],[28,128],[28,0]];
  poll(1,0xffffffff,4,0);poll(1,1,1,0);poll(1,0,0,0);
  const peek=poll(1,5,records);assert.equal(poll(1,5,records),peek,'repeat PEEK metadata');
  poll(0,1,records.slice(0,1));poll(1,0xffffffff,3,0);
  poll(0,5,records.slice(1));poll(1,0xffffffff,0,0);
  assert.equal(com(mouse,9,32,state),0);
  assert.deepEqual([rd(state+12)|0,rd(state+4)|0,rd(state+28)],[7,-3,0],'relative sums independent of records');
  assert.equal(com(mouse,9,32,state),0);assert.equal(rd(state+12)|0,0);assert.equal(rd(state+4)|0,0);
  renderer.handleRelativeMouseMove(5,-9,{guestCounts:true});
  renderer.handleRelativeMouseMove(-5,9,{guestCounts:true});
  assert.equal(com(mouse,9,32,state),0);assert.equal(rd(state+12)|0,0);assert.equal(rd(state+4)|0,0);
  poll(1,0xffffffff,4,0);poll(0,5,[[12,5],[4,-9],[12,-5],[4,9]]);
  assert.equal(com(mouse,8),0);format([[3,0x30c]]);assert.equal(com(mouse,7),0);
  renderer.handleRelativeMouseMove(-5,9,{guestCounts:true});
  renderer.handleMouseDown(0,0,0);renderer.handleMouseUp(0,0,0);
  poll(1,0xffffffff,2,0);poll(1,5,[[3,128],[3,0]]);poll(0,5,[[3,128],[3,0]]);
  poll(1,0xffffffff,0,0);assert.equal(com(mouse,8),0);
  assert.equal(com(mouse,2),0);assert.equal(com(root,2),0);
  if(rpc)assert(rpcCalls>0);console.log('PASS '+(rpc?'RPC':'direct')+' custom NULL PEEK counts, transitions, sums and reacquire');
 }
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
