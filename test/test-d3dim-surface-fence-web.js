#!/usr/bin/env node
'use strict';

// Public x86 COM calls on both shipped modules and the owning render Worker.
// SURFACE_FENCE_EVIDENCE retains native words, descriptor bytes and HRESULTs.
async function surfaceFenceFixture(c) {
  const {mode,evidence,eq,read,alloc,write,words,guard,guid,com,ok,acquire,
    dd,hal,unlock,bits,countDraw}=c;
  const report=evidence.surfaceFence={width:8,height:8,bpp:16,masks:[0xf800,0x7e0,31],cases:[]};
  const iidD3D=await guid([0xf5049e77,0x11d24861,0xa00007a4,0xa82906c9]);
  const d3d=await acquire(out=>com('QI fence D3D7',dd,0,iidD3D,out));
  // GetSurfaceDesc/Lock/SetSurfaceDesc use the ABI of the queried interface,
  // even when all wrappers refer to the same underlying Surface7 allocation.
  const versions=[
    [3,108,[0xda044e00,0x11d069b2,0xaa00d5a1,0xbbdfb800]],
    [4,124,[0x0b2b8630,0x11d0ad35,0x6000a68e,0x5bea9797]],
    [7,124,[0x06675a80,0x11d23b9b,0x60002fb9,0x5bea9797]],
  ];
  const snapshot=async(p,n)=>{const a=[];for(let i=0;i<n;i+=4)a.push(await read(p+i));return a;};
  const repeated=(v,n)=>Array(n).fill(v>>>0);
  for(const [version,size,iidWords] of versions) {
    const row={version,size};report.cases.push(row);
    const desc=await guard(124);await words(desc.p,Array(31).fill(0));
    for(const [off,v] of [[0,124],[4,0x1007],[8,8],[12,8],[72,32],[76,0x40],[84,16],
      [88,0xf800],[92,0x7e0],[96,31],[104,0x2840]])await write(desc.p+off,v);
    const rt=await acquire(out=>com('CreateSurface7 fence',dd,6,desc.p,out,0));await desc.check();
    const iid=await guid(iidWords),view=await acquire(out=>com('QI fence Surface'+version,rt,0,iid,out));
    const device=await acquire(out=>com('CreateDevice7 fence',d3d,4,hal,rt,out));
    const viewport=await alloc(24);await words(viewport,[0,0,8,8,bits(0),bits(1)]);
    await ok(com('SetViewport7 fence',device,13,viewport));
    for(const [id,v] of [[7,0],[9,1],[14,0],[15,0],[22,1],[27,0],[28,0],[41,0],[137,0]])
      await ok(com('SetRenderState7 fence '+id,device,20,id,v));
    await ok(com('SetTexture7 fence',device,35,0,0));
    for(const [id,v] of [[1,2],[2,0],[4,2],[5,0]])
      await ok(com('SetTextureStageState7 fence '+id,device,37,0,id,v));
    await ok(com('Disable stage1 fence',device,37,1,1,1));
    const vertices=await alloc(96);
    const draw=async color=>{
      for(const [i,[x,y]] of [[-8,-8],[24,-8],[-8,24]].entries())
        await words(vertices+i*32,[bits(x),bits(y),bits(.5),bits(1),color,0,0,0]);
      await ok(com('BeginScene7 fence',device,5));
      await ok(com('DrawPrimitive7 fence',device,25,4,0x1c4,vertices,3,0));countDraw();
      await ok(com('EndScene7 fence',device,6));
    };
    const lock=async()=>{
      await words(desc.p,Array(31).fill(0));await write(desc.p,size);
      await ok(com('Lock Surface'+version,view,25,0,desc.p,1,0));await desc.check();
      eq(await read(desc.p),size,'Lock interface descriptor size');
      return {pointer:await read(desc.p+36),pitch:await read(desc.p+16)};
    };
    const old=await lock();row.old=old;eq(old.pitch,16,'initial native16 pitch');
    await words(old.pointer,repeated(0x11111111,32));await unlock(rt);
    // Leave the public draw pending until SetSurfaceDesc. System-memory heap
    // surfaces lock eagerly; no intervening Lock may hide a missing fence.
    // The native companion test covers untouched shared lazy DIB Lock/Unlock.
    await draw(0xffff0000);
    const replacement=await guard(192);await words(replacement.p,repeated(0x12345678,48));
    const set=await guard(124);await words(set.p,Array(31).fill(0));
    for(const [off,v] of [[4,0x808],[16,24],[36,replacement.p]])await write(set.p+off,v);
    row.invalid=[];
    for(const invalid of [0,size===108?124:108,size+4]) {
      await write(set.p,invalid);
      const input=await snapshot(set.p,124);
      const hr=await com('SetSurfaceDesc invalid '+version+'/'+invalid,view,39,set.p,0);
      row.invalid.push({size:invalid,hr,input,after:await snapshot(set.p,124)});
      eq(hr,0x80070057,'invalid interface descriptor E_INVALIDARG');
      eq(row.invalid.at(-1).after,input,'rejected descriptor unchanged');await set.check();
      await words(desc.p,Array(31).fill(0));await write(desc.p,size);
      await ok(com('GetSurfaceDesc after rejection',view,22,desc.p));await desc.check();
      // GetSurfaceDesc does not expose lpSurface; Lock does. Avoid Lock here
      // because it would introduce an extra synchronization opportunity.
      eq(await read(desc.p),size,'GetSurfaceDesc interface size after rejection');
      eq(await read(desc.p+16),old.pitch,'rejection preserves old pitch');
    }
    row.oldBeforeReplacement=await snapshot(old.pointer,128);
    if(mode!=='software')eq(row.oldBeforeReplacement,repeated(0x11111111,32),'no readback before valid replacement');
    await write(set.p,size);row.input=await snapshot(set.p,124);
    row.hr=await com('SetSurfaceDesc valid '+version,view,39,set.p,0);eq(row.hr,0,'valid replacement HRESULT');
    eq(await snapshot(set.p,124),row.input,'valid input descriptor unchanged');await set.check();
    // No Lock or other synchronizing API intervenes before this observation.
    row.oldAfterReplacement=await snapshot(old.pointer,128);
    eq(row.oldAfterReplacement,repeated(0xf800f800,32),'replacement completes OLD native16 backing');
    row.newBeforeDraw=await snapshot(replacement.p,192);
    eq(row.newBeforeDraw,repeated(0x12345678,48),'replacement preserves caller content including padding');
    let current=await lock();eq(current,{pointer:replacement.p,pitch:24},'public Lock exposes new pointer and pitch');
    await unlock(rt);
    await words(old.pointer,repeated(0x34563456,32));
    await draw(0xff00ff00);current=await lock();
    row.newAfterDraw=await snapshot(current.pointer,192);await unlock(rt);
    const expected=[];for(let y=0;y<8;y++)expected.push(...repeated(0x07e007e0,4),...repeated(0x12345678,2));
    eq(row.newAfterDraw,expected,'new backing receives green pixels and preserves padded rows');
    await replacement.check();
    for(const [name,obj] of Object.entries({device,view,rt}))await com('Release fence '+name,obj,2);
    row.oldAfterRetirement=await snapshot(old.pointer,128);
    eq(row.oldAfterRetirement,repeated(0x34563456,32),'later draw and lifetime fences preserve reused old allocation');
  }
  await com('Release fence D3D7',d3d,2);
}

async function runtime() {
  const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
  const assert=require('assert/strict'),puppeteer=require('puppeteer'),base=require('./test-legacy-texture-rendered-contract');
  const root=path.resolve(__dirname,'..'),out=process.env.SURFACE_FENCE_EVIDENCE;
  const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
  if(out)fs.mkdirSync(out,{recursive:true});
  const pe=fs.readFileSync(path.join(root,'test/binaries/calc.exe'));
  const config={...base.plan(),immediate:true,noPreview:true,
    immediateSource:surfaceFenceFixture.toString(),
    imageBase:pe.readUInt32LE(pe.readUInt32LE(0x3c)+52),thunkBase:require('../lib/region-map.generated').BASE.THUNK_BASE,
    factoryId:require('../src/api_table.json').find(x=>x.name==='DirectDrawCreateEx').id};
  const scripts=['region-map.generated','gl-command-stream','d3d-command-stream','guest-rpc','guest-thread-host','render-worker',
    'gpu-backend','d3d9-shader','d3d-shader-ir','d3d9-fixed','d3d9-texture','render-clear','d3d9-backend','d3dim-gpu'];
  const evidence={startedAt:new Date().toISOString(),source:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
    fixture:hash(fs.readFileSync(__filename)),calc:hash(pe),results:[],
    productionJS:Object.fromEntries(scripts.map(n=>['lib/'+n+'.js',hash(fs.readFileSync(path.join(root,'lib',n+'.js')))]))};
  let wasm,server,browser,page,timer,browserClosed;
  try {
    server=await require('./static-server').startStaticServer({root,crossOriginIsolated:true,handleRequest(req,res){
      if(req.url==='/legacy-render.wasm'){res.setHeader('Content-Type','application/wasm');res.end(wasm);return true;}
      if(req.url==='/surface-fence-fixture'){res.setHeader('Content-Type','text/html');res.end(scripts.map(n=>'<script src="/lib/'+n+'.js"></script>').join('\n'));return true;}
      return false;
    }});
    browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME||puppeteer.executablePath(),
      args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    evidence.browser=await browser.version();const child=browser.process();evidence.process={pid:child.pid};
    child.once('exit',(code,signal)=>evidence.process.exit={code,signal});
    browserClosed=new Promise(resolve=>child.once('close',(code,signal)=>{evidence.process.close={code,signal};resolve();}));
    for(const name of ['stdout','stderr'])if(child[name]){child[name].once('end',()=>{evidence.process[name+'EOF']=true;});child[name].resume();}
    timer=setTimeout(()=>{evidence.deadlineExceeded=true;browser.close().catch(()=>{});},120000);
    for(const name of (process.env.SURFACE_FENCE_MODULES||'wine-assembly.wasm,wine-assembly.compat.wasm').split(',')) {
      wasm=fs.readFileSync(path.join(process.env.SURFACE_FENCE_MODULE_DIR||path.join(root,'build'),name));
      for(const mode of (process.env.SURFACE_FENCE_MODES||'software,webgl,worker').split(',')) {
        page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/surface-fence-fixture');
        let result,error;try{result=await page.evaluate(base.browserFixture,mode,config,base.oracle.toString());}catch(e){error=String(e);}
        const partial=error?await page.evaluate(()=>globalThis.legacyTextureEvidence):null;
        evidence.results.push({name,moduleHash:hash(wasm),mode,result,error,partial});await page.close();page=null;
        assert(!error,error);console.log('PASS public COM Surface3/4/7 backing replacement '+name+' '+mode);
      }
    }
    evidence.status='PASS';
  }catch(e){evidence.status='FAIL';evidence.error=e.stack;throw e;}
  finally {
    clearTimeout(timer);if(page)await page.close();if(browser){await browser.close();await browserClosed;}
    if(server)await require('./static-server').closeServer(server);
    evidence.finishedAt=new Date().toISOString();
    if(out)fs.writeFileSync(path.join(out,'pixels.json'),JSON.stringify(evidence,null,2)+'\n');
    if(browser&&!evidence.deadlineExceeded)assert.deepEqual(evidence.process.exit,{code:0,signal:null},'normal browser exit');
  }
}
if(require.main===module)runtime().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={surfaceFenceFixture,runtime};
