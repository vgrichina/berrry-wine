'use strict';
const { FIELDS, NET_ANCHORS } = require('./maelstrom-native-errno-latch.cjs');
const owners = new WeakSet();
function verifyLoaded(e, buffer, bases) {
  if (bases.msvcrt?.loadAddr !== 0x522000 || bases.sdl_net?.loadAddr !== 0x7a2000)
    throw Error('incompatible original loaded bases: '+JSON.stringify(bases));
  if (e.get_image_base() !== 0x400000) throw Error('incompatible image base');
  const bytes = new Uint8Array(buffer), dv = new DataView(buffer);
  const at = va => va - 0x400000 + 0x12000;
  function check(va, hex) {
    if (Buffer.from(bytes.subarray(at(va),at(va)+hex.length/2)).toString('hex') !== hex)
      throw Error('incompatible authentic loaded bytes at '+va.toString(16));
  }
  check(0x52e430, 'e82274ffff83c008c3');
  for (const [va, hex] of Object.entries(NET_ANCHORS)) check(0x7a2000+Number(va)-0x10000000,hex);
  check(0x40e125,'e8c253000083c40885c0756e');
  if (dv.getUint32(at(0x7a4010),true)!==0x52e430) throw Error('original errno IAT mismatch');
  return {crtBase:0x522000,netBase:0x7a2000,errnoEntry:0x52e430,authenticLoadedAnchors:true};
}
function createAdapter(instance, {persist, readLive}) {
  if (owners.has(instance)) throw Error('duplicate native latch owner');
  const e=instance.exports;
  for (const k of ['start',...FIELDS]) if(typeof e['mne_'+k]!=='function') throw Error('missing mne_'+k);
  owners.add(instance);let started=false,closed=false,last='';
  const snap=()=>Object.fromEntries(FIELDS.map(k=>[k,e['mne_'+k]()>>>0]));
  function record(kind,batch) {
    const native=snap();
    const msc=Object.fromEntries(['started','phase','token','entries','parks','completions','fault','capped','active','thread','regs','pre','post','ret','result'].map(k=>[k,e['msc_'+k]()>>>0]));
    const row={schema:'maelstrom-original-native-errno/v1',kind,batch,historicalNativeLatch:native,historicalSelectLatch:msc,liveHostObservation:readLive()};
    persist(row);return row;
  }
  return {
    start(){
      if(started||closed)throw Error('one invocation only');started=true;
      if(FIELDS.some(k=>snap()[k]!==0))throw Error('nonpristine native latch');
      e.mne_start();const row=record('started',null);
      if(row.historicalNativeLatch.status!==1){closed=true;throw Error('native latch start rejected');}
    },
    observe(batch){
      if(!started)throw Error('start required');if(closed)return null;
      const s=snap(),key=JSON.stringify(s);if(key===last)return null;last=key;
      const row=record(s.status===4?'captured':s.status===5?'rejected':'pending',batch);
      if(s.status===5){closed=true;throw Error('native latch status rejection');}
      if(s.status===4)closed=true;return row;
    }
  };
}
module.exports={verifyLoaded,createAdapter};
