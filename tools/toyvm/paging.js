'use strict';

// Checked 80386 paging translation and instruction restart support.
// Intel 80386 PRM (1986), 5.2, 6.4/table 6-5, 9.8.14.
//
// Return an i64 tagged result. Low 32 bits hold the physical address on
// success, the faulting LINEAR address for #PF, or the unavailable physical
// address for a backing miss. High 32 bits hold status | (PF error << 8).
// A caller must check status before accessing memory. Physical zero is valid.
// Missing host backing is not an architectural not-present page.
//
// No TLB: paged instructions are decoded only when reached.
// A20 is explicit: the old linmask conflates RAM size with address-bus width.
// Paging must never use that capacity mask on its input or output.
const STATUS = Object.freeze({ ok: 0, notPresent: 1, protection: 2, backing: 3 });

function helpers(isa, physicalBus = false) {
  const wat = `
(func $page_result (param $address i32) (param $status i32) (param $error i32) (result i64)
  (i64.or (i64.extend_i32_u (local.get $address))
    (i64.shl (i64.extend_i32_u
      (i32.or (local.get $status) (i32.shl (local.get $error) (i32.const 8))))
      (i64.const 32))))

;; A20 gates one physical address line; it does not truncate to RAM capacity.
(func $page_bus (param $address i32) (param $a20 i32) (result i32)
  (select (local.get $address)
    (i32.and (local.get $address) (i32.const 0xffefffff)) (local.get $a20)))

;; Paging structures currently require ordinary physical RAM. Device-backed
;; page tables need a physical bus accessor before they can be supported.
(func $page_table_ram (param $p i32) (result i32)
  (i32.and (i32.le_u (local.get $p) (i32.const ${isa.GUEST_RAM_SIZE - 4}))
    (i32.or (i32.lt_u (local.get $p) (i32.const 0xa0000))
      (i32.ge_u (local.get $p) (i32.const 0xc0000)))))

(func $page_translate (param $directory i32) (param $linear i32)
  (param $write i32) (param $user i32) (param $a20 i32) (result i64)
  (local $dp i32) (local $tp i32) (local $de i32) (local $te i32)
  (local $p i32) (local $error i32)
  (local.set $write (i32.ne (local.get $write) (i32.const 0)))
  (local.set $user (i32.ne (local.get $user) (i32.const 0)))
  (local.set $error (i32.or
    (i32.shl (i32.ne (local.get $write) (i32.const 0)) (i32.const 1))
    (i32.shl (i32.ne (local.get $user) (i32.const 0)) (i32.const 2))))
  (local.set $dp (call $page_bus
    (i32.add (i32.and (local.get $directory) (i32.const 0xfffff000))
      (i32.shl (i32.shr_u (local.get $linear) (i32.const 22)) (i32.const 2)))
    (local.get $a20)))
  (if (i32.eqz (call $page_table_ram (local.get $dp))) (then
    (return (call $page_result (local.get $dp) (i32.const ${STATUS.backing}) (i32.const 0)))))
  (local.set $de (i32.load (local.get $dp)))
  (if (i32.eqz (i32.and (local.get $de) (i32.const 1))) (then
    (return (call $page_result (local.get $linear) (i32.const ${STATUS.notPresent}) (local.get $error)))))
  (local.set $tp (call $page_bus
    (i32.add (i32.and (local.get $de) (i32.const 0xfffff000))
      (i32.and (i32.shr_u (local.get $linear) (i32.const 10)) (i32.const 0xffc)))
    (local.get $a20)))
  (if (i32.eqz (call $page_table_ram (local.get $tp))) (then
    (return (call $page_result (local.get $tp) (i32.const ${STATUS.backing}) (i32.const 0)))))
  (local.set $te (i32.load (local.get $tp)))
  (if (i32.eqz (i32.and (local.get $te) (i32.const 1))) (then
    (return (call $page_result (local.get $linear) (i32.const ${STATUS.notPresent}) (local.get $error)))))
  ;; 386 supervisor writes ignore R/W (there is no 486 CR0.WP contract here).
  ;; User access requires U/S at BOTH levels, and a write requires both R/W.
  (if (i32.and (local.get $user)
    (i32.or (i32.eqz (i32.and (i32.and (local.get $de) (local.get $te)) (i32.const 4)))
      (i32.and (local.get $write)
        (i32.eqz (i32.and (i32.and (local.get $de) (local.get $te)) (i32.const 2)))))) (then
    (return (call $page_result (local.get $linear) (i32.const ${STATUS.protection})
      (i32.or (local.get $error) (i32.const 1))))))
  (local.set $p (call $page_bus
    (i32.or (i32.and (local.get $te) (i32.const 0xfffff000))
      (i32.and (local.get $linear) (i32.const 0xfff))) (local.get $a20)))
  (if (i32.ge_u (local.get $p) (i32.const ${isa.GUEST_RAM_SIZE})) (then
    (return (call $page_result (local.get $p) (i32.const ${STATUS.backing}) (i32.const 0)))))
  ;; Only successful translations promise A/D updates. The PRM does not define
  ;; their precise state for failed translations; never clear software bits.
  ;; Snapshot both entries before either write: recursive directories can make
  ;; dp == tp. OR the dirty update last so it cannot be overwritten.
  (i32.store (local.get $dp) (i32.or (local.get $de) (i32.const 0x20)))
  (i32.store (local.get $tp) (i32.or (local.get $te)
    (select (i32.const 0x60) (i32.const 0x20) (local.get $write))))
  (call $page_result (local.get $p) (i32.const ${STATUS.ok}) (i32.const 0)))
`;
  if (!physicalBus) return wat;
  // Retain the independently tested walker while routing production paging
  // structures through the same physical RAM/device bus as guest accesses.
  return wat.replace(/\(i32.or \(i32.lt_u \(local.get \$p\) \(i32.const 0xa0000\)\)\s*\(i32.ge_u \(local.get \$p\) \(i32.const 0xc0000\)\)\)/,
    '(i32.const 1)')
    .replace(/\(i32.load \(local.get \$(dp|tp)\)\)/g, '(call $page_phys_read (local.get $$$1))')
    .replace(/\(i32.store \(local.get \$(dp|tp)\)/g, '(call $page_phys_write (local.get $$$1)') + `
(func $page_phys_read (param $p i32) (result i32)
  (i32.or (i32.or (call $rd8phys (local.get $p))
    (i32.shl (call $rd8phys (i32.add (local.get $p) (i32.const 1))) (i32.const 8)))
    (i32.or (i32.shl (call $rd8phys (i32.add (local.get $p) (i32.const 2))) (i32.const 16))
      (i32.shl (call $rd8phys (i32.add (local.get $p) (i32.const 3))) (i32.const 24)))))
(func $page_phys_write (param $p i32) (param $v i32)
  (call $wr8phys (local.get $p) (local.get $v))
  (call $wr8phys (i32.add (local.get $p) (i32.const 1)) (i32.shr_u (local.get $v) (i32.const 8)))
  (call $wr8phys (i32.add (local.get $p) (i32.const 2)) (i32.shr_u (local.get $v) (i32.const 16)))
  (call $wr8phys (i32.add (local.get $p) (i32.const 3)) (i32.shr_u (local.get $v) (i32.const 24))))
`;
}

function unpack(result) {
  const tag = Number(result >> 32n) >>> 0;
  return { status: tag & 255, error: tag >>> 8, address: Number(result & 0xffffffffn) };
}

// A checked accessor aborts the WASM invocation, rather than returning a dummy
// address that a caller could accidentally dereference. The host distinguishes
// this architectural unwind from unrelated traps using pg_pending.
function runtime(isa, state, fpu) {
  const regs = [...new Set(state)].filter(x => !isa.REG16.includes(x) && !isa.SEG.includes(x)
    && !['esb', 'csb', 'ssb', 'dsb', 'fsb', 'gsb'].includes(x));
  const saved = regs.map(x => [x, 'i32']).concat(fpu.map(x => [x, 'f64']));
  return `
(global $pg_pending (mut i32) (i32.const 0))
(global $pg_bus_address (mut i32) (i32.const 0))
(global $pg_authorized (mut i32) (i32.const 0))
(global $pg_epoch (mut i32) (i32.const 0))
(global $pg_vector (mut i32) (i32.const -1))
(global $pg_return (mut i32) (i32.const 0))
(global $pg_undo_n (mut i32) (i32.const 0))
${saved.map(([x,t]) => `(global $pg_save_${x} (mut ${t}) (${t}.const 0))`).join('\n')}
(func $pg_on (result i32) (i32.lt_s (global.get $cr0) (i32.const 0)))
(func $pg_linear_mask (result i32)
  (select (i32.const -1) (global.get $linmask) (call $pg_on)))
(func $pg_user (result i32)
  (i32.or (global.get $vm86) (i32.eq (i32.and (call $sget (i32.const 1)) (i32.const 3)) (i32.const 3))))
(func $pg_checkpoint (export "pg_checkpoint")
  (global.set $pg_undo_n (i32.const 0))
  (memory.copy (i32.const ${isa.PAGE_REG_SAVE}) (i32.const ${isa.REGFILE_SEL}) (i32.const ${isa.REGFILE_SIZE}))
  (memory.copy (i32.const ${isa.PAGE_CTL_SAVE}) (i32.const ${isa.VGA_CTL}) (i32.const 0x100))
  ${saved.map(([x]) => `(global.set $pg_save_${x} (global.get $${x}))`).join('\n  ')})
(func $pg_rollback (export "pg_rollback")
  (local $p i32)
  (block $done (loop $undo
    (br_if $done (i32.eqz (global.get $pg_undo_n)))
    (global.set $pg_undo_n (i32.sub (global.get $pg_undo_n) (i32.const 8)))
    (local.set $p (i32.add (i32.const ${isa.PAGE_UNDO_BASE}) (global.get $pg_undo_n)))
    (i32.store8 (i32.load (local.get $p)) (i32.load offset=4 (local.get $p)))
    (br $undo)))
  (memory.copy (i32.const ${isa.REGFILE_SEL}) (i32.const ${isa.PAGE_REG_SAVE}) (i32.const ${isa.REGFILE_SIZE}))
  (memory.copy (i32.const ${isa.VGA_CTL}) (i32.const ${isa.PAGE_CTL_SAVE}) (i32.const 0x100))
  ${saved.map(([x]) => `(global.set $${x} (global.get $pg_save_${x}))`).join('\n  ')})
(func $pg_address (export "pg_probe") (param $linear i32) (param $write i32) (param $user i32) (result i32)
  (local $r i64) (local $tag i32)
  (if (i32.eqz (call $pg_on)) (then
    (return (i32.and (local.get $linear) (global.get $linmask)))))
  (local.set $r (call $page_translate (global.get $cr3) (local.get $linear)
    (local.get $write) (local.get $user)
    (i32.ne (global.get $linmask) (i32.const 0xfffff))))
  (local.set $tag (i32.wrap_i64 (i64.shr_u (local.get $r) (i64.const 32))))
  (if (local.get $tag) (then
    (call $pg_rollback)
    (global.set $pg_pending (i32.and (local.get $tag) (i32.const 255)))
    (if (i32.eq (global.get $pg_pending) (i32.const 3))
      (then (global.set $pg_bus_address (i32.wrap_i64 (local.get $r))))
      (else (global.set $cr2 (local.get $linear))))
    (global.set $errc (i32.shr_u (local.get $tag) (i32.const 8)))
    (unreachable)))
  (i32.wrap_i64 (local.get $r)))
(func (export "pg_pending") (result i32) (global.get $pg_pending))
(func (export "pg_bus_address") (result i32) (global.get $pg_bus_address))
(func (export "pg_epoch") (result i32) (global.get $pg_epoch))
(func (export "pg_vector") (result i32) (global.get $pg_vector))
(func (export "pg_return") (result i32) (global.get $pg_return))
(func (export "pg_error") (result i32) (global.get $errc))
(func (export "pg_set_error") (param $v i32) (global.set $errc (local.get $v)))
(func (export "pg_flags") (result i32) (call $flags_word))
(func (export "pg_set_flags") (param $v i32) (call $flags_put (local.get $v)))
(func (export "pg_phys_write") (param $p i32) (param $v i32) (call $wr8phys (local.get $p) (local.get $v)))
(func (export "pg_authorize") (param $v i32) (global.set $pg_authorized (local.get $v)))
(func (export "pg_reset_vector") (global.set $pg_vector (i32.const -1)))
(func (export "pg_clear") (global.set $pg_pending (i32.const 0)))
;; Task-installed caches are authoritative, including null data selectors.
;; Optimized/base-only accessors cannot enter paging; reached interpreter
;; memory operations retain a segment index and check before translation.
(func $pg_segment (param $s i32) (param $off i32) (param $n i32) (param $write i32)
  (local $valid i32) (local $limit i32) (local $access i32) (local $mask i32)
  (local $bad i32) (local $end i64)
  (if (i32.or (i32.eqz (global.get $pm_task_segments)) (global.get $vm86)) (then (return)))
  ${isa.SEG.map((s, i) => `(if (i32.eq (local.get $s) (i32.const ${i})) (then
    (local.set $valid (global.get $pm_${s}_valid))
    (local.set $limit (global.get $pm_${s}_limit))
    (local.set $access (global.get $pm_${s}_access))
    (local.set $mask ${s === 'ss' ? '(global.get $spm)' : s === 'cs' ? '(i32.const -1)' : `(global.get $pm_${s}_mask)`})))`).join('\n  ')}
  (local.set $bad (i32.eqz (local.get $valid)))
  (if (local.get $write)
    (then (local.set $bad (i32.or (local.get $bad)
      (i32.ne (i32.and (local.get $access) (i32.const 26)) (i32.const 18)))))
    (else (if (i32.and (i32.ne (i32.and (local.get $access) (i32.const 8)) (i32.const 0))
      (i32.eqz (i32.and (local.get $access) (i32.const 2)))) (then (local.set $bad (i32.const 1))))))
  (local.set $end (i64.sub (i64.add (i64.extend_i32_u (local.get $off)) (i64.extend_i32_u (local.get $n))) (i64.const 1)))
  (if (i32.and (i32.eqz (i32.and (local.get $access) (i32.const 8)))
      (i32.ne (i32.and (local.get $access) (i32.const 4)) (i32.const 0)))
    (then (local.set $bad (i32.or (local.get $bad)
      (i32.or (i32.le_u (local.get $off) (local.get $limit))
        (i64.gt_u (local.get $end) (i64.extend_i32_u (local.get $mask)))))))
    (else (local.set $bad (i32.or (local.get $bad)
      (i64.gt_u (local.get $end) (i64.extend_i32_u (local.get $limit)))))))
  (if (local.get $bad) (then
    (call $pg_rollback)
    (global.set $pg_pending (i32.const 4))
    (global.set $pg_vector (select (i32.const 12) (i32.const 13) (i32.eq (local.get $s) (i32.const 2))))
    (global.set $errc (i32.const 0))
    (unreachable))))
(func $pg_read (export "pg_read") (param $linear i32) (param $n i32) (param $user i32) (result i32)
  (local $i i32) (local $v i32) (local $p i32)
  (loop $byte
    (local.set $p (call $pg_address (i32.add (local.get $linear) (local.get $i)) (i32.const 0) (local.get $user)))
    (local.set $v (i32.or (local.get $v) (i32.shl
      (call $rd8phys (local.get $p)) (i32.shl (local.get $i) (i32.const 3)))))
    (local.set $i (i32.add (local.get $i) (i32.const 1)))
    (br_if $byte (i32.lt_u (local.get $i) (local.get $n))))
  (local.get $v))
(func $pg_log_byte (param $p i32) (local $j i32)
  (if (i32.ge_u (global.get $pg_undo_n) (i32.const ${isa.PAGE_UNDO_SIZE})) (then (unreachable)))
  (local.set $j (i32.add (i32.const ${isa.PAGE_UNDO_BASE}) (global.get $pg_undo_n)))
  (i32.store (local.get $j) (local.get $p))
  (i32.store offset=4 (local.get $j) (i32.load8_u (local.get $p)))
  (global.set $pg_undo_n (i32.add (global.get $pg_undo_n) (i32.const 8))))
(func $pg_log_physical (param $p i32)
  ;; Journal backing bytes directly: an extra VGA bus read would change the
  ;; latch which the real guest write is about to consume.
  (if (i32.eq (i32.or (i32.and (local.get $p) (i32.const 0xfff0000)) (i32.const 1))
      (i32.load (i32.const ${isa.VGA_CTL_KEY})))
    (then ${[0,1,2,3].map(i => `(call $pg_log_byte (call $vga_plane (i32.const ${i}) (local.get $p)))`).join('\n      ')})
    (else (call $pg_log_byte (local.get $p)))))
(func $pg_write (export "pg_write") (param $linear i32) (param $n i32) (param $v i32) (param $user i32)
  (local $i i32) (local $p i32) (local $p0 i32) (local $p1 i32) (local $p2 i32) (local $p3 i32)
  (if (i32.or (i32.eqz (local.get $n)) (i32.gt_u (local.get $n) (i32.const 4))) (then (unreachable)))
  ;; Preflight every byte before publishing any part of a scalar write.
  ;; Freeze these physical addresses: a store can overwrite its own PTE.
  (loop $check
    (local.set $p (call $pg_address (i32.add (local.get $linear) (local.get $i)) (i32.const 1) (local.get $user)))
    ${[0,1,2,3].map(i => `(if (i32.eq (local.get $i) (i32.const ${i})) (then (local.set $p${i} (local.get $p))))`).join('\n    ')}
    (local.set $i (i32.add (local.get $i) (i32.const 1)))
    (br_if $check (i32.lt_u (local.get $i) (local.get $n))))
  (local.set $i (i32.const 0))
  (loop $byte
    (local.set $p (select (local.get $p0)
      (select (local.get $p1) (select (local.get $p2) (local.get $p3)
        (i32.eq (local.get $i) (i32.const 2))) (i32.eq (local.get $i) (i32.const 1)))
      (i32.eqz (local.get $i))))
    (call $pg_log_physical (local.get $p))
    (call $wr8phys (local.get $p) (i32.shr_u (local.get $v) (i32.shl (local.get $i) (i32.const 3))))
    (local.set $i (i32.add (local.get $i) (i32.const 1)))
    (br_if $byte (i32.lt_u (local.get $i) (local.get $n)))))
`;
}

// Replace linear system-memory loads in the named helper functions. Walk
// balanced expressions so nested addresses and offset immediates are preserved.
function systemLoads(wat, names, isa) {
  const endOf = (s, start) => {
    let depth = 0;
    for (let i = start; i < s.length; i++) {
      if (s[i] === ';' && s[i + 1] === ';') { i = s.indexOf('\n', i); if (i < 0) break; continue; }
      if (s[i] === '(') depth++;
      if (s[i] === ')' && --depth === 0) return i + 1;
    }
    throw Error('unbalanced system accessor');
  };
  return wat.replace(/\(func \$([\w.]+)\b/g, (m) => m) // names are selected below
    .split(/(?=\(func \$)/).map(part => {
      const name = /^\(func \$([\w.]+)/.exec(part)?.[1];
      if (!name || !names(name)) return part;
      const end = endOf(part, 0);
      let body = part.slice(0, end);
      body = body.replace(/\(global.get \$linmask\)/g, '(call $pg_linear_mask)');
      let out = '', pos = 0;
      const re = /\(i32.load(8_u|16_u)?\s+/g;
      for (let m; (m = re.exec(body));) {
        const finish = endOf(body, m.index);
        const expression = body.slice(m.index, finish);
        const header = /^\(i32.load(?:8_u|16_u)?\s+(?:offset=(\d+)\s+)?/.exec(expression);
        const addr = expression.slice(header[0].length, -1);
        // Loads of the private register file are never guest-linear accesses.
        if (addr.includes(`i32.const ${isa.REGFILE_SEL}`) || addr.includes(`i32.const ${isa.REGFILE_SEGB}`)) continue;
        const address = header[1] ? `(i32.add ${addr} (i32.const ${header[1]}))` : addr;
        out += body.slice(pos, m.index) + `(call $pg_read ${address} (i32.const ${m[1] === '8_u' ? 1 : m[1] === '16_u' ? 2 : 4}) ${name === 'pm_read' ? '(call $pg_user)' : '(i32.const 0)'})`;
        pos = finish; re.lastIndex = finish;
      }
      return out + body.slice(pos) + part.slice(end);
    }).join('');
}

module.exports = { STATUS, helpers, unpack, runtime, systemLoads };
