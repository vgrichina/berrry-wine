'use strict';
// Authored PE only: ordinary console -> game top-level, hide, SetCapture.
// No original media, state patch, host focus or capture manipulation.
const assert=require('node:assert/strict');
function fixture(){
  const b=require('./gltron-current-native-capture.cjs').fixture({messageDriven:true});
  const base=0x400000,raw=r=>r-0x1000+0x400,u=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
  for(const [thunk,r,name] of [[0x1208,0x1e00,'GetTickCount'],[0x1324,0x1e20,'ShowWindow'],[0x1328,0x1e40,'SetCapture']]){
    b.writeUInt32LE(r,raw(thunk));b.writeUInt16LE(0,raw(r));b.write(name+'\0',raw(r+2));
  }
  b.write('Authored console\0',raw(0x30b0));
  const code=[],emit=(...v)=>code.push(...v),push=n=>emit(0x68,...u(n)),call=a=>emit(0xff,0x15,...u(base+a));
  // The class is registered by the original prefix before this insertion.
  for(const n of [0,base,0,0,360,480,40,40,0x90000000,base+0x30b0,base+0x3000,0])push(n);
  call(0x1304);emit(0xa3,...u(base+0x3620),0x50);call(0x1308);
  const delay=()=>{call(0x1208);emit(0x89,0xc3);const loop=code.length;call(0x1208);emit(0x29,0xd8,0x3d,...u(1500),0x72);emit((loop-(code.length+1))&255);};
  delay();
  const start=raw(0x2000),registration=11;
  assert.equal(b[start],0x68);assert.equal(b[start+5],0xff);
  let end=start+0x780;while(b[end-1]===0)end--;
  const old=Buffer.from(b.subarray(start,end));
  const focusPattern=Buffer.from([0xa3,...u(base+0x3600),0x50,0xff,0x15,...u(base+0x1308)]);
  const focus=old.indexOf(focusPattern);assert(focus>registration);
  const afterFocus=focus+focusPattern.length,prefix=Buffer.from(code);
  code.length=0;delay();push(0);emit(0xff,0x35,...u(base+0x3620));call(0x1324);
  emit(0xff,0x35,...u(base+0x3600));call(0x1328);
  const extra=Buffer.from(code),result=Buffer.concat([old.subarray(0,registration),prefix,
    old.subarray(registration,afterFocus),extra,old.subarray(afterFocus)]);
  assert(result.length<0x800);b.fill(0,start,start+0x800);result.copy(b,start);
  return b;
}
// Capture ownership is admissible, not a prerequisite for presentation. The
// game may present a menu before it decides to acquire the mouse.
function gameWindowReady(reply){
  const s=reply?.snapshot;
  return !!(reply?.contract==='native-startup-readiness-v1'&&reply.ready&&
    reply.failures.length===0&&s&&s.focusTopLevel!==s.mainHwnd&&
    require('../lib/cli-native-scene').contextFailures(s,s).length===0);
}
// Only the documented controlEval parameters are in scope. In particular,
// threadManager is not a parameter and must never appear in this expression.
const renderObservation=`(()=>{const b=ctx.getGlGpsBridge?.();return {
  at:Date.now(),batch:tickState.batch,bridge:b?{api:b.api,stats:b.stats,
  epoch:b.workerEpoch,error:String(b.workerAsyncError||''),
  presents:b.presenter?.presents,stamp:b.presenter?.stamp,
  layer:b.presenter?.layer?{writeSeq:b.presenter.layer.writeSeq,
    width:b.presenter.layer.canvas.width,height:b.presenter.layer.canvas.height}:null}:null};})()`;
async function waitGameWindow(a,seconds=60){
  assert(Number.isInteger(seconds)&&seconds>0&&seconds<=60);
  const c=require('./native-supervisor-common.cjs'),fs=require('node:fs'),path=require('node:path');
  a.opened();const start=c.now(),deadline=Math.min(start+seconds,a.reserve()),target=a.read('native-pid.json');
  a.save('game-window-wait-intent.json',{start,deadline,seconds,passive:true,captureRequired:false});
  for(;;){
    a.opened();assert(c.now()<deadline,'selected game window startup deadline');
    const r=await a.call({action:'native-startup-readiness'},Math.min(3,deadline-c.now()));
    fs.appendFileSync(path.join(a.R,'game-window-wait.jsonl'),JSON.stringify({at:c.now(),deadline,reply:r})+'\n');
    assert(c.now()<deadline&&r.snapshot.nativeProcess.pid===target.pid&&r.snapshot.physicalUp&&!r.snapshot.quit);
    assert(r.snapshot.capture==='0x0'||!r.failures.includes('input.capture'),'foreign capture');
    if(gameWindowReady(r)){a.save('game-window-ready.json',{at:c.now(),deadline,reply:r});return r;}
    await c.sleep(Math.min(100,Math.max(0,(deadline-c.now())*1000)));
  }
}
module.exports={fixture,gameWindowReady,waitGameWindow,renderObservation};
if(require.main===module)require('node:fs').writeFileSync(process.argv[2],fixture(),{flag:'wx'});
