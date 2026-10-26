'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const H=path.resolve(__dirname,'..'),R=path.join(H,'repo');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
let src=fs.readFileSync('/tmp/maelstrom-head-yield-observer-oct24/ops/run.js','utf8');assert.equal(sha(src),'4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809');
function once(a,b){assert.equal(src.split(a).length,2,a);src=src.replace(a,b);}
const setup=`
  const nativeDiagnostic = require('../tools/maelstrom-original-errno-adapter.cjs');
  const nativeSpec = require('../tools/maelstrom-native-errno-latch.cjs');
  const nativeFile = getArg('original-native-record');
  function nativeRaw(stage, error) {
    const e=instance.exports;
    const scalars={};
    for(const prefix of ['mne_','msc_']) for(const key of Object.keys(e).filter(k=>k.startsWith(prefix))) {
      if(key==='mne_start'||key==='msc_start')continue;
      try { scalars[key]=e[key](); } catch(err) { scalars[key]={error:String(err)}; }
    }
    const spans=[{va:0x52e430,n:9},{va:0x40e125,n:11},{va:0x7a4010,n:4},
      ...Object.entries(nativeSpec.NET_ANCHORS).map(([va,hex])=>({va:nativeSpec.NET_LAYOUT.loadedBase+Number(va)-nativeSpec.NET_LAYOUT.preferredBase,n:hex.length/2})),
      ...Object.entries(moduleBases).filter(([name])=>name==='msvcrt').map(([name,b])=>({va:b.loadAddr+0xc430,n:9}))];
    const anchors=spans.map(({va,n})=>({va,bytes:Buffer.from(new Uint8Array(memory.buffer,va-0x400000+0x12000,n)).toString('hex')}));
    const row={schema:'original-native-raw/v1',stage,error:error?String(error):null,moduleBases:JSON.parse(JSON.stringify(moduleBases)),imageBase:e.get_image_base(),scalars,anchors,
      live:{eip:e.get_eip()>>>0,eax:e.get_eax()>>>0,esp:e.get_esp()>>>0}};
    fs.appendFileSync(nativeFile+'.raw.jsonl',JSON.stringify(row)+'\\n');return row;
  }
  let nativeAdapter;
  nativeRaw('loaded-before-validation');
  try {
    const verified=nativeDiagnostic.verifyLoaded(instance.exports,memory.buffer,moduleBases);
    fs.appendFileSync(nativeFile+'.raw.jsonl',JSON.stringify({stage:'loaded-verified',verified})+'\\n');
    nativeAdapter=nativeDiagnostic.createAdapter(instance,{
      persist:row=>fs.appendFileSync(nativeFile,JSON.stringify(row)+'\\n'),
      readLive:()=>({eax:instance.exports.get_eax()>>>0,esp:instance.exports.get_esp()>>>0,eip:instance.exports.get_eip()>>>0})});
    nativeAdapter.start();
  }catch(error){nativeRaw('first-loader-or-start-rejection',error);throw error;}
  function originalNativeObserve(batch){
    try {const row=nativeAdapter.observe(batch);if(row&&row.kind==='captured')nativeRaw('captured');}
    catch(error){nativeRaw('first-latch-rejection',error);throw error;}
  }
`;
once('  // Resolve any module-relative address specs now that all module bases are known.',setup+'\n  // Resolve any module-relative address specs now that all module bases are known.');
once('      if (!mainExecutionSuspended()) instance.exports.run(BATCH_SIZE);','      if (!mainExecutionSuspended()) { instance.exports.run(BATCH_SIZE); originalNativeObserve(batch); }');
for(const anchor of ['          try { instance.exports.run(BATCH_SIZE); } catch (e) { /* reported below */ }','          try { instance.exports.run(BATCH_SIZE); } catch (e) { break; }']){
 once(anchor,'          let originalNativeReturned=false;\n'+anchor.replace('instance.exports.run(BATCH_SIZE);','instance.exports.run(BATCH_SIZE); originalNativeReturned=true;')+'\n          if(originalNativeReturned) originalNativeObserve(batch);');
}
fs.mkdirSync(path.join(H,'runner/test'),{recursive:true});fs.writeFileSync(path.join(H,'runner/test/run.js'),src);
console.log(JSON.stringify({runnerSHA256:sha(src),bytes:src.length}));
