'use strict';
// Offline controls: original EXE instruction bytes, canonical compiled CPU,
// and production GL query code. Controlled state is not recovered guest state.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const crypto=require('node:crypto'),vm=require('node:vm');
const {createHostImports}=require('../lib/host-imports');
const Region=require('../lib/region-map.generated');
const root=path.resolve(__dirname,'..'),out=process.argv[2];
assert(out&&path.resolve(out).startsWith(root+'/scratch/runs/'));
fs.mkdirSync(out,{recursive:true});
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const exePath='test/binaries/candidates/quake-3-arena-demo-installer/installed/quake3.exe';
const exe=fs.readFileSync(root+'/'+exePath),wasm=fs.readFileSync(root+'/build/wine-assembly.wasm');
assert.equal(sha(exe),'2c0dd4d06e3282e0abc41ebc8e84e2d9868a17182ac175b232a9bb604a8269a3');
const pe=exe.readUInt32LE(0x3c),optional=pe+24,base=exe.readUInt32LE(optional+28);
const sections=optional+exe.readUInt16LE(pe+20),count=exe.readUInt16LE(pe+6);
function bytes(lo,hi){
 for(let i=0;i<count;i++){
  const s=sections+i*40,va=base+exe.readUInt32LE(s+12),size=exe.readUInt32LE(s+16);
  if(lo>=va&&hi<=va+size)return exe.subarray(exe.readUInt32LE(s+20)+lo-va,exe.readUInt32LE(s+20)+hi-va);
 }throw Error('unmapped EXE instruction span');
}
async function main(){
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
 const ctx={exports:null,getMemory:()=>memory.buffer},host=createHostImports(ctx).host;
 Object.assign(host,{memory,exit(){},log(){},log_i32(){},crash_unimplemented(){throw Error('unexpected API');},wait_multiple:()=>0,shell_execute:()=>33});
 const {instance}=await WebAssembly.instantiate(wasm,{host});ctx.exports=instance.exports;
 const e=instance.exports,m=new Uint8Array(memory.buffer),d=new DataView(memory.buffer);
 m.set(exe,e.get_staging());e.load_pe(exe.length);assert.equal(e.get_image_base(),base);
 const g=a=>Region.g2w(a,base),stack=0x1300000,pixels=0x1500000;
 let nextCode=0x1400000;
 function run(code,setup,bounded=false,observe){
  const pc=nextCode;nextCode+=0x1000;m.set(code,g(pc));
  e.set_esp(stack);d.setUint32(g(stack),0,true);setup();e.set_eip(pc);
  let calls=0;do{e.run(10000);calls++;observe?.(calls);}while(e.get_eip()!==0&&calls<(bounded?2:10000));
  if(!bounded)assert.equal(e.get_eip(),0,'original instruction fragment terminates');
  return {slices:calls,terminated:e.get_eip()===0,eip:e.get_eip()};
 }
 // Preserve all scan instructions and internal branch displacements. The zero
 // count JLE lands at original 456af8: five NOPs after 456af3 lead to RET.
 const scan=Buffer.concat([bytes(0x456a53,0x456af3),Buffer.from([0x90,0x90,0x90,0x90,0x90,0xc3])]);
 const scans=[];
 for(const [w,h,alpha] of [[1,1,false],[17,13,true],[256,256,false],[1024,1024,true],[0,1,false]]){
  const n=w*h;let max=[0,0,0];
  for(let i=0;i<n;i++)for(let c=0;c<4;c++){
   const value=c===3?(alpha&&i===n-1?127:255):(i*17+c*37)%256;
   m[g(pixels)+i*4+c]=value;if(c<3)max[c]=Math.max(max[c],value);
  }
  const progress=[];
  const result=run(scan,()=>{
   // Original 456a58 drops the outstanding malloc argument before scanning.
   e.set_esp(stack-4);
   e.set_esi(w);e.set_edi(h);
   d.setUint32(g(stack+0x203c),pixels,true);
   for(const off of [0x34,0x2c,0x28])d.setFloat32(g(stack+off),0,true);
  },false,slice=>{
   if([1,400,800].includes(slice)&&e.get_eip()!==0)progress.push({slice,
    remaining:d.getInt32(g(stack+0x24),true),pixelPointer:e.get_ebp(),eip:e.get_eip()});
  });
  const actual=[0x34,0x2c,0x28].map(off=>d.getFloat32(g(stack+off),true));
  assert.deepEqual(actual,max);assert.equal(e.get_edx(),alpha?4:3);
  if(n)assert.equal(e.get_ebp(),pixels+2+n*4);
  for(let i=1;i<progress.length;i++){
   assert(progress[i].remaining<progress[i-1].remaining);
   assert(progress[i].pixelPointer>progress[i-1].pixelPointer);
  }
  scans.push({w,h,alpha,max:actual,samples:e.get_edx(),...result,progress});
 }
 // The exact dimension clamp, including its load from glConfig.maxTextureSize.
 const clamp=Buffer.concat([bytes(0x456a2e,0x456a42),Buffer.from([0xc3])]);
 const clamps=[];
 for(const limit of [2048,4096,0,-1]){
  const result=run(clamp,()=>{e.set_ebx(4096);e.set_eax(1024);d.setInt32(g(0x7cb1c0),limit,true);},limit<0);
  if(limit>0){assert(result.terminated);assert.equal(e.get_ebx(),Math.min(4096,limit));}
  if(limit===0){assert(result.terminated);assert.equal(e.get_ebx(),0);assert.equal(e.get_eax(),0);}
  if(limit<0)assert(!result.terminated,'negative limit reproduces nontermination only as controlled fault');
  clamps.push({limit,width:e.get_ebx(),height:e.get_eax(),...result});
 }
 // Production adapter/stream/bridge writes GL_MAX_TEXTURE_SIZE into real CPU
 // memory. Canvas-free software consumer; no WebGL hardware claim.
 const GL=require('../lib/gl-compat'),Stream=require('../lib/gl-command-stream');
 let queryBridge;
 const scope={OpenGLCompat:{...GL,OpenGLHostBridge:class extends GL.OpenGLHostBridge{
  constructor(...args){super(...args);queryBridge=this;}
 }},GLCommandStream:Stream,OffscreenCanvas:class{getContext(){return null;}},console,Uint8ClampedArray};
 vm.createContext(scope);vm.runInContext(fs.readFileSync(root+'/lib/gl-render-worker.js','utf8'),scope);
 const adapter=scope.GLRenderWorker.create({instance,memory,backend:'software',sendFrame(){assert.fail('query must not present');}});
 const command=g(0x1200000),query=0x1201000;
 function execute(name,args=[],aux=0){
  const size=36+args.length*4;m.fill(0,command,command+size);
  d.setUint32(command,size,true);d.setUint32(command+4,GL.CALL_INDEX[name],true);
  d.setUint32(command+8,aux,true);d.setUint32(command+12,4+args.length*4,true);
  args.forEach((a,i)=>d.setUint32(command+36+i*4,a,true));
  return adapter.execute({memoryOffset:command,bytes:size,owner:0,windows:[{hwnd:65543,w:16,h:16,clientSize:{w:16,h:16}}]});
 }
 let queryValue,queryFrontend;
 try{
  assert.equal(execute('wglCreateContext',[],65543).value,1);
  assert.equal(execute('wglMakeCurrent',[0,1],65543).value,1);
  queryFrontend=[...queryBridge.contexts.values()][0].frontend;
  d.setInt32(g(query),-123,true);execute('glGetIntegerv',[0xd33,query]);
  queryValue=d.getInt32(g(query),true);assert.equal(queryValue,2048);
  assert.equal(execute('glGetError').value,0);
 }finally{adapter.destroy();}
 const bridge=new GL.OpenGLHostBridge({getMemory:()=>memory.buffer,exports:()=>e});
 const backendQueries=[];
 for(const value of [4096,8192,0]){
  let requested;
  // Only the backend answer is controlled. This executes the production
  // query conversion/address writer; it does not instantiate native WebGL.
  const backend=queryFrontend.backend,originalQuery=backend.getParameter;
  backend.getParameter=pname=>(requested=pname,value);
  try{bridge._getIntegerv(queryFrontend,0xd33,query);}finally{backend.getParameter=originalQuery;}
  assert.equal(requested,0xd33);assert.equal(d.getInt32(g(query),true),value);
  backendQueries.push({controlledBackendValue:value,written:d.getInt32(g(query),true)});
 }
 const result={passed:true,exe:{path:exePath,sha256:sha(exe)},cpuSHA256:sha(wasm),
  scanSpan:['0x456a53','0x456af3'],scanSHA256:sha(bytes(0x456a53,0x456af3)),scans,clamps,
  adapter:{productionAdapter:true,productionBridge:true,productionStream:true,compiledMemory:true,backend:'software',maxTextureSize:queryValue,backendQueries},
  limitation:'Controlled fragment inputs; original image dimensions, remaining scan count, stack caller and native WebGL query result were not retained. No original initialization failure reproduced.'};
 fs.writeFileSync(path.resolve(out,'compiled-controls.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
