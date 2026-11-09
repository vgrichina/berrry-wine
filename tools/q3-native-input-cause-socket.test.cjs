'use strict';
// Execute the actual generated consumer, compiled fixture, physical handlers,
// console receiver and transport. Only browser/graphics/guest service is inert.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const Module=require('node:module'),assert=require('node:assert/strict'),z=require('node:zlib');
const {once}=require('node:events');
const root=path.resolve(__dirname,'..'),composition=require('./q3-native-driver-composition.cjs');
const diagnostic=require('./q3-native-input-cause-diagnostic.cjs');
const base=path.dirname(path.join(root,composition.consumerPath));
const read=p=>JSON.parse(fs.readFileSync(p));
const rows=p=>z.gunzipSync(fs.readFileSync(p)).toString().trim().split('\n').filter(Boolean).map(JSON.parse);

if(process.env.Q3_CAUSE_SOCKET_PRELOAD==='1') {
  assert.equal(process.env.Q3_NODE_FIXTURE,'preload','inert browser interception required');
  const mode=process.env.Q3_CAUSE_SOCKET_CASE,dir=process.env.Q3_FIXTURE_DIR;
  const load=Module._load,Socket=globalThis.WebSocket;
  const compile=Module.prototype._compile;
  Module.prototype._compile=function(source,name) {
    if(name===path.join(base,'local-controls.cjs')) {
      const before=source;
      if(mode.startsWith('old-'))source=composition.replaceOnce(source,' request.catch(()=>{});\n','');
      const sha=v=>require('node:crypto').createHash('sha256').update(v).digest('hex');
      fs.writeFileSync(dir+'/controls-source.json',JSON.stringify({before:sha(before),executed:sha(source),
        onlyOldDifference:mode.startsWith('old-')?'omit immediate ACK rejection observer':'none'}));
    }
    return compile.call(this,source,name);
  };
  let socket,page;const emitted=[],withheld=[];
  const save=()=>fs.writeFileSync(dir+'/page-observations.json',JSON.stringify({mode,emitted,withheld}));
  function consoleMessage(...args) {
    const packet={method:'Runtime.consoleAPICalled',sessionId:'node-protocol-session',
      params:{executionContextId:1,type:'debug',args:args.map(value=>({value}))}};
    if(args[0]===diagnostic.MARKER) {
      const marker=JSON.parse(args[1]);emitted.push(marker);
      if(mode==='hidden-stalled'&&marker.phase!=='installed'){withheld.push(packet);save();return;}
    }
    const event=new MessageEvent('message',{data:JSON.stringify(packet)});
    socket.dispatchEvent(event);socket.onmessage?.(event);save();
  }
  Module._load=function(name,parent,main) {
    const loaded=load.call(this,name,parent,main);
    if(name!=='./q3-fixture-input.test.cjs')return loaded;
    return {...loaded,createPage:async result=>{
      // Use the exact body produced by the real CLI preload chain, rather
      // than assuming compose() is what the compiled fixture executes.
      let compiled;
      Module._extensions['.cjs']({_compile(source){compiled=source;}},path.join(root,composition.fixturePath));
      assert.equal(compiled,diagnostic.fixtureSource(result.fixtureSource));
      page=await loaded.createPage({...result,fixtureSource:compiled},{pageConsole:{debug:consoleMessage}});
      return page;
    }};
  };
  globalThis.WebSocket=class extends Socket {
    constructor(...args){super(...args);socket=this;}
    send(text) {
      const v=JSON.parse(text);
      if(v.method==='Input.dispatchKeyEvent') {
        assert.equal(v.sessionId,'node-protocol-session');
        assert.equal(v.params.windowsVirtualKeyCode,13);
        assert(['keyDown','keyUp'].includes(v.params.type));
        if(mode.endsWith('stalled')) {
          // Service the real DOM/renderer callback but withhold both protocol
          // replies. This is a controlled alternative cause, never a native ACK.
          page.dispatch(v.params,'full-new');
          const renderer=page.scope.__fixture.wine.renderer;
          fs.appendFileSync(dir+'/physical.jsonl',JSON.stringify({type:v.params.type,
            physical:renderer.peekKeyDownState(13),queue:renderer.inputQueue.length})+'\n');
          return;
        }
      }
      return super.send(text);
    }
  };
} else if(require.main===module) {
  main().catch(error=>{console.error(error);process.exitCode=1;});
}

async function until(fn) {
  const end=Date.now()+8000;
  while(Date.now()<end){if(fn())return;await new Promise(r=>setTimeout(r,10));}
  throw Error('offline generated consumer deadline');
}
async function scenario(run,mode) {
  const dir=path.join(run,mode);fs.mkdirSync(dir,{recursive:true});
  const tag='offline-cause-'+process.pid+'-'+mode,out=path.join(base,tag);
  const args=[process.execPath,'--require',path.join(__dirname,'q3-native-driver-composition.test.cjs'),
    '--require',__filename,'--require',path.join(__dirname,'q3-native-driver-composition.cjs'),
    '--require',path.join(__dirname,'q3-native-input-cause-diagnostic.cjs'),
    '--require',path.join(__dirname,'q3-input-wire-observation.cjs'),
    '--require',path.join(__dirname,'q3-execution-boundary.cjs'),path.join(root,composition.consumerPath)];
  const supervisor="import ctypes,subprocess,sys,json,os,signal,time\nassert ctypes.CDLL(None).prctl(36,1,0,0,0)==0\np=subprocess.Popen(json.loads(sys.argv[1]),start_new_session=True)\ndeadline=time.monotonic()+12\ntry:s=p.wait(timeout=12)\nexcept subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);s=p.wait()\nreaped=[]\nwhile True:\n try:\n  pid,st=os.waitpid(-1,os.WNOHANG)\n  if pid:reaped.append(dict(pid=pid,status=st))\n  elif time.monotonic()>deadline:\n   try:os.killpg(p.pid,signal.SIGKILL)\n   except ProcessLookupError:pass\n   time.sleep(.01)\n  else:time.sleep(.01)\n except ChildProcessError:break\nopen(sys.argv[2],'w').write(json.dumps(dict(actualWait=s,adoptedReaped=reaped)))\nsys.exit(s if s>=0 else 128-s)\n";
  fs.writeFileSync(dir+'/watchdog-armed.json',JSON.stringify({independentSupervisorMs:12000}));
  const child=cp.spawn('python3',['-c',supervisor,JSON.stringify(args),dir+'/wait.json'],{cwd:root,
    env:{...process.env,Q3_NODE_FIXTURE:'preload',Q3_FIXTURE_DIR:dir,Q3_FIXTURE_DELAY:'5',
      Q3_CAUSE_SOCKET_PRELOAD:'1',Q3_CAUSE_SOCKET_CASE:mode,Q3_NATIVE_INPUT_CAUSE:'1',
      Q3_PHYSICAL_CASE:'full-new',Q3_FULL_FIXTURE:'1',RENDER_BACKEND:'webgl',Q3_INPUT_WIRE:'1',
      Q3_NATIVE_COMPOSITION:'1',LOCAL_PRODUCTION_FIXTURE:'1',Q3_NATIVE_JOINED_FIXTURE:'1',
      CASE_TAG:tag,BROWSER_DEADLINE:String(Date.now()+150000),Q3_EXECUTION_BOUNDARY_OUT:dir+'/execution.jsonl.gz'},
    stdio:['ignore','pipe','pipe']});
  const logs=require('./native-command-log.cjs').createLogs(dir);
  logs.attach('stdout',child.stdout);logs.attach('stderr',child.stderr);
  const done=once(child,'close');
  try {
    await until(()=>fs.existsSync(out+'/fixture-complete-awaiting-quit.json')||child.exitCode!==null);
    const positive=mode==='normal';
    if(positive) {
      assert.equal(child.exitCode,null);
      assert(read(out+'/local-controls.json').rows.every(v=>v.passed&&v.dispatch===0));
      assert.equal(read(out+'/local-controls.json').rows.length,9);
      assert.equal(read(out+'/reply-0.json').id,'positive-webgl');
      assert.equal(read(out+'/input-positive-webgl-hold.json').fixturePhysicalGate,'PASS');
      const reply=await require(base+'/transport.cjs').request(out,'ordinary_quit',{action:'quit'},55000);
      assert(reply.ok);await done;assert.equal(child.exitCode,0);
      assert(read(out+'/reply-1.json').ok);
    } else {
      await done;assert.equal(child.exitCode,1);
      const failure=fs.readFileSync(out+'/first-transport-failure.json','utf8');
      assert.match(failure,/DOWN reply UNKNOWN/);
      assert(!fs.existsSync(out+'/reply-0.json'));
      assert(!fs.existsSync(out+'/positive.png'));
      assert(!fs.existsSync(out+'/local-controls.json'));
      const physical=rows(dir+'/physical.jsonl.gz');
      assert.deepEqual(physical.map(v=>[v.type,v.physical]),[['keyDown',32768],['keyUp',0]]);
      assert.equal(fs.readFileSync(out+'/first-transport-failure.json','utf8'),failure);
    }
    await logs.drainStreams();logs.close();
    const observed=read(dir+'/page-observations.json');
    const phases=diagnostic.boundaries(rows(out+'/console.jsonl.gz'))[0].events.map(v=>v.phase);
    const expected=['installed','dom-capture','renderer-handler-entry','renderer-handler-return',
      'dom-capture','renderer-handler-entry','renderer-handler-return'];
    assert.deepEqual(observed.emitted.map(v=>v.phase),expected);
    assert.deepEqual(phases,mode==='hidden-stalled'?['installed']:expected);
    const wire=rows(out+'/input-wire.jsonl.gz').flatMap(v=>v.events);
    const inputs=wire.filter(v=>v.kind==='socket-send-entry');
    assert.equal(inputs.length,2,'one DOWN and independent UP');
    assert(inputs.every(v=>v.sessionId==='node-protocol-session'));
    assert.equal(wire.filter(v=>v.kind==='raw-matching-reply').length,positive?2:0);
    if(!positive) {
      assert.equal(rows(out+'/input-wire.jsonl.gz').find(v=>v.firstTerminal).firstTerminal.reason.includes('DOWN reply UNKNOWN'),true);
      const terminal=Date.parse(read(out+'/first-transport-failure.json').at);
      const protocol=rows(dir+'/protocol.jsonl.gz');
      assert(!protocol.some(v=>v.at>terminal&&(v.method.startsWith('Input.')||v.method==='Page.captureScreenshot')));
    }
    if(mode.startsWith('old-')) {
      assert.match(z.gunzipSync(fs.readFileSync(dir+'/stderr.gz')).toString(),/Error: runtime first fault/);
      assert(!fs.existsSync(out+'/terminal-browser.json'),'old actual controls exit before joined close');
      assert(read(dir+'/wait.json').adoptedReaped.length>0,'independent supervisor actually reaps orphaned Node children');
      fs.writeFileSync(dir+'/result.json',JSON.stringify({passed:true,expectedOldFailure:true,
        mode,phases,actualWait:child.exitCode,normalJoinedClose:false,nativeCause:'UNKNOWN'}));
      return;
    }
    const browser=JSON.parse(z.gunzipSync(fs.readFileSync(dir+'/browser-actual-wait.json.gz')));
    assert.equal(browser.code,0);assert(browser.stdoutEOF&&browser.stderrEOF);
    const terminal=read(out+'/terminal-browser.json');assert(terminal.normal&&terminal.drained);
    fs.writeFileSync(dir+'/result.json',JSON.stringify({passed:true,mode,phases,emitted:expected,
      actualWait:child.exitCode,normalJoinedClose:true,stdoutEOF:child.stdout.readableEnded,
      stderrEOF:child.stderr.readableEnded,nativeCause:'UNKNOWN',scope:'inert actual full generated consumer/fixture'}));
  } finally {
    await done;
    if(fs.existsSync(out)) {
      for(const name of fs.readdirSync(out)) {
        const p=path.join(out,name);
        if(fs.statSync(p).isFile())fs.writeFileSync(dir+'/consumer-'+name+(name.endsWith('.gz')?'':'.gz'),
          name.endsWith('.gz')?fs.readFileSync(p):z.gzipSync(fs.readFileSync(p)));
      }
      fs.rmSync(out,{recursive:true,force:true});
    }
  }
}
async function main() {
  assert(process.env.Q3_CAUSE_SOCKET_TEST_RUN,'unique run output required');
  const run=path.resolve(process.env.Q3_CAUSE_SOCKET_TEST_RUN);
  // Exercise all capture listeners in the whole compiled fixture, including
  // refusal and sink controls that the former one-listener harness discarded.
  const compiled=diagnostic.fixtureSource(composition.compose().fixtureSource);
  for(const mode of ['normal','untrusted','stale','throw','sink','cap']) {
    const logs=[];
    const page=await require('./q3-fixture-input.test.cjs').createPage({fixtureSource:compiled},
      {pageConsole:{debug(...args){if(mode==='sink')throw Error('inert console sink');
        logs.push({session:'page',executionContextId:1,args});}}});
    const renderer=page.scope.__fixture.wine.renderer;
    if(mode==='stale')page.scope.__fixture.wine.running=false;
    if(mode==='throw')renderer._seedKeyboardFocus=()=>{throw Error('inert production callback exception');};
    page.dispatch({type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13},mode);
    const groups=diagnostic.boundaries(logs),events=groups[0]?.events||[];
    if(mode==='sink')assert.equal(groups.length,0);
    else {
      assert.equal(events.filter(v=>v.phase==='dom-capture').length,1);
      assert.equal(events.filter(v=>v.phase==='renderer-handler-entry').length,
        ['untrusted','stale'].includes(mode)?0:1);
    }
    if(mode==='throw')assert.equal(groups[0].lastProvenBoundary,'synchronous renderer handler threw');
    if(['untrusted','stale','throw'].includes(mode))assert.equal(renderer.peekKeyDownState(13),0);
    else assert.equal(renderer.peekKeyDownState(13),32768);
    if(mode==='cap') {
      for(let i=0;i<100;i++)page.dispatch({type:'keyUp',key:'Enter',windowsVirtualKeyCode:13},mode);
      assert.equal(logs.length,64);assert.equal(renderer.peekKeyDownState(13),0);
    }
  }
  for(const mode of ['old-visible-stalled','normal','visible-stalled','hidden-stalled'])await scenario(run,mode);
  console.log('PASS actual CLI/compiled generated fixture/production handlers/socket console: old unhandled ACK rejection exits before joined close; new same first failure joins; normal full controls+ACK0+quit; visible and hidden console with identical serviced DOWN/independent UP and absent replies; same installed-only record is not proof of missing DOM');
}
