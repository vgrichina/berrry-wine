#!/usr/bin/env node
'use strict';
// Actual compiled x86 producer, production RPC/host bridge, physical browser
// Worker running GLRenderWorker, and production WebGL fixed-function shaders.
// The test port below schedules delivery only; it never manufactures GL records.
function producer() {
  importScripts('/lib/region-map.generated.js','/lib/gl-command-stream.js',
    '/lib/guest-rpc.js','/lib/gl-software-producer.js');
  self.onmessage=({data:m})=>{try {
    const {module,memory,sigs,meta,apis,dc}=m;
    let instance;
    const software=new GLSoftwareProducer.Producer(()=>instance.exports);
    const built=GuestRpc.createWorkerImports(memory,sigs,msg=>postMessage(msg),
      {slot:0,getExports:()=>instance?.exports,softwareGLConfig:software.config,
        configureSoftwareGL:c=>software.configure(c)});
    instance=new WebAssembly.Instance(module,built.imports);
    const e=instance.exports,v=new DataView(memory.buffer),wa=p=>e.guest_to_wasm(p)>>>0;
    e.init_thread(1,...meta);
    if(e.gl_wat_stream_pool_enable(1)!==1)throw Error('native stream pool unavailable');
    const stack=(e.guest_alloc(8192)>>>0)+4096,out=e.guest_alloc(8)>>>0;
    let calls=0;
    const invoke=(target,args)=>{
      const code=[],word=n=>code.push(n&255,n>>>8&255,n>>>16&255,n>>>24);
      for(const a of args.slice().reverse()){code.push(0x68);word(a);}
      code.push(0xb8);word(target);code.push(0xff,0xd0,0xa3);word(out);
      code.push(0x89,0x25);word(out+4);code.push(0xc3);
      const p=e.guest_alloc(code.length+4)>>>0;
      new Uint8Array(memory.buffer,wa(p),code.length).set(code);
      e.set_esp(stack);e.call_func(p,0,0,0,0);
      for(let n=0;n<100&&e.get_eip();n++)e.run(10000);
      if(e.get_eip()||e.get_esp()!==(stack-16)||v.getUint32(wa(out)+4,true)!==(stack-20))
        throw Error('bounded public x86 stdcall/RET failed');
      calls++;return v.getUint32(wa(out),true);
    };
    const api=(name,args)=>{
      postMessage({t:'progress',name});
      const at=RegionMap.BASE.THUNK_BASE+4,old=v.getUint32(at,true);
      try{v.setUint32(at,apis.find(a=>a.name===name).id,true);return invoke(e.get_thunk_base(),args);}
      finally{v.setUint32(at,old,true);}
    };
    const str=s=>{const p=e.guest_alloc(s.length+1)>>>0;
      new Uint8Array(memory.buffer,wa(p),s.length+1).set(new TextEncoder().encode(s+'\0'));return p;};
    const dll=api('LoadLibraryA',[str('opengl32.dll')]),resolved=new Map();
    if(!dll)throw Error('public LoadLibraryA');
    const call=(name,args=[])=>{
      postMessage({t:'progress',name});
      if(!resolved.has(name)){
        const p=api('GetProcAddress',[dll,str(name)]);
        if(!p||e.thunk_word(p,1)!==apis.find(a=>a.name===name).id)throw Error('public export '+name);
        resolved.set(name,p);
      }
      return invoke(resolved.get(name),args);
    };
    const temp=new DataView(new ArrayBuffer(4)),f=x=>{temp.setFloat32(0,x,true);return temp.getUint32(0,true);};
    const pfd=e.guest_alloc(40)>>>0,pa=wa(pfd);
    new Uint8Array(memory.buffer,pa,40).fill(0);v.setUint16(pa,40,true);v.setUint16(pa+2,1,true);
    v.setUint32(pa+4,0x25,true);v.setUint8(pa+9,32);v.setUint8(pa+16,8);v.setUint8(pa+23,16);
    const pf=api('ChoosePixelFormat',[dc,pfd]);
    if(!pf||api('SetPixelFormat',[dc,pf,pfd])!==1)throw Error('native RGBA pixel format');
    const context=call('wglCreateContext',[dc]);
    if(!context||call('wglMakeCurrent',[dc,context])!==1)throw Error('actual WebGL WGL context');
    call('glViewport',[0,0,8,8]);
    for(const mode of [0x1700,0x1701,0x1702]){call('glMatrixMode',[mode]);call('glLoadIdentity');}
    call('glMatrixMode',[0x1700]);
    for(const cap of [0xb50,0xb71,0xb44,0xbd0])call('glDisable',[cap]);
    const fogCases=[],fogOut=e.guest_alloc(64)>>>0,fogIn=e.guest_alloc(16)>>>0;
    const fogA={enabled:1,mode:0x2601,density:.25,start:0,end:1,index:3.5,color:[0,0,1,1]};
    const fogB={enabled:0,mode:0x800,density:2,start:.25,end:2,index:7.25,color:[0,1,0,.5]};
    function fogSet(s){
      call(s.enabled?'glEnable':'glDisable',[0xb60]);call('glFogi',[0xb65,s.mode]);
      for(const [p,k] of [[0xb62,'density'],[0xb63,'start'],[0xb64,'end'],[0xb61,'index']])call('glFogf',[p,f(s[k])]);
      s.color.forEach((x,i)=>v.setFloat32(wa(fogIn)+4*i,x,true));call('glFogfv',[0xb66,fogIn]);
    }
    function fogQuery(p,n=1){call('glGetFloatv',[p,fogOut]);return Array.from(new Float32Array(memory.buffer,wa(fogOut),n));}
    function fogCapture(label,expected){
      const state={enabled:call('glIsEnabled',[0xb60]),mode:fogQuery(0xb65)[0],density:fogQuery(0xb62)[0],start:fogQuery(0xb63)[0],end:fogQuery(0xb64)[0],index:fogQuery(0xb61)[0],color:fogQuery(0xb66,4)};
      call('glClearColor',[0,0,0,1].map(f));call('glClear',[0x4000]);call('glColor4f',[1,0,0,1].map(f));
      call('glBegin',[7]);for(const [x,y] of [[-1,-1],[1,-1],[1,1],[-1,1]])call('glVertex3f',[x,y,-.5].map(f));call('glEnd');
      call('glReadPixels',[4,4,1,1,0x1908,0x1401,fogOut]);
      fogCases.push({label,state,expected,pixel:Array.from(new Uint8Array(memory.buffer,wa(fogOut),4)),error:call('glGetError')});
    }
    fogSet(fogA);fogCapture('analytical linear control',fogA);
    fogSet(fogB);fogCapture('disabled control',fogB);
    fogSet({...fogB,enabled:1});fogCapture('analytical exponential control',{...fogB,enabled:1});
    const fogSquared={...fogA,mode:0x801,density:1};fogSet(fogSquared);fogCapture('analytical squared exponential control',fogSquared);
    for(const mask of [0x80,0x2000,8,64,0x8000,0xfffff]){
      fogSet(fogA);call('glPushAttrib',[mask]);fogSet(fogB);call('glPopAttrib');
      fogCapture('mask '+mask,mask&0x80?fogA:{...fogB,enabled:mask&0x2000?1:0});
    }
    fogSet(fogA);call('glPushAttrib',[0x2000]);fogSet(fogB);
    fogCapture('enable changed state rendered before pop',fogB);
    call('glPopAttrib');fogCapture('enable restored after intervening rendering',{...fogB,enabled:1});
    fogSet(fogA);call('glPushAttrib',[0x80]);fogSet(fogB);call('glPushAttrib',[0x80]);fogSet(fogA);
    call('glPopAttrib');fogCapture('nested inner',fogB);call('glPopAttrib');fogCapture('nested outer',fogA);
    call('glDisable',[0xb60]);

    const input=e.guest_alloc(16)>>>0,output=e.guest_alloc(256)>>>0;
    for(const [name,texel] of [[1,[64,128,192,128]],[2,[224,48,96,192]]]){
      call('glBindTexture',[0xde1,name]);
      for(const p of [0x2800,0x2801])call('glTexParameteri',[0xde1,p,0x2600]);
      new Uint8Array(memory.buffer,wa(input),4).set(texel);
      call('glTexImage2D',[0xde1,0,0x1908,1,1,0,0x1908,0x1401,input]);
    }
    call('glBindTexture',[0xde1,1]);call('glTexEnvi',[0x2300,0x2200,0x2100]);
    const fog=color=>{color.forEach((x,i)=>v.setFloat32(wa(input)+4*i,x,true));call('glFogfv',[0xb66,input]);};
    fog([.125,.75,.5,.125]);call('glFogi',[0xb65,0x2601]);
    call('glFogf',[0xb63,f(0)]);call('glFogf',[0xb64,f(1)]);
    call('glBlendFunc',[0x302,0x303]);
    call('glTexCoord2f',[f(.5),f(.5)]);call('glColor4f',[.75,.5,.25,.75].map(f));
    for(const cap of [0xde1,0xb60,0xbe2])call('glEnable',[cap]);
    call('glClearColor',[.625,.125,.875,.5].map(f));call('glClear',[0x4000]);
    const read=()=>{call('glReadPixels',[0,0,8,8,0x1908,0x1401,output]);
      if(call('glGetError'))throw Error('valid GL composition error');
      return Array.from(new Uint8Array(memory.buffer,wa(output),256));};
    const before=read();
    const quad=(left=-1)=>{call('glBegin',[7]);
      for(const [x,y] of [[left,-1],[1,-1],[1,1],[left,1]])call('glVertex3f',[x,y,-.5].map(f));
      call('glEnd');};
    postMessage({t:'armed'});quad();
    // Public x86 handlers publish each scalar separately. Hold the packed
    // draw and subsequent texture bind within the real two-publication bound.
    call('glBindTexture',[0xde1,2]);postMessage({t:'mutated'});
    fog([.875,.125,.25,.875]);
    new Uint8Array(memory.buffer,wa(input),16).fill(0);
    call('glFogf',[0xb64,f(2)]);call('glBlendFunc',[1,0x303]);quad(0);
    const composed=read();
    call('glDisable',[0xde1]);call('glDisable',[0xb60]);
    call('glBlendFunc',[0x304,0x305]);call('glColor4f',[1,0,0,.25].map(f));quad();
    const witness=read();api('SwapBuffers',[dc]);call('glFinish');
    call('wglMakeCurrent',[0,0]);call('wglDeleteContext',[context]);
    postMessage({t:'done',calls,before,composed,witness,fogCases,stats:built.stats});
  }catch(error){postMessage({t:'fault',error:String(error.stack||error)});}};
}

function consumer() {
  importScripts('/lib/region-map.generated.js','/lib/gpu-backend.js','/lib/gl-command-stream.js',
    '/lib/mem-utils.js','/lib/gl-compat.js','/lib/gl-render-worker.js');
  const get=OffscreenCanvas.prototype.getContext;
  OffscreenCanvas.prototype.getContext=function(type,...args){
    const gl=Reflect.apply(get,this,[type,...args]);
    if(gl&&/^webgl/.test(type)){
      const ext=gl.getExtension('WEBGL_debug_renderer_info');
      postMessage({t:'context',type,version:gl.getParameter(gl.VERSION),
        actualVersion:typeof WebGL2RenderingContext!=='undefined'&&gl instanceof WebGL2RenderingContext?2:1,
        renderer:gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER)});
    }return gl;
  };
  let endpoint,held=false,pending=[];
  const execute=m=>{try{const result=endpoint.execute(m.message);postMessage({t:'reply',id:m.id,result});}
    catch(error){postMessage({t:'fault',error:String(error.stack||error)});}};
  self.onmessage=({data:m})=>{try{
    if(m.t==='init'){
      const host={memory:m.memory};
      for(const [name,sig] of Object.entries(m.sigs))host[name]=()=>sig.results?.length?0:undefined;
      const instance=new WebAssembly.Instance(m.module,{host});instance.exports.d3dim_worker_init(m.imageBase);
      endpoint=GLRenderWorker.create({instance,memory:m.memory,backend:'webgl',apiVersion:m.apiVersion,
        sendFrame:frame=>postMessage({t:'frame',frame},[frame.bitmap])});postMessage({t:'ready'});
    }else if(m.t==='hold')held=true;
    else if(m.t==='release'){held=false;for(const item of pending)execute(item);pending=[];}
    else if(m.t==='close'){endpoint.destroy();postMessage({t:'closed'});}
    else if(held)pending.push(m);else execute(m);
  }catch(error){postMessage({t:'fault',error:String(error.stack||error)});}};
}

async function scenario({name,apiVersion,backend='webgl',processFactory=false}) {
  const assert=(ok,label)=>{if(!ok)throw Error(label);};
  assert(crossOriginIsolated,'HTTP fixture must enable cross-origin isolation');
  const distance=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i]))),q=c=>c.map(v=>Math.round(v*255));
  // Independent GL equations: RGBA modulation, RGB-only fog, then RGBA blend.
  const primary=[.75,.5,.25,.75],texel=[64,128,192,128],fog=[.125,.75,.5,.125],dest=[.625,.125,.875,.5];
  const texture=(c,t=texel)=>c.map((v,i)=>v*t[i]/255);
  const mist=(c,f=.5,color=fog)=>c.map((v,i)=>i===3?v:f*v+(1-f)*color[i]);
  const blend=(s,d)=>s.map((v,i)=>v*s[3]+d[i]*(1-s[3]));
  const first=blend(mist(texture(primary)),dest);
  const next=mist(texture(primary,[224,48,96,192]),.75,[.875,.125,.25,.875]);
  const over=d=>next.map((v,i)=>Math.min(1,v+d[i]*(1-next[3]))),second=over(first);
  const witness=d=>[1,0,0,.25].map((v,i)=>v*d[3]+d[i]*(1-d[3]));
  const module=await WebAssembly.compile(await(await fetch('/build/'+name)).arrayBuffer());
  const sigs=(await(await fetch('/lib/host-import-sigs.generated.json')).json()).sigs;
  const apis=await(await fetch('/src/api_table.json')).json();
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),host={memory};
  for(const [key,sig] of Object.entries(sigs))host[key]=()=>sig.results?.length?0:undefined;
  const native=new WebAssembly.Instance(module,{host}),e=native.exports;
  const pe=new Uint8Array(await(await fetch('/test/binaries/calc.exe')).arrayBuffer());
  new Uint8Array(memory.buffer,e.get_staging(),pe.length).set(pe);assert(e.load_pe(pe.length),'ordinary PE initializes public API thunks');
  const hwnd=0x10001;e.wnd_table_set(hwnd,0);e.ctrl_set_geom(hwnd,0,0,8,8);
  e.wnd_set_style_export(hwnd,0x10000000);e.test_gdi_client_rect_set(hwnd,0,0,8,8);
  const dc=e.test_call_GetDC(hwnd)>>>0;assert(dc,'native DC');
  const meta=['get_image_base','get_code_start','get_code_end','get_thunk_base','get_thunk_end','get_num_thunks','get_rsrc_rva'].map(key=>e[key]());
  const windows={[hwnd]:{hwnd,w:8,h:8,clientRect:{w:8,h:8}}},frames=[],contexts=[],batches=[],versions=[];
  globalThis.fragmentProgress={stages:[],batches,contexts};
  let producerWorker,renderWorker,bridge,route,fail,resolveDone,nextId=1,closed=false,heldBatches=0;
  const requests=new Map(),listeners=[],failure=new Promise((_,reject)=>{fail=reject;});
  const safe=p=>Promise.race([p,failure]);
  const done=new Promise(resolve=>{resolveDone=resolve;});
  let resolveReady,resolveClosed;
  const ready=new Promise(resolve=>{resolveReady=resolve;}),closure=new Promise(resolve=>{resolveClosed=resolve;});
  try {
    let port;
    if(processFactory){
      route=await globalThis.createFactoryCompositionRoute({module,memory,sigs,e,contexts,versions,fail});
      port=route.port;
    }else{
    renderWorker=new Worker('/test/fragment-consumer.js');
    port={ready,addEventListener(type,fn){listeners.push(fn);},
      request(message){return new Promise(resolve=>{const id=nextId++;requests.set(id,resolve);renderWorker.postMessage({t:'execute',id,message});});},
      async terminate(){renderWorker.postMessage({t:'close'});await safe(closure);renderWorker.terminate();closed=true;}};
    renderWorker.onerror=event=>fail(Error(event.message));
    renderWorker.onmessage=({data:m})=>{
      if(m.t==='ready')resolveReady();else if(m.t==='closed')resolveClosed();
      else if(m.t==='fault')fail(Error(m.error));else if(m.t==='context')contexts.push(m);
      else if(m.t==='reply'){if(m.result.webglVersion)versions.push(m.result.webglVersion);requests.get(m.id)?.(m.result);requests.delete(m.id);}
      else if(m.t==='frame')for(const fn of listeners)fn({data:m});
    };
    renderWorker.postMessage({t:'init',module,memory,sigs,imageBase:meta[0],apiVersion});await safe(ready);
    }
    bridge=new GLRenderHost.Bridge({backend,renderer:{windows,mergeGpuLayerIntoBackCanvas(){}},exports:e,
      createRenderEndpoint:route?route.createEndpoint:()=>port,createCanvas:(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;},
      onPresent:layer=>{const ctx=layer.canvas.getContext('2d');frames.push(Array.from(ctx.getImageData(0,0,8,8).data));
        if(!layer.canvas.isConnected){document.body.append(layer.canvas);layer.canvas.style.width='256px';layer.canvas.style.imageRendering='pixelated';}}});
    const broker=GuestRpc.createMainBroker(memory,{
      gpu_gl_batch:(desc,owner)=>{
        const batch=Object.assign(GLCommandStream.memoryBatch(memory,desc.memoryOffset,desc.bytes),
          {pool:desc.pool,softwareConfig:desc.softwareConfig,softwareFront:desc.softwareFront});
        const ops=[];GLCommandStream.replay(batch,op=>{ops.push(op);return 0;});
        batches.push({bytes:desc.bytes,ops});if(heldBatches>=0&&ops.includes(GLCommandStream.PACKED_DRAW_OPCODE))heldBatches++;
        return bridge.replay(batch,owner);
      }
    },sigs,{onError:(name,error)=>fail(Error(name+': '+error.stack))});
    producerWorker=new Worker('/test/fragment-producer.js');producerWorker.onerror=event=>fail(Error(event.message));
    producerWorker.onmessage=({data:m})=>{try{
      if(m.t==='glBatch')assert(broker.serveGlBatch(m),'actual native RPC batch served');
      else if(m.t==='rpc')broker.serveRpc(m.slot);else if(m.t==='calls')broker.serveCalls(m);
      else if(m.t==='fault')fail(Error(m.error));
      else if(m.t==='armed'){heldBatches=0;if(backend!=='software'){if(route)route.hold();else renderWorker.postMessage({t:'hold'});}}
      else if(m.t==='mutated'){
        if(backend==='software')return;
        assert(heldBatches===1&&batches.at(-1).ops.includes(42),
          'native packed draw and changed texture bind admitted before consumer release');
        assert(bridge.submissions.used===2,'real two-publication bound retained');
        assert(route?route.pendingRequests()===1:requests.size===1,'first consumer request is still outstanding');
        if(route)route.release();else renderWorker.postMessage({t:'release'});
      }else if(m.t==='progress')globalThis.fragmentProgress.stages.push(m.name);
      else if(m.t==='done')resolveDone(m);
    }catch(error){fail(error);}};
    producerWorker.postMessage({module,memory,sigs,meta,apis,dc});
    const result=await safe(done);await safe(bridge.drain());
    const fogObservations=result.fogCases.map(item=>{
      const s=item.expected,d=.5;
      let factor=s.enabled?(s.mode===0x2601?(s.end-d)/(s.end-s.start):s.mode===0x800?Math.exp(-s.density*d):Math.exp(-Math.pow(s.density*d,2))):1;
      factor=Math.max(0,Math.min(1,factor));
      const expectedPixel=s.color.slice(0,3).map((c,i)=>Math.round(255*(factor*(i===0?1:0)+(1-factor)*c)));
      return {...item,expectedPixel,statePass:JSON.stringify(item.state)===JSON.stringify(s),pixelPass:distance(item.pixel.slice(0,3),expectedPixel)<=3,errorPass:item.error===0};
    });
    globalThis.fogObservations=fogObservations;
    const fogPass=fogObservations.every(x=>x.statePass&&x.pixelPass&&x.errorPass);
    assert(fogPass,'public fog attrib state/pixel mismatch '+JSON.stringify(fogObservations.filter(x=>!x.statePass||!x.pixelPass||!x.errorPass)));

    const observations=[];
    const check=(pixels,left,right,label,rgbOnly=false)=>{
      for(let y=0;y<8;y++)for(let x=0;x<8;x++){
        const actual=pixels.slice((y*8+x)*4,(y*8+x+1)*4),want=q(x<4?left:right);
        assert(distance(rgbOnly?actual.slice(0,3):actual,rgbOnly?want.slice(0,3):want)<=3,
          label+' '+x+','+y+' '+actual+' expected '+want);
      }
      observations.push({label,expected:[q(left),q(right)],actual:[pixels.slice(0,4),pixels.slice(16,20)]});
    };
    check(result.before,dest,dest,'nonzero destination');
    check(result.composed,first,second,'captured old state left / changed ordered overlap right');
    check(result.witness,witness(first),witness(second),'stored DST_ALPHA visible in subsequent RGB');
    const wrong={fogBeforeTexture:blend(texture(mist(primary)),dest),fogAfterBlend:mist(blend(texture(primary),dest)),
      fogChangesAlpha:blend(mist(texture(primary)).map((v,i)=>i===3?.5*v+.5*fog[3]:v),dest),
      missingTextureAlpha:blend(mist(texture(primary)).map((v,i)=>i===3?primary[3]:v),dest),
      noDestination:mist(texture(primary)).map(v=>v*texture(primary)[3]),
      firstWithNewState:over(dest),secondWithoutFirst:over(dest),reverseDraws:blend(mist(texture(primary)),over(dest)),
      staleTexture:mist(texture(primary),.75,[.875,.125,.25,.875]),
      staleFog:mist(texture(primary,[224,48,96,192])),staleBlend:blend(next,first)};
    for(const key of ['staleTexture','staleFog'])wrong[key]=wrong[key].map((v,i)=>Math.min(1,v+first[i]*(1-wrong[key][3])));
    for(const [key,color] of Object.entries(wrong)){
      const right=['secondWithoutFirst','reverseDraws','staleTexture','staleFog','staleBlend'].includes(key);
      assert(distance(result.composed.slice(right?16:0,right?20:4),q(color))>8,'discriminates '+key);
    }
    if(backend==='software'){
      assert(contexts.length===0&&versions.length===0,'native software selection creates no WebGL context');
    }else{
      assert(contexts.length>0&&contexts.every(c=>c.actualVersion===apiVersion),'actual context class matches requested version');
      assert(versions.length>0&&versions.every(v=>v===apiVersion),'production endpoint version matches');
    }
    assert(frames.length>0,'production host received actual Worker frame');
    check(frames.at(-1),witness(first),witness(second),'presented Worker frame RGB',true);
    assert(bridge.local===null,'no main-thread renderer fallback');
    const packetStats={...bridge.packetStats};
    if(backend==='software')assert(packetStats.leasedBatches===0,'software keeps producer parked without deferred leases');
    else assert(packetStats.leasedBatches>=2,'actual shared native packet leases');
    await safe(bridge.close());
    if(route){await route.close();closed=true;}
    return {name,apiVersion,backend,processFactory:route?.info,route:'public x86 resolved GL -> compiled WAT encoder -> GuestRpc broker -> GLRenderHost shared leases -> physical browser Worker GLRenderWorker -> RGBA8 readback + presentation',
      fogObservations,calls:result.calls,contexts,versions:[...new Set(versions)],heldBatches,packetStats,batches,observations,
      wrongColors:Object.fromEntries(Object.entries(wrong).map(([k,v])=>[k,q(v)])),closed};
  }finally{producerWorker?.terminate();renderWorker?.terminate();if(route)await route.close();}
}

async function main() {
  const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
  const {startStaticServer,closeServer}=require('./static-server');
  const root=path.resolve(__dirname,'..'),run=process.env.GL_BROWSER_FRAGMENT_EVIDENCE;
  const browserMs=Number(process.env.GL_BROWSER_FRAGMENT_MS||180000);
  assert(Number.isInteger(browserMs)&&browserMs>0&&browserMs<=180000,'browser time bound');
  const report={startedAt:new Date().toISOString(),results:[],box:{id:'NA',state:'NA',expiry:'NA'}};
  if(process.env.GL_BROWSER_FRAGMENT_CUTOFF){
    const cutoff=Date.parse(process.env.GL_BROWSER_FRAGMENT_CUTOFF);
    assert(Number.isFinite(cutoff)&&Date.now()+browserMs<cutoff,'full bounded browser attempt must fit absolute cutoff');
  }
  report.git=require('child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
  const save=()=>{if(run)fs.writeFileSync(path.join(run,'result.json'),JSON.stringify(report,null,2));};
  if(run)fs.mkdirSync(run,{recursive:true});
  for(const name of ['build/wine-assembly.wasm','build/wine-assembly.compat.wasm','test/binaries/calc.exe']){
    const b=fs.readFileSync(path.join(root,name));(report.inputs||=[]).push({path:name,bytes:b.length,sha256:hash(b)});
  }
  const virtual={'/test/fragment-producer.js':'('+producer.toString()+')()',
    '/test/fragment-consumer.js':'('+consumer.toString()+')()'};
  const server=await startStaticServer({root,crossOriginIsolated:true,handleRequest(req,res){
    res.setHeader('Cross-Origin-Opener-Policy','same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
    if(req.url==='/'){res.end('<!doctype html><title>Browser GL fragment composition</title>');return true;}
    if(virtual[req.url]){res.setHeader('Content-Type','text/javascript');res.end(virtual[req.url]);return true;}return false;}});
  let browser,timer;
  try {
    timer=setTimeout(()=>browser?.process().kill('SIGKILL'),browserMs);
    browser=await require('puppeteer').launch({headless:true,executablePath:process.env.CHROME||'/opt/google/chrome/chrome',
      args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:45000});
    report.chromePid=browser.process().pid;report.browser=await browser.version();
    const cdp=await browser.target().createCDPSession();report.gpu=(await cdp.send('SystemInfo.getInfo')).gpu;await cdp.detach();
    for(const name of ['wine-assembly.wasm','wine-assembly.compat.wasm'])for(const apiVersion of [1,2]){
      const page=await browser.newPage();
      try{
        await page.goto('http://127.0.0.1:'+server.address().port+'/');
        for(const script of ['region-map.generated','gpu-backend','gl-command-stream','mem-utils','gl-compat','render-worker','gl-render-host','guest-rpc'])
          await page.addScriptTag({path:path.join(root,'lib',script+'.js')});
        const result=await Promise.race([page.evaluate(scenario,{name,apiVersion}),new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('scenario 35s cutoff')),35000);t.unref();})]);
        report.results.push(result);save();console.log('PASS',name,'WebGL'+apiVersion,JSON.stringify(result.observations));
        if(run)await page.screenshot({path:path.join(run,name+'.webgl'+apiVersion+'.png')});
      }catch(error){
        report.failedScenario={name,apiVersion,error:String(error.stack||error)};
        report.progress=await page.evaluate(()=>globalThis.fragmentProgress).catch(()=>null);
        if(run)await page.screenshot({path:path.join(run,'failure.png'),timeout:5000}).catch(()=>{});
        throw error;
      }finally{await page.close();}
    }
    assert.equal(report.results.length,4);report.passed=true;
  }catch(error){report.passed=false;report.error=String(error.stack||error);throw error;}
  finally{
    clearTimeout(timer);if(browser){await browser.close();report.chromeClosed=browser.process().exitCode!==null||browser.process().signalCode!==null;}
    await closeServer(server);report.serverClosed=!server.listening;report.endedAt=new Date().toISOString();save();
  }
}
module.exports={producer,consumer,scenario};
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
