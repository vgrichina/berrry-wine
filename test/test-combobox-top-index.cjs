'use strict';
// Microsoft primary: CB_GETTOPINDEX=0x015b, CB_SETTOPINDEX=0x015c.
// https://learn.microsoft.com/en-us/windows/win32/controls/cb-gettopindex
// https://learn.microsoft.com/en-us/windows/win32/controls/cb-settopindex
// https://learn.microsoft.com/en-us/windows/win32/controls/combo-box-styles
// Setter: zero success / CB_ERR failure; item goes to top or max scroll range.
// No specific invalid-index failure is documented: do not prescribe negative,
// out-of-range or empty setter behavior. Empty/reset reads and lifetime/focus
// preservation are bounded emulator invariants. No Windows pixel claim.
// Visible references contain literal item slices, never the observed top index.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const tops=[0,3,3,5,5,1,1,4,4,4,0,0,3,0,3,3,5,5,0,3,0,4];
const opened=[0,0,1,1,1,1,0,0,1,1,1,1,1,0,0,1,1,0,1,1,1,1];
const setters=new Set([1,3,4,5,7,9,11,12,14,16,19,20,21]);
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
unsigned short API RegisterClassA(const void*);long API DefWindowProcA(P,U,U,long);P API SetFocus(P);P API GetFocus(void);int API GetDlgCtrlID(P);int API SetWindowTextA(P,const char*);int API DestroyWindow(P);
long API SendMessageA(P,U,U,long);int API GetMessageA(P,P,U,U);int API TranslateMessage(P);long API DispatchMessageA(P);
struct WC{U style;P proc;int cex,wex;P instance,icon,cursor,brush;const char* menu;const char* name;};
static P frame,combo,ref,other,status,button,instance;static int stage,ready,notifications,ret,guard,variant=3;
static char report[300],text[40];static unsigned char canary[48];
static const char* items[12]={"Option 00","Option 01","Option 02","Option 03","Option 04","Option 05","Option 06","Option 07","Option 08","Option 09","Option 10","Option 11"};
static int tops[22]={0,3,3,5,5,1,1,4,4,4,0,0,3,0,3,3,5,5,0,3,0,4};
void number(int n,int* at){char d[12];int k=0;if(n<0){report[(*at)++]='-';n=-n;}do{d[k++]='0'+n%10;n/=10;}while(n);while(k)report[(*at)++]=d[--k];report[(*at)++]=' ';}
void add(P h,int n){for(int j=0;j<n;++j){SendMessageA(h,0x143,0,(long)items[j]);SendMessageA(h,0x151,j,0x12340000+j);}SendMessageA(h,0x14e,n>2?2:0,0);}
P make(void){P h=CreateWindowExA(0,"COMBOBOX","",0x50000000|variant,15,40,180,89,frame,(P)10,instance,0);add(h,12);return h;}
int same(char* a,char* b){int j=0;while(a[j]&&a[j]==b[j])++j;return a[j]==b[j];}
void settop(P h,int n){char before[40],after[40];P focus=GetFocus();int sel=SendMessageA(h,0x147,0,0),count=SendMessageA(h,0x146,0,0),drop=SendMessageA(h,0x157,0,0),nc=notifications;U edit=SendMessageA(h,0x140,0,0);SendMessageA(h,0xd,40,(long)before);
 for(int j=0;j<48;++j)canary[j]=0xa5;
 ret=SendMessageA(h,0x15c,n,(long)(canary+8));
 SendMessageA(h,0xd,40,(long)after);guard=guard&&GetFocus()==focus&&SendMessageA(h,0x147,0,0)==sel&&SendMessageA(h,0x146,0,0)==count&&SendMessageA(h,0x157,0,0)==drop&&notifications==nc&&same(before,after)&&SendMessageA(h,0x140,0,0)==edit;
 for(int j=0;j<48;++j)guard=guard&&canary[j]==0xa5;}
void reference(void){SendMessageA(ref,0x184,0,0);int count=stage==10?0:stage==11?2:12,top=tops[stage];for(int j=top;j<count&&j<top+4;++j)SendMessageA(ref,0x180,0,(long)items[j]);if(count&&2>=top&&2<top+4&&count>2)SendMessageA(ref,0x186,2-top,0);if(stage==11)SendMessageA(ref,0x186,0,0);}
void publish(void){int at=0,ok=1,n=SendMessageA(combo,0x146,0,0);for(int j=0;j<n;++j){unsigned char b[24];for(int k=0;k<24;++k)b[k]=0xa5;ok=ok&&SendMessageA(combo,0x148,j,(long)(b+2))==9;for(int k=0;k<24;++k){int want=0xa5;if(k>=2&&k<=11)want=items[j][k-2];ok=ok&&b[k]==want;}ok=ok&&(U)SendMessageA(combo,0x150,j,0)==0x12340000+j;}
 number(stage,&at);number(n,&at);number(SendMessageA(combo,0x147,0,0),&at);number(SendMessageA(combo,0x15b,0,0),&at);number(ret,&at);number(SendMessageA(other,0x15b,0,0),&at);number(GetDlgCtrlID(GetFocus()),&at);number(SendMessageA(combo,0x157,0,0),&at);number(guard,&at);number(ok,&at);number(notifications,&at);SendMessageA(combo,0xd,40,(long)text);for(int j=0;text[j]&&j<39;++j)report[at++]=text[j];report[at]=0;SetWindowTextA(status,report);}
void replace(int style){DestroyWindow(combo);variant=style;combo=make();}
void operate(void){notifications=0;ret=99;guard=1;switch(stage){case 0:break;case 1:settop(combo,3);break;case 2:SendMessageA(combo,0x14f,1,0);break;case 3:case 4:settop(combo,5);break;case 5:settop(combo,1);break;case 6:SendMessageA(combo,0x14f,0,0);break;case 7:settop(combo,4);break;case 8:SendMessageA(combo,0x14f,1,0);break;case 9:settop(other,6);break;case 10:SendMessageA(combo,0x14b,0,0);break;case 11:add(combo,2);settop(combo,0);break;case 12:SendMessageA(combo,0x14b,0,0);add(combo,12);settop(combo,3);break;case 13:replace(2);break;case 14:settop(combo,3);break;case 15:SendMessageA(combo,0x14f,1,0);break;case 16:settop(combo,5);break;case 17:SendMessageA(combo,0x14f,0,0);break;case 18:replace(1);break;case 19:settop(combo,3);break;case 20:settop(combo,0);break;case 21:replace(3);settop(combo,4);SendMessageA(combo,0x14f,1,0);break;}reference();publish();}
long __stdcall proc(P h,U m,U w,long l){if(m==0x111&&(w&65535)==10){++notifications;return 0;}if(m==0x111&&(w&65535)==20&&!ready){SetFocus(button);ready=1;operate();return 0;}return DefWindowProcA(h,m,w,l);}
void start(void){instance=GetModuleHandleA(0);struct WC wc={0,proc,0,0,0,0,0,(P)16,0,"ComboTopMenu"};wc.instance=instance;RegisterClassA(&wc);frame=CreateWindowExA(0,"ComboTopMenu","Authored combo top index",0x10cf0000,30,30,570,280,0,0,instance,0);
 combo=make();other=CreateWindowExA(0,"COMBOBOX","",0x40000003,15,300,180,89,frame,(P)11,instance,0);add(other,12);
 ref=CreateWindowExA(0,"LISTBOX","",0x50000000,285,61,180,68,frame,(P)30,instance,0);reference();button=CreateWindowExA(0,"BUTTON","Ready",0x50010000,15,170,100,26,frame,(P)20,instance,0);status=CreateWindowExA(0,"STATIC","starting",0x50000000,15,215,540,24,frame,(P)21,instance,0);
 U msg[12];while(GetMessageA(msg,0,0,0)>0){if(ready&&msg[1]==0x100&&msg[2]=='N'&&stage<21){++stage;operate();}TranslateMessage(msg);DispatchMessageA(msg);}}
`;
function fixture(out){
 fs.writeFileSync(out+'/fixture.c',source);
 for(const [dll,names]of Object.entries({kernel32:['GetModuleHandleA@4'],user32:['CreateWindowExA@48','RegisterClassA@4','DefWindowProcA@16','SetFocus@4','GetFocus@0','GetDlgCtrlID@4','SetWindowTextA@8','DestroyWindow@4','SendMessageA@16','GetMessageA@16','TranslateMessage@4','DispatchMessageA@4']})){
 fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/fixture.c','-o',out+'/fixture.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/combo-top.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib']);return fs.readFileSync(out+'/combo-top.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n'),pause=ms=>new Promise(r=>setTimeout(r,ms));
 const runtime=require(root+'/tools/boids-current-runtime.cjs'),commit=process.env.COMBO_TOP_COMMIT||cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files=runtime.gitFiles(commit);
 if(process.env.COMBO_TOP_WORKING_RUNTIME)for(const n of files.keys())if(fs.existsSync(root+'/'+n))files.set(n,fs.readFileSync(root+'/'+n));
 const own='src/09c3-wndprocs4-combobox.wat';files.set(own,expectOld?cp.execFileSync('git',['show',commit+':'+own],{cwd:root}):fs.readFileSync(root+'/'+own));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{maxBuffer:8e6}));
 const wasm=process.env.COMBO_TOP_WASM?fs.readFileSync(process.env.COMBO_TOP_WASM):runtime.compile(files),pe=fixture(out);fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));files.set('build/wine-assembly.wasm',wasm);files.set('combo-top.exe',pe);
 save('runtime.json',{commit,moduleSHA256:sha(wasm),peSHA256:sha(pe),testSHA256:sha(fs.readFileSync(__filename)),files:[...files].map(([name,b])=>({name,size:b.length,sha256:sha(b)}))});
 const controlBase=Number(/CONTROL_TABLE: \{[^}]*base: (0x[0-9a-fA-F_]+)/.exec(files.get('lib/region-map.generated.js').toString())[1].replaceAll('_',''));
 const transient=require(root+'/tools/browser-transients.cjs').create(),logs=[],pending=[],workers=[],states=[],failures=[];let display,browser,wait,server;
 try{
 server=http.createServer((req,res)=>{const n=new URL(req.url,'http://local').pathname.slice(1)||'index.html',b=files.get(n);res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.html')?'text/html':n.endsWith('.css')?'text/css':n.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.statusCode=b?200:404;res.end(b||'missing');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 display=await require(root+'/tools/gltron-headful-display.cjs').start(out);
 browser=await require(root+'/node_modules/puppeteer').launch({headless:false,defaultViewport:{width:1050,height:800},env:transient.env(display.env),userDataDir:transient.profile,executablePath:'/opt/google/chrome/chrome',args:[...transient.args,'--no-sandbox','--disable-dev-shm-usage','--disable-component-update','--disable-background-networking'],protocolTimeout:45000});wait=transient.watch(browser.process());browser.process().stdout?.resume();browser.process().stderr?.resume();save('browser-version.json',{version:await browser.version()});
 const page=await browser.newPage();page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>logs.push(String(e)));
 page.on('workercreated',w=>{const row={url:w.url(),modules:[]};workers.push(row);const c=w.client;c.on('Debugger.scriptParsed',v=>{if(v.scriptLanguage==='WebAssembly'||v.url.startsWith('wasm://'))pending.push(c.send('Debugger.getScriptSource',{scriptId:v.scriptId}).then(r=>row.modules.push(sha(Buffer.from(r.bytecode,'base64')))));});pending.push(c.send('Debugger.enable'));});
 await page.evaluateOnNewDocument(()=>localStorage.setItem('wine-assembly.threads','1'));await page.goto('http://127.0.0.1:'+server.address().port+'/?debug&threads&no-log');await page.waitForFunction(()=>typeof WineAssembly==='function');
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=650;c.style='position:fixed;left:0;top:0;z-index:99999;width:1000px;height:650px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.topHost=new WineAssembly();topHost.renderer=new Win98Renderer(c);await topHost.init(c);if(!topHost.guestWorker)throw Error('production Worker required');await topHost.loadExe('/combo-top.exe');topHost.run();});
 await page.waitForFunction(()=>Object.values(topHost.renderer.windows).some(w=>w.title==='Ready'),{timeout:15000});await page.evaluate(()=>{browserInput.wireCanvasInput(topHost.renderer.canvas,topHost.renderer,{runningApps:[{wine:topHost}],debugMode:true});topHost.renderer.canvas.focus();});
 await page.mouse.click(30+6+15+30,30+26+170+12);await page.waitForFunction(()=>Object.values(topHost.renderer.windows).some(w=>/^0 12 2 /.test(w.title)),{timeout:15000});
 async function sample(stage){await pause(130);const s=await page.evaluate(base=>{const h=topHost,r=h.renderer,frame=Object.values(r.windows).find(w=>w.title==='Authored combo top index'),popup=Object.values(r.windows).find(w=>w.isPopup&&w.visible),v=new DataView(h.memory.buffer);let kind=null;for(let i=0;i<256;i++)if(v.getUint32(base+i*16+4,true)===10)kind=v.getUint32(base+i*16,true);
 const extract=w=>{const p=w._backCanvas._waCanonicalPresentation;return {hwnd:w.hwnd,x:w.x,y:w.y,w:w.w,h:w.h,pixels:Array.from(w._backCanvas.getContext('2d').getImageData(0,0,w.w,w.h).data),gdi:p?{shared:p.surface.storage.buffer===h.memory.buffer,pixels:Array.from(p.surface.rgbaRect(0,0,w.w,w.h))}:null};};return {kind,frame:extract(frame),popup:popup?extract(popup):null,report:Object.values(r.windows).find(w=>w.isChild&&w.x===15&&w.y===215)?.title,memoryBytes:h.memory.buffer.byteLength};},controlBase);
 assert.equal(s.kind,5,'public COMBOBOX routes to native class5');assert.equal(s.memoryBytes,536870912);
 const parts=s.report.trim().split(/\s+/),got=parts.slice(0,11).map(Number),count=stage===10?0:stage===11?2:12,sel=stage===10?-1:stage===11?0:2;
 const want=[stage,count,sel,tops[stage],setters.has(stage)?0:99,stage>=9?6:0,20,opened[stage],1,1,([2,8,15,21].includes(stage)?1:0)];
 const text=parts.slice(11).join(' '),expectedText=sel<0?'':'Option '+String(sel).padStart(2,'0');s.publicPass=got.length===want.length&&want.every((v,i)=>got[i]===v)&&text===expectedText;if(!s.publicPass)failures.push({stage,got,want,text,expectedText});
 s.stage=stage;s.got=got;s.want=want;s.text=text;const surfaces=[];for(const name of ['frame','popup'])if(s[name]){const p=s[name];assert(p.gdi?.shared);assert(Buffer.from(p.gdi.pixels).equals(Buffer.from(p.pixels)),'shared GDI matches backing canvas');p.shared=true;delete p.gdi;}
 const crop=(p,x,y,w,h)=>{const b=Buffer.alloc(w*h*4),pix=Buffer.from(p.pixels);for(let row=0;row<h;++row)pix.copy(b,row*w*4,((y+row)*p.w+x)*4,((y+row)*p.w+x+w)*4);return {x:p.x+x,y:p.y+y,w,h,bytes:b};};
 const reference=crop(s.frame,293,89,156,62);surfaces.push(reference);let actual=null;if(s.popup)actual=crop(s.popup,4,4,156,62);else if(stage>=18&&stage<=20)actual=crop(s.frame,23,68,156,62);s.visiblePair=actual?actual.bytes.equals(reference.bytes):null;if(actual)surfaces.push(actual);
 s.referenceProbes=[];for(let row=0;row<4;++row){const item=tops[stage]+row,selected=item===sel&&item<count,bg=selected?[0,0,128,255]:[255,255,255,255],at=(row*16*156+140)*4,rgba=[...reference.bytes.subarray(at,at+4)];assert.deepEqual(rgba,bg);const ink=selected?[255,255,255]:[0,0,0];let glyphs=0;for(let y=0;y<Math.min(16,62-row*16);++y)for(let x=0;x<70;++x){const i=((row*16+y)*156+x)*4;if(ink.every((v,j)=>reference.bytes[i+j]===v))glyphs++;}if(item<count)assert(glyphs>5);s.referenceProbes.push({row,item:item<count?item:null,selected,rgba,glyphs});}
 const compositeBytes=await page.screenshot();require(root+'/tools/browser-transients.cjs').captureWhole(out,'stage-'+stage+'-desktop',display.env);const desktopPath=out+'/stage-'+stage+'-desktop.png';const {PNG}=require(root+'/node_modules/pngjs'),composite=PNG.sync.read(compositeBytes),desktop=PNG.sync.read(fs.readFileSync(desktopPath)),g=await page.evaluate(()=>topHost.renderer.canvas.getBoundingClientRect().toJSON());
 const match=(png,v,ox,oy)=>{const x=Math.round(ox+v.x),y=Math.round(oy+v.y);if(x<0||y<0||x+v.w>png.width||y+v.h>png.height)return false;for(let row=0;row<v.h;++row)if(!png.data.subarray(((y+row)*png.width+x)*4,((y+row)*png.width+x+v.w)*4).equals(v.bytes.subarray(row*v.w*4,(row+1)*v.w*4)))return false;return true;};
 assert(surfaces.every(v=>match(composite,v,g.x,g.y)),'compositor exact rows');const first=surfaces[0],needle=first.bytes.subarray(5*156*4,6*156*4);let origin=null;for(let at=desktop.data.indexOf(needle);at>=0;at=desktop.data.indexOf(needle,at+1)){if(at%4)continue;const ox=at/4%desktop.width-first.x,oy=Math.floor(at/4/desktop.width)-first.y-5;if(surfaces.every(v=>match(desktop,v,ox,oy))){origin={x:ox,y:oy};break;}}assert(origin,'native desktop exact rows at one origin');s.fourPlanes={sharedGDI:true,backing:true,compositor:true,nativeDesktop:true,origin};
 if([3,16,19,21].includes(stage)){fs.writeFileSync(out+'/stage-'+stage+'-composited.png',compositeBytes);}else fs.unlinkSync(desktopPath);
 s.surfaces=surfaces.map(({bytes,...v})=>({...v,sha256:sha(bytes)}));for(const name of ['frame','popup'])if(s[name])delete s[name].pixels;states.push(s);save('states.json',states);
 }
 await sample(0);for(let stage=1;stage<tops.length;++stage){await page.keyboard.press('n');await page.waitForFunction(stage=>Object.values(topHost.renderer.windows).some(w=>w.title?.startsWith(stage+' ')),{timeout:5000},stage);await sample(stage);}
 const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);const cpuState=await cpu.evaluate(()=>{const names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,registers:Object.fromEntries(names.map(n=>[n,instance.exports[n]()>>>0]))};});save('cpu-state.json',cpuState);assert.equal(cpuState.memoryBytes,536870912);assert.equal(Object.keys(cpuState.registers).length,19);assert(cpuState.registers.get_eip&&cpuState.registers.get_esp);
 await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));save('assertions.json',{expectOld,failures,states:states.length,productionBrowserCPU:true,visiblePairs:states.filter(s=>s.visiblePair!==null).map(s=>({stage:s.stage,equal:s.visiblePair})),fourPlanes:states.every(s=>s.fourPlanes.nativeDesktop)});
 if(expectOld){assert(failures.some(v=>v.stage===1&&v.got[3]!==v.want[3]),'interior top readback must fail before edit');console.log('PASS oldFAIL reproduced',failures.length);}else{assert(states.every(s=>s.visiblePair!==false),'independent literal row references');assert.deepEqual(failures,[]);console.log('PASS COMBOBOX TOP INDEX public state/canaries/lifetimes and four paint planes',states.length);}
 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('transients.json',await transient.cleanup(out));if(display)await display.close();}
}
if(require.main===module)main(process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync(require('node:os').tmpdir()+'/combobox-top-index-'),{expectOld:process.argv.includes('--expect-old')}).catch(e=>{console.error(e.stack);process.exitCode=1;});module.exports={fixture,main,tops,opened};
