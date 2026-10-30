'use strict';
// Serialized into the retained controlEval; never closes over module bindings.
function sample() {
  const unavailable = reason => ({status:'unavailable', reason});
  const scalar = value => Number.isFinite(value) ? {status:'supported',value} : unavailable('non-finite/non-number');
  const getters = ['get_eip','get_dbg_prev_eip','get_dbg_prev2_eip','get_esp',
    'get_current_thread_id','get_yield_reason','get_wait_handle','get_api_calls',
    'get_last_run_blocks','get_block_budget'];
  if (typeof exports !== 'object' || typeof instance !== 'object' ||
      exports !== instance.exports || typeof tickState !== 'object' ||
      typeof g2w !== 'function' || typeof memory !== 'object')
    return {schema:1,status:'adapter-error',reason:'control-eval binding mismatch'};
  const values = {};
  for (const name of getters) {
    if (typeof exports[name] !== 'function') { values[name]=unavailable('export absent'); continue; }
    try {values[name]=scalar(exports[name]());}
    catch (_) {values[name]=unavailable('getter threw');}
  }
  // Validate every translated byte BEFORE constructing a view. No guest_read32:
  // invalid pages must not become believable zero/sentinel-backed stack words.
  function read(address, length) {
    if (!Number.isSafeInteger(address) || address<0 || address>0xffffffff ||
        !Number.isSafeInteger(length) || length<1 || length>32 || address+length>0x100000000)
      return unavailable('invalid guest range');
    try {
      const buffer=memory.buffer;
      let start;
      for(let i=0;i<length;i++) {
        const offset=g2w(address+i);
        if (!Number.isSafeInteger(offset) || offset<0x100 || offset>=buffer.byteLength ||
            (i>0 && offset!==start+i)) return unavailable('invalid/unmapped/noncontiguous translation');
        if(i===0) start=offset;
      }
      return {status:'supported',address,length,bytes:Array.from(new Uint8Array(buffer,start,length))};
    } catch (_) {return unavailable('translation/read threw');}
  }
  const reg = name => values[name].status==='supported' ? values[name].value>>>0 : NaN;
  const clock={};
  for(const key of ['batch','callsInBatch','lastTick','pausedMs'])
    clock[key]=scalar(tickState[key]);
  const q=typeof renderer==='object' && renderer && renderer.inputQueue;
  const queue=Array.isArray(q) ? {status:'supported',length:q.length} : unavailable('renderer.inputQueue absent');
  const modules=[];
  if(typeof mods==='object' && mods && !(mods instanceof Map)) {
    for(const name of Object.keys(mods).slice(0,32)) {
      const m=mods[name];
      modules.push({name:name.slice(0,128),loadAddr:scalar(m && m.loadAddr),origBase:scalar(m && m.origBase)});
    }
  }
  return {schema:1,status:'sampled',scope:'main instance at control dispatch; not atomic across worker threads',
    values,clock,queue,ip:read(reg('get_eip'),24),stack:read(reg('get_esp'),32),modules,
    unavailable:{pollCount:'inputConsumptionTrace is outside controlEval lexical scope',
      producer:'threadManager/guestThreadHost are outside controlEval lexical scope',
      scheduler:'main wait and runnable-thread state are outside controlEval lexical scope',
      guestClock:'guestClock/batchClock methods are outside controlEval lexical scope',
      lastApi:'lastApiName is outside controlEval lexical scope',
      input:'scheduledInput/inputEvent/crossThreadMsgs/inputQueue are outside controlEval lexical scope'},
    conclusion:'observation only; repeated PCs do not prove busy loop, wait, or scheduler starvation'};
}
function compare(a,b,polls) {
  if(a.status!=='sampled'||b.status!=='sampled')return {status:'adapter-error'};
  const x=a.clock.batch,y=b.clock.batch;
  if(x.status!=='supported'||y.status!=='supported')return {status:'unavailable'};
  const advancing=y.value>x.value;
  const flat=Array.isArray(polls)&&polls.length===2&&polls.every(Number.isSafeInteger)&&polls[0]>=0&&polls[1]===polls[0];
  return {status:'compared',batchAdvancing:advancing,externalPollFlat:flat,
    pollSource:polls?'external trace, not eval binding':'unavailable',
    observation:advancing&&flat?'batches advance while external poll counter is flat':'no established flat-poll progression'};
}
module.exports={code:'('+sample.toString()+')()',compare};
