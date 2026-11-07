'use strict';
// Generated NE caller; no application/media bytes.
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=process.env.WINE_TEST_ROOT||path.resolve(__dirname,'..');
const {neLifecycleImage}=require(root+'/test/helpers/ne-lifecycle-image');
const {createHostImports}=require(root+'/lib/host-imports');
const {VirtualFS}=require(root+'/lib/filesystem');
const ctx={createHostImports,console:{log(){},error(){}}};
vm.runInNewContext(fs.readFileSync(root+'/host.js','utf8')+'\n;globalThis.Host=WineAssembly;',ctx);
function fixture(style=0x1000){
 const b=Buffer.alloc(0x1900),n=0x80,w=(p,v)=>b.writeUInt16LE(v,p);
 neLifecycleImage({dependencies:['LZEXPAND']}).copy(b,0,0,0x200);
 for(const [o,v] of [[12,1],[0x14,0],[0x18,0xff00],[0x1a,2],[0x42,0x1000],[0x44,0x100],[0x46,0x1000],[0x48,0x140],[0x4a,0x500],[0x4c,1],[0x4e,0]])w(n+o,v);
 const c=[],rel=[],emit=(...x)=>c.push(...x),word=v=>emit(v&255,v>>>8&255);
 const push=v=>{emit(0x68);word(v);};
 const call=ord=>{emit(0x9a);rel.push([c.length,ord]);word(0xffff);word(0);};
 const store=o=>{emit(0xa3);word(o);};
 emit(0x8b,0xc4);store(0x80);
 // Pascal arguments left to right: name, OFSTRUCT, style.
 for(const [name,ofs,mode,result] of [[0x100,0x300,0,0],[0x180,0x390,style,2]]){
  emit(0x1e);push(name);emit(0x1e);push(ofs);push(mode);call(2);store(result);
 }
 emit(0xff,0x36,0,0,0xff,0x36,2,0);call(1);store(4);
 emit(0x89,0x16,6,0,0x8b,0xc4);store(8);
 for(const o of [0,2]){emit(0xff,0x36,o,0);call(6);}
 emit(0xc7,6,0x82,0,0x0d,0x60,0xeb,0xfe);b.set(c,0x200);
 w(0x1200,rel.length);rel.forEach(([at,ord],i)=>{const p=0x1202+i*8;b[p]=3;b[p+1]=1;w(p+2,at);w(p+4,1);w(p+6,ord);});
 b.write('C:source.dat\0',0x1500);b.write('C:\\target\\copy.dat\0',0x1580);return b;
}
async function run(bytes,style,size,existing=true){
 const vfs=new VirtualFS();vfs.cwd='C:\\';vfs.ensureParentDirs('C:\\target\\copy.dat');
 const payload=Uint8Array.from({length:size},(_,i)=>(i*37+11)&255);
 vfs.files.set('c:\\source.dat',{data:payload,attrs:0x20});
 // OF_CREATE must truncate an existing destination as well as create one.
 if(existing)vfs.files.set('c:\\target\\copy.dat',{data:Uint8Array.from([9,8,7,6]),attrs:0x20});
 const wine=new ctx.Host();wine.memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});wine.logToUI=()=>{};
 const imports=wine.getImports({detached:true,threadId:1,vfs});imports.host.memory=wine.memory;
 const operations=[];
 for(const name of ['fs_create_file','fs_read_file','fs_write_file']){
  const original=imports.host[name];imports.host[name]=function(...args){const result=original.apply(this,args);operations.push({name,args,result});return result;};
 }
 const instance=bytes instanceof WebAssembly.Module?await WebAssembly.instantiate(bytes,imports):(await WebAssembly.instantiate(bytes,imports)).instance;wine.instance=instance;
 const e=instance.exports,b=fixture(style);new Uint8Array(wine.memory.buffer).set(b,e.get_staging());assert(e.load_ne(b.length)>0);
 const data=e.win16_seg_base_of(3),get=o=>e.guest_read8(data+o)|(e.guest_read8(data+o+1)<<8);
 for(let i=0;i<100&&get(0x82)!==0x600d;i++)e.run(100);
 assert.equal(get(0x82),0x600d,'generated imported far calls complete');
 const result=(get(4)|(get(6)<<16))|0;
 const evidence={style,size,existing,result,spBefore:get(0x80),spAfter:get(8),sourceHandle:get(0),destHandle:get(2),operations,destinationBytes:vfs.files.get('c:\\target\\copy.dat').data.length};
 if(process.env.LZCREATE_EVIDENCE)fs.appendFileSync(process.env.LZCREATE_EVIDENCE,JSON.stringify(evidence)+'\n');
 assert.equal(result,size,'LZCopy after OF_CREATE copies ordinary bytes; negative value is an LZERROR');
 assert.equal(get(8),get(0x80),'Pascal arguments and far returns balance');
 assert.deepEqual(vfs.files.get('c:\\target\\copy.dat').data,payload,'destination has exactly the generated source bytes');
 assert.deepEqual(vfs.files.get('c:\\source.dat').data,payload,'source remains unchanged');
 assert.equal([...vfs.handles.keys()].filter(h=>vfs.getOpenFile(h)).length,0,'both LZClose calls close their real VFS handles');
 return evidence;
}
async function main(){
 const bytes=fs.readFileSync(process.env.WINE_ASSEMBLY_WASM||root+'/build/wine-assembly.wasm');
 for(const [style,size,existing] of [[0x1000,0,false],[0x1000,3313,false],[0x1000,0x2345,true],[0x1001,3313,true],[0x1002,3313,true]])await run(bytes,style,size,existing);
 console.log('PASS generated Win16 LZEXPAND far calls with real VFS: OF_CREATE variants, truncation, empty and multi-chunk copying, bytes, stack and close');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={fixture,run};
