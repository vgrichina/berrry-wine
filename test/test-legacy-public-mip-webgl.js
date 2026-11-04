#!/usr/bin/env node
'use strict';

// Prebuilt, unmodified production modules; all resource/state/draw operations
// reuse the public x86 COM harness. --plan cannot qualify rendered coverage.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const crypto=require('node:crypto'),vm=require('node:vm');
const {browserFixture}=require('./test-legacy-texture-rendered-contract');
const {versionControls}=require('./test-legacy-mirror-gpu-worker-contract');
const ROOT=path.resolve(__dirname,'..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');

// Independent analytic perspective interpolation on a 32-pixel right triangle.
// Differentiate U/Q and V/Q; choose mip levels from the largest texture-space
// footprint. Solid authored levels isolate LOD from within-level filtering.
function oracle(colors,state,sample) {
  const {x,y}=sample,q=state.q||[1,1,1],n=state.n;
  const Q=q[0]+(q[1]-q[0])*x/32+(q[2]-q[0])*y/32;
  const U=n*q[1]*x/32,V=n*q[2]*y/32;
  const Qx=(q[1]-q[0])/32,Qy=(q[2]-q[0])/32;
  const ux=(n*q[1]/32*Q-U*Qx)/(Q*Q),uy=-U*Qy/(Q*Q);
  const vx=-V*Qx/(Q*Q),vy=(n*q[2]/32*Q-V*Qy)/(Q*Q);
  const rho=16*Math.sqrt(Math.max(ux*ux+vx*vx,uy*uy+vy*vy));
  const lod=Math.max(0,Math.min(4,Math.log2(rho)));
  if(state.mip===1)return colors[0].slice();
  if(state.mip===2)return colors[Math.floor(lod+.5)].slice();
  const lo=Math.floor(lod),hi=Math.min(4,lo+1),w=lod-lo;
  return colors[lo].map((c,i)=>c*(1-w)+colors[hi][i]*w);
}

function plan() {
  const colors=[[255,0,0],[0,255,0],[0,0,255],[255,255,0],[0,255,255]];
  const point={x:4,y:4};
  const states=[
    {label:'NONE minification',n:32,mip:1},
    {label:'POINT after NONE',n:8,mip:2},
    {label:'LINEAR after POINT',n:2*Math.sqrt(8),mip:3},
    {label:'POINT restored',n:8,mip:2},
    ...[.5,2,4,16,32,65536].map(n=>({label:'POINT footprint '+n/2,n,mip:2})),
    {label:'trilinear',n:2*Math.sqrt(8),mip:3,filter:2},
    {label:'perspective',n:16,mip:2,q:[1,.25,.25],
      samples:[1,8,14,20,27].map(x=>({x,y:1}))},
    {label:'NONE restored',n:32,mip:1},
  ].map(s=>({filter:1,samples:[point],...s}));
  const update={level:2,color:[192,48,224],state:{label:'child mip update',n:8,mip:2,filter:1,samples:[point]}};
  const p={colors,states,update,tolerance:2};
  const changed=colors.map(c=>c.slice());changed[update.level]=update.color;
  assert.deepEqual(oracle(changed,update.state,point),update.color);
  assert(oracle(colors,update.state,point).some((c,i)=>Math.abs(c-update.color[i])>p.tolerance),
    'stale child upload discriminates at unchanged tolerance');
  assert.deepEqual(oracle(colors,states[0],point),colors[0]);
  assert.deepEqual(oracle(colors,states[1],point),colors[2]);
  const blend=oracle(colors,states[2],point);
  for(const [i,c] of [0,127.5,127.5].entries())assert(Math.abs(blend[i]-c)<1e-10);
  assert.deepEqual(oracle(colors,states[3],point),colors[2]);
  const perspective=states.find(s=>s.q).samples.map(s=>oracle(colors,states.find(s=>s.q),s));
  assert(new Set(perspective.map(JSON.stringify)).size>=3,'perspective must select distinct levels');
  for(const negative of ['level-zero-only','stale-mip-filter']) {
    let mismatches=0;
    for(const state of states){const broken={...state,mip:negative==='level-zero-only'?1:state.mip===3?2:state.mip};
      for(const sample of state.samples)if(oracle(colors,state,sample).some((c,i)=>Math.abs(c-oracle(colors,broken,sample)[i])>2))mismatches++;}
    assert(mismatches>0,negative+' is discriminating at unchanged tolerance');
  }
  return p;
}

function fixtureSource() {
  let source=browserFixture.toString();
  const replace=(a,b)=>{assert.equal(source.split(a).length,2,'unique public mip seam: '+a.slice(0,60));source=source.replace(a,b);};
  const block=(a,b,replacement)=>{const start=source.indexOf(a),end=source.indexOf(b,start);assert(start>=0&&end>start);replace(source.slice(start,end),replacement);};
  replace('port=manager.createEndpoint(options);','port=manager.createEndpoint({...options,webglVersion:config.webglVersion});');
  replace("new D3DIMGpu.D3DIMGpu({getExports", "new D3DIMGpu.D3DIMGpu({webglVersion:config.webglVersion,getExports");
  replace('const surface=async(width,height,caps)=>{','const surface=async(width,height,caps,count=0)=>{');
  replace('[4,0x1007],[8,height],[12,width]', '[4,0x1007|(count?0x20000:0)],[24,count],[8,height],[12,width]');
  replace('const texture=await surface(2,2,0x1800);',`const texture=await surface(16,16,0x401008,5);
    const levels=[texture];
    const mipCaps=await guard(16);await words(mipCaps.p,[0x401000,0,0,0]);
    for(let i=1;i<5;i++){
      levels.push(await acquire(out=>com('GetAttachedSurface7 mip '+i,levels[i-1],12,mipCaps.p,out)));
      await mipCaps.check();
    }
    evidence.levels=levels;`);
  replace('const rt=await surface(8,8,0x2840);','const rt=await surface(32,32,0x2840);');
  replace("    const texLock=await lock(texture);\n    for(let i=0;i<4;i++){const [r,g,b]=config.texture[i];await write(texLock.pointer+(i>>>1)*texLock.pitch+(i%2)*4,0xff000000|(r<<16)|(g<<8)|b);}\n    await unlock(texture);evidence.textureLock=texLock;",`    evidence.levelLocks=[];
    for(const [level,obj] of levels.entries()){
      const l=await lock(obj),dimension=16>>level;
      eq(await read(lockDesc.p+8),dimension,'public mip height');
      eq(await read(lockDesc.p+12),dimension,'public mip width');
      eq(l.pitch,dimension*4,'public mip exact pitch');
      const [r,g,b]=config.colors[level];
      for(let y=0;y<dimension;y++)for(let x=0;x<dimension;x++)
        await write(l.pointer+y*l.pitch+x*4,0xff000000|(r<<16)|(g<<8)|b);
      await unlock(obj);evidence.levelLocks.push({level,dimension,...l});
    }`);
  replace('[0,0,8,8,0,0x3f800000]','[0,0,32,32,0,0x3f800000]');
  replace("    const vertices=await alloc(96)",`    eq(await read(caps.p+96),0x030303ff,'exact advertised triangle mip filter mask');
    eq(await read(caps.p+40),0x030003c3,'line filter caps unchanged');
    if(config.bootstrap){evidence.status='BOOTSTRAP PASS; no draws';return evidence;}
    const vertices=await alloc(96)`);
  block('    const geometry=async uv=>{','    const describe=async()=>{',`    const geometry=async state=>{
      for(const [i,[x,y]] of [[0,0],[32,0],[0,32]].entries())
        await words(vertices+i*32,[bits(x),bits(y),bits(.5),bits((state.q||[1,1,1])[i]),
          0xffffffff,0,bits(i===1?state.n:0),bits(i===2?state.n:0)]);
    };
    let previousMip=1;
    const setState=async state=>{
      const mip=negative==='level-zero-only'?1:
        negative==='stale-mip-filter'&&state.mip===3?previousMip:state.mip;
      for(const [id,v] of [[16,state.filter],[17,state.filter],[18,mip],[13,1],[14,1]]){
        await tss(id,v);const out=await guard(4);
        await ok(com('GetTextureStageState7',device,36,0,id,out.p));await out.check();
        eq(await read(out.p),v,'public sampler readback '+id);
      }
      previousMip=mip;
    };
`);
  replace('preview.width=preview.height=8','preview.width=preview.height=32');
  replace('p=l.pointer+2*l.pitch+2*4','p=l.pointer+sample.y*l.pitch+sample.x*4');
  replace('for(let y=0;y<8;y++)for(let x=0;x<8;x++)','for(let y=0;y<32;y++)for(let x=0;x<32;x++)');
  replace('new Uint8ClampedArray(dibRGBA),8,8','new Uint8ClampedArray(dibRGBA),32,32');
  replace("const expectedAddress=state.address===4?(mode==='software'?1:3):state.address;\n      const expected=expectedColor(config.texture,sample.uv,state.filter,expectedAddress);",'const expectedAddress=[1,1];\n      const expected=expectedColor(config.colors,state,sample);');
  replace('gl.readPixels(2,8-1-2,1,1','gl.readPixels(sample.x,32-1-sample.y,1,1');
  replace("      eq(actual,expected,'PIXEL ORACLE '+label);\n      if(gpu)eq(row.webglRGBA,[...expected,255],'independent actual WebGL pixels');",`      const close=(got,want,label)=>check(got.length===want.length&&got.every((c,i)=>Math.abs(c-want[i])<=config.tolerance),
        'PIXEL ORACLE '+label+': '+JSON.stringify(got)+' expected '+JSON.stringify(want));
      if(mode==='worker'){
        await until(()=>lastStats?.stats.drawCalls===drawCount,'observed worker stats');
        row.workerStats=lastStats.stats;
        eq(row.workerStats.requestedBackend,'webgl','worker backend');
        eq(row.workerStats.renderApi,'legacy','worker API');
        eq(row.workerStats.fallbacks,0,'worker no fallback');eq(row.workerStats.errors,0,'worker no errors');
        eq(row.workerStats.d3dimSoftwareDrawCallsCompleted,0,'no native software pixels');
        eq(row.workerStats.d3dimFallbackSoftwareDrawCallsCompleted,0,'no fallback software pixels');
        check(row.workerStats.renderEndpointId&&row.workerStats.glRenderer,'actual worker identity');
      }
      const version=gpu?evidence.glRenderer.version:row.workerStats.glVersion;
      check(version.startsWith('WebGL '+config.webglVersion+'.0'),'actual context VERSION '+version);
      close(actual,expected,label);
      if(gpu){close(row.webglRGBA.slice(0,3),expected,'actual GL '+label);eq(row.webglRGBA[3],255,'GL opaque alpha');}`);
  block('    for(const state of config.states){','    evidence.drawCount=drawCount;',`    for(const state of config.states){await setState(state);await geometry(state);await draw();
      for(const sample of state.samples)await observe(state.label+'/'+sample.x+','+sample.y,sample,state);
    }
    if(mode==='worker'){
      for(const [old,next] of [[config.states[0],config.states[1]],[config.states[1],config.states[2]],
        [config.states[2],config.states[3]]]){
        await geometry(old);await setState(old);
        heldRecord={old,next,messages:[]};evidence.queued.push(heldRecord);holding=true;
        await draw();await until(()=>held.length>0,'held production batch');
        await setState(next);heldRecord.liveChangedBeforeDrain=true;
        holding=false;for(const send of held.splice(0))send();
        await observe('queued '+old.label,old.samples[0],old);
        await geometry(next);await draw();await observe('next '+next.label,next.samples[0],next);
      }
      await until(()=>lastStats?.stats.drawCalls===drawCount,'all production stats');evidence.stats=lastStats.stats;
    }else if(gpu)evidence.stats=gpu.snapshot();
`);
  replace('    evidence.drawCount=drawCount;',`    const update=config.update,state=update.state,sample=state.samples[0];
    await setState(state);await geometry(state);await draw();
    await observe('child before overwrite',sample,state);
    const obj=levels[update.level],dimension=16>>update.level,l=await lock(obj);
    eq(await read(lockDesc.p+8),dimension,'updated child height');
    eq(await read(lockDesc.p+12),dimension,'updated child width');
    eq(l.pitch,dimension*4,'updated child pitch');
    const [r,g,b]=update.color,pixel=(0xff000000|(r<<16)|(g<<8)|b)>>>0;
    for(let y=0;y<dimension;y++)for(let x=0;x<dimension;x++)await write(l.pointer+y*l.pitch+x*4,pixel);
    await unlock(obj);
    const verify=await lock(obj);
    eq(verify,l,'child backing and pitch retained');
    for(let y=0;y<dimension;y++)for(let x=0;x<dimension;x++)
      eq(await read(verify.pointer+y*verify.pitch+x*4),pixel,'public child overwrite persisted');
    await unlock(obj);
    evidence.update={object:obj,level:update.level,dimension,lock:l,color:update.color,persisted:true};
    config.colors=config.colors.map((c,i)=>i===update.level?update.color.slice():c.slice());
    await draw();await observe('child after overwrite',sample,state);
    if(mode==='worker'){
      await until(()=>lastStats?.stats.drawCalls===drawCount,'updated child GPU stats');evidence.stats=lastStats.stats;
    }else if(gpu)evidence.stats=gpu.snapshot();
    evidence.drawCount=drawCount;`);
  replace("    for(const [name,obj] of Object.entries({device,texture,rt,padding,d3d,dd}))",`    for(const obj of levels.slice(1))await com('Release acquired mip',obj,2);
    for(const [name,obj] of Object.entries({device,texture,rt,padding,d3d,dd}))`);
  return source;
}

function controls(){
  versionControls();const p=plan(),source=fixtureSource();
  new vm.Script('('+source+')');
  assert(!/mip_seed|mip_surface|mip_draw|fixedLOD/.test(source));
  for(const label of ['DirectDrawCreateEx','QI IDirect3D7','CreateSurface','CreateDevice7',
    'GetAttachedSurface7 mip','SetTextureStageState7','DrawPrimitive7','Lock Surface7'])assert(source.includes(label));
  const context=vm.createContext({D3DIMGpu:{D3DIMGpu:class{_textureLevel(t,d){return {key:d.generation};}}}});
  vm.runInContext('('+staleUploadControl.toString()+')()',context);
  assert.deepEqual(JSON.parse(vm.runInContext(`JSON.stringify((()=>{
    const gpu=new D3DIMGpu.D3DIMGpu(),child={texWidth:4,texHeight:4};
    return [gpu._textureLevel(null,{...child,generation:'old'}).key,
      gpu._textureLevel(null,{...child,generation:'new'}).key,
      gpu._textureLevel(null,{texWidth:8,texHeight:8,generation:'other'}).key];
  })())`,context)),['old','old','other']);
  return {status:'PLANNER ONLY; no pixels',observations:p.states.reduce((n,s)=>n+s.samples.length,0),...p};
}

function config(){
  const pe=fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'));
  return {...plan(),thunkBase:require('../lib/region-map.generated').BASE.THUNK_BASE,
    factoryId:require('../src/api_table.json').find(x=>x.name==='DirectDrawCreateEx').id,
    imageBase:pe.readUInt32LE(pe.readUInt32LE(0x3c)+52)};
}

// Fault injection only: freeze the first decoded 4x4 child generation while
// leaving public writes, other uploads, draws and real GL readback active.
// Served in both the page and render Worker; no production file/module changes.
function staleUploadControl(){
  const original=D3DIMGpu.D3DIMGpu.prototype._textureLevel;
  const frozen=new WeakMap();
  D3DIMGpu.D3DIMGpu.prototype._textureLevel=function(target,desc){
    if(desc.texWidth!==4||desc.texHeight!==4)return original.call(this,target,desc);
    if(!frozen.has(this))frozen.set(this,original.call(this,target,desc));
    return {...frozen.get(this)};
  };
}

async function createServer(getWasm,getNegative=()=>null){
  const scripts=['region-map.generated','gl-command-stream','d3d-command-stream','guest-rpc','guest-thread-host',
    'render-worker','gpu-backend','d3d9-shader','d3d-shader-ir','d3d9-fixed','d3d9-texture','render-clear','d3d9-backend','d3dim-gpu'];
  return require('./static-server').startStaticServer({root:ROOT,crossOriginIsolated:true,handleRequest(req,res){
    // The custom handler runs before static-server's ordinary header path.
    res.setHeader('Cross-Origin-Opener-Policy','same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(pathname==='/lib/d3dim-gpu.js'&&getNegative()==='stale-child-upload'){
      res.writeHead(200,{'Content-Type':'application/javascript','Cache-Control':'no-store'});
      res.end(fs.readFileSync(path.join(ROOT,'lib/d3dim-gpu.js'),'utf8')+'\n;('+staleUploadControl.toString()+')();');return true;
    }
    if(req.url==='/legacy-render.wasm'){res.writeHead(200,{'Content-Type':'application/wasm'});res.end(getWasm());return true;}
    if(req.url!=='/legacy-render-fixture')return false;
    res.writeHead(200,{'Content-Type':'text/html'});res.end(scripts.map(n=>'<script src="/lib/'+n+'.js"></script>').join('\n'));return true;
  }});
}

async function isolationControls(server,bytes){
    for(const route of ['/legacy-render-fixture','/legacy-render.wasm','/lib/guest-worker.js']){
      const response=await fetch('http://127.0.0.1:'+server.address().port+route);
      assert.equal(response.status,200);
      assert.equal(response.headers.get('cross-origin-opener-policy'),'same-origin',route);
      assert.equal(response.headers.get('cross-origin-embedder-policy'),'require-corp',route);
      if(route.endsWith('.wasm'))assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
      else await response.text();
    }
}

async function serverControls(){
  const bytes=Buffer.from([0,97,115,109,1,0,0,0]),server=await createServer(()=>bytes,()=> 'stale-child-upload');
  try{
    await isolationControls(server,bytes);
    // RenderWorker imports the GPU script with its production version query.
    for(const route of ['/lib/d3dim-gpu.js','/lib/d3dim-gpu.js?v=legacy-texture-public-com']){
      const response=await fetch('http://127.0.0.1:'+server.address().port+route);
      assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
      const injected=await response.text();
      assert.equal(injected,fs.readFileSync(path.join(ROOT,'lib/d3dim-gpu.js'),'utf8')+'\n;('+staleUploadControl.toString()+')();');
      new vm.Script(injected);
    }
  }finally{await require('./static-server').closeServer(server);}
}

async function bootstrap(modulePath){
  const routes=new Map([['/legacy-render.wasm',fs.readFileSync(modulePath)],
    ['/lib/host-import-sigs.generated.json',fs.readFileSync(path.join(ROOT,'lib/host-import-sigs.generated.json'))],
    ['/test/binaries/calc.exe',fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'))]]);
  const context=vm.createContext({WebAssembly,performance,setTimeout,fetch:async url=>{
    assert(routes.has(url));const bytes=routes.get(url);
    return {arrayBuffer:async()=>Uint8Array.from(bytes).buffer,json:async()=>JSON.parse(bytes)};
  }});
  try{return await vm.runInContext('('+fixtureSource()+')',context)('software',{...config(),bootstrap:true},oracle.toString());}
  catch(error){error.partial=context.legacyTextureEvidence;throw error;}
}

async function runtime(){
  controls();await serverControls();
  const dir=process.env.LEGACY_PUBLIC_MIP_EVIDENCE,moduleDir=process.env.LEGACY_PUBLIC_MIP_MODULE_DIR;
  const source=process.env.LEGACY_PUBLIC_MIP_SOURCE;
  assert(dir&&moduleDir);assert.match(source||'',/^[0-9a-f]{40}$/);
  fs.mkdirSync(dir,{recursive:true});
  const evidence={status:'RUNNING',source,node:process.version,plan:plan(),modules:[],results:[],negativeControls:[],
    fixtureSha256:sha(fs.readFileSync(__filename)),adaptedFixtureSha256:sha(fixtureSource()),
    publicFixtureSha256:sha(fs.readFileSync(path.join(__dirname,'test-legacy-texture-rendered-contract.js'))),
    calcSha256:sha(fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'))),
    unexecuted:['non-solid mip texels / within-level MIN-MAG discrimination','partial/malformed chains',
      'other per-level formats/padded pitch','legacy combined filters','other dimensions/formats',
      'physical GPU','games / full27']};
  const save=()=>fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(evidence,null,2)+'\n');
  let server,browser,page,wasm,activeNegative=null;
  try{
    for(const name of ['wine-assembly.wasm','wine-assembly.compat.wasm']){
      const bytes=fs.readFileSync(path.join(moduleDir,name)),hash=sha(bytes);
      assert.equal(hash,name==='wine-assembly.wasm'?'1a021b0f9ef7eeba12637c66e8929fdd75383e16c431ee318f812af8dbd78e58':
        '74b34125e175895dc3ca843ccaa555f934611e3bd676e1e95f25aae9c2e7be66');
      evidence.modules.push({name,sha256:hash,bytes:bytes.length});
      fs.writeFileSync(path.join(dir,name),bytes);
      const result=await bootstrap(path.join(moduleDir,name));
      assert.equal(result.status,'BOOTSTRAP PASS; no draws');assert(!result.calls.some(c=>c.label==='DrawPrimitive7'));
      evidence.results.push({module:name,bootstrap:result});save();
    }
    if(process.argv.includes('--bootstrap')){evidence.status='BOOTSTRAP PASS; rendered paths unexecuted';return;}
    server=await createServer(()=>wasm,()=>activeNegative);
    evidence.httpIsolation=[];
    for(const module of evidence.modules){
      wasm=fs.readFileSync(path.join(moduleDir,module.name));
      await isolationControls(server,wasm);
      evidence.httpIsolation.push({module:module.name,sha256:sha(wasm),routes:3,status:'PASS'});
    }
    save();
    evidence.browserOpenedAt=new Date().toISOString();
    browser=await require('puppeteer').launch({headless:true,executablePath:process.env.CHROME||'/usr/bin/google-chrome',
      args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:120000});
    evidence.browser=await browser.version();evidence.browserPid=browser.process().pid;
    const cdp=await browser.target().createCDPSession();evidence.systemInfo=await cdp.send('SystemInfo.getInfo');await cdp.detach();
    const fixture=Function('return ('+fixtureSource()+')')();
    for(const module of evidence.modules){
      wasm=fs.readFileSync(path.join(moduleDir,module.name));
      for(const mode of ['worker','webgl'])for(const webglVersion of [1,2]){
        const cfg={...config(),webglVersion};
        const open=async()=>{page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/legacy-render-fixture');};
        activeNegative=null;await open();const result=await page.evaluate(fixture,mode,cfg,oracle.toString());
        assert.equal(result.status,'PASS');assert.equal(result.observations.length,mode==='worker'?25:19);
        evidence.results.push({module:module.name,webglVersion,...result});save();
        await page.screenshot({path:path.join(dir,module.name+'-'+mode+'-'+webglVersion+'.png')});await page.close();page=null;
        console.log('PASS '+module.name+' '+mode+' WebGL'+webglVersion+' observations '+result.observations.length);
        for(const negative of ['level-zero-only','stale-mip-filter','stale-child-upload']){
          activeNegative=negative;
          await open();let failure;
          try{await page.evaluate(fixture,mode,cfg,oracle.toString(),negative);}catch(error){failure=String(error);}
          const partial=await page.evaluate(()=>globalThis.legacyTextureEvidence);
          evidence.negativeControls.push({module:module.name,mode,webglVersion,negative,failure,partial});save();
          assert(failure?.includes('PIXEL ORACLE'),'negative must fail actual pixels: '+failure);
          assert(partial.calls.some(c=>c.label==='DrawPrimitive7'&&c.result===0));
          assert(partial.observations.some(o=>o.actual.some((c,i)=>Math.abs(c-o.expected[i])>cfg.tolerance)));
          if(negative==='stale-child-upload'){
            assert(partial.update?.persisted,'negative must execute public child writes');
            const before=partial.observations.find(o=>o.label==='child before overwrite');
            const after=partial.observations.find(o=>o.label==='child after overwrite');
            assert(before&&after);assert.deepEqual(after.actual,before.actual,'old generation actually sampled');
            assert.deepEqual(after.expected,cfg.update.color,'independent new authored color');
          }
          if(mode==='worker')assert(partial.observations.some(o=>o.workerStats?.drawCalls>0));
          else assert(partial.observations.some(o=>o.webglRGBA&&o.glError===0));
          await page.close();page=null;console.log('PASS rendered negative '+negative+' '+mode+' WebGL'+webglVersion);
        }
      }
    }
    evidence.status='PASS';
  }catch(error){evidence.status='FAIL; subsequent paths unexecuted';evidence.error=error.stack;
    evidence.partial=error.partial||(page?await page.evaluate(()=>globalThis.legacyTextureEvidence).catch(()=>null):null);throw error;
  }finally{
    if(browser)await browser.close();evidence.browserClosedAt=new Date().toISOString();
    if(server)await require('./static-server').closeServer(server);evidence.helpersClosedAt=new Date().toISOString();save();
  }
}

if(require.main===module){
  if(process.argv.includes('--plan'))serverControls().then(()=>console.log(JSON.stringify(controls(),null,2)))
    .catch(error=>{console.error(error);process.exitCode=1;});
  else runtime().catch(error=>{console.error(error);process.exitCode=1;});
}
module.exports={oracle,plan,fixtureSource,controls,bootstrap,serverControls};
