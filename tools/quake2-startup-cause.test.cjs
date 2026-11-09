'use strict';
// Actual health-composed production startup, inert process/CDP seams only.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const Module=require('node:module'),assert=require('node:assert/strict'),z=require('node:zlib');
const {once}=require('node:events');
const composition=require('./quake2-native-driver-composition.cjs');
const observer=require('./quake2-input-wire-observation.cjs');
const root=path.resolve(__dirname,'..'),consumer=path.join(root,composition.consumerPath);
const prior=root+'/scratch/runs/20261109-quake2-observed-startup-native-1135';
const base='14381d50ee2832147b12bcfd72c33fdf097ae5b4';
const run=path.resolve(process.env.Q2_STARTUP_TEST_RUN||'scratch/runs/20261109-quake2-autoattach-cause-repair-1150/controls');
if(process.env.Q2_STARTUP_CHILD==='1'){
  let selected=observer;
  if(process.env.Q2_STARTUP_OLD==='1'){
    const old=new Module(path.join(__dirname,'quake2-input-wire-observation.cjs'),module);
    old.filename=path.join(__dirname,'quake2-input-wire-observation.cjs');old.paths=module.paths;
    old._compile(cp.execFileSync('git',['show',base+':tools/quake2-input-wire-observation.cjs'],{cwd:root,encoding:'utf8'}),old.filename);
    selected=old.exports;
    observer.create=selected.create;
  }
  // Same eager health wrapper and ROOT binding as 1135; no app/media copied.
  require(prior+'/health-preload.cjs');
  const compose=composition.compose;
  composition.compose=()=>{const result=compose();return {...result,references:[...result.references,...selected.references()]};};
  require('./quake2-native-driver-composition.test.cjs');
  const extension=Module._extensions['.cjs'];
  Module._extensions['.cjs']=function(m,file){
    if(file!==consumer)return extension(m,file);
    let source=selected.integrate(composition.compose().source);
    assert(source.includes('first passive HP loss/death'));
    const fullGeneratedSha256=require('node:crypto').createHash('sha256').update(source).digest('hex');
    const end=source.indexOf(" // Generated native CDP keyboard preflight");
    assert(end>0);
    // Test ends at a defined boundary BEFORE input/app selection. Retain the
    // complete actual setup, error handler, send/event routing and close path.
    source=source.slice(0,end)+" throw Error('offline startup boundary');\n"+source.slice(source.lastIndexOf('})().catch'));
    fs.writeFileSync(process.env.Q2_FIXTURE_DIR+'/generated-source.json',JSON.stringify({
      sha256:require('node:crypto').createHash('sha256').update(source).digest('hex'),bytes:Buffer.byteLength(source),
      base,fullGeneratedSha256,health:true,stopBeforeInput:true,sourceCopies:false}));
    return m._compile(source,file);
  };
  const Socket=globalThis.WebSocket,mode=process.env.Q2_STARTUP_MODE;
  // Advance the real request timer only in the inert fixture; source still
  // uses exactly 20000. Diagnostic reports the negative timer overrun honestly.
  const timeout=globalThis.setTimeout;
  globalThis.setTimeout=(fn,ms,...args)=>timeout(fn,ms===20000?60:ms,...args);
  if(mode==='sink-fail'){
    const create=observer.create;let failed=false;
    observer.create=opts=>create({...opts,write:value=>{if(!failed){failed=true;throw Error('inert sink unavailable');}return opts.write(value);}});
  }
  globalThis.WebSocket=class extends Socket{
    send(text){
      const v=JSON.parse(text),page=!!v.sessionId;
      fs.appendFileSync(process.env.Q2_FIXTURE_DIR+'/startup-protocol.jsonl',text+'\n');
      const reply=(result={},sessionId=v.sessionId,error)=>this.onmessage?.({data:JSON.stringify({id:v.id,sessionId,result,error})});
      if(v.method==='Target.setAutoAttach'){
        if((mode==='root-timeout'&&!page)||(mode==='page-timeout'&&page))return;
        if(mode==='sync-throw'&&!page)throw Error('inert startup socket throw');
        if(mode==='transport-error'&&!page){timeout(()=>this.dispatchEvent(new Event('error')),5);return;}
        if(mode==='protocol-error'&&!page){queueMicrotask(()=>reply({},undefined,{code:-1,message:'inert protocol refusal'}));return;}
        if(mode==='late-reply'&&!page){timeout(()=>reply(),85);return;}
        if(mode==='delayed-reply'&&!page){timeout(()=>reply(),20);return;}
        if(mode==='wrong-session'&&page){queueMicrotask(()=>reply({},'other-session'));return;}
        // Record real target context events before the root reply.
        if(!page)queueMicrotask(()=>this.onmessage?.({data:JSON.stringify({method:'Target.attachedToTarget',params:{sessionId:'auto-page-session',targetInfo:{type:'page',targetId:'fixture-page',url:'about:blank'},waitingForDebugger:false}})}));
      }
      // Existing seam replies without sessionId. Preserve session for the
      // normal controls so only wrong-session has a mismatch.
      if(page&&v.method!=='Browser.close'){queueMicrotask(()=>reply());return;}
      return super.send(text);
    }
  };
}else if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
async function main(){
  fs.mkdirSync(run,{recursive:true});
  for(const mode of ['normal','root-timeout','page-timeout','protocol-error','sync-throw','transport-error','late-reply','delayed-reply','wrong-session']){
    const old=await scenario(mode,true),fresh=await scenario(mode,false);
    assert.deepEqual(fresh.protocol,old.protocol,'passive change preserves full startup wire order');
    assert.equal(old.events.length,0,'old observer missing setup evidence');
    assert(fresh.events.some(v=>v.kind==='send-entry'&&v.method==='Target.setAutoAttach'));
    if(mode==='normal'||mode==='wrong-session'||mode==='delayed-reply'){
      assert.match(fresh.failure.error,/offline startup boundary/);
      const attach=fresh.events.filter(v=>v.kind==='send-entry'&&v.method==='Target.setAutoAttach');
      assert.deepEqual(attach.map(v=>v.sessionId),[null,'fixture-session']);
      assert(attach.every(v=>JSON.parse(v.params.json).waitForDebuggerOnStart===false));
      assert.deepEqual(fresh.protocol.map(v=>v.method),['Browser.getVersion','Target.setDiscoverTargets','Target.setAutoAttach',
        'Target.getTargets','Target.attachToTarget','Target.setAutoAttach','Page.enable','Runtime.enable','Browser.close']);
      if(mode!=='delayed-reply')assert(fresh.events.some(v=>v.kind==='context-event'&&JSON.parse(v.raw.json).params.sessionId==='auto-page-session'));
    }
    if(mode==='root-timeout'||mode==='page-timeout'||mode==='late-reply'){
      const timed=fresh.events.find(v=>v.kind==='request-timeout');assert(timed);
      assert.equal(timed.sessionId,mode==='page-timeout'?'fixture-session':null);
      assert(timed.pendingBeforeDelete.some(v=>v.requestId===timed.requestId&&v.method==='Target.setAutoAttach'));
      assert(Number.isFinite(timed.elapsedMs)&&Number.isFinite(timed.timerOverrunMs));
    }
    if(mode==='wrong-session')assert(fresh.events.some(v=>v.kind==='raw-reply'&&v.sessionMatches===false&&v.pendingPresent));
    if(mode==='late-reply')assert(fresh.events.some(v=>v.kind==='raw-reply'&&v.late&&!v.pendingPresent));
    if(mode==='protocol-error')assert(fresh.events.some(v=>v.kind==='raw-reply'&&JSON.parse(v.raw.json).error?.code===-1));
    if(mode==='sync-throw')assert(fresh.events.some(v=>v.kind==='send-throw'));
    if(mode==='transport-error')assert(fresh.events.some(v=>v.kind==='transport-error'));
  }
  await scenario('sink-fail',false);
  // Bounded state, truncation, diagnostics cannot prevent an actual send.
  const values=[];let sent=0,clock=0;
  const wire=observer.create({write:v=>values.push(v),now:()=>++clock,schedule:()=>{}});
  for(let i=0;i<150;i++){
    wire.send({requestId:i,method:'Target.setAutoAttach',params:{autoAttach:true}},()=>sent++);
    wire.receive({id:i,result:{context:'x'.repeat(6000)}},{});
  }
  wire.flush();assert.equal(sent,150);assert(values.at(-1).startup.dropped>0);
  assert.equal(values.at(-1).startup.events.length,128);
  assert(values.at(-1).startup.events.some(v=>v.raw?.truncated));
  const unmatched=[];
  const unknown=observer.create({write:v=>unmatched.push(v),schedule:()=>{}});
  unknown.receive({id:999,sessionId:'unrouted',result:{}},undefined);unknown.flush();
  assert.equal(unmatched.at(-1).startup.events[0].kind,'unmatched-raw-reply');
  const broken=observer.create({write:()=>{throw Error('sink');},schedule:()=>{}});
  assert.equal(broken.send({requestId:1,method:'Target.setAutoAttach'},()=>42),42);broken.flush();
  const delayed=[],pending=new Map([[7,{method:'Target.setAutoAttach',sessionId:'page'}]]);
  let monotonic=100;
  const task=observer.create({write:v=>delayed.push(v),now:()=>monotonic,schedule:()=>{}});
  task.send({requestId:7,method:'Target.setAutoAttach',sessionId:'page'},()=>{});
  monotonic=20125;task.timeout(7,pending);task.flush();
  const overrun=delayed.at(-1).startup.events.find(v=>v.kind==='request-timeout');
  assert.equal(overrun.elapsedMs,20025);assert.equal(overrun.timerOverrunMs,25);
  assert.equal(delayed.at(-1).browserServiceTime,'UNKNOWN');assert.equal(pending.size,1);
  console.log('PASS old-missing/new-evidenced 9 actual health-composed startup pairs + sink failure; raw root/page routing, wrong session, timeout before deletion, context order, late raw reply; unchanged wire sequence and failure/cleanup; bounded/truncated/passive controls; OFFLINE');
}
async function scenario(mode,old){
  const dir=path.join(run,(old?'old-':'new-')+mode),staged=dir+'/staged';fs.mkdirSync(staged,{recursive:true});
  fs.writeFileSync(dir+'/watchdog-armed.json',JSON.stringify({scope:'inert child processes only',deadlineMs:12000,armedAt:Date.now()}));
  const child=cp.spawn(process.execPath,['--require',__filename,consumer],{cwd:root,env:{...process.env,
    Q2_STARTUP_CHILD:'1',Q2_STARTUP_OLD:old?'1':'',Q2_STARTUP_MODE:mode,Q2_NODE_FIXTURE:'preload',
    Q2_FIXTURE_DIR:dir,Q2_CLOSE_MODE:'normal',QUAKE2_NATIVE_RUN:staged,QUAKE2_NATIVE_COMPOSITION:'',Q2_INPUT_WIRE:'',BROWSER_DEADLINE:String(Date.now()+150000)},stdio:['ignore','pipe','pipe']});
  const guard=setTimeout(()=>{child.kill('SIGKILL');try{process.kill(Number(fs.readFileSync(dir+'/browser-pid')),'SIGKILL');}catch{}},12000);
  const logs=require('./native-command-log.cjs').createLogs(dir);logs.attach('stdout',child.stdout);logs.attach('stderr',child.stderr);
  try{
    const [code,signal]=await once(child,'close');await logs.drainStreams();logs.close();assert.equal(signal,null);assert.equal(code,1);
    const out=staged+'/original',failure=JSON.parse(fs.readFileSync(out+'/first-browser-failure.json'));
    const snapshots=z.gunzipSync(fs.readFileSync(out+'/input-wire.jsonl.gz')).toString().trim().split('\n').map(JSON.parse);
    const events=snapshots.at(-1).startup?.events??[];
    const protocol=fs.readFileSync(dir+'/startup-protocol.jsonl','utf8').trim().split('\n').map(JSON.parse);
    assert(!protocol.some(v=>v.method.startsWith('Input.')));assert(!fs.existsSync(out+'/ready.json'));
    assert(protocol.some(v=>v.method==='Browser.close'));assert(!protocol.some(v=>v.method==='Page.navigate'));
    const browser=JSON.parse(fs.readFileSync(dir+'/browser-wait.json'));assert.equal(browser.code,0);assert(browser.stdoutEOF&&browser.stderrEOF);
    assert(child.stdout.readableEnded&&child.stderr.readableEnded);
    if(mode!=='sink-fail'&&!old){assert.equal(snapshots.at(-1).startup.observerErrors,0);assert.equal(snapshots.at(-1).startup.dropped,0);assert.equal(snapshots.at(-1).observerErrors,0);}
    fs.writeFileSync(dir+'/result.json',JSON.stringify({mode,old,code,signal,failure,protocol,events,browser,stdoutEOF:true,stderrEOF:true}));
    return {failure,protocol,events};
  }finally{clearTimeout(guard);if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');}
}
