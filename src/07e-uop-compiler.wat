  ;; ===================================================================
  ;; 07e-uop-compiler.wat — x86 -> micro-op lowering for 07d
  ;; ===================================================================
  ;;
  ;; docs/uop-tier-design.md. $uop_try (07d) calls $uop_compile when
  ;; $bx_hot_bump finds a hot branch target. It decodes the guest bytes around
  ;; that head, keeps the loop the head belongs to (every instruction reachable
  ;; from the head that can reach it again), lowers it to the engine's RISC
  ;; ops and writes the program into $UOP_ARENA. Everything it writes is data:
  ;; the engine is a fixed function, and no wasm is generated at run time.
  ;;
  ;; What the lowering does beyond a 1:1 translation:
  ;;   * guest registers ARE vregs 0-7, so a 32-bit reg-reg ALU op is one uop
  ;;     and a load/store addresses [base + idx<<sc + disp] in one uop;
  ;;   * flag forwarding: a Jcc reads the producing instruction's operands
  ;;     directly (cmp+jb -> BLTU, dec+jnz -> BNEZ, test+jz -> BEQZ ...), no
  ;;     flag globals are written on the fast path;
  ;;   * flag liveness: the lazy flag record is materialized (REC) only in exit
  ;;     stubs, and at a control-flow merge only when the merged flags are live
  ;;     and the incoming producers disagree; the first iteration is peeled when
  ;;     that is what keeps the steady-state loop free of a merge REC;
  ;;   * operands a later exit needs but the loop overwrites are snapshotted
  ;;     into temps, and only those (demand-driven, iterated to a fixed point);
  ;;   * memory windows: each address stream gets a window the engine guards
  ;;     once per page ("the start of the range is fast, so the range is");
  ;;   * exact block accounting (BUDGET in 07d);
  ;;   * exact deopt: every exit and every failed access leaves through a stub
  ;;     that sets EIP and the flag record exactly as threaded code would have.
  ;;
  ;; Working memory is $UOP_CSCRATCH, laid out below. Nothing in it outlives
  ;; one compile. Maps are open-addressed with a generation stamp per entry,
  ;; so clearing one is a counter bump rather than a fill.
  ;;
  ;; Instruction record (256 bytes, $UC_INSN + k*256):
  ;;   +0 a  +4 next  +8 kind  +12 op  +16 w  +20 cc  +24 target  +28 n
  ;;   +32 sw  +36 signed  +40 flags  +44 block  +48 loop position  +52 len
  ;;   +56 op0  +80 op1  +104 op2   (24 bytes each, see $uc_opr)
  ;;   +128 recipe kind  +132 recipe w  +136 A  +156 B  +176 R  +196 CFV
  ;;   +216 OFV   (refs, 20 bytes each, see $uc_ref_new)
  ;; Operand: +0 t (0 none, 1 reg, 2 mem, 3 imm)  +4 r | base  +8 part | idx
  ;;   +12 sc  +16 imm | disp  +20 w.  part: 0 d, 1 w, 2 l, 3 h.
  ;; Kinds: 0 unsup 1 alu 2 inc 3 dec 4 test 5 mov 6 lea 7 nop 8 xchg 9 cwde
  ;;   10 cdq 11 shift 12 not 13 neg 14 imul 15 jcc 16 jmp 17 movx
  ;;   18 shift-by-cl 19 setcc (+20 cc) 20 adc/sbb (32-bit only, +12 2/3)
  ;;   28 table jump (jmp [disp + r*4], $uc_jt_targets: +140 table length,
  ;;   +160 distinct targets, +224 their count).
  ;;   29 movsd (unprefixed): O0=[EDI], O1=[ESI], runtime DF step.
  ;;   31 pushad / popad (32-bit forms only; +12 0 pushad, 1 popad): O1 the
  ;;   lowest slot, [esp-32] / [esp]; the lowering walks its disp over the
  ;;   eight slots.
  ;; ALU op: 0 add 1 or 2 adc 3 sbb 4 and 5 sub 6 xor 7 cmp; shift op:
  ;;   0 shl 1 shr 2 sar 3 rol 4 ror (rol/ror only by immediate, kind 11).
  ;; flags: 1 in loop, 2 leader, 4 seam, 8 flags live in, 16 cut, 32 back.
  ;;
  ;; A flag state is (m, md, c, cd): m = where the full lazy flag record
  ;; comes from (1 = the globals are current, 2 = dead, else the producing
  ;; instruction's address), c = where CF comes from (inc/dec keep it),
  ;; md/cd = registers written since that producer ran.
  ;;
  ;; Decline reasons ($uop_decline_count): 1 scan-limit 2 overlap
  ;;   3 head-unsupported 4 no-backedge 5 loop-too-big 6 seam-ambiguous
  ;;   7 long-block 8 unreached-block 9 demand-no-fixpoint 10 branch-mid-block
  ;;   11 dead-flags-consumed 12 dead-cf 13 cf-no-recipe 14 cf-kind
  ;;   15 dead-flags-rec 16 rec-no-recipe 17 rec-kind 18 dead-flags-jcc
  ;;   19 kind 20 too-many-windows 21 label 22 arg 23 too-many-temps
  ;;   24 program-too-big 25 ranges-full 26 scratch-overflow
  ;;   27 call-indirect (a 1/3/4 whose scan met an unlowered FF /2)
  ;; Kinds 25 mul/imul (+12 0 mul 1 imul) and 26 div/idiv (+12 0/1), 32-bit
  ;; one-operand F7 forms, O0 the r/m ($uc_muldiv). A kind-23 call with
  ;; +12 != 0 is FF /2: +12 1 icall, 2 IAT, O2 the r/m, +24 the guarded
  ;; target ($uc_icall / $uc_iat).
  ;; Kind 27 MMX ($uc_mmx, --no-uop-mmx): +12 the 06c subop
  ;; ($mmx_opcode_subop / $mmx_group_subop), +28 the form: 0 mm,mm (or a
  ;; movd between an MMX and a general register) 1 mm,mem 2 mem,mm
  ;; 3 mm,imm8 (the 71-73 shift group). O0 the destination, O1 the source;
  ;; an MMX register operand is t 4 with r at +4. Lowered over the 07d MX*
  ;; ops, with MMX registers as cells of $MMX_FILE (arg type 7, aM).

  (global $UOP_CSCRATCH i32 (region.addr $UOP_CSCRATCH 0))
  (global $UOP_CSCRATCH_SIZE i32 (region.size $UOP_CSCRATCH))
  (global $UC_INSN   i32 (region.addr $UOP_CSCRATCH 0x000000))
  (global $UC_LOOP   i32 (region.addr $UOP_CSCRATCH 0x026000))
  (global $UC_WORK   i32 (region.addr $UOP_CSCRATCH 0x027000))
  (global $UC_SORT   i32 (region.addr $UOP_CSCRATCH 0x029000))
  (global $UC_BLK    i32 (region.addr $UOP_CSCRATCH 0x02A000))
  (global $UC_PRED   i32 (region.addr $UOP_CSCRATCH 0x031000))
  (global $UC_FLOW   i32 (region.addr $UOP_CSCRATCH 0x032000)) ;; 3 x 0xA000
  (global $UC_STUB   i32 (region.addr $UOP_CSCRATCH 0x050000)) ;; 2048 x 32
  (global $UC_CONST  i32 (region.addr $UOP_CSCRATCH 0x068000)) ;; 4096 x 4
  ;; A trace member's depth: the fewest x86 instructions any path from the
  ;; head retires before reaching it (by record index; $uc_form_trace).
  (global $UC_DEPTH  i32 (region.addr $UOP_CSCRATCH 0x060000)) ;; 608 x 4
  (global $UC_MISC   i32 (region.addr $UOP_CSCRATCH 0x06C000))
  (global $UC_CALLT  i32 (region.addr $UOP_CSCRATCH 0x06CE00)) ;; in MISC: call targets met (count, 16)
  (global $UC_ITEMS  i32 (region.addr $UOP_CSCRATCH 0x06D000)) ;; 0x40000
  (global $UC_HM_INSN  i32 (region.addr $UOP_CSCRATCH 0x0AD000)) ;; 2048
  (global $UC_HM_BLK   i32 (region.addr $UOP_CSCRATCH 0x0B6000)) ;; 1024
  (global $UC_HM_TEMP  i32 (region.addr $UOP_CSCRATCH 0x0BB000)) ;; 8192
  (global $UC_HM_CONST i32 (region.addr $UOP_CSCRATCH 0x0DC000)) ;; 4096
  (global $UC_HM_LABEL i32 (region.addr $UOP_CSCRATCH 0x0ED000)) ;; 8192
  (global $UC_HM_WIN   i32 (region.addr $UOP_CSCRATCH 0x10E000)) ;; 2048
  (global $UC_HM_DEM   i32 (region.addr $UOP_CSCRATCH 0x117000)) ;; 4096
  (global $UC_HM_STUB  i32 (region.addr $UOP_CSCRATCH 0x128000)) ;; 4096
  ;; One scratch serves every thread's instance, so a compile holds this word
  ;; (0 free, 1 held); see $uop_compile.
  (global $UC_LOCK     i32 (region.addr $UOP_CSCRATCH 0x139000))
  ;; Not compiler scratch either: the epoch every program's windows are
  ;; stamped with (07d $uop_win_bump). Shared, like the lock, because a
  ;; mapping or a decoded code page is shared by every thread's instance.
  (global $UOP_WIN_EPOCH i32 (region.addr $UOP_CSCRATCH 0x139004))
  ;; +0x139800..+0x13A000 is not compiler scratch either: it is $MMX_FILE, the
  ;; per-thread MMX registers (01-header.wat). Never clear this page wholesale.
  ;; Where $uc_encode_write resolves window ids: the program's own slots.
  (global $uc_wb (mut i32) (i32.const 0))
  (global $UC_ITEMS_BYTES i32 (i32.const 0x40000))
  (global $UC_MAX_SCAN  i32 (i32.const 600))  ;; instructions decoded looking for the loop
  (global $UC_MAX_LOOP  i32 (i32.const 400))  ;; instructions kept
  (global $UC_SPAN      i32 (i32.const 0x4000)) ;; how far from the head a branch may go
  ;; The span this compile is using: UC_SPAN, halved by $uc_lower_head after
  ;; a scan-limit decline down to UC_SPAN_MIN.
  (global $UC_SPAN_MIN  i32 (i32.const 0x200))
  (global $uc_span (mut i32) (i32.const 0x4000))
  (global $UC_MAX_TEMPS i32 (i32.const 4000))
  (global $UC_MAX_WIN   i32 (i32.const 64))
  (global $UC_MAX_STUBS i32 (i32.const 2048))
  (global $UC_G i32 (i32.const 1))
  (global $UC_D i32 (i32.const 2))

  (global $uc_ready   (mut i32) (i32.const 0))
  (global $uc_ninsn   (mut i32) (i32.const 0))
  (global $uc_nloop   (mut i32) (i32.const 0))
  (global $uc_nblk    (mut i32) (i32.const 0))
  (global $uc_head    (mut i32) (i32.const 0))
  (global $uc_mr_reg  (mut i32) (i32.const 0))
  (global $uc_imm_v   (mut i32) (i32.const 0))
  ;; the flag state register $uc_step works on
  (global $uc_sm  (mut i32) (i32.const 0))
  (global $uc_smd (mut i32) (i32.const 0))
  (global $uc_sc  (mut i32) (i32.const 0))
  (global $uc_scd (mut i32) (i32.const 0))
  ;; emitter
  (global $uc_nitems  (mut i32) (i32.const 0))
  (global $uc_nops    (mut i32) (i32.const 0))
  (global $uc_nscr    (mut i32) (i32.const 0))
  (global $uc_nstubs  (mut i32) (i32.const 0))
  (global $uc_nwin    (mut i32) (i32.const 0))
  (global $uc_err     (mut i32) (i32.const 0))
  (global $uc_rsp     (mut i32) (i32.const 0))
  (global $uc_ncopies (mut i32) (i32.const 0))
  (global $uc_enc_n   (mut i32) (i32.const 0))
  (global $uc_nconst  (mut i32) (i32.const 0))
  (global $uc_ntemps  (mut i32) (i32.const 0))
  ;; the deopt context of the instruction being lowered: its accesses exit to
  ;; a stub that re-executes it in this state
  (global $uc_x_eip (mut i32) (i32.const 0))
  ;; label kind 7: a forward label inside one instruction's lowering
  (global $uc_nlocal (mut i32) (i32.const 0))
  (global $uc_x_m   (mut i32) (i32.const 0))
  (global $uc_x_md  (mut i32) (i32.const 0))
  (global $uc_x_c   (mut i32) (i32.const 0))
  (global $uc_x_cd  (mut i32) (i32.const 0))
  ;; stats ($uop_cstat)
  (global $uc_compiled (mut i32) (i32.const 0))
  (global $uc_declined (mut i32) (i32.const 0))
  ;; The reason of the most recent decline, for the --uop-census event.
  (global $uc_last_why (mut i32) (i32.const 0))
  (global $uc_insns    (mut i32) (i32.const 0))
  (global $uc_uops     (mut i32) (i32.const 0))
  (global $uc_flushes  (mut i32) (i32.const 0))
  (global $uc_words    (mut i32) (i32.const 0))
  ;; run.js --uop-limit=N: compile only the first N programs (bisecting)
  (global $uc_limit    (mut i32) (i32.const 0))
  ;; --aggressive-stack ($uc_sp_block): elide a push and the pop that takes
  ;; its slot back in the same block, the value living in temp (20, push
  ;; address) between them. $uc_fwd_kind/$uc_fwd_a: the instruction being
  ;; lowered reads (1) or writes (2) that temp instead of memory.
  (global $uc_aggr     (mut i32) (i32.const 0))
  ;; --uop-muldiv: F7 /4-/7 (32-bit mul/imul/div/idiv) as kinds 25/26.
  ;; --uop-icall: FF /2 through a register or [base+idx*sc+disp] as a call
  ;; whose target is guarded (07d ICG) against the one the slot held when
  ;; the head was compiled. --uop-iat: the same for FF /2 [abs] (an import
  ;; slot) whose target is guest code in a loaded image, not the thunk zone.
  (global $uc_muldiv   (mut i32) (i32.const 0))
  (global $uc_icall    (mut i32) (i32.const 0))
  (global $uc_iat      (mut i32) (i32.const 0))
  ;; --no-uop-mmx turns kind 27 (MMX) off: on by default.
  (global $uc_mmx      (mut i32) (i32.const 1))
  (global $uc_rep      (mut i32) (i32.const 1))
  ;; sites in installed programs (uop_cstat 27 muldiv, 28 icall, 29 iat) and
  ;; FF /2 decodes refused for a target outside every image (30)
  (global $uc_n_muldiv (mut i32) (i32.const 0))
  (global $uc_n_icall  (mut i32) (i32.const 0))
  (global $uc_n_iat    (mut i32) (i32.const 0))
  (global $uc_n_icrej  (mut i32) (i32.const 0))
  ;; FF /2 decodes refused as megamorphic (uop_cstat 31)
  (global $uc_n_icmega (mut i32) (i32.const 0))
  (global $uc_fwd_kind (mut i32) (i32.const 0))
  (global $uc_fwd_a    (mut i32) (i32.const 0))

  ;; ------------------------------------------------------------- maps --
  ;; Header: +0 capacity (power of two) +4 stamp +8 count. Entry (16 bytes):
  ;; +0 key (i64) +8 value +12 stamp (== the header's when occupied).

  (func $uc_hm_init (param $m i32) (param $cap i32)
    (i32.store (local.get $m) (local.get $cap))
    (i32.store offset=4 (local.get $m) (i32.const 1))
    (i32.store offset=8 (local.get $m) (i32.const 0))
    (memory.fill (i32.add (local.get $m) (i32.const 16)) (i32.const 0)
                 (i32.shl (local.get $cap) (i32.const 4))))

  (func $uc_hm_clear (param $m i32)
    (local $s i32)
    (local.set $s (i32.add (i32.load offset=4 (local.get $m)) (i32.const 1)))
    (if (i32.eqz (local.get $s))
      (then (call $uc_hm_init (local.get $m) (i32.load (local.get $m))) (return)))
    (i32.store offset=4 (local.get $m) (local.get $s))
    (i32.store offset=8 (local.get $m) (i32.const 0)))

  (func $uc_hash (param $k i64) (param $cap i32) (result i32)
    (i32.and (i32.wrap_i64 (i64.shr_u (i64.mul (local.get $k) (i64.const 0x9E3779B97F4A7C15))
                                      (i64.const 32)))
             (i32.sub (local.get $cap) (i32.const 1))))

  ;; The entry holding $k, or the empty entry where it would go.
  (func $uc_hm_slot (param $m i32) (param $k i64) (result i32)
    (local $cap i32) (local $st i32) (local $h i32) (local $e i32)
    (local.set $cap (i32.load (local.get $m)))
    (local.set $st (i32.load offset=4 (local.get $m)))
    (local.set $h (call $uc_hash (local.get $k) (local.get $cap)))
    (loop $l
      (local.set $e (i32.add (i32.add (local.get $m) (i32.const 16))
                             (i32.shl (local.get $h) (i32.const 4))))
      (if (i32.ne (i32.load offset=12 (local.get $e)) (local.get $st)) (then (return (local.get $e))))
      (if (i64.eq (i64.load (local.get $e)) (local.get $k)) (then (return (local.get $e))))
      (local.set $h (i32.and (i32.add (local.get $h) (i32.const 1))
                             (i32.sub (local.get $cap) (i32.const 1))))
      (br $l))
    (unreachable))

  ;; The value stored under $k, or -1.
  (func $uc_hm_get (param $m i32) (param $k i64) (result i32)
    (local $e i32)
    (local.set $e (call $uc_hm_slot (local.get $m) (local.get $k)))
    (if (result i32) (i32.eq (i32.load offset=12 (local.get $e)) (i32.load offset=4 (local.get $m)))
      (then (i32.load offset=8 (local.get $e)))
      (else (i32.const -1))))

  ;; Store (or replace) $k -> $v. A table three quarters full refuses and
  ;; fails the compile: probing never meets a full table.
  (func $uc_hm_put (param $m i32) (param $k i64) (param $v i32)
    (local $e i32)
    (local.set $e (call $uc_hm_slot (local.get $m) (local.get $k)))
    (if (i32.ne (i32.load offset=12 (local.get $e)) (i32.load offset=4 (local.get $m)))
      (then
        (if (i32.ge_u (i32.shl (i32.load offset=8 (local.get $m)) (i32.const 2))
                      (i32.mul (i32.load (local.get $m)) (i32.const 3)))
          (then (call $uc_fail (i32.const 26)) (return)))
        (i64.store (local.get $e) (local.get $k))
        (i32.store offset=12 (local.get $e) (i32.load offset=4 (local.get $m)))
        (i32.store offset=8 (local.get $m) (i32.add (i32.load offset=8 (local.get $m)) (i32.const 1)))))
    (i32.store offset=8 (local.get $e) (local.get $v)))

  (func $uc_fail (param $why i32)
    (if (i32.eqz (global.get $uc_err)) (then (global.set $uc_err (local.get $why)))))

  (func $uc_init
    (call $uc_hm_init (global.get $UC_HM_INSN) (i32.const 2048))
    (call $uc_hm_init (global.get $UC_HM_BLK) (i32.const 1024))
    (call $uc_hm_init (global.get $UC_HM_TEMP) (i32.const 8192))
    (call $uc_hm_init (global.get $UC_HM_CONST) (i32.const 4096))
    (call $uc_hm_init (global.get $UC_HM_LABEL) (i32.const 8192))
    (call $uc_hm_init (global.get $UC_HM_WIN) (i32.const 2048))
    (call $uc_hm_init (global.get $UC_HM_DEM) (i32.const 4096))
    (call $uc_hm_init (global.get $UC_HM_STUB) (i32.const 4096))
    ;; the globals state, entering the head from threaded code
    (i32.store (global.get $UC_MISC) (global.get $UC_G))
    (i32.store offset=4 (global.get $UC_MISC) (i32.const 0))
    (i32.store offset=8 (global.get $UC_MISC) (global.get $UC_G))
    (i32.store offset=12 (global.get $UC_MISC) (i32.const 0))
    (global.set $uc_ready (i32.const 1)))

  ;; ---------------------------------------------------------- decoder --

  (func $uc_rd8 (param $q i32) (result i32)
    (i32.and (call $gl8 (local.get $q)) (i32.const 0xFF)))
  (func $uc_rd32 (param $q i32) (result i32)
    (i32.or (i32.or (call $uc_rd8 (local.get $q))
                    (i32.shl (call $uc_rd8 (i32.add (local.get $q) (i32.const 1))) (i32.const 8)))
            (i32.or (i32.shl (call $uc_rd8 (i32.add (local.get $q) (i32.const 2))) (i32.const 16))
                    (i32.shl (call $uc_rd8 (i32.add (local.get $q) (i32.const 3))) (i32.const 24)))))

  ;; A register operand of width w (8-bit registers 4-7 are AH..BH).
  (func $uc_opr (param $o i32) (param $r i32) (param $w i32)
    (i32.store (local.get $o) (i32.const 1))
    (i32.store offset=12 (local.get $o) (i32.const 0))
    (i32.store offset=16 (local.get $o) (i32.const 0))
    (i32.store offset=20 (local.get $o) (local.get $w))
    (if (i32.eq (local.get $w) (i32.const 8))
      (then
        (if (i32.lt_u (local.get $r) (i32.const 4))
          (then (i32.store offset=4 (local.get $o) (local.get $r))
                (i32.store offset=8 (local.get $o) (i32.const 2)))
          (else (i32.store offset=4 (local.get $o) (i32.sub (local.get $r) (i32.const 4)))
                (i32.store offset=8 (local.get $o) (i32.const 3)))))
      (else
        (i32.store offset=4 (local.get $o) (local.get $r))
        (i32.store offset=8 (local.get $o)
          (select (i32.const 1) (i32.const 0) (i32.eq (local.get $w) (i32.const 16)))))))

  (func $uc_opi (param $o i32) (param $v i32)
    (i32.store (local.get $o) (i32.const 3))
    (i32.store offset=4 (local.get $o) (i32.const 0))
    (i32.store offset=8 (local.get $o) (i32.const 0))
    (i32.store offset=12 (local.get $o) (i32.const 0))
    (i32.store offset=16 (local.get $o) (local.get $v))
    (i32.store offset=20 (local.get $o) (i32.const 0)))

  ;; An MMX register operand (kind 27): t 4, the register at +4.
  (func $uc_opm (param $o i32) (param $r i32)
    (i32.store (local.get $o) (i32.const 4))
    (i32.store offset=4 (local.get $o) (local.get $r))
    (i32.store offset=8 (local.get $o) (i32.const 0))
    (i32.store offset=12 (local.get $o) (i32.const 0))
    (i32.store offset=16 (local.get $o) (i32.const 0))
    (i32.store offset=20 (local.get $o) (i32.const 64)))

  ;; ModRM (+SIB, disp) at q into operand o; the reg field goes to
  ;; $uc_mr_reg. Answers the address after it.
  (func $uc_modrm (param $q i32) (param $w i32) (param $o i32) (result i32)
    (local $m i32) (local $mod i32) (local $rm i32) (local $s i32)
    (local $base i32) (local $idx i32) (local $sc i32) (local $disp i32)
    (local.set $m (call $uc_rd8 (local.get $q)))
    (local.set $q (i32.add (local.get $q) (i32.const 1)))
    (local.set $mod (i32.shr_u (local.get $m) (i32.const 6)))
    (global.set $uc_mr_reg (i32.and (i32.shr_u (local.get $m) (i32.const 3)) (i32.const 7)))
    (local.set $rm (i32.and (local.get $m) (i32.const 7)))
    (if (i32.eq (local.get $mod) (i32.const 3))
      (then (call $uc_opr (local.get $o) (local.get $rm) (local.get $w))
            (return (local.get $q))))
    (local.set $base (i32.const -1))
    (local.set $idx (i32.const -1))
    (if (i32.eq (local.get $rm) (i32.const 4))
      (then
        (local.set $s (call $uc_rd8 (local.get $q)))
        (local.set $q (i32.add (local.get $q) (i32.const 1)))
        (local.set $sc (i32.shr_u (local.get $s) (i32.const 6)))
        (local.set $idx (i32.and (i32.shr_u (local.get $s) (i32.const 3)) (i32.const 7)))
        (local.set $base (i32.and (local.get $s) (i32.const 7)))
        (if (i32.eq (local.get $idx) (i32.const 4)) (then (local.set $idx (i32.const -1))))
        (if (i32.and (i32.eq (local.get $base) (i32.const 5)) (i32.eqz (local.get $mod)))
          (then (local.set $base (i32.const -1))
                (local.set $disp (call $uc_rd32 (local.get $q)))
                (local.set $q (i32.add (local.get $q) (i32.const 4))))))
      (else
        (if (i32.and (i32.eq (local.get $rm) (i32.const 5)) (i32.eqz (local.get $mod)))
          (then (local.set $disp (call $uc_rd32 (local.get $q)))
                (local.set $q (i32.add (local.get $q) (i32.const 4))))
          (else (local.set $base (local.get $rm))))))
    (if (i32.eq (local.get $mod) (i32.const 1))
      (then (local.set $disp (call $imp_sx8 (call $uc_rd8 (local.get $q))))
            (local.set $q (i32.add (local.get $q) (i32.const 1)))))
    (if (i32.eq (local.get $mod) (i32.const 2))
      (then (local.set $disp (call $uc_rd32 (local.get $q)))
            (local.set $q (i32.add (local.get $q) (i32.const 4)))))
    (i32.store (local.get $o) (i32.const 2))
    (i32.store offset=4 (local.get $o) (local.get $base))
    (i32.store offset=8 (local.get $o) (local.get $idx))
    (i32.store offset=12 (local.get $o) (local.get $sc))
    (i32.store offset=16 (local.get $o) (local.get $disp))
    (i32.store offset=20 (local.get $o) (local.get $w))
    (local.get $q))

  ;; Immediate of width w at q, sign-extended into $uc_imm_v; answers its size.
  (func $uc_imm (param $q i32) (param $w i32) (result i32)
    (if (i32.eq (local.get $w) (i32.const 8))
      (then (global.set $uc_imm_v (call $imp_sx8 (call $uc_rd8 (local.get $q))))
            (return (i32.const 1))))
    (if (i32.eq (local.get $w) (i32.const 16))
      (then (global.set $uc_imm_v
              (call $win16_short (i32.or (call $uc_rd8 (local.get $q))
                                    (i32.shl (call $uc_rd8 (i32.add (local.get $q) (i32.const 1)))
                                             (i32.const 8)))))
            (return (i32.const 2))))
    (global.set $uc_imm_v (call $uc_rd32 (local.get $q)))
    (i32.const 4))

  (func $uc_unsup (param $R i32)
    (i32.store offset=8 (local.get $R) (i32.const 0))
    (i32.store offset=52 (local.get $R) (i32.const 1))
    (i32.store offset=4 (local.get $R) (i32.add (i32.load (local.get $R)) (i32.const 1))))

  (func $uc_fin (param $R i32) (param $kind i32) (param $end i32)
    (i32.store offset=8 (local.get $R) (local.get $kind))
    (i32.store offset=52 (local.get $R) (i32.sub (local.get $end) (i32.load (local.get $R))))
    (i32.store offset=4 (local.get $R) (local.get $end)))

  ;; One instruction at addr into record R. What the lowering cannot take is
  ;; kind 0 (unsup), one byte long.
  (func $uc_decode (param $addr i32) (param $R i32)
    (local $p i32) (local $v i32) (local $b i32) (local $n i32) (local $form i32)
    (local $w i32) (local $e i32) (local $op i32) (local $b2 i32) (local $O0 i32)
    (local $O1 i32) (local $O2 i32) (local $reg i32) (local $rep i32)
    (memory.fill (local.get $R) (i32.const 0) (i32.const 256))
    (i32.store (local.get $R) (local.get $addr))
    (local.set $O0 (i32.add (local.get $R) (i32.const 56)))
    (local.set $O1 (i32.add (local.get $R) (i32.const 80)))
    (local.set $O2 (i32.add (local.get $R) (i32.const 104)))
    (local.set $p (local.get $addr))
    (local.set $v (i32.const 32))
    (local.set $b (call $uc_rd8 (local.get $p)))
    (block $pd (loop $pl
      ;; one F3 among the 66s: only REP MOVS/STOS take it (kind 30, below)
      (if (i32.and (i32.eq (local.get $b) (i32.const 0xF3)) (i32.eqz (local.get $rep)))
        (then
          (local.set $rep (i32.const 1))
          (local.set $p (i32.add (local.get $p) (i32.const 1)))
          (local.set $b (call $uc_rd8 (local.get $p)))
          (br $pl)))
      (br_if $pd (i32.ne (local.get $b) (i32.const 0x66)))
      (local.set $n (i32.add (local.get $n) (i32.const 1)))
      (if (i32.gt_u (local.get $n) (i32.const 14)) (then (call $uc_unsup (local.get $R)) (return)))
      (local.set $v (i32.const 16))
      (local.set $p (i32.add (local.get $p) (i32.const 1)))
      (local.set $b (call $uc_rd8 (local.get $p)))
      (br $pl)))
    ;; 30 REP MOVS{B,W,D} / REP STOS{B,W,D}, 32-bit addressing, no segment
    ;; override (either would have stopped the loop above on an unsupported
    ;; prefix byte below). +12 is 0 movs / 1 stos, +16 the element width in
    ;; bits; O0 is [EDI], O1 [ESI] -- the operands $uc_win proves windows on.
    (if (local.get $rep)
      (then
        (if (i32.or (i32.eqz (global.get $uc_rep))
              (i32.eqz (i32.or (i32.or (i32.eq (local.get $b) (i32.const 0xA4)) (i32.eq (local.get $b) (i32.const 0xA5)))
                               (i32.or (i32.eq (local.get $b) (i32.const 0xAA)) (i32.eq (local.get $b) (i32.const 0xAB))))))
          (then (call $uc_unsup (local.get $R)) (return)))
        (i32.store offset=12 (local.get $R) (i32.ge_u (local.get $b) (i32.const 0xAA)))
        (i32.store offset=16 (local.get $R)
          (select (local.get $v) (i32.const 8) (i32.and (local.get $b) (i32.const 1))))
        (call $uc_stack_slot (local.get $O0) (i32.const 0))
        (i32.store offset=4 (local.get $O0) (i32.const 7))
        (call $uc_stack_slot (local.get $O1) (i32.const 0))
        (i32.store offset=4 (local.get $O1) (i32.const 6))
        (call $uc_fin (local.get $R) (i32.const 30) (i32.add (local.get $p) (i32.const 1)))
        (return)))
    (if (i32.or (i32.or (i32.or (i32.eq (local.get $b) (i32.const 0x26)) (i32.eq (local.get $b) (i32.const 0x2E)))
                        (i32.or (i32.eq (local.get $b) (i32.const 0x36)) (i32.eq (local.get $b) (i32.const 0x3E))))
                (i32.or (i32.or (i32.or (i32.eq (local.get $b) (i32.const 0x64)) (i32.eq (local.get $b) (i32.const 0x65)))
                                (i32.eq (local.get $b) (i32.const 0x67)))
                        (i32.or (i32.eq (local.get $b) (i32.const 0xF0))
                                (i32.or (i32.eq (local.get $b) (i32.const 0xF2)) (i32.eq (local.get $b) (i32.const 0xF3))))))
      (then (call $uc_unsup (local.get $R)) (return)))
    (local.set $p (i32.add (local.get $p) (i32.const 1)))
    ;; String dword copy, one element only. Prefix variants keep their
    ;; threaded semantics; never turn this into a bulk/memmove operation.
    (if (i32.and (i32.eq (local.get $b) (i32.const 0xA5)) (i32.eqz (local.get $n)))
      (then
        (call $uc_stack_slot (local.get $O0) (i32.const 0))
        (i32.store offset=4 (local.get $O0) (i32.const 7))
        (call $uc_stack_slot (local.get $O1) (i32.const 0))
        (i32.store offset=4 (local.get $O1) (i32.const 6))
        (call $uc_fin (local.get $R) (i32.const 29) (local.get $p)) (return)))
    ;; ALU 00-3F
    (if (i32.and (i32.lt_u (local.get $b) (i32.const 0x40))
                 (i32.lt_u (i32.and (local.get $b) (i32.const 7)) (i32.const 6)))
      (then
        (local.set $op (i32.shr_u (local.get $b) (i32.const 3)))
        (i32.store offset=12 (local.get $R) (local.get $op))
        (local.set $form (i32.and (local.get $b) (i32.const 7)))
        (if (i32.lt_u (local.get $form) (i32.const 4))
          (then
            (local.set $w (select (local.get $v) (i32.const 8) (i32.and (local.get $form) (i32.const 1))))
            ;; adc / sbb: 32-bit only (kind 20)
            (if (i32.and (i32.or (i32.eq (local.get $op) (i32.const 2)) (i32.eq (local.get $op) (i32.const 3)))
                         (i32.ne (local.get $w) (i32.const 32)))
              (then (call $uc_unsup (local.get $R)) (return)))
            (if (i32.lt_u (local.get $form) (i32.const 2))
              (then (local.set $e (call $uc_modrm (local.get $p) (local.get $w) (local.get $O0)))
                    (call $uc_opr (local.get $O1) (global.get $uc_mr_reg) (local.get $w)))
              (else (local.set $e (call $uc_modrm (local.get $p) (local.get $w) (local.get $O1)))
                    (call $uc_opr (local.get $O0) (global.get $uc_mr_reg) (local.get $w))))
            (i32.store offset=16 (local.get $R) (local.get $w))
            (call $uc_fin (local.get $R) (select (i32.const 20) (i32.const 1) (i32.eq (i32.or (local.get $op) (i32.const 1)) (i32.const 3)))
                          (local.get $e))
            (return)))
        (local.set $w (select (i32.const 8) (local.get $v) (i32.eq (local.get $form) (i32.const 4))))
        (if (i32.and (i32.or (i32.eq (local.get $op) (i32.const 2)) (i32.eq (local.get $op) (i32.const 3)))
                     (i32.ne (local.get $w) (i32.const 32)))
          (then (call $uc_unsup (local.get $R)) (return)))
        (local.set $n (call $uc_imm (local.get $p) (local.get $w)))
        (call $uc_opr (local.get $O0) (i32.const 0) (local.get $w))
        (call $uc_opi (local.get $O1) (global.get $uc_imm_v))
        (i32.store offset=16 (local.get $R) (local.get $w))
        (call $uc_fin (local.get $R) (select (i32.const 20) (i32.const 1) (i32.eq (i32.or (local.get $op) (i32.const 1)) (i32.const 3)))
                      (i32.add (local.get $p) (local.get $n)))
        (return)))
    ;; inc/dec r
    (if (i32.and (i32.ge_u (local.get $b) (i32.const 0x40)) (i32.le_u (local.get $b) (i32.const 0x4F)))
      (then
        (call $uc_opr (local.get $O0) (i32.and (local.get $b) (i32.const 7)) (local.get $v))
        (i32.store offset=16 (local.get $R) (local.get $v))
        (call $uc_fin (local.get $R)
          (select (i32.const 2) (i32.const 3) (i32.lt_u (local.get $b) (i32.const 0x48))) (local.get $p))
        (return)))
    ;; group 1: 80 81 83
    (if (i32.or (i32.eq (local.get $b) (i32.const 0x80))
                (i32.or (i32.eq (local.get $b) (i32.const 0x81)) (i32.eq (local.get $b) (i32.const 0x83))))
      (then
        (local.set $w (select (i32.const 8) (local.get $v) (i32.eq (local.get $b) (i32.const 0x80))))
        (local.set $e (call $uc_modrm (local.get $p) (local.get $w) (local.get $O0)))
        (local.set $op (global.get $uc_mr_reg))
        (if (i32.and (i32.or (i32.eq (local.get $op) (i32.const 2)) (i32.eq (local.get $op) (i32.const 3)))
                     (i32.ne (local.get $w) (i32.const 32)))
          (then (call $uc_unsup (local.get $R)) (return)))
        (local.set $n (call $uc_imm (local.get $e)
          (select (local.get $v) (i32.const 8) (i32.eq (local.get $b) (i32.const 0x81)))))
        (call $uc_opi (local.get $O1) (global.get $uc_imm_v))
        (i32.store offset=12 (local.get $R) (local.get $op))
        (i32.store offset=16 (local.get $R) (local.get $w))
        (call $uc_fin (local.get $R) (select (i32.const 20) (i32.const 1) (i32.eq (i32.or (local.get $op) (i32.const 1)) (i32.const 3)))
                      (i32.add (local.get $e) (local.get $n)))
        (return)))
    ;; test r/m, r
    (if (i32.or (i32.eq (local.get $b) (i32.const 0x84)) (i32.eq (local.get $b) (i32.const 0x85)))
      (then
        (local.set $w (select (i32.const 8) (local.get $v) (i32.eq (local.get $b) (i32.const 0x84))))
        (local.set $e (call $uc_modrm (local.get $p) (local.get $w) (local.get $O0)))
        (call $uc_opr (local.get $O1) (global.get $uc_mr_reg) (local.get $w))
        (i32.store offset=16 (local.get $R) (local.get $w))
        (call $uc_fin (local.get $R) (i32.const 4) (local.get $e))
        (return)))
    ;; test al/eax, imm
    (if (i32.or (i32.eq (local.get $b) (i32.const 0xA8)) (i32.eq (local.get $b) (i32.const 0xA9)))
      (then
        (local.set $w (select (i32.const 8) (local.get $v) (i32.eq (local.get $b) (i32.const 0xA8))))
        (local.set $n (call $uc_imm (local.get $p) (local.get $w)))
        (call $uc_opr (local.get $O0) (i32.const 0) (local.get $w))
        (call $uc_opi (local.get $O1) (global.get $uc_imm_v))
        (i32.store offset=16 (local.get $R) (local.get $w))
        (call $uc_fin (local.get $R) (i32.const 4) (i32.add (local.get $p) (local.get $n)))
        (return)))
    ;; mov 88-8B
    (if (i32.and (i32.ge_u (local.get $b) (i32.const 0x88)) (i32.le_u (local.get $b) (i32.const 0x8B)))
      (then
        (local.set $w (select (local.get $v) (i32.const 8) (i32.and (local.get $b) (i32.const 1))))
        (if (i32.lt_u (local.get $b) (i32.const 0x8A))
          (then (local.set $e (call $uc_modrm (local.get $p) (local.get $w) (local.get $O0)))
                (call $uc_opr (local.get $O1) (global.get $uc_mr_reg) (local.get $w)))
          (else (local.set $e (call $uc_modrm (local.get $p) (local.get $w) (local.get $O1)))
                (call $uc_opr (local.get $O0) (global.get $uc_mr_reg) (local.get $w))))
        (i32.store offset=16 (local.get $R) (local.get $w))
        (call $uc_fin (local.get $R) (i32.const 5) (local.get $e))
        (return)))
    ;; lea
    (if (i32.eq (local.get $b) (i32.const 0x8D))
      (then
        (local.set $e (call $uc_modrm (local.get $p) (local.get $v) (local.get $O1)))
        (if (i32.ne (i32.load (local.get $O1)) (i32.const 2)) (then (call $uc_unsup (local.get $R)) (return)))
        (call $uc_opr (local.get $O0) (global.get $uc_mr_reg) (local.get $v))
        (i32.store offset=16 (local.get $R) (local.get $v))
        (call $uc_fin (local.get $R) (i32.const 6) (local.get $e))
        (return)))
    (if (i32.eq (local.get $b) (i32.const 0x90))
      (then (call $uc_fin (local.get $R) (i32.const 7) (local.get $p)) (return)))
    ;; xchg eax, r
    (if (i32.and (i32.ge_u (local.get $b) (i32.const 0x91)) (i32.le_u (local.get $b) (i32.const 0x97)))
      (then
        (if (i32.ne (local.get $v) (i32.const 32)) (then (call $uc_unsup (local.get $R)) (return)))
        (call $uc_opr (local.get $O0) (i32.const 0) (i32.const 32))
        (call $uc_opr (local.get $O1) (i32.and (local.get $b) (i32.const 7)) (i32.const 32))
        (i32.store offset=16 (local.get $R) (i32.const 32))
        (call $uc_fin (local.get $R) (i32.const 8) (local.get $p))
        (return)))
    (if (i32.eq (local.get $b) (i32.const 0x87))
      (then
        (local.set $e (call $uc_modrm (local.get $p) (local.get $v) (local.get $O0)))
        (if (i32.or (i32.ne (i32.load (local.get $O0)) (i32.const 1)) (i32.ne (local.get $v) (i32.const 32)))
          (then (call $uc_unsup (local.get $R)) (return)))
        (call $uc_opr (local.get $O1) (global.get $uc_mr_reg) (i32.const 32))
        (i32.store offset=16 (local.get $R) (i32.const 32))
        (call $uc_fin (local.get $R) (i32.const 8) (local.get $e))
        (return)))
    (if (i32.eq (local.get $b) (i32.const 0x98))
      (then (if (i32.ne (local.get $v) (i32.const 32)) (then (call $uc_unsup (local.get $R)) (return)))
            (call $uc_fin (local.get $R) (i32.const 9) (local.get $p)) (return)))
    (if (i32.eq (local.get $b) (i32.const 0x99))
      (then (if (i32.ne (local.get $v) (i32.const 32)) (then (call $uc_unsup (local.get $R)) (return)))
            (call $uc_fin (local.get $R) (i32.const 10) (local.get $p)) (return)))
    ;; mov al/eax, [moffs] / mov [moffs], al/eax: an absolute disp32 operand
    (if (i32.and (i32.ge_u (local.get $b) (i32.const 0xA0)) (i32.le_u (local.get $b) (i32.const 0xA3)))
      (then
        (local.set $w (select (local.get $v) (i32.const 8) (i32.and (local.get $b) (i32.const 1))))
        (local.set $e (select (local.get $O1) (local.get $O0) (i32.lt_u (local.get $b) (i32.const 0xA2))))
        (i32.store (local.get $e) (i32.const 2))
        (i32.store offset=4 (local.get $e) (i32.const -1))
        (i32.store offset=8 (local.get $e) (i32.const -1))
        (i32.store offset=16 (local.get $e) (call $uc_rd32 (local.get $p)))
        (i32.store offset=20 (local.get $e) (local.get $w))
        (call $uc_opr (select (local.get $O0) (local.get $O1) (i32.lt_u (local.get $b) (i32.const 0xA2)))
                      (i32.const 0) (local.get $w))
        (i32.store offset=16 (local.get $R) (local.get $w))
        (call $uc_fin (local.get $R) (i32.const 5) (i32.add (local.get $p) (i32.const 4)))
        (return)))
    ;; mov r8, imm8
    (if (i32.and (i32.ge_u (local.get $b) (i32.const 0xB0)) (i32.le_u (local.get $b) (i32.const 0xB7)))
      (then
        (call $uc_opr (local.get $O0) (i32.and (local.get $b) (i32.const 7)) (i32.const 8))
        (call $uc_opi (local.get $O1) (call $imp_sx8 (call $uc_rd8 (local.get $p))))
        (i32.store offset=16 (local.get $R) (i32.const 8))
        (call $uc_fin (local.get $R) (i32.const 5) (i32.add (local.get $p) (i32.const 1)))
        (return)))
    ;; mov r, imm
    (if (i32.and (i32.ge_u (local.get $b) (i32.const 0xB8)) (i32.le_u (local.get $b) (i32.const 0xBF)))
      (then
        (local.set $n (call $uc_imm (local.get $p) (local.get $v)))
        (call $uc_opr (local.get $O0) (i32.and (local.get $b) (i32.const 7)) (local.get $v))
        (call $uc_opi (local.get $O1) (global.get $uc_imm_v))
        (i32.store offset=16 (local.get $R) (local.get $v))
        (call $uc_fin (local.get $R) (i32.const 5) (i32.add (local.get $p) (local.get $n)))
        (return)))
    ;; mov r/m, imm
    (if (i32.or (i32.eq (local.get $b) (i32.const 0xC6)) (i32.eq (local.get $b) (i32.const 0xC7)))
      (then
        (local.set $w (select (i32.const 8) (local.get $v) (i32.eq (local.get $b) (i32.const 0xC6))))
        (local.set $e (call $uc_modrm (local.get $p) (local.get $w) (local.get $O0)))
        (if (i32.ne (global.get $uc_mr_reg) (i32.const 0)) (then (call $uc_unsup (local.get $R)) (return)))
        (local.set $n (call $uc_imm (local.get $e) (local.get $w)))
        (call $uc_opi (local.get $O1) (global.get $uc_imm_v))
        (i32.store offset=16 (local.get $R) (local.get $w))
        (call $uc_fin (local.get $R) (i32.const 5) (i32.add (local.get $e) (local.get $n)))
        (return)))
    ;; shifts and rotates by an immediate / by one; shifts by CL (kind 18)
    (if (i32.or (i32.or (i32.or (i32.eq (local.get $b) (i32.const 0xC0)) (i32.eq (local.get $b) (i32.const 0xC1)))
                        (i32.or (i32.eq (local.get $b) (i32.const 0xD0)) (i32.eq (local.get $b) (i32.const 0xD1))))
                (i32.or (i32.eq (local.get $b) (i32.const 0xD2)) (i32.eq (local.get $b) (i32.const 0xD3))))
      (then
        (local.set $w (select (local.get $v) (i32.const 8) (i32.and (local.get $b) (i32.const 1))))
        (local.set $e (call $uc_modrm (local.get $p) (local.get $w) (local.get $O0)))
        (local.set $reg (global.get $uc_mr_reg))
        (local.set $op (i32.const -1))
        (if (i32.or (i32.eq (local.get $reg) (i32.const 4)) (i32.eq (local.get $reg) (i32.const 6)))
          (then (local.set $op (i32.const 0))))
        (if (i32.eq (local.get $reg) (i32.const 5)) (then (local.set $op (i32.const 1))))
        (if (i32.eq (local.get $reg) (i32.const 7)) (then (local.set $op (i32.const 2))))
        ;; rol / ror (3 / 4) are declined: a rotate writes only CF and OF and
        ;; leaves ZF/SF/PF from the instruction before it ($set_flags_rotate),
        ;; which this compiler's one-result flag record cannot express. It
        ;; used to model them as a result-producing op, so a `cmp / ror / jz`
        ;; tested the rotate's result -- Indeo 4's VLC reader loops on that.
        ;; The kind-11 lowering for op 3/4 below is kept for when the record
        ;; can carry preserved flags.
        (if (i32.lt_s (local.get $op) (i32.const 0)) (then (call $uc_unsup (local.get $R)) (return)))
        (if (i32.ge_u (local.get $b) (i32.const 0xD2))
          (then
            ;; The count is CL: the program deopts on a count of 0 (flags
            ;; untouched) or, below 32 bits, one of w or more.
            (i32.store offset=12 (local.get $R) (local.get $op))
            (i32.store offset=16 (local.get $R) (local.get $w))
            (call $uc_fin (local.get $R) (i32.const 18) (local.get $e))
            (return)))
        (local.set $n (i32.const 1))
        (if (i32.le_u (local.get $b) (i32.const 0xC1))
          (then (local.set $n (i32.and (call $uc_rd8 (local.get $e)) (i32.const 31)))
                (local.set $e (i32.add (local.get $e) (i32.const 1)))))
        ;; A rotate's count is taken modulo the width ($do_shift).
        (if (i32.ge_u (local.get $op) (i32.const 3))
          (then (local.set $n (i32.rem_u (local.get $n) (local.get $w)))))
        (if (i32.or (i32.ge_u (local.get $n) (local.get $w)) (i32.eqz (local.get $n)))
          (then (call $uc_unsup (local.get $R)) (return)))
        (i32.store offset=12 (local.get $R) (local.get $op))
        (i32.store offset=16 (local.get $R) (local.get $w))
        (i32.store offset=28 (local.get $R) (local.get $n))
        (call $uc_fin (local.get $R) (i32.const 11) (local.get $e))
        (return)))
    ;; group 3: F6 F7
    (if (i32.or (i32.eq (local.get $b) (i32.const 0xF6)) (i32.eq (local.get $b) (i32.const 0xF7)))
      (then
        (local.set $w (select (i32.const 8) (local.get $v) (i32.eq (local.get $b) (i32.const 0xF6))))
        (local.set $e (call $uc_modrm (local.get $p) (local.get $w) (local.get $O0)))
        (local.set $reg (global.get $uc_mr_reg))
        (i32.store offset=16 (local.get $R) (local.get $w))
        (if (i32.le_u (local.get $reg) (i32.const 1))
          (then
            (local.set $n (call $uc_imm (local.get $e) (local.get $w)))
            (call $uc_opi (local.get $O1) (global.get $uc_imm_v))
            (call $uc_fin (local.get $R) (i32.const 4) (i32.add (local.get $e) (local.get $n)))
            (return)))
        (if (i32.eq (local.get $reg) (i32.const 2))
          (then (call $uc_fin (local.get $R) (i32.const 12) (local.get $e)) (return)))
        (if (i32.eq (local.get $reg) (i32.const 3))
          (then (call $uc_fin (local.get $R) (i32.const 13) (local.get $e)) (return)))
        ;; mul/imul/div/idiv r/m32: EDX:EAX (kinds 25/26)
        (if (i32.and (global.get $uc_muldiv) (i32.eq (local.get $w) (i32.const 32)))
          (then
            (i32.store offset=12 (local.get $R) (i32.and (local.get $reg) (i32.const 1)))
            (call $uc_fin (local.get $R)
                  (select (i32.const 25) (i32.const 26) (i32.lt_u (local.get $reg) (i32.const 6)))
                  (local.get $e))
            (return)))
        (call $uc_unsup (local.get $R)) (return)))
    ;; group 4/5: FE FF
    (if (i32.or (i32.eq (local.get $b) (i32.const 0xFE)) (i32.eq (local.get $b) (i32.const 0xFF)))
      (then
        (local.set $w (select (i32.const 8) (local.get $v) (i32.eq (local.get $b) (i32.const 0xFE))))
        (local.set $e (call $uc_modrm (local.get $p) (local.get $w) (local.get $O0)))
        (i32.store offset=16 (local.get $R) (local.get $w))
        (if (i32.eqz (global.get $uc_mr_reg))
          (then (call $uc_fin (local.get $R) (i32.const 2) (local.get $e)) (return)))
        (if (i32.eq (global.get $uc_mr_reg) (i32.const 1))
          (then (call $uc_fin (local.get $R) (i32.const 3) (local.get $e)) (return)))
        ;; CALL r/m32 (FF /2) behind an inline cache (--uop-icall for call
        ;; reg / call [reg...], --uop-iat for call [abs]): a kind-23 call to
        ;; the target the slot holds now, which the program guards (ICG) and
        ;; leaves at the call when the slot holds anything else. O2 the r/m.
        (if (i32.and (i32.eq (global.get $uc_mr_reg) (i32.const 2))
                     (i32.and (i32.eq (local.get $b) (i32.const 0xFF)) (i32.eq (local.get $v) (i32.const 32))))
          (then
            (memory.copy (i32.add (local.get $R) (i32.const 104)) (local.get $O0) (i32.const 24))
            (local.set $n (call $uc_icall_class (local.get $O0)))
            ;; a site whose guard kept failing stays with the threaded code
            ;; (07d $uop_icg_count, docs/uop-tier-design.md section 23)
            (if (local.get $n)
              (then (if (call $uop_icg_is_mega (local.get $addr))
                (then (global.set $uc_n_icmega (i32.add (global.get $uc_n_icmega) (i32.const 1)))
                      (local.set $n (i32.const 0))))))
            (if (local.get $n)
              (then
                (local.set $w (call $uc_icall_target (local.get $O0)))
                (if (i32.eqz (local.get $w))
                  (then (global.set $uc_n_icrej (i32.add (global.get $uc_n_icrej) (i32.const 1)))
                        (call $uc_unsup (local.get $R)) (return)))
                (i32.store offset=12 (local.get $R) (local.get $n))
                (i32.store offset=24 (local.get $R) (local.get $w))
                (call $uc_opi (local.get $O0) (local.get $e))
                (call $uc_stack_slot (local.get $O1) (i32.const -4))
                (i32.store offset=16 (local.get $R) (i32.const 32))
                (call $uc_fin (local.get $R) (i32.const 23) (local.get $e))
                (return)))))
        ;; jmp dword [disp + r*4]: a switch table (kind 28). Its targets are
        ;; filled in by $uc_jt_targets, which needs the bound check before it.
        (if (i32.and (i32.and (i32.eq (local.get $b) (i32.const 0xFF))
                              (i32.eq (global.get $uc_mr_reg) (i32.const 4)))
                     (i32.and (i32.and (i32.ne (global.get $jump_table_on) (i32.const 0))
                                       (i32.eq (local.get $v) (i32.const 32)))
                              (i32.and (i32.eq (i32.load (local.get $O0)) (i32.const 2))
                                       (i32.and (i32.lt_s (i32.load offset=4 (local.get $O0)) (i32.const 0))
                                                (i32.and (i32.ge_s (i32.load offset=8 (local.get $O0)) (i32.const 0))
                                                         (i32.eq (i32.load offset=12 (local.get $O0)) (i32.const 2)))))))
          (then (call $uc_fin (local.get $R) (i32.const 28) (local.get $e)) (return)))
        (call $uc_unsup (local.get $R)) (return)))
    ;; imul r, r/m, imm
    (if (i32.or (i32.eq (local.get $b) (i32.const 0x69)) (i32.eq (local.get $b) (i32.const 0x6B)))
      (then
        (if (i32.ne (local.get $v) (i32.const 32)) (then (call $uc_unsup (local.get $R)) (return)))
        (local.set $e (call $uc_modrm (local.get $p) (i32.const 32) (local.get $O1)))
        (call $uc_opr (local.get $O0) (global.get $uc_mr_reg) (i32.const 32))
        (local.set $n (call $uc_imm (local.get $e)
          (select (i32.const 32) (i32.const 8) (i32.eq (local.get $b) (i32.const 0x69)))))
        (call $uc_opi (local.get $O2) (global.get $uc_imm_v))
        (i32.store offset=16 (local.get $R) (i32.const 32))
        (call $uc_fin (local.get $R) (i32.const 14) (i32.add (local.get $e) (local.get $n)))
        (return)))
    ;; jcc rel8
    (if (i32.and (i32.ge_u (local.get $b) (i32.const 0x70)) (i32.le_u (local.get $b) (i32.const 0x7F)))
      (then
        (i32.store offset=20 (local.get $R) (i32.and (local.get $b) (i32.const 15)))
        (i32.store offset=24 (local.get $R)
          (i32.add (i32.add (local.get $p) (i32.const 1)) (call $imp_sx8 (call $uc_rd8 (local.get $p)))))
        (call $uc_fin (local.get $R) (i32.const 15) (i32.add (local.get $p) (i32.const 1)))
        (return)))
    (if (i32.eq (local.get $b) (i32.const 0xEB))
      (then
        (i32.store offset=24 (local.get $R)
          (i32.add (i32.add (local.get $p) (i32.const 1)) (call $imp_sx8 (call $uc_rd8 (local.get $p)))))
        (call $uc_fin (local.get $R) (i32.const 16) (i32.add (local.get $p) (i32.const 1)))
        (return)))
    (if (i32.eq (local.get $b) (i32.const 0xE9))
      (then
        (if (i32.ne (local.get $v) (i32.const 32)) (then (call $uc_unsup (local.get $R)) (return)))
        (i32.store offset=24 (local.get $R)
          (i32.add (i32.add (local.get $p) (i32.const 4)) (call $uc_rd32 (local.get $p))))
        (call $uc_fin (local.get $R) (i32.const 16) (i32.add (local.get $p) (i32.const 4)))
        (return)))
    (if (i32.eq (local.get $b) (i32.const 0x0F))
      (then
        (local.set $b2 (call $uc_rd8 (local.get $p)))
        (local.set $p (i32.add (local.get $p) (i32.const 1)))
        (if (i32.and (i32.ge_u (local.get $b2) (i32.const 0x80)) (i32.le_u (local.get $b2) (i32.const 0x8F)))
          (then
            (if (i32.ne (local.get $v) (i32.const 32)) (then (call $uc_unsup (local.get $R)) (return)))
            (i32.store offset=20 (local.get $R) (i32.and (local.get $b2) (i32.const 15)))
            (i32.store offset=24 (local.get $R)
              (i32.add (i32.add (local.get $p) (i32.const 4)) (call $uc_rd32 (local.get $p))))
            (call $uc_fin (local.get $R) (i32.const 15) (i32.add (local.get $p) (i32.const 4)))
            (return)))
        (if (i32.or (i32.or (i32.eq (local.get $b2) (i32.const 0xB6)) (i32.eq (local.get $b2) (i32.const 0xB7)))
                    (i32.or (i32.eq (local.get $b2) (i32.const 0xBE)) (i32.eq (local.get $b2) (i32.const 0xBF))))
          (then
            (local.set $w (select (i32.const 16) (i32.const 8) (i32.and (local.get $b2) (i32.const 1))))
            (local.set $e (call $uc_modrm (local.get $p) (local.get $w) (local.get $O1)))
            (call $uc_opr (local.get $O0) (global.get $uc_mr_reg) (local.get $v))
            (i32.store offset=16 (local.get $R) (local.get $v))
            (i32.store offset=32 (local.get $R) (local.get $w))
            (i32.store offset=36 (local.get $R) (i32.ge_u (local.get $b2) (i32.const 0xBE)))
            (call $uc_fin (local.get $R) (i32.const 17) (local.get $e))
            (return)))
        ;; setcc r/m8
        (if (i32.and (i32.ge_u (local.get $b2) (i32.const 0x90)) (i32.le_u (local.get $b2) (i32.const 0x9F)))
          (then
            (local.set $e (call $uc_modrm (local.get $p) (i32.const 8) (local.get $O0)))
            (i32.store offset=20 (local.get $R) (i32.and (local.get $b2) (i32.const 15)))
            (i32.store offset=16 (local.get $R) (i32.const 8))
            (call $uc_fin (local.get $R) (i32.const 19) (local.get $e))
            (return)))
        (if (i32.eq (local.get $b2) (i32.const 0xAF))
          (then
            (if (i32.ne (local.get $v) (i32.const 32)) (then (call $uc_unsup (local.get $R)) (return)))
            (local.set $e (call $uc_modrm (local.get $p) (i32.const 32) (local.get $O2)))
            (call $uc_opr (local.get $O0) (global.get $uc_mr_reg) (i32.const 32))
            (call $uc_opr (local.get $O1) (global.get $uc_mr_reg) (i32.const 32))
            (i32.store offset=16 (local.get $R) (i32.const 32))
            (call $uc_fin (local.get $R) (i32.const 14) (local.get $e))
            (return)))
        (if (i32.eq (local.get $b2) (i32.const 0x1F))
          (then
            (local.set $e (call $uc_modrm (local.get $p) (local.get $v) (local.get $O2)))
            (memory.fill (local.get $O2) (i32.const 0) (i32.const 24))
            (call $uc_fin (local.get $R) (i32.const 7) (local.get $e))
            (return)))
        ;; MMX (kind 27): what 07-decoder lowers to 06c's handlers, minus
        ;; pmovmskb. A 66/F2/F3 prefix makes these the xmm forms: v is 16
        ;; under 66, and F2/F3 never reach here.
        (if (i32.and (global.get $uc_mmx) (i32.eq (local.get $v) (i32.const 32)))
          (then
            ;; EMMS (form 4). Before this the tier declined every loop that
            ;; ends its MMX run with one -- Collapse's particle blend (0x4287b0)
            ;; among them, so that loop never left threaded code.
            (if (i32.eq (local.get $b2) (i32.const 0x77))
              (then
                (call $uc_opm (local.get $O0) (i32.const 0))
                (call $uc_opm (local.get $O1) (i32.const 0))
                (i32.store offset=12 (local.get $R) (i32.const 0))
                (i32.store offset=16 (local.get $R) (i32.const 64))
                (i32.store offset=28 (local.get $R) (i32.const 4))
                (call $uc_fin (local.get $R) (i32.const 27) (local.get $p))
                (return)))
            (if (i32.and (i32.ge_u (local.get $b2) (i32.const 0x71)) (i32.le_u (local.get $b2) (i32.const 0x73)))
              (then
                (local.set $e (call $uc_modrm (local.get $p) (i32.const 64) (local.get $O0)))
                (local.set $n (call $mmx_group_subop (local.get $b2) (global.get $uc_mr_reg)))
                (if (i32.and (i32.ne (local.get $n) (i32.const -1)) (i32.eq (i32.load (local.get $O0)) (i32.const 1)))
                  (then
                    (call $uc_opm (local.get $O0) (i32.load offset=4 (local.get $O0)))
                    (call $uc_opi (local.get $O1) (call $uc_rd8 (local.get $e)))
                    (i32.store offset=12 (local.get $R) (local.get $n))
                    (i32.store offset=16 (local.get $R) (i32.const 64))
                    (i32.store offset=28 (local.get $R) (i32.const 3))
                    (call $uc_fin (local.get $R) (i32.const 27) (i32.add (local.get $e) (i32.const 1)))
                    (return)))
                (call $uc_unsup (local.get $R)) (return)))
            (local.set $n (if (result i32) (i32.eq (local.get $b2) (i32.const 0xE7))
                            (then (i32.const 0)) (else (call $mmx_opcode_subop (local.get $b2)))))
            (if (i32.and (i32.ne (local.get $n) (i32.const -1)) (i32.ne (local.get $b2) (i32.const 0xD7)))
              (then
                (local.set $w (select (i32.const 32) (i32.const 64)
                  (i32.or (i32.eq (local.get $b2) (i32.const 0x6E)) (i32.eq (local.get $b2) (i32.const 0x7E)))))
                (if (i32.or (i32.or (i32.eq (local.get $b2) (i32.const 0x7E)) (i32.eq (local.get $b2) (i32.const 0x7F)))
                            (i32.eq (local.get $b2) (i32.const 0xE7)))
                  (then
                    ;; the r/m is written: movd r/m32,mm  movq mm/m64,mm  movntq m64,mm
                    (local.set $e (call $uc_modrm (local.get $p) (local.get $w) (local.get $O0)))
                    (call $uc_opm (local.get $O1) (global.get $uc_mr_reg))
                    (if (i32.eq (i32.load (local.get $O0)) (i32.const 1))
                      (then
                        (if (i32.eq (local.get $b2) (i32.const 0xE7))
                          (then (call $uc_unsup (local.get $R)) (return)))
                        (if (i32.eq (local.get $b2) (i32.const 0x7F))
                          (then (call $uc_opm (local.get $O0) (i32.load offset=4 (local.get $O0)))))
                        (local.set $form (i32.const 0)))
                      (else (local.set $form (i32.const 2)))))
                  (else
                    (local.set $e (call $uc_modrm (local.get $p) (local.get $w) (local.get $O1)))
                    (call $uc_opm (local.get $O0) (global.get $uc_mr_reg))
                    (if (i32.eq (i32.load (local.get $O1)) (i32.const 1))
                      (then
                        (if (i32.ne (local.get $b2) (i32.const 0x6E))
                          (then (call $uc_opm (local.get $O1) (i32.load offset=4 (local.get $O1)))))
                        (local.set $form (i32.const 0)))
                      (else (local.set $form (i32.const 1))))))
                (i32.store offset=12 (local.get $R) (local.get $n))
                (i32.store offset=16 (local.get $R) (i32.const 64))
                (i32.store offset=28 (local.get $R) (local.get $form))
                (call $uc_fin (local.get $R) (i32.const 27) (local.get $e))
                (return)))))
        (call $uc_unsup (local.get $R)) (return)))
    ;; The stack (kinds 21-24), 32-bit forms only. O1 is the slot touched:
    ;; [esp-4] for push/call, [esp] for pop/ret.
    (if (i32.eq (local.get $v) (i32.const 32))
      (then
        (if (i32.and (i32.ge_u (local.get $b) (i32.const 0x50)) (i32.le_u (local.get $b) (i32.const 0x57)))
          (then (call $uc_opr (local.get $O0) (i32.and (local.get $b) (i32.const 7)) (i32.const 32))
                (call $uc_stack_slot (local.get $O1) (i32.const -4))
                (i32.store offset=16 (local.get $R) (i32.const 32))
                (call $uc_fin (local.get $R) (i32.const 21) (local.get $p))
                (return)))
        (if (i32.eq (local.get $b) (i32.const 0x68))
          (then (call $uc_opi (local.get $O0) (call $uc_rd32 (local.get $p)))
                (call $uc_stack_slot (local.get $O1) (i32.const -4))
                (i32.store offset=16 (local.get $R) (i32.const 32))
                (call $uc_fin (local.get $R) (i32.const 21) (i32.add (local.get $p) (i32.const 4)))
                (return)))
        (if (i32.eq (local.get $b) (i32.const 0x6A))
          (then (call $uc_opi (local.get $O0) (call $imp_sx8 (call $uc_rd8 (local.get $p))))
                (call $uc_stack_slot (local.get $O1) (i32.const -4))
                (i32.store offset=16 (local.get $R) (i32.const 32))
                (call $uc_fin (local.get $R) (i32.const 21) (i32.add (local.get $p) (i32.const 1)))
                (return)))
        ;; PUSHAD / POPAD (60 / 61; with a 66 prefix they are PUSHA / POPA
        ;; and stay unsupported). Kind 31, +12 0 / 1.
        (if (i32.or (i32.eq (local.get $b) (i32.const 0x60)) (i32.eq (local.get $b) (i32.const 0x61)))
          (then (call $uc_stack_slot (local.get $O1)
                  (select (i32.const -32) (i32.const 0) (i32.eq (local.get $b) (i32.const 0x60))))
                (i32.store offset=12 (local.get $R) (i32.eq (local.get $b) (i32.const 0x61)))
                (i32.store offset=16 (local.get $R) (i32.const 32))
                (call $uc_fin (local.get $R) (i32.const 31) (local.get $p))
                (return)))
        ;; POP ESP is left to the threaded code
        (if (i32.and (i32.and (i32.ge_u (local.get $b) (i32.const 0x58)) (i32.le_u (local.get $b) (i32.const 0x5F)))
                     (i32.ne (local.get $b) (i32.const 0x5C)))
          (then (call $uc_opr (local.get $O0) (i32.and (local.get $b) (i32.const 7)) (i32.const 32))
                (call $uc_stack_slot (local.get $O1) (i32.const 0))
                (i32.store offset=16 (local.get $R) (i32.const 32))
                (call $uc_fin (local.get $R) (i32.const 22) (local.get $p))
                (return)))
        ;; CALL rel32: O0 is the return address it pushes
        (if (i32.eq (local.get $b) (i32.const 0xE8))
          (then (i32.store offset=24 (local.get $R)
                  (i32.add (i32.add (local.get $p) (i32.const 4)) (call $uc_rd32 (local.get $p))))
                (call $uc_opi (local.get $O0) (i32.add (local.get $p) (i32.const 4)))
                (call $uc_stack_slot (local.get $O1) (i32.const -4))
                (i32.store offset=16 (local.get $R) (i32.const 32))
                (call $uc_fin (local.get $R) (i32.const 23) (i32.add (local.get $p) (i32.const 4)))
                (return)))
        ;; RET / RET imm16: +28 the bytes released above the return address;
        ;; its successors are filled in by $uc_ret_targets
        (if (i32.or (i32.eq (local.get $b) (i32.const 0xC3)) (i32.eq (local.get $b) (i32.const 0xC2)))
          (then (call $uc_stack_slot (local.get $O1) (i32.const 0))
                (i32.store offset=16 (local.get $R) (i32.const 32))
                (if (i32.eq (local.get $b) (i32.const 0xC2))
                  (then (i32.store offset=28 (local.get $R)
                          (i32.or (call $uc_rd8 (local.get $p))
                                  (i32.shl (call $uc_rd8 (i32.add (local.get $p) (i32.const 1))) (i32.const 8))))
                        (local.set $p (i32.add (local.get $p) (i32.const 2)))))
                (call $uc_fin (local.get $R) (i32.const 24) (local.get $p))
                (return)))))
    (call $uc_unsup (local.get $R)))

  ;; A stack slot operand: [esp + disp], 32 bits.
  (func $uc_stack_slot (param $o i32) (param $disp i32)
    (i32.store (local.get $o) (i32.const 2))
    (i32.store offset=4 (local.get $o) (i32.const 4))
    (i32.store offset=8 (local.get $o) (i32.const -1))
    (i32.store offset=12 (local.get $o) (i32.const 0))
    (i32.store offset=16 (local.get $o) (local.get $disp))
    (i32.store offset=20 (local.get $o) (i32.const 32)))

  ;; An FF /2 r/m's inline-cache class: 1 call reg / call [reg...] (with
  ;; --uop-icall), 2 call [abs] through an import slot (with --uop-iat), 0 left
  ;; to the threaded code (the flag is off, or ESP is involved: the push moves
  ;; it, and a call through a stack slot is not a vtable).
  (func $uc_icall_class (param $o i32) (result i32)
    (if (i32.eq (i32.load (local.get $o)) (i32.const 1))
      (then (return (select (global.get $uc_icall) (i32.const 0)
                            (i32.ne (i32.load offset=4 (local.get $o)) (i32.const 4))))))
    (if (i32.or (i32.eq (i32.load offset=4 (local.get $o)) (i32.const 4))
                (i32.eq (i32.load offset=8 (local.get $o)) (i32.const 4)))
      (then (return (i32.const 0))))
    (if (i32.and (i32.lt_s (i32.load offset=4 (local.get $o)) (i32.const 0))
                 (i32.lt_s (i32.load offset=8 (local.get $o)) (i32.const 0)))
      (then (return (select (i32.const 2) (i32.const 0) (global.get $uc_iat)))))
    (global.get $uc_icall))

  ;; The target an FF /2 would call now: the register, or the dword its slot
  ;; holds, from the registers the compile is running with. 0 when that is not
  ;; guest code the tier may follow -- an unmapped slot or target, or an
  ;; API/COM thunk (the thunk zone stays an exit, as for E8).
  (func $uc_icall_target (param $o i32) (result i32)
    (local $a i32) (local $t i32)
    (if (i32.eq (i32.load (local.get $o)) (i32.const 1))
      (then (local.set $t (i32.load (i32.add (global.get $reg_base)
                                             (i32.shl (i32.load offset=4 (local.get $o)) (i32.const 2))))))
      (else
        (local.set $a (i32.load offset=16 (local.get $o)))
        (if (i32.ge_s (i32.load offset=4 (local.get $o)) (i32.const 0))
          (then (local.set $a (i32.add (local.get $a)
                  (i32.load (i32.add (global.get $reg_base) (i32.shl (i32.load offset=4 (local.get $o)) (i32.const 2))))))))
        (if (i32.ge_s (i32.load offset=8 (local.get $o)) (i32.const 0))
          (then (local.set $a (i32.add (local.get $a)
                  (i32.shl (i32.load (i32.add (global.get $reg_base) (i32.shl (i32.load offset=8 (local.get $o)) (i32.const 2))))
                           (i32.load offset=12 (local.get $o)))))))
        (if (i32.eqz (call $guest_addr_mapped (local.get $a))) (then (return (i32.const 0))))
        (local.set $t (call $gl32 (local.get $a)))))
    (if (i32.and (i32.ge_u (local.get $t) (global.get $thunk_guest_base))
                 (i32.lt_u (local.get $t) (global.get $thunk_guest_end)))
      (then (return (i32.const 0))))
    (if (i32.eqz (call $guest_addr_mapped (local.get $t))) (then (return (i32.const 0))))
    (local.get $t))

  ;; ---- per-instruction properties ----

  (func $uc_kind (param $R i32) (result i32) (i32.load offset=8 (local.get $R)))
  ;; A charged transfer: jcc, jmp, call, ret, table jump.
  (func $uc_is_branch (param $R i32) (result i32)
    (local $k i32)
    (local.set $k (call $uc_kind (local.get $R)))
    (i32.or (i32.or (i32.or (i32.eq (local.get $k) (i32.const 15)) (i32.eq (local.get $k) (i32.const 16)))
                    (i32.or (i32.eq (local.get $k) (i32.const 23)) (i32.eq (local.get $k) (i32.const 24))))
            (i32.eq (local.get $k) (i32.const 28))))
  (func $uc_nsucc (param $R i32) (result i32)
    (local $k i32)
    (local.set $k (call $uc_kind (local.get $R)))
    (if (i32.eq (local.get $k) (i32.const 24)) (then (return (i32.load offset=240 (local.get $R)))))
    (if (i32.eq (local.get $k) (i32.const 28)) (then (return (i32.load offset=224 (local.get $R)))))
    (select (i32.const 2) (i32.const 1) (i32.eq (local.get $k) (i32.const 15))))
  ;; jcc: next, target; jmp, call: target; ret: its candidate return
  ;; addresses (+24, +236); table jump: its distinct targets (+160, count
  ;; +224, $uc_jt_targets); anything else: next
  (func $uc_succ (param $R i32) (param $k i32) (result i32)
    (local $kd i32)
    (local.set $kd (call $uc_kind (local.get $R)))
    (if (i32.eq (local.get $kd) (i32.const 28))
      (then (return (i32.load offset=160 (i32.add (local.get $R) (i32.shl (local.get $k) (i32.const 2)))))))
    (if (i32.eq (local.get $kd) (i32.const 24))
      (then (return (i32.load (i32.add (local.get $R)
                                       (select (i32.const 24) (i32.const 236) (i32.eqz (local.get $k))))))))
    (if (i32.or (i32.eq (local.get $kd) (i32.const 16)) (i32.eq (local.get $kd) (i32.const 23)))
      (then (return (i32.load offset=24 (local.get $R)))))
    (if (i32.eqz (local.get $k)) (then (return (i32.load offset=4 (local.get $R)))))
    (i32.load offset=24 (local.get $R)))

  (func $uc_regbit (param $o i32) (result i32)
    (if (result i32) (i32.eq (i32.load (local.get $o)) (i32.const 1))
      (then (i32.shl (i32.const 1) (i32.load offset=4 (local.get $o))))
      (else (i32.const 0))))
  (func $uc_is_mem (param $o i32) (result i32)
    (i32.eq (i32.load (local.get $o)) (i32.const 2)))

  ;; Registers an instruction writes (a bitmask over 0-7).
  (func $uc_writes (param $R i32) (result i32)
    (local $k i32)
    (local.set $k (call $uc_kind (local.get $R)))
    (if (i32.eq (local.get $k) (i32.const 29)) (then (return (i32.const 192))))
    ;; pushad moves ESP; popad writes all eight (ESP by the release)
    (if (i32.eq (local.get $k) (i32.const 31))
      (then (return (select (i32.const 0xFF) (i32.const 16) (i32.load offset=12 (local.get $R))))))
    ;; rep movs: ECX ESI EDI; rep stos: ECX EDI
    (if (i32.eq (local.get $k) (i32.const 30))
      (then (return (select (i32.const 130) (i32.const 194) (i32.load offset=12 (local.get $R))))))
    (if (i32.eq (local.get $k) (i32.const 1))
      (then (return (select (i32.const 0) (call $uc_regbit (i32.add (local.get $R) (i32.const 56)))
                            (i32.eq (i32.load offset=12 (local.get $R)) (i32.const 7))))))
    (if (i32.or (i32.or (i32.or (i32.eq (local.get $k) (i32.const 5)) (i32.eq (local.get $k) (i32.const 17)))
                        (i32.or (i32.eq (local.get $k) (i32.const 6)) (i32.eq (local.get $k) (i32.const 2))))
                (i32.or (i32.or (i32.eq (local.get $k) (i32.const 3)) (i32.eq (local.get $k) (i32.const 13)))
                        (i32.or (i32.eq (local.get $k) (i32.const 12))
                                (i32.or (i32.or (i32.eq (local.get $k) (i32.const 11)) (i32.eq (local.get $k) (i32.const 18)))
                                        (i32.or (i32.eq (local.get $k) (i32.const 14))
                                                (i32.or (i32.eq (local.get $k) (i32.const 19))
                                                        (i32.eq (local.get $k) (i32.const 20))))))))
      (then (return (call $uc_regbit (i32.add (local.get $R) (i32.const 56))))))
    (if (i32.eq (local.get $k) (i32.const 8))
      (then (return (i32.or (call $uc_regbit (i32.add (local.get $R) (i32.const 56)))
                            (call $uc_regbit (i32.add (local.get $R) (i32.const 80)))))))
    (if (i32.eq (local.get $k) (i32.const 10)) (then (return (i32.const 4))))
    (if (i32.eq (local.get $k) (i32.const 9)) (then (return (i32.const 1))))
    ;; MMX: only movd r32,mm names a general register as its destination
    (if (i32.eq (local.get $k) (i32.const 27))
      (then (return (call $uc_regbit (i32.add (local.get $R) (i32.const 56))))))
    (if (i32.or (i32.eq (local.get $k) (i32.const 25)) (i32.eq (local.get $k) (i32.const 26)))
      (then (return (i32.const 5))))
    ;; push, call, ret move ESP; pop also writes its register
    (if (i32.eq (local.get $k) (i32.const 22))
      (then (return (i32.or (i32.const 16) (call $uc_regbit (i32.add (local.get $R) (i32.const 56)))))))
    (if (i32.or (i32.eq (local.get $k) (i32.const 21))
                (i32.or (i32.eq (local.get $k) (i32.const 23)) (i32.eq (local.get $k) (i32.const 24))))
      (then (return (i32.const 16))))
    (i32.const 0))

  (func $uc_touches_mem (param $R i32) (result i32)
    (local $k i32) (local $a i32) (local $b i32) (local $c i32)
    (local.set $k (call $uc_kind (local.get $R)))
    (if (i32.or (i32.eq (local.get $k) (i32.const 29)) (i32.eq (local.get $k) (i32.const 30)))
      (then (return (i32.const 1))))
    (local.set $a (call $uc_is_mem (i32.add (local.get $R) (i32.const 56))))
    (local.set $b (call $uc_is_mem (i32.add (local.get $R) (i32.const 80))))
    (local.set $c (call $uc_is_mem (i32.add (local.get $R) (i32.const 104))))
    (if (i32.or (i32.eq (local.get $k) (i32.const 1)) (i32.eq (local.get $k) (i32.const 5)))
      (then (return (i32.or (local.get $a) (local.get $b)))))
    (if (i32.eq (local.get $k) (i32.const 4)) (then (return (local.get $a))))
    (if (i32.eq (local.get $k) (i32.const 17)) (then (return (local.get $b))))
    (if (i32.eq (local.get $k) (i32.const 27)) (then (return (i32.or (local.get $a) (local.get $b)))))
    (if (i32.or (i32.or (i32.eq (local.get $k) (i32.const 2)) (i32.eq (local.get $k) (i32.const 3)))
                (i32.or (i32.eq (local.get $k) (i32.const 13))
                        (i32.or (i32.eq (local.get $k) (i32.const 12)) (i32.eq (local.get $k) (i32.const 11)))))
      (then (return (local.get $a))))
    (if (i32.eq (local.get $k) (i32.const 14)) (then (return (i32.or (local.get $b) (local.get $c)))))
    ;; a shift by CL reads the flags it may keep (count 0), setcc and sbb read
    ;; them outright: for $uc_liveness each is a consumer, like an exit
    (if (i32.or (i32.eq (local.get $k) (i32.const 18))
                (i32.or (i32.eq (local.get $k) (i32.const 19)) (i32.eq (local.get $k) (i32.const 20))))
      (then (return (i32.const 1))))
    (if (i32.or (i32.and (i32.ge_u (local.get $k) (i32.const 21)) (i32.le_u (local.get $k) (i32.const 24)))
                (i32.eq (local.get $k) (i32.const 31)))
      (then (return (i32.const 1))))
    ;; a table jump loads its entry and exits on any it did not expect
    (if (i32.eq (local.get $k) (i32.const 28)) (then (return (i32.const 1))))
    ;; mul/div: a memory operand, and (div) an exit -- a consumer either way
    (if (i32.or (i32.eq (local.get $k) (i32.const 25)) (i32.eq (local.get $k) (i32.const 26)))
      (then (return (i32.const 1))))
    (i32.const 0))

  ;; 2 sets every flag, 1 all but CF (inc/dec), 0 none, 3 leaves the flags
  ;; in the globals (a shift by CL: a count of 0 keeps the ones it had, so
  ;; its lowering writes the record either way and the state becomes 'G';
  ;; sbb likewise, whose record's CF fix-up has no recipe).
  (func $uc_flag_class (param $R i32) (result i32)
    (local $k i32)
    (local.set $k (call $uc_kind (local.get $R)))
    (if (i32.or (i32.or (i32.eq (local.get $k) (i32.const 18)) (i32.eq (local.get $k) (i32.const 20)))
                (i32.eq (local.get $k) (i32.const 25)))
      (then (return (i32.const 3))))
    (if (i32.or (i32.or (i32.eq (local.get $k) (i32.const 1)) (i32.eq (local.get $k) (i32.const 4)))
                (i32.or (i32.eq (local.get $k) (i32.const 13))
                        (i32.or (i32.eq (local.get $k) (i32.const 11))
                                (i32.eq (local.get $k) (i32.const 14)))))
      (then (return (i32.const 2))))
    (if (i32.or (i32.eq (local.get $k) (i32.const 2)) (i32.eq (local.get $k) (i32.const 3)))
      (then (return (i32.const 1))))
    (i32.const 0))

  ;; The state register after instruction R.
  (func $uc_step (param $R i32)
    (local $fc i32) (local $w i32)
    (local.set $fc (call $uc_flag_class (local.get $R)))
    (local.set $w (call $uc_writes (local.get $R)))
    (if (i32.eq (local.get $fc) (i32.const 3))
      (then
        (global.set $uc_sm (select (global.get $UC_D) (global.get $UC_G) (call $uc_rec_skip (local.get $R))))
        (global.set $uc_smd (i32.const 0))
        (global.set $uc_sc (global.get $uc_sm)) (global.set $uc_scd (i32.const 0))
        (return)))
    (if (i32.eq (local.get $fc) (i32.const 2))
      (then
        (global.set $uc_sm (i32.load (local.get $R))) (global.set $uc_smd (i32.const 0))
        (global.set $uc_sc (i32.load (local.get $R))) (global.set $uc_scd (i32.const 0))
        (return)))
    (if (i32.eq (local.get $fc) (i32.const 1))
      (then
        (global.set $uc_sm (i32.load (local.get $R))) (global.set $uc_smd (i32.const 0))
        (global.set $uc_scd (i32.or (global.get $uc_scd) (local.get $w)))
        (return)))
    (global.set $uc_smd (i32.or (global.get $uc_smd) (local.get $w)))
    (global.set $uc_scd (i32.or (global.get $uc_scd) (local.get $w))))

  (func $uc_state_load (param $p i32)
    (global.set $uc_sm (i32.load (local.get $p)))
    (global.set $uc_smd (i32.load offset=4 (local.get $p)))
    (global.set $uc_sc (i32.load offset=8 (local.get $p)))
    (global.set $uc_scd (i32.load offset=12 (local.get $p))))
  (func $uc_state_store (param $p i32)
    (i32.store (local.get $p) (global.get $uc_sm))
    (i32.store offset=4 (local.get $p) (global.get $uc_smd))
    (i32.store offset=8 (local.get $p) (global.get $uc_sc))
    (i32.store offset=12 (local.get $p) (global.get $uc_scd)))

  ;; ---- refs: where a producer's operand or result lives ----
  ;; +0 kind (0 reg, 1 temp, 2 imm) +4 reg | owner address | imm  +8 temp tag
  ;; +12 part  +16 zx (the width a temp was zero-extended from, or 0)
  ;; Temp tags: 1 a 2 b 3 s 4 x 5 y 6 r 7 pb 8 cfv 9 ofv 10 snap:A 11 snap:B
  ;;   12 snap:R 13 scratch

  (func $uc_ref_set (param $d i32) (param $kind i32) (param $a i32) (param $tag i32) (param $part i32) (param $zx i32)
    (i32.store (local.get $d) (local.get $kind))
    (i32.store offset=4 (local.get $d) (local.get $a))
    (i32.store offset=8 (local.get $d) (local.get $tag))
    (i32.store offset=12 (local.get $d) (local.get $part))
    (i32.store offset=16 (local.get $d) (local.get $zx)))

  (func $uc_ref_new (param $kind i32) (param $a i32) (param $tag i32) (param $part i32) (param $zx i32) (result i32)
    (local $d i32)
    (if (i32.ge_u (global.get $uc_rsp) (i32.const 96))
      (then (call $uc_fail (i32.const 26)) (global.set $uc_rsp (i32.const 0))))
    (local.set $d (i32.add (i32.add (global.get $UC_MISC) (i32.const 0x100))
                           (i32.mul (global.get $uc_rsp) (i32.const 20))))
    (global.set $uc_rsp (i32.add (global.get $uc_rsp) (i32.const 1)))
    (call $uc_ref_set (local.get $d) (local.get $kind) (local.get $a) (local.get $tag)
                      (local.get $part) (local.get $zx))
    (local.get $d))

  ;; readRef: operand o of instruction R, as its recipe names it.
  (func $uc_read_ref (param $d i32) (param $R i32) (param $o i32) (param $tag i32)
    (if (i32.eq (i32.load (local.get $o)) (i32.const 3))
      (then (call $uc_ref_set (local.get $d) (i32.const 2) (i32.load offset=16 (local.get $o))
                              (i32.const 0) (i32.const 0) (i32.const 0)) (return)))
    (if (i32.eq (i32.load (local.get $o)) (i32.const 1))
      (then (call $uc_ref_set (local.get $d) (i32.const 0) (i32.load offset=4 (local.get $o))
                              (i32.const 0) (i32.load offset=8 (local.get $o)) (i32.const 0)) (return)))
    (call $uc_ref_set (local.get $d) (i32.const 1) (i32.load (local.get $R)) (local.get $tag)
                      (i32.const 0) (i32.load offset=20 (local.get $o))))

  ;; recipeFor: what a flag consumer needs from producer R, and where each
  ;; piece lives after R ran. Pure in R, so a consumer laid out before its
  ;; producer (a loop header fed by the latch) can name it; the emitter
  ;; writes exactly these locations.
  ;; Recipe kinds: 0 none 1 test 2 cmp 3 add 4 sub 5 logic 6 inc 7 dec 8 neg
  ;;   9 shift 10 imul
  (func $uc_recipe (param $R i32)
    (local $a i32) (local $k i32) (local $O0 i32) (local $r32 i32) (local $op i32)
    (local.set $a (i32.load (local.get $R)))
    (local.set $k (call $uc_kind (local.get $R)))
    (local.set $O0 (i32.add (local.get $R) (i32.const 56)))
    (i32.store offset=128 (local.get $R) (i32.const 0))
    (i32.store offset=132 (local.get $R) (i32.load offset=16 (local.get $R)))
    (if (i32.eq (local.get $k) (i32.const 4))
      (then
        (i32.store offset=128 (local.get $R) (i32.const 1))
        (call $uc_read_ref (i32.add (local.get $R) (i32.const 136)) (local.get $R) (local.get $O0) (i32.const 1))
        (call $uc_read_ref (i32.add (local.get $R) (i32.const 156)) (local.get $R)
                           (i32.add (local.get $R) (i32.const 80)) (i32.const 2))
        (return)))
    (if (i32.eq (local.get $k) (i32.const 1))
      (then
        (call $uc_read_ref (i32.add (local.get $R) (i32.const 136)) (local.get $R) (local.get $O0) (i32.const 1))
        (call $uc_read_ref (i32.add (local.get $R) (i32.const 156)) (local.get $R)
                           (i32.add (local.get $R) (i32.const 80)) (i32.const 2))
        (local.set $op (i32.load offset=12 (local.get $R)))
        (if (i32.eq (local.get $op) (i32.const 7))
          (then (i32.store offset=128 (local.get $R) (i32.const 2)) (return)))
        (if (i32.and (i32.and (i32.eqz (i32.load offset=156 (local.get $R)))
                              (i32.eq (i32.load (local.get $O0)) (i32.const 1)))
                     (i32.eq (i32.load offset=160 (local.get $R)) (i32.load offset=4 (local.get $O0))))
          (then (call $uc_ref_set (i32.add (local.get $R) (i32.const 156)) (i32.const 1) (local.get $a)
                                  (i32.const 7) (i32.load offset=168 (local.get $R)) (i32.const 0))))
        (local.set $r32 (i32.and (i32.and (i32.eq (i32.load (local.get $O0)) (i32.const 1))
                                          (i32.eqz (i32.load offset=8 (local.get $O0))))
                                 (i32.eq (i32.load offset=16 (local.get $R)) (i32.const 32))))
        (i32.store offset=128 (local.get $R)
          (select (i32.const 3) (select (i32.const 4) (i32.const 5) (i32.eq (local.get $op) (i32.const 5)))
                  (i32.eqz (local.get $op))))
        (if (local.get $r32)
          (then (call $uc_ref_set (i32.add (local.get $R) (i32.const 176)) (i32.const 0)
                                  (i32.load offset=4 (local.get $O0)) (i32.const 0) (i32.const 0) (i32.const 0)))
          (else (call $uc_ref_set (i32.add (local.get $R) (i32.const 176)) (i32.const 1) (local.get $a)
                                  (i32.const 6) (i32.const 0) (i32.const 0))))
        (return)))
    (if (i32.or (i32.eq (local.get $k) (i32.const 2)) (i32.eq (local.get $k) (i32.const 3)))
      (then
        (i32.store offset=128 (local.get $R) (select (i32.const 6) (i32.const 7) (i32.eq (local.get $k) (i32.const 2))))
        (if (i32.and (i32.eq (i32.load (local.get $O0)) (i32.const 1)) (i32.eqz (i32.load offset=8 (local.get $O0))))
          (then (call $uc_ref_set (i32.add (local.get $R) (i32.const 176)) (i32.const 0)
                                  (i32.load offset=4 (local.get $O0)) (i32.const 0) (i32.const 0) (i32.const 0)))
          (else (call $uc_ref_set (i32.add (local.get $R) (i32.const 176)) (i32.const 1) (local.get $a)
                                  (i32.const 6) (i32.const 0) (i32.const 0))))
        (return)))
    (if (i32.eq (local.get $k) (i32.const 13))
      (then
        (i32.store offset=128 (local.get $R) (i32.const 8))
        (call $uc_ref_set (i32.add (local.get $R) (i32.const 176)) (i32.const 1) (local.get $a)
                          (i32.const 6) (i32.const 0) (i32.const 0))
        (return)))
    (if (i32.eq (local.get $k) (i32.const 11))
      (then
        (i32.store offset=128 (local.get $R) (i32.const 9))
        (call $uc_ref_set (i32.add (local.get $R) (i32.const 176)) (i32.const 1) (local.get $a)
                          (i32.const 6) (i32.const 0) (i32.const 0))
        (call $uc_ref_set (i32.add (local.get $R) (i32.const 196)) (i32.const 1) (local.get $a)
                          (i32.const 8) (i32.const 0) (i32.const 0))
        (return)))
    (if (i32.eq (local.get $k) (i32.const 14))
      (then
        (i32.store offset=128 (local.get $R) (i32.const 10))
        (i32.store offset=132 (local.get $R) (i32.const 32))
        (call $uc_ref_set (i32.add (local.get $R) (i32.const 176)) (i32.const 0)
                          (i32.load offset=4 (local.get $O0)) (i32.const 0) (i32.const 0) (i32.const 0))
        (call $uc_ref_set (i32.add (local.get $R) (i32.const 216)) (i32.const 1) (local.get $a)
                          (i32.const 9) (i32.const 0) (i32.const 0))
        (return))))

  ;; ------------------------------------------------------- the region --

  (func $uc_insn_at (param $a i32) (result i32)
    (call $uc_hm_get (global.get $UC_HM_INSN) (i64.extend_i32_u (local.get $a))))
  ;; The loop's record for address a, or 0.
  (func $uc_in_loop (param $a i32) (result i32)
    (local $r i32)
    (local.set $r (call $uc_insn_at (local.get $a)))
    (if (i32.lt_s (local.get $r) (i32.const 0)) (then (return (i32.const 0))))
    (if (i32.eqz (i32.and (i32.load offset=40 (local.get $r)) (i32.const 1))) (then (return (i32.const 0))))
    (local.get $r))
  (func $uc_flag (param $R i32) (param $bit i32) (result i32)
    (i32.ne (i32.and (i32.load offset=40 (local.get $R)) (local.get $bit)) (i32.const 0)))
  (func $uc_set_flag (param $R i32) (param $bit i32)
    (i32.store offset=40 (local.get $R) (i32.or (i32.load offset=40 (local.get $R)) (local.get $bit))))

  (func $uc_within (param $a i32) (param $b i32) (result i32)
    (local $d i64)
    (local.set $d (i64.sub (i64.extend_i32_u (local.get $a)) (i64.extend_i32_u (local.get $b))))
    (i64.lt_s (select (local.get $d) (i64.sub (i64.const 0) (local.get $d)) (i64.ge_s (local.get $d) (i64.const 0)))
              (i64.extend_i32_u (global.get $uc_span))))
  ;; Within SPAN of the head, or of a callee the scan has met ($UC_CALLT:
  ;; count, then up to 16 call targets).
  (func $uc_near (param $head i32) (param $s i32) (result i32)
    (local $i i32)
    (if (call $uc_within (local.get $s) (local.get $head)) (then (return (i32.const 1))))
    (block $d (loop $l
      (br_if $d (i32.ge_u (local.get $i) (i32.load (global.get $UC_CALLT))))
      (if (call $uc_within (local.get $s)
                           (i32.load (i32.add (global.get $UC_CALLT) (i32.shl (i32.add (local.get $i) (i32.const 1)) (i32.const 2)))))
        (then (return (i32.const 1))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $l)))
    (i32.const 0))

  ;; Where each ret may return to. From every call's target, walk the callee
  ;; (an inner call falls through to its return address) and give each ret
  ;; reached that call's return address as a candidate. The program checks
  ;; the address the ret actually pops against its candidates and deopts on
  ;; any other, so this is a guess about the common path, never a premise.
  ;; A ret with no candidate, or more than two, stays with the threaded code.
  ;; Candidates: +24, +236, count +240; walk stamp +244. The walk's stack is
  ;; $UC_BLK, unused until $uc_build_blocks.
  (func $uc_ret_targets
    (local $i i32) (local $C i32) (local $ra i32) (local $sp i32) (local $a i32)
    (local $R i32) (local $k i32) (local $n i32) (local $stamp i32)
    (block $cd (loop $cl
      (br_if $cd (i32.ge_u (local.get $i) (global.get $uc_ninsn)))
      (local.set $C (i32.add (global.get $UC_INSN) (i32.shl (local.get $i) (i32.const 8))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $cl (i32.ne (call $uc_kind (local.get $C)) (i32.const 23)))
      (local.set $stamp (local.get $i))
      (local.set $ra (i32.load offset=4 (local.get $C)))
      (i32.store (global.get $UC_BLK) (i32.load offset=24 (local.get $C)))
      (local.set $sp (i32.const 1))
      (block $wd (loop $wl
        (br_if $wd (i32.eqz (local.get $sp)))
        (local.set $sp (i32.sub (local.get $sp) (i32.const 1)))
        (local.set $a (i32.load (i32.add (global.get $UC_BLK) (i32.shl (local.get $sp) (i32.const 2)))))
        (local.set $R (call $uc_insn_at (local.get $a)))
        (br_if $wl (i32.lt_s (local.get $R) (i32.const 0)))
        (br_if $wl (i32.eq (i32.load offset=244 (local.get $R)) (local.get $stamp)))
        (i32.store offset=244 (local.get $R) (local.get $stamp))
        (local.set $k (call $uc_kind (local.get $R)))
        (br_if $wl (i32.eqz (local.get $k)))
        (if (i32.eq (local.get $k) (i32.const 24))
          (then
            (local.set $n (i32.load offset=240 (local.get $R)))
            (if (i32.eqz (local.get $n))
              (then (i32.store offset=24 (local.get $R) (local.get $ra))
                    (i32.store offset=240 (local.get $R) (i32.const 1))))
            (if (i32.and (i32.eq (local.get $n) (i32.const 1))
                         (i32.ne (i32.load offset=24 (local.get $R)) (local.get $ra)))
              (then (i32.store offset=236 (local.get $R) (local.get $ra))
                    (i32.store offset=240 (local.get $R) (i32.const 2))))
            (if (i32.and (i32.eq (local.get $n) (i32.const 2))
                         (i32.and (i32.ne (i32.load offset=24 (local.get $R)) (local.get $ra))
                                  (i32.ne (i32.load offset=236 (local.get $R)) (local.get $ra))))
              (then (i32.store offset=240 (local.get $R) (i32.const 3))))
            (br $wl)))
        (if (i32.gt_u (local.get $sp) (i32.const 0x1B00)) (then (br $wd)))
        (if (i32.eq (local.get $k) (i32.const 28))
          (then
            (local.set $n (i32.const 0))
            (block $jd (loop $jl
              (br_if $jd (i32.ge_u (local.get $n) (call $uc_nsucc (local.get $R))))
              (i32.store (i32.add (global.get $UC_BLK) (i32.shl (local.get $sp) (i32.const 2)))
                         (call $uc_succ (local.get $R) (local.get $n)))
              (local.set $sp (i32.add (local.get $sp) (i32.const 1)))
              (local.set $n (i32.add (local.get $n) (i32.const 1)))
              (br $jl)))
            (br $wl)))
        (if (i32.or (i32.eq (local.get $k) (i32.const 15)) (i32.eq (local.get $k) (i32.const 16)))
          (then (i32.store (i32.add (global.get $UC_BLK) (i32.shl (local.get $sp) (i32.const 2))) (i32.load offset=24 (local.get $R)))
                (local.set $sp (i32.add (local.get $sp) (i32.const 1)))))
        (if (i32.ne (local.get $k) (i32.const 16))
          (then (i32.store (i32.add (global.get $UC_BLK) (i32.shl (local.get $sp) (i32.const 2))) (i32.load offset=4 (local.get $R)))
                (local.set $sp (i32.add (local.get $sp) (i32.const 1)))))
        (br $wl)))
      (br $cl)))
    (local.set $i (i32.const 0))
    (block $rd (loop $rl
      (br_if $rd (i32.ge_u (local.get $i) (global.get $uc_ninsn)))
      (local.set $R (i32.add (global.get $UC_INSN) (i32.shl (local.get $i) (i32.const 8))))
      (if (i32.eq (call $uc_kind (local.get $R)) (i32.const 24))
        (then (if (i32.or (i32.eqz (i32.load offset=240 (local.get $R)))
                          (i32.gt_u (i32.load offset=240 (local.get $R)) (i32.const 2)))
                (then (call $uc_unsup (local.get $R))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $rl))))

  ;; The decoded record that runs straight into a, or 0: a record whose next
  ;; is a and that does not transfer unconditionally.
  (func $uc_jt_prev (param $a i32) (result i32)
    (local $i i32) (local $R i32) (local $k i32)
    (block $d (loop $l
      (br_if $d (i32.ge_u (local.get $i) (global.get $uc_ninsn)))
      (local.set $R (i32.add (global.get $UC_INSN) (i32.shl (local.get $i) (i32.const 8))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (local.set $k (call $uc_kind (local.get $R)))
      (br_if $l (i32.ne (i32.load offset=4 (local.get $R)) (local.get $a)))
      (br_if $l (i32.or (i32.or (i32.eqz (local.get $k)) (i32.eq (local.get $k) (i32.const 16)))
                        (i32.ge_u (local.get $k) (i32.const 23))))
      (return (local.get $R))))
    (i32.const 0))

  ;; A table jump's targets (kind 28, 0xFF /4 [disp + r*4]). The table's
  ;; length comes from the bound check the compiler put in front of it,
  ;;   cmp r, N-1 ; ja default ; [movzx r, byte [r' + btab]] ; jmp [tbl + r*4]
  ;; walking back over instructions that write neither the flags nor the
  ;; index; with the byte-table form the dword table's length is the largest
  ;; byte in btab[0..N-1], plus one. The targets are what the table holds NOW:
  ;; the program re-checks the entry it loads against this snapshot and exits
  ;; on any other value or any index past the length, so this is a guess about
  ;; the common path, never a premise (like $uc_ret_targets).
  ;; +140 table length (at most 16), +160 distinct targets, count +224.
  ;; No bound found, or too many entries: unsup, the threaded op keeps it.
  (func $uc_jt_targets (param $R i32)
    (local $idx i32) (local $a i32) (local $P i32) (local $k i32) (local $steps i32)
    (local $ja i32) (local $btab i32) (local $n i32) (local $j i32) (local $t i32)
    (local $m i32) (local $tbl i32) (local $nt i32)
    (local.set $idx (i32.load offset=64 (local.get $R)))
    (local.set $a (i32.load (local.get $R)))
    (local.set $btab (i32.const -1))
    (block $fail
      (block $found
        (loop $l
          (br_if $fail (i32.ge_u (local.get $steps) (i32.const 8)))
          (local.set $steps (i32.add (local.get $steps) (i32.const 1)))
          (local.set $P (call $uc_jt_prev (local.get $a)))
          (br_if $fail (i32.eqz (local.get $P)))
          (local.set $a (i32.load (local.get $P)))
          (local.set $k (call $uc_kind (local.get $P)))
          ;; ja default: from here back, the flags must survive to it
          (if (i32.and (i32.eqz (local.get $ja)) (i32.eq (local.get $k) (i32.const 15)))
            (then (br_if $fail (i32.ne (i32.load offset=20 (local.get $P)) (i32.const 7)))
                  (local.set $ja (i32.const 1))
                  (br $l)))
          ;; the byte table, between the ja and the jump: movzx idx, byte [..]
          ;; or MSVC's xor idx, idx / mov idx8, byte [..]. (The xor is only
          ;; what makes the table's bound right; the program checks the index
          ;; it actually has against n either way.)
          (if (i32.and (i32.eqz (local.get $ja))
                       (i32.or
                         (i32.and (i32.eq (local.get $k) (i32.const 17))
                                  (i32.and (i32.eq (i32.load offset=32 (local.get $P)) (i32.const 8))
                                           (i32.eqz (i32.load offset=36 (local.get $P)))))
                         (i32.and (i32.and (i32.eq (local.get $k) (i32.const 5))
                                           (i32.eq (i32.load offset=16 (local.get $P)) (i32.const 8)))
                                  (i32.and (i32.eq (i32.load offset=64 (local.get $P)) (i32.const 2))
                                           (i32.eq (i32.load offset=80 (local.get $P)) (i32.const 2))))))
            (then
              (if (i32.eq (call $uc_writes (local.get $P)) (i32.shl (i32.const 1) (local.get $idx)))
                (then
                  (br_if $fail (i32.ge_s (local.get $btab) (i32.const 0)))
                  (br_if $fail (i32.and (i32.eq (local.get $k) (i32.const 17))
                                        (i32.ne (i32.load offset=16 (local.get $P)) (i32.const 32))))
                  ;; [r' + btab] or [btab + r'*1]
                  (if (i32.and (i32.ge_s (i32.load offset=84 (local.get $P)) (i32.const 0))
                               (i32.lt_s (i32.load offset=88 (local.get $P)) (i32.const 0)))
                    (then (local.set $idx (i32.load offset=84 (local.get $P))))
                    (else
                      (br_if $fail (i32.or (i32.ge_s (i32.load offset=84 (local.get $P)) (i32.const 0))
                                           (i32.or (i32.lt_s (i32.load offset=88 (local.get $P)) (i32.const 0))
                                                   (i32.ne (i32.load offset=92 (local.get $P)) (i32.const 0)))))
                      (local.set $idx (i32.load offset=88 (local.get $P)))))
                  (local.set $btab (i32.load offset=96 (local.get $P)))
                  (br $l)))))
          ;; cmp idx, imm (full 32-bit register), after the ja
          (if (i32.and (i32.ne (local.get $ja) (i32.const 0))
                       (i32.and (i32.eq (local.get $k) (i32.const 1)) (i32.eq (i32.load offset=12 (local.get $P)) (i32.const 7))))
            (then
              (br_if $fail (i32.or (i32.ne (i32.load offset=56 (local.get $P)) (i32.const 1))
                                   (i32.or (i32.ne (i32.load offset=60 (local.get $P)) (local.get $idx))
                                           (i32.ne (i32.load offset=16 (local.get $P)) (i32.const 32)))))
              (br_if $fail (i32.ne (i32.load offset=80 (local.get $P)) (i32.const 3)))
              (local.set $n (i32.load offset=96 (local.get $P)))
              (br_if $fail (i32.gt_u (local.get $n) (i32.const 255)))
              (local.set $n (i32.add (local.get $n) (i32.const 1)))
              (br $found)))
          ;; anything else must leave the index alone, and past the ja the
          ;; flags too
          (br_if $fail (i32.ne (i32.and (call $uc_writes (local.get $P)) (i32.shl (i32.const 1) (local.get $idx)))
                               (i32.const 0)))
          (br_if $fail (i32.or (call $uc_is_branch (local.get $P))
                               (i32.and (i32.ne (local.get $ja) (i32.const 0))
                                        (i32.ne (call $uc_flag_class (local.get $P)) (i32.const 0)))))
          (br $l)))
      (br_if $fail (i32.eqz (local.get $ja)))
      ;; the dword table's length
      (if (i32.ge_s (local.get $btab) (i32.const 0))
        (then
          (local.set $m (i32.const 0))
          (local.set $j (i32.const 0))
          (block $bd (loop $bl
            (br_if $bd (i32.ge_u (local.get $j) (local.get $n)))
            (local.set $t (call $uc_rd8 (i32.add (local.get $btab) (local.get $j))))
            (if (i32.ge_u (local.get $t) (local.get $m)) (then (local.set $m (i32.add (local.get $t) (i32.const 1)))))
            (local.set $j (i32.add (local.get $j) (i32.const 1)))
            (br $bl)))
          (local.set $n (local.get $m))))
      (br_if $fail (i32.or (i32.eqz (local.get $n)) (i32.gt_u (local.get $n) (i32.const 16))))
      (i32.store offset=140 (local.get $R) (local.get $n))
      (local.set $tbl (i32.load offset=72 (local.get $R)))
      (local.set $j (i32.const 0))
      (block $td (loop $tl
        (br_if $td (i32.ge_u (local.get $j) (local.get $n)))
        (local.set $t (call $uc_rd32 (i32.add (local.get $tbl) (i32.shl (local.get $j) (i32.const 2)))))
        (local.set $m (i32.const 0))
        (block $sd (loop $sl
          (br_if $sd (i32.ge_u (local.get $m) (local.get $nt)))
          (br_if $sd (i32.eq (i32.load offset=160 (i32.add (local.get $R) (i32.shl (local.get $m) (i32.const 2))))
                             (local.get $t)))
          (local.set $m (i32.add (local.get $m) (i32.const 1)))
          (br $sl)))
        (if (i32.eq (local.get $m) (local.get $nt))
          (then (i32.store offset=160 (i32.add (local.get $R) (i32.shl (local.get $nt) (i32.const 2))) (local.get $t))
                (local.set $nt (i32.add (local.get $nt) (i32.const 1)))))
        (local.set $j (i32.add (local.get $j) (i32.const 1)))
        (br $tl)))
      (i32.store offset=224 (local.get $R) (local.get $nt))
      (return))
    (call $uc_unsup (local.get $R)))

  ;; Decode everything reachable from the head within SPAN, and keep what can
  ;; reach the head again, in address order rotated so the head is first.
  ;; 1 while $uc_lower_head retries a head with calls as the region's edge.
  (global $uc_nocall (mut i32) (i32.const 0))
  (func $uc_form_loop (param $head i32) (result i32)
    (local $sp i32) (local $a i32) (local $R i32) (local $k i32) (local $j i32)
    (local $s i32) (local $n i32) (local $x i32) (local $changed i32) (local $S i32)
    (local $h i32) (local $pos i32) (local $d i64)
    (call $uc_hm_clear (global.get $UC_HM_INSN))
    (global.set $uc_ninsn (i32.const 0))
    (global.set $uc_is_trace (i32.const 0))
    (i32.store (global.get $UC_CALLT) (i32.const 0))
    (i32.store (global.get $UC_WORK) (local.get $head))
    (local.set $sp (i32.const 1))
    (block $done (loop $l
      (br_if $done (i32.eqz (local.get $sp)))
      (local.set $sp (i32.sub (local.get $sp) (i32.const 1)))
      (local.set $a (i32.load (i32.add (global.get $UC_WORK) (i32.shl (local.get $sp) (i32.const 2)))))
      (br_if $l (i32.ge_s (call $uc_insn_at (local.get $a)) (i32.const 0)))
      (if (i32.ge_u (global.get $uc_ninsn) (global.get $UC_MAX_SCAN)) (then (return (i32.const 1))))
      (local.set $R (i32.add (global.get $UC_INSN) (i32.shl (global.get $uc_ninsn) (i32.const 8))))
      (call $uc_decode (local.get $a) (local.get $R))
      (call $uc_hm_put (global.get $UC_HM_INSN) (i64.extend_i32_u (local.get $a)) (local.get $R))
      (global.set $uc_ninsn (i32.add (global.get $uc_ninsn) (i32.const 1)))
      (if (i32.and (global.get $uc_nocall) (i32.eq (call $uc_kind (local.get $R)) (i32.const 23)))
        (then (call $uc_unsup (local.get $R))))
      ;; The app's game step must be entered as threaded code every time, so
      ;; its marker paces it (09a8 $th_logical_frame): never inside a program.
      ;; A head there is declined; a loop reaching it exits to it.
      (if (i32.eq (local.get $a) (global.get $logical_frame_addr))
        (then (call $uc_unsup (local.get $R))))
      (if (i32.eq (call $uc_kind (local.get $R)) (i32.const 28))
        (then (call $uc_jt_targets (local.get $R))))
      (br_if $l (i32.eqz (call $uc_kind (local.get $R))))
      ;; a call: its callee is near code too, and the return address is
      ;; where the callee's ret goes ($uc_ret_targets)
      (if (i32.eq (call $uc_kind (local.get $R)) (i32.const 23))
        (then
          (local.set $x (i32.load (global.get $UC_CALLT)))
          (if (i32.lt_u (local.get $x) (i32.const 16))
            (then (i32.store (i32.add (global.get $UC_CALLT) (i32.shl (i32.add (local.get $x) (i32.const 1)) (i32.const 2)))
                             (i32.load offset=24 (local.get $R)))
                  (i32.store (global.get $UC_CALLT) (i32.add (local.get $x) (i32.const 1)))))
          (i32.store (i32.add (global.get $UC_WORK) (i32.shl (local.get $sp) (i32.const 2))) (i32.load offset=4 (local.get $R)))
          (local.set $sp (i32.add (local.get $sp) (i32.const 1)))))
      (local.set $n (call $uc_nsucc (local.get $R)))
      (local.set $k (i32.const 0))
      (block $sd (loop $sl
        (br_if $sd (i32.ge_u (local.get $k) (local.get $n)))
        (local.set $s (call $uc_succ (local.get $R) (local.get $k)))
        (if (call $uc_near (local.get $head) (local.get $s))
          (then
            (i32.store (i32.add (global.get $UC_WORK) (i32.shl (local.get $sp) (i32.const 2))) (local.get $s))
            (local.set $sp (i32.add (local.get $sp) (i32.const 1)))))
        (local.set $k (i32.add (local.get $k) (i32.const 1)))
        (br $sl)))
      (br $l)))
    (if (global.get $uc_err) (then (return (global.get $uc_err))))
    (call $uc_ret_targets)
    ;; Address order (insertion sort; at most MAX_SCAN records).
    (local.set $k (i32.const 0))
    (block $d1 (loop $l1
      (br_if $d1 (i32.ge_u (local.get $k) (global.get $uc_ninsn)))
      (local.set $R (i32.add (global.get $UC_INSN) (i32.shl (local.get $k) (i32.const 8))))
      (local.set $j (local.get $k))
      (block $d2 (loop $l2
        (br_if $d2 (i32.eqz (local.get $j)))
        (local.set $x (i32.load (i32.add (global.get $UC_SORT)
                                         (i32.shl (i32.sub (local.get $j) (i32.const 1)) (i32.const 2)))))
        (br_if $d2 (i32.le_u (i32.load (local.get $x)) (i32.load (local.get $R))))
        (i32.store (i32.add (global.get $UC_SORT) (i32.shl (local.get $j) (i32.const 2))) (local.get $x))
        (local.set $j (i32.sub (local.get $j) (i32.const 1)))
        (br $l2)))
      (i32.store (i32.add (global.get $UC_SORT) (i32.shl (local.get $j) (i32.const 2))) (local.get $R))
      (local.set $k (i32.add (local.get $k) (i32.const 1)))
      (br $l1)))
    ;; Two decodes that overlap without starting at the same byte: data in
    ;; code, or a jump into the middle of an instruction. Not worth it.
    (local.set $k (i32.const 1))
    (block $d3 (loop $l3
      (br_if $d3 (i32.ge_u (local.get $k) (global.get $uc_ninsn)))
      (local.set $x (i32.load (i32.add (global.get $UC_SORT) (i32.shl (i32.sub (local.get $k) (i32.const 1)) (i32.const 2)))))
      (local.set $R (i32.load (i32.add (global.get $UC_SORT) (i32.shl (local.get $k) (i32.const 2)))))
      (if (i32.and (i32.ne (call $uc_kind (local.get $x)) (i32.const 0))
                   (i32.gt_u (i32.load offset=4 (local.get $x)) (i32.load (local.get $R))))
        (then (return (i32.const 2))))
      (local.set $k (i32.add (local.get $k) (i32.const 1)))
      (br $l3)))
    ;; Keep what can reach the head again: a supported instruction with a
    ;; supported successor already kept.
    (local.set $h (call $uc_insn_at (local.get $head)))
    (call $uc_set_flag (local.get $h) (i32.const 32))
    (local.set $changed (i32.const 1))
    (block $d4 (loop $l4
      (br_if $d4 (i32.eqz (local.get $changed)))
      (local.set $changed (i32.const 0))
      (local.set $k (global.get $uc_ninsn))
      (block $d5 (loop $l5
        (br_if $d5 (i32.eqz (local.get $k)))
        (local.set $k (i32.sub (local.get $k) (i32.const 1)))
        (local.set $R (i32.load (i32.add (global.get $UC_SORT) (i32.shl (local.get $k) (i32.const 2)))))
        (br_if $l5 (i32.eqz (call $uc_kind (local.get $R))))
        (br_if $l5 (call $uc_flag (local.get $R) (i32.const 32)))
        (local.set $n (call $uc_nsucc (local.get $R)))
        (local.set $j (i32.const 0))
        (block $d6 (loop $l6
          (br_if $d6 (i32.ge_u (local.get $j) (local.get $n)))
          (local.set $S (call $uc_insn_at (call $uc_succ (local.get $R) (local.get $j))))
          (if (i32.ge_s (local.get $S) (i32.const 0))
            (then
              (if (i32.and (i32.ne (call $uc_kind (local.get $S)) (i32.const 0))
                           (call $uc_flag (local.get $S) (i32.const 32)))
                (then (call $uc_set_flag (local.get $R) (i32.const 32))
                      (local.set $changed (i32.const 1))
                      (br $d6)))))
          (local.set $j (i32.add (local.get $j) (i32.const 1)))
          (br $l6)))
        (br $l5)))
      (br $l4)))
    (if (i32.eqz (call $uc_kind (local.get $h))) (then (return (i32.const 3))))
    ;; In the loop = kept and supported; count them and look for a back edge.
    (local.set $n (i32.const 0))
    (local.set $changed (i32.const 0))
    (local.set $k (i32.const 0))
    (block $d7 (loop $l7
      (br_if $d7 (i32.ge_u (local.get $k) (global.get $uc_ninsn)))
      (local.set $R (i32.add (global.get $UC_INSN) (i32.shl (local.get $k) (i32.const 8))))
      (if (i32.and (call $uc_flag (local.get $R) (i32.const 32)) (i32.ne (call $uc_kind (local.get $R)) (i32.const 0)))
        (then
          (call $uc_set_flag (local.get $R) (i32.const 1))
          (local.set $n (i32.add (local.get $n) (i32.const 1)))
          (local.set $j (i32.const 0))
          (block $bd (loop $bl
            (br_if $bd (i32.ge_u (local.get $j) (call $uc_nsucc (local.get $R))))
            (if (i32.eq (call $uc_succ (local.get $R) (local.get $j)) (local.get $head))
              (then (local.set $changed (i32.const 1))))
            (local.set $j (i32.add (local.get $j) (i32.const 1)))
            (br $bl)))))
      (local.set $k (i32.add (local.get $k) (i32.const 1)))
      (br $l7)))
    (if (i32.eqz (local.get $changed))
      (then
        (if (global.get $uc_trace) (then (return (call $uc_form_trace (local.get $head)))))
        (return (i32.const 4))))
    (if (i32.gt_u (local.get $n) (global.get $UC_MAX_LOOP)) (then (return (i32.const 5))))
    ;; Rotate: from the head to the end of the address order, then the rest.
    (local.set $pos (i32.const 0))
    (local.set $j (i32.const 0))
    (block $d8 (loop $l8
      (br_if $d8 (i32.ge_u (local.get $j) (i32.const 2)))
      (local.set $k (i32.const 0))
      (block $d9 (loop $l9
        (br_if $d9 (i32.ge_u (local.get $k) (global.get $uc_ninsn)))
        (local.set $R (i32.load (i32.add (global.get $UC_SORT) (i32.shl (local.get $k) (i32.const 2)))))
        (if (i32.and (call $uc_flag (local.get $R) (i32.const 1))
                     (i32.eq (i32.ge_u (i32.load (local.get $R)) (local.get $head)) (i32.eqz (local.get $j))))
          (then
            (i32.store offset=48 (local.get $R) (local.get $pos))
            (i32.store (i32.add (global.get $UC_LOOP) (i32.shl (local.get $pos) (i32.const 2))) (local.get $R))
            (local.set $pos (i32.add (local.get $pos) (i32.const 1)))))
        (local.set $k (i32.add (local.get $k) (i32.const 1)))
        (br $l9)))
      (local.set $j (i32.add (local.get $j) (i32.const 1)))
      (br $l8)))
    (global.set $uc_nloop (local.get $pos))
    (global.set $uc_head (local.get $head))
    (i32.const 0))

  ;; ------------------------------------------------------ trace heads --
  ;; --uop-trace-heads (docs/uop-tier-design.md §11.3 "coverage"): a hot
  ;; head with no back edge in its scan is not declined; the region is what
  ;; the head reaches forward instead -- straight-line code, both arms of a
  ;; branch, calls into their callees and rets back to an in-region call's
  ;; return address ($uc_ret_targets, checked at run time as for a loop).
  ;; Breadth-first from the head over supported instructions, at most
  ;; $uc_trace_max of them; every successor left out is an exit, as a loop's
  ;; are. No path comes back to the head (else the scan had a back edge), so
  ;; the lowering sees block 0 with no predecessors and never peels. The
  ;; logical-frame marker is unsupported in the scan, so a trace always
  ;; stops in front of it. Fewer than $uc_trace_min instructions stays a
  ;; no-backedge decline: the enter/exit would cost more than the trip saves.
  ;; On by default since 2026-09-28 (docs/uop-tier-design.md §13, default-on
  ;; decision); --no-uop-trace-heads / ?no-uop-trace-heads turn it off.
  (global $uc_trace (mut i32) (i32.const 1))
  (global $uc_trace_min (mut i32) (i32.const 8))
  (global $uc_trace_max (mut i32) (i32.const 160))
  (global $uc_ntraces (mut i32) (i32.const 0))
  (global $uc_is_trace (mut i32) (i32.const 0))
  ;; Straight-line cut exits (docs/uop-tier-design.md §21.3, on by default,
  ;; --no-uop-trace-cut): under --branch-clock a trace may also leave where
  ;; straight-line code runs on out of it -- past $uc_trace_max, or into an
  ;; unsupported instruction -- through an EXIT to the fall-through. The
  ;; program spends no block there, and the enter op's add-one-back around
  ;; $branch_end nets the resume to zero, which is exactly what threaded code
  ;; charges for running on. Off, or on the instruction clock (where the
  ;; threaded block the program cut into would end somewhere else), such
  ;; tails are trimmed back to the branch in front of them, as before.
  (global $uc_trace_cut (mut i32) (i32.const 1))
  (func $uc_form_trace (param $head i32) (result i32)
    (local $k i32) (local $R i32) (local $S i32) (local $j i32) (local $n i32)
    (local $qh i32) (local $qt i32) (local $pos i32) (local $h i32)
    ;; the loop pass flagged what reaches the head; start again
    (block $cd (loop $cl
      (br_if $cd (i32.ge_u (local.get $k) (global.get $uc_ninsn)))
      (local.set $R (i32.add (global.get $UC_INSN) (i32.shl (local.get $k) (i32.const 8))))
      (i32.store offset=40 (local.get $R) (i32.and (i32.load offset=40 (local.get $R)) (i32.const -2)))
      (local.set $k (i32.add (local.get $k) (i32.const 1)))
      (br $cl)))
    (local.set $h (call $uc_insn_at (local.get $head)))
    (call $uc_set_flag (local.get $h) (i32.const 1))
    (i32.store (call $uc_depth_p (local.get $h)) (i32.const 0))
    (i32.store (global.get $UC_WORK) (local.get $h))
    (local.set $qt (i32.const 1))
    (local.set $n (i32.const 1))
    (block $qd (loop $ql
      (br_if $qd (i32.ge_u (local.get $qh) (local.get $qt)))
      (local.set $R (i32.load (i32.add (global.get $UC_WORK) (i32.shl (local.get $qh) (i32.const 2)))))
      (local.set $qh (i32.add (local.get $qh) (i32.const 1)))
      (local.set $j (i32.const 0))
      (block $sd (loop $sl
        (br_if $sd (i32.ge_u (local.get $j) (call $uc_nsucc (local.get $R))))
        (local.set $S (call $uc_insn_at (call $uc_succ (local.get $R) (local.get $j))))
        (local.set $j (i32.add (local.get $j) (i32.const 1)))
        (br_if $sl (i32.lt_s (local.get $S) (i32.const 0)))
        (br_if $sl (i32.eqz (call $uc_kind (local.get $S))))
        (br_if $sl (call $uc_flag (local.get $S) (i32.const 1)))
        (br_if $sd (i32.ge_u (local.get $n) (global.get $uc_trace_max)))
        (call $uc_set_flag (local.get $S) (i32.const 1))
        ;; breadth-first, so the first path to reach S is a shortest one
        (i32.store (call $uc_depth_p (local.get $S))
                   (i32.add (i32.load (call $uc_depth_p (local.get $R))) (i32.const 1)))
        (i32.store (i32.add (global.get $UC_WORK) (i32.shl (local.get $qt) (i32.const 2))) (local.get $S))
        (local.set $qt (i32.add (local.get $qt) (i32.const 1)))
        (local.set $n (i32.add (local.get $n) (i32.const 1)))
        (br $sl)))
      (br $ql)))
    ;; A trace leaves only by a branch, as a loop does. An instruction that
    ;; runs straight on into code outside (unsupported, the logical-frame
    ;; marker, past $uc_trace_max) would exit where threaded code continues
    ;; its block -- or, at the marker, cuts it -- and the program would charge
    ;; that exit a block threaded code does not. Drop such tails back to the
    ;; branch in front of them, whose arm then becomes the exit.
    (local.set $qt (i32.const 1))
    (block $td (loop $tl
      (br_if $td (i32.eqz (local.get $qt)))
      (local.set $qt (i32.const 0))
      (local.set $k (i32.const 0))
      (block $kd (loop $kl
        (br_if $kd (i32.ge_u (local.get $k) (global.get $uc_ninsn)))
        (local.set $R (i32.add (global.get $UC_INSN) (i32.shl (local.get $k) (i32.const 8))))
        (local.set $k (i32.add (local.get $k) (i32.const 1)))
        (br_if $kl (i32.eqz (call $uc_flag (local.get $R) (i32.const 1))))
        (br_if $kl (call $uc_is_branch (local.get $R)))
        ;; a cut exit keeps the tail (not in front of the game-step marker,
        ;; which must be entered as the threaded block it paces)
        (br_if $kl (i32.and (i32.and (i32.ne (global.get $uc_trace_cut) (i32.const 0))
                                     (i32.ne (global.get $branch_clock) (i32.const 0)))
                            (i32.ne (call $uc_succ (local.get $R) (i32.const 0)) (global.get $logical_frame_addr))))
        (local.set $S (call $uc_insn_at (call $uc_succ (local.get $R) (i32.const 0))))
        (if (i32.ge_s (local.get $S) (i32.const 0))
          (then (br_if $kl (call $uc_flag (local.get $S) (i32.const 1)))))
        (i32.store offset=40 (local.get $R) (i32.and (i32.load offset=40 (local.get $R)) (i32.const -2)))
        (local.set $n (i32.sub (local.get $n) (i32.const 1)))
        (local.set $qt (i32.const 1))
        (br $kl)))
      (br $tl)))
    (if (i32.eqz (call $uc_flag (local.get $h) (i32.const 1))) (then (return (i32.const 4))))
    (if (i32.lt_u (local.get $n) (global.get $uc_trace_min)) (then (return (i32.const 4))))
    ;; Head first, then address order from the head on, then the rest.
    (local.set $j (i32.const 0))
    (block $d8 (loop $l8
      (br_if $d8 (i32.ge_u (local.get $j) (i32.const 2)))
      (local.set $k (i32.const 0))
      (block $d9 (loop $l9
        (br_if $d9 (i32.ge_u (local.get $k) (global.get $uc_ninsn)))
        (local.set $R (i32.load (i32.add (global.get $UC_SORT) (i32.shl (local.get $k) (i32.const 2)))))
        (if (i32.and (call $uc_flag (local.get $R) (i32.const 1))
                     (i32.eq (i32.ge_u (i32.load (local.get $R)) (local.get $head)) (i32.eqz (local.get $j))))
          (then
            (i32.store offset=48 (local.get $R) (local.get $pos))
            (i32.store (i32.add (global.get $UC_LOOP) (i32.shl (local.get $pos) (i32.const 2))) (local.get $R))
            (local.set $pos (i32.add (local.get $pos) (i32.const 1)))))
        (local.set $k (i32.add (local.get $k) (i32.const 1)))
        (br $l9)))
      (local.set $j (i32.add (local.get $j) (i32.const 1)))
      (br $l8)))
    (global.set $uc_nloop (local.get $pos))
    (global.set $uc_head (local.get $head))
    (global.set $uc_is_trace (i32.const 1))
    ;; Every straight-line cut lands mid-way through the threaded block that
    ;; runs on past it. Name each landing to the decoder as a block boundary
    ;; before it is ever entered (07d $uop_cut_note, section 21.6).
    (if (i32.and (i32.ne (global.get $uc_trace_cut) (i32.const 0))
                 (i32.ne (global.get $branch_clock) (i32.const 0)))
      (then
        (local.set $k (i32.const 0))
        (block $nd (loop $nl
          (br_if $nd (i32.ge_u (local.get $k) (global.get $uc_ninsn)))
          (local.set $R (i32.add (global.get $UC_INSN) (i32.shl (local.get $k) (i32.const 8))))
          (local.set $k (i32.add (local.get $k) (i32.const 1)))
          (br_if $nl (i32.eqz (call $uc_flag (local.get $R) (i32.const 1))))
          (br_if $nl (call $uc_is_branch (local.get $R)))
          (local.set $S (call $uc_insn_at (call $uc_succ (local.get $R) (i32.const 0))))
          (if (i32.ge_s (local.get $S) (i32.const 0))
            (then (br_if $nl (call $uc_flag (local.get $S) (i32.const 1)))))
          (call $uop_cut_note (call $uc_succ (local.get $R) (i32.const 0)))
          (if (global.get $uop_census)
            (then (call $uop_census_ev (i32.const 16) (local.get $head)
                    (call $uc_succ (local.get $R) (i32.const 0)) (i32.const 0) (i32.const 0))))
          (br $nl)))))
    (i32.const 0))

  (func $uc_depth_p (param $R i32) (result i32)
    (i32.add (global.get $UC_DEPTH)
             (i32.shr_u (i32.sub (local.get $R) (global.get $UC_INSN)) (i32.const 6))))

  ;; The x86 instructions a trace has retired, at the least, when it leaves
  ;; to eip (docs/uop-tier-design.md §21.1): a member's own depth when eip is
  ;; in the trace (a deopt stub re-runs that instruction threaded), else one
  ;; more than the shallowest member whose successor it is. 0 for a loop,
  ;; whose work is its trips, which the blocks count already.
  (func $uc_exit_work (param $eip i32) (result i32)
    (local $r i32) (local $k i32) (local $j i32) (local $R i32) (local $best i32) (local $d i32)
    (if (i32.eqz (global.get $uc_is_trace)) (then (return (i32.const 0))))
    (local.set $r (call $uc_in_loop (local.get $eip)))
    (if (local.get $r) (then (return (i32.load (call $uc_depth_p (local.get $r))))))
    (local.set $best (i32.const -1))
    (block $d1 (loop $l1
      (br_if $d1 (i32.ge_u (local.get $k) (global.get $uc_nloop)))
      (local.set $R (call $uc_loop_insn (local.get $k)))
      (local.set $j (i32.const 0))
      (block $d2 (loop $l2
        (br_if $d2 (i32.ge_u (local.get $j) (call $uc_nsucc (local.get $R))))
        (if (i32.eq (call $uc_succ (local.get $R) (local.get $j)) (local.get $eip))
          (then
            (local.set $d (i32.add (i32.load (call $uc_depth_p (local.get $R))) (i32.const 1)))
            (if (i32.lt_u (local.get $d) (local.get $best)) (then (local.set $best (local.get $d))))))
        (local.set $j (i32.add (local.get $j) (i32.const 1)))
        (br $l2)))
      (local.set $k (i32.add (local.get $k) (i32.const 1)))
      (br $l1)))
    (select (i32.const 0) (local.get $best) (i32.eq (local.get $best) (i32.const -1))))

  ;; ------------------------------------------------------------ blocks --
  ;; Block record (64 bytes, $UC_BLK + k*64): +0 start +4 first loop position
  ;; +8 count +12 npred +16 first pred slot in $UC_PRED (+20..+31 unused: the
  ;; successors are the last instruction's, which a jump table has up to 16 of)
  ;; +32 flags (1 entry, 2 cut) +36 tOut page +40 tOut n +44 tOut set
  ;; +48 pred fill cursor

  (func $uc_blk (param $k i32) (result i32)
    (i32.add (global.get $UC_BLK) (i32.shl (local.get $k) (i32.const 6))))
  (func $uc_loop_insn (param $pos i32) (result i32)
    (i32.load (i32.add (global.get $UC_LOOP) (i32.shl (local.get $pos) (i32.const 2)))))
  (func $uc_blk_last (param $B i32) (result i32)
    (call $uc_loop_insn (i32.sub (i32.add (i32.load offset=4 (local.get $B)) (i32.load offset=8 (local.get $B)))
                                 (i32.const 1))))
  (func $uc_pred (param $B i32) (param $j i32) (result i32)
    (i32.load (i32.add (global.get $UC_PRED)
                       (i32.shl (i32.add (i32.load offset=16 (local.get $B)) (local.get $j)) (i32.const 2)))))

  (func $uc_build_blocks
    (local $k i32) (local $R i32) (local $P i32) (local $B i32) (local $nb i32)
    (local $s i32) (local $j i32) (local $t i32) (local $off i32) (local $L i32)
    ;; leaders
    (call $uc_set_flag (call $uc_loop_insn (i32.const 0)) (i32.const 2))
    (local.set $k (i32.const 0))
    (block $d (loop $l
      (br_if $d (i32.ge_u (local.get $k) (global.get $uc_nloop)))
      (local.set $R (call $uc_loop_insn (local.get $k)))
      (if (call $uc_is_branch (local.get $R))
        (then
          (local.set $j (i32.const 0))
          (block $sd (loop $sl
            (br_if $sd (i32.ge_u (local.get $j) (call $uc_nsucc (local.get $R))))
            (local.set $t (call $uc_in_loop (call $uc_succ (local.get $R) (local.get $j))))
            (if (local.get $t) (then (call $uc_set_flag (local.get $t) (i32.const 2))))
            (local.set $j (i32.add (local.get $j) (i32.const 1)))
            (br $sl)))))
      (local.set $k (i32.add (local.get $k) (i32.const 1)))
      (br $l)))
    ;; blocks, in loop order
    (call $uc_hm_clear (global.get $UC_HM_BLK))
    (local.set $nb (i32.const 0))
    (local.set $k (i32.const 0))
    (block $d2 (loop $l2
      (br_if $d2 (i32.ge_u (local.get $k) (global.get $uc_nloop)))
      (local.set $R (call $uc_loop_insn (local.get $k)))
      (if (i32.or (i32.or (i32.eqz (local.get $k)) (call $uc_flag (local.get $R) (i32.const 2)))
                  (i32.or (i32.ne (i32.load offset=4 (local.get $P)) (i32.load (local.get $R)))
                          (call $uc_is_branch (local.get $P))))
        (then
          (local.set $B (call $uc_blk (local.get $nb)))
          (memory.fill (local.get $B) (i32.const 0) (i32.const 64))
          (i32.store (local.get $B) (i32.load (local.get $R)))
          (i32.store offset=4 (local.get $B) (local.get $k))
          (call $uc_hm_put (global.get $UC_HM_BLK) (i64.extend_i32_u (i32.load (local.get $R))) (local.get $nb))
          (local.set $nb (i32.add (local.get $nb) (i32.const 1)))))
      (i32.store offset=8 (local.get $B) (i32.add (i32.load offset=8 (local.get $B)) (i32.const 1)))
      (i32.store offset=44 (local.get $R) (i32.sub (local.get $nb) (i32.const 1)))
      (local.set $P (local.get $R))
      (local.set $k (i32.add (local.get $k) (i32.const 1)))
      (br $l2)))
    (global.set $uc_nblk (local.get $nb))
    ;; successors, and pred counts
    (local.set $k (i32.const 0))
    (block $d3 (loop $l3
      (br_if $d3 (i32.ge_u (local.get $k) (local.get $nb)))
      (local.set $B (call $uc_blk (local.get $k)))
      (local.set $L (call $uc_blk_last (local.get $B)))
      (local.set $j (i32.const 0))
      (block $d4 (loop $l4
        (br_if $d4 (i32.ge_u (local.get $j) (call $uc_nsucc (local.get $L))))
        (local.set $s (call $uc_hm_get (global.get $UC_HM_BLK)
                        (i64.extend_i32_u (call $uc_succ (local.get $L) (local.get $j)))))
        (if (i32.ge_s (local.get $s) (i32.const 0))
          (then
            (local.set $t (call $uc_blk (local.get $s)))
            (i32.store offset=12 (local.get $t) (i32.add (i32.load offset=12 (local.get $t)) (i32.const 1)))))
        (local.set $j (i32.add (local.get $j) (i32.const 1)))
        (br $l4)))
      (local.set $k (i32.add (local.get $k) (i32.const 1)))
      (br $l3)))
    ;; pred slots, each block's in (predecessor, successor) order
    (local.set $off (i32.const 0))
    (local.set $k (i32.const 0))
    (block $d5 (loop $l5
      (br_if $d5 (i32.ge_u (local.get $k) (local.get $nb)))
      (local.set $B (call $uc_blk (local.get $k)))
      (i32.store offset=16 (local.get $B) (local.get $off))
      (i32.store offset=48 (local.get $B) (local.get $off))
      (local.set $off (i32.add (local.get $off) (i32.load offset=12 (local.get $B))))
      (local.set $k (i32.add (local.get $k) (i32.const 1)))
      (br $l5)))
    (local.set $k (i32.const 0))
    (block $d6 (loop $l6
      (br_if $d6 (i32.ge_u (local.get $k) (local.get $nb)))
      (local.set $B (call $uc_blk (local.get $k)))
      (local.set $L (call $uc_blk_last (local.get $B)))
      (local.set $j (i32.const 0))
      (block $d7 (loop $l7
        (br_if $d7 (i32.ge_u (local.get $j) (call $uc_nsucc (local.get $L))))
        (local.set $s (call $uc_hm_get (global.get $UC_HM_BLK)
                        (i64.extend_i32_u (call $uc_succ (local.get $L) (local.get $j)))))
        (if (i32.ge_s (local.get $s) (i32.const 0))
          (then
            (local.set $t (call $uc_blk (local.get $s)))
            (i32.store (i32.add (global.get $UC_PRED) (i32.shl (i32.load offset=48 (local.get $t)) (i32.const 2)))
                       (local.get $k))
            (i32.store offset=48 (local.get $t) (i32.add (i32.load offset=48 (local.get $t)) (i32.const 1)))))
        (local.set $j (i32.add (local.get $j) (i32.const 1)))
        (br $l7)))
      (local.set $k (i32.add (local.get $k) (i32.const 1)))
      (br $l6))))

  ;; ---- threaded block ends that are not branches ----
  ;; $decode_block also ends a block at a page seam (an instruction on a
  ;; different page from the block's first) and after 256 instructions, and
  ;; each such end costs a block. Where a threaded block starts depends on the
  ;; path: a charged transfer starts one at its target, straight-line flow
  ;; continues the current one. A merge whose paths disagree on the page
  ;; would need a seam on one path only; decline those.
  ;; A block is also an ENTRY -- a threaded block starts there -- when any
  ;; path reaches it by a branch: once threaded code has decoded a block there,
  ;; the decoder ends every block that runs into it ($fuse_stop), and that
  ;; fall-through costs a block too. A cut is an entry some path falls into;
  ;; the program charges it at the predecessor's end. Under --branch-clock a
  ;; cut costs nothing, so neither seams nor cuts are charged.
  (func $uc_block_ends (result i32)
    (local $k i32) (local $j i32) (local $B i32) (local $P i32) (local $L i32)
    (local $nb i32) (local $entry i32) (local $fall i32) (local $pass i32)
    (local $changed i32) (local $cnt i32) (local $page0 i32) (local $maxn i32)
    (local $bad i32) (local $pg i32) (local $tn i32) (local $tp i32) (local $q i32) (local $R i32)
    (local.set $nb (global.get $uc_nblk))
    (local.set $k (i32.const 0))
    (block $d (loop $l
      (br_if $d (i32.ge_u (local.get $k) (local.get $nb)))
      (local.set $B (call $uc_blk (local.get $k)))
      (local.set $entry (i32.eqz (local.get $k)))
      (local.set $fall (i32.const 0))
      (local.set $j (i32.const 0))
      (block $d2 (loop $l2
        (br_if $d2 (i32.ge_u (local.get $j) (i32.load offset=12 (local.get $B))))
        (if (call $uc_is_branch (call $uc_blk_last (call $uc_blk (call $uc_pred (local.get $B) (local.get $j)))))
          (then (local.set $entry (i32.const 1)))
          (else (local.set $fall (i32.const 1))))
        (local.set $j (i32.add (local.get $j) (i32.const 1)))
        (br $l2)))
      (i32.store offset=32 (local.get $B)
        (i32.or (local.get $entry)
                (i32.shl (i32.and (i32.and (local.get $entry) (local.get $fall))
                                  (i32.eqz (global.get $branch_clock)))
                         (i32.const 1))))
      (if (i32.and (i32.and (local.get $entry) (local.get $fall)) (i32.eqz (global.get $branch_clock)))
        (then (call $uc_set_flag (call $uc_loop_insn (i32.load offset=4 (local.get $B))) (i32.const 16))))
      (local.set $k (i32.add (local.get $k) (i32.const 1)))
      (br $l)))
    (if (global.get $branch_clock) (then (return (i32.const 0))))
    (block $pd (loop $pl
      (br_if $pd (i32.ge_u (local.get $pass) (i32.const 20)))
      (local.set $changed (i32.const 0))
      (local.set $k (i32.const 0))
      (block $d3 (loop $l3
        (br_if $d3 (i32.ge_u (local.get $k) (local.get $nb)))
        (local.set $B (call $uc_blk (local.get $k)))
        (local.set $cnt (i32.const 0))
        (local.set $bad (i32.const 0))
        (local.set $maxn (i32.const 0))
        (local.set $entry (i32.and (i32.load offset=32 (local.get $B)) (i32.const 1)))
        (if (local.get $entry)
          (then (local.set $cnt (i32.const 1))
                (local.set $page0 (i32.shr_u (i32.load (local.get $B)) (i32.const 12)))))
        (if (i32.eqz (local.get $entry))
          (then
            (local.set $j (i32.const 0))
            (block $d4 (loop $l4
              (br_if $d4 (i32.ge_u (local.get $j) (i32.load offset=12 (local.get $B))))
              (local.set $P (call $uc_blk (call $uc_pred (local.get $B) (local.get $j))))
              (local.set $pg (i32.const -1))
              (if (call $uc_is_branch (call $uc_blk_last (local.get $P)))
                (then (local.set $pg (i32.shr_u (i32.load (local.get $B)) (i32.const 12)))
                      (local.set $tn (i32.const 0)))
                (else
                  (if (i32.load offset=44 (local.get $P))
                    (then (local.set $pg (i32.load offset=36 (local.get $P)))
                          (local.set $tn (i32.load offset=40 (local.get $P)))))))
              (if (i32.ne (local.get $pg) (i32.const -1))
                (then
                  (if (i32.eqz (local.get $cnt))
                    (then (local.set $page0 (local.get $pg)))
                    (else (if (i32.ne (local.get $pg) (local.get $page0)) (then (local.set $bad (i32.const 1))))))
                  (if (i32.gt_s (local.get $tn) (local.get $maxn)) (then (local.set $maxn (local.get $tn))))
                  (local.set $cnt (i32.add (local.get $cnt) (i32.const 1)))))
              (local.set $j (i32.add (local.get $j) (i32.const 1)))
              (br $l4)))))
        (if (local.get $cnt)
          (then
            (if (local.get $bad) (then (return (i32.const 6))))
            (local.set $tp (local.get $page0))
            (local.set $tn (local.get $maxn))
            (local.set $q (i32.const 0))
            (block $d5 (loop $l5
              (br_if $d5 (i32.ge_u (local.get $q) (i32.load offset=8 (local.get $B))))
              (local.set $R (call $uc_loop_insn (i32.add (i32.load offset=4 (local.get $B)) (local.get $q))))
              (if (i32.ne (i32.shr_u (i32.load (local.get $R)) (i32.const 12)) (local.get $tp))
                (then (call $uc_set_flag (local.get $R) (i32.const 4))
                      (local.set $tp (i32.shr_u (i32.load (local.get $R)) (i32.const 12)))
                      (local.set $tn (i32.const 0))))
              (local.set $tn (i32.add (local.get $tn) (i32.const 1)))
              (if (i32.gt_s (local.get $tn) (i32.const 200)) (then (return (i32.const 7))))
              (local.set $q (i32.add (local.get $q) (i32.const 1)))
              (br $l5)))
            (if (i32.or (i32.eqz (i32.load offset=44 (local.get $B)))
                        (i32.or (i32.ne (i32.load offset=36 (local.get $B)) (local.get $tp))
                                (i32.ne (i32.load offset=40 (local.get $B)) (local.get $tn))))
              (then
                (i32.store offset=36 (local.get $B) (local.get $tp))
                (i32.store offset=40 (local.get $B) (local.get $tn))
                (i32.store offset=44 (local.get $B) (i32.const 1))
                (local.set $changed (i32.const 1))))))
        (local.set $k (i32.add (local.get $k) (i32.const 1)))
        (br $l3)))
      (br_if $pd (i32.eqz (local.get $changed)))
      (local.set $pass (i32.add (local.get $pass) (i32.const 1)))
      (br $pl)))
    (i32.const 0))

  ;; Are the flags live after R? (Any exit counts; see $uc_liveness.)
  (func $uc_live_out (param $R i32) (result i32)
    (local $j i32) (local $S i32)
    (block $d (loop $l
      (br_if $d (i32.ge_u (local.get $j) (call $uc_nsucc (local.get $R))))
      (local.set $S (call $uc_in_loop (call $uc_succ (local.get $R) (local.get $j))))
      (if (i32.eqz (local.get $S)) (then (return (i32.const 1))))
      (if (call $uc_flag (local.get $S) (i32.const 8)) (then (return (i32.const 1))))
      (local.set $j (i32.add (local.get $j) (i32.const 1)))
      (br $l)))
    (i32.const 0))

  ;; Does R (flag class 3) skip writing its flag record? Shift-by-CL (18)
  ;; and mul (25) drop the record when no consumer reads the flags after
  ;; them (their lowerings test the same $uc_live_out). $uc_step then marks
  ;; the state D, not G, so a consumer the liveness pass missed declines
  ;; instead of reading an older record out of the globals. adc/sbb (20)
  ;; always writes its record (docs/uop-tier-design.md §15.2).
  (func $uc_rec_skip (param $R i32) (result i32)
    (local $k i32)
    (local.set $k (call $uc_kind (local.get $R)))
    (if (i32.eqz (i32.or (i32.eq (local.get $k) (i32.const 18)) (i32.eq (local.get $k) (i32.const 25))))
      (then (return (i32.const 0))))
    (i32.eqz (call $uc_live_out (local.get $R))))

  ;; ---- flag liveness (per instruction, backward) ----
  ;; Consumers: a Jcc; anything that can exit (a memory access that may
  ;; deopt, a budget check before a charged transfer, seam or cut).
  (func $uc_liveness
    (local $changed i32) (local $k i32) (local $R i32) (local $j i32) (local $S i32)
    (local $out i32) (local $li i32)
    (local.set $changed (i32.const 1))
    (block $d (loop $l
      (br_if $d (i32.eqz (local.get $changed)))
      (local.set $changed (i32.const 0))
      (local.set $k (global.get $uc_nloop))
      (block $d2 (loop $l2
        (br_if $d2 (i32.eqz (local.get $k)))
        (local.set $k (i32.sub (local.get $k) (i32.const 1)))
        (local.set $R (call $uc_loop_insn (local.get $k)))
        (local.set $out (i32.const 0))
        (local.set $j (i32.const 0))
        (block $d3 (loop $l3
          (br_if $d3 (i32.ge_u (local.get $j) (call $uc_nsucc (local.get $R))))
          (local.set $S (call $uc_in_loop (call $uc_succ (local.get $R) (local.get $j))))
          (if (local.get $S)
            (then (if (call $uc_flag (local.get $S) (i32.const 8)) (then (local.set $out (i32.const 1)))))
            (else (local.set $out (i32.const 1))))
          (local.set $j (i32.add (local.get $j) (i32.const 1)))
          (br $l3)))
        (local.set $li
          (i32.or (i32.or (call $uc_is_branch (local.get $R)) (call $uc_touches_mem (local.get $R)))
                  (i32.or (i32.or (call $uc_flag (local.get $R) (i32.const 4)) (call $uc_flag (local.get $R) (i32.const 16)))
                          (i32.and (i32.ne (local.get $out) (i32.const 0))
                                   (i32.ne (call $uc_flag_class (local.get $R)) (i32.const 2))))))
        (if (i32.ne (local.get $li) (call $uc_flag (local.get $R) (i32.const 8)))
          (then
            (i32.store offset=40 (local.get $R) (i32.xor (i32.load offset=40 (local.get $R)) (i32.const 8)))
            (local.set $changed (i32.const 1))))
        (br $l2)))
      (br $l))))

  ;; ---- flag source dataflow with merge materialization ----
  ;; Flow slot F (0xA000 bytes): +0 in states (24 bytes per block: m md c cd
  ;; conflict set) +0x2800 out states (24: m md c cd - set) +0x5000 record at
  ;; end (4 per block) +0x5800 state entering each loop position (16)
  ;; +0x7800 the head's latch out states (16 each), count at +0x9FFC.
  ;; `hin` are the states entering the head from outside this copy of the
  ;; loop; `back` says whether this copy's own latches reach it.

  (func $uc_flow_slot (param $i i32) (result i32)
    (i32.add (global.get $UC_FLOW) (i32.mul (local.get $i) (i32.const 0xA000))))

  (func $uc_flow (param $F i32) (param $hin i32) (param $nhin i32) (param $back i32) (result i32)
    (local $iter i32) (local $pass i32) (local $changed i32) (local $grew i32)
    (local $k i32) (local $j i32) (local $B i32) (local $cnt i32) (local $same i32)
    (local $m0 i32) (local $c0 i32) (local $md i32) (local $cd i32) (local $own i32)
    (local $I i32) (local $O i32) (local $q i32) (local $st i32) (local $conf i32) (local $nb i32)
    (local $p i32) (local $n i32)
    (local.set $nb (global.get $uc_nblk))
    (memory.fill (i32.add (local.get $F) (i32.const 0x5000)) (i32.const 0) (i32.shl (local.get $nb) (i32.const 2)))
    (block $id (loop $il
      (br_if $id (i32.ge_u (local.get $iter) (i32.const 20)))
      (local.set $k (i32.const 0))
      (block $cd (loop $cl
        (br_if $cd (i32.ge_u (local.get $k) (local.get $nb)))
        (i32.store offset=20 (i32.add (local.get $F) (i32.mul (local.get $k) (i32.const 24))) (i32.const 0))
        (i32.store offset=20 (i32.add (i32.add (local.get $F) (i32.const 0x2800)) (i32.mul (local.get $k) (i32.const 24)))
                   (i32.const 0))
        (local.set $k (i32.add (local.get $k) (i32.const 1)))
        (br $cl)))
      (local.set $pass (i32.const 0))
      (block $pd (loop $pl
        (br_if $pd (i32.ge_u (local.get $pass) (i32.const 50)))
        (local.set $changed (i32.const 0))
        (local.set $k (i32.const 0))
        (block $bd (loop $bl
          (br_if $bd (i32.ge_u (local.get $k) (local.get $nb)))
          (local.set $B (call $uc_blk (local.get $k)))
          (local.set $cnt (i32.const 0))
          (local.set $same (i32.const 1))
          (local.set $md (i32.const 0))
          (local.set $cd (i32.const 0))
          (local.set $own (i32.or (i32.ne (local.get $k) (i32.const 0)) (local.get $back)))
          (if (local.get $own)
            (then
              (local.set $j (i32.const 0))
              (block $qd (loop $ql
                (br_if $qd (i32.ge_u (local.get $j) (i32.load offset=12 (local.get $B))))
                (local.set $O (i32.add (i32.add (local.get $F) (i32.const 0x2800))
                                       (i32.mul (call $uc_pred (local.get $B) (local.get $j)) (i32.const 24))))
                (if (i32.load offset=20 (local.get $O))
                  (then
                    (if (i32.eqz (local.get $cnt))
                      (then (local.set $m0 (i32.load (local.get $O))) (local.set $c0 (i32.load offset=8 (local.get $O))))
                      (else (if (i32.or (i32.ne (i32.load (local.get $O)) (local.get $m0))
                                        (i32.ne (i32.load offset=8 (local.get $O)) (local.get $c0)))
                              (then (local.set $same (i32.const 0))))))
                    (local.set $md (i32.or (local.get $md) (i32.load offset=4 (local.get $O))))
                    (local.set $cd (i32.or (local.get $cd) (i32.load offset=12 (local.get $O))))
                    (local.set $cnt (i32.add (local.get $cnt) (i32.const 1)))))
                (local.set $j (i32.add (local.get $j) (i32.const 1)))
                (br $ql)))))
          (if (i32.eqz (local.get $k))
            (then
              (local.set $j (i32.const 0))
              (block $hd (loop $hl
                (br_if $hd (i32.ge_u (local.get $j) (local.get $nhin)))
                (local.set $O (i32.add (local.get $hin) (i32.shl (local.get $j) (i32.const 4))))
                (if (i32.eqz (local.get $cnt))
                  (then (local.set $m0 (i32.load (local.get $O))) (local.set $c0 (i32.load offset=8 (local.get $O))))
                  (else (if (i32.or (i32.ne (i32.load (local.get $O)) (local.get $m0))
                                    (i32.ne (i32.load offset=8 (local.get $O)) (local.get $c0)))
                          (then (local.set $same (i32.const 0))))))
                (local.set $md (i32.or (local.get $md) (i32.load offset=4 (local.get $O))))
                (local.set $cd (i32.or (local.get $cd) (i32.load offset=12 (local.get $O))))
                (local.set $cnt (i32.add (local.get $cnt) (i32.const 1)))
                (local.set $j (i32.add (local.get $j) (i32.const 1)))
                (br $hl)))))
          (if (local.get $cnt)
            (then
              (local.set $conf (i32.const 0))
              (if (local.get $same)
                (then (global.set $uc_sm (local.get $m0)) (global.set $uc_smd (local.get $md))
                      (global.set $uc_sc (local.get $c0)) (global.set $uc_scd (local.get $cd)))
                (else
                  (global.set $uc_smd (i32.const 0)) (global.set $uc_scd (i32.const 0))
                  (if (call $uc_flag (call $uc_loop_insn (i32.load offset=4 (local.get $B))) (i32.const 8))
                    (then (global.set $uc_sm (global.get $UC_G)) (global.set $uc_sc (global.get $UC_G))
                          (local.set $conf (i32.const 1)))
                    (else (global.set $uc_sm (global.get $UC_D)) (global.set $uc_sc (global.get $UC_D))))))
              (local.set $I (i32.add (local.get $F) (i32.mul (local.get $k) (i32.const 24))))
              (if (i32.or (i32.or (i32.eqz (i32.load offset=20 (local.get $I)))
                                  (i32.ne (i32.load offset=16 (local.get $I)) (local.get $conf)))
                          (i32.or (i32.or (i32.ne (i32.load (local.get $I)) (global.get $uc_sm))
                                          (i32.ne (i32.load offset=4 (local.get $I)) (global.get $uc_smd)))
                                  (i32.or (i32.ne (i32.load offset=8 (local.get $I)) (global.get $uc_sc))
                                          (i32.ne (i32.load offset=12 (local.get $I)) (global.get $uc_scd)))))
                (then
                  (call $uc_state_store (local.get $I))
                  (i32.store offset=16 (local.get $I) (local.get $conf))
                  (i32.store offset=20 (local.get $I) (i32.const 1))
                  (local.set $changed (i32.const 1))))
              (local.set $q (i32.const 0))
              (block $sd (loop $sl
                (br_if $sd (i32.ge_u (local.get $q) (i32.load offset=8 (local.get $B))))
                (call $uc_step (call $uc_loop_insn (i32.add (i32.load offset=4 (local.get $B)) (local.get $q))))
                (local.set $q (i32.add (local.get $q) (i32.const 1)))
                (br $sl)))
              (if (i32.load (i32.add (i32.add (local.get $F) (i32.const 0x5000)) (i32.shl (local.get $k) (i32.const 2))))
                (then (call $uc_state_load (global.get $UC_MISC))))
              (local.set $O (i32.add (i32.add (local.get $F) (i32.const 0x2800)) (i32.mul (local.get $k) (i32.const 24))))
              (if (i32.or (i32.eqz (i32.load offset=20 (local.get $O)))
                          (i32.or (i32.or (i32.ne (i32.load (local.get $O)) (global.get $uc_sm))
                                          (i32.ne (i32.load offset=4 (local.get $O)) (global.get $uc_smd)))
                                  (i32.or (i32.ne (i32.load offset=8 (local.get $O)) (global.get $uc_sc))
                                          (i32.ne (i32.load offset=12 (local.get $O)) (global.get $uc_scd)))))
                (then
                  (call $uc_state_store (local.get $O))
                  (i32.store offset=20 (local.get $O) (i32.const 1))
                  (local.set $changed (i32.const 1))))))
          (local.set $k (i32.add (local.get $k) (i32.const 1)))
          (br $bl)))
        (br_if $pd (i32.eqz (local.get $changed)))
        (local.set $pass (i32.add (local.get $pass) (i32.const 1)))
        (br $pl)))
      ;; A live merge whose inputs disagree becomes 'G': every predecessor in
      ;; this copy that does not already leave the globals current records
      ;; its flags at its end.
      (local.set $grew (i32.const 0))
      (local.set $k (i32.const 0))
      (block $gd (loop $gl
        (br_if $gd (i32.ge_u (local.get $k) (local.get $nb)))
        (local.set $I (i32.add (local.get $F) (i32.mul (local.get $k) (i32.const 24))))
        (if (i32.and (i32.ne (i32.load offset=20 (local.get $I)) (i32.const 0))
                     (i32.and (i32.ne (i32.load offset=16 (local.get $I)) (i32.const 0))
                              (i32.or (i32.ne (local.get $k) (i32.const 0)) (local.get $back))))
          (then
            (local.set $B (call $uc_blk (local.get $k)))
            (local.set $j (i32.const 0))
            (block $rd (loop $rl
              (br_if $rd (i32.ge_u (local.get $j) (i32.load offset=12 (local.get $B))))
              (local.set $p (call $uc_pred (local.get $B) (local.get $j)))
              (local.set $O (i32.add (i32.add (local.get $F) (i32.const 0x2800)) (i32.mul (local.get $p) (i32.const 24))))
              (local.set $q (i32.add (i32.add (local.get $F) (i32.const 0x5000)) (i32.shl (local.get $p) (i32.const 2))))
              (if (i32.and (i32.and (i32.ne (i32.load offset=20 (local.get $O)) (i32.const 0))
                                    (i32.ne (i32.load (local.get $O)) (global.get $UC_G)))
                           (i32.eqz (i32.load (local.get $q))))
                (then (i32.store (local.get $q) (i32.const 1)) (local.set $grew (i32.const 1))))
              (local.set $j (i32.add (local.get $j) (i32.const 1)))
              (br $rl)))))
        (local.set $k (i32.add (local.get $k) (i32.const 1)))
        (br $gl)))
      (br_if $id (i32.eqz (local.get $grew)))
      (local.set $iter (i32.add (local.get $iter) (i32.const 1)))
      (br $il)))
    ;; the state entering each instruction
    (local.set $k (i32.const 0))
    (block $ed (loop $el
      (br_if $ed (i32.ge_u (local.get $k) (local.get $nb)))
      (local.set $B (call $uc_blk (local.get $k)))
      (local.set $I (i32.add (local.get $F) (i32.mul (local.get $k) (i32.const 24))))
      (if (i32.eqz (i32.load offset=20 (local.get $I))) (then (return (i32.const 0))))
      (call $uc_state_load (local.get $I))
      (local.set $q (i32.const 0))
      (block $sd2 (loop $sl2
        (br_if $sd2 (i32.ge_u (local.get $q) (i32.load offset=8 (local.get $B))))
        (local.set $n (i32.add (i32.load offset=4 (local.get $B)) (local.get $q)))
        (call $uc_state_store (i32.add (i32.add (local.get $F) (i32.const 0x5800)) (i32.shl (local.get $n) (i32.const 4))))
        (call $uc_step (call $uc_loop_insn (local.get $n)))
        (local.set $q (i32.add (local.get $q) (i32.const 1)))
        (br $sl2)))
      (local.set $k (i32.add (local.get $k) (i32.const 1)))
      (br $el)))
    ;; the head's latch out states
    (local.set $B (call $uc_blk (i32.const 0)))
    (local.set $n (i32.const 0))
    (local.set $j (i32.const 0))
    (block $ld (loop $ll
      (br_if $ld (i32.ge_u (local.get $j) (i32.load offset=12 (local.get $B))))
      (local.set $O (i32.add (i32.add (local.get $F) (i32.const 0x2800))
                             (i32.mul (call $uc_pred (local.get $B) (local.get $j)) (i32.const 24))))
      (if (i32.load offset=20 (local.get $O))
        (then
          (memory.copy (i32.add (i32.add (local.get $F) (i32.const 0x7800)) (i32.shl (local.get $n) (i32.const 4)))
                       (local.get $O) (i32.const 16))
          (local.set $n (i32.add (local.get $n) (i32.const 1)))))
      (local.set $j (i32.add (local.get $j) (i32.const 1)))
      (br $ll)))
    (i32.store (i32.add (local.get $F) (i32.const 0x9FFC)) (local.get $n))
    (i32.const 1))

  ;; Does any predecessor of the head record its flags at its end in slot F?
  (func $uc_head_pred_rec (param $F i32) (result i32)
    (local $B i32) (local $j i32)
    (local.set $B (call $uc_blk (i32.const 0)))
    (block $d (loop $l
      (br_if $d (i32.ge_u (local.get $j) (i32.load offset=12 (local.get $B))))
      (if (i32.load (i32.add (i32.add (local.get $F) (i32.const 0x5000))
                             (i32.shl (call $uc_pred (local.get $B) (local.get $j)) (i32.const 2))))
        (then (return (i32.const 1))))
      (local.set $j (i32.add (local.get $j) (i32.const 1)))
      (br $l)))
    (i32.const 0))

  ;; -------------------------------------------------------- the emitter --
  ;; Ops stay symbolic until encoding. An argument is an i64: bits 56-59 its
  ;; type (1 number, 2 guest register, 3 temp, 4 pooled constant, 5 code
  ;; label, 6 window slot), bits 32-39 a temp tag or label kind, bits 0-31 the
  ;; value. Label kinds: 1 block of the peeled copy, 2 block of the steady
  ;; copy, 3/4 their seams, 5 stub, 6 a stub's taken arm, 7 a forward label
  ;; inside one instruction ($uc_nlocal).
  ;; Item stream: [code, nargs, args (8 bytes each)]; a label is code -1 with
  ;; its key as the one argument.

  (func $uc_aN (param $v i32) (result i64)
    (i64.or (i64.const 0x0100000000000000) (i64.extend_i32_u (local.get $v))))
  (func $uc_aR (param $r i32) (result i64)
    (i64.or (i64.const 0x0200000000000000) (i64.extend_i32_u (local.get $r))))
  (func $uc_aT (param $tag i32) (param $v i32) (result i64)
    (i64.or (i64.or (i64.const 0x0300000000000000) (i64.shl (i64.extend_i32_u (local.get $tag)) (i64.const 32)))
            (i64.extend_i32_u (local.get $v))))
  (func $uc_aC (param $v i32) (result i64)
    (i64.or (i64.const 0x0400000000000000) (i64.extend_i32_u (local.get $v))))
  (func $uc_aL (param $kind i32) (param $v i32) (result i64)
    (i64.or (i64.or (i64.const 0x0500000000000000) (i64.shl (i64.extend_i32_u (local.get $kind)) (i64.const 32)))
            (i64.extend_i32_u (local.get $v))))
  (func $uc_aW (param $v i32) (result i64)
    (i64.or (i64.const 0x0600000000000000) (i64.extend_i32_u (local.get $v))))
  ;; aM: an MMX cell of $MMX_FILE (0-7 MMn, 8 the staging cell).
  (func $uc_aM (param $v i32) (result i64)
    (i64.or (i64.const 0x0700000000000000) (i64.extend_i32_u (local.get $v))))
  (func $uc_atype (param $a i64) (result i32)
    (i32.wrap_i64 (i64.shr_u (local.get $a) (i64.const 56))))

  (func $uc_emit (param $code i32) (param $n i32)
      (param $a1 i64) (param $a2 i64) (param $a3 i64) (param $a4 i64)
      (param $a5 i64) (param $a6 i64) (param $a7 i64)
    (local $p i32)
    (if (i32.gt_u (i32.add (global.get $uc_nitems) (i32.add (i32.const 8) (i32.shl (local.get $n) (i32.const 3))))
                  (global.get $UC_ITEMS_BYTES))
      (then (call $uc_fail (i32.const 26)) (return)))
    (local.set $p (i32.add (global.get $UC_ITEMS) (global.get $uc_nitems)))
    (i32.store (local.get $p) (local.get $code))
    (i32.store offset=4 (local.get $p) (local.get $n))
    (i64.store offset=8 (local.get $p) (local.get $a1))
    (i64.store offset=16 (local.get $p) (local.get $a2))
    (i64.store offset=24 (local.get $p) (local.get $a3))
    (i64.store offset=32 (local.get $p) (local.get $a4))
    (i64.store offset=40 (local.get $p) (local.get $a5))
    (i64.store offset=48 (local.get $p) (local.get $a6))
    (i64.store offset=56 (local.get $p) (local.get $a7))
    (global.set $uc_nitems (i32.add (global.get $uc_nitems) (i32.add (i32.const 8) (i32.shl (local.get $n) (i32.const 3)))))
    (if (i32.ge_s (local.get $code) (i32.const 0))
      (then (global.set $uc_nops (i32.add (global.get $uc_nops) (i32.const 1))))))

  (func $uc_label (param $l i64)
    (call $uc_emit (i32.const -1) (i32.const 1) (local.get $l) (i64.const 0) (i64.const 0)
                   (i64.const 0) (i64.const 0) (i64.const 0) (i64.const 0)))
  (func $uc_o1 (param $c i32) (param $a i64)
    (call $uc_emit (local.get $c) (i32.const 1) (local.get $a) (i64.const 0) (i64.const 0)
                   (i64.const 0) (i64.const 0) (i64.const 0) (i64.const 0)))
  (func $uc_o2 (param $c i32) (param $a i64) (param $b i64)
    (call $uc_emit (local.get $c) (i32.const 2) (local.get $a) (local.get $b) (i64.const 0)
                   (i64.const 0) (i64.const 0) (i64.const 0) (i64.const 0)))
  (func $uc_o3 (param $c i32) (param $a i64) (param $b i64) (param $d i64)
    (call $uc_emit (local.get $c) (i32.const 3) (local.get $a) (local.get $b) (local.get $d)
                   (i64.const 0) (i64.const 0) (i64.const 0) (i64.const 0)))
  (func $uc_o5 (param $c i32) (param $a i64) (param $b i64) (param $d i64) (param $e i64) (param $f i64)
    (call $uc_emit (local.get $c) (i32.const 5) (local.get $a) (local.get $b) (local.get $d)
                   (local.get $e) (local.get $f) (i64.const 0) (i64.const 0)))

  (func $uc_scratch (result i64)
    (global.set $uc_nscr (i32.add (global.get $uc_nscr) (i32.const 1)))
    (call $uc_aT (i32.const 13) (i32.sub (global.get $uc_nscr) (i32.const 1))))

  (func $uc_win (param $o i32) (param $store i32) (result i64)
    (local $k i64) (local $id i32)
    (local.set $k
      (i64.or (i64.extend_i32_u (i32.shr_s (i32.load offset=16 (local.get $o)) (i32.const 12)))
              (i64.shl (i64.extend_i32_u
                         (i32.or (i32.or (i32.add (i32.load offset=4 (local.get $o)) (i32.const 1))
                                         (i32.shl (i32.add (i32.load offset=8 (local.get $o)) (i32.const 1)) (i32.const 4)))
                                 (i32.or (i32.shl (i32.load offset=12 (local.get $o)) (i32.const 8))
                                         (i32.shl (local.get $store) (i32.const 10)))))
                       (i64.const 32))))
    (local.set $id (call $uc_hm_get (global.get $UC_HM_WIN) (local.get $k)))
    (if (i32.lt_s (local.get $id) (i32.const 0))
      (then (local.set $id (global.get $uc_nwin))
            (call $uc_hm_put (global.get $UC_HM_WIN) (local.get $k) (local.get $id))
            (global.set $uc_nwin (i32.add (global.get $uc_nwin) (i32.const 1)))))
    (call $uc_aW (local.get $id)))

  ;; ---- demand: the snapshots, CF values and overflow values some consumer
  ;; asked for; they persist across emission rounds. Key: kind<<40 | name<<32
  ;; | producer address (kind 1 snap with name 1 A 2 B 3 R, 2 cfv, 3 ofv).
  (func $uc_dkey (param $kind i32) (param $name i32) (param $a i32) (result i64)
    (i64.or (i64.or (i64.shl (i64.extend_i32_u (local.get $kind)) (i64.const 40))
                    (i64.shl (i64.extend_i32_u (local.get $name)) (i64.const 32)))
            (i64.extend_i32_u (local.get $a))))
  (func $uc_demand_add (param $kind i32) (param $name i32) (param $a i32)
    (call $uc_hm_put (global.get $UC_HM_DEM) (call $uc_dkey (local.get $kind) (local.get $name) (local.get $a)) (i32.const 1)))
  (func $uc_demand_has (param $kind i32) (param $name i32) (param $a i32) (result i32)
    (i32.ge_s (call $uc_hm_get (global.get $UC_HM_DEM) (call $uc_dkey (local.get $kind) (local.get $name) (local.get $a)))
              (i32.const 0)))

  ;; ---- values ----
  ;; valOf: a vreg holding ref's value at width w, zero- or sign-extended,
  ;; emitting whatever ops that takes.
  (func $uc_valof (param $r i32) (param $w i32) (param $sg i32) (result i64)
    (local $v i32) (local $src i64) (local $t i64)
    (if (i32.eq (i32.load (local.get $r)) (i32.const 2))
      (then
        (local.set $v (i32.load offset=4 (local.get $r)))
        (if (i32.eq (local.get $w) (i32.const 8))
          (then (local.set $v (select (call $imp_sx8 (local.get $v)) (i32.and (local.get $v) (i32.const 0xFF)) (local.get $sg)))))
        (if (i32.eq (local.get $w) (i32.const 16))
          (then (local.set $v (select (call $win16_short (local.get $v)) (i32.and (local.get $v) (i32.const 0xFFFF)) (local.get $sg)))))
        (return (call $uc_aC (local.get $v)))))
    (local.set $src
      (if (result i64) (i32.eqz (i32.load (local.get $r)))
        (then (call $uc_aR (i32.load offset=4 (local.get $r))))
        (else (call $uc_aT (i32.load offset=8 (local.get $r)) (i32.load offset=4 (local.get $r))))))
    (if (i32.and (i32.eqz (i32.load offset=12 (local.get $r))) (i32.eq (local.get $w) (i32.const 32)))
      (then (return (local.get $src))))
    (if (i32.eq (i32.load offset=12 (local.get $r)) (i32.const 3))
      (then (local.set $t (call $uc_scratch))
            (call $uc_o2 (i32.const 60) (local.get $t) (local.get $src))
            (local.set $src (local.get $t))))
    (if (i32.eq (local.get $w) (i32.const 32)) (then (return (local.get $src))))
    (if (i32.and (i32.eq (i32.load offset=16 (local.get $r)) (local.get $w)) (i32.eqz (local.get $sg)))
      (then (return (local.get $src))))
    (local.set $t (call $uc_scratch))
    (if (i32.eq (local.get $w) (i32.const 8))
      (then
        (if (local.get $sg)
          (then (call $uc_o2 (i32.const 47) (local.get $t) (local.get $src)))
          (else (call $uc_o3 (i32.const 9) (local.get $t) (local.get $src) (call $uc_aN (i32.const 0xFF))))))
      (else
        (if (local.get $sg)
          (then (call $uc_o2 (i32.const 48) (local.get $t) (local.get $src)))
          (else (call $uc_o3 (i32.const 9) (local.get $t) (local.get $src) (call $uc_aN (i32.const 0xFFFF)))))))
    (local.get $t))

  ;; rawOf: the raw 32-bit vreg an operand's low bits live in (no masking):
  ;; enough for add/sub/and/or/xor whose result is masked or merged after.
  (func $uc_rawof (param $r i32) (result i64)
    (local $src i64) (local $t i64)
    (if (i32.eq (i32.load (local.get $r)) (i32.const 2))
      (then (return (call $uc_aC (i32.load offset=4 (local.get $r))))))
    (local.set $src
      (if (result i64) (i32.eqz (i32.load (local.get $r)))
        (then (call $uc_aR (i32.load offset=4 (local.get $r))))
        (else (call $uc_aT (i32.load offset=8 (local.get $r)) (i32.load offset=4 (local.get $r))))))
    (if (i32.eq (i32.load offset=12 (local.get $r)) (i32.const 3))
      (then (local.set $t (call $uc_scratch))
            (call $uc_o2 (i32.const 60) (local.get $t) (local.get $src))
            (return (local.get $t))))
    (local.get $src))

  ;; ---- operands ----
  (func $uc_mbase (param $o i32) (result i64)
    (if (result i64) (i32.ge_s (i32.load offset=4 (local.get $o)) (i32.const 0))
      (then (call $uc_aR (i32.load offset=4 (local.get $o)))) (else (call $uc_aC (i32.const 0)))))
  (func $uc_midx (param $o i32) (result i64)
    (if (result i64) (i32.ge_s (i32.load offset=8 (local.get $o)) (i32.const 0))
      (then (call $uc_aR (i32.load offset=8 (local.get $o)))) (else (call $uc_aC (i32.const 0)))))

  (func $uc_load (param $o i32) (param $w i32) (param $sg i32) (param $dst i64)
    (local $code i32) (local $wa i64)
    (if (i32.eq (global.get $uc_fwd_kind) (i32.const 1))
      (then (if (i32.ne (local.get $w) (i32.const 32)) (then (call $uc_fail (i32.const 22)) (return)))
            (call $uc_o2 (i32.const 2) (local.get $dst) (call $uc_aT (i32.const 20) (global.get $uc_fwd_a)))
            (return)))
    (local.set $code
      (if (result i32) (i32.eq (local.get $w) (i32.const 32)) (then (i32.const 33))
        (else (if (result i32) (i32.eq (local.get $w) (i32.const 16))
                (then (select (i32.const 35) (i32.const 34) (local.get $sg)))
                (else (select (i32.const 37) (i32.const 36) (local.get $sg)))))))
    (local.set $wa (call $uc_win (local.get $o) (i32.const 0)))
    (call $uc_emit (local.get $code) (i32.const 7) (local.get $dst)
      (call $uc_mbase (local.get $o)) (call $uc_midx (local.get $o))
      (call $uc_aN (i32.load offset=12 (local.get $o))) (call $uc_aN (i32.load offset=16 (local.get $o)))
      (local.get $wa) (call $uc_xstub)))

  (func $uc_store (param $o i32) (param $w i32) (param $v i64)
    (local $code i32) (local $wa i64)
    (if (i32.eq (global.get $uc_fwd_kind) (i32.const 2))
      (then (if (i32.ne (local.get $w) (i32.const 32)) (then (call $uc_fail (i32.const 22)) (return)))
            (call $uc_o2 (i32.const 2) (call $uc_aT (i32.const 20) (global.get $uc_fwd_a)) (local.get $v))
            (return)))
    (local.set $code (select (i32.const 38) (select (i32.const 39) (i32.const 40) (i32.eq (local.get $w) (i32.const 16)))
                             (i32.eq (local.get $w) (i32.const 32))))
    (local.set $wa (call $uc_win (local.get $o) (i32.const 1)))
    (call $uc_emit (local.get $code) (i32.const 7) (local.get $v)
      (call $uc_mbase (local.get $o)) (call $uc_midx (local.get $o))
      (call $uc_aN (i32.load offset=12 (local.get $o))) (call $uc_aN (i32.load offset=16 (local.get $o)))
      (local.get $wa) (call $uc_xstub)))

  ;; Read an operand into a ref. Memory is loaded (zero-extended) into a temp
  ;; named after the instruction, so later consumers can find it.
  (func $uc_read (param $o i32) (param $R i32) (param $tag i32) (result i32)
    (if (i32.eq (i32.load (local.get $o)) (i32.const 3))
      (then (return (call $uc_ref_new (i32.const 2) (i32.load offset=16 (local.get $o)) (i32.const 0) (i32.const 0) (i32.const 0)))))
    (if (i32.eq (i32.load (local.get $o)) (i32.const 1))
      (then (return (call $uc_ref_new (i32.const 0) (i32.load offset=4 (local.get $o)) (i32.const 0)
                                      (i32.load offset=8 (local.get $o)) (i32.const 0)))))
    (call $uc_load (local.get $o) (i32.load offset=20 (local.get $o)) (i32.const 0)
                   (call $uc_aT (local.get $tag) (i32.load (local.get $R))))
    (call $uc_ref_new (i32.const 1) (i32.load (local.get $R)) (local.get $tag) (i32.const 0)
                      (i32.load offset=20 (local.get $o))))

  (func $uc_write_reg (param $o i32) (param $v i64)
    (local $r i64) (local $part i32)
    (local.set $r (call $uc_aR (i32.load offset=4 (local.get $o))))
    (local.set $part (i32.load offset=8 (local.get $o)))
    (if (i32.eqz (local.get $part))
      (then (if (i64.ne (local.get $v) (local.get $r))
              (then (call $uc_o2 (i32.const 2) (local.get $r) (local.get $v))))
            (return)))
    (call $uc_o3 (select (i32.const 20) (select (i32.const 50) (i32.const 49) (i32.eq (local.get $part) (i32.const 3)))
                         (i32.eq (local.get $part) (i32.const 2)))
                 (local.get $r) (local.get $r) (local.get $v)))

  (func $uc_write (param $o i32) (param $v i64)
    (if (i32.eq (i32.load (local.get $o)) (i32.const 1))
      (then (call $uc_write_reg (local.get $o) (local.get $v)))
      (else (call $uc_store (local.get $o) (i32.load offset=20 (local.get $o)) (local.get $v)))))

  (func $uc_ref_is_reg32 (param $o i32) (result i32)
    (i32.and (i32.eq (i32.load (local.get $o)) (i32.const 1)) (i32.eqz (i32.load offset=8 (local.get $o)))))

  ;; snapAfter: a later exit needs this operand of R after the loop has
  ;; overwritten its register, so keep a copy.
  (func $uc_snap_after (param $R i32) (param $name i32) (param $ref i32)
    (if (i32.and (call $uc_demand_has (i32.const 1) (local.get $name) (i32.load (local.get $R)))
                 (i32.eqz (i32.load (local.get $ref))))
      (then (call $uc_o2 (i32.const 2) (call $uc_aT (i32.add (i32.const 9) (local.get $name)) (i32.load (local.get $R)))
                     (call $uc_aR (i32.load offset=4 (local.get $ref)))))))

  ;; ---- instructions ----
  (func $uc_insn (param $R i32) (result i32)
    (local $k i32) (local $O0 i32) (local $O1 i32) (local $O2 i32) (local $a i32)
    (local $A i32) (local $B i32) (local $v i64) (local $t i64) (local $r32 i32)
    (local $src i64) (local $w i32) (local $op i32) (local $vx i64) (local $vy i64) (local $n i32)
    (local $vl1 i64) (local $vl2 i64)
    (local.set $k (call $uc_kind (local.get $R)))
    (local.set $a (i32.load (local.get $R)))
    (local.set $O0 (i32.add (local.get $R) (i32.const 56)))
    (local.set $O1 (i32.add (local.get $R) (i32.const 80)))
    (local.set $O2 (i32.add (local.get $R) (i32.const 104)))
    (if (i32.eq (local.get $k) (i32.const 7)) (then (return (i32.const 0))))
    (if (i32.eq (local.get $k) (i32.const 29))
      (then
        ;; Both accesses can deopt at the original instruction. Do not move
        ;; either pointer until the guarded store has completed successfully.
        (local.set $v (call $uc_scratch))
        (call $uc_load (local.get $O1) (i32.const 32) (i32.const 0) (local.get $v))
        (call $uc_store (local.get $O0) (i32.const 32) (local.get $v))
        (call $uc_o2 (i32.const 78) (call $uc_aR (i32.const 6)) (call $uc_aR (i32.const 7)))
        (return (i32.const 0))))
    ;; rep movs / rep stos: one COPY / FILL over EDI, ESI, ECX (07d 82/83).
    ;; The op leaves every register as the threaded rep does, and its deopt
    ;; stub is this instruction, taken before anything is written.
    (if (i32.eq (local.get $k) (i32.const 30))
      (then
        (if (global.get $uc_fwd_kind) (then (return (i32.const 22))))
        (local.set $w (i32.shr_u (i32.load offset=16 (local.get $R)) (i32.const 3)))
        (if (i32.load offset=12 (local.get $R))
          (then
            (call $uc_emit (i32.const 83) (i32.const 6)
              (call $uc_aR (i32.const 7)) (call $uc_aR (i32.const 0)) (call $uc_aR (i32.const 1))
              (call $uc_aN (local.get $w)) (call $uc_win (local.get $O0) (i32.const 1))
              (call $uc_xstub) (i64.const 0)))
          (else
            (call $uc_emit (i32.const 82) (i32.const 7)
              (call $uc_aR (i32.const 7)) (call $uc_aR (i32.const 6)) (call $uc_aR (i32.const 1))
              (call $uc_aN (local.get $w)) (call $uc_win (local.get $O0) (i32.const 1))
              (call $uc_win (local.get $O1) (i32.const 0)) (call $uc_xstub))))
        (return (i32.const 0))))
    ;; push: the store first, so a deopt re-executes the whole push
    (if (i32.eq (local.get $k) (i32.const 21))
      (then
        (local.set $v (if (result i64) (i32.eq (i32.load (local.get $O0)) (i32.const 3))
                        (then (call $uc_aC (i32.load offset=16 (local.get $O0))))
                        (else (call $uc_aR (i32.load offset=4 (local.get $O0))))))
        ;; elided (--aggressive-stack): the slot lives in temp (20, a)
        (if (i32.and (i32.load offset=252 (local.get $R)) (i32.const 1))
          (then (call $uc_o2 (i32.const 2) (call $uc_aT (i32.const 20) (local.get $a)) (local.get $v)))
          (else (call $uc_store (local.get $O1) (i32.const 32) (local.get $v))))
        (call $uc_o3 (i32.const 8) (call $uc_aR (i32.const 4)) (call $uc_aR (i32.const 4)) (call $uc_aN (i32.const -4)))
        (return (i32.const 0))))
    (if (i32.eq (local.get $k) (i32.const 22))
      (then
        (if (i32.and (i32.load offset=252 (local.get $R)) (i32.const 2))
          (then (call $uc_o2 (i32.const 2) (call $uc_aR (i32.load offset=4 (local.get $O0)))
                  (call $uc_aT (i32.const 20)
                    (i32.load (call $uc_loop_insn (i32.and (i32.load offset=248 (local.get $R)) (i32.const 0xFFFF)))))))
          (else
            (call $uc_load (local.get $O1) (i32.const 32) (i32.const 0) (call $uc_aR (i32.load offset=4 (local.get $O0))))))
        (call $uc_o3 (i32.const 8) (call $uc_aR (i32.const 4)) (call $uc_aR (i32.const 4)) (call $uc_aN (i32.const 4)))
        (return (i32.const 0))))
    ;; pushad: the eight stores first -- EAX ECX EDX EBX, ESP as it was,
    ;; EBP ESI EDI, from [esp-4] down -- then ESP -= 32, so a deopt at any
    ;; store re-executes the whole pushad over the same bytes (all below ESP).
    ;; popad: all seven loads into temps first (the ESP slot is skipped), and
    ;; only then the registers and ESP += 32, so a deopt at any load leaves
    ;; every register as it was. O1's disp is walked and put back: the
    ;; instruction is lowered once per copy.
    (if (i32.eq (local.get $k) (i32.const 31))
      (then
        (if (global.get $uc_fwd_kind) (then (return (i32.const 22))))
        (local.set $n (i32.load offset=16 (local.get $O1)))
        (if (i32.eqz (i32.load offset=12 (local.get $R)))
          (then
            (local.set $r32 (i32.const 0))
            (block $pd (loop $pl
              (br_if $pd (i32.ge_u (local.get $r32) (i32.const 8)))
              (i32.store offset=16 (local.get $O1) (i32.sub (i32.const -4) (i32.shl (local.get $r32) (i32.const 2))))
              (call $uc_store (local.get $O1) (i32.const 32) (call $uc_aR (local.get $r32)))
              (local.set $r32 (i32.add (local.get $r32) (i32.const 1)))
              (br $pl)))
            (i32.store offset=16 (local.get $O1) (local.get $n))
            (call $uc_o3 (i32.const 8) (call $uc_aR (i32.const 4)) (call $uc_aR (i32.const 4)) (call $uc_aN (i32.const -32)))
            (return (i32.const 0))))
        (local.set $r32 (i32.const 0))
        (block $qd (loop $ql
          (br_if $qd (i32.ge_u (local.get $r32) (i32.const 8)))
          (if (i32.ne (local.get $r32) (i32.const 4))
            (then
              (i32.store offset=16 (local.get $O1) (i32.sub (i32.const 28) (i32.shl (local.get $r32) (i32.const 2))))
              (call $uc_load (local.get $O1) (i32.const 32) (i32.const 0) (call $uc_aT (i32.const 21) (local.get $r32)))))
          (local.set $r32 (i32.add (local.get $r32) (i32.const 1)))
          (br $ql)))
        (i32.store offset=16 (local.get $O1) (local.get $n))
        (local.set $r32 (i32.const 0))
        (block $md (loop $ml
          (br_if $md (i32.ge_u (local.get $r32) (i32.const 8)))
          (if (i32.ne (local.get $r32) (i32.const 4))
            (then (call $uc_o2 (i32.const 2) (call $uc_aR (local.get $r32)) (call $uc_aT (i32.const 21) (local.get $r32)))))
          (local.set $r32 (i32.add (local.get $r32) (i32.const 1)))
          (br $ml)))
        (call $uc_o3 (i32.const 8) (call $uc_aR (i32.const 4)) (call $uc_aR (i32.const 4)) (call $uc_aN (i32.const 32)))
        (return (i32.const 0))))
    (if (i32.eq (local.get $k) (i32.const 5))
      (then
        (if (i32.and (call $uc_is_mem (local.get $O1)) (call $uc_ref_is_reg32 (local.get $O0)))
          (then (call $uc_load (local.get $O1) (i32.const 32) (i32.const 0) (call $uc_aR (i32.load offset=4 (local.get $O0))))
                (return (i32.const 0))))
        (if (i32.eq (i32.load (local.get $O1)) (i32.const 3))
          (then (local.set $v (call $uc_aC (i32.load offset=16 (local.get $O1)))))
          (else (local.set $v (call $uc_rawof (call $uc_read (local.get $O1) (local.get $R) (i32.const 3))))))
        (if (i32.and (call $uc_ref_is_reg32 (local.get $O0)) (i32.eq (i32.load (local.get $O1)) (i32.const 3)))
          (then (call $uc_o2 (i32.const 1) (call $uc_aR (i32.load offset=4 (local.get $O0)))
                             (call $uc_aN (i32.load offset=16 (local.get $O1))))
                (return (i32.const 0))))
        (call $uc_write (local.get $O0) (local.get $v))
        (return (i32.const 0))))
    (if (i32.eq (local.get $k) (i32.const 17))
      (then
        (if (call $uc_is_mem (local.get $O1))
          (then
            (local.set $v (if (result i64) (i32.eqz (i32.load offset=8 (local.get $O0)))
                            (then (call $uc_aR (i32.load offset=4 (local.get $O0)))) (else (call $uc_scratch))))
            (call $uc_load (local.get $O1) (i32.load offset=32 (local.get $R)) (i32.load offset=36 (local.get $R)) (local.get $v)))
          (else
            (local.set $v (call $uc_valof
              (call $uc_ref_new (i32.const 0) (i32.load offset=4 (local.get $O1)) (i32.const 0)
                                (i32.load offset=8 (local.get $O1)) (i32.const 0))
              (i32.load offset=32 (local.get $R)) (i32.load offset=36 (local.get $R))))))
        (call $uc_write_reg (local.get $O0) (local.get $v))
        (return (i32.const 0))))
    (if (i32.eq (local.get $k) (i32.const 6))
      (then
        (local.set $v (if (result i64) (i32.eqz (i32.load offset=8 (local.get $O0)))
                        (then (call $uc_aR (i32.load offset=4 (local.get $O0)))) (else (call $uc_scratch))))
        (call $uc_o5 (i32.const 32) (local.get $v) (call $uc_mbase (local.get $O1)) (call $uc_midx (local.get $O1))
                     (call $uc_aN (i32.load offset=12 (local.get $O1))) (call $uc_aN (i32.load offset=16 (local.get $O1))))
        (if (i32.load offset=8 (local.get $O0)) (then (call $uc_write_reg (local.get $O0) (local.get $v))))
        (return (i32.const 0))))
    (if (i32.eq (local.get $k) (i32.const 10))
      (then (call $uc_o3 (i32.const 12) (call $uc_aR (i32.const 2)) (call $uc_aR (i32.const 0)) (call $uc_aN (i32.const 31)))
            (return (i32.const 0))))
    (if (i32.eq (local.get $k) (i32.const 9))
      (then (call $uc_o2 (i32.const 48) (call $uc_aR (i32.const 0)) (call $uc_aR (i32.const 0)))
            (return (i32.const 0))))
    (if (i32.eq (local.get $k) (i32.const 8))
      (then
        (if (i32.eq (i32.load offset=4 (local.get $O0)) (i32.load offset=4 (local.get $O1))) (then (return (i32.const 0))))
        (local.set $t (call $uc_scratch))
        (call $uc_o2 (i32.const 2) (local.get $t) (call $uc_aR (i32.load offset=4 (local.get $O0))))
        (call $uc_o2 (i32.const 2) (call $uc_aR (i32.load offset=4 (local.get $O0))) (call $uc_aR (i32.load offset=4 (local.get $O1))))
        (call $uc_o2 (i32.const 2) (call $uc_aR (i32.load offset=4 (local.get $O1))) (local.get $t))
        (return (i32.const 0))))
    (if (i32.eq (local.get $k) (i32.const 12))
      (then
        (local.set $A (call $uc_read (local.get $O0) (local.get $R) (i32.const 1)))
        (local.set $r32 (call $uc_ref_is_reg32 (local.get $O0)))
        (local.set $t (if (result i64) (local.get $r32)
                        (then (call $uc_aR (i32.load offset=4 (local.get $O0)))) (else (call $uc_scratch))))
        (call $uc_o3 (i32.const 42) (local.get $t) (call $uc_rawof (local.get $A)) (call $uc_aN (i32.const -1)))
        (if (i32.eqz (local.get $r32)) (then (call $uc_write (local.get $O0) (local.get $t))))
        (return (i32.const 0))))
    (if (i32.eq (local.get $k) (i32.const 4))
      (then
        (local.set $A (call $uc_read (local.get $O0) (local.get $R) (i32.const 1)))
        (local.set $B (call $uc_read (local.get $O1) (local.get $R) (i32.const 2)))
        (call $uc_snap_after (local.get $R) (i32.const 1) (local.get $A))
        (call $uc_snap_after (local.get $R) (i32.const 2) (local.get $B))
        (return (i32.const 0))))
    (if (i32.eq (local.get $k) (i32.const 1)) (then (return (call $uc_alu (local.get $R)))))
    (if (i32.or (i32.eq (local.get $k) (i32.const 2)) (i32.eq (local.get $k) (i32.const 3)))
      (then
        (local.set $r32 (call $uc_ref_is_reg32 (local.get $O0)))
        (if (local.get $r32)
          (then
            (call $uc_o3 (i32.const 8) (call $uc_aR (i32.load offset=4 (local.get $O0)))
                         (call $uc_aR (i32.load offset=4 (local.get $O0)))
                         (call $uc_aN (select (i32.const -1) (i32.const 1) (i32.eq (local.get $k) (i32.const 3)))))
            (local.set $B (call $uc_ref_new (i32.const 0) (i32.load offset=4 (local.get $O0)) (i32.const 0) (i32.const 0) (i32.const 0))))
          (else
            (local.set $A (call $uc_read (local.get $O0) (local.get $R) (i32.const 1)))
            (local.set $t (call $uc_aT (i32.const 6) (local.get $a)))
            (local.set $v (call $uc_rawof (local.get $A)))
            (call $uc_o3 (i32.const 8) (local.get $t) (local.get $v)
                         (call $uc_aN (select (i32.const -1) (i32.const 1) (i32.eq (local.get $k) (i32.const 3)))))
            (call $uc_write (local.get $O0) (local.get $t))
            (local.set $B (call $uc_ref_new (i32.const 1) (local.get $a) (i32.const 6) (i32.const 0) (i32.const 0)))))
        (call $uc_snap_after (local.get $R) (i32.const 3) (local.get $B))
        (return (i32.const 0))))
    (if (i32.eq (local.get $k) (i32.const 13))
      (then
        (local.set $A (call $uc_read (local.get $O0) (local.get $R) (i32.const 1)))
        (local.set $t (call $uc_aT (i32.const 6) (local.get $a)))
        (local.set $v (call $uc_rawof (local.get $A)))
        (call $uc_o3 (i32.const 4) (local.get $t) (call $uc_aC (i32.const 0)) (local.get $v))
        (call $uc_write (local.get $O0) (local.get $t))
        (return (i32.const 0))))
    (if (i32.eq (local.get $k) (i32.const 11))
      (then
        (local.set $A (call $uc_read (local.get $O0) (local.get $R) (i32.const 1)))
        (local.set $w (i32.load offset=16 (local.get $R)))
        (local.set $op (i32.load offset=12 (local.get $R)))
        (local.set $src (call $uc_valof (local.get $A) (local.get $w) (i32.eq (local.get $op) (i32.const 2))))
        ;; rol (3) / ror (4) by n, 0 < n < w: two shifts and an or. CF is
        ;; bit 0 of the result for rol and its top bit for ror ($do_shift).
        (if (i32.ge_u (local.get $op) (i32.const 3))
          (then
            (local.set $n (i32.load offset=28 (local.get $R)))
            (local.set $vx (call $uc_scratch))
            (local.set $vy (call $uc_scratch))
            (call $uc_o3 (select (i32.const 10) (i32.const 11) (i32.eq (local.get $op) (i32.const 3)))
                         (local.get $vx) (local.get $src) (call $uc_aN (local.get $n)))
            (call $uc_o3 (select (i32.const 11) (i32.const 10) (i32.eq (local.get $op) (i32.const 3)))
                         (local.get $vy) (local.get $src) (call $uc_aN (i32.sub (local.get $w) (local.get $n))))
            (local.set $t (call $uc_aT (i32.const 6) (local.get $a)))
            (call $uc_o3 (i32.const 6) (local.get $t) (local.get $vx) (local.get $vy))
            (if (call $uc_demand_has (i32.const 2) (i32.const 0) (local.get $a))
              (then
                (local.set $v (call $uc_aT (i32.const 8) (local.get $a)))
                (if (i32.eq (local.get $op) (i32.const 3))
                  (then (call $uc_o3 (i32.const 9) (local.get $v) (local.get $t) (call $uc_aN (i32.const 1))))
                  (else
                    (call $uc_o3 (i32.const 11) (local.get $v) (local.get $t) (call $uc_aN (i32.sub (local.get $w) (i32.const 1))))
                    (call $uc_o3 (i32.const 9) (local.get $v) (local.get $v) (call $uc_aN (i32.const 1)))))))
            (call $uc_write (local.get $O0) (local.get $t))
            (return (i32.const 0))))
        (if (call $uc_demand_has (i32.const 2) (i32.const 0) (local.get $a))
          (then
            (local.set $t (call $uc_aT (i32.const 8) (local.get $a)))
            (local.set $v (if (result i64) (i32.eq (local.get $op) (i32.const 2))
                            (then (call $uc_valof (local.get $A) (local.get $w) (i32.const 0)))
                            (else (local.get $src))))
            (call $uc_o3 (i32.const 11) (local.get $t) (local.get $v)
              (call $uc_aN (select (i32.sub (local.get $w) (i32.load offset=28 (local.get $R)))
                                   (i32.sub (i32.load offset=28 (local.get $R)) (i32.const 1))
                                   (i32.eqz (local.get $op)))))
            (call $uc_o3 (i32.const 9) (local.get $t) (local.get $t) (call $uc_aN (i32.const 1)))))
        (local.set $t (call $uc_aT (i32.const 6) (local.get $a)))
        (call $uc_o3 (select (i32.const 10) (select (i32.const 11) (i32.const 12) (i32.eq (local.get $op) (i32.const 1)))
                             (i32.eqz (local.get $op)))
                     (local.get $t) (local.get $src) (call $uc_aN (i32.load offset=28 (local.get $R))))
        (call $uc_write (local.get $O0) (local.get $t))
        (return (i32.const 0))))
    ;; shl/shr/sar r/m, cl, as $do_shift computes it for every masked count:
    ;; the engine's shifts mask their count like wasm's, which is what the
    ;; threaded handler's own i32 shifts do, so a count >= w below 32 bits
    ;; needs no case of its own. A count of 0 leaves the flags alone: the
    ;; record is written here either way, the incoming one on that path, and
    ;; the state after is 'G' ($uc_flag_class 3). Below 32 bits the threaded
    ;; handler also sets flag_sign_shift to w-1 at count 0 (SETSS). The
    ;; branches here are layout (BNZL/GOTO): no x86 transfer, no block.
    (if (i32.eq (local.get $k) (i32.const 18))
      (then
        (local.set $w (i32.load offset=16 (local.get $R)))
        (local.set $op (i32.load offset=12 (local.get $R)))
        (local.set $vx (call $uc_scratch))
        (call $uc_o3 (i32.const 9) (local.get $vx) (call $uc_aR (i32.const 1)) (call $uc_aN (i32.const 31)))
        (local.set $A (call $uc_read (local.get $O0) (local.get $R) (i32.const 1)))
        (local.set $src (call $uc_valof (local.get $A) (local.get $w) (i32.eq (local.get $op) (i32.const 2))))
        (local.set $t (call $uc_aT (i32.const 6) (local.get $a)))
        (call $uc_o3 (i32.add (i32.const 43) (local.get $op)) (local.get $t) (local.get $src) (local.get $vx))
        (if (call $uc_live_out (local.get $R))
          (then
            (local.set $vl1 (call $uc_aL (i32.const 7) (global.get $uc_nlocal)))
            (local.set $vl2 (call $uc_aL (i32.const 7) (i32.add (global.get $uc_nlocal) (i32.const 1))))
            (global.set $uc_nlocal (i32.add (global.get $uc_nlocal) (i32.const 2)))
            (call $uc_o2 (i32.const 64) (local.get $vx) (local.get $vl1))
            (local.set $n (call $uc_rec (global.get $uc_x_m) (global.get $uc_x_md)
                                        (global.get $uc_x_c) (global.get $uc_x_cd)))
            (if (local.get $n) (then (return (local.get $n))))
            (if (i32.lt_u (local.get $w) (i32.const 32))
              (then (call $uc_o1 (i32.const 65) (call $uc_aN (i32.sub (local.get $w) (i32.const 1))))))
            (call $uc_o1 (i32.const 62) (local.get $vl2))
            (call $uc_label (local.get $vl1))
            ;; CF: shl bit (w - n) of the operand, shr/sar bit (n - 1) of
            ;; it -- sign-extended for sar, as $do_shift has it by then.
            (local.set $vy (call $uc_scratch))
            (if (i32.eqz (local.get $op))
              (then (call $uc_o3 (i32.const 4) (local.get $vy) (call $uc_aC (local.get $w)) (local.get $vx)))
              (else (call $uc_o3 (i32.const 8) (local.get $vy) (local.get $vx) (call $uc_aN (i32.const -1)))))
            (local.set $v (call $uc_scratch))
            (call $uc_o3 (i32.const 44) (local.get $v) (local.get $src) (local.get $vy))
            (call $uc_o3 (i32.const 9) (local.get $v) (local.get $v) (call $uc_aN (i32.const 1)))
            (local.set $vx (local.get $t))
            (if (i32.lt_u (local.get $w) (i32.const 32))
              (then (local.set $vx (call $uc_scratch))
                    (call $uc_o3 (i32.const 9) (local.get $vx) (local.get $t) (call $uc_aN (call $uc_mask (local.get $w))))))
            (call $uc_o5 (i32.const 28) (call $uc_aN (i32.const 7)) (call $uc_aC (i32.const 0)) (local.get $v)
                         (local.get $vx) (call $uc_aN (i32.sub (local.get $w) (i32.const 1))))
            (call $uc_label (local.get $vl2))))
        (call $uc_write (local.get $O0) (local.get $t))
        (return (i32.const 0))))
    ;; setcc r/m8: the condition as a 0/1 value, forwarded from the producer
    ;; where $uc_setv knows how, else from the record ($eval_cc, a service op).
    (if (i32.eq (local.get $k) (i32.const 19))
      (then
        (local.set $v (call $uc_scratch))
        (local.set $n (call $uc_setv (global.get $uc_x_m) (global.get $uc_x_md) (global.get $uc_x_c)
                                     (global.get $uc_x_cd) (i32.load offset=20 (local.get $R)) (local.get $v)))
        (if (local.get $n) (then (return (local.get $n))))
        (call $uc_write (local.get $O0) (local.get $v))
        (return (i32.const 0))))
    ;; adc / sbb (32-bit, +12 2 / 3): r = a +/- (b + CF), recorded as
    ;; $do_alu32 and the register-form handlers record it:
    ;;   sbb  $set_flags_sub(a, b+CF, r); when b+CF wraps, flag_a 0 and
    ;;        flag_b 1 (so CF reads 1) -- done arithmetically below;
    ;;   adc  $set_flags_add(a, b+CF, r); when b+CF wraps, raw mode: flag_op
    ;;        8, flag_a 1 (CF), flag_b 0 (OF), flag_res still r -- a different
    ;;        op, so two RECs behind a layout branch (BNZL/GOTO, no block).
    ;; The state after is 'G' ($uc_flag_class 3), and the record is written
    ;; EVERY time. Skipping it when $uc_live_out said the flags were dead
    ;; once broke Heroes III (a NULL call at batch 3651), but the skip was
    ;; not the bug: it only moved program sizes so the arena reuse that
    ;; 553db124 fixed (entering a freed program) forged a live header. With
    ;; that fix the skip is frame-identical on H3; it stays off because no
    ;; CPU gain was measured for it (docs/uop-tier-design.md §15.2).
    ;; A memory destination is stored BEFORE the record: a
    ;; store that deopts re-executes this instruction in threaded code from
    ;; the entry state, and with CF coming from the globals ('G') a record
    ;; already written would hand it the wrong carry.
    (if (i32.eq (local.get $k) (i32.const 20))
      (then
        (local.set $op (i32.load offset=12 (local.get $R)))
        (local.set $vx (call $uc_scratch))
        (local.set $n (call $uc_cf_into (global.get $uc_x_c) (global.get $uc_x_cd) (local.get $vx)))
        (if (local.get $n) (then (return (local.get $n))))
        (local.set $A (call $uc_read (local.get $O0) (local.get $R) (i32.const 1)))
        (local.set $B (call $uc_read (local.get $O1) (local.get $R) (i32.const 2)))
        (local.set $src (call $uc_rawof (local.get $A)))
        (local.set $vy (call $uc_rawof (local.get $B)))
        (local.set $vl1 (call $uc_scratch))
        (call $uc_o3 (i32.const 3) (local.get $vl1) (local.get $vy) (local.get $vx))
        (local.set $t (call $uc_aT (i32.const 6) (local.get $a)))
        (call $uc_o3 (select (i32.const 3) (i32.const 4) (i32.eq (local.get $op) (i32.const 2)))
                     (local.get $t) (local.get $src) (local.get $vl1))
        (if (call $uc_is_mem (local.get $O0)) (then (call $uc_write (local.get $O0) (local.get $t))))
        (block
          (block
            ;; wrapped = (b+CF) <u b
            (local.set $vl2 (call $uc_scratch))
            (call $uc_o3 (i32.const 54) (local.get $vl2) (local.get $vl1) (local.get $vy))
            (if (i32.eq (local.get $op) (i32.const 2))
              (then
                (local.set $vx (call $uc_aL (i32.const 7) (global.get $uc_nlocal)))
                (local.set $v (call $uc_aL (i32.const 7) (i32.add (global.get $uc_nlocal) (i32.const 1))))
                (global.set $uc_nlocal (i32.add (global.get $uc_nlocal) (i32.const 2)))
                (call $uc_o2 (i32.const 64) (local.get $vl2) (local.get $vx))
                (call $uc_o5 (i32.const 28) (call $uc_aN (i32.const 1)) (local.get $src) (local.get $vl1)
                             (local.get $t) (call $uc_aN (i32.const 31)))
                (call $uc_o1 (i32.const 62) (local.get $v))
                (call $uc_label (local.get $vx))
                (call $uc_o5 (i32.const 28) (call $uc_aN (i32.const 8)) (call $uc_aC (i32.const 1))
                             (call $uc_aC (i32.const 0)) (local.get $t) (call $uc_aN (i32.const 31)))
                (call $uc_label (local.get $v)))
              (else
                ;; keep = wrapped - 1 (all ones unless wrapped)
                (local.set $v (call $uc_scratch))
                (call $uc_o3 (i32.const 8) (local.get $v) (local.get $vl2) (call $uc_aN (i32.const -1)))
                (local.set $vx (call $uc_scratch))
                (call $uc_o3 (i32.const 5) (local.get $vx) (local.get $src) (local.get $v))
                (local.set $vy (call $uc_scratch))
                (call $uc_o3 (i32.const 5) (local.get $vy) (local.get $vl1) (local.get $v))
                (call $uc_o3 (i32.const 6) (local.get $vy) (local.get $vy) (local.get $vl2))
                (call $uc_o5 (i32.const 28) (call $uc_aN (i32.const 2)) (local.get $vx) (local.get $vy)
                             (local.get $t) (call $uc_aN (i32.const 31)))))))
        (if (i32.eqz (call $uc_is_mem (local.get $O0))) (then (call $uc_write (local.get $O0) (local.get $t))))
        (return (i32.const 0))))
    (if (i32.eq (local.get $k) (i32.const 14))
      (then
        (local.set $A (call $uc_read (local.get $O1) (local.get $R) (i32.const 4)))
        (local.set $B (call $uc_read (local.get $O2) (local.get $R) (i32.const 5)))
        (local.set $vx (call $uc_rawof (local.get $A)))
        (local.set $vy (call $uc_rawof (local.get $B)))
        (if (call $uc_demand_has (i32.const 3) (i32.const 0) (local.get $a))
          (then (call $uc_o3 (i32.const 59) (call $uc_aT (i32.const 9) (local.get $a)) (local.get $vx) (local.get $vy))))
        (call $uc_o3 (i32.const 46) (call $uc_aR (i32.load offset=4 (local.get $O0))) (local.get $vx) (local.get $vy))
        (call $uc_snap_after (local.get $R) (i32.const 3)
          (call $uc_ref_new (i32.const 0) (i32.load offset=4 (local.get $O0)) (i32.const 0) (i32.const 0) (i32.const 0)))
        (return (i32.const 0))))
    ;; mul/imul r/m32 (--uop-muldiv): EDX:EAX = EAX * src. $set_flags_mul
    ;; writes op, b and res but keeps flag_a and the sign shift, so when the
    ;; flags are live the incoming record goes to the globals first (before
    ;; EAX changes under it) and SETMULF finishes it: the state after is 'G'
    ;; ($uc_flag_class 3), as for shift-by-CL.
    (if (i32.eq (local.get $k) (i32.const 25))
      (then
        (local.set $op (i32.load offset=12 (local.get $R)))
        (local.set $A (call $uc_read (local.get $O0) (local.get $R) (i32.const 1)))
        (local.set $src (call $uc_rawof (local.get $A)))
        (local.set $n (call $uc_live_out (local.get $R)))
        (if (local.get $n)
          (then
            (local.set $w (call $uc_rec (global.get $uc_x_m) (global.get $uc_x_md)
                                        (global.get $uc_x_c) (global.get $uc_x_cd)))
            (if (local.get $w) (then (return (local.get $w))))))
        (call $uc_o5 (i32.const 68) (call $uc_aR (i32.const 0)) (call $uc_aR (i32.const 2))
                     (call $uc_aR (i32.const 0)) (local.get $src) (call $uc_aN (local.get $op)))
        (if (local.get $n)
          (then (call $uc_o3 (i32.const 69) (call $uc_aN (local.get $op))
                             (call $uc_aR (i32.const 0)) (call $uc_aR (i32.const 2)))))
        (return (i32.const 0))))
    ;; div/idiv r/m32: DIVW leaves to this instruction's deopt stub on every
    ;; case the threaded handler raises #DE in, so the exception is raised
    ;; there, at the right eip, with the entry flags. No flags written.
    (if (i32.eq (local.get $k) (i32.const 26))
      (then
        (local.set $A (call $uc_read (local.get $O0) (local.get $R) (i32.const 1)))
        (local.set $src (call $uc_rawof (local.get $A)))
        (call $uc_emit (i32.const 70) (i32.const 7)
              (call $uc_aR (i32.const 0)) (call $uc_aR (i32.const 2))
              (call $uc_aR (i32.const 0)) (call $uc_aR (i32.const 2))
              (local.get $src) (call $uc_aN (i32.load offset=12 (local.get $R)))
              (call $uc_xstub))
        (return (i32.const 0))))
    (if (i32.eq (local.get $k) (i32.const 27))
      (then (return (call $uc_mmx_insn (local.get $R)))))
    (i32.const 19))

  ;; Kind 27. Each form makes at most one guest memory access, and makes it
  ;; first, so its deopt stub re-runs the whole instruction in threaded code
  ;; with nothing yet changed. A memory source is staged in cell 8 so the
  ;; destination is written only after the load succeeded.
  (func $uc_mmx_insn (param $R i32) (result i32)
    (local $O0 i32) (local $O1 i32) (local $sub i32) (local $form i32) (local $t i64)
    (local.set $O0 (i32.add (local.get $R) (i32.const 56)))
    (local.set $O1 (i32.add (local.get $R) (i32.const 80)))
    (local.set $sub (i32.load offset=12 (local.get $R)))
    (local.set $form (i32.load offset=28 (local.get $R)))
    ;; a stack slot forwarded to an elided push's temp: the MMX forms do not
    ;; take one ($uc_sp_role gives kind 27 no role, so this does not happen)
    (if (global.get $uc_fwd_kind) (then (return (i32.const 22))))
    ;; EMMS
    (if (i32.eq (local.get $form) (i32.const 4))
      (then
        (call $uc_emit (i32.const 86) (i32.const 0) (i64.const 0) (i64.const 0) (i64.const 0)
              (i64.const 0) (i64.const 0) (i64.const 0) (i64.const 0))
        (return (i32.const 0))))
    ;; mm, imm8: the 71-73 shifts
    (if (i32.eq (local.get $form) (i32.const 3))
      (then
        (call $uc_emit (i32.const 75) (i32.const 4) (call $uc_aN (local.get $sub))
              (call $uc_aM (i32.load offset=4 (local.get $O0))) (call $uc_aM (i32.load offset=4 (local.get $O0)))
              (call $uc_aN (i32.and (i32.load offset=16 (local.get $O1)) (i32.const 0xFF)))
              (i64.const 0) (i64.const 0) (i64.const 0))
        (return (i32.const 0))))
    ;; register forms
    (if (i32.eqz (local.get $form))
      (then
        ;; movd mm, r32
        (if (i32.eq (local.get $sub) (i32.const 1))
          (then (call $uc_o2 (i32.const 76) (call $uc_aM (i32.load offset=4 (local.get $O0)))
                             (call $uc_aR (i32.load offset=4 (local.get $O1))))
                (return (i32.const 0))))
        ;; movd r32, mm
        (if (i32.eq (local.get $sub) (i32.const 2))
          (then (call $uc_o2 (i32.const 77) (call $uc_aR (i32.load offset=4 (local.get $O0)))
                             (call $uc_aM (i32.load offset=4 (local.get $O1))))
                (return (i32.const 0))))
        (call $uc_mx_op (local.get $sub) (i32.load offset=4 (local.get $O0))
                        (call $uc_aM (i32.load offset=4 (local.get $O1))))
        (return (i32.const 0))))
    ;; mm, mem
    (if (i32.eq (local.get $form) (i32.const 1))
      (then
        (if (i32.eq (local.get $sub) (i32.const 1))
          (then ;; movd mm, m32: 4 bytes, zero-extended
            (local.set $t (call $uc_scratch))
            (call $uc_load (local.get $O1) (i32.const 32) (i32.const 0) (local.get $t))
            (call $uc_o2 (i32.const 76) (call $uc_aM (i32.load offset=4 (local.get $O0))) (local.get $t))
            (return (i32.const 0))))
        ;; every other memory source is 8 bytes, as 06c's $mmx_load64 reads it
        ;; (punpckl* included); movq loads straight into its destination
        (call $uc_ldx64 (local.get $O1)
          (call $uc_aM (select (i32.load offset=4 (local.get $O0)) (i32.const 8) (i32.eqz (local.get $sub)))))
        (if (local.get $sub)
          (then (call $uc_mx_op (local.get $sub) (i32.load offset=4 (local.get $O0)) (call $uc_aM (i32.const 8)))))
        (return (i32.const 0))))
    ;; mem, mm: movd m32 / movq m64 / movntq m64
    (if (i32.eq (local.get $sub) (i32.const 2))
      (then
        (local.set $t (call $uc_scratch))
        (call $uc_o2 (i32.const 77) (local.get $t) (call $uc_aM (i32.load offset=4 (local.get $O1))))
        (call $uc_store (local.get $O0) (i32.const 32) (local.get $t))
        (return (i32.const 0))))
    (call $uc_emit (i32.const 73) (i32.const 7) (call $uc_aM (i32.load offset=4 (local.get $O1)))
      (call $uc_mbase (local.get $O0)) (call $uc_midx (local.get $O0))
      (call $uc_aN (i32.load offset=12 (local.get $O0))) (call $uc_aN (i32.load offset=16 (local.get $O0)))
      (call $uc_win (local.get $O0) (i32.const 1)) (call $uc_xstub))
    (i32.const 0))

  ;; MXOP sub: cell d = op(cell d, src)
  (func $uc_mx_op (param $sub i32) (param $d i32) (param $src i64)
    (call $uc_emit (i32.const 74) (i32.const 4) (call $uc_aN (local.get $sub))
          (call $uc_aM (local.get $d)) (call $uc_aM (local.get $d)) (local.get $src)
          (i64.const 0) (i64.const 0) (i64.const 0)))

  ;; LDX64: the 8 bytes at memory operand o into cell dst
  (func $uc_ldx64 (param $o i32) (param $dst i64)
    (call $uc_emit (i32.const 72) (i32.const 7) (local.get $dst)
      (call $uc_mbase (local.get $o)) (call $uc_midx (local.get $o))
      (call $uc_aN (i32.load offset=12 (local.get $o))) (call $uc_aN (i32.load offset=16 (local.get $o)))
      (call $uc_win (local.get $o) (i32.const 0)) (call $uc_xstub)))

  (func $uc_alu (param $R i32) (result i32)
    (local $O0 i32) (local $A i32) (local $B i32) (local $op i32) (local $w i32)
    (local $a i32) (local $r32 i32) (local $dst i64) (local $va i64) (local $vb i64) (local $imm i32)
    (local.set $O0 (i32.add (local.get $R) (i32.const 56)))
    (local.set $a (i32.load (local.get $R)))
    (local.set $op (i32.load offset=12 (local.get $R)))
    (local.set $w (i32.load offset=16 (local.get $R)))
    (local.set $A (call $uc_read (local.get $O0) (local.get $R) (i32.const 1)))
    (local.set $B (call $uc_read (i32.add (local.get $R) (i32.const 80)) (local.get $R) (i32.const 2)))
    (if (i32.eq (local.get $op) (i32.const 7))
      (then (call $uc_snap_after (local.get $R) (i32.const 1) (local.get $A))
            (call $uc_snap_after (local.get $R) (i32.const 2) (local.get $B))
            (return (i32.const 0))))
    ;; The source register is also the destination: keep its old value.
    (if (i32.and (i32.and (i32.eqz (i32.load (local.get $B))) (i32.eq (i32.load (local.get $O0)) (i32.const 1)))
                 (i32.eq (i32.load offset=4 (local.get $B)) (i32.load offset=4 (local.get $O0))))
      (then
        (call $uc_o2 (i32.const 2) (call $uc_aT (i32.const 7) (local.get $a)) (call $uc_aR (i32.load offset=4 (local.get $B))))
        (local.set $B (call $uc_ref_new (i32.const 1) (local.get $a) (i32.const 7) (i32.load offset=12 (local.get $B)) (i32.const 0)))))
    (local.set $r32 (i32.and (call $uc_ref_is_reg32 (local.get $O0)) (i32.eq (local.get $w) (i32.const 32))))
    (local.set $dst (if (result i64) (local.get $r32)
                      (then (call $uc_aR (i32.load offset=4 (local.get $O0)))) (else (call $uc_aT (i32.const 6) (local.get $a)))))
    (local.set $va (call $uc_rawof (local.get $A)))
    (if (i32.eq (i32.load (local.get $B)) (i32.const 2))
      (then
        (local.set $imm (i32.load offset=4 (local.get $B)))
        (call $uc_o3
          (if (result i32) (i32.or (i32.eqz (local.get $op)) (i32.eq (local.get $op) (i32.const 5))) (then (i32.const 8))
            (else (if (result i32) (i32.eq (local.get $op) (i32.const 4)) (then (i32.const 9))
              (else (select (i32.const 41) (i32.const 42) (i32.eq (local.get $op) (i32.const 1)))))))
          (local.get $dst) (local.get $va)
          (call $uc_aN (select (i32.sub (i32.const 0) (local.get $imm)) (local.get $imm) (i32.eq (local.get $op) (i32.const 5))))))
      (else
        (local.set $vb (call $uc_rawof (local.get $B)))
        (call $uc_o3
          (if (result i32) (i32.eqz (local.get $op)) (then (i32.const 3))
            (else (if (result i32) (i32.eq (local.get $op) (i32.const 5)) (then (i32.const 4))
              (else (if (result i32) (i32.eq (local.get $op) (i32.const 4)) (then (i32.const 5))
                (else (select (i32.const 6) (i32.const 7) (i32.eq (local.get $op) (i32.const 1)))))))))
          (local.get $dst) (local.get $va) (local.get $vb))))
    (if (i32.eqz (local.get $r32)) (then (call $uc_write (local.get $O0) (local.get $dst))))
    (call $uc_snap_after (local.get $R) (i32.const 3)
      (if (result i32) (local.get $r32)
        (then (call $uc_ref_new (i32.const 0) (i32.load offset=4 (local.get $O0)) (i32.const 0) (i32.const 0) (i32.const 0)))
        (else (call $uc_ref_new (i32.const 1) (local.get $a) (i32.const 6) (i32.const 0) (i32.const 0)))))
    (call $uc_snap_after (local.get $R) (i32.const 2) (local.get $B))
    (i32.const 0))

  ;; ---- flags ----
  ;; A producer's ref (name 1 A, 2 B, 3 R) at a consumer whose state says
  ;; `dirty` registers were written since the producer ran.
  (func $uc_pref (param $p i32) (param $name i32) (param $dirty i32) (result i32)
    (local $R i32) (local $ref i32)
    (local.set $R (call $uc_insn_at (local.get $p)))
    (local.set $ref (i32.add (local.get $R)
      (select (i32.const 136) (select (i32.const 156) (i32.const 176) (i32.eq (local.get $name) (i32.const 2)))
              (i32.eq (local.get $name) (i32.const 1)))))
    (if (i32.and (i32.eqz (i32.load (local.get $ref)))
                 (i32.and (i32.shr_u (local.get $dirty) (i32.load offset=4 (local.get $ref))) (i32.const 1)))
      (then
        (call $uc_demand_add (i32.const 1) (local.get $name) (local.get $p))
        (return (call $uc_ref_new (i32.const 1) (local.get $p) (i32.add (i32.const 9) (local.get $name))
                                  (i32.load offset=12 (local.get $ref)) (i32.const 0)))))
    (local.get $ref))

  (func $uc_rkind (param $p i32) (result i32)
    (local $R i32)
    (local.set $R (call $uc_insn_at (local.get $p)))
    (if (i32.lt_s (local.get $R) (i32.const 0)) (then (return (i32.const 0))))
    (i32.load offset=128 (local.get $R)))
  (func $uc_rw (param $p i32) (result i32)
    (i32.load offset=132 (call $uc_insn_at (local.get $p))))
  (func $uc_mask (param $w i32) (result i32)
    (select (i32.const 0xFF) (i32.const 0xFFFF) (i32.eq (local.get $w) (i32.const 8))))

  (func $uc_aofsub (param $q i32) (param $dirty i32) (param $w i32) (param $bv i64) (result i64)
    (local $t i64)
    (local.set $t (call $uc_scratch))
    (call $uc_o3 (i32.const 3) (local.get $t) (call $uc_rawof (call $uc_pref (local.get $q) (i32.const 3) (local.get $dirty)))
                 (local.get $bv))
    (if (i32.eq (local.get $w) (i32.const 32)) (then (return (local.get $t))))
    (call $uc_o3 (i32.const 9) (local.get $t) (local.get $t) (call $uc_aN (call $uc_mask (local.get $w))))
    (local.get $t))

  ;; CF of state (c, cd) into vreg t.
  (func $uc_cf_into (param $c i32) (param $cd i32) (param $t i64) (result i32)
    (local $rk i32) (local $w i32) (local $x i64) (local $y i64)
    (if (i32.eq (local.get $c) (global.get $UC_G)) (then (call $uc_o1 (i32.const 55) (local.get $t)) (return (i32.const 0))))
    (if (i32.eq (local.get $c) (global.get $UC_D)) (then (return (i32.const 12))))
    (local.set $rk (call $uc_rkind (local.get $c)))
    (if (i32.eqz (local.get $rk)) (then (return (i32.const 13))))
    (local.set $w (call $uc_rw (local.get $c)))
    (if (i32.eq (local.get $rk) (i32.const 3))
      (then
        (local.set $x (call $uc_valof (call $uc_pref (local.get $c) (i32.const 3) (local.get $cd)) (local.get $w) (i32.const 0)))
        (local.set $y (call $uc_valof (call $uc_pref (local.get $c) (i32.const 2) (local.get $cd)) (local.get $w) (i32.const 0)))
        (call $uc_o3 (i32.const 54) (local.get $t) (local.get $x) (local.get $y)) (return (i32.const 0))))
    (if (i32.eq (local.get $rk) (i32.const 4))
      (then
        (local.set $y (call $uc_valof (call $uc_pref (local.get $c) (i32.const 2) (local.get $cd)) (local.get $w) (i32.const 0)))
        (local.set $x (call $uc_aofsub (local.get $c) (local.get $cd) (local.get $w) (local.get $y)))
        (call $uc_o3 (i32.const 54) (local.get $t) (local.get $x) (local.get $y)) (return (i32.const 0))))
    (if (i32.eq (local.get $rk) (i32.const 2))
      (then
        (local.set $x (call $uc_valof (call $uc_pref (local.get $c) (i32.const 1) (local.get $cd)) (local.get $w) (i32.const 0)))
        (local.set $y (call $uc_valof (call $uc_pref (local.get $c) (i32.const 2) (local.get $cd)) (local.get $w) (i32.const 0)))
        (call $uc_o3 (i32.const 54) (local.get $t) (local.get $x) (local.get $y)) (return (i32.const 0))))
    (if (i32.eq (local.get $rk) (i32.const 8))
      (then
        (local.set $y (call $uc_valof (call $uc_pref (local.get $c) (i32.const 3) (local.get $cd)) (local.get $w) (i32.const 0)))
        (call $uc_o3 (i32.const 54) (local.get $t) (call $uc_aC (i32.const 0)) (local.get $y)) (return (i32.const 0))))
    (if (i32.or (i32.eq (local.get $rk) (i32.const 5)) (i32.eq (local.get $rk) (i32.const 1)))
      (then (call $uc_o2 (i32.const 1) (local.get $t) (call $uc_aN (i32.const 0))) (return (i32.const 0))))
    (if (i32.eq (local.get $rk) (i32.const 9))
      (then (call $uc_demand_add (i32.const 2) (i32.const 0) (local.get $c))
            (call $uc_o2 (i32.const 2) (local.get $t) (call $uc_aT (i32.const 8) (local.get $c))) (return (i32.const 0))))
    (if (i32.eq (local.get $rk) (i32.const 10))
      (then (call $uc_demand_add (i32.const 3) (i32.const 0) (local.get $c))
            (call $uc_o2 (i32.const 2) (local.get $t) (call $uc_aT (i32.const 9) (local.get $c))) (return (i32.const 0))))
    (i32.const 14))

  ;; Write the lazy flag record for state (m, md, c, cd) into the globals.
  (func $uc_rec (param $m i32) (param $md i32) (param $c i32) (param $cd i32) (result i32)
    (local $rk i32) (local $w i32) (local $sh i64) (local $Z i64) (local $A i64) (local $B i64)
    (local $Rv i64) (local $cf i64) (local $err i32)
    (if (i32.eq (local.get $m) (global.get $UC_G)) (then (return (i32.const 0))))
    (if (i32.eq (local.get $m) (global.get $UC_D)) (then (return (i32.const 15))))
    (local.set $rk (call $uc_rkind (local.get $m)))
    (if (i32.eqz (local.get $rk)) (then (return (i32.const 16))))
    (local.set $w (call $uc_rw (local.get $m)))
    (local.set $sh (call $uc_aN (i32.sub (local.get $w) (i32.const 1))))
    (local.set $Z (call $uc_aC (i32.const 0)))
    (if (i32.eq (local.get $rk) (i32.const 3))
      (then
        (local.set $Rv (call $uc_valof (call $uc_pref (local.get $m) (i32.const 3) (local.get $md)) (local.get $w) (i32.const 0)))
        (local.set $B (call $uc_valof (call $uc_pref (local.get $m) (i32.const 2) (local.get $md)) (local.get $w) (i32.const 0)))
        (local.set $A (call $uc_scratch))
        (call $uc_o3 (i32.const 4) (local.get $A) (local.get $Rv) (local.get $B))
        (if (i32.lt_u (local.get $w) (i32.const 32))
          (then (call $uc_o3 (i32.const 9) (local.get $A) (local.get $A) (call $uc_aN (call $uc_mask (local.get $w))))))
        (call $uc_o5 (i32.const 28) (call $uc_aN (i32.const 1)) (local.get $A) (local.get $B) (local.get $Rv) (local.get $sh))
        (return (i32.const 0))))
    (if (i32.eq (local.get $rk) (i32.const 4))
      (then
        (local.set $B (call $uc_valof (call $uc_pref (local.get $m) (i32.const 2) (local.get $md)) (local.get $w) (i32.const 0)))
        (local.set $Rv (call $uc_valof (call $uc_pref (local.get $m) (i32.const 3) (local.get $md)) (local.get $w) (i32.const 0)))
        (local.set $A (call $uc_aofsub (local.get $m) (local.get $md) (local.get $w) (local.get $B)))
        (call $uc_o5 (i32.const 28) (call $uc_aN (i32.const 2)) (local.get $A) (local.get $B) (local.get $Rv) (local.get $sh))
        (return (i32.const 0))))
    (if (i32.eq (local.get $rk) (i32.const 2))
      (then
        (local.set $A (call $uc_valof (call $uc_pref (local.get $m) (i32.const 1) (local.get $md)) (local.get $w) (i32.const 0)))
        (local.set $B (call $uc_valof (call $uc_pref (local.get $m) (i32.const 2) (local.get $md)) (local.get $w) (i32.const 0)))
        (local.set $Rv (call $uc_scratch))
        (call $uc_o3 (i32.const 4) (local.get $Rv) (local.get $A) (local.get $B))
        (if (i32.lt_u (local.get $w) (i32.const 32))
          (then (call $uc_o3 (i32.const 9) (local.get $Rv) (local.get $Rv) (call $uc_aN (call $uc_mask (local.get $w))))))
        (call $uc_o5 (i32.const 28) (call $uc_aN (i32.const 2)) (local.get $A) (local.get $B) (local.get $Rv) (local.get $sh))
        (return (i32.const 0))))
    (if (i32.eq (local.get $rk) (i32.const 5))
      (then
        (local.set $Rv (call $uc_valof (call $uc_pref (local.get $m) (i32.const 3) (local.get $md)) (local.get $w) (i32.const 0)))
        (call $uc_o5 (i32.const 28) (call $uc_aN (i32.const 3)) (local.get $Z) (local.get $Z) (local.get $Rv) (local.get $sh))
        (return (i32.const 0))))
    (if (i32.eq (local.get $rk) (i32.const 1))
      (then
        (local.set $Rv (call $uc_test_res (local.get $m) (local.get $md) (local.get $w)))
        (call $uc_o5 (i32.const 28) (call $uc_aN (i32.const 3)) (local.get $Z) (local.get $Z) (local.get $Rv) (local.get $sh))
        (return (i32.const 0))))
    (if (i32.or (i32.eq (local.get $rk) (i32.const 6)) (i32.eq (local.get $rk) (i32.const 7)))
      (then
        (local.set $Rv (call $uc_valof (call $uc_pref (local.get $m) (i32.const 3) (local.get $md)) (local.get $w) (i32.const 0)))
        (local.set $A (call $uc_scratch))
        (call $uc_o3 (i32.const 8) (local.get $A) (local.get $Rv)
                     (call $uc_aN (select (i32.const -1) (i32.const 1) (i32.eq (local.get $rk) (i32.const 6)))))
        (if (i32.lt_u (local.get $w) (i32.const 32))
          (then (call $uc_o3 (i32.const 9) (local.get $A) (local.get $A) (call $uc_aN (call $uc_mask (local.get $w))))))
        (local.set $cf (call $uc_scratch))
        (local.set $err (call $uc_cf_into (local.get $c) (local.get $cd) (local.get $cf)))
        (if (local.get $err) (then (return (local.get $err))))
        (call $uc_emit (i32.const 56) (i32.const 6)
          (call $uc_aN (select (i32.const 4) (i32.const 5) (i32.eq (local.get $rk) (i32.const 6))))
          (local.get $A) (call $uc_aC (i32.const 1)) (local.get $Rv) (local.get $sh) (local.get $cf) (i64.const 0))
        (return (i32.const 0))))
    (if (i32.eq (local.get $rk) (i32.const 8))
      (then
        (local.set $Rv (call $uc_valof (call $uc_pref (local.get $m) (i32.const 3) (local.get $md)) (local.get $w) (i32.const 0)))
        (local.set $B (call $uc_scratch))
        (call $uc_o3 (i32.const 4) (local.get $B) (local.get $Z) (local.get $Rv))
        (if (i32.lt_u (local.get $w) (i32.const 32))
          (then (call $uc_o3 (i32.const 9) (local.get $B) (local.get $B) (call $uc_aN (call $uc_mask (local.get $w))))))
        (call $uc_o5 (i32.const 28) (call $uc_aN (i32.const 2)) (local.get $Z) (local.get $B) (local.get $Rv) (local.get $sh))
        (return (i32.const 0))))
    (if (i32.eq (local.get $rk) (i32.const 9))
      (then
        ;; $set_flags_shift records 31; the 8/16-bit handlers then set 7/15.
        (call $uc_demand_add (i32.const 2) (i32.const 0) (local.get $m))
        (local.set $Rv (call $uc_valof (call $uc_pref (local.get $m) (i32.const 3) (local.get $md)) (local.get $w) (i32.const 0)))
        (call $uc_o5 (i32.const 28) (call $uc_aN (i32.const 7)) (local.get $Z) (call $uc_aT (i32.const 8) (local.get $m))
                     (local.get $Rv) (local.get $sh))
        (return (i32.const 0))))
    (if (i32.eq (local.get $rk) (i32.const 10))
      (then
        (call $uc_demand_add (i32.const 3) (i32.const 0) (local.get $m))
        (local.set $Rv (call $uc_valof (call $uc_pref (local.get $m) (i32.const 3) (local.get $md)) (i32.const 32) (i32.const 0)))
        (call $uc_o5 (i32.const 28) (call $uc_aN (i32.const 6)) (local.get $Z) (call $uc_aT (i32.const 9) (local.get $m))
                     (local.get $Rv) (call $uc_aN (i32.const 31)))
        (return (i32.const 0))))
    (i32.const 17))

  (func $uc_test_res (param $p i32) (param $d i32) (param $w i32) (result i64)
    (local $A i32) (local $B i32) (local $t i64) (local $x i64) (local $y i64)
    (local.set $A (call $uc_pref (local.get $p) (i32.const 1) (local.get $d)))
    (local.set $B (call $uc_pref (local.get $p) (i32.const 2) (local.get $d)))
    (if (i32.and (i32.and (i32.eqz (i32.load (local.get $A))) (i32.eqz (i32.load (local.get $B))))
                 (i32.and (i32.eq (i32.load offset=4 (local.get $A)) (i32.load offset=4 (local.get $B)))
                          (i32.eq (i32.load offset=12 (local.get $A)) (i32.load offset=12 (local.get $B)))))
      (then (return (call $uc_valof (local.get $A) (local.get $w) (i32.const 0)))))
    (local.set $t (call $uc_scratch))
    (if (i32.eq (i32.load (local.get $B)) (i32.const 2))
      (then
        (call $uc_o3 (i32.const 9) (local.get $t) (call $uc_valof (local.get $A) (local.get $w) (i32.const 0))
          (call $uc_aN (i32.and (i32.load offset=4 (local.get $B))
                                (select (i32.const -1) (call $uc_mask (local.get $w)) (i32.eq (local.get $w) (i32.const 32)))))))
      (else
        (local.set $x (call $uc_valof (local.get $A) (local.get $w) (i32.const 0)))
        (local.set $y (call $uc_valof (local.get $B) (local.get $w) (i32.const 0)))
        (call $uc_o3 (i32.const 5) (local.get $t) (local.get $x) (local.get $y))))
    (local.get $t))

  (func $uc_sext (param $w i32) (param $v i64) (result i64)
    (local $t i64)
    (if (i32.eq (local.get $w) (i32.const 32)) (then (return (local.get $v))))
    (local.set $t (call $uc_scratch))
    (call $uc_o2 (select (i32.const 47) (i32.const 48) (i32.eq (local.get $w) (i32.const 8))) (local.get $t) (local.get $v))
    (local.get $t))

  ;; Branch to `target` if condition cc holds in state (m, md, c, cd); srm is
  ;; the record state after a REC that already ran before the branch.
  (func $uc_cond (param $srm i32) (param $m i32) (param $md i32) (param $c i32) (param $cd i32)
      (param $cc i32) (param $target i64) (result i32)
    (local $rk i32) (local $w i32) (local $Z i64) (local $Bu i64) (local $Au i64) (local $hasA i32)
    (local $As i64) (local $Bs i64) (local $Rv i64) (local $t i64) (local $One i64)
    (if (i32.eq (local.get $m) (global.get $UC_G))
      (then (call $uc_o2 (i32.const 57) (call $uc_aN (local.get $cc)) (local.get $target)) (return (i32.const 0))))
    (if (i32.eq (local.get $m) (global.get $UC_D)) (then (return (i32.const 18))))
    (local.set $rk (call $uc_rkind (local.get $m)))
    (local.set $w (call $uc_rw (local.get $m)))
    (local.set $Z (call $uc_aC (i32.const 0)))
    (block $generic
      (if (i32.or (i32.eq (local.get $rk) (i32.const 2)) (i32.eq (local.get $rk) (i32.const 4)))
        (then
          (local.set $Bu (call $uc_valof (call $uc_pref (local.get $m) (i32.const 2) (local.get $md)) (local.get $w) (i32.const 0)))
          (if (i32.eq (local.get $rk) (i32.const 2))
            (then (local.set $Au (call $uc_valof (call $uc_pref (local.get $m) (i32.const 1) (local.get $md)) (local.get $w) (i32.const 0)))
                  (local.set $hasA (i32.const 1))))
          (if (i32.or (i32.eq (local.get $cc) (i32.const 4)) (i32.eq (local.get $cc) (i32.const 5)))
            (then
              (if (i32.eq (local.get $rk) (i32.const 4))
                (then
                  (local.set $Rv (call $uc_valof (call $uc_pref (local.get $m) (i32.const 3) (local.get $md)) (local.get $w) (i32.const 0)))
                  (call $uc_o2 (select (i32.const 21) (i32.const 22) (i32.eq (local.get $cc) (i32.const 5))) (local.get $Rv) (local.get $target))
                  (return (i32.const 0))))
              (call $uc_o3 (select (i32.const 51) (i32.const 23) (i32.eq (local.get $cc) (i32.const 4)))
                           (local.get $Au) (local.get $Bu) (local.get $target))
              (return (i32.const 0))))
          (if (i32.or (i32.or (i32.eq (local.get $cc) (i32.const 2)) (i32.eq (local.get $cc) (i32.const 3)))
                      (i32.or (i32.eq (local.get $cc) (i32.const 6)) (i32.eq (local.get $cc) (i32.const 7))))
            (then
              (if (i32.eqz (local.get $hasA))
                (then (local.set $Au (call $uc_aofsub (local.get $m) (local.get $md) (local.get $w) (local.get $Bu)))))
              (if (i32.eq (local.get $cc) (i32.const 2)) (then (call $uc_o3 (i32.const 24) (local.get $Au) (local.get $Bu) (local.get $target))))
              (if (i32.eq (local.get $cc) (i32.const 3)) (then (call $uc_o3 (i32.const 30) (local.get $Au) (local.get $Bu) (local.get $target))))
              (if (i32.eq (local.get $cc) (i32.const 6)) (then (call $uc_o3 (i32.const 30) (local.get $Bu) (local.get $Au) (local.get $target))))
              (if (i32.eq (local.get $cc) (i32.const 7)) (then (call $uc_o3 (i32.const 24) (local.get $Bu) (local.get $Au) (local.get $target))))
              (return (i32.const 0))))
          (if (i32.ge_u (local.get $cc) (i32.const 12))
            (then
              (if (i32.eq (local.get $w) (i32.const 32))
                (then
                  (local.set $Bs (local.get $Bu))
                  (local.set $As (if (result i64) (local.get $hasA) (then (local.get $Au))
                                   (else (call $uc_aofsub (local.get $m) (local.get $md) (local.get $w) (local.get $Bu))))))
                (else
                  (local.set $Bs (call $uc_valof (call $uc_pref (local.get $m) (i32.const 2) (local.get $md)) (local.get $w) (i32.const 1)))
                  (if (i32.eq (local.get $rk) (i32.const 2))
                    (then (local.set $As (call $uc_valof (call $uc_pref (local.get $m) (i32.const 1) (local.get $md)) (local.get $w) (i32.const 1))))
                    (else
                      (local.set $t (call $uc_aofsub (local.get $m) (local.get $md) (local.get $w) (local.get $Bu)))
                      (local.set $As (call $uc_scratch))
                      (call $uc_o2 (select (i32.const 47) (i32.const 48) (i32.eq (local.get $w) (i32.const 8))) (local.get $As) (local.get $t))))))
              (if (i32.eq (local.get $cc) (i32.const 12)) (then (call $uc_o3 (i32.const 52) (local.get $As) (local.get $Bs) (local.get $target))))
              (if (i32.eq (local.get $cc) (i32.const 13)) (then (call $uc_o3 (i32.const 53) (local.get $As) (local.get $Bs) (local.get $target))))
              (if (i32.eq (local.get $cc) (i32.const 14)) (then (call $uc_o3 (i32.const 53) (local.get $Bs) (local.get $As) (local.get $target))))
              (if (i32.eq (local.get $cc) (i32.const 15)) (then (call $uc_o3 (i32.const 52) (local.get $Bs) (local.get $As) (local.get $target))))
              (return (i32.const 0))))
          (if (i32.or (i32.eq (local.get $cc) (i32.const 8)) (i32.eq (local.get $cc) (i32.const 9)))
            (then
              (if (i32.eq (local.get $rk) (i32.const 4))
                (then (local.set $Rv (call $uc_valof (call $uc_pref (local.get $m) (i32.const 3) (local.get $md)) (local.get $w) (i32.const 0))))
                (else (local.set $Rv (call $uc_scratch))
                      (call $uc_o3 (i32.const 4) (local.get $Rv) (local.get $Au) (local.get $Bu))))
              (call $uc_sign (local.get $w) (local.get $Rv) (i32.eq (local.get $cc) (i32.const 9)) (local.get $Z) (local.get $target))
              (return (i32.const 0))))
          (br $generic)))
      (if (i32.or (i32.eq (local.get $rk) (i32.const 6)) (i32.eq (local.get $rk) (i32.const 7)))
        (then
          (local.set $Rv (call $uc_valof (call $uc_pref (local.get $m) (i32.const 3) (local.get $md)) (local.get $w) (i32.const 0)))
          (if (i32.or (i32.eq (local.get $cc) (i32.const 4)) (i32.eq (local.get $cc) (i32.const 5)))
            (then (call $uc_o2 (select (i32.const 21) (i32.const 22) (i32.eq (local.get $cc) (i32.const 5))) (local.get $Rv) (local.get $target))
                  (return (i32.const 0))))
          (if (i32.or (i32.eq (local.get $cc) (i32.const 8)) (i32.eq (local.get $cc) (i32.const 9)))
            (then (call $uc_sign (local.get $w) (local.get $Rv) (i32.eq (local.get $cc) (i32.const 9)) (local.get $Z) (local.get $target))
                  (return (i32.const 0))))
          (if (i32.and (i32.eq (local.get $rk) (i32.const 7)) (i32.ge_u (local.get $cc) (i32.const 12)))
            (then
              ;; flags of dec == flags of sub(A, 1) except CF
              (local.set $t (call $uc_scratch))
              (call $uc_o3 (i32.const 8) (local.get $t) (local.get $Rv) (call $uc_aN (i32.const 1)))
              (local.set $As (local.get $t))
              (if (i32.lt_u (local.get $w) (i32.const 32))
                (then (local.set $As (call $uc_scratch))
                      (call $uc_o2 (select (i32.const 47) (i32.const 48) (i32.eq (local.get $w) (i32.const 8))) (local.get $As) (local.get $t))))
              (local.set $One (call $uc_aC (i32.const 1)))
              (if (i32.eq (local.get $cc) (i32.const 12)) (then (call $uc_o3 (i32.const 52) (local.get $As) (local.get $One) (local.get $target))))
              (if (i32.eq (local.get $cc) (i32.const 13)) (then (call $uc_o3 (i32.const 53) (local.get $As) (local.get $One) (local.get $target))))
              (if (i32.eq (local.get $cc) (i32.const 14)) (then (call $uc_o3 (i32.const 53) (local.get $One) (local.get $As) (local.get $target))))
              (if (i32.eq (local.get $cc) (i32.const 15)) (then (call $uc_o3 (i32.const 52) (local.get $One) (local.get $As) (local.get $target))))
              (return (i32.const 0))))
          (br $generic)))
      (if (i32.eq (local.get $rk) (i32.const 3))
        (then
          (local.set $Rv (call $uc_valof (call $uc_pref (local.get $m) (i32.const 3) (local.get $md)) (local.get $w) (i32.const 0)))
          (if (i32.or (i32.eq (local.get $cc) (i32.const 4)) (i32.eq (local.get $cc) (i32.const 5)))
            (then (call $uc_o2 (select (i32.const 21) (i32.const 22) (i32.eq (local.get $cc) (i32.const 5))) (local.get $Rv) (local.get $target))
                  (return (i32.const 0))))
          (if (i32.or (i32.eq (local.get $cc) (i32.const 8)) (i32.eq (local.get $cc) (i32.const 9)))
            (then (call $uc_sign (local.get $w) (local.get $Rv) (i32.eq (local.get $cc) (i32.const 9)) (local.get $Z) (local.get $target))
                  (return (i32.const 0))))
          (if (i32.or (i32.eq (local.get $cc) (i32.const 2)) (i32.eq (local.get $cc) (i32.const 3)))
            (then
              (local.set $Bu (call $uc_valof (call $uc_pref (local.get $m) (i32.const 2) (local.get $md)) (local.get $w) (i32.const 0)))
              (call $uc_o3 (select (i32.const 24) (i32.const 30) (i32.eq (local.get $cc) (i32.const 2))) (local.get $Rv) (local.get $Bu) (local.get $target))
              (return (i32.const 0))))
          (br $generic)))
      (if (i32.or (i32.eq (local.get $rk) (i32.const 5)) (i32.eq (local.get $rk) (i32.const 1)))
        (then
          (local.set $Rv
            (if (result i64) (i32.eq (local.get $rk) (i32.const 1))
              (then (call $uc_test_res (local.get $m) (local.get $md) (local.get $w)))
              (else (call $uc_valof (call $uc_pref (local.get $m) (i32.const 3) (local.get $md)) (local.get $w) (i32.const 0)))))
          (if (i32.or (i32.eq (local.get $cc) (i32.const 4)) (i32.eq (local.get $cc) (i32.const 6)))
            (then (call $uc_o2 (i32.const 22) (local.get $Rv) (local.get $target)) (return (i32.const 0))))
          (if (i32.or (i32.eq (local.get $cc) (i32.const 5)) (i32.eq (local.get $cc) (i32.const 7)))
            (then (call $uc_o2 (i32.const 21) (local.get $Rv) (local.get $target)) (return (i32.const 0))))
          (if (i32.or (i32.eq (local.get $cc) (i32.const 8)) (i32.eq (local.get $cc) (i32.const 12)))
            (then (call $uc_sign (local.get $w) (local.get $Rv) (i32.const 0) (local.get $Z) (local.get $target)) (return (i32.const 0))))
          (if (i32.or (i32.eq (local.get $cc) (i32.const 9)) (i32.eq (local.get $cc) (i32.const 13)))
            (then (call $uc_sign (local.get $w) (local.get $Rv) (i32.const 1) (local.get $Z) (local.get $target)) (return (i32.const 0))))
          (if (i32.or (i32.eq (local.get $cc) (i32.const 3)) (i32.eq (local.get $cc) (i32.const 1)))
            (then (call $uc_o1 (i32.const 25) (local.get $target)) (return (i32.const 0))))
          (if (i32.or (i32.eq (local.get $cc) (i32.const 14)) (i32.eq (local.get $cc) (i32.const 15)))
            (then
              (local.set $t (call $uc_sext (local.get $w) (local.get $Rv)))
              (call $uc_o3 (select (i32.const 53) (i32.const 52) (i32.eq (local.get $cc) (i32.const 14)))
                           (local.get $Z) (local.get $t) (local.get $target))
              (return (i32.const 0))))
          (br $generic)))
      (if (i32.or (i32.eq (local.get $rk) (i32.const 8)) (i32.or (i32.eq (local.get $rk) (i32.const 9)) (i32.eq (local.get $rk) (i32.const 10))))
        (then
          (if (i32.or (i32.eq (local.get $cc) (i32.const 4)) (i32.eq (local.get $cc) (i32.const 5)))
            (then
              (local.set $Rv (call $uc_valof (call $uc_pref (local.get $m) (i32.const 3) (local.get $md)) (local.get $w) (i32.const 0)))
              (call $uc_o2 (select (i32.const 21) (i32.const 22) (i32.eq (local.get $cc) (i32.const 5))) (local.get $Rv) (local.get $target))
              (return (i32.const 0))))
          (br $generic))))
    ;; generic: the record, then BCC on it
    (if (i32.ne (local.get $srm) (global.get $UC_G))
      (then
        (local.set $rk (call $uc_rec (local.get $m) (local.get $md) (local.get $c) (local.get $cd)))
        (if (local.get $rk) (then (return (local.get $rk))))))
    (call $uc_o2 (i32.const 57) (call $uc_aN (local.get $cc)) (local.get $target))
    (i32.const 0))

  ;; branch on the sign of v (at width w)
  (func $uc_sign (param $w i32) (param $v i64) (param $neg i32) (param $Z i64) (param $target i64)
    (local $t i64)
    (local.set $t (call $uc_sext (local.get $w) (local.get $v)))
    (call $uc_o3 (select (i32.const 53) (i32.const 52) (local.get $neg)) (local.get $t) (local.get $Z) (local.get $target)))

  ;; setcc: condition cc of state (m, md, c, cd) as 0/1 into vreg d. The
  ;; forwarded forms mirror $uc_cond's, with SLTU/SLT for its compare-branches
  ;; (a setcc is no x86 transfer, so it must not spend a block the way a
  ;; branch op does); anything else writes the record and reads it back.
  (func $uc_setv (param $m i32) (param $md i32) (param $c i32) (param $cd i32)
      (param $cc i32) (param $d i64) (result i32)
    (local $rk i32) (local $w i32) (local $Z i64) (local $One i64) (local $Bu i64) (local $Au i64)
    (local $hasA i32) (local $As i64) (local $Bs i64) (local $Rv i64) (local $t i64) (local $inv i32)
    (local $err i32)
    (if (i32.eq (local.get $m) (global.get $UC_D)) (then (return (i32.const 18))))
    (local.set $Z (call $uc_aC (i32.const 0)))
    (local.set $One (call $uc_aC (i32.const 1)))
    ;; odd cc is the negation of the even one below it
    (local.set $inv (i32.and (local.get $cc) (i32.const 1)))
    (block $generic
      (br_if $generic (i32.eq (local.get $m) (global.get $UC_G)))
      (local.set $rk (call $uc_rkind (local.get $m)))
      (local.set $w (call $uc_rw (local.get $m)))
      (if (i32.or (i32.eq (local.get $rk) (i32.const 2)) (i32.eq (local.get $rk) (i32.const 4)))
        (then
          (local.set $Bu (call $uc_valof (call $uc_pref (local.get $m) (i32.const 2) (local.get $md)) (local.get $w) (i32.const 0)))
          (if (i32.eq (local.get $rk) (i32.const 2))
            (then (local.set $Au (call $uc_valof (call $uc_pref (local.get $m) (i32.const 1) (local.get $md)) (local.get $w) (i32.const 0)))
                  (local.set $hasA (i32.const 1))))
          (block $done
            ;; z / nz: the difference is zero
            (if (i32.or (i32.eq (local.get $cc) (i32.const 4)) (i32.eq (local.get $cc) (i32.const 5)))
              (then
                (if (i32.eq (local.get $rk) (i32.const 4))
                  (then (local.set $t (call $uc_valof (call $uc_pref (local.get $m) (i32.const 3) (local.get $md)) (local.get $w) (i32.const 0))))
                  (else (local.set $t (call $uc_scratch))
                        (call $uc_o3 (i32.const 7) (local.get $t) (local.get $Au) (local.get $Bu))))
                (call $uc_o3 (i32.const 54) (local.get $d) (local.get $t) (local.get $One))
                (br $done)))
            ;; b / ae: A <u B;  be / a: B <u A negated / not
            (if (i32.or (i32.or (i32.eq (local.get $cc) (i32.const 2)) (i32.eq (local.get $cc) (i32.const 3)))
                        (i32.or (i32.eq (local.get $cc) (i32.const 6)) (i32.eq (local.get $cc) (i32.const 7))))
              (then
                (if (i32.eqz (local.get $hasA))
                  (then (local.set $Au (call $uc_aofsub (local.get $m) (local.get $md) (local.get $w) (local.get $Bu)))))
                (if (i32.lt_u (local.get $cc) (i32.const 4))
                  (then (call $uc_o3 (i32.const 54) (local.get $d) (local.get $Au) (local.get $Bu)))
                  (else (call $uc_o3 (i32.const 54) (local.get $d) (local.get $Bu) (local.get $Au))
                        (local.set $inv (i32.eqz (local.get $inv)))))
                (br $done)))
            ;; l / ge: A <s B;  le / g: B <s A negated / not
            (if (i32.ge_u (local.get $cc) (i32.const 12))
              (then
                (if (i32.eq (local.get $w) (i32.const 32))
                  (then
                    (local.set $Bs (local.get $Bu))
                    (local.set $As (if (result i64) (local.get $hasA) (then (local.get $Au))
                                     (else (call $uc_aofsub (local.get $m) (local.get $md) (local.get $w) (local.get $Bu))))))
                  (else
                    (local.set $Bs (call $uc_valof (call $uc_pref (local.get $m) (i32.const 2) (local.get $md)) (local.get $w) (i32.const 1)))
                    (if (i32.eq (local.get $rk) (i32.const 2))
                      (then (local.set $As (call $uc_valof (call $uc_pref (local.get $m) (i32.const 1) (local.get $md)) (local.get $w) (i32.const 1))))
                      (else
                        (local.set $t (call $uc_aofsub (local.get $m) (local.get $md) (local.get $w) (local.get $Bu)))
                        (local.set $As (call $uc_sext (local.get $w) (local.get $t)))))))
                (if (i32.lt_u (local.get $cc) (i32.const 14))
                  (then (call $uc_o3 (i32.const 61) (local.get $d) (local.get $As) (local.get $Bs)))
                  (else (call $uc_o3 (i32.const 61) (local.get $d) (local.get $Bs) (local.get $As))
                        (local.set $inv (i32.eqz (local.get $inv)))))
                (br $done)))
            ;; s / ns: the sign of the difference
            (if (i32.or (i32.eq (local.get $cc) (i32.const 8)) (i32.eq (local.get $cc) (i32.const 9)))
              (then
                (if (i32.eq (local.get $rk) (i32.const 4))
                  (then (local.set $Rv (call $uc_valof (call $uc_pref (local.get $m) (i32.const 3) (local.get $md)) (local.get $w) (i32.const 0))))
                  (else (local.set $Rv (call $uc_scratch))
                        (call $uc_o3 (i32.const 4) (local.get $Rv) (local.get $Au) (local.get $Bu))))
                (call $uc_o3 (i32.const 61) (local.get $d) (call $uc_sext (local.get $w) (local.get $Rv)) (local.get $Z))
                (br $done)))
            (br $generic))
          (if (local.get $inv) (then (call $uc_o3 (i32.const 42) (local.get $d) (local.get $d) (call $uc_aN (i32.const 1)))))
          (return (i32.const 0))))
      ;; logic / test (CF = OF = 0), inc / dec / add (ZF, SF from the result)
      (if (i32.or (i32.or (i32.eq (local.get $rk) (i32.const 5)) (i32.eq (local.get $rk) (i32.const 1)))
                  (i32.or (i32.or (i32.eq (local.get $rk) (i32.const 6)) (i32.eq (local.get $rk) (i32.const 7)))
                          (i32.eq (local.get $rk) (i32.const 3))))
        (then
          (local.set $Rv
            (if (result i64) (i32.eq (local.get $rk) (i32.const 1))
              (then (call $uc_test_res (local.get $m) (local.get $md) (local.get $w)))
              (else (call $uc_valof (call $uc_pref (local.get $m) (i32.const 3) (local.get $md)) (local.get $w) (i32.const 0)))))
          (block $done2
            (if (i32.or (i32.eq (local.get $cc) (i32.const 4)) (i32.eq (local.get $cc) (i32.const 5)))
              (then (call $uc_o3 (i32.const 54) (local.get $d) (local.get $Rv) (local.get $One)) (br $done2)))
            (if (i32.or (i32.eq (local.get $cc) (i32.const 8)) (i32.eq (local.get $cc) (i32.const 9)))
              (then (call $uc_o3 (i32.const 61) (local.get $d) (call $uc_sext (local.get $w) (local.get $Rv)) (local.get $Z))
                    (br $done2)))
            ;; the rest need CF = OF = 0: logic and test only
            (br_if $generic (i32.eqz (i32.or (i32.eq (local.get $rk) (i32.const 5)) (i32.eq (local.get $rk) (i32.const 1)))))
            ;; be == z, a == nz
            (if (i32.or (i32.eq (local.get $cc) (i32.const 6)) (i32.eq (local.get $cc) (i32.const 7)))
              (then (call $uc_o3 (i32.const 54) (local.get $d) (local.get $Rv) (local.get $One)) (br $done2)))
            ;; l == s, ge == ns
            (if (i32.or (i32.eq (local.get $cc) (i32.const 12)) (i32.eq (local.get $cc) (i32.const 13)))
              (then (call $uc_o3 (i32.const 61) (local.get $d) (call $uc_sext (local.get $w) (local.get $Rv)) (local.get $Z))
                    (br $done2)))
            ;; le == (r <=s 0), g its negation
            (if (i32.or (i32.eq (local.get $cc) (i32.const 14)) (i32.eq (local.get $cc) (i32.const 15)))
              (then (call $uc_o3 (i32.const 61) (local.get $d) (call $uc_sext (local.get $w) (local.get $Rv)) (local.get $One))
                    (br $done2)))
            ;; o / no, b / ae: CF and OF are 0
            (if (i32.lt_u (local.get $cc) (i32.const 4))
              (then (call $uc_o2 (i32.const 1) (local.get $d) (call $uc_aN (i32.const 0))) (br $done2)))
            (br $generic))
          (if (local.get $inv) (then (call $uc_o3 (i32.const 42) (local.get $d) (local.get $d) (call $uc_aN (i32.const 1)))))
          (return (i32.const 0)))))
    ;; generic: the record, then $eval_cc on it
    (local.set $err (call $uc_rec (local.get $m) (local.get $md) (local.get $c) (local.get $cd)))
    (if (local.get $err) (then (return (local.get $err))))
    (call $uc_o2 (i32.const 66) (local.get $d) (call $uc_aN (local.get $cc)))
    (i32.const 0))

  ;; ---- stubs ----
  ;; Stub record (32 bytes): +0 kind (0 deopt to eip, 1 budget 'to' eip,
  ;; 2 budget at a Jcc) +4 eip | cc +8 taken +12 next +16 m +20 md +24 c +28 cd.
  ;; Its label is (5, index); a Jcc budget stub's taken arm is (6, index).
  (func $uc_stub_get (param $kind i32) (param $f1 i32) (param $f2 i32) (param $f3 i32)
      (param $m i32) (param $md i32) (param $c i32) (param $cd i32) (result i64)
    (local $M i32) (local $cap i32) (local $st i32) (local $h i32) (local $e i32) (local $i i32)
    (local $S i32) (local $k i64)
    (local.set $M (global.get $UC_HM_STUB))
    (local.set $cap (i32.load (local.get $M)))
    (local.set $st (i32.load offset=4 (local.get $M)))
    (local.set $k (i64.xor (i64.xor (i64.extend_i32_u (local.get $kind))
                                    (i64.mul (i64.extend_i32_u (local.get $f1)) (i64.const 0x100000001B3)))
                           (i64.xor (i64.mul (i64.extend_i32_u (local.get $f2)) (i64.const 0xC2B2AE3D27D4EB4F))
                                    (i64.mul (i64.extend_i32_u (local.get $f3)) (i64.const 0x165667B19E3779F9)))))
    (local.set $k (i64.xor (local.get $k)
      (i64.xor (i64.xor (i64.mul (i64.extend_i32_u (local.get $m)) (i64.const 0x27D4EB2F165667C5))
                        (i64.mul (i64.extend_i32_u (local.get $md)) (i64.const 0x85EBCA77C2B2AE63)))
               (i64.xor (i64.mul (i64.extend_i32_u (local.get $c)) (i64.const 0x94D049BB133111EB))
                        (i64.mul (i64.extend_i32_u (local.get $cd)) (i64.const 0xBF58476D1CE4E5B9))))))
    (local.set $h (call $uc_hash (local.get $k) (local.get $cap)))
    (loop $l
      (local.set $e (i32.add (i32.add (local.get $M) (i32.const 16)) (i32.shl (local.get $h) (i32.const 4))))
      (if (i32.eq (i32.load offset=12 (local.get $e)) (local.get $st))
        (then
          (local.set $i (i32.load offset=8 (local.get $e)))
          (local.set $S (i32.add (global.get $UC_STUB) (i32.shl (local.get $i) (i32.const 5))))
          (if (i32.and
                (i32.and (i32.and (i32.eq (i32.load (local.get $S)) (local.get $kind))
                                  (i32.eq (i32.load offset=4 (local.get $S)) (local.get $f1)))
                         (i32.and (i32.eq (i32.load offset=8 (local.get $S)) (local.get $f2))
                                  (i32.eq (i32.load offset=12 (local.get $S)) (local.get $f3))))
                (i32.and (i32.and (i32.eq (i32.load offset=16 (local.get $S)) (local.get $m))
                                  (i32.eq (i32.load offset=20 (local.get $S)) (local.get $md)))
                         (i32.and (i32.eq (i32.load offset=24 (local.get $S)) (local.get $c))
                                  (i32.eq (i32.load offset=28 (local.get $S)) (local.get $cd)))))
            (then (return (call $uc_aL (i32.const 5) (local.get $i)))))
          (local.set $h (i32.and (i32.add (local.get $h) (i32.const 1)) (i32.sub (local.get $cap) (i32.const 1))))
          (br $l))))
    (if (i32.or (i32.ge_u (global.get $uc_nstubs) (global.get $UC_MAX_STUBS))
                (i32.ge_u (i32.shl (i32.load offset=8 (local.get $M)) (i32.const 2)) (i32.mul (local.get $cap) (i32.const 3))))
      (then (call $uc_fail (i32.const 26)) (return (call $uc_aL (i32.const 5) (i32.const 0)))))
    (local.set $i (global.get $uc_nstubs))
    (global.set $uc_nstubs (i32.add (local.get $i) (i32.const 1)))
    (local.set $S (i32.add (global.get $UC_STUB) (i32.shl (local.get $i) (i32.const 5))))
    (i32.store (local.get $S) (local.get $kind))
    (i32.store offset=4 (local.get $S) (local.get $f1))
    (i32.store offset=8 (local.get $S) (local.get $f2))
    (i32.store offset=12 (local.get $S) (local.get $f3))
    (i32.store offset=16 (local.get $S) (local.get $m))
    (i32.store offset=20 (local.get $S) (local.get $md))
    (i32.store offset=24 (local.get $S) (local.get $c))
    (i32.store offset=28 (local.get $S) (local.get $cd))
    (i64.store (local.get $e) (local.get $k))
    (i32.store offset=8 (local.get $e) (local.get $i))
    (i32.store offset=12 (local.get $e) (local.get $st))
    (i32.store offset=8 (local.get $M) (i32.add (i32.load offset=8 (local.get $M)) (i32.const 1)))
    (call $uc_aL (i32.const 5) (local.get $i)))

  ;; The deopt stub of the instruction being lowered (re-executes it).
  (func $uc_xstub (result i64)
    (call $uc_stub_get (i32.const 0) (global.get $uc_x_eip) (i32.const 0) (i32.const 0)
      (global.get $uc_x_m) (global.get $uc_x_md) (global.get $uc_x_c) (global.get $uc_x_cd)))

  (func $uc_inline_stub (param $eip i32) (param $m i32) (param $md i32) (param $c i32) (param $cd i32) (result i32)
    (local $err i32) (local $w i32)
    (local.set $err (call $uc_rec (local.get $m) (local.get $md) (local.get $c) (local.get $cd)))
    (if (local.get $err) (then (return (local.get $err))))
    (local.set $w (call $uc_exit_work (local.get $eip)))
    (if (local.get $w) (then (call $uc_o1 (i32.const 84) (call $uc_aN (local.get $w)))))
    (call $uc_o1 (i32.const 0) (call $uc_aN (local.get $eip)))
    (i32.const 0))

  ;; Out of budget at a charged transfer: materialize the IN flags, take the
  ;; transfer, and EXITB at wherever it went.
  (func $uc_flush_stubs (result i32)
    (local $k i32) (local $S i32) (local $err i32)
    (block $d (loop $l
      (br_if $d (i32.ge_u (local.get $k) (global.get $uc_nstubs)))
      (global.set $uc_rsp (i32.const 0))
      (local.set $S (i32.add (global.get $UC_STUB) (i32.shl (local.get $k) (i32.const 5))))
      (call $uc_label (call $uc_aL (i32.const 5) (local.get $k)))
      ;; leaving before an instruction some elided push is still open across:
      ;; give the slot its memory back first
      (if (i32.lt_u (i32.load (local.get $S)) (i32.const 2))
        (then (call $uc_spill_at (i32.load offset=4 (local.get $S)))))
      (if (i32.eqz (i32.load (local.get $S)))
        (then
          (local.set $err (call $uc_inline_stub (i32.load offset=4 (local.get $S))
            (i32.load offset=16 (local.get $S)) (i32.load offset=20 (local.get $S))
            (i32.load offset=24 (local.get $S)) (i32.load offset=28 (local.get $S))))
          (if (local.get $err) (then (return (local.get $err)))))
        (else
          (local.set $err (call $uc_rec (i32.load offset=16 (local.get $S)) (i32.load offset=20 (local.get $S))
                                        (i32.load offset=24 (local.get $S)) (i32.load offset=28 (local.get $S))))
          (if (local.get $err) (then (return (local.get $err))))
          (if (i32.eq (i32.load (local.get $S)) (i32.const 1))
            (then (call $uc_o1 (i32.const 63) (call $uc_aN (i32.load offset=4 (local.get $S)))))
            (else
              (call $uc_o2 (i32.const 57) (call $uc_aN (i32.load offset=4 (local.get $S))) (call $uc_aL (i32.const 6) (local.get $k)))
              (call $uc_o1 (i32.const 63) (call $uc_aN (i32.load offset=12 (local.get $S))))
              (call $uc_label (call $uc_aL (i32.const 6) (local.get $k)))
              (call $uc_o1 (i32.const 63) (call $uc_aN (i32.load offset=8 (local.get $S))))))))
      (local.set $k (i32.add (local.get $k) (i32.const 1)))
      (br $l)))
    (i32.const 0))

  ;; ---- the program ----
  ;; Copies: +0x0D00 in $UC_MISC, 16 bytes each: +0 label kind (1 peeled,
  ;; 2 steady) +4 flow slot +8 peel.

  (func $uc_check (param $kind i32) (param $f1 i32) (param $f2 i32) (param $f3 i32) (result i32)
    (if (i32.or (i32.eq (global.get $uc_sm) (global.get $UC_D)) (i32.eq (global.get $uc_sc) (global.get $UC_D)))
      (then (return (i32.const 11))))
    (call $uc_o1 (i32.const 58)
      (call $uc_stub_get (local.get $kind) (local.get $f1) (local.get $f2) (local.get $f3)
        (global.get $uc_sm) (global.get $uc_smd) (global.get $uc_sc) (global.get $uc_scd)))
    (i32.const 0))

  ;; RET with its candidate return addresses (kind 24, $uc_ret_targets): pop
  ;; the address, and for each candidate it equals, release the slot (and
  ;; imm16), spend the block and go there. Any other address deopts back to
  ;; the threaded ret, ESP untouched, so the program never assumes where a
  ;; ret goes. In state (m md c cd); ESP is written after the compare.
  (func $uc_emit_ret (param $R i32) (param $pfx i32) (param $peel i32) (param $rae i32)
      (param $m i32) (param $md i32) (param $c i32) (param $cd i32) (result i32)
    (local $t i64) (local $d i64) (local $j i32) (local $n i32) (local $cand i32)
    (local $alt i64) (local $dest i64) (local $err i32)
    (local.set $t (call $uc_scratch))
    (call $uc_load (i32.add (local.get $R) (i32.const 80)) (i32.const 32) (i32.const 0) (local.get $t))
    (local.set $n (call $uc_nsucc (local.get $R)))
    (local.set $md (i32.or (local.get $md) (i32.const 16)))
    (local.set $cd (i32.or (local.get $cd) (i32.const 16)))
    (block $d (loop $l
      (br_if $d (i32.ge_u (local.get $j) (local.get $n)))
      (local.set $cand (call $uc_succ (local.get $R) (local.get $j)))
      (local.set $d (call $uc_scratch))
      (call $uc_o3 (i32.const 42) (local.get $d) (local.get $t) (call $uc_aN (local.get $cand)))
      (local.set $alt (call $uc_aL (i32.add (local.get $pfx) (i32.const 6))
                                   (i32.add (i32.load (local.get $R)) (local.get $j))))
      (call $uc_o2 (i32.const 64) (local.get $d)
        (if (result i64) (i32.lt_u (i32.add (local.get $j) (i32.const 1)) (local.get $n))
          (then (local.get $alt)) (else (call $uc_xstub))))
      (call $uc_o3 (i32.const 8) (call $uc_aR (i32.const 4)) (call $uc_aR (i32.const 4))
                   (call $uc_aN (i32.add (i32.const 4) (i32.load offset=28 (local.get $R)))))
      (global.set $uc_sm (local.get $m)) (global.set $uc_smd (local.get $md))
      (global.set $uc_sc (local.get $c)) (global.set $uc_scd (local.get $cd))
      (local.set $err (call $uc_check (i32.const 1) (local.get $cand) (i32.const 0) (i32.const 0)))
      (if (local.get $err) (then (return (local.get $err))))
      (if (local.get $rae)
        (then (local.set $err (call $uc_rec (local.get $m) (local.get $md) (local.get $c) (local.get $cd)))
              (if (local.get $err) (then (return (local.get $err))))))
      (local.set $dest
        (if (result i64) (call $uc_in_loop (local.get $cand))
          (then (call $uc_aL (call $uc_lab (local.get $pfx) (local.get $peel) (local.get $cand)) (local.get $cand)))
          (else (call $uc_stub_get (i32.const 0) (local.get $cand) (i32.const 0) (i32.const 0)
                  (select (global.get $UC_G) (local.get $m) (local.get $rae))
                  (select (i32.const 0) (local.get $md) (local.get $rae))
                  (select (global.get $UC_G) (local.get $c) (local.get $rae))
                  (select (i32.const 0) (local.get $cd) (local.get $rae))))))
      (call $uc_o1 (i32.const 25) (local.get $dest))
      (if (i32.lt_u (i32.add (local.get $j) (i32.const 1)) (local.get $n))
        (then (call $uc_label (local.get $alt))))
      (local.set $j (i32.add (local.get $j) (i32.const 1)))
      (br $l)))
    (i32.const 0))

  ;; A table jump (kind 28, $uc_jt_targets): load the entry, then
  ;;   JTBL idx n x ; GOTO arm0 ... GOTO arm(n-1)
  ;; and arm i re-checks that the entry still holds what the table held at
  ;; compile time, spends the block and goes there. An index past n, a
  ;; rewritten entry or a load outside the window deopts to the threaded
  ;; op at the jump, which reads the table itself. In state (m md c cd).
  (func $uc_emit_jtbl (param $R i32) (param $pfx i32) (param $peel i32) (param $rae i32)
      (param $m i32) (param $md i32) (param $c i32) (param $cd i32) (result i32)
    (local $t i64) (local $d i64) (local $j i32) (local $n i32) (local $cand i32)
    (local $base i32) (local $dest i64) (local $err i32) (local $tbl i32)
    (local.set $t (call $uc_scratch))
    (call $uc_load (i32.add (local.get $R) (i32.const 56)) (i32.const 32) (i32.const 0) (local.get $t))
    (local.set $n (i32.load offset=140 (local.get $R)))
    (local.set $tbl (i32.load offset=72 (local.get $R)))
    (local.set $base (global.get $uc_nlocal))
    (global.set $uc_nlocal (i32.add (global.get $uc_nlocal) (local.get $n)))
    (call $uc_o3 (i32.const 81) (call $uc_aR (i32.load offset=64 (local.get $R))) (call $uc_aN (local.get $n))
                 (call $uc_xstub))
    (local.set $j (i32.const 0))
    (block $gd (loop $gl
      (br_if $gd (i32.ge_u (local.get $j) (local.get $n)))
      (call $uc_o1 (i32.const 62) (call $uc_aL (i32.const 7) (i32.add (local.get $base) (local.get $j))))
      (local.set $j (i32.add (local.get $j) (i32.const 1)))
      (br $gl)))
    (local.set $j (i32.const 0))
    (block $d (loop $l
      (br_if $d (i32.ge_u (local.get $j) (local.get $n)))
      (call $uc_label (call $uc_aL (i32.const 7) (i32.add (local.get $base) (local.get $j))))
      (local.set $cand (call $uc_rd32 (i32.add (local.get $tbl) (i32.shl (local.get $j) (i32.const 2)))))
      (local.set $d (call $uc_scratch))
      (call $uc_o3 (i32.const 42) (local.get $d) (local.get $t) (call $uc_aN (local.get $cand)))
      (call $uc_o2 (i32.const 64) (local.get $d) (call $uc_xstub))
      (global.set $uc_sm (local.get $m)) (global.set $uc_smd (local.get $md))
      (global.set $uc_sc (local.get $c)) (global.set $uc_scd (local.get $cd))
      (local.set $err (call $uc_check (i32.const 1) (local.get $cand) (i32.const 0) (i32.const 0)))
      (if (local.get $err) (then (return (local.get $err))))
      (if (local.get $rae)
        (then (local.set $err (call $uc_rec (local.get $m) (local.get $md) (local.get $c) (local.get $cd)))
              (if (local.get $err) (then (return (local.get $err))))))
      (local.set $dest
        (if (result i64) (call $uc_in_loop (local.get $cand))
          (then (call $uc_aL (call $uc_lab (local.get $pfx) (local.get $peel) (local.get $cand)) (local.get $cand)))
          (else (call $uc_stub_get (i32.const 0) (local.get $cand) (i32.const 0) (i32.const 0)
                  (select (global.get $UC_G) (local.get $m) (local.get $rae))
                  (select (i32.const 0) (local.get $md) (local.get $rae))
                  (select (global.get $UC_G) (local.get $c) (local.get $rae))
                  (select (i32.const 0) (local.get $cd) (local.get $rae))))))
      (call $uc_o1 (i32.const 25) (local.get $dest))
      (local.set $j (i32.add (local.get $j) (i32.const 1)))
      (br $l)))
    (i32.const 0))

  (func $uc_emit_program (result i32)
    (local $ci i32) (local $cp i32) (local $pfx i32) (local $F i32) (local $peel i32)
    (local $k i32) (local $B i32) (local $n i32) (local $R i32) (local $pos i32) (local $last i32)
    (local $err i32) (local $next i64) (local $l i64) (local $rae i32) (local $dest i64)
    (local $m i32) (local $md i32) (local $c i32) (local $cd i32) (local $am i32) (local $amd i32)
    (local $ac i32) (local $acd i32) (local $tgt i32) (local $nx i32) (local $t i32)
    (block $cdone (loop $cloop
      (br_if $cdone (i32.ge_u (local.get $ci) (global.get $uc_ncopies)))
      (local.set $cp (i32.add (i32.add (global.get $UC_MISC) (i32.const 0xD00)) (i32.shl (local.get $ci) (i32.const 4))))
      (local.set $pfx (i32.load (local.get $cp)))
      (local.set $F (i32.load offset=4 (local.get $cp)))
      (local.set $peel (i32.load offset=8 (local.get $cp)))
      (local.set $k (i32.const 0))
      (block $bdone (loop $bloop
        (br_if $bdone (i32.ge_u (local.get $k) (global.get $uc_nblk)))
        (local.set $B (call $uc_blk (local.get $k)))
        (local.set $next (i64.const 0))
        (if (i32.lt_u (i32.add (local.get $k) (i32.const 1)) (global.get $uc_nblk))
          (then (local.set $next (call $uc_aL (local.get $pfx) (i32.load (call $uc_blk (i32.add (local.get $k) (i32.const 1))))))))
        (call $uc_label (call $uc_aL (local.get $pfx) (i32.load (local.get $B))))
        (local.set $rae (i32.load (i32.add (i32.add (local.get $F) (i32.const 0x5000)) (i32.shl (local.get $k) (i32.const 2)))))
        (local.set $n (i32.const 0))
        (block $idone (loop $iloop
          (br_if $idone (i32.ge_u (local.get $n) (i32.load offset=8 (local.get $B))))
          (global.set $uc_rsp (i32.const 0))
          (local.set $pos (i32.add (i32.load offset=4 (local.get $B)) (local.get $n)))
          (local.set $R (call $uc_loop_insn (local.get $pos)))
          (call $uc_state_load (i32.add (i32.add (local.get $F) (i32.const 0x5800)) (i32.shl (local.get $pos) (i32.const 4))))
          (local.set $m (global.get $uc_sm)) (local.set $md (global.get $uc_smd))
          (local.set $c (global.get $uc_sc)) (local.set $cd (global.get $uc_scd))
          (global.set $uc_x_eip (i32.load (local.get $R)))
          (global.set $uc_x_m (local.get $m)) (global.set $uc_x_md (local.get $md))
          (global.set $uc_x_c (local.get $c)) (global.set $uc_x_cd (local.get $cd))
          (local.set $last (i32.eq (local.get $n) (i32.sub (i32.load offset=8 (local.get $B)) (i32.const 1))))
          (if (call $uc_flag (local.get $R) (i32.const 4))
            (then
              (local.set $err (call $uc_check (i32.const 1) (i32.load (local.get $R)) (i32.const 0) (i32.const 0)))
              (if (local.get $err) (then (return (local.get $err))))
              (local.set $l (call $uc_aL (i32.add (local.get $pfx) (i32.const 2)) (i32.load (local.get $R))))
              (call $uc_o1 (i32.const 25) (local.get $l))
              (call $uc_label (local.get $l))))
          ;; a run of dword mov pairs: one MCOPY (§21.4)
          (local.set $t (call $uc_try_mcopy (local.get $B) (local.get $n)))
          (if (local.get $t)
            (then (if (global.get $uc_err) (then (return (global.get $uc_err))))
                  (local.set $n (i32.add (local.get $n) (local.get $t)))
                  (br $iloop)))
          (local.set $tgt (i32.load offset=24 (local.get $R)))
          (local.set $nx (i32.load offset=4 (local.get $R)))
          (if (call $uc_is_branch (local.get $R))
            (then
              (if (i32.eqz (local.get $last)) (then (return (i32.const 10))))
              (if (i32.eq (call $uc_kind (local.get $R)) (i32.const 28))
                (then
                  (local.set $err (call $uc_emit_jtbl (local.get $R) (local.get $pfx) (local.get $peel) (local.get $rae)
                                                      (local.get $m) (local.get $md) (local.get $c) (local.get $cd)))
                  (if (local.get $err) (then (return (local.get $err))))
                  (local.set $n (i32.add (local.get $n) (i32.const 1)))
                  (br $iloop)))
              (if (i32.eq (call $uc_kind (local.get $R)) (i32.const 24))
                (then
                  (local.set $err (call $uc_emit_ret (local.get $R) (local.get $pfx) (local.get $peel) (local.get $rae)
                                                     (local.get $m) (local.get $md) (local.get $c) (local.get $cd)))
                  (if (local.get $err) (then (return (local.get $err))))
                  (local.set $n (i32.add (local.get $n) (i32.const 1)))
                  (br $iloop)))
              ;; call: push the return address, then it is a jmp with ESP
              ;; written
              (if (i32.eq (call $uc_kind (local.get $R)) (i32.const 23))
                (then
                  ;; FF /2: the slot must still hold the target followed at
                  ;; compile time; anything else leaves at the call, with the
                  ;; entry flags, before the push
                  (if (i32.load offset=12 (local.get $R))
                    (then
                      (call $uc_emit (i32.const 71) (i32.const 5)
                            (call $uc_rawof (call $uc_read (i32.add (local.get $R) (i32.const 104)) (local.get $R) (i32.const 1)))
                            (call $uc_aN (local.get $tgt))
                            (call $uc_aN (i32.sub (i32.load offset=12 (local.get $R)) (i32.const 1)))
                            (call $uc_aN (i32.load (local.get $R)))
                            (call $uc_xstub) (i64.const 0) (i64.const 0))))
                  (call $uc_store (i32.add (local.get $R) (i32.const 80)) (i32.const 32) (call $uc_aC (local.get $nx)))
                  (call $uc_o3 (i32.const 8) (call $uc_aR (i32.const 4)) (call $uc_aR (i32.const 4)) (call $uc_aN (i32.const -4)))
                  (local.set $md (i32.or (local.get $md) (i32.const 16)))
                  (local.set $cd (i32.or (local.get $cd) (i32.const 16)))
                  (global.set $uc_smd (local.get $md))
                  (global.set $uc_scd (local.get $cd))))
              (local.set $err
                (if (result i32) (i32.or (i32.eq (call $uc_kind (local.get $R)) (i32.const 16))
                                         (i32.eq (call $uc_kind (local.get $R)) (i32.const 23)))
                  (then (call $uc_check (i32.const 1) (local.get $tgt) (i32.const 0) (i32.const 0)))
                  (else (call $uc_check (i32.const 2) (i32.load offset=20 (local.get $R)) (local.get $tgt) (local.get $nx)))))
              (if (local.get $err) (then (return (local.get $err))))
              (if (local.get $rae)
                (then (local.set $err (call $uc_rec (local.get $m) (local.get $md) (local.get $c) (local.get $cd)))
                      (if (local.get $err) (then (return (local.get $err))))))
              (local.set $am (select (global.get $UC_G) (local.get $m) (local.get $rae)))
              (local.set $amd (select (i32.const 0) (local.get $md) (local.get $rae)))
              (local.set $ac (select (global.get $UC_G) (local.get $c) (local.get $rae)))
              (local.set $acd (select (i32.const 0) (local.get $cd) (local.get $rae)))
              (local.set $dest
                (if (result i64) (call $uc_in_loop (local.get $tgt))
                  (then (call $uc_aL (call $uc_lab (local.get $pfx) (local.get $peel) (local.get $tgt)) (local.get $tgt)))
                  (else (call $uc_stub_get (i32.const 0) (local.get $tgt) (i32.const 0) (i32.const 0)
                                           (local.get $am) (local.get $amd) (local.get $ac) (local.get $acd)))))
              (if (i32.or (i32.eq (call $uc_kind (local.get $R)) (i32.const 16))
                          (i32.eq (call $uc_kind (local.get $R)) (i32.const 23)))
                (then (call $uc_o1 (i32.const 25) (local.get $dest))
                      (local.set $n (i32.add (local.get $n) (i32.const 1)))
                      (br $iloop)))
              (local.set $err (call $uc_cond (local.get $am) (local.get $m) (local.get $md) (local.get $c) (local.get $cd)
                                             (i32.load offset=20 (local.get $R)) (local.get $dest)))
              (if (local.get $err) (then (return (local.get $err))))
              (if (call $uc_in_loop (local.get $nx))
                (then (call $uc_goto (local.get $pfx) (local.get $peel) (local.get $nx) (local.get $next)))
                (else (local.set $err (call $uc_inline_stub (local.get $nx) (local.get $am) (local.get $amd) (local.get $ac) (local.get $acd)))
                      (if (local.get $err) (then (return (local.get $err))))))
              (local.set $n (i32.add (local.get $n) (i32.const 1)))
              (br $iloop)))
          ;; a stack access $uc_sp_block forwarded to an elided push's temp
          (global.set $uc_fwd_kind
            (select (i32.const 1)
                    (select (i32.const 2) (i32.const 0) (i32.and (i32.load offset=252 (local.get $R)) (i32.const 8)))
                    (i32.and (i32.load offset=252 (local.get $R)) (i32.const 4))))
          (if (global.get $uc_fwd_kind)
            (then (global.set $uc_fwd_a
                    (i32.load (call $uc_loop_insn (i32.and (i32.load offset=248 (local.get $R)) (i32.const 0xFFFF)))))))
          (local.set $err (call $uc_insn (local.get $R)))
          (global.set $uc_fwd_kind (i32.const 0))
          (if (local.get $err) (then (return (local.get $err))))
          (if (global.get $uc_err) (then (return (global.get $uc_err))))
          (if (local.get $last)
            (then
              (global.set $uc_sm (local.get $m)) (global.set $uc_smd (local.get $md))
              (global.set $uc_sc (local.get $c)) (global.set $uc_scd (local.get $cd))
              (call $uc_step (local.get $R))
              (if (local.get $rae)
                (then (local.set $err (call $uc_rec (global.get $uc_sm) (global.get $uc_smd) (global.get $uc_sc) (global.get $uc_scd)))
                      (if (local.get $err) (then (return (local.get $err))))
                      (call $uc_state_load (global.get $UC_MISC))))
              (local.set $t (call $uc_in_loop (local.get $nx)))
              (if (i32.and (i32.ne (local.get $t) (i32.const 0)) (call $uc_flag (local.get $t) (i32.const 16)))
                (then
                  (local.set $err (call $uc_check (i32.const 1) (local.get $nx) (i32.const 0) (i32.const 0)))
                  (if (local.get $err) (then (return (local.get $err))))
                  (call $uc_o1 (i32.const 25) (call $uc_aL (call $uc_lab (local.get $pfx) (local.get $peel) (local.get $nx)) (local.get $nx)))
                  (local.set $n (i32.add (local.get $n) (i32.const 1)))
                  (br $iloop)))
              (if (local.get $t)
                (then (call $uc_goto (local.get $pfx) (local.get $peel) (local.get $nx) (local.get $next)))
                (else (local.set $err (call $uc_inline_stub (local.get $nx) (global.get $uc_sm) (global.get $uc_smd)
                                                            (global.get $uc_sc) (global.get $uc_scd)))
                      (if (local.get $err) (then (return (local.get $err))))))))
          (local.set $n (i32.add (local.get $n) (i32.const 1)))
          (br $iloop)))
        (local.set $k (i32.add (local.get $k) (i32.const 1)))
        (br $bloop)))
      (local.set $ci (i32.add (local.get $ci) (i32.const 1)))
      (br $cloop)))
    (call $uc_flush_stubs))

  ;; A peeled copy's back edges enter the steady-state copy.
  (func $uc_lab (param $pfx i32) (param $peel i32) (param $t i32) (result i32)
    (select (i32.const 2) (local.get $pfx) (i32.and (local.get $peel) (i32.eq (local.get $t) (global.get $uc_head)))))
  (func $uc_goto (param $pfx i32) (param $peel i32) (param $t i32) (param $next i64)
    (local $l i64)
    (local.set $l (call $uc_aL (call $uc_lab (local.get $pfx) (local.get $peel) (local.get $t)) (local.get $t)))
    (if (i64.ne (local.get $l) (local.get $next)) (then (call $uc_o1 (i32.const 62) (local.get $l)))))

  ;; ------------------------------------------------ mov-pair runs --
  ;; docs/uop-tier-design.md §21.4 (--no-uop-mcopy). Within one compiler
  ;; block, a run of k >= 2 pairs
  ;;     mov r, [S + ds + 4i]  ;  mov [D + dd + 4i], r        (i = 0..k-1)
  ;; with one r, one source address form S (base, index, scale) and one
  ;; destination form D, and r in neither, is lowered to LEA, LEA and one
  ;; 85 MCOPY: k dwords copied forward, element by element as the pairs do
  ;; (the engine's fast arm is a memory.copy only when the extents do not
  ;; overlap), and r left holding the last dword written -- the value the
  ;; last load read. Every member is a mov, so no flag, no other register
  ;; and no address register moves inside the run, and its deopt stub is the
  ;; first load's: a page the run cannot prove leaves before anything is
  ;; written and threaded code runs every pair. Members after the first may
  ;; not be seams, the run ends before the block's last instruction (that
  ;; one's exit handling stays with the ordinary path), and no member may be
  ;; an aggressive-stack forward. Caesar III's unrolled tile blit is rows of
  ;; exactly this (docs/re-notes/caesar3-demo.md).
  (global $uc_mcopy_on (mut i32) (i32.const 1))
  (global $uc_mcopy_runs (mut i32) (i32.const 0))
  (global $uc_mcopy_pairs (mut i32) (i32.const 0))
  (func (export "set_uop_mcopy") (param $on i32)
    (global.set $uc_mcopy_on (i32.ne (local.get $on) (i32.const 0))))
  ;; 0 runs lowered, 1 pairs they took (compile-time counts, cumulative)
  (func (export "uop_mcopy_cstat") (param $k i32) (result i32)
    (select (global.get $uc_mcopy_pairs) (global.get $uc_mcopy_runs) (local.get $k)))

  ;; Operands a and b are the same address form (base, index, scale).
  (func $uc_same_form (param $a i32) (param $b i32) (result i32)
    (i32.and (i32.and (i32.eq (i32.load offset=4 (local.get $a)) (i32.load offset=4 (local.get $b)))
                      (i32.eq (i32.load offset=8 (local.get $a)) (i32.load offset=8 (local.get $b))))
             (i32.eq (i32.load offset=12 (local.get $a)) (i32.load offset=12 (local.get $b)))))

  ;; R = mov r, [m32] and S = mov [m32], r, the same full register r, which
  ;; is in neither address; neither an aggressive-stack forward. Answers r
  ;; plus one, or 0.
  (func $uc_mcopy_pair (param $R i32) (param $S i32) (result i32)
    (local $L i32) (local $M i32) (local $r i32)
    (if (i32.or (i32.ne (call $uc_kind (local.get $R)) (i32.const 5))
                (i32.ne (call $uc_kind (local.get $S)) (i32.const 5)))
      (then (return (i32.const 0))))
    (if (i32.or (i32.ne (i32.load offset=252 (local.get $R)) (i32.const 0))
                (i32.ne (i32.load offset=252 (local.get $S)) (i32.const 0)))
      (then (return (i32.const 0))))
    (local.set $L (i32.add (local.get $R) (i32.const 80)))
    (local.set $M (i32.add (local.get $S) (i32.const 56)))
    (if (i32.eqz (i32.and (call $uc_ref_is_reg32 (i32.add (local.get $R) (i32.const 56)))
                          (call $uc_ref_is_reg32 (i32.add (local.get $S) (i32.const 80)))))
      (then (return (i32.const 0))))
    (if (i32.eqz (i32.and (call $uc_is_mem (local.get $L)) (call $uc_is_mem (local.get $M))))
      (then (return (i32.const 0))))
    (if (i32.or (i32.ne (i32.load offset=20 (local.get $L)) (i32.const 32))
                (i32.ne (i32.load offset=20 (local.get $M)) (i32.const 32)))
      (then (return (i32.const 0))))
    (local.set $r (i32.load offset=60 (local.get $R)))
    (if (i32.ne (local.get $r) (i32.load offset=84 (local.get $S))) (then (return (i32.const 0))))
    (if (i32.or (i32.or (i32.eq (local.get $r) (i32.load offset=4 (local.get $L)))
                        (i32.eq (local.get $r) (i32.load offset=8 (local.get $L))))
                (i32.or (i32.eq (local.get $r) (i32.load offset=4 (local.get $M)))
                        (i32.eq (local.get $r) (i32.load offset=8 (local.get $M)))))
      (then (return (i32.const 0))))
    (i32.add (local.get $r) (i32.const 1)))

  ;; At position n of block B: lower the run starting there and answer how
  ;; many instructions it took, or 0 (nothing emitted).
  (func $uc_try_mcopy (param $B i32) (param $n i32) (result i32)
    (local $cnt i32) (local $p0 i32) (local $R0 i32) (local $S0 i32) (local $r i32)
    (local $k i32) (local $R i32) (local $S i32) (local $ts i64) (local $td i64)
    (if (i32.eqz (global.get $uc_mcopy_on)) (then (return (i32.const 0))))
    (local.set $cnt (i32.load offset=8 (local.get $B)))
    ;; room for two pairs before the block's last instruction
    (if (i32.gt_u (i32.add (local.get $n) (i32.const 5)) (local.get $cnt)) (then (return (i32.const 0))))
    (local.set $p0 (i32.add (i32.load offset=4 (local.get $B)) (local.get $n)))
    (local.set $R0 (call $uc_loop_insn (local.get $p0)))
    (local.set $S0 (call $uc_loop_insn (i32.add (local.get $p0) (i32.const 1))))
    (local.set $r (call $uc_mcopy_pair (local.get $R0) (local.get $S0)))
    (if (i32.eqz (local.get $r)) (then (return (i32.const 0))))
    (if (call $uc_flag (local.get $S0) (i32.const 4)) (then (return (i32.const 0))))
    (local.set $k (i32.const 1))
    (block $d (loop $l
      ;; pair k sits at n+2k, n+2k+1; its store must not be the block's last
      (br_if $d (i32.ge_u (i32.add (i32.add (local.get $n) (i32.shl (local.get $k) (i32.const 1))) (i32.const 2))
                          (local.get $cnt)))
      (local.set $R (call $uc_loop_insn (i32.add (local.get $p0) (i32.shl (local.get $k) (i32.const 1)))))
      (local.set $S (call $uc_loop_insn (i32.add (i32.add (local.get $p0) (i32.shl (local.get $k) (i32.const 1))) (i32.const 1))))
      (br_if $d (i32.ne (call $uc_mcopy_pair (local.get $R) (local.get $S)) (local.get $r)))
      (br_if $d (i32.or (call $uc_flag (local.get $R) (i32.const 4)) (call $uc_flag (local.get $S) (i32.const 4))))
      (br_if $d (i32.eqz (i32.and (call $uc_same_form (i32.add (local.get $R) (i32.const 80)) (i32.add (local.get $R0) (i32.const 80)))
                                  (call $uc_same_form (i32.add (local.get $S) (i32.const 56)) (i32.add (local.get $S0) (i32.const 56))))))
      (br_if $d (i32.ne (i32.load offset=96 (local.get $R))
                        (i32.add (i32.load offset=96 (local.get $R0)) (i32.shl (local.get $k) (i32.const 2)))))
      (br_if $d (i32.ne (i32.load offset=72 (local.get $S))
                        (i32.add (i32.load offset=72 (local.get $S0)) (i32.shl (local.get $k) (i32.const 2)))))
      (local.set $k (i32.add (local.get $k) (i32.const 1)))
      (br $l)))
    (if (i32.lt_u (local.get $k) (i32.const 2)) (then (return (i32.const 0))))
    (local.set $ts (call $uc_scratch))
    (local.set $td (call $uc_scratch))
    (call $uc_o5 (i32.const 32) (local.get $ts)
      (call $uc_mbase (i32.add (local.get $R0) (i32.const 80))) (call $uc_midx (i32.add (local.get $R0) (i32.const 80)))
      (call $uc_aN (i32.load offset=92 (local.get $R0))) (call $uc_aN (i32.load offset=96 (local.get $R0))))
    (call $uc_o5 (i32.const 32) (local.get $td)
      (call $uc_mbase (i32.add (local.get $S0) (i32.const 56))) (call $uc_midx (i32.add (local.get $S0) (i32.const 56)))
      (call $uc_aN (i32.load offset=68 (local.get $S0))) (call $uc_aN (i32.load offset=72 (local.get $S0))))
    (call $uc_emit (i32.const 85) (i32.const 7)
      (local.get $td) (local.get $ts) (call $uc_aN (local.get $k))
      (call $uc_aR (i32.sub (local.get $r) (i32.const 1)))
      (call $uc_win (i32.add (local.get $S0) (i32.const 56)) (i32.const 1))
      (call $uc_win (i32.add (local.get $R0) (i32.const 80)) (i32.const 0))
      (call $uc_xstub))
    (global.set $uc_mcopy_runs (i32.add (global.get $uc_mcopy_runs) (i32.const 1)))
    (global.set $uc_mcopy_pairs (i32.add (global.get $uc_mcopy_pairs) (local.get $k)))
    (i32.shl (local.get $k) (i32.const 1)))

  ;; ------------------------------------------------ aggressive stack --
  ;; --aggressive-stack. A push whose slot the same block's pop takes back
  ;; (LIFO, the pop reading exactly the slot the push wrote) is lowered to a
  ;; MOV into temp (20, push address) and the pop to a MOV out of it; ESP
  ;; still moves by 4 each time, so every register stays exact. Between the
  ;; two, per access (docs/uop-tier-design.md, "aggressive stack tier"):
  ;;   * [esp+d] / [ebp+d] (EBP from a tracked `mov ebp, esp`) at a known
  ;;     offset: no overlap leaves the pair alone; an exact 32-bit read or a
  ;;     pure 32-bit write (mov) is forwarded to the temp; a partial overlap,
  ;;     a narrower access or a read-modify-write materializes the push;
  ;;   * any other address (not statically related to ESP) materializes
  ;;     every open push -- the runtime-guard alternative is not built;
  ;;   * ESP written other than by add/sub imm, a call or a ret: all open
  ;;     pushes materialize and the offsets start again.
  ;; An escaping `lea r, [esp+d]` needs no rule of its own: the only way the
  ;; slot is reached through r is a dereference of r, an unknown address.
  ;; Every stub that leaves before an instruction an elided pair spans spills
  ;; the temps back to their slots first ($uc_spill_at).
  ;;
  ;; Record fields: +248 bits 16-31 ESP offset before the instruction
  ;; (signed, from the block's entry), bits 0-15 the partner's loop position
  ;; (push: its pop, pop: its push, forwarded access: the push). +252:
  ;; 1 push elided, 2 pop elided, 4 access reads the temp, 8 access writes
  ;; it; on a push 0x10/0x20/0x40 an access to another slot / a forwarded
  ;; read / a forwarded write came between, 0x1000 materialized with the
  ;; reason in bits 8-11.
  ;; Open list: $UC_MISC + 0xF00, 8 bytes per entry (+0 push record, +4
  ;; slot offset), at most 32. Counters: $UC_MISC + 0xE80, 20 words, per
  ;; compile; $UC_MISC + 0xB00 cumulative (committed with the program).
  ;; Counter / reason numbers: 0 pushes seen 1 pairs matched 2 elided
  ;; 3 elided with nothing between (the conservative rule's pairs) 4 rescued
  ;; (some access between) 5 rescued past an access to another slot
  ;; 6 rescued by a forwarded read 7 rescued by a forwarded write
  ;; 8 forwarded reads 9 forwarded writes 10-16 matched but materialized:
  ;; 10+1 unknown address 10+2 [ebp] with EBP unknown 10+3 partial / narrow /
  ;; read-modify-write 10+4 ESP written 10+5 released (add esp) 10+6
  ;; call/ret 10+7 list full; 18 pops with no open push to match 19 spills.

  (func $uc_sp_cnt (param $i i32)
    (local $p i32)
    (local.set $p (i32.add (i32.add (global.get $UC_MISC) (i32.const 0xE80)) (i32.shl (local.get $i) (i32.const 2))))
    (i32.store (local.get $p) (i32.add (i32.load (local.get $p)) (i32.const 1))))

  ;; Materialize open entry e (reason r) unless it already is.
  (func $uc_sp_kill (param $e i32) (param $r i32)
    (local $P i32)
    (local.set $P (i32.load (local.get $e)))
    (if (i32.eqz (i32.and (i32.load offset=252 (local.get $P)) (i32.const 0x1000)))
      (then (i32.store offset=252 (local.get $P)
              (i32.or (i32.load offset=252 (local.get $P))
                      (i32.or (i32.const 0x1000) (i32.shl (local.get $r) (i32.const 8))))))))

  (func $uc_sp_kill_all (param $n i32) (param $r i32)
    (local $i i32)
    (block $d (loop $l
      (br_if $d (i32.ge_u (local.get $i) (local.get $n)))
      (call $uc_sp_kill (i32.add (i32.add (global.get $UC_MISC) (i32.const 0xF00)) (i32.shl (local.get $i) (i32.const 3)))
                        (local.get $r))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $l))))

  ;; Operand i of R touches the slot exactly: 1 a read, 2 a pure write, 0
  ;; neither (a read-modify-write, a narrower or a sign/zero-extending one).
  (func $uc_sp_role (param $R i32) (param $i i32) (result i32)
    (local $k i32)
    (local.set $k (call $uc_kind (local.get $R)))
    (if (i32.ne (i32.load offset=20 (i32.add (i32.add (local.get $R) (i32.const 56)) (i32.mul (local.get $i) (i32.const 24))))
                (i32.const 32))
      (then (return (i32.const 0))))
    (if (i32.eqz (local.get $i))
      (then
        (if (i32.eq (local.get $k) (i32.const 5)) (then (return (i32.const 2))))
        (return (i32.or (i32.eq (local.get $k) (i32.const 4))
                        (i32.and (i32.eq (local.get $k) (i32.const 1))
                                 (i32.eq (i32.load offset=12 (local.get $R)) (i32.const 7)))))))
    (i32.or (i32.or (i32.eq (local.get $k) (i32.const 1)) (i32.eq (local.get $k) (i32.const 5)))
            (i32.or (i32.eq (local.get $k) (i32.const 4))
                    (i32.or (i32.eq (local.get $k) (i32.const 14)) (i32.eq (local.get $k) (i32.const 20))))))

  ;; One block, pass 1 (which pushes are elided) or 2 (forwarding, which
  ;; needs pass 1's final verdicts, and the rescue census).
  (func $uc_sp_block (param $B i32) (param $pass i32)
    (local $pos i32) (local $end i32) (local $R i32) (local $k i32) (local $esp i32)
    (local $ebpk i32) (local $ebpr i32) (local $n i32) (local $OL i32) (local $e i32)
    (local $P i32) (local $i i32) (local $O i32) (local $off i32) (local $wb i32)
    (local $known i32) (local $s i32) (local $role i32) (local $j i32) (local $f i32)
    (local.set $OL (i32.add (global.get $UC_MISC) (i32.const 0xF00)))
    (local.set $pos (i32.load offset=4 (local.get $B)))
    (local.set $end (i32.add (local.get $pos) (i32.load offset=8 (local.get $B))))
    (block $d (loop $l
      (br_if $d (i32.ge_u (local.get $pos) (local.get $end)))
      (local.set $R (call $uc_loop_insn (local.get $pos)))
      (local.set $k (call $uc_kind (local.get $R)))
      (if (i32.eq (local.get $pass) (i32.const 1))
        (then (i32.store offset=248 (local.get $R)
                (i32.or (i32.shl (local.get $esp) (i32.const 16))
                        (i32.and (i32.load offset=248 (local.get $R)) (i32.const 0xFFFF))))))
      (block $next
        ;; push
        (if (i32.eq (local.get $k) (i32.const 21))
          (then
            (if (i32.eq (local.get $pass) (i32.const 1)) (then (call $uc_sp_cnt (i32.const 0))))
            (local.set $esp (i32.sub (local.get $esp) (i32.const 4)))
            (if (i32.ge_u (local.get $n) (i32.const 32))
              (then (call $uc_sp_kill_all (local.get $n) (i32.const 7))
                    (local.set $n (i32.const 0))))
            (local.set $e (i32.add (local.get $OL) (i32.shl (local.get $n) (i32.const 3))))
            (i32.store (local.get $e) (local.get $R))
            (i32.store offset=4 (local.get $e) (local.get $esp))
            (local.set $n (i32.add (local.get $n) (i32.const 1)))
            (br $next)))
        ;; pop: the top entry, when it is the slot popped
        (if (i32.eq (local.get $k) (i32.const 22))
          (then
            (local.set $e (i32.add (local.get $OL) (i32.shl (i32.sub (local.get $n) (i32.const 1)) (i32.const 3))))
            (if (i32.and (i32.ne (local.get $n) (i32.const 0))
                         (i32.eq (i32.load offset=4 (local.get $e)) (local.get $esp)))
              (then
                (local.set $P (i32.load (local.get $e)))
                (local.set $n (i32.sub (local.get $n) (i32.const 1)))
                (local.set $f (i32.load offset=252 (local.get $P)))
                (if (i32.eq (local.get $pass) (i32.const 1))
                  (then
                    (call $uc_sp_cnt (i32.const 1))
                    (if (i32.and (local.get $f) (i32.const 0x1000))
                      (then (call $uc_sp_cnt (i32.add (i32.const 10) (i32.and (i32.shr_u (local.get $f) (i32.const 8)) (i32.const 15)))))
                      (else
                        (i32.store offset=252 (local.get $P) (i32.or (local.get $f) (i32.const 1)))
                        (i32.store offset=248 (local.get $P)
                          (i32.or (i32.and (i32.load offset=248 (local.get $P)) (i32.const 0xFFFF0000)) (local.get $pos)))
                        (i32.store offset=252 (local.get $R) (i32.or (i32.load offset=252 (local.get $R)) (i32.const 2)))
                        (i32.store offset=248 (local.get $R)
                          (i32.or (i32.and (i32.load offset=248 (local.get $R)) (i32.const 0xFFFF0000))
                                  (i32.load offset=48 (local.get $P)))))))
                  (else
                    (if (i32.and (local.get $f) (i32.const 1))
                      (then
                        (call $uc_sp_cnt (i32.const 2))
                        (call $uc_sp_cnt (select (i32.const 4) (i32.const 3) (i32.and (local.get $f) (i32.const 0x70))))
                        (if (i32.and (local.get $f) (i32.const 0x10)) (then (call $uc_sp_cnt (i32.const 5))))
                        (if (i32.and (local.get $f) (i32.const 0x20)) (then (call $uc_sp_cnt (i32.const 6))))
                        (if (i32.and (local.get $f) (i32.const 0x40)) (then (call $uc_sp_cnt (i32.const 7)))))))))
              (else
                ;; nothing open there: a read of a slot below whatever is
                ;; open, or of the caller's frame
                (if (i32.eq (local.get $pass) (i32.const 1)) (then (call $uc_sp_cnt (i32.const 18))))
                (call $uc_sp_kill_all (local.get $n) (i32.const 3))))
            (local.set $esp (i32.add (local.get $esp) (i32.const 4)))
            (br $next)))
        (if (i32.or (i32.eq (local.get $k) (i32.const 23)) (i32.eq (local.get $k) (i32.const 24)))
          (then (call $uc_sp_kill_all (local.get $n) (i32.const 6))
                (local.set $n (i32.const 0))
                (br $next)))
        ;; pushad / popad: eight slots at once; not tracked, start over
        (if (i32.eq (local.get $k) (i32.const 31))
          (then (call $uc_sp_kill_all (local.get $n) (i32.const 4))
                (local.set $n (i32.const 0))
                (local.set $esp (i32.const 0))
                (local.set $ebpk (i32.const 0))
                (br $next)))
        ;; memory operands
        (if (i32.and (i32.ne (local.get $k) (i32.const 6)) (i32.ne (local.get $k) (i32.const 7)))
          (then
            (local.set $i (i32.const 0))
            (block $od (loop $ol
              (br_if $od (i32.ge_u (local.get $i) (i32.const 3)))
              (local.set $O (i32.add (i32.add (local.get $R) (i32.const 56)) (i32.mul (local.get $i) (i32.const 24))))
              (if (call $uc_is_mem (local.get $O))
                (then
                  (local.set $known (i32.const 0))
                  (if (i32.lt_s (i32.load offset=8 (local.get $O)) (i32.const 0))
                    (then
                      (if (i32.eq (i32.load offset=4 (local.get $O)) (i32.const 4))
                        (then (local.set $known (i32.const 1))
                              (local.set $off (i32.add (local.get $esp) (i32.load offset=16 (local.get $O))))))
                      (if (i32.and (i32.eq (i32.load offset=4 (local.get $O)) (i32.const 5)) (local.get $ebpk))
                        (then (local.set $known (i32.const 1))
                              (local.set $off (i32.add (local.get $ebpr) (i32.load offset=16 (local.get $O))))))))
                  (if (i32.eqz (local.get $known))
                    (then (call $uc_sp_kill_all (local.get $n)
                            (select (i32.const 2) (i32.const 1)
                                    (i32.and (i32.eq (i32.load offset=4 (local.get $O)) (i32.const 5))
                                             (i32.lt_s (i32.load offset=8 (local.get $O)) (i32.const 0))))))
                    (else
                      (local.set $wb (i32.shr_u (i32.load offset=20 (local.get $O)) (i32.const 3)))
                      (if (i32.eqz (local.get $wb)) (then (local.set $wb (i32.const 4))))
                      (local.set $role (call $uc_sp_role (local.get $R) (local.get $i)))
                      (local.set $j (i32.const 0))
                      (block $ed (loop $el
                        (br_if $ed (i32.ge_u (local.get $j) (local.get $n)))
                        (local.set $e (i32.add (local.get $OL) (i32.shl (local.get $j) (i32.const 3))))
                        (local.set $s (i32.load offset=4 (local.get $e)))
                        (local.set $P (i32.load (local.get $e)))
                        (if (i32.and (i32.lt_s (local.get $off) (i32.add (local.get $s) (i32.const 4)))
                                     (i32.lt_s (local.get $s) (i32.add (local.get $off) (local.get $wb))))
                          (then
                            (if (i32.and (i32.and (i32.eq (local.get $off) (local.get $s)) (i32.eq (local.get $wb) (i32.const 4)))
                                         (i32.ne (local.get $role) (i32.const 0)))
                              (then
                                (if (i32.and (i32.eq (local.get $pass) (i32.const 2))
                                             (i32.ne (i32.and (i32.load offset=252 (local.get $P)) (i32.const 1)) (i32.const 0)))
                                  (then
                                    (i32.store offset=252 (local.get $R)
                                      (i32.or (i32.load offset=252 (local.get $R))
                                              (select (i32.const 4) (i32.const 8) (i32.eq (local.get $role) (i32.const 1)))))
                                    (i32.store offset=248 (local.get $R)
                                      (i32.or (i32.and (i32.load offset=248 (local.get $R)) (i32.const 0xFFFF0000))
                                              (i32.load offset=48 (local.get $P))))
                                    (i32.store offset=252 (local.get $P)
                                      (i32.or (i32.load offset=252 (local.get $P))
                                              (select (i32.const 0x20) (i32.const 0x40) (i32.eq (local.get $role) (i32.const 1)))))
                                    (call $uc_sp_cnt (select (i32.const 8) (i32.const 9) (i32.eq (local.get $role) (i32.const 1)))))))
                              (else (call $uc_sp_kill (local.get $e) (i32.const 3)))))
                          (else
                            (if (i32.eq (local.get $pass) (i32.const 2))
                              (then (i32.store offset=252 (local.get $P)
                                      (i32.or (i32.load offset=252 (local.get $P)) (i32.const 0x10)))))))
                        (local.set $j (i32.add (local.get $j) (i32.const 1)))
                        (br $el)))))))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $ol)))))
        ;; ESP: add/sub esp, imm move the offset; anything else starts over
        (if (i32.and (call $uc_writes (local.get $R)) (i32.const 16))
          (then
            (if (i32.and (i32.and (i32.eq (local.get $k) (i32.const 1))
                                  (call $uc_ref_is_reg32 (i32.add (local.get $R) (i32.const 56))))
                         (i32.and (i32.eq (i32.load offset=80 (local.get $R)) (i32.const 3))
                                  (i32.or (i32.eqz (i32.load offset=12 (local.get $R)))
                                          (i32.eq (i32.load offset=12 (local.get $R)) (i32.const 5)))))
              (then
                (local.set $esp (select (i32.add (local.get $esp) (i32.load offset=96 (local.get $R)))
                                        (i32.sub (local.get $esp) (i32.load offset=96 (local.get $R)))
                                        (i32.eqz (i32.load offset=12 (local.get $R)))))
                ;; slots now below ESP are released: no pop can take them
                (block $rd (loop $rl
                  (br_if $rd (i32.eqz (local.get $n)))
                  (local.set $e (i32.add (local.get $OL) (i32.shl (i32.sub (local.get $n) (i32.const 1)) (i32.const 3))))
                  (br_if $rd (i32.ge_s (i32.load offset=4 (local.get $e)) (local.get $esp)))
                  (call $uc_sp_kill (local.get $e) (i32.const 5))
                  (local.set $n (i32.sub (local.get $n) (i32.const 1)))
                  (br $rl))))
              (else
                (call $uc_sp_kill_all (local.get $n) (i32.const 4))
                (local.set $n (i32.const 0))
                (local.set $esp (i32.const 0))
                (local.set $ebpk (i32.const 0)))))))
      ;; EBP: `mov ebp, esp` ties it to the offset; any other write unties it
      (if (i32.and (call $uc_writes (local.get $R)) (i32.const 32))
        (then
          (local.set $ebpk (i32.const 0))
          (if (i32.and (i32.and (i32.eq (local.get $k) (i32.const 5))
                                (call $uc_ref_is_reg32 (i32.add (local.get $R) (i32.const 56))))
                       (i32.and (i32.eq (i32.load offset=60 (local.get $R)) (i32.const 5))
                                (i32.and (call $uc_ref_is_reg32 (i32.add (local.get $R) (i32.const 80)))
                                         (i32.eq (i32.load offset=84 (local.get $R)) (i32.const 4)))))
            (then (local.set $ebpk (i32.const 1)) (local.set $ebpr (local.get $esp))))))
      ;; the offset has to fit the record's 16 bits
      (if (i32.gt_u (i32.add (local.get $esp) (i32.const 0x7000)) (i32.const 0xE000))
        (then (call $uc_sp_kill_all (local.get $n) (i32.const 4))
              (local.set $n (i32.const 0))
              (local.set $esp (i32.const 0))
              (local.set $ebpk (i32.const 0))))
      (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
      (br $l))))

  (func $uc_sp_analyze
    (local $k i32) (local $R i32)
    (memory.fill (i32.add (global.get $UC_MISC) (i32.const 0xE80)) (i32.const 0) (i32.const 0x50))
    (block $d (loop $l
      (br_if $d (i32.ge_u (local.get $k) (global.get $uc_nloop)))
      (local.set $R (call $uc_loop_insn (local.get $k)))
      (i32.store offset=248 (local.get $R) (i32.const 0))
      (i32.store offset=252 (local.get $R) (i32.const 0))
      (local.set $k (i32.add (local.get $k) (i32.const 1)))
      (br $l)))
    (if (i32.eqz (global.get $uc_aggr)) (then (return)))
    (local.set $k (i32.const 0))
    (block $d1 (loop $l1
      (br_if $d1 (i32.ge_u (local.get $k) (global.get $uc_nblk)))
      (call $uc_sp_block (call $uc_blk (local.get $k)) (i32.const 1))
      (call $uc_sp_block (call $uc_blk (local.get $k)) (i32.const 2))
      (local.set $k (i32.add (local.get $k) (i32.const 1)))
      (br $l1))))

  ;; Before leaving to threaded code at in-loop instruction x: store every
  ;; elided push open across x (pushed before it, popped at or after it) to
  ;; its slot, addressed off the ESP register (exact at x).
  (func $uc_spill_at (param $x i32)
    (local $R i32) (local $B i32) (local $p i32) (local $pos i32) (local $ex i32) (local $P i32)
    (if (i32.eqz (global.get $uc_aggr)) (then (return)))
    (local.set $R (call $uc_in_loop (local.get $x)))
    (if (i32.eqz (local.get $R)) (then (return)))
    (local.set $pos (i32.load offset=48 (local.get $R)))
    (local.set $B (call $uc_blk (i32.load offset=44 (local.get $R))))
    (local.set $ex (i32.shr_s (i32.load offset=248 (local.get $R)) (i32.const 16)))
    (local.set $p (i32.load offset=4 (local.get $B)))
    (block $d (loop $l
      (br_if $d (i32.ge_u (local.get $p) (local.get $pos)))
      (local.set $P (call $uc_loop_insn (local.get $p)))
      (if (i32.and (i32.ne (i32.and (i32.load offset=252 (local.get $P)) (i32.const 1)) (i32.const 0))
                   (i32.ge_u (i32.and (i32.load offset=248 (local.get $P)) (i32.const 0xFFFF)) (local.get $pos)))
        (then
          (call $uc_o3 (i32.const 67) (call $uc_aT (i32.const 20) (i32.load (local.get $P))) (call $uc_aR (i32.const 4))
            (call $uc_aN (i32.sub (i32.sub (i32.shr_s (i32.load offset=248 (local.get $P)) (i32.const 16)) (i32.const 4))
                                  (local.get $ex))))
          (call $uc_sp_cnt (i32.const 19))))
      (local.set $p (i32.add (local.get $p) (i32.const 1)))
      (br $l))))

  ;; ------------------------------------------------------------- lower --
  (func $uc_lower (result i32)
    (local $err i32) (local $k i32) (local $F0 i32) (local $F1 i32) (local $F2 i32)
    (local $round i32) (local $before i32) (local $cp i32)
    (call $uc_build_blocks)
    (if (global.get $uc_err) (then (return (global.get $uc_err))))
    (local.set $err (call $uc_block_ends))
    (if (local.get $err) (then (return (local.get $err))))
    (call $uc_liveness)
    (local.set $F0 (call $uc_flow_slot (i32.const 0)))
    (local.set $F1 (call $uc_flow_slot (i32.const 1)))
    (local.set $F2 (call $uc_flow_slot (i32.const 2)))
    (call $uc_sp_analyze)
    (if (i32.eqz (call $uc_flow (local.get $F0) (global.get $UC_MISC) (i32.const 1) (i32.const 1)))
      (then (return (i32.const 8))))
    (local.set $cp (i32.add (global.get $UC_MISC) (i32.const 0xD00)))
    (global.set $uc_ncopies (i32.const 1))
    (i32.store (local.get $cp) (i32.const 2))
    (i32.store offset=4 (local.get $cp) (local.get $F0))
    (i32.store offset=8 (local.get $cp) (i32.const 0))
    ;; PEELING. The head merges the entry flags (the globals) with whatever
    ;; the latch produced, so the single-copy form must record the latch's
    ;; flags every iteration just to agree with the entry. Emit the first
    ;; iteration as its own copy entered with the globals, whose back edges
    ;; land in a second copy whose head only ever sees the latch producers.
    (if (call $uc_head_pred_rec (local.get $F0))
      (then
        (if (call $uc_flow (local.get $F1) (global.get $UC_MISC) (i32.const 1) (i32.const 0))
          (then
            (if (call $uc_flow (local.get $F2) (i32.add (local.get $F1) (i32.const 0x7800))
                               (i32.load (i32.add (local.get $F1) (i32.const 0x9FFC))) (i32.const 1))
              (then
                (if (i32.eqz (call $uc_head_pred_rec (local.get $F2)))
                  (then
                    (global.set $uc_ncopies (i32.const 2))
                    (i32.store (local.get $cp) (i32.const 1))
                    (i32.store offset=4 (local.get $cp) (local.get $F1))
                    (i32.store offset=8 (local.get $cp) (i32.const 1))
                    (i32.store offset=16 (local.get $cp) (i32.const 2))
                    (i32.store offset=20 (local.get $cp) (local.get $F2))
                    (i32.store offset=24 (local.get $cp) (i32.const 0))))))))))
    (local.set $k (i32.const 0))
    (block $d (loop $l
      (br_if $d (i32.ge_u (local.get $k) (global.get $uc_nloop)))
      (call $uc_recipe (call $uc_loop_insn (local.get $k)))
      (local.set $k (i32.add (local.get $k) (i32.const 1)))
      (br $l)))
    ;; emission, iterated until the demanded snapshots stop growing
    (call $uc_hm_clear (global.get $UC_HM_DEM))
    (block $rd (loop $rl
      (local.set $before (i32.load offset=8 (global.get $UC_HM_DEM)))
      (global.set $uc_nitems (i32.const 0))
      (global.set $uc_nops (i32.const 0))
      (global.set $uc_nscr (i32.const 0))
      (global.set $uc_nstubs (i32.const 0))
      (global.set $uc_nwin (i32.const 0))
      (call $uc_hm_clear (global.get $UC_HM_WIN))
      (call $uc_hm_clear (global.get $UC_HM_STUB))
      (call $uc_hm_clear (global.get $UC_HM_TEMP))
      ;; spills are counted by the round that is kept
      (i32.store offset=76 (i32.add (global.get $UC_MISC) (i32.const 0xE80)) (i32.const 0))
      (local.set $err (call $uc_emit_program))
      (if (i32.eqz (local.get $err)) (then (local.set $err (global.get $uc_err))))
      (if (local.get $err) (then (return (local.get $err))))
      (br_if $rd (i32.eq (i32.load offset=8 (global.get $UC_HM_DEM)) (local.get $before)))
      (if (i32.eq (local.get $round) (i32.const 5)) (then (return (i32.const 9))))
      (local.set $round (i32.add (local.get $round) (i32.const 1)))
      (br $rl)))
    (i32.const 0))

  ;; ----------------------------------------------------------- encoding --
  ;; Pass 1 places the labels (relative) and counts op words; pass 2 numbers
  ;; the constant pool and the temps in first-use order and checks every label
  ;; exists. After it the size is known, so pass 3 writes in place.

  (func $uc_encode_prepare (result i32)
    (local $p i32) (local $end i32) (local $n i32) (local $j i32) (local $a i64) (local $ty i32)
    (local $v i32)
    (if (i32.gt_u (global.get $uc_nwin) (global.get $UC_MAX_WIN)) (then (return (i32.const 20))))
    (call $uc_hm_clear (global.get $UC_HM_LABEL))
    (local.set $p (global.get $UC_ITEMS))
    (local.set $end (i32.add (global.get $UC_ITEMS) (global.get $uc_nitems)))
    (block $d (loop $l
      (br_if $d (i32.ge_u (local.get $p) (local.get $end)))
      (if (i32.lt_s (i32.load (local.get $p)) (i32.const 0))
        (then (call $uc_hm_put (global.get $UC_HM_LABEL) (i64.load offset=8 (local.get $p)) (i32.shl (local.get $n) (i32.const 2))))
        (else (local.set $n (i32.add (local.get $n) (i32.add (i32.const 1) (i32.load offset=4 (local.get $p)))))))
      (local.set $p (i32.add (local.get $p) (i32.add (i32.const 8) (i32.shl (i32.load offset=4 (local.get $p)) (i32.const 3)))))
      (br $l)))
    (global.set $uc_enc_n (local.get $n))
    (call $uc_hm_clear (global.get $UC_HM_CONST))
    (global.set $uc_nconst (i32.const 0))
    (local.set $p (global.get $UC_ITEMS))
    (block $d2 (loop $l2
      (br_if $d2 (i32.ge_u (local.get $p) (local.get $end)))
      (if (i32.ge_s (i32.load (local.get $p)) (i32.const 0))
        (then
          (local.set $j (i32.const 0))
          (block $ad (loop $al
            (br_if $ad (i32.ge_u (local.get $j) (i32.load offset=4 (local.get $p))))
            (local.set $a (i64.load offset=8 (i32.add (local.get $p) (i32.shl (local.get $j) (i32.const 3)))))
            (local.set $ty (call $uc_atype (local.get $a)))
            (if (i32.eq (local.get $ty) (i32.const 4))
              (then
                (local.set $v (i32.wrap_i64 (local.get $a)))
                (if (i32.lt_s (call $uc_hm_get (global.get $UC_HM_CONST) (i64.extend_i32_u (local.get $v))) (i32.const 0))
                  (then
                    (if (i32.ge_u (global.get $uc_nconst) (i32.const 4096)) (then (return (i32.const 26))))
                    (call $uc_hm_put (global.get $UC_HM_CONST) (i64.extend_i32_u (local.get $v)) (global.get $uc_nconst))
                    (i32.store (i32.add (global.get $UC_CONST) (i32.shl (global.get $uc_nconst) (i32.const 2))) (local.get $v))
                    (global.set $uc_nconst (i32.add (global.get $uc_nconst) (i32.const 1)))))))
            (if (i32.eq (local.get $ty) (i32.const 3))
              (then
                (if (i32.lt_s (call $uc_hm_get (global.get $UC_HM_TEMP) (local.get $a)) (i32.const 0))
                  (then
                    (call $uc_hm_put (global.get $UC_HM_TEMP) (local.get $a) (i32.load offset=8 (global.get $UC_HM_TEMP)))))))
            (if (i32.eq (local.get $ty) (i32.const 5))
              (then (if (i32.lt_s (call $uc_hm_get (global.get $UC_HM_LABEL) (local.get $a)) (i32.const 0))
                      (then (return (i32.const 21))))))
            (local.set $j (i32.add (local.get $j) (i32.const 1)))
            (br $al)))))
      (local.set $p (i32.add (local.get $p) (i32.add (i32.const 8) (i32.shl (i32.load offset=4 (local.get $p)) (i32.const 3)))))
      (br $l2)))
    (if (global.get $uc_err) (then (return (global.get $uc_err))))
    (if (i32.gt_u (i32.load offset=8 (global.get $UC_HM_TEMP)) (global.get $UC_MAX_TEMPS)) (then (return (i32.const 23))))
    (i32.const 0))

  ;; Words the program takes (after $uc_encode_prepare).
  (func $uc_encode_words (result i32)
    (i32.add (global.get $uc_enc_n) (global.get $uc_nconst)))

  (func $uc_is_store (param $op i32) (result i32)
    (i32.or (i32.or (i32.lt_u (i32.sub (local.get $op) (i32.const 17)) (i32.const 3))
                    (i32.lt_u (i32.sub (local.get $op) (i32.const 38)) (i32.const 3)))
            (i32.eq (local.get $op) (i32.const 73))))

  (func $uc_encode_write (param $code i32)
    (local $p i32) (local $end i32) (local $o i32) (local $j i32) (local $a i64) (local $ty i32)
    (local $v i32) (local $cb i32) (local $tb i32) (local $wb i32)
    (local.set $cb (i32.add (local.get $code) (i32.shl (global.get $uc_enc_n) (i32.const 2))))
    (local.set $tb (i32.add (global.get $uop_arena) (global.get $uop_temps_off)))
    (local.set $wb (global.get $uc_wb))
    (local.set $o (local.get $code))
    (local.set $p (global.get $UC_ITEMS))
    (local.set $end (i32.add (global.get $UC_ITEMS) (global.get $uc_nitems)))
    (block $d (loop $l
      (br_if $d (i32.ge_u (local.get $p) (local.get $end)))
      (if (i32.ge_s (i32.load (local.get $p)) (i32.const 0))
        (then
          (i32.store (local.get $o) (i32.load (local.get $p)))
          (local.set $o (i32.add (local.get $o) (i32.const 4)))
          (local.set $j (i32.const 0))
          (block $ad (loop $al
            (br_if $ad (i32.ge_u (local.get $j) (i32.load offset=4 (local.get $p))))
            (local.set $a (i64.load offset=8 (i32.add (local.get $p) (i32.shl (local.get $j) (i32.const 3)))))
            (local.set $ty (call $uc_atype (local.get $a)))
            (local.set $v (i32.wrap_i64 (local.get $a)))
            (if (i32.eq (local.get $ty) (i32.const 2))
              (then (local.set $v (i32.add (global.get $reg_base) (i32.shl (local.get $v) (i32.const 2))))))
            (if (i32.eq (local.get $ty) (i32.const 7))
              (then (local.set $v (i32.add (global.get $mmx_base) (i32.shl (local.get $v) (i32.const 3))))))
            (if (i32.eq (local.get $ty) (i32.const 3))
              (then (local.set $v (i32.add (local.get $tb)
                                           (i32.shl (call $uc_hm_get (global.get $UC_HM_TEMP) (local.get $a)) (i32.const 2))))))
            (if (i32.eq (local.get $ty) (i32.const 4))
              (then (local.set $v (i32.add (local.get $cb)
                                           (i32.shl (call $uc_hm_get (global.get $UC_HM_CONST) (i64.extend_i32_u (local.get $v)))
                                                    (i32.const 2))))))
            (if (i32.eq (local.get $ty) (i32.const 5))
              (then (local.set $v (i32.add (local.get $code) (call $uc_hm_get (global.get $UC_HM_LABEL) (local.get $a))))))
            (if (i32.eq (local.get $ty) (i32.const 6))
              (then (local.set $v (i32.add (local.get $wb) (i32.shl (local.get $v) (i32.const 4))))
                    ;; A store's window is a written window: re-guarding it
                    ;; refuses a page that holds decoded code, so the store
                    ;; exits to threaded code, which invalidates what it hits.
                    ;; ($uc_win keys loads and stores apart: never both.)
                    ;; COPY / FILL / MCOPY (82 / 83 / 85): arg 4 is their
                    ;; store window, and it was proved read-only before.
                    (if (i32.or (call $uc_is_store (i32.load (local.get $p)))
                                (i32.and (i32.eq (local.get $j) (i32.const 4))
                                         (i32.or (i32.eq (i32.load (local.get $p)) (i32.const 85))
                                                 (i32.lt_u (i32.sub (i32.load (local.get $p)) (i32.const 82)) (i32.const 2)))))
                      (then (i32.store offset=12 (local.get $v) (i32.const 1))))))
            (i32.store (local.get $o) (local.get $v))
            (local.set $o (i32.add (local.get $o) (i32.const 4)))
            (local.set $j (i32.add (local.get $j) (i32.const 1)))
            (br $al)))))
      (local.set $p (i32.add (local.get $p) (i32.add (i32.const 8) (i32.shl (i32.load offset=4 (local.get $p)) (i32.const 3)))))
      (br $l)))
    (memory.copy (local.get $o) (global.get $UC_CONST) (i32.shl (global.get $uc_nconst) (i32.const 2))))

  ;; ------------------------------------------------------------ compile --

  ;; formLoop + lower for the head at eip: 0, or a decline reason.
  (func $uc_lower_head (param $eip i32) (result i32)
    (local $err i32)
    (if (i32.eqz (global.get $uc_ready)) (then (call $uc_init)))
    (global.set $uc_span (global.get $UC_SPAN))
    (block $done (loop $again
      (global.set $uc_err (i32.const 0))
      (global.set $uc_nocall (i32.const 0))
      (local.set $err (call $uc_form_loop (local.get $eip)))
      (if (i32.eqz (local.get $err)) (then (local.set $err (call $uc_lower))))
      (if (i32.eqz (local.get $err)) (then (local.set $err (call $uc_encode_prepare))))
      ;; Following calls grows the region by every callee's body, which can
      ;; cost a loop that compiled without them (scan limit, loop size, a
      ;; callee the lowering declines). Once more with calls as the region's
      ;; edge, so following them never loses a head.
      (if (i32.and (i32.ne (local.get $err) (i32.const 0))
                   (i32.ne (i32.load (global.get $UC_CALLT)) (i32.const 0)))
        (then
          ;; census 17: the calls-followed attempt's own reason, which the
          ;; nocall retry's verdict replaces (a call-headed head retries into
          ;; head-unsupported, since its own E8 is then unsupported)
          (if (global.get $uop_census)
            (then (call $uop_census_ev (i32.const 17) (local.get $eip) (local.get $err)
                    (i32.load (global.get $UC_CALLT)) (global.get $uc_is_trace))))
          (global.set $uc_nocall (i32.const 1))
          (global.set $uc_err (i32.const 0))
          (local.set $err (call $uc_form_loop (local.get $eip)))
          (if (i32.eqz (local.get $err)) (then (local.set $err (call $uc_lower))))
          (if (i32.eqz (local.get $err)) (then (local.set $err (call $uc_encode_prepare))))))
      ;; Scan limit: the flood from the head met more code than MAX_SCAN
      ;; before it closed -- an unrolled rasterizer (Unreal SoftDrv) whose
      ;; neighbours are all within SPAN. The loop itself is usually small;
      ;; halve the span and try again, so the far code becomes side exits.
      (br_if $done (i32.ne (local.get $err) (i32.const 1)))
      (br_if $done (i32.le_u (global.get $uc_span) (global.get $UC_SPAN_MIN)))
      (global.set $uc_span (i32.shr_u (global.get $uc_span) (i32.const 1)))
      (br $again)))
    (global.set $uc_span (global.get $UC_SPAN))
    (local.get $err))

  (func $uc_decline (param $why i32) (result i32)
    (local $p i32) (local $k i32) (local $R i32) (local $s i32)
    ;; 27 call-indirect: a scan-limit / head-unsupported / no-backedge whose
    ;; scan met an FF /2 it left unlowered (the head's own, for 3)
    (if (i32.or (i32.eq (local.get $why) (i32.const 3))
                (i32.or (i32.eq (local.get $why) (i32.const 4)) (i32.eq (local.get $why) (i32.const 1))))
      (then
        (block $d (loop $l
          (br_if $d (i32.ge_u (local.get $k) (global.get $uc_ninsn)))
          (local.set $R (i32.add (global.get $UC_INSN) (i32.shl (local.get $k) (i32.const 8))))
          (if (i32.eqz (call $uc_kind (local.get $R)))
            (then
              (local.set $s (call $uc_sig (i32.load (local.get $R))))
              (if (i32.and (i32.eq (i32.and (local.get $s) (i32.const 0xFFFF)) (i32.const 0xFF))
                           (i32.eq (i32.and (i32.shr_u (local.get $s) (i32.const 16)) (i32.const 7)) (i32.const 2)))
                (then (local.set $why (i32.const 27)) (br $d)))))
          (br_if $d (i32.eq (local.get $why) (i32.const 3)))
          (local.set $k (i32.add (local.get $k) (i32.const 1)))
          (br $l)))))
    (global.set $uc_last_why (local.get $why))
    (global.set $uc_declined (i32.add (global.get $uc_declined) (i32.const 1)))
    (local.set $p (i32.add (i32.add (global.get $UC_MISC) (i32.const 0xC00))
                           (i32.shl (i32.and (local.get $why) (i32.const 63)) (i32.const 2))))
    (i32.store (local.get $p) (i32.add (i32.load (local.get $p)) (i32.const 1)))
    (i32.const 0))

  ;; Lower the loop at eip and place it in this instance's arena: the program
  ;; address, 0 when the head is declined, or 1 when another thread holds the
  ;; scratch (not a verdict: the head stays eligible). The caller installs it.
  ;; Guest threads are instances over one memory, and in worker mode they run
  ;; at once, so the shared scratch is taken with a try-lock -- a compile is
  ;; rare enough that skipping one beats waiting for it.
  (func $uop_compile (param $eip i32) (result i32)
    (local $pc i32)
    (if (i32.atomic.rmw.cmpxchg (global.get $UC_LOCK) (i32.const 0) (i32.const 1))
      (then (return (i32.const 1))))
    (local.set $pc (call $uc_compile_locked (local.get $eip)))
    (if (i32.and (global.get $uop_census) (i32.eqz (local.get $pc)))
      (then (call $uc_census_unsup (local.get $eip))))
    (i32.atomic.store (global.get $UC_LOCK) (i32.const 0))
    (local.get $pc))

  ;; What stopped the scan: an opcode signature of the instruction at a, as
  ;; op | 0F-second-byte<<8 | ModRM.reg<<16 | first non-66 prefix<<20 | o16<<28.
  ;; (ModRM.reg is recorded whether or not the opcode has one; the census
  ;; tool shows it only for the group opcodes.)
  (func $uc_sig (param $a i32) (result i32)
    (local $b i32) (local $pfx i32) (local $o16 i32) (local $n i32) (local $s i32)
    (local.set $b (call $uc_rd8 (local.get $a)))
    (block $d (loop $l
      (br_if $d (i32.ge_u (local.get $n) (i32.const 4)))
      (if (i32.eq (local.get $b) (i32.const 0x66))
        (then (local.set $o16 (i32.const 1)))
        (else
          (br_if $d (i32.eqz (i32.or (i32.or (i32.or (i32.eq (local.get $b) (i32.const 0x26)) (i32.eq (local.get $b) (i32.const 0x2E)))
                                             (i32.or (i32.eq (local.get $b) (i32.const 0x36)) (i32.eq (local.get $b) (i32.const 0x3E))))
                                     (i32.or (i32.or (i32.or (i32.eq (local.get $b) (i32.const 0x64)) (i32.eq (local.get $b) (i32.const 0x65)))
                                                     (i32.eq (local.get $b) (i32.const 0x67)))
                                             (i32.or (i32.eq (local.get $b) (i32.const 0xF0))
                                                     (i32.or (i32.eq (local.get $b) (i32.const 0xF2)) (i32.eq (local.get $b) (i32.const 0xF3))))))))
          (if (i32.eqz (local.get $pfx)) (then (local.set $pfx (local.get $b))))))
      (local.set $a (i32.add (local.get $a) (i32.const 1)))
      (local.set $b (call $uc_rd8 (local.get $a)))
      (local.set $n (i32.add (local.get $n) (i32.const 1)))
      (br $l)))
    (local.set $s (local.get $b))
    (local.set $a (i32.add (local.get $a) (i32.const 1)))
    (if (i32.eq (local.get $b) (i32.const 0x0F))
      (then (local.set $s (i32.or (local.get $s) (i32.shl (call $uc_rd8 (local.get $a)) (i32.const 8))))
            (local.set $a (i32.add (local.get $a) (i32.const 1)))))
    (local.set $s (i32.or (local.get $s)
      (i32.shl (i32.and (i32.shr_u (call $uc_rd8 (local.get $a)) (i32.const 3)) (i32.const 7)) (i32.const 16))))
    (i32.or (i32.or (local.get $s) (i32.shl (local.get $pfx) (i32.const 20)))
            (i32.shl (local.get $o16) (i32.const 28))))

  ;; Census kind 9, after a decline: every unsupported instruction the scan
  ;; decoded (the head's own for head-unsupported; the ones that cut the loop
  ;; for no-backedge), at most 8 per head: head, signature, address, reason.
  (func $uc_census_unsup (param $eip i32)
    (local $k i32) (local $R i32) (local $n i32)
    (if (i32.eqz (i32.or (i32.or (i32.eq (global.get $uc_last_why) (i32.const 3))
                                 (i32.eq (global.get $uc_last_why) (i32.const 27)))
                         (i32.or (i32.eq (global.get $uc_last_why) (i32.const 4))
                                 (i32.eq (global.get $uc_last_why) (i32.const 1)))))
      (then (return)))
    (block $d (loop $l
      (br_if $d (i32.ge_u (local.get $k) (global.get $uc_ninsn)))
      (br_if $d (i32.ge_u (local.get $n) (i32.const 8)))
      (local.set $R (i32.add (global.get $UC_INSN) (i32.shl (local.get $k) (i32.const 8))))
      (if (i32.eqz (call $uc_kind (local.get $R)))
        (then
          (call $uop_census_ev (i32.const 9) (local.get $eip) (call $uc_sig (i32.load (local.get $R)))
                (i32.load (local.get $R)) (global.get $uc_last_why))
          (local.set $n (i32.add (local.get $n) (i32.const 1)))))
      (local.set $k (i32.add (local.get $k) (i32.const 1)))
      (br $l))))

  (func $uc_compile_locked (param $eip i32) (result i32)
    (local $err i32) (local $bytes i32) (local $pc i32) (local $k i32) (local $R i32)
    (local $lo i32) (local $hi i32) (local $retried i32) (local $wofs i32)
    (if (i32.and (i32.ne (global.get $uc_limit) (i32.const 0))
                 (i32.ge_u (global.get $uc_compiled) (global.get $uc_limit)))
      (then (return (i32.const 0))))
    (local.set $err (call $uc_lower_head (local.get $eip)))
    (if (local.get $err) (then (return (call $uc_decline (local.get $err)))))
    ;; header, code, then (16-aligned) the program's own window slots, so its
    ;; windows survive other programs' runs (07d, top of file)
    (local.set $wofs (i32.and (i32.add (i32.add (global.get $UOP_HDR)
                                                (i32.shl (call $uc_encode_words) (i32.const 2)))
                                       (i32.const 15))
                              (i32.const -16)))
    (local.set $bytes (i32.add (local.get $wofs) (i32.shl (global.get $uc_nwin) (i32.const 4))))
    (if (i32.gt_u (local.get $bytes) (i32.shr_u (global.get $uop_code_bytes) (i32.const 2)))
      (then (return (call $uc_decline (i32.const 24)))))
    (block $placed (loop $retry
      (if (i32.gt_u (i32.add (global.get $uop_alloc) (local.get $bytes)) (global.get $uop_code_bytes))
        (then (call $uop_flush) (global.set $uc_flushes (i32.add (global.get $uc_flushes) (i32.const 1)))))
      (local.set $pc (i32.add (global.get $uop_arena) (global.get $uop_alloc)))
      (memory.fill (local.get $pc) (i32.const 0) (global.get $UOP_HDR))
      (i32.store offset=8 (local.get $pc) (global.get $uc_nwin))
      (global.set $uc_wb (i32.add (local.get $pc) (local.get $wofs)))
      (i32.store offset=12 (local.get $pc) (global.get $uc_wb))
      ;; every slot starts poisoned and a load window (the encoding marks the
      ;; store windows), stamped with the current epoch: poisoned is valid
      ;; under any epoch, so the first entry need not poison again
      (local.set $k (i32.const 0))
      (block $wd (loop $wl
        (br_if $wd (i32.ge_u (local.get $k) (global.get $uc_nwin)))
        (call $uop_window_poison (i32.add (global.get $uc_wb) (i32.shl (local.get $k) (i32.const 4))))
        (i32.store offset=12 (i32.add (global.get $uc_wb) (i32.shl (local.get $k) (i32.const 4))) (i32.const 0))
        (local.set $k (i32.add (local.get $k) (i32.const 1)))
        (br $wl)))
      (i32.store offset=28 (local.get $pc) (i32.atomic.load (global.get $UOP_WIN_EPOCH)))
      (call $uc_encode_write (i32.add (local.get $pc) (global.get $UOP_HDR)))
      ;; the guest byte ranges it was lowered from: a write to any kills it
      (local.set $k (i32.const 0))
      (local.set $lo (i32.const 0))
      (local.set $hi (i32.const 0))
      (block $rd (loop $rl
        (if (i32.lt_u (local.get $k) (global.get $uc_nloop))
          (then (local.set $R (call $uc_loop_insn (local.get $k)))
                (if (i32.and (i32.ne (local.get $k) (i32.const 0)) (i32.eq (local.get $hi) (i32.load (local.get $R))))
                  (then (local.set $hi (i32.load offset=4 (local.get $R)))
                        (local.set $k (i32.add (local.get $k) (i32.const 1)))
                        (br $rl)))))
        (if (local.get $k)
          (then
            (if (i32.eqz (call $uop_add_range (local.get $lo) (local.get $hi) (local.get $pc)))
              (then
                ;; A full table is not a verdict on this head (the engine would
                ;; remember a decline): once more into the emptied table.
                (call $uop_flush)
                (global.set $uc_flushes (i32.add (global.get $uc_flushes) (i32.const 1)))
                (if (local.get $retried) (then (return (call $uc_decline (i32.const 25)))))
                (local.set $retried (i32.const 1))
                (br $retry)))))
        (br_if $placed (i32.ge_u (local.get $k) (global.get $uc_nloop)))
        (local.set $R (call $uc_loop_insn (local.get $k)))
        (local.set $lo (i32.load (local.get $R)))
        (local.set $hi (i32.load offset=4 (local.get $R)))
        (local.set $k (i32.add (local.get $k) (i32.const 1)))
        (br $rl)))))
    (global.set $uop_alloc (i32.and (i32.add (i32.add (global.get $uop_alloc) (local.get $bytes)) (i32.const 15))
                                    (i32.const -16)))
    (global.set $uc_compiled (i32.add (global.get $uc_compiled) (i32.const 1)))
    (global.set $uc_ntraces (i32.add (global.get $uc_ntraces) (global.get $uc_is_trace)))
    (global.set $uc_insns (i32.add (global.get $uc_insns) (global.get $uc_nloop)))
    (global.set $uc_uops (i32.add (global.get $uc_uops) (global.get $uc_nops)))
    (global.set $uc_words (i32.add (global.get $uc_words) (call $uc_encode_words)))
    ;; the muldiv / icall / IAT sites the program kept
    (local.set $k (i32.const 0))
    (block $nd (loop $nl
      (br_if $nd (i32.ge_u (local.get $k) (global.get $uc_nloop)))
      (local.set $R (call $uc_loop_insn (local.get $k)))
      (if (i32.or (i32.eq (call $uc_kind (local.get $R)) (i32.const 25))
                  (i32.eq (call $uc_kind (local.get $R)) (i32.const 26)))
        (then (global.set $uc_n_muldiv (i32.add (global.get $uc_n_muldiv) (i32.const 1)))))
      (if (i32.eq (call $uc_kind (local.get $R)) (i32.const 23))
        (then
          (if (i32.eq (i32.load offset=12 (local.get $R)) (i32.const 1))
            (then (global.set $uc_n_icall (i32.add (global.get $uc_n_icall) (i32.const 1)))))
          (if (i32.eq (i32.load offset=12 (local.get $R)) (i32.const 2))
            (then (global.set $uc_n_iat (i32.add (global.get $uc_n_iat) (i32.const 1)))))))
      (local.set $k (i32.add (local.get $k) (i32.const 1)))
      (br $nl)))
    (if (global.get $uop_census) (then (call $uc_census_shape)))
    ;; the aggressive-stack census of the program kept
    (local.set $k (i32.const 0))
    (block $sd (loop $sl
      (br_if $sd (i32.ge_u (local.get $k) (i32.const 0x50)))
      (local.set $R (i32.add (i32.add (global.get $UC_MISC) (i32.const 0xB00)) (local.get $k)))
      (i32.store (local.get $R)
        (i32.add (i32.load (local.get $R))
                 (i32.load (i32.add (i32.add (global.get $UC_MISC) (i32.const 0xE80)) (local.get $k)))))
      (local.set $k (i32.add (local.get $k) (i32.const 4)))
      (br $sl)))
    (local.get $pc))

  ;; --uop-census only (07d kinds 14 and 15): what the program just placed
  ;; was built from -- every call it kept (E8, icall, IAT) with its target,
  ;; and its instructions as runs of consecutive addresses, so a census can
  ;; say which heads' code now runs inside another head's program.
  (func $uc_census_shape
    (local $k i32) (local $R i32) (local $lo i32) (local $hi i32)
    (block $d (loop $l
      (br_if $d (i32.ge_u (local.get $k) (global.get $uc_nloop)))
      (local.set $R (call $uc_loop_insn (local.get $k)))
      (if (i32.eq (call $uc_kind (local.get $R)) (i32.const 23))
        (then (call $uop_census_ev (i32.const 14) (global.get $uc_head) (i32.load (local.get $R))
                (if (result i32) (i32.load offset=12 (local.get $R))
                  (then (i32.load offset=24 (local.get $R)))
                  (else (call $uc_succ (local.get $R) (i32.const 0))))
                (i32.load offset=12 (local.get $R)))))
      (if (i32.and (i32.ne (local.get $k) (i32.const 0)) (i32.eq (local.get $hi) (i32.load (local.get $R))))
        (then (local.set $hi (i32.load offset=4 (local.get $R))))
        (else
          (if (local.get $k)
            (then (call $uop_census_ev (i32.const 15) (global.get $uc_head) (local.get $lo) (local.get $hi) (i32.const 0))))
          (local.set $lo (i32.load (local.get $R)))
          (local.set $hi (i32.load offset=4 (local.get $R)))))
      (local.set $k (i32.add (local.get $k) (i32.const 1)))
      (br $l)))
    (if (local.get $k)
      (then (call $uop_census_ev (i32.const 15) (global.get $uc_head) (local.get $lo) (local.get $hi) (i32.const 0)))))

  ;; 0 compiled 1 declined 2 insns 3 uops 4 flushes 5 words; 6+i the
  ;; aggressive-stack counter i ($uc_sp_cnt), summed over installed programs
  (func (export "uop_cstat") (param $which i32) (result i32)
    (if (i32.and (i32.ge_u (local.get $which) (i32.const 6)) (i32.lt_u (local.get $which) (i32.const 26)))
      (then (return (i32.load (i32.add (i32.add (global.get $UC_MISC) (i32.const 0xB00))
                                       (i32.shl (i32.sub (local.get $which) (i32.const 6)) (i32.const 2)))))))
    (if (i32.eqz (local.get $which)) (then (return (global.get $uc_compiled))))
    (if (i32.eq (local.get $which) (i32.const 1)) (then (return (global.get $uc_declined))))
    (if (i32.eq (local.get $which) (i32.const 2)) (then (return (global.get $uc_insns))))
    (if (i32.eq (local.get $which) (i32.const 3)) (then (return (global.get $uc_uops))))
    (if (i32.eq (local.get $which) (i32.const 4)) (then (return (global.get $uc_flushes))))
    (if (i32.eq (local.get $which) (i32.const 5)) (then (return (global.get $uc_words))))
    (if (i32.eq (local.get $which) (i32.const 26)) (then (return (global.get $uc_ntraces))))
    (if (i32.eq (local.get $which) (i32.const 27)) (then (return (global.get $uc_n_muldiv))))
    (if (i32.eq (local.get $which) (i32.const 28)) (then (return (global.get $uc_n_icall))))
    (if (i32.eq (local.get $which) (i32.const 29)) (then (return (global.get $uc_n_iat))))
    (if (i32.eq (local.get $which) (i32.const 30)) (then (return (global.get $uc_n_icrej))))
    (if (i32.eq (local.get $which) (i32.const 31)) (then (return (global.get $uc_n_icmega))))
    (i32.const 0))
  ;; Trace heads (on by default; --no-uop-trace-heads / ?no-uop-trace-heads):
  ;; a hot head with no back edge is
  ;; lowered as a forward trace ($uc_form_trace) instead of declined. min/max
  ;; bound the trace in instructions (0 keeps the current value).
  (func (export "set_uop_trace_heads") (param $on i32)
    (global.set $uc_trace (i32.ne (local.get $on) (i32.const 0))))
  (func (export "get_uop_trace_heads") (result i32) (global.get $uc_trace))
  (func (export "set_uop_trace_cut") (param $on i32)
    (global.set $uc_trace_cut (i32.ne (local.get $on) (i32.const 0))))
  (func (export "set_uop_trace_limits") (param $min i32) (param $max i32)
    (if (local.get $min) (then (global.set $uc_trace_min (local.get $min))))
    (if (local.get $max)
      (then (global.set $uc_trace_max
              (select (global.get $UC_MAX_LOOP) (local.get $max)
                      (i32.gt_u (local.get $max) (global.get $UC_MAX_LOOP)))))))
  ;; --aggressive-stack / ?aggressive-stack / aggressiveStack: elide
  ;; push/pop pairs in the programs compiled from now on (drops the rest).
  (func (export "set_aggressive_stack") (param $flag i32)
    (global.set $uc_aggr (i32.ne (local.get $flag) (i32.const 0)))
    (call $uop_flush))
  (func (export "get_aggressive_stack") (result i32) (global.get $uc_aggr))
  ;; --uop-muldiv / --uop-icall / --uop-iat ($uc_muldiv and friends): each
  ;; takes effect for programs compiled from now on (drops the rest).
  (func (export "set_uop_muldiv") (param $flag i32)
    (global.set $uc_muldiv (i32.ne (local.get $flag) (i32.const 0)))
    (call $uop_flush))
  (func (export "get_uop_muldiv") (result i32) (global.get $uc_muldiv))
  (func (export "set_uop_icall") (param $flag i32)
    (global.set $uc_icall (i32.ne (local.get $flag) (i32.const 0)))
    (call $uop_flush))
  (func (export "get_uop_icall") (result i32) (global.get $uc_icall))
  (func (export "set_uop_iat") (param $flag i32)
    (global.set $uc_iat (i32.ne (local.get $flag) (i32.const 0)))
    (call $uop_flush))
  (func (export "get_uop_iat") (result i32) (global.get $uc_iat))
  ;; --no-uop-mmx: kind 27 off for programs compiled from now on.
  (func (export "set_uop_mmx") (param $flag i32)
    (global.set $uc_mmx (i32.ne (local.get $flag) (i32.const 0)))
    (call $uop_flush))
  (func (export "get_uop_mmx") (result i32) (global.get $uc_mmx))
  ;; --no-uop-rep: kind 30 (rep movs/stos -> COPY/FILL) off for programs
  ;; compiled from now on.
  (func (export "set_uop_rep") (param $flag i32)
    (global.set $uc_rep (i32.ne (local.get $flag) (i32.const 0)))
    (call $uop_flush))
  (func (export "get_uop_rep") (result i32) (global.get $uc_rep))
  ;; MMn of this instance's file, for tests.
  (func (export "get_mmx") (param $i i32) (result i64) (call $mmx_get (local.get $i)))
  (func (export "set_mmx") (param $i i32) (param $v i64) (call $mmx_set (local.get $i) (local.get $v)))
  (func (export "uop_decline_count") (param $why i32) (result i32)
    (i32.load (i32.add (i32.add (global.get $UC_MISC) (i32.const 0xC00))
                       (i32.shl (i32.and (local.get $why) (i32.const 63)) (i32.const 2)))))
  (func (export "uop_compile") (param $eip i32) (result i32)
    (call $uop_compile (local.get $eip)))
