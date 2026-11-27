'use strict';

// Literal duplicate contract, frozen before baseline. Complete shipped module, x86
// indirect calls through published COM vtables, and the real host voice bridge.
// https://learn.microsoft.com/en-us/previous-versions/windows/desktop/mt708944(v=vs.85)
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
  const bytes = input[0] === 31 ? zlib.gunzipSync(input) : input;
  console.log('module SHA256=' + crypto.createHash('sha256').update(bytes).digest('hex'));
  if (process.env.DS_DUP_MODULE_OUT) fs.writeFileSync(process.env.DS_DUP_MODULE_OUT,zlib.gzipSync(bytes));
  let clock = 1000;
  const snapshots = [];
  const h = await bootRenderHarness({prebuiltModule:await WebAssembly.compile(bytes),fonts:'none',
    beforeInstantiate(ctx,host) {
      ctx.audioClockMs = () => clock;
      for (const name of ['voice_play_ring','voice_refresh_ring']) {
        const play = host[name];
        host[name] = (...args) => {
          snapshots.push({args, pcm:Array.from(new Uint8Array(host.memory.buffer,args[1],args[2]))});
          return play(...args);
        };
      }
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
  const out=alloc(4), desc=alloc(20), fmt=alloc(20);
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
  for(const sparse of [false,true]) {
    if(sparse) {
      let p;
      for(let i=0;i<2048;i++){p=alloc(65536);if((e.guest_to_wasm(p)>>>0)>=regions.BASE.VIRTUAL_BACKING_BASE)break;}
      for(let i=0;i<300000;i++){p=alloc(256);if((e.guest_to_wasm(p)>>>0)>=regions.BASE.VIRTUAL_BACKING_BASE)break;}
      for(let i=0;i<300000;i++){p=alloc(8);if((e.guest_to_wasm(p)>>>0)>=regions.BASE.VIRTUAL_BACKING_BASE)break;}
      assert((e.guest_to_wasm(p)>>>0)>=regions.BASE.VIRTUAL_BACKING_BASE,'small heap exhausted');
    }
    for(const sourceFirst of [true,false]) {
      const a=create(), p=lock(a);
      equal((e.guest_to_wasm(p)>>>0)>=regions.BASE.VIRTUAL_BACKING_BASE,sparse,'actual direct/sparse PCM');
      const perimeter=()=>[...raw(p-16,16),...raw(p+64,16)];const guards=perimeter();
      raw(p,64).fill(165);
      equal(com(a,15,-1200),0,'original volume'); equal(com(a,17,1000),0,'original frequency');
      equal(com(a,13,7),0,'original cursor');equal(com(a,12,0,0,1),0,'original play');
      const b=duplicate(a), c=duplicate(b);
      equal(lock(b),p,'duplicate shares sample allocation');equal(lock(c),p,'duplicate of duplicate shares allocation');
      get(b,9,0,'duplicate starts stopped');get(c,9,0,'second duplicate starts stopped');
      get(b,6,-1200,'inherited volume');get(c,8,1000,'inherited frequency');
      equal(com(b,15,-2400),0,'duplicate volume');equal(com(b,17,2000),0,'duplicate frequency');
      get(a,6,-1200,'original independent volume');get(c,6,-1200,'second independent volume');
      get(a,8,1000,'original independent frequency');get(c,8,1000,'second independent frequency');
      equal(com(b,13,23),0,'duplicate independent cursor');
      equal(com(b,4,out,out+4),0,'stopped duplicate position');equal(rd(out),23,'duplicate position literal');
      equal(com(a,4,out,out+4),0,'original position');equal(rd(out),7,'original cursor independent');
      equal(com(b,12,0,0,1),0,'duplicate play');
      equal(com(b,18),0,'duplicate stop');get(a,9,5,'original still playing');
      equal(com(b,12,0,0,1),0,'duplicate replay');equal(com(a,18),0,'original stop');get(b,9,5,'duplicate still playing');
      const expected=Array(64).fill(165);
      edit(a,3,[17,34,51]);expected.splice(3,3,17,34,51);
      equal(Array.from(raw(lock(b),64)),expected,'original edits visible in duplicate');
      edit(b,59,[68,85,102,119,136]);expected.splice(59,5,68,85,102,119,136);
      equal(Array.from(raw(lock(a),64)),expected,'duplicate edits visible in original');
      equal(Array.from(raw(lock(c),64)),expected,'both edits visible in duplicate of duplicate');
      // Pass through the actual host voice implementation; inspect only the
      // public bridge PCM argument, with no descriptor/worklet inspection.
      equal(com(c,12,0,0,1),0,'third play');equal(snapshots.at(-1).pcm,expected,'real voice receives shared edited PCM');
      equal(perimeter(),guards,'PCM allocation guards');
      const first=sourceFirst?a:b, second=sourceFirst?b:a;
      equal(com(first,2),0,'first release');
      const unrelated=create(), q=lock(unrelated);raw(q,64).fill(90);
      equal(q===p,false,'live shared allocation not reused');
      equal(Array.from(raw(lock(second),64)),expected,'survives first release');
      equal(com(second,2),0,'second release');
      const another=create(), r=lock(another);raw(r,64).fill(60);
      equal(r===p,false,'last duplicate still owns allocation');
      equal(Array.from(raw(lock(c),64)),expected,'last duplicate survives source slot reuse');
      edit(c,0,[153]);expected[0]=153;
      equal(Array.from(raw(q,64)),Array(64).fill(90),'unrelated PCM unchanged');
      equal(Array.from(raw(r,64)),Array(64).fill(60),'another PCM unchanged');
      equal(com(c,2),0,'last release');
      // Probe reuse before COM/caller allocations can consume the freed block.
      const reclaimed=alloc(64);
      equal(reclaimed,p,'last release makes sample allocation reusable');
      raw(reclaimed,64).fill(221);e.guest_free(reclaimed);
      // Keep the repeated public creation/release pressure check as well.
      for(let i=0;i<32;i++) {
        const fresh=create(), fp=lock(fresh);
        raw(fp,64).fill(221);equal(com(fresh,2),0,'reuse cycle release');
      }
      equal(Array.from(raw(q,64)),Array(64).fill(90),'reuse does not corrupt unrelated PCM');
      equal(Array.from(raw(r,64)),Array(64).fill(60),'reuse does not corrupt second PCM');
      equal(com(unrelated,2),0,'unrelated release');equal(com(another,2),0,'another release');
    }
  }
  equal(com(root,2),0,'root release');
  equal(Object.keys(hostCtx._voices._map).length,0,'all real voices closed');
  console.log(JSON.stringify({checks,failures}));
  assert.equal(failures.length,0,'literal duplicate contract failures');
  console.log('PASS actual production x86 COM duplicate sharing '+checks+' checks');
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
