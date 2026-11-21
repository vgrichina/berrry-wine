'use strict';
// Microsoft primary contract: https://learn.microsoft.com/en-us/windows/win32/controls/bm-setstyle
// Sets button style; LOWORD(lParam) controls redraw; always returns zero.
// Bounded to BS_PUSHBUTTON <-> BS_DEFPUSHBUTTON. No dialog default-ID claim.
// Authored PE, production browser CPU, public messages and independent
// constant-style native siblings. No test export or host-driven guest call.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const cases=[0,1,2,3];
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
long API DialogBoxIndirectParamA(P,const void*,P,P,long);long API SendMessageA(P,U,U,long);
int API SetWindowTextA(P,const char*);long API GetWindowLongA(P,int);P API GetFocus(void);P API SetFocus(P);int API InvalidateRect(P,P,int);int API UpdateWindow(P);
static unsigned short dialog[256];static P b[4],labels[4],edit;static char text[512];static int stage,ready,notices;
void number(U n,int* at){char d[12];int k=0;do{d[k++]='0'+n%10;n/=10;}while(n);while(k)text[(*at)++]=d[--k];text[(*at)++]=' ';}
void report(P h){
 if(stage==8)SetFocus(b[0]);
 for(int j=0;j<4;++j){int at=0;U before=SendMessageA(b[j],0xf2,0,0),check=SendMessageA(b[j],0xf0,0,0),focus=(U)GetFocus(),n=notices,ret=0,kind=j&1;
  if(stage==1||stage==3||stage==4||stage==5||stage==7||stage==8){U target=(stage==1||stage==4||stage==7)?1-kind:kind;
   long redraw=stage==1?0:stage==5?0x10000:stage==4?0x10002:1;
   ret=SendMessageA(b[j],0xf4,target,redraw);
  }
  if(stage==2||stage==6){InvalidateRect(b[j],0,0);UpdateWindow(b[j]);}
  number(stage,&at);number(j,&at);number(GetWindowLongA(b[j],-16),&at);number(SendMessageA(b[j],0x87,0,0),&at);
  number(ret,&at);number(before,&at);number(SendMessageA(b[j],0xf2,0,0),&at);number(check,&at);number(SendMessageA(b[j],0xf0,0,0),&at);
  number(focus== (U)GetFocus(),&at);number(notices-n,&at);text[at]=0;SetWindowTextA(labels[j],text);
 }
 int at=0;number(stage,&at);text[at]=0;SetWindowTextA(h,text);
}
long __stdcall proc(P h,U m,U w,long l){
 if(m==0x111){if(l&&(P)l!=edit)++notices;
  if(ready&&(P)l==edit&&(w>>16)==0x300){++stage;report(h);}return 1;}
 if(m!=0x110)return 0;P inst=GetModuleHandleA(0);
 edit=CreateWindowExA(0,"EDIT","",0x50010000,12,230,160,24,h,(P)50,inst,0);SetFocus(edit);
 for(int j=0;j<4;++j){
  b[j]=CreateWindowExA(0,"BUTTON","",0x50034000+(j&1),12,12+j*46,110,32,h,(P)(100+j),inst,0);
  P ref=CreateWindowExA(0,"BUTTON","",0x50034000+(j&1),142,12+j*46,110,32,h,(P)(200+j),inst,0);
  if(j>=2){SendMessageA(b[j],0xf3,1,0);SendMessageA(ref,0xf3,1,0);}
  labels[j]=CreateWindowExA(0,"STATIC","",0x50000000,270,12+j*46,430,32,h,(P)(300+j),inst,0);
 }
 report(h);ready=1;return 0;
}
void start(void){U* d=(U*)dialog;d[0]=0x90c80000;d[1]=0;dialog[4]=0;dialog[5]=20;dialog[6]=20;dialog[7]=470;dialog[8]=180;
 dialog[9]=0;dialog[10]=0;dialog[11]='B';dialog[12]=0;
 DialogBoxIndirectParamA(GetModuleHandleA(0),dialog,0,proc,0);for(;;){} }
`;
function fixture(out){
 fs.writeFileSync(out+'/fixture.c',source);
 for(const [dll,names]of Object.entries({kernel32:['GetModuleHandleA@4'],user32:['CreateWindowExA@48','DialogBoxIndirectParamA@20','SendMessageA@16','SetWindowTextA@8','GetWindowLongA@8','GetFocus@0','SetFocus@4','InvalidateRect@12','UpdateWindow@4']})){
  fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/fixture.c','-o',out+'/fixture.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/button-dynamic-style.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib']);return fs.readFileSync(out+'/button-dynamic-style.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n');
 const runtime=require(root+'/tools/boids-current-runtime.cjs'),commit=process.env.BUTTON_DYNAMIC_STYLE_COMMIT||cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files=runtime.gitFiles(commit);
 const own='src/09c3-controls0-basic-wndprocs.wat';files.set(own,expectOld?cp.execFileSync('git',['show',commit+':'+own],{cwd:root}):fs.readFileSync(root+'/'+own));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{maxBuffer:8e6}));
 const wasm=runtime.compile(files);fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));const pe=fixture(out);files.set('build/wine-assembly.wasm',wasm);files.set('button-dynamic-style.exe',pe);
 save('runtime.json',{commit,expectOld,testSHA256:sha(fs.readFileSync(__filename)),moduleSHA256:sha(wasm),peSHA256:sha(pe),cases,files:[...files].map(([name,b])=>({name,size:b.length,sha256:sha(b)}))});
 const transient=require(root+'/tools/browser-transients.cjs').create(),logs=[],pending=[],workers=[];let display,browser,wait,server;
 try{
  server=http.createServer((req,res)=>{const n=new URL(req.url,'http://local').pathname.slice(1)||'index.html',b=files.get(n);res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.html')?'text/html':n.endsWith('.css')?'text/css':n.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.statusCode=b?200:404;res.end(b||'missing');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  display=await require(root+'/tools/gltron-headful-display.cjs').start(out);
  browser=await require(root+'/node_modules/puppeteer').launch({headless:false,defaultViewport:{width:1050,height:800},env:transient.env(display.env),userDataDir:transient.profile,executablePath:'/opt/google/chrome/chrome',args:[...transient.args,'--no-sandbox','--disable-dev-shm-usage','--disable-component-update','--disable-background-networking'],protocolTimeout:20000});wait=transient.watch(browser.process());browser.process().stdout?.resume();browser.process().stderr?.resume();save('browser-version.json',{version:await browser.version()});
  const page=await browser.newPage();page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>logs.push(String(e)));
  page.on('workercreated',w=>{const row={url:w.url(),modules:[]};workers.push(row);const c=w.client;c.on('Debugger.scriptParsed',v=>{if(v.scriptLanguage==='WebAssembly'||v.url.startsWith('wasm://'))pending.push(c.send('Debugger.getScriptSource',{scriptId:v.scriptId}).then(r=>row.modules.push(sha(Buffer.from(r.bytecode,'base64')))));});pending.push(c.send('Debugger.enable'));});
  await page.evaluateOnNewDocument(()=>localStorage.setItem('wine-assembly.threads','1'));await page.goto('http://127.0.0.1:'+server.address().port+'/?debug&threads&no-log');await page.waitForFunction(()=>typeof WineAssembly==='function');
  await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=650;c.style='position:fixed;left:0;top:0;z-index:99999;width:1000px;height:650px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.buttonHost=new WineAssembly();buttonHost.renderer=new Win98Renderer(c);await buttonHost.init(c);if(!buttonHost.guestWorker)throw Error('production Worker required');await buttonHost.loadExe('/button-dynamic-style.exe');buttonHost.run();});

  await page.waitForFunction(()=>Object.values(buttonHost.renderer.windows).some(w=>w.title.trim()==='0'&&!w.isChild),{timeout:15000});
  const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);
  const failures=[],results=[],{PNG}=require(root+'/node_modules/pngjs');
  await page.evaluate(()=>{browserInput.wireCanvasInput(buttonHost.renderer.canvas,buttonHost.renderer,{runningApps:[{wine:buttonHost}],debugMode:true});buttonHost.renderer.canvas.focus();});
  let nativeOrigin=null;
  for(let stage=0;stage<=8;++stage){
   if(stage){await page.keyboard.type('a');await page.waitForFunction(n=>Object.values(buttonHost.renderer.windows).some(w=>w.title.trim()===String(n)&&!w.isChild),{timeout:10000},stage);}
   await new Promise(r=>setTimeout(r,200));
   const s=await page.evaluate(()=>{const h=buttonHost,r=h.renderer,w=Object.values(r.windows).find(w=>!w.isChild&&w.title.trim().match(/^[0-8]$/)),p=w._backCanvas._waCanonicalPresentation;return {memoryBytes:h.memory.buffer.byteLength,rows:Object.values(r.windows).map(v=>({hwnd:v.hwnd,parent:v.parent,title:v.title,x:v.x,y:v.y,w:v.w,h:v.h,visible:v.visible,isChild:v.isChild})),gdi:p?{sharedGuestStorage:p.surface.storage.buffer===h.memory.buffer,pixels:Array.from(p.surface.rgbaRect(0,0,w.w,w.h))}:null,pixels:Array.from(w._backCanvas.getContext('2d').getImageData(0,0,w.w,w.h).data),width:w.w,height:w.h,canvas:r.canvas.getBoundingClientRect().toJSON()};});
   const frame=s.rows.find(w=>!w.isChild&&w.title.trim()===String(stage)),buttons=cases.map(j=>s.rows.find(w=>w.isChild&&w.x===12&&w.y===12+j*46));
   assert(buttons.every(Boolean));
   const cpuState=await cpu.evaluate(({handles,frame})=>{const e=instance.exports,names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,frameClient:{x:e.wnd_client_screen_x(frame),y:e.wnd_client_screen_y(frame)},registers:Object.fromEntries(names.map(n=>[n,e[n]()>>>0])),controls:handles.map(h=>({hwnd:h,cls:e.ctrl_get_class(h),live:e.wnd_lookup_live(h)}))};},{handles:buttons.map(b=>b.hwnd),frame:frame.hwnd});
   save('cpu-'+stage+'.json',cpuState);assert.equal(cpuState.memoryBytes,536870912);assert.equal(Object.keys(cpuState.registers).length,19);assert(cpuState.registers.get_eip&&cpuState.registers.get_esp);
   assert(cpuState.controls.every(b=>b.cls===1&&b.live===1),'actual native CLASS1');
   assert(s.gdi?.sharedGuestStorage);const pix=Buffer.from(s.pixels),gd=Buffer.from(s.gdi.pixels);
   const crop=b=>{const x=b.x+cpuState.frameClient.x-frame.x,y=b.y+cpuState.frameClient.y-frame.y,w=b.w,h=b.h,bytes=Buffer.alloc(w*h*4);
    for(let row=0;row<h;++row){const at=((y+row)*s.width+x)*4;pix.copy(bytes,row*w*4,at,at+w*4);assert(pix.subarray(at,at+w*4).equals(gd.subarray(at,at+w*4)),'shared GDI/backing agree');}return {x,y,w,h,bytes};};
   const surfaces=[];
   for(let j=0;j<4;++j){const kind=j&1,newKind=[1,2,4,7].includes(stage)?1-kind:kind,shownKind=[2,4,5,7].includes(stage)?1-kind:kind;
    const got=s.rows.find(w=>w.isChild&&w.x===270&&w.y===12+j*46).title.trim().split(/\s+/).map(Number);
    const state=(j>=2?4:0)+(stage===8&&j===0?8:0);
    const want=[stage,j,(0x50034000+newKind)>>>0,newKind?0x2010:0x2020,0,state,state,0,0,1,0];
    const publicPass=JSON.stringify(got)===JSON.stringify(want);if(!publicPass)failures.push({stage,j,got,want});
    const observed=crop(buttons[j]),refIndex=(j>=2?2:0)+shownKind,reference=crop(s.rows.find(w=>w.isChild&&w.x===142&&w.y===12+refIndex*46));
    // Permanent constant-style siblings are independent references, never
    // derived from BM_SETSTYLE or the candidate handler's observed bytes.
    const visualPass=stage===8?null:observed.bytes.equals(reference.bytes);if(visualPass===false)failures.push({stage,j,visual:false,shownKind});
    // Independently require the documented heavy black default outline.
    const refDefault=crop(s.rows.find(w=>w.isChild&&w.x===142&&w.y===12+(j>=2?3:1)*46));
    if(stage<8)for(let x=0;x<refDefault.w;++x)assert.deepEqual([...refDefault.bytes.subarray(x*4,x*4+4)],[0,0,0,255]);
    surfaces.push(observed,reference);results.push({stage,j,got,want,publicPass,visualPass,shownKind});
   }
   await page.screenshot({path:out+'/composited-'+stage+'.png'});require(root+'/tools/browser-transients.cjs').captureWhole(out,'desktop-'+stage,display.env);
   const composite=PNG.sync.read(fs.readFileSync(out+'/composited-'+stage+'.png')),desktop=PNG.sync.read(fs.readFileSync(out+'/desktop-'+stage+'.png'));
   const match=(png,v,ox,oy)=>{const x=Math.round(ox+v.x),y=Math.round(oy+v.y);if(x<0||y<0||x+v.w>png.width||y+v.h>png.height)return false;for(let row=0;row<v.h;++row)if(!png.data.subarray(((y+row)*png.width+x)*4,((y+row)*png.width+x+v.w)*4).equals(v.bytes.subarray(row*v.w*4,(row+1)*v.w*4)))return false;return true;};
   assert(surfaces.every(v=>match(composite,v,s.canvas.x+frame.x,s.canvas.y+frame.y)),'exact compositor');
   if(!nativeOrigin){const first=surfaces[0],needle=first.bytes.subarray(8*first.w*4,9*first.w*4);for(let at=desktop.data.indexOf(needle);at>=0;at=desktop.data.indexOf(needle,at+1)){if(at%4)continue;const ox=at/4%desktop.width-first.x,oy=Math.floor(at/4/desktop.width)-first.y-8;if(surfaces.every(v=>match(desktop,v,ox,oy))){nativeOrigin={x:ox,y:oy};break;}}}
   assert(nativeOrigin&&surfaces.every(v=>match(desktop,v,nativeOrigin.x,nativeOrigin.y)),'exact native desktop, stable origin');
   save('visible-'+stage+'.json',{nativeOrigin,surfaces:surfaces.map(({bytes,...v})=>({...v,sha256:sha(bytes)}))});
   s.gdi.sha256=sha(gd);delete s.gdi.pixels;delete s.pixels;save('scene-'+stage+'.json',s);
  }
  await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));
  save('assertions.json',{expectOld,failures,results,productionBrowserCPU:true});
  if(expectOld){assert(failures.some(f=>f.stage===1&&f.got),'preedit must fail public style/code');assert(failures.some(f=>f.visual===false),'preedit must fail default outline');console.log('PASS supported preedit oldFAIL',failures.length);}else{assert.deepEqual(failures,[]);console.log('PASS BM_SETSTYLE public style/code/state/focus/notifications and constant-reference GDI/backing/compositor/native redraw pixels',results.length);}

 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('transients.json',await transient.cleanup(out));if(display)await display.close();}
}
if(require.main===module)main(process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync(require('node:os').tmpdir()+'/button-dynamic-style-return-'),{expectOld:process.argv.includes('--expect-old')}).catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={fixture,main};
