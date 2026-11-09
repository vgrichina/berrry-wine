'use strict';
// Opt-in composition of the retained caller and its actual readiness consumer.
// No extra readiness IO, child listeners, timers, signals or protocol requests.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks'),crypto=require('node:crypto');
const trace=require('./redline-native-trace.cjs');
const provider='tools/redline-startup-boundary.cjs';
const readinessSHA='f09f0d7ee95be2699f00246828a7f5515c13cd3c26e2b96e377654f3b7a6160d';
function replace(s,a,b){assert.equal(s.split(a).length,2,'one startup composition site: '+a);return s.replace(a,b);}
function create({write,now=()=>performance.now()}){
  const rows=[];let firstTerminal=null,outcome=null,dropped=0,flushed=false,writeError=null;
  function retain(kind,value={}){if(rows.length<512)rows.push({kind,at:now(),...value});else dropped++;}
  return {
    start(){retain('readiness-start');},
    spawnReturn(child){retain('spawn-return',{pid:child.pid});},
    attempt(kind,invoke){const start=now();try{const result=invoke();retain(kind,{start,result:kind==='stat'?{size:result.size}:{text:result.slice(0,4096),characters:result.length,truncated:result.length>4096}});return result;}
      catch(e){retain(kind,{start,error:e.code??String(e)});throw e;}},
    check(evidence){retain('existing-child-check',{exit:evidence.exit,waitError:evidence.waitError});},
    race(result){retain('existing-poll-result',{result:result??null});},
    outcome(value){outcome=value;retain('readiness-outcome',{outcome:value});},
    terminal(reason){if(!firstTerminal){firstTerminal={at:now(),reason:String(reason).slice(0,1024)};retain('first-terminal',firstTerminal);}},
    flush(){if(flushed||!firstTerminal)return;flushed=true;try{write({version:1,clock:'Node performance.now milliseconds only',rows,firstTerminal,outcome,dropped,
      cause:'UNKNOWN: readiness observations do not identify native Chrome cause',browserEOF:'UNKNOWN',collectionIsNotBrowserEOF:true});}catch(e){writeError=String(e);}},
    status(){return {rows,firstTerminal,outcome,dropped,flushed,writeError};}
  };
}
// A fresh regular file only: inherited writers/FIFOs cannot hold diagnostic flush.
function writeDiagnostic(file,value){
  const bytes=Buffer.from(JSON.stringify(value));assert(bytes.length<=128*1024,'bounded startup diagnostic');
  let fd;try{fd=fs.openSync(file,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NONBLOCK|fs.constants.O_NOFOLLOW,0o600);
    assert(fs.fstatSync(fd).isFile(),'regular diagnostic required');let offset=0;
    while(offset<bytes.length){const written=fs.writeSync(fd,bytes,offset,bytes.length-offset);assert(written>0,'diagnostic write made no progress');offset+=written;}
  }finally{if(fd!==undefined)fs.closeSync(fd);}
}
function readinessSource(){
  let s=fs.readFileSync(path.join(__dirname,'redline-chrome-startup.cjs'),'utf8');
  assert.equal(crypto.createHash('sha256').update(s).digest('hex'),readinessSHA,'exact readiness provider');
  s=replace(s,'wait = ms =>','diagnostic, wait = ms =>');
  s=replace(s,'const started=Date.now();', 'diagnostic.start();const started=Date.now();');
  s=replace(s,'if (evidence.exit || evidence.waitError)',"diagnostic.check(evidence);\n      if (evidence.exit || evidence.waitError)");
  s=replace(s,'if(fs.statSync(file).size>4096)',"if(diagnostic.attempt('stat',()=>fs.statSync(file)).size>4096)");
  s=replace(s,"text=fs.readFileSync(file,'utf8');", "text=diagnostic.attempt('read',()=>fs.readFileSync(file,'utf8'));");
  s=replace(s,"const record = outcome => save('chrome-startup.json',", "const record = outcome => (diagnostic.outcome(outcome),save('chrome-startup.json',");
  s=replace(s,'lastRead,...evidence});','lastRead,...evidence}));');
  s=replace(s,'if(result?.exit||result?.waitError)', 'diagnostic.race(result);\n      if(result?.exit||result?.waitError)');
  return s;
}
let consumer;
function portPublication(options){
  if(!consumer){const Module=require('node:module'),m=new Module(__filename,module);m.filename=__filename;m.paths=module.paths;m._compile(readinessSource(),__filename);consumer=m.exports.portPublication;}
  return consumer(options);
}
function integrate(source=trace.integrate()){
  new(require('node:vm').Script)(readinessSource()); // Refuse drift before spawning.
  source=replace(source,"require('./redline-chrome-startup.cjs')","require('./redline-startup-boundary.cjs')");
  source=replace(source,'const pending=new Map(),workers=new Map(),workerPromises=[];',"const pending=new Map(),workers=new Map(),workerPromises=[];const startupBoundary=require('./redline-startup-boundary.cjs').create({write:value=>require('./redline-startup-boundary.cjs').writeDiagnostic(out+'/startup-boundary.json',value)});");
  source=replace(source,'for(const p of pins.files){',`assert.equal(pins.files.filter(p=>p.path===${JSON.stringify(provider)}).length,1,'startup diagnostic provider pin');for(const p of pins.files){`);
  source=replace(source,'spawn:cp.spawn,executable:', 'spawn:(...args)=>{const child=cp.spawn(...args);startupBoundary.spawnReturn(child);return child;},executable:');
  source=replace(source,'evidence:startupEvidence,deadline,guard:', 'evidence:startupEvidence,diagnostic:startupBoundary,deadline,guard:');
  source=replace(source,'firstFailure??=error;closing=true;', 'firstFailure??=error;closing=true;startupBoundary.terminal(firstFailure);');
  source=replace(source,'closing=true;clearTimeout(timer);', 'closing=true;startupBoundary.terminal(firstFailure??reason);startupBoundary.flush();clearTimeout(timer);');
  return source;
}
function fixtureSource(){return replace(trace.fixtureSource(),"[path.join(__dirname,'redline-native-trace.cjs'),'--caller']","[path.join(__dirname,'redline-startup-boundary.cjs'),'--caller']");}
function prepare(run){const plan=trace.prepare(run),file=path.join(path.resolve(run),'runtime-pins.json'),pins=JSON.parse(fs.readFileSync(file));
  const b=fs.readFileSync(__filename);pins.files.push({path:provider,size:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')});fs.writeFileSync(file,JSON.stringify(pins,null,2));
  plan.argv=[process.execPath,__filename,'--fixture'];plan.env.REDLINE_STARTUP_BOUNDARY='1';plan.providers=pins.files.length;plan.startupDiagnostic='Existing readiness attempts retained; no native cause inference';fs.writeFileSync(path.join(run,'experiment-plan.json'),JSON.stringify(plan,null,2));return plan;}
module.exports={create,writeDiagnostic,readinessSource,portPublication,integrate,fixtureSource,prepare,readinessSHA,
  observeStartup:require('./redline-chrome-startup.cjs').observeStartup,publicationSnapshot:require('./redline-chrome-startup.cjs').publicationSnapshot};
if(require.main===module){const mode=process.argv[2];if(mode==='--prepare'){console.log(JSON.stringify(prepare(process.argv[3])));}
  else {assert(['--check','--caller','--fixture'].includes(mode),'explicit mode');const source=mode==='--fixture'?fixtureSource():integrate();new(require('node:vm').Script)(source);
    if(mode==='--check')console.log('PASS opt-in actual startup composition; no runtime');
    else {assert.equal(process.env.REDLINE_STARTUP_BOUNDARY,'1');assert.equal(process.env.REDLINE_NATIVE_TRACE,'1');if(mode==='--caller')assert.equal(process.env.REDLINE_NATIVE_FIXTURE,'1');
      const Module=require('node:module'),filename=path.join(__dirname,mode==='--fixture'?'redline-native-fixture.cjs':'redline-browser-run.cjs'),m=new Module(filename,module);m.filename=filename;m.paths=module.paths;m._compile(source,filename);}}
}
