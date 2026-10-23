'use strict';
// FUTURE ONLY: validates/compiles the full binary in Node. Never invoked by readiness.
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const [file,expected]=process.argv.slice(2);
assert.match(expected||'',/^[a-f0-9]{64}$/);
const b=fs.readFileSync(file),sha=crypto.createHash('sha256').update(b).digest('hex');assert.equal(sha,expected);
let p=8;
function leb(){let v=0,m=1;for(let n=0;n<5;n++){assert(p<b.length);const c=b[p++];v+=(c&127)*m;if(!(c&128))return v;m*=128;}throw Error('invalid LEB');}
while(p<b.length){const id=b[p++],n=leb();assert.notEqual(id,8,'start section forbidden');assert(n<=b.length-p);p+=n;}
const mod=new WebAssembly.Module(b); // Future separately admitted full-module validation.
const imports=WebAssembly.Module.imports(mod),exportList=WebAssembly.Module.exports(mod);
const required=['eax','ebx','ecx','edx','esi','edi','ebp','esp','eip'].map(n=>'get_'+n).concat(['guest_read8','set_bp','set_trace_eip_range','set_null_diag','null_diag_field','null_diag_token','null_diag_root']);
for(const name of required)assert(exportList.some(e=>e.name===name&&e.kind==='function'),name);
assert(imports.some(e=>e.module==='host'&&e.name==='log_eip'&&e.kind==='function'));
assert(imports.some(e=>e.module==='host'&&e.name==='memory'&&e.kind==='memory'));
const layout=WebAssembly.Module.customSections(mod,'wine-region-layout');assert.equal(layout.length,1,'one canonical layout hash required');
console.log(JSON.stringify({file,sha256:sha,bytes:b.length,noStart:true,imports,exports:exportList,customLayoutSections:layout.map(x=>x.byteLength),instantiated:false},null,2));
// Signatures/import equality/custom section names must additionally match the
// source/compiler ABI inventories; import/export names alone do not prove it.
