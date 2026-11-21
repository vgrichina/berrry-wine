'use strict';
// Microsoft primary contract: https://learn.microsoft.com/en-us/windows/win32/controls/bm-click
// BM_CLICK delivers DOWN, UP and parent BN_CLICKED; no return-value contract.
// Active enabled dialog BUTTONs only. Independent constant-state siblings,
// public subclass order/current ID/HWND/check/style/focus assertions, production CPU.
// Reentrant/destroying callbacks are robustness probes, not Windows oracle claims.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const cases=[0,1,2,3,4,9,0,0];
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
long API DialogBoxIndirectParamA(P,const void*,P,P,long);long API SendMessageA(P,U,U,long);int API PostMessageA(P,U,U,long);
int API SetWindowTextA(P,const char*);long API GetWindowLongA(P,int);long API SetWindowLongA(P,int,long);long API CallWindowProcA(P,P,U,U,long);
P API GetFocus(void);P API SetFocus(P);P API SetActiveWindow(P);int API IsWindow(P);int API DestroyWindow(P);
static unsigned short dialog[256];static P b[8],ref[8],label,edit;static long old[8];static char text[512];
static int kinds[8]={0,1,2,3,4,9,0,0},stage,ready,seq,clicks,idok,hwndok,seen,focused,down,up,nesting,target;
void number(U n,int* at){char d[12];int k=0;do{d[k++]='0'+n%10;n/=10;}while(n);while(k)text[(*at)++]=d[--k];text[(*at)++]=' ';}
long __stdcall sub(P h,U m,U w,long l){int j;for(j=0;j<8&&b[j]!=h;++j){}if(j==8)return 0;
 if(m==0x201){seq=seq*10+1;
  if(stage==7&&!nesting){nesting=1;SendMessageA(h,0xf5,0,0);nesting=0;}
  if(stage==8){SetFocus(edit);DestroyWindow(h);return 0;}
  long r=CallWindowProcA((P)old[j],h,m,w,l);down=(SendMessageA(h,0xf2,0,0)&4)!=0;return r;
 }
 if(m==0x202){seq=seq*10+2;up=(SendMessageA(h,0xf2,0,0)&4)!=0;}
 return CallWindowProcA((P)old[j],h,m,w,l);
}
void report(P h){int at=0;number(stage,&at);number(seq,&at);number(clicks,&at);number(idok,&at);number(hwndok,&at);number(seen,&at);
 number(IsWindow(b[target])?SendMessageA(b[target],0xf0,0,0):99,&at);number(IsWindow(b[target])?GetWindowLongA(b[target],-16):0,&at);
 number(focused,&at);number(down,&at);number(up,&at);number(IsWindow(b[target]),&at);
 SetFocus(edit);number(GetFocus()==edit,&at);text[at]=0;SetWindowTextA(label,text);
 at=0;number(stage,&at);text[at]=0;SetWindowTextA(h,text);
}
long __stdcall proc(P h,U m,U w,long l){
 if(m==0x111){if(l&&(w>>16)==0&&(P)l!=edit){seq=seq*10+3;++clicks;idok=(w&65535)==(stage==7?777:100+target);hwndok=(P)l==b[target];
  seen=SendMessageA((P)l,0xf0,0,0);focused=GetFocus()==(P)l;if(stage==9){SetFocus(edit);DestroyWindow((P)l);}}
  if(ready&&(P)l==edit&&(w>>16)==0x300){++stage;target=stage<=6?stage-1:stage==7?0:stage==8?6:7;
   seq=clicks=idok=hwndok=seen=focused=down=up=0;
   if(stage==7)SetWindowLongA(b[target],-12,777);
   SetActiveWindow(h);SendMessageA(b[target],0xf5,0,0);PostMessageA(h,0x8001,0,0);}
  return 1;}
 if(m==0x8001){report(h);return 1;}
 if(m!=0x110)return 0;P inst=GetModuleHandleA(0);
 edit=CreateWindowExA(0,"EDIT","",0x50010000,12,410,160,24,h,(P)50,inst,0);SetFocus(edit);
 P referenceParent=CreateWindowExA(0,"STATIC","",0x50000000,0,0,0,0,h,(P)51,inst,0);
 for(int j=0;j<8;++j){
  b[j]=CreateWindowExA(0,"BUTTON","",0x50010000+kinds[j],12,12+j*46,110,32,h,(P)(100+j),inst,0);
  ref[j]=CreateWindowExA(0,"BUTTON","",0x50010000+(j==5?4:kinds[j]),142,12+j*46,110,32,referenceParent,(P)(200+j),inst,0);
  if(j==2||j==4){SendMessageA(b[j],0xf1,1,0);SendMessageA(ref[j],0xf1,1,0);}
  if(j==3||j==5)SendMessageA(ref[j],0xf1,1,0);
  old[j]=SetWindowLongA(b[j],-4,(long)sub);
 }
 label=CreateWindowExA(0,"STATIC","",0x50000000,270,12,430,32,h,(P)300,inst,0);
 SetActiveWindow(h);report(h);ready=1;return 0;
}
void start(void){U* d=(U*)dialog;d[0]=0x90c80000;d[1]=0;dialog[4]=0;dialog[5]=20;dialog[6]=20;dialog[7]=470;dialog[8]=305;
 dialog[9]=0;dialog[10]=0;dialog[11]='B';dialog[12]=0;
 DialogBoxIndirectParamA(GetModuleHandleA(0),dialog,0,proc,0);for(;;){} }
`;

function fixture(out){
 fs.writeFileSync(out+'/fixture.c',source);
 for(const [dll,names]of Object.entries({kernel32:['GetModuleHandleA@4'],user32:['CreateWindowExA@48','DialogBoxIndirectParamA@20','SendMessageA@16','SetWindowTextA@8','GetWindowLongA@8','GetFocus@0','SetFocus@4','PostMessageA@16','SetWindowLongA@12','CallWindowProcA@20','SetActiveWindow@4','IsWindow@4','DestroyWindow@4']})){
  fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/fixture.c','-o',out+'/fixture.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/button-programmatic-click.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib']);return fs.readFileSync(out+'/button-programmatic-click.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n');
 const runtime=require(root+'/tools/boids-current-runtime.cjs'),commit=process.env.BUTTON_PROGRAMMATIC_CLICK_COMMIT||cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files=runtime.gitFiles(commit);
 const own='src/09c3-controls0-basic-wndprocs.wat';files.set(own,expectOld?cp.execFileSync('git',['show',commit+':'+own],{cwd:root}):fs.readFileSync(root+'/'+own));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{maxBuffer:8e6}));
 const wasm=runtime.compile(files);fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));const pe=fixture(out);files.set('build/wine-assembly.wasm',wasm);files.set('button-programmatic-click.exe',pe);
 save('runtime.json',{commit,expectOld,testSHA256:sha(fs.readFileSync(__filename)),moduleSHA256:sha(wasm),peSHA256:sha(pe),cases,files:[...files].map(([name,b])=>({name,size:b.length,sha256:sha(b)}))});
 const transient=require(root+'/tools/browser-transients.cjs').create(),logs=[],pending=[],workers=[];let display,browser,wait,server;
 try{
  server=http.createServer((req,res)=>{const n=new URL(req.url,'http://local').pathname.slice(1)||'index.html',b=files.get(n);res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.html')?'text/html':n.endsWith('.css')?'text/css':n.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.statusCode=b?200:404;res.end(b||'missing');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  display=await require(root+'/tools/gltron-headful-display.cjs').start(out);
  browser=await require(root+'/node_modules/puppeteer').launch({headless:false,defaultViewport:{width:1050,height:800},env:transient.env(display.env),userDataDir:transient.profile,executablePath:'/opt/google/chrome/chrome',args:[...transient.args,'--no-sandbox','--disable-dev-shm-usage','--disable-component-update','--disable-background-networking'],protocolTimeout:20000});wait=transient.watch(browser.process());browser.process().stdout?.resume();browser.process().stderr?.resume();save('browser-version.json',{version:await browser.version()});
  const page=await browser.newPage();page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>logs.push(String(e)));
  page.on('workercreated',w=>{const row={url:w.url(),modules:[]};workers.push(row);const c=w.client;c.on('Debugger.scriptParsed',v=>{if(v.scriptLanguage==='WebAssembly'||v.url.startsWith('wasm://'))pending.push(c.send('Debugger.getScriptSource',{scriptId:v.scriptId}).then(r=>row.modules.push(sha(Buffer.from(r.bytecode,'base64')))));});pending.push(c.send('Debugger.enable'));});
  await page.evaluateOnNewDocument(()=>localStorage.setItem('wine-assembly.threads','1'));await page.goto('http://127.0.0.1:'+server.address().port+'/?debug&threads&no-log');await page.waitForFunction(()=>typeof WineAssembly==='function');
  await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=650;c.style='position:fixed;left:0;top:0;z-index:99999;width:1000px;height:650px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.buttonHost=new WineAssembly();buttonHost.renderer=new Win98Renderer(c);await buttonHost.init(c);if(!buttonHost.guestWorker)throw Error('production Worker required');await buttonHost.loadExe('/button-programmatic-click.exe');buttonHost.run();});

  await page.waitForFunction(()=>Object.values(buttonHost.renderer.windows).some(w=>w.title.trim()==='0'&&!w.isChild),{timeout:15000});
  const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);
  const failures=[],results=[],{PNG}=require(root+'/node_modules/pngjs');
  await page.evaluate(()=>{browserInput.wireCanvasInput(buttonHost.renderer.canvas,buttonHost.renderer,{runningApps:[{wine:buttonHost}],debugMode:true});buttonHost.renderer.canvas.focus();});
  let nativeOrigin=null;
  for(let stage=0;stage<=9;++stage){
   if(stage){await page.keyboard.type('a');await page.waitForFunction(n=>Object.values(buttonHost.renderer.windows).some(w=>w.title.trim()===String(n)&&!w.isChild),{timeout:10000},stage);}
   await new Promise(r=>setTimeout(r,200));
   const s=await page.evaluate(()=>{const h=buttonHost,r=h.renderer,w=Object.values(r.windows).find(w=>!w.isChild&&w.title.trim().match(/^[0-9]$/)),p=w._backCanvas._waCanonicalPresentation;return {memoryBytes:h.memory.buffer.byteLength,rows:Object.values(r.windows).map(v=>({hwnd:v.hwnd,parent:v.parent,title:v.title,x:v.x,y:v.y,w:v.w,h:v.h,visible:v.visible,isChild:v.isChild})),gdi:p?{sharedGuestStorage:p.surface.storage.buffer===h.memory.buffer,pixels:Array.from(p.surface.rgbaRect(0,0,w.w,w.h))}:null,pixels:Array.from(w._backCanvas.getContext('2d').getImageData(0,0,w.w,w.h).data),width:w.w,height:w.h,canvas:r.canvas.getBoundingClientRect().toJSON()};});
   const frame=s.rows.find(w=>!w.isChild&&w.title.trim()===String(stage)),buttons=cases.map((kind,j)=>s.rows.find(w=>w.isChild&&w.x===12&&w.y===12+j*46)).filter(Boolean);
   assert(buttons.every(Boolean));
   const cpuState=await cpu.evaluate(({handles,frame})=>{const e=instance.exports,names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,frameClient:{x:e.wnd_client_screen_x(frame),y:e.wnd_client_screen_y(frame)},registers:Object.fromEntries(names.map(n=>[n,e[n]()>>>0])),controls:handles.map(h=>({hwnd:h,cls:e.ctrl_get_class(h),live:e.wnd_lookup_live(h)}))};},{handles:buttons.map(b=>b.hwnd),frame:frame.hwnd});
   save('cpu-'+stage+'.json',cpuState);assert.equal(cpuState.memoryBytes,536870912);assert.equal(Object.keys(cpuState.registers).length,19);assert(cpuState.registers.get_eip&&cpuState.registers.get_esp);
   assert(cpuState.controls.every(b=>b.cls===1&&b.live===1),'actual native CLASS1');
   assert(s.gdi?.sharedGuestStorage);const pix=Buffer.from(s.pixels),gd=Buffer.from(s.gdi.pixels);
   const crop=b=>{const x=b.x+cpuState.frameClient.x-frame.x,y=b.y+cpuState.frameClient.y-frame.y,w=b.w,h=b.h,bytes=Buffer.alloc(w*h*4);
    for(let row=0;row<h;++row){const at=((y+row)*s.width+x)*4;pix.copy(bytes,row*w*4,at,at+w*4);assert(pix.subarray(at,at+w*4).equals(gd.subarray(at,at+w*4)),'shared GDI/backing agree');}return {x,y,w,h,bytes};};
   const surfaces=[];
   const target=stage<=6?Math.max(0,stage-1):stage===7?0:stage===8?6:7,alive=stage<8,checked=target===2||target===3||target===4||target===5?1:0;
   const got=s.rows.find(w=>w.isChild&&w.x===270).title.trim().split(/\s+/).map(Number);
   const want=stage===0?[0,0,0,0,0,0,0,0x50010000,0,0,0,1,1]:stage===8?[8,1,0,0,0,0,99,0,0,0,0,0,1]:[stage,123,1,1,1,checked,alive?checked:99,alive?0x50010000+cases[target]:0,1,1,1,alive?1:0,1];
   const publicPass=JSON.stringify(got)===JSON.stringify(want);if(!publicPass)failures.push({stage,got,want});
   for(let j=0;j<8;++j){if((j===6&&stage>=8)||(j===7&&stage>=9))continue;
    const button=buttons.find(b=>b.y===12+j*46),observed=crop(button),reference=crop(s.rows.find(w=>w.isChild&&w.x===142&&w.y===12+j*46));
    // Automatic controls have fixed checked references: compare once activated.
    const compare=!(j===3&&stage<4)&&!(j===5&&stage<6);
    const visualPass=compare?observed.bytes.equals(reference.bytes):null;
    if(visualPass===false)failures.push({stage,j,visual:false});
    surfaces.push(observed,reference);results.push({stage,j,publicPass,visualPass});
   }
   save('public-'+stage+'.json',{stage,got,want,publicPass});
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
  if(expectOld){assert(failures.some(f=>f.stage===1&&f.got),'preedit must fail documented message sequence and BN_CLICKED');assert(failures.some(f=>f.visual===false),'preedit must fail automatic checked reference');console.log('PASS supported preedit oldFAIL',failures.length);}else{assert.deepEqual(failures,[]);console.log('PASS BM_CLICK public message order/ID/HWND/check/style/focus and constant-reference GDI/backing/compositor/native pixels',results.length);}

 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('transients.json',await transient.cleanup(out));if(display)await display.close();}
}
if(require.main===module)main(process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync(require('node:os').tmpdir()+'/button-programmatic-click-return-'),{expectOld:process.argv.includes('--expect-old')}).catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={fixture,main};

