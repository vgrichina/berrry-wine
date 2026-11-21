'use strict';
// Initialized report-mode LVS_SINGLESEL: unmodified Up/Down/Home/End.
// Microsoft: list-view-item-states, lvn-itemchanging, lvn-itemchanged, lvn-keydown,
// wm-getdlgcode, guidelines-for-keyboard-user-interface-design (April 2002).
// Notification ordering across different items is not a Windows contract.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const keys=['ArrowDown','ArrowDown','ArrowUp','Home','ArrowUp','End','ArrowDown','p','ArrowUp','Home','Tab'];
const expected=[2,3,3,2,0,0,11,11,3,6,0,0],focused=[2,3,3,2,0,0,11,11,7,6,0,0],tops=[0,0,0,0,0,0,6,6,6,6,0,0];
// Per-item CHANGING precedes its mutation, CHANGED follows it; cross-item
// ordering is intentionally not asserted as an undocumented Windows contract.
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
unsigned short API RegisterClassA(const void*);long API DefWindowProcA(P,U,U,long);P API SetFocus(P);P API GetFocus(void);int API GetDlgCtrlID(P);int API SetWindowTextA(P,const char*);
long API SendMessageA(P,U,U,long);int API GetMessageA(P,P,U,U);int API TranslateMessage(P);long API DispatchMessageA(P);int API IsDialogMessageA(P,P);
struct WC{U style;P proc;int cex,wex;P instance,icon,cursor,brush;const char* menu;const char* name;};
struct Item{U mask;int item,sub;U state,smask;char* text;int length,image;long param;};
struct Column{U mask;int fmt,width;char* text;int len,sub;};
struct Header{P hwnd;U id;int code;};
struct Notice{struct Header hdr;int item,sub;U next,old,changed;int x,y;long param;};
static P frame,list,ref,status;static int stage,ready,count,other,events[64][11],target,handled,inputmsg;static char report[10000];
static int topRows[12]={0,0,0,0,0,0,6,6,6,6,0,0};
static int selections[12]={2,3,3,2,0,0,11,11,3,6,0,0},focuses[12]={2,3,3,2,0,0,11,11,7,6,0,0};
void state(P h,int row,int value,int mask){struct Item it={0,0,0,value,mask,0,0,0,0};SendMessageA(h,0x102b,row,(long)&it);}
void configure(P h,int sel,int focus){state(h,-1,0,3);state(h,sel,2,2);state(h,focus,1,1);SendMessageA(h,0x1013,focus,0);}
void number(int n,int* at){char digits[12];int k=0;if(n<0){report[(*at)++]='-';n=-n;}do{digits[k++]='0'+n%10;n/=10;}while(n);while(k)report[(*at)++]=digits[--k];report[(*at)++]=' ';}
void publish(void){int at=0;number(stage,&at);number(GetDlgCtrlID(GetFocus()),&at);number(SendMessageA(list,0x100c,-1,2),&at);number(SendMessageA(list,0x100c,-1,1),&at);number(SendMessageA(list,0x87,0,0),&at);number(SendMessageA(list,0x1027,0,0),&at);number(SendMessageA(list,0x1032,0,0),&at);number(count,&at);number(other,&at);number(target,&at);number(handled,&at);number(inputmsg,&at);for(int j=0;j<12;++j)number(SendMessageA(list,0x102c,j,3),&at);for(int j=0;j<count;++j)for(int k=0;k<11;++k)number(events[j][k],&at);report[at]=0;SetWindowTextA(status,report);}
long __stdcall proc(P h,U m,U w,long l){
 if(m==0x4e){struct Header* n=(struct Header*)l;if(!ready||n->hwnd!=list)return 0;if(n->code==-100||n->code==-101){struct Notice* v=(struct Notice*)l;int* e=events[count++];e[0]=n->code;e[1]=v->item;e[2]=v->old;e[3]=v->next;e[4]=v->changed;e[5]=SendMessageA(list,0x102c,v->item,3);e[6]=SendMessageA(list,0x100c,-1,2);e[7]=SendMessageA(list,0x100c,-1,1);e[8]=n->id;e[9]=GetDlgCtrlID(GetFocus());e[10]=stage;return stage==2&&n->code==-100;}if(n->code==-155){unsigned char* b=(unsigned char*)l;int key=stage==1||stage==2||stage==7?40:stage==3||stage==5||stage==9?38:stage==6?35:36;other+=b[12]==key&&b[13]==0&&b[14]==0&&b[15]==0&&b[16]==0&&b[17]==0&&!count?1:100;return 1;}return 0;}
 if(m==0x111&&(w&65535)==20){SetFocus(list);ready=1;publish();return 0;}return DefWindowProcA(h,m,w,l);}
void start(void){P i=GetModuleHandleA(0);struct WC wc={0,proc,0,0,0,0,0,(P)16,0,"ListMenu"};wc.instance=i;RegisterClassA(&wc);
 frame=CreateWindowExA(0,"ListMenu","Authored listview keyboard settings",0x10cf0000,30,30,570,280,0,0,i,0);
 list=CreateWindowExA(0,"SysListView32","",0x5001000d,15,40,230,120,frame,(P)10,i,0);
 ref=CreateWindowExA(0,"SysListView32","",0x5000000d,285,40,230,120,frame,(P)30,i,0);
 struct Column col={6,0,200,"Settings",0,0};SendMessageA(list,0x101b,0,(long)&col);SendMessageA(ref,0x101b,0,(long)&col);
 char* names[12]={"Audio","Video","Input","Music","Effects","Gamma","Shadows","Textures","Resolution","Renderer","Browser","Network"};for(int j=0;j<12;++j){struct Item it={1,j,0,0,0,names[j],0,0,0};SendMessageA(list,0x1007,0,(long)&it);SendMessageA(ref,0x1007,0,(long)&it);}configure(list,2,2);configure(ref,2,2);
 CreateWindowExA(0,"BUTTON","Ready",0x50010000,15,170,100,26,frame,(P)20,i,0);status=CreateWindowExA(0,"STATIC","starting",0x50000000,15,215,540,24,frame,(P)21,i,0);
 U msg[12];while(GetMessageA(msg,0,0,0)>0){if(ready&&msg[1]==0x100){++stage;count=other=0;configure(ref,selections[stage],focuses[stage]);SendMessageA(ref,0x1014,0,(topRows[stage]-SendMessageA(ref,0x1027,0,0))*16);if(stage==8){ready=0;configure(list,3,7);ready=1;}}if(ready&&(msg[1]==0x100||msg[1]==0x101))target=GetDlgCtrlID((P)msg[0]);
 handled=IsDialogMessageA(frame,msg);if(!handled){TranslateMessage(msg);DispatchMessageA(msg);}if(ready&&(msg[1]==0x100||msg[1]==0x101)){inputmsg=msg[1];publish();}}
}
`;
function fixture(out){
 fs.writeFileSync(out+'/fixture.c',source);
 for(const [dll,names]of Object.entries({kernel32:['GetModuleHandleA@4'],user32:['CreateWindowExA@48','RegisterClassA@4','DefWindowProcA@16','SetFocus@4','GetFocus@0','GetDlgCtrlID@4','SetWindowTextA@8','SendMessageA@16','GetMessageA@16','TranslateMessage@4','DispatchMessageA@4','IsDialogMessageA@8']})){
 fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/fixture.c','-o',out+'/fixture.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/listview-menu.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib']);return fs.readFileSync(out+'/listview-menu.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n'),pause=ms=>new Promise(r=>setTimeout(r,ms));
 const runtime=require(root+'/tools/boids-current-runtime.cjs'),commit=process.env.LISTVIEW_COMMIT||cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files=runtime.gitFiles(commit);
 if(process.env.LISTVIEW_WORKING_RUNTIME)for(const n of files.keys())if(fs.existsSync(root+'/'+n))files.set(n,fs.readFileSync(root+'/'+n));
 for(const n of ['src/09c3-wndprocs.wat'])files.set(n,expectOld?cp.execFileSync('git',['show',commit+':'+n],{cwd:root}):fs.readFileSync(root+'/'+n));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{maxBuffer:8e6}));
 const wasm=process.env.LISTVIEW_WASM?fs.readFileSync(process.env.LISTVIEW_WASM):runtime.compile(files),pe=fixture(out);fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));files.set('build/wine-assembly.wasm',wasm);files.set('listview-menu.exe',pe);
 save('runtime.json',{commit,moduleSHA256:sha(wasm),peSHA256:sha(pe),keys,expected,files:[...files].map(([name,b])=>({name,size:b.length,sha256:sha(b)}))});
 const transient=require(root+'/tools/browser-transients.cjs').create(),logs=[],pending=[],workers=[],states=[],failures=[];let display,browser,wait,server;
 try{
 server=http.createServer((req,res)=>{const n=new URL(req.url,'http://local').pathname.slice(1)||'index.html',b=files.get(n);res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.html')?'text/html':n.endsWith('.css')?'text/css':n.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.statusCode=b?200:404;res.end(b||'missing');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 display=await require(root+'/tools/gltron-headful-display.cjs').start(out);
 browser=await require(root+'/node_modules/puppeteer').launch({headless:false,defaultViewport:{width:1050,height:800},env:transient.env(display.env),userDataDir:transient.profile,executablePath:'/opt/google/chrome/chrome',args:[...transient.args,'--no-sandbox','--disable-dev-shm-usage','--disable-component-update','--disable-background-networking'],protocolTimeout:45000});wait=transient.watch(browser.process());browser.process().stdout?.resume();browser.process().stderr?.resume();save('browser-version.json',{version:await browser.version()});
 const page=await browser.newPage();page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>logs.push(String(e)));
 page.on('workercreated',w=>{const row={url:w.url(),modules:[]};workers.push(row);const c=w.client;c.on('Debugger.scriptParsed',v=>{if(v.scriptLanguage==='WebAssembly'||v.url.startsWith('wasm://'))pending.push(c.send('Debugger.getScriptSource',{scriptId:v.scriptId}).then(r=>row.modules.push(sha(Buffer.from(r.bytecode,'base64')))));});pending.push(c.send('Debugger.enable'));});
 await page.evaluateOnNewDocument(()=>localStorage.setItem('wine-assembly.threads','1'));await page.goto('http://127.0.0.1:'+server.address().port+'/?debug&threads&no-log');await page.waitForFunction(()=>typeof WineAssembly==='function');
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=650;c.style='position:fixed;left:0;top:0;z-index:99999;width:1000px;height:650px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.listviewHost=new WineAssembly();listviewHost.renderer=new Win98Renderer(c);await listviewHost.init(c);if(!listviewHost.guestWorker)throw Error('production Worker required');await listviewHost.loadExe('/listview-menu.exe');listviewHost.run();});
 await page.waitForFunction(()=>Object.values(listviewHost.renderer.windows).some(w=>w.title==='Ready'),{timeout:15000});await page.evaluate(()=>{browserInput.wireCanvasInput(listviewHost.renderer.canvas,listviewHost.renderer,{runningApps:[{wine:listviewHost}],debugMode:true});listviewHost.renderer.canvas.focus();});
 await page.mouse.click(30+6+15+30,30+26+170+12);await page.waitForFunction(()=>Object.values(listviewHost.renderer.windows).some(w=>/^0 10 2 2 /.test(w.title)),{timeout:15000});


 async function sample(stage,phase,key){await pause(110);const s=await page.evaluate(()=>{const h=listviewHost,r=h.renderer,w=Object.values(r.windows).find(w=>w.title==='Authored listview keyboard settings'),p=w._backCanvas._waCanonicalPresentation;return {report:Object.values(r.windows).find(w=>w.isChild&&w.x===15&&w.y===215)?.title,memoryBytes:h.memory.buffer.byteLength,rows:Object.values(r.windows).map(v=>({hwnd:v.hwnd,title:v.title,x:v.x,y:v.y,w:v.w,h:v.h,visible:v.visible,isChild:v.isChild})),gdi:p?{bpp:p.surface.bpp,stride:p.surface.stride,bitsWa:p.bitsWa,sharedGuestStorage:p.surface.storage.buffer===h.memory.buffer,pixels:Array.from(p.surface.rgbaRect(0,0,w.w,w.h))}:null,pixels:Array.from(w._backCanvas.getContext('2d').getImageData(0,0,w.w,w.h).data),width:w.w,height:w.h};});
 const controlBase=Number(/CONTROL_TABLE: \{[^}]*base: (0x[0-9a-fA-F_]+)/.exec(files.get('lib/region-map.generated.js').toString())[1].replaceAll('_',''));
 s.nativeControls=await page.evaluate(base=>{const v=new DataView(listviewHost.memory.buffer),rows=[];for(let i=0;i<256;++i){const a=base+i*16;if(v.getUint32(a+4,true)===10||v.getUint32(a+4,true)===30)rows.push({class:v.getUint32(a,true),id:v.getUint32(a+4,true)});}return rows;},controlBase);assert.deepEqual(s.nativeControls,[{class:18,id:10},{class:18,id:30}]);
 const got=s.report.trim().split(/\s+/).map(Number),vk={ArrowDown:40,ArrowUp:38,Home:36,End:35};
 const want=[stage,stage===11?20:10,expected[stage],focused[stage],1,tops[stage],1];
 const rows=Array.from({length:12},(_,j)=>(j===expected[stage]?2:0)|(j===focused[stage]?1:0));
 const events=Array.from({length:got[7]},(_,j)=>got.slice(24+j*11,35+j*11));
 const eventPass=events.every(e=>e.length===11&&e[4]===8&&e[8]===10&&e[9]===10&&e[10]===stage&&(e[0]===-100?e[5]===e[2]:e[0]===-101&&e[5]===e[3]));
 const prev=stage?expected[stage-1]:2,prevFocus=stage?focused[stage-1]:2,changed=stage&&stage!==8&&(prev!==expected[stage]||prevFocus!==focused[stage]);
 const count=stage===2?1:changed?(stage===9?6:4):0;
 const paired=events.filter(e=>e[0]===-101).every(e=>events.some((v,i)=>i<events.indexOf(e)&&v[0]===-100&&v[1]===e[1]&&v[2]===e[2]&&v[3]===e[3]));
 const notificationPass=eventPass&&paired&&events.length===count&&(stage===2?events[0]?.[0]===-100&&events[0]?.[1]===4:events.filter(e=>e[0]===-100).length===count/2&&events.filter(e=>e[0]===-101).length===count/2);
 const routePass=got[9]===(phase==='initial'?0:phase==='up'&&stage===11?20:10)&&got[10]===(phase==='down'&&key==='Tab'?1:0)&&got[11]===(phase==='initial'?0:phase==='down'?256:257);
 s.stage=stage;s.phase=phase;s.key=key;s.expected=want;s.actual=got;s.events=events;s.publicPass=want.every((v,i)=>got[i]===v)&&rows.every((v,i)=>got[12+i]===v)&&notificationPass&&routePass&&got[8]===(vk[key]?1:0);if(!s.publicPass)failures.push({stage,phase,key,got,want,rows,notificationPass,routePass});
 assert(s.gdi?.sharedGuestStorage,'canonical GDI must use actual guest memory');
 const pix=Buffer.from(s.pixels),x=19,y=64,w=230,h=120;let equal=true;for(let row=0;row<h;++row)if(!pix.subarray(((y+row)*s.width+x)*4,((y+row)*s.width+x+w)*4).equals(pix.subarray(((y+row)*s.width+x+270)*4,((y+row)*s.width+x+270+w)*4)))equal=false;s.pairs=[{equal}];const gd=Buffer.from(s.gdi.pixels);for(let side=0;side<2;++side)for(let row=0;row<h;++row){const at=((y+row)*s.width+x+side*270)*4;assert(pix.subarray(at,at+w*4).equals(gd.subarray(at,at+w*4)),'GDI memory and backingcanvas agree');}s.gdi.sha256=sha(gd);delete s.gdi.pixels;
 s.probes=[];for(let j=0;j<6;++j){const px=x+180,py=y+20+j*16+8,rgba=Array.from(pix.subarray((py*s.width+px)*4,(py*s.width+px)*4+4)),expectedRGBA=j+tops[stage]===expected[stage]?[0,0,128,255]:[255,255,255,255];s.probes.push({j,rgba,expectedRGBA,pass:rgba.every((v,i)=>v===expectedRGBA[i])});}
 if(phase==='up'&&(stage===1||stage===2||stage===6)){fs.writeFileSync(out+'/pixels-'+stage+'.json.gz',zlib.gzipSync(Buffer.from(JSON.stringify({width:s.width,height:s.height,pixels:s.pixels}))));await page.screenshot({path:out+'/stage-'+stage+'-composited.png'});require(root+'/tools/browser-transients.cjs').captureWhole(out,'stage-'+stage+'-desktop',display.env);
 const {PNG}=require(root+'/node_modules/pngjs'),composite=PNG.sync.read(fs.readFileSync(out+'/stage-'+stage+'-composited.png')),desktop=PNG.sync.read(fs.readFileSync(out+'/stage-'+stage+'-desktop.png')),frame=s.rows.find(w=>w.title==='Authored listview keyboard settings'),g=await page.evaluate(()=>listviewHost.renderer.canvas.getBoundingClientRect().toJSON());
 const surfaces=[];for(let side=0;side<2;++side){const sx=x+side*270,bytes=Buffer.alloc(w*h*4);for(let row=0;row<h;++row)pix.copy(bytes,row*w*4,((y+row)*s.width+sx)*4,((y+row)*s.width+sx+w)*4);surfaces.push({x:sx,y,w,h,bytes});}
 const match=(png,v,ox,oy)=>{const x=Math.round(ox+v.x),y=Math.round(oy+v.y);if(x<0||y<0||x+v.w>png.width||y+v.h>png.height)return false;for(let row=0;row<v.h;++row)if(!png.data.subarray(((y+row)*png.width+x)*4,((y+row)*png.width+x+v.w)*4).equals(v.bytes.subarray(row*v.w*4,(row+1)*v.w*4)))return false;return true;};
 assert(surfaces.every(v=>match(composite,v,g.x+frame.x,g.y+frame.y)));const first=surfaces[0],needle=first.bytes.subarray(10*w*4,11*w*4);let origin=null;for(let at=desktop.data.indexOf(needle);at>=0;at=desktop.data.indexOf(needle,at+1)){if(at%4)continue;const ox=at/4%desktop.width-first.x,oy=Math.floor(at/4/desktop.width)-first.y-10;if(surfaces.every(v=>match(desktop,v,ox,oy))){origin={x:ox,y:oy};break;}}assert(origin,'native desktop contains both exact tab surfaces');save('stage-'+stage+'-visible.json',{origin,exactCompositor:true,exactNativeDesktop:true,probes:s.probes,surfaces:surfaces.map(({bytes,...v})=>({...v,sha256:sha(bytes)}))});}
 delete s.pixels;states.push(s);save('states.json',states);
 }
 await sample(0,'initial','');
 for(let i=0;i<keys.length;++i){const k=keys[i];await page.keyboard.down(k);await page.waitForFunction(stage=>Object.values(listviewHost.renderer.windows).some(w=>w.title?.startsWith(stage+' ')&&w.title.trim().split(/\s+/)[11]==='256'),{timeout:5000},i+1);await sample(i+1,'down',k);await page.keyboard.up(k);await page.waitForFunction(stage=>Object.values(listviewHost.renderer.windows).some(w=>w.title?.startsWith(stage+' ')&&w.title.trim().split(/\s+/)[11]==='257'),{timeout:5000},i+1);await sample(i+1,'up',k);}
 const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);const cpuState=await cpu.evaluate(()=>{const names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,registers:Object.fromEntries(names.map(n=>[n,instance.exports[n]()>>>0]))};});
 save('cpu-state.json',cpuState);assert.equal(cpuState.memoryBytes,536870912);assert.equal(Object.keys(cpuState.registers).length,19);assert(cpuState.registers.get_eip&&cpuState.registers.get_esp);
 await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));
 save('assertions.json',{expectOld,failures,states:states.length,productionBrowserCPU:true,referencePairsMatch:states.every(s=>s.pairs.every(p=>p.equal))});
 if(expectOld){assert(failures.some(v=>v.stage===1&&v.got[2]!==v.want[2]),'first supported arrow oldFAIL required');console.log('PASS oldFAIL reproduced',failures.length);}else{assert.deepEqual(failures,[]);assert(states.every(s=>s.pairs.every(p=>p.equal)&&s.probes.every(p=>p.pass)));console.log('PASS listview keyboard selection/focus/veto and native pixel oracles',states.length);}
 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('transients.json',await transient.cleanup(out));if(display)await display.close();}
}
if(require.main===module)main(process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync(require('node:os').tmpdir()+'/listview-key-'),{expectOld:process.argv.includes('--expect-old')}).catch(e=>{console.error(e.stack);process.exitCode=1;});module.exports={fixture,main,keys,expected};
