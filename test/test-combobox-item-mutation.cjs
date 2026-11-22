// Microsoft Visual C++ 4, September 1995, vol3 pp163,168,171,174,180-181.
// https://bitsavers.trailing-edge.com/pdf/microsoft/visual_c%2B%2B/Visual_C%2B%2B_4.0_Sep95/Visual_C%2B%2B_Version_4_Volume_3_1995.pdf
// Surviving selected-item identity follows row insertion/deletion/sorted addition.
// Selected-item deletion clearing is unspecified here and intentionally excluded.
// NULL-input failures only preserve an existing emulator invariant. No Windows pixel claim.
// Fixed literal EDIT/LISTBOX references never derive from the control under test.
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const scenarios=[];for(const variant of [3,2,1])for(const [name,msg,index,value,sorted]of [
 ['insert-before',0x14a,0,'Banana',0],['insert-at',0x14a,1,'Banana',0],['insert-after',0x14a,3,'Banana',0],['delete-before',0x144,0,null,0],['delete-after',0x144,3,null,0],['invalid-negative-delete',0x144,-1,null,0],['invalid-count-delete',0x144,4,null,0],['null-add',0x143,0,null,0],['null-insert',0x14a,0,null,0],['sorted-add-before',0x143,0,'Banana',1],['sorted-add-after',0x143,0,'Zzz',1],['sorted-insert-unsorted',0x14a,0,'Zzz',1],['append',0x14a,-1,'End',0]
 ])scenarios.push({variant,name,msg,index,value,sorted});
for(const variant of [2,1])for(const [name,msg,index,value,sorted]of [['free-insert',0x14a,0,'Banana',0],['free-delete',0x144,0,null,0],['free-sorted-add',0x143,0,'Banana',1],['free-invalid-delete',0x144,4,null,0]])scenarios.push({variant,name,msg,index,value,sorted,free:true});
for(const v of scenarios){v.items=['Apple','Mango','Pear','Zulu'];v.ids=[123,124,125,126];v.sel=v.free?-1:1;v.text=v.free?'custom':'Mango';v.ret=-1;
 if(v.msg===0x144){if(v.index>=0&&v.index<4){v.items.splice(v.index,1);v.ids.splice(v.index,1);if(v.sel>v.index)--v.sel;v.ret=3;}}
 else if(v.value!==null){let i=v.msg===0x143?(v.sorted?v.items.findIndex(x=>x.toLowerCase()>v.value.toLowerCase()):4):v.index;if(i<0)i=4;v.items.splice(i,0,v.value);v.ids.splice(i,0,0);if(v.sel>=i)++v.sel;v.ret=i;}
}
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);P API GetWindow(P,U);int API GetClassNameA(P,char*,int);
unsigned short API RegisterClassA(const void*);long API DefWindowProcA(P,U,U,long);P API SetFocus(P);P API GetFocus(void);int API GetDlgCtrlID(P);int API SetWindowTextA(P,const char*);int API DestroyWindow(P);int API MoveWindow(P,int,int,int,int,int);
long API SendMessageA(P,U,U,long);int API GetMessageA(P,P,U,U);int API TranslateMessage(P);long API DispatchMessageA(P);
struct WC{U style;P proc;int cex,wex;P instance,icon,cursor,brush;const char* menu;const char* name;};
static P frame,combo,reflist,reffield,echo,refecho,status,button,instance;static int stage,ready,ret,guard,notifications,identity=1,preSel,preText;
static char report[700],text[100],lbtext[100];
static int variants[N]=VARIANTS,sorted[N]=SORTED,msgs[N]=MSGS,indices[N]=INDICES,frees[N]=FREES,expectedsel[N]=SELS,counts[N]=COUNTS,ids[N][5]=IDS;
static const char* values[N]=VALUES;static const char* expected[N][5]=ITEMS;static const char* texts[N]=TEXTS;
static const char* initial[4]={"Apple","Mango","Pear","Zulu"};
void number(int n,int* at){char d[12];int k=0;if(n<0){report[(*at)++]='-';n=-n;}do{d[k++]='0'+n%10;n/=10;}while(n);while(k)report[(*at)++]=d[--k];report[(*at)++]=' ';}
int same(const char* a,const char* b){while(*a&&*a==*b){++a;++b;}return *a==*b;}
void focusinput(void){if(!frees[stage]){SetFocus(combo);return;}char name[32];for(P h=GetWindow(combo,5);h;h=GetWindow(h,2)){GetClassNameA(h,name,32);if(name[0]=='E'||name[0]=='e'){SetFocus(h);return;}}guard=0;}
void configure(void){if(combo){SendMessageA(combo,0x14f,0,0);DestroyWindow(combo);}if(variants[stage]==3)MoveWindow(reffield,285,40,180,21,1);else MoveWindow(reffield,287,42,159,17,1);combo=CreateWindowExA(0,"COMBOBOX","",0x50010000|variants[stage]|(sorted[stage]?0x100:0),15,40,180,105,frame,(P)10,instance,0);
 for(int j=0;j<4;++j){SendMessageA(combo,0x143,0,(long)initial[j]);SendMessageA(combo,0x151,j,123+j);}SendMessageA(combo,0x14e,frees[stage]?-1:0,0);if(frees[stage])SetWindowTextA(combo,"");SetFocus(button);guard=1;identity=1;SetWindowTextA(status,"ready");}
void reference(void){SendMessageA(reflist,0x184,0,0);for(int j=0;j<counts[stage];++j)SendMessageA(reflist,0x180,0,(long)expected[stage][j]);SendMessageA(reflist,0x186,expectedsel[stage],0);SetWindowTextA(reffield,texts[stage]);SetWindowTextA(refecho,frees[stage]?"":texts[stage]);}
void mutate(void){char before[100],after[100];preSel=SendMessageA(combo,0x147,0,0);preText=SendMessageA(combo,0xd,100,(long)before);SetFocus(button);
 U edit=SendMessageA(combo,0x140,0,0);P focus=GetFocus();int drop=SendMessageA(combo,0x157,0,0);notifications=0;identity=1;
 ret=SendMessageA(combo,msgs[stage],indices[stage],(long)values[stage]);
 SendMessageA(combo,0xd,100,(long)after);guard=guard&&same(before,after)&&GetFocus()==focus&&SendMessageA(combo,0x140,0,0)==edit&&SendMessageA(combo,0x157,0,0)==drop;
 int at=0,n=SendMessageA(combo,0x146,0,0),sel=SendMessageA(combo,0x147,0,0),ok=n==counts[stage];
 for(int j=0;j<n;++j){unsigned char canary[104];for(int k=0;k<104;++k)canary[k]=0xa5;int len=SendMessageA(combo,0x148,j,(long)(canary+2));ok=ok&&same((char*)canary+2,expected[stage][j])&&(U)SendMessageA(combo,0x150,j,0)==ids[stage][j]&&canary[0]==0xa5&&canary[1]==0xa5&&canary[3+len]==0xa5&&canary[103]==0xa5;}
 lbtext[0]=0;if(sel>=0)SendMessageA(combo,0x148,sel,(long)lbtext);SetWindowTextA(echo,lbtext);
 number(stage,&at);number(ret,&at);number(sel,&at);number(n,&at);number(guard,&at);number(ok,&at);number(notifications,&at);number(identity,&at);number(preSel,&at);number(preText,&at);number(SendMessageA(combo,0xe,0,0),&at);number(GetFocus()==button,&at);
 int len=SendMessageA(combo,0xd,100,(long)text);number(len,&at);for(int j=0;text[j];++j)report[at++]=text[j];report[at++]='|';for(int j=0;lbtext[j];++j)report[at++]=lbtext[j];report[at]=0;
 reference();SendMessageA(combo,0x15c,0,0);if(variants[stage]!=1)SendMessageA(combo,0x14f,1,0);SetWindowTextA(status,report);
}
long __stdcall proc(P h,U m,U w,long l){if(m==0x111&&(w&65535)==10){++notifications;identity=identity&&(P)l==combo;return 0;}
 if(m==0x111&&(w&65535)==20&&!ready){ready=1;configure();return 0;}return DefWindowProcA(h,m,w,l);}
void start(void){instance=GetModuleHandleA(0);struct WC wc={0,proc,0,0,0,0,0,(P)16,0,"ComboMutation"};wc.instance=instance;RegisterClassA(&wc);frame=CreateWindowExA(0,"ComboMutation","Authored combo item mutation",0x10cf0000,30,30,950,510,0,0,instance,0);
 reflist=CreateWindowExA(0,"LISTBOX","",0x50000000,285,61,180,84,frame,(P)30,instance,0);
 reffield=CreateWindowExA(0,"EDIT","",0x50000080,287,42,159,17,frame,(P)31,instance,0);echo=CreateWindowExA(0,"EDIT","",0x50000080,502,42,159,17,frame,(P)32,instance,0);refecho=CreateWindowExA(0,"EDIT","",0x50000080,702,42,159,17,frame,(P)33,instance,0);
 button=CreateWindowExA(0,"BUTTON","Ready",0x50010000,15,415,100,26,frame,(P)20,instance,0);status=CreateWindowExA(0,"STATIC","starting",0x50000000,15,460,910,24,frame,(P)21,instance,0);
 U msg[12];while(GetMessageA(msg,0,0,0)>0){if(ready&&msg[1]==0x100){if(msg[2]==0x77&&stage<N-1){++stage;configure();continue;}if(msg[2]==0x76){focusinput();continue;}if(msg[2]==0x75){mutate();continue;}}TranslateMessage(msg);DispatchMessageA(msg);}}
`;
function renderSource(){let s=source.replaceAll(/\bN\b/g,String(scenarios.length));const arrays={VARIANTS:scenarios.map(v=>v.variant),SORTED:scenarios.map(v=>v.sorted),MSGS:scenarios.map(v=>v.msg),INDICES:scenarios.map(v=>v.index),FREES:scenarios.map(v=>+!!v.free),SELS:scenarios.map(v=>v.sel),COUNTS:scenarios.map(v=>v.items.length),VALUES:scenarios.map(v=>v.value),ITEMS:scenarios.map(v=>v.items),IDS:scenarios.map(v=>v.ids),TEXTS:scenarios.map(v=>v.text)};for(const [key,value]of Object.entries(arrays))s=s.replace(key,JSON.stringify(value).replaceAll('[','{').replaceAll(']','}').replaceAll('null','0'));return s;}
function fixture(out){
 fs.writeFileSync(out+'/fixture.c',renderSource());
 for(const [dll,names]of Object.entries({kernel32:['GetModuleHandleA@4'],user32:['CreateWindowExA@48','RegisterClassA@4','DefWindowProcA@16','SetFocus@4','GetFocus@0','GetDlgCtrlID@4','SetWindowTextA@8','DestroyWindow@4','MoveWindow@24','GetWindowRect@8','GetCapture@0','GetDlgItem@8','GetWindow@8','GetClassNameA@12','EnumWindows@8','SendMessageA@16','GetMessageA@16','TranslateMessage@4','DispatchMessageA@4']})){
 fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/fixture.c','-o',out+'/fixture.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/combo-mutation.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib']);return fs.readFileSync(out+'/combo-mutation.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n'),pause=ms=>new Promise(r=>setTimeout(r,ms));
 const runtime=require(root+'/tools/boids-current-runtime.cjs'),commit=cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files=runtime.gitFiles(commit);
 for(const n of files.keys())if(fs.existsSync(root+'/'+n))files.set(n,fs.readFileSync(root+'/'+n));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{maxBuffer:8e6}));
 const wasm=process.env.COMBO_MUTATION_WASM?fs.readFileSync(process.env.COMBO_MUTATION_WASM):runtime.compile(files),pe=fixture(out);fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));files.set('build/wine-assembly.wasm',wasm);files.set('combo-mutation.exe',pe);
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
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1120;c.height=650;c.style='position:fixed;left:0;top:0;z-index:99999;width:1120px;height:650px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.mutationHost=new WineAssembly();mutationHost.renderer=new Win98Renderer(c);await mutationHost.init(c);if(!mutationHost.guestWorker)throw Error('production Worker required');await mutationHost.loadExe('/combo-mutation.exe');mutationHost.run();});
 await page.waitForFunction(()=>Object.values(mutationHost.renderer.windows).some(w=>w.title==='Ready'),{timeout:15000});await page.evaluate(()=>{browserInput.wireCanvasInput(mutationHost.renderer.canvas,mutationHost.renderer,{runningApps:[{wine:mutationHost}],debugMode:true});mutationHost.renderer.canvas.focus();});
 await page.mouse.click(30+6+15+30,30+26+415+12);await page.waitForFunction(()=>Object.values(mutationHost.renderer.windows).some(w=>w.title==="ready"),{timeout:15000});
 async function sample(stage){await pause(180);const spec=scenarios[stage],s=await page.evaluate(variant=>{const h=mutationHost,r=h.renderer,frame=Object.values(r.windows).find(w=>w.title==='Authored combo item mutation'),popup=Object.values(r.windows).find(w=>w.isPopup&&w.visible);
 const encode=a=>{let s='';for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode(...a.subarray(i,i+8192));return btoa(s);};
 const extract=(win,x,y,w,ch)=>{const p=win._backCanvas._waCanonicalPresentation;return {x:win.x+x,y:win.y+y,w,h:ch,pixels:encode(win._backCanvas.getContext('2d').getImageData(x,y,w,ch).data),gdi:p?{shared:p.surface.storage.buffer===h.memory.buffer,pixels:encode(p.surface.rgbaRect(x,y,w,ch))}:null};};
 return {field:extract(frame,23,68,155,13),referenceField:extract(frame,293,68,155,13),echo:extract(frame,508,68,155,13),referenceEcho:extract(frame,708,68,155,13),list:variant===1?extract(frame,23,89,156,78):(popup?extract(popup,4,4,156,78):null),referenceList:extract(frame,293,89,156,78),popup:popup?{x:popup.x,y:popup.y,w:popup.w,h:popup.h}:null,report:Object.values(r.windows).find(w=>w.isChild&&w.x===15&&w.y===460)?.title,memoryBytes:h.memory.buffer.byteLength};},spec.variant);
 assert.equal(s.memoryBytes,536870912);const parts=s.report.split('|'),words=parts[0].trim().split(/\s+/),got=words.slice(0,13).map(Number),text=words.slice(13).join(' '),lbtext=parts[1]||'';
 const want=[stage,spec.ret,spec.sel,spec.items.length,1,1,0,1,spec.free?-1:1,spec.text.length,spec.text.length,1,spec.text.length];
 s.publicPass=JSON.stringify(got)===JSON.stringify(want)&&text===spec.text&&lbtext===(spec.free?'':spec.text);if(!s.publicPass)failures.push({stage,name:spec.name,got,want,text,lbtext,expected:spec.text});s.stage=stage;s.name=spec.name;s.got=got;s.want=want;
 const surfaces=[];for(const name of ['field','referenceField','echo','referenceEcho','list','referenceList']){const p=s[name];assert(p,'authored visible list exists');assert(p.gdi?.shared);assert.equal(p.gdi.pixels,p.pixels,'shared GDI equals backing canvas');surfaces.push({name,x:p.x,y:p.y,w:p.w,h:p.h,bytes:Buffer.from(p.pixels,'base64')});delete p.gdi;delete p.pixels;}
 s.fieldPair=surfaces[0].bytes.equals(surfaces[1].bytes);s.echoPair=surfaces[2].bytes.equals(surfaces[3].bytes);s.visiblePair=surfaces[4].bytes.equals(surfaces[5].bytes);s.geometryPass=spec.variant===1?!s.popup:!!s.popup;
 // Literal references contain independently chosen item strings and selection.
 const reference=surfaces[5];s.referenceProbes=[];for(let row=0;row<5;++row){const selected=row===spec.sel,bg=selected?[0,0,128,255]:[255,255,255,255],i=(row*16*156+140)*4,rgba=[...reference.bytes.subarray(i,i+4)];assert.deepEqual(rgba,bg);let ink=0;const color=selected?[255,255,255]:[0,0,0];for(let y=0;y<Math.min(16,78-row*16);++y)for(let x=0;x<65;++x){const at=((row*16+y)*156+x)*4;if(color.every((v,j)=>reference.bytes[at+j]===v))ink++;}if(row<spec.items.length)assert(ink>5);s.referenceProbes.push({row,item:spec.items[row]||null,selected,rgba,ink});}
 assert(surfaces[1].bytes.some((v,i)=>i%4!==3&&v===0),'literal field text ink');
 const compositeBytes=await page.screenshot();require(root+'/tools/browser-transients.cjs').captureWhole(out,'stage-'+stage+'-desktop',display.env);const desktopPath=out+'/stage-'+stage+'-desktop.png';const {PNG}=require(root+'/node_modules/pngjs'),composite=PNG.sync.read(compositeBytes),desktop=PNG.sync.read(fs.readFileSync(desktopPath)),g=await page.evaluate(()=>mutationHost.renderer.canvas.getBoundingClientRect().toJSON());
 const match=(png,v,ox,oy)=>{const x=Math.round(ox+v.x),y=Math.round(oy+v.y);if(x<0||y<0||x+v.w>png.width||y+v.h>png.height)return false;for(let row=0;row<v.h;++row)if(!png.data.subarray(((y+row)*png.width+x)*4,((y+row)*png.width+x+v.w)*4).equals(v.bytes.subarray(row*v.w*4,(row+1)*v.w*4)))return false;return true;};
 assert(surfaces.every(v=>match(composite,v,g.x,g.y)),'compositor exact fixed fields and rows');const first=surfaces[5],needle=first.bytes.subarray(5*first.w*4,6*first.w*4);let origin=null;for(let at=desktop.data.indexOf(needle);at>=0;at=desktop.data.indexOf(needle,at+1)){if(at%4)continue;const ox=at/4%desktop.width-first.x,oy=Math.floor(at/4/desktop.width)-first.y-5;if(surfaces.every(v=>match(desktop,v,ox,oy))){origin={x:ox,y:oy};break;}}assert(origin,'native desktop exact fixed fields and rows at one origin');s.fourPlanes={sharedGDI:true,backing:true,compositor:true,nativeDesktop:true,origin};
 if([0,3,26,29,39].includes(stage))fs.writeFileSync(out+'/stage-'+stage+'-composited.png',compositeBytes);else fs.unlinkSync(desktopPath);
 s.surfaces=surfaces.map(({bytes,...v})=>({...v,sha256:sha(bytes)}));states.push(s);save('states.json',states);
 }
 const native=args=>cp.execFileSync('xdotool',args,{env:display.env,timeout:5000}),wins=native(['search','--onlyvisible','--pid',String(browser.process().pid),'--class','chrome']).toString().trim().split(/\s+/);assert.equal(wins.length,1);native(['windowactivate','--sync',wins[0]]);save('native-input.json',{route:'XTEST F7 focuses combo then Down selects Mango; unselected editable cases focus public EDIT child and XTEST type custom. F6 mutates; F8 configures next independent case.',window:wins[0],browserPID:browser.process().pid,scenarios});
 for(let stage=0;stage<scenarios.length;++stage){const spec=scenarios[stage];if(stage){native(['key','--clearmodifiers','F8']);await page.waitForFunction(()=>Object.values(mutationHost.renderer.windows).some(w=>w.title==='ready'),{timeout:10000});}
 native(['key','--clearmodifiers','F7']);await pause(100);if(spec.free)native(['type','--clearmodifiers','--delay','30','custom']);else native(['key','--clearmodifiers','Down']);await pause(100);
 native(['key','--clearmodifiers','F6']);await page.waitForFunction(stage=>Object.values(mutationHost.renderer.windows).some(w=>w.title?.startsWith(stage+' ')),{timeout:10000},stage);await sample(stage);}
 const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);const cpuState=await cpu.evaluate(()=>{const names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,registers:Object.fromEntries(names.map(n=>[n,instance.exports[n]()>>>0]))};});save('cpu-state.json',cpuState);assert.equal(cpuState.memoryBytes,536870912);assert.equal(Object.keys(cpuState.registers).length,19);assert(cpuState.registers.get_eip&&cpuState.registers.get_esp);
 await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));save('assertions.json',{expectOld,failures,states:states.length,productionBrowserCPU:true,visiblePairs:states.map(s=>({stage:s.stage,list:s.visiblePair,field:s.fieldPair,publicConsumer:s.echoPair,geometry:s.geometryPass})),fourPlanes:states.every(s=>s.fourPlanes.nativeDesktop)});

 if(expectOld){assert(failures.some(v=>v.stage===0&&v.got[2]===1&&v.want[2]===2),'physical preedit insert index fails');assert(failures.some(v=>v.stage===3&&v.got[2]===1&&v.want[2]===0),'physical preedit delete index fails');assert(states.some(s=>!s.echoPair),'physical preedit public selected-item consumer visible failure');console.log('PASS expected physical preedit old FAIL',failures.length);}else{assert.deepEqual(failures,[]);assert(states.every(s=>s.fieldPair&&s.visiblePair&&s.echoPair),'fixed field/list/public selection consumer refs');console.log('PASS COMBO item mutation native input public state four planes',states.length);}
 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('transients.json',await transient.cleanup(out));if(display)await display.close();}
}

if(require.main===module)main(process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync('/dev/shm/combobox-item-mutation-'),{expectOld:process.argv.includes('--expect-old')}).catch(e=>{console.error(e.stack);process.exitCode=1;});module.exports={fixture,main,scenarios};
