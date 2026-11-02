  ;; OpenGL1.1 stipple state. Native canonical mask rows run
  ;; bottom to top, MSB first within each byte, independent of pixel transfer.
  ;; State extension +1792 factor,+1796 pattern,+1800 mask[128].
  (func $gl_stipple_mask (result i32)
    (i32.add (global.get $gl_sw_st) (i32.const 1800)))

  ;; Current136 bytes, then16 saved136-byte frames; old state ends at1792.
  (func $gl_stipple_frame (param $depth i32) (result i32)
    (i32.add (global.get $gl_sw_st)
      (i32.add (i32.const 1928) (i32.mul (local.get $depth) (i32.const 136)))))

  (func $gl_stipple_defaults
    (i32.store offset=1792 (global.get $gl_sw_st) (i32.const 1))
    (i32.store offset=1796 (global.get $gl_sw_st) (i32.const 65535))
    (memory.fill (call $gl_stipple_mask) (i32.const 255) (i32.const 128)))

  (func $gl_stipple_pop (param $mask i32) (param $saved i32)
    (local $frame i32)
    (local.set $frame (call $gl_stipple_frame (global.get $gl_sw_attrib_depth)))
    (if (i32.and (local.get $mask) (i32.const 4)) (then
      (memory.copy (i32.add (global.get $gl_sw_st) (i32.const 1792)) (local.get $frame) (i32.const 8))
      (call $gl_sw_restore_caps (local.get $saved) (i32.const 0x800000))))
    (if (i32.and (local.get $mask) (i32.const 8)) (then
      (call $gl_sw_restore_caps (local.get $saved) (i32.const 0x1000000))))
    (if (i32.and (local.get $mask) (i32.const 16)) (then
      (memory.copy (call $gl_stipple_mask) (i32.add (local.get $frame) (i32.const 8)) (i32.const 128)))))

  (func $gl_stipple_install (param $mask i32) (param $stack i32)
    (if (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0)) (then
      (call $gl_list_error (call $gl_list_context) (i32.const 0x502)) (return)))
    (memory.copy (call $gl_stipple_mask) (local.get $mask) (i32.const 128))
    (if (i32.eqz (call $gl_wat_init)) (then (unreachable)))
    (drop (call $gl_emit_record (i32.const 175) (local.get $stack) (i32.const 1)
      (call $w2g (local.get $mask)) (i32.const 128) (i32.const 0))))

  ;; pack=0 reads client UNPACK into canonical storage; pack=1 writes canonical
  ;; storage using PACK. Adjacent client bits and row padding remain untouched.
  (func $gl_stipple_pixels (param $ctx i32) (param $client i32) (param $mask i32) (param $pack i32)
    (local $alignment i64) (local $row i64) (local $skiprows i64) (local $skippixels i64)
    (local $address i64) (local $bit i64) (local $lsb i32) (local $x i32) (local $y i32)
    (local $p i32) (local $shift i32) (local $value i32) (local $dst i32) (local $byte i32)
    (if (local.get $pack) (then
      (local.set $p (call $gl_texture_block))
      (local.set $alignment (i64.extend_i32_u (i32.load offset=288 (local.get $p))))
      (local.set $row (i64.extend_i32_u (i32.load offset=276 (local.get $p))))
      (local.set $skiprows (i64.extend_i32_u (i32.load offset=280 (local.get $p))))
      (local.set $skippixels (i64.extend_i32_u (i32.load offset=284 (local.get $p))))
      (local.set $lsb (i32.load offset=272 (local.get $p))))
    (else
      (memory.fill (local.get $mask) (i32.const 0) (i32.const 128))
      (local.set $alignment (i64.extend_i32_u (i32.load offset=80 (local.get $ctx))))
      (local.set $row (i64.extend_i32_u (i32.load offset=84 (local.get $ctx))))
      (local.set $skiprows (i64.extend_i32_u (i32.load offset=88 (local.get $ctx))))
      (local.set $skippixels (i64.extend_i32_u (i32.load offset=92 (local.get $ctx))))
      (local.set $lsb (i32.load offset=96 (local.get $ctx)))))
    (if (i64.eqz (local.get $row)) (then (local.set $row (i64.const 32))))
    (local.set $row (i64.div_u (i64.add (local.get $row) (i64.const 7)) (i64.const 8)))
    (local.set $row (i64.mul (i64.div_u (i64.add (local.get $row)
      (i64.sub (local.get $alignment) (i64.const 1))) (local.get $alignment)) (local.get $alignment)))
    (loop $rows
      (local.set $x (i32.const 0))
      (loop $bits
        (local.set $bit (i64.add (local.get $skippixels) (i64.extend_i32_u (local.get $x))))
        (local.set $address (i64.add (i64.extend_i32_u (local.get $client))
          (i64.add (i64.mul (i64.add (local.get $skiprows) (i64.extend_i32_u (local.get $y))) (local.get $row))
            (i64.shr_u (local.get $bit) (i64.const 3)))))
        (if (i64.gt_u (local.get $address) (i64.const 0xffffffff)) (then (unreachable)))
        (local.set $p (call $g2w (i32.wrap_i64 (local.get $address))))
        (if (i32.eq (local.get $p) (global.get $NULL_SENTINEL)) (then (unreachable)))
        (local.set $shift (i32.and (i32.wrap_i64 (local.get $bit)) (i32.const 7)))
        (if (i32.eqz (local.get $lsb)) (then (local.set $shift (i32.xor (local.get $shift) (i32.const 7)))))
        (local.set $dst (i32.add (local.get $mask)
          (i32.add (i32.shl (local.get $y) (i32.const 2)) (i32.shr_u (local.get $x) (i32.const 3)))))
        (if (local.get $pack) (then
          (local.set $value (i32.and (i32.shr_u (i32.load8_u (local.get $dst))
            (i32.xor (i32.and (local.get $x) (i32.const 7)) (i32.const 7))) (i32.const 1)))
          (i32.store8 (local.get $p) (i32.or
            (i32.and (i32.load8_u (local.get $p)) (i32.xor (i32.shl (i32.const 1) (local.get $shift)) (i32.const -1)))
            (i32.shl (local.get $value) (local.get $shift)))))
        (else
          (local.set $value (i32.and (i32.shr_u (i32.load8_u (local.get $p)) (local.get $shift)) (i32.const 1)))
          (i32.store8 (local.get $dst) (i32.or (i32.load8_u (local.get $dst))
            (i32.shl (local.get $value) (i32.xor (i32.and (local.get $x) (i32.const 7)) (i32.const 7)))))))
        (local.set $x (i32.add (local.get $x) (i32.const 1)))
        (br_if $bits (i32.lt_u (local.get $x) (i32.const 32))))
      (local.set $y (i32.add (local.get $y) (i32.const 1)))
      (br_if $rows (i32.lt_u (local.get $y) (i32.const 32)))))

  ;; Full interception before list capture; the polygon command owns a
  ;; canonical mask, so neither list playback nor transport uses UNPACK again.
  (func $gl_stipple_intercept (param $op i32) (param $stack i32) (result i32)
    (local $ctx i32) (local $record i32) (local $p i32) (local $mask i32) (local $factor i32)
    (global.set $gl_list_result (i32.const 0))
    (if (i32.and (i32.eq (local.get $op) (i32.const 65))
        (i32.or (i32.eq (i32.load offset=4 (local.get $stack)) (i32.const 0xb24))
          (i32.eq (i32.load offset=4 (local.get $stack)) (i32.const 0xb42)))) (then
      (if (global.get $gl_current_context) (then
        (if (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0))
          (then (call $gl_list_error (call $gl_list_context) (i32.const 0x502)))
          (else (global.set $gl_list_result (i32.ne (i32.and (i32.load (global.get $gl_sw_st))
            (call $gl_sw_cap_bit (i32.load offset=4 (local.get $stack)))) (i32.const 0)))))))
      (return (i32.const 1))))
    (if (i32.and (i32.or (i32.eq (local.get $op) (i32.const 8)) (i32.eq (local.get $op) (i32.const 10)))
        (i32.or (i32.eq (i32.load offset=4 (local.get $stack)) (i32.const 0xb24))
          (i32.eq (i32.load offset=4 (local.get $stack)) (i32.const 0xb42)))) (then
      (if (global.get $gl_current_context) (then
        (if (i32.or (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0))
            (i32.load offset=36 (call $gl_list_context))) (then
          (call $gl_list_error (call $gl_list_context) (i32.const 0x502)) (return (i32.const 1))))))))
    (if (i32.gt_u (i32.sub (local.get $op) (i32.const 174)) (i32.const 2)) (then (return (i32.const 0))))
    (if (i32.eqz (global.get $gl_current_context)) (then (return (i32.const 1))))
    (local.set $ctx (call $gl_list_context))
    (if (i32.or (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0)) (i32.and (i32.ne (local.get $op) (i32.const 176)) (i32.ne (i32.load offset=36 (local.get $ctx)) (i32.const 0)))) (then
      (call $gl_list_error (local.get $ctx) (i32.const 0x502)) (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 176)) (then
      (drop (call $gl_wat_stream_flush))
      (call $gl_stipple_pixels (local.get $ctx) (i32.load offset=4 (local.get $stack)) (call $gl_stipple_mask) (i32.const 1))
      (return (i32.const 1))))
    (local.set $record (i32.and (i32.ne (i32.load offset=12 (local.get $ctx)) (i32.const 0))
      (i32.eqz (i32.load offset=28 (local.get $ctx)))))
    (if (local.get $record) (then
      (local.set $p (call $gl_list_record_owned (local.get $ctx) (local.get $op) (local.get $stack)
        (select (i32.const 128) (i32.const 0) (i32.eq (local.get $op) (i32.const 175)))))
      (if (i32.eqz (local.get $p)) (then (return (i32.const 1))))))
    (if (i32.eq (local.get $op) (i32.const 175)) (then
      (local.set $mask (if (result i32) (local.get $record)
        (then (i32.add (local.get $p) (i32.const 88)))
        (else (call $gl_list_alloc (i32.const 128)))))
      (if (i32.eqz (local.get $mask)) (then
        (call $gl_list_error (local.get $ctx) (i32.const 0x505)) (return (i32.const 1))))
      (call $gl_stipple_pixels (local.get $ctx) (i32.load offset=4 (local.get $stack)) (local.get $mask) (i32.const 0))))
    (if (i32.or (i32.eqz (local.get $record)) (i32.eq (i32.load offset=24 (local.get $ctx)) (i32.const 0x1301))) (then
      (if (i32.eq (local.get $op) (i32.const 175))
        (then (call $gl_stipple_install (local.get $mask) (local.get $stack)))
        (else
          (local.set $factor (i32.load offset=4 (local.get $stack)))
          (if (i32.lt_s (local.get $factor) (i32.const 1)) (then (local.set $factor (i32.const 1))))
          (if (i32.gt_s (local.get $factor) (i32.const 256)) (then (local.set $factor (i32.const 256))))
          (i32.store offset=1792 (global.get $gl_sw_st) (local.get $factor))
          (i32.store offset=1796 (global.get $gl_sw_st) (i32.and (i32.load offset=8 (local.get $stack)) (i32.const 65535)))
          (if (i32.eqz (call $gl_wat_init)) (then (unreachable)))
          (drop (call $gl_emit_record (local.get $op) (local.get $stack) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))))))
    (if (i32.and (i32.eq (local.get $op) (i32.const 175)) (i32.eqz (local.get $record)))
      (then (call $heap_free (call $w2g (local.get $mask)))))
    (i32.const 1))
  ;; Scoped span input: 0 disabled,1 polygon,2 line. Never enabled by D3D.
  (global $rast_gl_stipple (mut i32) (i32.const 0))
  (global $gl_line_phase (mut i32) (i32.const 0))
  (global $gl_line_segment_phase (mut i32) (i32.const 0))
  (global $gl_line_major (mut i32) (i32.const 0))
  (global $gl_line_origin (mut i32) (i32.const 0))
  (global $gl_line_sign (mut i32) (i32.const 1))
  (global $gl_line_phase_target (mut i32) (i32.const 0))

  ;; A context-owned cell survives a queued prefix followed by fenced direct
  ;; fallback. The consumer receives its address, never a producer global.
  ;; Keep it after the saved state so context save/restore cannot overwrite a
  ;; pending consumer's counter, even when another context becomes current.
  (func $gl_stipple_phase_cell (result i32)
    (local $ctx i32) (local $p i32)
    (if (global.get $gl_line_phase_target)
      (then (return (global.get $gl_line_phase_target))))
    (local.set $ctx (call $gl_list_context))
    (if (i32.eqz (local.get $ctx)) (then (return (i32.const 0))))
    (local.set $p (i32.load offset=240 (local.get $ctx)))
    (if (i32.eqz (local.get $p)) (then
      (call $gl_sw_context_save)
      (local.set $p (i32.load offset=240 (local.get $ctx)))))
    (i32.add (local.get $p) (i32.const 4156)))

  ;; Projected endpoints, before scissor view creation (an empty view still
  ;; advances a strip). Phase counts columns/rows, never accepted fragments.
  (func $gl_stipple_line_setup
    (local $a i32) (local $b i32) (local $dx i32) (local $dy i32) (local $n i32)
    (local.set $a (call $gl_sw_screen_at (i32.const 0)))
    (local.set $b (call $gl_sw_screen_at (i32.const 1)))
    (local.set $dx (i32.sub (i32.load (local.get $b)) (i32.load (local.get $a))))
    (local.set $dy (i32.sub (i32.load offset=4 (local.get $b)) (i32.load offset=4 (local.get $a))))
    (global.set $gl_line_major (i32.ge_s
      (select (i32.sub (i32.const 0) (local.get $dx)) (local.get $dx) (i32.lt_s (local.get $dx) (i32.const 0)))
      (select (i32.sub (i32.const 0) (local.get $dy)) (local.get $dy) (i32.lt_s (local.get $dy) (i32.const 0)))))
    (local.set $n (select (local.get $dx) (local.get $dy) (global.get $gl_line_major)))
    (global.set $gl_line_sign (select (i32.const -1) (i32.const 1) (i32.lt_s (local.get $n) (i32.const 0))))
    (global.set $gl_line_origin (select (i32.load (local.get $a)) (i32.load offset=4 (local.get $a)) (global.get $gl_line_major)))
    (global.set $gl_line_segment_phase (global.get $gl_line_phase))
    (global.set $gl_line_phase (i32.rem_u (i32.add (global.get $gl_line_phase)
      (i32.mul (local.get $n) (global.get $gl_line_sign)))
      (i32.shl (i32.load offset=1792 (global.get $gl_sw_st)) (i32.const 4)))))

  (func $gl_stipple_pass (param $x i32) (param $y i32) (result i32)
    (local $bit i32) (local $p i32)
    (if (i32.eq (global.get $rast_gl_stipple) (i32.const 1)) (then
      (local.set $x (i32.add (local.get $x) (global.get $gl_sw_r_dx)))
      (local.set $y (i32.add (local.get $y) (global.get $gl_sw_r_dy)))
      (if (global.get $gl_sw_flip_y) (then
        (local.set $y (i32.sub (i32.sub (load.field DxObject height (global.get $gl_sw_rt)) (i32.const 1)) (local.get $y)))))
      (local.set $x (i32.and (local.get $x) (i32.const 31)))
      (local.set $p (i32.add (call $gl_stipple_mask)
        (i32.add (i32.shl (i32.and (local.get $y) (i32.const 31)) (i32.const 2))
          (i32.shr_u (local.get $x) (i32.const 3)))))
      (return (i32.and (i32.shr_u (i32.load8_u (local.get $p))
        (i32.xor (i32.and (local.get $x) (i32.const 7)) (i32.const 7))) (i32.const 1)))))
    (local.set $bit (i32.add (global.get $gl_line_segment_phase)
      (i32.mul (i32.sub (select
        (i32.add (local.get $x) (global.get $gl_sw_r_dx))
        (i32.add (local.get $y) (global.get $gl_sw_r_dy)) (global.get $gl_line_major))
        (global.get $gl_line_origin)) (global.get $gl_line_sign))))
    (local.set $bit (i32.and (i32.div_u (local.get $bit)
      (i32.load offset=1792 (global.get $gl_sw_st))) (i32.const 15)))
    (i32.and (i32.shr_u (i32.load offset=1796 (global.get $gl_sw_st)) (local.get $bit)) (i32.const 1)))
