  ;; ============================================================
  ;; STRING OPERATIONS (movsb/movsd/stosb/stosd/cmps/scas + REP)
  ;; ============================================================

  ;; memory.copy/fill operate on linear WASM offsets. Sparse guest mappings can
  ;; be adjacent in guest space but backed by non-adjacent WASM blocks when
  ;; commits are interleaved. The canonical span validator checks every sparse
  ;; page; matching endpoints cannot prove that the middle is linear.
  (func $string_guest_range_contiguous (param $guest i32) (param $size i32) (result i32)
    (if (result i32) (i32.eqz (local.get $size))
      (then (i32.const 1))
      (else
        (i32.ne
          (call $g2w_affine_span (local.get $guest) (local.get $size))
          (global.get $NULL_SENTINEL)))))

  ;; Bulk CRT/kernel copies take guest pointers, not already-translated WASM
  ;; offsets.  Adjacent sparse guest pages do not necessarily have adjacent
  ;; backing, so validate the complete spans before using memory.copy/fill.
  ;; The byte fallback also preserves memmove overlap semantics.
  (func $guest_memmove (param $dst i32) (param $src i32) (param $size i32)
    (local $i i32) (local $chunk i32) (local $remaining i32)
    (if (i32.eqz (local.get $size)) (then (return)))
    ;; One destination notification covers both linear and chunked copies.
    (call $invalidate_code_write (local.get $dst) (local.get $size))
    (if (i32.and
          (call $string_guest_range_contiguous (local.get $dst) (local.get $size))
          (call $string_guest_range_contiguous (local.get $src) (local.get $size)))
      (then
        (memory.copy
          (call $g2w (local.get $dst))
          (call $g2w (local.get $src))
          (local.get $size))
        (return)))
    (if (i32.and
          (i32.gt_u (local.get $dst) (local.get $src))
          (i32.lt_u (i32.sub (local.get $dst) (local.get $src)) (local.get $size)))
      (then
        (local.set $remaining (local.get $size))
        (block $done (loop $backward
          (br_if $done (i32.eqz (local.get $remaining)))
          ;; End each chunk at the current copy end, stopping at either
          ;; source or destination guest-page boundary.
          (local.set $chunk (local.get $remaining))
          (local.set $i
            (i32.add
              (i32.and
                (i32.add (local.get $src) (i32.sub (local.get $remaining) (i32.const 1)))
                (i32.const 0xFFF))
              (i32.const 1)))
          (if (i32.lt_u (local.get $i) (local.get $chunk))
            (then (local.set $chunk (local.get $i))))
          (local.set $i
            (i32.add
              (i32.and
                (i32.add (local.get $dst) (i32.sub (local.get $remaining) (i32.const 1)))
                (i32.const 0xFFF))
              (i32.const 1)))
          (if (i32.lt_u (local.get $i) (local.get $chunk))
            (then (local.set $chunk (local.get $i))))
          (local.set $remaining (i32.sub (local.get $remaining) (local.get $chunk)))
          (memory.copy
            (call $g2w (i32.add (local.get $dst) (local.get $remaining)))
            (call $g2w (i32.add (local.get $src) (local.get $remaining)))
            (local.get $chunk))
          (br $backward))))
      (else
        (local.set $i (i32.const 0))
        (block $done (loop $forward
          (br_if $done (i32.ge_u (local.get $i) (local.get $size)))
          ;; Each chunk stays inside one source and one destination guest
          ;; page, where a single translation is guaranteed contiguous.
          (local.set $chunk (i32.sub (local.get $size) (local.get $i)))
          (local.set $remaining
            (i32.sub (i32.const 0x1000)
              (i32.and (i32.add (local.get $src) (local.get $i)) (i32.const 0xFFF))))
          (if (i32.lt_u (local.get $remaining) (local.get $chunk))
            (then (local.set $chunk (local.get $remaining))))
          (local.set $remaining
            (i32.sub (i32.const 0x1000)
              (i32.and (i32.add (local.get $dst) (local.get $i)) (i32.const 0xFFF))))
          (if (i32.lt_u (local.get $remaining) (local.get $chunk))
            (then (local.set $chunk (local.get $remaining))))
          (memory.copy
            (call $g2w (i32.add (local.get $dst) (local.get $i)))
            (call $g2w (i32.add (local.get $src) (local.get $i)))
            (local.get $chunk))
          (local.set $i (i32.add (local.get $i) (local.get $chunk)))
          (br $forward))))))

  (func $guest_memset (param $dst i32) (param $value i32) (param $size i32)
    (local $i i32) (local $chunk i32)
    (if (i32.eqz (local.get $size)) (then (return)))
    (call $invalidate_code_write (local.get $dst) (local.get $size))
    (if (call $string_guest_range_contiguous (local.get $dst) (local.get $size))
      (then
        (memory.fill
          (call $g2w (local.get $dst))
          (local.get $value)
          (local.get $size)))
      (else
        (local.set $i (i32.const 0))
        (block $done (loop $fill
          (br_if $done (i32.ge_u (local.get $i) (local.get $size)))
          (local.set $chunk
            (i32.sub (i32.const 0x1000)
              (i32.and (i32.add (local.get $dst) (local.get $i)) (i32.const 0xFFF))))
          (if (i32.lt_u (i32.sub (local.get $size) (local.get $i)) (local.get $chunk))
            (then (local.set $chunk (i32.sub (local.get $size) (local.get $i)))))
          (memory.fill
            (call $g2w (i32.add (local.get $dst) (local.get $i)))
            (local.get $value)
            (local.get $chunk))
          (local.set $i (i32.add (local.get $i) (local.get $chunk)))
          (br $fill))))))

  ;; --- String ops ---
  (func $th_movsb (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (call $gs8 (i32.load offset=28 (global.get $reg_base)) (call $gl8 (i32.load offset=24 (global.get $reg_base))))
    (if (global.get $df)
      (then (i32.store offset=24 (global.get $reg_base) (i32.sub (i32.load offset=24 (global.get $reg_base)) (i32.const 1)))
            (i32.store offset=28 (global.get $reg_base) (i32.sub (i32.load offset=28 (global.get $reg_base)) (i32.const 1))))
      (else (i32.store offset=24 (global.get $reg_base) (i32.add (i32.load offset=24 (global.get $reg_base)) (i32.const 1)))
            (i32.store offset=28 (global.get $reg_base) (i32.add (i32.load offset=28 (global.get $reg_base)) (i32.const 1)))))
    (dispatch-next))
  (func $th_movsd (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (call $gs32 (i32.load offset=28 (global.get $reg_base)) (call $gl32 (i32.load offset=24 (global.get $reg_base))))
    (if (global.get $df)
      (then (i32.store offset=24 (global.get $reg_base) (i32.sub (i32.load offset=24 (global.get $reg_base)) (i32.const 4)))
            (i32.store offset=28 (global.get $reg_base) (i32.sub (i32.load offset=28 (global.get $reg_base)) (i32.const 4))))
      (else (i32.store offset=24 (global.get $reg_base) (i32.add (i32.load offset=24 (global.get $reg_base)) (i32.const 4)))
            (i32.store offset=28 (global.get $reg_base) (i32.add (i32.load offset=28 (global.get $reg_base)) (i32.const 4)))))
    (dispatch-next))
  (func $th_stosb (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (call $gs8 (i32.load offset=28 (global.get $reg_base)) (i32.and (i32.load offset=0 (global.get $reg_base)) (i32.const 0xFF)))
    (if (global.get $df)
      (then (i32.store offset=28 (global.get $reg_base) (i32.sub (i32.load offset=28 (global.get $reg_base)) (i32.const 1))))
      (else (i32.store offset=28 (global.get $reg_base) (i32.add (i32.load offset=28 (global.get $reg_base)) (i32.const 1)))))
    (dispatch-next))
  (func $th_stosd (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (call $gs32 (i32.load offset=28 (global.get $reg_base)) (i32.load offset=0 (global.get $reg_base)))
    (if (global.get $df)
      (then (i32.store offset=28 (global.get $reg_base) (i32.sub (i32.load offset=28 (global.get $reg_base)) (i32.const 4))))
      (else (i32.store offset=28 (global.get $reg_base) (i32.add (i32.load offset=28 (global.get $reg_base)) (i32.const 4)))))
    (dispatch-next))
  (func $th_lodsb (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (i32.store offset=0 (global.get $reg_base) (i32.or (i32.and (i32.load offset=0 (global.get $reg_base)) (i32.const 0xFFFFFF00)) (call $gl8 (i32.load offset=24 (global.get $reg_base)))))
    (if (global.get $df)
      (then (i32.store offset=24 (global.get $reg_base) (i32.sub (i32.load offset=24 (global.get $reg_base)) (i32.const 1))))
      (else (i32.store offset=24 (global.get $reg_base) (i32.add (i32.load offset=24 (global.get $reg_base)) (i32.const 1)))))
    (dispatch-next))
  (func $th_lodsd (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (i32.store offset=0 (global.get $reg_base) (call $gl32 (i32.load offset=24 (global.get $reg_base))))
    (if (global.get $df)
      (then (i32.store offset=24 (global.get $reg_base) (i32.sub (i32.load offset=24 (global.get $reg_base)) (i32.const 4))))
      (else (i32.store offset=24 (global.get $reg_base) (i32.add (i32.load offset=24 (global.get $reg_base)) (i32.const 4)))))
    (dispatch-next))
  ;; REP MOVS / REP STOS
  ;;
  ;; The memory half of every REP MOVS{B,W,D} and REP STOS{B,W,D} is one pair
  ;; of functions, $rep_movs_mem and $rep_stos_mem: n elements of w bytes at
  ;; EDI (from ESI), in x86 element order, direction $df. Everything that runs
  ;; a rep string op calls them -- the threaded handlers below, TREE_FOLD's
  ;; TU_REP_STR through the `_do` bodies (07c), and the micro-op tier's COPY
  ;; and FILL ops (07d 82/83) on their slow path -- so the DF direction, the
  ;; overlap and page-contiguity tests, the $invalidate_code_write extent and
  ;; the per-element $gl/$gs fallback exist once, and a rep run in either tier
  ;; is the same code over the same bytes.
  ;;
  ;; They take the register VALUES and leave the registers alone. The `_do`
  ;; bodies read and write the register globals around them, which is why
  ;; TREE_FOLD publishes its locals before the call and reloads them after:
  ;; that also makes a fault mid-copy leave ECX/ESI/EDI exactly where the
  ;; unfolded path would have left them, because it is the same stores to the
  ;; same globals.
  ;;
  ;; w is 1, 2, 4 or 8 (8 only from the micro-op tier's MMX idioms). n is the
  ;; element count and must be nonzero; n*w wraps exactly as the old
  ;; per-width bodies' `n << 2` did.
  (func $rep_movs_mem (param $edi i32) (param $esi i32) (param $n i32) (param $w i32)
    (local $bytes i32) (local $dst i32) (local $src i32) (local $step i32)
    (local $i i32) (local $d i32) (local $s i32)
    (local.set $bytes (i32.mul (local.get $n) (local.get $w)))
    (local.set $dst (local.get $edi))
    (local.set $src (local.get $esi))
    (local.set $step (local.get $w))
    (if (global.get $df)
      (then
        ;; Backward: EDI/ESI name the highest element, so the extent starts
        ;; n-1 elements below them.
        (local.set $dst (i32.sub (local.get $edi) (i32.sub (local.get $bytes) (local.get $w))))
        (local.set $src (i32.sub (local.get $esi) (i32.sub (local.get $bytes) (local.get $w))))
        (local.set $step (i32.sub (i32.const 0) (local.get $w)))))
    ;; One call over the whole destination extent, not two endpoint calls.
    ;; Endpoints were enough while invalidation was per-page and a copy of
    ;; this size spanned at most two pages; per-offset retirement
    ;; (docs/page-compile-design.md section 5) retires exactly the bytes it
    ;; is handed, so the middle has to be named too.
    (call $invalidate_code_write (local.get $dst) (local.get $bytes))
    ;; memory.copy is memmove. x86 copies element by element in the direction
    ;; DF names, so a destination that starts inside the source on the side
    ;; the copy moves toward reads bytes the same instruction already wrote
    ;; (the LZ pattern-replication idiom): those, and sparse spans whose
    ;; backing is not linear, take the element loop.
    (if (i32.or
          (if (result i32) (global.get $df)
            (then (i32.and
                    (i32.lt_u (local.get $dst) (local.get $src))
                    (i32.lt_u (local.get $src) (i32.add (local.get $dst) (local.get $bytes)))))
            (else (i32.and
                    (i32.lt_u (local.get $src) (local.get $dst))
                    (i32.lt_u (local.get $dst) (i32.add (local.get $src) (local.get $bytes))))))
          (i32.or
            (i32.eqz (call $string_guest_range_contiguous (local.get $dst) (local.get $bytes)))
            (i32.eqz (call $string_guest_range_contiguous (local.get $src) (local.get $bytes)))))
      (then
        (local.set $d (local.get $edi))
        (local.set $s (local.get $esi))
        (block $done (loop $copy
          (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
          (if (i32.eq (local.get $w) (i32.const 4))
            (then (call $gs32 (local.get $d) (call $gl32 (local.get $s))))
            (else (if (i32.eq (local.get $w) (i32.const 1))
              (then (call $gs8 (local.get $d) (call $gl8 (local.get $s))))
              (else (if (i32.eq (local.get $w) (i32.const 2))
                (then (call $gs16 (local.get $d) (call $gl16 (local.get $s))))
                ;; 8: the whole element is read before any of it is written
                (else (call $gs64 (local.get $d)
                        (i64.or (i64.extend_i32_u (call $gl32 (local.get $s)))
                                (i64.shl (i64.extend_i32_u (call $gl32 (i32.add (local.get $s) (i32.const 4))))
                                         (i64.const 32))))))))))
          (local.set $d (i32.add (local.get $d) (local.get $step)))
          (local.set $s (i32.add (local.get $s) (local.get $step)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $copy))))
      (else
        (memory.copy
          (call $g2w (local.get $dst))
          (call $g2w (local.get $src))
          (local.get $bytes)))))

  ;; n elements of w bytes of $v (its low w bytes) at EDI, direction $df.
  ;; Every element is the same, so the result does not depend on the order
  ;; they are written in: a linear span is one memory.fill when the value is
  ;; one repeated byte, else one element and then doubling copies of what is
  ;; already written. Non-linear spans keep the element loop.
  (func $rep_stos_mem (param $edi i32) (param $n i32) (param $w i32) (param $v i64)
    (local $bytes i32) (local $dst i32) (local $step i32) (local $i i32) (local $d i32)
    (local $b i32) (local $wa i32) (local $k i32) (local $c i32) (local $mask i64)
    (local.set $bytes (i32.mul (local.get $n) (local.get $w)))
    (local.set $dst (local.get $edi))
    (local.set $step (local.get $w))
    (if (global.get $df)
      (then
        (local.set $dst (i32.sub (local.get $edi) (i32.sub (local.get $bytes) (local.get $w))))
        (local.set $step (i32.sub (i32.const 0) (local.get $w)))))
    (local.set $mask
      (select (i64.const -1)
              (i64.sub (i64.shl (i64.const 1) (i64.extend_i32_u (i32.shl (local.get $w) (i32.const 3))))
                       (i64.const 1))
              (i32.eq (local.get $w) (i32.const 8))))
    (local.set $v (i64.and (local.get $v) (local.get $mask)))
    (local.set $b (i32.and (i32.wrap_i64 (local.get $v)) (i32.const 0xFF)))
    (call $invalidate_code_write (local.get $dst) (local.get $bytes))
    (if (call $string_guest_range_contiguous (local.get $dst) (local.get $bytes))
      (then
        (local.set $wa (call $g2w (local.get $dst)))
        (if (i64.eq (local.get $v)
                    (i64.and (i64.mul (i64.extend_i32_u (local.get $b)) (i64.const 0x0101010101010101))
                             (local.get $mask)))
          (then (memory.fill (local.get $wa) (local.get $b) (local.get $bytes)))
          (else
            (if (i32.eq (local.get $w) (i32.const 8))
              (then (i64.store (local.get $wa) (local.get $v)))
              (else (if (i32.eq (local.get $w) (i32.const 4))
                (then (i32.store (local.get $wa) (i32.wrap_i64 (local.get $v))))
                (else (i32.store16 (local.get $wa) (i32.wrap_i64 (local.get $v)))))))
            (local.set $k (local.get $w))
            (block $done (loop $dbl
              (br_if $done (i32.ge_u (local.get $k) (local.get $bytes)))
              (local.set $c (select (local.get $k) (i32.sub (local.get $bytes) (local.get $k))
                                    (i32.le_u (local.get $k) (i32.sub (local.get $bytes) (local.get $k)))))
              (memory.copy (i32.add (local.get $wa) (local.get $k)) (local.get $wa) (local.get $c))
              (local.set $k (i32.add (local.get $k) (local.get $c)))
              (br $dbl))))))
      (else
        (local.set $d (local.get $edi))
        (block $done (loop $fill
          (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
          (if (i32.eq (local.get $w) (i32.const 4))
            (then (call $gs32 (local.get $d) (i32.wrap_i64 (local.get $v))))
            (else (if (i32.eq (local.get $w) (i32.const 1))
              (then (call $gs8 (local.get $d) (local.get $b)))
              (else (if (i32.eq (local.get $w) (i32.const 2))
                (then (call $gs16 (local.get $d) (i32.wrap_i64 (local.get $v))))
                (else (call $gs64 (local.get $d) (local.get $v))))))))
          (local.set $d (i32.add (local.get $d) (local.get $step)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $fill))))))

  ;; The register half, on the globals: ESI/EDI move by the whole extent in
  ;; the DF direction and ECX ends at zero; a zero count touches nothing.
  (func $rep_movs_do (param $w i32)
    (local $n i32) (local $bytes i32)
    (local.set $n (i32.load offset=4 (global.get $reg_base)))
    (if (local.get $n) (then
      (call $rep_movs_mem (i32.load offset=28 (global.get $reg_base))
                          (i32.load offset=24 (global.get $reg_base))
                          (local.get $n) (local.get $w))
      (local.set $bytes (i32.mul (local.get $n) (local.get $w)))
      (if (global.get $df)
        (then (local.set $bytes (i32.sub (i32.const 0) (local.get $bytes)))))
      (i32.store offset=24 (global.get $reg_base) (i32.add (i32.load offset=24 (global.get $reg_base)) (local.get $bytes)))
      (i32.store offset=28 (global.get $reg_base) (i32.add (i32.load offset=28 (global.get $reg_base)) (local.get $bytes)))
      (i32.store offset=4 (global.get $reg_base) (i32.const 0)))))
  (func $rep_stos_do (param $w i32)
    (local $n i32) (local $bytes i32)
    (local.set $n (i32.load offset=4 (global.get $reg_base)))
    (if (local.get $n) (then
      (call $rep_stos_mem (i32.load offset=28 (global.get $reg_base))
                          (local.get $n) (local.get $w)
                          (i64.extend_i32_u (i32.load offset=0 (global.get $reg_base))))
      (local.set $bytes (i32.mul (local.get $n) (local.get $w)))
      (if (global.get $df)
        (then (local.set $bytes (i32.sub (i32.const 0) (local.get $bytes)))))
      (i32.store offset=28 (global.get $reg_base) (i32.add (i32.load offset=28 (global.get $reg_base)) (local.get $bytes)))
      (i32.store offset=4 (global.get $reg_base) (i32.const 0)))))
  (func $rep_movsb_do (call $rep_movs_do (i32.const 1)))
  (func $rep_movsd_do (call $rep_movs_do (i32.const 4)))
  (func $rep_stosb_do (call $rep_stos_do (i32.const 1)))
  (func $rep_stosd_do (call $rep_stos_do (i32.const 4)))
  (func $th_rep_movsb (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (call $rep_movsb_do)
    (dispatch-next))
  (func $th_rep_movsd (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (call $rep_movsd_do)
    (dispatch-next))
  (func $th_rep_stosb (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (call $rep_stosb_do)
    (dispatch-next))
  (func $th_rep_stosd (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (call $rep_stosd_do)
    (dispatch-next))
  (func $th_cmpsb (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $a i32) (local $b i32)
    (local.set $a (call $gl8 (i32.load offset=24 (global.get $reg_base)))) (local.set $b (call $gl8 (i32.load offset=28 (global.get $reg_base))))
    (call $set_flags_sub (local.get $a) (local.get $b) (i32.sub (local.get $a) (local.get $b)))
    (if (global.get $df)
      (then (i32.store offset=24 (global.get $reg_base) (i32.sub (i32.load offset=24 (global.get $reg_base)) (i32.const 1)))
            (i32.store offset=28 (global.get $reg_base) (i32.sub (i32.load offset=28 (global.get $reg_base)) (i32.const 1))))
      (else (i32.store offset=24 (global.get $reg_base) (i32.add (i32.load offset=24 (global.get $reg_base)) (i32.const 1)))
            (i32.store offset=28 (global.get $reg_base) (i32.add (i32.load offset=28 (global.get $reg_base)) (i32.const 1)))))
    (dispatch-next))
  (func $th_scasb (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $a i32) (local $b i32)
    (local.set $a (i32.and (i32.load offset=0 (global.get $reg_base)) (i32.const 0xFF)))
    (local.set $b (call $gl8 (i32.load offset=28 (global.get $reg_base))))
    (call $set_flags_sub (local.get $a) (local.get $b) (i32.sub (local.get $a) (local.get $b)))
    (if (global.get $df)
      (then (i32.store offset=28 (global.get $reg_base) (i32.sub (i32.load offset=28 (global.get $reg_base)) (i32.const 1))))
      (else (i32.store offset=28 (global.get $reg_base) (i32.add (i32.load offset=28 (global.get $reg_base)) (i32.const 1)))))
    (dispatch-next))
  (func $th_rep_cmpsb (param $op i32)
     (local $nx_fn i32) (local $nx_op i32);; operand: 0=REPE, 1=REPNE
    (local $a i32) (local $b i32)
    (block $d (loop $l
      (br_if $d (i32.eqz (i32.load offset=4 (global.get $reg_base))))
      (local.set $a (call $gl8 (i32.load offset=24 (global.get $reg_base)))) (local.set $b (call $gl8 (i32.load offset=28 (global.get $reg_base))))
      (call $set_flags_sub (local.get $a) (local.get $b) (i32.sub (local.get $a) (local.get $b)))
      (if (global.get $df)
        (then (i32.store offset=24 (global.get $reg_base) (i32.sub (i32.load offset=24 (global.get $reg_base)) (i32.const 1)))
              (i32.store offset=28 (global.get $reg_base) (i32.sub (i32.load offset=28 (global.get $reg_base)) (i32.const 1))))
        (else (i32.store offset=24 (global.get $reg_base) (i32.add (i32.load offset=24 (global.get $reg_base)) (i32.const 1)))
              (i32.store offset=28 (global.get $reg_base) (i32.add (i32.load offset=28 (global.get $reg_base)) (i32.const 1)))))
      (i32.store offset=4 (global.get $reg_base) (i32.sub (i32.load offset=4 (global.get $reg_base)) (i32.const 1)))
      (if (i32.eqz (local.get $op)) ;; REPE: stop if not equal
        (then (br_if $d (i32.ne (local.get $a) (local.get $b))))
        (else (br_if $d (i32.eq (local.get $a) (local.get $b))))) ;; REPNE: stop if equal
      (br $l))) (dispatch-next))
  (func $th_rep_scasb (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $a i32) (local $b i32)
    (local.set $a (i32.and (i32.load offset=0 (global.get $reg_base)) (i32.const 0xFF)))
    (block $d (loop $l
      (br_if $d (i32.eqz (i32.load offset=4 (global.get $reg_base))))
      (local.set $b (call $gl8 (i32.load offset=28 (global.get $reg_base))))
      (call $set_flags_sub (local.get $a) (local.get $b) (i32.sub (local.get $a) (local.get $b)))
      (if (global.get $df)
        (then (i32.store offset=28 (global.get $reg_base) (i32.sub (i32.load offset=28 (global.get $reg_base)) (i32.const 1))))
        (else (i32.store offset=28 (global.get $reg_base) (i32.add (i32.load offset=28 (global.get $reg_base)) (i32.const 1)))))
      (i32.store offset=4 (global.get $reg_base) (i32.sub (i32.load offset=4 (global.get $reg_base)) (i32.const 1)))
      (if (i32.eqz (local.get $op))
        (then (br_if $d (i32.ne (local.get $a) (local.get $b))))
        (else (br_if $d (i32.eq (local.get $a) (local.get $b)))))
      (br $l))) (dispatch-next))

  ;; --- CMPSD/SCASD (dword variants) ---
  (func $th_cmpsd (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $a i32) (local $b i32)
    (local.set $a (call $gl32 (i32.load offset=24 (global.get $reg_base)))) (local.set $b (call $gl32 (i32.load offset=28 (global.get $reg_base))))
    (call $set_flags_sub (local.get $a) (local.get $b) (i32.sub (local.get $a) (local.get $b)))
    (if (global.get $df)
      (then (i32.store offset=24 (global.get $reg_base) (i32.sub (i32.load offset=24 (global.get $reg_base)) (i32.const 4)))
            (i32.store offset=28 (global.get $reg_base) (i32.sub (i32.load offset=28 (global.get $reg_base)) (i32.const 4))))
      (else (i32.store offset=24 (global.get $reg_base) (i32.add (i32.load offset=24 (global.get $reg_base)) (i32.const 4)))
            (i32.store offset=28 (global.get $reg_base) (i32.add (i32.load offset=28 (global.get $reg_base)) (i32.const 4)))))
    (dispatch-next))
  (func $th_scasd (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $a i32) (local $b i32)
    (local.set $a (i32.load offset=0 (global.get $reg_base)))
    (local.set $b (call $gl32 (i32.load offset=28 (global.get $reg_base))))
    (call $set_flags_sub (local.get $a) (local.get $b) (i32.sub (local.get $a) (local.get $b)))
    (if (global.get $df)
      (then (i32.store offset=28 (global.get $reg_base) (i32.sub (i32.load offset=28 (global.get $reg_base)) (i32.const 4))))
      (else (i32.store offset=28 (global.get $reg_base) (i32.add (i32.load offset=28 (global.get $reg_base)) (i32.const 4)))))
    (dispatch-next))
  (func $th_rep_cmpsd (param $op i32)
     (local $nx_fn i32) (local $nx_op i32);; operand: 0=REPE, 1=REPNE
    (local $a i32) (local $b i32)
    (block $d (loop $l
      (br_if $d (i32.eqz (i32.load offset=4 (global.get $reg_base))))
      (local.set $a (call $gl32 (i32.load offset=24 (global.get $reg_base)))) (local.set $b (call $gl32 (i32.load offset=28 (global.get $reg_base))))
      (call $set_flags_sub (local.get $a) (local.get $b) (i32.sub (local.get $a) (local.get $b)))
      (if (global.get $df)
        (then (i32.store offset=24 (global.get $reg_base) (i32.sub (i32.load offset=24 (global.get $reg_base)) (i32.const 4)))
              (i32.store offset=28 (global.get $reg_base) (i32.sub (i32.load offset=28 (global.get $reg_base)) (i32.const 4))))
        (else (i32.store offset=24 (global.get $reg_base) (i32.add (i32.load offset=24 (global.get $reg_base)) (i32.const 4)))
              (i32.store offset=28 (global.get $reg_base) (i32.add (i32.load offset=28 (global.get $reg_base)) (i32.const 4)))))
      (i32.store offset=4 (global.get $reg_base) (i32.sub (i32.load offset=4 (global.get $reg_base)) (i32.const 1)))
      (if (i32.eqz (local.get $op))
        (then (br_if $d (i32.ne (local.get $a) (local.get $b))))
        (else (br_if $d (i32.eq (local.get $a) (local.get $b)))))
      (br $l))) (dispatch-next))
  (func $th_rep_scasd (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $a i32) (local $b i32)
    (local.set $a (i32.load offset=0 (global.get $reg_base)))
    (block $d (loop $l
      (br_if $d (i32.eqz (i32.load offset=4 (global.get $reg_base))))
      (local.set $b (call $gl32 (i32.load offset=28 (global.get $reg_base))))
      (call $set_flags_sub (local.get $a) (local.get $b) (i32.sub (local.get $a) (local.get $b)))
      (if (global.get $df)
        (then (i32.store offset=28 (global.get $reg_base) (i32.sub (i32.load offset=28 (global.get $reg_base)) (i32.const 4))))
        (else (i32.store offset=28 (global.get $reg_base) (i32.add (i32.load offset=28 (global.get $reg_base)) (i32.const 4)))))
      (i32.store offset=4 (global.get $reg_base) (i32.sub (i32.load offset=4 (global.get $reg_base)) (i32.const 1)))
      (if (i32.eqz (local.get $op))
        (then (br_if $d (i32.ne (local.get $a) (local.get $b))))
        (else (br_if $d (i32.eq (local.get $a) (local.get $b)))))
      (br $l))) (dispatch-next))
