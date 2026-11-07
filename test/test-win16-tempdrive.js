'use strict';
// Generated NE caller; no application/media bytes.
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=process.env.WINE_TEST_ROOT||path.resolve(__dirname,'..');
const {neLifecycleImage}=require(root+'/test/helpers/ne-lifecycle-image');
const {createHostImports}=require(root+'/lib/host-imports');
const {VirtualFS}=require(root+'/lib/filesystem');
const ctx={createHostImports,console:{log(){},error(){}}};
vm.runInNewContext(fs.readFileSync(root+'/host.js','utf8')+'\n;globalThis.Host=WineAssembly;',ctx);
function fixture(){
 const b=Buffer.alloc(0x1500),n=0x80,w=(p,v)=>b.writeUInt16LE(v,p);
 neLifecycleImage().copy(b,0,0,0x200);
 for(const [o,v] of [[12,1],[0x14,0],[0x18,0xff00],[0x1a,2],[0x1e,1],[0x42,0x1000],[0x44,0x100],[0x46,0x1000],[0x48,0x140],[0x4a,0x100],[0x4c,1],[0x4e,0],[0x90,0]])w(n+o,v);
 b[n+0xb0]=6;b.write('KERNEL',n+0xb1);
 const c=[],rel=[],emit=(...x)=>c.push(...x),word=v=>emit(v&255,v>>>8&255);
 emit(0x8b,0xc4,0xa3,0x80,0); // initial SP
 for(const [i,arg] of [0,0x41,0x64,0xffff].entries()){
  emit(0xbb,0x57,0x13,0xb9,0x68,0x24,0xbe,0x79,0x35,0xbf,0x8a,0x46,0xbd,0x9b,0x57);
  emit(0x68);word(arg);emit(0x9a);rel.push(c.length);word(0xffff);word(0);
  const o=i*16;emit(0xa3);word(o);emit(0x89,0x16);word(o+2);
  emit(0x8b,0xc4,0xa3);word(o+4);
  for(const [op,off] of [[0x1e,6],[0x0e,8],[0x36,10],[0x3e,12],[0x2e,14]]){emit(0x89,op);word(o+off);}
 }
 emit(0xc7,6,0x82,0,0x0d,0x60,0xeb,0xfe);b.set(c,0x200);
 w(0x1200,rel.length);rel.forEach((at,i)=>{const p=0x1202+i*8;b[p]=3;b[p+1]=1;w(p+2,at);w(p+4,1);w(p+6,92);});return b;
}
async function run(bytes,temp,cwd){
 const vfs=new VirtualFS();vfs.cwd=cwd;
 if(temp!==null)vfs.getTempPath=()=>temp;
 const wine=new ctx.Host();wine.memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});wine.logToUI=()=>{};
 const imports=wine.getImports({detached:true,threadId:1,vfs});imports.host.memory=wine.memory;
 const {instance}=await WebAssembly.instantiate(bytes,imports);wine.instance=instance;
 const e=instance.exports,b=fixture();new Uint8Array(wine.memory.buffer).set(b,e.get_staging());assert(e.load_ne(b.length)>0);
 const data=e.win16_seg_base_of(3),get=o=>e.guest_read8(data+o)|(e.guest_read8(data+o+1)<<8);
 for(let i=0;i<30&&get(0x82)!==0x600d;i++)e.run(100);
 assert.equal(get(0x82),0x600d,'far calls return to generated consumer');
 const letter=(temp===null?'C':temp?temp[0]:'C').toUpperCase().charCodeAt(0);
 for(let i=0;i<4;i++){
  const o=i*16;assert.equal(get(o),0x3a00|letter,'AX contains ASCII drive letter and colon');
  assert.equal(get(o+2),1,'DX success');assert.equal(get(o+4),get(0x80),'callee removes one WORD argument');
  assert.deepEqual([6,8,10,12,14].map(x=>get(o+x)),[0x1357,0x2468,0x3579,0x468a,0x579b],'non-result registers preserved');
 }
 return {temp,cwd,ax:get(0),dx:get(2),sp:get(4)};
}
async function main(){
 const bytes=fs.readFileSync(process.env.WINE_ASSEMBLY_WASM||root+'/build/wine-assembly.wasm'),results=[];
 for(const [temp,cwd] of [[null,'D:\\INSTALL\\'],['e:\\scratch\\','C:\\'],['Z:\\TEMP\\','D:\\'],['','D:\\']])results.push(await run(bytes,temp,cwd));
 if(process.env.TEMPDRIVE_EVIDENCE)fs.writeFileSync(process.env.TEMPDRIVE_EVIDENCE,JSON.stringify(results,null,2)+'\n');
 console.log('PASS Win16 GetTempDrive generated NE ordinal calls: AX/DX, Pascal stack, preserved registers, VFS temp/current-drive separation and fallback');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={fixture,run};
