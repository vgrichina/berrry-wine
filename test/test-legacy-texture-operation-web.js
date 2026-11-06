#!/usr/bin/env node
'use strict';
// Public COM -> shipped module -> WebGL, including owning CPU/render Workers.
// --plan is static; runtime needs LEGACY_OPERATION_EVIDENCE and an absolute
// LEGACY_OPERATION_HARD_CLOSE ISO deadline. Exactly one browser per invocation.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const vm=require('node:vm'),crypto=require('node:crypto'),cp=require('node:child_process');
const base=require('./test-legacy-texture-rendered-contract');
const ROOT=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const scripts=['region-map.generated','gl-command-stream','d3d-command-stream','guest-rpc','guest-thread-host',
  'render-worker','gpu-backend','d3d9-shader','d3d-shader-ir','d3d9-fixed','d3d9-texture','render-clear','d3d9-backend','d3dim-gpu'];

// Independent channel arithmetic. Chosen bytes make every multiply integral;
// no production sampler, stage lowering, shader or rounding helper is used.
function expected(s){
  if(!s.bound||s.color===1)return s.alphaProbe?Array(3).fill(s.diffuse[3]):s.diffuse.slice(0,3);
  const channel=(i,op,a,b)=>{
    const select=n=>(n===2?s.texture:s.diffuse)[i]; // CURRENT is incoming diffuse.
    const x=select(a),y=select(b);
    if(op===2)return x;if(op===3)return y;
    if(op===7)return Math.min(255,x+y); // Explicit UNADVERTISED ADD diagnostic.
    const v=x*y/255;if(!Number.isInteger(v))throw Error('nonintegral authored product');return v;
  };
  return s.alphaProbe?Array(3).fill(channel(3,s.alpha,s.args[2],s.args[3])):
    [0,1,2].map(i=>channel(i,s.color,s.args[0],s.args[1]));
}
function cases(){
  const rows=[];
  for(const c1 of [0,2])for(const c2 of [0,2])for(const a1 of [0,2])for(const a2 of [0,2])
    for(const color of [2,3,4])for(const alpha of [2,3,4])for(const alphaProbe of [false,true])
      rows.push({label:`args-${c1}${c2}${a1}${a2}-${color}/${alpha}-${alphaProbe?'alpha':'rgb'}`,
        color,alpha,args:[c1,c2,a1,a2],alphaProbe});
  for(const color of [2,3,4])for(const alpha of [2,3,4])for(const alphaProbe of [false,true])
    rows.push({label:`rich-${color}/${alpha}-${alphaProbe?'alpha':'rgb'}`,color,alpha,args:[2,0,2,0],alphaProbe,rich:true});
  for(const color of [2,3,4])for(const alpha of [2,3,4])for(const alphaProbe of [false,true]){
    if(color===4&&alpha===4)continue; // Included in the named edge cases below.
    rows.push({label:`unbound-${color}/${alpha}-${alphaProbe?'alpha':'rgb'}`,color,alpha,args:[2,0,2,0],bound:false,alphaProbe});
  }
  for(const alphaProbe of [false,true])for(const extra of [
    {label:'CURRENT',color:2,alpha:3,args:[1,1,1,1]},
    {label:'DISABLE',color:1,alpha:4,args:[2,0,2,0]},
    {label:'unbound',color:4,alpha:4,args:[2,0,2,0],bound:false},
    ...[5,6,7,8,9,10].map(color=>({label:'UNADVERTISED-'+color,color,alpha:4,args:[2,0,2,0],diagnostic:true,rich:true}))])
      rows.push({...extra,label:extra.label+(alphaProbe?'-alpha':'-rgb'),alphaProbe});
  return rows.map(s=>({...s,bound:s.bound!==false,filter:1,address:1,rgbOnly:true,
    texture:s.rich?(s.alphaProbe?[255,255,255,170]:[204,153,102,170]):(s.alphaProbe?[255,255,255,255]:[255,0,255,255]),
    diffuse:s.rich?(s.alphaProbe?[255,255,255,153]:[85,170,255,153]):(s.alphaProbe?[255,255,255,0]:[0,255,255,0])}));
}

// Serialized through the existing immediate extension seam, with ordinary
// Device7 setters/draws. This seam does not use the immediate-mode guest API.
async function operationFixture(c,rows,bootstrap){
  const {mode,negative,evidence,check,eq,raw,read,alloc,write,words,guard,com,ok,acquire,
    hal,surface,lock,unlock,bits,observe,use,initial,countDraw,queue}=c;
  const d3d=evidence.objects.d3d;
  const caps=await guard(236);await ok(com('operation GetCaps7',initial.device,3,caps.p));await caps.check();
  eq(await read(caps.p+180),15,'advertised TextureOpCaps exactly 0xf');
  evidence.operation={caps:15,topology:'public Device7 triangle list, TL 0x1c4; native backend not qualified',
    alpha:'ARGB texture; white RGB SRCALPHA/ZERO witnesses stage alpha on X8 target',states:[],queued:[]};
  const peer={rt:await surface(8,8,0x2840)};
  peer.device=await acquire(out=>com('peer CreateDevice7',d3d,4,hal,peer.rt,out));
  const vp=await alloc(24);await words(vp,[0,0,8,8,0,bits(1)]);
  for(const t of [initial,peer]){
    await ok(com('operation SetViewport7',t.device,13,vp));
    for(const [id,value] of [[7,0],[14,0],[15,0],[22,1],[27,0],[28,0],[41,0],[137,0]])
      await ok(com('operation SetRenderState7',t.device,20,id,value));
    await ok(com('operation stage1 DISABLE',t.device,37,1,1,1));
    for(const [id,value] of [[16,1],[17,1],[18,0],[13,1],[14,1]])
      await ok(com('operation fixed sampler',t.device,37,0,id,value));
  }
  const textures=[];
  for(const [rich,white] of [[false,false],[false,true],[true,false],[true,true]]){
    const desc=await guard(124);await words(desc.p,Array(31).fill(0));
    for(const [off,v] of [[0,124],[4,0x1007],[8,2],[12,2],[72,32],[76,0x41],[84,32],
      [88,0xff0000],[92,0xff00],[96,0xff],[100,0xff000000],[104,0x1800]])await write(desc.p+off,v);
    const obj=await acquire(out=>com('operation CreateSurface ARGB',evidence.objects.dd,6,desc.p,out,0));await desc.check();
    const got=await guard(124);await write(got.p,124);await ok(com('operation GetSurfaceDesc',obj,22,got.p));await got.check();
    eq(await read(got.p+76)&1,1,'public alpha format');eq(await read(got.p+100),0xff000000,'public alpha mask');
    const l=await lock(obj),rgb=white?[255,255,255]:rich?[204,153,102]:[255,0,255];
    for(let y=0;y<2;y++)for(let x=0;x<2;x++)await write(l.pointer+y*l.pitch+x*4,((rich?170:255)*2**24+rgb[0]*65536+rgb[1]*256+rgb[2])>>>0);
    await unlock(obj);textures.push(obj);
  }
  const vertices=await alloc(96),indices=await alloc(8);await words(indices,[0x10000,2]);
  async function state(t,s){
    await ok(com('operation SetTexture7',t.device,35,0,s.bound?textures[+s.alphaProbe+(s.rich?2:0)]:0));
    const values=[[1,s.color],[2,s.args[0]],[3,s.args[1]],[4,s.alpha],[5,s.args[2]],[6,s.args[3]]];
    for(const [id,v] of values){
      await ok(com('operation SetTextureStageState7 '+id,t.device,37,0,id,v));
      const out=await guard(4);await ok(com('operation GetTextureStageState7 '+id,t.device,36,0,id,out.p));
      await out.check();eq(await read(out.p),v,'public TSS roundtrip '+id);
    }
    if(s.color===1||!s.bound||s.label.startsWith('CURRENT')){
      const out=await guard(4);await ok(com('operation GetTexture7',t.device,34,0,out.p));await out.check();
      const got=await read(out.p);eq(got,s.bound?textures[+s.alphaProbe+(s.rich?2:0)]:0,'public binding survives stage state');
      if(got)await com('operation Release GetTexture7 reference',got,2);
    }
    for(const [id,v] of [[27,+s.alphaProbe],[19,s.alphaProbe?5:2],[20,1]])
      await ok(com('operation alpha witness state',t.device,20,id,v));
  }
  async function geometry(s){
    const v=s.diffuse,rgba=(v[3]*2**24+v[0]*65536+v[1]*256+v[2])>>>0;
    for(const [i,[x,y]] of [[-8,-8],[24,-8],[-8,24]].entries())
      await words(vertices+i*32,[bits(x),bits(y),bits(.5),bits(1),rgba,0,bits(.25),bits(.25)]);
  }
  let indexed=false;
  async function draw(t,s){
    await geometry(s);await ok(com('operation Clear7',t.device,10,0,0,1,0xff000000,bits(1),0));
    await ok(com('operation BeginScene7',t.device,5));
    await ok(indexed?com('operation DrawIndexedPrimitive7',t.device,26,4,0x1c4,vertices,3,indices,3,0):
      com('operation DrawPrimitive7',t.device,25,4,0x1c4,vertices,3,0));
    countDraw();await ok(com('operation EndScene7',t.device,6));indexed=!indexed;
  }
  async function witness(t,s,label=s.label){use(t);await observe(label,{uv:[.25,.25]},s);}
  const peerState={...rows[0],label:'peer independent',color:3,alpha:3,args:[2,0,2,0],
    diffuse:[17,51,85,255],alphaProbe:false,bound:true};
  await state(peer,peerState);
  // Cheap preflight proves resource formats, public slots, exact stdcall and
  // every raw setter value without running any rendering or browser code.
  if(bootstrap){for(const s of rows)await state(initial,s);
    evidence.status='BOOTSTRAP PASS; no draws';return;}
  await draw(peer,peerState);await witness(peer,peerState);
  for(const s of rows){
    await state(initial,s);await draw(initial,s);await witness(initial,s);
    evidence.operation.states.push(s.label);
  }
  const rich=rows.find(s=>s.label==='rich-4/4-rgb');
  await state(initial,{...rich,color:1});await draw(initial,rich);
  await witness(initial,{...rich,color:1},'bound DISABLE before reenable');
  await ok(com('reenable COLOROP without rebinding',initial.device,37,0,1,4));
  await draw(initial,rich);await witness(initial,rich,'reenable retains bound texture');
  await witness(peer,peerState,'peer unchanged after operation sweep');
  if(mode==='worker'){
    const s=rows.find(s=>s.label==='rich-4/4-rgb');
    await state(initial,s);use(initial);queue.hold('operation immutable args');
    await draw(initial,s);const packet=await queue.packet();
    // Keep resource lifetimes and CPU-access fences out of this held interval.
    // These public setters change live operands after the command owns its copy.
    for(const [id,v] of [[1,3],[4,3],[2,0],[3,0],[5,0],[6,0]])
      await ok(com('queued live SetTextureStageState7',initial.device,37,0,id,v));
    if(negative==='queued-argument'){
      // Mutate only immutable stage-zero TSS operands in the real 4KB state.
      const d=new DataView(packet.state.buffer,packet.state.byteOffset,packet.state.byteLength);
      const offsets=[2,3,5,6].map(type=>2832+type*4);
      const before=offsets.map(offset=>d.getUint32(offset,true));
      for(const offset of offsets)d.setUint32(offset,0,true);
      evidence.operation.mutation={kind:negative,sequence:packet.sequence,offsets,before,after:offsets.map(offset=>d.getUint32(offset,true))};
    }
    queue.drain();await witness(initial,s,'queued operation survives live setters');
    evidence.operation.queued.push({capturedBeforeLiveChange:true,sequence:packet.sequence});
    await draw(peer,peerState);await witness(peer,peerState,'peer draw after queued operation');
    await witness(initial,s,'primary unchanged after peer draw');
  }
  for(const t of [initial,peer])await ok(com('operation unbind',t.device,35,0,0));
  await com('operation Release peer',peer.device,2);await com('operation Release peer target',peer.rt,2);
  for(const obj of textures)await com('operation Release ARGB texture',obj,2);
  use(initial);
}

function fixtureSource(){
  let s=base.browserFixture.toString();
  const replace=(a,b)=>{assert.equal(s.split(a).length,2,'unique operation fixture seam '+a.slice(0,70));s=s.replace(a,b);};
  replace('const expected=expectedColor(state.palette||config.texture,sample.uv,state.filter,expectedAddress);','const expected=expectedColor(state);');
  replace('if(mode===\'webgl\')gpu=new D3DIMGpu.D3DIMGpu({getExports:',
    'if(mode===\'webgl\')gpu=new D3DIMGpu.D3DIMGpu({webglVersion:config.webglVersion,getExports:');
  replace('port=manager.createEndpoint(options);','port=manager.createEndpoint({...options,webglVersion:config.webglVersion});');
  replace('return {sequence:packet.seq,vertices:', 'return {sequence:packet.seq,state:new Uint8Array(buffer,32,4096),vertices:');
  // Public Lock fences the owning GPU; copy completed DIB bytes locally to
  // avoid sixty-four CPU Worker RPCs for each tiny observation.
  replace('const dibRGBA=[];','const dibRGBA=[],dibView=new DataView(memory.buffer),dibBase=await wa(l.pointer);');
  replace('const pixel=await read(l.pointer+y*l.pitch+x*4);',
    'const pixel=dibView.getUint32(dibBase+y*l.pitch+x*4,true);');
  replace('if(preview&&(config.stateblocks||config.immediate)){','if(preview&&config.captureLabels.includes(label)){');
  replace("      eq(actual,expected,'PIXEL ORACLE '+label);",`      eq(actual,expected,'PIXEL ORACLE '+label);
      for(let pixel=0;pixel<64;pixel++)
        eq(dibRGBA.slice(pixel*4,pixel*4+3),expected,'PIXEL ORACLE full target '+label+' '+pixel);`);
  replace("    if(mode==='worker'&&config.immediate){",`    if(config.bootstrap)return evidence;
    if(mode==='worker'&&config.immediate){`);
  replace("    if(gpu)evidence.stats=gpu.snapshot();",`    if(gpu)evidence.stats=gpu.snapshot();
    const version=evidence.glRenderer?.version;
    check(new RegExp('^WebGL '+config.webglVersion+'[.]0').test(version),'actual requested context version '+version);
    if(mode==='worker'){
      eq(evidence.stats.requestedBackend,'webgl','actual worker backend');
      eq(evidence.stats.renderApi,'legacy','actual worker API');
      eq(evidence.stats.d3dimSoftwareDrawCallsCompleted,0,'no native worker rasterization');
      eq(evidence.stats.d3dimFallbackSoftwareDrawCallsCompleted,0,'no fallback rasterization');
      check(evidence.stats.renderEndpointId,'actual render endpoint identity');
    }`);
  return s;
}
const faults=['select','argument','alpha','current','queued-argument'];
function mutate(source,fault){
  if(fault==='queued-argument')return source;
  const edits={select:['v === 2 || v === 3 || v === 13 ? v : 4','v === 2 ? 3 : v === 3 || v === 13 ? v : 4'],
    argument:['const arg = v => v === 1 ? 0 : v;','const arg = v => v === 1 || v === 2 ? 0 : v;'],
    alpha:['alphaOp: op(d.alphaOp)','alphaOp: 2'],
    current:['const arg = v => v === 1 ? 0 : v;','const arg = v => v === 1 ? 2 : v;']};
  const [a,b]=edits[fault];assert.equal(source.split(a).length,2,'unique production semantic mutation '+fault);return source.replace(a,b);
}
function config(bootstrap=false,negative=null){
  const pe=fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'));
  const labels={select:'rich-2/3-rgb',argument:'rich-2/3-rgb',alpha:'rich-4/3-alpha',current:'CURRENT-rgb',
    'queued-argument':'rich-4/4-rgb'};
  const rows=negative?cases().filter(s=>s.label===labels[negative]||s.label==='rich-4/4-rgb'):cases();
  return {...base.plan(),immediate:true,bootstrap,noPreview:bootstrap,states:[],samples:[],
  captureLabels:['peer independent','rich-4/4-rgb','rich-4/4-alpha','CURRENT-rgb','DISABLE-rgb','unbound-rgb',
    'peer unchanged after operation sweep','queued operation survives live setters','primary unchanged after peer draw'],
  immediateSource:`async function(c){return (${operationFixture.toString()})(c,${JSON.stringify(rows)},${bootstrap});}`,
  thunkBase:require('../lib/region-map.generated').BASE.THUNK_BASE,
  factoryId:require('../src/api_table.json').find(x=>x.name==='DirectDrawCreateEx').id,
  imageBase:pe.readUInt32LE(pe.readUInt32LE(0x3c)+52)};}
function controls(){
  new vm.Script('('+fixtureSource()+')');new vm.Script('('+config().immediateSource+')');
  const rows=cases();for(const s of rows){const rgb=expected(s);assert(rgb.every(x=>Number.isInteger(x)&&x>=0&&x<=255));}
  assert.deepEqual(expected(rows.find(s=>s.label==='rich-4/4-rgb')),[68,102,102]);
  assert.deepEqual(expected(rows.find(s=>s.label==='rich-4/4-alpha')),[102,102,102]);
  const source=fs.readFileSync(path.join(ROOT,'lib/d3dim-gpu.js'),'utf8');for(const f of faults)mutate(source,f);
  return {status:'STATIC ONLY; no rendering',cases:rows.length,argumentDraws:288,unadvertisedDiagnostics:12,
    alphaObservation:'white RGB SRCALPHA/ZERO, independent integral channel arithmetic',faults};
}

async function runtime(){
  const dir=process.env.LEGACY_OPERATION_EVIDENCE;assert(dir);fs.mkdirSync(dir,{recursive:true});
  const hardClose=Date.parse(process.env.LEGACY_OPERATION_HARD_CLOSE);assert(Number.isFinite(hardClose),'explicit finite deadline required');
  const state={status:'PREPARING',startedAt:new Date().toISOString(),source:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
    preflight:controls(),results:[],negatives:[],injections:[],bootstrap:[],modules:{},limitations:[
      'Generated triangles only; no gameplay/full27/native-backend qualification',
      'Ops 5,6,7,8,9,10 are UNADVERTISED diagnostics; observed fallback is not a capability claim',
      'Texture selectors/modifiers beyond DIFFUSE/CURRENT/TEXTURE are not advertised or qualified']};
  const save=()=>fs.writeFileSync(path.join(dir,'browser-result.json'),JSON.stringify(state,null,2)+'\n');
  let wasm,fault=null,server,browser,page,timer;
  const moduleBytes=new Map();
  const fixture=Function('return ('+fixtureSource()+')')();
  try{
    // Resolve the installed package entry rather than guessing an internal
    // layout (Puppeteer 24 and 25 ship different directory structures).
    const entry=require.resolve('puppeteer');
    const dependency=await import(require('node:url').pathToFileURL(entry).href);
    const puppeteer=dependency.default||dependency;
    assert.equal(typeof puppeteer.launch,'function','resolved Puppeteer launch API');
    state.puppeteer={entry,entrySha256:sha(fs.readFileSync(entry)),version:require('puppeteer/package.json').version};
    state.productionFiles=Object.fromEntries(['test/test-legacy-texture-rendered-contract.js','test/test-legacy-texture-operation-caps.js',
      'test/test-legacy-texture-operation-web.js',...fs.readdirSync(path.join(ROOT,'lib')).filter(n=>/\.(js|json)$/.test(n)).map(n=>'lib/'+n)]
      .map(p=>[p,sha(fs.readFileSync(path.join(ROOT,p)))]));
    state.inputClosure=Object.fromEntries([...require('../tools/watx-closure').watxSourceClosure().vfs]
      .filter(([p])=>!p.includes('/')).map(([p])=>['src/'+p,sha(fs.readFileSync(path.join(ROOT,'src',p)))]));
    server=await require('./static-server').startStaticServer({root:ROOT,crossOriginIsolated:true,handleRequest(req,res){
      const url=new URL(req.url,'http://localhost').pathname;
      res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Cache-Control','no-store');
      if(url==='/legacy-render.wasm'){res.writeHead(200,{'Content-Type':'application/wasm'});res.end(wasm);return true;}
      if(url==='/legacy-render-fixture'){res.writeHead(200,{'Content-Type':'text/html'});res.end(scripts.map(p=>'<script src="/lib/'+p+'.js"></script>').join('\n'));return true;}
      if(url==='/lib/d3dim-gpu.js'&&fault){
        const body=mutate(fs.readFileSync(path.join(ROOT,'lib/d3dim-gpu.js'),'utf8'),fault);
        state.injections.push({fault,url:req.url,sha256:sha(body)});
        res.writeHead(200,{'Content-Type':'application/javascript'});res.end(body);return true;
      }
      return false;
    }});state.serverPort=server.address().port;
    for(const name of ['wine-assembly.wasm','wine-assembly.compat.wasm']){
      wasm=fs.readFileSync(path.join(ROOT,'build',name));assert(WebAssembly.validate(wasm));state.modules[name]={bytes:wasm.length,sha256:sha(wasm)};
      moduleBytes.set(name,wasm);
      const pe=fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'));
      const pePin={path:'test/binaries/calc.exe',bytes:pe.length,sha256:sha(pe)};
      if(state.bootstrapPE)assert.deepEqual(pePin,state.bootstrapPE,'bootstrap PE drift');else state.bootstrapPE=pePin;
      const routes=new Map([['/legacy-render.wasm',wasm],['/test/binaries/calc.exe',pe],
        ['/lib/host-import-sigs.generated.json',fs.readFileSync(path.join(ROOT,'lib/host-import-sigs.generated.json'))]]);
      const context=vm.createContext({WebAssembly,performance,setTimeout,fetch:async url=>{assert(routes.has(url));const b=routes.get(url);
        return {arrayBuffer:async()=>Uint8Array.from(b).buffer,json:async()=>JSON.parse(b)};}});
      const cfg=config(true);cfg.imageBase=pe.readUInt32LE(pe.readUInt32LE(0x3c)+52);
      const result=await vm.runInContext('('+fixtureSource()+')',context)('software',cfg,expected.toString());
      assert.equal(result.status,'BOOTSTRAP PASS; no draws');assert(!result.calls.some(c=>/Draw.*Primitive/.test(c.label)));
      state.bootstrap.push({module:name,result});
      const res=await fetch('http://127.0.0.1:'+state.serverPort+'/legacy-render.wasm');assert.equal(res.status,200);
      assert.equal(sha(Buffer.from(await res.arrayBuffer())),sha(wasm));
    }
    state.preBrowser='PASS public COM ABI, ARGB formats, all setters, dependencies, exact modules';save();
    if(process.argv.includes('--preflight')){state.status='PREFLIGHT PASS; no browser';return;}
    assert(Date.now()<hardClose-120000,'browser launch needs cleanup margin');
    timer=setTimeout(()=>{state.deadlineExceeded=true;if(browser)browser.close().catch(()=>{});},Math.min(1200000,hardClose-Date.now()-30000));
    state.browserOpenedAt=new Date().toISOString();
    browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME||'/usr/bin/google-chrome',
      args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:120000});
    state.browser=await browser.version();state.browserPid=browser.process().pid;
    state.profile=browser.process().spawnargs.find(s=>s.startsWith('--user-data-dir='))?.slice(16);
    state.devtools=browser.wsEndpoint();
    browser.process().once('exit',(code,signal)=>{state.browserExit={code,signal,at:new Date().toISOString()};});
    const run=async(name,mode,version,negative=null)=>{
      fault=negative;wasm=moduleBytes.get(name);assert.equal(sha(wasm),state.modules[name].sha256,'pinned served module');
      assert.equal(sha(fs.readFileSync(path.join(ROOT,'build',name))),sha(wasm),'pre-route module drift');page=await browser.newPage();
      const injectionStart=state.injections.length;
      await page.goto('http://127.0.0.1:'+state.serverPort+'/legacy-render-fixture');
      const cfg=config(false,negative);cfg.webglVersion=version;let result,error;
      try{result=await page.evaluate(fixture,mode,cfg,expected.toString(),negative);}catch(e){error=String(e);}
      const partial=error?await page.evaluate(()=>globalThis.legacyTextureEvidence):null;
      const row={module:name,mode,version,negative,result,error,partial};(negative?state.negatives:state.results).push(row);save();
      if(!negative||error&&!error.includes('PIXEL ORACLE'))await page.screenshot({path:path.join(dir,`${name}-${mode}-gl${version}-${negative||'positive'}.png`),fullPage:true});
      if(negative){assert.match(error||'',/PIXEL ORACLE/,'semantic mutant rejected by real pixel readback');
        const target={select:'rich-2/3-rgb',argument:'rich-2/3-rgb',alpha:'rich-4/3-alpha',current:'CURRENT-rgb',
          'queued-argument':'queued operation survives live setters'}[negative];
        assert.equal(partial.observations.at(-1).label,target,'mutation reaches designated semantic observation');
        assert(partial.calls.some(c=>/operation Draw(Indexed)?Primitive7/.test(c.label)&&c.result===0),'successful public draw before rejection');
        assert(partial.observations.some(o=>JSON.stringify(o.actual)!==JSON.stringify(o.expected)),'discriminating readback');
        if(negative==='queued-argument')assert(partial.operation.mutation.before.some((x,i)=>x!==partial.operation.mutation.after[i]),'captured operands actually changed');
        else assert(state.injections.slice(injectionStart).some(i=>i.fault===negative&&i.sha256!==state.productionFiles['lib/d3dim-gpu.js']),'actual served semantic mutant');}
      else {assert.equal(error,undefined);assert.equal(result.status,'PASS');}
      await page.close();page=null;console.log('PASS '+JSON.stringify({name,mode,version,negative}));
    };
    for(const name of ['wine-assembly.wasm','wine-assembly.compat.wasm'])for(const mode of ['webgl','worker'])for(const version of [1,2])await run(name,mode,version);
    for(const version of [1,2])for(const f of faults)await run('wine-assembly.wasm',f==='queued-argument'?'worker':'webgl',version,f);
    for(const [p,hash] of Object.entries(state.productionFiles))assert.equal(sha(fs.readFileSync(path.join(ROOT,p))),hash,'source drift '+p);
    for(const [p,hash] of Object.entries(state.inputClosure))assert.equal(sha(fs.readFileSync(path.join(ROOT,p))),hash,'WAT closure drift '+p);
    for(const [name,pin] of Object.entries(state.modules))assert.equal(sha(fs.readFileSync(path.join(ROOT,'build',name))),pin.sha256,'final module drift '+name);
    assert.equal(sha(fs.readFileSync(path.join(ROOT,state.bootstrapPE.path))),state.bootstrapPE.sha256,'final bootstrap PE drift');
    state.status='PASS';
  }catch(e){state.status='FAIL; subsequent paths untested';state.error=e.stack;throw e;}
  finally{if(timer)clearTimeout(timer);if(browser)await browser.close();if(server)await require('./static-server').closeServer(server);
    state.closedAt=new Date().toISOString();
    state.cleanup={serverClosed:!!server&&!server.listening,profileAbsent:state.profile?!fs.existsSync(state.profile):null,
      browserAbsent:state.browserPid?!fs.existsSync('/proc/'+state.browserPid):null};
    save();}
}
if(require.main===module){if(process.argv.includes('--plan'))console.log(JSON.stringify(controls(),null,2));else runtime().catch(e=>{console.error(e);process.exitCode=1;});}
module.exports={expected,cases,operationFixture,fixtureSource,config,controls,runtime};
