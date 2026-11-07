#!/usr/bin/env node
'use strict';
// Generated PE bootstrap and native x86 public COM calls, no media or test WAT.
// --plan is offline only. Runtime requires pinned modules and an evidence dir.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { browserFixture } = require('./test-legacy-texture-rendered-contract');
const { makeFixture } = require('../tools/kernel32-native-fixture');
const ROOT = path.resolve(__dirname, '..');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');

// Independent nearest-neighbour reference for the existing legacy background
// contract. Clip destination pixels while retaining the original UV rectangle.
function oracle(colors, rect, outside, width=12, height=8) {
  const pixels=[];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    const inside=x>=rect[0]&&x<rect[0]+rect[2]&&y>=rect[1]&&y<rect[1]+rect[3];
    const c=!inside?outside:Array.isArray(colors[0])
      ?colors[Math.floor((y-rect[1]+.5)*2/rect[3])*4+Math.floor((x-rect[0]+.5)*4/rect[2])]
      :colors;
    pixels.push(...c,255);
  }
  return pixels;
}
function plan() {
  const a=[[240,16,32],[16,224,48],[32,48,208],[208,160,16],
    [32,192,224],[192,32,176],[96,160,32],[160,80,224]];
  const b=a.map(([r,g,b])=>[b,r,g]);
  return {a,b,outside:[11,22,33],full:[0,0,12,8],inset:[2,1,8,6],edge:[8,5,8,6],
    limitations:['32-bit RGB target only','Clear(0,NULL,TARGET), no explicit rectangle arrays',
      'No claim for Clear2 explicit-color semantics, palettized targets or native Windows equivalence',
      'Cross-device handles are acquired separately; numeric equality is unspecified']};
}

// Insert after the shared harness has initialized the PE and its guarded x86
// CALL/RET helper. This intentionally reuses production Worker setup/cleanup.
async function backgroundBody(ctx) {
  const {config,mode,evidence,memory,raw,read,write,words,wa,alloc,guard,guid,com,ok,acquire,invoke,check,eq,until,
    getGpu,getStats,transport}=ctx;
  const bits=n=>{const d=new DataView(new ArrayBuffer(4));d.setFloat32(0,n,true);return d.getUint32(0,true);};
  const iidDD7=await guid([0x15e65ec0,0x11d23b9c,0x60002fb9,0x5bea9797]);
  const iidD3D3=await guid([0xbb223240,0x11d0e72b,0xaa00b4a9,0x3e99c000]);
  const iidDev2=await guid([0x93281501,0x11d08cf8,0xa000ab89,0x294105c9]);
  const iidTex2=await guid([0x93281502,0x11d08cf8,0xa000ab89,0x294105c9]);
  const hal=await guid([0x84e63de0,0x11cf46aa,0xaa001681,0xb78a4700]);
  const dv=new DataView(memory.buffer),thunkWa=config.thunkBase,saved=dv.getUint32(thunkWa+4,true);
  const thunk=(thunkWa-(await raw('get_guest_base'))+(await raw('get_image_base')))>>>0;
  let dd;
  try{dv.setUint32(thunkWa+4,config.factoryId,true);dd=await acquire(out=>invoke('DirectDrawCreateEx',[0,out,iidDD7,0],0,0,thunk));}
  finally{dv.setUint32(thunkWa+4,saved,true);}
  await ok(com('SetCooperativeLevel',dd,20,0,8));
  const d3d=await acquire(out=>com('QI D3D3',dd,0,iidD3D3,out));
  const owned=[];
  const surface=async(w,h,caps)=>{
    const p=await guard(124);await words(p.p,Array(31).fill(0));
    for(const [off,v] of [[0,124],[4,0x1007],[8,h],[12,w],[72,32],[76,0x40],[84,32],
      [88,0xff0000],[92,0xff00],[96,0xff],[104,caps]])await write(p.p+off,v);
    const s=await acquire(out=>com('CreateSurface7',dd,6,p.p,out,0));await p.check();owned.push(s);return s;
  };
  const lock=async(s)=>{
    const p=await guard(124);await words(p.p,Array(31).fill(0));await write(p.p,124);
    await ok(com('Lock7',s,25,0,p.p,1,0));await p.check();
    eq(await read(p.p+84),32,'Lock format');
    return {p:await read(p.p+36),pitch:await read(p.p+16)};
  };
  const unlock=s=>ok(com('Unlock7',s,32,0));
  const fill=async(s,w,h,colors)=>{
    const l=await lock(s);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const c=Array.isArray(colors[0])?colors[y*w+x]:colors;
      await write(l.p+y*l.pitch+x*4,0xff000000|(c[0]<<16)|(c[1]<<8)|c[2]);
    }
    await unlock(s);
  };
  const texture=await surface(4,2,0x1800),alternate=await surface(4,2,0x1800);
  await fill(texture,4,2,config.a);await fill(alternate,4,2,config.b);
  const tex=await acquire(out=>com('QI Texture2',texture,0,iidTex2,out));owned.push(tex);
  const alt=await acquire(out=>com('QI alternate Texture2',alternate,0,iidTex2,out));owned.push(alt);
  const targets=[];
  for(let i=0;i<2;i++){
    const rt=await surface(12,8,0x2840);
    const device=await acquire(out=>com('CreateDevice3',d3d,8,hal,rt,out,0));owned.push(device);
    const dev2=await acquire(out=>com('QI Device2',device,0,iidDev2,out));owned.push(dev2);
    const vp=await acquire(out=>com('CreateViewport3',d3d,6,out,0));owned.push(vp);
    await ok(com('AddViewport3',device,5,vp));
    const material=await acquire(out=>com('CreateMaterial3',d3d,5,out,0));owned.push(material);
    const handle=async(obj,dev,slot)=>{
      const p=await guard(4);await ok(com('GetHandle',obj,slot,dev,p.p));await p.check();return read(p.p);
    };
    targets.push({rt,device,dev2,vp,material,th:await handle(tex,dev2,3),ah:await handle(alt,dev2,3),
      mh:await handle(material,device,5)});
  }
  evidence.targets=targets;
  const viewport=async(t,rect)=>{
    const p=await guard(44);await words(p.p,[44,...rect,bits(6),bits(4),bits(6),bits(4),0,bits(1)]);
    await ok(com('SetViewport',t.vp,5,p.p));await p.check();
    await ok(com('SetCurrentViewport3',t.device,12,t.vp));
  };
  const material=async(t,th,color)=>{
    const p=await guard(80);await words(p.p,Array(20).fill(0));await write(p.p,80);
    for(let i=0;i<4;i++)await write(p.p+4+4*i,bits(i===3?1:color[i]/255));
    await write(p.p+72,th);await ok(com('SetMaterial3',t.material,3,p.p));await p.check();
    const out=await guard(80);await write(out.p,80);await ok(com('GetMaterial3',t.material,4,out.p));await out.check();
    eq(await read(out.p+72),th,'material texture handle readback');
  };
  const background=async(t,h)=>{
    await ok(com('SetBackground',t.vp,8,h));
    const a=await guard(4),b=await guard(4);await ok(com('GetBackground',t.vp,9,a.p,b.p));
    await a.check();await b.check();eq(await read(a.p),h,'background handle');eq(await read(b.p),h?1:0,'background valid');
  };
  // GPU clear intentionally declines targets it has never drawn. Prime each
  // target with a real public TL draw so these runs actually test GPU clears.
  const prime=async(t)=>{
    await viewport(t,config.full);
    for(const [s,v] of [[7,0],[14,0],[22,1],[26,0],[27,0],[137,0]])await ok(com('SetRenderState3',t.device,22,s,v));
    await ok(com('stage0 diffuse',t.device,40,0,1,2));await ok(com('stage0 arg',t.device,40,0,2,0));
    await ok(com('disable stage1',t.device,40,1,1,1));
    const p=await alloc(96);
    for(const [i,[x,y]] of [[-4,-4],[32,-4],[-4,24]].entries())
      await words(p+i*32,[bits(x),bits(y),bits(.5),bits(1),0xff0b1621,0,0,0]);
    await ok(com('BeginScene3',t.device,9));await ok(com('DrawPrimitive3 prime',t.device,28,4,0x1c4,p,3,0));
    await ok(com('EndScene3',t.device,10));const l=await lock(t.rt);await unlock(t.rt);
  };
  for(const t of targets)await prime(t);
  let clears=0,textureClears=0;
  const observe=async(label,t,colors,rect=config.full,outside=config.outside)=>{
    await viewport(t,rect);
    await ok(com('Clear background',t.vp,12,0,0,1));clears++;if(Array.isArray(colors[0]))textureClears++;
    const l=await lock(t.rt),actual=[];
    for(let y=0;y<8;y++)for(let x=0;x<12;x++){
      const v=await read(l.p+y*l.pitch+x*4);actual.push(v>>>16&255,v>>>8&255,v&255,255);
    }
    await unlock(t.rt);
    const expected=(0,eval)('('+config.oracle+')')(colors,rect,outside);
    const row={label,device:t.device,rect,actual,expected};evidence.observations.push(row);
    if(!config.noPreview){
      const f=document.createElement('figure'),c=document.createElement('canvas'),cap=document.createElement('figcaption');
      f.style.cssText='display:inline-block;margin:8px';c.width=12;c.height=8;c.style.cssText='width:240px;height:160px;image-rendering:pixelated';
      c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(actual),12,8),0,0);cap.textContent=label;f.append(cap,c);document.body.append(f);
    }
    eq(actual,expected,'PIXEL ORACLE '+label);
  };
  const [a,b]=targets;
  await material(a,a.th,[255,255,255]);await background(a,a.mh);
  await observe('4x2 texture beats white diffuse',a,config.a);
  await material(a,a.th,[255,0,255]);await observe('diffuse mutation preserves texture',a,config.a);
  await fill(texture,4,2,config.b);await observe('Lock Unlock texture mutation',a,config.b);
  await material(a,a.ah,[0,255,255]);await observe('material switches texture',a,config.b);
  await material(a,0,[255,0,255]);await observe('texture removed uses diffuse',a,[255,0,255]);
  await material(a,a.th,[255,255,255]);await fill(texture,4,2,config.a);
  await fill(a.rt,12,8,config.outside);await observe('inset viewport preserves outside',a,config.a,config.inset);
  // Device3 rejects viewport rectangles beyond its target. Clip coverage here
  // is the supported inset rectangle, not an invented offscreen API promise.
  await material(b,b.ah,[255,255,255]);await background(b,b.mh);
  await observe('second device independently acquired handles',b,config.b);
  await observe('first device remains independent',a,config.a);
  await material(b,0,[0,255,255]);await observe('second device removal',b,[0,255,255]);
  await observe('first device unaffected by second removal',a,config.a);
  await background(a,0);await background(a,a.mh);
  await observe('background restored after removal',a,config.a);
  if(mode!=='software'){
    if(mode==='worker')await until(()=>getStats()?.stats.clears+getStats()?.stats.textureClears===clears,'Worker clear stats');
    const stats=getGpu()?getGpu().snapshot():getStats().stats;
    evidence.stats=stats;eq(stats.clears+stats.textureClears,clears,'every clear executed on GPU');
    eq(stats.textureClears,textureClears,'every textured clear executed on GPU');
    eq(stats.fallbacks,0,'no fallback');eq(stats.errors,0,'no GPU errors');check(stats.syncs>0,'actual readback');
    if(getGpu()){
      const t=[...getGpu().targets.values()][0],gl=t.device.gpu.gl,ext=gl.getExtension('WEBGL_debug_renderer_info');
      evidence.backend={version:gl.getParameter(gl.VERSION),renderer:gl.getParameter(gl.RENDERER),
        unmaskedRenderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null};
    }else{evidence.backend={version:getStats().stats.glVersion,renderer:getStats().stats.glRenderer};check(transport.batches.length>0,'actual queued batches');}
  }
  for(const t of targets){await background(t,0);await ok(com('DeleteViewport3',t.device,6,t.vp));}
  for(const obj of owned.reverse())await com('Release',obj,2);
  await com('Release d3d',d3d,2);await com('Release dd',dd,2);
  evidence.status='PASS';return evidence;
}

function fixtureSource() {
  let s=browserFixture.toString();
  const start=s.indexOf('    const iidDD7='),end=s.indexOf('\n  }finally{',start);
  assert(start>0&&end>start,'public helper seams');
  s=s.slice(0,start)+`    return await (${backgroundBody.toString()})({config,mode,evidence,memory,raw,read,write,words,wa,alloc,guard,guid,com,ok,acquire,invoke,check,eq,until,getGpu:()=>gpu,getStats:()=>lastStats,transport});`+s.slice(end);
  s=s.replace("new Uint8Array(await (await fetch('/test/binaries/calc.exe')).arrayBuffer())",'new Uint8Array(config.pe)');
  return s;
}
function controls() {
  const p=plan(),pixels=oracle(p.a,p.full,p.outside);
  assert.deepEqual(pixels.slice(0,4),[240,16,32,255]);assert.deepEqual(pixels.slice(-4),[160,80,224,255]);
  assert.notDeepEqual(pixels,oracle([255,255,255],p.full,p.outside));
  new (require('node:vm').Script)('('+fixtureSource()+')');
  return {status:'OFFLINE ONLY',cases:11,peSha256:sha(makeFixture()),fixtureSha256:sha(fixtureSource())};
}
async function runtime() {
  controls();const dir=process.env.D3DIM_BACKGROUND_EVIDENCE,moduleDir=process.env.D3DIM_BACKGROUND_MODULE_DIR;
  assert(dir&&moduleDir,'D3DIM_BACKGROUND_EVIDENCE and D3DIM_BACKGROUND_MODULE_DIR required');fs.mkdirSync(dir,{recursive:true});
  const result={status:'RUNNING',startedAt:new Date().toISOString(),plan:plan(),controls:controls(),modules:[],results:[]};
  const scripts=['region-map.generated','gl-command-stream','d3d-command-stream','guest-rpc','guest-thread-host',
    'render-worker','gpu-backend','d3d9-shader','d3d-shader-ir','d3d9-fixed','d3d9-texture','render-clear','d3d9-backend','d3dim-gpu'];
  let wasm,server,browser,page;
  try{
    server=await require('./static-server').startStaticServer({root:ROOT,crossOriginIsolated:true,handleRequest(req,res){
      res.setHeader('Cross-Origin-Opener-Policy','same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
      if(req.url==='/legacy-render.wasm'){res.writeHead(200,{'Content-Type':'application/wasm'});res.end(wasm);return true;}
      if(req.url==='/fixture'){res.writeHead(200,{'Content-Type':'text/html'});res.end(scripts.map(n=>'<script src="/lib/'+n+'.js"></script>').join('\n'));return true;}return false;
    }});
    browser=await require('puppeteer').launch({headless:true,executablePath:process.env.CHROME||'/usr/bin/google-chrome',
      args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:120000});
    result.browser=await browser.version();result.browserPid=browser.process().pid;
    browser.process().once('exit',(code,signal)=>result.browserExit={code,signal});
    const config={...plan(),pe:Array.from(makeFixture()),imageBase:0x400000,oracle:oracle.toString(),
      thunkBase:require('../lib/region-map.generated').BASE.THUNK_BASE,
      factoryId:require('../src/api_table.json').find(x=>x.name==='DirectDrawCreateEx').id};
    for(const name of ['wine-assembly.wasm','wine-assembly.compat.wasm']){
      wasm=fs.readFileSync(path.join(moduleDir,name));result.modules.push({name,sha256:sha(wasm),bytes:wasm.length});
      for(const mode of ['software','webgl','worker']){
        page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/fixture');
        const row=await page.evaluate(Function('return ('+fixtureSource()+')')(),mode,config,oracle.toString());
        result.results.push({module:name,...row});await page.screenshot({path:path.join(dir,name+'-'+mode+'.png'),fullPage:true});
        await page.close();page=null;console.log('PASS',name,mode,row.observations.length);
      }
    }
    result.status='PASS';
  }catch(error){result.status='FAIL';result.error=error.stack;
    if(page){result.partial=await page.evaluate(()=>globalThis.legacyTextureEvidence).catch(()=>null);await page.screenshot({path:path.join(dir,'failure.png'),fullPage:true}).catch(()=>{});}throw error;
  }finally{
    if(browser)await browser.close();if(server)await require('./static-server').closeServer(server);
    result.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(dir,'runtime.json'),JSON.stringify(result,null,2)+'\n');
  }
}
if(require.main===module){if(process.argv.includes('--plan'))console.log(JSON.stringify(controls()));else runtime().catch(e=>{console.error(e);process.exitCode=1;});}
module.exports={oracle,plan,fixtureSource,controls};
