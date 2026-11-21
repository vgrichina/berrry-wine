'use strict';
const assert=require('node:assert/strict');
const {createBrowserNativeInput}=require('../lib/browser-native-input.js');
function fixture(options={trusted:()=>true}){
  let wall=1000,mono=0;
  const memory={buffer:new ArrayBuffer(4096)},module={},scene=[1,7,10,10,0,0,1,0,1,0];
  const exports={wnd_lookup_live:h=>h===10,wnd_lookup_generation:()=>1n,get_window_thread:()=>1};
  const instance={exports},win={visible:true,wasm:instance,wasmMemory:memory,processId:7};
  const renderer={wasm:instance,wasmMemory:memory,canvas:{},windows:{10:win},inputQueue:[],
    handleKeyDown(code){this.inputQueue.push({hwnd:10,msg:0x100,wParam:code,lParam:1});this.downHook?.();},
    handleKeyUp(){this.upHook?.();},peekKeyDownState:()=>0};
  const hostImports={check_input(){},input_validate(){},input_consumed(){}},
    actor={slot:0,worker:{},endpointIdentity:1,module,memory},
    wine={renderer,instance,memory,_wasmModule:module,_processObject:{},processId:7,running:true,
      hostCtx:{instance},guestWorker:{link:actor,module,memory,hostImports}};
  const guard=createBrowserNativeInput(wine,{now:()=>wall,monotonic:()=>mono,...options});
  wine.hostCtx.guardedInput=hostImports.browserInputScope=guard;
  const call=(name,fn)=>guard.withActor(0,name,fn),observe=()=>call('check_input',()=>guard.observe(scene));
  observe();
  const prepare=()=>{const b=guard.bind();guard.prepare({owner:b.owner,nonce:'sdl',reviewed:true,
    reviewedAt:wall,imageSHA256:'a'.repeat(64),code:13,mode:'game'});};
  const down=()=>{renderer.handleKeyDown(13);return call('check_input',()=>guard.dequeued(renderer.inputQueue.shift()));};
  const consume=token=>{const v=new DataView(memory.buffer);[10,0x100,13,1].forEach((n,i)=>v.setUint32(32+4*i,n,true));
    return call('input_consumed',()=>guard.consumed(token,1,32,1,1,[...scene,32]));};
  return {wine,guard,actor,renderer,instance,hostImports,scene,prepare,down,consume,observe,
    clock:(w,m)=>{wall=w;mono=m;}};
}
// Default production provenance, without injecting a permissive trusted hook.
// These are unit event objects, not browser/native physical-input evidence.
{
  const f=fixture();f.prepare();
  f.renderer.downHook=()=>f.renderer.handleKeyUp(13,{browserInputCancellation:'blur'});
  assert.equal(f.down(),0);
  assert.equal(f.renderer.inputQueue.length,0);
  const receipt=f.guard.status('sdl');assert.equal(receipt.state,'UNKNOWN');
  assert.equal(receipt.ownershipCancellation.reason,'blur');assert.equal(receipt.physicalUp,null);
}
global.window={event:{type:'keydown',keyCode:13,isTrusted:true}};
for(const event of [
  {type:'blur',isTrusted:true}, {type:'fullscreenchange',isTrusted:true},
  {type:'visibilitychange',isTrusted:true}, {type:'keyup',keyCode:27,isTrusted:true},
  {type:'keyup',keyCode:13,isTrusted:false},
]){
  const f=fixture({trusted:undefined});window.event={type:'keydown',keyCode:13,isTrusted:true};
  f.prepare();assert.equal(f.consume(f.down()),1);
  window.event=event;f.renderer.handleKeyUp(13);
  assert.equal(f.guard.status('sdl').physicalUp,null,JSON.stringify(event));
}
for(const reason of ['blur','hidden','fullscreen-exit']){
  const f=fixture({trusted:undefined});window.event={type:'keydown',keyCode:13,isTrusted:true};
  f.prepare();assert.equal(f.consume(f.down()),1);
  // Even cancellation nested in a trusted keyup cannot certify physical UP.
  window.event={type:'keyup',keyCode:13,isTrusted:true};
  f.renderer.handleKeyUp(13,{browserInputCancellation:reason});
  let receipt=f.guard.status('sdl');assert.equal(receipt.state,'CONSUMED');
  assert.equal(receipt.physicalUp,null);assert.equal(receipt.ownershipCancellation.reason,reason);
  f.renderer.handleKeyUp(13);receipt=f.guard.status('sdl');
  assert.equal(receipt.physicalUp,null,'late UP cannot recertify cancelled ownership');
}
{
  const f=fixture({trusted:undefined});window.event={type:'keydown',keyCode:13,isTrusted:true};
  f.prepare();assert.equal(f.consume(f.down()),1);
  window.event={type:'keyup',keyCode:13,isTrusted:true};
  let entered=false;
  f.renderer.upHook=()=>{
    if(entered)return;entered=true;
    f.renderer.handleKeyUp(13);
    throw Error('wake hook');
  };
  assert.throws(()=>f.renderer.handleKeyUp(13,{browserInputCancellation:'fullscreen-exit'}),/wake hook/);
  assert.equal(f.guard.status('sdl').physicalUp,null);
  assert.equal(f.guard.status('sdl').ownershipCancellation.reason,'fullscreen-exit');
}
{
  const f=fixture({trusted:undefined});window.event={type:'blur',isTrusted:true};
  f.prepare();assert.equal(f.down(),0,'trusted blur cannot stand in for DOM keydown');
  assert.equal(f.guard.status('sdl').appliedAt,null);
}
{
  const f=fixture({trusted:undefined});window.event={type:'keydown',keyCode:13,isTrusted:true};
  f.prepare();assert.equal(f.consume(f.down()),1);
  window.event={type:'keyup',keyCode:13,isTrusted:true};f.renderer.handleKeyUp(13);
  assert.equal(f.guard.status('sdl').physicalUp.trusted,true);
}
delete global.window;
{
  const f=fixture();assert.equal(f.guard.snapshot().ready,true);f.prepare();const token=f.down();
  assert(token>0);assert.equal(f.guard.status('sdl').consumed,false);
  assert.equal(f.consume(token),1);f.renderer.handleKeyUp(13);
  assert.equal(f.renderer.peekKeyDownState(13),0);
  assert.throws(()=>f.guard.prepare({nonce:'sdl'}));
}
const faults={
  actor:f=>f.wine.guestWorker.link={...f.actor},worker:f=>f.actor.worker={},
  endpoint:f=>f.actor.endpointIdentity++,module:f=>f.actor.module={},memory:f=>f.actor.memory={},
  hostModule:f=>f.wine.guestWorker.module={},hostMemory:f=>f.wine.guestWorker.memory={},
  renderer:f=>f.wine.renderer={...f.renderer},rendererMemory:f=>f.renderer.wasmMemory={},
  context:f=>f.wine.hostCtx={...f.wine.hostCtx},contextInstance:f=>f.wine.hostCtx.instance={},
  inputSite:f=>f.hostImports.check_input=()=>0,validateSite:f=>f.hostImports.input_validate=()=>0,
  consumedSite:f=>f.hostImports.input_consumed=()=>0,exports:f=>f.instance.exports={...f.instance.exports},
  dead:f=>f.actor._stopped=true,retiring:f=>f.actor._stopping=true,
  retired:f=>f.actor._retirementComplete=true,transport:f=>f.actor._transportFailure=Error('fault'),
  ambiguous:f=>f.actor._writerAmbiguous=true,focus:f=>{f.scene[3]=11;f.observe();},
  generation:f=>f.instance.exports.wnd_lookup_generation=()=>2n,
  stale:f=>f.clock(1251,251),deadline:f=>{f.clock(1500,500);f.observe();},
  graphics:f=>f.wine.hostCtx.getGlGpsBridge=()=>({endpoint:{closed:true}}),
};
for(const [name,mutate]of Object.entries(faults)){
  const f=fixture();f.prepare();const token=f.down();mutate(f);
  assert.equal(f.consume(token),0,name);assert.equal(f.guard.status('sdl').consumed,false,name);
}
for(const mutate of [f=>f.actor.worker=null,f=>f.actor.endpointIdentity=null,f=>f.wine.hostCtx.guardedInput=null,
  f=>f.hostImports.browserInputScope=null,f=>f.instance.exports.wnd_lookup_live=undefined]){
  const f=fixture();mutate(f);assert.equal(f.guard.snapshot().ready,false);assert.throws(()=>f.guard.bind());
}
{
  const f=fixture();let bridge={endpoint:{closed:false}};
  f.wine.hostCtx.getGlGpsBridge=()=>bridge;f.observe();bridge=null;
  assert.equal(f.guard.snapshot().ready,false,'retiring graphics cannot reuse its scene as a software observation');
}
console.log('PASS software CPU ownership, USER receipt, replacement/focus/stale/dead-owner/deadline/one-use faults');

// Actual CPUWorker frames, never an accepted synthetic witness. The browser
// supplies only a renderer edge; ordinary guest APIs move focus/destroy a page.
async function dialogWorkerCases(){
  const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
  const {bootRenderHarness}=require('./render-helper'),{GuestThreadHost}=require('../lib/guest-thread-host');
  const module=new WebAssembly.Module(fs.readFileSync(process.env.WINE_TEST_MODULE||'build/wine-assembly.wasm'));
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'browser-dialog-input-')),results=[];
  try{for(const mode of ['stable','page-replace','target-destroy','retained-age','deadline','cancel','actor-replace','root-destroy','exports-replace']){
    const dir=path.join(tmp,mode),pePath=require('../tools/ut-goty-listbox-wizard.cjs').prepare(dir,{transition:true,destroyTarget:mode==='target-destroy'});
    let source=fs.readFileSync(dir+'/wizard.c','utf8');
    source=source.replace('long r=CallWindowProcA(oldButton,h,m,w,l);',
      'if(m==0x100&&w==65){'+(mode==='stable'?'return 1;':mode==='root-destroy'?'EndDialog(frame,0);return 1;':
      'SendMessageA(frame,0x111,1,(long)h);return 1;')+'}long r=CallWindowProcA(oldButton,h,m,w,l);');
    source=source.replace('ShowWindow(h,1);SetFocus(list);','ShowWindow(h,1);SetFocus(next);');
    fs.writeFileSync(dir+'/wizard.c',source);
    cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',dir+'/wizard.c','-o',dir+'/wizard.obj']);
    cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',pePath,dir+'/wizard.obj',dir+'/kernel32.lib',dir+'/user32.lib',dir+'/gdi32.lib']);
    const pe=fs.readFileSync(pePath),h=await bootRenderHarness({prebuiltModule:module,fonts:'none'}),e=h.exports,memory=h.memory;
    new Uint8Array(memory.buffer).set(pe,e.get_staging());assert(e.load_pe(pe.length));
    let guard,token=0,target=0,clock=1000,entry=false,returned=false,negativeCount=0;
    const renderer=h.renderer,instance={exports:e};renderer.wasm=instance;renderer.wasmMemory=memory;
    renderer.handleKeyDown=function(code){this.inputQueue.push({hwnd:0,msg:0x100,wParam:code,lParam:0});};
    renderer.handleKeyUp=function(){};
    const imports={...h.host,check_input:(...v)=>{
      guard.observe(v);guard.sweep();const event=renderer.inputQueue.find(v=>guard.owns(v));if(!event)return 0;
      renderer.inputQueue.splice(renderer.inputQueue.indexOf(event),1);const value=guard.dequeued(event);if(value===false)return 0;
      token=value;target=event.hwnd;return event.msg|(event.wParam<<16);
    },check_input_token:()=>token,check_input_hwnd:f=>target||f,check_input_lparam:()=>0,
    input_validate:(t,...v)=>guard.validate(t,v),input_consumed:(t,tid,p,k,r,...v)=>{
      const envelope=v[11];assert(Object.isFrozen(envelope)&&Object.isFrozen(envelope.words));
      // Mutate only rejected copies of the actual transported attachment.
      // In particular this tests every retained word, both generation halves,
      // invocation/root/depth/epoch/ESP/callback and entry/return distinction.
      for(let i=0;i<32;i++){
        const bad=Object.freeze({...envelope,words:Object.freeze(envelope.words.map((n,j)=>j===i?n+1n:n))});
        assert.equal(guard.consumed(t,tid,p,k,r,[...v.slice(0,11),bad]),0,mode+' word '+i);negativeCount++;
      }
      for(const [key,value]of Object.entries({slot:1,endpointIdentity:envelope.endpointIdentity+1,threadId:2,
        ptr:p+4,token:t+1,kind:k===6?7:6,remove:0,sequence:0})){
        assert.equal(guard.consumed(t,tid,p,k,r,[...v.slice(0,11),Object.freeze({...envelope,[key]:value})]),0,key);negativeCount++;
      }
      assert.equal(guard.consumed(t,tid,p,k,r,v.slice(0,11)),0,'missing attachment');
      assert.equal(guard.withActor(1,'input_consumed',()=>guard.consumed(t,tid,p,k,r,v)),0,'helper slot');
      if(k===7&&mode==='deadline')clock=1501;
      if(k===7&&mode==='cancel')guard.close('test cancellation');
      if(k===7&&mode==='actor-replace')host.link.worker={};
      if(k===7&&mode==='retained-age')clock=1270;
      if(k===7&&mode==='exports-replace'){
        instance.exports={...e,dialog_get_proc_export:()=>1};
      }
      const result=guard.consumed(t,tid,p,k,r,v);
      if(k===6){entry=true;assert.equal(result,1,mode);assert.equal(guard.status('native').consumed,false,'entry is no receipt');
        assert.equal(guard.consumed(t,tid,p,k,r,v),0,'duplicate entry');}
      else{assert.equal(k,7);returned=true;
        assert.equal(result,+['stable','page-replace','target-destroy','retained-age'].includes(mode),mode);
        assert.equal(guard.consumed(t,tid,p,k,r,v),0,'terminal return never revives');}
      return result;
    }};
    const host=new GuestThreadHost({memory,module,hostImports:imports,sigs:require('../lib/host-import-sigs.generated.json').sigs,
      workerUrl:path.resolve(__dirname,'../lib/guest-worker.js'),clockIntervalMs:0});
    await host.start();const wine={renderer,instance,memory,_wasmModule:module,_processObject:{},processId:1000,running:true,
      guestWorker:host,hostCtx:{instance}};
    guard=createBrowserNativeInput(wine,{trusted:()=>true,now:()=>clock,monotonic:()=>clock});
    wine.hostCtx.guardedInput=imports.browserInputScope=guard;
    const originalWorker=host.link.worker;
    try{
      await host.loadPe(pe,'browser-modal.exe');const call=(n,...a)=>host.callExport(n,...a);
      await call('set_process_id',1000);await call('set_current_thread_id',1);await call('set_esp',0x7408000);await call('guest_write32',0x7408000,0);
      const until=async pred=>{for(let i=0;i<800;i++){if(await pred())return;const y=await call('get_yield_reason');
        if([1,6,7,15].includes(y))await call('clear_yield');const result=await host.link.slice(128);assert(!result.trapped,JSON.stringify(result));}
        throw Error('modal browser deadline '+mode);};
      await until(()=>guard.snapshot().ready);
      const before=guard.snapshot(),binding=guard.bind();assert.notEqual(before.scene[2],before.scene[3]);
      // Another actual actor's passive observation cannot replace the modal.
      guard.withActor(1,'input_validate',()=>guard.validate(-1,[2,1000,before.scene[2],0,0,0,1,0,0,0,clock,
        performance.timeOrigin+clock,host.link.endpointIdentity]));assert.deepEqual(guard.snapshot().scene,before.scene);
      guard.prepare({owner:binding.owner,nonce:'native',reviewed:true,reviewedAt:clock,imageSHA256:'a'.repeat(64),code:65});
      renderer.handleKeyDown(65);host.broker.publish({inputPending:1});await until(()=>returned);
      const receipt=guard.status('native');assert(entry&&returned);
      if(['stable','page-replace','target-destroy','retained-age'].includes(mode)){
        assert(receipt.consumed);assert.equal(receipt.receiptBoundary,'native-dialog-input-invocation-return');
        assert.equal(receipt.nativeMessage.dialogHwnd,before.scene[2]);assert.equal(receipt.nativeMessage.hwnd,before.scene[3]);
        if(mode!=='stable')assert.notEqual(receipt.nativeMessage.focusAfter,before.scene[3]);
      }else assert(!receipt.consumed);
      results.push({mode,negativeCount});
    }finally{host.link.worker=originalWorker;await host.stop();}
  }}finally{fs.rmSync(tmp,{recursive:true,force:true});}
  console.log('PASS actual CPUWorker browser DialogBox entry/retained return and lifecycle/attachment negatives '+JSON.stringify(results));
}
if(require.main===module)dialogWorkerCases().catch(e=>{console.error(e);process.exitCode=1;});
