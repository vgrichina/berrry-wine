'use strict';
// Microsoft primary FIRST: https://learn.microsoft.com/en-us/windows/win32/controls/em-posfromchar
// SDK WinUser.h: 0x00D6. Plain EDIT wParam=zero-based document character,
// lParam unused; signed client x/y in LOWORD/HIWORD, beyond last=-1.
// End insertion point is out of range. Delimiters use the line text end.
// Existing 4px origins, 16px rows and selected fixed font geometry are local
// references, not a claim of Windows pixel parity. ASCII unwrapped left EDIT;
// RichEdit, Unicode/codepages, wrap/password/alignment/tab geometry excluded.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const cases=[
  {
    "top": 0,
    "font": 16,
    "style": 0,
    "x": 20,
    "y": 4,
    "index": 2,
    "text": "ALPHA",
    "want": 262164
  },
  {
    "top": 0,
    "font": 16,
    "style": 0,
    "x": 36,
    "y": 4,
    "index": 4,
    "text": "ALPHA",
    "want": 262180
  },
  {
    "top": 0,
    "font": 16,
    "style": 0,
    "x": 0,
    "y": 0,
    "index": 5,
    "text": "ALPHA",
    "invalid": true,
    "want": 4294967295
  },
  {
    "top": 0,
    "font": 16,
    "style": 0,
    "x": 0,
    "y": 0,
    "index": 6,
    "text": "ALPHA",
    "invalid": true,
    "want": 4294967295
  },
  {
    "top": 0,
    "font": 16,
    "style": 0,
    "x": 0,
    "y": 0,
    "index": 4294967295,
    "text": "ALPHA",
    "invalid": true,
    "want": 4294967295
  },
  {
    "top": 0,
    "font": 16,
    "style": 132,
    "x": 44,
    "y": 4,
    "index": 5,
    "text": "ALPHA\r\nBRAVO",
    "want": 262188
  },
  {
    "top": 0,
    "font": 16,
    "style": 132,
    "x": 44,
    "y": 4,
    "index": 6,
    "text": "ALPHA\r\nBRAVO",
    "want": 262188
  },
  {
    "top": 0,
    "font": 16,
    "style": 132,
    "x": 20,
    "y": 20,
    "index": 9,
    "text": "ALPHA\r\nBRAVO",
    "want": 1310740
  },
  {
    "top": 2,
    "font": 16,
    "style": 132,
    "x": 20,
    "y": -28,
    "index": 2,
    "text": "ALPHA\r\nBRAVO\r\nCHARLIE\r\nDELTA",
    "want": 4293132308
  },
  {
    "top": 2,
    "font": 16,
    "style": 132,
    "x": 12,
    "y": 4,
    "index": 15,
    "text": "ALPHA\r\nBRAVO\r\nCHARLIE\r\nDELTA",
    "want": 262156
  },
  {
    "top": 0,
    "font": 16,
    "style": 132,
    "x": 12,
    "y": 52,
    "index": 24,
    "text": "ALPHA\r\nBRAVO\r\nCHARLIE\r\nDELTA",
    "want": 3407884
  },
  {
    "top": 0,
    "font": 16,
    "style": 1048708,
    "x": -4,
    "y": 4,
    "index": 0,
    "text": "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    "hscroll": true,
    "want": 327676
  },
  {
    "top": 0,
    "font": 11,
    "style": 2048,
    "x": 28,
    "y": 4,
    "index": 3,
    "text": "ALPHA",
    "want": 262172
  },
  {
    "top": 0,
    "font": 16,
    "style": 0,
    "x": 0,
    "y": 0,
    "index": 0,
    "text": "",
    "invalid": true,
    "want": 4294967295
  },
  {
    "top": 0,
    "font": 16,
    "style": 1,
    "x": 0,
    "y": 0,
    "index": 2,
    "text": "ALPHA",
    "unsupported": "center alignment",
    "want": 0
  },
  {
    "top": 0,
    "font": 16,
    "style": 32,
    "x": 0,
    "y": 0,
    "index": 2,
    "text": "ALPHA",
    "unsupported": "password",
    "want": 0
  },
  {
    "top": 0,
    "font": 16,
    "style": 0,
    "x": 0,
    "y": 0,
    "index": 2,
    "text": "A\tB",
    "unsupported": "tabs",
    "want": 0
  },
  {
    "top": 0,
    "font": 16,
    "style": 2097156,
    "x": 0,
    "y": 0,
    "index": 2,
    "text": "ALPHA BRAVO CHARLIE DELTA ECHO",
    "unsupported": "display wrap",
    "want": 0
  }
];
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API GetStockObject(int);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
long API DialogBoxIndirectParamA(P,const void*,P,P,long);long API SendMessageA(P,U,U,long);int API SetWindowTextA(P,const char*);P API SetFocus(P);P API GetFocus(void);P API GetDC(P);int API ReleaseDC(P,P);int API UpdateWindow(P);int API GetCaretPos(void*);int API PatBlt(P,int,int,int,int,U);
struct C{char*text;U style,index,want,top,font,hscroll;};static struct C cases[N]=CASES;
static P first,reference,caretReport,edits[N],refs[N];static unsigned short dialog[256];static char report[512],value[256];
void number(U n,int* at){char d[12];int k=0;do{d[k++]='0'+n%10;n/=10;}while(n);while(k)report[(*at)++]=d[--k];report[(*at)++]=' ';}
int same(char*a,char*b){int k=0;while(a[k]&&a[k]==b[k])++k;return a[k]==b[k];}
void setup(P e,struct C*c){SendMessageA(e,0x30,(U)GetStockObject(c->font),1);SendMessageA(e,0xb1,1,3);SendMessageA(e,0xb6,0,c->top);SendMessageA(e,0xb9,1,0);SendMessageA(e,15,0,0);
if(c->hscroll){SendMessageA(e,0x201,0,(34<<16)|150);SendMessageA(e,0x202,0,(34<<16)|150);SendMessageA(e,8,0,0);}}
long __stdcall proc(P h,U m,U w,long l){P i=GetModuleHandleA(0);if(m==0x111&&w==900){int at=0;long before[2],after[2];U hit=2;SendMessageA(first,0xb1,hit,hit);SendMessageA(reference,0xb1,2,2);SetFocus(first);UpdateWindow(first);UpdateWindow(reference);GetCaretPos(before);P focus=GetFocus();U query=SendMessageA(first,0xd6,2,0xdeadbeef);GetCaretPos(after);number(query,&at);number(before[0],&at);number(before[1],&at);number(after[0],&at);number(after[1],&at);number(focus==GetFocus(),&at);report[at]=0;SetWindowTextA(caretReport,report);for(int j=0;j<N;++j){struct C*c=&cases[j];UpdateWindow(edits[j]);UpdateWindow(refs[j]);if(c->want==0xffffffff||j>=14)continue;U xy=SendMessageA(edits[j],0xd6,c->index,0);P dc=GetDC(edits[j]);PatBlt(dc,(short)xy,(short)(xy>>16),2,15,0x00000042);ReleaseDC(edits[j],dc);dc=GetDC(refs[j]);PatBlt(dc,(short)c->want,(short)(c->want>>16),2,15,0x00000042);ReleaseDC(refs[j],dc);}return 1;}if(m==0x110){
 for(int j=0;j<N;++j){struct C*c=&cases[j];int y=12+j*44,at=0;U lo=0,hi=0;
 P e=CreateWindowExA(0,"EDIT",c->text,0x50800000|c->style,12,y,160,42,h,(P)(100+j),i,0);
 P ref=CreateWindowExA(0,"EDIT",c->text,0x50800000|c->style,192,y,160,42,h,(P)(200+j),i,0);
 edits[j]=e;refs[j]=ref;if(j==0){first=e;reference=ref;}setup(e,c);setup(ref,c);number(j,&at);
 number(SendMessageA(e,0xd6,c->index,0x13579bdf),&at);number(SendMessageA(e,0xd6,c->index,0),&at);
 number(SendMessageA(e,0xb0,(U)&lo,(long)&hi),&at);number(lo,&at);number(hi,&at);
 number(SendMessageA(e,0xce,0,0),&at);number(SendMessageA(e,13,256,(long)value),&at);number(same(value,c->text),&at);number(SendMessageA(e,0xb8,0,0)!=0,&at);
 report[at]=0;CreateWindowExA(0,"STATIC",report,0x50000000,365,y,350,40,h,(P)(300+j),i,0);
 // Placement markers are drawn by the public button after startup painting.
 }
 CreateWindowExA(0,"BUTTON","Caret canary",0x50000000,365,812,140,24,h,(P)900,i,0);caretReport=CreateWindowExA(0,"STATIC","pending",0x50000000,365,844,350,24,h,(P)901,i,0);
 SetWindowTextA(h,"Authored EDIT position from char READY");return 1;}return 0;}
void start(void){U*d=(U*)dialog;d[0]=0x90c80000;dialog[7]=500;dialog[8]=530;dialog[11]='E';DialogBoxIndirectParamA(GetModuleHandleA(0),dialog,0,proc,0);for(;;){} }
`.replace(/\bN\b/g,String(cases.length)).replace('CASES','{'+cases.map(c=>'{'+[JSON.stringify(c.text).replace(/[\u0080-\uffff]/g,ch=>'\\'+ch.charCodeAt(0).toString(8).padStart(3,'0')),c.style,c.index,c.want,c.top,c.font,c.hscroll?1:0].join(',')+'}').join(',')+'}');
function fixture(out){
 fs.writeFileSync(out+'/fixture.c',source);
 for(const [dll,names]of Object.entries({kernel32:['GetModuleHandleA@4'],gdi32:['GetStockObject@4','PatBlt@24'],user32:['CreateWindowExA@48','DialogBoxIndirectParamA@20','SendMessageA@16','SetWindowTextA@8','SetFocus@4','GetFocus@0','GetDC@4','ReleaseDC@8','UpdateWindow@4','GetCaretPos@4']})){
 fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/fixture.c','-o',out+'/fixture.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/edit-position-from-char.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib',out+'/gdi32.lib']);return fs.readFileSync(out+'/edit-position-from-char.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n');
 const runtime=require(root+'/tools/boids-current-runtime.cjs'),commit=process.env.EDIT_POSITION_FROM_CHAR_COMMIT||cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files=runtime.gitFiles(commit),own='src/09c3-wndprocs5-edit.wat';
 files.set(own,fs.readFileSync(root+'/'+own));
 if(process.env.EDIT_POSITION_FROM_CHAR_SHARED){for(const n of files.keys())if(fs.existsSync(root+'/'+n))files.set(n,fs.readFileSync(root+'/'+n));}
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{maxBuffer:8e6}));
 const wasm=process.env.EDIT_POSITION_FROM_CHAR_MODULE?fs.readFileSync(process.env.EDIT_POSITION_FROM_CHAR_MODULE):runtime.compile(files),pe=fixture(out);fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));files.set('build/wine-assembly.wasm',wasm);files.set('edit-position-from-char.exe',pe);
 save('runtime.json',{commit,expectOld,moduleSHA256:sha(wasm),peSHA256:sha(pe),cases,files:[...files].map(([name,b])=>({name,size:b.length,sha256:sha(b)}))});
 const markerHashes=[];
 const transient=require(root+'/tools/browser-transients.cjs').create(),logs=[],pending=[],workers=[],failures=[],observations=[];let display,browser,wait,server;
 try{
 server=http.createServer((req,res)=>{const n=new URL(req.url,'http://local').pathname.slice(1)||'index.html',b=files.get(n);res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.html')?'text/html':n.endsWith('.css')?'text/css':n.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.statusCode=b?200:404;res.end(b||'missing');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 display=await require(root+'/tools/gltron-headful-display.cjs').start(out);
 browser=await require(root+'/node_modules/puppeteer').launch({headless:false,defaultViewport:{width:1050,height:1000},env:transient.env(display.env),userDataDir:transient.profile,executablePath:'/opt/google/chrome/chrome',args:[...transient.args,'--no-sandbox','--disable-dev-shm-usage','--disable-component-update','--disable-background-networking'],protocolTimeout:20000});wait=transient.watch(browser.process());browser.process().stdout?.resume();browser.process().stderr?.resume();save('browser-version.json',{version:await browser.version()});
 const page=await browser.newPage();page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>logs.push(String(e)));
 page.on('workercreated',w=>{const row={url:w.url(),modules:[]};workers.push(row);const c=w.client;c.on('Debugger.scriptParsed',v=>{if(v.scriptLanguage==='WebAssembly'||v.url.startsWith('wasm://'))pending.push(c.send('Debugger.getScriptSource',{scriptId:v.scriptId}).then(r=>row.modules.push(sha(Buffer.from(r.bytecode,'base64')))));});pending.push(c.send('Debugger.enable'));});
 await page.evaluateOnNewDocument(()=>localStorage.setItem('wine-assembly.threads','1'));await page.goto('http://127.0.0.1:'+server.address().port+'/?debug&threads&no-log');await page.waitForFunction(()=>typeof WineAssembly==='function');
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=950;c.style='position:fixed;left:0;top:0;z-index:99999;width:1000px;height:950px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.editHost=new WineAssembly();editHost.renderer=new Win98Renderer(c);await editHost.init(c);if(!editHost.guestWorker)throw Error('production Worker required');await editHost.loadExe('/edit-position-from-char.exe');editHost.run();});
 await page.waitForFunction(()=>Object.values(editHost.renderer.windows).some(w=>w.title==='Authored EDIT position from char READY'),{timeout:15000});
 const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);
 const cpuState=await cpu.evaluate(()=>{const e=instance.exports,names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,registers:Object.fromEntries(names.map(n=>[n,e[n]()>>>0]))};});save('cpu-state.json',cpuState);assert.equal(cpuState.memoryBytes,536870912);assert.equal(Object.keys(cpuState.registers).length,19);assert(cpuState.registers.get_eip&&cpuState.registers.get_esp);
 const geometry=await page.evaluate(()=>{const r=editHost.renderer,f=Object.values(r.windows).find(w=>w.title==='Authored EDIT position from char READY');return {frame:{hwnd:f.hwnd,x:f.x,y:f.y},canvas:r.canvas.getBoundingClientRect().toJSON()};});
 const client=await cpu.evaluate(h=>({x:instance.exports.wnd_client_screen_x(h),y:instance.exports.wnd_client_screen_y(h)}),geometry.frame.hwnd);
 const classRows=await page.evaluate(()=>Object.values(editHost.renderer.windows).filter(w=>w.isChild&&[12,192].includes(w.x)&&w.y<=800).map(w=>({hwnd:w.hwnd,x:w.x,y:w.y})));save('native-controls.json',await cpu.evaluate(rows=>rows.map(r=>({...r,cls:instance.exports.ctrl_get_class(r.hwnd),live:instance.exports.wnd_lookup_live(r.hwnd)})),classRows));assert(JSON.parse(fs.readFileSync(out+'/native-controls.json')).every(r=>r.cls===2&&r.live===1));
 let nativeOrigin=null;
 async function sample(name){
 await new Promise(r=>setTimeout(r,150));const s=await page.evaluate(()=>{const h=editHost,r=h.renderer,w=Object.values(r.windows).find(w=>w.title==='Authored EDIT position from char READY'),p=w._backCanvas._waCanonicalPresentation;return {rows:Object.values(r.windows).map(v=>({hwnd:v.hwnd,title:v.title,x:v.x,y:v.y,w:v.w,h:v.h,isChild:v.isChild})),gdi:p?{sharedGuestStorage:p.surface.storage.buffer===h.memory.buffer,pixels:Array.from(p.surface.rgbaRect(0,0,w.w,w.h))}:null,pixels:Array.from(w._backCanvas.getContext('2d').getImageData(0,0,w.w,w.h).data),width:w.w,height:w.h};});
 assert(s.gdi?.sharedGuestStorage);const pix=Buffer.from(s.pixels),gd=Buffer.from(s.gdi.pixels),surfaces=[],pairs=[];
 for(let j=0;j<cases.length;++j){const y=12+j*44;for(const x of [12,192]){const c=s.rows.find(v=>v.isChild&&v.x===x&&v.y===y);assert(c);const sx=x+client.x-geometry.frame.x+4,sy=y+client.y-geometry.frame.y+4,cw=136,ch=32,bytes=Buffer.alloc(cw*ch*4);for(let row=0;row<ch;++row){const at=((sy+row)*s.width+sx)*4;pix.copy(bytes,row*cw*4,at,at+cw*4);assert(pix.subarray(at,at+cw*4).equals(gd.subarray(at,at+cw*4)),'GDI/backingcanvas agree');}surfaces.push({x:sx,y:sy,w:cw,h:ch,bytes});}pairs.push({j,equal:surfaces.at(-1).bytes.equals(surfaces.at(-2).bytes)});
 const report=s.rows.find(v=>v.isChild&&v.x===365&&v.y===y),got=report.title.trim().split(/\s+/).map(Number),c=cases[j],lo=c.text.length?1:0,hi=Math.min(3,c.text.length),want=[j,c.want,c.want,(hi*65536+lo)>>>0,lo,hi,c.top,c.text.length,1,1];
 if(JSON.stringify(got)!==JSON.stringify(want))failures.push({name,j,got,want});
 }
 await page.screenshot({path:out+'/'+name+'-composited.png'});require(root+'/tools/browser-transients.cjs').captureWhole(out,name+'-desktop',display.env);
 const {PNG}=require(root+'/node_modules/pngjs'),composite=PNG.sync.read(fs.readFileSync(out+'/'+name+'-composited.png')),desktop=PNG.sync.read(fs.readFileSync(out+'/'+name+'-desktop.png'));
 const match=(png,v,ox,oy)=>{const x=Math.round(ox+v.x),y=Math.round(oy+v.y);if(x<0||y<0||x+v.w>png.width||y+v.h>png.height)return false;for(let row=0;row<v.h;++row)if(!png.data.subarray(((y+row)*png.width+x)*4,((y+row)*png.width+x+v.w)*4).equals(v.bytes.subarray(row*v.w*4,(row+1)*v.w*4)))return false;return true;};
 assert(surfaces.every(v=>match(composite,v,geometry.canvas.x+geometry.frame.x,geometry.canvas.y+geometry.frame.y)),'compositor exact EDIT surfaces');
 const first=surfaces[0],needle=first.bytes.subarray(10*first.w*4,11*first.w*4);let origin=nativeOrigin;
 if(!origin)for(let at=desktop.data.indexOf(needle);at>=0;at=desktop.data.indexOf(needle,at+1)){if(at%4)continue;const ox=at/4%desktop.width-first.x,oy=Math.floor(at/4/desktop.width)-first.y-10;if(ox>=0&&oy>=0&&surfaces.every(v=>match(desktop,v,ox,oy))){origin={x:ox,y:oy};break;}}
 assert(origin&&surfaces.every(v=>match(desktop,v,origin.x,origin.y)),'native desktop exact EDIT surfaces at established dialog origin');nativeOrigin=origin;
 markerHashes.push({name,hashes:surfaces.map(v=>sha(v.bytes))});
 save(name+'-visible.json',{origin,pairs,exactGDI:true,exactCompositor:true,exactNativeDesktop:true,surfaces:surfaces.map(({bytes,...v})=>({...v,sha256:sha(bytes)}))});
 if(!expectOld)assert(pairs.every(v=>v.equal),'independent text and returned-position placement markers');
 delete s.pixels;delete s.gdi.pixels;observations.push({name,rows:s.rows,pairs});save('observations.json',observations);
 }
 await sample('initial');
 await page.evaluate(()=>{browserInput.wireCanvasInput(editHost.renderer.canvas,editHost.renderer,{runningApps:[{wine:editHost}],debugMode:true});editHost.renderer.canvas.focus();});
 // Public button command collapses the caret selection, focuses the real edit,
 // and draws queried positions against constant 2x15 references.
 // The Worker renderer's caret mirror is observed separately; these markers
 // visualize character positions without claiming caret mirror/overlay parity.
 const button=await page.evaluate(()=>{const r=editHost.renderer,b=Object.values(r.windows).find(w=>w.isChild&&w.title==='Caret canary'),f=Object.values(r.windows).find(w=>w.title==='Authored EDIT position from char READY');return {x:b.x,y:b.y};});
 await page.mouse.click(geometry.canvas.x+client.x+button.x+30,geometry.canvas.y+client.y+button.y+10);
 await page.waitForFunction(()=>Object.values(editHost.renderer.windows).some(w=>w.isChild&&w.x===365&&w.y===844&&w.title!=='pending'),{timeout:10000});
 save('caret-diagnostics.json',{cpu:await cpu.evaluate(()=>Object.fromEntries(['get_caret_hwnd','get_caret_visible','get_caret_x','get_caret_y','get_caret_w','get_caret_h'].map(n=>[n,instance.exports[n]()]))) ,renderer:await page.evaluate(()=>{const r=editHost.renderer,e=r.wasm?.exports;return {rect:r.caretRect(),mirror:e?Object.fromEntries(['get_caret_hwnd','get_caret_visible','get_caret_x','get_caret_y'].map(n=>[n,e[n]?.()])):null,rows:Object.values(r.windows).slice(0,4).map(w=>({hwnd:w.hwnd,x:w.x,y:w.y,parent:w.parentHwnd,visible:w.visible,wasm:!!w.wasm}))};})});
 const caret=await page.evaluate(()=>{const r=editHost.renderer;return {report:Object.values(r.windows).find(w=>w.isChild&&w.x===365&&w.y===844).title,rect:r.caretRect()};});
 save('caret.json',caret);
 if(!expectOld)assert.deepEqual(caret.report.trim().split(/\s+/).map(Number),[262164,20,2,20,2,1],'query preserves focused visible caret position');
 await sample('caret');
 // Visible reference markers must survive to the sampled planes. A match of
 // unmarked controls would not establish placement. These indexes have ink
 // inside the retained crop and unchanged text/selection (except index 0).
 for(const j of [1,5,6,7,9,12])assert.notEqual(markerHashes[0].hashes[j*2+1],markerHashes[1].hashes[j*2+1], 'reference placement marker visibly changed '+j);
 save('marker-hashes.json',markerHashes);
 await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));
 save('assertions.json',{expectOld,failures,observations:observations.length,productionBrowserCPU:true});
 if(expectOld){assert.equal(failures.length,cases.filter(c=>c.want!==0).length*observations.length,'supported position messages reproduce oldFAIL');assert(failures.every(f=>f.got[1]===0&&f.got[2]===0));console.log('PASS physical preedit oldFAIL',failures.length);}else{assert.deepEqual(failures,[]);console.log('PASS documented bounded EDIT POSFROMCHAR, ignored lParam, selection/modify/scroll preservation and four-plane references',cases.length);}
 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('transients.json',await transient.cleanup(out));if(display)await display.close();}
}
if(require.main===module)main(process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync(require('node:os').tmpdir()+'/edit-position-from-char-'),{expectOld:process.argv.includes('--expect-old')}).catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={cases,fixture,main};
