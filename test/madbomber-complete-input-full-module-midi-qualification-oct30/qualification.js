'use strict';
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const pins=JSON.parse(fs.readFileSync('source-pins.json'));
for(const [p,v] of Object.entries(pins)){const b=fs.readFileSync(p);assert.equal(b.length,v.bytes,p);assert.equal(sha(b),v.sha256,p);}
if(process.argv[2]==='startup'){
 assert(Number(process.versions.node.split('.')[0])>=24);
 const m=new WebAssembly.Memory({initial:1,maximum:1,shared:true});assert(m.buffer instanceof SharedArrayBuffer);
 console.log(JSON.stringify({PASS:true,node:process.execPath,versions:process.versions,execArgv:process.execArgv,limits:fs.readFileSync('/proc/self/limits','utf8'),sourcePins:Object.keys(pins).length}));
}else if(process.argv[2]==='compile'){
 const {watxSourceClosure,compileClosure}=require('./tools/watx-closure.js');
 const result=compileClosure(watxSourceClosure(),{tailCalls:true});
 fs.writeFileSync('compiler-result-keys.json',JSON.stringify(Object.keys(result)));
 const bytes=result.wasmBinary;
 assert(bytes,'compiler result must provide binary bytes: '+Object.keys(result));
 fs.writeFileSync('complete.wasm',bytes);
 const mod=new WebAssembly.Module(bytes);
 const inventory={imports:WebAssembly.Module.imports(mod),exports:WebAssembly.Module.exports(mod)};
 fs.writeFileSync('module-inventory.json',JSON.stringify(inventory,null,2));
 const report={PASS:true,entry:'src/main.watx',options:{mode:'production',standardWat:true,strictDeclarations:true,runtimeBuiltins:false,tailCalls:true},sourcePins:Object.keys(pins).length,moduleSHA256:sha(bytes),moduleBytes:bytes.length,importCount:inventory.imports.length,exportCount:inventory.exports.length,compilerResultKeys:Object.keys(result)};
 fs.writeFileSync('compile-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}else if(process.argv[2]==='lifecycle'){
 require('./lifecycle.js');
}else throw Error('unknown qualification mode');
