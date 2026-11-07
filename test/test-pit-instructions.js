'use strict';
// Generated ordinary Win16 instructions, no guest-program bytes or results.
const assert = require('assert/strict'), fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.resolve(__dirname, '..');
const { createHostImports } = require(root + '/lib/host-imports');
const { neLifecycleImage } = require(root + '/test/helpers/ne-lifecycle-image');
const browser = { createHostImports, console: { log() {}, error() {} } };
vm.runInNewContext(fs.readFileSync(root + '/host.js', 'utf8') + '\n;globalThis.Host=WineAssembly;', browser);
function fixture(divisions=4) {
  const b = Buffer.alloc(0xc00); neLifecycleImage().copy(b);
  const n=0x80, w=(o,v)=>b.writeUInt16LE(v,o);
  w(n+12,1); w(n+0x18,0xff00); w(n+0x1a,2);
  w(n+0x42,0x800);w(n+0x46,0x800);w(n+0x48,0xa0);
  const code=[],labels={},fixups=[];
  const emit=(...v)=>code.push(...v),word=v=>emit(v&255,v>>>8&255),label=s=>labels[s]=code.length;
  const branch=(op,s)=>{emit(op);fixups.push([code.length,s]);word(0);};
  const store=o=>{emit(0xa3);word(o);};
  // Five ordinary expensive/baseline samples with distinct DIV widths.
  for(let i=0;i<5;i++) {
    branch(0xe8,'sample16');store(0x20+i*4);emit(0x89,0xc6);
    branch(0xe8,'sample32');store(0x22+i*4);emit(0x29,0xc6,0x89,0x36);word(i*2);
  }
  emit(0x31,0xc0,0x31,0xd2);
  for(let i=0;i<5;i++){emit(0x03,0x06);word(i*2);emit(0x83,0xd2,0);}
  emit(0xbb,5,0,0xf7,0xf3,0x89,0xc3);store(0x40);
  emit(0xb8,0,0xfa,0xb9,0xa9,4,0x31,0xd2,0xf7,0xe1);
  branch(0xe9,'divide');label('divide');emit(0xf7,0xf3);store(0x42);
  emit(0xc7,6,0x44,0,0x0d,0x60);label('done');branch(0xe9,'done');
  for(const bits of [16,32]) {
    label('sample'+bits);
    emit(0xe4,0x61,0x24,0xfc,0xe6,0x61,0x88,0xc7, // preserve gate-low control in BH
      0xb0,0xb4,0xe6,0x43,0xb0,0xff,0xe6,0x42,0xe6,0x42,0xe4,0x61,0x88,0xc7,
      0x88,0xf8,0x0c,1,0xfa,0xe6,0x61,0x53, // push gate control
      0x66,0xbb,2,0,0,0,0x66,0x31,0xc0,0x66,0x31,0xd2,0xb9,0x90,1);
    branch(0xe9,'loop'+bits);label('loop'+bits);
    for(let j=0;j<divisions;j++){if(bits===32)emit(0x66);emit(0xf7,0xf3);}
    // Long near jump keeps the generated loop independent of rel8 range.
    emit(0x49,0x74,3);branch(0xe9,'loop'+bits);
    emit(0x5b,0x88,0xf8,0xe6,0x61,0xfb,0xe4,0x42,0x86,0xe0,0xe4,0x42,0x86,0xe0,0xf7,0xd8,0xc3);
  }
  for(const [p,s] of fixups){const d=(labels[s]-p-2)&65535;code[p]=d&255;code[p+1]=d>>>8;}
  assert(code.length<0x800);b.fill(0,0x200,0xa00);b.set(code,0x200);
  return {b,labels};
}
async function run(bytes,{floating=false,legacy=false,observer=null,observerOptions={},realTime=false}={}) {
  let ticks=0,e;const logs=[],io=[];
  const wine=new browser.Host();wine.memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});wine.logToUI=()=>{};
  const imports=wine.getImports({threadId:1,...(realTime?{}:{pitNowMs:()=>ticks ? (ticks+0.25)*1000/1193182 : 0})});imports.host.memory=wine.memory;
  const f=fixture(realTime?100:4);
  const log=imports.host.log_block;
  imports.host.log_block=(address,sp)=>{
    if(e){const off=address-e.win16_seg_base_of(1);if(off===f.labels.loop16)ticks+=8;else if(off===f.labels.loop32)ticks+=4;}
    return log(address,sp);
  };
  const raw=imports.host.pit_io;
  if(raw)imports.host.pit_io=(port,value,write,width)=>{
    const result=floating ? (write?0:port===0x61?0:255) : raw(port,value,write,width);
    io.push({port,value,write,result,ticks});return result;
  };
  imports.host.log_i32=v=>logs.push(v>>>0);imports.host.exit=()=>{};
  const observation=observer?observer(imports,observerOptions):null;
  const {instance}=await WebAssembly.instantiate(bytes,imports);wine.instance=instance;e=instance.exports;
  if(observation)observation.arm(instance);
  new Uint8Array(wine.memory.buffer).set(f.b,e.get_staging());assert(e.load_ne(f.b.length)>0);
  e.set_trace_esp(1,0,0);
  const data=e.win16_seg_base_of(3),word=o=>e.guest_read8(data+o)|e.guest_read8(data+o+1)<<8;
  for(let i=0;i<100&&word(0x44)!==0x600d&&e.get_yield_reason()!==2;i++)e.run(1000);
  const result={words:Array.from({length:0x23},(_,i)=>word(i*2)),yield:e.get_yield_reason(),logs,io,ticks,labels:f.labels};
  if(floating||legacy){
    assert.equal(word(0x40),0);assert.equal(word(0x44),0);assert.equal(e.get_yield_reason(),2);
    const p=logs.indexOf(0xcae8c000);assert(p>=0);assert.equal(logs[p+1],0xc0000094);
    assert.equal(logs[p+2],e.win16_seg_base_of(1)+f.labels.divide,'fault belongs to generated DIV block');
    assert(logs.includes(0xcae8c0de),'unhandled fault terminates ordinary Win16 execution');
    for(let i=0;i<10;i++)assert.equal(word(0x20+i*2),1);
  } else if(!realTime) {
    assert.equal(word(0x44),0x600d);assert.equal(word(0x40),1600);
    assert.equal(word(0x42),Math.floor(0x48d0a00/1600));
    assert(!logs.includes(0xcae8c000),'ordinary timer consumer avoids fault');
    assert.equal(io.length,100,'each of ten helpers executes ten port operations');
    for(let i=0;i<5;i++)assert.equal(word(i*2),1600);
  }
  if(observation){
    result.observation={records:observation.records,errors:observation.errors,dropped:observation.dropped,blockOverflow:observation.blockOverflow};
    result.architecture=Object.fromEntries(['eax','ebx','ecx','edx','esi','edi','ebp','esp','eip','flag_op','flag_a','flag_b','flag_res','flag_sign_shift'].map(n=>[n,e['get_'+n]()]));
    result.memorySha256=require('crypto').createHash('sha256').update(new Uint8Array(wine.memory.buffer)).digest('hex');
  }
  return result;
}
async function sequence(bytes) {
  let tick=0,e;
  const wine=new browser.Host();wine.memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});wine.logToUI=()=>{};
  const imports=wine.getImports({threadId:1,pitNowMs:()=>tick?(tick+0.25)*1000/1193182:0});imports.host.memory=wine.memory;
  const code=[],events={};
  const emit=(...v)=>code.push(...v),save=o=>emit(0xa2,o,0);
  const edge=t=>{emit(0xe9,0,0);events[code.length]=t;};
  // DX and immediate byte forms, independent write/read phases, latched
  // status priority, repeated latch suppression and a gate-frozen live read.
  emit(0xb0,1,0xe6,0x61,0xb0,0xb4,0xe6,0x43,0xb0,0xff,0xe6,0x42,0xe6,0x42);
  edge(1);emit(0xb0,0x80,0xe6,0x43,0xba,0x42,0,0xf9,0xec);save(0);
  edge(256);emit(0xb0,0x80,0xe6,0x43,0xb0,0xe8,0xe6,0x43,0xec);save(2);
  emit(0xb0,0x34,0xee,0xec);save(1); // write-low between latched low/high
  emit(0xb0,0x12,0xee,0xb0,0,0xe6,0x61,0xec);save(3);emit(0xec);save(4);
  edge(1000);emit(0xec);save(5);emit(0xec);save(6);
  emit(0xb0,1,0xe6,0x61);edge(1001);emit(0xec);save(7);emit(0xec);save(8);
  emit(0x9c,0x58,0xa3,10,0,0xc7,6,12,0,0x0d,0x60,0xeb,0xfe);
  const f=fixture();f.b.fill(0,0x200,0xa00);f.b.set(code,0x200);
  const block=imports.host.log_block;imports.host.log_block=(a,sp)=>{if(e){const off=a-e.win16_seg_base_of(1);if(Object.hasOwn(events,off))tick=events[off];}return block(a,sp);};
  const {instance}=await WebAssembly.instantiate(bytes,imports);wine.instance=instance;e=instance.exports;
  new Uint8Array(wine.memory.buffer).set(f.b,e.get_staging());assert(e.load_ne(f.b.length)>0);e.set_trace_esp(1,0,0);
  const data=e.win16_seg_base_of(3),get=o=>e.guest_read8(data+o);
  for(let i=0;i<30&&get(12)!==13;i++)e.run(100);
  assert.equal(get(12),13);
  assert.deepEqual(Array.from({length:9},(_,i)=>get(i)),[255,255,0xb4,0,255,0,255,0x34,0x12]);
  assert(get(10)&1,'IN and OUT preserve carry through the complete sequence');
  return {bytes:Array.from({length:14},(_,i)=>get(i))};
}
async function main(){
  const wasm=process.env.WINE_ASSEMBLY_WASM||root+'/build/wine-assembly.wasm',bytes=fs.readFileSync(wasm);
  const legacy=!WebAssembly.Module.imports(await WebAssembly.compile(bytes)).some(x=>x.name==='pit_io');
  assert.equal(legacy,false,'shipped module must route PIT I/O to the shared device');
  const results={wasm,legacy,normal:await run(bytes,{legacy})};
  if(!legacy){results.floating=await run(bytes,{floating:true});results.sequence=await sequence(bytes);}
  if(process.env.PIT_EVIDENCE)fs.writeFileSync(process.env.PIT_EVIDENCE,JSON.stringify(results,null,2)+'\n');
  console.log('PASS generated Win16 PIT calibration; '+(legacy?'legacy floating FF causes divide-zero and yield2':'mode2 count/gate sequence and strict floating-FF fault control'));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={fixture,run};
