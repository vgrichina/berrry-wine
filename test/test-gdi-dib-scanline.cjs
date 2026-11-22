'use strict';
// WIN32.HLP 2280: matching indexed format preserves RGB; conversion to 1 bpp synthesizes black/white.
// Symmetric center bands avoid relying on arbitrary scanline-origin interpretations.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=process.cwd(),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const source=String.raw`
typedef unsigned long U;typedef void* P;
#define API __declspec(dllimport) __stdcall
P API GetModuleHandleA(const char*);P API CreateWindowExA(U,const char*,const char*,U,int,int,int,int,P,P,P,P);unsigned short API RegisterClassA(P);long API DefWindowProcA(P,U,U,long);int API GetMessageA(P,P,U,U);int API TranslateMessage(P);long API DispatchMessageA(P);int API SetWindowTextA(P,const char*);P API BeginPaint(P,P);int API EndPaint(P,P);
P API CreateCompatibleDC(P);P API CreateDIBSection(P,P,U,P,P,U);P API SelectObject(P,P);int API StretchBlt(P,int,int,int,int,P,int,int,int,int,U);U API SetPixel(P,int,int,U);U API GetPixel(P,int,int);int API SetStretchBltMode(P,int);int API GetDIBits(P,P,U,U,P,P,U);int API SetDIBits(P,P,U,U,P,P,U);P API CreatePalette(P);P API SelectPalette(P,P,int);
struct WC{U style;P proc;int a,b;P instance,icon,cursor,brush;const char* menu;const char* name;};struct BMI{U size;int w,h;unsigned short planes,bpp;U compression,image;int xp,yp;U used,important;};
static P dc[32],refdc[32],frame;static char report[512];static unsigned char retained[32][512];
void num(U n,int* at){char q[12];int k=0;do{q[k++]='0'+n%10;n/=10;}while(n);while(k)report[(*at)++]=q[--k];report[(*at)++]=' ';}
P dib(P* pixels,P* bm,P* old,int bottom){struct BMI b={40,8,bottom?4:-4,1,32,0,0,0,0,0,0};P d=CreateCompatibleDC(0);*bm=CreateDIBSection(d,&b,0,pixels,0,0);*old=SelectObject(d,*bm);if(!d||!*bm||!*old)return 0;for(int j=0;j<32;++j)((U*)*pixels)[j]=0x00181716;return d;}
long __stdcall proc(P h,U m,U w,long l){if(m==15){U ps[16];P d=BeginPaint(h,ps);for(int k=0;k<32;++k){int x=12+(k%4)*150,y=12+(k/4)*90;StretchBlt(d,x,y,64,32,dc[k],0,0,8,4,0xcc0020);StretchBlt(d,x+68,y,64,32,refdc[k],0,0,8,4,0xcc0020);}EndPaint(h,ps);return 0;}return DefWindowProcA(h,m,w,l);}
void start(void){P inst=GetModuleHandleA(0);U lp[5]={0x00040300,0x000000ff,0x00ff0000,0,0x00ffffff};P pal=CreatePalette(lp),paldc=CreateCompatibleDC(0);P oldpal=SelectPalette(paldc,pal,0);unsigned char matrix[4]={0x55,0xc3,0x3c,0xaa};
for(int k=0;k<32;++k){int conversion=k%2,srcBottom=(k/2)%2,outBottom=(k/4)%2,partial=(k/8)%2,use=k/16,at=0,start=partial?1:0,count=partial?2:4;P bits,refbits,bm,refbm,old,refold;
dc[k]=dib(&bits,&bm,&old,outBottom);refdc[k]=dib(&refbits,&refbm,&refold,outBottom);unsigned char sbmi[56];for(int j=0;j<56;++j)sbmi[j]=0;struct BMI* sb=(struct BMI*)sbmi;sb->size=40;sb->w=8;sb->h=srcBottom?4:-4;sb->planes=1;sb->bpp=conversion?8:1;sb->used=conversion?4:2;U* tab=(U*)(sbmi+40);tab[0]=0x00ff0000;tab[1]=0x000000ff;tab[2]=0;tab[3]=0x00ffffff;P srcbits;P src=CreateDIBSection(0,sb,0,&srcbits,0,0);int sourceSize=conversion?32:16,paletteSize=conversion?16:8;
for(int y=0;y<4;++y){int row=srcBottom?3-y:y;if(conversion){for(int x=0;x<8;++x)((unsigned char*)srcbits)[row*8+x]=2+((matrix[y]>>(7-x))&1);}else{for(int j=0;j<4;++j)((unsigned char*)srcbits)[row*4+j]=j?0xa5:matrix[y];}}
for(int j=0;j<8;++j)((unsigned char*)srcbits)[sourceSize+paletteSize+j]=0xa5;unsigned char before[56];for(int j=0;j<sourceSize+paletteSize+8;++j)before[j]=((unsigned char*)srcbits)[j];
unsigned char* packet=retained[k];for(int j=0;j<512;++j)packet[j]=0xa5;struct BMI* ob=(struct BMI*)(packet+8);for(int j=0;j<40;++j)((unsigned char*)ob)[j]=0;ob->size=40;ob->w=8;ob->h=outBottom?4:-4;ob->planes=1;ob->bpp=1;unsigned char* output=packet+136;
num(k,&at);num(dc[k]!=0&&refdc[k]!=0&&src!=0&&pal!=0&&paldc!=0&&oldpal!=0,&at);num(SetStretchBltMode(dc[k],3)!=0,&at);num(SetStretchBltMode(refdc[k],3)!=0,&at);
num(GetDIBits(paldc,src,start,count,output,ob,use),&at);int unchanged=1;for(int j=0;j<sourceSize+paletteSize+8;++j)if(before[j]!=((unsigned char*)srcbits)[j])unchanged=0;num(unchanged,&at);
num(SelectObject(dc[k],old)==bm,&at);num(SetDIBits(paldc,bm,start,count,output,ob,use),&at);num(SelectObject(dc[k],bm)==old,&at);
int expectedOK=1;for(int y=start;y<start+count;++y)for(int x=0;x<8;++x){int bit=(matrix[y]>>(7-x))&1;U color=conversion?(bit?0xffffff:0):(bit?0xff0000:0xff);expectedOK&=SetPixel(refdc[k],x,y,color)==color;}num(expectedOK,&at);
int mismatch=0;for(int y=0;y<4;++y)for(int x=0;x<8;++x)if(GetPixel(dc[k],x,y)!=GetPixel(refdc[k],x,y))++mismatch;num(mismatch,&at);
for(int j=0;j<128;++j){packet[160+j]=((unsigned char*)bits)[j];packet[288+j]=((unsigned char*)refbits)[j];}for(int j=0;j<sourceSize+paletteSize+8;++j)packet[416+j]=((unsigned char*)srcbits)[j];
num((U)packet,&at);report[at]=0;struct WC wc={0,proc,0,0,inst,0,0,(P)16,0,"DIBScanline"};if(k==0){RegisterClassA(&wc);frame=CreateWindowExA(0,"DIBScanline","DIB scanline",0x10c80000,12,12,660,830,0,0,inst,0);}CreateWindowExA(0,"STATIC",report,0x50000000,12+(k%4)*150,50+(k/4)*90,144,40,frame,(P)(100+k),inst,0);}
SetWindowTextA(frame,"DIB scanline ready");U msg[12];while(GetMessageA(msg,0,0,0)>0){TranslateMessage(msg);DispatchMessageA(msg);}}
`;
function buildFixture(out){
 fs.writeFileSync(out+'/fixture.c',source);
 const libs={kernel32:['GetModuleHandleA@4'],user32:['CreateWindowExA@48','RegisterClassA@4','DefWindowProcA@16','SetWindowTextA@8','GetMessageA@16','TranslateMessage@4','DispatchMessageA@4','BeginPaint@8','EndPaint@8'],gdi32:['CreateCompatibleDC@4','CreateDIBSection@24','SelectObject@8','StretchBlt@44','SetPixel@16','GetPixel@12','SetStretchBltMode@8','GetDIBits@28','SetDIBits@28','CreatePalette@4','SelectPalette@12']};
 for(const[dll,names]of Object.entries(libs)){fs.writeFileSync(out+'/'+dll+'.def','LIBRARY '+dll+'.dll\nEXPORTS\n'+names.join('\n')+'\n');cp.execFileSync('llvm-dlltool',['-m','i386','-k','-d',out+'/'+dll+'.def','-l',out+'/'+dll+'.lib'],{timeout:15000});}
 cp.execFileSync('clang',['--target=i686-pc-windows-msvc','-ffreestanding','-fno-stack-protector','-fno-builtin','-O1','-Wall','-Wextra','-Werror','-Wno-unused-parameter','-c',out+'/fixture.c','-o',out+'/fixture.obj'],{timeout:15000});
 cp.execFileSync('ld',['-mi386pe','--entry','_start','--subsystem','windows','--disable-dynamicbase','--no-insert-timestamp','-o',out+'/dib-scanline.exe',out+'/fixture.obj',out+'/kernel32.lib',out+'/user32.lib',out+'/gdi32.lib'],{timeout:15000});return fs.readFileSync(out+'/dib-scanline.exe');
}
async function main(out,{expectOld=false}={}){
 fs.mkdirSync(out,{recursive:true});const save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n');
 const runtime=require(root+'/tools/boids-current-runtime.cjs'),commit=cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files=runtime.gitFiles(commit);
 for(const n of files.keys())if(fs.existsSync(root+'/'+n))files.set(n,fs.readFileSync(root+'/'+n));
 for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',commit,'--','fonts','icons','images','style.css'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))files.set(n,cp.execFileSync('git',['show',commit+':'+n],{maxBuffer:8e6}));
 const diff=()=>cp.execFileSync('git',['diff','--binary',commit,'--','src','lib','tools','host.js','index.html'],{maxBuffer:24e6});const patch=diff();fs.writeFileSync(out+'/runtime.diff',patch);
 const wasm=process.env.DIB_SCANLINE_WASM?fs.readFileSync(process.env.DIB_SCANLINE_WASM):runtime.compile(files),pe=process.env.DIB_SCANLINE_PE?fs.readFileSync(process.env.DIB_SCANLINE_PE):buildFixture(out);fs.writeFileSync(out+'/tested.wasm.gz',zlib.gzipSync(wasm));fs.writeFileSync(out+'/dib-scanline.exe',pe);files.set('build/wine-assembly.wasm',wasm);files.set('dib-scanline.exe',pe);
 save('runtime.json',{commit,expectOld,moduleSHA256:sha(wasm),peSHA256:sha(pe),testSHA256:sha(fs.readFileSync(__filename)),files:[...files].map(([name,b])=>({name,size:b.length,sha256:sha(b)}))});assert(patch.equals(diff()),'runtime changed during compile');
 const transient=require(root+'/tools/browser-transients.cjs').create(),logs=[],pending=[],workers=[];let display,browser,wait,server;
 try{
 server=http.createServer((req,res)=>{const n=new URL(req.url,'http://local').pathname.slice(1)||'index.html',b=files.get(n);res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.html')?'text/html':n.endsWith('.css')?'text/css':n.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.statusCode=b?200:404;res.end(b||'missing');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 display=await require(root+'/tools/gltron-headful-display.cjs').start(out);
 browser=await require(root+'/node_modules/puppeteer').launch({headless:false,defaultViewport:{width:1050,height:1050},env:transient.env(display.env),userDataDir:transient.profile,executablePath:'/opt/google/chrome/chrome',args:[...transient.args,'--no-sandbox','--disable-dev-shm-usage','--disable-component-update','--disable-background-networking'],protocolTimeout:45000});wait=transient.watch(browser.process());browser.process().stdout?.resume();browser.process().stderr?.resume();
 save('browser-version.json',{version:await browser.version()});const page=await browser.newPage();page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>logs.push(String(e)));
 page.on('workercreated',w=>{const row={url:w.url(),modules:[]};workers.push(row);const c=w.client;c.on('Debugger.scriptParsed',v=>{if(v.scriptLanguage==='WebAssembly'||v.url.startsWith('wasm://'))pending.push(c.send('Debugger.getScriptSource',{scriptId:v.scriptId}).then(r=>row.modules.push(sha(Buffer.from(r.bytecode,'base64')))));});pending.push(c.send('Debugger.enable'));});
 await page.evaluateOnNewDocument(()=>localStorage.setItem('wine-assembly.threads','1'));await page.goto('http://127.0.0.1:'+server.address().port+'/?debug&threads&no-log');await page.waitForFunction(()=>typeof WineAssembly==='function');
 await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=1000;c.style='position:fixed;left:0;top:0;z-index:99999;width:1000px;height:1000px;max-width:none;max-height:none;border:0;padding:0';document.body.append(c);window.dibScanlineHost=new WineAssembly();dibScanlineHost.renderer=new Win98Renderer(c);await dibScanlineHost.init(c);if(!dibScanlineHost.guestWorker)throw Error('production Worker required');await dibScanlineHost.loadExe('/dib-scanline.exe');dibScanlineHost.run();});
 await page.waitForFunction(()=>Object.values(dibScanlineHost.renderer.windows).some(w=>w.title==='DIB scanline ready'),{timeout:20000});await new Promise(r=>setTimeout(r,300));assert(!logs.some(s=>/UNKNOWN/.test(s)),'UNKNOWN closes scope');
 const s=await page.evaluate(()=>{const encode=a=>{let s='';for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode(...a.subarray(i,i+8192));return btoa(s);};const h=dibScanlineHost,r=h.renderer,w=Object.values(r.windows).find(w=>w.title==='DIB scanline ready'),p=w._backCanvas._waCanonicalPresentation;return{reports:Array.from({length:32},(_,k)=>Object.values(r.windows).find(v=>v.isChild&&v.x===12+(k%4)*150&&v.y===50+Math.floor(k/4)*90)?.title),gdi:p?{sharedGuestStorage:p.surface.storage.buffer===h.memory.buffer,pixels:encode(p.surface.rgbaRect(0,0,w.w,w.h))}:null,pixels:encode(w._backCanvas.getContext('2d').getImageData(0,0,w.w,w.h).data),width:w.w,height:w.h,frame:{x:w.x,y:w.y},canvas:r.canvas.getBoundingClientRect().toJSON()};});save('public.json',s.reports);assert(s.gdi?.sharedGuestStorage);s.dibs=await page.evaluate(reports=>reports.map(v=>{const addr=Number(v.trim().split(' ').at(-1)),b=new Uint8Array(dibScanlineHost.memory.buffer,addr-0x400000+0x12000,512);let text='';for(const c of b)text+=String.fromCharCode(c);return btoa(text);}),s.reports);
 s.dibs.forEach((b,k)=>fs.writeFileSync(out+'/packet-'+k+'.bin',Buffer.from(b,'base64')));
 const pix=Buffer.from(s.pixels,'base64'),gd=Buffer.from(s.gdi.pixels,'base64'),surfaces=[],checks=[];
 function crop(x,y,w,h){const b=Buffer.alloc(w*h*4);for(let r=0;r<h;++r){const at=((y+r)*s.width+x)*4;pix.copy(b,r*w*4,at,at+w*4);assert(pix.subarray(at,at+w*4).equals(gd.subarray(at,at+w*4)),'GDI/backcanvas');}surfaces.push({x,y,w,h,bytes:b});return b;}



 // Independent literal matrix: 8 monochrome pixels per row, top to bottom.
 const matrix=[0x55,0xc3,0x3c,0xaa];
 const literalRows={fullTop:[0x55,0xc3,0x3c,0xaa],fullBottom:[0xaa,0x3c,0xc3,0x55],bandTop:[0xc3,0x3c],bandBottom:[0x3c,0xc3]};
 for(let k=0;k<32;++k){
  const conversion=!!(k%2),srcBottom=!!(Math.floor(k/2)%2),bottom=!!(Math.floor(k/4)%2),partial=!!(Math.floor(k/8)%2),use=Math.floor(k/16),count=partial?2:4,start=partial?1:0,broken=expectOld&&conversion;
  const nums=s.reports[k].trim().split(/\s+/).map(Number);
  assert.deepEqual(nums.slice(0,10),[k,1,1,1,count,1,1,count,1,1],'public setup/GetDIBits/source immutability/deselect/SetDIBits/reselect/SetPixel '+k);
  const packet=Buffer.from(s.dibs[k],'base64');assert.equal(packet.length,512);fs.writeFileSync(out+'/packet-'+k+'.bin',packet);
  const info=Buffer.alloc(128,0xa5);info.fill(0,8,48);info.writeUInt32LE(40,8);info.writeInt32LE(8,12);info.writeInt32LE(bottom?4:-4,16);info.writeUInt16LE(1,20);info.writeUInt16LE(1,22);info.writeUInt32LE(16,28);info.writeUInt32LE(2,40);
  if(use){info.writeUInt16LE(conversion&&!broken?2:0,48);info.writeUInt16LE(conversion&&!broken?3:1,50);}else{info.writeUInt32LE(conversion&&!broken?0:0xff0000,48);info.writeUInt32LE(conversion&&!broken?0xffffff:0x0000ff,52);}
  assert(packet.subarray(0,128).equals(info),'complete BITMAPINFO and before/after canaries '+k);
  const bits=Buffer.alloc(32,0xa5),rows=literalRows[(partial?'band':'full')+(bottom?'Bottom':'Top')];
  rows.forEach((v,j)=>bits[8+j*4]=broken?0:v);
  assert(packet.subarray(128,160).equals(bits),'literal full guarded output and untouched padding/tail '+k);
  const expected=Buffer.alloc(128),old=Buffer.alloc(128);
  for(let y=0;y<4;++y)for(let x=0;x<8;++x){const written=y>=start&&y<start+count,bit=(matrix[y]>>(7-x))&1,at=((bottom?3-y:y)*8+x)*4;
   expected.writeUInt32LE(written?(conversion?(bit?0xffffff:0):(bit?0x0000ff:0xff0000)):0x181716,at);
   old.writeUInt32LE(written?0xff0000:0x181716,at);
  }
  const actual=packet.subarray(160,288),reference=packet.subarray(288,416);assert(reference.equals(expected),'independent public SetPixel equals literal whole DIB '+k);assert(actual.equals(broken?old:expected),'public GetDIBits -> SetDIBits whole rendered DIB '+k);
  assert.equal(nums[10],broken?8*count:0,'all public GetPixel '+k);
  const source=Buffer.alloc(56,0xa5);for(let y=0;y<4;++y){const row=srcBottom?3-y:y;if(conversion)for(let x=0;x<8;++x)source[row*8+x]=2+((matrix[y]>>(7-x))&1);else source[row*4]=matrix[y];}const imageSize=conversion?32:16;source.writeUInt32LE(0xff0000,imageSize);source.writeUInt32LE(0x0000ff,imageSize+4);if(conversion){source.writeUInt32LE(0,imageSize+8);source.writeUInt32LE(0xffffff,imageSize+12);}assert(packet.subarray(416,472).equals(source),'literal immutable indexed source '+k);assert(packet.subarray(472).equals(Buffer.alloc(40,0xa5)),'retained packet tail '+k);
  const px=15+(k%4)*150,py=35+Math.floor(k/4)*90,view=crop(px,py,64,32),ref=crop(px+68,py,64,32);
  function panel(dib){const rgba=Buffer.alloc(64*32*4);for(let y=0;y<32;++y)for(let x=0;x<64;++x){const at=((bottom?3-Math.floor(y/8):Math.floor(y/8))*8+Math.floor(x/8))*4,to=(y*64+x)*4;rgba[to]=dib[at+2];rgba[to+1]=dib[at+1];rgba[to+2]=dib[at];rgba[to+3]=255;}return rgba;}
  assert(view.equals(panel(actual)),'actual physical panel equals retained DIB '+k);assert(ref.equals(panel(reference)),'reference physical panel equals literal DIB '+k);assert.equal(view.equals(ref),!broken);
  checks.push({k,conversion,srcBottom,bottom,partial,use,publicReturns:nums,publicPixelMismatches:nums[10],visibleEqual:view.equals(ref),actualSHA256:sha(view),referenceSHA256:sha(ref)});
 }
 save('checks.json',checks);
 const compositeBytes=await page.screenshot(),raw=cp.execFileSync('xwd',['-root','-silent'],{env:display.env,timeout:3000,maxBuffer:16e6}),encoded=require(root+'/tools/browser-transients.cjs').encodeXwd(raw);fs.writeFileSync(out+'/desktop.png',encoded.png);fs.writeFileSync(out+'/composited.png',compositeBytes);
 const{PNG}=require(root+'/node_modules/pngjs'),composite=PNG.sync.read(compositeBytes),desktop=PNG.sync.read(encoded.png),match=(png,v,ox,oy)=>{const x=Math.round(ox+v.x),y=Math.round(oy+v.y);if(x<0||y<0||x+v.w>png.width||y+v.h>png.height)return false;for(let r=0;r<v.h;++r)if(!png.data.subarray(((y+r)*png.width+x)*4,((y+r)*png.width+x+v.w)*4).equals(v.bytes.subarray(r*v.w*4,(r+1)*v.w*4)))return false;return true;};assert(surfaces.every(v=>match(composite,v,s.canvas.x+s.frame.x,s.canvas.y+s.frame.y)),'compositor exact');
 let origin=null;const v=surfaces[1],needle=v.bytes.subarray(16*v.w*4,17*v.w*4);for(let at=desktop.data.indexOf(needle);at>=0;at=desktop.data.indexOf(needle,at+1)){if(at%4)continue;const ox=at/4%desktop.width-v.x,oy=Math.floor(at/4/desktop.width)-v.y-16;if(surfaces.every(v=>match(desktop,v,ox,oy))){origin={x:ox,y:oy};break;}}assert(origin,'native desktop all64 panels exact');
 const cpu=page.workers().find(w=>/\/guest-worker\.js(?:\?|$)/.test(w.url()));assert(cpu);const cpuState=await cpu.evaluate(()=>{const names=['get_eip','get_esp','get_ebp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_flag_op','get_flag_a','get_flag_b','get_flag_res','get_flag_sign_shift','get_sreg_ds','get_sreg_es','get_sreg_ss','get_sreg_cs','get_fs_base'];return {memoryBytes:memory.buffer.byteLength,registers:Object.fromEntries(names.map(n=>[n,instance.exports[n]()>>>0]))};});save('cpu-state.json',cpuState);assert.equal(cpuState.memoryBytes,536870912);assert.equal(Object.keys(cpuState.registers).length,19);await Promise.all(pending);save('workers.json',workers);assert(workers.some(w=>w.modules.includes(sha(wasm))));assert(workers.every(w=>w.modules.every(h=>h===sha(wasm))));assert(patch.equals(diff()),'runtime changed during run');save('assertions.json',{expectOld,cases:32,physicalOldFailures:expectOld?16:0,wholeIndependentPublicRaster:true,fourPlanes:true,origin,productionCPU512MB19regsDebuggerLoadedSHA:true});if(expectOld)process.exitCode=1;assert(!logs.some(s=>/UNKNOWN/.test(s)),'UNKNOWN closes scope');console.log(expectOld?'FAIL':'PASS',expectOld?'physical preedit 16 DIB conversion failures, 16 matching controls':'32 DIB scanline cases',sha(wasm));
 }finally{save('browser.log.json',logs);await Promise.allSettled(pending);if(browser){await browser.close();save('browser-wait.json',await wait);}if(server)await new Promise(r=>server.close(r));save('deferred-transients.json',{root:transient.root,downloads:transient.downloads});if(display)await display.close();}
}
if(require.main===module){assert(process.argv[2],'evidence output directory required');main(path.resolve(process.argv[2]),{expectOld:process.argv.includes('--expect-old')}).catch(e=>{console.error(e.stack);process.exitCode=1;});}
module.exports={buildFixture,main};
