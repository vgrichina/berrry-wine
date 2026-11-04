#!/usr/bin/env node
'use strict';

// --plan never compiles, instantiates Wasm or starts a browser.
// Runtime: LEGACY_RENDER_EVIDENCE=... node test/test-legacy-texture-rendered-contract.js
// --cube-border adds runtime native cube rejection and characterizes the
// UNADVERTISED BORDER fallback. It does not claim BORDER/cube support.
// Unavailable runtime dependencies are failures/untested, never successful SKIPs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');

function plan(cubeBorder=false) {
  const texture = [[32,64,96], [160,32,64], [64,192,32], [224,128,160]];
  const samples = [{name:'interior',uv:[3/8,5/8]}, {name:'outside',uv:[-1/8,9/8]}];
  const states = [[1,1],[2,1],[1,1],[1,3],[1,1],[2,1],[2,3],[2,1],[1,1]]
    .map(([filter,address],i) => ({label:`state-${i}-${filter===1?'point':'linear'}-${address===1?'wrap':'clamp'}`,filter,address}));
  if(cubeBorder) states.push(...[[1,4],[2,4],[1,3],[1,1],[1,4]].map(([filter,address],i)=>
    ({label:`cube-border-${i}-${filter===1?'point':'linear'}-address-${address}`,filter,address})));
  return {texture,samples,states,cubeBorder};
}

// Independent numerical oracle: normalized texture coordinates; texel centers
// (i+.5)/2. Integrate the four separable tent weights, addressing each tap.
// No production sampling, descriptor, shader or decode helper is called here.
function oracle(texture, uv, filter, address) {
  const tap = i => address===1 ? ((i%2)+2)%2 : Math.max(0,Math.min(1,i));
  if(filter===1) return texture[tap(Math.floor(uv[1]*2))*2+tap(Math.floor(uv[0]*2))].slice();
  const center = uv.map(x=>2*x-.5), base=center.map(Math.floor);
  const fraction=center.map((x,i)=>x-base[i]);
  return [0,1,2].map(channel=>{
    let sum=0;
    for(let y=0;y<2;y++)for(let x=0;x<2;x++)
      sum+=texture[tap(base[1]+y)*2+tap(base[0]+x)][channel]
        *(x?fraction[0]:1-fraction[0])*(y?fraction[1]:1-fraction[1]);
    if(!Number.isInteger(sum)) throw Error('fixture must avoid interpolation/UNORM rounding ambiguity');
    return sum;
  });
}

function planner(cubeBorder=false) {
  const p=plan(cubeBorder),expected=p.states.map(s=>p.samples.map(t=>oracle(p.texture,t.uv,s.filter,s.address===4?1:s.address)));
  assert.notDeepEqual(expected[0][0],expected[1][0],'interior discriminates nearest-only');
  assert.notDeepEqual(expected[0][1],expected[3][1],'outside discriminates point wrap/clamp');
  assert.notDeepEqual(expected[5][1],expected[6][1],'outside discriminates linear wrap/clamp');
  assert.deepEqual(expected[0],expected[2],'point restored');
  assert.deepEqual(expected[5],expected[7],'wrap restored under linear');
  assert.deepEqual(expected[0],expected[8],'all state restored');
  assert.deepEqual(expected[1],[[94,146,70],[142,66,86]],'independent hand-calculated bilinear colors');
  assert.deepEqual(expected[3][1],[64,192,32],'independent out-of-range clamped corner');
  return {status:'PLANNER ONLY; rendering untested',...p,expected,
    ...(cubeBorder?{borderContract:'UNADVERTISED; characterize software WRAP / WebGL CLAMP fallback only',
      borderFallbacks:{software:p.samples.map(t=>oracle(p.texture,t.uv,1,1)),
        webgl:p.samples.map(t=>oracle(p.texture,t.uv,1,3))}}:{})};
}

// Serialized into the browser unchanged. All guest operations, including
// acquisition, Lock/Unlock, sampler setters and draws, execute x86 CALLs.
async function browserFixture(mode, config, oracleSource, negative=null) {
  const expectedColor=(0,eval)('('+oracleSource+')');
  const evidence=globalThis.legacyTextureEvidence={mode,negative,calls:[],observations:[],queued:[],logs:[]};
  const check=(v,s)=>{if(!v)throw Error(s);};
  const eq=(a,b,s)=>check(JSON.stringify(a)===JSON.stringify(b),`${s}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`);
  const until=async(predicate,label)=>{
    const end=performance.now()+10000;
    while(!predicate()){check(performance.now()<end,'timeout '+label);await new Promise(r=>setTimeout(r,5));}
  };
  const module=await WebAssembly.compile(await (await fetch('/legacy-render.wasm')).arrayBuffer());
  const sigs=(await (await fetch('/lib/host-import-sigs.generated.json')).json()).sigs;
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const host={};for(const name of Object.keys(sigs))host[name]=()=>{throw Error('unexpected host import '+name);};
  for(const name of ['log','log_i32','log_block','log_eip','log_api_exit','dx_trace'])
    host[name]=(...args)=>{if(evidence.logs.length<100)evidence.logs.push({name,args});};
  // PE bootstrap announces a new audio epoch; this fixture has no audio.
  // No rendering/resource/device import is stubbed by this accommodation.
  for(const name of ['beep_process_begin','beep_thread_begin'])
    host[name]=(...args)=>{evidence.logs.push({name,args});return 0;};
  let e,raw,link,manager,port,lastStats,gpu,holding=false,heldRecord;
  const held=[];
  if(mode==='worker') {
    const broker=GuestRpc.createMainBroker(memory,host,sigs,{onError:(name,error)=>evidence.logs.push({name,error:String(error)})});
    broker.publish({tickMs:0});
    link=new GuestWorkerLink({slot:0,module,memory,sigs,broker,workerUrl:'/lib/guest-worker.js',
      sharedRenderWorker:true,d3dimGpu:true,d3dimLazySync:false,log:s=>evidence.logs.push(s),
      createRenderEndpoint:async options=>{
        eq(options,{api:'legacy',backend:'webgl'},'production WebGL endpoint');
        manager=new RenderWorker.Manager({module,memory,sigs,imageBase:config.imageBase,
          workerUrl:'/lib/d3d-render-worker.js',sourceVersion:'legacy-texture-public-com',
          reclaimHeap:head=>raw('d3d_render_adopt_free_list',head)});
        await manager.ready;port=manager.createEndpoint(options);await port.ready;
        port.addEventListener('message',event=>{if(event.data.t==='stats')lastStats=event.data;});
        const post=port.postMessage.bind(port);
        port.postMessage=message=>{
          if(holding&&(message.t==='batch'||held.length))held.push(()=>post(message));else post(message);
          if(holding)heldRecord.messages.push(message.t);
        };
        return port;
      }});
    raw=(name,...args)=>link.callExport(name,...args);
    await link.start();
  } else {
    host.memory=memory;host.gpu_gl_call=(...args)=>gpu?gpu.call(...args):0;
    e=new WebAssembly.Instance(module,{host}).exports;
    raw=async(name,...args)=>e[name](...args);
    if(mode==='webgl')gpu=new D3DIMGpu.D3DIMGpu({getExports:()=>e,getMemory:()=>memory.buffer,
      createCanvas:(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;document.body.append(c);return c;},
      onError:s=>evidence.logs.push(s)});
  }
  try {
    const pe=new Uint8Array(await (await fetch('/test/binaries/calc.exe')).arrayBuffer());
    new Uint8Array(memory.buffer).set(pe,await raw('get_staging'));
    check((await raw('load_pe',pe.length))>0,'load_pe bootstrap');
    eq((await raw('get_image_base'))>>>0,config.imageBase,'original PE image base');
    await raw('init_dx_com_thunks');await raw('d3dim_gpu_enable',mode==='software'?0:1);
    const read=async p=>(await raw('guest_read32',p))>>>0;
    const alloc=async n=>{const p=(await raw('guest_alloc',n))>>>0;check(p,'guest allocation');return p;};
    const wa=p=>raw('guest_to_wasm',p);
    const write=async(p,v)=>raw('guest_write32',p,v>>>0);
    const bytes=async(p,b)=>new Uint8Array(memory.buffer,await wa(p),b.length).set(b);
    const words=async(p,values)=>{const d=new DataView(memory.buffer);const w=await wa(p);values.forEach((v,i)=>d.setUint32(w+i*4,v>>>0,true));};
    const guard=async n=>{
      const base=await alloc(n+8),p=base+4;
      await words(base,Array((n+8)/4).fill(0xa5a5a5a5));
      return {p,check:async()=>{eq(await read(base),0xa5a5a5a5,'leading guard');eq(await read(p+n),0xa5a5a5a5,'trailing guard');}};
    };
    const guid=async values=>{const p=await alloc(16);await words(p,values);return p;};
    const stack=await alloc(8192)+4096;
    async function invoke(label,args,object=0,slot=0,target=0) {
      const code=[],word=n=>code.push(n&255,(n>>>8)&255,(n>>>16)&255,n>>>24);
      for(const arg of args.slice().reverse()){code.push(0x68);word(arg);}
      let vtable=0;
      if(object){
        vtable=await read(object);target=await read(vtable+slot*4);check(vtable&&target,label+' published vtable');
        code.push(0xb8);word(object);code.push(0x8b,0x00,0xff,0x90);word(slot*4);
      }else{code.push(0xb8);word(target);code.push(0xff,0xd0);}
      const result=await guard(8);
      code.push(0xa3);word(result.p);code.push(0x89,0x25);word(result.p+4);code.push(0xc3);
      const pc=await alloc(code.length+4);await bytes(pc,code);
      await raw('set_esp',stack);await raw('call_func',pc,0,0,0,0);
      for(let n=0;n<100&&(await raw('get_eip'));n++)await raw('run',10000);
      const row={label,args,object,vtable,slot,target,result:await read(result.p),esp:await read(result.p+4),
        finalEsp:(await raw('get_esp'))>>>0,eip:(await raw('get_eip'))>>>0};
      evidence.calls.push(row);await result.check();
      eq(row.eip,0,label+' bounded completion');eq(row.esp,stack-20,label+' exact stdcall');eq(row.finalEsp,stack-16,label+' caller RET');
      return row.result;
    }
    const com=(label,obj,slot,...args)=>invoke(label,[obj,...args],obj,slot);
    const ok=async value=>eq(await value,0,'HRESULT');
    const output=await guard(4);
    async function acquire(action){await write(output.p,0xa5a5a5a5);await ok(action(output.p));await output.check();
      const obj=await read(output.p);check(obj&&obj!==0xa5a5a5a5,'acquired COM object');return obj;}
    const iidDD7=await guid([0x15e65ec0,0x11d23b9c,0x60002fb9,0x5bea9797]);
    const iidD3D7=await guid([0xf5049e77,0x11d24861,0xa00007a4,0xa82906c9]);
    const hal=await guid([0x84e63de0,0x11cf46aa,0xaa001681,0xb78a4700]);
    // Same catalog thunk routing as Surface47: only factory dispatch id is
    // selected; method calls always dereference the acquired public vtable.
    const thunkWa=config.thunkBase,dv=new DataView(memory.buffer),saved=dv.getUint32(thunkWa+4,true);
    const thunk=(thunkWa-(await raw('get_guest_base'))+(await raw('get_image_base')))>>>0;
    let dd;
    try{dv.setUint32(thunkWa+4,config.factoryId,true);dd=await acquire(out=>invoke('DirectDrawCreateEx',[0,out,iidDD7,0],0,0,thunk));}
    finally{dv.setUint32(thunkWa+4,saved,true);}
    await ok(com('SetCooperativeLevel',dd,20,0,8));
    const d3d=await acquire(out=>com('QI IDirect3D7',dd,0,iidD3D7,out));
    if(config.cubeBorder){
      evidence.cubeRejections=[];
      for(const caps2 of [0x200,0x600,0xfe00,0x400]){
        const desc=await guard(124),out=await guard(4);
        await words(desc.p,Array(31).fill(0));
        for(const [off,v] of [[0,124],[4,0x1007],[8,2],[12,2],[72,32],[76,0x40],[84,32],
          [88,0xff0000],[92,0xff00],[96,0xff],[104,0x1808],[108,caps2]])await write(desc.p+off,v);
        const before=Array.from(new Uint8Array(memory.buffer,await wa(desc.p),124));
        await write(out.p,0xa5a5a5a5);
        const hr=await com('CreateSurface7 reject caps2 '+caps2.toString(16),dd,6,desc.p,out.p,0);
        const value=await read(out.p);await out.check();await desc.check();
        const after=Array.from(new Uint8Array(memory.buffer,await wa(desc.p),124));
        evidence.cubeRejections.push({caps2,hr,output:value,guardsIntact:true,inputUnchanged:JSON.stringify(before)===JSON.stringify(after)});
        eq(hr,0x80004001,'native extended cube caps E_NOTIMPL');eq(value,0,'native cube output cleared');
        eq(after,before,'native cube descriptor unchanged');
      }
    }
    const surface=async(width,height,caps)=>{
      const desc=await alloc(124);await words(desc,Array(31).fill(0));
      for(const [off,v] of [[0,124],[4,0x1007],[8,height],[12,width],[72,32],[76,0x40],[84,32],
        [88,0xff0000],[92,0xff00],[96,0xff],[104,caps]])await write(desc+off,v);
      return acquire(out=>com('CreateSurface',dd,6,desc,out,0));
    };
    const texture=await surface(2,2,0x1800);
    // Separate backing/watch pages without manufacturing surface records.
    const padding=await surface(128,128,0x1800);
    const rt=await surface(8,8,0x2840);
    const device=await acquire(out=>com('CreateDevice7',d3d,4,hal,rt,out));
    evidence.objects={dd,d3d,texture,padding,rt,device};
    const caps=await guard(236);await ok(com('GetCaps7',device,3,caps.p));await caps.check();
    evidence.caps=Array.from(new Uint32Array(memory.buffer,await wa(caps.p),59));
    for(const offset of [40,96]){
      eq((await read(caps.p+offset))&3,3,'advertised legacy point and linear');
      eq((await read(caps.p+offset))&0x03000300,0x03000300,'advertised DX7 MIN/MAG point and linear');
    }
    for(const offset of [48,104]){
      eq((await read(caps.p+offset))&5,5,'advertised wrap and clamp');
      eq((await read(caps.p+offset))&8,0,'unsupported BORDER remains unadvertised');
    }
    for(const offset of [36,92])eq((await read(caps.p+offset))&0x800,0,'unsupported cube remains unadvertised');
    evidence.advertised={textureCaps:[await read(caps.p+36),await read(caps.p+92)],
      addressCaps:[await read(caps.p+48),await read(caps.p+104)],cube:false,border:false};
    const lockDesc=await guard(124);
    const lock=async obj=>{
      await words(lockDesc.p,Array(31).fill(0));await write(lockDesc.p,124);
      await ok(com('Lock Surface7',obj,25,0,lockDesc.p,1,0));await lockDesc.check();
      for(const [offset,value] of [[84,32],[88,0xff0000],[92,0xff00],[96,0xff]])
        eq(await read(lockDesc.p+offset),value,'public Lock exact X8R8G8B8 format');
      return {pointer:await read(lockDesc.p+36),pitch:await read(lockDesc.p+16)};
    };
    const unlock=obj=>ok(com('Unlock Surface7',obj,32,0));
    const texLock=await lock(texture);
    for(let i=0;i<4;i++){const [r,g,b]=config.texture[i];await write(texLock.pointer+(i>>>1)*texLock.pitch+(i%2)*4,0xff000000|(r<<16)|(g<<8)|b);}
    await unlock(texture);evidence.textureLock=texLock;
    const viewport=await alloc(24);await words(viewport,[0,0,8,8,0,0x3f800000]);
    await ok(com('SetViewport7',device,13,viewport));
    for(const [id,v] of [[7,0],[14,0],[15,0],[22,1],[27,0],[28,0],[41,0],[137,0]])
      await ok(com('SetRenderState7',device,20,id,v));
    await ok(com('SetTexture7',device,35,0,texture));
    const tss=(id,value)=>ok(com('SetTextureStageState7',device,37,0,id,value));
    for(const [id,v] of [[1,2],[2,2],[4,2],[5,2],[18,0]])await tss(id,v);
    await ok(com('disable stage1',device,37,1,1,1));
    const vertices=await alloc(96),fv=new DataView(new ArrayBuffer(4));
    const bits=n=>{fv.setFloat32(0,n,true);return fv.getUint32(0,true);};
    let drawCount=0;
    const geometry=async uv=>{
      for(const [i,[x,y]] of [[-8,-8],[24,-8],[-8,24]].entries())
        await words(vertices+i*32,[bits(x),bits(y),bits(.5),bits(1),0xffffffff,0,bits(uv[0]),bits(uv[1])]);
    };
    const setState=async state=>{
      const filter=negative==='nearest'?1:state.filter,address=negative==='border'&&state.address===4
        ?(mode==='software'?3:1):negative==='stale'?1:state.address;
      for(const [id,v] of [[16,filter],[17,filter],[13,address],[14,address]])await tss(id,v);
      if(config.cubeBorder){
        // Accepted setters/readback do not imply advertised sampling support.
        for(const id of [13,14]){
          const out=await guard(4);await ok(com('GetTextureStageState7',device,36,0,id,out.p));
          await out.check();eq(await read(out.p),address,'public address state round trip');
        }
        await tss(15,0xff5030d0); // Distinct BORDER color: unsupported fallback must not be mistaken for it.
      }
    };
    const describe=async()=>{
      const p=(await raw('d3dim_gpu_describe',device))>>>0;check(p,'production descriptor');
      return Array.from(new Uint32Array(memory.buffer,p,45));
    };
    const draw=async()=>{await ok(com('BeginScene7',device,5));
      await ok(com('DrawPrimitive7',device,25,4,0x1c4,vertices,3,0));drawCount++;
      await ok(com('EndScene7',device,6));};
    const preview=document.createElement('canvas');preview.width=preview.height=8;
    preview.style.cssText='width:256px;height:256px;image-rendering:pixelated';document.body.append(preview);
    const observe=async(label,sample,state)=>{
      // Public Lock is the production CPU-access fence, not a test fence.
      const l=await lock(rt),p=l.pointer+2*l.pitch+2*4,value=await read(p);
      const actual=[value>>>16&255,value>>>8&255,value&255];
      const dibRGBA=[];
      for(let y=0;y<8;y++)for(let x=0;x<8;x++){
        const pixel=await read(l.pointer+y*l.pitch+x*4);
        dibRGBA.push(pixel>>>16&255,pixel>>>8&255,pixel&255,255);
      }
      preview.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(dibRGBA),8,8),0,0);
      await unlock(rt);
      const expectedAddress=state.address===4?(mode==='software'?1:3):state.address;
      const expected=expectedColor(config.texture,sample.uv,state.filter,expectedAddress);
      const row={label,sample,state,expectedAddress,actual,expected,rawPixel:value,lock:l,dibRGBA,descriptor:await describe()};evidence.observations.push(row);
      if(gpu){
        const target=[...gpu.targets.values()][0];check(target,'real GPU target');
        const gl=target.device.gpu.gl;target.device.gpu.bindImplicitTarget();
        if(!evidence.glRenderer){
          const ext=gl.getExtension('WEBGL_debug_renderer_info');
          evidence.glRenderer={version:gl.getParameter(gl.VERSION),renderer:gl.getParameter(gl.RENDERER),
            vendor:gl.getParameter(gl.VENDOR),unmaskedRenderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null};
        }
        const rgba=new Uint8Array(4);gl.readPixels(2,8-1-2,1,1,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
        row.webglRGBA=Array.from(rgba);row.glError=gl.getError();
        eq(row.glError,gl.NO_ERROR,'WebGL readback error');
      }
      // Explicit X8R8G8B8 target: each RGB channel is one unquantized byte.
      // Software X and GPU opaque X need not agree; RGB must agree exactly.
      eq(actual,expected,'PIXEL ORACLE '+label);
      if(gpu)eq(row.webglRGBA,[...expected,255],'independent actual WebGL pixels');
    };
    for(const state of config.states){await setState(state);for(const sample of config.samples){
      await geometry(sample.uv);await draw();await observe(state.label+'/'+sample.name,sample,state);
    }}
    if(mode==='worker'){
      for(const sample of config.samples){await geometry(sample.uv);
      const transitions=config.cubeBorder?[[config.states[9],config.states[3]],[config.states[3],config.states[9]],
        [config.states[9],config.states[0]],[config.states[0],config.states[9]]]
        :[[config.states[0],config.states[6]],[config.states[6],config.states[0]]];
      for(const [old,next] of transitions){
        await setState(old);heldRecord={old,next,sample,messages:[]};evidence.queued.push(heldRecord);holding=true;
        await draw();await until(()=>held.length>0,'held production batch');
        await setState(next);heldRecord.liveChangedBeforeDrain=true;
        holding=false;for(const send of held.splice(0))send();
        await observe('queued '+old.label,sample,old);
        await draw();await observe('next '+next.label,sample,next);
      }}
      await until(()=>lastStats?.stats.drawCalls===drawCount,'all production GPU stats');evidence.stats=lastStats.stats;
    }else if(gpu)evidence.stats=gpu.snapshot();
    evidence.drawCount=drawCount;
    if(mode!=='software'){
      eq(evidence.stats.drawCalls,drawCount,'every draw reached GPU');eq(evidence.stats.fallbacks,0,'no software fallback');
      eq(evidence.stats.errors,0,'no backend errors');check(evidence.stats.fences>0&&evidence.stats.syncs>0,'actual GPU fence/readPixels');
    }
    await ok(com('unbind texture',device,35,0,0));
    for(const [name,obj] of Object.entries({device,texture,rt,padding,d3d,dd}))
      evidence.calls.push({label:'Release '+name,refs:await com('Release '+name,obj,2)});
    evidence.status='PASS';return evidence;
  }finally{
    holding=false;for(const send of held.splice(0))send();
    if(gpu)gpu.stop();
    if(link){try{if(manager)evidence.retirement=await manager.stop();}finally{await link.stop();}}
  }
}

async function runtime() {
  const dir=process.env.LEGACY_RENDER_EVIDENCE;
  assert(dir,'LEGACY_RENDER_EVIDENCE must name an ignored run directory');fs.mkdirSync(dir,{recursive:true});
  const {compileSrcWasm}=require('./compile-src');
  const {startStaticServer,closeServer}=require('./static-server');
  const puppeteer=require('puppeteer');
  const closure=require('../tools/watx-closure').watxSourceClosure();
  const source=process.env.LEGACY_RENDER_SOURCE||cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  assert.match(source,/^[0-9a-f]{40}$/,'full committed source identity required');
  const cubeBorder=process.argv.includes('--cube-border');
  const evidence={source,
    inputClosure:Object.fromEntries([...closure.vfs].filter(([p])=>!p.includes('/')).map(([p])=>['src/'+p,sha(fs.readFileSync(path.join(ROOT,'src',p)))])),
    fixtureSha256:sha(fs.readFileSync(__filename)),calc:{path:'test/binaries/calc.exe',sha256:sha(fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe')))},
    plan:planner(cubeBorder),results:[],negativeControls:[]};
  const scripts=['lib/region-map.generated.js','lib/gl-command-stream.js','lib/d3d-command-stream.js','lib/guest-rpc.js',
    'lib/guest-thread-host.js','lib/render-worker.js','lib/gpu-backend.js','lib/d3d9-shader.js','lib/d3d-shader-ir.js',
    'lib/d3d9-fixed.js','lib/d3d9-texture.js','lib/render-clear.js','lib/d3d9-backend.js','lib/d3dim-gpu.js'];
  evidence.productionJS=Object.fromEntries(fs.readdirSync(path.join(ROOT,'lib')).filter(p=>p.endsWith('.js')||p.endsWith('.json'))
    .map(p=>['lib/'+p,sha(fs.readFileSync(path.join(ROOT,'lib',p)))]));
  const config={...plan(cubeBorder),thunkBase:require('../lib/region-map.generated').BASE.THUNK_BASE,
    factoryId:require('../src/api_table.json').find(x=>x.name==='DirectDrawCreateEx').id};
  const bootstrapPE=fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'));
  config.imageBase=bootstrapPE.readUInt32LE(bootstrapPE.readUInt32LE(0x3c)+52);
  let wasm,browser,server,page;
  try {
    // Save BOTH unique tested modules. Runtime selects --compat when requested.
    const moduleDir=process.env.LEGACY_RENDER_MODULE_DIR;
    const canonical=moduleDir?fs.readFileSync(path.join(moduleDir,'wine-assembly.wasm')):compileSrcWasm();
    const compatVfs=moduleDir?null:require('../lib/dispatch-trampoline').applyToVfs(new Map(closure.vfs));
    const compat=moduleDir?fs.readFileSync(path.join(moduleDir,'wine-assembly.compat.wasm'))
      :compileSrcWasm((file,source)=>compatVfs.get(file)||source,{tailCalls:false});
    for(const [name,bytes] of [['canonical',canonical],['compat',compat]]){
      fs.writeFileSync(path.join(dir,name+'.wasm'),bytes);evidence[name+'Sha256']=sha(bytes);
    }
    wasm=process.argv.includes('--compat')?compat:canonical;evidence.testedModuleSha256=sha(wasm);
    server=await startStaticServer({root:ROOT,crossOriginIsolated:true,handleRequest(req,res){
      res.setHeader('Cross-Origin-Opener-Policy','same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
      if(req.url==='/legacy-render.wasm'){res.writeHead(200,{'Content-Type':'application/wasm'});res.end(wasm);return true;}
      if(req.url!=='/legacy-render-fixture')return false;
      res.writeHead(200,{'Content-Type':'text/html'});res.end(scripts.map(p=>`<script src="/${p}"></script>`).join('\n'));return true;
    }});
    browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME||'/usr/bin/chromium',
      args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:120000});
    evidence.browser=await browser.version();
    for(const mode of ['software','webgl','worker']){
      page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/legacy-render-fixture`);
      evidence.results.push(await page.evaluate(browserFixture,mode,config,oracle.toString()));
      await page.screenshot({path:path.join(dir,mode+'.png')});await page.close();page=null;
      console.log('PASS public-COM sampler rendered pixels '+mode);
    }
    for(const [negative,mode] of cubeBorder?['software','webgl','worker'].map(m=>['border',m])
      :['nearest','stale'].map(n=>[n,'software'])){
      page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/legacy-render-fixture`);
      let failure;
      const negativeConfig=negative==='border'?{...config,states:config.states.filter(s=>s.address===4)}:config;
      try{await page.evaluate(browserFixture,mode,negativeConfig,oracle.toString(),negative);}catch(error){failure=String(error);}
      const partial=await page.evaluate(()=>globalThis.legacyTextureEvidence);
      evidence.negativeControls.push({negative,mode,failure,partial});
      if(cubeBorder)await page.screenshot({path:path.join(dir,`negative-${negative}-${mode}.png`)});
      assert(failure?.includes('PIXEL ORACLE'),'negative control must fail pixel oracle, not bootstrap');
      assert(partial.observations.some(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected)),'actual discriminating pixel');
      await page.close();page=null;console.log('PASS rendered negative control rejected '+negative);
    }
    evidence.status='PASS';
  }catch(error){
    evidence.status='FAIL / remaining paths untested';evidence.error=error.stack||String(error);
    if(page)evidence.partial=await page.evaluate(()=>globalThis.legacyTextureEvidence||null).catch(()=>null);
    throw error;
  }finally{
    fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(evidence,null,2)+'\n');
    if(browser)await browser.close();if(server)await closeServer(server);
  }
}

if(require.main===module){
  if(process.argv.includes('--plan'))console.log(JSON.stringify(planner(process.argv.includes('--cube-border')),null,2));
  else runtime().catch(error=>{console.error(error);process.exitCode=1;});
}
module.exports={plan,oracle,planner,browserFixture};
