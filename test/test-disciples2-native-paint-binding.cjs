'use strict';
// Authored public USER painting fixture; no original game bytes or state.
// Native mode requires an external, personal full-scene review record. The
// test never manufactures review permission or freezes guest execution.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const cp=require('node:child_process'),net=require('node:net'),crypto=require('node:crypto');
const {startControlSession}=require('./control-session');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function fixture(changing=false){
 const b=Buffer.alloc(0x4400),base=0x400000,raw=r=>r-0x1000+0x400,u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
 const w=(o,n)=>b.writeUInt16LE(n,o),d=(o,n)=>b.writeUInt32LE(n>>>0,o),pe=0x80,opt=pe+24,section=opt+224;
 w(0,0x5a4d);d(0x3c,pe);d(pe,0x4550);w(pe+4,0x14c);w(pe+6,1);w(pe+20,224);w(pe+22,0x10e);
 w(opt,0x10b);d(opt+16,0x2000);d(opt+28,base);d(opt+32,4096);d(opt+36,1024);w(opt+40,4);w(opt+48,4);
 d(opt+56,0x5000);d(opt+60,1024);w(opt+68,2);d(opt+72,0x100000);d(opt+76,4096);d(opt+80,0x100000);d(opt+84,4096);d(opt+92,16);
 d(opt+104,0x1000);d(opt+108,60);b.write('.native',section);d(section+8,0x4000);d(section+12,0x1000);d(section+16,0x4000);d(section+20,1024);d(section+36,0xe0000060);
 let string=0x1600;
 for(const [i,[dll,names]]of [['kernel32.dll',['ExitProcess','Sleep','CreateThread']],['user32.dll',['RegisterClassA','CreateWindowExA','SetFocus','GetMessageA','TranslateMessage','DispatchMessageA','DefWindowProcA','SetWindowTextA','PostQuitMessage','SetTimer']]].entries()){
  const desc=raw(0x1000+i*20),thunk=0x1200+i*256;d(desc,thunk);d(desc+12,string);d(desc+16,thunk);b.write(dll+'\0',raw(string));string+=dll.length+1;
  for(const [j,name]of names.entries()){d(raw(thunk+j*4),string);b.write(name+'\0',raw(string+2));string+=name.length+3;}
 }
 b.write('PaintBindingFixture\0',raw(0x3000));b.write('STATIC\0',raw(0x3040));b.write('Native paint binding fixture\0',raw(0x3080));
 b.write('PUBLIC MENU: Single Player | Quit | frame A\0',raw(0x3100));b.write('PUBLIC MENU: Single Player | Quit | frame B\0',raw(0x3180));
 for(let i=0;i<32;i++)b.write('PUBLIC MENU: Single Player | Quit | paint '+String(i).padStart(2,'0')+'\0',raw(0x3800+i*64));
 d(raw(0x3504),base+0x2400);d(raw(0x3510),base);d(raw(0x351c),6);d(raw(0x3524),base+0x3000);
 function assemble(rva,work){
  const code=[],labels=new Map(),fix=[];const emit=(...v)=>code.push(...v),push=n=>emit(0x68,...u32(n));
  const apis={ExitProcess:0x401200,Sleep:0x401204,CreateThread:0x401208,RegisterClassA:0x401300,
   CreateWindowExA:0x401304,SetFocus:0x401308,GetMessageA:0x40130c,TranslateMessage:0x401310,
   DispatchMessageA:0x401314,DefWindowProcA:0x401318,SetWindowTextA:0x40131c,PostQuitMessage:0x401320,SetTimer:0x401324};
  const call=n=>{assert(apis[n]);emit(0xff,0x15,...u32(apis[n]));},label=n=>labels.set(n,code.length);
  const jump=(n,c)=>{emit(...(c?[0x0f,c]:[0xe9]));fix.push([code.length,n]);emit(0,0,0,0);};
  work({emit,push,call,label,jump});const result=Buffer.from(code);for(const [o,n]of fix){assert(labels.has(n));result.writeInt32LE(labels.get(n)-o-4,o);}assert(result.length<0x400);b.fill(0,raw(rva),raw(rva+0x400));result.copy(b,raw(rva));
 }
 assemble(0x2000,({emit,push,call,label,jump})=>{
  push(base+0x3500);call('RegisterClassA');
  for(const n of [0,base,0,0,300,700,40,40,0x10cf0000,base+0x3080,base+0x3000,0])push(n);
  call('CreateWindowExA');emit(0xa3,...u32(base+0x3600));
  for(const n of [0,base,0,7])push(n);emit(0xff,0x35,...u32(base+0x3600));
  for(const n of [100,660,20,20,0x50000000,base+0x3100,base+0x3040,0])push(n);
  call('CreateWindowExA');emit(0xa3,...u32(base+0x360c));
  emit(0xff,0x35,...u32(base+0x3600));call('SetFocus');
  for(const n of [base+0x3680,0,0,base+0x2800,0,0])push(n);call('CreateThread');
  label('pump');for(const n of [0,0,0,base+0x3640])push(n);call('GetMessageA');emit(0x85,0xc0);jump('exit',0x84);
  push(base+0x3640);call('TranslateMessage');push(base+0x3640);call('DispatchMessageA');jump('pump');
  label('exit');push(0);call('ExitProcess');emit(0xcc);
 });
 assemble(0x2400,({emit,push,call,label,jump})=>{
  emit(0x55,0x89,0xe5,0x81,0x7d,0x0c,...u32(0x113));jump('input',0x85);
  emit(0x83,0x35,...u32(base+0x3604),1,0x83,0x3d,...u32(base+0x3604),0);jump('b',0x85);
  push(base+0x3100);jump('text');label('b');push(base+0x3180);label('text');
  emit(0xff,0x35,...u32(base+0x360c));call('SetWindowTextA');jump('zero');
  label('input');emit(0x81,0x7d,0x0c,...u32(0x101));jump('default',0x85);
  emit(0x83,0x7d,0x10,27);jump('default',0x85);push(0);call('PostQuitMessage');jump('zero');
  label('default');for(const n of [20,16,12,8])emit(0xff,0x75,n);call('DefWindowProcA');emit(0xc9,0xc2,0x10,0);
  label('zero');emit(0x31,0xc0,0xc9,0xc2,0x10,0);
 });
 assemble(0x2800,({emit,push,call,label,jump})=>{
  label('wait');push(500);call('Sleep');
  if(changing){emit(0xff,0x05,...u32(base+0x3610),0xa1,...u32(base+0x3610),0x83,0xe0,31,0xc1,0xe0,6,0x05,...u32(base+0x3800),0x50);}
  else push(base+0x3100);
  emit(0xff,0x35,...u32(base+0x360c));call('SetWindowTextA');jump('wait');
 });
 return b;
}
module.exports={fixture};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function native(out,mode){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(path.join(out,n),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
 const image=path.join(out,'public-menu.exe'),bytes=fixture(mode==='paint');fs.writeFileSync(image,bytes,{flag:'wx'});
 const reservation=net.createServer();await new Promise((r,j)=>{reservation.once('error',j);reservation.listen(0,'127.0.0.1',r);});
 const port=reservation.address().port;await new Promise(r=>reservation.close(r));
 const start=Date.now()/1000;save('launch.json',{at:start,deadline:start+240,gameplayCutoff:start+60,reserveSeconds:180,nativeScene:true});
 // Independent watchdog arms before test/run.js, then observes EOF and exits.
 const watchdog=cp.spawn(process.execPath,['-e',`let pid;const t=setTimeout(()=>{if(pid){try{process.kill(-pid,'SIGCONT');process.kill(-pid,'SIGTERM')}catch{}}process.exit(2)},90000);console.log('ARMED');process.stdin.on('data',b=>pid=Number(b));process.stdin.on('end',()=>clearTimeout(t));`]);
 let wo='',we='';watchdog.stdout.on('data',b=>wo+=b);watchdog.stderr.on('data',b=>we+=b);
 const wwait=new Promise(r=>watchdog.on('close',(exit,signal)=>r({exit,signal})));
 while(!wo.includes('ARMED'))await pause(5);save('watchdog-armed.json',{pid:watchdog.pid,at:Date.now(),beforeNative:true,deadline:start+90});
 const s=startControlSession(['test/run.js','--exe='+image,'--no-build','--threads','--real-ticks','--screen=1024x712','--control-stdin','--control='+port,'--max-seconds=85','--max-batches=100000000','--stuck-after=0','--trace-thread','--quiet-api','--quiet-blocks','--no-close'],{spawnOptions:{detached:true}});
 watchdog.stdin.write(String(s.child.pid));const st=fs.readFileSync('/proc/'+s.child.pid+'/stat','utf8');save('native-pid.json',{pid:s.child.pid,startToken:st.slice(st.lastIndexOf(')')+2).split(' ')[19],port});
 const env={...process.env,DISCIPLES2_CONTROL_OUT:out,DISCIPLES2_CONTROL_URL:'http://127.0.0.1:'+port+'/ctl'};
 let calls=0,terminal=false;
 async function controller(args,ok=true){
  const auditCode="import os,json,time,urllib.request,runpy,sys; original=urllib.request.urlopen\ndef traced(*a,**kw):\n with open(os.environ['DISCIPLES2_CONTROL_OUT']+'/requests.jsonl','a') as f:f.write(json.dumps(dict(at=time.time(),body=a[0].data.decode()))+'\\n')\n return original(*a,**kw)\nurllib.request.urlopen=traced;sys.argv=['tools/disciples2-current-controller.py']+sys.argv[1:];runpy.run_path(sys.argv[0],run_name='__main__')";
  const p=cp.spawn('python3',['-B','-c',auditCode,...args],{env});let a='',b='';p.stdout.on('data',v=>a+=v);p.stderr.on('data',v=>b+=v);
  const result=await new Promise(r=>p.on('close',(exit,signal)=>r({pid:p.pid,exit,signal,actualWait:true,stdoutEOF:p.stdout.readableEnded,stderrEOF:p.stderr.readableEnded,stdout:a,stderr:b,args})));
  save('controller-'+(++calls)+'-wait.json',result);if(ok)assert.equal(result.exit,0,a+b);else assert.notEqual(result.exit,0,a+b);return result;
 }
 async function sample(name){
  const before=await s.send({action:'snapshot'}),t=Date.now();const result=await s.send({action:'png',path:path.join(out,name+'.png')});
  const png=fs.readFileSync(path.join(out,name+'.png'));const after=await s.send({action:'snapshot'});
  save(name+'.json',{startedAt:t,completedAt:Date.now(),before,after,result,pngSHA256:hash(png)});return {before,after,pngSHA256:hash(png)};
 }
 try{
  const due=Date.now()+20000;let snap;
  do{snap=await s.send({action:'snapshot'});if(snap.focusWindow?.live&&snap.mainHwnd!=='0x0'&&snap.windows.length>=2)break;assert(Date.now()<due,'actual guest Worker startup');await pause(50);}while(true);
  const rendererDue=Date.now()+10000;while(await s.send({action:'eval',code:'Object.keys(renderer.windows).length'})<2){assert(Date.now()<rendererDue,'public renderer window publication');await pause(50);}
  await pause(250);
  const trace=path.join(out,'native-encode.jsonl'),prefix=path.join(out,'encoded-');
  await s.send({action:'eval',code:`(()=>{const c=renderer.canvas,raw=c.toBufferSync.bind(c);globalThis.__paintRole='capture';let n=0;c.toBufferSync=(...args)=>{const b=raw(...args),fs=process.getBuiltinModule('fs'),crypto=process.getBuiltinModule('crypto');const row={sequence:++n,at:Date.now(),role:globalThis.__paintRole,sha256:crypto.createHash('sha256').update(b).digest('hex'),focus:instance.exports.get_focus_hwnd?.(),main:instance.exports.get_main_hwnd?.(),windows:Object.entries(renderer.windows).map(([h,w])=>({hwnd:h,title:w.title,visible:w.visible,back:w._backCanvas?crypto.createHash('sha256').update(w._backCanvas.toBufferSync('png')).digest('hex'):null}))};fs.appendFileSync(${JSON.stringify(trace)},JSON.stringify(row)+'\\n');fs.writeFileSync(${JSON.stringify(prefix)}+n+'.png',b);return b;};return true})()`});
  await controller(['capture','reviewed']);
  const rr=JSON.parse(fs.readFileSync(path.join(out,'reviewed.json')));assert.equal(rr.snapshot.focusWindow.threadId,1,'main USER owner must match the real main thread');
  const first=await sample('capture-source');
  const decoded=require('pngjs').PNG.sync.read(fs.readFileSync(path.join(out,'reviewed.png'))),colors=new Set();for(let i=0;i<decoded.data.length;i+=4)colors.add(decoded.data.readUInt32LE(i));assert(colors.size>8,'complete fixture window must be painted before review');
  save('ready.json',{mode,pid:s.child.pid,png:path.join(out,'reviewed.png'),pngSHA256:rr.pngSHA256,captureAt:rr.at,tuple:rr.snapshot,source:first});
  // A human/agent must actually view the full PNG and record the matching hash.
  const reviewDue=Date.now()+25000;
  while(!fs.existsSync(path.join(out,'personal-review.json'))){assert(Date.now()<reviewDue,'personal review not supplied within unchanged menu freshness');await pause(20);}
  const review=JSON.parse(fs.readFileSync(path.join(out,'personal-review.json')));assert.equal(review.pngSHA256,rr.pngSHA256);assert(review.observation?.length>10);assert(Date.now()/1000-review.at<30);
  save('reviewed-review.json',review);
  await s.send({action:'eval',code:"globalThis.__paintRole='pre-bind';true"});
  if(mode==='stale')await pause(Math.max(0,(rr.at+30.1)*1000-Date.now()));
  if(mode==='focus'){const child=rr.snapshot.windows.find(w=>w.isChild);assert(child);await s.send({action:'eval',code:'instance.exports.set_focus('+parseInt(child.hwnd,16)+');true'});}
  if(mode==='owner'){
   await controller(['bind','reviewed']);await s.send({action:'eval',code:'renderer.handleMouseDown=renderer.handleMouseDown.bind(renderer);true'});
   const owner=JSON.parse(fs.readFileSync(path.join(out,'input-owner.json')));
   const reply=await s.send({action:'guarded-input',cmd:'keydown:40',guard:{...owner,nonce:'owner-fault',reviewed:true,deadline:Date.now()+500,intent:{...rr.snapshot,pngSHA256:rr.pngSHA256}}});
   save('owner-fault-receipt.json',reply);assert(!reply.consumed);assert(['REFUSED','CANCELLED','UNKNOWN'].includes(reply.state));terminal=true;
  }else if(mode==='unknown'){
   process.kill(-s.child.pid,'SIGSTOP');await controller(['capture','timeout'],false);terminal=true;process.kill(-s.child.pid,'SIGCONT');
  }else if(mode==='positive'){
   const prebind=await sample('bind-source');assert.equal(prebind.pngSHA256,rr.pngSHA256,'stable complete capture must match bind-time production PNG');
   await controller(['bind','reviewed']);
   await controller(['pulse','finite','keydown:40','100','reviewed',review.observation]);
   const done=JSON.parse(fs.readFileSync(path.join(out,'finite-complete.json')));assert(done.confirmationMs<=500&&done.physicalUpMs<=1750);
   save('assertions.json',{nativeWorkerThread:rr.snapshot.focusWindow.threadId,completePaintStable:true,consumerBound:true,...done,nativeQuit:false});
  }else{
   let prebind=await sample('bind-source');
   if(mode==='paint'){for(let i=0;prebind.pngSHA256===rr.pngSHA256&&i<10;i++){await pause(80);prebind=await sample('changed-'+i);}assert.notEqual(prebind.pngSHA256,rr.pngSHA256,'actual guest timer must change complete paint before binding');}
   await s.send({action:'eval',code:"globalThis.__paintRole='bind';true"});
   await controller(['bind','reviewed'],false);terminal=true;
  }
  if(terminal){
   const closed=path.join(out,'terminal-input-failure.json');
   // The low-level owner mutation test closes its own caller after refusal.
   // Controller failures must already have closed themselves.
   if(mode==='owner')save('terminal-input-failure.json',{at:Date.now()/1000,reason:'actual native owner refusal',noReplay:true});
   assert(fs.existsSync(closed),'controller refusal/UNKNOWN must latch closure before caller intervenes');
   const count=calls,ledger=fs.readFileSync(path.join(out,'requests.jsonl'),'utf8');for(const args of [['capture','later'],['bind','reviewed']])await controller(args,false);
   assert.equal(fs.readFileSync(path.join(out,'requests.jsonl'),'utf8'),ledger,'closed controller must issue zero later HTTP requests');
   save('assertions.json',{nativeWorkerThread:rr.snapshot.focusWindow.threadId,negative:mode,zeroEffects:true,laterRequests:0,closed:true,localRefusals:calls-count});
  }
 }finally{
  // No HTTP/stdio teardown request after a refusal or UNKNOWN.
  if(s.child.exitCode===null&&s.child.signalCode===null){try{process.kill(-s.child.pid,'SIGCONT');process.kill(-s.child.pid,'SIGTERM');}catch(e){if(e.code!=='ESRCH')throw e;}}
  await s.exited;save('native-wait.json',{pid:s.child.pid,exit:s.child.exitCode,signal:s.child.signalCode,actualWait:true,stdoutEOF:s.child.stdout.readableEnded,stderrEOF:s.child.stderr.readableEnded,hostShutdown:true,nativeQuit:false});
  fs.writeFileSync(path.join(out,'native.log'),s.output(),{flag:'wx'});assert(s.output().includes('spawned WORKER thread'),'real Node guest Worker required');watchdog.stdin.end();const w=await wwait;save('watchdog-wait.json',{pid:watchdog.pid,...w,actualWait:true,stdoutEOF:watchdog.stdout.readableEnded,stderrEOF:watchdog.stderr.readableEnded,stdout:wo,stderr:we});assert.equal(w.exit,0);
 }
}
if(require.main===module){
 if(process.argv[2]==='--native')native(path.resolve(process.argv[3]),process.argv[4]||'positive').catch(e=>{console.error(e);process.exitCode=1;});
 else{assert(fixture(false).includes(Buffer.from('PUBLIC MENU:')));assert.notDeepEqual(fixture(false),fixture(true));console.log('PASS authored native painting PE structure; runtime requires --native OUT MODE and personal review');}
}
