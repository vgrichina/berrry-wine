'use strict';
// tl;dr: --value-probe -- a histogram of guest values at a block entry.
//
//   --count says how often an address runs; this says *with what*. Each probe
//   is `ADDR@EXPR[|EXPR...]`: every time EIP enters ADDR (a block entry, same
//   rule as --count), the EXPRs are evaluated against the registers at that
//   moment and guest memory, and the joined result is one histogram key.
//
//     0x52786c@[edx]              node kind byte... dword at [EDX]
//     0x52786c@edx                the node pointer itself (per-node counts)
//     0x52714d@[[ebp-0x188]+4]    two-level deref
//     0x52786c@esp>>4             stack position, 16-byte buckets
//     0x4a8a30@b[eax]|ecx         byte at [EAX] and ECX, key "b,c"
//
//   EXPR grammar (left to right, no precedence): term (op term)*, op one of
//   + - * >> << & ; term is a register (eax..edi, eip), a number (0x.. or
//   decimal), [EXPR] (u32), w[EXPR] (u16), b[EXPR] (u8), d[EXPR] (f64, the
//   number itself as the key). Unreadable memory yields the key "?".
//
//   The count slots after the plain --count ones carry the probes, and
//   set_count_probe_mask marks them so the WAT hit loop calls
//   host.log_eip(-256 - slot) (13-exports.wat). Arming switches on $dbg_any,
//   exactly like --count, so the uop tier and block chaining are off while a
//   probe is armed: counts are guest-exact, timings are not.

const REGS = ['eax', 'ecx', 'edx', 'ebx', 'esp', 'ebp', 'esi', 'edi', 'eip'];

function parseExpr(src) {
  let i = 0;
  const s = String(src).replace(/\s+/g, '');
  const peek = () => s[i];
  const num = () => {
    const m = /^(0x[0-9a-f]+|\d+)/i.exec(s.slice(i));
    if (!m) throw new Error(`value-probe: number expected at ${i} in ${src}`);
    i += m[0].length;
    return parseInt(m[0], m[0].toLowerCase().startsWith('0x') ? 16 : 10) >>> 0;
  };
  const term = () => {
    for (const [pfx, kind] of [['d[', 'f64'], ['w[', 'u16'], ['b[', 'u8'], ['[', 'u32']]) {
      if (s.startsWith(pfx, i)) {
        i += pfx.length;
        const inner = expr();
        if (s[i] !== ']') throw new Error(`value-probe: ] expected at ${i} in ${src}`);
        i++;
        return { load: kind, inner };
      }
    }
    for (const r of REGS) if (s.startsWith(r, i)) { i += r.length; return { reg: r }; }
    return { lit: num() };
  };
  const expr = () => {
    let node = term();
    for (;;) {
      const op = ['>>', '<<', '+', '-', '*', '&'].find(o => s.startsWith(o, i));
      if (!op) return node;
      i += op.length;
      node = { op, a: node, b: term() };
    }
  };
  const node = expr();
  if (i !== s.length) throw new Error(`value-probe: trailing input at ${i} in ${src}`);
  return node;
}

function parseSpec(spec) {
  const at = spec.indexOf('@');
  if (at < 0) throw new Error(`value-probe: ADDR@EXPR expected, got ${spec}`);
  const addr = parseInt(spec.slice(0, at), 16) >>> 0;
  const exprs = spec.slice(at + 1).split('|').map(parseExpr);
  return { spec, addr, exprs };
}

class ValueProbe {
  // exports: the instance exports; g2w(guest) -> wasm offset or throws;
  // memory: the WebAssembly.Memory; firstSlot: first count slot to use.
  constructor({ exports, g2w, memory, firstSlot = 0 }) {
    this.e = exports;
    this.g2w = g2w;
    this.memory = memory;
    this.firstSlot = firstSlot;
    this.probes = [];
    this._dv = null;
  }

  dv() {
    if (!this._dv || this._dv.buffer !== this.memory.buffer) this._dv = new DataView(this.memory.buffer);
    return this._dv;
  }

  eval(node, r) {
    if (node.reg) return r[node.reg];
    if (node.lit !== undefined) return node.lit;
    if (node.load) {
      const a = this.eval(node.inner, r);
      if (typeof a !== 'number' || !Number.isFinite(a)) return NaN;
      let w;
      try { w = this.g2w(a >>> 0); } catch (_) { return NaN; }
      const dv = this.dv();
      if (w < 0 || w + 8 > dv.byteLength) return NaN;
      switch (node.load) {
        case 'u32': return dv.getUint32(w, true);
        case 'u16': return dv.getUint16(w, true);
        case 'u8': return dv.getUint8(w);
        default: return dv.getFloat64(w, true);
      }
    }
    const a = this.eval(node.a, r), b = this.eval(node.b, r);
    switch (node.op) {
      case '+': return (a + b) >>> 0;
      case '-': return (a - b) >>> 0;
      case '*': return Math.imul(a, b) >>> 0;
      case '>>': return a >>> b;
      case '<<': return (a << b) >>> 0;
      default: return (a & b) >>> 0;
    }
  }

  regs() {
    const e = this.e;
    return {
      eax: e.get_eax() >>> 0, ecx: e.get_ecx() >>> 0, edx: e.get_edx() >>> 0, ebx: e.get_ebx() >>> 0,
      esp: e.get_esp() >>> 0, ebp: e.get_ebp() >>> 0, esi: e.get_esi() >>> 0, edi: e.get_edi() >>> 0,
      eip: e.get_eip() >>> 0,
    };
  }

  // specs: 'A@E;B@F' or an array. Re-arming replaces every probe.
  arm(specs) {
    this.disarm();
    const list = Array.isArray(specs) ? specs : String(specs).split(';').filter(Boolean);
    if (this.firstSlot + list.length > 16) throw new Error('value-probe: 16 count slots in all');
    let mask = 0;
    this.probes = list.map((sp, k) => {
      const p = parseSpec(sp);
      p.slot = this.firstSlot + k;
      p.hits = 0;
      p.hist = new Map();
      this.e.set_count(p.slot, p.addr);
      mask |= 1 << p.slot;
      return p;
    });
    this.e.set_count_probe_mask(mask);
    return this.probes.map(p => `${p.slot}:${p.spec}`).join(' ');
  }

  disarm() {
    if (!this.probes.length) return;
    this.e.set_count_probe_mask(0);
    // Park the slots on an address no block starts at (0 never dispatches).
    for (const p of this.probes) this.e.set_count(p.slot, 0);
  }

  // tag from host.log_eip; true when it was ours.
  onTag(tag) {
    if (tag > -256 || tag < -256 - 15) return false;
    const slot = -256 - tag;
    const p = this.probes.find(q => q.slot === slot);
    if (!p) return true;
    const r = this.regs();
    let key = '';
    for (let k = 0; k < p.exprs.length; k++) {
      const v = this.eval(p.exprs[k], r);
      key += (k ? ',' : '') + (Number.isNaN(v) ? '?' : (p.exprs[k].load === 'f64' ? String(v) : v.toString(16)));
    }
    p.hits++;
    p.hist.set(key, (p.hist.get(key) || 0) + 1);
    return true;
  }

  reset() { for (const p of this.probes) { p.hits = 0; p.hist.clear(); } }

  report() {
    return {
      probes: this.probes.map(p => ({
        spec: p.spec, addr: '0x' + p.addr.toString(16), slot: p.slot, hits: p.hits,
        distinct: p.hist.size,
        hist: Object.fromEntries([...p.hist.entries()].sort((a, b) => b[1] - a[1])),
      })),
    };
  }

  write(file) {
    require('fs').writeFileSync(file, JSON.stringify(this.report()));
    return `${file}: ${this.probes.map(p => `${p.spec} hits=${p.hits} distinct=${p.hist.size}`).join('; ')}`;
  }
}

module.exports = { ValueProbe, parseExpr, parseSpec };
