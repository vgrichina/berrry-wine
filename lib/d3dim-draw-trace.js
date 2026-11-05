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
      ['x',x,0,2047],['y',y,0,2047],['maxRecords',maxRecords,1,32],['timeoutMs',timeoutMs,1,5000]])
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
  return { create, createGround };
});
