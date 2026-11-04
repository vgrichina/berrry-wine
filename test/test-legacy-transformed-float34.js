#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const previous=require('./test-legacy-projected-webgl');
const expanded=require('./test-legacy-count-selector-webgl');
const ROOT=path.resolve(__dirname,'..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
// Expected coordinates are authored independently of the FVF decoder. The
// rational interpolation and analytic mip rule are retained from the audit.
function oracle(colors,state,sample,details=false){
  const weights=[1-(sample.x+sample.y)/32,sample.x/32,sample.y/32];
  const active=state.flags!==0,projected=!!(state.flags&256),count=state.flags&255;
  const h=state.sets[state.selector].map((supplied,i)=>{
    const a=[supplied[0],supplied.length>1?supplied[1]:0,supplied.length>2?supplied[2]:0,supplied.length>3?supplied[3]:1];
    const m=state.matrix;
    const b=active?[0,1,2,3].map(c=>a.reduce((sum,x,j)=>sum+x*m[4*j+c],0)):a;
    const w=state.geomW?1+.5*[.2,.8,.6][i]:1;
    return [b[0]/w,b[1]/w,(projected?b[count-1]:1)/w];
  });
  const p=[0,1,2].map(c=>h.reduce((sum,a,i)=>sum+weights[i]*a[c],0)),Q=p[2];
  const gradients=[1,2].map(i=>[0,1].map(c=>16*((h[i][c]-h[0][c])/32*Q-p[c]*(h[i][2]-h[0][2])/32)/(Q*Q)));
  const rho=Math.max(...gradients.map(g=>Math.hypot(...g)));
  const level=state.mip===1?0:Math.max(0,Math.min(4,Math.floor(Math.log2(rho)+.5)));
  if(details)return {level,rho,uv:[p[0]/Q,p[1]/Q]};
  const grid=colors[level],n=grid.length,wrap=x=>((Math.floor(x*n)%n)+n)%n;
  return grid[wrap(p[1]/Q)][wrap(p[0]/Q)].slice();
}
function fvf(dimensions){return dimensions.reduce((f,d,i)=>(f|([0,3,0,1,2][d]<<(16+2*i)))>>>0,0xe2|(dimensions.length<<8));}
function plan(){
  const colors=previous.plan().colors,states=[];
  // The selected set is preceded by every other dimension; sets 0 and 7
  // exercise both ends. Equal total strides isolate different set offsets.
  for(const dimensions of [[1,2,3,4,1,3,2,4],[4,3,2,1,4,2,1,3]])for(const selector of [0,1,2,3,7]){
    const dimension=dimensions[selector];
    const sets=dimensions.map((d,s)=>[[.137+s*.031,.193+s*.027,.337+s*.019,.719+s*.023],
      [.887+s*.031,.193+s*.027,.537+s*.019,.919+s*.023],
      [.137+s*.031,.943+s*.027,.737+s*.019,1.119+s*.023]].map(a=>a.slice(0,d)));
    for(const flags of dimension>=3?[2,3,4,0x102,0x103,0x104]:[])for(const scale of flags?[1,16]:[1]){
      const matrix=[scale,.75,.5,.375, .25,.25,.375,.625,  .1875,.3125,.4375,.5625, .093,.3125,.625,.4375];
      for(const geomW of [false,true])states.push({label:`dims${dimensions.join('')}/TEX${selector}/FLOAT${dimension}/flags${flags}/scale${scale}/w${geomW}`,
        dimensions,dimension,sets,selector,flags,matrix,geomW,mip:scale===1?1:2,fvf:fvf(dimensions)});
    }
  }
  const candidates=Array.from({length:17},(_,x)=>Array.from({length:17},(_,y)=>({x:x+5,y:y+5}))).flat().filter(p=>p.x+p.y<29);
  for(const state of states){state.samples=candidates.filter(s=>[state,{...state,flags:0}].every(control=>[-.0625,0,.0625].every(dx=>[-.0625,0,.0625].every(dy=>
    JSON.stringify(oracle(colors,control,s))===JSON.stringify(oracle(colors,control,{x:s.x+dx,y:s.y+dy})))))).slice(0,3);
    assert.equal(state.samples.length,3,state.label);}
  return {colors,states,spatial:true,tolerance:2,update:null};
}
function config(){return {...previous.config(),...plan()};}
function fixtureSource(){
  let source=expanded.fixtureSource();
  source=source.replace("if(mode==='software'&&args[0]===0x20000&&!nativeEncoder)inspect(e,memory,args[1],evidence);",'');
  const replace=(a,b)=>{assert.equal(source.split(a).length,2,'dimension seam '+a.slice(0,70));source=source.replace(a,b);};
  replace('const vertices=await alloc(264)','const vertices=await alloc(480)');
  // Bounded ownership: the immediate Device7 path is the tested contract.
  source=source.replaceAll('(config.withNormals?0x812:0x8e2)','currentFVF');
  replace('const geometry=async state=>{',`let currentFVF=0;const geometry=async state=>{
      const layout=state.dimensions.slice();
      if(negative==='default-v')layout[state.selector]=2;
      currentFVF=layout.reduce((f,d,i)=>(f|([0,3,0,1,2][d]<<(16+2*i)))>>>0,0xe2|(layout.length<<8));
      if(negative==='layout')currentFVF=(currentFVF^(3<<16)^(3<<18))>>>0;
      if(state.overrideFVF)currentFVF=state.overrideFVF;`);
  replace('const coords=state.sets.flatMap(set=>{','const coords=state.sets.flatMap((set,setIndex)=>{');
  replace('await words(vertices+i*88,','await words(vertices+i*(24+4*layout.reduce((a,b)=>a+b,0)),');
  // Negative controls still use real successful public Draws. They change
  // authored bytes or selector, never expected pixels or production code.
  {const start=source.indexOf("          if(negative!=='early')return set[i];"),end=source.indexOf('        });',start);
    assert(start>0&&end>start);source=source.slice(0,start)+"          return negative==='default-v'&&setIndex===state.selector?[set[i][0],.28125]:set[i];\n"+source.slice(end);}
  replace('if(negative===\'component\'){',"if(negative==='default-w'){for(let c=0;c<4;c++)m[12+c]=0;}\n      if(negative==='component'){");
  replace("          return negative==='default-v'&&setIndex===state.selector?[set[i][0],.28125]:set[i];", `          const a=set[i].slice();
          if(setIndex===state.selector){
            if(negative==='drop-z')a[2]=0;
            if(negative==='drop-w'||negative==='wrong-default'){
              if(a.length===3)a.push(0);else a[3]=1;
            }
          }
          return a;`);
  replace("      if(negative==='default-v')layout[state.selector]=2;", "      if(negative==='wrong-default')layout[state.selector]=4;");
  replace('config.states.filter(s=>[0x102,0x103,0x104].includes(s.flags)&&s.geomW)',
    'config.states.filter(s=>s.flags&&s.geomW)');
  replace('if(d.getUint32(offset+12,true)===4){', 'if([4,5,6].includes(d.getUint32(offset+12,true))){');
  replace("    await ok(com('unbind texture',device,35,0,0));",`    if(!negative){
      const base=config.states[0];evidence.rejected=[];
      for(const state of [{...base,selector:8},{...base,overrideFVF:0x9e2}]){
        await geometry(state);await setState(state);await ok(com('BeginScene7 invalid',device,5));
        const result=await (config.indexed?com('DrawIndexedPrimitive7 invalid',device,26,4,currentFVF,vertices,3,indices,3,0):
          com('DrawPrimitive7 invalid',device,25,4,currentFVF,vertices,3,0));
        eq(result>>>0,0x80070057,'invalid supplied selector/count');
        await ok(com('EndScene7 invalid',device,6));evidence.rejected.push({fvf:currentFVF,selector:state.selector,result});
      }
    }
    await ok(com('unbind texture',device,35,0,0));`);
  return source;
}
// The plan is immutable across cells; avoid rebuilding it for every candidate.
let controlsCache;
function controls(){
  if(controlsCache)return controlsCache;
  const p=plan();new vm.Script('('+fixtureSource()+')');
  const witnesses={};
  for(const fault of ['selector','drop-z','drop-w','wrong-default','component']){
    const candidates=p.states.filter(s=>(fault!=='wrong-default'||s.dimension===3)&&(fault!=='drop-w'||s.dimension===4));
    const state=candidates.find(s=>s.samples.some(sample=>{
      let wrong={...s};
      if(fault==='selector')wrong.selector=(s.selector+1)%8;
      if(['drop-z','drop-w','wrong-default'].includes(fault))wrong.sets=s.sets.map((set,j)=>j===s.selector?set.map(a=>{
        a=a.slice();if(fault==='drop-z')a[2]=0;else if(a.length===3)a.push(0);else a[3]=1;return a;
      }):set);
      if(fault==='component'){if(!(s.flags&256))return false;const m=s.matrix.slice(),c=(s.flags&255)-1,other=c===3?2:3;for(let r=0;r<4;r++)m[4*r+c]=s.matrix[4*r+other];wrong.matrix=m;}
      return oracle(p.colors,s,sample).some((v,i)=>Math.abs(v-oracle(p.colors,wrong,sample)[i])>2);
    }));assert(state,'independent pixel witness '+fault);witnesses[fault]=state.label;
  }
  witnesses['captured-matrix']=p.states.find(s=>s.flags===0x103&&s.geomW&&s.dimension===4).label;
  return controlsCache={status:'PLAN PASS; no drawn pixels',states:p.states.length,tolerance:2,witnesses,
    boundary:'supplied FLOAT3/4 ordinary COUNT2/3/4 and PROJECTED COUNT2/3/4, mixed dimensions and geometric w'};
}
async function offline(){
  const p=plan(),results=[];
  for(const queued of [false,true])for(const indexed of [false,true]){
    const context=await offlineContext();
    let result;try{result=await vm.runInContext('('+fixtureSource()+')',context)('software',{...config(),indexed,queued},oracle.toString());}catch(e){fs.writeFileSync(path.join(process.env.LEGACY_PROJECTED_EVIDENCE||'/tmp','offline-first-failure.json'),JSON.stringify(context.legacyTextureEvidence));throw e;}
    assert.equal(result.status,'PASS');results.push(result);
  }
  for(const negative of ['selector','drop-z','drop-w','wrong-default','component']){
    const context=await offlineContext(),witness=controls().witnesses[negative];let error;
    try{await vm.runInContext('('+fixtureSource()+')',context)('software',{...config(),states:p.states.filter(s=>s.label===witness)},oracle.toString(),negative);}catch(e){error=String(e);}
    assert.match(error||'',/PIXEL ORACLE/);assert(context.legacyTextureEvidence.calls.some(c=>c.label==='DrawPrimitive7'&&c.result===0));
    results.push({negative,error,partial:context.legacyTextureEvidence});
  }
  return results;
}
function inspectQueue(encoder,e,memory,evidence){
  let checked=0;
  for(const index of evidence.pendingNativeIndices||[])for(let offset=0;offset<encoder.buffers[index].used;){
    const item=encoder.buffers[index],d=item.view,read=n=>d.getUint32(offset+n,true),size=read(0);
    assert(size>0);const type=read(12),state=evidence.currentState;
    assert([5,6].includes(type));assert.equal(read(24),40*read(16));
    const m=state.matrix.slice(),count=state.flags&255;
    if(type===5)for(let r=0;r<4;r++)m[4*r+2]=state.matrix[4*r+count-1];
    for(let c=0;c<16;c++)assert(Math.abs(d.getFloat32(offset+32+3136+c*4,true)-m[c])<1e-5,'captured matrix '+c);
    const vertices=offset+32+4096;
    for(let i=0;i<read(16);i++){
      const supplied=state.sets[state.selector][i],z=supplied[2]??0,w=supplied[3]??1;
      assert(Math.abs(d.getFloat32(vertices+i*40+32,true)-z)<1e-6,'owned z');
      assert(Math.abs(d.getFloat32(vertices+i*40+36,true)-w)<1e-6,'owned w');
    }
    checked++;offset+=size;
  }
  assert(checked>0,'actual extended records inspected after live mutation');
  evidence.ownedExtendedRecords=(evidence.ownedExtendedRecords||0)+checked;
}
async function offlineContext(){
  const routes=new Map([['/legacy-render.wasm',fs.readFileSync(path.join(ROOT,'build/wine-assembly.wasm'))],
    ['/test/binaries/calc.exe',fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'))],
    ['/lib/host-import-sigs.generated.json',fs.readFileSync(path.join(ROOT,'lib/host-import-sigs.generated.json'))]]);
  return vm.createContext({WebAssembly,performance,setTimeout,
    NativeStream:require('../lib/d3d-command-stream'),NativeWorker:require('node:worker_threads').Worker,
    nativeWorkerPath:path.join(ROOT,'lib/d3d-render-worker.js'),inspectQueue,
    fetch:async url=>{assert(routes.has(url));const b=routes.get(url);return {arrayBuffer:async()=>Uint8Array.from(b).buffer,json:async()=>JSON.parse(b)};},
    document:{createElement:()=>({style:{},getContext:()=>({putImageData(){}})}),body:{append(){}}},ImageData:class{}});
}

async function runtime(){
  const dir=process.env.LEGACY_PROJECTED_EVIDENCE;assert(dir);fs.mkdirSync(dir,{recursive:true});
  const hardClose=Date.parse(process.env.LEGACY_PROJECTED_HARD_CLOSE);
  assert(Number.isFinite(hardClose),'explicit finite browser close time');
  const seal=JSON.parse(fs.readFileSync(path.join(dir,'source-seal.json')));
  const remaining=false;
  const state={status:'PREPARING',seal,preflight:controls(),results:[],negatives:[],injections:[],
    scope:controls().boundary};
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
        const body=((s)=>s)(fs.readFileSync(path.join(ROOT,'lib/d3dim-gpu.js'),'utf8'),negative);
        state.injections.push({negative,url:req.url,sha256:hash(body)});
        res.writeHead(200,{'Content-Type':'application/javascript'});res.end(body);return true;
      }
      return false;
    }});
    state.serverPort=server.address().port;
    state.bootstrap=[];
    for(const name of ['wine-assembly.wasm','wine-assembly.compat.wasm']){
      wasm=fs.readFileSync(path.join(ROOT,'build',name));assert(WebAssembly.validate(wasm));
      const transport={status:"predecessor transport seam retained; new actual software draws tested separately"};
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
    const run=async(name,mode,version,indexed,fault=null,count=null)=>{
      negative=fault;wasm=fs.readFileSync(path.join(ROOT,'build',name));
      page=await browser.newPage();await page.goto('http://127.0.0.1:'+state.serverPort+'/legacy-render-fixture');
      const cfg={...implementation.config(),webglVersion:version,indexed};
      if(fault)cfg.states=cfg.states.filter(s=>s.label===controls().witnesses[fault]);
      let result,error;
      const fixture=Function('return ('+implementation.fixtureSource()+')')();
      try{result=await page.evaluate(fixture,mode,cfg,implementation.oracle.toString(),fault);}catch(e){error=String(e);}
      const partial=await page.evaluate(()=>globalThis.legacyTextureEvidence);
      const row={module:name,mode,version,indexed,fault,count,revision,result,error,partial:error?partial:undefined};
      (fault?state.negatives:state.results).push(row);save();
      if(fault){assert.match(error||'',/PIXEL ORACLE/,'rendered semantic rejection');
        assert(partial.calls.some(c=>/Draw(Indexed)?Primitive7/.test(c.label)&&c.result===0));
        assert(partial.observations.at(-1).actual.some((c,i)=>Math.abs(c-partial.observations.at(-1).expected[i])>cfg.tolerance));
      }else{assert.equal(error,undefined);assert.equal(result.status,'PASS');}
      if(!fault)await page.screenshot({path:path.join(dir,'capture-'+mode+'-'+version+'-'+indexed+'.png')});
      await page.close();page=null;console.log('PASS '+JSON.stringify({name,mode,version,indexed,fault}));
    };
    // Canonical direct and queued first, then bounded compatibility coverage.
    const cells=['wine-assembly.wasm'].flatMap(name=>['webgl','worker'].flatMap(mode=>
      [1,2].flatMap(version=>[false,true].map(indexed=>[name,mode,version,indexed]))));
    if(!remaining)for(const cell of cells)await run(...cell);
    for(const indexed of [false,true])for(const version of [1,2])for(const mode of ['webgl','worker'])for(const fault of ['selector','drop-z','drop-w','wrong-default','component'])await run('wine-assembly.wasm',mode,version,indexed,fault);
    for(const indexed of [false,true])for(const version of [1,2])await run('wine-assembly.wasm','worker',version,indexed,'captured-matrix');
    state.status='PASS';
  }catch(error){state.status='FAIL; later paths unexecuted';state.error=error.stack;
    if(page)state.partial=await page.evaluate(()=>globalThis.legacyTextureEvidence).catch(()=>null);throw error;
  }finally{
    if(timer)clearTimeout(timer);if(browser)await browser.close();state.browserClosedAt=new Date().toISOString();
    if(server)await require('./static-server').closeServer(server);
    state.closedAt=new Date().toISOString();save();
  }
}
if(require.main===module){
 if(process.argv.includes('--plan'))console.log(JSON.stringify(controls(),null,2));
 else if(process.argv.includes('--offline'))offline().then(results=>{const out=process.env.LEGACY_PROJECTED_EVIDENCE; if(out){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'offline.json'),JSON.stringify(results));}console.log('OFFLINE PASS '+results.length);}).catch(e=>{console.error(e);process.exitCode=1;});
 else runtime().catch(e=>{console.error(e);process.exitCode=1;});
}
module.exports={oracle,plan,config,fvf,fixtureSource,controls,offline,runtime};
