'use strict';
// Original SDL x86 consumers, executed by the shipped interpreter. No movement
// implementation, browser, native browser fixture, clock edit, or live game.
const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto');
const root=require('path').resolve(__dirname,'..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const {createHostImports}=require(root+'/lib/host-imports');
const loader=require(root+'/lib/dll-loader');
// Preload only in an offline generated-workflow control. Run the unmodified
// browser entry point through startup and ordinary close, with native services
// replaced at their process/CDP boundary. Never launch local Chrome.
if(process.env.LB_OFFLINE_STARTUP==='1'){
 const Module=require('node:module'),events=require('node:events'),path=require('node:path');
 const originalLoad=Module._load,originalTimeout=global.setTimeout;
 const browserFile=path.resolve(process.argv[1]),run=path.dirname(browserFile),out=run+'/original';
 const pins=JSON.parse(fs.readFileSync(run+'/runtime-pins.json'));
 const moduleBytes=fs.readFileSync(root+'/'+pins.files.find(p=>p.path==='build/wine-assembly.wasm').path);
 const browser=new events.EventEmitter();browser.pid=999999;browser.exitCode=null;
 browser.kill=()=>{if(process.env.LB_OFFLINE_PAUSE==='1'){browser.exitCode=-15;queueMicrotask(()=>browser.emit('exit',null,'SIGTERM'));return true;}throw Error('offline startup must close normally')};
 const page={name:'lbreakout2_251',running:true,stopped:false,guestWorker:true,processId:7,
  pageRendererObject:'renderer',canvasObject:'canvas',processObject:'process',endpoint:'endpoint',endpointObject:'link',
  guestEndpoint:'endpoint',slot:0,workerObject:'worker',moduleObject:'module',epoch:'epoch',renderEndpoint:'none',
  renderEndpointObject:'none',renderWorkerObject:'none'};
 let socket,workerAttached=false,spawned=false,closed=false;
 let armed=false;const input=[];const pauseControl=process.env.LB_OFFLINE_PAUSE==='1';
 let completionArm=null,completionPolls=0,completionReady=false;
 const completionNegative=process.env.LB_OFFLINE_COMPLETION_NEGATIVE;
 function evaluated(s,session){
  if(s.startsWith('new Promise((resolve,reject)=>')){assert(completionReady,'presentation follows original completion');return {presented:true};}
  if(s.includes('__mcmPassiveIdentityV1'))return {isolated:true,apps:[page]};
  if(s.includes('__mcmPassiveInstanceV1'))return session==='guest-session'?{endpointIdentity:'endpoint',slot:0,instance:'instance'}:{endpointIdentity:'secondary-'+session,slot:1,instance:session};
  if(s==='globalThis.__lbArm()'){assert.equal(session,'guest-session','observer must arm bound owning Worker');armed=true;return {armed:true};}
  if(s.startsWith('globalThis.__lbArm(')){
   assert.equal(session,'guest-session');armed=true;completionReady=false;completionPolls=0;
   completionArm={...JSON.parse(s.slice('globalThis.__lbArm('.length,-1)),deadline:Date.now()+2000,binding:{exe:0x400000,sdl:0x5f0000,generation:1}};
   return {armed:true,...completionArm};
  }
  if(s==='globalThis.__lbObserver.snapshot()'){
   assert(armed&&input.length>=2,'balanced delivery precedes completion poll');
   completionPolls++;
   if(completionNegative==='binding')return {...completionArm,token:'foreign-command',active:false,reason:'complete'};
   if(completionNegative==='module')return {...completionArm,binding:{generation:99},active:false,reason:'complete'};
   if(completionNegative==='incomplete')return {...completionArm,active:false,reason:'deadline',records:[{kind:'sdl-p-return',down:1}]};
   if(completionNegative==='failure')throw Error('offline observer failed');
   completionReady=completionPolls>=3;
   return {...completionArm,active:!completionReady,reason:completionReady?'complete':null,records:completionReady?[{kind:'guest-complete'}]:[{kind:'sdl-p-return',down:1}]};
  }
  if(s.includes("getContext('2d')?.constructor"))return 'CanvasRenderingContext2D';
  if(s.includes('fixtureReturnedCoordinates'))return {apps:[page],backend:'CanvasRenderingContext2D'};
  if(s.startsWith('!!('))return true;
  if(s.includes('innerWidth'))return {innerWidth:1024,innerHeight:855};
  return [];
 }
 class Socket{
  constructor(){socket=this;this.readyState=1;queueMicrotask(()=>this.onopen());}
  close(){this.readyState=3;}
  send(raw){const v=JSON.parse(raw);let result={};
   if(v.method==='Target.getTargets')result={targetInfos:[{type:'page',targetId:'page'}]};
   if(v.method==='Target.attachToTarget')result={sessionId:'page-session'};
   if(v.method==='Debugger.getScriptSource')result={bytecode:moduleBytes.toString('base64')};
   if(v.method==='Runtime.evaluate')result={result:{value:evaluated(v.params.expression,v.sessionId)}};
   if(v.method==='Input.dispatchKeyEvent'){assert(armed,'arm precedes native input');input.push(pauseControl?[v.params.type,v.params.key]:v.params.type);}
   if(v.method==='Page.getLayoutMetrics')result={cssContentSize:{x:0,y:0,width:1024,height:855}};
   if(v.method==='Page.captureScreenshot'){
    if(completionArm)assert(completionReady,'FIRST screenshot requires guest completion, SDL alone insufficient');
    result={data:Buffer.from('offline startup pixels; no visual acceptance').toString('base64')};
   }
   queueMicrotask(()=>this.onmessage({data:JSON.stringify({id:v.id,result})}));
   if(v.method==='Page.navigate'&&!workerAttached){workerAttached=true;
    queueMicrotask(()=>this.onmessage({data:JSON.stringify({method:'Target.attachedToTarget',params:{sessionId:'guest-session',targetInfo:{type:'worker',targetId:'guest',url:'/guest-worker.js'}}})}));
    queueMicrotask(()=>this.onmessage({data:JSON.stringify({method:'Debugger.scriptParsed',sessionId:'guest-session',params:{scriptLanguage:'WebAssembly',scriptId:'wasm',url:'wasm://offline'}})}));
    for(const n of [1,2])queueMicrotask(()=>this.onmessage({data:JSON.stringify({method:'Target.attachedToTarget',params:{sessionId:'thread-'+n,targetInfo:{type:'worker',targetId:'secondary-'+n,url:'/guest-worker.js'}}})}));
   }
   if(v.method==='Browser.close'){closed=true;browser.exitCode=0;queueMicrotask(()=>browser.emit('exit',0,null));}
  }
 }
 global.WebSocket=Socket;
 global.setTimeout=(fn,ms,...args)=>originalTimeout(fn,ms===3000?0:ms,...args);
 Module._load=function(name,parent,isMain){
  const value=originalLoad.apply(this,arguments);
  if(name==='node:child_process')return {...value,spawn:(exe,args)=>{
   assert.equal(exe,'/usr/bin/google-chrome');assert(!spawned);spawned=true;
   assert.equal(process.env.CASE_TAG,'original');assert(Number(process.env.BROWSER_DEADLINE)>Date.now());
   fs.mkdirSync(out+'/chrome-profile');fs.writeFileSync(out+'/chrome-profile/DevToolsActivePort','1234\n/offline');return browser;
  }};
  if(name.endsWith('/test/static-server.js'))return {...value,startStaticServer:async()=>({
   address:()=>({port:1234}),prependListener(){},closeAllConnections(){},close:fn=>fn()
  })};
  if(name==='./transport.cjs')return {...value,consume:async(p,n,execute)=>{
   assert(n<=(pauseControl?2:1));const latest=JSON.parse(fs.readFileSync(out+'/latest.json'));
   assert.equal(latest.label,n===0?'startup':n===1?(pauseControl?'paused':'after-left'):'after-play');assert.equal(latest.identity.renderEndpoint,'none');
   value.publish(out+'/'+latest.label+'-review.json',{...latest,review:'offline adapter only; no real image review',decision:'continue'});
   if(pauseControl){
    if(n===0){
     const command={id:'offline-pause',action:'key',key:'p',holdMs:80,waitMs:0,label:'paused',observe:true,reviewRef:'startup'};
     if(completionNegative){
      await assert.rejects(execute(command,()=>{}));
      assert(!fs.existsSync(out+'/paused.png'));assert(fs.existsSync(out+'/first-browser-failure.json'));
      const count=input.length;
      for(const action of ['key','capture','quit'])await assert.rejects(execute({...command,action},()=>{}),/terminal/);
      assert.equal(input.length,count);assert.deepEqual(input,[['keyDown','p'],['keyUp','p']]);
      value.publish(run+'/offline-completion-negative.json',{passed:true,negative:completionNegative,actualGeneratedConsumer:true,noFirstImage:true,stickyTerminal:true});return true;
     }
     await execute(command,()=>{});assert.deepEqual(input,[['keyDown','p'],['keyUp','p']]);
     if(completionArm)assert.equal(completionPolls,3);return true;
    }
    if(n===1){
     // Exercise the real generated consumer's binding checks before any edge.
     const c={id:'offline-play',action:'play',key:'ArrowLeft',holdMs:40,playMs:80,waitMs:0,label:'after-play',reviewRef:'paused',pauseConfirmed:'paused'};
     await assert.rejects(execute({...c,reviewRef:'foreign'},()=>{}),/review previous/);
     const review=JSON.parse(fs.readFileSync(out+'/paused-review.json'));
     value.publish(out+'/paused-review.json',{...review,sha256:'foreign'});
     await assert.rejects(execute(c,()=>{}));
     value.publish(out+'/paused-review.json',review);assert.equal(input.length,2);
     await execute(c,()=>{});
     assert.deepEqual(input,[['keyDown','p'],['keyUp','p'],['keyDown','p'],['keyUp','p'],['keyDown','ArrowLeft'],['keyUp','ArrowLeft'],['keyDown','p'],['keyUp','p']]);
     // A visual terminal decision is sticky before any later native operation.
     const after=JSON.parse(fs.readFileSync(out+'/latest.json'));
     value.publish(out+'/after-play-review.json',{...after,review:'terminal offline negative',decision:'stop'});
     const count=input.length;await assert.rejects(execute({...c,reviewRef:'after-play',label:'forbidden'},()=>{}),/terminal visual/);
     await assert.rejects(execute({...c,reviewRef:'after-play',label:'forbidden'},()=>{}),/terminal: input closed/);
     assert.equal(input.length,count);assert(!fs.existsSync(out+'/forbidden.png'));
     value.publish(run+'/offline-pause-control.json',{passed:true,actualGeneratedConsumer:true,balancedPauseResumePlay:true,commandImageBinding:true,firstFailureTerminal:true,noLocalChrome:true});
     // Terminal cancellation deliberately kills the fake Chrome; no quit.
     browser.exitCode=-15;browser.emit('exit',null,'SIGTERM');return true;
    }
   }
   if(n===0){await execute({id:'offline-left',action:'key',key:'ArrowLeft',holdMs:80,waitMs:0,label:'after-left',observe:true,reviewRef:'startup'},()=>{});assert(armed);assert.deepEqual(input,['keyDown','keyUp']);return true;}
   await execute({action:'quit',reviewRef:'after-left'},()=>{});
   assert(spawned&&workerAttached&&closed&&socket.readyState===3);
   value.publish(run+'/offline-startup-control.json',{passed:true,entireBrowserEntryPoint:true,literalDeadline:true,threeGuestWorkers:true,observedShortInput:true,independentRelease:true,noLocalChrome:true,fixtureRerun:false});return true;
  }};
  return value;
 };
} else {
(async()=>{
 const bytes=fs.readFileSync(root+'/build/wine-assembly.wasm');
 const dll=fs.readFileSync(root+'/test/binaries/candidates/lbreakout2-251/game/LBREAKOUT/SDL.dll');
 assert.equal(hash(dll),'0b5aeef9054872cce11992679ad05a5bc96e5a4cfb515da8983e2e1f2ecbbbd8','original LBreakout SDL required');
 const module=await WebAssembly.compile(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
 const ctx={getMemory:()=>memory.buffer,renderer:null,resourceJson:{}};
 let observer;
 const imports=createHostImports(ctx);imports.host.memory=memory;
 imports.host.log_eip=pc=>observer?.boundary(pc>>>0);
 for(const x of WebAssembly.Module.imports(module))if(x.kind==='function'&&!imports.host[x.name])imports.host[x.name]=()=>{throw Error('unexpected import '+x.name)};
 const e=(await WebAssembly.instantiate(module,imports)).exports;ctx.exports=e;
 const b=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),pe=fs.readFileSync(root+'/test/binaries/candidates/lbreakout2-251/game/LBREAKOUT/lbreakout2.exe');assert.equal(hash(pe),'cc1fd5c3d229cc1d4f910e658f5abefa80ef8ebf4b5e47801648f0be0e1ca244','original LBreakout EXE required');b.set(pe,e.get_staging());assert(e.load_pe(pe.length));
 const mapped=loader.loadDll(e,memory.buffer,dll,'C:\\fixture\\SDL.dll'),base=mapped.loadAddr,wa=p=>e.guest_to_wasm(p)>>>0;
 const stack=e.guest_alloc(65536)+65520;let calls=0;
 function call(rva,args=[],absolute=false){
  e.set_esp(stack);e.call_func(absolute?rva:base+rva,...Array.from({length:4},(_,i)=>args[i]||0));const entry=e.get_esp()>>>0;
  if(args.length>4)dv.setUint32(wa(entry+20),args[4]>>>0,true);
  for(let n=0;n<20000&&e.get_eip();n++){e.run(100);assert.equal(e.get_yield_reason(),0,'unexpected yield');}
  observer?.boundary();
  assert.equal(e.get_eip(),0,'bounded native return');assert.equal(e.get_esp()>>>0,entry+4,'cdecl return');calls++;return e.get_eax()>>>0;
 }
 loader.patchExeImports(e,memory.buffer,pe,[{name:'SDL.dll'}]);
 const observerModule=require(root+'/lib/lbreakout-input-observer');
 assert.equal(await observerModule.install(),null,'default inert without dependencies');
 observer=await observerModule.install({enabled:true,exports:e,memory,exeBytes:pe,sdlBytes:dll,limit:2048,durationMs:3000});
 // Execute the real WinDIB keymap initializer and key-message consumer; the
 // consumer calls TranslateKey and SDL_PrivateKeyboard in this same DLL.
 call(0x10c20);
 const count=e.guest_alloc(4),keys=call(0x19810,[count]);assert.equal(dv.getUint32(wa(count),true),323);
 const key=sym=>b[wa(keys+sym)];
 const event=(vk,down,scan=0)=>call(0x10a10,[0,0x10001,down?0x100:0x101,vk,((scan<<16)|(down?1:0xc0000001))>>>0]);
 const rows=[];
 for(const [name,vk,sym,scan] of [['Right',39,275,0x4d],['Left',37,276,0x4b],['Space',32,32,0x39],['Pause',80,112,0x19]]){
  assert.equal(key(sym),0);
  event(vk,true,scan);assert.equal(key(sym),1,name+' actual SDL DOWN');
  const held=key(sym);event(vk,false,scan);assert.equal(key(sym),0,name+' actual SDL UP');
  rows.push({name,heldRead:held,readAfterBothMessages:key(sym)});
 }
 // SDL ignores WM_KEYDOWN whose Win32 previous-state bit is set: repeat is
 // generated by SDL itself. This checks real lParam consumption too.
 call(0x10a10,[0,0x10001,0x100,39,0x404d0001]);assert.equal(key(275),0);
 // Test-only paddle/surface structures and config. All movement and fire
 // decisions execute the ORIGINAL _paddle_handle_events at 0x405904.
 // These writes are never used in an original gameplay session.
 const paddle=e.guest_alloc(256),surface=e.guest_alloc(64),w32=(p,n)=>dv.setUint32(wa(p),n>>>0,true),f32=(p,n)=>dv.setFloat32(wa(p),n,true),f64=(p,n)=>dv.setFloat64(wa(p),n,true);
 w32(0x452464,surface);w32(surface+8,640);w32(paddle+20,60);
 for(const [p,n] of [[0x476c50,276],[0x476c54,275],[0x476c58,121],[0x476c5c,32],[0x476c60,8],[0x476c64,120],[0x476c6c,99]])w32(p,n);
 f64(0x476c90,.5);
 const frame=()=>{call(0x405904,[paddle,16],true);return {x:dv.getFloat32(wa(paddle+8),true),rightFire:dv.getUint32(wa(paddle+92),true)}};
 f32(paddle+8,320);w32(paddle+12,320);
 event(39,true,0x4d);event(39,false,0x4d);const collapsed=frame();assert.equal(collapsed.x,320);
 event(39,true,0x4d);const held=frame();assert.equal(held.x,328);event(39,false,0x4d);const released=frame();assert.equal(released.x,328);
 event(37,true,0x4b);const left=frame();assert.equal(left.x,320);event(37,false,0x4b);
 event(32,true,0x39);const fire=frame();assert.equal(fire.rightFire,1);event(32,false,0x39);const fireUp=frame();assert.equal(fireUp.rightFire,0);
 // A separate early-return cause has the same output even with SDL DOWN.
 // Name only its observed role; no historical value of this field was saved.
 w32(paddle+60,1);event(39,true,0x4d);const inhibited=frame();assert.equal(inhibited.x,320);event(39,false,0x4d);
 // The original browser also has a buffered DirectInput keyboard. Exercise
 // SDL's DX5 translation/consumer, not only its WinDIB alternate route.
 call(0x138a0);w32(paddle+60,0);
 const records=e.guest_alloc(32);
 const di=(edges)=>{
  edges.forEach(([dik,down],i)=>[dik,down?128:0,100+i,i+1].forEach((v,j)=>w32(records+i*16+j*4,v)));
  call(0x13070,[edges.length,records]);
 };
 di([[25,true]]);assert.equal(key(112),1,'original DX5 P delivery');
 di([[25,false]]);assert.equal(key(112),0,'original DX5 P release');
 f32(paddle+8,320);w32(paddle+12,320);
 di([[205,true],[205,false]]);const diCollapsed=frame();assert.equal(diCollapsed.x,320);
 di([[205,true]]);assert.equal(key(275),1);const diHeld=frame();assert.equal(diHeld.x,328);
 di([[205,false]]);const diReleased=frame();assert.equal(diReleased.x,328);
 di([[203,true]]);const diLeft=frame();assert.equal(diLeft.x,320);di([[203,false]]);
 di([[57,true]]);const diFire=frame();assert.equal(diFire.rightFire,1);
 di([[57,false]]);const diFireUp=frame();assert.equal(diFireUp.rightFire,0);
 w32(paddle+60,1);di([[205,true]]);const diInhibited=frame();assert.equal(diInhibited.x,320);di([[205,false]]);
 observer.stop('offline-complete');
 const observation=observer.snapshot(),entries=observation.records.filter(r=>r.kind==='paddle-entry'),returns=observation.records.filter(r=>r.kind==='paddle-return');
 assert.equal(entries.length,14,'every original paddle invocation observed');assert.equal(returns.length,entries.length,'actual original returns observed');
 for(const offset of [0,7]){
  assert.equal(entries[offset].keys.right,0,'collapsed state at actual handler');
  assert.equal(returns[offset].paddle.x,320);
  assert.equal(entries[offset+1].keys.right,1,'held state at actual handler');
  assert.equal(returns[offset+1].paddle.x,328);
  assert.equal(entries[offset+6].keys.right,1);assert.equal(entries[offset+6].paddle.inhibit,1);
  assert.equal(returns[offset+6].paddle.x,320);
 }
 assert(observation.records.some(r=>r.kind==='dx5-entry'&&r.events.length===2));
 assert(observation.records.some(r=>r.kind==='get-key-state-entry'));
 assert(observation.records.some(r=>r.kind==='private-keyboard-return'&&r.keys.right===1));
 assert(!observation.records.some(r=>r.kind==='observer-error'));
 if(process.env.OBSERVER_OUTPUT)fs.writeFileSync(process.env.OBSERVER_OUTPUT,JSON.stringify(observation,null,2));
 await assert.rejects(observerModule.install({enabled:true,exports:e,memory,exeBytes:Buffer.from(pe).fill(0,0,1),sdlBytes:dll}),/authentic/);
 await assert.rejects(observerModule.install({enabled:true,limit:2049}),/bounds/);
 let clock=100;
 const expired=await observerModule.install({enabled:true,exports:e,memory,exeBytes:pe,sdlBytes:dll,now:()=>clock,durationMs:1});
 clock=101;expired.boundary();assert.equal(expired.snapshot().active,false,'bounded expiry before guest observation');
 let stopReason;
 const bounded=await observerModule.install({enabled:true,exports:e,memory,exeBytes:pe,sdlBytes:dll,limit:8,durationMs:3000,emit:r=>{if(r.kind==='observer-stop')stopReason=r.reason}});
 observer=bounded;for(let i=0;i<4;i++)event(39,Boolean(i%2),0x4d);
 assert.equal(bounded.snapshot().active,false);assert.equal(stopReason,'record-limit');assert.equal(bounded.snapshot().records.length,8);

 console.log(JSON.stringify({pass:true,scope:'original SDL WinDIB + DX5 keyboard consumers, SDL_GetKeyState, original game paddle handler; offline interpreter with isolated test objects/config',module:hash(bytes),sdl:hash(dll),exe:hash(pe),base,calls,observer:{paddleEntries:entries.length,paddleReturns:returns.length,records:observation.records.length,expiryAndRecordLimit:true,authenticMediaRejection:true},rows,repeatIgnored:true,paddle:{collapsed,held,released,left,fire,fireUp,inhibited},directInput:{collapsed:diCollapsed,held:diHeld,released:diReleased,left:diLeft,fire:diFire,fireUp:diFireUp,inhibited:diInhibited},priorOriginalCause:'unestablished'},null,2));
})().catch(e=>{console.error(e.stack);process.exitCode=1});
}
