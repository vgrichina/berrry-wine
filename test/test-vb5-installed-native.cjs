'use strict';
// Ordinary authored x86 main-window, keyboard and common-file-dialog caller.
// No original application bytes or host-created windows.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const raw=r=>r-0x1000+0x200,u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
function fixture(){
 const b=require('./test-sims-child-mount-native.cjs').untitledModal();
 const groups=[['kernel32.dll',0x1900,['ExitProcess','Sleep']],['user32.dll',0x1940,
  ['RegisterClassA','DefWindowProcA','CreateWindowExA','GetMessageA','TranslateMessage','DispatchMessageA','SetWindowTextA','PostQuitMessage']],
  ['comdlg32.dll',0x1980,['GetOpenFileNameA']]];
 b.fill(0,raw(0x1800),raw(0x2000));let name=0x1b00;
 for(const [i,[dll,iat,names]] of groups.entries()){
  const d=0x1800+i*20,s=0x18c0+i*20;
  b.writeUInt32LE(iat,raw(d));b.writeUInt32LE(s,raw(d+12));b.writeUInt32LE(iat,raw(d+16));b.write(dll+'\0',raw(s));
  for(const [j,n]of names.entries()){b.writeUInt32LE(name,raw(iat+j*4));b.write(n+'\0',raw(name+2));name+=n.length+3;}
 }
 b.writeUInt32LE(80,0x80+24+108);
 b.fill(0,raw(0x2000),raw(0x3000));
 b.write('InstalledScopeFixture\0',raw(0x2800));b.write('Native IDE scope: O opens; Q quits\0',raw(0x2840));
 b.write('Native sample opened\0',raw(0x2880));b.write('Bundled project\0*.vbp\0\0',raw(0x28c0));
 b.write('c:\\sample.vbp\0',raw(0x2900));
 b.writeUInt32LE(0x402400,raw(0x2b04));b.writeUInt32LE(0x400000,raw(0x2b10));
 b.writeUInt32LE(6,raw(0x2b1c));b.writeUInt32LE(0x402800,raw(0x2b24));
 b.writeUInt32LE(76,raw(0x2c00));b.writeUInt32LE(0x4028c0,raw(0x2c0c));
 b.writeUInt32LE(0x402900,raw(0x2c1c));b.writeUInt32LE(256,raw(0x2c20));b.writeUInt32LE(0x1000,raw(0x2c34));
 function asm(r,body){const code=[],labels={},fix=[];const e=(...v)=>code.push(...v),push=n=>e(0x68,...u32(n)),call=a=>e(0xff,0x15,...u32(0x400000+a));
  const label=n=>labels[n]=code.length,j=(op,n)=>{e(...op,0,0,0,0);fix.push([code.length-4,n]);};
  body({e,push,call,label,j});for(const [at,n]of fix){assert(n in labels);const v=Buffer.alloc(4);v.writeInt32LE(labels[n]-at-4);for(let i=0;i<4;i++)code[at+i]=v[i];}
  b.set(code,raw(r));assert(code.length<0x400);
 }
 asm(0x2000,({e,push,call,label,j})=>{
  push(0x402b00);call(0x1940);
  for(const n of [0,0x400000,0,0,360,640,100,80,0x90000000,0x402840,0x402800,0])push(n);call(0x1948);
  e(0xa3,...u32(0x402c04));label('loop');for(const n of [0,0,0,0x402d00])push(n);call(0x194c);e(0x85,0xc0);j([0x0f,0x84],'exit');
  push(0x402d00);call(0x1950);push(0x402d00);call(0x1954);j([0xe9],'loop');
  label('exit');push(500);call(0x1904);push(0);call(0x1900);e(0xcc);
 });
 asm(0x2400,({e,push,call,j,label})=>{
  e(0x81,0x7c,0x24,8,...u32(0x100));j([0x0f,0x85],'default');
  e(0x83,0x7c,0x24,12,0x4f);j([0x0f,0x85],'quit');
  push(0x402c00);call(0x1980);e(0x85,0xc0);j([0x0f,0x84],'done');
  push(0x402880);e(0xff,0x74,0x24,8);call(0x1958);j([0xe9],'done');
  label('quit');e(0x83,0x7c,0x24,12,0x51);j([0x0f,0x85],'default');push(0);call(0x195c);
  label('done');e(0x31,0xc0,0xc2,16,0);
  label('default');for(const off of [16,16,16,16])e(0xff,0x74,0x24,off);call(0x1944);e(0xc2,16,0);
 });return b;
}
module.exports={fixture};
async function run(out){
 const cp=require('node:child_process'),net=require('node:net'),{startControlSession}=require('./control-session');
 const save=(n,v)=>fs.writeFileSync(path.join(out,n),JSON.stringify(v,null,2)+'\n',{flag:'wx'}),pause=ms=>new Promise(r=>setTimeout(r,ms));
 const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
 const at=Date.now()/1000;save('launch.json',{deadline:at+45,gameplayCutoff:at+40,reserveSeconds:5,rootPort:port});
 fs.copyFileSync(path.join(out,'../runtime-inputs.json'),path.join(out,'runtime-inputs.json'));
 const w=cp.spawn(process.execPath,['-e',`let pid;const t=setTimeout(()=>{if(pid)try{process.kill(-pid,'SIGKILL')}catch{};process.exit(2)},45000);console.log('ARMED');process.stdin.on('data',b=>pid=Number(b));process.stdin.on('end',()=>clearTimeout(t));`]);
 let arm='',we='';w.stdout.on('data',b=>arm+=b);w.stderr.on('data',b=>we+=b);const joined=new Promise(r=>w.on('close',(exit,signal)=>r({exit,signal})));
 while(!arm.includes('ARMED'))await pause(5);save('watchdog-armed.json',{pid:w.pid,prearmed:true,deadlineMs:45000});
 const invocationToken=require('node:crypto').randomUUID();
 const s=startControlSession(['test/run.js','--exe='+path.join(out,'installed-scope.exe'),'--no-build','--threads','--real-ticks','--winver=nt4','--control-stdin','--control='+port,'--max-seconds=40','--max-batches=100000000','--stuck-after=0','--quiet-api','--quiet-blocks','--png-canvas','--native-exit-receipt='+path.join(out,'native-exit.json'),'--native-invocation-token='+invocationToken],{spawnOptions:{detached:true}});
 const stat=fs.readFileSync('/proc/'+s.child.pid+'/stat','utf8'),info={pid:s.child.pid,startToken:stat.slice(stat.lastIndexOf(')')+2).split(' ')[19],bootId:fs.readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim(),invocationToken};
 save('native-pid.json',info);w.stdin.write(String(s.child.pid));
 let teardown=false;
 s.child.on('close',(exit,signal)=>save('native-wait.json',{...info,exit,signal,actualWait:true,disposition:teardown?'cleanup':'normal',hostTeardown:teardown,atWait:Date.now()/1000,atWaitMono:Number(process.hrtime.bigint())/1e9,stdoutEOF:s.child.stdout.readableEnded,stderrEOF:s.child.stderr.readableEnded}));
 let index=0;
 const control=async(args,expected=0)=>{
  const p=cp.spawn('python3',['-B','tools/vb5cce-reviewed-control.py',...args],{env:{...process.env,DELPHI5_RUN:out,DELPHI5_PORT:String(port)}});let stdout='',stderr='';p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b);
  const result=await new Promise(r=>p.on('close',(exit,signal)=>r({exit,signal,stdout,stderr,actualWait:true,stdoutEOF:p.stdout.readableEnded,stderrEOF:p.stderr.readableEnded})));
  save('controller-'+(++index)+'.json',{args,...result});assert.equal(result.exit,expected,stdout+stderr);return result;
 };
 try{
  let scene;const due=Date.now()+10000;
  do{scene=await s.send({action:'snapshot'});if(scene.mainHwnd!=='0x0'&&scene.focus===scene.mainHwnd)break;assert(Date.now()<due);await pause(10);}while(true);
  save('main-snapshot.json',scene);await control(['capture','main']);
  await control(['review','main','Automated authored main window fixture; O opens a native file dialog','O','install',scene.mainHwnd]);
  await control(['bind','main']);await control(['intent','open','main','-1','79','install']);
  const after=JSON.parse(fs.readFileSync(path.join(out,'open-observation.json'))).snapshot;
  assert.notEqual(after.modalHwnd,'0x0');assert.equal(after.focus,scene.mainHwnd);
  assert.equal(after.windows.find(w=>w.hwnd===after.modalHwnd).controlClass,12);
  const failure=require('../lib/cli-native-scene').captureFailures(after);
  assert.deepEqual(failure,{context:['focus.modalTopLevel'],controls:['control.unsupportedClass']});
  // Observational authored-fixture pixels before the terminal refusal. This
  // plain image confers no reviewed-context admission and drives no input.
  const image=await s.send({action:'png',path:path.join(out,'file-open-raw.png')});
  save('file-open-raw.json',{image,reviewedContext:false,inputsAuthorized:false});
  const refused=await control(['capture','file-open'],1);
  assert(refused.stderr.includes('focus.modalTopLevel')&&refused.stderr.includes('control.unsupportedClass'));
  assert(fs.existsSync(path.join(out,'PERMANENT-UNKNOWN.json')));
  const ledger=fs.readFileSync(path.join(out,'requests.jsonl'),'utf8');
  await control(['capture','after-unknown'],1);assert.equal(fs.readFileSync(path.join(out,'requests.jsonl'),'utf8'),ledger);
  save('qualification.json',{passed:true,safeForInstalledOriginal:false,main:true,keyboard:true,
   nativeFileDialog:true,fileOpenCapture:false,boundary:failure,permanentUNKNOWN:true,laterRequests:0});
 }finally{
  if(s.child.exitCode===null)try{teardown=true;process.kill(-s.child.pid,'SIGTERM');}catch(e){if(e.code!=='ESRCH')throw e;}
  await s.exited;fs.writeFileSync(path.join(out,'native.log'),s.output());
  w.stdin.end();const wait=await joined;save('watchdog-wait.json',{...wait,actualWait:true,stdoutEOF:w.stdout.readableEnded,stderrEOF:w.stderr.readableEnded,stdout:arm,stderr:we});assert.equal(wait.exit,0);
 }
}
async function workerProof(out){
 const {GuestThreadHost}=require('../lib/guest-thread-host'),{createHostImports}=require('../lib/host-imports');
 const module=await WebAssembly.compile(fs.readFileSync(process.env.DELPHI5_MODULE_FD));
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
 const imports=createHostImports({getMemory:()=>memory.buffer,renderer:null,resourceJson:{}});imports.host.memory=memory;
 const logs=[],host=new GuestThreadHost({memory,module,hostImports:imports.host,
  sigs:require('../lib/host-import-sigs.generated.json').sigs,workerUrl:path.resolve(__dirname,'../lib/guest-worker.js'),clockIntervalMs:5,log:s=>logs.push(s)});
 const call=(n,...a)=>host.callExport(n,...a),until=async pred=>{
  const due=Date.now()+10000;while(!await pred()){
   assert(Date.now()<due,'actual Worker fixture deadline');const y=await call('get_yield_reason');
   if([1,6,7,15].includes(y))await call('clear_yield');const r=await host.link.slice(128);assert(!r.trapped,JSON.stringify(r));
  }
 };
 let link,result;
 try{
  await host.start();link=host.link;await host.loadPe(fixture(),'installed-scope-worker.exe');
  await call('set_process_id',1000);await call('set_current_thread_id',1);
  await call('set_eip',0x402000);await call('set_esp',0x7408000);await call('guest_write32',0x7408000,0);
  await until(async()=>!!await call('get_main_hwnd'));
  const main=await call('get_main_hwnd');assert.equal(await call('get_focus_hwnd'),main);
  // Authored native queue input: actual GetMessage/DispatchMessage/x86 WNDPROC.
  await call('post_message_q',main,0x100,79,0);
  await until(async()=>!!await call('modal_dialog_hwnd'));
  // Finish native creation before observing (the modal HWND is allocated first).
  await until(async()=>{const h=await call('modal_dialog_hwnd');let start=0;
   for(let i=0;i<64;i++){const slot=await call('wnd_next_child_slot',h,start);if(slot===-1)return false;
    const child=await call('wnd_slot_hwnd',slot);if(await call('ctrl_get_id',child)===2)return true;start=slot+1;
   }return false;});
  const modal=await call('modal_dialog_hwnd'),focus=await call('get_focus_hwnd');
  assert.equal(await call('ctrl_get_class',modal),12);assert.equal(await call('wnd_get_owner',modal),main);assert.equal(focus,main);
  assert(logs.some(s=>s.includes('instantiated')));
  result={passed:true,actualCPUWorker:true,main,modal,focus,modalClass:12,modalOwner:main,
   boundary:'native file dialog leaves keyboard focus on main',directGuestCalls:'authored fixture setup, queue and observation only; no original',safeForInstalledOriginal:false};
 }finally{await host.stop();}
 assert(link._stopped);result.workerStopJoined=true;
 fs.writeFileSync(path.join(out,'actual-worker.json'),JSON.stringify(result,null,2)+'\n');
}
async function main(){
 const out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'installed-scope.exe'),fixture(),{flag:'wx'});
 if(!process.argv.includes('--run'))return;
 await run(out);
 const cp=require('node:child_process'),w=cp.spawn(process.execPath,['-e',`const t=setTimeout(()=>{try{process.kill(-${process.pid},'SIGKILL')}catch{};process.exit(2)},20000);console.log('ARMED');process.stdin.on('end',()=>clearTimeout(t));process.stdin.resume();`],{detached:true});
 let stdout='',stderr='';w.stdout.on('data',b=>stdout+=b);w.stderr.on('data',b=>stderr+=b);const joined=new Promise(r=>w.on('close',(exit,signal)=>r({exit,signal})));
 while(!stdout.includes('ARMED'))await new Promise(r=>setTimeout(r,5));
 fs.writeFileSync(path.join(out,'worker-watchdog-armed.json'),JSON.stringify({pid:w.pid,prearmed:true,deadlineMs:20000}));
 try{await workerProof(out);}finally{
  w.stdin.end();const r=await joined;fs.writeFileSync(path.join(out,'worker-watchdog-wait.json'),JSON.stringify({...r,actualWait:true,stdoutEOF:w.stdout.readableEnded,stderrEOF:w.stderr.readableEnded,stdout,stderr}));assert.equal(r.exit,0);
 }
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
