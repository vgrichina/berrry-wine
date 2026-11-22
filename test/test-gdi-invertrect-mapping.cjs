'use strict';
// WIN32.HLP 2578/5454, 642, 3057/6091, 2574/5450: logical rectangles.
// Positive integer 2x/3x scales and small coordinates avoid rounding ambiguity.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=process.cwd(),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);unsigned short API RegisterClassA(P);long API DefWindowProcA(P,U,U,long);int API GetMessageA(P,P,U,U);int API TranslateMessage(P);long API DispatchMessageA(P);int API SetWindowTextA(P,const char*);P API BeginPaint(P,P);int API EndPaint(P,P);
P API CreateCompatibleDC(P);P API CreateDIBSection(P,P,U,P,P,U);P API SelectObject(P,P);int API StretchBlt(P,int,int,int,int,P,int,int,int,int,U);int API BitBlt(P,int,int,int,int,P,int,int,U);int API InvertRect(P,P);int API IntersectClipRect(P,int,int,int,int);int API SelectClipRgn(P,P);P API CreateSolidBrush(U);U API SetPixel(P,int,int,U);int API SetMapMode(P,int);int API SetWindowExtEx(P,int,int,P);int API SetViewportExtEx(P,int,int,P);int API SetViewportOrgEx(P,int,int,P);int API SetWindowOrgEx(P,int,int,P);int API SetStretchBltMode(P,int);U API GetPixel(P,int,int);
struct WC{U style;P proc;int a,b;P instance,icon,cursor,brush;const char* menu;const char* name;};struct BMI{U size;int w,h;unsigned short planes,bpp;U compression,image;int xp,yp;U used,important;};
static P dc[16],refdc[16],frame;static char report[512];static U retained[16][1536];
void num(U n,int* at){char q[12];int k=0;do{q[k++]='0'+n%10;n/=10;}while(n);while(k)report[(*at)++]=q[--k];report[(*at)++]=' ';}
P dib(P* pixels,int bottom,int pattern){struct BMI b={40,32,bottom?24:-24,1,32,0,0,0,0,0,0};P d=CreateCompatibleDC(0);P bm=CreateDIBSection(d,&b,0,pixels,0,0);if(!d||!bm||!SelectObject(d,bm))return 0;for(int y=0;y<24;++y)for(int x=0;x<32;++x)((U*)*pixels)[(bottom?23-y:y)*32+x]=pattern?(0x005a0000|((y+1)<<8)|(x+1)):0x00181716;return d;}
int map(P dc,int kind,int sx,int sy,int wx,int wy,int vx,int vy){int ok=1;ok&=SetMapMode(dc,kind?8:1)!=0;if(kind){ok&=SetWindowExtEx(dc,2,3,0)!=0;ok&=SetViewportExtEx(dc,2*sx,3*sy,0)!=0;}ok&=SetWindowOrgEx(dc,wx,wy,0)!=0;ok&=SetViewportOrgEx(dc,vx,vy,0)!=0;return ok;}
long __stdcall proc(P h,U m,U w,long l){if(m==15){U ps[16];P d=BeginPaint(h,ps);for(int k=0;k<16;++k){int x=12+(k%4)*248,y=12+(k/4)*134;StretchBlt(d,x,y,96,72,dc[k],0,0,32,24,0xcc0020);StretchBlt(d,x+102,y,96,72,refdc[k],0,0,32,24,0xcc0020);}EndPaint(h,ps);return 0;}return DefWindowProcA(h,m,w,l);}
void start(void){P inst=GetModuleHandleA(0);for(int k=0;k<16;++k){int c=k%4,bottom=(k/4)%2,clip=k/8,at=0;P bits,refbits;dc[k]=dib(&bits,bottom,1);refdc[k]=dib(&refbits,bottom,1);

int sx=c==2?2:c==3?3:1,sy=c==2?3:c==3?2:1,dwx=2,dwy=3,dvx=4,dvy=5;
struct RC{int l,t,r,b;} rect={3,4,6,6};
num(k,&at);num(dc[k]!=0&&refdc[k]!=0,&at);num(map(dc[k],c!=0,sx,sy,dwx,dwy,dvx,dvy),&at);num(SetStretchBltMode(dc[k],3)!=0,&at);num(SetStretchBltMode(refdc[k],3)!=0,&at);
num(clip?IntersectClipRect(dc[k],4,4,6,5):2,&at);
num(InvertRect(dc[k],&rect),&at);
/* Independent MM_TEXT public SetPixel oracle; rectangle bounds are fixed literals per case below. */
num(map(refdc[k],0,1,1,0,0,0,0),&at);int expectedOK=1;
int lefts[4]={5,5,6,7},tops[4]={6,6,8,7},rights[4]={8,8,12,16},bottoms[4]={8,8,14,11};
int clipLefts[4]={6,6,8,10},clipBottoms[4]={7,7,11,9};
int left=clip?clipLefts[c]:lefts[c],top=tops[c],right=rights[c],bot=clip?clipBottoms[c]:bottoms[c];
for(int y=top;y<bot;++y)for(int x=left;x<right;++x){U v=((U*)refbits)[(bottom?23-y:y)*32+x];U rgb=((v&255)<<16)|(v&0xff00)|((v>>16)&255);rgb^=0xffffff;expectedOK&=SetPixel(refdc[k],x,y,rgb)==rgb;}
num(expectedOK,&at);
num(SelectClipRgn(dc[k],0)!=0,&at);num(map(dc[k],0,1,1,0,0,0,0),&at);
int bytes=0,pixels=0;for(int j=0;j<3072;++j)if(((unsigned char*)bits)[j]!=((unsigned char*)refbits)[j])++bytes;for(int y=0;y<24;++y)for(int x=0;x<32;++x)if(GetPixel(dc[k],x,y)!=GetPixel(refdc[k],x,y))++pixels;num(bytes,&at);num(pixels,&at);
for(int j=0;j<768;++j){retained[k][j]=((U*)bits)[j];retained[k][j+768]=((U*)refbits)[j];}
num(map(dc[k],c!=0,sx,sy,dwx,dwy,dvx,dvy),&at);num(clip?IntersectClipRect(dc[k],4,4,6,5):2,&at);num(InvertRect(dc[k],&rect),&at);
int restored=0;for(int y=0;y<24;++y)for(int x=0;x<32;++x)if(((U*)bits)[(bottom?23-y:y)*32+x]!=(0x005a0000UL|((y+1)<<8)|(x+1)))++restored;num(restored,&at);
num(SelectClipRgn(dc[k],0)!=0,&at);num(map(dc[k],0,1,1,0,0,0,0),&at);int restoredPixels=0;for(int y=0;y<24;++y)for(int x=0;x<32;++x){U v=0x005a0000|((y+1)<<8)|(x+1),rgb=((v&255)<<16)|(v&0xff00)|((v>>16)&255);if(GetPixel(dc[k],x,y)!=rgb)++restoredPixels;}num(restoredPixels,&at);
/* Display the retained first-operation storage after proving double restoration. */
for(int j=0;j<768;++j)((U*)bits)[j]=retained[k][j];
num(sx,&at);num(sy,&at);num(clip,&at);num(bottom,&at);num((U)retained[k],&at);report[at]=0;
struct WC wc={0,proc,0,0,inst,0,0,(P)16,0,"InvertRectMapping"};if(k==0){RegisterClassA(&wc);frame=CreateWindowExA(0,"InvertRectMapping","InvertRect mapping",0x10c80000,12,12,1040,1000,0,0,inst,0);}CreateWindowExA(0,"STATIC",report,0x50000000,12+(k%4)*248,90+(k/4)*134,244,36,frame,(P)(100+k),inst,0);}
SetWindowTextA(frame,"InvertRect mapping ready");U msg[12];while(GetMessageA(msg,0,0,0)>0){TranslateMessage(msg);DispatchMessageA(msg);}}
`;
function buildFixture(out){
 fs.writeFileSync(out+'/fixture.c',source);
 const libs={kernel32:['GetModuleHandleA@4'],user32:['CreateWindowExA@48','RegisterClassA@4','DefWindowProcA@16','SetWindowTextA@8','GetMessageA@16','TranslateMessage@4','DispatchMessageA@4','BeginPaint@8','EndPaint@8','InvertRect@8'],gdi32:['CreateCompatibleDC@4','CreateDIBSection@24','SelectObject@8','StretchBlt@44','BitBlt@36','SetPixel@16','SetMapMode@8','SetWindowExtEx@16','SetViewportExtEx@16','SetViewportOrgEx@16','SetWindowOrgEx@16','SetStretchBltMode@8','GetPixel@12','IntersectClipRect@20','SelectClipRgn@8']};
 for(const[dll,names]of Object.entries(libs)){fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib'],{timeout:15000});}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-Wall','-Wextra','-Werror','-Wno-unused-parameter','-c',out+'/fixture.c','-o',out+'/fixture.obj'],{timeout:15000});
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/invertrect-mapping.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib',out+'/gdi32.lib'],{timeout:15000});return fs.readFileSync(out+'/invertrect-mapping.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n');
 const runtime=require(root+'/tools/boids-current-runtime.cjs'),commit=cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files=runtime.gitFiles(commit);
 for(const n of files.keys())if(fs.existsSync(root+'/'+n))files.set(n,fs.readFileSync(root+'/'+n));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{maxBuffer:8e6}));
 const diff=()=>cp.execFileSync('git',['diff','--binary',commit,'--','src','lib','tools','host.js','index.html'],{maxBuffer:24e6});const patch=diff();fs.writeFileSync(out+'/runtime.diff',patch);
 const wasm=process.env.INVERTRECT_MAPPING_WASM?fs.readFileSync(process.env.INVERTRECT_MAPPING_WASM):runtime.compile(files),pe=process.env.INVERTRECT_MAPPING_PE?fs.readFileSync(process.env.INVERTRECT_MAPPING_PE):buildFixture(out);fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));fs.writeFileSync(out+'/invertrect-mapping.exe',pe);files.set('build/wine-assembly.wasm',wasm);files.set('invertrect-mapping.exe',pe);
 save('runtime.json',{commit,expectOld,moduleSHA256:sha(wasm),peSHA256:sha(pe),testSHA256:sha(fs.readFileSync(__filename)),files:[...files].map(([name,b])=>({name,size:b.length,sha256:sha(b)}))});assert(patch.equals(diff()),'runtime changed during compile');
 const transient=require(root+'/tools/browser-transients.cjs').create(),logs=[],pending=[],workers=[];let display,browser,wait,server;
 try{
 server=http.createServer((req,res)=>{const n=new URL(req.url,'http://local').pathname.slice(1)||'index.html',b=files.get(n);res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.html')?'text/html':n.endsWith('.css')?'text/css':n.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.statusCode=b?200:404;res.end(b||'missing');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 display=await require(root+'/tools/gltron-headful-display.cjs').start(out);
 browser=await require('puppeteer').launch({headless:false,defaultViewport:{width:1050,height:1050},env:transient.env(display.env),userDataDir:transient.profile,executablePath:'/opt/google/chrome/chrome',args:[...transient.args,'--no-sandbox','--disable-dev-shm-usage','--disable-component-update','--disable-background-networking'],protocolTimeout:45000});wait=transient.watch(browser.process());browser.process().stdout?.resume();browser.process().stderr?.resume();
 save('browser-version.json',{version:await browser.version()});const page=await browser.newPage();page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>logs.push(String(e)));
 page.on('workercreated',w=>{const row={url:w.url(),modules:[]};workers.push(row);const c=w.client;c.on('Debugger.scriptParsed',v=>{if(v.scriptLanguage==='WebAssembly'||v.url.startsWith('wasm://'))pending.push(c.send('Debugger.getScriptSource',{scriptId:v.scriptId}).then(r=>row.modules.push(sha(Buffer.from(r.bytecode,'base64')))));});pending.push(c.send('Debugger.enable'));});
 await page.evaluateOnNewDocument(()=>localStorage.setItem('wine-assembly.threads','1'));await page.goto('http://127.0.0.1:'+server.address().port+'/?debug&threads&no-log');await page.waitForFunction(()=>typeof WineAssembly==='function');
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=1000;c.style='position:fixed;left:0;top:0;z-index:99999;width:1000px;height:1000px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.invertrectMappingHost=new WineAssembly();invertrectMappingHost.renderer=new Win98Renderer(c);await invertrectMappingHost.init(c);if(!invertrectMappingHost.guestWorker)throw Error('production Worker required');await invertrectMappingHost.loadExe('/invertrect-mapping.exe');invertrectMappingHost.run();});
 await page.waitForFunction(()=>Object.values(invertrectMappingHost.renderer.windows).some(w=>w.title==='InvertRect mapping ready'),{timeout:20000});await new Promise(r=>setTimeout(r,300));assert(!logs.some(s=>/UNKNOWN/.test(s)),'UNKNOWN closes scope');
 const s=await page.evaluate(()=>{const encode=a=>{let s='';for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode(...a.subarray(i,i+8192));return btoa(s);};const h=invertrectMappingHost,r=h.renderer,w=Object.values(r.windows).find(w=>w.title==='InvertRect mapping ready'),p=w._backCanvas._waCanonicalPresentation;return{reports:Array.from({length:16},(_,k)=>Object.values(r.windows).find(v=>v.isChild&&v.x===12+(k%4)*248&&v.y===90+Math.floor(k/4)*134)?.title),gdi:p?{sharedGuestStorage:p.surface.storage.buffer===h.memory.buffer,pixels:encode(p.surface.rgbaRect(0,0,w.w,w.h))}:null,pixels:encode(w._backCanvas.getContext('2d').getImageData(0,0,w.w,w.h).data),width:w.w,height:w.h,frame:{x:w.x,y:w.y},canvas:r.canvas.getBoundingClientRect().toJSON()};});save('public.json',s.reports);assert(s.gdi?.sharedGuestStorage);s.dibs=await page.evaluate(reports=>reports.map(v=>{const addr=Number(v.trim().split(' ').at(-1)),b=new Uint8Array(invertrectMappingHost.memory.buffer,addr-0x400000+0x12000,6144);let text='';for(const c of b)text+=String.fromCharCode(c);return btoa(text);}),s.reports);
 const pix=Buffer.from(s.pixels,'base64'),gd=Buffer.from(s.gdi.pixels,'base64'),surfaces=[],checks=[];
 function crop(x,y,w,h){const b=Buffer.alloc(w*h*4);for(let r=0;r<h;++r){const at=((y+r)*s.width+x)*4;pix.copy(b,r*w*4,at,at+w*4);assert(pix.subarray(at,at+w*4).equals(gd.subarray(at,at+w*4)),'GDI/backcanvas');}surfaces.push({x,y,w,h,bytes:b});return b;}


 for(let k=0;k<16;++k){const config=k%4,bottom=!!(Math.floor(k/4)%2),clip=k>=8,broken=expectOld&&config>=2,nums=s.reports[k].trim().split(/\s+/).map(Number);
  assert.deepEqual(nums.slice(0,11),[k,1,1,1,1,2,1,1,1,1,1],'public setup, clip and InvertRect returns '+k);
  assert.deepEqual(nums.slice(13,20),[1,2,1,0,1,1,0],'double inversion restore, returns '+k);
  assert.deepEqual(nums.slice(20,24),[config===2?2:config===3?3:1,config===2?3:config===3?2:1,+clip,+bottom]);
  const retained=Buffer.from(s.dibs[k],'base64');assert.equal(retained.length,6144);fs.writeFileSync(out+'/dib-'+k+'.bin',retained);const actual=retained.subarray(0,3072),reference=retained.subarray(3072);
  const bounds=clip?[[6,6,8,7],[6,6,8,7],[8,8,12,11],[10,7,16,9]][config]:[[5,6,8,8],[5,6,8,8],[6,8,12,14],[7,7,16,11]][config];
  const oldbounds=[[5,6,8,8],[5,6,8,8],[6,8,9,10],[7,7,10,9]][config];
  function literal(old){const v=Buffer.alloc(3072);for(let y=0;y<24;++y)for(let x=0;x<32;++x){const inside=x>=bounds[0]&&x<bounds[2]&&y>=bounds[1]&&y<bounds[3]&&(!old||(x>=oldbounds[0]&&x<oldbounds[2]&&y>=oldbounds[1]&&y<oldbounds[3]));let color=0x005a0000|((y+1)<<8)|(x+1);if(inside)color^=0xffffff;v.writeUInt32LE(color,((bottom?23-y:y)*32+x)*4);}return v;}
  assert(reference.equals(literal(false)),'independent MM_TEXT oracle equals fixed literal '+k);assert(actual.equals(literal(broken)),'whole actual DIB '+k);assert.equal(actual.equals(reference),!broken);
  const mismatches=actual.reduce((n,v,i)=>n+(v!==reference[i]),0);assert.equal(nums[11],mismatches);assert.equal(nums[12],mismatches/3);assert.equal(mismatches>0,broken);
  const px=15+(k%4)*248,py=35+Math.floor(k/4)*134,view=crop(px,py,96,72),ref=crop(px+102,py,96,72);assert.equal(view.equals(ref),!broken);
  checks.push({k,config,clip,bottomUp:bottom,bounds,publicReturns:nums,wholeDIBMismatchBytes:mismatches,publicPixelMismatches:nums[12],doubleRestoreWholeDIBAndAllPublicPixels:true,visibleEqual:view.equals(ref),actualSHA256:sha(view),referenceSHA256:sha(ref)});
 }
 save('checks.json',checks);
 const compositeBytes=await page.screenshot(),raw=cp.execFileSync('xwd',['-root','-silent'],{env:display.env,timeout:3000,maxBuffer:16e6}),encoded=require(root+'/tools/browser-transients.cjs').encodeXwd(raw);fs.writeFileSync(out+'/desktop.png',encoded.png);fs.writeFileSync(out+'/composited.png',compositeBytes);
 const{PNG}=require('pngjs'),composite=PNG.sync.read(compositeBytes),desktop=PNG.sync.read(encoded.png),match=(png,v,ox,oy)=>{const x=Math.round(ox+v.x),y=Math.round(oy+v.y);if(x<0||y<0||x+v.w>png.width||y+v.h>png.height)return false;for(let r=0;r<v.h;++r)if(!png.data.subarray(((y+r)*png.width+x)*4,((y+r)*png.width+x+v.w)*4).equals(v.bytes.subarray(r*v.w*4,(r+1)*v.w*4)))return false;return true;};assert(surfaces.every(v=>match(composite,v,s.canvas.x+s.frame.x,s.canvas.y+s.frame.y)),'compositor exact');
 let origin=null;const v=surfaces[1],needle=v.bytes.subarray(24*v.w*4,25*v.w*4);for(let at=desktop.data.indexOf(needle);at>=0;at=desktop.data.indexOf(needle,at+1)){if(at%4)continue;const ox=at/4%desktop.width-v.x,oy=Math.floor(at/4/desktop.width)-v.y-24;if(surfaces.every(v=>match(desktop,v,ox,oy))){origin={x:ox,y:oy};break;}}assert(origin,'native desktop all32 panels exact');
 const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);const cpuState=await cpu.evaluate(()=>{const names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,registers:Object.fromEntries(names.map(n=>[n,instance.exports[n]()>>>0]))};});save('cpu-state.json',cpuState);assert.equal(cpuState.memoryBytes,536870912);assert.equal(Object.keys(cpuState.registers).length,19);await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));assert(patch.equals(diff()),'runtime changed during run');save('assertions.json',{expectOld,cases:16,physicalOldFailures:expectOld?8:0,wholeIndependentPublicRaster:true,fourPlanes:true,origin,productionCPU512MB19regsDebuggerLoadedSHA:true});if(expectOld)process.exitCode=1;assert(!logs.some(s=>/UNKNOWN/.test(s)),'UNKNOWN closes scope');console.log(expectOld?'FAIL':'PASS',expectOld?'physical preedit 8 InvertRect mapping failures, 8 identity controls':'16 InvertRect mapping cases',sha(wasm));
 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('deferred-transients.json',{root:transient.root,downloads:transient.downloads});if(display)await display.close();}
}
if(require.main===module){assert(process.argv[2],'evidence output directory required');main(path.resolve(process.argv[2]),{expectOld:process.argv.includes('--expect-old')}).catch(e=>{console.error(e.stack);process.exitCode=1;});}
module.exports={buildFixture,main};
