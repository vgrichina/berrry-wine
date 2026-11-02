'use strict';

// Protected CALL gates and far returns. Kept separate from the permissive
// real/unreal-mode selector arithmetic in emit.js. These helpers validate the
// complete operation before changing a guest register or stack byte.
//
// Exception delivery is NOT implemented here: the ordinary PM $fault path does
// not yet build privilege-changing/error-code frames. A rejected transfer is
// therefore an explicit host-visible unsupported stop, not a delivered #GP,
// #SS, #NP or #TS. Nor does this add paging: it uses the existing linear RAM
// model and refuses wrapped/unmapped metadata and stacks.
const STOP = Object.freeze({ descriptor: 1, type: 2, privilege: 3, notPresent: 4,
  targetLimit: 5, stack: 6, tss: 7, cachedStack: 8, unsupportedSystem: 9, mapping: 10 });

function helpers(isa) {
  // Parameters are staged in locals before any stack write, including when
  // the old and new stack memory overlap. A call gate has at most 31 items.
  const params = Array.from({ length: 31 }, (_, i) => i);
  const readParams = params.map(i => `
  (if (i32.gt_u (local.get $count) (i32.const ${i}))
    (then (local.set $p${i} (call $pm_read (local.get $width)
      (i32.add (global.get $sp) (i32.mul (i32.const ${i}) (local.get $width)))))))`).join('');
  const pushParams = [...params].reverse().map(i => `
  (if (i32.gt_u (local.get $count) (i32.const ${i}))
    (then (call $pm_push (local.get $width) (local.get $p${i}))))`).join('');
  const dataSegments = [[0, 'es'], [3, 'ds'], [4, 'fs'], [5, 'gs']];
  // Intel SDM RET pseudocode uses DPL in the hidden segment-register cache.
  // Never consult a subsequently modified descriptor table during outer RETF.
  const dataCache = dataSegments.map(([index, name]) => `
  (if (i32.eq (local.get $i) (i32.const ${index})) (then
    (global.set $pm_${name}_valid (i32.const 0))
    (if (i32.eqz (call $pm_active)) (then (return)))
    (local.set $d (call $pm_desc (local.get $selector)))
    (if (i32.eqz (local.get $d)) (then (return)))
    (local.set $d (i32.sub (local.get $d) (i32.const 1)))
    (if (i32.ne (call $pm_base (local.get $d)) (call $sbase (local.get $i))) (then (return)))
    (local.set $a (i32.load8_u offset=5 (local.get $d)))
    (if (i32.ne (i32.and (local.get $a) (i32.const 144)) (i32.const 144)) (then (return)))
    (if (i32.and (i32.ne (i32.and (local.get $a) (i32.const 8)) (i32.const 0))
      (i32.eqz (i32.and (local.get $a) (i32.const 2)))) (then (return)))
    (global.set $pm_${name}_access (local.get $a))
    (global.set $pm_${name}_valid (i32.const 1))))`).join('');
  const clearData = dataSegments.map(([index, name]) => `
  (local.set $a (global.get $pm_${name}_access))
  (local.set $bad (i32.eqz (global.get $pm_${name}_valid)))
  (if (i32.ne (i32.and (local.get $a) (i32.const 12)) (i32.const 12))
    (then (local.set $bad (i32.or (local.get $bad)
      (i32.lt_u (i32.and (i32.shr_u (local.get $a) (i32.const 5)) (i32.const 3)) (local.get $level))))))
  (if (local.get $bad) (then
    (i32.store (i32.const ${isa.REGFILE_SEL + index * 4}) (i32.const 0))
    (i32.store (i32.const ${isa.REGFILE_SEGB + index * 4}) (i32.const 0))
    (global.set $pm_${name}_valid (i32.const 0))))`).join('');
  return `
;; A stop is deliberately separate from architectural exception delivery.
(func $pm_stop (param $why i32) (param $selector i32) (result i32)
  (global.set $pm_xfer_stop (local.get $why))
  (global.set $pm_xfer_sel (i32.and (local.get $selector) (i32.const 65535)))
  (global.set $exitwhy (i32.const 12))
  (global.set $left (global.get $steps))
  (global.set $halt (i32.const 1))
  (i32.const 1))

(func $pm_active (result i32)
  (i32.and (i32.and (global.get $cr0) (i32.const 1))
    (i32.eqz (global.get $vm86))))

;; No integer wrap, no A20 alias and no host/internal memory. Descriptor/TSS
;; reads are ordinary RAM only. Video apertures require device semantics and
;; are outside this helper's supported metadata/stack contract.
(func $pm_ram (param $p i32) (param $n i32) (result i32)
  (local $end i64) (local $i i32)
  (if (call $pg_on) (then
    (loop $page
      (drop (call $pg_address (i32.add (local.get $p) (local.get $i)) (i32.const 0) (i32.const 0)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $page (i32.lt_u (local.get $i) (local.get $n))))
    (return (i32.const 1))))
  (local.set $end (i64.add (i64.extend_i32_u (local.get $p))
    (i64.extend_i32_u (local.get $n))))
  (i32.and
    (i32.and (i64.le_u (local.get $end) (i64.const ${isa.GUEST_RAM_SIZE}))
      (i64.le_u (local.get $end)
        (i64.add (i64.extend_i32_u (global.get $linmask)) (i64.const 1))))
    (i32.or (i64.le_u (local.get $end) (i64.const 655360))
      (i32.ge_u (local.get $p) (i32.const 786432)))))

(func $pm_base (param $d i32) (result i32)
  (i32.or (i32.load16_u offset=2 (local.get $d))
    (i32.or (i32.shl (i32.load8_u offset=4 (local.get $d)) (i32.const 16))
      (i32.shl (i32.load8_u offset=7 (local.get $d)) (i32.const 24)))))
(func $pm_limit (param $d i32) (result i32) (local $v i32)
  (local.set $v (i32.or (i32.load16_u (local.get $d))
    (i32.shl (i32.and (i32.load8_u offset=6 (local.get $d)) (i32.const 15)) (i32.const 16))))
  (if (result i32) (i32.and (i32.load8_u offset=6 (local.get $d)) (i32.const 128))
    (then (i32.or (i32.shl (local.get $v) (i32.const 12)) (i32.const 4095)))
    (else (local.get $v))))
(func $pm_mask (param $d i32) (result i32)
  (select (i32.const -1) (i32.const 65535)
    (i32.and (i32.load8_u offset=6 (local.get $d)) (i32.const 64))))
(func $pm_code_mapped (param $d i32) (param $off i32) (result i32) (local $p i64)
  (local.set $p (i64.add (i64.extend_i32_u (call $pm_base (local.get $d))) (i64.extend_i32_u (local.get $off))))
  (if (i64.gt_u (local.get $p) (i64.const 4294967295)) (then (return (i32.const 0))))
  (call $pm_ram (i32.wrap_i64 (local.get $p)) (i32.const 1)))

;; Address+1, or zero. The full eight bytes must fit the appropriate table.
;; LDT bounds/access are cached by LLDT, not reread from a mutable GDT entry.
(func $pm_gdt (param $s i32) (result i32) (local $i i32) (local $p i32)
  (local.set $i (i32.and (local.get $s) (i32.const 65528)))
  (if (i32.or (i32.eqz (local.get $i)) (i32.and (local.get $s) (i32.const 4)))
    (then (return (i32.const 0))))
  (if (i32.gt_u (i32.add (local.get $i) (i32.const 7)) (global.get $gdtl))
    (then (return (i32.const 0))))
  (local.set $p (i32.add (global.get $gdtb) (local.get $i)))
  (if (i32.or (i32.lt_u (local.get $p) (global.get $gdtb))
    (i32.eqz (call $pm_ram (local.get $p) (i32.const 8))))
    (then (return (i32.const 0))))
  (i32.add (local.get $p) (i32.const 1)))
(func $pm_desc (param $s i32) (result i32)
  (local $i i32) (local $p i32)
  (if (i32.eqz (i32.and (local.get $s) (i32.const 4)))
    (then (return (call $pm_gdt (local.get $s)))))
  (if (i32.or
    (i32.eqz (global.get $pm_ldt_valid))
    (i32.ne (i32.and (global.get $pm_ldt_access) (i32.const 159)) (i32.const 130)))
    (then (return (i32.const 0))))
  (local.set $i (i32.and (local.get $s) (i32.const 65528)))
  (if (i32.gt_u (i32.add (local.get $i) (i32.const 7)) (global.get $pm_ldt_limit))
    (then (return (i32.const 0))))
  (local.set $p (i32.add (global.get $ldtb) (local.get $i)))
  (if (i32.or (i32.lt_u (local.get $p) (global.get $ldtb))
    (i32.eqz (call $pm_ram (local.get $p) (i32.const 8))))
    (then (return (i32.const 0))))
  (i32.add (local.get $p) (i32.const 1)))
(func $pm_cache_ldt (param $selector i32) (local $d i32)
  (global.set $pm_ldt_valid (i32.const 0))
  (if (i32.eqz (call $pm_active)) (then (return)))
  (local.set $d (call $pm_gdt (local.get $selector)))
  (if (i32.eqz (local.get $d)) (then (return)))
  (local.set $d (i32.sub (local.get $d) (i32.const 1)))
  (if (i32.ne (call $pm_base (local.get $d)) (global.get $ldtb)) (then (return)))
  (global.set $pm_ldt_limit (call $pm_limit (local.get $d)))
  (global.set $pm_ldt_access (i32.load8_u offset=5 (local.get $d)))
  (global.set $pm_ldt_valid (i32.const 1)))

;; Stack access validation, including expand-down bounds and B-bit upper end.
;; No access may straddle the top of the segment or wrap its linear address.
(func $pm_span (param $base i32) (param $limit i32) (param $mask i32) (param $access i32) (param $off i32) (param $n i32) (result i32)
  (local $end i64) (local $linear i64)
  (local.set $end (i64.add (i64.extend_i32_u (local.get $off)) (i64.extend_i32_u (local.get $n))))
  (if (i64.gt_u (local.get $end)
    (i64.add (i64.extend_i32_u (local.get $mask)) (i64.const 1)))
    (then (return (i32.const 0))))
  (if (i32.and (local.get $access) (i32.const 4))
    (then (if (i32.le_u (local.get $off) (local.get $limit))
      (then (return (i32.const 0)))))
    (else (if (i64.gt_u (local.get $end)
      (i64.add (i64.extend_i32_u (local.get $limit)) (i64.const 1)))
      (then (return (i32.const 0))))))
  (local.set $linear (i64.add (i64.extend_i32_u (local.get $base))
    (i64.extend_i32_u (local.get $off))))
  (if (i64.gt_u (local.get $linear) (i64.const 4294967295)) (then (return (i32.const 0))))
  (call $pm_ram (i32.wrap_i64 (local.get $linear)) (local.get $n)))
(func $pm_stack_span (param $d i32) (param $off i32) (param $n i32) (result i32)
  (call $pm_span (call $pm_base (local.get $d)) (call $pm_limit (local.get $d))
    (call $pm_mask (local.get $d)) (i32.load8_u offset=5 (local.get $d)) (local.get $off) (local.get $n)))
(func $pm_current_span (param $off i32) (param $n i32) (result i32)
  (call $pm_span (call $sbase (i32.const 2)) (global.get $pm_ss_limit)
    (global.get $spm) (global.get $pm_ss_access)
    (i32.and (local.get $off) (global.get $spm)) (local.get $n)))

;; SS access/limit are captured on load. A later descriptor-table write must
;; not retroactively change the loaded segment's limits or access rights.
(func $pm_cache_ss (param $selector i32) (local $d i32)
  (global.set $pm_ss_valid (i32.const 0))
  (if (i32.eqz (call $pm_active)) (then (return)))
  (local.set $d (call $pm_desc (local.get $selector)))
  (if (i32.eqz (local.get $d)) (then (return)))
  (local.set $d (i32.sub (local.get $d) (i32.const 1)))
  (if (i32.or (i32.ne (call $pm_base (local.get $d)) (call $sbase (i32.const 2)))
    (i32.ne (call $pm_mask (local.get $d)) (global.get $spm))) (then (return)))
  (global.set $pm_ss_limit (call $pm_limit (local.get $d)))
  (global.set $pm_ss_access (i32.load8_u offset=5 (local.get $d)))
  (global.set $pm_ss_valid (i32.const 1)))
(func $pm_cache_tr (param $selector i32) (local $d i32)
  (global.set $pm_tr_valid (i32.const 0))
  (if (i32.eqz (call $pm_active)) (then (return)))
  (local.set $d (call $pm_gdt (local.get $selector)))
  (if (i32.eqz (local.get $d)) (then (return)))
  (local.set $d (i32.sub (local.get $d) (i32.const 1)))
  (global.set $pm_tr_base (call $pm_base (local.get $d)))
  (global.set $pm_tr_limit (call $pm_limit (local.get $d)))
  (global.set $pm_tr_access (i32.load8_u offset=5 (local.get $d)))
  (global.set $pm_tr_valid (i32.const 1)))

;; Intel 80386 PRM, LTR: load an AVAILABLE TSS and mark it busy. This is
;; initialization of TR, not a task switch: no TSS field, CR3, NT or TS changes.
;; Paged execution can deliver faults; nonpaged protected exception delivery
;; retains the explicit pm_stop contract above. Never use that permissive
;; cache-only operation as the guest LTR instruction.
(func $pm_ltr_reject (param $vector i32) (param $selector i32) (param $why i32) (result i32)
  (if (call $pg_on)
    (then
      (global.set $errc (i32.and (local.get $selector) (i32.const 65532)))
      (call $fault (local.get $vector) (global.get $gip)))
    (else (drop (call $pm_stop (local.get $why) (local.get $selector)))))
  (i32.const 1))
(func $pm_ltr_priv (result i32)
  (if (i32.or (i32.eqz (i32.and (global.get $cr0) (i32.const 1))) (global.get $vm86))
    (then (return (call $pm_ltr_reject (i32.const 6) (i32.const 0) (i32.const ${STOP.unsupportedSystem})))))
  (if (i32.and (call $sget (i32.const 1)) (i32.const 3))
    (then (return (call $pm_ltr_reject (i32.const 13) (i32.const 0) (i32.const ${STOP.privilege})))))
  (i32.const 0))
(func $pm_ltr (param $selector i32) (result i32)
  (local $d i32) (local $a i32) (local $base i32) (local $limit i32)
  (local.set $selector (i32.and (local.get $selector) (i32.const 65535)))
  (if (i32.or (i32.eqz (i32.and (local.get $selector) (i32.const 65528)))
      (i32.or (i32.and (local.get $selector) (i32.const 4))
        (i32.gt_u (i32.add (i32.and (local.get $selector) (i32.const 65528)) (i32.const 7)) (global.get $gdtl))))
    (then (return (call $pm_ltr_reject (i32.const 13) (local.get $selector) (i32.const ${STOP.descriptor})))))
  (local.set $d (call $pm_gdt (local.get $selector)))
  (if (i32.eqz (local.get $d))
    (then (return (call $pm_stop (i32.const ${STOP.mapping}) (local.get $selector)))))
  (local.set $d (i32.sub (local.get $d) (i32.const 1)))
  (local.set $a (i32.load8_u offset=5 (local.get $d)))
  ;; Type is checked before P; descriptor DPL and selector RPL do not restrict
  ;; privileged LTR. Both available 286 (1) and 386 (9) TSS types are legal.
  (if (i32.and (i32.ne (i32.and (local.get $a) (i32.const 31)) (i32.const 1))
               (i32.ne (i32.and (local.get $a) (i32.const 31)) (i32.const 9)))
    (then (return (call $pm_ltr_reject (i32.const 13) (local.get $selector) (i32.const ${STOP.type})))))
  (if (i32.eqz (i32.and (local.get $a) (i32.const 128)))
    (then (return (call $pm_ltr_reject (i32.const 11) (local.get $selector) (i32.const ${STOP.notPresent})))))
  ;; LTR does not validate the task-switch minimum TSS limit or read the TSS.
  ;; Stage the complete hidden cache before any descriptor write (which can
  ;; alias a page table); publish TR only after the busy write succeeds.
  (local.set $base (call $pm_base (local.get $d)))
  (local.set $limit (call $pm_limit (local.get $d)))
  (local.set $a (i32.or (local.get $a) (i32.const 2)))
  (if (call $pg_on)
    (then (call $pg_write (i32.add (local.get $d) (i32.const 5)) (i32.const 1) (local.get $a) (i32.const 0)))
    (else (i32.store8 offset=5 (local.get $d) (local.get $a))))
  (global.set $tr (local.get $selector))
  (global.set $pm_tr_base (local.get $base))
  (global.set $pm_tr_limit (local.get $limit))
  (global.set $pm_tr_access (local.get $a))
  (global.set $pm_tr_valid (i32.const 1))
  (i32.const 0))
(func $pm_current_stack (result i32)
  (if (i32.or (i32.eqz (global.get $pm_ss_valid))
    (i32.ne (i32.and (global.get $pm_ss_access) (i32.const 154)) (i32.const 146)))
    (then (return (i32.const 0))))
  (if (i32.or
    (i32.ne (i32.and (call $sget (i32.const 2)) (i32.const 3))
      (i32.and (call $sget (i32.const 1)) (i32.const 3)))
    (i32.ne (i32.and (i32.shr_u (global.get $pm_ss_access) (i32.const 5)) (i32.const 3))
      (i32.and (call $sget (i32.const 1)) (i32.const 3))))
    (then (return (i32.const 0))))
  (i32.const 1))

;; Load a descriptor already validated by this operation. Do not call $sset's
;; permissive GDT-limit/real-mode fallback for an LDT or protected transfer.
(func $pm_load (param $index i32) (param $selector i32) (param $d i32)
  (i32.store (i32.add (i32.const ${isa.REGFILE_SEL}) (i32.shl (local.get $index) (i32.const 2))) (local.get $selector))
  (i32.store (i32.add (i32.const ${isa.REGFILE_SEGB}) (i32.shl (local.get $index) (i32.const 2))) (call $pm_base (local.get $d)))
  (if (i32.eq (local.get $index) (i32.const 1))
    (then (global.set $d32 (i32.and (i32.shr_u (i32.load8_u offset=6 (local.get $d)) (i32.const 6)) (i32.const 1)))))
  (if (i32.eq (local.get $index) (i32.const 2))
    (then
      (global.set $spm (call $pm_mask (local.get $d)))
      (global.set $pm_ss_limit (call $pm_limit (local.get $d)))
      (global.set $pm_ss_access (i32.load8_u offset=5 (local.get $d)))
      (global.set $pm_ss_valid (i32.const 1))))
  (if (call $pg_on)
    (then (call $pg_write (i32.add (local.get $d) (i32.const 5)) (i32.const 1)
      (i32.or (i32.load8_u offset=5 (local.get $d)) (i32.const 1)) (i32.const 0)))
    (else (call $wr8b (i32.const 0) (i32.add (local.get $d) (i32.const 5))
      (i32.or (i32.load8_u offset=5 (local.get $d)) (i32.const 1))))))
(func $pm_read (param $w i32) (param $off i32) (result i32)
  ;; All reads were preflighted as ordinary RAM. Do not use $off_add's
  ;; historical 64KiB-page wrap for a dword on a 32-bit stack boundary.
  (local.set $off (i32.add (call $sbase (i32.const 2)) (i32.and (local.get $off) (global.get $spm))))
  (if (result i32) (i32.eq (local.get $w) (i32.const 4))
    (then (i32.load (local.get $off)))
    (else (i32.load16_u (local.get $off)))))
(func $pm_push (param $w i32) (param $v i32) (local $off i32) (local $i i32)
  (local.set $off (i32.and (i32.sub (global.get $sp) (local.get $w)) (global.get $spm)))
  (global.set $sp (i32.or (i32.and (global.get $sp) (i32.xor (global.get $spm) (i32.const -1))) (local.get $off)))
  (local.set $off (i32.add (call $sbase (i32.const 2)) (local.get $off)))
  ;; Byte writes preserve the real SMC invalidation path without page-wrap.
  (loop $byte
    (call $wr8b (i32.const 0) (i32.add (local.get $off) (local.get $i))
      (i32.shr_u (local.get $v) (i32.shl (local.get $i) (i32.const 3))))
    (local.set $i (i32.add (local.get $i) (i32.const 1)))
    (br_if $byte (i32.lt_u (local.get $i) (local.get $w)))))
(func $pm_advance_sp (param $sp i32) (param $n i32) (result i32)
  (i32.or (i32.and (local.get $sp) (i32.xor (global.get $spm) (i32.const -1)))
    (i32.and (i32.add (local.get $sp) (local.get $n)) (global.get $spm))))

;; Return zero only for real/VM86 or an ordinary code descriptor; the existing
;; direct-code CALL path handles those unchanged. One means handled or stopped.
(func $pm_call_gate (param $selector i32) (param $next i32) (result i32)
  (local $gate i32) (local $code i32) (local $access i32) (local $kind i32)
  (local $cpl i32) (local $level i32) (local $target i32) (local $offset i32)
  (local $width i32) (local $count i32) (local $newstack i32)
  (local $oldcs i32) (local $oldss i32) (local $oldsp i32)
  (local $newss i32) (local $newsp i32) (local $frame i32) (local $p i32) (local $stackoff i32)
  ${params.map(i => `(local $p${i} i32)`).join(' ')}
  (if (i32.eqz (call $pm_active)) (then (return (i32.const 0))))
  (local.set $gate (call $pm_desc (local.get $selector)))
  (if (i32.eqz (local.get $gate)) (then (return (call $pm_stop (i32.const ${STOP.descriptor}) (local.get $selector)))))
  (local.set $gate (i32.sub (local.get $gate) (i32.const 1)))
  (local.set $access (i32.load8_u offset=5 (local.get $gate)))
  (if (i32.eq (i32.and (local.get $access) (i32.const 24)) (i32.const 24))
    (then (return (i32.const 0))))
  (local.set $kind (i32.and (local.get $access) (i32.const 31)))
  (if (i32.and (i32.ne (local.get $kind) (i32.const 4)) (i32.ne (local.get $kind) (i32.const 12)))
    (then (return (call $pm_stop (i32.const ${STOP.unsupportedSystem}) (local.get $selector)))))
  (local.set $oldcs (call $sget (i32.const 1)))
  (local.set $oldss (call $sget (i32.const 2)))
  (local.set $oldsp (global.get $sp))
  (local.set $cpl (i32.and (local.get $oldcs) (i32.const 3)))
  (local.set $level (i32.and (i32.shr_u (local.get $access) (i32.const 5)) (i32.const 3)))
  (if (i32.or (i32.gt_u (local.get $cpl) (local.get $level))
    (i32.gt_u (i32.and (local.get $selector) (i32.const 3)) (local.get $level)))
    (then (return (call $pm_stop (i32.const ${STOP.privilege}) (local.get $selector)))))
  (if (i32.eqz (i32.and (local.get $access) (i32.const 128)))
    (then (return (call $pm_stop (i32.const ${STOP.notPresent}) (local.get $selector)))))
  (local.set $target (i32.load16_u offset=2 (local.get $gate)))
  (local.set $code (call $pm_desc (local.get $target)))
  (if (i32.eqz (local.get $code)) (then (return (call $pm_stop (i32.const ${STOP.descriptor}) (local.get $target)))))
  (local.set $code (i32.sub (local.get $code) (i32.const 1)))
  (local.set $access (i32.load8_u offset=5 (local.get $code)))
  (if (i32.ne (i32.and (local.get $access) (i32.const 24)) (i32.const 24))
    (then (return (call $pm_stop (i32.const ${STOP.type}) (local.get $target)))))
  (local.set $level (i32.and (i32.shr_u (local.get $access) (i32.const 5)) (i32.const 3)))
  (if (i32.gt_u (local.get $level) (local.get $cpl))
    (then (return (call $pm_stop (i32.const ${STOP.privilege}) (local.get $target)))))
  (if (i32.eqz (i32.and (local.get $access) (i32.const 128)))
    (then (return (call $pm_stop (i32.const ${STOP.notPresent}) (local.get $target)))))
  (if (i32.and (local.get $access) (i32.const 4)) (then (local.set $level (local.get $cpl))))
  (local.set $width (select (i32.const 4) (i32.const 2) (i32.eq (local.get $kind) (i32.const 12))))
  (local.set $offset (i32.load16_u (local.get $gate)))
  (if (i32.eq (local.get $width) (i32.const 4))
    (then (local.set $offset (i32.or (local.get $offset) (i32.shl (i32.load16_u offset=6 (local.get $gate)) (i32.const 16))))))
  (if (i32.gt_u (local.get $offset) (call $pm_limit (local.get $code)))
    (then (return (call $pm_stop (i32.const ${STOP.targetLimit}) (local.get $target)))))
  (if (i32.eqz (call $pm_code_mapped (local.get $code) (local.get $offset)))
    (then (return (call $pm_stop (i32.const ${STOP.mapping}) (local.get $target)))))
  (if (i32.eqz (call $pm_current_stack)) (then (return (call $pm_stop (i32.const ${STOP.cachedStack}) (local.get $oldss)))))
  (local.set $newss (local.get $oldss)) (local.set $newsp (local.get $oldsp))
  (local.set $frame (i32.mul (local.get $width) (i32.const 2)))
  (if (i32.lt_u (local.get $level) (local.get $cpl)) (then
    (if (i32.eqz (global.get $pm_tr_valid)) (then (return (call $pm_stop (i32.const ${STOP.tss}) (global.get $tr)))))
    (local.set $access (i32.and (global.get $pm_tr_access) (i32.const 159)))
    ;; Available/busy 386 TSS only in this first supported path. A 286 TSS is
    ;; explicitly stopped instead of reading ESP/SS from the wrong offsets.
    (if (i32.and (i32.ne (local.get $access) (i32.const 137)) (i32.ne (local.get $access) (i32.const 139)))
      (then (return (call $pm_stop (i32.const ${STOP.tss}) (global.get $tr)))))
    (local.set $p (i32.add (i32.const 4) (i32.mul (local.get $level) (i32.const 8))))
    (if (i32.gt_u (i32.add (local.get $p) (i32.const 5)) (global.get $pm_tr_limit))
      (then (return (call $pm_stop (i32.const ${STOP.tss}) (global.get $tr)))))
    (if (i32.eqz (call $pm_ram (global.get $pm_tr_base) (i32.add (local.get $p) (i32.const 6))))
      (then (return (call $pm_stop (i32.const ${STOP.tss}) (global.get $tr)))))
    (local.set $p (i32.add (local.get $p) (global.get $pm_tr_base)))
    (local.set $newsp (i32.load (local.get $p))) (local.set $newss (i32.load16_u offset=4 (local.get $p)))
    (local.set $newstack (call $pm_desc (local.get $newss)))
    (if (i32.eqz (local.get $newstack)) (then (return (call $pm_stop (i32.const ${STOP.stack}) (local.get $newss)))))
    (local.set $newstack (i32.sub (local.get $newstack) (i32.const 1)))
    (local.set $access (i32.load8_u offset=5 (local.get $newstack)))
    (if (i32.or
      (i32.ne (i32.and (local.get $access) (i32.const 154)) (i32.const 146))
      (i32.or (i32.ne (i32.and (local.get $newss) (i32.const 3)) (local.get $level))
        (i32.ne (i32.and (i32.shr_u (local.get $access) (i32.const 5)) (i32.const 3)) (local.get $level))))
      (then (return (call $pm_stop (i32.const ${STOP.stack}) (local.get $newss)))))
    (local.set $count (i32.and (i32.load8_u offset=4 (local.get $gate)) (i32.const 31)))
    (if (i32.and (i32.ne (local.get $count) (i32.const 0))
      (i32.eqz (call $pm_current_span (local.get $oldsp) (i32.mul (local.get $width) (local.get $count)))))
      (then (return (call $pm_stop (i32.const ${STOP.stack}) (local.get $oldss)))))
    (local.set $frame (i32.mul (local.get $width) (i32.add (local.get $count) (i32.const 4))))))
  (local.set $stackoff (i32.and (local.get $newsp)
    (if (result i32) (i32.lt_u (local.get $level) (local.get $cpl))
      (then (call $pm_mask (local.get $newstack))) (else (global.get $spm)))))
  (if (i32.or (i32.lt_u (local.get $stackoff) (local.get $frame))
    (i32.eqz (if (result i32) (i32.lt_u (local.get $level) (local.get $cpl))
      (then (call $pm_stack_span (local.get $newstack) (i32.sub (local.get $stackoff) (local.get $frame)) (local.get $frame)))
      (else (call $pm_current_span (i32.sub (local.get $stackoff) (local.get $frame)) (local.get $frame))))))
    (then (return (call $pm_stop (i32.const ${STOP.stack}) (local.get $newss)))))
  ${readParams}
  ;; Commit only after the complete source, destination and descriptor checks.
  ;; Latch target metadata before frame writes, which may alias a descriptor.
  (call $pm_load (i32.const 1)
    (i32.or (i32.and (local.get $target) (i32.const 65532)) (local.get $level)) (local.get $code))
  (if (i32.lt_u (local.get $level) (local.get $cpl)) (then
    (call $pm_load (i32.const 2) (local.get $newss) (local.get $newstack))
    (global.set $sp (local.get $newsp))
    (call $pm_push (local.get $width) (local.get $oldss))
    (call $pm_push (local.get $width) (local.get $oldsp))
    ${pushParams}))
  (call $pm_push (local.get $width) (local.get $oldcs))
  (call $pm_push (local.get $width) (local.get $next))
  (global.set $gip (local.get $offset))
  (i32.const 1))

(func $pm_cache_data (param $i i32) (param $selector i32) (local $d i32) (local $a i32)
  ${dataCache})

;; Outer RETF uses the hidden loaded access rights, not live table bytes.
(func $pm_clear_data (param $level i32) (local $a i32) (local $bad i32)
  ${clearData})

(func $pm_retf (param $width i32) (param $imm i32) (result i32)
  (local $code i32) (local $selector i32) (local $offset i32)
  (local $cpl i32) (local $level i32) (local $access i32) (local $dpl i32)
  (local $frame i32) (local $newsp i32) (local $newss i32) (local $newstack i32)
  (if (i32.eqz (call $pm_active)) (then (return (i32.const 0))))
  (if (i32.eqz (call $pm_current_stack)) (then (return (call $pm_stop (i32.const ${STOP.cachedStack}) (call $sget (i32.const 2))))))
  (local.set $frame (i32.mul (local.get $width) (i32.const 2)))
  (if (i32.eqz (call $pm_current_span (global.get $sp) (local.get $frame)))
    (then (return (call $pm_stop (i32.const ${STOP.stack}) (call $sget (i32.const 2))))))
  (local.set $offset (call $pm_read (local.get $width) (global.get $sp)))
  (local.set $selector (i32.and (call $pm_read (local.get $width) (i32.add (global.get $sp) (local.get $width))) (i32.const 65535)))
  (local.set $code (call $pm_desc (local.get $selector)))
  (if (i32.eqz (local.get $code)) (then (return (call $pm_stop (i32.const ${STOP.descriptor}) (local.get $selector)))))
  (local.set $code (i32.sub (local.get $code) (i32.const 1)))
  (local.set $access (i32.load8_u offset=5 (local.get $code)))
  (local.set $cpl (i32.and (call $sget (i32.const 1)) (i32.const 3)))
  (local.set $level (i32.and (local.get $selector) (i32.const 3)))
  (local.set $dpl (i32.and (i32.shr_u (local.get $access) (i32.const 5)) (i32.const 3)))
  (if (i32.ne (i32.and (local.get $access) (i32.const 24)) (i32.const 24))
    (then (return (call $pm_stop (i32.const ${STOP.type}) (local.get $selector)))))
  (if (i32.or (i32.lt_u (local.get $level) (local.get $cpl))
    (if (result i32) (i32.and (local.get $access) (i32.const 4))
      (then (i32.gt_u (local.get $dpl) (local.get $level)))
      (else (i32.ne (local.get $dpl) (local.get $level)))))
    (then (return (call $pm_stop (i32.const ${STOP.privilege}) (local.get $selector)))))
  (if (i32.eqz (i32.and (local.get $access) (i32.const 128)))
    (then (return (call $pm_stop (i32.const ${STOP.notPresent}) (local.get $selector)))))
  (if (i32.gt_u (local.get $offset) (call $pm_limit (local.get $code)))
    (then (return (call $pm_stop (i32.const ${STOP.targetLimit}) (local.get $selector)))))
  (if (i32.eqz (call $pm_code_mapped (local.get $code) (local.get $offset)))
    (then (return (call $pm_stop (i32.const ${STOP.mapping}) (local.get $selector)))))
  (if (i32.gt_u (local.get $level) (local.get $cpl)) (then
    (local.set $frame (i32.add (i32.mul (local.get $width) (i32.const 4)) (local.get $imm)))
    (if (i32.eqz (call $pm_current_span (global.get $sp) (local.get $frame)))
      (then (return (call $pm_stop (i32.const ${STOP.stack}) (call $sget (i32.const 2))))))
    (local.set $newsp (call $pm_read (local.get $width)
      (i32.add (global.get $sp) (i32.add (i32.mul (local.get $width) (i32.const 2)) (local.get $imm)))))
    (local.set $newss (i32.and (call $pm_read (local.get $width)
      (i32.add (global.get $sp) (i32.add (i32.mul (local.get $width) (i32.const 3)) (local.get $imm)))) (i32.const 65535)))
    (local.set $newstack (call $pm_desc (local.get $newss)))
    (if (i32.eqz (local.get $newstack)) (then (return (call $pm_stop (i32.const ${STOP.stack}) (local.get $newss)))))
    (local.set $newstack (i32.sub (local.get $newstack) (i32.const 1)))
    (local.set $access (i32.load8_u offset=5 (local.get $newstack)))
    (if (i32.or
      (i32.ne (i32.and (local.get $access) (i32.const 154)) (i32.const 146))
      (i32.or (i32.ne (i32.and (local.get $newss) (i32.const 3)) (local.get $level))
        (i32.ne (i32.and (i32.shr_u (local.get $access) (i32.const 5)) (i32.const 3)) (local.get $level))))
      (then (return (call $pm_stop (i32.const ${STOP.stack}) (local.get $newss)))))
  ))
  ;; RETF imm discards parameters on BOTH stacks for a privilege return.
  (if (i32.gt_u (local.get $level) (local.get $cpl))
    (then
      (call $pm_load (i32.const 2) (local.get $newss) (local.get $newstack))
      (global.set $sp (call $pm_advance_sp (local.get $newsp) (local.get $imm)))
      (call $pm_clear_data (local.get $level)))
    (else (global.set $sp (call $pm_advance_sp (global.get $sp)
      (i32.add (local.get $frame) (local.get $imm))))))
  (call $pm_load (i32.const 1) (local.get $selector) (local.get $code))
  (global.set $gip (local.get $offset))
  (i32.const 1))
`;
}

module.exports = { helpers, STOP };
