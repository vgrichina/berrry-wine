#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const contract=require('./test-legacy-generated-normal-reflection-projected');
const ROOT=path.resolve(__dirname,'..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const config=contract.config,oracle=contract.oracle;
// Runs inside the page. Read only the production endpoint's held buffers.
function captureQueue(encoder,evidence){
  const s=evidence.currentState;
  return (evidence.pendingNativeIndices||[]).map(index=>{
    const item=encoder.buffers[index],d=item.view;
    for(let offset=0;offset<item.used;){
      const size=d.getUint32(offset,true),type=d.getUint32(offset+12,true),stride=type===5?40:32;
      if(!(size>0&&offset+size<=item.used&&d.getUint32(offset+16,true)===3))throw Error('owned record framing');
      if(type!==(s.expectedUV?3:5)||d.getUint32(offset+24,true)!==3*stride)throw Error('owned projected representation');
      const normal=[[-4/5,3/5,0],[-3/5,0,4/5],[0,4/5,3/5]],reflection=[[62/75,-34/75,1/3],[38/75,2/3,41/75],[-2/3,-2/15,11/15]];
      const vertices=Array.from({length:3},(_,i)=>Array.from({length:stride/4},(_,c)=>c===4||c===5?d.getUint32(offset+4128+i*stride+c*4,true):d.getFloat32(offset+4128+i*stride+c*4,true)));
      for(let i=0;i<3;i++){
        const expected=s.expectedUV?s.expectedUV[i]:[...(s.mode===1?normal:reflection)[i],1];
        for(let c=0;c<expected.length;c++)if(Math.abs(vertices[i][6+c]-expected[c])>1e-6)throw Error('owned generated input');
        if(Math.abs(vertices[i][3]-(s.tl?1:1/[1,5/4,3/2][i]))>1e-6)throw Error('owned geometric reciprocal W');
      }
      if(!(evidence.captured||=[]).some(r=>r.label===s.label))evidence.captured.push({label:s.label,type,bytes:size,vertices});
      offset+=size;
    }
    return Array.from(new Uint8Array(item.buffer,0,item.used));
  });
}
function fixtureSource(){
  let s=contract.fixtureSource();
  const replace=(a,b)=>{assert.equal(s.split(a).length,2,'browser generated seam '+a.slice(0,80));s=s.replace(a,b);};
  replace('const held=[];let nativeEncoder,nativeWorker,endpointBuffers;', 'const held=[];let nativeEncoder,nativeWorker,endpointBuffers;'+captureQueue.toString());
  const start=s.indexOf('    if(config.queued){\n      nativeEncoder='),end=s.indexOf('    const read=async',start);
  assert(start>0&&end>start);replace(s.slice(start,end),'');
  replace("if(message.t==='init')endpointBuffers=message.buffers;",`if(message.t==='init'){
            endpointBuffers=message.buffers;
            nativeEncoder={buffers:endpointBuffers.map(buffer=>({buffer,view:new DataView(buffer),used:0}))};
          }
          if(holding&&message.t==='batch'){
            nativeEncoder.buffers[message.index].used=message.bytes;
            (evidence.pendingNativeIndices||=[]).push(message.index);
          }`);
  replace('if(holding)heldRecord.messages.push(message.t);','if(holding&&heldRecord)heldRecord.messages.push(message.t);');
  replace("if(config.queued)holding=true;", "if(config.queued){heldRecord={messages:[]};holding=true;}");
  replace("        check(held.length>0,'actual batch delivery held before mutation');", "        await until(()=>held.length>0,'actual batch delivery held before mutation');");
  // Retain the public Lock fence; read its completed backing in one operation
  // instead of 1024 cross-worker RPCs per observation.
  const a=s.indexOf('      const dibRGBA=[];'),b=s.indexOf("      preview.getContext",a);
  replace(s.slice(a,b),`      const dibRGBA=[],view=new DataView(memory.buffer),base=await wa(l.pointer);
      for(let y=0;y<32;y++)for(let x=0;x<32;x++){
        const pixel=view.getUint32(base+y*l.pitch+x*4,true);
        dibRGBA.push(pixel>>>16&255,pixel>>>8&255,pixel&255,255);
      }
`);
  replace('if(nativeEncoder){evidence.transport=nativeEncoder.snapshot();', 'if(nativeWorker){evidence.transport=nativeEncoder.snapshot();');
  replace('if(gpu)gpu.stop();if(nativeEncoder){', 'if(gpu)gpu.stop();if(nativeWorker){');
  return s;
}
function controls(){
  new vm.Script('('+fixtureSource()+')');const c=config();
  assert.equal(c.tolerance,0);assert.equal(c.states.length,23);
  for(const s of c.states)for(const p of s.samples){
    const expected=oracle(c.colors,s,p);
    for(const dx of [-.0625,0,.0625])for(const dy of [-.0625,0,.0625])assert.deepEqual(oracle(c.colors,s,{x:p.x+dx,y:p.y+dy}),expected);
    if(!s.expectedUV)assert.notDeepEqual(oracle(c.colors,s,p,true),expected);
  }
  return {status:'PLAN PASS; no GPU pixels',tolerance:c.tolerance,states:c.states.length,fixtureSHA256:hash(fixtureSource()),oracleSHA256:hash(oracle.toString())};
}
function mutateAdapter(s){return s;}

async function runtime(){
  const dir=process.env.LEGACY_PROJECTED_EVIDENCE;assert(dir);fs.mkdirSync(dir,{recursive:true});
  const hardClose=Date.parse(process.env.LEGACY_PROJECTED_HARD_CLOSE);
  assert(Number.isFinite(hardClose),'explicit finite browser close time');
  const seal=JSON.parse(fs.readFileSync(path.join(dir,'source-seal.json')));
  const state={status:'PREPARING',seal,preflight:controls(),results:[],negatives:[],injections:[],
    scope:'generated normal/reflection only'};
  const save=()=>fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(state)+'\n');
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
      const transport={status:'public COM bootstrap below; no GPU preflight pixels'};
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
    const run=async(name,mode,version,indexed,vb=false,fault=null,generatedMode=null)=>{
      negative=fault;wasm=fs.readFileSync(path.join(ROOT,'build',name));
      page=await browser.newPage();await page.goto('http://127.0.0.1:'+state.serverPort+'/legacy-render-fixture');
      const cfg={...implementation.config(),webglVersion:version,indexed,vb,queued:mode==='worker'};
      if(fault)cfg.states=[cfg.states.find(s=>s.mode===generatedMode&&s.flags===0x103&&!s.expectedUV)];
      let result,error;
      const fixture=Function('return ('+implementation.fixtureSource()+')')();
      try{result=await page.evaluate(fixture,mode,cfg,implementation.oracle.toString(),fault);}catch(e){error=String(e);}
      const partial=await page.evaluate(()=>globalThis.legacyTextureEvidence);
      if(error)await page.screenshot({path:path.join(dir,'failure.png')});
      const row={module:name,mode,version,indexed,vb,fault,generatedMode,revision,result,error,partial:error?partial:undefined};
      (fault?state.negatives:state.results).push(row);save();
      if(fault){assert.match(error||'',/PIXEL ORACLE/,'rendered semantic rejection');
        assert(partial.calls.some(c=>/Draw(Indexed)?Primitive(VB)?7/.test(c.label)&&c.result===0));
        assert(partial.observations.at(-1).actual.some((c,i)=>Math.abs(c-partial.observations.at(-1).expected[i])>cfg.tolerance));
      }else{assert.equal(error,undefined);assert.equal(result.status,'PASS');}
      await page.close();page=null;console.log('PASS '+JSON.stringify({name,mode,version,indexed,fault}));
    };
    // Canonical direct and queued first, then bounded compatibility coverage.
    const cells=['wine-assembly.wasm','wine-assembly.compat.wasm'].flatMap(name=>['webgl','worker'].flatMap(mode=>
      [1,2].flatMap(version=>[false,true].flatMap(indexed=>[false,true].map(vb=>[name,mode,version,indexed,vb])))));
    for(const cell of cells)await run(...cell);
    for(const version of [1,2])for(const generatedMode of [1,3])for(const fault of ['normal-bytes','matrix','supplied','constant-q','texture-z','early',...(generatedMode===3?['normal-mode']:[])])
      await run('wine-assembly.wasm','webgl',version,false,false,fault,generatedMode);
    state.status='PASS';
  }catch(error){state.status='FAIL; later paths unexecuted';state.error=error.stack;
    if(page)state.partial=await page.evaluate(()=>globalThis.legacyTextureEvidence).catch(()=>null);throw error;
  }finally{
    if(timer)clearTimeout(timer);if(browser)await browser.close();state.browserClosedAt=new Date().toISOString();
    if(server)await require('./static-server').closeServer(server);
    state.closedAt=new Date().toISOString();save();
  }
}

if(require.main===module){if(process.argv.includes('--plan'))console.log(JSON.stringify(controls(),null,2));else runtime().catch(e=>{console.error(e);process.exitCode=1;});}
module.exports={config,oracle,fixtureSource,controls,runtime,captureQueue};
