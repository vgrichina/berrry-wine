'use strict';
// Explicit native fixture modes only. Importing this file launches nothing.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const crypto=require('node:crypto'),cp=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function authoredPE(){
  const bytes=require('./test-gta2-browser-release-scene-binding.cjs').authoredPE();
  const raw=rva=>rva-0x1000+0x400,base=0x400000;
  const title='Native input binding fixture DOWN=0 UP=0 QUIT=0';
  bytes.fill(0,raw(0x3060),raw(0x30c0));bytes.write(title+'\0',raw(0x3060));
  bytes.write(title+'\0',raw(0x3340));
  let slot=0;while(bytes.readUInt32LE(raw(0x1300+slot*4)))slot++;
  assert.equal(slot,11);bytes.writeUInt32LE(0x1e00,raw(0x1300+slot*4));
  bytes.write('SetWindowTextA\0',raw(0x1e02));
  const code=[],labels=new Map(),fixups=[];
  const u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
  const emit=(...b)=>code.push(...b),label=n=>labels.set(n,code.length);
  const jump=(n,op)=>{emit(...(op?[0x0f,op]:[0xe9]));fixups.push({at:code.length,n});emit(0,0,0,0);};
  emit(0x55,0x89,0xe5,0x8b,0x45,0x08);
  for(const [name,rva]of [['down',0x3280],['up',0x32c0],['quit',0x3300]]){
    emit(0x3d,...u32(base+rva));jump(name,0x84);
  }
  jump('return');
  for(const [name,token]of [['down','DOWN='],['up','UP='],['quit','QUIT=']]){
    label(name);emit(0xfe,0x05,...u32(base+0x3340+title.indexOf(token)+token.length));jump('paint');
  }
  label('paint');emit(0x68,...u32(base+0x3340),0xff,0x35,...u32(base+0x3540),
    0xff,0x15,...u32(base+0x1300+slot*4));
  label('return');emit(0x5d,0xc2,0x04,0x00);
  const shim=Buffer.from(code);
  for(const f of fixups)shim.writeInt32LE(labels.get(f.n)-f.at-4,f.at);
  assert(shim.length<0x200);shim.copy(bytes,raw(0x2800));
  const old=Buffer.from([0xff,0x15,...u32(base+0x1204)]);let changed=0;
  for(let at=raw(0x2600);at<raw(0x2800);at++)if(bytes.subarray(at,at+6).equals(old)){
    bytes[at]=0xe8;bytes.writeInt32LE(raw(0x2800)-at-5,at+1);bytes[at+5]=0x90;changed++;
  }
  assert.equal(changed,3);return bytes;
}
function sourcePins(controller){
  const files=['host.js','index.html',...fs.readdirSync(path.join(ROOT,'lib')).filter(n=>n.endsWith('.js')).map(n=>'lib/'+n),
    'tools/gta2-browser-release-binding.cjs','tools/gta2-paired-controller.cjs',controller.HELPER,
    'test/test-gta2-fresh-attestation-prearm.cjs','test/test-gta2-browser-release-scene-binding.cjs','build/wine-assembly.wasm'];
  return {files:files.map(p=>({path:p,sha256:sha(fs.readFileSync(path.join(ROOT,p)))})),
    modules:[sha(fs.readFileSync(path.join(ROOT,'build/wine-assembly.wasm')))]};
}
async function browserFixture(out,mode,{dlls=false,prepareDebugger=false,tamperSource=false}={}){
  assert(path.isAbsolute(out));assert(['main','worker'].includes(mode));
  fs.mkdirSync(out,{recursive:true});
  const watch=JSON.parse(fs.readFileSync(path.join(out,'..','watchdog-armed.json')));
  const launch=JSON.parse(fs.readFileSync(path.join(out,'..','launch.json')));
  assert(watch.independent===true&&watch.deadline*1000>Date.now()&&launch.deadline*1000>Date.now(),
    'observable independent watchdog must be armed before native/browser launch');
  assert(watch.pid>1);process.kill(watch.pid,0);
  const controller=require('../tools/gta2-paired-controller.cjs');
  const native=require('../tools/gta2-browser-release-binding.cjs');
  const previous=require('./test-gta2-browser-release-scene-binding.cjs');
  const helper=require(path.join(ROOT,controller.HELPER));
  const record=(name,value)=>fs.writeFileSync(path.join(out,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
  const append=(name,value)=>fs.appendFileSync(path.join(out,name),JSON.stringify(value)+'\n');
  // One small authored run input; Git stores its generator, not a source or
  // game-media archive. Native counters use public SetWindowTextA, so no
  // private counter reads or foreign OutputDebugString implementation is used.
  const fixtureFile=path.resolve(out,'..','..','authored-native-input.exe');
  const fixture=path.relative(ROOT,fixtureFile),fixtureBytes=authoredPE();
  if(!fs.existsSync(fixtureFile))fs.writeFileSync(fixtureFile,fixtureBytes,{flag:'wx'});
  assert.equal(sha(fs.readFileSync(fixtureFile)),sha(fixtureBytes));
  const pins=sourcePins(controller);pins.files.push({path:fixture,sha256:sha(fixtureBytes)});record('pins.json',pins);
  const app='fresh_attestation_native_fixture',workers=new Map(),tasks=[],http=[],scripts=new Map(),consoleEvents=[],pageScripts=[];
  let server,browser,joined,c,session,bridgeOptions,latest,owner,url,targetId,startToken;
  const evaluate=(expression,s=session)=>native.evaluate(c,s,expression);
  async function diagnostic(){
    const state=await evaluate(`(()=>{const w=globalThis.__freshAttestationFixtureOwner;if(!w)return null;return {
      running:w.running,stopped:!!w._stopped,exited:w._processObject?.exited===true,
      processId:w.processId,physicalKeys:{...w.renderer._physicalKeys},
      queueLength:w.renderer.inputQueue?.length,windows:Object.values(w.renderer.windows).map(win=>({hwnd:win.hwnd,title:win.title})),log:document.getElementById('log')?.textContent?.slice(-14000)}})()`);
    const title=state.windows.find(win=>/DOWN=\d+ UP=\d+ QUIT=\d+/.test(win.title||''))?.title;
    const counts=title?.match(/DOWN=(\d+) UP=(\d+) QUIT=(\d+)/);
    return {...state,console:consoleEvents.slice(-100),nativeCounters:counts?
      {down:Number(counts[1]),up:Number(counts[2]),quit:Number(counts[3]),publicWindowTitle:title}:null};
  }
  async function capture(label){
    assert(/^[a-z0-9-]+$/.test(label));
    for(const suffix of ['.png','.json'])assert(!fs.existsSync(path.join(out,label+suffix)),'fresh capture name');
    native.verifyPins(pins);
    await c.send('Page.bringToFront',{},session);
    await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    const before=await evaluate('__gta2NativeReleasePageV1.read()'),capturedAt=Date.now();
    const png=Buffer.from((await c.send('Page.captureScreenshot',{format:'png'},session)).data,'base64');
    const after=await evaluate('__gta2NativeReleasePageV1.read()');assert.deepEqual(before,after);
    fs.writeFileSync(path.join(out,label+'.png'),png,{flag:'wx'});
    latest={label,review:{...after,capturedAt,pngSHA256:sha(png)},diagnostic:await diagnostic()};
    record(label+'.json',latest);owner??={processId:latest.review.native.context.processId};
    return latest;
  }
  async function authoredFault(name,intent){
    // These mutations are confined to this independently authored PE/browser.
    // No original game, shared source file or binary is changed.
    if(name==='replace-page-owner')return evaluate('runningApps[0].wine={...runningApps[0].wine};true');
    if(name==='replace-renderer')return evaluate('runningApps[0].wine.renderer={...runningApps[0].wine.renderer};true');
    if(name==='replace-module')return evaluate('runningApps[0].wine._wasmModule={};true');
    if(name==='replace-handler')return evaluate('runningApps[0].wine.renderer.handleKeyDown=function authoredReplacement(){};true');
    if(name==='replace-queue')return evaluate('runningApps[0].wine.renderer.inputQueue=[];true');
    if(name==='replace-context')return evaluate(`(()=>{const w=runningApps[0].wine;w.instance=Object.create(w.instance);return true;})()`);
    if(name==='replace-worker')return evaluate('runningApps[0].wine.guestWorker.link.worker={};true');
    if(name==='retire-owner')return evaluate('runningApps[0].wine._stopped=true;true');
    if(name==='replace-endpoint')return evaluate('runningApps[0].wine.guestWorker.link.endpointIdentity=-123;true');
    if(name==='replace-source'){
      const target=mode==='worker'?[...workers.values()].find(w=>w.url.includes('guest-worker')):{sessionId:session};
      assert(target);await c.send('Debugger.enable',{},target.sessionId);
      const list=scripts.get(target.sessionId)||[];
      const script=list.find(s=>s.url.includes(mode==='worker'?'/lib/guest-worker.js':'/lib/renderer-input.js'));
      assert(script,'current executed fixture source');
      const source=await c.send('Debugger.getScriptSource',{scriptId:script.scriptId},target.sessionId);
      const result=await c.send('Debugger.setScriptSource',{scriptId:script.scriptId,
        scriptSource:source.scriptSource+'\n// authored fresh-attestation source replacement\n'},target.sessionId);
      assert(!result.exceptionDetails&&(!result.status||result.status==='Ok'));return result;
    }
    if(name==='focus-change'){
      const expression='instance.exports.set_focus(instance.exports.get_main_hwnd());true';
      if(mode==='main')return evaluate('(()=>{const instance=runningApps[0].wine.instance;'+expression+'})()');
      const worker=[...workers.values()].find(w=>w.url.includes('guest-worker'));assert(worker);
      return evaluate(expression,worker.sessionId);
    }
    if(name==='bind-after-arm')return evaluate(`__gta2NativeReleasePageV1.bind(${JSON.stringify(intent.review)})`);
    if(name==='duplicate-arm')return evaluate(`__gta2NativeReleasePageV1.arm(${JSON.stringify(intent.arm)})`);
    if(name==='reload')return c.send('Page.reload',{},session);
    throw Error('unknown authored native fault '+name);
  }
  try{
    native.verifyPins(pins);
    const tamperPath=mode==='worker'?'/lib/guest-worker.js':'/lib/renderer-input.js';
    const staticServer=require('./static-server.js');
    server=await staticServer.startStaticServer({root:ROOT,crossOriginIsolated:true,
      rewritePath:p=>p.startsWith('/binaries/')?'/test'+p:p,
      handleRequest:async(req,res)=>{
        const name=new URL(req.url,'http://127.0.0.1').pathname;
        const altered=tamperSource&&name===tamperPath;
        // The source-view preload intercepts readFileSync, not file streams.
        // Serve text through that view when explicitly testing HEAD+owned.
        const sourceView=process.env.GTA2_VIEW_HEAD&&/\.(?:js|html|json|css|wat|watx)$/.test(name);
        if(!altered&&!sourceView)return false;
        const resolved=await staticServer.resolveStaticPath(ROOT,req.url);
        if(resolved.status!==200)return false;
        const body=fs.readFileSync(resolved.file,'utf8')+(altered?
          '\n// AUTHORED source-replacement control; shared source is unchanged\n':'');
        res.writeHead(200,{'Content-Type':staticServer.mimeType(resolved.file),'Cache-Control':'no-store'});
        res.end(body);return true;
      }});
    server.prependListener('request',(req,res)=>{
      const chunks=[],write=res.write,end=res.end;
      res.write=function(b){if(b)chunks.push(Buffer.from(b));return write.apply(this,arguments);};
      res.end=function(b){if(b)chunks.push(Buffer.from(b));return end.apply(this,arguments);};
      res.once('finish',()=>http.push({url:req.url,status:res.statusCode,sha256:sha(Buffer.concat(chunks))}));
    });
    browser=cp.spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--no-first-run',
      '--no-default-browser-check','--disable-dev-shm-usage','--enable-unsafe-swiftshader',
      '--window-size=1024,900','--remote-debugging-port=0','--user-data-dir='+out+'/profile','about:blank'],
      {stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='';browser.stdout.on('data',b=>stdout+=b);browser.stderr.on('data',b=>stderr+=b);
    joined=new Promise(resolve=>browser.once('close',(code,signal)=>{
      record('chrome-wait.json',{pid:browser.pid,code,signal,actualWait:true,
        stdoutEOF:browser.stdout.readableEnded,stderrEOF:browser.stderr.readableEnded,stdout,stderr});resolve();
    }));
    const stat=fs.readFileSync('/proc/'+browser.pid+'/stat','utf8');startToken=stat.slice(stat.lastIndexOf(')')+2).split(' ')[19];
    record('chrome-pid.json',{pid:browser.pid,startToken});
    const end=Date.now()+3000;
    while(!(url=controller.devtoolsEndpoint(out+'/profile/DevToolsActivePort'))){
      assert(Date.now()<end);assert.equal(browser.exitCode,null);await pause(20);
    }
    c=controller.connection(url,v=>record('UNKNOWN.json',v));await c.ready;
    record('browser-version.json',await c.send('Browser.getVersion'));
    const send=c.send;c.send=(method,params={},sid)=>{
      const at=Date.now();append('parent-requests.jsonl',{method,type:params.type??null,at,closed:c.closed});
      return send(method,params,sid).then(result=>{
        append('protocol-timings.jsonl',{method,session:sid??null,scriptId:params.scriptId??null,
          at,ack:Date.now(),ms:Date.now()-at,sourceBytes:result.bytecode?.length??result.scriptSource?.length??null});
        return result;
      });
    };
    c.event=v=>{
      if(v.method==='Runtime.consoleAPICalled'){
        const row={at:Date.now(),session:v.sessionId,type:v.params.type,
          text:v.params.args.map(a=>a.value??a.description??'').join(' ')};
        consoleEvents.push(row);append('console.jsonl',row);
      }else if(v.method==='Target.attachedToTarget'&&v.params.targetInfo.type==='worker'){
        const {sessionId,targetInfo}=v.params,w={sessionId,targetId:targetInfo.targetId,url:targetInfo.url,scripts:[],closed:false};
        workers.set(sessionId,w);
        const task=(async()=>{await c.send('Runtime.enable',{},sessionId);await c.send('Debugger.enable',{},sessionId);
          await c.send('Runtime.runIfWaitingForDebugger',{},sessionId);})();tasks.push(task);task.catch(()=>{});
      }else if(v.method==='Target.detachedFromTarget'){
        const w=workers.get(v.params.sessionId);if(w)w.closed=true;
      }else if(v.method==='Debugger.scriptParsed'){
        const list=scripts.get(v.sessionId)||[];list.push(v.params);scripts.set(v.sessionId,list);
        append('script-inventory.jsonl',{session:v.sessionId,...v.params});
        if((workers.has(v.sessionId)||v.sessionId===session)&&
          /^(?:https?:|wasm:|gta2-native-release-)/.test(v.params.url)){
          const row={url:v.params.url,scriptId:v.params.scriptId,session:v.sessionId};
          (workers.get(v.sessionId)?.scripts??pageScripts).push(row);
          const task=c.send('Debugger.getScriptSource',{scriptId:row.scriptId},v.sessionId).then(s=>{
            const bytes=s.bytecode?Buffer.from(s.bytecode,'base64'):Buffer.from(s.scriptSource||'');
            Object.assign(row,{sha256:sha(bytes),size:bytes.length,bytecodeAvailable:!!s.bytecode});
          });tasks.push(task);task.catch(error=>row.error=String(error));
        }
      }
    };
    const pages=(await c.send('Target.getTargets')).targetInfos.filter(t=>t.type==='page');assert.equal(pages.length,1);
    targetId=pages[0].targetId;session=(await c.send('Target.attachToTarget',{targetId,flatten:true})).sessionId;
    await c.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true},session);
    await c.send('Page.enable',{},session);await c.send('Runtime.enable',{},session);
    if(prepareDebugger||dlls)await c.send('Debugger.enable',{},session);
    await c.send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+
      '/index.html?debug&'+(mode==='worker'?'threads':'no-threads')+'&d3d-renderer=software'},session);
    const loadEnd=Date.now()+20000;
    while(!await evaluate(`typeof shell!=='undefined'&&typeof apps!=='undefined'`)){
      assert(Date.now()<loadEnd,'page ready');await pause(50);
    }
    // COMCTL32 is the PE seed; its genuine COMMCTRL NE companion must be
    // resolved through the installed-name native lookup, never PE-preloaded.
    const installedDlls=dlls?['binaries/dlls/comctl32.dll']:[];
    // Use the built-in selective trace before Worker creation so its existing
    // forwarding protocol carries these three authored public debug strings.
    await evaluate(`window.__waTraceApiNames=new Set(['AUTHORED_NATIVE_KEY_DOWN',
      'AUTHORED_NATIVE_KEY_UP','AUTHORED_NATIVE_QUIT']);true`);
    await evaluate(`(()=>{apps.${app}={label:'Fresh attestation native fixture',exe:${JSON.stringify('/'+fixture)},
      dlls:${JSON.stringify(installedDlls)},files:[]};shell.launchApp('${app}').catch(e=>console.error(e));return true;})()`);
    const nativeEnd=Date.now()+20000;
    for(;;){
      const state=await evaluate(`runningApps.map(a=>({running:a.wine.running,stopped:a.wine._stopped,
        worker:!!a.wine.guestWorker,slice:!!a.wine._workerLastSlice}))`);
      if(state.length===1&&state[0].running&&(mode==='main'||state[0].slice)){
        assert.equal(state[0].worker,mode==='worker');break;
      }
      assert(!state.some(a=>a.stopped));assert(Date.now()<nativeEnd,'actual native fixture ready');await pause(50);
    }
    await Promise.all(tasks);
    // Native debug strings use the existing host log sink. This authored
    // fixture opts into that sink so counters are observable, without private
    // state reads or changing a game/default configuration.
    if(dlls){
      const dllState=await evaluate(`(async()=>{const w=runningApps[0].wine;
        const names=['get_dll_lifecycle_table','get_dll_lifecycle_stride'];
        const e=w.guestWorker?await w.guestWorker.readExports(names):Object.fromEntries(names.map(n=>[n,w.instance.exports[n]()]));
        const view=new DataView(w.memory.buffer),lifecycle=[];
        for(let i=0;i<128;i++){const a=e.get_dll_lifecycle_table+i*e.get_dll_lifecycle_stride;
          if(view.getUint32(a,true))lifecycle.push({index:i,words:Array.from({length:16},(_,j)=>view.getUint32(a+j*4,true))});}
        return {modules:w.moduleBases,exports:e,lifecycle,worker:!!w.guestWorker};})()`);
      const module=dllState.modules['comctl32.dll'];assert(module?.generation===1);
      assert(dllState.lifecycle.some(row=>row.words[0]===2&&row.words[9]===module.loadAddr),'genuine initialized LIVE DLL');
      record('dll-lifecycle.json',dllState);
    }
    await evaluate(`Object.defineProperty(globalThis,'__freshAttestationFixtureOwner',{value:runningApps[0].wine});true`);
    bridgeOptions=await native.install({c,pageSession:session,workers,app,backend:'software'});
    await Promise.all(tasks);
    if(mode==='worker')owner=(await helper.createChain({evaluate,send:c.send,workers,pageSession:session,app,
      expectedModules:pins.modules}).readLive()).identity;
    await controller.boundedOperation(c,'startup complete capture',()=>capture('first-modal'));
    owner??={processId:latest.review.native.context.processId};
    record('ready.json',{mode,app,bridgeOptions,owner,prepareDebugger,tamperSource,
      originalLaunched:false,at:Date.now()});
    for(let n=0;;n++){
      const file=path.join(out,'command-'+n+'.json'),end=Date.now()+90000;
      while(!fs.existsSync(file)){assert(Date.now()<end,'bounded personal scene review');await pause(25);}
      const cmd=JSON.parse(fs.readFileSync(file));
      if(cmd.action==='close'){record('receipt-'+n+'.json',{hostOnly:true,diagnostic:await diagnostic()});break;}
      await controller.boundedOperation(c,'actual fixture '+cmd.action,async()=>{
        if(cmd.action==='capture'){await capture(cmd.name);record('receipt-'+n+'.json',{state:'CAPTURED',latest});return;}
        if(cmd.action==='terminal'){
          const state=await diagnostic();assert(state.exited,'actual native process exit required');
          const png=Buffer.from((await c.send('Page.captureScreenshot',{format:'png'},session)).data,'base64');
          fs.writeFileSync(path.join(out,cmd.name+'.png'),png,{flag:'wx'});
          record('receipt-'+n+'.json',{state:'NATIVE_EXIT_OBSERVED',diagnostic:state,pngSHA256:sha(png)});return;
        }
        assert.equal(cmd.action,'pulse');assert.equal(cmd.review,latest.label);
        assert(cmd.observation?.trim()&&cmd.intent?.trim()&&/^[a-z0-9-]{8,100}$/.test(cmd.nonce));
        assert(Date.now()-latest.review.capturedAt<30000,'fresh complete reviewed menu');
        record('used-'+latest.label+'.json',{nonce:cmd.nonce,observation:cmd.observation,intent:cmd.intent});
        const review={...latest.review,reviewed:true,observation:cmd.observation,maxAgeMs:30000};
        if(cmd.prearmFault==='stale-review')review.capturedAt-=30001;
        const binding=await evaluate(`__gta2NativeReleasePageV1.bind(${JSON.stringify(review)})`);
        if(cmd.prearmFault&&cmd.prearmFault!=='stale-review')await authoredFault(cmd.prearmFault,{review});
        let faultDone=false;
        const actualSpawn=cp.spawn;
        if(cmd.childFault)cp.spawn=function(exe,args,options){
          assert(args[0]===path.join(ROOT,'tools/gta2-paired-controller.cjs')&&args[1]==='release');
          const child=actualSpawn(cmd.childFault==='start-failure'?out+'/missing-authored-node':exe,args,options);
          if(cmd.childFault==='early-eof')child.stdin.end();
          if(cmd.childFault==='late-ack'){
            const on=child.stdout.on;child.stdout.on=function(event,listener){
              return on.call(this,event,event==='data'?b=>setTimeout(()=>listener(b),550):listener);
            };
          }
          return child;
        };
        let result;
        try{result=await controller.releaseGesture({c,session,out,name:cmd.name,keys:cmd.keys,ms:cmd.ms,
          cfg:{url,pid:browser.pid,startToken,targetId,owner,pins,bridgeOptions,review,
            bindingToken:binding.bindingToken,nonce:cmd.nonce,intent:cmd.intent},
          beforeDown:async()=>{if(cmd.childFault==='cancel')throw Error('AUTHORED parent cancellation before DOWN');if(cmd.postarmFault&&!faultDone){
            faultDone=true;let arm;
            if(cmd.postarmFault==='duplicate-arm'){
              const config=JSON.parse(fs.readFileSync(path.join(out,cmd.name+'-release-config.json')));
              const attestation=JSON.parse(fs.readFileSync(path.join(out,cmd.name+'-attestation.json')));
              arm={bindingToken:config.bindingToken,nonce:cmd.nonce,intent:cmd.intent,
                keys:cmd.keys.map(k=>controller.KEYS[k]),childToken:attestation.childToken,startedAt:config.startedAt};
            }
            await authoredFault(cmd.postarmFault,{review,arm});
          }}});}finally{cp.spawn=actualSpawn;}
        record('receipt-'+n+'.json',{state:'ACK',result,diagnostic:await diagnostic(),at:Date.now()});
      });
    }
    record('outcome.json',{state:'AUTHORED_NATIVE_FIXTURE_COMPLETED',mode,originalLaunched:false});
  }catch(error){
    if(c&&!c.closed)c.seal(error);
    record('failure.json',{error:error.stack,at:Date.now(),originalLaunched:false,noRetry:true});process.exitCode=1;
  }finally{
    if(c)c.stop();
    if(browser){browser.kill('SIGTERM');let timer;
      try{await Promise.race([joined,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Chrome close timeout')),3000);})]);}
      catch{browser.kill('SIGKILL');await joined;}finally{clearTimeout(timer);}
    }
    if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
    record('executed-sources.json',{workers:[...workers.values()],pageScripts});record('http.json',http);
    fs.rmSync(out+'/profile',{recursive:true,force:true});
  }
}
if(require.main===module){
  assert(['--browser','--baseline'].includes(process.argv[2]),'explicit runtime mode required');
  const operation=process.argv[2]==='--baseline'?
    require('./test-gta2-browser-release-scene-binding.cjs').browserFixture(process.argv[3],process.argv[4]):
    browserFixture(process.argv[3],process.argv[4],{dlls:process.argv.includes('--dlls'),
      prepareDebugger:process.argv.includes('--prepare-debugger'),tamperSource:process.argv.includes('--tamper-source')});
  operation.catch(error=>{
    console.error(error);process.exitCode=1;
  });
}
module.exports={authoredPE,sourcePins,browserFixture};
