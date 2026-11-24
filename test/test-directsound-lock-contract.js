'use strict';

// Literal Lock contract, frozen before baseline. Complete shipped module, x86
// indirect calls through published COM vtables, and the real host voice bridge.
// https://learn.microsoft.com/en-us/previous-versions/windows/desktop/mt708932(v=vs.85)
const assert = require('node:assert/strict');
const fs = require('node:fs'), crypto = require('node:crypto'), zlib = require('node:zlib');
const {bootRenderHarness} = require('./render-helper');
const regions = require('../lib/region-map.generated');
const apis = require('../src/api_table.json');

// [label, offset, bytes, flags, missing output index, HRESULT, relative outputs]
// A null second pointer means no wrap portion is locked. ENTIREBUFFER ignores
// the count, while FROMWRITECURSOR ignores the supplied offset (including -1).
const cases = [
  ['head',0,8,0,-1,0,[0,8,null,0]],
  ['interior',12,9,0,-1,0,[12,9,null,0]],
  ['exact end',56,8,0,-1,0,[56,8,null,0]],
  ['split',60,12,0,-1,0,[60,4,0,8]],
  ['one byte tail',63,2,0,-1,0,[63,1,0,1]],
  ['whole',0,1,2,-1,0,[0,64,null,0]],
  ['whole rotated',60,0xffffffff,2,-1,0,[60,4,0,60]],
  ['write cursor',0xffffffff,4,1,-1,0,[63,1,0,3]],
  ['write cursor ignores supplied zero',0,1,1,-1,0,[63,1,null,0]],
  ['both flags',0xffffffff,0xffffffff,3,-1,0,[63,1,0,63]],
  ['no second outputs',60,12,0,4,0,[60,4,null,0]],
  ['no second pointer',60,12,0,2,0,[60,4,null,0]],
  ['no second length',60,12,0,3,0,[60,4,0,8]],
  ['offset at end',64,4,0,-1,0x80070057,null],
  ['offset unsigned',0xffffffff,4,0,-1,0x80070057,null],
  ['oversized',0,65,0,-1,0x80070057,null],
  ['huge count',60,0xffffffff,0,-1,0x80070057,null],
  ['missing first pointer',0,4,0,0,0x80070057,null],
  ['missing first length',0,4,0,1,0x80070057,null],
];
let checks = 0;
const failures = [];
function equal(actual, expected, name) {
  checks++;
  try {assert.deepEqual(actual, expected, name);}
  catch {failures.push({name, actual, expected});}
}

(async () => {
  const input = process.argv[2] ? fs.readFileSync(process.argv[2]) : require('./compile-src').compileSrcWasm();
  const bytes = input[0] === 31 ? zlib.gunzipSync(input) : input;
  console.log('module SHA256=' + crypto.createHash('sha256').update(bytes).digest('hex'));
  if (process.env.DS_LOCK_MODULE_OUT) fs.writeFileSync(process.env.DS_LOCK_MODULE_OUT,zlib.gzipSync(bytes));
  let clock = 1000;
  const snapshots = [];
  const h = await bootRenderHarness({prebuiltModule:await WebAssembly.compile(bytes),fonts:'none',
    beforeInstantiate(ctx,host) {
      ctx.audioClockMs = () => clock;
      const play = host.voice_play_ring;
      host.voice_play_ring = (...args) => {
        snapshots.push({args, pcm:Array.from(new Uint8Array(host.memory.buffer,args[1],args[2]))});
        return play(...args);
      };
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
  const buffers=[];
  for(const sparse of [false,true]) {
    if(sparse) {
      // Large allocations have dedicated arenas and do not exhaust the small
      // allocation heap. Consume that heap with bounded small allocations.
      let p;
      for(let i=0;i<2048;i++){p=alloc(65536);if((e.guest_to_wasm(p)>>>0)>=regions.BASE.VIRTUAL_BACKING_BASE)break;}
      for(let i=0;i<300000;i++){p=alloc(256);if((e.guest_to_wasm(p)>>>0)>=regions.BASE.VIRTUAL_BACKING_BASE)break;}
      for(let i=0;i<300000;i++){p=alloc(8);if((e.guest_to_wasm(p)>>>0)>=regions.BASE.VIRTUAL_BACKING_BASE)break;}
      assert((e.guest_to_wasm(p)>>>0)>=regions.BASE.VIRTUAL_BACKING_BASE,'small heap exhausted');
    }
    [20,0,64,0,fmt].forEach((v,i)=>wr(desc+4*i,v));
    equal(com(root,3,desc,out,0),0,'CreateSoundBuffer');const buf=rd(out);buffers.push(buf);
    const areas=Array.from({length:4},()=>alloc(36)), cells=areas.map(p=>p+16);
    const lock=(o,n,f,ptrs=cells)=>com(buf,11,o,n,...ptrs,f);
    equal(lock(0,64,0),0,'initial full lock');const base=rd(cells[0]);
    equal((e.guest_to_wasm(base)>>>0)>=regions.BASE.VIRTUAL_BACKING_BASE,sparse,'direct/sparse actual ring mapping');
    const expected=Array(64).fill(165);raw(base,64).fill(165);
    equal(com(buf,13,48),0,'stored play offset');equal(com(buf,12,0,0,1),0,'looping Play');
    assert.equal(Object.keys(hostCtx._voices._map).length,buffers.length,'real host voice allocated');
    equal(snapshots.at(-1).pcm,expected,'real Play bridge sees ring');
    const perimeter=()=>[...raw(base-16,16),...raw(base+64,16)];
    for(const [label,offset,count,flags,missing,hr,layout] of cases) {
      const name=(sparse?'sparse ':'direct ')+label;
      areas.forEach(p=>raw(p,36).fill(165));
      const ringGuards=perimeter();
      const ptrs=cells.map((p,i)=>missing===i||missing===4&&i>=2?0:p);
      const before=snapshots.length;
      equal(lock(offset,count,flags,ptrs),hr,name+' HRESULT');
      equal(snapshots.length,before,name+' Lock does not publish PCM');
      for(let i=0;i<4;i++) {
        let value=0xa5a5a5a5;
        if(hr===0&&ptrs[i])value=i%2===0?(layout[i]===null?0:base+layout[i]):layout[i];
        equal(rd(cells[i]),value,name+' output '+i);
        equal([...raw(areas[i],16),...raw(cells[i]+4,16)],Array(32).fill(165),name+' output guards '+i);
      }
      // Write only after the independent layout agrees, so broken output
      // lengths never turn the baseline into an unbounded guest write.
      if(layout&&rd(cells[0])===base+layout[0]&&rd(cells[1])===layout[1]) {
        for(const i of [0,2]) {
          if(i===2&&(!ptrs[2]||!ptrs[3]))continue;
          if(!layout[i+1])continue;
          const p=rd(cells[i]), n=rd(cells[i+1]);
          if(p!==base+layout[i]||n!==layout[i+1])continue;
          for(let j=0;j<n;j++){e.guest_write8(p+j,33+i);expected[layout[i]+j]=33+i;}
        }
        equal(com(buf,19,rd(cells[0]),rd(cells[1]),ptrs[2]?rd(cells[2]):0,ptrs[3]?rd(cells[3]):0),0,name+' Unlock');
        equal(snapshots.length,before+1,name+' Unlock publishes through real bridge');
        equal(snapshots.at(-1).pcm,expected,name+' full ring including untouched bytes');
      }
      equal(Array.from(raw(base,64)),expected,name+' guest ring guards');
      equal(perimeter(),ringGuards,name+' ring allocation perimeter');
    }
    clock+=2;
    equal(lock(0xffffffff,3,1),0,'advanced FROMWRITECURSOR');
    equal(cells.map(rd),[base+1,3,0,0],'advanced cursor literal output');
    equal(com(buf,18),0,'Stop');
  }
  for(const buf of buffers)equal(com(buf,2),0,'Release');
  equal(com(root,2),0,'root Release');
  equal(Object.keys(hostCtx._voices._map).length,0,'all host voices closed');
  console.log(JSON.stringify({checks,failures}));
  assert.equal(failures.length,0,'literal contract failures');
  console.log('PASS actual production x86 COM Lock/Unlock contract '+checks+' checks');
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
