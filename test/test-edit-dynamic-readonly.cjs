'use strict';
// Microsoft primary contracts, accessed 2026-11-21:
// /windows/win32/controls/{em-setreadonly,edit-control-styles,em-replacesel}
// /windows/win32/winmsg/wm-settext at https://learn.microsoft.com/en-us
// Nonzero success, ES_READONLY visible through GWL_STYLE, user edits blocked.
// Programmatic text setters retain their documented operation. REPLACESEL's
// return is unspecified. Plain EDIT only; no rich-edit behavior is changed.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
// Initial style, first/second readonly values, operation, expected text.
const cases=[
 [0,1,1,0,'SAVE'],[0,1,1,1,'SAVE'],[0,1,1,2,'SAVE'],
 [0,1,1,3,'SAVE'],[0x800,0,0,0,'SAVEx'],[0x800,0,0,2,'SAV'],
 [0,0x80000000,0x80000000,0,'SAVE'],[0,1,1,4,'PROGRAM'],
 [0,1,1,5,'SLOTE'],[0,1,0,0,'SAVEx'],[0x800,1,0,3,'SE']
];
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
long API DialogBoxIndirectParamA(P,const void*,P,P,long);long API SendMessageA(P,U,U,long);long API GetWindowLongA(P,int);int API SetWindowTextA(P,const char*);P API SetFocus(P);
static U cases[11][4]=CASES;static char* wants[11]=WANTS;
static unsigned short dialog[256];static P active,liveRef,status,frame;static int stage,lockret;static char text[256],value[128];
void number(U n,int* at){char d[12];int k=0;do{d[k++]='0'+n%10;n/=10;}while(n);while(k)text[(*at)++]=d[--k];text[(*at)++]=' ';}
void publish(P dest,int j,P edit,U r1,U r2,U setret){int at=0;number(j,&at);number(r1,&at);number(r2,&at);number(GetWindowLongA(edit,-16),&at);number(setret,&at);SendMessageA(edit,13,128,(long)value);for(int k=0;value[k];++k)text[at++]=value[k];text[at]=0;SetWindowTextA(dest,text);}
long __stdcall proc(P h,U m,U w,long l){P i=GetModuleHandleA(0);
 if(m==0x110){frame=h;
 for(int j=0;j<11;++j){U* c=cases[j];int y=12+j*25;P e=CreateWindowExA(0,"EDIT","SAVE",0x50800000|c[0],12,y,160,22,h,(P)(100+j),i,0);
 U r1=SendMessageA(e,0xcf,c[1],0x12345678),r2=SendMessageA(e,0xcf,c[2],0),setret=1;
 SendMessageA(e,0xb1,c[3]==3||c[3]==5?1:4,c[3]==3||c[3]==5?3:4);
 if(c[3]==0)SendMessageA(e,0x102,'x',0);if(c[3]==1)SendMessageA(e,0x102,8,0);if(c[3]==2)SendMessageA(e,0x100,8,0);if(c[3]==3)SendMessageA(e,0x100,46,0);
 if(c[3]==4)setret=SendMessageA(e,12,0,(long)"PROGRAM");if(c[3]==5)SendMessageA(e,0xc2,1,(long)"LOT");
 SendMessageA(e,0xb1,0,0);
 P ref=CreateWindowExA(0,"EDIT",wants[j],0x50800000|(c[2]?0x800:0),192,y,160,22,h,(P)(200+j),i,0);SendMessageA(ref,0xb1,0,0);
 P report=CreateWindowExA(0,"STATIC","",0x50000000,365,y,350,22,h,(P)(300+j),i,0);publish(report,j,e,r1,r2,setret);
 }
 active=CreateWindowExA(0,"EDIT","SAVE",0x50810000,12,305,160,22,h,(P)10,i,0);liveRef=CreateWindowExA(0,"EDIT","SAVE",0x50800000,192,305,160,22,h,(P)11,i,0);
 CreateWindowExA(0,"BUTTON","Lock/reset",0x50010000,12,345,100,26,h,(P)20,i,0);CreateWindowExA(0,"BUTTON","Unlock",0x50010000,125,345,100,26,h,(P)21,i,0);CreateWindowExA(0,"BUTTON","Relock",0x50010000,240,345,100,26,h,(P)22,i,0);CreateWindowExA(0,"BUTTON","Observe",0x50010000,355,345,100,26,h,(P)23,i,0);
 status=CreateWindowExA(0,"STATIC","idle",0x50000000,12,390,700,26,h,(P)24,i,0);SetWindowTextA(h,"Authored EDIT readonly READY");return 1;}
 if(m==0x111){int id=w&65535;if(id>=20&&id<=22){stage=id-19;if(id==20)SendMessageA(active,12,0,(long)"SAVE");lockret=SendMessageA(active,0xcf,id!=21,0);SendMessageA(active,0xb1,id==22?0:4,id==22?4:4);SetFocus(active);return 1;}
 if(id==23){publish(status,stage,active,lockret,lockret,1);SendMessageA(liveRef,12,0,(long)(stage==1?"SAVE":"SAVEx"));SendMessageA(liveRef,0xcf,stage!=2,0);SendMessageA(liveRef,0xb1,0,stage==3?4:0);return 1;}}
 return 0;}
void start(void){U* d=(U*)dialog;d[0]=0x90c80000;dialog[7]=500;dialog[8]=290;dialog[11]='E';DialogBoxIndirectParamA(GetModuleHandleA(0),dialog,0,proc,0);for(;;){} }
`.replace('CASES','{'+cases.map(c=>'{'+c.slice(0,4).join(',')+'}').join(',')+'}').replace('WANTS','{'+cases.map(c=>JSON.stringify(c[4])).join(',')+'}');
function fixture(out){
 fs.writeFileSync(out+'/fixture.c',source);
 for(const [dll,names]of Object.entries({kernel32:['GetModuleHandleA@4'],user32:['CreateWindowExA@48','DialogBoxIndirectParamA@20','SendMessageA@16','GetWindowLongA@8','SetWindowTextA@8','SetFocus@4']})){
 fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/fixture.c','-o',out+'/fixture.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/edit-readonly.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib']);return fs.readFileSync(out+'/edit-readonly.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n');
 const runtime=require(root+'/tools/boids-current-runtime.cjs'),commit=process.env.EDIT_READONLY_COMMIT||cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files=runtime.gitFiles(commit),own='src/09c3-wndprocs5-edit.wat';
 files.set(own,expectOld?cp.execFileSync('git',['show',commit+':'+own],{cwd:root}):fs.readFileSync(root+'/'+own));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{maxBuffer:8e6}));
 const wasm=runtime.compile(files),pe=fixture(out);fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));files.set('build/wine-assembly.wasm',wasm);files.set('edit-readonly.exe',pe);
 save('runtime.json',{commit,expectOld,moduleSHA256:sha(wasm),peSHA256:sha(pe),cases,files:[...files].map(([name,b])=>({name,size:b.length,sha256:sha(b)}))});
 const transient=require(root+'/tools/browser-transients.cjs').create(),logs=[],pending=[],workers=[],failures=[],observations=[];let display,browser,wait,server;
 try{
 server=http.createServer((req,res)=>{const n=new URL(req.url,'http://local').pathname.slice(1)||'index.html',b=files.get(n);res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.html')?'text/html':n.endsWith('.css')?'text/css':n.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.statusCode=b?200:404;res.end(b||'missing');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 display=await require(root+'/tools/gltron-headful-display.cjs').start(out);
 browser=await require(root+'/node_modules/puppeteer').launch({headless:false,defaultViewport:{width:1050,height:800},env:transient.env(display.env),userDataDir:transient.profile,executablePath:'/opt/google/chrome/chrome',args:[...transient.args,'--no-sandbox','--disable-dev-shm-usage','--disable-component-update','--disable-background-networking'],protocolTimeout:20000});wait=transient.watch(browser.process());browser.process().stdout?.resume();browser.process().stderr?.resume();save('browser-version.json',{version:await browser.version()});
 const page=await browser.newPage();page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>logs.push(String(e)));
 page.on('workercreated',w=>{const row={url:w.url(),modules:[]};workers.push(row);const c=w.client;c.on('Debugger.scriptParsed',v=>{if(v.scriptLanguage==='WebAssembly'||v.url.startsWith('wasm://'))pending.push(c.send('Debugger.getScriptSource',{scriptId:v.scriptId}).then(r=>row.modules.push(sha(Buffer.from(r.bytecode,'base64')))));});pending.push(c.send('Debugger.enable'));});
 await page.evaluateOnNewDocument(()=>localStorage.setItem('wine-assembly.threads','1'));await page.goto('http://127.0.0.1:'+server.address().port+'/?debug&threads&no-log');await page.waitForFunction(()=>typeof WineAssembly==='function');
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=650;c.style='position:fixed;left:0;top:0;z-index:99999;width:1000px;height:650px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.editHost=new WineAssembly();editHost.renderer=new Win98Renderer(c);await editHost.init(c);if(!editHost.guestWorker)throw Error('production Worker required');await editHost.loadExe('/edit-readonly.exe');editHost.run();});
 await page.waitForFunction(()=>Object.values(editHost.renderer.windows).some(w=>w.title==='Authored EDIT readonly READY'),{timeout:15000});
 const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);
 const cpuState=await cpu.evaluate(()=>{const e=instance.exports,names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,registers:Object.fromEntries(names.map(n=>[n,e[n]()>>>0]))};});save('cpu-state.json',cpuState);assert.equal(cpuState.memoryBytes,536870912);assert.equal(Object.keys(cpuState.registers).length,19);assert(cpuState.registers.get_eip&&cpuState.registers.get_esp);
 const geometry=await page.evaluate(()=>{const r=editHost.renderer,f=Object.values(r.windows).find(w=>w.title==='Authored EDIT readonly READY');return {frame:{hwnd:f.hwnd,x:f.x,y:f.y},canvas:r.canvas.getBoundingClientRect().toJSON()};});
 const client=await cpu.evaluate(h=>({x:instance.exports.wnd_client_screen_x(h),y:instance.exports.wnd_client_screen_y(h)}),geometry.frame.hwnd);
 const classRows=await page.evaluate(()=>Object.values(editHost.renderer.windows).filter(w=>w.isChild&&[12,192].includes(w.x)&&w.y<=305).map(w=>({hwnd:w.hwnd,x:w.x,y:w.y})));save('native-controls.json',await cpu.evaluate(rows=>rows.map(r=>({...r,cls:instance.exports.ctrl_get_class(r.hwnd),live:instance.exports.wnd_lookup_live(r.hwnd)})),classRows));assert(JSON.parse(fs.readFileSync(out+'/native-controls.json')).every(r=>r.cls===2&&r.live===1));
 let nativeOrigin=null;
 const parse=s=>{const m=/^(\d+) (\d+) (\d+) (\d+) (\d+) (.*)$/.exec(s);assert(m,'authored public report: '+s);return {j:+m[1],r1:+m[2],r2:+m[3],style:+m[4],setret:+m[5],text:m[6]};};
 async function sample(name,liveStage=0){
 await new Promise(r=>setTimeout(r,150));const s=await page.evaluate(()=>{const h=editHost,r=h.renderer,w=Object.values(r.windows).find(w=>w.title==='Authored EDIT readonly READY'),p=w._backCanvas._waCanonicalPresentation;return {rows:Object.values(r.windows).map(v=>({hwnd:v.hwnd,title:v.title,x:v.x,y:v.y,w:v.w,h:v.h,isChild:v.isChild})),gdi:p?{sharedGuestStorage:p.surface.storage.buffer===h.memory.buffer,pixels:Array.from(p.surface.rgbaRect(0,0,w.w,w.h))}:null,pixels:Array.from(w._backCanvas.getContext('2d').getImageData(0,0,w.w,w.h).data),width:w.w,height:w.h};});
 assert(s.gdi?.sharedGuestStorage);const pix=Buffer.from(s.pixels),gd=Buffer.from(s.gdi.pixels),surfaces=[],pairs=[];
 for(let j=0;j<(liveStage?1:cases.length);++j){const y=liveStage?305:12+j*25;for(const x of [12,192]){const c=s.rows.find(v=>v.isChild&&v.x===x&&v.y===y);assert(c);const sx=x+client.x-geometry.frame.x,sy=y+client.y-geometry.frame.y,bytes=Buffer.alloc(c.w*c.h*4);for(let row=0;row<c.h;++row){const at=((sy+row)*s.width+sx)*4;pix.copy(bytes,row*c.w*4,at,at+c.w*4);assert(pix.subarray(at,at+c.w*4).equals(gd.subarray(at,at+c.w*4)),'GDI/backingcanvas agree');}surfaces.push({x:sx,y:sy,w:c.w,h:c.h,bytes});}pairs.push({j,equal:surfaces.at(-1).bytes.equals(surfaces.at(-2).bytes)});
 const report=liveStage?s.rows.find(v=>v.isChild&&v.x===12&&v.y===390):s.rows.find(v=>v.isChild&&v.x===365&&v.y===y),got=parse(report.title),want={j:liveStage||j,readonly:liveStage?liveStage!==2:!!cases[j][2],text:liveStage?(liveStage===1?'SAVE':'SAVEx'):cases[j][4]};
 if(got.j!==want.j||!got.r1||!got.r2||!got.setret||(got.style&0x800)!==(want.readonly?0x800:0)||((got.style&~0x800)>>>0)!==(liveStage?0x50810000:0x50800000)||got.text!==want.text)failures.push({name,got,want});
 }
 await page.screenshot({path:out+'/'+name+'-composited.png'});require(root+'/tools/browser-transients.cjs').captureWhole(out,name+'-desktop',display.env);
 const {PNG}=require(root+'/node_modules/pngjs'),composite=PNG.sync.read(fs.readFileSync(out+'/'+name+'-composited.png')),desktop=PNG.sync.read(fs.readFileSync(out+'/'+name+'-desktop.png'));
 const match=(png,v,ox,oy)=>{const x=Math.round(ox+v.x),y=Math.round(oy+v.y);if(x<0||y<0||x+v.w>png.width||y+v.h>png.height)return false;for(let row=0;row<v.h;++row)if(!png.data.subarray(((y+row)*png.width+x)*4,((y+row)*png.width+x+v.w)*4).equals(v.bytes.subarray(row*v.w*4,(row+1)*v.w*4)))return false;return true;};
 assert(surfaces.every(v=>match(composite,v,geometry.canvas.x+geometry.frame.x,geometry.canvas.y+geometry.frame.y)),'compositor exact EDIT surfaces');
 const first=surfaces[0],needle=first.bytes.subarray(10*first.w*4,11*first.w*4);let origin=nativeOrigin;
 if(!origin)for(let at=desktop.data.indexOf(needle);at>=0;at=desktop.data.indexOf(needle,at+1)){if(at%4)continue;const ox=at/4%desktop.width-first.x,oy=Math.floor(at/4/desktop.width)-first.y-10;if(ox>=0&&oy>=0&&surfaces.every(v=>match(desktop,v,ox,oy))){origin={x:ox,y:oy};break;}}
 assert(origin&&surfaces.every(v=>match(desktop,v,origin.x,origin.y)),'native desktop exact EDIT surfaces at established dialog origin');nativeOrigin=origin;
 save(name+'-visible.json',{origin,pairs,exactGDI:true,exactCompositor:true,exactNativeDesktop:true,surfaces:surfaces.map(({bytes,...v})=>({...v,sha256:sha(bytes)}))});
 if(!expectOld)assert(pairs.every(v=>v.equal),'independently authored reference text pixels');
 delete s.pixels;delete s.gdi.pixels;observations.push({name,rows:s.rows,pairs});save('observations.json',observations);
 }
 await sample('initial');
 await page.evaluate(()=>{browserInput.wireCanvasInput(editHost.renderer.canvas,editHost.renderer,{runningApps:[{wine:editHost}],debugMode:true});editHost.renderer.canvas.focus();});
 const click=async x=>{await page.mouse.click(geometry.canvas.x+client.x+x+35,geometry.canvas.y+client.y+345+12);};
 for(let stage=1;stage<=3;++stage){await click([12,125,240][stage-1]);await page.keyboard.press(stage===3?'z':'x');await page.keyboard.press('Backspace');await page.keyboard.press('Delete');if(stage===2)await page.keyboard.press('x');await click(355);await page.waitForFunction(stage=>Object.values(editHost.renderer.windows).some(w=>w.isChild&&w.x===12&&w.y===390&&w.title?.startsWith(stage+' ')),{timeout:5000},stage);await sample('live-'+stage,stage);}
 await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));
 save('assertions.json',{expectOld,failures,observations:observations.length,productionBrowserCPU:true});
 if(expectOld){assert(failures.length>=cases.length,'supported readonly messages must reproduce oldFAIL');assert(failures.every(f=>f.got.r1===0&&f.got.r2===0));console.log('PASS supported preedit oldFAIL',failures.length);}else{assert.deepEqual(failures,[]);console.log('PASS dynamic plain EDIT readonly return/style/text/user typing/deletion/programmatic updates and four pixel surfaces',cases.length+3);}
 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('transients.json',await transient.cleanup(out));if(display)await display.close();}
}
if(require.main===module)main(process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync(require('node:os').tmpdir()+'/edit-dynamic-readonly-'),{expectOld:process.argv.includes('--expect-old')}).catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={cases,fixture,main};
