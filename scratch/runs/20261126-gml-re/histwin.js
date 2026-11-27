'use strict';
// tl;dr: --handler-hist / --hist-json for a window chosen at runtime in a
// --control session (the CLI flags only take fixed batch numbers):
//   ctl eval "process.mainModule.require('/abs/histwin.js').arm({instance})"
//   ... step ...
//   ctl eval "process.mainModule.require('/abs/histwin.js').dump({instance,memory},'OUT.json')"
// Writes the same shape as run.js --hist-json ({blocks:[[hex,hits]], blockHits,
// handlerOps, uop}) so blocks.js reads it. While a --count / --value-probe slot
// is armed the uop tier is off, so every block entry is in this histogram.
module.exports = {
  arm({ instance }) {
    const e = instance.exports;
    e.reset_handler_hist();
    this.uop0 = { blocks: e.uop_stats(5) >>> 0, enters: e.uop_stats(4) >>> 0 };
    e.set_handler_hist_enabled(1);
    return 'armed';
  },
  dump({ instance, memory }, out) {
    const e = instance.exports;
    e.set_handler_hist_enabled(0);
    const u32 = new Uint32Array(memory.buffer);
    const slots = e.get_handler_hist_slots ? (e.get_handler_hist_slots() | 0) : (e.get_handler_hist_count() | 0);
    const hb = (e.get_handler_hist_base() >>> 2) >>> 0;
    let handlerOps = 0;
    for (let i = 0; i < slots; i++) handlerOps += u32[hb + i] >>> 0;
    const base = (e.get_hot_block_hist_base() >>> 2) >>> 0;
    const n = e.get_hot_block_hist_count() | 0;
    const blocks = [];
    let blockHits = 0;
    for (let i = 0; i < n; i++) {
      const a = u32[base + i * 2] >>> 0, h = u32[base + i * 2 + 1] >>> 0;
      blockHits += h;
      if (a && h) blocks.push([a.toString(16), h]);
    }
    blocks.sort((a, b) => b[1] - a[1]);
    const uop = { blocks: ((e.uop_stats(5) >>> 0) - this.uop0.blocks) >>> 0, enters: ((e.uop_stats(4) >>> 0) - this.uop0.enters) >>> 0 };
    const collisions = e.get_hot_block_hist_collisions ? e.get_hot_block_hist_collisions() >>> 0 : 0;
    require('fs').writeFileSync(out, JSON.stringify({ source: 'histwin.js', blockHits, handlerOps, distinct: blocks.length, collisions, uop, blocks }));
    return { blockHits, handlerOps, distinct: blocks.length, collisions, uop };
  },
};
