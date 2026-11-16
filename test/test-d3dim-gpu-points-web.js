#!/usr/bin/env node
'use strict';
// POINT_PUBLIC_EVIDENCE: ordinary x86 public-COM POINTLIST checks in both
// shipped modules on the software route. No native Windows/game claim.
// The GPU route (the WAT GPU stream producer, $d3g_points) against the same
// native-pixel oracle is test-d3dim-gps-points.js.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
if (!process.env.POINT_PUBLIC_EVIDENCE) {
  console.log('SKIP  POINT_PUBLIC_EVIDENCE=<dir> not set (the non-browser point cases are test-d3dim-gps-points.js)');
} else runPublicPoints().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
async function pointPublicFixture(c,targetName,baseline=false) {
  const {mode,evidence,check,eq,read,alloc,write,words,guard,guid,com,ok,acquire,
    dd,hal,unlock,bits,use,initial,countDraw}=c;
  const pf={a1:[0x41,16,0x7c00,0x3e0,31,0x8000],a4:[0x41,16,0xf00,0xf0,15,0xf000],
    x1:[0x40,16,0x7c00,0x3e0,31,0],rgb565:[0x40,16,0xf800,0x7e0,31,0]}[targetName];
  const masks=pf.slice(2),shifts=masks.map(m=>{let n=0;while(m&&!(m&1)){m>>>=1;n++;}return n;}),
    widths=masks.map(m=>{let n=0;while(m){n+=m&1;m>>>=1;}return n;});
  const encode=color=>masks.reduce((p,m,i)=>p|(((((color>>>[16,8,0,24][i])&255) >>>(8-widths[i]))<<shifts[i])&m),0);
  const rgba=p=>masks.map((m,i)=>{if(!m)return 255;const n=widths[i],v=(p&m)>>>shifts[i];
    return n===1?v*255:n===4?v*17:n===5?v*8+Math.floor(v/4):v*4+Math.floor(v/16);});
  const report=evidence.pointStorage={target:targetName,format:pf,cases:[],mismatches:[],
    oracle:'Independent native component-mask high-bit storage; generated x86 public COM; no native Windows claim'};
  const iid=await guid([0xbb223240,0x11d0e72b,0xaa00b4a9,0x3e99c000]);
  const d3d=await acquire(out=>com('QI IDirect3D3 point',dd,0,iid,out));
  const desc=await alloc(124);await words(desc,Array(31).fill(0));
  for(const [off,v] of [[0,124],[4,0x1007],[8,8],[12,8],[72,32],...pf.map((v,i)=>[[76,84,88,92,96,100][i],v]),[104,0x2840]])await write(desc+off,v);
  const rt=await acquire(out=>com('CreateSurface point',dd,6,desc,out,0));
  const device=await acquire(out=>com('CreateDevice3 point',d3d,8,hal,rt,out,0));
  const viewport=await acquire(out=>com('CreateViewport3 point',d3d,6,out,0));
  const vp=await alloc(44);await ok(com('AddViewport3 point',device,5,viewport));
  const clip=async rect=>{await words(vp,[44,...rect,bits(-1),bits(1),bits(2),bits(2),bits(0),bits(1)]);
    await ok(com('SetViewport2 point',viewport,17,vp));await ok(com('SetCurrentViewport3 point',device,12,viewport));};
  await clip([0,0,8,8]);
  const rs=(id,v)=>ok(com('SetRenderState3 point '+id,device,22,id,v));
  for(const [id,v] of [[1,0],[7,0],[14,0],[15,0],[22,1],[26,0],[27,0],[28,0],[41,0],[137,0]])await rs(id,v);
  const lock=async()=>{const d=await guard(124);await words(d.p,Array(31).fill(0));await write(d.p,124);
    await ok(com('Lock Surface7 point',rt,25,0,d.p,1,0));await d.check();
    for(const [i,v] of pf.entries())eq(await read(d.p+[76,84,88,92,96,100][i]),v,'point native public format');
    return {pointer:await read(d.p+36),pitch:await read(d.p+16)};};
  const vertices=await alloc(96),indices=await alloc(4);await write(indices,0);
  const geometry=async(xy,color,z)=>{for(const [i,[x,y]] of xy.entries())
    await words(vertices+i*32,[bits(x),bits(y),bits(z),bits(1),color,0,0,0]);};
  const draw=async(primitive,indexed,color,z=.5,xy=[[2,2]])=>{
    await geometry(xy,color,z);await ok(com('BeginScene3 point',device,9));
    await ok(indexed?com('DrawIndexedPrimitive3 point',device,29,primitive,0x1c4,vertices,xy.length,indices,xy.length,0):
      com('DrawPrimitive3 point',device,28,primitive,0x1c4,vertices,xy.length,0));
    countDraw();await ok(com('EndScene3 point',device,10));};
  const seed=async()=>{const l=await lock(),pixels=Array.from({length:64},(_,i)=>(i*7919+0x1213)&65535);
    for(let y=0;y<8;y++)for(let x=0;x<8;x+=2)await write(l.pointer+y*l.pitch+x*2,pixels[y*8+x]|pixels[y*8+x+1]<<16);
    await unlock(rt);return pixels;};
  const observe=async(label,expected)=>{const l=await lock(),actual=[];
    for(let y=0;y<8;y++)for(let x=0;x<8;x+=2){const p=await read(l.pointer+y*l.pitch+x*2);actual.push(p&65535,p>>>16);}
    await unlock(rt);const row={label,actual,expected};report.cases.push(row);evidence.observations.push(row);
    if(JSON.stringify(actual)!==JSON.stringify(expected))report.mismatches.push(row);
    const fig=document.createElement('figure'),caption=document.createElement('figcaption');
    caption.textContent=targetName+' '+label+'; RGB tile + stored alpha tile; mismatches '+actual.filter((v,i)=>v!==expected[i]).length;
    fig.append(caption);
    for(const alpha of [false,true]){const canvas=document.createElement('canvas');canvas.width=canvas.height=8;
      canvas.style.cssText='width:128px;height:128px;image-rendering:pixelated;margin:4px';
      const pixels=actual.flatMap(p=>{const [r,g,b,a]=rgba(p);return alpha?[a,a,a,255]:[r,g,b,255];});
      canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pixels),8,8),0,0);fig.append(canvas);}
    document.body.append(fig);if(!baseline)eq(actual,expected,'POINT NATIVE ORACLE '+label);
  };
  const fill=(pixels,rect,color)=>{const v=encode(color);for(let y=rect[1];y<rect[3];y++)for(let x=rect[0];x<rect[2];x++)pixels[y*8+x]=v;};
  use({device,rt});
  for(const indexed of [false,true])for(const alpha of [0,127,128,255]){
    const expected=await seed(),color=((alpha*0x1000000)|0x004a92d3)>>>0;
    await draw(1,indexed,color);fill(expected,[2,2,4,4],color);await observe((indexed?'indexed':'direct')+' alpha '+alpha,expected);
  }
  // Existing 2x2 point footprint and viewport intersection are intentional
  // compatibility behavior, not a historical-hardware rasterization claim.
  let expected=await seed();
  await rs(15,1);await rs(25,1);await rs(24,255);await rs(27,1);await rs(19,5);await rs(20,6);
  await draw(1,true,0x00123456);fill(expected,[2,2,4,4],0x00123456);
  await observe('point alpha zero ignores NEVER alpha test and blending',expected);
  await rs(15,0);await rs(27,0);
  expected=await seed();await clip([3,3,2,2]);await draw(1,false,0x00123456);
  fill(expected,[3,3,4,4],0x00123456);await observe('viewport intersection retains all other words',expected);await clip([0,0,8,8]);
  // Near triangle creates depth; a nearer zero-alpha point passes LESS and
  // writes its depth; a farther triangle fails over both. Then a closer
  // triangle proves the triangle depth state is restored after the point.
  await seed();await rs(7,1);await rs(14,1);await rs(23,2);await rs(27,0);await rs(9,1);
  await ok(com('Clear2 point initial depth',viewport,20,0,0,2,0,bits(1),0));
  const triangle=[[-8,-8],[24,-8],[-8,24]];
  await draw(4,false,0xffff0000,.25,triangle);await draw(1,false,0x000000ff,.2);
  await draw(4,false,0xff00ff00,.5,triangle);expected=Array(64).fill(encode(0xffff0000));fill(expected,[2,2,4,4],0x000000ff);
  await observe('point leaves near triangle depth intact',expected);
  await draw(4,false,0xff00ff00,.1,triangle);await observe('next near triangle depth restored',Array(64).fill(encode(0xff00ff00)));
  await rs(7,0);await rs(14,0);await rs(27,1);await rs(19,5);await rs(20,6);
  await draw(1,true,0x00ff0000);await draw(4,false,0x000000ff,.5,triangle);
  expected=Array(64).fill(encode(0xff00ff00));fill(expected,[2,2,4,4],0x00ff0000);
  await observe('zero-alpha triangle blend restored after point overwrite',expected);
  report.renderer=c.rendererInfo();
  await com('Release point viewport',viewport,2);await com('Release point device',device,2);
  await com('Release point target',rt,2);await com('Release point D3D3',d3d,2);use(initial);
}

async function runPublicPoints() {
  const crypto=require('node:crypto'),cp=require('node:child_process');
  const ROOT=path.resolve(__dirname,'..'),base=require('./test-legacy-texture-rendered-contract');
  const sha=b=>crypto.createHash('sha256').update(b).digest('hex');

  const out=process.env.POINT_PUBLIC_EVIDENCE;assert(out);fs.mkdirSync(out,{recursive:true});
  const pe=fs.readFileSync(ROOT+'/test/binaries/calc.exe');
  const config={...base.plan(),immediate:true,imageBase:pe.readUInt32LE(pe.readUInt32LE(0x3c)+52),
    thunkBase:require(ROOT+'/lib/region-map.generated').BASE.THUNK_BASE,
    factoryId:require(ROOT+'/src/api_table.json').find(x=>x.name==='DirectDrawCreateEx').id};
  const scripts=['region-map.generated','gl-command-stream','d3d-command-stream','guest-rpc','guest-thread-host','render-worker','gpu-backend','d3d9-shader','d3d-shader-ir','render-clear','d3d9-backend'];
  const evidence={startedAt:new Date().toISOString(),source:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),
    generated:true,nativeWindows:false,media:{path:'test/binaries/calc.exe',sha256:sha(pe)},results:[],status:'RUNNING'};
  let wasm,server,browser,page,timer;
  try{
    server=await require(ROOT+'/test/static-server').startStaticServer({root:ROOT,crossOriginIsolated:true,handleRequest(req,res){
      res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
      if(req.url==='/legacy-render.wasm'){res.writeHead(200,{'Content-Type':'application/wasm'});res.end(wasm);return true;}
      if(req.url==='/point-native-fixture'){res.writeHead(200,{'Content-Type':'text/html'});res.end(scripts.map(n=>'<script src="/lib/'+n+'.js"></script>').join('\n'));return true;}
      return false;}});evidence.server=server.address();
    browser=await puppeteer.launch({headless:true,
      executablePath:process.env.CHROME||await puppeteer.executablePath(),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:120000});
    evidence.browser=await browser.version();evidence.endpoint=browser.wsEndpoint();
    const child=browser.process();evidence.process={pid:child.pid,profile:child.spawnargs.find(s=>s.startsWith('--user-data-dir='))?.slice(16)};
    child.once('exit',(code,signal)=>evidence.process.exit={code,signal});
    fs.writeFileSync(path.join(out,'live.json'),JSON.stringify(evidence,null,2)+'\n');
    timer=setTimeout(()=>{evidence.deadlineExceeded=true;browser.close().catch(()=>{});},300000);
    for(const name of ['wine-assembly.wasm','wine-assembly.compat.wasm']){
      wasm=fs.readFileSync(ROOT+'/build/'+name);
      // The ordinary software COM route must retain every native alpha bit.
      for(const target of (process.env.POINT_PUBLIC_TARGETS||'a1,a4,x1,rgb565').split(','))for(const mode of ['software']){
        config.immediateSource='async function(c){return ('+pointPublicFixture.toString()+')(c,'+JSON.stringify(target)+','+!!process.env.POINT_PUBLIC_BASELINE+');}';
        page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/point-native-fixture');
        let result,error;try{result=await page.evaluate(base.browserFixture,mode,config,base.oracle.toString());}catch(e){error=String(e);}
        const partial=error?await page.evaluate(()=>globalThis.legacyTextureEvidence||null):null;
        const capture=name+'-'+target+'-'+mode+'.png';await page.screenshot({path:path.join(out,capture),fullPage:true});await page.close();page=null;
        evidence.results.push({name,moduleHash:sha(wasm),target,mode,result,error,partial,capture});
        console.log(JSON.stringify({name,target,mode,error,mismatches:(result||partial)?.pointStorage?.mismatches?.length}));
        if(!process.env.POINT_PUBLIC_BASELINE)assert(!error,error);
      }
    }evidence.status=process.env.POINT_PUBLIC_BASELINE?'BASELINE OBSERVATIONS':'PASS';
  }catch(e){evidence.status='FAIL';evidence.error=e.stack;throw e;}
  finally{if(timer)clearTimeout(timer);if(page)await page.close();if(browser)await browser.close();if(server)await require(ROOT+'/test/static-server').closeServer(server);
    evidence.cleanupAt=new Date().toISOString();fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(evidence,null,2)+'\n');
    if(browser&&!evidence.deadlineExceeded)assert.deepEqual(evidence.process.exit,{code:0,signal:null},'normal browser closure');}
}
