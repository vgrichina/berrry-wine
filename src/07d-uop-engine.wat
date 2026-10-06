  ;; ===================================================================
  ;; 07d-uop-engine.wat — toyvm-style micro-op tier
  ;; ===================================================================
  ;;
  ;; docs/uop-tier-design.md. One function, one br_table, a loop. A program
  ;; is DATA: a run of i32 words [op, operand...] in $UOP_ARENA, written by
  ;; the lowering (07e-uop-compiler.wat, or by hand from
  ;; tools/uop-engine-bench.js).
  ;;
  ;; Why this shape and not 07c's: tools/wasm-native.js on $th_block_exec
  ;; shows ~110 Ion instructions and 3-4 indirect jumps per micro-op before
  ;; its kind arm runs -- three register br_tables, a field decode, spilled
  ;; "register locals" -- plus a call per op to write the lazy flags. That
  ;; is the threaded handler's cost moved, not removed. Here:
  ;;
  ;;   * an operand word IS the vreg's byte address, so a register read is
  ;;     two loads and no jump. Vregs 0-7 are the guest registers in
  ;;     $REGFILE themselves, so entry/exit/fallback move nothing;
  ;;   * no op calls anything on its fast path;
  ;;   * no op writes flag globals -- the lowering forwards cmp/test+jcc
  ;;     into B* ops and puts an explicit REC only where flags are live at
  ;;     an exit;
  ;;   * memory goes through a WINDOW proved by GUARD or by the first access
  ;;     that misses it ($g2w_affine_span, plus the code-page bitmap for
  ;;     written windows), so a load/store is one subtract, one unsigned
  ;;     compare and the access. A miss re-guards on the page of the address
  ;;     (the stream walked off its window) and only exits if that fails too.
  ;;
  ;; Windows outlive a $uop_run call. Nothing inside a program can change a
  ;; mapping (any API call is an exit), so a window can only go stale between
  ;; entries, and everything it depends on bumps the shared $UOP_WIN_EPOCH
  ;; ($uop_win_bump): the sparse page table ($guest_page_publish_range,
  ;; $guest_page_clear_range) and, for a written window, the code-page
  ;; bitmap gaining a page and the sparse generated-code span widening
  ;; ($code_page_mark, $code_note_decode). The direct and DIB windows are
  ;; fixed affine maps. The enter op re-poisons a program's windows only
  ;; when the epoch moved since it last did (header +28), so a program
  ;; re-entered with nothing changed keeps the windows its last run proved:
  ;; measured 2026-09-28, 66-90% of all re-guards were first touches after
  ;; poisoning (docs/uop-tier-design.md section 9).
  ;;
  ;; Each program owns its window slots (after its code, see $uc_compile_locked),
  ;; so interleaved programs keep theirs too, and a slot's rw is fixed at
  ;; compile time: poisoning leaves it alone.
  ;;
  ;; Window slot, 16 bytes: +0 lo (guest), +4 span (bytes), +8 delta
  ;; (wasm - guest), +12 rw (1 = a store window: no code page may be inside).
  ;; An empty slot is POISONED -- lo 0xFFFFFFF0, span 4, delta aimed at the
  ;; sentinel $g2w answers for unmapped memory -- never span 0, which the
  ;; 4-byte compare `(ga - lo) >u span - 4` would read as "hit everything".
  ;;
  ;; Operand kinds below: d/a/b/s/base/idx = vreg address, i/disp/n/sc = imm,
  ;; w = window slot address, t/x = code address (x = deopt stub).
  ;;
  ;; BUDGET, exactly as threaded code spends it. $branch_end charges one
  ;; block per transfer while the budget is above zero and stops the batch at
  ;; the first transfer that finds it at zero. A program charges one block per
  ;; branch op (B*, JMP, BCC: each is one x86 Jcc/JMP, i.e. one $branch_end)
  ;; and per threaded block end it replaces (page seams, and cuts: a fall into
  ;; an in-loop entry, as a JMP to the next op; none under --branch-clock,
  ;; where a cut is free). Each is preceded by a CHK whose stub, when the
  ;; budget is gone, materializes the flags, TAKES the transfer, and ends in
  ;; EXITB at its target -- threaded code stops the batch after the branch,
  ;; with eip at the target, not before it. EXITB makes the enter op end the
  ;; batch outright. GOTO is layout and charges nothing. On an ordinary exit
  ;; the enter op adds one block back and lets $branch_end charge it, so a
  ;; batch ends on the same guest instruction with the tier on or off -- the
  ;; guest clock is batches, so anything less shifts every timer. A loop that
  ;; threaded code FOLDS (07b) is one block on the historical clock, which a
  ;; program charging trips cannot match; under --branch-clock the fold
  ;; charges its trips too ($bc_fold_charge), and the two agree exactly.
  ;; CLOCK is phase 0's form.

  (global $UOP_EXIT      i32 (i32.const 0))  ;; eip
  (global $UOP_MOVI      i32 (i32.const 1))  ;; d i
  (global $UOP_MOV       i32 (i32.const 2))  ;; d a
  (global $UOP_ADD       i32 (i32.const 3))  ;; d a b
  (global $UOP_SUB       i32 (i32.const 4))
  (global $UOP_AND       i32 (i32.const 5))
  (global $UOP_OR        i32 (i32.const 6))
  (global $UOP_XOR       i32 (i32.const 7))
  (global $UOP_ADDI      i32 (i32.const 8))  ;; d a i
  (global $UOP_ANDI      i32 (i32.const 9))
  (global $UOP_SHLI      i32 (i32.const 10))
  (global $UOP_SHRI      i32 (i32.const 11))
  (global $UOP_SARI      i32 (i32.const 12))
  (global $UOP_LD32      i32 (i32.const 13)) ;; d base disp w x
  (global $UOP_LD8U      i32 (i32.const 14)) ;; d base disp w x
  (global $UOP_LD8UX     i32 (i32.const 15)) ;; d base idx disp w x   base+idx+disp
  (global $UOP_LD16UX2   i32 (i32.const 16)) ;; d base idx disp w x   base+idx*2+disp
  (global $UOP_ST32      i32 (i32.const 17)) ;; s base disp w x
  (global $UOP_ST8       i32 (i32.const 18))
  (global $UOP_ST16      i32 (i32.const 19))
  (global $UOP_MERGE8L   i32 (i32.const 20)) ;; d a b   d = a&~0xFF | b&0xFF
  (global $UOP_BNEZ      i32 (i32.const 21)) ;; a t
  (global $UOP_BEQZ      i32 (i32.const 22)) ;; a t
  (global $UOP_BNE       i32 (i32.const 23)) ;; a b t
  (global $UOP_BLTU      i32 (i32.const 24)) ;; a b t
  (global $UOP_JMP       i32 (i32.const 25)) ;; t
  (global $UOP_GUARD     i32 (i32.const 26)) ;; w base disp len rw x
  (global $UOP_CLOCK     i32 (i32.const 27)) ;; n x
  (global $UOP_REC       i32 (i32.const 28)) ;; op a b res shift   (op/shift imm)
  (global $UOP_LD16U     i32 (i32.const 29)) ;; d base disp w x
  (global $UOP_BGEU      i32 (i32.const 30)) ;; a b t
  (global $UOP_SAVECF    i32 (i32.const 31)) ;; (none) $saved_cf = CF
  ;; Phase 1: the forms the lowering emits.
  ;;   32 LEA d base idx sc disp             d = base + (idx<<sc) + disp
  ;;   33-37 LDX32/LDX16U/LDX16S/LDX8U/LDX8S d base idx sc disp w x
  ;;   38-40 STX32/STX16/STX8                 s base idx sc disp w x
  ;;   41 ORI 42 XORI                         d a i
  ;;   43 SHL 44 SHR 45 SAR 46 MUL            d a b   (count masked by wasm)
  ;;   47 SEXT8 48 SEXT16                     d a
  ;;   49 MERGE16L 50 MERGE8H                 d a b
  ;;   51 BEQ 52 BLT 53 BGE                   a b t   (BLT/BGE signed)
  ;;   54 SLTU                                d a b   d = a <u b
  ;;   55 GETCF                               d       d = CF of the lazy state
  ;;   56 RECF op a b res shift scf           REC plus $saved_cf = scf
  ;;   57 BCC cc t                            branch on $eval_cc of the globals
  ;;   58 CHK x                               exit to x when the budget is gone
  ;;   59 MULOF d a b                         d = signed a*b overflows 32 bits
  ;;   60 EXTH d a                            d = (a >> 8) & 0xFF
  ;;   61 SLT d a b                           d = a <s b
  ;;   62 GOTO t                              jump without spending a block
  ;;   63 EXITB eip                           end the batch at eip
  ;;   64 BNZL a t                            branch if a != 0, no block spent
  ;;   65 SETSS i                             flag_sign_shift = i
  ;;   66 GETCC d cc                          d = $eval_cc(cc) of the globals
  ;;   67 SPILL s base disp                   [base + disp] = s via $gs32 (a stub op)
  ;; Appended by the uop-calls work (--uop-muldiv, --uop-icall, --uop-iat):
  ;;   68 MULW lo hi a b s                    lo:hi = a * b, 64-bit (s: 1 signed)
  ;;   69 SETMULF s lo hi                     the record $set_flags_mul writes
  ;;   70 DIVW q r lo hi d s x                q, r = hi:lo / d; exit to x on #DE
  ;;   71 ICG v t cls eip x                   exit to x unless v == t (a call's
  ;;                                          target guard; cls 0 icall, 1 iat)
  ;; Appended by the MMX lowering (07e kind 27, --no-uop-mmx). An MMX cell
  ;; is an 8-byte slot of this thread's $MMX_FILE (MMn at +n*8, +64 the
  ;; staging cell a memory source is loaded into); d/a/b below are cell
  ;; addresses, s/d of 72/73 a cell, base/idx GPR slots as in LDX32:
  ;;   72 LDX64 d base idx sc disp w x        cell d = the 8 bytes at the address
  ;;   73 STX64 s base idx sc disp w x        the 8 bytes at the address = cell s
  ;;   74 MXOP sub d a b                      cell d = op(cell a, cell b)
  ;;   75 MXSHI sub d a n                     cell d = op(cell a, n)   (n imm)
  ;;   76 MXFROM32 d a                        cell d = zero-extended i32 slot a
  ;;   77 MXTO32 d a                          i32 slot d = low half of cell a
  ;; sub is 06c's $mmx_opcode_subop numbering and every arm is $mmx_binop /
  ;; $mmx_shift inlined, so the two tiers compute the same bits.
  ;;   78 STRSTEP4 src dst                    advance both pointers by DF ? -4 : 4
  ;; Bulk memory (07e kind 30, --no-uop-rep): REP MOVS / REP STOS as one op.
  ;;   82 COPY d s n w wd ws x                n elements of w bytes from [s] to
  ;;                                          [d] in DF order; d/s/n are slots
  ;;                                          (EDI/ESI/ECX), left as the rep
  ;;                                          leaves them; wd a store window,
  ;;                                          ws a load window
  ;;   83 FILL d v n w wd x                   n elements of v's low w bytes at
  ;;                                          [d]; v an i32 slot, or an MMX cell
  ;;                                          when w is 8
  ;; The fast arm runs when the whole extent is inside its windows and, for
  ;; COPY, the two do not overlap: then it is one memory.copy/memory.fill.
  ;; Anything else is $uop_bulk_slow, which re-guards the windows and runs
  ;; 05b's $rep_movs_mem / $rep_stos_mem -- the same code the threaded rep
  ;; handlers run -- or leaves to x when a page is unmapped or would need a
  ;; store barrier. Neither charges a block: a rep is one instruction inside
  ;; its threaded block too.
  ;; Appended by the straight-line work (docs/uop-tier-design.md section 21):
  ;;   84 WORK n                              the x86 instructions this exit
  ;;                                          retired, for the poor rule
  ;;   85 MCOPY d s n v wd ws x               a run of `mov r,[s+4i];
  ;;                                          mov [d+4i],r` pairs (07e
  ;;                                          $uc_try_mcopy): n dwords
  ;;                                          forward, d/s are address temps
  ;;                                          it leaves alone, n inline, then
  ;;                                          v = the last dword written. The
  ;;                                          window arg at 4 is a store
  ;;                                          window, as COPY's and FILL's.

  ;; The main thread's arena. Each guest thread is its own instance over the
  ;; shared memory and a program names its instance's $reg_base, so every
  ;; instance owns an arena: the main thread $UOP_ARENA, worker N slot N-1 of
  ;; $UOP_THREAD_ARENAS ($init_thread picks).
  (global $UOP_ARENA i32 (region.addr $UOP_ARENA 0))
  (global $UOP_ARENA_SIZE i32 (region.size $UOP_ARENA))
  (global $UOP_THREAD_ARENAS i32 (region.addr $UOP_THREAD_ARENAS 0))
  (global $UOP_THREAD_ARENAS_SIZE i32 (region.size $UOP_THREAD_ARENAS))
  (global $UOP_THREAD_ARENA_STRIDE i32 (i32.const 0x00040000))
  ;; Arena layout, relative to $uop_arena. Programs are bump-allocated from +0
  ;; by the lowering; everything a running program or the installer needs
  ;; besides its code lives in the top $UOP_TAIL bytes. The defaults are the
  ;; main arena's; $uop_set_arena recomputes them.
  (global $UOP_TAIL i32 (i32.const 0x00022000))
  (global $uop_arena      (mut i32) (region.addr $UOP_ARENA 0))
  (global $uop_code_bytes (mut i32) (i32.const 0x000DE000))
  (global $uop_temps_off  (mut i32) (i32.const 0x000DE000)) ;; 4096 x 4 bytes
  (global $uop_wins_off   (mut i32) (i32.const 0x000E2000)) ;; 1024 x 16 bytes, unused by compiled programs (each owns its slots)
  (global $uop_map_off    (mut i32) (i32.const 0x000E6000)) ;; 2048 sets x 2 ways x {eip, pc}
  (global $uop_ranges_off (mut i32) (i32.const 0x000EE000)) ;; 4096 x {lo, hi, pc}
  (global $UOP_RANGES_MAX i32 (i32.const 4096))
  ;; The code-write filter, 16KB after the ranges' 4096 x 12 bytes: 2048 i64
  ;; words, one per hashed guest page, bit L set when some range recorded
  ;; since the last rebuild covers 64-byte line L of a page hashing to that
  ;; word. See $uop_code_write.
  (global $uop_cwmap_off  (mut i32) (i32.const 0x000FA000))
  (global $UOP_CWMAP_BYTES i32 (i32.const 0x4000))
  ;; The program-start bitmap, in the last 8KB: one bit per 16-byte granule
  ;; of code, set by $uop_install at a program's header and cleared only by a
  ;; flush. A header's gen word alone cannot say "a program starts here": an
  ;; enter op or a map way outlives the flush that freed its program, and the
  ;; next generation's code words and alignment padding land on the same
  ;; bytes. Deus Ex entered a retired program's header that way, whose gen
  ;; word was a later program's last operand (4, in generation 4) followed by
  ;; the dead header's own head EIP left in that program's padding. See
  ;; $uop_live.
  (global $uop_starts_off (mut i32) (i32.const 0x000FE000))
  (global $UOP_STARTS_BYTES i32 (i32.const 0x2000))
  ;; A range was removed since the filter was last rebuilt, so it may hold
  ;; bits no live range owns (a conservative, not a wrong, answer).
  (global $uop_cw_stale (mut i32) (i32.const 0))
  ;; Code-page writes the filter proved miss every program / that it had to
  ;; hand to the scan / filter rebuilds.
  (global $uop_cw_skipped (mut i32) (i32.const 0))
  (global $uop_cw_scans   (mut i32) (i32.const 0))
  (global $uop_cw_rebuilds (mut i32) (i32.const 0))
  ;; Program header: +0 gen +4 head eip +8 nwins +12 wins +16 enters
  ;; +20 blocks +24 head exits +28 window epoch +32 work (a trace's x86
  ;; instructions retired, summed over its exits' WORK ops; 0 for a loop)
  ;; +36..+47 unused.
  (global $UOP_HDR        i32 (i32.const 48))
  ;; Set by 84 WORK on the way out of a trace program, read and cleared by
  ;; the enter op.
  (global $uop_xwork (mut i32) (i32.const 0))
  ;; A trace averaging this many x86 instructions per entry is worth its
  ;; enter/exit (§21.1); set_uop_poor_work changes it, 0x40000000 restores
  ;; the blocks-only rule for traces too.
  (global $UOP_POOR_WORK (mut i32) (i32.const 16))
  (global $uop_guard_fails (mut i32) (i32.const 0))
  (global $uop_reguards    (mut i32) (i32.const 0))
  ;; DIVW exits (the threaded div then raises #DE, or finds it does not);
  ;; ICG passes and fails by class (0 call r/m, 1 call [IAT slot]); the four
  ;; call sites that failed their guard most, {eip, fails}, a failing site
  ;; not yet listed replacing the one with fewest fails.
  (global $uop_div_exits   (mut i32) (i32.const 0))
  (global $uop_icg_pass0   (mut i32) (i32.const 0))
  (global $uop_icg_fail0   (mut i32) (i32.const 0))
  (global $uop_icg_pass1   (mut i32) (i32.const 0))
  (global $uop_icg_fail1   (mut i32) (i32.const 0))
  (global $uop_icf_e0 (mut i32) (i32.const 0)) (global $uop_icf_n0 (mut i32) (i32.const 0))
  (global $uop_icf_e1 (mut i32) (i32.const 0)) (global $uop_icf_n1 (mut i32) (i32.const 0))
  (global $uop_icf_e2 (mut i32) (i32.const 0)) (global $uop_icf_n2 (mut i32) (i32.const 0))
  (global $uop_icf_e3 (mut i32) (i32.const 0)) (global $uop_icf_n3 (mut i32) (i32.const 0))
  (func $uop_icg_note (param $eip i32)
    (local $m i32)
    (if (i32.eq (global.get $uop_icf_e0) (local.get $eip))
      (then (global.set $uop_icf_n0 (i32.add (global.get $uop_icf_n0) (i32.const 1))) (return)))
    (if (i32.eq (global.get $uop_icf_e1) (local.get $eip))
      (then (global.set $uop_icf_n1 (i32.add (global.get $uop_icf_n1) (i32.const 1))) (return)))
    (if (i32.eq (global.get $uop_icf_e2) (local.get $eip))
      (then (global.set $uop_icf_n2 (i32.add (global.get $uop_icf_n2) (i32.const 1))) (return)))
    (if (i32.eq (global.get $uop_icf_e3) (local.get $eip))
      (then (global.set $uop_icf_n3 (i32.add (global.get $uop_icf_n3) (i32.const 1))) (return)))
    ;; the slot with the fewest fails
    (if (i32.lt_u (global.get $uop_icf_n1) (global.get $uop_icf_n0)) (then (local.set $m (i32.const 1))))
    (if (i32.lt_u (global.get $uop_icf_n2)
                  (select (global.get $uop_icf_n1) (global.get $uop_icf_n0) (local.get $m)))
      (then (local.set $m (i32.const 2))))
    (if (i32.lt_u (global.get $uop_icf_n3)
                  (select (global.get $uop_icf_n2)
                          (select (global.get $uop_icf_n1) (global.get $uop_icf_n0) (local.get $m))
                          (i32.eq (local.get $m) (i32.const 2))))
      (then (local.set $m (i32.const 3))))
    (if (i32.eqz (local.get $m)) (then (global.set $uop_icf_e0 (local.get $eip)) (global.set $uop_icf_n0 (i32.const 1)) (return)))
    (if (i32.eq (local.get $m) (i32.const 1)) (then (global.set $uop_icf_e1 (local.get $eip)) (global.set $uop_icf_n1 (i32.const 1)) (return)))
    (if (i32.eq (local.get $m) (i32.const 2)) (then (global.set $uop_icf_e2 (local.get $eip)) (global.set $uop_icf_n2 (i32.const 1)) (return)))
    (global.set $uop_icf_e3 (local.get $eip)) (global.set $uop_icf_n3 (i32.const 1)))
  ;; Megamorphic sites (docs/uop-tier-design.md section 23). A guard that
  ;; keeps failing leaves its program at the call on every trip, so the
  ;; program is worth less than the threaded code it replaced (Heroes III:
  ;; one polymorphic site, 298K fails). Every fail counts against its call
  ;; EIP in a 256-entry direct-mapped table {eip, fails} in the windows
  ;; area's free 0x3400..0x3C00 (the cut table ends at 0x3400); a program
  ;; that fails at a site past $uop_icg_mega is killed on its way out
  ;; ($th_uop_enter) -- a kill, not a poor retirement, so the head can
  ;; recompile -- and 07e's FF /2 lowering refuses the site from then on,
  ;; leaving the call to the threaded code as without --uop-icall. A stale
  ;; or aliased entry only costs an inline cache, never a wrong answer.
  ;; 0 turns the rule off. Cleared with the verdicts ($uop_flush_all).
  (global $uop_icg_mega (mut i32) (i32.const 32))
  (global $uop_icg_retire (mut i32) (i32.const 0))
  (global $uop_icg_megas (mut i32) (i32.const 0))
  (global $uop_icg_mkills (mut i32) (i32.const 0))
  (func $uop_icg_slot (param $eip i32) (result i32)
    (i32.add (i32.add (global.get $uop_arena) (global.get $uop_wins_off))
      (i32.add (i32.const 0x3400)
        (i32.shl
          (i32.and (i32.xor (local.get $eip) (i32.shr_u (local.get $eip) (i32.const 8)))
                   (i32.const 255))
          (i32.const 3)))))
  (func $uop_icg_count (param $eip i32)
    (local $s i32) (local $n i32)
    (if (i32.eqz (global.get $uop_icg_mega)) (then (return)))
    (local.set $s (call $uop_icg_slot (local.get $eip)))
    (if (i32.ne (i32.load (local.get $s)) (local.get $eip))
      (then (i32.store (local.get $s) (local.get $eip))
            (i32.store offset=4 (local.get $s) (i32.const 0))))
    (local.set $n (i32.add (i32.load offset=4 (local.get $s)) (i32.const 1)))
    (i32.store offset=4 (local.get $s) (local.get $n))
    (if (i32.eq (local.get $n) (global.get $uop_icg_mega))
      (then (global.set $uop_icg_megas (i32.add (global.get $uop_icg_megas) (i32.const 1)))))
    (if (i32.ge_u (local.get $n) (global.get $uop_icg_mega))
      (then (global.set $uop_icg_retire (i32.const 1)))))
  ;; 07e: may an FF /2 at eip still get an inline cache?
  (func $uop_icg_is_mega (param $eip i32) (result i32)
    (local $s i32)
    (if (i32.eqz (global.get $uop_icg_mega)) (then (return (i32.const 0))))
    (local.set $s (call $uop_icg_slot (local.get $eip)))
    (i32.and (i32.eq (i32.load (local.get $s)) (local.get $eip))
             (i32.ge_u (i32.load offset=4 (local.get $s)) (global.get $uop_icg_mega))))
  (func (export "set_uop_icg_mega") (param $n i32)
    (global.set $uop_icg_mega (select (local.get $n) (i32.const 0) (i32.gt_s (local.get $n) (i32.const 0)))))
  (func (export "get_uop_icg_mega") (result i32) (global.get $uop_icg_mega))
  ;; uop_icg_site(i): the i-th worst-failing site (0-3, unsorted), i+4 its fails
  (func (export "uop_icg_site") (param $i i32) (result i32)
    (if (i32.eqz (local.get $i)) (then (return (global.get $uop_icf_e0))))
    (if (i32.eq (local.get $i) (i32.const 1)) (then (return (global.get $uop_icf_e1))))
    (if (i32.eq (local.get $i) (i32.const 2)) (then (return (global.get $uop_icf_e2))))
    (if (i32.eq (local.get $i) (i32.const 3)) (then (return (global.get $uop_icf_e3))))
    (if (i32.eq (local.get $i) (i32.const 4)) (then (return (global.get $uop_icf_n0))))
    (if (i32.eq (local.get $i) (i32.const 5)) (then (return (global.get $uop_icf_n1))))
    (if (i32.eq (local.get $i) (i32.const 6)) (then (return (global.get $uop_icf_n2))))
    (if (i32.eq (local.get $i) (i32.const 7)) (then (return (global.get $uop_icf_n3))))
    (i32.const 0))

  ;; Tier state. Off by default and per instance: only the instance that
  ;; armed it (run.js --uop, main thread) ever installs, because the arena is
  ;; one region and the programs name that instance's $reg_base.
  (global $uop_enabled (mut i32) (i32.const 0))
  (global $uop_gen     (mut i32) (i32.const 1))
  (global $uop_nranges (mut i32) (i32.const 0))
  ;; Bytes of program code placed since the last flush (07e $uop_compile).
  (global $uop_alloc   (mut i32) (i32.const 0))
  (global $uop_installs (mut i32) (i32.const 0))
  (global $uop_kills    (mut i32) (i32.const 0))
  (global $uop_enters   (mut i32) (i32.const 0))
  ;; Set by EXITB for the enter op that is still on the stack: never live
  ;; across a return to the run loop.
  (global $uop_bexit    (mut i32) (i32.const 0))
  (global $uop_blocks   (mut i64) (i64.const 0))
  (global $uop_head_exits (mut i32) (i32.const 0))
  (global $uop_retired_poor (mut i32) (i32.const 0))
  ;; Entries that kept their windows / that had to poison them again.
  (global $uop_win_kept  (mut i32) (i32.const 0))
  (global $uop_win_reset (mut i32) (i32.const 0))

  ;; --uop-census: one record per verdict, through log_i32 (tools/uop-census.js
  ;; reads them back). A record is 0xC5E50000|kind, then four fields:
  ;;   1 compiled   head, decline reason (0 = installed, 0xFFFF busy), insns, 0
  ;;   2 poor       head, enters, blocks, the EIP it left by
  ;;   3 code write head, enters, blocks, the written address
  ;;   4 flush      gen, bytes placed, ranges, 0
  ;;   5 flush-all  (then a 4): every verdict is forgotten too
  ;;   6 live       head, enters, blocks, 0      (uop_census_dump, at exit)
  ;;   7 marker     head, 0, 0, 0                (declined or poor, at exit)
  ;;   8 hot table  takeovers, warm takeovers (count >= 16), threshold probes, 0
  ;;                (at exit; the 512-slot $bx_hot_bump table)
  ;;   9 unsup      head, opcode signature (07e $uc_sig), its address, reason
  ;;                (before the kind-1 record of a scan-limit, head-unsupported
  ;;                or no-backedge decline: each unsupported insn the scan hit)
  ;; Program lifetimes (so a head's enters sum over every program it had, not
  ;; just the one live at exit; docs/uop-tier-design.md §23.7):
  ;;  10 flushed    head, enters, blocks, work   (each live program, at a flush)
  ;;  11 live       head, enters, blocks, work   (each live program in the arena
  ;;                at exit, including ones a map way no longer names)
  ;;  12 mega kill  head, enters, blocks, work   (killed at a megamorphic ICG)
  ;;  13 exits      head, dominant exit EIP (Misra-Gries), its net count, exits
  ;;                to a cut landing; follows every 2, 3, 10, 11 and 12
  ;; and what a program was built from (07e, at install, before its kind 1):
  ;;  14 call site  head, site EIP, target, class (0 E8, 1 icall, 2 IAT)
  ;;  15 range      head, lo, hi, 0  (a run of consecutive instructions)
  ;;  16 cut        head, landing EIP, 0, 0  (07e $uc_form_trace)
  ;;  17 retry      head, first reason, calls followed, is-trace  (07e
  ;;                $uc_lower_head, before the nocall retry)
  (global $uop_census (mut i32) (i32.const 0))
  (func $uop_census_ev (param $k i32) (param $a i32) (param $b i32) (param $c i32) (param $d i32)
    (call $host_log_i32 (i32.or (i32.const 0xC5E50000) (local.get $k)))
    (call $host_log_i32 (local.get $a))
    (call $host_log_i32 (local.get $b))
    (call $host_log_i32 (local.get $c))
    (call $host_log_i32 (local.get $d)))
  (func (export "set_uop_census") (param $on i32)
    (global.set $uop_census (i32.ne (local.get $on) (i32.const 0))))
  ;; Census only: where each entry of a program left. Header +36/+40 hold a
  ;; Misra-Gries majority candidate for the exit EIP and its net count, +44
  ;; the exits to a trace cut landing (both unused otherwise, zeroed at
  ;; placement). An exit back to the head is +24's already.
  (func $uop_census_exit (param $op i32)
    (local $e i32)
    (local.set $e (global.get $eip))
    (if (i32.eq (local.get $e) (i32.load offset=4 (local.get $op))) (then (return)))
    (if (call $uop_cut_probe (local.get $e))
      (then (i32.store offset=44 (local.get $op) (i32.add (i32.load offset=44 (local.get $op)) (i32.const 1)))))
    (if (i32.eq (i32.load offset=36 (local.get $op)) (local.get $e))
      (then (i32.store offset=40 (local.get $op) (i32.add (i32.load offset=40 (local.get $op)) (i32.const 1))) (return)))
    (if (i32.eqz (i32.load offset=40 (local.get $op)))
      (then (i32.store offset=36 (local.get $op) (local.get $e))
            (i32.store offset=40 (local.get $op) (i32.const 1)) (return)))
    (i32.store offset=40 (local.get $op) (i32.sub (i32.load offset=40 (local.get $op)) (i32.const 1))))
  (func $uop_census_exits (param $pc i32)
    (call $uop_census_ev (i32.const 13) (i32.load offset=4 (local.get $pc))
      (i32.load offset=36 (local.get $pc)) (i32.load offset=40 (local.get $pc))
      (i32.load offset=44 (local.get $pc))))
  (func $uop_census_prog (param $k i32) (param $pc i32)
    (call $uop_census_ev (local.get $k) (i32.load offset=4 (local.get $pc))
      (i32.load offset=16 (local.get $pc)) (i32.load offset=20 (local.get $pc))
      (i32.load offset=32 (local.get $pc)))
    (call $uop_census_exits (local.get $pc)))
  ;; Every live program of this generation, by the start bitmap: a program
  ;; whose map way was taken over is still entered through its enter op.
  (func $uop_census_arena (param $k i32)
    (local $i i32) (local $b i32) (local $j i32) (local $pc i32)
    (block $d (loop $l
      (br_if $d (i32.ge_u (local.get $i) (global.get $UOP_STARTS_BYTES)))
      (local.set $b (i32.load8_u (i32.add (i32.add (global.get $uop_arena) (global.get $uop_starts_off))
                                          (local.get $i))))
      (if (local.get $b)
        (then
          (local.set $j (i32.const 0))
          (block $bd (loop $bl
            (br_if $bd (i32.ge_u (local.get $j) (i32.const 8)))
            (if (i32.and (local.get $b) (i32.shl (i32.const 1) (local.get $j)))
              (then
                (local.set $pc (i32.add (global.get $uop_arena)
                  (i32.shl (i32.add (i32.shl (local.get $i) (i32.const 3)) (local.get $j)) (i32.const 4))))
                (if (call $uop_live (local.get $pc))
                  (then (call $uop_census_prog (local.get $k) (local.get $pc))))))
            (local.set $j (i32.add (local.get $j) (i32.const 1)))
            (br $bl)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $l))))
  (func (export "uop_census_dump")
    (local $i i32) (local $s i32) (local $pc i32)
    (call $uop_census_ev (i32.const 8) (global.get $bx_hot_evicts)
      (global.get $bx_hot_evicts_warm) (global.get $bx_walk_hot_probes) (i32.const 0))
    (call $uop_census_arena (i32.const 11))
    (block $d (loop $l
      (br_if $d (i32.ge_u (local.get $i) (i32.const 4096)))
      (local.set $s (i32.add (i32.add (global.get $uop_arena) (global.get $uop_map_off))
                             (i32.shl (local.get $i) (i32.const 3))))
      (local.set $pc (i32.load offset=4 (local.get $s)))
      (if (i32.eq (local.get $pc) (i32.const 1))
        (then (call $uop_census_ev (i32.const 7) (i32.load (local.get $s))
                (i32.const 0) (i32.const 0) (i32.const 0))))
      (if (i32.gt_u (local.get $pc) (i32.const 1))
        (then (if (call $uop_live (local.get $pc))
          (then (call $uop_census_ev (i32.const 6) (i32.load offset=4 (local.get $pc))
                  (i32.load offset=16 (local.get $pc)) (i32.load offset=20 (local.get $pc))
                  (i32.const 0))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $l))))

  ;; Anything that can make a proved window wrong calls this (see the top of
  ;; the file). Shared by every instance: a mapping is process-wide, and so
  ;; is the code-page bitmap.
  (func $uop_win_bump
    (drop (i32.atomic.rmw.add (global.get $UOP_WIN_EPOCH) (i32.const 1))))

  ;; Empty a slot: every access through it misses (lo/span/delta), rw kept.
  (func $uop_window_poison (param $w i32)
    (i32.store (local.get $w) (i32.const 0xFFFFFFF0))
    (i32.store offset=4 (local.get $w) (i32.const 4))
    (i32.store offset=8 (local.get $w)
      (i32.sub (global.get $NULL_SENTINEL) (i32.const 0xFFFFFFF0))))

  ;; Prove [lo, lo+len) is one affine mapping and, for a written window, that
  ;; no page in it holds decoded code. Fill the slot and answer 1, or leave it
  ;; poisoned (every access then misses) and answer 0. The slot outlives this
  ;; run, so a failure must not leave half of a window behind.
  (func $uop_window_set (param $w i32) (param $lo i32) (param $len i32) (param $rw i32) (result i32)
    (if (global.get $uwc_on)
      (then (return (call $uwc_set (local.get $w) (local.get $lo) (local.get $len)
                      (local.get $rw) (i32.const 0)))))
    (return_call $uop_window_set_raw (local.get $w) (local.get $lo) (local.get $len) (local.get $rw)))
  (func $uop_window_set_raw (param $w i32) (param $lo i32) (param $len i32) (param $rw i32) (result i32)
    (local $wa i32) (local $p i32) (local $end i32)
    (call $uop_window_poison (local.get $w))
    (if (i32.eqz (local.get $len)) (then (return (i32.const 0))))
    (local.set $wa (call $g2w_affine_span (local.get $lo) (local.get $len)))
    (if (i32.eq (local.get $wa) (global.get $NULL_SENTINEL))
      (then (return (i32.const 0))))
    (if (local.get $rw)
      (then
        (local.set $end (i32.add (local.get $lo) (i32.sub (local.get $len) (i32.const 1))))
        (local.set $p (local.get $lo))
        (block $ok (loop $pages
          (if (call $store_page_needs_barrier (local.get $p)) (then (return (i32.const 0))))
          (br_if $ok (i32.eq (i32.and (local.get $p) (i32.const 0xFFFFF000))
                             (i32.and (local.get $end) (i32.const 0xFFFFF000))))
          (local.set $p (i32.add (i32.and (local.get $p) (i32.const 0xFFFFF000)) (i32.const 0x1000)))
          (br $pages)))))
    (i32.store (local.get $w) (local.get $lo))
    (i32.store offset=8 (local.get $w) (i32.sub (local.get $wa) (local.get $lo)))
    (i32.store offset=12 (local.get $w) (local.get $rw))
    (i32.store offset=4 (local.get $w) (local.get $len))
    (i32.const 1))

  ;; Poison a program's windows and stamp them with the epoch they will be
  ;; proved under. $ep is read BEFORE the slots are emptied: a bump racing
  ;; this (another thread) leaves the older stamp, so the next entry poisons
  ;; again -- the error only ever runs toward re-guarding.
  (func $uop_windows_reset (param $op i32) (param $ep i32)
    (local $w i32) (local $n i32)
    (local.set $n (i32.load offset=8 (local.get $op)))
    (local.set $w (i32.load offset=12 (local.get $op)))
    (block $d (loop $l
      (br_if $d (i32.eqz (local.get $n)))
      (if (global.get $uwc_on) (then (call $uwc_shadow_drop (local.get $w))))
      (call $uop_window_poison (local.get $w))
      (local.set $w (i32.add (local.get $w) (i32.const 16)))
      (local.set $n (i32.sub (local.get $n) (i32.const 1)))
      (br $l)))
    (i32.store offset=28 (local.get $op) (local.get $ep)))

  ;; The slow half of every access: the address left its window. Re-guard on
  ;; the page it is in now (keeping the slot's rw); an access that straddles
  ;; that page is not the fast case at all and answers 0, which exits.
  (func $uop_reguard (param $w i32) (param $ga i32) (param $size i32) (result i32)
    (local $pg i32)
    (global.set $uop_reguards (i32.add (global.get $uop_reguards) (i32.const 1)))
    (if (global.get $uwc_on)
      (then (return (call $uwc_reguard (local.get $w) (local.get $ga) (local.get $size)))))
    (local.set $pg (i32.and (local.get $ga) (i32.const 0xFFFFF000)))
    (if (i32.gt_u (i32.add (i32.and (local.get $ga) (i32.const 0xFFF)) (local.get $size))
                  (i32.const 0x1000))
      (then (return (i32.const 0))))
    (if (i32.ne (global.get $uop_rg_mask) (i32.const 0xFFFFF000))
      (then (return_call $uop_reguard_wide (local.get $w) (local.get $pg))))
    (call $uop_window_set (local.get $w) (local.get $pg) (i32.const 0x1000)
      (i32.load offset=12 (local.get $w))))

  ;; A re-guard proves more than the page it missed on. --uop-win-census
  ;; measured it (docs/uop-tier-design.md section 14): with one-page
  ;; windows a stream re-guards at every page it walks onto -- Diablo 1.46
  ;; re-guards per entry, Moorhuhn 3 4.9 -- and 65-99.9% of them land inside
  ;; the affine run the slot's previous window was already in. So grow the
  ;; window from the missed page, a page at a time in both directions, while
  ;; the next page has the same guest->wasm delta and (for a written window)
  ;; holds no decoded code, up to the $uop_rg_mask-aligned block containing
  ;; it (64KB by default; --uop-reguard-span=4096 restores one page). Every
  ;; page it covers is proved exactly as $uop_window_set proves one, so the
  ;; epoch rules are unchanged: nothing it relied on can change without a
  ;; $uop_win_bump.
  (global $uop_rg_mask (mut i32) (i32.const 0xFFFF0000))
  (global $uop_rg_pages (mut i32) (i32.const 0))   ;; pages proved by wide re-guards
  (global $uop_rg_nonadj (mut i32) (i32.const 0))  ;; growth stopped at a non-adjacent backing page
  (func $uop_reguard_wide (param $w i32) (param $pg i32) (result i32)
    (local $rw i32) (local $wa i32) (local $lo i32) (local $hi i32)
    (local $blo i32) (local $bhi i32)
    (local.set $rw (i32.load offset=12 (local.get $w)))
    (if (i32.eqz (call $uop_window_set (local.get $w) (local.get $pg) (i32.const 0x1000)
                   (local.get $rw)))
      (then (return (i32.const 0))))
    ;; the page is proved and the slot holds it; delta = wa - guest
    (local.set $wa (i32.add (local.get $pg) (i32.load offset=8 (local.get $w))))
    (local.set $blo (i32.and (local.get $pg) (global.get $uop_rg_mask)))
    (local.set $bhi (i32.add (local.get $blo)
      (i32.add (i32.xor (global.get $uop_rg_mask) (i32.const -1)) (i32.const 1))))
    ;; The common case first: the whole block is one affine run with no code
    ;; page in it -- one span proof and one 16-bit bitmap load per 64KB,
    ;; instead of a proof and a bitmap test per page.
    (if (call $uop_rg_block_ok (local.get $blo) (local.get $bhi)
          (i32.sub (local.get $wa) (i32.sub (local.get $pg) (local.get $blo)))
          (local.get $rw))
      (then
        (local.set $lo (local.get $blo))
        (local.set $hi (local.get $bhi)))
      (else (call $uop_rg_grow (local.get $pg) (local.get $wa) (local.get $blo)
                (local.get $bhi) (local.get $rw))
        (local.set $lo (global.get $uop_rg_lo))
        (local.set $hi (global.get $uop_rg_hi))))
    (global.set $uop_rg_pages (i32.add (global.get $uop_rg_pages)
      (i32.shr_u (i32.sub (local.get $hi) (local.get $lo)) (i32.const 12))))
    ;; delta unchanged; lo first, then span (a 4-byte access compares
    ;; ga - lo against span - 4, and both only ever grow the covered range)
    (i32.store (local.get $w) (local.get $lo))
    (i32.store offset=4 (local.get $w) (i32.sub (local.get $hi) (local.get $lo)))
    (i32.const 1))

  ;; Is [blo, bhi) one affine run starting at wasm $wlo, and -- for a written
  ;; window -- free of code pages? Within a 64KB-aligned block the code-page
  ;; bitmap's slot hash (04-cache $code_page_slot: (ga>>12 ^ ga>>28 ^
  ;; (ga>>30)<<15) & 0xFFFF) only permutes the low four slot bits and flips a
  ;; per-block constant bit 15, so the block's sixteen pages are
  ;; exactly one aligned 16-bit group: one load answers "any code here". A
  ;; span narrower than 64KB tests its whole enclosing group, which can only
  ;; refuse more, never less.
  (func $uop_rg_block_ok (param $blo i32) (param $bhi i32) (param $wlo i32) (param $rw i32) (result i32)
    (local $g i32)
    (if (i32.ne (call $g2w_affine_span (local.get $blo) (i32.sub (local.get $bhi) (local.get $blo)))
                (local.get $wlo))
      (then (return (i32.const 0))))
    (if (i32.eqz (local.get $rw)) (then (return (i32.const 1))))
    (if (call $page_watch_any (local.get $wlo) (i32.sub (local.get $bhi) (local.get $blo)))
      (then (return (i32.const 0))))
    (local.set $g (local.get $blo))
    (loop $l
      (if (i32.load16_u (i32.add (global.get $CODE_PAGE_BITMAP)
            (i32.and (i32.shr_u (local.get $g) (i32.const 15)) (i32.const 0x1FFE))))
        (then (return (i32.const 0))))
      (local.set $g (i32.add (local.get $g) (i32.const 0x10000)))
      (br_if $l (i32.lt_u (local.get $g) (local.get $bhi))))
    (i32.const 1))

  ;; The block is not wholly usable: grow from the proved page one page at a
  ;; time in both directions, stopping at a non-adjacent or unmapped page or
  ;; (written window) a code page. Answers in $uop_rg_lo / $uop_rg_hi.
  (global $uop_rg_lo (mut i32) (i32.const 0))
  (global $uop_rg_hi (mut i32) (i32.const 0))
  (func $uop_rg_grow (param $pg i32) (param $wa i32) (param $blo i32) (param $bhi i32) (param $rw i32)
    (local $lo i32) (local $hi i32) (local $nw i32)
    (local.set $lo (local.get $pg))
    (local.set $hi (i32.add (local.get $pg) (i32.const 0x1000)))
    (block $up (loop $grow_up
      (br_if $up (i32.ge_u (local.get $hi) (local.get $bhi)))
      (local.set $nw (call $g2w_affine_span (local.get $hi) (i32.const 0x1000)))
      (if (i32.ne (local.get $nw)
            (i32.add (local.get $wa) (i32.sub (local.get $hi) (local.get $pg))))
        (then
          (if (i32.ne (local.get $nw) (global.get $NULL_SENTINEL))
            (then (global.set $uop_rg_nonadj (i32.add (global.get $uop_rg_nonadj) (i32.const 1)))))
          (br $up)))
      (br_if $up (i32.and (i32.ne (local.get $rw) (i32.const 0))
                          (call $store_page_needs_barrier (local.get $hi))))
      (local.set $hi (i32.add (local.get $hi) (i32.const 0x1000)))
      (br $grow_up)))
    (block $down (loop $grow_down
      (br_if $down (i32.le_u (local.get $lo) (local.get $blo)))
      (local.set $nw (call $g2w_affine_span (i32.sub (local.get $lo) (i32.const 0x1000)) (i32.const 0x1000)))
      (if (i32.ne (local.get $nw)
            (i32.sub (i32.add (local.get $wa) (i32.sub (local.get $lo) (local.get $pg))) (i32.const 0x1000)))
        (then
          (if (i32.ne (local.get $nw) (global.get $NULL_SENTINEL))
            (then (global.set $uop_rg_nonadj (i32.add (global.get $uop_rg_nonadj) (i32.const 1)))))
          (br $down)))
      (br_if $down (i32.and (i32.ne (local.get $rw) (i32.const 0))
                            (call $store_page_needs_barrier (i32.sub (local.get $lo) (i32.const 0x1000)))))
      (local.set $lo (i32.sub (local.get $lo) (i32.const 0x1000)))
      (br $grow_down)))
    (global.set $uop_rg_lo (local.get $lo))
    (global.set $uop_rg_hi (local.get $hi)))
  (func (export "set_uop_reguard_span") (param $bytes i32)
    (global.set $uop_rg_mask
      (i32.xor (i32.sub (select (local.get $bytes) (i32.const 0x1000)
                          (i32.gt_u (local.get $bytes) (i32.const 0x1000)))
                        (i32.const 1))
               (i32.const -1))))

  ;; --uop-win-census: what kind of memory every window proof lands on, why
  ;; the failures fail, and -- for each re-guard -- whether a window WIDER
  ;; than the one page $uop_reguard proves would already have covered it
  ;; (docs/uop-tier-design.md, contiguity census). Off unless
  ;; set_uop_win_census(1); when off every hook is one global test on a path
  ;; that is already a call. Main instance only: the counters and the shadow
  ;; table live in this arena's $uop_wins_off area, which compiled programs
  ;; never use (each owns its slots).
  ;;
  ;; i64 counters at +0 (index k, 8 bytes each):
  ;;   ctx 0 = GUARD op / window_set from anywhere else, ctx 1 = re-guard;
  ;;   base = ctx*16: +0 calls, +1 direct ok, +2 DIB ok, +3 sparse ok one page,
  ;;   +4 sparse ok multi-page, +5 sparse fail first page unmapped, +6 wrap,
  ;;   +7 sparse fail later page unmapped, +8 sparse fail NON-ADJACENT backing,
  ;;   +9 fail: written window holds a code page, +10 straddles its page
  ;;   (re-guard), +11 len 0, +12 direct/DIB span running off its window.
  ;;   32 + (kind-1)*8, per re-guard whose slot's previous window is known,
  ;;   by that window's kind (1 direct, 2 DIB, 3 sparse): +0 count, +1 the
  ;;   page next to the previous window (a stream walking on), +2 inside the
  ;;   previous window's affine run (backing already adjacent: widening the
  ;;   re-guard alone would cover it), +3 inside its committed guest run and
  ;;   the same allocation but past a backing break (contiguous backing would
  ;;   cover it), +4 committed-run but another allocation, +5 none of these.
  ;;   56 re-guards with no known previous window (first touch after
  ;;   poisoning, or evicted), 57 shadow evictions, 58/59 summed affine /
  ;;   committed run pages over sparse successes, 60 their count.
  ;;   64.. bulk $g2w_affine_span sparse fallbacks outside the uop tier:
  ;;   64 calls, 65 ok, 66 first page unmapped, 67 wrap, 68 later page
  ;;   unmapped, 69 NON-ADJACENT, 70 non-adjacent bytes asked, 71 ok bytes.
  ;;   72 + kind: code-page refusals (+9 of either ctx) by the memory they hit
  ;;   (1 direct, 2 DIB, 3 sparse); 76 how many; 80..95 the last sixteen
  ;;   refused pages, a ring indexed by 76.
  ;; Shadow at +1024: 256 entries x 32 bytes {w, kind, first page, last page,
  ;; affine lo, affine hi, committed lo, committed hi}, keyed by slot address.
  (global $uwc_on (mut i32) (i32.const 0))
  (global $uwc_in_uop (mut i32) (i32.const 0))
  (global $UWC_RUN_CAP i32 (i32.const 256))
  (func $uwc_base (result i32)
    (i32.add (global.get $uop_arena) (global.get $uop_wins_off)))
  (func $uwc_add (param $k i32) (param $v i32)
    (local $a i32)
    (local.set $a (i32.add (call $uwc_base) (i32.shl (local.get $k) (i32.const 3))))
    (i64.store (local.get $a)
      (i64.add (i64.load (local.get $a)) (i64.extend_i32_u (local.get $v)))))
  (func $uwc_inc (param $k i32) (call $uwc_add (local.get $k) (i32.const 1)))
  (func $uwc_shadow (param $w i32) (result i32)
    (i32.add (i32.add (call $uwc_base) (i32.const 1024))
      (i32.shl (i32.and (i32.shr_u (local.get $w) (i32.const 4)) (i32.const 255))
        (i32.const 5))))
  (func $uwc_kind (param $ga i32) (result i32)
    (if (i32.lt_u
          (i32.add (i32.sub (local.get $ga) (global.get $image_base)) (global.get $GUEST_BASE))
          (region.end $DIRECT_WINDOW))
      (then (return (i32.const 1))))
    (if (i32.lt_u (i32.sub (local.get $ga) (global.get $DIB_GUEST_BASE))
          (global.get $DIB_GUEST_CAPACITY))
      (then (return (i32.const 2))))
    (i32.const 3))
  (func $uwc_shadow_drop (param $w i32)
    (local $e i32)
    (local.set $e (call $uwc_shadow (local.get $w)))
    (if (i32.eq (i32.load (local.get $e)) (local.get $w))
      (then (i32.store (local.get $e) (i32.const 0)))))
  ;; Walk page PTEs from $p by $step (+-0x1000) while the next page is present
  ;; and, when $adj, backed right next to the current one. Answers the last
  ;; page reached (capped at $UWC_RUN_CAP steps).
  (func $uwc_walk (param $p i32) (param $step i32) (param $adj i32) (result i32)
    (local $n i32) (local $q i32) (local $wq i32)
    (block $d (loop $l
      (br_if $d (i32.ge_u (local.get $n) (global.get $UWC_RUN_CAP)))
      (local.set $q (i32.add (local.get $p) (local.get $step)))
      (local.set $wq (call $guest_page_translate (local.get $q)))
      (br_if $d (i32.eq (local.get $wq) (global.get $NULL_SENTINEL)))
      (br_if $d (i32.and (i32.ne (local.get $adj) (i32.const 0))
        (i32.ne (local.get $wq)
          (i32.add (call $guest_page_translate (local.get $p)) (local.get $step)))))
      (local.set $p (local.get $q))
      (local.set $n (i32.add (local.get $n) (i32.const 1)))
      (br $l)))
    (local.get $p))
  (func $uwc_shadow_put (param $w i32) (param $lo i32) (param $len i32) (param $k i32)
    (local $e i32) (local $first i32) (local $last i32)
    (local $alo i32) (local $ahi i32) (local $clo i32) (local $chi i32)
    (local.set $e (call $uwc_shadow (local.get $w)))
    (if (i32.and (i32.ne (i32.load (local.get $e)) (i32.const 0))
                 (i32.ne (i32.load (local.get $e)) (local.get $w)))
      (then (call $uwc_inc (i32.const 57))))
    (local.set $first (i32.and (local.get $lo) (i32.const 0xFFFFF000)))
    (local.set $last (i32.and (i32.add (local.get $lo) (i32.sub (local.get $len) (i32.const 1)))
                              (i32.const 0xFFFFF000)))
    (if (i32.eq (local.get $k) (i32.const 1))
      (then
        (local.set $alo (i32.sub (global.get $image_base) (global.get $GUEST_BASE)))
        (local.set $ahi (i32.add (local.get $alo) (region.end $DIRECT_WINDOW)))))
    (if (i32.eq (local.get $k) (i32.const 2))
      (then
        (local.set $alo (global.get $DIB_GUEST_BASE))
        (local.set $ahi (i32.add (local.get $alo) (global.get $DIB_GUEST_CAPACITY)))))
    (if (i32.eq (local.get $k) (i32.const 3))
      (then
        (local.set $alo (call $uwc_walk (local.get $first) (i32.const -4096) (i32.const 1)))
        (local.set $ahi (i32.add (call $uwc_walk (local.get $last) (i32.const 0x1000) (i32.const 1))
                                 (i32.const 0x1000)))
        (local.set $clo (call $uwc_walk (local.get $first) (i32.const -4096) (i32.const 0)))
        (local.set $chi (i32.add (call $uwc_walk (local.get $last) (i32.const 0x1000) (i32.const 0))
                                 (i32.const 0x1000)))
        (call $uwc_add (i32.const 58) (i32.shr_u (i32.sub (local.get $ahi) (local.get $alo)) (i32.const 12)))
        (call $uwc_add (i32.const 59) (i32.shr_u (i32.sub (local.get $chi) (local.get $clo)) (i32.const 12)))
        (call $uwc_inc (i32.const 60)))
      (else
        (local.set $clo (local.get $alo))
        (local.set $chi (local.get $ahi))))
    (i32.store (local.get $e) (local.get $w))
    (i32.store offset=4 (local.get $e) (local.get $k))
    (i32.store offset=8 (local.get $e) (local.get $first))
    (i32.store offset=12 (local.get $e) (local.get $last))
    (i32.store offset=16 (local.get $e) (local.get $alo))
    (i32.store offset=20 (local.get $e) (local.get $ahi))
    (i32.store offset=24 (local.get $e) (local.get $clo))
    (i32.store offset=28 (local.get $e) (local.get $chi)))
  ;; $uop_window_set with the census on: same answer, classified.
  (func $uwc_set (param $w i32) (param $lo i32) (param $len i32) (param $rw i32)
      (param $ctx i32) (result i32)
    (local $c i32) (local $r i32) (local $k i32)
    (local.set $c (i32.shl (local.get $ctx) (i32.const 4)))
    (call $uwc_inc (local.get $c))
    (global.set $uwc_in_uop (i32.const 1))
    (local.set $r (call $uop_window_set_raw (local.get $w) (local.get $lo)
                    (local.get $len) (local.get $rw)))
    (local.set $k (call $uwc_kind (local.get $lo)))
    (if (local.get $r)
      (then
        (if (i32.lt_u (local.get $k) (i32.const 3))
          (then (call $uwc_inc (i32.add (local.get $c) (local.get $k))))
          (else (call $uwc_inc (i32.add (local.get $c)
            (select (i32.const 3) (i32.const 4)
              (i32.eq (i32.and (local.get $lo) (i32.const 0xFFFFF000))
                (i32.and (i32.add (local.get $lo) (i32.sub (local.get $len) (i32.const 1)))
                  (i32.const 0xFFFFF000))))))))
        (call $uwc_shadow_put (local.get $w) (local.get $lo) (local.get $len) (local.get $k)))
      (else
        (call $uwc_shadow_drop (local.get $w))
        (if (i32.eqz (local.get $len))
          (then (call $uwc_inc (i32.add (local.get $c) (i32.const 11))))
          (else
            (if (i32.ne (call $g2w_affine_span (local.get $lo) (local.get $len))
                        (global.get $NULL_SENTINEL))
              (then (call $uwc_inc (i32.add (local.get $c) (i32.const 9)))
                    (call $uwc_inc (i32.add (i32.const 72) (local.get $k)))
                    (i64.store (i32.add (call $uwc_base)
                                 (i32.shl (i32.add (i32.const 80)
                                   (i32.and (i32.wrap_i64 (i64.load offset=608 (call $uwc_base))) (i32.const 15)))
                                   (i32.const 3)))
                               (i64.extend_i32_u (i32.and (local.get $lo) (i32.const 0xFFFFF000))))
                    (call $uwc_inc (i32.const 76)))
              (else
                (if (i32.eq (local.get $k) (i32.const 3))
                  (then (call $uwc_inc (i32.add (local.get $c)
                    (i32.add (i32.const 4) (global.get $gpas_why)))))
                  (else (call $uwc_inc (i32.add (local.get $c) (i32.const 12)))))))))))
    (global.set $uwc_in_uop (i32.const 0))
    (local.get $r))
  ;; $uop_reguard with the census on: classify against the slot's previous
  ;; window, then prove the page exactly as $uop_reguard does.
  (func $uwc_reguard (param $w i32) (param $ga i32) (param $size i32) (result i32)
    (local $e i32) (local $k i32) (local $b i32) (local $pg i32)
    (local.set $pg (i32.and (local.get $ga) (i32.const 0xFFFFF000)))
    (local.set $e (call $uwc_shadow (local.get $w)))
    (if (i32.eq (i32.load (local.get $e)) (local.get $w))
      (then
        (local.set $k (i32.load offset=4 (local.get $e)))
        (local.set $b (i32.add (i32.const 32) (i32.shl (i32.sub (local.get $k) (i32.const 1)) (i32.const 3))))
        (call $uwc_inc (local.get $b))
        (if (i32.or (i32.eq (local.get $pg) (i32.add (i32.load offset=12 (local.get $e)) (i32.const 0x1000)))
                    (i32.eq (local.get $pg) (i32.sub (i32.load offset=8 (local.get $e)) (i32.const 0x1000))))
          (then (call $uwc_inc (i32.add (local.get $b) (i32.const 1)))))
        (if (i32.lt_u (i32.sub (local.get $ga) (i32.load offset=16 (local.get $e)))
                      (i32.sub (i32.load offset=20 (local.get $e)) (i32.load offset=16 (local.get $e))))
          (then (call $uwc_inc (i32.add (local.get $b) (i32.const 2))))
          (else
            (if (i32.lt_u (i32.sub (local.get $ga) (i32.load offset=24 (local.get $e)))
                          (i32.sub (i32.load offset=28 (local.get $e)) (i32.load offset=24 (local.get $e))))
              (then
                (if (i32.and
                      (i32.ne (call $virtual_query_sparse_base (local.get $pg)) (i32.const 0))
                      (i32.eq (call $virtual_query_sparse_base (local.get $pg))
                              (call $virtual_query_sparse_base (i32.load offset=8 (local.get $e)))))
                  (then (call $uwc_inc (i32.add (local.get $b) (i32.const 3))))
                  (else (call $uwc_inc (i32.add (local.get $b) (i32.const 4))))))
              (else (call $uwc_inc (i32.add (local.get $b) (i32.const 5))))))))
      (else (call $uwc_inc (i32.const 56))))
    (if (i32.gt_u (i32.add (i32.and (local.get $ga) (i32.const 0xFFF)) (local.get $size))
                  (i32.const 0x1000))
      (then
        (call $uwc_inc (i32.const 16))
        (call $uwc_inc (i32.const 26))
        (return (i32.const 0))))
    (call $uwc_set (local.get $w) (local.get $pg) (i32.const 0x1000)
      (i32.load offset=12 (local.get $w)) (i32.const 1)))
  ;; $g2w_affine_span's sparse fallback, from anything but a window proof.
  (func $uwc_bulk_note (param $len i32) (param $wa i32)
    (if (global.get $uwc_in_uop) (then (return)))
    (call $uwc_inc (i32.const 64))
    (if (i32.ne (local.get $wa) (global.get $NULL_SENTINEL))
      (then (call $uwc_inc (i32.const 65)) (call $uwc_add (i32.const 71) (local.get $len)) (return)))
    (call $uwc_inc (i32.add (i32.const 65) (global.get $gpas_why)))
    (if (i32.eq (global.get $gpas_why) (i32.const 4))
      (then (call $uwc_add (i32.const 70) (local.get $len)))))
  (func (export "set_uop_win_census") (param $on i32)
    (if (local.get $on)
      (then (memory.fill (call $uwc_base) (i32.const 0) (i32.const 0x2400))))
    (global.set $uwc_on (i32.ne (local.get $on) (i32.const 0))))
  (func (export "uop_win_census") (param $k i32) (result f64)
    (f64.convert_i64_u (i64.load (i32.add (call $uwc_base)
      (i32.shl (i32.and (local.get $k) (i32.const 127)) (i32.const 3))))))

  ;; Run from $pc until an EXIT. $budget is block transfers, spent by every
  ;; branch op; answers what is left. $eip is the only global an EXIT writes:
  ;; the registers were never anywhere but $REGFILE.
  ;;
  ;; Two functions, so the dispatch loop makes NO calls. With a call anywhere
  ;; in it, Ion keeps $pc and $budget in stack slots across the whole loop
  ;; (tools/wasm-native.js --func='$uop_run': a store after every op and a
  ;; reload at the top of the next, on the pc chain every op depends on). So
  ;; $uop_fast runs until an op needs a call -- a window miss, GUARD, SAVECF,
  ;; GETCF, BCC -- and hands it back here with the op still at $pc; this loop
  ;; does the call and re-enters. A miss that re-guards re-runs its op, which
  ;; changed nothing before it looked at its window.
  ;; COPY / FILL's slow half ($uop_fast took nothing). Re-guard both windows
  ;; at the extent's low end, so the next run of this op can be the fast arm;
  ;; then, when every page of the extent is mapped and no destination page
  ;; would need a store barrier (decoded code -- the write could retire this
  ;; very program -- or a watched page), run it through 05b's
  ;; $rep_movs_mem / $rep_stos_mem, the threaded rep handlers' own code, and
  ;; leave the registers where they leave them. Otherwise nothing has been
  ;; written: exit to x and let the threaded rep run it. Answers the next pc.
  (global $uop_bulk_slow_n  (mut i32) (i32.const 0))
  (global $uop_bulk_deopt_n (mut i32) (i32.const 0))
  (func (export "uop_bulk_stats") (param $k i32) (result i32)
    (select (global.get $uop_bulk_deopt_n) (global.get $uop_bulk_slow_n) (local.get $k)))
  (func $uop_bulk_span_ok (param $lo i32) (param $len i32) (param $rw i32) (result i32)
    (local $p i32) (local $end i32)
    (if (i32.eqz (local.get $len)) (then (return (i32.const 1))))
    (local.set $end (i32.add (local.get $lo) (i32.sub (local.get $len) (i32.const 1))))
    (if (i32.lt_u (local.get $end) (local.get $lo)) (then (return (i32.const 0))))
    (local.set $p (local.get $lo))
    (loop $pages
      (if (i32.eqz (call $guest_addr_mapped (local.get $p))) (then (return (i32.const 0))))
      (if (i32.and (i32.ne (local.get $rw) (i32.const 0))
                   (call $store_page_needs_barrier (local.get $p)))
        (then (return (i32.const 0))))
      (if (i32.eq (i32.and (local.get $p) (i32.const 0xFFFFF000))
                  (i32.and (local.get $end) (i32.const 0xFFFFF000)))
        (then (return (i32.const 1))))
      (local.set $p (i32.add (i32.and (local.get $p) (i32.const 0xFFFFF000)) (i32.const 0x1000)))
      (br $pages))
    (unreachable))
  (func $uop_bulk_slow (param $pc i32) (result i32)
    (local $copy i32) (local $n i32) (local $wd i32) (local $bw i32) (local $back i32)
    (local $dlo i32) (local $slo i32) (local $step i32)
    (local.set $copy (i32.eq (i32.load (local.get $pc)) (i32.const 82)))
    (local.set $n (i32.load (i32.load offset=12 (local.get $pc))))
    (local.set $wd (i32.load offset=16 (local.get $pc)))
    (if (i32.eqz (local.get $n))
      (then (return (i32.add (local.get $pc) (select (i32.const 32) (i32.const 28) (local.get $copy))))))
    (global.set $uop_bulk_slow_n (i32.add (global.get $uop_bulk_slow_n) (i32.const 1)))
    ;; n * w wraps exactly as the threaded handlers' count does
    (local.set $bw (i32.mul (local.get $n) (local.get $wd)))
    (local.set $back (select (i32.sub (local.get $bw) (local.get $wd)) (i32.const 0) (global.get $df)))
    (local.set $dlo (i32.sub (i32.load (i32.load offset=4 (local.get $pc))) (local.get $back)))
    (drop (call $uop_reguard (i32.load offset=20 (local.get $pc)) (local.get $dlo) (i32.const 1)))
    (if (local.get $copy)
      (then
        (local.set $slo (i32.sub (i32.load (i32.load offset=8 (local.get $pc))) (local.get $back)))
        (drop (call $uop_reguard (i32.load offset=24 (local.get $pc)) (local.get $slo) (i32.const 1)))))
    (if (i32.or (i32.eqz (call $uop_bulk_span_ok (local.get $dlo) (local.get $bw) (i32.const 1)))
                (i32.and (local.get $copy)
                         (i32.eqz (call $uop_bulk_span_ok (local.get $slo) (local.get $bw) (i32.const 0)))))
      (then
        (global.set $uop_bulk_deopt_n (i32.add (global.get $uop_bulk_deopt_n) (i32.const 1)))
        (return (i32.load (i32.add (local.get $pc) (select (i32.const 28) (i32.const 24) (local.get $copy)))))))
    (local.set $step (select (i32.sub (i32.const 0) (local.get $bw)) (local.get $bw) (global.get $df)))
    (if (local.get $copy)
      (then
        (call $rep_movs_mem (i32.load (i32.load offset=4 (local.get $pc)))
                            (i32.load (i32.load offset=8 (local.get $pc)))
                            (local.get $n) (local.get $wd))
        (i32.store (i32.load offset=8 (local.get $pc))
          (i32.add (i32.load (i32.load offset=8 (local.get $pc))) (local.get $step))))
      (else
        (call $rep_stos_mem (i32.load (i32.load offset=4 (local.get $pc)))
                            (local.get $n) (local.get $wd)
                            (if (result i64) (i32.eq (local.get $wd) (i32.const 8))
                              (then (i64.load (i32.load offset=8 (local.get $pc))))
                              (else (i64.extend_i32_u (i32.load (i32.load offset=8 (local.get $pc)))))))))
    (i32.store (i32.load offset=4 (local.get $pc))
      (i32.add (i32.load (i32.load offset=4 (local.get $pc))) (local.get $step)))
    (i32.store (i32.load offset=12 (local.get $pc)) (i32.const 0))
    (i32.add (local.get $pc) (select (i32.const 32) (i32.const 28) (local.get $copy))))

  ;; MCOPY's slow half: re-guard both windows at the extents' low ends so
  ;; the next run can be the fast arm; then, when every page is mapped and no
  ;; destination page needs a store barrier, copy element by element in x86
  ;; order through $gl32/$gs32 (a page-straddling or overlapping run lands
  ;; here) and set v. Otherwise nothing has been written: exit to x, the
  ;; stub of the run's first load, and threaded code runs every pair.
  (global $uop_mcopy_slow_n  (mut i32) (i32.const 0))
  (global $uop_mcopy_deopt_n (mut i32) (i32.const 0))
  (func (export "uop_mcopy_stats") (param $k i32) (result i32)
    (select (global.get $uop_mcopy_deopt_n) (global.get $uop_mcopy_slow_n) (local.get $k)))
  (func $uop_mcopy_slow (param $pc i32) (result i32)
    (local $n i32) (local $bw i32) (local $d i32) (local $s i32) (local $i i32)
    (global.set $uop_mcopy_slow_n (i32.add (global.get $uop_mcopy_slow_n) (i32.const 1)))
    (local.set $n (i32.load offset=12 (local.get $pc)))
    (local.set $bw (i32.shl (local.get $n) (i32.const 2)))
    (local.set $d (i32.load (i32.load offset=4 (local.get $pc))))
    (local.set $s (i32.load (i32.load offset=8 (local.get $pc))))
    (drop (call $uop_reguard (i32.load offset=20 (local.get $pc)) (local.get $d) (i32.const 4)))
    (drop (call $uop_reguard (i32.load offset=24 (local.get $pc)) (local.get $s) (i32.const 4)))
    (if (i32.or (i32.eqz (call $uop_bulk_span_ok (local.get $d) (local.get $bw) (i32.const 1)))
                (i32.eqz (call $uop_bulk_span_ok (local.get $s) (local.get $bw) (i32.const 0))))
      (then
        (global.set $uop_mcopy_deopt_n (i32.add (global.get $uop_mcopy_deopt_n) (i32.const 1)))
        (return (i32.load offset=28 (local.get $pc)))))
    (block $done (loop $copy
      (br_if $done (i32.ge_u (local.get $i) (local.get $bw)))
      (call $gs32 (i32.add (local.get $d) (local.get $i)) (call $gl32 (i32.add (local.get $s) (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 4)))
      (br $copy)))
    (i32.store (i32.load offset=16 (local.get $pc))
      (call $gl32 (i32.sub (i32.add (local.get $d) (local.get $bw)) (i32.const 4))))
    (i32.add (local.get $pc) (i32.const 32)))

  (global $uop_io_kind   (mut i32) (i32.const 0)) ;; 0 exited, 1 service op at pc, 2 window miss
  (global $uop_io_budget (mut i32) (i32.const 0))
  (global $uop_io_ga     (mut i32) (i32.const 0))
  (global $uop_io_w      (mut i32) (i32.const 0))
  (func $uop_run (param $pc i32) (param $budget i32) (result i32)
    (local $op i32)
    (loop $L
      (local.set $pc (call $uop_fast (local.get $pc) (local.get $budget)))
      (local.set $budget (global.get $uop_io_budget))
      (if (i32.eqz (global.get $uop_io_kind)) (then (return (local.get $budget))))
      (local.set $op (i32.load (local.get $pc)))
      (if (i32.eq (global.get $uop_io_kind) (i32.const 2))
        (then
          (if (call $uop_reguard (global.get $uop_io_w) (global.get $uop_io_ga)
                ;; access size: 32-bit forms 4, LDX64/STX64 8, 16-bit 2, byte 1
                (if (result i32) (i32.or (i32.or (i32.eq (local.get $op) (i32.const 13))
                                                 (i32.eq (local.get $op) (i32.const 17)))
                                         (i32.or (i32.eq (local.get $op) (i32.const 33))
                                                 (i32.eq (local.get $op) (i32.const 38))))
                  (then (i32.const 4))
                  (else (if (result i32) (i32.or (i32.or (i32.eq (local.get $op) (i32.const 72))
                                                         (i32.eq (local.get $op) (i32.const 73)))
                                                 (i32.eq (local.get $op) (i32.const 91)))
                  (then (i32.const 8))
                  (else (if (result i32)
                          (i32.or (i32.or (i32.eq (local.get $op) (i32.const 16))
                                          (i32.or (i32.eq (local.get $op) (i32.const 19))
                                                  (i32.eq (local.get $op) (i32.const 29))))
                                  (i32.or (i32.eq (local.get $op) (i32.const 34))
                                          (i32.or (i32.eq (local.get $op) (i32.const 35))
                                                  (i32.eq (local.get $op) (i32.const 39)))))
                          (then (i32.const 2)) (else (i32.const 1))))))))
            (then (br $L)))
          ;; Its deopt stub: x is the last operand -- offset 20 in the
          ;; 5-operand forms, 24 in LD8UX/LD16UX2, 28 in LDX*/STX*.
          (local.set $pc (i32.load (i32.add (local.get $pc)
            (if (result i32) (i32.eq (local.get $op) (i32.const 91))
              (then (i32.const 32))
            (else (if (result i32) (i32.ge_u (local.get $op) (i32.const 33))
              (then (i32.const 28))
              (else (if (result i32) (i32.or (i32.eq (local.get $op) (i32.const 15))
                                             (i32.eq (local.get $op) (i32.const 16)))
                      (then (i32.const 24)) (else (i32.const 20))))))))))
          (br $L)))
      ;; 26 GUARD w base disp len rw x
      (if (i32.eq (local.get $op) (i32.const 26))
        (then
          (if (call $uop_window_set (i32.load offset=4 (local.get $pc))
                (i32.add (i32.load (i32.load offset=8 (local.get $pc)))
                         (i32.load offset=12 (local.get $pc)))
                (i32.load offset=16 (local.get $pc))
                (i32.load offset=20 (local.get $pc)))
            (then (local.set $pc (i32.add (local.get $pc) (i32.const 28))) (br $L)))
          (global.set $uop_guard_fails (i32.add (global.get $uop_guard_fails) (i32.const 1)))
          (local.set $pc (i32.load offset=24 (local.get $pc)))
          (br $L)))
      ;; 31 SAVECF
      (if (i32.eq (local.get $op) (i32.const 31))
        (then
          (global.set $saved_cf (call $get_cf))
          (local.set $pc (i32.add (local.get $pc) (i32.const 4))) (br $L)))
      ;; 55 GETCF d
      (if (i32.eq (local.get $op) (i32.const 55))
        (then
          (i32.store (i32.load offset=4 (local.get $pc)) (call $get_cf))
          (local.set $pc (i32.add (local.get $pc) (i32.const 8))) (br $L)))
      ;; 66 GETCC d cc
      (if (i32.eq (local.get $op) (i32.const 66))
        (then
          (i32.store (i32.load offset=4 (local.get $pc)) (call $eval_cc (i32.load offset=8 (local.get $pc))))
          (local.set $pc (i32.add (local.get $pc) (i32.const 12))) (br $L)))
      ;; 67 SPILL s base disp: an elided push's slot, back to memory in a
      ;; stub before leaving (07e $uc_spill_at); the threaded path's store
      (if (i32.eq (local.get $op) (i32.const 67))
        (then
          (call $gs32 (i32.add (i32.load (i32.load offset=8 (local.get $pc))) (i32.load offset=12 (local.get $pc)))
                      (i32.load (i32.load offset=4 (local.get $pc))))
          (local.set $pc (i32.add (local.get $pc) (i32.const 16))) (br $L)))
      ;; 71 ICG v t cls eip x: $uop_fast hands over only a failing guard
      (if (i32.eq (local.get $op) (i32.const 71))
        (then
          (if (i32.load offset=12 (local.get $pc))
            (then (global.set $uop_icg_fail1 (i32.add (global.get $uop_icg_fail1) (i32.const 1))))
            (else (global.set $uop_icg_fail0 (i32.add (global.get $uop_icg_fail0) (i32.const 1)))))
          (call $uop_icg_note (i32.load offset=16 (local.get $pc)))
          (call $uop_icg_count (i32.load offset=16 (local.get $pc)))
          (local.set $pc (i32.load offset=20 (local.get $pc))) (br $L)))
      ;; 82 COPY / 83 FILL: everything the fast arm would not take
      (if (i32.or (i32.eq (local.get $op) (i32.const 82)) (i32.eq (local.get $op) (i32.const 83)))
        (then (local.set $pc (call $uop_bulk_slow (local.get $pc))) (br $L)))
      ;; 85 MCOPY: likewise
      (if (i32.eq (local.get $op) (i32.const 85))
        (then (local.set $pc (call $uop_mcopy_slow (local.get $pc))) (br $L)))
      ;; 57 BCC cc t
      (local.set $budget (i32.sub (local.get $budget) (i32.const 1)))
      (local.set $pc
        (select (i32.load offset=8 (local.get $pc)) (i32.add (local.get $pc) (i32.const 12))
                (call $eval_cc (i32.load offset=4 (local.get $pc)))))
      (br $L))
    (unreachable))

  (func $uop_fast (param $pc i32) (param $budget i32) (result i32)
    (local $ga i32) (local $w i32) (local $v i32) (local $x i64) (local $y i64) (local $q i64)
    (local $n i32) (local $bw i32) (local $dw i32) (local $sw i32)
    (loop $L
      (block $svc
      (block $miss
      (block $c85 (block $c84 (block $c83 (block $c82 (block $c81 (block $c78
      (block $c77 (block $c76 (block $mxcore (block $c75 (block $c74
      (block $c86 (block $c87 (block $c88 (block $c89 (block $c90 (block $c91
      (block $c73 (block $c72
      (block $c71 (block $c70 (block $c69 (block $c68
      (block $c67 (block $c66 (block $c65 (block $c64 (block $c63 (block $c62 (block $c61 (block $c60 (block $c59 (block $c58 (block $c57 (block $c56
      (block $c55 (block $c54 (block $c53 (block $c52 (block $c51 (block $c50
      (block $c49 (block $c48 (block $c47 (block $c46 (block $c45 (block $c44
      (block $c43 (block $c42 (block $c41 (block $c40 (block $c39 (block $c38
      (block $c37 (block $c36 (block $c35 (block $c34 (block $c33 (block $c32
      (block $c31 (block $c30 (block $c29 (block $c28 (block $c27 (block $c26 (block $c25
      (block $c24 (block $c23 (block $c22 (block $c21 (block $c20 (block $c19
      (block $c18 (block $c17 (block $c16 (block $c15 (block $c14 (block $c13
      (block $c12 (block $c11 (block $c10 (block $c9 (block $c8 (block $c7
      (block $c6 (block $c5 (block $c4 (block $c3 (block $c2 (block $c1 (block $c0
        (br_table $c0 $c1 $c2 $c3 $c4 $c5 $c6 $c7 $c8 $c9 $c10 $c11 $c12 $c13
                  $c14 $c15 $c16 $c17 $c18 $c19 $c20 $c21 $c22 $c23 $c24 $c25
                  $c26 $c27 $c28 $c29 $c30 $c31 $c32 $c33 $c34 $c35 $c36 $c37
                  $c38 $c39 $c40 $c41 $c42 $c43 $c44 $c45 $c46 $c47 $c48 $c49
                  $c50 $c51 $c52 $c53 $c54 $c55 $c56 $c57 $c58 $c59 $c60 $c61 $c62 $c63
                  $c64 $c65 $c66 $c67 $c68 $c69 $c70 $c71
                  $c72 $c73 $c74 $c75 $c76 $c77
                  $c78
                  ;; 79-80 are not emitted
                  $c0 $c0
                  $c81 $c82 $c83 $c84 $c85
                  $c86 $c87 $c88 $c89 $c90 $c91
                  $c0
                  (i32.load (local.get $pc))))
        ;; 0 EXIT eip
        (global.set $eip (i32.load offset=4 (local.get $pc)))
        (global.set $uop_io_kind (i32.const 0))
        (global.set $uop_io_budget (local.get $budget))
        (return (local.get $pc)))
        ;; 1 MOVI d i
        (i32.store (i32.load offset=4 (local.get $pc)) (i32.load offset=8 (local.get $pc)))
        (local.set $pc (i32.add (local.get $pc) (i32.const 12))) (br $L))
        ;; 2 MOV d a
        (i32.store (i32.load offset=4 (local.get $pc))
          (i32.load (i32.load offset=8 (local.get $pc))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 12))) (br $L))
        ;; 3 ADD d a b
        (i32.store (i32.load offset=4 (local.get $pc))
          (i32.add (i32.load (i32.load offset=8 (local.get $pc)))
                   (i32.load (i32.load offset=12 (local.get $pc)))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 16))) (br $L))
        ;; 4 SUB
        (i32.store (i32.load offset=4 (local.get $pc))
          (i32.sub (i32.load (i32.load offset=8 (local.get $pc)))
                   (i32.load (i32.load offset=12 (local.get $pc)))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 16))) (br $L))
        ;; 5 AND
        (i32.store (i32.load offset=4 (local.get $pc))
          (i32.and (i32.load (i32.load offset=8 (local.get $pc)))
                   (i32.load (i32.load offset=12 (local.get $pc)))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 16))) (br $L))
        ;; 6 OR
        (i32.store (i32.load offset=4 (local.get $pc))
          (i32.or (i32.load (i32.load offset=8 (local.get $pc)))
                  (i32.load (i32.load offset=12 (local.get $pc)))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 16))) (br $L))
        ;; 7 XOR
        (i32.store (i32.load offset=4 (local.get $pc))
          (i32.xor (i32.load (i32.load offset=8 (local.get $pc)))
                   (i32.load (i32.load offset=12 (local.get $pc)))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 16))) (br $L))
        ;; 8 ADDI d a i
        (i32.store (i32.load offset=4 (local.get $pc))
          (i32.add (i32.load (i32.load offset=8 (local.get $pc)))
                   (i32.load offset=12 (local.get $pc))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 16))) (br $L))
        ;; 9 ANDI
        (i32.store (i32.load offset=4 (local.get $pc))
          (i32.and (i32.load (i32.load offset=8 (local.get $pc)))
                   (i32.load offset=12 (local.get $pc))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 16))) (br $L))
        ;; 10 SHLI
        (i32.store (i32.load offset=4 (local.get $pc))
          (i32.shl (i32.load (i32.load offset=8 (local.get $pc)))
                   (i32.load offset=12 (local.get $pc))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 16))) (br $L))
        ;; 11 SHRI
        (i32.store (i32.load offset=4 (local.get $pc))
          (i32.shr_u (i32.load (i32.load offset=8 (local.get $pc)))
                     (i32.load offset=12 (local.get $pc))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 16))) (br $L))
        ;; 12 SARI
        (i32.store (i32.load offset=4 (local.get $pc))
          (i32.shr_s (i32.load (i32.load offset=8 (local.get $pc)))
                     (i32.load offset=12 (local.get $pc))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 16))) (br $L))
        ;; 13 LD32 d base disp w x
        (local.set $ga (i32.add (i32.load (i32.load offset=8 (local.get $pc)))
                                (i32.load offset=12 (local.get $pc))))
        (local.set $w (i32.load offset=16 (local.get $pc)))
        (if (i32.gt_u (i32.sub (local.get $ga) (i32.load (local.get $w)))
                      (i32.sub (i32.load offset=4 (local.get $w)) (i32.const 4)))
          (then (br $miss)))
        (i32.store (i32.load offset=4 (local.get $pc))
          (i32.load (i32.add (local.get $ga) (i32.load offset=8 (local.get $w)))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 24))) (br $L))
        ;; 14 LD8U d base disp w x
        (local.set $ga (i32.add (i32.load (i32.load offset=8 (local.get $pc)))
                                (i32.load offset=12 (local.get $pc))))
        (local.set $w (i32.load offset=16 (local.get $pc)))
        (if (i32.ge_u (i32.sub (local.get $ga) (i32.load (local.get $w)))
                      (i32.load offset=4 (local.get $w)))
          (then (br $miss)))
        (i32.store (i32.load offset=4 (local.get $pc))
          (i32.load8_u (i32.add (local.get $ga) (i32.load offset=8 (local.get $w)))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 24))) (br $L))
        ;; 15 LD8UX d base idx disp w x
        (local.set $ga (i32.add (i32.add (i32.load (i32.load offset=8 (local.get $pc)))
                                         (i32.load (i32.load offset=12 (local.get $pc))))
                                (i32.load offset=16 (local.get $pc))))
        (local.set $w (i32.load offset=20 (local.get $pc)))
        (if (i32.ge_u (i32.sub (local.get $ga) (i32.load (local.get $w)))
                      (i32.load offset=4 (local.get $w)))
          (then (br $miss)))
        (i32.store (i32.load offset=4 (local.get $pc))
          (i32.load8_u (i32.add (local.get $ga) (i32.load offset=8 (local.get $w)))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 28))) (br $L))
        ;; 16 LD16UX2 d base idx disp w x
        (local.set $ga (i32.add (i32.add (i32.load (i32.load offset=8 (local.get $pc)))
                                         (i32.shl (i32.load (i32.load offset=12 (local.get $pc)))
                                                  (i32.const 1)))
                                (i32.load offset=16 (local.get $pc))))
        (local.set $w (i32.load offset=20 (local.get $pc)))
        (if (i32.gt_u (i32.sub (local.get $ga) (i32.load (local.get $w)))
                      (i32.sub (i32.load offset=4 (local.get $w)) (i32.const 2)))
          (then (br $miss)))
        (i32.store (i32.load offset=4 (local.get $pc))
          (i32.load16_u (i32.add (local.get $ga) (i32.load offset=8 (local.get $w)))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 28))) (br $L))
        ;; 17 ST32 s base disp w x
        (local.set $ga (i32.add (i32.load (i32.load offset=8 (local.get $pc)))
                                (i32.load offset=12 (local.get $pc))))
        (local.set $w (i32.load offset=16 (local.get $pc)))
        (if (i32.gt_u (i32.sub (local.get $ga) (i32.load (local.get $w)))
                      (i32.sub (i32.load offset=4 (local.get $w)) (i32.const 4)))
          (then (br $miss)))
        (i32.store (i32.add (local.get $ga) (i32.load offset=8 (local.get $w)))
          (i32.load (i32.load offset=4 (local.get $pc))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 24))) (br $L))
        ;; 18 ST8 s base disp w x
        (local.set $ga (i32.add (i32.load (i32.load offset=8 (local.get $pc)))
                                (i32.load offset=12 (local.get $pc))))
        (local.set $w (i32.load offset=16 (local.get $pc)))
        (if (i32.ge_u (i32.sub (local.get $ga) (i32.load (local.get $w)))
                      (i32.load offset=4 (local.get $w)))
          (then (br $miss)))
        (i32.store8 (i32.add (local.get $ga) (i32.load offset=8 (local.get $w)))
          (i32.load (i32.load offset=4 (local.get $pc))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 24))) (br $L))
        ;; 19 ST16 s base disp w x
        (local.set $ga (i32.add (i32.load (i32.load offset=8 (local.get $pc)))
                                (i32.load offset=12 (local.get $pc))))
        (local.set $w (i32.load offset=16 (local.get $pc)))
        (if (i32.gt_u (i32.sub (local.get $ga) (i32.load (local.get $w)))
                      (i32.sub (i32.load offset=4 (local.get $w)) (i32.const 2)))
          (then (br $miss)))
        (i32.store16 (i32.add (local.get $ga) (i32.load offset=8 (local.get $w)))
          (i32.load (i32.load offset=4 (local.get $pc))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 24))) (br $L))
        ;; 20 MERGE8L d a b
        (i32.store (i32.load offset=4 (local.get $pc))
          (i32.or (i32.and (i32.load (i32.load offset=8 (local.get $pc))) (i32.const 0xFFFFFF00))
                  (i32.and (i32.load (i32.load offset=12 (local.get $pc))) (i32.const 0xFF))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 16))) (br $L))
        ;; 21 BNEZ a t
        (local.set $budget (i32.sub (local.get $budget) (i32.const 1)))
        (local.set $pc
          (select (i32.load offset=8 (local.get $pc)) (i32.add (local.get $pc) (i32.const 12))
                  (i32.load (i32.load offset=4 (local.get $pc)))))
        (br $L))
        ;; 22 BEQZ a t
        (local.set $budget (i32.sub (local.get $budget) (i32.const 1)))
        (local.set $pc
          (select (i32.add (local.get $pc) (i32.const 12)) (i32.load offset=8 (local.get $pc))
                  (i32.load (i32.load offset=4 (local.get $pc)))))
        (br $L))
        ;; 23 BNE a b t
        (local.set $budget (i32.sub (local.get $budget) (i32.const 1)))
        (local.set $pc
          (select (i32.load offset=12 (local.get $pc)) (i32.add (local.get $pc) (i32.const 16))
                  (i32.ne (i32.load (i32.load offset=4 (local.get $pc)))
                          (i32.load (i32.load offset=8 (local.get $pc))))))
        (br $L))
        ;; 24 BLTU a b t
        (local.set $budget (i32.sub (local.get $budget) (i32.const 1)))
        (local.set $pc
          (select (i32.load offset=12 (local.get $pc)) (i32.add (local.get $pc) (i32.const 16))
                  (i32.lt_u (i32.load (i32.load offset=4 (local.get $pc)))
                            (i32.load (i32.load offset=8 (local.get $pc))))))
        (br $L))
        ;; 25 JMP t
        (local.set $budget (i32.sub (local.get $budget) (i32.const 1)))
        (local.set $pc (i32.load offset=4 (local.get $pc)))
        (br $L))
        ;; 26 GUARD -- calls $uop_window_set: $uop_run does it
        (br $svc))
        ;; 27 CLOCK n x
        (local.set $budget (i32.sub (local.get $budget) (i32.load offset=4 (local.get $pc))))
        (local.set $pc
          (select (i32.add (local.get $pc) (i32.const 12)) (i32.load offset=8 (local.get $pc))
                  (i32.gt_s (local.get $budget) (i32.const 0))))
        (br $L))
        ;; 28 REC op a b res shift
        (global.set $flag_op (i32.load offset=4 (local.get $pc)))
        (global.set $flag_a (i32.load (i32.load offset=8 (local.get $pc))))
        (global.set $flag_b (i32.load (i32.load offset=12 (local.get $pc))))
        (global.set $flag_res (i32.load (i32.load offset=16 (local.get $pc))))
        (global.set $flag_sign_shift (i32.load offset=20 (local.get $pc)))
        (local.set $pc (i32.add (local.get $pc) (i32.const 24))) (br $L))
        ;; 29 LD16U d base disp w x
        (local.set $ga (i32.add (i32.load (i32.load offset=8 (local.get $pc)))
                                (i32.load offset=12 (local.get $pc))))
        (local.set $w (i32.load offset=16 (local.get $pc)))
        (if (i32.gt_u (i32.sub (local.get $ga) (i32.load (local.get $w)))
                      (i32.sub (i32.load offset=4 (local.get $w)) (i32.const 2)))
          (then (br $miss)))
        (i32.store (i32.load offset=4 (local.get $pc))
          (i32.load16_u (i32.add (local.get $ga) (i32.load offset=8 (local.get $w)))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 24))) (br $L))
        ;; 30 BGEU a b t
        (local.set $budget (i32.sub (local.get $budget) (i32.const 1)))
        (local.set $pc
          (select (i32.load offset=12 (local.get $pc)) (i32.add (local.get $pc) (i32.const 16))
                  (i32.ge_u (i32.load (i32.load offset=4 (local.get $pc)))
                            (i32.load (i32.load offset=8 (local.get $pc))))))
        (br $L))
        ;; 31 SAVECF -- calls $get_cf: $uop_run does it
        (br $svc))
        ;; 32 LEA d base idx sc disp
        (i32.store (i32.load offset=4 (local.get $pc))
          (i32.add (i32.add (i32.load (i32.load offset=8 (local.get $pc)))
                            (i32.shl (i32.load (i32.load offset=12 (local.get $pc)))
                                     (i32.load offset=16 (local.get $pc))))
                   (i32.load offset=20 (local.get $pc))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 24))) (br $L))
        ;; 33 LDX32 d base idx sc disp w x
        (local.set $ga (i32.add (i32.add (i32.load (i32.load offset=8 (local.get $pc)))
                                         (i32.shl (i32.load (i32.load offset=12 (local.get $pc)))
                                                  (i32.load offset=16 (local.get $pc))))
                                (i32.load offset=20 (local.get $pc))))
        (local.set $w (i32.load offset=24 (local.get $pc)))
        (if (i32.gt_u (i32.sub (local.get $ga) (i32.load (local.get $w)))
                      (i32.sub (i32.load offset=4 (local.get $w)) (i32.const 4)))
          (then (br $miss)))
        (i32.store (i32.load offset=4 (local.get $pc))
          (i32.load (i32.add (local.get $ga) (i32.load offset=8 (local.get $w)))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 32))) (br $L))
        ;; 34 LDX16U
        (local.set $ga (i32.add (i32.add (i32.load (i32.load offset=8 (local.get $pc)))
                                         (i32.shl (i32.load (i32.load offset=12 (local.get $pc)))
                                                  (i32.load offset=16 (local.get $pc))))
                                (i32.load offset=20 (local.get $pc))))
        (local.set $w (i32.load offset=24 (local.get $pc)))
        (if (i32.gt_u (i32.sub (local.get $ga) (i32.load (local.get $w)))
                      (i32.sub (i32.load offset=4 (local.get $w)) (i32.const 2)))
          (then (br $miss)))
        (i32.store (i32.load offset=4 (local.get $pc))
          (i32.load16_u (i32.add (local.get $ga) (i32.load offset=8 (local.get $w)))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 32))) (br $L))
        ;; 35 LDX16S
        (local.set $ga (i32.add (i32.add (i32.load (i32.load offset=8 (local.get $pc)))
                                         (i32.shl (i32.load (i32.load offset=12 (local.get $pc)))
                                                  (i32.load offset=16 (local.get $pc))))
                                (i32.load offset=20 (local.get $pc))))
        (local.set $w (i32.load offset=24 (local.get $pc)))
        (if (i32.gt_u (i32.sub (local.get $ga) (i32.load (local.get $w)))
                      (i32.sub (i32.load offset=4 (local.get $w)) (i32.const 2)))
          (then (br $miss)))
        (i32.store (i32.load offset=4 (local.get $pc))
          (i32.load16_s (i32.add (local.get $ga) (i32.load offset=8 (local.get $w)))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 32))) (br $L))
        ;; 36 LDX8U
        (local.set $ga (i32.add (i32.add (i32.load (i32.load offset=8 (local.get $pc)))
                                         (i32.shl (i32.load (i32.load offset=12 (local.get $pc)))
                                                  (i32.load offset=16 (local.get $pc))))
                                (i32.load offset=20 (local.get $pc))))
        (local.set $w (i32.load offset=24 (local.get $pc)))
        (if (i32.ge_u (i32.sub (local.get $ga) (i32.load (local.get $w)))
                      (i32.load offset=4 (local.get $w)))
          (then (br $miss)))
        (i32.store (i32.load offset=4 (local.get $pc))
          (i32.load8_u (i32.add (local.get $ga) (i32.load offset=8 (local.get $w)))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 32))) (br $L))
        ;; 37 LDX8S
        (local.set $ga (i32.add (i32.add (i32.load (i32.load offset=8 (local.get $pc)))
                                         (i32.shl (i32.load (i32.load offset=12 (local.get $pc)))
                                                  (i32.load offset=16 (local.get $pc))))
                                (i32.load offset=20 (local.get $pc))))
        (local.set $w (i32.load offset=24 (local.get $pc)))
        (if (i32.ge_u (i32.sub (local.get $ga) (i32.load (local.get $w)))
                      (i32.load offset=4 (local.get $w)))
          (then (br $miss)))
        (i32.store (i32.load offset=4 (local.get $pc))
          (i32.load8_s (i32.add (local.get $ga) (i32.load offset=8 (local.get $w)))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 32))) (br $L))
        ;; 38 STX32 s base idx sc disp w x
        (local.set $ga (i32.add (i32.add (i32.load (i32.load offset=8 (local.get $pc)))
                                         (i32.shl (i32.load (i32.load offset=12 (local.get $pc)))
                                                  (i32.load offset=16 (local.get $pc))))
                                (i32.load offset=20 (local.get $pc))))
        (local.set $w (i32.load offset=24 (local.get $pc)))
        (if (i32.gt_u (i32.sub (local.get $ga) (i32.load (local.get $w)))
                      (i32.sub (i32.load offset=4 (local.get $w)) (i32.const 4)))
          (then (br $miss)))
        (i32.store (i32.add (local.get $ga) (i32.load offset=8 (local.get $w)))
          (i32.load (i32.load offset=4 (local.get $pc))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 32))) (br $L))
        ;; 39 STX16
        (local.set $ga (i32.add (i32.add (i32.load (i32.load offset=8 (local.get $pc)))
                                         (i32.shl (i32.load (i32.load offset=12 (local.get $pc)))
                                                  (i32.load offset=16 (local.get $pc))))
                                (i32.load offset=20 (local.get $pc))))
        (local.set $w (i32.load offset=24 (local.get $pc)))
        (if (i32.gt_u (i32.sub (local.get $ga) (i32.load (local.get $w)))
                      (i32.sub (i32.load offset=4 (local.get $w)) (i32.const 2)))
          (then (br $miss)))
        (i32.store16 (i32.add (local.get $ga) (i32.load offset=8 (local.get $w)))
          (i32.load (i32.load offset=4 (local.get $pc))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 32))) (br $L))
        ;; 40 STX8
        (local.set $ga (i32.add (i32.add (i32.load (i32.load offset=8 (local.get $pc)))
                                         (i32.shl (i32.load (i32.load offset=12 (local.get $pc)))
                                                  (i32.load offset=16 (local.get $pc))))
                                (i32.load offset=20 (local.get $pc))))
        (local.set $w (i32.load offset=24 (local.get $pc)))
        (if (i32.ge_u (i32.sub (local.get $ga) (i32.load (local.get $w)))
                      (i32.load offset=4 (local.get $w)))
          (then (br $miss)))
        (i32.store8 (i32.add (local.get $ga) (i32.load offset=8 (local.get $w)))
          (i32.load (i32.load offset=4 (local.get $pc))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 32))) (br $L))
        ;; 41 ORI d a i
        (i32.store (i32.load offset=4 (local.get $pc))
          (i32.or (i32.load (i32.load offset=8 (local.get $pc)))
                  (i32.load offset=12 (local.get $pc))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 16))) (br $L))
        ;; 42 XORI d a i
        (i32.store (i32.load offset=4 (local.get $pc))
          (i32.xor (i32.load (i32.load offset=8 (local.get $pc)))
                   (i32.load offset=12 (local.get $pc))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 16))) (br $L))
        ;; 43 SHL d a b
        (i32.store (i32.load offset=4 (local.get $pc))
          (i32.shl (i32.load (i32.load offset=8 (local.get $pc)))
                   (i32.load (i32.load offset=12 (local.get $pc)))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 16))) (br $L))
        ;; 44 SHR
        (i32.store (i32.load offset=4 (local.get $pc))
          (i32.shr_u (i32.load (i32.load offset=8 (local.get $pc)))
                     (i32.load (i32.load offset=12 (local.get $pc)))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 16))) (br $L))
        ;; 45 SAR
        (i32.store (i32.load offset=4 (local.get $pc))
          (i32.shr_s (i32.load (i32.load offset=8 (local.get $pc)))
                     (i32.load (i32.load offset=12 (local.get $pc)))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 16))) (br $L))
        ;; 46 MUL
        (i32.store (i32.load offset=4 (local.get $pc))
          (i32.mul (i32.load (i32.load offset=8 (local.get $pc)))
                   (i32.load (i32.load offset=12 (local.get $pc)))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 16))) (br $L))
        ;; 47 SEXT8 d a
        (i32.store (i32.load offset=4 (local.get $pc))
          (i32.extend8_s (i32.load (i32.load offset=8 (local.get $pc)))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 12))) (br $L))
        ;; 48 SEXT16 d a
        (i32.store (i32.load offset=4 (local.get $pc))
          (i32.extend16_s (i32.load (i32.load offset=8 (local.get $pc)))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 12))) (br $L))
        ;; 49 MERGE16L d a b
        (i32.store (i32.load offset=4 (local.get $pc))
          (i32.or (i32.and (i32.load (i32.load offset=8 (local.get $pc))) (i32.const 0xFFFF0000))
                  (i32.and (i32.load (i32.load offset=12 (local.get $pc))) (i32.const 0xFFFF))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 16))) (br $L))
        ;; 50 MERGE8H d a b   d = a&~0xFF00 | (b&0xFF)<<8
        (i32.store (i32.load offset=4 (local.get $pc))
          (i32.or (i32.and (i32.load (i32.load offset=8 (local.get $pc))) (i32.const 0xFFFF00FF))
                  (i32.shl (i32.and (i32.load (i32.load offset=12 (local.get $pc))) (i32.const 0xFF))
                           (i32.const 8))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 16))) (br $L))
        ;; 51 BEQ a b t
        (local.set $budget (i32.sub (local.get $budget) (i32.const 1)))
        (local.set $pc
          (select (i32.load offset=12 (local.get $pc)) (i32.add (local.get $pc) (i32.const 16))
                  (i32.eq (i32.load (i32.load offset=4 (local.get $pc)))
                          (i32.load (i32.load offset=8 (local.get $pc))))))
        (br $L))
        ;; 52 BLT a b t (signed)
        (local.set $budget (i32.sub (local.get $budget) (i32.const 1)))
        (local.set $pc
          (select (i32.load offset=12 (local.get $pc)) (i32.add (local.get $pc) (i32.const 16))
                  (i32.lt_s (i32.load (i32.load offset=4 (local.get $pc)))
                            (i32.load (i32.load offset=8 (local.get $pc))))))
        (br $L))
        ;; 53 BGE a b t (signed)
        (local.set $budget (i32.sub (local.get $budget) (i32.const 1)))
        (local.set $pc
          (select (i32.load offset=12 (local.get $pc)) (i32.add (local.get $pc) (i32.const 16))
                  (i32.ge_s (i32.load (i32.load offset=4 (local.get $pc)))
                            (i32.load (i32.load offset=8 (local.get $pc))))))
        (br $L))
        ;; 54 SLTU d a b
        (i32.store (i32.load offset=4 (local.get $pc))
          (i32.lt_u (i32.load (i32.load offset=8 (local.get $pc)))
                    (i32.load (i32.load offset=12 (local.get $pc)))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 16))) (br $L))
        ;; 55 GETCF d -- calls $get_cf: $uop_run does it
        (br $svc))
        ;; 56 RECF op a b res shift scf
        (global.set $flag_op (i32.load offset=4 (local.get $pc)))
        (global.set $flag_a (i32.load (i32.load offset=8 (local.get $pc))))
        (global.set $flag_b (i32.load (i32.load offset=12 (local.get $pc))))
        (global.set $flag_res (i32.load (i32.load offset=16 (local.get $pc))))
        (global.set $flag_sign_shift (i32.load offset=20 (local.get $pc)))
        (global.set $saved_cf (i32.load (i32.load offset=24 (local.get $pc))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 28))) (br $L))
        ;; 57 BCC cc t -- calls $eval_cc: $uop_run does it
        (br $svc))
        ;; 58 CHK x -- just before a charged transfer: with no budget left
        ;; threaded code stops at that transfer, so exit to it (x re-runs the
        ;; branch in threaded code, whose $branch_end then ends the batch).
        (local.set $pc
          (select (i32.add (local.get $pc) (i32.const 8)) (i32.load offset=4 (local.get $pc))
                  (i32.gt_s (local.get $budget) (i32.const 0))))
        (br $L))
        ;; 59 MULOF d a b
        (local.set $v (i32.mul (i32.load (i32.load offset=8 (local.get $pc)))
                               (i32.load (i32.load offset=12 (local.get $pc)))))
        (i32.store (i32.load offset=4 (local.get $pc))
          (i64.ne (i64.mul (i64.extend_i32_s (i32.load (i32.load offset=8 (local.get $pc))))
                           (i64.extend_i32_s (i32.load (i32.load offset=12 (local.get $pc)))))
                  (i64.extend_i32_s (local.get $v))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 16))) (br $L))
        ;; 60 EXTH d a
        (i32.store (i32.load offset=4 (local.get $pc))
          (i32.and (i32.shr_u (i32.load (i32.load offset=8 (local.get $pc))) (i32.const 8))
                   (i32.const 0xFF)))
        (local.set $pc (i32.add (local.get $pc) (i32.const 12))) (br $L))
        ;; 61 SLT d a b
        (i32.store (i32.load offset=4 (local.get $pc))
          (i32.lt_s (i32.load (i32.load offset=8 (local.get $pc)))
                    (i32.load (i32.load offset=12 (local.get $pc)))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 16))) (br $L))
        ;; 62 GOTO t -- a layout jump: no x86 transfer, no block spent
        (local.set $pc (i32.load offset=4 (local.get $pc)))
        (br $L))
        ;; 63 EXITB eip -- the budget ran out at a charged transfer: threaded
        ;; code stops the batch AT ITS TARGET ($branch_end finding zero), so
        ;; the stub has already taken the branch and names where it went.
        (global.set $eip (i32.load offset=4 (local.get $pc)))
        (global.set $uop_bexit (i32.const 1))
        (global.set $uop_io_kind (i32.const 0))
        (global.set $uop_io_budget (i32.const 0))
        (return (local.get $pc)))
        ;; 64 BNZL a t -- a layout branch inside one instruction: no x86
        ;; transfer, no block spent
        (local.set $pc
          (select (i32.load offset=8 (local.get $pc)) (i32.add (local.get $pc) (i32.const 12))
                  (i32.load (i32.load offset=4 (local.get $pc)))))
        (br $L))
        ;; 65 SETSS i -- flag_sign_shift = i (the 8/16-bit shift handlers set it
        ;; even when a count of 0 leaves the rest of the record alone)
        (global.set $flag_sign_shift (i32.load offset=4 (local.get $pc)))
        (local.set $pc (i32.add (local.get $pc) (i32.const 8)))
        (br $L))
        ;; 66 GETCC d cc -- calls $eval_cc: $uop_run does it
        (br $svc))
        ;; 67 SPILL s base disp -- calls $gs32: $uop_run does it
        (br $svc))
        ;; 68 MULW lo hi a b s -- $th_mul32 / $th_imul32's product
        (local.set $x (i64.extend_i32_u (i32.load (i32.load offset=12 (local.get $pc)))))
        (local.set $y (i64.extend_i32_u (i32.load (i32.load offset=16 (local.get $pc)))))
        (if (i32.load offset=20 (local.get $pc))
          (then (local.set $x (i64.extend_i32_s (i32.wrap_i64 (local.get $x))))
                (local.set $y (i64.extend_i32_s (i32.wrap_i64 (local.get $y))))))
        (local.set $q (i64.mul (local.get $x) (local.get $y)))
        (i32.store (i32.load offset=4 (local.get $pc)) (i32.wrap_i64 (local.get $q)))
        (i32.store (i32.load offset=8 (local.get $pc)) (i32.wrap_i64 (i64.shr_u (local.get $q) (i64.const 32))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 24))) (br $L))
        ;; 69 SETMULF s lo hi -- $set_flags_mul: CF=OF is the upper half not
        ;; being the extension of the lower; flag_a and the sign shift stay
        (local.set $v (i32.load (i32.load offset=8 (local.get $pc))))
        (global.set $flag_op (i32.const 6))
        (global.set $flag_b
          (i32.ne (i32.load (i32.load offset=12 (local.get $pc)))
                  (select (i32.shr_s (local.get $v) (i32.const 31)) (i32.const 0)
                          (i32.load offset=4 (local.get $pc)))))
        (global.set $flag_res (local.get $v))
        (local.set $pc (i32.add (local.get $pc) (i32.const 16))) (br $L))
        ;; 70 DIVW q r lo hi d s x -- $th_div32 / $th_idiv32; every case they
        ;; raise #DE in (and INT64_MIN / -1, which would trap i64.div_s)
        ;; leaves to x, the threaded div, flags untouched either way
        (local.set $x (i64.or (i64.extend_i32_u (i32.load (i32.load offset=12 (local.get $pc))))
                              (i64.shl (i64.extend_i32_u (i32.load (i32.load offset=16 (local.get $pc))))
                                       (i64.const 32))))
        (local.set $v (i32.load (i32.load offset=20 (local.get $pc))))
        (block $de
          (br_if $de (i32.eqz (local.get $v)))
          (if (i32.load offset=24 (local.get $pc))
            (then
              (local.set $y (i64.extend_i32_s (local.get $v)))
              (br_if $de (i32.and (i32.eq (local.get $v) (i32.const -1))
                                  (i64.eq (local.get $x) (i64.const 0x8000000000000000))))
              (local.set $q (i64.div_s (local.get $x) (local.get $y)))
              (br_if $de (i64.gt_u (i64.add (local.get $q) (i64.const 0x80000000)) (i64.const 0xFFFFFFFF)))
              (local.set $y (i64.rem_s (local.get $x) (local.get $y))))
            (else
              (local.set $y (i64.extend_i32_u (local.get $v)))
              (br_if $de (i64.ge_u (i64.shr_u (local.get $x) (i64.const 32)) (local.get $y)))
              (local.set $q (i64.div_u (local.get $x) (local.get $y)))
              (local.set $y (i64.rem_u (local.get $x) (local.get $y)))))
          (i32.store (i32.load offset=4 (local.get $pc)) (i32.wrap_i64 (local.get $q)))
          (i32.store (i32.load offset=8 (local.get $pc)) (i32.wrap_i64 (local.get $y)))
          (local.set $pc (i32.add (local.get $pc) (i32.const 32))) (br $L))
        (global.set $uop_div_exits (i32.add (global.get $uop_div_exits) (i32.const 1)))
        (local.set $pc (i32.load offset=28 (local.get $pc)))
        (br $L))
        ;; 71 ICG v t cls eip x -- a pass is counted here, a fail by $uop_run
        (br_if $svc (i32.ne (i32.load (i32.load offset=4 (local.get $pc))) (i32.load offset=8 (local.get $pc))))
        (if (i32.load offset=12 (local.get $pc))
          (then (global.set $uop_icg_pass1 (i32.add (global.get $uop_icg_pass1) (i32.const 1))))
          (else (global.set $uop_icg_pass0 (i32.add (global.get $uop_icg_pass0) (i32.const 1)))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 24)))
        (br $L))
        ;; 72 LDX64 d base idx sc disp w x
        (local.set $ga (i32.add (i32.add (i32.load (i32.load offset=8 (local.get $pc)))
                                         (i32.shl (i32.load (i32.load offset=12 (local.get $pc)))
                                                  (i32.load offset=16 (local.get $pc))))
                                (i32.load offset=20 (local.get $pc))))
        (local.set $w (i32.load offset=24 (local.get $pc)))
        ;; eight bytes: a span under 8 (a poisoned slot has 4) always misses
        (local.set $v (i32.load offset=4 (local.get $w)))
        (if (i32.or (i32.gt_u (i32.sub (local.get $ga) (i32.load (local.get $w)))
                              (i32.sub (local.get $v) (i32.const 8)))
                    (i32.lt_u (local.get $v) (i32.const 8)))
          (then (br $miss)))
        (i64.store (i32.load offset=4 (local.get $pc))
          (i64.load (i32.add (local.get $ga) (i32.load offset=8 (local.get $w)))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 32))) (br $L))
        ;; 73 STX64 s base idx sc disp w x
        (local.set $ga (i32.add (i32.add (i32.load (i32.load offset=8 (local.get $pc)))
                                         (i32.shl (i32.load (i32.load offset=12 (local.get $pc)))
                                                  (i32.load offset=16 (local.get $pc))))
                                (i32.load offset=20 (local.get $pc))))
        (local.set $w (i32.load offset=24 (local.get $pc)))
        ;; eight bytes: a span under 8 (a poisoned slot has 4) always misses
        (local.set $v (i32.load offset=4 (local.get $w)))
        (if (i32.or (i32.gt_u (i32.sub (local.get $ga) (i32.load (local.get $w)))
                              (i32.sub (local.get $v) (i32.const 8)))
                    (i32.lt_u (local.get $v) (i32.const 8)))
          (then (br $miss)))
        (i64.store (i32.add (local.get $ga) (i32.load offset=8 (local.get $w)))
          (i64.load (i32.load offset=4 (local.get $pc))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 32))) (br $L))
        ;; 86-91, --uop-mmx-fwd (07e $uc_mmx_fwd): the MMX op before this one
        ;; left its result in $q, and the compiler proved at encode time that
        ;; nothing between could change it -- the two are adjacent in the
        ;; program with no label between, or only MXTO32s are. An operand
        ;; that is that result is taken from $q instead of its cell. None of
        ;; these can leave, so none is ever re-entered by a fresh $uop_fast
        ;; call that would have lost $q.
        ;; 91 MXOPM base idx sc disp sub d w x: LDX64 into the staging cell
        ;; and the MXOP that reads it, as one op. The load is first and the
        ;; miss leaves with nothing written, as LDX64's does. The core reads
        ;; sub/d at +4/+8 of the advanced pc and steps 20 more: 36 bytes.
        (local.set $ga (i32.add (i32.add (i32.load (i32.load offset=4 (local.get $pc)))
                                         (i32.shl (i32.load (i32.load offset=8 (local.get $pc)))
                                                  (i32.load offset=12 (local.get $pc))))
                                (i32.load offset=16 (local.get $pc))))
        (local.set $w (i32.load offset=28 (local.get $pc)))
        (local.set $v (i32.load offset=4 (local.get $w)))
        (if (i32.or (i32.gt_u (i32.sub (local.get $ga) (i32.load (local.get $w)))
                              (i32.sub (local.get $v) (i32.const 8)))
                    (i32.lt_u (local.get $v) (i32.const 8)))
          (then (br $miss)))
        (local.set $y (i64.load (i32.add (local.get $ga) (i32.load offset=8 (local.get $w)))))
        (local.set $x (i64.load (i32.load offset=24 (local.get $pc))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 16)))
        (br $mxcore))
        ;; 90 MXTO32Q d a: MXTO32 whose cell is the result in $q
        (i32.store (i32.load offset=4 (local.get $pc)) (i32.wrap_i64 (local.get $q)))
        (local.set $pc (i32.add (local.get $pc) (i32.const 12))) (br $L))
        ;; 89 MXSHI with a in $q
        (local.set $x (local.get $q))
        (local.set $y (i64.extend_i32_u (i32.load offset=16 (local.get $pc))))
        (br $mxcore))
        ;; 88 MXOP with b in $q
        (local.set $x (i64.load (i32.load offset=12 (local.get $pc))))
        (local.set $y (local.get $q))
        (br $mxcore))
        ;; 87 MXOP with a and b both in $q
        (local.set $x (local.get $q))
        (local.set $y (local.get $q))
        (br $mxcore))
        ;; 86 MXOP with a in $q
        (local.set $x (local.get $q))
        (local.set $y (i64.load (i32.load offset=16 (local.get $pc))))
        (br $mxcore))
        ;; 74 MXOP sub d a b
        (local.set $x (i64.load (i32.load offset=12 (local.get $pc))))
        (local.set $y (i64.load (i32.load offset=16 (local.get $pc))))
        (br $mxcore))
        ;; 75 MXSHI sub d a n
        (local.set $x (i64.load (i32.load offset=12 (local.get $pc))))
        (local.set $y (i64.extend_i32_u (i32.load offset=16 (local.get $pc)))))
        ;; MXOP and MXSHI meet here with x, y the operands; a br_table on the
        ;; 06c subop picks the arm ($mmx_binop / $mmx_shift inlined).
        (block $mxd
        (block $mbad
        (block $m53 (block $m52 (block $m51 (block $m50 (block $m49 (block $m48 (block $m47 (block $m46
        (block $m45 (block $m44 (block $m43 (block $m42 (block $m41 (block $m40 (block $m39 (block $m38
        (block $m37 (block $m36 (block $m35 (block $m34 (block $m33 (block $m32 (block $m31 (block $m30
        (block $m29 (block $m28 (block $m27 (block $m26 (block $m25 (block $m24 (block $m23 (block $m22
        (block $m21 (block $m20 (block $m19 (block $m18 (block $m17 (block $m16 (block $m15 (block $m14
        (block $m13 (block $m12 (block $m11 (block $m10 (block $m9 (block $m8 (block $m7 (block $m6
        (block $m5 (block $m4 (block $m3 (block $m2 (block $m1 (block $m0
          (br_table
            $m0 $mbad $mbad $m1 $m2 $m3 $m4 $m5 $m6 $m7 $m8 $m9
            $m10 $m11 $m12 $m13 $m14 $m15 $m16 $m17 $mbad $mbad $mbad $mbad
            $mbad $mbad $mbad $mbad $mbad $mbad $mbad $mbad $m18 $m19 $m20 $m44
            $m21 $m22 $m23 $m45 $m24 $m25 $mbad $mbad $m26 $m27 $mbad $mbad
            $m28 $m29 $mbad $mbad $m30 $m31 $mbad $mbad $m32 $m33 $m34 $mbad
            $m35 $m36 $m37 $mbad $m38 $mbad $mbad $mbad $m39 $mbad $mbad $mbad
            $mbad $m40 $mbad $mbad $mbad $m41 $mbad $mbad $m42 $m43 $mbad $mbad
            $mbad $mbad $mbad $mbad $mbad $mbad $mbad $mbad $mbad $mbad $mbad $mbad
            $mbad $mbad $mbad $mbad $mbad $mbad $mbad $mbad $mbad $mbad $mbad $mbad
            $mbad $mbad $mbad $mbad $mbad $mbad $mbad $mbad $mbad $mbad $mbad $mbad
            $mbad $mbad $mbad $mbad $mbad $mbad $mbad $mbad $mbad $m46 $m47 $m48
            $mbad $m49 $m50 $m51 $mbad $m52 $m53
            $mbad (i32.load offset=4 (local.get $pc))))
          ;; 0 movq
          (local.set $q (local.get $y))
          (br $mxd))
          ;; 3 pand
          (local.set $q (i64.and (local.get $x) (local.get $y)))
          (br $mxd))
          ;; 4 pandn
          (local.set $q (i64.and (i64.xor (local.get $x) (i64.const -1)) (local.get $y)))
          (br $mxd))
          ;; 5 por
          (local.set $q (i64.or (local.get $x) (local.get $y)))
          (br $mxd))
          ;; 6 pxor
          (local.set $q (i64.xor (local.get $x) (local.get $y)))
          (br $mxd))
          ;; 7 punpckldq
          (local.set $q (i64.or (i64.and (local.get $x) (i64.const 0xFFFFFFFF)) (i64.shl (local.get $y) (i64.const 32))))
          (br $mxd))
          ;; 8 punpckhdq
          (local.set $q (i64.or (i64.shr_u (local.get $x) (i64.const 32)) (i64.and (local.get $y) (i64.const -4294967296))))
          (br $mxd))
          ;; 9 punpcklbw
          (local.set $q (i64x2.extract_lane 0 (i8x16.shuffle 0 16 1 17 2 18 3 19 0 0 0 0 0 0 0 0 (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y)))))
          (br $mxd))
          ;; 10 punpckhbw
          (local.set $q (i64x2.extract_lane 0 (i8x16.shuffle 4 20 5 21 6 22 7 23 0 0 0 0 0 0 0 0 (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y)))))
          (br $mxd))
          ;; 11 punpcklwd
          (local.set $q (i64x2.extract_lane 0 (i8x16.shuffle 0 1 16 17 2 3 18 19 0 0 0 0 0 0 0 0 (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y)))))
          (br $mxd))
          ;; 12 punpckhwd
          (local.set $q (i64x2.extract_lane 0 (i8x16.shuffle 4 5 20 21 6 7 22 23 0 0 0 0 0 0 0 0 (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y)))))
          (br $mxd))
          ;; 13 packsswb
          (local.set $q (i64x2.extract_lane 0 (i8x16.shuffle 0 1 2 3 8 9 10 11 0 0 0 0 0 0 0 0 (i8x16.narrow_i16x8_s (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y))) (i8x16.narrow_i16x8_s (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y))))))
          (br $mxd))
          ;; 14 packssdw
          (local.set $q (i64x2.extract_lane 0 (i8x16.shuffle 0 1 2 3 8 9 10 11 0 0 0 0 0 0 0 0 (i16x8.narrow_i32x4_s (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y))) (i16x8.narrow_i32x4_s (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y))))))
          (br $mxd))
          ;; 15 packuswb
          (local.set $q (i64x2.extract_lane 0 (i8x16.shuffle 0 1 2 3 8 9 10 11 0 0 0 0 0 0 0 0 (i8x16.narrow_i16x8_u (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y))) (i8x16.narrow_i16x8_u (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y))))))
          (br $mxd))
          ;; 16 pmaddwd
          (local.set $q (i64x2.extract_lane 0 (i32x4.dot_i16x8_s (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y)))))
          (br $mxd))
          ;; 17 pmulhw
          (local.set $q (i64x2.extract_lane 0 (i8x16.shuffle 2 3 6 7 10 11 14 15 0 0 0 0 0 0 0 0 (i32x4.extmul_low_i16x8_s (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y))) (i32x4.extmul_low_i16x8_s (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y))))))
          (br $mxd))
          ;; 18 pmulhuw
          (local.set $q (i64x2.extract_lane 0 (i8x16.shuffle 2 3 6 7 10 11 14 15 0 0 0 0 0 0 0 0 (i32x4.extmul_low_i16x8_u (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y))) (i32x4.extmul_low_i16x8_u (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y))))))
          (br $mxd))
          ;; 19 pmullw
          (local.set $q (i64x2.extract_lane 0 (i16x8.mul (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y)))))
          (br $mxd))
          ;; 32 paddb
          (local.set $q (i64x2.extract_lane 0 (i8x16.add (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y)))))
          (br $mxd))
          ;; 33 paddw
          (local.set $q (i64x2.extract_lane 0 (i16x8.add (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y)))))
          (br $mxd))
          ;; 34 paddd
          (local.set $q (i64x2.extract_lane 0 (i32x4.add (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y)))))
          (br $mxd))
          ;; 36 psubb
          (local.set $q (i64x2.extract_lane 0 (i8x16.sub (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y)))))
          (br $mxd))
          ;; 37 psubw
          (local.set $q (i64x2.extract_lane 0 (i16x8.sub (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y)))))
          (br $mxd))
          ;; 38 psubd
          (local.set $q (i64x2.extract_lane 0 (i32x4.sub (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y)))))
          (br $mxd))
          ;; 40 paddsb
          (local.set $q (i64x2.extract_lane 0 (i8x16.add_sat_s (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y)))))
          (br $mxd))
          ;; 41 paddsw
          (local.set $q (i64x2.extract_lane 0 (i16x8.add_sat_s (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y)))))
          (br $mxd))
          ;; 44 psubsb
          (local.set $q (i64x2.extract_lane 0 (i8x16.sub_sat_s (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y)))))
          (br $mxd))
          ;; 45 psubsw
          (local.set $q (i64x2.extract_lane 0 (i16x8.sub_sat_s (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y)))))
          (br $mxd))
          ;; 48 paddusb
          (local.set $q (i64x2.extract_lane 0 (i8x16.add_sat_u (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y)))))
          (br $mxd))
          ;; 49 paddusw
          (local.set $q (i64x2.extract_lane 0 (i16x8.add_sat_u (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y)))))
          (br $mxd))
          ;; 52 psubusb
          (local.set $q (i64x2.extract_lane 0 (i8x16.sub_sat_u (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y)))))
          (br $mxd))
          ;; 53 psubusw
          (local.set $q (i64x2.extract_lane 0 (i16x8.sub_sat_u (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y)))))
          (br $mxd))
          ;; 56 pcmpeqb
          (local.set $q (i64x2.extract_lane 0 (i8x16.eq (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y)))))
          (br $mxd))
          ;; 57 pcmpeqw
          (local.set $q (i64x2.extract_lane 0 (i16x8.eq (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y)))))
          (br $mxd))
          ;; 58 pcmpeqd
          (local.set $q (i64x2.extract_lane 0 (i32x4.eq (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y)))))
          (br $mxd))
          ;; 60 pcmpgtb
          (local.set $q (i64x2.extract_lane 0 (i8x16.gt_s (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y)))))
          (br $mxd))
          ;; 61 pcmpgtw
          (local.set $q (i64x2.extract_lane 0 (i16x8.gt_s (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y)))))
          (br $mxd))
          ;; 62 pcmpgtd
          (local.set $q (i64x2.extract_lane 0 (i32x4.gt_s (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y)))))
          (br $mxd))
          ;; 64 pminub
          (local.set $q (i64x2.extract_lane 0 (i8x16.min_u (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y)))))
          (br $mxd))
          ;; 68 pmaxub
          (local.set $q (i64x2.extract_lane 0 (i8x16.max_u (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y)))))
          (br $mxd))
          ;; 73 pminsw
          (local.set $q (i64x2.extract_lane 0 (i16x8.min_s (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y)))))
          (br $mxd))
          ;; 77 pmaxsw
          (local.set $q (i64x2.extract_lane 0 (i16x8.max_s (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y)))))
          (br $mxd))
          ;; 80 pavgb
          (local.set $q (i64x2.extract_lane 0 (i8x16.avgr_u (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y)))))
          (br $mxd))
          ;; 81 pavgw
          (local.set $q (i64x2.extract_lane 0 (i16x8.avgr_u (i64x2.splat (local.get $x)) (i64x2.splat (local.get $y)))))
          (br $mxd))
          ;; 35 paddq
          (local.set $q (i64.add (local.get $x) (local.get $y)))
          (br $mxd))
          ;; 39 psubq
          (local.set $q (i64.sub (local.get $x) (local.get $y)))
          (br $mxd))
          ;; 129 psllw
          (local.set $ga (select (i32.const 255) (i32.wrap_i64 (local.get $y)) (i64.gt_u (local.get $y) (i64.const 255))))
          (local.set $q (i64.const 0))
          (if (i32.lt_u (local.get $ga) (i32.const 16)) (then (local.set $q (i64x2.extract_lane 0 (i16x8.shl (i64x2.splat (local.get $x)) (local.get $ga))))))
          (br $mxd))
          ;; 130 pslld
          (local.set $ga (select (i32.const 255) (i32.wrap_i64 (local.get $y)) (i64.gt_u (local.get $y) (i64.const 255))))
          (local.set $q (i64.const 0))
          (if (i32.lt_u (local.get $ga) (i32.const 32)) (then (local.set $q (i64x2.extract_lane 0 (i32x4.shl (i64x2.splat (local.get $x)) (local.get $ga))))))
          (br $mxd))
          ;; 131 psllq
          (local.set $ga (select (i32.const 255) (i32.wrap_i64 (local.get $y)) (i64.gt_u (local.get $y) (i64.const 255))))
          (local.set $q (i64.const 0))
          (if (i32.lt_u (local.get $ga) (i32.const 64)) (then (local.set $q (i64.shl (local.get $x) (i64.extend_i32_u (local.get $ga))))))
          (br $mxd))
          ;; 133 psrlw
          (local.set $ga (select (i32.const 255) (i32.wrap_i64 (local.get $y)) (i64.gt_u (local.get $y) (i64.const 255))))
          (local.set $q (i64.const 0))
          (if (i32.lt_u (local.get $ga) (i32.const 16)) (then (local.set $q (i64x2.extract_lane 0 (i16x8.shr_u (i64x2.splat (local.get $x)) (local.get $ga))))))
          (br $mxd))
          ;; 134 psrld
          (local.set $ga (select (i32.const 255) (i32.wrap_i64 (local.get $y)) (i64.gt_u (local.get $y) (i64.const 255))))
          (local.set $q (i64.const 0))
          (if (i32.lt_u (local.get $ga) (i32.const 32)) (then (local.set $q (i64x2.extract_lane 0 (i32x4.shr_u (i64x2.splat (local.get $x)) (local.get $ga))))))
          (br $mxd))
          ;; 135 psrlq
          (local.set $ga (select (i32.const 255) (i32.wrap_i64 (local.get $y)) (i64.gt_u (local.get $y) (i64.const 255))))
          (local.set $q (i64.const 0))
          (if (i32.lt_u (local.get $ga) (i32.const 64)) (then (local.set $q (i64.shr_u (local.get $x) (i64.extend_i32_u (local.get $ga))))))
          (br $mxd))
          ;; 137 psraw
          (local.set $ga (select (i32.const 255) (i32.wrap_i64 (local.get $y)) (i64.gt_u (local.get $y) (i64.const 255))))
          (if (i32.ge_u (local.get $ga) (i32.const 16)) (then (local.set $ga (i32.const 15))))
          (local.set $q (i64x2.extract_lane 0 (i16x8.shr_s (i64x2.splat (local.get $x)) (local.get $ga))))
          (br $mxd))
          ;; 138 psrad
          (local.set $ga (select (i32.const 255) (i32.wrap_i64 (local.get $y)) (i64.gt_u (local.get $y) (i64.const 255))))
          (if (i32.ge_u (local.get $ga) (i32.const 32)) (then (local.set $ga (i32.const 31))))
          (local.set $q (i64x2.extract_lane 0 (i32x4.shr_s (i64x2.splat (local.get $x)) (local.get $ga))))
          (br $mxd))
        (unreachable))
        (i64.store (i32.load offset=8 (local.get $pc)) (local.get $q))
        (local.set $pc (i32.add (local.get $pc) (i32.const 20))) (br $L))
        ;; 76 MXFROM32 d a
        (i64.store (i32.load offset=4 (local.get $pc))
          (i64.extend_i32_u (i32.load (i32.load offset=8 (local.get $pc)))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 12))) (br $L))
        ;; 77 MXTO32 d a
        (i32.store (i32.load offset=4 (local.get $pc))
          (i32.wrap_i64 (i64.load (i32.load offset=8 (local.get $pc)))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 12))) (br $L))
        ;; 78 STRSTEP4 src dst. Reading DF at execution time also covers an
        ;; existing program entered later with the opposite direction flag.
        ;; These integer additions deliberately leave the lazy flags alone.
        (local.set $v (select (i32.const -4) (i32.const 4) (global.get $df)))
        (i32.store (i32.load offset=4 (local.get $pc))
          (i32.add (i32.load (i32.load offset=4 (local.get $pc))) (local.get $v)))
        (i32.store (i32.load offset=8 (local.get $pc))
          (i32.add (i32.load (i32.load offset=8 (local.get $pc))) (local.get $v)))
        (local.set $pc (i32.add (local.get $pc) (i32.const 12))) (br $L))
        ;; 81 JTBL i n x -- a switch's table jump (07e $uc_emit_jtbl): an
        ;; index below n takes the index-th of the n GOTOs that follow, and
        ;; the arm there checks the entry it loaded; any other index goes to
        ;; x. A layout jump: no x86 transfer, no block spent.
        (local.set $v (i32.load (i32.load offset=4 (local.get $pc))))
        (if (i32.lt_u (local.get $v) (i32.load offset=8 (local.get $pc)))
          (then (local.set $pc (i32.load offset=20 (i32.add (local.get $pc) (i32.shl (local.get $v) (i32.const 3))))))
          (else (local.set $pc (i32.load offset=12 (local.get $pc)))))
        (br $L))
        ;; 82 COPY d s n w wd ws x. The extent is [p - back, p - back + bytes)
        ;; for both pointers, back = bytes - w when DF walks down. Any doubt
        ;; -- a count past 1M elements, an extent not wholly inside its
        ;; window, overlapping source and destination (x86 order then
        ;; matters) -- is $uop_bulk_slow's.
        (local.set $n (i32.load (i32.load offset=12 (local.get $pc))))
        (if (i32.eqz (local.get $n))
          (then (local.set $pc (i32.add (local.get $pc) (i32.const 32))) (br $L)))
        (br_if $svc (i32.gt_u (local.get $n) (i32.const 0x100000)))
        (local.set $v (i32.load offset=16 (local.get $pc)))
        (local.set $bw (i32.mul (local.get $n) (local.get $v)))
        (local.set $v (select (i32.sub (local.get $bw) (local.get $v)) (i32.const 0) (global.get $df)))
        (local.set $ga (i32.sub (i32.load (i32.load offset=4 (local.get $pc))) (local.get $v)))
        (local.set $w (i32.load offset=20 (local.get $pc)))
        (br_if $svc (i32.or (i32.gt_u (local.get $bw) (i32.load offset=4 (local.get $w)))
                            (i32.gt_u (i32.sub (local.get $ga) (i32.load (local.get $w)))
                                      (i32.sub (i32.load offset=4 (local.get $w)) (local.get $bw)))))
        (local.set $dw (i32.add (local.get $ga) (i32.load offset=8 (local.get $w))))
        (local.set $ga (i32.sub (i32.load (i32.load offset=8 (local.get $pc))) (local.get $v)))
        (local.set $w (i32.load offset=24 (local.get $pc)))
        (br_if $svc (i32.or (i32.gt_u (local.get $bw) (i32.load offset=4 (local.get $w)))
                            (i32.gt_u (i32.sub (local.get $ga) (i32.load (local.get $w)))
                                      (i32.sub (i32.load offset=4 (local.get $w)) (local.get $bw)))))
        (local.set $sw (i32.add (local.get $ga) (i32.load offset=8 (local.get $w))))
        (br_if $svc (i32.and (i32.lt_u (local.get $dw) (i32.add (local.get $sw) (local.get $bw)))
                             (i32.lt_u (local.get $sw) (i32.add (local.get $dw) (local.get $bw)))))
        (memory.copy (local.get $dw) (local.get $sw) (local.get $bw))
        (local.set $v (select (i32.sub (i32.const 0) (local.get $bw)) (local.get $bw) (global.get $df)))
        (i32.store (i32.load offset=4 (local.get $pc))
          (i32.add (i32.load (i32.load offset=4 (local.get $pc))) (local.get $v)))
        (i32.store (i32.load offset=8 (local.get $pc))
          (i32.add (i32.load (i32.load offset=8 (local.get $pc))) (local.get $v)))
        (i32.store (i32.load offset=12 (local.get $pc)) (i32.const 0))
        (local.set $pc (i32.add (local.get $pc) (i32.const 32))) (br $L))
        ;; 83 FILL d v n w wd x. Every element is the same value, so the order
        ;; they are written in cannot show: one memory.fill for a value that
        ;; is one repeated byte, else the first element and doubling copies.
        (local.set $n (i32.load (i32.load offset=12 (local.get $pc))))
        (if (i32.eqz (local.get $n))
          (then (local.set $pc (i32.add (local.get $pc) (i32.const 28))) (br $L)))
        (br_if $svc (i32.gt_u (local.get $n) (i32.const 0x100000)))
        (local.set $v (i32.load offset=16 (local.get $pc)))
        (local.set $bw (i32.mul (local.get $n) (local.get $v)))
        (local.set $ga (i32.sub (i32.load (i32.load offset=4 (local.get $pc)))
          (select (i32.sub (local.get $bw) (local.get $v)) (i32.const 0) (global.get $df))))
        (local.set $w (i32.load offset=20 (local.get $pc)))
        (br_if $svc (i32.or (i32.gt_u (local.get $bw) (i32.load offset=4 (local.get $w)))
                            (i32.gt_u (i32.sub (local.get $ga) (i32.load (local.get $w)))
                                      (i32.sub (i32.load offset=4 (local.get $w)) (local.get $bw)))))
        (local.set $dw (i32.add (local.get $ga) (i32.load offset=8 (local.get $w))))
        (if (i32.eq (local.get $v) (i32.const 8))
          (then (local.set $x (i64.load (i32.load offset=8 (local.get $pc))))
                (local.set $y (i64.const -1)))
          (else (local.set $x (i64.extend_i32_u (i32.load (i32.load offset=8 (local.get $pc)))))
                (local.set $y (i64.sub (i64.shl (i64.const 1)
                                                (i64.extend_i32_u (i32.shl (local.get $v) (i32.const 3))))
                                       (i64.const 1)))))
        (local.set $x (i64.and (local.get $x) (local.get $y)))
        (local.set $q (i64.and (local.get $x) (i64.const 0xFF)))
        (if (i64.eq (local.get $x)
                    (i64.and (i64.mul (local.get $q) (i64.const 0x0101010101010101)) (local.get $y)))
          (then (memory.fill (local.get $dw) (i32.wrap_i64 (local.get $q)) (local.get $bw)))
          (else
            (if (i32.eq (local.get $v) (i32.const 8))
              (then (i64.store (local.get $dw) (local.get $x)))
              (else (if (i32.eq (local.get $v) (i32.const 4))
                (then (i32.store (local.get $dw) (i32.wrap_i64 (local.get $x))))
                (else (i32.store16 (local.get $dw) (i32.wrap_i64 (local.get $x)))))))
            ;; $ga: bytes written so far; $sw: this copy's length
            (local.set $ga (local.get $v))
            (block $fd (loop $fl
              (br_if $fd (i32.ge_u (local.get $ga) (local.get $bw)))
              (local.set $sw (select (local.get $ga) (i32.sub (local.get $bw) (local.get $ga))
                                     (i32.le_u (local.get $ga) (i32.sub (local.get $bw) (local.get $ga)))))
              (memory.copy (i32.add (local.get $dw) (local.get $ga)) (local.get $dw) (local.get $sw))
              (local.set $ga (i32.add (local.get $ga) (local.get $sw)))
              (br $fl)))))
        (i32.store (i32.load offset=4 (local.get $pc))
          (i32.add (i32.load (i32.load offset=4 (local.get $pc)))
                   (select (i32.sub (i32.const 0) (local.get $bw)) (local.get $bw) (global.get $df))))
        (i32.store (i32.load offset=12 (local.get $pc)) (i32.const 0))
        (local.set $pc (i32.add (local.get $pc) (i32.const 28))) (br $L))
        ;; 84 WORK n: a trace's exit stub, just before its EXIT: the x86
        ;; instructions the path to this exit retired at the least (07e
        ;; $uc_exit_work). The enter op sums it into the header's +32 for the
        ;; poor test. No block, no state.
        (global.set $uop_xwork (i32.load offset=4 (local.get $pc)))
        (local.set $pc (i32.add (local.get $pc) (i32.const 8))) (br $L))
        ;; 85 MCOPY d s n v wd ws x: n dwords from [s] to [d], forward,
        ;; element by element in x86 order, registers d and s left alone,
        ;; then v = the last dword written (07e $uc_try_mcopy). The fast arm
        ;; needs both extents inside their windows and no overlap -- then the
        ;; order cannot show and it is one memory.copy -- else $uop_mcopy_slow.
        (local.set $n (i32.load offset=12 (local.get $pc)))
        (local.set $bw (i32.shl (local.get $n) (i32.const 2)))
        (local.set $ga (i32.load (i32.load offset=4 (local.get $pc))))
        (local.set $w (i32.load offset=20 (local.get $pc)))
        (br_if $svc (i32.or (i32.gt_u (local.get $bw) (i32.load offset=4 (local.get $w)))
                            (i32.gt_u (i32.sub (local.get $ga) (i32.load (local.get $w)))
                                      (i32.sub (i32.load offset=4 (local.get $w)) (local.get $bw)))))
        (local.set $dw (i32.add (local.get $ga) (i32.load offset=8 (local.get $w))))
        (local.set $ga (i32.load (i32.load offset=8 (local.get $pc))))
        (local.set $w (i32.load offset=24 (local.get $pc)))
        (br_if $svc (i32.or (i32.gt_u (local.get $bw) (i32.load offset=4 (local.get $w)))
                            (i32.gt_u (i32.sub (local.get $ga) (i32.load (local.get $w)))
                                      (i32.sub (i32.load offset=4 (local.get $w)) (local.get $bw)))))
        (local.set $sw (i32.add (local.get $ga) (i32.load offset=8 (local.get $w))))
        (br_if $svc (i32.and (i32.lt_u (local.get $dw) (i32.add (local.get $sw) (local.get $bw)))
                             (i32.lt_u (local.get $sw) (i32.add (local.get $dw) (local.get $bw)))))
        (memory.copy (local.get $dw) (local.get $sw) (local.get $bw))
        (i32.store (i32.load offset=16 (local.get $pc))
          (i32.load (i32.sub (i32.add (local.get $dw) (local.get $bw)) (i32.const 4))))
        (local.set $pc (i32.add (local.get $pc) (i32.const 32))) (br $L))
      ;; A memory access left its window: $uop_run re-guards (a call).
      (global.set $uop_io_ga (local.get $ga))
      (global.set $uop_io_w (local.get $w))
      (global.set $uop_io_kind (i32.const 2))
      (global.set $uop_io_budget (local.get $budget))
      (return (local.get $pc)))
      ;; An op that needs a call, still at $pc.
      (global.set $uop_io_kind (i32.const 1))
      (global.set $uop_io_budget (local.get $budget))
      (return (local.get $pc)))
    (unreachable))

  ;; ===================================================================
  ;; Installation. A program header, $UOP_HDR (48) bytes, precedes its code:
  ;;   +0 gen   ($uop_gen at install; a killed program holds 0; necessary
  ;;            for "live" but not sufficient -- see $uop_live)
  ;;   +4 head  (the guest EIP it is entered at)
  ;;   +8 nwin  +12 first window slot address (its own, after its code)
  ;;   +16 entries  +20 blocks spent in it  (stats, and the retire policy)
  ;;   +24 exits back to the head
  ;;   +28 the $UOP_WIN_EPOCH its windows were last poisoned under
  ;;   +32 work: x86 instructions its exits' WORK ops credited (traces only)
  ;; ===================================================================

  ;; The verdict map is 2048 sets of two {eip, pc} ways. It was direct-mapped
  ;; once, and on Diablo II's gameplay 14290 of 14362 compiles were a head
  ;; whose slot had stopped naming it: a declined head sharing a slot with a
  ;; live program could never record its decline (a marker never evicts a
  ;; live program), so it recompiled at every hot threshold -- 3046 times for
  ;; one d2cmp head -- and two live heads on one slot took turns evicting and
  ;; recompiling each other 219 times apiece.
  (func $uop_map_set (param $eip i32) (result i32)
    (i32.add (i32.add (global.get $uop_arena) (global.get $uop_map_off))
      (i32.shl (i32.and (i32.xor (local.get $eip) (i32.shr_u (local.get $eip) (i32.const 12)))
                        (i32.const 2047))
               (i32.const 4))))

  ;; The way naming $eip, or 0.
  (func $uop_map_slot (param $eip i32) (result i32)
    (local $s i32)
    (local.set $s (call $uop_map_set (local.get $eip)))
    (if (i32.eq (i32.load (local.get $s)) (local.get $eip)) (then (return (local.get $s))))
    (if (i32.eq (i32.load offset=8 (local.get $s)) (local.get $eip))
      (then (return (i32.add (local.get $s) (i32.const 8)))))
    (i32.const 0))

  ;; $pc's place in the program-start bitmap: the byte's address here (0 when
  ;; $pc is not the start of a 16-byte granule of code) and the bit's mask in
  ;; $uop_start_bit.
  (func $uop_start_byte (param $pc i32) (result i32)
    (local $off i32)
    (local.set $off (i32.sub (local.get $pc) (global.get $uop_arena)))
    (if (i32.or (i32.ge_u (local.get $off) (global.get $uop_code_bytes))
                (i32.ne (i32.and (local.get $off) (i32.const 15)) (i32.const 0)))
      (then (return (i32.const 0))))
    (i32.add (i32.add (global.get $uop_arena) (global.get $uop_starts_off))
             (i32.shr_u (local.get $off) (i32.const 7))))
  (func $uop_start_bit (param $pc i32) (result i32)
    (i32.shl (i32.const 1)
      (i32.and (i32.shr_u (i32.sub (local.get $pc) (global.get $uop_arena)) (i32.const 4))
               (i32.const 7))))

  ;; Is there a program of the current generation at $pc? Its header's gen
  ;; word says so only if a program was installed at exactly $pc since the
  ;; last flush; otherwise those bytes may be anybody's code or padding (see
  ;; $uop_starts_off), so the start bitmap has to agree.
  (func $uop_live (param $pc i32) (result i32)
    (local $b i32)
    (if (i32.ne (i32.load (local.get $pc)) (global.get $uop_gen)) (then (return (i32.const 0))))
    (local.set $b (call $uop_start_byte (local.get $pc)))
    (if (i32.eqz (local.get $b)) (then (return (i32.const 0))))
    (i32.ne (i32.and (i32.load8_u (local.get $b)) (call $uop_start_bit (local.get $pc)))
            (i32.const 0)))

  ;; Does way $w hold a program of the current generation?
  (func $uop_way_live (param $w i32) (result i32)
    (local $pc i32)
    (local.set $pc (i32.load offset=4 (local.get $w)))
    (if (i32.le_u (local.get $pc) (i32.const 1)) (then (return (i32.const 0))))
    (call $uop_live (local.get $pc)))

  ;; The way to write $eip's verdict into without evicting a live program:
  ;; its own way, else an empty or stale one, else a marker's; 0 when both
  ;; ways hold live programs.
  (func $uop_map_free_way (param $eip i32) (result i32)
    (local $s i32)
    (local.set $s (call $uop_map_slot (local.get $eip)))
    (if (local.get $s) (then (return (local.get $s))))
    (local.set $s (call $uop_map_set (local.get $eip)))
    (if (i32.eqz (call $uop_way_live (local.get $s)))
      (then (if (i32.ne (i32.load offset=4 (local.get $s)) (i32.const 1))
        (then (return (local.get $s))))))
    (if (i32.eqz (call $uop_way_live (i32.add (local.get $s) (i32.const 8))))
      (then (if (i32.ne (i32.load offset=12 (local.get $s)) (i32.const 1))
        (then (return (i32.add (local.get $s) (i32.const 8)))))))
    (if (i32.eqz (call $uop_way_live (local.get $s))) (then (return (local.get $s))))
    (if (i32.eqz (call $uop_way_live (i32.add (local.get $s) (i32.const 8))))
      (then (return (i32.add (local.get $s) (i32.const 8)))))
    (i32.const 0))

  ;; The program to enter at $eip, or 0. Asked once per decoded block by
  ;; $decode_block when the tier is on.
  (func $uop_map_get (param $eip i32) (result i32)
    (local $s i32) (local $pc i32)
    (local.set $s (call $uop_map_slot (local.get $eip)))
    (if (i32.eqz (local.get $s)) (then (return (i32.const 0))))
    (local.set $pc (i32.load offset=4 (local.get $s)))
    ;; 0 = nothing here, 1 = retired as poor (see $uop_retire_poor).
    (if (i32.le_u (local.get $pc) (i32.const 1)) (then (return (i32.const 0))))
    (if (i32.eqz (call $uop_live (local.get $pc))) (then (return (i32.const 0))))
    (local.get $pc))

  ;; The hot-head hook: $bx_hot_bump calls this instead of the block
  ;; executor's walk when the tier is armed. The lowering (07e) answers the
  ;; program address or 0; everything it wrote is data in $UOP_ARENA.
  ;; Answers 1 when the head's verdict is a settled "never" (a dead or poor
  ;; marker), which 07c turns into the page index's no-bump mark.
  (func $uop_try (param $eip i32) (result i32)
    (local $pc i32)
    (if (i32.ne (call $uop_map_get (local.get $eip)) (i32.const 0)) (then (return (i32.const 0))))
    (local.set $pc (call $uop_map_slot (local.get $eip)))
    (if (i32.ne (local.get $pc) (i32.const 0))
      (then (if (i32.eq (i32.load offset=4 (local.get $pc)) (i32.const 1)) (then (return (i32.const 1))))))
    (local.set $pc (call $uop_compile (local.get $eip)))
    (if (global.get $uop_census)
      (then (call $uop_census_ev (i32.const 1) (local.get $eip)
              (if (result i32) (i32.eqz (local.get $pc)) (then (global.get $uc_last_why))
                (else (if (result i32) (i32.eq (local.get $pc) (i32.const 1))
                        (then (i32.const 0xFFFF)) (else (i32.const 0)))))
              (global.get $uc_nloop) (global.get $uc_is_trace))))
    (if (i32.eqz (local.get $pc))
      (then (call $uop_mark_dead (local.get $eip)) (return (i32.const 1))))
    ;; another thread is compiling: try again at the next hot bump
    (if (i32.eq (local.get $pc) (i32.const 1)) (then (return (i32.const 0))))
    (call $uop_install (local.get $eip) (local.get $pc))
    (i32.const 0))

  ;; Remember a head the lowering declined: it is a function of the code
  ;; bytes, so asking again at every hot bump only buys another decline.
  ;; Never over a live program of another head that shares the slot.
  ;; $uop_flush_all (the code itself may have changed) forgets every marker.
  (func $uop_mark_dead (param $eip i32)
    (local $s i32)
    (local.set $s (call $uop_map_free_way (local.get $eip)))
    (if (i32.eqz (local.get $s)) (then (return)))
    (i32.store (local.get $s) (local.get $eip))
    (i32.store offset=4 (local.get $s) (i32.const 1)))

  ;; With both ways live, the program entered less often gives up its way.
  ;; It keeps running from the blocks already decoded with its enter op.
  (func $uop_install (param $eip i32) (param $pc i32)
    (local $s i32) (local $b i32)
    (i32.store (local.get $pc) (global.get $uop_gen))
    (i32.store offset=4 (local.get $pc) (local.get $eip))
    ;; A program starts here ($uop_live). $pc is always a placement of this
    ;; arena's; one that is not has no bit and is simply never entered.
    (local.set $b (call $uop_start_byte (local.get $pc)))
    (if (local.get $b)
      (then (i32.store8 (local.get $b)
              (i32.or (i32.load8_u (local.get $b)) (call $uop_start_bit (local.get $pc))))))
    (local.set $s (call $uop_map_free_way (local.get $eip)))
    (if (i32.eqz (local.get $s))
      (then
        (local.set $s (call $uop_map_set (local.get $eip)))
        (if (i32.gt_u (i32.load offset=16 (i32.load offset=4 (local.get $s)))
                      (i32.load offset=16 (i32.load offset=12 (local.get $s))))
          (then (local.set $s (i32.add (local.get $s) (i32.const 8)))))))
    (i32.store (local.get $s) (local.get $eip))
    (i32.store offset=4 (local.get $s) (local.get $pc))
    (global.set $uop_installs (i32.add (global.get $uop_installs) (i32.const 1)))
    (call $page_retire_ga (local.get $eip)))

  ;; The lowering registers the guest byte ranges a program was lowered from, so
  ;; a write to any of them kills it. Pages are marked as code so the write
  ;; reaches $invalidate_code_range at all.
  (func $uop_add_range (param $lo i32) (param $hi i32) (param $pc i32) (result i32)
    (local $e i32) (local $p i32)
    (if (i32.ge_u (global.get $uop_nranges) (global.get $UOP_RANGES_MAX))
      (then (return (i32.const 0))))
    (local.set $e (i32.add (i32.add (global.get $uop_arena) (global.get $uop_ranges_off))
                           (i32.mul (global.get $uop_nranges) (i32.const 12))))
    (i32.store (local.get $e) (local.get $lo))
    (i32.store offset=4 (local.get $e) (local.get $hi))
    (i32.store offset=8 (local.get $e) (local.get $pc))
    (global.set $uop_nranges (i32.add (global.get $uop_nranges) (i32.const 1)))
    (call $uop_cw_add (local.get $lo) (local.get $hi))
    (local.set $p (i32.and (local.get $lo) (i32.const 0xFFFFF000)))
    (block $d (loop $l
      (br_if $d (i32.ge_u (local.get $p) (local.get $hi)))
      (call $code_page_mark (local.get $p))
      (local.set $p (i32.add (local.get $p) (i32.const 0x1000)))
      (br $l)))
    (i32.const 1))

  ;; A program entered often that does almost nothing per entry costs more
  ;; than it saves, and the head is just as poor the next time it gets hot:
  ;; kill it and leave a marker (pc 1) so $uop_try does not compile it again.
  ;; A kill for a code write clears the slot instead -- new code, new chance.
  (func $uop_retire_poor (param $pc i32)
    (local $s i32)
    (local.set $s (call $uop_map_slot (i32.load offset=4 (local.get $pc))))
    (call $uop_kill (local.get $pc))
    (call $uop_drop_ranges (local.get $pc))
    (if (i32.ne (local.get $s) (i32.const 0))
      (then (i32.store offset=4 (local.get $s) (i32.const 1)))))

  (func $uop_kill (param $pc i32)
    (local $s i32)
    (if (i32.eqz (i32.load (local.get $pc))) (then (return)))
    (global.set $uop_kills (i32.add (global.get $uop_kills) (i32.const 1)))
    (local.set $s (call $uop_map_slot (i32.load offset=4 (local.get $pc))))
    (if (i32.ne (local.get $s) (i32.const 0))
      (then (if (i32.eq (i32.load offset=4 (local.get $s)) (local.get $pc))
        (then (i32.store offset=4 (local.get $s) (i32.const 0))))))
    (i32.store (local.get $pc) (i32.const 0)))

  ;; ---- the code-write filter --------------------------------------------
  ;; Every guest store to a page whose CODE_PAGE_BITMAP bit is set reaches
  ;; $uop_code_write, and that bit is set by any decode and never cleared, so
  ;; a game that keeps data on a page it also executes (StarCraft: 6.95M such
  ;; writes in a gameplay window, 18K of which dropped a block) paid a linear
  ;; scan of every live range per store -- 14.5% of its CPU. The filter
  ;; answers "can this write touch any range at all" in one or two loads.
  ;;
  ;; Exactness: a bit is set for every line of every range at $uop_add_range
  ;; and only ever cleared by a flush (which also empties the ranges) or a
  ;; rebuild (which re-sets every live range's lines before anything reads
  ;; it). Two pages that hash to one word share bits, and a removed range
  ;; leaves its bits behind, so the filter can only say "maybe" too often;
  ;; "no" is always true, and a "maybe" is decided by the same exact scan as
  ;; before.
  ;;
  ;; Threads: the ranges, the programs and this filter all live in the
  ;; instance's own arena, and $invalidate_code_range only ever scanned the
  ;; WRITING instance's ranges, so the filter is per instance for the same
  ;; reason the range table is. A program another thread installs goes into
  ;; that thread's filter; nothing here reads another instance's state.
  (func $uop_cw_word (param $page i32) (result i32)
    (local $pn i32)
    (local.set $pn (i32.shr_u (local.get $page) (i32.const 12)))
    (i32.add (i32.add (global.get $uop_arena) (global.get $uop_cwmap_off))
      (i32.shl (i32.and (i32.xor (local.get $pn) (i32.shr_u (local.get $pn) (i32.const 11)))
                        (i32.const 2047))
               (i32.const 3))))
  ;; The 64-byte lines of [a, b) that fall inside the page at $page, as a mask.
  ;; Callers guarantee a < b and that the page intersects [a, b).
  (func $uop_cw_lines (param $page i32) (param $a i32) (param $b i32) (result i64)
    (local $off i32) (local $stop i32)
    (local.set $off (select (i32.sub (local.get $a) (local.get $page)) (i32.const 0)
                            (i32.gt_u (local.get $a) (local.get $page))))
    (local.set $stop (i32.sub (local.get $b) (local.get $page)))
    (if (i32.gt_u (local.get $stop) (i32.const 4096)) (then (local.set $stop (i32.const 4096))))
    (i64.and
      (i64.shl (i64.const -1) (i64.extend_i32_u (i32.shr_u (local.get $off) (i32.const 6))))
      (i64.shr_u (i64.const -1)
        (i64.extend_i32_u (i32.sub (i32.const 63)
          (i32.shr_u (i32.sub (local.get $stop) (i32.const 1)) (i32.const 6)))))))
  ;; Mark the lines of [lo, hi).
  (func $uop_cw_add (param $lo i32) (param $hi i32)
    (local $p i32) (local $w i32)
    (if (i32.ge_u (local.get $lo) (local.get $hi)) (then (return)))
    (local.set $p (i32.and (local.get $lo) (i32.const 0xFFFFF000)))
    (block $d (loop $l
      (local.set $w (call $uop_cw_word (local.get $p)))
      (i64.store (local.get $w)
        (i64.or (i64.load (local.get $w))
                (call $uop_cw_lines (local.get $p) (local.get $lo) (local.get $hi))))
      (local.set $p (i32.add (local.get $p) (i32.const 0x1000)))
      ;; $p wraps to 0 past the top page; stop there rather than loop forever.
      (br_if $d (i32.eqz (local.get $p)))
      (br_if $l (i32.lt_u (local.get $p) (local.get $hi))))))
  ;; Can a write of [ga, end) touch any line the filter holds?
  (func $uop_cw_maybe (param $ga i32) (param $end i32) (result i32)
    (local $p i32)
    (if (i32.le_u (local.get $end) (local.get $ga)) (then (return (i32.const 1))))
    (local.set $p (i32.and (local.get $ga) (i32.const 0xFFFFF000)))
    (block $d (loop $l
      (if (i64.ne (i64.and (i64.load (call $uop_cw_word (local.get $p)))
                           (call $uop_cw_lines (local.get $p) (local.get $ga) (local.get $end)))
                  (i64.const 0))
        (then (return (i32.const 1))))
      (local.set $p (i32.add (local.get $p) (i32.const 0x1000)))
      (br_if $d (i32.eqz (local.get $p)))
      (br_if $l (i32.lt_u (local.get $p) (local.get $end)))))
    (i32.const 0))
  ;; Clear the filter and re-mark every live range.
  (func $uop_cw_rebuild
    (local $i i32) (local $e i32)
    (memory.fill (i32.add (global.get $uop_arena) (global.get $uop_cwmap_off))
                 (i32.const 0) (global.get $UOP_CWMAP_BYTES))
    (block $d (loop $l
      (br_if $d (i32.ge_u (local.get $i) (global.get $uop_nranges)))
      (local.set $e (i32.add (i32.add (global.get $uop_arena) (global.get $uop_ranges_off))
                             (i32.mul (local.get $i) (i32.const 12))))
      (call $uop_cw_add (i32.load (local.get $e)) (i32.load offset=4 (local.get $e)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $l)))
    (global.set $uop_cw_stale (i32.const 0))
    (global.set $uop_cw_rebuilds (i32.add (global.get $uop_cw_rebuilds) (i32.const 1))))

  ;; Called from $invalidate_code_range for every guest write that reached
  ;; code: kill every program lowered from a byte in [ga, ga+len).
  (func $uop_code_write (param $ga i32) (param $len i32)
    (local $end i32) (local $n0 i32)
    (local.set $end (i32.add (local.get $ga) (local.get $len)))
    (if (i32.eqz (call $uop_cw_maybe (local.get $ga) (local.get $end)))
      (then
        (global.set $uop_cw_skipped (i32.add (global.get $uop_cw_skipped) (i32.const 1)))
        (return)))
    (global.set $uop_cw_scans (i32.add (global.get $uop_cw_scans) (i32.const 1)))
    (local.set $n0 (global.get $uop_nranges))
    (call $uop_code_write_scan (local.get $ga) (local.get $end))
    (if (i32.ne (global.get $uop_nranges) (local.get $n0))
      ;; A kill: its ranges' bits are now stale.
      (then (global.set $uop_cw_stale (i32.const 1)))
      ;; A false "maybe". If ranges have gone since the last rebuild, their
      ;; leftover bits may be the reason, and a rebuild (one pass, the cost of
      ;; one scan) stops the same write paying for them again. Otherwise it
      ;; is two pages sharing a word, and rebuilding would change nothing.
      (else (if (global.get $uop_cw_stale) (then (call $uop_cw_rebuild))))))

  (func $uop_code_write_scan (param $ga i32) (param $end i32)
    (local $i i32) (local $e i32) (local $last i32)
    (block $d (loop $l
      (br_if $d (i32.ge_u (local.get $i) (global.get $uop_nranges)))
      (local.set $e (i32.add (i32.add (global.get $uop_arena) (global.get $uop_ranges_off))
                             (i32.mul (local.get $i) (i32.const 12))))
      (if (i32.and (i32.lt_u (local.get $ga) (i32.load offset=4 (local.get $e)))
                   (i32.gt_u (local.get $end) (i32.load (local.get $e))))
        (then
          (if (global.get $uop_census)
            (then (local.set $last (i32.load offset=8 (local.get $e)))
                  (if (i32.load (local.get $last)) (then
                  (call $uop_census_ev (i32.const 3) (i32.load offset=4 (local.get $last))
                    (i32.load offset=16 (local.get $last)) (i32.load offset=20 (local.get $last))
                    (local.get $ga))
                  (call $uop_census_exits (local.get $last))))))
          (call $uop_kill (i32.load offset=8 (local.get $e)))
          ;; swap-remove, and look at slot $i again
          (global.set $uop_nranges (i32.sub (global.get $uop_nranges) (i32.const 1)))
          (local.set $last (i32.add (i32.add (global.get $uop_arena) (global.get $uop_ranges_off))
                                    (i32.mul (global.get $uop_nranges) (i32.const 12))))
          (i32.store (local.get $e) (i32.load (local.get $last)))
          (i32.store offset=4 (local.get $e) (i32.load offset=4 (local.get $last)))
          (i32.store offset=8 (local.get $e) (i32.load offset=8 (local.get $last)))
          (br $l)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $l))))

  ;; A dead program's ranges only take table room (a full table is a flush).
  (func $uop_drop_ranges (param $pc i32)
    (local $i i32) (local $e i32) (local $last i32)
    (block $d (loop $l
      (br_if $d (i32.ge_u (local.get $i) (global.get $uop_nranges)))
      (local.set $e (i32.add (i32.add (global.get $uop_arena) (global.get $uop_ranges_off))
                             (i32.mul (local.get $i) (i32.const 12))))
      (if (i32.eq (i32.load offset=8 (local.get $e)) (local.get $pc))
        (then
          (global.set $uop_nranges (i32.sub (global.get $uop_nranges) (i32.const 1)))
          (local.set $last (i32.add (i32.add (global.get $uop_arena) (global.get $uop_ranges_off))
                                    (i32.mul (global.get $uop_nranges) (i32.const 12))))
          (i32.store (local.get $e) (i32.load (local.get $last)))
          (i32.store offset=4 (local.get $e) (i32.load offset=4 (local.get $last)))
          (i32.store offset=8 (local.get $e) (i32.load offset=8 (local.get $last)))
          (global.set $uop_cw_stale (i32.const 1))
          (br $l)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $l))))

  ;; Throw every program away: the arena is full, or the decoded code
  ;; everything was lowered from can no longer be trusted.
  (func $uop_flush
    (if (global.get $uop_census)
      (then (call $uop_census_arena (i32.const 10))
            (call $uop_census_ev (i32.const 4) (global.get $uop_gen) (global.get $uop_alloc)
              (global.get $uop_nranges) (i32.const 0))))
    (global.set $uop_gen (i32.add (global.get $uop_gen) (i32.const 1)))
    (if (i32.eqz (global.get $uop_gen)) (then (global.set $uop_gen (i32.const 1))))
    (global.set $uop_nranges (i32.const 0))
    ;; No ranges, so no filter bits: an empty filter is the exact answer.
    (memory.fill (i32.add (global.get $uop_arena) (global.get $uop_cwmap_off))
                 (i32.const 0) (global.get $UOP_CWMAP_BYTES))
    (global.set $uop_cw_stale (i32.const 0))
    ;; Nothing starts anywhere: every enter op and map way still naming this
    ;; generation's programs now fails $uop_live, whatever lands on the bytes.
    (memory.fill (i32.add (global.get $uop_arena) (global.get $uop_starts_off))
                 (i32.const 0) (global.get $UOP_STARTS_BYTES))
    (global.set $uop_alloc (i32.const 0)))
  ;; ... and when the code itself may have changed, the verdicts on it too:
  ;; forget every retired and declined marker ($uop_mark_dead).
  (func $uop_flush_all
    (if (global.get $uop_census)
      (then (call $uop_census_ev (i32.const 5) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))))
    (call $uop_flush)
    (memory.fill (i32.add (global.get $uop_arena) (global.get $uop_map_off))
                 (i32.const 0) (i32.const 0x8000))
    (memory.fill (call $uop_cut_slot (i32.const 0)) (i32.const 0) (i32.const 1024))
    (memory.fill (call $uop_icg_slot (i32.const 0)) (i32.const 0) (i32.const 2048))
    (global.set $uop_icg_retire (i32.const 0)))

  ;; Cut-exit landings (docs/uop-tier-design.md section 21.6). A trace's
  ;; straight-line cut EXITs to an address in the middle of the threaded
  ;; block that runs on past it, and publishing a block there retires that
  ;; covering block (the page index has one owner per byte). When the code is
  ;; generated and rewritten -- Smacker's blitters in Diablo's intro -- every
  ;; rewrite re-decodes the covering blocks first and every cut then retires
  ;; one: 99.5K overlap retirements in 1200 batches against 1.9K without
  ;; cuts, and the chunk garbage doubled the full cache clears. So the
  ;; lowering names every landing here and $fuse_stop ends a block at one,
  ;; with $th_block_end, which the branch clock (the only clock cuts exist
  ;; on) does not charge. A stale entry costs one free split, never a wrong
  ;; answer. 256 direct-mapped EIPs in the windows area's unused top 1KB
  ;; (the win census owns its first 9KB); cleared with the verdicts.
  (func $uop_cut_slot (param $eip i32) (result i32)
    (i32.add (i32.add (global.get $uop_arena) (global.get $uop_wins_off))
      (i32.add (i32.const 0x3000)
        (i32.shl
          (i32.and (i32.xor (local.get $eip) (i32.shr_u (local.get $eip) (i32.const 8)))
                   (i32.const 255))
          (i32.const 2)))))
  (global $uop_cut_notes (mut i32) (i32.const 0))
  (func $uop_cut_note (param $eip i32)
    (global.set $uop_cut_notes (i32.add (global.get $uop_cut_notes) (i32.const 1)))
    (i32.store (call $uop_cut_slot (local.get $eip)) (local.get $eip)))
  (func $uop_cut_probe (param $eip i32) (result i32)
    (if (i32.eqz (global.get $uop_enabled)) (then (return (i32.const 0))))
    (i32.eq (i32.load (call $uop_cut_slot (local.get $eip))) (local.get $eip)))
  (func (export "uop_cut_notes") (result i32) (global.get $uop_cut_notes))
  ;; Point this instance at its arena and start it empty. A worker's arena is
  ;; carved out of memory that held another thread's threaded code, so the map
  ;; is garbage until this clears it.
  (func $uop_set_arena (param $base i32) (param $size i32)
    (global.set $uop_arena (local.get $base))
    (global.set $uop_code_bytes (i32.sub (local.get $size) (global.get $UOP_TAIL)))
    (global.set $uop_temps_off (global.get $uop_code_bytes))
    (global.set $uop_wins_off (i32.add (global.get $uop_code_bytes) (i32.const 0x4000)))
    (global.set $uop_map_off (i32.add (global.get $uop_code_bytes) (i32.const 0x8000)))
    (global.set $uop_ranges_off (i32.add (global.get $uop_code_bytes) (i32.const 0x10000)))
    (global.set $uop_cwmap_off (i32.add (global.get $uop_code_bytes) (i32.const 0x1C000)))
    (global.set $uop_starts_off (i32.add (global.get $uop_code_bytes) (i32.const 0x20000)))
    (call $uop_flush_all))

  ;; The enter op, first in the head block's threaded code. Its operand is
  ;; the program header. Anything it cannot vouch for falls through into the
  ;; threaded block, which is the same code: the enter op is never needed for
  ;; correctness.
  (func $th_uop_enter (param $op i32)
    (local $nx_fn i32) (local $nx_op i32)
    (local $ep i32) (local $b0 i32) (local $b1 i32) (local $n i32) (local $spent i32)
    ;; $uop_live, not just the gen word: this op outlives the flush that
    ;; freed its program, and the bytes it names get reused.
    (if (i32.and
          (i32.and (call $uop_live (local.get $op))
                   (i32.eq (i32.load offset=4 (local.get $op)) (global.get $eip)))
          ;; $dbg_tier_guard, not $dbg_chain_guard: the handler histogram
          ;; must see the tier running (13-exports.wat $dbg_recompute).
          (i32.eqz (i32.or (global.get $dbg_tier_guard) (global.get $code16))))
      (then
        ;; Keep the windows the last run proved unless something they depend
        ;; on changed since; else poison them, so the first access through
        ;; each misses and guards its own page.
        ;; A plain load: an atomic one is a full barrier on arm64 (dmb ish
        ;; either side) on every entry, and orders nothing this needs -- the
        ;; epoch can move the instant after either load, and a program that
        ;; then runs on proven windows is exactly as covered by the per-access
        ;; guards as one that read it a moment earlier.
        (local.set $ep (i32.load (global.get $UOP_WIN_EPOCH)))
        (if (i32.eq (i32.load offset=28 (local.get $op)) (local.get $ep))
          (then (global.set $uop_win_kept (i32.add (global.get $uop_win_kept) (i32.const 1))))
          (else
            (global.set $uop_win_reset (i32.add (global.get $uop_win_reset) (i32.const 1)))
            (call $uop_windows_reset (local.get $op) (local.get $ep))))
        (local.set $b0 (global.get $block_budget))
        (local.set $b1 (call $uop_run (i32.add (local.get $op) (global.get $UOP_HDR))
                                      (local.get $b0)))
        (global.set $block_budget (local.get $b1))
        (global.set $uop_enters (i32.add (global.get $uop_enters) (i32.const 1)))
        (local.set $spent (i32.sub (local.get $b0) (local.get $b1)))
        (global.set $uop_blocks (i64.add (global.get $uop_blocks)
          (i64.extend_i32_s (local.get $spent))))
        ;; Per-program enters/blocks, kept in locals for the poor test below:
        ;; $spent becomes the running block total.
        (local.set $n (i32.add (i32.load offset=16 (local.get $op)) (i32.const 1)))
        (i32.store offset=16 (local.get $op) (local.get $n))
        (local.set $spent (i32.add (i32.load offset=20 (local.get $op)) (local.get $spent)))
        (i32.store offset=20 (local.get $op) (local.get $spent))
        ;; A trace's exit said how far it got (84 WORK); saturating, so a
        ;; long-lived program's sum never wraps back to "poor".
        (if (global.get $uop_xwork)
          (then
            (local.set $ep (i32.add (i32.load offset=32 (local.get $op)) (global.get $uop_xwork)))
            (i32.store offset=32 (local.get $op)
              (select (i32.const 0x40000000) (local.get $ep) (i32.gt_u (local.get $ep) (i32.const 0x40000000))))
            (global.set $uop_xwork (i32.const 0))))
        (if (global.get $uop_census) (then (call $uop_census_exit (local.get $op))))
        ;; It left through a megamorphic site's guard ($uop_icg_count): kill
        ;; it so the head recompiles without that inline cache. Its enters
        ;; are zeroed so neither poor test below can mark the head.
        (if (global.get $uop_icg_retire)
          (then
            (if (global.get $uop_census) (then (call $uop_census_prog (i32.const 12) (local.get $op))))
            (global.set $uop_icg_retire (i32.const 0))
            (global.set $uop_icg_mkills (i32.add (global.get $uop_icg_mkills) (i32.const 1)))
            (call $uop_kill (local.get $op))
            (call $uop_drop_ranges (local.get $op))
            (i32.store offset=16 (local.get $op) (i32.const 0))
            (local.set $n (i32.const 0))))
        ;; EXITB: the batch is over, at the transfer target, as in threaded.
        (if (global.get $uop_bexit)
          (then
            (global.set $uop_bexit (i32.const 0))
            (global.set $block_budget (i32.const 0))
            (return)))
        ;; Resume in threaded code through $branch_end, adding back the block
        ;; it charges: an exit is not a transfer of its own. (An exit to the
        ;; head falls straight into the threaded head block instead, since
        ;; $branch_end would re-enter the program.)
        (if (i32.or (i32.ne (global.get $eip) (i32.load offset=4 (local.get $op)))
                    (i32.lt_s (local.get $b1) (i32.const 0)))
          (then
            (global.set $block_budget (i32.add (local.get $b1) (i32.const 1)))
            ;; $uop_poor_check's test, inline: the call is only made to retire
            (if (i32.and (i32.ge_u (local.get $n) (i32.const 256))
                         (i32.lt_u (local.get $spent) (i32.shl (local.get $n) (i32.const 1))))
              (then (call $uop_poor_check (local.get $op))))
            (return_call $branch_end)))
        (global.set $uop_head_exits (i32.add (global.get $uop_head_exits) (i32.const 1)))
        (i32.store offset=24 (local.get $op)
          (i32.add (i32.load offset=24 (local.get $op)) (i32.const 1)))
        ;; An exit at the head that spent no block did nothing at all: the
        ;; first access failed its guard (a store into a page holding decoded
        ;; code, say), and it will fail the same way next time. Such an entry
        ;; is exactly as poor as a short trip out of a side exit.
        (if (i32.eq (local.get $b0) (local.get $b1))
          (then (call $uop_poor_check (local.get $op))))))
    (dispatch-next))

  ;; Retire a program that is entered often and does almost nothing per
  ;; entry: the enter/exit is then pure overhead. Blocks per entry measure a
  ;; loop's work (its trips); they cannot measure a trace's, since a trace
  ;; never comes back to its head and under --branch-clock straight-line code
  ;; spends no block at all -- a 400-instruction run ending in one jnz scores
  ;; 1. So a trace is also credited the x86 instructions each exit's WORK op
  ;; names, and is poor only when it averages fewer than $UOP_POOR_WORK of
  ;; them per entry as well (docs/uop-tier-design.md §21.1). A loop's work
  ;; word stays 0, so for loops the rule is exactly the old one.
  (func $uop_poor_check (param $op i32)
    (if (i32.and
          (i32.and (i32.ge_u (i32.load offset=16 (local.get $op)) (i32.const 256))
                   (i32.lt_u (i32.load offset=20 (local.get $op))
                             (i32.shl (i32.load offset=16 (local.get $op)) (i32.const 1))))
          (i32.lt_u (i32.div_u (i32.load offset=32 (local.get $op)) (global.get $UOP_POOR_WORK))
                    (i32.load offset=16 (local.get $op))))
      (then
        (global.set $uop_retired_poor (i32.add (global.get $uop_retired_poor) (i32.const 1)))
        (if (global.get $uop_census)
          (then (call $uop_census_ev (i32.const 2) (i32.load offset=4 (local.get $op))
                  (i32.load offset=16 (local.get $op)) (i32.load offset=20 (local.get $op))
                  (global.get $eip))
                (call $uop_census_exits (local.get $op))))
        (call $uop_retire_poor (local.get $op)))))

  (func $uop_arena_addr (export "uop_arena") (result i32) (global.get $uop_arena))
  (func (export "uop_reg_base") (result i32) (global.get $reg_base))
  ;; A test's direct run has no enter op to act on a megamorphic exit.
  (func (export "uop_run") (param $pc i32) (param $budget i32) (result i32)
    (local $r i32)
    (local.set $r (call $uop_run (local.get $pc) (local.get $budget)))
    (global.set $uop_icg_retire (i32.const 0))
    (local.get $r))
  ;; CF | ZF<<1 | SF<<2 | OF<<3 | PF<<4, so a test can compare two arms'
  ;; flags whatever lazy representation each left behind.
  (func (export "uop_flags") (result i32)
    (i32.or
      (i32.or (i32.or (call $get_cf) (i32.shl (call $get_zf) (i32.const 1)))
              (i32.or (i32.shl (call $get_sf) (i32.const 2)) (i32.shl (call $get_of) (i32.const 3))))
      (i32.shl (call $get_pf) (i32.const 4))))
  (func (export "uop_stats") (param $which i32) (result i32)
    (if (i32.eq (local.get $which) (i32.const 0)) (then (return (global.get $uop_guard_fails))))
    (if (i32.eq (local.get $which) (i32.const 1)) (then (return (global.get $uop_reguards))))
    (if (i32.eq (local.get $which) (i32.const 2)) (then (return (global.get $uop_installs))))
    (if (i32.eq (local.get $which) (i32.const 3)) (then (return (global.get $uop_kills))))
    (if (i32.eq (local.get $which) (i32.const 4)) (then (return (global.get $uop_enters))))
    (if (i32.eq (local.get $which) (i32.const 5)) (then (return (i32.wrap_i64 (global.get $uop_blocks)))))
    (if (i32.eq (local.get $which) (i32.const 6)) (then (return (global.get $uop_head_exits))))
    (if (i32.eq (local.get $which) (i32.const 7)) (then (return (global.get $uop_retired_poor))))
    (if (i32.eq (local.get $which) (i32.const 8)) (then (return (global.get $uop_gen))))
    (if (i32.eq (local.get $which) (i32.const 9)) (then (return (global.get $uop_win_kept))))
    (if (i32.eq (local.get $which) (i32.const 10)) (then (return (global.get $uop_win_reset))))
    ;; The code-write filter: writes it skipped, writes it scanned, rebuilds.
    (if (i32.eq (local.get $which) (i32.const 11)) (then (return (global.get $uop_cw_skipped))))
    (if (i32.eq (local.get $which) (i32.const 12)) (then (return (global.get $uop_cw_scans))))
    (if (i32.eq (local.get $which) (i32.const 13)) (then (return (global.get $uop_cw_rebuilds))))
    ;; Wide re-guards: pages proved, growth stopped by a non-adjacent backing page.
    (if (i32.eq (local.get $which) (i32.const 14)) (then (return (global.get $uop_rg_pages))))
    (if (i32.eq (local.get $which) (i32.const 15)) (then (return (global.get $uop_rg_nonadj))))
    ;; 16 DIVW exits; ICG 17/18 call r/m pass/fail, 19/20 IAT pass/fail
    (if (i32.eq (local.get $which) (i32.const 16)) (then (return (global.get $uop_div_exits))))
    (if (i32.eq (local.get $which) (i32.const 17)) (then (return (global.get $uop_icg_pass0))))
    (if (i32.eq (local.get $which) (i32.const 18)) (then (return (global.get $uop_icg_fail0))))
    (if (i32.eq (local.get $which) (i32.const 19)) (then (return (global.get $uop_icg_pass1))))
    (if (i32.eq (local.get $which) (i32.const 20)) (then (return (global.get $uop_icg_fail1))))
    ;; 21 sites found megamorphic, 22 programs killed for one (section 23)
    (if (i32.eq (local.get $which) (i32.const 21)) (then (return (global.get $uop_icg_megas))))
    (if (i32.eq (local.get $which) (i32.const 22)) (then (return (global.get $uop_icg_mkills))))
    (i32.const 0))
  ;; Where the lowering may write: 0 code base, 1 code bytes, 2 temps base,
  ;; 3 windows base.
  (func (export "uop_layout") (param $which i32) (result i32)
    (if (i32.eq (local.get $which) (i32.const 0)) (then (return (global.get $uop_arena))))
    (if (i32.eq (local.get $which) (i32.const 1)) (then (return (global.get $uop_code_bytes))))
    (if (i32.eq (local.get $which) (i32.const 2))
      (then (return (i32.add (global.get $uop_arena) (global.get $uop_temps_off)))))
    (if (i32.eq (local.get $which) (i32.const 3))
      (then (return (i32.add (global.get $uop_arena) (global.get $uop_wins_off)))))
    (i32.const 0))
  ;; Off also retires every installed program: bumping the generation makes
  ;; each enter op already in threaded code fall straight through, so the
  ;; switch takes effect mid-run without a cache flush.
  (func (export "set_uop") (param $on i32)
    (global.set $uop_enabled (i32.ne (local.get $on) (i32.const 0)))
    (if (i32.eqz (global.get $uop_enabled)) (then (call $uop_flush)))
    (call $bx_hot_gate_refresh))
  (func (export "get_uop") (result i32) (global.get $uop_enabled))
  (func (export "uop_add_range") (param $lo i32) (param $hi i32) (param $pc i32) (result i32)
    (call $uop_add_range (local.get $lo) (local.get $hi) (local.get $pc)))
  (func (export "uop_flush") (call $uop_flush))
  (func (export "uop_gen") (result i32) (global.get $uop_gen))
  ;; Test hook: install a hand-built program for $eip without the hotness
  ;; gate, exactly as $uop_try would.
  (func (export "set_uop_poor_work") (param $n i32)
    (global.set $UOP_POOR_WORK (select (local.get $n) (i32.const 1) (local.get $n))))
  (func (export "uop_install") (param $eip i32) (param $pc i32)
    (call $uop_install (local.get $eip) (local.get $pc)))
