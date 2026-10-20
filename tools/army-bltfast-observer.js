'use strict';
// Passive, bounded adapter for the pinned Army Men original callsite.
const install = require('./jig-owning-api-observer');
const NAME = 'IDirectDrawSurface_BltFast';
const CODE = '8d4424006a1050a1d8444700505251508b00ff501c';
// Guest COM stdcall ABI, not the five-register WAT handler signature.
// The original call pushes this,x,y,src,rect,flags; the handler reads flags
// at ESP+24 and pops 28 including the return address. Keep this diagnostic
// correction local: changing the generated dispatch metadata is separate work.
const ABI = Object.freeze({nargs:6, convention:'stdcall', stackBytes:28});
function diagnosticApis(apis) {
  const rows=apis.filter(a=>a.name===NAME);
  if (rows.length!==1 || rows[0].convention!==ABI.convention ||
      ![5,6].includes(rows[0].nargs))
    throw Error('Unexpected BltFast metadata; review diagnostic ABI');
  return apis.map(a=>a.name===NAME?{...a,nargs:ABI.nargs}:a);
}
function capture(o) {
  const apis=diagnosticApis(o.apis);
  const records = [], active = new Set();
  const check = (ok, why) => { if (!ok) throw Error(why); };
  function raw(p, n) {
    const b = o.getBuffer();
    check(Number.isSafeInteger(p) && p >= 256 && Number.isSafeInteger(n) &&
      n > 0 && p + n <= b.byteLength, 'invalid backing span');
    return new Uint8Array(b, p, n);
  }
  function guest(p, n) {
    check(Number.isInteger(p) && p > 0 && p + n <= 0x100000000, 'invalid guest span');
    const base = o.getExports().get_image_base() >>> 0, b = o.getBuffer();
    const w = o.g2w(p, base, b);
    for (let i = 1; i < n; i++)
      check(o.g2w(p + i, base, b) === w + i, 'noncontiguous guest span');
    return raw(w, n);
  }
  const view = a => new DataView(a.buffer, a.byteOffset, a.byteLength);
  function surface(pointer) {
    const slot = view(guest(pointer, 8)).getUint32(4, true);
    check(slot < 16384, 'invalid surface slot');
    const entry = o.regions.BASE.DX_OBJECTS + slot * 32;
    const d = view(raw(entry, 32));
    const s = {pointer, slot, entry, type:d.getUint32(0,true),
      width:d.getUint16(12,true), height:d.getUint16(14,true),
      bpp:d.getUint16(16,true), pitch:d.getUint16(18,true),
      backing:d.getUint32(20,true), flags:d.getUint32(28,true),
      format:view(raw(o.regions.BASE.DX_SURF_FMT + slot * 4,4)).getUint32(0,true)};
    check(s.type === 2 && s.width > 0 && s.height > 0, 'invalid surface identity/dimensions');
    check([8,16,24,32].includes(s.bpp) && !(s.format >= 7 && s.format <= 11),
      'unsupported pixel format');
    check(s.pitch >= s.width * s.bpp / 8, 'invalid pitch');
    raw(s.backing, s.pitch * s.height);
    return s;
  }
  const hex = a => Buffer.from(a).toString('hex');
  function pixels(s,x,y,n) { return hex(raw(s.backing+y*s.pitch+x*s.bpp/8,n*s.bpp/8)); }
  function entry(r) {
    // Even an unretained child invalidates its retained parent's pixel pairing.
    for (const parent of active) parent.interleaved = true;
    if (records.length >= 8) return;
    const c = {invocation:r.sequence, entry:r.entry, returnAddress:r.returnAddress,
      hresult:null, state:'missing-return', source:null, destination:null,
      initialCorruption:{status:'unknown', reason:'No independent clean reference; inspect pre-call samples.'}};
    r.army = c; records.push(c);
    if (active.size) {
      c.interleaved = true;
    }
    active.add(c);
    try {
      check(hex(guest(0x4074f1,CODE.length/2)) === CODE, 'original callsite bytes mismatch');
      check(r.args.length === ABI.nargs, 'incomplete arguments');
      const [dst,x,y,src,rect,flags] = r.args;
      c.flags = flags; c.dest = [x,y]; c.rectPointer = rect;
      c.source = surface(src); c.destination = surface(dst);
      check(src === dst && c.source.bpp === c.destination.bpp && flags === 0x10,
        'outside original same-surface no-colorkey scope');
      const d = view(guest(rect,16));
      const q = c.sourceRect = [0,4,8,12].map(i=>d.getInt32(i,true));
      const w=q[2]-q[0], h=q[3]-q[1], s=c.source, t=c.destination;
      check(q[0]>=0 && q[1]>=0 && w>0 && h>0 && q[2]<=s.width &&
        q[3]<=s.height && x+w<=t.width && y+h<=t.height, 'invalid copy bounds');
      const n=Math.min(8,w);
      c.samples=[];
      for (const dy of new Set([0,Math.floor((h-1)/2),h-1]))
        for (const dx of new Set([0,Math.floor((w-n)/2),w-n]))
          c.samples.push({dx,dy,pixels:n,
            sourcePre:pixels(s,q[0]+dx,q[1]+dy,n),
            destinationPre:pixels(t,x+dx,y+dy,n)});
      c.state='entered';
    } catch(e) { c.state='rejected'; c.error=String(e); }
  }
  function leave(r) {
    const c=r.army; if (!c) return;
    active.delete(c); c.hresult=r.exit.eax; c.exit=r.exit;
    try {
      check(c.state==='entered',c.error || 'incomplete entry');
      check(r.completed && !c.interleaved,'incomplete or interleaved handler');
      check(JSON.stringify(surface(c.source.pointer))===JSON.stringify(c.source) &&
        JSON.stringify(surface(c.destination.pointer))===JSON.stringify(c.destination),
        'surface metadata changed during call');
      for (const p of c.samples) {
        p.sourcePost=pixels(c.source,c.sourceRect[0]+p.dx,c.sourceRect[1]+p.dy,p.pixels);
        p.destinationPost=pixels(c.destination,c.dest[0]+p.dx,c.dest[1]+p.dy,p.pixels);
        p.matchesSourcePre=p.destinationPost===p.sourcePre;
      }
      c.state='complete'; // Complete evidence does not imply successful HRESULT.
      c.copyCheck=c.hresult===0 ?
        (c.samples.every(p=>p.matchesSourcePre)?'sampled-copy-matches':'sampled-copy-mismatch') :
        'not-evaluated-failed-hresult';
    } catch(e) { c.state='rejected'; c.error=String(e); }
  }
  const observer=install({...o,apis,names:[NAME],returnAddresses:[0x407506],
    emit:undefined,onEntry:entry,onExit:leave});
  function report(close=false) {
    const s=close?observer.close():observer.snapshot();
    const result=JSON.parse(JSON.stringify({records,observer:s,
      abi:{...ABI,tableNargs:o.apis.find(a=>a.name===NAME).nargs,
        source:'original six pushes and handler ESP+24 flags / 28-byte cleanup'},
      observation:'post-handler before guest caller resumes', limits:{calls:8,samplesPerCall:9,pixelsPerSample:8},
      accepted:records.length>0 && records.every(r=>r.state==='complete') &&
        !s.ambiguous && !s.errors.length && !s.pendingDepth}));
    for (const r of result.records) if (r.state==='entered') r.state='missing-return';
    // The observer's copy includes our same bounded records; avoid duplicate pixel storage.
    for (const r of result.observer.records) delete r.army;
    return result;
  }
  return {arm:()=>observer.arm(),bindBaseline:()=>observer.bindBaseline(),
    snapshot:()=>report(),close:()=>report(true)};
}
module.exports={capture,CODE,NAME,ABI,diagnosticApis};

// Source-only fixture tests import capture. A future admitted CLI run opts in
// with an exclusive output filename and --require this file.
if (process.env.ARMY_BLTFAST_OUTPUT) {
  const fs=require('node:fs'), path=require('node:path');
  const out=process.env.ARMY_BLTFAST_OUTPUT;
  if (process.env.WINE_REGION_MAP) throw Error('Use the matching default region map');
  if (!path.isAbsolute(out)) throw Error('ARMY_BLTFAST_OUTPUT must be absolute');
  const fd=fs.openSync(out,'wx',0o600);
  const original=WebAssembly.instantiate;
  let observer=null, seen=false;
  WebAssembly.instantiate=async function(module,imports) {
    if (!imports?.host?.memory || typeof imports.host.log_api_exit!=='function')
      return Reflect.apply(original,this,arguments);
    if (seen) throw Error('Army observer requires one owning instance and --no-threads');
    seen=true;
    let ex=null;
    const regions=require('../lib/region-map.generated');
    observer=capture({host:imports.host,getExports:()=>ex,
      getBuffer:()=>imports.host.memory.buffer,
      g2w:require('../lib/mem-utils').g2w, regions,
      apis:require('../src/api_table.json'),context:'Army CLI owning instance'});
    const result=await Reflect.apply(original,this,arguments);
    ex=(result.instance || result).exports;
    observer.bindBaseline(); observer.arm();
    return result;
  };
  process.once('exit',()=>{
    const r=observer?observer.close():{accepted:false,error:'No owning instance observed'};
    const data=JSON.stringify(r,null,2)+'\n';
    if (Buffer.byteLength(data)>256*1024) throw Error('Capture storage cap');
    fs.writeSync(fd,data); fs.closeSync(fd);
  });
}
