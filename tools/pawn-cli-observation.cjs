'use strict';
// Bounded normal interpreter sampling. No protected export/opcode policy changes.
// Ownership is supplied only by the CLI lease; lifetime/raw-store proof is OPEN.
function observeNative(e, memory, owned, options = {}) {
  const {ranges, maxSteps = 32, maxMs = 100, maxRecords = 64} = options;
  if (!Array.isArray(ranges) || !ranges.length || ranges.length > 2 || ranges.some(r =>
    !Number.isInteger(r.lo) || !Number.isInteger(r.hi) || r.lo <= 0 ||
    r.hi <= r.lo || r.hi > 0xffffffff || r.hi-r.lo > 4096)) throw Error('bounded ranges required');
  if (!Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > 10000 ||
      !Number.isInteger(maxMs) || maxMs < 1 || maxMs > 1000 ||
      !Number.isInteger(maxRecords) || maxRecords < 1 || maxRecords > 256)
    throw Error('bounded observation limits required');
  if (!owned() || e.native_store_get(0)) throw Error('idle owned native observer required');
  const receipt = () => Array.from({length:21}, (_,i) => e.native_store_get(i) >>> 0);
  const bytes = () => ranges.map(r => Array.from({length:r.hi-r.lo}, (_,i) => e.guest_read8(r.lo+i)));
  const result = {status:'UNKNOWN', qualification:'allocation/pointer lifetimes and raw-store coverage UNKNOWN',
    records:[], steps:0, reason:'bounded-prefix', baseline:null};
  const initial = bytes(), thread = e.get_current_thread_id(), api = e.get_api_calls();
  const [a,b = {lo:0,hi:0}] = ranges;
  let armed = false, previous, values = initial;
  const start = performance.now();
  try {
    e.native_store_arm(a.lo,a.hi,b.lo,b.hi,2147483647); armed = true;
    previous = receipt();
    result.baseline = {receipt:previous, bytes:initial, pc:e.get_eip() >>> 0, thread};
    if (previous[0] !== 1 || !previous[2] || previous[3] || previous[7] || previous[15] ||
        ranges.some((r,i) => previous[5+i*8] !== r.lo || previous[6+i*8] !== r.hi)) {
      result.reason='invalid-baseline'; return result;
    }
    for (let n=0; n<maxSteps; n++) {
      if (!owned() || performance.now()-start >= maxMs) { result.reason='owner-or-time-bound'; break; }
      const pc = e.get_eip() >>> 0;
      e.run(1); result.steps++;
      const current = receipt(), after = bytes();
      if (!owned() || current[0] !== 1 || current[2] !== previous[2] || current[3] ||
          e.get_current_thread_id() !== thread || e.get_api_calls() !== api ||
          e.get_last_run_blocks() !== 1 || e.get_last_run_halt() === 5) {
        result.reason='invalid-host-or-instruction-scope'; break;
      }
      let failure = null;
      const records = [];
      for (let i=0; i<ranges.length; i++) {
        const k=7+i*8, delta=current[k]-previous[k], r=ranges[i];
        if (current[k+1] || current[k+5] || delta < 0 || delta > 1 ||
            current[5+i*8] !== r.lo || current[6+i*8] !== r.hi) failure='overflow-host-or-multiple-stores';
        if (!delta && JSON.stringify(after[i]) !== JSON.stringify(values[i])) failure='untracked-store';
        if (delta) {
          const [writer,address,width] = current.slice(k+2,k+5);
          if (writer !== pc || ![1,2,4,8].includes(width) || address >= r.hi || address+width <= r.lo)
            failure='writer-scope';
          records.push({step:result.steps,range:i,pc:writer,address,width,epoch:current[k],
            before:values[i],after:after[i],sameValue:JSON.stringify(values[i])===JSON.stringify(after[i])});
        }
      }
      if (failure || result.records.length+records.length > maxRecords) {
        result.reason=failure || 'record-bound'; break;
      }
      result.records.push(...records); previous=current; values=after;
    }
  } catch (error) { result.reason='refused-or-trapped'; result.error=String(error); }
  finally {
    if (armed) {
      result.final = receipt();
      if (result.final[2] === result.baseline?.receipt[2]) e.native_store_arm(0,0,0,0,0);
    }
  }
  return result;
}
module.exports = {observeNative};
