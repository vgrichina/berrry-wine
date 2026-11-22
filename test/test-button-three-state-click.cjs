'use strict';
// Period primary: Microsoft WIN32.HLP (1992-1994), BM_CLICK, Check Boxes,
// BM_GETCHECK, BM_SETSTYLE and BN_CLICKED. Archived distribution:
// https://thelp.zdrojak.dev/helps/Borland%20C%2B%2B%204.x/win32.json.gz
// No BM_CLICK return value is specified. Reentry/destruction are robustness
// probes; fixed sibling states and app consumers are not Windows pixel oracles.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const kinds=[6,5,5,5,6,5,6,5],targets=[0,0,0,0,1,2,3,4,5,0,6,7];
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
unsigned short API RegisterClassA(const void*);long API DefWindowProcA(P,U,U,long);
long API SendMessageA(P,U,U,long);int API PostMessageA(P,U,U,long);int API SetWindowTextA(P,const char*);
long API GetWindowLongA(P,int);long API SetWindowLongA(P,int,long);long API CallWindowProcA(P,P,U,U,long);
P API GetFocus(void);P API SetFocus(P);P API SetActiveWindow(P);P API GetCapture(void);int API IsWindow(P);int API DestroyWindow(P);
int API GetMessageA(P,P,U,U);int API TranslateMessage(P);long API DispatchMessageA(P);
struct WC{U style;P proc;int cex,wex;P instance,icon,cursor,brush;const char* menu;const char* name;};
static P frame,b[8],ref[8],echo,echoRef,callback,callbackRef,status,edit;static long old[8];
static int kinds[8]={6,5,5,5,6,5,6,5},targets[12]={0,0,0,0,1,2,3,4,5,0,6,7};
static int stage,target,seq,clicks,idok,hwndok,seen,focused,down,up,capdown,capup,nesting;
static char text[600];static const char* names[3]={"UNCHECKED","CHECKED","INDETERMINATE"};
void number(U n,int* at){char d[12];int k=0;do{d[k++]='0'+n%10;n/=10;}while(n);while(k)text[(*at)++]=d[--k];text[(*at)++]=' ';}
int expected(int j){if(j==0)return stage<9?(stage<4?stage%3:0):1;if(j==2||j==4)return 1;if(j==3||j==5)return 2;return 0;}
long __stdcall sub(P h,U m,U w,long l){int j;for(j=0;j<8&&b[j]!=h;++j){}if(j==8)return 0;
 if(m==0x201){seq=seq*10+1;
  if(stage==9&&!nesting){nesting=1;SendMessageA(h,0xf5,0,0);nesting=0;}
  if(stage==10){SetFocus(edit);DestroyWindow(h);return 0;}
  long r=CallWindowProcA((P)old[j],h,m,w,l);down=(SendMessageA(h,0xf2,0,0)&4)!=0;capdown=GetCapture()==h;return r;
 }
 if(m==0x202){seq=seq*10+2;up=(SendMessageA(h,0xf2,0,0)&4)!=0;long r=CallWindowProcA((P)old[j],h,m,w,l);capup=GetCapture()==0;return r;}
 return CallWindowProcA((P)old[j],h,m,w,l);
}
void report(void){int at=0,live=IsWindow(b[target]),value=live?SendMessageA(b[target],0xf0,0,0):99;
 number(stage,&at);number(seq,&at);number(clicks,&at);number(idok,&at);number(hwndok,&at);number(seen,&at);number(value,&at);
 number(live?GetWindowLongA(b[target],-16):0,&at);number(focused,&at);number(down,&at);number(up,&at);number(live,&at);
 number(capdown,&at);number(capup,&at);number(GetCapture()==0,&at);SetFocus(edit);number(GetFocus()==edit,&at);text[at]=0;SetWindowTextA(status,text);
 SetWindowTextA(echo,value<3?names[value]:"DESTROYED");SetWindowTextA(callback,clicks?names[seen]:"NO NOTIFICATION");
 int expectedClick=stage&&stage!=7&&stage!=8&&stage!=10;
 SetWindowTextA(echoRef,stage>=10?"DESTROYED":names[expected(target)]);
 SetWindowTextA(callbackRef,expectedClick?names[stage==11?0:expected(target)]:"NO NOTIFICATION");
 for(int j=0;j<8;++j)SendMessageA(ref[j],0xf1,expected(j),0);
 at=0;number(stage,&at);text[at]=0;SetWindowTextA(frame,text);
}
long __stdcall proc(P h,U m,U w,long l){
 if(m==0x111&&l&&(w>>16)==0){seq=seq*10+3;++clicks;idok=(w&65535)==(stage==9?777:100+target);hwndok=(P)l==b[target];
 seen=SendMessageA((P)l,0xf0,0,0);focused=GetFocus()==(P)l;if(stage==11){SetFocus(edit);DestroyWindow((P)l);}return 0;}
 if(m==0x8001){report();return 0;}return DefWindowProcA(h,m,w,l);
}
void start(void){P inst=GetModuleHandleA(0);struct WC wc={0,proc,0,0,0,0,0,(P)16,0,"ThreeState"};wc.instance=inst;RegisterClassA(&wc);
 frame=CreateWindowExA(0,"ThreeState","starting",0x10cf0000,30,30,950,560,0,0,inst,0);
 edit=CreateWindowExA(0,"EDIT","",0x50010000,12,415,160,24,frame,(P)50,inst,0);SetFocus(edit);
 for(int j=0;j<8;++j){U style=0x50010000+kinds[j]+((j==4||j==5)?0x08000000:0);
 b[j]=CreateWindowExA(0,"BUTTON","",style,12,12+j*46,110,32,frame,(P)(100+j),inst,0);
 ref[j]=CreateWindowExA(0,"BUTTON","",style,142,12+j*46,110,32,frame,(P)(200+j),inst,0);
 SendMessageA(b[j],0xf1,expected(j),0);SendMessageA(ref[j],0xf1,expected(j),0);old[j]=SetWindowLongA(b[j],-4,(long)sub);}
 echo=CreateWindowExA(0,"STATIC","",0x50000000,280,70,210,24,frame,(P)300,inst,0);
 echoRef=CreateWindowExA(0,"STATIC","",0x50000000,540,70,210,24,frame,(P)301,inst,0);
 callback=CreateWindowExA(0,"STATIC","",0x50000000,280,115,210,24,frame,(P)302,inst,0);
 callbackRef=CreateWindowExA(0,"STATIC","",0x50000000,540,115,210,24,frame,(P)303,inst,0);
 status=CreateWindowExA(0,"STATIC","",0x50000000,12,465,910,24,frame,(P)304,inst,0);
 SetActiveWindow(frame);report();U msg[12];while(GetMessageA(msg,0,0,0)>0){
 if(msg[1]==0x100&&msg[2]==0x77&&stage<11){++stage;target=targets[stage];seq=clicks=idok=hwndok=seen=focused=down=up=capdown=capup=0;
 if(stage==9)SetWindowLongA(b[0],-12,777);SetActiveWindow(frame);SendMessageA(b[target],0xf5,0,0);PostMessageA(frame,0x8001,0,0);continue;}
 TranslateMessage(msg);DispatchMessageA(msg);}}
`;
function fixture(out){
 fs.writeFileSync(out+'/fixture.c',source);
 for(const [dll,names]of Object.entries({kernel32:['GetModuleHandleA@4'],user32:['CreateWindowExA@48','RegisterClassA@4','DefWindowProcA@16','GetMessageA@16','TranslateMessage@4','DispatchMessageA@4','SendMessageA@16','SetWindowTextA@8','GetWindowLongA@8','GetFocus@0','SetFocus@4','PostMessageA@16','SetWindowLongA@12','CallWindowProcA@20','SetActiveWindow@4','GetCapture@0','IsWindow@4','DestroyWindow@4']})){
 fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/fixture.c','-o',out+'/fixture.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/three-state.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib']);return fs.readFileSync(out+'/three-state.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n');
 const runtime=require(root+'/tools/boids-current-runtime.cjs'),commit=process.env.BUTTON_THREE_STATE_COMMIT||cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files=runtime.gitFiles(commit);
 for(const n of files.keys())if(fs.existsSync(root+'/'+n))files.set(n,fs.readFileSync(root+'/'+n));
 const own='src/09c3-controls0-basic-wndprocs.wat';if(expectOld)files.set(own,cp.execFileSync('git',['show',commit+':'+own],{cwd:root}));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{maxBuffer:8e6}));
 const wasm=process.env.BUTTON_THREE_STATE_WASM?fs.readFileSync(process.env.BUTTON_THREE_STATE_WASM):runtime.compile(files),pe=fixture(out);
 fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));files.set('build/wine-assembly.wasm',wasm);files.set('three-state.exe',pe);
 fs.writeFileSync(out+'/runtime.diff',cp.execFileSync('git',['diff','--binary',commit,'--','src','lib','tools','index.html','host.js'],{maxBuffer:32e6}));
 save('runtime.json',{commit,expectOld,moduleSHA256:sha(wasm),peSHA256:sha(pe),testSHA256:sha(fs.readFileSync(__filename)),files:[...files].map(([name,b])=>({name,size:b.length,sha256:sha(b)}))});
 const transient=require(root+'/tools/browser-transients.cjs').create(),logs=[],pending=[],workers=[],failures=[],states=[];let display,browser,wait,server;
 try{
 server=http.createServer((req,res)=>{const n=new URL(req.url,'http://local').pathname.slice(1)||'index.html',b=files.get(n);res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.html')?'text/html':n.endsWith('.css')?'text/css':n.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.statusCode=b?200:404;res.end(b||'missing');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 display=await require(root+'/tools/gltron-headful-display.cjs').start(out);
 browser=await require(root+'/node_modules/puppeteer').launch({headless:false,defaultViewport:{width:1150,height:800},env:transient.env(display.env),userDataDir:transient.profile,executablePath:'/opt/google/chrome/chrome',args:[...transient.args,'--window-size=1250,980','--no-sandbox','--disable-dev-shm-usage','--disable-component-update','--disable-background-networking'],protocolTimeout:20000});wait=transient.watch(browser.process());browser.process().stdout?.resume();browser.process().stderr?.resume();save('browser-version.json',{version:await browser.version()});
 const page=await browser.newPage();page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>logs.push(String(e)));
 page.on('workercreated',w=>{const row={url:w.url(),modules:[]};workers.push(row);const c=w.client;c.on('Debugger.scriptParsed',v=>{if(v.scriptLanguage==='WebAssembly'||v.url.startsWith('wasm://'))pending.push(c.send('Debugger.getScriptSource',{scriptId:v.scriptId}).then(r=>row.modules.push(sha(Buffer.from(r.bytecode,'base64')))));});pending.push(c.send('Debugger.enable'));});
 await page.evaluateOnNewDocument(()=>localStorage.setItem('wine-assembly.threads','1'));await page.goto('http://127.0.0.1:'+server.address().port+'/?debug&threads&no-log');await page.waitForFunction(()=>typeof WineAssembly==='function');
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1120;c.height=700;c.style='position:fixed;left:0;top:0;z-index:99999;width:1120px;height:700px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.threeHost=new WineAssembly();threeHost.renderer=new Win98Renderer(c);await threeHost.init(c);if(!threeHost.guestWorker)throw Error('production Worker required');await threeHost.loadExe('/three-state.exe');threeHost.run();});
 await page.waitForFunction(()=>Object.values(threeHost.renderer.windows).some(w=>w.title.trim()==='0'&&!w.isChild),{timeout:15000});
 await page.evaluate(()=>{browserInput.wireCanvasInput(threeHost.renderer.canvas,threeHost.renderer,{runningApps:[{wine:threeHost}],debugMode:true});threeHost.renderer.canvas.focus();});
 const native=args=>cp.execFileSync('xdotool',args,{env:display.env,timeout:5000}),wins=native(['search','--onlyvisible','--pid',String(browser.process().pid),'--class','chrome']).toString().trim().split(/\s+/);assert.equal(wins.length,1);native(['windowactivate','--sync',wins[0]]);save('native-input.json',{route:'XTEST F8 => guest GetMessage WM_KEYDOWN => application SendMessage BM_CLICK',window:wins[0],browserPID:browser.process().pid});
 const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);const {PNG}=require(root+'/node_modules/pngjs');let nativeOrigin=null;
 for(let stage=0;stage<=11;++stage){
  if(stage){native(['key','--clearmodifiers','F8']);try{await page.waitForFunction(n=>Object.values(threeHost.renderer.windows).some(w=>w.title.trim()===String(n)&&!w.isChild),{timeout:10000},stage);}catch(e){save('closed-unknown.json',{stage,reason:String(e),closed:true,noReplay:true});throw Error('UNKNOWN native action; closed; no replay');}}
  await new Promise(r=>setTimeout(r,160));
  const s=await page.evaluate(()=>{const h=threeHost,r=h.renderer,w=Object.values(r.windows).find(w=>!w.isChild&&/^\d+$/.test(w.title.trim())),p=w._backCanvas._waCanonicalPresentation,encode=a=>{let s='';for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode(...a.subarray(i,i+8192));return btoa(s);};return {memoryBytes:h.memory.buffer.byteLength,rows:Object.values(r.windows).map(v=>({hwnd:v.hwnd,parent:v.parent,title:v.title,x:v.x,y:v.y,w:v.w,h:v.h,visible:v.visible,isChild:v.isChild})),gdi:p?{shared:p.surface.storage.buffer===h.memory.buffer,pixels:encode(p.surface.rgbaRect(0,0,w.w,w.h))}:null,pixels:encode(w._backCanvas.getContext('2d').getImageData(0,0,w.w,w.h).data),width:w.w,height:w.h,canvas:r.canvas.getBoundingClientRect().toJSON()};});
  const frame=s.rows.find(w=>!w.isChild&&w.title.trim()===String(stage)),buttons=kinds.map((k,j)=>s.rows.find(w=>w.isChild&&w.x===12&&w.y===12+j*46));
  const cpuState=await cpu.evaluate(({handles,frame})=>{const e=instance.exports,names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,frameClient:{x:e.wnd_client_screen_x(frame),y:e.wnd_client_screen_y(frame)},registers:Object.fromEntries(names.map(n=>[n,e[n]()>>>0])),controls:handles.map(h=>({hwnd:h,cls:e.ctrl_get_class(h),live:e.wnd_lookup_live(h)}))};},{handles:buttons.filter(Boolean).map(b=>b.hwnd),frame:frame.hwnd});
  save('cpu-'+stage+'.json',cpuState);assert.equal(cpuState.memoryBytes,536870912);assert.equal(s.memoryBytes,536870912);assert.equal(Object.keys(cpuState.registers).length,19);assert(cpuState.registers.get_eip&&cpuState.registers.get_esp);assert(cpuState.controls.every(b=>b.cls===1&&b.live===1));
  const expected=j=>j===0?(stage<9?(stage<4?stage%3:0):1):j===2||j===4?1:j===3||j===5?2:0,target=targets[stage],disabled=stage===7||stage===8,dead=stage>=10,clicked=stage>0&&!disabled&&stage!==10;
  const got=s.rows.find(w=>w.isChild&&w.x===12&&w.y===465).title.trim().split(/\s+/).map(Number);
  const want=stage===0?[0,0,0,0,0,0,0,0x50010006,0,0,0,1,0,0,1,1]:stage===10?[10,1,0,0,0,0,99,0,0,0,0,0,0,0,1,1]:disabled?[stage,0,0,0,0,0,expected(target),0x58010000+kinds[target],0,0,0,1,0,0,1,1]:[stage,123,1,1,1,expected(target),dead?99:expected(target),dead?0:0x50010000+kinds[target],1,1,1,dead?0:1,1,1,1,1];
  const publicPass=JSON.stringify(got)===JSON.stringify(want);if(!publicPass)failures.push({stage,got,want});
  assert(s.gdi?.shared);const pix=Buffer.from(s.pixels,'base64'),gd=Buffer.from(s.gdi.pixels,'base64'),surfaces=[];
  function crop(b,name){assert(b);const x=b.x+cpuState.frameClient.x-frame.x,y=b.y+cpuState.frameClient.y-frame.y,w=b.w,h=b.h,bytes=Buffer.alloc(w*h*4);assert(b.visible&&x>=0&&y>=0&&x+w<=s.width&&y+h<=s.height);for(let row=0;row<h;++row){const at=((y+row)*s.width+x)*4;pix.copy(bytes,row*w*4,at,at+w*4);assert(pix.subarray(at,at+w*4).equals(gd.subarray(at,at+w*4)));}const v={name,x,y,w,h,bytes};surfaces.push(v);return v;}
  const pairs=[];for(let j=0;j<8;++j){if(j===6&&stage>=10||j===7&&stage>=11)continue;const b=buttons[j],r=s.rows.find(w=>w.isChild&&w.x===142&&w.y===12+j*46);assert.deepEqual([b.w,b.h,r.w,r.h],[110,32,110,32]);const a=crop(b,'button-'+j),c=crop(r,'reference-'+j),pass=a.bytes.equals(c.bytes);pairs.push({j,pass});if(!pass)failures.push({stage,j,visual:false});}
  const consumers=[];for(const y of [70,115]){const a=crop(s.rows.find(w=>w.isChild&&w.x===280&&w.y===y),'consumer-'+y),b=crop(s.rows.find(w=>w.isChild&&w.x===540&&w.y===y),'consumer-reference-'+y);assert.deepEqual([a.w,a.h,b.w,b.h],[210,24,210,24]);const pass=a.bytes.equals(b.bytes);consumers.push({y,pass});if(!pass)failures.push({stage,consumer:y});}
  await page.screenshot({path:out+'/composited-'+stage+'.png'});require(root+'/tools/browser-transients.cjs').captureWhole(out,'desktop-'+stage,display.env);
  const composite=PNG.sync.read(fs.readFileSync(out+'/composited-'+stage+'.png')),desktop=PNG.sync.read(fs.readFileSync(out+'/desktop-'+stage+'.png'));
  const match=(png,v,ox,oy)=>{const x=Math.round(ox+v.x),y=Math.round(oy+v.y);if(x<0||y<0||x+v.w>png.width||y+v.h>png.height)return false;for(let row=0;row<v.h;++row)if(!png.data.subarray(((y+row)*png.width+x)*4,((y+row)*png.width+x+v.w)*4).equals(v.bytes.subarray(row*v.w*4,(row+1)*v.w*4)))return false;return true;};
  assert(surfaces.every(v=>match(composite,v,s.canvas.x+frame.x,s.canvas.y+frame.y)),'exact compositor fixed geometry');
  if(!nativeOrigin){const first=surfaces[1],needle=first.bytes.subarray(8*first.w*4,9*first.w*4);for(let at=desktop.data.indexOf(needle);at>=0;at=desktop.data.indexOf(needle,at+1)){if(at%4)continue;const ox=at/4%desktop.width-first.x,oy=Math.floor(at/4/desktop.width)-first.y-8;if(surfaces.every(v=>match(desktop,v,ox,oy))){nativeOrigin={x:ox,y:oy};break;}}}
  assert(nativeOrigin&&surfaces.every(v=>match(desktop,v,nativeOrigin.x,nativeOrigin.y)),'exact native desktop stable origin');
  save('visible-'+stage+'.json',{nativeOrigin,surfaces:surfaces.map(({bytes,...v})=>({...v,sha256:sha(bytes)}))});delete s.pixels;delete s.gdi.pixels;save('scene-'+stage+'.json',s);
  const row={stage,got,want,publicPass,pairs,consumers,fourPlanes:true};states.push(row);save('public-'+stage+'.json',row);
 }
 await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));save('assertions.json',{expectOld,failures,states,productionBrowserCPU:true});
 if(expectOld){assert(failures.some(f=>f.stage===1&&f.got),'preedit public activation fails');assert(failures.some(f=>f.consumer),'preedit independent public-state consumer fails');console.log('PASS expected physical preedit old FAIL',failures.length);}else{assert.deepEqual(failures,[]);console.log('PASS three-state BM_CLICK native XTEST public/callback state, capture, subclass lifetime, independent visible consumers and four planes',states.length);}
 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('transients.json',await transient.cleanup(out));if(display)await display.close();}
}
if(require.main===module)main(process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync('/dev/shm/button-three-state-click-'),{expectOld:process.argv.includes('--expect-old')}).catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={fixture,main};
