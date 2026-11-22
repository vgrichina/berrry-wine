'use strict';
// Microsoft Windows Interface Guidelines (February 1995), ch7 pp142-143:
// multiple selection is independent, unlike extended selection ranges.
// Microsoft Visual C++ v4 (September 1995), CListBox pp780-781 and
// List-Box Styles: click toggles; LBN_SELCHANGE requires LBS_NOTIFY.
// https://bitsavers.trailing-edge.com/pdf/microsoft/visual_c%2B%2B/Visual_C%2B%2B_4.0_Sep95/Visual_C%2B%2B_Version_4_Volume_4_1995.pdf (p2273)
// https://bitsavers.trailing-edge.com/pdf/microsoft/visual_c%2B%2B/Visual_C%2B%2B_4.0_Sep95/Visual_C%2B%2B_Version_4_Volume_3_1995.pdf (p781)
// Native XTEST -> production CPU -> public USER queries and fixed RGBA rows.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const scenarios=[
 {
  "row": null,
  "selected": [
   1,
   4,
   10
  ],
  "caret": 0,
  "notify": 0,
  "target": 0,
  "top": 0,
  "mods": [],
  "key": null
 },
 {
  "row": 1,
  "selected": [
   4,
   10
  ],
  "caret": 1,
  "notify": 1,
  "target": 0,
  "top": 0,
  "mods": [],
  "key": null
 },
 {
  "row": 2,
  "selected": [
   2,
   4,
   10
  ],
  "caret": 2,
  "notify": 2,
  "target": 0,
  "top": 0,
  "mods": [],
  "key": null
 },
 {
  "row": 2,
  "selected": [
   4,
   10
  ],
  "caret": 2,
  "notify": 3,
  "target": 0,
  "top": 0,
  "mods": [],
  "key": null
 },
 {
  "row": 0,
  "selected": [
   0,
   4,
   10
  ],
  "caret": 0,
  "notify": 4,
  "target": 0,
  "top": 0,
  "mods": [
   "Control_L"
  ],
  "key": null
 },
 {
  "row": 3,
  "selected": [
   0,
   3,
   4,
   10
  ],
  "caret": 3,
  "notify": 5,
  "target": 0,
  "top": 0,
  "mods": [
   "Shift_L"
  ],
  "key": null
 },
 {
  "row": 1,
  "selected": [
   0,
   1,
   3,
   4,
   10
  ],
  "caret": 1,
  "notify": 6,
  "target": 0,
  "top": 0,
  "mods": [
   "Control_L",
   "Shift_L"
  ],
  "key": null
 },
 {
  "row": 1,
  "selected": [
   0,
   3,
   4,
   10
  ],
  "caret": 1,
  "notify": 7,
  "target": 0,
  "top": 0,
  "mods": [
   "Control_L",
   "Shift_L"
  ],
  "key": null
 },
 {
  "row": null,
  "selected": [
   0,
   3,
   4,
   10
  ],
  "caret": 1,
  "notify": 7,
  "target": 0,
  "top": 8,
  "mods": [],
  "key": "F6"
 },
 {
  "row": 2,
  "selected": [
   0,
   3,
   4
  ],
  "caret": 10,
  "notify": 8,
  "target": 0,
  "top": 8,
  "mods": [],
  "key": null
 },
 {
  "row": 3,
  "selected": [
   0,
   3,
   4,
   11
  ],
  "caret": 11,
  "notify": 9,
  "target": 0,
  "top": 8,
  "mods": [],
  "key": null
 },
 {
  "row": null,
  "selected": [
   1,
   4,
   10
  ],
  "caret": 0,
  "notify": 9,
  "target": 1,
  "top": 0,
  "mods": [],
  "key": "F6"
 },
 {
  "row": 1,
  "selected": [
   4,
   10
  ],
  "caret": 1,
  "notify": 9,
  "target": 1,
  "top": 0,
  "mods": [],
  "key": null
 },
 {
  "row": 2,
  "selected": [
   2,
   4,
   10
  ],
  "caret": 2,
  "notify": 9,
  "target": 1,
  "top": 0,
  "mods": [
   "Shift_L"
  ],
  "key": null
 },
 {
  "row": 0,
  "selected": [
   0,
   2,
   4,
   10
  ],
  "caret": 0,
  "notify": 9,
  "target": 1,
  "top": 0,
  "mods": [
   "Control_L"
  ],
  "key": null
 },
 {
  "row": 2,
  "selected": [
   0,
   4,
   10
  ],
  "caret": 2,
  "notify": 9,
  "target": 1,
  "top": 0,
  "mods": [
   "Control_L",
   "Shift_L"
  ],
  "key": null
 },
 {
  "row": null,
  "selected": [],
  "caret": 0,
  "notify": 9,
  "target": 2,
  "top": 0,
  "mods": [],
  "key": "F6"
 },
 {
  "row": 1,
  "selected": [],
  "caret": 0,
  "notify": 9,
  "target": 2,
  "top": 0,
  "mods": [],
  "key": null
 },
 {
  "row": null,
  "selected": [
   0,
   3,
   4,
   11
  ],
  "caret": 11,
  "notify": 9,
  "target": 0,
  "top": 0,
  "mods": [],
  "key": "F6"
 },
 {
  "row": 3,
  "selected": [
   0,
   4,
   11
  ],
  "caret": 3,
  "notify": 10,
  "target": 0,
  "top": 0,
  "mods": [],
  "key": null
 },
 {
  "row": 0,
  "selected": [
   4,
   11
  ],
  "caret": 0,
  "notify": 11,
  "target": 0,
  "top": 0,
  "mods": [],
  "key": null
 },
 {
  "row": 2,
  "selected": [
   2,
   4,
   11
  ],
  "caret": 2,
  "notify": 12,
  "target": 0,
  "top": 0,
  "mods": [],
  "key": null
 },
 {
  "row": null,
  "selected": [
   2,
   4,
   11
  ],
  "caret": 2,
  "notify": 12,
  "target": 0,
  "top": 0,
  "mods": [],
  "key": "F6"
 }
];
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
unsigned short API RegisterClassA(const void*);long API DefWindowProcA(P,U,U,long);P API SetFocus(P);P API GetFocus(void);int API SetWindowTextA(P,const char*);
long API SendMessageA(P,U,U,long);int API GetMessageA(P,P,U,U);int API TranslateMessage(P);long API DispatchMessageA(P);
struct WC{U style;P proc;int cex,wex;P instance,icon,cursor,brush;const char* menu;const char* name;};
static P frame,lb,silent,empty,status,button,instance,bad[9];static int stage,ready,notifications,target,guard=1,other,lastkey,lastWP,lastLP,notifyHandle=1,notice[13]={0};static char report[700];
static const char* items[12]={"Row 00","Row 01","Row 02","Row 03","Row 04","Row 05","Row 06","Row 07","Row 08","Row 09","Row 10","Row 11"};
void number(int n,int* at){char d[12];int k=0;if(n<0){report[(*at)++]='-';n=-n;}do{d[k++]='0'+n%10;n/=10;}while(n);while(k)report[(*at)++]=d[--k];report[(*at)++]=' ';}
void add(P h){for(int j=0;j<12;++j){SendMessageA(h,0x180,0,(long)items[j]);SendMessageA(h,0x19a,j,0x12340000+j);}}
void selectRows(P h){SendMessageA(h,0x185,1,1);SendMessageA(h,0x185,1,4);SendMessageA(h,0x185,1,10);SendMessageA(h,0x19e,0,0);}
P active(void){return target==1?silent:target==2?empty:lb;}
int mask(P h){int bits=0;for(int j=0;j<12;++j)if(SendMessageA(h,0x187,j,0)>0)bits|=1<<j;return bits;}
void publish(void){int at=0,rc[6]={123,0,0,0,0,456},buf[7]={123,-9,-9,-9,-9,-9,456},ok=1;P h=active();int n=SendMessageA(h,0x18b,0,0),caret=SendMessageA(h,0x19f,0,0);
for(int j=0;j<n;++j){char b[32];int len=SendMessageA(h,0x189,j,(long)b),k=0;while(items[j][k]&&items[j][k]==b[k])++k;ok=ok&&items[j][k]==b[k]&&len==k&&(U)SendMessageA(h,0x199,j,0)==0x12340000+j;}
number(stage,&at);number(lastkey,&at);number(target,&at);number(n,&at);number(caret,&at);number(SendMessageA(h,0x18e,0,0),&at);number(mask(h),&at);number(SendMessageA(h,0x190,0,0),&at);number(SendMessageA(h,0x191,5,(long)(buf+1)),&at);for(int j=0;j<7;++j)number(buf[j],&at);number(SendMessageA(h,0x198,caret,(long)(rc+1)),&at);for(int j=0;j<6;++j)number(rc[j],&at);number(notifications,&at);number(other,&at);number(guard,&at);number(ok,&at);number(GetFocus()==h,&at);number(notifyHandle,&at);number(lastWP,&at);number(lastLP,&at);for(int j=0;j<13;++j)number(notice[j],&at);report[at]=0;SetWindowTextA(status,report);}
void operate(void){
 if(stage==8)SendMessageA(lb,0x197,8,0);
 if(stage==11){target=1;SetFocus(silent);}
 if(stage==16){target=2;SetFocus(empty);}
 if(stage==18){target=0;SendMessageA(lb,0x197,0,0);SetFocus(lb);}
 if(stage==22){
  for(int j=0;j<8;++j){
   SendMessageA(bad[j],0x186,0,0);
   SendMessageA(bad[j],0x201,1,70|(24<<16));
   guard=guard&&mask(bad[j])==2&&SendMessageA(bad[j],0x188,0,0)==1;
  }
  /* Existing extended semantics, not a new Windows oracle. */
  SendMessageA(bad[1],0x201,9,70|(40<<16));
  guard=guard&&mask(bad[1])==6;
  SendMessageA(bad[1],0x201,5,70|(56<<16));
  guard=guard&&mask(bad[1])==12;
  /* Existing simple double-click remains replacement. */
  SendMessageA(bad[8],0x203,1,70|(40<<16));
  guard=guard&&mask(bad[8])==4;
 }
 publish();
}
long __stdcall proc(P h,U m,U w,long l){
 if(m==0x111&&(w>>16)==1){
  if((w&65535)==10){
   ++notifications;notifyHandle=notifyHandle&&(P)l==lb;
   notice[0]=stage;notice[1]=SendMessageA(lb,0x19f,0,0);notice[2]=mask(lb);
   notice[3]=SendMessageA(lb,0x18e,0,0);notice[4]=SendMessageA(lb,0x190,0,0);
   int buf[7]={123,-9,-9,-9,-9,-9,456};
   notice[5]=SendMessageA(lb,0x191,5,(long)(buf+1));
   for(int j=0;j<7;++j)notice[6+j]=buf[j];
  }else if((w&65535)==11||(w&65535)==12)++other;
  return 0;
 }
 if(m==0x111&&(w&65535)==20&&!ready){SetFocus(lb);ready=1;publish();return 0;}
 return DefWindowProcA(h,m,w,l);
}
void start(void){instance=GetModuleHandleA(0);struct WC wc={0,proc,0,0,0,0,0,(P)16,0,"ListMultiple"};wc.instance=instance;RegisterClassA(&wc);frame=CreateWindowExA(0,"ListMultiple","Authored list multiple click",0x10cf0000,30,30,820,350,0,0,instance,0);
lb=CreateWindowExA(0,"LISTBOX","",0x50010109,15,40,180,68,frame,(P)10,instance,0);add(lb);selectRows(lb);
silent=CreateWindowExA(0,"LISTBOX","",0x50010108,250,40,180,68,frame,(P)11,instance,0);add(silent);selectRows(silent);
empty=CreateWindowExA(0,"LISTBOX","",0x50010109,485,40,180,68,frame,(P)12,instance,0);
U styles[9]={0,0x800,0x18,0x28,0x208,0x2008,0x4008,0x408,0x8};for(int j=0;j<9;++j){bad[j]=CreateWindowExA(0,"LISTBOX","",0x40000100|styles[j],15,400,180,68,frame,(P)(30+j),instance,0);add(bad[j]);SendMessageA(bad[j],0x186,0,0);}
button=CreateWindowExA(0,"BUTTON","Ready",0x50010000,15,245,100,26,frame,(P)20,instance,0);status=CreateWindowExA(0,"STATIC","starting",0x50000000,15,285,780,50,frame,(P)21,instance,0);
U msg[12];while(GetMessageA(msg,0,0,0)>0){
 if(ready&&msg[1]==0x100&&msg[2]==0x75){lastkey=0x100;lastWP=0x75;lastLP=0;++stage;operate();}
 else if(ready&&msg[1]==0x201&&(P)msg[0]==active()){
  lastkey=msg[1];lastWP=msg[2];lastLP=msg[3];++stage;
  TranslateMessage(msg);DispatchMessageA(msg);publish();continue;
 }
 TranslateMessage(msg);DispatchMessageA(msg);
}}

`;

function fixture(out){
 fs.writeFileSync(out+'/fixture.c',source);
 for(const [dll,names]of Object.entries({kernel32:['GetModuleHandleA@4'],user32:['CreateWindowExA@48','RegisterClassA@4','DefWindowProcA@16','SetFocus@4','GetFocus@0','SetWindowTextA@8','SendMessageA@16','GetMessageA@16','TranslateMessage@4','DispatchMessageA@4']})){
 fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/fixture.c','-o',out+'/fixture.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/list-multiple-click.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib']);return fs.readFileSync(out+'/list-multiple-click.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n'),pause=ms=>new Promise(r=>setTimeout(r,ms));
 const runtime=require(root+'/tools/boids-current-runtime.cjs'),commit=process.env.LIST_CLICK_COMMIT||cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files=runtime.gitFiles(commit);
 if(process.env.LIST_CLICK_WORKING_RUNTIME)for(const n of files.keys())if(fs.existsSync(root+'/'+n))files.set(n,fs.readFileSync(root+'/'+n));
 files.set('src/09c3-wndprocs3-listbox.wat',fs.readFileSync(root+'/src/09c3-wndprocs3-listbox.wat'));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{maxBuffer:8e6}));
 const sourcePaths=process.env.LIST_CLICK_WORKING_RUNTIME?['src','lib','host.js','tools','index.html']:['src/09c3-wndprocs3-listbox.wat'];
 const patch=cp.execFileSync('git',['diff','--binary',commit,'--',...sourcePaths],{cwd:root});fs.writeFileSync(out+'/runtime.diff',patch);
 const wasm=process.env.LIST_CLICK_WASM?fs.readFileSync(process.env.LIST_CLICK_WASM):runtime.compile(files),pe=fixture(out);fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));files.set('build/wine-assembly.wasm',wasm);files.set('list-multiple-click.exe',pe);
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
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=650;c.style='position:fixed;left:0;top:0;z-index:99999;width:1000px;height:650px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.topHost=new WineAssembly();topHost.renderer=new Win98Renderer(c);await topHost.init(c);if(!topHost.guestWorker)throw Error('production Worker required');await topHost.loadExe('/list-multiple-click.exe');topHost.run();});
 await page.waitForFunction(()=>Object.values(topHost.renderer.windows).some(w=>w.title==='Ready'),{timeout:15000});await page.evaluate(()=>{browserInput.wireCanvasInput(topHost.renderer.canvas,topHost.renderer,{runningApps:[{wine:topHost}],debugMode:true});topHost.renderer.canvas.focus();});
 await page.mouse.click(30+6+15+30,30+26+245+12);await page.waitForFunction(()=>Object.values(topHost.renderer.windows).some(w=>/^0 /.test(w.title)),{timeout:15000});
 async function sample(stage){await pause(150);const s=await page.evaluate(({base,target})=>{
 const h=topHost,r=h.renderer,frame=Object.values(r.windows).find(w=>w.title==='Authored list multiple click'),v=new DataView(h.memory.buffer);let kind=null;
 for(let i=0;i<256;i++)if(v.getUint32(base+i*16+4,true)===10)kind=v.getUint32(base+i*16,true);
 const p=frame._backCanvas._waCanonicalPresentation,ctx=frame._backCanvas.getContext('2d');
 const surfaces=[[21+235*target+110,66,16,64],[21,66,140,64],[256,66,140,64]].map(([x,y,w,hh])=>{
 const b=ctx.getImageData(x,y,w,hh).data,g=p?.surface.rgbaRect(x,y,w,hh);
 return {x:frame.x+x,y:frame.y+y,w,h:hh,bytes:Array.from(b),sameGDI:!!g&&g.length===b.length&&g.every((n,i)=>n===b[i])};});
 return {kind,surfaces,shared:p?.surface.storage.buffer===h.memory.buffer,frame:{hwnd:frame.hwnd,x:frame.x,y:frame.y,w:frame.w,h:frame.h},report:Object.values(r.windows).find(w=>w.isChild&&w.x===15&&w.y===285)?.title,memoryBytes:h.memory.buffer.byteLength};
 },{base:controlBase,target:scenarios[stage].target});

 assert.equal(s.kind,4,'public LISTBOX routes to native class4');assert.equal(s.memoryBytes,536870912);
 const got=s.report.trim().split(/\s+/).map(Number),spec=scenarios[stage];
 const sel=spec.selected,empty=spec.target===2,mask=sel.reduce((n,j)=>n|1<<j,0),isClick=spec.row!==null,wp=isClick?1+(spec.mods.includes('Control_L')?8:0)+(spec.mods.includes('Shift_L')?4:0):stage?117:0;
 const notified=scenarios.slice(0,stage+1).map((v,i)=>({...v,stage:i})).filter(v=>v.row!==null&&v.target===0).at(-1);
 const nsel=notified?.selected||[],notice=notified?[notified.stage,notified.caret,nsel.reduce((n,j)=>n|1<<j,0),notified.top,nsel.length,nsel.length,123,...Array.from({length:5},(_,j)=>nsel[j]??-9),456]:Array(13).fill(0);
 const want=[stage,isClick?513:stage?256:0,spec.target,empty?0:12,spec.caret,spec.top,mask,sel.length,sel.length,123,...Array.from({length:5},(_,j)=>sel[j]??-9),456,empty?-1:0,123,0,empty?0:(spec.caret-spec.top)*16,empty?0:180,empty?0:(spec.caret-spec.top+1)*16,456,spec.notify,0,1,1,1,1,wp,isClick?70+((spec.row*16+8)<<16):0,...notice];

 s.publicPass=got.length===want.length&&want.every((v,i)=>got[i]===v);if(!s.publicPass)failures.push({stage,got,want});
 s.stage=stage;s.got=got;s.want=want;
 assert(s.shared&&s.surfaces.every(v=>v.sameGDI),"shared GDI matches backing canvas");
 const surfaces=s.surfaces.map(v=>({...v,bytes:Buffer.from(v.bytes)})),actual=surfaces[0];
 const expected=Buffer.alloc(16*64*4);for(let y=0;y<64;++y)for(let x=0;x<16;++x)expected.set(spec.selected.includes(spec.top+Math.floor(y/16))?[0,0,128,255]:[255,255,255,255],(y*16+x)*4);
 s.visiblePair=actual.bytes.equals(expected);s.expectedGeometry={...spec,rgbaSHA256:sha(expected)};
 const compositeBytes=await page.screenshot(),captureAt=Date.now();
 // The subprocess has its own finite deadline. PNG encoding happens after
 // actual wait/EOF and must not be mistaken for subprocess elapsed time.
 const raw=cp.execFileSync('xwd',['-root','-silent'],{env:display.env,timeout:3000,maxBuffer:16*1024*1024}),capturedAt=Date.now();
 const encoded=require(root+'/tools/browser-transients.cjs').encodeXwd(raw),desktopPath=out+'/stage-'+stage+'-desktop.png';fs.writeFileSync(desktopPath,encoded.png);
 save('stage-'+stage+'-desktop.json',{captureAt,capturedAt,encodedAt:Date.now(),subprocessTimeout:3000,actualWait:true,stdoutEOF:true,stderrEOF:true,rawSHA256:sha(raw),sha256:sha(encoded.png),width:encoded.width,height:encoded.height});
 const {PNG}=require(root+'/node_modules/pngjs'),composite=PNG.sync.read(compositeBytes),desktop=PNG.sync.read(encoded.png),g=await page.evaluate(()=>topHost.renderer.canvas.getBoundingClientRect().toJSON());
 const match=(png,v,ox,oy)=>{const x=Math.round(ox+v.x),y=Math.round(oy+v.y);if(x<0||y<0||x+v.w>png.width||y+v.h>png.height)return false;for(let row=0;row<v.h;++row)if(!png.data.subarray(((y+row)*png.width+x)*4,((y+row)*png.width+x+v.w)*4).equals(v.bytes.subarray(row*v.w*4,(row+1)*v.w*4)))return false;return true;};
 assert(surfaces.every(v=>match(composite,v,g.x,g.y)),'compositor exact rows');const first=surfaces[1],needle=first.bytes.subarray(5*first.w*4,6*first.w*4);let origin=null;for(let at=desktop.data.indexOf(needle);at>=0;at=desktop.data.indexOf(needle,at+1)){if(at%4)continue;const ox=at/4%desktop.width-first.x,oy=Math.floor(at/4/desktop.width)-first.y-5;if(surfaces.every(v=>match(desktop,v,ox,oy))){origin={x:ox,y:oy};break;}}assert(origin,'native desktop exact rows at one origin');s.fourPlanes={sharedGDI:true,backing:true,compositor:true,nativeDesktop:true,origin};
 if([0,1,2,3,5,9,12].includes(stage)){fs.writeFileSync(out+'/stage-'+stage+'-composited.png',compositeBytes);}else fs.unlinkSync(desktopPath);
 s.surfaces=surfaces.map(({bytes,...v})=>({...v,sha256:sha(bytes)}));for(const name of ['frame'])if(s[name])delete s[name].pixels;states.push(s);save('states.json',states);
 }
 const native=args=>cp.execFileSync('xdotool',args,{env:display.env,timeout:5000});const wins=native(['search','--onlyvisible','--pid',String(browser.process().pid),'--class','chrome']).toString().trim().split(/\s+/);assert.equal(wins.length,1);native(['windowactivate','--sync',wins[0]]);save('native-input.json',{route:'XTEST xdotool click with real held modifiers to owned activated Chrome window',window:wins[0],pid:browser.process().pid,scenarios});
 await sample(0);
 const earlyCPU=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(earlyCPU);const earlyCPUState=await earlyCPU.evaluate(()=>{const names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,registers:Object.fromEntries(names.map(n=>[n,instance.exports[n]()>>>0]))};});save('initial-cpu-state.json',earlyCPUState);assert.equal(earlyCPUState.memoryBytes,536870912);assert.equal(Object.keys(earlyCPUState.registers).length,19);assert(earlyCPUState.registers.get_eip&&earlyCPUState.registers.get_esp);
 await Promise.all(pending);save('initial-workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));
 for(let stage=1;stage<scenarios.length;++stage){
  const spec=scenarios[stage],o=states[0].fourPlanes.origin;
  if(spec.key)native(['key','--clearmodifiers',spec.key]);
  else{
   native(['mousemove',String(Math.round(o.x+30+19+235*spec.target+70)),String(Math.round(o.y+30+64+spec.row*16+8))]);
   if(spec.mods.length)native(['keydown',...spec.mods]);
   native(['click','1']);
   if(spec.mods.length)native(['keyup',...spec.mods.toReversed()]);
  }
  await page.waitForFunction(stage=>Object.values(topHost.renderer.windows).some(w=>w.title?.startsWith(stage+' ')),{timeout:5000},stage);
  await sample(stage);
 }

 const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);const cpuState=await cpu.evaluate(()=>{const names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,registers:Object.fromEntries(names.map(n=>[n,instance.exports[n]()>>>0]))};});save('cpu-state.json',cpuState);assert.equal(cpuState.memoryBytes,536870912);assert.equal(Object.keys(cpuState.registers).length,19);assert(cpuState.registers.get_eip&&cpuState.registers.get_esp);
 await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));save('assertions.json',{expectOld,failures,states:states.length,productionBrowserCPU:true,visiblePairs:states.filter(s=>s.visiblePair!==null).map(s=>({stage:s.stage,equal:s.visiblePair})),fourPlanes:states.every(s=>s.fourPlanes.nativeDesktop)});
 assert(states[0].visiblePair,'unchanged initial literal geometry');
 if(expectOld){
  assert(failures.some(v=>v.stage===1&&v.got[6]===2&&v.want[6]===1040),'physical preedit selected click replaces instead of toggling off');
  assert(failures.some(v=>v.stage===2&&v.got[6]===4&&v.want[6]===1044),'physical preedit unselected click loses other selections');
  assert(failures.some(v=>v.stage===12&&v.got[24]>0&&v.want[24]===0),'physical old silent list notifies');
  assert(states.some(v=>!v.visiblePair),'physical old visible selection fails fixed reference');
  console.log('PASS expected physical old FAIL',failures.length);
 }else{
  assert(states.every(s=>s.visiblePair),'independent literal selected-row geometry');
  assert.deepEqual(failures,[]);
  console.log('PASS LISTBOX multiple click public state/native XTEST/four planes',states.length);
 }

 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('transients.json',await transient.cleanup(out));if(display)await display.close();}
}
if(require.main===module)main(process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync('/dev/shm/listbox-multiple-click-'),{expectOld:process.argv.includes('--expect-old')}).catch(e=>{console.error(e.stack);process.exitCode=1;});module.exports={fixture,main,scenarios};


