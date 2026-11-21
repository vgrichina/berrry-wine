'use strict';
// Microsoft primary: https://learn.microsoft.com/en-us/windows/win32/controls/em-getsel
// Optional DWORD outputs retain full ordered positions. Packed result is -1
// when either endpoint exceeds 65535. Scope: plain native CLASS2, ANSI ASCII.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const cases=[
 {sel:[0,0],mask:3},{sel:[12,34],mask:3},
 {sel:[65534,65535],mask:3},{sel:[65535,1],mask:3},
 ...[0,1,2,3].map(mask=>({sel:[1,65536],mask})),
 ...[0,1,2,3].map(mask=>({sel:[65536,1],mask})),
 {sel:[65536,69999],mask:3,top:1},{sel:[69999,65536],mask:0,top:1},
 {sel:[65536,65536],mask:1,top:1},{sel:[65536,65536],mask:2,top:1}
].map(c=>({...c,top:c.top||0}));
// Literal 70,000-character text, short reference strings and expected public
// endpoints are independently authored. No private EditState or packed oracle.
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
long API DialogBoxIndirectParamA(P,const void*,P,P,long);long API SendMessageA(P,U,U,long);int API SetWindowTextA(P,const char*);
struct C{U start,end,mask,top;};static struct C cases[16]=CASES;
static unsigned short dialog[256];static char report[2048],value[70001],large[70001];static unsigned char guarded[24];
void number(U n,int* at){char d[12];int k=0;do{d[k++]='0'+n%10;n/=10;}while(n);while(k)report[(*at)++]=d[--k];report[(*at)++]=' ';}
int same(char*a,char*b){int k=0;while(a[k]&&a[k]==b[k])++k;return a[k]==b[k];}
void state(P e,int*at){U lo=0,hi=0;SendMessageA(e,0xb0,(U)&lo,(long)&hi);number(lo,at);number(hi,at);number(SendMessageA(e,0xce,0,0),at);number(SendMessageA(e,13,70001,(long)value),at);number(same(value,large),at);number(SendMessageA(e,0xb8,0,0),at);}
long __stdcall proc(P h,U m,U w,long l){P i=GetModuleHandleA(0);if(m==0x110){
 char*prefix="VISIBLE\r\n";for(int k=0;k<9;++k)large[k]=prefix[k];for(int k=9;k<70000;++k)large[k]='x';large[70000]=0;
 for(int j=0;j<16;++j){struct C*c=&cases[j];int y=12+j*32,at=0;
 P e=CreateWindowExA(0,"EDIT",large,0x50800084,12,y,160,24,h,(P)(100+j),i,0);
 SendMessageA(e,0xb1,c->start,c->end);if(c->top)SendMessageA(e,0xb6,0,c->top);number(j,&at);state(e,&at);
 for(int k=0;k<24;++k)guarded[k]=165;
 number(SendMessageA(e,0xb0,c->mask&1?(U)(guarded+4):0,c->mask&2?(long)(guarded+16):0),&at);
 for(int k=0;k<24;++k)number(guarded[k],&at);state(e,&at);
 report[at]=0;CreateWindowExA(0,"STATIC",report,0x50000000,365,y,350,26,h,(P)(300+j),i,0);
 P ref=CreateWindowExA(0,"EDIT",c->top?large+9:"VISIBLE\r\nx",0x50800084,192,y,160,24,h,(P)(200+j),i,0);
 SendMessageA(ref,0xb1,c->top?c->start-9:(c->start>9?9:c->start),c->top?c->end-9:(c->end>9?9:c->end));
 }
 SetWindowTextA(h,"Authored EDIT large selection READY");return 1;}return 0;}
void start(void){U*d=(U*)dialog;d[0]=0x90c80000;dialog[7]=500;dialog[8]=390;dialog[11]='E';DialogBoxIndirectParamA(GetModuleHandleA(0),dialog,0,proc,0);for(;;){} }
`.replace('CASES','{'+cases.map(c=>'{'+[...c.sel,c.mask,c.top].join(',')+'}').join(',')+'}');
function fixture(out){
 fs.writeFileSync(out+'/fixture.c',source);
 for(const [dll,names]of Object.entries({kernel32:['GetModuleHandleA@4'],user32:['CreateWindowExA@48','DialogBoxIndirectParamA@20','SendMessageA@16','SetWindowTextA@8']})){
 fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/fixture.c','-o',out+'/fixture.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/edit-large-selection.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib']);return fs.readFileSync(out+'/edit-large-selection.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n');
 const runtime=require(root+'/tools/boids-current-runtime.cjs'),commit=process.env.EDIT_LARGE_SELECTION_COMMIT||'07480f8790366ffe68a74afa2a702cf690036cb4',files=runtime.gitFiles(commit),own='src/09c3-wndprocs5-edit.wat';
 files.set(own,expectOld?cp.execFileSync('git',['show',commit+':'+own],{cwd:root}):fs.readFileSync(root+'/'+own));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{maxBuffer:8e6}));
 const wasm=runtime.compile(files),pe=fixture(out);fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));files.set('build/wine-assembly.wasm',wasm);files.set('edit-large-selection.exe',pe);
 save('runtime.json',{commit,expectOld,moduleSHA256:sha(wasm),peSHA256:sha(pe),cases,files:[...files].map(([name,b])=>({name,size:b.length,sha256:sha(b)}))});
 const transient=require(root+'/tools/browser-transients.cjs').create(),logs=[],pending=[],workers=[],failures=[],observations=[];let display,browser,wait,server;
 try{
 server=http.createServer((req,res)=>{const n=new URL(req.url,'http://local').pathname.slice(1)||'index.html',b=files.get(n);res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.html')?'text/html':n.endsWith('.css')?'text/css':n.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.statusCode=b?200:404;res.end(b||'missing');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 display=await require(root+'/tools/gltron-headful-display.cjs').start(out);
 browser=await require(root+'/node_modules/puppeteer').launch({headless:false,defaultViewport:{width:1050,height:800},env:transient.env(display.env),userDataDir:transient.profile,executablePath:'/opt/google/chrome/chrome',args:[...transient.args,'--no-sandbox','--disable-dev-shm-usage','--disable-component-update','--disable-background-networking'],protocolTimeout:20000});wait=transient.watch(browser.process());browser.process().stdout?.resume();browser.process().stderr?.resume();save('browser-version.json',{version:await browser.version()});
 const page=await browser.newPage();page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>logs.push(String(e)));
 page.on('workercreated',w=>{const row={url:w.url(),modules:[]};workers.push(row);const c=w.client;c.on('Debugger.scriptParsed',v=>{if(v.scriptLanguage==='WebAssembly'||v.url.startsWith('wasm://'))pending.push(c.send('Debugger.getScriptSource',{scriptId:v.scriptId}).then(r=>row.modules.push(sha(Buffer.from(r.bytecode,'base64')))));});pending.push(c.send('Debugger.enable'));});
 await page.evaluateOnNewDocument(()=>localStorage.setItem('wine-assembly.threads','1'));await page.goto('http://127.0.0.1:'+server.address().port+'/?debug&threads&no-log');await page.waitForFunction(()=>typeof WineAssembly==='function');
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=650;c.style='position:fixed;left:0;top:0;z-index:99999;width:1000px;height:650px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.editHost=new WineAssembly();editHost.renderer=new Win98Renderer(c);await editHost.init(c);if(!editHost.guestWorker)throw Error('production Worker required');await editHost.loadExe('/edit-large-selection.exe');editHost.run();});
 await page.waitForFunction(()=>Object.values(editHost.renderer.windows).some(w=>w.title==='Authored EDIT large selection READY'),{timeout:15000});
 const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);
 const cpuState=await cpu.evaluate(()=>{const e=instance.exports,names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,registers:Object.fromEntries(names.map(n=>[n,e[n]()>>>0]))};});save('cpu-state.json',cpuState);assert.equal(cpuState.memoryBytes,536870912);assert.equal(Object.keys(cpuState.registers).length,19);assert(cpuState.registers.get_eip&&cpuState.registers.get_esp);
 const geometry=await page.evaluate(()=>{const r=editHost.renderer,f=Object.values(r.windows).find(w=>w.title==='Authored EDIT large selection READY');return {frame:{hwnd:f.hwnd,x:f.x,y:f.y},canvas:r.canvas.getBoundingClientRect().toJSON()};});
 const client=await cpu.evaluate(h=>({x:instance.exports.wnd_client_screen_x(h),y:instance.exports.wnd_client_screen_y(h)}),geometry.frame.hwnd);
 const classRows=await page.evaluate(()=>Object.values(editHost.renderer.windows).filter(w=>w.isChild&&[12,192].includes(w.x)&&w.y<=492).map(w=>({hwnd:w.hwnd,x:w.x,y:w.y})));save('native-controls.json',await cpu.evaluate(rows=>rows.map(r=>({...r,cls:instance.exports.ctrl_get_class(r.hwnd),live:instance.exports.wnd_lookup_live(r.hwnd)})),classRows));assert(JSON.parse(fs.readFileSync(out+'/native-controls.json')).every(r=>r.cls===2&&r.live===1));
 let nativeOrigin=null;
 async function sample(name){
 await new Promise(r=>setTimeout(r,150));const s=await page.evaluate(()=>{const h=editHost,r=h.renderer,w=Object.values(r.windows).find(w=>w.title==='Authored EDIT large selection READY'),p=w._backCanvas._waCanonicalPresentation;return {rows:Object.values(r.windows).map(v=>({hwnd:v.hwnd,title:v.title,x:v.x,y:v.y,w:v.w,h:v.h,isChild:v.isChild})),gdi:p?{sharedGuestStorage:p.surface.storage.buffer===h.memory.buffer,pixels:Array.from(p.surface.rgbaRect(0,0,w.w,w.h))}:null,pixels:Array.from(w._backCanvas.getContext('2d').getImageData(0,0,w.w,w.h).data),width:w.w,height:w.h};});
 assert(s.gdi?.sharedGuestStorage);const pix=Buffer.from(s.pixels),gd=Buffer.from(s.gdi.pixels),surfaces=[],pairs=[];
 for(let j=0;j<cases.length;++j){const y=12+j*32;for(const x of [12,192]){const c=s.rows.find(v=>v.isChild&&v.x===x&&v.y===y);assert(c);const sx=x+client.x-geometry.frame.x+4,sy=y+client.y-geometry.frame.y+4,cw=136,ch=14,bytes=Buffer.alloc(cw*ch*4);for(let row=0;row<ch;++row){const at=((sy+row)*s.width+sx)*4;pix.copy(bytes,row*cw*4,at,at+cw*4);assert(pix.subarray(at,at+cw*4).equals(gd.subarray(at,at+cw*4)),'GDI/backingcanvas agree');}surfaces.push({x:sx,y:sy,w:cw,h:ch,bytes});}pairs.push({j,equal:surfaces.at(-1).bytes.equals(surfaces.at(-2).bytes)});
 const report=s.rows.find(v=>v.isChild&&v.x===365&&v.y===y),got=report.title.trim().split(/\s+/).map(Number),c=cases[j],lo=Math.min(...c.sel),hi=Math.max(...c.sel);

 const state=[lo,hi,c.top,70000,1,0],bytes=Buffer.alloc(24,165);
 if(c.mask&1)bytes.writeUInt32LE(lo,4);if(c.mask&2)bytes.writeUInt32LE(hi,16);
 const packed=hi>65535||lo>65535?4294967295:(hi*65536+lo)>>>0;
 const want=[j,...state,packed,...bytes,...state];
 if(JSON.stringify(got)!==JSON.stringify(want))failures.push({name,j,got,want});
 assert.deepEqual(got.slice(1,7),state,'full public endpoints/text/viewport/modify before retrieval');
 assert.deepEqual(got.slice(8,32),[...bytes],'optional pointer full DWORDs and exact surrounding canaries');
 assert.deepEqual(got.slice(32),state,'retrieval preserves full public endpoints/text/viewport/modify');


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
 await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));
 save('assertions.json',{expectOld,failures,observations:observations.length,productionBrowserCPU:true});
 if(expectOld){assert.equal(failures.length,12,'all overflow requests reproduce oldFAIL');assert(failures.every(f=>f.got[7]!==4294967295 && f.want[7]===4294967295));console.log('PASS supported preedit oldFAIL',failures.length);}else{assert.deepEqual(failures,[]);console.log('PASS native CLASS2 EM_GETSEL 32-bit ordered endpoints, 65535/65536 packed threshold, NULL outputs/canaries and unchanged text/selection/viewport/four surfaces',cases.length);}
 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('transients.json',await transient.cleanup(out));if(display)await display.close();}
}
if(require.main===module)main(process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync(require('node:os').tmpdir()+'/edit-large-selection-'),{expectOld:process.argv.includes('--expect-old')}).catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={cases,fixture,main};
