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
 {key:'',width:104,a:2,b:2,top:0,line:0,layout:narrow},
 // Existing native Down traverses hard breaks; report the visual row where
 // that unchanged caret actually lands, rather than changing navigation here.
 {key:'ArrowDown',width:104,a:23,b:23,top:0,line:2,layout:narrow},
 {key:'ArrowDown',width:104,a:37,b:37,top:0,line:4,layout:narrow},
 {key:'F8',width:104,a:2,b:25,top:0,line:0,layout:narrow},
 {key:'F8',width:104,a:25,b:2,top:0,line:0,layout:narrow},
 {key:'F8',width:104,a:25,b:25,top:0,line:2,layout:narrow},
 {key:'F8',width:184,a:25,b:25,top:0,line:1,layout:wide},
 {key:'F8',width:72,a:25,b:25,top:0,line:4,layout:tiny},
 {key:'F8',width:72,a:25,b:25,top:2,line:4,layout:tiny},
 {key:'F8',width:72,a:25,b:25,top:0,line:4,layout:tiny},
 {key:'F8',width:72,a:2,b:2,top:0,line:0,layout:tiny},
 {key:'ArrowDown',width:72,a:23,b:23,top:0,line:4,layout:tiny},
 {key:'F8',width:104,a:37,b:37,top:0,line:4,layout:narrow},
 {key:'F8',width:104,a:0,b:0,top:0,line:0,layout:{starts:[0],rows:['']}},
 {key:'F8',width:104,a:2,b:2,top:0,line:0,layout:narrow},
 {key:'F8',width:104,a:2,b:2,top:0,line:0,layout:tiny,fontWide:true},
 {key:'F8',width:104,a:2,b:2,top:0,line:0,layout:narrow},
];
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
unsigned short API RegisterClassA(const void*);long API DefWindowProcA(P,U,U,long);P API SetFocus(P);P API GetFocus(void);int API GetDlgCtrlID(P);int API SetWindowTextA(P,const char*);int API UpdateWindow(P);int API MoveWindow(P,int,int,int,int,int);
long API SendMessageA(P,U,U,long);int API GetMessageA(P,P,U,U);int API TranslateMessage(P);long API DispatchMessageA(P);int API IsDialogMessageA(P,P);
struct WC{U style;P proc;int cex,wex;P instance,icon,cursor,brush;const char* menu;const char* name;};
struct R{long l,t,r,b;};P API BeginPaint(P,P);int API EndPaint(P,P);int API FillRect(P,struct R*,P);P API GetStockObject(int);int API InvalidateRect(P,P,int);
P API GetDC(P);int API ReleaseDC(P,P);int API GetTextExtentPoint32A(P,const char*,int,P);int API GetCaretPos(P);P API CreateFontA(int,int,int,int,int,U,U,U,U,U,U,U,U,const char*);P API SelectObject(P,P);U API SetTextColor(P,U);int API SetBkMode(P,int);int API TextOutA(P,int,int,const char*,int);P API CreateSolidBrush(U);int API DeleteObject(P);
static P frame,edit,ref,status,multi,single,unsupported,rich,bigfont;static int stage,ready,inputmsg;static U clicked;static char report[2000],value[100];static char text[]=TEXT;
static int settings[17][5]=SETTINGS;
void number(U n,int* at){char d[12];int k=0;do{d[k++]='0'+n%10;n/=10;}while(n);while(k)report[(*at)++]=d[--k];report[(*at)++]=' ';}
void fill(P dc,int l,int t,int r,int b,P brush){struct R q={l,t,r,b};FillRect(dc,&q,brush);}
static char *rows[3][8]={{"AAAA BBBB","CCCC DDDD","EEEE FFFF","GGGG","",0,0,0},{"AAAA BBBB CCCC DDDD","EEEE FFFF GGGG","",0,0,0,0,0},{"AAAA","BBBB","CCCC","DDDD","EEEE","FFFF","GGGG",""}};
static int starts[3][8]={{0,10,21,31,37},{0,21,37},{0,5,10,15,21,26,31,37}},counts[3]={5,3,8};
long __stdcall reference(P h,U m,U w,long l){if(m==15){U ps[16];P dc=BeginPaint(h,ps);int*c=settings[stage],mode=stage==15?2:c[0]==184?1:c[0]==72?2:0,lo=c[1]<c[2]?c[1]:c[2],hi=c[1]>c[2]?c[1]:c[2];
 fill(dc,0,0,c[0],88,GetStockObject(0));SelectObject(dc,stage==15?bigfont:GetStockObject(16));SetBkMode(dc,1);SetTextColor(dc,0);
 if(stage!=13)for(int j=c[3];j<counts[mode]&&j<c[3]+5;++j){char*t=rows[mode][j];int n=0;while(t[n])++n;int a=lo-starts[mode][j],b=hi-starts[mode][j];if(a<0)a=0;if(a>n)a=n;if(b<0)b=0;if(b>n)b=n;int y=4+(j-c[3])*16;
 if(a==b)a=b=0; /* Unselected rows use one literal GDI run. */
 if(a<b){P brush=CreateSolidBrush(0x800000);fill(dc,4+a*(stage==15?16:8),y-2,4+b*(stage==15?16:8),y+13,brush);DeleteObject(brush);}
 if(a)TextOutA(dc,4,y,t,a);if(a<b){SetTextColor(dc,0xffffff);TextOutA(dc,4+a*(stage==15?16:8),y,t+a,b-a);SetTextColor(dc,0);}if(b<n)TextOutA(dc,4+b*(stage==15?16:8),y,t+b,n-b);}
 EndPaint(h,ps);return 0;}return DefWindowProcA(h,m,w,l);}
void state(int*at){U a=0,b=0;SendMessageA(edit,0xb0,(U)&a,(long)&b);number(a,at);number(b,at);number(SendMessageA(edit,0xce,0,0),at);number(SendMessageA(edit,14,0,0),at);number(SendMessageA(edit,0xba,0,0),at);number(SendMessageA(edit,0xb8,0,0),at);number(GetDlgCtrlID(GetFocus()),at);SendMessageA(edit,13,100,(long)value);int same=1;char*t=stage==13?"":text;for(int j=0;j<=SendMessageA(edit,14,0,0);++j)if(t[j]!=value[j])same=0;number(same,at);}
void publish(void){int at=0;number(stage,&at);number(inputmsg,&at);state(&at);
 for(int j=0;j<10;++j)number(SendMessageA(edit,0xbb,j,12345),&at);
 number(SendMessageA(edit,0xbb,-1,0),&at);number(SendMessageA(edit,0xbb,-2,0),&at);number(SendMessageA(edit,0xbb,2147483647,0),&at);state(&at);
 number(SendMessageA(multi,0xbb,-1,0),&at);number(SendMessageA(multi,0xbb,1,0),&at);number(SendMessageA(single,0xbb,12,0),&at);number(SendMessageA(unsupported,0xbb,1,0),&at);number(SendMessageA(rich,0xbb,-1,0),&at);
 P dc=GetDC(edit),old=SelectObject(dc,stage==15?bigfont:GetStockObject(16));U size[2]={0,0},point[2]={0,0};GetTextExtentPoint32A(dc,"AA",2,size);SelectObject(dc,old);ReleaseDC(edit,dc);GetCaretPos(point);number(size[0],&at);number(point[0],&at);number(point[1],&at);number(SendMessageA(edit,0xd6,2,0),&at);number(SendMessageA(edit,0xd7,0,(10<<16)|(stage==15?36:20)),&at); number(clicked,&at);report[at]=0;SetWindowTextA(status,report);}
void apply(void){
 if(stage==3)SendMessageA(edit,0xb1,2,25);if(stage==4)SendMessageA(edit,0xb1,25,2);if(stage==5)SendMessageA(edit,0xb1,25,25);
 if(stage==6||stage==7||stage==12){MoveWindow(edit,15,40,settings[stage][0],88,1);MoveWindow(ref,15,145,settings[stage][0],88,1);}
 if(stage==8)SendMessageA(edit,0xb6,0,2);if(stage==9)SendMessageA(edit,0xb6,0,-20);
 if(stage==10){SendMessageA(edit,0xcf,1,0);SendMessageA(edit,0xb1,2,2);}if(stage==12){SendMessageA(edit,0xcf,0,0);SendMessageA(edit,0xb1,37,37);}
 if(stage==15){SendMessageA(edit,0x30,(U)bigfont,1);SendMessageA(edit,0xb1,2,2);}if(stage==16){SetWindowTextA(edit,text);SendMessageA(edit,0x30,(U)GetStockObject(16),1);SendMessageA(edit,0xb1,2,2);}if(stage==13)SetWindowTextA(edit,"");if(stage==14){SetWindowTextA(edit,text);SendMessageA(edit,0xb1,2,2);}InvalidateRect(ref,0,1);}
long __stdcall proc(P h,U m,U w,long l){if(m==0x111&&(w&65535)==20){ready=1;SetFocus(edit);publish();return 0;}return DefWindowProcA(h,m,w,l);}
void start(void){P i=GetModuleHandleA(0);struct WC wc={0,proc,0,0,0,0,0,(P)16,0,"EditLines"};wc.instance=i;RegisterClassA(&wc);wc.proc=reference;wc.name="FixedReference";RegisterClassA(&wc);
 bigfont=CreateFontA(16,16,0,0,400,0,0,0,0,0,0,0,1,"Fixedsys");
 frame=CreateWindowExA(0,"EditLines","Authored EDIT custom font caret",0x10cf0000,30,30,800,470,0,0,i,0);
 edit=CreateWindowExA(0,"EDIT",text,0x50a10044,15,40,104,88,frame,(P)10,i,0);SendMessageA(edit,0x30,(U)GetStockObject(16),1);SendMessageA(edit,0xb1,2,2);
 ref=CreateWindowExA(0,"FixedReference","",0x50800000,15,145,104,88,frame,(P)30,i,0);
 multi=CreateWindowExA(0,"EDIT",text,0x50000084,230,40,168,88,frame,(P)11,i,0);SendMessageA(multi,0xb1,2,25);
 single=CreateWindowExA(0,"EDIT","ABCDEFGHIJKLMNOPQRSTUVWXYZ",0x50000080,230,145,168,28,frame,(P)12,i,0);
 unsupported=CreateWindowExA(0,"EDIT","A\tB",0x50000080,420,145,168,28,frame,(P)13,i,0);
 rich=CreateWindowExA(0,"RichEdit20A",text,0x50000084,420,40,168,88,frame,(P)14,i,0);SendMessageA(rich,0xb1,2,25);
 CreateWindowExA(0,"BUTTON","Ready",0x50010000,15,285,100,26,frame,(P)20,i,0);status=CreateWindowExA(0,"STATIC","starting",0x50000000,15,330,750,70,frame,(P)21,i,0);
 U msg[12];while(GetMessageA(msg,0,0,0)>0){if(ready&&msg[1]==0x100&&(msg[2]==0x77||msg[2]==0x28)){++stage;apply();}if(stage==15&&msg[1]==0x100&&msg[2]==0x76){SendMessageA(edit,0x30,(U)GetStockObject(16),1);UpdateWindow(edit);}if(msg[1]==0x201){clicked=msg[3];if(stage==15)SendMessageA(edit,0x30,(U)bigfont,1);}int handled=ready?0:IsDialogMessageA(frame,msg);if(!handled){TranslateMessage(msg);DispatchMessageA(msg);}if(ready&&(msg[1]==0x100||msg[1]==0x101||msg[1]==0x102||msg[1]==0x202)){inputmsg=msg[1];publish();}}}
`.replace('TEXT',JSON.stringify(text)).replace('SETTINGS','{'+cases.map(c=>'{'+[c.width,c.a,c.b,c.top,c.line]+'}').join(',')+'}');
function fixture(out){
 fs.writeFileSync(out+'/fixture.c',source);
 const imports={kernel32:['GetModuleHandleA@4'],user32:['CreateWindowExA@48','RegisterClassA@4','DefWindowProcA@16','SetFocus@4','GetFocus@0','GetDlgCtrlID@4','SetWindowTextA@8','SendMessageA@16','GetMessageA@16','TranslateMessage@4','DispatchMessageA@4','IsDialogMessageA@8','UpdateWindow@4','MoveWindow@24','BeginPaint@8','EndPaint@8','FillRect@12','InvalidateRect@12','GetDC@4','ReleaseDC@8','GetCaretPos@4'],gdi32:['GetTextExtentPoint32A@16','CreateFontA@56','GetStockObject@4','SelectObject@8','SetTextColor@8','SetBkMode@8','TextOutA@20','CreateSolidBrush@4','DeleteObject@4']};
 for(const[dll,names]of Object.entries(imports)){fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/fixture.c','-o',out+'/fixture.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/edit-custom-font-caret.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib',out+'/gdi32.lib']);return fs.readFileSync(out+'/edit-custom-font-caret.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n');
 const runtime=require(root+'/tools/boids-current-runtime.cjs'),commit=process.env.EDIT_CUSTOM_FONT_CARET_COMMIT||cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files=runtime.gitFiles(commit),own='src/09c3-wndprocs5-edit.wat';files.set(own,fs.readFileSync(root+'/'+own));
 if(process.env.EDIT_CUSTOM_FONT_CARET_SHARED)for(const n of files.keys())if(fs.existsSync(root+'/'+n))files.set(n,fs.readFileSync(root+'/'+n));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{maxBuffer:8e6}));
 const wasm=process.env.EDIT_CUSTOM_FONT_CARET_MODULE?fs.readFileSync(process.env.EDIT_CUSTOM_FONT_CARET_MODULE):runtime.compile(files),pe=fixture(out);fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));files.set('build/wine-assembly.wasm',wasm);files.set('edit-custom-font-caret.exe',pe);
 save('runtime.json',{commit,expectOld,testSHA256:sha(fs.readFileSync(__filename)),moduleSHA256:sha(wasm),peSHA256:sha(pe),cases,files:[...files].map(([name,b])=>({name,size:b.length,sha256:sha(b)}))});
 const transient=require(root+'/tools/browser-transients.cjs').create(),logs=[],pending=[],workers=[],failures=[],states=[];let display,browser,wait,server,nativeOrigin;
 try{
 server=http.createServer((req,res)=>{const n=new URL(req.url,'http://local').pathname.slice(1)||'index.html',b=files.get(n);res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.html')?'text/html':n.endsWith('.css')?'text/css':n.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.statusCode=b?200:404;res.end(b||'missing');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 display=await require(root+'/tools/gltron-headful-display.cjs').start(out);
 browser=await require(root+'/node_modules/puppeteer').launch({headless:false,defaultViewport:{width:1050,height:800},env:transient.env(display.env),userDataDir:transient.profile,executablePath:'/opt/google/chrome/chrome',args:[...transient.args,'--no-sandbox','--disable-dev-shm-usage','--disable-component-update','--disable-background-networking'],protocolTimeout:20000});wait=transient.watch(browser.process());browser.process().stdout?.resume();browser.process().stderr?.resume();save('browser-version.json',{version:await browser.version()});
 const page=await browser.newPage();page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>logs.push(String(e)));
 page.on('workercreated',w=>{const row={url:w.url(),modules:[]};workers.push(row);const c=w.client;c.on('Debugger.scriptParsed',v=>{if(v.scriptLanguage==='WebAssembly'||v.url.startsWith('wasm://'))pending.push(c.send('Debugger.getScriptSource',{scriptId:v.scriptId}).then(r=>row.modules.push(sha(Buffer.from(r.bytecode,'base64')))));});pending.push(c.send('Debugger.enable'));});
 await page.evaluateOnNewDocument(()=>localStorage.setItem('wine-assembly.threads','1'));await page.goto('http://127.0.0.1:'+server.address().port+'/?debug&threads&no-log');await page.waitForFunction(()=>typeof WineAssembly==='function');
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=700;c.style='position:fixed;left:0;top:0;z-index:99999;width:1000px;height:700px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.editHost=new WineAssembly();editHost.renderer=new Win98Renderer(c);await editHost.init(c);if(!editHost.guestWorker)throw Error('production Worker required');await editHost.loadExe('/edit-custom-font-caret.exe');editHost.run();});
 await page.waitForFunction(()=>Object.values(editHost.renderer.windows).some(w=>w.title==='Ready'),{timeout:15000});await page.evaluate(()=>{browserInput.wireCanvasInput(editHost.renderer.canvas,editHost.renderer,{runningApps:[{wine:editHost}],debugMode:true});editHost.renderer.canvas.focus();});
 await page.mouse.click(30+6+15+30,30+26+285+12);await page.waitForFunction(()=>Object.values(editHost.renderer.windows).some(w=>/^0 (0|514) 2 2 /.test(w.title)),{timeout:10000});
 async function sample(stage){await new Promise(r=>setTimeout(r,120));const s=await page.evaluate(()=>{const encode=a=>{let s="";for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode(...a.subarray(i,i+8192));return btoa(s);};const h=editHost,r=h.renderer,w=Object.values(r.windows).find(w=>w.title==='Authored EDIT custom font caret'),p=w._backCanvas._waCanonicalPresentation;return {report:Object.values(r.windows).find(w=>w.isChild&&w.x===15&&w.y===330)?.title,rows:Object.values(r.windows).map(v=>({hwnd:v.hwnd,title:v.title,x:v.x,y:v.y,w:v.w,h:v.h,isChild:v.isChild})),gdi:p?{sharedGuestStorage:p.surface.storage.buffer===h.memory.buffer,pixels:encode(p.surface.rgbaRect(0,0,w.w,w.h))}:null,pixels:encode(w._backCanvas.getContext('2d').getImageData(0,0,w.w,w.h).data),width:w.w,height:w.h};});
 const {key,width,a,b,top,line,layout}=cases[stage],lo=Math.min(a,b),hi=Math.max(a,b),got=s.report.trim().split(/\s+/).map(Number),state=[lo,hi,top,stage===13?0:37,layout.rows.length,0,10,1];
 const current=layout.starts[layout.starts.findLastIndex(v=>v<=b)];
 const probes=Array.from({length:10},(_,j)=>layout.starts[j]??4294967295);
 const want=[stage,stage?257:got[1],...state,...probes,current,4294967295,4294967295,...state,21,21,0,0,21];
 assert.deepEqual(got.slice(2,10).filter((_,i)=>i!==4),state.filter((_,i)=>i!==4),'independent public state before query');assert.deepEqual(got.slice(23,31),got.slice(2,10),'query preserves selection/text/viewport/modify/focus');assert.deepEqual(got.slice(31,36),[21,21,0,0,21],'unwrapped current caret/single/unsupported/RichEdit fallback');
 if(JSON.stringify(got.slice(0,36))!==JSON.stringify(want))failures.push({stage,got,want});
 const measured=got.slice(36);assert(measured[0]>0,"public GDI extent");assert.equal(measured[0],stage===15?18:16,"independent public GDI prefix");assert.deepEqual(measured.slice(3,5),[0,0],"wrapped POSFROMCHAR/CHARFROMPOS retain unsupported fallback");
 assert(s.gdi?.sharedGuestStorage);const pix=Buffer.from(s.pixels,"base64"),gd=Buffer.from(s.gdi.pixels,"base64"),surfaces=[];let equal=true;
 // Exclude the two caret columns, never the underlying text/selection body.
 const caretRow=layout.starts.findLastIndex(v=>v<=b),caret=4+(b-layout.starts[caretRow])*(cases[stage].fontWide?9:8);
 for(let row=4;row<81;++row)for(let x=5;x<width-21;++x){const left=((26+40+row)*s.width+6+15+x)*4,right=((26+145+row)*s.width+6+15+x)*4;if(x>=caret-1&&x<caret+1)continue;if(!pix.subarray(left,left+4).equals(pix.subarray(right,right+4)))equal=false;}
 if(!equal)failures.push({stage,geometry:false});
 for(const y of [40,145]){const x=6+15+5,sy=26+y+4,w=width-26,h=77,bytes=Buffer.alloc(w*h*4);for(let r=0;r<h;++r){const at=((sy+r)*s.width+x)*4;pix.copy(bytes,r*w*4,at,at+w*4);assert(pix.subarray(at,at+w*4).equals(gd.subarray(at,at+w*4)),'GDI/backcanvas');}surfaces.push({x,y:sy,w,h,bytes});}
 if([0,7,13,15,16].includes(stage)){await page.screenshot({path:out+'/stage-'+stage+'-composited.png'});require(root+'/tools/browser-transients.cjs').captureWhole(out,'stage-'+stage+'-desktop',display.env);
 const{PNG}=require(root+'/node_modules/pngjs'),composite=PNG.sync.read(fs.readFileSync(out+'/stage-'+stage+'-composited.png')),desktop=PNG.sync.read(fs.readFileSync(out+'/stage-'+stage+'-desktop.png')),frame=s.rows.find(w=>w.title==='Authored EDIT custom font caret'),g=await page.evaluate(()=>editHost.renderer.canvas.getBoundingClientRect().toJSON());
 const match=(png,v,ox,oy)=>{const x=Math.round(ox+v.x),y=Math.round(oy+v.y);if(x<0||y<0||x+v.w>png.width||y+v.h>png.height)return false;for(let r=0;r<v.h;++r)if(!png.data.subarray(((y+r)*png.width+x)*4,((y+r)*png.width+x+v.w)*4).equals(v.bytes.subarray(r*v.w*4,(r+1)*v.w*4)))return false;return true;};
 assert(surfaces.every(v=>match(composite,v,g.x+frame.x,g.y+frame.y)),'compositor exact');const v=surfaces[0],needle=v.bytes.subarray(6*v.w*4,7*v.w*4);let origin=null;
 for(let at=desktop.data.indexOf(needle);at>=0;at=desktop.data.indexOf(needle,at+1)){if(at%4)continue;const ox=at/4%desktop.width-v.x,oy=Math.floor(at/4/desktop.width)-v.y-6;if(surfaces.every(v=>match(desktop,v,ox,oy))){origin={x:ox,y:oy};break;}}assert(origin,'native desktop exact');nativeOrigin=origin;save('stage-'+stage+'-visible.json',{origin,exactGDI:true,exactCompositor:true,exactNativeDesktop:true,surfaces:surfaces.map(({bytes,...v})=>({...v,sha256:sha(bytes)}))});}
 states.push({stage,key,got,want,equal,measured});save('states.json',states);}
 await sample(0);for(let j=1;j<cases.length;++j){await page.keyboard.down(cases[j].key);await page.keyboard.up(cases[j].key);await page.waitForFunction(j=>Object.values(editHost.renderer.windows).some(w=>w.title?.startsWith(j+' 257 ')),{timeout:6000},j);await sample(j);if(j===15){const native=(args)=>cp.execFileSync('xdotool',args,{env:display.env,timeout:3000});native(['key','F7']);await new Promise(r=>setTimeout(r,150));native(['mousemove','--sync',String(nativeOrigin.x+6+15+23),String(nativeOrigin.y+26+40+10),'click','1']);await new Promise(r=>setTimeout(r,150));const read=async()=>await page.evaluate(()=>Object.values(editHost.renderer.windows).find(w=>w.isChild&&w.x===15&&w.y===330).title.trim().split(/\s+/).map(Number));let click=await read();await page.screenshot({path:out+'/native-click-composited.png'});require(root+'/tools/browser-transients.cjs').captureWhole(out,'native-click-desktop',display.env);native(['key','q']);await new Promise(r=>setTimeout(r,150));let type=await read();native(['keydown','Shift']);await new Promise(r=>setTimeout(r,120));native(['key','Right']);await new Promise(r=>setTimeout(r,120));native(['keyup','Shift']);await new Promise(r=>setTimeout(r,150));let select=await read();save('native-font.json',{click,type,select,origin:nativeOrigin,route:'XTEST private desktop; F7 paints stock font; app sends WM_SETFONT on native button press before DispatchMessage, exposing prepaint hit testing'});for(const [name,got,want]of [['click',click.slice(2,4),[2,2]],['type',type.slice(2,4),[3,3]],['select',select.slice(2,4),[3,4]]])if(JSON.stringify(got)!==JSON.stringify(want))failures.push({native:name,got,want});}}
 const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);const cpuState=await cpu.evaluate(()=>{const names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,registers:Object.fromEntries(names.map(n=>[n,instance.exports[n]()>>>0]))};});save('cpu-state.json',cpuState);assert.equal(cpuState.memoryBytes,536870912);assert.equal(Object.keys(cpuState.registers).length,19);assert(cpuState.registers.get_eip&&cpuState.registers.get_esp);
 await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));save('assertions.json',{expectOld,failures,states:states.length,productionBrowserCPU:true});
 if(expectOld){assert(failures.some(f=>f.native||f.geometry));assert(states.filter(s=>s.stage!==15).every(s=>s.equal),'old fixed-font visible geometry retained');console.log('PASS physical preedit oldFAIL',failures.length);}else{assert.deepEqual(failures,[]);console.log('PASS EDIT wrapped LINEINDEX public/native input/fixed GDI references/four planes',states.length);}
 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('transients.json',await transient.cleanup(out));if(display)await display.close();}
}
if(require.main===module)main(process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync('/dev/shm/edit-custom-font-caret-'),{expectOld:process.argv.includes('--expect-old')}).catch(e=>{console.error(e.stack);process.exitCode=1;});module.exports={fixture,main,cases};


