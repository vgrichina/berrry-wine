'use strict';
const fs=require('node:fs'),path=require('node:path'),net=require('node:net'),assert=require('node:assert/strict');
const c=require('../tools/native-supervisor-common.cjs');
async function main(out){
 out=path.resolve(out);fs.mkdirSync(out,{recursive:true});const a=require('../tools/drakan-authentic-reviewed.cjs');a.R=out;
 const exe=path.join(out,'authored.exe');fs.writeFileSync(exe,require('../tools/drakan-retired-modal-focus.cjs').fixture(),{flag:'wx'});
 const prep=require('../tools/blood2-immutable-preparation.cjs');
 const rows=prep.collect([],{revision:'6308e7a3be6c98ab150d07c2f178d8cd09f4b2e6',media:[{path:path.relative(path.resolve(__dirname,'..'),exe),size:fs.statSync(exe).size,sha256:c.sha256(fs.readFileSync(exe))}]});
 for(const file of ['lib/renderer-input.js','lib/cli-native-scene.js']){const b=fs.readFileSync(path.resolve(__dirname,'..',file));Object.assign(rows.find(r=>r.path===file),{sha256:c.sha256(b),body:b.toString('base64')});}
 const frozen=prep.freeze(rows,fs.readFileSync(process.env.DRAKAN_TEST_MODULE));
 const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});a.URL='http://127.0.0.1:'+port+'/ctl';
 Object.assign(process.env,{DRAKAN_CONTROL_OUT:out,DRAKAN_CONTROL_URL:a.URL});
 const at=c.now(),deadline=at+240;a.save('launch.json',{at,deadline,gameplayCutoff:deadline-180,reserveSeconds:180,nativeScene:true,bindingContract:'native-reviewed-context-v1',inputPolicy:{confirmationMs:500,physicalUpMs:1750,observationMs:3000,gameFreshnessSeconds:15,menuFreshnessSeconds:30}});
 require('../tools/blood2-durable-launcher.cjs').launch({run:out,command:[process.execPath,'test/run.js','--exe='+exe,'--no-build','--threads','--real-ticks','--screen=1024x712','--control='+port,'--max-seconds=35','--max-batches=100000000','--stuck-after=0','--quiet-api','--quiet-blocks','--no-close'],env:frozen.env,fds:frozen.fds,deadline:at+40,cleanupDeadline:at+55});frozen.close();
 try{
  const end=c.now()+15;for(;;){try{const s=await a.call({action:'snapshot'},.5);if(s.nativeMessageBox&&s.physicalUp)break;}catch{}assert(c.now()<end);await c.sleep(25);}
  await a.capture('warning');const first=a.read('warning.json');assert.equal(first.snapshot.mainHwnd,'0x0');assert.equal(first.snapshot.nativeMessageBox.controlClass,16);
  let failure=null;try{await a.submit({review:'warning',bind:true,name:'enter',key:13,ms:300,scene:'menu',observation:'Authored pre-main NULL-owner warning to actual CreateWindow/ShowWindow'});}catch(e){failure=String(e);}
  assert.equal(a.read('enter-up.json').state,'ACK');assert(a.read('enter-down.json')[0].consumed);
  // All post-release actor data is captured by submit BEFORE any UNKNOWN.
  // A closed control never requests a later endpoint.
  const progress=a.read('enter-progress.json');a.save('transition.json',{failure,progress});
  assert.equal(failure,null);const s=a.read('enter.json').snapshot;
  const main=s.windows.find(w=>w.hwnd===s.mainHwnd);
  if(process.env.DRAKAN_EXPECT_OLD){assert.match(main.title,/STALE GetFocus/);a.save('assertions.json',{pass:true,expectedOldFailure:true,guestGetFocusReturnedRetiredHandle:true,actorThread:1,consumed:true,independentUP:true});}
  else {assert.doesNotMatch(main.title,/STALE/);assert(s.focusWindow.live);assert.equal(s.focus,s.mainHwnd);assert.equal(s.focusWindow.threadId,1);
   const pending=fs.readFileSync(path.join(out,'enter-presentation-pending.jsonl'),'utf8').trim().split('\n').map(JSON.parse);assert(pending.length>0);assert(pending.every(p=>Array.isArray(p.reply.failures)&&p.reply.failures.length));
   a.save('assertions.json',{pass:true,guestGetFocusNullAfterModal:true,liveMainFocus:true,correctActorThread:true,pendingFullReasonsRetained:pending.length,consumed:true,independentUP:true});}
 }finally{
  if(!fs.existsSync(path.join(out,'native-wait.json')))a.save('cancel-request.json',{fixtureOnly:true});
  const end=c.now()+15;while(!fs.existsSync(path.join(out,'owner-complete.json'))){assert(c.now()<end);await c.sleep(25);}
  assert(a.read('owner-complete.json').retainedActualWaits);assert.equal(a.read('owner-complete.json').receipt.leaked,false);
 }
}
async function unit(){
 const {exports:e,module}=await require('./render-helper').bootRenderHarness({fonts:'none',extraWat:`
  (func (export "test_new") (param $parent i32) (result i32)
   (local $h i32)
   (local.set $h (global.get $next_hwnd))
   (global.set $next_hwnd (i32.add (local.get $h) (i32.const 1)))
   (call $wnd_table_set (local.get $h) (global.get $WNDPROC_BUILTIN))
   (call $wnd_set_parent (local.get $h) (local.get $parent))
   (local.get $h))
  (func (export "test_retire") (param $h i32) (call $wnd_destroy_tree (local.get $h)))
  (func (export "test_thread") (param $t i32) (global.set $current_thread_id (local.get $t)))
  (func (export "test_getfocus") (result i32)
   (call $handle_GetFocus (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
   (i32.load (global.get $reg_base)))
  (func (export "test_restore") (param $h i32) (call $focus_restore_after_modal (local.get $h)))
  (func (export "test_passive_show") (param $h i32) (param $cmd i32)
   (call $show_window_activate_top_level (local.get $h) (local.get $cmd)))
 `});
 e.test_thread(1);const owner=e.test_new(0),dlg=e.test_new(0),child=e.test_new(dlg),other=e.test_new(0);
 e.set_focus_hwnd(child);assert.equal(e.test_getfocus(),child);
 e.test_retire(dlg);assert.equal(e.get_focus_hwnd(),0,'native modal recursive retirement releases child focus');
 assert.equal(e.test_getfocus(),0,'GetFocus never fabricates a main/owner');
 e.set_focus_hwnd(child);assert.equal(e.test_getfocus(),0,'stale retained shadow handle returns NULL');
 e.set_focus_hwnd(other);const d2=e.test_new(0),c2=e.test_new(d2);e.test_retire(d2);
 assert.equal(e.test_getfocus(),other,'unrelated live focus survives tree retirement');
 e.test_restore(owner);assert.equal(e.test_getfocus(),other,'modal restore preserves unrelated live focus');
 for(const cmd of [0,4,7,8]){e.test_passive_show(owner,cmd);assert.equal(e.test_getfocus(),other,'hide/noactivate show preserves unrelated focus');}
 e.test_thread(2);assert.equal(e.test_getfocus(),0,'another queue cannot borrow thread1 focus');
 const foreign=e.test_new(0);e.set_focus_hwnd(foreign);assert.equal(e.test_getfocus(),foreign);
 e.test_thread(1);assert.equal(e.test_getfocus(),0,'thread1 cannot borrow thread2 focus');
 e.set_focus_hwnd(other);e.test_retire(foreign);assert.equal(e.test_getfocus(),other,'retiring foreign queue does not clear local live focus');
 e.test_retire(owner);e.test_restore(owner);assert.equal(e.test_getfocus(),other,'destroyed owner cannot replace valid focus');
 // Real worker_threads actor and idle shadow share WND memory but never
 // focus globals. Inspect both, rather than attributing a shadow to the owner.
 const shadow=await require('./render-helper').bootRenderHarness({fonts:'none',prebuiltModule:module});
 const {Worker}=require('node:worker_threads');
 const worker=new Worker(`
  const {parentPort,workerData}=require('node:worker_threads');
  (async()=>{const h=await require(workerData.helper).bootRenderHarness({fonts:'none',prebuiltModule:workerData.module,memory:workerData.memory}),e=h.exports;
   e.test_thread(7);const d=e.test_new(0),ch=e.test_new(d);e.set_focus_hwnd(ch);
   parentPort.postMessage({d,ch,focus:e.test_getfocus(),thread:e.get_current_thread_id()});
   parentPort.once('message',()=>{e.test_retire(d);parentPort.postMessage({focus:e.get_focus_hwnd(),api:e.test_getfocus()});parentPort.close();});
  })().catch(e=>{throw e});`,{eval:true,workerData:{helper:require.resolve('./render-helper'),module,memory:shadow.memory}});
 const next=()=>new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);});
 const closed=new Promise((resolve,reject)=>{worker.once('exit',resolve);worker.once('error',reject);});
 const before=await next();assert.equal(before.focus,before.ch);assert.equal(before.thread,7);
 assert.equal(shadow.exports.get_focus_hwnd(),0,'idle instance cannot observe actor private focus');
 shadow.exports.set_focus_hwnd(before.ch);shadow.exports.test_thread(1);
 assert.equal(shadow.exports.test_getfocus(),0,'shadow cannot claim another thread focus');
 const afterPromise=next();worker.postMessage('retire');const after=await afterPromise;
 assert.deepEqual(after,{focus:0,api:0});assert.equal(shadow.exports.get_focus_hwnd(),before.ch,'stale observer is distinguishable from actual owner');
 assert.equal(shadow.exports.test_getfocus(),0,'shadow stale handle cannot pass GetFocus');
 assert.equal(await closed,0,'actual Worker exit');
 console.log('PASS native recursive focus retirement, stale GetFocus NULL, unrelated focus and queue boundaries');
}
module.exports={main,unit};if(require.main===module)(process.argv[2]==='--unit'?unit():main(process.argv[2])).catch(e=>{console.error(e);process.exitCode=1;});
