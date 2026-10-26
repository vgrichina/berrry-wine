  ;; OpenGL matrix stacks, owned by WAT.
  ;;
  ;; GL's transform state is the one part of the fixed-function pipeline that
  ;; still lives only in JavaScript (lib/gl-compat.js:352-354), which is why
  ;; the command stream is a log of GL calls rather than a backend-neutral
  ;; descriptor: nothing on this side knows what the matrices are, so nothing
  ;; on this side can lower a draw. See docs/gl-software-path-design.md.
  ;;
  ;; This fragment is additive. It mirrors the JS semantics exactly rather than
  ;; improving on them, so the two can be compared element-for-element while
  ;; both exist; the encoder is wired to it separately. Every arithmetic choice
  ;; here is made to match lib/gl-compat.js:112-166 bit for bit:
  ;;   - matrices are COLUMN-MAJOR, 16 f32, as Float32Array is there;
  ;;   - products accumulate in f64 and are demoted once on store, because JS
  ;;     computes in doubles and stores into a Float32Array;
  ;;   - sin/cos come from the host imports, which are the same Math.sin/cos.
  ;; The one deliberate deviation is rotation's axis length: JS uses
  ;; Math.hypot, which is more accurate than sqrt(x*x+y*y+z*z) and has no wasm
  ;; equivalent, so a rotation about a non-unit axis can differ in the last
  ;; ulp. Tests compare rotations with a tolerance for exactly this reason.
  ;;
  ;; Per-context block, 10832 bytes:
  ;;   +0    matrix mode (0x1700 MODELVIEW, 0x1701 PROJECTION, 0x1702 TEXTURE)
  ;;   +4    active texture unit (0 or 1)
  ;;   +8    depth of stack 0 (modelview), index of its top entry
  ;;   +12   depth of stack 1 (projection)
  ;;   +16   depth of stack 2 (texture unit 0)
  ;;   +20   depth of stack 3 (texture unit 1)
  ;;   +24   sticky stack error: 0, GL_STACK_OVERFLOW or GL_STACK_UNDERFLOW
  ;;   +28   sticky UNTRUSTED flag: the opcode this block could not mirror
  ;;   +32   four stacks, 32 entries of 64 bytes each (8192 bytes)
  ;;   +8224 scratch used by a multiply whose destination aliases a source
  ;;   +8288 staging matrix a caller writes before load/mult (64 bytes)
  ;;   +8352 light model ambient, 4 f32
  ;;   +8368 eight lights, 64 bytes each: position, ambient, diffuse, specular
  ;;   +8880 material: ambient, diffuse, specular, emission (16 each),
  ;;         then shininess f32 at +8944, padding to +8960
  ;;   +8960 fog: mode i32, density f32, start f32, end f32, colour 4 f32
  ;;   +8992 scratch for a scalar setter that must present four f32
  ;;   +9008 viewport x, y, width, height (4 i32, as glViewport was given them)
  ;;   +9024 depth range near, far (2 f32, demoted from GL's GLclampd)
  ;;   +9032 depth of the attribute stack, the count of saved frames
  ;;   +9040 attribute stack, 16 frames of 112 bytes (1792 bytes)
  ;;         (ends at +10832)
  ;;
  ;; An attribute frame is: mask, active texture unit, light model ambient
  ;; (4 f32), material (the whole 80 bytes at +8880, shininess included).
  ;;
  ;; THAT SET IS SMALLER THAN REAL GL'S, DELIBERATELY. glPushAttrib with
  ;; GL_LIGHTING_BIT saves the light parameters too, and this saves neither
  ;; those nor fog nor the viewport -- because lib/gl-compat.js:709-720 does not
  ;; save them either, and the whole point of this fragment is that the two
  ;; agree element-for-element. Saving more here would make the WAT descriptor
  ;; and the WebGL picture disagree after a pop, which is a worse failure than
  ;; the one being mirrored: it appears only in scenes that push attributes, and
  ;; only as lighting that is subtly wrong in one backend. The gap is real and
  ;; belongs on both sides at once, not on one.
  ;;
  ;; The mask is recorded but not consulted on restore, again because the JS
  ;; does not consult it: it saves one set and restores that set whatever was
  ;; asked for. Kept in the frame because it is the first thing a future
  ;; mask-honest restore needs, and because a frame that does not carry it
  ;; cannot be checked against the call that made it.
  ;;
  ;; Viewport and depth range are here rather than with the rest of the GL
  ;; state in 09a8e because DFX1 wants them (+68..+88) and this is the block
  ;; the descriptor is built from. They are the only two fields in it that no
  ;; matrix or light operation touches.
  ;;
  ;; The depth cap is 32, which is GL's own required minimum for the modelview
  ;; stack. Real GL raises GL_STACK_OVERFLOW rather than growing, so a push
  ;; past the cap latches the error and leaves the stack alone. The JS mirror
  ;; has no cap and would keep pushing; nothing in the corpus nests that deep.

  (global $gl_mtx_contexts (mut i32) (i32.const 0))

  ;; Write a column-major identity at a 64-byte matrix slot.
  (func $gl_mtx_identity_at (param $p i32)
    (memory.fill (local.get $p) (i32.const 0) (i32.const 64))
    (f32.store offset=0 (local.get $p) (f32.const 1))
    (f32.store offset=20 (local.get $p) (f32.const 1))
    (f32.store offset=40 (local.get $p) (f32.const 1))
    (f32.store offset=60 (local.get $p) (f32.const 1)))

  ;; Base of stack $s inside block $b.
  (func $gl_mtx_base (param $b i32) (param $s i32) (result i32)
    (i32.add (local.get $b)
      (i32.add (i32.const 32) (i32.mul (local.get $s) (i32.const 2048)))))

  ;; Store four f32 at a vector slot.
  (func $gl_mtx_set4 (param $p i32)
      (param $x f32) (param $y f32) (param $z f32) (param $w f32)
    (f32.store offset=0 (local.get $p) (local.get $x))
    (f32.store offset=4 (local.get $p) (local.get $y))
    (f32.store offset=8 (local.get $p) (local.get $z))
    (f32.store offset=12 (local.get $p) (local.get $w)))

  ;; GL's lighting, material and fog defaults (lib/gl-compat.js:378-393). They
  ;; are not all zero, so a freshly zeroed block is NOT a legal GL state: an
  ;; app that enables lighting without setting anything must still get light 0
  ;; white and the material's 0.8 grey diffuse, or everything it draws comes
  ;; out black.
  (func $gl_mtx_init_lighting (param $b i32)
    (local $i i32) (local $light i32)
    (call $gl_mtx_set4 (i32.add (local.get $b) (i32.const 8352))
      (f32.const 0.2) (f32.const 0.2) (f32.const 0.2) (f32.const 1))
    (local.set $i (i32.const 0))
    (loop $lights
      (local.set $light (i32.add (local.get $b)
        (i32.add (i32.const 8368) (i32.mul (local.get $i) (i32.const 64)))))
      (call $gl_mtx_set4 (local.get $light)
        (f32.const 0) (f32.const 0) (f32.const 1) (f32.const 0))
      (call $gl_mtx_set4 (i32.add (local.get $light) (i32.const 16))
        (f32.const 0) (f32.const 0) (f32.const 0) (f32.const 1))
      ;; Only light 0 is lit by default; every other light contributes nothing
      ;; until the app gives it a colour.
      (if (i32.eqz (local.get $i))
        (then
          (call $gl_mtx_set4 (i32.add (local.get $light) (i32.const 32))
            (f32.const 1) (f32.const 1) (f32.const 1) (f32.const 1))
          (call $gl_mtx_set4 (i32.add (local.get $light) (i32.const 48))
            (f32.const 1) (f32.const 1) (f32.const 1) (f32.const 1)))
        (else
          (call $gl_mtx_set4 (i32.add (local.get $light) (i32.const 32))
            (f32.const 0) (f32.const 0) (f32.const 0) (f32.const 1))
          (call $gl_mtx_set4 (i32.add (local.get $light) (i32.const 48))
            (f32.const 0) (f32.const 0) (f32.const 0) (f32.const 1))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $lights (i32.lt_u (local.get $i) (i32.const 8))))
    (call $gl_mtx_set4 (i32.add (local.get $b) (i32.const 8880))
      (f32.const 0.2) (f32.const 0.2) (f32.const 0.2) (f32.const 1))
    (call $gl_mtx_set4 (i32.add (local.get $b) (i32.const 8896))
      (f32.const 0.8) (f32.const 0.8) (f32.const 0.8) (f32.const 1))
    (call $gl_mtx_set4 (i32.add (local.get $b) (i32.const 8912))
      (f32.const 0) (f32.const 0) (f32.const 0) (f32.const 1))
    (call $gl_mtx_set4 (i32.add (local.get $b) (i32.const 8928))
      (f32.const 0) (f32.const 0) (f32.const 0) (f32.const 1))
    (f32.store offset=8944 (local.get $b) (f32.const 0))
    (i32.store offset=8960 (local.get $b) (i32.const 0x0800))
    (f32.store offset=8964 (local.get $b) (f32.const 1))
    (f32.store offset=8968 (local.get $b) (f32.const 0))
    (f32.store offset=8972 (local.get $b) (f32.const 1))
    (call $gl_mtx_set4 (i32.add (local.get $b) (i32.const 8976))
      (f32.const 0) (f32.const 0) (f32.const 0) (f32.const 0)))

  ;; Context blocks are looked up the way $gl_state_slot does it, and for the
  ;; same reason: a linked list matches JS Map identity with no slot ceiling.
  ;; Unlike that table these are never recycled, because a matrix stack has no
  ;; meaningful "default" to restore a reused block to.
  (global $GL_MTX_BLOCKS i32 (region.addr $GL_MTX_BLOCKS 0))
  (global $GL_MTX_BLOCKS_SIZE i32 (region.size $GL_MTX_BLOCKS))

  (func $gl_mtx_slot (param $context i32) (param $create i32) (result i32)
    (local $p i32) (local $guest i32) (local $block i32) (local $s i32)
    (local.set $p (global.get $gl_mtx_contexts))
    (block $scan_done
      (loop $scan
        (br_if $scan_done (i32.eqz (local.get $p)))
        (if (i32.eq (i32.load (local.get $p)) (local.get $context))
          (then (return (i32.load offset=8 (local.get $p)))))
        (local.set $p (i32.load offset=4 (local.get $p)))
        (br $scan)))
    (if (i32.eqz (local.get $create)) (then (return (i32.const 0))))
    ;; The node and block live in $GL_MTX_BLOCKS, not in guest heap. Every
    ;; access here goes through ONE translated base plus an offset up to
    ;; 10832, and a guest heap block only guarantees that for the page it
    ;; starts on: once the low heap is exhausted it spills to the sparse
    ;; arena, whose adjacent guest pages need not be adjacent in WASM memory.
    ;; SimGolf got exactly that after 7257cb44 closed the region band to the
    ;; heap -- glLoadIdentity trapped out of bounds at batch 233887.
    ;; Eight contexts cover every app in the corpus; a ninth takes a heap
    ;; block that $gl_alloc_affine has checked is contiguous, or traps.
    ;; The claim counter is the region's first word, taken atomically: every
    ;; guest-thread instance has its own globals over this one shared memory,
    ;; so a global counter would hand two instances the same block.
    (local.set $s (i32.atomic.rmw.add (global.get $GL_MTX_BLOCKS) (i32.const 1)))
    (if (i32.lt_u (local.get $s) (i32.const 8))
      (then
        (local.set $p (i32.add (region.addr $GL_MTX_BLOCKS 0x40)
          (i32.mul (local.get $s) (i32.const 0x2C00))))
        (local.set $block (i32.add (local.get $p) (i32.const 16))))
      (else
        (local.set $guest (call $gl_alloc_affine (i32.const 10848)))
        (if (i32.eqz (local.get $guest)) (then (unreachable)))
        (local.set $p (call $g2w (local.get $guest)))
        (local.set $block (i32.add (local.get $p) (i32.const 16)))))
    (memory.fill (local.get $block) (i32.const 0) (i32.const 10832))
    (i32.store (local.get $block) (i32.const 0x1700))
    ;; A zeroed depth range is not GL's default and is not even a legal one --
    ;; near == far collapses depth entirely. GL starts at 0..1, and the
    ;; viewport legitimately starts at all zeroes until the app sets one.
    (f32.store offset=9024 (local.get $block) (f32.const 0))
    (f32.store offset=9028 (local.get $block) (f32.const 1))
    ;; Every stack starts one deep, holding identity.
    (local.set $s (i32.const 0))
    (loop $init
      (call $gl_mtx_identity_at
        (call $gl_mtx_base (local.get $block) (local.get $s)))
      (local.set $s (i32.add (local.get $s) (i32.const 1)))
      (br_if $init (i32.lt_u (local.get $s) (i32.const 4))))
    (call $gl_mtx_init_lighting (local.get $block))
    (i32.store (local.get $p) (local.get $context))
    (i32.store offset=4 (local.get $p) (global.get $gl_mtx_contexts))
    (i32.store offset=8 (local.get $p) (local.get $block))
    (global.set $gl_mtx_contexts (local.get $p))
    (local.get $block))

  ;; The block for whichever context is current. $gl_current_context is the
  ;; encoder's own global (09a8c-gl-encoder.wat:22), the same one
  ;; 09a8e-gl-state.wat keys its per-context state on, so all three tables
  ;; always agree about which context a call belongs to.
  (func $gl_mtx_block (result i32)
    (if (global.get $gl_mtx_block_override)
      (then (return (global.get $gl_mtx_block_override))))
    (call $gl_mtx_slot (global.get $gl_current_context) (i32.const 1)))
  ;; Nonzero only in a D3D render Worker drawing a queued GL record: the
  ;; private block the record's matrices and lights were copied into. That
  ;; instance must never claim a context block of its own -- the claim
  ;; counter is shared, and eight slots are all there are.
  (global $gl_mtx_block_override (mut i32) (i32.const 0))

  ;; Which stack the mode and active texture unit select.
  (func $gl_mtx_sel (param $b i32) (result i32)
    (local $mode i32)
    (local.set $mode (i32.load (local.get $b)))
    (if (i32.eq (local.get $mode) (i32.const 0x1701))
      (then (return (i32.const 1))))
    (if (i32.eq (local.get $mode) (i32.const 0x1702))
      (then (return (i32.add (i32.const 2)
        (i32.ne (i32.load offset=4 (local.get $b)) (i32.const 0))))))
    (i32.const 0))

  (func $gl_mtx_depth_addr (param $b i32) (param $s i32) (result i32)
    (i32.add (local.get $b)
      (i32.add (i32.const 8) (i32.mul (local.get $s) (i32.const 4)))))

  ;; Top matrix of the selected stack.
  (func $gl_mtx_top (param $b i32) (result i32)
    (local $s i32)
    (local.set $s (call $gl_mtx_sel (local.get $b)))
    (i32.add (call $gl_mtx_base (local.get $b) (local.get $s))
      (i32.mul (i32.const 64)
        (i32.load (call $gl_mtx_depth_addr (local.get $b) (local.get $s))))))

  ;; dst = a * b, column-major, exactly as lib/gl-compat.js:120-131 spells it:
  ;;   out[col*4+row] = sum over k of a[k*4+row] * b[col*4+k]
  ;; Accumulated in f64 and demoted once, because that is what JS does when it
  ;; assigns a double expression into a Float32Array element. dst must not
  ;; alias a or b; $gl_mtx_apply routes through scratch for that case.
  (func $gl_mtx_mul_into (param $dst i32) (param $a i32) (param $bm i32)
    (local $col i32) (local $row i32) (local $k i32) (local $acc f64)
    (local.set $col (i32.const 0))
    (loop $cols
      (local.set $row (i32.const 0))
      (loop $rows
        (local.set $acc (f64.const 0))
        (local.set $k (i32.const 0))
        (loop $ks
          (local.set $acc (f64.add (local.get $acc)
            (f64.mul
              (f64.promote_f32 (f32.load (i32.add (local.get $a)
                (i32.mul (i32.const 4)
                  (i32.add (i32.mul (local.get $k) (i32.const 4))
                    (local.get $row))))))
              (f64.promote_f32 (f32.load (i32.add (local.get $bm)
                (i32.mul (i32.const 4)
                  (i32.add (i32.mul (local.get $col) (i32.const 4))
                    (local.get $k)))))))))
          (local.set $k (i32.add (local.get $k) (i32.const 1)))
          (br_if $ks (i32.lt_u (local.get $k) (i32.const 4))))
        (f32.store (i32.add (local.get $dst)
            (i32.mul (i32.const 4)
              (i32.add (i32.mul (local.get $col) (i32.const 4))
                (local.get $row))))
          (f32.demote_f64 (local.get $acc)))
        (local.set $row (i32.add (local.get $row) (i32.const 1)))
        (br_if $rows (i32.lt_u (local.get $row) (i32.const 4))))
      (local.set $col (i32.add (local.get $col) (i32.const 1)))
      (br_if $cols (i32.lt_u (local.get $col) (i32.const 4)))))

  ;; top = top * m, which is what every glMultMatrix-shaped entry point does
  ;; (lib/gl-compat.js:465). The destination aliases the left operand, so the
  ;; product is formed in scratch and copied back.
  (func $gl_mtx_apply (param $b i32) (param $m i32)
    (local $top i32) (local $scratch i32)
    (local.set $top (call $gl_mtx_top (local.get $b)))
    (local.set $scratch (i32.add (local.get $b) (i32.const 8224)))
    (call $gl_mtx_mul_into (local.get $scratch) (local.get $top) (local.get $m))
    (memory.copy (local.get $top) (local.get $scratch) (i32.const 64)))

  ;; The staging matrix a caller fills before asking for a load or a multiply.
  (func $gl_mtx_staging (param $b i32) (result i32)
    (i32.add (local.get $b) (i32.const 8288)))

  (func $gl_mtx_set_mode (param $mode i32)
    (if (i32.or (i32.eq (local.get $mode) (i32.const 0x1700))
        (i32.or (i32.eq (local.get $mode) (i32.const 0x1701))
          (i32.eq (local.get $mode) (i32.const 0x1702))))
      (then (i32.store (call $gl_mtx_block) (local.get $mode)))))

  (func $gl_mtx_set_active_texture (param $unit i32)
    (i32.store offset=4 (call $gl_mtx_block)
      (i32.ne (local.get $unit) (i32.const 0))))

  (func $gl_mtx_load_identity
    (call $gl_mtx_identity_at (call $gl_mtx_top (call $gl_mtx_block))))

  (func $gl_mtx_load (param $src i32)
    (memory.copy (call $gl_mtx_top (call $gl_mtx_block))
      (local.get $src) (i32.const 64)))

  (func $gl_mtx_mult (param $src i32)
    (call $gl_mtx_apply (call $gl_mtx_block) (local.get $src)))

  ;; Push duplicates the top, as GL does. At the cap it latches
  ;; GL_STACK_OVERFLOW (0x0503) and changes nothing.
  (func $gl_mtx_push
    (local $b i32) (local $s i32) (local $d i32) (local $base i32)
    (local.set $b (call $gl_mtx_block))
    (local.set $s (call $gl_mtx_sel (local.get $b)))
    (local.set $d (i32.load (call $gl_mtx_depth_addr (local.get $b) (local.get $s))))
    (if (i32.ge_u (local.get $d) (i32.const 31))
      (then
        (i32.store offset=24 (local.get $b) (i32.const 0x0503))
        (return)))
    (local.set $base (call $gl_mtx_base (local.get $b) (local.get $s)))
    (memory.copy
      (i32.add (local.get $base) (i32.mul (i32.const 64)
        (i32.add (local.get $d) (i32.const 1))))
      (i32.add (local.get $base) (i32.mul (i32.const 64) (local.get $d)))
      (i32.const 64))
    (i32.store (call $gl_mtx_depth_addr (local.get $b) (local.get $s))
      (i32.add (local.get $d) (i32.const 1))))

  ;; Pop refuses to empty the stack, latching GL_STACK_UNDERFLOW (0x0504).
  ;; lib/gl-compat.js:1362 refuses the same way, without the error.
  (func $gl_mtx_pop
    (local $b i32) (local $s i32) (local $d i32)
    (local.set $b (call $gl_mtx_block))
    (local.set $s (call $gl_mtx_sel (local.get $b)))
    (local.set $d (i32.load (call $gl_mtx_depth_addr (local.get $b) (local.get $s))))
    (if (i32.eqz (local.get $d))
      (then
        (i32.store offset=24 (local.get $b) (i32.const 0x0504))
        (return)))
    (i32.store (call $gl_mtx_depth_addr (local.get $b) (local.get $s))
      (i32.sub (local.get $d) (i32.const 1))))

  ;; The attribute stack. Address of frame $i.
  (func $gl_mtx_attrib_frame (param $b i32) (param $i i32) (result i32)
    (i32.add (local.get $b)
      (i32.add (i32.const 9040) (i32.mul (local.get $i) (i32.const 112)))))

  ;; glPushAttrib. Saves the state listed in the header -- which is the state
  ;; lib/gl-compat.js:709-720 saves, no more -- and records the mask beside it.
  ;;
  ;; At the cap this latches GL_STACK_OVERFLOW and changes nothing, exactly as
  ;; $gl_mtx_push does. GL's own required minimum depth is 16 and that is the
  ;; cap here; the JS has no cap, so a 17th push is the one place the two stop
  ;; agreeing, and it is the place where real GL stops agreeing with the JS too.
  (func $gl_mtx_push_attrib (param $mask i32)
    (local $b i32) (local $d i32) (local $f i32)
    (local.set $b (call $gl_mtx_block))
    (local.set $d (i32.load offset=9032 (local.get $b)))
    (if (i32.ge_u (local.get $d) (i32.const 16))
      (then
        (i32.store offset=24 (local.get $b) (i32.const 0x0503))
        ;; And this one latches UNTRUSTED as well, unlike a matrix overflow.
        ;; A dropped push is not a dropped operation: the pop that matches it
        ;; still arrives, and it restores the frame belonging to some outer
        ;; nesting level. Everything after that point is built from state the
        ;; app never asked for, so no descriptor from this block can be
        ;; trusted again.
        (call $gl_mtx_untrusted (local.get $b) (i32.const 76))
        (return)))
    (local.set $f (call $gl_mtx_attrib_frame (local.get $b) (local.get $d)))
    (i32.store offset=0 (local.get $f) (local.get $mask))
    (i32.store offset=4 (local.get $f) (i32.load offset=4 (local.get $b)))
    (memory.copy (i32.add (local.get $f) (i32.const 8))
      (i32.add (local.get $b) (i32.const 8352)) (i32.const 16))
    (memory.copy (i32.add (local.get $f) (i32.const 24))
      (i32.add (local.get $b) (i32.const 8880)) (i32.const 80))
    (i32.store offset=9032 (local.get $b) (i32.add (local.get $d) (i32.const 1))))

  ;; glPopAttrib. An empty stack is a no-op that latches GL_STACK_UNDERFLOW --
  ;; lib/gl-compat.js:724-725 returns silently on the same condition, and the
  ;; error word is diagnostic only, so the two behave identically.
  (func $gl_mtx_pop_attrib
    (local $b i32) (local $d i32) (local $f i32)
    (local.set $b (call $gl_mtx_block))
    (local.set $d (i32.load offset=9032 (local.get $b)))
    (if (i32.eqz (local.get $d))
      (then
        (i32.store offset=24 (local.get $b) (i32.const 0x0504))
        (return)))
    (local.set $d (i32.sub (local.get $d) (i32.const 1)))
    (local.set $f (call $gl_mtx_attrib_frame (local.get $b) (local.get $d)))
    (i32.store offset=4 (local.get $b) (i32.load offset=4 (local.get $f)))
    (memory.copy (i32.add (local.get $b) (i32.const 8352))
      (i32.add (local.get $f) (i32.const 8)) (i32.const 16))
    (memory.copy (i32.add (local.get $b) (i32.const 8880))
      (i32.add (local.get $f) (i32.const 24)) (i32.const 80))
    (i32.store offset=9032 (local.get $b) (local.get $d)))

  ;; The generated factors below are built in the staging slot as f32, which is
  ;; what JS does (each helper returns a Float32Array), then multiplied in.

  (func $gl_mtx_translate (param $x f64) (param $y f64) (param $z f64)
    (local $b i32) (local $m i32)
    (local.set $b (call $gl_mtx_block))
    (local.set $m (call $gl_mtx_staging (local.get $b)))
    (call $gl_mtx_identity_at (local.get $m))
    (f32.store offset=48 (local.get $m) (f32.demote_f64 (local.get $x)))
    (f32.store offset=52 (local.get $m) (f32.demote_f64 (local.get $y)))
    (f32.store offset=56 (local.get $m) (f32.demote_f64 (local.get $z)))
    (call $gl_mtx_apply (local.get $b) (local.get $m)))

  (func $gl_mtx_scale (param $x f64) (param $y f64) (param $z f64)
    (local $b i32) (local $m i32)
    (local.set $b (call $gl_mtx_block))
    (local.set $m (call $gl_mtx_staging (local.get $b)))
    (call $gl_mtx_identity_at (local.get $m))
    (f32.store offset=0 (local.get $m) (f32.demote_f64 (local.get $x)))
    (f32.store offset=20 (local.get $m) (f32.demote_f64 (local.get $y)))
    (f32.store offset=40 (local.get $m) (f32.demote_f64 (local.get $z)))
    (call $gl_mtx_apply (local.get $b) (local.get $m)))

  (func $gl_mtx_rotate (param $angle f64) (param $x f64) (param $y f64) (param $z f64)
    (local $b i32) (local $m i32) (local $len f64)
    (local $c f64) (local $s f64) (local $t f64) (local $r f64)
    (local.set $b (call $gl_mtx_block))
    (local.set $m (call $gl_mtx_staging (local.get $b)))
    (local.set $len (f64.sqrt (f64.add
      (f64.mul (local.get $x) (local.get $x))
      (f64.add (f64.mul (local.get $y) (local.get $y))
        (f64.mul (local.get $z) (local.get $z))))))
    ;; `|| 1` in the JS: a zero-length axis leaves the components alone.
    (if (f64.eq (local.get $len) (f64.const 0))
      (then (local.set $len (f64.const 1))))
    (local.set $x (f64.div (local.get $x) (local.get $len)))
    (local.set $y (f64.div (local.get $y) (local.get $len)))
    (local.set $z (f64.div (local.get $z) (local.get $len)))
    (local.set $r (f64.div (f64.mul (local.get $angle)
      (f64.const 3.141592653589793)) (f64.const 180)))
    (local.set $c (call $host_math_cos (local.get $r)))
    (local.set $s (call $host_math_sin (local.get $r)))
    (local.set $t (f64.sub (f64.const 1) (local.get $c)))
    (memory.fill (local.get $m) (i32.const 0) (i32.const 64))
    (f32.store offset=0 (local.get $m) (f32.demote_f64 (f64.add
      (f64.mul (f64.mul (local.get $x) (local.get $x)) (local.get $t))
      (local.get $c))))
    (f32.store offset=4 (local.get $m) (f32.demote_f64 (f64.add
      (f64.mul (f64.mul (local.get $y) (local.get $x)) (local.get $t))
      (f64.mul (local.get $z) (local.get $s)))))
    (f32.store offset=8 (local.get $m) (f32.demote_f64 (f64.sub
      (f64.mul (f64.mul (local.get $z) (local.get $x)) (local.get $t))
      (f64.mul (local.get $y) (local.get $s)))))
    (f32.store offset=16 (local.get $m) (f32.demote_f64 (f64.sub
      (f64.mul (f64.mul (local.get $x) (local.get $y)) (local.get $t))
      (f64.mul (local.get $z) (local.get $s)))))
    (f32.store offset=20 (local.get $m) (f32.demote_f64 (f64.add
      (f64.mul (f64.mul (local.get $y) (local.get $y)) (local.get $t))
      (local.get $c))))
    (f32.store offset=24 (local.get $m) (f32.demote_f64 (f64.add
      (f64.mul (f64.mul (local.get $z) (local.get $y)) (local.get $t))
      (f64.mul (local.get $x) (local.get $s)))))
    (f32.store offset=32 (local.get $m) (f32.demote_f64 (f64.add
      (f64.mul (f64.mul (local.get $x) (local.get $z)) (local.get $t))
      (f64.mul (local.get $y) (local.get $s)))))
    (f32.store offset=36 (local.get $m) (f32.demote_f64 (f64.sub
      (f64.mul (f64.mul (local.get $y) (local.get $z)) (local.get $t))
      (f64.mul (local.get $x) (local.get $s)))))
    (f32.store offset=40 (local.get $m) (f32.demote_f64 (f64.add
      (f64.mul (f64.mul (local.get $z) (local.get $z)) (local.get $t))
      (local.get $c))))
    (f32.store offset=60 (local.get $m) (f32.const 1))
    (call $gl_mtx_apply (local.get $b) (local.get $m)))

  (func $gl_mtx_frustum (param $l f64) (param $r f64) (param $bo f64)
      (param $t f64) (param $n f64) (param $f f64)
    (local $b i32) (local $m i32)
    (local.set $b (call $gl_mtx_block))
    (local.set $m (call $gl_mtx_staging (local.get $b)))
    (memory.fill (local.get $m) (i32.const 0) (i32.const 64))
    (f32.store offset=0 (local.get $m) (f32.demote_f64
      (f64.div (f64.mul (f64.const 2) (local.get $n))
        (f64.sub (local.get $r) (local.get $l)))))
    (f32.store offset=20 (local.get $m) (f32.demote_f64
      (f64.div (f64.mul (f64.const 2) (local.get $n))
        (f64.sub (local.get $t) (local.get $bo)))))
    (f32.store offset=32 (local.get $m) (f32.demote_f64
      (f64.div (f64.add (local.get $r) (local.get $l))
        (f64.sub (local.get $r) (local.get $l)))))
    (f32.store offset=36 (local.get $m) (f32.demote_f64
      (f64.div (f64.add (local.get $t) (local.get $bo))
        (f64.sub (local.get $t) (local.get $bo)))))
    (f32.store offset=40 (local.get $m) (f32.demote_f64
      (f64.neg (f64.div (f64.add (local.get $f) (local.get $n))
        (f64.sub (local.get $f) (local.get $n))))))
    (f32.store offset=44 (local.get $m) (f32.const -1))
    (f32.store offset=56 (local.get $m) (f32.demote_f64
      (f64.neg (f64.div
        (f64.mul (f64.mul (f64.const 2) (local.get $f)) (local.get $n))
        (f64.sub (local.get $f) (local.get $n))))))
    (call $gl_mtx_apply (local.get $b) (local.get $m)))

  (func $gl_mtx_ortho (param $l f64) (param $r f64) (param $bo f64)
      (param $t f64) (param $n f64) (param $f f64)
    (local $b i32) (local $m i32)
    (local.set $b (call $gl_mtx_block))
    (local.set $m (call $gl_mtx_staging (local.get $b)))
    (call $gl_mtx_identity_at (local.get $m))
    (f32.store offset=0 (local.get $m) (f32.demote_f64
      (f64.div (f64.const 2) (f64.sub (local.get $r) (local.get $l)))))
    (f32.store offset=20 (local.get $m) (f32.demote_f64
      (f64.div (f64.const 2) (f64.sub (local.get $t) (local.get $bo)))))
    (f32.store offset=40 (local.get $m) (f32.demote_f64
      (f64.div (f64.const -2) (f64.sub (local.get $f) (local.get $n)))))
    (f32.store offset=48 (local.get $m) (f32.demote_f64
      (f64.neg (f64.div (f64.add (local.get $r) (local.get $l))
        (f64.sub (local.get $r) (local.get $l))))))
    (f32.store offset=52 (local.get $m) (f32.demote_f64
      (f64.neg (f64.div (f64.add (local.get $t) (local.get $bo))
        (f64.sub (local.get $t) (local.get $bo))))))
    (f32.store offset=56 (local.get $m) (f32.demote_f64
      (f64.neg (f64.div (f64.add (local.get $f) (local.get $n))
        (f64.sub (local.get $f) (local.get $n))))))
    (call $gl_mtx_apply (local.get $b) (local.get $m)))

  ;; The GLU helpers. These are not GL entry points at all -- they are library
  ;; functions that compose the primitives above -- which is why they were the
  ;; first things this mirror could not follow. Each is written here as the
  ;; composition lib/gl-compat.js performs, not as an independent derivation,
  ;; so the two cannot drift apart in the algebra.

  ;; gluPerspective (lib/gl-compat.js:185-190): a symmetric frustum.
  (func $gl_mtx_perspective (param $fovy f64) (param $aspect f64)
      (param $n f64) (param $f f64)
    (local $top f64) (local $right f64)
    (local.set $top (f64.mul (local.get $n)
      (call $host_math_tan (f64.div (f64.mul (local.get $fovy)
        (f64.const 3.141592653589793)) (f64.const 360)))))
    (local.set $right (f64.mul (local.get $top) (local.get $aspect)))
    (call $gl_mtx_frustum (f64.neg (local.get $right)) (local.get $right)
      (f64.neg (local.get $top)) (local.get $top) (local.get $n) (local.get $f)))

  ;; gluOrtho2D (:1418-1420): an ortho with GL's default -1..1 depth range.
  (func $gl_mtx_ortho2d (param $l f64) (param $r f64) (param $bo f64) (param $t f64)
    (call $gl_mtx_ortho (local.get $l) (local.get $r) (local.get $bo)
      (local.get $t) (f64.const -1) (f64.const 1)))

  ;; gluLookAt (:191-212). Builds a view basis directly rather than through the
  ;; factor helpers, so this is the one GLU function with arithmetic of its own.
  ;;
  ;; Its length normalizations are `Math.hypot(...) || 1` in the JS. This uses
  ;; sqrt of the sum of squares instead: hypot is written to survive operands
  ;; whose squares overflow or underflow f64, which a camera basis vector
  ;; cannot do -- these are eye-minus-centre distances and an up vector. The
  ;; two agree to the last bit across the ordinary range and differ only where
  ;; the scene is already meaningless, which is the trade this comment exists
  ;; to record rather than hide.
  (func $gl_mtx_look_at
      (param $ex f64) (param $ey f64) (param $ez f64)
      (param $cx f64) (param $cy f64) (param $cz f64)
      (param $ux f64) (param $uy f64) (param $uz f64)
    (local $b i32) (local $m i32) (local $len f64)
    (local $fx f64) (local $fy f64) (local $fz f64)
    (local $sx f64) (local $sy f64) (local $sz f64)
    (local $vx f64) (local $vy f64) (local $vz f64)
    (local.set $b (call $gl_mtx_block))
    (local.set $m (call $gl_mtx_staging (local.get $b)))
    (local.set $fx (f64.sub (local.get $cx) (local.get $ex)))
    (local.set $fy (f64.sub (local.get $cy) (local.get $ey)))
    (local.set $fz (f64.sub (local.get $cz) (local.get $ez)))
    (local.set $len (call $gl_mtx_length
      (local.get $fx) (local.get $fy) (local.get $fz)))
    (local.set $fx (f64.div (local.get $fx) (local.get $len)))
    (local.set $fy (f64.div (local.get $fy) (local.get $len)))
    (local.set $fz (f64.div (local.get $fz) (local.get $len)))
    ;; s = f x up
    (local.set $sx (f64.sub (f64.mul (local.get $fy) (local.get $uz))
      (f64.mul (local.get $fz) (local.get $uy))))
    (local.set $sy (f64.sub (f64.mul (local.get $fz) (local.get $ux))
      (f64.mul (local.get $fx) (local.get $uz))))
    (local.set $sz (f64.sub (f64.mul (local.get $fx) (local.get $uy))
      (f64.mul (local.get $fy) (local.get $ux))))
    (local.set $len (call $gl_mtx_length
      (local.get $sx) (local.get $sy) (local.get $sz)))
    (local.set $sx (f64.div (local.get $sx) (local.get $len)))
    (local.set $sy (f64.div (local.get $sy) (local.get $len)))
    (local.set $sz (f64.div (local.get $sz) (local.get $len)))
    ;; u = s x f, already unit because s and f are orthonormal.
    (local.set $vx (f64.sub (f64.mul (local.get $sy) (local.get $fz))
      (f64.mul (local.get $sz) (local.get $fy))))
    (local.set $vy (f64.sub (f64.mul (local.get $sz) (local.get $fx))
      (f64.mul (local.get $sx) (local.get $fz))))
    (local.set $vz (f64.sub (f64.mul (local.get $sx) (local.get $fy))
      (f64.mul (local.get $sy) (local.get $fx))))
    (memory.fill (local.get $m) (i32.const 0) (i32.const 64))
    (f32.store offset=0 (local.get $m) (f32.demote_f64 (local.get $sx)))
    (f32.store offset=4 (local.get $m) (f32.demote_f64 (local.get $vx)))
    (f32.store offset=8 (local.get $m) (f32.demote_f64 (f64.neg (local.get $fx))))
    (f32.store offset=16 (local.get $m) (f32.demote_f64 (local.get $sy)))
    (f32.store offset=20 (local.get $m) (f32.demote_f64 (local.get $vy)))
    (f32.store offset=24 (local.get $m) (f32.demote_f64 (f64.neg (local.get $fy))))
    (f32.store offset=32 (local.get $m) (f32.demote_f64 (local.get $sz)))
    (f32.store offset=36 (local.get $m) (f32.demote_f64 (local.get $vz)))
    (f32.store offset=40 (local.get $m) (f32.demote_f64 (f64.neg (local.get $fz))))
    (f32.store offset=48 (local.get $m) (f32.demote_f64 (f64.neg (f64.add
      (f64.mul (local.get $sx) (local.get $ex))
      (f64.add (f64.mul (local.get $sy) (local.get $ey))
        (f64.mul (local.get $sz) (local.get $ez)))))))
    (f32.store offset=52 (local.get $m) (f32.demote_f64 (f64.neg (f64.add
      (f64.mul (local.get $vx) (local.get $ex))
      (f64.add (f64.mul (local.get $vy) (local.get $ey))
        (f64.mul (local.get $vz) (local.get $ez)))))))
    (f32.store offset=56 (local.get $m) (f32.demote_f64 (f64.add
      (f64.mul (local.get $fx) (local.get $ex))
      (f64.add (f64.mul (local.get $fy) (local.get $ey))
        (f64.mul (local.get $fz) (local.get $ez))))))
    (f32.store offset=60 (local.get $m) (f32.const 1))
    (call $gl_mtx_apply (local.get $b) (local.get $m)))

  ;; `Math.hypot(x, y, z) || 1` -- the `|| 1` matters, and not only for a zero
  ;; vector: it is what keeps a degenerate camera (eye == centre, or an up
  ;; vector parallel to the view direction) from dividing by zero and filling
  ;; the matrix with NaN, which would then poison every later multiply.
  (func $gl_mtx_length (param $x f64) (param $y f64) (param $z f64) (result f64)
    (local $len f64)
    (local.set $len (f64.sqrt (f64.add (f64.mul (local.get $x) (local.get $x))
      (f64.add (f64.mul (local.get $y) (local.get $y))
        (f64.mul (local.get $z) (local.get $z))))))
    (select (f64.const 1) (local.get $len)
      (i32.or (f64.eq (local.get $len) (f64.const 0))
        (f64.ne (local.get $len) (local.get $len)))))

  ;; Lighting, material and fog. These are pure state: unlike the matrices
  ;; there is no arithmetic to get wrong, with one exception that matters --
  ;; glLightfv(GL_POSITION) transforms its argument by the MODELVIEW matrix at
  ;; the time of the call, and by the modelview specifically, not by whichever
  ;; stack glMatrixMode happens to have selected. lib/gl-compat.js:645 reaches
  ;; past _stack() into matrices[MODELVIEW] for exactly that reason, and a
  ;; mirror that used the selected stack would place every light wrongly in any
  ;; app that sets a light while a texture or projection matrix is current.

  ;; Copy four f32 from $src to $dst.
  (func $gl_mtx_copy4 (param $dst i32) (param $src i32)
    (memory.copy (local.get $dst) (local.get $src) (i32.const 16)))

  (func $gl_mtx_light_slot (param $b i32) (param $index i32) (result i32)
    (i32.add (local.get $b)
      (i32.add (i32.const 8368) (i32.mul (local.get $index) (i32.const 64)))))

  ;; transform4 (lib/gl-compat.js:193-200): a column-major matrix times a
  ;; 4-vector, accumulated in f64 and demoted on store like everything else.
  (func $gl_mtx_transform4 (param $dst i32) (param $m i32) (param $v i32)
    (local $row i32) (local $k i32) (local $acc f64)
    (local.set $row (i32.const 0))
    (loop $rows
      (local.set $acc (f64.const 0))
      (local.set $k (i32.const 0))
      (loop $ks
        (local.set $acc (f64.add (local.get $acc)
          (f64.mul
            (f64.promote_f32 (f32.load (i32.add (local.get $m)
              (i32.mul (i32.const 4)
                (i32.add (i32.mul (local.get $k) (i32.const 4))
                  (local.get $row))))))
            (f64.promote_f32 (f32.load (i32.add (local.get $v)
              (i32.mul (local.get $k) (i32.const 4))))))))
        (local.set $k (i32.add (local.get $k) (i32.const 1)))
        (br_if $ks (i32.lt_u (local.get $k) (i32.const 4))))
      (f32.store (i32.add (local.get $dst) (i32.mul (local.get $row) (i32.const 4)))
        (f32.demote_f64 (local.get $acc)))
      (local.set $row (i32.add (local.get $row) (i32.const 1)))
      (br_if $rows (i32.lt_u (local.get $row) (i32.const 4)))))

  ;; glLightfv. $light is the GL enum (GL_LIGHT0 + n); out-of-range lights are
  ;; ignored, as they are in the JS. $values points at four f32.
  (func $gl_mtx_set_light (param $light i32) (param $pname i32) (param $values i32)
    (local $b i32) (local $index i32) (local $slot i32)
    (local.set $b (call $gl_mtx_block))
    (local.set $index (i32.sub (local.get $light) (i32.const 0x4000)))
    (if (i32.ge_u (local.get $index) (i32.const 8)) (then (return)))
    (local.set $slot (call $gl_mtx_light_slot (local.get $b) (local.get $index)))
    ;; GL_POSITION 0x1203, AMBIENT 0x1200, DIFFUSE 0x1201, SPECULAR 0x1202.
    (if (i32.eq (local.get $pname) (i32.const 0x1203))
      (then
        ;; Stack 0 is the modelview, whatever the current matrix mode is.
        (call $gl_mtx_transform4 (local.get $slot)
          (i32.add (call $gl_mtx_base (local.get $b) (i32.const 0))
            (i32.mul (i32.const 64) (i32.load offset=8 (local.get $b))))
          (local.get $values))
        (return)))
    (if (i32.eq (local.get $pname) (i32.const 0x1200))
      (then (call $gl_mtx_copy4 (i32.add (local.get $slot) (i32.const 16))
        (local.get $values)) (return)))
    (if (i32.eq (local.get $pname) (i32.const 0x1201))
      (then (call $gl_mtx_copy4 (i32.add (local.get $slot) (i32.const 32))
        (local.get $values)) (return)))
    (if (i32.eq (local.get $pname) (i32.const 0x1202))
      (then (call $gl_mtx_copy4 (i32.add (local.get $slot) (i32.const 48))
        (local.get $values)))))

  ;; glLightModelfv(GL_LIGHT_MODEL_AMBIENT).
  (func $gl_mtx_set_light_model_ambient (param $values i32)
    (call $gl_mtx_copy4 (i32.add (call $gl_mtx_block) (i32.const 8352))
      (local.get $values)))

  ;; glMaterialfv. GL_AMBIENT_AND_DIFFUSE writes both, which is why these are
  ;; independent tests rather than a chain.
  (func $gl_mtx_set_material (param $pname i32) (param $values i32)
    (local $b i32) (local $v f32)
    (local.set $b (call $gl_mtx_block))
    (if (i32.or (i32.eq (local.get $pname) (i32.const 0x1200))
        (i32.eq (local.get $pname) (i32.const 0x1602)))
      (then (call $gl_mtx_copy4 (i32.add (local.get $b) (i32.const 8880))
        (local.get $values))))
    (if (i32.or (i32.eq (local.get $pname) (i32.const 0x1201))
        (i32.eq (local.get $pname) (i32.const 0x1602)))
      (then (call $gl_mtx_copy4 (i32.add (local.get $b) (i32.const 8896))
        (local.get $values))))
    (if (i32.eq (local.get $pname) (i32.const 0x1202))
      (then (call $gl_mtx_copy4 (i32.add (local.get $b) (i32.const 8912))
        (local.get $values))))
    (if (i32.eq (local.get $pname) (i32.const 0x1600))
      (then (call $gl_mtx_copy4 (i32.add (local.get $b) (i32.const 8928))
        (local.get $values))))
    (if (i32.eq (local.get $pname) (i32.const 0x1601))
      (then
        ;; Clamped to [0, 128], as the JS does. f32.min/f32.max propagate NaN
        ;; rather than returning the other operand, so a NaN shininess stays
        ;; NaN here and in JS alike -- Math.max(0, NaN) is also NaN.
        (local.set $v (f32.load (local.get $values)))
        (f32.store offset=8944 (local.get $b)
          (f32.min (f32.const 128) (f32.max (f32.const 0) (local.get $v)))))))

  ;; glFog*(GL_FOG_MODE, ...), with the mode already decoded to an integer.
  (func $gl_mtx_set_fog_mode (param $mode i32)
    (i32.store offset=8960 (call $gl_mtx_block) (local.get $mode)))

  ;; glFogf / glFogfv, for every parameter but the mode.
  (func $gl_mtx_set_fog (param $pname i32) (param $values i32)
    (local $b i32)
    (local.set $b (call $gl_mtx_block))
    ;; GL_FOG_MODE 0x0B65, DENSITY 0x0B62, START 0x0B63, END 0x0B64, COLOR 0x0B66
    ;; GL_FOG_MODE is NOT handled here. The JS takes values[0]|0, and whether
    ;; the bytes at $values are an int (glFogi) or a float (glFogf) depends on
    ;; which entry point the guest called -- reading them the wrong way gives
    ;; a garbage mode rather than a wrong-looking one. $gl_mtx_set_fog_mode
    ;; takes the already-decoded integer instead, so the ambiguity stays with
    ;; the caller, which is the only place that knows.
    (if (i32.eq (local.get $pname) (i32.const 0x0B65)) (then (unreachable)))
    (if (i32.eq (local.get $pname) (i32.const 0x0B62))
      (then
        (f32.store offset=8964 (local.get $b)
          (f32.max (f32.const 0) (f32.load (local.get $values))))
        (return)))
    (if (i32.eq (local.get $pname) (i32.const 0x0B63))
      (then (f32.store offset=8968 (local.get $b)
        (f32.load (local.get $values))) (return)))
    (if (i32.eq (local.get $pname) (i32.const 0x0B64))
      (then (f32.store offset=8972 (local.get $b)
        (f32.load (local.get $values))) (return)))
    (if (i32.eq (local.get $pname) (i32.const 0x0B66))
      (then (call $gl_mtx_copy4 (i32.add (local.get $b) (i32.const 8976))
        (local.get $values)))))

  ;; ---- the encoder's observer -------------------------------------------
  ;;
  ;; $gl_wat_encode_call hands every GL call here before recording it. This
  ;; OBSERVES: it updates the WAT state and returns, and the call still goes
  ;; on to the stream exactly as before, so the WebGL path is untouched and
  ;; this cannot change what anything draws. That is the whole point of the
  ;; step -- the mirror has to be shown correct on real apps before anything
  ;; is allowed to depend on it.
  ;;
  ;; THE HONEST PART. One family of call moves this state and is not mirrored
  ;; here: glPushAttrib/glPopAttrib save and restore the lighting and material
  ;; state wholesale (lib/gl-compat.js:695-719), so following them means owning
  ;; a copy of the attribute stack rather than composing a matrix.
  ;; gluPerspective/gluLookAt/gluOrtho2D used to be in this list and are now
  ;; mirrored below, written as the compositions gl-compat performs so the two
  ;; cannot drift apart in the algebra. Rather than let the block drift
  ;; silently away from the truth, what is left latches the opcode into the
  ;; UNTRUSTED field at +28. A consumer must refuse to lower a draw from a
  ;; block whose UNTRUSTED field is nonzero; a test can assert it stayed zero
  ;; for a given app, which turns "we think we cover this app" into a measured
  ;; claim. Clearing it is deliberate and belongs to whoever implements the
  ;; missing family.
  ;;
  ;; Opcodes are the CALLS index from lib/gl-compat.js:65, the same numbering
  ;; $gl_arg_words and $gl_is_barrier are generated against, and the same bare
  ;; integers the rest of this encoder path already uses. A reordering of that
  ;; array breaks every one of them together, which is why it is append-only
  ;; in practice.
  ;;
  ;; Stack layout matches the rest of the encoder: argument i is at
  ;; offset 4 + i*4, and a GLdouble occupies two slots.

  (func $gl_mtx_untrusted (param $b i32) (param $op i32)
    (if (i32.eqz (i32.load offset=28 (local.get $b)))
      (then (i32.store offset=28 (local.get $b) (local.get $op)))))

  ;; A scalar setter has to present four f32 to the vector setters, because
  ;; that is the shape glMaterialfv and friends take. Only element 0 is read
  ;; for the scalar pnames, but the other three are cleared so a stale value
  ;; from an earlier call can never be mistaken for data.
  (func $gl_mtx_scalar (param $b i32) (param $v f32) (result i32)
    (call $gl_mtx_set4 (i32.add (local.get $b) (i32.const 8992))
      (local.get $v) (f32.const 0) (f32.const 0) (f32.const 0))
    (i32.add (local.get $b) (i32.const 8992)))

  (func $gl_mtx_observe (param $op i32) (param $stack i32)
    (local $b i32)
    ;; Cheapest possible rejection of the common case: almost every GL call in
    ;; a frame is a vertex, a texture bind or a state toggle, none of which
    ;; reach this state at all. Everything handled below is in 32..41 (the
    ;; matrix ops), 7 and 20 (depth range and viewport), or a short list above
    ;; 58.
    ;;
    ;; The upper bound goes first because it is what the hottest call in a
    ;; frame hits: the packed draw is opcode 0x10000, far above every CALLS
    ;; index, and without this it passes the range test below and walks the
    ;; whole compare chain. Measured on Quake II's menu, that is 530916 calls
    ;; a run taking the long way to do nothing.
    ;; 109 glMultMatrixf is the one transform op appended past that range.
    (if (i32.and (i32.gt_u (local.get $op) (i32.const 107))
                 (i32.ne (local.get $op) (i32.const 109))) (then (return)))
    (if (i32.and
          (i32.and (i32.or (i32.lt_u (local.get $op) (i32.const 32))
              (i32.gt_u (local.get $op) (i32.const 41)))
            (i32.lt_u (local.get $op) (i32.const 59)))
          (i32.and (i32.ne (local.get $op) (i32.const 7))
            (i32.ne (local.get $op) (i32.const 20))))
      (then (return)))
    (local.set $b (call $gl_mtx_block))

    ;; 20 glViewport (4 GLint), 7 glDepthRange (2 GLclampd, so two words each).
    ;; Neither is transform state, but DFX1 wants both, and this is the block
    ;; the descriptor gets built from.
    (if (i32.eq (local.get $op) (i32.const 20))
      (then
        (i32.store offset=9008 (local.get $b) (i32.load offset=4 (local.get $stack)))
        (i32.store offset=9012 (local.get $b) (i32.load offset=8 (local.get $stack)))
        (i32.store offset=9016 (local.get $b) (i32.load offset=12 (local.get $stack)))
        (i32.store offset=9020 (local.get $b) (i32.load offset=16 (local.get $stack)))
        (return)))
    (if (i32.eq (local.get $op) (i32.const 7))
      (then
        (f32.store offset=9024 (local.get $b)
          (f32.demote_f64 (f64.load offset=4 (local.get $stack))))
        (f32.store offset=9028 (local.get $b)
          (f32.demote_f64 (f64.load offset=12 (local.get $stack))))
        (return)))

    ;; 35 glMatrixMode, 33 glLoadIdentity, 38 glPushMatrix, 37 glPopMatrix
    (if (i32.eq (local.get $op) (i32.const 35))
      (then (call $gl_mtx_set_mode (i32.load offset=4 (local.get $stack)))
        (return)))
    (if (i32.eq (local.get $op) (i32.const 33))
      (then (call $gl_mtx_load_identity) (return)))
    (if (i32.eq (local.get $op) (i32.const 38))
      (then (call $gl_mtx_push) (return)))
    (if (i32.eq (local.get $op) (i32.const 37))
      (then (call $gl_mtx_pop) (return)))

    ;; 34 glLoadMatrixf takes a GUEST pointer to 16 floats.
    (if (i32.eq (local.get $op) (i32.const 34))
      (then (call $gl_mtx_load (call $g2w (i32.load offset=4 (local.get $stack))))
        (return)))
    ;; 109 glMultMatrixf, the same guest pointer, multiplied onto the top.
    (if (i32.eq (local.get $op) (i32.const 109))
      (then (call $gl_mtx_mult (call $g2w (i32.load offset=4 (local.get $stack))))
        (return)))

    ;; 41 glTranslatef, 40 glScalef, 39 glRotatef -- GLfloat arguments.
    (if (i32.eq (local.get $op) (i32.const 41))
      (then (call $gl_mtx_translate
        (f64.promote_f32 (f32.load offset=4 (local.get $stack)))
        (f64.promote_f32 (f32.load offset=8 (local.get $stack)))
        (f64.promote_f32 (f32.load offset=12 (local.get $stack)))) (return)))
    (if (i32.eq (local.get $op) (i32.const 40))
      (then (call $gl_mtx_scale
        (f64.promote_f32 (f32.load offset=4 (local.get $stack)))
        (f64.promote_f32 (f32.load offset=8 (local.get $stack)))
        (f64.promote_f32 (f32.load offset=12 (local.get $stack)))) (return)))
    (if (i32.eq (local.get $op) (i32.const 39))
      (then (call $gl_mtx_rotate
        (f64.promote_f32 (f32.load offset=4 (local.get $stack)))
        (f64.promote_f32 (f32.load offset=8 (local.get $stack)))
        (f64.promote_f32 (f32.load offset=12 (local.get $stack)))
        (f64.promote_f32 (f32.load offset=16 (local.get $stack)))) (return)))

    ;; 32 glFrustum, 36 glOrtho -- GLdouble arguments, two stack slots each.
    (if (i32.eq (local.get $op) (i32.const 32))
      (then (call $gl_mtx_frustum
        (f64.load offset=4 (local.get $stack))
        (f64.load offset=12 (local.get $stack))
        (f64.load offset=20 (local.get $stack))
        (f64.load offset=28 (local.get $stack))
        (f64.load offset=36 (local.get $stack))
        (f64.load offset=44 (local.get $stack))) (return)))
    (if (i32.eq (local.get $op) (i32.const 36))
      (then (call $gl_mtx_ortho
        (f64.load offset=4 (local.get $stack))
        (f64.load offset=12 (local.get $stack))
        (f64.load offset=20 (local.get $stack))
        (f64.load offset=28 (local.get $stack))
        (f64.load offset=36 (local.get $stack))
        (f64.load offset=44 (local.get $stack))) (return)))

    ;; 90 glRotated -- the same operation with GLdouble arguments.
    (if (i32.eq (local.get $op) (i32.const 90))
      (then (call $gl_mtx_rotate
        (f64.load offset=4 (local.get $stack))
        (f64.load offset=12 (local.get $stack))
        (f64.load offset=20 (local.get $stack))
        (f64.load offset=28 (local.get $stack))) (return)))

    ;; 105 glActiveTextureARB(GL_TEXTUREn_ARB) selects the texture matrix
    ;; stack as well as the binding, which is why it is observed here.
    (if (i32.eq (local.get $op) (i32.const 105))
      (then (call $gl_mtx_set_active_texture
        (i32.sub (i32.load offset=4 (local.get $stack)) (i32.const 0x84C0)))
        (return)))

    ;; 67 glLightfv(light, pname, params), 68 glMaterialfv(face, pname,
    ;; params), 69 glLightModelfv(pname, params), 78 glFogfv(pname, params).
    ;; The trailing argument is a guest pointer in every case.
    (if (i32.eq (local.get $op) (i32.const 67))
      (then (call $gl_mtx_set_light
        (i32.load offset=4 (local.get $stack))
        (i32.load offset=8 (local.get $stack))
        (call $g2w (i32.load offset=12 (local.get $stack)))) (return)))
    (if (i32.eq (local.get $op) (i32.const 68))
      (then (call $gl_mtx_set_material
        (i32.load offset=8 (local.get $stack))
        (call $g2w (i32.load offset=12 (local.get $stack)))) (return)))
    (if (i32.eq (local.get $op) (i32.const 69))
      (then (call $gl_mtx_set_light_model_ambient
        (call $g2w (i32.load offset=8 (local.get $stack)))) (return)))
    (if (i32.eq (local.get $op) (i32.const 78))
      (then (call $gl_mtx_set_fog
        (i32.load offset=4 (local.get $stack))
        (call $g2w (i32.load offset=8 (local.get $stack)))) (return)))

    ;; 71 glMaterialf(face, pname, GLfloat), 79 glFogf(pname, GLfloat).
    (if (i32.eq (local.get $op) (i32.const 71))
      (then (call $gl_mtx_set_material
        (i32.load offset=8 (local.get $stack))
        (call $gl_mtx_scalar (local.get $b)
          (f32.load offset=12 (local.get $stack)))) (return)))
    (if (i32.eq (local.get $op) (i32.const 79))
      (then
        ;; GL_FOG_MODE through the float spelling is a mode, not a value.
        (if (i32.eq (i32.load offset=4 (local.get $stack)) (i32.const 0x0B65))
          (then (call $gl_mtx_set_fog_mode
            (i32.trunc_sat_f32_s (f32.load offset=8 (local.get $stack)))))
          (else (call $gl_mtx_set_fog
            (i32.load offset=4 (local.get $stack))
            (call $gl_mtx_scalar (local.get $b)
              (f32.load offset=8 (local.get $stack))))))
        (return)))

    ;; 80 glFogi(pname, GLint) -- the integer spelling, where the mode arrives
    ;; as an int and does not go through the float path at all.
    (if (i32.eq (local.get $op) (i32.const 80))
      (then
        (if (i32.eq (i32.load offset=4 (local.get $stack)) (i32.const 0x0B65))
          (then (call $gl_mtx_set_fog_mode (i32.load offset=8 (local.get $stack))))
          (else (call $gl_mtx_set_fog
            (i32.load offset=4 (local.get $stack))
            (call $gl_mtx_scalar (local.get $b)
              (f32.convert_i32_s (i32.load offset=8 (local.get $stack)))))))
        (return)))

    ;; 59 gluPerspective, 62 gluOrtho2D, 60 gluLookAt -- GLdouble arguments,
    ;; two stack slots each, like glFrustum above.
    (if (i32.eq (local.get $op) (i32.const 59))
      (then (call $gl_mtx_perspective
        (f64.load offset=4 (local.get $stack))
        (f64.load offset=12 (local.get $stack))
        (f64.load offset=20 (local.get $stack))
        (f64.load offset=28 (local.get $stack))) (return)))
    (if (i32.eq (local.get $op) (i32.const 62))
      (then (call $gl_mtx_ortho2d
        (f64.load offset=4 (local.get $stack))
        (f64.load offset=12 (local.get $stack))
        (f64.load offset=20 (local.get $stack))
        (f64.load offset=28 (local.get $stack))) (return)))
    (if (i32.eq (local.get $op) (i32.const 60))
      (then (call $gl_mtx_look_at
        (f64.load offset=4 (local.get $stack))
        (f64.load offset=12 (local.get $stack))
        (f64.load offset=20 (local.get $stack))
        (f64.load offset=28 (local.get $stack))
        (f64.load offset=36 (local.get $stack))
        (f64.load offset=44 (local.get $stack))
        (f64.load offset=52 (local.get $stack))
        (f64.load offset=60 (local.get $stack))
        (f64.load offset=68 (local.get $stack))) (return)))

    ;; 76 glPushAttrib (one GLbitfield), 77 glPopAttrib (no arguments).
    (if (i32.eq (local.get $op) (i32.const 76))
      (then (call $gl_mtx_push_attrib (i32.load offset=4 (local.get $stack)))
        (return)))
    (if (i32.eq (local.get $op) (i32.const 77))
      (then (call $gl_mtx_pop_attrib) (return))))

  ;; Exports. These live here rather than in 13-exports.wat because nothing
  ;; outside a test calls them yet, and a fragment that owns its own test
  ;; surface is one less file to contend for.
  ;;
  ;; A test drives the stacks through these and reads the result straight out
  ;; of linear memory at gl_mtx_top_ptr, which is why no copy-out entry point
  ;; is needed. gl_mtx_staging_ptr is where a caller writes the 16 f32 of a
  ;; matrix before gl_mtx_load_src/gl_mtx_mult_src consumes it.
  (func $gl_mtx_export_top_ptr (export "gl_mtx_top_ptr") (result i32)
    (call $gl_mtx_top (call $gl_mtx_block)))
  (func $gl_mtx_export_stack_ptr (export "gl_mtx_stack_ptr")
      (param $s i32) (param $index i32) (result i32)
    (i32.add (call $gl_mtx_base (call $gl_mtx_block)
        (i32.and (local.get $s) (i32.const 3)))
      (i32.mul (i32.const 64) (i32.and (local.get $index) (i32.const 31)))))
  ;; ---- DFX1, the transform half -------------------------------------------
  ;;
  ;; The first thing on this side that produces a backend-neutral descriptor
  ;; instead of consuming GL calls. It fills ONLY the fields this block owns:
  ;; magic, ABI, viewport, depth range and the three matrices. Flags, register
  ;; indices and every stage field stay zero, because they describe the vertex
  ;; data and the texture stages, which this block knows nothing about. A
  ;; caller completes those. Writing a guess for them would be worse than
  ;; leaving them out: a descriptor is read as authoritative, and a wrong flag
  ;; word draws confidently wrong instead of failing.
  ;;
  ;; Two conversions, both of which are mistakes waiting to happen:
  ;;
  ;; GL matrices are column-major (m[col*4+row]) and DFX1 is row-major, so
  ;; every matrix is TRANSPOSED on the way in. A transposed transform is still
  ;; a valid-looking transform -- it will render a scene, just the wrong one --
  ;; so nothing downstream can catch this, and the test checks a matrix whose
  ;; transpose differs from itself.
  ;;
  ;; GL's modelview goes to DFX1's WORLD slot and view is left identity. This
  ;; is not a free choice, and it is the opposite of what it first looks like.
  ;; Geometry cannot tell the two apart -- it uses the product -- and neither
  ;; can lighting's normal matrix, which inverse-transposes world*view
  ;; (09aj:299-300). The ONLY consumer of the view matrix alone is the DLT1
  ;; light direction (09aj:681-683), and GL has already transformed its light
  ;; positions into EYE space at glLightfv time (:429-434). A modelview parked
  ;; in view would therefore apply it to those a second time: the geometry
  ;; still lands correctly and every light is lit from the wrong place, which
  ;; is the hardest class of wrong picture to attribute. With view identity the
  ;; eye-space direction passes through untouched, which is exactly GL's rule
  ;; that a light is fixed in eye space once specified.
  ;;
  ;; What this does NOT reproduce is D3D's own rule, where a light is fixed in
  ;; WORLD space and re-transformed every draw. There is no split to recover:
  ;; GL has one modelview and does not say which part of it is the camera.
  ;; See docs/gl-software-path-design.md section 5.
  ;;
  ;; Returns 0 and writes nothing when the mirror is untrusted. That is the
  ;; whole point of the latch: a descriptor built from state we know we failed
  ;; to track is a confident wrong answer, and refusing is the only honest one.
  (func $gl_dfx1_transform (param $dst i32) (result i32)
    (local $b i32)
    (if (i32.eqz (local.get $dst)) (then (return (i32.const 0))))
    (local.set $b (call $gl_mtx_block))
    (if (i32.load offset=28 (local.get $b)) (then (return (i32.const 0))))
    (memory.fill (local.get $dst) (i32.const 0) (i32.const 288))
    (i32.store offset=0 (local.get $dst) (i32.const 0x44465831))
    (i32.store offset=4 (local.get $dst) (i32.const 1))
    ;; Viewport and depth range, DFX1 +68..+88.
    (i32.store offset=68 (local.get $dst) (i32.load offset=9008 (local.get $b)))
    (i32.store offset=72 (local.get $dst) (i32.load offset=9012 (local.get $b)))
    (i32.store offset=76 (local.get $dst) (i32.load offset=9016 (local.get $b)))
    (i32.store offset=80 (local.get $dst) (i32.load offset=9020 (local.get $b)))
    (f32.store offset=84 (local.get $dst) (f32.load offset=9024 (local.get $b)))
    (f32.store offset=88 (local.get $dst) (f32.load offset=9028 (local.get $b)))
    ;; The modelview is the world; view stays identity.
    (call $gl_dfx1_transpose_into
      (i32.add (local.get $dst) (i32.const 96)) (call $gl_mtx_stack_top (local.get $b) (i32.const 0)))
    (call $gl_mtx_identity_at (i32.add (local.get $dst) (i32.const 160)))
    (call $gl_dfx1_transpose_into
      (i32.add (local.get $dst) (i32.const 224)) (call $gl_mtx_stack_top (local.get $b) (i32.const 1)))
    (i32.const 1))

  ;; Top of stack $s regardless of which one the mode currently selects --
  ;; the descriptor always wants modelview and projection by name.
  (func $gl_mtx_stack_top (param $b i32) (param $s i32) (result i32)
    (i32.add (call $gl_mtx_base (local.get $b) (local.get $s))
      (i32.mul (i32.const 64)
        (i32.load (call $gl_mtx_depth_addr (local.get $b) (local.get $s))))))

  ;; dst[row*4+col] = src[col*4+row]
  (func $gl_dfx1_transpose_into (param $dst i32) (param $src i32)
    (local $i i32) (local $j i32)
    (local.set $i (i32.const 0))
    (loop $row
      (local.set $j (i32.const 0))
      (loop $col
        (f32.store
          (i32.add (local.get $dst)
            (i32.mul (i32.const 4) (i32.add (i32.mul (local.get $i) (i32.const 4)) (local.get $j))))
          (f32.load
            (i32.add (local.get $src)
              (i32.mul (i32.const 4) (i32.add (i32.mul (local.get $j) (i32.const 4)) (local.get $i))))))
        (local.set $j (i32.add (local.get $j) (i32.const 1)))
        (br_if $col (i32.lt_u (local.get $j) (i32.const 4))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $row (i32.lt_u (local.get $i) (i32.const 4)))))

  ;; Build a DLT1 lighting block (ABI1, 09aj:582-586) from the mirror's lights
  ;; and material. $mask is the set of enabled lights, bit n = GL_LIGHT0 + n;
  ;; it is a parameter rather than block state because glEnable lives in
  ;; 09a8e and this block has no business guessing at it. Returns the number
  ;; of bytes written -- 128 + 64 per light -- or 0 for a refusal.
  ;;
  ;; Three things here are REFUSALS rather than omissions, because each one is
  ;; a case where a DLT1 exists that renders something, and the something is
  ;; not what GL would have drawn:
  ;;
  ;;   - A POSITIONAL light (GL_POSITION with w != 0). DLT1 rows carry a
  ;;     direction and $d3d_fixed_bind_lighting rejects any row whose type is
  ;;     not 3 (09aj:644), so there is nowhere to put the position. Dropping
  ;;     the light instead would darken the scene silently.
  ;;   - A light whose SPECULAR term is not provably zero. DLT1's row has a
  ;;     diffuse and an ambient and no third colour, and the lowering
  ;;     accumulates exactly those two (09aj:688-691). GL's default light 0
  ;;     specular is white, so refusing on that alone would refuse almost
  ;;     every app; what is refused is a light whose specular can actually
  ;;     reach the picture, which needs the MATERIAL specular to be nonzero
  ;;     too. GL's default material specular is black, so an app that never
  ;;     asks for highlights gets an exact build.
  ;;   - More than 8 lights, or an UNTRUSTED mirror.
  ;;
  ;; Two conversions that are silent if wrong. GL's GL_POSITION with w == 0
  ;; points TOWARD the light; D3D's direction points away from it, and the
  ;; lowering negates what it reads (09aj:684), so the row carries the
  ;; NEGATED GL vector. And the direction is stored in eye space, which is
  ;; where GL put it at glLightfv time -- it survives the lowering's view
  ;; multiply only because $gl_dfx1_transform leaves view identity. The two
  ;; functions have to agree about that or every light moves.
  ;;
  ;; Not represented, and not detectable here: glColorMaterial. The three
  ;; source selectors are written 0 (from the material), which is GL's state
  ;; until an app turns colour material on, and 09a8e does not tell us when
  ;; it does. Nor is the material's shininess, which only a specular term
  ;; would use.
  (func $gl_dlt1_lighting (param $dst i32) (param $mask i32) (result i32)
    (local $b i32) (local $i i32) (local $n i32) (local $light i32) (local $row i32)
    (if (i32.eqz (local.get $dst)) (then (return (i32.const 0))))
    (if (i32.ge_u (local.get $mask) (i32.const 256)) (then (return (i32.const 0))))
    (local.set $b (call $gl_mtx_block))
    (if (i32.load offset=28 (local.get $b)) (then (return (i32.const 0))))

    ;; Validate every enabled light before writing a byte, so a refusal leaves
    ;; the caller's buffer exactly as it found it.
    (local.set $i (i32.const 0))
    (local.set $n (i32.const 0))
    (loop $check
      (if (i32.and (i32.shr_u (local.get $mask) (local.get $i)) (i32.const 1))
        (then
          (local.set $light (call $gl_mtx_light_slot (local.get $b) (local.get $i)))
          ;; w != 0: positional, and DLT1 has no row for it.
          (if (f32.ne (f32.load offset=12 (local.get $light)) (f32.const 0))
            (then (return (i32.const 0))))
          (if (i32.and (call $gl_dlt1_lit (i32.add (local.get $light) (i32.const 48)))
                (call $gl_dlt1_lit (i32.add (local.get $b) (i32.const 8912))))
            (then (return (i32.const 0))))
          (local.set $n (i32.add (local.get $n) (i32.const 1)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $check (i32.lt_u (local.get $i) (i32.const 8))))

    (memory.fill (local.get $dst) (i32.const 0)
      (i32.add (i32.const 128) (i32.mul (local.get $n) (i32.const 64))))
    (i32.store offset=0 (local.get $dst) (i32.const 0x444c5431))
    (i32.store offset=4 (local.get $dst) (i32.const 1))
    (i32.store offset=8 (local.get $dst) (local.get $n))
    ;; normalReg 0 is a placeholder the caller completes, as in DFX1; the
    ;; colour registers are 16, which is DLT1's "absent". 09aj:617-625 requires
    ;; all three to differ unless the colour ones are both absent.
    (i32.store offset=16 (local.get $dst) (i32.const 16))
    (i32.store offset=20 (local.get $dst) (i32.const 16))
    (i32.store offset=48 (local.get $dst)
      (call $gl_dlt1_argb (i32.add (local.get $b) (i32.const 8352))))
    (call $gl_mtx_copy4 (i32.add (local.get $dst) (i32.const 64))
      (i32.add (local.get $b) (i32.const 8896)))
    (call $gl_mtx_copy4 (i32.add (local.get $dst) (i32.const 80))
      (i32.add (local.get $b) (i32.const 8880)))
    (call $gl_mtx_copy4 (i32.add (local.get $dst) (i32.const 96))
      (i32.add (local.get $b) (i32.const 8928)))

    (local.set $i (i32.const 0))
    (local.set $row (i32.add (local.get $dst) (i32.const 128)))
    (loop $emit
      (if (i32.and (i32.shr_u (local.get $mask) (local.get $i)) (i32.const 1))
        (then
          (local.set $light (call $gl_mtx_light_slot (local.get $b) (local.get $i)))
          (i32.store offset=0 (local.get $row) (i32.const 3))
          (call $gl_mtx_copy4 (i32.add (local.get $row) (i32.const 4))
            (i32.add (local.get $light) (i32.const 32)))
          (call $gl_mtx_copy4 (i32.add (local.get $row) (i32.const 20))
            (i32.add (local.get $light) (i32.const 16)))
          (f32.store offset=36 (local.get $row)
            (f32.neg (f32.load offset=0 (local.get $light))))
          (f32.store offset=40 (local.get $row)
            (f32.neg (f32.load offset=4 (local.get $light))))
          (f32.store offset=44 (local.get $row)
            (f32.neg (f32.load offset=8 (local.get $light))))
          (local.set $row (i32.add (local.get $row) (i32.const 64)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $emit (i32.lt_u (local.get $i) (i32.const 8))))
    (i32.add (i32.const 128) (i32.mul (local.get $n) (i32.const 64))))

  ;; Does this colour contribute anything? RGB only: alpha rides along in GL's
  ;; light and material colours and never multiplies a term on its own.
  (func $gl_dlt1_lit (param $p i32) (result i32)
    (i32.or (f32.ne (f32.load offset=0 (local.get $p)) (f32.const 0))
      (i32.or (f32.ne (f32.load offset=4 (local.get $p)) (f32.const 0))
        (f32.ne (f32.load offset=8 (local.get $p)) (f32.const 0)))))

  ;; Four f32 to a packed ARGB word, the encoding $d3d_fixed_argb decodes
  ;; (09aj:208-213). This is DLT1's only lossy field: the global ambient goes
  ;; through 8 bits per channel and comes back quantized. GL's own default of
  ;; 0.2 survives exactly (51/255), which is the case that matters most.
  (func $gl_dlt1_argb (param $p i32) (result i32)
    (i32.or
      (i32.or (i32.shl (call $gl_dlt1_channel (f32.load offset=12 (local.get $p))) (i32.const 24))
        (i32.shl (call $gl_dlt1_channel (f32.load offset=0 (local.get $p))) (i32.const 16)))
      (i32.or (i32.shl (call $gl_dlt1_channel (f32.load offset=4 (local.get $p))) (i32.const 8))
        (call $gl_dlt1_channel (f32.load offset=8 (local.get $p))))))

  ;; Clamped to 0..1 and rounded. trunc_sat rather than trunc because a NaN
  ;; channel must not trap the whole emulator; f32.max propagates NaN, so a
  ;; NaN arrives here and saturates to 0.
  (func $gl_dlt1_channel (param $v f32) (result i32)
    (i32.trunc_sat_f32_u
      (f32.add (f32.const 0.5)
        (f32.mul (f32.const 255)
          (f32.min (f32.const 1) (f32.max (f32.const 0) (local.get $v)))))))

  (func $gl_mtx_export_dfx1_transform (export "gl_dfx1_transform")
      (param $dst i32) (result i32)
    (call $gl_dfx1_transform (local.get $dst)))
  (func $gl_mtx_export_dlt1_lighting (export "gl_dlt1_lighting")
      (param $dst i32) (param $mask i32) (result i32)
    (call $gl_dlt1_lighting (local.get $dst) (local.get $mask)))
  (func $gl_mtx_export_viewport_ptr (export "gl_mtx_viewport_ptr") (result i32)
    (i32.add (call $gl_mtx_block) (i32.const 9008)))

  (func $gl_mtx_export_staging_ptr (export "gl_mtx_staging_ptr") (result i32)
    (call $gl_mtx_staging (call $gl_mtx_block)))
  (func $gl_mtx_export_depth (export "gl_mtx_depth") (param $s i32) (result i32)
    (i32.load (call $gl_mtx_depth_addr (call $gl_mtx_block)
      (i32.and (local.get $s) (i32.const 3)))))
  (func $gl_mtx_export_error (export "gl_mtx_error") (result i32)
    (i32.load offset=24 (call $gl_mtx_block)))
  (func $gl_mtx_export_clear_error (export "gl_mtx_clear_error")
    (i32.store offset=24 (call $gl_mtx_block) (i32.const 0)))
  ;; Nonzero = the opcode that this block could not mirror. A consumer must
  ;; refuse to lower a draw while it is set; a test asserts it stayed zero.
  (func $gl_mtx_export_untrusted (export "gl_mtx_untrusted") (result i32)
    (i32.load offset=28 (call $gl_mtx_block)))
  (func $gl_mtx_export_clear_untrusted (export "gl_mtx_clear_untrusted")
    (i32.store offset=28 (call $gl_mtx_block) (i32.const 0)))
  ;; Attribute stack depth, so a test can tell "restored the right values" from
  ;; "never pushed at all" -- a pop that silently did nothing leaves every
  ;; value already correct, and is indistinguishable from a correct round trip
  ;; without this.
  (func $gl_mtx_export_attrib_depth (export "gl_mtx_attrib_depth") (result i32)
    (i32.load offset=9032 (call $gl_mtx_block)))
  (func $gl_mtx_export_observe (export "gl_mtx_observe")
      (param $op i32) (param $stack i32)
    (call $gl_mtx_observe (local.get $op) (local.get $stack)))
  (func $gl_mtx_export_selected (export "gl_mtx_selected") (result i32)
    (call $gl_mtx_sel (call $gl_mtx_block)))
  (func $gl_mtx_export_set_mode (export "gl_mtx_set_mode") (param $mode i32)
    (call $gl_mtx_set_mode (local.get $mode)))
  (func $gl_mtx_export_set_active_texture (export "gl_mtx_set_active_texture")
      (param $unit i32)
    (call $gl_mtx_set_active_texture (local.get $unit)))
  (func $gl_mtx_export_load_identity (export "gl_mtx_load_identity")
    (call $gl_mtx_load_identity))
  (func $gl_mtx_export_load_src (export "gl_mtx_load_src")
    (call $gl_mtx_load (call $gl_mtx_staging (call $gl_mtx_block))))
  (func $gl_mtx_export_mult_src (export "gl_mtx_mult_src")
    (call $gl_mtx_mult (call $gl_mtx_staging (call $gl_mtx_block))))
  (func $gl_mtx_export_push (export "gl_mtx_push") (call $gl_mtx_push))
  (func $gl_mtx_export_pop (export "gl_mtx_pop") (call $gl_mtx_pop))
  (func $gl_mtx_export_translate (export "gl_mtx_translate")
      (param $x f64) (param $y f64) (param $z f64)
    (call $gl_mtx_translate (local.get $x) (local.get $y) (local.get $z)))
  (func $gl_mtx_export_scale (export "gl_mtx_scale")
      (param $x f64) (param $y f64) (param $z f64)
    (call $gl_mtx_scale (local.get $x) (local.get $y) (local.get $z)))
  (func $gl_mtx_export_rotate (export "gl_mtx_rotate")
      (param $a f64) (param $x f64) (param $y f64) (param $z f64)
    (call $gl_mtx_rotate (local.get $a) (local.get $x) (local.get $y) (local.get $z)))
  (func $gl_mtx_export_frustum (export "gl_mtx_frustum")
      (param $l f64) (param $r f64) (param $b f64)
      (param $t f64) (param $n f64) (param $f f64)
    (call $gl_mtx_frustum (local.get $l) (local.get $r) (local.get $b)
      (local.get $t) (local.get $n) (local.get $f)))
  (func $gl_mtx_export_ortho (export "gl_mtx_ortho")
      (param $l f64) (param $r f64) (param $b f64)
      (param $t f64) (param $n f64) (param $f f64)
    (call $gl_mtx_ortho (local.get $l) (local.get $r) (local.get $b)
      (local.get $t) (local.get $n) (local.get $f)))

  ;; Lighting, material and fog. The setters take a pointer to four f32, which
  ;; a test fills at gl_mtx_staging_ptr; the getters hand back the address of
  ;; the stored vector so it can be read straight out of linear memory.
  (func $gl_mtx_export_set_light (export "gl_mtx_set_light")
      (param $light i32) (param $pname i32) (param $values i32)
    (call $gl_mtx_set_light (local.get $light) (local.get $pname)
      (local.get $values)))
  (func $gl_mtx_export_light_ptr (export "gl_mtx_light_ptr")
      (param $index i32) (param $field i32) (result i32)
    (i32.add (call $gl_mtx_light_slot (call $gl_mtx_block)
        (i32.and (local.get $index) (i32.const 7)))
      (i32.mul (i32.and (local.get $field) (i32.const 3)) (i32.const 16))))
  (func $gl_mtx_export_set_light_model_ambient
      (export "gl_mtx_set_light_model_ambient") (param $values i32)
    (call $gl_mtx_set_light_model_ambient (local.get $values)))
  (func $gl_mtx_export_light_model_ambient_ptr
      (export "gl_mtx_light_model_ambient_ptr") (result i32)
    (i32.add (call $gl_mtx_block) (i32.const 8352)))
  (func $gl_mtx_export_set_material (export "gl_mtx_set_material")
      (param $pname i32) (param $values i32)
    (call $gl_mtx_set_material (local.get $pname) (local.get $values)))
  (func $gl_mtx_export_material_ptr (export "gl_mtx_material_ptr")
      (param $field i32) (result i32)
    (i32.add (call $gl_mtx_block)
      (i32.add (i32.const 8880)
        (i32.mul (i32.and (local.get $field) (i32.const 3)) (i32.const 16)))))
  (func $gl_mtx_export_shininess (export "gl_mtx_shininess") (result f32)
    (f32.load offset=8944 (call $gl_mtx_block)))
  (func $gl_mtx_export_set_fog (export "gl_mtx_set_fog")
      (param $pname i32) (param $values i32)
    (call $gl_mtx_set_fog (local.get $pname) (local.get $values)))
  (func $gl_mtx_export_set_fog_mode (export "gl_mtx_set_fog_mode") (param $mode i32)
    (call $gl_mtx_set_fog_mode (local.get $mode)))
  (func $gl_mtx_export_fog_mode (export "gl_mtx_fog_mode") (result i32)
    (i32.load offset=8960 (call $gl_mtx_block)))
  (func $gl_mtx_export_fog_density (export "gl_mtx_fog_density") (result f32)
    (f32.load offset=8964 (call $gl_mtx_block)))
  (func $gl_mtx_export_fog_start (export "gl_mtx_fog_start") (result f32)
    (f32.load offset=8968 (call $gl_mtx_block)))
  (func $gl_mtx_export_fog_end (export "gl_mtx_fog_end") (result f32)
    (f32.load offset=8972 (call $gl_mtx_block)))
  (func $gl_mtx_export_fog_color_ptr (export "gl_mtx_fog_color_ptr") (result i32)
    (i32.add (call $gl_mtx_block) (i32.const 8976)))
