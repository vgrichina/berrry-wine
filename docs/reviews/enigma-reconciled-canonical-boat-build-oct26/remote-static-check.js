'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert');
const H='/tmp/enigma-reconciled-canonical-boat-build-oct26',S=path.join(H,'source'),O=path.join(H,'ops');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const generated=JSON.parse(fs.readFileSync(path.join(S,'lib/host-import-sigs.generated.json')));
const mirror=require(path.join(O,'region-map.generated.js'));
const fingerprint=hash(Buffer.from(Object.values(mirror.REGIONS).map(r=>`${r.name}:${(r.base>>>0).toString(16).padStart(8,'0')}:${(r.size>>>0).toString(16).padStart(8,'0')}`).sort().join('\n')+'\n')).slice(0,16);
assert.equal(fingerprint,mirror.LAYOUT_HASH);assert.equal(fingerprint,'9a3bc9149d58209c');assert(mirror.REGIONS.DIRECT_WINDOW);
const changed=['message_begin','message_park','message_bind','message_resume','message_complete'];
class Reader {
 constructor(b){this.b=b;this.p=0;}
 byte(){assert(this.p<this.b.length);return this.b[this.p++];}
 u(){let n=0,s=0,b;do{b=this.byte();n+=(b&127)*2**s;s+=7;assert(s<=35);}while(b&128);return n;}
 str(){const n=this.u(),s=this.b.subarray(this.p,this.p+n).toString();this.p+=n;assert(this.p<=this.b.length);return s;}
 vec(fn){return Array.from({length:this.u()},()=>fn());}
}
const vt=x=>{const r={127:'i32',126:'i64',125:'f32',124:'f64',123:'v128',112:'funcref',111:'externref'}[x];assert(r,`valtype ${x}`);return r;};
function limits(r){const flags=r.u(),min=r.u(),max=flags&1?r.u():null;return {flags,min,max,shared:!!(flags&2)};}
function inspect(file){
 const b=fs.readFileSync(path.join(S,'build',file));assert.equal(b.subarray(0,8).toString('hex'),'0061736d01000000');
 assert(WebAssembly.validate(b));const mod=new WebAssembly.Module(b); // compile/validate only; never instantiate
 const r=new Reader(b);r.p=8;const sections=new Map(),custom=[];
 while(r.p<b.length){const id=r.byte(),n=r.u(),end=r.p+n;assert(end<=b.length);const q=new Reader(b.subarray(r.p,end));r.p=end;if(id===0){const name=q.str();custom.push({name,bytes:q.b.length-q.p,payload:q.b.subarray(q.p).toString()});}else{assert(!sections.has(id));sections.set(id,q);}}
 const tr=sections.get(1),types=tr.vec(()=>{assert.equal(tr.byte(),96);return {params:tr.vec(()=>vt(tr.byte())),results:tr.vec(()=>vt(tr.byte()))};});assert.equal(tr.p,tr.b.length);
 const ir=sections.get(2),imports=ir.vec(()=>{const module=ir.str(),name=ir.str(),kind=ir.byte();let descriptor;
  if(kind===0)descriptor={typeIndex:ir.u()};
  else if(kind===1)descriptor={element:vt(ir.byte()),...limits(ir)};
  else if(kind===2)descriptor=limits(ir);
  else if(kind===3)descriptor={type:vt(ir.byte()),mutable:ir.byte()};
  else throw Error(`unexpected import kind ${kind}`);
  return {module,name,kind,descriptor};});assert.equal(ir.p,ir.b.length);
 const funcs=imports.filter(x=>x.kind===0);assert.equal(funcs.length,295);assert.equal(generated.count,295);
 assert.deepEqual(funcs.map(x=>x.name),Object.keys(generated.sigs));
 for(const x of funcs){assert.equal(x.module,'host');x.signature=types[x.descriptor.typeIndex];assert.deepEqual(x.signature,generated.sigs[x.name],x.name);}
 const memories=imports.filter(x=>x.kind===2);assert.equal(memories.length,1);assert.equal(memories[0].module,'host');assert.equal(memories[0].name,'memory');assert.deepEqual(memories[0].descriptor,{flags:3,min:8192,max:32768,shared:true});
 const fr=sections.get(3),funcTypes=funcs.map(x=>x.descriptor.typeIndex).concat(fr.vec(()=>fr.u()));assert.equal(fr.p,fr.b.length);
 const er=sections.get(7),exports=er.vec(()=>{const name=er.str(),kind=er.byte(),index=er.u();return {name,kind,index,...(kind===0?{signature:types[funcTypes[index]]}:{})};});assert.equal(er.p,er.b.length);
 assert.deepEqual(WebAssembly.Module.imports(mod).map(x=>[x.module,x.name,x.kind]),imports.map(x=>[x.module,x.name,['function','table','memory','global'][x.kind]]));
 assert.deepEqual(WebAssembly.Module.exports(mod).map(x=>[x.name,x.kind]),exports.map(x=>[x.name,['function','table','memory','global'][x.kind]]));
 const manifest=JSON.parse(fs.readFileSync(path.join(H,'input-manifest.json')));const sourceNames=new Set();
 for(const p of Object.keys(manifest).filter(x=>x.startsWith('src/'))){const s=fs.readFileSync(path.join(S,p),'utf8').replace(/;;[^\n]*/g,'');for(const m of s.matchAll(/\(export\s+"([^"]+)"/g))sourceNames.add(m[1]);}
 assert.deepEqual([...sourceNames].sort(),exports.map(x=>x.name).sort(),'complete source export names');
 assert.deepEqual(exports.find(x=>x.name==='set_message_completion').signature,{params:['i32'],results:[]});
 const layout=custom.filter(x=>x.name==='wine-region-layout');assert.equal(layout.length,1);assert.equal(layout[0].payload,fingerprint);
 const normalized=exports.map(({name,kind,signature})=>({name,kind,...(signature?{signature}:{})}));
 const result={file,bytes:b.length,sha256:hash(b),validate:true,moduleCompiled:true,instantiated:false,imports:imports.length,functionImports:funcs.length,exports:exports.length,sourceExportNames:sourceNames.size,layoutHash:fingerprint,canonicalRegions:Object.keys(mirror.REGIONS).length,DIRECT_WINDOW:mirror.REGIONS.DIRECT_WINDOW,changedSignatures:Object.fromEntries(changed.map(n=>[n,funcs.find(x=>x.name===n).signature])),memory:memories[0],hasStartSection:sections.has(8),exportABI:normalized,importABI:imports};
 fs.writeFileSync(path.join(O,file+'.static.json'),JSON.stringify(result,null,2)+'\n');return result;
}
const tail=inspect('wine-assembly.wasm'),compat=inspect('wine-assembly.compat.wasm');assert.deepEqual(tail.exportABI,compat.exportABI);assert.deepEqual(tail.importABI,compat.importABI);
const summary={pass:true,candidate:'425755ee5ee9be0734c7aca187521100f5487674',backends:[tail,compat].map(({exportABI,importABI,...x})=>x),bothBackendABIEqual:true,all295Signatures:true,allFiveChangedSignatures:true,sourceExportNamesExact:true,layoutMirrorPinned:true,instantiated:false,guest:false};
fs.writeFileSync(path.join(O,'static-summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary));
