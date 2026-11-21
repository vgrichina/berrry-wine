'use strict';
// Microsoft primary contracts (accessed 2026-11-21):
// https://learn.microsoft.com/en-us/windows/win32/controls/pbm-getpos
// https://learn.microsoft.com/en-us/windows/win32/controls/pbm-getrange
// https://learn.microsoft.com/en-us/windows/win32/api/commctrl/ns-commctrl-pbrange
// GETPOS returns UINT. GETRANGE returns INT: TRUE low, FALSE high;
// optional PBRANGE is { int iLow; int iHigh; }. Current requirement tables
// list Vista / Server 2003; no earlier historical support claim.
// Authored PE sends only public messages on the production browser CPU.
// Independent constants check replies, both output selectors, NULL output,
// adjacent sentinel words and unchanged range/position. No STEPIT wrap claim.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const cases=[
 // low, high, position, range setter (0 keeps the default range)
 [0,100,0,0], [0,100,37,0], [20,120,65,0x401],
 [70000,170000,120000,0x406], [-200,300,50,0x406],
 [-70000,-20000,-45000,0x406], [10,210,81,0x406]
];
const sentinel=[0xa1b2c3d4,0x12345678,0x76543210,0x87654321,0xdeadbeef,0x13579bdf];
function expected(j){const [lo,hi,pos]=cases[j],a=[...sentinel];a[2]=lo>>>0;a[3]=hi>>>0;
 return [j,pos>>>0,lo>>>0,hi>>>0,lo>>>0,...a,hi>>>0,...a,pos>>>0,pos>>>0,((lo&65535)|((hi&65535)<<16))>>>0,pos>>>0,lo>>>0,hi>>>0];
}
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
long API DialogBoxIndirectParamA(P,const void*,P,P,long);long API SendMessageA(P,U,U,long);int API SetWindowTextA(P,const char*);
static int cases[7][4]=CASES;
static unsigned short dialog[256];static P bars[7];static char text[512];
void number(U n,int* at){char d[12];int k=0;do{d[k++]='0'+n%10;n/=10;}while(n);while(k)text[(*at)++]=d[--k];text[(*at)++]=' ';}
long __stdcall proc(P h,U m,U w,long l){if(m!=0x110)return 0;P inst=GetModuleHandleA(0);
 for(int j=0;j<7;++j){int* c=cases[j];P b=bars[j]=CreateWindowExA(0,"msctls_progress32","",0x50000000,12,12+j*42,220,18,h,(P)(100+j),inst,0);
  if(c[3])SendMessageA(b,c[3],c[3]==0x401?0:c[0],c[3]==0x401?((c[0]&65535)|(c[1]<<16)):c[1]);
  if(j)SendMessageA(b,0x402,c[2],0);
  int at=0;U a[6];number(j,&at);
  number(SendMessageA(b,0x408,0,0),&at);
  number(SendMessageA(b,0x407,1,0),&at);number(SendMessageA(b,0x407,0,0),&at);
  for(int selector=1;selector>=0;--selector){
   a[0]=0xa1b2c3d4;a[1]=0x12345678;a[2]=0x76543210;a[3]=0x87654321;a[4]=0xdeadbeef;a[5]=0x13579bdf;
   number(SendMessageA(b,0x407,selector,(long)&a[2]),&at);
   for(int k=0;k<6;++k)number(a[k],&at);
   if(selector){text[at]=0;CreateWindowExA(0,"STATIC",text,0x50000000,242,12+j*42,330,20,h,(P)(300+j),inst,0);at=0;}
  }
  number(SendMessageA(b,0x408,0,0),&at);
  number(SendMessageA(b,0x402,c[2],0),&at);
  number(SendMessageA(b,0x406,c[0],c[1]),&at);
  number(SendMessageA(b,0x408,0,0),&at);
  number(SendMessageA(b,0x407,1,0),&at);number(SendMessageA(b,0x407,0,0),&at);text[at]=0;
  CreateWindowExA(0,"STATIC",text,0x50000000,242,32+j*42,330,20,h,(P)(200+j),inst,0);
 }
 SetWindowTextA(h,"Authored progress public getters READY");return 1;
}
void start(void){U* d=(U*)dialog;d[0]=0x90c80000;d[1]=0;dialog[4]=0;dialog[5]=20;dialog[6]=20;dialog[7]=400;dialog[8]=200;
 dialog[9]=0;dialog[10]=0;dialog[11]='P';dialog[12]=0;
 DialogBoxIndirectParamA(GetModuleHandleA(0),dialog,0,proc,0);for(;;){} }
`.replace('CASES','{'+cases.map(v=>'{'+v.join(',')+'}').join(',')+'}');
function fixture(out){
 fs.writeFileSync(out+'/fixture.c',source);
 for(const [dll,names]of Object.entries({kernel32:['GetModuleHandleA@4'],user32:['CreateWindowExA@48','DialogBoxIndirectParamA@20','SendMessageA@16','SetWindowTextA@8']})){
  fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/fixture.c','-o',out+'/fixture.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/progress-public-getters.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib']);return fs.readFileSync(out+'/progress-public-getters.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n');
 const runtime=require(root+'/tools/boids-current-runtime.cjs'),commit=process.env.PROGRESS_GETTERS_COMMIT||cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files=runtime.gitFiles(commit);
 const own='src/09c3-controls0-basic-wndprocs.wat';files.set(own,expectOld?cp.execFileSync('git',['show',commit+':'+own],{cwd:root}):fs.readFileSync(root+'/'+own));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{maxBuffer:8e6}));
 const wasm=runtime.compile(files);fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));const pe=fixture(out);files.set('build/wine-assembly.wasm',wasm);files.set('progress-public-getters.exe',pe);
 save('runtime.json',{commit,expectOld,moduleSHA256:sha(wasm),peSHA256:sha(pe),cases,files:[...files].map(([name,b])=>({name,size:b.length,sha256:sha(b)}))});
 const transient=require(root+'/tools/browser-transients.cjs').create(),logs=[],pending=[],workers=[];let display,browser,wait,server;
 try{
  server=http.createServer((req,res)=>{const n=new URL(req.url,'http://local').pathname.slice(1)||'index.html',b=files.get(n);res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.html')?'text/html':n.endsWith('.css')?'text/css':n.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.statusCode=b?200:404;res.end(b||'missing');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  display=await require(root+'/tools/gltron-headful-display.cjs').start(out);
  browser=await require(root+'/node_modules/puppeteer').launch({headless:false,defaultViewport:{width:1050,height:800},env:transient.env(display.env),userDataDir:transient.profile,executablePath:'/opt/google/chrome/chrome',args:[...transient.args,'--no-sandbox','--disable-dev-shm-usage','--disable-component-update','--disable-background-networking'],protocolTimeout:20000});wait=transient.watch(browser.process());browser.process().stdout?.resume();browser.process().stderr?.resume();save('browser-version.json',{version:await browser.version()});
  const page=await browser.newPage();page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>logs.push(String(e)));
  page.on('workercreated',w=>{const row={url:w.url(),modules:[]};workers.push(row);const c=w.client;c.on('Debugger.scriptParsed',v=>{if(v.scriptLanguage==='WebAssembly'||v.url.startsWith('wasm://'))pending.push(c.send('Debugger.getScriptSource',{scriptId:v.scriptId}).then(r=>row.modules.push(sha(Buffer.from(r.bytecode,'base64')))));});pending.push(c.send('Debugger.enable'));});
  await page.evaluateOnNewDocument(()=>localStorage.setItem('wine-assembly.threads','1'));await page.goto('http://127.0.0.1:'+server.address().port+'/?debug&threads&no-log');await page.waitForFunction(()=>typeof WineAssembly==='function');
  await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=650;c.style='position:fixed;left:0;top:0;z-index:99999;width:1000px;height:650px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.progressHost=new WineAssembly();progressHost.renderer=new Win98Renderer(c);await progressHost.init(c);if(!progressHost.guestWorker)throw Error('production Worker required');await progressHost.loadExe('/progress-public-getters.exe');progressHost.run();});
  await page.waitForFunction(()=>Object.values(progressHost.renderer.windows).some(w=>w.title==='Authored progress public getters READY'),{timeout:15000});
  await new Promise(r=>setTimeout(r,250));
  const s=await page.evaluate(()=>{const h=progressHost,r=h.renderer,w=Object.values(r.windows).find(w=>w.title==='Authored progress public getters READY'),p=w._backCanvas._waCanonicalPresentation;return {memoryBytes:h.memory.buffer.byteLength,rows:Object.values(r.windows).map(v=>({hwnd:v.hwnd,parent:v.parent,title:v.title,x:v.x,y:v.y,w:v.w,h:v.h,visible:v.visible,isChild:v.isChild})),gdi:p?{sharedGuestStorage:p.surface.storage.buffer===h.memory.buffer,pixels:Array.from(p.surface.rgbaRect(0,0,w.w,w.h))}:null,pixels:Array.from(w._backCanvas.getContext('2d').getImageData(0,0,w.w,w.h).data),width:w.w,height:w.h,canvas:r.canvas.getBoundingClientRect().toJSON()};});
  const frame=s.rows.find(w=>w.title==='Authored progress public getters READY'),bars=cases.map((_,j)=>s.rows.find(w=>w.isChild&&w.x===12&&w.y===12+j*42));assert(bars.every(Boolean));
  const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);
  const cpuState=await cpu.evaluate(({handles,frame})=>{const e=instance.exports,names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,frameClient:{x:e.wnd_client_screen_x(frame),y:e.wnd_client_screen_y(frame)},registers:Object.fromEntries(names.map(n=>[n,e[n]()>>>0])),controls:handles.map(h=>({hwnd:h,cls:e.ctrl_get_class(h),live:e.wnd_lookup_live(h),state:[0,1,2,3,4].map(f=>e.native_progress_get(h,f))}))};},{handles:bars.map(b=>b.hwnd),frame:frame.hwnd});
  save('cpu-state.json',cpuState);assert.equal(cpuState.memoryBytes,536870912);assert.equal(Object.keys(cpuState.registers).length,19);assert(cpuState.registers.get_eip&&cpuState.registers.get_esp);
  fs.writeFileSync(out+'/observed-scene.json.gz',zlib.gzipSync(Buffer.from(JSON.stringify(s))));
  await page.screenshot({path:out+'/composited.png'});require(root+'/tools/browser-transients.cjs').captureWhole(out,'desktop',display.env);
  const failures=[],results=[],pix=Buffer.from(s.pixels),gd=Buffer.from(s.gdi?.pixels||[]);assert(s.gdi?.sharedGuestStorage,'canonical GDI must use actual guest memory');
  const surfaces=[];
  for(let j=0;j<cases.length;++j){const c=cases[j],b=bars[j],got=[12,32].flatMap(y=>s.rows.find(w=>w.isChild&&w.x===242&&w.y===y+j*42)?.title.trim().split(/\s+/).map(Number)||[]),want=expected(j);
   if(!got||!want.every((v,i)=>got[i]===v)||got.length!==want.length)failures.push({j,got,want});
   assert.deepEqual(cpuState.controls[j],{hwnd:b.hwnd,cls:17,live:1,state:[1,c[0],c[1],c[2],10]});
   // Child coordinates are client-relative; frame backing includes its native
   // dialog non-client inset. Derive it from the actual child presentation.
   const x=b.x+cpuState.frameClient.x-frame.x,y=b.y+cpuState.frameClient.y-frame.y,w=b.w,h=b.h,bytes=Buffer.alloc(w*h*4),fill=Math.floor((c[2]-c[0])*(w-4)/(c[1]-c[0]));
   for(let row=0;row<h;++row){const at=((y+row)*s.width+x)*4;pix.copy(bytes,row*w*4,at,at+w*4);assert(pix.subarray(at,at+w*4).equals(gd.subarray(at,at+w*4)),'GDI and backingcanvas agree');}
   let probes=0;for(let yy=2;yy<h-2;++yy)for(let xx=2;xx<w-2;++xx){const rgba=xx<2+fill?[0,0,128,255]:[255,255,255,255],at=(yy*w+xx)*4;assert.deepEqual(Array.from(bytes.subarray(at,at+4)),rgba,'independent fill pixels case '+j+' '+xx+','+yy);++probes;}
   surfaces.push({x,y,w,h,bytes});results.push({j,got,want,fill,probes});
  }
  const {PNG}=require(root+'/node_modules/pngjs'),composite=PNG.sync.read(fs.readFileSync(out+'/composited.png')),desktop=PNG.sync.read(fs.readFileSync(out+'/desktop.png'));
  const match=(png,v,ox,oy)=>{const x=Math.round(ox+v.x),y=Math.round(oy+v.y);if(x<0||y<0||x+v.w>png.width||y+v.h>png.height)return false;for(let row=0;row<v.h;++row)if(!png.data.subarray(((y+row)*png.width+x)*4,((y+row)*png.width+x+v.w)*4).equals(v.bytes.subarray(row*v.w*4,(row+1)*v.w*4)))return false;return true;};
  assert(surfaces.every(v=>match(composite,v,s.canvas.x+frame.x,s.canvas.y+frame.y)),'compositor exact progress surfaces');
  const first=surfaces[0],needle=first.bytes.subarray(8*first.w*4,9*first.w*4);let origin=null;for(let at=desktop.data.indexOf(needle);at>=0;at=desktop.data.indexOf(needle,at+1)){if(at%4)continue;const ox=at/4%desktop.width-first.x,oy=Math.floor(at/4/desktop.width)-first.y-8;if(surfaces.every(v=>match(desktop,v,ox,oy))){origin={x:ox,y:oy};break;}}assert(origin,'native desktop exact progress surfaces');
  save('visible.json',{origin,exactCompositor:true,exactNativeDesktop:true,surfaces:surfaces.map(({bytes,...v})=>({...v,sha256:sha(bytes)}))});
  s.gdi.sha256=sha(gd);delete s.gdi.pixels;delete s.pixels;save('scene.json',s);
  await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));
  save('assertions.json',{expectOld,failures,results,productionBrowserCPU:true});
  if(expectOld){assert.equal(failures.length,cases.length,'all PBRANGE output buffers must reproduce oldFAIL');assert(failures.every(f=>f.got[7]===sentinel[2]&&f.got[8]===sentinel[3]));console.log('PASS supported preedit oldFAIL',failures.length);}else{assert.deepEqual(failures,[]);console.log('PASS progress public getters, sentinel bounds, stable range/position and GDI/backing/compositor/native pixels',cases.length);}
 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('transients.json',await transient.cleanup(out));if(display)await display.close();}
}
if(require.main===module)main(process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync(require('node:os').tmpdir()+'/progress-public-getters-return-'),{expectOld:process.argv.includes('--expect-old')}).catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={cases,expected,fixture,main};

