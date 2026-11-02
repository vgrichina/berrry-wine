'use strict';

// Paged execution deliberately decodes one reached instruction at a time.
// This prevents speculative fetch faults and makes decoded physical aliases
// and CR3 reloads coherent without maintaining a second translation cache.
const isa = require('./isa');
const { decodeOne, H } = require('./decode');

class DeliveryFault extends Error {
  constructor(vector, error) { super(`exception delivery ${vector}/${error}`); this.vector = vector; this.error = error; }
}
const errorVectors = new Set([8, 10, 11, 12, 13, 14]);
const faultVectors = new Set([0, 5, 6, 7, 10, 11, 12, 13, 14]);
function access(vm) {
  const e = vm.exports;
  const get = n => e[`mget_${n}`]() >>> 0;
  const read = (p, n = 4, user = 0) => e.pg_read(p >>> 0, n, user) >>> 0;
  const desc = (selector, vector = 13) => {
    const ldt = selector & 4;
    const index = selector & 0xfff8;
    const limit = get(ldt ? 'pm_ldt_limit' : 'gdtl');
    if ((!ldt && !index) || (ldt && !get('pm_ldt_valid')) || index + 7 > limit)
      throw new DeliveryFault(vector, selector & 0xfffc);
    const p = (get(ldt ? 'ldtb' : 'gdtb') + index) >>> 0;
    const lo = read(p), hi = read(p + 4);
    let limitValue = (lo & 0xffff) | ((hi >>> 16 & 15) << 16);
    if (hi & 0x800000) limitValue = (limitValue * 4096 + 4095) >>> 0;
    return { p, base: ((lo >>> 16) | ((hi & 255) << 16) | (hi & 0xff000000)) >>> 0,
      limit: limitValue, access: hi >>> 8 & 255, wide: !!(hi & 0x400000), level: hi >>> 13 & 3 };
  };
  const present = (d, vec, selector) => {
    if (!(d.access & 128)) throw new DeliveryFault(vec, selector & 0xfffc);
  };
  const stack = (d, sp, bytes, level, write = 1) => {
    const mask = d.wide ? 0xffffffff : 0xffff;
    sp = (sp & mask) >>> 0;
    const end = sp + bytes - 1;
    if (end > mask || ((d.access & 4) ? sp <= d.limit : end > d.limit)) throw new DeliveryFault(12, 0);
    for (let i = 0; i < bytes; i++) e.pg_probe((d.base + sp + i) >>> 0, write, level === 3 ? 1 : 0);
    return sp;
  };
  return { e, get, read, desc, present, stack };
}

// Diagnostics never invoke pg_read/pg_probe: those can set CR2, roll back the
// guest, mark page tables accessed, or read a device. Only ordinary backed RAM
// is inspected here; unavailable/device bytes are reported explicitly.
function exceptionState(vm, vector, error, ip, software, external, taskSelector) {
  const e = vm.exports, get = n => e[`mget_${n}`]() >>> 0;
  const state = { vector, error: error >>> 0, returnIp: ip >>> 0, software, external,
    cs: vm.get('cs'), ip: vm.get('gip'), ss: vm.get('ss'), sp: vm.raw('sp') >>> 0 };
  state.flags = e.pg_flags() >>> 0;
  state.registers = Object.fromEntries(isa.REG16.map(r => [r, vm.raw(r) >>> 0]));
  for (const n of ['cr0', 'cr2', 'cr3', 'idtb', 'idtl', 'gdtb', 'gdtl',
    'tr', 'pm_tr_valid', 'pm_tr_base', 'pm_tr_limit', 'pm_tr_access',
    'ldtb', 'pm_ldt_limit', 'vm86', 'linmask']) state[n] = get(n);
  const bus = p => state.linmask === 0xfffff ? (p & 0xffefffff) >>> 0 : p >>> 0;
  const byte = p => {
    p = bus(p);
    if (p >= isa.GUEST_RAM_SIZE || (p >= 0xa0000 && p < 0xc0000)) throw Error('not ordinary RAM');
    return vm.mem[p];
  };
  const word = p => (byte(p) | byte(p + 1) << 8 | byte(p + 2) << 16 | byte(p + 3) << 24) >>> 0;
  const inspect = (linear, count) => {
    const out = { linear: linear >>> 0, physical: [], bytes: [], walks: [] };
    try {
      for (let i = 0; i < count; i++) {
        const l = (linear + i) >>> 0;
        let p = l & state.linmask;
        if (state.cr0 & 0x80000000) {
          const pdeAddress = ((state.cr3 & 0xfffff000) + ((l >>> 22) * 4)) >>> 0;
          const de = word(pdeAddress);
          const walk = { page: l >>> 12, pdeAddress, pde: de };
          if (!out.walks.some(w => w.page === walk.page)) out.walks.push(walk);
          if (!(de & 1)) throw Error('PDE not present');
          const pteAddress = ((de & 0xfffff000) + ((l >>> 10) & 0xffc)) >>> 0;
          const te = word(pteAddress);
          Object.assign(walk, { pteAddress, pte: te });
          if (!(te & 1)) throw Error('PTE not present');
          p = ((te & 0xfffff000) | (l & 0xfff)) >>> 0;
        }
        out.physical.push(bus(p)); out.bytes.push(byte(p));
      }
    } catch (err) { out.unavailable = err.message; }
    return out;
  };
  const descriptor = selector => {
    const ldt = selector & 4, offset = selector & 0xfff8;
    return { selector, inBounds: offset + 7 <= state[ldt ? 'pm_ldt_limit' : 'gdtl'],
      ...inspect((state[ldt ? 'ldtb' : 'gdtb'] + offset) >>> 0, 8) };
  };
  state.gate = inspect((state.idtb + vector * 8) >>> 0, 8);
  state.gate.inBounds = vector * 8 + 7 <= state.idtl;
  if (state.gate.bytes.length === 8) {
    const b = state.gate.bytes;
    state.gate.type = b[5] & 31; state.gate.present = !!(b[5] & 128);
    state.gate.dpl = b[5] >>> 5 & 3;
    state.target = descriptor(b[2] | b[3] << 8);
  }
  if (taskSelector !== undefined) state.target = descriptor(taskSelector);
  state.task = descriptor(state.tr);
  if (state.pm_tr_valid) state.currentTss = inspect(state.pm_tr_base, Math.min(state.pm_tr_limit + 1, 104));
  if (state.target?.bytes.length === 8) {
    const b = state.target.bytes;
    if ([9, 11].includes(b[5] & 31)) {
      const base = (b[2] | b[3] << 8 | b[4] << 16 | b[7] << 24) >>> 0;
      let limit = (b[0] | b[1] << 8 | (b[6] & 15) << 16) >>> 0;
      if (b[6] & 128) limit = limit * 4096 + 4095;
      state.targetTss = inspect(base, Math.min(limit + 1, 104));
    }
  }
  state.instruction = inspect((get('csb') + state.ip) >>> 0, 16);
  return state;
}

function deliver(vm, vector, error, ip, software = false, external = false, context = {}) {
  const a = access(vm), { e, get, read, desc, present, stack } = a;
  const idtError = vector * 8 + 2;
  if (vector * 8 + 7 > get('idtl')) throw new DeliveryFault(13, idtError);
  const gate = (get('idtb') + vector * 8) >>> 0;
  const lo = read(gate), hi = read(gate + 4);
  const type = hi >>> 8 & 31, gateLevel = hi >>> 13 & 3;
  const oldCs = vm.get('cs'), oldSs = vm.get('ss'), oldSp = vm.raw('sp') >>> 0;
  const v86 = !!get('vm86'), oldLevel = v86 ? 3 : oldCs & 3;
  if (![5, 6, 7, 14, 15].includes(type)) throw new DeliveryFault(13, idtError);
  if (software && oldLevel > gateLevel) throw new DeliveryFault(13, idtError);
  if (!(hi & 0x8000)) throw new DeliveryFault(11, idtError);
  if (type === 5) {
    if (!software && !external && faultVectors.has(vector)) e.pg_set_flags(e.pg_flags() | 0x10000);
    require('./task-switch').switchTask(vm, lo >>> 16, ip, false, context,
      !software && !external && errorVectors.has(vector) ? error : undefined);
    vm.set('intno', vector);
    return;
  }
  const width = type & 8 ? 4 : 2;
  if (v86 && width !== 4) throw new DeliveryFault(13, idtError);
  const selector = lo >>> 16;
  const code = desc(selector);
  present(code, 11, selector);
  if ((code.access & 24) !== 24 || code.level > oldLevel) throw new DeliveryFault(13, selector & 0xfffc);
  const level = code.access & 4 ? oldLevel : code.level;
  const target = ((lo & 0xffff) | (width === 4 ? hi & 0xffff0000 : 0)) >>> 0;
  if (target > code.limit) throw new DeliveryFault(13, 0);
  let ss = oldSs, sp = oldSp;
  let sd = { base: get('ssb'), wide: get('spm') === 0xffffffff,
    limit: get('pm_ss_valid') ? get('pm_ss_limit') : 0xffffffff,
    access: get('pm_ss_valid') ? get('pm_ss_access') : 0x92 };
  const inner = level < oldLevel;
  if (inner) {
    if (!get('pm_tr_valid')) throw new DeliveryFault(10, get('tr') & 0xfffc);
    const trType = get('pm_tr_access') & 15;
    const tss32 = trType === 9 || trType === 11;
    if (!tss32 && trType !== 1 && trType !== 3) throw new DeliveryFault(10, get('tr') & 0xfffc);
    const offset = tss32 ? 4 + level * 8 : 2 + level * 4;
    if (offset + (tss32 ? 5 : 3) > get('pm_tr_limit')) throw new DeliveryFault(10, get('tr') & 0xfffc);
    const t = get('pm_tr_base') + offset;
    sp = read(t, tss32 ? 4 : 2); ss = read(t + (tss32 ? 4 : 2), 2);
    sd = desc(ss);
    if ((ss & 3) !== level || sd.level !== level || (sd.access & 26) !== 18) throw new DeliveryFault(10, ss & 0xfffc);
    present(sd, 12, ss);
  }
  const flags = (e.pg_flags() | (v86 ? 0x20000 : 0)) >>> 0;
  const savedFlags = !software && !external && faultVectors.has(vector) ? flags | 0x10000 : flags;
  const values = [];
  if (v86) values.push(vm.get('gs'), vm.get('fs'), vm.get('ds'), vm.get('es'));
  if (inner) values.push(oldSs, oldSp);
  values.push(savedFlags, oldCs, ip >>> 0);
  if (!software && !external && errorVectors.has(vector)) values.push(error >>> 0);
  const mask = sd.wide ? 0xffffffff : 0xffff;
  const fullSp = sp;
  // Preflight the whole frame, including each push's wrap and privilege.
  const locations = values.map(() => { sp = ((sp - width) & mask) >>> 0; return stack(sd, sp, width, level); });
  for (let i = 0; i < values.length; i++) e.pg_write((sd.base + locations[i]) >>> 0, width, values[i], level === 3 ? 1 : 0);
  // Descriptor access writes are supervisor references and can themselves fault.
  e.pg_write(code.p + 5, 1, code.access | 1, 0);
  if (inner) e.pg_write(sd.p + 5, 1, sd.access | 1, 0);
  e.mset_vm86(0);
  vm.set('cs', (selector & 0xfffc) | level);
  if (inner) vm.set('ss', ss);
  vm.set('sp', ((fullSp & ~mask) | sp) >>> 0);
  if (v86) for (const s of ['es', 'ds', 'fs', 'gs']) vm.set(s, 0);
  e.pg_set_flags(flags & ~(0x100 | 0x4000 | 0x10000 | 0x20000 | ((type & 1) ? 0 : 0x200)));
  vm.set('gip', target); vm.set('intno', vector); vm.set('rtop', 0);
}

function iret(vm, width, context = {}, nextIp = vm.get('gip')) {
  const { e, get, read, desc, present, stack } = access(vm);
  const v86 = !!get('vm86'), oldLevel = v86 ? 3 : vm.get('cs') & 3, mask = get('spm');
  const oldFlags = e.pg_flags() >>> 0;
  if (v86 && (oldFlags >>> 12 & 3) !== 3) throw new DeliveryFault(13, 0);
  // NT selects a TSS backlink return regardless of IRET's operand width.
  if (!v86 && (oldFlags & 0x4000)) {
    if (!get('pm_tr_valid') || get('pm_tr_limit') < 1) throw new DeliveryFault(10, get('tr') & 0xfffc);
    require('./task-switch').switchTask(vm, read(get('pm_tr_base'), 2), nextIp, true, context);
    return;
  }
  const sp = vm.raw('sp') >>> 0, base = get('ssb');
  const oldStack = { base, wide: mask === 0xffffffff,
    limit: v86 ? 0xffff : get('pm_ss_limit'), access: v86 ? 0x92 : get('pm_ss_access') };
  stack(oldStack, sp, 3 * width, oldLevel, 0);
  const word = i => read((base + ((sp + i * width) & mask)) >>> 0, width, oldLevel === 3 ? 1 : 0);
  const ip = word(0), cs = word(1) & 0xffff, flags = word(2);
  if (v86) {
    if (ip > 0xffff) throw new DeliveryFault(13, 0);
    vm.set('cs', cs); vm.set('gip', ip);
    vm.set('sp', ((sp & ~mask) | ((sp + 3 * width) & mask)) >>> 0);
    const f = width === 2 ? (oldFlags & 0xffff0000) | flags : flags;
    e.pg_set_flags((f & ~0x3000) | (oldFlags & 0x3000) | 0x20002); return;
  }
  if (width === 4 && oldLevel === 0 && (flags & 0x20000)) {
    stack(oldStack, sp, 9 * width, oldLevel, 0);
    if (ip > 0xffff) throw new DeliveryFault(13, 0);
    const newsp = word(3), ss = word(4), segments = [word(5), word(6), word(7), word(8)];
    e.mset_vm86(1); vm.set('cs', cs); vm.set('ss', ss); vm.set('sp', newsp);
    ['es', 'ds', 'fs', 'gs'].forEach((s, i) => vm.set(s, segments[i]));
    e.pg_set_flags(flags); vm.set('gip', ip & 0xffff); return;
  }
  const level = cs & 3, code = desc(cs);
  if (level < oldLevel || (code.access & 24) !== 24 ||
      ((code.access & 4) ? code.level > level : code.level !== level)) throw new DeliveryFault(13, cs & 0xfffc);
  present(code, 11, cs);
  if (ip > code.limit) throw new DeliveryFault(13, 0);
  let newSp = ((sp & ~mask) | ((sp + 3 * width) & mask)) >>> 0, ss;
  if (level > oldLevel) {
    stack(oldStack, sp, 5 * width, oldLevel, 0);
    newSp = word(3); ss = word(4) & 0xffff;
    const sd = desc(ss);
    if ((ss & 3) !== level || sd.level !== level || (sd.access & 26) !== 18) throw new DeliveryFault(13, ss & 0xfffc);
    present(sd, 12, ss);
  }
  vm.set('cs', cs);
  if (ss !== undefined) vm.set('ss', ss);
  vm.set('sp', newSp); vm.set('gip', ip);
  if (level > oldLevel) for (const s of ['es', 'ds', 'fs', 'gs']) {
    const selector = vm.get(s);
    if (!(selector & 0xfffc)) continue;
    const access = get(`pm_${s}_access`), dpl = access >>> 5 & 3;
    if (!(access & 16) || ((access & 8) && !(access & 2)) ||
        ((access & 12) !== 12 && dpl < Math.max(level, selector & 3))) vm.set(s, 0);
  }
  let newFlags = width === 2 ? (oldFlags & 0xffff0000) | flags : flags;
  if (oldLevel) newFlags = (newFlags & ~0x3000) | (oldFlags & 0x3000);
  if (oldLevel > (oldFlags >>> 12 & 3)) newFlags = (newFlags & ~0x200) | (oldFlags & 0x200);
  e.pg_set_flags(newFlags);
}

function exception(vm, vector, error, ip, software = false, faultIp = ip, external = false) {
  const e = vm.exports, chain = [];
  const fatal = err => { err.pagingException = { chain }; return err; };
  for (let attempt = 0; attempt < 3; attempt++) {
    chain.push(exceptionState(vm, vector, error, ip, software, external));
    const context = { committed: false, ip };
    e.pg_clear(); e.pg_checkpoint();
    try { deliver(vm, vector, error, ip, software, external, context); e.pg_set_error(0); e.pg_clear(); e.pg_checkpoint(); return; }
    catch (err) {
      const pending = e.pg_pending();
      chain[chain.length - 1].failure = { message: err.message, pending,
        cr2: e.mget_cr2() >>> 0, error: e.pg_error() >>> 0,
        vector: err instanceof DeliveryFault ? err.vector : null,
        committed: context.committed, task: e.mget_tr() >>> 0, faultIp: context.ip };
      if (!pending && !(err instanceof DeliveryFault)) throw fatal(err);
      if (pending === 3) { e.pg_clear(); throw fatal(Error(`unbacked physical paging bus at ${(e.pg_bus_address() >>> 0).toString(16)}`)); }
      const next = pending ? (pending === 4 ? e.pg_vector() : 14) : err.vector;
      const nextError = pending ? e.pg_error() : err.error | (external ? 1 : 0);
      if (!pending) e.pg_rollback();
      if (context.committed) ip = faultIp = context.ip;
      else if (software) ip = faultIp;
      if (!software && !external && vector === 8) { e.pg_clear(); throw fatal(Error('386 shutdown: fault delivering #DF')); }
      const contributory = n => [0, 10, 11, 12, 13].includes(n);
      if (!software && !external && ((vector === 14 && (next === 14 || contributory(next))) || (contributory(vector) && contributory(next)))) {
        vector = 8; error = 0;
      } else { vector = next; error = nextError; }
      software = false; external = false;
    }
  }
  throw fatal(Error('386 exception delivery did not terminate'));
}

function step(vm, budget = 1000) {
  const e = vm.exports, ip = vm.get('gip'), cs = vm.get('cs');
  const context = { committed: false, ip };
  const user = e.get_vm86() || (cs & 3) === 3 ? 1 : 0;
  e.set_steps(budget);
  e.set_intfast(0);
  e.set_rtop(0); e.set_edgelook(0);
  e.pg_clear(); e.pg_reset_vector(); e.pg_checkpoint();
  try {
    const d = decodeOne(p => {
      if (e.mget_pm_task_segments() &&
          (!e.mget_pm_cs_valid() || ((p - (e.get_csb() >>> 0)) >>> 0) > (e.mget_pm_cs_limit() >>> 0)))
        throw new DeliveryFault(13, 0);
      return e.pg_read(p, 1, user);
    }, cs, ip,
      e.get_csb() >>> 0, -1, !!e.get_d32(), null, !e.get_vm86());
    if (!d) return false;
    if ((d.words[0] === H.mov_cr_r || d.words[0] === H.mov_r_cr || d.words[0] === H.clts) &&
        (e.get_vm86() || (cs & 3))) throw new DeliveryFault(13, 0);
    if (d.words[0] === H.mov_cr_r && !(d.words[1] & 0x70)) {
      const value = vm.raw(isa.REG16[d.words[1] & 7]);
      if ((value >>> 31) && !(value & 1)) throw new DeliveryFault(13, 0);
    }
    const cr0 = e.get_cr0();
    if ((d.x87 && (cr0 & 12)) || (d.wait && (cr0 & 10) === 10)) throw new DeliveryFault(7, 0);
    const words = d.endsBlock ? d.words : [...d.words, H.end, d.nextIp];
    const entry = isa.THREAD_BASE + isa.THREAD_SIZE - 4096;
    new Int32Array(vm.mem.buffer, entry, words.length).set(words);
    e.pg_authorize(1);
    try { e.run(entry, budget); } finally { e.pg_authorize(0); }
    const vec = e.pg_vector();
    if (vec === -2) iret(vm, e.pg_return(), context, d.nextIp);
    else if (vec >= 0) exception(vm, vec, e.pg_error(), e.pg_return(),
      d.words[0] === H.int_imm || d.words[0] === H.into, ip);
    if (vec === -1 && d.words[0] !== H.popf && d.words[0] !== H.popf32 && (vm.raw('flags') & 0x10000)) {
      e.pg_set_flags(e.pg_flags() & ~0x10000);
    }
    e.pg_checkpoint();
    return true;
  } catch (err) {
    const pending = e.pg_pending();
    if (!pending && !(err instanceof DeliveryFault)) throw err;
    if (pending === 3) { e.pg_clear(); throw Error(`unbacked physical paging bus at ${(e.pg_bus_address() >>> 0).toString(16)}`); }
    const vector = pending ? (pending === 4 ? e.pg_vector() : 14) : err.vector, error = pending ? e.pg_error() : err.error;
    if (!pending) e.pg_rollback();
    exception(vm, vector, error, context.committed ? context.ip : ip);
    return true;
  }
}

module.exports = { step, exception, iret, DeliveryFault, exceptionState, access };
