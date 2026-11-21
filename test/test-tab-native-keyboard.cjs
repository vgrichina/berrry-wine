'use strict';
// Ordinary, horizontal native tabs: physical arrows via IsDialogMessage,
// synchronous selection/veto observations, silent programmatic selection and
// Tab exit. Fixed expected states are authored before any implementation edit.
// Microsoft: /windows/win32/controls/tab-controls, tcn-selchanging,
// tcn-selchange, tcm-setcursel, tcm-getcurfocus. Home/End selection is not
// established by these Win32 contracts; no button/multiline/vertical extension.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const keys=['ArrowRight','ArrowRight','ArrowLeft','ArrowLeft','ArrowRight','ArrowRight','ArrowRight','ArrowLeft','p','ArrowLeft','Tab'];
const expected=[0,1,1,0,0,1,2,2,1,2,1,1];
const changes=[[],[[-552,0],[-551,1]],[[-552,1]],[[-552,1],[-551,0]],[],[[-552,0],[-551,1]],[[-552,1],[-551,2]],[],[[-552,2],[-551,1]],[],[[-552,2],[-551,1]],[]];
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
unsigned short API RegisterClassA(const void*);long API DefWindowProcA(P,U,U,long);P API SetFocus(P);P API GetFocus(void);int API GetDlgCtrlID(P);int API SetWindowTextA(P,const char*);
long API SendMessageA(P,U,U,long);int API GetMessageA(P,P,U,U);int API TranslateMessage(P);long API DispatchMessageA(P);int API IsDialogMessageA(P,P);
struct WC{U style;P proc;int cex,wex;P instance,icon,cursor,brush;const char* menu;const char* name;};
struct Item{U mask,state,smask;char* text;int length,image;long param;};
struct Header{P hwnd;U id;int code;};
int API ShowWindow(P,int);int API IsWindowVisible(P);int API InitCommonControlsEx(P);
static P frame,tabs,ref,status,pages[3],refs[3];static int stage,ready,count,other,events[32][6],target,handled,inputmsg;static char report[1800];
static int expected[12]={0,1,1,0,0,1,2,2,1,2,1,1};
void showpage(P* p,int sel){for(int j=0;j<3;++j)ShowWindow(p[j],j==sel?5:0);}
void number(int n,int* at){char digits[12];int k=0;if(n<0){report[(*at)++]='-';n=-n;}do{digits[k++]='0'+n%10;n/=10;}while(n);while(k)report[(*at)++]=digits[--k];report[(*at)++]=' ';}
void publish(void){int at=0;number(stage,&at);number(GetDlgCtrlID(GetFocus()),&at);number(SendMessageA(tabs,0x130b,0,0),&at);number(SendMessageA(tabs,0x132f,0,0),&at);number(SendMessageA(tabs,0x87,0,0),&at);number(count,&at);number(other,&at);number(target,&at);number(handled,&at);number(inputmsg,&at);number(IsWindowVisible(pages[0])+2*IsWindowVisible(pages[1])+4*IsWindowVisible(pages[2]),&at);for(int j=0;j<count;++j)for(int k=0;k<6;++k)number(events[j][k],&at);report[at]=0;SetWindowTextA(status,report);}
long __stdcall proc(P h,U m,U w,long l){
 if(m==0x4e){struct Header* n=(struct Header*)l;if(n->code==-552||n->code==-551){int* e=events[count++];e[0]=n->code;e[1]=SendMessageA(n->hwnd,0x130b,0,0);e[2]=SendMessageA(n->hwnd,0x132f,0,0);e[3]=n->hwnd==tabs;e[4]=n->id;e[5]=GetDlgCtrlID(GetFocus());if(n->code==-551)showpage(pages,e[1]);return stage==2&&n->code==-552;}++other;return 0;}
 if(m==0x111&&(w&65535)==20){SetFocus(tabs);ready=1;publish();return 0;}return DefWindowProcA(h,m,w,l);}
void start(void){U ic[2]={8,8};InitCommonControlsEx(ic);P i=GetModuleHandleA(0);struct WC wc={0,proc,0,0,0,0,0,(P)16,0,"TabMenu"};wc.instance=i;RegisterClassA(&wc);
 frame=CreateWindowExA(0,"TabMenu","Authored tab keyboard settings",0x10cf0000,30,30,570,280,0,0,i,0);
 tabs=CreateWindowExA(0,"SysTabControl32","",0x50010000,15,40,230,100,frame,(P)10,i,0);
 ref=CreateWindowExA(0,"SysTabControl32","",0x50000000,285,40,230,100,frame,(P)30,i,0);
 char* names[3]={"Audio","Video","Input"};for(int j=0;j<3;++j){struct Item it={1,0,0,names[j],0,0,0};SendMessageA(tabs,0x1307,j,(long)&it);SendMessageA(ref,0x1307,j,(long)&it);pages[j]=CreateWindowExA(0,"STATIC",names[j],0x40000000,20,75,210,55,frame,(P)(40+j),i,0);refs[j]=CreateWindowExA(0,"STATIC",names[j],0x40000000,290,75,210,55,frame,(P)(50+j),i,0);}showpage(pages,0);showpage(refs,0);
 CreateWindowExA(0,"BUTTON","Ready",0x50010000,15,170,100,26,frame,(P)20,i,0);status=CreateWindowExA(0,"STATIC","starting",0x50000000,15,215,540,24,frame,(P)21,i,0);
 U msg[12];while(GetMessageA(msg,0,0,0)>0){if(ready&&msg[1]==0x100){++stage;SendMessageA(ref,0x130c,expected[stage],0);showpage(refs,expected[stage]);if(stage==9){SendMessageA(tabs,0x130c,2,0);showpage(pages,2);}}if(ready&&(msg[1]==0x100||msg[1]==0x101))target=GetDlgCtrlID((P)msg[0]);
 handled=IsDialogMessageA(frame,msg);if(!handled){TranslateMessage(msg);DispatchMessageA(msg);}if(ready&&(msg[1]==0x100||msg[1]==0x101)){inputmsg=msg[1];publish();}}
}`;
function fixture(out){
 fs.writeFileSync(out+'/fixture.c',source);
 for(const [dll,names]of Object.entries({comctl32:['InitCommonControlsEx@4'],kernel32:['GetModuleHandleA@4'],user32:['ShowWindow@8','IsWindowVisible@4','CreateWindowExA@48','RegisterClassA@4','DefWindowProcA@16','SetFocus@4','GetFocus@0','GetDlgCtrlID@4','SetWindowTextA@8','SendMessageA@16','GetMessageA@16','TranslateMessage@4','DispatchMessageA@4','IsDialogMessageA@8']})){
 fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/fixture.c','-o',out+'/fixture.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/tab-menu.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib',out+'/comctl32.lib']);return fs.readFileSync(out+'/tab-menu.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n'),pause=ms=>new Promise(r=>setTimeout(r,ms));
 const runtime=require(root+'/tools/boids-current-runtime.cjs'),commit=process.env.TAB_COMMIT||cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files=runtime.gitFiles(commit);
 if(process.env.TAB_WORKING_RUNTIME)for(const n of files.keys())if(fs.existsSync(root+'/'+n))files.set(n,fs.readFileSync(root+'/'+n));
 for(const n of ['src/09c3-controls.wat','src/09c9-winhelp-ui.wat'])files.set(n,expectOld?cp.execFileSync('git',['show',commit+':'+n],{cwd:root}):fs.readFileSync(root+'/'+n));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{maxBuffer:8e6}));
 const wasm=process.env.TAB_WASM?fs.readFileSync(process.env.TAB_WASM):runtime.compile(files),pe=fixture(out);fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));files.set('build/wine-assembly.wasm',wasm);files.set('tab-menu.exe',pe);
 save('runtime.json',{commit,moduleSHA256:sha(wasm),peSHA256:sha(pe),keys,expected,files:[...files].map(([name,b])=>({name,size:b.length,sha256:sha(b)}))});
 const controlBase=Number(/CONTROL_TABLE: \{[^}]*base: (0x[0-9a-fA-F_]+)/.exec(files.get('lib/region-map.generated.js').toString())[1].replaceAll('_',''));
 const transient=require(root+'/tools/browser-transients.cjs').create(),logs=[],pending=[],workers=[],states=[],failures=[];let display,browser,wait,server;
 try{
 server=http.createServer((req,res)=>{const n=new URL(req.url,'http://local').pathname.slice(1)||'index.html',b=files.get(n);res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.html')?'text/html':n.endsWith('.css')?'text/css':n.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.statusCode=b?200:404;res.end(b||'missing');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 display=await require(root+'/tools/gltron-headful-display.cjs').start(out);
 browser=await require(root+'/node_modules/puppeteer').launch({headless:false,defaultViewport:{width:1050,height:800},env:transient.env(display.env),userDataDir:transient.profile,executablePath:'/opt/google/chrome/chrome',args:[...transient.args,'--no-sandbox','--disable-dev-shm-usage','--disable-component-update','--disable-background-networking'],protocolTimeout:45000});wait=transient.watch(browser.process());browser.process().stdout?.resume();browser.process().stderr?.resume();save('browser-version.json',{version:await browser.version()});
 const page=await browser.newPage();page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>logs.push(String(e)));
 page.on('workercreated',w=>{const row={url:w.url(),modules:[]};workers.push(row);const c=w.client;c.on('Debugger.scriptParsed',v=>{if(v.scriptLanguage==='WebAssembly'||v.url.startsWith('wasm://'))pending.push(c.send('Debugger.getScriptSource',{scriptId:v.scriptId}).then(r=>row.modules.push(sha(Buffer.from(r.bytecode,'base64')))));});pending.push(c.send('Debugger.enable'));});
 await page.evaluateOnNewDocument(()=>localStorage.setItem('wine-assembly.threads','1'));await page.goto('http://127.0.0.1:'+server.address().port+'/?debug&threads&no-log');await page.waitForFunction(()=>typeof WineAssembly==='function');
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=650;c.style='position:fixed;left:0;top:0;z-index:99999;width:1000px;height:650px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.tabHost=new WineAssembly();tabHost.renderer=new Win98Renderer(c);await tabHost.init(c);if(!tabHost.guestWorker)throw Error('production Worker required');await tabHost.loadExe('/tab-menu.exe');tabHost.run();});
 await page.waitForFunction(()=>Object.values(tabHost.renderer.windows).some(w=>w.title==='Ready'),{timeout:15000});await page.evaluate(()=>{browserInput.wireCanvasInput(tabHost.renderer.canvas,tabHost.renderer,{runningApps:[{wine:tabHost}],debugMode:true});tabHost.renderer.canvas.focus();});
 await page.mouse.click(30+6+15+30,30+26+170+12);await page.waitForFunction(()=>Object.values(tabHost.renderer.windows).some(w=>/^0 10 0 0 /.test(w.title)),{timeout:15000});

 let all=[];
 async function sample(stage,phase,key){await pause(110);const s=await page.evaluate(base=>{const h=tabHost,r=h.renderer,w=Object.values(r.windows).find(w=>w.title==='Authored tab keyboard settings');const v=new DataView(h.memory.buffer);let kind=null;for(let i=0;i<256;i++)if(v.getUint32(base+i*16+4,true)===10)kind=v.getUint32(base+i*16,true);const p=w._backCanvas._waCanonicalPresentation;return {kind,gdi:p?{shared:p.surface.storage.buffer===h.memory.buffer,pixels:Array.from(p.surface.rgbaRect(0,0,w.w,w.h))}:null,report:Object.values(r.windows).find(w=>w.isChild&&w.x===15&&w.y===215)?.title,memoryBytes:h.memory.buffer.byteLength,rows:Object.values(r.windows).map(v=>({hwnd:v.hwnd,title:v.title,x:v.x,y:v.y,w:v.w,h:v.h,visible:v.visible,isChild:v.isChild})),pixels:Array.from(w._backCanvas.getContext('2d').getImageData(0,0,w.w,w.h).data),width:w.w,height:w.h};},controlBase);assert.equal(s.kind,27,"public SysTabControl32 must route to native class27");
 const got=s.report.trim().split(/\s+/).map(Number),want=[stage,stage===11?20:10,expected[stage],expected[stage],129,all.length,0,phase==='initial'?0:phase==='up'&&stage===11?20:10,phase==='down'&&key==='Tab'?1:0,phase==='initial'?0:phase==='down'?256:257,1<<expected[stage],...all.flat()];
 s.stage=stage;s.phase=phase;s.key=key;s.expected=want;s.actual=got;s.publicPass=got.length===want.length&&want.every((v,i)=>got[i]===v);if(!s.publicPass)failures.push({stage,phase,key,got,want});
 const pix=Buffer.from(s.pixels);assert(s.gdi?.shared,"GDI uses shared guest memory");const gdi=Buffer.from(s.gdi.pixels);s.gdiShared=true;s.gdiMatchesBacking=gdi.equals(pix);assert(s.gdiMatchesBacking);delete s.gdi;const x=19,y=64,w=230,h=100;let equal=true;for(let row=0;row<h;++row)if(!pix.subarray(((y+row)*s.width+x)*4,((y+row)*s.width+x+w)*4).equals(pix.subarray(((y+row)*s.width+x+270)*4,((y+row)*s.width+x+270+w)*4)))equal=false;s.pairs=[{equal}];
 // Geometry/color oracle specified independently: five-character labels have
 // 41px width; the selected face rises to y=0, all others start at y=2.
 // Probe text-free interior points on the top bevel, no reference readback.
 s.probes=[];for(let j=0;j<3;++j){const rgba=Array.from(pix.subarray(((y)*s.width+x+j*41+15)*4,((y)*s.width+x+j*41+15)*4+4));const expectedRGBA=j===expected[stage]?[255,255,255,255]:[192,192,192,255];s.probes.push({j,rgba,expectedRGBA,pass:rgba.every((v,i)=>v===expectedRGBA[i])});}
 if(phase==='up'&&(stage===1||stage===2||stage===6)){fs.writeFileSync(out+'/pixels-'+stage+'.json.gz',zlib.gzipSync(Buffer.from(JSON.stringify({width:s.width,height:s.height,pixels:s.pixels}))));await page.screenshot({path:out+'/stage-'+stage+'-composited.png'});require(root+'/tools/browser-transients.cjs').captureWhole(out,'stage-'+stage+'-desktop',display.env);
 const {PNG}=require(root+'/node_modules/pngjs'),composite=PNG.sync.read(fs.readFileSync(out+'/stage-'+stage+'-composited.png')),desktop=PNG.sync.read(fs.readFileSync(out+'/stage-'+stage+'-desktop.png')),frame=s.rows.find(w=>w.title==='Authored tab keyboard settings'),g=await page.evaluate(()=>tabHost.renderer.canvas.getBoundingClientRect().toJSON());
 const surfaces=[];for(let side=0;side<2;++side){const sx=x+side*270,bytes=Buffer.alloc(w*h*4);for(let row=0;row<h;++row)pix.copy(bytes,row*w*4,((y+row)*s.width+sx)*4,((y+row)*s.width+sx+w)*4);surfaces.push({x:sx,y,w,h,bytes});}
 const match=(png,v,ox,oy)=>{const x=Math.round(ox+v.x),y=Math.round(oy+v.y);if(x<0||y<0||x+v.w>png.width||y+v.h>png.height)return false;for(let row=0;row<v.h;++row)if(!png.data.subarray(((y+row)*png.width+x)*4,((y+row)*png.width+x+v.w)*4).equals(v.bytes.subarray(row*v.w*4,(row+1)*v.w*4)))return false;return true;};
 assert(surfaces.every(v=>match(composite,v,g.x+frame.x,g.y+frame.y)));const first=surfaces[0],needle=first.bytes.subarray(10*w*4,11*w*4);let origin=null;for(let at=desktop.data.indexOf(needle);at>=0;at=desktop.data.indexOf(needle,at+1)){if(at%4)continue;const ox=at/4%desktop.width-first.x,oy=Math.floor(at/4/desktop.width)-first.y-10;if(surfaces.every(v=>match(desktop,v,ox,oy))){origin={x:ox,y:oy};break;}}assert(origin,'native desktop contains both exact tab surfaces');save('stage-'+stage+'-visible.json',{origin,exactCompositor:true,exactNativeDesktop:true,probes:s.probes,surfaces:surfaces.map(({bytes,...v})=>({...v,sha256:sha(bytes)}))});}
 delete s.pixels;states.push(s);save('states.json',states);
 }
 await sample(0,'initial','');
 for(let i=0;i<keys.length;++i){const k=keys[i];all.push(...changes[i+1].map(([code,sel])=>[code,sel,sel,1,10,10]));await page.keyboard.down(k);await page.waitForFunction(stage=>Object.values(tabHost.renderer.windows).some(w=>w.title?.startsWith(stage+' ')&&w.title.trim().split(/\s+/)[9]==='256'),{timeout:5000},i+1);await sample(i+1,'down',k);await page.keyboard.up(k);await page.waitForFunction(stage=>Object.values(tabHost.renderer.windows).some(w=>w.title?.startsWith(stage+' ')&&w.title.trim().split(/\s+/)[9]==='257'),{timeout:5000},i+1);await sample(i+1,'up',k);}
 const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);const cpuState=await cpu.evaluate(()=>{const names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];globalThis.__tabSnapshot=new Uint8Array(memory.buffer).slice();return {memoryBytes:__tabSnapshot.length,registers:Object.fromEntries(names.map(n=>[n,instance.exports[n]()>>>0]))};});
 const memoryHash=crypto.createHash('sha256');for(let offset=0;offset<cpuState.memoryBytes;offset+=4194304){const chunk=await cpu.evaluate(offset=>{const b=__tabSnapshot.subarray(offset,offset+4194304);let s='';for(let i=0;i<b.length;i+=32768)s+=String.fromCharCode(...b.subarray(i,i+32768));return btoa(s);},offset);memoryHash.update(Buffer.from(chunk,'base64'));}cpuState.allMemorySHA256=memoryHash.digest('hex');await cpu.evaluate(()=>delete globalThis.__tabSnapshot);save('cpu-state.json',cpuState);assert.equal(cpuState.memoryBytes,536870912);assert.equal(Object.keys(cpuState.registers).length,19);assert(cpuState.registers.get_eip&&cpuState.registers.get_esp);
 await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));
 save('assertions.json',{expectOld,failures,states:states.length,productionBrowserCPU:true,referencePairsMatch:states.every(s=>s.pairs.every(p=>p.equal))});
 if(expectOld){assert(failures.some(v=>v.stage===1&&v.got[2]!==v.want[2]),'first supported arrow oldFAIL required');console.log('PASS oldFAIL reproduced',failures.length);}else{assert.deepEqual(failures,[]);assert(states.every(s=>s.pairs.every(p=>p.equal)&&s.probes.every(p=>p.pass)));console.log('PASS TAB browser keyboard public selection/notifications and visible reference pairs',states.length);}
 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('transients.json',await transient.cleanup(out));if(display)await display.close();}
}
if(require.main===module)main(process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync(require('node:os').tmpdir()+'/tab-control-keyboard-'),{expectOld:process.argv.includes('--expect-old')}).catch(e=>{console.error(e.stack);process.exitCode=1;});module.exports={fixture,main,keys,expected};
