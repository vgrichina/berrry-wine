'use strict';
// Authored native full signed32 geometry, horizontal/vertical, ticks/no ticks,
// constant small-range reference controls, mouse mapping and notifications. Contracts:
// https://learn.microsoft.com/en-us/windows/win32/controls/tbm-setrangemin
// https://learn.microsoft.com/en-us/windows/win32/controls/tbm-setrangemax
// Setter returns are unspecified; getter returns and visible constants are oracles.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
// Every state and reference is authored before execution. No expected value
// is derived from the observed slider position or private trackbar storage.
// Independent fixed references: [minimum, maximum, position, horizontal pixel,
// vertical pixel]. Track lengths are 194 and 114, with the existing 16px thumb.
// Values are constants, never inferred from runtime state or the candidate map.
const cases=[
 [-2147483648,2147483647,-2147483648,0,0],
 [-2147483648,2147483647,-1073741824,48,28],
 [-2147483648,2147483647,-1,96,56],
 [-2147483648,2147483647,0,97,57],
 [-2147483648,2147483647,1073741823,145,85],
 [-2147483648,2147483647,2147483647,194,114],
 [-2147483648,-1,-1073741824,97,57],
 [0,2147483647,1073741823,96,56],
 [-2000000000,2000000000,1000000000,145,85],
 [-100000,100000,90000,184,108],
 [-12,28,-10,9,5],[-12,28,8,97,57],[-12,28,28,194,114],
 // Click-path cases map fixed midpoint/end coordinates back into signed32.
 [-2147483648,2147483647,-1,96,56,1],
 [-2147483648,2147483647,2147483647,194,114,2],
 [-2147483648,2147483647,-2147483648,0,0,3],
 [-12,28,8,97,57,1]
];
const keys=cases.slice(1).map(()=>'a'),expected=cases.map(c=>[c[2],c[2],c[2],c[2]]),bounds=cases.map(c=>c.slice(0,2));
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
unsigned short API RegisterClassA(const void*);long API DefWindowProcA(P,U,U,long);P API SetFocus(P);P API GetFocus(void);int API GetDlgCtrlID(P);int API SetWindowTextA(P,const char*);
long API SendMessageA(P,U,U,long);int API GetMessageA(P,P,U,U);int API TranslateMessage(P);long API DispatchMessageA(P);int API IsDialogMessageA(P,P);
struct WC{U style;P proc;int cex,wex;P instance,icon,cursor,brush;const char* menu;const char* name;};
static P frame,sliders[4],refs[4],status;static int stage,ready,count,lastmsg,lastw,lastid,lastpos,target,handled,inputmsg;static char report[500];
static int settings[17][6]=SETTINGS;static int returns[4];
void number(int n,int* at){char digits[12];int k=0;U value=n;if(n<0){report[(*at)++]='-';value=0-value;}do{digits[k++]='0'+value%10;value/=10;}while(value);while(k)report[(*at)++]=digits[--k];report[(*at)++]=' ';}
void publish(void){int at=0;number(stage,&at);number(GetDlgCtrlID(GetFocus()),&at);for(int j=0;j<4;++j)number(SendMessageA(sliders[j],0x400,0,0),&at);for(int j=0;j<4;++j)number(SendMessageA(sliders[j],0x87,0,0),&at);number(count,&at);number(lastmsg,&at);number(lastw,&at);number(lastid,&at);number(lastpos,&at);number(target,&at);number(handled,&at);number(inputmsg,&at);for(int j=0;j<4;++j){number(SendMessageA(sliders[j],0x401,0,0),&at);number(SendMessageA(sliders[j],0x402,0,0),&at);number(returns[j],&at);}report[at]=0;SetWindowTextA(status,report);}
long __stdcall proc(P h,U m,U w,long l){
 if(m==0x114||m==0x115){++count;lastmsg=m;lastw=w;lastid=GetDlgCtrlID((P)l);lastpos=SendMessageA((P)l,0x400,0,0);return 0;}
 if(m==0x111&&(w&65535)==20){SetFocus(sliders[0]);ready=1;publish();return 0;}return DefWindowProcA(h,m,w,l);}
void start(void){P i=GetModuleHandleA(0);struct WC wc={0,proc,0,0,0,0,0,(P)16,0,"SliderMenu"};wc.instance=i;RegisterClassA(&wc);
 frame=CreateWindowExA(0,"SliderMenu","Authored slider full range geometry",0x10cf0000,30,30,570,390,0,0,i,0);
 for(int j=0;j<4;++j){int vert=j>=2,x=vert?(j==2?35:115):15,y=vert?155:40+j*50,w=vert?32:210,h=vert?130:32;U style=(vert?2:0)|((j&1)?0:0x10);
 sliders[j]=CreateWindowExA(0,"msctls_trackbar32","",0x50010000|style,x,y,w,h,frame,(P)(10+j),i,0);
 refs[j]=CreateWindowExA(0,"msctls_trackbar32","",0x50000000|style,x+270,y,w,h,frame,(P)(30+j),i,0);
 for(int k=0;k<2;++k){P s=k?refs[j]:sliders[j];SendMessageA(s,0x407,0,k?0:(int)0x80000000);SendMessageA(s,0x408,1,k?(vert?114:194):2147483647);SendMessageA(s,0x417,0,3);SendMessageA(s,0x415,0,9);SendMessageA(s,0x405,1,k?0:(int)0x80000000);}}
 CreateWindowExA(0,"BUTTON","Ready",0x50010000,15,300,100,26,frame,(P)20,i,0);status=CreateWindowExA(0,"STATIC","starting",0x50000000,15,335,540,30,frame,(P)21,i,0);
 U msg[12];while(GetMessageA(msg,0,0,0)>0){int key=msg[1]==0x100;if(ready&&key){++stage;for(int j=0;j<4;++j){int *c=settings[stage],vert=j>=2;P t=sliders[j];SendMessageA(t,0x407,0,c[0]);SendMessageA(t,0x408,0,c[1]);
 if(c[5]){int coord=c[5]==1?(vert?65:105):c[5]==2?(vert?122:202):8;long xy=vert?((long)coord<<16)|16:((long)16<<16)|coord;SendMessageA(t,0x201,1,xy);SendMessageA(t,0x202,0,xy);}else SendMessageA(t,0x405,1,c[2]);
 SendMessageA(refs[j],0x405,1,c[vert?4:3]);}}if(ready&&(msg[1]==0x100||msg[1]==0x101)){target=GetDlgCtrlID((P)msg[0]);}
 handled=IsDialogMessageA(frame,msg);if(!handled){TranslateMessage(msg);DispatchMessageA(msg);}if(ready&&(msg[1]==0x100||msg[1]==0x101)){inputmsg=msg[1];publish();}}
}`;
function fixture(out){
 fs.writeFileSync(out+'/fixture.c','#define SETTINGS {'+cases.map(c=>'{'+[...c.slice(0,5),c[5]||0]+'}').join(',')+'}\n'+source);
 for(const [dll,names]of Object.entries({kernel32:['GetModuleHandleA@4'],user32:['CreateWindowExA@48','RegisterClassA@4','DefWindowProcA@16','SetFocus@4','GetFocus@0','GetDlgCtrlID@4','SetWindowTextA@8','SendMessageA@16','GetMessageA@16','TranslateMessage@4','DispatchMessageA@4','IsDialogMessageA@8']})){
 fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/fixture.c','-o',out+'/fixture.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/geometry-menu.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib']);return fs.readFileSync(out+'/geometry-menu.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n'),pause=ms=>new Promise(r=>setTimeout(r,ms));
 const runtime=require(root+'/tools/boids-current-runtime.cjs'),commit=process.env.TRACKBAR_GEOMETRY_COMMIT||cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files=runtime.gitFiles(commit);
 if(process.env.TRACKBAR_GEOMETRY_WORKING_RUNTIME)for(const n of files.keys())if(fs.existsSync(root+'/'+n))files.set(n,fs.readFileSync(root+'/'+n));
 files.set('src/09c3-wndprocs2-tooltip-trackbar.wat',expectOld
   ?cp.execFileSync('git',['show',commit+':src/09c3-wndprocs2-tooltip-trackbar.wat'],{cwd:root})
   :fs.readFileSync(root+'/src/09c3-wndprocs2-tooltip-trackbar.wat'));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{maxBuffer:8e6}));
 const wasm=process.env.TRACKBAR_GEOMETRY_WASM?fs.readFileSync(process.env.TRACKBAR_GEOMETRY_WASM):runtime.compile(files),pe=fixture(out);fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));files.set('build/wine-assembly.wasm',wasm);files.set('geometry-menu.exe',pe);
 save('runtime.json',{commit,moduleSHA256:sha(wasm),peSHA256:sha(pe),keys,expected,files:[...files].map(([name,b])=>({name,size:b.length,sha256:sha(b)}))});
 const transient=require(root+'/tools/browser-transients.cjs').create(),logs=[],pending=[],workers=[],states=[],failures=[];let display,browser,wait,server;
 try{
 server=http.createServer((req,res)=>{const n=new URL(req.url,'http://local').pathname.slice(1)||'index.html',b=files.get(n);res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.html')?'text/html':n.endsWith('.css')?'text/css':n.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.statusCode=b?200:404;res.end(b||'missing');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 display=await require(root+'/tools/gltron-headful-display.cjs').start(out);
 browser=await require(root+'/node_modules/puppeteer').launch({headless:false,defaultViewport:{width:1050,height:800},env:transient.env(display.env),userDataDir:transient.profile,executablePath:'/opt/google/chrome/chrome',args:[...transient.args,'--no-sandbox','--disable-dev-shm-usage','--disable-component-update','--disable-background-networking'],protocolTimeout:45000});wait=transient.watch(browser.process());browser.process().stdout?.resume();browser.process().stderr?.resume();save('browser-version.json',{version:await browser.version()});
 const page=await browser.newPage();page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>logs.push(String(e)));
 page.on('workercreated',w=>{const row={url:w.url(),modules:[]};workers.push(row);const c=w.client;c.on('Debugger.scriptParsed',v=>{if(v.scriptLanguage==='WebAssembly'||v.url.startsWith('wasm://'))pending.push(c.send('Debugger.getScriptSource',{scriptId:v.scriptId}).then(r=>row.modules.push(sha(Buffer.from(r.bytecode,'base64')))));});pending.push(c.send('Debugger.enable'));});
 await page.evaluateOnNewDocument(()=>localStorage.setItem('wine-assembly.threads','1'));await page.goto('http://127.0.0.1:'+server.address().port+'/?debug&threads&no-log');await page.waitForFunction(()=>typeof WineAssembly==='function');
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=650;c.style='position:fixed;left:0;top:0;z-index:99999;width:1000px;height:650px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.sliderHost=new WineAssembly();sliderHost.renderer=new Win98Renderer(c);await sliderHost.init(c);if(!sliderHost.guestWorker)throw Error('production Worker required');await sliderHost.loadExe('/geometry-menu.exe');sliderHost.run();});
 await page.waitForFunction(()=>Object.values(sliderHost.renderer.windows).some(w=>w.title==='Ready'),{timeout:15000});await page.evaluate(()=>{browserInput.wireCanvasInput(sliderHost.renderer.canvas,sliderHost.renderer,{runningApps:[{wine:sliderHost}],debugMode:true});sliderHost.renderer.canvas.focus();});
 await page.mouse.click(30+6+15+30,30+26+300+12);await page.waitForFunction(()=>Object.values(sliderHost.renderer.windows).some(w=>/^0 10 -2147483648 -2147483648 -2147483648 -2147483648 /.test(w.title)),{timeout:15000});
 let focus=0,count=0,last=[0,0,0,0];
 async function sample(stage,phase,key){await pause(90);const s=await page.evaluate(()=>{const h=sliderHost,r=h.renderer,w=Object.values(r.windows).find(w=>w.title==='Authored slider full range geometry'),ctx=w._backCanvas.getContext('2d'),p=w._backCanvas._waCanonicalPresentation;return {report:Object.values(r.windows).find(w=>w.isChild&&w.x===15&&w.y===335)?.title,memoryBytes:h.memory.buffer.byteLength,rows:Object.values(r.windows).map(v=>({hwnd:v.hwnd,title:v.title,x:v.x,y:v.y,w:v.w,h:v.h,visible:v.visible,isChild:v.isChild})),gdi:p?{sharedGuestStorage:p.surface.storage.buffer===h.memory.buffer,pixels:Array.from(p.surface.rgbaRect(0,0,w.w,w.h))}:null,pixels:Array.from(ctx.getImageData(0,0,w.w,w.h).data),width:w.w,height:w.h};});
 if(phase==='down'&&cases[stage][5]){count+=12;last=[277,8,13,cases[stage][2]];}
 const got=s.report.trim().split(/\s+/).map(Number),want=[stage,10+focus,...expected[stage],1,1,1,1,count,...last,phase==='initial'?0:phase==='down'&&key==='Tab'?9+focus:10+focus,phase==='down'&&key==='Tab'?1:0,phase==='initial'?0:phase==='down'?256:257,...Array.from({length:4},()=>[...bounds[stage],0]).flat()];s.stage=stage;s.phase=phase;s.key=key;s.expected=want;s.actual=got;s.setterReturns=got.filter((v,i)=>i>=18&&(i-18)%3===2);s.publicPass=got.length===want.length&&want.every((v,i)=>i>=18&&(i-18)%3===2||got[i]===v);if(!s.publicPass)failures.push({stage,phase,key,got,want});
 assert(s.gdi?.sharedGuestStorage,'canonical GDI shared guest storage');const pix=Buffer.from(s.pixels),gd=Buffer.from(s.gdi.pixels),pairs=[];for(let j=0;j<4;++j){const vert=j>=2,x=(vert?(j===2?35:115):15)+6,y=(vert?155:40+j*50)+26,w=vert?32:210,h=vert?130:32;let equal=true;for(let row=0;row<h;++row){if(!pix.subarray(((y+row)*s.width+x)*4,((y+row)*s.width+x+w)*4).equals(pix.subarray(((y+row)*s.width+x+270)*4,((y+row)*s.width+x+270+w)*4)))equal=false;}for(let side=0;side<2;++side)for(let row=0;row<h;++row){const at=((y+row)*s.width+x+side*270)*4;assert(pix.subarray(at,at+w*4).equals(gd.subarray(at,at+w*4)),'GDI memory/backingcanvas agreement');}pairs.push({j,equal});}s.pairs=pairs;
 // Selected evidence only. Reference controls are driven by constants computed
 // before the run and never from an observed trackbar position.
 if(phase==='up'&&[1,3,5,8,11,13,14,15,16].includes(stage)){fs.writeFileSync(out+'/pixels-'+stage+'.json.gz',zlib.gzipSync(Buffer.from(JSON.stringify({width:s.width,height:s.height,pixels:s.pixels}))));await page.screenshot({path:out+'/stage-'+stage+'-composited.png'});require(root+'/tools/browser-transients.cjs').captureWhole(out,'stage-'+stage+'-desktop',display.env);
 const {PNG}=require(root+'/node_modules/pngjs'),composite=PNG.sync.read(fs.readFileSync(out+'/stage-'+stage+'-composited.png')),desktop=PNG.sync.read(fs.readFileSync(out+'/stage-'+stage+'-desktop.png'));
 const frame=s.rows.find(w=>w.title==='Authored slider full range geometry'),g=await page.evaluate(()=>sliderHost.renderer.canvas.getBoundingClientRect().toJSON());
 const surfaces=[];for(let j=0;j<4;++j)for(let side=0;side<2;++side){const vert=j>=2,x=(vert?(j===2?35:115):15)+6+side*270,y=(vert?155:40+j*50)+26,w=vert?32:210,h=vert?130:32,bytes=Buffer.alloc(w*h*4);for(let row=0;row<h;++row)pix.copy(bytes,row*w*4,((y+row)*s.width+x)*4,((y+row)*s.width+x+w)*4);surfaces.push({j,side,x,y,w,h,bytes});}
 const match=(png,v,ox,oy)=>{const x=Math.round(ox+v.x),y=Math.round(oy+v.y);if(x<0||y<0||x+v.w>png.width||y+v.h>png.height)return false;for(let row=0;row<v.h;++row)if(!png.data.subarray(((y+row)*png.width+x)*4,((y+row)*png.width+x+v.w)*4).equals(v.bytes.subarray(row*v.w*4,(row+1)*v.w*4)))return false;return true;};
 assert(surfaces.every(v=>match(composite,v,g.x+frame.x,g.y+frame.y)),'compositor contains exact observed slider surfaces');
 const first=surfaces[0],needle=first.bytes.subarray(16*first.w*4,17*first.w*4);let origin=null;
 for(let at=desktop.data.indexOf(needle);at>=0;at=desktop.data.indexOf(needle,at+1)){if(at%4)continue;const ox=at/4%desktop.width-first.x,oy=Math.floor(at/4/desktop.width)-first.y-16;if(surfaces.every(v=>match(desktop,v,ox,oy))){origin={x:ox,y:oy};break;}}
 assert(origin,'native desktop contains all eight slider surfaces at one origin');save('stage-'+stage+'-visible.json',{origin,exactCompositor:true,exactNativeDesktop:true,surfaces:surfaces.map(({bytes,...v})=>({...v,sha256:sha(bytes)}))});
 }
 s.gdi.sha256=sha(gd);delete s.gdi.pixels;delete s.pixels;states.push(s);save('states.json',states);return s;
 }
 await sample(0,'initial','');
 for(let i=0;i<keys.length;++i){const k=keys[i];
 await page.keyboard.down(k);await page.waitForFunction(stage=>Object.values(sliderHost.renderer.windows).some(w=>w.title?.startsWith(stage+' ')),{timeout:5000},i+1);await sample(i+1,'down',k);
 await page.keyboard.up(k);
 // Wait for guest dispatch acknowledgement, independent of position or
 // notification expectations, so a loaded host cannot masquerade as failure.
 await page.waitForFunction(stage=>Object.values(sliderHost.renderer.windows).some(w=>w.title?.startsWith(stage+' ')&&w.title.trim().split(/\s+/)[17]==='257'),{timeout:5000},i+1);await sample(i+1,'up',k);}
 const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);const cpuState=await cpu.evaluate(()=>{const names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,registers:Object.fromEntries(names.map(n=>[n,instance.exports[n]()>>>0]))};});save('cpu-state.json',cpuState);assert.equal(cpuState.memoryBytes,536870912);assert.equal(Object.keys(cpuState.registers).length,19);assert(cpuState.registers.get_eip&&cpuState.registers.get_esp);
 await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));
 save('assertions.json',{expectOld,failures,states:states.length,productionBrowserCPU:true,referencePairsMatch:states.every(s=>s.pairs.every(p=>p.equal))});
 if(expectOld){assert(states.some(s=>!s.pairs.every(p=>p.equal)),'physical preedit geometry oldFAIL required');console.log('PASS oldFAIL reproduced',failures.length);}else{assert.deepEqual(failures,[]);assert(states.every(s=>s.pairs.every(p=>p.equal)));console.log('PASS TRACKBAR full signed32 geometry production public getters/GDI/backcanvas/compositor/native reference pairs',states.length);}
 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('transients.json',await transient.cleanup(out));if(display)await display.close();}
}
if(require.main===module)main(process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync(require('node:os').tmpdir()+'/trackbar-full-range-geometry-'),{expectOld:process.argv.includes('--expect-old')}).catch(e=>{console.error(e.stack);process.exitCode=1;});module.exports={fixture,main,keys,expected,bounds,cases};

