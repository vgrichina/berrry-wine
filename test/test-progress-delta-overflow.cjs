'use strict';
// Microsoft primary contracts, accessed 2026-11-21:
// https://learn.microsoft.com/en-us/windows/win32/controls/pbm-deltapos
// https://learn.microsoft.com/en-us/cpp/mfc/manipulating-the-progress-control
// https://learn.microsoft.com/en-us/cpp/mfc/reference/cprogressctrl-class
// OffsetPos(int) accepts negative values, clamps, and returns previous position.
// PBM_DELTAPOS specifies nearest boundary and lParam=0. No STEPIT assertion.
// Authored PE runs public messages on the actual production browser CPU.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
// Signed64 mathematical oracle: every input is a representable signed32 value.
// Deliberately narrow ranges isolate addition from unrelated paint multiplication.
const cases=[
 [0,100,50,2147483647],[-100,0,-50,-2147483648],
 [2147483547,2147483647,2147483597,2147483647],
 [-2147483648,-2147483548,-2147483598,-2147483648],
 [0,100,25,12],[0,100,75,-12],[0,100,50,0],
 [0,100,90,20],[-100,0,-90,-20],
 [2147483547,2147483647,2147483640,7],
 [-2147483648,-2147483548,-2147483640,-8],
 [-100,100,-50,100],[-100,100,50,-100]
];
function sum(j){return BigInt(cases[j][2])+BigInt(cases[j][3]);}
function position(j){const [lo,hi]=cases[j],s=sum(j);return Number(s<BigInt(lo)?BigInt(lo):s>BigInt(hi)?BigInt(hi):s);}
function expected(j){const [lo,hi,pos]=cases[j];return [j,pos>>>0,position(j)>>>0,lo>>>0,hi>>>0,lo>>>0,lo>>>0,hi>>>0,hi>>>0,lo>>>0,hi>>>0,position(j)>>>0];}
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
long API DialogBoxIndirectParamA(P,const void*,P,P,long);long API SendMessageA(P,U,U,long);int API SetWindowTextA(P,const char*);
static int cases[13][5]=CASES;
static unsigned short dialog[256];static char text[512];
void number(U n,int* at){char d[12];int k=0;do{d[k++]='0'+n%10;n/=10;}while(n);while(k)text[(*at)++]=d[--k];text[(*at)++]=' ';}
long __stdcall proc(P h,U m,U w,long l){if(m!=0x110)return 0;P inst=GetModuleHandleA(0);
 for(int j=0;j<13;++j){int* c=cases[j];
  P b=CreateWindowExA(0,"msctls_progress32","",0x50000000,12,12+j*32,180,18,h,(P)(100+j),inst,0);
  P ref=CreateWindowExA(0,"msctls_progress32","",0x50000000,202,12+j*32,180,18,h,(P)(200+j),inst,0);
  SendMessageA(b,0x406,c[0],c[1]);SendMessageA(ref,0x406,c[0],c[1]);
  SendMessageA(b,0x402,c[2],0);SendMessageA(ref,0x402,c[4],0);
  int at=0;int range[2];number(j,&at);
  number(SendMessageA(b,0x403,c[3],0),&at);
  number(SendMessageA(b,0x408,0,0),&at);
  number(SendMessageA(b,0x407,1,0),&at);number(SendMessageA(b,0x407,0,0),&at);
  number(SendMessageA(b,0x407,1,(long)range),&at);number(range[0],&at);number(range[1],&at);
  number(SendMessageA(b,0x407,0,(long)range),&at);number(range[0],&at);number(range[1],&at);
  number(SendMessageA(b,0x408,0,0),&at);text[at]=0;
  CreateWindowExA(0,"STATIC",text,0x50000000,392,12+j*32,230,24,h,(P)(300+j),inst,0);
 }
 SetWindowTextA(h,"Authored progress delta overflow READY");return 1;
}
void start(void){U* d=(U*)dialog;d[0]=0x90c80000;d[1]=0;dialog[4]=0;dialog[5]=20;dialog[6]=20;dialog[7]=440;dialog[8]=300;
 dialog[9]=0;dialog[10]=0;dialog[11]='P';dialog[12]=0;
 DialogBoxIndirectParamA(GetModuleHandleA(0),dialog,0,proc,0);for(;;){} }
`.replace('CASES','{'+cases.map((v,j)=>'{'+[...v,position(j)].join(',')+'}').join(',')+'}');
function fixture(out){
 fs.writeFileSync(out+'/fixture.c',source);
 for(const [dll,names]of Object.entries({kernel32:['GetModuleHandleA@4'],user32:['CreateWindowExA@48','DialogBoxIndirectParamA@20','SendMessageA@16','SetWindowTextA@8']})){
  fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/fixture.c','-o',out+'/fixture.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/progress-delta-overflow.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib']);return fs.readFileSync(out+'/progress-delta-overflow.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n');
 const runtime=require(root+'/tools/boids-current-runtime.cjs'),commit=process.env.PROGRESS_DELTA_COMMIT||cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files=runtime.gitFiles(commit);
 const own='src/09c3-controls0-basic-wndprocs.wat';files.set(own,expectOld?cp.execFileSync('git',['show',commit+':'+own],{cwd:root}):fs.readFileSync(root+'/'+own));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{maxBuffer:8e6}));
 const wasm=runtime.compile(files);fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));const pe=fixture(out);files.set('build/wine-assembly.wasm',wasm);files.set('progress-delta-overflow.exe',pe);
 save('runtime.json',{commit,expectOld,moduleSHA256:sha(wasm),peSHA256:sha(pe),cases,files:[...files].map(([name,b])=>({name,size:b.length,sha256:sha(b)}))});
 const transient=require(root+'/tools/browser-transients.cjs').create(),logs=[],pending=[],workers=[];let display,browser,wait,server;
 try{
  server=http.createServer((req,res)=>{const n=new URL(req.url,'http://local').pathname.slice(1)||'index.html',b=files.get(n);res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.html')?'text/html':n.endsWith('.css')?'text/css':n.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.statusCode=b?200:404;res.end(b||'missing');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  display=await require(root+'/tools/gltron-headful-display.cjs').start(out);
  browser=await require(root+'/node_modules/puppeteer').launch({headless:false,defaultViewport:{width:1050,height:800},env:transient.env(display.env),userDataDir:transient.profile,executablePath:'/opt/google/chrome/chrome',args:[...transient.args,'--no-sandbox','--disable-dev-shm-usage','--disable-component-update','--disable-background-networking'],protocolTimeout:20000});wait=transient.watch(browser.process());browser.process().stdout?.resume();browser.process().stderr?.resume();save('browser-version.json',{version:await browser.version()});
  const page=await browser.newPage();page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>logs.push(String(e)));
  page.on('workercreated',w=>{const row={url:w.url(),modules:[]};workers.push(row);const c=w.client;c.on('Debugger.scriptParsed',v=>{if(v.scriptLanguage==='WebAssembly'||v.url.startsWith('wasm://'))pending.push(c.send('Debugger.getScriptSource',{scriptId:v.scriptId}).then(r=>row.modules.push(sha(Buffer.from(r.bytecode,'base64')))));});pending.push(c.send('Debugger.enable'));});
  await page.evaluateOnNewDocument(()=>localStorage.setItem('wine-assembly.threads','1'));await page.goto('http://127.0.0.1:'+server.address().port+'/?debug&threads&no-log');await page.waitForFunction(()=>typeof WineAssembly==='function');
  await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=650;c.style='position:fixed;left:0;top:0;z-index:99999;width:1000px;height:650px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.progressHost=new WineAssembly();progressHost.renderer=new Win98Renderer(c);await progressHost.init(c);if(!progressHost.guestWorker)throw Error('production Worker required');await progressHost.loadExe('/progress-delta-overflow.exe');progressHost.run();});
  await page.waitForFunction(()=>Object.values(progressHost.renderer.windows).some(w=>w.title==='Authored progress delta overflow READY'),{timeout:15000});
  await new Promise(r=>setTimeout(r,250));
  const s=await page.evaluate(()=>{const h=progressHost,r=h.renderer,w=Object.values(r.windows).find(w=>w.title==='Authored progress delta overflow READY'),p=w._backCanvas._waCanonicalPresentation;return {memoryBytes:h.memory.buffer.byteLength,rows:Object.values(r.windows).map(v=>({hwnd:v.hwnd,parent:v.parent,title:v.title,x:v.x,y:v.y,w:v.w,h:v.h,visible:v.visible,isChild:v.isChild})),gdi:p?{sharedGuestStorage:p.surface.storage.buffer===h.memory.buffer,pixels:Array.from(p.surface.rgbaRect(0,0,w.w,w.h))}:null,pixels:Array.from(w._backCanvas.getContext('2d').getImageData(0,0,w.w,w.h).data),width:w.w,height:w.h,canvas:r.canvas.getBoundingClientRect().toJSON()};});
  const frame=s.rows.find(w=>w.title==='Authored progress delta overflow READY'),bars=cases.map((_,j)=>s.rows.find(w=>w.isChild&&w.x===12&&w.y===12+j*32));assert(bars.every(Boolean));
  const refs=cases.map((_,j)=>s.rows.find(w=>w.isChild&&w.x===202&&w.y===12+j*32));assert(refs.every(Boolean));
  const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);
  const cpuState=await cpu.evaluate(({handles,frame})=>{const e=instance.exports,names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,frameClient:{x:e.wnd_client_screen_x(frame),y:e.wnd_client_screen_y(frame)},registers:Object.fromEntries(names.map(n=>[n,e[n]()>>>0])),controls:handles.map(h=>({hwnd:h,cls:e.ctrl_get_class(h),live:e.wnd_lookup_live(h),state:[0,1,2,3,4].map(f=>e.native_progress_get(h,f))}))};},{handles:bars.map(b=>b.hwnd),frame:frame.hwnd});
  save('cpu-state.json',cpuState);assert.equal(cpuState.memoryBytes,536870912);assert.equal(Object.keys(cpuState.registers).length,19);assert(cpuState.registers.get_eip&&cpuState.registers.get_esp);
  fs.writeFileSync(out+'/observed-scene.json.gz',zlib.gzipSync(Buffer.from(JSON.stringify(s))));
  await page.screenshot({path:out+'/composited.png'});require(root+'/tools/browser-transients.cjs').captureWhole(out,'desktop',display.env);
  const failures=[],results=[],pix=Buffer.from(s.pixels),gd=Buffer.from(s.gdi?.pixels||[]);assert(s.gdi?.sharedGuestStorage,'canonical GDI must use actual guest memory');
  const surfaces=[];
  for(let j=0;j<cases.length;++j){const c=cases[j],b=bars[j],got=s.rows.find(w=>w.isChild&&w.x===392&&w.y===12+j*32)?.title.trim().split(/\s+/).map(Number),want=expected(j);
   if(!got||!want.every((v,i)=>got[i]===v)||got.length!==want.length)failures.push({j,got,want});
   assert.equal(cpuState.controls[j].cls,17);assert.equal(cpuState.controls[j].live,1);
   assert.deepEqual(cpuState.controls[j].state.slice(0,3),[1,c[0],c[1]]);
   assert.equal(cpuState.controls[j].state[4],10);
   const crops=[];
   for(const item of [b,refs[j]]){
    const x=item.x+cpuState.frameClient.x-frame.x,y=item.y+cpuState.frameClient.y-frame.y,w=item.w,h=item.h,bytes=Buffer.alloc(w*h*4);
    for(let row=0;row<h;++row){const at=((y+row)*s.width+x)*4;pix.copy(bytes,row*w*4,at,at+w*4);assert(pix.subarray(at,at+w*4).equals(gd.subarray(at,at+w*4)),'GDI and backcanvas agree');}
    surfaces.push({x,y,w,h,bytes});crops.push(bytes);
   }
   const fill=Number((BigInt(position(j))-BigInt(c[0]))*BigInt(b.w-4)/(BigInt(c[1])-BigInt(c[0])));
   for(let yy=2;yy<b.h-2;++yy)for(let xx=2;xx<b.w-2;++xx){const rgba=xx<2+fill?[0,0,128,255]:[255,255,255,255],at=(yy*b.w+xx)*4;assert.deepEqual(Array.from(crops[1].subarray(at,at+4)),rgba,'constant reference pixels '+j);}
   const equal=crops[0].equals(crops[1]);if(!equal)failures.push({j,visual:false});
   results.push({j,got,want,signed64Sum:sum(j).toString(),position:position(j),fill,constantReferenceEqual:equal});
  }
  const {PNG}=require(root+'/node_modules/pngjs'),composite=PNG.sync.read(fs.readFileSync(out+'/composited.png')),desktop=PNG.sync.read(fs.readFileSync(out+'/desktop.png'));
  const match=(png,v,ox,oy)=>{const x=Math.round(ox+v.x),y=Math.round(oy+v.y);if(x<0||y<0||x+v.w>png.width||y+v.h>png.height)return false;for(let row=0;row<v.h;++row)if(!png.data.subarray(((y+row)*png.width+x)*4,((y+row)*png.width+x+v.w)*4).equals(v.bytes.subarray(row*v.w*4,(row+1)*v.w*4)))return false;return true;};
  assert(surfaces.every(v=>match(composite,v,s.canvas.x+frame.x,s.canvas.y+frame.y)),'compositor exact progress surfaces');
  const first=surfaces[0],needle=first.bytes.subarray(8*first.w*4,9*first.w*4);let origin=null;for(let at=desktop.data.indexOf(needle);at>=0;at=desktop.data.indexOf(needle,at+1)){if(at%4)continue;const ox=at/4%desktop.width-first.x,oy=Math.floor(at/4/desktop.width)-first.y-8;if(surfaces.every(v=>match(desktop,v,ox,oy))){origin={x:ox,y:oy};break;}}assert(origin,'native desktop exact progress surfaces');
  save('visible.json',{origin,exactCompositor:true,exactNativeDesktop:true,surfaces:surfaces.map(({bytes,...v})=>({...v,sha256:sha(bytes)}))});
  s.gdi.sha256=sha(gd);delete s.gdi.pixels;delete s.pixels;save('scene.json',s);
  await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));
  save('assertions.json',{expectOld,failures,results,productionBrowserCPU:true});
  if(expectOld){assert.deepEqual(failures.filter(f=>f.got).map(f=>f.j),[0,1,2,3]);assert.deepEqual(failures.filter(f=>f.visual===false).map(f=>f.j),[0,1,2,3]);console.log('PASS supported preedit oldFAIL 4 public + 4 visual');}else{assert.deepEqual(failures,[]);console.log('PASS signed delta return/GETPOS/GETRANGE and constant references on GDI/backcanvas/compositor/native',cases.length);}

 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('transients.json',await transient.cleanup(out));if(display)await display.close();}
}
if(require.main===module)main(process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync(require('node:os').tmpdir()+'/progress-delta-overflow-return-'),{expectOld:process.argv.includes('--expect-old')}).catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={cases,sum,position,expected,fixture,main};


