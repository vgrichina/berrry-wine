'use strict';
globalThis.runPaletteWorker=async function(backend='software'){
  const evidence=globalThis.paletteWorkerEvidence={backend,observations:[],barriers:[],snapshots:[],logs:[],controls:[]};
  const check=(v,s)=>{if(!v)throw Error(s);};
  const eq=(a,b,s)=>check(JSON.stringify(a)===JSON.stringify(b),`${s}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`);
  const until=async(predicate,label)=>{
    const end=performance.now()+10000;
    while(!predicate()){if(performance.now()>end)throw Error('timeout '+label);await new Promise(r=>setTimeout(r,5));}
  };
  check(crossOriginIsolated,'isolated shared memory');
  const bytes=await (await fetch('/palette-worker.wasm')).arrayBuffer();
  evidence.moduleSha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),
    b=>b.toString(16).padStart(2,'0')).join('');
  const module=await WebAssembly.compile(bytes);
  const sigs=(await (await fetch('/lib/host-import-sigs.generated.json')).json()).sigs;
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const host={};for(const name of Object.keys(sigs))host[name]=()=>{throw Error('unexpected broker import '+name);};
  for(const name of ['log','log_i32','log_block','log_eip','log_api_exit','dx_trace'])
    host[name]=(...args)=>evidence.logs.push({name,args});
  const publication=new RenderWorker.PublicationQueue();
  const broker=GuestRpc.createMainBroker(memory,host,sigs,{renderPublication:publication.buffer,
    onError:(name,error)=>evidence.logs.push({name,error:String(error)})});
  broker.publish({tickMs:0});
  let manager,port,ring=0,scheduled=0,controlId=0;
  const control=async action=>{
    const id=++controlId;manager.worker.postMessage({t:'palette-control',id,action});
    await until(()=>evidence.controls.some(r=>r.id===id),'scheduler '+action);
    return evidence.controls.find(r=>r.id===id);
  };
  const stream=new GpuStreamHost.Bridge({api:'d3dim-gps',backend,getMemory:()=>memory,
    createRenderEndpoint:async options=>{
      eq(options,{api:'d3dim-gps',backend},'current production stream endpoint');
      port=manager.createEndpoint(options);await port.ready;return port;
    }});
  host.gpu_stream_kick=(address,mode)=>{ring=address>>>0;return stream.kick(address,mode);};
  const link=new GuestWorkerLink({slot:0,module,memory,sigs,broker,workerUrl:'/lib/guest-worker.js',
    renderPublication:publication.buffer,sharedRenderWorker:true,d3dimGpu:true,
    log:s=>evidence.logs.push(s)});
  const raw=(name,...args)=>link.callExport(name,...args);
  let stack;
  const call=async(name,...args)=>{await raw('pa_stack',stack);return (await raw(name,...args))>>>0;};
  const alloc=async n=>{const p=(await raw('pa_alloc',n))>>>0;check(p,'allocation');return p;};
  const write=(p,v)=>raw('guest_write32',p,v);
  const read=async p=>(await raw('guest_read32',p))>>>0;
  const words=new Int32Array(memory.buffer),rpc=GuestRpc.views(memory,0).i32;
  const ringState=()=>Object.fromEntries(['read_pos','write_pos','done_seq','consumer','error_code'].map(name=>
    [name,Atomics.load(words,(ring>>>2)+GpuStreamDoorbell.W[name])>>>0]));
  const fencePending=()=>Atomics.load(rpc,GuestRpc.SLOT.RENDER_WAIT)===(ring|0);
  const holdDraw=async draw=>{
    await control('hold');const n=scheduled;await draw();
    // Small draws publish records without requiring a kick. Notify using the
    // ordinary production bridge, without editing any ring/producer fields.
    await stream.kick(ring,GpuStream.CONST.KICK_ASYNC);
    await until(()=>scheduled>n,'actual doorbell callback held');
    const state=ringState();check(state.read_pos!==state.write_pos,'actual pending stream records');return state;
  };
  try{
    await link.start();await raw('pw_init');stack=await alloc(4096)+2048;
    manager=new RenderWorker.Manager({module,memory,sigs,imageBase:0x400000,
      workerUrl:'/lib/palette-render-worker.js',sourceVersion:'palette-worker-fixture',
      reclaimHeap:head=>raw('d3d_render_adopt_free_list',head)});
    manager.worker.addEventListener('message',event=>{
      if(event.data.t==='palette-control')evidence.controls.push(event.data);
      if(event.data.t==='palette-scheduled')scheduled++;
    });
    await manager.ready;
    await raw('pa_seed',await alloc(1024));
    const dd=await raw('pa_ddraw'),desc=await alloc(128),out=await alloc(16),entries=await alloc(1024);
    const surface=async(bpp,caps,size=4)=>{
      for(let i=0;i<128;i+=4)await write(desc+i,0);
      for(const [o,v] of [[0,108],[4,0x1007],[8,size],[12,size],[72,32],[76,bpp===8?0x60:0x41],[84,bpp],[104,caps]])await write(desc+o,v);
      if(bpp===32)for(const [o,v] of [[88,0xff0000],[92,0xff00],[96,0xff],[100,0xff000000]])await write(desc+o,v);
      eq(await call('pa_surface',dd,desc,out),0,'CreateSurface');return read(out);
    };
    const texture=await surface(8,0x1000);
    // Retain a real surface as padding: RT clears/readback must not dirty the
    // texture's 4KB watch page merely because both small DIBs share a page.
    await surface(32,0x1000,128);
    const rt=await surface(32,0x2040);
    eq(await call('pa_device',rt,out),0,'CreateDevice');const device=await read(out);
    const rgb=[64,128,192],packed=a=>rgb[0]|rgb[1]<<8|rgb[2]<<16|a<<24;
    for(let i=0;i<256;i++)await write(entries+4*i,packed(255));
    const palette=async caps=>{eq(await call('pa_palette',dd,caps,entries,out),0,'CreatePalette');return read(out);};
    // Keep palette storage away from state/stack/vertex and allocator writes.
    // Retained allocations are deliberate fixture padding, never freed live.
    await alloc(8192);
    const alpha=await palette(0x404),alphaSlot=(await raw('pa_entry',alpha))>>>0;
    const palData=(await raw('pa_palette_data',alpha))>>>0;
    await alloc(8192);
    await raw('pa_bind',device,0,texture);eq(await call('pa_attach',texture,alpha),0,'attach alpha');
    eq(await raw('pw_refs',alpha),2,'caller and attachment own palette');
    const texDib=await raw('pw_dib',texture),rtDib=await raw('pw_dib',rt),rtEntry=await raw('pa_entry',rt);
    check((texDib>>>12)!==(rtDib>>>12),'texture and RT watch pages are separate');
    evidence.watchLayout={texDib,rtDib,initialAlphaPaletteData:palData};
    const texGuest=await raw('pa_w2g',texDib);
    for(let i=0;i<16;i++)await raw('guest_write8',texGuest+i,7);
    const vertices=await alloc(192),fv=new DataView(new ArrayBuffer(4));
    const float=async(p,v)=>{fv.setFloat32(0,v,true);await write(p,fv.getUint32(0,true));};
    for(const [i,[x,y,u,v]] of [[-.5,-.5,0,0],[3.5,-.5,1,0],[-.5,3.5,0,1],[3.5,-.5,1,0],[3.5,3.5,1,1],[-.5,3.5,0,1]].entries()){
      const p=vertices+i*32;for(const [j,n] of [x,y,.5,1].entries())await float(p+j*4,n);
      await write(p+16,0xffffffff);await write(p+20,0);await float(p+24,u);await float(p+28,v);
    }
    for(const [id,v] of [[7,0],[14,0],[15,0],[22,1],[27,1],[19,5],[20,6],[28,0],[41,0]])await raw('pa_rs',device,id,v);
    for(const [id,v] of [[1,2],[2,2],[4,2],[5,2],[13,3],[14,3],[16,1],[17,1]])await raw('pa_tss',device,0,id,v);
    await raw('pa_tss',device,1,1,1);await raw('set_page_watch_audit',0);
    const clear=async(color=0xff000000,flags=1)=>eq(await raw('pa_clear',rtEntry,flags,color,1,0,0,4,4,0),1,'real clear');
    let drawCount=0;
    const draw=()=>{drawCount++;return raw('pa_draw',device,4,3,vertices,6);};
    const observe=(label,expected)=>{
      const b=new Uint8Array(memory.buffer,rtDib+20,4),actual=[b[2],b[1],b[0],b[3]].slice(0,expected.length);
      evidence.observations.push({label,actual,expected});eq(actual,expected,label);
    };
    // The production GPU deliberately declines clears until it has drawn on
    // the target. Establish that ownership with a real queued draw and fence.
    await draw();await raw('pw_fence');observe('initial GPU ownership',rgb);
    const barrier=async(label,mutation,expected)=>{
      await clear();await raw('pw_fence');
      const record={label,before:await holdDraw(draw),
        ownershipBefore:Array.from(new Uint8Array(memory.buffer,alphaSlot,32)),
        entryBefore:Array.from(new Uint8Array(memory.buffer,palData+28,4))};evidence.barriers.push(record);
      // Current producer copies palette/geometry/state into owned ring arena
      // records. These API mutations may complete before replay: unlike the
      // retired executor, they need not retain the live palette until drain.
      const value=await mutation();record.value=value;record.mutationCompletedBeforeDrain=true;
      record.ownershipAfter=Array.from(new Uint8Array(memory.buffer,alphaSlot,32));
      record.entryAfter=Array.from(new Uint8Array(memory.buffer,palData+28,4));
      eq(ringState().done_seq,record.before.done_seq,'mutation did not drain held records');
      let settled=false;const fence=raw('pw_fence').then(v=>{settled=true;return v;});
      await until(fencePending,'real guest doorbell SYNC wait');
      check(!settled,'CPU fence cannot complete while callback held');
      record.pending=ringState();record.fenceBlockedBeforeDrain=true;
      await control('flush');await fence;record.after=ringState();
      eq(record.after.read_pos,record.after.write_pos,'all published records completed');
      observe(label+' old generation',expected);return value;
    };
    eq(await barrier('caller Release',()=>call('pw_release',alpha),rgb),1,'surface retains reference');
    eq(await raw('pw_refs',alpha),1,'attachment survives Release');
    await write(entries,packed(128));
    eq(await barrier('SetEntries',()=>call('pa_entries',alpha,7,1,entries),rgb),0,'entry update');
    const alphaUploadsBefore=(await raw('d3dim_gps_stat',8))>>>0;
    await clear();await draw();await raw('pw_fence');observe('new alpha generation blends',[32,64,96,191]);
    const alphaUploadsAfter=(await raw('d3dim_gps_stat',8))>>>0;
    check(alphaUploadsAfter>alphaUploadsBefore,'alpha-only SetEntries reuploads current texture');
    evidence.alphaGeneration={alphaUploadsBefore,alphaUploadsAfter};
    check(await raw('pw_exhaust')>0,'fill unused slots through actual allocator');
    eq(await barrier('final detach',()=>call('pa_attach',texture,0),[32,64,96]),0,'detach');
    eq(await raw('pw_type',alpha),0,'attachment final release retires palette');
    await clear();await draw();await raw('pw_fence');observe('detached grayscale',[7,7,7]);
    await write(entries+7*4,packed(128));
    // Slot reuse does not reuse palette storage: CreatePalette heap-allocates
    // a fresh1024 bytes. Isolate this later allocation too, after pw_exhaust
    // and vertex allocation; the earlier alpha-palette padding cannot do so.
    await alloc(8192);
    const replacement=await palette(4);
    const replacementData=(await raw('pa_palette_data',replacement))>>>0;
    await alloc(8192);
    const deviceEntry=(await raw('pa_entry',device))>>>0;
    // d3ddev_state reads the guest pointer at device entry+16.
    const stateGuest=new DataView(memory.buffer).getUint32(deviceEntry+16,true);
    Object.assign(evidence.watchLayout,{replacementPaletteData:replacementData,
      deviceState:(await raw('guest_to_wasm',stateGuest))>>>0,
      vertices:(await raw('guest_to_wasm',vertices))>>>0,
      stack:(await raw('guest_to_wasm',stack))>>>0});
    eq((await raw('pa_entry',replacement))>>>0,alphaSlot,'natural retired slot reuse');
    eq(await raw('pw_refs',replacement),1,'new slot ownership');
    evidence.slotReuse={alpha,replacement,alphaSlot,replacementSlot:(await raw('pa_entry',replacement))>>>0,
      naturalAllocatorExhaustion:true,initialPaletteData:palData,replacementData};
    eq(await call('pa_attach',texture,replacement),0,'ordinary replacement');
    await clear();await draw();await raw('pw_fence');observe('reused ordinary palette ignores peFlags',rgb);

    // Exercise the same real transport with an ordinary keyed palette. All
    // three native indices have identical RGB; only index 7 is a key. Keep
    // these bytes and palette unchanged throughout the mode/cache switches.
    for(let y=0;y<4;y++)for(let x=0;x<4;x++)await raw('guest_write8',texGuest+y*4+x,[7,8,9,9][x]);
    await write(out,7);await write(out+4,7);
    eq(await call('pa_key',texture,out),0,'Worker SetColorKey native index 7');
    const rs=(id,v)=>raw('pa_rs',device,id,v);
    await rs(27,0);await rs(41,1);await rs(144,1);
    evidence.readback='production READBACK and native ARGB DIB conversion, including actual alpha';
    const opaque=[...rgb,255],zero=[0,0,0,0],background=[17,34,51,255];
    const recordRGBA=(label,expected)=>{
      const actual=[0,1,2].map(x=>{
        const b=new Uint8Array(memory.buffer,rtDib+16+x*4,4);
        return [b[2],b[1],b[0],b[3]];
      });
      // Retain numeric failure evidence before throwing, including alpha.
      evidence.observations.push({label,actual,expected});eq(actual,expected,label);
    };
    const renderRGBA=async(label,expected)=>{
      await clear(0xff112233);await draw();await raw('pw_fence');recordRGBA(label,expected);
    };
    await renderRGBA('Worker explicit key zero RGBA/native duplicate RGB',[zero,opaque,opaque]);
    // Delay only the actual doorbell schedule callback. Mutate live device
    // state after the WAT producer has copied the draw, then let it replay
    // it. Reading live state instead of the queued snapshot must fail pixels.
    const snapshot=async(label,nextMode,expected)=>{
      await clear(0xff112233);await raw('pw_fence');
      const record={label,nextMode,before:await holdDraw(draw)};evidence.snapshots.push(record);
      await rs(144,nextMode);record.stateChangedBeforeDrain=true;
      eq(ringState().done_seq,record.before.done_seq,'state changed with draw still queued');
      await control('flush');
      await raw('pw_fence');recordRGBA(label,expected);
    };
    await snapshot('Worker queued TRUE survives live FALSE',0,[zero,opaque,opaque]);
    await renderRGBA('Worker FALSE cache transition legacy rejection',[background,opaque,opaque]);
    await snapshot('Worker queued FALSE survives live TRUE',1,[background,opaque,opaque]);
    await renderRGBA('Worker TRUE cache restore unchanged bytes',[zero,opaque,opaque]);
    await rs(41,0);
    await renderRGBA('Worker state144 alone does not key',[opaque,opaque,opaque]);
    // Rebuild first in legacy mode: stale legacy RGB/zero-alpha must become
    // visible if the subsequent TRUE transition omits keyBlend cache identity.
    await rs(41,1);await rs(144,0);
    await renderRGBA('Worker FALSE primes colored zero-alpha cache',[background,opaque,opaque]);
    // The current WAT producer owns texture identity/watch validation. Its
    // upload counter replaces the retired executor's PageLease/cache stats.
    const uploadsBefore=(await raw('d3dim_gps_stat',8))>>>0;
    await renderRGBA('Worker unchanged FALSE uses cached texture',[background,opaque,opaque]);
    const uploadsAfter=(await raw('d3dim_gps_stat',8))>>>0;
    evidence.cacheReuse={uploadsBefore,uploadsAfter,contract:'current producer textureUploads'};
    eq(uploadsAfter,uploadsBefore,'unchanged FALSE must reuse producer texture');
    await rs(144,1);
    await renderRGBA('Worker FALSE to TRUE replaces cached key RGB',[zero,opaque,opaque]);
    await rs(41,1);await rs(15,1);await rs(25,5);await rs(24,0);
    await renderRGBA('Worker application GREATER0 rejects zero alpha',[background,opaque,opaque]);
    await rs(15,0);await rs(27,1);
    await renderRGBA('Worker application blend preserves destination',[background,opaque,opaque]);
    await rs(27,0);
    // SELECTARG2(DIFFUSE) makes stage alpha opaque: application rejection
    // must use stage output, while the keyed sample RGB remains zero.
    await raw('pa_tss',device,0,4,3);await raw('pa_tss',device,0,6,0);await rs(15,1);
    await renderRGBA('Worker opaque stage alpha passes application test',[[0,0,0,255],opaque,opaque]);
    // The near keyed draw and far opaque draw use actual queued geometry.
    // A discarded near fragment must leave depth untouched; a surviving zero
    // alpha fragment (or opaque stage alpha) must occlude the far green draw.
    const geometry=async(z,color)=>{
      for(let i=0;i<6;i++){await float(vertices+i*32+8,z);await write(vertices+i*32+16,color);}
    };
    const depth=async(label,test,stageAlpha,expected)=>{
      await raw('pa_bind',device,0,texture);await raw('pa_tss',device,0,4,stageAlpha);
      await rs(15,test);await clear(0xff112233,3);
      await geometry(.1,0xffffffff);await draw();
      await rs(15,0);await raw('pa_bind',device,0,0);
      await geometry(.5,0xff00ff00);await draw();await raw('pw_fence');
      recordRGBA(label,expected);
    };
    await rs(7,1);await rs(14,1);await rs(23,2);
    await depth('Worker rejected key leaves depth unwritten',1,2,[[0,255,0,255],opaque,opaque]);
    await depth('Worker surviving zero alpha writes depth',0,2,[zero,opaque,opaque]);
    await depth('Worker opaque stage alpha passes test and writes depth',1,3,[[0,0,0,255],opaque,opaque]);
    await rs(7,0);await rs(14,0);await raw('pa_bind',device,0,texture);
    await geometry(.5,0xffffffff);
    await rs(15,0);await raw('pa_tss',device,0,4,2);await rs(41,0);await rs(144,0);
    eq(await call('pw_release',replacement),1,'replacement attachment ownership');
    eq(await call('pa_attach',texture,0),0,'replacement final detach');
    eq(await raw('pw_type',replacement),0,'replacement retired');
    evidence.executor=await port.request({t:'gps-kick',ring,mode:0});
    eq(evidence.executor.stats.draws,drawCount,'every completed draw ran in actual executor');
    if(backend==='webgl')check(evidence.executor.glRenderer&&/^webgl/.test(evidence.executor.stats.backend),'actual Chrome WebGL without software fallback');
    await clear();await raw('pw_fence');
    const retiredEndpoint=port.id,beforeClose=await holdDraw(draw);
    let settled=false;const pendingFence=raw('pw_fence').then(v=>{settled=true;return v;});
    await until(fencePending,'pending CPU readback before CLOSE');check(!settled,'pending readback is real');
    await stream.kick(ring,GpuStream.CONST.KICK_CLOSE);await pendingFence;
    observe('CLOSE completes pending real readback',[8,8,8,255]);
    check(!GpuStreamDoorbell.armed(words,ring),'CLOSE detached consumer');
    const completed=ringState(),closedPort=port;
    await stream.kick(ring,GpuStream.CONST.KICK_ASYNC);await stream.workerTail;
    check(port.id!==retiredEndpoint,'replacement endpoint identity');
    const beforeLate=await port.request({t:'gps-kick',ring,mode:0});
    const flushed=await control('flush');
    const afterLate=await port.request({t:'gps-kick',ring,mode:0});
    eq(afterLate.stats.doorbellDrains,beforeLate.stats.doorbellDrains,'retired callback cannot drain replacement');
    eq(ringState().done_seq,completed.done_seq,'late callback does not complete new work');
    eq(closedPort.requests.size,0,'retired endpoint requests empty');
    evidence.closeScope={beforeClose,completed,retiredEndpoint,replacementEndpoint:port.id,flushed,
      oldRequests:closedPort.requests.size,doorbellDrainsBefore:beforeLate.stats.doorbellDrains,
      doorbellDrainsAfter:afterLate.stats.doorbellDrains};
    // Reopen only the completed empty ring for notification lifetime. CLOSE
    // destroys device resources; this producer cannot resume old resource IDs.
    const stat=async i=>(await raw('d3dim_gps_stat',i))>>>0;
    evidence.producerStats={draws:await stat(0),fallbacks:await stat(1),readbacks:await stat(2),
      textureUploads:await stat(8),declined:await stat(14)};
    evidence.endpointStats=await port.request({t:'gps-kick',ring,mode:0});
    evidence.expectedDrawCalls=drawCount;
    eq(evidence.producerStats.draws,drawCount,'every draw used current producer');
    eq(evidence.producerStats.fallbacks,0,'no producer fallback');eq(evidence.producerStats.declined,0,'no declines');
    eq(ringState().error_code,0,'no stream error');
    if(backend==='webgl')check(evidence.endpointStats.glRenderer,'replacement retains actual WebGL driver');
    return evidence;
  }finally{
    // Keep the owning guest instance alive until it has adopted the retired
    // render heap through the production export; then terminate the guest.
    try{
      if(manager){await control('flush');await stream.close();evidence.retirement=await manager.stop();}
    }finally{await link.stop();}
    evidence.ownedScopes={guestPending:link._pending.size,guestWorker:!!link.worker,
      renderPorts:manager?.ports.size,renderPending:manager?.pending.size,
      renderClosing:manager?.closing.size,renderBytes:manager?.queuedBytes,renderRetired:manager?._retired};
    check(!link.worker&&link._pending.size===0,'guest retired with empty request scope');
    check(manager?._retired&&manager.ports.size===0&&manager.pending.size===0&&manager.closing.size===0&&manager.queuedBytes===0,'shared render heap retired with empty owned scopes');
  }
};
