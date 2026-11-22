'use strict';
// Microsoft WIN32.HLP topic 3876: DefWindowProc returns -1 for WM_VKEYTOITEM.
// Authored guest only; native F8 invokes public direct and SendMessage paths.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const cases=[0x00000028,0x00030026,0xffff0077];
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
static P frame,list,status,panels[4],good,bad,background;static int stage=-1;static U count,seenH,seenM,seenW,seenL;static long direct,chain;static char report[512];
void num(U n,int* at){char d[12];int k=0;do{d[k++]='0'+n%10;n/=10;}while(n);while(k)report[(*at)++]=d[--k];report[(*at)++]=' ';}
U model(void){char b[64];struct R q;U hash=0;GetWindowTextA(list,b,64);for(int j=0;b[j];++j)hash=hash*33+(unsigned char)b[j];GetWindowRect(list,&q);
 return hash^(U)SendMessageA(list,0x18b,0,0)^(U)SendMessageA(list,0x188,0,0)^(U)GetWindowLongA(list,-16)^q.l^(q.t<<8)^q.r^(q.b<<16)^(U)IsWindowVisible(list)^(U)IsWindowEnabled(list);}
long __stdcall fixedReference(P h,U m,U w,long l){if(m==15){U ps[16];P dc=BeginPaint(h,ps);struct R full={0,0,168,28},mark={9,7,143,21};FillRect(dc,&full,background);FillRect(dc,&mark,good);EndPaint(h,ps);return 0;}return DefWindowProcA(h,m,w,l);}
long __stdcall actual(P h,U m,U w,long l){if(m==15){U ps[16];P dc=BeginPaint(h,ps);struct R full={0,0,168,28},yes={9,7,143,21},no={69,3,82,25};long result=GetDlgCtrlID(h)==11?direct:chain;FillRect(dc,&full,background);FillRect(dc,result==-1?&yes:&no,result==-1?good:bad);EndPaint(h,ps);return 0;}return DefWindowProcA(h,m,w,l);}
long __stdcall parent(P h,U m,U w,long l){if(m==0x2e){++count;seenH=(U)h;seenM=m;seenW=w;seenL=(U)l;return DefWindowProcA(h,m,w,l);}return DefWindowProcA(h,m,w,l);}
void publish(void){U wp=stage==0?0x00000028:stage==1?0x00030026:0xffff0077;volatile U guard[2]={0x13579bdf,0x2468ace0};U before=model(),beforeCount=count;int at=0;struct R q;
 direct=DefWindowProcA(frame,0x2e,wp,(long)list);U directQuiet=count==beforeCount;chain=SendMessageA(frame,0x2e,wp,(long)list);
 num(stage,&at);num((U)direct,&at);num((U)chain,&at);num(count-beforeCount,&at);num(directQuiet,&at);num(seenH==(U)frame,&at);num(seenM,&at);num(seenW,&at);num(seenL==(U)list,&at);num(model()==before,&at);num(guard[0],&at);num(guard[1],&at);
 num(GetWindowLongA(list,-16),&at);GetClientRect(list,&q);num(q.r,&at);num(q.b,&at);num(IsWindowVisible(list),&at);num(IsWindowEnabled(list),&at);num(IsWindow(list),&at);num(SendMessageA(list,0x18b,0,0),&at);num(SendMessageA(list,0x188,0,0),&at);report[at]=0;SetWindowTextA(status,report);
 for(int j=0;j<4;++j){InvalidateRect(panels[j],0,1);UpdateWindow(panels[j]);}}
void start(void){P i=GetModuleHandleA(0);struct WC wc={0,parent,0,0,0,0,0,(P)16,0,"DwpVkeyParent"};wc.instance=i;RegisterClassA(&wc);wc.name="DwpVkeyActual";wc.proc=actual;RegisterClassA(&wc);wc.name="DwpVkeyFixed";wc.proc=fixedReference;RegisterClassA(&wc);
 good=CreateSolidBrush(0x21a642);bad=CreateSolidBrush(0x1848df);background=CreateSolidBrush(0xeed5a1);
 frame=CreateWindowExA(0,"DwpVkeyParent","Authored DefWindowProc VKEY return",0x10c80000,12,12,720,390,0,0,i,0);
 panels[0]=CreateWindowExA(0,"DwpVkeyActual","",0x50000000,15,50,168,28,frame,(P)11,i,0);panels[1]=CreateWindowExA(0,"DwpVkeyActual","",0x50000000,15,100,168,28,frame,(P)12,i,0);
 panels[2]=CreateWindowExA(0,"DwpVkeyFixed","",0x50000000,230,50,168,28,frame,(P)30,i,0);panels[3]=CreateWindowExA(0,"DwpVkeyFixed","",0x50000000,230,100,168,28,frame,(P)31,i,0);
 list=CreateWindowExA(0,"LISTBOX","",0x50000400,460,50,168,100,frame,(P)40,i,0);SendMessageA(list,0x180,0,(long)"One");SendMessageA(list,0x180,0,(long)"Two");SendMessageA(list,0x186,1,0);
 status=CreateWindowExA(0,"STATIC","READY",0x50000000,15,230,680,60,frame,(P)20,i,0);ShowWindow(frame,5);
 U msg[12];while(GetMessageA(msg,0,0,0)>0){if((msg[1]==0x100||msg[1]==0x101)&&msg[2]==0x77){if(msg[1]==0x100&&stage<2){++stage;publish();}continue;}TranslateMessage(msg);DispatchMessageA(msg);}
}
`;
function fixture(out){
 fs.writeFileSync(out+'/fixture.c',source);
 const libs={"kernel32":["GetModuleHandleA@4"],"user32":["CreateWindowExA@48","ShowWindow@8","RegisterClassA@4","DefWindowProcA@16","GetDlgCtrlID@4","SetWindowTextA@8","SendMessageA@16","GetMessageA@16","TranslateMessage@4","DispatchMessageA@4","BeginPaint@8","EndPaint@8","FillRect@12","InvalidateRect@12","UpdateWindow@4","GetWindowTextA@12","GetWindowTextLengthA@4","GetWindowLongA@8","GetClientRect@8","GetWindowRect@8","IsWindow@4","IsWindowVisible@4","IsWindowEnabled@4"],"gdi32":["CreateSolidBrush@4"]};
 for(const[dll,names]of Object.entries(libs)){fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib'],{timeout:15000});}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-Wall','-Wextra','-Werror','-Wno-unused-parameter','-c',out+'/fixture.c','-o',out+'/fixture.obj'],{timeout:15000});
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/defwndproc-vkey-return.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib',out+'/gdi32.lib'],{timeout:15000});return fs.readFileSync(out+'/defwndproc-vkey-return.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n');
 const runtime=require('../tools/boids-current-runtime.cjs'),commit=cp.execFileSync('git',['rev-parse',process.env.DWP_VKEY_COMMIT||'HEAD'],{cwd:root,encoding:'utf8'}).trim(),files=runtime.gitFiles(commit),own='src/09a5-handlers-window.wat';
 files.set(own,fs.readFileSync(root+'/'+own));
 if(process.env.DWP_VKEY_WORKING_RUNTIME)for(const n of files.keys())if(fs.existsSync(root+'/'+n))files.set(n,fs.readFileSync(root+'/'+n));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{cwd:root,maxBuffer:8e6}));
 const wasm=process.env.DWP_VKEY_MODULE?fs.readFileSync(process.env.DWP_VKEY_MODULE):runtime.compile(files),pe=fixture(out);fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));files.set('build/wine-assembly.wasm',wasm);files.set('defwndproc-vkey-return.exe',pe);
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
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=700;c.style='position:fixed;left:0;top:0;z-index:99999;width:1000px;height:700px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.vkeyHost=new WineAssembly();vkeyHost.renderer=new Win98Renderer(c);await vkeyHost.init(c);if(!vkeyHost.guestWorker)throw Error('production Worker required');await vkeyHost.loadExe('/defwndproc-vkey-return.exe');vkeyHost.run();});
 await page.waitForFunction(()=>Object.values(vkeyHost.renderer.windows).some(w=>w.title==='READY'),{timeout:120000});
 await page.evaluate(()=>{browserInput.wireCanvasInput(vkeyHost.renderer.canvas,vkeyHost.renderer,{runningApps:[{wine:vkeyHost}],debugMode:true});vkeyHost.renderer.canvas.focus();});
 const native=args=>cp.execFileSync('xdotool',args,{env:display.env,timeout:15000}),wins=native(['search','--onlyvisible','--pid',String(browser.process().pid),'--class','chrome']).toString().trim().split(/\s+/);assert.equal(wins.length,1);native(['windowactivate','--sync',wins[0]]);
 save('native-input.json',{route:'private X11 XTEST F8; authored guest calls DefWindowProcA directly and SendMessageA to custom parent chaining DefWindowProcA' ,window:wins[0],cases});
 let nativeOrigin=null;
 for(let stage=0;stage<cases.length;++stage){
  native(['key','F8']);await page.waitForFunction(j=>Object.values(vkeyHost.renderer.windows).some(w=>w.title?.startsWith(j+' ')),{timeout:90000},stage);
await new Promise(r=>setTimeout(r,300));
  const s=await page.evaluate(()=>{const encode=a=>{let s='';for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode(...a.subarray(i,i+8192));return btoa(s);};const h=vkeyHost,r=h.renderer,w=Object.values(r.windows).find(w=>w.title==='Authored DefWindowProc VKEY return'),p=w._backCanvas._waCanonicalPresentation;return {report:Object.values(r.windows).find(w=>w.isChild&&w.x===15&&w.y===230)?.title,rows:Object.values(r.windows).map(v=>({hwnd:v.hwnd,title:v.title,x:v.x,y:v.y,w:v.w,h:v.h,isChild:v.isChild})),gdi:p?{sharedGuestStorage:p.surface.storage.buffer===h.memory.buffer,pixels:encode(p.surface.rgbaRect(0,0,w.w,w.h))}:null,pixels:encode(w._backCanvas.getContext('2d').getImageData(0,0,w.w,w.h).data),width:w.w,height:w.h,frame:{x:w.x,y:w.y},canvas:r.canvas.getBoundingClientRect().toJSON()};});
  save('stage-'+stage+'-public.json',{report:s.report,rows:s.rows});const parts=s.report.trim().split(/\s+/),nums=parts.map(Number),c=cases[stage];
  assert.equal(nums.length,20);assert.equal(nums[0],stage);
  assert.deepEqual(nums.slice(3),[1,1,1,46,c,1,1,0x13579bdf,0x2468ace0,0x50000400,168,100,1,1,1,2,1],'public callback args, direct quiet, stable state, stack canaries and list model');
  const publicOK=nums[1]===4294967295&&nums[2]===4294967295;
  if(!publicOK)failures.push({stage,direct:nums[1],chain:nums[2],expected:-1});
  if(expectOld)assert.deepEqual(nums.slice(1,3),[0,0],'physical preedit returns zero on both public paths');else assert(publicOK,'direct and chained signed -1');
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
 if(expectOld)assert.equal(failures.length,cases.length,'physical old default return fails every native request');else assert.deepEqual(failures,[]);console.log('PASS',expectOld?'physical preedit oldFAIL':'DefWindowProc VKEY signed return and fixed geometry/four planes',states.length);
 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('deferred-transients.json',{root:transient.root,downloads:transient.downloads});if(display)await display.close();}
}
if(require.main===module)(main(process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync('/dev/shm/defwndproc-vkey-return-'),{expectOld:process.argv.includes('--expect-old')})).catch(e=>{console.error(e.stack);process.exitCode=1;});module.exports={fixture,main,cases};

