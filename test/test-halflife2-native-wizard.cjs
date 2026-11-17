'use strict';
// Authored ordinary USER wizard, real native BUTTON and WM_COMMAND page change.
// No original media, guest calls from the controller, or personal-review claims.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const {startControlSession}=require('./control-session');
const net=require('node:net');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function fixture(){
 const b=require('./test-disciples2-native-paint-binding.cjs').fixture(false),raw=r=>r-0x1000+0x400,u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
 b.write('BUTTON\0',raw(0x3040));b.write('Wizard: Welcome\0',raw(0x3080));b.write('Next >\0',raw(0x3100));b.write('Wizard: License agreement\0',raw(0x3180));b.write('Cancel\0',raw(0x3200));
 function asm(r,body){const a=[],labels={},fix=[];const emit=(...v)=>a.push(...v),push=n=>emit(0x68,...u32(n));
 const api={RegisterClassA:0x401300,CreateWindowExA:0x401304,SetFocus:0x401308,GetMessageA:0x40130c,TranslateMessage:0x401310,DispatchMessageA:0x401314,DefWindowProcA:0x401318,SetWindowTextA:0x40131c,PostQuitMessage:0x401320,ExitProcess:0x401200,CreateThread:0x401208};
 const call=n=>emit(0xff,0x15,...u32(api[n])),label=n=>labels[n]=a.length,jump=(n,c)=>{emit(...(c?[0x0f,c]:[0xe9]));fix.push([a.length,n]);emit(0,0,0,0);};
 body({emit,push,call,label,jump});const out=Buffer.from(a);for(const[o,n]of fix)out.writeInt32LE(labels[n]-o-4,o);assert(out.length<0x400);b.fill(0,raw(r),raw(r+0x400));out.copy(b,raw(r));}
 asm(0x2000,({emit,push,call,label,jump})=>{
  push(0x403500);call('RegisterClassA');for(const n of [0,0x400000,0,0,300,500,40,40,0x10cf0000,0x403080,0x403000,0])push(n);call('CreateWindowExA');emit(0xa3,...u32(0x403600));
  for(const[id,x,title]of [[1,220,0x403100],[2,320,0x403200]]){for(const n of [0,0x400000,id])push(n);emit(0xff,0x35,...u32(0x403600));for(const n of [24,80,200,x,0x50010000,title,0x403040,0])push(n);call('CreateWindowExA');if(id===1){emit(0xa3,...u32(0x40360c));}}
  emit(0xff,0x35,...u32(0x40360c));call('SetFocus');for(const n of [0x403680,0,0,0x402800,0,0])push(n);call('CreateThread');
  label('pump');for(const n of [0,0,0,0x403640])push(n);call('GetMessageA');emit(0x85,0xc0);jump('exit',0x84);push(0x403640);call('TranslateMessage');push(0x403640);call('DispatchMessageA');jump('pump');label('exit');push(0);call('ExitProcess');
 });
 asm(0x2400,({emit,push,call,label,jump})=>{
  emit(0x55,0x89,0xe5,0x81,0x7d,12,...u32(0x111));jump('default',0x85);emit(0x83,0x7d,16,1);jump('cancel',0x85);push(0x403180);emit(0xff,0x75,8);call('SetWindowTextA');jump('zero');
  label('cancel');push(0);call('PostQuitMessage');jump('zero');label('default');for(const n of [20,16,12,8])emit(0xff,0x75,n);call('DefWindowProcA');emit(0xc9,0xc2,16,0);label('zero');emit(0x31,0xc0,0xc9,0xc2,16,0);
 });
 // The ordinary sibling worker remains alive without changing UI metadata.
 b.set(Buffer.from([0x68,...u32(1000),0xff,0x15,...u32(0x401204),0xeb,0xf3]),raw(0x2800));return b;
}
function dialogFixture(){
 const b=require('./test-vb5-native-dialog-identity.cjs').fixture({simpleButton:true}),raw=r=>r-0x1000+0x200;
 let a=raw(0x1500);const start=a,w=n=>{b.writeUInt16LE(n,a);a+=2;},d=n=>{b.writeUInt32LE(n>>>0,a);a+=4;},s=t=>{for(const c of t)w(c.charCodeAt(0));w(0);},align=()=>a=(a+3)&~3;
 d(0x80c80000);d(0);w(3);w(30);w(30);w(220);w(100);w(0);w(0);s('Wizard: Welcome');
 align();d(0x50000000);d(0);w(10);w(10);w(195);w(30);w(100);w(0xffff);w(0x82);s('Authored wizard welcome page');w(0);
 for(const[id,x,label]of [[1,70,'Next >'],[2,140,'Cancel']]){align();d(0x50010000);d(0);w(x);w(65);w(60);w(15);w(id);w(0xffff);w(0x80);s(label);w(0);}
 b.writeUInt32LE(a-start,raw(0x12a4));b.write('Wizard: License agreement\0',raw(0x2580));
 b.write('License page: read the authored terms.\0',raw(0x25c0));
 b.writeUInt32LE(0x1d00,raw(0x1960));b.writeUInt32LE(0,raw(0x1964));b.write('GetDlgItem\0',raw(0x1d02));
 // Real DLGPROC WM_COMMAND updates this authored page's public title.
 const u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
 const code=Buffer.from([0x81,0x7c,0x24,8,...u32(0x111),0x75,42,
  0x68,...u32(0x402580),0xff,0x74,0x24,8,0xff,0x15,...u32(0x40195c),
  0x68,...u32(100),0xff,0x74,0x24,8,0xff,0x15,...u32(0x401960),
  0x68,...u32(0x4025c0),0x50,0xff,0x15,...u32(0x40195c),
  0xb8,1,0,0,0,0xc2,16,0]);
 code.copy(b,raw(0x2300));return b;
}
async function runOne(out,dialog=false,wrapper=false){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(path.join(out,n),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
 const exe=path.join(out,'wizard.exe');fs.writeFileSync(exe,dialog?dialogFixture():fixture(),{flag:'wx'});
 let wo='',we='';const wd=cp.spawn(process.execPath,['-e',"let pid;const t=setTimeout(()=>{if(pid)try{process.kill(-pid,'SIGKILL')}catch{};process.exit(2)},25000);console.log('ARMED');process.stdin.on('data',b=>pid=+b);process.stdin.on('end',()=>clearTimeout(t))"]);wd.stdout.on('data',b=>wo+=b);wd.stderr.on('data',b=>we+=b);const ww=new Promise(r=>wd.on('close',(exit,signal)=>r({exit,signal})));
 while(!wo.includes('ARMED'))await pause(5);save('watchdog-arm.json',{pid:wd.pid,prearmed:true,milliseconds:25000});
 const reservation=net.createServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));const port=reservation.address().port;await new Promise(r=>reservation.close(r));
 const s=startControlSession(['test/run.js','--exe='+exe,'--no-build','--threads','--real-ticks','--png-canvas','--screen=640x480','--control-stdin','--control='+port,'--max-seconds=20','--max-batches=100000000','--stuck-after=0','--quiet-api','--quiet-blocks','--no-close'],{spawnOptions:{detached:true}});wd.stdin.write(String(s.child.pid));
 try{
  let snap;const due=Date.now()+10000;do{snap=await s.send({action:'snapshot'});if(snap.windows.filter(w=>w.controlClass===1).length===2)break;assert(Date.now()<due);await pause(20);}while(true);
  if(wrapper){
   const crypto=require('node:crypto'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
   const gitSHA=cp.execFileSync('git',['rev-parse','8d4973866'],{encoding:'utf8'}).trim();
   const helper='tools/vb5cce-reviewed-control.py',own='tools/halflife2-reviewed-next.py';
   const sources={[helper]:hash(cp.execFileSync('git',['show',gitSHA+':'+helper])),[own]:hash(fs.readFileSync(own))};
   save('runtime-inputs.json',{gitSHA,sources,authoredWrapperTest:true});
   fs.writeFileSync(path.join(out,'wrapper.patch'),cp.execFileSync('git',['diff','--binary','--',own,'test/test-halflife2-native-wizard.cjs']));
   const stat=fs.readFileSync('/proc/'+s.child.pid+'/stat','utf8'),started=Date.now()/1000;
   save('native-pid.json',{pid:s.child.pid,startToken:stat.slice(stat.lastIndexOf(')')+2).split(' ')[19],invocationToken:crypto.randomUUID(),bootId:fs.readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim()});
   save('launch.json',{rootPort:port,deadline:started+20,gameplayCutoff:started+17,reserveSeconds:3});
   let number=0;
   async function control(args,ok=true){const child=cp.spawn('python3',['-B','tools/halflife2-reviewed-next.py',...args],{env:{...process.env,DELPHI5_RUN:out,DELPHI5_PORT:String(port)}});let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);const status=await new Promise(r=>child.on('close',r));save('wrapper-'+(++number)+'-wait.json',{args,pid:child.pid,status,stdout,stderr,actualWait:true,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded});if(ok)assert.equal(status,0,stderr);else assert.notEqual(status,0);}
   await control(['capture','wrapper-scene']);const rr=JSON.parse(fs.readFileSync(path.join(out,'wrapper-scene.json'))),button=rr.snapshot.windows.find(w=>w.title==='Next >');
   const x=button.screenX+10,y=button.screenY+10;
   await control(['review','wrapper-scene','Automated authored wizard complete image protocol test','Next >','install',button.hwnd,String(x),String(y)]);
   await control(['bind','wrapper-scene']);await control(['intent','wrapper-next','wrapper-scene',String(x),String(y),'install']);
   const receipt=JSON.parse(fs.readFileSync(path.join(out,'wrapper-next-down.json'))).receipt,after=JSON.parse(fs.readFileSync(path.join(out,'wrapper-next-observation.json'))).snapshot;
   assert(receipt.consumed);assert.equal(receipt.receiptBoundary,'native-button-dispatch-return');assert(after.windows.some(w=>w.title==='License page: read the authored terms.'));
   // A terminal fixture latch must refuse every later helper operation before
   // HTTP, including a different finite name that formerly shadowed source ID.
   const ledger=fs.readFileSync(path.join(out,'requests.jsonl'),'utf8');save('PERMANENT-UNKNOWN.json',{authoredTest:true,noLaterRequests:true});
   for(const args of [['capture','later'],['bind','wrapper-scene'],['intent','different-name','wrapper-scene',String(x),String(y),'install']])await control(args,false);
   assert.equal(fs.readFileSync(path.join(out,'requests.jsonl'),'utf8'),ledger);
   save('proof.json',{passed:true,fullWrapperCaptureReviewBindIntent:true,arbitraryIntentName:true,actualPageChanged:true,receiptBoundary:receipt.receiptBoundary,physicalUpConfirmed:true,permanentUnknownLaterHTTP:0,noOriginal:true});return;
  }
  const c=await s.send({action:'native-reviewed-capture',path:path.join(out,'wizard.png')});save('capture.json',c);
  const button=c.snapshot.windows.find(w=>w.title==='Next >'),review={contract:c.contract,captureId:c.captureId,pngSHA256:c.pngSHA256,reviewed:true,reviewedAt:Date.now(),scope:'menu',targetHwnd:button.hwnd};
  const targetCheck=cp.spawnSync('python3',['-B','-c',`import importlib.util,json,sys
s=importlib.util.spec_from_file_location('next','tools/halflife2-reviewed-next.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
scene=json.load(sys.stdin);b=next(w for w in scene['windows'] if w.get('title')=='Next >');x=b['screenX']+10;y=b['screenY']+10
assert m.preflight(scene,b['hwnd'],x,y,b['title'])['nativeDispatchFenceRequired']
for target in [scene['modalHwnd'] if scene['modalHwnd']!='0x0' else scene['mainHwnd'],next(w['hwnd'] for w in scene['windows'] if w.get('title')=='Cancel')]:
 try:m.preflight(scene,target,x,y,b['title'])
 except AssertionError:pass
 else:raise AssertionError('wrong frame/sibling accepted')
print('PASS actual captured tree Next binding; wrong frame/sibling refused before DOWN and ACK')`],{input:JSON.stringify(c.snapshot),encoding:'utf8'});
  save('target-preflight.json',{exit:targetCheck.status,stdout:targetCheck.stdout,stderr:targetCheck.stderr});assert.equal(targetCheck.status,0,targetCheck.stderr);
  const owner=await s.send({action:'guarded-bind',reviewedScene:review});save('binding.json',owner);
  const nonce=require('node:crypto').randomUUID();
  // Independent physical release is armed before the native DOWN request.
  const up=cp.spawn(process.execPath,['-e',`let due=Date.now()+10000;console.log('ARMED');process.stdin.on('data',b=>due=Math.min(due,+b));const timer=setInterval(async()=>{if(Date.now()<due)return;clearInterval(timer);try{const sent=Date.now(),r=await fetch('http://127.0.0.1:${port}/ctl',{method:'POST',signal:AbortSignal.timeout(200),body:JSON.stringify({action:'guarded-release',owner:${JSON.stringify(owner.owner)}})});console.log(JSON.stringify({sent,at:Date.now(),reply:await r.json()}));process.stdin.destroy()}catch(e){console.error(e);process.exit(1)}},2)`]);let upout='',uperr='';up.stdout.on('data',b=>upout+=b);up.stderr.on('data',b=>uperr+=b);const uw=new Promise(r=>up.on('close',r));while(!upout.includes('ARMED'))await pause(2);const start=Date.now();up.stdin.write(String(start+1400));
  const receipt=await s.send({action:'guarded-input',cmd:`mousedown:${button.screenX+10}:${button.screenY+10}`,guard:{...owner,nonce,reviewed:true,deadline:start+500,intent:{review}}});save('down.json',receipt);
  assert(receipt.consumed);assert(['native-input-return','native-button-dispatch-return'].includes(receipt.receiptBoundary));assert(receipt.nativeMessage);
  up.stdin.write(String(receipt.consumedAt+100));await uw;const release=JSON.parse(upout.trim().split('\n').at(-1));assert(release.reply.ok&&release.reply.value.released);assert(release.at<start+1750);save('release-wait.json',{exit:up.exitCode,actualWait:true,stdoutEOF:up.stdout.readableEnded,stderrEOF:up.stderr.readableEnded,stdout:upout,stderr:uperr});
  snap=await s.send({action:'snapshot'});save('after.json',snap);assert.equal(snap.windows.find(w=>w.hwnd===(dialog?snap.modalHwnd:snap.mainHwnd)).title,'Wizard: License agreement');
  if(dialog){assert.equal(receipt.receiptBoundary,'native-button-dispatch-return');assert(snap.windows.some(w=>w.title==='License page: read the authored terms.'));}
  // A second nonce cannot reuse the retained personal capture.
  let refused=false;try{const refusedReceipt=await s.send({action:'guarded-input',cmd:`mousedown:${button.screenX+10}:${button.screenY+10}`,guard:{...owner,nonce:nonce+'x',reviewed:true,deadline:Date.now()+500,intent:{review}}});refused=!refusedReceipt.consumed&&['CANCELLED','UNKNOWN'].includes(refusedReceipt.state);save('reuse-refusal.json',refusedReceipt);}catch{refused=true;}assert(refused);
  save('proof.json',{passed:true,actualPageChanged:true,receiptBoundary:receipt.receiptBoundary,actualNativeReturn:true,physicalUpMs:release.at-start,reuseRefused:true,noOriginal:true});
 }finally{if(s.child.exitCode===null)try{process.kill(-s.child.pid,'SIGTERM');}catch{}await s.exited;save('native-wait.json',{pid:s.child.pid,exit:s.child.exitCode,actualWait:true,stdoutEOF:s.child.stdout.readableEnded,stderrEOF:s.child.stderr.readableEnded,hostCleanup:true,nativeQuit:false});fs.writeFileSync(path.join(out,'native.log'),s.output());wd.stdin.end();save('watchdog-wait.json',{...await ww,actualWait:true,stdoutEOF:wd.stdout.readableEnded,stderrEOF:wd.stderr.readableEnded,stdout:wo,stderr:we});}
}
async function run(out){await runOne(path.join(out,'ordinary'));await runOne(path.join(out,'dialog'),true);await runOne(path.join(out,'wrapper'),true,true);}
module.exports={fixture,dialogFixture,run};if(require.main===module)run(path.resolve(process.argv[2])).catch(e=>{console.error(e);process.exitCode=1;});
