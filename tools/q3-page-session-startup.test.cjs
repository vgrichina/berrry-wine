'use strict';
// Deterministic peer for the actual authenticated versioned runtime caller.
// This tests Node routing, not Chromium's renderer/Target implementation.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const Module=require('node:module'),assert=require('node:assert/strict');
const zlib=require('node:zlib'),crypto=require('node:crypto'),{once}=require('node:events');
const root=path.resolve(__dirname,'..'),route=require('./q3-current-foreign-closure-v1.cjs');
const current=require('./q3-current-module.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const save=(file,value)=>fs.writeFileSync(file,zlib.gzipSync(JSON.stringify(value,null,2)),{flag:'wx'});
// Exact retained browser frames, never a reconstruction of Chromium state.
// Replaying them tests the generated Node consumer only. ACK timing controls
// deliberately change delivery and cannot establish a browser-side cause.
function nativeFrames(){
  const file=root+'/scratch/runs/20261109-q3-raw-startup-evidence-1648/cancellation/recovered/939c96e8dd687c6541b5876e3e798af94b8032108a1795668b4f31bee1e16e5a.gz';
  const stored=fs.readFileSync(file);assert.equal(hash(stored),'939c96e8dd687c6541b5876e3e798af94b8032108a1795668b4f31bee1e16e5a');
  const raw=zlib.gunzipSync(stored);assert.equal(hash(raw),'8b3a6c9826416951b5e73c696f2b720fc146c7056cdb7bfa9649c2d5fcec646e');
  return raw.toString().trim().split('\n').map(JSON.parse);
}

if(process.env.Q3_PAGE_PEER_CHILD==='1'){
  const dir=process.env.Q3_PAGE_PEER_DIR,mode=process.env.Q3_PAGE_PEER_MODE;
  const consumer=path.join(root,require('./q3-native-driver-composition.cjs').consumerPath);
  const protocol=[],deliveries=[];let browser,request6,manualSession='manual-page',chainSession;
  const native=mode.startsWith('native-')?nativeFrames():null;
  if(native)manualSession=JSON.parse(native.find(v=>v.direction==='outbound'&&v.requestId===6).raw).sessionId;
  const originalSpawn=cp.spawn,load=Module._load;
  const compile=Module.prototype._compile;
  Module.prototype._compile=function(source,filename){
    if(filename===consumer){
      assert(source.includes('inputWire.receive(v,pending.get(v.id))'),'actual native input-wire hook installed');
      assert(source.includes('executionContextId:v.params.executionContextId'),'actual native cause hook installed');
      save(dir+'/installed-consumer.json.gz',{sha256:hash(Buffer.from(source)),bytes:Buffer.byteLength(source),
        inputWire:true,causeDiagnostic:true,sourceCopied:false});
    }
    return compile.call(this,source,filename);
  };
  cp.spawn=(command,args)=>{
    assert.equal(command,'/usr/bin/google-chrome','only the real production spawn seam');
    const profile=args.find(v=>v.startsWith('--user-data-dir=')).slice('--user-data-dir='.length);
    // The stand-in owns real stdio and profile state, but cannot launch Chrome.
    browser=originalSpawn(process.execPath,['-e',`
      const fs=require('node:fs'),p=process.argv[1];
      const cap=setTimeout(()=>process.exit(9),35000);
      fs.mkdirSync(p,{recursive:true});fs.writeFileSync(p+'/DevToolsActivePort','1\\n/devtools/browser/offline\\n');
      process.stdin.once('data',()=>{clearTimeout(cap);process.stdout.write('stand-in stopped\\n');process.stderr.write('stand-in EOF\\n');process.stdin.destroy();});
    `,profile],{stdio:['pipe','pipe','pipe']});
    browser.stdout.resume();browser.stderr.resume();
    browser.once('close',(code,signal)=>save(dir+'/browser-wait.json.gz',{
      pid:browser.pid,code,signal,stdoutEOF:browser.stdout.readableEnded,stderrEOF:browser.stderr.readableEnded,
      profileAbsent:!fs.existsSync(profile)}));
    fs.writeFileSync(dir+'/stand-in-pid',String(browser.pid));return browser;
  };
  Module._load=function(name,parent,main){
    if(name===root+'/test/static-server.js')return {startStaticServer:async()=>({
      address:()=>({port:1}),prependListener(){},closeAllConnections(){},close:fn=>fn()
    })};
    if(parent?.filename===consumer&&name==='./bound-input.cjs'){
      const bound=load.call(this,name,parent,main);
      return {...bound,createChain:options=>{chainSession=options.pageSession;return bound.createChain(options);}};
    }
    return load.call(this,name,parent,main);
  };
  globalThis.fetch=async url=>{
    const parsed=new URL(url);assert.equal(parsed.origin,'http://127.0.0.1:1');
    const file=path.resolve(root,'.'+parsed.pathname);assert(file.startsWith(root+'/'));
    const bytes=fs.readFileSync(file);return {status:200,arrayBuffer:async()=>bytes};
  };
  class Peer extends EventTarget{
    constructor(url){super();assert.equal(url,'ws://127.0.0.1:1/devtools/browser/offline');this.readyState=1;queueMicrotask(()=>this.onopen());}
    deliver(value){
      deliveries.push(value);const data=JSON.stringify(value);
      this.dispatchEvent(new MessageEvent('message',{data}));this.onmessage?.({data});
    }
    reply(q,result={},error){this.deliver({id:q.id,...(q.sessionId?{sessionId:q.sessionId}:{}),...(error?{error}:{result})});}
    attached(sessionId,waitingForDebugger=false){this.deliver({method:'Target.attachedToTarget',params:{
      sessionId,targetInfo:{targetId:'page-target',type:'page',url:'about:blank'},waitingForDebugger
    }});}
    send(raw){
      const q=JSON.parse(raw);protocol.push(q);
      assert(!q.method.startsWith('Input.')&&q.method!=='Page.captureScreenshot','no input/capture in startup peer');
      if(native&&q.id<=6){
        const start=native.findIndex(v=>v.direction==='outbound'&&v.requestId===q.id);
        assert(start>=0);assert.equal(raw,native[start].raw,'exact native outbound request');
        const batch=[];
        for(let i=start+1;i<native.length&&native[i].direction!=='outbound'&&native[i].direction!=='deadline';i++){
          assert.equal(native[i].direction,'inbound');batch.push(JSON.parse(native[i].raw));
        }
        const deliver=()=>{
          for(const frame of batch)this.deliver(frame);
          if(q.id===6){
            request6=q;
            const ack=JSON.parse(native.find(v=>v.direction==='inbound'&&v.requestId===6).raw);
            if(mode==='native-sync-ack')this.deliver(ack);
            if(mode==='native-task-ack')setImmediate(()=>this.deliver(ack));
          }
        };
        // Exercise reentrant delivery as well as the ordinary event-loop task.
        if(mode==='native-sync-ack')deliver();else setImmediate(deliver);
        return;
      }
      if(q.method==='Browser.getVersion')return queueMicrotask(()=>this.reply(q,{product:'OFFLINE_PEER'}));
      if(q.method==='Target.setAutoAttach'){
        assert.deepEqual(q.params,{autoAttach:true,waitForDebuggerOnStart:true,flatten:true});
        if(!q.sessionId){
          return queueMicrotask(()=>{
            if(!['single','event-after-root'].includes(mode))this.attached('auto-page',mode==='duplicate-paused');
            this.reply(q);
            if(mode==='event-after-root')this.attached('auto-page');
          });
        }
        assert.equal(q.id,6);assert.equal(q.sessionId,manualSession);request6=q;
        if(mode==='withheld-page-reply'||mode==='late-page-reply')return;
        if(mode==='page-protocol-error')return queueMicrotask(()=>this.reply(q,{}, {code:-32000,message:'OFFLINE_PAGE_REFUSAL'}));
        if(mode==='page-socket-close')return queueMicrotask(()=>this.dispatchEvent(new Event('close')));
        if(mode==='duplicate-page-reply')return queueMicrotask(()=>{
          this.reply(q);
          this.deliver({id:q.id,sessionId:'other-session',result:{duplicate:true}});
          this.deliver({id:8675309,sessionId:'unknown-session',error:{code:-32001,message:'UNMATCHED_PEER_ERROR'}});
        });
        return queueMicrotask(()=>this.reply(q));
      }
      if(q.method==='Target.getTargets')return queueMicrotask(()=>this.reply(q,{targetInfos:[{type:'page',targetId:'page-target',url:'about:blank'}]}));
      if(q.method==='Target.attachToTarget'){
        assert.deepEqual(q.params,{targetId:'page-target',flatten:true});
        return queueMicrotask(()=>{
          if(mode!=='event-after-manual')this.attached(manualSession);
          this.reply(q,{sessionId:manualSession});
          if(mode==='event-after-manual')this.attached(manualSession);
        });
      }
      if(q.method==='Page.addScriptToEvaluateOnNewDocument')return queueMicrotask(()=>this.reply(q,{}, {code:-32000,message:'OFFLINE_STOP_BEFORE_NAVIGATION'}));
      if(q.method==='Browser.close')return queueMicrotask(()=>{
        // Native raw evidence: close ACK precedes request 6's valid late ACK.
        // Neither ordering may revive the timed-out continuation.
        this.reply(q);if(mode==='late-page-reply')this.reply(request6);
        if(mode==='native-late-ack'){
          const close=native.findIndex(v=>v.direction==='inbound'&&v.method==='Browser.close');
          for(const frame of native.slice(close+1)){
            assert.equal(frame.direction,'inbound');this.deliver(JSON.parse(frame.raw));
          }
        }
        browser.stdin.end('close\n');
      });
      assert(['Target.setDiscoverTargets','Page.enable','Runtime.enable'].includes(q.method),q.method);
      queueMicrotask(()=>this.reply(q));
    }
    close(){this.readyState=3;}
  }
  globalThis.WebSocket=Peer;
  process.once('exit',code=>save(dir+'/peer.json.gz',{mode,code,protocol,deliveries,chainSession,
    firstFailure:fs.existsSync(dir+'/cancellation/prepared/runtime/first-browser-failure.json')?
      JSON.parse(fs.readFileSync(dir+'/cancellation/prepared/runtime/first-browser-failure.json')):null,
    nativeCause:'UNKNOWN',browserImplementation:'NOT_MODELLED',chromeStarted:false}));
}else if(require.main===module){
  main().catch(error=>{console.error(error);process.exitCode=1;});
}

async function main(){
  const out=path.resolve(process.argv[2]||'');assert(process.argv[2]&&out.startsWith(root+'/scratch/runs/'),'explicit owned run directory');
  assert(!fs.existsSync(out),'fresh test output');fs.mkdirSync(out,{recursive:true});
  const results=[];
  for(const mode of ['single','duplicate-before-root','event-after-root','event-after-manual','duplicate-paused','duplicate-page-reply',
    'page-protocol-error','page-socket-close','withheld-page-reply','late-page-reply',
    'native-sync-ack','native-task-ack','native-late-ack']){
    const dir=out+'/'+mode;fs.mkdirSync(dir);
    const inputs=[];
    const retained=root+'/scratch/runs/20261109-q3-preflighted-controller-arena-1615';
    for(const name of ['control.py','physical_gate.py','cancellation_gate.py','phase-input.py']){
      fs.copyFileSync(retained+'/'+name,dir+'/'+name);inputs.push(path.relative(root,dir+'/'+name));
    }
    const prepared=dir+'/prepared',seal=current.prepare(prepared,{foreignClosureVersion:route.version,
      checkpointObserverVersion:current.checkpointObserverVersion,nativeLifecycleVersion:require('./q3-versioned-native-lifecycle.cjs').version,
      inputs,caller:path.relative(root,dir+'/phase-input.py')});
    const runtime=dir+'/cancellation/prepared/runtime';fs.mkdirSync(path.dirname(runtime),{recursive:true});
    const raw=zlib.gunzipSync(fs.readFileSync(prepared+'/runtime-pins.json.gz'));
    assert.equal(hash(raw),seal.manifestSHA256);route.staged(prepared,route.version,hash(raw));
    // The exact generated entry and full actual setup run unmodified. The peer
    // stops successful startup with a protocol error BEFORE navigation/guest.
    const source=route.composition(route.version,prepared).compose().source;
    assert(source.includes('},20000);'),'production CDP deadline unchanged');
    save(dir+'/prepared-source.json.gz',{manifestSHA256:hash(raw),providers:seal.providers,
      fullSourceSHA256:hash(Buffer.from(source)),fullSourceBytes:Buffer.byteLength(source),sourceCopied:false});
    const env={...process.env,Q3_PAGE_PEER_CHILD:'1',Q3_PAGE_PEER_DIR:dir,Q3_PAGE_PEER_MODE:mode,
      BROWSER_DEADLINE:String(Date.now()+90000),Q3_EXECUTION_BOUNDARY_OUT:dir+'/boundary.jsonl.gz'};
    for(const key of ['Q3_NATIVE_COMPOSITION','Q3_NATIVE_PHASE','Q3_INPUT_WIRE','DRIVER_PREFLIGHT',
      'LOCAL_PRODUCTION_FIXTURE','TR2_GENERATED','WEBGL_QUALIFY','NO_ORIGINAL'])delete env[key];
    env.Q3_NATIVE_PHASE='cancellation';env.Q3_NATIVE_INPUT_CAUSE='1';env.Q3_INPUT_WIRE='1';
    const child=cp.spawn(process.execPath,['--require',__filename,prepared+'/q3-runtime-caller.cjs'],
      {cwd:root,env,stdio:['ignore','pipe','pipe']});
    const logs=require('./native-command-log.cjs').createLogs(dir);logs.attach('stdout',child.stdout);logs.attach('stderr',child.stderr);
    const guard=setTimeout(()=>{
      child.kill('SIGKILL');try{process.kill(Number(fs.readFileSync(dir+'/stand-in-pid')),'SIGKILL');}catch{}
    },40000);
    let code,signal;
    try{[code,signal]=await once(child,'close');await logs.drainStreams();logs.close();}
    finally{clearTimeout(guard);if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');}
    assert.equal(code,1);assert.equal(signal,null);assert(child.stdout.readableEnded&&child.stderr.readableEnded);
    const peer=JSON.parse(zlib.gunzipSync(fs.readFileSync(dir+'/peer.json.gz')));
    const installed=JSON.parse(zlib.gunzipSync(fs.readFileSync(dir+'/installed-consumer.json.gz')));
    assert(installed.inputWire&&installed.causeDiagnostic);
    const diagnostic=zlib.gunzipSync(fs.readFileSync(runtime+'/cdp-startup.jsonl.gz')).toString().trim().split('\n').map(line=>JSON.parse(line));
    const outbound=diagnostic.filter(v=>v.direction==='outbound');
    assert.deepEqual(outbound.map(v=>[v.requestId,v.method,v.sessionId]),peer.protocol.map(v=>[v.id,v.method,v.sessionId??null]));
    assert.deepEqual(outbound.map(v=>JSON.parse(v.raw)),peer.protocol,'exact outbound envelopes');
    const inbound=diagnostic.filter(v=>v.direction==='inbound');
    assert.deepEqual(inbound.map(v=>JSON.parse(v.raw)),peer.deliveries,'all exact raw frames retained before routing');
    const attachment=inbound.filter(v=>v.method==='Target.attachedToTarget');
    const native=mode.startsWith('native-')?nativeFrames():null;
    const manualSession=native?JSON.parse(native.find(v=>v.direction==='outbound'&&v.requestId===6).raw).sessionId:'manual-page';
    const target=native?JSON.parse(native.find(v=>v.direction==='outbound'&&v.requestId===5).raw).params.targetId:'page-target';
    if(native){
      assert.deepEqual(attachment.map(v=>JSON.parse(v.raw)),native.filter(v=>v.direction==='inbound'&&v.method==='Target.attachedToTarget').map(v=>JSON.parse(v.raw)));
      assert.deepEqual(attachment.map(v=>v.target.type),['page','browser_ui','browser_ui','page']);
      assert(attachment.every(v=>v.target.waitingForDebugger===false));
      assert.deepEqual(outbound.slice(0,6).map(v=>v.raw),native.filter(v=>v.direction==='outbound').slice(0,6).map(v=>v.raw));
      assert.equal(inbound.find(v=>v.requestId===6).matched,mode!=='native-late-ack');
    }else assert(attachment.every(v=>v.target.type==='page'&&v.target.url==='about:blank'&&typeof v.target.waitingForDebugger==='boolean'));
    const sent6=outbound.find(v=>v.requestId===6);assert.equal(sent6.target.type,'page');assert.equal(sent6.target.targetId,target);
    if(mode==='late-page-reply'||mode==='native-late-ack'){
      const late=inbound.find(v=>v.requestId===6);assert.equal(late.matched,false);assert.equal(late.knownRequest,true);
      assert.equal(late.method,'Target.setAutoAttach');assert.equal(late.requestSessionId,manualSession);
      assert(diagnostic.some(v=>v.direction==='deadline'&&v.requestId===6));
      assert(inbound.findIndex(v=>v.requestId===6)>inbound.findIndex(v=>v.method==='Browser.close'),'native close-ACK then late page-ACK order');
    }
    if(mode==='duplicate-page-reply'){
      const replies=inbound.filter(v=>v.requestId===6);assert.equal(replies.length,2);
      assert.equal(replies[0].matched,true);assert.equal(replies[1].matched,false);assert.equal(replies[1].sessionId,'other-session');
      const unknown=inbound.find(v=>v.requestId===8675309);assert.equal(unknown.knownRequest,false);assert.equal(unknown.matched,false);
      assert.equal(unknown.error.message,'UNMATCHED_PEER_ERROR');
    }
    if(mode==='page-protocol-error')assert.equal(inbound.find(v=>v.requestId===6).error.message,'OFFLINE_PAGE_REFUSAL');
    const waited=JSON.parse(zlib.gunzipSync(fs.readFileSync(dir+'/browser-wait.json.gz')));
    assert.equal(waited.code,0);assert.equal(waited.signal,null);assert(waited.stdoutEOF&&waited.stderrEOF);
    assert(!fs.existsSync(runtime+'/chrome-profile'),'physical profile removed after close');
    assert.equal(peer.chainSession,manualSession);
    const attached=peer.deliveries.filter(v=>v.method==='Target.attachedToTarget');
    assert.equal(new Set(attached.map(v=>v.params.sessionId)).size,native?4:mode==='single'?1:2);
    if(!native)assert(attached.every(v=>v.params.targetInfo.targetId==='page-target'));
    const methods=peer.protocol.map(q=>q.method),prefix=['Browser.getVersion','Target.setDiscoverTargets',
      'Target.setAutoAttach','Target.getTargets','Target.attachToTarget','Target.setAutoAttach'];
    assert.deepEqual(methods.slice(0,6),prefix);assert.deepEqual(peer.protocol.slice(0,6).map(q=>q.id),[1,2,3,4,5,6]);
    const timedOut=mode==='withheld-page-reply'||mode==='late-page-reply'||mode==='native-late-ack';
    const terminal=mode==='page-protocol-error'||mode==='page-socket-close'||timedOut;
    assert.deepEqual(methods,terminal?[...prefix,'Browser.close']:[...prefix,'Page.enable','Runtime.enable','Page.addScriptToEvaluateOnNewDocument','Browser.close']);
    if(timedOut)assert.match(peer.firstFailure.error,/CDP UNKNOWN Target.setAutoAttach; no replay/);
    else if(mode==='page-socket-close')assert.match(peer.firstFailure.error,/CDP close/);
    else if(mode==='page-protocol-error')assert.match(peer.firstFailure.error,/OFFLINE_PAGE_REFUSAL/);
    else assert.match(peer.firstFailure.error,/OFFLINE_STOP_BEFORE_NAVIGATION/);
    assert(!methods.includes('Page.navigate'));assert(!fs.existsSync(runtime+'/ready.json'));
    const result={mode,code,signal,methods,manualPageSession:peer.chainSession,
      browserWait:waited,stdoutEOF:true,stderrEOF:true,nativeCause:'UNKNOWN',nativeQualified:false};
    save(dir+'/result.json.gz',result);results.push(result);console.log('PASS '+mode);
  }
  save(out+'/result.json.gz',{passed:true,results,nativeCause:'UNKNOWN',
    conclusion:'Duplicate page sessions do not by themselves break Node routing; withholding the page reply reproduces the symptom but supplies no browser-side cause.'});
}
