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
 const originalRead=fs.readFileSync,originalLoad=Module._load,originalSpawn=cp.spawn;
 let browser,compiled=false,firstMouseFault=false,workerAttached=false,stdoutEOF=false,stderrEOF=false;
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
 const originalCompile=Module.prototype._compile;
 Module.prototype._compile=function(source,filename){if(filename===consumer){compiled=true;assert.equal(current.sha(Buffer.from(source)),JSON.parse(originalRead(path.join(generated,'runtime-pins.json'))).generated.find(p=>p.path==='browser-run.cjs').sha256);}return originalCompile.call(this,source,filename);};
 cp.spawn=(command,args)=>{
   assert.equal(command,'/usr/bin/google-chrome');assert(!faults[mode],'refusal must precede browser');
   const profile=args.find(a=>a.startsWith('--user-data-dir=')).slice(16);
   browser=originalSpawn(process.execPath,['-e',"process.stdin.once('data',()=>{process.stdout.write('closed\\n');process.stderr.write('closed\\n');process.stdin.destroy();});",profile],{stdio:['pipe','pipe','pipe']});
   browser.stdout.resume();browser.stderr.resume();browser.stdout.on('end',()=>stdoutEOF=true);browser.stderr.on('end',()=>stderrEOF=true);
   browser.once('close',(code,signal)=>save(dir+'/child-wait.json',{code,signal,stdoutEOF,stderrEOF}));
   fs.mkdirSync(profile,{recursive:true});fs.writeFileSync(profile+'/DevToolsActivePort','1\n/devtools/browser/offline\n');return browser;
 };
 Module._load=function(name,parent,main){
   if(name===root+'/test/static-server.js')return {startStaticServer:async()=>({address:()=>({port:1}),prependListener(){},closeAllConnections(){},close:fn=>fn()})};
   return originalLoad.call(this,name,parent,main);
 };
 globalThis.fetch=async url=>{const u=new URL(url);assert.equal(u.origin,'http://127.0.0.1:1');const b=fs.readFileSync(root+u.pathname);return {status:200,arrayBuffer:async()=>b};};
 const canvas={},instance={},worker={},link={endpointIdentity:1,slot:0,worker,module:{}};
 const wine={processId:7,running:true,_stopped:false,guestWorker:{link},renderer:{peekKeyDownState:()=>0},_workerLastSlice:{batch:1}};
 function context(){
   const listeners=new Map();const ctx={console,crypto:require('node:crypto').webcrypto,crossOriginIsolated:true,runningApps:[],performance,Set,WeakMap,Map,Atomics,
     document:{getElementById:id=>id==='screen'?Object.assign(canvas,{width:640,height:480,getBoundingClientRect:()=>({left:0,top:34,width:945,height:855})}):{textContent:''}},
     addEventListener:(type,fn)=>{if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);}};
   ctx.window=ctx;ctx.emit=(type,e)=>{for(const fn of listeners.get(type)||[])fn({type,isTrusted:true,...e});};return vm.createContext(ctx);
 }
 let page=context();const workerCtx=vm.createContext({endpointIdentity:1,workerSlot:0,instance,crypto:require('node:crypto').webcrypto});
 class Peer{
   constructor(url){assert.equal(url,'ws://127.0.0.1:1/devtools/browser/offline');this.readyState=1;queueMicrotask(()=>this.onopen());}
   deliver(v){this.onmessage({data:JSON.stringify(v)});}
   reply(q,result={},error){this.deliver({id:q.id,...(error?{error}:{result})});}
   send(raw){
     const q=JSON.parse(raw);protocol.push(q);
     queueMicrotask(()=>{
       try{
         let r={};
         if(q.method==='Browser.getVersion')r={product:'OFFLINE_NODE_PEER'};
         else if(q.method==='Target.getTargets')r={targetInfos:[{type:'page',targetId:'page'}]};
         else if(q.method==='Target.attachToTarget')r={sessionId:'page-session'};
         else if(q.method==='Page.navigate'){
           page=context();if(q.params.url.includes('app=nox_demo')){
             assert(!workerAttached);workerAttached=true;page.runningApps=[{name:'nox_demo',wine}];
             this.deliver({method:'Target.attachedToTarget',params:{sessionId:'worker-session',targetInfo:{type:'worker',targetId:'guest',url:'http://127.0.0.1:1/lib/guest-worker.js'}}});
             this.deliver({method:'Debugger.scriptParsed',sessionId:'worker-session',params:{scriptLanguage:'WebAssembly',url:'wasm://offline',scriptId:'1',hash:'offline'}});
           }
         }else if(q.method==='Runtime.evaluate'){
           const value=vm.runInContext(q.params.expression,q.sessionId==='worker-session'?workerCtx:page);
           r={result:{value:JSON.parse(JSON.stringify(value===undefined?null:value))}};
         }else if(q.method==='Debugger.getScriptSource')r={bytecode:fs.readFileSync(root+'/build/wine-assembly.wasm').toString('base64')};
         else if(q.method==='Input.dispatchKeyEvent'){
           const p=q.params,type=p.type==='keyDown'?'keydown':'keyup';page.emit(type,{key:p.key,code:p.code});deliveries.push({type,key:p.key});
           if(p.type==='keyDown'&&(p.text||p.key==='Enter'))page.emit('keypress',{key:p.key});
         }else if(q.method==='Input.dispatchMouseEvent'){
           const p=q.params;deliveries.push(p);page.emit(p.type==='mousePressed'?'mousedown':p.type==='mouseReleased'?'mouseup':'mousemove',p);
           if(mode==='drag-failure'&&p.type==='mousePressed'&&!firstMouseFault){firstMouseFault=true;return this.reply(q,{}, {code:-1,message:'OFFLINE_FIRST_DRAG_FAILURE'});}
         }else if(q.method==='Page.captureScreenshot')r={data:Buffer.from('offline screenshot bytes').toString('base64')};
         else if(q.method==='Browser.close'){this.reply(q);browser.stdin.end('close\n');return;}
         else assert(['Target.setDiscoverTargets','Target.setAutoAttach','Page.enable','Runtime.enable','Debugger.enable'].includes(q.method),q.method);
         this.reply(q,r);
       }catch(e){this.reply(q,{}, {message:e.stack});}
     });
   }
   close(){this.readyState=3;}
 }
 globalThis.WebSocket=Peer;
 process.on('exit',code=>save(dir+'/peer.json',{mode,code,compiled,protocol,deliveries,chromeStarted:false,browserPeerOnly:true}));
 process.env.BROWSER_DEADLINE=String(Date.now()+120000);
 if(mode==='ordinary')process.env.NO_ORIGINAL='1';
 if(!faults[mode]&&mode!=='ordinary'){
   (async()=>{
     const out=generated+'/original';while(!fs.existsSync(out+'/ready.json')){if(fs.existsSync(out+'/first-browser-failure.json'))return;await wait(20);}
     const transport=require(generated+'/transport.cjs');
     const latest=JSON.parse(fs.readFileSync(out+'/latest.json'));save(out+'/'+latest.label+'-review.json',{...latest,review:'Offline peer review for actual consumer control flow only'});
     try{await transport.request(out,'drag',{action:'drag',button:'right',point:[.3,.4],to:[.6,.7],holdMs:200,waitMs:0,label:'drag',reviewRef:latest.label},3000);}
     catch(e){if(mode!=='drag-failure')throw e;return;}
     assert.equal(mode,'drag');await transport.request(out,'quit',{action:'quit'},3000);
   })().catch(e=>{console.error(e);process.exitCode=3;});
 }
 require(consumer);
}
async function main(){
 const generated=path.resolve(process.argv[2]||''),out=path.resolve(process.argv[3]||'');
 assert(process.argv[2]&&process.argv[3]&&out.startsWith(root+'/scratch/runs/'));assert(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
 const manifest=JSON.parse(fs.readFileSync(generated+'/runtime-pins.json'));assert(current.verify(root,manifest,generated));
 const results=[];
 // The unchanged driver actually executes its full strict preflight.
 const pre=cp.spawnSync(process.execPath,[generated+'/browser-run.cjs'],{env:{...process.env,DRIVER_PREFLIGHT:'1',BROWSER_DEADLINE:String(Date.now()+120000)},encoding:'utf8'});
 assert.equal(pre.status,0,pre.stderr);results.push({mode:'current-preflight',status:pre.status,proof:JSON.parse(pre.stdout)});
 for(const mode of ['primary','compat','source','media','historical','repin','ordinary','drag','drag-failure']){
   const dir=out+'/'+mode;fs.mkdirSync(dir);
   // The actual generated source is shared; move only its run-specific outputs
   // after each execution, retaining every failure and ordinary-close artifact.
   const r=cp.spawnSync(process.execPath,[__filename],{env:{...process.env,NOX_TEST_CHILD:'1',NOX_TEST_MODE:mode,NOX_TEST_DIR:dir,NOX_TEST_GENERATED:generated},encoding:'utf8',timeout:45000,maxBuffer:1024*1024});
   fs.writeFileSync(dir+'/stdout',r.stdout||'');fs.writeFileSync(dir+'/stderr',r.stderr||'');
   const peer=JSON.parse(fs.readFileSync(dir+'/peer.json'));assert(peer.compiled);assert.equal(peer.chromeStarted,false);
   if(['primary','compat','source','media','historical','repin'].includes(mode)){
     assert.equal(r.status,1,r.stderr);assert.equal(peer.protocol.length,0);assert.match(r.stderr,mode==='repin'?/immutable current plan/:/immutable input/);
   }else{
     const source=generated+'/'+(mode==='ordinary'?'production-preflight':'original');fs.renameSync(source,dir+'/runtime');
     const joined=JSON.parse(fs.readFileSync(dir+'/child-wait.json'));assert.deepEqual(joined,{code:0,signal:null,stdoutEOF:true,stderrEOF:true});
     assert.equal(r.status,mode==='drag-failure'?1:0,r.stderr);
     assert.equal(peer.protocol.filter(q=>q.method==='Browser.close').length,1);
     assert(!fs.existsSync(dir+'/runtime/chrome-profile'));
     const mouse=peer.deliveries.filter(p=>p.type==='mousePressed'||p.type==='mouseReleased');
     if(mode!=='ordinary'){assert.deepEqual(mouse.map(p=>p.type),['mousePressed','mouseReleased']);assert(mouse.every(p=>p.button==='right'));}
     if(mode==='drag-failure'){
       const failure=JSON.parse(fs.readFileSync(dir+'/runtime/first-browser-failure.json'));assert.match(failure.error,/OFFLINE_FIRST_DRAG_FAILURE/);
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
if(process.env.NOX_TEST_CHILD==='1')child().catch(e=>{console.error(e);process.exitCode=1;});
else if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
