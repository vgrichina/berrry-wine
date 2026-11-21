'use strict';
// Native CLASS27 TCM_SETITEMA/W short ASCII text contract.
// Microsoft: /windows/win32/controls/tcm-setitem and TCITEMA/W.
// Fixed expected labels and separately inserted reference tabs precede edits.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const expected=[["Audio","Video","Input"],["Audio","Sound","Input"],["Graphics","Sound","Input"],["Graphics","Sound","Input"],["Graphics","Sound","Input"],["Graphics","Sound","Input"],["Graphics","FX","Input"],["","FX","Input"],["","FX","Controls123456"],["","FX","Keys"],["","FX","Keys"],["","FX","Keys"]];
const returns=[-9,1,1,1,0,0,1,1,1,1,0,0];
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
unsigned short API RegisterClassA(const void*);long API DefWindowProcA(P,U,U,long);P API SetFocus(P);P API GetFocus(void);int API GetDlgCtrlID(P);int API SetWindowTextA(P,const char*);
long API SendMessageA(P,U,U,long);int API GetMessageA(P,P,U,U);int API TranslateMessage(P);long API DispatchMessageA(P);int API InitCommonControlsEx(P);
struct WC{U style;P proc;int cex,wex;P instance,icon,cursor,brush;const char* menu;const char* name;};
struct Item{U mask,state,smask;char* text;int length,image;long param;};
static P frame,tabs,ref,status;static int stage,ready,notifications,result=-9;static char report[1000];
static char* labels[12][3]={
 {"Audio","Video","Input"},{"Audio","Sound","Input"},{"Graphics","Sound","Input"},
 {"Graphics","Sound","Input"},{"Graphics","Sound","Input"},{"Graphics","Sound","Input"},
 {"Graphics","FX","Input"},{"","FX","Input"},{"","FX","Controls123456"},
 {"","FX","Keys"},{"","FX","Keys"},{"","FX","Keys"}};
void number(int n,int* at){char d[12];int k=0;if(n<0){report[(*at)++]='-';n=-n;}do{d[k++]='0'+n%10;n/=10;}while(n);while(k)report[(*at)++]=d[--k];report[(*at)++]=' ';}
void reference(void){SendMessageA(ref,0x1309,0,0);for(int j=0;j<3;++j){struct Item it={1,0,0,labels[stage][j],0,0,0};SendMessageA(ref,0x1307,j,(long)&it);}SendMessageA(ref,0x130c,1,0);}
void publish(void){int at=0,guard=1,returns=0;char texts[6][20];for(int wide=0;wide<2;++wide)for(int j=0;j<3;++j){unsigned short b[22];for(int k=0;k<22;++k)b[k]=0x5555;struct Item it={1,0,0,(char*)(b+1),20,0,0};returns+=SendMessageA(tabs,wide?0x133c:0x1305,j,(long)&it);guard=guard&&b[0]==0x5555&&b[21]==0x5555;int k=0;for(;k<19;++k){int c=wide?b[k+1]:((unsigned char*)(b+1))[k];texts[wide*3+j][k]=(char)c;if(!c)break;}texts[wide*3+j][19]=0;}
 number(stage,&at);number(result,&at);number(SendMessageA(tabs,0x1304,0,0),&at);number(SendMessageA(tabs,0x130b,0,0),&at);number(SendMessageA(tabs,0x132f,0,0),&at);number(GetDlgCtrlID(GetFocus()),&at);number(notifications,&at);number(returns,&at);number(guard,&at);report[at++]='|';for(int j=0;j<6;++j){for(int k=0;texts[j][k];++k)report[at++]=texts[j][k];report[at++]='|';}report[at]=0;SetWindowTextA(status,report);}
void advance(void){++stage;char ansi[20]="Sound";struct Item it={1,0,0,ansi,1,0,0};unsigned short wide[20]={0};int index=1,msg=0x1306;char* value="Graphics";
 if(stage==2){index=0;msg=0x133d;}if(stage==3){it.mask=0;it.text=(char*)1;}if(stage==4){index=-1;it.text=(char*)1;}if(stage==5){index=3;msg=0x133d;it.text=(char*)1;}
 if(stage==6){it.text="FX";it.length=0;}if(stage==7){index=0;msg=0x133d;value="";it.length=-1;}if(stage==8){index=2;it.text="Controls123456";it.length=-1;}if(stage==9){index=2;msg=0x133d;value="Keys";}if(stage==10){index=-1;msg=0x133d;it.text=(char*)1;}if(stage==11){index=3;it.text=(char*)1;}
 if(msg==0x133d&&index>=0&&index<3){for(int j=0;value[j];++j)wide[j]=value[j];it.text=(char*)wide;}result=SendMessageA(tabs,msg,index,(long)&it);if(stage==1)it.text[0]='X';if(stage==2)wide[0]='X';reference();publish();}
long __stdcall proc(P h,U m,U w,long l){if(m==0x4e){++notifications;return 0;}if(m==0x111&&(w&65535)==20){SetFocus(tabs);ready=1;publish();return 0;}return DefWindowProcA(h,m,w,l);}
void start(void){U ic[2]={8,8};InitCommonControlsEx(ic);P i=GetModuleHandleA(0);struct WC wc={0,proc,0,0,0,0,0,(P)16,0,"TabMenu"};wc.instance=i;RegisterClassA(&wc);frame=CreateWindowExA(0,"TabMenu","Authored tab text settings",0x10cf0000,30,30,570,280,0,0,i,0);
 tabs=CreateWindowExA(0,"SysTabControl32","",0x50010000,15,40,230,100,frame,(P)10,i,0);ref=CreateWindowExA(0,"SysTabControl32","",0x50000000,285,40,230,100,frame,(P)30,i,0);
 for(int j=0;j<3;++j){struct Item it={1,0,0,labels[0][j],0,0,0};SendMessageA(tabs,0x1307,j,(long)&it);}SendMessageA(tabs,0x130c,1,0);reference();CreateWindowExA(0,"BUTTON","Ready",0x50010000,15,170,100,26,frame,(P)20,i,0);status=CreateWindowExA(0,"STATIC","starting",0x50000000,15,215,540,24,frame,(P)21,i,0);
 U msg[12];while(GetMessageA(msg,0,0,0)>0){if(ready&&msg[1]==0x100&&msg[2]=='N'&&stage<11)advance();TranslateMessage(msg);DispatchMessageA(msg);}}
`;
function fixture(out){
 fs.writeFileSync(out+'/fixture.c',source);
 for(const [dll,names]of Object.entries({comctl32:['InitCommonControlsEx@4'],kernel32:['GetModuleHandleA@4'],user32:['CreateWindowExA@48','RegisterClassA@4','DefWindowProcA@16','SetFocus@4','GetFocus@0','GetDlgCtrlID@4','SetWindowTextA@8','SendMessageA@16','GetMessageA@16','TranslateMessage@4','DispatchMessageA@4']})){
 fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/fixture.c','-o',out+'/fixture.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/tab-menu.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib',out+'/comctl32.lib']);return fs.readFileSync(out+'/tab-menu.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n'),pause=ms=>new Promise(r=>setTimeout(r,ms));
 const runtime=require(root+'/tools/boids-current-runtime.cjs'),commit=process.env.TAB_COMMIT||cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files=runtime.gitFiles(commit);
 if(process.env.TAB_WORKING_RUNTIME)for(const n of files.keys())if(fs.existsSync(root+'/'+n))files.set(n,fs.readFileSync(root+'/'+n));
 for(const n of ['src/09c3-controls.wat'])files.set(n,expectOld?cp.execFileSync('git',['show',commit+':'+n],{cwd:root}):fs.readFileSync(root+'/'+n));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{maxBuffer:8e6}));
 const wasm=process.env.TAB_WASM?fs.readFileSync(process.env.TAB_WASM):runtime.compile(files),pe=fixture(out);fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));files.set('build/wine-assembly.wasm',wasm);files.set('tab-menu.exe',pe);
 save('runtime.json',{commit,moduleSHA256:sha(wasm),peSHA256:sha(pe),expected,files:[...files].map(([name,b])=>({name,size:b.length,sha256:sha(b)}))});
 const controlBase=Number(/CONTROL_TABLE: \{[^}]*base: (0x[0-9a-fA-F_]+)/.exec(files.get('lib/region-map.generated.js').toString())[1].replaceAll('_',''));
 const transient=require(root+'/tools/browser-transients.cjs').create(),logs=[],pending=[],workers=[],states=[],failures=[];let display,browser,wait,server;
 try{
 server=http.createServer((req,res)=>{const n=new URL(req.url,'http://local').pathname.slice(1)||'index.html',b=files.get(n);res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.html')?'text/html':n.endsWith('.css')?'text/css':n.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.statusCode=b?200:404;res.end(b||'missing');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 display=await require(root+'/tools/gltron-headful-display.cjs').start(out);
 browser=await require(root+'/node_modules/puppeteer').launch({headless:false,defaultViewport:{width:1050,height:800},env:transient.env(display.env),userDataDir:transient.profile,executablePath:'/opt/google/chrome/chrome',args:[...transient.args,'--no-sandbox','--disable-dev-shm-usage','--disable-component-update','--disable-background-networking'],protocolTimeout:45000});wait=transient.watch(browser.process());browser.process().stdout?.resume();browser.process().stderr?.resume();save('browser-version.json',{version:await browser.version()});
 const page=await browser.newPage();page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>logs.push(String(e)));
 page.on('workercreated',w=>{const row={url:w.url(),modules:[]};workers.push(row);const c=w.client;c.on('Debugger.scriptParsed',v=>{if(v.scriptLanguage==='WebAssembly'||v.url.startsWith('wasm://'))pending.push(c.send('Debugger.getScriptSource',{scriptId:v.scriptId}).then(r=>row.modules.push(sha(Buffer.from(r.bytecode,'base64')))));});pending.push(c.send('Debugger.enable'));});
 await page.evaluateOnNewDocument(()=>localStorage.setItem('wine-assembly.threads','1'));await page.goto('http://127.0.0.1:'+server.address().port+'/?debug&threads&no-log');await page.waitForFunction(()=>typeof WineAssembly==='function');
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=650;c.style='position:fixed;left:0;top:0;z-index:99999;width:1000px;height:650px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.tabHost=new WineAssembly();tabHost.renderer=new Win98Renderer(c);await tabHost.init(c);if(!tabHost.guestWorker)throw Error('production Worker required');await tabHost.loadExe('/tab-menu.exe');tabHost.run();});
 await page.waitForFunction(()=>Object.values(tabHost.renderer.windows).some(w=>w.title==='Ready'),{timeout:15000});await page.evaluate(()=>{browserInput.wireCanvasInput(tabHost.renderer.canvas,tabHost.renderer,{runningApps:[{wine:tabHost}],debugMode:true});tabHost.renderer.canvas.focus();});
 await page.mouse.click(30+6+15+30,30+26+170+12);await page.waitForFunction(()=>Object.values(tabHost.renderer.windows).some(w=>/^0 -9 3 1 1 10 /.test(w.title)),{timeout:15000});

 async function sample(stage,phase,key){await pause(110);const s=await page.evaluate(base=>{const h=tabHost,r=h.renderer,w=Object.values(r.windows).find(w=>w.title==='Authored tab text settings');const v=new DataView(h.memory.buffer);let kind=null;for(let i=0;i<256;i++)if(v.getUint32(base+i*16+4,true)===10)kind=v.getUint32(base+i*16,true);const p=w._backCanvas._waCanonicalPresentation;return {kind,gdi:p?{shared:p.surface.storage.buffer===h.memory.buffer,pixels:Array.from(p.surface.rgbaRect(0,0,w.w,w.h))}:null,report:Object.values(r.windows).find(w=>w.isChild&&w.x===15&&w.y===215)?.title,memoryBytes:h.memory.buffer.byteLength,rows:Object.values(r.windows).map(v=>({hwnd:v.hwnd,title:v.title,x:v.x,y:v.y,w:v.w,h:v.h,visible:v.visible,isChild:v.isChild})),pixels:Array.from(w._backCanvas.getContext('2d').getImageData(0,0,w.w,w.h).data),width:w.w,height:w.h};},controlBase);assert.equal(s.kind,27,"public SysTabControl32 must route to native class27");
 const parts=s.report.split('|'),got=parts[0].trim().split(/\s+/).map(Number),want=[stage,returns[stage],3,1,1,10,0,6,1];
 s.stage=stage;s.phase=phase;s.expected={numbers:want,labels:expected[stage]};s.actual={numbers:got,labels:parts.slice(1,7)};s.publicPass=got.length===want.length&&want.every((v,i)=>got[i]===v)&&parts.slice(1,7).every((v,i)=>v===expected[stage][i%3]);if(!s.publicPass)failures.push({stage,got,want,labels:s.actual.labels});
 const pix=Buffer.from(s.pixels);assert(s.gdi?.shared,"GDI uses shared guest memory");const gdi=Buffer.from(s.gdi.pixels);s.gdiShared=true;s.gdiMatchesBacking=gdi.equals(pix);assert(s.gdiMatchesBacking);delete s.gdi;const x=19,y=64,w=230,h=100;let equal=true;for(let row=0;row<h;++row)if(!pix.subarray(((y+row)*s.width+x)*4,((y+row)*s.width+x+w)*4).equals(pix.subarray(((y+row)*s.width+x+270)*4,((y+row)*s.width+x+270+w)*4)))equal=false;s.pairs=[{equal}];
 // Fixed label lengths determine the selected top bevel independently.
 s.probes=[];let left=0;for(let j=0;j<3;++j){const rgba=Array.from(pix.subarray(((y)*s.width+x+left+8)*4,((y)*s.width+x+left+8)*4+4));const expectedRGBA=j===1?[255,255,255,255]:[192,192,192,255];s.probes.push({j,rgba,expectedRGBA,pass:rgba.every((v,i)=>v===expectedRGBA[i])});left+=expected[stage][j].length*5+16;}
 if(stage===0||stage===1||stage===2||stage===8||stage===9){fs.writeFileSync(out+'/pixels-'+stage+'.json.gz',zlib.gzipSync(Buffer.from(JSON.stringify({width:s.width,height:s.height,pixels:s.pixels}))));await page.screenshot({path:out+'/stage-'+stage+'-composited.png'});require(root+'/tools/browser-transients.cjs').captureWhole(out,'stage-'+stage+'-desktop',display.env);
 const {PNG}=require(root+'/node_modules/pngjs'),composite=PNG.sync.read(fs.readFileSync(out+'/stage-'+stage+'-composited.png')),desktop=PNG.sync.read(fs.readFileSync(out+'/stage-'+stage+'-desktop.png')),frame=s.rows.find(w=>w.title==='Authored tab text settings'),g=await page.evaluate(()=>tabHost.renderer.canvas.getBoundingClientRect().toJSON());
 const surfaces=[];for(let side=0;side<2;++side){const sx=x+side*270,bytes=Buffer.alloc(w*h*4);for(let row=0;row<h;++row)pix.copy(bytes,row*w*4,((y+row)*s.width+sx)*4,((y+row)*s.width+sx+w)*4);surfaces.push({x:sx,y,w,h,bytes});}
 const match=(png,v,ox,oy)=>{const x=Math.round(ox+v.x),y=Math.round(oy+v.y);if(x<0||y<0||x+v.w>png.width||y+v.h>png.height)return false;for(let row=0;row<v.h;++row)if(!png.data.subarray(((y+row)*png.width+x)*4,((y+row)*png.width+x+v.w)*4).equals(v.bytes.subarray(row*v.w*4,(row+1)*v.w*4)))return false;return true;};
 assert(surfaces.every(v=>match(composite,v,g.x+frame.x,g.y+frame.y)));const first=surfaces[0],needle=first.bytes.subarray(10*w*4,11*w*4);let origin=null;for(let at=desktop.data.indexOf(needle);at>=0;at=desktop.data.indexOf(needle,at+1)){if(at%4)continue;const ox=at/4%desktop.width-first.x,oy=Math.floor(at/4/desktop.width)-first.y-10;if(surfaces.every(v=>match(desktop,v,ox,oy))){origin={x:ox,y:oy};break;}}assert(origin,'native desktop contains both exact tab surfaces');save('stage-'+stage+'-visible.json',{origin,exactCompositor:true,exactNativeDesktop:true,probes:s.probes,surfaces:surfaces.map(({bytes,...v})=>({...v,sha256:sha(bytes)}))});}
 delete s.pixels;states.push(s);save('states.json',states);
 }
 await sample(0,'initial','');
 for(let stage=1;stage<expected.length;++stage){await page.keyboard.press('n');await page.waitForFunction(stage=>Object.values(tabHost.renderer.windows).some(w=>w.title?.startsWith(stage+' ')),{timeout:5000},stage);await sample(stage,'update','n');}
 const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);const cpuState=await cpu.evaluate(()=>{const names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,registers:Object.fromEntries(names.map(n=>[n,instance.exports[n]()>>>0]))};});
 save('cpu-state.json',cpuState);assert.equal(cpuState.memoryBytes,536870912);assert.equal(Object.keys(cpuState.registers).length,19);assert(cpuState.registers.get_eip&&cpuState.registers.get_esp);
 await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));
 save('assertions.json',{expectOld,failures,states:states.length,productionBrowserCPU:true,referencePairsMatch:states.every(s=>s.pairs.every(p=>p.equal))});
 if(expectOld){assert(failures.some(v=>v.stage===1&&(v.got[1]!==v.want[1]||v.labels[1]!=='Sound')),'first supported SETITEMA oldFAIL required');console.log('PASS oldFAIL reproduced',failures.length);}else{assert.deepEqual(failures,[]);assert(states.every(s=>s.pairs.every(p=>p.equal)&&s.probes.every(p=>p.pass)));console.log('PASS TAB text A/W public queries and visible reference pairs',states.length);}
 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('transients.json',await transient.cleanup(out));if(display)await display.close();}
}
if(require.main===module)main(process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync(require('node:os').tmpdir()+'/tab-item-text-update-'),{expectOld:process.argv.includes('--expect-old')}).catch(e=>{console.error(e.stack);process.exitCode=1;});module.exports={fixture,main,expected};
