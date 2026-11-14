#!/usr/bin/env node
'use strict';

// --plan never compiles, instantiates Wasm or starts a browser.
// Runtime: LEGACY_RENDER_EVIDENCE=... node test/test-legacy-texture-rendered-contract.js
// --stateblocks exercises selective Begin/End/Apply/Capture pixels and delayed
// two-device production Worker batches; requires LEGACY_RENDER_MODULE_DIR=build.
// Run once normally and once with --compat for the two shipped modules.
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
  if(config.immediate)host.heap_oom_trace=(...args)=>{evidence.logs.push({name:'heap_oom_trace',args});};
  let e,raw,link,manager,port,lastStats,gpu,holding=false,heldRecord;
  const held=[],heldPackets=[];let queueBuffers,queueControl;
  const transport=evidence.transport={batches:[],holds:[]};
  const transportSnapshot=()=>queueControl?{
    submitted:Atomics.load(queueControl,3),completed:Atomics.load(queueControl,1),error:Atomics.load(queueControl,2),
    buffers:queueBuffers.map(buffer=>({header:Array.from(new Uint32Array(buffer,0,8)),
      firstVertex:Array.from(new Uint32Array(buffer,32+4096,8))}))}:null;
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
        await manager.ready;port=manager.createEndpoint(config.exactNative16===true?{...options,exactNative16:true}:options);await port.ready;
        port.addEventListener('message',event=>{if(event.data.t==='stats')lastStats=event.data;});
        const post=port.postMessage.bind(port);
        port.postMessage=message=>{
          if(message.t==='init'){queueBuffers=message.buffers;queueControl=new Int32Array(message.control);}
          if(message.t==='batch')transport.batches.push({sequence:message.seq,index:message.index,
            commands:message.commands,header:Array.from(new Uint32Array(queueBuffers[message.index],0,8))});
          if(holding&&message.t==='batch')heldPackets.push(message);
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
    if(mode==='webgl')gpu=new D3DIMGpu.D3DIMGpu({exactNative16:config.exactNative16===true,getExports:()=>e,getMemory:()=>memory.buffer,
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
    async function prepareInvoke(label,args,object=0,slot=0,target=0) {
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
      return async()=>{
        await raw('set_esp',stack);await raw('call_func',pc,0,0,0,0);
        for(let n=0;n<100&&(await raw('get_eip'));n++)await raw('run',10000);
        const row={label,args,object,vtable,slot,target,result:await read(result.p),esp:await read(result.p+4),
          finalEsp:(await raw('get_esp'))>>>0,eip:(await raw('get_eip'))>>>0};
        evidence.calls.push(row);await result.check();
        eq(row.eip,0,label+' bounded completion');eq(row.esp,stack-20,label+' exact stdcall');eq(row.finalEsp,stack-16,label+' caller RET');
        return row.result;
      };
    }
    const invoke=async(...args)=>(await prepareInvoke(...args))();
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
    let rt=await surface(8,8,0x2840);
    let device=await acquire(out=>com('CreateDevice7',d3d,4,hal,rt,out));
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
    const preview=config.noPreview?null:document.createElement('canvas');
    if(preview){preview.width=preview.height=8;
      preview.style.cssText='width:256px;height:256px;image-rendering:pixelated';document.body.append(preview);}
    const observe=async(label,sample,state)=>{
      // Public Lock is the production CPU-access fence, not a test fence.
      const l=await lock(rt),p=l.pointer+2*l.pitch+2*4,value=await read(p);
      const actual=[value>>>16&255,value>>>8&255,value&255];
      const dibRGBA=[];
      for(let y=0;y<8;y++)for(let x=0;x<8;x++){
        const pixel=await read(l.pointer+y*l.pitch+x*4);
        dibRGBA.push(pixel>>>16&255,pixel>>>8&255,pixel&255,255);
      }
      if(preview)preview.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(dibRGBA),8,8),0,0);
      if(preview&&(config.stateblocks||config.immediate)){
        const tile=document.createElement('figure'),caption=document.createElement('figcaption'),canvas=document.createElement('canvas');
        tile.style.cssText='display:inline-block;margin:8px;vertical-align:top;width:190px';
        caption.textContent=label;canvas.width=canvas.height=8;canvas.style.cssText='width:160px;height:160px;image-rendering:pixelated';
        canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(dibRGBA),8,8),0,0);
        tile.append(caption,canvas);document.body.append(tile);
      }
      await unlock(rt);
      const expectedAddress=state.address===4?(mode==='software'?1:3):state.address;
      const expected=expectedColor(state.palette||config.texture,sample.uv,state.filter,expectedAddress);
      const row={label,sample,state,expectedAddress,actual,expected,rawPixel:value,lock:l,dibRGBA,descriptor:await describe()};evidence.observations.push(row);
      if(gpu){
        const target=gpu.targets.get(row.descriptor[0]);check(target,'real GPU target');
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
      if(gpu)eq(state.rgbOnly?row.webglRGBA.slice(0,3):row.webglRGBA,
        state.rgbOnly?expected:[...expected,255],'independent actual WebGL pixels');
    };
    if(config.immediate){
      await (0,eval)('('+config.immediateSource+')')({mode,negative,evidence,check,eq,until,
        raw,read,alloc,wa,write,bytes,words,guard,guid,stack,invoke,prepareInvoke,com,ok,acquire,
        dd,hal,texture,texturePalette:config.texture,surface,lock,unlock,bits,observe,
        rendererInfo:()=>{
          const gl=gpu?.targets.values().next().value?.device.gpu.gl;
          if(!gl)return null;
          const ext=gl.getExtension('WEBGL_debug_renderer_info');
          return {version:gl.getParameter(gl.VERSION),renderer:gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER)};
        },
        use:target=>{device=target.device;rt=target.rt;},
        initial:{device,rt},allocationFailure:!!config.noPreview,countDraw:()=>drawCount++,
        queue:{hold:label=>{heldRecord={label,device,rt,messages:[],before:transportSnapshot()};
            transport.holds.push(heldRecord);holding=true;return heldRecord;},
          packet:async()=>{
            try{await until(()=>heldPackets.length>0,'held immediate batch');}
            finally{heldRecord.after=transportSnapshot();}
            const packet=heldPackets.at(-1),buffer=queueBuffers[packet.index],view=new DataView(buffer);
            eq(view.getUint32(4,true),heldRecord.device,'queued immediate exact device');
            heldRecord.packet={sequence:packet.seq,device:view.getUint32(4,true),header:Array.from(new Uint32Array(buffer,0,8))};
            eq(packet.commands,1,'single immediate draw batch');eq(view.getUint32(20,true),4096,'queued immediate state');
            eq(view.getUint32(28,true),0,'queued immediate draw record');
            return {sequence:packet.seq,vertices:new Uint8Array(buffer,32+4096,view.getUint32(24,true)),
              completed:Atomics.load(queueControl,1)};},
          snapshot:transportSnapshot,pendingPackets:()=>heldPackets.length,
          completed:()=>Atomics.load(queueControl,1),
          drain:()=>{holding=false;for(const send of held.splice(0))send();heldPackets.length=0;}}});
    }
    if(config.stateblocks){
      evidence.stateblocks={nativeWindowsBlockRefcounts:null,checkpoints:[],heldBatches:[]};
      const sb=evidence.stateblocks;
      const primary={device,rt},secondary={rt:await surface(8,8,0x2840)};
      secondary.device=await acquire(out=>com('second Device7',d3d,4,hal,secondary.rt,out));
      const alternate=await surface(2,2,0x1800);
      const colors=[[240,32,16],[16,224,48],[48,16,208],[192,160,96]];
      const l=await lock(alternate);
      for(let i=0;i<4;i++){const [r,g,b]=colors[i];await write(l.pointer+(i>>>1)*l.pitch+(i%2)*4,0xff000000|(r<<16)|(g<<8)|b);}
      await unlock(alternate);
      const use=target=>{device=target.device;rt=target.rt;};
      const bind=obj=>ok(com('SetTexture7 fixture binding',device,35,0,obj));
      const sampler=async(filter,address)=>{for(const [id,v] of [[16,filter],[17,filter],[13,address],[14,address]])await tss(id,v);};
      const begin=()=>ok(com('BeginStateBlock',device,22));
      const end=async()=>{const out=await guard(4);await ok(com('EndStateBlock',device,23,out.p));await out.check();return read(out.p);};
      const apply=token=>ok(com('ApplyStateBlock',device,39,token));
      const capture=token=>ok(com('CaptureStateBlock',device,40,token));
      const sample=config.samples[1];
      eq(expectedColor(config.texture,sample.uv,1,1),[160,32,64],'hand-calculated initial point wrap');
      eq(expectedColor(colors,sample.uv,2,3),[48,16,208],'hand-calculated alternate clamped corner');
      eq(expectedColor(colors,sample.uv,2,1),[93,163,61],'hand-calculated alternate bilinear wrap');
      const witness=async(label,palette,filter,address)=>{
        const state={label,filter,address,palette};
        await observe(label,sample,state);sb.checkpoints.push({label,device,rt,filter,address});
      };
      const render=async(label,palette,filter,address)=>{await geometry(sample.uv);await draw();await witness(label,palette,filter,address);};
      for(const target of [primary,secondary]){
        use(target);await ok(com('SetViewport7 fixture',device,13,viewport));
        for(const [id,v] of [[7,0],[14,0],[15,0],[22,1],[27,0],[28,0],[41,0],[137,0]])await ok(com('seed RS',device,20,id,v));
        for(const [id,v] of [[1,2],[2,2],[4,2],[5,2],[18,0]])await tss(id,v);
        await ok(com('disable fixture stage1',device,37,1,1,1));await bind(texture);await sampler(1,1);
      }
      use(primary);
      await render('before recording',config.texture,1,1);
      await begin();await sampler(2,3);
      if(negative==='recording'){
        // Model premature recording effects through public calls after ending.
        const premature=await end();await apply(premature);
      }
      await render('during recording',config.texture,1,1);
      const token=await end();
      await render('after End',config.texture,1,1);
      await bind(alternate);await apply(token);
      if(negative==='full-state')await bind(texture); // Fault model: unselected binding overwritten.
      await render('selective Apply preserves changed binding',colors,2,3);
      await sampler(1,1);await capture(token);await sampler(2,3);await bind(texture);await apply(token);
      await render('selective Capture preserves membership',config.texture,1,1);
      await sampler(2,1);await capture(token);await sampler(1,3);await bind(alternate);await apply(token);
      await render('second Capture preserves unrelated binding',colors,2,1);
      use(secondary);await sampler(1,3);await bind(alternate);
      await render('second device independent',colors,1,3);
      if(mode==='worker'){
        const snapshots=[];
        const queue=async(target,palette,filter,address,label,configure=true)=>{
          use(target);await bind(palette===colors?alternate:texture);if(configure)await sampler(filter,address);await geometry(sample.uv);
          heldRecord={label,messages:[]};sb.heldBatches.push(heldRecord);holding=true;
          const before=held.length;await draw();await until(()=>held.length>before,'held '+label);
          const packet=heldPackets.at(-1),buffer=queueBuffers[packet.index],view=new DataView(buffer);
          eq(packet.commands,1,'one independent draw per held production batch');
          eq(view.getUint32(28,true),0,'real D3DIM draw record');eq(view.getUint32(20,true),4096,'captured state size');
          const bytes=new Uint8Array(buffer,32,4096);
          snapshots.push({bytes,copy:bytes.slice(),label});
          heldRecord.device=device;heldRecord.rt=rt;heldRecord.sequence=packet.seq;heldRecord.index=packet.index;
          heldRecord.expected=expectedColor(palette,sample.uv,filter,address);
          heldRecord.completedAtQueue=Atomics.load(queueControl,1);
          check(heldRecord.completedAtQueue<packet.seq,'production batch consumption delayed');
          heldRecord.descriptorAtQueue=await describe();
        };
        // Each small batch submits after the consumer catches up. Hold one
        // at a time, alternating devices and mutating both before consumption.
        await queue(primary,config.texture,1,1,'A point wrap');
        await sampler(2,3);await bind(alternate);
        use(secondary);await sampler(1,1);await bind(texture);
        for(const row of sb.heldBatches){
          row.completedAfterLiveChanges=Atomics.load(queueControl,1);
          check(row.completedAfterLiveChanges<row.sequence,'still not consumed after live changes');
          row.liveChangedBeforeConsumption=true;
        }
        holding=false;for(const send of held.splice(0))send();heldPackets.length=0;
        use(primary);await witness('queued A captured state',config.texture,1,1);
        sb.heldBatches.at(-1).completedAfterDrain=Atomics.load(queueControl,1);
        check(sb.heldBatches.at(-1).completedAfterDrain>=sb.heldBatches.at(-1).sequence,'actual A batch consumed');
        await queue(secondary,colors,2,1,'B linear wrap');
        await sampler(1,1);await bind(texture);
        use(primary);await sampler(1,3);await bind(texture);
        if(negative==='queued-cross'){
          snapshots.at(-1).bytes.set(snapshots[0].copy);
          sb.mutation={kind:negative,bytes:4096,donorDevice:primary.device,receiverDevice:secondary.device};
        }
        const second=sb.heldBatches.at(-1);second.completedAfterLiveChanges=Atomics.load(queueControl,1);
        check(second.completedAfterLiveChanges<second.sequence,'B batch held after both devices changed');second.liveChangedBeforeConsumption=true;
        holding=false;for(const send of held.splice(0))send();heldPackets.length=0;
        use(secondary);await witness('queued B captured state',colors,2,1);
        second.completedAfterDrain=Atomics.load(queueControl,1);check(second.completedAfterDrain>=second.sequence,'actual B batch consumed');
        // Reuse the same device with a different recorded/Captured state.
        use(primary);await sampler(2,1);await capture(token);await sampler(1,3);await apply(token);
        await queue(primary,colors,2,1,'A recaptured linear wrap',false);
        await sampler(1,3);await bind(texture);
        use(secondary);await sampler(1,3);await bind(texture);use(primary);
        if(negative==='queued-stale'){
          snapshots.at(-1).bytes.set(snapshots[0].copy);
          sb.mutation={kind:negative,bytes:4096,donorDevice:primary.device,receiverDevice:primary.device};
        }
        sb.heldBatches.at(-1).liveChangedBeforeConsumption=true;
        sb.heldBatches.at(-1).completedAfterLiveChanges=Atomics.load(queueControl,1);
        check(Atomics.load(queueControl,1)<sb.heldBatches.at(-1).sequence,'recaptured batch still held');
        holding=false;for(const send of held.splice(0))send();heldPackets.length=0;
        await witness('queued recaptured A state',colors,2,1);
        sb.heldBatches.at(-1).completedAfterDrain=Atomics.load(queueControl,1);
        check(sb.heldBatches.at(-1).completedAfterDrain>=sb.heldBatches.at(-1).sequence,'actual recaptured batch consumed');
        await render('later live A state',config.texture,1,3);
        await until(()=>lastStats?.stats.drawCalls===drawCount,'stateblock Worker stats');evidence.stats=lastStats.stats;
      }
      use(primary);await ok(com('DeleteStateBlock',device,41,token));
      use(secondary);await bind(0);await com('Release second device',device,2);await com('Release second target',rt,2);
      use(primary);await bind(0);await com('Release alternate texture',alternate,2);
    }

    if(!config.stateblocks&&!config.immediate)for(const state of config.states){await setState(state);for(const sample of config.samples){
      await geometry(sample.uv);await draw();await observe(state.label+'/'+sample.name,sample,state);
    }}
    if(mode==='worker'&&!config.stateblocks&&!config.immediate){
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
    }
    if(mode==='worker'&&config.immediate){await until(()=>lastStats?.stats.drawCalls===drawCount,'immediate Worker stats');evidence.stats=lastStats.stats;
      evidence.glRenderer={version:lastStats.stats.glVersion,renderer:lastStats.stats.glRenderer};}
    if(gpu)evidence.stats=gpu.snapshot();
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
  const cubeBorder=process.argv.includes('--cube-border'),stateblocks=process.argv.includes('--stateblocks'),immediate=process.argv.includes('--immediate');
  const evidence={source,
    inputClosure:Object.fromEntries([...closure.vfs].filter(([p])=>!p.includes('/')).map(([p])=>['src/'+p,sha(fs.readFileSync(path.join(ROOT,'src',p)))])),
    fixtureSha256:sha(fs.readFileSync(__filename)),calc:{path:'test/binaries/calc.exe',sha256:sha(fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe')))},
    plan:planner(cubeBorder),results:[],negativeControls:[]};
  const scripts=['lib/region-map.generated.js','lib/gl-command-stream.js','lib/d3d-command-stream.js','lib/guest-rpc.js',
    'lib/guest-thread-host.js','lib/render-worker.js','lib/gpu-backend.js','lib/d3d9-shader.js','lib/d3d-shader-ir.js',
    'lib/d3d9-fixed.js','lib/d3d9-texture.js','lib/render-clear.js','lib/d3d9-backend.js','lib/d3dim-gpu.js'];
  evidence.productionJS=Object.fromEntries(fs.readdirSync(path.join(ROOT,'lib')).filter(p=>p.endsWith('.js')||p.endsWith('.json'))
    .map(p=>['lib/'+p,sha(fs.readFileSync(path.join(ROOT,'lib',p)))]));
  const config={...plan(cubeBorder),stateblocks,immediate,
    ...(immediate?{immediateSource:require('./test-d3dim-immediate-drawing').immediateFixture.toString()}:{}),
    thunkBase:require('../lib/region-map.generated').BASE.THUNK_BASE,
    factoryId:require('../src/api_table.json').find(x=>x.name==='DirectDrawCreateEx').id};
  const bootstrapPE=fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'));
  config.imageBase=bootstrapPE.readUInt32LE(bootstrapPE.readUInt32LE(0x3c)+52);
  let wasm,browser,server,page,deadline;
  try {
    // Hash both modules in place; runtime selects --compat when requested.
    const moduleDir=process.env.LEGACY_RENDER_MODULE_DIR;
    assert(!(stateblocks||immediate)||moduleDir,'state-block/immediate rendering requires both existing shipped modules');
    const canonical=moduleDir?fs.readFileSync(path.join(moduleDir,'wine-assembly.wasm')):compileSrcWasm();
    const compatVfs=moduleDir?null:require('../lib/dispatch-trampoline').applyToVfs(new Map(closure.vfs));
    const compat=moduleDir?fs.readFileSync(path.join(moduleDir,'wine-assembly.compat.wasm'))
      :compileSrcWasm((file,source)=>compatVfs.get(file)||source,{tailCalls:false});
    for(const [name,bytes] of [['canonical',canonical],['compat',compat]]){
      evidence[name+'Sha256']=sha(bytes);evidence[name+'Path']=moduleDir?path.join(moduleDir,name==='canonical'?'wine-assembly.wasm':'wine-assembly.compat.wasm'):null;
    }
    wasm=process.argv.includes('--compat')?compat:canonical;evidence.testedModuleSha256=sha(wasm);
    server=await startStaticServer({root:ROOT,crossOriginIsolated:true,handleRequest(req,res){
      res.setHeader('Cross-Origin-Opener-Policy','same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
      if(req.url==='/legacy-render.wasm'){res.writeHead(200,{'Content-Type':'application/wasm'});res.end(wasm);return true;}
      if(req.url!=='/legacy-render-fixture')return false;
      res.writeHead(200,{'Content-Type':'text/html'});res.end(scripts.map(p=>`<script src="/${p}"></script>`).join('\n'));return true;
    }});
    evidence.launchedAt=new Date().toISOString();
    evidence.browserDeadline=new Date(Date.now()+180000).toISOString();
    evidence.cleanupDeadline=new Date(Date.now()+210000).toISOString();
    browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME||'/usr/bin/chromium',
      args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:120000});
    deadline=setTimeout(()=>{evidence.deadlineExceeded=true;browser.close().catch(()=>{});},180000);
    evidence.browser=await browser.version();
    evidence.serverAddress=server.address();evidence.devtools=browser.wsEndpoint();
    const child=browser.process();evidence.browserProcess={pid:child.pid,startTicks:fs.readFileSync('/proc/'+child.pid+'/stat','utf8').split(') ')[1].split(' ')[19]};
    evidence.browserProcess.profile=child.spawnargs.find(a=>a.startsWith('--user-data-dir='))?.slice('--user-data-dir='.length);
    child.once('exit',(code,signal)=>{evidence.browserProcess.exit={code,signal,at:new Date().toISOString()};});
    for(const mode of ['software','webgl','worker']){
      page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/legacy-render-fixture`);
      evidence.results.push(await page.evaluate(browserFixture,mode,config,oracle.toString()));
      await page.screenshot({path:path.join(dir,mode+'.png'),fullPage:true});await page.close();page=null;
      console.log('PASS public-COM '+(immediate?'Device2/3 immediate':stateblocks?'selective state-block':'sampler')+' rendered pixels '+mode);
    }
    for(const [negative,mode] of immediate?[['dropped','software'],['cross-device','software'],['queued-vertices','worker']]:stateblocks?[['recording','software'],['full-state','software'],['queued-stale','worker'],['queued-cross','worker']]:cubeBorder?['software','webgl','worker'].map(m=>['border',m])
      :['nearest','stale'].map(n=>[n,'software'])){
      page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/legacy-render-fixture`);
      let failure;
      const negativeConfig=negative==='border'?{...config,states:config.states.filter(s=>s.address===4)}:config;
      try{await page.evaluate(browserFixture,mode,negativeConfig,oracle.toString(),negative);}catch(error){failure=String(error);}
      const partial=await page.evaluate(()=>globalThis.legacyTextureEvidence);
      evidence.negativeControls.push({negative,mode,failure,partial});
      if(cubeBorder||stateblocks||immediate)await page.screenshot({path:path.join(dir,`negative-${negative}-${mode}.png`),fullPage:true});
      assert(failure?.includes('PIXEL ORACLE'),'negative control must fail pixel oracle, not bootstrap');
      if(immediate){
        const label={dropped:'v2 1c4 Vertex','cross-device':'interleaved B','queued-vertices':'queued immutable vertices 0'}[negative];
        assert(failure.includes('PIXEL ORACLE '+label),'immediate fault must fail its designated pixel');
      }
      if(stateblocks){
        const label={recording:'during recording','full-state':'selective Apply preserves changed binding','queued-stale':'queued recaptured A state','queued-cross':'queued B captured state'}[negative];
        assert(failure.includes('PIXEL ORACLE '+label),'fault must fail at its designated state-block pixel');
      }
      assert(partial.observations.some(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected)),'actual discriminating pixel');
      await page.close();page=null;console.log('PASS rendered negative control rejected '+negative);
    }
    evidence.status='PASS';
  }catch(error){
    evidence.status='FAIL / remaining paths untested';evidence.error=error.stack||String(error);
    if(page){
      evidence.partial=await page.evaluate(()=>globalThis.legacyTextureEvidence||null).catch(()=>null);
      await page.screenshot({path:path.join(dir,'failure.png'),fullPage:true}).catch(()=>{});
    }
    throw error;
  }finally{
    if(deadline)clearTimeout(deadline);
    try{
      let cleanupTimer;
      try{
        await Promise.race([(async()=>{if(browser)await browser.close();if(server)await closeServer(server);})(),
          new Promise((_,reject)=>{cleanupTimer=setTimeout(()=>reject(Error('normal cleanup deadline exceeded')),30000);})]);
        if(browser)assert.deepEqual([evidence.browserProcess.exit?.code,evidence.browserProcess.exit?.signal],[0,null],'normal browser exit');
      }catch(error){evidence.status='FAIL / cleanup';evidence.cleanupError=String(error);throw error;}
      finally{clearTimeout(cleanupTimer);}
    }finally{
      evidence.cleanupCompletedAt=new Date().toISOString();
      fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(evidence,null,2)+'\n');
    }
  }
}

if(require.main===module){
  if(process.argv.includes('--plan'))console.log(JSON.stringify(planner(process.argv.includes('--cube-border')),null,2));
  else runtime().catch(error=>{console.error(error);process.exitCode=1;});
}
module.exports={plan,oracle,planner,browserFixture};
