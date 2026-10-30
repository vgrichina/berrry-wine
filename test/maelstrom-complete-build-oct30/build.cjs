'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root='/tmp/maelbuild'; process.chdir(root);
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const report={historicalBase:'55f9724ef127100c3bb54aebca73e5cda5472c5f',helperCommit:'f8fbf6576390008ecfe974f8754e2a321ce020ef',engine:process.versions,executable:process.execPath,executableSHA256:sha(fs.readFileSync(process.execPath)),phase:'verify',guestExecuted:false};
const save=()=>fs.writeFileSync('result.json',JSON.stringify(report,null,2));
try {
 const manifest=JSON.parse(fs.readFileSync('manifest.json'));
 for(const i of manifest.items){const b=fs.readFileSync(i.path);assert.equal(b.length,i.bytes,i.path);assert.equal(sha(b),i.sha256,i.path);}
 report.verifiedItems=manifest.items.length;report.verifiedBytes=manifest.items.reduce((n,i)=>n+i.bytes,0);report.manifestSHA256=sha(fs.readFileSync('manifest.json'));
 const helper=require(root+'/tools/maelstrom-native-errno-latch.cjs');
 const pins={...helper.PINS,...helper.UOP_PINS};assert.equal(Object.keys(pins).length,13);
 const sources=Object.fromEntries(Object.keys(pins).map(p=>[p,fs.readFileSync(p,'utf8')]));
 for(const [p,h] of Object.entries(pins))assert.equal(sha(sources[p]),h,p);
 const binaries=Object.fromEntries(Object.entries({net:'SDL_net.dll',crt:'msvcrt.dll',exe:'Maelstrom.exe'}).map(([k,p])=>[k,fs.readFileSync('binaries/'+p)]));
 report.phase='transform';save();
 const output=helper.transform(sources,{enabled:true,binaries,crtLoadedBase:0x522000,uopNativeBoundaries:true});
 assert.deepEqual(Object.keys(output).sort(),Object.keys(sources).sort());
 const changed=Object.keys(output).filter(p=>output[p]!==sources[p]).sort();
 assert.deepEqual(changed,['src/05-alu.wat','src/06b-core-handlers.wat','src/07d-uop-engine.wat','src/07e-uop-compiler.wat','src/09b-dispatch.wat','src/09d-winsock.wat']);
 report.transformed=Object.fromEntries(Object.keys(output).map(p=>[p,{inputSHA256:sha(sources[p]),outputSHA256:sha(output[p]),changed:output[p]!==sources[p]}]));
 // Keep originals immutable on disk. The production closure's include order
 // remains rooted at main.watx, while only the fresh transform overlays the VFS.
 const {sourceTextFromBytes,compile}=require(root+'/tools/watx.js');
 const {watxSourceClosure}=require(root+'/tools/watx-closure.js');
 const closure=watxSourceClosure();
 for(const [p,text] of Object.entries(output))for(const key of [path.basename(p),p,'./'+path.basename(p)])closure.vfs.set(key,sourceTextFromBytes(Buffer.from(text)));
 report.entry=closure.entry;report.entrySHA256=sha(fs.readFileSync('src/main.watx'));report.phase='compile';save();
 const c=compile(closure.source,closure.vfs,{mode:'production',standardWat:true,runtimeBuiltins:false,strictDeclarations:true,tailCalls:true,logSummary:false,logFunctions:false,debugArtifacts:false});
 report.stages=c.stages;assert.equal(c.success,true,JSON.stringify({error:c.error,line:c.errorLine,col:c.errorCol,diagnostics:c.diagnostics}).slice(0,4000));
 report.wasm={bytes:c.wasmBinary.length,sha256:sha(c.wasmBinary)};fs.writeFileSync('complete.wasm',c.wasmBinary);
 report.regionsSHA256=sha(JSON.stringify(c.regions));fs.writeFileSync('regions.json',JSON.stringify(c.regions));
 report.phase='module';save();
 const module=new WebAssembly.Module(c.wasmBinary);const imports=WebAssembly.Module.imports(module),exports=WebAssembly.Module.exports(module);
 report.imports=imports;report.exports=exports;report.importsSHA256=sha(JSON.stringify(imports));report.exportsSHA256=sha(JSON.stringify(exports));
 const host={};let calls=0;
 for(const i of imports){const ns=host[i.module]??={};if(i.kind==='function')ns[i.name]=()=>{calls++;throw Error('unexpected host call during instantiate: '+i.module+'.'+i.name);};else if(i.kind==='memory'){assert.equal(i.module+'.'+i.name,'host.memory');ns[i.name]=new WebAssembly.Memory({initial:8192,maximum:32768,shared:true});}else throw Error('unsupported import '+JSON.stringify(i));}
 report.phase='instantiate';save();
 const instance=new WebAssembly.Instance(module,host);assert.equal(calls,0);assert.ok(instance.exports);assert.ok(host.host.memory.buffer instanceof SharedArrayBuffer);
 report.sharedMemoryBytes=host.host.memory.buffer.byteLength;report.hostFunctionCalls=calls;report.phase='complete';report.status='PASS';
 report.executionLimitation='Complete transformed module compiled and instantiated only. No guest initialization, binary loading, select call, native CALL/RET, or gameplay executed. Exported latch getters do not establish a valid live guest/thread/stack; next gap is production loader initialization and bounded real select/native-return execution.';
 save();console.log(JSON.stringify({status:report.status,phase:report.phase,wasm:report.wasm,imports:imports.length,exports:exports.length,regionsSHA256:report.regionsSHA256}));
}catch(e){report.status='FAIL';report.failure={name:e.name,message:String(e.message).slice(0,6000),stack:String(e.stack).slice(0,8000)};save();console.error(JSON.stringify({phase:report.phase,failure:report.failure}));process.exitCode=1;}
