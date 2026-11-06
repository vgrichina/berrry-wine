// Opt-in diagnostic only. Raw owning-worker inputs, not a replayable frame.
(function(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.D3DIMDrawTrace = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  function create({ endpointId, maxBytes = 262144, maxCommands = 16, timeoutMs = 1000 } = {}) {
    for (const [name, value, limit] of [
      ['endpointId', endpointId, 0xffffffff], ['maxBytes', maxBytes, 4194304],
      ['maxCommands', maxCommands, 256], ['timeoutMs', timeoutMs, 5000],
    ]) if (!Number.isSafeInteger(value) || value < 1 || value > limit)
      throw new RangeError('invalid trace ' + name);
    const records = [];
    let bytes = 0, phase = 'recording', reason = null;
    const timer = setTimeout(() => stop('deadline'), timeoutMs);
    function stop(why = 'requested') {
      if (phase !== 'recording') return;
      phase = 'stopped'; reason = why; clearTimeout(timer);
    }
    function record(source, offset, sequence, ordinal) {
      if (phase !== 'recording') return;
      // Observation must never swallow a real renderer result or exception.
      try {
        const d = new DataView(source.buffer, source.byteOffset, source.byteLength);
        if (!Number.isSafeInteger(offset) || offset < 0 || offset + 32 > source.byteLength)
          return stop('malformed-record');
        const size = d.getUint32(offset, true), kind = d.getUint32(offset + 28, true);
        if (kind !== 0) return stop('unsupported-record-' + kind);
        const stateBytes = d.getUint32(offset + 20, true);
        const vertexBytes = d.getUint32(offset + 24, true);
        const count = d.getUint32(offset + 16, true);
        const type = d.getUint32(offset + 12, true);
        if (size !== 32 + stateBytes + vertexBytes || stateBytes !== 4096 ||
            size > source.byteLength - offset || vertexBytes !== count * 32 ||
            !count || type < 1 || type > 4)
          return stop('malformed-record');
        if (records.length >= maxCommands) return stop('command-limit');
        if (size > maxBytes - bytes) return stop('byte-limit');
        records.push({ sequence, ordinal,
          header: source.slice(offset, offset + 32),
          state: source.slice(offset + 32, offset + 32 + stateBytes),
          vertices: source.slice(offset + 32 + stateBytes, offset + size) });
        bytes += size;
        if (records.length === maxCommands) stop('command-limit');
      } catch (_) { stop('observation-error'); }
    }
    function receipt() {
      return { version: 1, kind: 'legacy-d3dim-owning-draw-trace', endpointId,
        replayable: false, complete: false, phase, reason, bytes,
        maxBytes, maxCommands, timeoutMs, commands: records.length,
        limitations: 'Raw state/vertices only; live resource pointers, initial color/depth, clears and guest writes are not preserved. Not a frame or correctness result.',
        records: records.map(r => ({ ...r, header: r.header.slice(),
          state: r.state.slice(), vertices: r.vertices.slice() })) };
    }
    return { record, stop, receipt, get active() { return phase === 'recording'; } };
  }

  // Bounded, read-only observation at natural GPU submission boundaries.
  // Does not flush batches, touch a DIB, call guest exports or change fences.
  function createGround({endpointId, x, y, maxRecords=8, timeoutMs=1000}={}) {
    for (const [name,value,lo,hi] of [['endpointId',endpointId,1,0xffffffff],
      ['x',x,0,2047],['y',y,0,2047],['maxRecords',maxRecords,1,32],['timeoutMs',timeoutMs,1,600000]])
      if (!Number.isInteger(value)||value<lo||value>hi) throw new RangeError('invalid ground diagnostic '+name);
    let active=true,reason=null,submissions=0;
    const records=[],targets=[],timer=setTimeout(()=>stop('deadline'),timeoutMs);
    function stop(why){if(active){active=false;reason=why;clearTimeout(timer);}}
    const clone=value=>JSON.parse(JSON.stringify(value));
    function pixel(t){
      const g=t.device.gpu,gl=g.gl,p=new Uint8Array(4);
      if(g._target?.explicit||g._drawable)throw new Error('ground diagnostic requires implicit legacy target');
      g.readPixels(x,t.height-1-y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);
      return Array.from(p);
    }
    function before(owner,t,draw){
      if(!active)return null;
      try {
        const serial=++submissions,source=draw.legacySource;
        if(targets.length<8&&!targets.some(q=>q.rt===t.rt))targets.push({rt:t.rt,dib:t.dib,width:t.width,height:t.height,bpp:t.bpp,format:t.format});
        if(!source||draw.primitive!==4||x>=t.width||y>=t.height)return null;
        const sc=draw.scissor;
        if(sc?.enabled&&(x<sc.left||x>=sc.right||y<sc.top||y>=sc.bottom))return null;
        const data=new DataView(draw.vertices.buffer,draw.vertices.byteOffset,draw.vertices.byteLength),hits=[];
        for(let n=0;n<draw.primitiveCount&&hits.length<4;n++){
          const v=[0,1,2].map(k=>{const p=(n*3+k)*draw.stride;return {
            x:data.getFloat32(p,true),y:data.getFloat32(p+4,true),z:data.getFloat32(p+8,true),rhw:data.getFloat32(p+12,true),
            rgba:Array.from(draw.vertices.subarray(p+16,p+20)),uv:[data.getFloat32(p+24,true),data.getFloat32(p+28,true)]};});
          const [a,b,c]=v,det=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
          if(!Number.isFinite(det)||det===0)continue;
          const w0=((b.y-c.y)*(x-c.x)+(c.x-b.x)*(y-c.y))/det,
            w1=((c.y-a.y)*(x-c.x)+(a.x-c.x)*(y-c.y))/det,w=[w0,w1,1-w0-w1];
          if(w.some(q=>q<0||q>1)||v.some(q=>!(q.rhw>0)))continue;
          const denominator=w.reduce((s,q,i)=>s+q*v[i].rhw,0),uv=[0,1].map(k=>w.reduce((s,q,i)=>s+q*v[i].rhw*v[i].uv[k],0)/denominator);
          const span=draw.legacySpans?.find(s=>n>=s.first&&n<s.first+s.count);
          hits.push({triangle:n,source:clone(span?span.source:source),vertices:v,barycentric:w,uv});
        }
        if(!hits.length)return null;
        const d=source.description,cache=owner.textures.get(d.texture);
        const texture=cache?{key:cache.key,width:cache.width,height:cache.height,bpp:cache.bpp,format:cache.format,pitch:cache.pitch,dib:cache.dib,
          palette:cache.palette,keyRaw:cache.keyRaw,keyed:cache.keyed,keyBlend:cache.keyBlend,paletteAlpha:cache.paletteAlpha,samples:[]}:null;
        if(texture&&draw.stride===32){
          const address=(i,size,mode)=>{
            if(i>=0&&i<size)return i;
            if(mode===1)return ((i%size)+size)%size;
            if(mode===2){const n=((i%(size*2))+size*2)%(size*2);return n<size?n:size*2-1-n;}
            return mode===3?Math.max(0,Math.min(size-1,i)):null;
          };
          const sampler=draw.textures[0]?.sampler;
          for(const hit of hits){
            if(!hit.uv.every(Number.isFinite))continue;
            const u=hit.uv[0]*cache.width,v=hit.uv[1]*cache.height;
            for(const [a,b] of [[Math.floor(u),Math.floor(v)],[Math.floor(u-.5),Math.floor(v-.5)],
              [Math.floor(u-.5)+1,Math.floor(v-.5)],[Math.floor(u-.5),Math.floor(v-.5)+1],[Math.floor(u-.5)+1,Math.floor(v-.5)+1]]){
              const sx=address(a,cache.width,sampler?.addressU??d.addressU),sy=address(b,cache.height,sampler?.addressV??d.addressV);
              if(sx===null||sy===null)continue;
              const offset=cache.dib+sy*cache.pitch+sx*(cache.bpp/8),native=Array.from(owner.u8.subarray(offset,offset+cache.bpp/8));
              const palette=cache.bpp===8&&cache.palette?Array.from(owner.u8.subarray(cache.palette+native[0]*4,cache.palette+native[0]*4+4)):null;
              texture.samples.push({triangle:hit.triangle,xy:[sx,sy],native,palette,decoded:Array.from(cache.pixels.subarray((sy*cache.width+sx)*4,(sy*cache.width+sx+1)*4))});
            }
          }
        }
        const record={submission:serial,source:clone(source),target:{rt:t.rt,dib:t.dib,width:t.width,height:t.height,bpp:t.bpp,format:t.format},
          primitiveCount:draw.primitiveCount,stride:draw.stride,state:clone(draw.state),fixedFunction:clone(draw.fixedFunction),scissor:clone(draw.scissor),
          textures:draw.textures.map(image=>({key:image.key,width:image.width,height:image.height,sampler:clone(image.sampler)})),hits,texture,before:pixel(t),completed:false};
        records.push(record);if(records.length===maxRecords)stop('record-limit');return record;
      } catch(error){stop('observation-error: '+String(error));return null;}
    }
    function after(t,record){
      if(!record)return;
      try {record.after=pixel(t);record.completed=true;}
      catch(error){stop('observation-error: '+String(error));record.observationError=String(error);}
    }
    function receipt(){return clone({version:1,kind:'legacy-owning-ground-diagnostic',endpointId,point:[x,y],active,reason,submissions,maxRecords,timeoutMs,targets,records,
      limitations:'Natural GPU submissions; may contain merged commands. Triangle coverage is inclusive geometry only, not a depth/alpha/cull visibility oracle. UV candidates use integer target coordinates, without the production shader subpixel tie offset; native samples are observation-time level zero, not exact sampled-texel or original asset provenance. Complex/projected UVs and mip selection have no sample oracle. No DIB write, guest export, batching change or new render fence. Before/after target reads synchronize GPU samples only.'});}
    return {before,after,receipt,stop,get active(){return active;}};
  }
  // Installed only when explicitly armed. Wrappers never flush, call a guest
  // export, or catch a renderer exception. Observation exceptions stop only
  // observation. The receipt describes partial orders, never a whole frame.
  function createProducer(options = {}) {
    const {endpointId,x,y,maxEvents=128,timeoutMs=600000}=options;
    for(const [name,value,lo,hi] of [['endpointId',endpointId,1,0xffffffff],
      ['x',x,0,2047],['y',y,0,2047],['maxEvents',maxEvents,8,512],['timeoutMs',timeoutMs,1,600000]])
      if(!Number.isInteger(value)||value<lo||value>hi)throw new RangeError('invalid producer diagnostic '+name);
    const clone=v=>v===undefined?null:JSON.parse(JSON.stringify(v));
    let active=true,reason=null,serial=0,dropped=0,owner=null,current=null,ground=null;
    const events=[],counts={},restores=[],drawRoutes=[];
    const timer=setTimeout(()=>stop('deadline'),timeoutMs);
    const target=t=>t?{rt:t.rt,dib:t.dib,width:t.width,height:t.height,bpp:t.bpp,format:t.format,pitch:t.pitch}:null;
    const relevant=t=>t&&x<t.width&&y<t.height;
    function stop(why='requested'){if(active){active=false;reason=why;clearTimeout(timer);}}
    function observe(fn){if(!active)return null;try{return fn();}catch(e){stop('observation-error: '+String(e));return null;}}
    function count(key){counts[key]=(counts[key]||0)+1;}
    function event(kind,detail){
      const row={order:++serial,kind,command:clone(owner?.commandContext),...detail};
      count(kind);
      if(events.length<maxEvents)events.push(row);else dropped++;
      return row;
    }
    function pixel(t){
      if(!relevant(t))return null;
      const g=t.device.gpu,gl=g.gl,p=new Uint8Array(4);
      if(g._target?.explicit||g._drawable)throw Error('producer diagnostic requires implicit target');
      if('_implicitTarget' in g&&!g._implicitTarget)return null;
      g.readPixels(x,t.height-1-y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);
      return Array.from(p);
    }
    function native(t,bytes,pitch){
      if(!relevant(t))return null;
      const size=t.bpp>>>3,p=y*pitch+x*size;
      return Array.from(bytes.subarray(p,p+size));
    }
    function wrap(name,before,after){
      const original=owner[name];
      if(typeof original!=='function')throw Error('missing producer route '+name);
      const wrapped=function(...args){
        const token=observe(()=>before?.(args));
        let value;
        // Retain original return and error identity, including deferred draws.
        try{value=original.apply(this,args);}
        catch(error){observe(()=>event('renderer-error',{route:name,error:String(error)}));throw error;}
        observe(()=>after?.(args,value,token));return value;
      };
      owner[name]=wrapped;restores.push(()=>{if(owner[name]===wrapped)owner[name]=original;});
    }
    function attach(gpu){
      if(owner)throw Error('producer diagnostic already attached');owner=gpu;
      try{for(const name of ['_describe','_draw','_upload','_clear','_writeBack','_flip','_submitImmediate'])if(typeof owner[name]!=='function')throw Error('missing producer route '+name);}
      catch(error){dispose();throw error;}
      wrap('_describe',null,(args,value)=>{if(current&&value)current.description=value;});
      wrap('_draw',args=>{
        count('draw-api');const wa=args[0],u=p=>owner.dv.getUint32(wa+p,true);
        const call={order:++serial,command:clone(owner.commandContext),self:u(0),primitive:u(4),vertexType:u(8),vertices:u(12),count:u(16)};
        current=call;return call;
      },(args,result,call)=>{
        current=null;count(result?'draw-api-accepted':'draw-api-declined');
        const d=call.description,key=[call.primitive,call.vertexType,result,d?.rt||0].join('/');
        let summary=drawRoutes.find(row=>row.key===key);
        if(!summary&&drawRoutes.length<64){summary={key,primitive:call.primitive,vertexType:call.vertexType,result,target:d?{rt:d.rt,dib:d.dib,width:d.width,height:d.height,bpp:d.bpp,format:d.format}:null,
          firstOrder:call.order,lastOrder:call.order,calls:0,minCount:call.count,maxCount:call.count};drawRoutes.push(summary);}
        if(summary){summary.calls++;summary.lastOrder=call.order;summary.lastDib=d?.dib??null;summary.minCount=Math.min(summary.minCount,call.count);summary.maxCount=Math.max(summary.maxCount,call.count);}
        else count('draw-route-summary-overflow');
        // Accepted does not mean a GPU submission or selected pixel coverage.
        if(!result)event('draw-declined',{call,result});
      });
      wrap('_upload',args=>{
        const [t,bytes,pitch,top,bottom,sourceDib]=args;
        count('upload-route');
        if(!relevant(t)||y<top||y>=bottom)return null;
        return event('target-upload',{target:{...target(t),dib:sourceDib??t.dib},rows:[top,bottom],native:native(t,bytes,pitch),
          before:pixel(t),completed:false,provenance:'DIB bytes at natural upload; earlier CPU writer is not identified by this event'});
      },(args,value,row)=>{if(row){row.after=pixel(args[0]);row.completed=true;}});
      wrap('_clear',args=>{
        count('clear-api');const wa=args[0],d=owner.dv,rt=d.getUint32(wa,true),t=owner.targets.get(rt);
        return {rt,flags:d.getUint32(wa+4,true),color:d.getUint32(wa+8,true),
          rect:[16,20,24,28].map(n=>d.getInt32(wa+n,true)),target:target(t),
          before:pixel(t),pendingDrawBefore:!!owner.pendingDraw};
      },(args,result,row)=>{
        const t=owner.targets.get(row.rt);
        event(result?'clear-accepted':'clear-declined',{...row,result,after:pixel(t),
          provenance:'Natural GPU clear call; declined clear remains guest-local and is not observed as completed here'});
      });
      wrap('_writeBack',null,(args)=>{
        const [t,read,rect,dib]=args;count('readback-route');
        if(relevant(t)&&x>=rect[0]&&x<rect[2]&&y>=rect[1]&&y<rect[3])
          event('target-readback',{target:target(t),writtenDib:dib,rect:clone(rect),native:native(t,owner.u8.subarray(dib),t.pitch),completed:true,
            provenance:'Completed existing GPU readback to the named DIB; no new fence or readback requested'});
      });
      wrap('_flip',args=>{
        count('flip-api');const wa=args[0];return {front:owner.dv.getUint32(wa,true),back:owner.dv.getUint32(wa+4,true)};
      },(args,result,row)=>event('flip-result',{...row,result,provenance:'Natural GPU flip attempt; zero delegates swap to ordinary fenced guest path'}));
      wrap('_submitImmediate',args=>{
        count('gpu-submission');const [t,draw]=args;
        if(!draw.legacySource)count('submission-without-legacy-source');
        if(draw.primitive!==4)count('submission-nontriangle');
        if(!relevant(t))count('submission-outside-target');
        return null;
      });
      return api;
    }
    ground=createGround({endpointId,x,y,maxRecords:32,timeoutMs});
    // Ground's bounded triangle records remain separate from API decisions.
    // Missing source and nontriangle routes are explicitly counted above.
    function before(gpu,t,draw){return observe(()=>ground.before(gpu,t,draw));}
    function after(t,row){observe(()=>{ground.after(t,row);if(row)event('covering-gpu-draw',{record:clone(row)});});}
    function receipt(){return clone({version:1,kind:'legacy-owning-producer-diagnostic',endpointId,point:[x,y],
      active,reason,serial,maxEvents,dropped,countersCumulative:true,eventRetention:'earliest since arm or drain',counts,drawRoutes,events,ground:ground.receipt(),
      limitations:['GPU owner order only; CPU API order must be retained separately and joined only at natural barriers.',
        'Accepted API calls may still be pending batching. Declined clears and software fallback completions require separate CPU witnesses.',
        'No source attribution for target upload beyond observation-time DIB bytes. No source means an unobserved route, never proof of no geometry.',
        'Bounded earliest event retention; dropped is explicit. Ground triangle and sampling limitations still apply. No guest export, DIB write, added fence or batch flush.']});}
    function dispose(){stop('disposed');ground.stop('disposed');for(const restore of restores.reverse())restore();}
    function drain(){const r=receipt();events.length=0;dropped=0;ground.stop('drained');if(active)ground=createGround({endpointId,x,y,maxRecords:32,timeoutMs});return r;}
    const api={attach,before,after,receipt,drain,route(kind,detail){observe(()=>event(kind,detail));},stop(why){stop(why);ground.stop(why);},dispose,get active(){return active;}};
    return api;
  }

  // Observes the existing worker-local dx_trace import. No extra import or
  // message is issued. These are entry/boundary snapshots, not API returns.
  function createDxProducer({memory,regions,imageBase,slot=0,x,y,maxEvents=256,emit=null}={}){
    if(!memory?.buffer||!regions?.BASE||!Number.isInteger(imageBase)||!Number.isInteger(x)||!Number.isInteger(y)||
      x<0||y<0||x>2047||y>2047||!Number.isInteger(maxEvents)||maxEvents<1||maxEvents>1024)
      throw Error('invalid CPU producer diagnostic options');
    let serial=0,dropped=0,error=null,active=true;
    const events=[],counts={};
    const clone=v=>JSON.parse(JSON.stringify(v));
    const names={1:'lock-entry-before-fence',2:'unlock-entry-before-lazy-resolution',3:'blt-entry-before-fences',
      5:'present-boundary',6:'flip-boundary',11:'bltfast-key-state',12:'blt-rectangles-before-fences',
      17:'software-draw-after-worker-route',18:'software-small-draw-vertex',8:'execute-buffer-boundary',7:'execute-instruction',13:'colorfill-before-write',14:'bltfast-coordinates-before-copy',21:'allocation-before-initialization',22:'released'};
    function descriptor(index){
      if(!Number.isInteger(index)||index<0||index>=regions.SIZE.DX_OBJECTS/32)return null;
      const rt=regions.BASE.DX_OBJECTS+index*32,d=new DataView(memory.buffer),u=new Uint8Array(memory.buffer);
      const width=d.getUint16(rt+12,true),height=d.getUint16(rt+14,true),bpp=d.getUint16(rt+16,true),pitch=d.getUint16(rt+18,true),dib=d.getUint32(rt+20,true);
      const p=dib+y*pitch+x*(bpp>>>3),valid=dib&&x<width&&y<height&&[8,16,24,32].includes(bpp)&&p+(bpp>>>3)<=u.length;
      return {slot:index,rt,type:d.getUint32(rt,true),flags:d.getUint32(rt+8,true),width,height,bpp,pitch,dib,
        point:valid?Array.from(u.subarray(p,p+(bpp>>>3))):null};
    }
    function rect(guest){
      if(!guest)return null;
      const wa=(guest-imageBase+regions.BASE.GUEST_BASE)>>>0;
      // Only the direct guest window is independently translated here.
      // Sparse addresses remain unknown rather than calling a guest export.
      if(wa>=regions.BASE.VIRTUAL_BACKING_BASE||wa+16>memory.buffer.byteLength)return {guest,unknown:'outside direct translation'};
      const d=new DataView(memory.buffer);return {guest,wa,xyxy:[0,4,8,12].map(n=>d.getInt32(wa+n,true))};
    }
    function observe(kind,index,a,b,c){
      if(!active||!names[kind])return;
      try{
        const order=++serial,key=names[kind];counts[key]=(counts[key]||0)+1;
        if([7,8,17,18].includes(kind)){if(events.length<maxEvents){const row={order,workerSlot:slot,kind,key,args:[index,a,b,c],provenance:'Existing CPU draw trace; target and selected coverage unknown'};events.push(row);if(emit)emit(row);}else dropped++;return;}
        const dst=descriptor(index);
        const source=[3,6,11,12,14].includes(kind)?descriptor(a):null;
        if(!dst||(![21,22].includes(kind)&&(x>=dst.width||y>=dst.height))){counts['outside-selected-target']=(counts['outside-selected-target']||0)+1;return;}
        const row={order,workerSlot:slot,kind,key,args:[index,a,b,c],destination:dst,source,
          destinationRect:kind===12?rect(b):null,sourceRect:kind===12?rect(c):null,
          provenance:'Snapshot at existing dx_trace hook; completion and return value unobserved'};
        if(events.length<maxEvents){events.push(row);if(emit)emit(row);}else dropped++;
      }catch(e){error=String(e);active=false;}
    }
    function receipt(){return clone({version:1,kind:'legacy-cpu-producer-boundaries',workerSlot:slot,point:[x,y],active,error,serial,dropped,counts,events,
      limitations:['Existing trace hooks only; Blt/clear/Unlock snapshots are not completed-write receipts.',
        'CPU and GPU orders are separate; no wall-clock ordering assertion. No new RPC, guest export, write or fence.',
        'Source point uses native [x,y], not inferred Blt mapping; rectangles are retained for later independent mapping.',
        'Raw guest writes, GDI and operations without an existing dx_trace hook remain unobserved.']});}
    return {observe,receipt,stop(){active=false;},drain(){const r=receipt();events.length=0;dropped=0;return r;}};
  }

  return { create, createGround, createProducer, createDxProducer };
});
