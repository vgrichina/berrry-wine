'use strict';
// Identity observation only; delegate unchanged arguments/results to the engine.
const fs=require('fs'),crypto=require('crypto'),path=require('path');
const events=[],mods=new WeakMap();
const hash=b=>crypto.createHash('sha256').update(Buffer.from(b.buffer||b,b.byteOffset||0,b.byteLength)).digest('hex');
const compile=WebAssembly.compile,instantiate=WebAssembly.instantiate,Module=WebAssembly.Module;
WebAssembly.compile=async function(bytes,...args){const m=await compile.call(this,bytes,...args);const sha256=hash(bytes);mods.set(m,sha256);events.push({op:'compile',sha256});return m;};
WebAssembly.Module=new Proxy(Module,{construct(target,args){const m=Reflect.construct(target,args);const sha256=hash(args[0]);mods.set(m,sha256);events.push({op:'Module',sha256});return m;}});
WebAssembly.instantiate=async function(input,...args){const sha256=input instanceof Module ? mods.get(input)||'unknown-precompiled-module' : hash(input);const result=await instantiate.call(this,input,...args);if(result.module)mods.set(result.module,sha256);events.push({op:'instantiate',sha256});return result;};
process.on('exit',()=>{fs.writeFileSync(path.join(process.env.WA_IDENTITY_DIR,process.pid+'.json'),JSON.stringify({pid:process.pid,argv:process.argv,node:process.version,events},null,2)+'\n');});
