'use strict';
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const pins=JSON.parse(fs.readFileSync('source-pins.json'));
for(const [p,v] of Object.entries(pins)){const b=fs.readFileSync(p);assert.equal(b.length,v.bytes,p);assert.equal(sha(b),v.sha256,p);}
if(process.argv[2]==='startup'){
 assert.equal(process.versions.node.split('.')[0],'24');
 assert(new WebAssembly.Memory({initial:1,maximum:1,shared:true}).buffer instanceof SharedArrayBuffer);
 const r={PASS:true,node:process.execPath,versions:process.versions,execArgv:process.execArgv,limits:fs.readFileSync('/proc/self/limits','utf8'),sourcePins:Object.keys(pins).length};
 fs.writeFileSync('startup-runtime.json',JSON.stringify(r,null,2));console.log(JSON.stringify(r));
}else if(process.argv[2]==='compile'){
 const {watxSourceClosure,compileClosure}=require('./tools/watx-closure.js');
 // Pinned production compileClosure fixes standardWat/strictDeclarations=true,
 // runtimeBuiltins=false and production mode. No transforms or extraction.
 const result=compileClosure(watxSourceClosure(),{tailCalls:true});
 const bytes=result.wasmBinary;assert(bytes,'binary missing');
 fs.writeFileSync('complete.wasm',bytes);
 const valid=WebAssembly.validate(bytes);assert(valid);
 const mod=new WebAssembly.Module(bytes);
 const inventory={imports:WebAssembly.Module.imports(mod),exports:WebAssembly.Module.exports(mod)};
 fs.writeFileSync('module-inventory.json',JSON.stringify(inventory,null,2));
 const report={PASS:true,candidate:'0398b45f47717da0f178779a34bc54aa0ef0ec53',sourcePins:Object.keys(pins).length,sourceManifestSHA256:sha(fs.readFileSync('source-pins.json')),compilerSHA256:pins['tools/watx-closure.js'].sha256,options:{mode:'production',standardWat:true,strictDeclarations:true,runtimeBuiltins:false,tailCalls:true},wasmBytes:bytes.length,wasmSHA256:sha(bytes),valid,imports:inventory.imports.length,exports:inventory.exports.length,inventorySHA256:sha(fs.readFileSync('module-inventory.json'))};
 fs.writeFileSync('compile-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}else if(process.argv[2]==='instantiate'){
 const bytes=fs.readFileSync('complete.wasm'),mod=new WebAssembly.Module(bytes);
 const inventory=JSON.parse(fs.readFileSync('module-inventory.json'));
 const imports={},calls=[];
 // Explicit synthetic host state: zero-filled 512MiB shared memory matching
 // the actual production declaration (8192 initial / 32768 maximum pages).
 // No PE, guest, device backend, or x86 callback execution is provided.
 for(const i of inventory.imports){
   imports[i.module]??={};
   if(i.kind==='function')imports[i.module][i.name]=()=>{calls.push(i.module+'.'+i.name);throw Error('unavailable host import '+i.module+'.'+i.name);};
   else if(i.kind==='memory'&&i.module==='host'&&i.name==='memory')imports[i.module][i.name]=new WebAssembly.Memory({initial:8192,maximum:32768,shared:true});
   else throw Error('unsupported authoritative import '+JSON.stringify(i));
 }
 const instance=new WebAssembly.Instance(mod,imports),e=instance.exports;
 const traceExports=inventory.exports.filter(i=>/callback.*trace|trace.*callback/i.test(i.name));
 assert.deepEqual(traceExports.map(i=>i.name).sort(),['get_audio_callback_trace','set_audio_callback_trace']);
 const read=()=>Array.from({length:10},(_,i)=>e.get_audio_callback_trace(i));
 const initial=read();assert(initial.every(x=>x===0));
 e.set_audio_callback_trace(1);const enabled=read();assert.deepEqual(enabled,initial);
 e.set_audio_callback_trace(0);const disabled=read();assert.deepEqual(disabled,initial);
 assert.deepEqual(calls,[]);
 const report={PASS:true,wasmSHA256:sha(bytes),traceExports,initial,enabled,disabled,hostImportsInvoked:calls,initialization:'WebAssembly data/global initialization only; sufficient for global-only trace setter/getter. No init_thread, heap, guest or backend initialization needed or attempted.',syntheticState:'zero-filled host.memory initial8192 maximum32768 shared pages; every function import fails closed if invoked',limitation:'No x86/native callback execution or game acceptance claimed.'};
 fs.writeFileSync('instantiate-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}else throw Error('unknown phase');
