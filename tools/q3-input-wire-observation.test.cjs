'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),z=require('node:zlib');
const assert=require('node:assert/strict'),{once}=require('node:events');
const wire=require('./q3-input-wire-observation.cjs'),composition=require('./q3-native-driver-composition.cjs');
const root=path.resolve(__dirname,'..'),base=path.dirname(path.join(root,composition.consumerPath));
const run=path.resolve(process.env.Q3_WIRE_TEST_RUN||'scratch/runs/20261109-q3-input-wire-observation-1045/controller');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const json=file=>JSON.parse(fs.readFileSync(file));
const rows=file=>z.gunzipSync(fs.readFileSync(file)).toString().trim().split('\n').filter(Boolean).map(JSON.parse);
async function until(fn){const end=Date.now()+6000;while(!fn()){assert(Date.now()<end,'inert observation deadline');await wait(10);}}
if(process.env.Q3_WIRE_SOCKET_SEAM==='1'){
  if(process.env.Q3_WIRE_CASE==='sink-fail'){
    const create=wire.create;let failed=false;
    wire.create=options=>create({...options,write:value=>{if(!failed){failed=true;throw Error('FIRST inert diagnostic sink failure');}return options.write(value);}});
  }
  // Loaded after the existing inert external-service fixture. No real socket.
  const Socket=globalThis.WebSocket;
  globalThis.WebSocket=class extends Socket {
    set onmessage(handler){this.messageHandler=handler;}
    get onmessage(){return message=>{
      const value=JSON.parse(message.data);
      // The older inert fixture omitted flattened response session IDs. Model
      // the real protocol envelope here; production never supplies missing IDs.
      if(value.id&&value.sessionId===undefined&&this.sessions?.has(value.id))value.sessionId=this.sessions.get(value.id);
      this.messageHandler?.({data:JSON.stringify(value)});
    };}
    send(data,...args){
      const v=JSON.parse(data),mode=process.env.Q3_WIRE_CASE;
      assert.equal(args.length,0,'actual browser socket send has no callback');
      this.sessions??=new Map();if(v.sessionId)this.sessions.set(v.id,v.sessionId);
      if(v.method==='Input.dispatchKeyEvent'&&v.params.type==='keyDown'){
        if(mode==='sync-throw')throw Error('inert socket synchronous send throw');
        if(mode==='async-fail'){
          setTimeout(()=>this.dispatchEvent(new Event('error')),5);return;
        }
        if(mode==='raw-late'){
          setTimeout(()=>{
            // Same id with wrong session must not be correlated.
            this.onmessage?.({data:JSON.stringify({id:v.id,sessionId:'wrong-session',result:{}})});
            this.onmessage?.({data:JSON.stringify({id:v.id,sessionId:v.sessionId,result:{}})});
          },150);return;
        }
      }
      return super.send(data,...args);
    }
  };
}else if(require.main===module){
  (async()=>{
    fs.mkdirSync(run,{recursive:true});
    // Deferred sink work and sticky failure cannot enter the send promise or
    // prevent independent terminal cleanup. Capacity retains only bounded data.
    const queue=[],writes=[];let attempts=0,clock=0;
    const observer=wire.create({write:value=>{if(++attempts===1)throw Error('FIRST sink failure');writes.push(value);},now:()=>++clock,schedule:fn=>queue.push(fn),capacity:2,eventCap:8});
    const meta={requestId:1,method:'Input.dispatchKeyEvent',sessionId:'page'};
    assert.equal(observer.send(meta,()=>42),42);assert.equal(attempts,0);
    queue.shift()();assert.match(observer.status().sinkFailure,/FIRST sink failure/);
    observer.terminal('FIRST terminal');observer.terminal('SECOND terminal');
    observer.receive({id:1,sessionId:'page',result:{}},undefined);
    observer.flush();assert.match(writes.at(-1).sinkFailure,/FIRST sink failure/);
    assert.match(writes.at(-1).firstTerminal.reason,/FIRST terminal/);
    assert(writes.at(-1).events.some(e=>e.kind==='raw-matching-reply'&&e.late&&!e.pendingPresent));
    const thrown=Error('same send exception');assert.throws(()=>observer.send(meta,()=>{throw thrown;}),e=>e===thrown);
    for(let i=2;i<20;i++)observer.send({...meta,requestId:i},()=>{});
    assert(observer.status().records.length<=2);assert(observer.status().dropped>0);
    const source=composition.compose().source,integrated=wire.integrate(source);
    assert(!source.includes('inputWire.'));assert(integrated.includes('inputWire.receive(v,pending.get(v.id));screenshotCompletion.receive'));
    assert(integrated.indexOf('inputWire.receive(v,pending.get(v.id))')<integrated.indexOf('if(v.id){const p=pending.get(v.id);if(!p)return;'));
    new (require('node:vm').Script)(require('node:module').wrap(integrated));
    for(const mode of ['normal','sync-throw','async-fail','delayed-reply','stalled-down','independent-up','raw-late']){
      await scenario(mode,false);await scenario(mode,true);
    }
    await scenario('sink-fail',true);
    console.log('PASS 7 actual whole composed transport old-missing/new-present pairs; bounded deferred sticky sink, unchanged input delivery/100ms cap, raw late before discard; inert Node only');
  })().catch(error=>{console.error(error);process.exitCode=1;});
}
async function scenario(mode,enabled){
  const success=mode==='normal'||mode==='sink-fail';
  const name=(enabled?'new-':'old-')+mode,dir=path.join(run,name);fs.mkdirSync(dir,{recursive:true});
  const tag='offline-q3-wire-'+process.pid+'-'+name,out=base+'/'+tag;
  const args=[process.execPath,'--require',path.join(__dirname,'q3-native-driver-composition.test.cjs'),
    '--require',path.join(__dirname,'q3-native-driver-composition.cjs'),
    '--require',__filename,'--require',path.join(__dirname,'q3-input-wire-observation.cjs'),
    '--require',path.join(__dirname,'q3-execution-boundary.cjs'),path.join(root,composition.consumerPath)];
  const supervisor=`import subprocess,sys,json,os,signal,gzip
p=subprocess.Popen(json.loads(sys.argv[1]),start_new_session=True)
open(sys.argv[2]+'.pid','w').write(str(p.pid))
try:s=p.wait(timeout=12)
except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);s=p.wait()
open(sys.argv[2],'wb').write(gzip.compress(json.dumps(dict(actualWait=s,pid=p.pid)).encode()))
sys.exit(s if s>=0 else 128-s)
`;
  fs.writeFileSync(dir+'/watchdog-armed.json.gz',z.gzipSync(JSON.stringify({supervisorMs:12000,outerMs:14000,at:Date.now()})));
  const child=cp.spawn('python3',['-c',supervisor,JSON.stringify(args),dir+'/supervisor-wait.json.gz'],{cwd:root,
    env:{...process.env,Q3_NODE_FIXTURE:'preload',Q3_FIXTURE_DIR:dir,Q3_FIXTURE_DELAY:'5',Q3_NATIVE_COMPOSITION:'1',
      Q3_INPUT_CASE:['delayed-reply','stalled-down','independent-up'].includes(mode)?mode:'normal',
      Q3_WIRE_SOCKET_SEAM:'1',Q3_WIRE_CASE:mode,Q3_INPUT_WIRE:enabled?'1':'',CASE_TAG:tag,
      BROWSER_DEADLINE:String(Date.now()+150000),Q3_EXECUTION_BOUNDARY_OUT:dir+'/execution.jsonl.gz'},stdio:['ignore','pipe','pipe']});
  const logs=require('./native-command-log.cjs').createLogs(dir);logs.attach('stdout',child.stdout);logs.attach('stderr',child.stderr);
  const done=once(child,'close');
  const watchdog=setTimeout(()=>{try{process.kill(-Number(fs.readFileSync(dir+'/supervisor-wait.json.gz.pid')),'SIGKILL');}catch{}},14000);
  try{
    await until(()=>fs.existsSync(out+'/ready.json')||child.exitCode!==null);assert.equal(child.exitCode,null);
    const review=json(out+'/startup-capture.json');review.review='Inert Node bytes';fs.writeFileSync(out+'/startup-review.json',JSON.stringify(review));
    const transport=require(base+'/transport.cjs');
    const command=mode==='independent-up'?{action:'combo',keys:['a','Control'],holdMs:100}:{action:'key',key:'Enter',holdMs:100};
    const request=transport.request(out,'wire',{...command,waitMs:0,label:'after-input',reviewRef:'startup'},1).then(value=>({value}),error=>({error:String(error)}));
    await until(()=>fs.existsSync(out+'/consumed-wire'));
    await wait(220);
    if(success){
      assert((await request).value.ok);assert((await transport.request(out,'quit',{action:'quit'},1)).ok);
    }else{
      if(mode==='independent-up')fs.writeFileSync(dir+'/caller-cancelled.json','{}');
      await until(()=>fs.existsSync(out+'/first-transport-failure.json'));
      const first=fs.readFileSync(out+'/first-transport-failure.json','utf8');
      await assert.rejects(transport.request(out,'later-input',{action:'key',key:'Enter',holdMs:100,waitMs:0,label:'later',reviewRef:'startup'},1));
      await assert.rejects(transport.request(out,'later-capture',{action:'capture',waitMs:0,label:'later'},1));
      assert.equal(fs.readFileSync(out+'/first-transport-failure.json','utf8'),first);
      assert(!fs.existsSync(out+'/after-input.png'));assert(!fs.existsSync(out+'/reply-0.json'));
    }
    const [code,signal]=await done;await logs.drainStreams();logs.close();assert.equal(signal,null);assert.equal(code,success?0:1);
    const result=await request;assert(success?result.value.ok:result.error);
    const receipt=json(out+'/input-wire-delivery.json');assert.equal(receipt.holdMs,100);
    assert(receipt.releaseAt-receipt.started<250,'unchanged independent release origin');
    const protocol=rows(dir+'/protocol.jsonl.gz');
    if(mode==='independent-up')assert.deepEqual(protocol.filter(r=>r.method==='Input.dispatchKeyEvent').map(r=>r.params.type+':'+r.params.key),['keyDown:a','keyDown:Control','keyUp:Control','keyUp:a']);
    if(!success){
      const terminal=Date.parse(json(out+'/first-transport-failure.json').at);
      assert(!protocol.some(r=>r.at>terminal&&(r.method.startsWith('Input.')||r.method==='Page.captureScreenshot')));
    }
    let observed=[];
    if(enabled){
      const snapshots=rows(out+'/input-wire.jsonl.gz');observed=snapshots.flatMap(s=>s.events);
      assert(observed.some(e=>e.kind==='socket-send-entry'&&e.method==='Input.dispatchKeyEvent'&&Number.isInteger(e.requestId)&&e.sessionId==='node-protocol-session'&&Number.isFinite(e.nodeMonotonicMs)));
      assert(observed.some(e=>e.kind===(mode==='sync-throw'?'socket-send-throw':'socket-send-return')));
      if(mode==='normal')assert(observed.some(e=>e.kind==='raw-matching-reply'&&e.pendingPresent&&!e.late));
      if(mode==='async-fail')assert(observed.some(e=>e.kind==='socket-error'));
      if(mode==='raw-late'||mode==='delayed-reply'){
        if(mode==='raw-late')assert.equal(observed.filter(e=>e.kind==='raw-matching-reply'&&e.requestId===observed.find(e=>e.kind==='socket-send-entry').requestId).length,1,'wrong session never correlated');
        if(mode==='raw-late')assert(observed.some(e=>e.kind==='raw-matching-reply'&&e.late&&!e.pendingPresent));
      }
      if(mode==='stalled-down')assert(!observed.some(e=>e.kind==='raw-matching-reply'&&e.requestId===observed.find(e=>e.kind==='socket-send-entry').requestId));
      if(!success)assert.equal(observed.filter(e=>e.kind==='first-terminal').length,1);
      assert(snapshots.every(s=>s.browserServiceTime==='UNKNOWN'&&s.applicationTime==='UNKNOWN'));
      if(mode==='sink-fail')assert(snapshots.every(s=>/FIRST inert diagnostic sink failure/.test(s.sinkFailure)));
      else assert(snapshots.every(s=>s.sinkFailure===null));
    }else assert(!fs.existsSync(out+'/input-wire.jsonl.gz'),'old actual transport missing boundary observations');
    const browser=JSON.parse(z.gunzipSync(fs.readFileSync(dir+'/browser-actual-wait.json.gz')));assert.equal(browser.code,0);assert(browser.stdoutEOF&&browser.stderrEOF);
    fs.writeFileSync(dir+'/result.json.gz',z.gzipSync(JSON.stringify({passed:true,enabled,mode,observed,receipt,code,signal,browser,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded,scope:'actual composed transport with inert external seams; no native/application claim'})));
  }finally{
    clearTimeout(watchdog);
    if(child.exitCode===null&&child.signalCode===null){try{process.kill(-Number(fs.readFileSync(dir+'/supervisor-wait.json.gz.pid')),'SIGKILL');}catch{}}
    await done;
    if(fs.existsSync(out)){
      for(const name of fs.readdirSync(out)){const file=out+'/'+name;if(fs.statSync(file).isFile()){const bytes=fs.readFileSync(file);fs.writeFileSync(dir+'/consumer-'+name+(name.endsWith('.gz')?'':'.gz'),name.endsWith('.gz')?bytes:z.gzipSync(bytes));}}
      fs.rmSync(out,{recursive:true,force:true});
    }
  }
}
