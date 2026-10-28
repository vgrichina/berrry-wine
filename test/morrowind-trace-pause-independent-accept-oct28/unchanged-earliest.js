'use strict';
// Independent source boundary only: no runner/module/guest execution.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const {createRequire}=require('module');
const root=path.resolve(__dirname,'../..'), runner=fs.readFileSync(path.join(root,'test/run.js'),'utf8');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
assert.equal(hash(runner),'d06dbc85f92e1e9e8516f726f848204256460dd2d2553a4abee8ea2fa08ed7de');
const probePath=path.join(root,'tools/probes/morrowind-name-observer-contracts.js'),probe=fs.readFileSync(probePath,'utf8');
assert.equal(hash(probe),'09a9a3254dc35a050f8d5e28f7d00d90295cb53e6e311477d03e0407ef0358e6');
const slice=(a,b)=>{const x=runner.indexOf(a),y=runner.indexOf(b,x);assert(x>=0&&y>x);return runner.slice(x,y);};
const parser=slice('const getArg = (name, def) => {','// Was `--name=...`');
const predicate=slice('  apiLogOff = QUIET_API &&','\n  h.log = ');
const reset='if (apiLogOff && instance.exports.set_api_log) instance.exports.set_api_log(0);';
const resetAt=runner.indexOf(reset,runner.indexOf('  experiments.applyMain(instance,'));
assert(resetAt>runner.indexOf('// MORROWIND_NAME_ATTACH_END'));
const traceControl=slice("    if (cmd.action === 'trace-api') {","    if (cmd.action === 'eval')");
const prefix=probe.slice(0,probe.indexOf('// First behavioral group:'));
const scaffold=prefix.replace("  for (const marker of ['IMPORT', 'ATTACH']) {","  configure(context);\n  for (const marker of ['IMPORT', 'ATTACH']) {")
 .replace('observer: context.morrowindNameObserver }','context, observer: context.morrowindNameObserver }');
assert.notEqual(scaffold,prefix);
let configure;
const sandbox={require:createRequire(probePath),__dirname:path.dirname(probePath),process:{argv:['node',probePath,process.argv[2]]},Buffer,console,configure:c=>configure(c)};
vm.runInNewContext(scaffold+'\nglobalThis.fixture=fixture',sandbox,{timeout:5000});
const results=[];
function run(argv,consumers={},mutation=false){
 const sequence=[];
 configure=c=>{
  const parsed=vm.runInNewContext(parser+'\n({hasFlag,quiet:hasFlag("quiet-api"),trace:!!args.find(a=>a==="--trace-api"||a.startsWith("--trace-api=")),paused:hasFlag("trace-api-paused")})',{args:argv});
  Object.assign(c,{hasFlag:parsed.hasFlag,QUIET_API:parsed.quiet,TRACE_API:parsed.trace,TRACE_API_PAUSED:parsed.paused,TRACE_API_COUNTS:false,ESP_AUDIT:false,apiLogOff:false},consumers);
  const orig=c.instance.exports.set_api_log;c.instance.exports.set_api_log=n=>{sequence.push(n);orig(n);};
  vm.runInNewContext(mutation?predicate.replace("    !hasFlag('observe-morrowind-name') &&\n",''):predicate,c,{timeout:1000});
 };
 const f=sandbox.fixture();
 vm.runInNewContext(runner.slice(resetAt,resetAt+reset.length),f.context,{timeout:1000});
 return {f,sequence,argv,apiLogOff:f.context.apiLogOff};
}
for(const quiet of [false,true])for(const enabled of [false,true]){
 const a=[...(quiet?['--quiet-api']:[]),...(enabled?['--observe-morrowind-name']:[])];
 const r=run(a);assert.equal(r.apiLogOff,quiet&&!enabled);
 assert.deepEqual(r.sequence,enabled?[1]:quiet?[0]:[]);
 if(!enabled){assert.equal(r.f.observer,null);assert.equal(r.f.records.length,0);assert.equal(r.f.reads.length,0);}
 results.push({argv:a,sequence:r.sequence});
}
for(const consumer of [{TRACE_API:true},{TRACE_API_COUNTS:true},{TRACE_CRITICAL:true},{TRACE_INPUT_DISPATCH:true},{ESP_DELTA:true},{ESP_AUDIT:true},{breakApis:['x']},{TRACE_API_MEM:['x']}]){
 const r=run(['--quiet-api'],consumer);assert.equal(r.apiLogOff,false);results.push({consumer,sequence:r.sequence});
}
const m=run(['--quiet-api','--observe-morrowind-name'],{},true);
assert.deepEqual(m.sequence,[1,0]);assert.throws(()=>assert.equal(m.f.e.apiLog,1),assert.AssertionError);
// First independent counterexample: exact existing control setter can erase
// required observer arming even though corrected startup retained it.
const r=run(['--quiet-api','--observe-morrowind-name','--trace-api','--trace-api-paused']);
assert.deepEqual(r.sequence,[1]);assert.equal(r.f.observer!==null,true);
const inherited=[];
Object.assign(r.f.context,{cmd:{action:'trace-api',on:false},tickState:{batch:0},apiWatSeen:0,threadManager:null,inheritWasm:(...args)=>inherited.push(args)});
vm.runInNewContext('(function(){'+traceControl+'})()',r.f.context,{timeout:1000});
assert.deepEqual(r.sequence,[1,0]);assert.equal(r.f.e.apiLog,0);assert.equal(r.f.observer!==null,true);
assert.equal(r.f.context.apiLogOff,true);
console.log(JSON.stringify({verdict:'REJECTED',reason:'Existing trace-api pause control disables logging required by installed observer',runnerSHA256:hash(runner),passedStartupCases:results,mutation:{sequence:m.sequence,rejected:true},counterexample:{argv:r.argv,control:{action:'trace-api',on:false},sequence:r.sequence,observerInstalled:r.f.observer!==null,finalApiLog:r.f.e.apiLog,apiLogOff:r.f.context.apiLogOff,inheritWasm:inherited},source:{parserSHA256:hash(parser),predicateSHA256:hash(predicate),traceControlSHA256:hash(traceControl),fixturePrefixSHA256:hash(prefix),scaffoldSHA256:hash(scaffold),controlLine:runner.slice(0,runner.indexOf(traceControl)).split('\n').length,attachBeforeDllMain:runner.indexOf('// MORROWIND_NAME_ATTACH_END')<runner.indexOf('callDllMain(ex,')},boundary:'Exact production argv parser, predicate, import/attachment, late reset, control branch executed in pinned synthetic fixture. Actual observer install and source/EXE verification executed. No whole runner, initializers, WAT/module or guest execution; no correlation groups.'},null,2));
