'use strict';
// Execute from this isolated repository; needs candidate, parent and review objects.
// node docs/reviews/shell-env-repair-acceptance-20261020.js OUTPUT_DIRECTORY
const fs=require('fs'),cp=require('child_process'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto'),path=require('path');
const fixed='ea6f896e8099fc8072009fbf0014b52fa06bbedd',parent='e295f11287fde0ce2efa0d0da9491933481fc81f',review='96360e91d971aca8940f8199b2623dee8ceb8858';
const out=process.argv[2]; assert(out);
const git=(...args)=>cp.execFileSync('git',args,{encoding:'utf8',maxBuffer:16*1024**2});
const src=(rev,p)=>git('show',`${rev}:${p}`),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const capacity=[];
function gate(){const s=fs.statfsSync(out),available=s.bavail*s.bsize;capacity.push({available,required:2277507072});assert(available>=2277507072,'CAPACITY STOP; no cleanup/retry');}
gate();
assert.equal(git('rev-parse',fixed+'^').trim(),parent);
const patch=git('diff',parent,fixed,'--','src/10-helpers.wat');
assert.equal(patch.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).length,4);
assert.equal(patch.split('\n').filter(l=>l.startsWith('-')&&!l.startsWith('---')).length,0);
assert.equal(git('diff','--name-only',parent,fixed,'--','src').trim(),'src/10-helpers.wat');
const helper=src(fixed,'docs/reviews/shell-env-empty-token-fix-20261020.js');
const oldReview=src(review,'docs/reviews/shell-ex-corrected-independent-review-20261020.js');
// Exact options and literal oracle are copied unchanged from the earlier independent review.
const start='  const options={wide,mask:0x200|(tracked?0x40:0),file:directory?';
function oracle(s){const i=s.indexOf(start);assert(i>=0);const end=s.indexOf('\n',s.indexOf('  const expected=',i));return s.slice(i,end);}
assert.equal(oracle(helper),oracle(oldReview));
// Redirect only the submitted helper's local source read to the immutable reviewed object.
// Both its outer module and nested replay receive this same fs adapter.
const readfs=Object.create(fs);readfs.readFileSync=(p,...args)=>p==='src/10-helpers.wat'?src(fixed,p):fs.readFileSync(p,...args);
const req=n=>n==='fs'?readfs:require(n);
const context={require:req,process:{argv:['node','replay'],cwd:()=>process.cwd()},console:{log(){}},Buffer,WebAssembly,TextEncoder,TextDecoder,setTimeout,clearTimeout,setImmediate};
vm.createContext(context);
vm.runInContext(helper+'\nglobalThis.api={results,a,sharedFixture,sharedModule,shared,compile,invoke,compiled,original};',context);
const api=context.api, replay=JSON.parse(JSON.stringify(api.results));
assert.equal(replay.checks.length,177);assert.equal(replay.controls.length,13);
const defects=replay.observations.filter(x=>x.kind==='D1 repaired; exact parent rejects same oracle');assert.equal(defects.length,8);
for(const d of defects){assert.equal(d.actual,d.expected);assert.notEqual(d.oldActual,d.expected);assert(d.oldActual.includes('D:\\Drive'));}
const checks=[],controls=[];const check=(n,f)=>{f();checks.push(n);};
const parentShared=api.sharedModule(src(parent,'src/10-helpers.wat'));
// Independent narrow cases exercise the exact compiled shared function, not a JS lookup.
for(const wide of [0,1])for(const env of ['\0','=D:=Q:\\Other\0ROOT=z\0=C:=D:\\Drive\0','ROOT=z\0=C:=\0=D:=Q:\\Other\0']){
  check(`empty lookup preserves entire block wide=${wide} environment=${JSON.stringify(env)}`,()=>{
    const {e,bytes,put}=api.sharedFixture();bytes.fill(0,8192,9000);bytes.set(Buffer.from(env+'\0'),8192);put(1024,'',wide);
    const before=Buffer.from(bytes);assert.equal(e.env_find(1024,wide),0);assert.deepEqual(Buffer.from(bytes),before);
  });
}
for(const wide of [0,1])check(`multiple hidden entries exact names and prefixes wide=${wide}`,()=>{
  const {e,bytes,put,read}=api.sharedFixture();bytes.fill(0,8192,9000);bytes.set(Buffer.from('ROOT=z\0=D:=Q:\\Other\0=C:=\0\0'),8192);
  for(const [name,value]of [['=d:','Q:\\Other'],['=C:',''],['ROOT','z']]){put(1024,name,wide);assert(e.env_find(1024,wide)>0);assert.equal(e.env_get(1024,2048,64,wide),value.length);assert.equal(read(2048,wide),value);}
  for(const name of ['=','=C','=C:X','RO','ROOTX']){put(1024,name,wide);assert.equal(e.env_find(1024,wide),0);}
});
check('UTF16 first code unit with low byte zero is not an empty name',()=>{
  for(const code of [api.shared,parentShared]){const {e,put}=api.sharedFixture(code);put(1024,'\u0100',1);assert.equal(e.env_find(1024,1),0);}
});
for(const wide of [0,1])check(`empty query preserves lazy initialization wide=${wide}`,()=>{
  const {e,bytes,put,live}=api.sharedFixture();bytes.set(Buffer.from('=C:=D:\\Lazy\0ROOT=ready\0\0'),12000);e.env(0);put(1024,'',wide);
  assert.equal(e.env_find(1024,wide),0);assert.equal(live.size,1);put(1024,'ROOT',wide);assert(e.env_find(1024,wide)>0);assert.equal(live.size,1);
});
for(const wide of [0,1]){
  const {e,bytes,put}=api.sharedFixture(parentShared);bytes.fill(0,8192,9000);bytes.set(Buffer.from('ROOT=z\0=D:=Q:\\Other\0\0'),8192);put(1024,'',wide);
  assert.throws(()=>assert.equal(e.env_find(1024,wide),0));controls.push(`parent rejects empty query with hidden entry after ordinary entry wide=${wide}`);
}
const results={status:'ACCEPTED_FOUR_LINE_REPAIR',fixed,parent,review,sourceHash:sha(src(fixed,'src/10-helpers.wat')),patchHash:sha(patch),helperHash:sha(helper),oracleHash:sha(oracle(helper)),compiledHash:replay.compiledHash,sharedCompiledHash:replay.sharedCompiledHash,parentCompiledHash:replay.originalCompiledHash,parentSharedHash:parentShared.hash,checks,controls,replay,capacity};
gate();fs.writeFileSync(path.join(out,'tests.json'),JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify({status:results.status,checks:checks.length,controls:controls.length,replayedChecks:replay.checks.length,replayedControls:replay.controls.length,compiledHash:results.compiledHash,sharedCompiledHash:results.sharedCompiledHash}));
