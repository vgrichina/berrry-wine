'use strict';
// Independent source extraction. No whole runner, initializer, module or guest.
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),assert=require('assert/strict');
const {createRequire}=require('module');
const root=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(root,'test/run.js'),'utf8');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
assert.equal(hash(source),'f96e9bb924700ee571e2904e097f80742ff55638399898ae1dc32454af05b02d');
assert.equal(hash(fs.readFileSync(path.join(root,'lib/morrowind-name-observer.js'))),'a2bbe6d15de3fc46d65f6e72e365e82cd223b5db5486dc3cdbc585aad9d75799');
assert.equal(fs.statSync(process.argv[2]).size,3907584);
assert.equal(hash(fs.readFileSync(process.argv[2])),'f48300e194c6917cd98d235d259ebc3ab5d7c2071e9b41d798b996a8ce4d0676');
const boundaries={};
function extract(name,start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a,name);const text=source.slice(a,b);boundaries[name]={startByte:a,endByte:b,startLine:source.slice(0,a).split('\n').length,sha256:hash(text),transformation:'contiguous unchanged source slice'};return text;}
const parser=extract('parser','const getArg = (name, def) => {','// Was `--name=...`');
const flags=extract('trace-flags','const TRACE_API_RAW =','const TRACE_MOUSE_STATE =');
const state=extract('trace-state','  let traceApiOn =','\n  // The WAT counter');
const dedup=extract('dedup-state','  let dedupLast =','\n  let inputEvent =');
const arbitration=extract('arbitration','  const apiLogRequired =','\n  h.log = ');
const control=extract('control',"    if (cmd.action === 'trace-api') {","    if (cmd.action === 'eval')");
const worker=extract('worker-factory','    const workerExports = () => {','    // The API logger drops every value');
extract('main-api-hooks','  h.log = (ptr, len) => {','  let prevBlockEsp');
extract('main-exit-hook',"  if (ESP_DELTA || TRACE_API || TRACE_CRITICAL || hasFlag('observe-morrowind-name'))",'  // --- Override exit to also log ---');
const reset='if (apiLogOff && instance.exports.set_api_log) instance.exports.set_api_log(0);';
const resetIndices=[...source.matchAll(/if \(apiLogOff && instance.exports.set_api_log\) instance.exports.set_api_log\(0\);/g)].map(m=>m.index);
assert.equal(resetIndices.length,2);
boundaries.resets=resetIndices.map(startByte=>({startByte,endByte:startByte+reset.length,sha256:hash(reset)}));
const inherited=extract('inherited-reset',"  if (apiLogOff) inheritWasm('set_api_log', 0);",'\n');
const probePath=path.join(root,'tools/probes/morrowind-name-observer-contracts.js');
const probe=fs.readFileSync(probePath,'utf8');
assert.equal(hash(probe),'09a9a3254dc35a050f8d5e28f7d00d90295cb53e6e311477d03e0407ef0358e6');
const prefix=probe.slice(0,probe.indexOf('// First behavioral group:'));
// Only scaffolding is transformed: inject production startup before import,
// the first reset before attachment, and expose the synthetic VM context.
const scaffold=prefix.replace("  for (const marker of ['IMPORT', 'ATTACH']) {","  configure(context);\n  for (const marker of ['IMPORT', 'ATTACH']) {\n    if (marker === 'ATTACH') earlyReset(context);")
 .replace('observer: context.morrowindNameObserver }','context, observer: context.morrowindNameObserver }');
assert.notEqual(scaffold,prefix);
boundaries.scaffold={prefixSHA256:hash(prefix),transformedSHA256:hash(scaffold),transformations:['configure before IMPORT','first reset before ATTACH','expose context']};
for(const marker of ['IMPORT','ATTACH'])extract(marker,'// MORROWIND_NAME_'+marker+'_BEGIN','// MORROWIND_NAME_'+marker+'_END');
const evaluate=(s,c)=>vm.runInNewContext(s,c,{timeout:1000});
let configure;
const sandbox={require:createRequire(probePath),__dirname:path.dirname(probePath),process:{argv:['node',probePath,process.argv[2]]},Buffer,console,configure:c=>configure(c),earlyReset:c=>{evaluate(reset,c);evaluate(inherited,c);}};
vm.runInNewContext(scaffold+'\nglobalThis.fixture=fixture',sandbox,{timeout:5000});
function make(argv,mutate=false,consumers={},options={}){
 const writes=[],inheritedWrites=[],workerWrites=[];
 configure=c=>{
  Object.assign(c,evaluate(parser+'\n'+flags+'\n({hasFlag,TRACE_API,TRACE_API_PAUSED,TRACE_API_FILTER,TRACE_API_DEDUP,TRACE_API_COUNTS})',{args:argv}));
  Object.assign(c,{QUIET_API:c.hasFlag('quiet-api'),ESP_AUDIT:false,apiLogOff:false,apiWatSeen:0,tickState:{batch:0},threadManager:{threads:new Map([[1,{instance:{exports:{set_api_log:n=>workerWrites.push(n)}}}]])},inheritWasm:(...x)=>inheritedWrites.push(x),apiByName:new Map(),readStr:()=>'',hex:n=>'0x'+(n>>>0).toString(16),fmtApiCall:()=> 'ExampleApi()',fmtApiRet:()=>'',fmtApiOutParams:()=>'',STRING_APIS:[],TRACE_DX:false,TRACE_STACK:false,TRACE_SEH:false,lastApiTraced:false,lastApiEntry:null,lastApiArgs:null,lastTreeItemTrace:null,pendingSyncBail:null,pendingCodeRetire:null,pendingCodeWrite:null,pendingCodeMiss:null,pendingFpu:null,pendingWin16:null},consumers);
  const orig=c.instance.exports.set_api_log;c.instance.exports.set_api_log=n=>{writes.push(n);orig(n);};
  c.onFailure=()=>{};
  c.instance.exports.get_api_calls=()=>c.watCalls||0;
  evaluate(state,c);evaluate(dedup,c);evaluate(arbitration,c);
 };
 const f=sandbox.fixture(undefined,options);const c=f.context;evaluate(reset,c);
 const pause=on=>{c.cmd={action:'trace-api',on};return evaluate('(function(){'+(mutate?control.replace('!!apiLogRequired(on)','on'):control)+'})()',c);};
 return {f,c,pause,writes,inheritedWrites,workerWrites};
}
const exact=['--quiet-api','--observe-morrowind-name','--trace-api','--trace-api-paused'];
// FIRST candidate behavior is the earliest counterexample sequence, on exact
// candidate fragments. The unchanged predecessor file failed its old pin first.
const first=make(exact);assert(first.f.observer);assert.deepEqual(first.writes,[1]);first.pause(false);
assert.deepEqual(first.writes,[1,1]);assert.equal(first.f.e.apiLog,1);assert.equal(first.c.apiLogOff,false);
assert.deepEqual(first.workerWrites,[1]);assert.deepEqual(first.inheritedWrites,[['set_api_log',1]]);
const earliest={argv:exact,control:{action:'trace-api',on:false},writes:first.writes,observerInstalled:!!first.f.observer,apiLog:first.f.e.apiLog,apiLogOff:first.c.apiLogOff};
// Reject a mutation of the REAL changed control boundary.
const mutant=make(exact,true);mutant.pause(false);assert.equal(mutant.f.e.apiLog,0);assert.throws(()=>assert.equal(mutant.f.e.apiLog,1));
const mutation={boundary:'control',replacement:['!!apiLogRequired(on)','on'],writes:mutant.writes,rejected:true};
const libs=require('../../lib/worker-imports');
const cases=[];function check(name,fn){fn();cases.push(name);}
function mainEntry(g,name='ExampleApi'){
 const c=g.c;g.f.u32(g.f.r.esp,0x406926);c.apiTable[0].name=name;
 new Uint8Array(c.memory.buffer).set(Buffer.from('<ord>\0'));c.h.log_i32(0xc0de0000);c.h.log(0,5);
}
function workerHooks(g){
 const c=g.c;Object.assign(c,libs,{wh:{},tid:2});evaluate(worker,c);
 return {entry(name='ExampleApi'){new Uint8Array(c.memory.buffer).set(Buffer.from(name+'\0'));c.wh.log(0,name.length);},exit(n=7){c.wh.log_i32(n);}};
}
function detail(g){return Array.from(g.c.logs).filter(x=>!x.startsWith('[trace-api]')&&!x.startsWith('[morrowind-name]'));}
check('earliest sequence and rejecting real-boundary mutation',()=>assert.equal(mutation.rejected,true));
// Each source group below is independent of the donor's 34 claimed cases.
for(const quiet of [false,true])for(const observer of [false,true])for(const tracing of [false,true]){
 const argv=[...(quiet?['--quiet-api']:[]),...(observer?['--observe-morrowind-name']:[]),...(tracing?['--trace-api=ExampleApi','--trace-api-paused']:[])];
 check('parse/startup/late reset/control '+JSON.stringify(argv),()=>{
  const g=make(argv);assert.equal(!!g.f.observer,observer);assert.equal(g.c.apiLogOff,quiet&&!observer);
  if(!observer){assert.equal(g.f.records.length,0);assert.equal(g.f.reads.length,0);}
  if(tracing){for(const on of [false,true,false,true,false]){g.pause(on);assert.equal(g.c.apiLogOff,quiet&&!observer&&!on);assert.equal(g.writes.at(-1),g.c.apiLogOff?0:1);assert.equal(g.workerWrites.at(-1),g.writes.at(-1));assert.equal(g.inheritedWrites.at(-1)[1],g.writes.at(-1));}}
  else{assert.throws(()=>g.pause(false),/trace-api needs/);}
 });
}
check('main and complete Worker factory default policy',()=>{
 const g=make([]);mainEntry(g);g.c.h.log_api_exit?.();assert(detail(g).includes('[API] ExampleApi'));
 const w=workerHooks(g);g.c.logs.length=0;w.entry();w.exit();assert.deepEqual(detail(g),[]);
 assert.equal(libs.workerApiShouldLog({traceApi:false,quietApi:false,filter:null},'ExampleApi'),false);
});
check('main actual detailed entry/exit/memory and marker while observer is armed',()=>{
 const g=make(exact,false,{TRACE_API_MEM:[{name:'ExampleApi',arg:0,len:0}]});g.c.logs.length=0;
 mainEntry(g);g.c.h.log_i32(123);g.c.h.log_api_exit();assert.deepEqual(detail(g),[]);
 g.pause(true);g.c.logs.length=0;mainEntry(g);g.c.h.log_api_exit();
 assert(detail(g).some(x=>x.startsWith('[API #')));assert(detail(g).some(x=>x.includes('raw EAX')));assert(detail(g).some(x=>x.startsWith('[api-mem]')));
 g.pause(false);g.c.logs.length=0;mainEntry(g);g.c.h.log_i32(123);g.c.h.log_api_exit();assert.deepEqual(detail(g),[]);assert.equal(g.f.e.apiLog,1);
});
check('pause between main entry/exit drops pending detail',()=>{
 const g=make(exact);g.pause(true);mainEntry(g);g.pause(false);g.c.logs.length=0;g.c.h.log_api_exit();assert.deepEqual(detail(g),[]);
});
check('actual observer entry/exit survives pause without repeating correlation groups',()=>{
 const g=make(exact);g.pause(false);g.c.logs.length=0;g.f.builder();g.f.poll();
 assert(g.f.records.some(x=>x.kind==='poll-entry'));assert(g.f.records.some(x=>x.kind==='poll-completion'&&x.actualHook==='log_api_exit'));assert.equal(g.f.e.apiLog,1);assert.deepEqual(detail(g),[]);
});
for(const quiet of [false,true])check('complete Worker factory filtered detail across pause/resume quiet='+quiet,()=>{
 const g=make([...(quiet?['--quiet-api']:[]),'--trace-api=ExampleApi','--trace-api-paused']);const w=workerHooks(g);
 g.c.logs.length=0;w.entry();w.exit();assert.deepEqual(detail(g),[]);
 g.pause(true);g.c.logs.length=0;w.entry('OtherApi');w.exit();assert.deepEqual(detail(g),[]);
 w.entry();w.exit();assert(detail(g).some(x=>x.startsWith('[API T2]')));assert(detail(g).some(x=>x.includes('=>')));
 w.entry();g.pause(false);g.c.logs.length=0;w.exit();w.entry();assert.deepEqual(detail(g),[]);
 g.pause(true);g.c.logs.length=0;w.entry();assert.equal(detail(g).length,1);
});
for(const consumers of [{TRACE_API_COUNTS:true},{TRACE_CRITICAL:true},{TRACE_INPUT_DISPATCH:true},{ESP_DELTA:true},{ESP_AUDIT:true},{breakApis:['unused']}])check('required consumer '+JSON.stringify(consumers),()=>{
 const g=make(['--quiet-api','--trace-api','--trace-api-paused'],false,consumers);assert.equal(g.c.apiLogOff,false);
 for(const on of [false,true,false])g.pause(on);assert.deepEqual(g.writes,[1,1,1]);assert.deepEqual(g.workerWrites,[1,1,1]);
});
check('memory-only legacy and coupled memory tracing',()=>{
 const mem={TRACE_API_MEM:[{name:'ExampleApi',arg:0,len:0}]};assert.equal(make(['--quiet-api'],false,mem).c.apiLogOff,false);
 const g=make(['--quiet-api','--trace-api','--trace-api-paused'],false,mem);assert.equal(g.c.apiLogOff,true);g.pause(true);assert.equal(g.c.apiLogOff,false);g.pause(false);assert.equal(g.c.apiLogOff,true);
});
check('disabled observer and failed installs cannot produce accepted observer',()=>{
 assert.equal(make(['--quiet-api']).f.observer,null);
 assert.throws(()=>make(exact,false,{}, {corruptLoaded:true}),/loaded code/);
 assert.throws(()=>make(exact,false,{}, {trace:[1,2]}),/conflicts/);
});
check('counter folding independent of detail toggles with required observer',()=>{
 const g=make(exact);g.c.watCalls=19;g.pause(false);g.pause(true);g.pause(false);assert.equal(g.c.apiCount,0);
 const h=make(['--quiet-api','--trace-api','--trace-api-paused']);h.c.watCalls=19;h.pause(true);assert.equal(h.c.apiCount,19);h.pause(true);assert.equal(h.c.apiCount,19);
});
// Census of every production shared-logger setter. Identity and source ordering
// are recorded, not represented as execution of intervening runner/initializers.
const setters=source.split('\n').flatMap((line,i)=>line.includes('set_api_log')?[{line:i+1,source:line.trim()}]:[]);
assert.equal(setters.length,5);
const order={import:source.indexOf('// MORROWIND_NAME_IMPORT_BEGIN'),instantiate:source.indexOf('const instance = await WebAssembly.instantiate'),attachEnd:source.indexOf('// MORROWIND_NAME_ATTACH_END'),dllInitializer:source.indexOf('callDllMain(ex,'),lateReset:resetIndices[1]};
assert(order.import<order.instantiate);assert(order.attachEnd<order.dllInitializer);assert(order.dllInitializer<order.lateReset);
const report={verdict:'ACCEPTED_SOURCE_BOUNDARY_ONLY',candidate:'1b5c93b2cb998094034cdce7f3eda497cf3c9006',runnerSHA256:hash(source),earliest,mutation,cases,boundaries,setters,order,firstMissingAcceptanceEvidence:'Actual whole-runner and initializer execution with the exact module and game: source slicing/synthetic guest state cannot establish this. Successful source acceptance permits a later separately authorized full-runner acceptance only.',scope:'Actual production parser, trace flags/state, arbitration, import/observer attach, two reset statements, inherited reset, control, main API hooks and entire Worker logger factory executed in synthetic memory/exports. Source ordering only for initializers; no initializer, whole runner, module, game, browser, build or Boat execution. Unchanged 49 correlation groups reused, not repeated.',historicalResourceIncidents:'Preserved by reference to repair and predecessor receipts; this verdict promotes no operation/resource or gameplay qualification.'};
fs.writeFileSync(path.join(__dirname,'results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
