'use strict';
// Authored native sliders. Expectations are fixed inputs, arithmetic and the
// Microsoft keyboard contract; observations use only guest public USER calls.
// https://learn.microsoft.com/en-us/windows/win32/controls/trackbar-controls
// https://learn.microsoft.com/en-us/windows/win32/controls/wm-hscroll--trackbar-
// https://learn.microsoft.com/en-us/windows/win32/controls/trackbar-control-styles
// Each report is stage, focus ID, four TBM_GETPOS values, four dialog codes,
// notification count/message/wParam/control ID/callback-time TBM_GETPOS,
// GetMessage target ID and IsDialogMessage result. Check keydown and keyup
// separately so a duplicate or missing notification cannot cancel itself out.
// H/V and the inert TBS_REVERSED label are supported here. DOWNISLEFT and
// selection-range semantics are outside this existing control subset.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const sequence=['ArrowRight','ArrowDown','ArrowLeft','ArrowUp','PageDown','PageUp','Home','ArrowLeft','End','ArrowRight','PageUp','PageUp','PageUp','PageUp','PageUp','PageDown','a'];
const moves={ArrowLeft:[-3,0],ArrowUp:[-3,0],ArrowRight:[3,1],ArrowDown:[3,1],PageUp:[-9,2],PageDown:[9,3],Home:[-Infinity,6],End:[Infinity,7]};
const keys=Array.from({length:4},(_,i)=>[...sequence,...(i<3?['Tab']:[])]).flat();
let active=0,positions=[7,7,7,7];const expected=[positions.slice()];
for(const k of keys){if(k==='Tab')active++;else if(moves[k])positions[active]=Math.max(-12,Math.min(28,positions[active]+moves[k][0]));expected.push(positions.slice());}
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
unsigned short API RegisterClassA(const void*);long API DefWindowProcA(P,U,U,long);P API SetFocus(P);P API GetFocus(void);int API GetDlgCtrlID(P);int API SetWindowTextA(P,const char*);
long API SendMessageA(P,U,U,long);int API GetMessageA(P,P,U,U);int API TranslateMessage(P);long API DispatchMessageA(P);int API IsDialogMessageA(P,P);
struct WC{U style;P proc;int cex,wex;P instance,icon,cursor,brush;const char* menu;const char* name;};
static P frame,sliders[4],refs[4],status;static int stage,ready,count,lastmsg,lastw,lastid,lastpos,target,handled,inputmsg;static char report[220];
static int expected[72][4]=EXPECTED;
void number(int n,int* at){char digits[12];int k=0;if(n<0){report[(*at)++]='-';n=-n;}do{digits[k++]='0'+n%10;n/=10;}while(n);while(k)report[(*at)++]=digits[--k];report[(*at)++]=' ';}
void publish(void){int at=0;number(stage,&at);number(GetDlgCtrlID(GetFocus()),&at);for(int j=0;j<4;++j)number(SendMessageA(sliders[j],0x400,0,0),&at);for(int j=0;j<4;++j)number(SendMessageA(sliders[j],0x87,0,0),&at);number(count,&at);number(lastmsg,&at);number(lastw,&at);number(lastid,&at);number(lastpos,&at);number(target,&at);number(handled,&at);number(inputmsg,&at);report[at]=0;SetWindowTextA(status,report);}
long __stdcall proc(P h,U m,U w,long l){
 if(m==0x114||m==0x115){++count;lastmsg=m;lastw=w;lastid=GetDlgCtrlID((P)l);lastpos=SendMessageA((P)l,0x400,0,0);return 0;}
 if(m==0x111&&(w&65535)==20){SetFocus(sliders[0]);ready=1;publish();return 0;}return DefWindowProcA(h,m,w,l);}
void start(void){P i=GetModuleHandleA(0);struct WC wc={0,proc,0,0,0,0,0,(P)16,0,"SliderMenu"};wc.instance=i;RegisterClassA(&wc);
 frame=CreateWindowExA(0,"SliderMenu","Authored slider keyboard settings",0x10cf0000,30,30,570,390,0,0,i,0);
 for(int j=0;j<4;++j){int vert=j>=2,x=vert?(j==2?35:115):15,y=vert?155:40+j*50,w=vert?32:210,h=vert?130:32;U style=(vert?2:0)|((j&1)?0x200:0)|0x10;
 sliders[j]=CreateWindowExA(0,"msctls_trackbar32","",0x50010000|style,x,y,w,h,frame,(P)(10+j),i,0);
 refs[j]=CreateWindowExA(0,"msctls_trackbar32","",0x50000000|style,x+270,y,w,h,frame,(P)(30+j),i,0);
 for(int k=0;k<2;++k){P s=k?refs[j]:sliders[j];SendMessageA(s,0x407,0,-12);SendMessageA(s,0x408,1,28);SendMessageA(s,0x417,0,3);SendMessageA(s,0x415,0,9);SendMessageA(s,0x405,1,7);}}
 CreateWindowExA(0,"BUTTON","Ready",0x50010000,15,300,100,26,frame,(P)20,i,0);status=CreateWindowExA(0,"STATIC","starting",0x50000000,15,335,540,30,frame,(P)21,i,0);
 U msg[12];while(GetMessageA(msg,0,0,0)>0){int key=msg[1]==0x100;if(ready&&key){++stage;for(int j=0;j<4;++j)SendMessageA(refs[j],0x405,1,expected[stage][j]);}if(ready&&(msg[1]==0x100||msg[1]==0x101)){target=GetDlgCtrlID((P)msg[0]);}
 handled=IsDialogMessageA(frame,msg);if(!handled){TranslateMessage(msg);DispatchMessageA(msg);}if(ready&&(msg[1]==0x100||msg[1]==0x101)){inputmsg=msg[1];publish();}}
}`;
function fixture(out){
 fs.writeFileSync(out+'/fixture.c','#define EXPECTED {'+expected.map(p=>'{'+p+'}').join(',')+'}\n'+source);
 for(const [dll,names]of Object.entries({kernel32:['GetModuleHandleA@4'],user32:['CreateWindowExA@48','RegisterClassA@4','DefWindowProcA@16','SetFocus@4','GetFocus@0','GetDlgCtrlID@4','SetWindowTextA@8','SendMessageA@16','GetMessageA@16','TranslateMessage@4','DispatchMessageA@4','IsDialogMessageA@8']})){
 fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/fixture.c','-o',out+'/fixture.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/slider-menu.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib']);return fs.readFileSync(out+'/slider-menu.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n'),pause=ms=>new Promise(r=>setTimeout(r,ms));
 const runtime=require(root+'/tools/boids-current-runtime.cjs'),commit=process.env.TRACKBAR_COMMIT||cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files=runtime.gitFiles(commit);
 if(process.env.TRACKBAR_WORKING_RUNTIME)for(const n of files.keys())if(fs.existsSync(root+'/'+n))files.set(n,fs.readFileSync(root+'/'+n));
 files.set('src/09c3-wndprocs2-tooltip-trackbar.wat',expectOld
   ?cp.execFileSync('git',['show',commit+':src/09c3-wndprocs2-tooltip-trackbar.wat'],{cwd:root})
   :fs.readFileSync(root+'/src/09c3-wndprocs2-tooltip-trackbar.wat'));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{maxBuffer:8e6}));
 const wasm=process.env.TRACKBAR_WASM?fs.readFileSync(process.env.TRACKBAR_WASM):runtime.compile(files),pe=fixture(out);fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));files.set('build/wine-assembly.wasm',wasm);files.set('slider-menu.exe',pe);
 save('runtime.json',{commit,moduleSHA256:sha(wasm),peSHA256:sha(pe),keys,expected,files:[...files].map(([name,b])=>({name,size:b.length,sha256:sha(b)}))});
 const transient=require(root+'/tools/browser-transients.cjs').create(),logs=[],pending=[],workers=[],states=[],failures=[];let display,browser,wait,server;
 try{
 server=http.createServer((req,res)=>{const n=new URL(req.url,'http://local').pathname.slice(1)||'index.html',b=files.get(n);res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.html')?'text/html':n.endsWith('.css')?'text/css':n.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.statusCode=b?200:404;res.end(b||'missing');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 display=await require(root+'/tools/gltron-headful-display.cjs').start(out);
 browser=await require(root+'/node_modules/puppeteer').launch({headless:false,defaultViewport:{width:1050,height:800},env:transient.env(display.env),userDataDir:transient.profile,executablePath:'/opt/google/chrome/chrome',args:[...transient.args,'--no-sandbox','--disable-dev-shm-usage','--disable-component-update','--disable-background-networking'],protocolTimeout:45000});wait=transient.watch(browser.process());browser.process().stdout?.resume();browser.process().stderr?.resume();save('browser-version.json',{version:await browser.version()});
 const page=await browser.newPage();page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>logs.push(String(e)));
 page.on('workercreated',w=>{const row={url:w.url(),modules:[]};workers.push(row);const c=w.client;c.on('Debugger.scriptParsed',v=>{if(v.scriptLanguage==='WebAssembly'||v.url.startsWith('wasm://'))pending.push(c.send('Debugger.getScriptSource',{scriptId:v.scriptId}).then(r=>row.modules.push(sha(Buffer.from(r.bytecode,'base64')))));});pending.push(c.send('Debugger.enable'));});
 await page.evaluateOnNewDocument(()=>localStorage.setItem('wine-assembly.threads','1'));await page.goto('http://127.0.0.1:'+server.address().port+'/?debug&threads&no-log');await page.waitForFunction(()=>typeof WineAssembly==='function');
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=650;c.style='position:fixed;left:0;top:0;z-index:99999;width:1000px;height:650px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.sliderHost=new WineAssembly();sliderHost.renderer=new Win98Renderer(c);await sliderHost.init(c);if(!sliderHost.guestWorker)throw Error('production Worker required');await sliderHost.loadExe('/slider-menu.exe');sliderHost.run();});
 await page.waitForFunction(()=>Object.values(sliderHost.renderer.windows).some(w=>w.title==='Ready'),{timeout:15000});await page.evaluate(()=>{browserInput.wireCanvasInput(sliderHost.renderer.canvas,sliderHost.renderer,{runningApps:[{wine:sliderHost}],debugMode:true});sliderHost.renderer.canvas.focus();});
 await page.mouse.click(30+6+15+30,30+26+300+12);await page.waitForFunction(()=>Object.values(sliderHost.renderer.windows).some(w=>/^0 10 7 7 7 7 /.test(w.title)),{timeout:15000});
 let focus=0,count=0,last=[0,0,0,0];
 async function sample(stage,phase,key){await pause(90);const s=await page.evaluate(()=>{const h=sliderHost,r=h.renderer,w=Object.values(r.windows).find(w=>w.title==='Authored slider keyboard settings'),ctx=w._backCanvas.getContext('2d');return {report:Object.values(r.windows).find(w=>w.isChild&&w.x===15&&w.y===335)?.title,memoryBytes:h.memory.buffer.byteLength,rows:Object.values(r.windows).map(v=>({hwnd:v.hwnd,title:v.title,x:v.x,y:v.y,w:v.w,h:v.h,visible:v.visible,isChild:v.isChild})),pixels:Array.from(ctx.getImageData(0,0,w.w,w.h).data),width:w.w,height:w.h};});
 const got=s.report.trim().split(/\s+/).map(Number),want=[stage,10+focus,...expected[stage],1,1,1,1,count,...last,phase==='initial'?0:phase==='down'&&key==='Tab'?9+focus:10+focus,phase==='down'&&key==='Tab'?1:0,phase==='initial'?0:phase==='down'?256:257];s.stage=stage;s.phase=phase;s.key=key;s.expected=want;s.actual=got;s.publicPass=got.length===want.length&&want.every((v,i)=>got[i]===v);if(!s.publicPass)failures.push({stage,phase,key,got,want});
 const pix=Buffer.from(s.pixels),pairs=[];for(let j=0;j<4;++j){const vert=j>=2,x=(vert?(j===2?35:115):15)+6,y=(vert?155:40+j*50)+26,w=vert?32:210,h=vert?130:32;let equal=true;for(let row=0;row<h;++row){if(!pix.subarray(((y+row)*s.width+x)*4,((y+row)*s.width+x+w)*4).equals(pix.subarray(((y+row)*s.width+x+270)*4,((y+row)*s.width+x+270+w)*4)))equal=false;}pairs.push({j,equal});}s.pairs=pairs;
 // Selected evidence only. Reference controls are driven by constants computed
 // before the run and never from an observed trackbar position.
 if(phase==='up'&&(stage===1||stage===6)){fs.writeFileSync(out+'/pixels-'+stage+'.json.gz',zlib.gzipSync(Buffer.from(JSON.stringify({width:s.width,height:s.height,pixels:s.pixels}))));await page.screenshot({path:out+'/stage-'+stage+'-composited.png'});require(root+'/tools/browser-transients.cjs').captureWhole(out,'stage-'+stage+'-desktop',display.env);
 const {PNG}=require(root+'/node_modules/pngjs'),composite=PNG.sync.read(fs.readFileSync(out+'/stage-'+stage+'-composited.png')),desktop=PNG.sync.read(fs.readFileSync(out+'/stage-'+stage+'-desktop.png'));
 const frame=s.rows.find(w=>w.title==='Authored slider keyboard settings'),g=await page.evaluate(()=>sliderHost.renderer.canvas.getBoundingClientRect().toJSON());
 const surfaces=[];for(let j=0;j<4;++j)for(let side=0;side<2;++side){const vert=j>=2,x=(vert?(j===2?35:115):15)+6+side*270,y=(vert?155:40+j*50)+26,w=vert?32:210,h=vert?130:32,bytes=Buffer.alloc(w*h*4);for(let row=0;row<h;++row)pix.copy(bytes,row*w*4,((y+row)*s.width+x)*4,((y+row)*s.width+x+w)*4);surfaces.push({j,side,x,y,w,h,bytes});}
 const match=(png,v,ox,oy)=>{const x=Math.round(ox+v.x),y=Math.round(oy+v.y);if(x<0||y<0||x+v.w>png.width||y+v.h>png.height)return false;for(let row=0;row<v.h;++row)if(!png.data.subarray(((y+row)*png.width+x)*4,((y+row)*png.width+x+v.w)*4).equals(v.bytes.subarray(row*v.w*4,(row+1)*v.w*4)))return false;return true;};
 assert(surfaces.every(v=>match(composite,v,g.x+frame.x,g.y+frame.y)),'compositor contains exact observed slider surfaces');
 const first=surfaces[0],needle=first.bytes.subarray(16*first.w*4,17*first.w*4);let origin=null;
 for(let at=desktop.data.indexOf(needle);at>=0;at=desktop.data.indexOf(needle,at+1)){if(at%4)continue;const ox=at/4%desktop.width-first.x,oy=Math.floor(at/4/desktop.width)-first.y-16;if(surfaces.every(v=>match(desktop,v,ox,oy))){origin={x:ox,y:oy};break;}}
 assert(origin,'native desktop contains all eight slider surfaces at one origin');save('stage-'+stage+'-visible.json',{origin,exactCompositor:true,exactNativeDesktop:true,surfaces:surfaces.map(({bytes,...v})=>({...v,sha256:sha(bytes)}))});
 }
 delete s.pixels;states.push(s);save('states.json',states);return s;
 }
 await sample(0,'initial','');
 for(let i=0;i<keys.length;++i){const k=keys[i],m=moves[k];if(k==='Tab')focus++;if(m){count++;last=[focus>=2?0x115:0x114,m[1],10+focus,expected[i+1][focus]];}
 await page.keyboard.down(k);await page.waitForFunction(stage=>Object.values(sliderHost.renderer.windows).some(w=>w.title?.startsWith(stage+' ')),{timeout:5000},i+1);await sample(i+1,'down',k);
 if(m){count++;last=[focus>=2?0x115:0x114,8,10+focus,expected[i+1][focus]];}await page.keyboard.up(k);
 // Wait for guest dispatch acknowledgement, independent of position or
 // notification expectations, so a loaded host cannot masquerade as failure.
 await page.waitForFunction(stage=>Object.values(sliderHost.renderer.windows).some(w=>w.title?.startsWith(stage+' ')&&w.title.trim().endsWith(' 257')),{timeout:5000},i+1);await sample(i+1,'up',k);}
 const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);const cpuState=await cpu.evaluate(()=>{const names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];globalThis.__sliderSnapshot=new Uint8Array(memory.buffer).slice();return {memoryBytes:__sliderSnapshot.length,registers:Object.fromEntries(names.map(n=>[n,instance.exports[n]()>>>0]))};});
 const memoryHash=crypto.createHash('sha256');for(let offset=0;offset<cpuState.memoryBytes;offset+=4194304){const chunk=await cpu.evaluate(offset=>{const b=__sliderSnapshot.subarray(offset,offset+4194304);let s='';for(let i=0;i<b.length;i+=32768)s+=String.fromCharCode(...b.subarray(i,i+32768));return btoa(s);},offset);memoryHash.update(Buffer.from(chunk,'base64'));}cpuState.allMemorySHA256=memoryHash.digest('hex');await cpu.evaluate(()=>delete globalThis.__sliderSnapshot);save('cpu-state.json',cpuState);assert.equal(cpuState.memoryBytes,536870912);assert.equal(Object.keys(cpuState.registers).length,19);assert(cpuState.registers.get_eip&&cpuState.registers.get_esp);
 await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));
 save('assertions.json',{expectOld,failures,states:states.length,productionBrowserCPU:true,referencePairsMatch:states.every(s=>s.pairs.every(p=>p.equal))});
 if(expectOld){assert(failures.some(v=>v.stage===1&&v.got[2]!==v.want[2]),'first supported arrow oldFAIL required');console.log('PASS oldFAIL reproduced',failures.length);}else{assert.deepEqual(failures,[]);assert(states.every(s=>s.pairs.every(p=>p.equal)));console.log('PASS TRACKBAR browser keyboard public position/notifications and visible reference pairs',states.length);}
 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('transients.json',await transient.cleanup(out));if(display)await display.close();}
}
if(require.main===module)main(process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync(require('node:os').tmpdir()+'/trackbar-keyboard-'),{expectOld:process.argv.includes('--expect-old')}).catch(e=>{console.error(e.stack);process.exitCode=1;});module.exports={fixture,main,keys,expected};

