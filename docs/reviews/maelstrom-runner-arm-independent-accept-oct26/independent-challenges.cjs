'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const path = require('node:path'), crypto = require('node:crypto'), {createRequire} = require('node:module');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const root = path.resolve(__dirname, '../../..');
const {transform} = require(root + '/tools/maelstrom-initialized-runner-arm.cjs');
const donor = '/tmp/maelstrom-mode-transition-observer-repair-oct26';
const original = fs.readFileSync(donor + '/ops/capture-run.js');
assert.equal(sha(original), '5b2596b3746e17427d26a50466ed36adcfec9f9f119755f05b1fa4bc3c79be58');
const generated = transform(original).output;
assert.equal(sha(generated), '2f10a91ed0d909094ad122c5fc6fc5856d79d449603bb74c7cdeca63cefa0e9a');
const source = generated.toString(), boundary = '  for (let batch = 0; batch < MAX_BATCHES && !stopped; batch++) {';
const setup = source.slice(source.indexOf('  let nativeAdapter;'), source.indexOf(boundary));
const fixturePath = donor + '/repo/test/test-maelstrom-mode-transition.cjs';
const fixtureSource = fs.readFileSync(fixturePath,'utf8');
assert.equal(sha(fixtureSource),'57758fa0a9b6d769fce63d873a2ebf7aca3fb62f18f1c7298d5e309054384491');
const prefix = fixtureSource.slice(0, fixtureSource.indexOf("test('authentic early-start ordering"));
const fc = {require:createRequire(fixturePath),__dirname:path.dirname(fixturePath),module:{exports:{}},Buffer,WebAssembly,console,process};
vm.runInNewContext(prefix + '\nmodule.exports={fresh,finish,createAdapter,createRunnerExperiments,pins};',fc,{timeout:30000});
const f = fc.module.exports;
function harness(failure) {
  const real=f.fresh(), events=[], rows=[];let starts=0,runs=0, armed=false;
  const fail = n => {if(failure===n)throw Error('challenge:'+n);};
  const realExports=real.exports;
  const target={...realExports,get_eax:()=>0,get_esp:()=>0,get_eip:()=>0,
    run:()=>{assert(armed);events.push('run');runs++;fail('run');},
    set_uop:n=>{events.push('mode:'+n);assert(!armed);fail('mode');realExports.set_uop(n);}};
  const exports=new Proxy(target,{get(t,n){if(n in t)return t[n];if(typeof n==='string'&&n.startsWith('set_'))return ()=>{assert(!armed);events.push(n);fail(n);};}});
  const instance={exports}, host={};
  for(const n of setup.match(/\b[A-Z][A-Z_0-9]+\b/g)||[])host[n]=false;
  Object.assign(host,{instance,memory:realExports.memory,moduleBases:{},Buffer,JSON,path,console:{log(){}},
    WATCH_VALUE:null,WATCH_START_BATCH:0,HANDLER_HIST_THREADS:[],hasFlag:()=>false,signalExitWake:null,
    ctx:{vfs:null},getArg:(n,d=null)=>d,nativeFile:'fixture',fs:{appendFileSync(){}},
    require:n=>{assert.equal(n,'../tools/disasm');return {disasmAt(){throw Error('unexpected disassembly');}};},
    nativeRaw:n=>events.push(n),deferredResolveAddrs:()=>{events.push('resolve');fail('resolve');},
    onFailure:()=>{events.push('failure-hook');fail('failure-hook');},
    performance:{now:()=>{events.push('clock');fail('clock');return 1;}},
    nativeDiagnostic:{verifyLoaded:()=>{events.push('verify');fail('verify');return{};},
      createAdapter:(i,o)=>{events.push('adapter');fail('adapter');const a=f.createAdapter(i,{...o,persist:r=>rows.push(r)});
        return {start:()=>{starts++;events.push('arm');fail('arm');a.start();armed=true;},
          observe:n=>{events.push('observe:'+n);return a.observe(n);}};}},
    experiments:f.createRunnerExperiments({hasFlag:()=>false,getArg:(n,d=null)=>d,env:{},log(){},appPolicy:()=>null}),
    apiLogOff:true,TRACE_CODE_WRITES:true,TRACE_CODE_WRITES_ALL:true});
  const context=vm.createContext(host);
  return {context,events,rows,exports:realExports,get starts(){return starts;},get runs(){return runs;},
    initialize:()=>vm.runInContext('(async()=>{'+setup+'\nreturn originalNativeObserve;})()',context,{timeout:2000})};
}
const results=[];
async function test(name,fn){await fn();results.push({name,pass:true});}
async function main(){
 await test('complete pinned setup: all initialization precedes sole arm',async()=>{
   const h=harness();await h.initialize();assert.equal(h.starts,1);assert.equal(h.runs,0);
   for(const n of ['verify','adapter','resolve','mode:1','set_code_write_trace','failure-hook','clock'])assert(h.events.indexOf(n)<h.events.indexOf('arm'),n);
   assert.equal(h.exports.mne_rejectReason(),0);
 });
 await test('late setup and arm failures prevent all main run sites',async()=>{
   for(const n of ['verify','adapter','resolve','mode','set_code_write_trace','failure-hook','clock','arm']){
     const h=harness(n);await assert.rejects(h.initialize(),new RegExp('challenge:'+n));assert.equal(h.runs,0);assert.equal(h.starts,n==='arm'?1:0);
   }
 });
 await test('altered/multiple/already-transformed inputs reject deterministically',()=>{
   const mutations=[Buffer.concat([original,original]),Buffer.from(original.toString().replace('nativeAdapter.start();','nativeAdapter.start(); nativeAdapter.start();')),generated,Buffer.from(original.toString().replace('loadDlls(instance.exports','skipDlls(instance.exports'))];
   for(const b of mutations)assert.throws(()=>transform(b),/SHA-256 mismatch/);
   assert(transform(original).output.equals(generated));
 });
 await test('helper/adapter/select completion bytes retained outside sole replacement',()=>{
   const r=transform(original).receipt.replacement;
   assert(generated.subarray(0,r.offset).equals(original.subarray(0,r.offset)));
   assert(generated.subarray(r.offset+r.afterBytes).equals(original.subarray(r.offset+r.beforeBytes)));
   assert.equal((source.match(/nativeAdapter\.start\(\);/g)||[]).length,1);
   assert.equal((source.match(/originalNativeObserve\(batch\);/g)||[]).length,3);
 });
 const sites=[source.match(/if \(!mainExecutionSuspended\(\)\) \{ instance\.exports\.run\(BATCH_SIZE\); originalNativeObserve\(batch\); \}/)[0],
   ...[...source.matchAll(/let originalNativeReturned=false;\n\s+try \{ instance\.exports\.run\(BATCH_SIZE\); originalNativeReturned=true; \} catch \(e\) \{[^}]*\}\n\s+if\(originalNativeReturned\) originalNativeObserve\(batch\);/g)].map(m=>m[0])];
 assert.equal(sites.length,3);
 for(let site=0;site<3;site++)await test('observation site '+site+': successful return, thrown run, rejected mode drift',async()=>{
   for(const mode of ['success','throw','drift']){
     const h=harness(mode==='throw'?'run':null), observe=await h.initialize();
     if(mode==='drift'){h.exports.fixture_enter();h.exports.set_uop(0);assert.equal(h.exports.mne_rejectReason(),15);}
     else f.finish(h.exports);
     Object.assign(h.context,{BATCH_SIZE:1,batch:site,mainExecutionSuspended:()=>false,originalNativeObserve:observe});
     const execute=()=>vm.runInContext('for(let once=0;once<1;once++){'+sites[site]+'}',h.context,{timeout:1000});
     if(mode==='drift')assert.throws(execute,/status rejection/);else if(mode==='throw'&&site===0)assert.throws(execute,/challenge:run/);else execute();
     assert.equal(h.starts,1);assert.equal(h.runs,1);
     const observations=h.events.filter(n=>n==='observe:'+site);
     assert.equal(observations.length,mode==='throw'?0:1);
     if(mode==='success'){assert.equal(h.rows.at(-1).kind,'captured');assert(h.events.indexOf('run')<h.events.indexOf('observe:'+site));}
   }
 });
 await test('first suspended run site performs neither run nor observation',async()=>{
   const h=harness(),observe=await h.initialize();Object.assign(h.context,{BATCH_SIZE:1,batch:0,mainExecutionSuspended:()=>true,originalNativeObserve:observe});
   vm.runInContext(sites[0],h.context);assert.equal(h.runs,0);assert(!h.events.includes('observe:0'));
 });
 const {reproduce}=require('./global-order-reproducer.cjs');
 await test('unchanged archived DLL ordering violates global contract even on later validation failure',()=>{
   for(const validationFails of [true,false]){const e=reproduce({validationFails});assert.equal(e[0].event,'dll-run');assert.equal(e[0].armed,false);}
 });
 const loaded=Object.keys(require.cache).filter(p=>p.startsWith(donor+'/repo/')).map(p=>({path:p,sha256:sha(fs.readFileSync(p)),bytes:fs.statSync(p).size}));
 console.log(JSON.stringify({candidate:'3fef8f026fffb4f47261097edd51e14cbd044964',pass:true,count:results.length,results,setupSHA256:sha(setup),setupBytes:Buffer.byteLength(setup),fixturePrefixSHA256:sha(prefix),runSiteHashes:sites.map(sha),loadedInputs:loaded,pins:f.pins,peakRSS:process.resourceUsage().maxRSS*1024,prior34Replayed:0,prior29Replayed:0,guestInstructionsExecuted:0,globalContractAccepted:false,postLoaderTransformAccepted:true}));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
