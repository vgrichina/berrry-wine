'use strict';
// Offline source slices and the existing routing fixture; OS fork is substituted.
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm'),Module=require('module');
const {once}=require('events');
const R=path.resolve(__dirname,'../../..'),source=fs.readFileSync(R+'/test/run.js','utf8');
const rows=[];
function test(name,fn){fn();rows.push({name,pass:true});}
const parser=source.slice(source.indexOf('const getArg ='),source.indexOf('\nconst getArgs ='));
const trace=source.slice(source.indexOf('const TRACE_API_RAW ='),source.indexOf('// --trace-api-paused'));
const off=source.slice(source.indexOf('  apiLogOff = QUIET_API &&'),source.indexOf('\n  h.log ='));
function flags(args){return vm.runInNewContext(parser+'\n'+trace+'\n'+off+'\n({max:getArg("max-seconds"),port:getArg("control"),apiLogOff,trace:TRACE_API,show:TRACE_API_FILTER&&[...TRACE_API_FILTER]})',{
  args,QUIET_API:args.includes('--quiet-api'),TRACE_API_PAUSED:args.includes('--trace-api-paused'),TRACE_API_COUNTS:false,TRACE_CRITICAL:false,TRACE_INPUT_DISPATCH:false,ESP_DELTA:false,ESP_AUDIT:false,breakApis:[],TRACE_API_MEM:[],
});}
test('quiet-only disables dispatch callbacks',()=>assert.equal(flags(['--quiet-api']).apiLogOff,true));
test('explicit filtered trace keeps callbacks on under quiet',()=>{const f=flags(['--quiet-api','--trace-api=ShowWindow,UpdateWindow,ExitProcess']);assert.equal(f.apiLogOff,false);assert.equal(f.show.join(','),'ShowWindow,UpdateWindow,ExitProcess');});
test('paused trace is an inadequate first-boundary observer control',()=>assert.equal(flags(['--quiet-api','--trace-api=ShowWindow','--trace-api-paused']).apiLogOff,true));
test('first matching max-seconds wins',()=>assert.equal(flags(['--max-seconds=55','--max-seconds=10']).max,'55'));
let fixtureSource=fs.readFileSync(R+'/test/test-shell-cli-routing.js','utf8');
fixtureSource=fixtureSource.slice(0,fixtureSource.indexOf('try {\n  if (process.argv.includes'));
assert(fixtureSource.includes('PIPE_CHILD_ARGS: []'));
fixtureSource=fixtureSource.replace('PIPE_CHILD_ARGS: []',"PIPE_CHILD_ARGS: ['--real-ticks','--trace-api=ShowWindow,UpdateWindow,ExitProcess','--control=8124','--max-seconds=10']").replace('MAX_SECONDS: 1','MAX_SECONDS: 55');
fixtureSource+='\nmodule.exports={fixture,finish,root};';
const filename=R+'/test/test-shell-cli-routing.js',m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));m._compile(fixtureSource,filename);
const {fixture,finish,root}=m.exports;
let childArgs;
try{
  const f=fixture();assert.equal(f.launch('"'+f.exe+'"'),33);assert.equal(f.forks.length,1);childArgs=f.forks[0].args;
  test('authentic transport inserts quiet, real ticks, trace and distinct child control',()=>{assert(childArgs.includes('--quiet-api'));assert(childArgs.includes('--real-ticks'));assert.equal(flags(childArgs).port,'8124');assert.equal(flags(childArgs).apiLogOff,false);});
  test('late child timeout does not shorten transport timeout',()=>assert.equal(flags(childArgs).max,'55'));
  test('grandchild inherits SAME control port: unsafe endpoint ambiguity',()=>{const forwarded=childArgs.find(x=>x.startsWith('--pipe-child-args=')).slice(18).split(' ');assert.equal(flags(forwarded).port,'8124');});
  finish(f);
}finally{fs.rmSync(root,{recursive:true,force:true});}
// The production PNG handler is independent of API logging, but needs the codec/renderer.
const png=source.slice(source.indexOf('  const controlPng ='),source.indexOf('\n  const handleControlCommand ='));
test('exact PNG handler rejects missing renderer',()=>assert.throws(()=>vm.runInNewContext(png+'\ncontrolPng("x.png")',{renderer:null}),/renderer is unavailable/));
test('exact PNG handler uses its OWN renderer and file path without API logging',()=>{let got,wrote;const canvas={owner:'child'};const value=vm.runInNewContext(png+'\ncontrolPng("child-123.png")',{renderer:{canvas},canvasToPng:c=>(got=c,Buffer.from('codec boundary only')),fs:{writeFileSync:(p,b)=>wrote={p,b}},tickState:{batch:17},controlFrozen:false});assert.equal(got,canvas);assert.equal(wrote.p,'child-123.png');assert.equal(value.batch,17);});
async function main(){
 const {startControlServer}=require(R+'/lib/control-server');
 const make=role=>startControlServer({port:0,onCommand:cmd=>({role,action:cmd.action}),log(){}});
 const parent=make('parent'),child=make('child');
 await Promise.all([once(parent.server,'listening'),once(child.server,'listening')]);
 let collision;
 try{
  const pp=parent.server.address().port,cp=child.server.address().port;assert.notEqual(pp,cp);
  const a=await (await fetch('http://127.0.0.1:'+pp+'/snapshot')).json(),b=await (await fetch('http://127.0.0.1:'+cp+'/snapshot')).json();
  assert.equal(a.value.role,'parent');assert.equal(b.value.role,'child');
  const p=await (await fetch('http://127.0.0.1:'+cp+'/ctl',{method:'POST',body:JSON.stringify({action:'png',path:'child-123.png'})})).json();assert.equal(p.value.action,'png');
  rows.push({name:'actual control HTTP routes dispatch snapshot/PNG independently on distinct sockets (handler boundary only)',pass:true});
  collision=startControlServer({port:cp,onCommand:()=>{throw Error('must not route');},log(){}});
  const [error]=await once(collision.server,'error');assert.equal(error.code,'EADDRINUSE');
  rows.push({name:'actual grandchild fixed-port collision yields EADDRINUSE; existing child still owns endpoint',pass:true});
 }finally{parent.close();child.close();if(collision)collision.close();}
 const codec={available:false};try{codec.path=require.resolve('pngjs',{paths:[R]});codec.available=true;}catch(e){codec.error=e.code;}
 assert.equal(codec.available,false,'update readiness if exact codec is recovered');
 fs.writeFileSync(__dirname+'/flags.json',JSON.stringify({verdict:'PASS_MECHANICS_WITH_EXPLICIT_RECOVERY_BLOCKER',rows,childArgs,codec,
  controls:'quiet-only, paused trace, missing renderer, inherited duplicate max, actual EADDRINUSE',
  plan:'Do not authorize fixed child control=8124 recursively. No-control inherited trace + retained PID-named observer snapshots is the existing collision-free option, pending exact codec recovery and relocation-only observer checks.',
  guestAttempts:0,OSForks:0,actualPNGEncoded:false},null,2)+'\n');
 console.log('PASS flags/transport/control mechanics and controls; reproduced grandchild fixed-port collision; PNG codec recovery BLOCKED, no actual image encoded');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
