'use strict';
const { FIELDS, NET_ANCHORS, NET_LAYOUT, SELECT_RETURN, DIAGNOSTIC_FIELDS, REJECTION_REASONS } = require('./maelstrom-native-errno-latch.cjs');
const owners = new WeakSet();
const SELECT_FIELDS = Object.freeze(['started','phase','token','entries','parks','completions','fault','capped','active','thread','regs','pre','post','ret','result']);
function scalars(e, prefix, fields, label) {
  return Object.fromEntries(fields.map(k => {
    const raw = e[prefix+k]();
    // Wasm i32 exports are signed; synthetic/JS snapshots may be unsigned.
    // Validate before converting either representation to the persisted u32.
    if (!Number.isInteger(raw) || raw < -0x80000000 || raw > 0xffffffff)
      throw Error('invalid native '+label+': '+k);
    return [k, raw >>> 0];
  }));
}
// Decode only immutable scalar rejection exports, never guest memory or errno.
function decodeRejection(native, diagnostic) {
  for (const k of FIELDS)
    if (!Number.isInteger(native[k]) || native[k] < 0 || native[k] > 0xffffffff)
      throw Error('invalid native rejection context: ' + k);
  for (const k of DIAGNOSTIC_FIELDS)
    if (!Number.isInteger(diagnostic[k]) || diagnostic[k] < 0 || diagnostic[k] > 0xffffffff)
      throw Error('invalid native rejection diagnostic: ' + k);
  const d = diagnostic, reason = d.rejectReason;
  if (reason === 0) {
    if (DIAGNOSTIC_FIELDS.some(k => d[k] !== 0)) throw Error('invalid native rejection diagnostic: nonzero without reason');
    return null; // Legacy/non-completion rejection, not errno/caller zero.
  }
  if (!Object.hasOwn(REJECTION_REASONS, reason) || native.status !== 5 || native.event !== 0 ||
      FIELDS.some(k => k !== 'status' && native[k] !== 0) || d.rejectModes > 7 || d.rejectExpectedRet !== SELECT_RETURN)
    throw Error('invalid native rejection diagnostic: context');
  const failures = [d.rejectModes & 1, d.rejectModes & 2, d.rejectModes & 4,
    d.rejectObservedRet !== d.rejectExpectedRet, d.rejectPhase !== 3, d.rejectCompletions !== 1,
    d.rejectFault !== 0, d.rejectActive !== 0, d.rejectCapped !== 0];
  if (failures.findIndex(Boolean) + 1 !== reason) throw Error('invalid native rejection diagnostic: precedence');
  return {schema:'maelstrom-native-completion-rejection/v1', reason, predicate:REJECTION_REASONS[reason],
    modeBits:d.rejectModes, expectedReturn:d.rejectExpectedRet, observedReturn:d.rejectObservedRet,
    phase:d.rejectPhase, completions:d.rejectCompletions, fault:d.rejectFault, active:d.rejectActive, capped:d.rejectCapped};
}
function verifyLoaded(e, buffer, bases) {
  if (bases.msvcrt?.loadAddr !== 0x522000 || bases.sdl_net?.loadAddr !== NET_LAYOUT.loadedBase)
    throw Error('incompatible original loaded bases: '+JSON.stringify(bases));
  if (e.get_image_base() !== 0x400000) throw Error('incompatible image base');
  const bytes = new Uint8Array(buffer), dv = new DataView(buffer);
  const at = va => va - 0x400000 + 0x12000;
  function check(va, hex) {
    const actual=Buffer.from(bytes.subarray(at(va),at(va)+hex.length/2)).toString('hex');
    if (actual !== hex)
      throw Error('incompatible authentic loaded bytes at '+va.toString(16)+' expected='+hex+' actual='+actual);
  }
  check(0x52e430, 'e82274ffff83c008c3');
  // The pinned DLL has IMAGE_REL_BASED_HIGHLOW at RVA 0x12f4. Its MOV
  // operand addresses the relocated IAT, not preferred-base 0x10002010.
  for (const [va, hex] of Object.entries(NET_ANCHORS))
    check(NET_LAYOUT.loadedBase+Number(va)-NET_LAYOUT.preferredBase,Number(va)===0x100012f2?'8b3d10407a00':hex);
  check(0x40e125,'e8c253000083c40885c0756e');
  if (dv.getUint32(at(0x7a4010),true)!==0x52e430) throw Error('original errno IAT mismatch');
  return {crtBase:0x522000,netBase:NET_LAYOUT.loadedBase,errnoEntry:0x52e430,selectReturn:SELECT_RETURN,authenticLoadedAnchors:true};
}
function createAdapter(instance, {persist, readLive}) {
  if (owners.has(instance)) throw Error('duplicate native latch owner');
  const e=instance.exports;
  for (const k of ['start',...FIELDS]) if(typeof e['mne_'+k]!=='function') throw Error('missing mne_'+k);
  for (const k of SELECT_FIELDS) if(typeof e['msc_'+k]!=='function') throw Error('missing msc_'+k);
  const hasDiagnostic=DIAGNOSTIC_FIELDS.some(k=>Object.hasOwn(e,'mne_'+k));
  if(hasDiagnostic)for(const k of DIAGNOSTIC_FIELDS)
    if(typeof e['mne_'+k]!=='function')throw Error('missing mne_'+k);
  owners.add(instance);let started=false,closed=false,last='';
  function snapshot() {
    try {
      const native=scalars(e,'mne_',FIELDS,'scalar');
      const rejection=hasDiagnostic ? decodeRejection(native,scalars(e,'mne_',DIAGNOSTIC_FIELDS,'rejection diagnostic')) : null;
      const msc=scalars(e,'msc_',SELECT_FIELDS,'select scalar');
      return {native,rejection,msc};
    } catch(error){closed=true;throw error;}
  }
  function record(kind,batch,{native,rejection,msc}) {
    const row={schema:'maelstrom-original-native-errno/v1',kind,batch,historicalNativeLatch:native,historicalSelectLatch:msc,liveHostObservation:readLive()};
    if(hasDiagnostic)row.historicalNativeRejection=rejection;
    persist(row);return row;
  }
  return {
    start(){
      if(started||closed)throw Error('one invocation only');started=true;
      const initial=snapshot();
      if(FIELDS.some(k=>initial.native[k]!==0)||initial.rejection!==null)throw Error('nonpristine native latch');
      e.mne_start();const row=record('started',null,snapshot());
      if(row.historicalNativeLatch.status!==1){closed=true;throw Error('native latch start rejected');}
    },
    observe(batch){
      if(!started)throw Error('start required');if(closed)return null;
      const captured=snapshot(),s=captured.native; // Validate even when captured fields have not changed.
      const key=JSON.stringify(s);if(key===last)return null;last=key;
      const row=record(s.status===4?'captured':s.status===5?'rejected':'pending',batch,captured);
      if(s.status===5){closed=true;throw Error('native latch status rejection');}
      if(s.status===4)closed=true;return row;
    }
  };
}
module.exports={verifyLoaded,createAdapter,decodeRejection};
