'use strict';
// Microsoft 1992-1994 WIN32.HLP EM_GETLINE/EM_LINEINDEX/Wordwrap Functions;
// https://thelp.zdrojak.dev/helps/Borland%20C%2B%2B%204.x/win32.json.gz
// https://learn.microsoft.com/en-us/windows/win32/controls/em-getline
// Fixed public counts, bytes and GDI rows are independent of the queried EDIT.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const text='AAAA BBBB CCCC DDDD\r\nEEEE FFFF GGGG\r\n';
// Fixed rows and answers authored before running; no query supplies an oracle.
const narrow={starts:[0,10,21,31,37],rows:['AAAA BBBB','CCCC DDDD','EEEE FFFF','GGGG','']};
const wide={starts:[0,21,37],rows:['AAAA BBBB CCCC DDDD','EEEE FFFF GGGG','']};
const tiny={starts:[0,5,10,15,21,26,31,37],rows:['AAAA','BBBB','CCCC','DDDD','EEEE','FFFF','GGGG','']};
const blank={starts:[0,3,5,8],rows:['A','','B','']};
const empty={starts:[0],rows:['']};
const cases=[
 {line:0,cap:16,want:'AAAA BBBB'},
 {line:1,cap:16,want:'CCCC DDDD'},
 {line:2,cap:16,want:'EEEE FFFF'},
 {line:3,cap:3,want:'GGG'},
 {line:4,cap:16,want:''},
 {line:5,cap:16,want:''},
 {line:4294967295,cap:16,want:''},
 {line:2147483647,cap:16,want:''},
 {line:1,cap:0,want:''},
 {line:1,cap:1,want:'C'},
 {line:1,cap:65535,want:'CCCC DDDD'},
 {line:0,cap:32,want:'AAAA BBBB CCCC DDDD',width:184,layout:wide},
 {line:3,cap:16,want:'DDDD',width:72,layout:tiny},
 {line:3,cap:16,want:'DDDD',fontWide:true,layout:tiny},
 {line:0,cap:16,want:'AAAA BBBB'},
 {line:1,cap:16,want:'',text:'A\r\n\r\nB\r\n',layout:blank},
 {line:3,cap:16,want:'',text:'A\r\n\r\nB\r\n',layout:blank},
 {line:0,cap:16,want:'',text:'',layout:empty},
 {line:99,cap:16,want:'SETTING',single:true},
 {line:4294967295,cap:1,want:'S',single:true},
 {line:0,cap:16,want:'AAAA BBBB',top:2},
].map(c=>({width:104,a:0,b:0,top:0,layout:narrow,text,...c,key:'F8'}));
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
unsigned short API RegisterClassA(const void*);long API DefWindowProcA(P,U,U,long);P API SetFocus(P);P API GetFocus(void);int API GetDlgCtrlID(P);int API SetWindowTextA(P,const char*);int API MoveWindow(P,int,int,int,int,int);
long API SendMessageA(P,U,U,long);int API GetMessageA(P,P,U,U);int API TranslateMessage(P);long API DispatchMessageA(P);
struct WC{U style;P proc;int cex,wex;P instance,icon,cursor,brush;const char*menu;const char*name;};
struct R{long l,t,r,b;};P API BeginPaint(P,P);int API EndPaint(P,P);int API FillRect(P,struct R*,P);P API GetStockObject(int);int API InvalidateRect(P,P,int);
P API CreateFontA(int,int,int,int,int,U,U,U,U,U,U,U,U,const char*);P API SelectObject(P,P);U API SetTextColor(P,U);int API SetBkMode(P,int);int API TextOutA(P,int,int,const char*,int);
struct C{U width,line,cap,top,font,single,count;char*text;char*want;};static struct C cases[21]=CASES;
static P frame,edit,single,status,ref,consumer,fixed,bigfont;static int stage,ready,inputmsg;
static char report[2048],value[100];static unsigned char guarded[64];static U copied;
void number(U n,int*at){char d[12];int k=0;do{d[k++]='0'+n%10;n/=10;}while(n);while(k)report[(*at)++]=d[--k];report[(*at)++]=' ';}
void state(P e,int*at){U a=0,b=0;SendMessageA(e,0xb0,(U)&a,(long)&b);number(a,at);number(b,at);number(SendMessageA(e,0xce,0,0),at);number(SendMessageA(e,14,0,0),at);number(SendMessageA(e,0xb8,0,0),at);number(GetDlgCtrlID(GetFocus()),at);SendMessageA(e,13,100,(long)value);char*t=cases[stage].single?"SETTING":cases[stage].text;int same=1;for(int j=0;t[j]||value[j];++j)if(t[j]!=value[j]){same=0;break;}number(same,at);}
void publish(void){struct C*c=&cases[stage];P e=c->single?single:edit;int at=0;number(stage,&at);number(inputmsg,&at);state(e,&at);
for(int k=0;k<64;++k)guarded[k]=165;*(unsigned short*)(guarded+4)=c->cap;copied=SendMessageA(e,0xc4,c->line,(long)(guarded+4));number(copied,&at);for(int k=0;k<64;++k)number(guarded[k],&at);state(e,&at);
report[at]=0;SetWindowTextA(status,report);InvalidateRect(consumer,0,1);InvalidateRect(fixed,0,1);}
static char* rows[3][8]={{"AAAA BBBB","CCCC DDDD","EEEE FFFF","GGGG","",0,0,0},{"AAAA BBBB CCCC DDDD","EEEE FFFF GGGG","",0,0,0,0,0},{"AAAA","BBBB","CCCC","DDDD","EEEE","FFFF","GGGG",""}};
static int counts[3]={5,3,8};
long __stdcall reference(P h,U m,U w,long l){if(m==15){U ps[16];P dc=BeginPaint(h,ps);struct C*c=&cases[stage];struct R q={0,0,200,88};FillRect(dc,&q,GetStockObject(0));SelectObject(dc,c->font?bigfont:GetStockObject(16));SetBkMode(dc,1);SetTextColor(dc,0);
if(h==ref){int mode=c->font?2:c->width==184?1:c->width==72?2:0;
if(stage==15||stage==16){TextOutA(dc,4,4,"A",1);TextOutA(dc,4,36,"B",1);}
else if(stage!=17)for(int j=c->top;j<counts[mode]&&j<c->top+5;++j){char*t=rows[mode][j];int n=0;while(t[n])++n;TextOutA(dc,4,4+(j-c->top)*16,t,n);}}
else{char*t=h==consumer?(char*)guarded+4:c->want;int n=h==consumer?copied:0;if(h!=consumer)while(t[n])++n;TextOutA(dc,4,4,t,n);
char count[12],rev[12];U v=h==consumer?copied:n;int k=0;do{rev[k++]='0'+v%10;v/=10;}while(v);for(int j=0;j<k;++j)count[j]=rev[k-1-j];TextOutA(dc,4,36,count,k);}
EndPaint(h,ps);return 0;}return DefWindowProcA(h,m,w,l);}
void apply(void){struct C*c=&cases[stage];MoveWindow(edit,15,40,c->width,88,0);MoveWindow(ref,15,145,c->width,88,0);SendMessageA(edit,0x30,(U)(c->font?bigfont:GetStockObject(16)),0);SetWindowTextA(edit,c->text);SendMessageA(edit,0xb1,0,0);if(c->top)SendMessageA(edit,0xb6,0,c->top);InvalidateRect(edit,0,1);InvalidateRect(ref,0,1);publish();}
long __stdcall proc(P h,U m,U w,long l){if(m==0x111&&(w&65535)==20){ready=1;SetFocus(edit);publish();return 0;}return DefWindowProcA(h,m,w,l);}
void start(void){P i=GetModuleHandleA(0);struct WC wc={0,proc,0,0,0,0,0,(P)16,0,"EditGetLine"};wc.instance=i;RegisterClassA(&wc);wc.proc=reference;wc.name="GetLineReference";RegisterClassA(&wc);
bigfont=CreateFontA(16,16,0,0,400,0,0,0,0,0,0,0,1,"Fixedsys");
frame=CreateWindowExA(0,"EditGetLine","Authored EDIT wrapped getline",0x10cf0000,30,30,800,470,0,0,i,0);
edit=CreateWindowExA(0,"EDIT",cases[0].text,0x50a10044,15,40,104,88,frame,(P)10,i,0);SendMessageA(edit,0x30,(U)GetStockObject(16),0);SendMessageA(edit,0xb1,0,0);
single=CreateWindowExA(0,"EDIT","SETTING",0x50000080,230,250,168,28,frame,(P)12,i,0);SendMessageA(single,0x30,(U)GetStockObject(16),0);SendMessageA(single,0xb1,0,0);
ref=CreateWindowExA(0,"GetLineReference","",0x50800000,15,145,104,88,frame,(P)30,i,0);
consumer=CreateWindowExA(0,"GetLineReference","",0x50000000,250,40,350,88,frame,(P)31,i,0);
fixed=CreateWindowExA(0,"GetLineReference","",0x50000000,250,145,350,88,frame,(P)32,i,0);
status=CreateWindowExA(0,"STATIC","starting",0x50000000,15,330,750,70,frame,(P)21,i,0);CreateWindowExA(0,"BUTTON","Ready",0x50010000,15,285,100,26,frame,(P)20,i,0);
publish();U msg[12];while(GetMessageA(msg,0,0,0)>0){if(msg[1]==0x100&&msg[2]==0x77){if(!ready){ready=1;SetFocus(edit);publish();}else{++stage;inputmsg=msg[1];if(stage<21)apply();}}TranslateMessage(msg);DispatchMessageA(msg);}}
`.replace('CASES','{'+cases.map(c=>'{'+[c.width,c.line,c.cap,c.top,c.fontWide?1:0,c.single?1:0,c.layout.rows.length,JSON.stringify(c.text),JSON.stringify(c.want)].join(',')+'}').join(',')+'}');
function fixture(out){
 fs.writeFileSync(out+'/fixture.c',source);
 const imports={kernel32:['GetModuleHandleA@4'],user32:['CreateWindowExA@48','RegisterClassA@4','DefWindowProcA@16','SetFocus@4','GetFocus@0','GetDlgCtrlID@4','SetWindowTextA@8','SendMessageA@16','GetMessageA@16','TranslateMessage@4','DispatchMessageA@4','MoveWindow@24','BeginPaint@8','EndPaint@8','FillRect@12','InvalidateRect@12'],gdi32:['CreateFontA@56','GetStockObject@4','SelectObject@8','SetTextColor@8','SetBkMode@8','TextOutA@20','CreateSolidBrush@4','DeleteObject@4']};
 for(const[dll,names]of Object.entries(imports)){fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/fixture.c','-o',out+'/fixture.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/edit-wrapped-getline.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib',out+'/gdi32.lib']);return fs.readFileSync(out+'/edit-wrapped-getline.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n');
 const runtime=require(root+'/tools/boids-current-runtime.cjs'),commit=process.env.EDIT_WRAPPED_GETLINE_COMMIT||cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files=runtime.gitFiles(commit),own='src/09c3-wndprocs5-edit.wat';files.set(own,fs.readFileSync(root+'/'+own));
 if(process.env.EDIT_WRAPPED_GETLINE_SHARED)for(const n of files.keys())if(fs.existsSync(root+'/'+n))files.set(n,fs.readFileSync(root+'/'+n));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{maxBuffer:8e6}));
 const wasm=process.env.EDIT_WRAPPED_GETLINE_MODULE?fs.readFileSync(process.env.EDIT_WRAPPED_GETLINE_MODULE):runtime.compile(files),pe=fixture(out);fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));files.set('build/wine-assembly.wasm',wasm);files.set('edit-wrapped-getline.exe',pe);
 save('runtime.json',{commit,expectOld,testSHA256:sha(fs.readFileSync(__filename)),moduleSHA256:sha(wasm),peSHA256:sha(pe),cases,files:[...files].map(([name,b])=>({name,size:b.length,sha256:sha(b)}))});
 const transient=require(root+'/tools/browser-transients.cjs').create(),logs=[],pending=[],workers=[],failures=[],states=[];let display,browser,wait,server;
 try{
 server=http.createServer((req,res)=>{const n=new URL(req.url,'http://local').pathname.slice(1)||'index.html',b=files.get(n);res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.html')?'text/html':n.endsWith('.css')?'text/css':n.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.statusCode=b?200:404;res.end(b||'missing');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 display=await require(root+'/tools/gltron-headful-display.cjs').start(out);
 browser=await require(root+'/node_modules/puppeteer').launch({headless:false,defaultViewport:{width:1050,height:800},env:transient.env(display.env),userDataDir:transient.profile,executablePath:'/opt/google/chrome/chrome',args:[...transient.args,'--no-sandbox','--disable-dev-shm-usage','--disable-component-update','--disable-background-networking'],protocolTimeout:20000});wait=transient.watch(browser.process());browser.process().stdout?.resume();browser.process().stderr?.resume();save('browser-version.json',{version:await browser.version()});
 const page=await browser.newPage();page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>logs.push(String(e)));
 page.on('workercreated',w=>{const row={url:w.url(),modules:[]};workers.push(row);const c=w.client;c.on('Debugger.scriptParsed',v=>{if(v.scriptLanguage==='WebAssembly'||v.url.startsWith('wasm://'))pending.push(c.send('Debugger.getScriptSource',{scriptId:v.scriptId}).then(r=>row.modules.push(sha(Buffer.from(r.bytecode,'base64')))));});pending.push(c.send('Debugger.enable'));});
 await page.evaluateOnNewDocument(()=>localStorage.setItem('wine-assembly.threads','1'));await page.goto('http://127.0.0.1:'+server.address().port+'/?debug&threads&no-log');await page.waitForFunction(()=>typeof WineAssembly==='function');
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=700;c.style='position:fixed;left:0;top:0;z-index:99999;width:1000px;height:700px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.editHost=new WineAssembly();editHost.renderer=new Win98Renderer(c);await editHost.init(c);if(!editHost.guestWorker)throw Error('production Worker required');await editHost.loadExe('/edit-wrapped-getline.exe');editHost.run();});
 await page.waitForFunction(()=>Object.values(editHost.renderer.windows).some(w=>w.title==='Ready'),{timeout:15000});await page.evaluate(()=>{browserInput.wireCanvasInput(editHost.renderer.canvas,editHost.renderer,{runningApps:[{wine:editHost}],debugMode:true});editHost.renderer.canvas.focus();});
 const native=args=>cp.execFileSync('xdotool',args,{env:display.env,timeout:5000}),wins=native(['search','--onlyvisible','--pid',String(browser.process().pid),'--class','chrome']).toString().trim().split(/\s+/);assert.equal(wins.length,1);native(['windowactivate','--sync',wins[0]]);
 native(['key','F8']);await page.waitForFunction(()=>Object.values(editHost.renderer.windows).some(w=>/^0 0 0 0 0 37 0 10 /.test(w.title)),{timeout:10000});
 save('native-input.json',{route:'XTEST Ready click / F8 => GetMessage WM_KEYDOWN => application SendMessage EM_GETLINE',window:wins[0]});
 async function sample(stage){await new Promise(r=>setTimeout(r,120));const s=await page.evaluate(()=>{const h=editHost,r=h.renderer,w=Object.values(r.windows).find(w=>w.title==='Authored EDIT wrapped getline'),p=w._backCanvas._waCanonicalPresentation;return {report:Object.values(r.windows).find(w=>w.isChild&&w.x===15&&w.y===330)?.title,rows:Object.values(r.windows).map(v=>({hwnd:v.hwnd,title:v.title,x:v.x,y:v.y,w:v.w,h:v.h,isChild:v.isChild})),gdi:p?{sharedGuestStorage:p.surface.storage.buffer===h.memory.buffer,pixels:Array.from(p.surface.rgbaRect(0,0,w.w,w.h))}:null,pixels:Array.from(w._backCanvas.getContext('2d').getImageData(0,0,w.w,w.h).data),width:w.w,height:w.h};});
 const c=cases[stage],{key,width,top,layout}=c,got=s.report.trim().split(/\s+/).map(Number),state=[0,0,c.single?0:top,c.single?7:c.text.length,0,10,1],bytes=Buffer.alloc(64,165);bytes.writeUInt16LE(c.cap,4);bytes.write(c.want,4,'ascii');
 const want=[stage,stage?256:0,...state,c.want.length,...bytes,...state];
 assert.deepEqual(got.slice(2,9),state,'independent public state before query');assert.deepEqual(got.slice(74),state,'query preserves selection/text/viewport/modify/focus');
 if(JSON.stringify(got)!==JSON.stringify(want))failures.push({stage,got,want});
 assert(s.gdi?.sharedGuestStorage);const pix=Buffer.from(s.pixels),gd=Buffer.from(s.gdi.pixels),surfaces=[];let equal=true;
 // Exclude the two caret columns, never the underlying text/selection body.
 const caret=4;
 for(let row=4;row<81;++row)for(let x=5;x<width-21;++x){const left=((26+40+row)*s.width+6+15+x)*4,right=((26+145+row)*s.width+6+15+x)*4;if(x>=caret-1&&x<caret+1)continue;if(!pix.subarray(left,left+4).equals(pix.subarray(right,right+4)))equal=false;}
 let consumerEqual=true;for(let row=0;row<80;++row)for(let x=0;x<190;++x){const left=((26+40+row)*s.width+6+250+x)*4,right=((26+145+row)*s.width+6+250+x)*4;if(!pix.subarray(left,left+4).equals(pix.subarray(right,right+4)))consumerEqual=false;}if(!consumerEqual)failures.push({stage,consumer:false});
 if(!equal)failures.push({stage,geometry:false});
 for(const [cx,y,cw] of [[15,40,width-26],[15,145,width-26],[250,40,190],[250,145,190]]){const x=6+cx+5,sy=26+y+4,w=cw,h=77,bytes=Buffer.alloc(w*h*4);for(let r=0;r<h;++r){const at=((sy+r)*s.width+x)*4;pix.copy(bytes,r*w*4,at,at+w*4);assert(pix.subarray(at,at+w*4).equals(gd.subarray(at,at+w*4)),'GDI/backcanvas');}surfaces.push({x,y:sy,w,h,bytes});}
 if([0,11,12,13,15,18,20].includes(stage)){await page.screenshot({path:out+'/stage-'+stage+'-composited.png'});require(root+'/tools/browser-transients.cjs').captureWhole(out,'stage-'+stage+'-desktop',display.env);
 const{PNG}=require(root+'/node_modules/pngjs'),composite=PNG.sync.read(fs.readFileSync(out+'/stage-'+stage+'-composited.png')),desktop=PNG.sync.read(fs.readFileSync(out+'/stage-'+stage+'-desktop.png')),frame=s.rows.find(w=>w.title==='Authored EDIT wrapped getline'),g=await page.evaluate(()=>editHost.renderer.canvas.getBoundingClientRect().toJSON());
 const match=(png,v,ox,oy)=>{const x=Math.round(ox+v.x),y=Math.round(oy+v.y);if(x<0||y<0||x+v.w>png.width||y+v.h>png.height)return false;for(let r=0;r<v.h;++r)if(!png.data.subarray(((y+r)*png.width+x)*4,((y+r)*png.width+x+v.w)*4).equals(v.bytes.subarray(r*v.w*4,(r+1)*v.w*4)))return false;return true;};
 assert(surfaces.every(v=>match(composite,v,g.x+frame.x,g.y+frame.y)),'compositor exact');const v=surfaces[0],needle=v.bytes.subarray(6*v.w*4,7*v.w*4);let origin=null;
 for(let at=desktop.data.indexOf(needle);at>=0;at=desktop.data.indexOf(needle,at+1)){if(at%4)continue;const ox=at/4%desktop.width-v.x,oy=Math.floor(at/4/desktop.width)-v.y-6;if(surfaces.every(v=>match(desktop,v,ox,oy))){origin={x:ox,y:oy};break;}}assert(origin,'native desktop exact');save('stage-'+stage+'-visible.json',{origin,exactGDI:true,exactCompositor:true,exactNativeDesktop:true,surfaces:surfaces.map(({bytes,...v})=>({...v,sha256:sha(bytes)}))});}
 states.push({stage,key,got,want,equal,consumerEqual});save('states.json',states);}
 await sample(0);for(let j=1;j<cases.length;++j){native(['key','F8']);await page.waitForFunction(j=>Object.values(editHost.renderer.windows).some(w=>w.title?.startsWith(j+' 256 ')),{timeout:6000},j);await sample(j);}
 const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);const cpuState=await cpu.evaluate(()=>{const names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,registers:Object.fromEntries(names.map(n=>[n,instance.exports[n]()>>>0]))};});save('cpu-state.json',cpuState);assert.equal(cpuState.memoryBytes,536870912);assert.equal(Object.keys(cpuState.registers).length,19);assert(cpuState.registers.get_eip&&cpuState.registers.get_esp);
 await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));save('assertions.json',{expectOld,failures,states:states.length,productionBrowserCPU:true});
 if(expectOld){assert(failures.some(f=>f.got));assert(states.every(s=>s.equal),'old fixed-font visible geometry retained');assert(states.some(s=>!s.consumerEqual),'independent old text/count consumer fails');console.log('PASS physical preedit oldFAIL',failures.length);}else{assert.deepEqual(failures,[]);console.log('PASS EDIT wrapped GETLINE public/native input/fixed GDI references/four planes',states.length);}
 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('transients.json',await transient.cleanup(out));if(display)await display.close();}
}
if(require.main===module)main(process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync('/dev/shm/edit-wrapped-getline-'),{expectOld:process.argv.includes('--expect-old')}).catch(e=>{console.error(e.stack);process.exitCode=1;});module.exports={fixture,main,cases};
