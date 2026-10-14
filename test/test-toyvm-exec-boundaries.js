// Portable real DOS Machine handler contracts; synthetic in-memory files only.
'use strict';
const assert=require('assert'),path=require('path');
const {Machine,loadExe,ENV_SEG,DEFAULT_ALLOC_TOP}=require(path.resolve(process.argv[2]||path.join(__dirname,'..'),'tools/toyvm/dos.js'));
const w=(m,a,v)=>{m[a]=v&255;m[a+1]=v>>8};const u=(m,a)=>m[a]|m[a+1]<<8;
function setup(){const mem=new Uint8Array(1<<20),m=new Machine(mem);m.installEnvironment('PARENT.EXE');m.curPsp=m.pspSeg=0x100;m.imageTop=m.allocTop=0x300;m.installArena();m.tempFiles.set('child.com',{data:Buffer.from([0xcd,0x20]),len:2});m.tempFiles.set('grand.com',{data:Buffer.from([0xcd,0x20]),len:2});return m;}
function exec(m,name='CHILD.COM',env=0,al=0){const a=0x1200;Buffer.from(name+'\0').copy(Buffer.from(m.mem.buffer),a);w(m.mem,0x1300,env);w(m.mem,0x1302,0x400);w(m.mem,0x1304,0x100);m.mem[0x1400]=0;const regs={ds:0x100,dx:0x200,es:0x100,bx:0x300,ss:0x100};const r={get:k=>regs[k]||0,set:(k,v)=>regs[k]=v,setResultCf:v=>regs.cf=v,ret:{cs:0x100,ip:0x222,sp:0xff0}};m.int21Call(0x4b,al,r);return regs;}
function env(m,psp=m.curPsp){const seg=u(m.mem,(psp<<4)+0x2c),a=seg<<4;let end=a;while(end<m.mem.length-1 && (m.mem[end]||m.mem[end+1]))end++;assert(end<m.mem.length-1);let p=end+4,q=p;while(m.mem[q])q++;return {seg,vars:Buffer.from(m.mem.slice(a,end+2)),name:Buffer.from(m.mem.slice(p,q)).toString(),count:u(m.mem,end+2)};}
function exit(m,tsr=false){m.int21Call(tsr?0x31:0x4c,0,{get:()=>0x40});}

let groups=0;function test(name,fn){fn();groups++;console.log('PASS '+name);}
test('child allocation from lower hole is reusable after return',()=>{const m=setup();m.imageTop=0x200;m.memFree=[{seg:0x250,size:0x20}];exec(m);const allocated=m.memAlloc(0x10);assert.equal(allocated,0x251);assert.equal(m.mcbOwner(allocated),m.curPsp);exit(m);assert(!m.memBlocks.has(allocated));assert.equal(m.memAlloc(0x10),allocated);});
test('surviving block crossing saved floor excludes overlapping holes',()=>{const m=setup();exec(m);const p=m.execStack.at(-1);p.imageTop=0x320;p.allocTop=0x320;const owner=0x777,seg=0x310,size=0x30;m.memBlocks.set(seg,size);m.mcbWrite(seg,owner,size);m.memFree.push({seg:0x300,size:0x18});exit(m);assert(m.imageTop>=seg+size);assert.equal(m.mcbOwner(seg),owner);for(const hole of m.memFree)assert(hole.seg+hole.size<=seg-1||hole.seg>=seg+size);});
test('AH31 DX0 preserves environment without zero-size image allocation',()=>{const m=setup();exec(m);const child=m.curPsp,e=env(m);m.int21Call(0x31,0,{get:()=>0});assert.equal(m.curPsp,0x100);assert(!m.memBlocks.has(child));assert(m.memBlocks.has(e.seg));assert.equal(m.mcbOwner(e.seg),child);assert(Number.isInteger(m.allocTop));});
test('AL1 image and env survive loading ancestor exit and explicit unload',()=>{const m=setup();exec(m);exec(m,'GRAND.COM',0,1);const loaded=u(m.mem,0x1314),e=env(m,loaded),image=m.mem.slice(loaded<<4,(loaded+0x1000)<<4);assert.equal(m.mcbOwner(loaded),loaded);assert.equal(m.memBlocks.get(loaded),0x1000);exit(m);assert.equal(m.curPsp,0x100);assert(m.imageTop>=loaded+0x1000);exec(m);assert.deepEqual(m.mem.slice(loaded<<4,(loaded+0x1000)<<4),image);exit(m);for(const seg of [e.seg,loaded])m.int21Call(0x49,0,{get:k=>k==='es'?seg:0,setResultCf:v=>assert.equal(v,false)});assert(!m.memBlocks.has(e.seg));assert(!m.memBlocks.has(loaded));assert(m.memAlloc(0x80)!==null);});

function hold(m,seg,size,byte=0x5a){m.memBlocks.set(seg,size);m.mcbWrite(seg,0x100,size);m.mem.fill(byte,seg*16,(seg+size)*16);}
test('EXEC default ceiling preserves held callback block and its MCB',()=>{
  const m=setup();m.allocTop=DEFAULT_ALLOC_TOP;hold(m,0x301,0x80,0xa7);hold(m,DEFAULT_ALLOC_TOP-4,4,0xb8);
  m.memFree=[{seg:0x381,size:DEFAULT_ALLOC_TOP-5-0x381}];
  const held=m.mem.slice(0x3000,0x3810),top=m.mem.slice((DEFAULT_ALLOC_TOP-5)*16,DEFAULT_ALLOC_TOP*16);
  assert.equal(exec(m).cf,false);const e=env(m);
  assert(e.seg>0x381);assert.equal(u(m.mem,m.curPsp*16+2),DEFAULT_ALLOC_TOP-5);
  assert.deepEqual(m.mem.slice(0x3000,0x3810),held);assert.deepEqual(m.mem.slice((DEFAULT_ALLOC_TOP-5)*16,DEFAULT_ALLOC_TOP*16),top);
  assert.equal(m.memBlocks.get(0x301),0x80);
  for(const b of m.memFree)assert(b.seg+b.size<=e.seg-1||b.seg>=DEFAULT_ALLOC_TOP-5);
  assert.equal(m.memAlloc(1),null,'no child or held byte may be handed out by subsequent AH48');
  exit(m);assert.deepEqual(m.mem.slice(0x3010,0x3810),held.slice(16));
  assert.equal(m.memBlocks.get(0x301),0x80);
});
test('EXEC skips fragmented short gaps including each held MCB',()=>{
  const m=setup();m.allocTop=DEFAULT_ALLOC_TOP;hold(m,0x400,0x10);hold(m,0x900,0x10);hold(m,0x2000,0x100);
  const snapshots=[0x400,0x900,0x2000].map(seg=>[seg,m.mem.slice((seg-1)*16,(seg+m.memBlocks.get(seg))*16)]);
  assert.equal(exec(m).cf,false);assert(env(m).seg>0x910);assert(m.curPsp+0x1000<=0x1fff);
  assert.equal(u(m.mem,m.curPsp*16+2),0x1fff);
  for(const [seg,b]of snapshots)assert.deepEqual(m.mem.slice((seg-1)*16,(seg-1)*16+b.length),b);
});
test('EXEC no adequate contiguous gap fails before guest or allocator mutation',()=>{
  const m=setup();m.allocTop=DEFAULT_ALLOC_TOP;for(let seg=0x400;seg<DEFAULT_ALLOC_TOP;seg+=0x800)hold(m,seg,0x10);
  // Seed parameter bytes before taking the failure snapshot.
  const original=m.tempFiles.get('child.com');m.tempFiles.delete('child.com');exec(m);m.tempFiles.set('child.com',original);
  const bytes=m.mem.slice(),blocks=[...m.memBlocks],holes=JSON.stringify(m.memFree),r=exec(m);
  assert.equal(r.cf,true);assert.equal(r.ax,8);assert.deepEqual(m.mem,bytes);assert.deepEqual([...m.memBlocks],blocks);
  assert.equal(JSON.stringify(m.memFree),holes);assert.equal(m.curPsp,0x100);assert.equal(m.execStack.length,0);
});
test('load-only EXEC also avoids occupied environment and image spans',()=>{
  const m=setup();m.allocTop=DEFAULT_ALLOC_TOP;hold(m,0x301,0x80,0xcc);const before=m.mem.slice(0x3000,0x3810);
  assert.equal(exec(m,'CHILD.COM',0,1).cf,false);const child=u(m.mem,0x1314),e=env(m,child);
  assert(e.seg>0x381);assert.equal(m.memBlocks.get(child),0x1000);assert.deepEqual(m.mem.slice(0x3000,0x3810),before);
});

console.log(JSON.stringify({groups,status:'PASS'}));
