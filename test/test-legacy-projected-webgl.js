#!/usr/bin/env node
'use strict';

// Public COM geometry, immutable command capture, production adapter/compiler,
// actual GL rasterization and synchronous public Lock/readPixels. No software
// renderer or production sampling helper supplies expected values.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const crypto=require('node:crypto'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const mipFixture=require('./test-legacy-public-mip-webgl');

function oracle(colors,state,sample) {
  if(sample.x===1&&sample.y===1&&state.clip)return [11,22,33];
  const uv=state.uvs,weights=[1-(sample.x+sample.y)/32,sample.x/32,sample.y/32];
  const t=uv.map(([u,v],i)=>{
    const z=state.clip&&i===0?-.5:state.geomW?[.2,.8,.6][i]:.5;
    const w=state.geomW?1+.5*z:1;
    const q=state.flags===0x103?state.q+state.qU*u+state.qV*v:1;
    return [(state.flags===0x103?state.scale:1)*u/w,
      (state.flags===0x103?state.scale:1)*v/w,q/w];
  });
  const p=[0,1,2].map(c=>t.reduce((v,a,i)=>v+weights[i]*a[c],0)),Q=p[2];
  const d=[1,2].map(i=>[0,1].map(c=>16*((t[i][c]-t[0][c])/32*Q-p[c]*(t[i][2]-t[0][2])/32)/(Q*Q)));
  const rho=Math.max(...d.map(a=>Math.hypot(...a)));
  const level=state.mip===1?0:Math.max(0,Math.min(4,Math.floor(Math.log2(rho)+.5)));
  const grid=colors[level],n=grid.length;
  const wrap=x=>((Math.floor(x*n)%n)+n)%n;
  return grid[wrap(p[1]/Q)][wrap(p[0]/Q)].slice();
}

function plan(){
  const colors=Array.from({length:5},(_,l)=>Array.from({length:16>>l},(_,y)=>
    Array.from({length:16>>l},(_,x)=>[20+l*39+(x%2)*40,25+l*31+(y%2)*45,30+l*27+((x+y)%2)*35])));
  const base={flags:0x103,q:.3125,qU:.75,qV:.25,scale:1,mip:1,
    uvs:[[.137,.193],[.887,.193],[.137,.943]],
    samples:[{x:8,y:12},{x:12,y:8},{x:12,y:12}]};
  const states=[
    {label:'disabled',flags:0},
    {label:'unit q',q:1,qU:0,qV:0},
    {label:'half q',q:.5,qU:0,qV:0},
    {label:'nonconstant texture q'},
    {label:'independent geometric w',geomW:true},
    {label:'near clip',clip:true},
    {label:'near clip independent w',clip:true,geomW:true},
    {label:'projection disabled restored',flags:0,geomW:true},
    ...[4,8,16,32].flatMap(scale=>[{}, {geomW:true}, {clip:true,geomW:true}].map(extra=>
      ({label:'mip '+scale+' '+JSON.stringify(extra),scale,mip:2,...extra}))),
  ].map(s=>({...base,...s}));
  for(const state of states)if(state.clip)state.samples=[...state.samples,{x:1,y:1}];
  return {colors,states,spatial:true,tolerance:2,update:null};
}

function fixtureSource(){
  let source=mipFixture.fixtureSource();
  const replace=(a,b)=>{assert.equal(source.split(a).length,2,'unique projected seam '+a.slice(0,70));source=source.replace(a,b);};
  const block=(a,b,c)=>{const start=source.indexOf(a),end=source.indexOf(b,start);assert(start>0&&end>start);replace(source.slice(start,end),c);};
  block('    const geometry=async state=>{','    const describe=async()=>{',`    const matrix=await alloc(64),indices=await alloc(8);
    await words(indices,[0x10000,2]);
    const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
    await words(matrix,identity.map(bits));
    for(const type of [1,2,3])await ok(com('SetTransform7 identity',device,11,type,matrix));
    const geometry=async state=>{
      for(const [i,[x,y]] of [[-1,1],[1,1],[-1,-1]].entries()){
        const [u,v]=state.uvs[i];
        const z=state.clip&&negative!=='unclipped'&&i===0?-.5:state.geomW?[.2,.8,.6][i]:.5;
        const w=state.geomW?1+.5*z:1;
        await words(vertices+i*32,[bits(x*w),bits(y*w),bits(z),0,0xffffffff,0,bits(u),bits(v)]);
      }
    };
    const setState=async state=>{
      const projection=identity.slice();if(state.geomW)projection[11]=.5;
      await words(matrix,projection.map(bits));await ok(com('SetTransform7 projection',device,11,3,matrix));
      const m=identity.slice();m[0]=m[5]=state.scale;m[2]=state.qU;m[6]=state.qV;m[14]=state.q;
      await words(matrix,m.map(bits));await ok(com('SetTransform7 TEXTURE0',device,11,16,matrix));
      const got=await guard(64);await ok(com('GetTransform7 TEXTURE0',device,12,16,got.p));
      await got.check();for(let i=0;i<16;i++)eq(await read(got.p+4*i),bits(m[i]),'matrix round trip');
      await tss(11,0);await tss(24,state.flags);
      const flags=await guard(4);await ok(com('GetTextureStageState flags',device,36,0,24,flags.p));
      await flags.check();eq(await read(flags.p),state.flags,'projection flags round trip');
      for(const [id,v] of [[16,1],[17,1],[18,state.mip],[13,1],[14,1]])await tss(id,v);
    };
`);
  replace("await ok(com('DrawPrimitive7',device,25,4,0x1c4,vertices,3,0));",`await ok(config.indexed
      ?com('DrawIndexedPrimitive7',device,26,4,0x1e2,vertices,3,indices,3,0)
      :com('DrawPrimitive7',device,25,4,0x1e2,vertices,3,0));`);
  replace("const draw=async()=>{await ok(com('BeginScene7',device,5));",`const draw=async()=>{
      await ok(com('Clear7',device,10,0,0,1,0xff0b1621,bits(1),0));
      await ok(com('BeginScene7',device,5));`);
  replace("const version=gpu?evidence.glRenderer.version:row.workerStats.glVersion;",`const version=gpu?evidence.glRenderer.version:row.workerStats.glVersion;
      for(const cap of evidence.advertised.textureCaps)eq(cap&0x400,0,'PROJECTED capability stays clear');`);
  // The endpoint message carries a SharedArrayBuffer-backed immutable capture.
  // Hold delivery, mutate TEXTURE0 through real public calls, then drain.
  block('    if(mode===\'worker\'){\n      for(const [a,b]','    if(config.update){',`    if(mode==='worker'){
      for(const old of config.states.filter(s=>s.flags===0x103&&s.geomW)){
        await geometry(old);await setState(old);
        // Keep post-mutation controls inside texels under the established TL
        // 1/16-pixel fill displacement. The old (projected) draw still tests
        // every authored sample and its clipped-away Clear pixel.
        const next={...old,q:8,qU:0,qV:0,scale:1,flags:0,
          samples:old.samples.filter(s=>s.x!==s.y)};
        heldRecord={old,next,messages:[]};evidence.queued.push(heldRecord);holding=true;
        await draw();await until(()=>held.length>0,'held production batch');
        await setState(next);heldRecord.liveChangedBeforeDrain=true;
        holding=false;for(const send of held.splice(0))send();
        for(const sample of old.samples)await observe('queued '+old.label,sample,old);
        await draw();for(const sample of next.samples)await observe('next '+next.label,sample,next);
      }
      await until(()=>lastStats?.stats.drawCalls===drawCount,'all production stats');evidence.stats=lastStats.stats;
    }else if(gpu)evidence.stats=gpu.snapshot();
`);
  return source;
}

// These injections preserve valid COM calls, staging, shader syntax and GPU
// submission. Only rendered semantic behavior changes.
function mutateAdapter(source,negative){
  const replace=(a,b)=>{assert.equal(source.split(a).length,2,'unique fault seam '+negative);source=source.replace(a,b);};
  const flags='stage.transformFlags = vertexType === 6 ? 0 : 0x103;';
  if(negative==='ignored')replace(flags,'stage.transformFlags = 0;');
  if(negative==='early')replace(flags,`if(vertexType!==6)for(let n=0;n<order.length;n++){
    const p=n*stride,q=projected.getFloat32(p+32,true);
    projected.setFloat32(p+24,projected.getFloat32(p+24,true)/q,true);
    projected.setFloat32(p+28,projected.getFloat32(p+28,true)/q,true);
    projected.setFloat32(p+32,1,true);
  }`+flags);
  if(negative==='lod')replace('mag: d.mag, min: d.min, mip: d.mip','mag: d.mag, min: d.min, mip: 0');
  if(negative==='live-matrix')replace('const matrixWa = e.d3dim_gpu_supplied_matrix(self) >>> 0;',`e.d3dim_gpu_state_override(0);
    const matrixWa = e.d3dim_gpu_supplied_matrix(self) >>> 0;`);
  return source;
}

function adapterFaultControls(){
  const original=fs.readFileSync(path.join(ROOT,'lib/d3dim-gpu.js'),'utf8');
  let cases=0;
  // Execute the actual transformed-input block, not merely its shader syntax.
  // Type 6 is deliberately unprojected; the early-division fault must preserve
  // that control while corrupting the projected type-4/type-5 coordinates.
  for(const vertexType of [4,5,6])for(const fault of [null,'ignored','early']){
    const source=fault?mutateAdapter(original,fault):original;
    const start=source.indexOf('      if (textured && vertexType >= 4) {'),end=source.indexOf('\n      const draw = {',start);
    assert(start>0&&end>start);
    const inputStride=vertexType===4?32:40,bytes=new Uint8Array(inputStride*3),view=new DataView(bytes.buffer);
    for(let n=0;n<3;n++){
      view.setFloat32(n*inputStride+12,.25,true);
      view.setFloat32(n*inputStride+24,2+n,true);view.setFloat32(n*inputStride+28,4+n,true);
      if(vertexType>=5){view.setFloat32(n*inputStride+32,2,true);view.setFloat32(n*inputStride+36,1,true);}
    }
    const matrix=new Float32Array([1,0,0,0,0,1,0,0,0,0,0,0,0,0,2,1]);
    const run=vm.runInNewContext('(function(){let drawBytes=bytes,stride=inputStride,attributes=[{usage:5,type:1}];'+
      source.slice(start,end)+';return {drawBytes,stride,attributes,stage};})',
      {textured:true,vertexType,inputStride,bytes,view,stage:{},order:[0,1,2],self:1,e:{d3dim_gpu_supplied_matrix:()=>0}});
    const result=run.call({_view(){},u8:new Uint8Array(matrix.buffer)}),out=new DataView(result.drawBytes.buffer);
    assert.equal(result.stride,40);assert.equal(result.attributes[0].type,3);
    assert.equal(result.stage.transformFlags,fault==='ignored'||vertexType===6?0:0x103);
    const early=fault==='early'&&vertexType!==6;
    for(let n=0;n<3;n++){
      assert.equal(out.getFloat32(n*40+12,true),.25,'geometric RHW preserved');
      assert.equal(out.getFloat32(n*40+24,true),(2+n)/(early?2:1));
      assert.equal(out.getFloat32(n*40+28,true),(4+n)/(early?2:1));
      assert.equal(out.getFloat32(n*40+32,true),early?1:2);
      assert.equal(out.getFloat32(n*40+36,true),1);
    }
    cases++;
  }
  return {cases,status:'PASS isolated actual adapter transform block; no pixels'};
}

function controls(){
  const p=plan();new vm.Script('('+fixtureSource()+')');
  // A reciprocal followed by multiplication need not preserve a unit varying.
  // This numerical witness complements the actual perspective mip regression.
  const denominator=Math.fround(5/37),reciprocal=Math.fround(1/denominator);
  assert(Math.fround(denominator*reciprocal)<1);
  assert.equal(Math.fround(0*reciprocal),0);
  // Exercise both producers and both consumers of the finite-input varying.
  // Zero-valid must remain the same contract with programmed pixel linkage.
  const fixed=require('../lib/d3d9-fixed'),shader=require('../lib/d3d9-shader');
  const draw={vertexShader:null,pixelShader:null,textures:[{width:16,height:16}],
    attributes:[{register:0,usage:9,usageIndex:0,type:3,offset:0},
      {register:1,usage:5,usageIndex:0,type:3,offset:16}],
    fixedFunction:{lighting:false,fog:false,specular:false,stages:[{colorOp:2,colorArg1:2,
      alphaOp:2,alphaArg1:2,transformFlags:0x103,texCoordIndex:0},{colorOp:1}]}};
  const viewport={x:0,y:0,width:32,height:32,minZ:0,maxZ:1};
  const compiled=fixed.compile(draw,viewport);
  assert.match(compiled.vertex.source,/ff_projectInput0 = .*\? 0\.0 : 1\.0/);
  assert.match(compiled.pixel.source,/ff_projectInput0 == 0\.0/);
  const ps=new Uint32Array([0xffff0101,66,0xb00f0000,1,0x800f0000,0xb0e40000,0xffff]);
  const linked=shader.compile(ps,{projectedStages:[3]});
  assert.match(linked.source,/ff_projectInput0 == 0\.0/);
  const mixed=fixed.compile({...draw,pixelShader:ps},viewport,linked);
  assert.match(mixed.vertex.source,/ff_projectInput0 = .*\? 0\.0 : 1\.0/);
  const levels=new Set();
  for(const old of p.states){
    const next={...old,flags:0,q:8,qU:0,qV:0,scale:1,
      samples:old.samples.filter(s=>s.x!==s.y)};
    for(const state of [old,next])for(const sample of state.samples){
      if(sample.x===1&&sample.y===1)continue;
      assert.deepEqual(oracle(p.colors,state,sample),oracle(p.colors,state,{x:sample.x+.0625,y:sample.y+.0625}),
        'sample must stay inside the same texel/mip under retained TL fill displacement: '+state.label);
    }
  }
  for(const state of p.states.filter(s=>s.mip===2))for(const sample of state.samples){
    const color=oracle(p.colors,state,sample);if(color[0]!==11)levels.add(Math.floor((color[0]-20)/39));
  }
  assert(levels.size>=3,'nontrivial mip coverage');
  for(const negative of ['ignored','early','lod','live-matrix'])new vm.Script(mutateAdapter(fs.readFileSync(path.join(ROOT,'lib/d3dim-gpu.js'),'utf8'),negative));
  return {status:'PREFLIGHT SOURCE ONLY; no browser pixels',states:p.states.length,oracleLevels:[...levels],adapterFaults:adapterFaultControls()};
}

function config(){
  const pe=fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'));
  return {...plan(),imageBase:pe.readUInt32LE(pe.readUInt32LE(0x3c)+52),
    thunkBase:require('../lib/region-map.generated').BASE.THUNK_BASE,
    factoryId:require('../src/api_table.json').find(x=>x.name==='DirectDrawCreateEx').id};
}

async function transportPreflight(wasm){
  const {D3DIMGpu}=require('../lib/d3dim-gpu'),fixed=require('../lib/d3d9-fixed');
  const records=[];
  const routes=new Map([['/legacy-render.wasm',wasm],
    ['/lib/host-import-sigs.generated.json',fs.readFileSync(path.join(ROOT,'lib/host-import-sigs.generated.json'))],
    ['/test/binaries/calc.exe',fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'))]]);
  const inspect=(e,memory,wa)=>{
    const d=new DataView(memory.buffer);assert.equal(d.getUint32(wa+8,true),4);
    const adapter=new D3DIMGpu({getExports:()=>e,getMemory:()=>memory.buffer});
    const target={width:32,height:32,textureKeys:new Set()};
    adapter._target=()=>target;adapter._prepare=()=>{};
    adapter._submit=(_target,draw)=>{
      assert.equal(draw.stride,40);assert.equal(draw.fixedFunction.stages[0].transformFlags,0x103);
      const shader=fixed.compile(draw,new Float32Array([0,0,32,32]));
      assert.match(shader.pixel.source,/ff_uv\.z/);
      const v=new DataView(draw.vertices.buffer,draw.vertices.byteOffset,draw.vertices.byteLength);
      const vertices=Array.from({length:draw.vertices.byteLength/40},(_,i)=>
        ({rhw:v.getFloat32(i*40+12,true),q:v.getFloat32(i*40+32,true)}));
      assert(new Set(vertices.map(v=>v.q)).size>1);
      assert(vertices.some(v=>Math.abs(v.rhw-v.q)>1e-3));
      records.push({stride:draw.stride,vertices,vertexShaderSHA256:hash(shader.vertex.source),pixelShaderSHA256:hash(shader.pixel.source)});
      return 1;
    };
    try{assert.equal(adapter.call(0x20000,wa,0),1);}finally{
      for(const texture of adapter.textures.values()){texture.watch?.release();texture.paletteWatch?.release();}
    }
  };
  const context=vm.createContext({WebAssembly,performance,setTimeout,inspect,
    document:{createElement:()=>({style:{}}),body:{append(){}}},fetch:async url=>{
    assert(routes.has(url));const bytes=routes.get(url);
    return {arrayBuffer:async()=>Uint8Array.from(bytes).buffer,json:async()=>JSON.parse(bytes)};
  }});
  let source=fixtureSource();
  const replace=(a,b)=>{assert.equal(source.split(a).length,2);source=source.replace(a,b);};
  replace('host.memory=memory;host.gpu_gl_call=(...args)=>gpu?gpu.call(...args):0;',
    'host.memory=memory;host.gpu_gl_call=(...args)=>{if(args[0]===0x20000)inspect(e,memory,args[1]);return 1;};');
  replace("await raw('d3dim_gpu_enable',mode==='software'?0:1);","await raw('d3dim_gpu_enable',1);");
  replace('await geometry(state);await draw();\n      for(const sample of state.samples)',
    "await geometry(state);await draw();evidence.status='TRANSPORT PASS; no graphics context or pixels';return evidence;\n      for(const sample of state.samples)");
  const result=await vm.runInContext('('+source+')',context)('software',{...config(),states:[plan().states[4]]},oracle.toString());
  assert.equal(result.status,'TRANSPORT PASS; no graphics context or pixels');assert(records.length>0);
  assert(result.calls.some(c=>c.label==='DrawPrimitive7'&&c.result===0));
  return {status:result.status,records,publicDraws:result.calls.filter(c=>c.label==='DrawPrimitive7')};
}

async function runtime(){
  const dir=process.env.LEGACY_PROJECTED_EVIDENCE;assert(dir);fs.mkdirSync(dir,{recursive:true});
  const hardClose=Date.parse(process.env.LEGACY_PROJECTED_HARD_CLOSE||'2026-11-04T07:45:00Z');
  assert(Number.isFinite(hardClose),'explicit finite browser close time');
  const seal=JSON.parse(fs.readFileSync(path.join(dir,'source-seal.json')));
  const state={status:'PREPARING',seal,preflight:controls(),results:[],negatives:[],injections:[]};
  const save=()=>fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(state,null,2)+'\n');
  const scripts=['region-map.generated','gl-command-stream','d3d-command-stream','guest-rpc','guest-thread-host','render-worker',
    'gpu-backend','d3d9-shader','d3d-shader-ir','d3d9-fixed','d3d9-texture','render-clear','d3d9-backend','d3dim-gpu'];
  let wasm,negative=null,server,browser,page,timer;
  try{
    const puppeteer=require('puppeteer');
    const esmPath=path.join(path.dirname(require.resolve('puppeteer/package.json')),'lib/esm/puppeteer/puppeteer.js');
    await import(require('node:url').pathToFileURL(esmPath).href);
    state.puppeteer={require:require.resolve('puppeteer'),import:esmPath};
    assert.equal(require('puppeteer/package.json').version,'24.31.0');
    for(const [name,pin] of Object.entries(seal.files))assert.equal(hash(fs.readFileSync(path.join(ROOT,name))),pin.sha256,name);
    assert.equal(hash(fs.readFileSync('/home/user/legacy-solid-browser/package-lock.json')),seal.puppeteerLockSha256);
    server=await require('./static-server').startStaticServer({root:ROOT,crossOriginIsolated:true,handleRequest(req,res){
      const name=new URL(req.url,'http://localhost').pathname;
      res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
      res.setHeader('Cache-Control','no-store');
      if(name==='/legacy-render-fixture'){
        res.writeHead(200,{'Content-Type':'text/html'});res.end(scripts.map(n=>'<script src="/lib/'+n+'.js"></script>').join('\n'));return true;
      }
      if(name==='/legacy-render.wasm'){res.writeHead(200,{'Content-Type':'application/wasm'});res.end(wasm);return true;}
      if(name==='/lib/d3dim-gpu.js'&&negative&&negative!=='unclipped'){
        const body=mutateAdapter(fs.readFileSync(path.join(ROOT,'lib/d3dim-gpu.js'),'utf8'),negative);
        state.injections.push({negative,url:req.url,sha256:hash(body)});
        res.writeHead(200,{'Content-Type':'application/javascript'});res.end(body);return true;
      }
      return false;
    }});
    state.serverPort=server.address().port;
    state.bootstrap=[];
    for(const name of ['wine-assembly.wasm','wine-assembly.compat.wasm']){
      wasm=fs.readFileSync(path.join(ROOT,'build',name));assert(WebAssembly.validate(wasm));
      const transport=await transportPreflight(wasm);
      // Instantiate the exact served module and acquire actual public COM
      // surfaces/device/mip chain before Chrome. Bootstrap exits before draws.
      const routes=new Map([['/legacy-render.wasm',wasm],
        ['/lib/host-import-sigs.generated.json',fs.readFileSync(path.join(ROOT,'lib/host-import-sigs.generated.json'))],
        ['/test/binaries/calc.exe',fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'))]]);
      const context=vm.createContext({WebAssembly,performance,setTimeout,fetch:async url=>{
        assert(routes.has(url));const bytes=routes.get(url);
        return {arrayBuffer:async()=>Uint8Array.from(bytes).buffer,json:async()=>JSON.parse(bytes)};
      }});
      const bootstrap=await vm.runInContext('('+fixtureSource()+')',context)('software',{...config(),bootstrap:true},oracle.toString());
      assert.equal(bootstrap.status,'BOOTSTRAP PASS; no draws');
      assert(!bootstrap.calls.some(c=>/Draw(Indexed)?Primitive7/.test(c.label)));
      state.bootstrap.push({module:name,sha256:hash(wasm),result:bootstrap,transport});
      for(const route of ['/legacy-render-fixture','/legacy-render.wasm','/lib/guest-worker.js']){
        const response=await fetch('http://127.0.0.1:'+state.serverPort+route);assert.equal(response.status,200);
        assert.equal(response.headers.get('cross-origin-opener-policy'),'same-origin');
        assert.equal(response.headers.get('cross-origin-embedder-policy'),'require-corp');
        if(route.endsWith('.wasm'))assert.equal(hash(Buffer.from(await response.arrayBuffer())),hash(wasm));else await response.text();
      }
    }
    for(const [name,pin] of Object.entries(seal.files))if(name.startsWith('lib/')||name.startsWith('test/')){
      const response=await fetch('http://127.0.0.1:'+state.serverPort+'/'+name);assert.equal(response.status,200);
      assert.equal(hash(Buffer.from(await response.arrayBuffer())),pin.sha256,'HTTP '+name);
    }
    state.preBrowser='PASS actual imports, dependency/source/module pins, HTTP/isolation';save();
    if(process.argv.includes('--preflight')){state.status='PREFLIGHT PASS; no browser';return;}
    assert(Date.now()<hardClose-300000,'launch deadline');
    timer=setTimeout(()=>{state.timedOut=true;save();if(browser)browser.close().catch(()=>{});},Math.min(840000,hardClose-Date.now()));
    state.browserOpenedAt=new Date().toISOString();
    browser=await puppeteer.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:120000});
    state.browser=await browser.version();state.browserPid=browser.process().pid;
    const cdp=await browser.target().createCDPSession();state.systemInfo=await cdp.send('SystemInfo.getInfo');await cdp.detach();
    let implementation={fixtureSource,config,oracle},revision=0;
    const run=async(name,mode,version,indexed,fault=null)=>{
      negative=fault;wasm=fs.readFileSync(path.join(ROOT,'build',name));
      page=await browser.newPage();await page.goto('http://127.0.0.1:'+state.serverPort+'/legacy-render-fixture');
      const cfg={...implementation.config(),webglVersion:version,indexed};
      if(fault){const index={ignored:2,early:4,lod:10,unclipped:5,'live-matrix':4}[fault];cfg.states=[cfg.states[index]];}
      let result,error;
      const fixture=Function('return ('+implementation.fixtureSource()+')')();
      try{result=await page.evaluate(fixture,mode,cfg,implementation.oracle.toString(),fault);}catch(e){error=String(e);}
      const partial=await page.evaluate(()=>globalThis.legacyTextureEvidence);
      const row={module:name,mode,version,indexed,fault,revision,result,error,partial:error?partial:undefined};
      (fault?state.negatives:state.results).push(row);save();
      if(error&&!fault&&process.env.LEGACY_PROJECTED_REPAIR_WAIT==='1'&&revision<2){
        fs.writeFileSync(path.join(dir,'first-failure-'+revision+'.json'),JSON.stringify({...state,failedAt:new Date().toISOString()},null,2)+'\n');
        await page.close();page=null;
        const signal=path.join(dir,'repair-ready-'+revision+'.json');
        state.waitingForRepair={signal,error,at:new Date().toISOString()};save();
        while(!fs.existsSync(signal)){
          assert(!state.timedOut&&Date.now()<hardClose-60000,'repair deadline');
          await new Promise(r=>setTimeout(r,500));
        }
        const nextSeal=JSON.parse(fs.readFileSync(path.join(dir,'source-seal.json')));
        for(const [name,pin] of Object.entries(nextSeal.files))assert.equal(hash(fs.readFileSync(path.join(ROOT,name))),pin.sha256,'repair pin '+name);
        (state.repairs||=[]).push({request:JSON.parse(fs.readFileSync(signal)),seal:nextSeal});
        delete state.waitingForRepair;delete require.cache[__filename];implementation=require(__filename);revision++;save();
        return true; // restart the entire positive matrix after a repair
      }
      if(fault){assert.match(error||'',/PIXEL ORACLE/,'rendered semantic rejection');
        assert(partial.calls.some(c=>/Draw(Indexed)?Primitive7/.test(c.label)&&c.result===0));
        assert(partial.observations.at(-1).actual.some((c,i)=>Math.abs(c-partial.observations.at(-1).expected[i])>cfg.tolerance));
      }else{assert.equal(error,undefined);assert.equal(result.status,'PASS');}
      await page.close();page=null;console.log('PASS '+JSON.stringify({name,mode,version,indexed,fault}));
    };
    // Canonical direct and queued first, then bounded compatibility coverage.
    const cells=['wine-assembly.wasm','wine-assembly.compat.wasm'].flatMap(name=>['webgl','worker'].flatMap(mode=>
      [1,2].flatMap(version=>[false,true].map(indexed=>[name,mode,version,indexed]))));
    for(let i=0;i<cells.length;i++)if(await run(...cells[i]))i=-1;
    for(const version of [1,2])for(const fault of ['ignored','early','lod','unclipped','live-matrix'])
      await run('wine-assembly.wasm',fault==='live-matrix'?'worker':'webgl',version,false,fault);
    state.status='PASS';
  }catch(error){state.status='FAIL; later paths unexecuted';state.error=error.stack;
    if(page)state.partial=await page.evaluate(()=>globalThis.legacyTextureEvidence).catch(()=>null);throw error;
  }finally{
    if(timer)clearTimeout(timer);if(browser)await browser.close();state.browserClosedAt=new Date().toISOString();
    if(server)await require('./static-server').closeServer(server);
    state.closedAt=new Date().toISOString();save();
  }
}
if(require.main===module){if(process.argv.includes('--plan'))console.log(JSON.stringify(controls()));
else runtime().catch(e=>{console.error(e);process.exitCode=1;});}
module.exports={oracle,plan,fixtureSource,mutateAdapter,controls,config,transportPreflight};
