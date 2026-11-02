'use strict';

// 386 IDT task gates and NT IRET. The old task is restartable until its
// complete save and the incoming register image have been installed. From
// then on, every fault belongs to the incoming task, before its first opcode.
// Intel 80386 PRM 7.1/7.5/7.6/9.8.14.1; SDM vol.3A 7.3.
const isa = require('./isa');

function switchTask(vm, selector, returnIp, returning, context, errorWord) {
  const { access, DeliveryFault } = require('./paging-exec');
  const { e, get, read, desc, present, stack } = access(vm);
  const set = (n, v) => e[`mset_${n}`](v);
  const fail = (v, s) => { throw new DeliveryFault(v, s & 0xfffc); };
  const write = (p, n, v) => e.pg_write(p >>> 0, n, v, 0);
  const oldTr = get('tr'), oldBase = get('pm_tr_base');
  const targetError = returning ? 10 : 13;
  if (!(selector & 0xfff8) || (selector & 4)) fail(targetError, selector);
  const t = desc(selector, targetError);
  // Type/availability are checked before presence: a busy task cannot nest.
  if ((t.access & 31) !== (returning ? 11 : 9)) {
    if ((t.access & 31) === (returning ? 3 : 1))
      throw Error('unsupported 286 task switch');
    fail(targetError, selector);
  }
  present(t, 11, selector);
  if (t.limit < 103) fail(10, selector);
  if (!get('pm_tr_valid') || (get('pm_tr_access') & 15) !== 11 || get('pm_tr_limit') < 103)
    fail(10, oldTr);

  // A split/nonresident TSS is restartable in the old task (PRM 7.1).
  // Stage the complete image before writes, including when the TSSs alias.
  // TSSs must be shared between address spaces (PRM 7.7 / SDM 7.5.1).
  const cr3 = read(t.base + 28), ip = read(t.base + 32), flags = read(t.base + 36);
  const regs = isa.REG16.map((_, i) => read(t.base + 40 + i * 4));
  const segments = isa.SEG.map((_, i) => read(t.base + 72 + i * 4, 2));
  const ldt = read(t.base + 96, 2), trap = read(t.base + 100, 2) & 1;

  const savedFlags = e.pg_flags() & (returning ? ~0x4000 : -1);
  write(oldBase + 32, 4, returnIp);
  write(oldBase + 36, 4, savedFlags);
  isa.REG16.forEach((r, i) => write(oldBase + 40 + i * 4, 4, vm.raw(r)));
  isa.SEG.forEach((s, i) => write(oldBase + 72 + i * 4, 2, vm.get(s)));
  if (returning) {
    // The live GDT supplies only the busy byte; outgoing save uses cached TR.
    const oldDescriptor = desc(oldTr, 10);
    write(oldDescriptor.p + 5, 1, oldDescriptor.access & ~2);
  } else {
    write(t.base, 2, oldTr);
    write(t.p + 5, 1, t.access | 2);
  }

  // No faultable accessor or permissive selector setter in this publication.
  // In particular, sset would reread descriptors before LDTR/CR3 were ready.
  set('tr', selector); set('pm_tr_base', t.base); set('pm_tr_limit', t.limit);
  set('pm_tr_access', t.access | 2); set('pm_tr_valid', 1);
  set('cr0', get('cr0') | 8);
  if (get('cr0') & 0x80000000) set('cr3', cr3);
  set('pg_epoch', get('pg_epoch') + 1);
  set('ldt', ldt); set('ldtb', 0); set('pm_ldt_valid', 0);
  set('pm_ldt_limit', 0); set('pm_ldt_access', 0);
  set('vm86', flags & 0x20000 ? 1 : 0);
  e.pg_set_flags((flags & 0x37fd5) | 2 | (returning ? 0 : 0x4000));
  regs.forEach((v, i) => e[`set_${isa.REG16[i]}`](v));
  const selectors = new DataView(vm.mem.buffer, isa.REGFILE_SEL, isa.SEG.length * 4);
  segments.forEach((v, i) => {
    const s = isa.SEG[i]; selectors.setUint32(i * 4, v, true);
    set(`${s}b`, 0); set(`pm_${s}_valid`, 0);
    set(`pm_${s}_limit`, 0); set(`pm_${s}_access`, 0);
  });
  set('d32', 0); set('spm', 0xffff);
  set('pm_task_segments', 1);
  vm.set('gip', ip); vm.set('rtop', 0);
  context.committed = true; context.ip = ip;
  e.pg_checkpoint(); // architectural commit: save/busy/backlink cannot unwind

  // Qualify caches in the incoming address space. Preserve each completed
  // load before the next faultable reference. Invalid/unloaded caches never
  // inherit metadata from the outgoing task.
  if (ldt & 0xfffc) {
    if (ldt & 4) fail(10, ldt);
    const d = desc(ldt, 10);
    if ((d.access & 159) !== 130) fail(10, ldt);
    set('ldtb', d.base); set('pm_ldt_limit', d.limit);
    set('pm_ldt_access', d.access); set('pm_ldt_valid', 1);
    e.pg_checkpoint();
  }
  const v86 = !!get('vm86'), level = v86 ? 3 : segments[1] & 3;
  let code;
  for (const index of [1, 2, 0, 3, 4, 5]) {
    const s = isa.SEG[index], sel = segments[index];
    let d;
    if (v86) d = { base: sel << 4, limit: 0xffff, access: index === 1 ? 0xfb : 0xf3, wide: false };
    else {
      if (!(sel & 0xfffc)) {
        if (index === 1 || index === 2) fail(10, sel);
        continue;
      }
      d = desc(sel, 10);
      if (index === 1) {
        if ((d.access & 24) !== 24 || ((d.access & 4) ? d.level > level : d.level !== level)) fail(10, sel);
      } else if (index === 2) {
        if ((d.access & 26) !== 18 || (sel & 3) !== level || d.level !== level) fail(10, sel);
      } else if (!(d.access & 16) || ((d.access & 8) && !(d.access & 2)) ||
          ((d.access & 12) !== 12 && d.level < Math.max(level, sel & 3))) fail(10, sel);
      present(d, index === 2 ? 12 : 11, sel);
      if (!(d.access & 1)) write(d.p + 5, 1, d.access | 1);
    }
    set(`${s}b`, d.base); set(`pm_${s}_limit`, d.limit);
    set(`pm_${s}_access`, d.access | 1); set(`pm_${s}_valid`, 1);
    if (index !== 1 && index !== 2) set(`pm_${s}_mask`, d.wide ? -1 : 0xffff);
    if (index === 1) { code = d; set('d32', d.wide ? 1 : 0); }
    if (index === 2) set('spm', d.wide ? -1 : 0xffff);
    e.pg_checkpoint();
  }
  if (errorWord !== undefined) {
    const mask = get('spm'), fullSp = vm.raw('sp') >>> 0;
    const sp = ((fullSp - 4) & mask) >>> 0;
    const sd = { base: get('ssb'), wide: mask === 0xffffffff,
      limit: get('pm_ss_limit'), access: get('pm_ss_access') };
    stack(sd, sp, 4, level);
    e.pg_write((sd.base + sp) >>> 0, 4, errorWord, level === 3 ? 1 : 0);
    vm.set('sp', ((fullSp & ~mask) | sp) >>> 0);
    e.pg_checkpoint();
  }
  if (ip > code.limit) fail(13, 0);
  if (trap) throw new DeliveryFault(1, 0);
}

module.exports = { switchTask };
