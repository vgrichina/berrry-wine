'use strict';
// New task route over the released diagnostic composition. No old-run rebind.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),cp=require('node:child_process'),assert=require('node:assert/strict');
const prior=require('./quake3-native-snapshot-latency.cjs'),{hash}=require('./quake3-startup-observer.cjs');
const ROOT=path.resolve(__dirname,'..'),RUN='scratch/runs/20261115-quake3-compact-readiness-gameplay/';
const BASELINE='b22c360b3c624b40542b4c6dff120f9fd4951e75';
function once(s,a,b){assert.equal(s.split(a).length,2,'compact readiness anchor changed: '+a.slice(0,80));return s.replace(a,b);}
function load(filename,source){const m=new Module(filename,module);m.filename=filename;m.paths=module.paths;m._compile(source,filename);return m.exports;}
// Reuse the qualified implementation without changing its closed destination.
// Only this new entry point gets the new run and qualification destinations.
let source=fs.readFileSync(__dirname+'/quake3-native-snapshot-latency.cjs','utf8');
source=once(source,"RUN='scratch/runs/20261115-quake3-latency-after-census-repair/'","RUN='"+RUN+"'");
source=source.replaceAll('quake3-native-snapshot-latency.cjs','quake3-compact-readiness.cjs');
source=once(source,'20261115 materially changed causal diagnostics; one fresh registered original','20261115 bounded readiness operands; one fresh registered original');
const api=load(__filename,source),qualifiedSource=api.qualificationSource,causalGate=api.assertCausalQualification;
function legacyController(){
  const original=cp.execFileSync('git',['show',BASELINE+':tools/quake3-browser-controller.cjs'],{cwd:ROOT,encoding:'utf8'});
  const current=fs.readFileSync(__dirname+'/quake3-browser-controller.cjs','utf8');
  // Exactly one added serializer and four serializer call substitutions are
  // the complete controller change relative to the published legacy source.
  const start=current.indexOf('function identityOperands(identity){'),end=current.indexOf('\nfunction same(',start);
  assert(start>0&&end>start);
  assert.equal(current.slice(0,start)+current.slice(end+1).replaceAll('JSON.stringify(identityOperands(identity))}','JSON.stringify(identity)}'),original,'controller changed beyond bounded serialization');
  return load(__dirname+'/quake3-browser-controller.cjs',prior.compose(original));
}
api.qualificationSource=function(source){
  return once(qualifiedSource(source),'  const unknownAt=Date.now(),unknownBefore=',
    "  await require('../test/quake3-compact-readiness-fixture.cjs').chromeEquivalence({evaluate,cdp,report,old:require('../tools/quake3-compact-readiness.cjs').legacyController(),compact:controller});\n  const unknownAt=Date.now(),unknownBefore=");
};
function assertCompactQualification(pins){
  const ref=pins.qualification?.report;assert(ref?.path.startsWith(RUN+'native-controls/')&&!ref.path.includes('..'),'fresh bounded readiness qualification required');
  const bytes=fs.readFileSync(ROOT+'/'+ref.path);assert.equal(hash(bytes),ref.sha256);
  const r=JSON.parse(bytes).compactReadiness;assert(r?.semanticEquivalence&&r.readOnly&&r.originals===0);
  assert.deepEqual(r.rows.map(x=>x.kind),['ready','held','pending','damage','replacement','overlay','error','select-output']);
  assert(r.rows.every(x=>x.unchanged&&JSON.stringify(x.a)===JSON.stringify(x.b)&&x.compactBytes<18104));
  assert(r.timings.length===2&&r.timings.every(x=>x.bodyMs>=0&&x.compileRoundtripMs>=0&&x.runRoundtripMs>=0));
  const compact=r.timings.find(x=>x.name==='compact'),legacy=r.timings.find(x=>x.name==='legacy');
  assert(compact.expressionBytes<18104&&legacy.expressionBytes>600000,'materially bounded emitted readiness required');
  assert.equal(r.historical1113Cause,'UNKNOWN');assert(r.compileAndTransportIndividuallyUnresolved);
  return true;
}
api.assertCausalQualification=function(pins){assertCompactQualification(pins);return causalGate(pins);};
module.exports={...api,RUN,BASELINE,legacyController,assertCompactQualification};
if(require.main===module){
  const [mode,out]=process.argv.slice(2);assert(['causal-chrome','qualified','original'].includes(mode));assert(path.resolve(out).startsWith(ROOT+'/'+RUN));
  const watchdog=JSON.parse(fs.readFileSync(out+'/watchdog-armed.json'));assert(watchdog.independent&&fs.existsSync('/proc/'+watchdog.pid)&&watchdog.deadline*1000>Date.now());
  assert.equal(JSON.parse(fs.readFileSync(out+'/heavy-lock.json')).pid,process.ppid,'actual independent supervisor must own runtime');
  Promise.resolve(mode==='causal-chrome'?api.causalChrome(out):mode==='qualified'?api.visibility().qualified(out):api.visibility().original(out)).catch(error=>{console.error(error);process.exitCode=1;});
}
