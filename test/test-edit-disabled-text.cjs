'use strict';
// Microsoft WIN32.HLP (1992-1994), topics 215 (WM_ENABLE), 2439/2539
// (COLOR_GRAYTEXT); https://thelp.zdrojak.dev/helps/Borland%20C%2B%2B%204.x/win32.json.gz
// Plain single-line ANSI EDIT, collapsed selection. No disabled selection,
// background or caret contract is asserted. Enabled input is a positive control.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const cases=[{key:'F8'},{key:'x'},{key:'F8'},{key:'F8'},{key:'F8'},{key:'z'}];
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
unsigned short API RegisterClassA(const void*);long API DefWindowProcA(P,U,U,long);P API SetFocus(P);P API GetFocus(void);int API GetDlgCtrlID(P);int API SetWindowTextA(P,const char*);
int API EnableWindow(P,int);int API IsWindowEnabled(P);long API GetWindowLongA(P,int);U API GetSysColor(int);
long API SendMessageA(P,U,U,long);int API GetMessageA(P,P,U,U);int API TranslateMessage(P);long API DispatchMessageA(P);
struct WC{U style;P proc;int cex,wex;P instance,icon,cursor,brush;const char* menu;const char* name;};
struct R{long l,t,r,b;};P API BeginPaint(P,P);int API EndPaint(P,P);int API FillRect(P,struct R*,P);P API GetStockObject(int);int API InvalidateRect(P,P,int);
P API SelectObject(P,P);U API SetTextColor(P,U);int API SetBkMode(P,int);int API TextOutA(P,int,int,const char*,int);
static P frame,edit,other,refs[2],status;static int stage,ready,inputmsg,enableReturn=9;static char report[1000],value[100],side[100];
void number(U n,int* at){char d[12];int k=0;do{d[k++]='0'+n%10;n/=10;}while(n);while(k)report[(*at)++]=d[--k];report[(*at)++]=' ';}
void append(char* s,int* at){for(int j=0;s[j];++j)report[(*at)++]=s[j];report[(*at)++]=' ';}
long __stdcall reference(P h,U m,U w,long l){if(m==15){U ps[16];P dc=BeginPaint(h,ps);int subject=GetDlgCtrlID(h)==30;
 struct R q={0,0,168,28};FillRect(dc,&q,GetStockObject(0));SelectObject(dc,GetStockObject(16));SetBkMode(dc,1);
 SetTextColor(dc,GetSysColor(subject&&stage==2?17:8));
 char* text=subject?(stage==5?"Gray42z":"Gray42"):(stage>=1?"Plain42x":"Plain42");int length=subject?(stage==5?7:6):(stage>=1?8:7);
 TextOutA(dc,4,4,text,length);EndPaint(h,ps);return 0;}return DefWindowProcA(h,m,w,l);}
void publish(void){int at=0;U a=0,b=0;number(stage,&at);number(inputmsg,&at);number(GetDlgCtrlID(GetFocus()),&at);number(enableReturn,&at);number(GetSysColor(17),&at);number(GetSysColor(8),&at);
 P controls[2]={edit,other};char* texts[2]={value,side};for(int j=0;j<2;++j){number(IsWindowEnabled(controls[j]),&at);number(GetWindowLongA(controls[j],-16),&at);
 number(SendMessageA(controls[j],14,0,0),&at);number(SendMessageA(controls[j],13,100,(long)texts[j]),&at);SendMessageA(controls[j],0xb0,(U)&a,(long)&b);number(a,&at);number(b,&at);number(SendMessageA(controls[j],0x31,0,0)==(long)GetStockObject(16),&at);}
 append(value,&at);append(side,&at);report[at]=0;SetWindowTextA(status,report);for(int j=0;j<2;++j)InvalidateRect(refs[j],0,1);}
long __stdcall proc(P h,U m,U w,long l){return DefWindowProcA(h,m,w,l);}
void start(void){P i=GetModuleHandleA(0);struct WC wc={0,proc,0,0,0,0,0,(P)16,0,"DisabledText"};wc.instance=i;RegisterClassA(&wc);wc.proc=reference;wc.name="DisabledReference";RegisterClassA(&wc);
 frame=CreateWindowExA(0,"DisabledText","Authored EDIT disabled text",0x10cf0000,30,30,650,410,0,0,i,0);
 edit=CreateWindowExA(0,"EDIT","Gray42",0x50000080,15,40,168,28,frame,(P)10,i,0);
 other=CreateWindowExA(0,"EDIT","Plain42",0x50000080,15,120,168,28,frame,(P)11,i,0);
 P controls[2]={edit,other};for(int j=0;j<2;++j){SendMessageA(controls[j],0x30,(U)GetStockObject(16),1);SendMessageA(controls[j],0xb1,j?7:6,j?7:6);}
 refs[0]=CreateWindowExA(0,"DisabledReference","",0x50000000,15,75,168,28,frame,(P)30,i,0);
 refs[1]=CreateWindowExA(0,"DisabledReference","",0x50000000,15,155,168,28,frame,(P)31,i,0);
 status=CreateWindowExA(0,"STATIC","READY",0x50000000,15,300,620,70,frame,(P)21,i,0);
 U msg[12];while(GetMessageA(msg,0,0,0)>0){
 if(msg[1]==0x100&&msg[2]==0x77&&!ready){ready=1;SetFocus(other);publish();continue;}
 if(ready&&(msg[1]==0x100||msg[1]==0x101)&&msg[2]==0x78){if(msg[1]==0x100)publish();continue;}
 if(ready&&msg[1]==0x100&&msg[2]==0x77){if(stage==1){stage=2;enableReturn=EnableWindow(edit,0);}else if(stage==2){stage=3;enableReturn=EnableWindow(edit,1);}else if(stage==3){stage=4;SetFocus(edit);}publish();continue;}
 TranslateMessage(msg);DispatchMessageA(msg);if(ready&&(msg[1]==0x100||msg[1]==0x101)){inputmsg=msg[1];if(msg[1]==0x101&&msg[2]=='X'&&stage==0)stage=1;if(msg[1]==0x101&&msg[2]=='Z'&&stage==4)stage=5;publish();}}
}
`;
function fixture(out){
 fs.writeFileSync(out+'/fixture.c',source);
 const imports={kernel32:['GetModuleHandleA@4'],user32:['CreateWindowExA@48','RegisterClassA@4','DefWindowProcA@16','SetFocus@4','GetFocus@0','GetDlgCtrlID@4','SetWindowTextA@8','SendMessageA@16','GetMessageA@16','TranslateMessage@4','DispatchMessageA@4','EnableWindow@8','IsWindowEnabled@4','GetWindowLongA@8','GetSysColor@4','BeginPaint@8','EndPaint@8','FillRect@12','InvalidateRect@12'],gdi32:['GetStockObject@4','SelectObject@8','SetTextColor@8','SetBkMode@8','TextOutA@20']};
 for(const[dll,names]of Object.entries(imports)){fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/fixture.c','-o',out+'/fixture.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/edit-disabled-text.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib',out+'/gdi32.lib']);return fs.readFileSync(out+'/edit-disabled-text.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n');
 save('deadlines.json',{protocolMs:120000,readinessMs:120000,actionReadinessMs:90000,nativeActionMs:15000,finiteStages:cases.length});
 const runtime=require(root+'/tools/boids-current-runtime.cjs'),commit=process.env.EDIT_DISABLED_TEXT_COMMIT||cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files=runtime.gitFiles(commit),own='src/09c3-wndprocs5-edit.wat';files.set(own,fs.readFileSync(root+'/'+own));
 if(process.env.EDIT_DISABLED_TEXT_SHARED)for(const n of files.keys())if(fs.existsSync(root+'/'+n))files.set(n,fs.readFileSync(root+'/'+n));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{maxBuffer:8e6}));
 const wasm=process.env.EDIT_DISABLED_TEXT_MODULE?fs.readFileSync(process.env.EDIT_DISABLED_TEXT_MODULE):runtime.compile(files),pe=fixture(out);fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));files.set('build/wine-assembly.wasm',wasm);files.set('edit-disabled-text.exe',pe);
 save('runtime.json',{commit,expectOld,moduleSHA256:sha(wasm),peSHA256:sha(pe),cases,files:[...files].map(([name,b])=>({name,size:b.length,sha256:sha(b)}))});
 const transient=require(root+'/tools/browser-transients.cjs').create(),logs=[],pending=[],workers=[],failures=[],states=[];let display,browser,wait,server;
 try{
 server=http.createServer((req,res)=>{const n=new URL(req.url,'http://local').pathname.slice(1)||'index.html',b=files.get(n);res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.html')?'text/html':n.endsWith('.css')?'text/css':n.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.statusCode=b?200:404;res.end(b||'missing');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 display=await require(root+'/tools/gltron-headful-display.cjs').start(out);
 browser=await require(root+'/node_modules/puppeteer').launch({headless:false,defaultViewport:{width:1050,height:800},env:transient.env(display.env),userDataDir:transient.profile,executablePath:'/opt/google/chrome/chrome',args:[...transient.args,'--no-sandbox','--disable-dev-shm-usage','--disable-component-update','--disable-background-networking'],protocolTimeout:120000});wait=transient.watch(browser.process());browser.process().stdout?.resume();browser.process().stderr?.resume();save('browser-version.json',{version:await browser.version()});
 const page=await browser.newPage();page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>logs.push(String(e)));
 page.on('workercreated',w=>{const row={url:w.url(),modules:[]};workers.push(row);const c=w.client;c.on('Debugger.scriptParsed',v=>{if(v.scriptLanguage==='WebAssembly'||v.url.startsWith('wasm://'))pending.push(c.send('Debugger.getScriptSource',{scriptId:v.scriptId}).then(r=>row.modules.push(sha(Buffer.from(r.bytecode,'base64')))));});pending.push(c.send('Debugger.enable'));});
 await page.evaluateOnNewDocument(()=>localStorage.setItem('wine-assembly.threads','1'));await page.goto('http://127.0.0.1:'+server.address().port+'/?debug&threads&no-log');await page.waitForFunction(()=>typeof WineAssembly==='function');
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=700;c.style='position:fixed;left:0;top:0;z-index:99999;width:1000px;height:700px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.editHost=new WineAssembly();editHost.renderer=new Win98Renderer(c);await editHost.init(c);if(!editHost.guestWorker)throw Error('production Worker required');await editHost.loadExe('/edit-disabled-text.exe');editHost.run();});

 await page.waitForFunction(()=>Object.values(editHost.renderer.windows).some(w=>w.title==='READY'),{timeout:120000});
 await page.evaluate(()=>{browserInput.wireCanvasInput(editHost.renderer.canvas,editHost.renderer,{runningApps:[{wine:editHost}],debugMode:true});editHost.renderer.canvas.focus();});
 const native=args=>cp.execFileSync('xdotool',args,{env:display.env,timeout:15000}),wins=native(['search','--onlyvisible','--pid',String(browser.process().pid),'--class','chrome']).toString().trim().split(/\s+/);assert.equal(wins.length,1);native(['windowactivate','--sync',wins[0]]);
 native(['key','F8']);await page.waitForFunction(()=>Object.values(editHost.renderer.windows).some(w=>/^0 257 11 /.test(w.title)),{timeout:120000});
 save('native-input.json',{route:'private X11 XTEST F8/F9 => public GetMessage, EnableWindow, IsWindowEnabled, GetWindowLongA, WM_GETTEXT, EM_GETSEL, WM_GETFONT',window:wins[0]});
 const geometry=await page.evaluate(()=>{const r=editHost.renderer,w=Object.values(r.windows).find(w=>w.title==='Authored EDIT disabled text');return {frame:{hwnd:w.hwnd,x:w.x,y:w.y},canvas:r.canvas.getBoundingClientRect().toJSON()};});
 let nativeOrigin=null;
 async function sample(stage){
 native(['key','F9']);await new Promise(r=>setTimeout(r,250));
 const s=await page.evaluate(()=>{const encode=a=>{let s="";for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode(...a.subarray(i,i+8192));return btoa(s);};const h=editHost,r=h.renderer,w=Object.values(r.windows).find(w=>w.title==='Authored EDIT disabled text'),p=w._backCanvas._waCanonicalPresentation;return {report:Object.values(r.windows).find(w=>w.isChild&&w.x===15&&w.y===300)?.title,rows:Object.values(r.windows).map(v=>({hwnd:v.hwnd,title:v.title,x:v.x,y:v.y,w:v.w,h:v.h,isChild:v.isChild})),gdi:p?{sharedGuestStorage:p.surface.storage.buffer===h.memory.buffer,pixels:encode(p.surface.rgbaRect(0,0,w.w,w.h))}:null,pixels:encode(w._backCanvas.getContext('2d').getImageData(0,0,w.w,w.h).data),width:w.w,height:w.h};});

 save('stage-'+stage+'-public.json',{report:s.report,rows:s.rows});
 const got=s.report.trim().split(/\s+/),nums=got.slice(0,20).map(Number),texts=got.slice(20);
 const subjectLength=stage===5?7:6,otherLength=stage>=1?8:7,disabled=stage===2;
 const want=[stage,257,stage>=4?10:11,stage<2?9:stage===2?0:1,0x808080,0,
 disabled?0:1,disabled?0x58000080:0x50000080,subjectLength,subjectLength,subjectLength,subjectLength,1,
 1,0x50000080,otherLength,otherLength,otherLength,otherLength,1];
 assert.deepEqual(nums,want,'public enabled/style/text/selection/font state and transition return');
 assert.deepEqual(texts,[stage===5?'Gray42z':'Gray42',stage>=1?'Plain42x':'Plain42']);

 assert(s.gdi?.sharedGuestStorage);const pix=Buffer.from(s.pixels,'base64'),gd=Buffer.from(s.gdi.pixels,'base64'),surfaces=[];
 function crop(x,y,w,h){const bytes=Buffer.alloc(w*h*4);for(let r=0;r<h;++r){const at=((y+r)*s.width+x)*4;pix.copy(bytes,r*w*4,at,at+w*4);assert(pix.subarray(at,at+w*4).equals(gd.subarray(at,at+w*4)),'GDI/backcanvas');}const v={x,y,w,h,bytes};surfaces.push(v);return bytes;}
 // Fixed SYSTEM_FIXED_FONT text rectangles, independent authored GDI references.
 // Both exclude the collapsed caret endpoint (x>=52 / x>=60 / x>=68).
 const matches=[];for(const [y,ref,width]of [[40,75,stage===5?55:47],[120,155,stage>=1?63:55]]){
 const subject=crop(6+15+4,26+y+4,width,13),reference=crop(6+15+4,26+ref+4,width,13);matches.push(subject.equals(reference));}
 if(!matches[0])failures.push({stage,disabledTextColor:true});
 assert.equal(matches[0],!(expectOld&&stage===2),'EDIT text versus fixed system-color GDI reference');
 assert(matches[1],'ordinary enabled EDIT and native typing positive control');

 await page.screenshot({path:out+'/stage-'+stage+'-composited.png'});require(root+'/tools/browser-transients.cjs').captureWhole(out,'stage-'+stage+'-desktop',display.env);
 const{PNG}=require(root+'/node_modules/pngjs'),composite=PNG.sync.read(fs.readFileSync(out+'/stage-'+stage+'-composited.png')),desktop=PNG.sync.read(fs.readFileSync(out+'/stage-'+stage+'-desktop.png'));
 const match=(png,v,ox,oy)=>{const x=Math.round(ox+v.x),y=Math.round(oy+v.y);if(x<0||y<0||x+v.w>png.width||y+v.h>png.height)return false;for(let r=0;r<v.h;++r)if(!png.data.subarray(((y+r)*png.width+x)*4,((y+r)*png.width+x+v.w)*4).equals(v.bytes.subarray(r*v.w*4,(r+1)*v.w*4)))return false;return true;};
 assert(surfaces.every(v=>match(composite,v,geometry.canvas.x+geometry.frame.x,geometry.canvas.y+geometry.frame.y)),'compositor exact');
 if(!nativeOrigin){const v=surfaces[0],needle=v.bytes.subarray(6*v.w*4,7*v.w*4);for(let at=desktop.data.indexOf(needle);at>=0;at=desktop.data.indexOf(needle,at+1)){if(at%4)continue;const ox=at/4%desktop.width-v.x,oy=Math.floor(at/4/desktop.width)-v.y-6;if(surfaces.every(v=>match(desktop,v,ox,oy))){nativeOrigin={x:ox,y:oy};break;}}}
 assert(nativeOrigin&&surfaces.every(v=>match(desktop,v,nativeOrigin.x,nativeOrigin.y)),'native desktop exact at fixed origin');
 save('stage-'+stage+'-visible.json',{nativeOrigin,exactGDI:true,exactCompositor:true,exactNativeDesktop:true,surfaces:surfaces.map(({bytes,...v})=>({...v,sha256:sha(bytes)}))});
 states.push({stage,key:cases[stage].key,got,want,matches});save('states.json',states);
 }
 await sample(0);for(let j=1;j<cases.length;++j){native(['key',cases[j].key]);await page.waitForFunction(j=>Object.values(editHost.renderer.windows).some(w=>w.title?.startsWith(j+' 257 ')),{timeout:90000},j);await sample(j);}
 const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);const cpuState=await cpu.evaluate(()=>{const names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,registers:Object.fromEntries(names.map(n=>[n,instance.exports[n]()>>>0]))};});save('cpu-state.json',cpuState);assert.equal(cpuState.memoryBytes,536870912);assert.equal(Object.keys(cpuState.registers).length,19);assert(cpuState.registers.get_eip&&cpuState.registers.get_esp);
 const controls=await page.evaluate(()=>Object.values(editHost.renderer.windows).filter(w=>w.isChild&&((w.x===15&&[40,120].includes(w.y))||(w.x===250&&w.y===40))).map(w=>({hwnd:w.hwnd,x:w.x,y:w.y})));
 const nativeControls=await cpu.evaluate(rows=>rows.map(r=>({...r,cls:instance.exports.ctrl_get_class(r.hwnd),live:instance.exports.wnd_lookup_live(r.hwnd)})),controls);save('native-controls.json',nativeControls);assert.equal(nativeControls.length,2);assert(nativeControls.every(r=>r.cls===2&&r.live===1));
 await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));save('assertions.json',{expectOld,failures,states:states.length,productionBrowserCPU:true});
 if(expectOld){assert.deepEqual(failures.map(f=>f.stage),[2]);console.log('PASS physical preedit oldFAIL',failures.length);}else{assert.deepEqual(failures,[]);console.log('PASS disabled text/reenable/public state/native input/four planes',states.length);}
 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));if(process.env.EDIT_DISABLED_TEXT_RETAIN_TRANSIENTS)save('deferred-transients.json',{root:transient.root,downloads:transient.downloads});else save('transients.json',await transient.cleanup(out));if(display)await display.close();}
}
if(require.main===module)main(process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync('/dev/shm/edit-disabled-text-'),{expectOld:process.argv.includes('--expect-old')}).catch(e=>{console.error(e.stack);process.exitCode=1;});module.exports={fixture,main,cases};




