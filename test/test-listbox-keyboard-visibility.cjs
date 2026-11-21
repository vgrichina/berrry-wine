'use strict';
// Authored setup menu, ordinary USER calls and browser keyboard events. The
// reference contains four independently specified visible items, not a copy
// of the tested list's observed selection or scroll position.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const keys=['End','Home','PageDown','ArrowDown','ArrowUp','End','Home','PageDown','Tab','Shift+Tab','ArrowDown'];
const selections=[0,11,0,4,5,4,11,0,4,4,4,5],tops=[0,8,0,1,2,2,8,0,1,1,1,2];
const items=Array.from({length:12},(_,i)=>'Option '+String(i).padStart(2,'0'));
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
unsigned short API RegisterClassA(const void*);long API DefWindowProcA(P,U,U,long);
P API SetFocus(P);P API GetFocus(void);int API GetDlgCtrlID(P);int API SetWindowTextA(P,const char*);
long API SendMessageA(P,U,U,long);int API GetMessageA(P,P,U,U);int API TranslateMessage(P);long API DispatchMessageA(P);
int API IsDialogMessageA(P,P);U API SetTimer(P,U,U,P);int API KillTimer(P,U);
struct WC{U style;P proc;int cex,wex;P instance,icon,cursor,brush;const char* menu;const char* name;};
static P frame,list,reference,status;static int stage,notifications,ready;static char report[128];
static const char* items[12]=ITEMS;
static int selections[12]=SELECTIONS,tops[12]=TOPS;
void expected(void){int s=stage<12?stage:11;SendMessageA(reference,0x184,0,0);
 for(int j=0;j<4;++j)SendMessageA(reference,0x180,0,(long)items[tops[s]+j]);
 SendMessageA(reference,0x186,selections[s]-tops[s],0);}
void number(int n,int* at){if(n<0){report[(*at)++]='-';n=-n;}if(n>=10)report[(*at)++]='0'+n/10;report[(*at)++]='0'+n%10;report[(*at)++]=' ';}
void publish(void){int at=0;number(stage,&at);number(SendMessageA(list,0x188,0,0),&at);number(SendMessageA(list,0x18e,0,0),&at);number(notifications,&at);number(GetDlgCtrlID(GetFocus()),&at);number(SendMessageA(list,0x87,0,0),&at);report[at]=0;SetWindowTextA(status,report);}
long __stdcall proc(P h,U m,U w,long l){
 if(m==0x111&&(w&65535)==10&&(w>>16)==1){++notifications;return 0;}
 if(m==0x113&&!ready){ready=1;KillTimer(h,1);SetFocus(list);expected();publish();return 0;}
 return DefWindowProcA(h,m,w,l);}
void start(void){P i=GetModuleHandleA(0);struct WC wc={0,proc,0,0,0,0,0,(P)16,0,"ListMenu"};wc.instance=i;RegisterClassA(&wc);
 frame=CreateWindowExA(0,"ListMenu","Authored list keyboard menu",0x10cf0000,30,30,520,270,0,0,i,0);
 list=CreateWindowExA(0,"LISTBOX","",0x50010001,15,35,180,68,frame,(P)10,i,0);
 reference=CreateWindowExA(0,"LISTBOX","",0x50000000,260,35,180,68,frame,(P)11,i,0);
 CreateWindowExA(0,"BUTTON","Next",0x50030000,15,130,100,28,frame,(P)12,i,0);
 status=CreateWindowExA(0,"STATIC","starting",0x50000000,15,180,470,25,frame,(P)13,i,0);
 for(int j=0;j<12;++j)SendMessageA(list,0x180,0,(long)items[j]);SendMessageA(list,0x186,0,0);
 SetTimer(frame,1,1000,0);U msg[12];
 while(GetMessageA(msg,0,0,0)>0){int key=msg[1]==0x100&&msg[2]!=0x10;
  if(key){++stage;expected();}
  if(!DIALOG_FILTER||!IsDialogMessageA(frame,msg)){TranslateMessage(msg);DispatchMessageA(msg);}
  if(key)publish();}
}`;
function fixture(out,filter){
 fs.writeFileSync(out+'/fixture.c','#define DIALOG_FILTER '+Number(filter)+'\n#define ITEMS {'+items.map(JSON.stringify).join(',')+'}\n#define SELECTIONS {'+selections+'}\n#define TOPS {'+tops+'}\n'+source);
 for(const [dll,names]of Object.entries({kernel32:['GetModuleHandleA@4'],user32:['CreateWindowExA@48','RegisterClassA@4','DefWindowProcA@16','SetFocus@4','GetFocus@0','GetDlgCtrlID@4','SetWindowTextA@8','SendMessageA@16','GetMessageA@16','TranslateMessage@4','DispatchMessageA@4','IsDialogMessageA@8','SetTimer@16','KillTimer@8']})){
  fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);
 }
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/fixture.c','-o',out+'/fixture.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/list-menu.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib']);return fs.readFileSync(out+'/list-menu.exe');
}
async function main(out,{filter=true,expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n'),pause=ms=>new Promise(r=>setTimeout(r,ms));
 const runtime=require('../tools/boids-current-runtime.cjs'),commit=cp.execFileSync('git',['rev-parse',process.env.LISTBOX_COMMIT||'HEAD'],{cwd:root,encoding:'utf8'}).trim(),files=runtime.gitFiles(commit);
 // Use only when attesting the canonical build's recorded working inputs.
 if(process.env.LISTBOX_WORKING_RUNTIME)for(const n of files.keys())if(fs.existsSync(root+'/'+n))files.set(n,fs.readFileSync(root+'/'+n));
 if(!process.env.LISTBOX_BASELINE)files.set('src/09c3-wndprocs3-listbox.wat',fs.readFileSync(root+'/src/09c3-wndprocs3-listbox.wat'));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{cwd:root,maxBuffer:8e6}));
 const wasm=process.env.LISTBOX_WASM?fs.readFileSync(process.env.LISTBOX_WASM):runtime.compile(files),pe=fixture(out,filter);
 fs.writeFileSync(out+'/tested.wasm',wasm);files.set('build/wine-assembly.wasm',wasm);files.set('list-menu.exe',pe);
 save('runtime.json',{commit,moduleSHA256:sha(wasm),peSHA256:sha(pe),filter,keys,selections,tops,items,files:[...files].map(([name,b])=>({name,size:b.length,sha256:sha(b)}))});
 const transient=require('../tools/browser-transients.cjs').create(),logs=[],pending=[],workers=[],states=[];let display,browser,wait,server;
 try{
  server=http.createServer((req,res)=>{const n=new URL(req.url,'http://local').pathname.slice(1)||'index.html',b=files.get(n);res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.html')?'text/html':n.endsWith('.css')?'text/css':n.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.statusCode=b?200:404;res.end(b||'missing');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  display=await require('../tools/gltron-headful-display.cjs').start(out);
  browser=await require('puppeteer').launch({headless:false,defaultViewport:{width:1050,height:800},env:transient.env(display.env),userDataDir:transient.profile,executablePath:'/opt/google/chrome/chrome',args:[...transient.args,'--no-sandbox','--disable-dev-shm-usage','--disable-component-update','--disable-background-networking'],protocolTimeout:45000});
  wait=transient.watch(browser.process());browser.process().stdout?.resume();browser.process().stderr?.resume();save('browser-version.json',{version:await browser.version()});
  const page=await browser.newPage();page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>logs.push(String(e)));
  page.on('workercreated',w=>{const row={url:w.url(),modules:[]};workers.push(row);const c=w.client;c.on('Debugger.scriptParsed',v=>{if(v.scriptLanguage==='WebAssembly'||v.url.startsWith('wasm://'))pending.push(c.send('Debugger.getScriptSource',{scriptId:v.scriptId}).then(r=>row.modules.push(sha(Buffer.from(r.bytecode,'base64')))));});pending.push(c.send('Debugger.enable'));});
  await page.evaluateOnNewDocument(()=>localStorage.setItem('wine-assembly.threads','1'));
  await page.goto('http://127.0.0.1:'+server.address().port+'/?debug&threads&no-log');await page.waitForFunction(()=>typeof WineAssembly==='function');
  await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=650;c.style='position:fixed;left:0;top:0;z-index:99999;width:1000px;height:650px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.listHost=new WineAssembly();listHost.renderer=new Win98Renderer(c);await listHost.init(c);if(!listHost.guestWorker)throw Error('production Worker required');await listHost.loadExe('/list-menu.exe');listHost.run();});
  const status=()=>page.evaluate(()=>Object.values(listHost.renderer.windows).find(w=>w.controlId===13||w.title?.match(/^\d+ \d+ \d+ \d+ \d+ \d+ /))?.title);
  await page.waitForFunction(()=>Object.values(listHost.renderer.windows).some(w=>/^0 0 0 0 10 /.test(w.title)),{timeout:15000});
  await page.evaluate(()=>{browserInput.wireCanvasInput(listHost.renderer.canvas,listHost.renderer,{runningApps:[{wine:listHost}],debugMode:true});listHost.renderer.canvas.focus();});
  async function sample(stage){
   await pause(150);
   const s=await page.evaluate(()=>{const h=listHost,r=h.renderer,w=Object.values(r.windows).find(w=>w.title==='Authored list keyboard menu');
    const c=w._backCanvas,ctx=c.getContext('2d');
    const rows=Object.values(r.windows).map(v=>({hwnd:v.hwnd,title:v.title,x:v.x,y:v.y,w:v.w,h:v.h,isChild:v.isChild,parent:v.parent,controlId:v.controlId}));
    return {memoryBytes:h.memory.buffer.byteLength,rows,canvasSize:[c.width,c.height],left:Array.from(ctx.getImageData(21,61,172,64).data),right:Array.from(ctx.getImageData(266,61,172,64).data)};
   });s.stage=stage;s.publicReport=await status();
   s.equal=Buffer.from(s.left).equals(Buffer.from(s.right));
   // Literal system-blue/white row fills and contrasting glyphs make the
   // independent four-item reference a visible item oracle, not blank pixels.
   const selected=selections[stage]-tops[stage];
   s.referenceRows=Array.from({length:4},(_,row)=>{
    const at=(row*16*172+150)*4,bg=s.right.slice(at,at+4),isSelected=row===selected;
    assert.deepEqual(bg,isSelected?[0,0,128,255]:[255,255,255,255]);
    const ink=isSelected?[255,255,255]:[0,0,0];let glyphs=0;
    for(let y=0;y<16;y++)for(let x=0;x<80;x++){const i=((row*16+y)*172+x)*4;if(ink.every((v,j)=>s.right[i+j]===v))glyphs++;}
    assert(glyphs>5,'reference row must contain actual item glyphs');
    return {text:items[tops[stage]+row],selected:isSelected,background:bg,glyphPixels:glyphs};
   });
   // Retain exact lossless pixels separately, keeping JSON small.
   fs.writeFileSync(out+'/pixels-'+stage+'.rgba.gz',zlib.gzipSync(Buffer.concat([Buffer.from(s.left),Buffer.from(s.right)])));delete s.left;delete s.right;states.push(s);save('states.json',states);return s;
  }
  await sample(0);
  for(let i=0;i<keys.length;i++){
   if(keys[i]==='Shift+Tab'){await page.keyboard.down('Shift');await page.keyboard.press('Tab');await page.keyboard.up('Shift');}else await page.keyboard.press(keys[i]);
   await page.waitForFunction(stage=>Object.values(listHost.renderer.windows).some(w=>w.title?.startsWith(stage+' ')),{timeout:5000},i+1);
   await sample(i+1);
   if(i===3){await page.screenshot({path:out+'/arrow-composited.png'});require('../tools/browser-transients.cjs').captureWhole(out,'arrow-desktop',display.env);}
  }
  const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);
  const cpuState=await cpu.evaluate(()=>{const names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];globalThis.__listboxSnapshot=new Uint8Array(memory.buffer).slice();return {memoryBytes:__listboxSnapshot.length,registers:Object.fromEntries(names.map(n=>[n,instance.exports[n]()>>>0])),source:'actual production CPU Worker immutable full memory copy; streamed SHA256 on Node'};});
  const memoryHash=crypto.createHash('sha256');
  for(let offset=0;offset<cpuState.memoryBytes;offset+=4194304){
   const chunk=await cpu.evaluate(offset=>{const b=__listboxSnapshot.subarray(offset,offset+4194304);let s='';for(let i=0;i<b.length;i+=32768)s+=String.fromCharCode(...b.subarray(i,i+32768));return btoa(s);},offset);
   memoryHash.update(Buffer.from(chunk,'base64'));
  }
  cpuState.allMemorySHA256=memoryHash.digest('hex');await cpu.evaluate(()=>{delete globalThis.__listboxSnapshot;});
  save('cpu-state.json',cpuState);assert.equal(cpuState.memoryBytes,536870912);assert.equal(Object.keys(cpuState.registers).length,19);assert(cpuState.registers.get_eip&&cpuState.registers.get_esp);
  await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));
  const {PNG}=require('pngjs'),composite=PNG.sync.read(await page.screenshot({path:out+'/composited.png'}));
  const geometry=await page.evaluate(()=>listHost.renderer.canvas.getBoundingClientRect().toJSON());
  const last=states.at(-1),frame=last.rows.find(w=>w.title==='Authored list keyboard menu'),pixels=zlib.gunzipSync(fs.readFileSync(out+'/pixels-'+last.stage+'.rgba.gz'));
  const left=pixels.subarray(0,172*64*4),right=pixels.subarray(172*64*4);
  const matches=(png,p,x,y)=>{if(x<0||y<0||x+172>png.width||y+64>png.height)return false;for(let row=0;row<64;row++)if(!png.data.subarray(((y+row)*png.width+x)*4,((y+row)*png.width+x+172)*4).equals(p.subarray(row*172*4,(row+1)*172*4)))return false;return true;};
  assert(matches(composite,left,geometry.x+frame.x+21,geometry.y+frame.y+61),'composited browser contains actual LISTBOX pixels');
  assert(matches(composite,right,geometry.x+frame.x+266,geometry.y+frame.y+61),'composited browser contains independent reference');
  require('../tools/browser-transients.cjs').captureWhole(out,'desktop',display.env);
  const desktop=PNG.sync.read(fs.readFileSync(out+'/desktop.png'));let origin=null;
  const scan=Buffer.from(left.subarray(0,172*4));for(let i=desktop.data.indexOf(scan);i>=0;i=desktop.data.indexOf(scan,i+1)){if(i%4)continue;const x=(i/4)%desktop.width,y=Math.floor(i/4/desktop.width);if(matches(desktop,left,x,y)&&matches(desktop,right,x+245,y)){origin={x:x-frame.x-21,y:y-frame.y-61};break;}}
  assert(origin,'native desktop contains both actual and expected item surfaces');save('native-visible.json',{origin,leftSurface:true,independentReferenceSurface:true,width:172,height:64});
  const failures=[];
  for(const s of states){const v=s.publicReport.trim().split(' ').map(Number),i=s.stage,expectedFocus=filter&&i===9?12:10,expectedNotifications=i<=8?i:i<=10?8:9;
   if(v[1]!==selections[i]||v[2]!==tops[i]||v[3]!==expectedNotifications||v[4]!==expectedFocus||!s.equal)failures.push({stage:i,actual:v,expected:[i,selections[i],tops[i],expectedNotifications,expectedFocus],pixelsEqual:s.equal});
  }
  save('assertions.json',{filter,expectOld,failures,states:states.length,productionBrowserCPU:true});
  if(expectOld){assert(failures.some(v=>v.stage===4),'dialog arrow must reproduce selection/visible failure');console.log('PASS oldFAIL reproduced',failures);}else {assert.deepEqual(failures,[]);console.log('PASS LISTBOX keyboard selection and visible items');}
 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('transients.json',await transient.cleanup(out));if(display)await display.close();}
}
if(require.main===module)main(path.resolve(process.argv[2]),{filter:!process.argv.includes('--plain'),expectOld:process.argv.includes('--expect-old')}).catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={fixture,main,keys,selections,tops,items};
