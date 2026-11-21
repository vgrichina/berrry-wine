'use strict';
// Public native tabs, ordinary horizontal text subset of the existing mirror.
// Microsoft contracts: tab-controls, tcm-insertitem, tcm-getitem,
// tcm-getcursel, tcm-setcursel, tcn-selchanging. Expectations precede edits.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const keys=[],expected=[0,2,1,1,0,0];
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
unsigned short API RegisterClassA(const void*);long API DefWindowProcA(P,U,U,long);int API SetWindowTextA(P,const char*);
long API SendMessageA(P,U,U,long);int API GetMessageA(P,P,U,U);int API TranslateMessage(P);long API DispatchMessageA(P);
int API ShowWindow(P,int);long API SetWindowLongA(P,int,long);long API CallWindowProcA(P,P,U,U,long);long API GetWindowLongA(P,int);
int API InitCommonControlsEx(P);
struct WC{U style;P proc;int cex,wex;P instance,icon,cursor,brush;const char* menu;const char* name;};
struct Item{U mask,state,smask;char* text;int length,image;long param;};struct Header{P hwnd;U id;int code;};
static P frame,tabs,status,pages[3],saved,inst;static int stage,ready,count,events[16][4],inserts[3],previous=-9,registered=-9,subclass=-9,empty,init;static char report[1000];
void number(int n,int* at){char d[12];int k=0;if(n<0){report[(*at)++]='-';n=-n;}do{d[k++]='0'+n%10;n/=10;}while(n);while(k)report[(*at)++]=d[--k];report[(*at)++]=' ';}
void page(int sel){for(int j=0;j<3;++j)ShowWindow(pages[j],j==sel?5:0);}
void publish(void){int at=0;char b[20]={0};struct Item it={1,0,0,b,20,0,0};int ok=SendMessageA(tabs,0x1305,1,(long)&it);number(stage,&at);number(init,&at);number(tabs!=0,&at);number(empty,&at);for(int j=0;j<3;++j)number(inserts[j],&at);number(SendMessageA(tabs,0x1304,0,0),&at);number(ok,&at);number(b[0]=='V'&&b[1]=='i'&&b[2]=='d'&&b[3]=='e'&&b[4]=='o'&&b[5]==0,&at);number(SendMessageA(tabs,0x130b,0,0),&at);number(previous,&at);number(count,&at);number(subclass,&at);number(registered,&at);for(int j=0;j<count;++j)for(int k=0;k<4;++k)number(events[j][k],&at);report[at]=0;SetWindowTextA(status,report);}
long __stdcall sub(P h,U m,U w,long l){if(m==0x1304)return 77;return CallWindowProcA(saved,h,m,w,l);}
long __stdcall custom(P h,U m,U w,long l){if(m==0x1304)return 91;return DefWindowProcA(h,m,w,l);}
long __stdcall proc(P h,U m,U w,long l){if(m==0x4e){struct Header* n=(struct Header*)l;if(n->hwnd==tabs&&(n->code==-552||n->code==-551)){int* e=events[count++];e[0]=n->code;e[1]=SendMessageA(tabs,0x130b,0,0);e[2]=n->hwnd==tabs;e[3]=n->id;if(n->code==-551)page(e[1]);return stage==3&&n->code==-552;}return 0;}
 if(m==0x111&&(w&65535)==20){ready=1;publish();return 0;}
 if(m==0x111&&(w&65535)==22){stage=1;previous=SendMessageA(tabs,0x130c,2,0);page(2);publish();return 0;}
 if(m==0x111&&(w&65535)==23){stage=3;publish();return 0;}
 if(m==0x111&&(w&65535)==24){stage=4;publish();return 0;}
 if(m==0x111&&(w&65535)==25){stage=5;saved=(P)SetWindowLongA(tabs,-4,(long)sub);subclass=SendMessageA(tabs,0x1304,0,0);SetWindowLongA(tabs,-4,(long)saved);struct WC wc={0,custom,0,0,0,0,0,(P)16,0,"SysTabControl32"};wc.instance=inst;RegisterClassA(&wc);P c=CreateWindowExA(0,"SysTabControl32","registered",0x40000000,300,40,20,20,frame,(P)50,inst,0);registered=SendMessageA(c,0x1304,0,0);publish();return 0;}
 return DefWindowProcA(h,m,w,l);}
void start(void){inst=GetModuleHandleA(0);U ic[2]={8,8};init=InitCommonControlsEx(ic);struct WC wc={0,proc,0,0,0,0,0,(P)16,0,"TabCreation"};wc.instance=inst;RegisterClassA(&wc);frame=CreateWindowExA(0,"TabCreation","Authored native tab creation",0x10cf0000,30,30,570,310,0,0,inst,0);tabs=CreateWindowExA(0,"SysTabControl32","",0x50010000,15,40,230,100,frame,(P)10,inst,0);empty=SendMessageA(tabs,0x130b,0,0);char* names[3]={"Audio","Video","Input"};for(int j=0;j<3;++j){struct Item it={1,0,0,names[j],0,0,0};inserts[j]=SendMessageA(tabs,0x1307,j,(long)&it);pages[j]=CreateWindowExA(0,"STATIC",names[j],0x40000000,20,70,210,60,frame,(P)(30+j),inst,0);}page(0);
 char* buttons[5]={"Ready","Program","Veto","Allow","Subclass"};int ids[5]={20,22,23,24,25};for(int j=0;j<5;++j)CreateWindowExA(0,"BUTTON",buttons[j],0x50010000,15+j*105,170,100,26,frame,(P)ids[j],inst,0);status=CreateWindowExA(0,"STATIC","starting",0x50000000,15,215,540,50,frame,(P)21,inst,0);
 U msg[12];while(GetMessageA(msg,0,0,0)>0){if(ready&&msg[1]==0x201&&msg[0]==(U)tabs&&stage==1)stage=2;TranslateMessage(msg);DispatchMessageA(msg);if(ready&&msg[1]==0x202)publish();}}
`;
async function unit(){
 const extraWat=String.raw`
 (func (export "u_lookup") (param $name i32) (result i32)
   (call $class_table_lookup (call $g2w (local.get $name))))
 (func (export "u_make") (result i32)
   (call $ctrl_create_child (i32.const 0) (i32.const 27) (i32.const 10)
     (i32.const 0) (i32.const 0) (i32.const 230) (i32.const 100)
     (i32.const 0) (i32.const 0)))
 (func (export "u_load") (param $template i32) (result i32)
   (call $wnd_table_set (i32.const 1000) (global.get $WNDPROC_DIALOG))
   (global.set $dlg_indirect_template_ptr (local.get $template))
   (drop (call $dlg_load (i32.const 1000) (i32.const 0)))
   (call $ctrl_find_by_id (i32.const 1000) (i32.const 10)))
 (func (export "u_kind") (param $hwnd i32) (result i32)
   (call $ctrl_table_get_class (local.get $hwnd)))
 (func (export "u_help_sentinel")
   (global.set $help_session_mode (i32.const 99)))
 (func (export "u_help_mode") (result i32) (global.get $help_session_mode))
 (func (export "u_internal") (param $hwnd i32)
   (global.set $help_topics_tab_hwnd (local.get $hwnd))
   (call $tab_native_mark_slot (call $wnd_table_find (local.get $hwnd)) (i32.const 1)))
 `;
 const {exports:e}=await require('./render-helper').bootRenderHarness({extraWat,fonts:'none'});
 const alloc=(text,wide=false)=>{const b=Buffer.from(text+'\0',wide?'utf16le':'latin1'),p=e.guest_alloc(b.length)>>>0;for(let i=0;i<b.length;i++)e.guest_write8(p+i,b[i]);return p;};
 for(const name of ['SysTabControl32','sYsTaBcOnTrOl32']){const p=alloc(name);assert.equal(e.test_class_name_to_ctrl_id(p),27);assert.equal(e.u_lookup(p)>>>0,0xffff011b);}
 for(const name of ['SysTabControl','SysTabControl3','SysTabControl32Extra','SysTabControl33','SysTabControl32 ']){const p=alloc(name);assert.equal(e.test_class_name_to_ctrl_id(p),0);assert.equal(e.u_lookup(p),0);}
 assert.equal(e.test_class_name_to_ctrl_id(alloc('SysTreeView32')),8);assert.equal(e.test_class_name_to_ctrl_id(alloc('SysListView32')),18);
 const msg=(h,m,w=0,l=0)=>e.send_message(h,m,w,l),item=e.guest_alloc(28)>>>0;
 const insert=(h,text,wide=false,index=99)=>{e.guest_write32(item,1);e.guest_write32(item+12,alloc(text,wide));return msg(h,wide?0x133e:0x1307,index,item);};
 const query=(h,index,capacity,wide=false)=>{const b=e.guest_alloc(40)>>>0;for(let i=0;i<40;i++)e.guest_write8(b+i,0xa5);e.guest_write32(item,1);e.guest_write32(item+12,b);e.guest_write32(item+16,capacity);const result=msg(h,wide?0x133c:0x1305,index,item);return {result,bytes:Buffer.from(Array.from({length:40},(_,i)=>e.guest_read8(b+i)))};};
 e.u_help_sentinel();const h=e.u_make();assert.equal(msg(h,0x130b),-1);assert.equal(insert(h,'Audio'),0);assert.equal(insert(h,'Video',true),1);assert.equal(msg(h,0x1304),2);assert.equal(msg(h,0x130b),0);
 let q=query(h,1,4);assert.equal(q.result,1);assert.equal(q.bytes.subarray(0,4).toString('latin1'),'Vid\0');assert.equal(q.bytes[4],0xa5);
 q=query(h,1,20,true);assert.equal(q.bytes.subarray(0,12).toString('utf16le'),'Video\0');assert.equal(q.bytes[12],0xa5);
 assert.equal(query(h,8,20).result,0);assert.equal(msg(h,0x130c,1),0);assert.equal(msg(h,0x130b),1);assert.equal(msg(h,0x130c,99),-1);assert.equal(msg(h,0x130b),1);
 for(let j=2;j<8;j++)assert.equal(insert(h,'Input'),j);assert.equal(insert(h,'Overflow'),-1);assert.equal(msg(h,0x1304),8);
 // Mouse outside the row cannot change the current tab or WinHelp globals.
 msg(h,0x201,1,(30<<16)|10);assert.equal(msg(h,0x130b),1);assert.equal(e.u_help_mode(),99);
 assert.equal(msg(h,0x1309),1);assert.equal(msg(h,0x1304),0);assert.equal(msg(h,0x130b),-1);
 // Resource DLGTEMPLATE named-class creation uses the same bounded fallback.
 const b=Buffer.alloc(128);b.writeUInt16LE(1,8);b.writeInt16LE(100,14);b.writeInt16LE(80,16);let at=24;b.writeUInt32LE(0x50000000,at);b.writeInt16LE(80,at+12);b.writeInt16LE(60,at+14);b.writeUInt16LE(10,at+16);at+=18;Buffer.from('SysTabControl32\0','utf16le').copy(b,at);at+=32;b.writeUInt16LE(0,at);b.writeUInt16LE(0,at+2);const p=e.guest_alloc(at+4)>>>0;for(let i=0;i<at+4;i++)e.guest_write8(p+i,b[i]);const child=e.u_load(p);assert(child);assert.equal(e.u_kind(child),27);assert.equal(insert(child,'Resource'),0);assert.equal(msg(child,0x1304),1);assert.equal(e.u_help_mode(),99);
 // Internal WinHelp retains its pre-dispatch mirror and original click route.
 const help=e.u_make();e.u_internal(help);assert.equal(insert(help,'Index'),0);assert.equal(msg(help,0x1304),1);msg(help,0x201,1,10);assert.equal(e.u_help_mode(),99);
 console.log('PASS tab classifier exact names, template creation, A/W queries/capacity, bounded mirror, independent controls and WinHelp state');
}
function fixture(out){
 fs.writeFileSync(out+'/fixture.c',source);
 for(const [dll,names]of Object.entries({comctl32:['InitCommonControlsEx@4'],kernel32:['GetModuleHandleA@4'],user32:['CreateWindowExA@48','RegisterClassA@4','DefWindowProcA@16','SetFocus@4','GetFocus@0','GetDlgCtrlID@4','SetWindowTextA@8','SendMessageA@16','GetMessageA@16','TranslateMessage@4','DispatchMessageA@4','IsDialogMessageA@8','ShowWindow@8','SetWindowLongA@12','CallWindowProcA@20','GetWindowLongA@8']})){
 fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/fixture.c','-o',out+'/fixture.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/tab-creation.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib',out+'/comctl32.lib']);return fs.readFileSync(out+'/tab-creation.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n'),pause=ms=>new Promise(r=>setTimeout(r,ms));
 const runtime=require(root+'/tools/boids-current-runtime.cjs'),commit=process.env.TAB_COMMIT||cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files=runtime.gitFiles(commit);
 if(process.env.TAB_WORKING_RUNTIME)for(const n of files.keys())if(fs.existsSync(root+'/'+n))files.set(n,fs.readFileSync(root+'/'+n));
 for(const n of ['src/09c0-window-table.wat','src/09c3-controls.wat','src/09c9-winhelp-ui.wat'])files.set(n,expectOld?cp.execFileSync('git',['show',commit+':'+n],{cwd:root}):fs.readFileSync(root+'/'+n));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{maxBuffer:8e6}));
 const wasm=process.env.TAB_WASM?fs.readFileSync(process.env.TAB_WASM):runtime.compile(files),pe=fixture(out);fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));files.set('build/wine-assembly.wasm',wasm);files.set('tab-creation.exe',pe);
 save('runtime.json',{commit,moduleSHA256:sha(wasm),peSHA256:sha(pe),keys,expected,files:[...files].map(([name,b])=>({name,size:b.length,sha256:sha(b)}))});
 const transient=require(root+'/tools/browser-transients.cjs').create(),logs=[],pending=[],workers=[],states=[],failures=[];let display,browser,wait,server;
 try{
 server=http.createServer((req,res)=>{const n=new URL(req.url,'http://local').pathname.slice(1)||'index.html',b=files.get(n);res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.html')?'text/html':n.endsWith('.css')?'text/css':n.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.statusCode=b?200:404;res.end(b||'missing');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 display=await require(root+'/tools/gltron-headful-display.cjs').start(out);
 browser=await require(root+'/node_modules/puppeteer').launch({headless:false,defaultViewport:{width:1050,height:800},env:transient.env(display.env),userDataDir:transient.profile,executablePath:'/opt/google/chrome/chrome',args:[...transient.args,'--no-sandbox','--disable-dev-shm-usage','--disable-component-update','--disable-background-networking'],protocolTimeout:45000});wait=transient.watch(browser.process());browser.process().stdout?.resume();browser.process().stderr?.resume();save('browser-version.json',{version:await browser.version()});
 const page=await browser.newPage();page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>logs.push(String(e)));
 page.on('workercreated',w=>{const row={url:w.url(),modules:[]};workers.push(row);const c=w.client;c.on('Debugger.scriptParsed',v=>{if(v.scriptLanguage==='WebAssembly'||v.url.startsWith('wasm://'))pending.push(c.send('Debugger.getScriptSource',{scriptId:v.scriptId}).then(r=>row.modules.push(sha(Buffer.from(r.bytecode,'base64')))));});pending.push(c.send('Debugger.enable'));});
 await page.evaluateOnNewDocument(()=>localStorage.setItem('wine-assembly.threads','1'));await page.goto('http://127.0.0.1:'+server.address().port+'/?debug&threads&no-log',{waitUntil:'domcontentloaded',timeout:60000});await page.waitForFunction(()=>typeof WineAssembly==='function');
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=650;c.style='position:fixed;left:0;top:0;z-index:99999;width:1000px;height:650px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.tabHost=new WineAssembly();tabHost.renderer=new Win98Renderer(c);await tabHost.init(c);if(!tabHost.guestWorker)throw Error('production Worker required');await tabHost.loadExe('/tab-creation.exe');tabHost.run();});
 await page.waitForFunction(()=>Object.values(tabHost.renderer.windows).some(w=>w.title==='Ready'),{timeout:15000});await page.evaluate(()=>{browserInput.wireCanvasInput(tabHost.renderer.canvas,tabHost.renderer,{runningApps:[{wine:tabHost}],debugMode:true});tabHost.renderer.canvas.focus();});
 await page.mouse.click(30+6+15+30,30+26+170+12);await page.waitForFunction(()=>Object.values(tabHost.renderer.windows).some(w=>/^0 /.test(w.title)),{timeout:15000});

 const controlBase=Number(/CONTROL_TABLE: \{[^}]*base: (0x[0-9a-fA-F_]+)/.exec(files.get('lib/region-map.generated.js').toString())[1].replaceAll('_',''));
 const notifications=[[],[],[[-552,2,1,10],[-551,1,1,10]],[[-552,2,1,10],[-551,1,1,10],[-552,1,1,10]],[[-552,2,1,10],[-551,1,1,10],[-552,1,1,10],[-552,1,1,10],[-551,0,1,10]],[[-552,2,1,10],[-551,1,1,10],[-552,1,1,10],[-552,1,1,10],[-551,0,1,10]]];
 async function sample(stage){await pause(200);const s=await page.evaluate(base=>{const h=tabHost,r=h.renderer,w=Object.values(r.windows).find(w=>w.title==='Authored native tab creation'),p=w._backCanvas._waCanonicalPresentation,v=new DataView(h.memory.buffer);let kind=null;for(let i=0;i<256;i++)if(v.getUint32(base+i*16+4,true)===10)kind=v.getUint32(base+i*16,true);return {kind,report:Object.values(r.windows).find(w=>w.isChild&&w.x===15&&w.y===215)?.title,memoryBytes:h.memory.buffer.byteLength,rows:Object.values(r.windows).map(v=>({hwnd:v.hwnd,title:v.title,x:v.x,y:v.y,w:v.w,h:v.h,visible:v.visible,isChild:v.isChild})),gdi:p?{sharedGuestStorage:p.surface.storage.buffer===h.memory.buffer,pixels:Array.from(p.surface.rgbaRect(0,0,w.w,w.h))}:null,pixels:Array.from(w._backCanvas.getContext('2d').getImageData(0,0,w.w,w.h).data),width:w.w,height:w.h};},controlBase);
 const got=s.report.trim().split(/\s+/).map(Number),want=[stage,1,1,-1,0,1,2,3,1,1,expected[stage],stage?0:-9,notifications[stage].length,stage===5?77:-9,stage===5?91:-9,...notifications[stage].flat()];s.stage=stage;s.actual=got;s.expected=want;s.publicPass=JSON.stringify(got)===JSON.stringify(want);if(!s.publicPass)failures.push({stage,got,want});
 const pix=Buffer.from(s.pixels),gdi=s.gdi&&Buffer.from(s.gdi.pixels);s.probes=[];for(let j=0;j<3;j++){const at=(64*s.width+19+j*41+15)*4,rgba=Array.from(pix.subarray(at,at+4)),want=j===expected[stage]?[255,255,255,255]:[192,192,192,255];s.probes.push({j,rgba,want,pass:JSON.stringify(rgba)===JSON.stringify(want)});}
 const x=19,y=64,w=230,h=100,bytes=Buffer.alloc(w*h*4);let gdiEqual=!!gdi;for(let row=0;row<h;++row){let at=((y+row)*s.width+x)*4;pix.copy(bytes,row*w*4,at,at+w*4);if(!gdi||!pix.subarray(at,at+w*4).equals(gdi.subarray(at,at+w*4)))gdiEqual=false;}s.gdiEqual=gdiEqual;s.page=s.rows.filter(r=>r.isChild&&r.x===20&&r.y===70).map(r=>({title:r.title,visible:r.visible}));
 if(stage===0||stage===2||stage===3){await page.screenshot({path:out+'/stage-'+stage+'-composited.png'});require(root+'/tools/browser-transients.cjs').captureWhole(out,'stage-'+stage+'-desktop',display.env);const {PNG}=require(root+'/node_modules/pngjs'),composite=PNG.sync.read(fs.readFileSync(out+'/stage-'+stage+'-composited.png')),desktop=PNG.sync.read(fs.readFileSync(out+'/stage-'+stage+'-desktop.png')),frame=s.rows.find(r=>r.title==='Authored native tab creation'),g=await page.evaluate(()=>tabHost.renderer.canvas.getBoundingClientRect().toJSON());
 const match=(png,ox,oy)=>{const sx=Math.round(ox+x),sy=Math.round(oy+y);if(sx<0||sy<0||sx+w>png.width||sy+h>png.height)return false;for(let row=0;row<h;row++)if(!png.data.subarray(((sy+row)*png.width+sx)*4,((sy+row)*png.width+sx+w)*4).equals(bytes.subarray(row*w*4,(row+1)*w*4)))return false;return true;};
 s.exactCompositor=match(composite,g.x+frame.x,g.y+frame.y);let origin=null;const needle=bytes.subarray(10*w*4,11*w*4);for(let at=desktop.data.indexOf(needle);at>=0;at=desktop.data.indexOf(needle,at+1)){if(at%4)continue;const ox=at/4%desktop.width-x,oy=Math.floor(at/4/desktop.width)-y-10;if(match(desktop,ox,oy)){origin={x:ox,y:oy};break;}}s.nativeOrigin=origin;fs.writeFileSync(out+'/stage-'+stage+'-surface.rgba.gz',zlib.gzipSync(bytes));}
 delete s.pixels;if(s.gdi)delete s.gdi.pixels;states.push(s);save('states.json',states);return s;}
 await sample(0);
 const clickButton=async(i,stage)=>{await page.mouse.click(30+6+15+i*105+30,30+26+170+12);await page.waitForFunction(stage=>Object.values(tabHost.renderer.windows).some(w=>w.title?.startsWith(stage+' ')),{timeout:5000},stage);};
 await clickButton(1,1);await sample(1);
 await page.mouse.click(30+6+15+55,30+26+40+10);await pause(150);await sample(2);
 await clickButton(2,3);await page.mouse.click(30+6+15+15,30+26+40+10);await sample(3);
 await clickButton(3,4);await page.mouse.click(30+6+15+15,30+26+40+10);await sample(4);
 await clickButton(4,5);await sample(5);
 const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);const cpuState=await cpu.evaluate(()=>{const names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,registers:Object.fromEntries(names.map(n=>[n,instance.exports[n]()>>>0]))};});
 save('cpu-state.json',cpuState);assert.equal(cpuState.memoryBytes,536870912);assert.equal(Object.keys(cpuState.registers).length,19);assert(cpuState.registers.get_eip&&cpuState.registers.get_esp);
 await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));
 save('assertions.json',{expectOld,failures,states:states.length,productionBrowserCPU:true});
 if(expectOld){assert(failures.some(v=>v.stage===0&&v.got[7]!==3),'public creation/count oldFAIL required');console.log('PASS public oldFAIL reproduced',failures.length);}else{assert.deepEqual(failures,[]);assert(states.every(s=>s.kind===27&&s.gdi?.sharedGuestStorage&&s.gdiEqual&&s.probes.every(p=>p.pass)));for(const s of states.filter(s=>s.exactCompositor!==undefined))assert(s.exactCompositor&&s.nativeOrigin);for(const s of states)assert.deepEqual(s.page,[{title:'Audio',visible:expected[s.stage]===0},{title:'Video',visible:expected[s.stage]===1},{title:'Input',visible:expected[s.stage]===2}]);console.log('PASS public native tab creation, queries, silent set, mouse notifications/veto, subclass and visible pages',states.length);}
 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('transients.json',await transient.cleanup(out));if(display)await display.close();}
}
if(require.main===module)(process.argv.includes('--unit')?unit():main(process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync(require('node:os').tmpdir()+'/native-tab-'),{expectOld:process.argv.includes('--expect-old')})).catch(e=>{console.error(e.stack);process.exitCode=1;});module.exports={fixture,main,unit,keys,expected};
