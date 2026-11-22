'use strict';
// Microsoft desktop primary contracts consulted before implementation:
// https://learn.microsoft.com/en-us/windows/win32/controls/lb-deletestring
// https://learn.microsoft.com/en-us/windows/win32/controls/lb-gettopindex
// https://learn.microsoft.com/en-us/windows/win32/controls/lb-settopindex
// Deletion returns the remaining count; GETTOPINDEX identifies a visible item.
// Windows does not document exact deletion placement. Fixed references below
// enforce this implementation's existing ordinary-list full-page scroll clamp.
// Native XTEST keyboard -> production PE/CPU -> public queries and four planes.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const scenarios=[
 {
  "count": 12,
  "top": 7,
  "sel": 9,
  "first": 0,
  "ret": 99,
  "key": "F6",
  "notify": 0,
  "mcount": 12,
  "mtop": 7,
  "msel": [
   1,
   10
  ],
  "mfirst": 0
 },
 {
  "count": 11,
  "top": 6,
  "sel": 9,
  "first": 0,
  "ret": 11,
  "key": "F6",
  "notify": 0,
  "mcount": 12,
  "mtop": 7,
  "msel": [
   1,
   10
  ],
  "mfirst": 0
 },
 {
  "count": 10,
  "top": 5,
  "sel": 9,
  "first": 0,
  "ret": 10,
  "key": "F6",
  "notify": 0,
  "mcount": 12,
  "mtop": 7,
  "msel": [
   1,
   10
  ],
  "mfirst": 0
 },
 {
  "count": 9,
  "top": 4,
  "sel": 8,
  "first": 1,
  "ret": 9,
  "key": "F6",
  "notify": 0,
  "mcount": 12,
  "mtop": 7,
  "msel": [
   1,
   10
  ],
  "mfirst": 0
 },
 {
  "count": 8,
  "top": 3,
  "sel": 7,
  "first": 2,
  "ret": 8,
  "key": "F6",
  "notify": 0,
  "mcount": 12,
  "mtop": 7,
  "msel": [
   1,
   10
  ],
  "mfirst": 0
 },
 {
  "count": 7,
  "top": 2,
  "sel": 6,
  "first": 3,
  "ret": 7,
  "key": "F6",
  "notify": 0,
  "mcount": 12,
  "mtop": 7,
  "msel": [
   1,
   10
  ],
  "mfirst": 0
 },
 {
  "count": 6,
  "top": 1,
  "sel": 5,
  "first": 4,
  "ret": 6,
  "key": "F6",
  "notify": 0,
  "mcount": 12,
  "mtop": 7,
  "msel": [
   1,
   10
  ],
  "mfirst": 0
 },
 {
  "count": 5,
  "top": 0,
  "sel": 4,
  "first": 5,
  "ret": 5,
  "key": "F6",
  "notify": 0,
  "mcount": 12,
  "mtop": 7,
  "msel": [
   1,
   10
  ],
  "mfirst": 0
 },
 {
  "count": 4,
  "top": 0,
  "sel": 3,
  "first": 6,
  "ret": 4,
  "key": "F6",
  "notify": 0,
  "mcount": 12,
  "mtop": 7,
  "msel": [
   1,
   10
  ],
  "mfirst": 0
 },
 {
  "count": 3,
  "top": 0,
  "sel": -1,
  "first": 6,
  "ret": 3,
  "key": "F6",
  "notify": 0,
  "mcount": 12,
  "mtop": 7,
  "msel": [
   1,
   10
  ],
  "mfirst": 0
 },
 {
  "count": 0,
  "top": 0,
  "sel": -1,
  "first": 0,
  "ret": 0,
  "key": "F6",
  "notify": 0,
  "mcount": 12,
  "mtop": 7,
  "msel": [
   1,
   10
  ],
  "mfirst": 0
 },
 {
  "count": 12,
  "top": 0,
  "sel": 2,
  "first": 0,
  "ret": 99,
  "key": "F6",
  "notify": 0,
  "mcount": 12,
  "mtop": 7,
  "msel": [
   1,
   10
  ],
  "mfirst": 0
 },
 {
  "count": 11,
  "top": 6,
  "sel": 1,
  "first": 1,
  "ret": 11,
  "key": "F6",
  "notify": 0,
  "mcount": 12,
  "mtop": 7,
  "msel": [
   1,
   10
  ],
  "mfirst": 0
 },
 {
  "count": 11,
  "top": 6,
  "sel": 1,
  "first": 1,
  "ret": -1,
  "key": "F6",
  "notify": 0,
  "mcount": 12,
  "mtop": 7,
  "msel": [
   1,
   10
  ],
  "mfirst": 0
 },
 {
  "count": 10,
  "top": 1,
  "sel": 1,
  "first": 1,
  "ret": 10,
  "key": "F6",
  "notify": 0,
  "mcount": 12,
  "mtop": 7,
  "msel": [
   1,
   10
  ],
  "mfirst": 0
 },
 {
  "count": 9,
  "top": 1,
  "sel": 0,
  "first": 2,
  "ret": 9,
  "key": "F6",
  "notify": 0,
  "mcount": 12,
  "mtop": 7,
  "msel": [
   1,
   10
  ],
  "mfirst": 0
 },
 {
  "count": 9,
  "top": 4,
  "sel": 8,
  "first": 2,
  "ret": 99,
  "key": "End",
  "notify": 1,
  "mcount": 12,
  "mtop": 7,
  "msel": [
   1,
   10
  ],
  "mfirst": 0
 },
 {
  "count": 8,
  "top": 3,
  "sel": -1,
  "first": 2,
  "ret": 8,
  "key": "F6",
  "notify": 1,
  "mcount": 12,
  "mtop": 7,
  "msel": [
   1,
   10
  ],
  "mfirst": 0
 },
 {
  "count": 8,
  "top": 0,
  "sel": 0,
  "first": 2,
  "ret": 99,
  "key": "Home",
  "notify": 2,
  "mcount": 12,
  "mtop": 7,
  "msel": [
   1,
   10
  ],
  "mfirst": 0
 },
 {
  "count": 8,
  "top": 0,
  "sel": 1,
  "first": 2,
  "ret": 99,
  "key": "Down",
  "notify": 3,
  "mcount": 12,
  "mtop": 7,
  "msel": [
   1,
   10
  ],
  "mfirst": 0
 },
 {
  "count": 8,
  "top": 0,
  "sel": 1,
  "first": 2,
  "ret": 11,
  "key": "F6",
  "notify": 3,
  "mcount": 11,
  "mtop": 6,
  "msel": [
   0,
   9
  ],
  "mfirst": 1
 },
 {
  "count": 8,
  "top": 0,
  "sel": 1,
  "first": 2,
  "ret": 10,
  "key": "F6",
  "notify": 3,
  "mcount": 10,
  "mtop": 5,
  "msel": [
   0,
   9
  ],
  "mfirst": 1
 },
 {
  "count": 8,
  "top": 0,
  "sel": 1,
  "first": 2,
  "ret": 9,
  "key": "F6",
  "notify": 3,
  "mcount": 9,
  "mtop": 4,
  "msel": [
   0
  ],
  "mfirst": 1
 },
 {
  "count": 5,
  "top": 0,
  "sel": 2,
  "first": 0,
  "ret": 5,
  "key": "F6",
  "notify": 3,
  "mcount": 9,
  "mtop": 4,
  "msel": [
   0
  ],
  "mfirst": 1
 },
 {
  "count": 0,
  "top": 0,
  "sel": -1,
  "first": 0,
  "ret": 0,
  "key": "F6",
  "notify": 3,
  "mcount": 9,
  "mtop": 4,
  "msel": [
   0
  ],
  "mfirst": 1
 },
 {
  "count": 12,
  "top": 0,
  "sel": 2,
  "first": 0,
  "ret": 99,
  "key": "F6",
  "notify": 3,
  "mcount": 9,
  "mtop": 4,
  "msel": [
   0
  ],
  "mfirst": 1
 }
];
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
unsigned short API RegisterClassA(const void*);long API DefWindowProcA(P,U,U,long);P API SetFocus(P);P API GetFocus(void);int API SetWindowTextA(P,const char*);
long API SendMessageA(P,U,U,long);int API GetMessageA(P,P,U,U);int API TranslateMessage(P);long API DispatchMessageA(P);int API GetScrollInfo(P,int,P);
struct WC{U style;P proc;int cex,wex;P instance,icon,cursor,brush;const char* menu;const char* name;};struct SI{U cb,mask;int min,max;U page;int pos,track;};
static P frame,lb,multi,status,button,instance;static int stage,ready,notifications,result=99,guard=1;static char report[1200];
static const char* items[12]={"Row 00","Row 01","Row 02","Row 03","Row 04","Row 05","Row 06","Row 07","Row 08","Row 09","Row 10","Row 11"};
void number(int n,int* at){char d[12];int k=0;if(n<0){report[(*at)++]='-';n=-n;}do{d[k++]='0'+n%10;n/=10;}while(n);while(k)report[(*at)++]=d[--k];report[(*at)++]=' ';}
void add(P h){for(int j=0;j<12;++j){SendMessageA(h,0x180,0,(long)items[j]);SendMessageA(h,0x19a,j,0x12340000+j);}}
int del(P h,int j){P f=GetFocus();int nc=notifications;int r=SendMessageA(h,0x182,j,0);guard=guard&&f==GetFocus()&&nc==notifications;return r;}
void queries(P h,int* at){int n=SendMessageA(h,0x18b,0,0),top=SendMessageA(h,0x18e,0,0),rect[4]={0,0,0,0};struct SI si={28,23,0,0,0,0,0};GetScrollInfo(h,0,&si);
number(n,at);number(top,at);number(SendMessageA(h,0x188,0,0),at);number(SendMessageA(h,0x1a1,0,0),at);number(si.pos,at);number(si.max,at);number(si.page,at);number(SendMessageA(h,0x193,0,0),at);
number(SendMessageA(h,0x198,top,(long)rect),at);for(int j=0;j<4;++j)number(rect[j],at);
for(int j=0;j<n;++j){char b[32];SendMessageA(h,0x189,j,(long)b);number((b[4]-'0')*10+b[5]-'0',at);number(SendMessageA(h,0x199,j,0),at);number(SendMessageA(h,0x187,j,0),at);}}
void publish(void){int at=0;number(stage,&at);number(result,&at);number(guard,&at);number(notifications,&at);number(GetFocus()==(stage>=16?lb:button),&at);queries(lb,&at);queries(multi,&at);report[at]=0;SetWindowTextA(status,report);}
void operate(void){result=99;switch(stage){case 1:result=del(lb,11);break;case 2:result=del(lb,10);break;case 3:case 4:case 5:case 6:case 7:case 8:result=del(lb,0);break;case 9:result=del(lb,3);break;
case 10:while(SendMessageA(lb,0x18b,0,0))result=del(lb,0);break;case 11:add(lb);SendMessageA(lb,0x186,2,0);break;case 12:SendMessageA(lb,0x197,7,0);result=del(lb,0);break;
case 13:result=del(lb,-1);guard=guard&&del(lb,11)==-1;break;case 14:SendMessageA(lb,0x197,1,0);result=del(lb,10);break;case 15:result=del(lb,0);SetFocus(lb);break;
case 17:SendMessageA(lb,0x114,4|(48<<16),0);result=del(lb,8);break;case 20:result=del(multi,0);break;case 21:result=del(multi,10);break;case 22:result=del(multi,9);break;case 23:SendMessageA(lb,0x184,0,0);add(lb);SendMessageA(lb,0x186,2,0);SendMessageA(lb,0x197,7,0);while(SendMessageA(lb,0x18b,0,0)>5)result=del(lb,SendMessageA(lb,0x18b,0,0)-1);break;case 24:while(SendMessageA(lb,0x18b,0,0))result=del(lb,0);break;case 25:add(lb);SendMessageA(lb,0x186,2,0);break;}publish();}
long __stdcall proc(P h,U m,U w,long l){if(m==0x111&&(w&65535)==10&&(w>>16)==1){++notifications;return 0;}if(m==0x111&&(w&65535)==20&&!ready){SetFocus(button);ready=1;operate();return 0;}return DefWindowProcA(h,m,w,l);}
void start(void){instance=GetModuleHandleA(0);struct WC wc={0,proc,0,0,0,0,0,(P)16,0,"ListDelete"};wc.instance=instance;RegisterClassA(&wc);frame=CreateWindowExA(0,"ListDelete","Authored list deletion viewport",0x10cf0000,30,30,820,350,0,0,instance,0);
lb=CreateWindowExA(0,"LISTBOX","",0x50310101,15,40,180,108,frame,(P)10,instance,0);add(lb);SendMessageA(lb,0x186,9,0);SendMessageA(lb,0x194,320,0);SendMessageA(lb,0x114,4|(32<<16),0);SendMessageA(lb,0x197,7,0);
multi=CreateWindowExA(0,"LISTBOX","",0x50310109,250,40,180,108,frame,(P)11,instance,0);add(multi);SendMessageA(multi,0x185,1,1);SendMessageA(multi,0x185,1,10);SendMessageA(multi,0x194,320,0);SendMessageA(multi,0x197,7,0);
button=CreateWindowExA(0,"BUTTON","Ready",0x50010000,15,245,100,26,frame,(P)20,instance,0);status=CreateWindowExA(0,"STATIC","starting",0x50000000,15,285,780,50,frame,(P)21,instance,0);
U msg[12];while(GetMessageA(msg,0,0,0)>0){if(ready&&msg[1]==0x100&&msg[2]==0x75&&stage<25){++stage;operate();}else if(ready&&msg[1]==0x100&&((stage==15&&msg[2]==0x23)||(stage==17&&msg[2]==0x24)||(stage==18&&msg[2]==0x28))){TranslateMessage(msg);DispatchMessageA(msg);++stage;result=99;publish();continue;}TranslateMessage(msg);DispatchMessageA(msg);}}
`;
function fixture(out){
 fs.writeFileSync(out+'/fixture.c',source);
 for(const [dll,names]of Object.entries({kernel32:['GetModuleHandleA@4'],user32:['CreateWindowExA@48','RegisterClassA@4','DefWindowProcA@16','SetFocus@4','GetFocus@0','SetWindowTextA@8','GetScrollInfo@12','SendMessageA@16','GetMessageA@16','TranslateMessage@4','DispatchMessageA@4']})){
 fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/fixture.c','-o',out+'/fixture.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/list-delete.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib']);return fs.readFileSync(out+'/list-delete.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n'),pause=ms=>new Promise(r=>setTimeout(r,ms));
 const runtime=require(root+'/tools/boids-current-runtime.cjs'),commit=process.env.LIST_DELETE_COMMIT||cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files=runtime.gitFiles(commit);
 if(process.env.LIST_DELETE_WORKING_RUNTIME)for(const n of files.keys())if(fs.existsSync(root+'/'+n))files.set(n,fs.readFileSync(root+'/'+n));
 files.set('src/09c3-wndprocs3-listbox.wat',fs.readFileSync(root+'/src/09c3-wndprocs3-listbox.wat'));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{maxBuffer:8e6}));
 const sourcePaths=process.env.LIST_DELETE_WORKING_RUNTIME?['src','lib','host.js','tools','index.html']:['src/09c3-wndprocs3-listbox.wat'];
 const patch=cp.execFileSync('git',['diff','--binary',commit,'--',...sourcePaths],{cwd:root});fs.writeFileSync(out+'/runtime.diff',patch);
 const wasm=process.env.LIST_DELETE_WASM?fs.readFileSync(process.env.LIST_DELETE_WASM):runtime.compile(files),pe=fixture(out);fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));files.set('build/wine-assembly.wasm',wasm);files.set('list-delete.exe',pe);
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
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=650;c.style='position:fixed;left:0;top:0;z-index:99999;width:1000px;height:650px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.topHost=new WineAssembly();topHost.renderer=new Win98Renderer(c);await topHost.init(c);if(!topHost.guestWorker)throw Error('production Worker required');await topHost.loadExe('/list-delete.exe');topHost.run();});
 await page.waitForFunction(()=>Object.values(topHost.renderer.windows).some(w=>w.title==='Ready'),{timeout:15000});await page.evaluate(()=>{browserInput.wireCanvasInput(topHost.renderer.canvas,topHost.renderer,{runningApps:[{wine:topHost}],debugMode:true});topHost.renderer.canvas.focus();});
 await page.mouse.click(30+6+15+30,30+26+245+12);await page.waitForFunction(()=>Object.values(topHost.renderer.windows).some(w=>/^0 /.test(w.title)),{timeout:15000});
 async function sample(stage){await pause(130);const s=await page.evaluate(base=>{const h=topHost,r=h.renderer,frame=Object.values(r.windows).find(w=>w.title==='Authored list deletion viewport'),v=new DataView(h.memory.buffer);let kind=null;for(let i=0;i<256;i++)if(v.getUint32(base+i*16+4,true)===10)kind=v.getUint32(base+i*16,true);
 const p=frame._backCanvas._waCanonicalPresentation;return {kind,frame:{hwnd:frame.hwnd,x:frame.x,y:frame.y,w:frame.w,h:frame.h,pixels:Array.from(frame._backCanvas.getContext('2d').getImageData(0,0,frame.w,frame.h).data),gdi:p?{shared:p.surface.storage.buffer===h.memory.buffer,pixels:Array.from(p.surface.rgbaRect(0,0,frame.w,frame.h))}:null},report:Object.values(r.windows).find(w=>w.isChild&&w.x===15&&w.y===285)?.title,memoryBytes:h.memory.buffer.byteLength};},controlBase);
 assert.equal(s.kind,4,'public LISTBOX routes to native class4');assert.equal(s.memoryBytes,536870912);
 const got=s.report.trim().split(/\s+/).map(Number),spec=scenarios[stage],bits=rows=>rows.reduce((n,j)=>n|(1<<j),0);
 const want=[stage,spec.ret,1,spec.notify,1];
 function queryReference(n,top,sel,first,multiple,x){want.push(n,top,multiple?-1:sel,16,x,319,n>5?160:176,320,n?0:-1,0,0,n?180:0,n?16:0);for(let j=0;j<n;++j)want.push(first+j,0x12340000+first+j,multiple?(sel.includes(j)?1:0):(sel===j?1:0));}
 queryReference(spec.count,spec.top,spec.sel,spec.first,false,stage>=23?0:stage>=17?48:32);queryReference(spec.mcount,spec.mtop,spec.msel,spec.mfirst,true,0);
 // Focus changed at stage 15 to allow the next native End key.
 if(stage===15)want[4]=0;
 s.publicPass=got.length===want.length&&want.every((v,i)=>got[i]===v);if(!s.publicPass)failures.push({stage,got,want});
 s.stage=stage;s.got=got;s.want=want;const surfaces=[];const p=s.frame;assert(p.gdi?.shared);assert(Buffer.from(p.gdi.pixels).equals(Buffer.from(p.pixels)),'shared GDI matches backing canvas');p.shared=true;delete p.gdi;
 const crop=(p,x,y,w,h)=>{const b=Buffer.alloc(w*h*4),pix=Buffer.from(p.pixels);for(let row=0;row<h;++row)pix.copy(b,row*w*4,((y+row)*p.w+x)*4,((y+row)*p.w+x+w)*4);return {x:p.x+x,y:p.y+y,w,h,bytes:b};};
 const actual=crop(p,130,66,16,88),otherCrop=crop(p,370,66,16,88);surfaces.push(actual,otherCrop);
 // Include glyph-bearing regions so solid bands cannot match another desktop
 // location. These anchor the four-plane comparison, not the fixed oracle.
 surfaces.push(crop(p,21,66,140,88),crop(p,256,66,140,88));
 function reference(top,n,selected){const b=Buffer.alloc(16*88*4);for(let y=0;y<88;++y)for(let x=0;x<16;++x){const row=top+Math.floor(y/16);b.set(row<n&&selected.includes(row)?[0,0,128,255]:[255,255,255,255],(y*16+x)*4);}return b;}
 const expected=reference(spec.top,spec.count,[spec.sel]),otherExpected=reference(spec.mtop,spec.mcount,spec.msel);s.visiblePair=actual.bytes.equals(expected);s.otherPair=otherCrop.bytes.equals(otherExpected);s.expectedGeometry={...spec,rgbaSHA256:sha(expected),otherSHA256:sha(otherExpected)};
 const compositeBytes=await page.screenshot(),captureAt=Date.now();
 // The subprocess has its own finite deadline. PNG encoding happens after
 // actual wait/EOF and must not be mistaken for subprocess elapsed time.
 const raw=cp.execFileSync('xwd',['-root','-silent'],{env:display.env,timeout:3000,maxBuffer:16*1024*1024}),capturedAt=Date.now();
 const encoded=require(root+'/tools/browser-transients.cjs').encodeXwd(raw),desktopPath=out+'/stage-'+stage+'-desktop.png';fs.writeFileSync(desktopPath,encoded.png);
 save('stage-'+stage+'-desktop.json',{captureAt,capturedAt,encodedAt:Date.now(),subprocessTimeout:3000,actualWait:true,stdoutEOF:true,stderrEOF:true,rawSHA256:sha(raw),sha256:sha(encoded.png),width:encoded.width,height:encoded.height});
 const {PNG}=require(root+'/node_modules/pngjs'),composite=PNG.sync.read(compositeBytes),desktop=PNG.sync.read(encoded.png),g=await page.evaluate(()=>topHost.renderer.canvas.getBoundingClientRect().toJSON());
 const match=(png,v,ox,oy)=>{const x=Math.round(ox+v.x),y=Math.round(oy+v.y);if(x<0||y<0||x+v.w>png.width||y+v.h>png.height)return false;for(let row=0;row<v.h;++row)if(!png.data.subarray(((y+row)*png.width+x)*4,((y+row)*png.width+x+v.w)*4).equals(v.bytes.subarray(row*v.w*4,(row+1)*v.w*4)))return false;return true;};
 assert(surfaces.every(v=>match(composite,v,g.x,g.y)),'compositor exact rows');const first=surfaces[2],needle=first.bytes.subarray(5*first.w*4,6*first.w*4);let origin=null;for(let at=desktop.data.indexOf(needle);at>=0;at=desktop.data.indexOf(needle,at+1)){if(at%4)continue;const ox=at/4%desktop.width-first.x,oy=Math.floor(at/4/desktop.width)-first.y-5;if(surfaces.every(v=>match(desktop,v,ox,oy))){origin={x:ox,y:oy};break;}}assert(origin,'native desktop exact rows at one origin');s.fourPlanes={sharedGDI:true,backing:true,compositor:true,nativeDesktop:true,origin};
 if([0,3,7,10,11,16,17,22,23].includes(stage)){fs.writeFileSync(out+'/stage-'+stage+'-composited.png',compositeBytes);}else fs.unlinkSync(desktopPath);
 s.surfaces=surfaces.map(({bytes,...v})=>({...v,sha256:sha(bytes)}));for(const name of ['frame'])if(s[name])delete s[name].pixels;states.push(s);save('states.json',states);
 }
 const native=args=>cp.execFileSync('xdotool',args,{env:display.env,timeout:5000});const wins=native(['search','--onlyvisible','--pid',String(browser.process().pid),'--class','chrome']).toString().trim().split(/\s+/);assert.equal(wins.length,1);native(['windowactivate','--sync',wins[0]]);save('native-input.json',{route:'XTEST xdotool key to owned activated Chrome window',window:wins[0],pid:browser.process().pid,keys:scenarios.slice(1).map(s=>s.key)});
 await sample(0);
 const earlyCPU=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(earlyCPU);const earlyCPUState=await earlyCPU.evaluate(()=>{const names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,registers:Object.fromEntries(names.map(n=>[n,instance.exports[n]()>>>0]))};});save('initial-cpu-state.json',earlyCPUState);assert.equal(earlyCPUState.memoryBytes,536870912);assert.equal(Object.keys(earlyCPUState.registers).length,19);assert(earlyCPUState.registers.get_eip&&earlyCPUState.registers.get_esp);
 await Promise.all(pending);save('initial-workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));
 for(let stage=1;stage<scenarios.length;++stage){native(['key','--clearmodifiers',scenarios[stage].key]);await page.waitForFunction(stage=>Object.values(topHost.renderer.windows).some(w=>w.title?.startsWith(stage+' ')),{timeout:5000},stage);await sample(stage);}
 const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);const cpuState=await cpu.evaluate(()=>{const names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,registers:Object.fromEntries(names.map(n=>[n,instance.exports[n]()>>>0]))};});save('cpu-state.json',cpuState);assert.equal(cpuState.memoryBytes,536870912);assert.equal(Object.keys(cpuState.registers).length,19);assert(cpuState.registers.get_eip&&cpuState.registers.get_esp);
 await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));save('assertions.json',{expectOld,failures,states:states.length,productionBrowserCPU:true,visiblePairs:states.filter(s=>s.visiblePair!==null).map(s=>({stage:s.stage,equal:s.visiblePair})),fourPlanes:states.every(s=>s.fourPlanes.nativeDesktop)});
 assert(states[0].visiblePair&&states[0].otherPair,'unchanged initial literal geometry');
 if(expectOld){assert(failures.some(v=>v.stage===23&&v.got[6]>=v.got[5]),'physical preedit stale top beyond remaining count');assert(states.every(s=>s.visiblePair&&s.otherPair),'existing paint-time clamp repairs settled pixels; no old blank-frame claim');console.log('PASS expected physical old FAIL',failures.length);}else{assert(states.every(s=>s.visiblePair&&s.otherPair),'independent literal selected-row geometry including partial row');assert.deepEqual(failures,[]);console.log('PASS LISTBOX deletion viewport public state/native keys/four planes',states.length);}
 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('transients.json',await transient.cleanup(out));if(display)await display.close();}
}
if(require.main===module)main(process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync('/dev/shm/listbox-delete-viewport-'),{expectOld:process.argv.includes('--expect-old')}).catch(e=>{console.error(e.stack);process.exitCode=1;});module.exports={fixture,main,scenarios};
