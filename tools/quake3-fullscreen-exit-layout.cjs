'use strict';
// Fresh fullscreen-exit regression and original admission over released guards.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const {hash}=require('./quake3-startup-observer.cjs');
const ROOT=path.resolve(__dirname,'..'),RUN='scratch/runs/20261115-quake3-fullscreen-exit-layout-gameplay/';
function once(s,a,b){assert.equal(s.split(a).length,2,'layout qualification anchor: '+a);return s.replace(a,b);}
let source=fs.readFileSync(__dirname+'/quake3-compact-readiness.cjs','utf8');
source=once(source,"RUN='scratch/runs/20261115-quake3-compact-readiness-gameplay/'","RUN='"+RUN+"'");
source=source.replaceAll('quake3-compact-readiness.cjs','quake3-fullscreen-exit-layout.cjs');
source=once(source,'const api=load(__filename,source),qualifiedSource=',`source=once(source,'productionCorrection:false,materiallyChangedCausalDiagnostics:true','productionCorrection:true,materiallyChangedCausalDiagnostics:true,fullscreenExitLayoutCorrection:true');
const api=load(__filename,source),qualifiedSource=`);
const m=new Module(__filename,module);m.filename=__filename;m.paths=module.paths;m._compile(source,__filename);
const api=m.exports,qualify=api.qualificationSource,causal=api.assertCausalQualification;
api.qualificationSource=function(source){
  let s=qualify(source);
  s=once(s,"await cdp.send('Page.enable',{});","await cdp.send('Page.enable',{});await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:require('../test/test-quake3-fullscreen-exit-layout.cjs').INIT});");
  return once(s,'    report.hostNoReplay=true;',"    report.hostNoReplay=true;await require('../test/test-quake3-fullscreen-exit-layout.cjs').chromeExit({evaluate,cdp,page,report,PAGE_READ,root,expect:process.env.QUAKE3_LAYOUT_EXPECT||'green',browserURL:c.ws.url,controller});");
};
function assertLayoutQualification(pins){
  const ref=pins.qualification?.report;assert(ref?.path.startsWith(RUN+'native-controls/'));
  const bytes=fs.readFileSync(ROOT+'/'+ref.path);assert.equal(hash(bytes),ref.sha256);
  const r=JSON.parse(bytes).fullscreenExitLayout;
  assert(r?.expect==='green'&&r.realFullscreenExit&&r.realViewportShrink&&r.delayedCallbacks&&r.completePublicPaint&&r.retiredContextRefused&&r.originals===0);
  assert(r.gap.visible&&r.gap.geometry.output.right<=r.gap.geometry.viewport.w&&r.gap.geometry.output.bottom<=r.gap.geometry.viewport.h);
  assert.deepEqual(r.current.backing,r.original.backing);assert.equal(r.originalExitCause,'UNPROVED');
  const red=pins.layoutRed;assert(red,'immutable actual Chrome RED required');
  assert(red.path===RUN+'layout-red-3/report.json');
  const b=fs.readFileSync(ROOT+'/'+red.path);assert.equal(hash(b),red.sha256);const old=JSON.parse(b).fullscreenExitLayout;
  assert(old?.expect==='red'&&!old.gap.visible&&old.gap.reason==='output outside viewport'&&old.realFullscreenExit&&old.realViewportShrink&&old.completePublicPaint);
  const read=ref=>{assert(ref?.path.startsWith(RUN+'layout-red-3/'));const b=fs.readFileSync(ROOT+'/'+ref.path);assert.equal(hash(b),ref.sha256);return JSON.parse(b);};
  const post=read(pins.layoutRedPostflight),oldPins=read(pins.layoutRedPins);
  assert(!post.pinDrift.length&&!post.httpMismatches.length&&post.requestsAfterTerminal===0&&post.allPIDsAbsent&&post.profileAbsent);
  assert.notEqual(oldPins.files.find(p=>p.path==='index.html').sha256,hash(fs.readFileSync(ROOT+'/index.html')),'actual production layout must change after RED');
  for(const name of ['native-wait.json','watchdog-wait.json','outer-child-wait.json']){const w=JSON.parse(fs.readFileSync(ROOT+'/'+RUN+'layout-red-3/'+name));assert(w.exit===0&&w.actualWait&&w.stdoutEOF&&w.stderrEOF&&!fs.existsSync('/proc/'+w.pid));}
  return true;
}
api.assertCausalQualification=function(pins){assertLayoutQualification(pins);return causal(pins);};
module.exports={...api,RUN,assertLayoutQualification};
if(require.main===module){
  const [mode,out]=process.argv.slice(2);assert(['causal-chrome','qualified','original'].includes(mode));assert(path.resolve(out).startsWith(ROOT+'/'+RUN));
  const watchdog=JSON.parse(fs.readFileSync(out+'/watchdog-armed.json'));assert(watchdog.independent&&fs.existsSync('/proc/'+watchdog.pid)&&watchdog.deadline*1000>Date.now());
  assert.equal(JSON.parse(fs.readFileSync(out+'/heavy-lock.json')).pid,process.ppid);
  Promise.resolve(mode==='causal-chrome'?api.causalChrome(out):mode==='qualified'?api.visibility().qualified(out):api.visibility().original(out)).catch(error=>{console.error(error);process.exitCode=1;});
}
