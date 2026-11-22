'use strict';
// Microsoft Visual C++ 4 (September 1995), Volume 3 p172; WIN32.HLP topics3503/3607.
// Ordinary ANSI CBS_SIMPLE, flags0, one matching authored file per wildcard.
// Explicit caller geometry; no ordering, drives, owner-draw or automatic sizing claims.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);P API GetDlgItem(P,int);int API MoveWindow(P,int,int,int,int,int);int API GetWindowRect(P,int*);
unsigned short API RegisterClassA(const void*);long API DefWindowProcA(P,U,U,long);P API SetFocus(P);int API SetWindowTextA(P,const char*);
long API SendMessageA(P,U,U,long);int API GetMessageA(P,P,U,U);int API TranslateMessage(P);long API DispatchMessageA(P);int API InvalidateRect(P,P,int);int API UpdateWindow(P);
P API BeginPaint(P,P);int API EndPaint(P,P);int API FillRect(P,P,P);P API GetStockObject(int);P API SelectObject(P,P);int API SetBkMode(P,int);U API SetTextColor(P,U);P API CreateSolidBrush(U);int API DeleteObject(P);int API TextOutA(P,int,int,const char*,int);int API DrawEdge(P,P,U,U);
int API CreateDirectoryA(const char*,P);P API CreateFileA(const char*,U,U,P,U,U,P);int API CloseHandle(P);U API GetFileAttributesA(const char*);
struct WC{U style;P proc;int cex,wex;P instance,icon,cursor,brush;const char* menu;const char* name;};
static P frame,combo,lb,edit,refs[2],status,button,instance,font;static int stage=-1,ready,created,ret=-99,notifications;static char report[3000];
static const char* rows[3]={"seed text","alpha.txt","bravo.txt"};
void number(int n,int* at){char d[12];int k=0;if(n<0){report[(*at)++]='-';n=-n;}do{d[k++]='0'+n%10;n/=10;}while(n);while(k)report[(*at)++]=d[--k];report[(*at)++]=' ';}
int len(const char* p){int n=0;while(p[n])++n;return n;}
void fill(P dc,int x,int y,int r,int b,U color){int rc[4]={x,y,r,b};P br=CreateSolidBrush(color);FillRect(dc,rc,br);DeleteObject(br);}
long __stdcall paint(P h,U m,U w,long l){if(m==15){unsigned char ps[80];P dc=BeginPaint(h,ps);int field=refs[1]==h;
 fill(dc,0,0,180,field?21:100,0xffffff);int rect[4]={field?2:0,field?2:0,field?178:180,field?19:100};DrawEdge(dc,rect,10,15);SelectObject(dc,font);SetBkMode(dc,1);SetTextColor(dc,0);
 if(field){TextOutA(dc,6,6,rows[stage==3?1:0],len(rows[stage==3?1:0]));}else for(int j=0;j<(stage==0?1:stage==1?2:3);++j){if(j==(stage==3?1:0)){fill(dc,3,3+j*28,177,3+(j+1)*28,0x800000);SetTextColor(dc,0xffffff);}TextOutA(dc,5,5+j*28,rows[j],len(rows[j]));SetTextColor(dc,0);}
 EndPaint(h,ps);return 0;}return DefWindowProcA(h,m,w,l);}
void text(P h,int* at){char b[100];int n=SendMessageA(h,0xd,100,(long)b);number(n,at);for(int k=0;k<=n&&k<100;++k)number((unsigned char)b[k],at);}
void publish(void){++stage;SetFocus(button);
 if(stage==1||stage==2)ret=SendMessageA(combo,0x145,0,(long)(stage==1?"c:\\cbdir-private\\alpha.t*":"c:\\cbdir-private\\bravo.t*"));
 InvalidateRect(combo,0,1);UpdateWindow(combo);InvalidateRect(lb,0,1);UpdateWindow(lb);InvalidateRect(edit,0,1);UpdateWindow(edit);
 for(int i=0;i<2;++i){InvalidateRect(refs[i],0,1);UpdateWindow(refs[i]);}
 int at=0;number(stage,&at);number(created,&at);number(ret,&at);number(notifications,&at);number(GetFileAttributesA("c:\\cbdir-private\\alpha.txt"),&at);number(GetFileAttributesA("c:\\cbdir-private\\bravo.txt"),&at);
 number((int)combo,&at);number((int)lb,&at);number((int)edit,&at);number((int)font,&at);number(SendMessageA(combo,0x31,0,0),&at);number(SendMessageA(lb,0x31,0,0),&at);number(SendMessageA(edit,0x31,0,0),&at);
 int n=SendMessageA(combo,0x146,0,0);number(n,&at);number(SendMessageA(combo,0x147,0,0),&at);number(SendMessageA(combo,0x154,0,0),&at);number(SendMessageA(combo,0x140,0,0),&at);text(combo,&at);text(edit,&at);
 for(int j=0;j<n&&j<4;++j){char b[100];int k=SendMessageA(combo,0x148,j,(long)b);number(k,&at);number(SendMessageA(combo,0x149,j,0),&at);for(int v=0;v<=k&&v<100;++v)number((unsigned char)b[v],&at);}
 for(int i=0;i<3;++i){int rc[4];GetWindowRect(i==0?combo:i==1?edit:lb,rc);for(int k=0;k<4;++k)number(rc[k],&at);}
 report[at]=0;SetWindowTextA(status,report);}
long __stdcall proc(P h,U m,U w,long l){if(m==0x111&&(w&65535)==10&&(w>>16)==1){++notifications;return 0;}if(m==0x111&&(w&65535)==20&&!ready){
 combo=CreateWindowExA(0,"COMBOBOX","",0x50010081,15,35,180,121,frame,(P)10,instance,0);SendMessageA(combo,0x143,0,(long)rows[0]);SendMessageA(combo,0x14e,0,0);lb=GetDlgItem(combo,1000);edit=GetDlgItem(combo,1001);
 SendMessageA(combo,0x30,(U)font,1);MoveWindow(edit,2,2,176,17,0);MoveWindow(lb,0,21,180,100,0);SendMessageA(combo,0x153,0,28);SendMessageA(combo,0x142,0,2|(5<<16));ready=1;publish();return 0;}return DefWindowProcA(h,m,w,l);}
void start(void){instance=GetModuleHandleA(0);font=GetStockObject(17);created=CreateDirectoryA("c:\\cbdir-private",0);const char* paths[3]={"c:\\cbdir-private\\alpha.txt","c:\\cbdir-private\\bravo.txt","c:\\cbdir-private\\excluded.bin"};for(int i=0;i<3;++i){P f=CreateFileA(paths[i],0x40000000,0,0,1,0x80,0);created=created&&f!=(P)-1;CloseHandle(f);}
 struct WC wc={0,proc,0,0,0,0,0,(P)16,0,"DirectoryMain"};wc.instance=instance;RegisterClassA(&wc);wc.proc=paint;wc.name="DirectoryRef";RegisterClassA(&wc);frame=CreateWindowExA(0,"DirectoryMain","Authored combo directory",0x10cf0000,10,10,850,350,0,0,instance,0);
 refs[0]=CreateWindowExA(0,"DirectoryRef","",0x50000000,435,56,180,100,frame,(P)30,instance,0);refs[1]=CreateWindowExA(0,"DirectoryRef","",0x50000000,630,35,180,21,frame,(P)31,instance,0);
 button=CreateWindowExA(0,"BUTTON","Ready",0x50010000,15,180,100,26,frame,(P)20,instance,0);status=CreateWindowExA(0,"STATIC","starting",0x50000000,15,230,800,75,frame,(P)21,instance,0);
 U msg[12];while(GetMessageA(msg,0,0,0)>0){if(ready&&msg[1]==0x100&&msg[2]==0x75&&stage<3){publish();continue;}TranslateMessage(msg);DispatchMessageA(msg);}}
`;

function fixture(out){
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/fixture.c',source);
 for(const [dll,names]of Object.entries({kernel32:['GetModuleHandleA@4','CreateDirectoryA@8','CreateFileA@28','CloseHandle@4','GetFileAttributesA@4'],user32:['CreateWindowExA@48','RegisterClassA@4','DefWindowProcA@16','SetFocus@4','SetWindowTextA@8','SendMessageA@16','GetMessageA@16','TranslateMessage@4','DispatchMessageA@4','InvalidateRect@12','UpdateWindow@4','BeginPaint@8','EndPaint@8','FillRect@12','DrawEdge@16','DrawTextA@20','GetDlgItem@8','MoveWindow@24','GetWindowRect@8'],gdi32:['CreateFontA@56','GetStockObject@4','SelectObject@8','SetBkMode@8','SetTextColor@8','CreateSolidBrush@4','DeleteObject@4','TextOutA@20','GetTextMetricsA@8','GetTextExtentPoint32A@16','SaveDC@4','RestoreDC@8','IntersectClipRect@20']})){
 fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/fixture.c','-o',out+'/fixture.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/directory.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib',out+'/gdi32.lib']);return fs.readFileSync(out+'/directory.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n'),pause=ms=>new Promise(r=>setTimeout(r,ms));
 const runtime=require(root+'/tools/boids-current-runtime.cjs'),commit=process.env.COMBO_DIRECTORY_COMMIT||cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files=runtime.gitFiles(commit);
 for(const n of ['src/09c3-wndprocs4-combobox.wat'])files.set(n,fs.readFileSync(root+'/'+n));
 if(process.env.COMBO_DIRECTORY_SHARED)for(const n of files.keys())if(fs.existsSync(root+'/'+n))files.set(n,fs.readFileSync(root+'/'+n));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{maxBuffer:8e6}));
 const patch=cp.execFileSync('git',['diff','--binary',commit,'--','src','lib','host.js','tools','index.html'],{maxBuffer:20e6});fs.writeFileSync(out+'/runtime.diff',patch);
 const wasm=process.env.COMBO_DIRECTORY_WASM?fs.readFileSync(process.env.COMBO_DIRECTORY_WASM):runtime.compile(files),pe=fixture(out);fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));files.set('build/wine-assembly.wasm',wasm);files.set('directory.exe',pe);
 save('runtime.json',{commit,moduleSHA256:sha(wasm),peSHA256:sha(pe),testSHA256:sha(fs.readFileSync(__filename)),files:[...files].map(([name,b])=>({name,size:b.length,sha256:sha(b)}))});
 assert(patch.equals(cp.execFileSync('git',['diff','--binary',commit,'--','src','lib','host.js','tools','index.html'],{maxBuffer:20e6})),'source changed during compile; reject before launch');
 const transient=require(root+'/tools/browser-transients.cjs').create(),logs=[],pending=[],workers=[],states=[],failures=[];let display,browser,wait,server;
 try{
 server=http.createServer((req,res)=>{const n=new URL(req.url,'http://local').pathname.slice(1)||'index.html',b=files.get(n);res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.html')?'text/html':n.endsWith('.css')?'text/css':n.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.statusCode=b?200:404;res.end(b||'missing');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 display=await require(root+'/tools/gltron-headful-display.cjs').start(out);
 browser=await require(root+'/node_modules/puppeteer').launch({headless:false,defaultViewport:{width:1100,height:800},env:transient.env(display.env),userDataDir:transient.profile,executablePath:'/opt/google/chrome/chrome',args:[...transient.args,'--window-size=1250,980','--no-sandbox','--disable-dev-shm-usage','--disable-component-update','--disable-background-networking'],protocolTimeout:90000});wait=transient.watch(browser.process());browser.process().stdout?.resume();browser.process().stderr?.resume();save('browser-version.json',{version:await browser.version()});
 const page=await browser.newPage();page.setDefaultTimeout(60000);page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>logs.push(String(e)));
 page.on('workercreated',w=>{const row={url:w.url(),modules:[]};workers.push(row);const c=w.client;c.on('Debugger.scriptParsed',v=>{if(v.scriptLanguage==='WebAssembly'||v.url.startsWith('wasm://'))pending.push(c.send('Debugger.getScriptSource',{scriptId:v.scriptId}).then(r=>row.modules.push(sha(Buffer.from(r.bytecode,'base64')))));});pending.push(c.send('Debugger.enable'));});
 await page.evaluateOnNewDocument(()=>localStorage.setItem('wine-assembly.threads','1'));await page.goto('http://127.0.0.1:'+server.address().port+'/?debug&threads&no-log');await page.waitForFunction(()=>typeof WineAssembly==='function');
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=730;c.style='position:fixed;left:0;top:0;z-index:99999;width:1000px;height:730px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.topHost=new WineAssembly();topHost.renderer=new Win98Renderer(c);await topHost.init(c);if(!topHost.guestWorker)throw Error('production Worker required');await topHost.loadExe('/directory.exe');topHost.run();});
 await page.waitForFunction(()=>Object.values(topHost.renderer.windows).some(w=>w.title==='Ready'));await page.evaluate(()=>{browserInput.wireCanvasInput(topHost.renderer.canvas,topHost.renderer,{runningApps:[{wine:topHost}],debugMode:true});topHost.renderer.canvas.focus();});
 const native=args=>cp.execFileSync('xdotool',args,{env:display.env,timeout:5000}),wins=native(['search','--onlyvisible','--pid',String(browser.process().pid),'--class','chrome']).toString().trim().split(/\s+/);assert.equal(wins.length,1);native(['windowactivate','--sync',wins[0]]);
 // Ready is an ordinary browser click; all following operations use XTEST.
 await page.mouse.click(10+6+15+30,10+26+180+12);
 save('native-input.json',{route:'XTEST F6 sends CB_DIR to public combo HWND, row selection; fixed GDI references',window:wins[0],browserPID:browser.process().pid,readinessMs:60000});
 let desktopOrigin;
 async function sample(stage){await pause(250);const s=await page.evaluate(()=>{const h=topHost,r=h.renderer,frame=Object.values(r.windows).find(w=>w.title==='Authored combo directory');const encode=a=>{let s='';for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode(...a.subarray(i,i+8192));return btoa(s);};const surfaces=[];
 // Fixed interior rectangles exclude list nonclient edges; these are emulator GDI references, not Windows inset claims.
 for(const [col,top,w,ht] of [[17,58,160,80],[17,37,156,13],[437,58,160,80],[632,37,156,13]]){const x=6+col+2,y=26+top+2,p=frame._backCanvas._waCanonicalPresentation;surfaces.push({x:frame.x+x,y:frame.y+y,w,h:ht,pixels:encode(frame._backCanvas.getContext('2d').getImageData(x,y,w,ht).data),gdi:p?{shared:p.surface.storage.buffer===h.memory.buffer,pixels:encode(p.surface.rgbaRect(x,y,w,ht))}:null});}
 return {memoryBytes:h.memory.buffer.byteLength,report:Object.values(r.windows).find(w=>w.isChild&&w.x===15&&w.y===230)?.title,surfaces};});




 assert.equal(s.memoryBytes,536870912);const got=s.report.trim().split(/\s+/).map(Number);let at=0;
 assert.equal(got[at++],stage);assert.equal(got[at++],1);const ret=got[at++],notifications=got[at++];assert.equal(notifications,stage==3?1:0);for(let i=0;i<2;++i)assert.equal(got[at++]&0x17,0,'ordinary authored file');
 const hwnd=got[at++],list=got[at++],edit=got[at++],font=got[at++];assert(hwnd&&list&&edit&&hwnd!==list);for(let i=0;i<3;++i)assert.equal(got[at++],font);
 const count=got[at++],selection=got[at++],height=got[at++],editSelection=got[at++];
 const takeText=()=>{const n=got[at++],bytes=got.slice(at,at+n+1);at+=n+1;assert.equal(bytes[n],0);return String.fromCharCode(...bytes.slice(0,n));};const text=takeText(),editText=takeText(),rows=[];
 for(let j=0;j<count;++j){const n=got[at++];assert.equal(got[at++],n);const bytes=got.slice(at,at+n+1);at+=n+1;assert.equal(bytes[n],0);rows.push(String.fromCharCode(...bytes.slice(0,n)));}
 const geometry=got.slice(at);at+=12;assert.equal(at,got.length);assert.equal(count,stage==0?1:stage==1?2:3);assert.equal(ret,stage==0?-99:stage==1?1:2);assert.equal(selection,stage==3?1:0);assert.equal(height,28);assert.equal(editSelection,stage==3?9|(9<<16):2|(5<<16));assert.equal(text,stage==3?'alpha.txt':'seed text');assert.equal(editText,text);assert.deepEqual(rows,['seed text','alpha.txt','bravo.txt'].slice(0,count));
 if(states.length)assert.deepEqual([hwnd,list,edit,font,...geometry],[...states[0].public.identities,...states[0].public.geometry]);
 s.public={ret,count,selection,height,editSelection,text,editText,rows,geometry,identities:[hwnd,list,edit,font]};s.stage=stage;s.publicPass=true;

 const surfaces=s.surfaces.map((p,i)=>{assert(p.gdi?.shared);assert.equal(p.gdi.pixels,p.pixels,'shared GDI equals backing');return {name:['simpleList','simpleField','fixedList','fixedField'][i],x:p.x,y:p.y,w:p.w,h:p.h,bytes:Buffer.from(p.pixels,'base64')};});
 s.pairs=[surfaces[0].bytes.equals(surfaces[2].bytes),surfaces[1].bytes.equals(surfaces[3].bytes)];
 if(!s.pairs.every(Boolean)||!s.publicPass)failures.push({stage,pairs:s.pairs,public:s.public});
 if(!s.pairs.every(Boolean)){save('geometry-mismatch.json',{stage,got,pairs:s.pairs,surfaces:surfaces.map(p=>({...p,bytes:p.bytes.toString('base64')}))});fs.writeFileSync(out+'/geometry-mismatch.png',await page.screenshot());}
 assert(s.pairs.every(Boolean),'independent fixed GDI references');
 const compositeBytes=await page.screenshot();require(root+'/tools/browser-transients.cjs').captureWhole(out,'stage-'+stage+'-desktop',display.env);const desktopPath=out+'/stage-'+stage+'-desktop.png';const {PNG}=require(root+'/node_modules/pngjs'),composite=PNG.sync.read(compositeBytes),desktop=PNG.sync.read(fs.readFileSync(desktopPath)),g=await page.evaluate(()=>topHost.renderer.canvas.getBoundingClientRect().toJSON());
 const match=(png,v,ox,oy)=>{const x=Math.round(ox+v.x),y=Math.round(oy+v.y);if(x<0||y<0||x+v.w>png.width||y+v.h>png.height)return false;for(let row=0;row<v.h;++row)if(!png.data.subarray(((y+row)*png.width+x)*4,((y+row)*png.width+x+v.w)*4).equals(v.bytes.subarray(row*v.w*4,(row+1)*v.w*4)))return false;return true;};
 assert(surfaces.every(v=>match(composite,v,g.x,g.y)),'compositor exact fixed geometry');const first=surfaces[2],needle=first.bytes.subarray(8*first.w*4,9*first.w*4);let origin=null;for(let at=desktop.data.indexOf(needle);at>=0;at=desktop.data.indexOf(needle,at+1)){if(at%4)continue;const ox=at/4%desktop.width-first.x,oy=Math.floor(at/4/desktop.width)-first.y-8;if(surfaces.every(v=>match(desktop,v,ox,oy))){origin={x:ox,y:oy};break;}}assert(origin,'native desktop exact all four panels at one origin');if(desktopOrigin)assert.deepEqual(origin,desktopOrigin);desktopOrigin=origin;s.fourPlanes={sharedGDI:true,backing:true,compositor:true,nativeDesktop:true,origin};

 if([0,1,3,4].includes(stage))fs.writeFileSync(out+'/stage-'+stage+'-composited.png',compositeBytes);else fs.unlinkSync(desktopPath);
 s.surfaces=surfaces.map(({bytes,...v})=>({...v,sha256:sha(bytes)}));states.push(s);save('states.json',states);
 }



 for(let stage=0;stage<4;++stage){
 if(stage){if(stage===3){native(['mousemove',String(desktopOrigin.x+10+6+15+50),String(desktopOrigin.y+10+26+56+2+28+10)]);native(['click','1']);await pause(400);}native(['key','--clearmodifiers','F6']);}
 if(expectOld&&stage===1){await page.waitForFunction(()=>topHost.crashed||topHost.exited||document.body.textContent.includes('unreachable'),{timeout:10000}).catch(()=>{});await pause(500);save('old-failure.json',{expected:'unsupported CB_DIR trap before population',logs});assert(logs.some(l=>/unreachable|unimplemented|crash/i.test(l)),'physical old CB_DIR traps');save('assertions.json',{expectOld:true,stage0:states.length,oldFAIL:'unsupported public CB_DIR trap',moduleSHA256:sha(wasm)});console.log('PASS physical pre-edit oldFAIL CB_DIR trap');break;}
 await page.waitForFunction(n=>Object.values(topHost.renderer.windows).some(w=>w.title?.startsWith(n+' ')),{timeout:15000},stage);await sample(stage);
 if(stage===0){const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);save('cpu-state.json',await cpu.evaluate(()=>{const names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,registers:Object.fromEntries(names.map(n=>[n,instance.exports[n]()>>>0]))};}));await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));}
 }
 if(!expectOld){assert.deepEqual(failures,[]);save('assertions.json',{states:states.length,failures,productionBrowserCPU:true,fourPlanes:states.every(s=>s.fourPlanes.nativeDesktop)});console.log('PASS CB_DIR public strings/state/native selection/fixed GDI/four planes',states.length);}
 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));if(process.env.COMBO_DIRECTORY_RETAIN_TRANSIENTS)save('transients-retained.json',{root:transient.root,downloads:transient.downloads,waits:wait?[await wait]:[]});else save('transients.json',await transient.cleanup(out));if(display)await display.close();}
}
if(require.main===module)main(process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync('/dev/shm/combobox-directory-'),{expectOld:process.argv.includes('--expect-old')}).catch(e=>{console.error(e.stack);process.exitCode=1;});module.exports={fixture,main};

