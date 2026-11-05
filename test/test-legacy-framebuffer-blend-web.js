#!/usr/bin/env node
// Run: CHROME=/path/to/chrome FRAMEBUFFER_EVIDENCE=scratch/runs/<id>/render node test/test-legacy-framebuffer-blend-web.js
// DX6.1 imref_15ic.htm supplies paired factors and RGBA factor equations;
// ddref_5n3r.htm defines stored alpha. Retained primary topics and causal
// baselines: docs/re-notes/legacy-framebuffer-blend-20261105.md.
// Native 16-bit target contract: docs/re-notes/legacy-alpha16-target-20261105.md.
// FRAMEBUFFER_TARGETS selects rgb,alpha,destination,a1,a4,x1,rgb565.
// FRAMEBUFFER_PROBE checks public creation/Lock only; FRAMEBUFFER_BASELINE
// retains mismatches without claiming rendered success.
'use strict';

// Serialized into the existing real public x86 COM harness. SDK equations
// are independent of renderer descriptors, shaders and blend helpers.
async function framebufferFixture(c,alphaTarget=false,options={}) {
  const {mode,negative,evidence,check,eq,read,alloc,write,words,guard,guid,
    com,ok,acquire,dd,hal,surface,lock:lock32,unlock,bits,observe:observe32,use,initial,countDraw,queue}=c;
  const observe=observe32;
  const targetName=alphaTarget;
  const native16={a1:[0x41,16,0x7c00,0x3e0,31,0x8000],a4:[0x41,16,0xf00,0xf0,15,0xf000],
    x1:[0x40,16,0x7c00,0x3e0,31,0],rgb565:[0x40,16,0xf800,0x7e0,31,0]}[targetName];
  if(native16)alphaTarget=!!native16[5];
  const pf=native16||[alphaTarget?0x41:0x40,32,0xff0000,0xff00,0xff,alphaTarget?0xff000000:0];
  const shifts=pf.slice(2).map(mask=>{let n=0;while(mask&&!(mask&1)){n++;mask>>>=1;}return n;});
  const widths=pf.slice(2).map(mask=>{let n=0;while(mask){n+=mask&1;mask>>>=1;}return n;});
  // Native storage uses the most significant channel bits. Decode the
  // retained bits by replication, independently of production format code.
  const encode=rgba=>rgba.reduce((v,b,i)=>v|((b>>>(8-widths[i]))<<shifts[i]),0)&0xffff;
  const decode=p=>widths.map((n,i)=>{if(!n)return 255;const v=(p&pf[i+2])>>>shifts[i];
    return n===1?v*255:n===4?v*17:n===5?(v*8+Math.floor(v/4)):v*4+Math.floor(v/16);});
  const quantize=rgba=>native16?decode(encode(rgba)):rgba;
  const lock=async obj=>{if(!native16)return lock32(obj);const d=await guard(124);
    await words(d.p,Array(31).fill(0));await write(d.p,124);
    await ok(com('Lock Surface7 native framebuffer',obj,25,0,d.p,1,0));await d.check();
    for(const [i,v] of pf.entries())eq(await read(d.p+[76,84,88,92,96,100][i]),v,'native Lock format');
    return {pointer:await read(d.p+36),pitch:await read(d.p+16)};};
  const report=evidence.framebufferBlend={pixels:[],held:[],formats:[],mismatches:[],target:targetName};
  const iid=await guid([0xbb223240,0x11d0e72b,0xaa00b4a9,0x3e99c000]);
  const d3d=await acquire(out=>com('QI IDirect3D3 framebuffer',dd,0,iid,out));
  let rt;
  if(alphaTarget||native16){
    const d=await alloc(124);await words(d,Array(31).fill(0));
    for(const [off,v] of [[0,124],[4,0x1007],[8,8],[12,8],[72,32],...pf.map((v,i)=>[[76,84,88,92,96,100][i],v]),[104,0x2840]])await write(d+off,v);
    rt=await acquire(out=>com('CreateSurface alpha framebuffer',dd,6,d,out,0));
  }else rt=await surface(8,8,0x2840);
  const device=await acquire(out=>com('CreateDevice3 framebuffer',d3d,8,hal,rt,out,0));
  if(native16){const iid7=await guid([0xf5049e77,0x11d24861,0xa00007a4,0xa82906c9]);
    const d7=await acquire(out=>com('QI IDirect3D7 native target',dd,0,iid7,out));
    const dev7=await acquire(out=>com('CreateDevice7 native target',d7,4,hal,rt,out));
    report.devicePaths={device3:device,device7:dev7};
    await com('Release probe Device7',dev7,2);await com('Release probe D3D7',d7,2);}
  const viewport=await acquire(out=>com('CreateViewport3 framebuffer',d3d,6,out,0));
  const vp=await alloc(44);await words(vp,[44,0,0,8,8,bits(-1),bits(1),bits(2),bits(2),bits(0),bits(1)]);
  await ok(com('AddViewport3 framebuffer',device,5,viewport));
  await ok(com('SetViewport2 framebuffer',viewport,17,vp));
  await ok(com('SetCurrentViewport3 framebuffer',device,12,viewport));
  const rs=(id,value)=>ok(com('SetRenderState3 framebuffer '+id,device,22,id,value));
  const get=async id=>{const out=await guard(4);await ok(com('GetRenderState3 framebuffer '+id,device,21,id,out.p));await out.check();return read(out.p);};
  for(const [id,value] of [[1,0],[7,0],[14,0],[15,0],[22,1],[26,0],[27,1],[28,0],[41,0],[137,0]])await rs(id,value);
  const desc=await guard(124);await write(desc.p,124);
  await ok(com('GetSurfaceDesc framebuffer',rt,22,desc.p));await desc.check();
  const format={flags:await read(desc.p+76),bits:await read(desc.p+84),masks:await Promise.all([88,92,96,100].map(o=>read(desc.p+o))),alphaMask:await read(desc.p+100)};
  report.formats.push(format);eq(format.flags&1,alphaTarget?1:0,'public target alpha flag');eq(format.alphaMask,pf[5],'public target alpha mask');eq(format.bits,pf[1],'public target bits');eq(format.masks,pf.slice(2),'public target masks');
  const caps=await guard(252),hel=await guard(252);await write(caps.p,252);await write(hel.p,252);
  await ok(com('GetCaps3 framebuffer',device,3,caps.p,hel.p));await caps.check();await hel.check();
  report.caps=[];for(const off of [60,64,116,120]){const value=await read(caps.p+off);report.caps.push({off,value});eq(value,0x1fff,'advertised framebuffer blend masks unchanged');}
  if(options.probeOnly){const l=await lock(rt);report.lock=l;await unlock(rt);
    await com('Release probe viewport',viewport,2);await com('Release probe device',device,2);
    await com('Release probe target',rt,2);await com('Release probe D3D3',d3d,2);use(initial);return;}
  const src=[51,153,204],dst=native16?quantize([180,45,90,255]).slice(0,3):[180,45,90];
  const packed=(rgb,a)=>(a*0x1000000+(rgb[0]<<16)+(rgb[1]<<8)+rgb[2])>>>0;
  const vertices=await alloc(96),indices=await alloc(8);await words(indices,[0x00010000,2]);
  let serial=0,destinationAlpha;
  async function geometry(alpha){for(const [i,[x,y]] of [[-8,-8],[24,-8],[-8,24]].entries())
    await words(vertices+i*32,[bits(x),bits(y),bits(.5),bits(1),packed(src,alpha),0,0,0]);}
  async function clear(x){destinationAlpha=native16&&alphaTarget?quantize([...dst,x])[3]:x;
    const l=await lock(rt);const a=negative==='opaque-target'?255:x;
    if(native16){const pixel=encode([...dst,a])|(targetName==='x1'&&x>=128?0x8000:0);for(let y=0;y<8;y++)for(let col=0;col<8;col+=2)
      await write(l.pointer+y*l.pitch+col*2,pixel|(pixel<<16));}
    else for(let y=0;y<8;y++)for(let col=0;col<8;col++)await write(l.pointer+y*l.pitch+col*4,packed(dst,a));
    await unlock(rt);}
  async function draw(sf,df){
    if(negative==='old-both'&&(sf===12||sf===13))await rs(19,2); // old software default ONE, destination unchanged
    await ok(com('BeginScene3 framebuffer',device,9));
    if(serial++%2)await ok(com('DrawIndexedPrimitive3 framebuffer',device,29,4,0x1c4,vertices,3,indices,3,0));
    else await ok(com('DrawPrimitive3 framebuffer',device,28,4,0x1c4,vertices,3,0));
    countDraw();await ok(com('EndScene3 framebuffer',device,10));
  }
  function expected(sf,df,a,reject=false){
    if(reject)return dst.slice();
    let s=sf,d=df;if(s===12){s=5;d=6;}if(s===13){s=6;d=5;}
    const factor=(f,i)=>f===1?0:f===2?255:f===5?a:f===6?255-a:f===7?destinationAlpha:f===8?255-destinationAlpha:f===11?Math.min(a,255-destinationAlpha):(()=>{throw Error('unplanned factor '+f);})();
    return src.map((v,i)=>{const n=v*factor(s,i)+dst[i]*factor(d,i);check(n%255===0,'oracle avoids rounding ambiguity');return Math.min(255,n/255);});
  }
  async function witness(label,sf,df,a,reject=false){const rgb=expected(sf,df,a,reject);use({device,rt});
    if(native16){
      let s=sf,d=df;if(s===12){s=5;d=6;}if(s===13){s=6;d=5;}
      const f=v=>v===1?0:v===2?255:v===5?a:v===6?255-a:v===7?destinationAlpha:v===8?255-destinationAlpha:v===11?255:0;
      const alphaValue=reject?destinationAlpha:(a*f(s)+destinationAlpha*f(d))/255;
      const alpha=Math.min(255,Math.floor(alphaValue+.5));
      eq(quantize([...rgb,Math.min(255,Math.floor(alphaValue))])[3],
        quantize([...rgb,Math.min(255,Math.ceil(alphaValue))])[3],
        'native alpha storage independent of byte rounding');
      const expectedRGBA=quantize([...rgb,alpha]),l=await lock(rt);
      const raw=(await read(l.pointer+2*l.pitch+2*2))&65535,actual=decode(raw);await unlock(rt);
      const row={label,sf,df,source:src,sourceAlpha:a,destination:dst,destinationAlpha,expected:expectedRGBA,actual,raw,reject};
      report.pixels.push(row);evidence.observations.push(row);
      if(report.pixels.length<=6){const el=document.createElement('pre');
        el.textContent=targetName+' '+label+' raw=0x'+raw.toString(16)+' expected='+expectedRGBA+' actual='+actual;
        el.style.borderLeft='24px solid rgb('+actual.slice(0,3).join(',')+')';document.body.append(el);}
      const channels=alphaTarget?4:3;
      for(let i=0;i<channels;i++)if(actual[i]!==expectedRGBA[i])report.mismatches.push({...row,channel:i});
      if(!options.baseline)eq(actual.slice(0,channels),expectedRGBA.slice(0,channels),'PIXEL ORACLE '+label);
      return;
    }
    await observe(label,{name:'independent SDK framebuffer equation',uv:[.25,.25]}, {filter:1,address:1,rgbOnly:true,palette:[rgb,rgb,rgb,rgb]});
    const row={label,sf,df,source:src,sourceAlpha:a,destination:dst,destinationAlpha,expected:rgb,reject};report.pixels.push(row);
    if(alphaTarget){
      let s=sf,d=df;if(s===12){s=5;d=6;}if(s===13){s=6;d=5;}
      const f=v=>v===1?0:v===2?255:v===5?a:v===6?255-a:v===7?destinationAlpha:v===8?255-destinationAlpha:v===11?255:0;
      const n=a*f(s)+destinationAlpha*f(d);check(reject||n%255===0,'alpha oracle avoids rounding ambiguity');
      row.expectedAlpha=reject?destinationAlpha:Math.min(255,n/255);
      const l=await lock(rt);row.actualAlpha=(await read(l.pointer+2*l.pitch+2*4))>>>24;await unlock(rt);
      eq(row.actualAlpha,row.expectedAlpha,'ALPHA PIXEL ORACLE '+label);
      const last=evidence.observations.at(-1);if(last.webglRGBA)eq(last.webglRGBA[3],row.expectedAlpha,'independent GPU ALPHA PIXEL ORACLE '+label);
    }
  }
  const destinationProbe=alphaTarget==='destination'||!!native16;
  const cases=native16?(alphaTarget?(negative==="opaque-target"?[[7,1]]:[[2,1],[1,2],[7,1],[8,1],[11,1]]):[[2,1],[1,2],[5,1]]):destinationProbe?[[7,1],[8,1],[11,1]]:[[2,1],[1,2],[5,6],[6,5],[12,1],[12,2],[13,1],[13,2]];
  for(const a of (native16?(negative==="opaque-target"?[255]:[0,85,170,255]):destinationProbe?[255]:[85,170,0,255]))for(const [sf,df] of cases)for(const x of (native16?(targetName==='a1'||targetName==='x1'?[0,255]:[85,170]):destinationProbe?[85,170]:alphaTarget?[33+a%3,186+a%3]:[17,231])){
    await clear(x);await geometry(a);await rs(20,df);await rs(19,sf);
    eq(await get(19),sf,'successful public source setter raw value');eq(await get(20),df,'successful public destination setter raw value');
    await draw(sf,df);await witness('factor '+sf+'/'+df+' alpha '+a+(alphaTarget?' destination alpha ':' X ')+x,sf,df,a);
  }
  if(native16&&alphaTarget&&negative!=='opaque-target'){
    for(const a of [127,128]){await clear(targetName==='a1'?0:85);await geometry(a);
      await rs(19,2);await rs(20,1);await draw(2,1);await witness('native alpha quantization '+a,2,1,a);}
    await clear(targetName==='a1'?0:85);await geometry(85);await rs(19,7);await rs(20,2);await rs(27,0);
    await draw(7,2);await witness('native blending disabled',2,1,85);await rs(27,1);
  }
  if(!destinationProbe){
    await clear(alphaTarget?34:17);await geometry(85);await rs(19,5);await rs(20,6);await rs(27,0);
    await draw(5,6);await witness('blending disabled preserves source RGBA',2,1,85);await rs(27,1);
  }
  // Alpha testing precedes framebuffer blending: alpha 170 passes 128,
  // rejects 213. A mistaken opaque source-alpha path cannot pass both.
  for(const sf of (destinationProbe?[]:[12,13]))for(const ref of [128,213]){
    await clear(alphaTarget?35:17);await geometry(170);await rs(19,sf);await rs(20,2);
    await rs(15,1);await rs(24,ref);await rs(25,5);await draw(sf,2);
    await witness('source alpha test '+sf+' ref '+ref,sf,2,170,ref===213);await rs(15,0);
  }
  if(mode==='worker'&&(!native16||alphaTarget))for(const [sf,next] of (destinationProbe?[[7,13],[8,12],[11,13]]:[[12,13],[13,12],[12,5],[13,6]])){
    const heldAlpha=destinationProbe?255:85,heldDF=destinationProbe?1:2;
    await clear(targetName==='a1'?0:destinationProbe?85:alphaTarget?34:231);await geometry(heldAlpha);await rs(19,sf);await rs(20,heldDF);use({device,rt});queue.hold('paired blend '+sf);
    await draw(sf,heldDF);const packet=await queue.packet();
    const state=new DataView(packet.vertices.buffer,32,4096);
    eq(state.getUint32(332,true),sf,'held raw source blend');eq(state.getUint32(336,true),heldDF,'held raw destination blend');
    const nextDF=next===5?6:next===6?5:1;
    await rs(19,next);await rs(20,nextDF);check(queue.completed()<packet.sequence,'draw unconsumed across state changes');
    const row={sf,next,sequence:packet.sequence,completedBefore:queue.completed()};report.held.push(row);
    queue.drain();await witness('held factor '+sf+' then '+next,sf,heldDF,heldAlpha);row.completedAfter=queue.completed();
    check(row.completedAfter>=packet.sequence,'owning Worker consumed held draw');
    await clear(alphaTarget?34:17);await draw(next,nextDF);await witness('later factor '+next,next,nextDF,heldAlpha);
  }
  await com('Release framebuffer viewport',viewport,2);await com('Release framebuffer device',device,2);
  await com('Release framebuffer target',rt,2);await com('Release framebuffer D3D3',d3d,2);use(initial);
}


async function runtime() {
  const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),cp=require('node:child_process');
  const ROOT=path.resolve(__dirname,'..'),base=require('./test-legacy-texture-rendered-contract');
  const out=process.env.FRAMEBUFFER_EVIDENCE;
  assert(out,'FRAMEBUFFER_EVIDENCE must name an ignored run directory');
  fs.mkdirSync(out,{recursive:true});
  const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
  const scripts=['region-map.generated','gl-command-stream','d3d-command-stream','guest-rpc','guest-thread-host','render-worker','gpu-backend','d3d9-shader','d3d-shader-ir','d3d9-fixed','d3d9-texture','render-clear','d3d9-backend','d3dim-gpu'];
  const pe=fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'));
  const config={...base.plan(),immediate:true,
    imageBase:pe.readUInt32LE(pe.readUInt32LE(0x3c)+52),thunkBase:require('../lib/region-map.generated').BASE.THUNK_BASE,
    factoryId:require('../src/api_table.json').find(x=>x.name==='DirectDrawCreateEx').id};
  const evidence={startedAt:new Date().toISOString(),source:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),
    fixture:hash(fs.readFileSync(__filename)),calc:hash(pe),results:[],controls:[],
    productionJS:Object.fromEntries(fs.readdirSync(path.join(ROOT,'lib')).filter(n=>/\.(js|json)$/.test(n)).map(n=>['lib/'+n,hash(fs.readFileSync(path.join(ROOT,'lib',n)))]))};
  let wasm,server,browser,page,timer;
  try {
    server=await require('./static-server').startStaticServer({root:ROOT,crossOriginIsolated:true,handleRequest(req,res){
      res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
      if(req.url==='/legacy-render.wasm'){res.writeHead(200,{'Content-Type':'application/wasm'});res.end(wasm);return true;}
      if(req.url==='/legacy-render-fixture'){res.writeHead(200,{'Content-Type':'text/html'});res.end(scripts.map(n=>'<script src="/lib/'+n+'.js"></script>').join('\n'));return true;}
      return false;
    }});evidence.server=server.address();
    const puppeteer=require('puppeteer');
    browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME||await puppeteer.executablePath(),
      args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:120000});
    evidence.browser=await browser.version();evidence.endpoint=browser.wsEndpoint();
    const child=browser.process();evidence.process={pid:child.pid,profile:child.spawnargs.find(s=>s.startsWith('--user-data-dir='))?.slice(16)};
    child.once('exit',(code,signal)=>evidence.process.exit={code,signal});
    timer=setTimeout(()=>{evidence.deadlineExceeded=true;browser.close().catch(()=>{});},600000);
    for(const name of ['wine-assembly.wasm','wine-assembly.compat.wasm']) {
      wasm=fs.readFileSync(path.join(ROOT,'build',name));const moduleHash=hash(wasm);
      for(const target of (process.env.FRAMEBUFFER_TARGETS||'rgb,alpha,destination,a1,a4,x1,rgb565').split(',')) {
        config.immediateSource='async function(c){return ('+framebufferFixture.toString()+')(c,'+(target==='rgb'?'false':target==='alpha'?'true':JSON.stringify(target))+','+JSON.stringify({probeOnly:!!process.env.FRAMEBUFFER_PROBE,baseline:!!process.env.FRAMEBUFFER_BASELINE})+');}';
        for(const mode of (process.env.FRAMEBUFFER_MODES||(process.env.FRAMEBUFFER_PROBE?'software':'software,webgl,worker')).split(','))for(const negative of (process.env.FRAMEBUFFER_PROBE||process.env.FRAMEBUFFER_BASELINE||['x1','rgb565'].includes(target)?[null]:[null,['destination','a1','a4'].includes(target)?'opaque-target':'old-both'])) {
          page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/legacy-render-fixture');
          let result,error;try{result=await page.evaluate(base.browserFixture,mode,config,base.oracle.toString(),negative);}catch(e){error=String(e);}
          const partial=error?await page.evaluate(()=>globalThis.legacyTextureEvidence||null):null;
          const row={name,moduleHash,target,mode,negative,result,error,partial};(negative?evidence.controls:evidence.results).push(row);
          await page.screenshot({path:path.join(out,name+'-'+target+'-'+mode+'-'+(negative||'normal')+'.png'),fullPage:true});
          await page.close();page=null;
          if(negative) {
            assert(error?.includes('PIXEL ORACLE factor '+(negative==='opaque-target'?'7/':'12/')),'old behavior must fail independent framebuffer pixels');
            assert(partial.calls.some(c=>/^Draw(Indexed)?Primitive3 framebuffer$/.test(c.label)&&c.result===0),'negative control must execute a successful public draw');
            const pixel=partial.observations.at(-1);assert.notDeepEqual(pixel.actual,pixel.expected,'control must change pixels');
          } else assert(!error,error);
          console.log(JSON.stringify({name,target,mode,negative,error,pixels:result?.framebufferBlend?.pixels.length}));
        }
      }
    }
    evidence.status=process.env.FRAMEBUFFER_PROBE?'SUPPORTED FORMAT PROBE':process.env.FRAMEBUFFER_BASELINE?'BASELINE OBSERVATIONS':'PASS';
  } catch(e) {evidence.status='FAIL';evidence.error=e.stack;throw e;}
  finally {
    if(timer)clearTimeout(timer);if(page)await page.close();if(browser)await browser.close();
    if(server)await require('./static-server').closeServer(server);
    evidence.cleanupAt=new Date().toISOString();
    fs.writeFileSync(path.join(out,'result.json.tmp'),JSON.stringify(evidence,null,2)+'\n');
    fs.renameSync(path.join(out,'result.json.tmp'),path.join(out,'result.json'));
    if(browser&&!evidence.deadlineExceeded)assert.deepEqual(evidence.process.exit,{code:0,signal:null},'normal browser closure');
  }
}
if(require.main===module)runtime().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={framebufferFixture,runtime};

