'use strict';
// tl;dr: run INSIDE a test/run.js --control --value-probe session, through
//   ctl eval "process.mainModule.require('/abs/gml-dump.js')({memory,g2w,instance},'OUT.json')"
// After a probe window it reads, from live guest memory, every GM8 code-tree
// node the value probes saw (eval 0x52786c@edx, statement 0x5288ac@edx) and
// their whole subtrees, the code objects (0x528b3c@ecx), the builtin function
// / builtin variable / user variable names the nodes reference, and writes
// { probes: valueProbe.report(), nodes, codes, names } as one JSON file.
//
// Layouts (docs/re-notes/spelunky-classic.md, "GML interpreter"):
//   node 0x38 bytes: +0 kind, +4 id, +8 owner, +0x10 value (24 B: +0 tag
//     0=real 1=string, +8 f64, +0x10 LStr), +0x28 child count,
//     +0x2c -> [ -> child array, 0x38-byte nodes inline ], +0x30 source pos
//   builtin function i: [[0x58fbe8]] + i*80, ShortString name at +0,
//     handler +0x44; builtin variable i: 0x6c8dd8 + i*80, ShortString name;
//   user variable id >= 100000: LStr [[0x58f134] + (id-100000)*4].
module.exports = function gmlDump({ memory, g2w }, out) {
  const fs = require('fs');
  const dv = new DataView(memory.buffer);
  const u32 = a => { try { return dv.getUint32(g2w(a >>> 0), true) >>> 0; } catch (_) { return null; } };
  const f64 = a => { try { return dv.getFloat64(g2w(a >>> 0), true); } catch (_) { return null; } };
  const u8 = a => { try { return dv.getUint8(g2w(a >>> 0)); } catch (_) { return null; } };
  const lstr = p => {
    if (!p) return '';
    const n = u32(p - 4);
    if (n === null || n > 4096) return null;
    let s = '';
    for (let i = 0; i < n; i++) s += String.fromCharCode(u8(p + i));
    return s;
  };
  const sstr = a => {
    const n = u8(a);
    if (n === null || n > 63) return null;
    let s = '';
    for (let i = 0; i < n; i++) s += String.fromCharCode(u8(a + 1 + i));
    return s;
  };
  const vp = globalThis.valueProbe;
  const report = vp.report();
  const nodes = {};
  const readNode = (p, depth) => {
    const key = p.toString(16);
    if (nodes[key] || depth > 64) return;
    const kind = u32(p);
    const n = { kind: kind | 0, id: u32(p + 4) | 0, owner: u32(p + 8) | 0, argc: u32(p + 0x28) | 0, pos: u32(p + 0x30) | 0 };
    if (kind === 5) {
      n.tag = u32(p + 0x10);
      n.num = f64(p + 0x18);
      if (n.tag === 1) n.str = lstr(u32(p + 0x20));
    }
    const holder = u32(p + 0x2c);
    const arr = holder ? u32(holder) : 0;
    n.children = [];
    if (arr && n.argc > 0 && n.argc < 4096) {
      for (let i = 0; i < n.argc; i++) n.children.push((arr + i * 0x38).toString(16));
    }
    nodes[key] = n;
    for (const c of n.children) readNode(parseInt(c, 16), depth + 1);
  };
  for (const pr of report.probes) {
    if (pr.addr !== '0x52786c' && pr.addr !== '0x5288ac') continue;
    if (!/^edx$/.test(pr.spec.split('@')[1])) continue;
    for (const k of Object.keys(pr.hist)) readNode(parseInt(k, 16), 0);
  }
  const codes = {};
  for (const pr of report.probes) {
    if (pr.addr !== '0x528b3c') continue;
    for (const k of Object.keys(pr.hist)) {
      const c = parseInt(k, 16);
      codes[k] = { kind: u32(c + 4), compiled: u8(c + 8), root: (c + 0x10).toString(16) };
      readNode(c + 0x10, 0);
    }
  }
  const names = { fn: {}, bvar: {}, uvar: {} };
  const fnTable = u32(u32(0x58fbe8));
  const uvars = u32(0x58f134);
  for (const n of Object.values(nodes)) {
    if (n.kind === 6 && n.id < 100000 && fnTable && !(n.id in names.fn)) {
      names.fn[n.id] = sstr(fnTable + n.id * 80);
    }
    if ((n.kind === 7 || n.kind === 8) && n.id >= 0) {
      if (n.id >= 100000) { if (!(n.id in names.uvar)) names.uvar[n.id] = lstr(u32(uvars + (n.id - 100000) * 4)); }
      else if (n.id < 10000 && !(n.id in names.bvar)) names.bvar[n.id] = sstr(0x6c8dd8 + n.id * 80);
    }
  }
  fs.writeFileSync(out, JSON.stringify({ probes: report.probes, nodes, codes, names }));
  return `${out}: ${Object.keys(nodes).length} nodes, ${Object.keys(codes).length} codes, ${Object.keys(names.fn).length} fns`;
};
