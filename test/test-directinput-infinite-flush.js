'use strict';

// Public x86 COM calls and caller-authored physical renderer input only.
// Contract: https://learn.microsoft.com/en-us/previous-versions/windows/desktop/ee417894(v=vs.85)
// NULL + INFINITE (without PEEK) flushes all selected records. Ordinary read
// capacity, overflow retention and overflow status policy are outside this test.
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
 if (process.env.DI_FLUSH_MODULE_OUT) fs.writeFileSync(process.env.DI_FLUSH_MODULE_OUT, zlib.gzipSync(bytes));
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
  const pe = fs.readFileSync(process.cwd()+'/test/binaries/calc.exe');
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
   view.setUint32(wa+4,apis.find(a=>a.name==='DirectInput8Create').id,true);
   [0xBF798030,0x4DA2483A,0x645D99AA,0x009736ED].forEach((v,i)=>wr(guid+i*4,v));
   assert.equal(invoke([0x400000,0x800,guid,out,0],0,0,(wa-e.get_guest_base()+e.get_image_base())>>>0),0);
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

  format([[12,3],[4,0x103],[28,0x30c]]); // Wheel and right button omitted.
  [20,16,0,0,5].forEach((v,i)=>wr(prop+i*4,v));
  assert.equal(com(mouse,6,1,prop),0);
  assert.equal(com(mouse,5,1,prop),0);assert.equal(rd(prop+16),5);
  assert.equal(com(mouse,7),0);
  function poll(label,flags,n,pointer=data) {
   raw(area,288).fill(165);wr(count,n);
   const hr=com(mouse,10,20,pointer,count,flags),got=rd(count);
   assert([0,1].includes(hr),'GetDeviceData succeeds');
   if(pointer)assert(got<=12,'finite caller storage');
   const records=pointer?Array.from({length:got},(_,i)=>[rd(data+i*20),rd(data+i*20+4)|0,rd(data+i*20+8),rd(data+i*20+12)]):null;
   console.log(JSON.stringify({rpc,label,flags,requested:n,nullOutput:!pointer,hr,count:got,records}));
   if(pointer)for(let i=0;i<got;i++)assert.equal(rd(data+i*20+16),0xa5a5a5a5,'stride padding');
   const end=pointer?got*20:0;
   assert([...raw(area,16),...raw(data+end,272-end)].every(v=>v===165),'output guards, including NULL output');
   return {hr,count:got,records};
  }
  function immediate(expected) {
   assert.equal(com(mouse,9,32,state),0);
   assert.deepEqual([rd(state+12)|0,rd(state+4)|0,raw(state+28,1)[0]],expected,'independent immediate sums and held button');
  }
  function empty(label) {
   assert.equal(poll(label+' NULL PEEK',1,0xffffffff,0).count,0,'flush leaves no selected records');
   assert.deepEqual(poll(label+' record PEEK',1,12).records,[],'flush leaves buffer empty');
   assert.deepEqual(poll(label+' consume',0,12).records,[],'no hidden suffix after PEEK');
  }
  function flush(label,expectedCount) {
   const f=poll(label,0,0xffffffff,0);
   if(expectedCount!==undefined)assert.equal(f.count,expectedCount,'actual selected records discarded');
   empty(label);
   assert.equal(poll(label+' repeated flush',0,0xffffffff,0).count,0,'idempotent flush');
   empty(label+' repeated');
  }
  function fresh(label) {
   renderer.handleRelativeMouseMove(-5,9,{guestCounts:true});
   renderer.handleMouseDown(0,0,0);renderer.handleMouseUp(0,0,0);
   const p=poll(label+' fresh PEEK',1,12);
   assert.equal(p.hr,0);
   assert.deepEqual(p.records.map(x=>x.slice(0,2)),[[12,-5],[4,9],[28,128],[28,0]],'fresh literal record ordering');
   for(let i=1;i<p.count;i++)assert.equal(p.records[i][3],(p.records[i-1][3]+1)>>>0,'successive fresh sequences');
   assert.deepEqual(poll(label+' fresh repeated PEEK',1,12),p,'stable PEEK metadata');
   assert.deepEqual(poll(label+' fresh consume',0,12),p,'PEEK/consume metadata');
   immediate([-5,9,0]);immediate([0,0,0]);empty(label+' fresh drained');
  }
  poll('initialize reconciliation',0,12);
  flush('empty',0);
  // Omitted-only events and omitted suffixes must also be removed, including
  // button reconciliation, even though they do not increase the flush count.
  renderer.handleWheel(0,0,1);renderer.handleMouseDown(0,0,2);renderer.handleMouseUp(0,0,2);
  flush('omitted only',0);fresh('omitted only');
  renderer.handleRelativeMouseMove(7,-3,{guestCounts:true});
  renderer.handleMouseDown(0,0,0);renderer.handleMouseUp(0,0,0);
  renderer.handleWheel(0,0,-1);renderer.handleMouseDown(0,0,2);renderer.handleMouseUp(0,0,2);
  assert.equal(poll('boundary NULL PEEK',1,0xffffffff,0).count,4);
  assert.deepEqual(poll('boundary PEEK',1,12).records.map(x=>x.slice(0,2)),[[12,7],[4,-3],[28,128],[28,0]]);
  flush('four-record boundary plus omitted suffix',4);
  immediate([7,-3,0]);immediate([0,0,0]);fresh('boundary');
  // Retained N=5 reproduction: eight physical object changes, partial consume,
  // NULL discard, then one complete flush. Do not assert overflow survivors or
  // an overflow HRESULT/clear policy: those are unresolved independent issues.
  renderer.handleRelativeMouseMove(11,-7,{guestCounts:true});
  renderer.handleMouseDown(0,0,0);renderer.handleMouseUp(0,0,0);
  renderer.handleRelativeMouseMove(-11,7,{guestCounts:true});
  renderer.handleMouseDown(0,0,0);renderer.handleMouseUp(0,0,0);
  assert.equal(poll('overfull partial consume',0,1).count,1);
  assert.equal(poll('overfull NULL discard',0,1,0).count,1);
  flush('overfull after partial removals');
  immediate([0,0,0]);fresh('overfull');
  // Keep a physical button held across flush: state must remain held, while
  // the later release and fresh press/release retain their actual order.
  renderer.handleRelativeMouseMove(3,-2,{guestCounts:true});renderer.handleMouseDown(0,0,0);
  flush('held button',3);immediate([3,-2,128]);immediate([0,0,128]);
  renderer.handleMouseUp(0,0,0);renderer.handleMouseDown(0,0,0);renderer.handleMouseUp(0,0,0);
  assert.deepEqual(poll('release after held flush',0,12).records.map(x=>x.slice(0,2)),[[28,0],[28,128],[28,0]]);
  immediate([0,0,0]);
  // Exercise the existing physical ring plus its coalesced motion tail, without
  // prescribing which overflow records survive or how many are retained.
  for(let i=0;i<80;i++)renderer.handleRelativeMouseMove(1,-1,{guestCounts:true});
  renderer.handleWheel(0,0,1);flush('physical ring overfull');
  immediate([80,-80,0]);fresh('physical ring');
  assert.equal(com(mouse,8),0);format([[28,0x30c]]);assert.equal(com(mouse,7),0);
  renderer.handleRelativeMouseMove(8,-6,{guestCounts:true});
  renderer.handleMouseDown(0,0,0);renderer.handleMouseUp(0,0,0);
  renderer.handleRelativeMouseMove(-8,6,{guestCounts:true});
  flush('button-only custom format and omitted axes',2);
  assert.equal(com(mouse,8),0);assert.equal(com(mouse,2),0);assert.equal(com(root,2),0);
  if(rpc)assert(rpcCalls>0);console.log('PASS '+(rpc?'RPC':'direct')+' public DI8 complete NULL INFINITE flush, state and fresh ordering');
 }
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
