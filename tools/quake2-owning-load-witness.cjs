'use strict';
// Node-only synchronous owning-CPU observation. This deliberately issues no
// continuity/source-at-later-use certificate: log_block has no reset barrier.
const fs = require('node:fs');
const crypto = require('node:crypto');
const {readPE} = require('../lib/pe');
const path = require('node:path');
const EXE = 'test/binaries/candidates/quake-2-demo-installer/installed-extracted/Install/Data/quake2.exe';
const EXE_SHA = '2fa987c9390663e230c5b6479285e7c55511e35f80091bfed96f43062c1c810b';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const WINDOWS = [[0x4117b0,0x2e2],[0x410e50,0x11a],[0x411aa0,0x51],
  [0x42b0b9,0x6f],[0x42f0b0,0x45],[0x41a2a0,0x53]];
function attach({getExports, getMemory}) {
  const file = fs.readFileSync(path.resolve(__dirname,'..',EXE));
  if (hash(file) !== EXE_SHA) throw Error('Quake II installed EXE PATHHASH');
  const pe = readPE(file);
  const pins = WINDOWS.map(([pc,size]) => ({pc,size,sha256:hash(file.subarray(pe.va2off(pc),pe.va2off(pc)+size))}));
  let owner, buffer, invalid, calls=0, elapsedNs=0n;
  const records=[];
  function block(pc, sp) {
    const started=process.hrtime.bigint();
    try {
      if (invalid) return;
      const e=getExports(), b=getMemory();
      if (!e || !b) throw Error('missing owning instance/memory');
      if (owner && (owner!==e || buffer!==b)) throw Error('owning instance/memory replaced');
      owner=e;buffer=b;
      if ((e.get_image_base()>>>0)!==0x400000) throw Error('different module base');
      if ((e.get_eip()>>>0)!==(pc>>>0) || (e.get_esp()>>>0)!==(sp>>>0)) throw Error('not owning CPU block entry');
      if (++calls>10000000) throw Error('bounded callback count exhausted');
      if (![0x4117b0,0x4118d9,0x411a0e,0x42f0b0,0x42f0da].includes(pc>>>0)) return;
      if (records.length===32) throw Error('bounded observation exhausted');
      const read=(a,n)=>{
        if (!Number.isInteger(n)||n<0||n>4194304||a+n>0x100000000) throw Error('bounded source/range');
        const w=e.guest_to_wasm(a>>>0)>>>0;
        if (w===0xf0||w+n>b.byteLength) throw Error('unmapped memory');
        // Verify every page, including sparse/non-affine translations.
        for(let off=0;off<n;off=Math.min(n,Math.floor((a+off)/4096)*4096+4096-a)) {
          if ((e.guest_to_wasm((a+off)>>>0)>>>0)!==w+off) throw Error('noncontiguous/unmapped memory');
        }
        if(n && (e.guest_to_wasm((a+n-1)>>>0)>>>0)!==w+n-1) throw Error('unmapped range end');
        return Buffer.from(new Uint8Array(b,w,n));
      };
      const u32=a=>read(a,4).readUInt32LE();
      for(const p of pins) if(hash(read(p.pc,p.size))!==p.sha256) throw Error('native body replaced/missing');
      const record={pc:pc>>>0,sp:sp>>>0,kind:'LOAD_ENTRY',exactIdentity:'UNKNOWN'};
      if ((pc>>>0)===0x4118d9) {
        const length=e.get_esi()>>>0, pointer=u32((sp>>>0)+12);
        const bytes=read(pointer,length);
        if(length<160) throw Error('invalid BSP source length');
        Object.assign(record,{kind:'ACQUIRED_SOURCE',pointer,length,sha256:hash(bytes)});
      } else if ((pc>>>0)===0x411a0e) {
        Object.assign(record,{kind:'POST_FREE_BLOCK'});
      } else if ((pc>>>0)===0x42f0da) {
        const pointer=e.get_esi()>>>0;
        Object.assign(record,{kind:'HEADNODE_READ_BLOCK',pointer,candidateHeadnode:u32(pointer+36)});
      } else if ((pc>>>0)===0x42f0b0) {
        const edict=u32((sp>>>0)+4),solid=u32(edict+0xf8),index=u32(edict+0x28);
        if(index>=256) throw Error('table index bound');
        const pointer=solid===3?u32(0x47b554+4*index):0;
        Object.assign(record,{kind:'HEADNODE_USE_ENTRY',edict,solid,index,pointer,
          candidateHeadnode:pointer?u32(pointer+36):null});
      }
      records.push(record);
    } catch(error) { invalid=error.message; }
    finally { elapsedNs+=process.hrtime.bigint()-started; }
  }
  return Object.freeze({block,snapshot:()=>({exactIdentity:'UNKNOWN',
    reason:invalid||'no reset/reload/instruction coverage barrier; records are point observations only',
    validPointObservations:!invalid,calls,elapsedNs:elapsedNs.toString(),
    pins:pins.map(p=>({...p})),exe:{path:EXE,sha256:EXE_SHA},records:records.map(r=>({...r}))})});
}
module.exports={attach,hash,EXE,EXE_SHA};
