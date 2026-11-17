'use strict';
// Independent authored contract controls. These are not native execution evidence.
// No runtime/helper import during the ordered LIGHT ownership wait.
const assert = require('node:assert/strict');
const {test} = require('node:test');

function inspectUser(ex) {
  const names = ['get_main_hwnd','get_focus_hwnd','get_capture_hwnd','modal_dialog_hwnd',
    'dialogbox_hwnd','get_process_id','get_current_thread_id','get_window_thread',
    'wnd_lookup_live','wnd_lookup_generation','wnd_get_style_export','wnd_get_owner',
    'wnd_get_parent','wnd_top_level','wnd_screen_w','wnd_screen_h','get_eip',
    'get_quit_flag','get_yield_reason','ctrl_get_class'];
  for (const name of names) assert.equal(typeof ex[name], 'function', 'missing public export '+name);
  const processId = ex.get_process_id() >>> 0, threadId = ex.get_current_thread_id() >>> 0;
  const eip = ex.get_eip() >>> 0, quit = ex.get_quit_flag() >>> 0, yieldReason = ex.get_yield_reason() >>> 0;
  function window(hwnd) {
    hwnd >>>= 0;
    const style = ex.wnd_get_style_export(hwnd) >>> 0;
    return {hwnd, generation:String(ex.wnd_lookup_generation(hwnd)),
      live:!!ex.wnd_lookup_live(hwnd), threadId:ex.get_window_thread(hwnd) >>> 0,
      owner:ex.wnd_get_owner(hwnd) >>> 0, parent:ex.wnd_get_parent(hwnd) >>> 0,
      visible:!!(style & 0x10000000), child:!!(style & 0x40000000),
      width:ex.wnd_screen_w(hwnd) >>> 0, height:ex.wnd_screen_h(hwnd) >>> 0};
  }
  const main = window(ex.get_main_hwnd()), focus = window(ex.get_focus_hwnd());
  const modalHwnd = (ex.modal_dialog_hwnd() || ex.dialogbox_hwnd()) >>> 0;
  const modal = modalHwnd ? window(modalHwnd) : null;
  const capture = ex.get_capture_hwnd() >>> 0, focusTopLevel = ex.wnd_top_level(focus.hwnd) >>> 0;
  const live = w => !!(w.hwnd && w.live && w.generation !== '0' && w.threadId === threadId);
  const checks = {
    process:!!processId, thread:!!threadId, instruction:!!eip, notQuit:!quit, notExited:yieldReason !== 2,
    mainLive:live(main), mainVisible:main.visible, mainTopLevel:!main.child,
    focusLive:live(focus), noCapture:!capture,
    modalValid:!modal || !!(live(modal) && modal.visible && !modal.child &&
      (modal.owner === main.hwnd || !modal.owner && ex.ctrl_get_class(modal.hwnd) === 16)),
    focusTopLevel:focusTopLevel === (modal ? modal.hwnd : main.hwnd),
  };
  return {healthy:Object.values(checks).every(Boolean), checks,
    failed:Object.keys(checks).filter(k => !checks[k]),
    execution:{eip,quit,yieldReason}, context:{processId,threadId,main,focus,focusTopLevel,capture,modal}};
}

// The observer has no bridge, scene capture or input authority. Only a current
// positive snapshot can leave UNSENT. Expiry never installs an endpoint.
function unpublishedReadiness({due, now, sample, publish}) {
  assert(Number.isSafeInteger(due), 'fixed startup deadline');
  let terminal = false, owner = null;
  return () => {
    assert(!terminal, 'startup observer terminal');
    const reject = reason => {terminal = true; return {state:'UNSENT',terminal:true,reason};};
    if (now() >= due) return reject('deadline');
    let current;
    try { current = sample(); }
    catch (error) { terminal = true; throw error; }
    if (now() >= due) return reject('deadline');
    if (!owner) owner = structuredClone(current.owner);
    if (JSON.stringify(owner) !== JSON.stringify(current.owner)) return reject('owner changed');
    if (current.fault || current.retired) return reject('fault or retired');
    if (!current.user.checks.notQuit || !current.user.checks.notExited) return reject('native exit');
    if (!current.user.healthy) return {state:'UNSENT',terminal:false,failed:current.user.failed};
    terminal = true;
    return {state:'READY', endpoint:publish(current)};
  };
}

function authoredPublicExports() {
  const state = {process:1000, thread:1, eip:0x401000, quit:0, yieldReason:1,
    main:10, focus:11, capture:0, modal:0, dialog:0};
  const windows = new Map([
    [10,{generation:1,live:1,thread:1,owner:0,parent:0,style:0x10000000,top:10,kind:0}],
    [11,{generation:2,live:1,thread:1,owner:0,parent:10,style:0x50000000,top:10,kind:0}],
    [20,{generation:3,live:1,thread:1,owner:10,parent:0,style:0x10000000,top:20,kind:16}],
  ]);
  const ex = {};
  for (const [name,key] of Object.entries({get_main_hwnd:'main',get_focus_hwnd:'focus',get_capture_hwnd:'capture',
    modal_dialog_hwnd:'modal',dialogbox_hwnd:'dialog',get_process_id:'process',get_current_thread_id:'thread',
    get_eip:'eip',get_quit_flag:'quit',get_yield_reason:'yieldReason'})) ex[name] = () => state[key];
  for (const [name,key] of Object.entries({get_window_thread:'thread',wnd_lookup_live:'live',
    wnd_lookup_generation:'generation',wnd_get_style_export:'style',wnd_get_owner:'owner',
    wnd_get_parent:'parent',wnd_top_level:'top',ctrl_get_class:'kind'})) ex[name] = h => windows.get(h)?.[key] || 0;
  ex.wnd_screen_w = h => windows.has(h) ? 640 : 0;
  ex.wnd_screen_h = h => windows.has(h) ? 480 : 0;
  return {state,windows,ex};
}

function registerAuthoredControls() {
test('runtime source selection covers actual startup JSON and nested vendor scripts', () => {
  const old=/^(?:host\.js|index\.html|fonts\/substitutions\.json|lib\/[^/]+\.(?:js|json)|test\/static-server\.js)$/;
  for(const name of ['src/api_table.json','lib/vendor/tweetnacl.js','lib/vendor/webaudio-tinysynth.js']) {
    assert.equal(old.test(name),false);
    assert.equal(runtimeSourcePath(name),true);
  }
  for(const name of ['host.js','index.html','fonts/substitutions.json','lib/guest-worker.js','test/static-server.js'])
    assert.equal(runtimeSourcePath(name),true);
  for(const name of ['../host.js','/host.js','lib/../host.js','test/binaries/private-game.json','scratch/runs/test.js'])
    assert.equal(runtimeSourcePath(name),false);
});
test('all native predicate failures remain explicit and unhealthy', () => {
  const faults = [
    ['process', a=>a.state.process=0], ['thread', a=>a.state.thread=0],
    ['instruction', a=>a.state.eip=0], ['notQuit', a=>a.state.quit=1],
    ['notExited', a=>a.state.yieldReason=2], ['mainLive', a=>a.state.main=0],
    ['mainLive', a=>a.windows.get(10).live=0], ['mainLive', a=>a.windows.get(10).generation=0],
    ['mainLive', a=>a.windows.get(10).thread=2], ['mainVisible', a=>a.windows.get(10).style=0],
    ['mainTopLevel', a=>a.windows.get(10).style=0x50000000], ['focusLive', a=>a.state.focus=0],
    ['focusLive', a=>a.windows.get(11).generation=0], ['focusLive', a=>a.windows.get(11).thread=2],
    ['noCapture', a=>a.state.capture=10], ['focusTopLevel', a=>a.windows.get(11).top=99],
    ['modalValid', a=>{a.state.modal=20;a.windows.get(20).owner=99;}],
    ['modalValid', a=>{a.state.modal=20;a.windows.get(20).thread=2;}],
    ['modalValid', a=>{a.state.modal=20;a.windows.get(20).live=0;}],
  ];
  for (const [name,mutate] of faults) {
    const a=authoredPublicExports(); assert(inspectUser(a.ex).healthy); mutate(a);
    const actual=inspectUser(a.ex); assert.equal(actual.healthy,false,name); assert(actual.failed.includes(name),name);
  }
});

test('yieldReason 2 differs from ordinary yield; modal requires actual focused top level', () => {
  const a=authoredPublicExports(); assert(inspectUser(a.ex).healthy);
  a.state.modal=20; assert.equal(inspectUser(a.ex).healthy,false);
  a.state.focus=20; assert(inspectUser(a.ex).healthy);
  a.state.yieldReason=2; assert.equal(inspectUser(a.ex).healthy,false);
  a.state.yieldReason=1; a.state.modal=0; a.state.dialog=20; assert(inspectUser(a.ex).healthy);
  a.windows.get(20).owner=0; assert(inspectUser(a.ex).healthy);
  a.windows.get(20).kind=0; assert.equal(inspectUser(a.ex).healthy,false);
});

test('delayed publication remains UNSENT until actual healthy USER, then publishes once', () => {
  const a=authoredPublicExports(); a.state.main=0; a.state.focus=0;
  let at=0,publishes=0;
  const observe=unpublishedReadiness({due:60,now:()=>at,
    sample:()=>({owner:{endpoint:'actual-owner',generation:1},user:inspectUser(a.ex)}),
    publish:()=>++publishes});
  assert.equal(observe().state,'UNSENT'); assert.equal(publishes,0);
  at=30; a.state.main=10; assert.equal(observe().state,'UNSENT');
  at=40; a.state.focus=11; assert.equal(observe().state,'READY'); assert.equal(publishes,1);
  assert.throws(observe,/terminal/);
});

test('quit, faults, retirement, owner generations and expiry refuse before publication', () => {
  for (const fault of ['quit','exit','fault','retired','generation','endpoint','timeout','sample-timeout']) {
    const a=authoredPublicExports(); a.state.main=0;
    let at=0,publishes=0,extra={}; const owner={endpoint:'original',generation:1};
    const observe=unpublishedReadiness({due:60,now:()=>at,
      sample:()=>{if(fault==='sample-timeout'&&at)at=60;return {...extra,owner:{...owner},user:inspectUser(a.ex)};},
      publish:()=>++publishes});
    assert.equal(observe().state,'UNSENT'); a.state.main=10; at=1;
    if(fault==='quit')a.state.quit=1;
    if(fault==='exit')a.state.yieldReason=2;
    if(fault==='fault')extra.fault=true;
    if(fault==='retired')extra.retired=true;
    if(fault==='generation')owner.generation=2;
    if(fault==='endpoint')owner.endpoint='replacement';
    if(fault==='timeout')at=60;
    const result=observe(); assert.equal(result.state,'UNSENT',fault); assert.equal(result.terminal,true,fault);
    assert.equal(publishes,0,fault); assert.throws(observe,/terminal/);
  }
});

test('observer faults cannot be retried; mutable owner aliases cannot replace generation', () => {
  let calls=0;
  const throws=unpublishedReadiness({due:60,now:()=>0,sample:()=>{calls++;throw Error('native unavailable');},
    publish:()=>assert.fail('fault cannot publish')});
  assert.throws(throws,/native unavailable/);assert.throws(throws,/terminal/);assert.equal(calls,1);
  const a=authoredPublicExports();a.state.main=0;
  const owner={endpoint:'current',generation:1};
  const observes=unpublishedReadiness({due:60,now:()=>0,
    sample:()=>({owner,user:inspectUser(a.ex)}),publish:()=>assert.fail('changed generation cannot publish')});
  assert.equal(observes().terminal,false);owner.generation=2;a.state.main=10;
  assert.equal(observes().reason,'owner changed');
});
}

function runtimeSourcePath(name) {
  if(typeof name!=='string'||name.startsWith('/')||name.split('/').includes('..'))return false;
  return /^(?:host\.js|index\.html|src\/api_table\.json|fonts\/substitutions\.json|lib\/.+\.(?:js|json)|test\/static-server\.js|test\/gta2-paired-controller\.test\.cjs|test\/test-gta2-(?:current-scene-prearm|fresh-attestation-prearm|browser-release-scene-binding|directx-version-causal-repair|final-pin-prearm-scheduling|worker-complete-confirmation)\.cjs)$/.test(name);
}

// A new Win32 program for actual interpreter startup qualification. Merely
// importing/running the model tests does not generate, compile or launch it.
// Its only state is public USER state; there are no original game bytes.
function startupPE(variant='delayed-user') {
  assert(['delayed-user','missing-user','quit','fault','capture','modal',
    'retired-window','replaced-window','retired-owner','other-thread-window'].includes(variant));
  const bytes=Buffer.alloc(0x3400),base=0x400000,raw=rva=>rva-0x1000+0x400;
  const dword=(at,n)=>bytes.writeUInt32LE(n>>>0,at),word=(at,n)=>bytes.writeUInt16LE(n,at);
  const pe=0x80,opt=pe+24,section=opt+0xe0;
  word(0,0x5a4d);dword(0x3c,pe);dword(pe,0x4550);word(pe+4,0x14c);word(pe+6,1);
  word(pe+20,0xe0);word(pe+22,0x10e);word(opt,0x10b);dword(opt+16,0x2000);dword(opt+28,base);
  dword(opt+32,0x1000);dword(opt+36,0x400);dword(opt+56,0x4000);dword(opt+60,0x400);
  word(opt+40,4);word(opt+48,4);word(opt+68,2);dword(opt+72,0x100000);dword(opt+76,0x1000);
  dword(opt+80,0x100000);dword(opt+84,0x1000);dword(opt+92,16);dword(opt+104,0x1000);dword(opt+108,60);
  bytes.write('.startup',section);dword(section+8,0x3000);dword(section+12,0x1000);
  dword(section+16,0x3000);dword(section+20,0x400);dword(section+36,0xe0000060);
  let strings=0x1600; const apis=new Map();
  const libraries=[['kernel32.dll',['Sleep','ExitProcess',...(variant==='other-thread-window'?['CreateThread']:[])]],['user32.dll',[
    'RegisterClassA','CreateWindowExA','GetMessageA','TranslateMessage','DispatchMessageA',
    'DefWindowProcA','SetFocus','SetCapture','MessageBoxA',
    ...(['retired-window','replaced-window'].includes(variant)?['DestroyWindow','ReleaseCapture']:[])]]];
  for(const [index,[dll,names]] of libraries.entries()) {
    const descriptor=0x1000+index*20,thunk=0x1200+index*0x100;
    dword(raw(descriptor),thunk);dword(raw(descriptor+12),strings);dword(raw(descriptor+16),thunk);
    bytes.write(dll+'\0',raw(strings));strings+=dll.length+1;
    for(const [i,name] of names.entries()) {
      dword(raw(thunk+i*4),strings);bytes.write(name+'\0',raw(strings+2));strings+=name.length+3;
      apis.set(name,base+thunk+i*4);
    }
  }
  assert(strings<0x2000);
  for(const [rva,text] of [[0x3000,'AuthoredUserReadiness'],[0x3040,'Authored USER readiness '+variant],
    [0x30a0,'Native modal startup'],[0x30e0,'Authored public USER modal; no input sent.']])bytes.write(text+'\0',raw(rva));
  // WNDCLASSA: actual guest callback, hInstance, background and class name.
  dword(raw(0x3204),base+0x2600);dword(raw(0x3210),base);dword(raw(0x321c),6);dword(raw(0x3224),base+0x3000);
  const u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
  function assemble(start,work) {
    const code=[],labels=new Map(),fixups=[];
    const emit=(...v)=>code.push(...v),push=n=>emit(0x68,...u32(n));
    const call=name=>{assert(apis.has(name));emit(0xff,0x15,...u32(apis.get(name)));};
    const label=name=>labels.set(name,code.length);
    const jump=(name,op)=>{emit(...(op?[0x0f,op]:[0xe9]));fixups.push([code.length,name]);emit(0,0,0,0);};
    work({emit,push,call,label,jump});const compiled=Buffer.from(code);
    for(const [at,name] of fixups){assert(labels.has(name));compiled.writeInt32LE(labels.get(name)-at-4,at);}
    assert(start+compiled.length<(start===0x2000?0x2600:start===0x2600?0x2800:0x3000));compiled.copy(bytes,raw(start));
  }
  const createWindow=({push,call,emit})=>{
    for(const value of [0,base,0,0,420,640,80,80,0x10cf0000,base+0x3040,base+0x3000,0])push(value);
    call('CreateWindowExA');emit(0xa3,...u32(base+0x3240));emit(0x50);call('SetFocus');
  };
  const messagePump=({push,call,emit,label,jump})=>{
    label('pump');push(0);push(0);push(0);push(base+0x3280);call('GetMessageA');
    emit(0x85,0xc0);jump('exit',0x84);push(base+0x3280);call('TranslateMessage');
    push(base+0x3280);call('DispatchMessageA');jump('pump');label('exit');push(0);call('ExitProcess');emit(0xcc);
  };
  assemble(0x2000,({emit,push,call,label,jump})=>{
    if(variant==='fault'){emit(0x0f,0x0b);return;}
    if(variant==='quit'){push(0);call('ExitProcess');emit(0xcc);return;}
    if(variant==='missing-user'){
      label('wait');push(100);call('Sleep');jump('wait');return;
    }
    // Real Sleep before any RegisterClass/CreateWindow invocation. Readiness
    // must observe absent USER before later publication on the actual owner.
    push(1200);call('Sleep');push(base+0x3200);call('RegisterClassA');
    if(variant==='other-thread-window'){
      for(const value of [base+0x3248,0,0,base+0x2800,0,0])push(value);
      call('CreateThread');label('wait');push(100);call('Sleep');jump('wait');return;
    }
    createWindow({push,call,emit});
    if(variant==='capture'){emit(0xff,0x35,...u32(base+0x3240));call('SetCapture');}
    if(['retired-window','replaced-window'].includes(variant)){
      emit(0xff,0x35,...u32(base+0x3240));call('SetCapture');push(200);call('Sleep');
      emit(0xff,0x35,...u32(base+0x3240));call('DestroyWindow');call('ReleaseCapture');
      if(variant==='replaced-window')createWindow({push,call,emit});
    }
    if(variant==='modal'){
      push(0x40);push(base+0x30a0);push(base+0x30e0);emit(0xff,0x35,...u32(base+0x3240));call('MessageBoxA');
    }
    messagePump({push,call,emit,label,jump});
  });
  assemble(0x2600,({emit,call})=>{
    emit(0x55,0x89,0xe5,0xff,0x75,20,0xff,0x75,16,0xff,0x75,12,0xff,0x75,8);
    call('DefWindowProcA');emit(0x5d,0xc2,16,0);
  });
  if(variant==='other-thread-window')assemble(0x2800,tools=>{createWindow(tools);messagePump(tools);});
  return bytes;
}

function nativeGate(out) {
  // Fail before importing helpers, generating PE bytes, touching a module or
  // launching a server/browser. Historical predecessor admission is inadequate.
  const fs=require('node:fs'),path=require('node:path');
  assert(path.isAbsolute(out));
  assert(process.env.GTA2_USER_READINESS_GATE, 'ordered GL then Sims final releases required');
  const gate=JSON.parse(fs.readFileSync(process.env.GTA2_USER_READINESS_GATE));
  for(const key of ['glFinal','simsProviderFinal','personalCurrentClosure','heavyLaneClaimed','ownedPathsClaimed'])
    assert.equal(gate[key],true,'native gate '+key);
  const heavy=JSON.parse(fs.readFileSync(path.join(out,'..','heavy-lock.json')));
  const inode=String(fs.statSync('/tmp/wine-heavy-runtime.lock').ino);
  assert(fs.readFileSync('/proc/locks','utf8').split('\n').some(line=>{
    const f=line.split(/\s+/);return f[1]==='FLOCK'&&f[3]==='WRITE'&&f[4]===String(heavy.pid)&&f[5]?.split(':').at(-1)===inode;
  }),'actual supervisor heavy flock required');
  const watch=JSON.parse(fs.readFileSync(path.join(out,'..','watchdog-armed.json')));
  const launch=JSON.parse(fs.readFileSync(path.join(out,'..','launch.json')));
  assert(watch.independent===true&&watch.deadline*1000>Date.now()&&launch.deadline*1000>Date.now(),
    'observable independent deadline prearmed before launch');
  process.kill(watch.pid,0);
}

async function nativeStartupFixture(out,mode,variant,phase) {
  nativeGate(out);
  assert(['main','worker'].includes(mode));assert(['before','after'].includes(phase));
  const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
  const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
  const native=require('../tools/gta2-browser-release-binding.cjs');
  const controller=require('../tools/gta2-paired-controller.cjs');
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  fs.mkdirSync(out,{recursive:true});
  const record=(name,value)=>fs.writeFileSync(path.join(out,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
  const append=(name,value)=>fs.appendFileSync(path.join(out,name),JSON.stringify(value)+'\n');
  const fixtureDir=path.join(root,'test/binaries/gta2-user-readiness-20261116');
  fs.mkdirSync(fixtureDir,{recursive:true});
  const bytes=startupPE(variant),fixture=path.join(fixtureDir,variant+'-'+sha(bytes).slice(0,12)+'.exe');
  if(fs.existsSync(fixture))assert(fs.readFileSync(fixture).equals(bytes),'exact authored fixture bytes');
  else fs.writeFileSync(fixture,bytes,{flag:'wx'});
  const files=['tools/gta2-browser-release-binding.cjs','tools/gta2-paired-controller.cjs',
    'test/test-gta2-native-user-readiness.cjs','host.js','lib/guest-worker.js','lib/guest-thread-host.js','build/wine-assembly.wasm'];
  record('provenance.json',{head:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
    mode,variant,phase,fixturePath:path.relative(root,fixture),fixtureSHA256:sha(bytes),
    files:files.map(p=>({path:p,sha256:sha(fs.readFileSync(path.join(root,p)))}))});
  let server,browser,joined,c,session,controlTask; const workers=new Map(),tasks=[],http=[];
  let wireInputs=0,captures=0,wireSequence=0;
  const app='authored_user_readiness';
  const evaluate=(expression,s=session)=>native.evaluate(c,s,expression);
  try {
    const staticServer=require('./static-server.js');
    server=await staticServer.startStaticServer({root,crossOriginIsolated:true,
      rewritePath:p=>p.startsWith('/binaries/')?'/test'+p:p,
      handleRequest:async(req,res)=>{
        const name=new URL(req.url,'http://127.0.0.1').pathname;
        if(!process.env.GTA2_VIEW_HEAD||!/\.(?:js|html|json|css|wat|watx)$/.test(name))return false;
        const resolved=await staticServer.resolveStaticPath(root,req.url);if(resolved.status!==200)return false;
        // The sealed source-view preload supplies exact HEAD plus whole owned
        // files through this synchronous read; ordinary file streams bypass it.
        const body=fs.readFileSync(resolved.file);
        res.writeHead(200,{'Content-Type':staticServer.mimeType(resolved.file),'Cache-Control':'no-store'});
        res.end(body);return true;
      }});
    server.prependListener('request',(req,res)=>{
      const digest=crypto.createHash('sha256');let size=0;
      const write=res.write,end=res.end;
      const consume=b=>{if(b){const bytes=Buffer.isBuffer(b)?b:Buffer.from(b);digest.update(bytes);size+=bytes.length;}};
      res.write=function(b){consume(b);return write.apply(this,arguments);};
      res.end=function(b){consume(b);return end.apply(this,arguments);};
      res.once('finish',()=>{const row={url:req.url,status:res.statusCode,size,sha256:digest.digest('hex')};
        http.push(row);append('http.log',row);});
    });
    browser=cp.spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--no-first-run',
      '--no-default-browser-check','--disable-dev-shm-usage','--enable-unsafe-swiftshader',
      '--window-size=1024,900','--remote-debugging-port=0','--user-data-dir='+out+'/profile','about:blank'],
      {stdio:['ignore','pipe','pipe']});
    const stdout=[],stderr=[];browser.stdout.on('data',b=>stdout.push(b));browser.stderr.on('data',b=>stderr.push(b));
    joined=new Promise(resolve=>browser.once('close',(code,signal)=>{
      fs.writeFileSync(path.join(out,'chrome.stdout'),Buffer.concat(stdout));fs.writeFileSync(path.join(out,'chrome.stderr'),Buffer.concat(stderr));
      record('chrome-wait.json',{pid:browser.pid,code,signal,actualWait:true,
        stdoutEOF:browser.stdout.readableEnded,stderrEOF:browser.stderr.readableEnded});resolve();
    }));
    record('chrome-pid.json',{pid:browser.pid});
    let url;const connectionDue=Date.now()+3000;
    while(!(url=controller.devtoolsEndpoint(out+'/profile/DevToolsActivePort'))){
      assert(Date.now()<connectionDue,'browser launch bounded');assert.equal(browser.exitCode,null);await pause(20);
    }
    c=controller.connection(url,value=>record('UNKNOWN.json',{...value,lastWireSequence:wireSequence}));
    c.protocol=value=>{
      if(value.event==='sent')wireSequence++;
      append('protocol.log',{...value,wireSequence});
    };
    await c.ready;
    const send=c.send;
    c.send=(method,params={},sid)=>{
      if(method.startsWith('Input.'))wireInputs++;
      if(method==='Page.captureScreenshot')captures++;
      append('requests.log',{method,session:sid??null,at:Date.now(),
        startupCommit:method==='Runtime.callFunctionOn'&&params.functionDeclaration?.includes('this.commit')===true,
        startupSample:method==='Runtime.callFunctionOn'&&params.functionDeclaration?.includes('this.sample')===true});
      return send(method,params,sid);
    };
    c.event=value=>{
      if(value.method==='Runtime.consoleAPICalled')append('console.log',{session:value.sessionId,
        type:value.params.type,text:value.params.args.map(a=>a.value??a.description??'').join(' ')});
      if(value.method==='Runtime.exceptionThrown')append('exceptions.log',value);
      if(value.method==='Target.attachedToTarget'&&value.params.targetInfo.type==='worker'){
        const {sessionId,targetInfo}=value.params;workers.set(sessionId,{sessionId,...targetInfo,closed:false});
        const task=(async()=>{await c.send('Runtime.enable',{},sessionId);await c.send('Runtime.runIfWaitingForDebugger',{},sessionId);})();
        tasks.push(task);task.catch(()=>{});
      }
      if(value.method==='Target.detachedFromTarget'){const w=workers.get(value.params.sessionId);if(w)w.closed=true;}
    };
    const pages=(await c.send('Target.getTargets')).targetInfos.filter(t=>t.type==='page');assert.equal(pages.length,1);
    session=(await c.send('Target.attachToTarget',{targetId:pages[0].targetId,flatten:true})).sessionId;
    await c.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true},session);
    await c.send('Page.enable',{},session);await c.send('Runtime.enable',{},session);
    await c.send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/index.html?debug&'+
      (mode==='worker'?'threads':'no-threads')+'&d3d-renderer=software'},session);
    const shellDue=Date.now()+20000;
    while(!await evaluate(`typeof shell!=='undefined'&&typeof apps!=='undefined'`)){
      assert(Date.now()<shellDue,'bounded shell startup');await pause(50);
    }
    await evaluate(`(()=>{apps.${app}={label:'Authored USER startup',exe:${JSON.stringify('/'+path.relative(root,fixture))},dlls:[]};
      shell.launchApp('${app}').catch(error=>console.error(error));return true;})()`);
    const startupDue=Date.now()+20000;let first=null;
    for(;;){
      first=await evaluate(`typeof runningApps==='undefined'?[]:
        (runningApps.length?runningApps:(shell.currentWine?[{name:null,wine:shell.currentWine}]:[])).map(a=>({name:a.name,running:a.wine.running,
        stopped:!!a.wine._stopped,exited:a.wine._processObject?.exited===true,
        fatal:!!document.getElementById('wine-crash-report'),worker:!!a.wine.guestWorker,
        processId:a.wine.processId,exitCode:a.wine._processObject?.exitCode,
        endpoint:a.wine.guestWorker?.link?.endpointIdentity,slice:!!a.wine._workerLastSlice,
        lastNativeSlice:a.wine._workerLastSlice?{eip:a.wine._workerLastSlice.eip,
          yieldReason:a.wine._workerLastSlice.yield,quit:a.wine._workerLastSlice.quit,
          blocks:a.wine._workerLastSlice.blocks}:null}))`);
      if(first.length===1&&first[0].running&&(mode==='main'||first[0].slice))break;
      if(first.some(a=>a.stopped||a.exited||a.fatal))break;
      assert(Date.now()<startupDue,'bounded native launch');await pause(10);
    }
    await Promise.all(tasks);record('first-host-startup.json',{at:Date.now(),state:first});
    for(const required of ['/src/api_table.json','/lib/vendor/tweetnacl.js','/lib/vendor/webaudio-tinysynth.js'])
      assert(http.some(row=>new URL(row.url,'http://127.0.0.1').pathname===required&&row.status===200),
        'actual startup dependency must be served '+required);
    let otherWindows=[];
    if(variant==='other-thread-window'){
      const due=Date.now()+2500;
      while(!(otherWindows=await evaluate(`Object.entries(runningApps[0].wine.renderer.windows)
        .filter(([h,w])=>w.visible&&w.processId===runningApps[0].wine.processId).map(([h])=>Number(h))`)).length){
        assert(Date.now()<due,'actual other-thread window must appear');await pause(20);
      }
    }
    if(first[0]?.running&&!first[0]?.stopped&&!first[0]?.exited){
      let owningSession=session;
      if(mode==='worker'){
        const matches=[];
        for(const w of workers.values())if(!w.closed&&w.url.includes('guest-worker')){
          const owner=await evaluate(`typeof endpointIdentity==='undefined'?null:({endpointIdentity,slot:workerSlot})`,w.sessionId);
          if(owner?.endpointIdentity===first[0].endpoint&&owner.slot===0)matches.push(w);
        }
        assert.equal(matches.length,1,'one actual owning Worker for startup diagnostic');owningSession=matches[0].sessionId;
      }
      const expression=`(()=>{const assert={equal:(a,b,m)=>{if(a!==b)throw Error(m);}};
        const read=${inspectUser.toString()};
        const current=${mode==='worker'?'instance':'runningApps[0].wine.instance'};
        return read(current.exports);})()`;
      const initial=await evaluate(expression,owningSession);
      record('initial-native-user.json',{at:Date.now(),publicNative:initial,mode,endpoint:first[0].endpoint??'main'});
      if(otherWindows.length){
        const windows=await evaluate(`(()=>{const ex=${mode==='worker'?'instance':'runningApps[0].wine.instance'}.exports;
          return ${JSON.stringify(otherWindows)}.map(hwnd=>({hwnd,live:!!ex.wnd_lookup_live(hwnd),
            generation:String(ex.wnd_lookup_generation(hwnd)),threadId:ex.get_window_thread(hwnd)>>>0,
            currentThreadId:ex.get_current_thread_id()>>>0}));})()`,owningSession);
        record('other-thread-windows.json',{windows});
        assert(windows.some(w=>w.live&&w.threadId!==w.currentThreadId),'real other-thread USER window required');
      }
    }
    // No screenshot or physical input is part of readiness observation.
    const options={c,pageSession:session,workers,app,backend:'software'};
    if(phase==='before') {
      try {await native.install(options);record('before-install.json',{state:'INSTALLED'});}
      catch(error){record('before-install.json',{state:'REFUSED',error:String(error)});throw error;}
    } else {
      const diagnostics=[];
      // The implementation must independently bound its pre-install observer.
      // This hook only retains its returned current public native diagnostics.
      await native.install({...options,onReadiness:value=>{
        diagnostics.push(value);append('native-readiness.log',value);
        if(variant==='retired-owner'&&!controlTask){
          assert(!value.healthy,'actual owner retirement occurs before USER publication');
          controlTask=evaluate(`(()=>{const wine=runningApps[0].wine;wine.stop();return {
            processId:wine.processId,stopped:!!wine._stopped,running:wine.running,
            processExited:wine._processObject.exited,forcedHostStop:true,nativeQuitClaim:false};})()`)
            .then(value=>record('actual-owner-retirement.json',value));
          controlTask.catch(()=>{});
        }
      }});
      assert(diagnostics.length,'after implementation must publish current readiness diagnostics');
      assert(diagnostics.at(-1).healthy===true,'only a positive native USER observation can install');
      record('after-install.json',{state:'INSTALLED',diagnostics});
    }
    assert.equal(wireInputs,0);assert.equal(captures,0);
    record('startup-result.json',{state:'INSTALLED',phase,mode,variant,wireInputs,captures,nativeQuitClaim:false});
  } catch(error) {
    c?.seal('first startup failure: '+error);
    record('startup-result.json',{state:'REFUSED',phase,mode,variant,error:String(error),
      nativeStartupState:error.nativeStartupState??null,wireInputs,captures,
      nativeQuitClaim:false,laterRequestsAllowed:0});
    throw error;
  } finally {
    if(controlTask)await controlTask.catch(error=>record('owner-retirement-error.json',{error:String(error)}));
    if(c&&!c.closed)c.stop();
    if(browser){
      const processes=[];
      for(const name of fs.readdirSync('/proc').filter(n=>/^\d+$/.test(n)))try{
        const line=fs.readFileSync('/proc/'+name+'/stat','utf8'),f=line.slice(line.lastIndexOf(')')+2).split(' ');
        processes.push({pid:Number(name),ppid:Number(f[1]),pgid:Number(f[2]),startToken:f[19]});
      }catch{}
      const owned=new Set([browser.pid]);let changed=true;
      while(changed){changed=false;for(const p of processes)if(owned.has(p.ppid)&&!owned.has(p.pid)){owned.add(p.pid);changed=true;}}
      record('chrome-processes.json',{processes:processes.filter(p=>owned.has(p.pid))});
      browser.kill('SIGTERM');let timer;
      try{await Promise.race([joined,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Chrome close timeout')),3000);})]);}
      catch{browser.kill('SIGKILL');await joined;}finally{clearTimeout(timer);}
    }
    if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
    fs.rmSync(out+'/profile',{recursive:true,force:true});
  }
}

function bindingControls(){
  const binding=require('../tools/gta2-browser-release-binding.cjs');
  const vm=require('node:vm'),crypto=require('node:crypto');
  const a=authoredPublicExports(),stable=binding.nativeContext(a.ex);
  let comparisons=1;
  assert.deepEqual(binding.nativeContext(a.ex,true),inspectUser(a.ex));
  a.state.eip+=16;a.state.yieldReason=7;
  assert.deepEqual(binding.nativeContext(a.ex),stable,'moving execution is not scene identity');
  for(const [key,values] of Object.entries({process:[0,1001],thread:[0,2],eip:[0,0x401000],
    quit:[0,1],yieldReason:[0,1,2,3,7],main:[0,10,20],focus:[0,11,20],capture:[0,10],modal:[0,20]}))
    for(const value of values){const current=authoredPublicExports();current.state[key]=value;
      assert.deepEqual(binding.nativeContext(current.ex,true),inspectUser(current.ex),key+' '+value);comparisons++;}
  for(const key of ['generation','live','thread','style','owner','top','kind'])for(const hwnd of [10,11,20]){
    const current=authoredPublicExports();current.state.modal=20;current.state.focus=20;
    current.windows.get(hwnd)[key]=0;
    assert.deepEqual(binding.nativeContext(current.ex,true),inspectUser(current.ex),'window '+hwnd+' '+key);
    comparisons++;
  }
  const handler=()=>{},self={onmessage:handler},workerContext={self,instance:{exports:{}},
    endpointIdentity:1,workerSlot:0,scopedRetiring:false,threadSendFrames:[],
    threadSendWaits:{fenced:()=>false,rootSend:null},writerActive:()=>false,commandWriterHandoff:false,
    crypto,readNative:()=>({healthy:false})};
  assert.throws(()=>vm.runInNewContext('('+binding.workerBridge.toString()+')(readNative)',workerContext),/unhealthy native USER/);
  assert.equal(self.onmessage,handler,'failed Worker installation preserves original command handler');
  assert.equal(Object.hasOwn(workerContext,'__gta2NativeReleaseV1'),false,'failed Worker publication absent');
  const down=()=>{},up=()=>{},press=()=>{},renderer={canvas:{},inputQueue:[],_physicalKeys:{},
    handleKeyDown:down,handleKeyUp:up,handleKeyPress:press};
  const wine={renderer,memory:{buffer:new ArrayBuffer(8)},instance:{exports:{}},_wasmModule:{},running:true};
  const pageContext={crypto,runningApps:[{name:'authored',wine}],readNative:()=>({healthy:false})};
  assert.throws(()=>vm.runInNewContext('('+binding.pageBridge.toString()+')('+JSON.stringify({app:'authored',backend:'software',
    nativeOwner:{epoch:'authored',endpointIdentity:'main',slot:0}})+',readNative)',pageContext),/unhealthy main-thread/);
  assert.deepEqual([renderer.handleKeyDown,renderer.handleKeyUp,renderer.handleKeyPress],[down,up,press]);
  assert.equal(Object.hasOwn(pageContext,'__gta2NativeReleasePageV1'),false,'failed page publication absent');
  // A replacement can be healthy on its own while violating the retained
  // owner generation. The atomic commit must reject that terminal sample.
  const current=authoredPublicExports();
  const observeContext={...workerContext,readNative:()=>binding.nativeContext(current.ex,true)};
  const observer=vm.runInNewContext('('+binding.userStartupObserver.toString()+')(readNative,{cpu:"worker"})',observeContext);
  assert.equal(observer.sample().healthy,true);
  current.windows.get(current.state.main).generation++;
  assert.equal(observer.sample().healthy,true,'health does not alias owner generation');
  assert.throws(()=>observer.commit('globalThis.WRONG_GENERATION_PUBLISHED=true'),/generation changed/);
  assert.equal(Object.hasOwn(observeContext,'WRONG_GENERATION_PUBLISHED'),false);
  return {state:'PASS',stableNativeABI:true,independentPublicPredicateComparisons:comparisons,
    atomicPublicationRefusals:2};
}

async function focusedControls(out,shared=false){
  const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
  nativeGate(path.join(out,'preflight'));
  const commands=[
    ['node','--check','tools/gta2-paired-controller.cjs'],
    ['node','--check','tools/gta2-browser-release-binding.cjs'],
    ['node','--check','test/test-gta2-native-user-readiness.cjs'],
    ['node','--test','test/test-gta2-native-user-readiness.cjs'],
    ['node','test/test-gta2-native-user-readiness.cjs','--binding-controls'],
    ['node','--test','test/test-gta2-worker-complete-confirmation.cjs'],
    ['node','test/test-gta2-worker-complete-confirmation.cjs','--transport-controls',path.join(out,'transport')],
    ...(!shared?[['node','test/test-gta2-worker-complete-confirmation.cjs','--view-guards',path.join(out,'view-guards')]]:[]),
    ...['--source-guards','--bridge-model','--page-model','--candidate-faults']
      .map(flag=>['node','test/test-gta2-browser-release-scene-binding.cjs',flag]),
    ['node','test/test-gta2-current-scene-prearm.cjs','--preinit-controls',path.join(out,'preinit')],
    ['node','test/test-gta2-worker-complete-confirmation.cjs','--actual-watchdog',path.join(out,'watchdog')],
  ];
  const rows=[];
  for(const [i,args] of commands.entries()){
    const child=cp.spawn(args[0],args.slice(1),{stdio:['ignore','pipe','pipe']});
    const stdout=[],stderr=[];child.stdout.on('data',b=>stdout.push(b));child.stderr.on('data',b=>stderr.push(b));
    const result=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>resolve({code,signal}));});
    fs.writeFileSync(path.join(out,'focused-'+i+'.stdout.log'),Buffer.concat(stdout),{flag:'wx'});
    fs.writeFileSync(path.join(out,'focused-'+i+'.stderr.log'),Buffer.concat(stderr),{flag:'wx'});
    const row={args,pid:child.pid,...result,actualWait:true,stdoutEOF:child.stdout.readableEnded,
      stderrEOF:child.stderr.readableEnded,at:Date.now()};rows.push(row);
    fs.writeFileSync(path.join(out,'focused-'+i+'-wait.json'),JSON.stringify(row,null,2)+'\n',{flag:'wx'});
    assert.equal(result.code,0,JSON.stringify(args)+' '+Buffer.concat(stderr));
  }
  fs.writeFileSync(path.join(out,'focused-result.json'),JSON.stringify({state:'PASS',shared,
    immutableViewGuards:shared?'requires separate sealed HEAD view run':'PASS',cases:rows},null,2)+'\n',{flag:'wx'});
}

async function originalSoftware(out,qualification){
  // A fresh launch is authorized only by current, published actual qualification.
  // This entry never accepts an old endpoint or a caller-supplied source pin.
  nativeGate(out);
  const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
  const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
  const root=path.resolve(__dirname,'..'),q=JSON.parse(fs.readFileSync(qualification));
  assert.equal(q.status,'PUBLISHED_MAIN_WORKER_COMPLETE_AND_50_FAULTS_PASS');
  assert.equal(q.head,process.env.GTA2_VIEW_HEAD);
  assert.equal(q.head,cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim());
  const baseline=JSON.parse(fs.readFileSync(q.workerPins));
  const files=baseline.files.filter(p=>!p.path.startsWith('test/binaries/gta2-user-readiness-20261116/'));
  const inventory='scratch/runs/20261115-gta2-current-native-thunks-visible-driving/current-inputs.json';
  const media=JSON.parse(fs.readFileSync(inventory));
  for(const p of media.matches){assert.equal(sha(fs.readFileSync(p.path)),p.sha256,'current original media '+p.path);
    if(!files.some(v=>v.path===p.path))files.push({path:p.path,sha256:p.sha256});}
  for(const p of [path.relative(root,__filename),inventory,'test/binaries/tlbs/stdole2.tlb',
    'test/binaries/sims-native-common-controls/kommctrl.dll'])if(!files.some(v=>v.path===p))
      files.push({path:p,sha256:sha(fs.readFileSync(p))});
  for(const p of files)assert.equal(sha(fs.readFileSync(p.path)),p.sha256,'fresh qualified original pin '+p.path);
  const http=files.filter(p=>['comctl32.dll','commctrl.dll','gta2.exe','mss32.dll'].some(n=>p.path.endsWith('/'+n)))
    .map(p=>({url:'/'+p.path.replace(/^test\//,''),sha256:p.sha256}));
  assert.equal(http.length,4);
  const launch=JSON.parse(fs.readFileSync(path.join(out,'..','launch.json')));
  const recipe=JSON.parse(fs.readFileSync(path.join(out,'..','recipe.json')));
  const watch=JSON.parse(fs.readFileSync(path.join(out,'..','watchdog-armed.json')));
  assert.equal(recipe.seconds,900,'original software budget remains 900 seconds');
  assert.equal(watch.deadline-launch.deadline,20,'independent watchdog remains 920 seconds');
  fs.writeFileSync(path.join(out,'pins.json'),JSON.stringify({files,http,modules:baseline.modules,gitSHA:q.head})+'\n',{flag:'wx'});
  fs.writeFileSync(path.join(out,'media-preflight.json'),JSON.stringify({files:media.matches,
    inventorySHA256:sha(fs.readFileSync(inventory)),copies:0,at:Date.now()})+'\n',{flag:'wx'});
  fs.writeFileSync(path.join(path.dirname(qualification),'original-attempt.json'),JSON.stringify({out,
    head:q.head,at:Date.now(),attempt:1,oldEndpointsContacted:0})+'\n',{flag:'wx'});
  const child=cp.spawn(process.execPath,['tools/gta2-paired-controller.cjs','browser',out,'software'],
    {cwd:root,stdio:['ignore','pipe','pipe']});
  const stdout=[],stderr=[];child.stdout.on('data',b=>stdout.push(b));child.stderr.on('data',b=>stderr.push(b));
  const result=await new Promise((resolve,reject)=>{child.once('error',reject);
    child.once('close',(code,signal)=>resolve({code,signal}));});
  fs.writeFileSync(path.join(out,'original-controller.stdout.log'),Buffer.concat(stdout),{flag:'wx'});
  fs.writeFileSync(path.join(out,'original-controller.stderr.log'),Buffer.concat(stderr),{flag:'wx'});
  fs.writeFileSync(path.join(out,'original-controller-wait.json'),JSON.stringify({pid:child.pid,...result,
    actualWait:true,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded,at:Date.now()})+'\n',{flag:'wx'});
  assert.equal(result.code,0,'single original controller outcome');
}

if(require.main===module){
  if(process.argv[2]==='--native-startup')nativeStartupFixture(process.argv[3],process.argv[4],process.argv[5],process.argv[6])
    .catch(error=>{console.error(error);process.exitCode=1;});
  else if(['--focused','--focused-shared'].includes(process.argv[2]))focusedControls(process.argv[3],process.argv[2]==='--focused-shared').catch(error=>{console.error(error);process.exitCode=1;});
  else if(process.argv[2]==='--binding-controls')console.log(JSON.stringify(bindingControls()));
  else if(process.argv[2]==='--original-software')originalSoftware(process.argv[3],process.argv[4])
    .catch(error=>{console.error(error);process.exitCode=1;});
  else registerAuthoredControls();
}
module.exports={inspectUser,unpublishedReadiness,authoredPublicExports,startupPE,nativeGate,nativeStartupFixture,runtimeSourcePath,
  bindingControls,focusedControls};
