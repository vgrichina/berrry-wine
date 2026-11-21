'use strict';
// Microsoft primary documentation verified before production edits, 2026-11-21:
// https://learn.microsoft.com/en-us/windows/win32/controls/pbm-setbarcolor
// https://learn.microsoft.com/en-us/windows/win32/controls/pbm-setbkcolor
// https://raw.githubusercontent.com/microsoft/win32metadata/main/generation/WinSDK/RecompiledIdlHeaders/um/CommCtrl.h
// PBM_SETBARCOLOR=WM_USER+9=0x409; PBM_SETBKCOLOR=CCM_SETBKCOLOR=0x2001.
// wParam=0, lParam=COLORREF; return previous color, or CLR_DEFAULT when default.
// CLR_DEFAULT=0xFF000000 (distinct from CLR_NONE=0xFFFFFFFF). Reset restores
// the default. Messages have no effect under visual styles; this is CLASSIC
// native paint only. Default RGB values and geometry below are retained
// EMULATOR policy, not Microsoft-documented Windows colors/pixels. No Wine.
// Constant references are independently generated, never sampled from a peer
// progress control. Check shared GDI, backing canvas, compositor and desktop.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const DEFAULT=0xff000000;
const cases=[
 {name:'horizontal both RGB',bar:0x563412,bk:0xc39a71},
 {name:'horizontal black bar',bar:0,bk:0xffffff},
 {name:'horizontal white bar black background',bar:0xffffff,bk:0},
 {name:'horizontal bar reset',bar:DEFAULT,bk:0x197bc3,resetBar:true},
 {name:'horizontal background reset',bar:0xd45621,bk:DEFAULT,resetBk:true},
 {name:'horizontal both reset/recreate',bar:DEFAULT,bk:DEFAULT,recreate:true},
 {name:'vertical both RGB',bar:0x35b76d,bk:0xe3219c,vertical:true},
 {name:'vertical black bar',bar:0,bk:0xffffff,vertical:true},
 {name:'vertical white bar black background',bar:0xffffff,bk:0,vertical:true},
 {name:'vertical bar reset',bar:DEFAULT,bk:0x197bc3,resetBar:true,vertical:true},
 {name:'vertical background reset',bar:0xd45621,bk:DEFAULT,resetBk:true,vertical:true},
 {name:'vertical both reset',bar:DEFAULT,bk:DEFAULT,resetBar:true,resetBk:true,vertical:true}
];
const stride=448;
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
unsigned short API RegisterClassA(const void*);long API DefWindowProcA(P,U,U,long);int API SetWindowTextA(P,const char*);
long API SendMessageA(P,U,U,long);long API SendMessageW(P,U,U,long);int API GetMessageA(P,P,U,U);int API TranslateMessage(P);long API DispatchMessageA(P);
P API GetFocus(void);long API GetWindowLongA(P,int);int API DestroyWindow(P);int API GetWindowRect(P,P);int API GetUpdateRect(P,P,int);int API UpdateWindow(P);int API InvalidateRect(P,P,int);
struct WC{U style;P proc;int cex,wex;P instance,icon,cursor,brush;const char* menu;const char* name;};
struct Result{U n[64];unsigned char before[64],after[64],ignored[64];};
static struct Result results[COUNT];static P bars[COUNT],refs[COUNT],frame;static U notices;static int done;static char caption[80];
P bar(P i,int id,int j){int v=j>=6;return CreateWindowExA(0,"msctls_progress32","Preserve color",0x50000000|(v?4:0),v?270+(j-6)*48:12,v?12:12+j*45,v?28:220,v?260:30,frame,(P)id,i,0);}
void publish(char* prefix){int at=0;for(;prefix[at];++at)caption[at]=prefix[at];U n=(U)results;char digits[12];int k=0;do{digits[k++]='0'+n%10;n/=10;}while(n);while(k)caption[at++]=digits[--k];caption[at]=0;SetWindowTextA(frame,caption);}
void query(void){for(int j=0;j<COUNT;++j){P b=bars[j];struct Result* r=&results[j];
 for(int k=0;k<64;++k){r->before[k]=0xa5;r->after[k]=0xa5;r->ignored[k]=0xa5;}
 r->n[6]=SendMessageA(b,0x31,0,0);r->n[8]=(U)GetFocus();r->n[10]=GetWindowLongA(b,-16);
 r->n[12]=SendMessageA(b,0x0d,56,(long)(r->before+4));GetWindowRect(b,r->n+27);r->n[21]=notices;
 r->n[35]=SendMessageA(b,0x407,1,0);r->n[36]=SendMessageA(b,0x407,0,0);r->n[37]=SendMessageA(b,0x408,0,0);r->n[38]=SendMessageA(b,0x40d,0,0);
 OPERATIONS
 r->n[22]=notices;GetWindowRect(b,r->n+31);r->n[7]=SendMessageA(b,0x31,0,0);r->n[9]=(U)GetFocus();r->n[11]=GetWindowLongA(b,-16);r->n[13]=SendMessageA(b,0x0d,56,(long)(r->after+4));
 r->n[39]=SendMessageA(b,0x407,1,0);r->n[40]=SendMessageA(b,0x407,0,0);r->n[41]=SendMessageA(b,0x408,0,0);r->n[42]=SendMessageA(b,0x40d,0,0);
 UpdateWindow(b);InvalidateRect(b,0,1);UpdateWindow(b);
 }}
long __stdcall proc(P h,U m,U w,long l){if(m==0x4e||m==0x111||m==0x2b)++notices;return DefWindowProcA(h,m,w,l);}
void start(void){P i=GetModuleHandleA(0);struct WC wc={0,proc,0,0,0,0,0,(P)16,0,"ColorProgress"};wc.instance=i;RegisterClassA(&wc);
 frame=CreateWindowExA(0,"ColorProgress","starting",0x10cf0000,30,30,620,355,0,0,i,0);
 for(int j=0;j<COUNT;++j){P b=bars[j]=bar(i,100+j,j);results[j].n[14]=(U)b;SendMessageA(b,0x406,10,210);SendMessageA(b,0x402,110,0);SendMessageA(b,0x404,7,0);}
 publish("Color progress BEFORE ");U msg[12];while(GetMessageA(msg,0,0,0)>0){if(!done&&msg[1]==0x100&&msg[2]=='Q'){done=1;query();publish("Color progress AFTER ");}TranslateMessage(msg);DispatchMessageA(msg);}}
`.replaceAll('COUNT',String(cases.length)).replace('OPERATIONS',cases.map((c,j)=>`if(j==${j}){
 r->n[0]=SendMessageA(b,0x409,0,0x234567);r->n[1]=SendMessageW(b,0x2001,0,0x987654);
 r->n[2]=SendMessageW(b,0x409,0,${c.bar}U);r->n[3]=SendMessageA(b,0x2001,0,${c.bk}U);
 r->n[4]=SendMessageA(b,0x409,0,${c.bar}U);r->n[5]=SendMessageW(b,0x2001,0,${c.bk}U);
 ${c.recreate?'DestroyWindow(b);b=bars['+j+']=bar(GetModuleHandleA(0),100+j,j);r->n[14]=(U)b;SendMessageA(b,0x406,10,210);SendMessageA(b,0x402,110,0);SendMessageA(b,0x404,7,0);r->n[18]=SendMessageA(b,0x409,0,0xff000000U);r->n[19]=SendMessageA(b,0x2001,0,0xff000000U);':''}
 }`).join('\n'));

function fixture(out){
 fs.writeFileSync(out+'/fixture.c',source);
 for(const [dll,names]of Object.entries({kernel32:['GetModuleHandleA@4'],user32:['CreateWindowExA@48','RegisterClassA@4','DefWindowProcA@16','SetWindowTextA@8','SendMessageA@16','SendMessageW@16','GetMessageA@16','TranslateMessage@4','DispatchMessageA@4','GetFocus@0','GetWindowLongA@8','MoveWindow@24','DestroyWindow@4','GetWindowRect@8','GetUpdateRect@12','UpdateWindow@4','InvalidateRect@12']})){
  fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/fixture.c','-o',out+'/fixture.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/progress-custom-colors.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib']);return fs.readFileSync(out+'/progress-custom-colors.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n'),pause=ms=>new Promise(r=>setTimeout(r,ms));
 const runtime=require(root+'/tools/boids-current-runtime.cjs'),commit=process.env.PROGRESS_COLORS_COMMIT||cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files=runtime.gitFiles(commit);
 for(const own of ['src/09c3-controls.wat','src/09c3-controls0-basic-wndprocs.wat'])files.set(own,fs.readFileSync(root+'/'+own));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{maxBuffer:8e6}));
 const wasm=process.env.PROGRESS_COLORS_WASM?fs.readFileSync(process.env.PROGRESS_COLORS_WASM):runtime.compile(files),pe=fixture(out);
 fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));files.set('build/wine-assembly.wasm',wasm);files.set('progress-custom-colors.exe',pe);
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
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=650;c.style='position:fixed;left:0;top:0;z-index:99999;width:1000px;height:650px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.colorHost=new WineAssembly();colorHost.renderer=new Win98Renderer(c);await colorHost.init(c);if(!colorHost.guestWorker)throw Error('production Worker required');await colorHost.loadExe('/progress-custom-colors.exe');colorHost.run();});
 await page.waitForFunction(()=>Object.values(colorHost.renderer.windows).some(w=>w.title?.startsWith('Color progress BEFORE ')),{timeout:15000});
 await page.evaluate(()=>{browserInput.wireCanvasInput(colorHost.renderer.canvas,colorHost.renderer,{runningApps:[{wine:colorHost}],debugMode:true});colorHost.renderer.canvas.focus();});
 const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);
 async function sample(phase){
  await pause(160);const s=await page.evaluate(()=>{const h=colorHost,r=h.renderer,w=Object.values(r.windows).find(w=>w.title?.startsWith('Color progress ')),p=w._backCanvas._waCanonicalPresentation;return {title:w.title,hwnd:w.hwnd,memoryBytes:h.memory.buffer.byteLength,rows:Object.values(r.windows).map(v=>({hwnd:v.hwnd,title:v.title,x:v.x,y:v.y,w:v.w,h:v.h,isChild:v.isChild,visible:v.visible})),gdi:p?{shared:p.surface.storage.buffer===h.memory.buffer,pixels:Array.from(p.surface.rgbaRect(0,0,w.w,w.h))}:null,pixels:Array.from(w._backCanvas.getContext('2d').getImageData(0,0,w.w,w.h).data),width:w.w,height:w.h,canvas:r.canvas.getBoundingClientRect().toJSON()};});
  const pointer=Number(s.title.split(' ').at(-1));
  const state=await cpu.evaluate(({pointer,count,stride,frame})=>{const e=instance.exports,names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,registers:Object.fromEntries(names.map(n=>[n,e[n]()>>>0])),client:{x:e.wnd_client_screen_x(frame),y:e.wnd_client_screen_y(frame)},results:Array.from({length:count},(_,j)=>{const at=pointer+j*stride,n=Array.from({length:64},(_,k)=>e.guest_read32(at+k*4)>>>0);return {n,cls:e.ctrl_get_class(n[14]),live:e.wnd_lookup_live(n[14]),progress:[0,1,2,3,4].map(f=>e.native_progress_get(n[14],f)>>>0),before:Array.from({length:64},(_,k)=>e.guest_read8(at+256+k)),after:Array.from({length:64},(_,k)=>e.guest_read8(at+320+k)),ignored:Array.from({length:64},(_,k)=>e.guest_read8(at+384+k))};})};},{pointer,count:cases.length,stride,frame:s.hwnd});
  assert.equal(state.memoryBytes,536870912);assert.equal(Object.keys(state.registers).length,19);assert(state.registers.get_eip&&state.registers.get_esp);
  const pix=Buffer.from(s.pixels),gdi=Buffer.from(s.gdi?.pixels||[]);assert(s.gdi?.shared);assert(pix.equals(gdi),'GDI shared surface matches backing canvas');
  await page.screenshot({path:out+'/'+phase+'-composited.png'});require(root+'/tools/browser-transients.cjs').captureWhole(out,phase+'-desktop',display.env);
  const {PNG}=require(root+'/node_modules/pngjs'),composite=PNG.sync.read(fs.readFileSync(out+'/'+phase+'-composited.png')),desktop=PNG.sync.read(fs.readFileSync(out+'/'+phase+'-desktop.png')),frame=s.rows.find(w=>w.hwnd===s.hwnd),surfaces=[];
  const color=v=>v===DEFAULT?null:[v&255,(v>>>8)&255,(v>>>16)&255,255];
  for(let j=0;j<cases.length;++j){const r=state.results[j],c=cases[j];assert.equal(r.cls,17);assert.equal(r.live,1);
   const b=s.rows.find(w=>w.hwnd===r.n[14]),x=b.x+state.client.x-frame.x,y=b.y+state.client.y-frame.y,bytes=Buffer.alloc(b.w*b.h*4);
   for(let row=0;row<b.h;++row)pix.copy(bytes,row*b.w*4,((y+row)*s.width+x)*4,((y+row)*s.width+x+b.w)*4);
   surfaces.push({x,y,w:b.w,h:b.h,bytes});
   const bar=phase==='before'?[0,0,128,255]:(color(c.bar)||[0,0,128,255]),bk=phase==='before'?[255,255,255,255]:(color(c.bk)||[255,255,255,255]);
   assert.deepEqual([b.w,b.h],c.vertical?[28,260]:[220,30]);
   let mismatch=0;for(let py=2;py<b.h-2;++py)for(let px=2;px<b.w-2;++px){const filled=c.vertical?py>=130:px<110,want=filled?bar:bk,at=(py*b.w+px)*4;
    if(!bytes.subarray(at,at+4).equals(Buffer.from(want)))++mismatch;}
   if(mismatch)failures.push({j,phase,kind:'independent constant color reference',mismatch});
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
 await sample('before');assert.deepEqual(failures,[],'preedit default reference must pass');await page.keyboard.press('q');
 await page.waitForFunction(()=>Object.values(colorHost.renderer.windows).some(w=>w.title?.startsWith('Color progress AFTER ')),{timeout:10000});
 const state=await sample('after');
 for(let j=0;j<cases.length;++j){const c=cases[j],r=state.results[j],want=[DEFAULT,DEFAULT,0x234567,0x987654,c.bar,c.bk];
  if(!r.n.slice(0,6).every((v,k)=>v===want[k]))failures.push({j,kind:'previous-color replies',got:r.n.slice(0,6),want});
  if(c.recreate&&(r.n[18]!==DEFAULT||r.n[19]!==DEFAULT))failures.push({j,kind:'recreation default reset',got:r.n.slice(18,20)});
  for(const [a,b]of [[6,7],[8,9],[10,11],[12,13],[21,22]])assert.equal(r.n[a],r.n[b],'preserve field '+a+' '+j);
  assert.equal(r.n[21],0,'no parent notifications');assert.deepEqual(r.n.slice(27,31),r.n.slice(31,35),'layout unchanged');
  assert.deepEqual(r.n.slice(35,39),[10,210,110,7]);assert.deepEqual(r.n.slice(39,43),[10,210,110,7]);
  assert.deepEqual(r.before,r.after,'text and canaries unchanged');assert(Buffer.from(r.ignored).equals(Buffer.alloc(64,0xa5)));
  assert.deepEqual(r.progress,[1,10,210,110,7]);
 }
 await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));
 save('assertions.json',{expectOld,failures,cases:cases.length,productionBrowserCPU:true,independentConstantReferences:cases.length*2});
 if(expectOld){assert(failures.some(f=>f.kind==='previous-color replies'));assert(failures.some(f=>f.phase==='after'));console.log('PASS physical preedit oldFAIL',failures.length);}else{assert.deepEqual(failures,[]);console.log('PASS classic progress custom colors/default reset/previous colors and four planes',cases.length);}

 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('transients.json',await transient.cleanup(out));if(display)await display.close();}
}
if(require.main===module){const out=process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync(require('node:os').tmpdir()+'/progress-custom-colors-');main(out,{expectOld:process.argv.includes('--expect-old')}).catch(e=>{console.error(e.stack);process.exitCode=1;});}
module.exports={cases,fixture,main};
