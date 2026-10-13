// Served diagnostic only. Enable counters between guest slices, never on the
// idle page WASM instance. Counts describe entries, not CPU-time shares.
globalThis.__gameGuestCensus = action => {
  if (globalThis.__gameCensusSlot !== 0 || !instance) return null;
  const e=instance.exports;
  const counters=()=>({runtime:Array.from({length:21},(_,i)=>e.uop_stats(i)>>>0),
    compiler:Array.from({length:31},(_,i)=>e.uop_cstat(i)>>>0),
    declines:Array.from({length:28},(_,i)=>e.uop_decline_count(i)>>>0)});
  if(action==='arm') {
    e.reset_handler_hist(); e.set_handler_hist_enabled(1);
    return {at:performance.timeOrigin+performance.now(),uop:counters()};
  }
  if(action!=='read')return null;
  e.set_handler_hist_enabled(0);
  const m=new Uint32Array(memory.buffer),handlers=[],blocks=[];
  const hb=e.get_handler_hist_base()>>>2,bb=e.get_hot_block_hist_base()>>>2;
  for(let i=0;i<e.get_handler_hist_slots();i++)if(m[hb+i])handlers.push([i,m[hb+i]]);
  for(let i=0;i<e.get_hot_block_hist_count();i++)if(m[bb+i*2])blocks.push([m[bb+i*2],m[bb+i*2+1]]);
  handlers.sort((a,b)=>b[1]-a[1]);blocks.sort((a,b)=>b[1]-a[1]);
  const length=globalThis.__gameUopRecords.length;
  e.uop_census_dump();
  const census=globalThis.__gameUopRecords.slice();globalThis.__gameUopRecords.length=length;
  return {at:performance.timeOrigin+performance.now(),handlers,blocks,uop:counters(),census,
    collisions:e.get_hot_block_hist_collisions()>>>0};
};
