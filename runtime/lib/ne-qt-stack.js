'use strict';

// Read-only preparation for an owned QT stack alias. This deliberately does
// not publish a selector or enter guest code: those mutations belong under the
// native frame/lifetime lease. The segmented interpreter currently requires
// 64KiB-aligned bases (see 05c-seg16-ops.wat), so reject cross-window frames.
// No copied-stack fallback: BP-relative addresses must alias the PE caller.
function planNeQtStack(e,memoryBuffer,{esp,ebp}={}) {
  const uint32=(value,label)=>{
    if(!Number.isInteger(value)||value<0||value>0xffffffff)throw new RangeError('Invalid QT '+label);
    return value;
  };
  esp=uint32(esp,'ESP');ebp=uint32(ebp,'EBP');
  if((esp&1)||(ebp&1)||esp>0xffffffff-4)throw new RangeError('Unaligned or wrapping QT frame');
  const base=Math.floor(esp/65536)*65536,limit=65536,argumentStart=esp+4;
  // The original stack return occupies four bytes; EBP points past the
  // disposable scratch. Require all of them within one representable segment.
  if(esp-base<4||ebp<argumentStart||ebp>=base+limit)
    throw new RangeError('QT frame crosses the supported 64KiB stack window');
  if(ebp-argumentStart<0x3c)throw new RangeError('QT frame lacks its documented scratch area');
  const translate=guest=>{
    const at=e.guest_to_wasm(guest)>>>0;
    if(at===0xf0||at>=memoryBuffer.byteLength)throw new RangeError('Unmapped QT stack window');
    return at;
  };
  const wasmBase=translate(base);
  if(wasmBase>memoryBuffer.byteLength-limit)throw new RangeError('QT stack window outside memory');
  // g2w is affine within a guest page. Check both ends of every page; sparse
  // pages must form the same physical window as direct guest memory here.
  for(let offset=0;offset<limit;offset+=4096) {
    if(translate(base+offset)!==wasmBase+offset||
       translate(base+offset+4095)!==wasmBase+offset+4095)
      throw new RangeError('Noncontiguous QT stack window');
  }
  const returnWasm=wasmBase+esp-base;
  return Object.freeze({base,limit,wasmBase,esp,ebp,argumentStart,
    sp:esp-base,bp:ebp-base,returnWasm,
    returnAddress:new DataView(memoryBuffer).getUint32(returnWasm,true),
    // Cleanup may remove parameters/saved words but cannot cross into the
    // minimum documented scratch region. The native return must also reject
    // odd, backwards or wrapped SP and a changed SS before publishing results.
    maxCleanup:ebp-0x3c-argumentStart});
}

const neQtStackApi={planNeQtStack};
if(typeof module!=='undefined'&&module.exports)module.exports=neQtStackApi;
else globalThis.NeQtStack=neQtStackApi;
