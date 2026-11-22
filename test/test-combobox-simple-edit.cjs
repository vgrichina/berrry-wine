// Microsoft primary contract, available in the Win3.1 SDK and desktop USER:
// https://learn.microsoft.com/en-us/windows/win32/controls/combo-box-styles
// https://learn.microsoft.com/en-us/windows/win32/controls/cb-seteditsel
// https://learn.microsoft.com/en-us/windows/win32/controls/cb-geteditsel
// https://learn.microsoft.com/en-us/windows/win32/controls/cb-limittext
// https://learn.microsoft.com/en-us/windows/win32/controls/cb-showdropdown
// Authored PE; fixed public EDIT/LISTBOX references, not Windows pixel equivalence.
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const scenarios=[
 {text:'Seed',sel:-1,lo:4,hi:4},
 {text:'Seedx',sel:-1,lo:5,hi:5,input:'x',edit:true},
 {text:'abcdef',sel:-1,lo:1,hi:4},
 {text:'Z',sel:-1,lo:1,hi:1,input:'Z',all:true,edit:true},
 {text:'ab',sel:-1,lo:2,hi:2},
 {text:'abc',sel:-1,lo:3,hi:3,input:'cde',edit:true},
 {text:'Longer',sel:-1,lo:6,hi:6},
 {text:'Option 02',sel:2,lo:9,hi:9},
 {text:'Option 01',sel:1,lo:9,hi:9,list:true},
 {text:'Option 01',sel:1,lo:9,hi:9},
 {text:'Option 01',sel:1,lo:9,hi:9,wide:true},
 {text:'Q',sel:1,lo:1,hi:1,input:'Q',all:true,edit:true,wide:true},
 {text:'abcdef',sel:1,lo:2,hi:5,wide:true},
 {text:'abzf',sel:1,lo:3,hi:3,replace:true,edit:true,wide:true},
 {text:'',sel:-1,lo:0,hi:0,wide:true},
];
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);P API GetWindow(P,U);
unsigned short API RegisterClassA(const void*);long API DefWindowProcA(P,U,U,long);P API SetFocus(P);P API GetFocus(void);int API GetDlgCtrlID(P);int API SetWindowTextA(P,const char*);int API DestroyWindow(P);int API MoveWindow(P,int,int,int,int,int);int API GetWindowRect(P,int*);P API GetCapture(void);
long API SendMessageA(P,U,U,long);int API GetMessageA(P,P,U,U);int API TranslateMessage(P);long API DispatchMessageA(P);
struct WC{U style;P proc;int cex,wex;P instance,icon,cursor,brush;const char* menu;const char* name;};
static P frame,combo,ref,refedit,status,button,instance;static int stage,ready,counts[11],identity=1;static char report[500],text[100],shorttext[4];
static const char* items[4]={"Option 00","Option 01","Option 02","Option 03"};static const char* texts[15]=TEXTS;static int sels[15]=SELS;
void number(int n,int* at){char d[12];int k=0;if(n<0){report[(*at)++]='-';n=-n;}do{d[k++]='0'+n%10;n/=10;}while(n);while(k)report[(*at)++]=d[--k];report[(*at)++]=' ';}
void add(P h,int cb){for(int j=0;j<4;++j){SendMessageA(h,cb?0x143:0x180,0,(long)items[j]);SendMessageA(h,cb?0x151:0x19a,j,123+j);}}
void publish(void){int at=0,wr[4],ok=1;U lo=999,hi=999,r=SendMessageA(combo,0x140,(U)&lo,(long)&hi),ret=SendMessageA(combo,0xd,100,(long)text),small=SendMessageA(combo,0xd,4,(long)shorttext);GetWindowRect(combo,wr);for(int j=0;j<(stage==14?0:4);++j)ok=ok&&SendMessageA(combo,0x150,j,0)==123+j;
 number(stage,&at);number(SendMessageA(combo,0x147,0,0),&at);number(r,&at);number(lo,&at);number(hi,&at);number(SendMessageA(combo,0xe,0,0),&at);number(ret,&at);number(small,&at);number(shorttext[3]==0,&at);number(SendMessageA(combo,0x146,0,0),&at);number(SendMessageA(combo,0x157,0,0),&at);number(GetCapture()==0,&at);number(ok&&identity,&at);number(wr[2]-wr[0],&at);number(wr[3]-wr[1],&at);for(int j=1;j<11;++j)number(counts[j],&at);for(int j=0;text[j];++j)report[at++]=text[j];report[at]=0;SetWindowTextA(status,report);}
void configure(void){if(stage==2){SetWindowTextA(combo,"abcdef");SendMessageA(combo,0x142,0,1|(4<<16));}if(stage==4){SetWindowTextA(combo,"ab");SendMessageA(combo,0x141,3,0);SendMessageA(combo,0x142,0,2|(2<<16));}if(stage==6)SetWindowTextA(combo,"Longer");if(stage==7)SendMessageA(combo,0x14e,2,0);if(stage==9){SendMessageA(combo,0x14f,0,0);SendMessageA(combo,0x100,0x73,0);SendMessageA(combo,0x100,0x1b,0);SendMessageA(combo,0x14f,1,0);}if(stage==10){MoveWindow(combo,15,40,240,117,1);MoveWindow(ref,500,61,240,96,1);MoveWindow(refedit,502,42,236,17,1);SendMessageA(combo,0x141,100,0);}if(stage==12){SetWindowTextA(combo,"abcdef");SendMessageA(combo,0x142,0,2|(5<<16));}if(stage==14){SendMessageA(combo,0x14b,0,0);SendMessageA(ref,0x184,0,0);}SetWindowTextA(refedit,texts[stage]);if(stage==2)SendMessageA(refedit,0xb1,1,4);if(stage==12)SendMessageA(refedit,0xb1,2,5);SendMessageA(ref,0x186,sels[stage],0);}
long __stdcall proc(P h,U m,U w,long l){if(m==0x111&&(w&65535)==10){int n=w>>16;if(n<11)++counts[n];identity=identity&&(P)l==combo;return 0;}if(m==0x111&&(w&65535)==20&&!ready){combo=CreateWindowExA(0,"COMBOBOX","Seed",0x50010081,15,40,180,101,frame,(P)10,instance,0);add(combo,1);for(int j=0;j<11;++j)counts[j]=0;ready=1;SetFocus(button);publish();return 0;}return DefWindowProcA(h,m,w,l);}
void start(void){instance=GetModuleHandleA(0);struct WC wc={0,proc,0,0,0,0,0,(P)16,0,"ComboSimple"};wc.instance=instance;RegisterClassA(&wc);frame=CreateWindowExA(0,"ComboSimple","Authored combo SIMPLE edit",0x10cf0000,30,30,850,510,0,0,instance,0);
 ref=CreateWindowExA(0,"LISTBOX","",0x50000000,500,61,180,80,frame,(P)30,instance,0);add(ref,0);refedit=CreateWindowExA(0,"EDIT","Seed",0x50000080,502,42,176,17,frame,(P)31,instance,0);
 button=CreateWindowExA(0,"BUTTON","Ready",0x50010000,15,415,100,26,frame,(P)20,instance,0);status=CreateWindowExA(0,"STATIC","starting",0x50000000,15,460,800,24,frame,(P)21,instance,0);
 U msg[12];while(GetMessageA(msg,0,0,0)>0){if(ready&&msg[1]==0x100&&msg[2]==0x76){SetFocus(combo);SendMessageA(combo,0x142,0,2|(5<<16));continue;}if(ready&&msg[1]==0x100&&msg[2]==0x75){++stage;configure();SetFocus(button);publish();for(int j=0;j<11;++j)counts[j]=0;continue;}TranslateMessage(msg);DispatchMessageA(msg);}}
`;
function fixture(out){
 fs.writeFileSync(out+'/fixture.c',source.replace('TEXTS','{'+scenarios.map(v=>JSON.stringify(v.text)).join(',')+'}').replace('SELS','{'+scenarios.map(v=>v.sel).join(',')+'}'));
 for(const [dll,names]of Object.entries({kernel32:['GetModuleHandleA@4'],user32:['CreateWindowExA@48','RegisterClassA@4','DefWindowProcA@16','SetFocus@4','GetFocus@0','GetDlgCtrlID@4','SetWindowTextA@8','DestroyWindow@4','MoveWindow@24','GetWindowRect@8','GetCapture@0','GetDlgItem@8','GetWindow@8','EnumWindows@8','SendMessageA@16','GetMessageA@16','TranslateMessage@4','DispatchMessageA@4']})){
 fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/fixture.c','-o',out+'/fixture.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/combo-simple.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib']);return fs.readFileSync(out+'/combo-simple.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n'),pause=ms=>new Promise(r=>setTimeout(r,ms));
 const runtime=require(root+'/tools/boids-current-runtime.cjs'),commit=cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files=runtime.gitFiles(commit);
 for(const n of files.keys())if(fs.existsSync(root+'/'+n))files.set(n,fs.readFileSync(root+'/'+n));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{maxBuffer:8e6}));
 const wasm=process.env.COMBO_SIMPLE_WASM?fs.readFileSync(process.env.COMBO_SIMPLE_WASM):runtime.compile(files),pe=fixture(out);fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));files.set('build/wine-assembly.wasm',wasm);files.set('combo-simple.exe',pe);
 fs.writeFileSync(out+'/runtime.diff',cp.execFileSync('git',['diff','--binary','HEAD','--','src','lib','tools','index.html','host.js'],{maxBuffer:32e6}));
 save('runtime.json',{commit,moduleSHA256:sha(wasm),peSHA256:sha(pe),testSHA256:sha(fs.readFileSync(__filename)),files:[...files].map(([name,b])=>({name,size:b.length,sha256:sha(b)}))});
 const transient=require(root+'/tools/browser-transients.cjs').create(),logs=[],pending=[],workers=[],states=[],failures=[];let display,browser,wait,server;
 try{
 server=http.createServer((req,res)=>{const n=new URL(req.url,'http://local').pathname.slice(1)||'index.html',b=files.get(n);res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.html')?'text/html':n.endsWith('.css')?'text/css':n.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.statusCode=b?200:404;res.end(b||'missing');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 display=await require(root+'/tools/gltron-headful-display.cjs').start(out);
 browser=await require(root+'/node_modules/puppeteer').launch({headless:false,defaultViewport:{width:1150,height:800},env:transient.env(display.env),userDataDir:transient.profile,executablePath:'/opt/google/chrome/chrome',args:[...transient.args,'--window-size=1250,980','--no-sandbox','--disable-dev-shm-usage','--disable-component-update','--disable-background-networking'],protocolTimeout:45000});wait=transient.watch(browser.process());browser.process().stdout?.resume();browser.process().stderr?.resume();save('browser-version.json',{version:await browser.version()});
 const page=await browser.newPage();page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>logs.push(String(e)));
 page.on('workercreated',w=>{const row={url:w.url(),modules:[]};workers.push(row);const c=w.client;c.on('Debugger.scriptParsed',v=>{if(v.scriptLanguage==='WebAssembly'||v.url.startsWith('wasm://'))pending.push(c.send('Debugger.getScriptSource',{scriptId:v.scriptId}).then(r=>row.modules.push(sha(Buffer.from(r.bytecode,'base64')))));});pending.push(c.send('Debugger.enable'));});
 await page.evaluateOnNewDocument(()=>localStorage.setItem('wine-assembly.threads','1'));await page.goto('http://127.0.0.1:'+server.address().port+'/?debug&threads&no-log');await page.waitForFunction(()=>typeof WineAssembly==='function');
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1120;c.height=650;c.style='position:fixed;left:0;top:0;z-index:99999;width:1120px;height:650px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.simpleHost=new WineAssembly();simpleHost.renderer=new Win98Renderer(c);await simpleHost.init(c);if(!simpleHost.guestWorker)throw Error('production Worker required');await simpleHost.loadExe('/combo-simple.exe');simpleHost.run();});
 await page.waitForFunction(()=>Object.values(simpleHost.renderer.windows).some(w=>w.title==='Ready'),{timeout:15000});await page.evaluate(()=>{browserInput.wireCanvasInput(simpleHost.renderer.canvas,simpleHost.renderer,{runningApps:[{wine:simpleHost}],debugMode:true});simpleHost.renderer.canvas.focus();});
 await page.mouse.click(30+6+15+30,30+26+415+12);await page.waitForFunction(()=>Object.values(simpleHost.renderer.windows).some(w=>/^0 /.test(w.title)),{timeout:15000});
 async function sample(stage){await pause(240);const spec=scenarios[stage],s=await page.evaluate(({stage,wide})=>{const h=simpleHost,r=h.renderer,frame=Object.values(r.windows).find(w=>w.title==='Authored combo SIMPLE edit');
 const extract=(x,y,w,ch)=>{const p=frame._backCanvas._waCanonicalPresentation;return {x:frame.x+x,y:frame.y+y,w,h:ch,pixels:Array.from(frame._backCanvas.getContext('2d').getImageData(x,y,w,ch).data),gdi:p?{shared:p.surface.storage.buffer===h.memory.buffer,pixels:Array.from(p.surface.rgbaRect(x,y,w,ch))}:null};};return {field:extract(23,68,wide?232:172,13),referenceField:extract(508,68,wide?232:172,13),list:extract(23,89,140,60),referenceList:extract(508,89,140,60),popup:Object.values(r.windows).some(w=>w.isPopup&&w.visible),report:Object.values(r.windows).find(w=>w.isChild&&w.x===15&&w.y===460)?.title,memoryBytes:h.memory.buffer.byteLength};},{stage,wide:spec.wide});
 assert.equal(s.memoryBytes,536870912);const got=s.report.trim().split(/\s+/).slice(0,25).map(Number),want=[stage,spec.sel,(spec.hi<<16)|spec.lo,spec.lo,spec.hi,spec.text.length,spec.text.length,Math.min(3,spec.text.length),1,stage===14?0:4,1,1,1,spec.wide?240:180,spec.wide?117:101];
 const actualText=s.report.trim().split(/\s+/).slice(25).join(' ');const ns=got.slice(15);s.publicPass=JSON.stringify(got.slice(0,15))===JSON.stringify(want)&&actualText===spec.text;
 // Focus notifications may accompany native input. Selection and edit
 // notifications must identify the combo itself; programmatic text/selection
 // and popup messages must not appear as user edits or dropdown events.
 const notifyPass=ns[6]===0&&ns[7]===0&&ns[8]===0&&ns[9]===0&&(spec.edit?ns[4]>0&&ns[5]>0:ns[4]===0&&ns[5]===0)&&(!spec.list||ns[0]===1);
 s.publicPass=s.publicPass&&notifyPass;if(!s.publicPass)failures.push({stage,got,want,text:actualText,expectedText:spec.text,notifyPass});s.stage=stage;s.got=got;s.want=want;
 const surfaces=[];for(const name of ['field','referenceField','list','referenceList']){const p=s[name];assert(p.gdi?.shared);assert(Buffer.from(p.gdi.pixels).equals(Buffer.from(p.pixels)),'shared GDI matches backing canvas');surfaces.push({x:p.x,y:p.y,w:p.w,h:p.h,bytes:Buffer.from(p.pixels)});delete p.gdi;}
 s.visiblePair=surfaces[0].bytes.equals(surfaces[1].bytes)&&surfaces[2].bytes.equals(surfaces[3].bytes);s.geometryPass=!s.popup;
 const reference=surfaces[3],expected=Buffer.alloc(12*60*4),strip=Buffer.alloc(expected.length);for(let y=0;y<60;++y){reference.bytes.copy(strip,y*12*4,(y*140+115)*4,(y*140+127)*4);for(let x=0;x<12;++x)expected.set(Math.floor((y+2)/16)===spec.sel?[0,0,128,255]:[255,255,255,255],(y*12+x)*4);}assert(strip.equals(expected),'fixed reference literal selection bands');
 const compositeBytes=await page.screenshot();require(root+'/tools/browser-transients.cjs').captureWhole(out,'stage-'+stage+'-desktop',display.env);const desktopPath=out+'/stage-'+stage+'-desktop.png';const {PNG}=require(root+'/node_modules/pngjs'),composite=PNG.sync.read(compositeBytes),desktop=PNG.sync.read(fs.readFileSync(desktopPath)),g=await page.evaluate(()=>simpleHost.renderer.canvas.getBoundingClientRect().toJSON());
 const match=(png,v,ox,oy)=>{const x=Math.round(ox+v.x),y=Math.round(oy+v.y);if(x<0||y<0||x+v.w>png.width||y+v.h>png.height)return false;for(let row=0;row<v.h;++row)if(!png.data.subarray(((y+row)*png.width+x)*4,((y+row)*png.width+x+v.w)*4).equals(v.bytes.subarray(row*v.w*4,(row+1)*v.w*4)))return false;return true;};
 assert(surfaces.every(v=>match(composite,v,g.x,g.y)),'compositor exact field and rows');const first=surfaces[3],needle=first.bytes.subarray(5*first.w*4,6*first.w*4);let origin=null;for(let at=desktop.data.indexOf(needle);at>=0;at=desktop.data.indexOf(needle,at+1)){if(at%4)continue;const ox=at/4%desktop.width-first.x,oy=Math.floor(at/4/desktop.width)-first.y-5;if(surfaces.every(v=>match(desktop,v,ox,oy))){origin={x:ox,y:oy};break;}}assert(origin,'native desktop exact field and rows at one origin');s.fourPlanes={sharedGDI:true,backing:true,compositor:true,nativeDesktop:true,origin};
 if([0,1,5,8,11,13].includes(stage))fs.writeFileSync(out+'/stage-'+stage+'-composited.png',compositeBytes);else fs.unlinkSync(desktopPath);
 s.surfaces=surfaces.map(({bytes,...v})=>({...v,sha256:sha(bytes)}));for(const name of ['field','referenceField','list','referenceList'])delete s[name].pixels;states.push(s);save('states.json',states);
 }
 const native=args=>cp.execFileSync('xdotool',args,{env:display.env,timeout:5000}),wins=native(['search','--onlyvisible','--pid',String(browser.process().pid),'--class','chrome']).toString().trim().split(/\s+/);assert.equal(wins.length,1);native(['windowactivate','--sync',wins[0]]);save('native-input.json',{route:'XTEST mouse/key/type to activated owned Chrome window',window:wins[0],browserPID:browser.process().pid,scenarios});
 await sample(0);for(let stage=1;stage<scenarios.length;++stage){const spec=scenarios[stage],o=states[0].fourPlanes.origin;
 if(spec.input||spec.list){native(['mousemove',String(o.x+30+6+15+(spec.wide?222:145)),String(o.y+30+26+40+(spec.list?21+2+16+8:10)),'click','1']);await pause(100);if(spec.all){native(['keydown','ctrl']);native(['key','a']);await pause(400);native(['keyup','ctrl']);await pause(100);}if(spec.input)native(['type','--clearmodifiers','--delay','70',spec.input]);}
 if(spec.replace){native(['key','--clearmodifiers','F7']);await pause(100);native(['type','--clearmodifiers','z']);}
 await pause(160);native(['key','--clearmodifiers','F6']);await page.waitForFunction(stage=>Object.values(simpleHost.renderer.windows).some(w=>w.title?.startsWith(stage+' ')),{timeout:10000},stage);await sample(stage);}
 const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);const cpuState=await cpu.evaluate(()=>{const names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,registers:Object.fromEntries(names.map(n=>[n,instance.exports[n]()>>>0]))};});save('cpu-state.json',cpuState);assert.equal(cpuState.memoryBytes,536870912);assert.equal(Object.keys(cpuState.registers).length,19);assert(cpuState.registers.get_eip&&cpuState.registers.get_esp);
 await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));save('assertions.json',{expectOld,failures,states:states.length,productionBrowserCPU:true,visiblePairs:states.map(s=>({stage:s.stage,equal:s.visiblePair,geometry:s.geometryPass})),fourPlanes:states.every(s=>s.fourPlanes.nativeDesktop)});

 if(expectOld){assert(failures.some(v=>v.stage===1&&v.text!=='Seedx'),'physical preedit native typing fails');assert(states.some(s=>!s.visiblePair),'physical preedit visible field/list fails');console.log('PASS expected physical old FAIL',failures.length);}else{assert.deepEqual(failures,[]);assert(states.every(s=>s.visiblePair&&s.geometryPass),'fixed public EDIT and LISTBOX references');console.log('PASS COMBOBOX SIMPLE edit native input public state four planes',states.length);}
 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('transients.json',await transient.cleanup(out));if(display)await display.close();}
}

if(require.main===module)main(process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync('/dev/shm/combobox-simple-edit-'),{expectOld:process.argv.includes('--expect-old')}).catch(e=>{console.error(e.stack);process.exitCode=1;});module.exports={fixture,main,scenarios};
