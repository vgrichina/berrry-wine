'use strict';
// A generated NE consumer of the absolute __WINFLAGS export. No guest bytes.
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = process.env.WINE_TEST_ROOT || path.resolve(__dirname, '..');
const {neLifecycleImage} = require(root + '/test/helpers/ne-lifecycle-image');
const {createHostImports} = require(root + '/lib/host-imports');
const browser = {createHostImports, console:{log(){},error(){}}};
vm.runInNewContext(fs.readFileSync(root + '/host.js','utf8')+'\n;globalThis.Host=WineAssembly;',browser);

function fixture(noise=0) {
  const b=Buffer.alloc(0x1500),n=0x80,w=(p,v)=>b.writeUInt16LE(v,p);
  neLifecycleImage().copy(b,0,0,0x200);
  w(n+12,1);w(n+0x14,0x40);w(n+0x18,0xff00);w(n+0x1a,2);
  w(n+0x1e,1);w(n+0x42,0x1000);w(n+0x44,0x100);w(n+0x46,0x1000);
  w(n+0x48,0x140);w(n+0x4a,0x100);w(n+0x4c,1);w(n+0x4e,0);
  w(n+0x90,0);b[n+0xb0]=6;b.write('KERNEL',n+0xb1);
  const c=Array(0x40).fill(0),relocs=[],emit=(...v)=>c.push(...v),word=v=>emit(v&255,v>>>8&255);
  const reloc=(type,at,ordinal,additive=false)=>relocs.push({type,at,ordinal,additive});
  const api=ordinal=>{emit(0x9a);const at=c.length;word(0xffff);word(0);reloc(3,at,ordinal);};
  const push=v=>{emit(0x68);word(v);},save=o=>{emit(0xa3);word(o);emit(0x89,0x16);word(o+2);};
  const patch=(p,v)=>{c[p]=v&255;c[p+1]=v>>>8&255;};
  // Put unrelated callable relocations first, so the test detects dependence
  // on thunk assignment. They are ordinary imports but are never executed.
  for(let i=0;i<noise;i++){const at=0x20+4*i;patch(at,0xffff);reloc(3,at,70+i);}
  patch(0x10,0x12);patch(0x12,0xffff);reloc(5,0x10,178);
  patch(0x14,7);reloc(5,0x14,178,true);
  patch(0x16,0xffff);reloc(0,0x16,178);
  patch(0x18,0xffff);reloc(5,0x18,113);
  patch(0x1a,0xffff);reloc(5,0x1a,114);
  emit(0x8b,0xc4,0xa3,0x30,0);api(132);save(0);
  emit(0x2e,0xa1,0x10,0,0xa3,4,0);
  // Generic C-runtime policy: round a near-64K request into a whole 64K
  // global block. WF_STANDARD forbids that block; enhanced mode permits it.
  emit(0xba,0,0xfa,0x81,0xc2,0x19,0x10,0x81,0xe2,0,0xf0,0x31,0xc9,0x0b,0xd2,0x75,12,
    0x2e,0xf7,6,0x10,0,0x10,0,0x75,0);
  const refused=c.length-1;emit(0x41,0xeb,0);const toAlloc=c.length-1;
  const alloc=c.length;emit(0x6a,2,0x51,0x52);api(15);emit(0xa3,8,0,0x0b,0xc0,0x74,0);const failed=c.length-1;
  emit(0xff,0x36,8,0);api(20);save(10);
  emit(0xff,0x36,8,0);api(18);save(14);
  // Save an actual store near the requested range's end through the lock.
  emit(0x8e,0xc2,0x26,0xc7,6,0xfe,0xf9,0x34,0x12,0x26,0xa1,0xfe,0xf9,0xa3,20,0);
  emit(0xff,0x36,8,0);api(19);
  emit(0xff,0x36,8,0);api(17);emit(0xa3,18,0);
  const done=c.length;emit(0x8b,0xc4,0xa3,0x32,0,0xc7,6,0x34,0,0x0d,0x60,0xeb,0xfe);
  c[refused]=(done-refused-1)&255;c[toAlloc]=(alloc-toAlloc-1)&255;c[failed]=(done-failed-1)&255;
  // JNZ after OR DX,DX must reach the same allocation arguments.
  const pattern=Buffer.from(c).indexOf(Buffer.from([0x0b,0xd2,0x75]));
  c[pattern+3]=(alloc-(pattern+4))&255;
  b.set(c,0x200);w(0x1200,relocs.length);
  relocs.forEach((r,i)=>{const p=0x1202+8*i;b[p]=r.type;b[p+1]=1|(r.additive?4:0);w(p+2,r.at);w(p+4,1);w(p+6,r.ordinal);});
  return b;
}
async function run(bytes,version,noise=0) {
  const wine=new browser.Host();wine.memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});wine.logToUI=()=>{};
  const imports=wine.getImports({detached:true,threadId:1});imports.host.memory=wine.memory;imports.host.exit=()=>{};
  const {instance}=await WebAssembly.instantiate(bytes,imports);wine.instance=instance;
  const e=instance.exports;e.set_winver(version);
  const b=fixture(noise);new Uint8Array(wine.memory.buffer).set(b,e.get_staging());assert(e.load_ne(b.length)>0);
  const data=e.win16_seg_base_of(3),code=e.win16_seg_base_of(1),get=a=>e.guest_read8(a)|(e.guest_read8(a+1)<<8);
  for(let i=0;i<30&&get(data+0x34)!==0x600d;i++)e.run(100);
  const result={version,noise,words:Array.from({length:27},(_,i)=>get(data+i*2)),codeWords:[0x10,0x12,0x14,0x16,0x18,0x1a].map(o=>get(code+o)),yield:e.get_yield_reason(),thunks:e.win16_thunk_count()};
  return result;
}
function check(r) {
  const v=r.version&255,flags=0x429|(v>=4?0x4000:0),w=r.words;
  assert.equal(w[26],0x600d,'consumer completes');
  assert.equal(w[0],flags,'existing GetWinFlags machine result');assert.equal(w[1],0);
  assert.equal(w[2],w[0],'absolute __WINFLAGS equals callable GetWinFlags');
  assert.deepEqual(r.codeWords,[flags,flags,flags+7,0xff00|(flags&255),3,8],'chained/additive/LOBYTE relocation and huge constants');
  assert(w[4]>0,'enhanced-mode consumer reaches real GlobalAlloc');
  assert.equal(w[5]+65536*w[6],65536,'whole segment allocation size');
  assert(w[8]>0,'real GlobalLock selector');assert.equal(w[9],0,'GlobalFree succeeds');
  assert.equal(w[10],0x1234,'allocated memory is writable at end of requested range');
  assert.equal(w[24],w[25],'Pascal calls preserve stack balance');assert.notEqual(r.yield,2);
}
async function main() {
  const bytes=fs.readFileSync(process.env.WINE_ASSEMBLY_WASM||root+'/build/wine-assembly.wasm'),results=[];
  for(const version of [0x0a03,0x0a04])for(const noise of [0,5])results.push(await run(bytes,version,noise));
  if(process.env.WINFLAGS_EVIDENCE)fs.writeFileSync(process.env.WINFLAGS_EVIDENCE,JSON.stringify(results,null,2)+'\n');
  for(const r of results)check(r);
  console.log('PASS absolute Win16 __WINFLAGS equals GetWinFlags across versions and thunk ordering; chained/additive/LOBYTE imports; generated 64K allocation consumer and Pascal stack');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={fixture,run,check};
