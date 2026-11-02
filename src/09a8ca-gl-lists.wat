  ;; Display-list storage is native: compilation must precede ALL WAT state
  ;; observers, and replay must enter that same encoder, including software GL.
  ;; A context owns {next,key,blocks,compiling-slot,head,tail,mode,depth,error,begin}.
  ;; Blocks hold {next,first,count,slots[count]}; slot 0=deleted, 1=reserved,
  ;; 2=defined empty, otherwise the first command. Commands own stack bytes.
  (global $gl_list_contexts (mut i32) (i32.const 0))
  (global $gl_list_result (mut i32) (i32.const 0))

  (func $gl_list_alloc (param $bytes i32) (result i32)
    (local $p i32)
    (local.set $p (call $gl_alloc_affine (local.get $bytes)))
    (if (i32.eqz (local.get $p)) (then (return (i32.const 0))))
    (local.set $p (call $g2w (local.get $p)))
    (memory.fill (local.get $p) (i32.const 0) (local.get $bytes))
    (local.get $p))

  (func $gl_list_context (result i32)
    (local $p i32)
    (if (i32.eqz (global.get $gl_current_context)) (then (return (i32.const 0))))
    (local.set $p (global.get $gl_list_contexts))
    (block $done (loop $scan
      (br_if $done (i32.eqz (local.get $p)))
      (if (i32.eq (i32.load offset=4 (local.get $p)) (global.get $gl_current_context))
        (then (return (local.get $p))))
      (local.set $p (i32.load (local.get $p))) (br $scan)))
    (local.set $p (call $gl_list_alloc (i32.const 968)))
    (if (i32.eqz (local.get $p)) (then (unreachable)))
    (i32.store (local.get $p) (global.get $gl_list_contexts))
    (i32.store offset=4 (local.get $p) (global.get $gl_current_context))
    (call $gl_bitmap_context_init (local.get $p))
    (call $gl_stencil_init (i32.add (local.get $p) (i32.const 192)))
    (i32.store offset=228 (local.get $p) (i32.const 15))
    (i32.store offset=232 (local.get $p) (i32.const 0x405))
    (i32.store offset=236 (local.get $p) (i32.const 0x405))
    (global.set $gl_list_contexts (local.get $p))
    (local.get $p))

  (func $gl_list_error (param $ctx i32) (param $error i32)
    (if (i32.eqz (i32.load offset=32 (local.get $ctx)))
      (then (i32.store offset=32 (local.get $ctx) (local.get $error)))))

  (func $gl_list_slot (param $ctx i32) (param $name i32) (result i32)
    (local $b i32) (local $index i32)
    (local.set $b (i32.load offset=8 (local.get $ctx)))
    (block $done (loop $scan
      (br_if $done (i32.eqz (local.get $b)))
      (local.set $index (i32.sub (local.get $name) (i32.load offset=4 (local.get $b))))
      (if (i32.lt_u (local.get $index) (i32.load offset=8 (local.get $b)))
        (then (return (i32.add (i32.add (local.get $b) (i32.const 12))
          (i32.shl (local.get $index) (i32.const 2))))))
      (local.set $b (i32.load (local.get $b))) (br $scan)))
    (i32.const 0))

  (func $gl_list_block (param $ctx i32) (param $first i32) (param $count i32) (result i32)
    (local $b i32) (local $i i32)
    ;; Checked before the multiplication and before touching existing lists.
    (if (i32.gt_u (local.get $count) (i32.const 0x1ffffffc))
      (then (call $gl_list_error (local.get $ctx) (i32.const 0x505)) (return (i32.const 0))))
    (local.set $b (call $gl_list_alloc
      (i32.add (i32.const 12) (i32.shl (local.get $count) (i32.const 2)))))
    (if (i32.eqz (local.get $b))
      (then (call $gl_list_error (local.get $ctx) (i32.const 0x505)) (return (i32.const 0))))
    (i32.store (local.get $b) (i32.load offset=8 (local.get $ctx)))
    (i32.store offset=4 (local.get $b) (local.get $first))
    (i32.store offset=8 (local.get $b) (local.get $count))
    (i32.store offset=8 (local.get $ctx) (local.get $b))
    (loop $fill
      (i32.store (i32.add (i32.add (local.get $b) (i32.const 12))
        (i32.shl (local.get $i) (i32.const 2))) (i32.const 1))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $fill (i32.lt_u (local.get $i) (local.get $count))))
    (i32.add (local.get $b) (i32.const 12)))

  (func $gl_list_free_commands (param $p i32)
    (local $next i32)
    (block $done (loop $free
      (br_if $done (i32.le_u (local.get $p) (i32.const 2)))
      (local.set $next (i32.load (local.get $p)))
      (call $heap_free (call $w2g (local.get $p)))
      (local.set $p (local.get $next)) (br $free))))

  (func $gl_list_call (param $ctx i32) (param $name i32)
    (local $slot i32) (local $p i32)
    (local.set $slot (call $gl_list_slot (local.get $ctx) (local.get $name)))
    (if (i32.eqz (local.get $slot)) (then (return)))
    ;; OpenGL guarantees at least 64 levels. Stop recursive lists at that
    ;; implementation limit; do not exhaust the host/Wasm call stack.
    (if (i32.ge_u (i32.load offset=28 (local.get $ctx)) (i32.const 64)) (then (return)))
    (i32.store offset=28 (local.get $ctx) (i32.add (i32.load offset=28 (local.get $ctx)) (i32.const 1)))
    (local.set $p (i32.load (local.get $slot)))
    (block $done (loop $play
      (br_if $done (i32.le_u (local.get $p) (i32.const 2)))
      (if (i32.eq (i32.load offset=4 (local.get $p)) (i32.const 131))
        (then (call $gl_bitmap_draw (local.get $ctx) (i32.add (local.get $p) (i32.const 8))
          (select (i32.add (local.get $p) (i32.const 88)) (i32.const 0) (i32.ne (i32.load offset=84 (local.get $p)) (i32.const 0)))))
        (else (if (i32.eq (i32.load offset=4 (local.get $p)) (i32.const 133))
          (then (call $gl_calllists_play (local.get $ctx) (i32.add (local.get $p) (i32.const 88)) (i32.load offset=12 (local.get $p))))
          (else (drop (call $gl_wat_encode_call (i32.load offset=4 (local.get $p))
            (i32.add (local.get $p) (i32.const 8)) (i32.const 0)))))))
      (local.set $p (i32.load (local.get $p))) (br $play)))
    (i32.store offset=28 (local.get $ctx) (i32.sub (i32.load offset=28 (local.get $ctx)) (i32.const 1))))

  ;; Material validation precedes capture and observers, so rejected calls
  ;; cannot light pending vertices, mutate state or enter a display list.
  (func $gl_material_validate (param $ctx i32) (param $op i32) (param $stack i32) (result i32)
    (local $face i32) (local $name i32) (local $v f32)
    (if (i32.eqz (i32.or (i32.eq (local.get $op) (i32.const 68))
                        (i32.or (i32.eq (local.get $op) (i32.const 71)) (i32.eq (local.get $op) (i32.const 92))))) (then (return (i32.const 0))))
    (local.set $face (i32.load offset=4 (local.get $stack)))
    (local.set $name (i32.load offset=8 (local.get $stack)))
    (if (i32.eqz (i32.or
        (i32.or (i32.eq (local.get $face) (i32.const 0x404)) (i32.eq (local.get $face) (i32.const 0x405)))
        (i32.eq (local.get $face) (i32.const 0x408)))) (then
      (call $gl_list_error (local.get $ctx) (i32.const 0x500)) (return (i32.const 1))))
    (if (i32.or
        (i32.and (i32.or (i32.eq (local.get $op) (i32.const 71)) (i32.eq (local.get $op) (i32.const 92))) (i32.ne (local.get $name) (i32.const 0x1601)))
        (i32.eqz (i32.or (i32.le_u (i32.sub (local.get $name) (i32.const 0x1200)) (i32.const 2))
                        (i32.le_u (i32.sub (local.get $name) (i32.const 0x1600)) (i32.const 3))))) (then
      (call $gl_list_error (local.get $ctx) (i32.const 0x500)) (return (i32.const 1))))
    (if (i32.eq (local.get $name) (i32.const 0x1601)) (then
      (local.set $v (if (result f32) (i32.eq (local.get $op) (i32.const 68))
        (then (f32.reinterpret_i32 (call $gl32 (i32.load offset=12 (local.get $stack)))))
        (else (if (result f32) (i32.eq (local.get $op) (i32.const 92))
          (then (f32.convert_i32_s (i32.load offset=12 (local.get $stack))))
          (else (f32.load offset=12 (local.get $stack)))))))
      (if (i32.or (f32.lt (local.get $v) (f32.const 0)) (f32.gt (local.get $v) (f32.const 128))) (then
        (call $gl_list_error (local.get $ctx) (i32.const 0x501)) (return (i32.const 1))))))
    (i32.const 0))

  ;; Returning 1 means consumed; $gl_list_result carries an API return value.
  ;; Deliberately unsupported commands trap while compiling, BEFORE observers
  ;; can execute them. Pointer/array/image capture is not silently borrowed.
  (func $gl_list_intercept (param $op i32) (param $stack i32) (result i32)
    (local $ctx i32) (local $slot i32) (local $p i32) (local $b i32)
    (local $prev i32) (local $next i32) (local $used i32)
    (local $n i32) (local $id i32) (local $i i32) (local $first i32) (local $end i64)
    (global.set $gl_list_result (i32.const 0))
    (local.set $ctx (call $gl_list_context))
    (if (i32.eqz (local.get $ctx))
      (then (return (i32.or (i32.eq (local.get $op) (i32.const 146))
        (i32.and (i32.ge_u (local.get $op) (i32.const 124))
          (i32.le_u (local.get $op) (i32.const 140)))))))
    (if (call $gl_clip_validate (local.get $ctx) (local.get $op) (local.get $stack))
      (then (return (i32.const 1))))
    (if (i32.or (i32.eq (local.get $op) (i32.const 149)) (i32.eq (local.get $op) (i32.const 150))) (then
      (local.set $n (call $gl_1d_validate (local.get $ctx) (i32.eq (local.get $op) (i32.const 150)) (local.get $stack)))
      (if (local.get $n) (then (call $gl_list_error (local.get $ctx) (local.get $n)) (return (i32.const 1))))))
    (if (i32.and (i32.or (i32.eq (local.get $op) (i32.const 8)) (i32.eq (local.get $op) (i32.const 10)))
      (i32.and (i32.eq (i32.load offset=4 (local.get $stack)) (i32.const 0xde0))
        (i32.or (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0)) (i32.load offset=36 (local.get $ctx))))) (then
      (call $gl_list_error (local.get $ctx) (i32.const 0x502)) (return (i32.const 1))))
    (if (call $gl_texture_validate (local.get $ctx) (local.get $op) (local.get $stack))
      (then (return (i32.const 1))))
    (if (call $gl_color_buffer_validate (local.get $ctx) (local.get $op) (local.get $stack))
      (then (return (i32.const 1))))
    (if (i32.and (i32.eq (local.get $op) (i32.const 146))
        (i32.or (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0))
          (i32.ne (i32.load offset=36 (local.get $ctx)) (i32.const 0)))) (then
      (call $gl_list_error (local.get $ctx) (i32.const 0x502)) (return (i32.const 1))))
    ;; Rect, matrix load/multiplication and scale/translation are illegal between Begin/End, including
    ;; while compiling a list.
    ;; Replay keeps it atomic so the caller's vertices and Begin survive.
    (if (i32.and (i32.or
        (i32.or (i32.eq (local.get $op) (i32.const 39)) (i32.eq (local.get $op) (i32.const 90)))
        (i32.or
        (i32.or (i32.eq (local.get $op) (i32.const 142)) (i32.eq (local.get $op) (i32.const 109)))
        (i32.or (i32.eq (local.get $op) (i32.const 34))
          (i32.or (i32.eq (local.get $op) (i32.const 40)) (i32.eq (local.get $op) (i32.const 41))))))
        (i32.or (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0))
          (i32.ne (i32.load offset=36 (local.get $ctx)) (i32.const 0)))) (then
      (call $gl_list_error (local.get $ctx) (i32.const 0x502))
      (return (i32.const 1))))
    (if (i32.and (i32.ge_u (local.get $op) (i32.const 83))
        (i32.le_u (local.get $op) (i32.const 85))) (then
      (if (call $gl_texgen_validate (local.get $ctx) (local.get $op) (local.get $stack))
        (then (return (i32.const 1))))))
    (if (call $gl_lmf_validate (local.get $ctx) (local.get $op) (local.get $stack))
      (then (return (i32.const 1))))
    (if (call $gl_material_validate (local.get $ctx) (local.get $op) (local.get $stack))
      (then (return (i32.const 1))))
    (local.set $id (i32.load offset=4 (local.get $stack)))
    (if (call $gl_stencil_validate (local.get $ctx) (local.get $op) (local.get $stack))
      (then (return (i32.const 1))))
    (if (i32.and (i32.and (i32.ge_u (local.get $op) (i32.const 124))
          (i32.lt_u (local.get $op) (i32.const 143)))
        (i32.and (i32.ne (local.get $op) (i32.const 127)) (i32.ne (local.get $op) (i32.const 133)))) (then
      (if (i32.or (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0))
          (i32.ne (i32.load offset=36 (local.get $ctx)) (i32.const 0))) (then
        (call $gl_list_error (local.get $ctx) (i32.const 0x502))
        (return (i32.const 1))))))
    ;; GetError is immediate during compilation, as are allocation/deletion.
    (if (i32.and (i32.eq (local.get $op) (i32.const 12))
        (i32.ne (i32.load offset=32 (local.get $ctx)) (i32.const 0))) (then
      (global.set $gl_list_result (i32.load offset=32 (local.get $ctx)))
      (i32.store offset=32 (local.get $ctx) (i32.const 0)) (return (i32.const 1))))
    ;; 124 GenLists: reserve a contiguous, nonzero range, checking wraparound.
    (if (i32.eq (local.get $op) (i32.const 124)) (then
      (if (i32.lt_s (local.get $id) (i32.const 0)) (then
        (call $gl_list_error (local.get $ctx) (i32.const 0x501)) (return (i32.const 1))))
      (if (i32.eqz (local.get $id)) (then (return (i32.const 1))))
      (local.set $first (i32.const 1))
      (block $found (loop $retry
        (local.set $end (i64.add (i64.extend_i32_u (local.get $first)) (i64.extend_i32_u (local.get $id))))
        (if (i64.gt_u (local.get $end) (i64.const 0x100000000)) (then (return (i32.const 1))))
        (local.set $b (i32.load offset=8 (local.get $ctx)))
        (block $scan_done (loop $scan
          (br_if $scan_done (i32.eqz (local.get $b)))
          (local.set $i (i32.const 0))
          (loop $slots
            (local.set $n (i32.add (i32.load offset=4 (local.get $b)) (local.get $i)))
            (if (i32.and (i32.ge_u (local.get $n) (local.get $first))
                (i64.lt_u (i64.extend_i32_u (local.get $n)) (local.get $end))) (then
              (if (i32.load (i32.add (i32.add (local.get $b) (i32.const 12))
                    (i32.shl (local.get $i) (i32.const 2)))) (then
                (if (i32.eq (local.get $n) (i32.const -1)) (then (return (i32.const 1))))
                (local.set $first (i32.add (local.get $n) (i32.const 1))) (br $retry)))))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br_if $slots (i32.lt_u (local.get $i) (i32.load offset=8 (local.get $b)))))
          (local.set $b (i32.load (local.get $b))) (br $scan)))
        (br $found)))
      ;; Lookup prefers the newest block when deleted names are reserved again.
      (if (call $gl_list_block (local.get $ctx) (local.get $first) (local.get $id))
        (then (global.set $gl_list_result (local.get $first))))
      (return (i32.const 1))))
    ;; 125 NewList(name, mode). Existing definition survives until EndList.
    (if (i32.eq (local.get $op) (i32.const 125)) (then
      (if (i32.ne (i32.load offset=12 (local.get $ctx)) (i32.const 0)) (then
        (call $gl_list_error (local.get $ctx) (i32.const 0x502)) (return (i32.const 1))))
      (if (i32.eqz (local.get $id)) (then
        (call $gl_list_error (local.get $ctx) (i32.const 0x501)) (return (i32.const 1))))
      (local.set $n (i32.load offset=8 (local.get $stack)))
      (if (i32.and (i32.ne (local.get $n) (i32.const 0x1300))
                   (i32.ne (local.get $n) (i32.const 0x1301))) (then
        (call $gl_list_error (local.get $ctx) (i32.const 0x500)) (return (i32.const 1))))
      (local.set $slot (call $gl_list_slot (local.get $ctx) (local.get $id)))
      (if (i32.eqz (local.get $slot)) (then
        (local.set $slot (call $gl_list_block (local.get $ctx) (local.get $id) (i32.const 1)))))
      (if (i32.eqz (local.get $slot)) (then (return (i32.const 1))))
      (if (i32.eqz (i32.load (local.get $slot)))
        (then (i32.store (local.get $slot) (i32.const 1))))
      (i32.store offset=12 (local.get $ctx) (local.get $slot))
      (i32.store offset=16 (local.get $ctx) (i32.const 2))
      (i32.store offset=20 (local.get $ctx) (i32.const 0))
      (i32.store offset=24 (local.get $ctx) (local.get $n)) (return (i32.const 1))))
    ;; 126 EndList.
    (if (i32.eq (local.get $op) (i32.const 126)) (then
      (local.set $slot (i32.load offset=12 (local.get $ctx)))
      (if (i32.eqz (local.get $slot)) (then
        (call $gl_list_error (local.get $ctx) (i32.const 0x502)) (return (i32.const 1))))
      (call $gl_list_free_commands (i32.load (local.get $slot)))
      (i32.store (local.get $slot) (i32.load offset=16 (local.get $ctx)))
      (i32.store offset=12 (local.get $ctx) (i32.const 0)) (return (i32.const 1))))
    ;; 128 DeleteLists(name, range), 129 IsList(name).
    (if (i32.eq (local.get $op) (i32.const 129)) (then
      (local.set $slot (call $gl_list_slot (local.get $ctx) (local.get $id)))
      (if (local.get $slot) (then
        (global.set $gl_list_result (i32.ge_u (i32.load (local.get $slot)) (i32.const 2)))))
      (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 128)) (then
      (local.set $n (i32.load offset=8 (local.get $stack)))
      (if (i32.lt_s (local.get $n) (i32.const 0)) (then
        (call $gl_list_error (local.get $ctx) (i32.const 0x501)) (return (i32.const 1))))
      (local.set $b (i32.load offset=8 (local.get $ctx)))
      (block $deleted (loop $blocks
        (br_if $deleted (i32.eqz (local.get $b)))
        (local.set $next (i32.load (local.get $b)))
        (local.set $used (i32.const 0))
        (local.set $i (i32.const 0))
        (loop $entries
          (local.set $first (i32.add (i32.load offset=4 (local.get $b)) (local.get $i)))
          (local.set $slot (i32.add (i32.add (local.get $b) (i32.const 12)) (i32.shl (local.get $i) (i32.const 2))))
          (if (i32.and (i32.ge_u (local.get $first) (local.get $id))
              (i32.lt_u (i32.sub (local.get $first) (local.get $id)) (local.get $n))) (then
            (call $gl_list_free_commands (i32.load (local.get $slot)))
            (i32.store (local.get $slot) (i32.const 0))))
          (if (i32.or (i32.ne (i32.load (local.get $slot)) (i32.const 0))
              (i32.eq (local.get $slot) (i32.load offset=12 (local.get $ctx))))
            (then (local.set $used (i32.const 1))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br_if $entries (i32.lt_u (local.get $i) (i32.load offset=8 (local.get $b)))))
        (if (i32.eqz (local.get $used)) (then
          (if (local.get $prev) (then (i32.store (local.get $prev) (local.get $next)))
            (else (i32.store offset=8 (local.get $ctx) (local.get $next))))
          (call $heap_free (call $w2g (local.get $b))))
          (else (local.set $prev (local.get $b))))
        (local.set $b (local.get $next)) (br $blocks)))
      (return (i32.const 1))))
    ;; Only commands with explicit value capture compile. Matrix34/109 owns its
    ;; 64-byte pointed float payload in the same 88-byte list node.
    (if (i32.and (i32.ne (i32.load offset=12 (local.get $ctx)) (i32.const 0))
        (i32.eqz (i32.load offset=28 (local.get $ctx)))) (then
      (if (i32.eq (local.get $op) (i32.const 131)) (then
        (call $gl_bitmap_record (local.get $ctx) (local.get $stack)) (return (i32.const 1))))
      (if (i32.eq (local.get $op) (i32.const 133)) (then
        (call $gl_calllists (local.get $ctx) (local.get $stack) (i32.const 1)) (return (i32.const 1))))
      (if (i32.eq (local.get $op) (i32.const 21)) (then
        (if (i32.load offset=36 (local.get $ctx)) (then
          (call $gl_list_error (local.get $ctx) (i32.const 0x502)) (return (i32.const 1))))
        (if (i32.gt_u (local.get $id) (i32.const 9)) (then
          (call $gl_list_error (local.get $ctx) (i32.const 0x500)) (return (i32.const 1))))
        (i32.store offset=36 (local.get $ctx) (i32.const 1))))
      (if (i32.eq (local.get $op) (i32.const 22)) (then
        (if (i32.eqz (i32.load offset=36 (local.get $ctx))) (then
          (call $gl_list_error (local.get $ctx) (i32.const 0x502)) (return (i32.const 1))))
        (i32.store offset=36 (local.get $ctx) (i32.const 0))))
      (if (i32.or (i32.or (i32.or (i32.eq (local.get $op) (i32.const 67)) (i32.eq (local.get $op) (i32.const 69))) (i32.eq (local.get $op) (i32.const 78)))
        (i32.or (i32.or (call $gl_list_scalar_command (local.get $op))
          (i32.or (i32.eq (local.get $op) (i32.const 112)) (i32.eq (local.get $op) (i32.const 147))))
          (i32.or (i32.or (i32.eq (local.get $op) (i32.const 109))
                          (i32.eq (local.get $op) (i32.const 34)))
                  (i32.eq (local.get $op) (i32.const 68))))) (then
        (if (i32.eq (local.get $op) (i32.const 85)) (then
          (call $gl_texcoord_check (i32.load offset=12 (local.get $stack))
            (select (i32.const 4) (i32.const 16) (i32.eq (i32.load offset=8 (local.get $stack)) (i32.const 0x2500))))))
        (local.set $p (call $gl_list_alloc (i32.add (i32.const 88)
          (if (result i32) (i32.or (i32.eq (local.get $op) (i32.const 149)) (i32.eq (local.get $op) (i32.const 150)))
            (then (i32.shl (i32.load offset=16 (local.get $stack)) (i32.const 2))) (else (i32.const 0))))))
        (if (i32.eqz (local.get $p)) (then
          (call $gl_list_error (local.get $ctx) (i32.const 0x505)) (return (i32.const 1))))
        (i32.store offset=4 (local.get $p) (local.get $op))
        (memory.copy (i32.add (local.get $p) (i32.const 8)) (local.get $stack)
          (i32.shl (i32.add (call $gl_arg_words (local.get $op)) (i32.const 1)) (i32.const 2)))
        (if (i32.or (i32.eq (local.get $op) (i32.const 109))
                    (i32.eq (local.get $op) (i32.const 34))) (then
          (call $gl_copy_from_guest (i32.add (local.get $p) (i32.const 16))
            (i32.load offset=4 (local.get $stack)) (i32.const 64))
          (i32.store offset=12 (local.get $p) (call $w2g (i32.add (local.get $p) (i32.const 16))))))
        (if (i32.eq (local.get $op) (i32.const 68)) (then
          ;; stack occupies node +8..+23; payload follows, owned by node.
          (call $gl_copy_from_guest (i32.add (local.get $p) (i32.const 24))
            (i32.load offset=12 (local.get $stack))
            (select (i32.const 4)
              (select (i32.const 12) (i32.const 16)
                (i32.eq (i32.load offset=8 (local.get $stack)) (i32.const 0x1603)))
              (i32.eq (i32.load offset=8 (local.get $stack)) (i32.const 0x1601))))
          (i32.store offset=20 (local.get $p) (call $w2g (i32.add (local.get $p) (i32.const 24))))))
        (if (i32.or (i32.or (i32.eq (local.get $op) (i32.const 67)) (i32.eq (local.get $op) (i32.const 69))) (i32.eq (local.get $op) (i32.const 78))) (then
          (local.set $n (select (i32.const 12) (i32.const 8) (i32.eq (local.get $op) (i32.const 67))))
          (call $gl_copy_from_guest (i32.add (local.get $p) (i32.const 24))
            (i32.load (i32.add (local.get $stack) (local.get $n)))
            (i32.shl (call $gl_lmf_count (call $gl_lmf_family (local.get $op))
              (i32.load (i32.add (local.get $stack) (i32.sub (local.get $n) (i32.const 4))))) (i32.const 2)))
          (i32.store (i32.add (i32.add (local.get $p) (i32.const 8)) (local.get $n))
            (call $w2g (i32.add (local.get $p) (i32.const 24))))))
        (if (i32.eq (local.get $op) (i32.const 85)) (then
          (call $gl_copy_from_guest (i32.add (local.get $p) (i32.const 24))
            (i32.load offset=12 (local.get $stack))
            (select (i32.const 4) (i32.const 16) (i32.eq (i32.load offset=8 (local.get $stack)) (i32.const 0x2500))))
          (i32.store offset=20 (local.get $p) (call $w2g (i32.add (local.get $p) (i32.const 24))))))
        (if (i32.or (i32.eq (local.get $op) (i32.const 112)) (i32.eq (local.get $op) (i32.const 147))) (then
          (call $gl_copy_from_guest (i32.add (local.get $p) (i32.const 24))
            (i32.load offset=12 (local.get $stack))
            (i32.shl (call $gl_texture_count (i32.eq (local.get $op) (i32.const 147))
              (i32.load offset=8 (local.get $stack)) (i32.const 0)) (i32.const 2)))
          (i32.store offset=20 (local.get $p) (call $w2g (i32.add (local.get $p) (i32.const 24))))))
        (if (i32.eq (local.get $op) (i32.const 148)) (then
          (call $gl_copy_from_guest (i32.add (local.get $p) (i32.const 24))
            (i32.load offset=8 (local.get $stack)) (i32.const 32))
          (i32.store offset=16 (local.get $p) (call $w2g (i32.add (local.get $p) (i32.const 24))))))
        (if (i32.or (i32.eq (local.get $op) (i32.const 149)) (i32.eq (local.get $op) (i32.const 150))) (then
          (local.set $n (select (i32.const 32) (i32.const 28) (i32.eq (local.get $op) (i32.const 149))))
          (call $gl_copy_from_guest (i32.add (local.get $p) (i32.const 88))
            (i32.load (i32.add (local.get $stack) (local.get $n)))
            (i32.shl (i32.load offset=16 (local.get $stack)) (i32.const 2)))
          (i32.store (i32.add (i32.add (local.get $p) (i32.const 8)) (local.get $n))
            (call $w2g (i32.add (local.get $p) (i32.const 88))))))
        (local.set $b (i32.load offset=20 (local.get $ctx)))
        (if (local.get $b) (then (i32.store (local.get $b) (local.get $p)))
          (else (i32.store offset=16 (local.get $ctx) (local.get $p))))
        (i32.store offset=20 (local.get $ctx) (local.get $p))
        (if (i32.eq (i32.load offset=24 (local.get $ctx)) (i32.const 0x1300))
          (then (return (i32.const 1)))))
      (else
        ;; Queries/client state are immediate; everything else must have a
        ;; deliberate capture implementation before it can enter a list.
        (if (i32.eqz (call $gl_list_immediate_command (local.get $op)))
          (then (call $gl_list_unsupported_command)))))))
    (if (i32.eq (local.get $op) (i32.const 127)) (then
      (call $gl_list_call (local.get $ctx) (local.get $id)) (return (i32.const 1))))
    (i32.const 0))

  (func $gl_list_unsupported_command (unreachable))

  (func $gl_list_context_deleted (param $key i32)
    (local $ctx i32) (local $prev i32) (local $b i32) (local $next i32) (local $i i32)
    (local.set $ctx (global.get $gl_list_contexts))
    (block $done (loop $scan
      (br_if $done (i32.eqz (local.get $ctx)))
      (if (i32.eq (i32.load offset=4 (local.get $ctx)) (local.get $key)) (then
        (if (local.get $prev) (then (i32.store (local.get $prev) (i32.load (local.get $ctx))))
          (else (global.set $gl_list_contexts (i32.load (local.get $ctx)))))
        (if (i32.load offset=12 (local.get $ctx))
          (then (call $gl_list_free_commands (i32.load offset=16 (local.get $ctx)))))
        (local.set $b (i32.load offset=8 (local.get $ctx)))
        (block $freed (loop $blocks
          (br_if $freed (i32.eqz (local.get $b)))
          (local.set $next (i32.load (local.get $b)))
          (local.set $i (i32.const 0))
          (loop $slots
            (call $gl_list_free_commands (i32.load (i32.add (i32.add (local.get $b) (i32.const 12))
              (i32.shl (local.get $i) (i32.const 2)))))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br_if $slots (i32.lt_u (local.get $i) (i32.load offset=8 (local.get $b)))))
          (call $heap_free (call $w2g (local.get $b)))
          (local.set $b (local.get $next)) (br $blocks)))
        (local.set $b (i32.load offset=104 (local.get $ctx)))
        (block $attributes_done (loop $attributes
          (br_if $attributes_done (i32.eqz (local.get $b)))
          (local.set $next (i32.load (local.get $b)))
          (call $heap_free (call $w2g (local.get $b)))
          (local.set $b (local.get $next)) (br $attributes)))
        (call $gl_state_free_attribs (i32.load offset=176 (local.get $ctx)))
        (if (i32.load offset=240 (local.get $ctx)) (then
          (call $heap_free (call $w2g (i32.load offset=240 (local.get $ctx))))))
        (call $gl_texture_free (local.get $ctx))
        (call $heap_free (call $w2g (local.get $ctx))) (return)))
      (local.set $prev (local.get $ctx))
      (local.set $ctx (i32.load (local.get $ctx))) (br $scan))))

  (func $gl_list_reset
    (block $done (loop $free
      (br_if $done (i32.eqz (global.get $gl_list_contexts)))
      (call $gl_list_context_deleted (i32.load offset=4 (global.get $gl_list_contexts)))
      (br $free))))

  (func $gl_list_scalar_command (param $op i32) (result i32)
    (if (i32.le_u (i32.sub (local.get $op) (i32.const 149)) (i32.const 1)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 148)) (then (return (i32.const 1))))
    (if (i32.or (i32.eq (local.get $op) (i32.const 146))
      (i32.and (i32.ge_u (local.get $op) (i32.const 83)) (i32.le_u (local.get $op) (i32.const 85))))
      (then (return (i32.const 1))))
    (if (i32.le_u (i32.sub (local.get $op) (i32.const 143)) (i32.const 1)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 142)) (then (return (i32.const 1))))
    (if (i32.le_u (i32.sub (local.get $op) (i32.const 136)) (i32.const 4))
      (then (return (i32.const 1))))
    (block $no (block $yes
      (br_table $yes $yes $yes $yes $yes $yes $yes $yes $yes $yes $yes $no $no $no $no $yes $yes $no $yes $yes $yes $yes $yes $yes $no $yes $no $no $yes $yes $yes $no $yes $yes $no $yes $yes $yes $yes $yes $yes $yes $yes $no $yes $no $yes $no $no $no $no $no $no $no $no $no $yes $yes $no $no $no $no $no $yes $no $no $yes $no $no $no $yes $yes $yes $no $no $yes $no $no $no $yes $yes $yes $yes $no $yes $no $no $no $no $no $yes $no $yes $no $yes $no $yes $yes $no $no $no $no $no $no $yes $yes $no $yes $no $no $yes $yes $no $no $no $no $no $no $yes $no $yes $no $yes $no $no $no $no $yes $no $no $yes $no $yes $no $no (local.get $op)))
      (return (i32.const 1)))
    (i32.const 0))

  (func $gl_list_immediate_command (param $op i32) (result i32)
    (if (i32.eq (local.get $op) (i32.const 145)) (then (return (i32.const 1))))
    ;; GLU image conversion is a CPU operation, never display-list content.
    (if (i32.eq (local.get $op) (i32.const 141)) (then (return (i32.const 1))))
    ;; Client stacks execute immediately even inside GL_COMPILE.
    (if (i32.or (i32.eq (local.get $op) (i32.const 134))
                (i32.eq (local.get $op) (i32.const 135))) (then (return (i32.const 1))))
    (block $no (block $yes
      (br_table $no $no $no $no $no $no $no $no $no $no $no $yes $yes $yes $yes $no $no $yes $no $no $no $no $no $no $no $no $no $no $no $no $no $no $no $no $no $no $no $no $no $no $no $no $no $no $no $no $no $no $yes $yes $yes $yes $yes $yes $yes $yes $no $no $no $no $no $no $no $no $no $yes $no $no $no $no $no $no $no $yes $yes $no $no $no $no $no $no $no $no $no $no $no $yes $no $yes $yes $no $no $no $yes $no $no $no $no $no $yes $yes $yes $no $yes $no $no $yes $no $no $no $no $no $no $yes $yes $yes $yes $no $no $no $no $no $no $no $no $no $no $no $no $no $no (local.get $op)))
      (return (i32.const 1)))
    (i32.const 0))

  ;; Shared validation for the established float commands and lowered integer
  ;; commands, before display-list capture, pending-vertex lighting or state.
  (func $gl_lmf_family (param $op i32) (result i32)
    (if (i32.or (i32.eq (local.get $op) (i32.const 78))
        (i32.or (i32.eq (local.get $op) (i32.const 79)) (i32.eq (local.get $op) (i32.const 80)))) (then (return (i32.const 0))))
    (if (i32.or (i32.eq (local.get $op) (i32.const 69)) (i32.eq (local.get $op) (i32.const 70))) (then (return (i32.const 1))))
    (if (i32.or (i32.eq (local.get $op) (i32.const 67)) (i32.eq (local.get $op) (i32.const 72))) (then (return (i32.const 2))))
    (if (i32.or (i32.eq (local.get $op) (i32.const 68))
        (i32.or (i32.eq (local.get $op) (i32.const 71)) (i32.eq (local.get $op) (i32.const 92)))) (then (return (i32.const 3))))
    (i32.const -1))

  (func $gl_lmf_validate (param $ctx i32) (param $op i32) (param $stack i32) (result i32)
    (local $family i32) (local $first i32) (local $name i32) (local $count i32)
    (local $vector i32) (local $p i32) (local $v f32) (local $raw i32) (local $error i32)
    (local.set $family (call $gl_lmf_family (local.get $op)))
    (if (i32.eq (local.get $family) (i32.const -1)) (then (return (i32.const 0))))
    (if (i32.and (i32.ne (local.get $family) (i32.const 3))
        (i32.or (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0)) (i32.ne (i32.load offset=36 (local.get $ctx)) (i32.const 0))))
      (then (call $gl_list_error (local.get $ctx) (i32.const 0x502)) (return (i32.const 1))))
    (local.set $first (i32.load offset=4 (local.get $stack)))
    (local.set $name (if (result i32) (i32.ge_u (local.get $family) (i32.const 2))
      (then (i32.load offset=8 (local.get $stack))) (else (local.get $first))))
    (local.set $count (call $gl_lmf_count (local.get $family) (local.get $name)))
    (local.set $vector (i32.or (i32.or (i32.eq (local.get $op) (i32.const 67)) (i32.eq (local.get $op) (i32.const 68)))
      (i32.or (i32.eq (local.get $op) (i32.const 69)) (i32.eq (local.get $op) (i32.const 78)))))
    (if (i32.or (i32.eqz (local.get $count))
        (i32.and (i32.eqz (local.get $vector)) (i32.ne (local.get $count) (i32.const 1))))
      (then (local.set $error (i32.const 0x500))))
    (if (i32.and (i32.eq (local.get $family) (i32.const 2))
        (i32.ge_u (i32.sub (local.get $first) (i32.const 0x4000)) (i32.const 8))) (then (local.set $error (i32.const 0x500))))
    (if (i32.and (i32.eq (local.get $family) (i32.const 3))
        (i32.eqz (i32.or (i32.or (i32.eq (local.get $first) (i32.const 0x404)) (i32.eq (local.get $first) (i32.const 0x405)))
          (i32.eq (local.get $first) (i32.const 0x408))))) (then (local.set $error (i32.const 0x500))))
    (if (local.get $error) (then (call $gl_list_error (local.get $ctx) (local.get $error)) (return (i32.const 1))))
    (local.set $p (i32.add (local.get $stack) (select (i32.const 12) (i32.const 8) (i32.ge_u (local.get $family) (i32.const 2)))))
    (local.set $raw (i32.load (local.get $p)))
    (if (local.get $vector) (then
      (call $gl_texcoord_check (local.get $raw) (i32.shl (local.get $count) (i32.const 2)))
      (local.set $raw (call $gl32 (local.get $raw)))))
    (local.set $v (if (result f32) (i32.or (i32.eq (local.get $op) (i32.const 70))
        (i32.or (i32.eq (local.get $op) (i32.const 80)) (i32.eq (local.get $op) (i32.const 92))))
      (then (f32.convert_i32_s (local.get $raw))) (else (f32.reinterpret_i32 (local.get $raw)))))
    (if (i32.or
        (i32.and (i32.eq (local.get $family) (i32.const 0)) (i32.eq (local.get $name) (i32.const 0xb62)))
        (i32.and (i32.eq (local.get $family) (i32.const 2)) (i32.ge_u (local.get $name) (i32.const 0x1207)))) (then
      (if (f32.lt (local.get $v) (f32.const 0)) (then (local.set $error (i32.const 0x501))))))
    (if (i32.or
        (i32.and (i32.eq (local.get $family) (i32.const 3)) (i32.eq (local.get $name) (i32.const 0x1601)))
        (i32.and (i32.eq (local.get $family) (i32.const 2)) (i32.eq (local.get $name) (i32.const 0x1205)))) (then
      (if (i32.or (f32.lt (local.get $v) (f32.const 0)) (f32.gt (local.get $v) (f32.const 128))) (then (local.set $error (i32.const 0x501))))))
    (if (i32.and (i32.eq (local.get $family) (i32.const 2)) (i32.eq (local.get $name) (i32.const 0x1206))) (then
      (if (i32.and (f32.ne (local.get $v) (f32.const 180))
          (i32.or (f32.lt (local.get $v) (f32.const 0)) (f32.gt (local.get $v) (f32.const 90)))) (then (local.set $error (i32.const 0x501))))))
    (if (i32.and (i32.eqz (local.get $family)) (i32.eq (local.get $name) (i32.const 0xb65))) (then
      (if (i32.eqz (i32.or (i32.or (f32.eq (local.get $v) (f32.const 0x800)) (f32.eq (local.get $v) (f32.const 0x801)))
          (f32.eq (local.get $v) (f32.const 0x2601)))) (then (local.set $error (i32.const 0x500))))))
    (if (local.get $error) (then (call $gl_list_error (local.get $ctx) (local.get $error)) (return (i32.const 1))))
    (i32.const 0))

  ;; Gather the exact pname arity, including nonaffine guest-page boundaries.
  (func $gl_lmf_values (param $family i32) (param $name i32) (param $guest i32) (result i32)
    (local $p i32)
    (local.set $p (i32.add (call $gl_mtx_block) (i32.const 8992)))
    (memory.fill (local.get $p) (i32.const 0) (i32.const 16))
    (call $gl_copy_from_guest (local.get $p) (local.get $guest)
      (i32.shl (call $gl_lmf_count (local.get $family) (local.get $name)) (i32.const 2)))
    (local.get $p))
