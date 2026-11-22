'use strict';
// Microsoft desktop contracts (read before implementation):
// https://learn.microsoft.com/en-us/windows/win32/controls/lb-setcaretindex
// https://learn.microsoft.com/en-us/windows/win32/controls/lb-getcaretindex
// Public guest queries, native browser input, and literal RGBA row references.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const tops=[0,5,1,1,2,6,7,7,7,7,7,3,3,6,7,0,5,5,6,2,2,2,2,2,2];
const carets=[0,9,1,6,6,11,11,7,7,7,7,3,8,9,9,0,7,7,8,2,2,2,2,2,2];
const heights=tops.map((_,i)=>i>=13?24:16);
const selected=i=>i===15?[]:i===11?[]:i>=18?[8]:[1,4,10];
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
unsigned short API RegisterClassA(const void*);long API DefWindowProcA(P,U,U,long);P API SetFocus(P);P API GetFocus(void);int API SetWindowTextA(P,const char*);
long API SendMessageA(P,U,U,long);int API GetMessageA(P,P,U,U);int API TranslateMessage(P);long API DispatchMessageA(P);int API GetScrollInfo(P,int,P);
struct WC{U style;P proc;int cex,wex;P instance,icon,cursor,brush;const char* menu;const char* name;};
struct SI{U cb,mask;int min,max;U page;int pos,track;};
static P frame,lb,multi,single,empty,bad[5],status,button,instance;static int stage,ready,notifications,guard,result=99,mret=99,sret=99;static char report[600];
static const char* items[12]={"Row 00","Row 01","Row 02","Row 03","Row 04","Row 05","Row 06","Row 07","Row 08","Row 09","Row 10","Row 11"};
void number(int n,int* at){char d[12];int k=0;if(n<0){report[(*at)++]='-';n=-n;}do{d[k++]='0'+n%10;n/=10;}while(n);while(k)report[(*at)++]=d[--k];report[(*at)++]=' ';}
void add(P h){for(int j=0;j<12;++j){SendMessageA(h,0x180,0,(long)items[j]);SendMessageA(h,0x19a,j,0x12340000+j);}}
void selectRows(P h){SendMessageA(h,0x185,0,-1);SendMessageA(h,0x185,1,1);SendMessageA(h,0x185,1,4);SendMessageA(h,0x185,1,10);}
int caret(P h,int n,int partial){P f=GetFocus();int nc=notifications;int r=SendMessageA(h,0x19e,n,partial);guard=guard&&f==GetFocus()&&nc==notifications;return r;}
int mask(P h){int bits=0;for(int j=0;j<12;++j)if(SendMessageA(h,0x187,j,0)>0)bits|=1<<j;return bits;}
void publish(void){int at=0,ok=1,buf[7]={123,-9,-9,-9,-9,-9,456},rc[6]={123,0,0,0,0,456};struct SI si={28,23,0,0,0,0,0};GetScrollInfo(lb,0,&si);for(int j=0;j<(stage==15?0:12);++j){char b[32];SendMessageA(lb,0x189,j,(long)b);int k=0;while(items[j][k]&&items[j][k]==b[k])++k;ok=ok&&items[j][k]==b[k]&&(U)SendMessageA(lb,0x199,j,0)==0x12340000+j;}
 int ns=SendMessageA(lb,0x191,5,(long)(buf+1)),rr=SendMessageA(lb,0x198,9,(long)(rc+1));
 number(stage,&at);number(SendMessageA(lb,0x19f,0,0),&at);number(SendMessageA(lb,0x188,0,0),&at);number(SendMessageA(lb,0x18e,0,0),&at);number(result,&at);number(SendMessageA(lb,0x18b,0,0),&at);number(mask(lb),&at);number(SendMessageA(lb,0x190,0,0),&at);number(ns,&at);for(int j=0;j<7;++j)number(buf[j],&at);number(rr,&at);for(int j=0;j<6;++j)number(rc[j],&at);number(SendMessageA(lb,0x1a1,0,0),&at);number(si.pos,&at);number(si.max,&at);number(si.page,&at);number(SendMessageA(lb,0x193,0,0),&at);number(guard,&at);number(ok,&at);number(notifications,&at);number(GetFocus()==(stage>=17?lb:button),&at);
 number(SendMessageA(multi,0x19f,0,0),&at);number(mask(multi),&at);number(mret,&at);number(SendMessageA(single,0x19f,0,0),&at);number(SendMessageA(single,0x188,0,0),&at);number(mask(single),&at);number(sret,&at);number(SendMessageA(empty,0x19f,0,0),&at);number(caret(empty,0,0),&at);
 for(int j=0;j<5;++j){number(caret(bad[j],1,0),&at);number(SendMessageA(bad[j],0x19f,0,0),&at);}report[at]=0;SetWindowTextA(status,report);}
void operate(void){guard=1;result=99;switch(stage){case 1:result=caret(lb,9,0);break;case 2:result=caret(lb,1,0);break;case 3:result=caret(lb,6,1);break;case 4:result=caret(lb,6,0);break;case 5:result=caret(lb,11,1);break;case 6:result=caret(lb,11,0);break;case 7:result=caret(lb,7,7);break;case 8:result=caret(lb,-1,0);break;case 9:result=caret(lb,12,1);break;case 10:result=caret(lb,65536,0);break;case 11:SendMessageA(lb,0x185,0,-1);result=caret(lb,3,0);break;case 12:selectRows(lb);result=caret(lb,8,1);break;case 13:SendMessageA(lb,0x1a0,0,24);result=caret(lb,9,1);break;case 14:result=caret(lb,9,0);break;case 15:SendMessageA(lb,0x184,0,0);result=caret(lb,0,0);break;case 16:add(lb);selectRows(lb);result=caret(lb,7,0);break;case 17:SetFocus(lb);break;case 19:result=caret(lb,2,0);break;case 21:mret=caret(multi,9,0);break;case 22:sret=caret(single,8,0);break;case 23:SendMessageA(single,0x186,4,0);sret=caret(single,2,0);break;case 24:SendMessageA(single,0x186,-1,0);sret=caret(single,11,0);break;}publish();}
long __stdcall proc(P h,U m,U w,long l){if(m==0x111&&(w&65535)==10&&(w>>16)==1){++notifications;return 0;}if(m==0x111&&(w&65535)==20&&!ready){SetFocus(button);ready=1;operate();return 0;}return DefWindowProcA(h,m,w,l);}
P list(U style,int x,int y,int id){return CreateWindowExA(0,"LISTBOX","",style,x,y,180,108,frame,(P)id,instance,0);}
void start(void){instance=GetModuleHandleA(0);struct WC wc={0,proc,0,0,0,0,0,(P)16,0,"ListCaret"};wc.instance=instance;RegisterClassA(&wc);frame=CreateWindowExA(0,"ListCaret","Authored list caret index",0x10cf0000,30,30,820,350,0,0,instance,0);
 lb=list(0x50310901,15,40,10);add(lb);selectRows(lb);SendMessageA(lb,0x194,320,0);SendMessageA(lb,0x114,4|(32<<16),0);
 multi=list(0x50310109,250,40,11);add(multi);selectRows(multi);SendMessageA(multi,0x194,320,0);
 single=list(0x40000100,15,400,12);add(single);empty=list(0x40000108,250,400,13);
 U styles[5]={0x10,0x20,0x200,0x2000,0x4000};for(int j=0;j<5;++j){bad[j]=list(0x40000800|styles[j],480,400,30+j);add(bad[j]);}
 button=CreateWindowExA(0,"BUTTON","Ready",0x50010000,15,245,100,26,frame,(P)20,instance,0);status=CreateWindowExA(0,"STATIC","starting",0x50000000,15,285,780,50,frame,(P)21,instance,0);
 U msg[12];while(GetMessageA(msg,0,0,0)>0){if(ready&&msg[1]==0x100&&msg[2]==0x75&&stage<24){++stage;operate();}else if(ready&&((stage==17&&msg[1]==0x100&&msg[2]==0x28))){TranslateMessage(msg);DispatchMessageA(msg);++stage;result=99;publish();continue;}TranslateMessage(msg);DispatchMessageA(msg);}}
`;
function fixture(out){
 fs.writeFileSync(out+'/fixture.c',source);
 for(const [dll,names]of Object.entries({kernel32:['GetModuleHandleA@4'],user32:['CreateWindowExA@48','RegisterClassA@4','DefWindowProcA@16','SetFocus@4','GetFocus@0','SetWindowTextA@8','GetScrollInfo@12','SendMessageA@16','GetMessageA@16','TranslateMessage@4','DispatchMessageA@4']})){
 fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/fixture.c','-o',out+'/fixture.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/list-caret.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib']);return fs.readFileSync(out+'/list-caret.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n'),pause=ms=>new Promise(r=>setTimeout(r,ms));
 const runtime=require(root+'/tools/boids-current-runtime.cjs'),commit=process.env.LIST_CARET_COMMIT||cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files=runtime.gitFiles(commit);
 if(process.env.LIST_CARET_WORKING_RUNTIME)for(const n of files.keys())if(fs.existsSync(root+'/'+n))files.set(n,fs.readFileSync(root+'/'+n));
 files.set('src/09c3-wndprocs3-listbox.wat',fs.readFileSync(root+'/src/09c3-wndprocs3-listbox.wat'));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{maxBuffer:8e6}));
 const sourcePaths=process.env.LIST_CARET_WORKING_RUNTIME?['src','lib','host.js','tools','index.html']:['src/09c3-wndprocs3-listbox.wat'];
 const patch=cp.execFileSync('git',['diff','--binary',commit,'--',...sourcePaths],{cwd:root});fs.writeFileSync(out+'/runtime.diff',patch);
 const wasm=process.env.LIST_CARET_WASM?fs.readFileSync(process.env.LIST_CARET_WASM):runtime.compile(files),pe=fixture(out);fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));files.set('build/wine-assembly.wasm',wasm);files.set('list-caret.exe',pe);
 save('runtime.json',{commit,moduleSHA256:sha(wasm),peSHA256:sha(pe),testSHA256:sha(fs.readFileSync(__filename)),files:[...files].map(([name,b])=>({name,size:b.length,sha256:sha(b)}))});
 assert(patch.equals(cp.execFileSync('git',['diff','--binary',commit,'--',...sourcePaths],{cwd:root})),'source changed during compile; reject before runtime');
 const controlBase=Number(/CONTROL_TABLE: \{[^}]*base: (0x[0-9a-fA-F_]+)/.exec(files.get('lib/region-map.generated.js').toString())[1].replaceAll('_',''));
 const transient=require(root+'/tools/browser-transients.cjs').create(),logs=[],pending=[],workers=[],states=[],failures=[];let display,browser,wait,server;
 try{
 server=http.createServer((req,res)=>{const n=new URL(req.url,'http://local').pathname.slice(1)||'index.html',b=files.get(n);res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.html')?'text/html':n.endsWith('.css')?'text/css':n.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.statusCode=b?200:404;res.end(b||'missing');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 display=await require(root+'/tools/gltron-headful-display.cjs').start(out);
 browser=await require(root+'/node_modules/puppeteer').launch({headless:false,defaultViewport:{width:1050,height:800},env:transient.env(display.env),userDataDir:transient.profile,executablePath:'/opt/google/chrome/chrome',args:[...transient.args,'--no-sandbox','--disable-dev-shm-usage','--disable-component-update','--disable-background-networking'],protocolTimeout:45000});wait=transient.watch(browser.process());browser.process().stdout?.resume();browser.process().stderr?.resume();save('browser-version.json',{version:await browser.version()});
 const page=await browser.newPage();page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>logs.push(String(e)));
 page.on('workercreated',w=>{const row={url:w.url(),modules:[]};workers.push(row);const c=w.client;c.on('Debugger.scriptParsed',v=>{if(v.scriptLanguage==='WebAssembly'||v.url.startsWith('wasm://'))pending.push(c.send('Debugger.getScriptSource',{scriptId:v.scriptId}).then(r=>row.modules.push(sha(Buffer.from(r.bytecode,'base64')))));});pending.push(c.send('Debugger.enable'));});
 await page.evaluateOnNewDocument(()=>localStorage.setItem('wine-assembly.threads','1'));await page.goto('http://127.0.0.1:'+server.address().port+'/?debug&threads&no-log');await page.waitForFunction(()=>typeof WineAssembly==='function');
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=650;c.style='position:fixed;left:0;top:0;z-index:99999;width:1000px;height:650px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.topHost=new WineAssembly();topHost.renderer=new Win98Renderer(c);await topHost.init(c);if(!topHost.guestWorker)throw Error('production Worker required');await topHost.loadExe('/list-caret.exe');topHost.run();});
 await page.waitForFunction(()=>Object.values(topHost.renderer.windows).some(w=>w.title==='Ready'),{timeout:15000});await page.evaluate(()=>{browserInput.wireCanvasInput(topHost.renderer.canvas,topHost.renderer,{runningApps:[{wine:topHost}],debugMode:true});topHost.renderer.canvas.focus();});
 await page.mouse.click(30+6+15+30,30+26+245+12);await page.waitForFunction(()=>Object.values(topHost.renderer.windows).some(w=>/^0 /.test(w.title)),{timeout:15000});
 async function sample(stage){await pause(130);const s=await page.evaluate(base=>{const h=topHost,r=h.renderer,frame=Object.values(r.windows).find(w=>w.title==='Authored list caret index'),v=new DataView(h.memory.buffer);let kind=null;for(let i=0;i<256;i++)if(v.getUint32(base+i*16+4,true)===10)kind=v.getUint32(base+i*16,true);
 const p=frame._backCanvas._waCanonicalPresentation;return {kind,frame:{hwnd:frame.hwnd,x:frame.x,y:frame.y,w:frame.w,h:frame.h,pixels:Array.from(frame._backCanvas.getContext('2d').getImageData(0,0,frame.w,frame.h).data),gdi:p?{shared:p.surface.storage.buffer===h.memory.buffer,pixels:Array.from(p.surface.rgbaRect(0,0,frame.w,frame.h))}:null},report:Object.values(r.windows).find(w=>w.isChild&&w.x===15&&w.y===285)?.title,memoryBytes:h.memory.buffer.byteLength};},controlBase);
 assert.equal(s.kind,4,'public LISTBOX routes to native class4');assert.equal(s.memoryBytes,536870912);
 const got=s.report.trim().split(/\s+/).map(Number),rh=heights[stage],top=tops[stage],sel=selected(stage),empty=stage===15;
 const setter=[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,19].includes(stage),ret=[8,9,10,15].includes(stage)?-1:setter?0:99,cur=empty?-1:stage===0?-1:carets[stage];
 const singleCaret=stage===22?8:stage===23?4:stage===24?11:0,singleSel=stage===23?4:-1,singleMask=stage===23?16:0;
 const want=[stage,carets[stage],cur,top,ret,empty?0:12,sel.reduce((n,j)=>n|(1<<j),0),sel.length,sel.length,123,...Array.from({length:5},(_,j)=>sel[j]??-9),456,empty?-1:0,123,0,empty?0:(9-top)*rh,empty?0:180,empty?0:(10-top)*rh,456,rh,stage>=15?0:32,319,stage===15?176:160,320,1,1,stage<18?0:1,1,stage>=21?9:0,(1<<1)|(1<<4)|(1<<10),stage>=21?0:99,singleCaret,singleSel,singleMask,stage<22?99:stage===23?-1:0,0,-1,...Array(5).fill([-1,-1]).flat()];
 s.publicPass=got.length===want.length&&want.every((v,i)=>got[i]===v);if(!s.publicPass)failures.push({stage,got,want});
 s.stage=stage;s.got=got;s.want=want;const surfaces=[];const p=s.frame;assert(p.gdi?.shared);assert(Buffer.from(p.gdi.pixels).equals(Buffer.from(p.pixels)),'shared GDI matches backing canvas');p.shared=true;delete p.gdi;
 const crop=(p,x,y,w,h)=>{const b=Buffer.alloc(w*h*4),pix=Buffer.from(p.pixels);for(let row=0;row<h;++row)pix.copy(b,row*w*4,((y+row)*p.w+x)*4,((y+row)*p.w+x+w)*4);return {x:p.x+x,y:p.y+y,w,h,bytes:b};};
 // Literal geometry and system colors: never derive expectations from LB state
 // or an image of the candidate. The last 8 pixels exercise a partial row.
 const actual=crop(p,130,66,16,88),other=crop(p,370,66,16,88);surfaces.push(actual,other);
 function reference(top,height,selections){const b=Buffer.alloc(16*88*4);for(let y=0;y<88;++y)for(let x=0;x<16;++x)b.set(selections.includes(top+Math.floor(y/height))?[0,0,128,255]:[255,255,255,255],(y*16+x)*4);return b;}
 const expected=reference(top,rh,sel),otherExpected=reference(stage>=21?5:0,16,[1,4,10]);s.visiblePair=actual.bytes.equals(expected);s.otherPair=other.bytes.equals(otherExpected);s.expectedGeometry={rh,top,sel,rgbaSHA256:sha(expected),otherSHA256:sha(otherExpected)};
 const compositeBytes=await page.screenshot();require(root+'/tools/browser-transients.cjs').captureWhole(out,'stage-'+stage+'-desktop',display.env);const desktopPath=out+'/stage-'+stage+'-desktop.png';const {PNG}=require(root+'/node_modules/pngjs'),composite=PNG.sync.read(compositeBytes),desktop=PNG.sync.read(fs.readFileSync(desktopPath)),g=await page.evaluate(()=>topHost.renderer.canvas.getBoundingClientRect().toJSON());
 const match=(png,v,ox,oy)=>{const x=Math.round(ox+v.x),y=Math.round(oy+v.y);if(x<0||y<0||x+v.w>png.width||y+v.h>png.height)return false;for(let row=0;row<v.h;++row)if(!png.data.subarray(((y+row)*png.width+x)*4,((y+row)*png.width+x+v.w)*4).equals(v.bytes.subarray(row*v.w*4,(row+1)*v.w*4)))return false;return true;};
 assert(surfaces.every(v=>match(composite,v,g.x,g.y)),'compositor exact rows');const first=surfaces[0],needle=first.bytes.subarray(5*16*4,6*16*4);let origin=null;for(let at=desktop.data.indexOf(needle);at>=0;at=desktop.data.indexOf(needle,at+1)){if(at%4)continue;const ox=at/4%desktop.width-first.x,oy=Math.floor(at/4/desktop.width)-first.y-5;if(surfaces.every(v=>match(desktop,v,ox,oy))){origin={x:ox,y:oy};break;}}assert(origin,'native desktop exact rows at one origin');s.fourPlanes={sharedGDI:true,backing:true,compositor:true,nativeDesktop:true,origin};
 if([1,5,6,18,20,24].includes(stage)){fs.writeFileSync(out+'/stage-'+stage+'-composited.png',compositeBytes);}else fs.unlinkSync(desktopPath);
 s.surfaces=surfaces.map(({bytes,...v})=>({...v,sha256:sha(bytes)}));for(const name of ['frame'])if(s[name])delete s[name].pixels;states.push(s);save('states.json',states);
 }
 await sample(0);
 const earlyCPU=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(earlyCPU);const earlyCPUState=await earlyCPU.evaluate(()=>{const names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,registers:Object.fromEntries(names.map(n=>[n,instance.exports[n]()>>>0]))};});save('initial-cpu-state.json',earlyCPUState);assert.equal(earlyCPUState.memoryBytes,536870912);assert.equal(Object.keys(earlyCPUState.registers).length,19);assert(earlyCPUState.registers.get_eip&&earlyCPUState.registers.get_esp);
 await Promise.all(pending);save('initial-workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));
 for(let stage=1;stage<tops.length;++stage){if(stage===18)await page.keyboard.press('ArrowDown');else await page.keyboard.press('F6');await page.waitForFunction(stage=>Object.values(topHost.renderer.windows).some(w=>w.title?.startsWith(stage+' ')),{timeout:5000},stage);await sample(stage);}
 const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);const cpuState=await cpu.evaluate(()=>{const names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,registers:Object.fromEntries(names.map(n=>[n,instance.exports[n]()>>>0]))};});save('cpu-state.json',cpuState);assert.equal(cpuState.memoryBytes,536870912);assert.equal(Object.keys(cpuState.registers).length,19);assert(cpuState.registers.get_eip&&cpuState.registers.get_esp);
 await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));save('assertions.json',{expectOld,failures,states:states.length,productionBrowserCPU:true,visiblePairs:states.filter(s=>s.visiblePair!==null).map(s=>({stage:s.stage,equal:s.visiblePair})),fourPlanes:states.every(s=>s.fourPlanes.nativeDesktop)});
 assert(states[0].visiblePair&&states[0].otherPair,'unchanged initial literal geometry');
 if(expectOld){assert(failures.some(v=>v.stage===1&&v.got[1]!==v.want[1]),'physical preedit caret failure');assert(states.some(s=>s.stage===1&&!s.visiblePair),'physical preedit reveal geometry failure');console.log('PASS expected physical old FAIL',failures.length);}else{assert(states.every(s=>s.visiblePair&&s.otherPair),'independent literal selected-row geometry including partial row');assert.deepEqual(failures,[]);console.log('PASS listbox caret public state and four planes',states.length);}
 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('transients.json',await transient.cleanup(out));if(display)await display.close();}
}
if(require.main===module)main(process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync('/dev/shm/listbox-caret-index-'),{expectOld:process.argv.includes('--expect-old')}).catch(e=>{console.error(e.stack);process.exitCode=1;});module.exports={fixture,main,heights,tops,carets};
