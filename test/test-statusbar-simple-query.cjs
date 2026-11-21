'use strict';
// Microsoft primary contracts, read before implementation (2026-11-21):
// https://learn.microsoft.com/en-us/windows/win32/controls/sb-issimple
// https://learn.microsoft.com/en-us/windows/win32/controls/sb-simple
// SB_ISSIMPLE returns nonzero for simple mode, zero otherwise. The documented
// call has zero parameters. Nonzero pointer parameters below are defensive
// canaries, not a claim of a documented nonzero-parameter Windows contract.
// Public native CLASS22 messages only; constant ordinary-text reference bars
// check existing emulator pixels on four planes, not Windows pixel ground truth.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const cases=[
 {
  "name": "creation without state",
  "normal": "",
  "simple": "",
  "toggles": [],
  "mode": 0,
  "noState": true
 },
 {
  "name": "ordinary state default FALSE",
  "initial": "Boot",
  "normal": "Boot",
  "simple": "",
  "toggles": [],
  "mode": 0,
  "noState": false
 },
 {
  "name": "explicit FALSE",
  "normal": "Base",
  "simple": "Help",
  "toggles": [
   0
  ],
  "mode": 0
 },
 {
  "name": "TRUE",
  "normal": "Base",
  "simple": "Help",
  "toggles": [
   1
  ],
  "mode": 1
 },
 {
  "name": "positive nonzero BOOL",
  "normal": "Base",
  "simple": "Help",
  "toggles": [
   2
  ],
  "mode": 1
 },
 {
  "name": "negative nonzero BOOL",
  "normal": "Base",
  "simple": "Help",
  "toggles": [
   -1
  ],
  "mode": 1
 },
 {
  "name": "high bit nonzero BOOL",
  "normal": "Base",
  "simple": "Help",
  "toggles": [
   -2147483648
  ],
  "mode": 1
 },
 {
  "name": "TRUE to FALSE",
  "normal": "Base",
  "simple": "Help",
  "toggles": [
   1,
   0
  ],
  "mode": 0
 },
 {
  "name": "nonzero to FALSE",
  "normal": "Base",
  "simple": "Help",
  "toggles": [
   2,
   0
  ],
  "mode": 0
 },
 {
  "name": "repeated TRUE",
  "normal": "Base",
  "simple": "Help",
  "toggles": [
   1,
   1
  ],
  "mode": 1
 },
 {
  "name": "menu mode restoration",
  "normal": "Ready",
  "simple": "Menu help",
  "toggles": [
   1,
   0,
   1
  ],
  "mode": 1
 },
 {
  "name": "ordinary retained under simple",
  "normal": "Changed",
  "simple": "Help",
  "toggles": [
   1
  ],
  "extra": "a(b,0,\"Changed\");",
  "mode": 1
 },
 {
  "name": "simple retained under ordinary",
  "normal": "Base",
  "simple": "NewHelp",
  "toggles": [
   1,
   0
  ],
  "extra": "a(b,255,\"NewHelp\");",
  "mode": 0
 },
 {
  "name": "wide stores retain independently",
  "normal": "WideBase",
  "simple": "WideHelp",
  "toggles": [
   1,
   0,
   1
  ],
  "wide": true,
  "mode": 1
 },
 {
  "name": "destroy enabled recreate defaults",
  "normal": "",
  "simple": "",
  "toggles": [],
  "recreate": true,
  "mode": 0,
  "noState": true
 },
 {
  "name": "last HWND toggles isolate earlier HWNDs",
  "normal": "Last",
  "simple": "LastHelp",
  "toggles": [
   2,
   0,
   1,
   0
  ],
  "mode": 0
 }
];
const stride=1808;
function expectedBuffer(text,wide){const b=Buffer.alloc(520,0xa5),t=Buffer.from(text+'\0',wide?'utf16le':'ascii');t.copy(b,4);return b;}
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
unsigned short API RegisterClassA(const void*);long API DefWindowProcA(P,U,U,long);int API SetWindowTextA(P,const char*);
long API SendMessageA(P,U,U,long);long API SendMessageW(P,U,U,long);int API GetMessageA(P,P,U,U);int API TranslateMessage(P);long API DispatchMessageA(P);
P API CreateStatusWindowA(U,const char*,P,int);int API MoveWindow(P,int,int,int,int,int);
P API GetFocus(void);long API GetWindowLongA(P,int);int API DestroyWindow(P);int API GetWindowRect(P,P);int API GetUpdateRect(P,P,int);
struct WC{U style;P proc;int cex,wex;P instance,icon,cursor,brush;const char* menu;const char* name;};
struct Result{U n[48];unsigned char ansi[520],wide[520],before[256],after[256],ignored[64];};
static struct Result results[COUNT];static P bars[COUNT],refs[COUNT],frame;static U notices,paints;static int done;static char caption[80];

void a(P b,int pane,char* text){SendMessageA(b,0x401,pane,(long)text);}
void w(P b,int pane,char* text){unsigned short v[256];int k=0;for(;text[k];++k)v[k]=text[k];v[k]=0;SendMessageW(b,0x40b,pane,(long)v);v[0]='!';}
void s(P b,int mode){SendMessageA(b,0x409,mode,0);}
void publish(char* prefix){int at=0;for(;prefix[at];++at)caption[at]=prefix[at];U n=(U)results;char digits[12];int k=0;do{digits[k++]='0'+n%10;n/=10;}while(n);while(k)caption[at++]=digits[--k];caption[at]=0;SetWindowTextA(frame,caption);}
void query(void){for(int j=0;j<COUNT;++j){P b=bars[j];struct Result* r=&results[j];
 for(int k=0;k<520;++k){r->ansi[k]=0xa5;r->wide[k]=0xa5;}for(int k=0;k<256;++k){r->before[k]=0;r->after[k]=0;}
 r->n[6]=SendMessageA(b,0x31,0,0);r->n[8]=(U)GetFocus();r->n[10]=GetWindowLongA(b,-16);
 r->n[12]=SendMessageA(b,0x0d,256,(long)r->before);
 for(int k=0;k<64;++k)r->ignored[k]=0xa5;
 GetWindowRect(b,r->n+27);r->n[25]=GetUpdateRect(b,0,0);r->n[21]=notices;r->n[23]=paints;
 r->n[0]=SendMessageA(b,0x40e,0,0);r->n[1]=SendMessageW(b,0x40e,0,0);
 r->n[2]=SendMessageA(b,0x40e,(U)(r->ignored+4),(long)(r->ignored+20));
 r->n[3]=SendMessageW(b,0x40e,0xffffffff,(long)(r->ignored+40));
 r->n[4]=SendMessageA(b,0x40e,0,0);r->n[5]=SendMessageW(b,0x40e,0,0);
 r->n[22]=notices;r->n[24]=paints;r->n[26]=GetUpdateRect(b,0,0);GetWindowRect(b,r->n+31);
 r->n[17]=SendMessageA(refs[j],0x40e,0,0);
 r->n[37]=SendMessageA(b,0x402,0,(long)(r->ansi+4));r->n[38]=SendMessageW(b,0x40d,255,(long)(r->wide+4));
 r->n[7]=SendMessageA(b,0x31,0,0);r->n[9]=(U)GetFocus();r->n[11]=GetWindowLongA(b,-16);
 r->n[13]=SendMessageA(b,0x0d,256,(long)r->after);
 }}
long __stdcall proc(P h,U m,U w,long l){if(m==0x4e||m==0x111||m==0x2b)++notices;if(m==0xf)++paints;return DefWindowProcA(h,m,w,l);}
void start(void){P i=GetModuleHandleA(0);struct WC wc={0,proc,0,0,0,0,0,(P)16,0,"StatusQuery"};wc.instance=i;RegisterClassA(&wc);
 frame=CreateWindowExA(0,"StatusQuery","starting",0x10cf0000,30,30,550,560,0,0,i,0);
 SETUP
 publish("Status query BEFORE ");
 U msg[12];while(GetMessageA(msg,0,0,0)>0){if(!done&&msg[1]==0x100&&msg[2]=='Q'){done=1;query();publish("Status query AFTER ");}TranslateMessage(msg);DispatchMessageA(msg);}}
`.replaceAll('COUNT',String(cases.length)).replace('SETUP',cases.map((c,j)=>'{P b=bars['+j+']=CreateStatusWindowA(0x50000004,'+JSON.stringify(c.initial||'')+',frame,'+(100+j)+');results['+j+'].n[16]=SendMessageA(b,0x40e,0,0);'+(c.recreate?'s(b,2);results['+j+'].n[18]=SendMessageA(b,0x40e,0,0);DestroyWindow(b);b=bars['+j+']=CreateStatusWindowA(0x50000004,"",frame,'+(100+j)+');results['+j+'].n[19]=SendMessageA(b,0x40e,0,0);':'')+(c.noState?'':(c.wide?'w':'a')+'(b,0,'+JSON.stringify(c.normal)+');'+(c.wide?'w':'a')+'(b,255,'+JSON.stringify(c.simple)+');')+c.toggles.map((n,k)=>'s(b,'+n+');results['+j+'].n['+(40+k)+']=SendMessageA(b,0x40e,0,0);').join('')+(c.extra||'')+'MoveWindow(b,12,'+(12+j*29)+',220,20,1);P ref=refs['+j+']=CreateStatusWindowA(0x50000004,'+JSON.stringify(c.mode?c.simple:c.normal)+',frame,'+(200+j)+');SetWindowTextA(ref,'+JSON.stringify(c.mode?c.simple:c.normal)+');MoveWindow(ref,272,'+(12+j*29)+',220,20,1);results['+j+'].n[14]=(U)b;results['+j+'].n[15]=(U)ref;}').join('\n'));

function fixture(out){
 fs.writeFileSync(out+'/fixture.c',source);
 for(const [dll,names]of Object.entries({comctl32:['CreateStatusWindowA@16'],kernel32:['GetModuleHandleA@4'],user32:['CreateWindowExA@48','RegisterClassA@4','DefWindowProcA@16','SetWindowTextA@8','SendMessageA@16','SendMessageW@16','GetMessageA@16','TranslateMessage@4','DispatchMessageA@4','GetFocus@0','GetWindowLongA@8','MoveWindow@24','DestroyWindow@4','GetWindowRect@8','GetUpdateRect@12']})){
  fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/fixture.c','-o',out+'/fixture.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/status-simple-query.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib',out+'/comctl32.lib']);return fs.readFileSync(out+'/status-simple-query.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n'),pause=ms=>new Promise(r=>setTimeout(r,ms));
 const runtime=require(root+'/tools/boids-current-runtime.cjs'),commit=process.env.STATUSBAR_SIMPLE_COMMIT||cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files=runtime.gitFiles(commit);
 const own='src/09c3-controls0-basic-wndprocs.wat';files.set(own,fs.readFileSync(root+'/'+own));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{maxBuffer:8e6}));
 const wasm=process.env.STATUSBAR_SIMPLE_WASM?fs.readFileSync(process.env.STATUSBAR_SIMPLE_WASM):runtime.compile(files),pe=fixture(out);
 fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));files.set('build/wine-assembly.wasm',wasm);files.set('status-simple-query.exe',pe);
 save('runtime.json',{commit,expectOld,moduleSHA256:sha(wasm),peSHA256:sha(pe),testSHA256:sha(fs.readFileSync(__filename)),cases,files:[...files].map(([name,b])=>({name,size:b.length,sha256:sha(b)}))});
 const transient=require(root+'/tools/browser-transients.cjs').create(),logs=[],pending=[],workers=[],scenes=[],failures=[];
 let display,browser,wait,server;
 try{
 server=http.createServer((req,res)=>{const n=new URL(req.url,'http://local').pathname.slice(1)||'index.html',b=files.get(n);res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.html')?'text/html':n.endsWith('.css')?'text/css':n.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.statusCode=b?200:404;res.end(b||'missing');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 display=await require(root+'/tools/gltron-headful-display.cjs').start(out);
 browser=await require(root+'/node_modules/puppeteer').launch({headless:false,defaultViewport:{width:1050,height:800},env:transient.env(display.env),userDataDir:transient.profile,executablePath:'/opt/google/chrome/chrome',args:[...transient.args,'--no-sandbox','--disable-dev-shm-usage','--disable-component-update','--disable-background-networking'],protocolTimeout:45000});wait=transient.watch(browser.process());browser.process().stdout?.resume();browser.process().stderr?.resume();save('browser-version.json',{version:await browser.version()});
 const page=await browser.newPage();page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>logs.push(String(e)));
 page.on('workercreated',w=>{const row={url:w.url(),modules:[]};workers.push(row);const c=w.client;c.on('Debugger.scriptParsed',v=>{if(v.scriptLanguage==='WebAssembly'||v.url.startsWith('wasm://'))pending.push(c.send('Debugger.getScriptSource',{scriptId:v.scriptId}).then(r=>row.modules.push(sha(Buffer.from(r.bytecode,'base64')))));});pending.push(c.send('Debugger.enable'));});
 await page.evaluateOnNewDocument(()=>localStorage.setItem('wine-assembly.threads','1'));await page.goto('http://127.0.0.1:'+server.address().port+'/?debug&threads&no-log');await page.waitForFunction(()=>typeof WineAssembly==='function');
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=650;c.style='position:fixed;left:0;top:0;z-index:99999;width:1000px;height:650px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.statusHost=new WineAssembly();statusHost.renderer=new Win98Renderer(c);await statusHost.init(c);if(!statusHost.guestWorker)throw Error('production Worker required');await statusHost.loadExe('/status-simple-query.exe');statusHost.run();});
 await page.waitForFunction(()=>Object.values(statusHost.renderer.windows).some(w=>w.title?.startsWith('Status query BEFORE ')),{timeout:15000});
 await page.evaluate(()=>{browserInput.wireCanvasInput(statusHost.renderer.canvas,statusHost.renderer,{runningApps:[{wine:statusHost}],debugMode:true});statusHost.renderer.canvas.focus();});
 const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);
 async function sample(phase){
  await pause(160);const s=await page.evaluate(()=>{const h=statusHost,r=h.renderer,w=Object.values(r.windows).find(w=>w.title?.startsWith('Status query ')),p=w._backCanvas._waCanonicalPresentation;return {title:w.title,hwnd:w.hwnd,memoryBytes:h.memory.buffer.byteLength,rows:Object.values(r.windows).map(v=>({hwnd:v.hwnd,title:v.title,x:v.x,y:v.y,w:v.w,h:v.h,isChild:v.isChild,visible:v.visible})),gdi:p?{shared:p.surface.storage.buffer===h.memory.buffer,pixels:Array.from(p.surface.rgbaRect(0,0,w.w,w.h))}:null,pixels:Array.from(w._backCanvas.getContext('2d').getImageData(0,0,w.w,w.h).data),width:w.w,height:w.h,canvas:r.canvas.getBoundingClientRect().toJSON()};});
  const pointer=Number(s.title.split(' ').at(-1));
  const state=await cpu.evaluate(({pointer,count,stride,frame,regionText})=>{const e=instance.exports,v=new DataView(memory.buffer),base=Number(/WND_RECORDS: \{[^}]*base: (0x[0-9a-fA-F_]+)/.exec(regionText)[1].replaceAll('_','')),status=hwnd=>{let at=-1;for(let k=0;k<256;++k)if(v.getUint32(base+k*24,true)===hwnd)at=base+k*24;if(at<0)throw Error('missing WndRecord');const ptr=v.getUint32(at+20,true),fields=ptr?Array.from({length:6},(_,k)=>e.guest_read32(ptr+k*4)>>>0):[0,0,0,0,0,0];return {ptr,fields,texts:[0,2].map(k=>Array.from({length:fields[k+1]},(_,j)=>e.guest_read8(fields[k]+j)))};},names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,registers:Object.fromEntries(names.map(n=>[n,e[n]()>>>0])),client:{x:e.wnd_client_screen_x(frame),y:e.wnd_client_screen_y(frame)},results:Array.from({length:count},(_,j)=>{const at=pointer+j*stride,n=Array.from({length:48},(_,k)=>e.guest_read32(at+k*4)>>>0);return {n,cls:e.ctrl_get_class(n[14]),status:status(n[14]),live:e.wnd_lookup_live(n[14]),ansi:Array.from({length:520},(_,k)=>e.guest_read8(at+192+k)),wide:Array.from({length:520},(_,k)=>e.guest_read8(at+712+k)),before:Array.from({length:256},(_,k)=>e.guest_read8(at+1232+k)),after:Array.from({length:256},(_,k)=>e.guest_read8(at+1488+k)),ignored:Array.from({length:64},(_,k)=>e.guest_read8(at+1744+k))};})};},{pointer,count:cases.length,stride,frame:s.hwnd,regionText:files.get('lib/region-map.generated.js').toString()});
  assert.equal(state.memoryBytes,536870912);assert.equal(Object.keys(state.registers).length,19);assert(state.registers.get_eip&&state.registers.get_esp);
  const pix=Buffer.from(s.pixels),gdi=Buffer.from(s.gdi?.pixels||[]);assert(s.gdi?.shared);assert(pix.equals(gdi),'GDI shared surface matches backing canvas');
  await page.screenshot({path:out+'/'+phase+'-composited.png'});require(root+'/tools/browser-transients.cjs').captureWhole(out,phase+'-desktop',display.env);
  const {PNG}=require(root+'/node_modules/pngjs'),composite=PNG.sync.read(fs.readFileSync(out+'/'+phase+'-composited.png')),desktop=PNG.sync.read(fs.readFileSync(out+'/'+phase+'-desktop.png')),frame=s.rows.find(w=>w.hwnd===s.hwnd),surfaces=[];
  for(let j=0;j<cases.length;++j){const r=state.results[j];assert.equal(r.cls,22);assert.equal(r.live,1);
   for(const handle of r.n.slice(14,16)){const b=s.rows.find(w=>w.hwnd===handle),x=b.x+state.client.x-frame.x,y=b.y+state.client.y-frame.y,bytes=Buffer.alloc(b.w*b.h*4);for(let row=0;row<b.h;++row)pix.copy(bytes,row*b.w*4,((y+row)*s.width+x)*4,((y+row)*s.width+x+b.w)*4);surfaces.push({x,y,w:b.w,h:b.h,bytes});}
   assert(surfaces[j*2].bytes.equals(surfaces[j*2+1].bytes),'constant reference pixels '+j);
   // Normal status border interior has the Win9x face color.
   assert.deepEqual(Array.from(surfaces[j*2].bytes.subarray((18*220+100)*4,(18*220+100)*4+4)),[192,192,192,255]);
  }
  const match=(png,v,ox,oy)=>{const x=Math.round(ox+v.x),y=Math.round(oy+v.y);if(x<0||y<0||x+v.w>png.width||y+v.h>png.height)return false;for(let row=0;row<v.h;++row)if(!png.data.subarray(((y+row)*png.width+x)*4,((y+row)*png.width+x+v.w)*4).equals(v.bytes.subarray(row*v.w*4,(row+1)*v.w*4)))return false;return true;};
  assert(surfaces.every(v=>match(composite,v,s.canvas.x+frame.x,s.canvas.y+frame.y)),'compositor exact status surfaces');
  // Use a complete asymmetric border/text row, then verify every full surface.
  const first=surfaces[2],needle=first.bytes.subarray(8*first.w*4,9*first.w*4);let origin=null;
  for(let at=desktop.data.indexOf(needle);at>=0;at=desktop.data.indexOf(needle,at+1)){if(at%4)continue;const ox=at/4%desktop.width-first.x,oy=Math.floor(at/4/desktop.width)-first.y-8;if(surfaces.every(v=>match(desktop,v,ox,oy))){origin={x:ox,y:oy};break;}}
  assert(origin,'native desktop exact status surfaces');
  save(phase+'-visible.json',{origin,exactCompositor:true,exactNativeDesktop:true,constantReferencePairs:cases.length,surfaces:surfaces.map(({bytes,...v})=>({...v,sha256:sha(bytes)}))});
  save(phase+'-cpu.json',state);fs.writeFileSync(out+'/'+phase+'-pixels.json.gz',zlib.gzipSync(Buffer.from(JSON.stringify({width:s.width,height:s.height,pixels:s.pixels}))));
  delete s.pixels;delete s.gdi;scenes.push({s,state,surfaceHashes:surfaces.map(v=>sha(v.bytes))});return state;
 }
 await sample('before');await page.keyboard.press('q');
 await page.waitForFunction(()=>Object.values(statusHost.renderer.windows).some(w=>w.title?.startsWith('Status query AFTER ')),{timeout:10000});
 const state=await sample('after');assert.deepEqual(scenes[0].surfaceHashes,scenes[1].surfaceHashes,'queries preserve every status pixel');
 for(let j=0;j<cases.length;++j){const c=cases[j],r=state.results[j];
  const history=c.toggles.map((n,k)=>({got:r.n[40+k],want:n?1:0}));
  const checks={mode:r.n.slice(0,6).every(n=>n===c.mode),history:history.every(v=>v.got===v.want),destroyedEnabled:!c.recreate||r.n[18]===1};
  assert.equal(r.n[16],0,'creation default FALSE '+j);assert.equal(r.n[19],0,'recreation default FALSE '+j);assert.equal(r.n[17],0,'independent reference HWND stays ordinary '+j);
  assert(Buffer.from(r.ignored).equals(Buffer.alloc(64,0xa5)),'ignored parameters never mutate guest buffers '+j);
  assert.equal(r.n[37],c.normal.length);assert.equal(r.n[38],c.simple.length);
  assert(Buffer.from(r.ansi).equals(expectedBuffer(c.normal,false)));assert(Buffer.from(r.wide).equals(expectedBuffer(c.simple,true)));
  for(const [a,b]of [[6,7],[8,9],[10,11],[12,13],[21,22],[23,24],[25,26]])assert.equal(r.n[a],r.n[b],'query side effect '+a+' '+j);
  assert.deepEqual(r.n.slice(27,31),r.n.slice(31,35),'layout unchanged '+j);
  assert.deepEqual(r.before,r.after);assert.deepEqual(r.status,scenes[0].state.results[j].status,'entire retained status state unchanged '+j);
  // CreateStatusWindowA delivers WM_CREATE and attaches state even for empty
  // captions. The uninitialized-state branch is checked separately below.
  assert.deepEqual(r.status.texts,[Array.from(Buffer.from(c.normal)),Array.from(Buffer.from(c.simple))]);assert.equal(r.status.fields[4],c.mode);
  if(!Object.values(checks).every(Boolean))failures.push({j,name:c.name,checks,got:r.n.slice(0,6),history,want:c.mode});
 }
 await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));
 save('assertions.json',{expectOld,failures,cases:cases.length,productionBrowserCPU:true,unchangedPixels:true,constantReferencePairs:cases.length*2});
 if(expectOld){assert.equal(failures.length,cases.filter(c=>c.mode||c.toggles.some(n=>n)||c.recreate).length,'supported preedit reproduces every enabled query failure');console.log('PASS supported preedit oldFAIL',failures.length);}else{assert.deepEqual(failures,[]);console.log('PASS SB_ISSIMPLE normalized BOOL, creation/recreation, toggle history, HWND isolation, retained text, canaries, no query side effects, four pixel planes',cases.length);}
 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('transients.json',await transient.cleanup(out));if(display)await display.close();}
}
async function supplemental(out,{expectOld=false}={}){
 // Supplemental full-module helper coverage, explicitly separate from the
 // production CPU PE above: attach a live native slot without WM_CREATE.
 // This reaches the absent-state branch without changing guest runtime tools.
 const extraWat=String.raw`
 (func (export "sq_make") (param $h i32)
   (call $wnd_table_set (local.get $h) (global.get $WNDPROC_CTRL_NATIVE))
   (call $ctrl_table_set (call $wnd_table_find (local.get $h)) (i32.const 22) (i32.const 10)))
 (func (export "sq_ptr") (param $h i32) (result i32) (call $wnd_get_state_ptr (local.get $h)))
 (func (export "sq_mode") (param $h i32) (param $v i32)
   (call $statusbar_set_simple_mode (cast ptr<StatusBarState> (call $g2w
     (call $statusbar_state_get (local.get $h) (i32.const 1)))) (local.get $v)))
 (func (export "sq_query") (param $h i32) (param $w i32) (param $l i32) (result i32)
   (call $statusbar_wndproc (local.get $h) (i32.const 0x040E) (local.get $w) (local.get $l)))`;
 const {exports:e}=await require('./render-helper').bootRenderHarness({extraWat,fonts:'none'});
 const h=0x10051,canary=e.guest_alloc(64)>>>0;for(let k=0;k<64;k++)e.guest_write8(canary+k,0xa5);
 e.sq_make(h);assert.equal(e.sq_ptr(h),0);assert.equal(e.sq_query(h,canary,canary+4),0);assert.equal(e.sq_ptr(h),0,'absent state remains absent');
 const rows=[];for(const mode of [0,1,2,-1,-2147483648,0]){e.sq_mode(h,mode);const got=e.sq_query(h,canary,canary+4)>>>0;rows.push({mode,got,want:mode?1:0});}
 assert.deepEqual(Array.from({length:64},(_,k)=>e.guest_read8(canary+k)),Array(64).fill(0xa5));
 const failures=rows.filter(r=>r.got!==r.want);if(expectOld)assert.equal(failures.length,4);else assert.deepEqual(failures,[]);
 fs.writeFileSync(out+'/supplemental.json',JSON.stringify({kind:'full-module helper only; not production CPU evidence',missingStateReadOnly:true,canaries:true,rows,expectOld,failures},null,2));
 console.log('PASS supplemental absent-state read-only and raw stored BOOL normalization',rows.length);
}
if(require.main===module){const out=process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync(require('node:os').tmpdir()+'/statusbar-simple-query-'),options={expectOld:process.argv.includes('--expect-old')};main(out,options).then(()=>supplemental(out,options)).catch(e=>{console.error(e.stack);process.exitCode=1;});}
module.exports={cases,expectedBuffer,fixture,main,supplemental};


