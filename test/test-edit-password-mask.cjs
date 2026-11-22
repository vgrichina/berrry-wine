'use strict';
// Microsoft Windows 3.1 Programmer's Reference vol 3 (1992), pp46,55-56:
// https://bitsavers.trailing-edge.com/pdf/microsoft/windows_3.1/Windows_3.1_Programmers_Reference_Volume_3_Messages_Structures_and_Macros_1992.pdf
// Default '*', public getter, custom character, zero reveals, redraw on receipt.
// Plain ANSI singleline printable ASCII, fixed stock fonts only; no clipboard policy.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const cases=[
  {
    "key": "",
    "text": "MiXeD",
    "mask": 42,
    "a": 0,
    "b": 0,
    "other": 0,
    "font": 16
  },
  {
    "key": "F8",
    "text": "MiXeD",
    "mask": 63,
    "a": 0,
    "b": 0,
    "other": 0,
    "font": 16
  },
  {
    "key": "F8",
    "text": "MiXeD",
    "mask": 63,
    "a": 1,
    "b": 4,
    "other": 0,
    "font": 16
  },
  {
    "key": "x",
    "text": "MxD",
    "mask": 63,
    "a": 2,
    "b": 2,
    "other": 0,
    "font": 16
  },
  {
    "key": "BackSpace",
    "text": "MD",
    "mask": 63,
    "a": 1,
    "b": 1,
    "other": 0,
    "font": 16
  },
  {
    "key": "Delete",
    "text": "M",
    "mask": 63,
    "a": 1,
    "b": 1,
    "other": 0,
    "font": 16
  },
  {
    "key": "F8",
    "text": "M",
    "mask": 0,
    "a": 1,
    "b": 1,
    "other": 0,
    "font": 16
  },
  {
    "key": "F8",
    "text": "WiWi",
    "mask": 35,
    "a": 2,
    "b": 2,
    "other": 42,
    "font": 16
  },
  {
    "key": "F8",
    "text": "WiWi",
    "mask": 64,
    "a": 2,
    "b": 2,
    "other": 0,
    "font": 16
  },
  {
    "key": "F8",
    "text": "WiWi",
    "mask": 0,
    "a": 0,
    "b": 4,
    "other": 0,
    "font": 11
  },
  {
    "key": "F8",
    "text": "WiWi",
    "mask": 42,
    "a": 0,
    "b": 0,
    "other": 0,
    "font": 16
  },
  {
    "key": "F8",
    "text": "WiWi",
    "mask": 0,
    "a": 0,
    "b": 0,
    "other": 33,
    "font": 16
  }
];
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
unsigned short API RegisterClassA(const void*);long API DefWindowProcA(P,U,U,long);P API SetFocus(P);P API GetFocus(void);int API GetDlgCtrlID(P);int API SetWindowTextA(P,const char*);
long API SendMessageA(P,U,U,long);long API GetWindowLongA(P,int);int API GetCaretPos(P);int API GetMessageA(P,P,U,U);int API TranslateMessage(P);long API DispatchMessageA(P);
struct WC{U style;P proc;int cex,wex;P instance,icon,cursor,brush;const char* menu;const char* name;};
struct R{long l,t,r,b;};P API BeginPaint(P,P);int API EndPaint(P,P);int API FillRect(P,struct R*,P);P API GetStockObject(int);int API InvalidateRect(P,P,int);
P API SelectObject(P,P);U API SetTextColor(P,U);int API SetBkMode(P,int);int API TextOutA(P,int,int,const char*,int);P API CreateSolidBrush(U);int API DeleteObject(P);
static P frame,edit,other,refs[4],status;static int stage,ready,inputmsg;
static char report[1000],value[100],side[100];static U lengths[12]={5,5,5,3,2,1,1,4,4,4,4,4},masks[12]={42,63,63,63,63,63,0,35,64,0,42,0},anchors[12]={0,0,1,2,1,1,1,2,2,0,0,0},cursors[12]={0,0,4,2,1,1,1,2,2,4,0,0},others[12]={0,0,0,0,0,0,0,42,0,0,0,33},fonts[12]={16,16,16,16,16,16,16,16,16,11,16,16};
static char* texts[12]={"MiXeD","MiXeD","MiXeD","MxD","MD","M","M","WiWi","WiWi","WiWi","WiWi","WiWi"};
void number(U n,int* at){char d[12];int k=0;do{d[k++]='0'+n%10;n/=10;}while(n);while(k)report[(*at)++]=d[--k];report[(*at)++]=' ';}
void append(char* s,int* at){for(int j=0;s[j];++j)report[(*at)++]=s[j];report[(*at)++]=' ';}
void fill(P dc,int l,int t,int r,int b,P brush){struct R q={l,t,r,b};FillRect(dc,&q,brush);}
long __stdcall reference(P h,U m,U w,long l){if(m==15){U ps[16];P dc=BeginPaint(h,ps);int id=GetDlgCtrlID(h),a=0,b=0,n=0;char buf[100];U font=fonts[stage];
 if(id==30){n=lengths[stage];a=anchors[stage];b=cursors[stage];for(int j=0;j<n;++j)buf[j]=masks[stage]?masks[stage]:texts[stage][j];}
 if(id==31){n=4;font=16;for(int j=0;j<4;++j)buf[j]=others[stage]?others[stage]:"SIDE"[j];}
 if(id==32){n=SendMessageA(edit,13,100,(long)buf);}
 if(id==33){n=lengths[stage];for(int j=0;j<n;++j)buf[j]=texts[stage][j];}
 fill(dc,0,0,168,28,GetStockObject(0));SelectObject(dc,GetStockObject(font));SetBkMode(dc,1);SetTextColor(dc,0);
 if(a>b){int q=a;a=b;b=q;}if(a<b){P brush=CreateSolidBrush(0x800000);fill(dc,4+a*8,2,4+b*8,17,brush);DeleteObject(brush);}
 if(a)TextOutA(dc,4,4,buf,a);if(a<b){SetTextColor(dc,0xffffff);TextOutA(dc,4+a*8,4,buf+a,b-a);SetTextColor(dc,0);}if(b<n)TextOutA(dc,4+b*8,4,buf+b,n-b);
 EndPaint(h,ps);return 0;}return DefWindowProcA(h,m,w,l);}
void publish(void){int at=0;U a=0,b=0;number(stage,&at);number(inputmsg,&at);number(GetDlgCtrlID(GetFocus()),&at);
 number(SendMessageA(edit,0xd2,0,0),&at);number(SendMessageA(edit,0xd2,0,0),&at);
 number(SendMessageA(edit,14,0,0),&at);number(SendMessageA(edit,13,100,(long)value),&at);SendMessageA(edit,0xb0,(U)&a,(long)&b);number(a,&at);number(b,&at);
 number(GetWindowLongA(edit,-16)&32,&at);number(SendMessageA(other,0xd2,0,0),&at);number(SendMessageA(other,13,100,(long)side),&at);U point[2];GetCaretPos(point);number(point[0],&at);number(point[1],&at);append(value,&at);append(side,&at);
 report[at]=0;SetWindowTextA(status,report);for(int j=0;j<4;++j)InvalidateRect(refs[j],0,1);}
void apply(void){
 if(stage==1)SendMessageA(edit,0xcc,'?',0);
 if(stage==2)SendMessageA(edit,0xb1,1,4);
 if(stage==6)SendMessageA(edit,0xcc,0,0);
 if(stage==7){SendMessageA(edit,12,0,(long)"WiWi");SendMessageA(edit,0xcc,'#',0);SendMessageA(edit,0xb1,2,2);SendMessageA(other,0xcc,'*',0);}
 if(stage==8){SendMessageA(edit,0xcc,'@',0);SendMessageA(other,0xcc,0,0);}
 if(stage==9){SendMessageA(edit,0xcc,0,0);SendMessageA(edit,0x30,(U)GetStockObject(11),1);SendMessageA(edit,0xb1,0,4);}
 if(stage==10){SendMessageA(edit,0x30,(U)GetStockObject(16),1);SendMessageA(edit,0xcc,'*',0);SendMessageA(edit,0xb1,0,0);}
 if(stage==11){SendMessageA(edit,0xcc,0,0);SendMessageA(other,0xcc,'!',0);}
}
long __stdcall proc(P h,U m,U w,long l){return DefWindowProcA(h,m,w,l);}
void start(void){P i=GetModuleHandleA(0);struct WC wc={0,proc,0,0,0,0,0,(P)16,0,"EditPassword"};wc.instance=i;RegisterClassA(&wc);wc.proc=reference;wc.name="PasswordReference";RegisterClassA(&wc);
 frame=CreateWindowExA(0,"EditPassword","Authored EDIT password",0x10cf0000,30,30,650,410,0,0,i,0);
 edit=CreateWindowExA(0,"EDIT","MiXeD",0x500100a0,15,40,168,28,frame,(P)10,i,0);SendMessageA(edit,0x30,(U)GetStockObject(16),1);SendMessageA(edit,0xb1,0,0);
 other=CreateWindowExA(0,"EDIT","SIDE",0x50000080,15,120,168,28,frame,(P)11,i,0);SendMessageA(other,0x30,(U)GetStockObject(16),1);
 refs[0]=CreateWindowExA(0,"PasswordReference","",0x50000000,15,75,168,28,frame,(P)30,i,0);
 refs[1]=CreateWindowExA(0,"PasswordReference","",0x50000000,15,155,168,28,frame,(P)31,i,0);
 refs[2]=CreateWindowExA(0,"PasswordReference","",0x50000000,250,40,168,28,frame,(P)32,i,0);
 refs[3]=CreateWindowExA(0,"PasswordReference","",0x50000000,250,75,168,28,frame,(P)33,i,0);
 status=CreateWindowExA(0,"STATIC","READY",0x50000000,15,300,600,50,frame,(P)21,i,0);
 U msg[12];while(GetMessageA(msg,0,0,0)>0){if(msg[1]==0x100&&msg[2]==0x77&&!ready){ready=1;SetFocus(edit);publish();continue;}
 if(ready&&(msg[1]==0x100||msg[1]==0x101)&&msg[2]==0x78){if(msg[1]==0x100)publish();continue;}
 if(ready&&msg[1]==0x100){++stage;apply();}TranslateMessage(msg);DispatchMessageA(msg);
 if(ready&&(msg[1]==0x100||msg[1]==0x101||msg[1]==0x102)){inputmsg=msg[1];publish();}}
}`;
function fixture(out){
 fs.writeFileSync(out+'/fixture.c',source);
 const imports={kernel32:['GetModuleHandleA@4'],user32:['CreateWindowExA@48','RegisterClassA@4','DefWindowProcA@16','SetFocus@4','GetFocus@0','GetDlgCtrlID@4','SetWindowTextA@8','SendMessageA@16','GetMessageA@16','TranslateMessage@4','DispatchMessageA@4','IsDialogMessageA@8','GetWindowLongA@8','GetCaretPos@4','BeginPaint@8','EndPaint@8','FillRect@12','InvalidateRect@12'],gdi32:['GetStockObject@4','SelectObject@8','SetTextColor@8','SetBkMode@8','TextOutA@20','CreateSolidBrush@4','DeleteObject@4']};
 for(const[dll,names]of Object.entries(imports)){fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/fixture.c','-o',out+'/fixture.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/edit-password-mask.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib',out+'/gdi32.lib']);return fs.readFileSync(out+'/edit-password-mask.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n');
 save('deadlines.json',{protocolMs:120000,readinessMs:120000,actionReadinessMs:90000,nativeActionMs:15000,finiteStages:cases.length});
 const runtime=require(root+'/tools/boids-current-runtime.cjs'),commit=process.env.EDIT_PASSWORD_COMMIT||cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files=runtime.gitFiles(commit),own='src/09c3-wndprocs5-edit.wat';files.set(own,fs.readFileSync(root+'/'+own));
 if(process.env.EDIT_PASSWORD_SHARED)for(const n of files.keys())if(fs.existsSync(root+'/'+n))files.set(n,fs.readFileSync(root+'/'+n));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{maxBuffer:8e6}));
 const wasm=process.env.EDIT_PASSWORD_MODULE?fs.readFileSync(process.env.EDIT_PASSWORD_MODULE):runtime.compile(files),pe=fixture(out);fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));files.set('build/wine-assembly.wasm',wasm);files.set('edit-password-mask.exe',pe);
 save('runtime.json',{commit,expectOld,moduleSHA256:sha(wasm),peSHA256:sha(pe),cases,files:[...files].map(([name,b])=>({name,size:b.length,sha256:sha(b)}))});
 const transient=require(root+'/tools/browser-transients.cjs').create(),logs=[],pending=[],workers=[],failures=[],states=[];let display,browser,wait,server;
 try{
 server=http.createServer((req,res)=>{const n=new URL(req.url,'http://local').pathname.slice(1)||'index.html',b=files.get(n);res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.html')?'text/html':n.endsWith('.css')?'text/css':n.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.statusCode=b?200:404;res.end(b||'missing');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 display=await require(root+'/tools/gltron-headful-display.cjs').start(out);
 browser=await require(root+'/node_modules/puppeteer').launch({headless:false,defaultViewport:{width:1050,height:800},env:transient.env(display.env),userDataDir:transient.profile,executablePath:'/opt/google/chrome/chrome',args:[...transient.args,'--no-sandbox','--disable-dev-shm-usage','--disable-component-update','--disable-background-networking'],protocolTimeout:120000});wait=transient.watch(browser.process());browser.process().stdout?.resume();browser.process().stderr?.resume();save('browser-version.json',{version:await browser.version()});
 const page=await browser.newPage();page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>logs.push(String(e)));
 page.on('workercreated',w=>{const row={url:w.url(),modules:[]};workers.push(row);const c=w.client;c.on('Debugger.scriptParsed',v=>{if(v.scriptLanguage==='WebAssembly'||v.url.startsWith('wasm://'))pending.push(c.send('Debugger.getScriptSource',{scriptId:v.scriptId}).then(r=>row.modules.push(sha(Buffer.from(r.bytecode,'base64')))));});pending.push(c.send('Debugger.enable'));});
 await page.evaluateOnNewDocument(()=>localStorage.setItem('wine-assembly.threads','1'));await page.goto('http://127.0.0.1:'+server.address().port+'/?debug&threads&no-log');await page.waitForFunction(()=>typeof WineAssembly==='function');
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=700;c.style='position:fixed;left:0;top:0;z-index:99999;width:1000px;height:700px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.editHost=new WineAssembly();editHost.renderer=new Win98Renderer(c);await editHost.init(c);if(!editHost.guestWorker)throw Error('production Worker required');await editHost.loadExe('/edit-password-mask.exe');editHost.run();});

 await page.waitForFunction(()=>Object.values(editHost.renderer.windows).some(w=>w.title==='READY'),{timeout:120000});
 await page.evaluate(()=>{browserInput.wireCanvasInput(editHost.renderer.canvas,editHost.renderer,{runningApps:[{wine:editHost}],debugMode:true});editHost.renderer.canvas.focus();});
 const native=args=>cp.execFileSync('xdotool',args,{env:display.env,timeout:15000}),wins=native(['search','--onlyvisible','--pid',String(browser.process().pid),'--class','chrome']).toString().trim().split(/\s+/);assert.equal(wins.length,1);native(['windowactivate','--sync',wins[0]]);
 native(['key','F8']);await page.waitForFunction(()=>Object.values(editHost.renderer.windows).some(w=>/^0 257 10 /.test(w.title)),{timeout:120000});
 save('native-input.json',{route:'private X11 XTEST F8/x/BackSpace/Delete/F9 => GetMessage/TranslateMessage/DispatchMessage => public EDIT messages',window:wins[0]});
 const geometry=await page.evaluate(()=>{const r=editHost.renderer,w=Object.values(r.windows).find(w=>w.title==='Authored EDIT password');return {frame:{hwnd:w.hwnd,x:w.x,y:w.y},canvas:r.canvas.getBoundingClientRect().toJSON()};});
 let nativeOrigin=null;
 async function sample(stage){
 native(['key','F9']);await new Promise(r=>setTimeout(r,250));
 const s=await page.evaluate(()=>{const encode=a=>{let s="";for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode(...a.subarray(i,i+8192));return btoa(s);};const h=editHost,r=h.renderer,w=Object.values(r.windows).find(w=>w.title==='Authored EDIT password'),p=w._backCanvas._waCanonicalPresentation;return {report:Object.values(r.windows).find(w=>w.isChild&&w.x===15&&w.y===300)?.title,rows:Object.values(r.windows).map(v=>({hwnd:v.hwnd,title:v.title,x:v.x,y:v.y,w:v.w,h:v.h,isChild:v.isChild})),gdi:p?{sharedGuestStorage:p.surface.storage.buffer===h.memory.buffer,pixels:encode(p.surface.rgbaRect(0,0,w.w,w.h))}:null,pixels:encode(w._backCanvas.getContext('2d').getImageData(0,0,w.w,w.h).data),width:w.w,height:w.h};});
 const c=cases[stage],got=s.report.trim().split(/\s+/),nums=got.slice(0,14).map(Number),want=[stage,257,10,c.mask,c.mask,c.text.length,c.text.length,Math.min(c.a,c.b),Math.max(c.a,c.b),c.mask?32:0,c.other,4,4+c.b*8,2];
 // Text/selection/focus/caret are independent public observations, including old build.
 assert.deepEqual(nums.filter((_,i)=>![3,4,9,10].includes(i)),want.filter((_,i)=>![3,4,9,10].includes(i)),'underlying public text/selection/focus/caret geometry');
 assert.deepEqual(got.slice(14),[c.text,'SIDE'],'WM_GETTEXT remains the secret, independent control unchanged');
 if(JSON.stringify(nums)!==JSON.stringify(want))failures.push({stage,publicMask:true,got:nums,want});
 assert(s.gdi?.sharedGuestStorage);const pix=Buffer.from(s.pixels,'base64'),gd=Buffer.from(s.gdi.pixels,'base64'),surfaces=[];
 const caret=4+c.b*8,segments=[[5,Math.max(5,caret-1)],[Math.max(5,caret+2),163]].filter(([a,b])=>b>a);
 function crop(x,y,w,h){const bytes=Buffer.alloc(w*h*4);for(let r=0;r<h;++r){const at=((y+r)*s.width+x)*4;pix.copy(bytes,r*w*4,at,at+w*4);assert(pix.subarray(at,at+w*4).equals(gd.subarray(at,at+w*4)),'GDI/backcanvas');}const v={x,y,w,h,bytes};surfaces.push(v);return bytes;}
 let equal=true;for(const [a,b]of segments)if(!crop(6+15+a,26+40+4,b-a,13).equals(crop(6+15+a,26+75+4,b-a,13)))equal=false;
 const otherEqual=crop(6+15+5,26+120+4,158,13).equals(crop(6+15+5,26+155+4,158,13));
 const consumerEqual=crop(6+250+5,26+40+4,158,13).equals(crop(6+250+5,26+75+4,158,13));
 if(!equal||!otherEqual)failures.push({stage,maskedGeometry:true,equal,otherEqual});
 assert(consumerEqual,'independent unmasked public WM_GETTEXT consumer');
 await page.screenshot({path:out+'/stage-'+stage+'-composited.png'});require(root+'/tools/browser-transients.cjs').captureWhole(out,'stage-'+stage+'-desktop',display.env);
 const{PNG}=require(root+'/node_modules/pngjs'),composite=PNG.sync.read(fs.readFileSync(out+'/stage-'+stage+'-composited.png')),desktop=PNG.sync.read(fs.readFileSync(out+'/stage-'+stage+'-desktop.png'));
 const match=(png,v,ox,oy)=>{const x=Math.round(ox+v.x),y=Math.round(oy+v.y);if(x<0||y<0||x+v.w>png.width||y+v.h>png.height)return false;for(let r=0;r<v.h;++r)if(!png.data.subarray(((y+r)*png.width+x)*4,((y+r)*png.width+x+v.w)*4).equals(v.bytes.subarray(r*v.w*4,(r+1)*v.w*4)))return false;return true;};
 assert(surfaces.every(v=>match(composite,v,geometry.canvas.x+geometry.frame.x,geometry.canvas.y+geometry.frame.y)),'compositor exact');
 if(!nativeOrigin){const v=surfaces.find(v=>v.w===158),needle=v.bytes.subarray(6*v.w*4,7*v.w*4);for(let at=desktop.data.indexOf(needle);at>=0;at=desktop.data.indexOf(needle,at+1)){if(at%4)continue;const ox=at/4%desktop.width-v.x,oy=Math.floor(at/4/desktop.width)-v.y-6;if(surfaces.every(v=>match(desktop,v,ox,oy))){nativeOrigin={x:ox,y:oy};break;}}}
 assert(nativeOrigin&&surfaces.every(v=>match(desktop,v,nativeOrigin.x,nativeOrigin.y)),'native desktop exact at fixed origin');
 save('stage-'+stage+'-visible.json',{nativeOrigin,exactGDI:true,exactCompositor:true,exactNativeDesktop:true,surfaces:surfaces.map(({bytes,...v})=>({...v,sha256:sha(bytes)}))});
 states.push({stage,key:c.key,got,want,equal,otherEqual,consumerEqual});save('states.json',states);
 }
 await sample(0);for(let j=1;j<cases.length;++j){native(['key',cases[j].key]);await page.waitForFunction(j=>Object.values(editHost.renderer.windows).some(w=>w.title?.startsWith(j+' 257 10 ')),{timeout:90000},j);await sample(j);}
 const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);const cpuState=await cpu.evaluate(()=>{const names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,registers:Object.fromEntries(names.map(n=>[n,instance.exports[n]()>>>0]))};});save('cpu-state.json',cpuState);assert.equal(cpuState.memoryBytes,536870912);assert.equal(Object.keys(cpuState.registers).length,19);assert(cpuState.registers.get_eip&&cpuState.registers.get_esp);
 await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));save('assertions.json',{expectOld,failures,states:states.length,productionBrowserCPU:true});
 if(expectOld){assert(failures.some(f=>f.publicMask));assert(failures.some(f=>f.maskedGeometry));console.log('PASS physical preedit oldFAIL',failures.length);}else{assert.deepEqual(failures,[]);console.log('PASS EDIT password masking/getter/text/selection/native typing/deletion/caret/four planes',states.length);}
 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('transients.json',await transient.cleanup(out));if(display)await display.close();}
}
if(require.main===module)main(process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync('/dev/shm/edit-password-mask-'),{expectOld:process.argv.includes('--expect-old')}).catch(e=>{console.error(e.stack);process.exitCode=1;});module.exports={fixture,main,cases};

