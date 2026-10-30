'use strict';
// Task-only observation. Forward each original call once, preserving receiver,
// arguments, result and exceptions. No guest writes or synthetic callbacks.
const fs = require('fs'), Module = require('module'), path = require('path');
const out = path.join(__dirname, 'boundary-trace.json');
const counts = Object.create(null), first = [], tail = [];
let seq = 0, manager;
function record(kind, value) {
  const n = counts[kind] = (counts[kind] || 0) + 1;
  const row = {seq: ++seq, kind, ...value};
  if (n <= 12 && first.length < 240) first.push(row);
  tail.push(row); if (tail.length > 96) tail.shift();
}
function regs(e) {
  return Object.fromEntries(['get_eip','get_dbg_prev_eip','get_esp','get_yield_reason',
    'get_wait_handle','get_current_thread_id','get_api_calls','is_mm_timer_callback_active']
    .filter(k => typeof e[k] === 'function').map(k => [k, e[k]() >>> 0]));
}
function state(m, handle) {
  const i = m._getSyncIdx(handle);
  return {sync:i < 0 ? null : Array.from(m.syncView.slice(i*4,i*4+4)),
    running:m.currentWin32ThreadId(), main:regs(m.mainInstance.exports),
    threads:Array.from(m.threads, ([h,t]) => ({handle:h,tid:t.tid,state:t.state,
      regs:t.instance ? regs(t.instance.exports) : null}))};
}
globalThis.__audioBoundary = (kind, value) => record(kind, value);
globalThis.__audioBoundarySnapshot = () => ({seq,counts:{...counts},
  last:manager ? state(manager,manager.mainInstance.exports.get_wait_handle()) : null});
const compile = Module.prototype._compile;
Module.prototype._compile = function(source, filename) {
  if (filename.endsWith('/lib/host-audio.js')) {
    const a = 'dv.setUint32(waveHdrWA + 16, (flags | 1) & ~0x10, true);';
    const b = 'const submission=_trackWaveOutHeader(handle, waveHdrWA, waveHdrGA);';
    for (const marker of [a,b]) if (source.split(marker).length !== 2) throw Error('audio marker identity');
    source = source.replace(a,a+"globalThis.__audioBoundary('wave-done',{handle,waveHdrWA,waveHdrGA,before:flags,after:dv.getUint32(waveHdrWA+16,true),registration:live.registration && {type:live.registration.type,callback:live.registration.callback},serial:live.serial});")
      .replace(b,b+"globalThis.__audioBoundary('wave-submit',{handle,waveHdrWA,waveHdrGA,byteLength,serial:submission && submission.serial});");
    record('transform',{filename,markers:2});
  }
  return compile.call(this,source,filename);
};
const {ThreadManager} = require(path.resolve(process.cwd(),'lib/thread-manager.js'));
for (const name of ['waitSingle','releaseMutex']) {
  const original = ThreadManager.prototype[name];
  if (typeof original !== 'function') throw Error('missing '+name);
  ThreadManager.prototype[name] = function(...args) {
    manager=this;
    const i=this._getSyncIdx(args[0]);
    if (i < 0 || this.syncView[i*4+1] !== 3) return original.apply(this,args);
    const before=state(this,args[0]);
    const result=original.apply(this,args);
    const after=state(this,args[0]);
    record(name+':'+args[0]+':'+(args[2] || (name==='releaseMutex' ? args[1] : 1))+':'+result,
      {handle:args[0],args,before,after,result});
    return result;
  };
}
const runSlice=ThreadManager.prototype.runSlice;
ThreadManager.prototype.runSlice=function(...args) {
  const result=runSlice.apply(this,args);
  record('slice',{steps:result.steps,blocks:result.blocks,threadsRun:result.threadsRun});
  return result;
};
process.on('exit',()=>fs.writeFileSync(out,JSON.stringify({schema:1,observationOnly:true,
  seq,counts,first,tail,last:manager ? state(manager,manager.mainInstance.exports.get_wait_handle()) : null})+'\n'));
