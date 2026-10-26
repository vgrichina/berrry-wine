  ;; ============================================================
  ;; LOOP-IDIOM MATCHER (Design A)
  ;; ============================================================
  ;; docs/loop-idiom-superops-design.md
  ;;
  ;; Runs once per block, at the end of $decode_block, over the ops that block
  ;; just emitted. Decode-time only -- nothing here is on the $next path.
  ;;
  ;; Op boundaries come from $OP_INDEX, which $te fills in as it emits (design
  ;; 6.1). That is a RECORD of what the decoder did, so it cannot disagree with
  ;; the stream the way a declared word-count table could.
  ;;
  ;; The role table below is a different kind of thing, and is safe for a
  ;; different reason: it is a matcher-side classification whose default is
  ;; "unknown", and an unknown role declines the whole block. A handler this
  ;; file has never heard of costs a missed lowering, never a mis-walk. Extra
  ;; words are only ever read for handlers this file has classified, so the
  ;; walk cannot desynchronize either.

  ;; -- roles ---------------------------------------------------------------
  (global $LR_UNKNOWN i32 (i32.const 0))
  (global $LR_LOAD8   i32 (i32.const 1))  ;; reg8 = byte [base + disp]
  (global $LR_LOAD8S  i32 (i32.const 2))  ;; reg8 = byte [base + index*scale + disp]
  (global $LR_STORE8  i32 (i32.const 3))  ;; byte [base + disp] = reg8
  (global $LR_ADDI    i32 (i32.const 4))  ;; reg += constant
  (global $LR_ZERO    i32 (i32.const 5))  ;; reg = 0 (xor r,r / sub r,r)
  (global $LR_MIRROR  i32 (i32.const 6))  ;; [absolute] = reg
  (global $LR_JCC     i32 (i32.const 7))  ;; conditional branch
  (global $LR_MEMCTR  i32 (i32.const 8))  ;; inc/dec dword [base + disp]
  (global $LR_CMP     i32 (i32.const 9))  ;; compare two registers
  (global $LR_SHIFT   i32 (i32.const 10)) ;; shift/rotate a register
  (global $LR_ADD     i32 (i32.const 11)) ;; add one register to another

  ;; Set from the host: test/run.js --trace-loopmatch[=0xEIP].
  (global $loop_trace (mut i32) (i32.const 0))
  (global $loop_trace_eip (mut i32) (i32.const 0))
  (global $loop_selfloop_blocks (mut i32) (i32.const 0))
  (global $loop_matched_blocks (mut i32) (i32.const 0))
  (global $loop_lut_bounded_matches (mut i32) (i32.const 0))
  (global $loop_lut_runs (mut i32) (i32.const 0))
  (global $loop_lut_bytes (mut i64) (i64.const 0))
  ;; Diablo's full-screen in-place palette pass uses the compact string-op
  ;; spelling `mov al,[edi] / xlat / stosb / loop`. It is the same semantic
  ;; LUT family as H418, but none of those three implicit-register operations
  ;; has a role in the generic register-dataflow matcher.
  (global $loop_xlat_stosb_matches (mut i32) (i32.const 0))
  (global $loop_xlat_stosb_candidates (mut i32) (i32.const 0))
  (global $loop_xlat_stosb_runs (mut i32) (i32.const 0))
  (global $loop_xlat_stosb_bytes (mut i64) (i64.const 0))
  (global $loop_copy32_matches (mut i32) (i32.const 0))
  (global $loop_copy32_runs (mut i32) (i32.const 0))
  (global $loop_copy32_bytes (mut i64) (i64.const 0))
  (global $loop_avg_matches (mut i32) (i32.const 0))
  (global $loop_avg_runs (mut i32) (i32.const 0))
  (global $loop_avg_pixels (mut i64) (i64.const 0))
  (global $loop_aoe_fill_matches (mut i32) (i32.const 0))
  (global $loop_aoe_fill_runs (mut i32) (i32.const 0))
  (global $loop_aoe_fill_bytes (mut i64) (i64.const 0))
  (global $loop_aoe_span_matches (mut i32) (i32.const 0))
  (global $loop_aoe_span_runs (mut i32) (i32.const 0))
  (global $loop_colorkey8_matches (mut i32) (i32.const 0))
  (global $loop_colorkey8_runs (mut i32) (i32.const 0))
  (global $loop_colorkey8_bytes (mut i64) (i64.const 0))
  ;; Generic balanced x87 expression pipeline. Kept opt-in while the first
  ;; production calibration establishes whole-emulator benefit; the matcher
  ;; still counts candidates with execution disabled.
  (global $x87_pipeline4_emit_enabled (mut i32) (i32.const 0))
  (global $x87_pipeline4_matches (mut i32) (i32.const 0))
  (global $x87_pipeline4_runs (mut i32) (i32.const 0))
  (global $x87_tree4_matches (mut i32) (i32.const 0))
  (global $x87_tree4_runs (mut i32) (i32.const 0))
  (global $x87_island_matches (mut i32) (i32.const 0))
  (global $x87_island_runs (mut i32) (i32.const 0))
  ;; H451 run-time body selector. 1 (default): $x87_island_fast, the
  ;; call-free direct-dispatch body. 0: $x87_island_generic, the original
  ;; per-op $fpu_exec_mem/$fpu_exec_reg walk (--no-x87-island-predecode).
  ;; A run-time choice only -- both bodies read the same records -- so
  ;; flipping it needs no cache flush.
  (global $x87_island_predecode (mut i32) (i32.const 1))
  (global $x87_affine_emit_enabled (mut i32) (i32.const 0))
  (global $x87_affine_prepare_matches (mut i32) (i32.const 0))
  (global $x87_affine_prepare_runs (mut i32) (i32.const 0))
  (global $x87_affine_finish_matches (mut i32) (i32.const 0))
  (global $x87_affine_finish_runs (mut i32) (i32.const 0))
  ;; Bisect gate for x87 fold divergences (--x87-fuse-debug=MASK,LO,HI). MASK
  ;; picks families -- 1 pipeline4, 2 short (449 modes 1-3), 4 tree4, 8 affine,
  ;; 16 island -- and only blocks whose guest start lies in [LO,HI) are offered
  ;; to them. Defaults leave every family and address in, so it is inert.
  (global $x87_fuse_dbg_mask (mut i32) (i32.const -1))
  (global $x87_fuse_dbg_lo (mut i32) (i32.const 0))
  (global $x87_fuse_dbg_hi (mut i32) (i32.const -1))
  ;; LUT_RUN and COPY_RUN have independent gates. The role-proved LUT lowering
  ;; is on by default; COPY remains off while its historical Storm divergence
  ;; is investigated. set_loop_emit still controls both for compatibility.
  (global $loop_lut_emit_enabled (mut i32) (i32.const 1))
  ;; Exact MW3 folds are app-opted-in on the main instance, but guest threads
  ;; execute in separate WebAssembly instances. Keep both their process gate
  ;; (bit 0) and the historically divergent generic COPY/AVG experiment gate
  ;; (bit 1) in shared memory so every decoder sees the same value. Production
  ;; only enables bit 0; bit 1 exists for focused semantic/benchmark A/Bs.
  (global $LOOP_PROCESS_STATE i32 (region.addr $LOOP_PROCESS_STATE 0))
  (global $LOOP_PROCESS_STATE_SIZE i32 (region.size $LOOP_PROCESS_STATE))
  ;; Base+disp dword load/store, either spelling: generic H26/H27 carry
  ;; (data<<4)|base in the operand; the retired base-specialised slots
  ;; 339..354 carried the base in the handler index and the data register in
  ;; the operand. The decoder emits only H26/H27 now; the second form is kept
  ;; readable so a matcher never depends on which one it is looking at.
  ;; Three spellings now: H26/H27 with the displacement in the next word,
  ;; H467/H468 with it packed above bit 8 of the operand, and the retired
  ;; 339..354 slots. $lm_*_disp reads the displacement wherever it is.
  (func $lm_load32_disp (param $fn i32) (param $op i32) (param $p i32) (result i32)
    (if (i32.eq (local.get $fn) (i32.const 467))
      (then (return (i32.shr_s (local.get $op) (i32.const 8)))))
    (i32.load offset=8 (local.get $p)))
  (func $lm_store32_disp (param $fn i32) (param $op i32) (param $p i32) (result i32)
    (if (i32.eq (local.get $fn) (i32.const 468))
      (then (return (i32.shr_s (local.get $op) (i32.const 8)))))
    (i32.load offset=8 (local.get $p)))
  (func $lm_load32_base (param $fn i32) (param $op i32) (result i32)
    (if (i32.or (i32.eq (local.get $fn) (i32.const 26)) (i32.eq (local.get $fn) (i32.const 467)))
      (then (return (i32.and (local.get $op) (i32.const 0xF)))))
    (if (i32.and (i32.ge_u (local.get $fn) (global.get $TH_LOAD32_RO_BASE))
                 (i32.le_u (local.get $fn) (global.get $TH_LOAD32_RO_BASE_LAST)))
      (then (return (i32.sub (local.get $fn) (global.get $TH_LOAD32_RO_BASE)))))
    (i32.const -1))
  (func $lm_load32_data (param $fn i32) (param $op i32) (result i32)
    (if (i32.or (i32.eq (local.get $fn) (i32.const 26)) (i32.eq (local.get $fn) (i32.const 467)))
      (then (return (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))))
    (local.get $op))
  (func $lm_store32_base (param $fn i32) (param $op i32) (result i32)
    (if (i32.or (i32.eq (local.get $fn) (i32.const 27)) (i32.eq (local.get $fn) (i32.const 468)))
      (then (return (i32.and (local.get $op) (i32.const 0xF)))))
    (if (i32.and (i32.ge_u (local.get $fn) (global.get $TH_STORE32_RO_BASE))
                 (i32.le_u (local.get $fn) (global.get $TH_STORE32_RO_BASE_LAST)))
      (then (return (i32.sub (local.get $fn) (global.get $TH_STORE32_RO_BASE)))))
    (i32.const -1))
  (func $lm_store32_data (param $fn i32) (param $op i32) (result i32)
    (if (i32.or (i32.eq (local.get $fn) (i32.const 27)) (i32.eq (local.get $fn) (i32.const 468)))
      (then (return (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))))
    (local.get $op))

  (func $loop_copy_emit_get (result i32)
    (i32.and (i32.atomic.load (global.get $LOOP_PROCESS_STATE)) (i32.const 1)))
  (func $loop_copy_emit_set (param $flag i32)
    (local $state i32)
    (local.set $state (i32.atomic.load (global.get $LOOP_PROCESS_STATE)))
    (i32.atomic.store (global.get $LOOP_PROCESS_STATE)
      (if (result i32) (local.get $flag)
        (then (i32.or (local.get $state) (i32.const 1)))
        (else (i32.and (local.get $state) (i32.const 0xfffffffe))))))
  (func $loop_generic_copy_emit_get (result i32)
    (i32.and (i32.atomic.load (global.get $LOOP_PROCESS_STATE)) (i32.const 2)))
  (func $loop_generic_copy_emit_set (param $flag i32)
    (local $state i32)
    (local.set $state (i32.atomic.load (global.get $LOOP_PROCESS_STATE)))
    (i32.atomic.store (global.get $LOOP_PROCESS_STATE)
      (if (result i32) (local.get $flag)
        (then (i32.or (local.get $state) (i32.const 2)))
        (else (i32.and (local.get $state) (i32.const 0xfffffffd))))))
  ;; Exact six-op AoE grid-fill lowering. Independently switchable for
  ;; same-process semantic and timing A/Bs; the production default is on.
  (global $loop_aoe_fill_emit_enabled (mut i32) (i32.const 1))
  (global $loop_aoe_span_emit_enabled (mut i32) (i32.const 1))
  ;; MSVC's Pentium/MMX memcpy copies 64-byte cache lines with eight MOVQ
  ;; loads/stores.  On an interpreter that loop is sixteen dispatches per
  ;; line; retain the exact CPU/MMX state while using Wasm bulk memory for the
  ;; proved-disjoint common case.
  (global $mmx_copy64_enabled (mut i32) (i32.const 1))
  (global $mmx_copy64_matches (mut i32) (i32.const 0))
  (global $mmx_copy64_runs (mut i32) (i32.const 0))
  (global $mmx_copy64_lines (mut i64) (i64.const 0))
  (global $mmx_copy64_bytes (mut i64) (i64.const 0))
  ;; UE1 SoftDrv's `movq [r],mmN / add r,8 / dec c / jnz` surface clear
  ;; ($try_emit_mmx_fill64, executed by H419 op 0x80000005). The guest loop
  ;; is one self-loop block per qword; the lowering writes page-local runs of
  ;; the 8-byte pattern with v128 stores.
  (global $mmx_fill64_enabled (mut i32) (i32.const 1))
  (global $mmx_fill64_matches (mut i32) (i32.const 0))
  (global $mmx_fill64_runs (mut i32) (i32.const 0))
  (global $mmx_fill64_qwords (mut i64) (i64.const 0))
  (global $mmx_fill64_bulk_qwords (mut i64) (i64.const 0))

  ;; Decode-time FNV-1a over guest bytes. Exact binary-specific folds use this
  ;; after cheap anchor checks so accepting a fold proves the complete body,
  ;; not just a handful of instruction words sampled from it.
  (func $loop_hash_bytes (param $start i32) (param $length i32) (result i32)
    (local $p i32) (local $end i32) (local $hash i32)
    (local.set $p (local.get $start))
    (local.set $end (i32.add (local.get $start) (local.get $length)))
    (local.set $hash (i32.const 0x811C9DC5))
    (block $done
      (loop $bytes
        (br_if $done (i32.ge_u (local.get $p) (local.get $end)))
        (local.set $hash
          (i32.mul
            (i32.xor (local.get $hash) (call $gl8 (local.get $p)))
            (i32.const 0x01000193)))
        (local.set $p (i32.add (local.get $p) (i32.const 1)))
        (br $bytes)))
    (local.get $hash))

  ;; Exact, address-independent proof of the MSVC 64-byte MMX memcpy body:
  ;;
  ;;   prefetchnta [esi+238h]
  ;;   movq mm0..mm3,[esi+0..18h] / stores to [edi+0..18h]
  ;;   movq mm0..mm3,[esi+20h..38h] / stores to [edi+20h..38h]
  ;;   add esi,40h / add edi,40h / dec ecx / jnz body
  ;;
  ;; The whole 78-byte hash prevents a similar-looking near miss from being
  ;; lowered.  No image address is part of the recognizer.
  (func $try_emit_mmx_copy64 (param $start_eip i32) (result i32)
    (if (i32.or (i32.eqz (global.get $mmx_copy64_enabled))
                (global.get $code16))
      (then (return (i32.const 0))))
    (if (i32.ne (call $gl32 (local.get $start_eip)) (i32.const 0x3886180F))
      (then (return (i32.const 0))))
    (if (i32.ne (call $gl32 (i32.add (local.get $start_eip) (i32.const 74)))
                (i32.const 0xB2754940))
      (then (return (i32.const 0))))
    (if (i32.ne (call $loop_hash_bytes (local.get $start_eip) (i32.const 78))
                (i32.const 0x4E398899))
      (then (return (i32.const 0))))
    (global.set $mmx_copy64_matches
      (i32.add (global.get $mmx_copy64_matches) (i32.const 1)))
    ;; H419's negative operand namespace is reserved for exact MMX copies.
    ;; ...0000 is the Jazz masked row; ...0001 is this straight memcpy.
    (call $te (global.get $LOOP_SUPEROP_COPY) (i32.const 0x80000001))
    (call $te_raw (i32.add (local.get $start_eip) (i32.const 78)))
    (call $te_raw (local.get $start_eip))
    (global.set $d_pc (i32.add (local.get $start_eip) (i32.const 78)))
    (i32.const 1))

  ;; Streaming sibling selected when CPUID advertises SSE: eight MOVQ loads,
  ;; eight MOVNTQ stores, and an EAX-counted 64-byte inner loop. UT2003.exe and
  ;; D3DDrv.dll contain the same address-independent 71-byte body.
  (func $try_emit_mmx_stream_copy64 (param $start_eip i32) (result i32)
    (if (i32.or (i32.eqz (global.get $mmx_copy64_enabled))
                (global.get $code16))
      (then (return (i32.const 0))))
    (if (i32.ne (call $gl32 (local.get $start_eip)) (i32.const 0x0F066F0F))
      (then (return (i32.const 0))))
    (if (i32.ne (call $gl32 (i32.add (local.get $start_eip) (i32.const 67)))
                (i32.const 0xB9754840))
      (then (return (i32.const 0))))
    (if (i32.ne (call $loop_hash_bytes (local.get $start_eip) (i32.const 71))
                (i32.const 0xD68032EC))
      (then (return (i32.const 0))))
    (global.set $mmx_copy64_matches
      (i32.add (global.get $mmx_copy64_matches) (i32.const 1)))
    (call $te (global.get $LOOP_SUPEROP_COPY) (i32.const 0x80000002))
    (call $te_raw (i32.add (local.get $start_eip) (i32.const 71)))
    (call $te_raw (local.get $start_eip))
    (global.set $d_pc (i32.add (local.get $start_eip) (i32.const 71)))
    (i32.const 1))

  ;; D3DDrv's SSE-selected sibling pipelines three MMX registers around the
  ;; pointer bumps and uses negative offsets for the remainder of each line.
  ;; The full 79-byte proof includes that ordering because it changes both
  ;; overlap behavior and which source qwords remain in mm0..mm2.
  (func $try_emit_mmx_pipelined_copy64 (param $start_eip i32) (result i32)
    (if (i32.or (i32.eqz (global.get $mmx_copy64_enabled))
                (global.get $code16))
      (then (return (i32.const 0))))
    (if (i32.ne (call $gl32 (local.get $start_eip)) (i32.const 0x3886180F))
      (then (return (i32.const 0))))
    (if (i32.ne (call $gl32 (i32.add (local.get $start_eip) (i32.const 75)))
                (i32.const 0xB175F84F))
      (then (return (i32.const 0))))
    (if (i32.ne (call $loop_hash_bytes (local.get $start_eip) (i32.const 79))
                (i32.const 0x80AC549E))
      (then (return (i32.const 0))))
    (global.set $mmx_copy64_matches
      (i32.add (global.get $mmx_copy64_matches) (i32.const 1)))
    (call $te (global.get $LOOP_SUPEROP_COPY) (i32.const 0x80000003))
    (call $te_raw (i32.add (local.get $start_eip) (i32.const 79)))
    (call $te_raw (local.get $start_eip))
    (global.set $d_pc (i32.add (local.get $start_eip) (i32.const 79)))
    (i32.const 1))

  ;; UE1 SoftDrv's MMX clear (Deus Ex demo softdrv+0x10d3ed70 and +0x10d3eec0,
  ;; Unreal SE softdrv+0x10931ed0 and +0x10931ff0):
  ;;
  ;;   movq [r],mmN / add r,8 / dec c / jnz body        0F 7F /N  83 C0+r 08  48+c  75 F7
  ;;
  ;; Every byte is proved; only the three register fields vary. The base may
  ;; not be ESP/EBP (their ModRM mod=00 encodings are SIB/disp32, a different
  ;; instruction), and the counter may not be the base or ESP. A near miss --
  ;; another displacement, stride, counter op or branch -- decodes normally.
  ;; Operands after H419's 0x80000005 tag: fall, back, r | c<<4 | N<<8.
  (func $try_emit_mmx_fill64 (param $start_eip i32) (result i32)
    (local $modrm i32) (local $r i32) (local $c i32) (local $mm i32)
    (if (i32.or (i32.eqz (global.get $mmx_fill64_enabled))
                (global.get $code16))
      (then (return (i32.const 0))))
    (if (i32.ne (call $gl16 (local.get $start_eip)) (i32.const 0x7F0F))
      (then (return (i32.const 0))))
    (local.set $modrm (call $gl8 (i32.add (local.get $start_eip) (i32.const 2))))
    (if (i32.ne (i32.and (local.get $modrm) (i32.const 0xC0)) (i32.const 0))
      (then (return (i32.const 0))))
    (local.set $r (i32.and (local.get $modrm) (i32.const 7)))
    (local.set $mm (i32.and (i32.shr_u (local.get $modrm) (i32.const 3)) (i32.const 7)))
    (if (i32.ge_u (local.get $r) (i32.const 4))
      (then (if (i32.le_u (local.get $r) (i32.const 5)) (then (return (i32.const 0))))))
    ;; add r,8 (83 /0 ib, register form)
    (if (i32.ne (call $gl8 (i32.add (local.get $start_eip) (i32.const 3))) (i32.const 0x83))
      (then (return (i32.const 0))))
    (if (i32.ne (call $gl8 (i32.add (local.get $start_eip) (i32.const 4)))
                (i32.or (i32.const 0xC0) (local.get $r)))
      (then (return (i32.const 0))))
    (if (i32.ne (call $gl8 (i32.add (local.get $start_eip) (i32.const 5))) (i32.const 0x08))
      (then (return (i32.const 0))))
    ;; dec c (48+c)
    (local.set $c (i32.sub (call $gl8 (i32.add (local.get $start_eip) (i32.const 6))) (i32.const 0x48)))
    (if (i32.ge_u (local.get $c) (i32.const 8)) (then (return (i32.const 0))))
    (if (i32.or (i32.eq (local.get $c) (local.get $r)) (i32.eq (local.get $c) (i32.const 4)))
      (then (return (i32.const 0))))
    ;; jnz back to the movq (rel8 -9)
    (if (i32.ne (call $gl16 (i32.add (local.get $start_eip) (i32.const 7))) (i32.const 0xF775))
      (then (return (i32.const 0))))
    (global.set $mmx_fill64_matches
      (i32.add (global.get $mmx_fill64_matches) (i32.const 1)))
    (call $te (global.get $LOOP_SUPEROP_COPY) (i32.const 0x80000005))
    (call $te_raw (i32.add (local.get $start_eip) (i32.const 9)))
    (call $te_raw (local.get $start_eip))
    (call $te_raw
      (i32.or (local.get $r)
        (i32.or (i32.shl (local.get $c) (i32.const 4))
                (i32.shl (local.get $mm) (i32.const 8)))))
    (global.set $d_pc (i32.add (local.get $start_eip) (i32.const 9)))
    (i32.const 1))

  ;; AoE I and II use the same span-list data structure and clipping algorithm,
  ;; but their MSVC builds assigned x/min/max registers differently and only
  ;; AoE I scales the row register before lookup. Recognize either exact prefix
  ;; and pass that register-layout mode to one parameterized handler. All exits
  ;; are entry-relative, so no binary address lives in core.
  (func $try_emit_aoe_span_prefix (param $start_eip i32) (result i32)
    (local $mode i32)
    (if (i32.or
          (i32.eqz (global.get $loop_aoe_span_emit_enabled))
          (global.get $code16))
      (then (return (i32.const 0))))
    ;; Shared push/mov/prologue bytes.
    (if (i32.or
          (i32.ne (call $gl32 (local.get $start_eip)) (i32.const 0x8B565553))
          (i32.ne (call $gl32 (i32.add (local.get $start_eip) (i32.const 4)))
                  (i32.const 0x7C8B57F1)))
      (then (return (i32.const 0))))

    ;; Mode 1: AoE I, EAX=x0 and EDI=row*4.
    (if (i32.and
          (i32.eq (call $gl32 (i32.add (local.get $start_eip) (i32.const 0x20)))
                  (i32.const 0x1424448B))
          (i32.and
            (i32.eq (call $gl32 (i32.add (local.get $start_eip) (i32.const 0x50)))
                    (i32.const 0x14244C89))
            (i32.and
              (i32.eq (call $gl32 (i32.add (local.get $start_eip) (i32.const 0x5e)))
                      (i32.const 0xC13C468B))
              (i32.eq (call $gl32 (i32.add (local.get $start_eip) (i32.const 0x67)))
                      (i32.const 0x3C75DB85)))))
      (then (local.set $mode (i32.const 1))))

    ;; Mode 2: AoE II, EBX=x0 and EDI=row.
    (if (i32.and
          (i32.eq (call $gl32 (i32.add (local.get $start_eip) (i32.const 0x20)))
                  (i32.const 0x18246C8B))
          (i32.and
            (i32.eq (call $gl32 (i32.add (local.get $start_eip) (i32.const 0x50)))
                    (i32.const 0x14244489))
            (i32.and
              (i32.eq (call $gl32 (i32.add (local.get $start_eip) (i32.const 0x60)))
                      (i32.const 0x8B3C468B))
              (i32.eq (call $gl16 (i32.add (local.get $start_eip) (i32.const 0x67)))
                      (i32.const 0x75C0)))))
      (then (local.set $mode (i32.const 2))))
    (if (i32.eqz (local.get $mode)) (then (return (i32.const 0))))

    ;; The anchors above select the register-layout variant cheaply; the hash
    ;; proves every byte of the complete replaced prefix. These are the FNV-1a
    ;; digests of the 0x6b-byte AoE I and 0x6a-byte AoE II retail bodies used by
    ;; the differential regression below.
    (if (i32.ne
          (call $loop_hash_bytes (local.get $start_eip)
            (select (i32.const 0x6b) (i32.const 0x6a)
              (i32.eq (local.get $mode) (i32.const 1))))
          (select (i32.const 0x99364898) (i32.const 0xe76d1b61)
            (i32.eq (local.get $mode) (i32.const 1))))
      (then (return (i32.const 0))))

    (global.set $loop_aoe_span_matches
      (i32.add (global.get $loop_aoe_span_matches) (i32.const 1)))
    (call $te (i32.const 438) (local.get $mode))
    (call $te_raw (local.get $start_eip))
    (global.set $d_pc
      (i32.add (local.get $start_eip)
        (select (i32.const 0x6b) (i32.const 0x6a)
          (i32.eq (local.get $mode) (i32.const 1)))))
    (i32.const 1))

  ;; A branch-split 8-bit color-key row used by Alpha Centauri's FLC/menu
  ;; compositor. The conditional store keeps it outside the self-loop matcher:
  ;;
  ;;   cmp byte [edi],ah; jne +2; mov [edi],al; inc edi; dec esi; jne head
  ;;
  ;; Match the complete encoding, but derive both continuations from the block
  ;; address. Another binary emitting these ten bytes gets the same semantics.
  (func $try_emit_colorkey8_run (param $start_eip i32) (result i32)
    (if (i32.or (global.get $code16) (call $fold_off (i32.const 0x08)))
      (then (return (i32.const 0))))
    (if (i32.or
          (i32.ne (call $gl32 (local.get $start_eip)) (i32.const 0x02752738))
          (i32.or
            (i32.ne (call $gl32 (i32.add (local.get $start_eip) (i32.const 4)))
              (i32.const 0x4e470788))
            (i32.ne (call $gl16 (i32.add (local.get $start_eip) (i32.const 8)))
              (i32.const 0xf675))))
      (then (return (i32.const 0))))
    (global.set $loop_colorkey8_matches
      (i32.add (global.get $loop_colorkey8_matches) (i32.const 1)))
    (call $te (i32.const 443) (i32.const 0))
    (call $te_raw (i32.add (local.get $start_eip) (i32.const 10))) ;; fall
    (call $te_raw (local.get $start_eip))                          ;; restart
    (global.set $d_pc (i32.add (local.get $start_eip) (i32.const 10)))
    (i32.const 1))

  ;; Is this handler index a conditional branch? 44 is the generic form
  ;; (operand = cc); 307..322 are the per-condition specializations. All read
  ;; the same two extra words: fall-through, then target.
  (func $loop_is_jcc (param $fn i32) (result i32)
    (i32.or
      (i32.eq (local.get $fn) (i32.const 44))
      (i32.and
        (i32.ge_u (local.get $fn) (i32.const 307))
        (i32.le_u (local.get $fn) (i32.const 322)))))

  ;; Classify one handler index. Everything not named here is UNKNOWN.
  (func $loop_role (param $fn i32) (param $op i32) (result i32)
    (if (i32.eq (local.get $fn) (i32.const 28))
      (then (return (global.get $LR_LOAD8))))
    ;; 149 computes a SIB effective address. With bit 8 of the operand set it
    ;; also performs the byte load itself -- the fused form the decoder emits
    ;; for the overwhelmingly common consumer, and the one a LUT lookup takes.
    ;; Without bit 8 the load lives in the NEXT op, which this matcher does not
    ;; model, so decline.
    (if (i32.eq (local.get $fn) (i32.const 149))
      (then
        (if (i32.and (local.get $op) (i32.const 0x100))
          (then (return (global.get $LR_LOAD8S))))
        (return (global.get $LR_UNKNOWN))))
    (if (i32.eq (local.get $fn) (i32.const 29))
      (then (return (global.get $LR_STORE8))))
    (if (i32.or (i32.eq (local.get $fn) (i32.const 64))
                (i32.eq (local.get $fn) (i32.const 65)))
      (then (return (global.get $LR_ADDI))))
    (if (i32.eq (local.get $fn) (i32.const 19))
      (then (return (global.get $LR_CMP))))
    (if (i32.eq (local.get $fn) (i32.const 53))
      (then (return (global.get $LR_SHIFT))))
    (if (i32.eq (local.get $fn) (i32.const 12))
      (then (return (global.get $LR_ADD))))
    ;; xor r,r and sub r,r are the zeroing idiom, not arithmetic (design 9.5),
    ;; but only when both operands name the same register.
    (if (i32.or (i32.eq (local.get $fn) (i32.const 18))
                (i32.eq (local.get $fn) (i32.const 17)))
      (then
        (if (i32.eq (i32.shr_u (local.get $op) (i32.const 4))
                    (i32.and (local.get $op) (i32.const 0xF)))
          (then (return (global.get $LR_ZERO))))
        (return (global.get $LR_UNKNOWN))))
    ;; STORE32 to an absolute address -- the spill-to-global "mirror" store.
    (if (i32.eq (local.get $fn) (i32.const 21))
      (then (return (global.get $LR_MIRROR))))
    ;; 135 is inc/dec/not/neg of a dword in memory; only the two counting forms
    ;; (uop 0 = inc, 1 = dec) are a role. A trip counter that lives on the
    ;; stack instead of in a register is the normal shape once a loop body has
    ;; run out of registers, which is exactly when the body is worth lowering.
    (if (i32.eq (local.get $fn) (i32.const 135))
      (then
        (if (i32.le_u (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF))
                      (i32.const 1))
          (then (return (global.get $LR_MEMCTR))))
        (return (global.get $LR_UNKNOWN))))
    (if (call $loop_is_jcc (local.get $fn))
      (then (return (global.get $LR_JCC))))
    (global.get $LR_UNKNOWN))

  ;; One threaded-code op, as $te writes it (04-cache.wat :: $te). size-of is 8,
  ;; which is exactly the bump $te makes after storing the pair — an op's header
  ;; is two words and nothing else is guaranteed to follow it.
  ;;
  ;; ONLY the header is a layout, deliberately, and the rest of the record is
  ;; not a struct at all. Handlers pull extra words with $te_raw, and both the
  ;; arity and the meaning are chosen by the handler index at +0:
  ;;
  ;;   +8 is the fall-through EIP for Jcc (fn 307..322, 07-decoder.wat:4257)
  ;;      but the branch TARGET for LOOP (fn 46, 07-decoder.wat:4270, read at
  ;;      05-alu.wat:929) — the same offset with the pair in the opposite order;
  ;;   +8 is a packed base|index<<4|scale<<8 SIB info word for fn 149/363/389/420
  ;;      ($sib_info_word, 07-decoder.wat:1522; read 06b-core-handlers.wat:281),
  ;;      a plain disp32 for the _ro family (06b-core-handlers.wat:1589), and a
  ;;      raw absolute address or $SIB_SENTINEL for fn 20/21 (05-alu.wat:386);
  ;;   fn 407 puts fall/target at +16/+20 instead (07-decoder.wat:1782), and the
  ;;      payload arity runs 0,1,2,3,4,6,7 words with no length field and at
  ;;      least three conditional-arity emitters (07-decoder.wat:2094, 1957, 562).
  ;;
  ;; That is why OP_INDEX exists at all: the stream is not self-describing, so
  ;; nothing can walk it structurally (04-cache.wat:876). Every +8 read in this
  ;; file is already guarded by an equality test on the handler index just above
  ;; it, and 07-decoder.wat:5305 documents what happens to code that infers the
  ;; shape positionally instead. So the trailing words are a discriminated union
  ;; keyed by `handler` — §5.4's variant shape — but with a computed tag rather
  ;; than a stored type word, which is also why wave 5's variant gate cannot
  ;; attribute them. They stay hand-spelled until a variant declaration can name
  ;; each arm from evidence; --gate leaves them alone because an undeclared
  ;; offset is not a convertible site.
  (layout LoopOp
    (field handler i32)    ;; +0  handler-table index; $te's $fn, $loop_is_jcc's arg
    (field operand i32))   ;; +4  packed operand; $te's $op, masked 0xF for regs

  ;; Address of op i in the block just emitted.
  (func $loop_op_at (param $i i32) (result i32)
    (i32.load
      (i32.add (global.get $OP_INDEX)
        (i32.shl (local.get $i) (i32.const 2)))))

  ;; Every x87 fuser, in the order the decoder has always run them, behind the
  ;; bisect gate above.
  (func $x87_fuse_pass (param $eip i32)
    (if (i32.or (i32.lt_u (local.get $eip) (global.get $x87_fuse_dbg_lo))
                (i32.ge_u (local.get $eip) (global.get $x87_fuse_dbg_hi)))
      (then (return)))
    (if (i32.and (global.get $x87_fuse_dbg_mask) (i32.const 1))
      (then (call $x87_fuse_block)))
    (if (i32.and (global.get $x87_fuse_dbg_mask) (i32.const 2))
      (then (call $x87_short_fuse_block)))
    (if (i32.and (global.get $x87_fuse_dbg_mask) (i32.const 4))
      (then (call $x87_tree4_fuse_block)))
    (if (i32.and (global.get $x87_fuse_dbg_mask) (i32.const 8))
      (then (call $x87_affine_fuse_block)))
    (if (i32.and (global.get $x87_fuse_dbg_mask) (i32.const 16))
      (then (call $x87_island_fuse_block))))

  (func (export "set_x87_fuse_debug") (param $mask i32) (param $lo i32) (param $hi i32)
    (global.set $x87_fuse_dbg_mask (local.get $mask))
    (global.set $x87_fuse_dbg_lo (local.get $lo))
    (global.set $x87_fuse_dbg_hi (local.get $hi))
    (call $clear_cache))

  ;; Normalize H188/H190 into group|operation|address-shape fields. The low
  ;; nibble is a base register, or 8 for a decoder-resolved absolute address.
  ;; A SIB_SENTINEL depends on a separate preceding EA handler and therefore
  ;; cannot be part of this first contiguous semantic family.
  (func $x87_mem_desc (param $p i32) (result i32)
    (local $fn i32) (local $op i32)
    (local.set $fn (load.field LoopOp handler (local.get $p)))
    (local.set $op (load.field.memarg LoopOp operand (local.get $p)))
    (if (i32.eq (local.get $fn) (i32.const 190))
      (then (return (i32.and (local.get $op) (i32.const 0xFFF)))))
    (if (i32.eq (local.get $fn) (i32.const 188))
      (then
        (if (i32.eq (i32.load offset=8 (local.get $p)) (global.get $SIB_SENTINEL))
          (then (return (i32.const -1))))
        (return
          (i32.or
            (i32.shl (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 8))
            (i32.or
              (i32.shl (i32.and (local.get $op) (i32.const 0xF)) (i32.const 4))
              (i32.const 8))))))
    (i32.const -1))

  (func $x87_pipeline_arith_op (param $desc i32) (result i32)
    (local $group i32) (local $op i32)
    (local.set $group (i32.and (i32.shr_u (local.get $desc) (i32.const 8)) (i32.const 0xF)))
    (local.set $op (i32.and (i32.shr_u (local.get $desc) (i32.const 4)) (i32.const 0xF)))
    (if (i32.and
          (i32.or (i32.eqz (local.get $group)) (i32.eq (local.get $group) (i32.const 4)))
          (i32.or
            (i32.or (i32.eqz (local.get $op)) (i32.eq (local.get $op) (i32.const 1)))
            (i32.ge_u (local.get $op) (i32.const 4))))
      (then (return (local.get $op))))
    (i32.const -1))

  (func $x87_pipeline_load_desc (param $desc i32) (result i32)
    (i32.and
      (i32.or
        (i32.eq (i32.shr_u (local.get $desc) (i32.const 8)) (i32.const 1))
        (i32.eq (i32.shr_u (local.get $desc) (i32.const 8)) (i32.const 5)))
      (i32.eq
        (i32.and (i32.shr_u (local.get $desc) (i32.const 4)) (i32.const 0xF))
        (i32.const 0))))

  (func $x87_pipeline_storepop_desc (param $desc i32) (result i32)
    (i32.and
      (i32.or
        (i32.eq (i32.shr_u (local.get $desc) (i32.const 8)) (i32.const 1))
        (i32.eq (i32.shr_u (local.get $desc) (i32.const 8)) (i32.const 5)))
      (i32.eq
        (i32.and (i32.shr_u (local.get $desc) (i32.const 4)) (i32.const 0xF))
        (i32.const 3))))

  ;; Replace every proven contiguous
  ;;
  ;;   FLD mem; FADD/FMUL/FSUB/FDIV mem; same; FSTP mem
  ;;
  ;; with one semantic handler. The original 48-byte threaded payload remains
  ;; in place; only its first handler/operand are rewritten, so no later op
  ;; address or block ownership changes. The fused handler consumes the four
  ;; raw address words and advances directly to the following op.
  (func $x87_fuse_block
    (local $i i32) (local $n i32)
    (local $p0 i32) (local $p1 i32) (local $p2 i32) (local $p3 i32)
    (local $d0 i32) (local $d1 i32) (local $d2 i32) (local $d3 i32)
    (local $a1 i32) (local $a2 i32) (local $packed i32)
    (if (global.get $op_index_poison) (then (return)))
    (local.set $n (global.get $op_index_n))
    (block $done (loop $scan
      (br_if $done (i32.gt_u (i32.add (local.get $i) (i32.const 4)) (local.get $n)))
      (local.set $p0 (call $loop_op_at (local.get $i)))
      (local.set $p1 (call $loop_op_at (i32.add (local.get $i) (i32.const 1))))
      (local.set $p2 (call $loop_op_at (i32.add (local.get $i) (i32.const 2))))
      (local.set $p3 (call $loop_op_at (i32.add (local.get $i) (i32.const 3))))
      (if (i32.and
            (i32.eq (local.get $p1) (i32.add (local.get $p0) (i32.const 12)))
            (i32.and
              (i32.eq (local.get $p2) (i32.add (local.get $p1) (i32.const 12)))
              (i32.eq (local.get $p3) (i32.add (local.get $p2) (i32.const 12)))))
        (then
          (local.set $d0 (call $x87_mem_desc (local.get $p0)))
          (local.set $d1 (call $x87_mem_desc (local.get $p1)))
          (local.set $d2 (call $x87_mem_desc (local.get $p2)))
          (local.set $d3 (call $x87_mem_desc (local.get $p3)))
          (local.set $a1 (call $x87_pipeline_arith_op (local.get $d1)))
          (local.set $a2 (call $x87_pipeline_arith_op (local.get $d2)))
          (if (i32.and
                (i32.and
                  (i32.or
                    (i32.eq (i32.shr_u (local.get $d0) (i32.const 8)) (i32.const 1))
                    (i32.eq (i32.shr_u (local.get $d0) (i32.const 8)) (i32.const 5)))
                  (i32.eq (i32.and (i32.shr_u (local.get $d0) (i32.const 4)) (i32.const 0xF)) (i32.const 0)))
                (i32.and
                  (i32.and (i32.ge_s (local.get $a1) (i32.const 0))
                           (i32.ge_s (local.get $a2) (i32.const 0)))
                  (i32.and
                    (i32.or
                      (i32.eq (i32.shr_u (local.get $d3) (i32.const 8)) (i32.const 1))
                      (i32.eq (i32.shr_u (local.get $d3) (i32.const 8)) (i32.const 5)))
                    (i32.eq (i32.and (i32.shr_u (local.get $d3) (i32.const 4)) (i32.const 0xF)) (i32.const 3)))))
            (then
              (global.set $x87_pipeline4_matches
                (i32.add (global.get $x87_pipeline4_matches) (i32.const 1)))
              (if (global.get $x87_pipeline4_emit_enabled)
                (then
                  (local.set $packed
                    (i32.or
                      (i32.and (local.get $d0) (i32.const 0xF))
                      (i32.or
                        (i32.shl (i32.and (local.get $d1) (i32.const 0xF)) (i32.const 4))
                        (i32.or
                          (i32.shl (i32.and (local.get $d2) (i32.const 0xF)) (i32.const 8))
                          (i32.or
                            (i32.shl (i32.and (local.get $d3) (i32.const 0xF)) (i32.const 12))
                            (i32.or
                              (i32.shl (local.get $a1) (i32.const 16))
                              (i32.or
                                (i32.shl (local.get $a2) (i32.const 19))
                                (i32.or
                                  (i32.shl
                                    (i32.eq (i32.shr_u (local.get $d0) (i32.const 8)) (i32.const 5))
                                    (i32.const 22))
                                  (i32.or
                                    (i32.shl
                                      (i32.eq (i32.shr_u (local.get $d1) (i32.const 8)) (i32.const 4))
                                      (i32.const 23))
                                    (i32.or
                                      (i32.shl
                                        (i32.eq (i32.shr_u (local.get $d2) (i32.const 8)) (i32.const 4))
                                        (i32.const 24))
                                      (i32.shl
                                        (i32.eq (i32.shr_u (local.get $d3) (i32.const 8)) (i32.const 5))
                                        (i32.const 25))))))))))))
                  (store.field LoopOp handler (local.get $p0) (i32.const 449))
                  (store.field.memarg LoopOp operand (local.get $p0) (local.get $packed))
                  (local.set $i (i32.add (local.get $i) (i32.const 4)))
                  (br $scan)))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan))))

  ;; The same straight-line emitter also covers the common shorter semantic
  ;; regions found by the corpus census:
  ;;
  ;;   FLD mem; FSTP mem
  ;;   FLD mem; arithmetic mem; FSTP mem
  ;;   FLD mem; FCHS|FABS; FSTP mem
  ;;
  ;; Bits 26..27 select 2-op copy, 3-op memory arithmetic, or 3-op unary.
  ;; The descriptor keeps address and width parameters, so these are semantic
  ;; families rather than instruction-byte templates.
  (func $x87_short_fuse_block
    (local $i i32) (local $n i32) (local $p0 i32) (local $p1 i32) (local $p2 i32)
    (local $d0 i32) (local $d1 i32) (local $d2 i32)
    (local $a1 i32) (local $rop i32) (local $packed i32)
    (if (global.get $op_index_poison) (then (return)))
    (local.set $n (global.get $op_index_n))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
      (local.set $p0 (call $loop_op_at (local.get $i)))
      (local.set $d0 (call $x87_mem_desc (local.get $p0)))
      (if (call $x87_pipeline_load_desc (local.get $d0))
        (then
          ;; Prefer a three-op region before considering the two-op copy.
          (if (i32.le_u (i32.add (local.get $i) (i32.const 3)) (local.get $n))
            (then
              (local.set $p1 (call $loop_op_at (i32.add (local.get $i) (i32.const 1))))
              (local.set $p2 (call $loop_op_at (i32.add (local.get $i) (i32.const 2))))
              (local.set $d2 (call $x87_mem_desc (local.get $p2)))
              (if (call $x87_pipeline_storepop_desc (local.get $d2))
                (then
                  ;; Memory arithmetic: every record is 12 bytes.
                  (if (i32.and
                        (i32.eq (local.get $p1) (i32.add (local.get $p0) (i32.const 12)))
                        (i32.eq (local.get $p2) (i32.add (local.get $p1) (i32.const 12))))
                    (then
                      (local.set $d1 (call $x87_mem_desc (local.get $p1)))
                      (local.set $a1 (call $x87_pipeline_arith_op (local.get $d1)))
                      (if (i32.ge_s (local.get $a1) (i32.const 0))
                        (then
                          (local.set $packed (i32.and (local.get $d0) (i32.const 0xF)))
                          (local.set $packed (i32.or (local.get $packed)
                            (i32.shl (i32.and (local.get $d1) (i32.const 0xF)) (i32.const 4))))
                          (local.set $packed (i32.or (local.get $packed)
                            (i32.shl (i32.and (local.get $d2) (i32.const 0xF)) (i32.const 12))))
                          (local.set $packed (i32.or (local.get $packed)
                            (i32.shl (local.get $a1) (i32.const 16))))
                          (local.set $packed (i32.or (local.get $packed)
                            (i32.shl (i32.eq (i32.shr_u (local.get $d0) (i32.const 8)) (i32.const 5)) (i32.const 22))))
                          (local.set $packed (i32.or (local.get $packed)
                            (i32.shl (i32.eq (i32.shr_u (local.get $d1) (i32.const 8)) (i32.const 4)) (i32.const 23))))
                          (local.set $packed (i32.or (local.get $packed)
                            (i32.shl (i32.eq (i32.shr_u (local.get $d2) (i32.const 8)) (i32.const 5)) (i32.const 25))))
                          (local.set $packed (i32.or (local.get $packed) (i32.shl (i32.const 1) (i32.const 26))))
                          (global.set $x87_pipeline4_matches
                            (i32.add (global.get $x87_pipeline4_matches) (i32.const 1)))
                          (if (global.get $x87_pipeline4_emit_enabled)
                            (then
                              (store.field LoopOp handler (local.get $p0) (i32.const 449))
                              (store.field.memarg LoopOp operand (local.get $p0) (local.get $packed))))
                          (local.set $i (i32.add (local.get $i) (i32.const 3)))
                          (br $scan)))))
                  ;; Unary register op: D9 E0/E1, and an 8-byte middle record.
                  (local.set $rop (load.field.memarg LoopOp operand (local.get $p1)))
                  (if (i32.and
                        (i32.and
                          (i32.eq (local.get $p1) (i32.add (local.get $p0) (i32.const 12)))
                          (i32.eq (local.get $p2) (i32.add (local.get $p1) (i32.const 8))))
                        (i32.and
                          (i32.eq (load.field LoopOp handler (local.get $p1)) (i32.const 189))
                          (i32.or (i32.eq (local.get $rop) (i32.const 0x140))
                                  (i32.eq (local.get $rop) (i32.const 0x141)))))
                    (then
                      (local.set $packed (i32.and (local.get $d0) (i32.const 0xF)))
                      (local.set $packed (i32.or (local.get $packed)
                        (i32.shl (i32.and (local.get $d2) (i32.const 0xF)) (i32.const 12))))
                      (local.set $packed (i32.or (local.get $packed)
                        (i32.shl (i32.and (local.get $rop) (i32.const 1)) (i32.const 16))))
                      (local.set $packed (i32.or (local.get $packed)
                        (i32.shl (i32.eq (i32.shr_u (local.get $d0) (i32.const 8)) (i32.const 5)) (i32.const 22))))
                      (local.set $packed (i32.or (local.get $packed)
                        (i32.shl (i32.eq (i32.shr_u (local.get $d2) (i32.const 8)) (i32.const 5)) (i32.const 25))))
                      (local.set $packed (i32.or (local.get $packed) (i32.shl (i32.const 3) (i32.const 26))))
                      (global.set $x87_pipeline4_matches
                        (i32.add (global.get $x87_pipeline4_matches) (i32.const 1)))
                      (if (global.get $x87_pipeline4_emit_enabled)
                        (then
                          (store.field LoopOp handler (local.get $p0) (i32.const 449))
                          (store.field.memarg LoopOp operand (local.get $p0) (local.get $packed))))
                      (local.set $i (i32.add (local.get $i) (i32.const 3)))
                      (br $scan)))))))
          ;; Two memory records: a typed load/store conversion or exact copy.
          (if (i32.le_u (i32.add (local.get $i) (i32.const 2)) (local.get $n))
            (then
              (local.set $p1 (call $loop_op_at (i32.add (local.get $i) (i32.const 1))))
              (if (i32.eq (local.get $p1) (i32.add (local.get $p0) (i32.const 12)))
                (then
                  (local.set $d1 (call $x87_mem_desc (local.get $p1)))
                  (if (call $x87_pipeline_storepop_desc (local.get $d1))
                    (then
                      (local.set $packed (i32.and (local.get $d0) (i32.const 0xF)))
                      (local.set $packed (i32.or (local.get $packed)
                        (i32.shl (i32.and (local.get $d1) (i32.const 0xF)) (i32.const 12))))
                      (local.set $packed (i32.or (local.get $packed)
                        (i32.shl (i32.eq (i32.shr_u (local.get $d0) (i32.const 8)) (i32.const 5)) (i32.const 22))))
                      (local.set $packed (i32.or (local.get $packed)
                        (i32.shl (i32.eq (i32.shr_u (local.get $d1) (i32.const 8)) (i32.const 5)) (i32.const 25))))
                      (local.set $packed (i32.or (local.get $packed) (i32.shl (i32.const 2) (i32.const 26))))
                      (global.set $x87_pipeline4_matches
                        (i32.add (global.get $x87_pipeline4_matches) (i32.const 1)))
                      (if (global.get $x87_pipeline4_emit_enabled)
                        (then
                          (store.field LoopOp handler (local.get $p0) (i32.const 449))
                          (store.field.memarg LoopOp operand (local.get $p0) (local.get $packed))))
                      (local.set $i (i32.add (local.get $i) (i32.const 2)))
                      (br $scan)))))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan))))

  (func $x87_pipeline_addr (param $base i32) (param $word i32) (result i32)
    (if (result i32) (i32.eq (local.get $base) (i32.const 8))
      (then (local.get $word))
      (else (i32.add (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $base) (i32.const 2)))) (local.get $word)))))

  (func $x87_pipeline_load (param $addr i32) (param $wide i32) (result f64)
    (if (result f64) (local.get $wide)
      (then (f64.reinterpret_i64 (call $gl64 (local.get $addr))))
      (else (f64.promote_f32 (f32.reinterpret_i32 (call $gl32_native (local.get $addr)))))))

  ;; 449: a bounded straight-line expression pipeline. Mode 0 is the original
  ;; four-op/two-arithmetic form; modes 1/2/3 are memory-arithmetic, copy, and
  ;; unary three-op regions. Preserve source evaluation order and use
  ;; $fpu_arith so divide-by-zero/status behavior remains canonical.
  ;; ROUND 15 (section 24): each fused x87 family is split into a BODY that
  ;; does the work and a thin threaded wrapper that adds `return_call $next`.
  ;; The split is what lets the block executor call the body directly as a
  ;; native micro-op (TU_X87RUN) instead of paying the generic TU_FALLBACK
  ;; trampoline -- a fallback has to route through $next because a handler
  ;; ends in one, and that is the whole reason the resume handler H459 exists.
  ;; The body still reads its inline words through the $ip GLOBAL, exactly as
  ;; before, so nothing about the threaded path changes; the executor arm sets
  ;; $ip to the pool copy first, which is what the TU_FALLBACK arm already
  ;; does one line above it.
  (func $th_x87_pipeline4 (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (call $x87_pipeline4_body (local.get $op))
    (dispatch-next))
  (func $x87_pipeline4_body (param $op i32)
    (local $tp i32) (local $a0 i32) (local $a1 i32)
    (local $a2 i32) (local $a3 i32) (local $mode i32)
    (local $v f64) (local $rhs f64)
    (local.set $tp (global.get $ip))
    (local.set $mode (i32.and (i32.shr_u (local.get $op) (i32.const 26)) (i32.const 3)))
    ;; Each original memory op is a normal 8-byte handler record plus one raw
    ;; address/displacement word. $ip initially points at the first raw word.
    (local.set $a0
      (call $x87_pipeline_addr
        (i32.and (local.get $op) (i32.const 0xF))
        (i32.load (local.get $tp))))
    (if (i32.eqz (local.get $mode))
      (then
        (local.set $a1 (call $x87_pipeline_addr
          (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF))
          (i32.load offset=12 (local.get $tp))))
        (local.set $a2 (call $x87_pipeline_addr
          (i32.and (i32.shr_u (local.get $op) (i32.const 8)) (i32.const 0xF))
          (i32.load offset=24 (local.get $tp))))
        (local.set $a3 (call $x87_pipeline_addr
          (i32.and (i32.shr_u (local.get $op) (i32.const 12)) (i32.const 0xF))
          (i32.load offset=36 (local.get $tp))))
        (global.set $ip (i32.add (local.get $tp) (i32.const 40))))
      (else (if (i32.eq (local.get $mode) (i32.const 1))
        (then
          (local.set $a1 (call $x87_pipeline_addr
            (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF))
            (i32.load offset=12 (local.get $tp))))
          (local.set $a3 (call $x87_pipeline_addr
            (i32.and (i32.shr_u (local.get $op) (i32.const 12)) (i32.const 0xF))
            (i32.load offset=24 (local.get $tp))))
          (global.set $ip (i32.add (local.get $tp) (i32.const 28))))
        (else (if (i32.eq (local.get $mode) (i32.const 2))
          (then
            (local.set $a3 (call $x87_pipeline_addr
              (i32.and (i32.shr_u (local.get $op) (i32.const 12)) (i32.const 0xF))
              (i32.load offset=12 (local.get $tp))))
            (global.set $ip (i32.add (local.get $tp) (i32.const 16))))
          (else
            (local.set $a3 (call $x87_pipeline_addr
              (i32.and (i32.shr_u (local.get $op) (i32.const 12)) (i32.const 0xF))
              (i32.load offset=20 (local.get $tp))))
            (global.set $ip (i32.add (local.get $tp) (i32.const 24)))))))))

    ;; FLD reads memory before it mutates TOP. Delay materializing ST(0) until
    ;; the final store: no instruction inside this proven region observes it.
    (local.set $v
      (call $x87_pipeline_load (local.get $a0)
        (i32.and (i32.shr_u (local.get $op) (i32.const 22)) (i32.const 1))))
    (global.set $fpu_top
      (i32.and (i32.sub (global.get $fpu_top) (i32.const 1)) (i32.const 7)))
    (if (call $fpu_is_valid (i32.const 0))
      (then (call $fpu_set_exc (i32.const 0x41))))

    (if (i32.le_u (local.get $mode) (i32.const 1))
      (then
        (local.set $rhs
          (call $x87_pipeline_load (local.get $a1)
            (i32.and (i32.shr_u (local.get $op) (i32.const 23)) (i32.const 1))))
        (local.set $v
          (call $fpu_arith (local.get $v) (local.get $rhs)
            (i32.and (i32.shr_u (local.get $op) (i32.const 16)) (i32.const 7))))))
    (if (i32.eqz (local.get $mode))
      (then
        (local.set $rhs
          (call $x87_pipeline_load (local.get $a2)
            (i32.and (i32.shr_u (local.get $op) (i32.const 24)) (i32.const 1))))
        (local.set $v
          (call $fpu_arith (local.get $v) (local.get $rhs)
            (i32.and (i32.shr_u (local.get $op) (i32.const 19)) (i32.const 7))))))
    (if (i32.eq (local.get $mode) (i32.const 3))
      (then
        (if (i32.eqz (i32.and (i32.shr_u (local.get $op) (i32.const 16)) (i32.const 1)))
          (then (local.set $v (f64.neg (local.get $v))))
          (else (local.set $v (f64.abs (local.get $v)))))))

    ;; Use the scalar handler's guest stores for sparse page boundaries and
    ;; decoded-code invalidation, with the same FSTP operand evaluation order.
    (call $fpu_set (i32.const 0) (local.get $v))
    (if (i32.and (i32.shr_u (local.get $op) (i32.const 25)) (i32.const 1))
      (then (call $gs64 (local.get $a3) (i64.reinterpret_f64 (call $fpu_pop))))
      (else (call $gs32 (local.get $a3)
        (i32.reinterpret_f32 (f32.demote_f64 (call $fpu_pop))))))
    (global.set $x87_pipeline4_runs
      (i32.add (global.get $x87_pipeline4_runs) (i32.const 1))))

  ;; Recognize the balanced binary-tree leaf used by Alpha's TQI algebra and
  ;; by ordinary compiler output generally:
  ;;
  ;;   FLD a; FLD b; FADDP/FMULP/FSUBP/FDIVP ST(1),ST(0); FSTP d
  ;;
  ;; Both inputs and the output may independently be f32/f64 and absolute or
  ;; simple-base addressed. rm must be ST(1): larger indices consume preexisting
  ;; stack state and are not a closed expression tree.
  (func $x87_tree4_fuse_block
    (local $i i32) (local $n i32)
    (local $p0 i32) (local $p1 i32) (local $p2 i32) (local $p3 i32)
    (local $d0 i32) (local $d1 i32) (local $d3 i32)
    (local $rop i32) (local $arith i32) (local $packed i32)
    (if (global.get $op_index_poison) (then (return)))
    (local.set $n (global.get $op_index_n))
    (block $done (loop $scan
      (br_if $done (i32.gt_u (i32.add (local.get $i) (i32.const 4)) (local.get $n)))
      (local.set $p0 (call $loop_op_at (local.get $i)))
      (local.set $p1 (call $loop_op_at (i32.add (local.get $i) (i32.const 1))))
      (local.set $p2 (call $loop_op_at (i32.add (local.get $i) (i32.const 2))))
      (local.set $p3 (call $loop_op_at (i32.add (local.get $i) (i32.const 3))))
      (if (i32.and
            (i32.eq (local.get $p1) (i32.add (local.get $p0) (i32.const 12)))
            (i32.and
              (i32.eq (local.get $p2) (i32.add (local.get $p1) (i32.const 12)))
              (i32.eq (local.get $p3) (i32.add (local.get $p2) (i32.const 8)))))
        (then
          (local.set $d0 (call $x87_mem_desc (local.get $p0)))
          (local.set $d1 (call $x87_mem_desc (local.get $p1)))
          (local.set $d3 (call $x87_mem_desc (local.get $p3)))
          (local.set $rop (load.field.memarg LoopOp operand (local.get $p2)))
          (local.set $arith
            (i32.and (i32.shr_u (local.get $rop) (i32.const 4)) (i32.const 0xF)))
          (if (i32.and
                (i32.and
                  (i32.and
                    (i32.or
                      (i32.eq (i32.shr_u (local.get $d0) (i32.const 8)) (i32.const 1))
                      (i32.eq (i32.shr_u (local.get $d0) (i32.const 8)) (i32.const 5)))
                    (i32.eq (i32.and (i32.shr_u (local.get $d0) (i32.const 4)) (i32.const 0xF)) (i32.const 0)))
                  (i32.and
                    (i32.or
                      (i32.eq (i32.shr_u (local.get $d1) (i32.const 8)) (i32.const 1))
                      (i32.eq (i32.shr_u (local.get $d1) (i32.const 8)) (i32.const 5)))
                    (i32.eq (i32.and (i32.shr_u (local.get $d1) (i32.const 4)) (i32.const 0xF)) (i32.const 0))))
                (i32.and
                  (i32.and
                    (i32.eq (load.field LoopOp handler (local.get $p2)) (i32.const 189))
                    (i32.and
                      (i32.eq (i32.shr_u (local.get $rop) (i32.const 8)) (i32.const 6))
                      (i32.eq (i32.and (local.get $rop) (i32.const 0xF)) (i32.const 1))))
                  (i32.and
                    (i32.or
                      (i32.or (i32.eqz (local.get $arith)) (i32.eq (local.get $arith) (i32.const 1)))
                      (i32.ge_u (local.get $arith) (i32.const 4)))
                    (i32.and
                      (i32.or
                        (i32.eq (i32.shr_u (local.get $d3) (i32.const 8)) (i32.const 1))
                        (i32.eq (i32.shr_u (local.get $d3) (i32.const 8)) (i32.const 5)))
                      (i32.eq (i32.and (i32.shr_u (local.get $d3) (i32.const 4)) (i32.const 0xF)) (i32.const 3))))))
            (then
              (global.set $x87_tree4_matches
                (i32.add (global.get $x87_tree4_matches) (i32.const 1)))
              (if (global.get $x87_pipeline4_emit_enabled)
                (then
                  (local.set $packed
                    (i32.or
                      (i32.and (local.get $d0) (i32.const 0xF))
                      (i32.or
                        (i32.shl (i32.and (local.get $d1) (i32.const 0xF)) (i32.const 4))
                        (i32.or
                          (i32.shl (i32.and (local.get $d3) (i32.const 0xF)) (i32.const 8))
                          (i32.or
                            (i32.shl (local.get $arith) (i32.const 12))
                            (i32.or
                              (i32.shl
                                (i32.eq (i32.shr_u (local.get $d0) (i32.const 8)) (i32.const 5))
                                (i32.const 15))
                              (i32.or
                                (i32.shl
                                  (i32.eq (i32.shr_u (local.get $d1) (i32.const 8)) (i32.const 5))
                                  (i32.const 16))
                                (i32.shl
                                  (i32.eq (i32.shr_u (local.get $d3) (i32.const 8)) (i32.const 5))
                                  (i32.const 17)))))))))
                  (store.field LoopOp handler (local.get $p0) (i32.const 450))
                  (store.field.memarg LoopOp operand (local.get $p0) (local.get $packed))
                  (local.set $i (i32.add (local.get $i) (i32.const 4)))
                  (br $scan)))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan))))

  (func $x87_tree_arith (param $older f64) (param $top f64)
                        (param $op i32) (result f64)
    (if (i32.or (i32.eqz (local.get $op)) (i32.eq (local.get $op) (i32.const 1)))
      (then (return (call $fpu_arith (local.get $older) (local.get $top) (local.get $op)))))
    (if (i32.or (i32.eq (local.get $op) (i32.const 4))
                (i32.eq (local.get $op) (i32.const 6)))
      (then (return (call $fpu_arith (local.get $top) (local.get $older) (local.get $op)))))
    ;; FSUBP/FDIVP use the older ST(1) as the left operand. Normalize their
    ;; opcode to the non-reversed $fpu_arith operation.
    (call $fpu_arith (local.get $older) (local.get $top)
      (i32.sub (local.get $op) (i32.const 1))))

  ;; 450: balanced binary expression tree leaf.
  (func $th_x87_tree4 (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (call $x87_tree4_body (local.get $op))
    (dispatch-next))
  (func $x87_tree4_body (param $op i32)
    (local $tp i32) (local $a0 i32) (local $a1 i32) (local $a3 i32)
    (local $older f64) (local $top f64) (local $v f64)
    (local.set $tp (global.get $ip))
    (local.set $a0
      (call $x87_pipeline_addr
        (i32.and (local.get $op) (i32.const 0xF))
        (i32.load (local.get $tp))))
    (local.set $a1
      (call $x87_pipeline_addr
        (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF))
        (i32.load offset=12 (local.get $tp))))
    (local.set $a3
      (call $x87_pipeline_addr
        (i32.and (i32.shr_u (local.get $op) (i32.const 8)) (i32.const 0xF))
        (i32.load offset=32 (local.get $tp))))
    (global.set $ip (i32.add (local.get $tp) (i32.const 36)))

    ;; First FLD: read before changing TOP. Its physical payload is replaced by
    ;; the arithmetic result before exit, so it need not be materialized now.
    (local.set $older
      (call $x87_pipeline_load (local.get $a0)
        (i32.and (i32.shr_u (local.get $op) (i32.const 15)) (i32.const 1))))
    (global.set $fpu_top
      (i32.and (i32.sub (global.get $fpu_top) (i32.const 1)) (i32.const 7)))
    (if (call $fpu_is_valid (i32.const 0))
      (then (call $fpu_set_exc (i32.const 0x41))))

    ;; Second FLD's payload remains in its physical (ultimately empty) slot and
    ;; is observable through FNSAVE, so materialize it exactly once.
    (local.set $top
      (call $x87_pipeline_load (local.get $a1)
        (i32.and (i32.shr_u (local.get $op) (i32.const 16)) (i32.const 1))))
    (global.set $fpu_top
      (i32.and (i32.sub (global.get $fpu_top) (i32.const 1)) (i32.const 7)))
    (if (call $fpu_is_valid (i32.const 0))
      (then (call $fpu_set_exc (i32.const 0x41))))
    (call $fpu_set (i32.const 0) (local.get $top))

    (local.set $v
      (call $x87_tree_arith (local.get $older) (local.get $top)
        (i32.and (i32.shr_u (local.get $op) (i32.const 12)) (i32.const 7))))
    (call $fpu_set (i32.const 1) (local.get $v))
    (call $fpu_mark_empty (i32.const 0))
    (global.set $fpu_top
      (i32.and (i32.add (global.get $fpu_top) (i32.const 1)) (i32.const 7)))

    (if (i32.and (i32.shr_u (local.get $op) (i32.const 17)) (i32.const 1))
      (then (call $gs64 (local.get $a3) (i64.reinterpret_f64 (local.get $v))))
      (else (call $gs32 (local.get $a3)
        (i32.reinterpret_f32 (f32.demote_f64 (local.get $v))))))
    (call $fpu_mark_empty (i32.const 0))
    (global.set $fpu_top
      (i32.and (i32.add (global.get $fpu_top) (i32.const 1)) (i32.const 7)))
    (global.set $x87_tree4_runs
      (i32.add (global.get $x87_tree4_runs) (i32.const 1))))

  ;; Compile the recurring two-output affine expression emitted by the Smacker
  ;; decoder. These recognizers operate on semantics plus address shape, not
  ;; absolute guest addresses. FLD ST(i) becomes a symbolic reference and FXCH
  ;; becomes a compile-time stack permutation; neither survives in H451/H452.
  (func $x87_affine_prepare_desc (param $i i32) (result i32)
    (local $p0 i32) (local $p1 i32) (local $p2 i32) (local $p3 i32)
    (local $p4 i32) (local $p5 i32) (local $p6 i32) (local $p7 i32) (local $p8 i32)
    (local $d0 i32) (local $d1 i32) (local $d3 i32) (local $d6 i32) (local $d8 i32)
    (if (i32.gt_u (i32.add (local.get $i) (i32.const 9)) (global.get $op_index_n))
      (then (return (i32.const -1))))
    (local.set $p0 (call $loop_op_at (local.get $i)))
    (local.set $p1 (call $loop_op_at (i32.add (local.get $i) (i32.const 1))))
    (local.set $p2 (call $loop_op_at (i32.add (local.get $i) (i32.const 2))))
    (local.set $p3 (call $loop_op_at (i32.add (local.get $i) (i32.const 3))))
    (local.set $p4 (call $loop_op_at (i32.add (local.get $i) (i32.const 4))))
    (local.set $p5 (call $loop_op_at (i32.add (local.get $i) (i32.const 5))))
    (local.set $p6 (call $loop_op_at (i32.add (local.get $i) (i32.const 6))))
    (local.set $p7 (call $loop_op_at (i32.add (local.get $i) (i32.const 7))))
    (local.set $p8 (call $loop_op_at (i32.add (local.get $i) (i32.const 8))))
    (if (i32.ne (local.get $p1) (i32.add (local.get $p0) (i32.const 12))) (then (return (i32.const -1))))
    (if (i32.ne (local.get $p2) (i32.add (local.get $p1) (i32.const 12))) (then (return (i32.const -1))))
    (if (i32.ne (local.get $p3) (i32.add (local.get $p2) (i32.const 8))) (then (return (i32.const -1))))
    (if (i32.ne (local.get $p4) (i32.add (local.get $p3) (i32.const 12))) (then (return (i32.const -1))))
    (if (i32.ne (local.get $p5) (i32.add (local.get $p4) (i32.const 8))) (then (return (i32.const -1))))
    (if (i32.ne (local.get $p6) (i32.add (local.get $p5) (i32.const 8))) (then (return (i32.const -1))))
    (if (i32.ne (local.get $p7) (i32.add (local.get $p6) (i32.const 12))) (then (return (i32.const -1))))
    (if (i32.ne (local.get $p8) (i32.add (local.get $p7) (i32.const 8))) (then (return (i32.const -1))))
    (local.set $d0 (call $x87_mem_desc (local.get $p0)))
    (local.set $d1 (call $x87_mem_desc (local.get $p1)))
    (local.set $d3 (call $x87_mem_desc (local.get $p3)))
    (local.set $d6 (call $x87_mem_desc (local.get $p6)))
    (local.set $d8 (call $x87_mem_desc (local.get $p8)))
    (if (i32.ne (i32.and (local.get $d0) (i32.const 0xFF0)) (i32.const 0x300)) (then (return (i32.const -1))))
    (if (i32.ne (i32.and (local.get $d1) (i32.const 0xFF0)) (i32.const 0x300)) (then (return (i32.const -1))))
    (if (i32.ne (i32.and (local.get $d3) (i32.const 0xFF0)) (i32.const 0x010)) (then (return (i32.const -1))))
    (if (i32.ne (i32.and (local.get $d6) (i32.const 0xFF0)) (i32.const 0x010)) (then (return (i32.const -1))))
    (if (i32.ne (i32.and (local.get $d8) (i32.const 0xFF0)) (i32.const 0x010)) (then (return (i32.const -1))))
    (if (i32.or
          (i32.ne (load.field LoopOp handler (local.get $p2)) (i32.const 189))
          (i32.ne (load.field.memarg LoopOp operand (local.get $p2)) (i32.const 0x100)))
      (then (return (i32.const -1))))
    (if (i32.or
          (i32.ne (load.field LoopOp handler (local.get $p4)) (i32.const 189))
          (i32.ne (load.field.memarg LoopOp operand (local.get $p4)) (i32.const 0x112)))
      (then (return (i32.const -1))))
    (if (i32.or
          (i32.ne (load.field LoopOp handler (local.get $p5)) (i32.const 189))
          (i32.ne (load.field.memarg LoopOp operand (local.get $p5)) (i32.const 0x401)))
      (then (return (i32.const -1))))
    (if (i32.or
          (i32.ne (load.field LoopOp handler (local.get $p7)) (i32.const 189))
          (i32.ne (load.field.memarg LoopOp operand (local.get $p7)) (i32.const 0x111)))
      (then (return (i32.const -1))))
    (i32.or
      (i32.and (local.get $d0) (i32.const 0xF))
      (i32.or
        (i32.shl (i32.and (local.get $d1) (i32.const 0xF)) (i32.const 4))
        (i32.or
          (i32.shl (i32.and (local.get $d3) (i32.const 0xF)) (i32.const 8))
          (i32.or
            (i32.shl (i32.and (local.get $d6) (i32.const 0xF)) (i32.const 12))
            (i32.shl (i32.and (local.get $d8) (i32.const 0xF)) (i32.const 16)))))))

  (func $x87_affine_finish_desc (param $i i32) (result i32)
    (local $p0 i32) (local $p1 i32) (local $p2 i32) (local $p3 i32) (local $p4 i32)
    (local $d2 i32) (local $d4 i32)
    (if (i32.gt_u (i32.add (local.get $i) (i32.const 5)) (global.get $op_index_n))
      (then (return (i32.const -1))))
    (local.set $p0 (call $loop_op_at (local.get $i)))
    (local.set $p1 (call $loop_op_at (i32.add (local.get $i) (i32.const 1))))
    (local.set $p2 (call $loop_op_at (i32.add (local.get $i) (i32.const 2))))
    (local.set $p3 (call $loop_op_at (i32.add (local.get $i) (i32.const 3))))
    (local.set $p4 (call $loop_op_at (i32.add (local.get $i) (i32.const 4))))
    (if (i32.ne (local.get $p1) (i32.add (local.get $p0) (i32.const 8))) (then (return (i32.const -1))))
    (if (i32.ne (local.get $p2) (i32.add (local.get $p1) (i32.const 8))) (then (return (i32.const -1))))
    (if (i32.ne (local.get $p3) (i32.add (local.get $p2) (i32.const 12))) (then (return (i32.const -1))))
    (if (i32.ne (local.get $p4) (i32.add (local.get $p3) (i32.const 8))) (then (return (i32.const -1))))
    (if (i32.or
          (i32.ne (load.field LoopOp handler (local.get $p0)) (i32.const 189))
          (i32.ne (load.field.memarg LoopOp operand (local.get $p0)) (i32.const 0x401)))
      (then (return (i32.const -1))))
    (if (i32.or
          (i32.ne (load.field LoopOp handler (local.get $p1)) (i32.const 189))
          (i32.ne (load.field.memarg LoopOp operand (local.get $p1)) (i32.const 0x652)))
      (then (return (i32.const -1))))
    (if (i32.or
          (i32.ne (load.field LoopOp handler (local.get $p3)) (i32.const 189))
          (i32.ne (load.field.memarg LoopOp operand (local.get $p3)) (i32.const 0x111)))
      (then (return (i32.const -1))))
    (local.set $d2 (call $x87_mem_desc (local.get $p2)))
    (local.set $d4 (call $x87_mem_desc (local.get $p4)))
    (if (i32.ne (i32.and (local.get $d2) (i32.const 0xFF0)) (i32.const 0x000)) (then (return (i32.const -1))))
    (if (i32.ne (i32.and (local.get $d4) (i32.const 0xFF0)) (i32.const 0x000)) (then (return (i32.const -1))))
    (i32.or
      (i32.and (local.get $d2) (i32.const 0xF))
      (i32.shl (i32.and (local.get $d4) (i32.const 0xF)) (i32.const 4))))

  (func $x87_affine_fuse_block
    (local $i i32) (local $packed i32) (local $p i32)
    (if (global.get $op_index_poison) (then (return)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $op_index_n)))
      (local.set $packed (call $x87_affine_prepare_desc (local.get $i)))
      (if (i32.ge_s (local.get $packed) (i32.const 0))
        (then
          (global.set $x87_affine_prepare_matches
            (i32.add (global.get $x87_affine_prepare_matches) (i32.const 1)))
          (if (global.get $x87_affine_emit_enabled)
            (then
              (local.set $p (call $loop_op_at (local.get $i)))
              (store.field LoopOp handler (local.get $p) (i32.const 452))
              (store.field.memarg LoopOp operand (local.get $p) (local.get $packed))))
          (local.set $i (i32.add (local.get $i) (i32.const 9)))
          (br $scan)))
      (local.set $packed (call $x87_affine_finish_desc (local.get $i)))
      (if (i32.ge_s (local.get $packed) (i32.const 0))
        (then
          (global.set $x87_affine_finish_matches
            (i32.add (global.get $x87_affine_finish_matches) (i32.const 1)))
          (if (global.get $x87_affine_emit_enabled)
            (then
              (local.set $p (call $loop_op_at (local.get $i)))
              (store.field LoopOp handler (local.get $p) (i32.const 453))
              (store.field.memarg LoopOp operand (local.get $p) (local.get $packed))))
          (local.set $i (i32.add (local.get $i) (i32.const 5)))
          (br $scan)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan))))

  ;; H451: direct semantic evaluation of the affine prefix. The three pushes
  ;; retain exact overflow/status behavior; symbolic FLD-ST and FXCH compile to
  ;; local renaming. Materialize at each following memory boundary so faults
  ;; would observe the same architectural stack as the scalar sequence.
  (func $th_x87_affine_prepare (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (call $x87_affine_prepare_body (local.get $op))
    (dispatch-next))
  (func $x87_affine_prepare_body (param $op i32)
    (local $tp i32) (local $a0 i32) (local $a1 i32) (local $a3 i32)
    (local $a6 i32) (local $a8 i32)
    (local $x f64) (local $y f64) (local $sum f64)
    (local $t0 f64) (local $t1 f64) (local $t2 f64) (local $c f64)
    (local.set $tp (global.get $ip))
    (local.set $a0 (call $x87_pipeline_addr (i32.and (local.get $op) (i32.const 0xF)) (i32.load (local.get $tp))))
    (local.set $a1 (call $x87_pipeline_addr (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)) (i32.load offset=12 (local.get $tp))))
    (local.set $a3 (call $x87_pipeline_addr (i32.and (i32.shr_u (local.get $op) (i32.const 8)) (i32.const 0xF)) (i32.load offset=32 (local.get $tp))))
    (local.set $a6 (call $x87_pipeline_addr (i32.and (i32.shr_u (local.get $op) (i32.const 12)) (i32.const 0xF)) (i32.load offset=60 (local.get $tp))))
    (local.set $a8 (call $x87_pipeline_addr (i32.and (i32.shr_u (local.get $op) (i32.const 16)) (i32.const 0xF)) (i32.load offset=80 (local.get $tp))))
    ;; $ip already passed H451's 8-byte handler/operand record. The matched
    ;; prefix occupies 92 bytes in total, so 84 bytes remain to consume.
    (global.set $ip (i32.add (local.get $tp) (i32.const 84)))
    (local.set $x (f64.convert_i32_s (call $gl32 (local.get $a0))))
    (call $fpu_push (local.get $x))
    (local.set $y (f64.convert_i32_s (call $gl32 (local.get $a1))))
    (call $fpu_push (local.get $y))
    (call $fpu_push (local.get $y))
    (local.set $c (f64.promote_f32 (f32.reinterpret_i32 (call $gl32_native (local.get $a3)))))
    (local.set $t0 (call $fpu_mul (local.get $y) (local.get $c)))
    (local.set $sum (f64.add (local.get $y) (local.get $x)))
    (call $fpu_set (i32.const 0) (local.get $x))
    (call $fpu_set (i32.const 1) (local.get $sum))
    (call $fpu_set (i32.const 2) (local.get $t0))
    (local.set $c (f64.promote_f32 (f32.reinterpret_i32 (call $gl32_native (local.get $a6)))))
    (local.set $t1 (call $fpu_mul (local.get $x) (local.get $c)))
    (call $fpu_set (i32.const 0) (local.get $sum))
    (call $fpu_set (i32.const 1) (local.get $t1))
    (call $fpu_set (i32.const 2) (local.get $t0))
    (local.set $c (f64.promote_f32 (f32.reinterpret_i32 (call $gl32_native (local.get $a8)))))
    (local.set $t2 (call $fpu_mul (local.get $sum) (local.get $c)))
    (call $fpu_set (i32.const 0) (local.get $t2))
    (global.set $x87_affine_prepare_runs
      (i32.add (global.get $x87_affine_prepare_runs) (i32.const 1))))

  ;; H452: direct semantic suffix. The pop remains architecturally visible;
  ;; FXCH is only a local permutation, materialized before the next load.
  (func $th_x87_affine_finish (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (call $x87_affine_finish_body (local.get $op))
    (dispatch-next))
  (func $x87_affine_finish_body (param $op i32)
    (local $tp i32) (local $a2 i32) (local $a4 i32)
    (local $top f64) (local $mid f64) (local $old f64)
    (local $r0 f64) (local $r1 f64) (local $bias f64)
    (local.set $tp (global.get $ip))
    (local.set $a2 (call $x87_pipeline_addr (i32.and (local.get $op) (i32.const 0xF)) (i32.load offset=16 (local.get $tp))))
    (local.set $a4 (call $x87_pipeline_addr (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)) (i32.load offset=36 (local.get $tp))))
    ;; As above, $next already consumed the first 8 bytes of this 48-byte
    ;; region; advance over only the remaining 40 bytes.
    (global.set $ip (i32.add (local.get $tp) (i32.const 40)))
    (local.set $top (call $fpu_get (i32.const 0)))
    (local.set $mid (call $fpu_get (i32.const 1)))
    (local.set $old (call $fpu_get (i32.const 2)))
    (local.set $r1 (f64.add (local.get $mid) (local.get $top)))
    (local.set $r0 (f64.sub (local.get $old) (local.get $top)))
    (if (i32.eqz (call $fpu_is_valid (i32.const 0)))
      (then (call $fpu_set_exc (i32.const 0x41))))
    (call $fpu_mark_empty (i32.const 0))
    (global.set $fpu_top
      (i32.and (i32.add (global.get $fpu_top) (i32.const 1)) (i32.const 7)))
    (call $fpu_set (i32.const 0) (local.get $r1))
    (call $fpu_set (i32.const 1) (local.get $r0))
    (local.set $bias (f64.promote_f32 (f32.reinterpret_i32 (call $gl32_native (local.get $a2)))))
    (local.set $r1 (f64.add (local.get $r1) (local.get $bias)))
    (call $fpu_set (i32.const 0) (local.get $r1))
    ;; Compiled FXCH ST(1): swap symbolic names, then expose the exact state at
    ;; the following memory boundary without invoking the generic FXCH helper.
    (call $fpu_set (i32.const 0) (local.get $r0))
    (call $fpu_set (i32.const 1) (local.get $r1))
    (local.set $bias (f64.promote_f32 (f32.reinterpret_i32 (call $gl32_native (local.get $a4)))))
    (local.set $r0 (f64.add (local.get $r0) (local.get $bias)))
    (call $fpu_set (i32.const 0) (local.get $r0))
    (global.set $x87_affine_finish_runs
      (i32.add (global.get $x87_affine_finish_runs) (i32.const 1))))

  ;; Collapse a maximal contiguous run of ordinary x87 memory/register ops
  ;; into one dispatch while continuing to use the canonical semantic helpers.
  ;; The original threaded records remain in place and are the micro-op stream;
  ;; only the first handler/operand pair is replaced. Packed operand:
  ;;   bits 0..11 original operand, 12..19 original handler, 20..27 op count.
  ;; Runs containing an EA_TEMP-dependent H188 are accepted only when it is the
  ;; first op: a later SIB form would require an intervening EA producer.
  (func $x87_island_fuse_block
    (local $i i32) (local $j i32) (local $n i32) (local $p i32)
    (local $fn i32) (local $count i32) (local $first_op i32)
    (if (global.get $op_index_poison) (then (return)))
    (local.set $n (global.get $op_index_n))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
      (local.set $p (call $loop_op_at (local.get $i)))
      (local.set $fn (load.field LoopOp handler (local.get $p)))
      (if (i32.or
            (i32.eq (local.get $fn) (i32.const 188))
            (i32.or (i32.eq (local.get $fn) (i32.const 189))
                    (i32.eq (local.get $fn) (i32.const 190))))
        (then
          (local.set $j (local.get $i))
          (local.set $count (i32.const 0))
          (block $run_done (loop $run
            (br_if $run_done (i32.ge_u (local.get $j) (local.get $n)))
            (local.set $p (call $loop_op_at (local.get $j)))
            (local.set $fn (load.field LoopOp handler (local.get $p)))
            (br_if $run_done
              (i32.eqz
                (i32.or
                  (i32.eq (local.get $fn) (i32.const 188))
                  (i32.or (i32.eq (local.get $fn) (i32.const 189))
                          (i32.eq (local.get $fn) (i32.const 190))))))
            (if (i32.and
                  (i32.and (i32.ne (local.get $j) (local.get $i))
                           (i32.eq (local.get $fn) (i32.const 188)))
                  (i32.eq (i32.load offset=8 (local.get $p)) (global.get $SIB_SENTINEL)))
              (then (br $run_done)))
            (local.set $count (i32.add (local.get $count) (i32.const 1)))
            (local.set $j (i32.add (local.get $j) (i32.const 1)))
            (br_if $run_done (i32.ge_u (local.get $count) (i32.const 255)))
            (br $run)))
          (if (i32.ge_u (local.get $count) (i32.const 3))
            (then
              (local.set $p (call $loop_op_at (local.get $i)))
              (local.set $fn (load.field LoopOp handler (local.get $p)))
              (local.set $first_op (load.field.memarg LoopOp operand (local.get $p)))
              (global.set $x87_island_matches
                (i32.add (global.get $x87_island_matches) (i32.const 1)))
              (if (global.get $x87_pipeline4_emit_enabled)
                (then
                  (store.field LoopOp handler (local.get $p) (i32.const 451))
                  (store.field.memarg LoopOp operand (local.get $p)
                    (i32.or
                      (i32.and (local.get $first_op) (i32.const 0xFFF))
                      (i32.or
                        (i32.shl (local.get $fn) (i32.const 12))
                        (i32.shl (local.get $count) (i32.const 20)))))))
              (local.set $i (local.get $j))
              (br $scan)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan))))

  ;; How many OP_INDEX entries one FUSED x87 op covers, itself included, or 0
  ;; when the handler is not a fused x87 family. Round 12 (OPEN-6): the block
  ;; executor runs AFTER these fusers now and has to walk past the ops they
  ;; absorbed, which are still in the stream as inline data with their original
  ;; handler words. Only the fuser knows how many that is, so the answer lives
  ;; here, next to the code that decides it, rather than as a second copy of
  ;; these constants in 07c-block-exec.wat.
  ;;
  ;;   449 $th_x87_pipeline4 -- mode in bits 26..27: 0 -> 4 ops, 1 -> 3,
  ;;                            2 -> 2, 3 -> 3 (see $x87_short_fuse_block)
  ;;   450 $th_x87_tree4     -- always 4
  ;;   451 $th_x87_island    -- run length in bits 20..27
  ;;   452 affine prepare    -- always 9
  ;;   453 affine finish     -- always 5
  (func $x87_fused_span (param $fn i32) (param $op i32) (result i32)
    (if (i32.eq (local.get $fn) (i32.const 449))
      (then
        (local.set $op
          (i32.and (i32.shr_u (local.get $op) (i32.const 26)) (i32.const 3)))
        (if (i32.eqz (local.get $op)) (then (return (i32.const 4))))
        (if (i32.eq (local.get $op) (i32.const 2)) (then (return (i32.const 2))))
        (return (i32.const 3))))
    (if (i32.eq (local.get $fn) (i32.const 450)) (then (return (i32.const 4))))
    (if (i32.eq (local.get $fn) (i32.const 451))
      (then
        (return (i32.and (i32.shr_u (local.get $op) (i32.const 20))
                         (i32.const 0xFF)))))
    (if (i32.eq (local.get $fn) (i32.const 452)) (then (return (i32.const 9))))
    (if (i32.eq (local.get $fn) (i32.const 453)) (then (return (i32.const 5))))
    (i32.const 0))

  ;; Generic x87 micro-op inner loop. This eliminates threaded dispatch and
  ;; keeps the canonical stack/tag/status semantics in $fpu_exec_mem/reg.
  (func $th_x87_island (param $packed i32)
     (local $nx_fn i32) (local $nx_op i32)
    (if (global.get $x87_island_predecode)
      (then (call $x87_island_fast (local.get $packed)))
      (else (call $x87_island_generic (local.get $packed))))
    (dispatch-next))
  (func $x87_island_body (param $packed i32)
    (if (global.get $x87_island_predecode)
      (then (call $x87_island_fast (local.get $packed)))
      (else (call $x87_island_generic (local.get $packed)))))
  (func $x87_island_generic (param $packed i32)
    (local $cursor i32) (local $fn i32) (local $op i32)
    (local $count i32) (local $i i32) (local $addr i32)
    (local.set $cursor (global.get $ip))
    (local.set $fn (i32.and (i32.shr_u (local.get $packed) (i32.const 12)) (i32.const 0xFF)))
    (local.set $op (i32.and (local.get $packed) (i32.const 0xFFF)))
    (local.set $count (i32.and (i32.shr_u (local.get $packed) (i32.const 20)) (i32.const 0xFF)))
    (block $done (loop $each
      (if (i32.eq (local.get $fn) (i32.const 188))
        (then
          (local.set $addr (i32.load (local.get $cursor)))
          (local.set $cursor (i32.add (local.get $cursor) (i32.const 4)))
          (if (i32.eq (local.get $addr) (global.get $SIB_SENTINEL))
            (then (local.set $addr (global.get $ea_temp))))
          (call $fpu_exec_mem
            (i32.shr_u (local.get $op) (i32.const 4))
            (i32.and (local.get $op) (i32.const 0xF))
            (local.get $addr)))
        (else (if (i32.eq (local.get $fn) (i32.const 190))
          (then
            (local.set $addr
              (i32.add
                (i32.load (i32.add (global.get $reg_base) (i32.shl (i32.and (local.get $op) (i32.const 0xF)) (i32.const 2))))
                (i32.load (local.get $cursor))))
            (local.set $cursor (i32.add (local.get $cursor) (i32.const 4)))
            (call $fpu_exec_mem
              (i32.shr_u (local.get $op) (i32.const 8))
              (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF))
              (local.get $addr)))
          (else
            (call $fpu_exec_reg
              (i32.shr_u (local.get $op) (i32.const 8))
              (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF))
              (i32.and (local.get $op) (i32.const 0xF)))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $fn (i32.load (local.get $cursor)))
      (local.set $op (i32.load offset=4 (local.get $cursor)))
      (local.set $cursor (i32.add (local.get $cursor) (i32.const 8)))
      (br $each)))
    (global.set $ip (local.get $cursor))
    (global.set $x87_island_runs
      (i32.add (global.get $x87_island_runs) (i32.const 1))))

  ;; ----------------------------------------------------------------------
  ;; $x87_island_fast: the same H451 island, without a call per op.
  ;;
  ;; $x87_island_generic hands every op to $fpu_exec_mem / $fpu_exec_reg,
  ;; which re-decode (group, reg, rm) through compare chains and reach the
  ;; register file through $fpu_get/$fpu_set/$fpu_push/$fpu_pop -- none of
  ;; which V8 or Ion inlines there (Ion: 148 direct calls in $fpu_exec_reg,
  ;; 76 in $fpu_exec_mem). This body keeps the island's x87 state in locals
  ;; for the whole run and dispatches each op through one br_table on
  ;; (reg-form, group) plus a short test on the reg field:
  ;;
  ;;   $top $tag $raw  TOP, the valid-tag byte and the exact-integer-shadow
  ;;                   tag byte ($fpu_top/$fpu_tag/$fpu_raw_tag). Written
  ;;                   back once at the end.
  ;;   $st0            ST(0)'s value. AUTHORITATIVE: the FPU_FILE slot of
  ;;                   the current TOP may be stale while it is live, and it
  ;;                   is stored back whenever TOP moves (push, pop,
  ;;                   FINCSTP/FDECSTP) and at the end. Every other physical
  ;;                   slot, and every exact-integer shadow value, stays in
  ;;                   FPU_FILE memory ($base = $fpu_base) and is read and
  ;;                   written there directly.
  ;;
  ;; Everything the island does not model inline -- FLDENV/FNSTENV,
  ;; FRSTOR/FNSAVE, m80 and BCD, FXAM, transcendentals, FPREM, FSCALE,
  ;; FCMOV, FNCLEX/FNINIT, every reserved encoding that must reach
  ;; $fpu_crash_op -- takes the GENERIC arm: publish the locals to the
  ;; globals, call the canonical $fpu_exec_mem/$fpu_exec_reg exactly as the
  ;; old body does, and reload. So an op whose stack effect or status
  ;; visibility this body does not know is still executed by the one
  ;; implementation, against exactly the state it would have seen.
  ;;
  ;; Bit-exactness against $x87_island_generic is the contract
  ;; (test/test-x87-island-predecode.js fuzzes the two against each other):
  ;; the same f64 operations in the same order; the same guest accessors for
  ;; each form ($g2w + load, $gl32, $gs16/$gs32/$gs64), so page-straddle and
  ;; SMC behaviour is unchanged; $fpu_set_exc raised at the same points and
  ;; in the same order, so --trace-fpu prints the same lines; $fpu_sw and
  ;; $fpu_cw stay globals, touched only where the old code touches them;
  ;; $fpu_round/$fpu_to_i*/$fpu_compare* are the shared helpers themselves.
  ;; The D8 register and memory arithmetic go through $fpu_arith's ZE checks;
  ;; the DC/DE register forms do not raise ZE, exactly as $fpu_exec_reg.
  ;;
  ;; The macros below are this function's register-file primitives; they
  ;; name its locals, so they are only meaningful inside it.
  (defmacro (x87i-slot $X)          ;; FPU_FILE address of physical slot X
    (i32.add (local.get $base) (i32.shl $X (i32.const 3))))
  (defmacro (x87i-phys $X)          ;; physical slot of ST(X)
    (i32.and (i32.add (local.get $top) $X) (i32.const 7)))
  ;; ST(rm). The memory load is harmless when rm = 0 (it reads a slot the
  ;; select then ignores), and keeps this branch-free.
  (defmacro (x87i-get-rm)
    (select (local.get $st0)
      (f64.load (x87i-slot (x87i-phys (local.get $rm))))
      (i32.eqz (local.get $rm))))
  ;; $fpu_set 0: value, drop the exact shadow, tag valid.
  (defmacro (x87i-set0 $V)
    (local.set $st0 $V)
    (local.set $raw (i32.and (local.get $raw)
      (i32.xor (i32.const 0xFF) (i32.shl (i32.const 1) (local.get $top)))))
    (local.set $tag (i32.or (local.get $tag)
      (i32.shl (i32.const 1) (local.get $top)))))
  ;; $fpu_set rm. V is evaluated once, before anything is written.
  (defmacro (x87i-set-rm $V)
    (local.set $w $V)
    (local.set $p (x87i-phys (local.get $rm)))
    (f64.store (x87i-slot (local.get $p)) (local.get $w))
    (local.set $raw (i32.and (local.get $raw)
      (i32.xor (i32.const 0xFF) (i32.shl (i32.const 1) (local.get $p)))))
    (local.set $tag (i32.or (local.get $tag)
      (i32.shl (i32.const 1) (local.get $p))))
    (if (i32.eqz (local.get $rm)) (then (local.set $st0 (local.get $w)))))
  ;; $fpu_push. V is evaluated first, as the argument is in the old code.
  (defmacro (x87i-push $V)
    (local.set $w $V)
    (f64.store (x87i-slot (local.get $top)) (local.get $st0))
    (local.set $top (i32.and (i32.sub (local.get $top) (i32.const 1)) (i32.const 7)))
    (if (i32.and (i32.shr_u (local.get $tag) (local.get $top)) (i32.const 1))
      (then (call $fpu_set_exc (i32.const 0x41))))
    (local.set $raw (i32.and (local.get $raw)
      (i32.xor (i32.const 0xFF) (i32.shl (i32.const 1) (local.get $top)))))
    (local.set $tag (i32.or (local.get $tag)
      (i32.shl (i32.const 1) (local.get $top))))
    (local.set $st0 (local.get $w)))
  ;; $fpu_pop, as an expression. The popped slot keeps its value in memory,
  ;; as the physical register does.
  (defmacro (x87i-pop)
    (block (result f64)
      (if (i32.eqz (i32.and (i32.shr_u (local.get $tag) (local.get $top)) (i32.const 1)))
        (then (call $fpu_set_exc (i32.const 0x41))))
      (local.set $m (i32.xor (i32.const 0xFF) (i32.shl (i32.const 1) (local.get $top))))
      (local.set $raw (i32.and (local.get $raw) (local.get $m)))
      (local.set $tag (i32.and (local.get $tag) (local.get $m)))
      (f64.store (x87i-slot (local.get $top)) (local.get $st0))
      (local.set $w2 (local.get $st0))
      (local.set $top (i32.and (i32.add (local.get $top) (i32.const 1)) (i32.const 7)))
      (local.set $st0 (f64.load (x87i-slot (local.get $top))))
      (local.get $w2)))
  (defmacro (x87i-publish)
    (f64.store (x87i-slot (local.get $top)) (local.get $st0))
    (global.set $fpu_top (local.get $top))
    (global.set $fpu_tag (local.get $tag))
    (global.set $fpu_raw_tag (local.get $raw)))
  (defmacro (x87i-reload)
    (local.set $top (global.get $fpu_top))
    (local.set $tag (global.get $fpu_tag))
    (local.set $raw (global.get $fpu_raw_tag))
    (local.set $st0 (f64.load (x87i-slot (local.get $top)))))

  (func $x87_island_fast (param $packed i32)
    (local $cursor i32) (local $fn i32) (local $op i32)
    (local $count i32) (local $i i32) (local $addr i32)
    (local $g i32) (local $r i32) (local $rm i32)
    (local $base i32) (local $top i32) (local $tag i32) (local $raw i32)
    (local $p i32) (local $m i32) (local $q i32)
    (local $st0 f64) (local $v f64) (local $w f64) (local $w2 f64)
    (local $r0 i64) (local $ri i64)
    (local $g2w_wa i32)
    (local.set $cursor (global.get $ip))
    (local.set $fn (i32.and (i32.shr_u (local.get $packed) (i32.const 12)) (i32.const 0xFF)))
    (local.set $op (i32.and (local.get $packed) (i32.const 0xFFF)))
    (local.set $count (i32.and (i32.shr_u (local.get $packed) (i32.const 20)) (i32.const 0xFF)))
    (local.set $base (global.get $fpu_base))
    (local.set $top (global.get $fpu_top))
    (local.set $tag (global.get $fpu_tag))
    (local.set $raw (global.get $fpu_raw_tag))
    (local.set $st0 (f64.load (x87i-slot (local.get $top))))
    (block $done (loop $each
      ;; ---- decode: (g, r) and either rm (189) or the effective address.
      ;; The three record shapes and their address arithmetic are exactly
      ;; $x87_island_generic's.
      (if (i32.eq (local.get $fn) (i32.const 189))
        (then
          (local.set $rm (i32.and (local.get $op) (i32.const 0xF)))
          (local.set $r (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
          (local.set $g (i32.or (i32.shr_u (local.get $op) (i32.const 8)) (i32.const 8))))
        (else
          (if (i32.eq (local.get $fn) (i32.const 188))
            (then
              (local.set $addr (i32.load (local.get $cursor)))
              (if (i32.eq (local.get $addr) (global.get $SIB_SENTINEL))
                (then (local.set $addr (global.get $ea_temp))))
              (local.set $r (i32.and (local.get $op) (i32.const 0xF)))
              (local.set $g (i32.shr_u (local.get $op) (i32.const 4))))
            (else
              (local.set $addr
                (i32.add
                  (i32.load (i32.add (global.get $reg_base)
                    (i32.shl (i32.and (local.get $op) (i32.const 0xF)) (i32.const 2))))
                  (i32.load (local.get $cursor))))
              (local.set $r (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
              (local.set $g (i32.shr_u (local.get $op) (i32.const 8)))))
          (local.set $cursor (i32.add (local.get $cursor) (i32.const 4)))))
      ;; $g now holds group | (8 if register form): 0..7 memory D8..DF,
      ;; 8..15 register D8..DF.
      (block $next_op
      (block $generic
      (block $arith                 ;; ST(0) = ST(0) <r> $v, D8 semantics
      (block $k15 (block $k14 (block $k13 (block $k12
      (block $k11 (block $k10 (block $k9 (block $k8
      (block $k7 (block $k6 (block $k5 (block $k4
      (block $k3 (block $k2 (block $k1 (block $k0
        (br_table $k0 $k1 $k2 $k3 $k4 $k5 $k6 $k7
                  $k8 $k9 $k10 $k11 $k12 $k13 $k14 $k15 $generic
                  (local.get $g)))
        ;; k0: D8 mem, float32 operand
        (local.set $v (f64.promote_f32 (f32.reinterpret_i32 (call $gl32_native (local.get $addr)))))
        (br $arith))
        ;; k1: D9 mem -- FLD/FST/FSTP m32, FLDCW, FNSTCW
        (if (i32.eqz (local.get $r))
          (then
            (x87i-push (f64.promote_f32 (f32.reinterpret_i32 (call $gl32_native (local.get $addr)))))
            (br $next_op)))
        (if (i32.eq (local.get $r) (i32.const 3))
          (then
            (call $gs32 (local.get $addr)
              (i32.reinterpret_f32 (f32.demote_f64 (x87i-pop))))
            (br $next_op)))
        (if (i32.eq (local.get $r) (i32.const 2))
          (then
            (call $gs32 (local.get $addr)
              (i32.reinterpret_f32 (f32.demote_f64 (local.get $st0))))
            (br $next_op)))
        (if (i32.eq (local.get $r) (i32.const 5))
          (then
            (global.set $fpu_cw (call $gl16 (local.get $addr)))
            (br $next_op)))
        (if (i32.eq (local.get $r) (i32.const 7))
          (then (call $gs16 (local.get $addr) (global.get $fpu_cw)) (br $next_op)))
        (br $generic))
        ;; k2: DA mem, int32 operand
        (local.set $v (f64.convert_i32_s (call $gl32_native (local.get $addr))))
        (br $arith))
        ;; k3: DB mem -- FILD/FIST/FISTP m32 (m80 forms are generic)
        (if (i32.eqz (local.get $r))
          (then
            (x87i-push (f64.convert_i32_s (call $gl32 (local.get $addr))))
            (br $next_op)))
        (if (i32.eq (local.get $r) (i32.const 3))
          (then
            (call $gs32 (local.get $addr) (call $fpu_to_i32 (x87i-pop)))
            (br $next_op)))
        (if (i32.eq (local.get $r) (i32.const 2))
          (then
            (call $gs32 (local.get $addr) (call $fpu_to_i32 (local.get $st0)))
            (br $next_op)))
        (br $generic))
        ;; k4: DC mem, float64 operand
        (local.set $v (f64.reinterpret_i64 (call $gl64 (local.get $addr))))
        (br $arith))
        ;; k5: DD mem -- FLD/FST/FSTP m64, FNSTSW m16
        (if (i32.eqz (local.get $r))
          (then
            (x87i-push (f64.reinterpret_i64 (call $gl64 (local.get $addr))))
            (br $next_op)))
        (if (i32.eq (local.get $r) (i32.const 3))
          (then
            (call $gs64 (local.get $addr) (i64.reinterpret_f64 (x87i-pop)))
            (br $next_op)))
        (if (i32.eq (local.get $r) (i32.const 2))
          (then
            (call $gs64 (local.get $addr) (i64.reinterpret_f64 (local.get $st0)))
            (br $next_op)))
        (if (i32.eq (local.get $r) (i32.const 7))
          (then
            (global.set $fpu_sw (i32.or (i32.and (global.get $fpu_sw) (i32.const 0xC7FF))
              (i32.shl (local.get $top) (i32.const 11))))
            (call $gs16 (local.get $addr) (global.get $fpu_sw))
            (br $next_op)))
        (br $generic))
        ;; k6: DE mem, int16 operand
        (local.set $v (f64.convert_i32_s (i32.extend16_s (call $gl16 (local.get $addr)))))
        (br $arith))
        ;; k7: DF mem -- FILD/FIST/FISTP m16, FILD/FISTP m64 (BCD is generic)
        (if (i32.eqz (local.get $r))
          (then
            (x87i-push (f64.convert_i32_s (i32.extend16_s (call $gl16 (local.get $addr)))))
            (br $next_op)))
        (if (i32.eq (local.get $r) (i32.const 5))
          (then
            (local.set $r0 (call $gl64 (local.get $addr)))
            (x87i-push (f64.convert_i64_s (local.get $r0)))
            ;; $fpu_raw_set 0
            (i64.store offset=64 (x87i-slot (local.get $top)) (local.get $r0))
            (local.set $raw (i32.or (local.get $raw)
              (i32.shl (i32.const 1) (local.get $top))))
            (br $next_op)))
        (if (i32.eq (local.get $r) (i32.const 7))
          (then
            (if (i32.and (i32.shr_u (local.get $raw) (local.get $top)) (i32.const 1))
              (then
                (call $gs64 (local.get $addr)
                  (i64.load offset=64 (x87i-slot (local.get $top))))
                (drop (x87i-pop))
                (br $next_op)))
            (call $gs64 (local.get $addr) (call $fpu_to_i64 (x87i-pop)))
            (br $next_op)))
        (if (i32.eq (local.get $r) (i32.const 3))
          (then
            (call $gs16 (local.get $addr) (call $fpu_to_i16 (x87i-pop)))
            (br $next_op)))
        (if (i32.eq (local.get $r) (i32.const 2))
          (then
            (call $gs16 (local.get $addr) (call $fpu_to_i16 (local.get $st0)))
            (br $next_op)))
        (br $generic))
        ;; k8: D8 reg -- ST(0) <r> ST(rm)
        (local.set $v (x87i-get-rm))
        (br $arith))
        ;; k9: D9 reg
        (if (i32.eqz (local.get $r))            ;; FLD ST(i)
          (then (x87i-push (x87i-get-rm)) (br $next_op)))
        (if (i32.eq (local.get $r) (i32.const 1))  ;; FXCH ST(i), shadows move too
          (then
            (local.set $v (x87i-get-rm))
            (local.set $p (x87i-phys (local.get $rm)))
            (local.set $m (i32.and (i32.shr_u (local.get $raw) (local.get $top)) (i32.const 1)))
            (local.set $q (i32.and (i32.shr_u (local.get $raw) (local.get $p)) (i32.const 1)))
            (if (local.get $m)
              (then (local.set $r0 (i64.load offset=64 (x87i-slot (local.get $top))))))
            (if (local.get $q)
              (then (local.set $ri (i64.load offset=64 (x87i-slot (local.get $p))))))
            (x87i-set-rm (local.get $st0))
            (x87i-set0 (local.get $v))
            (if (local.get $m)
              (then
                (i64.store offset=64 (x87i-slot (local.get $p)) (local.get $r0))
                (local.set $raw (i32.or (local.get $raw)
                  (i32.shl (i32.const 1) (local.get $p))))))
            (if (local.get $q)
              (then
                (i64.store offset=64 (x87i-slot (local.get $top)) (local.get $ri))
                (local.set $raw (i32.or (local.get $raw)
                  (i32.shl (i32.const 1) (local.get $top))))))
            (br $next_op)))
        (if (i32.eq (local.get $r) (i32.const 5))  ;; constants; D9 EF is reserved
          (then
            (br_if $generic (i32.eq (local.get $rm) (i32.const 7)))
            (local.set $v (f64.const 0.0))
            (if (i32.eqz (local.get $rm)) (then (local.set $v (f64.const 1.0))))
            (if (i32.eq (local.get $rm) (i32.const 1)) (then (local.set $v (f64.const 3.321928094887362))))
            (if (i32.eq (local.get $rm) (i32.const 2)) (then (local.set $v (f64.const 1.4426950408889634))))
            (if (i32.eq (local.get $rm) (i32.const 3)) (then (local.set $v (f64.const 3.141592653589793))))
            (if (i32.eq (local.get $rm) (i32.const 4)) (then (local.set $v (f64.const 0.3010299957316877))))
            (if (i32.eq (local.get $rm) (i32.const 5)) (then (local.set $v (f64.const 0.6931471805599453))))
            (x87i-push (local.get $v))
            (br $next_op)))
        (if (i32.eq (local.get $r) (i32.const 4))
          (then
            (if (i32.eqz (local.get $rm))            ;; FCHS
              (then (x87i-set0 (f64.neg (local.get $st0))) (br $next_op)))
            (if (i32.eq (local.get $rm) (i32.const 1))  ;; FABS
              (then (x87i-set0 (f64.abs (local.get $st0))) (br $next_op)))
            (if (i32.eq (local.get $rm) (i32.const 4))  ;; FTST
              (then (call $fpu_compare (local.get $st0) (f64.const 0)) (br $next_op)))
            (br $generic)))
        (if (i32.eq (local.get $r) (i32.const 7))
          (then
            (if (i32.eq (local.get $rm) (i32.const 2))  ;; FSQRT
              (then
                (if (f64.lt (local.get $st0) (f64.const 0))
                  (then (call $fpu_set_exc (i32.const 0x01))))
                (x87i-set0 (f64.sqrt (local.get $st0)))
                (br $next_op)))
            (if (i32.eq (local.get $rm) (i32.const 4))  ;; FRNDINT
              (then
                (local.set $v (call $fpu_round (local.get $st0)))
                (if (f64.gt (local.get $v) (local.get $st0))
                  (then (global.set $fpu_sw (i32.or (global.get $fpu_sw) (i32.const 0x0200))))
                  (else (global.set $fpu_sw (i32.and (global.get $fpu_sw) (i32.const 0xFDFF)))))
                (x87i-set0 (local.get $v))
                (br $next_op)))
            (br $generic)))
        (if (i32.eq (local.get $r) (i32.const 6))
          (then
            (if (i32.eq (local.get $rm) (i32.const 6))  ;; FDECSTP
              (then
                (f64.store (x87i-slot (local.get $top)) (local.get $st0))
                (local.set $top (i32.and (i32.sub (local.get $top) (i32.const 1)) (i32.const 7)))
                (local.set $st0 (f64.load (x87i-slot (local.get $top))))
                (br $next_op)))
            (if (i32.eq (local.get $rm) (i32.const 7))  ;; FINCSTP
              (then
                (f64.store (x87i-slot (local.get $top)) (local.get $st0))
                (local.set $top (i32.and (i32.add (local.get $top) (i32.const 1)) (i32.const 7)))
                (local.set $st0 (f64.load (x87i-slot (local.get $top))))
                (br $next_op)))
            (br $generic)))
        (if (i32.and (i32.eq (local.get $r) (i32.const 2)) (i32.eqz (local.get $rm)))
          (then (br $next_op)))                  ;; FNOP
        (br $generic))
        ;; k10: DA reg -- FCMOVcc read EFLAGS, FUCOMPP is rare: generic
        (br $generic))
        ;; k11: DB reg -- FUCOMI / FCOMI
        (if (i32.eq (local.get $r) (i32.const 5))
          (then
            (call $fpu_compare_eflags_unord (local.get $st0) (x87i-get-rm))
            (br $next_op)))
        (if (i32.eq (local.get $r) (i32.const 6))
          (then
            (call $fpu_compare_eflags (local.get $st0) (x87i-get-rm))
            (br $next_op)))
        (br $generic))
        ;; k12: DC reg -- ST(rm) = ST(rm) <r> ST(0), no ZE check (as $fpu_exec_reg)
        (local.set $v (x87i-get-rm))
        (if (i32.eqz (local.get $r))
          (then (x87i-set-rm (f64.add (local.get $v) (local.get $st0))) (br $next_op)))
        (if (i32.eq (local.get $r) (i32.const 1))
          (then (x87i-set-rm (call $fpu_mul (local.get $v) (local.get $st0))) (br $next_op)))
        (if (i32.eq (local.get $r) (i32.const 4))
          (then (x87i-set-rm (f64.sub (local.get $st0) (local.get $v))) (br $next_op)))
        (if (i32.eq (local.get $r) (i32.const 5))
          (then (x87i-set-rm (f64.sub (local.get $v) (local.get $st0))) (br $next_op)))
        (if (i32.eq (local.get $r) (i32.const 6))
          (then (x87i-set-rm (f64.div (local.get $st0) (local.get $v))) (br $next_op)))
        (if (i32.eq (local.get $r) (i32.const 7))
          (then (x87i-set-rm (f64.div (local.get $v) (local.get $st0))) (br $next_op)))
        (br $generic))
        ;; k13: DD reg -- FFREE, FST/FSTP ST(i), FUCOM/FUCOMP
        (if (i32.eq (local.get $r) (i32.const 3))
          (then (x87i-set-rm (local.get $st0)) (drop (x87i-pop)) (br $next_op)))
        (if (i32.eq (local.get $r) (i32.const 2))
          (then (x87i-set-rm (local.get $st0)) (br $next_op)))
        (if (i32.eq (local.get $r) (i32.const 4))
          (then (call $fpu_compare (local.get $st0) (x87i-get-rm)) (br $next_op)))
        (if (i32.eq (local.get $r) (i32.const 5))
          (then (call $fpu_compare (local.get $st0) (x87i-get-rm)) (drop (x87i-pop)) (br $next_op)))
        (if (i32.eqz (local.get $r))
          (then
            (local.set $m (i32.xor (i32.const 0xFF)
              (i32.shl (i32.const 1) (x87i-phys (local.get $rm)))))
            (local.set $raw (i32.and (local.get $raw) (local.get $m)))
            (local.set $tag (i32.and (local.get $tag) (local.get $m)))
            (br $next_op)))
        (br $generic))
        ;; k14: DE reg -- ST(rm) = ST(rm) <r> ST(0), pop; FCOMPP
        (local.set $v (x87i-get-rm))
        (if (i32.eqz (local.get $r))
          (then (x87i-set-rm (f64.add (local.get $v) (local.get $st0))) (drop (x87i-pop)) (br $next_op)))
        (if (i32.eq (local.get $r) (i32.const 1))
          (then (x87i-set-rm (call $fpu_mul (local.get $v) (local.get $st0))) (drop (x87i-pop)) (br $next_op)))
        (if (i32.eq (local.get $r) (i32.const 4))
          (then (x87i-set-rm (f64.sub (local.get $st0) (local.get $v))) (drop (x87i-pop)) (br $next_op)))
        (if (i32.eq (local.get $r) (i32.const 5))
          (then (x87i-set-rm (f64.sub (local.get $v) (local.get $st0))) (drop (x87i-pop)) (br $next_op)))
        (if (i32.eq (local.get $r) (i32.const 6))
          (then (x87i-set-rm (f64.div (local.get $st0) (local.get $v))) (drop (x87i-pop)) (br $next_op)))
        (if (i32.eq (local.get $r) (i32.const 7))
          (then (x87i-set-rm (f64.div (local.get $v) (local.get $st0))) (drop (x87i-pop)) (br $next_op)))
        (if (i32.and (i32.eq (local.get $r) (i32.const 3)) (i32.eq (local.get $rm) (i32.const 1)))
          (then
            (call $fpu_compare (local.get $st0)
              (f64.load (x87i-slot (x87i-phys (i32.const 1)))))
            (drop (x87i-pop)) (drop (x87i-pop))
            (br $next_op)))
        (br $generic))
        ;; k15: DF reg -- FNSTSW AX, FUCOMIP, FCOMIP
        (if (i32.eq (local.get $r) (i32.const 5))
          (then
            (call $fpu_compare_eflags_unord (local.get $st0) (x87i-get-rm))
            (drop (x87i-pop))
            (br $next_op)))
        (if (i32.eq (local.get $r) (i32.const 6))
          (then
            (call $fpu_compare_eflags (local.get $st0) (x87i-get-rm))
            (drop (x87i-pop))
            (br $next_op)))
        (if (i32.and (i32.eq (local.get $r) (i32.const 4)) (i32.eqz (local.get $rm)))
          (then
            (global.set $fpu_sw (i32.or (i32.and (global.get $fpu_sw) (i32.const 0xC7FF))
              (i32.shl (local.get $top) (i32.const 11))))
            (i32.store16 (global.get $reg_base) (global.get $fpu_sw))
            (br $next_op)))
        (br $generic))
      ;; $arith: the D8/DA/DC/DE memory forms and the D8 register form.
      ;; $fpu_exec_mem / $fpu_exec_reg group 0: compare, compare-and-pop, or
      ;; ST(0) = $fpu_arith(ST(0), $v, r) -- inlined here with $fpu_arith's
      ;; own ZE tests.
      (if (i32.eq (local.get $r) (i32.const 2))
        (then (call $fpu_compare (local.get $st0) (local.get $v)) (br $next_op)))
      (if (i32.eq (local.get $r) (i32.const 3))
        (then (call $fpu_compare (local.get $st0) (local.get $v)) (drop (x87i-pop)) (br $next_op)))
      (if (i32.eqz (local.get $r))
        (then (x87i-set0 (f64.add (local.get $st0) (local.get $v))) (br $next_op)))
      (if (i32.eq (local.get $r) (i32.const 1))
        (then (x87i-set0 (call $fpu_mul (local.get $st0) (local.get $v))) (br $next_op)))
      (if (i32.eq (local.get $r) (i32.const 4))
        (then (x87i-set0 (f64.sub (local.get $st0) (local.get $v))) (br $next_op)))
      (if (i32.eq (local.get $r) (i32.const 5))
        (then (x87i-set0 (f64.sub (local.get $v) (local.get $st0))) (br $next_op)))
      (if (i32.eq (local.get $r) (i32.const 6))
        (then
          (if (f64.eq (local.get $v) (f64.const 0)) (then (call $fpu_set_exc (i32.const 0x04))))
          (x87i-set0 (f64.div (local.get $st0) (local.get $v)))
          (br $next_op)))
      ;; r = 7, FDIVR
      (if (f64.eq (local.get $st0) (f64.const 0)) (then (call $fpu_set_exc (i32.const 0x04))))
      (x87i-set0 (f64.div (local.get $v) (local.get $st0)))
      (br $next_op))
      ;; $generic: the canonical implementation, on published state.
      (x87i-publish)
      (if (i32.ge_u (local.get $g) (i32.const 8))
        (then (call $fpu_exec_reg (i32.and (local.get $g) (i32.const 7))
                (local.get $r) (local.get $rm)))
        (else (call $fpu_exec_mem (local.get $g) (local.get $r) (local.get $addr))))
      (x87i-reload))
      ;; $next_op
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $fn (i32.load (local.get $cursor)))
      (local.set $op (i32.load offset=4 (local.get $cursor)))
      (local.set $cursor (i32.add (local.get $cursor) (i32.const 8)))
      (br $each)))
    (x87i-publish)
    (global.set $ip (local.get $cursor))
    (global.set $x87_island_runs
      (i32.add (global.get $x87_island_runs) (i32.const 1))))

  ;; ----------------------------------------------------------------------
  ;; ROUND 15 (section 24): the block executor's entry into the five bodies.
  ;;
  ;; $ip must already point at the fused op's inline words -- the executor's
  ;; TU_X87RUN arm sets it to its pool copy -- and every body leaves $ip past
  ;; the words it consumed, exactly as it does on the threaded path. Nothing
  ;; here calls $next, which is the whole point: the executor stays inside its
  ;; own loop instead of paying a resume trampoline.
  ;;
  ;; The dispatch is a compare chain and not a call_indirect, because the
  ;; thread table's entries for 449..453 are the WRAPPERS and calling one of
  ;; those would put $next back.
  (func $x87_run_body (param $fn i32) (param $op i32)
    (if (i32.eq (local.get $fn) (i32.const 449))
      (then (return (call $x87_pipeline4_body (local.get $op)))))
    (if (i32.eq (local.get $fn) (i32.const 450))
      (then (return (call $x87_tree4_body (local.get $op)))))
    (if (i32.eq (local.get $fn) (i32.const 451))
      (then (return (call $x87_island_body (local.get $op)))))
    (if (i32.eq (local.get $fn) (i32.const 452))
      (then (return (call $x87_affine_prepare_body (local.get $op)))))
    ;; 453. The installer only ever emits TU_X87RUN for 449..453, checked
    ;; there, so there is no other case to reach.
    (call $x87_affine_finish_body (local.get $op)))

  ;; Which general registers a fused x87 run READS, as an 8-bit mask over
  ;; EAX..EDI. Every address a fused body forms goes through
  ;; $x87_pipeline_addr, whose `base` nibble is 8 for an absolute address and
  ;; 0..7 for `R[base] + disp`; the packed operand word carries one such
  ;; nibble per memory op. So the answer is pure nibble arithmetic over the
  ;; word the FUSER wrote, and it lives here for the same reason
  ;; $x87_fused_span does: it is the fuser's fact.
  ;;
  ;; Deliberately a SUPERSET for H449 -- its mode selects which of its four
  ;; nibbles are used, and publishing a register the run does not read costs
  ;; one store and cannot be wrong, while missing one is a stale global inside
  ;; the call.
  ;;
  ;; H451 (island) returns 0: its bases are in the absorbed records, not in
  ;; the packed word, and the installer walks those records anyway.
  (func $x87_run_reads (param $fn i32) (param $op i32) (result i32)
    (local $m i32)
    (if (i32.eq (local.get $fn) (i32.const 449))
      (then (return (i32.or
        (i32.or (call $x87_nib_mask (local.get $op) (i32.const 0))
                (call $x87_nib_mask (local.get $op) (i32.const 4)))
        (i32.or (call $x87_nib_mask (local.get $op) (i32.const 8))
                (call $x87_nib_mask (local.get $op) (i32.const 12)))))))
    (if (i32.eq (local.get $fn) (i32.const 450))
      (then (return (i32.or
        (i32.or (call $x87_nib_mask (local.get $op) (i32.const 0))
                (call $x87_nib_mask (local.get $op) (i32.const 4)))
                (call $x87_nib_mask (local.get $op) (i32.const 8))))))
    (if (i32.eq (local.get $fn) (i32.const 452))
      (then (return (i32.or
        (i32.or
          (i32.or (call $x87_nib_mask (local.get $op) (i32.const 0))
                  (call $x87_nib_mask (local.get $op) (i32.const 4)))
          (i32.or (call $x87_nib_mask (local.get $op) (i32.const 8))
                  (call $x87_nib_mask (local.get $op) (i32.const 12))))
        (call $x87_nib_mask (local.get $op) (i32.const 16))))))
    (if (i32.eq (local.get $fn) (i32.const 453))
      (then (return (i32.or
        (call $x87_nib_mask (local.get $op) (i32.const 0))
        (call $x87_nib_mask (local.get $op) (i32.const 4))))))
    (i32.const 0))

  ;; One address nibble -> its register bit, or 0 for the absolute form.
  (func $x87_nib_mask (param $op i32) (param $sh i32) (result i32)
    (local $n i32)
    (local.set $n (i32.and (i32.shr_u (local.get $op) (local.get $sh)) (i32.const 0xF)))
    (if (i32.gt_u (local.get $n) (i32.const 7)) (then (return (i32.const 0))))
    (i32.shl (i32.const 1) (local.get $n)))

  ;; The island's per-op questions, asked at INSTALL time off the threaded
  ;; record rather than at run time off the cursor. Two separate facts:
  ;;
  ;;   $x87_island_op_base  -- the register bit this op reads, 0 if none.
  ;;   $x87_island_op_ok    -- may this op run with a PARTIAL register publish?
  ;;
  ;; The second is the conservative half and is why the island family needs a
  ;; walk at all. $th_x87_island forwards whatever (group, reg, rm) it finds
  ;; to $fpu_exec_mem / $fpu_exec_reg, and two of those outcomes are not safe
  ;; for a native micro-op:
  ;;
  ;;   * an unimplemented form reaches $fpu_crash_op, which TRAPS -- and a
  ;;     trap taken with only some registers published names a register file
  ;;     that never existed. $tree_x87_mem_ok / $tree_x87_reg_ok are exactly
  ;;     the "this form is implemented" predicates, reused rather than copied.
  ;;   * FNSTSW AX (DF E0) WRITES EAX. The executor holds EAX in a local, so
  ;;     the write would be dropped at the next publish. $tree_x87_reg_ok
  ;;     declines group 7 outright, which covers it; this is noted because it
  ;;     is the case that would be silently wrong rather than loud.
  ;;
  ;; A run holding either stays on the old TU_FALLBACK path, which publishes
  ;; and reloads all eight and is correct for both.
  (func $x87_island_op_base (param $fn i32) (param $op i32) (result i32)
    (if (i32.eq (local.get $fn) (i32.const 190))
      (then
        ;; $x87_island_op_ok declines a base above 7, so this cannot be
        ;; reached with one -- the guard is here anyway because a mask that
        ;; names the wrong register is a stale global and not a crash.
        (if (i32.gt_u (i32.and (local.get $op) (i32.const 0xF)) (i32.const 7))
          (then (return (i32.const 0))))
        (return (i32.shl (i32.const 1)
                  (i32.and (local.get $op) (i32.const 0x7))))))
    (i32.const 0))

  (func $x87_island_op_ok (param $fn i32) (param $op i32) (result i32)
    (if (i32.eq (local.get $fn) (i32.const 190))
      (then
        (if (i32.gt_u (i32.and (local.get $op) (i32.const 0xF)) (i32.const 7))
          (then (return (i32.const 0))))))
    (if (i32.eq (local.get $fn) (i32.const 188))
      (then (return (call $tree_x87_mem_ok
        (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF))
        (i32.and (local.get $op) (i32.const 0xF))))))
    (if (i32.eq (local.get $fn) (i32.const 190))
      (then (return (call $tree_x87_mem_ok
        (i32.and (i32.shr_u (local.get $op) (i32.const 8)) (i32.const 0xF))
        (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF))))))
    (if (i32.eq (local.get $fn) (i32.const 189))
      (then (return (call $tree_x87_reg_ok
        (i32.and (i32.shr_u (local.get $op) (i32.const 8)) (i32.const 0xF))
        (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF))
        (i32.and (local.get $op) (i32.const 0xF))))))
    (i32.const 0))

  ;; Does this block end in a conditional branch back to its own entry?
  (func $loop_is_selfloop (param $start_eip i32) (result i32)
    (local $p i32)
    (if (i32.lt_u (global.get $op_index_n) (i32.const 2)) (then (return (i32.const 0))))
    (local.set $p (call $loop_op_at
      (i32.sub (global.get $op_index_n) (i32.const 1))))
    ;; H404 is `test r,r + Jcc` fused into one op. It is NOT added to
    ;; $loop_is_jcc, deliberately: every specialised family calls that to mean
    ;; "the last op is a pure branch and nothing else", and a fused op that also
    ;; computes an AND and publishes flags would be silently unmodelled in each
    ;; of them. Only the general executor knows what to do with it (term_kind
    ;; 6), and it is the only matcher that has to see this block at all -- so the
    ;; widening lives here, where the word layout (+8 fall, +12 target) is the
    ;; one thing being relied on, and H404 has exactly that.
    (if (i32.eqz (i32.or
                   (i32.or
                     (call $loop_is_jcc (load.field LoopOp handler (local.get $p)))
                     (i32.eq (load.field LoopOp handler (local.get $p)) (i32.const 46)))
                   (i32.eq (load.field LoopOp handler (local.get $p)) (i32.const 404))))
      (then (return (i32.const 0))))
    ;; Jcc/H404 store fall-through then target. LOOP is the lone conditional
    ;; branch with the reverse descriptor order: target then fall-through.
    (i32.eq
      (i32.load offset=8
        (i32.add (local.get $p)
          (select (i32.const 0) (i32.const 4)
            (i32.eq (load.field LoopOp handler (local.get $p)) (i32.const 46)))))
      (local.get $start_eip)))

  ;; Flag-gated decode-time dump: marker, entry EIP, op count, then
  ;; (handler index, operand) per op. Decoded by tools/loopmatch-decode.js.
  (func $loop_trace_block (param $start_eip i32)
    (local $i i32) (local $p i32)
    (call $host_log_i32 (i32.const 0x100B0000))
    (call $host_log_i32 (local.get $start_eip))
    (call $host_log_i32 (global.get $op_index_n))
    (local.set $i (i32.const 0))
    (block $done
      (loop $each
        (br_if $done (i32.ge_u (local.get $i) (global.get $op_index_n)))
        (local.set $p (call $loop_op_at (local.get $i)))
        (call $host_log_i32 (load.field LoopOp handler (local.get $p)))
        (call $host_log_i32 (load.field.memarg LoopOp operand (local.get $p)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $each))))

  ;; ------------------------------------------------------------------
  ;; LUT_RUN
  ;; ------------------------------------------------------------------
  ;;   dst[i] = table[src[i]] for a counted run, e.g. Heroes II's shadow
  ;;   remap at 0x004c755d:
  ;;
  ;;     xor eax,eax / inc esi / mov al,[esi-1] / mov [g0],esi
  ;;     dec edx     / mov [g1],ecx / mov al,[eax+ecx] / mov [esi-1],al / jnz ^
  ;;
  ;; The predicate below is written against ROLES, not against that sequence:
  ;; the registers, the two displacements, the induction stride, the direction
  ;; of the counter and the presence of the two spill stores are all
  ;; parameters. Order within the body does not matter except where it changes
  ;; meaning, and where it does (whether the cursor is bumped before or after
  ;; the memory access) it is folded into the displacement at match time.
  ;;
  ;; Both this counted recognizer and the bounded recognizer below emit one
  ;; universal descriptor. Execution is shared; recognition remains separate
  ;; because proving JNZ(counter) and JB(cursor,bound) safe needs different
  ;; predicates.
  ;;
  ;; Parameter block, emitted as raw words after the super-op header:
  ;;   0 src_reg     1 src_stride  2 src_disp
  ;;   3 dst_reg     4 dst_stride  5 dst_disp
  ;;   6 tbl_reg     7 acc_reg     8 index_shift  9 index_add_reg (-1 = none)
  ;;  10 term_kind (0=count NZ, 1=cursor below bound)
  ;;  11 term_reg    12 term_step
  ;;  13 m0_addr    14 m0_reg     15 m0_adj
  ;;  16 m1_addr    17 m1_reg     18 m1_adj
  ;;  19 fall_eip   20 back_eip   21 steps_per_iter
  ;;
  ;; Header operand value 1 selects the optional two-moving-source extension:
  ;;  22 src2_reg   23 src2_stride 24 src2_disp
  ;;  25 aux_reg    26 table_disp  27 term_stream (0=src1, 1=src2)
  ;; In that form the lookup index is `(src1_byte << index_shift) + src2_byte`.
  ;; tbl_reg may be -1 for an absolute table rooted at table_disp. Bit 3 is the
  ;; counted one-source absolute-table form: word 6 holds the table's guest
  ;; address instead of a register index, and the descriptor stays 22 words.
  ;; Bits 1 and 2 were Heroes III's u16 wide-pixel and stack-table forms
  ;; (the counted RGB565 recognizer); both retired to the uop tier,
  ;; docs/uop-tier-design.md section 18.
  (global $LOOP_SUPEROP_LUT i32 (i32.const 418))
  (global $LOOP_LUT_PARAMS i32 (i32.const 22))

  ;; Is this register one of the block's cursors -- an inc/dec target that is
  ;; not the trip counter? Roles are assigned by evidence in pass 2, and this
  ;; is the membership test both cursor decisions are made with.
  (func $loop_is_cursor (param $reg i32) (param $mask i32) (param $ctr i32) (result i32)
    (i32.and
      (i32.ne
        (i32.and (local.get $mask) (i32.shl (i32.const 1) (local.get $reg)))
        (i32.const 0))
      (i32.ne (local.get $reg) (local.get $ctr))))

  ;; A spill of a cursor records whatever that cursor held at that point in the
  ;; body; the super-op writes it once, at exit, from the final value, so a
  ;; spill that ran before the bump is one stride behind.
  (func $loop_cursor_adj (param $mreg i32) (param $midx i32)
        (param $creg i32) (param $cstride i32) (param $cidx i32) (result i32)
    (select (i32.sub (i32.const 0) (local.get $cstride)) (i32.const 0)
      (i32.and (i32.eq (local.get $mreg) (local.get $creg))
               (i32.lt_u (local.get $midx) (local.get $cidx)))))

  (func $loop_try_lut (param $start_eip i32) (param $tstart i32) (result i32)
    (local $i i32) (local $n i32) (local $p i32) (local $fn i32) (local $op i32)
    (local $role i32)
    (local $iv_reg i32) (local $iv_stride i32) (local $iv_idx i32)
    (local $dst_reg i32) (local $dst_stride i32) (local $dst_idx i32)
    (local $ctr_reg i32) (local $ctr_step i32) (local $ctr_idx i32)
    (local $addi_cnt i32) (local $addi_mask i32) (local $other_cnt i32)
    (local $res_reg i32) (local $hoist i32) (local $m0_adj i32) (local $m1_adj i32)
    (local $acc_reg i32) (local $zero_cnt i32)
    (local $ld_reg i32) (local $ld_base i32) (local $ld_disp i32) (local $ld_idx i32) (local $ld_cnt i32)
    (local $ald_reg i32) (local $ald_base i32) (local $ald_disp i32) (local $ald_idx i32)
    (local $tbl_reg i32) (local $lut_cnt i32) (local $lut_idx i32)
    (local $st_reg i32) (local $st_base i32) (local $st_disp i32) (local $st_idx i32) (local $st_cnt i32)
    (local $m0_addr i32) (local $m0_reg i32) (local $m0_idx i32)
    (local $m1_addr i32) (local $m1_reg i32) (local $m1_idx i32)
    (local $mir_cnt i32) (local $written i32) (local $info i32) (local $b i32) (local $x i32)
    (local $fall i32) (local $abs_table i32) (local $abs_lut i32)

    (local.set $n (global.get $op_index_n))
    ;; The shape needs at least zero/iv/load/lut/store/ctr/jcc.
    (if (i32.lt_u (local.get $n) (i32.const 7)) (then (return (i32.const 0))))
    (if (i32.gt_u (local.get $n) (i32.const 16)) (then (return (i32.const 0))))
    (local.set $iv_reg (i32.const -1))
    (local.set $ctr_reg (i32.const -1))
    (local.set $acc_reg (i32.const -1))
    (local.set $tbl_reg (i32.const -1))

    ;; ---- pass 1: roles, and the set of registers the body writes ----
    (local.set $i (i32.const 0))
    (block $p1_done
      (loop $p1
        (br_if $p1_done (i32.ge_u (local.get $i) (local.get $n)))
        (local.set $p (call $loop_op_at (local.get $i)))
        (local.set $fn (load.field LoopOp handler (local.get $p)))
        (local.set $op (load.field.memarg LoopOp operand (local.get $p)))
        (local.set $role (call $loop_role (local.get $fn) (local.get $op)))
        (if (i32.eq (local.get $role) (global.get $LR_UNKNOWN))
          (then (return (i32.const 0))))
        ;; MEMCTR is a role for COPY_RUN's sake, not this one. LUT_RUN models
        ;; no memory-resident counter, and its counting gates below would not
        ;; notice one -- so a block carrying it would lower to a super-op that
        ;; silently dropped the decrement. Decline explicitly.
        (if (i32.eq (local.get $role) (global.get $LR_MEMCTR))
          (then (return (i32.const 0))))

        ;; Roles this matcher does not model. They are counted rather than
        ;; declined outright because an in-block zero redefines the whole
        ;; accumulator, making anything before it irrelevant; without one, the
        ;; accumulator's high bits must be provably untouched, so pass 2
        ;; requires this count to be zero.
        (if (i32.or (i32.eq (local.get $role) (global.get $LR_CMP))
              (i32.or (i32.eq (local.get $role) (global.get $LR_SHIFT))
                      (i32.eq (local.get $role) (global.get $LR_ADD))))
          (then (local.set $other_cnt (i32.add (local.get $other_cnt) (i32.const 1)))))

        (if (i32.eq (local.get $role) (global.get $LR_ADDI))
          (then
            ;; inc (64) / dec (65): operand is the register, step is +1 / -1.
            (local.set $written (i32.or (local.get $written)
              (i32.shl (i32.const 1) (i32.and (local.get $op) (i32.const 0xF)))))
            (local.set $addi_mask (i32.or (local.get $addi_mask)
              (i32.shl (i32.const 1) (i32.and (local.get $op) (i32.const 0xF)))))
            (local.set $addi_cnt (i32.add (local.get $addi_cnt) (i32.const 1)))
            ;; Which ADDI is the counter and which are the cursors is decided
            ;; by evidence in pass 2, never by arrival order. The one thing
            ;; position does settle is the counter: only the LAST ADDI can be
            ;; the flag-setter the exit test reads, so record it here and let
            ;; pass 2 rescan for the cursors it names.
            (local.set $ctr_reg (i32.and (local.get $op) (i32.const 0xF)))
            (local.set $ctr_step
              (select (i32.const 1) (i32.const -1) (i32.eq (local.get $fn) (i32.const 64))))
            (local.set $ctr_idx (local.get $i))))

        (if (i32.eq (local.get $role) (global.get $LR_ZERO))
          (then
            (local.set $zero_cnt (i32.add (local.get $zero_cnt) (i32.const 1)))
            (local.set $acc_reg (i32.and (local.get $op) (i32.const 0xF)))
            (local.set $written (i32.or (local.get $written)
              (i32.shl (i32.const 1) (local.get $acc_reg))))))

        (if (i32.eq (local.get $role) (global.get $LR_LOAD8))
          (then
            (if (i32.eqz (local.get $ld_cnt))
              (then
                (local.set $ld_base (i32.and (local.get $op) (i32.const 0xF)))
                (local.set $ld_reg (i32.shr_u (local.get $op) (i32.const 4)))
                (local.set $ld_disp (i32.load offset=8 (local.get $p)))
                (local.set $ld_idx (local.get $i)))
              (else
                (if (i32.ne (local.get $ld_cnt) (i32.const 1))
                  (then (return (i32.const 0))))
                (local.set $ald_base (i32.and (local.get $op) (i32.const 0xF)))
                (local.set $ald_reg (i32.shr_u (local.get $op) (i32.const 4)))
                (local.set $ald_disp (i32.load offset=8 (local.get $p)))
                (local.set $ald_idx (local.get $i))))
            (local.set $ld_cnt (i32.add (local.get $ld_cnt) (i32.const 1)))
            ;; A byte load writes only the low 8 bits, but either the
            ;; accumulator was zeroed in-block or pass 2 proves its high bits
            ;; loop-invariant, so the register is defined here either way.
            ;; This is the destination of THIS load: reading $ld_reg here would
            ;; re-mark the first load's register and leave the second's out.
            (local.set $written (i32.or (local.get $written)
              (i32.shl (i32.const 1) (i32.shr_u (local.get $op) (i32.const 4)))))))

        (if (i32.eq (local.get $role) (global.get $LR_LOAD8S))
          (then
            (local.set $lut_cnt (i32.add (local.get $lut_cnt) (i32.const 1)))
            (local.set $lut_idx (local.get $i))
            (local.set $info (i32.load offset=8 (local.get $p)))
            ;; A LUT lookup indexes a table with the byte just loaded: scale 1,
            ;; no displacement, one operand the accumulator and the other a
            ;; register the body never writes.
            (if (i32.ne (i32.load offset=12 (local.get $p)) (i32.const 0))
              (then (return (i32.const 0))))
            (if (i32.ne (i32.and (i32.shr_u (local.get $info) (i32.const 8)) (i32.const 3))
                        (i32.const 0))
              (then (return (i32.const 0))))
            (local.set $b (i32.and (local.get $info) (i32.const 0xF)))
            (local.set $x (i32.and (i32.shr_u (local.get $info) (i32.const 4)) (i32.const 0xF)))
            (if (i32.or (i32.eq (local.get $b) (i32.const 0xF))
                        (i32.eq (local.get $x) (i32.const 0xF)))
              (then (return (i32.const 0))))
            ;; destination byte register, from the fused-consumer operand
            (local.set $written (i32.or (local.get $written)
              (i32.shl (i32.const 1) (i32.and (local.get $op) (i32.const 7)))))))

        (if (i32.eq (local.get $role) (global.get $LR_STORE8))
          (then
            (local.set $st_cnt (i32.add (local.get $st_cnt) (i32.const 1)))
            (local.set $st_base (i32.and (local.get $op) (i32.const 0xF)))
            (local.set $st_reg (i32.shr_u (local.get $op) (i32.const 4)))
            (local.set $st_disp (i32.load offset=8 (local.get $p)))
            (local.set $st_idx (local.get $i))))

        (if (i32.eq (local.get $role) (global.get $LR_MIRROR))
          (then
            (if (i32.eqz (local.get $mir_cnt))
              (then
                (local.set $m0_addr (i32.load offset=8 (local.get $p)))
                (local.set $m0_reg (local.get $op))
                (local.set $m0_idx (local.get $i)))
              (else
                (if (i32.ge_u (local.get $mir_cnt) (i32.const 2)) (then (return (i32.const 0))))
                (local.set $m1_addr (i32.load offset=8 (local.get $p)))
                (local.set $m1_reg (local.get $op))
                (local.set $m1_idx (local.get $i))))
            (local.set $mir_cnt (i32.add (local.get $mir_cnt) (i32.const 1)))))

        ;; Only the final op may be the branch.
        (if (i32.eq (local.get $role) (global.get $LR_JCC))
          (then
            (if (i32.ne (local.get $i) (i32.sub (local.get $n) (i32.const 1)))
              (then (return (i32.const 0))))))

        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $p1)))

    ;; ---- pass 2: the predicate ----
    ;; Two or three inc/dec: a counter, plus either one cursor used for both
    ;; streams or a separate source and destination cursor.
    (if (i32.lt_u (local.get $addi_cnt) (i32.const 2)) (then (return (i32.const 0))))
    (if (i32.gt_u (local.get $addi_cnt) (i32.const 3)) (then (return (i32.const 0))))
    (if (i32.gt_u (local.get $zero_cnt) (i32.const 1)) (then (return (i32.const 0))))
    ;; A zero hoisted out of the loop is admissible, and is better than a
    ;; runtime guard: within the body the accumulator is written only by the
    ;; streamed byte load, so its high bits are loop-invariant and fold into
    ;; the table base once at entry, leaving the per-iteration index in 0..255.
    ;; That only holds if every op in the block is one this matcher models --
    ;; a shift or an add on the accumulator would move those bits.
    (if (i32.eqz (local.get $zero_cnt))
      (then
        (local.set $hoist (i32.const 1))
        (if (local.get $other_cnt) (then (return (i32.const 0))))))
    ;; Most loops decode the table read as fused SIB LOAD8S. Jazz's hottest
    ;; palette loop uses `mov dl,[edx+absolute]`, whose simple-base decoder form
    ;; is a second LOAD8. Prove that exact dataflow and feed it to the same H418
    ;; executor with an absolute table descriptor.
    (if (i32.and (i32.eq (local.get $ld_cnt) (i32.const 2))
                  (i32.eqz (local.get $lut_cnt)))
      (then
        ;; Which of the two loads streams the source is decided by its base
        ;; being a cursor, not by an accumulator the zero op named -- there may
        ;; not be one. The other load's base must then be the first's
        ;; destination, which is what makes it a table read.
        (if (call $loop_is_cursor (local.get $ld_base) (local.get $addi_mask)
              (local.get $ctr_reg))
          (then
            (if (i32.ne (local.get $ald_base) (local.get $ld_reg))
              (then (return (i32.const 0))))
            (local.set $lut_idx (local.get $ald_idx))
            (local.set $abs_table (local.get $ald_disp))
            (local.set $res_reg (local.get $ald_reg)))
          (else
            (if (i32.eqz (call $loop_is_cursor (local.get $ald_base)
                           (local.get $addi_mask) (local.get $ctr_reg)))
              (then (return (i32.const 0))))
            (if (i32.ne (local.get $ld_base) (local.get $ald_reg))
              (then (return (i32.const 0))))
            (local.set $lut_idx (local.get $ld_idx))
            (local.set $abs_table (local.get $ld_disp))
            (local.set $res_reg (local.get $ld_reg))
            (local.set $ld_reg (local.get $ald_reg))
            (local.set $ld_base (local.get $ald_base))
            (local.set $ld_disp (local.get $ald_disp))
            (local.set $ld_idx (local.get $ald_idx))))
        (local.set $abs_lut (i32.const 1)))
      (else
        (if (i32.ne (local.get $ld_cnt) (i32.const 1))
          (then (return (i32.const 0))))
        (if (i32.ne (local.get $lut_cnt) (i32.const 1))
          (then (return (i32.const 0))))
        ;; The fused SIB load's destination is its own operand's low 3 bits.
        (local.set $res_reg
          (i32.and (load.field.memarg LoopOp operand (call $loop_op_at (local.get $lut_idx)))
                   (i32.const 7)))))
    ;; With no in-block zero, the source load names the accumulator.
    (if (local.get $hoist) (then (local.set $acc_reg (local.get $ld_reg))))
    (local.set $iv_reg (local.get $ld_base))
    (if (i32.ne (local.get $st_cnt) (i32.const 1)) (then (return (i32.const 0))))

    ;; The counter must be the register the exit test reads, and must not be
    ;; the cursor. We only accept the JNZ form: exit when the counter hits 0.
    (local.set $p (call $loop_op_at (i32.sub (local.get $n) (i32.const 1))))
    (if (i32.ne (load.field LoopOp handler (local.get $p)) (i32.const 312)) (then (return (i32.const 0))))
    (if (i32.eq (local.get $ctr_reg) (local.get $iv_reg)) (then (return (i32.const 0))))
    ;; The counter must be the last flag-setting op before the branch, or the
    ;; condition is not the one we are modelling.
    (if (i32.ne (local.get $ctr_idx) (i32.sub (local.get $n) (i32.const 2)))
      (then
        ;; Tolerate mirror stores between the counter and the branch: a store
        ;; to an absolute address does not touch flags.
        (local.set $i (i32.add (local.get $ctr_idx) (i32.const 1)))
        (block $tail_ok
          (loop $tail
            (br_if $tail_ok (i32.ge_u (local.get $i) (i32.sub (local.get $n) (i32.const 1))))
            (local.set $x (call $loop_op_at (local.get $i)))
            (if (i32.ne (call $loop_role (i32.load (local.get $x))
                          (i32.load offset=4 (local.get $x)))
                        (global.get $LR_MIRROR))
              (then
                ;; A byte load or store leaves flags alone too.
                (if (i32.eqz (i32.or
                      (i32.eq (call $loop_role (i32.load (local.get $x))
                                (i32.load offset=4 (local.get $x)))
                              (global.get $LR_STORE8))
                      (i32.or
                        (i32.eq (call $loop_role (i32.load (local.get $x))
                                  (i32.load offset=4 (local.get $x)))
                                (global.get $LR_LOAD8))
                        (i32.eq (call $loop_role (i32.load (local.get $x))
                                  (i32.load offset=4 (local.get $x)))
                                (global.get $LR_LOAD8S)))))
                  (then (return (i32.const 0))))))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $tail)))))

    ;; Source and destination each stream off a cursor. They may be the same
    ;; register -- that is the one-cursor form this used to require -- or two
    ;; different ones, which the executor already carries as separate
    ;; src_reg/dst_reg descriptor fields.
    (local.set $dst_reg (local.get $st_base))
    (if (i32.eqz (call $loop_is_cursor (local.get $iv_reg) (local.get $addi_mask)
                   (local.get $ctr_reg)))
      (then (return (i32.const 0))))
    (if (i32.eqz (call $loop_is_cursor (local.get $dst_reg) (local.get $addi_mask)
                   (local.get $ctr_reg)))
      (then (return (i32.const 0))))
    ;; Every inc/dec must have a role: counter, source cursor, destination
    ;; cursor. A stray one would be dropped by the fold.
    (if (i32.ne (local.get $addi_cnt)
                (select (i32.const 3) (i32.const 2)
                        (i32.ne (local.get $iv_reg) (local.get $dst_reg))))
      (then (return (i32.const 0))))
    ;; Rescan for each cursor's own stride and position; the counter was the
    ;; last inc/dec and is excluded by index.
    (local.set $iv_idx (i32.const -1))
    (local.set $dst_idx (i32.const -1))
    (local.set $i (i32.const 0))
    (block $addi_done
      (loop $addi_scan
        (br_if $addi_done (i32.ge_u (local.get $i) (local.get $n)))
        (local.set $p (call $loop_op_at (local.get $i)))
        (local.set $fn (load.field LoopOp handler (local.get $p)))
        (local.set $op (load.field.memarg LoopOp operand (local.get $p)))
        (if (i32.and
              (i32.eq (call $loop_role (local.get $fn) (local.get $op))
                      (global.get $LR_ADDI))
              (i32.ne (local.get $i) (local.get $ctr_idx)))
          (then
            (local.set $x (i32.and (local.get $op) (i32.const 0xF)))
            (local.set $b (select (i32.const 1) (i32.const -1)
                            (i32.eq (local.get $fn) (i32.const 64))))
            (if (i32.eq (local.get $x) (local.get $iv_reg))
              (then
                (if (i32.ne (local.get $iv_idx) (i32.const -1))
                  (then (return (i32.const 0))))
                (local.set $iv_stride (local.get $b))
                (local.set $iv_idx (local.get $i))))
            (if (i32.eq (local.get $x) (local.get $dst_reg))
              (then
                (if (i32.ne (local.get $dst_idx) (i32.const -1))
                  (then (return (i32.const 0))))
                (local.set $dst_stride (local.get $b))
                (local.set $dst_idx (local.get $i))))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $addi_scan)))
    (if (i32.eq (local.get $iv_idx) (i32.const -1)) (then (return (i32.const 0))))
    (if (i32.eq (local.get $dst_idx) (i32.const -1)) (then (return (i32.const 0))))
    ;; The accumulator is loaded from the source and used as the table index;
    ;; the table's byte lands in the result register, which is what the store
    ;; writes. They are the same register in the classic form and different in
    ;; the two-register form -- both are proved, neither is assumed.
    (if (i32.ne (local.get $ld_reg) (local.get $acc_reg)) (then (return (i32.const 0))))
    (if (i32.ne (local.get $st_reg) (local.get $res_reg)) (then (return (i32.const 0))))
    ;; Byte-register indices above 3 name AH/CH/DH/BH, which are not the low
    ;; byte of the register the xor zeroed. Decline rather than model them.
    (if (i32.gt_u (local.get $acc_reg) (i32.const 3)) (then (return (i32.const 0))))
    (if (i32.gt_u (local.get $res_reg) (i32.const 3)) (then (return (i32.const 0))))
    ;; The universal executor publishes the accumulator, result, cursors and
    ;; terminator once at the block boundary. Aliasing those architectural roles
    ;; would make their original per-instruction write order observable, so
    ;; decline it.
    (if (i32.or (i32.eq (local.get $acc_reg) (local.get $iv_reg))
                (i32.or (i32.eq (local.get $acc_reg) (local.get $dst_reg))
                        (i32.eq (local.get $acc_reg) (local.get $ctr_reg))))
      (then (return (i32.const 0))))
    (if (i32.or (i32.eq (local.get $res_reg) (local.get $iv_reg))
                (i32.or (i32.eq (local.get $res_reg) (local.get $dst_reg))
                        (i32.eq (local.get $res_reg) (local.get $ctr_reg))))
      (then (return (i32.const 0))))
    (if (i32.eqz (local.get $abs_lut))
      (then
        ;; The fused SIB load's destination is its own operand's low 3 bits.
        (local.set $p (call $loop_op_at (local.get $ld_idx)))
        (local.set $i (i32.const 0))
        (block $find_lut_done
          (loop $find_lut
            (br_if $find_lut_done (i32.ge_u (local.get $i) (local.get $n)))
            (local.set $x (call $loop_op_at (local.get $i)))
            (if (i32.eq (call $loop_role (i32.load (local.get $x)) (i32.load offset=4 (local.get $x)))
                        (global.get $LR_LOAD8S))
              (then
                (if (i32.ne (i32.and (i32.load offset=4 (local.get $x)) (i32.const 7))
                            (local.get $res_reg))
                  (then (return (i32.const 0))))
                (local.set $info (i32.load offset=8 (local.get $x)))
                (local.set $b (i32.and (local.get $info) (i32.const 0xF)))
                (local.set $x (i32.and (i32.shr_u (local.get $info) (i32.const 4)) (i32.const 0xF)))
                (if (i32.eq (local.get $b) (local.get $acc_reg))
                  (then (local.set $tbl_reg (local.get $x)))
                  (else
                    (if (i32.ne (local.get $x) (local.get $acc_reg)) (then (return (i32.const 0))))
                    (local.set $tbl_reg (local.get $b))))
                (br $find_lut_done)))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $find_lut)))
        (if (i32.lt_s (local.get $tbl_reg) (i32.const 0)) (then (return (i32.const 0))))
        ;; The table base has to be loop-invariant, or it is not a table.
        (if (i32.and (local.get $written)
              (i32.shl (i32.const 1) (local.get $tbl_reg)))
          (then (return (i32.const 0))))))

    ;; The source byte must be read before it is used as an index, and the
    ;; result stored after. Anything else is a different loop.
    (if (i32.ge_u (local.get $ld_idx) (local.get $lut_idx)) (then (return (i32.const 0))))
    (if (i32.ge_u (local.get $lut_idx) (local.get $st_idx)) (then (return (i32.const 0))))

    ;; The universal executor bumps cursors after each access. An access the
    ;; original performed after its bump therefore needs one stride folded into
    ;; its displacement; an access before the bump already agrees.
    (if (i32.lt_u (local.get $iv_idx) (local.get $ld_idx))
      (then (local.set $ld_disp (i32.add (local.get $ld_disp) (local.get $iv_stride)))))
    (if (i32.lt_u (local.get $dst_idx) (local.get $st_idx))
      (then (local.set $st_disp (i32.add (local.get $st_disp) (local.get $dst_stride)))))

    ;; A mirror whose register the body writes, other than a cursor, would
    ;; need its own per-iteration value; decline instead of guessing.
    (if (i32.ne (local.get $m0_addr) (i32.const 0))
      (then
        (if (i32.and (i32.and (local.get $written)
                       (i32.shl (i32.const 1) (local.get $m0_reg)))
                     (i32.and (i32.ne (local.get $m0_reg) (local.get $iv_reg))
                              (i32.ne (local.get $m0_reg) (local.get $dst_reg))))
          (then (return (i32.const 0))))))
    (if (i32.ne (local.get $m1_addr) (i32.const 0))
      (then
        (if (i32.and (i32.and (local.get $written)
                       (i32.shl (i32.const 1) (local.get $m1_reg)))
                     (i32.and (i32.ne (local.get $m1_reg) (local.get $iv_reg))
                              (i32.ne (local.get $m1_reg) (local.get $dst_reg))))
          (then (return (i32.const 0))))))
    ;; A spill of a cursor is one stride behind when it ran before that
    ;; cursor's bump. With two cursors the adjustment is per cursor.
    (local.set $m0_adj
      (select
        (call $loop_cursor_adj (local.get $m0_reg) (local.get $m0_idx)
          (local.get $iv_reg) (local.get $iv_stride) (local.get $iv_idx))
        (call $loop_cursor_adj (local.get $m0_reg) (local.get $m0_idx)
          (local.get $dst_reg) (local.get $dst_stride) (local.get $dst_idx))
        (i32.eq (local.get $m0_reg) (local.get $iv_reg))))
    (local.set $m1_adj
      (select
        (call $loop_cursor_adj (local.get $m1_reg) (local.get $m1_idx)
          (local.get $iv_reg) (local.get $iv_stride) (local.get $iv_idx))
        (call $loop_cursor_adj (local.get $m1_reg) (local.get $m1_idx)
          (local.get $dst_reg) (local.get $dst_stride) (local.get $dst_idx))
        (i32.eq (local.get $m1_reg) (local.get $iv_reg))))

    ;; ---- emit ----
    (global.set $loop_matched_blocks
      (i32.add (global.get $loop_matched_blocks) (i32.const 1)))
    ;; Which family claimed which block. The block dump alone cannot say: it is
    ;; printed before either predicate runs, so a 387-block trace with 2 matches
    ;; in it names neither. Marker 0x100B0001 = LUT_RUN, then the entry EIP.
    (if (global.get $loop_trace)
      (then
        (call $host_log_i32 (i32.const 0x100B0001))
        (call $host_log_i32 (local.get $start_eip))))
    (if (i32.eqz (global.get $loop_lut_emit_enabled)) (then (return (i32.const 0))))

    (local.set $fall (i32.load offset=8
      (call $loop_op_at (i32.sub (local.get $n) (i32.const 1)))))
    ;; Rewind over the ops just emitted and put the super-op in their place.
    ;; This is the only rewind of $thread_alloc in the decoder, and it happens
    ;; after every emit for this block, so nothing else can be pointing into
    ;; the range being reclaimed. The op index is reset with it.
    (global.set $thread_alloc (local.get $tstart))
    (global.set $op_index_n (i32.const 0))
    (call $te (global.get $LOOP_SUPEROP_LUT)
      (select (i32.const 8) (i32.const 0) (local.get $abs_lut)))
    (call $te_raw (local.get $iv_reg))
    (call $te_raw (local.get $iv_stride))
    (call $te_raw (local.get $ld_disp))
    (call $te_raw (local.get $dst_reg))
    (call $te_raw (local.get $dst_stride))
    (call $te_raw (local.get $st_disp))
    (call $te_raw (select (local.get $abs_table) (local.get $tbl_reg)
      (local.get $abs_lut)))
    ;; The accumulator word carries three fields, because every other emitter
    ;; of this descriptor writes a bare 0..7 register here and must keep
    ;; working: bits 0-7 the accumulator, bits 8-15 the result register plus
    ;; one (0 = the same register), bit 16 the hoisted-zero flag.
    (call $te_raw
      (i32.or (local.get $acc_reg)
        (i32.or
          (select (i32.shl (i32.add (local.get $res_reg) (i32.const 1)) (i32.const 8))
                  (i32.const 0)
                  (i32.ne (local.get $res_reg) (local.get $acc_reg)))
          (i32.shl (local.get $hoist) (i32.const 16)))))
    (call $te_raw (i32.const 0))
    (call $te_raw (i32.const -1))
    (call $te_raw (i32.const 0))
    (call $te_raw (local.get $ctr_reg))
    (call $te_raw (local.get $ctr_step))
    (call $te_raw (local.get $m0_addr))
    (call $te_raw (local.get $m0_reg))
    (call $te_raw (local.get $m0_adj))
    (call $te_raw (local.get $m1_addr))
    (call $te_raw (local.get $m1_reg))
    (call $te_raw (local.get $m1_adj))
    (call $te_raw (local.get $fall))
    (call $te_raw (local.get $start_eip))
    (call $te_raw (local.get $n))
    (i32.const 1))

  ;; Exact implicit-register LUT spelling used by Diablo at 0x00441ab9:
  ;;
  ;;   mov al,[edi] / xlat / stosb / loop ^
  ;;
  ;; Prove the complete six-byte x86 spelling rather than its internal op
  ;; packaging. That packaging can include a fall-through predecessor when a
  ;; page run first discovers the target; the guest bytes are the stronger and
  ;; stable boundary. E2 FA proves plain 32-bit LOOP back by six bytes rather
  ;; than LOOPE/LOOPNE or an address-size-overridden CX form.
  (func $loop_try_emit_xlat_stosb_tail
    (param $target i32) (param $fall i32) (result i32)
    (local $n i32) (local $p i32)
    (if (global.get $code16) (then (return (i32.const 0))))
    ;; E2 FA encodes this target by definition. Derive it from the consumed
    ;; bytes instead of depending on the decoder's temporary branch-target
    ;; local, which can name the enclosing page-run entry for an interior edge.
    (local.set $target (i32.sub (local.get $fall) (i32.const 6)))
    (if (i32.or
          (i32.ne (call $gl32 (local.get $target)) (i32.const 0xAAD7078A))
          (i32.ne (call $gl16 (i32.add (local.get $target) (i32.const 4)))
            (i32.const 0xFAE2)))
      (then (return (i32.const 0))))
    (global.set $loop_xlat_stosb_candidates
      (i32.add (global.get $loop_xlat_stosb_candidates) (i32.const 1)))
    (if (i32.lt_u (global.get $op_index_n) (i32.const 3))
      (then (return (i32.const 0))))
    (local.set $n (global.get $op_index_n))
    (local.set $p (call $loop_op_at (i32.sub (local.get $n) (i32.const 3))))
    (if (i32.or
          (i32.ne (load.field LoopOp handler (local.get $p)) (i32.const 28))
          (i32.ne (load.field.memarg LoopOp operand (local.get $p)) (i32.const 7)))
      (then (return (i32.const 0))))
    (if (i32.ne (i32.load offset=8 (local.get $p)) (i32.const 0))
      (then (return (i32.const 0))))
    (local.set $p (call $loop_op_at (i32.sub (local.get $n) (i32.const 2))))
    (if (i32.or
          (i32.ne (load.field LoopOp handler (local.get $p)) (i32.const 280))
          (load.field.memarg LoopOp operand (local.get $p)))
      (then (return (i32.const 0))))
    (local.set $p (call $loop_op_at (i32.sub (local.get $n) (i32.const 1))))
    (if (i32.or
          (i32.ne (load.field LoopOp handler (local.get $p)) (i32.const 88))
          (load.field.memarg LoopOp operand (local.get $p)))
      (then (return (i32.const 0))))

    (global.set $loop_xlat_stosb_matches
      (i32.add (global.get $loop_xlat_stosb_matches) (i32.const 1)))
    (global.set $loop_matched_blocks
      (i32.add (global.get $loop_matched_blocks) (i32.const 1)))
    (if (i32.eqz (global.get $loop_lut_emit_enabled))
      (then (return (i32.const 0))))

    ;; Keep any prefix ops in this block and replace only the three already
    ;; emitted body ops plus the LOOP currently being decoded.
    (local.set $p (call $loop_op_at (i32.sub (local.get $n) (i32.const 3))))
    (global.set $thread_alloc (local.get $p))
    (global.set $op_index_n (i32.sub (local.get $n) (i32.const 3)))
    (call $te (global.get $LOOP_SUPEROP_LUT) (i32.const 0x10))
    (call $te_raw (local.get $fall))
    (call $te_raw (local.get $target))
    (call $te_raw (i32.const 4))
    (i32.const 1))

  (func $loop_try_xlat_stosb
    (param $start_eip i32) (param $tstart i32) (result i32)
    (local $fall i32) (local $back i32) (local $preset i32) (local $prefixed i32)
    (if (i32.or (global.get $code16) (call $fold_off (i32.const 0x80)))
      (then (return (i32.const 0))))
    (if (i32.and
          (i32.eq (call $gl32 (local.get $start_eip)) (i32.const 0xAAD7078A))
          (i32.eq (call $gl16 (i32.add (local.get $start_eip) (i32.const 4)))
            (i32.const 0xFAE2)))
      (then
        (local.set $back (local.get $start_eip))
        (local.set $fall (i32.add (local.get $start_eip) (i32.const 6))))
      (else
        ;; Diablo's cache first discovers the inner loop through the row head,
        ;; so the compiled block is `mov ecx,640` plus the six-byte loop and
        ;; later branches directly to its interior. Accept the address-neutral
        ;; MOV-ECX-immediate spelling as one semantic block too.
        (if (i32.or
              (i32.ne (call $gl8 (local.get $start_eip)) (i32.const 0xB9))
              (i32.or
                (i32.ne (call $gl32 (i32.add (local.get $start_eip) (i32.const 5)))
                  (i32.const 0xAAD7078A))
                (i32.ne (call $gl16 (i32.add (local.get $start_eip) (i32.const 9)))
                  (i32.const 0xFAE2))))
          (then (return (i32.const 0))))
        (local.set $preset (call $gl32 (i32.add (local.get $start_eip) (i32.const 1))))
        (local.set $prefixed (i32.const 1))
        (local.set $back (i32.add (local.get $start_eip) (i32.const 5)))
        (local.set $fall (i32.add (local.get $start_eip) (i32.const 11)))))

    (global.set $loop_xlat_stosb_matches
      (i32.add (global.get $loop_xlat_stosb_matches) (i32.const 1)))
    (global.set $loop_matched_blocks
      (i32.add (global.get $loop_matched_blocks) (i32.const 1)))
    (if (global.get $loop_trace)
      (then
        (call $host_log_i32 (i32.const 0x100B0010))
        (call $host_log_i32 (local.get $start_eip))))
    (if (i32.eqz (global.get $loop_lut_emit_enabled))
      (then (return (i32.const 0))))

    (global.set $thread_alloc (local.get $tstart))
    (global.set $op_index_n (i32.const 0))
    ;; H418 bit 4 selects the implicit-register descriptor; bit 5 includes the
    ;; leading MOV ECX,imm32 value as a fourth word.
    (call $te (global.get $LOOP_SUPEROP_LUT)
      (select (i32.const 0x30) (i32.const 0x10) (local.get $prefixed)))
    (call $te_raw (local.get $fall))
    (call $te_raw (local.get $back))
    (call $te_raw (i32.const 4))
    (if (local.get $prefixed) (then (call $te_raw (local.get $preset))))
    (i32.const 1))

  ;; ------------------------------------------------------------------
  ;; Bounded LUT_RUN
  ;; ------------------------------------------------------------------
  ;; Recognizes the role-equivalent forms used by Diablo II's software pixel
  ;; paths. The simple form is dst[i] = table[src[i]]; the row-table form adds
  ;; an optional `(byte << shift) + invariant_reg` index transform. Both end in
  ;; CMP source_cursor,bound / JB back. This is deliberately a separate proof
  ;; from the counted Heroes form above, but both emit the same descriptor and
  ;; execute in handler 418.
  (func $loop_try_lut_bounded (param $start_eip i32) (param $tstart i32) (result i32)
    (local $i i32) (local $n i32) (local $p i32) (local $fn i32) (local $op i32)
    (local $role i32) (local $written i32) (local $fall i32)
    (local $acc_reg i32) (local $zero_cnt i32) (local $zero_idx i32)
    (local $ld_reg i32) (local $ld_base i32) (local $ld_disp i32)
    (local $ld_cnt i32) (local $ld_idx i32)
    (local $st_reg i32) (local $st_base i32) (local $st_disp i32)
    (local $st_cnt i32) (local $st_idx i32)
    (local $lut_cnt i32) (local $lut_idx i32) (local $lut_info i32)
    (local $tbl_reg i32) (local $b i32) (local $x i32)
    (local $shift_cnt i32) (local $shift_idx i32) (local $shift_op i32)
    (local $index_shift i32)
    (local $add_cnt i32) (local $add_idx i32) (local $add_op i32)
    (local $add_reg i32)
    (local $cmp_cnt i32) (local $cmp_idx i32) (local $cmp_left i32) (local $bound_reg i32)
    (local $addi_cnt i32) (local $addi_last_idx i32)
    (local $src_inc_cnt i32) (local $src_inc_idx i32)
    (local $dst_inc_cnt i32) (local $dst_inc_idx i32)

    (local.set $n (global.get $op_index_n))
    ;; zero/load/[shift/add]/increments/cmp/lut/store/jb: eight to ten ops in
    ;; the two observed families. A larger body is computing something else.
    (if (i32.lt_u (local.get $n) (i32.const 8)) (then (return (i32.const 0))))
    (if (i32.gt_u (local.get $n) (i32.const 10)) (then (return (i32.const 0))))
    (local.set $acc_reg (i32.const -1))
    (local.set $tbl_reg (i32.const -1))
    (local.set $add_reg (i32.const -1))

    ;; Pass 1 records exact semantic roles. Unknown or extra work declines the
    ;; whole block; no instruction is silently dropped by the lowering.
    (local.set $i (i32.const 0))
    (block $p1_done
      (loop $p1
        (br_if $p1_done (i32.ge_u (local.get $i) (local.get $n)))
        (local.set $p (call $loop_op_at (local.get $i)))
        (local.set $fn (load.field LoopOp handler (local.get $p)))
        (local.set $op (load.field.memarg LoopOp operand (local.get $p)))
        (local.set $role (call $loop_role (local.get $fn) (local.get $op)))

        (if (i32.eq (local.get $role) (global.get $LR_ZERO))
          (then
            (local.set $zero_cnt (i32.add (local.get $zero_cnt) (i32.const 1)))
            (local.set $zero_idx (local.get $i))
            (local.set $acc_reg (i32.and (local.get $op) (i32.const 0xF)))
            (local.set $written (i32.or (local.get $written)
              (i32.shl (i32.const 1) (local.get $acc_reg))))))
        (if (i32.eq (local.get $role) (global.get $LR_LOAD8))
          (then
            (local.set $ld_cnt (i32.add (local.get $ld_cnt) (i32.const 1)))
            (local.set $ld_idx (local.get $i))
            (local.set $ld_base (i32.and (local.get $op) (i32.const 0xF)))
            (local.set $ld_reg (i32.shr_u (local.get $op) (i32.const 4)))
            (local.set $ld_disp (i32.load offset=8 (local.get $p)))
            (local.set $written (i32.or (local.get $written)
              (i32.shl (i32.const 1) (i32.and (local.get $ld_reg) (i32.const 3)))))))
        (if (i32.eq (local.get $role) (global.get $LR_LOAD8S))
          (then
            (local.set $lut_cnt (i32.add (local.get $lut_cnt) (i32.const 1)))
            (local.set $lut_idx (local.get $i))
            (local.set $lut_info (i32.load offset=8 (local.get $p)))
            (if (i32.ne (i32.load offset=12 (local.get $p)) (i32.const 0))
              (then (return (i32.const 0))))
            (local.set $written (i32.or (local.get $written)
              (i32.shl (i32.const 1) (i32.and (local.get $op) (i32.const 7)))))))
        (if (i32.eq (local.get $role) (global.get $LR_STORE8))
          (then
            (local.set $st_cnt (i32.add (local.get $st_cnt) (i32.const 1)))
            (local.set $st_idx (local.get $i))
            (local.set $st_base (i32.and (local.get $op) (i32.const 0xF)))
            (local.set $st_reg (i32.shr_u (local.get $op) (i32.const 4)))
            (local.set $st_disp (i32.load offset=8 (local.get $p)))))
        (if (i32.eq (local.get $role) (global.get $LR_ADDI))
          (then
            ;; Bounded streams are forward byte walks only.
            (if (i32.ne (local.get $fn) (i32.const 64)) (then (return (i32.const 0))))
            (local.set $addi_cnt (i32.add (local.get $addi_cnt) (i32.const 1)))
            (local.set $addi_last_idx (local.get $i))
            (local.set $written (i32.or (local.get $written)
              (i32.shl (i32.const 1) (i32.and (local.get $op) (i32.const 0xF)))))))
        (if (i32.eq (local.get $role) (global.get $LR_SHIFT))
          (then
            (local.set $shift_cnt (i32.add (local.get $shift_cnt) (i32.const 1)))
            (local.set $shift_idx (local.get $i))
            (local.set $shift_op (local.get $op))
            (local.set $written (i32.or (local.get $written)
              (i32.shl (i32.const 1) (i32.and (local.get $op) (i32.const 0xFF)))))))
        (if (i32.eq (local.get $role) (global.get $LR_ADD))
          (then
            (local.set $add_cnt (i32.add (local.get $add_cnt) (i32.const 1)))
            (local.set $add_idx (local.get $i))
            (local.set $add_op (local.get $op))
            (local.set $written (i32.or (local.get $written)
              (i32.shl (i32.const 1) (i32.shr_u (local.get $op) (i32.const 4)))))))
        (if (i32.eq (local.get $role) (global.get $LR_CMP))
          (then
            (local.set $cmp_cnt (i32.add (local.get $cmp_cnt) (i32.const 1)))
            (local.set $cmp_idx (local.get $i))
            (local.set $cmp_left (i32.shr_u (local.get $op) (i32.const 4)))
            (local.set $bound_reg (i32.and (local.get $op) (i32.const 0xF)))))
        (if (i32.eq (local.get $role) (global.get $LR_JCC))
          (then
            (if (i32.ne (local.get $i) (i32.sub (local.get $n) (i32.const 1)))
              (then (return (i32.const 0))))
            ;; JB/JC/JNAE is handler 309. No signed or equality variant is an
            ;; interchangeable bound check.
            (if (i32.ne (local.get $fn) (i32.const 309))
              (then (return (i32.const 0))))))
        (if (i32.or
              (i32.eq (local.get $role) (global.get $LR_UNKNOWN))
              (i32.or (i32.eq (local.get $role) (global.get $LR_MIRROR))
                      (i32.eq (local.get $role) (global.get $LR_MEMCTR))))
          (then (return (i32.const 0))))

        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $p1)))

    (if (i32.ne (local.get $zero_cnt) (i32.const 1)) (then (return (i32.const 0))))
    (if (i32.ne (local.get $ld_cnt) (i32.const 1)) (then (return (i32.const 0))))
    (if (i32.ne (local.get $lut_cnt) (i32.const 1)) (then (return (i32.const 0))))
    (if (i32.ne (local.get $st_cnt) (i32.const 1)) (then (return (i32.const 0))))
    (if (i32.ne (local.get $cmp_cnt) (i32.const 1)) (then (return (i32.const 0))))
    (if (i32.gt_u (local.get $shift_cnt) (i32.const 1)) (then (return (i32.const 0))))
    (if (i32.gt_u (local.get $add_cnt) (i32.const 1)) (then (return (i32.const 0))))
    (if (i32.gt_u (local.get $acc_reg) (i32.const 3)) (then (return (i32.const 0))))
    (if (i32.ne (local.get $ld_reg) (local.get $acc_reg)) (then (return (i32.const 0))))
    (if (i32.ne (local.get $st_reg) (local.get $acc_reg)) (then (return (i32.const 0))))

    ;; Zero -> source byte -> optional shift/add -> table byte -> destination.
    (if (i32.ge_u (local.get $zero_idx) (local.get $ld_idx)) (then (return (i32.const 0))))
    (if (i32.ge_u (local.get $ld_idx) (local.get $lut_idx)) (then (return (i32.const 0))))
    (if (i32.ge_u (local.get $lut_idx) (local.get $st_idx)) (then (return (i32.const 0))))
    (if (local.get $shift_cnt)
      (then
        (if (i32.or (i32.le_u (local.get $shift_idx) (local.get $ld_idx))
                    (i32.ge_u (local.get $shift_idx) (local.get $lut_idx)))
          (then (return (i32.const 0))))
        (if (i32.ne (i32.and (local.get $shift_op) (i32.const 0xFF)) (local.get $acc_reg))
          (then (return (i32.const 0))))
        (if (i32.eqz (i32.or
              (i32.eq (i32.and (i32.shr_u (local.get $shift_op) (i32.const 8)) (i32.const 0xFF)) (i32.const 4))
              (i32.eq (i32.and (i32.shr_u (local.get $shift_op) (i32.const 8)) (i32.const 0xFF)) (i32.const 6))))
          (then (return (i32.const 0))))
        (local.set $index_shift
          (i32.and (i32.shr_u (local.get $shift_op) (i32.const 16)) (i32.const 0xFF)))
        (if (i32.ne (local.get $index_shift) (i32.const 8))
          (then (return (i32.const 0))))))
    (if (local.get $add_cnt)
      (then
        (if (i32.or (i32.le_u (local.get $add_idx) (local.get $ld_idx))
                    (i32.ge_u (local.get $add_idx) (local.get $lut_idx)))
          (then (return (i32.const 0))))
        (if (i32.ne (i32.shr_u (local.get $add_op) (i32.const 4)) (local.get $acc_reg))
          (then (return (i32.const 0))))
        (local.set $add_reg (i32.and (local.get $add_op) (i32.const 0xF)))
        (if (i32.and (local.get $shift_cnt)
              (i32.le_u (local.get $add_idx) (local.get $shift_idx)))
          (then (return (i32.const 0))))))

    ;; The fused SIB lookup must be exactly [table + accumulator], scale 1,
    ;; displacement zero, and write the same low-byte accumulator.
    (local.set $p (call $loop_op_at (local.get $lut_idx)))
    (if (i32.ne (i32.and (load.field.memarg LoopOp operand (local.get $p)) (i32.const 7))
                (local.get $acc_reg))
      (then (return (i32.const 0))))
    (if (i32.ne (i32.and (i32.shr_u (local.get $lut_info) (i32.const 8)) (i32.const 3))
                (i32.const 0))
      (then (return (i32.const 0))))
    (local.set $b (i32.and (local.get $lut_info) (i32.const 0xF)))
    (local.set $x (i32.and (i32.shr_u (local.get $lut_info) (i32.const 4)) (i32.const 0xF)))
    (if (i32.eq (local.get $b) (local.get $acc_reg))
      (then (local.set $tbl_reg (local.get $x)))
      (else
        (if (i32.ne (local.get $x) (local.get $acc_reg)) (then (return (i32.const 0))))
        (local.set $tbl_reg (local.get $b))))
    (if (i32.or (i32.eq (local.get $tbl_reg) (i32.const 0xF))
                (i32.lt_s (local.get $tbl_reg) (i32.const 0)))
      (then (return (i32.const 0))))

    ;; Sort the one or two INC ops by the memory-base roles.
    (local.set $i (i32.const 0))
    (block $incs_done
      (loop $incs
        (br_if $incs_done (i32.ge_u (local.get $i) (local.get $n)))
        (local.set $p (call $loop_op_at (local.get $i)))
        (if (i32.eq (call $loop_role (load.field LoopOp handler (local.get $p)) (load.field.memarg LoopOp operand (local.get $p)))
                    (global.get $LR_ADDI))
          (then
            (local.set $x (i32.and (load.field.memarg LoopOp operand (local.get $p)) (i32.const 0xF)))
            (if (i32.eq (local.get $x) (local.get $ld_base))
              (then
                (local.set $src_inc_cnt (i32.add (local.get $src_inc_cnt) (i32.const 1)))
                (local.set $src_inc_idx (local.get $i))))
            (if (i32.eq (local.get $x) (local.get $st_base))
              (then
                (local.set $dst_inc_cnt (i32.add (local.get $dst_inc_cnt) (i32.const 1)))
                (local.set $dst_inc_idx (local.get $i))))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $incs)))
    (if (i32.ne (local.get $src_inc_cnt) (i32.const 1)) (then (return (i32.const 0))))
    (if (i32.ne (local.get $dst_inc_cnt) (i32.const 1)) (then (return (i32.const 0))))
    (if (i32.ne (local.get $addi_cnt)
          (select (i32.const 1) (i32.const 2)
            (i32.eq (local.get $ld_base) (local.get $st_base))))
      (then (return (i32.const 0))))

    ;; CMP source,bound must be the final flag writer and JB must be the final
    ;; op. Bound/table/row are invariant; accumulator/cursors/terminator do not
    ;; alias, so publishing them once at exit preserves architectural state.
    (if (i32.ne (local.get $cmp_left) (local.get $ld_base)) (then (return (i32.const 0))))
    (if (i32.or (i32.le_u (local.get $cmp_idx) (local.get $zero_idx))
                (i32.le_u (local.get $cmp_idx) (local.get $addi_last_idx)))
      (then (return (i32.const 0))))
    (if (i32.and (local.get $shift_cnt) (i32.le_u (local.get $cmp_idx) (local.get $shift_idx)))
      (then (return (i32.const 0))))
    (if (i32.and (local.get $add_cnt) (i32.le_u (local.get $cmp_idx) (local.get $add_idx)))
      (then (return (i32.const 0))))
    (if (i32.or (i32.eq (local.get $acc_reg) (local.get $ld_base))
          (i32.or (i32.eq (local.get $acc_reg) (local.get $st_base))
                  (i32.eq (local.get $acc_reg) (local.get $bound_reg))))
      (then (return (i32.const 0))))
    (if (i32.and (local.get $written) (i32.shl (i32.const 1) (local.get $bound_reg)))
      (then (return (i32.const 0))))
    (if (i32.and (local.get $written) (i32.shl (i32.const 1) (local.get $tbl_reg)))
      (then (return (i32.const 0))))
    (if (i32.and (i32.ge_s (local.get $add_reg) (i32.const 0))
          (i32.and (local.get $written) (i32.shl (i32.const 1) (local.get $add_reg))))
      (then (return (i32.const 0))))

    ;; Convert original pre-access increments to the executor's post-access
    ;; cursor convention.
    (if (i32.lt_u (local.get $src_inc_idx) (local.get $ld_idx))
      (then (local.set $ld_disp (i32.add (local.get $ld_disp) (i32.const 1)))))
    (if (i32.lt_u (local.get $dst_inc_idx) (local.get $st_idx))
      (then (local.set $st_disp (i32.add (local.get $st_disp) (i32.const 1)))))

    (global.set $loop_matched_blocks
      (i32.add (global.get $loop_matched_blocks) (i32.const 1)))
    (global.set $loop_lut_bounded_matches
      (i32.add (global.get $loop_lut_bounded_matches) (i32.const 1)))
    (if (global.get $loop_trace)
      (then
        (call $host_log_i32 (i32.const 0x100B0003))
        (call $host_log_i32 (local.get $start_eip))))
    (if (i32.eqz (global.get $loop_lut_emit_enabled)) (then (return (i32.const 0))))

    (local.set $fall (i32.load offset=8
      (call $loop_op_at (i32.sub (local.get $n) (i32.const 1)))))
    (global.set $thread_alloc (local.get $tstart))
    (global.set $op_index_n (i32.const 0))
    (call $te (global.get $LOOP_SUPEROP_LUT) (i32.const 0))
    (call $te_raw (local.get $ld_base))
    (call $te_raw (i32.const 1))
    (call $te_raw (local.get $ld_disp))
    (call $te_raw (local.get $st_base))
    (call $te_raw (i32.const 1))
    (call $te_raw (local.get $st_disp))
    (call $te_raw (local.get $tbl_reg))
    (call $te_raw (local.get $acc_reg))
    (call $te_raw (local.get $index_shift))
    (call $te_raw (local.get $add_reg))
    (call $te_raw (i32.const 1))
    (call $te_raw (local.get $bound_reg))
    (call $te_raw (i32.const 0))
    (call $te_raw (i32.const 0))
    (call $te_raw (i32.const 0))
    (call $te_raw (i32.const 0))
    (call $te_raw (i32.const 0))
    (call $te_raw (i32.const 0))
    (call $te_raw (i32.const 0))
    (call $te_raw (local.get $fall))
    (call $te_raw (local.get $start_eip))
    (call $te_raw (local.get $n))
    (i32.const 1))

  ;; ------------------------------------------------------------------
  ;; Two-moving-source bounded LUT_RUN
  ;; ------------------------------------------------------------------
  ;; d2gfx's remaining blend loop builds a 16-bit index from two advancing
  ;; byte streams and stops on the second cursor:
  ;;
  ;;   xor acc,acc / xor aux,aux
  ;;   mov acc8,[src1] / mov aux8,[src2] / shl acc,8
  ;;   inc dst / inc src2 / mov acc8,[acc+aux+table]
  ;;   inc src1 / mov [dst-1],acc8 / cmp src2,bound / jb ^
  ;;
  ;; Recognition is intentionally separate from the one-source proof above,
  ;; while execution stays in universal H418 through descriptor version 1.
  ;; The role order is exact because every ordering point is architecturally
  ;; meaningful here; registers and displacements remain parameters.
  (func $loop_try_lut_blend_bounded
        (param $start_eip i32) (param $tstart i32) (result i32)
    (local $p i32) (local $op i32) (local $info i32) (local $fall i32)
    (local $acc i32) (local $aux i32)
    (local $src1 i32) (local $src1_disp i32) (local $src1_inc i32)
    (local $src2 i32) (local $src2_disp i32) (local $src2_inc i32)
    (local $dst i32) (local $dst_disp i32) (local $dst_inc i32)
    (local $bound i32) (local $table_disp i32)
    (local $r i32) (local $i i32) (local $mask i32) (local $want i32)

    (if (i32.ne (global.get $op_index_n) (i32.const 12))
      (then (return (i32.const 0))))

    ;; Two zeroing instructions establish exact full-register scratch state.
    (local.set $p (call $loop_op_at (i32.const 0)))
    (if (i32.ne (call $loop_role (load.field LoopOp handler (local.get $p))
                  (load.field.memarg LoopOp operand (local.get $p))) (global.get $LR_ZERO))
      (then (return (i32.const 0))))
    (local.set $acc (i32.and (load.field.memarg LoopOp operand (local.get $p)) (i32.const 0xF)))
    (local.set $p (call $loop_op_at (i32.const 1)))
    (if (i32.ne (call $loop_role (load.field LoopOp handler (local.get $p))
                  (load.field.memarg LoopOp operand (local.get $p))) (global.get $LR_ZERO))
      (then (return (i32.const 0))))
    (local.set $aux (i32.and (load.field.memarg LoopOp operand (local.get $p)) (i32.const 0xF)))
    (if (i32.or (i32.gt_u (local.get $acc) (i32.const 3))
                (i32.or (i32.gt_u (local.get $aux) (i32.const 3))
                        (i32.eq (local.get $acc) (local.get $aux))))
      (then (return (i32.const 0))))

    ;; Primary/high byte source.
    (local.set $p (call $loop_op_at (i32.const 2)))
    (if (i32.ne (call $loop_role (load.field LoopOp handler (local.get $p))
                  (load.field.memarg LoopOp operand (local.get $p))) (global.get $LR_LOAD8))
      (then (return (i32.const 0))))
    (local.set $op (load.field.memarg LoopOp operand (local.get $p)))
    (if (i32.ne (i32.and (i32.shr_u (local.get $op) (i32.const 4))
                         (i32.const 0xF)) (local.get $acc))
      (then (return (i32.const 0))))
    (local.set $src1 (i32.and (local.get $op) (i32.const 0xF)))
    (local.set $src1_disp (i32.load offset=8 (local.get $p)))

    ;; Secondary/low byte source.
    (local.set $p (call $loop_op_at (i32.const 3)))
    (if (i32.ne (call $loop_role (load.field LoopOp handler (local.get $p))
                  (load.field.memarg LoopOp operand (local.get $p))) (global.get $LR_LOAD8))
      (then (return (i32.const 0))))
    (local.set $op (load.field.memarg LoopOp operand (local.get $p)))
    (if (i32.ne (i32.and (i32.shr_u (local.get $op) (i32.const 4))
                         (i32.const 0xF)) (local.get $aux))
      (then (return (i32.const 0))))
    (local.set $src2 (i32.and (local.get $op) (i32.const 0xF)))
    (local.set $src2_disp (i32.load offset=8 (local.get $p)))

    ;; Exact `shl acc,8`.
    (local.set $p (call $loop_op_at (i32.const 4)))
    (if (i32.ne (call $loop_role (load.field LoopOp handler (local.get $p))
                  (load.field.memarg LoopOp operand (local.get $p))) (global.get $LR_SHIFT))
      (then (return (i32.const 0))))
    (local.set $op (load.field.memarg LoopOp operand (local.get $p)))
    (if (i32.ne (i32.and (local.get $op) (i32.const 0xFF)) (local.get $acc))
      (then (return (i32.const 0))))
    (if (i32.eqz (i32.or
          (i32.eq (i32.and (i32.shr_u (local.get $op) (i32.const 8)) (i32.const 0xFF))
                  (i32.const 4))
          (i32.eq (i32.and (i32.shr_u (local.get $op) (i32.const 8)) (i32.const 0xFF))
                  (i32.const 6))))
      (then (return (i32.const 0))))
    (if (i32.ne (i32.and (i32.shr_u (local.get $op) (i32.const 16))
                         (i32.const 0xFF)) (i32.const 8))
      (then (return (i32.const 0))))

    ;; The lookup writes acc8 and addresses exactly [acc+aux+table_disp].
    (local.set $p (call $loop_op_at (i32.const 7)))
    (if (i32.ne (call $loop_role (load.field LoopOp handler (local.get $p))
                  (load.field.memarg LoopOp operand (local.get $p))) (global.get $LR_LOAD8S))
      (then (return (i32.const 0))))
    (local.set $op (load.field.memarg LoopOp operand (local.get $p)))
    (if (i32.ne (i32.and (local.get $op) (i32.const 7)) (local.get $acc))
      (then (return (i32.const 0))))
    (local.set $info (i32.load offset=8 (local.get $p)))
    (if (i32.ne (i32.and (i32.shr_u (local.get $info) (i32.const 8))
                         (i32.const 3)) (i32.const 0))
      (then (return (i32.const 0))))
    (if (i32.eqz (i32.or
          (i32.and
            (i32.eq (i32.and (local.get $info) (i32.const 0xF)) (local.get $acc))
            (i32.eq (i32.and (i32.shr_u (local.get $info) (i32.const 4))
                             (i32.const 0xF)) (local.get $aux)))
          (i32.and
            (i32.eq (i32.and (local.get $info) (i32.const 0xF)) (local.get $aux))
            (i32.eq (i32.and (i32.shr_u (local.get $info) (i32.const 4))
                             (i32.const 0xF)) (local.get $acc)))))
      (then (return (i32.const 0))))
    (local.set $table_disp (i32.load offset=12 (local.get $p)))

    ;; Result store and final unsigned source2 bound check.
    (local.set $p (call $loop_op_at (i32.const 9)))
    (if (i32.ne (call $loop_role (load.field LoopOp handler (local.get $p))
                  (load.field.memarg LoopOp operand (local.get $p))) (global.get $LR_STORE8))
      (then (return (i32.const 0))))
    (local.set $op (load.field.memarg LoopOp operand (local.get $p)))
    (if (i32.ne (i32.and (i32.shr_u (local.get $op) (i32.const 4))
                         (i32.const 0xF)) (local.get $acc))
      (then (return (i32.const 0))))
    (local.set $dst (i32.and (local.get $op) (i32.const 0xF)))
    (local.set $dst_disp (i32.load offset=8 (local.get $p)))
    (local.set $p (call $loop_op_at (i32.const 10)))
    (if (i32.ne (call $loop_role (load.field LoopOp handler (local.get $p))
                  (load.field.memarg LoopOp operand (local.get $p))) (global.get $LR_CMP))
      (then (return (i32.const 0))))
    (local.set $op (load.field.memarg LoopOp operand (local.get $p)))
    (if (i32.ne (i32.and (i32.shr_u (local.get $op) (i32.const 4))
                         (i32.const 0xF)) (local.get $src2))
      (then (return (i32.const 0))))
    (local.set $bound (i32.and (local.get $op) (i32.const 0xF)))
    (local.set $p (call $loop_op_at (i32.const 11)))
    (if (i32.ne (load.field LoopOp handler (local.get $p)) (i32.const 309))
      (then (return (i32.const 0))))

    ;; Positions 5, 6 and 8 must be one INC for each distinct cursor. Record
    ;; where they occur so a pre-access increment can be folded into its disp.
    (if (i32.or (i32.eq (local.get $src1) (local.get $src2))
          (i32.or (i32.eq (local.get $src1) (local.get $dst))
                  (i32.eq (local.get $src2) (local.get $dst))))
      (then (return (i32.const 0))))
    (local.set $i (i32.const 5))
    (block $incs_done (loop $incs
      (local.set $p (call $loop_op_at (local.get $i)))
      (if (i32.ne (load.field LoopOp handler (local.get $p)) (i32.const 64))
        (then (return (i32.const 0))))
      (local.set $r (i32.and (load.field.memarg LoopOp operand (local.get $p)) (i32.const 0xF)))
      (local.set $mask (i32.or (local.get $mask)
        (i32.shl (i32.const 1) (local.get $r))))
      (if (i32.eq (local.get $r) (local.get $src1))
        (then (local.set $src1_inc (local.get $i))))
      (if (i32.eq (local.get $r) (local.get $src2))
        (then (local.set $src2_inc (local.get $i))))
      (if (i32.eq (local.get $r) (local.get $dst))
        (then (local.set $dst_inc (local.get $i))))
      (local.set $i (select (i32.const 8) (i32.add (local.get $i) (i32.const 1))
                           (i32.eq (local.get $i) (i32.const 6))))
      (br_if $incs_done (i32.gt_u (local.get $i) (i32.const 8)))
      (br $incs)))
    (local.set $want (i32.or
      (i32.shl (i32.const 1) (local.get $src1))
      (i32.or (i32.shl (i32.const 1) (local.get $src2))
              (i32.shl (i32.const 1) (local.get $dst)))))
    (if (i32.ne (local.get $mask) (local.get $want))
      (then (return (i32.const 0))))

    ;; Scratch, cursors, bound and destination are independent. The executor
    ;; snapshots them all, but no accepted guest instruction aliases these
    ;; roles either, so final register publication is unambiguous.
    (local.set $mask (i32.or
      (i32.shl (i32.const 1) (local.get $src1))
      (i32.or (i32.shl (i32.const 1) (local.get $src2))
        (i32.or (i32.shl (i32.const 1) (local.get $dst))
                (i32.shl (i32.const 1) (local.get $bound))))))
    (if (i32.or
          (i32.and (local.get $mask) (i32.shl (i32.const 1) (local.get $acc)))
          (i32.and (local.get $mask) (i32.shl (i32.const 1) (local.get $aux))))
      (then (return (i32.const 0))))
    (if (i32.or (i32.eq (local.get $bound) (local.get $src1))
          (i32.or (i32.eq (local.get $bound) (local.get $src2))
                  (i32.eq (local.get $bound) (local.get $dst))))
      (then (return (i32.const 0))))

    (if (i32.lt_u (local.get $src1_inc) (i32.const 2))
      (then (local.set $src1_disp (i32.add (local.get $src1_disp) (i32.const 1)))))
    (if (i32.lt_u (local.get $src2_inc) (i32.const 3))
      (then (local.set $src2_disp (i32.add (local.get $src2_disp) (i32.const 1)))))
    (if (i32.lt_u (local.get $dst_inc) (i32.const 9))
      (then (local.set $dst_disp (i32.add (local.get $dst_disp) (i32.const 1)))))

    (global.set $loop_matched_blocks
      (i32.add (global.get $loop_matched_blocks) (i32.const 1)))
    (global.set $loop_lut_bounded_matches
      (i32.add (global.get $loop_lut_bounded_matches) (i32.const 1)))
    (if (global.get $loop_trace)
      (then
        (call $host_log_i32 (i32.const 0x100B0003))
        (call $host_log_i32 (local.get $start_eip))))
    (if (i32.eqz (global.get $loop_lut_emit_enabled))
      (then (return (i32.const 0))))

    (local.set $fall (i32.load offset=8 (call $loop_op_at (i32.const 11))))
    (global.set $thread_alloc (local.get $tstart))
    (global.set $op_index_n (i32.const 0))
    (call $te (global.get $LOOP_SUPEROP_LUT) (i32.const 1))
    (call $te_raw (local.get $src1))
    (call $te_raw (i32.const 1))
    (call $te_raw (local.get $src1_disp))
    (call $te_raw (local.get $dst))
    (call $te_raw (i32.const 1))
    (call $te_raw (local.get $dst_disp))
    (call $te_raw (i32.const -1))
    (call $te_raw (local.get $acc))
    (call $te_raw (i32.const 8))
    (call $te_raw (i32.const -1))
    (call $te_raw (i32.const 1))
    (call $te_raw (local.get $bound))
    (call $te_raw (i32.const 0))
    (call $te_raw (i32.const 0))
    (call $te_raw (i32.const 0))
    (call $te_raw (i32.const 0))
    (call $te_raw (i32.const 0))
    (call $te_raw (i32.const 0))
    (call $te_raw (i32.const 0))
    (call $te_raw (local.get $fall))
    (call $te_raw (local.get $start_eip))
    (call $te_raw (i32.const 12))
    (call $te_raw (local.get $src2))
    (call $te_raw (i32.const 1))
    (call $te_raw (local.get $src2_disp))
    (call $te_raw (local.get $aux))
    (call $te_raw (local.get $table_disp))
    (call $te_raw (i32.const 1))
    (i32.const 1))

  ;; Emit the common H435 stream descriptor. Keeping this mechanical packing
  ;; in one place lets recognizers focus on proving their guest instruction
  ;; order rather than duplicating a 21-word ABI.
  (func $loop_emit_avg
    (param $mode i32) (param $mask i32) (param $round_mask i32)
    (param $a_base i32) (param $a_index i32) (param $a_scale i32)
    (param $a_disp i32) (param $a_step i32)
    (param $b_base i32) (param $b_index i32) (param $b_scale i32)
    (param $b_disp i32) (param $b_step i32)
    (param $d_base i32) (param $d_index i32) (param $d_scale i32)
    (param $d_disp i32) (param $d_step i32)
    (param $ind i32) (param $ind_step i32) (param $term i32) (param $cost i32)
    (call $te (global.get $LOOP_SUPEROP_AVG) (local.get $mode))
    (call $te_raw (local.get $mask))
    (call $te_raw (local.get $round_mask))
    (call $te_raw (local.get $a_base))
    (call $te_raw (local.get $a_index))
    (call $te_raw (local.get $a_scale))
    (call $te_raw (local.get $a_disp))
    (call $te_raw (local.get $a_step))
    (call $te_raw (local.get $b_base))
    (call $te_raw (local.get $b_index))
    (call $te_raw (local.get $b_scale))
    (call $te_raw (local.get $b_disp))
    (call $te_raw (local.get $b_step))
    (call $te_raw (local.get $d_base))
    (call $te_raw (local.get $d_index))
    (call $te_raw (local.get $d_scale))
    (call $te_raw (local.get $d_disp))
    (call $te_raw (local.get $d_step))
    (call $te_raw (local.get $ind))
    (call $te_raw (local.get $ind_step))
    (call $te_raw (local.get $term))
    (call $te_raw (local.get $cost)))

  ;; The carry-wide form seen twice in Abe, generalized over all register
  ;; roles, SIB layouts, displacements and masks:
  ;;
  ;;   mov A,[baseA+index*scale+dispA]
  ;;   mov B,[baseB+index*scale+dispB]
  ;;   and A,mask / and B,mask / add A,B / rcr A,1
  ;;   mov [baseD+index*scale+dispD],A / dec index / jge ^
  (func $loop_try_avg_wide_indexed
    (param $start_eip i32) (param $tstart i32) (result i32)
    (local $p i32) (local $fn i32) (local $branch_op i32)
    (local $a i32) (local $b i32) (local $ind i32)
    (local $a_info i32) (local $b_info i32) (local $d_info i32)
    (local $a_base i32) (local $b_base i32) (local $d_base i32)
    (local $scale i32) (local $mask i32)
    (local $a_disp i32) (local $b_disp i32) (local $d_disp i32)
    (local $fall i32) (local $back i32) (local $regs i32)

    (if (i32.ne (global.get $op_index_n) (i32.const 9))
      (then (return (i32.const 0))))

    (local.set $p (call $loop_op_at (i32.const 0)))
    (if (i32.ne (load.field LoopOp handler (local.get $p)) (i32.const 389))
      (then (return (i32.const 0))))
    (local.set $a (load.field.memarg LoopOp operand (local.get $p)))
    (local.set $a_info (i32.load offset=8 (local.get $p)))
    (local.set $a_disp (i32.load offset=12 (local.get $p)))

    (local.set $p (call $loop_op_at (i32.const 1)))
    (if (i32.ne (load.field LoopOp handler (local.get $p)) (i32.const 389))
      (then (return (i32.const 0))))
    (local.set $b (load.field.memarg LoopOp operand (local.get $p)))
    (local.set $b_info (i32.load offset=8 (local.get $p)))
    (local.set $b_disp (i32.load offset=12 (local.get $p)))

    ;; Equal immediate masks on the two loaded values.
    (local.set $p (call $loop_op_at (i32.const 2)))
    (if (i32.or (i32.ne (load.field LoopOp handler (local.get $p)) (i32.const 7))
                (i32.ne (load.field.memarg LoopOp operand (local.get $p)) (local.get $a)))
      (then (return (i32.const 0))))
    (local.set $mask (i32.load offset=8 (local.get $p)))
    (local.set $p (call $loop_op_at (i32.const 3)))
    (if (i32.or (i32.ne (load.field LoopOp handler (local.get $p)) (i32.const 7))
          (i32.or (i32.ne (load.field.memarg LoopOp operand (local.get $p)) (local.get $b))
                  (i32.ne (i32.load offset=8 (local.get $p)) (local.get $mask))))
      (then (return (i32.const 0))))

    (local.set $p (call $loop_op_at (i32.const 4)))
    (if (i32.or (i32.ne (load.field LoopOp handler (local.get $p)) (i32.const 12))
                (i32.ne (load.field.memarg LoopOp operand (local.get $p))
                  (i32.or (i32.shl (local.get $a) (i32.const 4)) (local.get $b))))
      (then (return (i32.const 0))))
    (local.set $p (call $loop_op_at (i32.const 5)))
    (if (i32.or (i32.ne (load.field LoopOp handler (local.get $p)) (i32.const 53))
                (i32.ne (load.field.memarg LoopOp operand (local.get $p))
                  (i32.or (local.get $a) (i32.const 0x10300))))
      (then (return (i32.const 0))))

    (local.set $p (call $loop_op_at (i32.const 6)))
    (if (i32.or (i32.ne (load.field LoopOp handler (local.get $p)) (i32.const 420))
                (i32.ne (load.field.memarg LoopOp operand (local.get $p)) (local.get $a)))
      (then (return (i32.const 0))))
    (local.set $d_info (i32.load offset=8 (local.get $p)))
    (local.set $d_disp (i32.load offset=12 (local.get $p)))

    (local.set $p (call $loop_op_at (i32.const 7)))
    (if (i32.ne (load.field LoopOp handler (local.get $p)) (i32.const 65))
      (then (return (i32.const 0))))
    (local.set $ind (load.field.memarg LoopOp operand (local.get $p)))
    (local.set $p (call $loop_op_at (i32.const 8)))
    (if (i32.ne (load.field LoopOp handler (local.get $p)) (i32.const 320))
      (then (return (i32.const 0))))
    (local.set $branch_op (load.field.memarg LoopOp operand (local.get $p)))
    (local.set $fall (i32.load offset=8 (local.get $p)))
    (local.set $back (i32.load offset=12 (local.get $p)))

    (local.set $a_base (i32.and (local.get $a_info) (i32.const 0xF)))
    (local.set $b_base (i32.and (local.get $b_info) (i32.const 0xF)))
    (local.set $d_base (i32.and (local.get $d_info) (i32.const 0xF)))
    (local.set $scale (i32.and (i32.shr_u (local.get $a_info) (i32.const 8)) (i32.const 3)))
    ;; All streams use the induction register with one scale. Reject absent or
    ;; non-register bases and every alias that would make a load overwrite an
    ;; address component used later in the same original iteration.
    (if (i32.or
          (i32.or (i32.ge_u (local.get $a_base) (i32.const 8))
                  (i32.ge_u (local.get $b_base) (i32.const 8)))
          (i32.ge_u (local.get $d_base) (i32.const 8)))
      (then (return (i32.const 0))))
    (if (i32.or
          (i32.ne (i32.and (i32.shr_u (local.get $a_info) (i32.const 4)) (i32.const 0xF))
                  (local.get $ind))
          (i32.or
            (i32.ne (i32.and (i32.shr_u (local.get $b_info) (i32.const 4)) (i32.const 0xF))
                    (local.get $ind))
            (i32.ne (i32.and (i32.shr_u (local.get $d_info) (i32.const 4)) (i32.const 0xF))
                    (local.get $ind))))
      (then (return (i32.const 0))))
    (if (i32.or
          (i32.ne (i32.and (i32.shr_u (local.get $b_info) (i32.const 8)) (i32.const 3))
                  (local.get $scale))
          (i32.ne (i32.and (i32.shr_u (local.get $d_info) (i32.const 8)) (i32.const 3))
                  (local.get $scale)))
      (then (return (i32.const 0))))
    (local.set $regs
      (i32.or (i32.shl (i32.const 1) (local.get $a))
        (i32.or (i32.shl (i32.const 1) (local.get $b))
          (i32.or (i32.shl (i32.const 1) (local.get $ind))
            (i32.or (i32.shl (i32.const 1) (local.get $a_base))
              (i32.or (i32.shl (i32.const 1) (local.get $b_base))
                      (i32.shl (i32.const 1) (local.get $d_base))))))))
    (if (i32.ne (i32.popcnt (local.get $regs)) (i32.const 6))
      (then (return (i32.const 0))))

    (global.set $loop_matched_blocks
      (i32.add (global.get $loop_matched_blocks) (i32.const 1)))
    (global.set $loop_avg_matches
      (i32.add (global.get $loop_avg_matches) (i32.const 1)))
    (if (global.get $loop_trace)
      (then
        (call $host_log_i32 (i32.const 0x100B0004))
        (call $host_log_i32 (local.get $start_eip))))
    (if (i32.eqz (call $loop_generic_copy_emit_get))
      (then (return (i32.const 0))))

    (global.set $thread_alloc (local.get $tstart))
    (global.set $op_index_n (i32.const 0))
    (call $loop_emit_avg
      (i32.const 0) (local.get $mask) (i32.const 0)
      (local.get $a_base) (local.get $ind) (local.get $scale) (local.get $a_disp) (i32.const 0)
      (local.get $b_base) (local.get $ind) (local.get $scale) (local.get $b_disp) (i32.const 0)
      (local.get $d_base) (local.get $ind) (local.get $scale) (local.get $d_disp) (i32.const 0)
      (local.get $ind) (i32.const -1) (i32.const 1) (i32.const 9))

    ;; Ordinary complete final iteration.
    (call $te (i32.const 389) (local.get $a))
    (call $te_raw (local.get $a_info)) (call $te_raw (local.get $a_disp))
    (call $te (i32.const 389) (local.get $b))
    (call $te_raw (local.get $b_info)) (call $te_raw (local.get $b_disp))
    (call $te (i32.const 7) (local.get $a)) (call $te_raw (local.get $mask))
    (call $te (i32.const 7) (local.get $b)) (call $te_raw (local.get $mask))
    (call $te (i32.const 12) (i32.or (i32.shl (local.get $a) (i32.const 4)) (local.get $b)))
    (call $te (i32.const 53) (i32.or (local.get $a) (i32.const 0x10300)))
    (call $te (i32.const 420) (local.get $a))
    (call $te_raw (local.get $d_info)) (call $te_raw (local.get $d_disp))
    (call $te (i32.const 65) (local.get $ind))
    (call $te (i32.const 320) (local.get $branch_op))
    (call $te_raw (local.get $fall)) (call $te_raw (local.get $back))
    (i32.const 1))

  ;; Advancing-cursor floor average used by Winamp AVS and VirtualDub-shaped
  ;; renderers: shift both lanes, apply one common mask, then add.
  (func $loop_try_avg_shift_cursor
    (param $start_eip i32) (param $tstart i32) (result i32)
    (call $loop_try_avg_cursor (local.get $tstart) (i32.const 0)))

  (func $loop_try_avg_round_cursor
    (param $start_eip i32) (param $tstart i32) (result i32)
    (call $loop_try_avg_cursor (local.get $tstart) (i32.const 1)))

  ;; Both cursor averages share loads, shift/mask/add, stores and DEC/JNZ.
  ;; Rounded form additionally retains (A & B & round_mask) before shifting
  ;; and adds it afterward. These branches run at decode time, not per pixel.
  (func $loop_try_avg_cursor
    (param $tstart i32) (param $rounded i32) (result i32)
    (local $p i32) (local $fn i32) (local $branch_op i32)
    (local $a i32) (local $b i32) (local $round i32) (local $ind i32)
    (local $a_base i32) (local $b_base i32) (local $d_base i32)
    (local $a_disp i32) (local $b_disp i32) (local $d_disp i32)
    (local $mask i32) (local $round_mask i32)
    (local $fall i32) (local $back i32) (local $regs i32)
    (local $shift_start i32) (local $store_index i32) (local $ops i32)

    (local.set $ops (select (i32.const 17) (i32.const 13) (local.get $rounded)))
    (if (i32.ne (global.get $op_index_n) (local.get $ops))
      (then (return (i32.const 0))))
    (local.set $p (call $loop_op_at (i32.const 0)))
    (local.set $fn (load.field LoopOp handler (local.get $p)))
    (local.set $a_base (call $lm_load32_base (local.get $fn) (load.field.memarg LoopOp operand (local.get $p))))
    (if (i32.eq (local.get $a_base) (i32.const -1)) (then (return (i32.const 0))))
    (local.set $a (call $lm_load32_data (local.get $fn) (load.field.memarg LoopOp operand (local.get $p))))
    (local.set $a_disp (call $lm_load32_disp (local.get $fn) (load.field.memarg LoopOp operand (local.get $p)) (local.get $p)))
    (local.set $p (call $loop_op_at (i32.const 1)))
    (local.set $fn (load.field LoopOp handler (local.get $p)))
    (local.set $b_base (call $lm_load32_base (local.get $fn) (load.field.memarg LoopOp operand (local.get $p))))
    (if (i32.eq (local.get $b_base) (i32.const -1)) (then (return (i32.const 0))))
    (local.set $b (call $lm_load32_data (local.get $fn) (load.field.memarg LoopOp operand (local.get $p))))
    (local.set $b_disp (call $lm_load32_disp (local.get $fn) (load.field.memarg LoopOp operand (local.get $p)) (local.get $p)))

    (if (local.get $rounded)
      (then
        (local.set $p (call $loop_op_at (i32.const 2)))
        (if (i32.ne (load.field LoopOp handler (local.get $p)) (i32.const 11))
          (then (return (i32.const 0))))
        (local.set $round (i32.shr_u (load.field.memarg LoopOp operand (local.get $p)) (i32.const 4)))
        (if (i32.ne (load.field.memarg LoopOp operand (local.get $p))
              (i32.or (i32.shl (local.get $round) (i32.const 4)) (local.get $a)))
          (then (return (i32.const 0))))
        (local.set $p (call $loop_op_at (i32.const 3)))
        (if (i32.or (i32.ne (load.field LoopOp handler (local.get $p)) (i32.const 16))
                    (i32.ne (load.field.memarg LoopOp operand (local.get $p))
                      (i32.or (i32.shl (local.get $round) (i32.const 4)) (local.get $b))))
          (then (return (i32.const 0))))
        (local.set $p (call $loop_op_at (i32.const 4)))
        (if (i32.or (i32.ne (load.field LoopOp handler (local.get $p)) (i32.const 7))
                    (i32.ne (load.field.memarg LoopOp operand (local.get $p)) (local.get $round)))
          (then (return (i32.const 0))))
        (local.set $round_mask (i32.load offset=8 (local.get $p)))))

    (local.set $shift_start (select (i32.const 5) (i32.const 2) (local.get $rounded)))
    (local.set $p (call $loop_op_at (local.get $shift_start)))
    (if (i32.or (i32.ne (load.field LoopOp handler (local.get $p)) (i32.const 53))
                (i32.ne (load.field.memarg LoopOp operand (local.get $p))
                  (i32.or (local.get $a) (i32.const 0x10500))))
      (then (return (i32.const 0))))
    (local.set $p (call $loop_op_at (i32.add (local.get $shift_start) (i32.const 1))))
    (if (i32.or (i32.ne (load.field LoopOp handler (local.get $p)) (i32.const 53))
                (i32.ne (load.field.memarg LoopOp operand (local.get $p))
                  (i32.or (local.get $b) (i32.const 0x10500))))
      (then (return (i32.const 0))))
    (local.set $p (call $loop_op_at (i32.add (local.get $shift_start) (i32.const 2))))
    (if (i32.or (i32.ne (load.field LoopOp handler (local.get $p)) (i32.const 7))
                (i32.ne (load.field.memarg LoopOp operand (local.get $p)) (local.get $a)))
      (then (return (i32.const 0))))
    (local.set $mask (i32.load offset=8 (local.get $p)))
    (local.set $p (call $loop_op_at (i32.add (local.get $shift_start) (i32.const 3))))
    (if (i32.or (i32.ne (load.field LoopOp handler (local.get $p)) (i32.const 7))
          (i32.or (i32.ne (load.field.memarg LoopOp operand (local.get $p)) (local.get $b))
                  (i32.ne (i32.load offset=8 (local.get $p)) (local.get $mask))))
      (then (return (i32.const 0))))
    (local.set $p (call $loop_op_at (i32.add (local.get $shift_start) (i32.const 4))))
    (if (i32.or (i32.ne (load.field LoopOp handler (local.get $p)) (i32.const 12))
                (i32.ne (load.field.memarg LoopOp operand (local.get $p))
                  (i32.or (i32.shl (local.get $a) (i32.const 4)) (local.get $b))))
      (then (return (i32.const 0))))
    (if (local.get $rounded)
      (then
        (local.set $p (call $loop_op_at (i32.const 10)))
        (if (i32.or (i32.ne (load.field LoopOp handler (local.get $p)) (i32.const 12))
                    (i32.ne (load.field.memarg LoopOp operand (local.get $p))
                      (i32.or (i32.shl (local.get $a) (i32.const 4)) (local.get $round))))
          (then (return (i32.const 0))))))

    (local.set $store_index (select (i32.const 11) (i32.const 7) (local.get $rounded)))
    (local.set $p (call $loop_op_at (local.get $store_index)))
    (local.set $fn (load.field LoopOp handler (local.get $p)))
    (local.set $d_base (call $lm_store32_base (local.get $fn) (load.field.memarg LoopOp operand (local.get $p))))
    (if (i32.or (i32.eq (local.get $d_base) (i32.const -1))
                (i32.ne (call $lm_store32_data (local.get $fn) (load.field.memarg LoopOp operand (local.get $p))) (local.get $a)))
      (then (return (i32.const 0))))
    (local.set $d_disp (call $lm_store32_disp (local.get $fn) (load.field.memarg LoopOp operand (local.get $p)) (local.get $p)))

    (local.set $p (call $loop_op_at (i32.add (local.get $store_index) (i32.const 1))))
    (if (i32.or (i32.ne (load.field LoopOp handler (local.get $p)) (i32.const 3))
          (i32.or (i32.ne (load.field.memarg LoopOp operand (local.get $p)) (local.get $a_base))
                  (i32.ne (i32.load offset=8 (local.get $p)) (i32.const 4))))
      (then (return (i32.const 0))))
    (local.set $p (call $loop_op_at (i32.add (local.get $store_index) (i32.const 2))))
    (if (i32.or (i32.ne (load.field LoopOp handler (local.get $p)) (i32.const 3))
          (i32.or (i32.ne (load.field.memarg LoopOp operand (local.get $p)) (local.get $b_base))
                  (i32.ne (i32.load offset=8 (local.get $p)) (i32.const 4))))
      (then (return (i32.const 0))))
    (local.set $p (call $loop_op_at (i32.add (local.get $store_index) (i32.const 3))))
    (if (i32.or (i32.ne (load.field LoopOp handler (local.get $p)) (i32.const 3))
          (i32.or (i32.ne (load.field.memarg LoopOp operand (local.get $p)) (local.get $d_base))
                  (i32.ne (i32.load offset=8 (local.get $p)) (i32.const 4))))
      (then (return (i32.const 0))))
    (local.set $p (call $loop_op_at (i32.add (local.get $store_index) (i32.const 4))))
    (if (i32.ne (load.field LoopOp handler (local.get $p)) (i32.const 65))
      (then (return (i32.const 0))))
    (local.set $ind (load.field.memarg LoopOp operand (local.get $p)))
    (local.set $p (call $loop_op_at (i32.add (local.get $store_index) (i32.const 5))))
    (if (i32.ne (load.field LoopOp handler (local.get $p)) (i32.const 312))
      (then (return (i32.const 0))))
    (local.set $branch_op (load.field.memarg LoopOp operand (local.get $p)))
    (local.set $fall (i32.load offset=8 (local.get $p)))
    (local.set $back (i32.load offset=12 (local.get $p)))

    ;; Six roles, or seven with rounding, must be distinct so no load/update changes
    ;; an address component or the private countdown used later in the body.
    (local.set $regs
      (i32.or (i32.shl (i32.const 1) (local.get $a))
        (i32.or (i32.shl (i32.const 1) (local.get $b))
          (i32.or (select (i32.shl (i32.const 1) (local.get $round)) (i32.const 0) (local.get $rounded))
            (i32.or (i32.shl (i32.const 1) (local.get $ind))
              (i32.or (i32.shl (i32.const 1) (local.get $a_base))
                (i32.or (i32.shl (i32.const 1) (local.get $b_base))
                        (i32.shl (i32.const 1) (local.get $d_base)))))))))
    (if (i32.ne (i32.popcnt (local.get $regs))
          (select (i32.const 7) (i32.const 6) (local.get $rounded)))
      (then (return (i32.const 0))))

    (global.set $loop_matched_blocks
      (i32.add (global.get $loop_matched_blocks) (i32.const 1)))
    (global.set $loop_avg_matches
      (i32.add (global.get $loop_avg_matches) (i32.const 1)))
    (if (i32.eqz (call $loop_generic_copy_emit_get))
      (then (return (i32.const 0))))
    (global.set $thread_alloc (local.get $tstart))
    (global.set $op_index_n (i32.const 0))
    (call $loop_emit_avg
      (select (i32.const 2) (i32.const 1) (local.get $rounded))
      (local.get $mask) (local.get $round_mask)
      (local.get $a_base) (i32.const -1) (i32.const 0) (local.get $a_disp) (i32.const 4)
      (local.get $b_base) (i32.const -1) (i32.const 0) (local.get $b_disp) (i32.const 4)
      (local.get $d_base) (i32.const -1) (i32.const 0) (local.get $d_disp) (i32.const 4)
      (local.get $ind) (i32.const -1) (i32.const 0) (local.get $ops))

    ;; Retain the complete final iteration as ordinary threaded handlers.
    (call $te (i32.const 26) (i32.or (i32.shl (local.get $a) (i32.const 4)) (local.get $a_base)))
    (call $te_raw (local.get $a_disp))
    (call $te (i32.const 26) (i32.or (i32.shl (local.get $b) (i32.const 4)) (local.get $b_base)))
    (call $te_raw (local.get $b_disp))
    (if (local.get $rounded)
      (then
        (call $te (i32.const 11)
          (i32.or (i32.shl (local.get $round) (i32.const 4)) (local.get $a)))
        (call $te (i32.const 16)
          (i32.or (i32.shl (local.get $round) (i32.const 4)) (local.get $b)))
        (call $te (i32.const 7) (local.get $round)) (call $te_raw (local.get $round_mask))))

    (call $te (i32.const 53) (i32.or (local.get $a) (i32.const 0x10500)))
    (call $te (i32.const 53) (i32.or (local.get $b) (i32.const 0x10500)))
    (call $te (i32.const 7) (local.get $a)) (call $te_raw (local.get $mask))
    (call $te (i32.const 7) (local.get $b)) (call $te_raw (local.get $mask))
    (call $te (i32.const 12)
      (i32.or (i32.shl (local.get $a) (i32.const 4)) (local.get $b)))
    (if (local.get $rounded)
      (then
        (call $te (i32.const 12)
          (i32.or (i32.shl (local.get $a) (i32.const 4)) (local.get $round)))))
    (call $te (i32.const 27) (i32.or (i32.shl (local.get $a) (i32.const 4)) (local.get $d_base)))
    (call $te_raw (local.get $d_disp))
    (call $te (i32.const 3) (local.get $a_base)) (call $te_raw (i32.const 4))
    (call $te (i32.const 3) (local.get $b_base)) (call $te_raw (i32.const 4))
    (call $te (i32.const 3) (local.get $d_base)) (call $te_raw (i32.const 4))
    (call $te (i32.const 65) (local.get $ind))
    (call $te (i32.const 312) (local.get $branch_op))
    (call $te_raw (local.get $fall)) (call $te_raw (local.get $back))
    (i32.const 1))

  ;; ------------------------------------------------------------------
  ;; Bounded dword COPY_RUN
  ;; ------------------------------------------------------------------
  ;; Abe's dominant row copier at 0x00496c31 is the six-op self-loop:
  ;;
  ;;   mov scratch,[src] / add src,4 / mov [dst],scratch / add dst,4
  ;;   cmp dst,bound / jb ^
  ;;
  ;; The bytes moved are the same as a forward byte stream whenever the source
  ;; and destination spans do not overlap. Reuse scalar H419 mode 0 with a
  ;; private, bound-derived byte count (ctr_kind=2), src/dst byte strides, and
  ;; a four-byte rounding quantum. H419 retains complete-dword budget
  ;; boundaries and takes an ordinary dword fallback for overlap. The final
  ;; scratch load and original CMP/JB remain ordinary threaded ops, so their
  ;; architectural register and flag results need no reimplementation here.
  ;;
  ;; This recognizer is exact in role order but register/displacement generic.
  ;; All four registers must differ: otherwise one of the cursor bumps or the
  ;; load would change a later address/bound in the same original iteration.
  (func $loop_try_copy32_bounded
    (param $start_eip i32) (param $tstart i32) (result i32)
    (local $p i32) (local $fn i32) (local $op i32)
    (local $src i32) (local $dst i32) (local $scratch i32) (local $bound i32)
    (local $src_disp i32) (local $dst_disp i32)
    (local $fall i32) (local $back i32) (local $mask i32)

    (if (i32.ne (global.get $op_index_n) (i32.const 6))
      (then (return (i32.const 0))))

    ;; mov scratch,[src+disp]
    (local.set $p (call $loop_op_at (i32.const 0)))
    (local.set $fn (load.field LoopOp handler (local.get $p)))
    (local.set $src (call $lm_load32_base (local.get $fn) (load.field.memarg LoopOp operand (local.get $p))))
    (if (i32.eq (local.get $src) (i32.const -1)) (then (return (i32.const 0))))
    (local.set $scratch (call $lm_load32_data (local.get $fn) (load.field.memarg LoopOp operand (local.get $p))))
    (local.set $src_disp (call $lm_load32_disp (local.get $fn) (load.field.memarg LoopOp operand (local.get $p)) (local.get $p)))

    ;; add src,4
    (local.set $p (call $loop_op_at (i32.const 1)))
    (if (i32.or
          (i32.ne (load.field LoopOp handler (local.get $p)) (i32.const 3))
          (i32.or
            (i32.ne (load.field.memarg LoopOp operand (local.get $p)) (local.get $src))
            (i32.ne (i32.load offset=8 (local.get $p)) (i32.const 4))))
      (then (return (i32.const 0))))

    ;; mov [dst+disp],scratch
    (local.set $p (call $loop_op_at (i32.const 2)))
    (local.set $fn (load.field LoopOp handler (local.get $p)))
    (local.set $dst (call $lm_store32_base (local.get $fn) (load.field.memarg LoopOp operand (local.get $p))))
    (if (i32.eq (local.get $dst) (i32.const -1)) (then (return (i32.const 0))))
    (if (i32.ne (call $lm_store32_data (local.get $fn) (load.field.memarg LoopOp operand (local.get $p))) (local.get $scratch))
      (then (return (i32.const 0))))
    (local.set $dst_disp (call $lm_store32_disp (local.get $fn) (load.field.memarg LoopOp operand (local.get $p)) (local.get $p)))

    ;; add dst,4
    (local.set $p (call $loop_op_at (i32.const 3)))
    (if (i32.or
          (i32.ne (load.field LoopOp handler (local.get $p)) (i32.const 3))
          (i32.or
            (i32.ne (load.field.memarg LoopOp operand (local.get $p)) (local.get $dst))
            (i32.ne (i32.load offset=8 (local.get $p)) (i32.const 4))))
      (then (return (i32.const 0))))

    ;; cmp dst,bound / jb back
    (local.set $p (call $loop_op_at (i32.const 4)))
    (if (i32.ne (load.field LoopOp handler (local.get $p)) (i32.const 19))
      (then (return (i32.const 0))))
    (local.set $op (load.field.memarg LoopOp operand (local.get $p)))
    (if (i32.ne (i32.shr_u (local.get $op) (i32.const 4)) (local.get $dst))
      (then (return (i32.const 0))))
    (local.set $bound (i32.and (local.get $op) (i32.const 0xF)))
    (local.set $p (call $loop_op_at (i32.const 5)))
    (if (i32.ne (load.field LoopOp handler (local.get $p)) (i32.const 309))
      (then (return (i32.const 0))))
    (local.set $fall (i32.load offset=8 (local.get $p)))
    (local.set $back (i32.load offset=12 (local.get $p)))

    (local.set $mask
      (i32.or (i32.shl (i32.const 1) (local.get $src))
        (i32.or (i32.shl (i32.const 1) (local.get $dst))
          (i32.or (i32.shl (i32.const 1) (local.get $scratch))
                  (i32.shl (i32.const 1) (local.get $bound))))))
    ;; Four distinct registers set exactly four bits.
    (if (i32.ne (i32.popcnt (local.get $mask)) (i32.const 4))
      (then (return (i32.const 0))))

    (global.set $loop_matched_blocks
      (i32.add (global.get $loop_matched_blocks) (i32.const 1)))
    (global.set $loop_copy32_matches
      (i32.add (global.get $loop_copy32_matches) (i32.const 1)))
    (if (global.get $loop_trace)
      (then
        (call $host_log_i32 (i32.const 0x100B0003))
        (call $host_log_i32 (local.get $start_eip))))
    (if (i32.eqz (call $loop_generic_copy_emit_get))
      (then (return (i32.const 0))))

    (global.set $thread_alloc (local.get $tstart))
    (global.set $op_index_n (i32.const 0))
    (call $te (global.get $LOOP_SUPEROP_COPY) (i32.const 0))
    (call $te_raw (local.get $src))
    (call $te_raw (i32.const 1))
    (call $te_raw (local.get $src_disp))
    (call $te_raw (local.get $dst))
    (call $te_raw (i32.const 1))
    (call $te_raw (local.get $dst_disp))
    (call $te_raw (i32.const -1))            ;; no byte scratch publication
    (call $te_raw (i32.const 2))             ;; private bound-derived counter
    (call $te_raw (local.get $bound))
    (call $te_raw (i32.const 4))             ;; byte-count rounding quantum
    (call $te_raw (i32.const -1))
    (call $te_raw (local.get $fall))
    (call $te_raw (local.get $back))
    (call $te_raw (i32.const 6))             ;; original ops per dword

    ;; Reconstruct the final full-width scratch value from the last destination
    ;; dword, then retain the exact terminator. Reading the destination (rather
    ;; than the possibly overwritten source) also preserves overlap semantics.
    (call $te (i32.const 26) (i32.or (i32.shl (local.get $scratch) (i32.const 4)) (local.get $dst)))
    (call $te_raw (i32.sub (local.get $dst_disp) (i32.const 4)))
    (call $te (i32.const 19)
      (i32.or (i32.shl (local.get $dst) (i32.const 4)) (local.get $bound)))
    (call $te (i32.const 309) (load.field.memarg LoopOp operand (local.get $p)))
    (call $te_raw (local.get $fall))
    (call $te_raw (local.get $back))
    (i32.const 1))

  ;; ------------------------------------------------------------------
  ;; COPY_RUN
  ;; ------------------------------------------------------------------
  ;;   dst[i] = src[i] for a counted run -- the byte-at-a-time memcpy every
  ;;   unpacker open-codes. Total Annihilation's is at 0x497948:
  ;;
  ;;     mov cl,[edx] / inc edx / mov [eax],cl / inc eax / dec [esp+d] / jnz ^
  ;;
  ;;   That single block is 8.7% of all block entries and 6.8% of all handler
  ;;   dispatches in a 3000-batch run, and today it is declined twice over: it
  ;;   is one op short of LUT_RUN's seven-op floor, and its trip counter lives
  ;;   on the stack rather than in a register. Both are accidents of LUT_RUN's
  ;;   shape, not of the idiom.
  ;;
  ;; Two cursors, two strides, two displacements, one byte register passing
  ;; through unchanged, and a counter in either a register or memory. The
  ;; source and destination bases must differ -- a copy through one cursor is
  ;; a different loop, and would alias.
  ;;
  ;; Parameter block:
  ;;   0 src_reg  1 src_stride  2 src_disp
  ;;   3 dst_reg  4 dst_stride  5 dst_disp
  ;;   6 byte_reg 7 ctr_kind (0 reg, 1 mem, 2 cursor bound)
  ;;   8 ctr_loc  9 ctr_disp
  ;;  10 ctr_step 11 fall_eip  12 back_eip  13 steps_per_iter
  ;;
  ;; Every form executes against a private local remaining count. Kinds 0/1
  ;; mirror that count into the architectural counter the guest loop updates.
  ;; Kind 2 instead derives byte count by rounding (bound-dst) up to a quantum,
  ;; where ctr_loc is the bound register and ctr_disp is that byte quantum; it has
  ;; no architectural counter to publish and continues into suffix ops.
  (global $LOOP_SUPEROP_COPY i32 (i32.const 419))

  (func $loop_try_copy (param $start_eip i32) (param $tstart i32) (result i32)
    (local $i i32) (local $n i32) (local $p i32) (local $fn i32) (local $op i32)
    (local $role i32) (local $reg i32) (local $step i32)
    (local $ld_base i32) (local $ld_reg i32) (local $ld_disp i32) (local $ld_idx i32) (local $ld_cnt i32)
    (local $st_base i32) (local $st_reg i32) (local $st_disp i32) (local $st_idx i32) (local $st_cnt i32)
    (local $mem_base i32) (local $mem_disp i32) (local $mem_step i32) (local $mem_idx i32) (local $mem_cnt i32)
    (local $addi_cnt i32) (local $written i32)
    (local $src_stride i32) (local $src_idx i32) (local $src_cnt i32)
    (local $dst_stride i32) (local $dst_idx i32) (local $dst_cnt i32)
    (local $ctr_kind i32) (local $ctr_loc i32) (local $ctr_disp i32)
    (local $ctr_step i32) (local $ctr_idx i32) (local $ctr_cnt i32)
    (local $fall i32)

    (local.set $n (global.get $op_index_n))
    ;; load / bump / store / bump / count / branch is the floor; anything
    ;; longer than a dozen ops is doing more than copying.
    (if (i32.lt_u (local.get $n) (i32.const 5)) (then (return (i32.const 0))))
    (if (i32.gt_u (local.get $n) (i32.const 12)) (then (return (i32.const 0))))

    ;; ---- pass 1: roles ----
    ;; Only the five roles this idiom is made of are tolerated. A ZERO, a
    ;; MIRROR or an indexed load means the body is computing something, and
    ;; whatever it is, it is not this.
    (local.set $i (i32.const 0))
    (block $p1_done
      (loop $p1
        (br_if $p1_done (i32.ge_u (local.get $i) (local.get $n)))
        (local.set $p (call $loop_op_at (local.get $i)))
        (local.set $fn (load.field LoopOp handler (local.get $p)))
        (local.set $op (load.field.memarg LoopOp operand (local.get $p)))
        (local.set $role (call $loop_role (local.get $fn) (local.get $op)))

        (if (i32.eq (local.get $role) (global.get $LR_LOAD8))
          (then
            (local.set $ld_cnt (i32.add (local.get $ld_cnt) (i32.const 1)))
            (local.set $ld_base (i32.and (local.get $op) (i32.const 0xF)))
            (local.set $ld_reg (i32.shr_u (local.get $op) (i32.const 4)))
            (local.set $ld_disp (i32.load offset=8 (local.get $p)))
            (local.set $ld_idx (local.get $i))
            (local.set $written (i32.or (local.get $written)
              (i32.shl (i32.const 1) (i32.and (local.get $ld_reg) (i32.const 3))))))
          (else (if (i32.eq (local.get $role) (global.get $LR_STORE8))
            (then
              (local.set $st_cnt (i32.add (local.get $st_cnt) (i32.const 1)))
              (local.set $st_base (i32.and (local.get $op) (i32.const 0xF)))
              (local.set $st_reg (i32.shr_u (local.get $op) (i32.const 4)))
              (local.set $st_disp (i32.load offset=8 (local.get $p)))
              (local.set $st_idx (local.get $i)))
          (else (if (i32.eq (local.get $role) (global.get $LR_ADDI))
            (then
              (local.set $addi_cnt (i32.add (local.get $addi_cnt) (i32.const 1)))
              (local.set $written (i32.or (local.get $written)
                (i32.shl (i32.const 1) (i32.and (local.get $op) (i32.const 0xF))))))
          (else (if (i32.eq (local.get $role) (global.get $LR_MEMCTR))
            (then
              (local.set $mem_cnt (i32.add (local.get $mem_cnt) (i32.const 1)))
              (local.set $mem_base (i32.and (local.get $op) (i32.const 0xF)))
              (local.set $mem_disp (i32.load offset=8 (local.get $p)))
              (local.set $mem_step (select (i32.const 1) (i32.const -1)
                (i32.eqz (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))))
              (local.set $mem_idx (local.get $i)))
          (else (if (i32.eq (local.get $role) (global.get $LR_JCC))
            (then
              (if (i32.ne (local.get $i) (i32.sub (local.get $n) (i32.const 1)))
                (then (return (i32.const 0)))))
            (else (return (i32.const 0))))))))))))

        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $p1)))

    ;; ---- pass 2: the predicate ----
    (if (i32.ne (local.get $ld_cnt) (i32.const 1)) (then (return (i32.const 0))))
    (if (i32.ne (local.get $st_cnt) (i32.const 1)) (then (return (i32.const 0))))
    ;; The byte read is the byte written, untouched in between.
    (if (i32.ne (local.get $ld_reg) (local.get $st_reg)) (then (return (i32.const 0))))
    (if (i32.ge_u (local.get $ld_idx) (local.get $st_idx)) (then (return (i32.const 0))))
    ;; One cursor for the source, a different one for the destination.
    (if (i32.eq (local.get $ld_base) (local.get $st_base)) (then (return (i32.const 0))))
    ;; The byte register's parent must not be a cursor, or the load moves the
    ;; pointer it just read through.
    (if (i32.eq (i32.and (local.get $ld_reg) (i32.const 3)) (local.get $ld_base))
      (then (return (i32.const 0))))
    (if (i32.eq (i32.and (local.get $ld_reg) (i32.const 3)) (local.get $st_base))
      (then (return (i32.const 0))))

    ;; Sort the increments: one steps the source, one the destination, and a
    ;; third (if there is no memory counter) is the trip count.
    (local.set $i (i32.const 0))
    (block $p2_done
      (loop $p2
        (br_if $p2_done (i32.ge_u (local.get $i) (local.get $n)))
        (local.set $p (call $loop_op_at (local.get $i)))
        (local.set $fn (load.field LoopOp handler (local.get $p)))
        (local.set $op (load.field.memarg LoopOp operand (local.get $p)))
        (if (i32.eq (call $loop_role (local.get $fn) (local.get $op))
                    (global.get $LR_ADDI))
          (then
            (local.set $reg (i32.and (local.get $op) (i32.const 0xF)))
            (local.set $step
              (select (i32.const 1) (i32.const -1) (i32.eq (local.get $fn) (i32.const 64))))
            (if (i32.eq (local.get $reg) (local.get $ld_base))
              (then
                (local.set $src_cnt (i32.add (local.get $src_cnt) (i32.const 1)))
                (local.set $src_stride (local.get $step))
                (local.set $src_idx (local.get $i)))
              (else (if (i32.eq (local.get $reg) (local.get $st_base))
                (then
                  (local.set $dst_cnt (i32.add (local.get $dst_cnt) (i32.const 1)))
                  (local.set $dst_stride (local.get $step))
                  (local.set $dst_idx (local.get $i)))
                (else
                  (local.set $ctr_cnt (i32.add (local.get $ctr_cnt) (i32.const 1)))
                  (local.set $ctr_loc (local.get $reg))
                  (local.set $ctr_step (local.get $step))
                  (local.set $ctr_idx (local.get $i))))))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $p2)))

    ;; Both cursors stepped exactly once; no fourth increment.
    (if (i32.ne (local.get $src_cnt) (i32.const 1)) (then (return (i32.const 0))))
    (if (i32.ne (local.get $dst_cnt) (i32.const 1)) (then (return (i32.const 0))))
    (if (i32.ne (i32.add (local.get $ctr_cnt) (local.get $mem_cnt)) (i32.const 1))
      (then (return (i32.const 0))))
    (if (i32.ne (local.get $addi_cnt)
                (i32.add (i32.const 2) (local.get $ctr_cnt)))
      (then (return (i32.const 0))))

    ;; A counter in memory needs a loop-invariant address, or it is not one
    ;; counter but a walk over several.
    (if (local.get $mem_cnt)
      (then
        (if (i32.and (local.get $written)
              (i32.shl (i32.const 1) (local.get $mem_base)))
          (then (return (i32.const 0))))
        (local.set $ctr_kind (i32.const 1))
        (local.set $ctr_loc (local.get $mem_base))
        (local.set $ctr_disp (local.get $mem_disp))
        (local.set $ctr_step (local.get $mem_step))
        (local.set $ctr_idx (local.get $mem_idx))))

    ;; Only the count-down-to-zero form: the branch reads the counter's flags,
    ;; so the counter has to be the last thing that set them.
    (local.set $p (call $loop_op_at (i32.sub (local.get $n) (i32.const 1))))
    (if (i32.ne (load.field LoopOp handler (local.get $p)) (i32.const 312)) (then (return (i32.const 0))))
    (if (i32.ne (local.get $ctr_idx) (i32.sub (local.get $n) (i32.const 2)))
      (then (return (i32.const 0))))

    ;; Fold the cursor bumps into the displacements. The super-op bumps AFTER
    ;; the access, so an access the original performed after its own bump saw
    ;; a cursor one stride ahead.
    (if (i32.lt_u (local.get $src_idx) (local.get $ld_idx))
      (then (local.set $ld_disp (i32.add (local.get $ld_disp) (local.get $src_stride)))))
    (if (i32.lt_u (local.get $dst_idx) (local.get $st_idx))
      (then (local.set $st_disp (i32.add (local.get $st_disp) (local.get $dst_stride)))))

    ;; ---- emit ----
    (global.set $loop_matched_blocks
      (i32.add (global.get $loop_matched_blocks) (i32.const 1)))
    ;; Marker 0x100B0002 = COPY_RUN, then the entry EIP. See the LUT_RUN one.
    (if (global.get $loop_trace)
      (then
        (call $host_log_i32 (i32.const 0x100B0002))
        (call $host_log_i32 (local.get $start_eip))))
    (if (i32.eqz (call $loop_generic_copy_emit_get)) (then (return (i32.const 0))))

    (local.set $fall (i32.load offset=8
      (call $loop_op_at (i32.sub (local.get $n) (i32.const 1)))))
    (global.set $thread_alloc (local.get $tstart))
    (global.set $op_index_n (i32.const 0))
    (call $te (global.get $LOOP_SUPEROP_COPY) (i32.const 0))
    (call $te_raw (local.get $ld_base))
    (call $te_raw (local.get $src_stride))
    (call $te_raw (local.get $ld_disp))
    (call $te_raw (local.get $st_base))
    (call $te_raw (local.get $dst_stride))
    (call $te_raw (local.get $st_disp))
    (call $te_raw (local.get $ld_reg))
    (call $te_raw (local.get $ctr_kind))
    (call $te_raw (local.get $ctr_loc))
    (call $te_raw (local.get $ctr_disp))
    (call $te_raw (local.get $ctr_step))
    (call $te_raw (local.get $fall))
    (call $te_raw (local.get $start_eip))
    (call $te_raw (local.get $n))
    (i32.const 1))

  ;; Bytes a cursor can still touch before it leaves the 4 KB page it sits in,
  ;; counting the byte under it. $g2w is affine within a map record, and a
  ;; sparse reservation committed in pieces gets one record per commit, so a
  ;; page is the largest span whose guest->WASM delta is guaranteed constant.
  ;; This is the same invariant $gl32 relies on when it skips its cross-page
  ;; gather. LUT16 additionally uses +/-2 destination strides.
  (func $copy_page_room (param $ga i32) (param $stride i32) (result i32)
    (local $off i32)
    (local.set $off (i32.and (local.get $ga) (i32.const 0xFFF)))
    (if (i32.gt_s (local.get $stride) (i32.const 0))
      (then
        (return
          (i32.add
            (i32.div_u (i32.sub (i32.const 0xFFF) (local.get $off))
                       (local.get $stride))
            (i32.const 1)))))
    (i32.add
      (i32.div_u (local.get $off) (i32.sub (i32.const 0) (local.get $stride)))
      (i32.const 1)))

  ;; Exact execution of the MSVC 64-byte MMX memcpy recognized above.  The
  ;; ordinary loop is a forward copy, not memmove: only use memory.copy when
  ;; the complete guest ranges are proved disjoint and this cache line has an
  ;; affine page-local translation.  The overlap/split fallback performs the
  ;; original interleaved load/store order through the mapping-aware helpers.
  (func $th_mmx_copy64 (param $op i32)
    (local $tp i32) (local $fall i32) (local $back i32)
    (local $src i32) (local $dst i32) (local $count i32)
    (local $old_dst i32) (local $old_count i32)
    (local $src_end i32) (local $dst_end i32) (local $bytes i32)
    (local $overlap i32) (local $src_wa i32) (local $dst_wa i32)
    (local $q0 i64) (local $q1 i64) (local $q2 i64) (local $q3 i64)
    (local $tail0 v128) (local $tail1 v128)
    (local $iterations i32) (local $charge i32) (local $fast i32)

    (local.set $tp (global.get $ip))
    (global.set $ip (i32.add (local.get $tp) (i32.const 8)))
    (local.set $fall (i32.load (local.get $tp)))
    (local.set $back (i32.load offset=4 (local.get $tp)))
    (local.set $src (i32.load offset=24 (global.get $reg_base)))
    (local.set $dst (i32.load offset=28 (global.get $reg_base)))
    (local.set $count (i32.load offset=4 (global.get $reg_base)))
    (global.set $mmx_copy64_runs
      (i32.add (global.get $mmx_copy64_runs) (i32.const 1)))

    ;; A zero ECX is the x86 do-while wrap case, and count<<6 can overflow.
    ;; Both stay on the exact one-line-at-a-time arm.
    (if (i32.and (i32.ne (local.get $count) (i32.const 0))
                 (i32.le_u (local.get $count) (i32.const 0x03FFFFFF)))
      (then
        (local.set $bytes (i32.shl (local.get $count) (i32.const 6)))
        (local.set $src_end (i32.add (local.get $src) (local.get $bytes)))
        (local.set $dst_end (i32.add (local.get $dst) (local.get $bytes)))
        (local.set $overlap
          (i32.or
            (i32.or (i32.lt_u (local.get $src_end) (local.get $src))
                    (i32.lt_u (local.get $dst_end) (local.get $dst)))
            (i32.and (i32.lt_u (local.get $src) (local.get $dst_end))
                     (i32.lt_u (local.get $dst) (local.get $src_end))))))
      (else (local.set $overlap (i32.const 1))))

    (block $done
      (loop $lines
        (local.set $old_dst (local.get $dst))
        (local.set $old_count (local.get $count))
        (local.set $fast (i32.const 0))
        (if (i32.and
              (i32.eqz (local.get $overlap))
              (i32.and
                (i32.le_u (i32.and (local.get $src) (i32.const 0xFFF)) (i32.const 0xFC0))
                (i32.le_u (i32.and (local.get $dst) (i32.const 0xFFF)) (i32.const 0xFC0))))
          (then
            (local.set $src_wa (call $g2w (local.get $src)))
            (local.set $dst_wa (call $g2w (local.get $dst)))
            (if (i32.and
                  (i32.ne (local.get $src_wa) (global.get $NULL_SENTINEL))
                  (i32.ne (local.get $dst_wa) (global.get $NULL_SENTINEL)))
              (then
                ;; The loop leaves mm0..mm3 holding bytes 32..63 of its final
                ;; line.  Capture them before bulk copy for exact MMX state.
                (local.set $tail0 (v128.load offset=32 (local.get $src_wa)))
                (local.set $tail1 (v128.load offset=48 (local.get $src_wa)))
                (local.set $q0 (i64x2.extract_lane 0 (local.get $tail0)))
                (local.set $q1 (i64x2.extract_lane 1 (local.get $tail0)))
                (local.set $q2 (i64x2.extract_lane 0 (local.get $tail1)))
                (local.set $q3 (i64x2.extract_lane 1 (local.get $tail1)))
                (call $invalidate_code_write (local.get $dst) (i32.const 64))
                (memory.copy (local.get $dst_wa) (local.get $src_wa) (i32.const 64))
                (local.set $fast (i32.const 1))))))

        (if (i32.eqz (local.get $fast))
          (then
            ;; Preserve the source-observation order of the original eight
            ;; load pairs and eight stores for overlapping or split mappings.
            (local.set $q0 (call $mmx_load64 (local.get $src)))
            (local.set $q1 (call $mmx_load64 (i32.add (local.get $src) (i32.const 8))))
            (call $mmx_store64 (local.get $dst) (local.get $q0))
            (call $mmx_store64 (i32.add (local.get $dst) (i32.const 8)) (local.get $q1))
            (local.set $q2 (call $mmx_load64 (i32.add (local.get $src) (i32.const 16))))
            (local.set $q3 (call $mmx_load64 (i32.add (local.get $src) (i32.const 24))))
            (call $mmx_store64 (i32.add (local.get $dst) (i32.const 16)) (local.get $q2))
            (call $mmx_store64 (i32.add (local.get $dst) (i32.const 24)) (local.get $q3))
            (local.set $q0 (call $mmx_load64 (i32.add (local.get $src) (i32.const 32))))
            (local.set $q1 (call $mmx_load64 (i32.add (local.get $src) (i32.const 40))))
            (call $mmx_store64 (i32.add (local.get $dst) (i32.const 32)) (local.get $q0))
            (call $mmx_store64 (i32.add (local.get $dst) (i32.const 40)) (local.get $q1))
            (local.set $q2 (call $mmx_load64 (i32.add (local.get $src) (i32.const 48))))
            (local.set $q3 (call $mmx_load64 (i32.add (local.get $src) (i32.const 56))))
            (call $mmx_store64 (i32.add (local.get $dst) (i32.const 48)) (local.get $q2))
            (call $mmx_store64 (i32.add (local.get $dst) (i32.const 56)) (local.get $q3))))

        (local.set $src (i32.add (local.get $src) (i32.const 64)))
        (local.set $dst (i32.add (local.get $dst) (i32.const 64)))
        (local.set $count (i32.sub (local.get $count) (i32.const 1)))
        (local.set $iterations (i32.add (local.get $iterations) (i32.const 1)))
        (local.set $charge (i32.add (local.get $charge) (i32.const 21)))
        (br_if $done (i32.eqz (local.get $count)))
        (br_if $done
          (i32.ge_u (i32.sub (local.get $charge) (i32.const 1))
                    (global.get $steps)))
        (br $lines)))

    (i32.store offset=24 (global.get $reg_base) (local.get $src))
    (i32.store offset=28 (global.get $reg_base) (local.get $dst))
    (i32.store offset=4 (global.get $reg_base) (local.get $count))
    ;; DEC preserves the carry flag produced by the immediately preceding ADD
    ;; EDI,64; all other arithmetic flags come from DEC.
    (call $set_flags_add (local.get $old_dst) (i32.const 64) (local.get $dst))
    (call $set_flags_dec (local.get $old_count) (local.get $count))
    (call $mmx_set (i32.const 0) (local.get $q0))
    (call $mmx_set (i32.const 1) (local.get $q1))
    (call $mmx_set (i32.const 2) (local.get $q2))
    (call $mmx_set (i32.const 3) (local.get $q3))
    (global.set $mmx_exec_count
      (i32.add (global.get $mmx_exec_count)
        (i32.mul (local.get $iterations) (i32.const 16))))
    (global.set $mmx_copy64_lines
      (i64.add (global.get $mmx_copy64_lines) (i64.extend_i32_u (local.get $iterations))))
    (global.set $mmx_copy64_bytes
      (i64.add (global.get $mmx_copy64_bytes)
        (i64.extend_i32_u (i32.shl (local.get $iterations) (i32.const 6)))))
    (global.set $steps
      (i32.sub (global.get $steps) (i32.sub (local.get $charge) (i32.const 1))))
    (global.set $eip
      (select (local.get $back) (local.get $fall) (i32.ne (local.get $count) (i32.const 0)))))

  ;; Does the guest byte range [ga, ga+len) touch the loop's own code bytes
  ;; [back, fall)? Unsigned, so a range ending exactly at 2^32 still works.
  (func $mmx_fill64_hits_code (param $ga i32) (param $len i32)
                              (param $back i32) (param $fall i32) (result i32)
    (if (i32.ge_u (local.get $ga) (local.get $fall)) (then (return (i32.const 0))))
    (if (i32.le_u (local.get $back) (local.get $ga)) (then (return (i32.const 1))))
    (i32.lt_u (i32.sub (local.get $back) (local.get $ga)) (local.get $len)))

  ;; Exact execution of $try_emit_mmx_fill64's loop. Iteration i stores the
  ;; pattern at dst+8i, so the fill is always qword-phased from the original
  ;; EDI and a page-local run of whole qwords is one translation, one code-write
  ;; notification and a v128 store loop. Everything else takes the ordinary
  ;; helper one qword at a time, which is bit-for-bit the MOVQ handler:
  ;;
  ;;   * a qword straddling a page edge ($gs64 splits it itself);
  ;;   * a page with no mapping ($mmx_store64 writes the sentinel, or raises
  ;;     under --fault-null=raise, and then the fold stops with the faulting
  ;;     iteration's ADD/DEC unexecuted, exactly as an abandoned block would).
  ;;
  ;; A run that would write the loop's own nine bytes stops after the first
  ;; qword that does: $invalidate_code_write has retired this block, and the
  ;; next iteration must come from the re-decoded bytes, not from this op.
  ;;
  ;; Final state is the last iteration's: EDI/ECX (any register assignment),
  ;; the ADD's carry under the DEC's other flags, mmN untouched. A zero counter
  ;; is the do-while wrap; each entry does at most 64K qwords (512 KB) and
  ;; resumes through the back edge, and --branch-clock caps it to the block
  ;; budget so a fixed batch lands on the same guest instruction either way.
  (func $th_mmx_fill64 (param $op i32)
    (local $tp i32) (local $fall i32) (local $back i32) (local $packed i32)
    (local $r i32) (local $c i32) (local $pat i64) (local $v v128)
    (local $dst i32) (local $count i32) (local $new_dst i32) (local $new_count i32)
    (local $want i32) (local $done i32) (local $ga i32) (local $q i32)
    (local $room i32) (local $stop i32) (local $slow i32) (local $wa i32)
    (local $p i32) (local $end i32) (local $abandon i32)
    (local.set $tp (global.get $ip))
    (global.set $ip (i32.add (local.get $tp) (i32.const 12)))
    (local.set $fall (i32.load (local.get $tp)))
    (local.set $back (i32.load offset=4 (local.get $tp)))
    (local.set $packed (i32.load offset=8 (local.get $tp)))
    (local.set $r (i32.and (local.get $packed) (i32.const 0xF)))
    (local.set $c (i32.and (i32.shr_u (local.get $packed) (i32.const 4)) (i32.const 0xF)))
    (local.set $dst (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $r) (i32.const 2)))))
    (local.set $count (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $c) (i32.const 2)))))
    (local.set $pat (call $mmx_get (i32.and (i32.shr_u (local.get $packed) (i32.const 8)) (i32.const 7))))
    (local.set $v (i64x2.splat (local.get $pat)))
    (global.set $mmx_fill64_runs (i32.add (global.get $mmx_fill64_runs) (i32.const 1)))

    (local.set $want (local.get $count))
    (if (i32.or (i32.eqz (local.get $want)) (i32.gt_u (local.get $want) (i32.const 0x10000)))
      (then (local.set $want (i32.const 0x10000))))
    (local.set $want (call $bc_fold_cap (local.get $want) (i32.const 0)))

    (block $out
      (loop $chunks
        (br_if $out (i32.ge_u (local.get $done) (local.get $want)))
        (local.set $ga (i32.add (local.get $dst) (i32.shl (local.get $done) (i32.const 3))))
        (local.set $room
          (i32.shr_u (i32.sub (i32.const 0x1000) (i32.and (local.get $ga) (i32.const 0xFFF)))
                     (i32.const 3)))
        (local.set $q (i32.sub (local.get $want) (local.get $done)))
        (if (i32.lt_u (local.get $room) (local.get $q)) (then (local.set $q (local.get $room))))
        (local.set $stop (i32.const 0))
        (if (i32.ne (local.get $q) (i32.const 0))
          (then
            (if (call $mmx_fill64_hits_code (local.get $ga) (i32.shl (local.get $q) (i32.const 3))
                                            (local.get $back) (local.get $fall))
              (then
                ;; Stop after the first qword that lands on the loop's bytes.
                (local.set $q
                  (i32.add (i32.const 1)
                    (select (i32.shr_u (i32.sub (local.get $back) (local.get $ga)) (i32.const 3))
                            (i32.const 0)
                            (i32.gt_u (local.get $back) (local.get $ga)))))
                (local.set $stop (i32.const 1))))))
        (local.set $slow (i32.eqz (local.get $q)))
        (if (i32.eqz (local.get $slow))
          (then
            (local.set $wa (call $g2w (local.get $ga)))
            (if (global.get $eip_redirected)
              (then (local.set $abandon (i32.const 1)) (br $out)))
            (local.set $slow (i32.eq (local.get $wa) (global.get $NULL_SENTINEL)))))
        (if (local.get $slow)
          (then
            (call $mmx_store64 (local.get $ga) (local.get $pat))
            (if (global.get $eip_redirected)
              (then (local.set $abandon (i32.const 1)) (br $out)))
            (local.set $done (i32.add (local.get $done) (i32.const 1)))
            (local.set $stop
              (call $mmx_fill64_hits_code (local.get $ga) (i32.const 8)
                                          (local.get $back) (local.get $fall))))
          (else
            (call $invalidate_code_write (local.get $ga) (i32.shl (local.get $q) (i32.const 3)))
            (local.set $p (local.get $wa))
            (local.set $end (i32.add (local.get $wa) (i32.shl (local.get $q) (i32.const 3))))
            (block $b64 (loop $l64
              (br_if $b64 (i32.gt_u (i32.add (local.get $p) (i32.const 64)) (local.get $end)))
              (v128.store (local.get $p) (local.get $v))
              (v128.store offset=16 (local.get $p) (local.get $v))
              (v128.store offset=32 (local.get $p) (local.get $v))
              (v128.store offset=48 (local.get $p) (local.get $v))
              (local.set $p (i32.add (local.get $p) (i32.const 64)))
              (br $l64)))
            (block $b16 (loop $l16
              (br_if $b16 (i32.gt_u (i32.add (local.get $p) (i32.const 16)) (local.get $end)))
              (v128.store (local.get $p) (local.get $v))
              (local.set $p (i32.add (local.get $p) (i32.const 16)))
              (br $l16)))
            (if (i32.lt_u (local.get $p) (local.get $end))
              (then (i64.store (local.get $p) (local.get $pat))))
            (global.set $mmx_fill64_bulk_qwords
              (i64.add (global.get $mmx_fill64_bulk_qwords) (i64.extend_i32_u (local.get $q))))
            (local.set $done (i32.add (local.get $done) (local.get $q)))))
        (br_if $out (local.get $stop))
        (br $chunks)))

    (if (local.get $done)
      (then
        (local.set $new_dst (i32.add (local.get $dst) (i32.shl (local.get $done) (i32.const 3))))
        (local.set $new_count (i32.sub (local.get $count) (local.get $done)))
        (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $r) (i32.const 2))) (local.get $new_dst))
        (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $c) (i32.const 2))) (local.get $new_count))
        ;; DEC keeps the carry from the ADD before it; every other flag is DEC's.
        (call $set_flags_add (i32.sub (local.get $new_dst) (i32.const 8)) (i32.const 8) (local.get $new_dst))
        (call $set_flags_dec (i32.add (local.get $new_count) (i32.const 1)) (local.get $new_count))
        (global.set $mmx_exec_count (i32.add (global.get $mmx_exec_count) (local.get $done)))
        (global.set $mmx_fill64_qwords
          (i64.add (global.get $mmx_fill64_qwords) (i64.extend_i32_u (local.get $done))))
        (call $bc_fold_charge (local.get $done))))
    ;; A raised fault already owns $eip (the handler); the faulting iteration's
    ;; ADD/DEC never ran, which is what the registers above say.
    (if (local.get $abandon) (then (return)))
    (global.set $eip
      (select (local.get $back) (local.get $fall) (i32.ne (local.get $new_count) (i32.const 0)))))

  (func $th_mmx_stream_copy64 (param $op i32)
    (local $tp i32) (local $fall i32) (local $back i32)
    (local $src i32) (local $dst i32) (local $count i32)
    (local $old_dst i32) (local $old_count i32)
    (local $src_wa i32) (local $dst_wa i32) (local $fast i32)
    (local $q0 i64) (local $q1 i64) (local $q2 i64) (local $q3 i64)
    (local $q4 i64) (local $q5 i64) (local $q6 i64) (local $q7 i64)
    (local $iterations i32) (local $charge i32)
    (local.set $tp (global.get $ip))
    (global.set $ip (i32.add (local.get $tp) (i32.const 8)))
    (local.set $fall (i32.load (local.get $tp)))
    (local.set $back (i32.load offset=4 (local.get $tp)))
    (local.set $src (i32.load offset=24 (global.get $reg_base)))
    (local.set $dst (i32.load offset=28 (global.get $reg_base)))
    (local.set $count (i32.load offset=0 (global.get $reg_base)))
    (global.set $mmx_copy64_runs
      (i32.add (global.get $mmx_copy64_runs) (i32.const 1)))
    (block $done
      (loop $lines
        (local.set $old_dst (local.get $dst))
        (local.set $old_count (local.get $count))
        ;; Always capture all eight source qwords before any store. Besides
        ;; preserving MMX0..7, this exactly retains the original overlap order.
        (local.set $q0 (call $mmx_load64 (local.get $src)))
        (local.set $q1 (call $mmx_load64 (i32.add (local.get $src) (i32.const 8))))
        (local.set $q2 (call $mmx_load64 (i32.add (local.get $src) (i32.const 16))))
        (local.set $q3 (call $mmx_load64 (i32.add (local.get $src) (i32.const 24))))
        (local.set $q4 (call $mmx_load64 (i32.add (local.get $src) (i32.const 32))))
        (local.set $q5 (call $mmx_load64 (i32.add (local.get $src) (i32.const 40))))
        (local.set $q6 (call $mmx_load64 (i32.add (local.get $src) (i32.const 48))))
        (local.set $q7 (call $mmx_load64 (i32.add (local.get $src) (i32.const 56))))
        (local.set $fast (i32.const 0))
        (if (i32.and
              (i32.and
                (i32.le_u (local.get $src) (i32.add (local.get $src) (i32.const 64)))
                (i32.and
                  (i32.le_u (local.get $dst) (i32.add (local.get $dst) (i32.const 64)))
                  (i32.or (i32.le_u (i32.add (local.get $src) (i32.const 64)) (local.get $dst))
                          (i32.le_u (i32.add (local.get $dst) (i32.const 64)) (local.get $src)))))
              (i32.and
                (i32.le_u (i32.and (local.get $src) (i32.const 0xFFF)) (i32.const 0xFC0))
                (i32.le_u (i32.and (local.get $dst) (i32.const 0xFFF)) (i32.const 0xFC0))))
          (then
            (local.set $src_wa (call $g2w (local.get $src)))
            (local.set $dst_wa (call $g2w (local.get $dst)))
            (if (i32.and
                  (i32.ne (local.get $src_wa) (global.get $NULL_SENTINEL))
                  (i32.ne (local.get $dst_wa) (global.get $NULL_SENTINEL)))
              (then
                (call $invalidate_code_write (local.get $dst) (i32.const 64))
                (memory.copy (local.get $dst_wa) (local.get $src_wa) (i32.const 64))
                (local.set $fast (i32.const 1))))))
        (if (i32.eqz (local.get $fast)) (then
          (call $mmx_store64 (local.get $dst) (local.get $q0))
          (call $mmx_store64 (i32.add (local.get $dst) (i32.const 8)) (local.get $q1))
          (call $mmx_store64 (i32.add (local.get $dst) (i32.const 16)) (local.get $q2))
          (call $mmx_store64 (i32.add (local.get $dst) (i32.const 24)) (local.get $q3))
          (call $mmx_store64 (i32.add (local.get $dst) (i32.const 32)) (local.get $q4))
          (call $mmx_store64 (i32.add (local.get $dst) (i32.const 40)) (local.get $q5))
          (call $mmx_store64 (i32.add (local.get $dst) (i32.const 48)) (local.get $q6))
          (call $mmx_store64 (i32.add (local.get $dst) (i32.const 56)) (local.get $q7))))
        (local.set $src (i32.add (local.get $src) (i32.const 64)))
        (local.set $dst (i32.add (local.get $dst) (i32.const 64)))
        (local.set $count (i32.sub (local.get $count) (i32.const 1)))
        (local.set $iterations (i32.add (local.get $iterations) (i32.const 1)))
        (local.set $charge (i32.add (local.get $charge) (i32.const 20)))
        (br_if $done (i32.eqz (local.get $count)))
        (br_if $done
          (i32.ge_u (i32.sub (local.get $charge) (i32.const 1))
                    (global.get $steps)))
        (br $lines)))
    (i32.store offset=24 (global.get $reg_base) (local.get $src))
    (i32.store offset=28 (global.get $reg_base) (local.get $dst))
    (i32.store offset=0 (global.get $reg_base) (local.get $count))
    (call $set_flags_add (local.get $old_dst) (i32.const 64) (local.get $dst))
    (call $set_flags_dec (local.get $old_count) (local.get $count))
    (call $mmx_set (i32.const 0) (local.get $q0))
    (call $mmx_set (i32.const 1) (local.get $q1))
    (call $mmx_set (i32.const 2) (local.get $q2))
    (call $mmx_set (i32.const 3) (local.get $q3))
    (call $mmx_set (i32.const 4) (local.get $q4))
    (call $mmx_set (i32.const 5) (local.get $q5))
    (call $mmx_set (i32.const 6) (local.get $q6))
    (call $mmx_set (i32.const 7) (local.get $q7))
    (global.set $mmx_exec_count
      (i32.add (global.get $mmx_exec_count)
        (i32.mul (local.get $iterations) (i32.const 16))))
    (global.set $mmx_copy64_lines
      (i64.add (global.get $mmx_copy64_lines) (i64.extend_i32_u (local.get $iterations))))
    (global.set $mmx_copy64_bytes
      (i64.add (global.get $mmx_copy64_bytes)
        (i64.extend_i32_u (i32.shl (local.get $iterations) (i32.const 6)))))
    (global.set $steps
      (i32.sub (global.get $steps) (i32.sub (local.get $charge) (i32.const 1))))
    (global.set $eip
      (select (local.get $back) (local.get $fall) (i32.ne (local.get $count) (i32.const 0)))))

  ;; Exact execution of D3DDrv's three-register pipelined MOVNTQ loop. The
  ;; disjoint/page-local arm captures the final MMX values with four SIMD
  ;; loads, then copies the line in bulk. The fallback retains the original
  ;; alternating load/store sequence, which matters for overlapping ranges.
  (func $th_mmx_pipelined_copy64 (param $op i32)
    (local $tp i32) (local $fall i32) (local $back i32)
    (local $src i32) (local $dst i32) (local $count i32)
    (local $old_src i32) (local $old_count i32)
    (local $src_end i32) (local $dst_end i32) (local $bytes i32)
    (local $overlap i32) (local $src_wa i32) (local $dst_wa i32)
    (local $q0 i64) (local $q1 i64) (local $q2 i64) (local $q3 i64)
    (local $q4 i64) (local $q5 i64) (local $q6 i64) (local $q7 i64)
    (local $v0 v128) (local $v1 v128) (local $v2 v128) (local $v3 v128)
    (local $iterations i32) (local $charge i32) (local $fast i32)

    (local.set $tp (global.get $ip))
    (global.set $ip (i32.add (local.get $tp) (i32.const 8)))
    (local.set $fall (i32.load (local.get $tp)))
    (local.set $back (i32.load offset=4 (local.get $tp)))
    (local.set $src (i32.load offset=24 (global.get $reg_base)))
    (local.set $dst (i32.load offset=28 (global.get $reg_base)))
    (local.set $count (i32.load offset=4 (global.get $reg_base)))
    (global.set $mmx_copy64_runs
      (i32.add (global.get $mmx_copy64_runs) (i32.const 1)))

    (if (i32.and (i32.ne (local.get $count) (i32.const 0))
                 (i32.le_u (local.get $count) (i32.const 0x03FFFFFF)))
      (then
        (local.set $bytes (i32.shl (local.get $count) (i32.const 6)))
        (local.set $src_end (i32.add (local.get $src) (local.get $bytes)))
        (local.set $dst_end (i32.add (local.get $dst) (local.get $bytes)))
        (local.set $overlap
          (i32.or
            (i32.or (i32.lt_u (local.get $src_end) (local.get $src))
                    (i32.lt_u (local.get $dst_end) (local.get $dst)))
            (i32.and (i32.lt_u (local.get $src) (local.get $dst_end))
                     (i32.lt_u (local.get $dst) (local.get $src_end))))))
      (else (local.set $overlap (i32.const 1))))

    (block $done
      (loop $lines
        (local.set $old_src (local.get $src))
        (local.set $old_count (local.get $count))
        (local.set $fast (i32.const 0))
        (if (i32.and
              (i32.eqz (local.get $overlap))
              (i32.and
                (i32.le_u (i32.and (local.get $src) (i32.const 0xFFF)) (i32.const 0xFC0))
                (i32.le_u (i32.and (local.get $dst) (i32.const 0xFFF)) (i32.const 0xFC0))))
          (then
            (local.set $src_wa (call $g2w (local.get $src)))
            (local.set $dst_wa (call $g2w (local.get $dst)))
            (if (i32.and
                  (i32.ne (local.get $src_wa) (global.get $NULL_SENTINEL))
                  (i32.ne (local.get $dst_wa) (global.get $NULL_SENTINEL)))
              (then
                (local.set $v0 (v128.load (local.get $src_wa)))
                (local.set $v1 (v128.load offset=16 (local.get $src_wa)))
                (local.set $v2 (v128.load offset=32 (local.get $src_wa)))
                (local.set $v3 (v128.load offset=48 (local.get $src_wa)))
                (local.set $q0 (i64x2.extract_lane 0 (local.get $v0)))
                (local.set $q1 (i64x2.extract_lane 1 (local.get $v0)))
                (local.set $q2 (i64x2.extract_lane 0 (local.get $v1)))
                (local.set $q3 (i64x2.extract_lane 1 (local.get $v1)))
                (local.set $q4 (i64x2.extract_lane 0 (local.get $v2)))
                (local.set $q5 (i64x2.extract_lane 1 (local.get $v2)))
                (local.set $q6 (i64x2.extract_lane 0 (local.get $v3)))
                (local.set $q7 (i64x2.extract_lane 1 (local.get $v3)))
                (call $invalidate_code_write (local.get $dst) (i32.const 64))
                (memory.copy (local.get $dst_wa) (local.get $src_wa) (i32.const 64))
                (local.set $fast (i32.const 1))))))

        (if (i32.eqz (local.get $fast))
          (then
            (local.set $q0 (call $mmx_load64 (local.get $src)))
            (local.set $q1 (call $mmx_load64 (i32.add (local.get $src) (i32.const 8))))
            (local.set $q2 (call $mmx_load64 (i32.add (local.get $src) (i32.const 16))))
            (call $mmx_store64 (local.get $dst) (local.get $q0))
            (local.set $q3 (call $mmx_load64 (i32.add (local.get $src) (i32.const 24))))
            (call $mmx_store64 (i32.add (local.get $dst) (i32.const 8)) (local.get $q1))
            (local.set $q4 (call $mmx_load64 (i32.add (local.get $src) (i32.const 32))))
            (call $mmx_store64 (i32.add (local.get $dst) (i32.const 16)) (local.get $q2))
            (local.set $q5 (call $mmx_load64 (i32.add (local.get $src) (i32.const 40))))
            (call $mmx_store64 (i32.add (local.get $dst) (i32.const 24)) (local.get $q3))
            (local.set $q6 (call $mmx_load64 (i32.add (local.get $src) (i32.const 48))))
            (call $mmx_store64 (i32.add (local.get $dst) (i32.const 32)) (local.get $q4))
            (local.set $q7 (call $mmx_load64 (i32.add (local.get $src) (i32.const 56))))
            (call $mmx_store64 (i32.add (local.get $dst) (i32.const 40)) (local.get $q5))
            (call $mmx_store64 (i32.add (local.get $dst) (i32.const 48)) (local.get $q6))
            (call $mmx_store64 (i32.add (local.get $dst) (i32.const 56)) (local.get $q7))))

        (local.set $dst (i32.add (local.get $dst) (i32.const 64)))
        (local.set $src (i32.add (local.get $src) (i32.const 64)))
        (local.set $count (i32.sub (local.get $count) (i32.const 1)))
        (local.set $iterations (i32.add (local.get $iterations) (i32.const 1)))
        (local.set $charge (i32.add (local.get $charge) (i32.const 21)))
        (br_if $done (i32.eqz (local.get $count)))
        (br_if $done
          (i32.ge_u (i32.sub (local.get $charge) (i32.const 1))
                    (global.get $steps)))
        (br $lines)))

    (i32.store offset=24 (global.get $reg_base) (local.get $src))
    (i32.store offset=28 (global.get $reg_base) (local.get $dst))
    (i32.store offset=4 (global.get $reg_base) (local.get $count))
    ;; DEC preserves CF from the preceding ADD ESI,64.
    (call $set_flags_add (local.get $old_src) (i32.const 64) (local.get $src))
    (call $set_flags_dec (local.get $old_count) (local.get $count))
    (call $mmx_set (i32.const 0) (local.get $q6))
    (call $mmx_set (i32.const 1) (local.get $q7))
    (call $mmx_set (i32.const 2) (local.get $q5))
    (global.set $mmx_exec_count
      (i32.add (global.get $mmx_exec_count)
        (i32.mul (local.get $iterations) (i32.const 16))))
    (global.set $mmx_copy64_lines
      (i64.add (global.get $mmx_copy64_lines) (i64.extend_i32_u (local.get $iterations))))
    (global.set $mmx_copy64_bytes
      (i64.add (global.get $mmx_copy64_bytes)
        (i64.extend_i32_u (i32.shl (local.get $iterations) (i32.const 6)))))
    (global.set $steps
      (i32.sub (global.get $steps) (i32.sub (local.get $charge) (i32.const 1))))
    (global.set $eip
      (select (local.get $back) (local.get $fall) (i32.ne (local.get $count) (i32.const 0)))))

  ;; ------------------------------------------------------------------
  ;; 419: the COPY_RUN super-op.
  ;; ------------------------------------------------------------------
  ;; Same contract as 418: charge $steps at the body's op count so batch
  ;; granularity is unchanged, and republish $eip at the loop entry when the
  ;; budget runs out.
  ;;
  ;; A memory-resident counter is written back on every iteration rather than
  ;; once at exit. It is one extra store against six eliminated dispatches, and
  ;; it means the destination range is allowed to cover the counter's own
  ;; address -- which is not a shape worth reasoning about at match time.
  (func $th_copy_run (param $op i32)
    (local $bc_done i32)
     (local $nx_fn i32) (local $nx_op i32) (local $src_reg i32) (local $src_stride i32) (local $src_disp i32)
    (local $dst_reg i32) (local $dst_stride i32) (local $dst_disp i32)
    (local $byte_reg i32) (local $ctr_kind i32) (local $ctr_loc i32)
    (local $ctr_disp i32) (local $ctr_step i32)
    (local $fall i32) (local $back i32) (local $cost i32)
    (local $src i32) (local $dst i32) (local $ctr i32) (local $old i32)
    (local $ctr_addr i32) (local $b i32) (local $tp i32) (local $store_ctr i32)
    (local $lo i32) (local $hi i32)
    (local $src_ga i32) (local $dst_ga i32) (local $src_wa i32) (local $dst_wa i32)
    (local $chunk i32) (local $trips i32) (local $allowed i32) (local $n i32)
    (local $bound i32) (local $round_quantum i32) (local $private_bytes i32)
    (local $private_limit i32) (local $private_groups i32)
    (local $src_end i32) (local $dst_end i32) (local $copy32_overlap i32)

    (if (i32.lt_s (local.get $op) (i32.const 0))
      (then
        (if (i32.eq (local.get $op) (i32.const 0x80000001))
          (then (return_call $th_mmx_copy64 (local.get $op))))
        (if (i32.eq (local.get $op) (i32.const 0x80000002))
          (then (return_call $th_mmx_stream_copy64 (local.get $op))))
        (if (i32.eq (local.get $op) (i32.const 0x80000003))
          (then (return_call $th_mmx_pipelined_copy64 (local.get $op))))
        (if (i32.eq (local.get $op) (i32.const 0x80000005))
          (then (return_call $th_mmx_fill64 (local.get $op))))
        ;; 0x80000000 was Jazz 2's masked MMX row copy and 0x80000004 the
        ;; counted dword copy Diablo's profile enabled, both retired to the
        ;; uop tier (docs/uop-tier-design.md section 18); nothing emits them.
        (unreachable)))

    ;; Fourteen $read_thread_word calls would be fourteen calls and fourteen
    ;; global round trips on every entry, and this loop's measured average trip
    ;; count is about four iterations -- the parameter block is not amortized
    ;; over a long run the way a bulk memcpy's would be. Read it as offsets off
    ;; one base and bump $ip once.
    (local.set $tp (global.get $ip))
    (global.set $ip (i32.add (local.get $tp) (i32.const 56)))
    (local.set $src_reg    (i32.load          (local.get $tp)))
    (local.set $src_stride (i32.load offset=4  (local.get $tp)))
    (local.set $src_disp   (i32.load offset=8  (local.get $tp)))
    (local.set $dst_reg    (i32.load offset=12 (local.get $tp)))
    (local.set $dst_stride (i32.load offset=16 (local.get $tp)))
    (local.set $dst_disp   (i32.load offset=20 (local.get $tp)))
    (local.set $byte_reg   (i32.load offset=24 (local.get $tp)))
    (local.set $ctr_kind   (i32.load offset=28 (local.get $tp)))
    (local.set $ctr_loc    (i32.load offset=32 (local.get $tp)))
    (local.set $ctr_disp   (i32.load offset=36 (local.get $tp)))
    (local.set $ctr_step   (i32.load offset=40 (local.get $tp)))
    (local.set $fall       (i32.load offset=44 (local.get $tp)))
    (local.set $back       (i32.load offset=48 (local.get $tp)))
    (local.set $cost       (i32.load offset=52 (local.get $tp)))

    (local.set $src (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $src_reg) (i32.const 2)))))
    (local.set $dst (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $dst_reg) (i32.const 2)))))
    (if (i32.eq (local.get $ctr_kind) (i32.const 2))
      (then
        (local.set $round_quantum (local.get $ctr_disp))
        (local.set $bound (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $ctr_loc) (i32.const 2)))))
        ;; The original is do-while. At/above the bound it still performs one
        ;; element; below it, round the unsigned distance up to a whole element.
        ;; A near-4GB distance would overflow the round-up, so keep the safe
        ;; one-element progress form for that nonsensical mapping.
        (if (i32.and
              (i32.lt_u (local.get $dst) (local.get $bound))
              (i32.le_u (i32.sub (local.get $bound) (local.get $dst))
                        (i32.sub (i32.const -1)
                          (i32.sub (local.get $round_quantum) (i32.const 1)))))
          (then
            (local.set $ctr
              (i32.mul
                (i32.div_u
                  (i32.add (i32.sub (local.get $bound) (local.get $dst))
                    (i32.sub (local.get $round_quantum) (i32.const 1)))
                  (local.get $round_quantum))
                (local.get $round_quantum))))
          (else (local.set $ctr (local.get $round_quantum))))

        ;; Budget only at complete guest-element boundaries. The suffix owns
        ;; the final scratch/CMP/Jcc, so reserve its three threaded ops in the
        ;; accounting performed at exit below.
        (local.set $allowed
          (i32.div_u
            (i32.add
              (select (global.get $steps) (i32.const 0)
                (i32.gt_s (global.get $steps) (i32.const 0)))
              (i32.sub (local.get $cost) (i32.const 1)))
            (local.get $cost)))
        (if (i32.eqz (local.get $allowed))
          (then (local.set $allowed (i32.const 1))))
        (local.set $private_limit
          (i32.mul (local.get $allowed) (local.get $round_quantum)))
        (if (i32.gt_u (local.get $private_limit) (local.get $ctr))
          (then (local.set $private_limit (local.get $ctr))))

        ;; Byte-forward copy and dword-forward copy disagree for sub-dword
        ;; overlap. Use the shared byte kernel only for proved-disjoint spans;
        ;; the overlapping arm below executes one original-width load/store.
        (local.set $src_ga (i32.add (local.get $src) (local.get $src_disp)))
        (local.set $dst_ga (i32.add (local.get $dst) (local.get $dst_disp)))
        (local.set $src_end (i32.add (local.get $src_ga) (local.get $ctr)))
        (local.set $dst_end (i32.add (local.get $dst_ga) (local.get $ctr)))
        (local.set $copy32_overlap
          (i32.or
            (i32.or (i32.lt_u (local.get $src_end) (local.get $src_ga))
                    (i32.lt_u (local.get $dst_end) (local.get $dst_ga)))
            (i32.and (i32.lt_u (local.get $src_ga) (local.get $dst_end))
                     (i32.lt_u (local.get $dst_ga) (local.get $src_end)))))
        (global.set $loop_copy32_runs
          (i32.add (global.get $loop_copy32_runs) (i32.const 1))))
      (else (if (i32.eq (local.get $ctr_kind) (i32.const 1))
        (then
        (local.set $ctr_addr
          (i32.add (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $ctr_loc) (i32.const 2)))) (local.get $ctr_disp)))
        (local.set $ctr (call $gl32 (local.get $ctr_addr))))
        (else (local.set $ctr (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $ctr_loc) (i32.const 2)))))))))

    ;; A memory counter has to be written back per iteration in general: the
    ;; destination range is allowed to cover the counter's own address, and a
    ;; deferred write would then lose whatever the copy put there. But that is
    ;; a pathological shape, and it is cheap to rule out here, where the run
    ;; length is known: at most $ctr bytes starting at the destination cursor.
    ;; When the counter sits outside that span, write it once at exit.
    (local.set $store_ctr
      (select (i32.const 1) (i32.const 0)
        (i32.eq (local.get $ctr_kind) (i32.const 1))))
    (if (i32.and (i32.eq (local.get $ctr_kind) (i32.const 1))
                 (i32.and (i32.eq (local.get $ctr_step) (i32.const -1))
                          (i32.gt_s (local.get $ctr) (i32.const 0))))
      (then
        (local.set $lo (i32.add (local.get $dst) (local.get $dst_disp)))
        (local.set $hi (local.get $lo))
        (if (i32.eq (local.get $dst_stride) (i32.const 1))
          (then (local.set $hi (i32.add (local.get $lo)
                  (i32.sub (local.get $ctr) (i32.const 1)))))
          (else (local.set $lo (i32.sub (local.get $hi)
                  (i32.sub (local.get $ctr) (i32.const 1))))))
        ;; An address range that wrapped tells us nothing; leave it per-iteration.
        (if (i32.le_u (local.get $lo) (local.get $hi))
          (then
            (if (i32.or
                  (i32.lt_u (i32.add (local.get $ctr_addr) (i32.const 3)) (local.get $lo))
                  (i32.gt_u (local.get $ctr_addr) (local.get $hi)))
              (then (local.set $store_ctr (i32.const 0))))))))

    ;; The run is copied a page-chunk at a time rather than a byte at a time.
    ;; Per byte, $gl8 was a call plus a page-cache probe and $gs8 was a call
    ;; plus a full $g2w plus a code-page test; none of that can change inside a
    ;; chunk. Guest mappings are only created by API calls (VirtualAlloc, file
    ;; mapping, DLL load), no guest code runs while this handler is on the
    ;; stack, and map records are append-only -- so a translation resolved at
    ;; chunk entry stays valid for the whole chunk. What is left in the inner
    ;; loop is two raw accesses and two pointer bumps.
    (block $exit
      (loop $outer
        (local.set $src_ga (i32.add (local.get $src) (local.get $src_disp)))
        (local.set $dst_ga (i32.add (local.get $dst) (local.get $dst_disp)))

        ;; Iterations left before the counter reaches zero. The loop is
        ;; do-while, so a counter that is already zero runs the whole wrap.
        (local.set $trips
          (select (local.get $ctr)
                  (i32.sub (i32.const 0) (local.get $ctr))
                  (i32.eq (local.get $ctr_step) (i32.const -1))))
        (if (i32.eqz (local.get $trips))
          (then (local.set $trips (i32.const -1))))

        ;; Iterations the step budget still pays for. The original exits after
        ;; the first iteration that drives $steps to zero or below, so this is
        ;; a ceiling, and a budget already spent still buys one iteration.
        (if (i32.eq (local.get $ctr_kind) (i32.const 2))
          (then
            (local.set $allowed
              (i32.sub (local.get $private_limit) (local.get $private_bytes))))
          (else
            (local.set $allowed
              (i32.div_u
                (i32.add
                  (select (global.get $steps) (i32.const 0)
                          (i32.gt_s (global.get $steps) (i32.const 0)))
                  (i32.sub (local.get $cost) (i32.const 1)))
                (local.get $cost)))
            (if (i32.eqz (local.get $allowed))
              (then (local.set $allowed (i32.const 1))))))

        (local.set $chunk
          (select (local.get $trips) (local.get $allowed)
                  (i32.lt_u (local.get $trips) (local.get $allowed))))
        (local.set $n (call $copy_page_room (local.get $src_ga) (local.get $src_stride)))
        (local.set $chunk
          (select (local.get $n) (local.get $chunk)
                  (i32.lt_u (local.get $n) (local.get $chunk))))
        (local.set $n (call $copy_page_room (local.get $dst_ga) (local.get $dst_stride)))
        (local.set $chunk
          (select (local.get $n) (local.get $chunk)
                  (i32.lt_u (local.get $n) (local.get $chunk))))
        (if (i32.ne (local.get $ctr_kind) (i32.const 2))
          (then (local.set $chunk (call $bc_fold_cap (local.get $chunk) (local.get $bc_done)))))

        (local.set $src_wa (call $g2w (local.get $src_ga)))
        (local.set $dst_wa (call $g2w (local.get $dst_ga)))
        ;; An unmapped cursor resolves to the four-byte null sentinel, which is
        ;; not a page and must never be walked; and a counter that has to be
        ;; published every step has no chunked form. One iteration per chunk is
        ;; exactly the old per-byte behaviour in both cases.
        (if (i32.or
              (i32.ne (local.get $store_ctr) (i32.const 0))
              (i32.or
                (i32.eq (local.get $src_wa) (global.get $NULL_SENTINEL))
                (i32.eq (local.get $dst_wa) (global.get $NULL_SENTINEL))))
          (then (local.set $chunk (i32.const 1))))

        ;; One code-page test for the whole chunk. The chunk cannot leave the
        ;; destination page and nothing executes between its first and last
        ;; store, so invalidating up front is what invalidating per byte did.
        ;;
        ;; The destination stride can be negative and larger than one byte, so
        ;; the exact extent is not simply [dst_ga, dst_ga+chunk). Since the
        ;; chunk is known to stay inside one page, name the page instead: that
        ;; is what this call has always meant, and $invalidate_code_range turns
        ;; a span this wide into the page drop the old $invalidate_page did.
        (if (i32.and
              (i32.eq (local.get $ctr_kind) (i32.const 2))
              (i32.or (local.get $copy32_overlap)
                (i32.or
                  (i32.eq (local.get $src_wa) (global.get $NULL_SENTINEL))
                  (i32.eq (local.get $dst_wa) (global.get $NULL_SENTINEL)))))
          (then
            ;; Preserve the original load-before-store width on overlap and
            ;; on the unmapped four-byte sentinel. This arm completes exactly
            ;; one guest iteration even when either dword crosses a page.
            (local.set $chunk (local.get $round_quantum))
            (local.set $b (call $gl32 (local.get $src_ga)))
            (call $gs32 (local.get $dst_ga) (local.get $b)))
          (else
            (call $invalidate_code_write
              (i32.and (local.get $dst_ga) (i32.const 0xFFFFF000)) (i32.const 4096))

            (local.set $n (local.get $chunk))
            (loop $inner
              (local.set $b (i32.load8_u (local.get $src_wa)))
              (i32.store8 (local.get $dst_wa) (local.get $b))
              (local.set $src_wa (i32.add (local.get $src_wa) (local.get $src_stride)))
              (local.set $dst_wa (i32.add (local.get $dst_wa) (local.get $dst_stride)))
              (local.set $n (i32.sub (local.get $n) (i32.const 1)))
              (br_if $inner (local.get $n)))))

        (local.set $src
          (i32.add (local.get $src) (i32.mul (local.get $chunk) (local.get $src_stride))))
        (local.set $dst
          (i32.add (local.get $dst) (i32.mul (local.get $chunk) (local.get $dst_stride))))
        (local.set $ctr
          (i32.add (local.get $ctr) (i32.mul (local.get $chunk) (local.get $ctr_step))))
        ;; The flags the terminator reads belong to the last iteration only.
        (local.set $old (i32.sub (local.get $ctr) (local.get $ctr_step)))
        (if (local.get $store_ctr)
          (then (call $gs32 (local.get $ctr_addr) (local.get $ctr))))
        (if (i32.eq (local.get $ctr_kind) (i32.const 2))
          (then
            (local.set $private_bytes
              (i32.add (local.get $private_bytes) (local.get $chunk))))
          (else
            (local.set $bc_done (i32.add (local.get $bc_done) (local.get $chunk)))
            (global.set $steps
              (i32.sub (global.get $steps)
                (i32.mul (local.get $chunk) (local.get $cost))))))
        (br_if $exit (i32.eqz (local.get $ctr)))
        (if (i32.eq (local.get $ctr_kind) (i32.const 2))
          (then
            (br_if $exit
              (i32.ge_u (local.get $private_bytes) (local.get $private_limit))))
          (else
            (br_if $exit (i32.eqz (call $bc_fold_cap (i32.const 1) (local.get $bc_done))))
            (br_if $exit (i32.le_s (global.get $steps) (i32.const 0)))))
        (br $outer)))

    (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $src_reg) (i32.const 2))) (local.get $src))
    (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $dst_reg) (i32.const 2))) (local.get $dst))
    (if (i32.ge_s (local.get $byte_reg) (i32.const 0))
      (then (call $set_reg8 (local.get $byte_reg) (local.get $b))))
    (if (i32.eqz (local.get $ctr_kind))
      (then (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $ctr_loc) (i32.const 2))) (local.get $ctr)))
      (else (if (i32.and
                  (i32.eq (local.get $ctr_kind) (i32.const 1))
                  (i32.eqz (local.get $store_ctr)))
        (then (call $gs32 (local.get $ctr_addr) (local.get $ctr))))))
    (if (i32.eq (local.get $ctr_kind) (i32.const 2))
      (then
        (global.set $loop_copy32_bytes
          (i64.add (global.get $loop_copy32_bytes)
            (i64.extend_i32_u (local.get $private_bytes))))
        (local.set $private_groups
          (i32.div_u (local.get $private_bytes) (local.get $round_quantum)))
        ;; $next already charged H419 and will charge the retained scratch
        ;; load, CMP and Jcc. Charge the remaining original ops for N complete
        ;; six-op guest iterations, then account for the N-1 folded backedges.
        (if (i32.gt_u
              (i32.mul (local.get $private_groups) (local.get $cost))
              (i32.const 4))
          (then
            (global.set $steps
              (i32.sub (global.get $steps)
                (i32.sub
                  (i32.mul (local.get $private_groups) (local.get $cost))
                  (i32.const 4))))))
        (if (i32.gt_u (local.get $private_groups) (i32.const 1))
          (then
            (global.set $block_budget
              (i32.sub (global.get $block_budget)
                (i32.sub (local.get $private_groups) (i32.const 1))))))
        (dispatch-next)))
    (if (i32.eq (local.get $ctr_step) (i32.const -1))
      (then (call $set_flags_dec (local.get $old) (local.get $ctr)))
      (else (call $set_flags_inc (local.get $old) (local.get $ctr))))
    (call $bc_fold_charge (local.get $bc_done))
    (global.set $eip
      (select (local.get $back) (local.get $fall) (i32.ne (local.get $ctr) (i32.const 0)))))

  ;; ------------------------------------------------------------------
  ;; 435: PACKED_AVG_RUN
  ;; ------------------------------------------------------------------
  ;; Collapse every iteration before the final one, then continue into an
  ;; ordinary copy of the complete final guest iteration. That suffix owns all
  ;; architectural scratch registers and flags; this handler only publishes
  ;; stream cursors and the induction register at a guest-iteration boundary.
  ;;
  ;; op selects the arithmetic:
  ;;   0 WIDE_ADD_SHIFT:     u32((u64(a&mask) + u64(b&mask)) >> 1)
  ;;   1 SHIFT_MASK_ADD:     ((a>>1)&mask) + ((b>>1)&mask)
  ;;   2 SHIFT_MASK_ADD_LSB: mode 1 + (a&b&round_mask)
  ;;
  ;; Descriptor words:
  ;;   0 mask  1 round_mask
  ;;   2..6   src A: base_reg,index_reg(-1 none),scale,disp,base_step
  ;;   7..11  src B: base_reg,index_reg(-1 none),scale,disp,base_step
  ;;   12..16 dst:   base_reg,index_reg(-1 none),scale,disp,base_step
  ;;   17 induction_reg  18 induction_step
  ;;   19 termination (0 count-down/JNZ leaves 1, 1 signed-index/JGE leaves 0)
  ;;   20 original handlers per iteration
  (global $LOOP_SUPEROP_AVG i32 (i32.const 435))

  (func $packed_avg_addr
    (param $base i32) (param $index_reg i32) (param $ind_reg i32)
    (param $ind i32) (param $scale i32) (param $disp i32) (result i32)
    (local $index i32)
    (if (i32.ge_s (local.get $index_reg) (i32.const 0))
      (then
        (local.set $index
          (select (local.get $ind) (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $index_reg) (i32.const 2))))
            (i32.eq (local.get $index_reg) (local.get $ind_reg))))))
    (i32.add (i32.add (local.get $base)
      (i32.shl (local.get $index) (local.get $scale))) (local.get $disp)))

  (func $th_packed_avg_run (param $mode i32)
     (local $nx_fn i32) (local $nx_op i32) (local $mask i32) (local $round_mask i32)
    (local $a_base_reg i32) (local $a_index i32) (local $a_scale i32)
    (local $a_disp i32) (local $a_step i32) (local $a_base i32)
    (local $b_base_reg i32) (local $b_index i32) (local $b_scale i32)
    (local $b_disp i32) (local $b_step i32) (local $b_base i32)
    (local $d_base_reg i32) (local $d_index i32) (local $d_scale i32)
    (local $d_disp i32) (local $d_step i32) (local $d_base i32)
    (local $ind_reg i32) (local $ind_step i32) (local $term i32)
    (local $cost i32) (local $ind i32) (local $remaining i32)
    (local $allowed i32) (local $n i32) (local $done i32)
    (local $a i32) (local $b i32) (local $v i32) (local $sum i64)

    (local.set $mask (read-thread-word))
    (local.set $round_mask (read-thread-word))
    (local.set $a_base_reg (read-thread-word))
    (local.set $a_index (read-thread-word))
    (local.set $a_scale (read-thread-word))
    (local.set $a_disp (read-thread-word))
    (local.set $a_step (read-thread-word))
    (local.set $b_base_reg (read-thread-word))
    (local.set $b_index (read-thread-word))
    (local.set $b_scale (read-thread-word))
    (local.set $b_disp (read-thread-word))
    (local.set $b_step (read-thread-word))
    (local.set $d_base_reg (read-thread-word))
    (local.set $d_index (read-thread-word))
    (local.set $d_scale (read-thread-word))
    (local.set $d_disp (read-thread-word))
    (local.set $d_step (read-thread-word))
    (local.set $ind_reg (read-thread-word))
    (local.set $ind_step (read-thread-word))
    (local.set $term (read-thread-word))
    (local.set $cost (read-thread-word))

    (local.set $a_base (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $a_base_reg) (i32.const 2)))))
    (local.set $b_base (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $b_base_reg) (i32.const 2)))))
    (local.set $d_base (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $d_base_reg) (i32.const 2)))))
    (local.set $ind (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $ind_reg) (i32.const 2)))))
    ;; The suffix executes one original iteration. Fold only the iterations
    ;; before it, so a zero/negative do-while entry naturally stays ordinary.
    (if (local.get $term)
      (then
        (if (i32.gt_s (local.get $ind) (i32.const 0))
          (then (local.set $remaining (local.get $ind)))))
      (else
        (if (i32.gt_u (local.get $ind) (i32.const 1))
          (then (local.set $remaining (i32.sub (local.get $ind) (i32.const 1)))))))

    (local.set $allowed
      (i32.div_u
        (i32.add
          (select (global.get $steps) (i32.const 0)
            (i32.gt_s (global.get $steps) (i32.const 0)))
          (i32.sub (local.get $cost) (i32.const 1)))
        (local.get $cost)))
    (local.set $n
      (select (local.get $remaining) (local.get $allowed)
        (i32.lt_u (local.get $remaining) (local.get $allowed))))
    (local.set $done (local.get $n))

    (block $finished
      (loop $pixels
        (br_if $finished (i32.eqz (local.get $done)))
        ;; Preserve the guest's load-A, load-B, store order for overlap.
        (local.set $a (call $gl32 (call $packed_avg_addr
          (local.get $a_base) (local.get $a_index) (local.get $ind_reg)
          (local.get $ind) (local.get $a_scale) (local.get $a_disp))))
        (local.set $b (call $gl32 (call $packed_avg_addr
          (local.get $b_base) (local.get $b_index) (local.get $ind_reg)
          (local.get $ind) (local.get $b_scale) (local.get $b_disp))))
        (if (i32.eqz (local.get $mode))
          (then
            (local.set $sum
              (i64.add
                (i64.extend_i32_u (i32.and (local.get $a) (local.get $mask)))
                (i64.extend_i32_u (i32.and (local.get $b) (local.get $mask)))))
            (local.set $v
              (i32.wrap_i64 (i64.shr_u (local.get $sum) (i64.const 1)))))
          (else
            (local.set $v
              (i32.add
                (i32.and (i32.shr_u (local.get $a) (i32.const 1)) (local.get $mask))
                (i32.and (i32.shr_u (local.get $b) (i32.const 1)) (local.get $mask))))
            (if (i32.eq (local.get $mode) (i32.const 2))
              (then (local.set $v (i32.add (local.get $v)
                (i32.and (i32.and (local.get $a) (local.get $b))
                  (local.get $round_mask))))))))
        (call $gs32 (call $packed_avg_addr
          (local.get $d_base) (local.get $d_index) (local.get $ind_reg)
          (local.get $ind) (local.get $d_scale) (local.get $d_disp)) (local.get $v))

        (local.set $a_base (i32.add (local.get $a_base) (local.get $a_step)))
        (local.set $b_base (i32.add (local.get $b_base) (local.get $b_step)))
        (local.set $d_base (i32.add (local.get $d_base) (local.get $d_step)))
        (local.set $ind (i32.add (local.get $ind) (local.get $ind_step)))
        (local.set $done (i32.sub (local.get $done) (i32.const 1)))
        (br $pixels)))

    (if (local.get $n)
      (then
        (if (local.get $a_step)
          (then (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $a_base_reg) (i32.const 2))) (local.get $a_base))))
        (if (local.get $b_step)
          (then (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $b_base_reg) (i32.const 2))) (local.get $b_base))))
        (if (local.get $d_step)
          (then (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $d_base_reg) (i32.const 2))) (local.get $d_base))))
        (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $ind_reg) (i32.const 2))) (local.get $ind))))
    (global.set $loop_avg_runs
      (i32.add (global.get $loop_avg_runs) (i32.const 1)))
    (global.set $loop_avg_pixels
      (i64.add (global.get $loop_avg_pixels) (i64.extend_i32_u (local.get $n))))
    ;; H435 and the ordinary suffix are charged automatically. Replace H435's
    ;; extra charge with the cost of the N folded guest iterations.
    (global.set $steps
      (i32.sub (global.get $steps)
        (i32.sub (i32.mul (local.get $n) (local.get $cost)) (i32.const 1))))
    (global.set $block_budget
      (i32.sub (global.get $block_budget) (local.get $n)))
    (dispatch-next))

  ;; Called from $decode_block just before $cache_store.
  (func $loop_match_block (param $start_eip i32) (param $tstart i32)
    (if (global.get $op_index_poison) (then (return)))
    (if (call $region_try_install (local.get $start_eip) (local.get $tstart))
      (then (return)))
    ;; The Diablo row head includes MOV ECX,imm before a branch-to-interior
    ;; LOOP. It is not a block-entry self-loop, so its exact-byte proof must run
    ;; before the generic self-loop gate.
    (if (call $loop_try_xlat_stosb (local.get $start_eip) (local.get $tstart))
      (then (return)))
    (if (i32.eqz (call $loop_is_selfloop (local.get $start_eip))) (then (return)))
    (global.set $loop_selfloop_blocks
      (i32.add (global.get $loop_selfloop_blocks) (i32.const 1)))
    (if (global.get $loop_trace)
      (then
        (if (i32.or (i32.eqz (global.get $loop_trace_eip))
                    (i32.eq (global.get $loop_trace_eip) (local.get $start_eip)))
          (then (call $loop_trace_block (local.get $start_eip))))))
    ;; Ordered cheapest-to-decline first; the predicates are disjoint (LUT_RUN
    ;; requires an indexed load and a zeroing op, COPY_RUN forbids both), so
    ;; the order is a cost choice, not a precedence one.
    (if (call $loop_try_aoe_grid_fill (local.get $start_eip) (local.get $tstart))
      (then (return)))
    (if (call $loop_try_lut (local.get $start_eip) (local.get $tstart)) (then (return)))
    (if (call $loop_try_lut_bounded (local.get $start_eip) (local.get $tstart)) (then (return)))
    (if (call $loop_try_lut_blend_bounded (local.get $start_eip) (local.get $tstart))
      (then (return)))
    (if (call $loop_try_avg_wide_indexed (local.get $start_eip) (local.get $tstart))
      (then (return)))
    (if (call $loop_try_avg_shift_cursor (local.get $start_eip) (local.get $tstart))
      (then (return)))
    (if (call $loop_try_avg_round_cursor (local.get $start_eip) (local.get $tstart))
      (then (return)))
    (if (call $loop_try_copy32_bounded (local.get $start_eip) (local.get $tstart))
      (then (return)))
    (if (call $loop_try_copy (local.get $start_eip) (local.get $tstart))
      (then (return)))
    ;; TREE_FOLD is deliberately LAST. Every family above proves one exact
    ;; idiom and executes it with semantics written for that idiom; this one
    ;; is a general interpreter over whatever dataflow the block contains, so
    ;; it is strictly the weaker lowering wherever an exact family also
    ;; matches. Trying it last means it can only ever claim blocks nothing
    ;; else wanted, and adding it can never change what an existing fold does.
    (drop (call $loop_try_tree_fold (local.get $start_eip) (local.get $tstart))))

  ;; ------------------------------------------------------------------
  ;; 437: AoE byte-grid FILL_RUN
  ;; ------------------------------------------------------------------
  ;; AoE I/II clear rectangular pathfinding grids with this exact six-op
  ;; self-loop (AoE II 0x005def8e):
  ;;
  ;;   mov edi,[esi+0x408] / inc eax / cmp eax,edx
  ;;   mov edi,[edi+ecx*4] / mov byte [edi+eax-1],0xff / jl ^
  ;;
  ;; Prove the complete emitted form, including both SIB descriptors, rather
  ;; than keying the core on one game's EIP. A near miss remains ordinary x86.
  (func $loop_try_aoe_grid_fill
    (param $start_eip i32) (param $tstart i32) (result i32)
    (local $p i32) (local $fall i32) (local $back i32)

    (if (i32.ne (global.get $op_index_n) (i32.const 6))
      (then (return (i32.const 0))))

    (local.set $p (call $loop_op_at (i32.const 0)))
    (if (i32.or
          (i32.ne (load.field LoopOp handler (local.get $p)) (i32.const 345))
          (i32.or
            (i32.ne (load.field.memarg LoopOp operand (local.get $p)) (i32.const 7))
            (i32.ne (i32.load offset=8 (local.get $p)) (i32.const 0x408))))
      (then (return (i32.const 0))))

    (local.set $p (call $loop_op_at (i32.const 1)))
    (if (i32.or
          (i32.ne (load.field LoopOp handler (local.get $p)) (i32.const 64))
          (i32.ne (load.field.memarg LoopOp operand (local.get $p)) (i32.const 0)))
      (then (return (i32.const 0))))

    (local.set $p (call $loop_op_at (i32.const 2)))
    (if (i32.or
          (i32.ne (load.field LoopOp handler (local.get $p)) (i32.const 19))
          (i32.ne (load.field.memarg LoopOp operand (local.get $p)) (i32.const 2)))
      (then (return (i32.const 0))))

    (local.set $p (call $loop_op_at (i32.const 3)))
    (if (i32.or
          (i32.ne (load.field LoopOp handler (local.get $p)) (i32.const 389))
          (i32.or
            (i32.ne (load.field.memarg LoopOp operand (local.get $p)) (i32.const 7))
            (i32.or
              (i32.ne (i32.load offset=8 (local.get $p)) (i32.const 0x217))
              (i32.ne (i32.load offset=12 (local.get $p)) (i32.const 0)))))
      (then (return (i32.const 0))))

    (local.set $p (call $loop_op_at (i32.const 4)))
    (if (i32.or
          (i32.ne (load.field LoopOp handler (local.get $p)) (i32.const 402))
          (i32.or
            (i32.ne (load.field.memarg LoopOp operand (local.get $p)) (i32.const 0xff))
            (i32.or
              (i32.ne (i32.load offset=8 (local.get $p)) (i32.const 7))
              (i32.ne (i32.load offset=12 (local.get $p)) (i32.const -1)))))
      (then (return (i32.const 0))))

    (local.set $p (call $loop_op_at (i32.const 5)))
    (if (i32.ne (load.field LoopOp handler (local.get $p)) (i32.const 319))
      (then (return (i32.const 0))))
    (local.set $fall (i32.load offset=8 (local.get $p)))
    (local.set $back (i32.load offset=12 (local.get $p)))
    (if (i32.ne (local.get $back) (local.get $start_eip))
      (then (return (i32.const 0))))

    (global.set $loop_aoe_fill_matches
      (i32.add (global.get $loop_aoe_fill_matches) (i32.const 1)))
    (if (i32.eqz (global.get $loop_aoe_fill_emit_enabled))
      (then (return (i32.const 0))))

    (global.set $loop_matched_blocks
      (i32.add (global.get $loop_matched_blocks) (i32.const 1)))
    (global.set $thread_alloc (local.get $tstart))
    (global.set $op_index_n (i32.const 0))
    (call $te (i32.const 437) (i32.const 0))
    (call $te_raw (local.get $fall))
    (call $te_raw (local.get $back))
    (i32.const 1))

  (func $th_aoe_grid_fill (param $op i32)
    (local $tp i32) (local $fall i32) (local $back i32)
    (local $old i32) (local $end i32) (local $next_index i32)
    (local $total i32) (local $n i32) (local $allowed i32)
    (local $table i32) (local $entry i32) (local $row i32)
    (local $dst i32) (local $wa i32) (local $fast i32)

    (local.set $tp (global.get $ip))
    (global.set $ip (i32.add (local.get $tp) (i32.const 8)))
    (local.set $fall (i32.load (local.get $tp)))
    (local.set $back (i32.load offset=4 (local.get $tp)))
    (local.set $old (i32.load offset=0 (global.get $reg_base)))
    (local.set $end (i32.load offset=8 (global.get $reg_base)))

    ;; The original is do-while. The bulk proof only covers the normal
    ;; monotonic interval; wrapped or reversed inputs execute the same six
    ;; operations below one iteration at a time.
    (local.set $total (i32.const 1))
    (if (i32.lt_s (local.get $old) (local.get $end))
      (then (local.set $total (i32.sub (local.get $end) (local.get $old)))))

    ;; Stop at the same guest-instruction and block budgets as the six-handler
    ;; loop. $next already charged H437 itself, hence cost-1 in this allowance.
    (local.set $allowed
      (i32.div_u
        (i32.add
          (select (global.get $steps) (i32.const 0)
            (i32.gt_s (global.get $steps) (i32.const 0)))
          (i32.const 5))
        (i32.const 6)))
    (if (i32.eqz (local.get $allowed))
      (then (local.set $allowed (i32.const 1))))
    (local.set $n
      (select (local.get $total) (local.get $allowed)
        (i32.lt_u (local.get $total) (local.get $allowed))))
    (local.set $allowed
      (select (i32.add (global.get $block_budget) (i32.const 1)) (i32.const 1)
        (i32.gt_s (global.get $block_budget) (i32.const 0))))
    (if (i32.gt_u (local.get $n) (local.get $allowed))
      (then (local.set $n (local.get $allowed))))

    (local.set $table (call $gl32 (i32.add (i32.load offset=24 (global.get $reg_base)) (i32.const 0x408))))
    (local.set $entry
      (i32.add (local.get $table) (i32.shl (i32.load offset=4 (global.get $reg_base)) (i32.const 2))))
    (local.set $row (call $gl32 (local.get $entry)))
    (local.set $dst (i32.add (local.get $row) (local.get $old)))
    (local.set $wa (call $g2w_affine_span (local.get $dst) (local.get $n)))

    ;; Reloading the two pointers every original iteration is observable only
    ;; if the fill overwrites either pointer. Decline the bulk arm in that rare
    ;; alias case; the internal loop below retains the reload order exactly.
    (local.set $fast
      (i32.and
        (i32.lt_s (local.get $old) (local.get $end))
        (i32.and
          (i32.ne (local.get $wa) (global.get $NULL_SENTINEL))
          (i32.and
            (i32.or
              (i32.le_u (i32.add (local.get $dst) (local.get $n))
                        (i32.add (i32.load offset=24 (global.get $reg_base)) (i32.const 0x408)))
              (i32.ge_u (local.get $dst)
                        (i32.add (i32.load offset=24 (global.get $reg_base)) (i32.const 0x40c))))
            (i32.or
              (i32.le_u (i32.add (local.get $dst) (local.get $n)) (local.get $entry))
              (i32.ge_u (local.get $dst) (i32.add (local.get $entry) (i32.const 4))))))))

    (if (local.get $fast)
      (then
        (call $invalidate_code_write (local.get $dst) (local.get $n))
        (memory.fill (local.get $wa) (i32.const 0xff) (local.get $n))
        (local.set $next_index (i32.add (local.get $old) (local.get $n)))
        (i32.store offset=0 (global.get $reg_base) (local.get $next_index))
        (i32.store offset=28 (global.get $reg_base) (local.get $row))
        (call $set_flags_sub
          (local.get $next_index) (local.get $end)
          (i32.sub (local.get $next_index) (local.get $end))))
      (else
        (local.set $allowed (local.get $n))
        (loop $slow
          (local.set $table
            (call $gl32 (i32.add (i32.load offset=24 (global.get $reg_base)) (i32.const 0x408))))
          (local.set $next_index (i32.add (i32.load offset=0 (global.get $reg_base)) (i32.const 1)))
          (call $set_flags_sub
            (local.get $next_index) (local.get $end)
            (i32.sub (local.get $next_index) (local.get $end)))
          (local.set $row
            (call $gl32
              (i32.add (local.get $table) (i32.shl (i32.load offset=4 (global.get $reg_base)) (i32.const 2)))))
          (i32.store offset=28 (global.get $reg_base) (local.get $row))
          (call $gs8 (i32.add (local.get $row) (i32.load offset=0 (global.get $reg_base))) (i32.const 0xff))
          (i32.store offset=0 (global.get $reg_base) (local.get $next_index))
          (local.set $allowed (i32.sub (local.get $allowed) (i32.const 1)))
          (br_if $slow (local.get $allowed)))))

    (global.set $steps
      (i32.sub (global.get $steps)
        (i32.sub (i32.mul (local.get $n) (i32.const 6)) (i32.const 1))))
    (if (i32.gt_u (local.get $n) (i32.const 1))
      (then
        (global.set $block_budget
          (i32.sub (global.get $block_budget)
            (i32.sub (local.get $n) (i32.const 1))))))
    (global.set $loop_aoe_fill_runs
      (i32.add (global.get $loop_aoe_fill_runs) (i32.const 1)))
    (global.set $loop_aoe_fill_bytes
      (i64.add (global.get $loop_aoe_fill_bytes) (i64.extend_i32_u (local.get $n))))
    (global.set $eip
      (select (local.get $back) (local.get $fall)
        (i32.lt_s (i32.load offset=0 (global.get $reg_base)) (local.get $end))))
    (return_call $branch_end))

  ;; 438: one span-prefix executor for both AoE builds. `op` selects only the
  ;; compiler register allocation: 1 = AoE I, 2 = AoE II. The clipping and
  ;; row-table algorithm, structure offsets, stack layout, and safety boundary
  ;; are shared.
  (func $th_aoe_span_prefix (param $op i32)
    (local $tp i32) (local $start i32) (local $reject_off i32)
    (local $old_esp i32) (local $esp_wa i32)
    (local $this i32) (local $this_wa i32)
    (local $row i32) (local $x0 i32) (local $x1 i32) (local $swap i32)
    (local $min_row i32) (local $max_row i32)
    (local $min_x i32) (local $max_x i32)
    (local $row_base i32) (local $row_head i32) (local $cost i32)

    (global.set $loop_aoe_span_runs
      (i32.add (global.get $loop_aoe_span_runs) (i32.const 1)))
    (local.set $tp (global.get $ip))
    (global.set $ip (i32.add (local.get $tp) (i32.const 4)))
    (local.set $start (i32.load (local.get $tp)))
    (local.set $reject_off
      (select (i32.const 0x38d) (i32.const 0x3b4)
        (i32.eq (local.get $op) (i32.const 1))))

    ;; push ebx/ebp/esi; mov esi,ecx; push edi; mov edi,[esp+1c]
    (local.set $cost (i32.const 6))
    (local.set $old_esp (i32.load offset=16 (global.get $reg_base)))
    (local.set $esp_wa (call $g2w (i32.sub (local.get $old_esp) (i32.const 16))))
    (i32.store offset=12 (local.get $esp_wa) (i32.load offset=12 (global.get $reg_base)))
    (i32.store offset=8 (local.get $esp_wa) (i32.load offset=20 (global.get $reg_base)))
    (i32.store offset=4 (local.get $esp_wa) (i32.load offset=24 (global.get $reg_base)))
    (i32.store (local.get $esp_wa) (i32.load offset=28 (global.get $reg_base)))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (local.get $old_esp) (i32.const 16)))
    (local.set $this (i32.load offset=4 (global.get $reg_base)))
    (local.set $this_wa (call $g2w (local.get $this)))
    (i32.store offset=24 (global.get $reg_base) (local.get $this))
    (local.set $row (i32.load offset=28 (local.get $esp_wa)))
    (i32.store offset=28 (global.get $reg_base) (local.get $row))

    (local.set $cost (i32.add (local.get $cost) (i32.const 2)))
    (local.set $min_row (i32.load offset=0x60 (local.get $this_wa)))
    (if (i32.lt_s (local.get $row) (local.get $min_row))
      (then
        (call $set_flags_sub
          (local.get $row) (local.get $min_row)
          (i32.sub (local.get $row) (local.get $min_row)))
        (global.set $steps
          (i32.sub (global.get $steps) (i32.sub (local.get $cost) (i32.const 1))))
        (global.set $eip (i32.add (local.get $start) (local.get $reject_off)))
        (return)))

    (local.set $cost (i32.add (local.get $cost) (i32.const 2)))
    (local.set $max_row (i32.load offset=0x64 (local.get $this_wa)))
    (if (i32.gt_s (local.get $row) (local.get $max_row))
      (then
        (call $set_flags_sub
          (local.get $row) (local.get $max_row)
          (i32.sub (local.get $row) (local.get $max_row)))
        (global.set $steps
          (i32.sub (global.get $steps) (i32.sub (local.get $cost) (i32.const 1))))
        (global.set $eip (i32.add (local.get $start) (local.get $reject_off)))
        (return)))

    (local.set $cost (i32.add (local.get $cost) (i32.const 4)))
    (local.set $x0 (i32.load offset=20 (local.get $esp_wa)))
    (local.set $x1 (i32.load offset=24 (local.get $esp_wa)))
    (if (i32.gt_s (local.get $x0) (local.get $x1))
      (then
        (local.set $cost (i32.add (local.get $cost) (i32.const 4)))
        (i32.store offset=24 (local.get $esp_wa) (local.get $x0))
        (i32.store offset=20 (local.get $esp_wa) (local.get $x1))
        (call $page_watch_write (i32.add (local.get $esp_wa) (i32.const 20)) (i32.const 8))
        (local.set $swap (local.get $x0))
        (local.set $x0 (local.get $x1))
        (local.set $x1 (local.get $swap))))

    (if (i32.eq (local.get $op) (i32.const 1))
      (then
        (i32.store offset=0 (global.get $reg_base) (local.get $x0))
        (i32.store offset=20 (global.get $reg_base) (local.get $x1)))
      (else
        (i32.store offset=12 (global.get $reg_base) (local.get $x0))
        (i32.store offset=20 (global.get $reg_base) (local.get $x1))))

    (local.set $cost (i32.add (local.get $cost) (i32.const 3)))
    (local.set $min_x (i32.load offset=0x58 (local.get $this_wa)))
    (if (i32.eq (local.get $op) (i32.const 1))
      (then (i32.store offset=4 (global.get $reg_base) (local.get $min_x)))
      (else (i32.store offset=0 (global.get $reg_base) (local.get $min_x))))
    (if (i32.lt_s (local.get $x1) (local.get $min_x))
      (then
        (call $set_flags_sub
          (local.get $x1) (local.get $min_x)
          (i32.sub (local.get $x1) (local.get $min_x)))
        (global.set $steps
          (i32.sub (global.get $steps) (i32.sub (local.get $cost) (i32.const 1))))
        (global.set $eip (i32.add (local.get $start) (local.get $reject_off)))
        (return)))

    (local.set $cost (i32.add (local.get $cost) (i32.const 3)))
    (local.set $max_x (i32.load offset=0x5c (local.get $this_wa)))
    (if (i32.eq (local.get $op) (i32.const 1))
      (then (i32.store offset=8 (global.get $reg_base) (local.get $max_x)))
      (else (i32.store offset=4 (global.get $reg_base) (local.get $max_x))))
    (if (i32.gt_s (local.get $x0) (local.get $max_x))
      (then
        (call $set_flags_sub
          (local.get $x0) (local.get $max_x)
          (i32.sub (local.get $x0) (local.get $max_x)))
        (global.set $steps
          (i32.sub (global.get $steps) (i32.sub (local.get $cost) (i32.const 1))))
        (global.set $eip (i32.add (local.get $start) (local.get $reject_off)))
        (return)))

    (local.set $cost (i32.add (local.get $cost) (i32.const 2)))
    (if (i32.lt_s (local.get $x0) (local.get $min_x))
      (then
        (i32.store offset=20 (local.get $esp_wa) (local.get $min_x))
        (call $page_watch_write (i32.add (local.get $esp_wa) (i32.const 20)) (i32.const 4))
        (if (i32.eq (local.get $op) (i32.const 2))
          (then
            (local.set $cost (i32.add (local.get $cost) (i32.const 2)))
            (local.set $x0 (local.get $min_x))
            (i32.store offset=12 (global.get $reg_base) (local.get $x0)))
          (else
            (local.set $cost (i32.add (local.get $cost) (i32.const 1)))))))

    (local.set $cost (i32.add (local.get $cost) (i32.const 2)))
    (if (i32.gt_s (local.get $x1) (local.get $max_x))
      (then
        (local.set $cost (i32.add (local.get $cost) (i32.const 2)))
        (local.set $x1 (local.get $max_x))
        (i32.store offset=24 (local.get $esp_wa) (local.get $x1))
        (call $page_watch_write (i32.add (local.get $esp_wa) (i32.const 24)) (i32.const 4))
        (i32.store offset=20 (global.get $reg_base) (local.get $x1))))

    (local.set $row_base (i32.load offset=0x3c (local.get $this_wa)))
    (if (i32.eq (local.get $op) (i32.const 1))
      (then
        (local.set $cost (i32.add (local.get $cost) (i32.const 5)))
        (local.set $row (i32.shl (local.get $row) (i32.const 2)))
        (i32.store offset=28 (global.get $reg_base) (local.get $row))
        (i32.store offset=0 (global.get $reg_base) (local.get $row_base))
        (local.set $row_head (call $gl32 (i32.add (local.get $row_base) (local.get $row))))
        (i32.store offset=12 (global.get $reg_base) (local.get $row_head)))
      (else
        (local.set $cost (i32.add (local.get $cost) (i32.const 4)))
        (local.set $row_head
          (call $gl32
            (i32.add (local.get $row_base) (i32.shl (local.get $row) (i32.const 2)))))
        (i32.store offset=0 (global.get $reg_base) (local.get $row_head))))
    (call $set_flags_logic (local.get $row_head))
    (global.set $steps
      (i32.sub (global.get $steps) (i32.sub (local.get $cost) (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 1))
      (then
        (if (local.get $row_head)
          (then (global.set $eip (i32.add (local.get $start) (i32.const 0xa7))))
          (else (global.set $eip (i32.add (local.get $start) (i32.const 0x6b))))))
      (else
        (if (local.get $row_head)
          (then (global.set $eip (i32.add (local.get $start) (i32.const 0xaf))))
          (else (global.set $eip (i32.add (local.get $start) (i32.const 0x6a)))))))
    (return_call $branch_end))

  ;; 443: whole 8-bit color-key replacement row. AH is the transparent/key
  ;; byte and AL is its replacement. ESI counts down while EDI advances.
  (func $th_colorkey8_run (param $op i32)
    (local $tp i32) (local $fall i32) (local $back i32)
    (local $ptr i32) (local $count i32) (local $old_count i32)
    (local $old_ptr i32) (local $byte i32) (local $key i32)
    (local $replacement i32) (local $cost i32) (local $iters i32)
    (local.set $tp (global.get $ip))
    (global.set $ip (i32.add (local.get $tp) (i32.const 8)))
    (local.set $fall (i32.load (local.get $tp)))
    (local.set $back (i32.load offset=4 (local.get $tp)))
    (local.set $ptr (i32.load offset=28 (global.get $reg_base)))
    (local.set $count (i32.load offset=24 (global.get $reg_base)))
    (local.set $key
      (i32.and (i32.shr_u (i32.load offset=0 (global.get $reg_base)) (i32.const 8)) (i32.const 0xff)))
    (local.set $replacement (i32.and (i32.load offset=0 (global.get $reg_base)) (i32.const 0xff)))
    (global.set $loop_colorkey8_runs
      (i32.add (global.get $loop_colorkey8_runs) (i32.const 1)))

    ;; Authentic callers supply a positive row width. Preserve the x86
    ;; do-while behavior for zero without attempting an unbounded 2^32-byte
    ;; fold: execute one element and resume at the original loop head.
    (local.set $iters
      (select (local.get $count) (i32.const 1)
        (i32.ne (local.get $count) (i32.const 0))))
    (block $done
      (loop $bytes
        (local.set $old_ptr (local.get $ptr))
        (local.set $old_count (local.get $count))
        (local.set $byte (call $gl8 (local.get $ptr)))
        ;; CMP + JNE + INC + DEC + JNE always execute; the replacement MOV is
        ;; the sixth instruction only when the compare is equal.
        (local.set $cost (i32.add (local.get $cost) (i32.const 5)))
        (if (i32.eq (local.get $byte) (local.get $key))
          (then
            (call $gs8 (local.get $ptr) (local.get $replacement))
            (local.set $cost (i32.add (local.get $cost) (i32.const 1)))))
        (local.set $ptr (i32.add (local.get $ptr) (i32.const 1)))
        (local.set $count (i32.sub (local.get $count) (i32.const 1)))
        (br_if $done (i32.eqz (local.get $count)))
        ;; Zero entered as a wrapped do-while is deliberately one-at-a-time.
        (br_if $done (i32.eq (local.get $iters) (i32.const 1)))
        (br $bytes)))

    ;; Recreate the last iteration's lazy flags exactly. CMP sets byte-width
    ;; carry; INC EDI preserves it; DEC ESI preserves it again and supplies
    ;; the final ZF/SF/OF state consumed by JNE.
    (drop (call $do_alu_sized (i32.const 7) (local.get $byte) (local.get $key)
      (i32.const 0xff) (i32.const 7)))
    (call $set_flags_inc (local.get $old_ptr) (local.get $ptr))
    (call $set_flags_dec (local.get $old_count) (local.get $count))
    (i32.store offset=28 (global.get $reg_base) (local.get $ptr))
    (i32.store offset=24 (global.get $reg_base) (local.get $count))
    (global.set $steps
      (i32.sub (global.get $steps) (i32.sub (local.get $cost) (i32.const 1))))
    ;; Each element enters the compare/JNE block and the induction/JNE block.
    ;; The dispatcher already charged the current H443 block entry.
    (global.set $block_budget
      (i32.sub (global.get $block_budget)
        (i32.sub (i32.mul (local.get $iters) (i32.const 2)) (i32.const 1))))
    (global.set $loop_colorkey8_bytes
      (i64.add (global.get $loop_colorkey8_bytes)
        (i64.extend_i32_u (local.get $iters))))
    (global.set $eip
      (select (local.get $back) (local.get $fall)
        (i32.ne (local.get $count) (i32.const 0))))
    (return_call $branch_end))

  ;; ------------------------------------------------------------------
  ;; 418: the universal LUT_RUN super-op.
  ;; ------------------------------------------------------------------
  ;; H418 op bit 4 carries the compact implicit-register descriptor emitted by
  ;; $loop_try_xlat_stosb: fall, back and original per-iteration cost.
  (func $th_xlat_stosb_lut_run (param $op i32)
    (local $fall i32) (local $back i32) (local $cost i32)
    (local $count i32) (local $trips i32) (local $allowed i32)
    (local $iters i32) (local $byte i32) (local $step i32) (local $prefixed i32)
    (local.set $fall (read-thread-word))
    (local.set $back (read-thread-word))
    (local.set $cost (read-thread-word))
    (local.set $prefixed (i32.and (local.get $op) (i32.const 0x20)))
    (if (local.get $prefixed)
      (then (i32.store offset=4 (global.get $reg_base) (read-thread-word))))
    (local.set $count (i32.load offset=4 (global.get $reg_base)))
    ;; LOOP is a do-while. ECX=0 therefore means 2^32 iterations; represent
    ;; that wrapped distance as UINT_MAX and let the normal step quantum split
    ;; it rather than hanging inside one handler invocation.
    (local.set $trips
      (select (local.get $count) (i32.const -1)
        (i32.ne (local.get $count) (i32.const 0))))
    (local.set $allowed
      (i32.div_u
        (i32.add
          (select (global.get $steps) (i32.const 0)
            (i32.gt_s (global.get $steps) (i32.const 0)))
          (i32.sub (local.get $cost) (i32.const 1)))
        (local.get $cost)))
    (if (i32.eqz (local.get $allowed))
      (then (local.set $allowed (i32.const 1))))
    (local.set $iters
      (select (local.get $trips) (local.get $allowed)
        (i32.lt_u (local.get $trips) (local.get $allowed))))
    (local.set $step
      (select (i32.const -1) (i32.const 1) (global.get $df)))

    (local.set $trips (local.get $iters))
    (loop $pixels
      ;; Preserve the original ordering and alias behavior: the source and
      ;; destination are the same byte, and either may overlap the XLAT table.
      (local.set $byte (call $gl8 (i32.load offset=28 (global.get $reg_base))))
      (i32.store8 (global.get $reg_base) (local.get $byte))
      ;; Match H280's translation path exactly: XLAT uses DS:[EBX+AL].
      (local.set $byte
        (i32.load8_u (call $g2w
          (i32.add (i32.load offset=12 (global.get $reg_base)) (local.get $byte)))))
      (i32.store8 (global.get $reg_base) (local.get $byte))
      (call $gs8 (i32.load offset=28 (global.get $reg_base)) (local.get $byte))
      (i32.store offset=28 (global.get $reg_base) (i32.add (i32.load offset=28 (global.get $reg_base)) (local.get $step)))
      (i32.store offset=4 (global.get $reg_base) (i32.sub (i32.load offset=4 (global.get $reg_base)) (i32.const 1)))
      (local.set $trips (i32.sub (local.get $trips) (i32.const 1)))
      (br_if $pixels (local.get $trips)))

    ;; No instruction in this spelling writes arithmetic flags.
    (global.set $steps
      (i32.sub (global.get $steps)
        (i32.add
          (i32.sub (i32.mul (local.get $iters) (local.get $cost)) (i32.const 1))
          (select (i32.const 1) (i32.const 0) (local.get $prefixed)))))
    (global.set $block_budget
      (i32.sub (global.get $block_budget)
        (i32.sub (local.get $iters) (i32.const 1))))
    (global.set $loop_lut_runs
      (i32.add (global.get $loop_lut_runs) (i32.const 1)))
    (global.set $loop_lut_bytes
      (i64.add (global.get $loop_lut_bytes)
        (i64.extend_i32_u (local.get $iters))))
    (global.set $loop_xlat_stosb_runs
      (i32.add (global.get $loop_xlat_stosb_runs) (i32.const 1)))
    (global.set $loop_xlat_stosb_bytes
      (i64.add (global.get $loop_xlat_stosb_bytes)
        (i64.extend_i32_u (local.get $iters))))
    (global.set $eip
      (select (local.get $back) (local.get $fall)
        (i32.ne (i32.load offset=4 (global.get $reg_base)) (i32.const 0))))
    (return_call $branch_end))

  ;; Both recognizers emit the descriptor documented above. Cursors advance
  ;; after each access; match time folds any original pre-access increment into
  ;; the displacement. term_kind selects count-to-zero or unsigned source-bound
  ;; termination. The optional shift/add pair covers 64K row lookup tables;
  ;; bit 0 adds a second moving byte source for blend tables, and bit 3 makes
  ;; word 6 an absolute byte-table address. (Bits 1 and 2 were Heroes III's
  ;; u16 and stack-table forms, retired to the uop tier: docs/uop-tier-design.md
  ;; section 18.)
  (func $th_lut_run (param $op i32)
    (local $blend i32) (local $absolute8 i32)
    (local $src_reg i32) (local $src_stride i32) (local $src_disp i32)
    (local $dst_reg i32) (local $dst_stride i32) (local $dst_disp i32)
    (local $tbl_reg i32) (local $acc_reg i32) (local $index_shift i32)
    (local $add_reg i32) (local $term_kind i32) (local $term_reg i32)
    (local $term_step i32)
    (local $src2_reg i32) (local $src2_stride i32) (local $src2_disp i32)
    (local $aux_reg i32) (local $table_disp i32) (local $term_stream i32)
    (local $m0_addr i32) (local $m0_reg i32) (local $m0_adj i32)
    (local $m1_addr i32) (local $m1_reg i32) (local $m1_adj i32)
    (local $fall i32) (local $back i32) (local $cost i32)
    (local $tp i32) (local $src i32) (local $src2 i32) (local $dst i32)
    (local $term i32) (local $cursor i32)
    (local $tbl i32) (local $tbl_base i32)
    (local $add i32) (local $old i32)
    (local $b i32) (local $src_b i32) (local $aux i32)
    (local $src_ga i32) (local $dst_ga i32) (local $src_wa i32) (local $dst_wa i32)
    (local $src2_ga i32) (local $src2_wa i32)
    (local $tbl_wa i32)
    (local $chunk i32) (local $trips i32) (local $allowed i32)
    (local $n i32) (local $index i32) (local $cont i32)
    (local $acc_word i32) (local $res_field i32) (local $res_reg i32)
    (local $acc_hoist i32) (local $acc_hi i32)
    (local $bc_done i32)

    (if (i32.and (local.get $op) (i32.const 0x10))
      (then (return_call $th_xlat_stosb_lut_run (local.get $op))))

    ;; Read the fixed descriptor off one base. These runs are often short, so
    ;; avoiding 22/28 helper calls matters to the cost this optimization is
    ;; meant to remove.
    (local.set $blend (i32.and (local.get $op) (i32.const 1)))
    (local.set $absolute8
      (i32.and (i32.shr_u (local.get $op) (i32.const 3)) (i32.const 1)))
    (local.set $tp (global.get $ip))
    (global.set $ip (i32.add (local.get $tp)
      (select (i32.const 112) (i32.const 88) (local.get $blend))))
    (local.set $src_reg     (i32.load           (local.get $tp)))
    (local.set $src_stride  (i32.load offset=4  (local.get $tp)))
    (local.set $src_disp    (i32.load offset=8  (local.get $tp)))
    (local.set $dst_reg     (i32.load offset=12 (local.get $tp)))
    (local.set $dst_stride  (i32.load offset=16 (local.get $tp)))
    (local.set $dst_disp    (i32.load offset=20 (local.get $tp)))
    (local.set $tbl_reg     (i32.load offset=24 (local.get $tp)))
    ;; Three fields in one word. Every emitter that predates the two-register
    ;; form writes a bare 0..7 here, which decodes as "result is the
    ;; accumulator, zeroed in-block" -- the behavior it has always had.
    (local.set $acc_word    (i32.load offset=28 (local.get $tp)))
    (local.set $acc_reg     (i32.and (local.get $acc_word) (i32.const 0xFF)))
    (local.set $res_field
      (i32.and (i32.shr_u (local.get $acc_word) (i32.const 8)) (i32.const 0xFF)))
    (local.set $acc_hoist
      (i32.and (i32.shr_u (local.get $acc_word) (i32.const 16)) (i32.const 1)))
    (local.set $index_shift (i32.load offset=32 (local.get $tp)))
    (local.set $add_reg     (i32.load offset=36 (local.get $tp)))
    (local.set $term_kind   (i32.load offset=40 (local.get $tp)))
    (local.set $term_reg    (i32.load offset=44 (local.get $tp)))
    (local.set $term_step   (i32.load offset=48 (local.get $tp)))
    (local.set $m0_addr     (i32.load offset=52 (local.get $tp)))
    (local.set $m0_reg      (i32.load offset=56 (local.get $tp)))
    (local.set $m0_adj      (i32.load offset=60 (local.get $tp)))
    (local.set $m1_addr     (i32.load offset=64 (local.get $tp)))
    (local.set $m1_reg      (i32.load offset=68 (local.get $tp)))
    (local.set $m1_adj      (i32.load offset=72 (local.get $tp)))
    (local.set $fall        (i32.load offset=76 (local.get $tp)))
    (local.set $back        (i32.load offset=80 (local.get $tp)))
    (local.set $cost        (i32.load offset=84 (local.get $tp)))
    (if (local.get $blend)
      (then
        (local.set $src2_reg    (i32.load offset=88  (local.get $tp)))
        (local.set $src2_stride (i32.load offset=92  (local.get $tp)))
        (local.set $src2_disp   (i32.load offset=96  (local.get $tp)))
        (local.set $aux_reg     (i32.load offset=100 (local.get $tp)))
        (local.set $table_disp  (i32.load offset=104 (local.get $tp)))
        (local.set $term_stream (i32.load offset=108 (local.get $tp)))))

    (local.set $src (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $src_reg) (i32.const 2)))))
    (local.set $dst (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $dst_reg) (i32.const 2)))))
    (local.set $term (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $term_reg) (i32.const 2)))))
    (if (local.get $blend)
      (then (local.set $src2 (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $src2_reg) (i32.const 2)))))))
    (if (local.get $absolute8)
      (then (local.set $tbl (local.get $tbl_reg)))
      (else
        (if (i32.ge_s (local.get $tbl_reg) (i32.const 0))
          (then
            (local.set $tbl_base (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $tbl_reg) (i32.const 2)))))
            (local.set $tbl (i32.add (local.get $tbl_base) (local.get $table_disp))))
          (else (local.set $tbl (local.get $table_disp))))))
    ;; A zero hoisted out of the loop leaves the accumulator's high bits
    ;; loop-invariant: inside the body only the streamed byte load writes that
    ;; register, and it writes the low byte. Fold them into the table base once,
    ;; here, so the per-iteration index stays in 0..255 and the 256-byte table
    ;; page guard below still holds.
    (if (local.get $acc_hoist)
      (then
        (local.set $acc_hi
          (i32.and (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $acc_reg) (i32.const 2)))) (i32.const 0xFFFFFF00)))
        (local.set $tbl
          (i32.add (local.get $tbl)
            (i32.shl (local.get $acc_hi) (local.get $index_shift))))))
    (if (i32.ge_s (local.get $add_reg) (i32.const 0))
      (then (local.set $add (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $add_reg) (i32.const 2)))))))

    ;; Translate the complete lookup range once when it is the normal affine
    ;; guest window. Version 1 indexes all 64KB; the two-endpoint guard keeps
    ;; sparse mappings on gl8.
    (local.set $tbl_wa (i32.const 0))
    (if (i32.and
          (i32.eqz (local.get $blend))
          (i32.and (i32.eqz (local.get $index_shift))
                 (i32.lt_s (local.get $add_reg) (i32.const 0))))
      (then
        (if (i32.le_u (i32.and (local.get $tbl) (i32.const 0xFFF)) (i32.const 0xF00))
          (then
            (local.set $n (call $g2w (local.get $tbl)))
            (if (i32.ne (local.get $n) (global.get $NULL_SENTINEL))
              (then (local.set $tbl_wa (local.get $n))))))))
    (global.set $loop_lut_runs
      (i32.add (global.get $loop_lut_runs) (i32.const 1)))
    (block $exit
      (loop $outer
        (local.set $src_ga (i32.add (local.get $src) (local.get $src_disp)))
        (local.set $dst_ga (i32.add (local.get $dst) (local.get $dst_disp)))
        (if (local.get $blend)
          (then (local.set $src2_ga
            (i32.add (local.get $src2) (local.get $src2_disp)))))

        (if (i32.eqz (local.get $term_kind))
          (then
            (local.set $trips
              (select (local.get $term)
                      (i32.sub (i32.const 0) (local.get $term))
                      (i32.eq (local.get $term_step) (i32.const -1))))
            ;; Preserve do-while semantics for a zero/wrapped counter entry.
            (if (i32.eqz (local.get $trips))
              (then (local.set $trips (i32.const -1)))))
          (else
            ;; A normally reached back-edge guarantees src < bound. The one-trip
            ;; fallback preserves the original do-while behavior for a direct
            ;; entry whose precondition is false.
            (local.set $cursor
              (select (local.get $src2) (local.get $src)
                (i32.and (local.get $blend) (local.get $term_stream))))
            (local.set $trips
              (select (i32.sub (local.get $term) (local.get $cursor))
                      (i32.const 1)
                      (i32.lt_u (local.get $cursor) (local.get $term))))))
        (local.set $allowed
          (i32.div_u
            (i32.add
              (select (global.get $steps) (i32.const 0)
                      (i32.gt_s (global.get $steps) (i32.const 0)))
              (i32.sub (local.get $cost) (i32.const 1)))
            (local.get $cost)))
        (if (i32.eqz (local.get $allowed))
          (then (local.set $allowed (i32.const 1))))
        (local.set $chunk
          (select (local.get $trips) (local.get $allowed)
                  (i32.lt_u (local.get $trips) (local.get $allowed))))
        (local.set $n (call $copy_page_room (local.get $src_ga) (local.get $src_stride)))
        (local.set $chunk
          (select (local.get $n) (local.get $chunk)
                  (i32.lt_u (local.get $n) (local.get $chunk))))
        (local.set $n (call $copy_page_room (local.get $dst_ga) (local.get $dst_stride)))
        (local.set $chunk
          (select (local.get $n) (local.get $chunk)
                  (i32.lt_u (local.get $n) (local.get $chunk))))
        (local.set $chunk (call $bc_fold_cap (local.get $chunk) (local.get $bc_done)))
        (if (local.get $blend)
          (then
            (local.set $n
              (call $copy_page_room (local.get $src2_ga) (local.get $src2_stride)))
            (local.set $chunk
              (select (local.get $n) (local.get $chunk)
                      (i32.lt_u (local.get $n) (local.get $chunk))))))

        (local.set $src_wa (call $g2w (local.get $src_ga)))
        (local.set $dst_wa (call $g2w (local.get $dst_ga)))
        (if (local.get $blend)
          (then (local.set $src2_wa (call $g2w (local.get $src2_ga)))))
        (if (i32.or
              (i32.eq (local.get $src_wa) (global.get $NULL_SENTINEL))
              (i32.or
                (i32.eq (local.get $dst_wa) (global.get $NULL_SENTINEL))
                (i32.and (local.get $blend)
                  (i32.eq (local.get $src2_wa) (global.get $NULL_SENTINEL)))))
          (then (local.set $chunk (i32.const 1))))
        (call $invalidate_code_write
          (i32.and (local.get $dst_ga) (i32.const 0xFFFFF000)) (i32.const 4096))

        (local.set $n (local.get $chunk))
        (loop $inner
          (if (i32.eq (local.get $src_wa) (global.get $NULL_SENTINEL))
            (then (local.set $src_b (call $gl8 (local.get $src_ga))))
            (else (local.set $src_b (i32.load8_u (local.get $src_wa)))))
          (if (local.get $blend)
            (then
              (if (i32.eq (local.get $src2_wa) (global.get $NULL_SENTINEL))
                (then (local.set $aux (call $gl8 (local.get $src2_ga))))
                (else (local.set $aux (i32.load8_u (local.get $src2_wa)))))))
          (local.set $index (i32.shl (local.get $src_b) (local.get $index_shift)))
          (if (local.get $blend)
            (then (local.set $index (i32.add (local.get $index) (local.get $aux))))
            (else (if (i32.ge_s (local.get $add_reg) (i32.const 0))
              (then (local.set $index (i32.add (local.get $index) (local.get $add)))))))
          (if (local.get $tbl_wa)
            (then (local.set $b
              (i32.load8_u (i32.add (local.get $tbl_wa) (local.get $index)))))
            (else (local.set $b
              (call $gl8 (i32.add (local.get $tbl) (local.get $index))))))
          (if (i32.eq (local.get $dst_wa) (global.get $NULL_SENTINEL))
            (then (call $gs8 (local.get $dst_ga) (local.get $b)))
            (else (i32.store8 (local.get $dst_wa) (local.get $b))))
          (local.set $src_ga (i32.add (local.get $src_ga) (local.get $src_stride)))
          (local.set $dst_ga (i32.add (local.get $dst_ga) (local.get $dst_stride)))
          (if (i32.ne (local.get $src_wa) (global.get $NULL_SENTINEL))
            (then (local.set $src_wa (i32.add (local.get $src_wa) (local.get $src_stride)))))
          (if (i32.ne (local.get $dst_wa) (global.get $NULL_SENTINEL))
            (then (local.set $dst_wa (i32.add (local.get $dst_wa) (local.get $dst_stride)))))
          (if (local.get $blend)
            (then
              (local.set $src2_ga
                (i32.add (local.get $src2_ga) (local.get $src2_stride)))
              (if (i32.ne (local.get $src2_wa) (global.get $NULL_SENTINEL))
                (then (local.set $src2_wa
                  (i32.add (local.get $src2_wa) (local.get $src2_stride)))))))
          (local.set $n (i32.sub (local.get $n) (i32.const 1)))
          (br_if $inner (local.get $n)))

        (local.set $src
          (i32.add (local.get $src) (i32.mul (local.get $chunk) (local.get $src_stride))))
        (if (local.get $blend)
          (then (local.set $src2
            (i32.add (local.get $src2)
              (i32.mul (local.get $chunk) (local.get $src2_stride))))))
        (if (i32.eq (local.get $src_reg) (local.get $dst_reg))
          (then (local.set $dst (local.get $src)))
          (else (local.set $dst
            (i32.add (local.get $dst) (i32.mul (local.get $chunk) (local.get $dst_stride))))))
        (if (i32.eqz (local.get $term_kind))
          (then
            (local.set $term
              (i32.add (local.get $term) (i32.mul (local.get $chunk) (local.get $term_step))))
            (local.set $old (i32.sub (local.get $term) (local.get $term_step)))))
        (global.set $loop_lut_bytes
          (i64.add (global.get $loop_lut_bytes) (i64.extend_i32_u (local.get $chunk))))
        (global.set $steps
          (i32.sub (global.get $steps) (i32.mul (local.get $chunk) (local.get $cost))))
        (local.set $cursor
          (select (local.get $src2) (local.get $src)
            (i32.and (local.get $blend) (local.get $term_stream))))
        (local.set $cont
          (select (i32.ne (local.get $term) (i32.const 0))
                  (i32.lt_u (local.get $cursor) (local.get $term))
                  (i32.eqz (local.get $term_kind))))
        (local.set $bc_done (i32.add (local.get $bc_done) (local.get $chunk)))
        (br_if $exit (i32.eqz (local.get $cont)))
        (br_if $exit (i32.eqz (call $bc_fold_cap (i32.const 1) (local.get $bc_done))))
        (br_if $exit (i32.le_s (global.get $steps) (i32.const 0)))
        (br $outer)))

    (if (local.get $res_field)
      (then
        ;; A distinct result register only ever received the table byte, so its
        ;; high bits are the caller's and must survive; the accumulator keeps
        ;; the last streamed byte over its invariant high bits.
        (local.set $res_reg (i32.sub (local.get $res_field) (i32.const 1)))
        (i32.store8 (i32.add (global.get $reg_base) (i32.shl (local.get $res_reg) (i32.const 2))) (local.get $b))
        (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $acc_reg) (i32.const 2))) (i32.or (local.get $acc_hi) (local.get $src_b))))
      (else
        (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $acc_reg) (i32.const 2))) (i32.or (local.get $acc_hi)
            (select
              (i32.or (i32.shl (local.get $src_b) (local.get $index_shift)) (local.get $b))
              (local.get $b)
              (local.get $blend))))))
    (if (local.get $blend)
      (then
        (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $aux_reg) (i32.const 2))) (local.get $aux))
        (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $src2_reg) (i32.const 2))) (local.get $src2))))
    (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $src_reg) (i32.const 2))) (local.get $src))
    (if (i32.ne (local.get $dst_reg) (local.get $src_reg))
      (then (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $dst_reg) (i32.const 2))) (local.get $dst))))
    (if (i32.eqz (local.get $term_kind))
      (then
        (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $term_reg) (i32.const 2))) (local.get $term))
        (if (i32.eq (local.get $term_step) (i32.const -1))
          (then (call $set_flags_dec (local.get $old) (local.get $term)))
          (else (call $set_flags_inc (local.get $old) (local.get $term)))))
      (else
        (call $set_flags_sub (local.get $cursor) (local.get $term)
          (i32.sub (local.get $cursor) (local.get $term)))))
    (if (local.get $m0_addr)
      (then (call $gs32 (local.get $m0_addr)
              (i32.add (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $m0_reg) (i32.const 2)))) (local.get $m0_adj)))))
    (if (local.get $m1_addr)
      (then (call $gs32 (local.get $m1_addr)
              (i32.add (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $m1_reg) (i32.const 2)))) (local.get $m1_adj)))))
    (call $bc_fold_charge (local.get $bc_done))
    (global.set $eip (select (local.get $back) (local.get $fall) (local.get $cont))))

  ;; ==================================================================
  ;; 454: TREE_FOLD -- the first general decode-time expression fold
  ;; ==================================================================
  ;; docs/tree-fold-design-a.md
  ;;
  ;; Every other family in this file proves ONE idiom and replays it with
  ;; hand-written semantics. This one is different in kind: it recognizes a
  ;; self-loop whose whole interior is full-width integer dataflow, records
  ;; that interior as a compact micro-op array, and executes the array with
  ;; the guest's eight GPRs held in wasm LOCALS. The "shape" is therefore a
  ;; parameter, not a predicate -- the three shapes the census named
  ;; (quake2's span coordinate interleave at ref_soft+0x12570, caesar3's RLE
  ;; token decoder at 0x40fa38, and a plain load/op/store chain) are three
  ;; instances of one descriptor, and so is anything else built from the same
  ;; op set.
  ;;
  ;; What the fold removes, per guest op, is exactly the interpreter overhead:
  ;;   * one $next dispatch (frame setup, stack-limit check, interrupt check,
  ;;     call_indirect -- 193 native instructions per tools/wasm-native.js),
  ;;   * the $ip advance and $read_thread_word for operand words,
  ;;   * $get_reg / $set_reg, two br_tables over the register globals.
  ;; And per iteration it removes one block entry ($eip store, cache lookup,
  ;; $branch_end). It removes NOTHING else: memory still goes through
  ;; $gl32/$gs32 (so translation, page crossing and SMC invalidation are
  ;; unchanged) and flags still go through the real $set_flags_* helpers.
  ;;
  ;; That last choice is deliberate and is the whole answer to the per-FIELD
  ;; flag rule in docs/int-expr-fusion-bench.md. $set_flags_logic writes only
  ;; flag_op/flag_res; $set_flags_shift adds flag_b; $set_flags_add writes all
  ;; four. Materializing "the last flag producer" at exit gets this wrong
  ;; whenever a later op writes a strict subset of an earlier op's fields. We
  ;; do not try: every micro-op calls the same helper the scalar handler would
  ;; have called, in the same order, so the five lazy-flag globals plus
  ;; $saved_cf hold precisely the architectural join at every instant --
  ;; including at a side exit, where the bench doc notes nothing is priced.
  ;; The cost is a handful of global stores per op; the win is that the fold
  ;; cannot be wrong about flags. Shadowing them in locals is the obvious next
  ;; relaxation and is named in the doc.
  ;;
  ;; Terminator: the block's own `dec/inc r` + Jcc, or `cmp r,r` / `cmp r,imm`
  ;; + Jcc, back to the head. Because the terminator's flags are published for
  ;; real, the branch is decided by the ordinary $eval_cc and EVERY condition
  ;; code is exact -- including the CF-preserving DEC, whose $saved_cf comes
  ;; from whichever interior op really last wrote CF.
  ;;
  ;; Eligibility (exact; anything else declines the whole block):
  ;;   * full-register 32-bit ops only -- a partial-register write is not in
  ;;     the table, so movzx/movsx into a byte half and every 8/16-bit form
  ;;     decline rather than being approximated;
  ;;   * no interior flag CONSUMER (adc/sbb/rcl/rcr/setcc/interior Jcc are all
  ;;     absent from the table below, and an unlisted op declines);
  ;;   * memory ops keep source order, so a store followed by a possibly
  ;;     aliasing load needs no rule: nothing is reordered, and the alias is
  ;;     resolved by the same $gl32 the scalar path would have used;
  ;;   * at least $tree_fold_min_ops interior ops, or the entry/exit
  ;;     materialization is not repaid.
  ;;
  ;; OFF by default (test/run.js --tree-fold, tools/bench-loops.js
  ;; --toggle=tree_fold). Like every other decode-time gate it must be set
  ;; before the first decode and on every per-thread instance.

  (global $tree_fold_enabled (mut i32) (i32.const 0))
  ;; --trace-tree-fold: dump every LOWERED block's classified micro-op list
  ;; through $host_log_i32, the same single channel $loop_trace uses, because a
  ;; decode-time function has no other. The consumer is
  ;; tools/tree-shape-census.js, which rebuilds the dataflow graph from it --
  ;; the descriptor is the only place the micro-op classification exists, so a
  ;; static disassembly cannot reproduce it.
  (global $tree_trace (mut i32) (i32.const 0))
  (global $tree_fold_min_ops (mut i32) (i32.const 4))
  (global $tree_fold_matches (mut i32) (i32.const 0))
  (global $tree_fold_runs (mut i32) (i32.const 0))
  (global $tree_fold_iters (mut i64) (i64.const 0))
  (global $tree_fold_ops (mut i64) (i64.const 0))
  ;; Micro-ops the dead-flag pass proved nobody can observe the flags of, over
  ;; every lowering. Counted at decode time, so it is a property of the code
  ;; that was folded rather than of how often it ran -- which is the number to
  ;; quote when asking whether the pass is finding anything, since a fold that
  ;; runs once and a fold that runs a million times contribute equally here.
  (global $tree_fold_dead_flag_ops (mut i32) (i32.const 0))
  ;; What the most recent lowering actually put in the descriptor header.
  ;; A fold that runs the right number of iterations while publishing the
  ;; wrong register set looks exactly like a fold that never ran its body,
  ;; and these two are what tell those apart. Test-visible only.
  (global $tree_fold_last_nuops (mut i32) (i32.const 0))
  (global $tree_fold_last_live_out (mut i32) (i32.const 0))
  ;; Why self-loops are declined. A match RATE says nothing about what to relax
  ;; next; this split does, and it is the only thing that turns "2% matched"
  ;; into a work list. Decode-time only, so it costs nothing at run time.
  (global $tree_decl_short (mut i32) (i32.const 0))   ;; fewer than min_ops
  (global $tree_decl_long  (mut i32) (i32.const 0))   ;; more than MAX_UOPS
  (global $tree_decl_term  (mut i32) (i32.const 0))   ;; terminator not dec/cmp+Jcc
  (global $tree_decl_uop   (mut i32) (i32.const 0))   ;; an interior op is not foldable
  ;; The handler index of the interior op that most recently caused a decline.
  ;; One sample, not a histogram -- enough to name the family to widen first.
  (global $tree_decl_uop_fn (mut i32) (i32.const -1))
  ;; An x87 op the accepted set does not contain. A SUB-BUCKET of
  ;; `unfoldable-op`, not a separate one: the classifier returns 0 either way
  ;; and pass 1 bumps $tree_decl_uop as usual. It exists because `lastFn 188`
  ;; names three hundred different instructions and this names the one.
  ;; $tree_decl_x87_op is (group<<8)|(reg<<4)|rm, with rm 0xF for a memory
  ;; form -- decoded by tools/loopmatch-decode.js's x87 namer.
  (global $tree_decl_x87 (mut i32) (i32.const 0))
  (global $tree_decl_x87_op (mut i32) (i32.const -1))
  ;; The self-loop currently under test, so a decline site can name it in the
  ;; trace without threading a parameter through every reject.
  (global $tree_decl_eip (mut i32) (i32.const 0))

  ;; A descriptor longer than this is refused outright.
  ;;
  ;; Both earlier values were guesses about THROUGHPUT -- 24 for "past this the
  ;; run length stops being the thing that pays", then 64 for mw3's 42-op alpha
  ;; blend. tools/bench-loops.js `tree_len8..tree_len160` measured it instead,
  ;; one shape at nine lengths so nothing but the body varies, and there is no
  ;; crossover: the fold leads by 50% at 8 interior ops and by 35-42% at 64,
  ;; 96, 128 and 160, never trending towards zero. The memory-interior control
  ;; `tree_mem*` -- the fold's WORST case, where both arms pay $g2w and a real
  ;; load/store and only the dispatch is left to win -- leads too. So body
  ;; length was never the variable, and the only real ceiling is structural.
  ;;
  ;; Two structures bound it, and the smaller one is the limit:
  ;;   * $decode_block reserves 4096 bytes of slack past $thread_alloc before
  ;;     $te signals a flush. The descriptor is a 76-byte header for the
  ;;     one-block case ($te's 8, a 16-byte region header, one 52-byte block
  ;;     record and one 8-byte exit record) plus $TREE_UOP_WORDS * 4 = 24 bytes
  ;;     per micro-op, so (4096 - 76) / 24 = 167.
  ;;   * the classify scratch is the far half of OP_INDEX, 1024 words at 6
  ;;     words per micro-op = 170.
  ;; $TREE_FOLD_UOPS_LIMIT is the smaller, and the setter clamps to it, because
  ;; a descriptor past either one corrupts rather than declines.
  (global $TREE_FOLD_UOPS_LIMIT i32 (i32.const 167))
  (global $tree_fold_max_ops (mut i32) (i32.const 160))
  ;; kind, dst, src-or-subop, immediate, original handler index, extra.
  ;; The sixth word is the one field whose meaning is per-kind: for the SIB
  ;; forms it is the index register and scale (index | scale<<4, index 0xF
  ;; meaning "no index"), which is exactly what a SIB EA needs beyond the base
  ;; register already in `a` and the displacement already in `imm`.
  (global $TREE_UOP_WORDS i32 (i32.const 6))
  (global $LOOP_SUPEROP_TREE i32 (i32.const 454))

  ;; ------------------------------------------------------------------
  ;; REGION descriptors -- the multi-block generalization of the above.
  ;; ------------------------------------------------------------------
  ;; H454's descriptor is a GRAPH, not a single block. The self-loop the
  ;; matcher emits is the one-block case of it: one block record whose taken
  ;; successor is itself and whose not-taken successor is exit 0. Nothing about
  ;; the micro-op executor changed to make that true, which is the whole point
  ;; -- there is exactly one micro-op interpreter in this file and both the
  ;; shipped fold and the region bench run it.
  ;;
  ;;   header, 4 words at $ip
  ;;     +0  nblocks
  ;;     +4  nexits
  ;;     +8  uops_total
  ;;     +12 reserved (0)
  ;;   block table, nblocks * 13 words, at header+16
  ;;     +0  uop_off      first micro-op, as an index into the flat array
  ;;     +4  nuops
  ;;     +8  term_pos     where the flag producer runs; -1 for term_kind 4
  ;;     +12 term_kind    0 dec/inc  1 cmp r,r  2 cmp r,imm  3 cmp r,[r+d]
  ;;                      4 = none (unconditional edge, always succ_fall)
  ;;     +16 term_a
  ;;     +20 term_b
  ;;     +24 term_uop
  ;;     +28 term_imm
  ;;     +32 term_cc
  ;;     +36 cost         guest ops one execution of this block bills
  ;;     +40 succ_taken   >= 0 block index; < 0 exit slot (-1 - v)
  ;;     +44 succ_fall    ditto
  ;;     +48 entry_eip    where a SIDE EXIT resumes -- see below
  ;;   exit table, nexits * 2 words
  ;;     +0  eip
  ;;     +4  live_out     the register mask published on THIS exit
  ;;   micro-ops, uops_total * $TREE_UOP_WORDS words
  ;;
  ;; A side exit (either meter exhausted) can only be taken at a block edge,
  ;; where every guest register is a real value in a local and no partial
  ;; instruction is in flight. It publishes all eight rather than a mask,
  ;; because it resumes at another block's entry rather than at a modelled
  ;; exit -- and publishing a register the region never wrote is a no-op, the
  ;; local still holding the value it was loaded with.
  (global $REGION_BLOCK_WORDS i32 (i32.const 13))
  (global $REGION_MAX_BLOCKS i32 (i32.const 16))
  (global $REGION_MAX_EXITS i32 (i32.const 8))
  ;; Bench/test only: install a hand-built region descriptor at one guest EIP,
  ;; in place of whatever the decoder would have produced for the block that
  ;; starts there. There is NO region matcher -- recognizing a graph in real
  ;; code is the app-scale design this measurement exists to decide about, and
  ;; building it before the go/no-go would have been the thing the go/no-go was
  ;; supposed to gate. So the descriptor comes from the harness, which also
  ;; emits the x86 the other arm runs, and checksum equality between the two
  ;; arms is what proves the descriptor is a faithful lowering of it.
  (global $region_fold_enabled (mut i32) (i32.const 0))
  (global $region_spec_eip (mut i32) (i32.const 0))
  (global $region_spec_ptr (mut i32) (i32.const 0))   ;; GUEST address
  (global $region_spec_words (mut i32) (i32.const 0))
  (global $region_installs (mut i32) (i32.const 0))

  ;; Micro-op kinds. Numbered densely because $th_tree_fold dispatches on them
  ;; with a br_table; adding one means extending that table too.
  (global $TU_MOV_RR  i32 (i32.const 0))   ;; R[d] = R[a]
  (global $TU_MOV_RI  i32 (i32.const 1))   ;; R[d] = imm
  (global $TU_LEA_RO  i32 (i32.const 2))   ;; R[d] = R[a] + imm        (no flags)
  (global $TU_ADD_RR  i32 (i32.const 3))
  (global $TU_ADD_RI  i32 (i32.const 4))
  (global $TU_SUB_RR  i32 (i32.const 5))
  (global $TU_SUB_RI  i32 (i32.const 6))
  (global $TU_AND_RR  i32 (i32.const 7))
  (global $TU_AND_RI  i32 (i32.const 8))
  (global $TU_OR_RR   i32 (i32.const 9))
  (global $TU_OR_RI   i32 (i32.const 10))
  (global $TU_XOR_RR  i32 (i32.const 11))
  (global $TU_XOR_RI  i32 (i32.const 12))
  (global $TU_INC     i32 (i32.const 13))
  (global $TU_DEC     i32 (i32.const 14))
  (global $TU_NEG     i32 (i32.const 15))
  (global $TU_NOT     i32 (i32.const 16))  ;; no flags, exactly as x86 NOT
  (global $TU_SHIFT   i32 (i32.const 17))  ;; R[d] = do_shift32(a, R[d], imm)
  (global $TU_IMUL_RR i32 (i32.const 18))
  (global $TU_IMUL_RI i32 (i32.const 19))  ;; R[d] = R[a] * imm
  (global $TU_LOAD32  i32 (i32.const 20))  ;; R[d] = [R[a] + imm]
  (global $TU_STORE32 i32 (i32.const 21))  ;; [R[a] + imm] = R[d]
  ;; Absolute forms. The decoder folds the whole address into one word at
  ;; decode time, so these need no register at all -- which is also why they
  ;; are strictly cheaper than the base+disp pair and worth their own kind.
  (global $TU_LOAD32_ABS  i32 (i32.const 22))  ;; R[d] = [imm]
  (global $TU_STORE32_ABS i32 (i32.const 23))  ;; [imm] = R[d]
  ;; -- Partial registers -------------------------------------------------
  ;; A sub-register op is an EXTRACT and an INSERT on the 32-bit local, which
  ;; is the whole reason the fold can hold a partial write without giving up
  ;; the register file: `mov al,[esi]` is `r0 = (r0 & ~0xFF) | byte`, and the
  ;; untouched lanes of r0 are simply the bits the insert did not cover. That
  ;; is exact, not an approximation, so the family's old blanket exclusion of
  ;; partial writes was a scope decision rather than a correctness one.
  ;;
  ;; One pair of kinds covers both widths, because the only difference is a
  ;; mask and a sign-shift and both are carried in `b`. `d` and `a` hold the
  ;; index of the CONTAINING 32-bit register (reg8 & 3, since AH..BH live in
  ;; EAX..EBX), and `b`'s lane bits say which byte inside it -- so the generic
  ;; register reads above already fetch the right container and the live-out
  ;; mask needs no special case at all.
  (global $TU_MOV_SUB_RR i32 (i32.const 24))  ;; R_sub[d] = R_sub[a]  (no flags)
  (global $TU_MOV_SUB_RI i32 (i32.const 25))  ;; R_sub[d] = imm       (no flags)
  (global $TU_ALU_SUB_RR i32 (i32.const 26))  ;; R_sub[d] op= R_sub[a]
  (global $TU_ALU_SUB_RI i32 (i32.const 27))  ;; R_sub[d] op= imm
  (global $TU_LOAD8_RO   i32 (i32.const 28))  ;; R8[d] = [R[a] + imm]
  (global $TU_STORE8_RO  i32 (i32.const 29))  ;; [R[a] + imm] = R8[d]
  (global $TU_LOAD8_ABS  i32 (i32.const 30))  ;; R8[d] = [imm]
  (global $TU_STORE8_ABS i32 (i32.const 31))  ;; [imm] = R8[d]
  ;; MOVZX/MOVSX read a byte but write the WHOLE destination, so these two are
  ;; full-width writes with a narrow source and need no lane handling at all.
  (global $TU_MOVZX8_RO  i32 (i32.const 32))  ;; R[d] = zx8 [R[a] + imm]
  (global $TU_MOVSX8_RO  i32 (i32.const 33))  ;; R[d] = sx8 [R[a] + imm]

  ;; Bit layout of the `b` word. Disjoint by construction: the SIB fields and
  ;; the lane/width fields never appear in the same kind except for
  ;; TU_STORE8_SIB, which needs both, and that is exactly why the lane bits sit
  ;; above the scale rather than overlapping it.
  (global $TU_B_LANE_D i32 (i32.const 0x40))   ;; dst is the high byte (AH..BH)
  (global $TU_B_LANE_A i32 (i32.const 0x80))   ;; src is the high byte
  (global $TU_B_ALU_SHIFT i32 (i32.const 8))   ;; 4 bits: the ALU sub-op
  (global $TU_B_WORD   i32 (i32.const 0x1000)) ;; 0 = byte width, 1 = word
  ;; Set by the dead-flag pass below when EVERY lazy-flag field this micro-op
  ;; would write is overwritten again before anything reads it. The arm then
  ;; does the arithmetic and skips the $set_flags_* call entirely.
  (global $TU_B_NOFLAGS i32 (i32.const 0x2000))
  (global $TU_B_IMM8_SHIFT i32 (i32.const 16)) ;; TU_MOV_M8_I_SIB's immediate
  ;; This micro-op's address word was $SIB_SENTINEL, so its address is whatever
  ;; the preceding TU_EA_SIB computed rather than the immediate in `imm`. Set
  ;; only on the five accepted kinds that read their address through
  ;; $read_addr (H20/H21/H24/H25/H164); every other memory kind carries its own
  ;; base/index/disp and can never see a sentinel.
  (global $TU_B_EA i32 (i32.const 0x4000))
  ;; Round 11, the load/op split's register-move elimination. "The first
  ;; source of this micro-op is the LANE named at b[27:24], not R[d]." Set
  ;; only by $bx_opt_pass in 07c-block-exec.wat, and only on kinds whose $va
  ;; is a pure source -- never on a kind that reads $va as an accumulator it
  ;; also writes through a partial lane. Bits 24..27 are free on every kind
  ;; except TU_MOV_M8_I_SIB, whose immediate occupies 16..23 and which is not
  ;; in the whitelist.
  (global $TU_B_SRC0       i32 (i32.const 0x8000))
  (global $TU_B_SRC0_SHIFT i32 (i32.const 24))

  ;; The five lazy-flag globals plus $saved_cf, one bit each. The whole point
  ;; of tracking them separately -- rather than "the last op that touched
  ;; flags" -- is that the writers do NOT agree on a field set: $set_flags_add
  ;; and $set_flags_sub write all five, $set_flags_logic writes only op, res
  ;; and sign_shift, the IMUL arms write op, res, b and sign_shift but never a,
  ;; and $set_flags_inc/$set_flags_dec add $saved_cf on top of all five. A
  ;; "last writer wins" rule is wrong exactly when a later op writes a strict
  ;; subset of an earlier one's fields, which is the common `and`-then-`dec`
  ;; shape, so the join is computed per field or not at all.
  (global $TF_F_OP  i32 (i32.const 1))
  (global $TF_F_RES i32 (i32.const 2))
  (global $TF_F_A   i32 (i32.const 4))
  (global $TF_F_B   i32 (i32.const 8))
  (global $TF_F_SSH i32 (i32.const 16))
  (global $TF_F_CF  i32 (i32.const 32))
  (global $TF_F_ALL i32 (i32.const 31))   ;; add/sub: op res a b ssh
  (global $TF_F_LOG i32 (i32.const 19))   ;; logic:   op res ssh
  (global $TF_F_MUL i32 (i32.const 27))   ;; imul:    op res b ssh
  (global $TF_F_INC i32 (i32.const 63))   ;; inc/dec: all five plus saved_cf
  ;; What $get_cf reads, conservatively: it branches on flag_op and then reads
  ;; one of flag_res/flag_a/flag_b/$saved_cf, so a reader of CF is a reader of
  ;; all of them. flag_sign_shift is NOT among them -- only $get_sf reads that.
  (global $TF_F_CFRD i32 (i32.const 47))

  ;; SIB forms. Everything from here up computes an effective address as
  ;; R[a] + R[b & 0xF] << (b >> 4) + imm, with 0xF in either register slot
  ;; meaning "absent" -- the same encoding $sib_ea reads, so the arithmetic is
  ;; the decoder's, not a second opinion about it. Kept contiguous at the end
  ;; so the handler can hoist the EA computation behind one range test.
  (global $TU_FIRST_SIB     i32 (i32.const 34))
  (global $TU_LEA_SIB       i32 (i32.const 34))  ;; R[d] = ea          (no flags)
  (global $TU_LOAD32_SIB    i32 (i32.const 35))  ;; R[d] = [ea]
  (global $TU_STORE32_SIB   i32 (i32.const 36))  ;; [ea] = R[d]
  (global $TU_MOVSX8_SIB    i32 (i32.const 37))  ;; R[d] = sx8 [ea]
  (global $TU_STORE8_SIB    i32 (i32.const 38))  ;; [ea] = R8[d]
  ;; 16-bit memory. A 16-bit register is the low half of its container and has
  ;; no high lane, so these need no lane bits at all -- but they DO need their
  ;; own kinds rather than a wider TU_LOAD8_*, because the width lives in the
  ;; helper called ($gl16/$gs16 against $gl8/$gs8), not in a mask.
  (global $TU_LOAD16_ABS  i32 (i32.const 40))  ;; R16[d] = [imm]
  (global $TU_LOAD16_RO   i32 (i32.const 41))  ;; R16[d] = [R[a] + imm]
  (global $TU_STORE16_RO  i32 (i32.const 42))  ;; [R[a] + imm] = R16[d]
  ;; -- Interior flag CONSUMERS -------------------------------------------
  ;; The family's original licence was "nothing inside the tree looks at the
  ;; flags the ops leave behind", which is why ADC declined. That licence is
  ;; stronger than it needs to be. The tree keeps the lazy-flag GLOBALS
  ;; current at every point a reader exists -- the dead-flag pass elides a
  ;; write only when no later op reads the fields it wrote -- so a consumer
  ;; can simply call the same $get_cf the scalar handler calls and get the
  ;; same answer. What a consumer costs is not correctness, it is elision:
  ;; $tree_uop_flag_reads reports it, every earlier write it can observe
  ;; stays live, and the consumers themselves are never elided.
  (global $TU_ADC_RR i32 (i32.const 43))
  (global $TU_ADC_RI i32 (i32.const 44))
  (global $TU_SBB_RR i32 (i32.const 45))
  (global $TU_SBB_RI i32 (i32.const 46))
  (global $TU_MOV_M8_I_SIB  i32 (i32.const 39))  ;; [ea] = imm8 (in b)

  ;; -- CMP, flags only (round 11) ----------------------------------------
  ;; These two exist for the load/op split in 07c: `cmp reg,[mem]` becomes a
  ;; load into a temp lane plus one of these, and without a cmp kind the whole
  ;; instruction would have to stay a fallback. They also pick up interior
  ;; `cmp r,r` (H19) and `cmp r,imm32` (H10), which were fallbacks before.
  ;; They define NO register, which is why $tree_uop_is_store lists them: the
  ;; live-out mask must not claim `d`.
  (global $TU_CMP_RR i32 (i32.const 58))  ;; flags of R[d] - R[a]
  (global $TU_CMP_RI i32 (i32.const 59))  ;; flags of R[d] - imm

  ;; -- the two-op EA pair -------------------------------------------------
  ;; H149 ($th_compute_ea_sib) is the one emitted op that is not an
  ;; instruction: it computes an effective address into the $ea_temp global
  ;; and leaves the NEXT handler to consume it through $read_addr, which reads
  ;; $ea_temp when its address word is $SIB_SENTINEL. That is a cross-op
  ;; dataflow, and it is why the family declined it for as long as it did --
  ;; "one micro-op, one instruction" cannot express a producer whose only
  ;; consumer is the op after it.
  ;;
  ;; The representation that does express it is the obvious one: make the pair
  ;; two micro-ops joined by a slot, exactly as the interpreter joins them by a
  ;; global. TU_EA_SIB writes the run's $ea_hold local; a consumer whose
  ;; address word was the sentinel carries TU_B_EA and reads that local instead
  ;; of its immediate. The slot is a LOCAL rather than $ea_temp because nothing
  ;; outside the pair can observe $ea_temp: the decoder emits 149 and its
  ;; consumer adjacently, so the value is produced and consumed inside one
  ;; descriptor, and a side exit only ever happens at an iteration boundary,
  ;; after which the fold re-enters and recomputes the address from scratch.
  ;;
  ;; The pairing is checked, not assumed -- see the walk in pass 1. A consumer
  ;; marked TU_B_EA whose predecessor is not an EA producer, or a bare EA
  ;; producer whose successor does not consume it, declines the block rather
  ;; than reading a stale address.
  (global $TU_EA_SIB     i32 (i32.const 47))  ;; ea_hold = R[a] + R[idx]<<sc + imm
  ;; Bit 8 of H149's operand fuses the byte load its dominant consumer would
  ;; have been, so that form is one micro-op with a register write and needs no
  ;; partner at all.
  (global $TU_EA_SIB_LD8 i32 (i32.const 48))  ;; the same, plus R8[d] = [ea]

  ;; REP MOVSB/MOVSD/STOSB/STOSD -- the one micro-op that is not integer
  ;; dataflow. A `rep movsd` is a whole memcpy behind a single dispatch, and
  ;; nothing about it belongs in a tree of register expressions; it is here
  ;; only because it appears INSIDE loops that otherwise are one (a row
  ;; blitter that copies a run, then advances two cursors and a counter), and
  ;; one such op used to cost the whole block. It was quake2's residual
  ;; barrier -- `lastFn 83` -- and mw3's after the H149 pair landed.
  ;;
  ;; It is modelled by NOT modelling it. The arm publishes all eight register
  ;; locals to the globals, calls the very body $th_rep_* calls, and reloads
  ;; them. So the DF direction, the overlap and contiguity tests, the
  ;; $invalidate_code_write extent, the per-element fallback and the ECX=0
  ;; write are the interpreter's own code running once -- and a fault partway
  ;; through leaves ECX/ESI/EDI in the globals exactly where the unfolded path
  ;; would have left them, because the stores are the same stores. The price
  ;; is sixteen global accesses around a call that already costs thousands.
  ;;
  ;; `d` selects which of the four (fn - 82). Every other field is inert, and
  ;; `a` and the SIB index nibble are 0xF so the hoisted EA adds nothing.
  (global $TU_REP_STR    i32 (i32.const 49))

  ;; -- x87 inside an integer tree -----------------------------------------
  ;; docs/tree-fold-design-a.md §13.
  ;;
  ;; The barrier these remove is NOT an x87 one. Measured on quake2 soft, the
  ;; largest declining population by block entries was thirteen blocks whose
  ;; interiors are ordinary integer address arithmetic with an `fld / fmul /
  ;; fstp` sitting in the middle -- and BOTH families declined them: TREE_FOLD
  ;; because H188/H189/H190 are not integer dataflow, and the x87 semantic
  ;; families (H449-453) because the integer ops between the x87 ops break
  ;; their contiguity. Nobody folded them, so the interpreter paid a full
  ;; $next per op for the integer half as well.
  ;;
  ;; What is folded is the INTEGER half. Each x87 micro-op calls exactly the
  ;; helper its scalar handler calls -- $fpu_exec_mem or $fpu_exec_reg, the
  ;; same two functions $th_fpu_mem/$th_fpu_reg/$th_fpu_mem_ro call -- with the
  ;; same (group, reg, rm) it decoded and the same address. So the x87 stack,
  ;; the tag word, the raw 64-bit shadows and every sticky exception bit in
  ;; $fpu_sw are produced by the interpreter's own code, in source order,
  ;; unchanged. There is no second opinion about x87 semantics anywhere in
  ;; this family, which is the whole reason this widening is small.
  ;;
  ;; Holding ST(0) in a wasm local across consecutive x87 ops is deliberately
  ;; NOT done. It would have to reproduce $fpu_set/$fpu_get's tag and raw-
  ;; shadow bookkeeping, FXCH's payload move and the C1 stack-overflow bit at
  ;; every push, and the moment any of that is approximated the family stops
  ;; being "the interpreter's own code" and starts being a second x87. The
  ;; saving would be a few f64 loads against a call that already does real
  ;; floating-point work.
  ;;
  ;; Three fields ride in `b`, above every bit the integer kinds use:
  ;;   bits 16..19 group, 20..23 reg, 24..27 rm.
  ;; `a` is the base register for the base+disp form and 0xF otherwise, and
  ;; the SIB-EA hoist therefore computes exactly the address these want:
  ;; `imm` alone for the absolute form (which is also where the H149 sentinel
  ;; join lands, since TU_B_EA is decoded before the hoist) and `R[a] + imm`
  ;; for the base+disp one.
  (global $TU_X87_MEM  i32 (i32.const 50))  ;; fpu_exec_mem(group, reg, [ea])
  (global $TU_X87_MRO  i32 (i32.const 51))  ;; fpu_exec_mem(group, reg, R[a]+imm)
  (global $TU_X87_REG  i32 (i32.const 52))  ;; fpu_exec_reg(group, reg, rm)
  ;; FNSTSW AX is the one x87 op that writes a GENERAL register, and it is in
  ;; the accepted set because `fcom / fnstsw ax / test ah,imm` is how every
  ;; pre-P6 compiler reads a comparison back. It is its own kind rather than a
  ;; flag on TU_X87_REG so the two global accesses it needs -- publish EAX,
  ;; call, reload EAX -- are paid by it alone and not by every x87 op.
  (global $TU_X87_SW_AX i32 (i32.const 53)) ;; publish EAX, DF E0, reload EAX
  (global $TU_B_X87_GROUP_SHIFT i32 (i32.const 16))
  (global $TU_B_X87_REG_SHIFT   i32 (i32.const 20))
  (global $TU_B_X87_RM_SHIFT    i32 (i32.const 24))

  ;; Classifier out-parameters. Decode-time only and single-threaded per
  ;; instance, so globals are cheaper and clearer than packing five fields
  ;; into an i64 return.
  (global $tu_kind (mut i32) (i32.const 0))
  (global $tu_d    (mut i32) (i32.const 0))
  (global $tu_a    (mut i32) (i32.const 0))
  (global $tu_imm  (mut i32) (i32.const 0))
  (global $tu_fn   (mut i32) (i32.const 0))
  (global $tu_b    (mut i32) (i32.const 0))
  ;; Guest ops this micro-op stands for BEYOND the one $next already bills for
  ;; the emitted handler. Almost always zero. H420 is the exception: it charges
  ;; a step of its own (06b-core-handlers.wat says why -- it swallowed a
  ;; separate SIB-EA dispatch), so a block containing one billed n+1 steps per
  ;; iteration unfolded, and the descriptor's `cost` has to say so or the fold
  ;; silently buys the guest more work per batch than the scalar path did.
  (global $tu_extra (mut i32) (i32.const 0))

  ;; Which 32-bit register CONTAINS this sub-register, and is it the high byte?
  ;;
  ;; The two widths disagree, which is the whole reason these are functions.
  ;; A byte index runs AL CL DL BL AH CH DH BH, so 0..3 are the low bytes of
  ;; EAX..EBX and 4..7 are the HIGH bytes of the same four -- index 5 is CH,
  ;; inside ECX, not anything to do with EBP. A word index runs AX CX DX BX SP
  ;; BP SI DI and is simply the low half of the register with the same number.
  ;; Reading a byte index as if it were a word index is a wrong answer that
  ;; still computes, so the width is passed in rather than inferred.
  (func $tree_sub_reg (param $r i32) (param $fn i32) (result i32)
    (if (result i32) (call $tree_fn_is_word (local.get $fn))
      (then (i32.and (local.get $r) (i32.const 0x7)))
      (else (i32.and (local.get $r) (i32.const 0x3)))))
  (func $tree_sub_hi (param $r i32) (param $fn i32) (result i32)
    (if (result i32) (call $tree_fn_is_word (local.get $fn))
      (then (i32.const 0))
      (else (i32.ge_u (local.get $r) (i32.const 4)))))
  ;; The word-width handlers among the sub-register set: H206/H207 (r16 ALU),
  ;; H210 (mov r16,r16), H236 (mov r16,imm16). Everything else in that set is
  ;; a byte form.
  (func $tree_fn_is_word (param $fn i32) (result i32)
    (i32.or (i32.eq (local.get $fn) (i32.const 206))
    (i32.or (i32.eq (local.get $fn) (i32.const 207))
    (i32.or (i32.eq (local.get $fn) (i32.const 210))
            (i32.eq (local.get $fn) (i32.const 236))))))

  ;; Classify one emitted op as a micro-op. Returns 1 and fills the $tu_*
  ;; globals, or returns 0 -- which declines the entire block. The default is
  ;; decline, so a handler this function has never heard of costs a missed
  ;; lowering and never a wrong one.
  ;;
  ;; Extra operand words are read only inside a branch that has already
  ;; equality-tested the handler index, for the reason spelled out above
  ;; $loop_op_at: the thread stream is a discriminated union keyed by handler,
  ;; and a positional read of +8 is only meaningful once the tag is known.
  ;; The address word of a $read_addr consumer (H20/H21/H24/H25/H164). The
  ;; decoder writes a real guest address there, or $SIB_SENTINEL to say "the
  ;; preceding H149 left it in $ea_temp". Reading that word as an address is
  ;; exactly the bug this exists to prevent: 0xEADEAD is a perfectly plausible
  ;; address, so a fold that missed the sentinel would load from it and be
  ;; wrong in a way that still computes. Sets TU_B_EA and zeroes the immediate
  ;; instead, and must therefore be called AFTER the other `b` fields are in.
  (func $tree_abs_addr (param $w i32) (result i32)
    (if (i32.eq (local.get $w) (global.get $SIB_SENTINEL))
      (then
        (global.set $tu_b (i32.or (global.get $tu_b) (global.get $TU_B_EA)))
        (return (i32.const 0))))
    (local.get $w))

  ;; Is this (group, reg) memory form one $fpu_exec_mem actually implements?
  ;;
  ;; The list mirrors that function's own dispatch, arm for arm, and the
  ;; default is decline. Two different failures are being prevented and only
  ;; one of them is obvious. The obvious one: an unimplemented combination
  ;; reaches $fpu_crash_op, which traps -- and a trap taken from inside the
  ;; fold reports a register file that is still in wasm locals, so the crash
  ;; log that is supposed to name the next thing to implement would name the
  ;; wrong EIP and the wrong registers instead. The other: an arm added to
  ;; $fpu_exec_mem later is simply not folded until it is added here too,
  ;; which is a missed lowering and never a wrong one.
  ;;
  ;; Nothing in the memory set touches a general register or a lazy flag, so
  ;; unlike the register set there is no second reason to decline here.
  (func $tree_x87_mem_ok (param $group i32) (param $reg i32) (result i32)
    ;; D8/DC (f32/f64 arithmetic) and DA/DE (int32/int16 arithmetic): all
    ;; eight reg values are real instructions.
    (if (i32.or (i32.eq (local.get $group) (i32.const 0))
        (i32.or (i32.eq (local.get $group) (i32.const 4))
        (i32.or (i32.eq (local.get $group) (i32.const 2))
                (i32.eq (local.get $group) (i32.const 6)))))
      (then (return (i32.const 1))))
    ;; D9: FLD/FST/FSTP m32, FLDENV, FLDCW, FNSTENV, FNSTCW. reg 1 is not one.
    (if (i32.eq (local.get $group) (i32.const 1))
      (then (return (i32.ne (local.get $reg) (i32.const 1)))))
    ;; DD: FLD/FST/FSTP m64, FRSTOR, FNSAVE, FNSTSW m16. reg 1 and 5 are not.
    (if (i32.eq (local.get $group) (i32.const 5))
      (then (return (i32.and (i32.ne (local.get $reg) (i32.const 1))
                             (i32.ne (local.get $reg) (i32.const 5))))))
    ;; DB: FILD/FIST/FISTP m32, FLD/FSTP m80.
    (if (i32.eq (local.get $group) (i32.const 3))
      (then (return
        (i32.or (i32.eq (local.get $reg) (i32.const 0))
        (i32.or (i32.eq (local.get $reg) (i32.const 2))
        (i32.or (i32.eq (local.get $reg) (i32.const 3))
        (i32.or (i32.eq (local.get $reg) (i32.const 5))
                (i32.eq (local.get $reg) (i32.const 7)))))))))
    ;; DF: FILD/FIST/FISTP m16, FBLD, FILD m64, FBSTP, FISTP m64. reg 1 is not.
    (if (i32.eq (local.get $group) (i32.const 7))
      (then (return (i32.ne (local.get $reg) (i32.const 1)))))
    (i32.const 0))

  ;; The register set, which has the extra rule the memory set does not: an
  ;; op that touches a GENERAL register or the lazy-flag globals is declined
  ;; even when $fpu_exec_reg implements it perfectly well.
  ;;
  ;;   FCMOVcc  (DA/0-2, DB/0-2)   READS  CF/ZF through $get_cf/$get_zf.
  ;;   FCOMI    (DB/5-6, DF/5-6)   WRITES EFLAGS through $fpu_compare_eflags.
  ;;   FNSTSW AX (DF E0)           WRITES EAX -- accepted, as TU_X87_SW_AX.
  ;;
  ;; The FCMOV case is the one that would be silently wrong rather than merely
  ;; imprecise. The decode-time dead-flag pass elides a $set_flags_* call when
  ;; nothing between it and the terminator reads the fields it wrote, and it
  ;; learns about readers from $tree_uop_flag_reads -- which reports zero for
  ;; every x87 kind. An FCMOV inside the tree would therefore read flags an
  ;; earlier micro-op was allowed to skip writing. Teaching the reader set
  ;; about it is a two-line change; it is not made because no corpus app has
  ;; one inside a self-loop (measured, §13), and an unexercised widening in a
  ;; correctness-critical pass is worse than a decline.
  ;;
  ;; FCOMI/FUCOMI are declined for the mirror-image reason: they write the
  ;; lazy-flag globals from outside $tree_uop_flag_writes' model, so the
  ;; terminator's own $eval_cc could read a field the pass believed only the
  ;; terminator writes.
  (func $tree_x87_reg_ok (param $group i32) (param $reg i32) (param $rm i32) (result i32)
    ;; D8: arith ST(0),ST(i) -- every reg is real.
    (if (i32.eq (local.get $group) (i32.const 0)) (then (return (i32.const 1))))
    ;; D9: FLD ST(i), FXCH, FNOP, FCHS/FABS/FTST/FXAM, the constants, and the
    ;; two transcendental banks.
    (if (i32.eq (local.get $group) (i32.const 1))
      (then
        (if (i32.or (i32.eq (local.get $reg) (i32.const 0))
                    (i32.eq (local.get $reg) (i32.const 1)))
          (then (return (i32.const 1))))
        (if (i32.eq (local.get $reg) (i32.const 2))
          (then (return (i32.eqz (local.get $rm)))))
        (if (i32.eq (local.get $reg) (i32.const 4))
          (then (return
            (i32.or (i32.eq (local.get $rm) (i32.const 0))
            (i32.or (i32.eq (local.get $rm) (i32.const 1))
            (i32.or (i32.eq (local.get $rm) (i32.const 4))
                    (i32.eq (local.get $rm) (i32.const 5))))))))
        (if (i32.eq (local.get $reg) (i32.const 5))
          (then (return (i32.le_u (local.get $rm) (i32.const 6)))))
        (if (i32.or (i32.eq (local.get $reg) (i32.const 6))
                    (i32.eq (local.get $reg) (i32.const 7)))
          (then (return (i32.const 1))))
        (return (i32.const 0))))
    ;; DA: FCMOVB/E/BE read flags and are declined; DA E9 FUCOMPP does not.
    (if (i32.eq (local.get $group) (i32.const 2))
      (then (return (i32.and (i32.eq (local.get $reg) (i32.const 5))
                             (i32.eq (local.get $rm) (i32.const 1))))))
    ;; DB: only the DB E0..E3 bank (FNENI/FNDISI/FNCLEX/FNINIT). FNCLEX and
    ;; FNINIT clear the sticky exception bits, which is a real x87 state
    ;; change and is exactly what the interpreter's own arm does.
    (if (i32.eq (local.get $group) (i32.const 3))
      (then (return (i32.and (i32.eq (local.get $reg) (i32.const 4))
                             (i32.le_u (local.get $rm) (i32.const 3))))))
    ;; DC: arith ST(i),ST(0) -- reg 2/3 are the unimplemented FCOM aliases.
    ;; DE: the popping twins, plus DE D9 FCOMPP.
    (if (i32.or (i32.eq (local.get $group) (i32.const 4))
                (i32.eq (local.get $group) (i32.const 6)))
      (then
        (if (i32.and (i32.and (i32.eq (local.get $group) (i32.const 6))
                              (i32.eq (local.get $reg) (i32.const 3)))
                     (i32.eq (local.get $rm) (i32.const 1)))
          (then (return (i32.const 1))))
        (return
          (i32.or (i32.eq (local.get $reg) (i32.const 0))
          (i32.or (i32.eq (local.get $reg) (i32.const 1))
          (i32.or (i32.eq (local.get $reg) (i32.const 4))
          (i32.or (i32.eq (local.get $reg) (i32.const 5))
          (i32.or (i32.eq (local.get $reg) (i32.const 6))
                  (i32.eq (local.get $reg) (i32.const 7))))))))))
    ;; DD: FFREE, FST, FSTP, FUCOM, FUCOMP.
    (if (i32.eq (local.get $group) (i32.const 5))
      (then (return
        (i32.or (i32.eq (local.get $reg) (i32.const 0))
        (i32.or (i32.eq (local.get $reg) (i32.const 2))
        (i32.or (i32.eq (local.get $reg) (i32.const 3))
        (i32.or (i32.eq (local.get $reg) (i32.const 4))
                (i32.eq (local.get $reg) (i32.const 5)))))))))
    ;; DF: FNSTSW AX has its own kind; FUCOMIP/FCOMIP write EFLAGS.
    (i32.const 0))

  ;; Count an x87 decline and name the exact instruction. Returns 0 so a
  ;; classify arm can `(return (call $tree_x87_decline ...))`.
  (func $tree_x87_decline (param $group i32) (param $reg i32) (param $rm i32)
                          (result i32)
    (global.set $tree_decl_x87 (i32.add (global.get $tree_decl_x87) (i32.const 1)))
    (global.set $tree_decl_x87_op
      (i32.or (i32.shl (local.get $group) (i32.const 8))
        (i32.or (i32.shl (local.get $reg) (i32.const 4)) (local.get $rm))))
    (i32.const 0))

  ;; Pack (group, reg, rm) into the high half of the `b` word, above every bit
  ;; the integer kinds use. One function so the three classify arms and the
  ;; three handler arms cannot disagree about the layout.
  (func $tree_x87_b (param $group i32) (param $reg i32) (param $rm i32) (result i32)
    (i32.or (i32.const 0xF)      ;; SIB index nibble: absent, so the hoisted EA
      (i32.or                    ;; is `imm` (+ R[a] when a base is present)
        (i32.shl (local.get $group) (global.get $TU_B_X87_GROUP_SHIFT))
        (i32.or
          (i32.shl (local.get $reg) (global.get $TU_B_X87_REG_SHIFT))
          (i32.shl (local.get $rm) (global.get $TU_B_X87_RM_SHIFT))))))

  (func $tree_uop_classify (param $p i32) (result i32)
    (local $fn i32) (local $op i32) (local $type i32) (local $count i32)
    (local.set $fn (load.field LoopOp handler (local.get $p)))
    (local.set $op (load.field.memarg LoopOp operand (local.get $p)))
    (global.set $tu_fn (local.get $fn))
    (global.set $tu_d (i32.const 0))
    (global.set $tu_a (i32.const 0))
    (global.set $tu_imm (i32.const 0))
    (global.set $tu_b (i32.const 0))
    (global.set $tu_extra (i32.const 0))

    ;; -- 32-bit ADC/SBB: the interior flag consumers -------------------------
    ;; H5/H6 are the reg,imm32 pair and H14/H15 the reg,reg pair, encoded like
    ;; their ADD/SUB neighbours. They are separate kinds rather than ALU
    ;; sub-ops because the scalar handlers are not just "$do_alu32 with a
    ;; carry in": each one also has a CF fix-up that writes flag_op/a/b raw
    ;; when `b + cf` wrapped, and that fix-up is the part a re-derivation
    ;; would get wrong.
    (if (i32.or (i32.eq (local.get $fn) (i32.const 5))
                (i32.eq (local.get $fn) (i32.const 6)))
      (then
        (global.set $tu_d (i32.and (local.get $op) (i32.const 0xF)))
        (global.set $tu_imm (i32.load offset=8 (local.get $p)))
        (global.set $tu_kind
          (select (global.get $TU_ADC_RI) (global.get $TU_SBB_RI)
                  (i32.eq (local.get $fn) (i32.const 5))))
        (return (i32.const 1))))
    (if (i32.or (i32.eq (local.get $fn) (i32.const 14))
                (i32.eq (local.get $fn) (i32.const 15)))
      (then
        (global.set $tu_d (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
        (global.set $tu_a (i32.and (local.get $op) (i32.const 0xF)))
        (global.set $tu_kind
          (select (global.get $TU_ADC_RR) (global.get $TU_SBB_RR)
                  (i32.eq (local.get $fn) (i32.const 14))))
        (return (i32.const 1))))

    ;; -- CMP, flags only. H10 is `cmp r,imm32` (operand = reg, imm in the
    ;; next word) and H19 `cmp r,r` (operand = dst<<4|src). Both call
    ;; $set_flags_sub on the same two values the arms here do, so the join is
    ;; the scalar path's. H19 also feeds $branch_hist_set when the handler
    ;; histogram is armed; that is a diagnostic channel, not architectural
    ;; state, and it is the one thing an interior cmp loses under the fold --
    ;; the same loss every other folded op already takes.
    (if (i32.eq (local.get $fn) (i32.const 10))
      (then
        (global.set $tu_kind (global.get $TU_CMP_RI))
        (global.set $tu_d (i32.and (local.get $op) (i32.const 0xF)))
        (global.set $tu_imm (i32.load offset=8 (local.get $p)))
        (return (i32.const 1))))
    (if (i32.eq (local.get $fn) (i32.const 19))
      (then
        (global.set $tu_kind (global.get $TU_CMP_RR))
        (global.set $tu_d (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
        (global.set $tu_a (i32.and (local.get $op) (i32.const 0xF)))
        (return (i32.const 1))))

    ;; -- register/immediate: operand = reg, imm32 in the next word ----------
    (if (i32.or (i32.eq (local.get $fn) (i32.const 2))
        (i32.or (i32.eq (local.get $fn) (i32.const 3))
        (i32.or (i32.eq (local.get $fn) (i32.const 4))
        (i32.or (i32.eq (local.get $fn) (i32.const 7))
        (i32.or (i32.eq (local.get $fn) (i32.const 8))
                (i32.eq (local.get $fn) (i32.const 9)))))))
      (then
        (global.set $tu_d (i32.and (local.get $op) (i32.const 0xF)))
        (global.set $tu_imm (i32.load offset=8 (local.get $p)))
        (if (i32.eq (local.get $fn) (i32.const 2))
          (then (global.set $tu_kind (global.get $TU_MOV_RI)) (return (i32.const 1))))
        (if (i32.eq (local.get $fn) (i32.const 3))
          (then (global.set $tu_kind (global.get $TU_ADD_RI)) (return (i32.const 1))))
        (if (i32.eq (local.get $fn) (i32.const 4))
          (then (global.set $tu_kind (global.get $TU_OR_RI)) (return (i32.const 1))))
        (if (i32.eq (local.get $fn) (i32.const 7))
          (then (global.set $tu_kind (global.get $TU_AND_RI)) (return (i32.const 1))))
        (if (i32.eq (local.get $fn) (i32.const 8))
          (then (global.set $tu_kind (global.get $TU_SUB_RI)) (return (i32.const 1))))
        (global.set $tu_kind (global.get $TU_XOR_RI))
        (return (i32.const 1))))

    ;; -- register/register: operand = dst<<4 | src -------------------------
    (if (i32.or (i32.eq (local.get $fn) (i32.const 11))
        (i32.or (i32.eq (local.get $fn) (i32.const 12))
        (i32.or (i32.eq (local.get $fn) (i32.const 13))
        (i32.or (i32.eq (local.get $fn) (i32.const 16))
        (i32.or (i32.eq (local.get $fn) (i32.const 17))
        (i32.or (i32.eq (local.get $fn) (i32.const 18))
                (i32.eq (local.get $fn) (i32.const 118))))))))
      (then
        (global.set $tu_d (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
        (global.set $tu_a (i32.and (local.get $op) (i32.const 0xF)))
        (if (i32.eq (local.get $fn) (i32.const 11))
          (then (global.set $tu_kind (global.get $TU_MOV_RR)) (return (i32.const 1))))
        (if (i32.eq (local.get $fn) (i32.const 12))
          (then (global.set $tu_kind (global.get $TU_ADD_RR)) (return (i32.const 1))))
        (if (i32.eq (local.get $fn) (i32.const 13))
          (then (global.set $tu_kind (global.get $TU_OR_RR)) (return (i32.const 1))))
        (if (i32.eq (local.get $fn) (i32.const 16))
          (then (global.set $tu_kind (global.get $TU_AND_RR)) (return (i32.const 1))))
        (if (i32.eq (local.get $fn) (i32.const 17))
          (then (global.set $tu_kind (global.get $TU_SUB_RR)) (return (i32.const 1))))
        (if (i32.eq (local.get $fn) (i32.const 18))
          (then (global.set $tu_kind (global.get $TU_XOR_RR)) (return (i32.const 1))))
        (global.set $tu_kind (global.get $TU_IMUL_RR))
        (return (i32.const 1))))

    ;; -- unary register ----------------------------------------------------
    (if (i32.or (i32.eq (local.get $fn) (i32.const 64))
        (i32.or (i32.eq (local.get $fn) (i32.const 65))
        (i32.or (i32.eq (local.get $fn) (i32.const 66))
                (i32.eq (local.get $fn) (i32.const 67)))))
      (then
        (global.set $tu_d (i32.and (local.get $op) (i32.const 0xF)))
        (if (i32.eq (local.get $fn) (i32.const 64))
          (then (global.set $tu_kind (global.get $TU_INC)) (return (i32.const 1))))
        (if (i32.eq (local.get $fn) (i32.const 65))
          (then (global.set $tu_kind (global.get $TU_DEC)) (return (i32.const 1))))
        (if (i32.eq (local.get $fn) (i32.const 66))
          (then (global.set $tu_kind (global.get $TU_NOT)) (return (i32.const 1))))
        (global.set $tu_kind (global.get $TU_NEG))
        (return (i32.const 1))))

    ;; -- imul r, r, imm : operand = dst<<4|src, imm in the next word --------
    (if (i32.eq (local.get $fn) (i32.const 59))
      (then
        (global.set $tu_kind (global.get $TU_IMUL_RI))
        (global.set $tu_d (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
        (global.set $tu_a (i32.and (local.get $op) (i32.const 0xF)))
        (global.set $tu_imm (i32.load offset=8 (local.get $p)))
        (return (i32.const 1))))

    ;; -- lea r, [base+disp] : operand = dst<<4|base, disp in the next word --
    (if (i32.eq (local.get $fn) (i32.const 126))
      (then
        (global.set $tu_kind (global.get $TU_LEA_RO))
        (global.set $tu_d (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
        (global.set $tu_a (i32.and (local.get $op) (i32.const 0xF)))
        (global.set $tu_imm (i32.load offset=8 (local.get $p)))
        (return (i32.const 1))))

    ;; -- generic load/store dword, base+disp --------------------------------
    (if (i32.or (i32.or (i32.eq (local.get $fn) (i32.const 26))
                        (i32.eq (local.get $fn) (i32.const 27)))
                (i32.or (i32.eq (local.get $fn) (i32.const 467))
                        (i32.eq (local.get $fn) (i32.const 468))))
      (then
        (global.set $tu_kind
          (select (global.get $TU_LOAD32) (global.get $TU_STORE32)
                  (i32.or (i32.eq (local.get $fn) (i32.const 26))
                          (i32.eq (local.get $fn) (i32.const 467)))))
        (global.set $tu_d (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
        (global.set $tu_a (i32.and (local.get $op) (i32.const 0xF)))
        (global.set $tu_imm
          (select (i32.shr_s (local.get $op) (i32.const 8)) (i32.load offset=8 (local.get $p))
                  (i32.ge_u (local.get $fn) (i32.const 467))))
        (return (i32.const 1))))

    ;; -- base-specialized load/store dword (339..354): the base register is
    ;; named by the handler index itself and the operand is the data register.
    ;; Same semantics as 26/27; the decoder picks these to save one br_table.
    (if (i32.and (i32.ge_u (local.get $fn) (global.get $TH_LOAD32_RO_BASE))
                 (i32.le_u (local.get $fn) (global.get $TH_LOAD32_RO_BASE_LAST)))
      (then
        (global.set $tu_kind (global.get $TU_LOAD32))
        (global.set $tu_d (i32.and (local.get $op) (i32.const 0xF)))
        (global.set $tu_a (i32.sub (local.get $fn) (global.get $TH_LOAD32_RO_BASE)))
        (global.set $tu_imm (i32.load offset=8 (local.get $p)))
        (return (i32.const 1))))
    (if (i32.and (i32.ge_u (local.get $fn) (global.get $TH_STORE32_RO_BASE))
                 (i32.le_u (local.get $fn) (global.get $TH_STORE32_RO_BASE_LAST)))
      (then
        (global.set $tu_kind (global.get $TU_STORE32))
        (global.set $tu_d (i32.and (local.get $op) (i32.const 0xF)))
        (global.set $tu_a (i32.sub (local.get $fn) (global.get $TH_STORE32_RO_BASE)))
        (global.set $tu_imm (i32.load offset=8 (local.get $p)))
        (return (i32.const 1))))

    ;; -- absolute dword load/store: operand = reg, guest address in the next
    ;; word. The decoder resolved the address at decode time, so there is no
    ;; base register to read and nothing here can be wrong about one; the
    ;; address still goes through $gl32/$gs32, so translation, page crossing
    ;; and SMC invalidation are the scalar path's, unchanged.
    (if (i32.or (i32.eq (local.get $fn) (i32.const 20))
                (i32.eq (local.get $fn) (i32.const 21)))
      (then
        (global.set $tu_kind
          (select (global.get $TU_LOAD32_ABS) (global.get $TU_STORE32_ABS)
                  (i32.eq (local.get $fn) (i32.const 20))))
        (global.set $tu_d (i32.and (local.get $op) (i32.const 0xF)))
        (global.set $tu_imm (call $tree_abs_addr (i32.load offset=8 (local.get $p))))
        (return (i32.const 1))))

    ;; -- sub-register ALU and MOV, byte and word -----------------------------
    ;; ADC (2) and SBB (3) are allowed now: $do_alu_sized implements them with
    ;; the same $get_cf the scalar handler calls, and the tree keeps the
    ;; lazy-flag globals current wherever a reader exists. They are simply
    ;; never elided -- see $tree_uop_flag_writes. Every sub-op goes through the
    ;; same $do_alu_sized the scalar handler calls, with the same mask and
    ;; sign-shift, so the five lazy-flag fields land exactly where the scalar
    ;; sequence would have left them -- including flag_sign_shift, which is 7
    ;; for a byte op and 15 for a word and is the field a hand-written arm
    ;; would have forgotten.
    (if (i32.or (i32.eq (local.get $fn) (i32.const 153))
        (i32.or (i32.eq (local.get $fn) (i32.const 154))
        (i32.or (i32.eq (local.get $fn) (i32.const 206))
                (i32.eq (local.get $fn) (i32.const 207)))))
      (then
        ;; H207's sub-op sits at bit 4, not bit 8, unlike the other three.
        (local.set $type
          (select
            (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF))
            (i32.and (i32.shr_u (local.get $op) (i32.const 8)) (i32.const 0xF))
            (i32.eq (local.get $fn) (i32.const 207))))
        (if (i32.gt_u (local.get $type) (i32.const 7)) (then (return (i32.const 0))))
        (global.set $tu_b
          (i32.or (i32.shl (local.get $type) (global.get $TU_B_ALU_SHIFT))
                  (select (global.get $TU_B_WORD) (i32.const 0)
                          (i32.ge_u (local.get $fn) (i32.const 206)))))
        (if (i32.or (i32.eq (local.get $fn) (i32.const 153))
                    (i32.eq (local.get $fn) (i32.const 206)))
          (then
            ;; register/register: dst<<4 | src, both sub-register indices.
            (local.set $count (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
            (global.set $tu_d (call $tree_sub_reg (local.get $count) (local.get $fn)))
            (global.set $tu_a
              (call $tree_sub_reg (i32.and (local.get $op) (i32.const 0xF)) (local.get $fn)))
            (global.set $tu_b (i32.or (global.get $tu_b)
              (i32.or (select (global.get $TU_B_LANE_D) (i32.const 0)
                        (call $tree_sub_hi (local.get $count) (local.get $fn)))
                      (select (global.get $TU_B_LANE_A) (i32.const 0)
                        (call $tree_sub_hi (i32.and (local.get $op) (i32.const 0xF))
                                           (local.get $fn))))))
            (global.set $tu_kind (global.get $TU_ALU_SUB_RR))
            (return (i32.const 1))))
        ;; register/immediate: the register is the low nibble, the immediate is
        ;; the next word. H154 masks it to a byte, H207 to a word; the mask is
        ;; applied at run time from the width bit, so store the raw word.
        (local.set $count (i32.and (local.get $op) (i32.const 0xF)))
        (global.set $tu_d (call $tree_sub_reg (local.get $count) (local.get $fn)))
        (global.set $tu_b (i32.or (global.get $tu_b)
          (select (global.get $TU_B_LANE_D) (i32.const 0)
                  (call $tree_sub_hi (local.get $count) (local.get $fn)))))
        (global.set $tu_imm (i32.load offset=8 (local.get $p)))
        (global.set $tu_kind (global.get $TU_ALU_SUB_RI))
        (return (i32.const 1))))

    ;; MOV reg8,reg8 / MOV r16,r16 / MOV reg8,imm8 / MOV r16,imm16. No flags.
    ;; H155 bit 8 means the decoder fused a SECOND adjacent byte MOV into the
    ;; same op. That is two register writes from one descriptor slot, which
    ;; this array cannot express, so it declines -- a missed lowering, never a
    ;; half-executed one.
    (if (i32.or (i32.eq (local.get $fn) (i32.const 155))
                (i32.eq (local.get $fn) (i32.const 210)))
      (then
        (if (i32.and (i32.eq (local.get $fn) (i32.const 155))
                     (i32.ne (i32.and (local.get $op) (i32.const 0x100)) (i32.const 0)))
          (then (return (i32.const 0))))
        (local.set $count (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
        (global.set $tu_d (call $tree_sub_reg (local.get $count) (local.get $fn)))
        (global.set $tu_a
          (call $tree_sub_reg (i32.and (local.get $op) (i32.const 0xF)) (local.get $fn)))
        (global.set $tu_b
          (i32.or
            (select (global.get $TU_B_WORD) (i32.const 0)
                    (i32.eq (local.get $fn) (i32.const 210)))
            (i32.or (select (global.get $TU_B_LANE_D) (i32.const 0)
                      (call $tree_sub_hi (local.get $count) (local.get $fn)))
                    (select (global.get $TU_B_LANE_A) (i32.const 0)
                      (call $tree_sub_hi (i32.and (local.get $op) (i32.const 0xF))
                                         (local.get $fn))))))
        (global.set $tu_kind (global.get $TU_MOV_SUB_RR))
        (return (i32.const 1))))
    (if (i32.or (i32.eq (local.get $fn) (i32.const 156))
                (i32.eq (local.get $fn) (i32.const 236)))
      (then
        (local.set $count (i32.and (local.get $op) (i32.const 0xF)))
        (global.set $tu_d (call $tree_sub_reg (local.get $count) (local.get $fn)))
        (global.set $tu_b
          (i32.or
            (select (global.get $TU_B_WORD) (i32.const 0)
                    (i32.eq (local.get $fn) (i32.const 236)))
            (select (global.get $TU_B_LANE_D) (i32.const 0)
                    (call $tree_sub_hi (local.get $count) (local.get $fn)))))
        (global.set $tu_imm (i32.load offset=8 (local.get $p)))
        (global.set $tu_kind (global.get $TU_MOV_SUB_RI))
        (return (i32.const 1))))

    ;; -- word memory: absolute and base+disp ---------------------------------
    ;; H164 carries the destination register index directly in the operand and
    ;; takes its address from the next thread word; H165/H166 are the
    ;; $ea_from_op pair, dst<<4 | base with the displacement in the word --
    ;; exactly the H28/H29 encoding one width up. mw3's alpha blend at
    ;; 0x526f54 is built out of these three and nothing else new.
    (if (i32.eq (local.get $fn) (i32.const 164))
      (then
        (global.set $tu_d (i32.and (local.get $op) (i32.const 7)))
        (global.set $tu_b (global.get $TU_B_WORD))
        (global.set $tu_imm (call $tree_abs_addr (i32.load offset=8 (local.get $p))))
        (global.set $tu_kind (global.get $TU_LOAD16_ABS))
        (return (i32.const 1))))
    (if (i32.or (i32.eq (local.get $fn) (i32.const 165))
                (i32.eq (local.get $fn) (i32.const 166)))
      (then
        (global.set $tu_d
          (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 7)))
        (global.set $tu_a (i32.and (local.get $op) (i32.const 0xF)))
        (global.set $tu_b (global.get $TU_B_WORD))
        (global.set $tu_imm (i32.load offset=8 (local.get $p)))
        (global.set $tu_kind
          (select (global.get $TU_LOAD16_RO) (global.get $TU_STORE16_RO)
                  (i32.eq (local.get $fn) (i32.const 166))))
        (return (i32.const 1))))

    ;; -- byte memory: absolute, base+disp, and the two widening loads --------
    ;; H24/H25 carry the reg8 index directly in the operand; H28/H29 and
    ;; H143/H144 carry dst<<4 | base. MOVZX/MOVSX write the whole destination,
    ;; so they are ordinary full-width kinds with a narrow load in front.
    (if (i32.or (i32.eq (local.get $fn) (i32.const 24))
                (i32.eq (local.get $fn) (i32.const 25)))
      (then
        (local.set $count (i32.and (local.get $op) (i32.const 0xF)))
        (global.set $tu_d (i32.and (local.get $count) (i32.const 3)))
        (global.set $tu_b
          (select (global.get $TU_B_LANE_D) (i32.const 0)
                  (i32.ge_u (local.get $count) (i32.const 4))))
        (global.set $tu_imm (call $tree_abs_addr (i32.load offset=8 (local.get $p))))
        (global.set $tu_kind
          (select (global.get $TU_LOAD8_ABS) (global.get $TU_STORE8_ABS)
                  (i32.eq (local.get $fn) (i32.const 24))))
        (return (i32.const 1))))
    (if (i32.or (i32.eq (local.get $fn) (i32.const 28))
                (i32.eq (local.get $fn) (i32.const 29)))
      (then
        (local.set $count (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
        (global.set $tu_d (i32.and (local.get $count) (i32.const 3)))
        (global.set $tu_a (i32.and (local.get $op) (i32.const 0xF)))
        (global.set $tu_b
          (select (global.get $TU_B_LANE_D) (i32.const 0)
                  (i32.ge_u (local.get $count) (i32.const 4))))
        (global.set $tu_imm (i32.load offset=8 (local.get $p)))
        (global.set $tu_kind
          (select (global.get $TU_LOAD8_RO) (global.get $TU_STORE8_RO)
                  (i32.eq (local.get $fn) (i32.const 28))))
        (return (i32.const 1))))
    (if (i32.or (i32.eq (local.get $fn) (i32.const 143))
                (i32.eq (local.get $fn) (i32.const 144)))
      (then
        (global.set $tu_d (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
        (global.set $tu_a (i32.and (local.get $op) (i32.const 0xF)))
        (global.set $tu_imm (i32.load offset=8 (local.get $p)))
        (global.set $tu_kind
          (select (global.get $TU_MOVZX8_RO) (global.get $TU_MOVSX8_RO)
                  (i32.eq (local.get $fn) (i32.const 143))))
        (return (i32.const 1))))

    ;; -- byte SIB forms: H400 widening load, H401 byte store, H402 byte
    ;; immediate store. Same info/disp encoding as the dword SIB kinds; H402
    ;; carries its immediate in the OPERAND rather than a word, which is why it
    ;; is the one kind whose immediate rides in `b`.
    (if (i32.or (i32.eq (local.get $fn) (i32.const 400))
        (i32.or (i32.eq (local.get $fn) (i32.const 401))
                (i32.eq (local.get $fn) (i32.const 402))))
      (then
        (local.set $type (i32.load offset=8 (local.get $p)))   ;; info word
        (global.set $tu_a (i32.and (local.get $type) (i32.const 0xF)))
        (global.set $tu_b
          (i32.or (i32.and (i32.shr_u (local.get $type) (i32.const 4)) (i32.const 0xF))
                  (i32.shl (i32.and (i32.shr_u (local.get $type) (i32.const 8)) (i32.const 3))
                           (i32.const 4))))
        (global.set $tu_imm (i32.load offset=12 (local.get $p)))
        (if (i32.eq (local.get $fn) (i32.const 400))
          (then
            (global.set $tu_d (i32.and (local.get $op) (i32.const 0xF)))
            (global.set $tu_kind (global.get $TU_MOVSX8_SIB))
            (return (i32.const 1))))
        (if (i32.eq (local.get $fn) (i32.const 401))
          (then
            (local.set $count (i32.and (local.get $op) (i32.const 0xF)))
            (global.set $tu_d (i32.and (local.get $count) (i32.const 3)))
            (global.set $tu_b (i32.or (global.get $tu_b)
              (select (global.get $TU_B_LANE_D) (i32.const 0)
                      (i32.ge_u (local.get $count) (i32.const 4)))))
            (global.set $tu_kind (global.get $TU_STORE8_SIB))
            (return (i32.const 1))))
        (global.set $tu_b (i32.or (global.get $tu_b)
          (i32.shl (i32.and (local.get $op) (i32.const 0xFF))
                   (global.get $TU_B_IMM8_SHIFT))))
        (global.set $tu_kind (global.get $TU_MOV_M8_I_SIB))
        (return (i32.const 1))))

    ;; -- SIB forms: operand = the data/dst register, then an info word and a
    ;; displacement word. info = base | index<<4 | scale<<8, with 0xF in either
    ;; register nibble meaning that term is absent -- $sib_ea's encoding, split
    ;; here into `a` (base) and `b` (index | scale<<4) so the handler's EA
    ;; arithmetic reads the same two fields for every SIB kind.
    ;;
    ;; H148 LEA, H389 dword load, H420 dword store, and H149's own EA compute,
    ;; which shares their info/disp encoding exactly -- the operand differs
    ;; only in that bit 8 selects the fused byte-load form and the low three
    ;; bits are then its destination reg8.
    ;; -- REP MOVSB/MOVSD/STOSB/STOSD (H82..H85) -----------------------------
    ;; See $TU_REP_STR. Contiguous handler indices, checked as a range, and
    ;; the operand word is unused by all four.
    (if (i32.and (i32.ge_u (local.get $fn) (i32.const 82))
                 (i32.le_u (local.get $fn) (i32.const 85)))
      (then
        (global.set $tu_d (i32.sub (local.get $fn) (i32.const 82)))
        (global.set $tu_a (i32.const 0xF))
        (global.set $tu_b (i32.const 0xF))
        (global.set $tu_kind (global.get $TU_REP_STR))
        (return (i32.const 1))))

    (if (i32.eq (local.get $fn) (i32.const 149))
      (then
        (local.set $type (i32.load offset=8 (local.get $p)))   ;; info word
        (global.set $tu_a (i32.and (local.get $type) (i32.const 0xF)))
        (global.set $tu_b
          (i32.or (i32.and (i32.shr_u (local.get $type) (i32.const 4)) (i32.const 0xF))
                  (i32.shl (i32.and (i32.shr_u (local.get $type) (i32.const 8)) (i32.const 3))
                           (i32.const 4))))
        (global.set $tu_imm (i32.load offset=12 (local.get $p)))
        (if (i32.and (local.get $op) (i32.const 0x100))
          (then
            ;; The fused byte load: reg8 index in the low three bits, so the
            ;; container is `& 3` and the high-byte lane is index >= 4 --
            ;; $set_reg8's own rule, which is what the handler calls.
            (local.set $count (i32.and (local.get $op) (i32.const 7)))
            (global.set $tu_d (i32.and (local.get $count) (i32.const 3)))
            (global.set $tu_b (i32.or (global.get $tu_b)
              (select (global.get $TU_B_LANE_D) (i32.const 0)
                      (i32.ge_u (local.get $count) (i32.const 4)))))
            (global.set $tu_kind (global.get $TU_EA_SIB_LD8))
            (return (i32.const 1))))
        (global.set $tu_kind (global.get $TU_EA_SIB))
        (return (i32.const 1))))

    (if (i32.or (i32.eq (local.get $fn) (i32.const 148))
        (i32.or (i32.eq (local.get $fn) (i32.const 389))
                (i32.eq (local.get $fn) (i32.const 420))))
      (then
        (local.set $type (i32.load offset=8 (local.get $p)))   ;; info word
        (global.set $tu_d (i32.and (local.get $op) (i32.const 0xF)))
        (global.set $tu_a (i32.and (local.get $type) (i32.const 0xF)))
        (global.set $tu_b
          (i32.or (i32.and (i32.shr_u (local.get $type) (i32.const 4)) (i32.const 0xF))
                  (i32.shl (i32.and (i32.shr_u (local.get $type) (i32.const 8)) (i32.const 3))
                           (i32.const 4))))
        (global.set $tu_imm (i32.load offset=12 (local.get $p)))
        (if (i32.eq (local.get $fn) (i32.const 148))
          (then (global.set $tu_kind (global.get $TU_LEA_SIB)) (return (i32.const 1))))
        (if (i32.eq (local.get $fn) (i32.const 389))
          (then (global.set $tu_kind (global.get $TU_LOAD32_SIB)) (return (i32.const 1))))
        (global.set $tu_kind (global.get $TU_STORE32_SIB))
        (global.set $tu_extra (i32.const 1))
        (return (i32.const 1))))

    ;; -- shift/rotate by an immediate --------------------------------------
    ;; operand = reg | type<<8 | count<<16, count 0xFF meaning CL. CL is
    ;; declined: the count would have to be read out of the local register
    ;; file mid-loop, which is a relaxation, not a correctness question, and
    ;; it is not in this cut. RCL/RCR (types 2/3) are flag CONSUMERS and are
    ;; declined for real -- they read CF, which is what this family forbids.
    (if (i32.eq (local.get $fn) (i32.const 53))
      (then
        (local.set $type (i32.and (i32.shr_u (local.get $op) (i32.const 8)) (i32.const 0xFF)))
        (local.set $count (i32.and (i32.shr_u (local.get $op) (i32.const 16)) (i32.const 0xFF)))
        (if (i32.eq (local.get $count) (i32.const 0xFF)) (then (return (i32.const 0))))
        (if (i32.eqz (i32.or (i32.eq (local.get $type) (i32.const 0))
                     (i32.or (i32.eq (local.get $type) (i32.const 1))
                     (i32.or (i32.eq (local.get $type) (i32.const 4))
                     (i32.or (i32.eq (local.get $type) (i32.const 5))
                     (i32.or (i32.eq (local.get $type) (i32.const 6))
                             (i32.eq (local.get $type) (i32.const 7))))))))
          (then (return (i32.const 0))))
        (global.set $tu_kind (global.get $TU_SHIFT))
        (global.set $tu_d (i32.and (local.get $op) (i32.const 0xF)))
        (global.set $tu_a (local.get $type))
        (global.set $tu_imm (local.get $count))
        (return (i32.const 1))))

    ;; -- x87 ----------------------------------------------------------------
    ;; H188 $th_fpu_mem: op = (group<<4)|reg, address in the next word -- and
    ;; that word can be $SIB_SENTINEL, which is why it goes through
    ;; $tree_abs_addr like every other $read_addr consumer. `d` is inert (the
    ;; op defines no register, and $tree_uop_is_store says so), `a` is 0xF
    ;; because there is no base, so the hoisted EA is the address itself.
    (if (i32.eq (local.get $fn) (i32.const 188))
      (then
        (local.set $type  (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
        (local.set $count (i32.and (local.get $op) (i32.const 0xF)))
        (if (i32.eqz (call $tree_x87_mem_ok (local.get $type) (local.get $count)))
          (then (return (call $tree_x87_decline
                          (local.get $type) (local.get $count) (i32.const 0xF)))))
        (global.set $tu_a (i32.const 0xF))
        (global.set $tu_b (call $tree_x87_b
          (local.get $type) (local.get $count) (i32.const 0)))
        (global.set $tu_imm (call $tree_abs_addr (i32.load offset=8 (local.get $p))))
        (global.set $tu_kind (global.get $TU_X87_MEM))
        (return (i32.const 1))))

    ;; H190 $th_fpu_mem_ro: op = (group<<8)|(reg<<4)|base, disp in the next
    ;; word. The base is read out of the run's register LOCAL, which is the
    ;; whole point -- the scalar handler pays a $get_reg for it.
    (if (i32.eq (local.get $fn) (i32.const 190))
      (then
        (local.set $type  (i32.and (i32.shr_u (local.get $op) (i32.const 8)) (i32.const 0xF)))
        (local.set $count (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
        (if (i32.eqz (call $tree_x87_mem_ok (local.get $type) (local.get $count)))
          (then (return (call $tree_x87_decline
                          (local.get $type) (local.get $count) (i32.const 0xF)))))
        (global.set $tu_a (i32.and (local.get $op) (i32.const 0xF)))
        (global.set $tu_b (call $tree_x87_b
          (local.get $type) (local.get $count) (i32.const 0)))
        (global.set $tu_imm (i32.load offset=8 (local.get $p)))
        (global.set $tu_kind (global.get $TU_X87_MRO))
        (return (i32.const 1))))

    ;; H189 $th_fpu_reg: op = (group<<8)|(reg<<4)|rm. No memory, no address.
    (if (i32.eq (local.get $fn) (i32.const 189))
      (then
        (local.set $type  (i32.and (i32.shr_u (local.get $op) (i32.const 8)) (i32.const 0xF)))
        (local.set $count (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
        (global.set $tu_a (i32.const 0xF))
        (global.set $tu_b (call $tree_x87_b
          (local.get $type) (local.get $count)
          (i32.and (local.get $op) (i32.const 0xF))))
        ;; DF E0 = FNSTSW AX. `d` names EAX so the live-out mask picks it up
        ;; through the ordinary path -- the arm writes the local itself and
        ;; clears $wrote, so the generic writeback does not fight it.
        (if (i32.and
              (i32.and (i32.eq (local.get $type) (i32.const 7))
                       (i32.eq (local.get $count) (i32.const 4)))
              (i32.eqz (i32.and (local.get $op) (i32.const 0xF))))
          (then
            (global.set $tu_d (i32.const 0))
            (global.set $tu_kind (global.get $TU_X87_SW_AX))
            (return (i32.const 1))))
        (if (i32.eqz (call $tree_x87_reg_ok (local.get $type) (local.get $count)
                       (i32.and (local.get $op) (i32.const 0xF))))
          (then (return (call $tree_x87_decline (local.get $type) (local.get $count)
                          (i32.and (local.get $op) (i32.const 0xF))))))
        (global.set $tu_kind (global.get $TU_X87_REG))
        (return (i32.const 1))))

    (i32.const 0))

  ;; Does this micro-op kind write MEMORY rather than a register? The live-out
  ;; mask is built from the answer, and getting it wrong in the permissive
  ;; direction is the one mistake that would not show up as a crash: a store
  ;; whose `d` was folded into live_out republishes the data register with the
  ;; value it already held, which is harmless, while a load left OUT of the
  ;; mask silently drops the loaded value at exit. So the list is exact, and it
  ;; is one function rather than an inline test at each site because there are
  ;; now three of those sites and a store kind added to only two of them would
  ;; be a live-lock nobody sees.
  (func $tree_uop_is_store (param $kind i32) (result i32)
    (i32.or (i32.eq (local.get $kind) (global.get $TU_STORE32))
    (i32.or (i32.eq (local.get $kind) (global.get $TU_STORE32_ABS))
    (i32.or (i32.eq (local.get $kind) (global.get $TU_STORE32_SIB))
    (i32.or (i32.eq (local.get $kind) (global.get $TU_STORE8_RO))
    (i32.or (i32.eq (local.get $kind) (global.get $TU_STORE8_ABS))
    (i32.or (i32.eq (local.get $kind) (global.get $TU_STORE16_RO))
    (i32.or (i32.eq (local.get $kind) (global.get $TU_STORE8_SIB))
    (i32.or (i32.eq (local.get $kind) (global.get $TU_MOV_M8_I_SIB))
            ;; Not a store, but the same question for the same reason: a bare
            ;; EA compute defines no register at all, so naming one in the
            ;; live-out mask would publish a register the body never wrote.
    (i32.or (i32.eq (local.get $kind) (global.get $TU_EA_SIB))
            ;; Nor this one: TU_REP_STR writes whatever the string op writes,
            ;; which is not `d` (that field names the variant), and pass 1
            ;; publishes 0xFF for it explicitly instead.
    (i32.or (i32.eq (local.get $kind) (global.get $TU_REP_STR))
            ;; The three x87 kinds write the x87 stack and, for FST/FISTP,
            ;; memory -- never a general register, and their `d` is inert.
            ;; TU_X87_SW_AX is the exception and is absent from this list on
            ;; purpose: it really does define EAX, `d` really is 0, and the
            ;; live-out mask has to say so.
    (i32.or (i32.eq (local.get $kind) (global.get $TU_X87_MEM))
    (i32.or (i32.eq (local.get $kind) (global.get $TU_X87_MRO))
            ;; CMP writes flags and nothing else. Its `d` names the register
            ;; it SUBTRACTS FROM, which the live-out mask must not claim.
    (i32.or (i32.eq (local.get $kind) (global.get $TU_CMP_RR))
    (i32.or (i32.eq (local.get $kind) (global.get $TU_CMP_RI))
            (i32.eq (local.get $kind) (global.get $TU_X87_REG)))))))))))))))))

  ;; Which lazy-flag fields a micro-op WRITES, as a $TF_F_* mask. Anything not
  ;; listed writes none: every MOV, LEA, NOT, load and store in the family is
  ;; flag-transparent, exactly as the x86 instruction it stands for is.
  ;;
  ;; TU_SHIFT deliberately returns 0 even though $do_shift usually writes four
  ;; fields, because a shift by zero writes NONE of them -- the count is a
  ;; runtime value, so the write is conditional and cannot cover an earlier
  ;; op's. Returning 0 makes it cover nothing; $tree_uop_flag_reads makes it
  ;; keep everything before it alive; and the pass never marks it elidable
  ;; because a zero write set is not a candidate. All three are needed.
  (func $tree_uop_flag_writes (param $kind i32) (param $b i32) (result i32)
    (local $sub i32)
    (if (i32.or (i32.eq (local.get $kind) (global.get $TU_ALU_SUB_RR))
                (i32.eq (local.get $kind) (global.get $TU_ALU_SUB_RI)))
      (then
        ;; The sub-width ALU goes through $do_alu_sized, which writes what its
        ;; 32-bit twin writes and then fixes flag_res and flag_sign_shift.
        (local.set $sub
          (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_ALU_SHIFT)) (i32.const 0xF)))
        ;; ADC/SBB report NO writes, which makes them permanently inelidable
        ;; and stops them covering anything earlier. That is deliberately
        ;; conservative in both directions: their CF fix-up writes flag_op,
        ;; flag_a and flag_b outside $do_alu_sized, so a NOFLAGS variant would
        ;; have to replicate that too, and under-reporting a write set can only
        ;; ever keep an earlier write alive that could have gone.
        (if (i32.or (i32.eq (local.get $sub) (i32.const 2))
                    (i32.eq (local.get $sub) (i32.const 3)))
          (then (return (i32.const 0))))
        (return
          (if (result i32)
              (i32.or (i32.eq (local.get $sub) (i32.const 1))
              (i32.or (i32.eq (local.get $sub) (i32.const 4))
                      (i32.eq (local.get $sub) (i32.const 6))))
            (then (global.get $TF_F_LOG))
            (else (global.get $TF_F_ALL))))))
    (if (i32.or (i32.eq (local.get $kind) (global.get $TU_ADD_RR))
        (i32.or (i32.eq (local.get $kind) (global.get $TU_ADD_RI))
        (i32.or (i32.eq (local.get $kind) (global.get $TU_SUB_RR))
        (i32.or (i32.eq (local.get $kind) (global.get $TU_SUB_RI))
                (i32.eq (local.get $kind) (global.get $TU_NEG))))))
      (then (return (global.get $TF_F_ALL))))
    (if (i32.or (i32.eq (local.get $kind) (global.get $TU_AND_RR))
        (i32.or (i32.eq (local.get $kind) (global.get $TU_AND_RI))
        (i32.or (i32.eq (local.get $kind) (global.get $TU_OR_RR))
        (i32.or (i32.eq (local.get $kind) (global.get $TU_OR_RI))
        (i32.or (i32.eq (local.get $kind) (global.get $TU_XOR_RR))
                (i32.eq (local.get $kind) (global.get $TU_XOR_RI)))))))
      (then (return (global.get $TF_F_LOG))))
    (if (i32.or (i32.eq (local.get $kind) (global.get $TU_IMUL_RR))
                (i32.eq (local.get $kind) (global.get $TU_IMUL_RI)))
      (then (return (global.get $TF_F_MUL))))
    (if (i32.or (i32.eq (local.get $kind) (global.get $TU_INC))
                (i32.eq (local.get $kind) (global.get $TU_DEC)))
      (then (return (global.get $TF_F_INC))))
    ;; CMP is a SUB that keeps only the flags, so it writes exactly what
    ;; $set_flags_sub writes.
    (if (i32.or (i32.eq (local.get $kind) (global.get $TU_CMP_RR))
                (i32.eq (local.get $kind) (global.get $TU_CMP_RI)))
      (then (return (global.get $TF_F_ALL))))
    (i32.const 0))

  ;; Which fields a micro-op READS. All of them read CF: INC/DEC snapshot it
  ;; into $saved_cf because x86 says they preserve it, RCL/RCR rotate through
  ;; it, and ADC/SBB add it. A read makes every earlier write of those fields
  ;; live again, which is what stops the pass eliding the `and` in
  ;; `and eax,ecx / dec ecx` -- $set_flags_dec would read the CF that `and`
  ;; left behind, and $get_cf reaches flag_op/res/a/b to find it.
  ;;
  ;; This is also the ONLY thing standing between a folded tree and a wrong
  ;; answer once interior consumers are allowed: the consumer reads the
  ;; lazy-flag globals, so every write it can observe has to still be there.
  (func $tree_uop_flag_reads (param $kind i32) (param $b i32) (result i32)
    (local $sub i32)
    (if (i32.or (i32.eq (local.get $kind) (global.get $TU_INC))
        (i32.or (i32.eq (local.get $kind) (global.get $TU_DEC))
                (i32.eq (local.get $kind) (global.get $TU_SHIFT))))
      (then (return (global.get $TF_F_CFRD))))
    (if (i32.or (i32.eq (local.get $kind) (global.get $TU_ADC_RR))
        (i32.or (i32.eq (local.get $kind) (global.get $TU_ADC_RI))
        (i32.or (i32.eq (local.get $kind) (global.get $TU_SBB_RR))
                (i32.eq (local.get $kind) (global.get $TU_SBB_RI)))))
      (then (return (global.get $TF_F_CFRD))))
    (if (i32.or (i32.eq (local.get $kind) (global.get $TU_ALU_SUB_RR))
                (i32.eq (local.get $kind) (global.get $TU_ALU_SUB_RI)))
      (then
        (local.set $sub
          (i32.and (i32.shr_u (local.get $b) (global.get $TU_B_ALU_SHIFT)) (i32.const 0xF)))
        (if (i32.or (i32.eq (local.get $sub) (i32.const 2))
                    (i32.eq (local.get $sub) (i32.const 3)))
          (then (return (global.get $TF_F_CFRD))))))
    (i32.const 0))

  ;; The sub-width ALU with the flag half removed. Only reachable from a
  ;; micro-op the dead-flag pass proved nobody reads the flags of, so the
  ;; masking is the whole contract: $do_alu_sized's own result for these six
  ;; sub-ops is exactly this value. ADC (2) and SBB (3) are absent because
  ;; they are declined at classification -- they read CF.
  (func $tree_alu_sized_noflags
    (param $op i32) (param $a i32) (param $b i32) (param $mask i32) (result i32)
    (block $cmp (block $xor (block $sub (block $and
      (block $sbb (block $adc (block $or (block $add
        (br_table $add $or $adc $sbb $and $sub $xor $cmp (local.get $op)))
        (return (i32.and (i32.add (local.get $a) (local.get $b)) (local.get $mask))))
        (return (i32.and (i32.or  (local.get $a) (local.get $b)) (local.get $mask))))
        (unreachable))
        (unreachable))
        (return (i32.and (i32.and (local.get $a) (local.get $b)) (local.get $mask))))
        (return (i32.and (i32.sub (local.get $a) (local.get $b)) (local.get $mask))))
        (return (i32.and (i32.xor (local.get $a) (local.get $b)) (local.get $mask))))
    ;; 7 = CMP: no register write. The caller clears $wrote, so the value is
    ;; never used; returning `a` keeps it harmless if that ever changes.
    (local.get $a))

  ;; Count a terminator decline and return the decline. Written as a function
  ;; because the terminator has four separate reject sites and a counter
  ;; bumped at three of them is worse than no counter at all.
  ;;
  ;; Under --trace-loopmatch it also emits one authoritative record per
  ;; declined block -- marker, entry, reason, detail -- on the same log_i32
  ;; channel $loop_trace_block uses. A count says the bucket is large; only
  ;; the reason says which shapes are in it, and deriving that host-side would
  ;; mean a second copy of these gates in JS that drifts from these ones.
  ;;   1 last op is not a Jcc                  detail = its handler index
  ;;   2 the Jcc does not branch to this entry detail = the target it took
  ;;   3 walk-back hit a non-micro-op          detail = its handler index
  ;;   4 walk-back hit a flag-touching op      detail = its handler index
  ;;   5 ran out of ops with no flag producer  detail = 0
  ;;   6 producer is none of H64/65/19/10      detail = its handler index
  (func $tree_decl_term_bump (param $why i32) (param $detail i32) (result i32)
    (global.set $tree_decl_term (i32.add (global.get $tree_decl_term) (i32.const 1)))
    (if (global.get $loop_trace)
      (then
        (if (i32.or (i32.eqz (global.get $loop_trace_eip))
                    (i32.eq (global.get $loop_trace_eip) (global.get $tree_decl_eip)))
          (then
            (call $host_log_i32 (i32.const 0x100C0001))
            (call $host_log_i32 (global.get $tree_decl_eip))
            (call $host_log_i32 (local.get $why))
            (call $host_log_i32 (local.get $detail))))))
    (i32.const 0))

  ;; Recognize a self-loop whose interior is pure full-width integer dataflow
  ;; and lower the whole block to one H454 descriptor.
  ;; Micro-op j of the descriptor is op j of the block -- except that the
  ;; terminator at $tidx is not a micro-op at all, so every index from there
  ;; on shifts up by one. Both passes and the scratch scan go through here so
  ;; they cannot disagree about which op a micro-op index names.
  (func $tree_op_for_uop (param $j i32) (param $tidx i32) (result i32)
    (call $loop_op_at
      (select (i32.add (local.get $j) (i32.const 1)) (local.get $j)
              (i32.ge_u (local.get $j) (local.get $tidx)))))

  ;; Bench/test hook: replace the block at $region_spec_eip with the region
  ;; descriptor the harness prepared in guest memory. Runs before every other
  ;; family and before the self-loop test, because a region entry block is
  ;; usually not a self-loop and would never reach the matcher otherwise.
  ;;
  ;; It rewinds $thread_alloc to $tstart and clears $op_index_n exactly as
  ;; $loop_try_tree_fold's emit does -- the ops the decoder just emitted for
  ;; this block are the bytes the descriptor is written over, and $decode_run
  ;; reads $op_index_n to decide whether to extend the run, so leaving it set
  ;; would let the run append a fall-through block to a super-op that never
  ;; falls through.
  (func $region_try_install (param $start_eip i32) (param $tstart i32) (result i32)
    (local $i i32) (local $n i32) (local $p i32)
    ;; One executor, one switch: --block-exec arms the hand-fed multi-block
    ;; descriptor path too. $region_fold_enabled survives as the bench's own
    ;; narrower hook (--toggle=region), so an A/B can still move only this
    ;; path. Either enable is enough; with no spec armed for this EIP the
    ;; function returns immediately anyway, so a real run pays nothing.
    (if (i32.and (i32.eqz (global.get $region_fold_enabled))
                 (i32.eqz (global.get $block_exec_enabled)))
      (then (return (i32.const 0))))
    (if (i32.eqz (global.get $region_spec_eip)) (then (return (i32.const 0))))
    (if (i32.ne (local.get $start_eip) (global.get $region_spec_eip))
      (then (return (i32.const 0))))
    (local.set $n (global.get $region_spec_words))
    (if (i32.eqz (local.get $n)) (then (return (i32.const 0))))
    ;; The descriptor has to fit the slack $decode_block reserved, or $te's
    ;; overflow backstop fires in the middle of a block that is already being
    ;; overwritten. Refuse instead.
    (if (i32.gt_u (i32.add (i32.mul (local.get $n) (i32.const 4)) (i32.const 8))
                  (i32.const 4096))
      (then (return (i32.const 0))))
    (global.set $thread_alloc (local.get $tstart))
    (global.set $op_index_n (i32.const 0))
    (call $te (global.get $LOOP_SUPEROP_TREE) (i32.const 0))
    (local.set $p (global.get $region_spec_ptr))
    (block $done
      (loop $cp
        (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
        (call $te_raw (call $gl32 (i32.add (local.get $p)
                                    (i32.shl (local.get $i) (i32.const 2)))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $cp)))
    (global.set $region_installs (i32.add (global.get $region_installs) (i32.const 1)))
    (global.set $loop_matched_blocks
      (i32.add (global.get $loop_matched_blocks) (i32.const 1)))
    (i32.const 1))

  ;;
  ;; Two passes over the same ops. The first proves eligibility and computes
  ;; the two counts the descriptor header needs before its body (the micro-op
  ;; count and the live-out register mask); the second emits. Classification
  ;; is a pure function of the op record, so the two passes cannot disagree,
  ;; and rewinding $thread_alloc only after the first pass has committed means
  ;; a decline costs nothing.
  (func $loop_try_tree_fold
    (param $start_eip i32) (param $tstart i32) (result i32)
    (local $n i32) (local $i i32) (local $p i32) (local $fn i32) (local $op i32)
    (local $nuops i32) (local $live_out i32) (local $extra i32)
    (local $term_kind i32) (local $term_a i32) (local $term_b i32)
    (local $term_cc i32) (local $term_uop i32) (local $term_imm i32)
    (local $fall i32) (local $back i32)
    (local $covered i32) (local $fwrites i32) (local $tidx i32)
    (local $prev_ea i32) (local $want_ea i32) (local $fused i32)

    (global.set $tree_decl_eip (local.get $start_eip))
    (local.set $n (global.get $op_index_n))
    ;; Two terminator ops plus at least $tree_fold_min_ops of interior.
    (if (i32.lt_u (local.get $n)
          (i32.add (global.get $tree_fold_min_ops) (i32.const 2)))
      (then
        (global.set $tree_decl_short
          (i32.add (global.get $tree_decl_short) (i32.const 1)))
        (return (i32.const 0))))
    (local.set $nuops (i32.sub (local.get $n) (i32.const 2)))
    (if (i32.gt_u (local.get $nuops) (global.get $tree_fold_max_ops))
      (then
        (global.set $tree_decl_long
          (i32.add (global.get $tree_decl_long) (i32.const 1)))
        (return (i32.const 0))))

    ;; -- terminator: the Jcc must close the loop on this block's own entry --
    (local.set $p (call $loop_op_at (i32.sub (local.get $n) (i32.const 1))))
    (local.set $fn (load.field LoopOp handler (local.get $p)))
    ;; H404 is `test r,r + Jcc`, already fused into ONE op by the decoder --
    ;; which is how this shape actually reaches us. A separate H72 survives only
    ;; when something stands between the test and the branch, so the fused form
    ;; is the one worth having, and `producer:test` was the region census's top
    ;; decline in every app it measured. It is both the flag producer and the
    ;; branch, so there is no backward walk to do and no suffix after it.
    (if (i32.eq (local.get $fn) (i32.const 404))
      (then
        (local.set $op (load.field.memarg LoopOp operand (local.get $p)))
        ;; The byte form leaves $flag_sign_shift at 7 and reads the 8-bit
        ;; sub-registers; term_kind 6 is the 32-bit case only.
        (if (i32.and (local.get $op) (i32.const 0x1000))
          (then (return (call $tree_decl_term_bump (i32.const 6) (local.get $fn)))))
        (local.set $fused (i32.const 1))
        (local.set $term_cc
          (i32.and (i32.shr_u (local.get $op) (i32.const 8)) (i32.const 0xF)))
        (local.set $fall (i32.load offset=8  (local.get $p)))
        (local.set $back (i32.load offset=12 (local.get $p)))
        (local.set $term_kind (i32.const 6))
        (local.set $term_a
          (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
        (local.set $term_b (i32.and (local.get $op) (i32.const 0xF)))
        ;; One more interior op than the two-op form: nothing was consumed by a
        ;; separate branch, so the whole prefix is body.
        (local.set $nuops (i32.sub (local.get $n) (i32.const 1)))
        (local.set $tidx  (i32.sub (local.get $n) (i32.const 1)))
        (if (i32.gt_u (local.get $nuops) (global.get $tree_fold_max_ops))
          (then
            (global.set $tree_decl_long
              (i32.add (global.get $tree_decl_long) (i32.const 1)))
            (return (i32.const 0))))))
    (if (i32.eqz (local.get $fused))
      (then
        (if (i32.eqz (i32.and (i32.ge_u (local.get $fn) (i32.const 307))
                              (i32.le_u (local.get $fn) (i32.const 322))))
          (then (return (call $tree_decl_term_bump (i32.const 1) (local.get $fn)))))
        (local.set $term_cc (i32.sub (local.get $fn) (i32.const 307)))
        (local.set $fall (i32.load offset=8  (local.get $p)))
        (local.set $back (i32.load offset=12 (local.get $p)))))
    (if (i32.ne (local.get $back) (local.get $start_eip))
      (then (return (call $tree_decl_term_bump (i32.const 2) (local.get $back)))))

    (if (i32.eqz (local.get $fused)) (then

    ;; -- terminator: the flag producer, and the suffix after it -------------
    ;; It is not always the op immediately before the Jcc. A compiler that
    ;; spills at the bottom of the loop emits `dec edi / mov [esp+8],edx /
    ;; mov [esp+c],edi / jnz`, and mw3's 16-bit alpha blend at 0x526f54 is
    ;; exactly that shape -- two stack stores standing between the counter and
    ;; the branch. Before this walk they cost the whole block: the fixed
    ;; "flag producer at n-2" rule declined it as `terminator`.
    ;;
    ;; So walk back from the Jcc over ops that are micro-ops AND neither write
    ;; nor read a flag field. Those stay ordinary interior micro-ops; they just
    ;; execute after the terminator rather than before it, which $term_pos
    ;; records and the body loop honours. The flag-transparency test is what
    ;; makes that safe -- it is not a reordering, the ops keep their original
    ;; order relative to the counter, and nothing between the producer and
    ;; $eval_cc can disturb what $eval_cc reads.
    (local.set $tidx (i32.sub (local.get $n) (i32.const 2)))
    (block $tfound
      (loop $tscan
        (local.set $p (call $loop_op_at (local.get $tidx)))
        (local.set $fn (load.field LoopOp handler (local.get $p)))
        (br_if $tfound (i32.eq (local.get $fn) (i32.const 64)))
        (br_if $tfound (i32.eq (local.get $fn) (i32.const 65)))
        (br_if $tfound (i32.eq (local.get $fn) (i32.const 19)))
        (br_if $tfound (i32.eq (local.get $fn) (i32.const 10)))
        ;; H72/H73 are `test r,r` and `test r,imm32` -- the census's top decline
        ;; by a wide margin, and the only one present in every app it measured.
        ;; A `test eax,eax / jz` is how a compiler writes "is this pointer
        ;; null", and a `test r,imm / jnz` is how a state machine branches on a
        ;; flag word; declining them cost about six points of coverage on their
        ;; own. They write no register, so nothing else about the shape changes.
        (br_if $tfound (i32.eq (local.get $fn) (i32.const 72)))
        (br_if $tfound (i32.eq (local.get $fn) (i32.const 73)))
        ;; H128 is `reg OP= [base+disp]`; only its CMP form is a terminator,
        ;; and that is checked below. Stopping the walk here rather than
        ;; letting it fail the micro-op test means a non-CMP H128 is reported
        ;; as reason 6 (producer of the wrong kind) instead of reason 3, which
        ;; is the truth about it.
        (br_if $tfound (i32.eq (local.get $fn) (i32.const 128)))
        (if (i32.eqz (call $tree_uop_classify (local.get $p)))
          (then (return (call $tree_decl_term_bump (i32.const 3) (local.get $fn)))))
        (if (i32.or
              (call $tree_uop_flag_writes (global.get $tu_kind) (global.get $tu_b))
              (call $tree_uop_flag_reads (global.get $tu_kind) (global.get $tu_b)))
          (then (return (call $tree_decl_term_bump (i32.const 4) (local.get $fn)))))
        ;; Ran out of ops without finding a producer: not this family.
        (if (i32.eqz (local.get $tidx))
          (then (return (call $tree_decl_term_bump (i32.const 5) (i32.const 0)))))
        (local.set $tidx (i32.sub (local.get $tidx) (i32.const 1)))
        (br $tscan)))
    (local.set $op (load.field.memarg LoopOp operand (local.get $p)))
    (if (i32.or (i32.eq (local.get $fn) (i32.const 64))
                (i32.eq (local.get $fn) (i32.const 65)))
      (then
        ;; dec/inc r + Jcc: the counted form.
        (local.set $term_kind (i32.const 0))
        (local.set $term_uop (i32.eq (local.get $fn) (i32.const 64)))
        (local.set $term_a (i32.and (local.get $op) (i32.const 0xF)))
        (local.set $live_out (i32.shl (i32.const 1) (local.get $term_a))))
      (else (if (i32.eq (local.get $fn) (i32.const 19))
        (then
          ;; cmp r,r + Jcc: the cursor-vs-bound form. Writes no register.
          (local.set $term_kind (i32.const 1))
          (local.set $term_a
            (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
          (local.set $term_b (i32.and (local.get $op) (i32.const 0xF))))
        (else (if (i32.eq (local.get $fn) (i32.const 10))
          (then
            ;; cmp r,imm + Jcc.
            (local.set $term_kind (i32.const 2))
            (local.set $term_a (i32.and (local.get $op) (i32.const 0xF)))
            (local.set $term_b (i32.load offset=8 (local.get $p))))
        (else (if (i32.eq (local.get $fn) (i32.const 72))
          (then
            ;; test r,r + Jcc. Same operand encoding as cmp r,r; only the
            ;; flag helper differs, and the executor picks it off term_kind.
            (local.set $term_kind (i32.const 6))
            (local.set $term_a
              (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
            (local.set $term_b (i32.and (local.get $op) (i32.const 0xF))))
        (else (if (i32.eq (local.get $fn) (i32.const 73))
          (then
            ;; test r,imm32 + Jcc -- the immediate is the op's inline word.
            (local.set $term_kind (i32.const 7))
            (local.set $term_a (i32.and (local.get $op) (i32.const 0xF)))
            (local.set $term_b (i32.load offset=8 (local.get $p))))
          (else (if (i32.and (i32.eq (local.get $fn) (i32.const 128))
                             (i32.eq (i32.and (i32.shr_u (local.get $op) (i32.const 8))
                                              (i32.const 0xF))
                                     (i32.const 7)))
            (then
              ;; cmp r32,[base+disp] + Jcc: the bound lives in MEMORY and is
              ;; re-read every iteration, so this is not a loop-invariant the
              ;; fold could hoist -- the body may be what writes it. `a` is the
              ;; register, `b` the base, and the displacement needs the twelfth
              ;; header word, which exists only for this.
              ;;
              ;; Measured on mw3 0x0042d9b1 (35,840 block entries, 0.89% of the
              ;; window's): a 16-bit copy loop bounded by a dword in memory.
              ;; Only the CMP form qualifies -- every other ALU op here writes
              ;; the register as well, and a terminator that writes is what
              ;; term_kind 0 is for.
              (local.set $term_kind (i32.const 3))
              (local.set $term_a
                (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
              (local.set $term_b (i32.and (local.get $op) (i32.const 0xF)))
              (local.set $term_imm (i32.load offset=8 (local.get $p))))
            (else (return (call $tree_decl_term_bump (i32.const 6) (local.get $fn)))))))))))))))))

    ;; -- pass 1: prove every interior op is a micro-op, collect live-outs ---
    (local.set $i (i32.const 0))
    (block $p1_done
      (loop $p1
        (br_if $p1_done (i32.ge_u (local.get $i) (local.get $nuops)))
        (local.set $p (call $tree_op_for_uop (local.get $i) (local.get $tidx)))
        (if (i32.eqz (call $tree_uop_classify (local.get $p)))
          (then
            (global.set $tree_decl_uop
              (i32.add (global.get $tree_decl_uop) (i32.const 1)))
            (global.set $tree_decl_uop_fn (load.field LoopOp handler (local.get $p)))
            (return (i32.const 0))))
        (local.set $extra (i32.add (local.get $extra) (global.get $tu_extra)))
        ;; -- the H149 pair, checked rather than assumed -------------------
        ;; A bare TU_EA_SIB must be consumed by the very next micro-op, and a
        ;; TU_B_EA consumer must be produced by the very previous one. The
        ;; decoder emits them adjacently and the terminator is lifted out of
        ;; this list without reordering anything, so both hold for every stream
        ;; a decoder actually writes -- which is exactly why they are cheap to
        ;; assert and worth asserting: the failure mode of a broken pairing is
        ;; a load from a stale address, which computes a plausible wrong answer
        ;; rather than trapping.
        (local.set $want_ea
          (i32.ne (i32.and (global.get $tu_b) (global.get $TU_B_EA)) (i32.const 0)))
        (if (i32.ne (local.get $want_ea) (local.get $prev_ea))
          (then
            (global.set $tree_decl_uop
              (i32.add (global.get $tree_decl_uop) (i32.const 1)))
            (global.set $tree_decl_uop_fn (load.field LoopOp handler (local.get $p)))
            (return (i32.const 0))))
        (local.set $prev_ea
          (i32.eq (global.get $tu_kind) (global.get $TU_EA_SIB)))
        ;; A REP string op round-trips every register through the globals, so
        ;; the locals are only authoritative again because the arm reloads
        ;; them -- and which registers the call actually changed is the string
        ;; handler's business, not this pass's. Publish all eight. Publishing
        ;; a register the body did not write is never wrong (the local still
        ;; holds the value it entered with), only redundant.
        (if (i32.eq (global.get $tu_kind) (global.get $TU_REP_STR))
          (then (local.set $live_out (i32.or (local.get $live_out) (i32.const 0xFF)))))
        ;; A STORE writes memory, not a register; everything else defines its
        ;; destination and must be published at exit.
        (if (i32.eqz (call $tree_uop_is_store (global.get $tu_kind)))
          (then (local.set $live_out
            (i32.or (local.get $live_out)
                    (i32.shl (i32.const 1) (global.get $tu_d))))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $p1)))
    ;; A bare EA compute as the last micro-op has nobody to consume it, which
    ;; means the op that did consume it is the terminator or the Jcc -- neither
    ;; of which this family models as reading $ea_temp. Decline.
    (if (local.get $prev_ea)
      (then
        (global.set $tree_decl_uop
          (i32.add (global.get $tree_decl_uop) (i32.const 1)))
        (global.set $tree_decl_uop_fn (i32.const 149))
        (return (i32.const 0))))

    (global.set $tree_fold_matches
      (i32.add (global.get $tree_fold_matches) (i32.const 1)))
    (if (i32.eqz (global.get $tree_fold_enabled))
      (then (return (i32.const 0))))
    (global.set $loop_matched_blocks
      (i32.add (global.get $loop_matched_blocks) (i32.const 1)))
    (global.set $tree_fold_last_nuops (local.get $nuops))
    (global.set $tree_fold_last_live_out (local.get $live_out))

    ;; -- pass 2: classify into scratch, THEN rewind and emit ----------------
    ;; The order here is the whole correctness argument. Rewinding
    ;; $thread_alloc to $tstart aims the emitter at the bytes the interior ops
    ;; still occupy, and the descriptor header alone is 48 bytes -- four or
    ;; five ops' worth. Classifying while emitting therefore reads each
    ;; micro-op out of memory the header has already overwritten, and since
    ;; every field decodes to *something*, the result is a body full of
    ;; plausible garbage rather than a failure: the loop runs the right number
    ;; of iterations and computes nothing. So every micro-op is decoded into a
    ;; scratch area first, while the original stream is still intact.
    ;;
    ;; The scratch is the far half of OP_INDEX (word 1024 up; OP_INDEX is
    ;; 0x2000 bytes = 2048 words, so the far half is 1024 words against
    ;; $TREE_FOLD_UOPS_LIMIT * $TREE_UOP_WORDS = 1008), which is free because
    ;; $op_index_n is reset to zero below and only one op is emitted after it.
    ;; That 1024 is half of why the limit is what it is -- see its comment.
    (local.set $i (i32.const 0))
    (block $scan_done
      (loop $scan
        (br_if $scan_done (i32.ge_u (local.get $i) (local.get $nuops)))
        (drop (call $tree_uop_classify
                (call $tree_op_for_uop (local.get $i) (local.get $tidx))))
        (local.set $p
          (i32.add (global.get $OP_INDEX)
            (i32.shl
              (i32.add (i32.const 1024)
                       (i32.mul (local.get $i) (global.get $TREE_UOP_WORDS)))
              (i32.const 2))))
        (i32.store           (local.get $p) (global.get $tu_kind))
        (i32.store offset=4  (local.get $p) (global.get $tu_d))
        (i32.store offset=8  (local.get $p) (global.get $tu_a))
        (i32.store offset=12 (local.get $p) (global.get $tu_imm))
        (i32.store offset=16 (local.get $p) (global.get $tu_fn))
        (i32.store offset=20 (local.get $p) (global.get $tu_b))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $scan)))

    ;; -- dead-flag pass: which micro-ops' flag writes nobody can observe -----
    ;; Backwards over the scratch, carrying `covered` = the set of fields that
    ;; are certain to be rewritten before any read. A micro-op whose whole
    ;; write set is inside `covered` can skip its $set_flags_* call: the value
    ;; it would have written is dead by the time anything looks.
    ;;
    ;; The seed is the terminator, which runs at the end of EVERY iteration and
    ;; is the only thing after the last micro-op. It comes in two shapes and
    ;; they seed very differently:
    ;;
    ;;   cmp + Jcc   -- writes op/res/a/b/ssh, reads nothing. So on entry to
    ;;                  the scan every field is already covered and an interior
    ;;                  op's flags are dead unless a later interior op reads
    ;;                  them. This is the shape that pays.
    ;;   dec/inc+Jcc -- writes those five plus $saved_cf, but READS CF first,
    ;;                  and $get_cf reaches flag_op/res/a/b to compute it. The
    ;;                  read happens before the write, so walking backwards the
    ;;                  write covers everything and the read then uncovers all
    ;;                  of it except flag_sign_shift. The last interior flag
    ;;                  writer therefore stays live, which is correct: the CF
    ;;                  the guest's DEC preserves is the one that op left.
    ;;
    ;; $eval_cc runs after the terminator's write and needs nothing seeded of
    ;; its own -- every field it can read, the terminator has just written.
    ;;
    ;; The pass never crosses an iteration boundary, so nothing here depends on
    ;; the trip count, and the side exit is safe for the same reason: it is
    ;; taken after a completed terminator, with the flags fully published.
    ;;
    ;; The terminator is no longer necessarily last, so it is applied at its
    ;; own position in the walk rather than as a seed. Everything after it is
    ;; flag-transparent by construction (that is the condition the backward
    ;; terminator walk enforced), so the two formulations agree exactly when
    ;; there is no suffix.
    (local.set $covered (i32.const 0))
    (local.set $i (local.get $nuops))
    (block $dead_done
      (loop $dead
        (if (i32.eq (local.get $i) (local.get $tidx))
          (then
            (local.set $covered
              (i32.or (local.get $covered)
                (if (result i32) (i32.eqz (local.get $term_kind))
                  (then (global.get $TF_F_INC))
                  (else (global.get $TF_F_ALL)))))
            (if (i32.eqz (local.get $term_kind))
              (then (local.set $covered
                (i32.and (local.get $covered)
                         (i32.xor (global.get $TF_F_CFRD) (i32.const -1))))))))
        (br_if $dead_done (i32.eqz (local.get $i)))
        (local.set $i (i32.sub (local.get $i) (i32.const 1)))
        (local.set $p
          (i32.add (global.get $OP_INDEX)
            (i32.shl
              (i32.add (i32.const 1024)
                       (i32.mul (local.get $i) (global.get $TREE_UOP_WORDS)))
              (i32.const 2))))
        (local.set $fwrites
          (call $tree_uop_flag_writes
            (i32.load (local.get $p)) (i32.load offset=20 (local.get $p))))
        ;; A zero write set is not a candidate -- that is both the flag-blind
        ;; kinds and TU_SHIFT, whose write is conditional on a runtime count.
        (if (i32.and (i32.ne (local.get $fwrites) (i32.const 0))
                     (i32.eqz (i32.and (local.get $fwrites)
                                       (i32.xor (local.get $covered) (i32.const -1)))))
          (then
            (i32.store offset=20 (local.get $p)
              (i32.or (i32.load offset=20 (local.get $p)) (global.get $TU_B_NOFLAGS)))
            (global.set $tree_fold_dead_flag_ops
              (i32.add (global.get $tree_fold_dead_flag_ops) (i32.const 1)))))
        (local.set $covered (i32.or (local.get $covered) (local.get $fwrites)))
        (local.set $covered
          (i32.and (local.get $covered)
            (i32.xor (call $tree_uop_flag_reads (i32.load (local.get $p))
                       (i32.load offset=20 (local.get $p)))
                     (i32.const -1))))
        (br $dead)))

    ;; -- shape trace, before the emitter overwrites anything ----------------
    ;; One record per lowered block: marker, entry EIP, nuops, terminator
    ;; position and kind, then six words per micro-op straight out of the
    ;; scratch -- the exact descriptor body about to be emitted, including the
    ;; dead-flag bit the pass above just set. tools/tree-shape-census.js reads
    ;; it and joins the entry EIP against a --hot-block-dump for weighting.
    (if (global.get $tree_trace)
      (then
        (call $host_log_i32 (i32.const 0x100C0000))
        (call $host_log_i32 (local.get $start_eip))
        (call $host_log_i32 (local.get $nuops))
        (call $host_log_i32 (local.get $tidx))
        (call $host_log_i32 (local.get $term_kind))
        (call $host_log_i32 (local.get $term_a))
        (call $host_log_i32 (local.get $term_b))
        (call $host_log_i32 (local.get $term_cc))
        (local.set $i (i32.const 0))
        (block $tr_done
          (loop $tr
            (br_if $tr_done (i32.ge_u (local.get $i) (local.get $nuops)))
            (local.set $p
              (i32.add (global.get $OP_INDEX)
                (i32.shl
                  (i32.add (i32.const 1024)
                           (i32.mul (local.get $i) (global.get $TREE_UOP_WORDS)))
                  (i32.const 2))))
            (call $host_log_i32 (i32.load           (local.get $p)))
            (call $host_log_i32 (i32.load offset=4  (local.get $p)))
            (call $host_log_i32 (i32.load offset=8  (local.get $p)))
            (call $host_log_i32 (i32.load offset=12 (local.get $p)))
            (call $host_log_i32 (i32.load offset=16 (local.get $p)))
            (call $host_log_i32 (i32.load offset=20 (local.get $p)))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $tr)))))

    (global.set $thread_alloc (local.get $tstart))
    (global.set $op_index_n (i32.const 0))
    ;; The one-block case of the REGION layout documented beside
    ;; $REGION_BLOCK_WORDS: one block whose taken successor is itself (the back
    ;; edge) and whose not-taken successor is exit 0 (the fall-through).
    ;; $back is not stored -- it is this block's own entry EIP, which is what
    ;; the block record's entry_eip word already is, and the side exit reads it
    ;; from there.
    (call $te (global.get $LOOP_SUPEROP_TREE) (i32.const 0))
    (call $te_raw (i32.const 1))              ;; nblocks
    (call $te_raw (i32.const 1))              ;; nexits
    (call $te_raw (local.get $nuops))         ;; uops_total
    (call $te_raw (i32.const 0))              ;; reserved
    ;; -- block 0 --
    (call $te_raw (i32.const 0))              ;; uop_off
    (call $te_raw (local.get $nuops))
    ;; Where the terminator runs inside the micro-op list. Equal to $nuops
    ;; whenever the flag producer really was the last op before the Jcc.
    (call $te_raw (local.get $tidx))          ;; term_pos
    (call $te_raw (local.get $term_kind))
    (call $te_raw (local.get $term_a))
    (call $te_raw (local.get $term_b))
    (call $te_raw (local.get $term_uop))
    ;; term_kind 3's displacement, and zero for every other kind.
    (call $te_raw (local.get $term_imm))
    (call $te_raw (local.get $term_cc))
    ;; The cost the unfolded block billed: one $steps per emitted op, plus
    ;; whatever the ops charged on their own account ($tu_extra -- H420).
    (call $te_raw (i32.add (local.get $n) (local.get $extra)))
    (call $te_raw (i32.const 0))              ;; succ_taken = block 0 (back edge)
    (call $te_raw (i32.const -1))             ;; succ_fall  = exit slot 0
    (call $te_raw (local.get $start_eip))     ;; entry_eip
    ;; -- exit 0 --
    (call $te_raw (local.get $fall))
    (call $te_raw (local.get $live_out))
    (local.set $i (i32.const 0))
    (block $p2_done
      (loop $p2
        (br_if $p2_done (i32.ge_u (local.get $i) (local.get $nuops)))
        (local.set $p
          (i32.add (global.get $OP_INDEX)
            (i32.shl
              (i32.add (i32.const 1024)
                       (i32.mul (local.get $i) (global.get $TREE_UOP_WORDS)))
              (i32.const 2))))
        (call $te_raw (i32.load           (local.get $p)))
        (call $te_raw (i32.load offset=4  (local.get $p)))
        (call $te_raw (i32.load offset=8  (local.get $p)))
        (call $te_raw (i32.load offset=12 (local.get $p)))
        (call $te_raw (i32.load offset=16 (local.get $p)))
        (call $te_raw (i32.load offset=20 (local.get $p)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $p2)))
    (i32.const 1))
