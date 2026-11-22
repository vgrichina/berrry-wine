'use strict';
// Microsoft Windows 3.1 Programmer's Reference vol4 (1992), pp168-169:
// https://bitsavers.trailing-edge.com/pdf/microsoft/windows_3.1/Windows_3.1_Programmers_Reference_Volume_4_Resources_1992.pdf
// Typed ASCII conversion only. Vol3 pp45,52,55 establish public modify/selection
// operations; no case rule established for creation/WM_SETTEXT/REPLACESEL/paste.
// Those operations, locale/Unicode, dynamic and conflicting case styles excluded.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const cases=[
  {
    "key": "",
    "focus": 0,
    "texts": [
      "",
      "",
      ""
    ],
    "a": [
      0,
      0,
      0
    ],
    "b": [
      0,
      0,
      0
    ],
    "mod": [
      0,
      0,
      0
    ],
    "readonly": false
  },
  {
    "key": "a",
    "focus": 0,
    "texts": [
      "A",
      "",
      ""
    ],
    "a": [
      1,
      0,
      0
    ],
    "b": [
      1,
      0,
      0
    ],
    "mod": [
      1,
      0,
      0
    ],
    "readonly": false
  },
  {
    "key": "shift+b",
    "focus": 0,
    "texts": [
      "AB",
      "",
      ""
    ],
    "a": [
      2,
      0,
      0
    ],
    "b": [
      2,
      0,
      0
    ],
    "mod": [
      1,
      0,
      0
    ],
    "readonly": false
  },
  {
    "key": "1",
    "focus": 0,
    "texts": [
      "AB1",
      "",
      ""
    ],
    "a": [
      3,
      0,
      0
    ],
    "b": [
      3,
      0,
      0
    ],
    "mod": [
      1,
      0,
      0
    ],
    "readonly": false
  },
  {
    "key": "minus",
    "focus": 0,
    "texts": [
      "AB1-",
      "",
      ""
    ],
    "a": [
      4,
      0,
      0
    ],
    "b": [
      4,
      0,
      0
    ],
    "mod": [
      1,
      0,
      0
    ],
    "readonly": false
  },
  {
    "key": "BackSpace",
    "focus": 0,
    "texts": [
      "AB1",
      "",
      ""
    ],
    "a": [
      3,
      0,
      0
    ],
    "b": [
      3,
      0,
      0
    ],
    "mod": [
      1,
      0,
      0
    ],
    "readonly": false
  },
  {
    "key": "F8",
    "focus": 0,
    "texts": [
      "AB1",
      "",
      ""
    ],
    "a": [
      0,
      0,
      0
    ],
    "b": [
      2,
      0,
      0
    ],
    "mod": [
      1,
      0,
      0
    ],
    "readonly": false
  },
  {
    "key": "z",
    "focus": 0,
    "texts": [
      "Z1",
      "",
      ""
    ],
    "a": [
      1,
      0,
      0
    ],
    "b": [
      1,
      0,
      0
    ],
    "mod": [
      1,
      0,
      0
    ],
    "readonly": false
  },
  {
    "key": "F8",
    "focus": 1,
    "texts": [
      "Z1",
      "",
      ""
    ],
    "a": [
      1,
      0,
      0
    ],
    "b": [
      1,
      0,
      0
    ],
    "mod": [
      1,
      0,
      0
    ],
    "readonly": false
  },
  {
    "key": "a",
    "focus": 1,
    "texts": [
      "Z1",
      "a",
      ""
    ],
    "a": [
      1,
      1,
      0
    ],
    "b": [
      1,
      1,
      0
    ],
    "mod": [
      1,
      1,
      0
    ],
    "readonly": false
  },
  {
    "key": "shift+b",
    "focus": 1,
    "texts": [
      "Z1",
      "ab",
      ""
    ],
    "a": [
      1,
      2,
      0
    ],
    "b": [
      1,
      2,
      0
    ],
    "mod": [
      1,
      1,
      0
    ],
    "readonly": false
  },
  {
    "key": "1",
    "focus": 1,
    "texts": [
      "Z1",
      "ab1",
      ""
    ],
    "a": [
      1,
      3,
      0
    ],
    "b": [
      1,
      3,
      0
    ],
    "mod": [
      1,
      1,
      0
    ],
    "readonly": false
  },
  {
    "key": "minus",
    "focus": 1,
    "texts": [
      "Z1",
      "ab1-",
      ""
    ],
    "a": [
      1,
      4,
      0
    ],
    "b": [
      1,
      4,
      0
    ],
    "mod": [
      1,
      1,
      0
    ],
    "readonly": false
  },
  {
    "key": "BackSpace",
    "focus": 1,
    "texts": [
      "Z1",
      "ab1",
      ""
    ],
    "a": [
      1,
      3,
      0
    ],
    "b": [
      1,
      3,
      0
    ],
    "mod": [
      1,
      1,
      0
    ],
    "readonly": false
  },
  {
    "key": "F8",
    "focus": 1,
    "texts": [
      "Z1",
      "ab1",
      ""
    ],
    "a": [
      1,
      0,
      0
    ],
    "b": [
      1,
      2,
      0
    ],
    "mod": [
      1,
      1,
      0
    ],
    "readonly": false
  },
  {
    "key": "shift+z",
    "focus": 1,
    "texts": [
      "Z1",
      "z1",
      ""
    ],
    "a": [
      1,
      1,
      0
    ],
    "b": [
      1,
      1,
      0
    ],
    "mod": [
      1,
      1,
      0
    ],
    "readonly": false
  },
  {
    "key": "F8",
    "focus": 2,
    "texts": [
      "Z1",
      "z1",
      ""
    ],
    "a": [
      1,
      1,
      0
    ],
    "b": [
      1,
      1,
      0
    ],
    "mod": [
      1,
      1,
      0
    ],
    "readonly": false
  },
  {
    "key": "a",
    "focus": 2,
    "texts": [
      "Z1",
      "z1",
      "a"
    ],
    "a": [
      1,
      1,
      1
    ],
    "b": [
      1,
      1,
      1
    ],
    "mod": [
      1,
      1,
      1
    ],
    "readonly": false
  },
  {
    "key": "shift+b",
    "focus": 2,
    "texts": [
      "Z1",
      "z1",
      "aB"
    ],
    "a": [
      1,
      1,
      2
    ],
    "b": [
      1,
      1,
      2
    ],
    "mod": [
      1,
      1,
      1
    ],
    "readonly": false
  },
  {
    "key": "1",
    "focus": 2,
    "texts": [
      "Z1",
      "z1",
      "aB1"
    ],
    "a": [
      1,
      1,
      3
    ],
    "b": [
      1,
      1,
      3
    ],
    "mod": [
      1,
      1,
      1
    ],
    "readonly": false
  },
  {
    "key": "minus",
    "focus": 2,
    "texts": [
      "Z1",
      "z1",
      "aB1-"
    ],
    "a": [
      1,
      1,
      4
    ],
    "b": [
      1,
      1,
      4
    ],
    "mod": [
      1,
      1,
      1
    ],
    "readonly": false
  },
  {
    "key": "BackSpace",
    "focus": 2,
    "texts": [
      "Z1",
      "z1",
      "aB1"
    ],
    "a": [
      1,
      1,
      3
    ],
    "b": [
      1,
      1,
      3
    ],
    "mod": [
      1,
      1,
      1
    ],
    "readonly": false
  },
  {
    "key": "F8",
    "focus": 2,
    "texts": [
      "Z1",
      "z1",
      "aB1"
    ],
    "a": [
      1,
      1,
      0
    ],
    "b": [
      1,
      1,
      2
    ],
    "mod": [
      1,
      1,
      1
    ],
    "readonly": false
  },
  {
    "key": "z",
    "focus": 2,
    "texts": [
      "Z1",
      "z1",
      "z1"
    ],
    "a": [
      1,
      1,
      1
    ],
    "b": [
      1,
      1,
      1
    ],
    "mod": [
      1,
      1,
      1
    ],
    "readonly": false
  },
  {
    "key": "F8",
    "focus": 0,
    "texts": [
      "Z1",
      "z1",
      "z1"
    ],
    "a": [
      1,
      1,
      1
    ],
    "b": [
      1,
      1,
      1
    ],
    "mod": [
      0,
      1,
      1
    ],
    "readonly": true
  },
  {
    "key": "x",
    "focus": 0,
    "texts": [
      "Z1",
      "z1",
      "z1"
    ],
    "a": [
      1,
      1,
      1
    ],
    "b": [
      1,
      1,
      1
    ],
    "mod": [
      0,
      1,
      1
    ],
    "readonly": true
  }
];
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
unsigned short API RegisterClassA(const void*);long API DefWindowProcA(P,U,U,long);P API SetFocus(P);P API GetFocus(void);int API GetDlgCtrlID(P);int API SetWindowTextA(P,const char*);
long API SendMessageA(P,U,U,long);long API GetWindowLongA(P,int);int API GetMessageA(P,P,U,U);int API TranslateMessage(P);long API DispatchMessageA(P);
struct WC{U style;P proc;int cex,wex;P instance,icon,cursor,brush;const char* menu;const char* name;};
struct R{long l,t,r,b;};P API BeginPaint(P,P);int API EndPaint(P,P);int API FillRect(P,struct R*,P);P API GetStockObject(int);int API InvalidateRect(P,P,int);
P API SelectObject(P,P);U API SetTextColor(P,U);int API SetBkMode(P,int);int API TextOutA(P,int,int,const char*,int);P API CreateSolidBrush(U);int API DeleteObject(P);
static P frame,edits[3],refs[4],status;static int stage,ready,inputmsg;static char report[1000],value[3][100];
static char* texts[26][3]={{"","",""},{"A","",""},{"AB","",""},{"AB1","",""},{"AB1-","",""},{"AB1","",""},{"AB1","",""},{"Z1","",""},{"Z1","",""},{"Z1","a",""},{"Z1","ab",""},{"Z1","ab1",""},{"Z1","ab1-",""},{"Z1","ab1",""},{"Z1","ab1",""},{"Z1","z1",""},{"Z1","z1",""},{"Z1","z1","a"},{"Z1","z1","aB"},{"Z1","z1","aB1"},{"Z1","z1","aB1-"},{"Z1","z1","aB1"},{"Z1","z1","aB1"},{"Z1","z1","z1"},{"Z1","z1","z1"},{"Z1","z1","z1"}};
static U anchors[26][3]={{0,0,0},{1,0,0},{2,0,0},{3,0,0},{4,0,0},{3,0,0},{0,0,0},{1,0,0},{1,0,0},{1,1,0},{1,2,0},{1,3,0},{1,4,0},{1,3,0},{1,0,0},{1,1,0},{1,1,0},{1,1,1},{1,1,2},{1,1,3},{1,1,4},{1,1,3},{1,1,0},{1,1,1},{1,1,1},{1,1,1}},cursors[26][3]={{0,0,0},{1,0,0},{2,0,0},{3,0,0},{4,0,0},{3,0,0},{2,0,0},{1,0,0},{1,0,0},{1,1,0},{1,2,0},{1,3,0},{1,4,0},{1,3,0},{1,2,0},{1,1,0},{1,1,0},{1,1,1},{1,1,2},{1,1,3},{1,1,4},{1,1,3},{1,1,2},{1,1,1},{1,1,1},{1,1,1}};
void number(U n,int* at){char d[12];int k=0;do{d[k++]='0'+n%10;n/=10;}while(n);while(k)report[(*at)++]=d[--k];report[(*at)++]=' ';}
void append(char* s,int* at){if(!s[0])report[(*at)++]='_';for(int j=0;s[j];++j)report[(*at)++]=s[j];report[(*at)++]=' ';}
void fill(P dc,int l,int t,int r,int b,P brush){struct R q={l,t,r,b};FillRect(dc,&q,brush);}
long __stdcall reference(P h,U m,U w,long l){if(m==15){U ps[16];P dc=BeginPaint(h,ps);int id=GetDlgCtrlID(h)-30,a=id<3?anchors[stage][id]:0,b=id<3?cursors[stage][id]:0,n=0;char* buf=id<3?texts[stage][id]:"FIXED";while(buf[n])++n;
 if(id==3||GetFocus()!=edits[id])a=b=0;
 fill(dc,0,0,168,28,GetStockObject(0));SelectObject(dc,GetStockObject(16));SetBkMode(dc,1);SetTextColor(dc,0);
 if(a>b){int q=a;a=b;b=q;}if(a<b){P brush=CreateSolidBrush(0x800000);fill(dc,4+a*8,2,4+b*8,17,brush);DeleteObject(brush);}
 if(a)TextOutA(dc,4,4,buf,a);if(a<b){SetTextColor(dc,0xffffff);TextOutA(dc,4+a*8,4,buf+a,b-a);SetTextColor(dc,0);}if(b<n)TextOutA(dc,4+b*8,4,buf+b,n-b);
 EndPaint(h,ps);return 0;}return DefWindowProcA(h,m,w,l);}
void publish(void){int at=0;number(stage,&at);number(inputmsg,&at);number(GetDlgCtrlID(GetFocus()),&at);
 for(int j=0;j<3;++j){U a=0,b=0;number(SendMessageA(edits[j],14,0,0),&at);number(SendMessageA(edits[j],13,100,(long)value[j]),&at);SendMessageA(edits[j],0xb0,(U)&a,(long)&b);number(a,&at);number(b,&at);number(SendMessageA(edits[j],0xb8,0,0)!=0,&at);number(GetWindowLongA(edits[j],-16)&24,&at);}
 for(int j=0;j<3;++j)append(value[j],&at);report[at]=0;SetWindowTextA(status,report);for(int j=0;j<3;++j)InvalidateRect(refs[j],0,1);}
void apply(void){if(stage==6)SendMessageA(edits[0],0xb1,0,2);if(stage==8)SetFocus(edits[1]);if(stage==14)SendMessageA(edits[1],0xb1,0,2);if(stage==16)SetFocus(edits[2]);if(stage==22)SendMessageA(edits[2],0xb1,0,2);if(stage==24){SetFocus(edits[0]);SendMessageA(edits[0],0xb9,0,0);SendMessageA(edits[0],0xcf,1,0);}}
long __stdcall proc(P h,U m,U w,long l){return DefWindowProcA(h,m,w,l);}
void start(void){P i=GetModuleHandleA(0);struct WC wc={0,proc,0,0,0,0,0,(P)16,0,"EditCase"};wc.instance=i;RegisterClassA(&wc);wc.proc=reference;wc.name="CaseReference";RegisterClassA(&wc);
 frame=CreateWindowExA(0,"EditCase","Authored EDIT case styles",0x10cf0000,30,30,650,410,0,0,i,0);
 for(int j=0;j<3;++j){edits[j]=CreateWindowExA(0,"EDIT","",0x50010080|(j==0?8:j==1?16:0),15,40+j*80,168,28,frame,(P)(10+j),i,0);SendMessageA(edits[j],0x30,(U)GetStockObject(16),1);refs[j]=CreateWindowExA(0,"CaseReference","",0x50000000,250,40+j*80,168,28,frame,(P)(30+j),i,0);}
 refs[3]=CreateWindowExA(0,"CaseReference","",0x50000000,250,260,168,28,frame,(P)33,i,0);
 status=CreateWindowExA(0,"STATIC","READY",0x50000000,15,300,600,50,frame,(P)21,i,0);
 U msg[12];while(GetMessageA(msg,0,0,0)>0){if(msg[1]==0x100&&msg[2]==0x77&&!ready){ready=1;SetFocus(edits[0]);publish();continue;}
 if(ready&&(msg[1]==0x100||msg[1]==0x101)&&msg[2]==0x78){if(msg[1]==0x100)publish();continue;}
 if(ready&&msg[1]==0x100&&msg[2]!=0x10){++stage;apply();}TranslateMessage(msg);DispatchMessageA(msg);
 if(ready&&(msg[1]==0x100||msg[1]==0x101||msg[1]==0x102)){inputmsg=msg[1];publish();}}
}`;
function fixture(out){
 fs.writeFileSync(out+'/fixture.c',source);
 const imports={kernel32:['GetModuleHandleA@4'],user32:['CreateWindowExA@48','RegisterClassA@4','DefWindowProcA@16','SetFocus@4','GetFocus@0','GetDlgCtrlID@4','SetWindowTextA@8','SendMessageA@16','GetMessageA@16','TranslateMessage@4','DispatchMessageA@4','IsDialogMessageA@8','GetWindowLongA@8','GetCaretPos@4','BeginPaint@8','EndPaint@8','FillRect@12','InvalidateRect@12'],gdi32:['GetStockObject@4','SelectObject@8','SetTextColor@8','SetBkMode@8','TextOutA@20','CreateSolidBrush@4','DeleteObject@4']};
 for(const[dll,names]of Object.entries(imports)){fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/fixture.c','-o',out+'/fixture.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/edit-case-style.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib',out+'/gdi32.lib']);return fs.readFileSync(out+'/edit-case-style.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n');
 save('deadlines.json',{protocolMs:120000,readinessMs:120000,actionReadinessMs:90000,nativeActionMs:15000,finiteStages:cases.length});
 const runtime=require(root+'/tools/boids-current-runtime.cjs'),commit=process.env.EDIT_CASE_STYLE_COMMIT||cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files=runtime.gitFiles(commit),own='src/09c3-wndprocs5-edit.wat';files.set(own,fs.readFileSync(root+'/'+own));
 if(process.env.EDIT_CASE_STYLE_SHARED)for(const n of files.keys())if(fs.existsSync(root+'/'+n))files.set(n,fs.readFileSync(root+'/'+n));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{maxBuffer:8e6}));
 const wasm=process.env.EDIT_CASE_STYLE_MODULE?fs.readFileSync(process.env.EDIT_CASE_STYLE_MODULE):runtime.compile(files),pe=fixture(out);fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));files.set('build/wine-assembly.wasm',wasm);files.set('edit-case-style.exe',pe);
 save('runtime.json',{commit,expectOld,moduleSHA256:sha(wasm),peSHA256:sha(pe),cases,files:[...files].map(([name,b])=>({name,size:b.length,sha256:sha(b)}))});
 const transient=require(root+'/tools/browser-transients.cjs').create(),logs=[],pending=[],workers=[],failures=[],states=[];let display,browser,wait,server;
 try{
 server=http.createServer((req,res)=>{const n=new URL(req.url,'http://local').pathname.slice(1)||'index.html',b=files.get(n);res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.html')?'text/html':n.endsWith('.css')?'text/css':n.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.statusCode=b?200:404;res.end(b||'missing');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 display=await require(root+'/tools/gltron-headful-display.cjs').start(out);
 browser=await require(root+'/node_modules/puppeteer').launch({headless:false,defaultViewport:{width:1050,height:800},env:transient.env(display.env),userDataDir:transient.profile,executablePath:'/opt/google/chrome/chrome',args:[...transient.args,'--no-sandbox','--disable-dev-shm-usage','--disable-component-update','--disable-background-networking'],protocolTimeout:120000});wait=transient.watch(browser.process());browser.process().stdout?.resume();browser.process().stderr?.resume();save('browser-version.json',{version:await browser.version()});
 const page=await browser.newPage();page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>logs.push(String(e)));
 page.on('workercreated',w=>{const row={url:w.url(),modules:[]};workers.push(row);const c=w.client;c.on('Debugger.scriptParsed',v=>{if(v.scriptLanguage==='WebAssembly'||v.url.startsWith('wasm://'))pending.push(c.send('Debugger.getScriptSource',{scriptId:v.scriptId}).then(r=>row.modules.push(sha(Buffer.from(r.bytecode,'base64')))));});pending.push(c.send('Debugger.enable'));});
 await page.evaluateOnNewDocument(()=>localStorage.setItem('wine-assembly.threads','1'));await page.goto('http://127.0.0.1:'+server.address().port+'/?debug&threads&no-log');await page.waitForFunction(()=>typeof WineAssembly==='function');
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=700;c.style='position:fixed;left:0;top:0;z-index:99999;width:1000px;height:700px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.editHost=new WineAssembly();editHost.renderer=new Win98Renderer(c);await editHost.init(c);if(!editHost.guestWorker)throw Error('production Worker required');await editHost.loadExe('/edit-case-style.exe');editHost.run();});

 await page.waitForFunction(()=>Object.values(editHost.renderer.windows).some(w=>w.title==='READY'),{timeout:120000});
 await page.evaluate(()=>{browserInput.wireCanvasInput(editHost.renderer.canvas,editHost.renderer,{runningApps:[{wine:editHost}],debugMode:true});editHost.renderer.canvas.focus();});
 const native=args=>cp.execFileSync('xdotool',args,{env:display.env,timeout:15000}),wins=native(['search','--onlyvisible','--pid',String(browser.process().pid),'--class','chrome']).toString().trim().split(/\s+/);assert.equal(wins.length,1);native(['windowactivate','--sync',wins[0]]);
 native(['key','F8']);await page.waitForFunction(()=>Object.values(editHost.renderer.windows).some(w=>/^0 257 10 /.test(w.title)),{timeout:120000});
 save('native-input.json',{route:'private X11 XTEST F8/a/shift+b/1/minus/BackSpace/z/shift+z/x/F9 => GetMessage/TranslateMessage/DispatchMessage => public EDIT messages',window:wins[0]});
 const geometry=await page.evaluate(()=>{const r=editHost.renderer,w=Object.values(r.windows).find(w=>w.title==='Authored EDIT case styles');return {frame:{hwnd:w.hwnd,x:w.x,y:w.y},canvas:r.canvas.getBoundingClientRect().toJSON()};});
 let nativeOrigin=null;
 async function sample(stage){
 native(['key','F9']);await new Promise(r=>setTimeout(r,250));
 const s=await page.evaluate(()=>{const encode=a=>{let s="";for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode(...a.subarray(i,i+8192));return btoa(s);};const h=editHost,r=h.renderer,w=Object.values(r.windows).find(w=>w.title==='Authored EDIT case styles'),p=w._backCanvas._waCanonicalPresentation;return {report:Object.values(r.windows).find(w=>w.isChild&&w.x===15&&w.y===300)?.title,rows:Object.values(r.windows).map(v=>({hwnd:v.hwnd,title:v.title,x:v.x,y:v.y,w:v.w,h:v.h,isChild:v.isChild})),gdi:p?{sharedGuestStorage:p.surface.storage.buffer===h.memory.buffer,pixels:encode(p.surface.rgbaRect(0,0,w.w,w.h))}:null,pixels:encode(w._backCanvas.getContext('2d').getImageData(0,0,w.w,w.h).data),width:w.w,height:w.h};});

 const c=cases[stage],got=s.report.trim().split(/\s+/),nums=got.slice(0,21).map(Number),want=[stage,257,10+c.focus];
 for(let j=0;j<3;++j)want.push(c.texts[j].length,c.texts[j].length,Math.min(c.a[j],c.b[j]),Math.max(c.a[j],c.b[j]),c.mod[j],[8,16,0][j]);
 assert.deepEqual(nums,want,'public length/selection/modify/style/focus');
 const actual=got.slice(21).map(v=>v==='_'?'':v);if(JSON.stringify(actual)!==JSON.stringify(c.texts))failures.push({stage,publicText:true,actual,want:c.texts});
 assert(s.gdi?.sharedGuestStorage);const pix=Buffer.from(s.pixels,'base64'),gd=Buffer.from(s.gdi.pixels,'base64'),surfaces=[];
 function crop(x,y,w,h){const bytes=Buffer.alloc(w*h*4);for(let r=0;r<h;++r){const at=((y+r)*s.width+x)*4;pix.copy(bytes,r*w*4,at,at+w*4);assert(pix.subarray(at,at+w*4).equals(gd.subarray(at,at+w*4)),'GDI/backcanvas');}surfaces.push({x,y,w,h,bytes});return bytes;}
 crop(6+250+5,26+260+4,158,13);
 const matches=[];for(let j=0;j<3;++j){const caret=4+c.b[j]*8,segments=j===c.focus?[[5,Math.max(5,caret-1)],[Math.max(5,caret+2),163]].filter(([a,b])=>b>a):[[5,163]];let equal=true;for(const [a,b]of segments)if(!crop(6+15+a,26+40+j*80+4,b-a,13).equals(crop(6+250+a,26+40+j*80+4,b-a,13)))equal=false;matches.push(equal);if(!equal)failures.push({stage,control:j,caseGeometry:true});}
 await page.screenshot({path:out+'/stage-'+stage+'-composited.png'});require(root+'/tools/browser-transients.cjs').captureWhole(out,'stage-'+stage+'-desktop',display.env);
 const{PNG}=require(root+'/node_modules/pngjs'),composite=PNG.sync.read(fs.readFileSync(out+'/stage-'+stage+'-composited.png')),desktop=PNG.sync.read(fs.readFileSync(out+'/stage-'+stage+'-desktop.png'));
 const match=(png,v,ox,oy)=>{const x=Math.round(ox+v.x),y=Math.round(oy+v.y);if(x<0||y<0||x+v.w>png.width||y+v.h>png.height)return false;for(let r=0;r<v.h;++r)if(!png.data.subarray(((y+r)*png.width+x)*4,((y+r)*png.width+x+v.w)*4).equals(v.bytes.subarray(r*v.w*4,(r+1)*v.w*4)))return false;return true;};
 assert(surfaces.every(v=>match(composite,v,geometry.canvas.x+geometry.frame.x,geometry.canvas.y+geometry.frame.y)),'compositor exact');
 if(!nativeOrigin){const v=surfaces.find(v=>v.w===158)||surfaces[0],needle=v.bytes.subarray(6*v.w*4,7*v.w*4);for(let at=desktop.data.indexOf(needle);at>=0;at=desktop.data.indexOf(needle,at+1)){if(at%4)continue;const ox=at/4%desktop.width-v.x,oy=Math.floor(at/4/desktop.width)-v.y-6;if(surfaces.every(v=>match(desktop,v,ox,oy))){nativeOrigin={x:ox,y:oy};break;}}}
 assert(nativeOrigin&&surfaces.every(v=>match(desktop,v,nativeOrigin.x,nativeOrigin.y)),'native desktop exact at fixed origin');
 save('stage-'+stage+'-visible.json',{nativeOrigin,exactGDI:true,exactCompositor:true,exactNativeDesktop:true,surfaces:surfaces.map(({bytes,...v})=>({...v,sha256:sha(bytes)}))});
 states.push({stage,key:c.key,got,want,texts:c.texts,matches});save('states.json',states);
 }
 await sample(0);for(let j=1;j<cases.length;++j){native(['key',cases[j].key]);await page.waitForFunction(j=>Object.values(editHost.renderer.windows).some(w=>w.title?.startsWith(j+' 257 ')),{timeout:90000},j);await sample(j);}
 const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);const cpuState=await cpu.evaluate(()=>{const names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,registers:Object.fromEntries(names.map(n=>[n,instance.exports[n]()>>>0]))};});save('cpu-state.json',cpuState);assert.equal(cpuState.memoryBytes,536870912);assert.equal(Object.keys(cpuState.registers).length,19);assert(cpuState.registers.get_eip&&cpuState.registers.get_esp);
 await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));save('assertions.json',{expectOld,failures,states:states.length,productionBrowserCPU:true});
 if(expectOld){assert(failures.some(f=>f.publicText));assert(failures.some(f=>f.caseGeometry));console.log('PASS physical preedit oldFAIL',failures.length);}else{assert.deepEqual(failures,[]);console.log('PASS EDIT case styles/public text/length/selection/modify/native typing/deletion/four planes',states.length);}
 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('transients.json',await transient.cleanup(out));if(display)await display.close();}
}
if(require.main===module)main(process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync('/dev/shm/edit-case-style-'),{expectOld:process.argv.includes('--expect-old')}).catch(e=>{console.error(e.stack);process.exitCode=1;});module.exports={fixture,main,cases};


