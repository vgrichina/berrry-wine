'use strict';
// Microsoft primary FIRST (2026-11-21):
// https://learn.microsoft.com/en-us/windows/win32/controls/pbm-setrange32
// https://learn.microsoft.com/en-us/windows/win32/api/commctrl/ns-commctrl-pbrange
// https://learn.microsoft.com/en-us/windows/win32/controls/pbm-setpos
// Signed32 limits and position are documented; proportional fill and the
// constant RGBA 2px inset/bevel are this emulator's existing painter contract,
// NOT a Windows pixel oracle. No sibling/candidate reference surfaces.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
// x,y,width,height,style,low,high,position,resize via public MoveWindow(TRUE).
const cases=[
 // Independent large signed range families: min, quarter, half, max.
 [12,12,180,20,0,1000000000,2000000000,1000000000,0],
 [222,12,180,20,0,1000000000,2000000000,1250000000,0],
 [432,12,180,20,0,1000000000,2000000000,1500000000,0],
 [642,12,180,20,0,1000000000,2000000000,2000000000,0],
 [12,56,180,20,0,-2000000000,-1000000000,-2000000000,0],
 [222,56,180,20,0,-2000000000,-1000000000,-1750000000,0],
 [432,56,180,20,0,-2000000000,-1000000000,-1500000000,0],
 [642,56,180,20,0,-2000000000,-1000000000,-1000000000,0],
 [12,100,180,20,0,-1500000000,1500000000,-1500000000,0],
 [222,100,180,20,0,-1500000000,1500000000,-750000000,0],
 [432,100,180,20,0,-1500000000,1500000000,0,0],
 [642,100,180,20,0,-1500000000,1500000000,1500000000,0],
 [12,144,180,20,0,-2147483648,2147483647,-2147483648,0],
 [222,144,180,20,0,-2147483648,2147483647,-1073741824,0],
 [432,144,180,20,0,-2147483648,2147483647,0,0],
 [642,144,180,20,0,-2147483648,2147483647,2147483647,0],
 // Ordinary pixels and the vertical branch must remain identical.
 [12,210,180,18,0,20,120,20,0],[222,210,180,18,0,20,120,45,0],
 [432,210,180,18,0,20,120,70,0],[642,210,180,18,0,20,120,120,0],
 [12,270,20,116,4,-2147483648,2147483647,-2147483648,0],
 [72,270,20,116,4,-2147483648,2147483647,-1073741824,0],
 [132,270,20,116,4,-2147483648,2147483647,0,0],
 [192,270,20,116,4,-2147483648,2147483647,2147483647,0],
 [300,270,192,26,0,0,1000000000,750000000,1],
 [530,270,205,15,0,-2147483648,2147483647,1073741824,1],
 // Empty interiors in either dimension, with nonzero/full positions.
 [12,440,1,18,0,0,1000000000,1000000000,0],
 [52,440,2,18,0,0,1000000000,1000000000,0],
 [92,440,3,18,0,0,1000000000,1000000000,0],
 [132,440,4,18,0,0,1000000000,1000000000,0],
 [222,440,120,1,0,-2147483648,2147483647,0,0],
 [382,440,120,2,0,-2147483648,2147483647,0,0],
 [542,440,120,3,0,-2147483648,2147483647,0,0],
 [702,440,120,4,0,-2147483648,2147483647,0,0]
];
function expected(j){const c=cases[j],lo=c[5],hi=c[6],pos=c[7];return [j,6553600,Math.min(hi,Math.max(0,lo))>>>0,10,7,pos>>>0,Math.min(hi,pos+1)>>>0,pos>>>0,lo>>>0,hi>>>0,lo>>>0,lo>>>0,hi>>>0,hi>>>0,lo>>>0,hi>>>0,pos>>>0,1];}
function reference(c){
 const [,,w,h,style,lo,hi,pos]=c,vertical=Boolean(style&4);
 const extent=vertical?h-4:w-4;
 // Exact integer rational, no signed32 intermediate, independent of WAT.
 const fill=w>4&&h>4?Number((BigInt(pos)-BigInt(lo))*BigInt(extent)/(BigInt(hi)-BigInt(lo))):0;
 const bytes=Buffer.alloc(w*h*4);
 const white=[255,255,255,255],navy=[0,0,128,255];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  let rgba=white;
  if(x>=2&&x<w-2&&y>=2&&y<h-2&&(vertical?y>=h-2-fill:x<2+fill))rgba=navy;
  // Independent constant RGBA contract: horizontal edges precede sides;
  // left precedes right, including overlapping sides of tiny controls.
  for(let inset=0;inset<2;inset++){
   const right=w-1-inset,bottom=h-1-inset;
   const shadow=inset?[128,128,128,255]:[0,0,0,255];
   const light=inset?[192,192,192,255]:white;
   if(x>=inset&&x<=right){if(y===inset)rgba=shadow;if(y===bottom)rgba=light;}
   if(y>=inset&&y<=bottom){if(x===inset)rgba=shadow;if(x===right)rgba=light;}
  }
  bytes.set(rgba,(y*w+x)*4);
 }
 return {bytes,fill};
}
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
long API DialogBoxIndirectParamA(P,const void*,P,P,long);long API SendMessageA(P,U,U,long);int API SetWindowTextA(P,const char*);
int API MoveWindow(P,int,int,int,int,int);int API UpdateWindow(P);
static int cases[COUNT][9]=CASES;
static unsigned short dialog[256];static char text[512];
void number(U n,int* at){char d[12];int k=0;do{d[k++]='0'+n%10;n/=10;}while(n);while(k)text[(*at)++]=d[--k];text[(*at)++]=' ';}
long __stdcall proc(P h,U m,U w,long l){if(m!=0x110)return 0;P inst=GetModuleHandleA(0);
 for(int j=0;j<COUNT;++j){int* c=cases[j];
  P b=CreateWindowExA(0,"msctls_progress32","",0x50000000|c[4],c[0],c[1],c[8]?48:c[2],c[8]?32:c[3],h,(P)(100+j),inst,0);
  int at=0;int range[2];number(j,&at);
  number(SendMessageA(b,0x406,c[5],c[6]),&at);
  number(SendMessageA(b,0x402,c[7],0),&at);
  number(SendMessageA(b,0x404,7,0),&at);number(SendMessageA(b,0x404,7,0),&at);
  number(SendMessageA(b,0x403,1,0),&at);number(SendMessageA(b,0x402,c[7],0),&at);
  number(SendMessageA(b,0x408,0,0),&at);
  number(SendMessageA(b,0x407,1,0),&at);number(SendMessageA(b,0x407,0,0),&at);
  number(SendMessageA(b,0x407,1,(long)range),&at);number(range[0],&at);number(range[1],&at);
  number(SendMessageA(b,0x407,0,(long)range),&at);number(range[0],&at);number(range[1],&at);
  if(c[8]){UpdateWindow(b);number(MoveWindow(b,c[0],c[1],c[2],c[3],1),&at);}else number(1,&at);
  number(SendMessageA(b,0x408,0,0),&at);text[at]=0;
  CreateWindowExA(0,"STATIC",text,0x40000000,700,12+j*12,10,10,h,(P)(300+j),inst,0);
 }
 SetWindowTextA(h,"Authored horizontal overflow READY");return 1;
}
void start(void){U* d=(U*)dialog;d[0]=0x90c80000;d[1]=0;dialog[4]=0;dialog[5]=20;dialog[6]=20;dialog[7]=560;dialog[8]=365;
 dialog[9]=0;dialog[10]=0;dialog[11]='P';dialog[12]=0;
 DialogBoxIndirectParamA(GetModuleHandleA(0),dialog,0,proc,0);for(;;){} }
`.replaceAll('COUNT',String(cases.length)).replace('CASES','{'+cases.map(v=>'{'+v.join(',')+'}').join(',')+'}');
function fixture(out){
 fs.writeFileSync(out+'/fixture.c',source);
 for(const [dll,names]of Object.entries({kernel32:['GetModuleHandleA@4'],user32:['CreateWindowExA@48','DialogBoxIndirectParamA@20','SendMessageA@16','SetWindowTextA@8','MoveWindow@24','UpdateWindow@4']})){
  fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/fixture.c','-o',out+'/fixture.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/progress-horizontal-overflow.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib']);return fs.readFileSync(out+'/progress-horizontal-overflow.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n');
 const runtime=require(root+'/tools/boids-current-runtime.cjs'),commit=process.env.PROGRESS_HORIZONTAL_OVERFLOW_COMMIT||cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files=runtime.gitFiles(commit);
 const own='src/09c3-controls0-basic-wndprocs.wat';files.set(own,fs.readFileSync(root+'/'+own));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{maxBuffer:8e6}));
 if(process.env.PROGRESS_HORIZONTAL_OVERFLOW_SHARED)for(const n of files.keys())if(fs.existsSync(root+'/'+n))files.set(n,fs.readFileSync(root+'/'+n));
 const wasm=process.env.PROGRESS_HORIZONTAL_OVERFLOW_WASM?fs.readFileSync(process.env.PROGRESS_HORIZONTAL_OVERFLOW_WASM):runtime.compile(files);fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));const pe=fixture(out);files.set('build/wine-assembly.wasm',wasm);files.set('progress-horizontal-overflow.exe',pe);
 save('runtime.json',{commit,expectOld,moduleSHA256:sha(wasm),peSHA256:sha(pe),testSHA256:sha(fs.readFileSync(__filename)),cases,files:[...files].map(([name,b])=>({name,size:b.length,sha256:sha(b)}))});
 const transient=require(root+'/tools/browser-transients.cjs').create(),logs=[],pending=[],workers=[];let display,browser,wait,server;
 try{
  server=http.createServer((req,res)=>{const n=new URL(req.url,'http://local').pathname.slice(1)||'index.html',b=files.get(n);res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.html')?'text/html':n.endsWith('.css')?'text/css':n.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.statusCode=b?200:404;res.end(b||'missing');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  display=await require(root+'/tools/gltron-headful-display.cjs').start(out);
  browser=await require(root+'/node_modules/puppeteer').launch({headless:false,defaultViewport:{width:1050,height:800},env:transient.env(display.env),userDataDir:transient.profile,executablePath:'/opt/google/chrome/chrome',args:[...transient.args,'--no-sandbox','--disable-dev-shm-usage','--disable-component-update','--disable-background-networking'],protocolTimeout:20000});wait=transient.watch(browser.process());browser.process().stdout?.resume();browser.process().stderr?.resume();save('browser-version.json',{version:await browser.version()});
  const page=await browser.newPage();page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>logs.push(String(e)));
  page.on('workercreated',w=>{const row={url:w.url(),modules:[]};workers.push(row);const c=w.client;c.on('Debugger.scriptParsed',v=>{if(v.scriptLanguage==='WebAssembly'||v.url.startsWith('wasm://'))pending.push(c.send('Debugger.getScriptSource',{scriptId:v.scriptId}).then(r=>row.modules.push(sha(Buffer.from(r.bytecode,'base64')))));});pending.push(c.send('Debugger.enable'));});
  await page.evaluateOnNewDocument(()=>localStorage.setItem('wine-assembly.threads','1'));await page.goto('http://127.0.0.1:'+server.address().port+'/?debug&threads&no-log');await page.waitForFunction(()=>typeof WineAssembly==='function');
  await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=650;c.style='position:fixed;left:0;top:0;z-index:99999;width:1000px;height:650px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.progressHost=new WineAssembly();progressHost.renderer=new Win98Renderer(c);await progressHost.init(c);if(!progressHost.guestWorker)throw Error('production Worker required');await progressHost.loadExe('/progress-horizontal-overflow.exe');progressHost.run();});
  await page.waitForFunction(()=>Object.values(progressHost.renderer.windows).some(w=>w.title==='Authored horizontal overflow READY'),{timeout:15000});
  await new Promise(r=>setTimeout(r,250));
  const s=await page.evaluate(()=>{const h=progressHost,r=h.renderer,w=Object.values(r.windows).find(w=>w.title==='Authored horizontal overflow READY'),p=w._backCanvas._waCanonicalPresentation;return {memoryBytes:h.memory.buffer.byteLength,rows:Object.values(r.windows).map(v=>({hwnd:v.hwnd,parent:v.parent,title:v.title,x:v.x,y:v.y,w:v.w,h:v.h,visible:v.visible,isChild:v.isChild})),gdi:p?{sharedGuestStorage:p.surface.storage.buffer===h.memory.buffer,pixels:Array.from(p.surface.rgbaRect(0,0,w.w,w.h))}:null,pixels:Array.from(w._backCanvas.getContext('2d').getImageData(0,0,w.w,w.h).data),width:w.w,height:w.h,canvas:r.canvas.getBoundingClientRect().toJSON()};});
  const frame=s.rows.find(w=>w.title==='Authored horizontal overflow READY'),bars=cases.map(c=>s.rows.find(w=>w.isChild&&w.x===c[0]&&w.y===c[1]));assert(bars.every(Boolean));
  const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);
  const cpuState=await cpu.evaluate(({handles,frame})=>{const e=instance.exports,names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,frameClient:{x:e.wnd_client_screen_x(frame),y:e.wnd_client_screen_y(frame)},registers:Object.fromEntries(names.map(n=>[n,e[n]()>>>0])),controls:handles.map(h=>({hwnd:h,cls:e.ctrl_get_class(h),live:e.wnd_lookup_live(h),state:[0,1,2,3,4].map(f=>e.native_progress_get(h,f))}))};},{handles:bars.map(b=>b.hwnd),frame:frame.hwnd});
  save('cpu-state.json',cpuState);assert.equal(cpuState.memoryBytes,536870912);assert.equal(Object.keys(cpuState.registers).length,19);assert(cpuState.registers.get_eip&&cpuState.registers.get_esp);
  fs.writeFileSync(out+'/observed-scene.json.gz',zlib.gzipSync(Buffer.from(JSON.stringify(s))));
  await page.screenshot({path:out+'/composited.png'});require(root+'/tools/browser-transients.cjs').captureWhole(out,'desktop',display.env);
  const failures=[],results=[],pix=Buffer.from(s.pixels),gd=Buffer.from(s.gdi?.pixels||[]);assert(s.gdi?.sharedGuestStorage,'canonical GDI must use actual guest memory');
  const surfaces=[];
  for(let j=0;j<cases.length;++j){const c=cases[j],b=bars[j],got=s.rows.find(w=>w.isChild&&w.x===700&&w.y===12+j*12)?.title.trim().split(/\s+/).map(Number),want=expected(j);
   // MoveWindow return is before the final GETPOS.
   [want[want.length-1],want[want.length-2]]=[want[want.length-2],want[want.length-1]];
   assert.deepEqual(got,want,'ordinary public returns/range/position '+j);
   assert.deepEqual(cpuState.controls[j],{hwnd:b.hwnd,cls:17,live:1,state:[1,c[5],c[6],c[7],7]});
   assert.equal(b.w,c[2]);assert.equal(b.h,c[3]);
   const x=b.x+cpuState.frameClient.x-frame.x,y=b.y+cpuState.frameClient.y-frame.y,w=b.w,h=b.h,bytes=Buffer.alloc(w*h*4),ref=reference(c);
   for(let row=0;row<h;row++){const at=((y+row)*s.width+x)*4;pix.copy(bytes,row*w*4,at,at+w*4);assert(pix.subarray(at,at+w*4).equals(gd.subarray(at,at+w*4)),'GDI/backcanvas '+j);}
   let mismatches=0;for(let k=0;k<bytes.length;k++)if(bytes[k]!==ref.bytes[k])mismatches++;
   if(mismatches)failures.push({j,mismatches});
   surfaces.push({x,y,w,h,bytes});results.push({j,got,want,fill:ref.fill,referenceSHA256:sha(ref.bytes),actualSHA256:sha(bytes),mismatches});
  }
  const {PNG}=require(root+'/node_modules/pngjs'),composite=PNG.sync.read(fs.readFileSync(out+'/composited.png')),desktop=PNG.sync.read(fs.readFileSync(out+'/desktop.png'));
  const match=(png,v,ox,oy)=>{const x=Math.round(ox+v.x),y=Math.round(oy+v.y);if(x<0||y<0||x+v.w>png.width||y+v.h>png.height)return false;for(let row=0;row<v.h;++row)if(!png.data.subarray(((y+row)*png.width+x)*4,((y+row)*png.width+x+v.w)*4).equals(v.bytes.subarray(row*v.w*4,(row+1)*v.w*4)))return false;return true;};
  assert(surfaces.every(v=>match(composite,v,s.canvas.x+frame.x,s.canvas.y+frame.y)),'compositor exact progress surfaces');
  const first=surfaces[0],needle=first.bytes.subarray(8*first.w*4,9*first.w*4);let origin=null;for(let at=desktop.data.indexOf(needle);at>=0;at=desktop.data.indexOf(needle,at+1)){if(at%4)continue;const ox=at/4%desktop.width-first.x,oy=Math.floor(at/4/desktop.width)-first.y-8;if(surfaces.every(v=>match(desktop,v,ox,oy))){origin={x:ox,y:oy};break;}}assert(origin,'native desktop exact progress surfaces');
  save('visible.json',{origin,exactCompositor:true,exactNativeDesktop:true,surfaces:surfaces.map(({bytes,...v})=>({...v,sha256:sha(bytes)}))});
  s.gdi.sha256=sha(gd);delete s.gdi.pixels;delete s.pixels;save('scene.json',s);
  await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));
  save('assertions.json',{expectOld,failures,results,productionBrowserCPU:true});
  if(expectOld){assert(failures.length>=12,'supported horizontal overflow must reproduce oldFAIL');assert(failures.every(f=>f.j<16||f.j===24||f.j===25),'ordinary, vertical and tiny pixels remain correct');console.log('PASS supported preedit oldFAIL',failures.length);}else{assert.deepEqual(failures,[]);console.log('PASS horizontal overflow progress, signed ranges, resize, degenerate safety, public state and four surfaces',cases.length);}
 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('transients.json',await transient.cleanup(out));if(display)await display.close();}
}
if(require.main===module)main(process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync(require('node:os').tmpdir()+'/progress-horizontal-overflow-'),{expectOld:process.argv.includes('--expect-old')}).catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={cases,expected,reference,fixture,main};
