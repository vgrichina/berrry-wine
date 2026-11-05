#!/usr/bin/env node
'use strict';
// Both shipped modules, public guest x86 COM calls, no test Wasm exports.
// --plan performs source/oracle checks only. Runtime requires explicit evidence.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const crypto=require('node:crypto'),vm=require('node:vm');
const ROOT=process.cwd(),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const {fixtureSource:mipFixtureSource}=require(path.join(ROOT,'test/test-legacy-public-mip-webgl'));

// Independent RGBA reference: key-to-zero precedes spatial and mip filtering;
// explicit application test and blend states determine final RGB/alpha.
function oracle(colors,state,sample){
  const u=state.offset[0]+state.n*sample.x/32,v=state.offset[1]+state.n*sample.y/32;
  const lod=Math.max(0,Math.min(4,Math.log2(state.n/2)));
  const filter=state.n/2<=1?state.mag:state.min;
  const at=level=>{
    const grid=colors[level],d=grid.length;
    const tap=(x,y)=>{
      const c=grid[((y%d)+d)%d][((x%d)+d)%d];
      return state.key!==false&&c[0]===255&&c[1]===0&&c[2]===255?[0,0,0,0]:[...c,255];
    };
    if(filter===1)return tap(Math.floor(u*d),Math.floor(v*d));
    const x=u*d-.5,y=v*d-.5,ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
    const a=tap(ix,iy),b=tap(ix+1,iy),c=tap(ix,iy+1),e=tap(ix+1,iy+1);
    return a.map((z,i)=>(z*(1-fx)+b[i]*fx)*(1-fy)+(c[i]*(1-fx)+e[i]*fx)*fy);
  };
  let rgba;
  if(state.mip===1)rgba=at(0);
  else if(state.mip===2)rgba=at(Math.floor(lod+.5));
  else {const lo=Math.floor(lod),w=lod-lo,a=at(lo),b=at(Math.min(4,lo+1));rgba=a.map((z,i)=>z*(1-w)+b[i]*w);}
  const clear=[11,22,33];
  if(state.diffuseAlpha)rgba[3]=255;
  const rejected=state.test===5?rgba[3]<=0:state.test===3?rgba[3]<254.5:false;
  let rgb=rejected?clear:state.blend?rgba.slice(0,3).map((c,i)=>c*rgba[3]/255+clear[i]*(1-rgba[3]/255)):rgba.slice(0,3);
  rgb.alpha=rejected?255:state.blend?rgba[3]*rgba[3]/255+255-rgba[3]:rgba[3];
  return rgb;
}

function plan(){
  const opaque=[[224,32,16],[16,224,48],[48,16,208],[192,160,96],[32,192,224]];
  const colors=opaque.map((c,l)=>Array.from({length:16>>l},()=>
    Array.from({length:16>>l},(_,x)=>x<(16>>l)/2&&l<4?[255,0,255]:c.slice())));
  const point={x:4,y:4},states=[];
  function add(label,n,u,options={}){states.push({label,n,offset:[u-n/8,.125],min:1,mag:1,mip:2,key:true,test:0,blend:false,samples:[point],...options});}
  add('mip1 key writes transparent black',4,.125);
  add('mip1 key application GREATER0 rejects',4,.125,{test:5});
  add('mip1 opaque survives',4,.75,{test:5});
  add('mip2 opaque distinct from mip1 and base',8,.75);
  add('mip3 opaque distinct',16,.75);
  add('last mip clamped',65536,.75);
  add('mip1 bilinear mixed key',4,.5,{min:2});
  add('mip1 bilinear GREATER0 passes',4,.5,{min:2,test:5});
  add('mip1 bilinear EQUAL255 rejects',4,.5,{min:2,test:3});
  add('mip1 bilinear source alpha blend',4,.5,{min:2,blend:true});
  add('opaque diffuse alpha overrides keyed alpha',4,.125,{test:5,diffuseAlpha:true});
  add('linear mip opaque point taps',2*Math.sqrt(8),.75,{mip:3});
  add('trilinear mixed key',2*Math.sqrt(8),.5,{mip:3,min:2});
  add('trilinear key GREATER0 rejects',2*Math.sqrt(8),.125,{mip:3,min:2,test:5});
  add('trilinear mixed source alpha blend',2*Math.sqrt(8),.5,{mip:3,min:2,blend:true});
  add('mip enabled magnification MAG linear',.5,.5,{mag:2});
  add('mip NONE minification keyed',32,.5,{mip:1,min:2});
  add('key disabled preserves opaque magenta',4,.125,{key:false});
  add('key restored same input',4,.125);
  add('unkeyed restored child color',8,.75,{key:false,min:2});
  add('unkeyed restored base color MIP NONE',32,.75,{key:false,mip:1});
  return {colors,states,tolerance:2,spatial:true,queuedPairs:[[0,17],[17,18],[6,8],[9,6]],update:null};
}

function fixtureSource(){
  let s=mipFixtureSource();
  const replace=(a,b)=>{assert.equal(s.split(a).length,2,'unique keyed seam '+a.slice(0,80));s=s.replace(a,b);};
  replace('  let e,raw,link,manager,port,lastStats,gpu,holding=false,heldRecord;',`  host.crash_unimplemented=(pointer,...args)=>{
    const bytes=new Uint8Array(memory.buffer);let name='';
    for(let i=pointer>>>0;i<bytes.length&&i<(pointer>>>0)+192&&bytes[i];i++)name+=String.fromCharCode(bytes[i]);
    (evidence.crashes||(evidence.crashes=[])).push({name,args});
    throw Error('unimplemented '+name);
  };
  let e,raw,link,manager,port,lastStats,gpu,holding=false,heldRecord;`);
  replace("        await raw('set_esp',stack);await raw('call_func',pc,0,0,0,0);",`        evidence.pendingCall={label,args,object,vtable,slot,target,pc};
        await raw('set_esp',stack);await raw('call_func',pc,0,0,0,0);`);
  replace('        evidence.calls.push(row);await result.check();','        evidence.calls.push(row);evidence.pendingCall=null;await result.check();');
  // Every level is explicitly keyed through its own public COM interface.
  replace('    const viewport=await alloc(24);',`    const colorKey=await guard(8);await words(colorKey.p,[0x00ff00ff,0x00ff00ff]);
    for(const obj of levels)await ok(com('SetColorKey7 mip',obj,29,8,colorKey.p));
    await colorKey.check();
    const viewport=await alloc(24);`);
  replace('      previousMip=mip;',`      const rs=async(id,v)=>{
        await ok(com('SetRenderState7 keyed',device,20,id,v));
        const out=await guard(4);await ok(com('GetRenderState7 keyed',device,21,id,out.p));
        await out.check();eq(await read(out.p),v,'public keyed state readback '+id);
      };
      await rs(41,state.key===false?0:1);await rs(144,config.falseMode?0:1);
      await rs(15,state.test?1:0);await rs(25,state.test||8);await rs(24,state.test===3?255:0);
      await rs(27,state.blend?1:0);await rs(19,5);await rs(20,6);
      await tss(4,state.diffuseAlpha?3:2);await tss(6,0);
      previousMip=mip;`);
  replace("    const draw=async()=>{await ok(com('BeginScene7',device,5));",`    const draw=async()=>{
      await ok(com('Clear7 keyed background',device,10,0,0,1,0xff0b1621,bits(1),0));
      await ok(com('BeginScene7',device,5));`);
  // Existing fixed-function shader uses a documented-in-code 1/16-pixel
  // bias (lib/d3d9-fixed.js). Model that existing sampling location explicitly.
  replace('const expected=expectedColor(config.colors,state,sample);', "const expected=expectedColor(config.colors,state,mode==='software'?sample:{x:sample.x+1/16,y:sample.y+1/16});");
  replace("const version=gpu?evidence.glRenderer.version:row.workerStats.glVersion;", "const version=mode==='software'?null:gpu?evidence.glRenderer.version:row.workerStats.glVersion;");
  replace("check(version.startsWith('WebGL '+config.webglVersion+'.0'),'actual context VERSION '+version);", "if(mode!=='software')check(version.startsWith('WebGL '+config.webglVersion+'.0'),'actual context VERSION '+version);");
  replace("eq(row.webglRGBA[3],255,'GL opaque alpha');", "row.expectedAlpha=expected.alpha;check(Math.abs(row.webglRGBA[3]-expected.alpha)<=config.tolerance,'PIXEL ORACLE GL alpha '+label+': '+row.webglRGBA[3]+' expected '+expected.alpha);");
  return s;
}

function config(){
  const pe=fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'));
  return {...plan(),thunkBase:require(path.join(ROOT,'lib/region-map.generated')).BASE.THUNK_BASE,
    factoryId:require(path.join(ROOT,'src/api_table.json')).find(x=>x.name==='DirectDrawCreateEx').id,
    imageBase:pe.readUInt32LE(pe.readUInt32LE(0x3c)+52)};
}
function controls(){
  const p=plan(),sample=p.states[0].samples[0],at=i=>Array.from(oracle(p.colors,p.states[i],sample));
  assert.deepEqual(at(0),[0,0,0]);assert.deepEqual(at(1),[11,22,33]);
  assert.deepEqual(at(2),[16,224,48]);assert.deepEqual(at(3),[48,16,208]);
  assert.deepEqual(at(6),[8,112,24]);assert.deepEqual(at(8),[11,22,33]);
  assert.deepEqual(at(17),[255,0,255]);assert.deepEqual(at(18),[0,0,0]);
  const source=fixtureSource();new vm.Script('('+source+')');
  assert(source.includes('SetColorKey7 mip'));assert(!/mip_seed|mip_draw|mip_surface/.test(source));
  return {status:'SOURCE/ORACLE ONLY; no rendered coverage',states:p.states.length};
}

async function runtime(){
  controls();
  const expectFailure=process.argv.includes('--old-fail')||process.argv.includes('--unsupported-false');
  const dir=process.env.KEYED_MIP_EVIDENCE,moduleDir=process.env.KEYED_MIP_MODULE_DIR||path.join(ROOT,'build');
  assert(dir,'KEYED_MIP_EVIDENCE required');fs.mkdirSync(dir,{recursive:true});
  const result={status:'RUNNING',startedAt:new Date().toISOString(),source:process.env.KEYED_MIP_SOURCE||null,
    fixtureSha256:sha(fs.readFileSync(__filename)),adaptedFixtureSha256:sha(fixtureSource()),
    publicFixtureSha256:sha(fs.readFileSync(path.join(ROOT,'test/test-legacy-texture-rendered-contract.js'))),
    mipFixtureSha256:sha(fs.readFileSync(path.join(ROOT,'test/test-legacy-public-mip-webgl.js'))),
    calcSha256:sha(fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'))),
    node:process.version,plan:plan(),modules:[],results:[],failures:[],physicalGPU:false};
  const save=()=>fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(result,null,2)+'\n');
  const fixture=Function('return ('+fixtureSource()+')')();
  let wasm,server,browser,page;
  try{
    const scripts=['region-map.generated','gl-command-stream','d3d-command-stream','guest-rpc','guest-thread-host',
      'render-worker','gpu-backend','d3d9-shader','d3d-shader-ir','d3d9-fixed','d3d9-texture','render-clear','d3d9-backend','d3dim-gpu'];
    server=await require(path.join(ROOT,'test/static-server')).startStaticServer({root:ROOT,crossOriginIsolated:true,handleRequest(req,res){
      res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
      if(req.url==='/legacy-render.wasm'){res.writeHead(200,{'Content-Type':'application/wasm'});res.end(wasm);return true;}
      if(req.url==='/legacy-render-fixture'){res.writeHead(200,{'Content-Type':'text/html'});res.end(scripts.map(n=>'<script src="/lib/'+n+'.js"></script>').join('\n'));return true;}
      return false;
    }});
    result.serverPort=server.address().port;
    for(const name of ['wine-assembly.wasm','wine-assembly.compat.wasm']){
      wasm=fs.readFileSync(path.join(moduleDir,name));result.modules.push({name,sha256:sha(wasm),bytes:wasm.length});
      for(const mode of ['software','webgl','worker'])for(const webglVersion of mode==='software'?[null]:[1,2]){
        try{
          const cfg={...config(),webglVersion,falseMode:process.argv.includes('--unsupported-false')};let row;
          if(mode==='software'){
            cfg.noPreview=true;
            const context=vm.createContext({WebAssembly,performance,setTimeout,fetch:async url=>{
              const file=url==='/legacy-render.wasm'?wasm:fs.readFileSync(path.join(ROOT,url));
              return {arrayBuffer:async()=>Uint8Array.from(file).buffer,json:async()=>JSON.parse(file)};
            }});
            try{row=await vm.runInContext('('+fixtureSource()+')',context)(mode,cfg,oracle.toString());}
            catch(error){error.partial=context.legacyTextureEvidence;throw error;}
          }else{
            if(!browser){browser=await require('puppeteer').launch({headless:true,executablePath:process.env.CHROME||'/usr/bin/google-chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:120000});result.browser=await browser.version();result.browserPid=browser.process().pid;result.browserArgs=browser.process().spawnargs;browser.process().once('exit',(code,signal)=>{result.browserExit={code,signal};});}
            page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/legacy-render-fixture');
            row=await page.evaluate(fixture,mode,cfg,oracle.toString());
            await page.screenshot({path:path.join(dir,name+'-'+mode+'-'+webglVersion+'.png')});
            await page.close();page=null;
          }
          result.results.push({module:name,webglVersion,...row});save();
          assert.equal(row.status,'PASS');
          // Native-size captures are saved from the actual 32x32 target bytes.
          const {PNG}=require('pngjs');
          for(const [i,observation] of row.observations.entries()){
            const png=new PNG({width:32,height:32});png.data.set(observation.dibRGBA);
            fs.writeFileSync(path.join(dir,name+'-'+mode+'-'+webglVersion+'-'+i+'.png'),PNG.sync.write(png));
          }
          console.log('PASS',name,mode,webglVersion,row.observations.length);
        }catch(error){
          const partial=error.partial||(page?await page.evaluate(()=>globalThis.legacyTextureEvidence).catch(()=>null):null);
          result.failures.push({module:name,mode,webglVersion,error:String(error),partial});save();
          if(page){await page.close();page=null;}
          if(!expectFailure)throw error;
        }
      }
    }
    if(expectFailure){
      assert.equal(result.failures.length,10,'both old modules reject all five routes');
      assert(result.failures.every(f=>f.partial?.calls.some(c=>c.label==='SetColorKey7 mip'&&c.result===0)));
      for(const f of result.failures){
        if(f.mode==='worker'){
          assert.equal(f.partial?.pendingCall?.label,'Lock Surface7','queued failure surfaces at public fence');
          assert(f.partial.calls.some(c=>c.label==='DrawPrimitive7'&&c.result===0),'queued public draw returned S_OK');
          assert(f.partial.transport.batches.some(b=>b.commands===1&&b.header[5]===4096),'real captured draw/state batch');
          assert(f.partial.logs.some(l=>typeof l==='string'&&l.includes('RuntimeError: unreachable')),
            'render Worker retains actual Wasm failure');
        }else assert.equal(f.partial?.pendingCall?.label,'DrawPrimitive7','synchronous draw fails inside guest call');
      }
      assert(result.failures.filter(f=>f.mode==='software').every(f=>f.error.includes('D3DIM:keyed mip filtering')),
        'native failure names the actual production trap');
      result.status=process.argv.includes('--old-fail')?'OLD FAIL REPRODUCED; no new behavior claimed':'UNSUPPORTED FALSE FAILS EXPLICITLY';
    }else {assert.equal(result.results.length,10);result.status='PASS';}
  }catch(error){result.status='FAIL';result.error=error.stack;throw error;}
  finally{if(browser){await browser.close();result.browserCloseResolved=true;}if(server)await require(path.join(ROOT,'test/static-server')).closeServer(server);result.finishedAt=new Date().toISOString();save();}
}
if(require.main===module){
  if(process.argv.includes('--plan'))console.log(JSON.stringify(controls()));
  else runtime().catch(error=>{console.error(error);process.exitCode=1;});
}
module.exports={oracle,plan,fixtureSource,controls};
