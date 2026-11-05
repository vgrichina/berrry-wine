#!/usr/bin/env node
'use strict';

// DX6.1 SDK imref_789w.htm: DECAL=1/COPY=7 select texture RGBA;
// DECALALPHA=3 mixes RGB by texture alpha and preserves source alpha.
// ADD=8 saturates texture + diffuse RGB and preserves source alpha.
// Serialized unchanged into the established public x86 COM browser harness.
async function blendFixture(c) {
  const {mode,negative,evidence,check,eq,read,alloc,write,words,guard,guid,
    com,ok,acquire,dd,hal,surface,lock,unlock,bits,observe,use,initial,countDraw,queue}=c;
  const report=evidence.legacyBlend={pixels:[],rawTSS:[],queued:[]};
  const iid3=await guid([0xbb223240,0x11d0e72b,0xaa00b4a9,0x3e99c000]);
  const d3d=await acquire(out=>com('QI IDirect3D3',dd,0,iid3,out));
  const rt=await surface(8,8,0x2840);
  const device=await acquire(out=>com('CreateDevice3',d3d,8,hal,rt,out,0));
  const iid7=await guid([0xf5049e79,0x11d24861,0xa00007a4,0xa82906c9]);
  const alias=await acquire(out=>com('QI same device Device7',device,0,iid7,out));
  const viewport=await acquire(out=>com('CreateViewport3',d3d,6,out,0));
  const vp=await alloc(44);await words(vp,[44,0,0,8,8,bits(-1),bits(1),bits(2),bits(2),bits(0),bits(1)]);
  await ok(com('AddViewport3',device,5,viewport));
  await ok(com('SetViewport2',viewport,17,vp));await ok(com('SetCurrentViewport3',device,12,viewport));
  const rs=(id,v)=>ok(com('SetRenderState3 '+id,device,22,id,v));
  const tss=(id,v,stage=0)=>ok(com('SetTextureStageState3',device,40,stage,id,v));
  const getTSS=async id=>{const out=await guard(4);await ok(com('GetTextureStageState3',device,39,0,id,out.p));await out.check();return read(out.p);};
  const readRawTSS=async()=>{const values=[];for(const id of [1,2,3,4,5,6])values.push(await getTSS(id));return values;};
  const getRS=async id=>{const out=await guard(4);await ok(com('GetRenderState3',device,21,id,out.p));await out.check();return read(out.p);};
  for(const [id,v] of [[7,0],[14,0],[15,0],[22,1],[27,0],[28,0],[41,0],[137,0]])await rs(id,v);
  for(const [id,v] of [[1,4],[2,2],[3,0],[4,4],[5,2],[6,0],[16,1],[17,1],[18,0]])await tss(id,v);
  await tss(1,1,1);
  const caps=await guard(252),hel=await guard(252);await write(caps.p,252);await write(hel.p,252);
  await ok(com('GetCaps3',device,3,caps.p,hel.p));await caps.check();await hel.check();
  report.advertised=[];
  for(const offset of [84,140]){const value=await read(caps.p+offset);eq(value&0xc5,0xc5,'advertised DECAL/DECALALPHA/COPY/ADD');eq(value,0xffff,'legacy blend capability mask unchanged');report.advertised.push(value);}
  const tex=[180,45,90],diff=[51,153,255],diffAlpha=170;
  const rgba=(rgb,a)=>(a*0x1000000+(rgb[0]<<16)+(rgb[1]<<8)+rgb[2])>>>0;
  const textures=[];
  async function makeTexture(alpha,texAlpha=85,rgb=tex) {
    const desc=await alloc(124);await words(desc,Array(31).fill(0));
    for(const [off,v] of [[0,124],[4,0x1007],[8,2],[12,2],[72,32],[76,alpha?0x41:0x40],[84,32],
      [88,0xff0000],[92,0xff00],[96,0xff],[100,alpha?0xff000000:0],[104,0x1800]])await write(desc+off,v);
    const obj=await acquire(out=>com('CreateSurface texture',dd,6,desc,out,0));
    const actual=await guard(124);await write(actual.p,124);
    await ok(com('GetSurfaceDesc texture format',obj,22,actual.p));await actual.check();
    eq((await read(actual.p+76))&1,alpha?1:0,'public alpha-format flag');
    eq(await read(actual.p+100),alpha?0xff000000:0,'public alpha-format mask');
    const l=await lock(obj);for(let y=0;y<2;y++)for(let x=0;x<2;x++)await write(l.pointer+y*l.pitch+x*4,rgba(rgb,texAlpha));await unlock(obj);
    const iid=await guid([0x93281502,0x11d08cf8,0xa000ab89,0x294105c9]);
    const texture=await acquire(out=>com('QI Texture2',obj,0,iid,out));
    const out=await guard(4);await ok(com('Texture2 GetHandle',texture,3,device,out.p));await out.check();
    const handle=await read(out.p);check(handle,'real texture handle');
    const row={obj,texture,handle,alpha,texAlpha,rgb};textures.push(row);return row;
  }
  const A=await makeTexture(true),X=await makeTexture(false);
  const bind=t=>rs(1,t.handle);
  const vertices=await alloc(96);
  // Write three WORD indices using DWORD stores into an eight-byte allocation.
  const indexWords=await alloc(8);await words(indexWords,[0x00010000,2]);
  for(const [i,[x,y]] of [[-8,-8],[24,-8],[-8,24]].entries())
    await words(vertices+i*32,[bits(x),bits(y),bits(.5),bits(1),rgba(diff,diffAlpha),0,bits(.25),bits(.25)]);
  let indexed=false;
  async function draw(){await ok(com('BeginScene3',device,9));
    if(indexed)await ok(com('DrawIndexedPrimitive3',device,29,4,0x1c4,vertices,3,indexWords,3,0));
    else await ok(com('DrawPrimitive3',device,28,4,0x1c4,vertices,3,0));
    countDraw();await ok(com('EndScene3',device,10));indexed=!indexed;}
  async function clear(){const l=await lock(rt);for(let y=0;y<8;y++)for(let x=0;x<8;x++)await write(l.pointer+y*l.pitch+x*4,0);await unlock(rt);}
  // Pure independent SDK equations. All products here are integral bytes.
  function expected(blend,texture,alphaTest=false,ref=texture.alpha?128:213){
    const {alpha,rgb:tex,texAlpha}=texture;
    const a=alpha?texAlpha:255;
    const rgb=blend===8?tex.map((v,i)=>Math.min(255,v+diff[i])):blend===3?tex.map((v,i)=>(v*a+diff[i]*(255-a))/255)
      :blend===2||blend===4?tex.map((v,i)=>v*diff[i]/255):blend===0?diff.slice():tex.slice();
    const outAlpha=blend===8||blend===3||blend===0?diffAlpha:blend===2&&!alpha?diffAlpha:blend===4?a*diffAlpha/255:a;
    check(rgb.every(Number.isInteger),'fixture RGB avoids unspecified rounding');
    return alphaTest&&outAlpha<=ref?[0,0,0]:rgb;
  }
  async function witness(label,blend,texture,alphaTest=false,ref){
    const rgb=expected(blend,texture,alphaTest,ref);use({device:alias,rt});
    await observe(label,{name:'SDK independent solid blend',uv:[.25,.25]}, {filter:1,address:1,rgbOnly:true,palette:[rgb,rgb,rgb,rgb]});
    report.pixels.push({label,blend,textureAlpha:!!texture.alpha,storedAlpha:texture.texAlpha,textureRGB:texture.rgb,alphaTest,ref,expected:rgb});
  }
  async function render(label,blend,texture,alphaTest=false,ref){await clear();await draw();await witness(label,blend,texture,alphaTest,ref);}
  const legacy=async blend=>{
    if(negative==='ignored')return; // Preserve the preceding DECAL control.
    await rs(21,blend);
    if(negative==='ignored-add'&&blend===8){
      // Deliberately erase only the effective legacy selection through a raw
      // TSS rewrite. The actual Device3 ADD setter returned S_OK, raw RS=8
      // and all raw TSS values remain intact. Model successful ignored ADD.
      await tss(1,await getTSS(1));
      report.ignoredADD={setterSucceeded:true,raw:await getRS(21),rawTSS:await readRawTSS()};
      eq(report.ignoredADD.raw,8,'fault control keeps successful raw ADD');
    }
  };
  const raw=await readRawTSS();
  for(const texture of [A,X]){
    await bind(texture);
    for(const blend of (negative==='ignored'?[2,1,3,7,4,3,1]:[2,8,1,3,8,7,4,3,1])){
      await rs(15,0);await legacy(blend);
      if(negative!=='ignored')eq(await getRS(21),blend,'legacy RS raw readback');
      eq(await readRawTSS(),raw,'legacy setter preserves raw TSS');
      report.rawTSS.push({blend,alpha:!!texture.alpha,values:raw});
      await render('mode '+blend+(texture.alpha?' RGBA':' RGB'),blend,texture);
      await rs(15,1);await rs(24,texture.alpha?128:213);await rs(25,5); // GREATER: distinguishes 85/170 and 170/255.
      await render('alpha witness '+blend+(texture.alpha?' RGBA':' RGB'),blend,texture,true);await rs(15,0);
    }
  }
  // Texture alpha never affects ADD, including zero/opaque and no-alpha
  // formats with the same stored bytes. Both alpha tests must select 170.
  const addTextures=[A,X,await makeTexture(true,0),await makeTexture(true,255),
    await makeTexture(true,85,[240,0,0]),await makeTexture(false,85,[0,180,0])];
  for(const [i,texture] of addTextures.entries()){
    await bind(texture);await legacy(8);await rs(15,0);
    await render('ADD asymmetric/saturation '+i,8,texture);
    for(const ref of [128,213]){
      await rs(15,1);await rs(24,ref);await rs(25,5);
      await render('ADD source alpha '+i+' GREATER '+ref,8,texture,true,ref);
    }
    await rs(15,0);
  }
  // Only stage-zero combiner writes leave legacy mode. Other stages/filter
  // writes retain it. Then a new legacy setter restores it on the same device.
  await bind(A);await legacy(3);await tss(16,1);await tss(2,0,1);
  await render('unrelated TSS retains DECALALPHA',3,A);
  await tss(4,3);await tss(1,3);await render('explicit raw TSS diffuse',0,A);
  await legacy(7);await render('legacy restored after TSS',7,A);
  // Public Device7 stateblock methods on the same backing COM device; legacy
  // writes still go through the genuine Device3 setter.
  const begin=()=>ok(com('BeginStateBlock same device',alias,22));
  const end=async()=>{const out=await guard(4);await ok(com('EndStateBlock same device',alias,23,out.p));await out.check();return read(out.p);};
  const apply=t=>ok(com('ApplyStateBlock same device',alias,39,t));
  const capture=t=>ok(com('CaptureStateBlock same device',alias,40,t));
  await legacy(1);await begin();await legacy(3);await render('recording leaves live DECAL',1,A);
  const token=await end();await render('End leaves live DECAL',1,A);
  await apply(token);await render('Apply recorded DECALALPHA',3,A);
  await legacy(7);await capture(token);await legacy(3);await apply(token);await render('Capture COPY effective marker',7,A);
  await tss(1,3);await capture(token);await legacy(1);await apply(token);await render('Capture inactive legacy marker',0,A);
  await begin();await legacy(3);await tss(1,3);const rawLast=await end();await apply(rawLast);await render('recorded TSS wins last',0,A);
  await begin();await tss(1,3);await legacy(3);const legacyLast=await end();await apply(legacyLast);await render('recorded legacy wins last',3,A);
  await legacy(8);await tss(16,1);await tss(2,0,1);await render('unrelated TSS retains ADD',8,A);
  await tss(4,3);await tss(1,3);await render('explicit TSS cancels ADD',0,A);
  await legacy(8);await render('ADD restored after TSS',8,A);
  await legacy(1);await begin();await legacy(8);await render('ADD recording leaves live DECAL',1,A);
  const addToken=await end();await render('ADD End leaves live DECAL',1,A);
  await apply(addToken);await render('Apply recorded ADD',8,A);
  await legacy(8);await capture(addToken);await legacy(3);await apply(addToken);await render('Capture ADD effective marker',8,A);
  await tss(1,3);await capture(addToken);await legacy(8);await apply(addToken);await render('Capture ADD inactive marker',0,A);
  await begin();await legacy(8);await tss(1,3);const addRawLast=await end();await apply(addRawLast);await render('recorded ADD then TSS',0,A);
  await begin();await tss(1,3);await legacy(8);const addLegacyLast=await end();await apply(addLegacyLast);await render('recorded TSS then ADD',8,A);
  if(mode==='worker'){
    for(const [old,next] of [[1,3],[3,7],[7,3],[8,3],[3,8],[8,2]]){
      await clear();await legacy(old);use({device,rt});queue.hold('legacy '+old+' then '+next);await draw();
      const packet=await queue.packet();
      const capturedLegacy=new DataView(packet.vertices.buffer,32,4096).getUint32(3936,true);
      eq(capturedLegacy,old,'queued effective legacy marker');await legacy(next);
      check(queue.completed()<packet.sequence,'legacy draw still unconsumed after live mutation');
      const row={old,next,capturedLegacy,sequence:packet.sequence,completedBeforeDrain:queue.completed()};report.queued.push(row);
      queue.drain();await witness('queued immutable legacy '+old,old,A);
      row.completedAfterDrain=queue.completed();check(row.completedAfterDrain>=packet.sequence,'held draw consumed');
      await render('later live legacy '+next,next,A);
    }
    for(const texture of [A,X])for(const ref of [128,213]){
      await bind(texture);await rs(15,1);await rs(24,ref);await rs(25,5);
      await clear();await legacy(8);use({device,rt});queue.hold('ADD alpha '+ref);await draw();
      const packet=await queue.packet();
      const capturedLegacy=new DataView(packet.vertices.buffer,32,4096).getUint32(3936,true);
      eq(capturedLegacy,8,'queued ADD alpha marker');
      const next=texture.alpha?2:7;await legacy(next);
      check(queue.completed()<packet.sequence,'ADD alpha draw held across mutation');
      const row={old:8,next,alpha:!!texture.alpha,ref,capturedLegacy,sequence:packet.sequence,completedBeforeDrain:queue.completed()};report.queued.push(row);
      queue.drain();await witness('queued ADD source alpha '+texture.alpha+' '+ref,8,texture,true,ref);
      row.completedAfterDrain=queue.completed();check(row.completedAfterDrain>=packet.sequence,'ADD alpha batch consumed');
      await render('later alpha mode '+next+' '+ref,next,texture,true,ref);await rs(15,0);
    }
  }
  for(const t of [token,rawLast,legacyLast,addToken,addRawLast,addLegacyLast])await ok(com('DeleteStateBlock',alias,41,t));
  await rs(1,0);await com('Release alias',alias,2);await com('Release viewport',viewport,2);
  await com('Release legacy device',device,2);await com('Release legacy target',rt,2);await com('Release D3D3',d3d,2);
  for(const t of textures){await com('Release Texture2',t.texture,2);await com('Release texture surface',t.obj,2);}
  use(initial);
}


// Run: LEGACY_BLEND_EVIDENCE=scratch/runs/<id>/render node test/test-legacy-advertised-blend-web.js
// Consumes both shipped modules in place, serially. Does not compile a fixture.
async function runtime() {
  const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),cp=require('node:child_process');
  const ROOT=path.resolve(__dirname,'..');
  const base=require('./test-legacy-texture-rendered-contract');
  const dir=process.env.LEGACY_BLEND_EVIDENCE;assert(dir,'LEGACY_BLEND_EVIDENCE required');fs.mkdirSync(dir,{recursive:true});
  const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
  const scripts=['region-map.generated','gl-command-stream','d3d-command-stream','guest-rpc','guest-thread-host',
    'render-worker','gpu-backend','d3d9-shader','d3d-shader-ir','d3d9-fixed','d3d9-texture','render-clear','d3d9-backend','d3dim-gpu'];
  const pe=fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'));
  const config={...base.plan(),immediate:true,immediateSource:blendFixture.toString(),
    imageBase:pe.readUInt32LE(pe.readUInt32LE(0x3c)+52),
    thunkBase:require('../lib/region-map.generated').BASE.THUNK_BASE,
    factoryId:require('../src/api_table.json').find(x=>x.name==='DirectDrawCreateEx').id};
  const evidence={source:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),
    fixture:hash(fs.readFileSync(__filename)),calc:hash(pe),results:[],controls:[],
    productionJS:Object.fromEntries(fs.readdirSync(path.join(ROOT,'lib')).filter(n=>/\.(js|json)$/.test(n))
      .map(n=>['lib/'+n,hash(fs.readFileSync(path.join(ROOT,'lib',n)))]))};
  let wasm,server,browser,page,timer;
  try {
    server=await require('./static-server').startStaticServer({root:ROOT,crossOriginIsolated:true,handleRequest(req,res){
      res.setHeader('Cross-Origin-Opener-Policy','same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
      if(req.url==='/legacy-render.wasm'){res.writeHead(200,{'Content-Type':'application/wasm'});res.end(wasm);return true;}
      if(req.url==='/legacy-render-fixture'){res.writeHead(200,{'Content-Type':'text/html'});res.end(scripts.map(n=>'<script src="/lib/'+n+'.js"></script>').join('\n'));return true;}
      return false;
    }});
    evidence.server=server.address();
    browser=await require('puppeteer').launch({headless:true,executablePath:process.env.CHROME||await require('puppeteer').executablePath(),
      args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:120000});
    evidence.browser=await browser.version();evidence.endpoint=browser.wsEndpoint();
    const child=browser.process();evidence.process={pid:child.pid,profile:child.spawnargs.find(s=>s.startsWith('--user-data-dir='))?.slice(16)};
    child.once('exit',(code,signal)=>{evidence.process.exit={code,signal};});
    timer=setTimeout(()=>{evidence.deadlineExceeded=true;browser.close().catch(()=>{});},360000);
    for(const name of ['wine-assembly.wasm','wine-assembly.compat.wasm']){
      wasm=fs.readFileSync(path.join(ROOT,'build',name));const moduleHash=hash(wasm);
      for(const mode of ['software','webgl','worker']){
        page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/legacy-render-fixture');
        const result=await page.evaluate(base.browserFixture,mode,config,base.oracle.toString());
        evidence.results.push({name,moduleHash,mode,result});
        await page.screenshot({path:path.join(dir,name+'-'+mode+'.png'),fullPage:true});await page.close();page=null;
        console.log('PASS '+name+' '+mode+' public legacy COM blend pixels ('+result.legacyBlend.pixels.length+')');
      }
      // Omit the real legacy setter; all surrounding COM calls and draws still
      // succeed. The independent pixel equation must reject ignored state.
      for(const mode of ['software','webgl','worker'])for(const control of ['ignored','ignored-add']){
        page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/legacy-render-fixture');
        let failure;try{await page.evaluate(base.browserFixture,mode,config,base.oracle.toString(),control);}catch(e){failure=String(e);}
        const partial=await page.evaluate(()=>globalThis.legacyTextureEvidence);
        evidence.controls.push({name,moduleHash,mode,control,failure,partial});
        const blend=control==='ignored-add'?8:1;
        assert(failure?.includes('PIXEL ORACLE mode '+blend+' RGBA'),'ignored-mode control must fail independent RGB, after successful calls');
        if(control==='ignored-add'){
          assert(partial.calls.some(c=>c.label==='SetRenderState3 21'&&c.args[1]===21&&c.args[2]===8&&c.result===0),'actual ADD setter S_OK');
          assert.equal(partial.legacyBlend.ignoredADD.raw,8);
          assert(partial.calls.some(c=>/^Draw(Indexed)?Primitive3$/.test(c.label)&&c.result===0),'actual draw S_OK');
        }
        const pixel=partial.observations.at(-1);assert.notDeepEqual(pixel.actual,pixel.expected);
        await page.close();page=null;console.log('PASS '+name+' '+mode+' '+control+' rejected by pixels');
      }
    }
    evidence.status='PASS';
  }catch(error){
    evidence.status='FAIL';evidence.error=error.stack||String(error);
    if(page){evidence.partial=await page.evaluate(()=>globalThis.legacyTextureEvidence||null).catch(()=>null);
      await page.screenshot({path:path.join(dir,'failure.png'),fullPage:true}).catch(()=>{});}
    throw error;
  }finally{
    if(timer)clearTimeout(timer);
    if(browser)await browser.close();if(server)await require('./static-server').closeServer(server);
    evidence.cleanupAt=new Date().toISOString();
    if(browser&&!evidence.deadlineExceeded)assert.deepEqual(evidence.process.exit,{code:0,signal:null},'browser exits normally');
    fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(evidence,null,2)+'\n');
  }
}
if(require.main===module)runtime().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={blendFixture,runtime};
