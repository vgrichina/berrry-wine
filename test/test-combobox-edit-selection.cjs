// Microsoft September 1995 Visual C++ v4 vol3 p184 SetEditSel, p176 GetEditSel.
// https://bitsavers.trailing-edge.com/pdf/microsoft/visual_c%2B%2B/Visual_C%2B%2B_4.0_Sep95/Visual_C%2B%2B_Version_4_Volume_3_1995.pdf
// Documented -1 sentinels and nonzero success; no >32767 assertions.
// Authored PE and fixed independent EDIT reference, no Windows pixel-equivalence claim.
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const scenarios=[
 {
  "start": 1,
  "end": 4,
  "lo": 1,
  "hi": 4,
  "after": "aZef",
  "pos": 2,
  "variant": 2,
  "text": "abcdef",
  "ret": 1
 },
 {
  "start": 1,
  "end": 4,
  "lo": 2,
  "hi": 2,
  "after": "aZef",
  "pos": 2,
  "variant": 2,
  "text": "aZef",
  "ret": 1,
  "edit": true,
  "input": "Z"
 },
 {
  "start": 0,
  "end": -1,
  "lo": 0,
  "hi": 6,
  "after": "Z",
  "pos": 1,
  "variant": 2,
  "text": "abcdef",
  "ret": 1
 },
 {
  "start": 0,
  "end": -1,
  "lo": 1,
  "hi": 1,
  "after": "Z",
  "pos": 1,
  "variant": 2,
  "text": "Z",
  "ret": 1,
  "edit": true,
  "input": "Z"
 },
 {
  "start": 2,
  "end": -1,
  "lo": 2,
  "hi": 6,
  "after": "abZ",
  "pos": 3,
  "variant": 2,
  "text": "abcdef",
  "ret": 1
 },
 {
  "start": 2,
  "end": -1,
  "lo": 3,
  "hi": 3,
  "after": "abZ",
  "pos": 3,
  "variant": 2,
  "text": "abZ",
  "ret": 1,
  "edit": true,
  "input": "Z"
 },
 {
  "start": -1,
  "end": 0,
  "lo": 6,
  "hi": 6,
  "after": "abcdefZ",
  "pos": 7,
  "variant": 2,
  "text": "abcdef",
  "ret": 1
 },
 {
  "start": -1,
  "end": 0,
  "lo": 7,
  "hi": 7,
  "after": "abcdefZ",
  "pos": 7,
  "variant": 2,
  "text": "abcdefZ",
  "ret": 1,
  "edit": true,
  "input": "Z"
 },
 {
  "start": -1,
  "end": -1,
  "lo": 6,
  "hi": 6,
  "after": "abcdefZ",
  "pos": 7,
  "variant": 2,
  "text": "abcdef",
  "ret": 1
 },
 {
  "start": -1,
  "end": -1,
  "lo": 7,
  "hi": 7,
  "after": "abcdefZ",
  "pos": 7,
  "variant": 2,
  "text": "abcdefZ",
  "ret": 1,
  "edit": true,
  "input": "Z"
 },
 {
  "start": 2,
  "end": 2,
  "lo": 2,
  "hi": 2,
  "after": "abZcdef",
  "pos": 3,
  "variant": 2,
  "text": "abcdef",
  "ret": 1
 },
 {
  "start": 2,
  "end": 2,
  "lo": 3,
  "hi": 3,
  "after": "abZcdef",
  "pos": 3,
  "variant": 2,
  "text": "abZcdef",
  "ret": 1,
  "edit": true,
  "input": "Z"
 },
 {
  "start": 1,
  "end": 4,
  "lo": 1,
  "hi": 4,
  "after": "aXYZef",
  "pos": 4,
  "input": "XYZ",
  "limit": 6,
  "variant": 2,
  "text": "abcdef",
  "ret": 1
 },
 {
  "start": 1,
  "end": 4,
  "lo": 4,
  "hi": 4,
  "after": "aXYZef",
  "pos": 4,
  "input": "XYZ",
  "limit": 6,
  "variant": 2,
  "text": "aXYZef",
  "ret": 1,
  "edit": true
 },
 {
  "start": 1,
  "end": 4,
  "lo": 1,
  "hi": 4,
  "after": "aZef",
  "pos": 2,
  "variant": 1,
  "text": "abcdef",
  "ret": 1
 },
 {
  "start": 1,
  "end": 4,
  "lo": 2,
  "hi": 2,
  "after": "aZef",
  "pos": 2,
  "variant": 1,
  "text": "aZef",
  "ret": 1,
  "edit": true,
  "input": "Z"
 },
 {
  "start": 0,
  "end": -1,
  "lo": 0,
  "hi": 6,
  "after": "Z",
  "pos": 1,
  "variant": 1,
  "text": "abcdef",
  "ret": 1
 },
 {
  "start": 0,
  "end": -1,
  "lo": 1,
  "hi": 1,
  "after": "Z",
  "pos": 1,
  "variant": 1,
  "text": "Z",
  "ret": 1,
  "edit": true,
  "input": "Z"
 },
 {
  "start": 2,
  "end": -1,
  "lo": 2,
  "hi": 6,
  "after": "abZ",
  "pos": 3,
  "variant": 1,
  "text": "abcdef",
  "ret": 1
 },
 {
  "start": 2,
  "end": -1,
  "lo": 3,
  "hi": 3,
  "after": "abZ",
  "pos": 3,
  "variant": 1,
  "text": "abZ",
  "ret": 1,
  "edit": true,
  "input": "Z"
 },
 {
  "start": -1,
  "end": 0,
  "lo": 6,
  "hi": 6,
  "after": "abcdefZ",
  "pos": 7,
  "variant": 1,
  "text": "abcdef",
  "ret": 1
 },
 {
  "start": -1,
  "end": 0,
  "lo": 7,
  "hi": 7,
  "after": "abcdefZ",
  "pos": 7,
  "variant": 1,
  "text": "abcdefZ",
  "ret": 1,
  "edit": true,
  "input": "Z"
 },
 {
  "start": -1,
  "end": -1,
  "lo": 6,
  "hi": 6,
  "after": "abcdefZ",
  "pos": 7,
  "variant": 1,
  "text": "abcdef",
  "ret": 1
 },
 {
  "start": -1,
  "end": -1,
  "lo": 7,
  "hi": 7,
  "after": "abcdefZ",
  "pos": 7,
  "variant": 1,
  "text": "abcdefZ",
  "ret": 1,
  "edit": true,
  "input": "Z"
 },
 {
  "start": 2,
  "end": 2,
  "lo": 2,
  "hi": 2,
  "after": "abZcdef",
  "pos": 3,
  "variant": 1,
  "text": "abcdef",
  "ret": 1
 },
 {
  "start": 2,
  "end": 2,
  "lo": 3,
  "hi": 3,
  "after": "abZcdef",
  "pos": 3,
  "variant": 1,
  "text": "abZcdef",
  "ret": 1,
  "edit": true,
  "input": "Z"
 },
 {
  "start": 1,
  "end": 4,
  "lo": 1,
  "hi": 4,
  "after": "aXYZef",
  "pos": 4,
  "input": "XYZ",
  "limit": 6,
  "variant": 1,
  "text": "abcdef",
  "ret": 1
 },
 {
  "start": 1,
  "end": 4,
  "lo": 4,
  "hi": 4,
  "after": "aXYZef",
  "pos": 4,
  "input": "XYZ",
  "limit": 6,
  "variant": 1,
  "text": "aXYZef",
  "ret": 1,
  "edit": true
 },
 {
  "variant": 3,
  "text": "abcdef",
  "lo": 0,
  "hi": 0,
  "ret": 0
 }
];
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);P API GetWindow(P,U);int API GetClassNameA(P,char*,int);
unsigned short API RegisterClassA(const void*);long API DefWindowProcA(P,U,U,long);P API SetFocus(P);P API GetFocus(void);int API SetWindowTextA(P,const char*);int API DestroyWindow(P);
long API SendMessageA(P,U,U,long);int API GetMessageA(P,P,U,U);int API TranslateMessage(P);long API DispatchMessageA(P);
struct WC{U style;P proc;int cex,wex;P instance,icon,cursor,brush;const char* menu;const char* name;};
static P frame,combo,refedit,status,button,instance;static int stage,ready,variant,ret,guard=1,counts[11],identity=1;static char report[700],text[100];
static int starts[29]=STARTS,ends[29]=ENDS,variants[29]=VARIANTS,lows[29]=LOWS,highs[29]=HIGHS,limits[29]=LIMITS;
static const char* texts[29]=TEXTS;
void number(int n,int* at){char d[12];int k=0;if(n<0){report[(*at)++]='-';n=-n;}do{d[k++]='0'+n%10;n/=10;}while(n);while(k)report[(*at)++]=d[--k];report[(*at)++]=' ';}
void focusededit(void){char name[32];for(P h=GetWindow(combo,5);h;h=GetWindow(h,2)){GetClassNameA(h,name,32);if(name[0]=='E'||name[0]=='e'){SetFocus(h);return;}}guard=0;}
void selecttext(void){SendMessageA(combo,0x142,0,0xffff0000);P f=GetFocus();ret=SendMessageA(combo,0x142,0,(starts[stage]&65535)|((U)(ends[stage]&65535)<<16));guard=guard&&GetFocus()==f;}
void configure(void){int v=variants[stage];if(v!=variant){if(combo)DestroyWindow(combo);variant=v;combo=CreateWindowExA(0,"COMBOBOX","",0x50010000|v,15,40,180,101,frame,(P)10,instance,0);for(int j=0;j<4;++j){SendMessageA(combo,0x143,0,(long)(j==2?"Option 02":"Other"));SendMessageA(combo,0x151,j,123+j);}SendMessageA(combo,0x14e,2,0);}
 if(stage%2==0){SetWindowTextA(combo,"abcdef");SendMessageA(combo,0x141,limits[stage],0);SetFocus(button);selecttext();}
 SetWindowTextA(refedit,texts[stage]);SendMessageA(refedit,0xb1,lows[stage],highs[stage]);SetFocus(button);
}
void publish(void){U a[3]={0x13572468,999,0x24681357},b[3]={0x10203040,999,0x40302010};
 U packed=SendMessageA(combo,0x140,(U)&a[1],(long)&b[1]),zero=SendMessageA(combo,0x140,0,0);
 U one=SendMessageA(combo,0x140,(U)&a[1],0),two=SendMessageA(combo,0x140,0,(long)&b[1]);
 int at=0,ok=1;for(int j=0;j<4;++j)ok=ok&&SendMessageA(combo,0x150,j,0)==123+j;
 number(stage,&at);number(ret,&at);number(packed,&at);number(a[1],&at);number(b[1],&at);number(zero==packed&&one==packed&&two==packed,&at);
 number(a[0]==0x13572468&&a[2]==0x24681357&&b[0]==0x10203040&&b[2]==0x40302010,&at);
 number(guard,&at);number(SendMessageA(combo,0x147,0,0),&at);number(SendMessageA(combo,0x146,0,0),&at);number(ok&&identity,&at);number(SendMessageA(combo,0x157,0,0),&at);number(GetFocus()==button,&at);
 number(SendMessageA(combo,0xe,0,0),&at);number(SendMessageA(combo,0xd,100,(long)text),&at);
 for(int j=1;j<11;++j)number(counts[j],&at);for(int j=0;text[j];++j)report[at++]=text[j];report[at]=0;SetWindowTextA(status,report);
}
long __stdcall proc(P h,U m,U w,long l){if(m==0x111&&(w&65535)==10){int n=w>>16;if(n<11)++counts[n];identity=identity&&(P)l==combo;return 0;}
 if(m==0x111&&(w&65535)==20&&!ready){ready=1;configure();for(int j=0;j<11;++j)counts[j]=0;publish();return 0;}return DefWindowProcA(h,m,w,l);}
void start(void){instance=GetModuleHandleA(0);struct WC wc={0,proc,0,0,0,0,0,(P)16,0,"ComboSelection"};wc.instance=instance;RegisterClassA(&wc);frame=CreateWindowExA(0,"ComboSelection","Authored combo edit selection",0x10cf0000,30,30,850,510,0,0,instance,0);
 refedit=CreateWindowExA(0,"EDIT","abcdef",0x50000080,502,42,159,17,frame,(P)31,instance,0);
 button=CreateWindowExA(0,"BUTTON","Ready",0x50010000,15,415,100,26,frame,(P)20,instance,0);status=CreateWindowExA(0,"STATIC","starting",0x50000000,15,460,800,24,frame,(P)21,instance,0);
 U msg[12];while(GetMessageA(msg,0,0,0)>0){if(ready&&msg[1]==0x100&&msg[2]==0x76){focusededit();selecttext();for(int j=0;j<11;++j)counts[j]=0;continue;}
 if(ready&&msg[1]==0x100&&msg[2]==0x75){++stage;configure();publish();for(int j=0;j<11;++j)counts[j]=0;continue;}TranslateMessage(msg);DispatchMessageA(msg);}}
`;
function fixture(out){
 fs.writeFileSync(out+'/fixture.c',source.replace('TEXTS','{'+ scenarios.map(v=>JSON.stringify(v.text)).join(',')+'}').replace('STARTS','{'+ scenarios.map(v=>v.start||0).join(',')+'}').replace('ENDS','{'+ scenarios.map(v=>v.end||0).join(',')+'}').replace('VARIANTS','{'+ scenarios.map(v=>v.variant).join(',')+'}').replace('LOWS','{'+ scenarios.map(v=>v.lo).join(',')+'}').replace('HIGHS','{'+ scenarios.map(v=>v.hi).join(',')+'}').replace('LIMITS','{'+ scenarios.map(v=>v.limit||100).join(',')+'}'));
 for(const [dll,names]of Object.entries({kernel32:['GetModuleHandleA@4'],user32:['CreateWindowExA@48','RegisterClassA@4','DefWindowProcA@16','SetFocus@4','GetFocus@0','GetDlgCtrlID@4','SetWindowTextA@8','DestroyWindow@4','MoveWindow@24','GetWindowRect@8','GetCapture@0','GetDlgItem@8','GetWindow@8','GetClassNameA@12','EnumWindows@8','SendMessageA@16','GetMessageA@16','TranslateMessage@4','DispatchMessageA@4']})){
 fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/fixture.c','-o',out+'/fixture.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/combo-selection.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib']);return fs.readFileSync(out+'/combo-selection.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n'),pause=ms=>new Promise(r=>setTimeout(r,ms));
 const runtime=require(root+'/tools/boids-current-runtime.cjs'),commit=cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files=runtime.gitFiles(commit);
 for(const n of files.keys())if(fs.existsSync(root+'/'+n))files.set(n,fs.readFileSync(root+'/'+n));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{maxBuffer:8e6}));
 const wasm=process.env.COMBO_SELECTION_WASM?fs.readFileSync(process.env.COMBO_SELECTION_WASM):runtime.compile(files),pe=fixture(out);fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));files.set('build/wine-assembly.wasm',wasm);files.set('combo-selection.exe',pe);
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
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1120;c.height=650;c.style='position:fixed;left:0;top:0;z-index:99999;width:1120px;height:650px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.selectionHost=new WineAssembly();selectionHost.renderer=new Win98Renderer(c);await selectionHost.init(c);if(!selectionHost.guestWorker)throw Error('production Worker required');await selectionHost.loadExe('/combo-selection.exe');selectionHost.run();});
 await page.waitForFunction(()=>Object.values(selectionHost.renderer.windows).some(w=>w.title==='Ready'),{timeout:15000});await page.evaluate(()=>{browserInput.wireCanvasInput(selectionHost.renderer.canvas,selectionHost.renderer,{runningApps:[{wine:selectionHost}],debugMode:true});selectionHost.renderer.canvas.focus();});
 await page.mouse.click(30+6+15+30,30+26+415+12);await page.waitForFunction(()=>Object.values(selectionHost.renderer.windows).some(w=>/^0 /.test(w.title)),{timeout:15000});
 async function sample(stage){await pause(240);const spec=scenarios[stage],s=await page.evaluate(({stage,wide})=>{const h=selectionHost,r=h.renderer,frame=Object.values(r.windows).find(w=>w.title==='Authored combo edit selection');
 const extract=(x,y,w,ch)=>{const p=frame._backCanvas._waCanonicalPresentation;return {x:frame.x+x,y:frame.y+y,w,h:ch,pixels:Array.from(frame._backCanvas.getContext('2d').getImageData(x,y,w,ch).data),gdi:p?{shared:p.surface.storage.buffer===h.memory.buffer,pixels:Array.from(p.surface.rgbaRect(x,y,w,ch))}:null};};return {field:extract(23,68,155,13),referenceField:extract(508,68,155,13),popup:Object.values(r.windows).some(w=>w.isPopup&&w.visible),report:Object.values(r.windows).find(w=>w.isChild&&w.x===15&&w.y===460)?.title,memoryBytes:h.memory.buffer.byteLength};},{stage,wide:spec.wide});
 assert.equal(s.memoryBytes,536870912);const got=s.report.trim().split(/\s+/).slice(0,25).map(Number),want=[stage,spec.ret,(spec.hi<<16)|spec.lo,spec.variant===3?999:spec.lo,spec.variant===3?999:spec.hi,1,1,1,2,4,1,spec.variant===1?1:0,1,spec.text.length,spec.text.length];
 const actualText=s.report.trim().split(/\s+/).slice(25).join(' '),ns=got.slice(15);
 const notifyPass=ns[0]===0&&ns[1]===0&&ns[6]===0&&ns[7]===0&&ns[8]===0&&ns[9]===0&&(spec.edit?ns[4]>0&&ns[5]>0:ns[4]===0&&ns[5]===0);
 s.publicPass=JSON.stringify(got.slice(0,15))===JSON.stringify(want)&&actualText===spec.text&&notifyPass;
 if(!s.publicPass)failures.push({stage,got,want,text:actualText,expectedText:spec.text,notifyPass});s.stage=stage;s.got=got;s.want=want;
 const surfaces=[];for(const name of ['field','referenceField']){const p=s[name];assert(p.gdi?.shared);assert(Buffer.from(p.gdi.pixels).equals(Buffer.from(p.pixels)),'shared GDI matches backing canvas');surfaces.push({x:p.x,y:p.y,w:p.w,h:p.h,bytes:Buffer.from(p.pixels)});delete p.gdi;}
 s.visiblePair=spec.variant===3?true:surfaces[0].bytes.equals(surfaces[1].bytes);s.geometryPass=!s.popup;
 // A fixed reference EDIT receives literal expected text/selection, never DUT readback.
 assert(surfaces[1].bytes.some((v,i)=>i%4!==3&&v!==255),'reference contains literal text ink');
 const compositeBytes=await page.screenshot();require(root+'/tools/browser-transients.cjs').captureWhole(out,'stage-'+stage+'-desktop',display.env);const desktopPath=out+'/stage-'+stage+'-desktop.png';const {PNG}=require(root+'/node_modules/pngjs'),composite=PNG.sync.read(compositeBytes),desktop=PNG.sync.read(fs.readFileSync(desktopPath)),g=await page.evaluate(()=>selectionHost.renderer.canvas.getBoundingClientRect().toJSON());
 const match=(png,v,ox,oy)=>{const x=Math.round(ox+v.x),y=Math.round(oy+v.y);if(x<0||y<0||x+v.w>png.width||y+v.h>png.height)return false;for(let row=0;row<v.h;++row)if(!png.data.subarray(((y+row)*png.width+x)*4,((y+row)*png.width+x+v.w)*4).equals(v.bytes.subarray(row*v.w*4,(row+1)*v.w*4)))return false;return true;};
 assert(surfaces.every(v=>match(composite,v,g.x,g.y)),'compositor exact field and rows');const first=surfaces[1],needle=first.bytes.subarray(5*first.w*4,6*first.w*4);let origin=null;for(let at=desktop.data.indexOf(needle);at>=0;at=desktop.data.indexOf(needle,at+1)){if(at%4)continue;const ox=at/4%desktop.width-first.x,oy=Math.floor(at/4/desktop.width)-first.y-5;if(surfaces.every(v=>match(desktop,v,ox,oy))){origin={x:ox,y:oy};break;}}assert(origin,'native desktop exact field and rows at one origin');s.fourPlanes={sharedGDI:true,backing:true,compositor:true,nativeDesktop:true,origin};
 if([0,1,6,7,14,15,28].includes(stage))fs.writeFileSync(out+'/stage-'+stage+'-composited.png',compositeBytes);else fs.unlinkSync(desktopPath);
 s.surfaces=surfaces.map(({bytes,...v})=>({...v,sha256:sha(bytes)}));for(const name of ['field','referenceField'])delete s[name].pixels;states.push(s);save('states.json',states);
 }
 const native=args=>cp.execFileSync('xdotool',args,{env:display.env,timeout:5000}),wins=native(['search','--onlyvisible','--pid',String(browser.process().pid),'--class','chrome']).toString().trim().split(/\s+/);assert.equal(wins.length,1);native(['windowactivate','--sync',wins[0]]);save('native-input.json',{route:'XTEST mouse/key/type to activated owned Chrome window',window:wins[0],browserPID:browser.process().pid,scenarios});
 await sample(0);for(let stage=1;stage<scenarios.length;++stage){const spec=scenarios[stage];
 if(spec.edit){native(['key','--clearmodifiers','F7']);await pause(140);native(['type','--clearmodifiers','--delay','80',spec.input]);await pause(160);}
 native(['key','--clearmodifiers','F6']);await page.waitForFunction(stage=>Object.values(selectionHost.renderer.windows).some(w=>w.title?.startsWith(stage+' ')),{timeout:10000},stage);await sample(stage);}
 const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);const cpuState=await cpu.evaluate(()=>{const names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,registers:Object.fromEntries(names.map(n=>[n,instance.exports[n]()>>>0]))};});save('cpu-state.json',cpuState);assert.equal(cpuState.memoryBytes,536870912);assert.equal(Object.keys(cpuState.registers).length,19);assert(cpuState.registers.get_eip&&cpuState.registers.get_esp);
 await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));save('assertions.json',{expectOld,failures,states:states.length,productionBrowserCPU:true,visiblePairs:states.map(s=>({stage:s.stage,equal:s.visiblePair,geometry:s.geometryPass})),fourPlanes:states.every(s=>s.fourPlanes.nativeDesktop)});

 if(expectOld){assert(failures.some(v=>v.stage===0&&v.got[1]===0),'physical preedit success return fails');assert(failures.some(v=>v.stage===6&&v.got[3]!==v.got[4]),'physical preedit deselection fails');assert(failures.some(v=>v.stage===7&&v.text!=='abcdefZ'),'physical preedit native replacement fails');assert(states.some(s=>!s.visiblePair),'physical preedit visible field fails');console.log('PASS expected physical old FAIL',failures.length);}else{assert.deepEqual(failures,[]);assert(states.every(s=>s.visiblePair&&s.geometryPass),'fixed independent public EDIT references');console.log('PASS COMBOBOX edit selection native input public state four planes',states.length);}
 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('transients.json',await transient.cleanup(out));if(display)await display.close();}
}

if(require.main===module)main(process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync('/dev/shm/combobox-edit-selection-'),{expectOld:process.argv.includes('--expect-old')}).catch(e=>{console.error(e.stack);process.exitCode=1;});module.exports={fixture,main,scenarios};
