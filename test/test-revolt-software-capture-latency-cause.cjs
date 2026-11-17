'use strict';
// Retained evidence checks and authored fixture inputs. Never launches an original.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..');
const PRIOR=path.join(ROOT,'scratch/runs/20261115-revolt-current-manual-checkpoint-progress');
const SHA=b=>crypto.createHash('sha256').update(b).digest('hex');
const json=p=>JSON.parse(fs.readFileSync(p,'utf8'));
function retained(){
  const original=path.join(PRIOR,'original-software');
  const releasePath=path.join(PRIOR,'runtime-release.json');
  assert.equal(SHA(fs.readFileSync(releasePath)),'5186ddc433a6daa37b5ab1738ee18714655e1303de4e8bd573f57848e86f06be');
  const release=json(releasePath);
  for(const ref of [release.result,release.directClosure,release.resources,...release.evidence])
    assert.equal(SHA(fs.readFileSync(path.join(PRIOR,ref.path))),ref.sha256,ref.path);
  const pins=json(path.join(original,'pins.json'));
  assert.equal(pins.commit,'abf5d6bb61786977b524df778787783a431e4a8b');
  const dependencies=['tools/revolt-manual-controller.cjs','scratch/runs/20261108-redline-car-door-native/bound-input.cjs','lib/guest-worker.js','lib/d3d-render-worker.js','lib/d3dim-render-worker.js','lib/cli-guarded-input.js','lib/cli-native-scene.js'];
  const sources=dependencies.map(p=>{
    const pin=pins.files.find(f=>f.path===p);assert(pin,'retained pin '+p);
    const bytes=fs.readFileSync(path.join(ROOT,p));
    assert.equal(SHA(bytes),pin.sha256,'source no longer matches original; recover exact Git SHA plus retained patch: '+p);
    return {path:p,sha256:pin.sha256,bytes:bytes.length};
  });
  const controller=fs.readFileSync(path.join(ROOT,dependencies[0]),'utf8');
  assert(controller.includes("const HELPER='scratch/runs/20261108-redline-car-door-native/bound-input.cjs'"));
  const helper=fs.readFileSync(path.join(ROOT,dependencies[1]),'utf8');
  assert(helper.includes("require('node:assert/strict')")&&helper.includes("require('node:crypto')"));
  assert(helper.includes('const before = await readLive()')&&helper.includes('const after = await readLive()'));
  const trace=fs.readFileSync(path.join(original,'cdp-requests.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
  const unknown=json(path.join(original,'UNKNOWN.json'));
  assert.equal(unknown.reason,'manual operation capture exceeded 3000ms');
  assert.equal(unknown.permanentClose,true);assert.equal(unknown.laterRequestsAllowed,0);
  assert.equal(trace.length,190);assert.equal(unknown.requestsIssued,190);
  for(let i=0;i<trace.length;i++){assert.equal(trace[i].number,i+1);assert(trace[i].at<=unknown.at);}
  assert(!trace.some(r=>r.method.startsWith('Input.')));
  const last=trace.at(-1);assert.equal(last.method,'Runtime.evaluate');
  // An operation's aggregate deadline can expire before the final request's
  // own three-second deadline. Do not attribute the aggregate to that request.
  assert.equal(unknown.at-last.at,2860);
  assert(!Object.hasOwn(last,'expression')&&!Object.hasOwn(last,'replyAt')&&!Object.hasOwn(last,'bodyBegin'));
  const workers=json(path.join(original,'executed-sources.json')).workers;
  const lastKnownWorkers=json(path.join(original,'menu-first-state.json')).workers;
  assert(!workers.some(w=>w.sessionId===last.sessionId));
  assert(!lastKnownWorkers.some(w=>w.sessionId===last.sessionId));
  const splash=json(path.join(original,'menu-first.json'));
  assert.equal(splash.capture.identity.renderEndpoint,1);
  assert.equal(splash.capture.identity.moduleSha256,release.sharedModuleSHA256);
  assert.equal(splash.capture.identity.rendererModuleSha256,release.sharedModuleSHA256);
  return {passed:true,kind:'retained-static-only',sourceCommit:pins.commit,sources,
    aggregateTimeout:{at:unknown.at,requests:trace.length,lastRequest:last,lastRequestAgeAtUnknownMs:2860},
    exactExpression:'UNKNOWN',lastTargetIdentity:'UNKNOWN: absent from retained pre-failure inventories',
    queueDuration:'UNKNOWN',bodyDuration:'UNKNOWN',replyDeliveryDuration:'UNKNOWN',
    originalInputRequests:0,laterRequests:0,originalRetried:false,
    actualGameCause:'UNPROVED',nativeFixture:'NOT_RUN',genericFix:'NONE'};
}
// Each stage uses a unique correlation nonce. Monotonic browser begin/end
// durations exclude queue time; Date.now boundaries permit clock-aligned
// request/body/reply correlation. This wrapper is fixture-only diagnostics.
function diagnosticExpression(expression,nonce){
  assert(/^[a-z0-9-]+$/.test(nonce));
  return `(async()=>{const n=${JSON.stringify(nonce)},begin=Date.now(),m=performance.now();console.debug('revolt-latency-stage',n,'begin',begin);try{const value=await (0,eval)(${JSON.stringify(expression)});const end=Date.now(),bodyMs=performance.now()-m;console.debug('revolt-latency-stage',n,'end',end,bodyMs);return {nonce:n,value,begin,end,bodyMs};}catch(e){console.debug('revolt-latency-stage',n,'error',Date.now(),String(e));throw e;}})()`;
}
async function diagnosticControls(){
  const vm=require('node:vm'),events=[];
  const context=vm.createContext({Date,performance,console:{debug:(...args)=>events.push(args)}});
  const synchronous=await vm.runInContext(diagnosticExpression('({answer:42})','sync-control'),context);
  assert.equal(synchronous.value.answer,42);assert.equal(synchronous.nonce,'sync-control');
  assert(synchronous.end>=synchronous.begin&&synchronous.bodyMs>=0);
  const statements=await vm.runInContext(diagnosticExpression('globalThis.statementMarker=41; statementMarker+1','statement-control'),context);
  assert.equal(statements.value,42);assert.equal(context.statementMarker,41);
  const promise=await vm.runInContext(diagnosticExpression('Promise.resolve("settled")','promise-control'),context);
  assert.equal(promise.value,'settled');
  await assert.rejects(vm.runInContext(diagnosticExpression('Promise.reject(Error("native failure retained"))','error-control'),context),/native failure retained/);
  assert.deepEqual(events.map(e=>[e[1],e[2]]),[['sync-control','begin'],['sync-control','end'],['statement-control','begin'],['statement-control','end'],['promise-control','begin'],['promise-control','end'],['error-control','begin'],['error-control','error']]);
  assert.throws(()=>diagnosticExpression('true','invalid nonce'));
  const source=fixtureSource(1);assert(source.includes('CreateThread')&&source.includes('DirectDrawCreateEx')&&source.includes('0xff3344cc'));
  assert.throws(()=>fixtureSource(0));assert.throws(()=>fixtureSource(257));
  return {passed:true,kind:'authored-instrumentation-only',events,nativeRuntime:false,gameCauseClaim:false};
}
function writeReport(out,value){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'retained-analysis.json'),JSON.stringify(value,null,2)+'\n',{flag:'wx'});}
// This source is new authored input, not original game code. Work consists of
// actual native D3D triangle draws and ordinary thread Sleep calls, never a
// synthetic JS/guest busy loop. Compilation/execution waits for runtime release.
function fixtureSource(draws){
  assert(Number.isInteger(draws)&&draws>=1&&draws<=256);
  return String.raw`
typedef unsigned U; typedef void* P;
#define S __attribute__((stdcall))
#define I __declspec(dllimport)
I void S ExitProcess(U); I void S Sleep(U); I void S OutputDebugStringA(char*); I U S GetTickCount(void);
I P S CreateThread(P,U,P,P,U,P);
I P S CreateWindowExA(U,char*,char*,U,int,int,int,int,P,P,P,P);
I P S SetFocus(P); I int S SetForegroundWindow(P); I int S SetWindowTextA(P,char*); I short S GetAsyncKeyState(int);
I U S GetPixel(P,int,int);
I int S DirectDrawCreateEx(P,P,P,P);
#define C0(o,s) ((int(S*)(P))(*(P**)o)[s])(o)
#define C1(o,s,a) ((int(S*)(P,U))(*(P**)o)[s])(o,(U)a)
#define C2(o,s,a,b) ((int(S*)(P,U,U))(*(P**)o)[s])(o,(U)a,(U)b)
#define C3(o,s,a,b,c) ((int(S*)(P,U,U,U))(*(P**)o)[s])(o,(U)a,(U)b,(U)c)
#define C4(o,s,a,b,c,d) ((int(S*)(P,U,U,U,U))(*(P**)o)[s])(o,(U)a,(U)b,(U)c,(U)d)
#define C5(o,s,a,b,c,d,e) ((int(S*)(P,U,U,U,U,U))(*(P**)o)[s])(o,(U)a,(U)b,(U)c,(U)d,(U)e)
static void check(int h,U n){if(h){OutputDebugStringA("LATENCY fixture HRESULT failure");ExitProcess(n);}}
static U bits(float f){union{float f;U u;}x;x.f=f;return x.u;}
static U iidDD[4]={0x15e65ec0,0x11d23b9c,0x60002fb9,0x5bea9797};
static U iidD3D[4]={0xbb223240,0x11d0e72b,0xaa00b4a9,0x3e99c000};
static U hal[4]={0x84e63de0,0x11cf46aa,0xaa001681,0xb78a4700};
static U S auxiliary(P ignored){OutputDebugStringA("LATENCY auxiliary native thread READY");for(;;)Sleep(10);return 0;}
void start(void){
 P hwnd=CreateWindowExA(0,"STATIC","AUTHORED software capture latency fixture",0x10000000,0,0,640,480,0,0,0,0);
 if(!hwnd)ExitProcess(10);SetForegroundWindow(hwnd);SetFocus(hwnd);
 P dd=0,d3d=0,primary=0,target=0,device=0,vp=0;U tid=0;
 check(DirectDrawCreateEx(0,&dd,iidDD,0),11);check(C2(dd,20,hwnd,8),12);
 check(C2(dd,0,iidD3D,&d3d),13);
 U desc[31]={124,1};desc[26]=0x200;check(C3(dd,6,desc,&primary,0),14);
 for(U i=0;i<31;i++)desc[i]=0;
 desc[0]=124;desc[1]=0x1007;desc[2]=240;desc[3]=320;desc[18]=32;desc[19]=0x40;desc[21]=32;
 desc[22]=0xff0000;desc[23]=0xff00;desc[24]=0xff;desc[26]=0x2840;
 check(C3(dd,6,desc,&target,0),15);check(C4(d3d,8,hal,target,&device,0),16);
 check(C2(d3d,6,&vp,0),17);check(C1(device,5,vp),18);
 U viewport[11]={44,0,0,320,240};viewport[5]=bits(160);viewport[6]=bits(120);viewport[7]=bits(160);viewport[8]=bits(120);viewport[10]=bits(1);
 check(C1(vp,5,viewport),19);check(C1(device,12,vp),20);
 U rs[6]={7,14,22,26,27,137},rv[6]={0,0,1,0,0,0};
 for(U i=0;i<6;i++)check(C2(device,22,rs[i],rv[i]),21);
 check(C3(device,40,0,1,2),22);check(C3(device,40,0,2,0),23);check(C3(device,40,1,1,1),24);
 U v[24];for(U i=0;i<24;i++)v[i]=0;
 for(U i=0;i<3;i++){v[i*8]=bits(i==1?640:-320);v[i*8+1]=bits(i==2?480:-240);v[i*8+2]=bits(.5f);v[i*8+3]=bits(1);v[i*8+4]=0xff3344cc;}
 U started=GetTickCount(),checked=0;
 OutputDebugStringA("LATENCY fixture READY expected RGB 51 68 204");
 for(;;){
  if(!tid&&GetTickCount()-started>=3000){if(!CreateThread(0,0,auxiliary,0,0,&tid))ExitProcess(29);}
  check(C0(device,9),25);
  for(U i=0;i<${draws};i++)check(C5(device,28,4,0x1c4,v,3,0),26);
  check(C0(device,10),27);check(C5(primary,5,0,target,0,0x1000000,0),28);
  if(!checked){P dc=0;check(C1(target,17,&dc),30);U color=GetPixel(dc,20,20);check(C1(target,26,dc),31);if(color!=0xcc4433){OutputDebugStringA("LATENCY native GetPixel mismatch");ExitProcess(32);}OutputDebugStringA("LATENCY native GetPixel PASS 0xcc4433");SetForegroundWindow(hwnd);SetFocus(hwnd);SetWindowTextA(hwnd,"AUTHORED software capture latency fixture GetPixel PASS 0xcc4433");checked=1;}
  if(GetAsyncKeyState(27)&0x8000){OutputDebugStringA("LATENCY fixture native Quit");ExitProcess(0);}Sleep(10);
 }
}
`;
}
function prepare(out,draws=1){
  const cp=require('node:child_process');out=path.resolve(out);fs.mkdirSync(out,{recursive:true});
  const put=(n,b)=>fs.writeFileSync(path.join(out,n),b,{flag:'wx'});
  const imports={kernel32:['ExitProcess@4','Sleep@4','OutputDebugStringA@4','CreateThread@24','GetTickCount@0'],user32:['CreateWindowExA@48','GetAsyncKeyState@4','SetFocus@4','SetForegroundWindow@4','SetWindowTextA@8'],gdi32:['GetPixel@12'],ddraw:['DirectDrawCreateEx@16']};
  for(const [dll,names] of Object.entries(imports)){
    put(dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');
    cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',path.join(out,dll+'.def'),'-l',path.join(out,dll+'.lib')]);
  }
  put('fixture.c',fixtureSource(draws));
  cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',path.join(out,'fixture.c'),'-o',path.join(out,'fixture.obj')]);
  cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','console','--disable-dynamicbase','--no-insert-timestamp','-o',path.join(out,'fixture.exe'),path.join(out,'fixture.obj'),...Object.keys(imports).map(d=>path.join(out,d+'.lib'))]);
  const proof={path:path.relative(ROOT,path.join(out,'fixture.exe')),sha256:SHA(fs.readFileSync(path.join(out,'fixture.exe'))),drawsPerFrame:draws,expectedRGB:[51,68,204],authored:true,original:false};
  put('fixture.json',JSON.stringify(proof,null,2)+'\n');return proof;
}
async function native(out,fixtureFile,mode='ordinary'){
  assert(['ordinary','unwrapped','stale-negative','queue-delay','body-delay','delivery-delay','source-negative','backend-negative'].includes(mode));
  out=path.resolve(out);const fixture=json(fixtureFile);assert(fixture.authored&&fixture.original===false);
  assert(fixture.path.startsWith('scratch/runs/20261115-revolt-software-capture-latency-cause/')&&!fixture.path.split('/').includes('..'),'only this run\'s newly authored native fixture');
  assert.deepEqual(fixture.expectedRGB,[51,68,204]);assert(Number.isInteger(fixture.drawsPerFrame)&&fixture.drawsPerFrame>=1&&fixture.drawsPerFrame<=256);
  assert.equal(SHA(fs.readFileSync(path.join(ROOT,fixture.path))),fixture.sha256);
  const cp=require('node:child_process'),{PNG}=require('pngjs');
  const controller=require('../tools/revolt-manual-controller.cjs');
  const helper=require(path.join(ROOT,controller.HELPER));
  const moduleSHA=SHA(fs.readFileSync(path.join(ROOT,'build/wine-assembly.wasm')));
  const pause=ms=>new Promise(r=>setTimeout(r,ms));
  fs.mkdirSync(out,{recursive:true});
  const save=(n,v)=>{const file=path.join(out,n);assert(!fs.existsSync(file),n);fs.writeFileSync(file+'.pending',JSON.stringify(v,null,2)+'\n',{flag:'wx'});fs.renameSync(file+'.pending',file);};
  const log=(n,v)=>fs.appendFileSync(path.join(out,n),JSON.stringify(v)+'\n');
  let browser,chromeWait,server,c,session,requests=0,stages=0,unknown=null,operation=null,deliveryGate=null,nativeReadback=false,nativeDiagnosticFailure=null,queueBlockEntered=false,lastCapture=null;
  const workers=new Map(),tasks=[];
  const paths=new Set(['index.html','host.js','tools/revolt-manual-controller.cjs','tools/forsaken-supervisor.cjs','tools/native-supervisor-common.cjs','test/static-server.js','test/test-revolt-manual-checkpoint.cjs','test/test-revolt-software-capture-latency-cause.cjs','test/binaries/tlbs/stdole32.tlb','test/binaries/tlbs/stdole2.tlb',controller.HELPER,'build/wine-assembly.wasm',fixture.path]);
  // Preserve the original capture's complete read-only pin workload, including
  // existing game media hashes. The fixture never launches or copies that game.
  const originalCapturePins=json(path.join(PRIOR,'original-software/pins.json'));
  for(const pin of originalCapturePins.files)paths.add(pin.path);
  function collect(directory){for(const entry of fs.readdirSync(path.join(ROOT,directory),{withFileTypes:true})){const p=directory+'/'+entry.name;if(entry.isDirectory())collect(p);else if(/\.(js|cjs|wat|watx|json)$/.test(p))paths.add(p);}}
  collect('lib');collect('src');
  const unservedRetainedPins=new Set();
  const originalPinsByPath=new Map(originalCapturePins.files.map(p=>[p.path,p.sha256]));
  // HEAD omits an unrelated untracked file present in the original's broad
  // hash workload. Retain those read-only bytes as workload, never as served
  // or executed HEAD source. Normal and tracked HEAD source reads stay intact.
  function readPin(p){
    if(!fs.existsSync(path.join(ROOT,p))&&process.env.Q3_HEAD_BUILD_SHA&&originalPinsByPath.has(p)){
      assert.equal(cp.execFileSync('git',['ls-tree','--name-only',process.env.Q3_HEAD_BUILD_SHA,'--',p],{cwd:ROOT,encoding:'utf8'}).trim(),'','only absent HEAD workload may use raw disk bytes');
      const fd=fs.openSync(path.join(ROOT,p),'r');let b;try{b=Buffer.alloc(fs.fstatSync(fd).size);assert.equal(fs.readSync(fd,b,0,b.length,0),b.length);}finally{fs.closeSync(fd);}
      assert.equal(SHA(b),originalPinsByPath.get(p),'retained unused workload pin changed');unservedRetainedPins.add(p);return b;
    }
    return fs.readFileSync(path.join(ROOT,p));
  }
  const pins=[...paths].sort().map(p=>({path:p,sha256:SHA(readPin(p))}));
  const pinMap=new Map(pins.map(p=>['/'+p.path,p.sha256]));
  const originalByPath=new Map(originalCapturePins.files.map(p=>[p.path,p.sha256]));
  for(const pin of pins)if(pin.path.startsWith('test/binaries/candidates/re-volt-demo/'))assert.equal(pin.sha256,originalByPath.get(pin.path),'original read-only media pin');
  save('tested-pins.json',{gitSHA:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),pins,fixture,mode,moduleSHA,originalSourceCommit:originalCapturePins.commit,unservedRetainedWorkload:[...unservedRetainedPins],changedFromOriginal:pins.filter(p=>originalByPath.has(p.path)&&originalByPath.get(p.path)!==p.sha256)});
  async function evaluate(expression,target=session){
    const nonce='observation-'+String(++stages).padStart(5,'0');
    const v=await c.send('Runtime.evaluate',{expression:mode==='unwrapped'?expression:diagnosticExpression(expression,nonce),returnByValue:true,awaitPromise:true},target);
    if(v.exceptionDetails)throw Error(JSON.stringify(v.exceptionDetails));
    if(mode==='unwrapped')return v.result.value;
    assert.equal(v.result.value.nonce,nonce);log('observations.jsonl',{nonce,operation,target,received:Date.now(),...v.result.value,value:undefined});
    return v.result.value.value;
  }
  async function bounded(name,fn){
    operation=name;const begin=Date.now();log('operations.jsonl',{name,stage:'begin',at:begin});
    const timer=setTimeout(()=>c.seal('fixture operation '+name+' exceeded 3000ms'),3000);
    try{const value=await fn();assert(Date.now()-begin<3000);log('operations.jsonl',{name,stage:'end',at:Date.now(),elapsed:Date.now()-begin});return value;}
    finally{clearTimeout(timer);operation=null;}
  }
  async function runtimeState(){
    // Same observations as the controller's capture wrapper, including its
    // post-capture owning-backend observation, inside the aggregate bound.
    const page=await evaluate(`({at:Date.now(),apps:runningApps.map(a=>({name:a.name,running:a.wine?.running,stopped:a.wine?._stopped,processId:a.wine?.processId,slice:a.wine?._workerLastSlice,d3dStats:a.wine?.guestWorker?.d3dStats,exitCode:a.wine?._exitCode})),retiredOwner:globalThis.__revoltPassiveOwner?{processId:__revoltPassiveOwner.processId,running:__revoltPassiveOwner.running,stopped:__revoltPassiveOwner._stopped,nativeExitCode:__revoltPassiveOwner._exitCode??null,processExited:__revoltPassiveOwner._processObject?.exited,processExitCode:__revoltPassiveOwner._processObject?.exitCode}:null,log:document.getElementById('log')?.textContent?.slice(-12000)})`);
    const owners=[];
    for(const w of workers.values())if(!w.closed&&w.url.includes('d3d-render-worker'))owners.push({targetId:w.targetId,sessionId:w.sessionId,value:await evaluate(`Array.from(endpoints,([id,e])=>({id,options:e.options,failed:e.failed?String(e.failed):null,evidence:e.evidence,adapterPresent:!!e.adapter,targets:e.adapter?.inspectTargets?.()??null,software:e.adapter?.d3dimSoftwareDrawCallsCompleted??null,control:e.control?Array.from(e.control):null}))`,w.sessionId)});
    return {...page,owners,workers:[...workers.values()]};
  }
  try{
    server=await require('./static-server.js').startStaticServer({root:ROOT,crossOriginIsolated:true,rewritePath:p=>p.startsWith('/binaries/')?'/test'+p:p});
    server.prependListener('request',(req,res)=>{const h=crypto.createHash('sha256');let size=0;const add=b=>{if(b){b=Buffer.isBuffer(b)?b:Buffer.from(b);size+=b.length;h.update(b);}},wr=res.write,en=res.end;res.write=function(b){add(b);return wr.apply(this,arguments);};res.end=function(b){add(b);return en.apply(this,arguments);};res.once('finish',()=>{const hash=h.digest('hex'),url=new URL(req.url,'http://localhost').pathname,file=url.startsWith('/binaries/')?'/test'+url:url;log('http.jsonl',{url:req.url,status:res.statusCode,size,sha256:hash});if(res.statusCode===200&&unservedRetainedPins.has(file.slice(1)))c?.seal('absent HEAD workload unexpectedly served '+file);if(res.statusCode===200&&pinMap.has(file)&&pinMap.get(file)!==hash)c?.seal('HTTP pin mismatch '+file);});});
    const port=server.address().port,profile=path.join(out,'profile');
    browser=cp.spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--no-first-run','--no-default-browser-check','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--window-size=1024,900','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','pipe','pipe']});
    browser.stdout.pipe(fs.createWriteStream(path.join(out,'chrome.stdout'),{flags:'wx'}));browser.stderr.pipe(fs.createWriteStream(path.join(out,'chrome.stderr'),{flags:'wx'}));
    chromeWait=new Promise(resolve=>browser.once('close',(code,signal)=>{save('chrome-wait.json',{pid:browser.pid,code,signal,actualWait:true,stdoutEOF:browser.stdout.readableEnded,stderrEOF:browser.stderr.readableEnded});resolve();}));
    const stat=fs.readFileSync('/proc/'+browser.pid+'/stat','utf8');save('chrome-pid.json',{pid:browser.pid,startToken:stat.slice(stat.lastIndexOf(')')+2).split(' ')[19],profile,port});
    const deadline=Date.now()+3000;let url;while(!(url=controller.devtoolsEndpoint(path.join(profile,'DevToolsActivePort')))){assert(Date.now()<deadline&&browser.exitCode===null);await pause(10);}
    c=controller.connection(url,v=>{unknown={...v,requestsIssued:requests,operation};save('UNKNOWN.json',unknown);});
    const originalSend=c.send;
    c.send=async(method,params={},target)=>{
      if(c.closed)return originalSend(method,params,target);
      const number=++requests,issued=Date.now();log('requests.jsonl',{number,method,target,operation,issued,nonce:params.expression?.match(/const n="(observation-[0-9]+)"/)?.[1]??null,expressionSHA:params.expression?SHA(params.expression):null});
      if(operation==='delayed-delivery'&&method==='Runtime.evaluate')deliveryGate=number;
      const value=await originalSend(method,params,target);const reply=Date.now();
      log('replies.jsonl',{number,method,target,operation,issued,reply,elapsed:reply-issued});
      return value;
    };
    if(mode!=='unwrapped'){
    // Register the raw receipt handler before the production parser so its
    // timestamp excludes JSON decoding and promise delivery in that parser.
    const nativeMessage=c.ws.onmessage;c.ws.onmessage=null;
    // Raw events record browser body boundaries independently of await delivery.
    c.ws.addEventListener('message',event=>{const received=Date.now(),v=JSON.parse(event.data);if(v.id)log('raw-replies.jsonl',{number:v.id,received,bytes:event.data.length,error:v.error??null});if(v.method==='Runtime.consoleAPICalled'){
      const args=v.params.args.map(a=>a.value);if(args[0]==='revolt-latency-stage')log('body-events.jsonl',{received:Date.now(),sessionId:v.sessionId,args});
    }});
    c.ws.onmessage=event=>{
      const packet=JSON.parse(event.data);
      if(deliveryGate&&packet.id===deliveryGate){
        log('delivery-control.jsonl',{number:packet.id,rawReceived:Date.now(),delayMs:3200,fixtureOnly:true});
        const timer=setTimeout(()=>{log('delivery-control.jsonl',{number:packet.id,attemptedDelivery:Date.now(),transportClosed:c.closed});nativeMessage(event);},3200);
        timer.unref();
      }else nativeMessage(event);
    };
    }
    await c.ready;
    c.event=v=>{
      if(v.method==='Target.attachedToTarget'&&v.params.targetInfo.type==='worker'){
        const {sessionId,targetInfo}=v.params,w={sessionId,targetId:targetInfo.targetId,url:targetInfo.url,scripts:[],closed:false};workers.set(sessionId,w);
        const task=(async()=>{await c.send('Runtime.enable',{},sessionId);await c.send('Debugger.enable',{},sessionId);await c.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true},sessionId);await c.send('Runtime.runIfWaitingForDebugger',{},sessionId);})();tasks.push(task);task.catch(e=>log('worker-errors.jsonl',{error:String(e)}));
      }else if(v.method==='Target.detachedFromTarget'){const w=workers.get(v.params.sessionId);if(w)w.closed=true;}
      else if(v.method==='Debugger.scriptParsed'&&workers.has(v.sessionId)){
        const w=workers.get(v.sessionId),p=v.params,row={url:p.url,scriptId:p.scriptId};w.scripts.push(row);
        const task=c.send('Debugger.getScriptSource',{scriptId:p.scriptId},v.sessionId).then(s=>{const b=s.bytecode?Buffer.from(s.bytecode,'base64'):Buffer.from(s.scriptSource||'');row.bytecodeAvailable=!!s.bytecode;row.sha256=SHA(b);row.size=b.length;});tasks.push(task);task.catch(e=>row.error=String(e));
      }else if(['Runtime.consoleAPICalled','Runtime.exceptionThrown'].includes(v.method)){
        log('console.jsonl',v);
        if(v.method==='Runtime.consoleAPICalled'&&v.params.args.some(a=>a.value==='LATENCY QUEUE FAULT BLOCK ENTERED'))queueBlockEntered=true;
        if(v.method==='Runtime.consoleAPICalled'&&v.params.args.some(a=>typeof a.value==='string'&&a.value.includes('LATENCY native GetPixel PASS 0xcc4433')))nativeReadback=true;
        if(v.method==='Runtime.consoleAPICalled')for(const a of v.params.args)if(typeof a.value==='string'&&/LATENCY.*(HRESULT failure|GetPixel mismatch)/.test(a.value))nativeDiagnosticFailure=a.value;
      }
    };
    save('version.json',await c.send('Browser.getVersion'));
    const tabs=(await c.send('Target.getTargets')).targetInfos.filter(t=>t.type==='page');assert.equal(tabs.length,1);
    session=(await c.send('Target.attachToTarget',{targetId:tabs[0].targetId,flatten:true})).sessionId;
    await c.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true},session);await c.send('Page.enable',{},session);await c.send('Runtime.enable',{},session);
    await c.send('Page.navigate',{url:'http://127.0.0.1:'+port+'/index.html?debug&threads&d3d-renderer=software'},session);
    const readyDeadline=Date.now()+60000;
    while(!await evaluate("typeof apps!=='undefined'&&typeof shell!=='undefined'")){assert(Date.now()<readyDeadline);await pause(50);}
    await evaluate(`apps.revolt_latency_fixture={exe:${JSON.stringify(fixture.path)},files:[],requiredFiles:true};shell.launchApp('revolt_latency_fixture');true`);
    for(;;){const ready=await evaluate("typeof runningApps==='undefined'?null:runningApps.map(a=>({running:a.wine?.running,stopped:a.wine?._stopped,endpoint:a.wine?.guestWorker?.d3dStats?.renderEndpointId,titles:Object.values(a.wine?.renderer?.windows||{}).map(w=>w.title),exitCode:a.wine?._exitCode}))");if(ready?.some(a=>a.titles.includes('AUTHORED software capture latency fixture GetPixel PASS 0xcc4433')))nativeReadback=true;assert(!nativeDiagnosticFailure,nativeDiagnosticFailure);if(ready?.length===1&&ready[0].running&&ready[0].endpoint&&nativeReadback)break;assert(!ready?.some(a=>a.stopped),'authored native fixture stopped before native GetPixel qualification: '+JSON.stringify(ready));assert(Date.now()<readyDeadline,'native HWND/D3D/GetPixel startup deadline');await pause(100);}
    await Promise.all(tasks);
    const chain=helper.createChain({evaluate,send:c.send,workers,pageSession:session,app:'revolt_latency_fixture',expectedModules:[mode==='source-negative'?'0'.repeat(64):moduleSHA]});
    const captures=[];
    for(let i=0;i<3;i++){
      // Allow a genuinely new native guest thread to appear between scenes;
      // each capture then discovers all current targets through the exact
      // helper scan. No old scene is admitted or used for input during wait.
      if(i===1)await pause(3500);
      const name='full-scene-'+i;
      const captured=await bounded(name,async()=>{
        log('host-stages.jsonl',{operation:name,stage:'pins-begin',at:Date.now(),files:pins.length});
        for(const pin of pins)assert.equal(SHA(readPin(pin.path)),pin.sha256,pin.path);
        log('host-stages.jsonl',{operation:name,stage:'pins-end',at:Date.now()});
        const captured=await chain.capture(name);
        log('host-stages.jsonl',{operation:name,stage:'helper-capture-end',at:Date.now()});
        fs.writeFileSync(path.join(out,name+'.png'),captured.png,{flag:'wx'});
        save(name+'-capture.json',{...captured,png:undefined});
        log('host-stages.jsonl',{operation:name,stage:'capture-files-written',at:Date.now()});
        const observed=await runtimeState();save(name+'-state.json',observed);
        const identity=captured.capture.identity;
        const owners=observed.owners.flatMap(w=>w.value.filter(e=>e.id===identity.renderEndpoint&&w.targetId===identity.rendererTarget));
        assert.equal(owners.length,1);assert.equal(owners[0].options.api,'legacy');assert.equal(owners[0].options.backend,mode==='backend-negative'?'webgl':'software','independent owning backend guard');assert(!owners[0].failed);
        return captured;
      });
      const png=PNG.sync.read(captured.png);let known=0;
      for(let p=0;p<png.data.length;p+=4)if(png.data[p]===51&&png.data[p+1]===68&&png.data[p+2]===204&&png.data[p+3]===255)known++;
      assert(known>=1000,'independently known authored native RGB pixels missing');
      const guard=await bounded('native-context-'+i,async()=>{
        const identity=captured.capture.identity;
        const page=await evaluate(`(()=>{const w=runningApps[0].wine,r=w.renderer,c=document.getElementById('screen');return {physical:[1,13,17,27,32,37,38,39,40,89,78,36,35].map(k=>r.peekKeyDownState(k)),mouse:r._mouseButtonsMask||0,windows:Object.values(r.windows).map(w=>({hwnd:w.hwnd,title:w.title,x:w.x,y:w.y,w:w.w,h:w.h,visible:w.visible})),layout:{width:c.width,height:c.height,rect:c.getBoundingClientRect().toJSON()}};})()`);
        assert(page.physical.every(k=>k===0||k===false)&&page.mouse===0);
        const native=await evaluate(`(()=>{const e=instance.exports,h=e.get_main_hwnd(),f=e.get_focus_hwnd();return {mainHwnd:h,generation:String(e.wnd_lookup_generation(h)),live:!!e.wnd_lookup_live(h),process:e.get_process_id(),thread:e.get_window_thread(h),focus:f,focusGeneration:String(e.wnd_lookup_generation(f)),capture:e.get_capture_hwnd(),modal:e.modal_dialog_hwnd?.()||e.dialogbox_hwnd?.()||0};})()`,captured.after.worker.sessionId);
        save(name+'-context-observed.json',{native,page});
        assert(native.mainHwnd&&native.generation!=='0'&&native.live&&native.process&&native.thread);assert.equal(native.capture,0);assert.equal(native.modal,0);
        assert.equal(native.focus,native.mainHwnd,'native focused scene must own the authored HWND');assert.equal(native.focusGeneration,native.generation);
        assert(page.windows.some(w=>w.hwnd===native.mainHwnd&&w.visible&&w.title==='AUTHORED software capture latency fixture GetPixel PASS 0xcc4433'));
        const owner=await evaluate(`Array.from(endpoints,([id,e])=>({id,options:e.options,failed:!!e.failed,adapter:!!e.adapter,software:e.evidence?.d3dimSoftwareDrawCallsCompleted??null,fallbackSoftware:e.adapter?.d3dimSoftwareDrawCallsCompleted??null,control:e.control?Array.from(e.control):null}))`,[...workers.values()].find(w=>w.targetId===identity.rendererTarget).sessionId);
        const actual=owner.filter(e=>e.id===identity.renderEndpoint);assert.equal(actual.length,1);assert.equal(actual[0].options.backend,'software');assert.equal(actual[0].options.api,'legacy');assert.equal(actual[0].adapter,false);assert(!actual[0].failed&&actual[0].software>0);
        helper.same(identity,identity);for(const field of helper.FIELDS)assert.throws(()=>helper.same(identity,{...identity,[field]:'foreign-owner'}));
        return {page,native,owner:actual[0],nonce:crypto.randomUUID(),intent:'authored native full-scene observation only; no gesture',knownPixelCount:known};
      });
      lastCapture=captured;save(name+'.json',{...captured,png:undefined,guard});captures.push({name,at:captured.capture.at,completedAt:captured.capture.completedAt,knownPixels:known});
      if(i===0)await evaluate(`(()=>{if(Object.hasOwn(globalThis,'__revoltPassiveOwner'))throw Error('owner reference already bound');Object.defineProperty(globalThis,'__revoltPassiveOwner',{value:runningApps[0].wine});return true;})()`);
    }
    if(mode==='stale-negative'){
      // Real elapsed time against the actual helper's freshness guard; no
      // clock injection, no capture refresh and no input dispatch are used.
      const beforeRequests=requests,latest=lastCapture.capture;
      await pause(Math.max(0,Date.parse(latest.at)+helper.MAX_AGE_MS+10-Date.now()));
      let dispatches=0;
      await assert.rejects(chain.admit({...latest,review:'authored fixture stale negative; never dispatch'},async()=>{dispatches++;}),error=>error.code==='STALE_SCENE_BEFORE_DISPATCH');
      assert.equal(dispatches,0);assert.equal(requests,beforeRequests);
      save('stale-negative.json',{actualHelper:true,realElapsedMs:Date.now()-Date.parse(latest.at),maxAgeMs:helper.MAX_AGE_MS,dispatches,extraRequests:0,clockChanged:false,captureRetried:false});
    }
    if(mode==='queue-delay'){
      // Explicit fault injection after real native captures. Atomics.wait parks
      // this authored fixture's actual guest Worker; it is never a game-cause
      // observation or an alleged native draw delay. No blocking loop is used.
      const target=lastCapture.after.worker.sessionId;
      save('queue-control.json',{fixtureOnly:true,injected:true,target,mechanism:'scheduled Atomics.wait timeout 2400ms in actual authored guest Worker',gameCauseClaim:false});
      await c.send('Runtime.evaluate',{expression:`setTimeout(()=>{console.debug('LATENCY QUEUE FAULT BLOCK ENTERED');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,2400);console.debug('LATENCY QUEUE FAULT BLOCK EXIT');},50);true`,returnByValue:true},target);
      await pause(100);const issued=Date.now();
      await bounded('delayed-queue',()=>evaluate('true',target));
      assert(queueBlockEntered,'injected block entry never observed');
      assert(Date.now()-issued>=2000,'queue fault did not delay actual observation');
      save('queue-control-result.json',{elapsedMs:Date.now()-issued,blockEntryObserved:true,passed:true,gameCauseClaim:false});
    }
    if(mode==='body-delay')await bounded('delayed-body',()=>evaluate('new Promise(resolve=>setTimeout(()=>resolve(true),3200))'));
    if(mode==='delivery-delay')await bounded('delayed-delivery',()=>evaluate('true'));
    save('native-result.json',{passed:true,fixtureOnly:true,mode,captures,requests,stages,nativeGetPixel:{passed:nativeReadback,expectedCOLORREF:'0xcc4433'},original:false,genericDefectDemonstrated:false,nativeQuit:false,hostTeardown:true});
  }catch(error){
    if(c&&!c.closed)c.seal('fixture first causal failure: '+error.message);
    save('native-failure.json',{error:error.stack,mode,fixtureOnly:true,original:false,unknown,genericDefectDemonstrated:false});
    process.exitCode=1;
  }finally{
    save('workers-final.json',{workers:[...workers.values()]});
    if(unknown){
      for(const method of ['Runtime.evaluate','Page.captureScreenshot','Input.dispatchKeyEvent'])await assert.rejects(c.send(method),/permanently closed/);
      save('permanent-close-negative.json',{blockedMethods:['Runtime.evaluate','Page.captureScreenshot','Input.dispatchKeyEvent'],effects:0,requestsAtUnknown:unknown.requestsIssued,requestsNow:requests,noReconnect:true});
    }
    if(c)c.stop();
    if(browser){browser.kill('SIGTERM');const timer=setTimeout(()=>browser.kill('SIGKILL'),2500);await chromeWait;clearTimeout(timer);}
    if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
    fs.rmSync(path.join(out,'profile'),{recursive:true,force:true});
    save('transport-closure.json',{requests,unknown,laterRequests:unknown?requests-unknown.requestsIssued:0,originalInputRequests:0,hostStop:true,nativeQuit:false});
    if(unknown)assert.equal(requests,unknown.requestsIssued);
  }
}
function analyze(out){
  const lines=name=>{const p=path.join(out,name);return fs.existsSync(p)?fs.readFileSync(p,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];};
  const requests=lines('requests.jsonl'),replies=lines('replies.jsonl'),raw=lines('raw-replies.jsonl'),body=lines('body-events.jsonl'),observations=lines('observations.jsonl');
  const unknownPath=path.join(out,'UNKNOWN.json'),unknown=fs.existsSync(unknownPath)?json(unknownPath):null;
  const stages=requests.map(r=>{
    const reply=replies.find(v=>v.number===r.number),wire=raw.find(v=>v.number===r.number);
    const begin=r.nonce?body.find(v=>v.args[1]===r.nonce&&v.args[2]==='begin'):null;
    const end=r.nonce?body.find(v=>v.args[1]===r.nonce&&v.args[2]==='end'):null;
    const payload=r.nonce?observations.find(v=>v.nonce===r.nonce):null;
    const bodyBegin=begin?.args[3]??payload?.begin??null,bodyEnd=end?.args[3]??payload?.end??null;
    return {...r,bodyBegin,bodyEnd,
      bodyBoundarySource:begin&&end?'console markers':payload?'actual reply diagnostic payload':begin?'console begin only':'UNKNOWN',
      bodyMs:end?.args[4]??payload?.bodyMs??null,issueToObservedBodyBeginMs:bodyBegin!==null?bodyBegin-r.issued:null,
      rawReplyAt:wire?.received??null,bodyEndToRawReplyMs:bodyEnd!==null&&wire?wire.received-bodyEnd:null,
      deliveredReplyAt:reply?.reply??null,totalMs:reply?.elapsed??null,
      stillUnresolvedAtUnknown:!!unknown&&!reply,
      interpretation:r.nonce?'fixture expression body markers; wall timestamps share local host clock':'protocol total only; internal queue/body boundaries UNKNOWN'};
  });
  if(unknown){assert.equal(requests.length,unknown.requestsIssued);assert(!requests.some(r=>r.issued>unknown.at));}
  assert(!requests.some(r=>r.method.startsWith('Input.')));
  return {stages,hostStages:lines('host-stages.jsonl'),operations:lines('operations.jsonl'),unknown,requestsAfterUnknown:0,inputRequests:0,gameCause:'UNPROVED',genericRepair:'NONE'};
}
if(require.main===module){
  const [mode,out,arg,extra]=process.argv.slice(2);
  if(mode==='--retained'){const value=retained();if(out)writeReport(path.resolve(out),value);console.log(JSON.stringify(value,null,2));}
  else if(mode==='--diagnostic-controls')diagnosticControls().then(value=>{if(out)fs.writeFileSync(out,JSON.stringify(value,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(value));}).catch(e=>{console.error(e);process.exitCode=1;});
  else if(mode==='--prepare')console.log(JSON.stringify(prepare(out,Number(arg||1))));
  else if(mode==='--native')native(out,arg,extra).catch(e=>{console.error(e);process.exitCode=1;});
  else if(mode==='--analyze'){const value=analyze(path.resolve(out));fs.writeFileSync(path.join(out,'stage-analysis.json'),JSON.stringify(value,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({stages:value.stages.length,unknown:!!value.unknown}));}
  else throw Error('explicit --retained, --prepare or --native mode required');
}
module.exports={retained,diagnosticExpression,diagnosticControls,fixtureSource,prepare,native,analyze};
