'use strict';
// Opt-in actual native SDL/HTTP integration. Output and retained module holder
// are supplied by the caller; no retained evidence is a tracked test input.
const fs=require('node:fs'),path=require('node:path'),net=require('node:net'),cp=require('node:child_process'),assert=require('node:assert/strict');
const k=require('../tools/native-supervisor-common.cjs'),c=require('../tools/lmarbles-controller.cjs');
const ROOT=path.resolve(__dirname,'..');
const BOOT=String.raw`
const fs=require('node:fs'),path=require('node:path');
const transport=require('./lib/control-server'),start=transport.startControlServer;
transport.startControlServer=options=>start({...options,onCommand(command){
 const result=options.onCommand(command);
 if(command.action!=='guarded-input')return result;
 return Promise.resolve(result).then(value=>{
  if(process.env.NATIVE_CAPTURE_FAULT==='unknown')return new Promise(resolve=>setTimeout(()=>resolve(value),650));
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
function animatedFixture(file){
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
 for(const [i,n] of ['SetCapture','GetActiveWindow'].entries()){const name=0x1c80+i*32;b.writeUInt32LE(name,raw(0x1800+i*4));b.writeUInt32LE(name,raw(0x1880+i*4));b.write(n+'\0',raw(name+2));}
 const escape=b.indexOf(Buffer.from([0x81,0x3d,0x48,0x35,0x40,0,27,0,0,0]),program);
 const loop=b.indexOf(Buffer.from([0x68,0x40,0x35,0x40,0,0xff,0x15,0x0c,0x13,0x40,0]),program),grab=raw(0x2f40);
 assert(escape>=program&&loop>=program);assert.equal(b[escape+10],0x0f);
 b.writeInt32LE(grab-(escape+16),escape+12);
 Buffer.from([0xff,0x15,0x04,0x18,0x40,0,0x50,0xff,0x15,0,0x18,0x40,0,0xe9,0,0,0,0]).copy(b,grab);
 b.writeInt32LE(loop-(grab+18),grab+14);
 fs.writeFileSync(file,b,{flag:'wx'});return {file,sha256:k.sha256(b)};
}
async function main(){
 const out=path.resolve(process.env.NATIVE_CAPTURE_TEST_OUT),holder=path.resolve(process.env.LMARBLES_MODULE_HOLDER);
 fs.mkdirSync(out,{recursive:true});const fixture=animatedFixture(path.join(out,'animated.exe'));fs.writeFileSync(path.join(out,'fixture.json'),JSON.stringify(fixture));
 const cases=process.argv.slice(2);if(!cases.length)cases.push('positive','mismatch','stale','owner','focus','modal','replacement','capture','authority','release','unknown');
 for(const name of cases){
  const dir=path.join(out,name);fs.mkdirSync(dir);c.R=dir;c.URL='http://127.0.0.1:'+await freePort()+'/ctl';
  Object.assign(process.env,{LMARBLES_CONTROL_OUT:dir,LMARBLES_CONTROL_URL:c.URL,NATIVE_CAPTURE_FAULT:name});
  const media=path.join(ROOT,'test/binaries/candidates/lmarbles-108/game/LMARBLES');
  const args=['node','-e',BOOT,'--','--exe='+fixture.file,'--no-build','--threads','--real-ticks','--screen=1024x712','--max-seconds=55','--max-batches=10000000','--stuck-after=0','--control='+new URL(c.URL).port,'--quiet-api','--quiet-blocks','--no-close','--env=SDL_VIDEODRIVER=windib',...['SDL.dll','libgcc_s_sjlj-1.dll','libwinpthread-1.dll'].map(n=>'--dll-seed='+path.join(media,n)),'--dll-seed='+path.join(ROOT,'test/binaries/dlls/msvcrt.dll')];
  c.save('recipe.json',{cwd:ROOT,args,seconds:355,reserveSeconds:300,watchdogGrace:2,nativeScene:true,moduleHolder:holder,inputPolicy:{confirmationMs:500,physicalUpMs:1750,observationMs:3000,gameFreshnessSeconds:5,menuFreshnessSeconds:30}});
  const p=cp.spawn(process.execPath,['tools/lmarbles-supervisor.cjs','durablewait',dir],{cwd:ROOT,stdio:['ignore','pipe','pipe']});const waited=k.communicate(p);let error;
  try{
   const until=performance.now()+20000;
   for(;;){try{const s=await c.call({action:'snapshot'},1);if(s.mainHwnd!=='0x0'&&s.focusWindow.live&&fs.existsSync(path.join(dir,'native-pid.json')))break;}catch{}assert(performance.now()<until,'native SDL readiness');await k.sleep(50);}
   async function capture(stem){await c.capture(stem);return c.read(stem+'.json').image;}
   const first=await capture('first');await k.sleep(200);const second=await capture('second');
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
    if(name==='unknown'||name==='release')await assert.rejects(c.pulse('press',['keydown:13'],100,'fresh','authored native HTTP fault and independent release'));
    else await c.pulse('press',['keydown:13'],100,'fresh','authored native finite Enter and independent release');
    const up=c.read('press-up.json');assert.equal(up.state,'ACK');assert(up.reply.released);assert.equal(up.reply.owner,owner.owner);
    if(name!=='positive'){assert(c.read('terminal-input-failure.json').noReplay);assert.throws(()=>c.opened(),/sticky UNKNOWN/);}
    if(name==='release')assert.equal(c.read('changed-focus-before-release.json').focus,0);
    c.save('assertions.json',{animated:true,boundIssuedFirstImage:true,independentUp:up,stickyUnknown:name!=='positive'});
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
