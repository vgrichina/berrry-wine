'use strict';
// Microsoft primary contracts, read before implementation:
// https://learn.microsoft.com/en-us/windows/win32/controls/cb-getdroppedwidth
// https://learn.microsoft.com/en-us/windows/win32/controls/cb-setdroppedwidth
// Minimum defaults to zero; actual width is max(minimum, combo width).
// GET/SET return effective width; SIMPLE is unsupported (CB_ERR).
// Pixel references below are separately created fixed-width LISTBOX controls,
// never sized from a measured popup or the result of either tested message.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const widths=[180,300,300,180,180,240,240,120,120,120,100,100,180,300,300,-1,180,300,300,300,300,300,-1,180,300,260,260,180,180];
const opened=new Set([2,4,6,8,9,11,14,18,24,25,26,28]);
const referenceWidths=[100,120,180,240,300,260];
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);P API GetCapture(void);P API GetWindow(P,U);
unsigned short API RegisterClassA(const void*);long API DefWindowProcA(P,U,U,long);P API SetFocus(P);P API GetFocus(void);int API GetDlgCtrlID(P);int API SetWindowTextA(P,const char*);int API DestroyWindow(P);int API MoveWindow(P,int,int,int,int,int);int API GetWindowRect(P,void*);
long API SendMessageA(P,U,U,long);int API GetMessageA(P,P,U,U);int API TranslateMessage(P);long API DispatchMessageA(P);
struct WC{U style;P proc;int cex,wex;P instance,icon,cursor,brush;const char* menu;const char* name;};
static P frame,combo,other,status,button,instance;static int stage,ready,notifications,ret=99,guard=1,variant=3;
static char report[500],text[120];static unsigned char canary[48];
static const char* items[8]={"Wide option ABCDEFGHIJKLMNOPQRSTUVWXYZ 00","Wide option ABCDEFGHIJKLMNOPQRSTUVWXYZ 01","Wide option ABCDEFGHIJKLMNOPQRSTUVWXYZ 02","Wide option ABCDEFGHIJKLMNOPQRSTUVWXYZ 03","Wide option ABCDEFGHIJKLMNOPQRSTUVWXYZ 04","Wide option ABCDEFGHIJKLMNOPQRSTUVWXYZ 05","Wide option ABCDEFGHIJKLMNOPQRSTUVWXYZ 06","Wide option ABCDEFGHIJKLMNOPQRSTUVWXYZ 07"};
void number(int n,int* at){char d[12];int k=0;if(n<0){report[(*at)++]='-';n=-n;}do{d[k++]='0'+n%10;n/=10;}while(n);while(k)report[(*at)++]=d[--k];report[(*at)++]=' ';}
void add(P h,int cb){for(int j=0;j<8;++j){SendMessageA(h,cb?0x143:0x180,0,(long)items[j]);SendMessageA(h,cb?0x151:0x19a,j,0x12340000+j);}SendMessageA(h,cb?0x14e:0x186,2,0);}
P make(void){P h=CreateWindowExA(0,"COMBOBOX","",0x50100000|variant,15,40,180,89,frame,(P)10,instance,0);add(h,1);return h;}
int same(char* a,char* b){int j=0;while(a[j]&&a[j]==b[j])++j;return a[j]==b[j];}
void width(P h,int n){char before[120],after[120];int rect[4],rect2[4];P f=GetFocus();int sel=SendMessageA(h,0x147,0,0),count=SendMessageA(h,0x146,0,0),drop=SendMessageA(h,0x157,0,0),nc=notifications,ext=SendMessageA(h,0x15d,0,0),top=SendMessageA(h,0x15b,0,0);U edit=SendMessageA(h,0x140,0,0);SendMessageA(h,0xd,120,(long)before);GetWindowRect(h,rect);
 for(int j=0;j<48;++j)canary[j]=0xa5;ret=SendMessageA(h,0x160,n,(long)(canary+8));SendMessageA(h,0xd,120,(long)after);GetWindowRect(h,rect2);
 guard=guard&&GetFocus()==f&&SendMessageA(h,0x147,0,0)==sel&&SendMessageA(h,0x146,0,0)==count&&SendMessageA(h,0x157,0,0)==drop&&notifications==nc&&SendMessageA(h,0x15d,0,0)==ext&&SendMessageA(h,0x15b,0,0)==top&&SendMessageA(h,0x140,0,0)==edit&&same(before,after);
 for(int j=0;j<4;++j)guard=guard&&rect[j]==rect2[j];for(int j=0;j<48;++j)guard=guard&&canary[j]==0xa5;}
void publish(void){int at=0,ok=1,rect[4],lr[4]={0,0,0,0};GetWindowRect(combo,rect);if(variant!=1&&SendMessageA(combo,0x157,0,0)){P lb=GetWindow(GetCapture(),5);ok=ok&&lb!=0&&GetWindowRect(lb,lr);}for(int j=0;j<8;++j){char b[120];SendMessageA(combo,0x148,j,(long)b);ok=ok&&same(b,(char*)items[j])&&(U)SendMessageA(combo,0x150,j,0)==0x12340000+j;}
 number(stage,&at);number(SendMessageA(combo,0x15f,0,0),&at);number(ret,&at);number(SendMessageA(other,0x15f,0,0),&at);number(SendMessageA(combo,0x157,0,0),&at);number(SendMessageA(combo,0x147,0,0),&at);number(SendMessageA(combo,0x146,0,0),&at);number(SendMessageA(combo,0x15d,0,0),&at);number(rect[2]-rect[0],&at);number(rect[3]-rect[1],&at);number(guard,&at);number(ok,&at);number(GetDlgCtrlID(GetFocus()),&at);number(SendMessageA(combo,0x15b,0,0),&at);number(notifications,&at);number(lr[2]-lr[0],&at);number(lr[3]-lr[1],&at);SendMessageA(combo,0xd,120,(long)text);for(int j=0;text[j]&&j<119;++j)report[at++]=text[j];report[at]=0;SetWindowTextA(status,report);}
void replace(int v){SendMessageA(combo,0x14f,0,0);DestroyWindow(combo);variant=v;combo=make();}
void close(void){SendMessageA(combo,0x14f,0,0);}
void operate(void){notifications=0;ret=99;guard=1;switch(stage){case 0:break;case 1:width(combo,300);break;case 2:case 4:case 6:case 8:case 11:case 14:case 18:case 28:SendMessageA(combo,0x14f,1,0);break;case 3:close();width(combo,120);break;case 5:close();MoveWindow(combo,15,40,240,89,1);break;case 7:close();MoveWindow(combo,15,40,100,89,1);break;case 9:width(other,400);break;case 10:close();width(combo,0);break;case 12:replace(2);break;case 13:width(combo,300);break;case 15:replace(1);break;case 16:replace(3);break;case 17:width(combo,300);SendMessageA(combo,0x15e,480,0);break;case 19:break;case 20:replace(2);width(combo,300);SetFocus(GetWindow(combo,5));SendMessageA(combo,0x142,0,0xffff0000);break;case 21:break;case 22:replace(1);width(combo,300);break;case 23:replace(3);break;case 24:width(combo,300);SendMessageA(combo,0x14f,1,0);break;case 25:width(combo,260);break;case 26:close();SendMessageA(combo,0x14f,1,0);break;case 27:close();width(combo,0);break;}publish();}
long __stdcall proc(P h,U m,U w,long l){if(m==0x111&&(w&65535)==10){++notifications;return 0;}if(m==0x111&&(w&65535)==20&&!ready){SetFocus(button);ready=1;operate();return 0;}return DefWindowProcA(h,m,w,l);}
void start(void){instance=GetModuleHandleA(0);struct WC wc={0,proc,0,0,0,0,0,(P)16,0,"ComboWidth"};wc.instance=instance;RegisterClassA(&wc);frame=CreateWindowExA(0,"ComboWidth","Authored combo dropped width",0x10cf0000,30,30,1030,510,0,0,instance,0);
 combo=make();other=CreateWindowExA(0,"COMBOBOX","",0x40000003,15,600,180,89,frame,(P)11,instance,0);add(other,1);
 int ww[6]={100,120,180,240,300,260};for(int j=0;j<6;++j){P ref=CreateWindowExA(0,"LISTBOX","",0x50000000,j==5?720:390,j==5?30:30+j*78,ww[j],68,frame,(P)(30+j),instance,0);add(ref,0);}
 button=CreateWindowExA(0,"BUTTON","Ready",0x50010000,15,415,100,26,frame,(P)20,instance,0);status=CreateWindowExA(0,"STATIC","starting",0x50000000,15,460,990,24,frame,(P)21,instance,0);
 U msg[12];while(GetMessageA(msg,0,0,0)>0){if(ready&&msg[1]==0x100&&msg[2]==0x75&&stage<28){++stage;operate();continue;}TranslateMessage(msg);DispatchMessageA(msg);}}
`;
function fixture(out){
 fs.writeFileSync(out+'/fixture.c',source);
 for(const [dll,names]of Object.entries({kernel32:['GetModuleHandleA@4'],user32:['CreateWindowExA@48','RegisterClassA@4','DefWindowProcA@16','SetFocus@4','GetFocus@0','GetDlgCtrlID@4','SetWindowTextA@8','DestroyWindow@4','MoveWindow@24','GetWindowRect@8','GetCapture@0','GetWindow@8','SendMessageA@16','GetMessageA@16','TranslateMessage@4','DispatchMessageA@4']})){
 fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/fixture.c','-o',out+'/fixture.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/combo-width.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib']);return fs.readFileSync(out+'/combo-width.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n'),pause=ms=>new Promise(r=>setTimeout(r,ms));
 const runtime=require(root+'/tools/boids-current-runtime.cjs'),commit=cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files=runtime.gitFiles(commit);
 for(const n of files.keys())if(fs.existsSync(root+'/'+n))files.set(n,fs.readFileSync(root+'/'+n));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{maxBuffer:8e6}));
 const wasm=process.env.COMBO_WIDTH_WASM?fs.readFileSync(process.env.COMBO_WIDTH_WASM):runtime.compile(files),pe=fixture(out);fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));files.set('build/wine-assembly.wasm',wasm);files.set('combo-width.exe',pe);
 save('runtime.json',{commit,moduleSHA256:sha(wasm),peSHA256:sha(pe),testSHA256:sha(fs.readFileSync(__filename)),files:[...files].map(([name,b])=>({name,size:b.length,sha256:sha(b)}))});
 const transient=require(root+'/tools/browser-transients.cjs').create(),logs=[],pending=[],workers=[],states=[],failures=[];let display,browser,wait,server;
 try{
 server=http.createServer((req,res)=>{const n=new URL(req.url,'http://local').pathname.slice(1)||'index.html',b=files.get(n);res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.html')?'text/html':n.endsWith('.css')?'text/css':n.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.statusCode=b?200:404;res.end(b||'missing');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 display=await require(root+'/tools/gltron-headful-display.cjs').start(out);
 browser=await require(root+'/node_modules/puppeteer').launch({headless:false,defaultViewport:{width:1150,height:800},env:transient.env(display.env),userDataDir:transient.profile,executablePath:'/opt/google/chrome/chrome',args:[...transient.args,'--no-sandbox','--disable-dev-shm-usage','--disable-component-update','--disable-background-networking'],protocolTimeout:45000});wait=transient.watch(browser.process());browser.process().stdout?.resume();browser.process().stderr?.resume();save('browser-version.json',{version:await browser.version()});
 const page=await browser.newPage();page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>logs.push(String(e)));
 page.on('workercreated',w=>{const row={url:w.url(),modules:[]};workers.push(row);const c=w.client;c.on('Debugger.scriptParsed',v=>{if(v.scriptLanguage==='WebAssembly'||v.url.startsWith('wasm://'))pending.push(c.send('Debugger.getScriptSource',{scriptId:v.scriptId}).then(r=>row.modules.push(sha(Buffer.from(r.bytecode,'base64')))));});pending.push(c.send('Debugger.enable'));});
 await page.evaluateOnNewDocument(()=>localStorage.setItem('wine-assembly.threads','1'));await page.goto('http://127.0.0.1:'+server.address().port+'/?debug&threads&no-log');await page.waitForFunction(()=>typeof WineAssembly==='function');
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1120;c.height=650;c.style='position:fixed;left:0;top:0;z-index:99999;width:1120px;height:650px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.widthHost=new WineAssembly();widthHost.renderer=new Win98Renderer(c);await widthHost.init(c);if(!widthHost.guestWorker)throw Error('production Worker required');await widthHost.loadExe('/combo-width.exe');widthHost.run();});
 await page.waitForFunction(()=>Object.values(widthHost.renderer.windows).some(w=>w.title==='Ready'),{timeout:15000});await page.evaluate(()=>{browserInput.wireCanvasInput(widthHost.renderer.canvas,widthHost.renderer,{runningApps:[{wine:widthHost}],debugMode:true});widthHost.renderer.canvas.focus();});
 await page.mouse.click(30+6+15+30,30+26+415+12);await page.waitForFunction(()=>Object.values(widthHost.renderer.windows).some(w=>/^0 /.test(w.title)),{timeout:15000});
 async function sample(stage){await pause(180);const s=await page.evaluate(()=>{const h=widthHost,r=h.renderer,frame=Object.values(r.windows).find(w=>w.title==='Authored combo dropped width'),popup=Object.values(r.windows).find(w=>w.isPopup&&w.visible);
 const extract=w=>{const p=w._backCanvas._waCanonicalPresentation;return {hwnd:w.hwnd,x:w.x,y:w.y,w:w.w,h:w.h,pixels:Array.from(w._backCanvas.getContext('2d').getImageData(0,0,w.w,w.h).data),gdi:p?{shared:p.surface.storage.buffer===h.memory.buffer,pixels:Array.from(p.surface.rgbaRect(0,0,w.w,w.h))}:null};};const list=popup&&Object.values(r.windows).find(w=>w.isChild&&w.parentHwnd===popup.hwnd);return {frame:extract(frame),popup:popup?extract(popup):null,list:list?{x:list.x,y:list.y,w:list.w,h:list.h}:null,report:Object.values(r.windows).find(w=>w.isChild&&w.x===15&&w.y===460)?.title,memoryBytes:h.memory.buffer.byteLength};});
 assert.equal(s.memoryBytes,536870912);const parts=s.report.trim().split(/\s+/),got=parts.slice(0,17).map(Number),fieldWidth=stage>=5&&stage<=6?240:stage>=7&&stage<=11?100:180;
 const ret=({1:300,3:180,9:400,10:100,13:300,17:300,20:300,22:-1,24:300,25:260,27:180})[stage]??99;
 const selected=stage===19?1:2,extent=stage>=17&&stage<=19?480:0;
 // Notifications from actual input are allowed in stages 19/20/21. Setter
 // preservation is separately checked synchronously by the guest guard.
 const want=[stage,widths[stage],ret,stage>=9?400:180,opened.has(stage)||stage===15||stage===22?1:0,selected,8,extent,fieldWidth,stage===15||stage===22?89:21,1,1,null,0,null,opened.has(stage)?stage===25?300:widths[stage]:0,opened.has(stage)?68:0];
 const text=parts.slice(17).join(' '),expectedText=stage===21?'Typed':itemsText(selected);
 s.publicPass=got.length===want.length&&want.every((v,i)=>v===null||got[i]===v)&&text===expectedText;if(!s.publicPass)failures.push({stage,got,want,text,expectedText});s.stage=stage;s.got=got;s.want=want;s.text=text;
 const surfaces=[];for(const name of ['frame','popup'])if(s[name]){const p=s[name];assert(p.gdi?.shared);assert(Buffer.from(p.gdi.pixels).equals(Buffer.from(p.pixels)),'shared GDI matches backing canvas');delete p.gdi;}
 const crop=(p,x,y,w,h)=>{const b=Buffer.alloc(w*h*4),pix=Buffer.from(p.pixels);for(let row=0;row<h;++row)pix.copy(b,row*w*4,((y+row)*p.w+x)*4,((y+row)*p.w+x+w)*4);return {x:p.x+x,y:p.y+y,w,h,bytes:b};};
 // Fixed reference at 300px always exists, independent of the tested width.
 const fixed=crop(s.frame,398,370,276,60);surfaces.push(fixed);s.referenceInk=0;for(let i=0;i<fixed.bytes.length;i+=4)if(fixed.bytes[i]===0&&fixed.bytes[i+1]===0&&fixed.bytes[i+2]===0)s.referenceInk++;assert(s.referenceInk>100);
 if(opened.has(stage)){const expectedWidth=stage===25?300:widths[stage],index=referenceWidths.indexOf(expectedWidth),cw=expectedWidth-24;assert(index>=0);const ref=crop(s.frame,index===5?728:398,index===5?58:58+index*78,cw,44);surfaces.push(ref);s.geometryPass=!!s.popup&&s.popup.w===expectedWidth&&s.popup.h===68&&got[15]===expectedWidth&&got[16]===68;
   // Compare the expected width including the selected-row background near
   // its right edge. A narrow popup cannot pass by matching a short prefix.
   s.visiblePair=s.geometryPass&&crop(s.popup,4,4,cw,44).bytes.equals(ref.bytes);if(s.popup)surfaces.push(crop(s.popup,4,4,Math.min(cw,s.popup.w-8),44));
 }else{s.geometryPass=!s.popup;s.visiblePair=null;}
 const compositeBytes=await page.screenshot();require(root+'/tools/browser-transients.cjs').captureWhole(out,'stage-'+stage+'-desktop',display.env);const desktopPath=out+'/stage-'+stage+'-desktop.png';const {PNG}=require(root+'/node_modules/pngjs'),composite=PNG.sync.read(compositeBytes),desktop=PNG.sync.read(fs.readFileSync(desktopPath)),g=await page.evaluate(()=>widthHost.renderer.canvas.getBoundingClientRect().toJSON());
 const match=(png,v,ox,oy)=>{const x=Math.round(ox+v.x),y=Math.round(oy+v.y);if(x<0||y<0||x+v.w>png.width||y+v.h>png.height)return false;for(let row=0;row<v.h;++row)if(!png.data.subarray(((y+row)*png.width+x)*4,((y+row)*png.width+x+v.w)*4).equals(v.bytes.subarray(row*v.w*4,(row+1)*v.w*4)))return false;return true;};
 assert(surfaces.every(v=>match(composite,v,g.x,g.y)),'compositor exact rows');const first=surfaces[0],needle=first.bytes.subarray(5*first.w*4,6*first.w*4);let origin=null;for(let at=desktop.data.indexOf(needle);at>=0;at=desktop.data.indexOf(needle,at+1)){if(at%4)continue;const ox=at/4%desktop.width-first.x,oy=Math.floor(at/4/desktop.width)-first.y-5;if(surfaces.every(v=>match(desktop,v,ox,oy))){origin={x:ox,y:oy};break;}}assert(origin,'native desktop exact rows at one origin');s.fourPlanes={sharedGDI:true,backing:true,compositor:true,nativeDesktop:true,origin};
 if([2,6,8,18].includes(stage)){fs.writeFileSync(out+'/stage-'+stage+'-composited.png',compositeBytes);}else fs.unlinkSync(desktopPath);
 s.surfaces=surfaces.map(({bytes,...v})=>({...v,sha256:sha(bytes)}));for(const name of ['frame','popup'])if(s[name])delete s[name].pixels;states.push(s);save('states.json',states);
 }
 await sample(0);for(let stage=1;stage<widths.length;++stage){
   if(stage===19){const p=states[18].popup;await page.mouse.click(p.x+250,p.y+4+16+8);await pause(180);}
   if(stage===21){await page.keyboard.type('Typed');await pause(180);}
   await page.keyboard.press('F6');await page.waitForFunction(stage=>Object.values(widthHost.renderer.windows).some(w=>w.title?.startsWith(stage+' ')),{timeout:5000},stage);await sample(stage);
 }
 const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);const cpuState=await cpu.evaluate(()=>{const names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,registers:Object.fromEntries(names.map(n=>[n,instance.exports[n]()>>>0]))};});save('cpu-state.json',cpuState);assert.equal(cpuState.memoryBytes,536870912);assert.equal(Object.keys(cpuState.registers).length,19);assert(cpuState.registers.get_eip&&cpuState.registers.get_esp);
 await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));save('assertions.json',{expectOld,failures,states:states.length,productionBrowserCPU:true,visiblePairs:states.map(s=>({stage:s.stage,equal:s.visiblePair,geometry:s.geometryPass})),fourPlanes:states.every(s=>s.fourPlanes.nativeDesktop)});
 if(expectOld){assert(failures.some(v=>v.stage===1&&v.got[1]!==300),'physical preedit readback failure');assert(states.some(s=>s.stage===2&&!s.visiblePair),'physical preedit visible width failure');console.log('PASS oldFAIL reproduced',failures.length);}else{assert(states.every(s=>s.geometryPass&&s.visiblePair!==false),'independent fixed width geometry/row references');assert.deepEqual(failures,[]);console.log('PASS COMBOBOX DROPPED WIDTH public state, native input and four planes',states.length);}
 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('transients.json',await transient.cleanup(out));if(display)await display.close();}
}
function itemsText(sel){return sel<0?'':'Wide option ABCDEFGHIJKLMNOPQRSTUVWXYZ '+String(sel).padStart(2,'0');}
if(require.main===module)main(process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync(require('node:os').tmpdir()+'/combobox-width-'),{expectOld:process.argv.includes('--expect-old')}).catch(e=>{console.error(e.stack);process.exitCode=1;});module.exports={fixture,main,widths};
