'use strict';
// Microsoft desktop contracts FIRST: GDI extents use the selected font;
// WM_SETFONT controls drawing. Native clicks must use the same glyph advances.
// https://learn.microsoft.com/en-us/windows/win32/winmsg/wm-setfont
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-gettextextentpoint32a
// https://learn.microsoft.com/en-us/windows/win32/controls/em-lineindex
// https://learn.microsoft.com/en-us/windows/win32/controls/em-filelineindex
// Literal row starts and GDI references below are authored independently.
// Local fixed-font pixels do not claim Windows pixel parity.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const text='AAAA BBBB CCCC DDDD\r\nEEEE FFFF GGGG\r\n';
// Fixed rows and answers authored before running; no query supplies an oracle.
const narrow={starts:[0,10,21,31,37],rows:['AAAA BBBB','CCCC DDDD','EEEE FFFF','GGGG','']};
const wide={starts:[0,21,37],rows:['AAAA BBBB CCCC DDDD','EEEE FFFF GGGG','']};
const tiny={starts:[0,5,10,15,21,26,31,37],rows:['AAAA','BBBB','CCCC','DDDD','EEEE','FFFF','GGGG','']};
const cases=[
 {"key":"","width":72,"a":7,"b":7,"input":7,"top":0,"layout":{"starts":[0,5,10,15,21,26,31,37],"rows":["AAAA","BBBB","CCCC","DDDD","EEEE","FFFF","GGGG",""]},"line":1},
 {"key":"Home","width":72,"input":7,"a":5,"b":5,"top":0,"layout":{"starts":[0,5,10,15,21,26,31,37],"rows":["AAAA","BBBB","CCCC","DDDD","EEEE","FFFF","GGGG",""]},"line":1},
 {"key":"End","width":72,"input":7,"a":9,"b":9,"top":0,"layout":{"starts":[0,5,10,15,21,26,31,37],"rows":["AAAA","BBBB","CCCC","DDDD","EEEE","FFFF","GGGG",""]},"line":1},
 {"key":"Home","width":72,"input":12,"a":10,"b":10,"top":0,"layout":{"starts":[0,5,10,15,21,26,31,37],"rows":["AAAA","BBBB","CCCC","DDDD","EEEE","FFFF","GGGG",""]},"line":2},
 {"key":"End","width":72,"input":12,"a":14,"b":14,"top":0,"layout":{"starts":[0,5,10,15,21,26,31,37],"rows":["AAAA","BBBB","CCCC","DDDD","EEEE","FFFF","GGGG",""]},"line":2},
 {"key":"Home","width":104,"input":13,"a":10,"b":10,"top":0,"layout":{"starts":[0,10,21,31,37],"rows":["AAAA BBBB","CCCC DDDD","EEEE FFFF","GGGG",""]},"line":1},
 {"key":"End","width":104,"input":25,"a":30,"b":30,"top":0,"layout":{"starts":[0,10,21,31,37],"rows":["AAAA BBBB","CCCC DDDD","EEEE FFFF","GGGG",""]},"line":2},
 {"key":"Home","width":104,"input":25,"a":21,"b":21,"top":0,"layout":{"starts":[0,10,21,31,37],"rows":["AAAA BBBB","CCCC DDDD","EEEE FFFF","GGGG",""]},"line":2},
 {"key":"End","width":104,"input":13,"a":19,"b":19,"top":0,"layout":{"starts":[0,10,21,31,37],"rows":["AAAA BBBB","CCCC DDDD","EEEE FFFF","GGGG",""]},"line":1},
 {"key":"Home","width":72,"input":7,"a":0,"b":0,"ctrl":true,"top":0,"layout":{"starts":[0,5,10,15,21,26,31,37],"rows":["AAAA","BBBB","CCCC","DDDD","EEEE","FFFF","GGGG",""]},"line":0},
 {"key":"End","width":72,"input":7,"a":37,"b":37,"ctrl":true,"top":3,"layout":{"starts":[0,5,10,15,21,26,31,37],"rows":["AAAA","BBBB","CCCC","DDDD","EEEE","FFFF","GGGG",""]},"line":7},
 {"key":"Home","width":72,"input":7,"a":7,"b":5,"shift":true,"top":0,"layout":{"starts":[0,5,10,15,21,26,31,37],"rows":["AAAA","BBBB","CCCC","DDDD","EEEE","FFFF","GGGG",""]},"line":1},
 {"key":"End","width":72,"input":7,"a":7,"b":9,"shift":true,"top":0,"layout":{"starts":[0,5,10,15,21,26,31,37],"rows":["AAAA","BBBB","CCCC","DDDD","EEEE","FFFF","GGGG",""]},"line":1},
 {"key":"Home","width":72,"input":7,"a":7,"b":0,"shift":true,"ctrl":true,"top":0,"layout":{"starts":[0,5,10,15,21,26,31,37],"rows":["AAAA","BBBB","CCCC","DDDD","EEEE","FFFF","GGGG",""]},"line":0},
 {"key":"End","width":72,"input":7,"a":7,"b":37,"shift":true,"ctrl":true,"top":3,"layout":{"starts":[0,5,10,15,21,26,31,37],"rows":["AAAA","BBBB","CCCC","DDDD","EEEE","FFFF","GGGG",""]},"line":1},
 {"key":"End","width":104,"input":18,"a":19,"b":19,"top":0,"layout":{"starts":[0,10,21,31,37],"rows":["AAAA BBBB","CCCC DDDD","EEEE FFFF","GGGG",""]},"line":1},
 {"key":"Home","width":104,"input":21,"a":21,"b":21,"top":0,"layout":{"starts":[0,10,21,31,37],"rows":["AAAA BBBB","CCCC DDDD","EEEE FFFF","GGGG",""]},"line":2},
 {"key":"End","width":104,"input":34,"a":35,"b":35,"top":0,"layout":{"starts":[0,10,21,31,37],"rows":["AAAA BBBB","CCCC DDDD","EEEE FFFF","GGGG",""]},"line":3},
 {"key":"Home","width":104,"input":37,"a":37,"b":37,"top":0,"layout":{"starts":[0,10,21,31,37],"rows":["AAAA BBBB","CCCC DDDD","EEEE FFFF","GGGG",""]},"line":4},
 {"key":"End","width":104,"input":37,"a":37,"b":37,"top":0,"layout":{"starts":[0,10,21,31,37],"rows":["AAAA BBBB","CCCC DDDD","EEEE FFFF","GGGG",""]},"line":4},
 {"key":"Home","width":184,"input":13,"a":0,"b":0,"top":0,"layout":{"starts":[0,21,37],"rows":["AAAA BBBB CCCC DDDD","EEEE FFFF GGGG",""]},"line":0},
 {"key":"End","width":184,"input":13,"a":19,"b":19,"top":0,"layout":{"starts":[0,21,37],"rows":["AAAA BBBB CCCC DDDD","EEEE FFFF GGGG",""]},"line":0},
 {"key":"Home","width":72,"input":0,"a":0,"b":0,"top":0,"layout":{"starts":[0,5,10,15,21,26,31,37],"rows":["AAAA","BBBB","CCCC","DDDD","EEEE","FFFF","GGGG",""]},"line":0},
 {"key":"End","width":72,"input":0,"a":0,"b":0,"empty":true,"top":0,"layout":{"starts":[0],"rows":[""]},"line":0},
 {"key":"Home","width":104,"input":27,"a":26,"b":26,"fontWide":true,"top":1,"layout":{"starts":[0,5,10,15,21,26,31,37],"rows":["AAAA","BBBB","CCCC","DDDD","EEEE","FFFF","GGGG",""]},"line":5},
 {"key":"End","width":104,"input":27,"a":30,"b":30,"fontWide":true,"top":1,"layout":{"starts":[0,5,10,15,21,26,31,37],"rows":["AAAA","BBBB","CCCC","DDDD","EEEE","FFFF","GGGG",""]},"line":5},
 {"key":"End","width":104,"input":25,"a":25,"b":30,"shift":true,"top":0,"layout":{"starts":[0,10,21,31,37],"rows":["AAAA BBBB","CCCC DDDD","EEEE FFFF","GGGG",""]},"line":2},
 {"key":"Home","width":104,"input":13,"a":13,"b":10,"shift":true,"top":0,"layout":{"starts":[0,10,21,31,37],"rows":["AAAA BBBB","CCCC DDDD","EEEE FFFF","GGGG",""]},"line":1}
];
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExW(U,const unsigned short*,const unsigned short*,U,int,int,int,int,P,P,P,P);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
unsigned short API RegisterClassA(const void*);long API DefWindowProcA(P,U,U,long);P API SetFocus(P);P API GetFocus(void);int API GetDlgCtrlID(P);int API SetWindowTextA(P,const char*);int API UpdateWindow(P);int API MoveWindow(P,int,int,int,int,int);
long API SendMessageA(P,U,U,long);int API GetMessageA(P,P,U,U);int API TranslateMessage(P);long API DispatchMessageA(P);int API IsDialogMessageA(P,P);
struct WC{U style;P proc;int cex,wex;P instance,icon,cursor,brush;const char* menu;const char* name;};
struct R{long l,t,r,b;};P API BeginPaint(P,P);int API EndPaint(P,P);int API FillRect(P,struct R*,P);P API GetStockObject(int);int API InvalidateRect(P,P,int);
P API GetDC(P);int API ReleaseDC(P,P);int API GetTextExtentPoint32A(P,const char*,int,P);int API GetCaretPos(P);P API CreateFontA(int,int,int,int,int,U,U,U,U,U,U,U,U,const char*);P API SelectObject(P,P);U API SetTextColor(P,U);int API SetBkMode(P,int);int API TextOutA(P,int,int,const char*,int);P API CreateSolidBrush(U);int API DeleteObject(P);
static P frame,edit,ref,status,multi,single,unsupported,rich,bigfont,unicode,password;static U variant[12];static int stage,ready,inputmsg;static U clicked;static char report[2000],value[100];static char text[]=TEXT;
static int settings[28][8]=SETTINGS;
void number(U n,int* at){char d[12];int k=0;do{d[k++]='0'+n%10;n/=10;}while(n);while(k)report[(*at)++]=d[--k];report[(*at)++]=' ';}
void fill(P dc,int l,int t,int r,int b,P brush){struct R q={l,t,r,b};FillRect(dc,&q,brush);}
static char *rows[3][8]={{"AAAA BBBB","CCCC DDDD","EEEE FFFF","GGGG","",0,0,0},{"AAAA BBBB CCCC DDDD","EEEE FFFF GGGG","",0,0,0,0,0},{"AAAA","BBBB","CCCC","DDDD","EEEE","FFFF","GGGG",""}};
static int starts[3][8]={{0,10,21,31,37},{0,21,37},{0,5,10,15,21,26,31,37}},counts[3]={5,3,8};
long __stdcall reference(P h,U m,U w,long l){if(m==15){U ps[16];P dc=BeginPaint(h,ps);int*c=settings[stage],mode=c[5]?2:c[0]==184?1:c[0]==72?2:0,lo=c[1]<c[2]?c[1]:c[2],hi=c[1]>c[2]?c[1]:c[2];
 fill(dc,0,0,c[0],88,GetStockObject(0));SelectObject(dc,settings[stage][5]?bigfont:GetStockObject(16));SetBkMode(dc,1);SetTextColor(dc,0);
 if(!settings[stage][7])for(int j=c[3];j<counts[mode]&&j<c[3]+5;++j){char*t=rows[mode][j];int n=0;while(t[n])++n;int a=lo-starts[mode][j],b=hi-starts[mode][j];if(a<0)a=0;if(a>n)a=n;if(b<0)b=0;if(b>n)b=n;int y=4+(j-c[3])*16;
 if(a==b)a=b=0; /* Unselected rows use one literal GDI run. */
 if(a<b){P brush=CreateSolidBrush(0x800000);fill(dc,4+a*(settings[stage][5]?9:8),y-2,4+b*(settings[stage][5]?9:8),y+13,brush);DeleteObject(brush);}
 if(a)TextOutA(dc,4,y,t,a);if(a<b){SetTextColor(dc,0xffffff);TextOutA(dc,4+a*(settings[stage][5]?9:8),y,t+a,b-a);SetTextColor(dc,0);}if(b<n)TextOutA(dc,4+b*(settings[stage][5]?9:8),y,t+b,n-b);}
 EndPaint(h,ps);return 0;}return DefWindowProcA(h,m,w,l);}
void state(int*at){U a=0,b=0;SendMessageA(edit,0xb0,(U)&a,(long)&b);number(a,at);number(b,at);number(SendMessageA(edit,0xce,0,0),at);number(SendMessageA(edit,14,0,0),at);number(SendMessageA(edit,0xba,0,0),at);number(SendMessageA(edit,0xb8,0,0),at);number(GetDlgCtrlID(GetFocus()),at);SendMessageA(edit,13,100,(long)value);int same=1;char*t=settings[stage][7]?"":text;for(int j=0;j<=SendMessageA(edit,14,0,0);++j)if(t[j]!=value[j])same=0;number(same,at);}
void publish(void){int at=0;number(stage,&at);number(inputmsg,&at);state(&at);
 for(int j=0;j<10;++j)number(SendMessageA(edit,0xbb,j,12345),&at);
 number(SendMessageA(edit,0xbb,-1,0),&at);number(SendMessageA(edit,0xbb,-2,0),&at);number(SendMessageA(edit,0xbb,2147483647,0),&at);state(&at);
 number(SendMessageA(multi,0xbb,-1,0),&at);number(SendMessageA(multi,0xbb,1,0),&at);number(SendMessageA(single,0xbb,12,0),&at);number(SendMessageA(unsupported,0xbb,1,0),&at);number(SendMessageA(rich,0xbb,-1,0),&at);
 P dc=GetDC(edit),old=SelectObject(dc,settings[stage][5]?bigfont:GetStockObject(16));U size[2]={0,0},point[2]={0,0};GetTextExtentPoint32A(dc,"AA",2,size);SelectObject(dc,old);ReleaseDC(edit,dc);GetCaretPos(point);number(size[0],&at);number(point[0],&at);number(point[1],&at);number(SendMessageA(edit,0xd6,2,0),&at);number(SendMessageA(edit,0xd7,0,(10<<16)|(stage==15?36:20)),&at); number(clicked,&at);for(int j=0;j<12;++j)number(variant[j],&at);report[at]=0;SetWindowTextA(status,report);}
void apply(void){int*c=settings[stage];SetWindowTextA(edit,c[7]?"":text);MoveWindow(edit,15,40,c[0],88,1);MoveWindow(ref,15,145,c[0],88,1);SendMessageA(edit,0x30,(U)(c[5]?bigfont:GetStockObject(16)),1);SendMessageA(edit,0xb6,0,-100);SendMessageA(edit,0xb1,c[6],c[6]);InvalidateRect(ref,0,1);}
long __stdcall proc(P h,U m,U w,long l){if(m==0x111&&(w&65535)==20){ready=1;SetFocus(edit);publish();return 0;}return DefWindowProcA(h,m,w,l);}
void start(void){P i=GetModuleHandleA(0);struct WC wc={0,proc,0,0,0,0,0,(P)16,0,"EditLines"};wc.instance=i;RegisterClassA(&wc);wc.proc=reference;wc.name="FixedReference";RegisterClassA(&wc);
 bigfont=CreateFontA(16,16,0,0,400,0,0,0,0,0,0,0,1,"Fixedsys");
 frame=CreateWindowExA(0,"EditLines","Authored EDIT wrapped Home End",0x10cf0000,30,30,800,470,0,0,i,0);
 edit=CreateWindowExA(0,"EDIT",text,0x50a10044,15,40,72,88,frame,(P)10,i,0);SendMessageA(edit,0x30,(U)GetStockObject(16),1);SendMessageA(edit,0xb1,7,7);
 ref=CreateWindowExA(0,"FixedReference","",0x50800000,15,145,72,88,frame,(P)30,i,0);
 multi=CreateWindowExA(0,"EDIT",text,0x50000084,230,40,168,88,frame,(P)11,i,0);SendMessageA(multi,0xb1,2,25);
 single=CreateWindowExA(0,"EDIT","ABCDEFGHIJKLMNOPQRSTUVWXYZ",0x50000080,230,145,168,28,frame,(P)12,i,0);
 unsupported=CreateWindowExA(0,"EDIT","A\tB",0x50000080,420,145,168,28,frame,(P)13,i,0);
 rich=CreateWindowExA(0,"RichEdit20A",text,0x50000084,420,40,168,88,frame,(P)14,i,0);SendMessageA(rich,0xb1,2,25);
 password=CreateWindowExA(0,"EDIT","AAAA BBBB CCCC DDDD",0x500000a0,230,240,168,28,frame,(P)15,i,0);
 unicode=CreateWindowExW(0,L"EDIT",L"AAAA BBBB CCCC DDDD\r\nEEEE",0x50a10044,420,240,72,88,frame,(P)16,i,0);
 SendMessageA(unicode,12,0,(long)L"AAAA BBBB CCCC DDDD\r\nEEEE");
 P targets[3]={single,password,unicode};int at=0;for(int j=0;j<3;++j)for(int k=0;k<2;++k){SendMessageA(targets[j],0xb1,7,7);SendMessageA(targets[j],0x100,k?0x23:0x24,0);SendMessageA(targets[j],0xb0,(U)&variant[at],(long)&variant[at+1]);at+=2;}
 CreateWindowExA(0,"BUTTON","Ready",0x50010000,15,285,100,26,frame,(P)20,i,0);status=CreateWindowExA(0,"STATIC","starting",0x50000000,15,330,750,70,frame,(P)21,i,0);
 U msg[12];while(GetMessageA(msg,0,0,0)>0){if(ready&&msg[1]==0x100&&msg[2]==0x77){++stage;apply();}int handled=ready?0:IsDialogMessageA(frame,msg);if(!handled){TranslateMessage(msg);DispatchMessageA(msg);}if(ready&&(msg[1]==0x100||msg[1]==0x101||msg[1]==0x102||msg[1]==0x202)){inputmsg=msg[1];publish();}}}
`.replace('TEXT',JSON.stringify(text)).replace('SETTINGS','{'+cases.map(c=>'{'+[c.width,c.a,c.b,c.top,c.line,c.fontWide?1:0,c.input,c.empty?1:0]+'}').join(',')+'}');
function fixture(out){
 fs.writeFileSync(out+'/fixture.c',source);
 const imports={kernel32:['GetModuleHandleA@4'],user32:['CreateWindowExA@48','CreateWindowExW@48','RegisterClassA@4','DefWindowProcA@16','SetFocus@4','GetFocus@0','GetDlgCtrlID@4','SetWindowTextA@8','SendMessageA@16','GetMessageA@16','TranslateMessage@4','DispatchMessageA@4','IsDialogMessageA@8','UpdateWindow@4','MoveWindow@24','BeginPaint@8','EndPaint@8','FillRect@12','InvalidateRect@12','GetDC@4','ReleaseDC@8','GetCaretPos@4'],gdi32:['GetTextExtentPoint32A@16','CreateFontA@56','GetStockObject@4','SelectObject@8','SetTextColor@8','SetBkMode@8','TextOutA@20','CreateSolidBrush@4','DeleteObject@4']};
 for(const[dll,names]of Object.entries(imports)){fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/fixture.c','-o',out+'/fixture.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/edit-wrapped-home-end.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib',out+'/gdi32.lib']);return fs.readFileSync(out+'/edit-wrapped-home-end.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n');
 const runtime=require(root+'/tools/boids-current-runtime.cjs'),commit=process.env.EDIT_WRAPPED_HOME_END_COMMIT||cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files=runtime.gitFiles(commit),own='src/09c3-wndprocs5-edit.wat';files.set(own,fs.readFileSync(root+'/'+own));
 if(process.env.EDIT_WRAPPED_HOME_END_SHARED)for(const n of files.keys())if(fs.existsSync(root+'/'+n))files.set(n,fs.readFileSync(root+'/'+n));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{maxBuffer:8e6}));
 const wasm=process.env.EDIT_WRAPPED_HOME_END_MODULE?fs.readFileSync(process.env.EDIT_WRAPPED_HOME_END_MODULE):runtime.compile(files),pe=fixture(out);fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));files.set('build/wine-assembly.wasm',wasm);files.set('edit-wrapped-home-end.exe',pe);
 save('runtime.json',{commit,expectOld,testSHA256:sha(fs.readFileSync(__filename)),moduleSHA256:sha(wasm),peSHA256:sha(pe),cases,files:[...files].map(([name,b])=>({name,size:b.length,sha256:sha(b)}))});
 const transient=require(root+'/tools/browser-transients.cjs').create(),logs=[],pending=[],workers=[],failures=[],states=[];let display,browser,wait,server,nativeOrigin;
 try{
 server=http.createServer((req,res)=>{const n=new URL(req.url,'http://local').pathname.slice(1)||'index.html',b=files.get(n);res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.html')?'text/html':n.endsWith('.css')?'text/css':n.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.statusCode=b?200:404;res.end(b||'missing');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 display=await require(root+'/tools/gltron-headful-display.cjs').start(out);
 browser=await require(root+'/node_modules/puppeteer').launch({headless:false,defaultViewport:{width:1050,height:800},env:transient.env(display.env),userDataDir:transient.profile,executablePath:'/opt/google/chrome/chrome',args:[...transient.args,'--no-sandbox','--disable-dev-shm-usage','--disable-component-update','--disable-background-networking'],protocolTimeout:20000});wait=transient.watch(browser.process());browser.process().stdout?.resume();browser.process().stderr?.resume();save('browser-version.json',{version:await browser.version()});
 const page=await browser.newPage();page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>logs.push(String(e)));
 page.on('workercreated',w=>{const row={url:w.url(),modules:[]};workers.push(row);const c=w.client;c.on('Debugger.scriptParsed',v=>{if(v.scriptLanguage==='WebAssembly'||v.url.startsWith('wasm://'))pending.push(c.send('Debugger.getScriptSource',{scriptId:v.scriptId}).then(r=>row.modules.push(sha(Buffer.from(r.bytecode,'base64')))));});pending.push(c.send('Debugger.enable'));});
 await page.evaluateOnNewDocument(()=>localStorage.setItem('wine-assembly.threads','1'));await page.goto('http://127.0.0.1:'+server.address().port+'/?debug&threads&no-log');await page.waitForFunction(()=>typeof WineAssembly==='function');
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=700;c.style='position:fixed;left:0;top:0;z-index:99999;width:1000px;height:700px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.editHost=new WineAssembly();editHost.renderer=new Win98Renderer(c);await editHost.init(c);if(!editHost.guestWorker)throw Error('production Worker required');await editHost.loadExe('/edit-wrapped-home-end.exe');editHost.run();});
 await page.waitForFunction(()=>Object.values(editHost.renderer.windows).some(w=>w.title==='Ready'),{timeout:15000});await page.evaluate(()=>{browserInput.wireCanvasInput(editHost.renderer.canvas,editHost.renderer,{runningApps:[{wine:editHost}],debugMode:true});editHost.renderer.canvas.focus();});
 await page.mouse.click(30+6+15+30,30+26+285+12);await page.waitForFunction(()=>Object.values(editHost.renderer.windows).some(w=>/^0 (0|514) 7 7 /.test(w.title)),{timeout:10000});
 async function sample(stage){await new Promise(r=>setTimeout(r,120));const s=await page.evaluate(()=>{const encode=a=>{let s="";for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode(...a.subarray(i,i+8192));return btoa(s);};const h=editHost,r=h.renderer,w=Object.values(r.windows).find(w=>w.title==='Authored EDIT wrapped Home End'),p=w._backCanvas._waCanonicalPresentation;return {report:Object.values(r.windows).find(w=>w.isChild&&w.x===15&&w.y===330)?.title,rows:Object.values(r.windows).map(v=>({hwnd:v.hwnd,title:v.title,x:v.x,y:v.y,w:v.w,h:v.h,isChild:v.isChild})),gdi:p?{sharedGuestStorage:p.surface.storage.buffer===h.memory.buffer,pixels:encode(p.surface.rgbaRect(0,0,w.w,w.h))}:null,pixels:encode(w._backCanvas.getContext('2d').getImageData(0,0,w.w,w.h).data),width:w.w,height:w.h};});
 const {key,width,a,b,top,line,layout}=cases[stage],lo=Math.min(a,b),hi=Math.max(a,b),got=s.report.trim().split(/\s+/).map(Number),state=[lo,hi,top,cases[stage].empty?0:37,layout.rows.length,0,10,1];
 const current=layout.starts[layout.starts.findLastIndex(v=>v<=b)];
 const probes=Array.from({length:10},(_,j)=>layout.starts[j]??4294967295);
 const want=[stage,stage?257:got[1],...state,...probes,current,4294967295,4294967295,...state,21,21,0,0,21];
 assert.deepEqual(got.slice(23,31),got.slice(2,10),'query preserves selection/text/viewport/modify/focus');assert.deepEqual(got.slice(31,36),[21,21,0,0,21],'unwrapped current caret/single/unsupported/RichEdit fallback');
 if(JSON.stringify(got.slice(0,36))!==JSON.stringify(want))failures.push({stage,got,want});
 const measured=got.slice(36,42);assert.deepEqual(got.slice(42),[0,0,26,26,0,0,19,19,0,0,19,19],"singleline/password/Unicode retain physical navigation");
 assert(s.gdi?.sharedGuestStorage);const pix=Buffer.from(s.pixels,"base64"),gd=Buffer.from(s.gdi.pixels,"base64"),surfaces=[];let equal=true;
 // Exclude the two caret columns, never the underlying text/selection body.
 const caretRow=layout.starts.findLastIndex(v=>v<=b),caret=4+(b-layout.starts[caretRow])*(cases[stage].fontWide?9:8);
 for(let row=4;row<81;++row)for(let x=2;x<width-21;++x){const left=((26+40+row)*s.width+6+15+x)*4,right=((26+145+row)*s.width+6+15+x)*4;if(x>=caret-1&&x<caret+1&&row>=1+(caretRow-top)*16&&row<17+(caretRow-top)*16)continue;if(!pix.subarray(left,left+4).equals(pix.subarray(right,right+4)))equal=false;}
 if(!equal)failures.push({stage,geometry:false});
 for(const y of [40,145]){const x=6+15+2,sy=26+y+2,w=width-23,h=80,bytes=Buffer.alloc(w*h*4);for(let r=0;r<h;++r){const at=((sy+r)*s.width+x)*4;pix.copy(bytes,r*w*4,at,at+w*4);assert(pix.subarray(at,at+w*4).equals(gd.subarray(at,at+w*4)),'GDI/backcanvas');}surfaces.push({x,y:sy,w,h,bytes});}
 if([0,1,2,11,12,24,25].includes(stage)){await page.screenshot({path:out+'/stage-'+stage+'-composited.png'});require(root+'/tools/browser-transients.cjs').captureWhole(out,'stage-'+stage+'-desktop',display.env);
 const{PNG}=require(root+'/node_modules/pngjs'),composite=PNG.sync.read(fs.readFileSync(out+'/stage-'+stage+'-composited.png')),desktop=PNG.sync.read(fs.readFileSync(out+'/stage-'+stage+'-desktop.png')),frame=s.rows.find(w=>w.title==='Authored EDIT wrapped Home End'),g=await page.evaluate(()=>editHost.renderer.canvas.getBoundingClientRect().toJSON());
 const match=(png,v,ox,oy)=>{const x=Math.round(ox+v.x),y=Math.round(oy+v.y);if(x<0||y<0||x+v.w>png.width||y+v.h>png.height)return false;for(let r=0;r<v.h;++r)if(!png.data.subarray(((y+r)*png.width+x)*4,((y+r)*png.width+x+v.w)*4).equals(v.bytes.subarray(r*v.w*4,(r+1)*v.w*4)))return false;return true;};
 assert(surfaces.every(v=>match(composite,v,g.x+frame.x,g.y+frame.y)),'compositor exact');
const v=surfaces[0],needle=v.bytes.subarray(6*v.w*4,7*v.w*4);let origin=null;
 for(let at=desktop.data.indexOf(needle);at>=0;at=desktop.data.indexOf(needle,at+1)){if(at%4)continue;const ox=at/4%desktop.width-v.x,oy=Math.floor(at/4/desktop.width)-v.y-6;if(surfaces.every(v=>match(desktop,v,ox,oy))){origin={x:ox,y:oy};break;}}assert(origin,'native desktop exact');nativeOrigin=origin;save('stage-'+stage+'-visible.json',{origin,exactGDI:true,exactCompositor:true,exactNativeDesktop:true,surfaces:surfaces.map(({bytes,...v})=>({...v,sha256:sha(bytes)}))});}
 states.push({stage,key,got,want,equal,measured});save('states.json',states);}
 await sample(0);const native=(args)=>cp.execFileSync('xdotool',args,{env:display.env,timeout:3000});for(let j=1;j<cases.length;++j){native(['key','F8']);await page.waitForFunction(j=>Object.values(editHost.renderer.windows).some(w=>w.title?.startsWith(j+' 257 ')),{timeout:6000},j);const c=cases[j];if(c.ctrl)native(['keydown','Control_L']);if(c.shift)native(['keydown','Shift_L']);native(['key',c.key]);if(c.shift)native(['keyup','Shift_L']);if(c.ctrl)native(['keyup','Control_L']);await new Promise(r=>setTimeout(r,150));await sample(j);}
 const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);const cpuState=await cpu.evaluate(()=>{const names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,registers:Object.fromEntries(names.map(n=>[n,instance.exports[n]()>>>0]))};});save('cpu-state.json',cpuState);assert.equal(cpuState.memoryBytes,536870912);assert.equal(Object.keys(cpuState.registers).length,19);assert(cpuState.registers.get_eip&&cpuState.registers.get_esp);
 await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));save('assertions.json',{expectOld,failures,states:states.length,productionBrowserCPU:true});
 if(expectOld){assert(failures.some(f=>f.got));assert(states.some(s=>s.stage===1&&s.got[2]===0&&s.want[2]===5),"physical old Home targets paragraph start");assert(states.some(s=>s.stage===2&&s.got[2]===19&&s.want[2]===9),"physical old End targets paragraph end");console.log('PASS physical preedit oldFAIL',failures.length);}else{assert.deepEqual(failures,[]);console.log('PASS EDIT wrapped LINEINDEX public/native input/fixed GDI references/four planes',states.length);}
 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('transients.json',await transient.cleanup(out));if(display)await display.close();}
}
if(require.main===module)main(process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync('/dev/shm/edit-wrapped-home-end-'),{expectOld:process.argv.includes('--expect-old')}).catch(e=>{console.error(e.stack);process.exitCode=1;});module.exports={fixture,main,cases};


