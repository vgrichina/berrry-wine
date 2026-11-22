'use strict';
// Microsoft Q125684 reviewed 1995-09-29 Windows95 SS_GRAYRECT=COLOR_3DSHADOW.
// Microsoft SDK winuser.h (1985-1996): COLOR_3DSHADOW=COLOR_BTNSHADOW=16.
// Public independent FillRect reference; black/white unchanged default controls.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const colors=[0x1529b7,0xc14216];
const source=String.raw`typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API GetCommandLineA(void);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
int API ShowWindow(P,int);int API SetWindowTextA(P,const char*);unsigned short API RegisterClassA(P);
long API DefWindowProcA(P,U,U,long);int API GetMessageA(P,P,U,U);int API TranslateMessage(P);long API DispatchMessageA(P);
int API GetWindowTextA(P,char*,int);int API GetWindowTextLengthA(P);long API GetWindowLongA(P,int);int API GetClientRect(P,P);int API GetWindowRect(P,P);int API GetDlgCtrlID(P);
int API IsWindow(P);int API IsWindowVisible(P);int API IsWindowEnabled(P);
P API BeginPaint(P,P);int API EndPaint(P,P);int API FillRect(P,P,P);int API InvalidateRect(P,P,int);int API UpdateWindow(P);
U API GetSysColor(int);P API GetSysColorBrush(int);int API SetSysColors(int,const int*,const U*);P API GetStockObject(int);int API GetObjectA(P,int,P);
struct WC{U style;P proc;int cex,wex;P instance,icon,cursor,brush;const char* menu;const char* name;};struct R{int l,t,r,b;};
static P frame,label[3],status,ref[3];static int stage,initial;static U old,ok;static char report[2048];
U color(void){return ((stage==1)^initial)?0xc14216:0x1529b7;}
void num(U n,int* at){char d[12];int k=0;do{d[k++]='0'+n%10;n/=10;}while(n);while(k)report[(*at)++]=d[--k];report[(*at)++]=' ';}
long __stdcall reference(P h,U m,U w,long l){
 if(m==15){U ps[16];P dc=BeginPaint(h,ps);int j=GetDlgCtrlID(h)-30;if(j>=0&&j<3){struct R q={0,0,168,24};FillRect(dc,&q,j==1?GetSysColorBrush(16):GetStockObject(j==0?4:0));}EndPaint(h,ps);return 0;}
 return DefWindowProcA(h,m,w,l);
}
void publish(void){int at=0;struct {U style,color,hatch;} b={99,99,99};num(stage,&at);num(initial,&at);num(ok,&at);num(GetSysColor(16),&at);P brush=GetSysColorBrush(16);num((U)brush,&at);num(GetObjectA(brush,12,&b),&at);num(b.style,&at);num(b.color,&at);num(b.hatch,&at);
 for(int j=0;j<3;++j){struct R q;volatile struct{U pre;char text[32];U post;} g={0x13572468,{0},0x24681357};num(InvalidateRect(label[j],0,1),&at);num(UpdateWindow(label[j]),&at);num(UpdateWindow(label[j]),&at);num((U)label[j],&at);int n=GetWindowTextA(label[j],(char*)g.text,32);num(n,&at);num(GetWindowTextLengthA(label[j]),&at);for(int k=0;k<=n;++k)num((unsigned char)g.text[k],&at);num(g.pre,&at);num(g.post,&at);num(GetDlgCtrlID(label[j]),&at);num(GetWindowLongA(label[j],-16),&at);num(GetWindowLongA(label[j],-20),&at);GetClientRect(label[j],&q);num(q.l,&at);num(q.t,&at);num(q.r,&at);num(q.b,&at);GetWindowRect(label[j],&q);num(q.l,&at);num(q.t,&at);num(q.r,&at);num(q.b,&at);num(IsWindowVisible(label[j]),&at);num(IsWindowEnabled(label[j]),&at);num(IsWindow(label[j]),&at);InvalidateRect(ref[j],0,1);UpdateWindow(ref[j]);}
 report[at]=0;SetWindowTextA(status,report);
}
void start(void){char* cmd=GetCommandLineA();for(int k=0;cmd[k];++k)if(cmd[k]=='B')initial=1;int index=16;old=GetSysColor(16);U c=color();ok=SetSysColors(1,&index,&c);
 P i=GetModuleHandleA(0);struct WC wc={0,reference,0,0,0,0,0,(P)16,0,"StaticShadowReference"};wc.instance=i;RegisterClassA(&wc);
 frame=CreateWindowExA(0,"StaticShadowReference","Authored STATIC Windows95 shadow",0x10c80000,12,12,720,390,0,0,i,0);
 for(int j=0;j<3;++j){label[j]=CreateWindowExA(0,"STATIC","Rect42",0x50000004+j,15,40+j*40,168,24,frame,(P)(11+j),i,0);ref[j]=CreateWindowExA(0,"StaticShadowReference","",0x50000000,230,40+j*40,168,24,frame,(P)(30+j),i,0);}
 status=CreateWindowExA(0,"STATIC","READY",0x50000000,15,230,680,90,frame,(P)20,i,0);ShowWindow(frame,5);publish();
 U msg[12];while(GetMessageA(msg,0,0,0)>0){if((msg[1]==0x100||msg[1]==0x101)&&msg[2]==0x77){if(msg[1]==0x100&&stage<2){++stage;c=color();ok=SetSysColors(1,&index,&c);publish();}continue;}TranslateMessage(msg);DispatchMessageA(msg);}SetSysColors(1,&index,&old);
}
`;
function fixture(out){
 fs.writeFileSync(out+'/fixture.c',source);
 const libs={kernel32:['GetModuleHandleA@4','GetCommandLineA@0'],user32:['CreateWindowExA@48','ShowWindow@8','RegisterClassA@4','DefWindowProcA@16','GetDlgCtrlID@4','SetWindowTextA@8','GetMessageA@16','TranslateMessage@4','DispatchMessageA@4','BeginPaint@8','EndPaint@8','FillRect@12','InvalidateRect@12','UpdateWindow@4','GetWindowTextA@12','GetWindowTextLengthA@4','GetWindowLongA@8','GetClientRect@8','GetWindowRect@8','IsWindow@4','IsWindowVisible@4','IsWindowEnabled@4','GetSysColor@4','GetSysColorBrush@4','SetSysColors@12'],gdi32:['GetStockObject@4','GetObjectA@12']};
 for(const[dll,names]of Object.entries(libs)){fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib'],{timeout:15000});}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-Wall','-Wextra','-Werror','-Wno-unused-parameter','-c',out+'/fixture.c','-o',out+'/fixture.obj'],{timeout:15000});
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/static-grayrect-win95-shadow.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib',out+'/gdi32.lib'],{timeout:15000});return fs.readFileSync(out+'/static-grayrect-win95-shadow.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n');
 const runtime=require('../tools/boids-current-runtime.cjs'),commit=cp.execFileSync('git',['rev-parse',process.env.STATIC_SHADOW_COMMIT||'HEAD'],{cwd:root,encoding:'utf8'}).trim(),files=runtime.gitFiles(commit),own='src/09c3-controls0-basic-wndprocs.wat';
 files.set(own,fs.readFileSync(root+'/'+own));
 if(!process.env.STATIC_SHADOW_COMMITTED_RUNTIME)for(const n of files.keys())if(fs.existsSync(root+'/'+n))files.set(n,fs.readFileSync(root+'/'+n));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{cwd:root,maxBuffer:8e6}));
 const initial=process.env.STATIC_SHADOW_INITIAL==='B'?1:0,cases=[colors[initial],colors[1-initial],colors[initial]];
 const wasm=process.env.STATIC_SHADOW_MODULE?fs.readFileSync(process.env.STATIC_SHADOW_MODULE):runtime.compile(files),pe=fixture(out);fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));files.set('build/wine-assembly.wasm',wasm);files.set('static-grayrect-win95-shadow.exe',pe);
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
 await page.evaluate(async initial=>{const c=document.createElement('canvas');c.width=1000;c.height=700;c.style='position:fixed;left:0;top:0;z-index:99999;width:1000px;height:700px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.staticHost=new WineAssembly();staticHost.renderer=new Win98Renderer(c);await staticHost.init(c);if(!staticHost.guestWorker)throw Error('production Worker required');await staticHost.loadExe('/static-grayrect-win95-shadow.exe',{args:initial?'B':'A'});staticHost.run();},initial);
 await page.waitForFunction(()=>Object.values(staticHost.renderer.windows).some(w=>w.title?.startsWith('0 ')),{timeout:120000});
 await page.evaluate(()=>{browserInput.wireCanvasInput(staticHost.renderer.canvas,staticHost.renderer,{runningApps:[{wine:staticHost}],debugMode:true});staticHost.renderer.canvas.focus();});
 const native=args=>cp.execFileSync('xdotool',args,{env:display.env,timeout:15000}),wins=native(['search','--onlyvisible','--pid',String(browser.process().pid),'--class','chrome']).toString().trim().split(/\s+/);assert.equal(wins.length,1);native(['windowactivate','--sync',wins[0]]);
 save('native-input.json',{route:'two initial public SetSysColors variants before creation; private X11 XTEST F8 toggles shadow then explicitly invalidates and UpdateWindow' ,window:wins[0],cases});
 let nativeOrigin=null;
 for(let stage=0;stage<cases.length;++stage){
  if(stage)native(['key','F8']);await page.waitForFunction(j=>Object.values(staticHost.renderer.windows).some(w=>w.title?.startsWith(j+' ')),{timeout:90000},stage);
await new Promise(r=>setTimeout(r,300));
  const s=await page.evaluate(()=>{const encode=a=>{let s='';for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode(...a.subarray(i,i+8192));return btoa(s);};const h=staticHost,r=h.renderer,w=Object.values(r.windows).find(w=>w.title==='Authored STATIC Windows95 shadow'),p=w._backCanvas._waCanonicalPresentation;return {report:Object.values(r.windows).find(w=>w.isChild&&w.x===15&&w.y===230)?.title,rows:Object.values(r.windows).map(v=>({hwnd:v.hwnd,title:v.title,x:v.x,y:v.y,w:v.w,h:v.h,isChild:v.isChild})),gdi:p?{sharedGuestStorage:p.surface.storage.buffer===h.memory.buffer,pixels:encode(p.surface.rgbaRect(0,0,w.w,w.h))}:null,pixels:encode(w._backCanvas.getContext('2d').getImageData(0,0,w.w,w.h).data),width:w.w,height:w.h,frame:{x:w.x,y:w.y},canvas:r.canvas.getBoundingClientRect().toJSON()};});
  save('stage-'+stage+'-public.json',{report:s.report,rows:s.rows});const parts=s.report.trim().split(/\s+/),nums=parts.map(Number),c=cases[stage];

  assert.deepEqual(nums.slice(0,4),[stage,initial,1,c]);assert(nums[4]>0);assert.deepEqual(nums.slice(5,9),[12,0,c,0],'public BS_SOLID system brush exact chosen color');let at=9,firstRect;const hwnds=[];
  for(let j=0;j<3;++j){assert.deepEqual(nums.slice(at,at+3),[1,1,1]);at+=3;const hwnd=nums[at++];hwnds.push(hwnd);assert.deepEqual(nums.slice(at,at+11),[6,6,...Buffer.from('Rect42'),0,0x13572468,0x24681357],'public caption NUL/canaries');at+=11;
   assert.deepEqual(nums.slice(at,at+7),[11+j,0x50000004+j,0,0,0,168,24],'public ID/style/client');at+=7;const q=nums.slice(at,at+4);at+=4;if(!j)firstRect=q;assert.deepEqual(q,[firstRect[0],firstRect[1]+j*40,firstRect[0]+168,firstRect[1]+j*40+24]);assert.deepEqual(nums.slice(at,at+3),[1,1,1]);at+=3;const row=s.rows.find(v=>v.hwnd===hwnd);assert(row&&row.title==='Rect42'&&row.w===168&&row.h===24);
  }assert.equal(at,nums.length);const publicOK=true;
  assert(s.gdi?.sharedGuestStorage);const pix=Buffer.from(s.pixels,'base64'),gd=Buffer.from(s.gdi.pixels,'base64'),surfaces=[];
  function crop(x,y,w,h){const bytes=Buffer.alloc(w*h*4);for(let r=0;r<h;++r){const at=((y+r)*s.width+x)*4;pix.copy(bytes,r*w*4,at,at+w*4);assert(pix.subarray(at,at+w*4).equals(gd.subarray(at,at+w*4)),'GDI/backcanvas');}surfaces.push({x,y,w,h,bytes});return bytes;}
  const equal=[];
  for(let j=0;j<3;++j){const actual=crop(18,63+j*40,168,24),reference=crop(233,63+j*40,168,24),same=actual.equals(reference);equal.push(same);assert.equal(same,!expectOld||j!==1,'whole independent public FillRect reference style='+j);if(!same)failures.push({stage,j,visibleMismatch:true});
   const value=j===0?0:j===1?c:0xffffff,rgba=Buffer.from([value&255,(value>>>8)&255,(value>>>16)&255,255]);for(let k=0;k<reference.length;k+=4)if(!reference.subarray(k,k+4).equals(rgba)){save('pixel-failure.json',{j,k,expected:[...rgba],actual:[...reference.subarray(k,k+4)]});await page.screenshot({path:out+'/pixel-failure.png'});throw Error('every reference pixel fixed chosen color');}
  }const visibleEqual=equal.every(Boolean);
  await page.screenshot({path:out+'/stage-'+stage+'-composited.png'});require('../tools/browser-transients.cjs').captureWhole(out,'stage-'+stage+'-desktop',display.env);
  const{PNG}=require('pngjs'),composite=PNG.sync.read(fs.readFileSync(out+'/stage-'+stage+'-composited.png')),desktop=PNG.sync.read(fs.readFileSync(out+'/stage-'+stage+'-desktop.png'));
  const match=(png,v,ox,oy)=>{const x=Math.round(ox+v.x),y=Math.round(oy+v.y);if(x<0||y<0||x+v.w>png.width||y+v.h>png.height)return false;for(let r=0;r<v.h;++r)if(!png.data.subarray(((y+r)*png.width+x)*4,((y+r)*png.width+x+v.w)*4).equals(v.bytes.subarray(r*v.w*4,(r+1)*v.w*4)))return false;return true;};
  assert(surfaces.every(v=>match(composite,v,s.canvas.x+s.frame.x,s.canvas.y+s.frame.y)),'compositor exact');
  if(!nativeOrigin){const v=surfaces[0],needle=v.bytes.subarray(6*v.w*4,7*v.w*4);for(let at=desktop.data.indexOf(needle);at>=0;at=desktop.data.indexOf(needle,at+1)){if(at%4)continue;const ox=at/4%desktop.width-v.x,oy=Math.floor(at/4/desktop.width)-v.y-6;if(surfaces.every(v=>match(desktop,v,ox,oy))){nativeOrigin={x:ox,y:oy};break;}}}
  assert(nativeOrigin&&surfaces.every(v=>match(desktop,v,nativeOrigin.x,nativeOrigin.y)),'native desktop exact at fixed origin');
  states.push({stage,publicOK,visibleEqual,report:s.report,hwnds,nativeOrigin,exactGDI:true,exactCompositor:true,exactNativeDesktop:true,surfaces:surfaces.map(({bytes,...v})=>({...v,sha256:sha(bytes)}))});save('states.json',states);
 }
 const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);const cpuState=await cpu.evaluate(()=>{const names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,registers:Object.fromEntries(names.map(n=>[n,instance.exports[n]()>>>0]))};});save('cpu-state.json',cpuState);assert.equal(cpuState.memoryBytes,536870912);assert.equal(Object.keys(cpuState.registers).length,19);assert(cpuState.registers.get_eip&&cpuState.registers.get_esp);
 await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));save('assertions.json',{expectOld,failures,states:states.length,productionBrowserCPU:true});
 if(expectOld)assert.equal(failures.length,cases.length,'physical old grayrect fails every color request');else assert.deepEqual(failures,[]);console.log('PASS',expectOld?'physical preedit oldFAIL':'STATIC Windows95 shadow exact public state and four planes',states.length);
 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('deferred-transients.json',{root:transient.root,downloads:transient.downloads});if(display)await display.close();}
}
if(require.main===module)(main(process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync('/dev/shm/static-grayrect-win95-shadow-'),{expectOld:process.argv.includes('--expect-old')})).catch(e=>{console.error(e.stack);process.exitCode=1;});module.exports={fixture,main,colors};
