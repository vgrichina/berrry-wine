'use strict';

// Run-local, exclusive interpreter controller. No guest writes or guest calls.
// The caller must pause every other executor/host writer for this instance.
// This is a scoped native-store journal, not an all-memory write barrier.
const {performance} = require('node:perf_hooks');
const sharedReceipts = new WeakMap();

function observe(e, {memory, ranges, exclusive, maxSteps = 10000, maxRecords = 256,
  maxMs = 1000, epochLimit = 2147483647, now = () => performance.now()} = {}) {
  if (!Array.isArray(ranges) || !ranges.length || ranges.length > 2 ||
      ranges.some(r => !Number.isInteger(r.lo) || !Number.isInteger(r.hi) ||
        r.lo <= 0 || r.hi <= r.lo || r.hi > 0xffffffff || r.hi-r.lo > 4096))
    throw Error('one or two bounded guest ranges required');
  if (![maxSteps,maxRecords,maxMs,epochLimit].every(n => Number.isSafeInteger(n) && n > 0))
    throw Error('positive finite bounds required');
  if (epochLimit > 2147483647) throw Error('epoch limit must fit the production counter');
  if (typeof exclusive !== 'function' || exclusive() !== true) throw Error('exclusive owner required');
  if (e.native_store_get(0)) throw Error('native observer already owned');
  const result = {status:'observing', baseline:null, records:[], steps:0,
    scope:'exclusive protected native interpreter; host/raw-memory writers excluded',
    firstWriters:ranges.map(() => null)};
  if (!(memory instanceof WebAssembly.Memory)) throw Error('owning memory required');
  let shared = sharedReceipts.get(e);
  if (shared === undefined) { shared=e.native_store_share(0); sharedReceipts.set(e,shared); }
  const view = new Int32Array(memory.buffer,shared,22);
  // native_store_get is deliberately default-denied in protected mode. Use
  // the production seqlock publication; no export policy relaxation needed.
  const raw = () => {
    for(let n=0;n<8;n++) {
      const before=Atomics.load(view,0)>>>0;
      if(before&1) continue;
      const data=Array.from({length:21},(_,i)=>Atomics.load(view,i+1)>>>0);
      if((Atomics.load(view,0)>>>0)===before) return data;
    }
    throw Error('unstable native receipt');
  };
  const bytes = () => ranges.map(r => Array.from({length:r.hi-r.lo},(_,i) => e.guest_read8(r.lo+i)));
  if (JSON.stringify(raw()) !== JSON.stringify(Array.from({length:21},(_,i)=>e.native_store_get(i)>>>0)))
    throw Error('memory does not publish the owning receipt');
  const baselineValues=bytes(); // Resolve all observed bytes before arming.
  const start = now(), thread = e.get_current_thread_id(), api = e.get_api_calls();
  const [a,b={lo:0,hi:0}] = ranges;
  e.native_store_arm(a.lo,a.hi,b.lo,b.hi,epochLimit);
  // Protected mode refuses unsupported services before their side effects and
  // splits REP elements. arm() itself already clears ordinary cached blocks.
  // The primitive also enables a value watch. Watch entry code, not the data
  // being journaled: changed data would otherwise insert a zero-work debug
  // stop whose attempted-block count is not proof of instruction execution.
  e.set_rep_store_step(e.get_eip());
  let previous = raw(), values = baselineValues, serial=Atomics.load(view,0)>>>0;
  let expectedPC = e.get_eip() >>> 0;
  result.baseline = {receipt:previous, bytes:values, serial, pc:e.get_eip() >>> 0, thread};
  function stop(reason = 'scope-ended') {
    if (result.status !== 'observing') return result;
    if (reason === 'scope-ended' && !continuous()) reason = 'unknown:scope-gap';
    result.status = reason;
    result.complete = reason === 'scope-ended';
    result.final = {receipt:raw(), bytes:bytes(), serial:Atomics.load(view,0)>>>0};
    e.set_rep_store_step(0);
    // Do not disarm a replacement observer owned by somebody else.
    if ((e.native_store_get(2) >>> 0) === previous[2]) e.native_store_arm(0,0,0,0,0);
    return result;
  }
  const unknown = reason => stop('unknown:' + reason);
  function continuous() {
    return exclusive() === true && e.get_current_thread_id() === thread && e.get_api_calls() === api &&
      (e.get_eip() >>> 0) === expectedPC && (Atomics.load(view,0)>>>0)===serial &&
      JSON.stringify(raw()) === JSON.stringify(previous) && JSON.stringify(bytes()) === JSON.stringify(values);
  }
  function valid(s) {
    return s[0] === 1 && s[2] === previous[2] && !s[3] &&
      ranges.every((r,i) => s[5+i*8] === r.lo && s[6+i*8] === r.hi);
  }
  function step() {
    if (result.status !== 'observing') return result;
    if (result.steps >= maxSteps || now()-start >= maxMs) return unknown('scope-bound');
    if (exclusive() !== true || e.get_current_thread_id() !== thread) return unknown('owner');
    const pre=raw();
    if (pre[3]) return unknown('invalid');
    if (pre[8] || pre[16] || (Atomics.load(view,0)>>>0)>=2147483644) return unknown('overflow');
    if (pre[12] || pre[20]) return unknown('host');
    if (!continuous()) return unknown('scope-gap');
    if (!valid(previous)) return unknown('invalid');
    const pc = e.get_eip() >>> 0;
    try { e.run(1); } catch (error) { result.error = String(error); return unknown('trap-or-unsupported'); }
    const current = raw(), after = bytes();
    result.steps++;
    if (e.get_last_run_halt() === 5) return unknown('debug-stop');
    if (!valid(current)) return unknown('invalid');
    if (e.get_api_calls() !== api || e.get_current_thread_id() !== thread || exclusive() !== true)
      return unknown('host-or-owner');
    if (e.get_last_run_blocks() !== 1) return unknown('instruction-scope');
    for (let i=0;i<ranges.length;i++) {
      const k = 7+i*8, delta = current[k]-previous[k];
      if (current[k+1]) return unknown('overflow');
      if (current[k+5]) return unknown('host');
      if (delta < 0 || delta > 1) return unknown('multiplewrites');
      if (!delta && JSON.stringify(after[i]) !== JSON.stringify(values[i])) return unknown('untracked-write');
      if (delta) {
        const [writer,address,width] = current.slice(k+2,k+5), r=ranges[i];
        if (!writer || writer !== pc || ![1,2,4,8].includes(width) || address >= r.hi || address+width <= r.lo)
          return unknown('writer');
        if (result.records.length >= maxRecords) return unknown('record-bound');
        const record = {step:result.steps,range:i,epoch:current[k],delta,pc:writer,address,width,
          before:values[i],after:after[i],sameValue:JSON.stringify(values[i]) === JSON.stringify(after[i])};
        result.records.push(record);
        if (!result.firstWriters[i]) result.firstWriters[i] = record;
      }
    }
    previous=current; values=after; serial=Atomics.load(view,0)>>>0; expectedPC=e.get_eip() >>> 0;
    return result;
  }
  if (!valid(previous) || previous[7] || previous[15]) unknown('baseline');
  return {result,step,stop};
}
module.exports = {observe};
