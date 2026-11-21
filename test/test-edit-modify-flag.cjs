'use strict';
// Public modification lifecycle on production native plain CLASS2 EDIT.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
// Microsoft primary: https://learn.microsoft.com/en-us/windows/win32/controls/em-getmodify
// https://learn.microsoft.com/en-us/windows/win32/controls/em-setmodify
// https://learn.microsoft.com/en-us/windows/win32/controls/edit-controls-text-operations
// https://learn.microsoft.com/en-us/windows/win32/controls/em-replacesel
// https://learn.microsoft.com/en-us/windows/win32/winmsg/wm-settext
// Plain ANSI ASCII CLASS2 only. No undo/notification or same-text replacement oracle.
// BOOL flags normalized. WM_SETTEXT reset follows requested lifecycle.
const cases=[
 {"text":"","ops":"S(0xb9,1,0);Q();S(0xb9,0,0);Q();","want":"","sel":[0,0],"flags":[0,1,0,0],"ro":false,"single":true},
 {"text":"A\r\nB\r\nC\r\nD","ops":"S(0xb1,0,0);S(0xb6,0,2);S(0xb9,1,0);Q();S(0xb9,0,0);Q();","want":"A\r\nB\r\nC\r\nD","sel":[0,0],"flags":[0,1,0,0],"viewport":2,"count":4},
 {"text":"SAVE","ops":"S(0xb9,1,0);Q();S(0xb9,0,0);Q();","want":"SAVE","sel":[4,4],"flags":[0,1,0,0],"ro":false,"single":true},
 {"text":"SAVE","ops":"S(0xb9,2,0);Q();S(0xb9,0x80000000,0);Q();S(0xb9,1,0);Q();","want":"SAVE","sel":[4,4],"flags":[0,1,1,1,1],"ro":false,"single":true},
 {"text":"SAVE","ops":"S(0xb1,1,3);S(0x301,0,0);S(0xb1,4,4);S(0x302,0,0);Q();S(0xb9,0,0);S(0xb1,1,3);S(0x300,0,0);Q();","want":"SEAV","sel":[1,1],"flags":[0,1,1,1]},
 {"text":"SAVE","ops":"S(0xb9,1,0);Q();S(12,0,(long)\"LOAD\");Q();","want":"LOAD","sel":[4,4],"flags":[0,1,0,0],"ro":false},
 {"text":"SAVE","ops":"S(0xb9,1,0);Q();S(12,0,(long)\"\");Q();","want":"","sel":[0,0],"flags":[0,1,0,0],"ro":false},
 {"text":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","ops":"S(0x102,'x',0);Q();","want":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAx","sel":[33,33],"flags":[0,1,1],"ro":false,"single":true},
 {"text":"SAVE","ops":"S(0xb1,1,3);S(0x102,'X',0);Q();","want":"SXE","sel":[2,2],"flags":[0,1,1],"ro":false},
 {"text":"SAVE","ops":"S(0x102,8,0);Q();","want":"SAV","sel":[3,3],"flags":[0,1,1],"ro":false},
 {"text":"SAVE","ops":"S(0x100,8,0);Q();","want":"SAV","sel":[3,3],"flags":[0,1,1],"ro":false},
 {"text":"SAVE","ops":"S(0xb1,1,3);S(0x100,46,0);Q();","want":"SE","sel":[1,1],"flags":[0,1,1],"ro":false},
 {"text":"SAVE","ops":"S(0x102,'x',0);Q();S(0x100,8,0);Q();S(0xb9,1,0);Q();S(0x100,46,0);Q();S(0xb9,0,0);Q();","want":"SAVE","sel":[4,4],"flags":[0,0,0,1,1,0,0],"ro":true},
 {"text":"SAVE","ops":"S(0xb1,1,3);Q();S(0xb9,1,0);S(0xb1,3,1);Q();S(0xb9,0,0);S(0x100,37,0);Q();S(0xb1,2,2);","want":"SAVE","sel":[2,2],"flags":[0,0,1,0,0],"ro":false},
 {"text":"SAVE","ops":"S(0xb1,1,3);S(0xc2,0,(long)\"LOT\");Q();S(0xb9,0,0);S(0xc2,1,(long)\"X\");Q();","want":"SLOTXE","sel":[5,5],"flags":[0,1,1,1],"ro":false},
 {"text":"SAVE","ops":"S(0xb1,1,3);S(0xc2,1,(long)\"LOT\");Q();","want":"SLOTE","sel":[4,4],"flags":[0,1,1],"ro":true},
 {"text":"SAVE","ops":"S(0xb1,0,0);S(0x100,8,0);Q();S(0xb1,4,4);S(0x100,46,0);Q();S(0xc5,4,0);S(0x102,'x',0);Q();","want":"SAVE","sel":[4,4],"flags":[0,0,0,0,0],"ro":false},
 {"text":"SAVE","ops":"S(0xb1,1,3);S(0x303,0,0);Q();","want":"SE","sel":[1,1],"flags":[0,1,1],"ro":false}
];
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
long API DialogBoxIndirectParamA(P,const void*,P,P,long);long API SendMessageA(P,U,U,long);int API SetWindowTextA(P,const char*);P API SetFocus(P);
static unsigned short dialog[256];static char report[2048],value[256];static P live,liveRef,liveReport;static int stage;
void number(U n,int* at){char d[12];int k=0;do{d[k++]='0'+n%10;n/=10;}while(n);while(k)report[(*at)++]=d[--k];report[(*at)++]=' ';}
int same(char*a,char*b){int k=0;while(a[k]&&a[k]==b[k])++k;return a[k]==b[k];}
#define S(m,w,l) SendMessageA(e,m,w,l)
#define Q() number(S(0xb8,0,0)!=0,&at)
void finish(P h,P i,P e,int j,int at,const char*want,U start,U end,U style,U top){
U lo=0,hi=0;S(0xb0,(U)&lo,(long)&hi);number(lo,&at);number(hi,&at);number(S(0xce,0,0),&at);number(S(13,256,(long)value),&at);number(same(value,(char*)want),&at);number(S(0xba,0,0),&at);report[at]=0;
CreateWindowExA(0,"STATIC",report,0x50000000,365,12+j*31,350,28,h,(P)(300+j),i,0);
P ref=CreateWindowExA(0,"EDIT",want,style,192,12+j*31,160,28,h,(P)(200+j),i,0);SendMessageA(ref,0xb1,start,end);if(top)SendMessageA(ref,0xb6,0,top);}
long __stdcall proc(P h,U m,U w,long l){P i=GetModuleHandleA(0);if(m==0x110){
BLOCKS
live=CreateWindowExA(0,"EDIT","SAVE",0x50810084,12,580,160,28,h,(P)10,i,0);
liveRef=CreateWindowExA(0,"EDIT","SAVE",0x50800084,192,580,160,28,h,(P)11,i,0);
liveReport=CreateWindowExA(0,"STATIC","idle",0x50000000,365,580,350,28,h,(P)12,i,0);
CreateWindowExA(0,"BUTTON","Prepare",0x50010000,12,615,100,26,h,(P)20,i,0);
CreateWindowExA(0,"BUTTON","Observe",0x50010000,125,615,100,26,h,(P)21,i,0);
SetWindowTextA(h,"Authored EDIT modify flag READY");return 1;}
if(m==0x111){int id=w&65535;P e=live;if(id==20){++stage;S(12,0,(long)"SAVE");S(0xb9,0,0);S(0xcf,stage==3,0);S(0xb1,4,4);SetFocus(e);return 1;}
if(id==21){U lo=0,hi=0;int at=0;char*want=stage==1?"SAVEx":stage==2?"SAV":"SAVE";number(18,&at);Q();S(0xb0,(U)&lo,(long)&hi);number(lo,&at);number(hi,&at);number(S(0xce,0,0),&at);number(S(13,256,(long)value),&at);number(same(value,want),&at);number(S(0xba,0,0),&at);report[at]=0;SetWindowTextA(liveReport,report);SendMessageA(liveRef,12,0,(long)want);SendMessageA(liveRef,0xcf,stage==3,0);SendMessageA(liveRef,0xb1,stage==1?5:stage==2?3:4,stage==1?5:stage==2?3:4);return 1;}}
return 0;}
void start(void){U*d=(U*)dialog;d[0]=0x90c80000;dialog[7]=500;dialog[8]=480;dialog[11]='E';DialogBoxIndirectParamA(GetModuleHandleA(0),dialog,0,proc,0);for(;;){} }
`.replace('BLOCKS',cases.map((c,j)=>'{int at=0;U style='+((0x50800000|(c.single?0x80:0x84)|(c.ro?0x800:0))>>>0)+';P e=CreateWindowExA(0,"EDIT",'+JSON.stringify(c.text)+',style,12,'+(12+j*31)+',160,28,h,(P)'+(100+j)+',i,0);number('+j+',&at);Q();'+c.ops+'Q();finish(h,i,e,'+j+',at,'+JSON.stringify(c.want)+','+c.sel.join(',')+',style,'+(c.viewport||0)+');}').join('\n'));

function fixture(out){
 fs.writeFileSync(out+'/fixture.c',source);
 for(const [dll,names]of Object.entries({kernel32:['GetModuleHandleA@4'],user32:['CreateWindowExA@48','DialogBoxIndirectParamA@20','SendMessageA@16','SetWindowTextA@8','SetFocus@4']})){
 fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/fixture.c','-o',out+'/fixture.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/edit-modify-flag.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib']);return fs.readFileSync(out+'/edit-modify-flag.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n');
 const runtime=require(root+'/tools/boids-current-runtime.cjs'),commit=process.env.EDIT_MODIFY_FLAG_COMMIT||cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files=runtime.gitFiles(commit),own='src/09c3-wndprocs5-edit.wat';
 files.set(own,expectOld?cp.execFileSync('git',['show',commit+':'+own],{cwd:root}):fs.readFileSync(root+'/'+own));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{maxBuffer:8e6}));
 const wasm=process.env.EDIT_MODIFY_FLAG_WASM?zlib.gunzipSync(fs.readFileSync(process.env.EDIT_MODIFY_FLAG_WASM)):runtime.compile(files),pe=fixture(out);fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));files.set('build/wine-assembly.wasm',wasm);files.set('edit-modify-flag.exe',pe);
 save('runtime.json',{commit,expectOld,testSHA256:sha(fs.readFileSync(__filename)),moduleSHA256:sha(wasm),peSHA256:sha(pe),cases,files:[...files].map(([name,b])=>({name,size:b.length,sha256:sha(b)}))});
 const transient=require(root+'/tools/browser-transients.cjs').create(),logs=[],pending=[],workers=[],failures=[],observations=[];let display,browser,wait,server;
 try{
 server=http.createServer((req,res)=>{const n=new URL(req.url,'http://local').pathname.slice(1)||'index.html',b=files.get(n);res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.html')?'text/html':n.endsWith('.css')?'text/css':n.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.statusCode=b?200:404;res.end(b||'missing');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 display=await require(root+'/tools/gltron-headful-display.cjs').start(out);
 browser=await require(root+'/node_modules/puppeteer').launch({headless:false,defaultViewport:{width:1050,height:800},env:transient.env(display.env),userDataDir:transient.profile,executablePath:'/opt/google/chrome/chrome',args:[...transient.args,'--no-sandbox','--disable-dev-shm-usage','--disable-component-update','--disable-background-networking'],protocolTimeout:20000});wait=transient.watch(browser.process());browser.process().stdout?.resume();browser.process().stderr?.resume();save('browser-version.json',{version:await browser.version()});
 const page=await browser.newPage();page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>logs.push(String(e)));
 page.on('workercreated',w=>{const row={url:w.url(),modules:[]};workers.push(row);const c=w.client;c.on('Debugger.scriptParsed',v=>{if(v.scriptLanguage==='WebAssembly'||v.url.startsWith('wasm://'))pending.push(c.send('Debugger.getScriptSource',{scriptId:v.scriptId}).then(r=>row.modules.push(sha(Buffer.from(r.bytecode,'base64')))));});pending.push(c.send('Debugger.enable'));});
 await page.evaluateOnNewDocument(()=>localStorage.setItem('wine-assembly.threads','1'));await page.goto('http://127.0.0.1:'+server.address().port+'/?debug&threads&no-log');await page.waitForFunction(()=>typeof WineAssembly==='function');
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=750;c.style='position:fixed;left:0;top:0;z-index:99999;width:1000px;height:750px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.editHost=new WineAssembly();editHost.renderer=new Win98Renderer(c);await editHost.init(c);if(!editHost.guestWorker)throw Error('production Worker required');await editHost.loadExe('/edit-modify-flag.exe');editHost.run();});
 await page.waitForFunction(()=>Object.values(editHost.renderer.windows).some(w=>w.title==='Authored EDIT modify flag READY'),{timeout:15000});
 const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);
 const cpuState=await cpu.evaluate(()=>{const e=instance.exports,names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,registers:Object.fromEntries(names.map(n=>[n,e[n]()>>>0]))};});save('cpu-state.json',cpuState);assert.equal(cpuState.memoryBytes,536870912);assert.equal(Object.keys(cpuState.registers).length,19);assert(cpuState.registers.get_eip&&cpuState.registers.get_esp);
 const geometry=await page.evaluate(()=>{const r=editHost.renderer,f=Object.values(r.windows).find(w=>w.title==='Authored EDIT modify flag READY');return {frame:{hwnd:f.hwnd,x:f.x,y:f.y},canvas:r.canvas.getBoundingClientRect().toJSON()};});
 const client=await cpu.evaluate(h=>({x:instance.exports.wnd_client_screen_x(h),y:instance.exports.wnd_client_screen_y(h)}),geometry.frame.hwnd);
 const classRows=await page.evaluate(()=>Object.values(editHost.renderer.windows).filter(w=>w.isChild&&[12,192].includes(w.x)&&w.y<=580).map(w=>({hwnd:w.hwnd,x:w.x,y:w.y})));save('native-controls.json',await cpu.evaluate(rows=>rows.map(r=>({...r,cls:instance.exports.ctrl_get_class(r.hwnd),live:instance.exports.wnd_lookup_live(r.hwnd)})),classRows));assert(JSON.parse(fs.readFileSync(out+'/native-controls.json')).every(r=>r.cls===2&&r.live===1));
 let nativeOrigin=null;
 async function sample(name,liveStage=0){
 await new Promise(r=>setTimeout(r,150));const s=await page.evaluate(()=>{const h=editHost,r=h.renderer,w=Object.values(r.windows).find(w=>w.title==='Authored EDIT modify flag READY'),p=w._backCanvas._waCanonicalPresentation;return {rows:Object.values(r.windows).map(v=>({hwnd:v.hwnd,title:v.title,x:v.x,y:v.y,w:v.w,h:v.h,isChild:v.isChild})),gdi:p?{sharedGuestStorage:p.surface.storage.buffer===h.memory.buffer,pixels:Array.from(p.surface.rgbaRect(0,0,w.w,w.h))}:null,pixels:Array.from(w._backCanvas.getContext('2d').getImageData(0,0,w.w,w.h).data),width:w.w,height:w.h};});
 assert(s.gdi?.sharedGuestStorage);const pix=Buffer.from(s.pixels),gd=Buffer.from(s.gdi.pixels),surfaces=[],pairs=[];
 for(let j=0;j<(liveStage?1:cases.length);++j){const y=liveStage?580:12+j*31;for(const x of [12,192]){const c=s.rows.find(v=>v.isChild&&v.x===x&&v.y===y);assert(c);const sx=x+client.x-geometry.frame.x+4,sy=y+client.y-geometry.frame.y+4,cw=136,ch=20,bytes=Buffer.alloc(cw*ch*4);for(let row=0;row<ch;++row){const at=((sy+row)*s.width+sx)*4;pix.copy(bytes,row*cw*4,at,at+cw*4);assert(pix.subarray(at,at+cw*4).equals(gd.subarray(at,at+cw*4)),'GDI/backingcanvas agree');}surfaces.push({x:sx,y:sy,w:cw,h:ch,bytes});}pairs.push({j,equal:surfaces.at(-1).bytes.equals(surfaces.at(-2).bytes)});
 const report=s.rows.find(v=>v.isChild&&v.x===365&&v.y===y),got=report.title.trim().split(/\s+/).map(Number),c=liveStage?{want:liveStage===1?'SAVEx':liveStage===2?'SAV':'SAVE',sel:liveStage===1?[5,5]:liveStage===2?[3,3]:[4,4],flags:[liveStage===3?0:1]}:cases[j],lo=Math.min(...c.sel),hi=Math.max(...c.sel);


 const state=[lo,hi,c.viewport||0,c.want.length,1,c.count||1],flagEnd=1+c.flags.length,want=[liveStage?18:j,...c.flags,...state];
 assert.deepEqual(got.slice(flagEnd),state,'public selection/text/count/viewport');
 if(JSON.stringify(got)!==JSON.stringify(want))failures.push({name,j,got,want});





 }
 await page.screenshot({path:out+'/'+name+'-composited.png'});require(root+'/tools/browser-transients.cjs').captureWhole(out,name+'-desktop',display.env);
 const {PNG}=require(root+'/node_modules/pngjs'),composite=PNG.sync.read(fs.readFileSync(out+'/'+name+'-composited.png')),desktop=PNG.sync.read(fs.readFileSync(out+'/'+name+'-desktop.png'));
 const match=(png,v,ox,oy)=>{const x=Math.round(ox+v.x),y=Math.round(oy+v.y);if(x<0||y<0||x+v.w>png.width||y+v.h>png.height)return false;for(let row=0;row<v.h;++row)if(!png.data.subarray(((y+row)*png.width+x)*4,((y+row)*png.width+x+v.w)*4).equals(v.bytes.subarray(row*v.w*4,(row+1)*v.w*4)))return false;return true;};
 assert(surfaces.every(v=>match(composite,v,geometry.canvas.x+geometry.frame.x,geometry.canvas.y+geometry.frame.y)),'compositor exact EDIT surfaces');
 const first=surfaces[0],needle=first.bytes.subarray(10*first.w*4,11*first.w*4);let origin=nativeOrigin;
 if(!origin)for(let at=desktop.data.indexOf(needle);at>=0;at=desktop.data.indexOf(needle,at+1)){if(at%4)continue;const ox=at/4%desktop.width-first.x,oy=Math.floor(at/4/desktop.width)-first.y-10;if(ox>=0&&oy>=0&&surfaces.every(v=>match(desktop,v,ox,oy))){origin={x:ox,y:oy};break;}}
 assert(origin&&surfaces.every(v=>match(desktop,v,origin.x,origin.y)),'native desktop exact EDIT surfaces at established dialog origin');nativeOrigin=origin;
 save(name+'-visible.json',{origin,pairs,exactGDI:true,exactCompositor:true,exactNativeDesktop:true,surfaces:surfaces.map(({bytes,...v})=>({...v,sha256:sha(bytes)}))});
 assert(pairs.every(v=>v.equal),'constant independently authored reference text pixels');
 delete s.pixels;delete s.gdi.pixels;observations.push({name,rows:s.rows,pairs});save('observations.json',observations);
 }
 await sample('initial');
 await page.evaluate(()=>{browserInput.wireCanvasInput(editHost.renderer.canvas,editHost.renderer,{runningApps:[{wine:editHost}],debugMode:true});editHost.renderer.canvas.focus();});
 const click=async(x,y)=>{await page.mouse.click(geometry.canvas.x+client.x+x,geometry.canvas.y+client.y+y);await new Promise(r=>setTimeout(r,120));};
 for(let stage=1;stage<=3;++stage){await click(55,628);if(stage===2)await page.keyboard.press('Backspace');else await page.keyboard.type('x');await click(170,628);await sample('user-'+stage,stage);}
 await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));
 save('assertions.json',{expectOld,failures,observations:observations.length,productionBrowserCPU:true});
 if(expectOld){assert.deepEqual(failures.map(f=>[f.name,f.j]),[...[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,17].map(j=>['initial',j]),['user-1',0],['user-2',0]]);console.log('PASS supported preedit oldFAIL',failures.length);}else{assert.deepEqual(failures,[]);console.log('PASS native CLASS2 EM_GETMODIFY/EM_SETMODIFY lifecycle; unchanged public state and four surfaces',cases.length+3);}
 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('transients.json',await transient.cleanup(out));if(display)await display.close();}
}
if(require.main===module)main(process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync(require('node:os').tmpdir()+'/edit-modify-flag-'),{expectOld:process.argv.includes('--expect-old')}).catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={cases,fixture,main};


