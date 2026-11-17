'use strict';
// Ordinary authored x86 main-window, keyboard and common-file-dialog caller.
// No original application bytes or host-created windows.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const raw=r=>r-0x1000+0x200,u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
function fixture({nestedCommon=false}={}){
 const b=require('./test-sims-child-mount-native.cjs').untitledModal();
 const groups=[['kernel32.dll',0x1900,['ExitProcess','Sleep','GetTickCount']],['user32.dll',0x1940,
  ['RegisterClassA','DefWindowProcA','CreateWindowExA','GetMessageA','TranslateMessage','DispatchMessageA','SetWindowTextA','PostQuitMessage',
   'PostMessageA','GetFocus','GetParent','DestroyWindow']],
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
 b.write('Nested common API returned\0',raw(0x2940));
 b.writeUInt32LE(0x402400,raw(0x2b04));b.writeUInt32LE(0x400000,raw(0x2b10));
 b.writeUInt32LE(6,raw(0x2b1c));b.writeUInt32LE(0x402800,raw(0x2b24));
 b.writeUInt32LE(76,raw(0x2c00));b.writeUInt32LE(0x4028c0,raw(0x2c0c));
 b.writeUInt32LE(0x402900,raw(0x2c1c));b.writeUInt32LE(256,raw(0x2c20));b.writeUInt32LE(0x1000,raw(0x2c34));
 b.copy(b,raw(0x2e00),raw(0x2c00),raw(0x2c00)+76);
 b.writeUInt32LE(0x402f00,raw(0x2e1c));b.write('c:\\inner.vbp\0',raw(0x2f00));
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
  // Real-ticks fixture: retain native liveness beyond the independent UP ACK.
  // Sleep's emulated fast-forward is intentionally insufficient for this proof.
  label('exit');call(0x1908);e(0x89,0xc6);label('wait');push(0);call(0x1904);
  call(0x1908);e(0x29,0xf0,0x3d,...u32(500));j([0x0f,0x82],'wait');push(0);call(0x1900);e(0xcc);
 });
 asm(0x2400,({e,push,call,j,label})=>{
  if(nestedCommon){
   e(0x81,0x7c,0x24,8,...u32(0x8002));j([0x0f,0x85],'nested');
   e(0xff,0x74,0x24,12);call(0x196c);j([0xe9],'done');label('nested');
   e(0x81,0x7c,0x24,8,...u32(0x8001));j([0x0f,0x85],'ordinary');
   call(0x1964);e(0x50);call(0x1968);e(0xa3,...u32(0x402e04));
   push(0x402e00);call(0x1980);
   push(0x402940);e(0xa1,...u32(0x402c04),0x50);call(0x1958);j([0xe9],'done');
   label('ordinary');
  }
  e(0x81,0x7c,0x24,8,...u32(0x101));j([0x0f,0x84],'quit');
  e(0x81,0x7c,0x24,8,...u32(0x100));j([0x0f,0x85],'default');
  e(0x83,0x7c,0x24,12,0x4f);j([0x0f,0x85],'default');
  if(nestedCommon){for(const n of [0,0,0x8001])push(n);e(0xa1,...u32(0x402c04),0x50);call(0x1960);}
  push(0x402c00);call(0x1980);e(0x85,0xc0);j([0x0f,0x84],'done');
  push(0x402880);e(0xff,0x74,0x24,8);call(0x1958);j([0xe9],'done');
  label('quit');e(0x83,0x7c,0x24,12,0x51);j([0x0f,0x85],'default');push(0);call(0x195c);
  label('done');e(0x31,0xc0,0xc2,16,0);
  label('default');for(const off of [16,16,16,16])e(0xff,0x74,0x24,off);call(0x1944);e(0xc2,16,0);
 });return b;
}
module.exports={fixture};
async function stateProof(out){
 const {bootRenderHarness}=require('./render-helper'),{observe}=require('../lib/cli-native-common-controls');
 const extraWat=String.raw`
 (func (export "focus_owner") (result i32)
   (local $h i32)
   (local.set $h (global.get $next_hwnd))
   (global.set $next_hwnd (i32.add (local.get $h) (i32.const 1)))
   (call $wnd_table_set (local.get $h) (global.get $WNDPROC_CTRL_NATIVE))
   (drop (call $wnd_set_style (local.get $h) (i32.const 0x10000000)))
   (call $set_focus (local.get $h))
   (local.get $h))
 (func (export "focus_open") (param $owner i32) (param $ofn i32) (result i32)
   (local $h i32)
   (local.set $h (global.get $next_hwnd))
   (global.set $next_hwnd (i32.add (local.get $h) (i32.const 1)))
   (call $create_open_dialog (local.get $h) (local.get $owner) (i32.const 0) (local.get $ofn))
   (local.get $h))
 (func (export "focus_destroy") (param $h i32) (call $wnd_destroy_tree (local.get $h)))
 (func (export "focus_style") (param $h i32) (param $s i32) (drop (call $wnd_set_style (local.get $h) (local.get $s))))
 (func (export "focus_reuse") (param $h i32)
   (call $wnd_table_set (local.get $h) (global.get $WNDPROC_CTRL_NATIVE))
   (drop (call $wnd_set_style (local.get $h) (i32.const 0x10000000))))
 (func (export "focus_child") (param $h i32) (param $id i32) (result i32) (call $ctrl_find_by_id (local.get $h) (local.get $id)))
 (func (export "focus_park") (param $h i32) (param $ret i32)
   (i32.store offset=16 (global.get $reg_base) (i32.const 0x00120000))
   (call $gs32 (i32.const 0x00120000) (local.get $ret))
   (call $modal_capture_nonvolatile)
   (call $modal_begin (local.get $h) (i32.const 8)))
 (func (export "focus_finish") (call $modal_done (i32.const 0)))
 (func (export "focus_resume") (result i32) (call $modal_pump_step (global.get $modal_loop_thunk)))
 `;
 // Use canonical readFileSync closure reads so the exact-source preload also
 // covers this authored extra-export module. render-artifact's descriptor
 // inventory intentionally reads the live worktree and cannot seal this run.
 const stateModule=require('./compile-src').compileSrcWasm((file,source)=>
  file==='13-exports.wat'?source+'\n'+extraWat:source);
 fs.writeFileSync(path.join(out,'state-module.wasm'),stateModule,{flag:'wx'});
 const {exports:e,memory}=await bootRenderHarness({prebuiltModule:new WebAssembly.Module(stateModule),fonts:'none'});
 e.set_process_id(1000);e.set_current_thread_id(1);
 const obs=h=>observe(e,h,memory,String(e.wnd_lookup_generation(h)));
 const owner=e.focus_owner(),dlg=e.focus_open(owner),edit=e.focus_child(dlg,0x442),lb=e.focus_child(dlg,0x441);
 assert.equal(e.get_focus_hwnd(),edit);assert(e.wnd_get_style_export(owner)&0x08000000);
 assert(obs(dlg).available);assert(obs(lb).available);
 assert.equal(e.dialog_handle_key(dlg,9,0),1);
 assert.equal(e.get_focus_hwnd(),e.focus_child(dlg,1));
 assert.equal(e.dialog_handle_key(dlg,9,1),1);assert.equal(e.get_focus_hwnd(),edit);
 const outerFocus=edit,nested=e.focus_open(dlg);
 assert.equal(e.get_focus_hwnd(),e.focus_child(nested,0x442));
 e.focus_destroy(nested);assert.equal(e.get_focus_hwnd(),outerFocus);
 assert.equal(e.wnd_get_style_export(dlg)&0x08000000,0);
 e.focus_destroy(dlg);assert.equal(e.get_focus_hwnd(),owner);
 assert.equal(e.wnd_get_style_export(owner)&0x08000000,0);assert.equal(e.native_listbox_get(lb,0),-1);
 assert.equal(e.native_common_frame(dlg),0);
 // Native acceptance follows the same teardown and restores the saved focus.
 const ofn=e.guest_alloc(76),file=e.guest_alloc(256);
 for(let i=0;i<76;i+=4)e.guest_write32(ofn+i,0);
 e.guest_write32(ofn,76);e.guest_write32(ofn+28,file);e.guest_write32(ofn+32,256);
 const fileWa=require('../lib/region-map.generated').g2w(file,e.get_image_base());
 new Uint8Array(memory.buffer).set(Buffer.from('C:\\accepted.txt\0'),fileWa);
 const accepted=e.focus_open(owner,ofn);e.focus_park(accepted,0x401234);
 e.send_message(accepted,0x111,1,0);assert.equal(e.modal_dialog_hwnd(),0);
 assert.equal(e.focus_resume(),1);assert.equal(e.get_eip(),0x401234);
 assert.equal(e.get_focus_hwnd(),owner);assert.equal(e.native_common_frame(accepted),0);
 assert.equal(Buffer.from(new Uint8Array(memory.buffer,fileWa,15)).toString('latin1'),'C:\\accepted.txt');
 // Previously disabled owners stay disabled and cannot regain focus.
 e.focus_style(owner,0x18000000);const disabled=e.focus_open(owner);e.focus_destroy(disabled);
 assert(e.wnd_get_style_export(owner)&0x08000000);assert.equal(e.get_focus_hwnd(),0);
 e.focus_style(owner,0x10000000);
 // The same numeric HWND is a different owner after retirement.
 const oldGen=e.wnd_lookup_generation(owner),reuse=e.focus_open(owner);
 e.focus_destroy(owner);e.focus_reuse(owner);assert.notEqual(e.wnd_lookup_generation(owner),oldGen);
 e.focus_destroy(reuse);assert.equal(e.get_focus_hwnd(),0);
 // Real native combo/list contents, selection, empty text and unsupported indices.
 const cb=e.test_create_combobox(0,0,100,100,3),list=e.combobox_get_lb_hwnd(cb);
 assert(obs(cb).available);assert.equal(obs(cb).state.list.count,0);
 const text=e.guest_alloc(8),wa=require('../lib/region-map.generated').g2w(text,e.get_image_base());
 new Uint8Array(memory.buffer).set(Buffer.from('alpha\0'),wa);
 assert.equal(e.send_message(cb,0x143,0,text),0);
 assert.equal(e.send_message(cb,0x14e,0,0),0);
 const observed=obs(cb);assert.equal(observed.state.selection,0);
 assert.equal(observed.state.list.items[0].text,'alpha');assert.equal(observed.state.text,'alpha');
 assert.equal(e.native_listbox_selected(list,1),-1);
 assert.equal(e.native_listbox_get(cb,0),-1);assert.equal(e.native_combobox_get(list,0),-1);
 const digest=()=>require('node:crypto').createHash('sha256').update(new Uint8Array(memory.buffer)).digest('hex');
 const before=digest();obs(cb);obs(list);assert.equal(digest(),before,'observation writes no memory');
 assert.throws(()=>observe(e,cb,memory,'wrong'),'stale generation');
 const bad={...e,native_listbox_get:(h,f)=>f===1?4097:e.native_listbox_get(h,f)};
 assert.equal(observe(bad,list,memory,String(e.wnd_lookup_generation(list))).available,false);
 const tooLong={...e,native_combobox_get:(h,f)=>f===8?65537:e.native_combobox_get(h,f)};
 assert.throws(()=>observe(tooLong,cb,memory,String(e.wnd_lookup_generation(cb))));
 assert.equal(require('../lib/cli-native-common-controls').qualified({controlClass:4,live:true,generation:'1',processId:1000,threadId:1,
  commonControl:{contract:'native-common-controls-v1',available:false}}),false);
 const retired={...e,native_combobox_get:(h,f)=>{const v=e.native_combobox_get(h,f);if(f===8)e.focus_destroy(h);return v;}};
 assert.throws(()=>observe(retired,cb,memory,String(e.wnd_lookup_generation(cb))));
 assert.equal(e.native_combobox_get(cb,0),-1);
 // Completing the inner API splices its own return before restoring the
 // still-live parent's parked frame. Both return PCs must survive nesting.
 const outer=e.focus_open(owner);e.focus_park(outer,0x401111);
 const inner=e.focus_open(outer);e.focus_park(inner,0x402222);e.focus_finish();
 assert.equal(e.focus_resume(),1);assert.equal(e.get_eip(),0x402222);
 const nestedContinuation={outer,outerLive:!!e.wnd_lookup_live(outer),inner,
  activeModal:e.modal_dialog_hwnd(),focus:e.get_focus_hwnd(),expectedModal:outer,
  innerReturn:e.get_eip()};
 assert(nestedContinuation.outerLive);assert.equal(nestedContinuation.activeModal,outer);
 assert.equal(nestedContinuation.focus,e.focus_child(outer,0x442));
 e.focus_finish();assert.equal(e.focus_resume(),1);assert.equal(e.get_eip(),0x401111);
 assert.equal(e.modal_dialog_hwnd(),0);
 const result={passed:true,stateModuleSHA256:require('node:crypto').createHash('sha256').update(stateModule).digest('hex'),initialFilenameFocus:true,restore:true,acceptFocusRestored:true,nestedFocusLease:true,preDisabled:true,
  ownerGenerationReuse:true,retired:true,realComboItemsSelectionText:true,readOnlyMemory:true,bounded:true,
  callbackRetirementRefused:true,staleGenerationRefused:true,textBoundsRefused:true,
  unsupportedStateRefused:true,nestingBoundary:null,nestedContinuation,safeForInstalledOriginal:false};
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'state-proof.json'),JSON.stringify(result,null,2)+'\n');
 console.log('PASS native common focus lifetime and bounded public state');
}
async function run(out){
 const cp=require('node:child_process'),net=require('node:net'),{startControlSession}=require('./control-session');
 const save=(n,v)=>{const p=path.join(out,n),tmp=p+'.pending';
  fs.writeFileSync(tmp,JSON.stringify(v,null,2)+'\n',{flag:'wx'});fs.linkSync(tmp,p);fs.unlinkSync(tmp);
 },pause=ms=>new Promise(r=>setTimeout(r,ms));
 const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
 const at=Date.now()/1000;save('launch.json',{deadline:at+45,gameplayCutoff:at+40,reserveSeconds:5,rootPort:port});
 fs.copyFileSync(path.join(out,'../runtime-inputs.json'),path.join(out,'runtime-inputs.json'));
 const w=cp.spawn(process.execPath,['-e',`let pid;const t=setTimeout(()=>{if(pid)try{process.kill(-pid,'SIGKILL')}catch{};process.exit(2)},45000);console.log('ARMED');process.stdin.on('data',b=>pid=Number(b));process.stdin.on('end',()=>clearTimeout(t));`]);
 let arm='',we='';w.stdout.on('data',b=>arm+=b);w.stderr.on('data',b=>we+=b);const joined=new Promise(r=>w.on('close',(exit,signal)=>r({exit,signal})));
 while(!arm.includes('ARMED'))await pause(5);save('watchdog-armed.json',{pid:w.pid,prearmed:true,deadlineMs:45000});
 const invocationToken=require('node:crypto').randomUUID();
 const s=startControlSession(['test/run.js','--exe='+path.join(out,'installed-scope.exe'),'--no-build','--threads','--real-ticks','--winver=nt4','--control-stdin','--control='+port,'--max-seconds=40','--max-batches=100000000','--stuck-after=0','--quiet-api','--quiet-blocks','--png-canvas','--native-exit-receipt='+path.join(out,'native-exit.json'),'--native-invocation-token='+invocationToken],{spawnOptions:{detached:true}});
 const np=require('../tools/native-proc.cjs'),info={pid:s.child.pid,startToken:np.token(s.child.pid),bootId:np.bootId(),invocationToken};
 save('native-pid.json',info);w.stdin.write(String(s.child.pid));
 let teardown=false;
 s.child.on('close',(exit,signal)=>save('native-wait.json',{...info,exit,signal,actualWait:true,disposition:teardown?'cleanup':'normal',hostTeardown:teardown,atWait:Date.now()/1000,atWaitMono:Number(process.hrtime.bigint())/1e9,stdoutEOF:s.child.stdout.readableEnded,stderrEOF:s.child.stderr.readableEnded}));
 let index=0;
 const control=async(args,expected=0)=>{
  const p=cp.spawn(process.execPath,['tools/vb5cce-reviewed-control.js',...args],{env:{...process.env,DELPHI5_RUN:out,DELPHI5_PORT:String(port)}});let stdout='',stderr='';p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b);
  const result=await new Promise(r=>p.on('close',(exit,signal)=>r({exit,signal,stdout,stderr,actualWait:true,stdoutEOF:p.stdout.readableEnded,stderrEOF:p.stderr.readableEnded})));
  save('controller-'+(++index)+'.json',{args,...result});if(expected!==null)assert.equal(result.exit,expected,stdout+stderr);return result;
 };
 try{
  let scene;const due=Date.now()+10000;
  do{scene=await s.send({action:'snapshot'});if(scene.mainHwnd!=='0x0'&&scene.focus===scene.mainHwnd)break;assert(Date.now()<due);await pause(10);}while(true);
  save('main-snapshot.json',scene);await control(['capture','main']);
  await control(['review','main','Automated authored main window fixture; O opens a native file dialog','O','install',scene.mainHwnd]);
  await control(['bind','main']);await control(['intent','open','main','-1','79','install']);
  const after=JSON.parse(fs.readFileSync(path.join(out,'open-observation.json'))).snapshot;
  assert.notEqual(after.modalHwnd,'0x0');assert.notEqual(after.focus,scene.mainHwnd);
  assert.equal(after.focusTopLevel,after.modalHwnd);
  assert.equal(after.windows.find(w=>w.hwnd===after.focus).controlId,0x442);
  assert.equal(after.windows.find(w=>w.hwnd===after.modalHwnd).controlClass,12);
  const failure=require('../lib/cli-native-scene').captureFailures(after);
  assert.deepEqual(failure,{context:[],controls:[]});
  for(const w of after.windows.filter(w=>[4,5,9,12].includes(w.controlClass)))
    assert(require('../lib/cli-native-common-controls').qualified(w),JSON.stringify(w));
  // Observational authored-fixture pixels. This plain image confers no
  // reviewed-context admission and drives no input.
  const image=await s.send({action:'png',path:path.join(out,'file-open-raw.png')});
  save('file-open-raw.json',{image,reviewedContext:false,inputsAuthorized:false});
  await control(['capture','file-open']);
  await control(['review','file-open','Authored common dialog; Tab traverses from filename to its filter combo','Tab','install',after.focus]);
  const traversal=await control(['intent','tab','file-open','-1','9','install'],null);
  assert.equal(traversal.exit,0,'exact native modal invocation must confirm Tab; UNKNOWN is a failure');
  const tabbed=JSON.parse(fs.readFileSync(path.join(out,'tab-observation.json'))).snapshot;
  assert.equal(tabbed.windows.find(w=>w.hwnd===tabbed.focus).controlId,0x445);
  await control(['capture','tabbed']);
  await control(['review','tabbed','Authored common dialog; Escape cancels','Escape','install',tabbed.focus]);
  await control(['intent','cancel','tabbed','-1','27','install']);
  const cancelled=JSON.parse(fs.readFileSync(path.join(out,'cancel-observation.json'))).snapshot;
  assert.equal(cancelled.modalHwnd,'0x0');assert.equal(cancelled.focus,scene.mainHwnd);
  assert.equal(cancelled.windows.find(w=>w.hwnd===scene.mainHwnd).style&0x08000000,0);
  await control(['capture','restored']);
  await control(['review','restored','Authored main; Q requests native normal exit','Q','quit',scene.mainHwnd]);
  await control(['intent','quit','restored','-1','81','quit']);
  save('qualification.json',{passed:true,safeForInstalledOriginal:false,main:true,keyboard:true,
   nativeFileDialog:true,fileOpenCapture:true,boundary:null,focusRestored:true,nativeQuit:true,
   admissionRequires:'personal pixel review, complete generic state/focus negatives and exact published full qualification'});
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
  assert.equal(await call('ctrl_get_class',modal),12);assert.equal(await call('wnd_get_owner',modal),main);
  assert.notEqual(focus,main);assert.equal(await call('ctrl_get_id',focus),0x442);
  assert.equal(await call('native_common_frame',modal),1);
  await call('post_message_q',focus,0x100,9,0);
  await until(async()=>await call('get_focus_hwnd')!==focus);
  const tabbed=await call('get_focus_hwnd');assert.equal(await call('ctrl_get_id',tabbed),0x445);
  await call('post_message_q',tabbed,0x100,27,0);
  await until(async()=>!await call('modal_dialog_hwnd')&&await call('get_focus_hwnd')===main);
  assert.equal(await call('get_focus_hwnd'),main);
  assert(logs.some(s=>s.includes('instantiated')));
  result={passed:true,actualCPUWorker:true,main,modal,focus,modalClass:12,modalOwner:main,
   focusRestored:true,tabTraversal:true,directGuestCalls:'authored fixture setup, queue and observation only; no original',safeForInstalledOriginal:false};
 }finally{await host.stop();}
 assert(link._stopped);result.workerStopJoined=true;
 fs.writeFileSync(path.join(out,'actual-worker.json'),JSON.stringify(result,null,2)+'\n');
}
async function nestedProof(out){
 const {GuestThreadHost}=require('../lib/guest-thread-host'),{createHostImports}=require('../lib/host-imports');
 const module=new WebAssembly.Module(fs.readFileSync(process.env.DELPHI5_MODULE_FD));
 const cases=[];
 for(const worker of [false,true])for(const mode of ['cancel-accept','accept-cancel','inner-destroy','inner-reuse','outer-destroy']){
  let host,e,memory,link;
  if(worker){
   memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
   const imports=createHostImports({getMemory:()=>memory.buffer,renderer:null,resourceJson:{}});imports.host.memory=memory;
   host=new GuestThreadHost({memory,module,hostImports:imports.host,sigs:require('../lib/host-import-sigs.generated.json').sigs,
    workerUrl:path.resolve(__dirname,'../lib/guest-worker.js'),clockIntervalMs:0});
   await host.start();link=host.link;await host.loadPe(fixture({nestedCommon:true}),'nested-common.exe');
  }else{
   ({exports:e,memory}=await require('./render-helper').bootRenderHarness({prebuiltModule:module,fonts:'none'}));
   const pe=fixture({nestedCommon:true});new Uint8Array(memory.buffer).set(pe,e.get_staging());assert(e.load_pe(pe.length));
  }
  const call=async(n,...a)=>worker?host.callExport(n,...a):e[n](...a);
  const until=async pred=>{for(let i=0;i<400;i++){
   if(await pred())return;
   if([1,6,7,15].includes(await call('get_yield_reason')))await call('clear_yield');
   if(worker){const r=await host.link.slice(128);assert(!r.trapped,JSON.stringify(r));}else await call('run',128);
  }throw Error('nested '+mode+' deadline '+JSON.stringify({worker,eip:await call('get_eip'),modal:await call('modal_dialog_hwnd'),focus:await call('get_focus_hwnd'),yield:await call('get_yield_reason')}));};
  const text=async h=>{const p=await call('native_user_text_ptr',h),n=await call('native_user_text_length',h);return Buffer.from(new Uint8Array(memory.buffer,p,n)).toString('latin1');};
  try{
   await call('set_process_id',1000);await call('set_current_thread_id',1);
   await call('set_eip',0x402000);await call('set_esp',0x7408000);await call('guest_write32',0x7408000,0);
   await until(async()=>!!await call('get_main_hwnd'));const main=await call('get_main_hwnd');
   await call('post_message_q',main,0x100,79,0);
   await until(async()=>!!await call('modal_dialog_hwnd'));const outer=await call('modal_dialog_hwnd');
   await until(async()=>{const h=await call('modal_dialog_hwnd');return h&&h!==outer;});
   const inner=await call('modal_dialog_hwnd'),innerGeneration=await call('native_window_generation_word',inner,0);
   assert.equal(await call('wnd_get_owner',inner),outer);assert(await call('wnd_get_style_export',outer)&0x08000000);
   if(mode==='outer-destroy'){
    await call('post_message_q',main,0x8002,outer,0);
    await until(async()=>!await call('wnd_lookup_live',outer));
   }
   if(mode==='inner-destroy'||mode==='inner-reuse'){
    await call('post_message_q',main,0x8002,inner,0);
    await until(async()=>!await call('wnd_lookup_live',inner));
    if(mode==='inner-reuse'){
     await call('wnd_table_set',inner,0xffff0001);
     assert.notEqual(await call('native_window_generation_word',inner,0),innerGeneration);
    }
   }else await call('post_message_q',await call('get_focus_hwnd'),0x100,mode==='accept-cancel'?13:27,0);
   await until(async()=>await text(main)==='Nested common API returned');
   if(mode==='outer-destroy'){
    await until(async()=>!await call('modal_dialog_hwnd'));
   }else{
    assert.equal(await call('modal_dialog_hwnd'),outer,'outer continuation restored');
    assert.equal(await call('wnd_get_style_export',outer)&0x08000000,0);
    const focus=await call('get_focus_hwnd');assert.equal(await call('ctrl_get_id',focus),0x442);
    await call('post_message_q',focus,0x100,mode==='cancel-accept'?13:27,0);
    await until(async()=>!await call('modal_dialog_hwnd'));
    assert.equal(await call('get_focus_hwnd'),main);
    assert.equal(await call('wnd_get_style_export',main)&0x08000000,0);
    if(mode==='cancel-accept')await until(async()=>await text(main)==='Native sample opened');
   }
   if(mode==='inner-reuse')assert.equal(await call('wnd_lookup_live',inner),1,'replacement untouched');
   cases.push({worker,mode,main,outer,inner,actualX86:true,outerContinuationRestored:mode!=='outer-destroy',retiredWindowUntouched:mode==='inner-reuse'});
  }finally{if(host)await host.stop();}
  if(worker)assert(link._stopped,'Worker stop joined');
 }
 fs.writeFileSync(path.join(out,'nested-proof.json'),JSON.stringify({passed:true,cases},null,2)+'\n');
}
async function main(){
 const out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'installed-scope.exe'),fixture(),{flag:'wx'});
 if(process.argv.includes('--state')){await stateProof(out);return;}
 const nested=process.argv.includes('--nested');
 if(!process.argv.includes('--run')&&!process.argv.includes('--worker-only')&&!nested)return;
 if(!process.argv.includes('--worker-only')&&!nested)await run(out);
 const cp=require('node:child_process'),w=cp.spawn(process.execPath,['-e',`const t=setTimeout(()=>{try{process.kill(-${process.pid},'SIGKILL')}catch{};process.exit(2)},20000);console.log('ARMED');process.stdin.on('end',()=>clearTimeout(t));process.stdin.resume();`],{detached:true});
 let stdout='',stderr='';w.stdout.on('data',b=>stdout+=b);w.stderr.on('data',b=>stderr+=b);const joined=new Promise(r=>w.on('close',(exit,signal)=>r({exit,signal})));
 while(!stdout.includes('ARMED'))await new Promise(r=>setTimeout(r,5));
 fs.writeFileSync(path.join(out,'worker-watchdog-armed.json'),JSON.stringify({pid:w.pid,prearmed:true,deadlineMs:20000}));
 try{if(nested)await nestedProof(out);else await workerProof(out);}finally{
  w.stdin.end();const r=await joined;fs.writeFileSync(path.join(out,'worker-watchdog-wait.json'),JSON.stringify({...r,actualWait:true,stdoutEOF:w.stdout.readableEnded,stderrEOF:w.stderr.readableEnded,stdout,stderr}));assert.equal(r.exit,0);
 }
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
