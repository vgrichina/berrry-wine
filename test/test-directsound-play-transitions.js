'use strict';

// Play transition contract, frozen before baseline. Complete production x86 COM
// and real host voice sample tap; fixed guest clock, no audio hardware claim.
// https://learn.microsoft.com/en-us/previous-versions/windows/desktop/mt708933(v=vs.85)
const assert = require('node:assert/strict');
const fs = require('node:fs'), crypto = require('node:crypto'), zlib = require('node:zlib');
const {bootRenderHarness} = require('./render-helper');
const regions = require('../lib/region-map.generated');
const apis = require('../src/api_table.json');

// Literal expected outcomes frozen before the original baseline. No production
// handler extraction or oracle calculation from implementation state.
let checks = 0;
const failures = [];
function equal(actual, expected, name) {
  checks++;
  try {assert.deepEqual(actual, expected, name);}
  catch {failures.push(JSON.parse(JSON.stringify({name, actual, expected})));}
}

(async () => {
  const input = process.argv[2] ? fs.readFileSync(process.argv[2]) : require('./compile-src').compileSrcWasm();
  const bytes = input[0] === 31 ? zlib.gunzipSync(input) : input[0] === 0 ? input : zlib.brotliDecompressSync(input);
  console.log('module SHA256=' + crypto.createHash('sha256').update(bytes).digest('hex'));
  if (process.env.DS_PLAY_MODULE_OUT) fs.writeFileSync(process.env.DS_PLAY_MODULE_OUT,zlib.gzipSync(bytes));
  let clock = 1000;
  const chunks = [], pumps = [];
  let rpcStats;
  const h = await bootRenderHarness({prebuiltModule:await WebAssembly.compile(bytes),fonts:'none',
    beforeInstantiate(ctx,host) {
      ctx.audioClockMs = () => clock;
      ctx.audioTap = () => ({active:true,pcm:c=>chunks.push(c)});
      ctx.registerAudioTapPump = p => pumps.push(p);
      // Real synchronous RPC broker, same shared memory and voice manager.
      const real=require('../lib/host-imports').createHostImports(ctx).host;
      const RPC=require('../lib/guest-rpc');
      const sigs={};
      for(const [name,n,result] of [['voice_open',3,1],['voice_play_ring',5,1],
        ['voice_get_pos',1,1],['voice_is_playing',1,1],['voice_stop',1,1],
        ['voice_close',1,1],['voice_set_volume_db',2,0],['voice_set_volume_linear',2,0],
        ['voice_set_pan',2,0],['voice_set_freq',2,0]])
        sigs[name]={params:Array(n).fill('i32'),results:result?['i32']:[]};
      const main=RPC.createMainBroker(host.memory,real,sigs);
      const worker=RPC.createWorkerImports(host.memory,sigs,msg=>{
        if(msg.t==='rpc')main.serveRpc(msg.slot);
        else if(msg.t==='calls')main.serveCalls(msg);
        else if(msg.t==='call')main.serveCall(msg);
        else throw Error('unexpected RPC '+msg.t);
      },{slot:3});
      rpcStats=worker.stats;
      // Enable the actual RPC path after exhausting the direct heap below.
      let rpcEnabled=false;
      for(const name of Object.keys(sigs))host[name]=(...args)=>
        (rpcEnabled?worker.imports.host:real)[name](...args);
      ctx.enablePlayRpc=()=>{rpcEnabled=true;};
    }});
  const {exports:e,memory,hostCtx} = h;
  const pe = fs.readFileSync(require('node:path').join(__dirname,'binaries/calc.exe'));
  new Uint8Array(memory.buffer).set(pe,e.get_staging());
  assert(e.load_pe(pe.length),'fixture PE only initializes process; no application run');
  e.init_dx_com_thunks();
  const alloc = n => {const p=e.guest_alloc(n)>>>0;assert(p);return p;};
  const wr=(p,v)=>e.guest_write32(p,v>>>0), rd=p=>e.guest_read32(p)>>>0;
  const raw=(p,n)=>new Uint8Array(memory.buffer,e.guest_to_wasm(p)>>>0,n);
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
    assert.equal(e.get_eip(),0,'finite x86 return');
    equal(rd(result+4),stack-20,'stdcall cleanup');equal(e.get_esp()>>>0,stack-16,'caller RET');
    return rd(result);
  }
  const com=(obj,slot,...args)=>invoke([obj,...args],obj,slot);
  const out=alloc(8), desc=alloc(20), fmt=alloc(20);
  const view=new DataView(memory.buffer), wa=regions.BASE.THUNK_BASE, saved=view.getUint32(wa+4,true);
  try {
    view.setUint32(wa+4,apis.find(a=>a.name==='DirectSoundCreate').id,true);
    equal(invoke([0,out,0],0,0,(wa-e.get_guest_base()+e.get_image_base())>>>0),0,'factory');
  } finally {view.setUint32(wa+4,saved,true);}
  const root=rd(out);
  [0x00010001,1000,1000,0x00080001,0].forEach((v,i)=>wr(fmt+4*i,v));

  const cells=Array.from({length:4},()=>alloc(36)+16);
  function lock(b) {
    const starts=cells.map(p=>Array.from(raw(p-16,36)));
    equal(com(b,11,0,64,...cells,0),0,'Lock whole PCM');
    equal(cells.slice(1).map(rd),[64,0,0],'literal lock layout');
    cells.forEach((p,i)=>equal([...raw(p-16,16),...raw(p+4,16)],
      [...starts[i].slice(0,16),...starts[i].slice(20)],'output guards'));
    return rd(cells[0]);
  }
  function create() {
    [20,0xe0,64,0,fmt].forEach((v,i)=>wr(desc+4*i,v));
    equal(com(root,3,desc,out,0),0,'create');return rd(out);
  }
  function duplicate(b) {equal(com(root,5,b,out),0,'duplicate');return rd(out);}
  function get(b,slot,value,name) {
    raw(out,4).fill(165);equal(com(b,slot,out),0,name+' result');equal(rd(out),value>>>0,name);
  }
  function edit(b,offset,values) {
    const p=lock(b); values.forEach((v,i)=>e.guest_write8(p+offset+i,v));
    equal(com(b,19,p,64,0,0),0,'Unlock edited PCM');return p;
  }
  const pump=()=>pumps.forEach(p=>p());
  const stream=()=>chunks.flatMap(c=>[...c.bytes]);
  const position=(b,n,label)=>{
    equal(com(b,4,out,out+4),0,label+' HRESULT');equal(rd(out),n,label+' cursor');
    equal(rd(out+4),(n+15)%64,label+' write');
  };
  const play=(b,f)=>equal(com(b,12,0,0,f),0,'Play result');
  const stop=b=>equal(com(b,18),0,'Stop result');
  const seek=(b,n)=>equal(com(b,13,n),0,'seek result');
  for(const sparse of [false,true]) {
    if(sparse) {
      let p;
      for(const n of [65536,256,8])for(let i=0;i<300000;i++){
        p=alloc(n);if((e.guest_to_wasm(p)>>>0)>=regions.BASE.VIRTUAL_BACKING_BASE)break;
      }
      assert((e.guest_to_wasm(p)>>>0)>=regions.BASE.VIRTUAL_BACKING_BASE);
      hostCtx.enablePlayRpc();
    }
    // Literal sample sequences and cursors are independent of handler state.
    for(const [from,to] of [[0,0],[0,1],[1,0],[1,1]]) {
      const b=create(), p=lock(b);
      equal((e.guest_to_wasm(p)>>>0)>=regions.BASE.VIRTUAL_BACKING_BASE,sparse,'PCM mapping');
      const guards=[...raw(p-16,16),...raw(p+64,16)];
      raw(p,64).set(Array.from({length:64},(_,i)=>128+i));
      seek(b,8);chunks.length=0;play(b,from);
      clock+=8;pump();position(b,16,'advanced before repeat');
      equal(stream(),[136,137,138,139,140,141,142,143],'first actual samples');
      chunks.length=0;play(b,to);position(b,16,'repeat preserves current byte');
      get(b,9,to?5:1,'latest flags');
      clock+=8;pump();position(b,24,'continued after repeat');
      equal(stream(),[144,145,146,147,148,149,150,151],'repeat actual samples');
      chunks.length=0;clock+=48;pump();
      equal(stream(),to?
        [152,153,154,155,156,157,158,159,160,161,162,163,164,165,166,167,
         168,169,170,171,172,173,174,175,176,177,178,179,180,181,182,183,
         184,185,186,187,188,189,190,191,128,129,130,131,132,133,134,135]:
        [152,153,154,155,156,157,158,159,160,161,162,163,164,165,166,167,
         168,169,170,171,172,173,174,175,176,177,178,179,180,181,182,183,
         184,185,186,187,188,189,190,191],'latest flags actual end/wrap samples');
      get(b,9,to?5:0,'end or wrap status');
      // Stop/rePlay preserves the observed current cursor; seek still moves it.
      seek(b,32);play(b,1);clock+=8;pump();stop(b);clock+=16;
      position(b,40,'stopped cursor');chunks.length=0;play(b,0);
      clock+=8;pump();equal(stream(),[168,169,170,171,172,173,174,175],'Stop replay samples');
      seek(b,56);chunks.length=0;clock+=8;pump();
      equal(stream(),[184,185,186,187,188,189,190,191],'seek completion samples');
      get(b,9,0,'seek completion');position(b,56,'completion retains stored seek origin');
      chunks.length=0;play(b,0);clock+=8;pump();
      equal(stream(),[184,185,186,187,188,189,190,191],'completed replay retains stored seek origin');
      stop(b);
      // Completion without a GetStatus poll must still allow a fresh Play.
      seek(b,56);play(b,0);clock+=16;pump();chunks.length=0;
      play(b,1);position(b,56,'unpolled completion replay origin');
      clock+=8;pump();equal(stream(),[184,185,186,187,188,189,190,191],'unpolled completion replay samples');stop(b);
      // Shared PCM, but duplicate controls and live transitions stay independent.
      const d=duplicate(b);equal(lock(d),p,'duplicate shares PCM');
      seek(b,8);seek(d,32);equal(com(d,15,-1200),0,'duplicate volume');
      get(b,6,0,'original independent volume');equal(com(d,17,2000),0,'duplicate rate');
      get(b,8,1000,'original independent rate');
      play(b,1);clock+=8;pump();play(b,0);position(b,16,'original transition');
      position(d,32,'duplicate stopped independent');stop(b);
      raw(p+32,4).set([201,202,203,204]);
      equal(com(b,19,p,64,0,0),0,'Unlock shared edit');chunks.length=0;
      play(d,1);clock+=4;pump();
      equal(stream(),[201,202,203,204,164,165,166,167],'duplicate actual shared samples at independent rate');
      play(d,0);position(d,40,'duplicate transition cursor');
      position(b,16,'original remains stopped');stop(d);
      equal([...raw(p-16,16),...raw(p+64,16)],guards,'PCM guards');
      equal(com(d,2),0,'duplicate release');equal(com(b,2),0,'buffer release');
    }
  }
  equal(rpcStats.sync>0,true,'real sparse RPC calls observed');
  equal(com(root,2),0,'root release');
  equal(Object.keys(hostCtx._voices._map).length,0,'all voices closed');
  console.log(JSON.stringify({checks,failures,rpcStats}));
  assert.equal(failures.length,0,'literal Play transition failures');
  console.log('PASS production x86 COM Play transitions '+checks+' checks');
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
