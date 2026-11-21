'use strict';
// Authored PE, autonomous real WM_TIMER callbacks, production browser CPU.
// No game inputs, retained-run dependencies or host-side guest calls.
// Initial guest NCPAINT establishes references; no forced paint follows text changes.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const source=String.raw`
typedef unsigned long U; typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);
P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
P API SetFocus(P); long API SetWindowLongA(P,int,long);
long API DefWindowProcA(P,U,U,long); int API SetWindowTextA(P,const char*);
long API SendMessageA(P,U,U,long); long API CallWindowProcA(P,P,U,U,long);
int API ShowWindow(P,int); int API DestroyWindow(P);
U API SetTimer(P,U,U,P); int API GetMessageA(P,P,U,U);
int API TranslateMessage(P); long API DispatchMessageA(P);
volatile U ticks; P original, reference, focus, mainWindow;
long __stdcall proc(P h,U m,U w,long l) {
 if(m==0xc && MODE==4){DestroyWindow(h);P i=GetModuleHandleA(0);
  mainWindow=CreateWindowExA(0,"STATIC","WWWW",0x10cf0000,30,30,300,180,0,0,i,0);
  SetFocus(focus);DefWindowProcA(mainWindow,0x85,1,0);SetWindowTextA(focus,"done");return 1;}
 if(m==0xc && MODE==3)return CallWindowProcA(original,h,m,w,l);
 if(m==0x113){++ticks;
  if(ticks==3){
   if(MODE==3||MODE==4)SendMessageA(h,0xc,0,(long)"WWWW");else SetWindowTextA(h,"WWWW");
   if(MODE==1)SetFocus(h);
   if(MODE!=2)SetWindowTextA(focus,"done");
  }
  if(ticks==5&&MODE==2){ShowWindow(h,5);SetFocus(focus);SetWindowTextA(focus,"done");}
  return 0;}
 return DefWindowProcA(h,m,w,l);
}
void start(void){P i=GetModuleHandleA(0);
 P a=CreateWindowExA(0,"STATIC","IIII",MODE==2?0x00cf0000:0x10cf0000,30,30,300,180,0,0,i,0);mainWindow=a;
 reference=CreateWindowExA(0,"STATIC","WWWW",0x10cf0000,360,30,300,180,0,0,i,0);
 focus=CreateWindowExA(0,"STATIC","sentinel",0x10000000,700,30,100,100,0,0,i,0);
 original=(P)SetWindowLongA(a,-4,(long)proc);SetFocus(MODE==1?reference:focus);
 if(MODE!=2)DefWindowProcA(a,0x85,1,0);DefWindowProcA(reference,0x85,1,0);SetTimer(a,1,1000,0);
 U msg[12];for(;;)if(GetMessageA(msg,0,0,0)){TranslateMessage(msg);DispatchMessageA(msg);}
}`;
function fixture(out,mode=0){
 fs.writeFileSync(out+'/fixture.c','#define MODE '+mode+'\n'+source);
 const groups={kernel32:['GetModuleHandleA@4'],user32:['CreateWindowExA@48','SetFocus@4','SetWindowLongA@12','DefWindowProcA@16','SetWindowTextA@8','SendMessageA@16','CallWindowProcA@20','ShowWindow@8','DestroyWindow@4','SetTimer@16','GetMessageA@16','TranslateMessage@4','DispatchMessageA@4']};
 for(const [dll,names]of Object.entries(groups)){
  fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');
  cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);
 }
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/fixture.c','-o',out+'/fixture.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/caption.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib']);
 return fs.readFileSync(out+'/caption.exe');
}
async function main(out,old=false,mode=0){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n'),pause=ms=>new Promise(r=>setTimeout(r,ms));
 const commit=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 const runtime=require('../tools/boids-current-runtime.cjs'),files=runtime.gitFiles(commit);
 const owned='src/09c3-controls0-basic-wndprocs.wat';if(!process.env.CAPTION_BASELINE)files.set(owned,fs.readFileSync(root+'/'+owned));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{cwd:root,maxBuffer:8e6}));
 const wasm=runtime.compile(files);fs.writeFileSync(out+'/tested.wasm',wasm);files.set('build/wine-assembly.wasm',wasm);files.set('caption.exe',fixture(out,mode));
 save('runtime.json',{commit,moduleSHA256:sha(wasm),files:[...files].map(([name,b])=>({name,size:b.length,sha256:sha(b)}))});
 let display,browser,wait,server;const transient=require('../tools/browser-transients.cjs').create(),logs=[],pending=[],workers=[];
 try{
  server=http.createServer((req,res)=>{const n=new URL(req.url,'http://local').pathname.slice(1)||'index.html',b=files.get(n);res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.html')?'text/html':n.endsWith('.css')?'text/css':n.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.statusCode=b?200:404;res.end(b||'missing');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  display=await require('../tools/gltron-headful-display.cjs').start(out);
  browser=await require('puppeteer').launch({headless:false,defaultViewport:{width:1050,height:800},env:transient.env(display.env),userDataDir:transient.profile,executablePath:'/opt/google/chrome/chrome',args:[...transient.args,'--no-sandbox','--disable-dev-shm-usage','--disable-component-update','--disable-background-networking'],protocolTimeout:15000});
  wait=transient.watch(browser.process());browser.process().stdout?.resume();browser.process().stderr?.resume();
  const page=await browser.newPage();page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>logs.push(String(e)));
  page.on('workercreated',w=>{const row={url:w.url(),modules:[]};workers.push(row);const c=w.client;c.on('Debugger.scriptParsed',v=>{if(v.scriptLanguage==='WebAssembly'||v.url.startsWith('wasm://')){const p=c.send('Debugger.getScriptSource',{scriptId:v.scriptId}).then(r=>row.modules.push(sha(Buffer.from(r.bytecode,'base64'))));pending.push(p);}});pending.push(c.send('Debugger.enable'));});
  await page.evaluateOnNewDocument(()=>localStorage.setItem('wine-assembly.threads','1'));
  await page.goto('http://127.0.0.1:'+server.address().port+'/?debug&threads&no-log');await page.waitForFunction(()=>typeof WineAssembly==='function');
  await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=650;c.style='position:fixed;left:0;top:0;z-index:99999;width:1000px;height:650px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.captionHost=new WineAssembly();captionHost.renderer=new Win98Renderer(c);const log=captionHost.logToUI;captionHost.logToUI=function(...args){console.log('CAPTION_HOST',...args);return log.apply(this,args);};await captionHost.init(c);if(!captionHost.guestWorker)throw Error('production Worker startup failed');await captionHost.loadExe('/caption.exe');captionHost.run();});
  await page.waitForFunction(()=>Object.values(captionHost.renderer.windows).filter(w=>['IIII','WWWW','sentinel'].includes(w.title)).length===3,{timeout:20000});
  const sample=()=>page.evaluate(()=>{const h=captionHost,r=h.renderer,rows=Object.values(r.windows).filter(w=>w.processId===h.processId&&!w.isChild);return {guestWorker:!!h.guestWorker,rows:rows.map(w=>({hwnd:w.hwnd,title:w.title,nativeTitle:(()=>{let p=h.instance.exports.wnd_lookup_title(w.hwnd),b=new Uint8Array(h.memory.buffer),t='';if(p)for(let i=0;b[p+i]&&i<256;i++)t+=String.fromCharCode(b[p+i]);return t;})(),visible:w.visible,x:w.x,y:w.y,w:w.w,h:w.h,pixels:w._backCanvas?Array.from(w._backCanvas.getContext('2d').getImageData(30,5,150,17).data):null}))};});
  await pause(350);const before=await sample();save('before-state.json',before);require('../tools/browser-transients.cjs').captureWhole(out,'before',display.env);
  if(mode===2){await pause(3100);const hidden=await sample();save('hidden-state.json',hidden);const a=hidden.rows.find(w=>w.title==='WWWW'&&w.x===30);assert(a&&!a.visible,'title changes while hidden');}
  await page.waitForFunction(()=>Object.values(captionHost.renderer.windows).some(w=>w.title==='done'),{timeout:10000});await pause(350);
  const after=await sample();save('after-state.json',after);
  assert(before.guestWorker&&after.guestWorker,'production browser CPU Worker');
  const a=before.rows.find(w=>w.title==='IIII'),ref=before.rows.find(w=>w.title==='WWWW');assert(a&&ref?.pixels);if(mode!==2){assert(a.pixels);assert.notDeepEqual(a.pixels,ref.pixels,'independent initial title pixels distinguish I from W');}
  const changed=after.rows.find(w=>w.x===30),expected=mode===1?ref:after.rows.find(w=>w.hwnd===ref.hwnd);assert.equal(changed.nativeTitle,old?'IIII':'WWWW','native caption table must agree with text state');assert.equal(changed.title,'WWWW');assert.equal(expected.title,'WWWW');assert(changed.visible);
  if(mode===4)assert.notEqual(changed.hwnd,a.hwnd,'callback really destroyed and replaced the target');
  const geometry=await page.evaluate(()=>({rect:captionHost.renderer.canvas.getBoundingClientRect().toJSON(),width:captionHost.renderer.canvas.width,height:captionHost.renderer.canvas.height}));save('geometry.json',geometry);assert.equal(geometry.rect.width,geometry.width);assert.equal(geometry.rect.height,geometry.height);
  const composite=require('pngjs').PNG.sync.read(await page.screenshot({path:out+'/composited.png'}));const visiblePixels=[];for(let y=0;y<17;y++)for(let x=0;x<150;x++){const i=((geometry.rect.y+changed.y+5+y)*composite.width+geometry.rect.x+changed.x+30+x)*4;visiblePixels.push(...composite.data.subarray(i,i+4));}assert.deepEqual(visiblePixels,changed.pixels,'actual composited browser pixels must equal the tested native caption surface');
  // Screenshot readback above synchronizes Chrome's compositor. Assert the
  // independently captured X root contains both caption surfaces at the same
  // translation, rather than accepting a correct offscreen canvas alone.
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await pause(350);require('../tools/browser-transients.cjs').captureWhole(out,'after',display.env);
  const desktop=require('pngjs').PNG.sync.read(fs.readFileSync(out+'/after.png'));
  const at=(pixels,x,y)=>{if(x<0||y<0||x+150>desktop.width||y+17>desktop.height)return false;const b=Buffer.from(pixels);for(let row=0;row<17;row++){const i=((y+row)*desktop.width+x)*4;if(!desktop.data.subarray(i,i+600).equals(b.subarray(row*600,(row+1)*600)))return false;}return true;};
  let origin=null;const first=Buffer.from(changed.pixels.slice(0,600));for(let i=desktop.data.indexOf(first);i>=0;i=desktop.data.indexOf(first,i+4)){if(i%4)continue;const x=(i/4)%desktop.width,y=Math.floor(i/4/desktop.width);if(at(changed.pixels,x,y)&&at(after.rows.find(w=>w.hwnd===ref.hwnd).pixels,x+ref.x-changed.x,y+ref.y-changed.y)){origin={x:x-changed.x-30,y:y-changed.y-5};break;}}
  assert(origin,'native desktop must visibly contain both independently asserted caption surfaces');save('native-visible.json',{origin,captionSurfaceMatches:true,referenceSurfaceMatches:true,captureDeadlineMs:3000});
  const equal=JSON.stringify(changed.pixels)===JSON.stringify(expected.pixels);save('assertions.json',{mode,oldFailureExpected:old,captionPixelsMatchIndependentCreatedTitle:equal,publicTitleMatches:true,productionBrowserCPU:true,realTimerCallback:true});
  if(old)assert(!equal,'old title state updates while visible caption stays stale');else assert(equal,'updated caption must match independently created WWWW title');
  await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))),'actual Worker module identity');assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));
  console.log(old?'PASS oldFAIL reproduced':'PASS native caption pixels');
 }finally{
  save('browser.log.json',logs);await Promise.allSettled(pending);
  if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('transients.json',await transient.cleanup(out));if(display)await display.close();
 }
}
if(require.main===module)main(path.resolve(process.argv[2]),process.argv.includes('--expect-old'),Number(process.env.CAPTION_MODE||0)).catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={fixture,main};
