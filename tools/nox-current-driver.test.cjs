'use strict';
// Actual generated consumer, with an offline CDP peer at the browser boundary.
// This exercises Node composition and shutdown, never claims Chromium/guest proof.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const assert=require('node:assert/strict'),vm=require('node:vm'),Module=require('node:module');
const current=require('./nox-current-driver.cjs'),root=current.ROOT;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const save=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n',{flag:'wx'});
async function child(){
 const dir=process.env.NOX_TEST_DIR,generated=process.env.NOX_TEST_GENERATED,mode=process.env.NOX_TEST_MODE;
 const consumer=path.join(generated,'browser-run.cjs'),protocol=[],deliveries=[];
 const startupMutant=process.env.NOX_TEST_STARTUP_MUTANT;
 assert(!startupMutant||startupMutant==='skip-polls');
 let barrierChecks=0;
 const originalExists=fs.existsSync;
 fs.existsSync=function(file){
  if(mode==='barrier-port'&&String(file).endsWith('/chrome-profile/DevToolsActivePort')&&++barrierChecks===4)
   fs.writeFileSync(dir+'/publish-port','four actual endpoint checks');
  return originalExists.call(this,file);
 };
 const realNow=Date.now;let clockOffset=0;
 if(mode==='stale-refusal')Date.now=()=>realNow()+clockOffset;
 const startupFailure=['missing-port','early-death','malformed-port','stopped-port'].includes(mode);
 const originalRead=fs.readFileSync,originalLoad=Module._load,originalSpawn=cp.spawn;
 const originalRename=fs.renameSync;let failurePublishedIndex=null;
 fs.renameSync=function(from,to){if(String(to).endsWith('/first-browser-failure.json'))failurePublishedIndex=protocol.length;return originalRename.call(this,from,to);};
 let browser,compiled=false,firstMouseFault=false,workerAttached=false,stdoutEOF=false,stderrEOF=false,terminalIndex=null;
 const originalTimeout=globalThis.setTimeout;
 globalThis.setTimeout=(fn,ms,...args)=>originalTimeout(()=>{if(ms===20000&&['held-mouse','held-capture'].includes(mode))terminalIndex=protocol.length;fn(...args);},ms);
 const faults={primary:'build/wine-assembly.wasm',compat:'build/wine-assembly.compat.wasm',source:'lib/renderer.js',media:'test/binaries/candidates/nox-demo/game/nox.exe',historical:current.HISTORY+'/browser-run.cjs',repin:'lib/renderer.js'};
 if(faults[mode]){
   const target=path.join(root,faults[mode]);fs.readFileSync=function(file,...args){
     const b=originalRead.call(this,file,...args);
     if(mode==='repin'&&String(file)===generated+'/runtime-pins.json'){
       const manifest=JSON.parse(b),p=manifest.files.find(p=>p.path===faults[mode]);const changed=Buffer.concat([originalRead(target),Buffer.from('WRONG')]);p.sha256=current.sha(changed);p.size=changed.length;return Buffer.from(JSON.stringify(manifest));
     }
     return String(file)===target?Buffer.concat([Buffer.from(b),Buffer.from('WRONG')]):b;
   };
   process.env.DRIVER_PREFLIGHT='1';
 }
 // Corrupt only external review/image publication reads; generated code stays pinned.
 if(process.env.NOX_BINDING_FAULT){
  const read=fs.readFileSync,fault=process.env.NOX_BINDING_FAULT;
  fs.readFileSync=function(file,...args){
   if(String(file)===generated+'/original/startup-review.json'){
    if(fault==='missing-review'){const e=Error('offline missing review');e.code='ENOENT';throw e;}
    const value=JSON.parse(read.call(this,file,...args));
    if(fault==='wrong-sha')value.sha256='0'.repeat(64);
    if(fault==='wrong-identity')value.identity.workerTarget='foreign-worker';
    if(fault==='wrong-label')value.label='foreign-capture';
    return JSON.stringify(value);
   }
   if(fault==='changed-png'&&String(file)===generated+'/original/startup.png')return Buffer.from('offline replaced capture');
   return read.call(this,file,...args);
  };
 }
 const originalCompile=Module.prototype._compile;
 Module.prototype._compile=function(source,filename){if(filename===consumer){compiled=true;assert.equal(current.sha(Buffer.from(source)),JSON.parse(originalRead(path.join(generated,'runtime-pins.json'))).generated.find(p=>p.path==='browser-run.cjs').sha256);
  if(startupMutant){
   const loop='for(let i=0;i<100&&!fs.existsSync(active);i++){startupPolls++;sampleStartup();await wait(100);}';
   assert.equal(source.split(loop).length,2,'unique emitted readiness loop');
   source=source.replace(loop,'/* offline negative control: readiness polls removed */');
  }
 }return originalCompile.call(this,source,filename);};
 cp.spawn=(command,args,options)=>{
   assert.equal(command,'/usr/bin/google-chrome');assert(!faults[mode],'refusal must precede browser');
   const profile=args.find(a=>a.startsWith('--user-data-dir=')).slice(16);
   const script=`const fs=require('node:fs'),profile=process.argv[1],mode=process.argv[2];
     fs.mkdirSync(profile,{recursive:true});
     if(mode==='early-death'){process.stderr.write('OFFLINE_CHILD_EARLY_DEATH\\n');process.exitCode=17;}
     else {
       process.stderr.write('OFFLINE_CHILD_STARTED\\n');
       if(mode==='stopped-port'){process.stderr.write('OFFLINE_CHILD_STOPPED\\n');process.kill(process.pid,'SIGSTOP');}
       else if(mode==='missing-port')process.stderr.write('DevTools listening on ws://127.0.0.1:1/devtools/browser/offline\\n');
       else if(mode==='barrier-port'){
         const timer=setInterval(()=>{if(fs.existsSync(process.argv[3]+'/publish-port')){
           fs.writeFileSync(profile+'/DevToolsActivePort','1\\n/devtools/browser/offline\\n');clearInterval(timer);
         }},10);
       }
       else if(mode==='delayed-port'){
         const cp=require('node:child_process');let remaining=20;
         for(let i=0;i<20;i++)cp.spawn('/bin/true').once('close',()=>{if(!--remaining)setTimeout(()=>fs.writeFileSync(profile+'/DevToolsActivePort','1\\n/devtools/browser/offline\\n'),423);});
       }
       else fs.writeFileSync(profile+'/DevToolsActivePort',mode==='malformed-port'?'bad-port\\n/devtools/browser/offline\\n':'1\\n/devtools/browser/offline\\n');
       const timer=setInterval(()=>{},1000);
       process.stdin.once('data',()=>{clearInterval(timer);process.stdout.write('closed\\n');process.stderr.write('closed\\n');process.stdin.destroy();});
     }`;
   browser=originalSpawn(process.execPath,['-e',script,profile,mode,dir],{stdio:['pipe','pipe','pipe']});
   browser.stdout.pipe(fs.createWriteStream('',{fd:options.stdio[1],autoClose:false}));
   browser.stderr.pipe(fs.createWriteStream('',{fd:options.stdio[2],autoClose:false}));
   browser.stdout.resume();browser.stderr.resume();browser.stdout.on('end',()=>stdoutEOF=true);browser.stderr.on('end',()=>stderrEOF=true);
   browser.once('close',(code,signal)=>save(dir+'/child-wait.json',{code,signal,stdoutEOF,stderrEOF}));
   if(mode==='stopped-port'){
     // An offline process stopped before readiness must remain a terminal
     // failure. Cleanup resumes it only after the actual terminal handler.
     const kill=browser.kill.bind(browser);
     browser.kill=signal=>{if(signal==='SIGTERM')kill('SIGCONT');return kill(signal);};
   }
   return browser;
 };
 Module._load=function(name,parent,main){
   if(name===root+'/test/static-server.js')return {startStaticServer:async()=>({address:()=>({port:1}),prependListener(){},closeAllConnections(){},close:fn=>fn()})};
   return originalLoad.call(this,name,parent,main);
 };
 globalThis.fetch=async url=>{const u=new URL(url);assert.equal(u.origin,'http://127.0.0.1:1');const b=fs.readFileSync(root+u.pathname);return {status:200,arrayBuffer:async()=>b};};
 const fixtureControl=mode.startsWith('fixture');
 const observerControl=process.env.NOX_TEST_OBSERVER==='1';
 const canvas={},instance={},worker={},link={endpointIdentity:1,slot:0,worker,module:{}};
 const wine={processId:7,running:true,_stopped:false,guestWorker:{link},renderer:{peekKeyDownState:()=>0},_workerLastSlice:{batch:1}};
 function context(){
   const listeners=new Map();const ctx={console,crypto:require('node:crypto').webcrypto,crossOriginIsolated:true,runningApps:[],performance,Set,WeakMap,Map,Atomics,
     document:{getElementById:id=>id==='screen'?Object.assign(canvas,{width:640,height:480,getBoundingClientRect:()=>({left:0,top:34,width:945,height:855})}):{textContent:''}},
     addEventListener:(type,fn)=>{if(!listeners.has(type))listeners.set(type,[]);if(!listeners.get(type).includes(fn))listeners.get(type).push(fn);},
     removeEventListener:(type,fn)=>listeners.set(type,(listeners.get(type)||[]).filter(f=>f!==fn))};
   ctx.window=ctx;ctx.emit=(type,e)=>{for(const fn of [...(listeners.get(type)||[])])fn({type,isTrusted:true,...e});};
   if(fixtureControl){
    const {createCanvas}=require('../lib/canvas-compat');const elements=new Map(),docs=new Map();
    const decorate=c=>Object.assign(c,{style:{},classList:{toggle(){}},
     getBoundingClientRect:()=>({left:20,top:40,width:640,height:480}),
     addEventListener(){},removeEventListener(){},setAttribute(){},focus(){}});
    const output=decorate(createCanvas(640,480));elements.set('screen-present',output);
    Object.assign(ctx.document,{pointerLockElement:null,documentElement:{},visibilityState:'visible',
     createElement:tag=>{assert.equal(tag,'canvas');return decorate(createCanvas(640,480));},
     body:{append(c){elements.set(c.id,c);}},getElementById:id=>elements.get(id)||null,
     querySelectorAll:()=>[],elementFromPoint:()=>elements.get('nox-pointer-fixture'),
     addEventListener:(type,fn)=>{if(!docs.has(type))docs.set(type,[]);docs.get(type).push(fn);},
     removeEventListener:(type,fn)=>docs.set(type,(docs.get(type)||[]).filter(f=>f!==fn))});
    ctx.getComputedStyle=c=>({opacity:c.style.opacity??'1',display:c.style.display||'block',visibility:'visible'});
    ctx.setTimeout=setTimeout;ctx.clearTimeout=clearTimeout;
    ctx.requestAnimationFrame=fn=>setImmediate(fn);ctx.setInterval=()=>1;ctx.clearInterval=()=>{};
    ctx.RegionMap=require('../lib/region-map.generated');
    ctx.require=Module.createRequire(root+'/lib/renderer.js');
    const context=vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(root+'/lib/renderer.js','utf8'),context);
    // Retain the actual constructor's screen-present selection and opacity=0.
    vm.runInContext(`const OriginalRenderer=Win98Renderer;Win98Renderer=class extends OriginalRenderer {
     constructor(c){super(c);if(c.id==='nox-pointer-fixture'){
      if(this.presentationCanvas!==document.getElementById('screen-present')||c.style.opacity!=='0')throw Error('production presentation constructor omitted');
     }} };`,context);
    vm.runInContext(fs.readFileSync(root+'/lib/browser-input.js','utf8'),context);
    ctx.emit=(type,e)=>{const c=elements.get('nox-pointer-fixture');
     let stopped=false;
     const event={type,isTrusted:true,clientX:e.x,clientY:e.y,movementX:0,movementY:0,button:0,preventDefault(){},stopPropagation(){stopped=true;},...e};
     // Real capture order: window precedes document and target. Stopping
     // propagation retains other listeners on the same node. In production
     // the bridge owns mouseup at window and prevents document observation.
     for(const f of [...(listeners.get(type)||[])])f(event);
     if(!stopped)for(const f of [...(docs.get(type)||[])])f(event);
     if(!stopped&&c?.['on'+type])c['on'+type](event);
    };return context;
   }
   if(observerControl){
    const {Win98Renderer}=require('../lib/renderer'),{createCanvas}=require('../lib/canvas-compat');
    const c=createCanvas(640,480),r=new Win98Renderer(c),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
    Object.assign(c,{style:{},classList:{toggle(){}},getBoundingClientRect:()=>({left:0,top:34,width:945,height:855}),addEventListener(){},removeEventListener(){},setAttribute(){},focus(){}});
    const docs=new Map();Object.assign(ctx.document,{pointerLockElement:null,body:{},documentElement:{},activeElement:c,visibilityState:'visible',
     getElementById:id=>id==='screen'?c:null,querySelectorAll:()=>[],elementFromPoint:()=>null,
     addEventListener:(type,fn)=>{if(!docs.has(type))docs.set(type,[]);if(!docs.get(type).includes(fn))docs.get(type).push(fn);},
     removeEventListener:(type,fn)=>docs.set(type,(docs.get(type)||[]).filter(f=>f!==fn))});
    r.wasmMemory=memory;r.wasm={exports:{clip_cursor_active:()=>0,post_message_q:()=>1,wnd_mouse_msg_origin_x:()=>0,wnd_mouse_msg_origin_y:()=>0}};
    r.windows[7]={hwnd:7,visible:true,isChild:false,x:0,y:0,w:640,h:480,clientRect:{x:0,y:0,w:640,h:480},zOrder:1,wasm:r.wasm,wasmMemory:memory};
    r._exclusiveTransform={hwnd:7,srcX:0,srcY:0,srcW:640,srcH:480,dstX:0,dstY:0,dstW:640,dstH:480};
    Object.assign(wine,{memory,renderer:r});ctx.RegionMap=require('../lib/region-map.generated');
    // Timers sample only on the offline test's explicit boundaries, keeping
    // the protocol peer distinct from a native guest execution.
    ctx.setInterval=()=>1;ctx.clearInterval=()=>{};ctx.setTimeout=setTimeout;ctx.clearTimeout=clearTimeout;
    const context=vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(root+'/lib/browser-input.js','utf8'),context);
    context.module=undefined;
    context.browserInput.wireCanvasInput(c,r,{runningApps:[{name:'nox_demo',wine:{running:true},relativeMouse:false}]});
    const emit=ctx.emit;ctx.emit=(type,e)=>{
     const event={type,isTrusted:true,clientX:e.x,clientY:e.y,movementX:0,movementY:0,button:0,preventDefault(){},stopPropagation(){},...e};
     for(const f of [...(docs.get(type)||[])])f(event);
     if(['mousemove','mousedown'].includes(type))c['on'+type](event);
     emit(type,event);
    };
    return context;
   }
   return vm.createContext(ctx);
 }
 let page=context();const workerCtx=vm.createContext({endpointIdentity:1,workerSlot:0,instance,crypto:require('node:crypto').webcrypto});
 class Peer{
   constructor(url){new URL(url);assert.equal(url,'ws://127.0.0.1:1/devtools/browser/offline');this.readyState=1;queueMicrotask(()=>this.onopen());}
   deliver(v){this.onmessage({data:JSON.stringify(v)});}
   reply(q,result={},error){this.deliver({id:q.id,...(error?{error}:{result})});}
   send(raw){
     const q=JSON.parse(raw);protocol.push(q);
     queueMicrotask(async()=>{
       try{
         let r={};
         if(q.method==='Browser.getVersion')r={product:'OFFLINE_NODE_PEER'};
         else if(q.method==='Inspector.enable'&&q.sessionId==='worker-session')return this.reply(q,{}, {code:-32601,message:"'Inspector.enable' wasn't found"});
         else if(q.method==='Target.getTargets')r={targetInfos:[{type:'page',targetId:'page'}]};
         else if(q.method==='Target.attachToTarget')r={sessionId:'page-session'};
         else if(q.method==='Page.navigate'){
           page=context();if(q.params.url.includes('app=nox_demo')){
             assert(!workerAttached);workerAttached=true;page.runningApps=[{name:'nox_demo',wine}];
             this.deliver({method:'Target.attachedToTarget',params:{sessionId:'worker-session',targetInfo:{type:'worker',targetId:'guest',url:'http://127.0.0.1:1/lib/guest-worker.js'}}});
             this.deliver({method:'Debugger.scriptParsed',sessionId:'worker-session',params:{scriptLanguage:'WebAssembly',url:'wasm://offline',scriptId:'1',hash:'offline'}});
           }
         }else if(q.method==='Runtime.evaluate'){
           if(mode.startsWith('lifecycle-')&&fs.existsSync(generated+'/original/ready.json')){
            if(mode==='lifecycle-page'||mode==='lifecycle-worker'){
             terminalIndex=protocol.length;
             this.deliver({method:'Inspector.targetCrashed',sessionId:mode==='lifecycle-page'?'page-session':'worker-session',params:{}});
             this.deliver({method:'Inspector.detached',sessionId:'page-session',params:{reason:'later detach'}});
             return; // Leave the real request pending when the first event arrives.
            }
            this.deliver({method:'Inspector.targetCrashed',sessionId:'foreign-session',params:{}});
            this.deliver({method:'Target.detachedFromTarget',params:{sessionId:'retired-session',targetId:'guest'}});
           }
           const value=await vm.runInContext(q.params.expression,q.sessionId==='worker-session'?workerCtx:page);
           if(mode==='held-identity'&&!wine.running)terminalIndex=protocol.length;
           r={result:{value:JSON.parse(JSON.stringify(value===undefined?null:value))}};
         }else if(q.method==='Debugger.getScriptSource')r={bytecode:fs.readFileSync(root+'/build/wine-assembly.wasm').toString('base64')};
         else if(q.method==='Input.dispatchKeyEvent'){
           const p=q.params,type=p.type==='keyDown'?'keydown':'keyup';page.emit(type,{key:p.key,code:p.code});deliveries.push({type,key:p.key});
           if(p.type==='keyDown'&&(p.text||p.key==='Enter'))page.emit('keypress',{key:p.key});
           if(mode==='held-identity'&&fs.existsSync(generated+'/original/ready.json')&&p.type==='keyDown')wine.running=false;
         }else if(q.method==='Input.dispatchMouseEvent'){
           const p=q.params;deliveries.push(p);
           if(!(mode==='fixture-up-fault'&&p.type==='mouseReleased'))page.emit(p.type==='mousePressed'?'mousedown':p.type==='mouseReleased'?'mouseup':'mousemove',p);
           if(['drag-failure','held-mouse'].includes(mode)&&p.type==='mousePressed'&&!firstMouseFault){firstMouseFault=true;terminalIndex=protocol.length;if(mode==='held-mouse')return;return this.reply(q,{}, {code:-1,message:'OFFLINE_FIRST_DRAG_FAILURE'});}
         }else if(q.method==='Page.captureScreenshot'){if(mode==='held-capture'&&fs.existsSync(generated+'/original/ready.json')){terminalIndex=protocol.length;return;}if(fixtureControl){const f=page.noxFixture;assert.equal(f.canvas.style.opacity,'1','paint must publish through production renderer');assert(f.renderer._directPresentation);assert.equal(f.renderer.presentationCanvas.style.display,'none');}
          r={data:Buffer.from('offline screenshot bytes '+protocol.length).toString('base64')};}
         else if(q.method==='Browser.close'){this.reply(q);browser.stdin.end('close\n');return;}
         else assert(['Target.setDiscoverTargets','Target.setAutoAttach','Page.enable','Runtime.enable','Runtime.runIfWaitingForDebugger','Debugger.enable','Inspector.enable'].includes(q.method),q.method);
         this.reply(q,r);
       }catch(e){this.reply(q,{}, {message:e.stack});}
     });
   }
   close(){this.readyState=3;}
 }
 globalThis.WebSocket=Peer;
 process.on('exit',code=>save(dir+'/peer.json',{mode,code,compiled,startupMutant:startupMutant??null,barrierChecks,protocol,deliveries,terminalIndex,failurePublishedIndex,chromeStarted:false,browserPeerOnly:true}));
 process.env.BROWSER_DEADLINE=String(Date.now()+600000);
 if(mode==='ordinary'||mode==='delayed-port'||mode==='barrier-port'||fixtureControl)process.env.NO_ORIGINAL='1';
 if(fixtureControl){
  process.env.NOX_POINTER_OBSERVER='1';
  (async()=>{const out=generated+'/production-preflight';
   for(const label of ['fixture-before','fixture-after']){
    while(!fs.existsSync(out+'/'+label+'-capture.json')){if(fs.existsSync(out+'/first-browser-failure.json'))return;await wait(20);}
    const capture=JSON.parse(fs.readFileSync(out+'/'+label+'-capture.json'));
    if(mode==='fixture-owner-fault')capture.identity.fixtureOwner='foreign-owner';
    if(mode==='fixture-image-fault')fs.writeFileSync(out+'/'+label+'.png','changed bytes');
    save(out+'/'+label+'-review.json',{...capture,review:'Offline fixture publication and binding control only'});
    if(mode!=='fixture')return;
   }
  })().catch(e=>{console.error(e);process.exitCode=3;});
 }
 if(!faults[mode]&&mode!=='ordinary'&&mode!=='delayed-port'&&mode!=='barrier-port'&&!fixtureControl&&!startupFailure){
   (async()=>{
     const out=generated+'/original';while(!fs.existsSync(out+'/ready.json')){if(fs.existsSync(out+'/first-browser-failure.json'))return;await wait(20);}
     const transport=require(generated+'/transport.cjs');
     if(mode==='stale-refusal')clockOffset=120001;
     const latest=JSON.parse(fs.readFileSync(out+'/latest.json'));save(out+'/'+latest.label+'-review.json',{...latest,review:'Offline peer review for actual consumer control flow only'});
     const invalidLabels={ 'label-missing':undefined,'label-null':null,'label-number':42,'label-undefined':'undefined','label-path':'../escape','label-long':'a'.repeat(81),'label-duplicate':latest.label};
     const commands=mode==='commands'&&process.env.NOX_COMMAND_SEQUENCE?JSON.parse(fs.readFileSync(process.env.NOX_COMMAND_SEQUENCE)):mode==='commands'?[
       {action:'move',point:[.4,.5]}, {action:'key',key:'KeyI',holdMs:100},
       {action:'key',key:'Tab',holdMs:150}, {action:'key',key:'Enter',holdMs:250},
       {action:'type',text:'JACK'}, {action:'combo',keys:['ArrowUp','ArrowLeft'],holdMs:100},
       {action:'click',button:'left',point:[.815,.601],holdMs:150},
       {action:'click',button:'right',point:[.49,.63],holdMs:1500},
       {action:'doubleclick',button:'left',point:[.6,.5],holdMs:100},
       {action:'drag',button:'right',point:[.3,.4],to:[.6,.7],holdMs:200}, {action:'capture'}
     ]:[mode==='refusal'?{action:'mouse',point:[.6,.5]}:mode==='stale-refusal'?{action:'click',point:[.6,.5],button:'left',holdMs:150}:mode==='held-identity'?{action:'key',key:'KeyI',holdMs:1000}:mode==='held-capture'?{action:'capture'}:{action:'drag',button:'right',point:[.3,.4],to:[.6,.7],holdMs:200}];
     for(let n=0;n<commands.length;n++){
       const latest=JSON.parse(fs.readFileSync(out+'/latest.json'));const review=out+'/'+latest.label+'-review.json';if(!fs.existsSync(review))save(review,{...latest,review:'Offline actual consumer command admission'});
       try{await transport.request(out,'command-'+n,{...commands[n],waitMs:0,label:Object.hasOwn(invalidLabels,mode)?invalidLabels[mode]:(commands[n].label??'command-'+n),reviewRef:latest.label},30000);}
       catch(e){if(!mode.startsWith('label-')&&!['drag-failure','held-mouse','held-capture','refusal','stale-refusal','held-identity','lifecycle-page','lifecycle-worker'].includes(mode))throw e;return;}
     }
     await transport.request(out,'quit',{action:'quit'},3000);
   })().catch(e=>{console.error(e);process.exitCode=3;});
 }
 require(consumer);
}
async function main(){
 const generated=path.resolve(process.argv[2]||''),out=path.resolve(process.argv[3]||'');
 assert(process.argv[2]&&process.argv[3]&&out.startsWith(root+'/scratch/runs/'));assert(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
 const manifest=JSON.parse(fs.readFileSync(generated+'/runtime-pins.json'));assert(current.verify(root,manifest,generated));
 if(process.argv[4]==='--fixture')return fixtureIntegration(generated,out);
 if(process.argv[4]==='--observer')return observerIntegration(generated,out);
 const results=[];
 // The unchanged driver actually executes its full strict preflight.
 const pre=cp.spawnSync(process.execPath,[generated+'/browser-run.cjs'],{env:{...process.env,DRIVER_PREFLIGHT:'1',BROWSER_DEADLINE:String(Date.now()+120000)},encoding:'utf8'});
 assert.equal(pre.status,0,pre.stderr);results.push({mode:'current-preflight',status:pre.status,proof:JSON.parse(pre.stdout)});
 const modes=process.argv[4]==='--worker'?['ordinary','lifecycle-page','lifecycle-worker','lifecycle-foreign']:['primary','compat','source','media','historical','repin','missing-port','early-death','malformed-port','stopped-port','ordinary','drag','commands','lifecycle-page','lifecycle-worker','lifecycle-foreign','drag-failure','refusal','stale-refusal','held-identity','held-mouse','held-capture','label-missing','label-null','label-number','label-undefined','label-path','label-long','label-duplicate'];
 for(const mode of modes){
   const dir=out+'/'+mode;fs.mkdirSync(dir);
   // The actual generated source is shared; move only its run-specific outputs
   // after each execution, retaining every failure and ordinary-close artifact.
   const r=cp.spawnSync(process.execPath,[__filename],{env:{...process.env,NOX_TEST_CHILD:'1',NOX_TEST_MODE:mode,NOX_TEST_DIR:dir,NOX_TEST_GENERATED:generated},encoding:'utf8',timeout:75000,maxBuffer:1024*1024});
   fs.writeFileSync(dir+'/stdout',r.stdout||'');fs.writeFileSync(dir+'/stderr',r.stderr||'');
   const peer=JSON.parse(fs.readFileSync(dir+'/peer.json'));assert(peer.compiled);assert.equal(peer.chromeStarted,false);
   assert(!peer.protocol.some(q=>q.method==='Inspector.enable'&&q.sessionId==='worker-session'),'Worker capability absence must never become a swallowed protocol error');
   if(['primary','compat','source','media','historical','repin'].includes(mode)){
     assert.equal(r.status,1,r.stderr);assert.equal(peer.protocol.length,0);assert.match(r.stderr,mode==='repin'?/immutable current plan/:/immutable input/);
   }else if(['missing-port','early-death','malformed-port','stopped-port'].includes(mode)){
     const source=generated+'/original';fs.renameSync(source,dir+'/runtime');
     assert.equal(r.status,1,r.stderr);assert.equal(peer.protocol.length,0,'no CDP admission from stderr or malformed port');
     const diagnostic=JSON.parse(fs.readFileSync(dir+'/runtime/native-startup-failure.json'));
     const failure=JSON.parse(fs.readFileSync(dir+'/runtime/first-browser-failure.json'));
     assert.equal(diagnostic.error.stack,failure.error,'original error reaches terminal handler unchanged');
     assert.equal(failure.noReplay,true);assert.equal(diagnostic.pollLimit,100);assert.equal(diagnostic.pollIntervalMs,100);assert.equal(diagnostic.pollBoundMs,10000);
     assert.equal(diagnostic.phase,'native-devtools-startup');assert(diagnostic.elapsedMs>=0);
     const timing=JSON.parse(fs.readFileSync(dir+'/runtime/native-startup-timing.json'));
     assert(timing.observationalOnly);assert.equal(timing.polls,diagnostic.polls);
     assert.equal(timing.samples.length,timing.polls+1);assert(timing.samples.length<=102);
     assert(BigInt(timing.endNs)>=BigInt(timing.beginNs));
     assert(timing.samples.every((s,i)=>!i||BigInt(s.monoNs)>=BigInt(timing.samples[i-1].monoNs)));
     if(mode==='stopped-port')assert(timing.samples.some(s=>s.process?.state==='T'),'actual stopped child observed');
     if(mode==='early-death')assert(timing.samples.some(s=>s.error?.code==='ENOENT'),'actual process absence observed');
     const joined=JSON.parse(fs.readFileSync(dir+'/child-wait.json'));
     assert.equal(joined.stdoutEOF,true);assert.equal(joined.stderrEOF,true);
     if(mode==='malformed-port'){
       assert.equal(diagnostic.error.name,'TypeError');assert.equal(diagnostic.portFile.readCompleted,true);assert.match(diagnostic.portFile.text,/bad-port/);
       assert.equal(diagnostic.boundExhausted,false);assert.equal(diagnostic.process.liveness.present,true);
     }else{
       assert.equal(diagnostic.error.code,'ENOENT');assert.equal(diagnostic.portFile.readCompleted,false);assert.equal(diagnostic.portFile.existsAtFailure,false);
       assert.equal(diagnostic.polls,100);assert.equal(diagnostic.boundExhausted,true);assert(diagnostic.elapsedMs>=10000);
     }
     if(mode==='early-death'){
       assert.equal(diagnostic.process.exitCode,17);assert.equal(diagnostic.process.liveness.present,false);assert.match(diagnostic.stderr.tail,/OFFLINE_CHILD_EARLY_DEATH/);assert.equal(joined.code,17);
     }else{
       assert.equal(diagnostic.process.exitCode,null);assert.equal(diagnostic.process.signalCode,null);assert.equal(diagnostic.process.liveness.present,true);assert.equal(joined.signal,'SIGTERM');
       if(mode==='missing-port')assert.match(diagnostic.stderr.tail,/DevTools listening/);
     }
     assert(!fs.existsSync(dir+'/runtime/chrome-profile'));assert(!fs.existsSync(dir+'/runtime/endpoint.json')||mode==='malformed-port');
     assert(!fs.existsSync(dir+'/runtime/ready.json'));assert(!peer.protocol.some(q=>q.method==='Page.captureScreenshot'));
     assert.equal(JSON.parse(fs.readFileSync(dir+'/runtime/close-reason.json')).reason,mode==='early-death'?'browser exit':'first terminal failure');
   }else{
     const source=generated+'/'+(mode==='ordinary'?'production-preflight':'original');fs.renameSync(source,dir+'/runtime');
     const failed=mode.startsWith('label-')||['drag-failure','refusal','stale-refusal','held-identity','held-mouse','held-capture','lifecycle-page','lifecycle-worker'].includes(mode);
     const joined=JSON.parse(fs.readFileSync(dir+'/child-wait.json'));assert.equal(joined.stdoutEOF,true);assert.equal(joined.stderrEOF,true);assert.equal(joined.signal,failed?'SIGTERM':null);
     assert.equal(r.status,failed?1:0,r.stderr);
     assert.equal(peer.protocol.filter(q=>q.method==='Browser.close').length,failed?0:1);
     assert(!fs.existsSync(dir+'/runtime/chrome-profile'));
     assert(!fs.existsSync(dir+'/runtime/native-startup-failure.json'),'successful startup emits no failure diagnostic');
     const timing=JSON.parse(fs.readFileSync(dir+'/runtime/native-startup-timing.json'));assert(timing.portRead);assert(timing.samples.length<=102);
     const mouse=peer.deliveries.filter(p=>p.type==='mousePressed'||p.type==='mouseReleased');
     if(mode==='drag'){assert.deepEqual(mouse.map(p=>p.type),['mousePressed','mouseReleased']);assert(mouse.every(p=>p.button==='right'));}
     if(mode==='commands'){assert(mouse.some(p=>p.type==='mousePressed'&&p.button==='left'));assert.equal(mouse.filter(p=>p.type==='mousePressed').length,5);}
     if(failed){
       if(mode.startsWith('label-')){assert.equal(peer.deliveries.filter(p=>p.type==='mousePressed').length,0,'malformed labels have zero input effects');assert.equal(peer.protocol.filter(q=>q.method==='Page.captureScreenshot').length,1,'startup capture only');}
       assert.equal(peer.protocol.length,peer.failurePublishedIndex,'zero protocol after terminal failure publication');
       if(peer.terminalIndex!==null){
         // Observe the real 20-second timer callback; do not shorten the bound.
         assert.equal(peer.protocol.length,peer.terminalIndex);
       }
       assert(!fs.existsSync(dir+'/runtime/native-events.json'),'terminal cleanup never evaluates native events');
       assert(!fs.existsSync(dir+'/runtime/command-0.png'),'no post-failure capture');
       const failure=JSON.parse(fs.readFileSync(dir+'/runtime/first-browser-failure.json'));assert.match(failure.error,mode.startsWith('lifecycle-')?/current owner lifecycle loss/:mode.startsWith('label-')?(mode==='label-duplicate'?/unique capture label required/:/valid capture label required/):mode==='drag-failure'?/OFFLINE_FIRST_DRAG_FAILURE/:mode==='refusal'?/known action/:mode==='stale-refusal'?/stale scene/:mode==='held-identity'?/AssertionError/:/CDP UNKNOWN/);
       if(mode.startsWith('lifecycle-')){
        const terminal=JSON.parse(fs.readFileSync(dir+'/runtime/terminal-error.json'));
        assert.equal(terminal.ownerLifecycle.event.method,'Inspector.targetCrashed');
        assert.equal(terminal.ownerLifecycle.owner.sessionId,mode==='lifecycle-page'?'page-session':'worker-session');
        assert.equal(terminal.pendingRequests.length,1);
        assert.equal(peer.protocol.filter(q=>q.method==='Page.captureScreenshot').length,1);
       }
       assert(!fs.existsSync(dir+'/runtime/drag.png'),'no later capture after first failure');
       assert(JSON.parse(fs.readFileSync(dir+'/runtime/first-failure.json')).noReplay);
     }
   }
   results.push({mode,status:r.status,protocol:peer.protocol.length,passed:true});
 }
 await chainControls(generated);
 save(out+'/results.json',{passed:true,actualGeneratedConsumer:true,actualBoundChain:true,actualNativeHelper:true,chromiumTested:false,results});
 console.log(JSON.stringify({passed:true,results}));
}
async function fixtureIntegration(generated,out){
 const results=[];
 for(const mode of ['fixture','fixture-owner-fault','fixture-image-fault','fixture-up-fault']){
  const dir=out+'/'+mode;fs.mkdirSync(dir);
  const r=cp.spawnSync(process.execPath,[__filename],{env:{...process.env,NOX_TEST_CHILD:'1',NOX_TEST_MODE:mode,NOX_TEST_DIR:dir,NOX_TEST_GENERATED:generated},encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
  fs.writeFileSync(dir+'/stdout',r.stdout||'');fs.writeFileSync(dir+'/stderr',r.stderr||'');
  const runtime=generated+'/production-preflight';fs.renameSync(runtime,dir+'/runtime');
  const peer=JSON.parse(fs.readFileSync(dir+'/peer.json')),joined=JSON.parse(fs.readFileSync(dir+'/child-wait.json'));
  assert.equal(joined.stdoutEOF,true);assert.equal(joined.stderrEOF,true);
  assert.equal(r.status,mode==='fixture'?0:1,r.stderr+'\n'+r.stdout);
  const presses=peer.deliveries.filter(p=>p.type==='mousePressed');
  assert.equal(presses.length,['fixture','fixture-up-fault'].includes(mode)?1:0,'review binding must precede any click');
  if(mode==='fixture'){
   const proof=JSON.parse(fs.readFileSync(dir+'/runtime/native-pointer-fixture.json'));
   assert(proof.passed);assert.equal(proof.before.identity.fixtureOwner,proof.after.identity.fixtureOwner);
   assert.equal(proof.before.identity.canvasId,'nox-pointer-fixture');
   const pointer=JSON.parse(fs.readFileSync(dir+'/runtime/fixture-pointer.json'));
   assert(pointer.records.some(p=>p.kind==='dom'&&p.binding?.previous?.sha256===proof.before.sha256));
   assert.deepEqual(pointer.records.filter(p=>p.kind==='dom'&&['mousedown','mouseup'].includes(p.type)).map(p=>p.type),['mousedown','mouseup']);
   assert(pointer.records.some(p=>p.kind==='renderer-return'&&p.method==='handleMouseUp'));
   assert.equal(pointer.state.cursor.buttons,0);
  }else assert.equal(peer.protocol.length,peer.failurePublishedIndex,'no protocol after first refusal');
  results.push({mode,passed:true,status:r.status});
 }
 save(out+'/fixture-controls.json',{passed:true,actualGeneratedFixture:true,productionRenderer:true,chromiumTested:false,results});
 console.log(JSON.stringify({passed:true,results}));
}
async function observerIntegration(generated,out){
 const r=cp.spawnSync(process.execPath,[__filename],{env:{...process.env,
  NOX_TEST_CHILD:'1',NOX_TEST_MODE:'commands',NOX_TEST_DIR:out,NOX_TEST_GENERATED:generated,
  NOX_POINTER_OBSERVER:'1',NOX_TEST_OBSERVER:'1'},encoding:'utf8',timeout:90000,maxBuffer:1024*1024});
 fs.writeFileSync(out+'/stdout',r.stdout||'');fs.writeFileSync(out+'/stderr',r.stderr||'');
 assert.equal(r.status,0,r.stderr);
 const peer=JSON.parse(fs.readFileSync(out+'/peer.json')),joined=JSON.parse(fs.readFileSync(out+'/child-wait.json'));
 assert(peer.compiled&&!peer.chromeStarted);assert.equal(joined.code,0);assert(joined.stdoutEOF&&joined.stderrEOF);
 const runtime=generated+'/original',latest=JSON.parse(fs.readFileSync(runtime+'/latest.json'));
 const observed=JSON.parse(fs.readFileSync(runtime+'/'+latest.label+'-pointer.json'));
 assert.deepEqual(observed.capture,latest);assert(observed.observations.active);
 const images=observed.observations.records.filter(r=>r.kind==='image-bound');assert.equal(images.length,12);
 for(let n=1;n<images.length;n++){
  assert.equal(images[n].binding.label,images[n].capture.label);
  assert.deepEqual(images[n].binding.previous,images[n-1].capture);
 }
 assert(observed.observations.records.some(r=>r.kind==='renderer-return'&&r.method==='_queueDirectInputMouseEvent'));
 fs.renameSync(runtime,out+'/runtime');
 save(out+'/results.json',{passed:true,actualGeneratedConsumer:true,productionBridge:true,
  productionRenderer:true,imageBindings:images.length,stdoutEOF:true,stderrEOF:true,nativeGuest:false});
 console.log(JSON.stringify({passed:true,observerIntegration:true,imageBindings:images.length}));
}
async function observerControls(plan,out,selected){
 assert(!fs.existsSync(out));assert(out.startsWith(root+'/scratch/runs/'));fs.mkdirSync(out,{recursive:true});
 const accepted=JSON.parse(fs.readFileSync(root+'/scratch/runs/20261109-nox-menu-acceptance-cause-2348/route-sequence.json'));
 const failedDir=root+'/scratch/runs/20261109-nox-destructible-target-progress-2325';
 const failed=fs.readdirSync(failedDir).filter(n=>/^request-step-.*\.json$/.test(n)&&!n.includes('-remote-')).sort().map(n=>JSON.parse(fs.readFileSync(failedDir+'/'+n)).command);
 assert.equal(accepted.length,37);assert.equal(failed.length,12);
 const results=[],routes={};
 const modes=['accepted-route','failed-route','missing-review','wrong-sha','wrong-identity','wrong-label','changed-png','label-missing','held-mouse','held-capture'];
 if(selected)assert(selected.length&&new Set(selected).size===selected.length&&selected.every(m=>modes.includes(m)));
 for(const mode of selected||modes){
  const dir=out+'/'+mode;fs.mkdirSync(dir);const generated=dir+'/generated';
  current.generate(plan,generated); // Generate at its real depth; never relocate a module.
  const binding=['missing-review','wrong-sha','wrong-identity','wrong-label','changed-png'].includes(mode);
  const sequence=mode==='accepted-route'?accepted:mode==='failed-route'?failed:null;
  if(sequence)save(dir+'/sequence.json',sequence);
  const r=cp.spawnSync(process.execPath,[__filename],{env:{...process.env,
   NOX_POINTER_OBSERVER:'1',NOX_TEST_OBSERVER:'1',NOX_TEST_CHILD:'1',
   NOX_TEST_MODE:binding?'drag-failure':sequence?'commands':mode,NOX_BINDING_FAULT:binding?mode:'',
   NOX_TEST_DIR:dir,NOX_TEST_GENERATED:generated,...(sequence?{NOX_COMMAND_SEQUENCE:dir+'/sequence.json'}:{})},
   encoding:'utf8',timeout:90000,maxBuffer:1024*1024});
  fs.writeFileSync(dir+'/stdout',r.stdout||'');fs.writeFileSync(dir+'/stderr',r.stderr||'');
  assert.equal(r.status,sequence?0:1,r.stderr);
  const peer=JSON.parse(fs.readFileSync(dir+'/peer.json')),joined=JSON.parse(fs.readFileSync(dir+'/child-wait.json'));
  assert(peer.compiled&&!peer.chromeStarted);assert(joined.stdoutEOF&&joined.stderrEOF);
  const runtime=generated+'/original';assert(JSON.parse(fs.readFileSync(runtime+'/startup-pointer.json')).observations.active);
  if(sequence){
   const capture=JSON.parse(fs.readFileSync(runtime+'/latest.json')),snapshot=JSON.parse(fs.readFileSync(runtime+'/'+capture.label+'-pointer.json'));
   assert.deepEqual(snapshot.capture,capture);
   const images=snapshot.observations.records.filter(r=>r.kind==='image-bound');assert.equal(images.length,sequence.length+1);
   for(let i=1;i<images.length;i++){assert.equal(images[i].binding.label,images[i].capture.label);assert.deepEqual(images[i].binding.previous,images[i-1].capture);}
   const commands=snapshot.observations.records.filter(r=>r.kind==='command-begin');assert.equal(commands.length,sequence.length);
   assert(snapshot.observations.records.some(r=>r.kind==='renderer-return'&&r.method==='_queueDirectInputMouseEvent'));
   routes[mode]=commands.map(r=>({label:r.binding.label,cursor:r.state.cursor}));
   // Both routes ACK in this peer. Observations must retain their divergent
   // tenth destination; neither ACK is a menu-acceptance oracle.
   const tenth=snapshot.observations.records.filter(r=>r.kind==='dom'&&r.type==='mousedown'&&r.binding?.label===sequence[9].label);
   assert.equal(tenth.length,1);
   assert.equal(tenth[0].clientX,sequence[9].point[0]*945);assert.equal(tenth[0].clientY,34+sequence[9].point[1]*855);
   save(dir+'/route-observations.json',snapshot);
  }else{
   assert.equal(peer.protocol.length,peer.failurePublishedIndex);assert.equal(peer.protocol.filter(q=>q.method==='Browser.close').length,0);
   if(binding||mode==='label-missing'){assert.equal(peer.deliveries.filter(e=>e.type==='mousePressed').length,0);assert.equal(peer.protocol.filter(q=>q.method==='Page.captureScreenshot').length,1);}
  }
  results.push({mode,passed:true,status:r.status,stdoutEOF:true,stderrEOF:true,actualGeneratedConsumer:true,productionBridge:true,productionRenderer:true,nativeGuest:false});
  save(out+'/progress-'+mode+'.json',results.at(-1));
 }
 if(routes['accepted-route']&&routes['failed-route'])assert.notDeepEqual(routes['accepted-route'],routes['failed-route']);
 save(out+'/results.json',{passed:true,results,peerAcceptanceIsNotGuestAcceptance:true});
 console.log(JSON.stringify({passed:true,controls:results.length}));
}
async function chainControls(generated){
 const bound=require(generated+'/bound-input.cjs'),module=fs.readFileSync(root+'/build/wine-assembly.wasm');
 let now=Date.now(),png=Buffer.from('peer'),wrong=false;
 const fields=Object.fromEntries(bound.FIELDS.map(f=>[f,f]));
 const page={isolated:true,apps:[{...fields,name:'nox_demo',running:true,stopped:false,guestWorker:true,guestEndpoint:1,slot:0,renderEndpoint:'none',processId:1}]};
 const workers=new Map([['s',{targetId:'guest',url:'guest-worker.js',sessionId:'s',closed:false,scripts:[{scriptId:'1',bytecodeAvailable:true,sha256:current.sha(module)}]}]]);
 const options={now:()=>now,pageSession:'p',workers,expectedModules:[current.sha(module)],evaluate:async expression=>expression===bound.PAGE_READ?structuredClone(page):{endpointIdentity:1,slot:0,instance:'instance'},send:async method=>method==='Page.captureScreenshot'?{data:png.toString('base64')}:{bytecode:(wrong?Buffer.from('wrong module'):module).toString('base64')}};
 const chain=bound.createChain(options),shot=await chain.capture('one');
 const review={...shot.capture,review:'peer'};let effects=0;
 now+=bound.MAX_AGE_MS+1;await assert.rejects(()=>chain.admit(review,()=>effects++),/stale scene/);assert.equal(effects,0);assert(!chain.closed);
 now=Date.now();await chain.capture('two');wrong=true;
 await assert.rejects(()=>chain.readLive(),/live module bytes changed/);wrong=false;
 const newChain=bound.createChain({...options,expectedModules:['0'.repeat(64)]});await assert.rejects(()=>newChain.readLive(),/immutable staged module/);
 const shot2=await chain.capture('three');page.apps[0].processId=2;
 await assert.rejects(()=>chain.admit({...shot2.capture,review:'peer'},()=>effects++),/identity changed/);assert(chain.closed);assert.equal(effects,0);
 const mouse=require(generated+'/native-mouse.cjs'),events=[];
 await assert.rejects(()=>mouse.perform({session:'s',geometry:{left:0,top:0,width:640,height:480},command:{action:'drag',point:[.2,.2],to:[.5,.5],holdMs:100},send:async(method,p)=>{events.push(p.type);if(p.type==='mousePressed')await wait(140);}}),/mouse delivery exceeded hold bound/);
 assert.deepEqual(events,['mouseMoved','mousePressed','mouseReleased']);
}
async function cdpControls(generated,out){
 assert(out.startsWith(root+'/scratch/runs/')&&!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
 const source=fs.readFileSync(generated+'/browser-run.cjs','utf8'),begin=source.indexOf('let pageOwner=null,'),end=source.indexOf('async function event(v)',begin);
 assert(begin>=0&&end>begin);const emitted=source.slice(begin,end),results=[];
 for(const [expression,operation] of [['page-read','page-owner'],['worker-read','worker-owner'],['renderer-read','renderer-owner'],['globalThis.__noxConsumption.begin('+ 'x'.repeat(4096)+')','nox-consumption']]){
  const frames=[],trace=[],saved={},timers=new Map(),microtasks=[];let timerId=0,closed=0;
  const pending=new Map(),ctx={root,require,pending,workers:new Map([['worker',{targetId:'actual-target'}]]),id:0,timer:0,pageSession:'page',
   bound:{PAGE_READ:'page-read',WORKER_READ:'worker-read',RENDER_READ:'renderer-read'},Buffer,Date,sha:current.sha,
   process:{exitCode:0},save:(n,v)=>saved[n]=structuredClone(v),log:(n,v)=>{assert.equal(n,'cdp-requests.jsonl');trace.push(structuredClone(v));},ws:{send:wire=>frames.push(JSON.parse(wire))},
   setTimeout:(fn,ms)=>{assert.equal(ms,20000,'unchanged production timeout');timers.set(++timerId,fn);return timerId;},clearTimeout:n=>timers.delete(n),
   queueMicrotask:fn=>microtasks.push(fn),close:async()=>{closed++;},console};
  vm.createContext(ctx);vm.runInContext(emitted+';globalThis.api={send,evaluate};',ctx);
  vm.runInContext("noxCommand={id:'host-game',action:'click',label:'host-game',reviewRef:'network'}",ctx);
  // Complete one real emitted request first; retain its metadata, not its reply.
  const successful=ctx.api.send('Browser.getVersion');const first=pending.get(1);pending.delete(1);ctx.clearTimeout(first.timer);first.resolve({product:'offline'});await successful;
  vm.runInContext("noxCommand={id:'host-game',action:'click',label:'host-game',reviewRef:'network'}",ctx);
  const failed=ctx.api.evaluate(expression,'worker').catch(e=>e),other=ctx.api.send('Debugger.getScriptSource',{scriptId:'one'},'worker').catch(e=>e);
  const due=pending.get(2).timer;timers.get(due)();const error=await failed;await other;
  assert.match(error.message,/CDP UNKNOWN Runtime.evaluate; no replay/);assert.equal(pending.size,0);
  const record=saved['terminal-error.json'];assert(record.noReplay);assert.equal(record.command.id,'host-game');assert.equal(record.lastCdpReply.method,'Browser.getVersion');
  assert.equal(record.pendingRequests.length,2);const request=record.pendingRequests[0];
  assert.deepEqual(trace.find(r=>r.phase==='reply'&&r.id===record.lastCdpReply.id),{phase:'reply',...record.lastCdpReply});
  assert.equal(request.operation,operation);assert.equal(request.sessionId,'worker');assert.equal(request.targetId,'actual-target');assert.equal(request.command.reviewRef,'network');
  assert.equal(request.expression.sha256,current.sha(Buffer.from(expression)));assert.equal(request.expression.bytes,Buffer.byteLength(expression));assert.equal(request.expression.prefix,expression.slice(0,256));
  const sentRequest=trace.find(r=>r.phase==='sent'&&r.id===request.id);
  assert(sentRequest);for(const k of ['id','method','operation','sessionId','targetId','expression','command'])assert.deepEqual(sentRequest[k],request[k]);
  const wire=frames.find(r=>r.id===request.id);assert.equal(sentRequest.expression.sha256,current.sha(Buffer.from(wire.params.expression)));
  assert.equal(trace.filter(r=>r.id===request.id&&r.phase==='reply').length,0,'pending request has no reply');
  const sent=frames.length;await assert.rejects(ctx.api.send('Input.dispatchMouseEvent'),/CDP UNKNOWN/);await assert.rejects(ctx.api.evaluate('later'),/CDP UNKNOWN/);
  for(const fn of microtasks)fn();await Promise.resolve();assert.equal(closed,1);assert.equal(frames.length,sent);assert.equal(ctx.process.exitCode,1);
  assert(!frames.some(f=>f.method.startsWith('Input.')||f.method==='Page.captureScreenshot'||f.method==='Browser.close'));assert.equal(trace.length,4,'no later trace or protocol');
  results.push({operation,pendingRequests:record.pendingRequests.length,unchangedTimeoutMs:20000,sticky:true,zeroLaterProtocol:true,actualWireTraceJoined:true});
 }
 save(out+'/results.json',{passed:true,actualEmittedSendEvaluate:true,results});console.log(JSON.stringify({passed:true,controls:results.length}));
}
async function lifecycleControls(generated,out){
 assert(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
 const source=fs.readFileSync(generated+'/browser-run.cjs','utf8');
 const begin=source.indexOf('let pageOwner=null,'),end=source.indexOf('async function state()',begin);
 const caller=source.slice(source.indexOf('let settledMenu=null;'),source.indexOf('\n(async()=>{'));
 assert(begin>0&&end>begin&&caller.includes('async function execute'));
 const results=[];
 const events=[
  ['inspector-crash',o=>({method:'Inspector.targetCrashed',sessionId:o.sessionId,params:{}})],
  ['inspector-detach',o=>({method:'Inspector.detached',sessionId:o.sessionId,params:{reason:'Render process gone.'}})],
  ['detach',o=>({method:'Target.detachedFromTarget',...(o.parentSession?{sessionId:o.parentSession}:{}),params:{sessionId:o.sessionId,targetId:o.targetId}})],
  ['detach-no-target',o=>({method:'Target.detachedFromTarget',...(o.parentSession?{sessionId:o.parentSession}:{}),params:{sessionId:o.sessionId}})],
  ['crash',o=>({method:'Target.targetCrashed',params:{targetId:o.targetId,status:'crashed',errorCode:9}})],
  ['destroy',o=>({method:'Target.targetDestroyed',params:{targetId:o.targetId}})],
  ['context',o=>({method:'Runtime.executionContextDestroyed',sessionId:o.sessionId,params:{executionContextId:1,executionContextUniqueId:o.sessionId+'-current'}})],
  ['contexts',o=>({method:'Runtime.executionContextsCleared',sessionId:o.sessionId,params:{}})]
 ];
 for(const role of ['page','guest','renderer'])for(const [kind,makeEvent] of events){
  const pending=new Map(),workers=new Map(),frames=[],saved={},microtasks=[],timers=new Map();let seq=0,closed=0;
  const ctx={root,require,pending,workers,id:0,timer:0,pageSession:'page',closing:false,latest:null,workerPromises:[],assert,Buffer,Date,sha:current.sha,
   bound:{PAGE_READ:'page-read',WORKER_READ:'worker-read',RENDER_READ:'renderer-read'},process:{exitCode:0},
   ws:{send:wire=>frames.push(JSON.parse(wire))},save:(n,v)=>{assert(!saved[n],'one publication '+n);saved[n]=structuredClone(v);},log(){},
   setTimeout:(fn,ms)=>{assert.equal(ms,20000);timers.set(++seq,fn);return seq;},clearTimeout:n=>timers.delete(n),
   queueMicrotask:fn=>microtasks.push(fn),close:async()=>{closed++;},console};
  vm.createContext(ctx);vm.runInContext(source.slice(begin,end)+caller+`;globalThis.api={send,evaluate,event,execute,bindOwnerCapture};
   pageOwner={sessionId:'page',targetId:'page-target',parentSession:null,generation:1,closed:false};`,ctx);
  const guest={sessionId:'guest',targetId:'guest-target',parentSession:'page',generation:2,closed:false,url:'guest-worker.js',scripts:[]};
  const renderer={sessionId:'renderer',targetId:'renderer-target',parentSession:null,generation:3,closed:false,url:'d3d-render-worker.js',scripts:[]};
  workers.set('guest',guest);workers.set('renderer',renderer);
  // Expected navigation before the first owner proof is harmless.
  await ctx.api.event({method:'Runtime.executionContextsCleared',sessionId:'page',params:{}});
  ctx.api.bindOwnerCapture({after:{worker:guest},capture:{identity:{rendererTarget:renderer.targetId}}});
  const owners=[{sessionId:'page',targetId:'page-target',parentSession:null},guest,renderer];
  await ctx.api.event({method:'Page.frameNavigated',sessionId:'page',params:{frame:{id:'main-frame'}}});
  for(const o of owners){
   const frameId=o.sessionId==='page'?'main-frame':o.targetId;
   await ctx.api.event({method:'Runtime.executionContextCreated',sessionId:o.sessionId,params:{context:{id:1,uniqueId:o.sessionId+'-old',auxData:{isDefault:true,frameId}}}});
   await ctx.api.event({method:'Runtime.executionContextCreated',sessionId:o.sessionId,params:{context:{id:1,uniqueId:o.sessionId+'-current',auxData:{isDefault:true,frameId}}}});
   // Isolated/subframe worlds must not overwrite the page's current context.
   if(o.sessionId==='page')await ctx.api.event({method:'Runtime.executionContextCreated',sessionId:'page',params:{context:{id:2,uniqueId:'subframe',auxData:{isDefault:true,frameId:'foreign-frame'}}}});
  }
  const owner=owners.find(o=>o.sessionId===role),original=makeEvent(owner);
  // Same event type from a foreign or retired session/target is harmless.
  await ctx.api.event(makeEvent({sessionId:'foreign',targetId:'foreign-target'}));
  await ctx.api.event(makeEvent({sessionId:'retired',targetId:'retired-target'}));
  await ctx.api.event({method:'Runtime.executionContextDestroyed',sessionId:role,params:{executionContextId:1,executionContextUniqueId:role+'-old'}});
  await ctx.api.event({method:'Runtime.executionContextDestroyed',sessionId:role,params:{executionContextId:1}});
  await ctx.api.event({method:'Target.detachedFromTarget',sessionId:role,params:{sessionId:'retired',targetId:owner.targetId}});
  await ctx.api.event({method:'Target.detachedFromTarget',sessionId:'foreign-parent',params:{sessionId:owner.sessionId,targetId:owner.targetId}});
  assert(!owner.closed,'foreign parent cannot retire the current Worker');
  assert(!saved['terminal-error.json']);
  const first=ctx.api.evaluate('page-read','page').catch(e=>e),second=ctx.api.send('Debugger.getScriptSource',{scriptId:'one'},'guest').catch(e=>e);
  const before=frames.length;assert.equal(pending.size,2);
  const replyRace=role==='page'&&kind==='inspector-crash';
  if(replyRace){
   const request=pending.get(1);pending.delete(1);ctx.clearTimeout(request.timer);
   request.resolve({result:{value:'reply immediately before owner loss'}});
  }
  await ctx.api.event(original);
  const error=await first;assert.strictEqual(await second,error);assert.match(error.message,/current owner lifecycle loss/);
  assert.equal(pending.size,0);assert.equal(timers.size,0,'reject now without invoking the timeout');
  const record=saved['terminal-error.json'];assert.deepEqual(record.ownerLifecycle.event,original);assert.equal(record.ownerLifecycle.owner.sessionId,role);
  assert.equal(record.pendingRequests.length,replyRace?1:2);assert(record.ownerLifecycle.owner.generation>0);
  await ctx.api.event({method:'Inspector.detached',sessionId:'page',params:{reason:'later event'}});
  for(const command of [{action:'capture',label:'later'},{action:'quit'},{action:'key',key:'Space'}])await assert.rejects(ctx.api.execute(command,()=>assert.fail('dispatch after loss')),/current owner lifecycle loss/);
  for(const method of ['Runtime.evaluate','Input.dispatchMouseEvent','Page.captureScreenshot','Browser.close'])await assert.rejects(ctx.api.send(method),/current owner lifecycle loss/);
  for(const fn of microtasks)fn();await Promise.resolve();assert.equal(closed,1);assert.equal(frames.length,before);assert.equal(ctx.process.exitCode,1);
  results.push({role,kind,passed:true,pendingRejected:replyRace?1:2,replyRace,cancels:closed,zeroLaterEffects:true});
 }
 // Reattachment to the same target retires the old session generation.
 {
  const workers=new Map(),ctx={workers,closing:false,terminalError:null,pageOwner:null,guestOwner:null,renderOwner:null};
  // Reuse actual emitted selection/event functions, with a terminal spy.
  vm.createContext(ctx);vm.runInContext(source.slice(begin,source.indexOf('let terminalError=null,',begin))+`;globalThis.api={bindOwnerCapture,ownerEvent};`,ctx);
  const old={sessionId:'old',targetId:'same-target',generation:1},fresh={sessionId:'fresh',targetId:'same-target',generation:2};
  workers.set('old',old);ctx.api.bindOwnerCapture({after:{worker:old},capture:{identity:{rendererTarget:'none'}}});
  workers.set('fresh',fresh);ctx.api.bindOwnerCapture({after:{worker:fresh},capture:{identity:{rendererTarget:'none'}}});
  ctx.terminal=()=>assert.fail('retired attachment must not cancel');
  for(const method of ['Inspector.targetCrashed','Inspector.detached','Runtime.executionContextsCleared'])ctx.api.ownerEvent({method,sessionId:'old',params:{}});
  ctx.api.ownerEvent({method:'Target.detachedFromTarget',params:{sessionId:'old',targetId:'same-target'}});
  results.push({kind:'reattachment-same-target',passed:true});
 }
 save(out+'/results.json',{passed:true,actualEmittedCaller:true,nativeBrowser:false,results});console.log(JSON.stringify({passed:true,controls:results.length}));
}
async function protocolControls(generated,out){
 assert(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
 assert(current.verify(root,JSON.parse(fs.readFileSync(generated+'/runtime-pins.json')),generated));
 const source=fs.readFileSync(generated+'/browser-run.cjs','utf8');
 const begin=source.indexOf('let pageOwner=null,'),end=source.indexOf('async function state()',begin);
 const handlerStart=source.indexOf('ws.onmessage=msg=>');
 const handler=source.slice(handlerStart,source.indexOf('\n',handlerStart))+source.slice(source.indexOf(' ws.onclose='),source.indexOf(" save('browser-version.json'"));
 const setup=source.slice(source.indexOf(" save('browser-version.json'"),source.indexOf('\n chain=bound.createChain'));
 const caller=source.slice(source.indexOf('let settledMenu=null;'),source.indexOf('\n(async()=>{'));
 assert(handler.includes('ws.onclose=')&&setup.includes("await send('Inspector.enable',{},pageSession)"));
 const results=[];
 for(const mode of ['capabilities','worker-detach','worker-destroy','page-crash','connection-loss','protocol-failure']){
  const dir=out+'/'+mode;fs.mkdirSync(dir);const profile=dir+'/profile';
  // Arm before Chrome. This separate process has an immutable 45s deadline
  // and can terminate Chrome's process group if this test stops progressing.
  const watchdog=cp.spawn(process.execPath,['-e',`
   const fs=require('node:fs');let pgid=null;
   const timer=setTimeout(()=>{fs.writeFileSync(process.argv[1],JSON.stringify({fired:true,pgid}));if(pgid)try{process.kill(-pgid,'SIGKILL');}catch{}process.exit(1);},45000);
   fs.writeFileSync(process.argv[1]+'.armed',JSON.stringify({pid:process.pid,deadline:Date.now()+45000}));
   process.stdin.once('data',b=>{pgid=Number(b.toString());});
   process.stdin.once('end',()=>{clearTimeout(timer);fs.writeFileSync(process.argv[1],JSON.stringify({fired:false,pgid}));});
  `,dir+'/watchdog.json'],{stdio:['pipe','pipe','pipe']});
  const joined=p=>new Promise(resolve=>{let stdoutEOF=false,stderrEOF=false;p.stdout.resume();p.stderr.resume();p.stdout.on('end',()=>stdoutEOF=true);p.stderr.on('end',()=>stderrEOF=true);p.on('close',(code,signal)=>resolve({code,signal,stdoutEOF,stderrEOF}));});
  const watchdogWait=joined(watchdog);
  for(let n=0;n<100&&!fs.existsSync(dir+'/watchdog.json.armed');n++)await wait(10);
  assert(fs.existsSync(dir+'/watchdog.json.armed'),'independent deadline armed before Chrome');
  const browser=cp.spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{detached:true,stdio:['ignore','pipe','pipe']});
  const browserWait=joined(browser);watchdog.stdin.write(String(browser.pid)+'\n');
  const frames=[],events=[],saved={},workers=new Map(),pending=new Map(),rawPending=new Map();let ws,rawId=-1,closes=0;
  try{
   for(let n=0;n<100&&!fs.existsSync(profile+'/DevToolsActivePort');n++)await wait(100);
   const [port,suffix]=fs.readFileSync(profile+'/DevToolsActivePort','utf8').trim().split('\n');
   ws=new WebSocket('ws://127.0.0.1:'+port+suffix);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
   const ctx={root,require,pending,workers,workerPromises:[],id:0,timer:0,pageSession:null,closing:false,latest:null,assert,Buffer,Date,sha:current.sha,
    bound:{PAGE_READ:'page-read',WORKER_READ:'worker-read',RENDER_READ:'renderer-read'},process:{exitCode:0},console,setTimeout,clearTimeout,queueMicrotask,
    ws:{send:wire=>{frames.push(JSON.parse(wire));ws.send(wire);}},save:(n,v)=>{assert(!saved[n]);saved[n]=structuredClone(v);},log(){},close:async()=>{closes++;}};
   vm.createContext(ctx);vm.runInContext(source.slice(begin,end)+caller+handler+';globalThis.api={send,evaluate,event,execute,bindOwnerCapture};',ctx);
   const raw=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=rawId--;rawPending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
   ws.onmessage=msg=>{const v=JSON.parse(msg.data);if(v.id<0){const p=rawPending.get(v.id);rawPending.delete(v.id);p.resolve(v);return;}if(!v.id)events.push(v);ctx.ws.onmessage(msg);};
   ws.onclose=ctx.ws.onclose;ws.onerror=ctx.ws.onerror;
   await vm.runInContext('(async()=>{'+setup+'})()',ctx);
   await ctx.api.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:false,flatten:true},ctx.pageSession);
   await ctx.api.send('Page.enable',{},ctx.pageSession);await ctx.api.send('Runtime.enable',{},ctx.pageSession);
   // The capability probe is deliberately outside the consumer. Production
   // must never send this unsupported Worker command or absorb its error.
   let owner,probe;
   if(mode!=='page-crash'){
    await ctx.api.evaluate("globalThis.testWorker=new Worker(URL.createObjectURL(new Blob(['setInterval(()=>{},1000)'],{type:'text/javascript'})));true");
    for(let n=0;n<100&&!workers.size;n++)await wait(20);
    assert.equal(workers.size,1);await Promise.all(ctx.workerPromises);
    owner=[...workers.values()][0];assert(owner.targetId&&owner.sessionId&&owner.generation>0);
    assert(!frames.some(q=>q.method==='Inspector.enable'&&q.sessionId===owner.sessionId));
    assert.equal(frames.filter(q=>q.method==='Inspector.enable'&&q.sessionId===ctx.pageSession).length,1);
    probe=await raw('Inspector.enable',{},owner.sessionId);assert.equal(probe.error.code,-32601);assert.match(probe.error.message,/Inspector.enable/);
    assert(!saved['terminal-error.json']);
    // A detach during startup must cancel before any capture has bound owners.
    if(mode!=='worker-detach')ctx.api.bindOwnerCapture({after:{worker:owner},capture:{identity:{rendererTarget:'none'}}});
   }
   if(mode==='capabilities'){
    assert.equal(await ctx.api.evaluate('1+1',owner.sessionId),2);
    results.push({mode,passed:true,product:saved['browser-version.json'].product,workerInspector:probe.error,pageInspector:true,workerRuntimeDebugger:true});
   }else{
    const request=ctx.api.evaluate('new Promise(()=>{})',mode==='page-crash'?ctx.pageSession:owner.sessionId).catch(e=>e);
    await wait(20);assert.equal(pending.size,1);
    if(mode==='worker-detach')await raw('Target.detachFromTarget',{sessionId:owner.sessionId},owner.parentSession??undefined);
    if(mode==='worker-destroy')await raw('Runtime.evaluate',{expression:'testWorker.terminate();true'},ctx.pageSession);
    if(mode==='page-crash')raw('Page.crash',{},ctx.pageSession); // crash intentionally has no reply
    if(mode==='connection-loss')ws.close();
    if(mode==='protocol-failure')await ctx.api.send('Runtime.noSuchNoxMethod',{},owner.sessionId).catch(()=>{});
    const error=await request;
    assert.match(error.message,mode==='connection-loss'?/CDP connection closed/:mode==='protocol-failure'?/-32601/:/current owner lifecycle loss/);
    const record=saved['terminal-error.json'];assert(record);assert.equal(pending.size,0);
    if(mode!=='connection-loss'&&mode!=='protocol-failure'){
     assert.equal(record.ownerLifecycle.owner.sessionId,mode==='page-crash'?ctx.pageSession:owner.sessionId);
     assert(record.ownerLifecycle.owner.generation>0);
     assert(events.some(e=>e.method===record.ownerLifecycle.event.method));
     if(mode==='page-crash')assert.equal(record.ownerLifecycle.event.method,'Inspector.targetCrashed');
    }
    const first=JSON.stringify(record),before=frames.length;
    await ctx.api.event({method:'Inspector.detached',sessionId:ctx.pageSession,params:{reason:'later failure'}});
    for(const command of [{action:'capture',label:'later'},{action:'key',key:'Space'},{action:'quit'}])await assert.rejects(ctx.api.execute(command,()=>assert.fail('later dispatch')));
    for(const method of ['Input.dispatchMouseEvent','Page.captureScreenshot','Browser.close'])await assert.rejects(ctx.api.send(method));
    assert.equal(frames.length,before);assert.equal(JSON.stringify(saved['terminal-error.json']),first);assert.equal(closes,1);
    results.push({mode,passed:true,firstFailure:record,zeroLaterCommands:true,independentRelease:true});
   }
  }finally{
   if(ws){ws.onclose=null;ws.onerror=null;ws.close();}
   try{process.kill(-browser.pid,'SIGTERM');}catch(e){assert.equal(e.code,'ESRCH');}
   const receipt=await browserWait;assert(receipt.stdoutEOF&&receipt.stderrEOF);save(dir+'/browser-wait.json',receipt);
   assert.throws(()=>process.kill(browser.pid,0),{code:'ESRCH'});
   watchdog.stdin.end();const receiptWatch=await watchdogWait;assert.equal(receiptWatch.code,0);assert(receiptWatch.stdoutEOF&&receiptWatch.stderrEOF);save(dir+'/watchdog-wait.json',receiptWatch);
   assert.equal(JSON.parse(fs.readFileSync(dir+'/watchdog.json')).fired,false);
   fs.rmSync(profile,{recursive:true,force:true});save(dir+'/wire.json',{frames,events,saved});
  }
 }
 save(out+'/results.json',{passed:true,actualLocalChrome:true,actualEmittedLifecycle:true,originalGameplay:false,results});console.log(JSON.stringify({passed:true,controls:results.length}));
}
async function menuControls(generated,out){
 if(fs.readFileSync(generated+'/browser-run.cjs','utf8').includes('executePassiveMenu')){
  cp.execFileSync(process.execPath,[path.join(root,'tools/nox-menu-admission.test.cjs'),generated,out],{stdio:'inherit'});return;
 }
 assert(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
 const source=fs.readFileSync(generated+'/browser-run.cjs','utf8');
 const begin=source.indexOf('let settledMenu=null;'),end=source.indexOf('\n(async()=>{',begin);
 assert(begin>0&&end>begin);const results=[];
 for(const mode of ['stable-settle','implicit-stable','transition-unchanged','moving-settle','moving-target','unsettled-target','stale-target','cancel-settle','late-settle','cancel-reply','cancel-target-reply','late-target-reply','cancel-settled-reply','late-settled-reply']){
  let now=1000,inputs=0,captures=0,reads=0,terminal=null;
  const canvas=require('../lib/canvas-compat').createCanvas(640,480);
  canvas.getContext('2d').fillRect(0,0,640,480);
  const image={label:'before',sha256:'a'.repeat(64),at:new Date(now).toISOString(),identity:{workerTarget:'worker'}};
  const ctx={assert,Date:class extends Date{static now(){return now;}},bound:{MAX_AGE_MS:120000},deadline:1000000,terminalError:null,noxAnchor:null,noxCommand:null,latest:image,
   out:'/offline',root,pointerObserverInstalled:true,save(){},validCaptureLabel(){},pageSession:'page',workers:new Map([['worker',{targetId:'worker',sessionId:'worker'}]]),
   sha:()=>image.sha256,fs:{existsSync:()=>false,readFileSync:p=>p.endsWith('-review.json')?JSON.stringify({...ctx.latest,review:'model full PNG review',settledMenu:true}):'image'},
   wait:async ms=>{now+=ms;if(ms===250&&mode==='cancel-settle')ctx.terminalError=Error('cancelled');if(ms===250&&mode==='late-settle')now=ctx.deadline;},
   capture:async label=>{captures++;ctx.latest={...image,label,at:new Date(now).toISOString()};if(mode==='cancel-reply')ctx.terminalError=Error('cancelled during capture');},
   evaluate:async expression=>{
    if(expression.includes('async function(rect)')){
     reads++;
     if(reads===4&&mode==='cancel-target-reply')ctx.terminalError=Error('cancelled target reply');
     if(reads===4&&mode==='late-target-reply')now=ctx.deadline;
     if(reads===3&&mode==='cancel-settled-reply')ctx.terminalError=Error('cancelled settled reply');
     if(reads===3&&mode==='late-settled-reply')now=ctx.deadline;
     if(['moving-settle','moving-target'].includes(mode)&&reads>(mode==='moving-target'?3:1)){
      const painter=canvas.getContext('2d');painter.fillStyle='#ff0000';painter.fillRect(250,250,100,30);
     }
     return vm.runInNewContext(expression,{document:{getElementById:()=>canvas},crypto:require('node:crypto').webcrypto});
    }
    if(expression.includes('__noxConsumption.begin'))return {active:true,cursor:{x:0,y:0}};
    if(expression==='window.noxPointerObserver.snapshot().state')return {reference:{x:0,y:0}};
    return {left:0,top:0,width:640,height:480};
   },send:async()=>{inputs++;return {};},require:n=>n==='./native-mouse.cjs'?{perform:async()=>{inputs++;return {};}}:require(n),
   chain:{admit:async(review,dispatch)=>{assert(now-Date.parse(ctx.latest.at)<=120000,'stale scene refused');return dispatch({live:{identity:ctx.latest.identity}});}}};
  vm.createContext(ctx);vm.runInContext(source.slice(begin,end)+';globalThis.run=execute;',ctx);
  const run=async c=>{if(terminal)throw terminal;try{await ctx.run(c,()=>{});}catch(e){ctx.terminalError=terminal=e;throw e;}};
  const settle={id:'settle',action:'capture',flow:'settle-menu',settleTarget:[250,250,100,30],reviewRef:'before',label:'settled',waitMs:1000};
  if(mode==='implicit-stable'){
   await assert.rejects(run({...settle,flow:undefined}),/transition unchanged/);
  }else if(mode==='transition-unchanged'){
   await assert.rejects(run({id:'input',action:'click',flow:'transition',point:[.5,.5],reviewRef:'before',label:'after',waitMs:0}),/transition unchanged/);assert.equal(inputs,1);
  }else if(mode==='unsettled-target'){
   await assert.rejects(run({id:'input',action:'click',flow:'transition',menuTarget:settle.settleTarget,point:[.45,.55],reviewRef:'before',label:'after',waitMs:0}),/settled menu required/);
  }else if(['moving-settle','cancel-settle','late-settle','cancel-reply','cancel-settled-reply','late-settled-reply'].includes(mode))await assert.rejects(run(settle),/moving|cancelled|late/);
  else{
   await run(settle);assert.equal(inputs,0);assert.equal(captures,1);
   if(mode!=='stable-settle'){
    if(mode==='stale-target')now+=120001;
    await assert.rejects(run({id:'input',action:'click',flow:'transition',menuTarget:settle.settleTarget,point:[.45,.55],reviewRef:'settled',label:'after',waitMs:0}),/moving menu target|stale|cancelled|late/);
    assert.equal(inputs,0);
   }
  }
  if(terminal){const before=[inputs,captures,reads];await assert.rejects(run(settle));assert.deepEqual([inputs,captures,reads],before,'sticky terminal rejects later capture/input/protocol');}
  results.push({mode,passed:true,inputs,captures,reads,terminal:!!terminal});
 }
 save(out+'/results.json',{passed:true,actualEmittedCaller:true,actualEmittedMenuRegion:true,results});console.log(JSON.stringify({passed:true,results}));
}
async function stagedMenuControls(generated,out){
 // Mount only delivered inputs at the checkout path. tmpfs hides the real
 // checkout, including node_modules; no source tree or media is archived.
 assert(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
 const pins=JSON.parse(fs.readFileSync(generated+'/runtime-pins.json'));current.verify(root,pins,generated);
 const fixtures=['20261110-nox-passive-menu-staff-target-0915/review/001-observe','20261110-nox-settled-network-staff-0610/review/main-menu-settled','20261110-nox-supported-worker-staff-target-0905/review/001-main','20261110-nox-settled-network-staff-0610/review/startup'];
 const files=new Set(pins.files.map(p=>p.path));
 for(const name of ['tools/nox-current-driver.test.cjs','tools/nox-menu-admission.test.cjs'])files.add(name);
 for(const f of fixtures)for(const suffix of ['.png','-state.json'])files.add('scratch/runs/'+f+suffix);
 const dirs=new Set();for(const f of files){let d=path.dirname(root+'/'+f);while(d.startsWith(root+'/')){dirs.add(d);d=path.dirname(d);}}
 const base=['--ro-bind','/','/','--tmpfs',root,'--proc','/proc','--dev','/dev'];
 for(const d of [...dirs].sort((a,b)=>a.length-b.length))base.push('--dir',d);
 for(const f of files)base.push('--ro-bind',root+'/'+f,root+'/'+f);
 base.push('--ro-bind',generated,generated,'--bind',out,out,'--chdir',root,'--unsetenv','NODE_PATH','--setenv','NODE_OPTIONS','--no-global-search-paths');
 const run=(name,args,extra=[])=>{
  const r=cp.spawnSync('bwrap',[...base,...extra,...args],{encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});
  fs.writeFileSync(out+'/'+name+'.stdout',r.stdout||'');fs.writeFileSync(out+'/'+name+'.stderr',r.stderr||'');return r;
 };
 const pre=run('original-preflight',[process.execPath,generated+'/browser-run.cjs'],['--setenv','DRIVER_PREFLIGHT','1','--setenv','BROWSER_DEADLINE',String(Date.now()+120000)]);
 assert.equal(pre.status,0,pre.stderr);
 const caller=run('original-menu-caller',[process.execPath,root+'/tools/nox-menu-admission.test.cjs',generated,out+'/caller']);
 assert.equal(caller.status,0,caller.stderr);
 const missing=root+'/node_modules/pngjs/lib/parser-sync.js';
 fs.writeFileSync(out+'/empty.cjs','');
 const negative=run('missing-dependency-original-preflight',[process.execPath,generated+'/browser-run.cjs'],['--ro-bind',out+'/empty.cjs',missing,'--setenv','DRIVER_PREFLIGHT','1','--setenv','BROWSER_DEADLINE',String(Date.now()+120000)]);
 assert.equal(negative.status,1);assert.match(negative.stderr,/immutable input node_modules\/pngjs\/lib\/parser-sync.js/);
 const decode=run('native-decode-missing-dependency',[process.execPath,'-e',`const fs=require('fs'),s=require('./tools/nox-menu-state.cjs');const p='scratch/runs/${fixtures[0]}';s.reviewed(fs.readFileSync(p+'.png'),JSON.parse(fs.readFileSync(p+'-state.json')).canvas,{kind:'main',rect:[130,110,400,250],labels:s.MAIN_LABELS})`],['--tmpfs',root+'/node_modules/pngjs/lib']);
 assert.equal(decode.status,1);assert.match(decode.stderr,/MODULE_NOT_FOUND/);
 save(out+'/results.json',{passed:true,stagedOnly:true,checkoutNodeModulesHidden:true,noGlobalSearchPaths:true,actualOriginalEntrypointPreflight:JSON.parse(pre.stdout),actualEmittedMenuCaller:JSON.parse(fs.readFileSync(out+'/caller/results.json')),missingDependencyRefusedBeforeBrowser:true,nativeDecodeMissingDependency:true,packageFiles:current.decoderFiles().map(p=>pins.files.find(f=>f.path===p))});
 console.log(JSON.stringify({passed:true,stagedOnly:true,controls:14,missingDependency:true}));
}
if(process.env.NOX_TEST_STAGED==='1')stagedMenuControls(path.resolve(process.argv[2]),path.resolve(process.argv[3])).catch(e=>{console.error(e);process.exitCode=1;});
else if(process.env.NOX_TEST_CHILD==='1')child().catch(e=>{console.error(e);process.exitCode=1;});
else if(require.main===module)(process.argv[2]==='--protocol-controls'?protocolControls(path.resolve(process.argv[3]),path.resolve(process.argv[4])):process.argv[2]==='--lifecycle-controls'?lifecycleControls(path.resolve(process.argv[3]),path.resolve(process.argv[4])):process.argv[2]==='--menu-controls'?menuControls(path.resolve(process.argv[3]),path.resolve(process.argv[4])):process.argv[2]==='--cdp-controls'?cdpControls(path.resolve(process.argv[3]),path.resolve(process.argv[4])):process.argv[2]==='--observer-controls'?observerControls(path.resolve(process.argv[3]),path.resolve(process.argv[4]),process.argv[5]?.split(',')):main()).catch(e=>{console.error(e.stack);process.exitCode=1;});
