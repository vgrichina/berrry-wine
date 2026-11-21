'use strict';
// Microsoft primary contracts (2026-11-21):
// https://learn.microsoft.com/en-us/windows/win32/controls/sb-gettext
// https://learn.microsoft.com/en-us/windows/win32/controls/sb-gettextlength
// https://learn.microsoft.com/en-us/windows/win32/controls/sb-settext
// GETTEXT writes a NUL-terminated string; LOWORD is character count excluding
// NUL, HIWORD drawing flags. LENGTH lParam is zero. ASCII style 0 only:
// ANSI bytes and UTF-16 code units have the same count, different buffer sizes.
// No NULL GETTEXT buffer, ownerdraw, icons, unsupported flags/panes or codepage
// conversion oracle. Existing 255-character storage limit is preserved.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const cases=[
 {name:'initial empty',initial:'',ops:'',normal:'',simple:'',mode:0,pane:0},
 {name:'initial WM_SETTEXT',initial:'Boot',ops:'',normal:'Boot',simple:'',mode:0,pane:0},
 {name:'ANSI ordinary',ops:'a(b,0,"Ready 123");',normal:'Ready 123',simple:'',mode:0,pane:0},
 {name:'wide ordinary replaces ANSI',ops:'a(b,0,"Before");w(b,0,"Wide OK");',normal:'Wide OK',simple:'',mode:0,pane:0},
 {name:'inactive simple persists',ops:'a(b,0,"Base");a(b,255,"Menu help");',normal:'Base',simple:'Menu help',mode:0,pane:255},
 {name:'ordinary while simple active',ops:'a(b,0,"Base");a(b,255,"Menu help");s(b,1);',normal:'Base',simple:'Menu help',mode:1,pane:0},
 {name:'active simple',ops:'a(b,0,"Base");a(b,255,"Menu help");s(b,1);',normal:'Base',simple:'Menu help',mode:1,pane:255},
 {name:'switch back ordinary',ops:'a(b,0,"Base");a(b,255,"Menu help");s(b,1);s(b,0);',normal:'Base',simple:'Menu help',mode:0,pane:0},
 {name:'ordinary replaced under simple',ops:'a(b,0,"Old");w(b,255,"WideHelp");s(b,1);w(b,0,"Changed");',normal:'Changed',simple:'WideHelp',mode:1,pane:0},
 {name:'wide simple survives toggles',ops:'a(b,0,"Base");w(b,255,"WideHelp");s(b,1);s(b,0);s(b,1);',normal:'Base',simple:'WideHelp',mode:1,pane:255},
 {name:'empty ordinary replacement',ops:'a(b,0,"Old");w(b,0,"");a(b,255,"Help");',normal:'',simple:'Help',mode:0,pane:0},
 {name:'empty simple replacement',ops:'a(b,0,"Base");a(b,255,"Old");a(b,255,"");s(b,1);',normal:'Base',simple:'',mode:1,pane:255},
 {name:'stored maximum ASCII',ops:'a(b,0,"'+ 'Ab9'.repeat(85)+'");',normal:'Ab9'.repeat(85),simple:'',mode:0,pane:0},
 {name:'shorter wide replacement',ops:'w(b,0,"Previous longer");w(b,0,"X");',normal:'X',simple:'',mode:0,pane:0},
 {name:'WM_SETTEXT ordinary preserves simple',ops:'a(b,0,"Old");w(b,255,"Help");s(b,1);SetWindowTextA(b,"New");s(b,0);',normal:'New',simple:'Help',mode:0,pane:0},
 {name:'initial simple empty',initial:'Boot',ops:'',normal:'Boot',simple:'',mode:0,pane:255}
];
const stride=1616;
function expectedBuffer(text,wide){const b=Buffer.alloc(520,0xa5),t=Buffer.from(text+'\0',wide?'utf16le':'ascii');t.copy(b,4);return b;}
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
unsigned short API RegisterClassA(const void*);long API DefWindowProcA(P,U,U,long);int API SetWindowTextA(P,const char*);
long API SendMessageA(P,U,U,long);long API SendMessageW(P,U,U,long);int API GetMessageA(P,P,U,U);int API TranslateMessage(P);long API DispatchMessageA(P);
P API CreateStatusWindowA(U,const char*,P,int);int API MoveWindow(P,int,int,int,int,int);
P API GetFocus(void);long API GetWindowLongA(P,int);
struct WC{U style;P proc;int cex,wex;P instance,icon,cursor,brush;const char* menu;const char* name;};
struct Result{U n[16];unsigned char ansi[520],wide[520],before[256],after[256];};
static struct Result results[COUNT];static P bars[COUNT],refs[COUNT],frame;static int done;static char caption[80];
static int panes[COUNT]=PANES;
void a(P b,int pane,char* text){SendMessageA(b,0x401,pane,(long)text);}
void w(P b,int pane,char* text){unsigned short v[256];int k=0;for(;text[k];++k)v[k]=text[k];v[k]=0;SendMessageW(b,0x40b,pane,(long)v);v[0]='!';}
void s(P b,int mode){SendMessageA(b,0x409,mode,0);}
void publish(char* prefix){int at=0;for(;prefix[at];++at)caption[at]=prefix[at];U n=(U)results;char digits[12];int k=0;do{digits[k++]='0'+n%10;n/=10;}while(n);while(k)caption[at++]=digits[--k];caption[at]=0;SetWindowTextA(frame,caption);}
void query(void){for(int j=0;j<COUNT;++j){P b=bars[j];struct Result* r=&results[j];int pane=panes[j];
 for(int k=0;k<520;++k){r->ansi[k]=0xa5;r->wide[k]=0xa5;}for(int k=0;k<256;++k){r->before[k]=0;r->after[k]=0;}
 r->n[6]=SendMessageA(b,0x31,0,0);r->n[8]=(U)GetFocus();r->n[10]=GetWindowLongA(b,-16);
 r->n[12]=SendMessageA(b,0x0d,256,(long)r->before);
 r->n[0]=SendMessageA(b,0x403,pane,0);r->n[1]=SendMessageW(b,0x40c,pane,0);
 r->n[2]=SendMessageA(b,0x402,pane,(long)(r->ansi+4));r->n[3]=SendMessageW(b,0x40d,pane,(long)(r->wide+4));
 r->n[4]=SendMessageA(b,0x403,pane,0);r->n[5]=SendMessageW(b,0x40c,pane,0);
 r->n[7]=SendMessageA(b,0x31,0,0);r->n[9]=(U)GetFocus();r->n[11]=GetWindowLongA(b,-16);
 r->n[13]=SendMessageA(b,0x0d,256,(long)r->after);
 }}
long __stdcall proc(P h,U m,U w,long l){return DefWindowProcA(h,m,w,l);}
void start(void){P i=GetModuleHandleA(0);struct WC wc={0,proc,0,0,0,0,0,(P)16,0,"StatusQuery"};wc.instance=i;RegisterClassA(&wc);
 frame=CreateWindowExA(0,"StatusQuery","starting",0x10cf0000,30,30,550,560,0,0,i,0);
 SETUP
 publish("Status query BEFORE ");
 U msg[12];while(GetMessageA(msg,0,0,0)>0){if(!done&&msg[1]==0x100&&msg[2]=='Q'){done=1;query();publish("Status query AFTER ");}TranslateMessage(msg);DispatchMessageA(msg);}}
`.replaceAll('COUNT',String(cases.length)).replace('PANES','{'+cases.map(c=>c.pane).join(',')+'}').replace('SETUP',cases.map((c,j)=>'{P b=bars['+j+']=CreateStatusWindowA(0x50000004,'+JSON.stringify(c.initial||'')+',frame,'+(100+j)+');SetWindowTextA(b,'+JSON.stringify(c.initial||'')+');MoveWindow(b,12,'+(12+j*29)+',220,20,1);'+c.ops+'P ref=refs['+j+']=CreateStatusWindowA(0x50000004,'+JSON.stringify(c.mode?c.simple:c.normal)+',frame,'+(200+j)+');SetWindowTextA(ref,'+JSON.stringify(c.mode?c.simple:c.normal)+');MoveWindow(ref,272,'+(12+j*29)+',220,20,1);results['+j+'].n[14]=(U)b;results['+j+'].n[15]=(U)ref;}').join('\n'));
function fixture(out){
 fs.writeFileSync(out+'/fixture.c',source);
 for(const [dll,names]of Object.entries({comctl32:['CreateStatusWindowA@16'],kernel32:['GetModuleHandleA@4'],user32:['CreateWindowExA@48','RegisterClassA@4','DefWindowProcA@16','SetWindowTextA@8','SendMessageA@16','SendMessageW@16','GetMessageA@16','TranslateMessage@4','DispatchMessageA@4','GetFocus@0','GetWindowLongA@8','MoveWindow@24']})){
  fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/fixture.c','-o',out+'/fixture.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/status-query.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib',out+'/comctl32.lib']);return fs.readFileSync(out+'/status-query.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n'),pause=ms=>new Promise(r=>setTimeout(r,ms));
 const runtime=require(root+'/tools/boids-current-runtime.cjs'),commit=process.env.STATUSBAR_COMMIT||cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files=runtime.gitFiles(commit);
 const own='src/09c3-controls0-basic-wndprocs.wat';files.set(own,fs.readFileSync(root+'/'+own));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{maxBuffer:8e6}));
 const wasm=process.env.STATUSBAR_WASM?fs.readFileSync(process.env.STATUSBAR_WASM):runtime.compile(files),pe=fixture(out);
 fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));files.set('build/wine-assembly.wasm',wasm);files.set('status-query.exe',pe);
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
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=650;c.style='position:fixed;left:0;top:0;z-index:99999;width:1000px;height:650px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.statusHost=new WineAssembly();statusHost.renderer=new Win98Renderer(c);await statusHost.init(c);if(!statusHost.guestWorker)throw Error('production Worker required');await statusHost.loadExe('/status-query.exe');statusHost.run();});
 await page.waitForFunction(()=>Object.values(statusHost.renderer.windows).some(w=>w.title?.startsWith('Status query BEFORE ')),{timeout:15000});
 await page.evaluate(()=>{browserInput.wireCanvasInput(statusHost.renderer.canvas,statusHost.renderer,{runningApps:[{wine:statusHost}],debugMode:true});statusHost.renderer.canvas.focus();});
 const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);
 async function sample(phase){
  await pause(160);const s=await page.evaluate(()=>{const h=statusHost,r=h.renderer,w=Object.values(r.windows).find(w=>w.title?.startsWith('Status query ')),p=w._backCanvas._waCanonicalPresentation;return {title:w.title,hwnd:w.hwnd,memoryBytes:h.memory.buffer.byteLength,rows:Object.values(r.windows).map(v=>({hwnd:v.hwnd,title:v.title,x:v.x,y:v.y,w:v.w,h:v.h,isChild:v.isChild,visible:v.visible})),gdi:p?{shared:p.surface.storage.buffer===h.memory.buffer,pixels:Array.from(p.surface.rgbaRect(0,0,w.w,w.h))}:null,pixels:Array.from(w._backCanvas.getContext('2d').getImageData(0,0,w.w,w.h).data),width:w.w,height:w.h,canvas:r.canvas.getBoundingClientRect().toJSON()};});
  const pointer=Number(s.title.split(' ').at(-1));
  const state=await cpu.evaluate(({pointer,count,stride,frame,regionText})=>{const e=instance.exports,v=new DataView(memory.buffer),base=Number(/WND_RECORDS: \{[^}]*base: (0x[0-9a-fA-F_]+)/.exec(regionText)[1].replaceAll('_','')),status=hwnd=>{let at=-1;for(let k=0;k<256;++k)if(v.getUint32(base+k*24,true)===hwnd)at=base+k*24;if(at<0)throw Error('missing WndRecord');const ptr=v.getUint32(at+20,true),fields=ptr?Array.from({length:6},(_,k)=>e.guest_read32(ptr+k*4)>>>0):[0,0,0,0,0,0];return {ptr,fields,texts:[0,2].map(k=>Array.from({length:fields[k+1]},(_,j)=>e.guest_read8(fields[k]+j)))};},names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,registers:Object.fromEntries(names.map(n=>[n,e[n]()>>>0])),client:{x:e.wnd_client_screen_x(frame),y:e.wnd_client_screen_y(frame)},results:Array.from({length:count},(_,j)=>{const at=pointer+j*stride,n=Array.from({length:16},(_,k)=>e.guest_read32(at+k*4)>>>0);return {n,cls:e.ctrl_get_class(n[14]),status:status(n[14]),live:e.wnd_lookup_live(n[14]),ansi:Array.from({length:520},(_,k)=>e.guest_read8(at+64+k)),wide:Array.from({length:520},(_,k)=>e.guest_read8(at+584+k)),before:Array.from({length:256},(_,k)=>e.guest_read8(at+1104+k)),after:Array.from({length:256},(_,k)=>e.guest_read8(at+1360+k))};})};},{pointer,count:cases.length,stride,frame:s.hwnd,regionText:files.get('lib/region-map.generated.js').toString()});
  assert.equal(state.memoryBytes,536870912);assert.equal(Object.keys(state.registers).length,19);assert(state.registers.get_eip&&state.registers.get_esp);
  const pix=Buffer.from(s.pixels),gdi=Buffer.from(s.gdi?.pixels||[]);assert(s.gdi?.shared);assert(pix.equals(gdi),'GDI shared surface matches backing canvas');
  await page.screenshot({path:out+'/'+phase+'-composited.png'});require(root+'/tools/browser-transients.cjs').captureWhole(out,phase+'-desktop',display.env);
  const {PNG}=require(root+'/node_modules/pngjs'),composite=PNG.sync.read(fs.readFileSync(out+'/'+phase+'-composited.png')),desktop=PNG.sync.read(fs.readFileSync(out+'/'+phase+'-desktop.png')),frame=s.rows.find(w=>w.hwnd===s.hwnd),surfaces=[];
  for(let j=0;j<cases.length;++j){const r=state.results[j];assert.equal(r.cls,22);assert.equal(r.live,1);
   for(const handle of r.n.slice(14)){const b=s.rows.find(w=>w.hwnd===handle),x=b.x+state.client.x-frame.x,y=b.y+state.client.y-frame.y,bytes=Buffer.alloc(b.w*b.h*4);for(let row=0;row<b.h;++row)pix.copy(bytes,row*b.w*4,((y+row)*s.width+x)*4,((y+row)*s.width+x+b.w)*4);surfaces.push({x,y,w:b.w,h:b.h,bytes});}
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
 for(let j=0;j<cases.length;++j){const c=cases[j],r=state.results[j],text=c.pane===255?c.simple:c.normal,active=c.mode?c.simple:c.normal;
  const checks={lengths:r.n.slice(0,6).every(n=>n===text.length),ansi:Buffer.from(r.ansi).equals(expectedBuffer(text,false)),wide:Buffer.from(r.wide).equals(expectedBuffer(text,true))};
  assert.deepEqual(r.before,r.after,'supplemental WM_GETTEXT unchanged '+j);assert.deepEqual(r.status,scenes[0].state.results[j].status,'all stored state unchanged '+j);assert.deepEqual(r.status.texts,[Array.from(Buffer.from(c.normal)),Array.from(Buffer.from(c.simple))]);assert.equal(r.status.fields[4],c.mode);
  assert.equal(r.n[6],r.n[7]);assert.equal(r.n[8],r.n[9]);assert.equal(r.n[10],r.n[11]);assert.equal(r.n[12],r.n[13]);
  if(!Object.values(checks).every(Boolean))failures.push({j,name:c.name,checks,got:r.n.slice(0,6),want:text.length});
 }
 await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));
 save('assertions.json',{expectOld,failures,cases:cases.length,productionBrowserCPU:true,unchangedPixels:true,constantReferencePairs:cases.length*2});
 if(expectOld){assert.equal(failures.length,cases.length,'every buffer must reproduce missing query oldFAIL');console.log('PASS supported preedit oldFAIL',failures.length);}else{assert.deepEqual(failures,[]);console.log('PASS status bar text queries, exact A/W buffers/canaries, persistent pane state and unchanged GDI/backing/compositor/native pixels',cases.length);}
 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('transients.json',await transient.cleanup(out));if(display)await display.close();}
}
if(require.main===module)main(process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync(require('node:os').tmpdir()+'/statusbar-text-query-'),{expectOld:process.argv.includes('--expect-old')}).catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={cases,expectedBuffer,fixture,main};

