'use strict';
// Opt-in actual native SDL/HTTP integration. Output and retained module holder
// are supplied by the caller; no retained evidence is a tracked test input.
const fs=require('node:fs'),path=require('node:path'),net=require('node:net'),cp=require('node:child_process'),assert=require('node:assert/strict');
const k=require('../tools/native-supervisor-common.cjs'),c=require('../tools/lmarbles-controller.cjs');
const ROOT=path.resolve(__dirname,'..');
const BOOT=String.raw`
const fs=require('node:fs'),path=require('node:path');
const broker=require('./lib/cli-guarded-input'),create=broker.createGuardedInput;
broker.createGuardedInput=options=>{
 const value=create(options),consumed=value.nativeConsumed;
 const compound=value.compound;
 value.compound=function(envelope,events,enqueue){let i=0;return compound.call(this,envelope,events,(event,ticket)=>{
  if(i++&&['compound-modal','compound-capture'].includes(process.env.NATIVE_CAPTURE_FAULT))setTimeout(()=>{
   fs.writeFileSync(path.join(process.env.LMARBLES_CONTROL_OUT,'guest-context-before-second.json'),JSON.stringify(options.captureDelivery()));enqueue(event,ticket);
  },100);else enqueue(event,ticket);
 });};
 value.nativeConsumed=function(token,proof){
  const result=consumed.call(this,token,proof),fault=process.env.NATIVE_CAPTURE_FAULT;
  if(result&&proof.wParam===39&&!this.changed&&fault.startsWith('compound-')){
   this.changed=true;const e=proof.actorExports,r=options.snapshot().refs.renderer;
   const before=options.captureDelivery();
   if(fault==='compound-focus')e.set_focus(0);
   if(fault==='compound-owner')e.set_process_id(e.get_process_id()+1);
   if(fault==='compound-queue')r.inputQueue=[];
   if(fault==='compound-foreign')r.handleKeyDown(65);
   if(fault==='compound-release')value.release(options.snapshot().refs.owner || globalThis.compoundOwner);
   fs.writeFileSync(path.join(process.env.LMARBLES_CONTROL_OUT,'prefix-context.json'),JSON.stringify({before,after:options.captureDelivery()}));
  }return result;
 };return value;
};
// Model a native application that updates its window back canvas without
// requesting a display composite. Capture must invoke the real composite.
const {Win98Renderer}=require('./lib/renderer'),paint=Win98Renderer.prototype.repaint;
Win98Renderer.prototype.repaint=function(...args){
 if(!globalThis.nativeCaptureActive)return;
 const result=paint.apply(this,args);globalThis.nativeCapturePainted=true;return result;
};
const transport=require('./lib/control-server'),start=transport.startControlServer;
transport.startControlServer=options=>start({...options,onCommand(command){
 if(command.action==='guarded-key-chord')globalThis.compoundOwner=command.guard.owner;
 if(command.action==='guarded-key-chord'&&process.env.NATIVE_CAPTURE_FAULT==='compound-legacy')return (async()=>{
  const edges=[];
  for(let i=0;i<command.keys.length;i++){
   if(i===1){const actual=options.onCommand({action:'snapshot'});fs.writeFileSync(path.join(process.env.LMARBLES_CONTROL_OUT,'legacy-operands.json'),JSON.stringify({expected:command.guard.intent,actual,failures:require('./lib/cli-native-scene').contextFailures(actual,command.guard.intent)}));}
   edges.push(await options.onCommand({action:'guarded-input',cmd:command.keys[i],guard:{...command.guard,nonce:command.guard.nonce+'/'+i}}));
  }
  return {...edges.at(-1),edges};
 })();
 if(command.action==='native-scene-capture'){
  globalThis.nativeCaptureActive=true;globalThis.nativeCapturePainted=false;
  try{const value=options.onCommand(command);if(!globalThis.nativeCapturePainted)throw Error('capture omitted native display composite');return value;}
  finally{globalThis.nativeCaptureActive=false;}
 }
 const result=options.onCommand(command);
 if(command.action==='guarded-release'&&process.env.NATIVE_CAPTURE_FAULT==='unknown-slow-release')
  return new Promise(resolve=>setTimeout(()=>resolve(result),350));
 if(command.action!=='guarded-input'&&command.action!=='guarded-key-chord')return result;
 return Promise.resolve(result).then(value=>{
  if(['unknown','compound-unknown','unknown-slow-release'].includes(process.env.NATIVE_CAPTURE_FAULT))return new Promise(resolve=>setTimeout(()=>resolve(value),650));
  if(process.env.NATIVE_CAPTURE_FAULT==='release'){
   options.onCommand({action:'eval',code:'exports.set_focus(0);true'});
   const focus=options.onCommand({action:'eval',code:'exports.get_focus_hwnd()'});
   fs.writeFileSync(path.join(process.env.LMARBLES_CONTROL_OUT,'changed-focus-before-release.json'),JSON.stringify({focus}));
  }
  return value;
 });
}});
process.argv=['node','test/run.js',...process.argv.slice(1)];require('./test/run.js');
`;
async function freePort(){return new Promise(resolve=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});}
function animatedFixture(file,mode=''){
 const source=require('./test-ltris-sdl-keyboard.cjs').prepare(),b=Buffer.from(fs.readFileSync(source.file));
 const raw=r=>r-0x1000+0x400,program=raw(0x2000);
 const idle=b.indexOf(Buffer.from([0x68,10,0,0,0,0xff,0x15,0x10,0x13,0x40,0,0x83,0xc4,4]),program);
 // Find SDL_Delay by import position (fifth SDL export).
 assert(idle>=program,'SDL_Delay idle loop');
 const paint=b.indexOf(Buffer.from([0xff,0x35,0x04,0x35,0x40,0]),program);
 assert(paint>=program);const destination=raw(0x2f00);
 // Ordinary native loop increments the RGB565 fill and flips every idle.
 Buffer.from([0x66,0x81,0x05,0x04,0x35,0x40,0,0x21,0x08,0xe9,0,0,0,0]).copy(b,destination);
 b.writeInt32LE(paint-(destination+14),destination+10);
 assert.equal(b[idle+14],0xe9);b.writeInt32LE(destination-(idle+19),idle+15);
 // A fixture-only Escape branch calls real public USER mouse capture APIs.
 // This creates genuine native capture ownership for the capture negative.
 const descriptor=raw(0x1028);b.writeUInt32LE(0x1880,descriptor);b.writeUInt32LE(0x1c40,descriptor+12);b.writeUInt32LE(0x1800,descriptor+16);
 b.writeUInt32LE(80,0x80+24+108);b.write('user32.dll\0',raw(0x1c40));
 for(const [i,n] of ['SetCapture','GetActiveWindow','MessageBoxA'].entries()){const name=0x1c80+i*32;b.writeUInt32LE(name,raw(0x1800+i*4));b.writeUInt32LE(name,raw(0x1880+i*4));b.write(n+'\0',raw(name+2));}
 const escape=b.indexOf(Buffer.from([0x81,0x3d,0x48,0x35,0x40,0,27,0,0,0]),program);
 const loop=b.indexOf(Buffer.from([0x68,0x40,0x35,0x40,0,0xff,0x15,0x0c,0x13,0x40,0]),program),grab=raw(0x2f40);
 assert(escape>=program&&loop>=program);assert.equal(b[escape+10],0x0f);
 b.writeInt32LE(grab-(escape+16),escape+12);
 Buffer.from([0xff,0x15,0x04,0x18,0x40,0,0x50,0xff,0x15,0,0x18,0x40,0,0xe9,0,0,0,0]).copy(b,grab);
 b.writeInt32LE(loop-(grab+18),grab+14);
 if(mode==='transition'){
  // Enter returns from the real SDL/USER pump, then the guest spends 900ms
  // loading before publishing a different menu. Loading is native work,
  // not a delayed host reply or a fabricated consumption acknowledgement.
  b.writeUInt32LE(0x1d80,raw(0x1204));b.writeUInt32LE(0x1d80,raw(0x1404));
  b.write('GetTickCount\0',raw(0x1d82));b.write('Authored SDL loaded menu\0',raw(0x3600));
  const enter=b.indexOf(Buffer.from([0x81,0x3d,0x48,0x35,0x40,0,13,0,0,0]),program);
  assert(enter>=program);const load=raw(0x2fa0),code=[];
  const u=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24],emit=(...v)=>code.push(...v);
  emit(0xff,0x15,...u(0x401204),0x89,0xc3);
  const repeat=code.length;
  emit(0xff,0x15,...u(0x401204),0x29,0xd8,0x3d,...u(900),0x0f,0x82);
  emit(...u(repeat-code.length-4));
  emit(0x6a,0,0x68,...u(0x403600),0xff,0x15,...u(0x401308),0x83,0xc4,8,0xe9);
  emit(...u(loop-(load+code.length+4)));Buffer.from(code).copy(b,load);
  b[enter+16]=0xe9;b.writeInt32LE(load-(enter+21),enter+17);
 }
 if(['compound-modal','compound-capture'].includes(mode)){
  // The authored guest itself enters a real modal/capture API after returning
  // the first SDL Right key (SDLK_RIGHT=275), before another scheduled edge.
  b.writeUInt32LE(275,escape+6);
  if(mode==='compound-modal'){
   const code=Buffer.from([0x6a,0,0x68,0,0x30,0x40,0,0x68,0,0x30,0x40,0,0x6a,0,0xff,0x15,0x08,0x18,0x40,0,0xe9,0,0,0,0]);
   code.writeInt32LE(loop-(grab+code.length),code.length-4);code.copy(b,grab);
  }
 }
 fs.writeFileSync(file,b,{flag:'wx'});return {file,sha256:k.sha256(b)};
}
async function main(){
 const out=path.resolve(process.env.NATIVE_CAPTURE_TEST_OUT),holder=path.resolve(process.env.LMARBLES_MODULE_HOLDER);
 fs.mkdirSync(out,{recursive:true});
 const cases=process.argv.slice(2);if(!cases.length)cases.push('positive','mismatch','stale','owner','focus','modal','replacement','capture','authority','release','unknown',
  'compound','compound-legacy','compound-focus','compound-modal','compound-capture','compound-owner','compound-queue','compound-foreign','compound-release','compound-unknown');
 for(const name of cases){
  const dir=path.join(out,name);fs.mkdirSync(dir);const fixture=animatedFixture(path.join(dir,'animated.exe'),name);fs.writeFileSync(path.join(dir,'fixture.json'),JSON.stringify(fixture));c.R=dir;c.URL='http://127.0.0.1:'+await freePort()+'/ctl';
  Object.assign(process.env,{LMARBLES_CONTROL_OUT:dir,LMARBLES_CONTROL_URL:c.URL,NATIVE_CAPTURE_FAULT:name});
  if(process.env.NATIVE_CAPTURE_TIMING)Object.assign(process.env,{
   WINE_PUBLIC_INPUT_TRACE:path.join(dir,'input-trace.jsonl'),WINE_CONTROL_PHASE_TRACE:path.join(dir,'control-phases.json')});
  const media=path.join(ROOT,'test/binaries/candidates/lmarbles-108/game/LMARBLES');
  const args=['node','-e',BOOT,'--','--exe='+fixture.file,'--no-build','--threads','--real-ticks','--screen=1024x712','--max-seconds=55','--max-batches=10000000','--stuck-after=0','--control='+new URL(c.URL).port,'--quiet-api','--quiet-blocks','--no-close','--env=SDL_VIDEODRIVER=windib',...['SDL.dll','libgcc_s_sjlj-1.dll','libwinpthread-1.dll'].map(n=>'--dll-seed='+path.join(media,n)),'--dll-seed='+path.join(ROOT,'test/binaries/dlls/msvcrt.dll')];
  c.save('recipe.json',{cwd:ROOT,args,seconds:355,reserveSeconds:300,watchdogGrace:2,nativeScene:true,moduleHolder:holder,inputPolicy:{confirmationMs:500,physicalUpMs:1750,observationMs:3000,gameFreshnessSeconds:5,menuFreshnessSeconds:30}});
  const p=cp.spawn(process.execPath,['tools/lmarbles-supervisor.cjs','durablewait',dir],{cwd:ROOT,stdio:['ignore','pipe','pipe']});const waited=k.communicate(p);let error;
  try{
   const until=performance.now()+20000;
   for(;;){try{const s=await c.call({action:'snapshot'},1);if(s.mainHwnd!=='0x0'&&s.focusWindow.live&&fs.existsSync(path.join(dir,'native-pid.json')))break;}catch{}assert(performance.now()<until,'native SDL readiness');await k.sleep(50);}
   async function capture(stem){await c.capture(stem);return c.read(stem+'.json').image;}
   const first=await capture('first');await k.sleep(200);const second=await capture('second');
   const rgba=require('pngjs').PNG.sync.read(fs.readFileSync(path.join(dir,'first.png'))).data;
   assert(rgba.some((v,i)=>i%4!==3&&v!==0),'actual complete composed fixture image is nonblack');
   assert.notEqual(first.receipt.pngSHA256,second.receipt.pngSHA256,'actual ordinary native animation continues');
   const expected={route:'native-scene-v1',snapshot:first.snapshot,pngSHA256:first.receipt.pngSHA256,receipt:first.receipt};
   if(name==='mismatch')expected.receipt=second.receipt;
   if(name==='stale')await k.sleep(30100);
   const faults={owner:'exports.set_process_id(exports.get_process_id()+1);true',focus:'exports.set_focus(0);true',modal:'exports.test_create_color_dialog()',replacement:'const h=exports.get_main_hwnd();exports.wnd_destroy_tree(h);exports.test_wnd_table_set(h,0xffff0001);true',authority:'renderer.inputQueue=[];true'};
   if(faults[name])await c.call({action:'eval',code:faults[name]});
   if(name==='capture'){
    await c.call({cmd:'keydown:27'});await k.sleep(100);await c.call({cmd:'keyup:27'});await k.sleep(100);
    const native=await c.call({action:'snapshot'});c.save('native-capture-owner.json',native);assert.notEqual(native.capture,'0x0');assert(native.physicalUp);
   }
   if(['mismatch','stale','owner','focus','modal','replacement','capture','authority'].includes(name)){
    await assert.rejects(c.call({action:'guarded-bind',reviewedScene:expected}),/mismatch|stale|scene changed/);
    c.save('assertions.json',{refusedBeforeOwner:true,down:0,animated:true});c.fail('authored negative complete',name);
   }else{
    c.save('first-review.json',{at:k.now(),pngSHA256:first.receipt.pngSHA256,scene:'menu',observation:'Automated authored animated fixture binding; no personal game review claim'});
    await c.bind('first');const owner=c.read('input-owner.json');
    const fresh=await capture('fresh');c.save('fresh-review.json',{at:k.now(),pngSHA256:fresh.receipt.pngSHA256,scene:'game',observation:'Automated animated native fixture; no personal game review claim'});
    const compound=name.startsWith('compound'),keys=compound?['keydown:39','keydown:32']:['keydown:13'];
    if(['unknown','unknown-slow-release','release'].includes(name)||(compound&&name!=='compound'))await assert.rejects(c.pulse('press',keys,250,'fresh','authored native HTTP fault and independent release'));
    else await c.pulse('press',keys,250,'fresh','authored native finite keys and independent release');
    const up=c.read('press-up.json');assert.equal(up.state,'ACK');assert(up.reply.released);assert.equal(up.reply.owner,owner.owner);
    if(name==='unknown-slow-release'){
     const dispatch=c.read('press-dispatch.json');
     c.save('release-latency.json',{afterDispatchMs:(up.at-dispatch.at)*1000,limitMs:1750,
      releaseReplyDelayMs:350,downReplyDelayMs:650});
     assert((up.at-dispatch.at)*1000<=1750,'independent UP confirmation must fit the unchanged 1750ms bound after UNKNOWN');
    }
    if(!['positive','compound','transition'].includes(name)){assert(c.read('terminal-input-failure.json').noReplay);assert.throws(()=>c.opened(),/sticky UNKNOWN/);}
    if(name==='transition'){
     const consumed=c.read('press-down.json')[0];assert.equal(consumed.nativeMessage.consumption,'owner-user-return');
     const end=Date.now()+4000;let loaded;
     do{loaded=await c.call({action:'snapshot'},.5);if(loaded.windows.some(w=>w.title==='Authored SDL loaded menu'))break;await k.sleep(20);}while(Date.now()<end);
     assert(loaded.windows.some(w=>w.title==='Authored SDL loaded menu'));
     assert(Date.now()-consumed.consumedAt>=850,'native loading follows exact owner consumption');
     await capture('loaded');
    }
    if(compound){
     const diagnostic=fs.readdirSync(dir).find(n=>/^press-.*-diagnostic.json$/.test(n)&&!n.includes('release'));
     const value=c.read(diagnostic).rawReply?.value;
     c.save('compound-wire.json',{diagnostic,value});
     if(name==='compound'){
      const edges=c.read('press-down.json');assert.equal(edges.length,2);assert.deepEqual(edges.map(e=>e.nativeMessage.wParam),[39,32]);assert(edges.every(e=>e.nativeMessage.consumption==='owner-user-return'));
      const zero=await c.call({action:'snapshot'});assert(zero.physicalUp);
      const base=edges[0].nonce.slice(0,-2);
      const aggregate=await c.call({action:'guarded-status',nonce:base});
      assert.equal(aggregate.owner,owner.owner);assert.equal(aggregate.epoch,owner.epoch);
      assert.equal(aggregate.state,'CANCELLED');assert(aggregate.consumed);
      assert.equal(aggregate.reason,'independent release');
      assert.deepEqual(aggregate.edges.map(e=>e.nonce),edges.map(e=>e.nonce));
      assert(aggregate.edges.every(e=>e.consumed&&e.nativeMessage.consumption==='owner-user-return'));
      c.save('post-chord-status.json',aggregate);
      const retainedDown=fs.readFileSync(path.join(dir,'press-down.json'));
      await assert.rejects(c.pulse('press-down',['keydown:40'],160,'fresh','Authored colliding artifact name'),/artifact name already used/);
      assert.deepEqual(fs.readFileSync(path.join(dir,'press-down.json')),retainedDown);
      assert(!fs.existsSync(path.join(dir,'terminal-input-failure.json')));
      // lease() must query the base nonce through the real HTTP handler, then
      // the next ordinary Escape must cross the real native USER boundary.
      await capture('next');
      c.save('next-review.json',{at:k.now(),pngSHA256:c.read('next.json').pngSHA256,scene:'game',observation:'Authored actual native post-chord Escape; no personal original game claim'});
      await c.pulse('next-escape',['keydown:27'],250,'next','Authored native post-chord Escape');
      const escape=c.read('next-escape-down.json')[0];
      assert.equal(escape.nativeMessage.wParam,27);assert.equal(escape.nativeMessage.consumption,'owner-user-return');
      assert.equal(c.read('next-escape-up.json').state,'ACK');
      c.save('post-chord-next-escape.json',{aggregate,escape,up:c.read('next-escape-up.json'),actualNative:true});
      await assert.rejects(c.call({action:'guarded-key-chord',keys,guard:{...owner,nonce:edges[0].nonce.split('/')[0],reviewed:true,deadline:Date.now()+1000,intent:c.read('fresh.json').snapshot}}),/nonce/);
     }else if(name!=='compound-unknown'){
      const d=c.read(diagnostic),reply=d.rawReply;
      assert(reply?.value?.edges?.[0]?.consumed,'first edge actually consumed before true change');
      assert(!reply.value.edges[1]?.handlerApplied,'second edge refused before effect');
     }
    }
    if(name==='release')assert.equal(c.read('changed-focus-before-release.json').focus,0);
    c.save('assertions.json',{animated:true,boundIssuedFirstImage:true,independentUp:up,stickyUnknown:!['positive','compound','transition'].includes(name),nativeLoading:name==='transition'});
   }
  }catch(e){error=e;c.save('fixture-error.json',{error:e.stack});}finally{
   c.save('cancel-request.json',{at:k.now(),fixtureOnly:true,nativeQuit:false});
   const w=await waited;c.save('tool-wait.json',{pid:p.pid,exit:w.returncode,actualWait:true,stdoutEOF:true,stderrEOF:true,stdout:w.stdout,stderr:w.stderr});
   for(const n of ['native-wait.json','watchdog-wait.json','outer-child-wait.json','outer-wait.json']){const v=c.read(n);assert(v.actualWait&&v.stdoutEOF&&v.stderrEOF,n);assert.equal(v.exit,0,n);}
  }
  if(error)throw error;console.log('PASS native animated capture binding '+name);
 }
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
module.exports={animatedFixture};
