'use strict';
// Enabled visible ANSI SS_LEFT/SS_LEFTNOWORDWRAP parent color contract.
// Microsoft WIN32.HLP (1992-94) 490/492/1954/493/3753/6306 (Chicago: Yes).
// Style-specific SS_SIMPLE restriction inspected first; SS_SIMPLE excluded.
// DrawText topic2053: fixed LEFT/TOP, EXPANDTABS, WORDBREAK or SINGLELINE.
// Short explicit-fit text, stock font, one font-cell height; no layout claims.
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
int API IsWindow(P);int API IsWindowVisible(P);int API IsWindowEnabled(P);P API WindowFromDC(P);P API GetDC(P);int API ReleaseDC(P,P);int API GetClipBox(P,P);
P API BeginPaint(P,P);int API EndPaint(P,P);int API FillRect(P,P,P);int API InvalidateRect(P,P,int);int API UpdateWindow(P);
P API GetStockObject(int);P API SelectObject(P,P);int API SetBkMode(P,int);U API SetTextColor(P,U);U API SetBkColor(P,U);U API GetTextColor(P);U API GetBkColor(P);P API CreateSolidBrush(U);int API DrawTextA(P,const char*,int,P,U);int API GetTextExtentPoint32A(P,const char*,int,P);
struct WC{U style;P proc;int cex,wex;P instance,icon,cursor,brush;const char* menu;const char* name;};struct R{int l,t,r,b;};
static P frame,label[2],status,ref[2],brushes[2];static int stage=0,phase;static U count[2],argFrame[2],argLabel[2],argDC[2],argOwner[2],clipOK[2],colorsOK[2],timingOK[2];static char report[2048];
U fg(void){return stage==1?0xc14216:0x1529b7;}U bg(void){return stage==1?0x67e4b2:0x91d5ee;}P brush(void){return brushes[stage==1];}
void num(U n,int* at){char d[12];int k=0;do{d[k++]='0'+n%10;n/=10;}while(n);while(k)report[(*at)++]=d[--k];report[(*at)++]=' ';}
long __stdcall reference(P h,U m,U w,long l){
 if(m==0x138){for(int j=0;j<2;++j)if((P)l==label[j]){struct R q;P dc=(P)w;++count[j];argFrame[j]=(U)h;argLabel[j]=(U)l;argDC[j]=(U)dc;argOwner[j]=(U)WindowFromDC(dc);
  clipOK[j]=WindowFromDC(dc)==label[j]&&GetClipBox(dc,&q)==2&&q.l==0&&q.t==0&&q.r==168&&q.b==16;
  SetTextColor(dc,fg());SetBkColor(dc,bg());SetBkMode(dc,2);colorsOK[j]=GetTextColor(dc)==fg()&&GetBkColor(dc)==bg();timingOK[j]=phase==j+1;
  struct R marker={150,4,164,11};FillRect(dc,&marker,(P)4);return (long)brush();}}
 if(m==15){U ps[16];P dc=BeginPaint(h,ps);struct R q={0,0,168,16};int j=GetDlgCtrlID(h)-30;if(j>=0&&j<2){
  FillRect(dc,&q,brush());SelectObject(dc,GetStockObject(16));SetBkMode(dc,2);SetTextColor(dc,fg());SetBkColor(dc,bg());DrawTextA(dc,"Label42",7,&q,(j?0x60:0x50));}
  EndPaint(h,ps);return 0;}return DefWindowProcA(h,m,w,l);}
void publish(void){int at=0;num(stage,&at);num((U)frame,&at);num((U)GetStockObject(16),&at);for(int j=0;j<2;++j){
 volatile struct {U pre;char b[32];U post;} guarded={0x13572468,{0},0x24681357};struct R q;U before=count[j];
 argFrame[j]=argLabel[j]=argDC[j]=argOwner[j]=clipOK[j]=colorsOK[j]=timingOK[j]=0;
 P dc=GetDC(label[j]);struct {int x,y;} fit;SelectObject(dc,GetStockObject(16));num(GetTextExtentPoint32A(dc,"Label42",7,&fit),&at);num(fit.x,&at);num(fit.y,&at);num((U)dc,&at);num(ReleaseDC(label[j],dc),&at);phase=0;num(InvalidateRect(label[j],0,1),&at);num(count[j]==before,&at);
 phase=j+1;num(UpdateWindow(label[j]),&at);phase=0;num(count[j]-before,&at);num((U)label[j],&at);num(argFrame[j],&at);num(argLabel[j],&at);num(argDC[j],&at);num(argOwner[j],&at);num(clipOK[j],&at);num(colorsOK[j],&at);num(timingOK[j],&at);
 U after=count[j];num(UpdateWindow(label[j]),&at);num(count[j]==after,&at);
 int n=GetWindowTextA(label[j],(char*)guarded.b,32);num(n,&at);num(GetWindowTextLengthA(label[j]),&at);for(int k=0;k<=n;++k)num((unsigned char)guarded.b[k],&at);num(guarded.pre,&at);num(guarded.post,&at);
 num(GetDlgCtrlID(label[j]),&at);num(SendMessageA(label[j],0x31,0,0),&at);num(GetWindowLongA(label[j],-16),&at);num(GetWindowLongA(label[j],-20),&at);
 GetClientRect(label[j],&q);num(q.l,&at);num(q.t,&at);num(q.r,&at);num(q.b,&at);GetWindowRect(label[j],&q);num(q.l,&at);num(q.t,&at);num(q.r,&at);num(q.b,&at);
 num(IsWindowVisible(label[j]),&at);num(IsWindowEnabled(label[j]),&at);num(IsWindow(label[j]),&at);InvalidateRect(ref[j],0,1);UpdateWindow(ref[j]);}report[at]=0;SetWindowTextA(status,report);}
void start(void){P i=GetModuleHandleA(0);struct WC wc={0,reference,0,0,0,0,0,(P)16,0,"StaticNowrapColorReference"};wc.instance=i;RegisterClassA(&wc);
 brushes[0]=CreateSolidBrush(0xe3a647);brushes[1]=CreateSolidBrush(0x9435d8);
 frame=CreateWindowExA(0,"StaticNowrapColorReference","Authored STATIC nowrap parent colors",0x10c80000,12,12,720,390,0,0,i,0);
 for(int j=0;j<2;++j){label[j]=CreateWindowExA(0,"STATIC","Label42",0x50000000|(j?12:0),15,40+j*40,168,16,frame,(P)(11+j),i,0);SendMessageA(label[j],0x30,(U)GetStockObject(16),1);
 ref[j]=CreateWindowExA(0,"StaticNowrapColorReference","",0x50000000,230,40+j*40,168,16,frame,(P)(30+j),i,0);}
 status=CreateWindowExA(0,"STATIC","READY",0x50000000,15,230,680,60,frame,(P)20,i,0);ShowWindow(frame,5);publish();
 U msg[12];while(GetMessageA(msg,0,0,0)>0){if((msg[1]==0x100||msg[1]==0x101)&&msg[2]==0x77){if(msg[1]==0x100&&stage<2){++stage;publish();}continue;}TranslateMessage(msg);DispatchMessageA(msg);}
}
`;
function fixture(out){
 fs.writeFileSync(out+'/fixture.c',source);
 const libs={"kernel32":["GetModuleHandleA@4"],"user32":["CreateWindowExA@48","ShowWindow@8","RegisterClassA@4","DefWindowProcA@16","GetDlgCtrlID@4","SetWindowTextA@8","SendMessageA@16","GetMessageA@16","TranslateMessage@4","DispatchMessageA@4","BeginPaint@8","EndPaint@8","FillRect@12","InvalidateRect@12","UpdateWindow@4","GetWindowTextA@12","GetWindowTextLengthA@4","GetWindowLongA@8","GetClientRect@8","GetWindowRect@8","IsWindow@4","IsWindowVisible@4","IsWindowEnabled@4","WindowFromDC@4","GetDC@4","ReleaseDC@8","DrawTextA@20"],"gdi32":["GetTextExtentPoint32A@16","GetStockObject@4","SelectObject@8","SetTextColor@8","SetBkMode@8","TextOutA@20","GetClipBox@8","SetBkColor@8","GetBkColor@4","GetTextColor@4","CreateSolidBrush@4"]};
 for(const[dll,names]of Object.entries(libs)){fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib'],{timeout:15000});}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-Wall','-Wextra','-Werror','-Wno-unused-parameter','-c',out+'/fixture.c','-o',out+'/fixture.obj'],{timeout:15000});
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/static-nowrap-parent-color.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib',out+'/gdi32.lib'],{timeout:15000});return fs.readFileSync(out+'/static-nowrap-parent-color.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n');
 const runtime=require('../tools/boids-current-runtime.cjs'),commit=cp.execFileSync('git',['rev-parse',process.env.STATIC_NOWRAP_COLOR_COMMIT||'HEAD'],{cwd:root,encoding:'utf8'}).trim(),files=runtime.gitFiles(commit),own='src/09c3-controls0-basic-wndprocs.wat';
 files.set(own,fs.readFileSync(root+'/'+own));
 if(!process.env.STATIC_NOWRAP_COLOR_COMMITTED_RUNTIME)for(const n of files.keys())if(fs.existsSync(root+'/'+n))files.set(n,fs.readFileSync(root+'/'+n));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{cwd:root,maxBuffer:8e6}));
 const wasm=process.env.STATIC_NOWRAP_COLOR_MODULE?fs.readFileSync(process.env.STATIC_NOWRAP_COLOR_MODULE):runtime.compile(files),pe=fixture(out);fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));files.set('build/wine-assembly.wasm',wasm);files.set('static-nowrap-parent-color.exe',pe);
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
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=700;c.style='position:fixed;left:0;top:0;z-index:99999;width:1000px;height:700px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.staticHost=new WineAssembly();staticHost.renderer=new Win98Renderer(c);await staticHost.init(c);if(!staticHost.guestWorker)throw Error('production Worker required');await staticHost.loadExe('/static-nowrap-parent-color.exe');staticHost.run();});
 await page.waitForFunction(()=>Object.values(staticHost.renderer.windows).some(w=>w.title?.startsWith('0 ')),{timeout:120000});
 await page.evaluate(()=>{browserInput.wireCanvasInput(staticHost.renderer.canvas,staticHost.renderer,{runningApps:[{wine:staticHost}],debugMode:true});staticHost.renderer.canvas.focus();});
 const native=args=>cp.execFileSync('xdotool',args,{env:display.env,timeout:15000}),wins=native(['search','--onlyvisible','--pid',String(browser.process().pid),'--class','chrome']).toString().trim().split(/\s+/);assert.equal(wins.length,1);native(['windowactivate','--sync',wins[0]]);
 save('native-input.json',{route:'initial A, private X11 XTEST F8 B/A; authored message loop changes explicit colors, invalidates label, UpdateWindow synchronously calls parent' ,window:wins[0],cases});
 let nativeOrigin=null;
 for(let stage=0;stage<cases.length;++stage){
  if(stage)native(['key','F8']);await page.waitForFunction(j=>Object.values(staticHost.renderer.windows).some(w=>w.title?.startsWith(j+' ')),{timeout:90000},stage);
await new Promise(r=>setTimeout(r,300));
  const s=await page.evaluate(()=>{const encode=a=>{let s='';for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode(...a.subarray(i,i+8192));return btoa(s);};const h=staticHost,r=h.renderer,w=Object.values(r.windows).find(w=>w.title==='Authored STATIC nowrap parent colors'),p=w._backCanvas._waCanonicalPresentation;return {report:Object.values(r.windows).find(w=>w.isChild&&w.x===15&&w.y===230)?.title,rows:Object.values(r.windows).map(v=>({hwnd:v.hwnd,title:v.title,x:v.x,y:v.y,w:v.w,h:v.h,isChild:v.isChild})),gdi:p?{sharedGuestStorage:p.surface.storage.buffer===h.memory.buffer,pixels:encode(p.surface.rgbaRect(0,0,w.w,w.h))}:null,pixels:encode(w._backCanvas.getContext('2d').getImageData(0,0,w.w,w.h).data),width:w.w,height:w.h,frame:{x:w.x,y:w.y},canvas:r.canvas.getBoundingClientRect().toJSON()};});
  save('stage-'+stage+'-public.json',{report:s.report,rows:s.rows});const parts=s.report.trim().split(/\s+/),nums=parts.map(Number),c=cases[stage];
  assert.equal(nums[0],stage);const frame=nums[1],font=nums[2];assert(frame&&font);let at=3,firstRect;const callbacks=[];
  for(let j=0;j<2;++j){assert.equal(nums[at++],1);const fit=nums.slice(at,at+2);at+=2;assert(fit[0]>0&&fit[0]<168);assert(fit[1]>0&&fit[1]<=16,"explicit text fits fixed control height");const dc=nums[at++];assert(dc);assert.deepEqual(nums.slice(at,at+4),[1,1,1,1],'release/invalidate/no premature callback/update');at+=4;
   const count=nums[at++],hwnd=nums[at++],args=nums.slice(at,at+7);at+=7;const qualified=!expectOld||j===0;
   assert.equal(count,qualified?1:0,'exact callback count alignment='+j);assert.equal(args[2]>0,qualified,'live callback HDC');assert.deepEqual(args,qualified?[frame,hwnd,args[2],hwnd,1,1,1]:[0,0,0,0,0,0,0],'exact callback HWND/public WindowFromDC/clip/colors/synchronous phase');callbacks.push({j,count,hwnd,publicGetDC:dc,callbackDC:args[2],args});
   assert.deepEqual(nums.slice(at,at+2),[1,1],'clean UpdateWindow sends no callback');at+=2;
   assert.deepEqual(nums.slice(at,at+12),[7,7,...Buffer.from('Label42'),0,0x13572468,0x24681357],'public text/NUL/canaries');at+=12;
   assert.deepEqual(nums.slice(at,at+8),[11+j,font,0x50000000+(j?12:0),0,0,0,168,16],'public ID/font/styles/client geometry');at+=8;
   const q=nums.slice(at,at+4);at+=4;if(!j)firstRect=q;assert.deepEqual(q,[firstRect[0],firstRect[1]+j*40,firstRect[0]+168,firstRect[1]+j*40+16]);
   assert.deepEqual(nums.slice(at,at+3),[1,1,1]);at+=3;const row=s.rows.find(v=>v.hwnd===hwnd);assert(row&&row.title==='Label42'&&row.w===168&&row.h===16);
  }assert.equal(at,nums.length);const publicOK=callbacks.every(v=>v.count===1);
  assert(s.gdi?.sharedGuestStorage);const pix=Buffer.from(s.pixels,'base64'),gd=Buffer.from(s.gdi.pixels,'base64'),surfaces=[];
  function crop(x,y,w,h){const bytes=Buffer.alloc(w*h*4);for(let r=0;r<h;++r){const at=((y+r)*s.width+x)*4;pix.copy(bytes,r*w*4,at,at+w*4);assert(pix.subarray(at,at+w*4).equals(gd.subarray(at,at+w*4)),'GDI/backcanvas');}surfaces.push({x,y,w,h,bytes});return bytes;}
  // Independent public DrawText references use fixed text, fixed TOP/LEFT flags,
  // stock font and geometry; no control pixels or internal state supply them.
  const equal=[];
  for(let j=0;j<2;++j){const actual=crop(6+15,26+40+j*40,168,16),reference=crop(6+230,26+40+j*40,168,16),same=actual.equals(reference);equal.push(same);
   assert.equal(same,!expectOld||j===0,'independent whole DrawText alignment='+j);if(!same)failures.push({stage,j,callbackCount:callbacks[j].count,visibleMismatch:true});
   const colorCounts={};for(let i=0;i<reference.length;i+=4){const key=reference.subarray(i,i+3).toString('hex');colorCounts[key]=(colorCounts[key]||0)+1;}
   for(const value of [c.fg,c.bg,c.brush]){const key=Buffer.from([value&255,(value>>>8)&255,(value>>>16)&255]).toString('hex');assert(colorCounts[key]>10,'separately visible foreground/background/brush '+key);}
  }const visibleEqual=equal.every(Boolean);
  await page.screenshot({path:out+'/stage-'+stage+'-composited.png'});require('../tools/browser-transients.cjs').captureWhole(out,'stage-'+stage+'-desktop',display.env);
  const{PNG}=require('pngjs'),composite=PNG.sync.read(fs.readFileSync(out+'/stage-'+stage+'-composited.png')),desktop=PNG.sync.read(fs.readFileSync(out+'/stage-'+stage+'-desktop.png'));
  const match=(png,v,ox,oy)=>{const x=Math.round(ox+v.x),y=Math.round(oy+v.y);if(x<0||y<0||x+v.w>png.width||y+v.h>png.height)return false;for(let r=0;r<v.h;++r)if(!png.data.subarray(((y+r)*png.width+x)*4,((y+r)*png.width+x+v.w)*4).equals(v.bytes.subarray(r*v.w*4,(r+1)*v.w*4)))return false;return true;};
  assert(surfaces.every(v=>match(composite,v,s.canvas.x+s.frame.x,s.canvas.y+s.frame.y)),'compositor exact');
  if(!nativeOrigin){const v=surfaces[0],needle=v.bytes.subarray(6*v.w*4,7*v.w*4);for(let at=desktop.data.indexOf(needle);at>=0;at=desktop.data.indexOf(needle,at+1)){if(at%4)continue;const ox=at/4%desktop.width-v.x,oy=Math.floor(at/4/desktop.width)-v.y-6;if(surfaces.every(v=>match(desktop,v,ox,oy))){nativeOrigin={x:ox,y:oy};break;}}}
  assert(nativeOrigin&&surfaces.every(v=>match(desktop,v,nativeOrigin.x,nativeOrigin.y)),'native desktop exact at fixed origin');
  states.push({stage,publicOK,visibleEqual,report:s.report,callbacks,nativeOrigin,exactGDI:true,exactCompositor:true,exactNativeDesktop:true,surfaces:surfaces.map(({bytes,...v})=>({...v,sha256:sha(bytes)}))});save('states.json',states);
 }
 const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);const cpuState=await cpu.evaluate(()=>{const names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,registers:Object.fromEntries(names.map(n=>[n,instance.exports[n]()>>>0]))};});save('cpu-state.json',cpuState);assert.equal(cpuState.memoryBytes,536870912);assert.equal(Object.keys(cpuState.registers).length,19);assert(cpuState.registers.get_eip&&cpuState.registers.get_esp);
 await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));save('assertions.json',{expectOld,failures,states:states.length,productionBrowserCPU:true});
 if(expectOld)assert.equal(failures.length,cases.length,'physical old parent callback fails every native request');else assert.deepEqual(failures,[]);console.log('PASS',expectOld?'physical preedit oldFAIL':'STATIC LEFT/CENTER/RIGHT exact parent callbacks/colors/brush/four planes',states.length);
 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('deferred-transients.json',{root:transient.root,downloads:transient.downloads});if(display)await display.close();}
}
if(require.main===module)(main(process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync('/dev/shm/static-nowrap-parent-color-'),{expectOld:process.argv.includes('--expect-old')})).catch(e=>{console.error(e.stack);process.exitCode=1;});module.exports={fixture,main,cases};
