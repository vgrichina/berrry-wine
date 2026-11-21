'use strict';
// Microsoft TCITEMA/W: TCIF_PARAM independently selects the opaque LPARAM.
// https://learn.microsoft.com/en-us/windows/win32/api/commctrl/ns-commctrl-tcitema
// https://learn.microsoft.com/en-us/windows/win32/api/commctrl/ns-commctrl-tcitemw
// https://learn.microsoft.com/en-us/windows/win32/controls/tcm-insertitem
// https://learn.microsoft.com/en-us/windows/win32/controls/tcm-setitem
// https://learn.microsoft.com/en-us/windows/win32/controls/tcm-getitem
// Native short ASCII subset; no oracle for unknown mask bits or Windows pixels.
// Public message results and independent constant states, full output buffers,
// masked fields, structure canaries, literal frame pixels and four paint planes.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const selections=[1,1,1,1,1,1,1,1,1,2,3,1,1,2,2,2,2,2,-1,0,0,0,-1,0,0,0,0,0,0,0],results=[0,1,1,1,1,0,0,0,0,1,2,1,1,0,1,0,7,-1,1,0,1,1,1,0,1,7,3,0,-1,-1],expected=[["Audio","Video","","MIDI"],["Audio","Video","","MIDI"],["Audio","Video","","MIDI"],["Sound","Video","","MIDI"],["Sound","Video2","","MIDI"],["Sound","Video2","","MIDI"],["Sound","Video2","","MIDI"],["Sound","Video2","","MIDI"],["Sound","Video2","","MIDI"],["Sound","","Video2","","MIDI"],["Sound","","Game","Video2","","MIDI"],["Sound","Game","Video2","","MIDI"],["Sound","Video2","","MIDI"],["","Sound","Video2","","MIDI"],["","Sound","Video2","","MIDI"],["","Sound","Video2","","MIDI"],["","Sound","Video2","","MIDI","","",""],["","Sound","Video2","","MIDI","","",""],[],[""],["",""],["Fresh",""],[],["Clean"],["Clean"],["","","","","","","",""],["","","","End","","","",""],["Clean"],["Clean"],["Clean"]],parameters=[[0,4294967295,2147483648,4275878552],[4294967173,4294967295,2147483648,4275878552],[4294967173,2166572391,2147483648,4275878552],[4294967173,2166572391,2147483648,4275878552],[4294967173,0,2147483648,4275878552],[4294967173,0,2147483648,4275878552],[4294967173,0,2147483648,4275878552],[4294967173,0,2147483648,4275878552],[4294967173,0,2147483648,4275878552],[4294967173,2271560481,0,2147483648,4275878552],[4294967173,2271560481,4294967289,0,2147483648,4275878552],[4294967173,4294967289,0,2147483648,4275878552],[4294967173,0,2147483648,4275878552],[2147483649,4294967173,0,2147483648,4275878552],[2147483649,4294967173,0,2147483648,4294967295],[2147483649,4294967173,0,2147483648,4294967295],[2147483649,4294967173,0,2147483648,4294967295,0,0,0],[2147483649,4294967173,0,2147483648,4294967295,0,0,0],[],[0],[0,4294967289],[4045620583,4294967289],[],[0],[4294967295],[0,4294967295,2147483648,4275878552,0,4294967289,2271560481,42],[0,4294967295,2147483648,4275878552,0,4294967289,2271560481,42],[0],[0],[0]];
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);
unsigned short API RegisterClassA(const void*);long API DefWindowProcA(P,U,U,long);P API SetFocus(P);P API GetFocus(void);int API GetDlgCtrlID(P);int API SetWindowTextA(P,const char*);long API SetWindowLongA(P,int,long);
int API DestroyWindow(P);
long API SendMessageA(P,U,U,long);int API GetMessageA(P,P,U,U);int API TranslateMessage(P);long API DispatchMessageA(P);int API InitCommonControlsEx(P);
struct WC{U style;P proc;int cex,wex;P instance,icon,cursor,brush;const char* menu;const char* name;};
struct Item{U mask,state,smask;char* text;int length,image;long param;};
static P frame,tabs,ref,status,outA,outW,instance;static int stage,ready,notifications,result,inputGuard=1;static char report[3500];
static char* labels[30][8]={{"Audio","Video","","MIDI",0,0,0,0},{"Audio","Video","","MIDI",0,0,0,0},{"Audio","Video","","MIDI",0,0,0,0},{"Sound","Video","","MIDI",0,0,0,0},{"Sound","Video2","","MIDI",0,0,0,0},{"Sound","Video2","","MIDI",0,0,0,0},{"Sound","Video2","","MIDI",0,0,0,0},{"Sound","Video2","","MIDI",0,0,0,0},{"Sound","Video2","","MIDI",0,0,0,0},{"Sound","","Video2","","MIDI",0,0,0},{"Sound","","Game","Video2","","MIDI",0,0},{"Sound","Game","Video2","","MIDI",0,0,0},{"Sound","Video2","","MIDI",0,0,0,0},{"","Sound","Video2","","MIDI",0,0,0},{"","Sound","Video2","","MIDI",0,0,0},{"","Sound","Video2","","MIDI",0,0,0},{"","Sound","Video2","","MIDI","","",""},{"","Sound","Video2","","MIDI","","",""},{0,0,0,0,0,0,0,0},{"",0,0,0,0,0,0,0},{"","",0,0,0,0,0,0},{"Fresh","",0,0,0,0,0,0},{0,0,0,0,0,0,0,0},{"Clean",0,0,0,0,0,0,0},{"Clean",0,0,0,0,0,0,0},{"","","","","","","",""},{"","","","End","","","",""},{"Clean",0,0,0,0,0,0,0},{"Clean",0,0,0,0,0,0,0},{"Clean",0,0,0,0,0,0,0}};
static int counts[30]={4,4,4,4,4,4,4,4,4,5,6,5,4,5,5,5,8,8,0,1,2,2,0,1,1,8,8,1,1,1},selections[30]={1,1,1,1,1,1,1,1,1,2,3,1,1,2,2,2,2,2,-1,0,0,0,-1,0,0,0,0,0,0,0};
int same(void* a,void* b,int n){for(int k=0;k<n;++k)if(((unsigned char*)a)[k]!=((unsigned char*)b)[k])return 0;return 1;}
void number(int n,int* at){char d[12];int k=0;if(n<0){report[(*at)++]='-';n=-n;}do{d[k++]='0'+n%10;n/=10;}while(n);while(k)report[(*at)++]=d[--k];report[(*at)++]=' ';}
void hex(U v,int* at){char* h="0123456789abcdef";for(int j=7;j>=0;--j)report[(*at)++]=h[(v>>(j*4))&15];}
long item(P h,int msg,int index,int mask,char* text,U param){struct {U pre;struct Item it;U post;} a={0x13579bdf,{mask,0x12345678,0x87654321,text,-999,0x12345678,param},0x2468ace0},saved=a;long r=SendMessageA(h,msg,index,(long)&a.it);inputGuard=inputGuard&&same(&a,&saved,sizeof(a));return r;}
void add(P h,int j,char* s){item(h,0x1307,j,1,s,0x76543210);}
void reference(void){SendMessageA(ref,0x1309,0,0);for(int j=0;j<counts[stage];++j)add(ref,j,labels[stage][j]);SendMessageA(ref,0x130c,selections[stage],0);}
P create(void){return CreateWindowExA(0,"SysTabControl32","",0x50010000,15,40,230,100,frame,(P)10,instance,0);}
void recreate(void){DestroyWindow(tabs);for(int j=0;j<40;++j){tabs=create();item(tabs,0x1307,0,9,"Temp",0xdeadbeef);DestroyWindow(tabs);}tabs=create();SetFocus(tabs);}
void publish(void){int at=0,guard=inputGuard,returns=0;unsigned char buffers[16][44];U values[16];int count=SendMessageA(tabs,0x1304,0,0);
 for(int wide=0;wide<2;++wide)for(int j=0;j<count;++j){unsigned char* b=buffers[wide*count+j];for(int k=0;k<44;++k)b[k]=0xa5;
  struct {U pre;struct Item it;U post;} a={0x13579bdf,{9,0x12345678,0x87654321,(char*)(b+2),20,0x12345678,0x76543210},0x2468ace0},saved=a;
  returns+=SendMessageA(tabs,wide?0x133c:0x1305,j,(long)&a.it);values[wide*count+j]=a.it.param;saved.it.param=a.it.param;guard=guard&&same(&a,&saved,sizeof(a));
  unsigned char second[44];for(int k=0;k<44;++k)second[k]=0xa5;
  a.it.mask=1;a.it.text=(char*)(second+2);a.it.param=0x76543210;saved=a;returns+=SendMessageA(tabs,wide?0x133c:0x1305,j,(long)&a.it);guard=guard&&same(&a,&saved,sizeof(a))&&same(b,second,44);
  a.it.mask=8;a.it.text=(char*)-1;a.it.length=-1;a.it.param=0x76543210;saved=a;returns+=SendMessageA(tabs,wide?0x133c:0x1305,j,(long)&a.it);saved.it.param=a.it.param;guard=guard&&same(&a,&saved,sizeof(a))&&a.it.param==values[wide*count+j];
 }
 struct {U pre;struct Item it;U post;} bad={0x13579bdf,{9,0x12345678,0x87654321,(char*)-1,20,0x12345678,0x76543210},0x2468ace0},saved=bad;int invalid=SendMessageA(tabs,0x1305,count,(long)&bad.it)+SendMessageA(tabs,0x133c,-1,(long)&bad.it);guard=guard&&same(&bad,&saved,sizeof(bad));
 number(stage,&at);number(result,&at);number(count,&at);number(SendMessageA(tabs,0x130b,0,0),&at);number(SendMessageA(tabs,0x132f,0,0),&at);number(GetDlgCtrlID(GetFocus()),&at);number(notifications,&at);number(returns,&at);number(guard,&at);number(invalid,&at);report[at++]='|';for(int j=0;j<2*count;++j){hex(values[j],&at);report[at++]='|';}report[at]=0;SetWindowTextA(status,report);char* h="0123456789abcdef";for(int wide=0;wide<2;++wide){at=0;for(int j=0;j<count;++j)for(int k=0;k<44;++k){unsigned char v=buffers[wide*count+j][k];report[at++]=h[v>>4];report[at++]=h[v&15];}report[at]=0;SetWindowTextA(wide?outW:outA,report);}}
void operate(void){unsigned short video[]={ 'V','i','d','e','o','2',0},game[]={'G','a','m','e',0},nonascii[]={0x100,0},longtext[]={'A','B','C','D','E','F','G','H','I','J','K','L','M','N','O',0};
 switch(stage){
 case 0:result=SendMessageA(tabs,0x130c,1,0);break;
 case 1:result=item(tabs,0x1306,0,8,(char*)-1,-123);break;
 case 2:result=item(tabs,0x133d,1,8,(char*)-1,0x81234567);break;
 case 3:result=item(tabs,0x1306,0,1,"Sound",0x11111111);break;
 case 4:result=item(tabs,0x133d,1,9,(char*)video,0);break;
 case 5:result=item(tabs,0x1306,0,9,"ABCDEFGHIJKLMNO",99);break;
 case 6:result=item(tabs,0x133d,1,9,(char*)nonascii,99);break;
 case 7:result=item(tabs,0x1306,0,9,0,99);break;
 case 8:result=item(tabs,0x133d,1,9,(char*)-1,99);break;
 case 9:result=item(tabs,0x1307,1,8,(char*)-1,0x87654321);break;
 case 10:result=item(tabs,0x133e,2,9,(char*)game,-7);game[0]='X';break;
 case 11:result=SendMessageA(tabs,0x1308,1,0);SendMessageA(tabs,0x130c,1,0);break;
 case 12:result=SendMessageA(tabs,0x1308,1,0);break;
 case 13:result=item(tabs,0x133e,0,8,(char*)-1,0x80000001);break;
 case 14:result=item(tabs,0x133d,4,8,(char*)-1,-1);break;
 case 15:result=item(tabs,0x1306,5,9,(char*)-1,99)+item(tabs,0x133d,-1,8,(char*)-1,99);break;
 case 16:for(int j=5;j<8;++j)result=item(tabs,j&1?0x133e:0x1307,j,1,(char*)(unsigned short[]){0},0xdeadbeef);break;
 case 17:result=item(tabs,0x1307,3,9,"Full",99);break;
 case 18:result=SendMessageA(tabs,0x1309,0,0);break;
 case 19:result=item(tabs,0x1307,0,8,(char*)-1,0);break;
 case 20:result=item(tabs,0x133e,1,8,(char*)-1,-7);break;
 case 21:result=item(tabs,0x1306,0,9,"Fresh",0xf1234567);break;
 case 22:recreate();result=1;break;
 case 23:result=item(tabs,0x1307,0,1,"Clean",0xdeadbeef);break;
 case 24:result=item(tabs,0x133d,0,8,(char*)-1,-1);break;
 case 25:{U p[8]={0,-1,0x80000000,0xfedcba98,0,-7,0x87654321,42};SendMessageA(tabs,0x1309,0,0);for(int j=0;j<8;++j)result=item(tabs,j&1?0x133e:0x1307,j,8,(char*)-1,p[j]);break;}
 case 26:SendMessageA(tabs,0x1308,3,0);result=item(tabs,0x133e,3,9,(char*)(unsigned short[]){'E','n','d',0},0xfedcba98);break;
 case 27:recreate();result=item(tabs,0x133e,0,1,(char*)(unsigned short[]){'C','l','e','a','n',0},0xdeadbeef);break;
 case 28:result=item(tabs,0x1307,0,9,"ABCDEFGHIJKLMNO",99);break;
 case 29:result=item(tabs,0x133e,0,9,(char*)longtext,99);break;
 }reference();publish();}
void advance(void){++stage;operate();}
long __stdcall proc(P h,U m,U w,long l){if(m==0x4e){++notifications;return 0;}if(m==0x111&&(w&65535)==20){SetFocus(tabs);ready=1;operate();return 0;}return DefWindowProcA(h,m,w,l);}
void start(void){U ic[2]={8,8};InitCommonControlsEx(ic);P i=GetModuleHandleA(0);instance=i;struct WC wc={0,proc,0,0,0,0,0,(P)16,0,"TabMenu"};wc.instance=i;RegisterClassA(&wc);frame=CreateWindowExA(0,"TabMenu","Authored tab userdata settings",0x10cf0000,30,30,570,280,0,0,i,0);
 tabs=CreateWindowExA(0,"SysTabControl32","",0x50010000,15,40,230,100,frame,(P)10,i,0);ref=CreateWindowExA(0,"SysTabControl32","",0x50000000,285,40,230,100,frame,(P)30,i,0);
 for(int j=0;j<4;++j){unsigned short wide[20]={0};for(int k=0;labels[0][j][k];++k)wide[k]=labels[0][j][k];U p[4]={0,-1,0x80000000,0xfedcba98};item(tabs,j&1?0x133e:0x1307,j,9,j&1?(char*)wide:labels[0][j],p[j]);}reference();CreateWindowExA(0,"BUTTON","Ready",0x50010000,15,170,100,26,frame,(P)20,i,0);status=CreateWindowExA(0,"STATIC","starting",0x50000000,15,215,540,24,frame,(P)21,i,0);
 outA=CreateWindowExA(0,"STATIC","",0x40000000,16,215,1,1,frame,(P)22,i,0);outW=CreateWindowExA(0,"STATIC","",0x40000000,17,215,1,1,frame,(P)23,i,0);
 U msg[12];while(GetMessageA(msg,0,0,0)>0){if(ready&&msg[1]==0x100&&msg[2]=='N'&&stage<29)advance();TranslateMessage(msg);DispatchMessageA(msg);}}
`;
function fixture(out){
 fs.writeFileSync(out+'/fixture.c',source);
 for(const [dll,names]of Object.entries({comctl32:['InitCommonControlsEx@4'],kernel32:['GetModuleHandleA@4'],user32:['CreateWindowExA@48','RegisterClassA@4','DefWindowProcA@16','DestroyWindow@4','SetFocus@4','GetFocus@0','GetDlgCtrlID@4','SetWindowTextA@8','SetWindowLongA@12','SendMessageA@16','GetMessageA@16','TranslateMessage@4','DispatchMessageA@4']})){
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
 const region=n=>Number(new RegExp(n+': [{][^}]*base: (0x[0-9a-fA-F_]+)').exec(files.get('lib/region-map.generated.js').toString())[1].replaceAll('_',''));
 const stateBase=region('TAB_NATIVE_STATE_TABLE'),guestBase=region('GUEST_BASE');
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
 await page.mouse.click(30+6+15+30,30+26+170+12);await page.waitForFunction(()=>Object.values(tabHost.renderer.windows).some(w=>/^0 0 4 1 1 10 /.test(w.title)),{timeout:15000});

 async function sample(stage,phase,key){await pause(110);const s=await page.evaluate(({base,stateBase,guestBase})=>{const h=tabHost,r=h.renderer,w=Object.values(r.windows).find(w=>w.title==='Authored tab userdata settings');const v=new DataView(h.memory.buffer);let kind=null;for(let i=0;i<256;i++)if(v.getUint32(base+i*16+4,true)===10)kind=v.getUint32(base+i*16,true);const allocations=[];for(let j=0;j<32;++j){const hwnd=v.getUint32(stateBase+j*8,true),ptr=v.getUint32(stateBase+j*8+4,true);if(hwnd){const address=ptr-h.instance.exports.get_image_base()+guestBase;allocations.push({hwnd,ptr,bytes:(v.getUint32(address-4,true)&~7)-4,tail:Array.from({length:8},(_,k)=>v.getUint32(address+128+k*4,true))});}}const p=w._backCanvas._waCanonicalPresentation;return {kind,allocations,gdi:p?{shared:p.surface.storage.buffer===h.memory.buffer,pixels:Array.from(p.surface.rgbaRect(0,0,w.w,w.h))}:null,report:(()=>{const find=x=>Object.values(r.windows).find(w=>w.isChild&&w.x===x&&w.y===215)?.title||'';const p=find(15).split('|');return p[0]+'|'+find(16)+find(17)+'|'+p.slice(1).join('|');})(),memoryBytes:h.memory.buffer.byteLength,rows:Object.values(r.windows).map(v=>({hwnd:v.hwnd,title:v.title,x:v.x,y:v.y,w:v.w,h:v.h,visible:v.visible,isChild:v.isChild})),pixels:Array.from(w._backCanvas.getContext('2d').getImageData(0,0,w.w,w.h).data),width:w.w,height:w.h};},{base:controlBase,stateBase,guestBase});assert.equal(s.kind,27,"public SysTabControl32 must route to native class27");
 const parts=s.report.split('|'),got=parts[0].trim().split(/\s+/).map(Number),want=[stage,results[stage],expected[stage].length,selections[stage],selections[stage],10,0,expected[stage].length*6,1,0];
 assert.equal(s.allocations.length,2,'recreation releases the table slot');if(!expectOld)for(const a of s.allocations)assert(a.bytes>=160,'native allocation covers all eight values');s.stage=stage;s.phase=phase;s.expected={numbers:want,labels:expected[stage]};;const buffers=[];for(let wide=0;wide<2;++wide)for(const label of expected[stage]){const b=Buffer.alloc(44,0xa5);Buffer.from(label+'\0',wide?'utf16le':'ascii').copy(b,2);buffers.push(b);}s.expected.outputHex=Buffer.concat(buffers).toString('hex');
 s.actual={numbers:got,outputHex:parts[1],parameters:parts.slice(2,-1)};s.publicPass=got.length===want.length&&want.every((v,i)=>got[i]===v)&&parts[1]===s.expected.outputHex&&parts.slice(2,-1).length===expected[stage].length*2&&parts.slice(2,-1).every((v,i)=>v===parameters[stage][i%parameters[stage].length].toString(16).padStart(8,'0'));if(!s.publicPass)failures.push({stage,got,want,parameters:s.actual.parameters});
 const pix=Buffer.from(s.pixels);assert(s.gdi?.shared,"GDI uses shared guest memory");const gdi=Buffer.from(s.gdi.pixels);s.gdiShared=true;s.gdiMatchesBacking=gdi.equals(pix);assert(s.gdiMatchesBacking);delete s.gdi;const x=19,y=64,w=230,h=100;let equal=true;for(let row=0;row<h;++row)if(!pix.subarray(((y+row)*s.width+x)*4,((y+row)*s.width+x+w)*4).equals(pix.subarray(((y+row)*s.width+x+270)*4,((y+row)*s.width+x+270+w)*4)))equal=false;s.pairs=[{equal}];
 // Fixed label lengths determine the selected top bevel independently.
 s.probes=[];const edgeProbes=[[0,40,255],[1,40,192],[2,40,192],[227,40,192],[228,40,128],[229,40,0],[220,18,192],[220,19,255],[220,20,192],[220,21,192],[220,97,192],[220,98,128],[220,99,0]];for(const [px,py,c] of edgeProbes){const rgba=Array.from(pix.subarray(((y+py)*s.width+x+px)*4,((y+py)*s.width+x+px)*4+4)),expectedRGBA=[c,c,c,255];s.probes.push({px,py,rgba,expectedRGBA,pass:rgba.every((v,i)=>v===expectedRGBA[i])});}let left=0;for(let j=0;j<expected[stage].length;++j){const rgba=Array.from(pix.subarray(((y)*s.width+x+left+8)*4,((y)*s.width+x+left+8)*4+4));const expectedRGBA=j===selections[stage]?[255,255,255,255]:[192,192,192,255];s.probes.push({j,rgba,expectedRGBA,pass:rgba.every((v,i)=>v===expectedRGBA[i])});for(const [py,c] of [[2,j===selections[stage]?192:255],[19,192],[20,192]]){const offset=((y+py)*s.width+x+left+8)*4,rgba=Array.from(pix.subarray(offset,offset+4)),expectedRGBA=[c,c,c,255];s.probes.push({j,py,rgba,expectedRGBA,pass:rgba.every((v,i)=>v===expectedRGBA[i])});}left+=expected[stage][j].length*5+16;}
 {await page.screenshot({path:out+'/stage-'+stage+'-composited.png'});require(root+'/tools/browser-transients.cjs').captureWhole(out,'stage-'+stage+'-desktop',display.env);
 const {PNG}=require(root+'/node_modules/pngjs'),composite=PNG.sync.read(fs.readFileSync(out+'/stage-'+stage+'-composited.png')),desktop=PNG.sync.read(fs.readFileSync(out+'/stage-'+stage+'-desktop.png')),frame=s.rows.find(w=>w.title==='Authored tab userdata settings'),g=await page.evaluate(()=>tabHost.renderer.canvas.getBoundingClientRect().toJSON());
 const surfaces=[];for(let side=0;side<2;++side){const sx=x+side*270,bytes=Buffer.alloc(w*h*4);for(let row=0;row<h;++row)pix.copy(bytes,row*w*4,((y+row)*s.width+sx)*4,((y+row)*s.width+sx+w)*4);surfaces.push({x:sx,y,w,h,bytes});}
 const match=(png,v,ox,oy)=>{const x=Math.round(ox+v.x),y=Math.round(oy+v.y);if(x<0||y<0||x+v.w>png.width||y+v.h>png.height)return false;for(let row=0;row<v.h;++row)if(!png.data.subarray(((y+row)*png.width+x)*4,((y+row)*png.width+x+v.w)*4).equals(v.bytes.subarray(row*v.w*4,(row+1)*v.w*4)))return false;return true;};
 assert(surfaces.every(v=>match(composite,v,g.x+frame.x,g.y+frame.y)));const first=surfaces[0],needle=first.bytes.subarray(10*w*4,11*w*4);let origin=null;for(let at=desktop.data.indexOf(needle);at>=0;at=desktop.data.indexOf(needle,at+1)){if(at%4)continue;const ox=at/4%desktop.width-first.x,oy=Math.floor(at/4/desktop.width)-first.y-10;if(surfaces.every(v=>match(desktop,v,ox,oy))){origin={x:ox,y:oy};break;}}assert(origin,'native desktop contains both exact tab surfaces');save('stage-'+stage+'-visible.json',{origin,exactCompositor:true,exactNativeDesktop:true,probes:s.probes,surfaces:surfaces.map(({bytes,...v})=>({...v,sha256:sha(bytes)}))});}
 s.surfaceHashes=[0,1].map(side=>{const b=Buffer.alloc(w*h*4);for(let row=0;row<h;++row)pix.copy(b,row*w*4,((y+row)*s.width+x+side*270)*4,((y+row)*s.width+x+side*270+w)*4);return sha(b);});
 delete s.pixels;states.push(s);save('states.json',states);
 }
 await sample(0,'initial','');
 for(let stage=1;stage<expected.length;++stage){await page.keyboard.press('n');await page.waitForFunction(stage=>Object.values(tabHost.renderer.windows).some(w=>w.title?.startsWith(stage+' ')),{timeout:5000},stage);await sample(stage,'update','n');}
 const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);const cpuState=await cpu.evaluate(()=>{const names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,registers:Object.fromEntries(names.map(n=>[n,instance.exports[n]()>>>0]))};});
 save('cpu-state.json',cpuState);assert.equal(cpuState.memoryBytes,536870912);assert.equal(Object.keys(cpuState.registers).length,19);assert(cpuState.registers.get_eip&&cpuState.registers.get_esp);
 await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));
 save('assertions.json',{expectOld,failures,states:states.length,productionBrowserCPU:true,referencePairsMatch:states.every(s=>s.pairs.every(p=>p.equal))});
 assert(states.filter(s=>!expectOld||s.stage<28).every(s=>s.pairs.every(p=>p.equal)&&s.probes.every(p=>p.pass)),'independent reference surfaces and literal frame/row pixels');
 if(expectOld){assert(failures.length>0,'old module must fail supported userdata contract');console.log('PASS oldFAIL reproduced',failures.length);}else{assert.deepEqual(failures,[]);console.log('PASS TAB ITEM PARAM opaque A/W values, independent masks, atomic combined mutations, middle insert/delete/all/recreate and four paint planes',states.length);}
 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('transients.json',await transient.cleanup(out));if(display)await display.close();}
}
if(require.main===module)main(process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync(require('node:os').tmpdir()+'/tab-item-param-'),{expectOld:process.argv.includes('--expect-old')}).catch(e=>{console.error(e.stack);process.exitCode=1;});module.exports={fixture,main,expected,parameters};
