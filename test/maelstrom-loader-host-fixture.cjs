'use strict';
// Explicit offline WASM-export seams. This maps real pinned PE sections and
// HIGHLOW relocations in JS; it never emulates instructions or claims native QA.
const assert = require('node:assert/strict');
function host({real, events, files, fail, isArmed}) {
  const memory = {buffer:new SharedArrayBuffer(8 * 1024 * 1024)};
  const dv = new DataView(memory.buffer), bytes = new Uint8Array(memory.buffer);
  const wa = va => va - 0x400000 + 0x12000;
  const u32 = va => dv.getUint32(wa(va), true);
  const put = (va, n) => dv.setUint32(wa(va), n >>> 0, true);
  const str = va => { let s=''; for(let a=wa(va);bytes[a];a++)s+=String.fromCharCode(bytes[a]);return s; };
  const rows=[], names=new Map(); let eip=0x40e000,esp=0x801000,yieldReason=0,regs={eax:7,ecx:2,edx:3,ebx:4,ebp:5,esi:6,edi:7};
  const life=(i,off,n)=>n===undefined?dv.getUint32(0x2000+i*64+off,true):dv.setUint32(0x2000+i*64+off,n,true);
  function map(b, base) {
    const p=b.readUInt32LE(0x3c), count=b.readUInt16LE(p+6), opt=b.readUInt16LE(p+20), preferred=b.readUInt32LE(p+52);
    bytes.set(b.subarray(0,b.readUInt32LE(p+84)),wa(base));
    for(let i=0;i<count;i++) {
      const s=p+24+opt+i*40,raw=b.readUInt32LE(s+20),size=b.readUInt32LE(s+16),rva=b.readUInt32LE(s+12);
      bytes.set(b.subarray(raw,raw+size),wa(base+rva));
    }
    const reloc=b.readUInt32LE(p+160),relocSize=b.readUInt32LE(p+164);
    for(let at=reloc;reloc&&at<reloc+relocSize;) {
      const page=u32(base+at),n=u32(base+at+4);assert(n>=8);
      for(let off=8;off<n;off+=2) {
        const item=dv.getUint16(wa(base+at+off),true),type=item>>>12;
        if(type===3) {const a=base+page+(item&4095);put(a,u32(a)+base-preferred);}
        else assert.equal(type,0,'only HIGHLOW/ABSOLUTE expected');
      }
      at+=n;
    }
    return {entry:base+b.readUInt32LE(p+40),expRva:b.readUInt32LE(p+120)};
  }
  map(files.exe,0x400000);
  const bases=[0x522000,0x580000,0x7a2000];
  const exported={...real.exports,memory,get_image_base:()=>0x400000,
    get_staging:()=>0x600000,get_staging_size:()=>0x100000,
    get_dll_count:()=>rows.length,get_dll_table:()=>0x1000,get_num_thunks:()=>0,
    get_dll_lifecycle_table:()=>0x2000,get_dll_lifecycle_stride:()=>64,
    get_dll_index:base=>rows.findIndex(r=>r.base===base),get_current_thread_id:()=>1,
    next_dll_unload_token_locked:()=>1,
    complete_dll_initialize:(i,g,status)=>{assert.equal(life(i,4),g);life(i,0,status?2:4);life(i,48,status===1?1:0);},
    get_next_dll_addr:()=>bases[rows.length],
    get_dll_callback_lock:()=>0x800,get_dll_callback_owner:()=>1,
    get_eip:()=>eip,set_eip:n=>eip=n,get_esp:()=>esp,set_esp:n=>esp=n,get_fs_base:()=>0,
    get_yield_reason:()=>yieldReason,get_yield_flag:()=>0,clear_yield:()=>yieldReason=0,
    set_yield_state:n=>yieldReason=n,
    load_dll:(length,base)=>{
      events.push('map:'+base.toString(16));if(fail==='mapping')throw Error('fixture:mapping');
      const b=Buffer.from(bytes.subarray(0x600000,0x600000+length));
      const mapped=map(b,base),index=rows.length;
      dv.setUint32(0x1000+index*32,base,true);dv.setUint32(0x1000+index*32+8,mapped.expRva,true);
      rows.push({base,...mapped});life(index,0,1);life(index,4,1);life(index,12,1);life(index,24,mapped.entry);
      return mapped.entry;
    },
    patch_caller_iat:(caller,imports,dllName,index)=>{
      const target=rows[index],dir=target.base+target.expRva,fn=u32(dir+28),nm=u32(dir+32),ord=u32(dir+36);
      let desc=caller+imports;
      while(u32(desc)||u32(desc+12)) {
        if(str(caller+u32(desc+12)).toLowerCase()===str(dllName).toLowerCase()) {
          for(let i=0;;i++) {
            const item=u32(caller+(u32(desc)||u32(desc+16))+i*4);if(!item)break;
            let slot;
            if(item>>>31)slot=(item&65535)-u32(dir+16);
            else {
              const name=str(caller+item+2);
              for(let j=0;j<u32(dir+24);j++)if(str(target.base+u32(target.base+nm+j*4))===name){slot=dv.getUint16(wa(target.base+ord+j*2),true);break;}
              if(slot===undefined)throw Error('fixture unresolved export:'+name);
            }
            put(caller+u32(desc+16)+i*4,target.base+u32(target.base+fn+slot*4));
          }
        }
        desc+=20;
      }
    },
    seal_thunks:()=>events.push('seal'),
    run:()=>{
      assert(isArmed(),'guest execution before arm');events.push('dll-run:'+eip.toString(16));
      if(fail==='initializer')throw Error('fixture:initializer');
      if(fail==='async-lookup'||fail==='sync-lookup') {yieldReason=5;return;}
      esp+=16;eip=0;regs.eax=1;
    },
  };
  for(const name of Object.keys(regs)) {exported['get_'+name]=()=>regs[name];exported['set_'+name]=v=>regs[name]=v;}
  // No guest_alloc: the real loader's optional CARDS/msvcrt global helpers are
  // covered separately with an explicit seam; startup initializer code is real.
  exported.guest_alloc=undefined;
  names.set('msvcrt',{loadAddr:bases[0]});
  return {exports:exported,memory,wa,map,rows,get eip(){return eip;},get esp(){return esp;},
    callbackWords:new Int32Array(memory.buffer,0x800,2),memUtils:{guestToWasm:wa},
    dependencies:()=>rows.map(r=>r.base)};
}
module.exports={host};
