'use strict';
// tl;dr: probe sets for the GML window, armed from a ctl eval:
//   process.mainModule.require('/abs/probes.js').arm('A', {instance})
//   process.mainModule.require('/abs/probes.js').counts({instance}, 'OUT.json')
// Set A: per-node eval/statement counts, code objects, depth, result tags,
//   var-list lookups, script calls + plain counters (RTTI, var-scan
//   iterations, GM steps, collision, instance lookups).
// Set B: return-address histograms of the shared helpers, to split their cost
//   between the GML interpreter and the rest of the runner.
const SETS = {
  A: {
    probes: [
      '0x52786c@edx', '0x5288ac@edx', '0x528b3c@ecx', '0x528b3c@esp>>4',
      '0x5278dd@[edi]', '0x4a8a30@eax|edx', '0x5278d0@[edi]',
    ],
    plain: {
      0x4a8a4c: 'var-list scan iteration', 0x40674c: '_CopyRecord', 0x4064e8: '_FinalizeRecord',
      0x406448: '_InitializeArray', 0x406534: '_FinalizeArray', 0x53e53c: 'GM step+draw',
      0x4aceec: 'collision bbox test', 0x526fc0: 'call node eval', 0x4aee7c: 'nth instance',
    },
  },
  B: {
    probes: [
      '0x40674c@[esp]', '0x4064e8@[esp]', '0x406448@[esp]', '0x406534@[esp]', '0x406418@[esp]',
      '0x4a8a30@[esp]', '0x4aee7c@[esp]', '0x4aceec@[esp]', '0x4a88d4@[esp]', '0x403498@[esp]',
      '0x528b3c@[esp]', '0x405988@[esp]', '0x405934@[esp]',
    ],
    plain: { 0x53e53c: 'GM step+draw', 0x52786c: 'eval', 0x5288ac: 'statement' },
  },
};
let armedPlain = {};
module.exports = {
  arm(set, { instance }) {
    const s = SETS[set];
    const vp = globalThis.valueProbe;
    const r = vp.arm(s.probes);
    let slot = vp.firstSlot + s.probes.length;
    armedPlain = {};
    for (const [addr, name] of Object.entries(s.plain)) {
      instance.exports.set_count(slot, Number(addr));
      armedPlain[slot] = { addr: '0x' + Number(addr).toString(16), name };
      slot++;
    }
    return `${r} plain ${Object.keys(armedPlain).length}`;
  },
  counts({ instance }, out) {
    const res = {};
    for (const [slot, info] of Object.entries(armedPlain)) res[info.addr] = { name: info.name, hits: instance.exports.get_count(Number(slot)) >>> 0 };
    res.presents = instance.exports.d3d9_gps_stat(4);
    if (out) require('fs').writeFileSync(out, JSON.stringify(res, null, 1));
    return res;
  },
  disarm({ instance }) {
    globalThis.valueProbe.disarm();
    for (const slot of Object.keys(armedPlain)) instance.exports.set_count(Number(slot), 0);
    instance.exports.clear_counts();
    armedPlain = {};
    return 'disarmed';
  },
};
