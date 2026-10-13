// Control-channel probe: what does ONE GAME FRAME cost, right now?
//
//   node tools/ctl.js -s :PORT eval 'exports.reset_handler_hist(); exports.set_handler_hist_enabled(1); 1'
//   ...let the window elapse (step N)...
//   node tools/ctl.js -s :PORT eval "$(cat tools/ctl-probes/read-frame-cost.js)"
//
// read-handler-hist.js beside this one returns the top 40 blocks, which is the
// wrong shape for this question: the block that counts a game frame is entered
// once per frame and is nowhere near the top of a histogram whose leaders are
// inner blit loops running millions of times. So this scans the whole table for
// specific addresses instead of ranking it.
//
// The addresses are StarCraft's (docs/re-notes/starcraft-shareware.md):
//   0x004411e7  verifier -- the usable game-frame counter
//   0x004411db  boundary -- NOT a basic-block entry, reads 0 even in gameplay
//   0x004cbaf0  display flush
// Override by assigning `frameTargets` before eval-ing if another app needs it.
//
// Reading DISABLES the histogram, same contract as the sibling probe, so one
// window is one arm/read pair.
(function () {
  var e = exports;
  var m = new Uint32Array(memory.buffer);
  var targets = (typeof frameTargets !== 'undefined' && frameTargets) ||
    [0x004411e7, 0x004411db, 0x004cbaf0];
  var bb = e.get_hot_block_hist_base() >>> 2;
  var bc = e.get_hot_block_hist_count() | 0;
  var tot = 0, distinct = 0, found = {}, top = [];
  for (var j = 0; j < bc; j++) {
    var ad = m[bb + j * 2] >>> 0, hh = m[bb + j * 2 + 1] >>> 0;
    if (!ad || !hh) continue;
    tot += hh; distinct++;
    for (var k = 0; k < targets.length; k++) {
      if (ad === targets[k]) found[targets[k].toString(16)] = hh;
    }
    top.push([ad.toString(16), hh]);
  }
  top.sort(function (a, b) { return b[1] - a[1]; });
  var frames = found[(targets[0] >>> 0).toString(16)] || 0;
  e.set_handler_hist_enabled(0);
  return JSON.stringify({
    blockHits: tot,
    distinct: distinct,
    frames: frames,
    // The number this probe exists for. null, not 0, when no frame advanced --
    // a zero here means "not in gameplay", which must not divide.
    blocksPerFrame: frames > 0 ? Math.round(tot / frames) : null,
    found: found,
    top: top.slice(0, 12),
  });
})()
