'use strict';
// Authored setup menu, ordinary USER calls and browser keyboard events. The
// reference contains four independently specified visible items, not a copy
// of the tested list's observed selection or scroll position.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const keys=['ArrowDown','ArrowUp','F4','ArrowDown','ArrowDown','ArrowUp','F4','Tab','Shift+Tab','ArrowDown','F4','ArrowUp','F4'];
const selections=[0,1,0,0,1,2,1,1,1,1,2,2,1,1],dropped=[0,0,0,1,1,1,1,0,0,0,0,1,1,0];
const changes=[0,1,2,2,3,4,5,5,5,5,6,6,7,7];
const items=['Option 00','Option 01','Option 02','Option 03'];
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
unsigned short API RegisterClassA(const void*);long API DefWindowProcA(P,U,U,long);
P API SetFocus(P);P API GetFocus(void);int API GetDlgCtrlID(P);int API SetWindowTextA(P,const char*);
long API SendMessageA(P,U,U,long);int API GetMessageA(P,P,U,U);int API TranslateMessage(P);long API DispatchMessageA(P);
int API IsDialogMessageA(P,P);U API SetTimer(P,U,U,P);int API KillTimer(P,U);
struct WC{U style;P proc;int cex,wex;P instance,icon,cursor,brush;const char* menu;const char* name;};
static P frame,list,reference,status,field;static int stage,ready,counts[11],target,before,handled;static char report[160],text[32];
static const char* items[4]=ITEMS;
static int selections[14]=SELECTIONS;
void expected(void){int s=stage<14?stage:13;SendMessageA(reference,0x186,selections[s],0);SendMessageA(field,0x14e,selections[s],0);}
void number(int n,int* at){char digits[12];int k=0;if(n<0){report[(*at)++]='-';n=-n;}do{digits[k++]='0'+n%10;n/=10;}while(n);while(k)report[(*at)++]=digits[--k];report[(*at)++]=' ';}
void publish(void){int at=0;number(stage,&at);number(SendMessageA(list,0x147,0,0),&at);number(SendMessageA(list,0x157,0,0),&at);number(counts[1],&at);number(GetDlgCtrlID(GetFocus()),&at);number(SendMessageA(list,0x87,0,0),&at);
number(counts[7],&at);number(counts[8],&at);number(counts[9],&at);number(counts[10],&at);number(counts[3],&at);number(counts[4],&at);
SendMessageA(list,0xd,32,(long)text);for(int j=0;text[j]&&j<31;++j)report[at++]=text[j];report[at++]='|';number(target,&at);number(before,&at);number(handled,&at);report[at]=0;SetWindowTextA(status,report);}
long __stdcall proc(P h,U m,U w,long l){
 if(m==0x111&&(w&65535)==10){int n=w>>16;if(n<11)++counts[n];if(ready)publish();return 0;}
 if(m==0x111&&(w&65535)==12&&!ready){for(int j=0;j<11;++j)counts[j]=0;SetFocus(list);ready=1;expected();publish();return 0;}
 return DefWindowProcA(h,m,w,l);}
void start(void){P i=GetModuleHandleA(0);struct WC wc={0,proc,0,0,0,0,0,(P)16,0,"ComboMenu"};wc.instance=i;RegisterClassA(&wc);
 frame=CreateWindowExA(0,"ComboMenu","Authored combo keyboard menu",0x10cf0000,30,30,540,300,0,0,i,0);
 list=CreateWindowExA(0,"COMBOBOX","",0x50010003,15,35,180,89,frame,(P)10,i,0);
 field=CreateWindowExA(0,"COMBOBOX","",0x50000003,260,35,180,89,frame,(P)11,i,0);
 reference=CreateWindowExA(0,"LISTBOX","",0x50000000,260,56,180,68,frame,(P)14,i,0);
 CreateWindowExA(0,"BUTTON","Next",0x50030000,15,150,100,28,frame,(P)12,i,0);
 status=CreateWindowExA(0,"STATIC","starting",0x50000000,15,210,510,25,frame,(P)13,i,0);
 for(int j=0;j<4;++j){SendMessageA(list,0x143,0,(long)items[j]);SendMessageA(field,0x143,0,(long)items[j]);SendMessageA(reference,0x180,0,(long)items[j]);}SendMessageA(list,0x14e,0,0);
 U msg[12];
 while(GetMessageA(msg,0,0,0)>0){int key=msg[1]==0x100&&msg[2]!=0x10;
  if(key){++stage;expected();}
  if(key){target=GetDlgCtrlID((P)msg[0]);before=GetDlgCtrlID(GetFocus());}handled=DIALOG_FILTER?IsDialogMessageA(frame,msg):0;
  if(!handled){TranslateMessage(msg);DispatchMessageA(msg);}
  if(key)publish();}
}`;
function fixture(out,filter){
 fs.writeFileSync(out+'/fixture.c','#define DIALOG_FILTER '+Number(filter)+'\n#define ITEMS {'+items.map(JSON.stringify).join(',')+'}\n#define SELECTIONS {'+selections+'}\n'+source);
 for(const [dll,names]of Object.entries({kernel32:['GetModuleHandleA@4'],user32:['CreateWindowExA@48','RegisterClassA@4','DefWindowProcA@16','SetFocus@4','GetFocus@0','GetDlgCtrlID@4','SetWindowTextA@8','SendMessageA@16','GetMessageA@16','TranslateMessage@4','DispatchMessageA@4','IsDialogMessageA@8','SetTimer@16','KillTimer@8']})){
  fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib']);
 }
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-c',out+'/fixture.c','-o',out+'/fixture.obj']);
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/combo-menu.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib']);return fs.readFileSync(out+'/combo-menu.exe');
}
async function main(out,{filter=true,expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n'),pause=ms=>new Promise(r=>setTimeout(r,ms));
 const runtime=require('../tools/boids-current-runtime.cjs'),commit=cp.execFileSync('git',['rev-parse',process.env.COMBO_DIALOG_COMMIT||'HEAD'],{cwd:root,encoding:'utf8'}).trim(),files=runtime.gitFiles(commit);
 // Use only when attesting the canonical build's recorded working inputs.
 if(process.env.COMBO_DIALOG_WORKING_RUNTIME)for(const n of files.keys())if(fs.existsSync(root+'/'+n))files.set(n,fs.readFileSync(root+'/'+n));
 if(!process.env.COMBO_DIALOG_BASELINE)files.set('src/09c3-wndprocs4-combobox.wat',fs.readFileSync(root+'/src/09c3-wndprocs4-combobox.wat'));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{cwd:root,maxBuffer:8e6}));
 const wasm=process.env.COMBO_DIALOG_WASM?fs.readFileSync(process.env.COMBO_DIALOG_WASM):runtime.compile(files),pe=fixture(out,filter);
 fs.writeFileSync(out+'/tested.wasm',wasm);files.set('build/wine-assembly.wasm',wasm);files.set('combo-menu.exe',pe);
 save('runtime.json',{commit,moduleSHA256:sha(wasm),peSHA256:sha(pe),filter,keys,selections,dropped,changes,items,files:[...files].map(([name,b])=>({name,size:b.length,sha256:sha(b)}))});
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
  await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=650;c.style='position:fixed;left:0;top:0;z-index:99999;width:1000px;height:650px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.listHost=new WineAssembly();listHost.renderer=new Win98Renderer(c);await listHost.init(c);if(!listHost.guestWorker)throw Error('production Worker required');await listHost.loadExe('/combo-menu.exe');listHost.run();});
  const status=()=>page.evaluate(()=>Object.values(listHost.renderer.windows).find(w=>w.isChild&&w.x===15&&w.y===210)?.title);
  await page.waitForFunction(()=>Object.values(listHost.renderer.windows).some(w=>w.title==='Next'),{timeout:15000});
  await page.evaluate(()=>{browserInput.wireCanvasInput(listHost.renderer.canvas,listHost.renderer,{runningApps:[{wine:listHost}],debugMode:true});listHost.renderer.canvas.focus();});
  // Enter through the authored menu's ordinary button, then let its guest
  // callback select the combo. Record the page shadow separately from public
  // CPU focus: a zero shadow can seed a popup list on its next browser key.
  await page.mouse.click(30+6+15+30,30+26+150+12);
  await page.waitForFunction(()=>Object.values(listHost.renderer.windows).some(w=>/^0 0 0 0 10 /.test(w.title)),{timeout:15000});
  async function sample(stage){
   await pause(150);
   const s=await page.evaluate(()=>{const h=listHost,r=h.renderer,w=Object.values(r.windows).find(w=>w.title==='Authored combo keyboard menu');
    const ctx=w._backCanvas.getContext('2d'),popup=Object.values(r.windows).find(v=>v.isPopup&&v.visible);
    const rows=Object.values(r.windows).map(v=>({hwnd:v.hwnd,title:v.title,x:v.x,y:v.y,w:v.w,h:v.h,isChild:v.isChild,parent:v.parent,controlId:v.controlId,visible:v.visible,isPopup:v.isPopup}));
    return {memoryBytes:h.memory.buffer.byteLength,shadowFocus:h.instance.exports.get_focus_hwnd()>>>0,rows,left:Array.from(ctx.getImageData(25,63,150,17).data),right:Array.from(ctx.getImageData(270,63,150,17).data),
      list:popup?Array.from(popup._backCanvas.getContext('2d').getImageData(4,4,172,64).data):null,
      reference:Array.from(ctx.getImageData(268,84,172,64).data)};
   });s.stage=stage;s.publicReport=await status();s.fieldEqual=Buffer.from(s.left).equals(Buffer.from(s.right));
   s.listEqual=s.list?Buffer.from(s.list).equals(Buffer.from(s.reference)):null;
   s.referenceRows=Array.from({length:4},(_,row)=>{
    const at=(row*16*172+150)*4,bg=s.reference.slice(at,at+4),isSelected=row===selections[stage];
    assert.deepEqual(bg,isSelected?[0,0,128,255]:[255,255,255,255]);
    const ink=isSelected?[255,255,255]:[0,0,0];let glyphs=0;
    for(let y=0;y<16;y++)for(let x=0;x<80;x++){const i=((row*16+y)*172+x)*4;if(ink.every((v,j)=>s.reference[i+j]===v))glyphs++;}
    assert(glyphs>5,'independent item must contain glyph pixels');return {text:items[row],selected:isSelected,background:bg,glyphPixels:glyphs};
   });
   fs.writeFileSync(out+'/pixels-'+stage+'.json.gz',zlib.gzipSync(Buffer.from(JSON.stringify({field:s.left,expectedField:s.right,list:s.list,reference:s.reference}))));
   delete s.left;delete s.right;delete s.list;delete s.reference;states.push(s);save('states.json',states);return s;
  }
  await sample(0);
  async function capture(stage,name){
   const {PNG}=require('pngjs'),s=states[stage],pixels=JSON.parse(zlib.gunzipSync(fs.readFileSync(out+'/pixels-'+stage+'.json.gz')));
   const composite=PNG.sync.read(await page.screenshot({path:out+'/'+name+'-composited.png'}));
   require('../tools/browser-transients.cjs').captureWhole(out,name+'-desktop',display.env);
   const desktop=PNG.sync.read(fs.readFileSync(out+'/'+name+'-desktop.png'));
   const frame=s.rows.find(w=>w.title==='Authored combo keyboard menu'),popup=s.rows.find(w=>w.isPopup&&w.visible);
   const g=await page.evaluate(()=>listHost.renderer.canvas.getBoundingClientRect().toJSON());
   const match=(png,bytes,x,y,w,h)=>{x=Math.round(x);y=Math.round(y);if(x<0||y<0||x+w>png.width||y+h>png.height)return false;
    const b=Buffer.from(bytes);for(let row=0;row<h;row++)if(!png.data.subarray(((y+row)*png.width+x)*4,((y+row)*png.width+x+w)*4).equals(b.subarray(row*w*4,(row+1)*w*4)))return false;return true;};
   const surfaces=[{bytes:pixels.field,x:frame.x+25,y:frame.y+63,w:150,h:17},{bytes:pixels.expectedField,x:frame.x+270,y:frame.y+63,w:150,h:17}];
   if(popup)surfaces.push({bytes:pixels.list,x:popup.x+4,y:popup.y+4,w:172,h:64});
   for(const v of surfaces)assert(match(composite,v.bytes,g.x+v.x,g.y+v.y,v.w,v.h),'browser compositor contains exact observed surfaces');
   // Find the native desktop's browser origin from a glyph-bearing row, then
   // require every independently positioned surface at that single origin.
   const first=surfaces[0],needle=Buffer.from(first.bytes.slice(5*150*4,6*150*4));let origin=null;
   for(let at=desktop.data.indexOf(needle);at>=0;at=desktop.data.indexOf(needle,at+1)){
    if(at%4)continue;const x=(at/4)%desktop.width-first.x,y=Math.floor(at/4/desktop.width)-5-first.y;
    if(surfaces.every(v=>match(desktop,v.bytes,x+v.x,y+v.y,v.w,v.h))){origin={x,y};break;}
   }
   assert(origin,'whole native desktop contains exact field/reference and any open dropdown');
   save(name+'-visible.json',{stage,origin,surfaces:surfaces.map(({bytes,...v})=>v),exactCompositor:true,exactNativeDesktop:true});
  }
  for(let i=0;i<keys.length;i++){
   if(keys[i]==='Shift+Tab'){await page.keyboard.down('Shift');await page.keyboard.press('Tab');await page.keyboard.up('Shift');}else await page.keyboard.press(keys[i]);
   await page.waitForFunction(stage=>Object.values(listHost.renderer.windows).some(w=>w.title?.startsWith(stage+' ')),{timeout:5000},i+1);
   await sample(i+1);
   if(i===0||i===3)await capture(i+1,i===0?'closed-arrow':'open-arrow');
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
  await page.screenshot({path:out+'/composited.png'});require('../tools/browser-transients.cjs').captureWhole(out,'desktop',display.env);
  const failures=[];
  for(const s of states){const v=s.publicReport.split('|')[0].trim().split(' '),i=s.stage,n=v.slice(0,12).map(Number),focus=i===8?12:10;
   const expected=[i,selections[i],dropped[i],changes[i],focus,129,i>=11?2:i>=3?1:0,i>=13?2:i>=7?1:0,i>=13?2:i>=7?1:0,0,i>=9?2:1,i>=8?1:0];
   // The pre-fix control's zero dialog code is reported, not used to drive expected behavior.
   if(n.some((x,j)=>x!==expected[j])||v.slice(12).join(' ')!==items[selections[i]]||!s.fieldEqual||(dropped[i]&&!s.listEqual))
    failures.push({stage:i,actual:n,expected,text:v.slice(12).join(' '),fieldEqual:s.fieldEqual,listEqual:s.listEqual});
  }
  save('assertions.json',{filter,expectOld,failures,states:states.length,productionBrowserCPU:true});
  if(expectOld){assert(failures.some(v=>v.stage===1&&v.actual[1]!==v.expected[1]&&v.actual[4]!==v.expected[4]),'dialog arrow must reproduce public selection/focus failure');console.log('PASS oldFAIL reproduced',failures);}else {assert.deepEqual(failures,[]);console.log('PASS COMBOBOX dialog keyboard selection and visible items');}
 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('transients.json',await transient.cleanup(out));if(display)await display.close();}
}
if(require.main===module)main(path.resolve(process.argv[2]),{filter:!process.argv.includes('--plain'),expectOld:process.argv.includes('--expect-old')}).catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={fixture,main,keys,selections,dropped,changes,items};

