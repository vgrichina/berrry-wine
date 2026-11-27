  ;; ============================================================
  ;; DELPHI SYSTEM RTTI / LSTR HELPERS AS NATIVE WAT (the "D" fold)
  ;; ============================================================
  ;; On by default; --no-delphi-fold (CLI) / ?no-delphi-fold (browser) turns
  ;; it off (13-exports set_delphi_fold). Landed from branch fold-bench, arm D
  ;; (docs/re-notes/spelunky-classic.md). Self-contained on purpose: it is the
  ;; first resident of docs/design/known-routine-framework.md and moves onto
  ;; that framework later.
  ;;
  ;; The System unit's _LStrClr, _LStrAsg, _FinalizeRecord, _FinalizeArray,
  ;; _CopyRecord, _InitializeRecord, _InitializeArray and System.Move (the
  ;; FILD/FISTP form Delphi 2005+ links and the REP MOVSD form of Delphi 6-7,
  ;; i.e. Game Maker 5/7) are recognised at a block entry by their exact bytes
  ;; -- an FNV-1a over the body with every E8/E9 rel32 (and the FILD Move's
  ;; absolute jump table) left out, plus each callee the native form stands in
  ;; for checked by its own signature, and the Move _CopyRecord calls -- never
  ;; by address: Spelunky Classic (GM8) and Metrojd (GM7) link the same bodies
  ;; at different layouts. The decoder emits handler 395 (operand = id | Move
  ;; form << 8, one word = entry EIP) followed by RET ($dfold_emit).
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
  ;; _CopyRecord's leading Move (bytes before the string field) runs the same
  ;; native Move once that Move's whole body is checked and registered; its
  ;; trailing Move is resumed at its CALL (and is then the Move fold's).

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
  (global $dfold_n6 (mut i32) (i32.const 0)) (global $dfold_n7 (mut i32) (i32.const 0))
  (global $dfold_n8 (mut i32) (i32.const 0)) (global $dfold_n9 (mut i32) (i32.const 0))
  (global $dfold_f6 (mut i32) (i32.const 0)) (global $dfold_f7 (mut i32) (i32.const 0))
  (global $dfold_f8 (mut i32) (i32.const 0)) (global $dfold_f9 (mut i32) (i32.const 0))
  (global $dfold_f1 (mut i32) (i32.const 0)) (global $dfold_f2 (mut i32) (i32.const 0))
  (global $dfold_f3 (mut i32) (i32.const 0)) (global $dfold_f4 (mut i32) (i32.const 0))
  (global $dfold_f5 (mut i32) (i32.const 0))
  ;; $dfold_emit's result: one past the HLE block's page-index cover.
  (global $dfold_cover_end (mut i32) (i32.const 0))
  ;; The GM fold (Game Maker 5/7/8 runner routines, ids 10-13, and
  ;; _FinalizeArray over records): a mask under $delphi_fold, decode-time
  ;; like it. Bit 0 the variable-list scan, bit 1 the instance-table reads,
  ;; bit 2 _FinalizeArray's record loop. --gm-fold=MASK (13-exports
  ;; set_gm_fold); --no-delphi-fold turns these off too.
  (global $gm_fold (mut i32) (i32.const 7))
  ;; native / fallback per GM id (10-13), record arrays finished natively /
  ;; run natively up to an element the guest takes, and the scan's trips
  (global $gmf_n10 (mut i32) (i32.const 0)) (global $gmf_n11 (mut i32) (i32.const 0))
  (global $gmf_n12 (mut i32) (i32.const 0)) (global $gmf_n13 (mut i32) (i32.const 0))
  (global $gmf_f10 (mut i32) (i32.const 0)) (global $gmf_f11 (mut i32) (i32.const 0))
  (global $gmf_f12 (mut i32) (i32.const 0)) (global $gmf_f13 (mut i32) (i32.const 0))
  (global $gmf_rec (mut i32) (i32.const 0)) (global $gmf_rec_part (mut i32) (i32.const 0))
  (global $gmf_trips (mut i32) (i32.const 0))
  ;; the scan's trips per entry off the branch clock (a corrupt count must
  ;; not hold the run loop forever: the rest resumes at the loop head)
  (global $GMF_CHUNK i32 (i32.const 0x10000))
  ;; the largest record array _FinalizeArray takes natively
  (global $GMF_REC_MAX i32 (i32.const 0x10000))

  ;; ---- signatures ----------------------------------------------------------
  (func $d_in4 (param $o i32) (param $s i32) (result i32)
    (i32.lt_u (i32.sub (local.get $o) (local.get $s)) (i32.const 4)))
  ;; length of the body's first instruction (the fallback's resume offset)
  (func $d_k (param $id i32) (result i32)
    (if (i32.or (i32.eq (local.get $id) (i32.const 4)) (i32.eq (local.get $id) (i32.const 10)))
      (then (return (i32.const 3))))
    (if (i32.or (i32.or (i32.eq (local.get $id) (i32.const 5)) (i32.eq (local.get $id) (i32.const 9)))
                (i32.ge_u (local.get $id) (i32.const 11)))
      (then (return (i32.const 1))))
    (i32.const 2))
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
    (if (i32.eq (local.get $id) (i32.const 6)) (then (return (call $d_in4 (local.get $o) (i32.const 0x21)))))
    (if (i32.eq (local.get $id) (i32.const 7))
      (then (return (i32.or (call $d_in4 (local.get $o) (i32.const 0x3C))
                            (i32.or (call $d_in4 (local.get $o) (i32.const 0x71)) (call $d_in4 (local.get $o) (i32.const 0x87)))))))
    ;; the FILD Move's two absolute fields: the jump table's address and the
    ;; table itself (both checked against the entry by $d_move_table_ok)
    (if (i32.eq (local.get $id) (i32.const 8))
      (then (return (i32.or (call $d_in4 (local.get $o) (i32.const 0x11))
                            (i32.lt_u (i32.sub (local.get $o) (i32.const 0x38)) (i32.const 0x24))))))
    ;; the Game Maker instance-table reads: the CALL to DynArray length
    (if (i32.ge_u (local.get $id) (i32.const 11))
      (then (if (i32.le_u (local.get $id) (i32.const 13))
              (then (return (call $d_in4 (local.get $o) (call $gmf_call_off (local.get $id))))))))
    (i32.const 0))
  ;; Bodies: 1 _LStrClr, 2 _LStrAsg, 3 _FinalizeRecord, 4 _FinalizeArray,
  ;; 5 _CopyRecord, 6 _InitializeRecord, 7 _InitializeArray, 8 System.Move
  ;; (FILD/FISTP form, with its jump table), 9 System.Move (REP MOVSD form).
  ;; Game Maker runner (the "GM fold", 5/7/8 alike, $gm_fold): 10 the
  ;; variable-list backward scan loop, 11/12 the bounds-checked 2-D instance
  ;; table reads (disp32 / disp8 fields), 13 the 1-D one, 14 the DynArray
  ;; length they call (matched as a callee only, never folded itself).
  ;; 3 and 6 share their first dword (the same prologue), so do 5, 11 and 12.
  (func $d_len (param $id i32) (result i32)
    (if (i32.eq (local.get $id) (i32.const 1)) (then (return (i32.const 0x23))))
    (if (i32.eq (local.get $id) (i32.const 2)) (then (return (i32.const 0x43))))
    (if (i32.eq (local.get $id) (i32.const 3)) (then (return (i32.const 0x31))))
    (if (i32.eq (local.get $id) (i32.const 4)) (then (return (i32.const 0xEA))))
    (if (i32.eq (local.get $id) (i32.const 5)) (then (return (i32.const 0x11A))))
    (if (i32.eq (local.get $id) (i32.const 6)) (then (return (i32.const 0x2F))))
    (if (i32.eq (local.get $id) (i32.const 7)) (then (return (i32.const 0x93))))
    (if (i32.eq (local.get $id) (i32.const 8)) (then (return (i32.const 0xFD))))
    (if (i32.eq (local.get $id) (i32.const 10)) (then (return (i32.const 0x15))))
    (if (i32.eq (local.get $id) (i32.const 11)) (then (return (i32.const 0x41))))
    (if (i32.eq (local.get $id) (i32.const 12)) (then (return (i32.const 0x38))))
    (if (i32.eq (local.get $id) (i32.const 13)) (then (return (i32.const 0x25))))
    (if (i32.eq (local.get $id) (i32.const 14)) (then (return (i32.const 0x08))))
    (i32.const 0x40))
  (func $d_first (param $id i32) (result i32)
    (if (i32.eq (local.get $id) (i32.const 1)) (then (return (i32.const 0xd285108b))))
    (if (i32.eq (local.get $id) (i32.const 2)) (then (return (i32.const 0x2474d285))))
    (if (i32.eq (local.get $id) (i32.const 3)) (then (return (i32.const 0x8a53c931))))
    (if (i32.eq (local.get $id) (i32.const 4)) (then (return (i32.const 0x0f00f983))))
    (if (i32.eq (local.get $id) (i32.const 5)) (then (return (i32.const 0x55575653))))
    (if (i32.eq (local.get $id) (i32.const 6)) (then (return (i32.const 0x8a53c931))))
    (if (i32.eq (local.get $id) (i32.const 7)) (then (return (i32.const 0x840fc985))))
    (if (i32.eq (local.get $id) (i32.const 8)) (then (return (i32.const 0x3174d039))))
    (if (i32.eq (local.get $id) (i32.const 10)) (then (return (i32.const 0x8bb61c8d))))
    (if (i32.or (i32.eq (local.get $id) (i32.const 11)) (i32.eq (local.get $id) (i32.const 12)))
      (then (return (i32.const 0x55575653))))
    (if (i32.eq (local.get $id) (i32.const 13)) (then (return (i32.const 0x8b575653))))
    (if (i32.eq (local.get $id) (i32.const 14)) (then (return (i32.const 0x0374c085))))
    (i32.const 0xc6895756))
  (func $d_fnv (param $id i32) (result i32)
    (if (i32.eq (local.get $id) (i32.const 1)) (then (return (i32.const 0xcacb444e))))
    (if (i32.eq (local.get $id) (i32.const 2)) (then (return (i32.const 0xa1749f54))))
    (if (i32.eq (local.get $id) (i32.const 3)) (then (return (i32.const 0xfa8250b0))))
    (if (i32.eq (local.get $id) (i32.const 4)) (then (return (i32.const 0xe8843657))))
    (if (i32.eq (local.get $id) (i32.const 5)) (then (return (i32.const 0xbfece31d))))
    (if (i32.eq (local.get $id) (i32.const 6)) (then (return (i32.const 0x9323153d))))
    (if (i32.eq (local.get $id) (i32.const 7)) (then (return (i32.const 0x5b56943e))))
    (if (i32.eq (local.get $id) (i32.const 8)) (then (return (i32.const 0xfdefbda4))))
    (if (i32.eq (local.get $id) (i32.const 10)) (then (return (i32.const 0x988ad2c0))))
    (if (i32.eq (local.get $id) (i32.const 11)) (then (return (i32.const 0xeab1a823))))
    (if (i32.eq (local.get $id) (i32.const 12)) (then (return (i32.const 0xa935754b))))
    (if (i32.eq (local.get $id) (i32.const 13)) (then (return (i32.const 0x67490794))))
    (if (i32.eq (local.get $id) (i32.const 14)) (then (return (i32.const 0x567cdfc7))))
    (i32.const 0xfa2e0fd2))
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
  ;; Which helper (1-9) starts at $eip, or 0. Asked once per block decode, and
  ;; by the uop compiler (07e) for each instruction it forms a region over: a
  ;; program exits to a helper entry rather than lowering its bytes. Every id
  ;; whose first dword matches is tried (3 and 6 share theirs).
  (func $dfold_at (param $eip i32) (result i32)
    (local $w i32) (local $id i32)
    (if (i32.or (global.get $code16) (i32.eqz (global.get $delphi_fold)))
      (then (return (i32.const 0))))
    (local.set $w (call $gl32 (local.get $eip)))
    (local.set $id (i32.const 1))
    (loop $l
      (if (i32.eq (local.get $w) (call $d_first (local.get $id)))
        (then (if (call $gmf_wanted (local.get $id))
                (then (if (call $d_check (local.get $eip) (local.get $id)) (then (return (local.get $id))))))))
      (local.set $id (i32.add (local.get $id) (i32.const 1)))
      (br_if $l (i32.le_u (local.get $id) (i32.const 13))))
    (i32.const 0))
  ;; Is helper id switched on? 1-9 by $delphi_fold alone; the GM ids by
  ;; their $gm_fold bit too (bit 0 the var scan, bit 1 the instance reads).
  (func $gmf_wanted (param $id i32) (result i32)
    (if (i32.lt_u (local.get $id) (i32.const 10)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $id) (i32.const 10))
      (then (return (i32.and (global.get $gm_fold) (i32.const 1)))))
    (i32.ne (i32.and (global.get $gm_fold) (i32.const 2)) (i32.const 0)))
  ;; the instance reads' CALL DynArray-length rel32 offset
  (func $gmf_call_off (param $id i32) (result i32)
    (select (i32.const 0x17) (select (i32.const 0x14) (i32.const 0x11) (i32.eq (local.get $id) (i32.const 12)))
            (i32.eq (local.get $id) (i32.const 11))))
  ;; Body $id at $eip, and the callees whose semantics its native form includes.
  (func $d_check (param $eip i32) (param $id i32) (result i32)
    (local $fa i32)
    (if (i32.eqz (call $d_sig (local.get $eip) (local.get $id))) (then (return (i32.const 0))))
    (if (i32.eq (local.get $id) (i32.const 3))
      (then (local.set $fa (call $d_rel (local.get $eip) (i32.const 0x21)))
            (if (i32.eqz (call $d_sig (local.get $fa) (i32.const 4))) (then (return (i32.const 0))))
            (return (call $d_sig (call $d_rel (local.get $fa) (i32.const 0x4B)) (i32.const 1)))))
    (if (i32.eq (local.get $id) (i32.const 4))
      (then (return (call $d_sig (call $d_rel (local.get $eip) (i32.const 0x4B)) (i32.const 1)))))
    (if (i32.eq (local.get $id) (i32.const 5))
      (then (return (call $d_sig (call $d_rel (local.get $eip) (i32.const 0x71)) (i32.const 2)))))
    ;; _InitializeRecord calls _InitializeArray, which calls itself (+0x71)
    ;; and _InitializeRecord (+0x87): the pair is one native form
    (if (i32.eq (local.get $id) (i32.const 6))
      (then (return (call $d_ia_pair (call $d_rel (local.get $eip) (i32.const 0x21)) (local.get $eip)))))
    (if (i32.eq (local.get $id) (i32.const 7))
      (then
        (local.set $fa (call $d_rel (local.get $eip) (i32.const 0x87)))
        (if (i32.eqz (call $d_sig (local.get $fa) (i32.const 6))) (then (return (i32.const 0))))
        (return (call $d_ia_pair (local.get $eip) (local.get $fa)))))
    (if (i32.eq (local.get $id) (i32.const 8)) (then (return (call $d_move_table_ok (local.get $eip)))))
    (if (i32.ge_u (local.get $id) (i32.const 11))
      (then (return (call $d_sig (call $d_rel (local.get $eip) (call $gmf_call_off (local.get $id))) (i32.const 14)))))
    (i32.const 1))
  ;; _InitializeArray at $ia (signature) calling itself and _InitializeRecord
  ;; at $ir, which calls it back.
  (func $d_ia_pair (param $ia i32) (param $ir i32) (result i32)
    (if (i32.eqz (call $d_sig (local.get $ia) (i32.const 7))) (then (return (i32.const 0))))
    (i32.and (i32.eq (call $d_rel (local.get $ia) (i32.const 0x71)) (local.get $ia))
      (i32.and (i32.eq (call $d_rel (local.get $ia) (i32.const 0x87)) (local.get $ir))
               (i32.eq (call $d_rel (local.get $ir) (i32.const 0x21)) (local.get $ia)))))
  ;; The FILD/FISTP Move's absolute fields, left out of its hash: the jump
  ;; table's address (+0x11) is entry+0x58, and its nine entries (n = 0..8,
  ;; from entry+0x38) point at their handlers inside the body.
  (func $d_move_table_ok (param $a i32) (result i32)
    (if (i32.ne (call $gl32 (i32.add (local.get $a) (i32.const 0x11))) (i32.add (local.get $a) (i32.const 0x58)))
      (then (return (i32.const 0))))
    (i32.and
      (i32.and
        (i32.and (call $d_tab (local.get $a) (i32.const 0) (i32.const 0x35))
                 (call $d_tab (local.get $a) (i32.const 1) (i32.const 0xB6)))
        (i32.and (call $d_tab (local.get $a) (i32.const 2) (i32.const 0xBC))
                 (call $d_tab (local.get $a) (i32.const 3) (i32.const 0xC3))))
      (i32.and
        (i32.and (call $d_tab (local.get $a) (i32.const 4) (i32.const 0xD0))
                 (call $d_tab (local.get $a) (i32.const 5) (i32.const 0xD5)))
        (i32.and (i32.and (call $d_tab (local.get $a) (i32.const 6) (i32.const 0xE0))
                          (call $d_tab (local.get $a) (i32.const 7) (i32.const 0xED)))
                 (call $d_tab (local.get $a) (i32.const 8) (i32.const 0xF8))))))
  (func $d_tab (param $a i32) (param $i i32) (param $o i32) (result i32)
    (i32.eq (call $gl32 (i32.add (local.get $a) (i32.add (i32.const 0x38) (i32.shl (local.get $i) (i32.const 2)))))
            (i32.add (local.get $a) (local.get $o))))

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
    ;; the Init pair: each registers the other (not recursively)
    (if (i32.eq (local.get $id) (i32.const 6))
      (then (return (call $dfold_reg_one (call $d_rel (local.get $ga) (i32.const 0x21)) (i32.const 7)))))
    (if (i32.eq (local.get $id) (i32.const 7))
      (then (return (call $dfold_reg_one (call $d_rel (local.get $ga) (i32.const 0x87)) (i32.const 6)))))
    (if (i32.ge_u (local.get $id) (i32.const 11))
      (then (return (call $dfold_reg_one (call $d_rel (local.get $ga) (call $gmf_call_off (local.get $id))) (i32.const 14)))))
    (i32.const 1))
  (func $dfold_reg_one (param $ga i32) (param $id i32) (result i32)
    (call $dfold_reg (local.get $ga) (i32.add (local.get $ga) (call $d_len (local.get $id)))))
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
    ;; _CopyRecord's leading Move: which form it is (bit 8 FILD, bit 9 REP),
    ;; whole body checked and registered, or neither (bytes before the
    ;; field then fall back)
    (if (i32.eq (local.get $id) (i32.const 5))
      (then
        (local.set $mv (call $d_rel (local.get $eip) (i32.const 0x28)))
        (if (call $d_check (local.get $mv) (i32.const 8))
          (then (if (call $dfold_reg_one (local.get $mv) (i32.const 8))
                  (then (local.set $op (i32.or (local.get $op) (i32.const 0x100)))))))
        (if (call $d_check (local.get $mv) (i32.const 9))
          (then (if (call $dfold_reg_one (local.get $mv) (i32.const 9))
                  (then (local.set $op (i32.or (local.get $op) (i32.const 0x200)))))))))
    ;; _FinalizeArray over records (bit 10, $gm_fold bit 2): its record loop
    ;; calls _FinalizeRecord (+0xB0), which must be the System unit's and
    ;; call this _FinalizeArray back (+0x21) -- the per-element native form
    ;; is that pair's
    (if (i32.and (i32.eq (local.get $id) (i32.const 4))
                 (i32.ne (i32.and (global.get $gm_fold) (i32.const 4)) (i32.const 0)))
      (then
        (local.set $mv (call $d_rel (local.get $eip) (i32.const 0xB0)))
        (if (call $d_sig (local.get $mv) (i32.const 3))
          (then (if (i32.eq (call $d_rel (local.get $mv) (i32.const 0x21)) (local.get $eip))
                  (then (if (call $dfold_reg_one (local.get $mv) (i32.const 3))
                          (then (local.set $op (i32.or (local.get $op) (i32.const 0x400)))))))))))
    (call $te (i32.const 395) (local.get $op))
    (call $te_raw (local.get $eip))
    ;; the var scan is a loop inside its function, not a helper: no RET, its
    ;; handler always leaves through $branch_end
    (if (i32.ne (local.get $id) (i32.const 10)) (then (call $te (i32.const 41) (i32.const 0))))
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
  ;; DEC keeps CF, which is the body's earlier TEST EDX,EDX's: 0, whatever
  ;; the caller's CF was (the lazy DEC reads CF when it is recorded).
  (func $d_released (param $rc i32)
    (i32.store offset=4 (global.get $reg_base) (i32.sub (local.get $rc) (i32.const 1)))
    (call $set_flags_logic (i32.const 0))
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
        (if (i32.eq (local.get $id) (i32.const 6)) (then (global.set $dfold_f6 (i32.add (global.get $dfold_f6) (i32.const 1)))))
        (if (i32.eq (local.get $id) (i32.const 7)) (then (global.set $dfold_f7 (i32.add (global.get $dfold_f7) (i32.const 1)))))
        (if (i32.eq (local.get $id) (i32.const 8)) (then (global.set $dfold_f8 (i32.add (global.get $dfold_f8) (i32.const 1)))))
        (if (i32.eq (local.get $id) (i32.const 9)) (then (global.set $dfold_f9 (i32.add (global.get $dfold_f9) (i32.const 1)))))
        (if (i32.eq (local.get $id) (i32.const 10)) (then (global.set $gmf_f10 (i32.add (global.get $gmf_f10) (i32.const 1)))))
        (if (i32.eq (local.get $id) (i32.const 11)) (then (global.set $gmf_f11 (i32.add (global.get $gmf_f11) (i32.const 1)))))
        (if (i32.eq (local.get $id) (i32.const 12)) (then (global.set $gmf_f12 (i32.add (global.get $gmf_f12) (i32.const 1)))))
        (if (i32.eq (local.get $id) (i32.const 13)) (then (global.set $gmf_f13 (i32.add (global.get $gmf_f13) (i32.const 1)))))
        (return)))
    (global.set $dfold_native (i32.add (global.get $dfold_native) (i32.const 1)))
    (if (i32.eq (local.get $id) (i32.const 1)) (then (global.set $dfold_n1 (i32.add (global.get $dfold_n1) (i32.const 1)))))
    (if (i32.eq (local.get $id) (i32.const 2)) (then (global.set $dfold_n2 (i32.add (global.get $dfold_n2) (i32.const 1)))))
    (if (i32.eq (local.get $id) (i32.const 3)) (then (global.set $dfold_n3 (i32.add (global.get $dfold_n3) (i32.const 1)))))
    (if (i32.eq (local.get $id) (i32.const 4)) (then (global.set $dfold_n4 (i32.add (global.get $dfold_n4) (i32.const 1)))))
    (if (i32.eq (local.get $id) (i32.const 5)) (then (global.set $dfold_n5 (i32.add (global.get $dfold_n5) (i32.const 1)))))
    (if (i32.eq (local.get $id) (i32.const 6)) (then (global.set $dfold_n6 (i32.add (global.get $dfold_n6) (i32.const 1)))))
    (if (i32.eq (local.get $id) (i32.const 7)) (then (global.set $dfold_n7 (i32.add (global.get $dfold_n7) (i32.const 1)))))
    (if (i32.eq (local.get $id) (i32.const 8)) (then (global.set $dfold_n8 (i32.add (global.get $dfold_n8) (i32.const 1)))))
    (if (i32.eq (local.get $id) (i32.const 9)) (then (global.set $dfold_n9 (i32.add (global.get $dfold_n9) (i32.const 1)))))
    (if (i32.eq (local.get $id) (i32.const 10)) (then (global.set $gmf_n10 (i32.add (global.get $gmf_n10) (i32.const 1)))))
    (if (i32.eq (local.get $id) (i32.const 11)) (then (global.set $gmf_n11 (i32.add (global.get $gmf_n11) (i32.const 1)))))
    (if (i32.eq (local.get $id) (i32.const 12)) (then (global.set $gmf_n12 (i32.add (global.get $gmf_n12) (i32.const 1)))))
    (if (i32.eq (local.get $id) (i32.const 13)) (then (global.set $gmf_n13 (i32.add (global.get $gmf_n13) (i32.const 1))))))
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
  ;;   System.Move(src, dst, n), form 8 (FILD/FISTP, jump table) or 9 (REP
  ;;   MOVSD), or -1 for a call the native form does not take. Shared by the
  ;;   Move fold and _CopyRecord's leading Move, so the two cannot disagree.
  ;;   Form 8: src = dst 1 (jz); n < 0 3 (jz ja jle); 0..8 4 (jz ja jg, the
  ;;   table JMP); 9..16 4 (jz ja jg jle); 17..32 5 (+jle); n > 32: jz ja jle
  ;;   ja (src > dst) or +jbe, then one jl/jg per 8-byte step of the forward
  ;;   or backward loop. Declined: src < dst < n, where the body's unsigned
  ;;   dst-n wraps and it copies forward over its own source.
  ;;   Form 9: dst = src 2 (ja jz); dst < src 3 (+js); dst > src 2 (ja js);
  ;;   REP MOVS is no block end. Declined: n < 0 (the body returns with
  ;;   nothing copied, but ECX shifted) and DF set.
  (global $DMOVE_MAX i32 (i32.const 0x100000))
  (func $d_move_br (param $form i32) (param $src i32) (param $dst i32) (param $n i32) (result i32)
    (local $c i32)
    (if (i32.eq (local.get $form) (i32.const 9))
      (then
        (if (i32.or (global.get $df) (i32.lt_s (local.get $n) (i32.const 0))) (then (return (i32.const -1))))
        (if (i32.gt_s (local.get $n) (global.get $DMOVE_MAX)) (then (return (i32.const -1))))
        (if (i32.eq (local.get $dst) (local.get $src)) (then (return (i32.const 2))))
        (return (select (i32.const 3) (i32.const 2) (i32.lt_u (local.get $dst) (local.get $src))))))
    (if (i32.eq (local.get $src) (local.get $dst)) (then (return (i32.const 1))))
    (if (i32.lt_s (local.get $n) (i32.const 0)) (then (return (i32.const 3))))
    (if (i32.le_s (local.get $n) (i32.const 16)) (then (return (i32.const 4))))
    (if (i32.le_s (local.get $n) (i32.const 32)) (then (return (i32.const 5))))
    (if (i32.gt_s (local.get $n) (global.get $DMOVE_MAX)) (then (return (i32.const -1))))
    (if (i32.gt_u (local.get $src) (local.get $dst))
      (then (return (i32.add (i32.const 4) (call $d_mv_kf (local.get $dst) (local.get $n))))))
    (if (i32.lt_u (local.get $dst) (local.get $n)) (then (return (i32.const -1))))
    (if (i32.le_u (local.get $src) (i32.sub (local.get $dst) (local.get $n)))
      (then (return (i32.add (i32.const 5) (call $d_mv_kf (local.get $dst) (local.get $n))))))
    (i32.add (i32.const 5) (call $d_mv_kb (local.get $dst) (local.get $n))))
  ;; form 8, n > 32: the forward loop's start offset (from the last 8 bytes,
  ;; counting up to 0) and step count; the backward loop's (counting down)
  (func $d_mv_cf (param $dst i32) (param $n i32) (result i32)
    (i32.sub (i32.add (i32.and (local.get $dst) (i32.const -8)) (i32.const 8))
             (i32.add (local.get $dst) (i32.sub (local.get $n) (i32.const 8)))))
  (func $d_mv_kf (param $dst i32) (param $n i32) (result i32)
    (i32.shr_s (i32.sub (i32.const 7) (call $d_mv_cf (local.get $dst) (local.get $n))) (i32.const 3)))
  (func $d_mv_cb (param $dst i32) (param $n i32) (result i32)
    (i32.sub (i32.and (i32.add (local.get $dst) (i32.sub (local.get $n) (i32.const 8))) (i32.const -8))
             (local.get $dst)))
  (func $d_mv_kb (param $dst i32) (param $n i32) (result i32)
    (i32.shr_s (i32.add (call $d_mv_cb (local.get $dst) (local.get $n)) (i32.const 7)) (i32.const 3)))
  ;; The Move fold's exit: the copy (every accepted case is memmove-exact:
  ;; each form reads a span before writing it, in the safe direction) and the
  ;; registers and flags the form's body leaves. ESI/EDI/EBX are preserved.
  (func $d_move_run (param $form i32) (param $src i32) (param $dst i32) (param $n i32)
    (local $ecx i32) (local $eax i32) (local $c i32) (local $k i32)
    (local.set $eax (local.get $src))
    (if (i32.eq (local.get $form) (i32.const 9))
      (then
        ;; mov eax,ecx first; cmp edi,esi
        (i32.store (global.get $reg_base) (local.get $n))
        (if (i32.eq (local.get $dst) (local.get $src))
          (then (call $set_flags_sub (local.get $dst) (local.get $src) (i32.const 0))
                (global.set $flag_sign_shift (i32.const 31)) (return)))
        (call $d_move (local.get $dst) (local.get $src) (local.get $n))
        (i32.store offset=4 (global.get $reg_base) (i32.const 0))
        (if (i32.lt_u (local.get $dst) (local.get $src))
          ;; and ecx,3
          (then (call $set_flags_logic (i32.and (local.get $n) (i32.const 3))))
          ;; add edi,3 after the backward dwords
          (else (local.set $c (i32.add (local.get $dst) (i32.sub (i32.and (local.get $n) (i32.const 3)) (i32.const 4))))
                (call $set_flags_add (local.get $c) (i32.const 3) (i32.add (local.get $c) (i32.const 3)))))
        (global.set $flag_sign_shift (i32.const 31))
        (return)))
    (if (i32.eq (local.get $src) (local.get $dst))
      (then (call $set_flags_sub (local.get $src) (local.get $dst) (i32.const 0))
            (global.set $flag_sign_shift (i32.const 31)) (return)))
    (if (i32.lt_s (local.get $n) (i32.const 0))
      (then (call $set_flags_sub (local.get $n) (i32.const 0x20) (i32.sub (local.get $n) (i32.const 0x20)))
            (global.set $flag_sign_shift (i32.const 31)) (return)))
    (local.set $ecx (i32.sub (local.get $n) (i32.const 8)))
    (if (i32.le_s (local.get $n) (i32.const 8))
      (then
        ;; the table handlers, which read the source before writing
        (if (i32.eq (local.get $n) (i32.const 1)) (then (local.set $ecx (call $gl8 (local.get $src)))))
        (if (i32.eq (local.get $n) (i32.const 2)) (then (local.set $ecx (call $gl16 (local.get $src)))))
        (if (i32.eq (local.get $n) (i32.const 3))
          (then (local.set $ecx (i32.or (i32.const 0xFFFF0000) (call $gl16 (local.get $src))))
                (local.set $eax (i32.or (i32.and (local.get $src) (i32.const -256))
                                        (call $gl8 (i32.add (local.get $src) (i32.const 2)))))))
        (if (i32.and (i32.ge_s (local.get $n) (i32.const 4)) (i32.le_s (local.get $n) (i32.const 7)))
          (then (local.set $ecx (call $gl32 (local.get $src)))))
        (if (i32.eq (local.get $n) (i32.const 5))
          (then (local.set $eax (i32.or (i32.and (local.get $src) (i32.const -256))
                                        (call $gl8 (i32.add (local.get $src) (i32.const 4)))))))
        (if (i32.eq (local.get $n) (i32.const 6))
          (then (local.set $eax (i32.or (i32.and (local.get $src) (i32.const -65536))
                                        (call $gl16 (i32.add (local.get $src) (i32.const 4)))))))
        (if (i32.eq (local.get $n) (i32.const 7))
          (then (local.set $eax (call $gl32 (i32.add (local.get $src) (i32.const 3))))))
        (call $set_flags_sub (local.get $n) (i32.const 8) (i32.sub (local.get $n) (i32.const 8)))
        (call $d_move (local.get $dst) (local.get $src) (local.get $n))
        (i32.store (global.get $reg_base) (local.get $eax))
        (i32.store offset=4 (global.get $reg_base) (local.get $ecx))
        (global.set $flag_sign_shift (i32.const 31))
        (return)))
    (call $d_move (local.get $dst) (local.get $src) (local.get $n))
    (if (i32.le_s (local.get $n) (i32.const 32))
      (then
        (local.set $c (select (i32.const 8) (i32.const 16) (i32.le_s (local.get $n) (i32.const 16))))
        (call $set_flags_sub (local.get $ecx) (local.get $c) (i32.sub (local.get $ecx) (local.get $c)))
        (i32.store offset=4 (global.get $reg_base) (local.get $ecx))
        (global.set $flag_sign_shift (i32.const 31))
        (return)))
    (if (i32.or (i32.gt_u (local.get $src) (local.get $dst))
                (i32.le_u (local.get $src) (i32.sub (local.get $dst) (local.get $n))))
      (then
        ;; forward: add ecx,8 ... jl; EAX = src+n-8
        (local.set $k (call $d_mv_kf (local.get $dst) (local.get $n)))
        (local.set $c (i32.add (call $d_mv_cf (local.get $dst) (local.get $n))
                               (i32.shl (i32.sub (local.get $k) (i32.const 1)) (i32.const 3))))
        (call $set_flags_add (local.get $c) (i32.const 8) (i32.add (local.get $c) (i32.const 8)))
        (i32.store (global.get $reg_base) (i32.add (local.get $src) (local.get $ecx)))
        (i32.store offset=4 (global.get $reg_base) (i32.add (local.get $c) (i32.const 8))))
      (else
        ;; backward: sub ecx,8 ... jg; ECX = n-8 popped
        (local.set $k (call $d_mv_kb (local.get $dst) (local.get $n)))
        (local.set $c (i32.sub (call $d_mv_cb (local.get $dst) (local.get $n))
                               (i32.shl (i32.sub (local.get $k) (i32.const 1)) (i32.const 3))))
        (call $set_flags_sub (local.get $c) (i32.const 8) (i32.sub (local.get $c) (i32.const 8)))
        (i32.store offset=4 (global.get $reg_base) (local.get $ecx))))
    (global.set $flag_sign_shift (i32.const 31)))

  ;; ---- _InitializeRecord / _InitializeArray ---------------------------------
  ;; IA(eax = p, edx = typeinfo, ecx = n) zeroes the managed slots of n
  ;; elements; IR(eax = p, edx = record typeinfo) calls IA(p+off, type, 1) per
  ;; managed field. A plan pass walks the typeinfo first -- every kind known,
  ;; counts in range, nesting bounded, no typeinfo byte inside the zeroed
  ;; extent -- and returns the branches the threaded bodies would run (the
  ;; outermost RET excluded), or -1; nothing is written until it says yes.
  ;; IA: n = 0 1 (jz). Else jz, the kind's compare chain (A 1, B 2, C 3, D 4,
  ;; E 5, F 6, 0x11 7 Jcc), then per element: flat kinds 1 (jg); C 1; D
  ;; CALL+IA+RET+jg; E CALL+IR+RET+jg; then JMP. IR: per field CALL+IA+RET+jg.
  ;; The call's extent [di_lo, di_hi) is the outermost record or array (its
  ;; size from the typeinfo): every zeroed span must lie inside it, and no
  ;; typeinfo byte the walk reads may (the exec pass re-reads them after
  ;; zeroing). Compiler-made RTTI satisfies both; anything else declines.
  (global $DINIT_MAX i32 (i32.const 0x40000))
  (global $di_lo (mut i32) (i32.const 0)) (global $di_hi (mut i32) (i32.const 0))
  (global $di_bad (mut i32) (i32.const 0))
  (global $di_work (mut i32) (i32.const 0))
  (func $di_rd (param $a i32) (param $n i32)
    (if (i32.and (i32.lt_u (local.get $a) (global.get $di_hi))
                 (i32.gt_u (i32.add (local.get $a) (local.get $n)) (global.get $di_lo)))
      (then (global.set $di_bad (i32.const 1)))))
  ;; a zeroed span; 0 if it leaves the extent
  (func $di_wr (param $a i32) (param $n i32) (result i32)
    (i32.and (i32.ge_u (local.get $a) (global.get $di_lo))
             (i32.le_u (i32.sub (local.get $a) (global.get $di_lo))
                       (i32.sub (i32.sub (global.get $di_hi) (global.get $di_lo)) (local.get $n)))))
  ;; the compare-chain length for an IA kind, 0 for one it does not take
  (func $di_disp (param $k i32) (result i32)
    (if (i32.eq (local.get $k) (i32.const 0x0A)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $k) (i32.const 0x0B)) (then (return (i32.const 2))))
    (if (i32.eq (local.get $k) (i32.const 0x0C)) (then (return (i32.const 3))))
    (if (i32.eq (local.get $k) (i32.const 0x0D)) (then (return (i32.const 4))))
    (if (i32.eq (local.get $k) (i32.const 0x0E)) (then (return (i32.const 5))))
    (if (i32.eq (local.get $k) (i32.const 0x0F)) (then (return (i32.const 6))))
    (if (i32.eq (local.get $k) (i32.const 0x11)) (then (return (i32.const 7))))
    (i32.const 0))
  (func $di_ia_plan (param $p i32) (param $ti i32) (param $n i32) (param $depth i32) (result i32)
    (local $kind i32) (local $disp i32) (local $tl i32) (local $es i32) (local $cnt i32) (local $et i32)
    (local $i i32) (local $b i32) (local $tot i32)
    (if (i32.eqz (local.get $n)) (then (return (i32.const 1))))
    (if (i32.or (i32.lt_s (local.get $n) (i32.const 0)) (i32.gt_u (local.get $depth) (i32.const 8)))
      (then (return (i32.const -1))))
    (global.set $di_work (i32.add (global.get $di_work) (local.get $n)))
    (if (i32.gt_u (global.get $di_work) (global.get $DINIT_MAX)) (then (return (i32.const -1))))
    (call $di_rd (local.get $ti) (i32.const 2))
    (local.set $kind (call $gl8 (local.get $ti)))
    (local.set $disp (call $di_disp (local.get $kind)))
    (if (i32.eqz (local.get $disp)) (then (return (i32.const -1))))
    (local.set $tl (i32.add (local.get $ti) (call $gl8 (i32.add (local.get $ti) (i32.const 1)))))
    ;; flat kinds: one dword per element; C: four
    (if (i32.or (i32.or (i32.eq (local.get $kind) (i32.const 0x0A)) (i32.eq (local.get $kind) (i32.const 0x0B)))
                (i32.or (i32.eq (local.get $kind) (i32.const 0x0F)) (i32.eq (local.get $kind) (i32.const 0x11))))
      (then
        (if (i32.eqz (call $di_wr (local.get $p) (i32.shl (local.get $n) (i32.const 2)))) (then (return (i32.const -1))))
        (return (i32.add (i32.add (local.get $disp) (i32.const 2)) (local.get $n)))))
    (if (i32.eq (local.get $kind) (i32.const 0x0C))
      (then
        (if (i32.eqz (call $di_wr (local.get $p) (i32.shl (local.get $n) (i32.const 4)))) (then (return (i32.const -1))))
        (return (i32.add (i32.add (local.get $disp) (i32.const 2)) (local.get $n)))))
    ;; jz, the chain, and D's JMP to the shared exit (E falls into it)
    (local.set $tot (i32.add (local.get $disp) (select (i32.const 2) (i32.const 1) (i32.eq (local.get $kind) (i32.const 0x0D)))))
    (if (i32.eq (local.get $kind) (i32.const 0x0D))
      (then
        ;; a static array: element size, count, element typeinfo
        (call $di_rd (i32.add (local.get $tl) (i32.const 2)) (i32.const 12))
        (local.set $es (call $gl32 (i32.add (local.get $tl) (i32.const 2))))
        (local.set $cnt (call $gl32 (i32.add (local.get $tl) (i32.const 6))))
        (local.set $et (call $gl32 (i32.add (local.get $tl) (i32.const 0xA))))
        (call $di_rd (local.get $et) (i32.const 4))
        (local.set $et (call $gl32 (local.get $et)))
        (block $d (loop $l
          (br_if $d (i32.ge_u (local.get $i) (local.get $n)))
          (local.set $b (call $di_ia_plan (i32.add (local.get $p) (i32.mul (local.get $i) (local.get $es)))
                                          (local.get $et) (local.get $cnt) (i32.add (local.get $depth) (i32.const 1))))
          (if (i32.lt_s (local.get $b) (i32.const 0)) (then (return (i32.const -1))))
          (local.set $tot (i32.add (local.get $tot) (i32.add (local.get $b) (i32.const 3))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $l)))
        (return (local.get $tot))))
    ;; 0x0E, a record: its size, then IR per element
    (call $di_rd (i32.add (local.get $tl) (i32.const 2)) (i32.const 4))
    (local.set $es (call $gl32 (i32.add (local.get $tl) (i32.const 2))))
    (block $d (loop $l
      (br_if $d (i32.ge_u (local.get $i) (local.get $n)))
      (local.set $b (call $di_ir_plan (i32.add (local.get $p) (i32.mul (local.get $i) (local.get $es)))
                                      (local.get $ti) (i32.add (local.get $depth) (i32.const 1))))
      (if (i32.lt_s (local.get $b) (i32.const 0)) (then (return (i32.const -1))))
      (local.set $tot (i32.add (local.get $tot) (i32.add (local.get $b) (i32.const 3))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $l)))
    (local.get $tot))
  (func $di_ir_plan (param $p i32) (param $ti i32) (param $depth i32) (result i32)
    (local $fc i32) (local $f i32) (local $j i32) (local $b i32) (local $tot i32) (local $tp i32)
    (if (i32.gt_u (local.get $depth) (i32.const 8)) (then (return (i32.const -1))))
    (call $di_rd (local.get $ti) (i32.const 2))
    (local.set $f (i32.add (local.get $ti) (call $gl8 (i32.add (local.get $ti) (i32.const 1)))))
    (call $di_rd (i32.add (local.get $f) (i32.const 6)) (i32.const 4))
    (local.set $fc (call $gl32 (i32.add (local.get $f) (i32.const 6))))
    ;; the field loop is a do-while: a record with no managed field (which
    ;; the compiler never asks to initialize) would run it once on garbage
    (if (i32.le_s (local.get $fc) (i32.const 0)) (then (return (i32.const -1))))
    (global.set $di_work (i32.add (global.get $di_work) (local.get $fc)))
    (if (i32.gt_u (global.get $di_work) (global.get $DINIT_MAX)) (then (return (i32.const -1))))
    (local.set $f (i32.add (local.get $f) (i32.const 0xA)))
    (block $d (loop $l
      (br_if $d (i32.ge_u (local.get $j) (local.get $fc)))
      (call $di_rd (local.get $f) (i32.const 8))
      (local.set $tp (call $gl32 (local.get $f)))
      (call $di_rd (local.get $tp) (i32.const 4))
      (local.set $b (call $di_ia_plan (i32.add (local.get $p) (call $gl32 (i32.add (local.get $f) (i32.const 4))))
                                      (call $gl32 (local.get $tp)) (i32.const 1) (i32.add (local.get $depth) (i32.const 1))))
      (if (i32.lt_s (local.get $b) (i32.const 0)) (then (return (i32.const -1))))
      (local.set $tot (i32.add (local.get $tot) (i32.add (local.get $b) (i32.const 3))))
      (local.set $f (i32.add (local.get $f) (i32.const 8)))
      (local.set $j (i32.add (local.get $j) (i32.const 1)))
      (br $l)))
    (local.get $tot))
  ;; the top of a plan: IA ($ir = 0) or IR ($ir = 1). -1 also when a
  ;; typeinfo byte lies in the zeroed extent (the exec pass re-reads them).
  (func $di_plan (param $ir i32) (param $p i32) (param $ti i32) (param $n i32) (result i32)
    (local $b i32) (local $kind i32) (local $el i64) (local $size i64)
    (global.set $di_work (i32.const 0))
    (global.set $di_bad (i32.const 0))
    ;; IA(n = 0) reads nothing
    (if (i32.and (i32.eqz (local.get $ir)) (i32.eqz (local.get $n))) (then (return (i32.const 1))))
    ;; the extent: a record's size, or n elements of the array's kind
    (local.set $kind (call $gl8 (local.get $ti)))
    (local.set $el (i64.extend_i32_u (call $gl32 (i32.add (i32.add (local.get $ti) (call $gl8 (i32.add (local.get $ti) (i32.const 1))))
                                                          (i32.const 2)))))
    (if (local.get $ir)
      (then (local.set $size (local.get $el)))
      (else
        (if (i32.lt_s (local.get $n) (i32.const 0)) (then (return (i32.const -1))))
        (if (i32.eq (local.get $kind) (i32.const 0x0C)) (then (local.set $el (i64.const 16))))
        (if (i32.eqz (i32.or (i32.eq (local.get $kind) (i32.const 0x0D)) (i32.eq (local.get $kind) (i32.const 0x0E))))
          (then (if (i32.ne (local.get $kind) (i32.const 0x0C)) (then (local.set $el (i64.const 4))))))
        (local.set $size (i64.mul (local.get $el) (i64.extend_i32_u (local.get $n))))))
    (if (i64.gt_u (i64.add (i64.extend_i32_u (local.get $p)) (local.get $size)) (i64.const 0xFFFFFFFF))
      (then (return (i32.const -1))))
    (global.set $di_lo (local.get $p))
    (global.set $di_hi (i32.add (local.get $p) (i32.wrap_i64 (local.get $size))))
    (local.set $b (if (result i32) (local.get $ir)
      (then (call $di_ir_plan (local.get $p) (local.get $ti) (i32.const 0)))
      (else (call $di_ia_plan (local.get $p) (local.get $ti) (local.get $n) (i32.const 0)))))
    (if (i32.or (i32.lt_s (local.get $b) (i32.const 0)) (global.get $di_bad)) (then (return (i32.const -1))))
    (local.get $b))
  ;; zero n dwords at p
  (func $di_zero (param $p i32) (param $n i32)
    (block $d (loop $l
      (br_if $d (i32.eqz (local.get $n)))
      (call $gs32 (local.get $p) (i32.const 0))
      (local.set $p (i32.add (local.get $p) (i32.const 4)))
      (local.set $n (i32.sub (local.get $n) (i32.const 1)))
      (br $l))))
  ;; The exec pass, after a plan said yes: the stores, and EAX/ECX/EDX and
  ;; the flags in the order the bodies write them (the last callee's, then
  ;; the caller's own tail).
  (func $di_ia_run (param $p i32) (param $ti i32) (param $n i32)
    (local $kind i32) (local $tl i32) (local $es i32) (local $cnt i32) (local $et i32) (local $i i32) (local $sz i32)
    (if (i32.eqz (local.get $n))
      (then
        ;; test ecx,ecx; jz ret: the registers as the caller set them
        (i32.store (global.get $reg_base) (local.get $p))
        (i32.store offset=4 (global.get $reg_base) (i32.const 0))
        (i32.store offset=8 (global.get $reg_base) (local.get $ti))
        (call $set_flags_logic (i32.const 0))
        (return)))
    (local.set $kind (call $gl8 (local.get $ti)))
    (local.set $tl (i32.add (local.get $ti) (call $gl8 (i32.add (local.get $ti) (i32.const 1)))))
    (if (i32.or (i32.eq (local.get $kind) (i32.const 0x0D)) (i32.eq (local.get $kind) (i32.const 0x0E)))
      (then
        (local.set $es (call $gl32 (i32.add (local.get $tl) (i32.const 2))))
        (if (i32.eq (local.get $kind) (i32.const 0x0D))
          (then (local.set $cnt (call $gl32 (i32.add (local.get $tl) (i32.const 6))))
                (local.set $et (call $gl32 (call $gl32 (i32.add (local.get $tl) (i32.const 0xA)))))))
        (block $d (loop $l
          (br_if $d (i32.ge_u (local.get $i) (local.get $n)))
          (if (i32.eq (local.get $kind) (i32.const 0x0D))
            (then (call $di_ia_run (local.get $p) (local.get $et) (local.get $cnt)))
            (else (call $di_ir_run (local.get $p) (local.get $ti))))
          (local.set $p (i32.add (local.get $p) (local.get $es)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $l)))
        ;; dec edi, 1 -> 0 (CF is the callee's)
        (call $set_flags_dec (i32.const 1) (i32.const 0))
        (return)))
    ;; mov al,[esi] / mov dl,[esi+1] / xor ecx,ecx, then the zeroing loop's
    ;; add ebx,4|16 and dec edi
    (i32.store (global.get $reg_base) (i32.or (i32.and (local.get $p) (i32.const -256)) (local.get $kind)))
    (i32.store offset=4 (global.get $reg_base) (i32.const 0))
    (i32.store offset=8 (global.get $reg_base) (i32.sub (local.get $tl) (local.get $ti)))
    (local.set $sz (select (i32.const 16) (i32.const 4) (i32.eq (local.get $kind) (i32.const 0x0C))))
    (call $di_zero (local.get $p) (i32.mul (local.get $n) (i32.shr_u (local.get $sz) (i32.const 2))))
    (local.set $p (i32.add (local.get $p) (i32.mul (i32.sub (local.get $n) (i32.const 1)) (local.get $sz))))
    (call $set_flags_add (local.get $p) (local.get $sz) (i32.add (local.get $p) (local.get $sz)))
    (call $set_flags_dec (i32.const 1) (i32.const 0)))
  (func $di_ir_run (param $p i32) (param $ti i32)
    (local $fc i32) (local $f i32) (local $j i32) (local $tp i32)
    (local.set $f (i32.add (local.get $ti) (call $gl8 (i32.add (local.get $ti) (i32.const 1)))))
    (local.set $fc (call $gl32 (i32.add (local.get $f) (i32.const 6))))
    (local.set $f (i32.add (local.get $f) (i32.const 0xA)))
    (block $d (loop $l
      (call $di_ia_run (i32.add (local.get $p) (call $gl32 (i32.add (local.get $f) (i32.const 4))))
                       (call $gl32 (call $gl32 (local.get $f))) (i32.const 1))
      (local.set $j (i32.add (local.get $j) (i32.const 1)))
      (br_if $d (i32.ge_u (local.get $j) (local.get $fc)))
      (local.set $f (i32.add (local.get $f) (i32.const 8)))
      (br $l)))
    ;; add esi,8; dec edi 1 -> 0
    (call $set_flags_add (local.get $f) (i32.const 8) (i32.add (local.get $f) (i32.const 8)))
    (call $set_flags_dec (i32.const 1) (i32.const 0)))
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
    (local $i i32) (local $n i32) (local $k i32) (local $v i32) (local $ga i32) (local $pg i32) (local $wd i32)
    (local $acc i32) (local $p i32) (local $c i32)
    (local.set $id (i32.and (local.get $op) (i32.const 0xFF)))
    (local.set $eax (i32.load (global.get $reg_base)))
    (local.set $ecx (i32.load offset=4 (global.get $reg_base)))
    (local.set $edx (i32.load offset=8 (global.get $reg_base)))
    ;; the body's entry address, in the op's one extra word
    (local.set $entry (read-thread-word))
    ;; every exit that is not a RET resumes at $entry (the GM paths set it)
    (block $resume
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
          ;; n records (kind 0x0E) with one AnsiString field each: the
          ;; record loop at +0xA7 calls _FinalizeRecord per element, whose
          ;; native form is id 3's. The decoder checked that pair (bit 10).
          (if (i32.and (i32.ne (i32.and (local.get $op) (i32.const 0x400)) (i32.const 0))
                       (i32.eq (call $gl8 (local.get $edx)) (i32.const 0x0E)))
            (then
              (br_if $fallback (i32.gt_u (i32.sub (local.get $ecx) (i32.const 1))
                                         (i32.sub (global.get $GMF_REC_MAX) (i32.const 1))))
              (local.set $f (call $d_one_str_field (local.get $edx)))
              (br_if $fallback (i32.eqz (local.get $f)))
              (local.set $off (i32.sub (local.get $f) (i32.const 1)))
              (local.set $n (local.get $ecx))
              (local.set $c (call $gl8 (i32.add (local.get $edx) (i32.const 1))))   ;; name length
              (local.set $size (call $gl32 (i32.add (i32.add (local.get $edx) (local.get $c)) (i32.const 2))))
              ;; jz, then the kind chain's five Jccs to the record loop
              (local.set $acc (i32.const 6))
              (local.set $p (local.get $eax))
              (block $stop (loop $el
                (br_if $stop (i32.ge_u (local.get $k) (local.get $n)))
                (local.set $ga (i32.add (local.get $p) (local.get $off)))
                (local.set $s (call $gl32 (local.get $ga)))
                ;; a release that would free, or one the native form does
                ;; not take: the guest's loop runs this element on
                (br_if $stop (call $d_last (local.get $s)))
                (local.set $rs (call $d_rc (local.get $s)))
                (br_if $stop (i32.eqz (call $d_rel_ok (local.get $s) (local.get $rs))))
                ;; CALL _FinalizeRecord, its body (CALL _FinalizeArray, that
                ;; one's jz jz jg CALL _LStrClr, _LStrClr, RET, JMP, RET; the
                ;; field loop's jg), its RET, the record loop's jg = 12 +
                ;; _LStrClr's own; after the last, the JMP to the exit
                (local.set $v (i32.add (i32.const 12) (call $d_clr_pre (local.get $s) (local.get $rs))))
                (br_if $stop (i32.eqz (call $d_can (i32.add (i32.add (local.get $acc) (local.get $v))
                  (i32.eq (local.get $k) (i32.sub (local.get $n) (i32.const 1)))))))
                (br_if $stop (i32.eqz (call $d_claim (local.get $s) (local.get $rs))))
                (i32.store offset=4 (global.get $reg_base) (i32.const 1))
                (call $d_clr_claimed (local.get $ga) (local.get $s) (local.get $rs))
                (local.set $acc (i32.add (local.get $acc) (local.get $v)))
                (local.set $p (i32.add (local.get $p) (local.get $size)))
                (local.set $k (i32.add (local.get $k) (i32.const 1)))
                (br $el)))
              (br_if $fallback (i32.eqz (local.get $k)))
              ;; flags: _FinalizeRecord's ADD ESI,8 (CF), then the DECs
              (local.set $c (i32.add (i32.add (local.get $edx) (local.get $c)) (i32.const 0xA)))
              (call $set_flags_add (local.get $c) (i32.const 8) (i32.add (local.get $c) (i32.const 8)))
              (call $set_flags_dec (i32.add (i32.sub (local.get $n) (local.get $k)) (i32.const 1))
                                   (i32.sub (local.get $n) (local.get $k)))
              (if (i32.eq (local.get $k) (local.get $n))
                (then
                  ;; pops restore EAX = p and EBX/ESI/EDI/EBP; ECX/EDX are
                  ;; the last _LStrClr's
                  (call $d_charge (i32.add (local.get $acc) (i32.const 1)))
                  (i32.store (global.get $reg_base) (local.get $eax))
                  (global.set $gmf_rec (i32.add (global.get $gmf_rec) (i32.const 1)))
                  (call $dfold_tick (local.get $id) (i32.const 0))
                  (dispatch-next)))
              ;; element k goes to the guest: the record loop's state at its
              ;; top (+0xA7) after k elements -- the frame (EAX EBX ESI EDI,
              ;; then EBP), EBX = the next element, ESI = typeinfo, EDI =
              ;; n-k, EBP = name length, EAX = the last element (what
              ;; _FinalizeRecord returns); the jg into it is the resume's
              (call $d_charge (i32.sub (local.get $acc) (i32.const 1)))
              (call $d_push (local.get $eax))
              (call $d_push (i32.load offset=12 (global.get $reg_base)))
              (call $d_push (i32.load offset=24 (global.get $reg_base)))
              (call $d_push (i32.load offset=28 (global.get $reg_base)))
              (call $d_push (i32.load offset=20 (global.get $reg_base)))
              (i32.store offset=12 (global.get $reg_base) (local.get $p))
              (i32.store offset=24 (global.get $reg_base) (local.get $edx))
              (i32.store offset=28 (global.get $reg_base) (i32.sub (local.get $n) (local.get $k)))
              (i32.store offset=20 (global.get $reg_base) (call $gl8 (i32.add (local.get $edx) (i32.const 1))))
              (i32.store (global.get $reg_base) (i32.sub (local.get $p) (local.get $size)))
              (global.set $gmf_rec_part (i32.add (global.get $gmf_rec_part) (i32.const 1)))
              (call $dfold_partial_tick)
              (local.set $entry (i32.add (local.get $entry) (i32.const 0xA7)))
              (br $resume)))
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
              ;; the decoder checked Move's code and registered it (bit 8
              ;; FILD form, bit 9 REP form); Move(src = edx, dst = eax, off)
              (br_if $fallback (i32.eqz (i32.and (local.get $op) (i32.const 0x300))))
              (local.set $f (call $d_move_br
                (select (i32.const 8) (i32.const 9) (i32.and (local.get $op) (i32.const 0x100)))
                (local.get $edx) (local.get $eax) (local.get $off)))
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
      ;; 6 _InitializeRecord(eax = p, edx = typeinfo), 7 _InitializeArray(eax
      ;; = p, edx = typeinfo, ecx = n): plain stores, as the bodies' MOVs
      (if (i32.or (i32.eq (local.get $id) (i32.const 6)) (i32.eq (local.get $id) (i32.const 7)))
        (then
          (local.set $f (call $di_plan (i32.eq (local.get $id) (i32.const 6)) (local.get $eax) (local.get $edx) (local.get $ecx)))
          (br_if $fallback (i32.lt_s (local.get $f) (i32.const 0)))
          (br_if $fallback (i32.eqz (call $d_can (local.get $f))))
          (call $d_charge (local.get $f))
          (if (i32.eq (local.get $id) (i32.const 6))
            (then (call $di_ir_run (local.get $eax) (local.get $edx)))
            (else (call $di_ia_run (local.get $eax) (local.get $edx) (local.get $ecx))))
          (call $dfold_tick (local.get $id) (i32.const 0))
          (dispatch-next)))
      ;; 8, 9 System.Move(eax = src, edx = dst, ecx = n)
      (if (i32.or (i32.eq (local.get $id) (i32.const 8)) (i32.eq (local.get $id) (i32.const 9)))
        (then
          (local.set $f (call $d_move_br (local.get $id) (local.get $eax) (local.get $edx) (local.get $ecx)))
          (br_if $fallback (i32.lt_s (local.get $f) (i32.const 0)))
          (br_if $fallback (i32.eqz (call $d_can (local.get $f))))
          (call $d_charge (local.get $f))
          (call $d_move_run (local.get $id) (local.get $eax) (local.get $edx) (local.get $ecx))
          (call $dfold_tick (local.get $id) (i32.const 0))
          (dispatch-next)))
      ;; 10 the Game Maker variable-list scan, at its loop head:
      ;;   L: lea ebx,[esi+esi*4]; mov edi,[eax+4]; cmp edx,[edi+ebx*8]
      ;;      jnz N; mov ecx,esi; jmp X
      ;;   N: dec esi; cmp esi,-1; jnz L
      ;;   X: (entry+0x15)
      ;; rows of 40 bytes at [eax+4], id at +0, scanned from index ESI down
      ;; for EDX. Every trip is two branches (jnz jnz, or jnz jmp on a hit);
      ;; the last is the exit's own transfer. Pure reads, so it can stop at
      ;; the head after any whole trip -- where the threaded loop stops when
      ;; the budget runs out on its back edge.
      (if (i32.eq (local.get $id) (i32.const 10))
        (then
          (local.set $i (i32.load offset=24 (global.get $reg_base)))
          (br_if $fallback (i32.lt_s (local.get $i) (i32.const 0)))
          ;; the trips the budget pays for: n whole trips need 2n-1 of it
          (local.set $n (global.get $GMF_CHUNK))
          (if (global.get $branch_clock)
            (then
              (local.set $c (select (i32.shr_s (i32.add (global.get $block_budget) (i32.const 1)) (i32.const 1))
                                    (i32.const 0) (i32.gt_s (global.get $block_budget) (i32.const 0))))
              (if (i32.lt_u (local.get $c) (local.get $n)) (then (local.set $n (local.get $c))))))
          (br_if $fallback (i32.eqz (local.get $n)))
          (local.set $d (call $gl32 (i32.add (local.get $eax) (i32.const 4))))
          ;; one translation per guest page: $wd = wasm - guest on page $pg
          (local.set $pg (i32.const 1))
          (block $hit (block $miss (block $head
            (loop $trip
              (br_if $head (i32.ge_u (local.get $k) (local.get $n)))
              (local.set $ga (i32.add (local.get $d) (i32.mul (local.get $i) (i32.const 40))))
              (if (i32.gt_u (i32.and (local.get $ga) (i32.const 0xFFF)) (i32.const 0xFFC))
                (then (local.set $v (call $gl32 (local.get $ga))))
                (else
                  (if (i32.ne (i32.and (local.get $ga) (i32.const 0xFFFFF000)) (local.get $pg))
                    (then
                      (local.set $wd (call $g2w (local.get $ga)))
                      (if (i32.eq (local.get $wd) (global.get $NULL_SENTINEL))
                        (then (local.set $pg (i32.const 1)))
                        (else (local.set $pg (i32.and (local.get $ga) (i32.const 0xFFFFF000)))))
                      (local.set $wd (i32.sub (local.get $wd) (local.get $ga)))))
                  (local.set $v (i32.load (i32.add (local.get $ga) (local.get $wd))))))
              (local.set $k (i32.add (local.get $k) (i32.const 1)))
              (br_if $hit (i32.eq (local.get $v) (local.get $edx)))
              (local.set $i (i32.sub (local.get $i) (i32.const 1)))
              (br_if $miss (i32.eq (local.get $i) (i32.const -1)))
              (br $trip)))
            ;; out of budget (or the chunk) on a back edge: at the head
            (i32.store offset=12 (global.get $reg_base) (i32.mul (i32.add (local.get $i) (i32.const 1)) (i32.const 5)))
            (i32.store offset=24 (global.get $reg_base) (local.get $i))
            (i32.store offset=28 (global.get $reg_base) (local.get $d))
            (call $set_flags_sub (local.get $i) (i32.const -1) (i32.add (local.get $i) (i32.const 1)))
            (global.set $flag_sign_shift (i32.const 31))
            (call $d_charge (i32.sub (i32.shl (local.get $k) (i32.const 1)) (i32.const 1)))
            (global.set $gmf_trips (i32.add (global.get $gmf_trips) (local.get $k)))
            (call $dfold_partial_tick)
            (br $resume))
          ;; not found: ESI = -1, EBX = 0 (the last trip's row 0), ECX kept
          (i32.store offset=12 (global.get $reg_base) (i32.const 0))
          (i32.store offset=24 (global.get $reg_base) (i32.const -1))
          (i32.store offset=28 (global.get $reg_base) (local.get $d))
          (call $set_flags_sub (i32.const -1) (i32.const -1) (i32.const 0))
          (global.set $flag_sign_shift (i32.const 31))
          (call $d_charge (i32.sub (i32.shl (local.get $k) (i32.const 1)) (i32.const 1)))
          (global.set $gmf_trips (i32.add (global.get $gmf_trips) (local.get $k)))
          (call $dfold_tick (local.get $id) (i32.const 0))
          (local.set $entry (i32.add (local.get $entry) (i32.const 0x15)))
          (br $resume))
          ;; found at row i: ECX = ESI = i, EBX = 5i, flags of the equal CMP
          (i32.store offset=4 (global.get $reg_base) (local.get $i))
          (i32.store offset=12 (global.get $reg_base) (i32.mul (local.get $i) (i32.const 5)))
          (i32.store offset=24 (global.get $reg_base) (local.get $i))
          (i32.store offset=28 (global.get $reg_base) (local.get $d))
          (call $set_flags_sub (local.get $edx) (local.get $v) (i32.const 0))
          (global.set $flag_sign_shift (i32.const 31))
          (call $d_charge (i32.sub (i32.shl (local.get $k) (i32.const 1)) (i32.const 1)))
          (global.set $gmf_trips (i32.add (global.get $gmf_trips) (local.get $k)))
          (call $dfold_tick (local.get $id) (i32.const 0))
          (local.set $entry (i32.add (local.get $entry) (i32.const 0x15)))
          (br $resume)))
      ;; 11/12 the 2-D instance-table read (eax = obj, edx = i, ecx = j):
      ;; 0 <= i < length([obj+C]) and 0 <= j < [obj+C][i] ? [[obj+D]+4i]+4j]
      ;; : 0, C/D = 0x84/0x80 (11) or 0x7C/0x78 (12). 13 the 1-D one (eax =
      ;; obj, edx = i): 0 <= i < length([obj+0x7C]) ? [[obj+0x7C]+4i] : 0.
      ;; EBX ESI EDI (EBP) come back popped, ECX/EDX untouched; the flags
      ;; are the last test or cmp's. Branches before the RET: i < 0 1 (jl);
      ;; then jl, CALL, length's jz and RET, jge = 5; then jl 6; then jge 7.
      (if (i32.ge_u (local.get $id) (i32.const 11))
        (then
          (local.set $v (i32.const 0))
          (if (i32.lt_s (local.get $edx) (i32.const 0))
            (then (local.set $c (i32.const 1)) (call $set_flags_logic (local.get $edx)))
            (else
              (local.set $ga (call $gl32 (i32.add (local.get $eax)
                (select (i32.const 0x84) (i32.const 0x7C) (i32.eq (local.get $id) (i32.const 11))))))
              (local.set $n (if (result i32) (local.get $ga)
                (then (call $gl32 (i32.sub (local.get $ga) (i32.const 4)))) (else (i32.const 0))))
              (local.set $c (i32.const 5))
              (call $set_flags_sub (local.get $edx) (local.get $n) (i32.sub (local.get $edx) (local.get $n)))
              (if (i32.lt_s (local.get $edx) (local.get $n))
                (then
                  (if (i32.eq (local.get $id) (i32.const 13))
                    (then (local.set $v (call $gl32 (i32.add (local.get $ga) (i32.shl (local.get $edx) (i32.const 2))))))
                    (else
                      (local.set $c (i32.const 6))
                      (if (i32.lt_s (local.get $ecx) (i32.const 0))
                        (then (call $set_flags_logic (local.get $ecx)))
                        (else
                          (local.set $c (i32.const 7))
                          (local.set $n (call $gl32 (i32.add (local.get $ga) (i32.shl (local.get $edx) (i32.const 2)))))
                          (call $set_flags_sub (local.get $ecx) (local.get $n) (i32.sub (local.get $ecx) (local.get $n)))
                          (if (i32.lt_s (local.get $ecx) (local.get $n))
                            (then
                              (local.set $ga (call $gl32 (i32.add (local.get $eax)
                                (select (i32.const 0x80) (i32.const 0x78) (i32.eq (local.get $id) (i32.const 11))))))
                              (local.set $ga (call $gl32 (i32.add (local.get $ga) (i32.shl (local.get $edx) (i32.const 2)))))
                              (local.set $v (call $gl32 (i32.add (local.get $ga) (i32.shl (local.get $ecx) (i32.const 2)))))))))))))))
          (br_if $fallback (i32.eqz (call $d_can (local.get $c))))
          (call $d_charge (local.get $c))
          (global.set $flag_sign_shift (i32.const 31))
          (i32.store (global.get $reg_base) (local.get $v))
          (call $dfold_tick (local.get $id) (i32.const 0))
          (dispatch-next)))
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
    (if (i32.or (i32.eq (local.get $id) (i32.const 3)) (i32.eq (local.get $id) (i32.const 6)))      ;; xor ecx,ecx
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
    (if (i32.eq (local.get $id) (i32.const 7))      ;; test ecx,ecx
      (then (call $set_flags_logic (local.get $ecx))
            (local.set $entry (i32.add (local.get $entry) (i32.const 2)))))
    (if (i32.eq (local.get $id) (i32.const 8))      ;; cmp eax,edx
      (then (call $set_flags_sub (local.get $eax) (local.get $edx) (i32.sub (local.get $eax) (local.get $edx)))
            (local.set $entry (i32.add (local.get $entry) (i32.const 2)))))
    (if (i32.eq (local.get $id) (i32.const 10))     ;; lea ebx,[esi+esi*4]
      (then (i32.store offset=12 (global.get $reg_base) (i32.mul (i32.load offset=24 (global.get $reg_base)) (i32.const 5)))
            (local.set $entry (i32.add (local.get $entry) (i32.const 3)))))
    (if (i32.ge_u (local.get $id) (i32.const 11))   ;; push ebx
      (then (call $d_push (i32.load offset=12 (global.get $reg_base)))
            (local.set $entry (i32.add (local.get $entry) (i32.const 1)))))
    (if (i32.eq (local.get $id) (i32.const 9))      ;; push esi
      (then (local.set $esp (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
            (call $gs32 (local.get $esp) (i32.load offset=24 (global.get $reg_base)))
            (i32.store offset=16 (global.get $reg_base) (local.get $esp))
            (local.set $entry (i32.add (local.get $entry) (i32.const 1)))))
    )
    (global.set $eip (local.get $entry))
    (return_call $branch_end))

  ;; --no-delphi-fold / ?no-delphi-fold. Decode-time per instance: set it
  ;; before the first decode (lib/worker-imports.js carries it to threads).
  (func (export "set_delphi_fold") (param $on i32)
    (global.set $delphi_fold (i32.ne (local.get $on) (i32.const 0))))
  (func (export "get_delphi_fold") (result i32) (global.get $delphi_fold))
  ;; --gm-fold=MASK: bit 0 var scan, 1 instance reads, 2 record arrays.
  ;; Decode-time per instance, like set_delphi_fold.
  (func (export "set_gm_fold") (param $mask i32)
    (global.set $gm_fold (i32.and (local.get $mask) (i32.const 7))))
  (func (export "get_gm_fold") (result i32) (global.get $gm_fold))
  ;; 0 native, 1 fallback, 2 partial, 3 CAS lost, 4 SMC group drops,
  ;; 11-19 native per helper id, 21-29 fallback per id
  ;; (1 _LStrClr 2 _LStrAsg 3 _FinalizeRecord 4 _FinalizeArray 5 _CopyRecord
  ;;  6 _InitializeRecord 7 _InitializeArray 8 Move FILD form 9 Move REP form)
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
    (if (i32.eq (local.get $k) (i32.const 16)) (then (return (global.get $dfold_n6))))
    (if (i32.eq (local.get $k) (i32.const 17)) (then (return (global.get $dfold_n7))))
    (if (i32.eq (local.get $k) (i32.const 18)) (then (return (global.get $dfold_n8))))
    (if (i32.eq (local.get $k) (i32.const 19)) (then (return (global.get $dfold_n9))))
    (if (i32.eq (local.get $k) (i32.const 26)) (then (return (global.get $dfold_f6))))
    (if (i32.eq (local.get $k) (i32.const 27)) (then (return (global.get $dfold_f7))))
    (if (i32.eq (local.get $k) (i32.const 28)) (then (return (global.get $dfold_f8))))
    (if (i32.eq (local.get $k) (i32.const 29)) (then (return (global.get $dfold_f9))))
    ;; GM fold: 30-33 native per id 10-13, 40-43 fallback, 34 record arrays
    ;; native, 35 record arrays resumed in the guest loop, 36 scan trips
    (if (i32.eq (local.get $k) (i32.const 30)) (then (return (global.get $gmf_n10))))
    (if (i32.eq (local.get $k) (i32.const 31)) (then (return (global.get $gmf_n11))))
    (if (i32.eq (local.get $k) (i32.const 32)) (then (return (global.get $gmf_n12))))
    (if (i32.eq (local.get $k) (i32.const 33)) (then (return (global.get $gmf_n13))))
    (if (i32.eq (local.get $k) (i32.const 34)) (then (return (global.get $gmf_rec))))
    (if (i32.eq (local.get $k) (i32.const 35)) (then (return (global.get $gmf_rec_part))))
    (if (i32.eq (local.get $k) (i32.const 36)) (then (return (global.get $gmf_trips))))
    (if (i32.eq (local.get $k) (i32.const 40)) (then (return (global.get $gmf_f10))))
    (if (i32.eq (local.get $k) (i32.const 41)) (then (return (global.get $gmf_f11))))
    (if (i32.eq (local.get $k) (i32.const 42)) (then (return (global.get $gmf_f12))))
    (if (i32.eq (local.get $k) (i32.const 43)) (then (return (global.get $gmf_f13))))
    (i32.const 0))
