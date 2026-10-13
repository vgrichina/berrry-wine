#!/usr/bin/env node
'use strict';
// Preserve raw optimized code and full function maps for the P/A factorial.
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),assert=require('assert'),crypto=require('crypto');
const {extract,disassemble}=require('./wasm-native');
const [engine,wasmArg,namedArg,outArg]=process.argv.slice(2);
assert(['sm','v8','node'].includes(engine)&&outArg,'sm|v8|node WASM NAMED_WASM OUT');
const wasm=path.resolve(wasmArg),named=path.resolve(namedArg),out=path.resolve(outArg);
const wanted=['x87_island_fast','x87_island_fast_mixed','x87_island_generic','x87_island_generic_mixed','uop_fast'];
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const objdump=process.env.OBJDUMP||(process.platform==='darwin'?'/opt/homebrew/opt/binutils/bin/objdump':'/usr/bin/objdump');
function names(){
  const map=new Map();
  for(const raw of WebAssembly.Module.customSections(new WebAssembly.Module(fs.readFileSync(named)),'name')){
    const b=Buffer.from(raw);let p=0;
    const u=()=>{let n=0,s=0,v;do{v=b[p++];n|=(v&127)<<s;s+=7;}while(v&128);return n>>>0;};
    while(p<b.length){const kind=u(),size=u(),end=p+size;if(kind===1){const n=u();for(let i=0;i<n;i++){const id=u(),len=u();map.set(id,b.toString('utf8',p,p+len));p+=len;}}p=end;}
  }return map;
}
let all,selected;
if(engine==='v8'||engine==='node'){
  const helper=path.join(__dirname,'bench-mw3-mixed-native.js');
  const env={...process.env,OBJDUMP:objdump,NATIVE_FUNCS:wanted.join(',')};
  if(engine==='v8')cp.execFileSync(process.execPath,[helper,'capture-d8',wasm,named,out],{env,stdio:'inherit'});
  else {
    assert(!fs.existsSync(out),'fresh directory required');fs.mkdirSync(out,{recursive:true});
    const script=out+'/compile.cjs';fs.writeFileSync(script,`new WebAssembly.Module(require('fs').readFileSync(${JSON.stringify(wasm)}));`);
    const flags=['--perf-prof','--no-liftoff','--no-wasm-lazy-compilation'];
    cp.execFileSync(process.execPath,[...flags,script],{cwd:out,stdio:'inherit'});
    fs.writeFileSync(out+'/capture.json',JSON.stringify({engine:'Node '+process.version,v8:process.versions.v8,arch:process.arch,flags,wasmSha256:sha(wasm)},null,2));
  }
  cp.execFileSync(process.execPath,[helper,'decode',wasm,named,out],{env,stdio:'inherit'});
  all=JSON.parse(fs.readFileSync(out+'/all-functions.json'));selected=JSON.parse(fs.readFileSync(out+'/functions.json'));
}else{
  assert(!fs.existsSync(out),'fresh directory required');fs.mkdirSync(out,{recursive:true});
  const sm=process.env.SM||path.join(os.homedir(),'.jsvu/bin/sm');
  const version=cp.execFileSync(sm,['--version'],{encoding:'utf8'}).trim(),map=names();
  const bin=out+'/module.bin',segs=extract(sm,wasm,'ion',bin);
  all=segs.map(([index,start,end])=>({index,name:map.get(index),address:'0x'+start.toString(16),bytes:end-start}));
  selected=all.filter(r=>wanted.includes(r.name));assert.equal(selected.length,wanted.length);
  for(const r of selected)fs.writeFileSync(out+'/'+r.name+'.asm',disassemble(objdump,bin,Number(r.address),Number(r.address)+r.bytes));
  fs.writeFileSync(out+'/all-functions.json',JSON.stringify(all,null,2));
  fs.writeFileSync(out+'/functions.json',JSON.stringify(selected,null,2));
  fs.writeFileSync(out+'/capture.json',JSON.stringify({engine:version,arch:process.arch,tier:'ion',flags:['--wasm-compiler=ion'],wasmSha256:sha(wasm)},null,2));
}
// Direct call destinations remain in the original code address space.
for(const r of selected){
  const asm=fs.readFileSync(out+'/'+r.name+'.asm','utf8');let directCalls=0,resolvedCalls=0;
  const annotated=asm.split('\n').map(line=>{
    const m=/\b(?:bl|callq?)\s+(?:0x)?([a-f0-9]+)\b/.exec(line);if(!m)return line;
    directCalls++;const addr=parseInt(m[1],16),hit=all.find(f=>addr>=Number(f.address)&&addr<Number(f.address)+f.bytes);
    if(!hit)return line;resolvedCalls++;return line+' ; '+hit.name;
  }).join('\n');
  fs.writeFileSync(out+'/'+r.name+'.annotated.asm',annotated);
  r.directCalls=directCalls;r.resolvedCalls=resolvedCalls;
}
fs.writeFileSync(out+'/review.json',JSON.stringify({engine,wasmSha256:sha(wasm),namedSha256:sha(named),command:process.argv,functions:selected},null,2));
