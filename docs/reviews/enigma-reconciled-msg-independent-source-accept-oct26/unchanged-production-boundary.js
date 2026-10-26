'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(process.argv[3]), out=process.argv[2];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const pin='55be42cbcaedee9d7f56f578cd7d36841bba86861b38bf5d61a7a0415a880c2e';
const runner=fs.readFileSync(path.join(root,'test/run.js'),'utf8');assert.equal(sha(runner),pin);
const productionRequire=require('module').createRequire(path.join(root,'test/run.js'));
const {createMessageBoundaryTrace}=productionRequire('./message-boundary-trace');
function range(s,a,b){let x=s.indexOf(a),y=s.indexOf(b,x);assert(x>=0&&y>x,a);return {start:x,end:y,text:s.slice(x,y)};}
const installation=range(runner,'  // BEGIN message-boundary installation:','  // END message-boundary installation');
const imports=range(runner,'  const imports = { host: h };','  const instance = await WebAssembly.instantiate');
const qualification=range(runner,'  ctx.exports = instance.exports;','  // Quiet runs silence');
const pe=runner.indexOf('  const { entry } = stageAndLoadPe('), win16=runner.indexOf('  loadWin16Dlls(instance.exports,'),dll=runner.indexOf('    const dllResults = loadDlls(instance.exports,');
assert(installation.end<imports.start&&imports.start<qualification.start&&qualification.end<pe&&pe<win16&&win16<dll);
// Actual entry statement through its literal semicolon, not an invented fixture initializer.
const peCall=range(runner,'  const { entry } = stageAndLoadPe(','  applyVirtualAllocTop(');
const excerpts={installation,qualification,peCall};
let count=0;const receipts=[];
function contract({text=installation.text,qualify=qualification.text,on=true,module=true,order='normal'}={}){
 const logs=[],h={log_api_exit(){return 'original';}},ctx={},memory={buffer:new ArrayBuffer(1024)};let enabled=0,loaded=0;
 const exports={get_image_base:()=>0};if(module)exports.set_message_completion=n=>enabled=n;
 const instance={exports};
 const loader=(ex,buf,bytes,log)=>{loaded++;assert.equal(ex,exports);assert.equal(buf,memory.buffer);
  if(on&&module){assert.equal(enabled,1,'installation must precede earliest real loader');assert.equal(typeof h.message_begin,'function');}
  return {entry:1};};
 const body='const tickState={batch:0};\n'+text+'\n'+(order==='late'?peCall.text:'')+'\n'+qualify+'\n'+(order==='late'?'':peCall.text)+'\nreturn {trace:messageBoundaryTrace,owner:messageCompletionOwner};';
 const result=new Function('require','createMessageBoundaryTrace','TRACE_MESSAGE_BOUNDARY','logs','memory','instance','translateGuest','h','ctx','stageAndLoadPe','exeBytes',body)(productionRequire,createMessageBoundaryTrace,on,logs,memory,instance,x=>x,h,ctx,loader,new Uint8Array(0));
 assert.equal(loaded,1);assert.equal(enabled,on&&module?1:0);
 assert.equal(result.trace.status().canonicalRuntimeQualified,false);
 if(on&&module){assert.equal(h.message_begin(1,1,100,200,0,0,0,0),0,'boot paused does not spend ownership');result.trace.arm(true);
 const t=h.message_begin(1,1,100,200,0,0,0,0);assert(t>0,'actual main import wire');h.message_complete(t,1);
 assert.equal(logs.filter(x=>x.includes('"kind":"message-completion"')).length,1,'real observer wire');}
 else {result.trace.arm(true);h.message_complete(h.message_begin(1,1,100,200,0,0,0,0),1);assert.equal(logs.filter(x=>x.includes('"kind":"message-completion"')).length,0);}
 count++;return result;
}
contract();contract({on:false});contract({module:false});
for(const [name,config] of [
 ['actual-import-installation',{text:installation.text.replace('  Object.assign(h, messageCompletionOwner.imports);','')}],
 ['actual-setter',{qualify:qualification.text.replace('    instance.exports.set_message_completion(1);','')}],
 ['actual-observer-qualification',{qualify:qualification.text.replace('    messageBoundaryTrace.qualifyCompletion();','')}],
 ['setter-after-earliest-loader',{order:'late'}],
]){assert.throws(()=>contract(config),assert.AssertionError,name);receipts.push({name,rejected:true});}
// These paths are checked in the whole runner; compiled execution stays unknown.
assert(!runner.includes("inheritWasm('set_message_completion'"));
assert(!runner.slice(0,installation.start).includes('WebAssembly.instantiate('));
const manifest=Object.fromEntries(Object.entries(excerpts).map(([n,x])=>[n,{start:x.start,end:x.end,bytes:Buffer.byteLength(x.text),sha256:sha(x.text)}]));
fs.writeFileSync(path.join(out,'production-boundary-result.json'),JSON.stringify({candidate:'e8bceb042bc3eff6bab73642988be29a7522287e',runnerSHA256:pin,pass:true,cases:count,omissions:receipts,excerpts:manifest,actualSourceOrder:{installation:installation.start,imports:imports.start,qualification:qualification.start,stageAndLoadPe:pe,loadWin16Dlls:win16,loadDlls:dll},compiled:false,canonicalRuntimeQualified:false,qualification:'Exact runner statements with host loader substitute; no real initializer/guest executed'},null,2));
console.log('PASS actual production source entry contract; 3 modes +4 independently rejecting omissions/order controls; uncompiled');
