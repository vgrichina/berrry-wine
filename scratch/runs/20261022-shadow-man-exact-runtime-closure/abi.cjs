'use strict';
// Parse and link the retained module. Never load a PE or call guest exports.
const fs = require('fs'), assert = require('assert'), crypto = require('crypto');
const path = require('path'), vm = require('vm');
const R = path.resolve(__dirname, '../../..');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const bytes = fs.readFileSync(R+'/build/wine-assembly.wasm');
assert.equal(bytes.length,1878971);
assert.equal(sha(bytes),'f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7');
let pos=8;
const u = () => { let n=0,s=0,b; do {b=bytes[pos++];n+=(b&127)*2**s;s+=7;} while(b&128);return n; };
const str = () => {const n=u(),s=bytes.subarray(pos,pos+n).toString();pos+=n;return s;};
const val = () => ({127:'i32',126:'i64',125:'f32',124:'f64',123:'v128',112:'funcref',111:'externref'})[bytes[pos++]];
const vector = f => Array.from({length:u()},f);
const limits = () => {const flags=u(),min=u(),max=(flags&1)?u():null;return {flags,min,max,shared:!!(flags&2)};};
const types=[], imports=[], functions=[], wasmExports=[], sections=[];
let hasStart=false;
while(pos<bytes.length){
  const id=bytes[pos++],length=u(),end=pos+length;sections.push({id,length});
  if(id===1)vector(()=>{assert.equal(bytes[pos++],0x60);types.push({params:vector(val),results:vector(val)});});
  if(id===2)vector(()=>{const module=str(),name=str(),kind=bytes[pos++];
    if(kind===0){const type=u();imports.push({module,name,kind:'function',type,signature:types[type]});functions.push(type);}
    else if(kind===2)imports.push({module,name,kind:'memory',limits:limits()});
    else throw Error('unexpected import kind '+kind);
  });
  if(id===3)functions.push(...vector(u));
  if(id===7)vector(()=>{const name=str(),kind=bytes[pos++],index=u();wasmExports.push({name,kind,index,...(kind===0?{signature:types[functions[index]]}:{})});});
  if(id===8)hasStart=true;
  pos=end;
}
assert.equal(hasStart,false,'instantiation must not execute a start function');
const sigs=require(R+'/lib/host-import-sigs.generated.json');
assert.equal(imports.filter(x=>x.kind==='function').length,sigs.count);
for(const x of imports.filter(x=>x.kind==='function'))assert.deepEqual(x.signature,sigs.sigs[x.name],x.name);
const memoryImport=imports.find(x=>x.kind==='memory');
assert.deepEqual(memoryImport.limits,{flags:3,min:8192,max:32768,shared:true});
const mod=new WebAssembly.Module(bytes);
const RegionMap=require(R+'/lib/region-map.generated');
const stamp=new TextDecoder().decode(WebAssembly.Module.customSections(mod,'wine-region-layout')[0]);
assert.equal(stamp,RegionMap.LAYOUT_HASH);
// Run the exact runner mismatch branch, with its exit boundary substituted.
const runner=fs.readFileSync(R+'/test/run.js','utf8');
const gate=runner.slice(runner.indexOf('    const { SECTION_NAME } ='),runner.indexOf('\n  const instance = await WebAssembly.instantiate'));
const gateBody=gate.slice(0,gate.lastIndexOf('\n  }'));
const regionGate=hash=>vm.runInNewContext(gateBody,{require:n=>require(R+'/tools/region-layout-hash'),WebAssembly,wasmModule:mod,TextDecoder,RegionMap:{LAYOUT_HASH:hash},WASM_PATH:'sealed.wasm',console:{error(){}},process:{env:{},exit:n=>{throw Error('exit '+n);}}});
regionGate(stamp);assert.throws(()=>regionGate('incorrect-map-control'),/exit 2/);
const {createHostImports}=require(R+'/lib/host-imports');
const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
const ctx={getMemory:()=>memory.buffer,logs:[]};
const host=createHostImports(ctx).host;host.memory=memory;
for(const x of imports.filter(x=>x.kind==='function'))assert.equal(typeof host[x.name],'function',x.name);
const instance=new WebAssembly.Instance(mod,{host});
const missing={...host};delete missing.shell_execute;
assert.throws(()=>new WebAssembly.Instance(mod,{host:missing}),WebAssembly.LinkError);
const wrongMemory={...host,memory:new WebAssembly.Memory({initial:1,maximum:1,shared:true})};
assert.throws(()=>new WebAssembly.Instance(mod,{host:wrongMemory}),WebAssembly.LinkError);
for(const [name,params,results] of [
  ['set_startup_show',['i32'],[]],['set_api_log',['i32'],[]],
  ['run',['i32'],[]],['get_image_base',[],['i32']],
])assert.deepEqual(wasmExports.find(x=>x.name===name).signature,{params,results},name);
assert.equal(typeof instance.exports.load_pe,'function');
const exportNames=new Set(wasmExports.map(x=>x.name));
const exportReferences={};
for(const [file,pattern] of [['test/run.js',/\binstance\.exports\.([A-Za-z0-9_]+)/g],['host.js',/\binstance\.exports\.([A-Za-z0-9_]+)/g],['lib/process-boot.js',/\bexports\.([A-Za-z0-9_]+)/g]]){
  const text=fs.readFileSync(R+'/'+file,'utf8'),names=[...new Set([...text.matchAll(pattern)].map(x=>x[1]))];
  const missing=names.filter(n=>!exportNames.has(n));
  assert.deepEqual(missing.sort(),file==='test/run.js'?['get_guest_page_stat','reset_guest_page_stats']:[]);
  exportReferences[file]={references:names.length,missing};
}
assert(sourceHasStatsGate());
function sourceHasStatsGate(){return runner.includes('if (GUEST_PAGE_STATS) {\n    if (!instance.exports.reset_guest_page_stats || !instance.exports.get_guest_page_stat)');}
// Exercise the exact JS helper against a recording boundary, without running WAT.
const boot=require(R+'/lib/process-boot'),calls=[];
for(const n of [0,1,5,11]){boot.applyStartupShow({set_startup_show:x=>calls.push(x)},n);assert.deepEqual(boot.startupShowArgs(n),['--startup-show='+n]);}
for(const n of [undefined,null,-1])boot.applyStartupShow({set_startup_show(){throw Error('absent');}},n);
assert.deepEqual(calls,[0,1,5,11]);assert.throws(()=>boot.startupShowArgs(10),RangeError);
const out={verdict:'PASS_BINARY_ABI_LINK_ONLY',node:process.version,moduleSha256:sha(bytes),bytes:bytes.length,
  hasStart,imports,exports:wasmExports,sections,regionStamp:stamp,hostFunctionCount:Object.keys(host).length,exportReferences,
  controls:['missing shell_execute -> LinkError','undersized memory -> LinkError','wrong region -> exact runner exit 2','SW_SHOWDEFAULT startup -> RangeError'],
  guestExportsCalled:0,PEsLoaded:0,guestSemanticsQualified:false};
fs.writeFileSync(__dirname+'/abi.json',JSON.stringify(out,null,2)+'\n');
console.log('PASS retained binary: 290 typed functions + shared memory, 2221 exports, stamped region, authentic candidate host link, startup-show helper and 4 rejects; no guest execution');
