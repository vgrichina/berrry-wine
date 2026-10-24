'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=__dirname, binding=JSON.parse(fs.readFileSync(root+'/source-binding.json'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const row of binding.closure){const b=fs.readFileSync(root+'/inputs/'+row.path);assert.equal(b.length,row.bytes);assert.equal(sha(b),row.sha256,row.path);}
const dllPath='/home/user/wine-assembly/scratch/runs/20261018-madbomber-source/original/madbomber-0.2.5/SDL.dll';
const dll=fs.readFileSync(dllPath);assert.equal(dll.length,86016);assert.equal(sha(dll),'55eced17cf8a9b7acc671cc307503de847a3c36fdafafe14cee7917433cfe410');
const bytes=fs.readFileSync(binding.module);assert.equal(sha(bytes),binding.moduleSHA256);
const {createHostImports}=require('./inputs/lib/host-imports');
const {makeFixture}=require('./inputs/tools/kernel32-native-fixture');
const loader=require('./inputs/lib/dll-loader');
(async()=>{
 const mod=await WebAssembly.compile(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
 const ctx={getMemory:()=>memory.buffer,renderer:null,resourceJson:{}};
 const imports=createHostImports(ctx);imports.host.memory=memory;
 for(const i of WebAssembly.Module.imports(mod)){assert.equal(i.module,'host');if(i.kind==='function'&&!imports.host[i.name])imports.host[i.name]=()=>{throw Error('Unexpected host dependency '+i.name);};}
 const e=(await WebAssembly.instantiate(mod,imports)).exports;ctx.exports=e;
 const pe=makeFixture();new Uint8Array(memory.buffer).set(pe,e.get_staging());assert(e.load_pe(pe.length));
 const result=loader.loadDll(e,memory.buffer,dll,'C:\\fixture\\SDL.dll');
 console.log('mapped',JSON.stringify(result));
 let failure=null;
 try{loader.callDllMain(e,result.loadAddr,result.dllMain,s=>console.log(s),{memoryBuffer:memory.buffer,requireCompletion:true});}catch(err){failure=String(err);console.error(failure);}
 const wa=e.guest_to_wasm(result.loadAddr)>>>0;
 fs.writeFileSync(root+'/sdl-mapped.bin',Buffer.from(memory.buffer,wa,0x3a000));
 const report={...result,failure,eip:e.get_eip()>>>0,esp:e.get_esp()>>>0,eax:e.get_eax()>>>0,yield:e.get_yield_reason(),imports:WebAssembly.Module.imports(mod).length,mappedSHA256:sha(Buffer.from(memory.buffer,wa,0x3a000))};
 fs.writeFileSync(root+'/inspect-result.json',JSON.stringify(report,null,2)+'\n');
 if(failure)process.exitCode=1;
})().catch(err=>{console.error(err);process.exitCode=1;});
