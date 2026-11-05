#!/usr/bin/env node
'use strict';
// Both shipped modules, public guest x86 COM calls, no test Wasm exports.
// --plan performs source/oracle checks only. Runtime requires explicit evidence.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const crypto=require('node:crypto'),vm=require('node:vm');
const ROOT=process.cwd(),sha=b=>crypto.createHash('sha256').update(b).digest('hex');


// Independent RGBA reference: key-to-zero precedes spatial and mip filtering;
// explicit application test and blend states determine final RGB/alpha.
// The reference uses only authored native pixels and public descriptor masks.
// RHW interpolation differentiates U/Q and V/Q analytically at each sample.
function oracle(colors,state,sample){
  const {x,y}=sample,q=state.q||[1,1,1],n=state.n;
  const Q=q[0]+(q[1]-q[0])*x/32+(q[2]-q[0])*y/32;
  const U=n*q[1]*x/32,V=n*q[2]*y/32,Qx=(q[1]-q[0])/32,Qy=(q[2]-q[0])/32;
  const ux=(n*q[1]*Q/32-U*Qx)/(Q*Q),uy=-U*Qy/(Q*Q);
  const vx=-V*Qx/(Q*Q),vy=(n*q[2]*Q/32-V*Qy)/(Q*Q);
  const rho=16*Math.sqrt(Math.max(ux*ux+vx*vx,uy*uy+vy*vy));
  const lod=Math.max(0,Math.min(4,Math.log2(rho))),u=state.offset[0]+U/Q,v=state.offset[1]+V/Q;
  // An ideal reference plus an independently propagated precision envelope:
  // interpolation weights may differ by one 8-bit fraction and each stage
  // may round to a byte. This covers finite-precision filters without using
  // observed pixels, renderer-selected levels or backend filter functions.
  const exact=a=>Object.assign(a,{bounds:a.map(c=>[c,c])});
  const mix=(a,b,t)=>{
    const out=a.map((c,i)=>c*(1-t)+b[i]*t);
    out.bounds=a.map((c,i)=>{
      const aa=a.bounds[i],bb=b.bounds[i];
      if(aa[0]===aa[1]&&bb[0]===bb[1]&&aa[0]===bb[0])return aa.slice();
      const values=[];
      for(const x of aa)for(const y of bb)for(const w of [Math.max(0,t-1/256),Math.min(1,t+1/256)])values.push(x*(1-w)+y*w);
      return [Math.max(0,Math.min(...values)-1),Math.min(255,Math.max(...values)+1)];
    });return out;
  };
  const at=level=>{
    const grid=colors[level],d=grid.length;
    const tap=(x,y)=>{const c=grid[((y%d)+d)%d][((x%d)+d)%d];
      return exact(state.key!==false&&c.raw===c.keyRaw?[0,0,0,0]:[...c.rgb,255]);};
    if((rho<=1?state.mag:state.min)===1)return tap(Math.floor(u*d),Math.floor(v*d));
    const sx=u*d-.5,sy=v*d-.5,ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy;
    const a=tap(ix,iy),b=tap(ix+1,iy),c=tap(ix,iy+1),e=tap(ix+1,iy+1);
    return mix(mix(a,b,fx),mix(c,e,fx),fy);
  };
  let rgba;
  if(state.mip===1)rgba=at(0);
  else if(state.mip===2)rgba=at(Math.floor(lod+.5));
  else {const lo=Math.floor(lod),w=lod-lo;rgba=mix(at(lo),at(Math.min(4,lo+1)),w);}
  const clear=[11,22,33];if(state.diffuseAlpha){rgba[3]=255;rgba.bounds[3]=[255,255];}
  const rejected=state.test===5?rgba[3]<=0:state.test===3?rgba[3]<254.5:false;
  const rgb=rejected?clear:state.blend?rgba.slice(0,3).map((c,i)=>c*rgba[3]/255+clear[i]*(1-rgba[3]/255)):rgba.slice(0,3);
  rgb.bounds=rejected?clear.map(c=>[c,c]):state.blend?rgba.bounds.slice(0,3).map((range,i)=>{
    const values=[];for(const c of range)for(const a of rgba.bounds[3])values.push(c*a/255+clear[i]*(1-a/255));
    return [Math.max(0,Math.min(...values)-1),Math.min(255,Math.max(...values)+1)];
  }):rgba.bounds.slice(0,3);
  rgb.alpha=rejected?255:state.blend?rgba[3]*rgba[3]/255+255-rgba[3]:rgba[3];
  const alpha=rgba.bounds[3],alphaValues=[...alpha,...(alpha[0]<=127.5&&alpha[1]>=127.5?[127.5]:[])].map(a=>a*a/255+255-a);
  rgb.alphaBounds=rejected?[255,255]:state.blend?[Math.min(...alphaValues)-1,Math.max(...alphaValues)+1]:alpha;
  rgb.projection={u,v,rho,lod};return rgb;
}
const formats=[
  {name:'RGB565',pf:[32,0x40,0,16,0xf800,0x7e0,31,0]},
  {name:'X1RGB1555',pf:[32,0x40,0,16,0x7c00,0x3e0,31,0]},
  {name:'RGB24',pf:[32,0x40,0,24,0xff0000,0xff00,255,0]},
  {name:'indexed8',pf:[32,0x60,0,8,0,0,0,0]},
  {name:'X8R8G8B8-perspective',pf:[32,0x40,0,32,0xff0000,0xff00,255,0]},
];
function nativePixel(rgb,format){
  let raw=0;const decoded=[];
  for(const [i,mask] of format.pf.slice(4,7).entries()){
    if(!mask){decoded.push(rgb[i]);continue;}
    const shift=Math.log2(mask&-mask),bits=Math.log2((mask>>>shift)+1);
    const v=rgb[i]>>>(8-bits);raw|=v<<shift;
    // Native RGB565/555 expansion replicates the high channel bits.
    decoded.push(bits===8?v:bits===6?(v<<2)|(v>>>4):(v<<3)|(v>>>2));
  }
  return {raw:raw>>>0,rgb:decoded};
}
function plan(format=formats[0]){
  const keyColors=[[0,0,0],[173,37,213],[245,65,157],[197,89,237],[255,255,255]];
  const colors=keyColors.map((key,l)=>Array.from({length:16>>l},(_,y)=>Array.from({length:16>>l},(_,x)=>{
    const keyed=(x+y)%3===0,authored=keyed?key:[35+l*29+(x%2)*61,43+l*23+(y%2)*67,27+l*31+((x+y)%2)*41];
    return {...nativePixel(authored,format),keyRaw:nativePixel(key,format).raw};
  })));
  const states=[],add=(label,n,options={})=>states.push({label,n,offset:[.137,.193],min:1,mag:1,mip:2,key:true,test:0,blend:false,samples:[{x:2,y:3}],...options});
  add('native MAG point',.5);add('native MAG linear',.5,{mag:2});
  add('native MIN point',4);add('native MIN linear',4,{min:2});
  // Nearest-mip half-level ties are sensitive to float vertex quantization
  // and log precision. Use a fractional footprint separated from that tie.
  add('native fractional mip point',2*2**1.4,{min:2});
  add('native trilinear',2*Math.sqrt(8),{min:2,mip:3});
  add('native trilinear alpha GREATER0',2*Math.sqrt(8),{min:2,mip:3,test:5});
  add('native trilinear alpha EQUAL255',2*Math.sqrt(8),{min:2,mip:3,test:3});
  add('native trilinear source alpha blend',2*Math.sqrt(8),{min:2,mip:3,blend:true});
  add('native key disabled',4,{min:2,key:false});add('native key restored',4,{min:2});
  add('native mip NONE',32,{min:2,mip:1});
  add('native key maximum and last mip clamp',65536);
  add('native key maximum alpha rejects',65536,{test:5});
  const samples=[1,8,14,20,27].map(x=>({x,y:1}));
  add('varying RHW point selects child mips',16,{q:[1,.25,.25],samples});
  add('varying RHW trilinear keyed',16,{q:[1,.25,.25],min:2,mip:3,samples});
  add('varying RHW trilinear blend',16,{q:[1,.25,.25],min:2,mip:3,blend:true,samples});
  add('varying RHW trilinear EQUAL255',16,{q:[1,.25,.25],min:2,mip:3,test:3,samples});
  add('RHW restored to affine',4,{min:2});
  const selectedStates=format.name==='X8R8G8B8-perspective'?states.filter(s=>s.q):states;
  return {format,colors,keys:keyColors.map(c=>nativePixel(c,format).raw),states:selectedStates,tolerance:2,spatial:true,queuedPairs:format.name==='X8R8G8B8-perspective'?[[0,1],[1,3]]:[[2,3],[9,10],[5,7],[14,15]],update:null};
}
function fixtureSource(){
  let s=require(path.join(ROOT,'test/test-d3dim-keyed-mip-public-web')).fixtureSource();
  const replace=(a,b)=>{assert.equal(s.split(a).length,2,'unique formats seam '+a.slice(0,90));s=s.replace(a,b);};
  const block=(a,b,replacement)=>{const start=s.indexOf(a),end=s.indexOf(b,start);assert(start>=0&&end>start,a);replace(s.slice(start,end),replacement);};
  replace("  const module=await WebAssembly.compile(await (await fetch('/legacy-render.wasm')).arrayBuffer());",`  const moduleBytes=await (await fetch('/legacy-render.wasm',{cache:'no-store'})).arrayBuffer();
  evidence.moduleSha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',moduleBytes)),b=>b.toString(16).padStart(2,'0')).join('');
  eq(evidence.moduleSha256,config.expectedModuleSha256,'actual fetched module hash');
  const module=await WebAssembly.compile(moduleBytes);`);
  replace('      return acquire(out=>com(\'CreateSurface\',dd,6,desc,out,0));',`      if(caps===0x401008)await words(desc+72,config.format.pf);
      return acquire(out=>com('CreateSurface',dd,6,desc,out,0));`);
  block('    const texture=await surface(16,16,0x401008,5);','    // Separate backing/watch pages',`    let texture;const levels=[];
`);
  replace('    const lockDesc=await guard(124);',`    // Callback copies each public DDPIXELFORMAT using guest x86 REP MOVSD.
    const enumerated=await alloc(4+32*16);await write(enumerated,0);
    const callback=await alloc(80),code=[],word=v=>code.push(v&255,(v>>>8)&255,(v>>>16)&255,v>>>24);
    code.push(0x56,0x57,0x8b,0x74,0x24,0x0c,0xbf);word(enumerated);
    code.push(0x8b,0x07,0x89,0xc2,0xc1,0xe2,0x05,0x8d,0x7c,0x17,0x04,0xb9);word(8);
    code.push(0xfc,0xf3,0xa5,0xff,0x05);word(enumerated);
    code.push(0x5f,0x5e,0xb8);word(1);code.push(0xc2,0x08,0x00);await bytes(callback,code);
    await ok(com('EnumTextureFormats7',device,4,callback,0));
    const count=await read(enumerated);check(count<=16,'bounded enumeration');
    evidence.formats=[];for(let i=0;i<count;i++){
      const pf=[];for(let j=0;j<8;j++)pf.push(await read(enumerated+4+i*32+j*4));evidence.formats.push(pf);
    }
    const ddCaps=await guard(380);await words(ddCaps.p,Array(95).fill(0));await write(ddCaps.p,380);
    await ok(com('GetCaps7 DirectDraw key ranges',dd,11,ddCaps.p,0));await ddCaps.check();
    evidence.ddColorKeyCaps=await read(ddCaps.p+12);
    eq(evidence.ddColorKeyCaps,0,'no DirectDraw color-space ranges advertised');
    evidence.keyRangeCoverage='native singleton endpoints and converted interior keys; COLORSPACE ranges unadvertised';
    evidence.requestedFormat=config.format;
    if(!evidence.formats.some(p=>JSON.stringify(p)===JSON.stringify(config.format.pf))){
      for(const [name,obj] of Object.entries({device,rt,padding,d3d,dd}))await com('Release unadvertised '+name,obj,2);
      evidence.status='UNADVERTISED; no format creation or rendering attempted';return evidence;
    }
    check(config.format.pf[3]!==8,'newly advertised indexed8 requires a public per-image non-alpha palette fixture');
    texture=await surface(16,16,0x401008,5);levels.push(texture);evidence.objects.texture=texture;
    const mipCaps=await guard(16);await words(mipCaps.p,[0x401000,0,0,0]);
    for(let i=1;i<5;i++)levels.push(await acquire(out=>com('GetAttachedSurface7 mip '+i,levels[i-1],12,mipCaps.p,out)));
    await mipCaps.check();evidence.levels=levels;
    const lockDesc=await guard(124);`);
  block('      for(const [offset,value] of [[84,32]', '      return {pointer:',`      const expected=levels.includes(obj)?config.format.pf:[32,0x40,0,32,0xff0000,0xff00,255,0];
      for(let i=0;i<8;i++)eq(await read(lockDesc.p+72+i*4),expected[i],'public Lock native format');
`);
  block('      eq(l.pitch,dimension*4,\'public mip exact pitch\');','      await unlock(obj);evidence.levelLocks.push',`      const bpp=config.format.pf[3],pixelBytes=bpp/8;
      eq(l.pitch,(dimension*pixelBytes+3)&~3,'public mip native aligned pitch');
      const image=new Uint8Array(l.pitch*dimension).fill(0xa7);
      for(let y=0;y<dimension;y++)for(let x=0;x<dimension;x++){
        const native=config.colors[level][y][x].raw;
        for(let byte=0;byte<pixelBytes;byte++)image[y*l.pitch+x*pixelBytes+byte]=(native>>>(8*byte))&255;
      }
      await bytes(l.pointer,image);
`);
  replace('    const colorKey=await guard(8);await words(colorKey.p,[0x00ff00ff,0x00ff00ff]);\n    for(const obj of levels)await ok(com(\'SetColorKey7 mip\',obj,29,8,colorKey.p));',`    const colorKey=await guard(8);
    for(const [level,obj] of levels.entries()){
      await words(colorKey.p,[config.keys[level],config.keys[level]]);
      await ok(com('SetColorKey7 mip',obj,29,8,colorKey.p));
      const out=await guard(8);await ok(com('GetColorKey7 mip',obj,16,8,out.p));await out.check();
      eq(await read(out.p),config.keys[level],'native key low roundtrip');
      eq(await read(out.p+4),config.keys[level],'native key high singleton roundtrip');
    }`);
  replace('Math.abs(c-want[i])<=config.tolerance', 'c>=want.bounds[i][0]-.5&&c<=want.bounds[i][1]+.5');
  replace('Math.abs(row.webglRGBA[3]-expected.alpha)<=config.tolerance', 'row.webglRGBA[3]>=expected.alphaBounds[0]-.5&&row.webglRGBA[3]<=expected.alphaBounds[1]+.5');
  replace('row.expectedAlpha=expected.alpha;', 'row.expectedProjection=expected.projection;row.expectedBounds=expected.bounds;row.expectedAlphaBounds=expected.alphaBounds;row.expectedAlpha=expected.alpha;');
  return s;
}

function config(){
  const pe=fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'));
  return {...plan(),thunkBase:require(path.join(ROOT,'lib/region-map.generated')).BASE.THUNK_BASE,
    factoryId:require(path.join(ROOT,'src/api_table.json')).find(x=>x.name==='DirectDrawCreateEx').id,
    imageBase:pe.readUInt32LE(pe.readUInt32LE(0x3c)+52)};
}
function controls(){
  assert.deepEqual(nativePixel([219,13,181],formats[0]),{raw:0xd876,rgb:[222,12,181]});
  assert.deepEqual(nativePixel([219,13,181],formats[1]),{raw:0x6c36,rgb:[222,8,181]});
  assert.deepEqual(nativePixel([219,13,181],formats[2]),{raw:0xdb0db5,rgb:[219,13,181]});
  const p=plan();for(const pair of [[0,1],[2,3],[4,5],[9,10]]){
    const [a,b]=pair.map(i=>oracle(p.colors,p.states[i],p.states[i].samples[0]));
    assert(a.some((v,i)=>Math.abs(v-b[i])>4),'independent discriminating pair '+pair);
  }
  for(const format of formats)for(const state of plan(format).states)for(const sample of state.samples){
    const lod=oracle(plan(format).colors,state,sample).projection.lod;
    if(state.mip===2)assert(Math.abs(lod-Math.floor(lod)-.5)>1e-4,'point mip sample avoids ambiguous half-level tie');
  }
  const perspective=p.states.find(s=>s.q);
  // At (1,1), Q=61/64 and U=V=1/8; the quotient derivatives
  // are (500,12)/3721 in each axis, independent of the renderer.
  const hand=oracle(p.colors,perspective,{x:1,y:1}).projection;
  assert(Math.abs(hand.u-(perspective.offset[0]+8/61))<1e-12);
  assert(Math.abs(hand.v-(perspective.offset[1]+8/61))<1e-12);
  assert(Math.abs(hand.rho-16*Math.sqrt(500*500+12*12)/3721)<1e-12);
  assert(perspective.samples.some(sample=>oracle(p.colors,perspective,sample).some((c,i)=>Math.abs(c-oracle(p.colors,{...perspective,q:[1,1,1]},sample)[i])>4)),'perspective differs from affine');
  const levels=perspective.samples.map(sample=>Math.floor(oracle(p.colors,perspective,sample).projection.lod+.5));
  assert(new Set(levels).size>=3,'RHW selects at least three distinct child levels');
  const s=fixtureSource();new vm.Script('('+s+')');assert(!/mip_seed|mip_draw|mip_surface|fixedLOD/.test(s));
  return {status:'SOURCE/ORACLE ONLY; no rendered coverage',formats:formats.map(f=>f.name),states:p.states.length};
}

async function runtime(){
  controls();
  const dir=process.env.KEYED_MIP_FORMATS_EVIDENCE,moduleDir=process.env.KEYED_MIP_FORMATS_MODULE_DIR||path.join(ROOT,'build');
  assert(dir,'KEYED_MIP_FORMATS_EVIDENCE required');fs.mkdirSync(dir,{recursive:true});
  const result={status:'RUNNING',startedAt:new Date().toISOString(),source:process.env.KEYED_MIP_FORMATS_SOURCE||null,
    fixtureSha256:sha(fs.readFileSync(__filename)),adaptedFixtureSha256:sha(fixtureSource()),
    publicFixtureSha256:sha(fs.readFileSync(path.join(ROOT,'test/test-legacy-texture-rendered-contract.js'))),
    mipFixtureSha256:sha(fs.readFileSync(path.join(ROOT,'test/test-legacy-public-mip-webgl.js'))),
    calcSha256:sha(fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'))),
    renderSourceHashes:Object.fromEntries(['d3dim-gpu','d3d9-shader','d3d9-backend','d3d9-fixed'].map(n=>[n,sha(fs.readFileSync(path.join(ROOT,'lib',n+'.js')))])),
    node:process.version,plan:plan(),modules:[],results:[],failures:[],physicalGPU:false};
  const save=()=>fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(result,null,2)+'\n');
  const fixture=Function('return ('+fixtureSource()+')')();
  let wasm,server,browser,page;
  try{
    const scripts=['region-map.generated','gl-command-stream','d3d-command-stream','guest-rpc','guest-thread-host',
      'render-worker','gpu-backend','d3d9-shader','d3d-shader-ir','d3d9-fixed','d3d9-texture','render-clear','d3d9-backend','d3dim-gpu'];
    server=await require(path.join(ROOT,'test/static-server')).startStaticServer({root:ROOT,crossOriginIsolated:true,handleRequest(req,res){
      res.setHeader('Cache-Control','no-store');
      res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
      if(req.url==='/legacy-render.wasm'){res.writeHead(200,{'Content-Type':'application/wasm'});res.end(wasm);return true;}
      if(req.url==='/legacy-render-fixture'){res.writeHead(200,{'Content-Type':'text/html'});res.end(scripts.map(n=>'<script src="/lib/'+n+'.js"></script>').join('\n'));return true;}
      return false;
    }});
    result.serverPort=server.address().port;
    for(const name of ['wine-assembly.wasm','wine-assembly.compat.wasm'].filter(n=>!process.env.KEYED_MIP_FORMATS_ONLY_MODULE||n===process.env.KEYED_MIP_FORMATS_ONLY_MODULE)){
      wasm=fs.readFileSync(path.join(moduleDir,name));result.modules.push({name,sha256:sha(wasm),bytes:wasm.length});
      for(const mode of ['software','webgl','worker'].filter(m=>!process.env.KEYED_MIP_FORMATS_ONLY_MODE||m===process.env.KEYED_MIP_FORMATS_ONLY_MODE))for(const webglVersion of mode==='software'?[null]:[1,2])for(const format of formats.filter(f=>!process.env.KEYED_MIP_FORMATS_ONLY_FORMAT||f.name===process.env.KEYED_MIP_FORMATS_ONLY_FORMAT)){
        try{
          const cfg={...config(),...plan(format),webglVersion,expectedModuleSha256:sha(wasm)};let row;
          if(mode==='software'){
            cfg.noPreview=true;
            const context=vm.createContext({WebAssembly,performance,setTimeout,crypto:crypto.webcrypto,fetch:async url=>{
              const file=url==='/legacy-render.wasm'?wasm:fs.readFileSync(path.join(ROOT,url));
              return {arrayBuffer:async()=>Uint8Array.from(file).buffer,json:async()=>JSON.parse(file)};
            }});
            try{row=await vm.runInContext('('+fixtureSource()+')',context)(mode,cfg,oracle.toString());}
            catch(error){error.partial=context.legacyTextureEvidence;throw error;}
          }else{
            if(!browser){browser=await require('puppeteer').launch({headless:true,executablePath:process.env.CHROME||'/usr/bin/google-chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:120000});result.browser=await browser.version();result.browserPid=browser.process().pid;result.browserArgs=browser.process().spawnargs;browser.process().once('exit',(code,signal)=>{result.browserExit={code,signal};});}
            page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/legacy-render-fixture');
            row=await page.evaluate(fixture,mode,cfg,oracle.toString());
            if(row.status==='PASS')await page.screenshot({path:path.join(dir,name+'-'+format.name+'-'+mode+'-'+webglVersion+'.png')});
            await page.close();page=null;
          }
          result.results.push({module:name,format:format.name,webglVersion,...row});save();
          if(row.status.startsWith('UNADVERTISED')){console.log('SKIP',name,format.name,mode,webglVersion,row.status);continue;}
          assert.equal(row.status,'PASS');
          // Native-size captures are saved from the actual 32x32 target bytes.
          const {PNG}=require('pngjs');
          for(const [i,observation] of row.observations.entries()){
            const png=new PNG({width:32,height:32});png.data.set(observation.dibRGBA);
            fs.writeFileSync(path.join(dir,name+'-'+format.name+'-'+mode+'-'+webglVersion+'-'+i+'.png'),PNG.sync.write(png));
          }
          console.log('PASS',name,mode,webglVersion,row.observations.length);
        }catch(error){
          const partial=error.partial||(page?await page.evaluate(()=>globalThis.legacyTextureEvidence).catch(()=>null):null);
          result.failures.push({module:name,mode,format:format.name,webglVersion,phase:partial?.pendingCall?.label==='CreateSurface'||partial?.calls?.some(c=>c.label==='CreateSurface'&&c.result!==0)?'ADVERTISED FORMAT CREATION':'RENDER OR ABI',error:String(error),partial});save();
          if(page){await page.close();page=null;}
          throw error;
        }
      }
    }
    if(!process.env.KEYED_MIP_FORMATS_ONLY_MODULE&&!process.env.KEYED_MIP_FORMATS_ONLY_MODE&&!process.env.KEYED_MIP_FORMATS_ONLY_FORMAT)assert.equal(result.results.length,50);
    result.coverage={renderedRoutes:result.results.filter(r=>r.status==='PASS').length,unadvertisedRoutes:result.results.filter(r=>r.status.startsWith('UNADVERTISED')).length,observations:result.results.reduce((n,r)=>n+(r.observations?.length||0),0)};
    result.status='PASS';
  }catch(error){result.status='FAIL';result.error=error.stack;throw error;}
  finally{if(browser){await browser.close();result.browserCloseResolved=true;}if(server)await require(path.join(ROOT,'test/static-server')).closeServer(server);result.finishedAt=new Date().toISOString();save();}
}
if(require.main===module){
  if(process.argv.includes('--plan'))console.log(JSON.stringify(controls()));
  else runtime().catch(error=>{console.error(error);process.exitCode=1;});
}
module.exports={oracle,plan,fixtureSource,controls,nativePixel,formats};
