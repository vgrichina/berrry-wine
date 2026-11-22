'use strict';
// Enabled visible ANSI SS_LEFT parent color contract.
// Period Microsoft WIN32.HLP topics170/493/3753/6306: callback before paint,
// HDC/HWND arguments, returned brush, SetTextColor and SetBkColor.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const cases=[{text:"Label42",fg:0x1529b7,bg:0x91d5ee,brush:0xe3a647},{text:"Label42",fg:0xc14216,bg:0x67e4b2,brush:0x9435d8},{text:"Label42",fg:0x1529b7,bg:0x91d5ee,brush:0xe3a647}];
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
int API ShowWindow(P,int);int API SetWindowTextA(P,const char*);unsigned short API RegisterClassA(P);
long API DefWindowProcA(P,U,U,long);long API SendMessageA(P,U,U,long);int API GetMessageA(P,P,U,U);
int API TranslateMessage(P);long API DispatchMessageA(P);int API GetDlgCtrlID(P);
int API GetWindowTextA(P,char*,int);int API GetWindowTextLengthA(P);long API GetWindowLongA(P,int);int API GetClientRect(P,P);int API GetWindowRect(P,P);
int API IsWindow(P);int API IsWindowVisible(P);int API IsWindowEnabled(P);P API WindowFromDC(P);int API GetClipBox(P,P);
P API BeginPaint(P,P);int API EndPaint(P,P);int API FillRect(P,P,P);int API InvalidateRect(P,P,int);int API UpdateWindow(P);
P API GetStockObject(int);P API SelectObject(P,P);int API SetBkMode(P,int);U API SetTextColor(P,U);U API SetBkColor(P,U);U API GetTextColor(P);U API GetBkColor(P);P API CreateSolidBrush(U);int API TextOutA(P,int,int,const char*,int);
struct WC{U style;P proc;int cex,wex;P instance,icon,cursor,brush;const char* menu;const char* name;};struct R{int l,t,r,b;};
static P frame,label,status,ref,brushes[2];static int stage=-1,phase;static U count,argFrame,argLabel,argDC,clipOK,colorsOK,timingOK;static char report[512];
U fg(void){return stage==1?0xc14216:0x1529b7;}U bg(void){return stage==1?0x67e4b2:0x91d5ee;}P brush(void){return brushes[stage==1];}
void num(U n,int* at){char d[12];int k=0;do{d[k++]='0'+n%10;n/=10;}while(n);while(k)report[(*at)++]=d[--k];report[(*at)++]=' ';}
U model(void){char b[64];struct R q;U hash=0;GetWindowTextA(label,b,64);for(int j=0;b[j];++j)hash=hash*33+(unsigned char)b[j];GetWindowRect(label,&q);
 return hash^(U)SendMessageA(label,0x31,0,0)^(U)GetWindowLongA(label,-16)^q.l^(q.t<<8)^q.r^(q.b<<16)^(U)IsWindowVisible(label)^(U)IsWindowEnabled(label);}
long __stdcall reference(P h,U m,U w,long l){
 if(m==0x138&&(P)l==label){struct R q;P dc=(P)w;++count;argFrame=h==frame;argLabel=(P)l==label;argDC=WindowFromDC(dc)==label;
  clipOK=GetClipBox(dc,&q)==2&&q.l==0&&q.t==0&&q.r==168&&q.b==28;
  SetTextColor(dc,fg());SetBkColor(dc,bg());colorsOK=GetTextColor(dc)==fg()&&GetBkColor(dc)==bg();timingOK=phase==1;
  /* This marker must be covered by the later returned-brush background fill. */
  struct R marker={150,18,164,25};FillRect(dc,&marker,(P)4);return (long)brush();}
 if(m==15){U ps[16];P dc=BeginPaint(h,ps);struct R q={0,0,168,28};if(GetDlgCtrlID(h)==30){
  FillRect(dc,&q,brush());SelectObject(dc,GetStockObject(16));SetBkMode(dc,2);SetTextColor(dc,fg());SetBkColor(dc,bg());TextOutA(dc,0,0,"Label42",7);}
  EndPaint(h,ps);return 0;}return DefWindowProcA(h,m,w,l);}
void publish(void){int at=0;struct R q;U old=model(),before=count;phase=0;InvalidateRect(label,0,1);U invalidOnly=count==before;phase=1;UpdateWindow(label);phase=2;
 num(stage,&at);num(count-before,&at);num(model()==old,&at);num(invalidOnly,&at);num(argFrame,&at);num(argLabel,&at);num(argDC,&at);num(clipOK,&at);num(colorsOK,&at);num(timingOK,&at);
 num(GetWindowTextLengthA(label),&at);num(SendMessageA(label,0x31,0,0)==(long)GetStockObject(16),&at);num(GetWindowLongA(label,-16),&at);GetClientRect(label,&q);num(q.r,&at);num(q.b,&at);
 num(IsWindowVisible(label),&at);num(IsWindowEnabled(label),&at);num(IsWindow(label),&at);num(fg(),&at);num(bg(),&at);report[at]=0;
 SetWindowTextA(status,report);InvalidateRect(ref,0,1);UpdateWindow(ref);}
void start(void){P i=GetModuleHandleA(0);struct WC wc={0,reference,0,0,0,0,0,(P)16,0,"StaticParentColorReference"};wc.instance=i;RegisterClassA(&wc);
 brushes[0]=CreateSolidBrush(0xe3a647);brushes[1]=CreateSolidBrush(0x9435d8);
 frame=CreateWindowExA(0,"StaticParentColorReference","Authored STATIC parent colors",0x10c80000,12,12,720,390,0,0,i,0);
 label=CreateWindowExA(0,"STATIC","Label42",0x50000000,15,50,168,28,frame,(P)11,i,0);SendMessageA(label,0x30,(U)GetStockObject(16),1);
 ref=CreateWindowExA(0,"StaticParentColorReference","",0x50000000,15,100,168,28,frame,(P)30,i,0);
 status=CreateWindowExA(0,"STATIC","READY",0x50000000,15,230,680,60,frame,(P)20,i,0);ShowWindow(frame,5);
 U msg[12];while(GetMessageA(msg,0,0,0)>0){if((msg[1]==0x100||msg[1]==0x101)&&msg[2]==0x77){if(msg[1]==0x100&&stage<2){++stage;publish();}continue;}TranslateMessage(msg);DispatchMessageA(msg);}
}
`;
function fixture(out){
 fs.writeFileSync(out+'/fixture.c',source);
 const libs={"kernel32":["GetModuleHandleA@4"],"user32":["CreateWindowExA@48","ShowWindow@8","RegisterClassA@4","DefWindowProcA@16","GetDlgCtrlID@4","SetWindowTextA@8","SendMessageA@16","GetMessageA@16","TranslateMessage@4","DispatchMessageA@4","BeginPaint@8","EndPaint@8","FillRect@12","InvalidateRect@12","UpdateWindow@4","GetWindowTextA@12","GetWindowTextLengthA@4","GetWindowLongA@8","GetClientRect@8","GetWindowRect@8","IsWindow@4","IsWindowVisible@4","IsWindowEnabled@4","WindowFromDC@4"],"gdi32":["GetStockObject@4","SelectObject@8","SetTextColor@8","SetBkMode@8","TextOutA@20","GetClipBox@8","SetBkColor@8","GetBkColor@4","GetTextColor@4","CreateSolidBrush@4"]};
 for(const[dll,names]of Object.entries(libs)){fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib'],{timeout:15000});}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-Wall','-Wextra','-Werror','-Wno-unused-parameter','-c',out+'/fixture.c','-o',out+'/fixture.obj'],{timeout:15000});
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/static-parentcolor.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib',out+'/gdi32.lib'],{timeout:15000});return fs.readFileSync(out+'/static-parentcolor.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n');
 const runtime=require('../tools/boids-current-runtime.cjs'),commit=cp.execFileSync('git',['rev-parse',process.env.STATIC_PARENTCOLOR_COMMIT||'HEAD'],{cwd:root,encoding:'utf8'}).trim(),files=runtime.gitFiles(commit),own='src/09c3-controls0-basic-wndprocs.wat';
 files.set(own,fs.readFileSync(root+'/'+own));
 if(process.env.STATIC_PARENTCOLOR_WORKING_RUNTIME)for(const n of files.keys())if(fs.existsSync(root+'/'+n))files.set(n,fs.readFileSync(root+'/'+n));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{cwd:root,maxBuffer:8e6}));
 const wasm=process.env.STATIC_PARENTCOLOR_MODULE?fs.readFileSync(process.env.STATIC_PARENTCOLOR_MODULE):runtime.compile(files),pe=fixture(out);fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));files.set('build/wine-assembly.wasm',wasm);files.set('static-parentcolor.exe',pe);
 fs.writeFileSync(out+'/runtime.diff',cp.execFileSync('git',['diff','--binary',commit,'--','src','lib','tools','host.js','index.html'],{cwd:root,maxBuffer:24e6}));
 save('runtime.json',{commit,expectOld,moduleSHA256:sha(wasm),peSHA256:sha(pe),testSHA256:sha(fs.readFileSync(__filename)),files:[...files].map(([name,b])=>({name,size:b.length,sha256:sha(b)}))});
 const transient=require('../tools/browser-transients.cjs').create(),logs=[],pending=[],workers=[],states=[],failures=[];let display,browser,wait,server;
 try{
 server=http.createServer((req,res)=>{const n=new URL(req.url,'http://local').pathname.slice(1)||'index.html',b=files.get(n);res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.html')?'text/html':n.endsWith('.css')?'text/css':n.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.statusCode=b?200:404;res.end(b||'missing');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 display=await require('../tools/gltron-headful-display.cjs').start(out);
 browser=await require('puppeteer').launch({headless:false,defaultViewport:{width:1050,height:800},env:transient.env(display.env),userDataDir:transient.profile,executablePath:'/opt/google/chrome/chrome',args:[...transient.args,'--no-sandbox','--disable-dev-shm-usage','--disable-component-update','--disable-background-networking'],protocolTimeout:120000});wait=transient.watch(browser.process());browser.process().stdout?.resume();browser.process().stderr?.resume();save('browser-version.json',{version:await browser.version()});
 const page=await browser.newPage();page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>logs.push(String(e)));
 page.on('workercreated',w=>{const row={url:w.url(),modules:[]};workers.push(row);const c=w.client;c.on('Debugger.scriptParsed',v=>{if(v.scriptLanguage==='WebAssembly'||v.url.startsWith('wasm://'))pending.push(c.send('Debugger.getScriptSource',{scriptId:v.scriptId}).then(r=>row.modules.push(sha(Buffer.from(r.bytecode,'base64')))));});pending.push(c.send('Debugger.enable'));});
 await page.evaluateOnNewDocument(()=>localStorage.setItem('wine-assembly.threads','1'));await page.goto('http://127.0.0.1:'+server.address().port+'/?debug&threads&no-log');await page.waitForFunction(()=>typeof WineAssembly==='function');
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=700;c.style='position:fixed;left:0;top:0;z-index:99999;width:1000px;height:700px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.staticHost=new WineAssembly();staticHost.renderer=new Win98Renderer(c);await staticHost.init(c);if(!staticHost.guestWorker)throw Error('production Worker required');await staticHost.loadExe('/static-parentcolor.exe');staticHost.run();});
 await page.waitForFunction(()=>Object.values(staticHost.renderer.windows).some(w=>w.title==='READY'),{timeout:120000});
 await page.evaluate(()=>{browserInput.wireCanvasInput(staticHost.renderer.canvas,staticHost.renderer,{runningApps:[{wine:staticHost}],debugMode:true});staticHost.renderer.canvas.focus();});
 const native=args=>cp.execFileSync('xdotool',args,{env:display.env,timeout:15000}),wins=native(['search','--onlyvisible','--pid',String(browser.process().pid),'--class','chrome']).toString().trim().split(/\s+/);assert.equal(wins.length,1);native(['windowactivate','--sync',wins[0]]);
 save('native-input.json',{route:'private X11 XTEST F8; authored message loop changes explicit colors, invalidates label, UpdateWindow synchronously calls parent' ,window:wins[0],cases});
 let nativeOrigin=null;
 for(let stage=0;stage<cases.length;++stage){
  native(['key','F8']);await page.waitForFunction(j=>Object.values(staticHost.renderer.windows).some(w=>w.title?.startsWith(j+' ')),{timeout:90000},stage);
await new Promise(r=>setTimeout(r,300));
  const s=await page.evaluate(()=>{const encode=a=>{let s='';for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode(...a.subarray(i,i+8192));return btoa(s);};const h=staticHost,r=h.renderer,w=Object.values(r.windows).find(w=>w.title==='Authored STATIC parent colors'),p=w._backCanvas._waCanonicalPresentation;return {report:Object.values(r.windows).find(w=>w.isChild&&w.x===15&&w.y===230)?.title,rows:Object.values(r.windows).map(v=>({hwnd:v.hwnd,title:v.title,x:v.x,y:v.y,w:v.w,h:v.h,isChild:v.isChild})),gdi:p?{sharedGuestStorage:p.surface.storage.buffer===h.memory.buffer,pixels:encode(p.surface.rgbaRect(0,0,w.w,w.h))}:null,pixels:encode(w._backCanvas.getContext('2d').getImageData(0,0,w.w,w.h).data),width:w.w,height:w.h,frame:{x:w.x,y:w.y},canvas:r.canvas.getBoundingClientRect().toJSON()};});
  save('stage-'+stage+'-public.json',{report:s.report,rows:s.rows});const parts=s.report.trim().split(/\s+/),nums=parts.map(Number),c=cases[stage];
  assert.equal(nums.length,20);assert.deepEqual(nums.slice(0,1),[stage]);
  assert.deepEqual(nums.slice(2,4),[1,1],'public state stable; InvalidateRect alone sends no callback');
  assert.deepEqual(nums.slice(10),[7,1,0x50000000,168,28,1,1,1,c.fg,c.bg],'public label text/font/style/geometry/state and desired colors');
  const publicOK=nums[1]>0&&nums.slice(4,10).every(v=>v===1);
  if(!publicOK)failures.push({stage,report:s.report,expected:'synchronous completed parent callback with correct public HDC/HWND, clip, colors and timing'});
  if(expectOld)assert.equal(nums[1],0,'physical preedit never calls parent');else assert(publicOK,'parent callback arguments and synchronous timing');
  assert(s.gdi?.sharedGuestStorage);const pix=Buffer.from(s.pixels,'base64'),gd=Buffer.from(s.gdi.pixels,'base64'),surfaces=[];
  function crop(x,y,w,h){const bytes=Buffer.alloc(w*h*4);for(let r=0;r<h;++r){const at=((y+r)*s.width+x)*4;pix.copy(bytes,r*w*4,at,at+w*4);assert(pix.subarray(at,at+w*4).equals(gd.subarray(at,at+w*4)),'GDI/backcanvas');}surfaces.push({x,y,w,h,bytes});return bytes;}
  // Fixed GDI reference uses TextOutA and literal expected text; STATIC
  // output never supplies the expected glyphs or geometry. Entire label.
  const actual=crop(6+15,26+50,168,28),reference=crop(6+15,26+100,168,28);
  const visibleEqual=actual.equals(reference);
  if(expectOld)assert(!visibleEqual,'physical old visible mismatch');else assert(visibleEqual,'whole fixed independent GDI label including distinct brush, text foreground and text background');
  const colorCounts={};for(let i=0;i<reference.length;i+=4){const key=reference.subarray(i,i+3).toString('hex');colorCounts[key]=(colorCounts[key]||0)+1;}
  for(const value of [c.fg,c.bg,c.brush]){const key=Buffer.from([value&255,(value>>>8)&255,(value>>>16)&255]).toString('hex');assert(colorCounts[key]>10,'fixed reference has separately observable explicit color '+key);}
  await page.screenshot({path:out+'/stage-'+stage+'-composited.png'});require('../tools/browser-transients.cjs').captureWhole(out,'stage-'+stage+'-desktop',display.env);
  const{PNG}=require('pngjs'),composite=PNG.sync.read(fs.readFileSync(out+'/stage-'+stage+'-composited.png')),desktop=PNG.sync.read(fs.readFileSync(out+'/stage-'+stage+'-desktop.png'));
  const match=(png,v,ox,oy)=>{const x=Math.round(ox+v.x),y=Math.round(oy+v.y);if(x<0||y<0||x+v.w>png.width||y+v.h>png.height)return false;for(let r=0;r<v.h;++r)if(!png.data.subarray(((y+r)*png.width+x)*4,((y+r)*png.width+x+v.w)*4).equals(v.bytes.subarray(r*v.w*4,(r+1)*v.w*4)))return false;return true;};
  assert(surfaces.every(v=>match(composite,v,s.canvas.x+s.frame.x,s.canvas.y+s.frame.y)),'compositor exact');
  if(!nativeOrigin){const v=surfaces[0],needle=v.bytes.subarray(6*v.w*4,7*v.w*4);for(let at=desktop.data.indexOf(needle);at>=0;at=desktop.data.indexOf(needle,at+1)){if(at%4)continue;const ox=at/4%desktop.width-v.x,oy=Math.floor(at/4/desktop.width)-v.y-6;if(surfaces.every(v=>match(desktop,v,ox,oy))){nativeOrigin={x:ox,y:oy};break;}}}
  assert(nativeOrigin&&surfaces.every(v=>match(desktop,v,nativeOrigin.x,nativeOrigin.y)),'native desktop exact at fixed origin');
  states.push({stage,publicOK,visibleEqual,report:s.report,nativeOrigin,exactGDI:true,exactCompositor:true,exactNativeDesktop:true,surfaces:surfaces.map(({bytes,...v})=>({...v,sha256:sha(bytes)}))});save('states.json',states);
 }
 const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);const cpuState=await cpu.evaluate(()=>{const names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,registers:Object.fromEntries(names.map(n=>[n,instance.exports[n]()>>>0]))};});save('cpu-state.json',cpuState);assert.equal(cpuState.memoryBytes,536870912);assert.equal(Object.keys(cpuState.registers).length,19);assert(cpuState.registers.get_eip&&cpuState.registers.get_esp);
 await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));save('assertions.json',{expectOld,failures,states:states.length,productionBrowserCPU:true});
 if(expectOld)assert.equal(failures.length,cases.length,'physical old parent callback fails every native request');else assert.deepEqual(failures,[]);console.log('PASS',expectOld?'physical preedit oldFAIL':'STATIC parent callback/colors/returned brush/four planes',states.length);
 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('deferred-transients.json',{root:transient.root,downloads:transient.downloads});if(display)await display.close();}
}
if(require.main===module)(main(process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync('/dev/shm/static-parentcolor-'),{expectOld:process.argv.includes('--expect-old')})).catch(e=>{console.error(e.stack);process.exitCode=1;});module.exports={fixture,main,cases};
