  ;; ============================================================
  ;; DELPHI SYSTEM RTTI / LSTR HELPERS AS NATIVE WAT (the "D" fold)
  ;; ============================================================
  ;; On by default; --no-delphi-fold (CLI) / ?no-delphi-fold (browser) turns
  ;; it off (13-exports set_delphi_fold). Landed from branch fold-bench, arm D
  ;; (docs/re-notes/spelunky-classic.md). Self-contained on purpose: it is the
  ;; first resident of docs/design/known-routine-framework.md and moves onto
  ;; that framework later.
  ;;
  ;; The System unit's _LStrClr, _LStrAsg, _FinalizeRecord, _FinalizeArray and
  ;; _CopyRecord are recognised at a block entry by their exact bytes -- an
  ;; FNV-1a over the body with every E8/E9 rel32 left out, plus each callee the
  ;; native form stands in for checked by its own signature, and System.Move's
  ;; FILD/FISTP form for _CopyRecord -- never by address: Spelunky Classic (GM8)
  ;; and Metrojd (GM7) link the same bodies at different layouts. The decoder
  ;; emits handler 395 (operand = id | move-form-ok << 8, one word = entry EIP)
  ;; followed by RET ($dfold_emit).
  ;;
  ;; The block's page-index cover is only the body's FIRST instruction ($d_k
  ;; bytes): a fallback resumes at entry+k, a partial path at the CALL inside
  ;; the body, and a block entered inside another block's cover retires it
  ;; (04-cache $page_publish), so a whole-body cover re-decoded (and re-hashed)
  ;; the HLE block on every resume. Self-modifying code is covered separately:
  ;; every byte range a native form depends on -- the body, its callees, the
  ;; Move it assumes -- is registered here ($dfold_reg), and a guest write to
  ;; any of them drops the pages of that range group ($dfold_code_write, called
  ;; from 04-cache $invalidate_code_range), so the next entry re-decodes and
  ;; re-checks the signature. A full group table declines the fold.
  ;;
  ;; Exactness. Native only when the whole call can finish without the memory
  ;; manager: a string whose release would reach zero (or an AnsiString literal
  ;; that _LStrAsg would copy), a refcount word or string slot that is
  ;; unaligned or in the shared heap, a field kind other than AnsiString, or
  ;; more than one managed field, all go back to the guest body at the
  ;; instruction after the first one (which the handler performs), with
  ;; nothing else written. A release reaching zero runs natively up to the
  ;; body's CALL FreeMem / _LStrClr / _FinalizeArray and resumes there (the
  ;; "partial" paths). Reproduced: memory, all eight GPRs, EIP and the flags.
  ;;
  ;; Threads. Every refcount change and the _LStrAsg slot exchange are atomic
  ;; RMWs, as the body's LOCK INC/DEC and XCHG are ($th_lock_rmw does the same,
  ;; then $invalidate_code_write). A decrement is a CAS against the value the
  ;; decision was made on, done before anything irreversible: if another
  ;; thread moved the count in between, the call falls back with nothing
  ;; written (a slot CAS that fails undoes the two counts it already moved,
  ;; neither of which can have reached zero), so the guest body decides again.
  ;;
  ;; Not reproduced, as with $th_ftol_native: the stores the bodies make below
  ;; ESP (dead), the x87 scratch registers a FILD/FISTP-based Move leaves (the
  ;; stack and tag word come back balanced), and a fault inside a helper (the
  ;; native form reads the same addresses; a bad pointer is a guest bug). A
  ;; --break inside a matched body does not fire; --no-delphi-fold for that.
  ;; _CopyRecord's leading Move (bytes before the string field) is taken at its
  ;; contract (memmove) once its code is checked; its trailing Move is the
  ;; guest's own, resumed at its CALL.

  (global $delphi_fold (mut i32) (i32.const 1))
  ;; Counters (delphi_fold_stat): calls finished natively, handed back to the
  ;; guest body, run natively up to a free, a CAS lost to another thread, and
  ;; range groups dropped for a code write; per helper id native/fallback.
  (global $dfold_native (mut i32) (i32.const 0))
  (global $dfold_fallback (mut i32) (i32.const 0))
  (global $dfold_partial (mut i32) (i32.const 0))
  (global $dfold_cas_lost (mut i32) (i32.const 0))
  (global $dfold_smc_drops (mut i32) (i32.const 0))
  (global $dfold_n1 (mut i32) (i32.const 0)) (global $dfold_n2 (mut i32) (i32.const 0))
  (global $dfold_n3 (mut i32) (i32.const 0)) (global $dfold_n4 (mut i32) (i32.const 0))
  (global $dfold_n5 (mut i32) (i32.const 0))
  (global $dfold_f1 (mut i32) (i32.const 0)) (global $dfold_f2 (mut i32) (i32.const 0))
  (global $dfold_f3 (mut i32) (i32.const 0)) (global $dfold_f4 (mut i32) (i32.const 0))
  (global $dfold_f5 (mut i32) (i32.const 0))
  ;; $dfold_emit's result: one past the HLE block's page-index cover.
  (global $dfold_cover_end (mut i32) (i32.const 0))

  ;; ---- signatures ----------------------------------------------------------
  (func $d_in4 (param $o i32) (param $s i32) (result i32)
    (i32.lt_u (i32.sub (local.get $o) (local.get $s)) (i32.const 4)))
  ;; length of the body's first instruction (the fallback's resume offset)
  (func $d_k (param $id i32) (result i32)
    (select (i32.const 3) (select (i32.const 1) (i32.const 2) (i32.eq (local.get $id) (i32.const 5)))
            (i32.eq (local.get $id) (i32.const 4))))
  ;; Is body offset $o inside a rel32 operand left out of id's hash?
  (func $d_masked (param $id i32) (param $o i32) (result i32)
    (if (i32.eq (local.get $id) (i32.const 1)) (then (return (call $d_in4 (local.get $o) (i32.const 0x1D)))))
    (if (i32.eq (local.get $id) (i32.const 2))
      (then (return (i32.or (call $d_in4 (local.get $o) (i32.const 0x10))
                            (i32.or (call $d_in4 (local.get $o) (i32.const 0x1C)) (call $d_in4 (local.get $o) (i32.const 0x3E)))))))
    (if (i32.eq (local.get $id) (i32.const 3)) (then (return (call $d_in4 (local.get $o) (i32.const 0x21)))))
    (if (i32.eq (local.get $id) (i32.const 4))
      (then (return
        (i32.or (i32.or (i32.or (call $d_in4 (local.get $o) (i32.const 0x3F)) (call $d_in4 (local.get $o) (i32.const 0x4B)))
                        (i32.or (call $d_in4 (local.get $o) (i32.const 0x50)) (call $d_in4 (local.get $o) (i32.const 0x57))))
          (i32.or (i32.or (i32.or (call $d_in4 (local.get $o) (i32.const 0x5C)) (call $d_in4 (local.get $o) (i32.const 0x68)))
                          (i32.or (call $d_in4 (local.get $o) (i32.const 0x71)) (call $d_in4 (local.get $o) (i32.const 0x7D))))
                  (i32.or (i32.or (call $d_in4 (local.get $o) (i32.const 0x9A)) (call $d_in4 (local.get $o) (i32.const 0xB0)))
                          (i32.or (i32.or (call $d_in4 (local.get $o) (i32.const 0xC0)) (call $d_in4 (local.get $o) (i32.const 0xD1)))
                                  (call $d_in4 (local.get $o) (i32.const 0xE1)))))))))
    (if (i32.eq (local.get $id) (i32.const 5))
      (then (return
        (i32.or (i32.or (i32.or (call $d_in4 (local.get $o) (i32.const 0x28)) (call $d_in4 (local.get $o) (i32.const 0x67)))
                        (i32.or (call $d_in4 (local.get $o) (i32.const 0x71)) (call $d_in4 (local.get $o) (i32.const 0x82))))
          (i32.or (i32.or (i32.or (call $d_in4 (local.get $o) (i32.const 0x93)) (call $d_in4 (local.get $o) (i32.const 0xB7)))
                          (i32.or (call $d_in4 (local.get $o) (i32.const 0xD0)) (call $d_in4 (local.get $o) (i32.const 0xDD))))
                  (i32.or (call $d_in4 (local.get $o) (i32.const 0xF0)) (call $d_in4 (local.get $o) (i32.const 0x111))))))))
    (i32.const 0))
  ;; body length: 1 _LStrClr, 2 _LStrAsg, 3 _FinalizeRecord, 4 _FinalizeArray, 5 _CopyRecord
  (func $d_len (param $id i32) (result i32)
    (select (i32.const 0x23) (select (i32.const 0x43) (select (i32.const 0x31) (select (i32.const 0xEA) (i32.const 0x11A)
      (i32.eq (local.get $id) (i32.const 4))) (i32.eq (local.get $id) (i32.const 3))) (i32.eq (local.get $id) (i32.const 2)))
      (i32.eq (local.get $id) (i32.const 1))))
  (func $d_first (param $id i32) (result i32)
    (select (i32.const 0xd285108b) (select (i32.const 0x2474d285) (select (i32.const 0x8a53c931) (select (i32.const 0x0f00f983) (i32.const 0x55575653)
      (i32.eq (local.get $id) (i32.const 4))) (i32.eq (local.get $id) (i32.const 3))) (i32.eq (local.get $id) (i32.const 2)))
      (i32.eq (local.get $id) (i32.const 1))))
  (func $d_fnv (param $id i32) (result i32)
    (select (i32.const 0xcacb444e) (select (i32.const 0xa1749f54) (select (i32.const 0xfa8250b0) (select (i32.const 0xe8843657) (i32.const 0xbfece31d)
      (i32.eq (local.get $id) (i32.const 4))) (i32.eq (local.get $id) (i32.const 3))) (i32.eq (local.get $id) (i32.const 2)))
      (i32.eq (local.get $id) (i32.const 1))))
  ;; Does body $id start at guest address $ga?
  (func $d_sig (param $ga i32) (param $id i32) (result i32)
    (local $h i32) (local $i i32) (local $n i32)
    (if (i32.ne (call $gl32 (local.get $ga)) (call $d_first (local.get $id))) (then (return (i32.const 0))))
    (local.set $n (call $d_len (local.get $id)))
    (local.set $h (i32.const 0x811c9dc5))
    (block $d (loop $l
      (br_if $d (i32.ge_u (local.get $i) (local.get $n)))
      (if (i32.eqz (call $d_masked (local.get $id) (local.get $i)))
        (then (local.set $h (i32.mul (i32.xor (local.get $h) (call $gl8 (i32.add (local.get $ga) (local.get $i))))
                                     (i32.const 0x01000193)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $l)))
    (i32.eq (local.get $h) (call $d_fnv (local.get $id))))
  ;; The target of the rel32 at body offset $o.
  (func $d_rel (param $ga i32) (param $o i32) (result i32)
    (i32.add (i32.add (local.get $ga) (i32.add (local.get $o) (i32.const 4)))
             (call $gl32 (i32.add (local.get $ga) (local.get $o)))))
  ;; Which helper (1-5) starts at $eip, or 0. Asked once per block decode, and
  ;; by the uop compiler (07e) for each instruction it forms a region over: a
  ;; program exits to a helper entry rather than lowering its bytes.
  (func $dfold_at (param $eip i32) (result i32)
    (local $w i32) (local $id i32) (local $fa i32)
    (if (i32.or (global.get $code16) (i32.eqz (global.get $delphi_fold)))
      (then (return (i32.const 0))))
    (local.set $w (call $gl32 (local.get $eip)))
    (local.set $id (i32.const 1))
    (block $found (loop $l
      (br_if $found (i32.eq (local.get $w) (call $d_first (local.get $id))))
      (local.set $id (i32.add (local.get $id) (i32.const 1)))
      (br_if $l (i32.le_u (local.get $id) (i32.const 5)))
      (return (i32.const 0))))
    (if (i32.eqz (call $d_sig (local.get $eip) (local.get $id))) (then (return (i32.const 0))))
    ;; the callees whose semantics the native form includes
    (if (i32.eq (local.get $id) (i32.const 3))
      (then (local.set $fa (call $d_rel (local.get $eip) (i32.const 0x21)))
            (if (i32.eqz (call $d_sig (local.get $fa) (i32.const 4))) (then (return (i32.const 0))))
            (if (i32.eqz (call $d_sig (call $d_rel (local.get $fa) (i32.const 0x4B)) (i32.const 1))) (then (return (i32.const 0))))))
    (if (i32.eq (local.get $id) (i32.const 4))
      (then (if (i32.eqz (call $d_sig (call $d_rel (local.get $eip) (i32.const 0x4B)) (i32.const 1))) (then (return (i32.const 0))))))
    (if (i32.eq (local.get $id) (i32.const 5))
      (then (if (i32.eqz (call $d_sig (call $d_rel (local.get $eip) (i32.const 0x71)) (i32.const 2))) (then (return (i32.const 0))))))
    (local.get $id))

  ;; Is the System.Move at $a the 9..32-byte FILD/FISTP form? Its code to the
  ;; RET, but for the jump table's absolute address (+0x11). Another System
  ;; unit links another Move (Game Maker 7's is REP MOVSD) with other branch
  ;; counts; _CopyRecord then falls back whenever bytes precede its field.
  (func $d_move_form (param $a i32) (result i32)
    (if (i32.ne (call $gl32 (local.get $a)) (i32.const 0x3174d039)) (then (return (i32.const 0))))
    (if (i32.ne (call $gl32 (i32.add (local.get $a) (i32.const 0x04))) (i32.const 0x7720f983)) (then (return (i32.const 0))))
    (if (i32.ne (call $gl32 (i32.add (local.get $a) (i32.const 0x08))) (i32.const 0x08e9837c)) (then (return (i32.const 0))))
    (if (i32.ne (call $gl32 (i32.add (local.get $a) (i32.const 0x0C))) (i32.const 0x24ff077f)) (then (return (i32.const 0))))
    (if (i32.ne (call $gl8 (i32.add (local.get $a) (i32.const 0x10))) (i32.const 0x8d)) (then (return (i32.const 0))))
    (if (i32.ne (call $gl32 (i32.add (local.get $a) (i32.const 0x15))) (i32.const 0xdf012cdf)) (then (return (i32.const 0))))
    (if (i32.ne (call $gl32 (i32.add (local.get $a) (i32.const 0x19))) (i32.const 0x08f98328)) (then (return (i32.const 0))))
    (if (i32.ne (call $gl32 (i32.add (local.get $a) (i32.const 0x1D))) (i32.const 0x68df117e)) (then (return (i32.const 0))))
    (if (i32.ne (call $gl32 (i32.add (local.get $a) (i32.const 0x21))) (i32.const 0x10f98308)) (then (return (i32.const 0))))
    (if (i32.ne (call $gl32 (i32.add (local.get $a) (i32.const 0x25))) (i32.const 0x68df067e)) (then (return (i32.const 0))))
    (if (i32.ne (call $gl32 (i32.add (local.get $a) (i32.const 0x29))) (i32.const 0x107adf10)) (then (return (i32.const 0))))
    (if (i32.ne (call $gl32 (i32.add (local.get $a) (i32.const 0x2D))) (i32.const 0xdf087adf)) (then (return (i32.const 0))))
    (if (i32.ne (call $gl32 (i32.add (local.get $a) (i32.const 0x31))) (i32.const 0x113cdf3a)) (then (return (i32.const 0))))
    (i32.eq (call $gl8 (i32.add (local.get $a) (i32.const 0x35))) (i32.const 0xc3)))

  ;; ---- self-modifying code: the byte ranges a native form rests on ---------
  ;; Up to four groups per instance (the decoded-code cache is per instance,
  ;; 13-exports $init_thread): a range within $DFOLD_GAP of a group widens it,
  ;; so one System unit's helpers and their callees are one group. A write
  ;; into a group drops every page it spans -- the HLE blocks starting there
  ;; and the threaded code around them -- and forgets the group; the next
  ;; decode re-checks every signature and registers again. A group spans only
  ;; System unit code, which no known program rewrites, so the drop is the
  ;; rare case and needs no finer index.
  (global $DFOLD_GAP i32 (i32.const 0x4000))
  (global $dfold_ng (mut i32) (i32.const 0))
  (global $dfold_lo0 (mut i32) (i32.const 0)) (global $dfold_hi0 (mut i32) (i32.const 0))
  (global $dfold_lo1 (mut i32) (i32.const 0)) (global $dfold_hi1 (mut i32) (i32.const 0))
  (global $dfold_lo2 (mut i32) (i32.const 0)) (global $dfold_hi2 (mut i32) (i32.const 0))
  (global $dfold_lo3 (mut i32) (i32.const 0)) (global $dfold_hi3 (mut i32) (i32.const 0))
  ;; the union of all groups: the one test a code write pays
  (global $dfold_umin (mut i32) (i32.const 0)) (global $dfold_umax (mut i32) (i32.const 0))
  (func $dfold_glo (param $k i32) (result i32)
    (select (global.get $dfold_lo0) (select (global.get $dfold_lo1) (select (global.get $dfold_lo2) (global.get $dfold_lo3)
      (i32.eq (local.get $k) (i32.const 2))) (i32.eq (local.get $k) (i32.const 1))) (i32.eqz (local.get $k))))
  (func $dfold_ghi (param $k i32) (result i32)
    (select (global.get $dfold_hi0) (select (global.get $dfold_hi1) (select (global.get $dfold_hi2) (global.get $dfold_hi3)
      (i32.eq (local.get $k) (i32.const 2))) (i32.eq (local.get $k) (i32.const 1))) (i32.eqz (local.get $k))))
  (func $dfold_gset (param $k i32) (param $lo i32) (param $hi i32)
    (if (i32.eqz (local.get $k)) (then (global.set $dfold_lo0 (local.get $lo)) (global.set $dfold_hi0 (local.get $hi))))
    (if (i32.eq (local.get $k) (i32.const 1)) (then (global.set $dfold_lo1 (local.get $lo)) (global.set $dfold_hi1 (local.get $hi))))
    (if (i32.eq (local.get $k) (i32.const 2)) (then (global.set $dfold_lo2 (local.get $lo)) (global.set $dfold_hi2 (local.get $hi))))
    (if (i32.eq (local.get $k) (i32.const 3)) (then (global.set $dfold_lo3 (local.get $lo)) (global.set $dfold_hi3 (local.get $hi)))))
  (func $dfold_union
    (local $k i32) (local $lo i32) (local $hi i32)
    (local.set $lo (i32.const -1))
    (block $d (loop $l
      (br_if $d (i32.ge_u (local.get $k) (global.get $dfold_ng)))
      (if (i32.lt_u (call $dfold_glo (local.get $k)) (local.get $lo)) (then (local.set $lo (call $dfold_glo (local.get $k)))))
      (if (i32.gt_u (call $dfold_ghi (local.get $k)) (local.get $hi)) (then (local.set $hi (call $dfold_ghi (local.get $k)))))
      (local.set $k (i32.add (local.get $k) (i32.const 1)))
      (br $l)))
    (global.set $dfold_umin (local.get $lo))
    (global.set $dfold_umax (local.get $hi)))
  ;; Register [lo, hi); 0 = no room (the caller declines the fold). The pages
  ;; are marked as code so a store to them reaches $invalidate_code_range.
  (func $dfold_reg (param $lo i32) (param $hi i32) (result i32)
    (local $k i32) (local $p i32) (local $glo i32) (local $ghi i32)
    (local.set $p (i32.and (local.get $lo) (i32.const 0xFFFFF000)))
    (block $md (loop $ml
      (br_if $md (i32.ge_u (local.get $p) (local.get $hi)))
      (call $code_page_mark (local.get $p))
      (local.set $p (i32.add (local.get $p) (i32.const 0x1000)))
      (br_if $md (i32.eqz (local.get $p)))
      (br $ml)))
    (block $new (loop $l
      (br_if $new (i32.ge_u (local.get $k) (global.get $dfold_ng)))
      (local.set $glo (call $dfold_glo (local.get $k)))
      (local.set $ghi (call $dfold_ghi (local.get $k)))
      (if (i32.and (i32.lt_u (local.get $lo) (i32.add (local.get $ghi) (global.get $DFOLD_GAP)))
                   (i32.gt_u (i32.add (local.get $hi) (global.get $DFOLD_GAP)) (local.get $glo)))
        (then
          (call $dfold_gset (local.get $k)
            (select (local.get $lo) (local.get $glo) (i32.lt_u (local.get $lo) (local.get $glo)))
            (select (local.get $hi) (local.get $ghi) (i32.gt_u (local.get $hi) (local.get $ghi))))
          (call $dfold_union)
          (return (i32.const 1))))
      (local.set $k (i32.add (local.get $k) (i32.const 1)))
      (br $l)))
    (if (i32.ge_u (global.get $dfold_ng) (i32.const 4)) (then (return (i32.const 0))))
    (call $dfold_gset (global.get $dfold_ng) (local.get $lo) (local.get $hi))
    (global.set $dfold_ng (i32.add (global.get $dfold_ng) (i32.const 1)))
    (call $dfold_union)
    (i32.const 1))
  ;; A body and every callee its native form includes.
  (func $dfold_reg_tree (param $ga i32) (param $id i32) (result i32)
    (if (i32.eqz (call $dfold_reg (local.get $ga) (i32.add (local.get $ga) (call $d_len (local.get $id)))))
      (then (return (i32.const 0))))
    (if (i32.eq (local.get $id) (i32.const 3))
      (then (return (call $dfold_reg_tree (call $d_rel (local.get $ga) (i32.const 0x21)) (i32.const 4)))))
    (if (i32.eq (local.get $id) (i32.const 4))
      (then (return (call $dfold_reg_tree (call $d_rel (local.get $ga) (i32.const 0x4B)) (i32.const 1)))))
    (if (i32.eq (local.get $id) (i32.const 5))
      (then (return (call $dfold_reg_tree (call $d_rel (local.get $ga) (i32.const 0x71)) (i32.const 2)))))
    (i32.const 1))
  ;; From 04-cache $invalidate_code_range: a guest write of [ga, ga+len) that
  ;; reached code. Counts a hit in $cache_inval_hits like a retirement, so the
  ;; caller's store-continuation check sees it.
  (func $dfold_code_write (param $ga i32) (param $len i32)
    (local $end i32) (local $k i32) (local $p i32) (local $hi i32)
    (if (i32.eqz (global.get $dfold_ng)) (then (return)))
    (local.set $end (i32.add (local.get $ga) (local.get $len)))
    (if (i32.or (i32.ge_u (local.get $ga) (global.get $dfold_umax))
                (i32.le_u (local.get $end) (global.get $dfold_umin)))
      (then (return)))
    (block $d (loop $l
      (br_if $d (i32.ge_u (local.get $k) (global.get $dfold_ng)))
      (if (i32.and (i32.lt_u (local.get $ga) (call $dfold_ghi (local.get $k)))
                   (i32.gt_u (local.get $end) (call $dfold_glo (local.get $k))))
        (then
          (local.set $p (i32.and (call $dfold_glo (local.get $k)) (i32.const 0xFFFFF000)))
          (local.set $hi (call $dfold_ghi (local.get $k)))
          (block $pd (loop $pl
            (br_if $pd (i32.ge_u (local.get $p) (local.get $hi)))
            (call $page_dir_drop (local.get $p))
            (local.set $p (i32.add (local.get $p) (i32.const 0x1000)))
            (br_if $pd (i32.eqz (local.get $p)))
            (br $pl)))
          (global.set $dfold_smc_drops (i32.add (global.get $dfold_smc_drops) (i32.const 1)))
          (global.set $cache_inval_hits (i32.add (global.get $cache_inval_hits) (i32.const 1)))
          ;; swap-remove, and look at slot $k again
          (global.set $dfold_ng (i32.sub (global.get $dfold_ng) (i32.const 1)))
          (call $dfold_gset (local.get $k) (call $dfold_glo (global.get $dfold_ng)) (call $dfold_ghi (global.get $dfold_ng)))
          (br $l)))
      (local.set $k (i32.add (local.get $k) (i32.const 1)))
      (br $l)))
    (call $dfold_union))

  ;; From 07-decoder $decode_block: emit the HLE block for a helper entry, or
  ;; 0 to decode normally. On 1, $dfold_cover_end is the cover's end.
  (func $dfold_emit (param $eip i32) (result i32)
    (local $id i32) (local $op i32) (local $mv i32)
    (local.set $id (call $dfold_at (local.get $eip)))
    (if (i32.eqz (local.get $id)) (then (return (i32.const 0))))
    (if (i32.eqz (call $dfold_reg_tree (local.get $eip) (local.get $id))) (then (return (i32.const 0))))
    (local.set $op (local.get $id))
    (if (i32.eq (local.get $id) (i32.const 5))
      (then
        (local.set $mv (call $d_rel (local.get $eip) (i32.const 0x28)))
        (if (call $d_move_form (local.get $mv))
          (then (if (call $dfold_reg (local.get $mv) (i32.add (local.get $mv) (i32.const 0x36)))
                  (then (local.set $op (i32.or (local.get $op) (i32.const 0x100)))))))))
    (call $te (i32.const 395) (local.get $op))
    (call $te_raw (local.get $eip))
    (call $te (i32.const 41) (i32.const 0))
    (global.set $dfold_cover_end (i32.add (local.get $eip) (call $d_k (local.get $id))))
    (i32.const 1))

  ;; ---- atomic refcount / slot primitives -----------------------------------
  ;; A word a native atomic RMW may use: aligned, not in the shared heap.
  (func $d_rc_ok (param $a i32) (result i32)
    (i32.and (i32.eqz (i32.and (local.get $a) (i32.const 3)))
             (i32.eqz (call $shared_heap_address (local.get $a)))))
  ;; s's refcount, 0 for nil
  (func $d_rc (param $s i32) (result i32)
    (if (result i32) (local.get $s)
      (then (call $gl32 (i32.sub (local.get $s) (i32.const 8))))
      (else (i32.const 0))))
  (func $d_cas (param $ga i32) (param $expect i32) (param $new i32) (result i32)
    (if (i32.ne (i32.atomic.rmw.cmpxchg (call $g2w (local.get $ga)) (local.get $expect) (local.get $new))
                (local.get $expect))
      (then (global.set $dfold_cas_lost (i32.add (global.get $dfold_cas_lost) (i32.const 1)))
            (return (i32.const 0))))
    (call $invalidate_code_write (local.get $ga) (i32.const 4))
    (i32.const 1))
  (func $d_add (param $ga i32) (param $delta i32) (result i32)
    (local $old i32)
    (local.set $old (i32.atomic.rmw.add (call $g2w (local.get $ga)) (local.get $delta)))
    (call $invalidate_code_write (local.get $ga) (i32.const 4))
    (local.get $old))
  ;; Can a release of s (refcount rc as the call will see it) finish without
  ;; freeing? 0 = hand the call back.
  (func $d_rel_ok (param $s i32) (param $rc i32) (result i32)
    (if (i32.eqz (local.get $s)) (then (return (i32.const 1))))
    (if (i32.lt_s (i32.sub (local.get $rc) (i32.const 1)) (i32.const 0)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $rc) (i32.const 1)) (then (return (i32.const 0))))
    (call $d_rc_ok (i32.sub (local.get $s) (i32.const 8))))
  ;; Is s a string this call would free (refcount exactly 1, a word a native
  ;; atomic RMW may use)? The partial paths run up to the free.
  (func $d_last (param $s i32) (result i32)
    (if (i32.eqz (local.get $s)) (then (return (i32.const 0))))
    (if (i32.ne (call $gl32 (i32.sub (local.get $s) (i32.const 8))) (i32.const 1)) (then (return (i32.const 0))))
    (call $d_rc_ok (i32.sub (local.get $s) (i32.const 8))))
  ;; Take the release of s (refcount rc, d_rel_ok said yes) before anything
  ;; irreversible: nil and literals need nothing, else a CAS rc -> rc-1.
  (func $d_claim (param $s i32) (param $rc i32) (result i32)
    (if (i32.eqz (local.get $s)) (then (return (i32.const 1))))
    (if (i32.lt_s (i32.sub (local.get $rc) (i32.const 1)) (i32.const 0)) (then (return (i32.const 1))))
    (call $d_cas (i32.sub (local.get $s) (i32.const 8)) (local.get $rc) (i32.sub (local.get $rc) (i32.const 1))))
  (func $d_unclaim (param $s i32) (param $rc i32)
    (if (i32.and (i32.ne (local.get $s) (i32.const 0))
                 (i32.ge_s (i32.sub (local.get $rc) (i32.const 1)) (i32.const 0)))
      (then (drop (call $d_add (i32.sub (local.get $s) (i32.const 8)) (i32.const 1))))))
  ;; The register/flag tail of a claimed release (s != 0): `mov ecx,[edx-8];
  ;; dec ecx; jl` then, for a counted string, `lock dec [edx-8]` -- both leave
  ;; the flags of rc-1.
  (func $d_released (param $rc i32)
    (i32.store offset=4 (global.get $reg_base) (i32.sub (local.get $rc) (i32.const 1)))
    (call $set_flags_dec (local.get $rc) (i32.sub (local.get $rc) (i32.const 1)))
    (global.set $flag_sign_shift (i32.const 31)))
  ;; _LStrClr on [p] = s (refcount rc), its release already claimed.
  (func $d_clr_claimed (param $p i32) (param $s i32) (param $rc i32)
    (i32.store offset=8 (global.get $reg_base) (local.get $s))
    (if (i32.eqz (local.get $s))
      (then (call $set_flags_logic (i32.const 0)) (global.set $flag_sign_shift (i32.const 31)) (return)))
    (call $gs32 (local.get $p) (i32.const 0))
    (call $d_released (local.get $rc)))
  ;; _LStrAsg([p] = d, s): rd is d's refcount the decision was made on, s is
  ;; not a literal, p and every counted refcount word passed $d_rc_ok and the
  ;; release passed $d_rel_ok. 1 = done (ECX/EDX/flags as the body leaves
  ;; them); 0 = nothing changed, fall back.
  (func $d_asg_commit (param $p i32) (param $d i32) (param $s i32) (param $rd i32) (result i32)
    (local $old_s i32)
    (if (i32.eq (local.get $d) (local.get $s))
      (then
        ;; the slot keeps its string; the INC and DEC cancel
        (if (i32.eqz (call $d_cas (local.get $p) (local.get $d) (local.get $d))) (then (return (i32.const 0))))
        (i32.store offset=8 (global.get $reg_base) (local.get $d))
        (if (i32.eqz (local.get $s))
          (then (call $set_flags_logic (i32.const 0)) (global.set $flag_sign_shift (i32.const 31))
                (return (i32.const 1))))
        (call $d_released (i32.add (local.get $rd) (i32.const 1)))
        (return (i32.const 1))))
    (if (i32.eqz (call $d_claim (local.get $d) (local.get $rd))) (then (return (i32.const 0))))
    (if (local.get $s)
      (then (local.set $old_s (call $d_add (i32.sub (local.get $s) (i32.const 8)) (i32.const 1)))))
    (if (i32.eqz (call $d_cas (local.get $p) (local.get $d) (local.get $s)))
      (then
        (call $d_unclaim (local.get $d) (local.get $rd))
        (if (local.get $s) (then (drop (call $d_add (i32.sub (local.get $s) (i32.const 8)) (i32.const -1)))))
        (return (i32.const 0))))
    (if (local.get $s)
      (then (i32.store offset=4 (global.get $reg_base) (i32.add (local.get $old_s) (i32.const 1)))))
    (i32.store offset=8 (global.get $reg_base) (local.get $d))
    (if (i32.eqz (local.get $d))
      (then (call $set_flags_logic (i32.const 0)) (global.set $flag_sign_shift (i32.const 31))
            (return (i32.const 1))))
    (call $d_released (local.get $rd))
    (i32.const 1))
  ;; System.Move: memmove, byte-exact.
  (func $d_move (param $dst i32) (param $src i32) (param $n i32)
    (local $i i32)
    (if (i32.or (i32.le_s (local.get $n) (i32.const 0)) (i32.eq (local.get $dst) (local.get $src))) (then (return)))
    (if (i32.or (i32.lt_u (local.get $dst) (local.get $src))
                (i32.ge_u (local.get $dst) (i32.add (local.get $src) (local.get $n))))
      (then
        (block $d (loop $l
          (br_if $d (i32.gt_u (i32.add (local.get $i) (i32.const 4)) (local.get $n)))
          (call $gs32 (i32.add (local.get $dst) (local.get $i)) (call $gl32 (i32.add (local.get $src) (local.get $i))))
          (local.set $i (i32.add (local.get $i) (i32.const 4)))
          (br $l)))
        (block $d2 (loop $l2
          (br_if $d2 (i32.ge_u (local.get $i) (local.get $n)))
          (call $gs8 (i32.add (local.get $dst) (local.get $i)) (call $gl8 (i32.add (local.get $src) (local.get $i))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $l2)))
        (return)))
    (local.set $i (local.get $n))
    (block $d3 (loop $l3
      (br_if $d3 (i32.eqz (local.get $i)))
      (local.set $i (i32.sub (local.get $i) (i32.const 1)))
      (call $gs8 (i32.add (local.get $dst) (local.get $i)) (call $gl8 (i32.add (local.get $src) (local.get $i))))
      (br $l3))))

  (func $dfold_tick (param $id i32) (param $fb i32)
    (if (local.get $fb)
      (then
        (global.set $dfold_fallback (i32.add (global.get $dfold_fallback) (i32.const 1)))
        (if (i32.eq (local.get $id) (i32.const 1)) (then (global.set $dfold_f1 (i32.add (global.get $dfold_f1) (i32.const 1)))))
        (if (i32.eq (local.get $id) (i32.const 2)) (then (global.set $dfold_f2 (i32.add (global.get $dfold_f2) (i32.const 1)))))
        (if (i32.eq (local.get $id) (i32.const 3)) (then (global.set $dfold_f3 (i32.add (global.get $dfold_f3) (i32.const 1)))))
        (if (i32.eq (local.get $id) (i32.const 4)) (then (global.set $dfold_f4 (i32.add (global.get $dfold_f4) (i32.const 1)))))
        (if (i32.eq (local.get $id) (i32.const 5)) (then (global.set $dfold_f5 (i32.add (global.get $dfold_f5) (i32.const 1)))))
        (return)))
    (global.set $dfold_native (i32.add (global.get $dfold_native) (i32.const 1)))
    (if (i32.eq (local.get $id) (i32.const 1)) (then (global.set $dfold_n1 (i32.add (global.get $dfold_n1) (i32.const 1)))))
    (if (i32.eq (local.get $id) (i32.const 2)) (then (global.set $dfold_n2 (i32.add (global.get $dfold_n2) (i32.const 1)))))
    (if (i32.eq (local.get $id) (i32.const 3)) (then (global.set $dfold_n3 (i32.add (global.get $dfold_n3) (i32.const 1)))))
    (if (i32.eq (local.get $id) (i32.const 4)) (then (global.set $dfold_n4 (i32.add (global.get $dfold_n4) (i32.const 1)))))
    (if (i32.eq (local.get $id) (i32.const 5)) (then (global.set $dfold_n5 (i32.add (global.get $dfold_n5) (i32.const 1))))))
  (func $dfold_partial_tick
    (global.set $dfold_partial (i32.add (global.get $dfold_partial) (i32.const 1))))

  ;; One managed field of a record typeinfo: 0 unless the record has exactly
  ;; one field and it is an AnsiString; else its offset + 1.
  (func $d_one_str_field (param $ti i32) (result i32)
    (local $fp i32)
    (local.set $fp (i32.add (local.get $ti) (i32.add (call $gl8 (i32.add (local.get $ti) (i32.const 1))) (i32.const 0xA))))
    (if (i32.ne (call $gl32 (i32.sub (local.get $fp) (i32.const 4))) (i32.const 1)) (then (return (i32.const 0))))
    (if (i32.ne (call $gl8 (call $gl32 (call $gl32 (local.get $fp)))) (i32.const 0xA)) (then (return (i32.const 0))))
    (i32.add (call $gl32 (i32.add (local.get $fp) (i32.const 4))) (i32.const 1)))
  (func $d_push (param $v i32)
    (local $esp i32)
    (local.set $esp (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (local.get $esp) (local.get $v))
    (i32.store offset=16 (global.get $reg_base) (local.get $esp)))

  ;; ---- the branch clock ----------------------------------------------------
  ;; Under --branch-clock a batch is a count of executed x86 branches (every
  ;; Jcc, JMP, CALL, RET), so a helper run natively must charge what its body
  ;; would have, or the guest clock -- every timer, every input batch -- moves.
  ;; Counts below are block ends BEFORE the body's final RET (the RET op the
  ;; HLE block ends in charges itself), read off the System unit's code (see
  ;; docs/re-notes/spelunky-classic.md) and checked per case against the
  ;; threaded body by test/test-delphi-fold.js. LOCK RMWs are not block ends.
  ;;   _LStrClr: nil 1 (jz), literal 2 (jz jl), counted 3 (jz jl jnz)
  (func $d_clr_pre (param $s i32) (param $rc i32) (result i32)
    (if (i32.eqz (local.get $s)) (then (return (i32.const 1))))
    (select (i32.const 2) (i32.const 3) (i32.lt_s (i32.sub (local.get $rc) (i32.const 1)) (i32.const 0))))
  ;;   _LStrAsg: the add half (nil: jz; else jz jg) plus a release of the old
  ;;   string at its refcount after the add (an _LStrClr count)
  (func $d_asg_pre (param $d i32) (param $s i32) (param $rd i32) (result i32)
    (local $rc i32)
    (if (i32.eqz (local.get $d)) (then (return (i32.add (select (i32.const 2) (i32.const 1) (i32.ne (local.get $s) (i32.const 0))) (i32.const 1)))))
    (local.set $rc (i32.add (local.get $rd)
      (i32.and (i32.eq (local.get $d) (local.get $s)) (i32.ne (local.get $s) (i32.const 0)))))
    (i32.add (select (i32.const 2) (i32.const 1) (i32.ne (local.get $s) (i32.const 0)))
      (select (i32.const 2) (i32.const 3) (i32.lt_s (i32.sub (local.get $rc) (i32.const 1)) (i32.const 0)))))
  ;;   System.Move(n), the FILD/FISTP form: src = dst 1 (jz); 9..16 4 (jz ja
  ;;   jg jle); 17..32 5. Other sizes run a table or a loop: -1, fall back.
  (func $d_move_pre (param $same i32) (param $n i32) (result i32)
    (if (local.get $same) (then (return (i32.const 1))))
    (if (i32.or (i32.lt_s (local.get $n) (i32.const 9)) (i32.gt_s (local.get $n) (i32.const 32)))
      (then (return (i32.const -1))))
    (select (i32.const 4) (i32.const 5) (i32.le_s (local.get $n) (i32.const 16))))
  ;; A path needs $need blocks of budget (the threaded body would stop short
  ;; otherwise); asked before anything is written. Then it charges what it
  ;; ran (the exit's own transfer, if it has one, charges the rest).
  (func $d_can (param $need i32) (result i32)
    (i32.or (i32.eqz (global.get $branch_clock))
            (i32.ge_s (global.get $block_budget) (local.get $need))))
  (func $d_charge (param $c i32)
    (if (global.get $branch_clock)
      (then (global.set $block_budget (i32.sub (global.get $block_budget) (local.get $c))))))

  ;; 395: one of the five helpers (operand = id | move-form-ok << 8, one word
  ;; = entry EIP), followed by RET.
  (func $th_delphi_rtti (param $op i32)
    (local $nx_fn i32) (local $nx_op i32)
    (local $id i32) (local $eax i32) (local $ecx i32) (local $edx i32) (local $f i32) (local $s i32) (local $d i32)
    (local $size i32) (local $off i32) (local $entry i32) (local $esp i32) (local $rs i32) (local $rd i32)
    (local.set $id (i32.and (local.get $op) (i32.const 0xFF)))
    (local.set $eax (i32.load (global.get $reg_base)))
    (local.set $ecx (i32.load offset=4 (global.get $reg_base)))
    (local.set $edx (i32.load offset=8 (global.get $reg_base)))
    ;; the body's entry address, in the op's one extra word
    (local.set $entry (read-thread-word))
    (block $fallback
      ;; 1 _LStrClr(eax = @s)
      (if (i32.eq (local.get $id) (i32.const 1))
        (then
          (local.set $s (call $gl32 (local.get $eax)))
          (if (call $d_last (local.get $s))
            (then
              ;; jz jl jnz, then the CALL; the body up to its CALL FreeMem
              ;; (+0x1C): [p] = 0, ECX = 0, LOCK DEC 1 -> 0, PUSH EAX,
              ;; EAX = s-8, EDX = s
              (br_if $fallback (i32.eqz (call $d_can (i32.const 3))))
              (br_if $fallback (i32.eqz (call $d_cas (i32.sub (local.get $s) (i32.const 8)) (i32.const 1) (i32.const 0))))
              (call $d_charge (i32.const 2))
              (call $gs32 (local.get $eax) (i32.const 0))
              (i32.store offset=4 (global.get $reg_base) (i32.const 0))
              (call $set_flags_dec (i32.const 1) (i32.const 0))
              (global.set $flag_sign_shift (i32.const 31))
              (call $d_push (local.get $eax))
              (i32.store (global.get $reg_base) (i32.sub (local.get $s) (i32.const 8)))
              (i32.store offset=8 (global.get $reg_base) (local.get $s))
              (call $dfold_partial_tick)
              (global.set $eip (i32.add (local.get $entry) (i32.const 0x1C)))
              (return_call $branch_end)))
          (local.set $rs (call $d_rc (local.get $s)))
          (br_if $fallback (i32.eqz (call $d_rel_ok (local.get $s) (local.get $rs))))
          (local.set $f (call $d_clr_pre (local.get $s) (local.get $rs)))
          (br_if $fallback (i32.eqz (call $d_can (local.get $f))))
          (br_if $fallback (i32.eqz (call $d_claim (local.get $s) (local.get $rs))))
          (call $d_charge (local.get $f))
          (call $d_clr_claimed (local.get $eax) (local.get $s) (local.get $rs))
          (call $dfold_tick (local.get $id) (i32.const 0))
          (dispatch-next)))
      ;; 2 _LStrAsg(eax = @dest, edx = s)
      (if (i32.eq (local.get $id) (i32.const 2))
        (then
          (br_if $fallback (i32.eqz (call $d_rc_ok (local.get $eax))))
          (local.set $d (call $gl32 (local.get $eax)))
          (local.set $rs (call $d_rc (local.get $edx)))
          (if (local.get $edx)
            (then (br_if $fallback (i32.lt_s (local.get $rs) (i32.const 0)))
                  (br_if $fallback (i32.eqz (call $d_rc_ok (i32.sub (local.get $edx) (i32.const 8)))))))
          ;; the old string's last reference: add s, swap, then the body's
          ;; release up to its CALL FreeMem (+0x3D): ECX = 0, LOCK DEC 1 -> 0,
          ;; EAX = old-8, EDX = old
          (if (i32.and (call $d_last (local.get $d)) (i32.ne (local.get $d) (local.get $edx)))
            (then
              ;; the add half, then jz jl jnz, then the CALL
              (local.set $f (i32.add (select (i32.const 2) (i32.const 1) (i32.ne (local.get $edx) (i32.const 0))) (i32.const 3)))
              (br_if $fallback (i32.eqz (call $d_can (local.get $f))))
              (br_if $fallback (i32.eqz (call $d_cas (i32.sub (local.get $d) (i32.const 8)) (i32.const 1) (i32.const 0))))
              (if (local.get $edx)
                (then (drop (call $d_add (i32.sub (local.get $edx) (i32.const 8)) (i32.const 1)))))
              (if (i32.eqz (call $d_cas (local.get $eax) (local.get $d) (local.get $edx)))
                (then
                  (drop (call $d_add (i32.sub (local.get $d) (i32.const 8)) (i32.const 1)))
                  (if (local.get $edx)
                    (then (drop (call $d_add (i32.sub (local.get $edx) (i32.const 8)) (i32.const -1)))))
                  (br $fallback)))
              (call $d_charge (i32.sub (local.get $f) (i32.const 1)))
              (i32.store offset=4 (global.get $reg_base) (i32.const 0))
              (call $set_flags_dec (i32.const 1) (i32.const 0))
              (global.set $flag_sign_shift (i32.const 31))
              (i32.store (global.get $reg_base) (i32.sub (local.get $d) (i32.const 8)))
              (i32.store offset=8 (global.get $reg_base) (local.get $d))
              (call $dfold_partial_tick)
              (global.set $eip (i32.add (local.get $entry) (i32.const 0x3D)))
              (return_call $branch_end)))
          (local.set $rd (call $d_rc (local.get $d)))
          (br_if $fallback (i32.eqz (call $d_rel_ok (local.get $d)
            (i32.add (local.get $rd)
              (i32.and (i32.eq (local.get $d) (local.get $edx)) (i32.ne (local.get $edx) (i32.const 0)))))))
          (local.set $f (call $d_asg_pre (local.get $d) (local.get $edx) (local.get $rd)))
          (br_if $fallback (i32.eqz (call $d_can (local.get $f))))
          (br_if $fallback (i32.eqz (call $d_asg_commit (local.get $eax) (local.get $d) (local.get $edx) (local.get $rd))))
          (call $d_charge (local.get $f))
          (call $dfold_tick (local.get $id) (i32.const 0))
          (dispatch-next)))
      ;; 4 _FinalizeArray(eax = p, edx = typeinfo, ecx = count)
      (if (i32.eq (local.get $id) (i32.const 4))
        (then
          (if (i32.eqz (local.get $ecx))
            (then (br_if $fallback (i32.eqz (call $d_can (i32.const 1))))   ;; jz
                  (call $d_charge (i32.const 1))
                  (call $set_flags_sub (i32.const 0) (i32.const 0) (i32.const 0))
                  (global.set $flag_sign_shift (i32.const 31))
                  (call $dfold_tick (local.get $id) (i32.const 0))
                  (dispatch-next)))
          (br_if $fallback (i32.ne (local.get $ecx) (i32.const 1)))
          (br_if $fallback (i32.ne (call $gl8 (local.get $edx)) (i32.const 0xA)))
          (local.set $s (call $gl32 (local.get $eax)))
          ;; the string's last reference: the body up to its CALL _LStrClr
          ;; (+0x4A), which then releases it: PUSH EAX/EBX/ESI/EDI; EBX = EAX
          ;; = p, ESI = typeinfo, EDI = 1, EDX = name length; flags of CMP ECX,1
          (if (call $d_last (local.get $s))
            (then
              ;; jz jz jg, then the CALL
              (br_if $fallback (i32.eqz (call $d_can (i32.const 3))))
              (call $d_charge (i32.const 2))
              (call $d_push (local.get $eax))
              (call $d_push (i32.load offset=12 (global.get $reg_base)))
              (call $d_push (i32.load offset=24 (global.get $reg_base)))
              (call $d_push (i32.load offset=28 (global.get $reg_base)))
              (i32.store offset=12 (global.get $reg_base) (local.get $eax))
              (i32.store offset=24 (global.get $reg_base) (local.get $edx))
              (i32.store offset=28 (global.get $reg_base) (i32.const 1))
              (i32.store offset=8 (global.get $reg_base) (call $gl8 (i32.add (local.get $edx) (i32.const 1))))
              (call $set_flags_sub (i32.const 1) (i32.const 1) (i32.const 0))
              (global.set $flag_sign_shift (i32.const 31))
              (call $dfold_partial_tick)
              (global.set $eip (i32.add (local.get $entry) (i32.const 0x4A)))
              (return_call $branch_end)))
          (local.set $rs (call $d_rc (local.get $s)))
          (br_if $fallback (i32.eqz (call $d_rel_ok (local.get $s) (local.get $rs))))
          ;; jz jz jg CALL, _LStrClr and its RET, JMP
          (local.set $f (i32.add (call $d_clr_pre (local.get $s) (local.get $rs)) (i32.const 6)))
          (br_if $fallback (i32.eqz (call $d_can (local.get $f))))
          (br_if $fallback (i32.eqz (call $d_claim (local.get $s) (local.get $rs))))
          (call $d_charge (local.get $f))
          (call $d_clr_claimed (local.get $eax) (local.get $s) (local.get $rs))
          (call $dfold_tick (local.get $id) (i32.const 0))
          (dispatch-next)))
      ;; 3 _FinalizeRecord(eax = p, edx = typeinfo): EAX = p on return
      (if (i32.eq (local.get $id) (i32.const 3))
        (then
          (local.set $f (call $d_one_str_field (local.get $edx)))
          (br_if $fallback (i32.eqz (local.get $f)))
          (local.set $off (i32.sub (local.get $f) (i32.const 1)))
          (local.set $f (i32.add (local.get $eax) (local.get $off)))
          (local.set $s (call $gl32 (local.get $f)))
          ;; the field's last reference: the body up to its CALL _FinalizeArray
          ;; (+0x20): PUSH EBX/ESI/EDI; EBX = p, ESI = the field entry, EDI = 1,
          ;; EDX = the field's typeinfo, EAX = p+off, ECX = 1; flags of ADD EAX,EBX
          (if (call $d_last (local.get $s))
            (then
              ;; no branch before the CALL: the resume's own transfer is refunded
              (br_if $fallback (i32.eqz (call $d_can (i32.const 0))))
              (call $d_charge (i32.const -1))
              (call $d_push (i32.load offset=12 (global.get $reg_base)))
              (call $d_push (i32.load offset=24 (global.get $reg_base)))
              (call $d_push (i32.load offset=28 (global.get $reg_base)))
              (i32.store offset=12 (global.get $reg_base) (local.get $eax))
              (local.set $s (i32.add (i32.add (local.get $edx) (call $gl8 (i32.add (local.get $edx) (i32.const 1)))) (i32.const 0xA)))
              (i32.store offset=24 (global.get $reg_base) (local.get $s))
              (i32.store offset=28 (global.get $reg_base) (i32.const 1))
              (i32.store offset=8 (global.get $reg_base) (call $gl32 (call $gl32 (local.get $s))))
              (i32.store (global.get $reg_base) (local.get $f))
              (i32.store offset=4 (global.get $reg_base) (i32.const 1))
              (call $set_flags_add (local.get $off) (local.get $eax) (local.get $f))
              (global.set $flag_sign_shift (i32.const 31))
              (call $dfold_partial_tick)
              (global.set $eip (i32.add (local.get $entry) (i32.const 0x20)))
              (return_call $branch_end)))
          (local.set $rs (call $d_rc (local.get $s)))
          (br_if $fallback (i32.eqz (call $d_rel_ok (local.get $s) (local.get $rs))))
          ;; CALL, _FinalizeArray (6 + _LStrClr) and its RET, the loop's jg
          (local.set $d (i32.add (call $d_clr_pre (local.get $s) (local.get $rs)) (i32.const 9)))
          (br_if $fallback (i32.eqz (call $d_can (local.get $d))))
          (br_if $fallback (i32.eqz (call $d_claim (local.get $s) (local.get $rs))))
          (call $d_charge (local.get $d))
          (i32.store offset=4 (global.get $reg_base) (i32.const 1))
          (call $d_clr_claimed (local.get $f) (local.get $s) (local.get $rs))
          ;; the loop's DEC EDI, 1 -> 0, is the last flag write
          (call $set_flags_dec (i32.const 1) (i32.const 0))
          (global.set $flag_sign_shift (i32.const 31))
          (call $dfold_tick (local.get $id) (i32.const 0))
          (dispatch-next)))
      ;; 5 _CopyRecord(eax = dst, edx = src, ecx = typeinfo)
      (if (i32.eq (local.get $id) (i32.const 5))
        (then
          (local.set $f (call $d_one_str_field (local.get $ecx)))
          (br_if $fallback (i32.eqz (local.get $f)))
          (local.set $off (i32.sub (local.get $f) (i32.const 1)))
          (br_if $fallback (i32.eqz (call $d_rc_ok (i32.add (local.get $eax) (local.get $off)))))
          (local.set $size (call $gl32 (i32.add (local.get $ecx)
            (i32.add (call $gl8 (i32.add (local.get $ecx) (i32.const 1))) (i32.const 2)))))
          (local.set $s (call $gl32 (i32.add (local.get $edx) (local.get $off))))
          (local.set $d (call $gl32 (i32.add (local.get $eax) (local.get $off))))
          (local.set $rs (call $d_rc (local.get $s)))
          (local.set $rd (call $d_rc (local.get $d)))
          (if (local.get $s)
            (then (br_if $fallback (i32.lt_s (local.get $rs) (i32.const 0)))
                  (br_if $fallback (i32.eqz (call $d_rc_ok (i32.sub (local.get $s) (i32.const 8)))))))
          (br_if $fallback (i32.eqz (call $d_rel_ok (local.get $d)
            (i32.add (local.get $rd)
              (i32.and (i32.eq (local.get $d) (local.get $s)) (i32.ne (local.get $s) (i32.const 0)))))))
          ;; the string slot must not overlap the bytes Move copies around it
          (br_if $fallback (i32.and (i32.ne (local.get $eax) (local.get $edx))
            (i32.lt_u (i32.add (i32.sub (local.get $eax) (local.get $edx)) (local.get $size))
                      (i32.shl (local.get $size) (i32.const 1)))))
          ;; the clock: jle, [CALL Move, Move, its RET], jz, CALL _LStrAsg,
          ;; _LStrAsg and its RET, JMP, the field loop's jnz, the tail's jle.
          ;; A tail resumes at its CALL Move (the resume's transfer charges one).
          (local.set $esp (i32.add (call $d_asg_pre (local.get $d) (local.get $s) (local.get $rd)) (i32.const 7)))
          (if (i32.gt_s (local.get $off) (i32.const 0))
            (then
              ;; the decoder checked Move's code and registered it (bit 8)
              (br_if $fallback (i32.eqz (i32.and (local.get $op) (i32.const 0x100))))
              (local.set $f (call $d_move_pre (i32.eq (local.get $eax) (local.get $edx)) (local.get $off)))
              (br_if $fallback (i32.lt_s (local.get $f) (i32.const 0)))
              (local.set $esp (i32.add (local.get $esp) (i32.add (local.get $f) (i32.const 2))))))
          (br_if $fallback (i32.eqz (call $d_can (local.get $esp))))
          ;; the slot first (it can still fail and fall back); the Move of the
          ;; bytes before it touches neither the slot nor a refcount
          (br_if $fallback (i32.eqz (call $d_asg_commit (i32.add (local.get $eax) (local.get $off))
                                      (local.get $d) (local.get $s) (local.get $rd))))
          (call $d_charge (i32.sub (local.get $esp)
            (i32.gt_s (local.get $size) (i32.add (local.get $off) (i32.const 4)))))
          (call $d_move (local.get $eax) (local.get $edx) (local.get $off))
          (local.set $off (i32.add (local.get $off) (i32.const 4)))
          ;; pop ecx (= size); sub ecx,eax (eax = off+4); jle
          (i32.store offset=4 (global.get $reg_base) (i32.sub (local.get $size) (local.get $off)))
          (call $dfold_tick (local.get $id) (i32.const 0))
          (if (i32.le_s (i32.sub (local.get $size) (local.get $off)) (i32.const 0))
            (then
              ;; no tail: pop ebp/edi/esi/ebx (unchanged), ret. EDX is what
              ;; _LStrAsg left.
              (i32.store (global.get $reg_base) (local.get $off))
              (call $set_flags_sub (local.get $size) (local.get $off) (i32.sub (local.get $size) (local.get $off)))
              (global.set $flag_sign_shift (i32.const 31))
              (dispatch-next)))
          ;; A tail: the app's own System.Move copies it, so its register and
          ;; flag exit state is that body's. Rebuild the frame (push ebx, esi,
          ;; edi, ebp; the size word pushed below it is popped residue) and
          ;; the registers at the `call Move` (entry+0x110), and resume there:
          ;; Move returns into the body's own pops and RET.
          (local.set $esp (i32.load offset=16 (global.get $reg_base)))
          (call $gs32 (i32.sub (local.get $esp) (i32.const 4)) (i32.load offset=12 (global.get $reg_base)))
          (call $gs32 (i32.sub (local.get $esp) (i32.const 8)) (i32.load offset=24 (global.get $reg_base)))
          (call $gs32 (i32.sub (local.get $esp) (i32.const 12)) (i32.load offset=28 (global.get $reg_base)))
          (call $gs32 (i32.sub (local.get $esp) (i32.const 16)) (i32.load offset=20 (global.get $reg_base)))
          (call $gs32 (i32.sub (local.get $esp) (i32.const 20)) (local.get $size))
          (i32.store offset=16 (global.get $reg_base) (i32.sub (local.get $esp) (i32.const 16)))
          (i32.store offset=12 (global.get $reg_base) (local.get $eax))       ;; ebx = dst
          (i32.store offset=24 (global.get $reg_base) (local.get $edx))       ;; esi = src
          ;; edi = the field table walked past its one entry
          (i32.store offset=28 (global.get $reg_base)
            (i32.add (i32.add (local.get $ecx) (call $gl8 (i32.add (local.get $ecx) (i32.const 1)))) (i32.const 0x12)))
          (i32.store offset=20 (global.get $reg_base) (i32.const 0))          ;; ebp = 0 fields left
          (i32.store offset=8 (global.get $reg_base) (i32.add (local.get $eax) (local.get $off)))
          (i32.store (global.get $reg_base) (i32.add (local.get $edx) (local.get $off)))
          (call $set_flags_add (local.get $off) (local.get $edx) (i32.add (local.get $edx) (local.get $off)))
          (global.set $flag_sign_shift (i32.const 31))
          (global.set $eip (i32.add (local.get $entry) (i32.const 0x110)))
          (return_call $branch_end)))
      (unreachable))
    ;; Back to the guest body: perform its first instruction, resume after it.
    ;; That instruction is no branch: the resume's transfer is refunded.
    (call $dfold_tick (local.get $id) (i32.const 1))
    (global.set $block_budget (i32.add (global.get $block_budget) (global.get $branch_clock)))
    (if (i32.eq (local.get $id) (i32.const 1))      ;; mov edx,[eax]
      (then (i32.store offset=8 (global.get $reg_base) (call $gl32 (local.get $eax)))
            (local.set $entry (i32.add (local.get $entry) (i32.const 2)))))
    (if (i32.eq (local.get $id) (i32.const 2))      ;; test edx,edx
      (then (call $set_flags_logic (local.get $edx)) (global.set $flag_sign_shift (i32.const 31))
            (local.set $entry (i32.add (local.get $entry) (i32.const 2)))))
    (if (i32.eq (local.get $id) (i32.const 3))      ;; xor ecx,ecx
      (then (i32.store offset=4 (global.get $reg_base) (i32.const 0))
            (call $set_flags_logic (i32.const 0)) (global.set $flag_sign_shift (i32.const 31))
            (local.set $entry (i32.add (local.get $entry) (i32.const 2)))))
    (if (i32.eq (local.get $id) (i32.const 4))      ;; cmp ecx,0
      (then (call $set_flags_sub (local.get $ecx) (i32.const 0) (local.get $ecx))
            (global.set $flag_sign_shift (i32.const 31))
            (local.set $entry (i32.add (local.get $entry) (i32.const 3)))))
    (if (i32.eq (local.get $id) (i32.const 5))      ;; push ebx
      (then (local.set $esp (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
            (call $gs32 (local.get $esp) (i32.load offset=12 (global.get $reg_base)))
            (i32.store offset=16 (global.get $reg_base) (local.get $esp))
            (local.set $entry (i32.add (local.get $entry) (i32.const 1)))))
    (global.set $eip (local.get $entry))
    (return_call $branch_end))

  ;; --no-delphi-fold / ?no-delphi-fold. Decode-time per instance: set it
  ;; before the first decode (lib/worker-imports.js carries it to threads).
  (func (export "set_delphi_fold") (param $on i32)
    (global.set $delphi_fold (i32.ne (local.get $on) (i32.const 0))))
  (func (export "get_delphi_fold") (result i32) (global.get $delphi_fold))
  ;; 0 native, 1 fallback, 2 partial, 3 CAS lost, 4 SMC group drops,
  ;; 11-15 native per helper id, 21-25 fallback per id
  ;; (1 _LStrClr 2 _LStrAsg 3 _FinalizeRecord 4 _FinalizeArray 5 _CopyRecord)
  (func (export "delphi_fold_stat") (param $k i32) (result i32)
    (if (i32.eqz (local.get $k)) (then (return (global.get $dfold_native))))
    (if (i32.eq (local.get $k) (i32.const 1)) (then (return (global.get $dfold_fallback))))
    (if (i32.eq (local.get $k) (i32.const 2)) (then (return (global.get $dfold_partial))))
    (if (i32.eq (local.get $k) (i32.const 3)) (then (return (global.get $dfold_cas_lost))))
    (if (i32.eq (local.get $k) (i32.const 4)) (then (return (global.get $dfold_smc_drops))))
    (if (i32.eq (local.get $k) (i32.const 11)) (then (return (global.get $dfold_n1))))
    (if (i32.eq (local.get $k) (i32.const 12)) (then (return (global.get $dfold_n2))))
    (if (i32.eq (local.get $k) (i32.const 13)) (then (return (global.get $dfold_n3))))
    (if (i32.eq (local.get $k) (i32.const 14)) (then (return (global.get $dfold_n4))))
    (if (i32.eq (local.get $k) (i32.const 15)) (then (return (global.get $dfold_n5))))
    (if (i32.eq (local.get $k) (i32.const 21)) (then (return (global.get $dfold_f1))))
    (if (i32.eq (local.get $k) (i32.const 22)) (then (return (global.get $dfold_f2))))
    (if (i32.eq (local.get $k) (i32.const 23)) (then (return (global.get $dfold_f3))))
    (if (i32.eq (local.get $k) (i32.const 24)) (then (return (global.get $dfold_f4))))
    (if (i32.eq (local.get $k) (i32.const 25)) (then (return (global.get $dfold_f5))))
    (i32.const 0))
