// Microsoft desktop primary contracts (read before implementation):
// https://learn.microsoft.com/en-us/windows/win32/controls/cb-getdroppedcontrolrect
// https://learn.microsoft.com/en-us/windows/win32/menurc/combobox-control
// https://learn.microsoft.com/en-us/windows/win32/controls/cb-setdroppedwidth
// The expanded COMBOBOX includes its selection field and list, in screen
// coordinates. Width=max(field width, retained dropped minimum). Ordinary
// DROPDOWN/LIST and SIMPLE geometry only; no owner-draw, integral-height,
// monitor-edge placement or unsupported-style Windows parity assertion.
// Native input drives an authored PE; references use literal geometry/items.
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const stages=[
 [180,89,0,25,40,30,30], [180,89,0,25,40,30,30], [180,89,1,25,40,30,30],
 [300,89,0,25,40,30,30], [300,121,0,65,70,30,30], [300,121,0,65,70,80,60],
 [300,121,1,65,70,80,60], [300,89,0,65,70,80,60], [300,89,1,65,70,80,60],
 [300,89,0,65,70,80,60], [260,89,0,25,40,80,60], [260,89,1,25,40,80,60],
 [260,89,0,25,40,80,60], [260,89,0,25,40,80,60], [180,89,1,25,40,80,60],
 [240,89,0,25,40,80,60], [120,89,0,25,40,80,60], [120,89,1,25,40,80,60],
 [120,89,0,25,40,80,60]];
const opened=new Set([2,6,8,11,17]);
const referenceWidths=[120,180,240,260,300];
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);P API GetCapture(void);P API GetWindow(P,U);
unsigned short API RegisterClassA(const void*);long API DefWindowProcA(P,U,U,long);P API SetFocus(P);P API GetFocus(void);int API GetDlgCtrlID(P);int API SetWindowTextA(P,const char*);int API DestroyWindow(P);int API MoveWindow(P,int,int,int,int,int);int API GetWindowRect(P,void*);
long API SendMessageA(P,U,U,long);int API GetMessageA(P,P,U,U);int API TranslateMessage(P);long API DispatchMessageA(P);
struct WC{U style;P proc;int cex,wex;P instance,icon,cursor,brush;const char* menu;const char* name;};
static P frame,parent,combo,status,button,instance;static int stage,ready,notifications,guard=1,variant=3,rect[4],ret,nul;
static char report[500],text[120];static unsigned char canary[48];
static const char* items[8]={"Wide option ABCDEFGHIJKLMNOPQRSTUVWXYZ 00","Wide option ABCDEFGHIJKLMNOPQRSTUVWXYZ 01","Wide option ABCDEFGHIJKLMNOPQRSTUVWXYZ 02","Wide option ABCDEFGHIJKLMNOPQRSTUVWXYZ 03","Wide option ABCDEFGHIJKLMNOPQRSTUVWXYZ 04","Wide option ABCDEFGHIJKLMNOPQRSTUVWXYZ 05","Wide option ABCDEFGHIJKLMNOPQRSTUVWXYZ 06","Wide option ABCDEFGHIJKLMNOPQRSTUVWXYZ 07"};
void number(int n,int* at){char d[12];int k=0;if(n<0){report[(*at)++]='-';n=-n;}do{d[k++]='0'+n%10;n/=10;}while(n);while(k)report[(*at)++]=d[--k];report[(*at)++]=' ';}
void add(P h,int cb){for(int j=0;j<8;++j){SendMessageA(h,cb?0x143:0x180,0,(long)items[j]);SendMessageA(h,cb?0x151:0x19a,j,0x12340000+j);}SendMessageA(h,cb?0x14e:0x186,2,0);}
P make(void){P h=CreateWindowExA(0,"COMBOBOX","",0x50100000|variant,25,40,180,89,parent,(P)10,instance,0);add(h,1);return h;}
int same(char* a,char* b){int j=0;while(a[j]&&a[j]==b[j])++j;return a[j]==b[j];}
void query(void){char before[120],after[120];int wr[4],wr2[4];P f=GetFocus(),c=GetCapture();int sel=SendMessageA(combo,0x147,0,0),count=SendMessageA(combo,0x146,0,0),drop=SendMessageA(combo,0x157,0,0),nc=notifications,ext=SendMessageA(combo,0x15d,0,0),top=SendMessageA(combo,0x15b,0,0),width=SendMessageA(combo,0x15f,0,0);U edit=SendMessageA(combo,0x140,0,0);SendMessageA(combo,0xd,120,(long)before);GetWindowRect(combo,wr);
 for(int j=0;j<48;++j)canary[j]=0xa5;ret=SendMessageA(combo,0x152,0,(long)(canary+8));for(int j=0;j<4;++j)rect[j]=((int*)(canary+8))[j];
 guard=guard&&ret!=0;for(int j=0;j<48;++j)if(j<8||j>=24)guard=guard&&canary[j]==0xa5;
 for(int j=0;j<48;++j)canary[j]=0xa5;guard=guard&&SendMessageA(combo,0x152,0,(long)(canary+8))!=0;for(int j=0;j<4;++j)guard=guard&&rect[j]==((int*)(canary+8))[j];for(int j=0;j<48;++j)if(j<8||j>=24)guard=guard&&canary[j]==0xa5;
 nul=SendMessageA(combo,0x152,0,0);SendMessageA(combo,0xd,120,(long)after);GetWindowRect(combo,wr2);
 guard=guard&&nul==0&&GetFocus()==f&&GetCapture()==c&&SendMessageA(combo,0x147,0,0)==sel&&SendMessageA(combo,0x146,0,0)==count&&SendMessageA(combo,0x157,0,0)==drop&&notifications==nc&&SendMessageA(combo,0x15d,0,0)==ext&&SendMessageA(combo,0x15b,0,0)==top&&SendMessageA(combo,0x15f,0,0)==width&&SendMessageA(combo,0x140,0,0)==edit&&same(before,after);for(int j=0;j<4;++j)guard=guard&&wr[j]==wr2[j];}
void publish(void){query();int at=0,ok=1,wr[4];GetWindowRect(combo,wr);for(int j=0;j<8;++j){char b[120];SendMessageA(combo,0x148,j,(long)b);ok=ok&&same(b,(char*)items[j])&&(U)SendMessageA(combo,0x150,j,0)==0x12340000+j;}
 number(stage,&at);for(int j=0;j<4;++j)number(rect[j],&at);number(ret,&at);number(nul,&at);number(guard,&at);number(ok,&at);number(SendMessageA(combo,0x157,0,0),&at);number(SendMessageA(combo,0x147,0,0),&at);number(SendMessageA(combo,0x146,0,0),&at);number(SendMessageA(combo,0x15f,0,0),&at);for(int j=0;j<4;++j)number(wr[j],&at);number(GetDlgCtrlID(GetFocus()),&at);number(notifications,&at);SendMessageA(combo,0xd,120,(long)text);for(int j=0;text[j]&&j<119;++j)report[at++]=text[j];report[at]=0;SetWindowTextA(status,report);}
void close(void){SendMessageA(combo,0x14f,0,0);}
void replace(int v){close();DestroyWindow(combo);variant=v;combo=make();SetFocus(button);}
void operate(void){guard=1;switch(stage){case 0:case 1:break;case 2:case 6:case 8:case 11:case 17:SendMessageA(combo,0x14f,1,0);break;case 3:close();SendMessageA(combo,0x160,300,0);break;case 4:MoveWindow(combo,65,70,100,121,1);break;case 5:MoveWindow(frame,80,60,1030,510,1);break;case 7:close();MoveWindow(combo,65,70,240,89,1);break;case 9:break;case 10:replace(2);SendMessageA(combo,0x160,260,0);break;case 12:close();SetFocus(GetWindow(combo,5));SendMessageA(combo,0x142,0,0xffff0000);break;case 13:SendMessageA(combo,0x14e,(U)-1,0);SendMessageA(combo,0xc,0,(long)"Typed");break;case 14:replace(1);break;case 15:replace(3);SendMessageA(combo,0x160,120,0);MoveWindow(combo,25,40,240,89,1);break;case 16:MoveWindow(combo,25,40,100,89,1);break;case 18:close();break;}publish();}
long __stdcall proc(P h,U m,U w,long l){if(m==0x111&&(w&65535)==10){++notifications;return 0;}if(m==0x111&&(w&65535)==20&&!ready){SetFocus(button);ready=1;operate();return 0;}return DefWindowProcA(h,m,w,l);}
void start(void){instance=GetModuleHandleA(0);struct WC wc={0,proc,0,0,0,0,0,(P)16,0,"ComboRect"};wc.instance=instance;RegisterClassA(&wc);frame=CreateWindowExA(0,"ComboRect","Authored combo dropped rect",0x10cf0000,30,30,1030,510,0,0,instance,0);
 parent=CreateWindowExA(0,"ComboRect","",0x50000000,15,20,400,250,frame,(P)12,instance,0);combo=make();
 int ww[5]={120,180,240,260,300};for(int j=0;j<5;++j){P ref=CreateWindowExA(0,"LISTBOX","",0x50000000,500,25+j*78,ww[j],68,frame,(P)(30+j),instance,0);add(ref,0);}P tall=CreateWindowExA(0,"LISTBOX","",0x50000000,820,25,180,100,frame,(P)40,instance,0);add(tall,0);
 button=CreateWindowExA(0,"BUTTON","Ready",0x50010000,15,415,100,26,frame,(P)20,instance,0);status=CreateWindowExA(0,"STATIC","starting",0x50000000,15,460,990,24,frame,(P)21,instance,0);
 U msg[12];while(GetMessageA(msg,0,0,0)>0){if(ready&&msg[1]==0x100&&msg[2]==0x75&&stage<18){++stage;operate();continue;}TranslateMessage(msg);DispatchMessageA(msg);}}
`;
function fixture(out){
 fs.writeFileSync(out+'/fixture.c',source);
 for(const [dll,names]of Object.entries({kernel32:['GetModuleHandleA@4'],user32:['CreateWindowExA@48','RegisterClassA@4','DefWindowProcA@16','SetFocus@4','GetFocus@0','GetDlgCtrlID@4','SetWindowTextA@8','DestroyWindow@4','MoveWindow@24','GetWindowRect@8','GetCapture@0','GetWindow@8','SendMessageA@16','GetMessageA@16','TranslateMessage@4','DispatchMessageA@4']})){
 fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/fixture.c','-o',out+'/fixture.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/combo-rect.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib']);return fs.readFileSync(out+'/combo-rect.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n'),pause=ms=>new Promise(r=>setTimeout(r,ms));
 const runtime=require(root+'/tools/boids-current-runtime.cjs'),commit=cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files=runtime.gitFiles(commit);
 for(const n of files.keys())if(fs.existsSync(root+'/'+n))files.set(n,fs.readFileSync(root+'/'+n));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{maxBuffer:8e6}));
 const wasm=process.env.COMBO_RECT_WASM?fs.readFileSync(process.env.COMBO_RECT_WASM):runtime.compile(files),pe=fixture(out);fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));files.set('build/wine-assembly.wasm',wasm);files.set('combo-rect.exe',pe);
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
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1120;c.height=650;c.style='position:fixed;left:0;top:0;z-index:99999;width:1120px;height:650px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.rectHost=new WineAssembly();rectHost.renderer=new Win98Renderer(c);await rectHost.init(c);if(!rectHost.guestWorker)throw Error('production Worker required');await rectHost.loadExe('/combo-rect.exe');rectHost.run();});
 await page.waitForFunction(()=>Object.values(rectHost.renderer.windows).some(w=>w.title==='Ready'),{timeout:15000});await page.evaluate(()=>{browserInput.wireCanvasInput(rectHost.renderer.canvas,rectHost.renderer,{runningApps:[{wine:rectHost}],debugMode:true});rectHost.renderer.canvas.focus();});
 await page.mouse.click(30+6+15+30,30+26+415+12);await page.waitForFunction(()=>Object.values(rectHost.renderer.windows).some(w=>/^0 /.test(w.title)),{timeout:15000});
 async function sample(stage){await pause(180);const s=await page.evaluate(()=>{const h=rectHost,r=h.renderer,frame=Object.values(r.windows).find(w=>w.title==='Authored combo dropped rect'),popup=Object.values(r.windows).find(w=>w.isPopup&&w.visible);
 const extract=w=>{const p=w._backCanvas._waCanonicalPresentation;return {hwnd:w.hwnd,x:w.x,y:w.y,w:w.w,h:w.h,pixels:Array.from(w._backCanvas.getContext('2d').getImageData(0,0,w.w,w.h).data),gdi:p?{shared:p.surface.storage.buffer===h.memory.buffer,pixels:Array.from(p.surface.rgbaRect(0,0,w.w,w.h))}:null};};const list=popup&&Object.values(r.windows).find(w=>w.isChild&&w.parentHwnd===popup.hwnd);return {frame:extract(frame),popup:popup?extract(popup):null,list:list?{x:list.x,y:list.y,w:list.w,h:list.h}:null,report:Object.values(r.windows).find(w=>w.isChild&&w.x===15&&w.y===460)?.title,memoryBytes:h.memory.buffer.byteLength};});
 assert.equal(s.memoryBytes,536870912);const parts=s.report.trim().split(/\s+/),got=parts.slice(0,19).map(Number),[width,height,drop,cx,cy,fx,fy]=stages[stage];
 // Literal fixture positions plus the public frame/client chrome, independently
 // checked against the guest's GetWindowRect. Never derive the oracle from 0x152.
 const left=fx+4+15+cx,top=fy+24+20+cy,fieldWidth=stage>=4&&stage<=6?100:stage>=7&&stage<=9?240:stage===15?240:stage>=16?100:180;
 const want=[stage,left,top,left+width,top+height,1,0,1,1,drop,stage===9?1:stage===13?-1:2,8,stage===14?-1:width,left,top,left+fieldWidth,top+(stage===14?89:21),null,null];
 const text=parts.slice(19).join(' '),expectedText=stage===13?'Typed':itemsText(stage===9?1:2);
 s.publicPass=got.length===want.length&&want.every((v,i)=>v===null||got[i]===v)&&text===expectedText;if(!s.publicPass)failures.push({stage,got,want,text,expectedText});s.stage=stage;s.got=got;s.want=want;s.text=text;
 const surfaces=[];for(const name of ['frame','popup'])if(s[name]){const p=s[name];assert(p.gdi?.shared);assert(Buffer.from(p.gdi.pixels).equals(Buffer.from(p.pixels)),'shared GDI matches backing canvas');delete p.gdi;}
 const crop=(p,x,y,w,h)=>{const b=Buffer.alloc(w*h*4),pix=Buffer.from(p.pixels);for(let row=0;row<h;++row)pix.copy(b,row*w*4,((y+row)*p.w+x)*4,((y+row)*p.w+x+w)*4);return {x:p.x+x,y:p.y+y,w,h,bytes:b};};
 // Separate fixed reference listboxes exist at literal coordinates/widths.
 const fixed=crop(s.frame,508,365,276,44);surfaces.push(fixed);s.referenceInk=0;for(let i=0;i<fixed.bytes.length;i+=4)if(fixed.bytes[i]===0&&fixed.bytes[i+1]===0&&fixed.bytes[i+2]===0)s.referenceInk++;assert(s.referenceInk>100);
 if(opened.has(stage)){const index=referenceWidths.indexOf(width),cw=width-24;assert(index>=0);const ref=crop(s.frame,508,53+index*78,cw,44);surfaces.push(ref);
   s.geometryPass=!!s.popup&&s.popup.x===left&&s.popup.y===top+21&&s.popup.w===width&&s.popup.h===height-21;
   s.visiblePair=s.geometryPass&&crop(s.popup,4,4,cw,44).bytes.equals(ref.bytes);if(s.popup)surfaces.push(crop(s.popup,4,4,Math.min(cw,s.popup.w-8),44));
   if(stage===6){const tall=crop(s.frame,828,53,152,76);surfaces.push(tall);s.tallPair=crop(s.popup,4,4,152,76).bytes.equals(tall.bytes);assert(s.tallPair);}
 }else{s.geometryPass=!s.popup;s.visiblePair=null;}
 const compositeBytes=await page.screenshot();require(root+'/tools/browser-transients.cjs').captureWhole(out,'stage-'+stage+'-desktop',display.env);const desktopPath=out+'/stage-'+stage+'-desktop.png';const {PNG}=require(root+'/node_modules/pngjs'),composite=PNG.sync.read(compositeBytes),desktop=PNG.sync.read(fs.readFileSync(desktopPath)),g=await page.evaluate(()=>rectHost.renderer.canvas.getBoundingClientRect().toJSON());
 const match=(png,v,ox,oy)=>{const x=Math.round(ox+v.x),y=Math.round(oy+v.y);if(x<0||y<0||x+v.w>png.width||y+v.h>png.height)return false;for(let row=0;row<v.h;++row)if(!png.data.subarray(((y+row)*png.width+x)*4,((y+row)*png.width+x+v.w)*4).equals(v.bytes.subarray(row*v.w*4,(row+1)*v.w*4)))return false;return true;};
 assert(surfaces.every(v=>match(composite,v,g.x,g.y)),'compositor exact rows');const first=surfaces[0],needle=first.bytes.subarray(5*first.w*4,6*first.w*4);let origin=null;for(let at=desktop.data.indexOf(needle);at>=0;at=desktop.data.indexOf(needle,at+1)){if(at%4)continue;const ox=at/4%desktop.width-first.x,oy=Math.floor(at/4/desktop.width)-first.y-5;if(surfaces.every(v=>match(desktop,v,ox,oy))){origin={x:ox,y:oy};break;}}assert(origin,'native desktop exact rows at one origin');s.fourPlanes={sharedGDI:true,backing:true,compositor:true,nativeDesktop:true,origin};
 if([0,2,6,11].includes(stage)){fs.writeFileSync(out+'/stage-'+stage+'-composited.png',compositeBytes);}else fs.unlinkSync(desktopPath);
 s.surfaces=surfaces.map(({bytes,...v})=>({...v,sha256:sha(bytes)}));for(const name of ['frame','popup'])if(s[name])delete s[name].pixels;states.push(s);save('states.json',states);
 }
 await sample(0);for(let stage=1;stage<stages.length;++stage){
   if(stage===9){const p=states[8].popup;await page.mouse.click(p.x+250,p.y+4+16+8);await pause(180);}
   await page.keyboard.press('F6');await page.waitForFunction(stage=>Object.values(rectHost.renderer.windows).some(w=>w.title?.startsWith(stage+' ')),{timeout:5000},stage);await sample(stage);
 }
 const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);const cpuState=await cpu.evaluate(()=>{const names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,registers:Object.fromEntries(names.map(n=>[n,instance.exports[n]()>>>0]))};});save('cpu-state.json',cpuState);assert.equal(cpuState.memoryBytes,536870912);assert.equal(Object.keys(cpuState.registers).length,19);assert(cpuState.registers.get_eip&&cpuState.registers.get_esp);
 await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));save('assertions.json',{expectOld,failures,states:states.length,productionBrowserCPU:true,visiblePairs:states.map(s=>({stage:s.stage,equal:s.visiblePair,geometry:s.geometryPass})),fourPlanes:states.every(s=>s.fourPlanes.nativeDesktop)});
 if(expectOld){assert(failures.some(v=>v.stage===0&&v.got[1]===0&&v.got[2]===21),'physical preedit local-coordinate failure');assert(states.every(s=>s.geometryPass&&s.visiblePair!==false),'old visible geometry establishes independent expanded bounds');console.log('PASS oldFAIL reproduced',failures.length);}else{assert(states.every(s=>s.geometryPass&&s.visiblePair!==false),'independent fixed width geometry/row references');assert.deepEqual(failures,[]);console.log('PASS COMBOBOX DROPPED RECT public state, native input and four planes',states.length);}
 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('transients.json',await transient.cleanup(out));if(display)await display.close();}
}
function itemsText(sel){return sel<0?'':'Wide option ABCDEFGHIJKLMNOPQRSTUVWXYZ '+String(sel).padStart(2,'0');}
if(require.main===module)main(process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync(require('node:os').tmpdir()+'/combobox-rect-'),{expectOld:process.argv.includes('--expect-old')}).catch(e=>{console.error(e.stack);process.exitCode=1;});module.exports={fixture,main,stages};
