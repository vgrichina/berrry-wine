'use strict';
// Period Microsoft WIN32.HLP 3783/3784 and VC4 September 1995 pp1915-1916.
// Ordinary ANSI registered windows: count excludes NUL, capacity includes it.
// Authored guest only; native F8 invokes public direct and SendMessage paths.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const cases=['Alpha','Beta42',''];
const capacities=len=>[0,1,len+1,3,32];
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
int API ShowWindow(P,int);int API SetWindowTextA(P,const char*);unsigned short API RegisterClassA(P);
long API DefWindowProcA(P,U,U,long);long API SendMessageA(P,U,U,long);int API GetMessageA(P,P,U,U);
int API TranslateMessage(P);long API DispatchMessageA(P);int API GetDlgCtrlID(P);
int API GetWindowTextA(P,char*,int);int API GetWindowTextLengthA(P);long API GetWindowLongA(P,int);int API GetClientRect(P,P);int API GetWindowRect(P,P);
int API IsWindow(P);int API IsWindowVisible(P);int API IsWindowEnabled(P);
P API BeginPaint(P,P);int API EndPaint(P,P);int API FillRect(P,P,P);int API InvalidateRect(P,P,int);int API UpdateWindow(P);
P API CreateSolidBrush(U);
struct WC{U style;P proc;int cex,wex;P instance,icon,cursor,brush;const char* menu;const char* name;};struct R{int l,t,r,b;};
static P frame,targets[2],status,panels[4],good,bad,background;static int stage=-1;static U reads,lengths,sets,argsOK=1,expectedM,expectedW,expectedL;static long direct,chain;static char report[4096];
void num(U n,int* at){char d[12];int k=0;do{d[k++]='0'+n%10;n/=10;}while(n);while(k)report[(*at)++]=d[--k];report[(*at)++]=' ';}
void hexbytes(unsigned char* b,int* at){const char* h="0123456789abcdef";for(int j=0;j<40;++j){report[(*at)++]=h[b[j]>>4];report[(*at)++]=h[b[j]&15];}report[(*at)++]=' ';}
long __stdcall fixedReference(P h,U m,U w,long l){if(m==15){U ps[16];P dc=BeginPaint(h,ps);struct R full={0,0,168,28},mark={9,7,143,21};FillRect(dc,&full,background);FillRect(dc,&mark,good);EndPaint(h,ps);return 0;}return DefWindowProcA(h,m,w,l);}
long __stdcall actual(P h,U m,U w,long l){if(m==15){U ps[16];P dc=BeginPaint(h,ps);struct R full={0,0,168,28},yes={9,7,143,21},no={69,3,82,25};long result=GetDlgCtrlID(h)==11?direct:chain;FillRect(dc,&full,background);FillRect(dc,result?&yes:&no,result?good:bad);EndPaint(h,ps);return 0;}return DefWindowProcA(h,m,w,l);}
long __stdcall target(P h,U m,U w,long l){if(m==12||m==13||m==14){if(m==12)++sets;else if(m==13)++reads;else ++lengths;argsOK&=h==targets[1]&&m==expectedM&&w==expectedW&&(U)l==expectedL;}return DefWindowProcA(h,m,w,l);}
long call(int route,U m,U w,long l){expectedM=m;expectedW=w;expectedL=(U)l;return route?SendMessageA(targets[1],m,w,l):DefWindowProcA(targets[0],m,w,l);}
void publish(void){const char* text=stage==0?"Alpha":stage==1?"Beta42":"";U len=stage==2?0:stage==1?6:5,caps[5]={0,1,len+1,3,32},ok[2]={1,1},lens[2],setResult[2]={1,1},quiet=1;unsigned char buffers[2][5][40];U returns[2][5];volatile U guard[2]={0x13579bdf,0x2468ace0};int at=0;reads=lengths=sets=0;argsOK=1;
 for(int r=0;r<2;++r){U before=reads+lengths+sets;if(stage)setResult[r]=call(r,12,0,(long)text);lens[r]=call(r,14,0,0);ok[r]&=lens[r]==len&&setResult[r]==1;
  for(int k=0;k<5;++k){unsigned char* b=buffers[r][k];U cap=caps[k],n=cap?(len<cap?len:cap-1):0;for(int j=0;j<40;++j)b[j]=0xa5;returns[r][k]=call(r,13,cap,(long)(b+4));ok[r]&=returns[r][k]==n;for(U j=0;j<40;++j){U want=0xa5;if(cap&&j>=4&&j<4+n)want=(unsigned char)text[j-4];if(cap&&j==4+n)want=0;ok[r]&=b[j]==want;}}
  if(!r)quiet&=before==reads+lengths+sets;
 }
 num(stage,&at);num(lens[0],&at);num(lens[1],&at);num(sets,&at);num(reads,&at);num(lengths,&at);num(quiet,&at);num(argsOK,&at);num(setResult[0],&at);num(setResult[1],&at);num(guard[0],&at);num(guard[1],&at);
 for(int r=0;r<2;++r)for(int k=0;k<5;++k){num(caps[k],&at);num(returns[r][k],&at);hexbytes(buffers[r][k],&at);}report[at]=0;direct=ok[0];chain=ok[1];SetWindowTextA(status,report);
 for(int j=0;j<4;++j){InvalidateRect(panels[j],0,1);UpdateWindow(panels[j]);}}
long __stdcall parent(P h,U m,U w,long l){return DefWindowProcA(h,m,w,l);}
void start(void){P i=GetModuleHandleA(0);struct WC wc={0,parent,0,0,0,0,0,(P)16,0,"DwpCaptionParent"};wc.instance=i;RegisterClassA(&wc);wc.name="DwpCaptionActual";wc.proc=actual;RegisterClassA(&wc);wc.name="DwpCaptionFixed";wc.proc=fixedReference;RegisterClassA(&wc);wc.name="DwpCaptionTarget";wc.proc=target;RegisterClassA(&wc);
 good=CreateSolidBrush(0x21a642);bad=CreateSolidBrush(0x1848df);background=CreateSolidBrush(0xeed5a1);
 frame=CreateWindowExA(0,"DwpCaptionParent","Authored DefWindowProc CAPTION return",0x10c80000,12,12,720,390,0,0,i,0);
 panels[0]=CreateWindowExA(0,"DwpCaptionActual","",0x50000000,15,50,168,28,frame,(P)11,i,0);panels[1]=CreateWindowExA(0,"DwpCaptionActual","",0x50000000,15,100,168,28,frame,(P)12,i,0);
 panels[2]=CreateWindowExA(0,"DwpCaptionFixed","",0x50000000,230,50,168,28,frame,(P)30,i,0);panels[3]=CreateWindowExA(0,"DwpCaptionFixed","",0x50000000,230,100,168,28,frame,(P)31,i,0);
 targets[0]=CreateWindowExA(0,"DwpCaptionTarget","Alpha",0x50000000,460,50,168,28,frame,(P)40,i,0);targets[1]=CreateWindowExA(0,"DwpCaptionTarget","Alpha",0x50000000,460,100,168,28,frame,(P)41,i,0);
 status=CreateWindowExA(0,"STATIC","READY",0x50000000,15,230,680,60,frame,(P)20,i,0);ShowWindow(frame,5);
 U msg[12];while(GetMessageA(msg,0,0,0)>0){if((msg[1]==0x100||msg[1]==0x101)&&msg[2]==0x77){if(msg[1]==0x100&&stage<2){++stage;publish();}continue;}TranslateMessage(msg);DispatchMessageA(msg);}
}
`;
function fixture(out){
 fs.writeFileSync(out+'/fixture.c',source);
 const libs={"kernel32":["GetModuleHandleA@4"],"user32":["CreateWindowExA@48","ShowWindow@8","RegisterClassA@4","DefWindowProcA@16","GetDlgCtrlID@4","SetWindowTextA@8","SendMessageA@16","GetMessageA@16","TranslateMessage@4","DispatchMessageA@4","BeginPaint@8","EndPaint@8","FillRect@12","InvalidateRect@12","UpdateWindow@4","GetWindowTextA@12","GetWindowTextLengthA@4","GetWindowLongA@8","GetClientRect@8","GetWindowRect@8","IsWindow@4","IsWindowVisible@4","IsWindowEnabled@4"],"gdi32":["CreateSolidBrush@4"]};
 for(const[dll,names]of Object.entries(libs)){fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib'],{timeout:15000});}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-Wall','-Wextra','-Werror','-Wno-unused-parameter','-c',out+'/fixture.c','-o',out+'/fixture.obj'],{timeout:15000});
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/defwndproc-caption-read.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib',out+'/gdi32.lib'],{timeout:15000});return fs.readFileSync(out+'/defwndproc-caption-read.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n');
 const runtime=require('../tools/boids-current-runtime.cjs'),commit=cp.execFileSync('git',['rev-parse',process.env.DWP_CAPTION_READ_COMMIT||'HEAD'],{cwd:root,encoding:'utf8'}).trim(),files=runtime.gitFiles(commit),own='src/09a5-handlers-window.wat';
 files.set(own,fs.readFileSync(root+'/'+own));
 if(process.env.DWP_CAPTION_READ_WORKING_RUNTIME)for(const n of files.keys())if(fs.existsSync(root+'/'+n))files.set(n,fs.readFileSync(root+'/'+n));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{cwd:root,maxBuffer:8e6}));
 const wasm=process.env.DWP_CAPTION_READ_MODULE?fs.readFileSync(process.env.DWP_CAPTION_READ_MODULE):runtime.compile(files),pe=fixture(out);fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));files.set('build/wine-assembly.wasm',wasm);files.set('defwndproc-caption-read.exe',pe);
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
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=700;c.style='position:fixed;left:0;top:0;z-index:99999;width:1000px;height:700px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.captionHost=new WineAssembly();captionHost.renderer=new Win98Renderer(c);await captionHost.init(c);if(!captionHost.guestWorker)throw Error('production Worker required');await captionHost.loadExe('/defwndproc-caption-read.exe');captionHost.run();});
 await page.waitForFunction(()=>Object.values(captionHost.renderer.windows).some(w=>w.title==='READY'),{timeout:120000});
 await page.evaluate(()=>{browserInput.wireCanvasInput(captionHost.renderer.canvas,captionHost.renderer,{runningApps:[{wine:captionHost}],debugMode:true});captionHost.renderer.canvas.focus();});
 const native=args=>cp.execFileSync('xdotool',args,{env:display.env,timeout:15000}),wins=native(['search','--onlyvisible','--pid',String(browser.process().pid),'--class','chrome']).toString().trim().split(/\s+/);assert.equal(wins.length,1);native(['windowactivate','--sync',wins[0]]);
 save('native-input.json',{route:'private X11 XTEST F8; authored guest calls DefWindowProcA directly and SendMessageA to custom registered wndproc chaining DefWindowProcA' ,window:wins[0],cases});
 let nativeOrigin=null;
 for(let stage=0;stage<cases.length;++stage){
  native(['key','F8']);await page.waitForFunction(j=>Object.values(captionHost.renderer.windows).some(w=>w.title?.startsWith(j+' ')),{timeout:90000},stage);
await new Promise(r=>setTimeout(r,300));
  const s=await page.evaluate(()=>{const encode=a=>{let s='';for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode(...a.subarray(i,i+8192));return btoa(s);};const h=captionHost,r=h.renderer,w=Object.values(r.windows).find(w=>w.title==='Authored DefWindowProc CAPTION return'),p=w._backCanvas._waCanonicalPresentation;return {report:Object.values(r.windows).find(w=>w.isChild&&w.x===15&&w.y===230)?.title,rows:Object.values(r.windows).map(v=>({hwnd:v.hwnd,title:v.title,x:v.x,y:v.y,w:v.w,h:v.h,isChild:v.isChild})),gdi:p?{sharedGuestStorage:p.surface.storage.buffer===h.memory.buffer,pixels:encode(p.surface.rgbaRect(0,0,w.w,w.h))}:null,pixels:encode(w._backCanvas.getContext('2d').getImageData(0,0,w.w,w.h).data),width:w.w,height:w.h,frame:{x:w.x,y:w.y},canvas:r.canvas.getBoundingClientRect().toJSON()};});
  save('stage-'+stage+'-public.json',{report:s.report,rows:s.rows});const parts=s.report.trim().split(/\s+/),text=cases[stage],len=text.length;
  assert.equal(parts.length,42);const nums=parts.slice(0,12).map(Number);assert.equal(nums[0],stage);
  assert.deepEqual(nums.slice(3),[stage?1:0,5,1,1,1,1,1,0x13579bdf,0x2468ace0],'public callback counts/exact args, direct quiet, setters and stack guards');
  let publicOK=nums[1]===len&&nums[2]===len;const observations=[];
  for(let route=0;route<2;++route)for(let k=0;k<capacities(len).length;++k){const at=12+(route*5+k)*3,cap=Number(parts[at]),ret=Number(parts[at+1]),bytes=Buffer.from(parts[at+2],'hex');assert.equal(cap,capacities(len)[k]);assert.equal(bytes.length,40);const n=cap?Math.min(len,cap-1):0,want=Buffer.alloc(40,0xa5);if(cap){want.write(text.slice(0,n),4,'ascii');want[4+n]=0;}const ok=ret===n&&bytes.equals(want);publicOK&&=ok;observations.push({route,capacity:cap,return:ret,expectedReturn:n,bytes:bytes.toString('hex'),expectedBytes:want.toString('hex'),ok});
   assert(bytes.subarray(0,4).equals(Buffer.alloc(4,0xa5))&&bytes.subarray(4+cap).equals(Buffer.alloc(36-cap,0xa5)),'sentinel guards');
   if(expectOld){assert.equal(ret,0);assert(bytes.equals(Buffer.alloc(40,0xa5)),'physical preedit never writes any byte');}else assert(ok,'exact independent return/text/NUL/padding route '+route+' cap '+cap);
  }
  save('stage-'+stage+'-reads.json',observations);
  if(!publicOK)failures.push({stage,lengths:nums.slice(1,3),observations:observations.filter(v=>!v.ok)});
  if(expectOld){assert.deepEqual(nums.slice(1,3),[0,0]);assert(!publicOK);}else assert(publicOK,'ordinary caption read contract');
  assert(s.gdi?.sharedGuestStorage);const pix=Buffer.from(s.pixels,'base64'),gd=Buffer.from(s.gdi.pixels,'base64'),surfaces=[];
  function crop(x,y,w,h){const bytes=Buffer.alloc(w*h*4);for(let r=0;r<h;++r){const at=((y+r)*s.width+x)*4;pix.copy(bytes,r*w*4,at,at+w*4);assert(pix.subarray(at,at+w*4).equals(gd.subarray(at,at+w*4)),'GDI/backcanvas');}surfaces.push({x,y,w,h,bytes});return bytes;}
  // Reference procedure paints literal fixed rectangles without reading results.
  const actual=crop(6+15,26+50,168,28),reference=crop(6+230,26+50,168,28),actualChain=crop(6+15,26+100,168,28),referenceChain=crop(6+230,26+100,168,28);
  assert(reference.equals(referenceChain),'independent fixed references equal');
  const visibleEqual=actual.equals(reference)&&actualChain.equals(referenceChain);
  if(expectOld)assert(!actual.equals(reference)&&!actualChain.equals(referenceChain),'physical old geometry mismatch on both paths');else assert(visibleEqual,'both result status geometries match fixed independent GDI');
  const colorCounts={};for(let i=0;i<reference.length;i+=4){const key=reference.subarray(i,i+3).toString('hex');colorCounts[key]=(colorCounts[key]||0)+1;}
  for(const value of [0x21a642,0xeed5a1]){const key=Buffer.from([value&255,(value>>>8)&255,(value>>>16)&255]).toString('hex');assert(colorCounts[key]>100,'fixed reference contains explicit color '+key);}
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
 if(expectOld)assert.equal(failures.length,cases.length,'physical old caption reads fail every native request');else assert.deepEqual(failures,[]);console.log('PASS',expectOld?'physical preedit oldFAIL':'DefWindowProc ordinary ANSI caption reads and fixed geometry/four planes',states.length);
 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('deferred-transients.json',{root:transient.root,downloads:transient.downloads});if(display)await display.close();}
}
if(require.main===module)(main(process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync('/dev/shm/defwndproc-caption-read-'),{expectOld:process.argv.includes('--expect-old')})).catch(e=>{console.error(e.stack);process.exitCode=1;});module.exports={fixture,main,cases};
