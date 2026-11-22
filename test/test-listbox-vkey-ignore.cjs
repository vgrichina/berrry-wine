'use strict';
// Q108941 (reviewed 1995-11-02), regular Windows95 lists, and WIN32.HLP 3876.
// Only noncharacter Up/Down and negative returns; no returned-index/timing oracle.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const cases=[
 {sel:[1,1],count:0},{sel:[2,1],count:0},{sel:[1,1],count:0},
 {sel:[1,1],old:[1,2],count:1},{sel:[1,1],count:2},
 {sel:[1,2],count:3},{sel:[1,1],count:4},
 {sel:[1,2],count:5},{sel:[1,1],count:6}];
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
unsigned short API RegisterClassA(P);long API DefWindowProcA(P,U,U,long);P API SetFocus(P);P API GetFocus(void);
int API SetWindowTextA(P,const char*);long API SendMessageA(P,U,U,long);int API GetMessageA(P,P,U,U);int API TranslateMessage(P);long API DispatchMessageA(P);
long API GetWindowLongA(P,int);int API GetClientRect(P,P);int API IsWindowEnabled(P);int API IsWindowVisible(P);int API GetDlgCtrlID(P);
P API BeginPaint(P,P);int API EndPaint(P,P);int API FillRect(P,P,P);int API InvalidateRect(P,P,int);int API UpdateWindow(P);
P API GetStockObject(int);P API SelectObject(P,P);int API SetBkMode(P,int);U API SetTextColor(P,U);P API CreateSolidBrush(U);int API TextOutA(P,int,int,const char*,int);
struct WC{U style;P proc;int cex,wex;P instance,icon,cursor,brush;const char* menu;const char* name;};struct R{int l,t,r,b;};
static P frame,lists[2],refs[2],status,blue,white;static int stage=-1,counts[2],bad,mode,lastw,lastl,lasth;static volatile U canary=0x12345678;static char report[1024];
static const char* items[4]={"Alpha","Beta","Cedar","Delta"};
void number(int n,int* at){char d[12];int k=0;if(n<0){report[(*at)++]='-';n=-n;}do{d[k++]='0'+n%10;n/=10;}while(n);while(k)report[(*at)++]=d[--k];report[(*at)++]=' ';}
int expected(int which){if(!which)return stage==1?2:1;return stage==5||stage==7?2:1;}
long __stdcall proc(P h,U m,U w,long l){
 if(m==0x2e){++counts[1];lastw=w;lastl=l;lasth=(long)h;if(h!=frame||(P)l!=lists[1]||((w&65535)!=0x26&&(w&65535)!=0x28))++bad;struct {volatile U lo;char text[12];volatile U hi;} probe={0x13579bdf,{0},0x2468ace0};if(SendMessageA((P)l,0x189,0,(long)probe.text)!=5||probe.text[0]!='A'||probe.text[5]!=0||probe.lo!=0x13579bdf||probe.hi!=0x2468ace0||canary!=0x12345678)++bad;if(mode==0)return -2;if(mode==1)return -1;return DefWindowProcA(h,m,w,l);}
 if(m==0x111&&(w>>16)==1){int id=w&65535;if((id==10||id==11)&&(P)l==lists[id-10])(void)id;else ++bad;return 0;}
 if(m==15){U ps[16];P dc=BeginPaint(h,ps);int id=GetDlgCtrlID(h);if(id==30||id==31){struct R q={0,0,180,68};FillRect(dc,&q,white);q.l=2;q.r=178;SelectObject(dc,GetStockObject(16));SetBkMode(dc,1);for(int j=0;j<4;++j){q.t=2+16*j;q.b=q.t+16;if(j==expected(id-30))FillRect(dc,&q,blue);SetTextColor(dc,j==expected(id-30)?0xffffff:0);TextOutA(dc,4,4+16*j,items[j],j==0||j==2||j==3?5:4);}}EndPaint(h,ps);return 0;}
 return DefWindowProcA(h,m,w,l);
}
void publish(void){int at=0;number(stage,&at);for(int j=0;j<2;++j){struct R q;number(counts[j],&at);number(SendMessageA(lists[j],0x188,0,0),&at);number(SendMessageA(lists[j],0x19f,0,0),&at);number(SendMessageA(lists[j],0x18e,0,0),&at);number(SendMessageA(lists[j],0x18b,0,0),&at);number(GetWindowLongA(lists[j],-16),&at);number(SendMessageA(lists[j],0x31,0,0)==(long)GetStockObject(16),&at);GetClientRect(lists[j],&q);number(q.r,&at);number(q.b,&at);number(IsWindowEnabled(lists[j]),&at);number(IsWindowVisible(lists[j]),&at);number(SendMessageA(lists[j],0x1a1,0,0),&at);InvalidateRect(refs[j],0,1);UpdateWindow(refs[j]);}number(bad,&at);number(lastw,&at);number((P)lastl==lists[1],&at);number((P)lasth==frame,&at);number(GetFocus()==lists[stage<3?0:1],&at);number(canary,&at);for(int j=0;j<2;++j){struct {volatile U lo;char text[12];volatile U hi;} guard={0x13579bdf,{0},0x2468ace0};char* text=guard.text;for(int k=0;k<4;++k){number(SendMessageA(lists[j],0x199,k,0),&at);number(SendMessageA(lists[j],0x189,k,(long)text),&at);int same=1;for(int z=0;z<6;++z){if(text[z]!=items[k][z])same=0;if(!items[k][z])break;}number(same&&guard.lo==0x13579bdf&&guard.hi==0x2468ace0,&at);}}report[at]=0;SetWindowTextA(status,report);}
void start(void){P i=GetModuleHandleA(0);struct WC wc={0,proc,0,0,0,0,0,(P)16,0,"ListVkeyReference"};wc.instance=i;RegisterClassA(&wc);blue=CreateSolidBrush(0x800000);white=CreateSolidBrush(0xffffff);
 frame=CreateWindowExA(0,"ListVkeyReference","Authored LISTBOX negative keyboard returns",0x90000000,12,12,720,390,0,0,i,0);
 for(int j=0;j<2;++j){lists[j]=CreateWindowExA(0,"LISTBOX","",0x50000100|(j?0x400:0),15+235*j,50,180,68,frame,(P)(10+j),i,0);SendMessageA(lists[j],0x30,(U)GetStockObject(16),1);SendMessageA(lists[j],0x1a0,0,16);for(int k=0;k<4;++k){SendMessageA(lists[j],0x180,0,(long)items[k]);SendMessageA(lists[j],0x19a,k,100+j*10+k);}SendMessageA(lists[j],0x186,1,0);refs[j]=CreateWindowExA(0,"ListVkeyReference","",0x50000000,15+235*j,150,180,68,frame,(P)(30+j),i,0);}
 status=CreateWindowExA(0,"STATIC","READY",0x50000000,15,260,680,60,frame,(P)20,i,0);SetFocus(lists[0]);
 U msg[12];while(GetMessageA(msg,0,0,0)>0){if((msg[1]==0x100||msg[1]==0x101)&&(msg[2]==0x75||msg[2]==0x76||msg[2]==0x77)){if(msg[1]==0x100){if(msg[2]==0x75)SetFocus(lists[1]);if(msg[2]==0x76)++mode;if(msg[2]==0x77){++stage;publish();}}continue;}TranslateMessage(msg);DispatchMessageA(msg);}
}
`;
function fixture(out){
 fs.writeFileSync(out+'/fixture.c',source);
 const libs={"kernel32":["GetModuleHandleA@4"],"user32":["CreateWindowExA@48","RegisterClassA@4","DefWindowProcA@16","SetFocus@4","GetFocus@0","GetDlgCtrlID@4","SetWindowTextA@8","SendMessageA@16","GetMessageA@16","TranslateMessage@4","DispatchMessageA@4","BeginPaint@8","EndPaint@8","FillRect@12","InvalidateRect@12","UpdateWindow@4","GetWindowLongA@8","GetClientRect@8","IsWindowVisible@4","IsWindowEnabled@4"],"gdi32":["GetStockObject@4","SelectObject@8","SetTextColor@8","SetBkMode@8","TextOutA@20","CreateSolidBrush@4"]};
 for(const[dll,names]of Object.entries(libs)){fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib'],{timeout:15000});}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-Wall','-Wextra','-Werror','-Wno-unused-parameter','-c',out+'/fixture.c','-o',out+'/fixture.obj'],{timeout:15000});
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/list-vkey-ignore.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib',out+'/gdi32.lib'],{timeout:15000});return fs.readFileSync(out+'/list-vkey-ignore.exe');
}
async function main(out,{expectOld=false,ownSource,deferCleanup=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n');
 const runtime=require('../tools/boids-current-runtime.cjs'),commit=cp.execFileSync('git',['rev-parse',process.env.LIST_VKEY_COMMIT||'HEAD'],{cwd:root,encoding:'utf8'}).trim(),files=runtime.gitFiles(commit),own='src/09c3-wndprocs3-listbox.wat';
 const originalSource=files.get(own);files.set(own,ownSource||fs.readFileSync(root+'/'+own));
 if(process.env.LIST_VKEY_WORKING_RUNTIME)for(const n of files.keys())if(fs.existsSync(root+'/'+n))files.set(n,fs.readFileSync(root+'/'+n));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{cwd:root,maxBuffer:8e6}));
 const wasm=process.env.LIST_VKEY_MODULE?fs.readFileSync(process.env.LIST_VKEY_MODULE):runtime.compile(files),pe=fixture(out);fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));files.set('build/wine-assembly.wasm',wasm);files.set('list-vkey-ignore.exe',pe);
 fs.writeFileSync(out+'/runtime.diff',require('../tools/unified-diff.js').patchOf([{file:own,before:originalSource.toString(),after:files.get(own).toString()}]));
 save('runtime.json',{commit,expectOld,moduleSHA256:sha(wasm),peSHA256:sha(pe),testSHA256:sha(fs.readFileSync(__filename)),files:[...files].map(([name,b])=>({name,size:b.length,sha256:sha(b)}))});
 const transient=require('../tools/browser-transients.cjs').create(),logs=[],pending=[],workers=[],states=[],failures=[];let display,browser,wait,server;
 try{
 server=http.createServer((req,res)=>{const n=new URL(req.url,'http://local').pathname.slice(1)||'index.html',b=files.get(n);res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.html')?'text/html':n.endsWith('.css')?'text/css':n.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.statusCode=b?200:404;res.end(b||'missing');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 display=await require('../tools/gltron-headful-display.cjs').start(out);
 browser=await require('puppeteer').launch({headless:false,defaultViewport:{width:1050,height:800},env:transient.env(display.env),userDataDir:transient.profile,executablePath:'/opt/google/chrome/chrome',args:[...transient.args,'--no-sandbox','--disable-dev-shm-usage','--disable-component-update','--disable-background-networking'],protocolTimeout:120000});wait=transient.watch(browser.process());browser.process().stdout?.resume();browser.process().stderr?.resume();save('browser-version.json',{version:await browser.version()});
 const page=await browser.newPage();page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>logs.push(String(e)));
 page.on('workercreated',w=>{const row={url:w.url(),modules:[]};workers.push(row);const c=w.client;c.on('Debugger.scriptParsed',v=>{if(v.scriptLanguage==='WebAssembly'||v.url.startsWith('wasm://'))pending.push(c.send('Debugger.getScriptSource',{scriptId:v.scriptId}).then(r=>row.modules.push(sha(Buffer.from(r.bytecode,'base64')))));});pending.push(c.send('Debugger.enable'));});
 await page.evaluateOnNewDocument(()=>localStorage.setItem('wine-assembly.threads','1'));await page.goto('http://127.0.0.1:'+server.address().port+'/?debug&threads&no-log');await page.waitForFunction(()=>typeof WineAssembly==='function');
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=700;c.style='position:fixed;left:0;top:0;z-index:99999;width:1000px;height:700px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.vkeyHost=new WineAssembly();vkeyHost.renderer=new Win98Renderer(c);await vkeyHost.init(c);if(!vkeyHost.guestWorker)throw Error('production Worker required');await vkeyHost.loadExe('/list-vkey-ignore.exe');vkeyHost.run();});
 await page.waitForFunction(()=>Object.values(vkeyHost.renderer.windows).some(w=>w.title==='READY'),{timeout:120000});
 await page.evaluate(()=>{browserInput.wireCanvasInput(vkeyHost.renderer.canvas,vkeyHost.renderer,{runningApps:[{wine:vkeyHost}],debugMode:true});vkeyHost.renderer.canvas.focus();});
 const nativeActions=[],native=args=>{const at=Date.now(),b=cp.execFileSync('xdotool',args,{env:display.env,timeout:15000});nativeActions.push({args,at,completedAt:Date.now(),actualWait:true,stdoutEOF:true,stderrEOF:true});save('native-actions.json',nativeActions);return b;},wins=native(['search','--onlyvisible','--pid',String(browser.process().pid),'--class','chrome']).toString().trim().split(/\s+/);assert.equal(wins.length,1);native(['windowactivate','--sync',wins[0]]);

 save('native-input.json',{route:'private X11 XTEST native Up/Down; F6 focuses WANT list, F7 changes owner -2/-1/DWP mode, F8 reports public state',window:wins[0],cases,palette:{background:0xffffff,highlight:0x800000,foreground:0,selectedForeground:0xffffff},font:'explicit stock16',itemHeight:16});
 let nativeOrigin=null;
 for(let stage=0;stage<cases.length;++stage){
  if(stage===3)native(['key','F6']);
  if(stage===5||stage===7)native(['key','F7']);
  if(stage>0)native(['key',stage%2?'Down':'Up']);
  await new Promise(r=>setTimeout(r,180));native(['key','F8']);
  await page.waitForFunction(j=>Object.values(vkeyHost.renderer.windows).some(w=>w.title?.startsWith(j+' ')),{timeout:15000},stage);
  await new Promise(r=>setTimeout(r,180));
  const s=await page.evaluate(()=>{const encode=a=>{let s='';for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode(...a.subarray(i,i+8192));return btoa(s);};const h=vkeyHost,r=h.renderer,w=Object.values(r.windows).find(w=>w.title==='Authored LISTBOX negative keyboard returns'),p=w._backCanvas._waCanonicalPresentation;return {report:Object.values(r.windows).find(w=>w.isChild&&w.x===15&&w.y===260)?.title,rows:Object.values(r.windows).map(v=>({hwnd:v.hwnd,title:v.title,x:v.x,y:v.y,w:v.w,h:v.h,isChild:v.isChild})),gdi:p?{sharedGuestStorage:p.surface.storage.buffer===h.memory.buffer,pixels:encode(p.surface.rgbaRect(0,0,w.w,w.h))}:null,pixels:encode(w._backCanvas.getContext('2d').getImageData(0,0,w.w,w.h).data),width:w.w,height:w.h,frame:{x:w.x,y:w.y},canvas:r.canvas.getBoundingClientRect().toJSON()};});
  save('stage-'+stage+'-public.json',{report:s.report,rows:s.rows});const nums=s.report.trim().split(/\s+/).map(Number),c=cases[stage];assert.equal(nums.length,55);assert.equal(nums[0],stage);assert.equal(nums[25],0);
  let publicOK=true;const actualSel=expectOld?(c.old||c.sel):c.sel;
  for(let j=0;j<2;++j){const row=nums.slice(1+12*j,13+12*j),wanted=[j?(expectOld?0:c.count):0,actualSel[j],actualSel[j],0,4,0x50000100+(j?0x400:0),1,180,68,1,1,16];assert.deepEqual(row,wanted,'callback count and public selection/caret/top/count/style/font/geometry/enabled/visible/height');}
  const caretBefore=stage===6||stage===8?2:1,key=stage%2?0x28:0x26;
  assert.equal(nums[26],stage<3||expectOld?0:(caretBefore<<16)|key,'exact packed key/caret');
  assert.equal(nums[27],stage<3||expectOld?0:1,'exact callback list HWND');assert.equal(nums[28],stage<3||expectOld?0:1,'exact owner HWND');assert.equal(nums[29],1,'public focus');assert.equal(nums[30],0x12345678,'canary');
  for(let j=0;j<2;++j)for(let k=0;k<4;++k)assert.deepEqual(nums.slice(31+12*j+3*k,34+12*j+3*k),[100+j*10+k,k===1?4:5,1],'public itemdata and text');
  if(expectOld&&stage>=3)failures.push({stage,missingCallback:true});
  assert(s.gdi?.sharedGuestStorage);const pix=Buffer.from(s.pixels,'base64'),gd=Buffer.from(s.gdi.pixels,'base64'),surfaces=[];
  function crop(x,y,w,h){const bytes=Buffer.alloc(w*h*4);for(let r=0;r<h;++r){const at=((y+r)*s.width+x)*4;pix.copy(bytes,r*w*4,at,at+w*4);assert(pix.subarray(at,at+w*4).equals(gd.subarray(at,at+w*4)),'GDI/backcanvas');}surfaces.push({x,y,w,h,bytes});return bytes;}
  for(let j=0;j<2;++j){const actual=crop(15+235*j+2,50+2,176,64),reference=crop(15+235*j+2,150+2,176,64);if(!actual.equals(reference)){const {PNG}=require('pngjs');for(const [name,b]of Object.entries({actual,reference})){const p=new PNG({width:176,height:64});p.data=b;fs.writeFileSync(out+'/mismatch-'+j+'-'+name+'.png',PNG.sync.write(p));}}const same=actual.equals(reference);if(expectOld&&stage===3&&j===1)assert(!same,'old suppression visibly fails fixed reference');else assert(same,'entire interior equals fixed independent literal GDI text/selection reference');const strip=Buffer.alloc(16*64*4);for(let y=0;y<64;++y)for(let x=0;x<16;++x)strip.set(Math.floor(y/16)===actualSel[j]?[0,0,128,255]:[255,255,255,255],(y*16+x)*4);for(let y=0;y<64;++y)assert(actual.subarray((y*176+110)*4,(y*176+126)*4).equals(strip.subarray(y*16*4,(y+1)*16*4)),'literal row geometry/palette');}
  const compositeBytes=await page.screenshot();const raw=cp.execFileSync('xwd',['-root','-silent'],{env:display.env,timeout:3000,maxBuffer:16e6}),encoded=require('../tools/browser-transients.cjs').encodeXwd(raw);
  const{PNG}=require('pngjs'),composite=PNG.sync.read(compositeBytes),desktop=PNG.sync.read(encoded.png);
  const match=(png,v,ox,oy)=>{const x=Math.round(ox+v.x),y=Math.round(oy+v.y);if(x<0||y<0||x+v.w>png.width||y+v.h>png.height)return false;for(let r=0;r<v.h;++r)if(!png.data.subarray(((y+r)*png.width+x)*4,((y+r)*png.width+x+v.w)*4).equals(v.bytes.subarray(r*v.w*4,(r+1)*v.w*4)))return false;return true;};
  assert(surfaces.every(v=>match(composite,v,s.canvas.x+s.frame.x,s.canvas.y+s.frame.y)),'compositor exact');
  if(!nativeOrigin){const v=surfaces[0],needle=v.bytes.subarray(6*v.w*4,7*v.w*4);for(let at=desktop.data.indexOf(needle);at>=0;at=desktop.data.indexOf(needle,at+1)){if(at%4)continue;const ox=at/4%desktop.width-v.x,oy=Math.floor(at/4/desktop.width)-v.y-6;if(surfaces.every(v=>match(desktop,v,ox,oy))){nativeOrigin={x:ox,y:oy};break;}}}
  assert(nativeOrigin&&surfaces.every(v=>match(desktop,v,nativeOrigin.x,nativeOrigin.y)),'native desktop exact at fixed origin');
  if([0,3,5,7].includes(stage)){fs.writeFileSync(out+'/stage-'+stage+'-composited.png',compositeBytes);fs.writeFileSync(out+'/stage-'+stage+'-desktop.png',encoded.png);}
  states.push({stage,publicOK,report:s.report,nativeOrigin,exactGDI:true,exactCompositor:true,exactNativeDesktop:true,nativeCapture:{actualWait:true,stdoutEOF:true,stderrEOF:true,rawSHA256:sha(raw)},surfaces:surfaces.map(({bytes,...v})=>({...v,sha256:sha(bytes)}))});save('states.json',states);
 }
 const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);const cpuState=await cpu.evaluate(()=>{const names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,registers:Object.fromEntries(names.map(n=>[n,instance.exports[n]()>>>0]))};});save('cpu-state.json',cpuState);assert.equal(cpuState.memoryBytes,536870912);assert.equal(Object.keys(cpuState.registers).length,19);assert(cpuState.registers.get_eip&&cpuState.registers.get_esp);
 await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));save('assertions.json',{expectOld,failures,states:states.length,productionBrowserCPU:true});
 if(expectOld){assert(failures.some(v=>v.stage===3&&v.missingCallback));}else assert.deepEqual(failures,[]);console.log('PASS',expectOld?'physical preedit oldFAIL':'LISTBOX qualified negative keyboard returns/public state/native input/fixed GDI four planes',states.length);
 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));if(deferCleanup)save('deferred-transients.json',{root:transient.root,downloads:transient.downloads});else save('transients.json',await transient.cleanup(out));if(display)await display.close();}
}
if(require.main===module)(main(process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync('/dev/shm/list-vkey-ignore-'),{expectOld:process.argv.includes('--expect-old')})).catch(e=>{console.error(e.stack);process.exitCode=1;});module.exports={fixture,main,cases};
