// Microsoft desktop primary: CB_SETITEMHEIGHT / CB_GETITEMHEIGHT and
// LB_SETITEMHEIGHT: https://learn.microsoft.com/en-us/windows/win32/controls/cb-setitemheight
// https://learn.microsoft.com/en-us/windows/win32/controls/cb-getitemheight
// https://learn.microsoft.com/en-us/windows/win32/controls/lb-setitemheight
// Fixed rows wParam=0 only; preserve selection-field -1 compatibility.
// No variable owner-draw parity or Windows pixel-equivalence assertion.
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const heights=[16,24,24,32,32,32,32,8,255,1,1,24,24,24,24,24];
const tops=[0,0,0,0,0,0,10,2,0,0,0,0,0,0,0,0];
const sels=[2,2,2,2,1,1,11,11,11,11,11,2,2,2,2,2];
const opened=new Set([2,3,5,6,7,8,9,10,12,14,15]);
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);P API GetCapture(void);P API GetDlgItem(P,int);P API GetWindow(P,U);int API EnumWindows(P,long);
unsigned short API RegisterClassA(const void*);long API DefWindowProcA(P,U,U,long);P API SetFocus(P);P API GetFocus(void);int API GetDlgCtrlID(P);int API SetWindowTextA(P,const char*);int API DestroyWindow(P);int API MoveWindow(P,int,int,int,int,int);int API GetWindowRect(P,void*);
long API SendMessageA(P,U,U,long);int API GetMessageA(P,P,U,U);int API TranslateMessage(P);long API DispatchMessageA(P);
struct WC{U style;P proc;int cex,wex;P instance,icon,cursor,brush;const char* menu;const char* name;};
static P frame,combo,list,ref,status,button,instance;static int stage,ready,notifications,guard=1,ret=99;static char report[500];
static int heights[16]={16,24,24,32,32,32,32,8,255,1,1,24,24,24,24,24};
static int tops[16]={0,0,0,0,0,0,10,2,0,0,0,0,0,0,0,0};
static int sels[16]={2,2,2,2,1,1,11,11,11,11,11,2,2,2,2,2};
static const char* items[12]={"Option 00","Option 01","Option 02","Option 03","Option 04","Option 05","Option 06","Option 07","Option 08","Option 09","Option 10","Option 11"};
void number(int n,int* at){char d[12];int k=0;if(n<0){report[(*at)++]='-';n=-n;}do{d[k++]='0'+n%10;n/=10;}while(n);while(k)report[(*at)++]=d[--k];report[(*at)++]=' ';}
int same(char* a,const char* b){int j=0;while(a[j]&&a[j]==b[j])++j;return a[j]==b[j];}
void add(P h,int cb){for(int j=0;j<12;++j){SendMessageA(h,cb?0x143:0x180,0,(long)items[j]);SendMessageA(h,cb?0x151:0x19a,j,0x12340000+j);}SendMessageA(h,cb?0x14e:0x186,2,0);}
int __stdcall findlist(P h,long l){if(GetWindow(h,4)==combo){P child=GetDlgItem(h,1000);if(child)list=child;}return 1;}
void make(int variant){combo=CreateWindowExA(0,"COMBOBOX","",0x50200000|variant,15,40,180,89,frame,(P)10,instance,0);list=GetDlgItem(combo,1000);if(!list)EnumWindows(findlist,0);add(combo,1);}
void height(int n){char before[100],after[100];int wr[4],wr2[4];P f=GetFocus(),cap=GetCapture();int sel=SendMessageA(combo,0x147,0,0),count=SendMessageA(combo,0x146,0,0),drop=SendMessageA(combo,0x157,0,0),nc=notifications,field=SendMessageA(combo,0x154,(U)-1,0),extent=SendMessageA(combo,0x15d,0,0);SendMessageA(combo,0xd,100,(long)before);GetWindowRect(combo,wr);
 ret=SendMessageA(combo,0x153,0,n);SendMessageA(combo,0xd,100,(long)after);GetWindowRect(combo,wr2);
 guard=guard&&GetFocus()==f&&GetCapture()==cap&&SendMessageA(combo,0x147,0,0)==sel&&SendMessageA(combo,0x146,0,0)==count&&SendMessageA(combo,0x157,0,0)==drop&&notifications==nc&&SendMessageA(combo,0x154,(U)-1,0)==field&&SendMessageA(combo,0x15d,0,0)==extent&&same(before,after);for(int j=0;j<4;++j)guard=guard&&wr[j]==wr2[j];}
void publish(void){int at=0,ok=1,rc[6]={123,0,0,0,0,456};for(int j=0;j<12;++j){char b[100];SendMessageA(combo,0x148,j,(long)b);ok=ok&&same(b,items[j])&&(U)SendMessageA(combo,0x150,j,0)==0x12340000+j;}
 SendMessageA(list,0x198,4,(long)(rc+1));
 number(stage,&at);number(SendMessageA(combo,0x154,0,0),&at);number(SendMessageA(list,0x1a1,0,0),&at);number(SendMessageA(combo,0x147,0,0),&at);number(SendMessageA(combo,0x15b,0,0),&at);number(SendMessageA(combo,0x157,0,0),&at);number(ret,&at);number(guard,&at);number(ok,&at);number(SendMessageA(combo,0x146,0,0),&at);number(SendMessageA(combo,0x154,(U)-1,0),&at);for(int j=0;j<6;++j)number(rc[j],&at);number(SendMessageA(list,0x1a9,0,10|(49<<16)),&at);number(SendMessageA(combo,0x15d,0,0),&at);report[at]=0;SetWindowTextA(status,report);
 SendMessageA(ref,0x1a0,0,heights[stage]);SendMessageA(ref,0x186,sels[stage],0);SendMessageA(ref,0x197,tops[stage],0);}
void replace(int v){SendMessageA(combo,0x14f,0,0);DestroyWindow(combo);make(v);height(24);SetFocus(button);}
void operate(void){guard=1;ret=99;switch(stage){case 1:height(24);break;case 2:SendMessageA(combo,0x14f,1,0);break;case 3:height(32);break;case 5:SetFocus(combo);SendMessageA(combo,0x14f,1,0);break;case 7:height(8);SendMessageA(combo,0x15c,2,0);break;case 8:height(255);SendMessageA(combo,0x15c,0,0);break;case 9:height(1);SendMessageA(combo,0x15c,0,0);break;case 10:height(256);break;case 11:replace(2);break;case 12:SendMessageA(combo,0x14f,1,0);break;case 13:replace(1);break;case 14:replace(3|0x10);SendMessageA(combo,0x14f,1,0);break;case 15:ret=SendMessageA(combo,0x153,(U)-1,30);break;}publish();}
long __stdcall proc(P h,U m,U w,long l){if(m==0x111&&(w&65535)==10){++notifications;return 0;}if(m==0x111&&(w&65535)==20&&!ready){SetFocus(button);ready=1;operate();return 0;}return DefWindowProcA(h,m,w,l);}
void start(void){instance=GetModuleHandleA(0);struct WC wc={0,proc,0,0,0,0,0,(P)16,0,"ComboHeight"};wc.instance=instance;RegisterClassA(&wc);frame=CreateWindowExA(0,"ComboHeight","Authored combo item height",0x10cf0000,30,30,850,510,0,0,instance,0);make(3);SendMessageA(combo,0x15e,320,0);
 ref=CreateWindowExA(0,"LISTBOX","",0x50000000,500,40,180,68,frame,(P)30,instance,0);add(ref,0);
 button=CreateWindowExA(0,"BUTTON","Ready",0x50010000,15,415,100,26,frame,(P)20,instance,0);status=CreateWindowExA(0,"STATIC","starting",0x50000000,15,460,800,24,frame,(P)21,instance,0);
 U msg[12];while(GetMessageA(msg,0,0,0)>0){if(ready&&msg[1]==0x100&&msg[2]==0x75&&stage<15){++stage;operate();continue;}TranslateMessage(msg);DispatchMessageA(msg);}}
`;
function fixture(out){
 fs.writeFileSync(out+'/fixture.c',source);
 for(const [dll,names]of Object.entries({kernel32:['GetModuleHandleA@4'],user32:['CreateWindowExA@48','RegisterClassA@4','DefWindowProcA@16','SetFocus@4','GetFocus@0','GetDlgCtrlID@4','SetWindowTextA@8','DestroyWindow@4','MoveWindow@24','GetWindowRect@8','GetCapture@0','GetDlgItem@8','GetWindow@8','EnumWindows@8','SendMessageA@16','GetMessageA@16','TranslateMessage@4','DispatchMessageA@4']})){
 fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/fixture.c','-o',out+'/fixture.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/combo-height.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib']);return fs.readFileSync(out+'/combo-height.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n'),pause=ms=>new Promise(r=>setTimeout(r,ms));
 const runtime=require(root+'/tools/boids-current-runtime.cjs'),commit=cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files=runtime.gitFiles(commit);
 for(const n of files.keys())if(fs.existsSync(root+'/'+n))files.set(n,fs.readFileSync(root+'/'+n));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{maxBuffer:8e6}));
 const wasm=process.env.COMBO_HEIGHT_WASM?fs.readFileSync(process.env.COMBO_HEIGHT_WASM):runtime.compile(files),pe=fixture(out);fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));files.set('build/wine-assembly.wasm',wasm);files.set('combo-height.exe',pe);
 fs.writeFileSync(out+'/runtime.diff',cp.execFileSync('git',['diff','--binary','HEAD','--','src','lib','tools','index.html','host.js'],{maxBuffer:32e6}));
 save('runtime.json',{commit,moduleSHA256:sha(wasm),peSHA256:sha(pe),testSHA256:sha(fs.readFileSync(__filename)),files:[...files].map(([name,b])=>({name,size:b.length,sha256:sha(b)}))});
 const transient=require(root+'/tools/browser-transients.cjs').create(),logs=[],pending=[],workers=[],states=[],failures=[];let display,browser,wait,server;
 try{
 server=http.createServer((req,res)=>{const n=new URL(req.url,'http://local').pathname.slice(1)||'index.html',b=files.get(n);res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.html')?'text/html':n.endsWith('.css')?'text/css':n.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.statusCode=b?200:404;res.end(b||'missing');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 display=await require(root+'/tools/gltron-headful-display.cjs').start(out);
 browser=await require(root+'/node_modules/puppeteer').launch({headless:false,defaultViewport:{width:1150,height:800},env:transient.env(display.env),userDataDir:transient.profile,executablePath:'/opt/google/chrome/chrome',args:[...transient.args,'--window-size=1250,980','--no-sandbox','--disable-dev-shm-usage','--disable-component-update','--disable-background-networking'],protocolTimeout:45000});wait=transient.watch(browser.process());browser.process().stdout?.resume();browser.process().stderr?.resume();save('browser-version.json',{version:await browser.version()});
 const page=await browser.newPage();page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>logs.push(String(e)));
 page.on('workercreated',w=>{const row={url:w.url(),modules:[]};workers.push(row);const c=w.client;c.on('Debugger.scriptParsed',v=>{if(v.scriptLanguage==='WebAssembly'||v.url.startsWith('wasm://'))pending.push(c.send('Debugger.getScriptSource',{scriptId:v.scriptId}).then(r=>row.modules.push(sha(Buffer.from(r.bytecode,'base64')))));});pending.push(c.send('Debugger.enable'));});
 await page.evaluateOnNewDocument(()=>localStorage.setItem('wine-assembly.threads','1'));await page.goto('http://127.0.0.1:'+server.address().port+'/?debug&threads&no-log');await page.waitForFunction(()=>typeof WineAssembly==='function');
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1120;c.height=650;c.style='position:fixed;left:0;top:0;z-index:99999;width:1120px;height:650px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.heightHost=new WineAssembly();heightHost.renderer=new Win98Renderer(c);await heightHost.init(c);if(!heightHost.guestWorker)throw Error('production Worker required');await heightHost.loadExe('/combo-height.exe');heightHost.run();});
 await page.waitForFunction(()=>Object.values(heightHost.renderer.windows).some(w=>w.title==='Ready'),{timeout:15000});await page.evaluate(()=>{browserInput.wireCanvasInput(heightHost.renderer.canvas,heightHost.renderer,{runningApps:[{wine:heightHost}],debugMode:true});heightHost.renderer.canvas.focus();});
 await page.mouse.click(30+6+15+30,30+26+415+12);await page.waitForFunction(()=>Object.values(heightHost.renderer.windows).some(w=>/^0 /.test(w.title)),{timeout:15000});
 async function sample(stage){await pause(180);const s=await page.evaluate(()=>{const h=heightHost,r=h.renderer,frame=Object.values(r.windows).find(w=>w.title==='Authored combo item height'),popup=Object.values(r.windows).find(w=>w.isPopup&&w.visible);
 const extract=w=>{const p=w._backCanvas._waCanonicalPresentation;return {hwnd:w.hwnd,x:w.x,y:w.y,w:w.w,h:w.h,pixels:Array.from(w._backCanvas.getContext('2d').getImageData(0,0,w.w,w.h).data),gdi:p?{shared:p.surface.storage.buffer===h.memory.buffer,pixels:Array.from(p.surface.rgbaRect(0,0,w.w,w.h))}:null};};const list=popup&&Object.values(r.windows).find(w=>w.isChild&&w.parentHwnd===popup.hwnd);return {frame:extract(frame),popup:popup?extract(popup):null,list:list?{x:list.x,y:list.y,w:list.w,h:list.h}:null,report:Object.values(r.windows).find(w=>w.isChild&&w.x===15&&w.y===460)?.title,memoryBytes:h.memory.buffer.byteLength};});

 assert.equal(s.memoryBytes,536870912);const got=s.report.trim().split(/\s+/).map(Number),rh=heights[stage],top=tops[stage],sel=sels[stage],drop=opened.has(stage)||stage===13?1:0;
 const ret=stage===10?-1:[1,3,7,8,9,11,13,14,15].includes(stage)?0:99;
 const want=[stage,rh,rh,sel,top,drop,ret,1,1,12,21,123,0,(4-top)*rh,180,(5-top)*rh,456,Math.min(11,top+Math.floor(49/rh)),0];
 s.publicPass=got.length===want.length&&want.every((v,i)=>got[i]===v);if(!s.publicPass)failures.push({stage,got,want});s.stage=stage;s.got=got;s.want=want;
 const surfaces=[];for(const name of ['frame','popup'])if(s[name]){const p=s[name];assert(p.gdi?.shared);assert(Buffer.from(p.gdi.pixels).equals(Buffer.from(p.pixels)),'shared GDI matches backing canvas');delete p.gdi;}
 const crop=(p,x,y,w,h)=>{const b=Buffer.alloc(w*h*4),pix=Buffer.from(p.pixels);for(let row=0;row<h;++row)pix.copy(b,row*w*4,((y+row)*p.w+x)*4,((y+row)*p.w+x+w)*4);return {x:p.x+x,y:p.y+y,w,h,bytes:b};};
 const ref=crop(s.frame,508,68,140,60);surfaces.push(ref);
 // Literal scenario height/top/selection drives both a distinct public LISTBOX
 // and a color-strip oracle. Neither uses the combo's returned height/pixels.
 s.visiblePair=null;s.geometryPass=!s.popup;
 if(opened.has(stage)){
   s.geometryPass=!!s.popup&&s.popup.x===49&&s.popup.y===115&&s.popup.w===180&&s.popup.h===68;
   if(s.popup){const actual=crop(s.popup,4,4,140,60);surfaces.push(actual);s.visiblePair=actual.bytes.equals(ref.bytes);
     const strip=crop(s.popup,115,4,12,60),expected=Buffer.alloc(12*60*4);for(let y=0;y<60;++y)for(let x=0;x<12;++x){const row=Math.floor((y+2)/rh),drawn=row<Math.max(1,Math.ceil(64/rh)),color=drawn&&top+row===sel?[0,0,128,255]:[255,255,255,255];expected.set(color,(y*12+x)*4);}s.literalPair=strip.bytes.equals(expected);surfaces.push(strip);
   }
 }
 const compositeBytes=await page.screenshot();require(root+'/tools/browser-transients.cjs').captureWhole(out,'stage-'+stage+'-desktop',display.env);const desktopPath=out+'/stage-'+stage+'-desktop.png';const {PNG}=require(root+'/node_modules/pngjs'),composite=PNG.sync.read(compositeBytes),desktop=PNG.sync.read(fs.readFileSync(desktopPath)),g=await page.evaluate(()=>heightHost.renderer.canvas.getBoundingClientRect().toJSON());
 const match=(png,v,ox,oy)=>{const x=Math.round(ox+v.x),y=Math.round(oy+v.y);if(x<0||y<0||x+v.w>png.width||y+v.h>png.height)return false;for(let row=0;row<v.h;++row)if(!png.data.subarray(((y+row)*png.width+x)*4,((y+row)*png.width+x+v.w)*4).equals(v.bytes.subarray(row*v.w*4,(row+1)*v.w*4)))return false;return true;};
 assert(surfaces.every(v=>match(composite,v,g.x,g.y)),'compositor exact rows');const first=surfaces[0],needle=first.bytes.subarray(5*first.w*4,6*first.w*4);let origin=null;for(let at=desktop.data.indexOf(needle);at>=0;at=desktop.data.indexOf(needle,at+1)){if(at%4)continue;const ox=at/4%desktop.width-first.x,oy=Math.floor(at/4/desktop.width)-first.y-5;if(surfaces.every(v=>match(desktop,v,ox,oy))){origin={x:ox,y:oy};break;}}assert(origin,'native desktop exact rows at one origin');s.fourPlanes={sharedGDI:true,backing:true,compositor:true,nativeDesktop:true,origin};
 if([0,3,6,14].includes(stage)){fs.writeFileSync(out+'/stage-'+stage+'-composited.png',compositeBytes);}else fs.unlinkSync(desktopPath);
 s.surfaces=surfaces.map(({bytes,...v})=>({...v,sha256:sha(bytes)}));for(const name of ['frame','popup'])if(s[name])delete s[name].pixels;states.push(s);save('states.json',states);
 }

 await sample(0);for(let stage=1;stage<heights.length;++stage){
 if(stage===4)await page.mouse.click(49+40,115+4+32+4);
 if(stage===6){await page.keyboard.press('ArrowDown');await page.keyboard.press('End');}
 await page.keyboard.press('F6');await page.waitForFunction(stage=>Object.values(heightHost.renderer.windows).some(w=>w.title?.startsWith(stage+' ')),{timeout:10000},stage);await sample(stage);}
 const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);const cpuState=await cpu.evaluate(()=>{const names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,registers:Object.fromEntries(names.map(n=>[n,instance.exports[n]()>>>0]))};});save('cpu-state.json',cpuState);assert.equal(cpuState.memoryBytes,536870912);assert.equal(Object.keys(cpuState.registers).length,19);assert(cpuState.registers.get_eip&&cpuState.registers.get_esp);
 await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));save('assertions.json',{expectOld,failures,states:states.length,productionBrowserCPU:true,visiblePairs:states.map(s=>({stage:s.stage,equal:s.visiblePair,geometry:s.geometryPass})),fourPlanes:states.every(s=>s.fourPlanes.nativeDesktop)});

 assert(states[0].publicPass&&states[0].geometryPass,'unchanged default public state');
 if(expectOld){assert(failures.some(v=>v.stage===1&&v.got[1]===16&&v.want[1]===24),'physical preedit getter failure');assert(states.some(s=>s.stage===3&&s.visiblePair===false),'physical preedit visible row failure');console.log('PASS expected physical old FAIL',failures.length);}
 else{assert(states.every(s=>s.geometryPass&&s.visiblePair!==false&&s.literalPair!==false),'independent fixed references and literal row geometry');assert.deepEqual(failures,[]);console.log('PASS COMBOBOX ITEM HEIGHT public state native input four planes',states.length);}

 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('transients.json',await transient.cleanup(out));if(display)await display.close();}
}
if(require.main===module)main(process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync('/dev/shm/combobox-item-height-'),{expectOld:process.argv.includes('--expect-old')}).catch(e=>{console.error(e.stack);process.exitCode=1;});module.exports={fixture,main,heights,tops,sels};


undefined
