  ;; ---- WGL contexts owned by WAT ----------------------------------------------
  ;; Software GL (src/09a8g-gl-raster.wat, lowered onto GPU stream v2 by
  ;; 09a8gt) has no host renderer: the host's FixedFunctionGL only mirrored
  ;; state it never drew with. When the host says so, WAT owns the whole WGL
  ;; lifecycle here instead -- context handles, make-current and its owner
  ;; rules, list sharing, SwapBuffers/glFlush presentation, glReadPixels,
  ;; glGenTextures, the GLU image entry points and wglCopyContext's
  ;; validation -- and the command stream is never sent to the host at all:
  ;; $gl_emit_record answers each record in place and $gl_wat_stream_flush
  ;; returns that answer.
  ;;
  ;; The host is asked once, at the first wglCreateContext, with record
  ;; 0x10008 (no arguments). Its answer: bit0 WAT owns contexts; bit1 the host
  ;; decided GPU stream v2 for software GL, bit2 its decision (on). A host
  ;; that does not know the record answers 0 and keeps the stream.
  ;;
  ;; Per context (the 09a8ca context block): +1104 drawable (HWND, or a GDI
  ;; bitmap handle with the high bit set), +1108 the owner mark
  ;; ($gl_wgl_me) of the instance it is current in, 0 when current nowhere. Handles come from the process-wide
  ;; counter at GL_MTX_BLOCKS+24, so guest-thread instances never collide.
  ;; Share group (20 -> 28 bytes): +20 next generated texture name (0 = 1),
  ;; +24 generated-but-unbound names, a {next, name} list.
  (global $gl_owned (mut i32) (i32.const -1))
  (global $gl_owned_result (mut i32) (i32.const 0))
  (global $gl_wgl_owner (mut i32) (i32.const 0))

  ;; This instance's owner mark. The current context is per instance
  ;; ($gl_current_context is not switched with cooperative threads), so the
  ;; owner is too: the main instance is one owner for all of its coop
  ;; threads, each guest-thread Worker instance another. Named by the first
  ;; thread to ask, which no other instance can be running.
  (func $gl_wgl_me (result i32)
    (if (i32.eqz (global.get $gl_wgl_owner))
      (then (global.set $gl_wgl_owner (i32.add (global.get $current_thread_id) (i32.const 1)))))
    (global.get $gl_wgl_owner))

  (func $gl_wgl_query_mode
    (local $stack i32) (local $mode i32)
    (global.set $gl_owned (i32.const 0))
    (local.set $stack (call $gl_list_alloc (i32.const 8)))
    (if (i32.eqz (local.get $stack)) (then (unreachable)))
    (drop (call $gl_emit_record (i32.const 0x10008) (local.get $stack)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
    (local.set $mode (call $gl_wat_stream_flush))
    (call $heap_free (call $w2g (local.get $stack)))
    ;; Only a tagged answer (0x5747 'WG' in the high half) is a mode.
    (if (i32.ne (i32.shr_u (local.get $mode) (i32.const 16)) (i32.const 0x5747))
      (then (local.set $mode (i32.const 0))))
    (if (i32.and (local.get $mode) (i32.const 2))
      (then (global.set $glg_on (i32.ne (i32.and (local.get $mode) (i32.const 4)) (i32.const 0)))))
    (global.set $gl_owned (i32.and (local.get $mode) (i32.const 1))))

  (func $gl_wgl_owned (result i32)
    (i32.eq (global.get $gl_owned) (i32.const 1)))

  ;; The client area of $hwnd, (w << 16) | h, or 0 when it has none.
  (func $gl_wgl_client (param $hwnd i32) (result i32)
    (local $w i32) (local $h i32)
    (local.set $w (i32.sub (call $client_rect_get_r (local.get $hwnd)) (call $client_rect_get_l (local.get $hwnd))))
    (local.set $h (i32.sub (call $client_rect_get_b (local.get $hwnd)) (call $client_rect_get_t (local.get $hwnd))))
    (if (i32.or (i32.le_s (local.get $w) (i32.const 0)) (i32.le_s (local.get $h) (i32.const 0)))
      (then (return (i32.const 0))))
    (i32.or (i32.shl (local.get $w) (i32.const 16)) (i32.and (local.get $h) (i32.const 0xffff))))

  (func $gl_wgl_default_size (param $hwnd i32)
    (local $c i32)
    (local.set $c (call $gl_wgl_client (local.get $hwnd)))
    (if (local.get $c) (then
      (call $gl_sw_export_set_default_size (i32.shr_u (local.get $c) (i32.const 16))
        (i32.and (local.get $c) (i32.const 0xffff))))))

  (func $gl_wgl_window (param $hwnd i32) (result i32)
    (i32.and (i32.ne (local.get $hwnd) (i32.const 0))
      (i32.ge_s (call $wnd_table_find (local.get $hwnd)) (i32.const 0))))

  ;; A drawable this context can bind: a live window or a rasterizable bitmap.
  (func $gl_wgl_target_valid (param $target i32) (result i32)
    (if (i32.lt_s (local.get $target) (i32.const 0)) (then
      (return (call $gl_sw_export_bind_bitmap
        (i32.and (local.get $target) (i32.const 0x7fffffff)) (i32.const 1)))))
    (call $gl_wgl_window (local.get $target)))

  (func $gl_wgl_create (param $target i32) (result i32)
    (local $handle i32) (local $ctx i32) (local $c i32)
    (if (i32.eqz (call $gl_wgl_target_valid (local.get $target))) (then (return (i32.const 0))))
    (call $gl_sw_export_set_enabled (i32.const 1))
    (if (i32.ge_s (local.get $target) (i32.const 0)) (then
      ;; GL's default viewport is the drawable; an app that never calls
      ;; glViewport (ptct) draws through this.
      (local.set $c (call $gl_wgl_client (local.get $target)))
      (if (i32.eqz (local.get $c)) (then (local.set $c (i32.const 0x028001e0))))
      (call $gl_sw_export_set_default_size (i32.shr_u (local.get $c) (i32.const 16))
        (i32.and (local.get $c) (i32.const 0xffff)))))
    (local.set $handle (i32.add (i32.atomic.rmw.add (region.addr $GL_MTX_BLOCKS 24) (i32.const 1)) (i32.const 1)))
    (local.set $ctx (call $gl_list_context_key (local.get $handle)))
    (i32.store offset=1104 (local.get $ctx) (local.get $target))
    (i32.store offset=1108 (local.get $ctx) (i32.const 0))
    (local.get $handle))

  ;; Current on a thread other than this one.
  (func $gl_wgl_busy (param $ctx i32) (result i32)
    (local $owner i32)
    (local.set $owner (i32.load offset=1108 (local.get $ctx)))
    (i32.and (i32.ne (local.get $owner) (i32.const 0))
      (i32.ne (local.get $owner) (call $gl_wgl_me))))

  ;; This thread no longer has a current context.
  (func $gl_wgl_release
    (local $ctx i32)
    (if (i32.eqz (global.get $gl_current_context)) (then (return)))
    (local.set $ctx (call $gl_share_context_find (global.get $gl_current_context)))
    (if (i32.eqz (local.get $ctx)) (then (return)))
    (if (i32.eq (i32.load offset=1108 (local.get $ctx)) (call $gl_wgl_me))
      (then (i32.store offset=1108 (local.get $ctx) (i32.const 0)))))

  (func $gl_wgl_make_current (param $handle i32) (param $target i32) (result i32)
    (local $ctx i32)
    (call $gl_wgl_release)
    (if (i32.eqz (local.get $handle)) (then (return (i32.const 1))))
    (local.set $ctx (call $gl_share_context_find (local.get $handle)))
    (if (i32.eqz (local.get $ctx)) (then (return (i32.const 0))))
    (if (call $gl_wgl_busy (local.get $ctx)) (then (return (i32.const 0))))
    (if (i32.eqz (call $gl_wgl_target_valid (local.get $target))) (then (return (i32.const 0))))
    (i32.store offset=1104 (local.get $ctx) (local.get $target))
    ;; A guest-thread instance may never have created a context itself.
    (if (i32.eqz (global.get $gl_sw_enabled)) (then (call $gl_sw_export_set_enabled (i32.const 1))))
    (if (i32.ge_s (local.get $target) (i32.const 0)) (then (call $gl_wgl_default_size (local.get $target))))
    (i32.store offset=1108 (local.get $ctx) (call $gl_wgl_me))
    (i32.const 1))

  (func $gl_wgl_delete (param $handle i32) (result i32)
    (local $ctx i32)
    (local.set $ctx (call $gl_share_context_find (local.get $handle)))
    (if (i32.eqz (local.get $ctx)) (then (return (i32.const 0))))
    (if (call $gl_wgl_busy (local.get $ctx)) (then (return (i32.const 0))))
    (i32.const 1))

  ;; SwapBuffers and glFlush: the current context's frame goes to its window.
  ;; A bitmap drawable is the DIB itself; there is nothing to publish.
  (func $gl_wgl_present (result i32)
    (local $ctx i32) (local $target i32)
    (if (i32.eqz (global.get $gl_current_context)) (then (return (i32.const 0))))
    (local.set $ctx (call $gl_share_context_find (global.get $gl_current_context)))
    (if (i32.eqz (local.get $ctx)) (then (return (i32.const 0))))
    (local.set $target (i32.load offset=1104 (local.get $ctx)))
    (if (i32.gt_s (local.get $target) (i32.const 0)) (then
      (drop (call $gl_sw_export_present_window (local.get $target)))
      ;; The drawable follows the window's client area from the next frame.
      (call $gl_wgl_default_size (local.get $target))))
    (i32.const 1))

  (func $gl_wgl_share (param $source i32) (param $target i32) (result i32)
    (local $a i32) (local $b i32)
    (local.set $a (i32.load offset=968 (call $gl_share_context_find (local.get $source))))
    (local.set $b (i32.load offset=968 (call $gl_share_context_find (local.get $target))))
    (if (i32.eq (local.get $a) (local.get $b)) (then (return (i32.const 1))))
    ;; Generated names are namespace members too.
    (i32.eqz (i32.load offset=24 (local.get $b))))

  ;; wglCopyContext phase zero: the destination must not be current anywhere.
  (func $gl_wgl_copy_validate (param $stack i32) (result i32)
    (local $ctx i32)
    (local.set $ctx (call $gl_share_context_find (i32.load offset=8 (local.get $stack))))
    (if (i32.eqz (local.get $ctx)) (then (return (i32.const 6))))
    (select (i32.const 170) (i32.const 0) (i32.ne (i32.load offset=1108 (local.get $ctx)) (i32.const 0))))

  ;; ---- generated texture names ----------------------------------------------
  (func $gl_wgl_reserved (param $group i32) (param $name i32) (result i32)
    (local $p i32)
    (local.set $p (i32.load offset=24 (local.get $group)))
    (block $done (loop $scan
      (br_if $done (i32.eqz (local.get $p)))
      (if (i32.eq (i32.load offset=4 (local.get $p)) (local.get $name)) (then (return (i32.const 1))))
      (local.set $p (i32.load (local.get $p))) (br $scan)))
    (i32.const 0))

  (func $gl_wgl_named (param $group i32) (param $name i32) (result i32)
    (local $p i32)
    (local.set $p (i32.load offset=8 (local.get $group)))
    (block $done (loop $scan
      (br_if $done (i32.eqz (local.get $p)))
      (if (i32.eq (i32.load offset=4 (local.get $p)) (local.get $name)) (then (return (i32.const 1))))
      (local.set $p (i32.load (local.get $p))) (br $scan)))
    (call $gl_wgl_reserved (local.get $group) (local.get $name)))

  ;; glDeleteTextures frees a generated name as well as a bound one.
  (func $gl_wgl_unreserve (param $group i32) (param $name i32)
    (local $p i32) (local $prev i32)
    (local.set $p (i32.load offset=24 (local.get $group)))
    (block $done (loop $scan
      (br_if $done (i32.eqz (local.get $p)))
      (if (i32.eq (i32.load offset=4 (local.get $p)) (local.get $name)) (then
        (if (local.get $prev) (then (i32.store (local.get $prev) (i32.load (local.get $p))))
          (else (i32.store offset=24 (local.get $group) (i32.load (local.get $p)))))
        (call $heap_free (call $w2g (local.get $p))) (return)))
      (local.set $prev (local.get $p))
      (local.set $p (i32.load (local.get $p))) (br $scan))))

  (func $gl_wgl_group_free (param $group i32)
    (local $p i32) (local $next i32)
    (local.set $p (i32.load offset=24 (local.get $group)))
    (block $done (loop $free
      (br_if $done (i32.eqz (local.get $p)))
      (local.set $next (i32.load (local.get $p)))
      (call $heap_free (call $w2g (local.get $p)))
      (local.set $p (local.get $next)) (br $free)))
    (i32.store offset=24 (local.get $group) (i32.const 0)))

  ;; Names neither bound nor already generated in the share group, the same
  ;; sequence for every context in it (wrapping past 0xffffffff, never 0).
  (func $gl_wgl_gen_textures (param $stack i32)
    (local $ctx i32) (local $group i32) (local $n i32) (local $out i32)
    (local $i i32) (local $name i32) (local $node i32)
    (local.set $ctx (call $gl_list_context))
    (if (i32.eqz (local.get $ctx)) (then (return)))
    (local.set $n (i32.load offset=4 (local.get $stack)))
    (if (i32.le_s (local.get $n) (i32.const 0)) (then (return)))
    (local.set $out (i32.load offset=8 (local.get $stack)))
    (local.set $group (i32.load offset=968 (local.get $ctx)))
    (local.set $name (i32.load offset=20 (local.get $group)))
    (if (i32.eqz (local.get $name)) (then (local.set $name (i32.const 1))))
    (loop $names
      (block $free (loop $skip
        (br_if $free (i32.eqz (call $gl_wgl_named (local.get $group) (local.get $name))))
        (local.set $name (i32.add (local.get $name) (i32.const 1)))
        (if (i32.eqz (local.get $name)) (then (local.set $name (i32.const 1))))
        (br $skip)))
      (call $gs32 (i32.add (local.get $out) (i32.shl (local.get $i) (i32.const 2))) (local.get $name))
      (local.set $node (call $gl_list_alloc (i32.const 8)))
      (if (i32.eqz (local.get $node)) (then (unreachable)))
      (i32.store (local.get $node) (i32.load offset=24 (local.get $group)))
      (i32.store offset=4 (local.get $node) (local.get $name))
      (i32.store offset=24 (local.get $group) (local.get $node))
      (local.set $name (i32.add (local.get $name) (i32.const 1)))
      (if (i32.eqz (local.get $name)) (then (local.set $name (i32.const 1))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $names (i32.lt_u (local.get $i) (local.get $n))))
    (i32.store offset=20 (local.get $group) (local.get $name)))

  ;; ---- glReadPixels -----------------------------------------------------------
  ;; The encoder rewrote the call to tight RGBA8 into its own scratch block
  ;; (09a8t $gl_g2_emit_prepare) and leased the read surface in $aux
  ;; ($gl_sw_read_surface: bit31 valid, bit30 bottom-up, low bits the
  ;; DxObject). Pixels outside the surface stay as the scratch was (zero);
  ;; 09a8t applies pixel transfer and PACK after this returns.
  (func $gl_wgl_read_pixels (param $stack i32) (param $aux i32)
    (local $x i32) (local $y i32) (local $w i32) (local $h i32) (local $out i32)
    (local $entry i32) (local $sw i32) (local $sh i32) (local $bpp i32) (local $pitch i32)
    (local $bits i32) (local $rgb565 i32) (local $row i32) (local $col i32)
    (local $sx i32) (local $sy i32) (local $p i32) (local $px i32) (local $at i32)
    (local.set $x (i32.load offset=4 (local.get $stack)))
    (local.set $y (i32.load offset=8 (local.get $stack)))
    (local.set $w (i32.load offset=12 (local.get $stack)))
    (local.set $h (i32.load offset=16 (local.get $stack)))
    ;; No current context: 09a8t left the call as it was and there is nothing to read.
    (if (i32.eqz (global.get $gl_current_context)) (then (return)))
    (if (i32.or (i32.ne (i32.load offset=20 (local.get $stack)) (i32.const 0x1908))
        (i32.ne (i32.load offset=24 (local.get $stack)) (i32.const 0x1401))) (then (unreachable)))
    (if (i32.or (i32.eqz (local.get $w)) (i32.eqz (local.get $h))) (then (return)))
    (if (i32.eqz (i32.and (local.get $aux) (i32.const 0x80000000))) (then
      (call $gl_list_error (call $gl_list_context) (i32.const 0x502)) (return)))
    (local.set $entry (i32.and (local.get $aux) (i32.const 0x3fffffff)))
    (if (i32.eqz (local.get $entry)) (then
      (call $gl_list_error (call $gl_list_context) (i32.const 0x505)) (return)))
    (local.set $sw (i32.load16_u offset=12 (local.get $entry)))
    (local.set $sh (i32.load16_u offset=14 (local.get $entry)))
    (local.set $bpp (i32.load16_u offset=16 (local.get $entry)))
    (local.set $pitch (i32.load16_u offset=18 (local.get $entry)))
    (local.set $bits (i32.load offset=20 (local.get $entry)))
    (if (i32.and (i32.ne (local.get $bpp) (i32.const 32)) (i32.ne (local.get $bpp) (i32.const 16)))
      (then (unreachable)))
    (local.set $rgb565 (i32.eq (call $dx_surf_fmt_get (local.get $entry)) (i32.const 1)))
    ;; One contiguous WAT allocation (gl_alloc_affine), so one g2w covers it.
    (local.set $out (call $g2w (i32.load offset=28 (local.get $stack))))
    (block $rows_done (loop $rows
      (br_if $rows_done (i32.ge_u (local.get $row) (local.get $h)))
      (local.set $col (i32.const 0))
      (block $cols_done (loop $cols
        (br_if $cols_done (i32.ge_u (local.get $col) (local.get $w)))
        (local.set $sx (i32.add (local.get $x) (local.get $col)))
        (local.set $sy (i32.add (local.get $y) (local.get $row)))
        (if (i32.and (i32.and (i32.ge_s (local.get $sx) (i32.const 0)) (i32.ge_s (local.get $sy) (i32.const 0)))
              (i32.and (i32.lt_s (local.get $sx) (local.get $sw)) (i32.lt_s (local.get $sy) (local.get $sh))))
          (then
            (local.set $p (i32.add (i32.add (local.get $bits)
              (i32.mul (select (i32.sub (i32.sub (local.get $sh) (i32.const 1)) (local.get $sy)) (local.get $sy)
                (i32.ne (i32.and (local.get $aux) (i32.const 0x40000000)) (i32.const 0))) (local.get $pitch)))
              (i32.mul (local.get $sx) (i32.shr_u (local.get $bpp) (i32.const 3)))))
            (local.set $at (i32.add (local.get $out)
              (i32.shl (i32.add (i32.mul (local.get $row) (local.get $w)) (local.get $col)) (i32.const 2))))
            (if (i32.eq (local.get $bpp) (i32.const 32))
              (then
                ;; BGRA in memory -> RGBA.
                (local.set $px (i32.load (local.get $p)))
                (i32.store8 (local.get $at) (i32.shr_u (local.get $px) (i32.const 16)))
                (i32.store8 offset=1 (local.get $at) (i32.shr_u (local.get $px) (i32.const 8)))
                (i32.store8 offset=2 (local.get $at) (local.get $px))
                (i32.store8 offset=3 (local.get $at) (i32.shr_u (local.get $px) (i32.const 24))))
              (else
                ;; Round-to-nearest expansion of 5/6-bit channels (never a tie).
                (local.set $px (i32.load16_u (local.get $p)))
                (i32.store8 (local.get $at) (i32.div_u (i32.add (i32.mul (i32.and
                  (i32.shr_u (local.get $px) (select (i32.const 11) (i32.const 10) (local.get $rgb565)))
                  (i32.const 31)) (i32.const 510)) (i32.const 31)) (i32.const 62)))
                (if (local.get $rgb565)
                  (then (i32.store8 offset=1 (local.get $at) (i32.div_u (i32.add (i32.mul (i32.and
                    (i32.shr_u (local.get $px) (i32.const 5)) (i32.const 63)) (i32.const 510)) (i32.const 63)) (i32.const 126))))
                  (else (i32.store8 offset=1 (local.get $at) (i32.div_u (i32.add (i32.mul (i32.and
                    (i32.shr_u (local.get $px) (i32.const 5)) (i32.const 31)) (i32.const 510)) (i32.const 31)) (i32.const 62)))))
                (i32.store8 offset=2 (local.get $at) (i32.div_u (i32.add (i32.mul (i32.and
                  (local.get $px) (i32.const 31)) (i32.const 510)) (i32.const 31)) (i32.const 62)))
                (i32.store8 offset=3 (local.get $at) (i32.const 255))))))
        (local.set $col (i32.add (local.get $col) (i32.const 1)))
        (br $cols)))
      (local.set $row (i32.add (local.get $row) (i32.const 1)))
      (br $rows))))

  ;; ---- the record answer --------------------------------------------------------
  ;; What the host's replay of this one record would have returned. Runs in
  ;; stream order, at the point the record would have been written.
  (func $gl_wgl_execute (param $op i32) (param $stack i32) (param $aux i32) (result i32)
    (if (i32.eq (local.get $op) (i32.const 48)) (then (return (call $gl_wgl_create (local.get $aux)))))
    (if (i32.eq (local.get $op) (i32.const 49)) (then
      (return (call $gl_wgl_delete (i32.load offset=4 (local.get $stack))))))
    (if (i32.eq (local.get $op) (i32.const 51)) (then
      (return (call $gl_wgl_make_current (i32.load offset=8 (local.get $stack)) (local.get $aux)))))
    (if (i32.eq (local.get $op) (i32.const 178)) (then
      (return (call $gl_wgl_share (i32.load offset=4 (local.get $stack)) (i32.load offset=8 (local.get $stack))))))
    ;; gpuPresent (SwapBuffers) and glFlush.
    (if (i32.or (i32.eq (local.get $op) (i32.const 55)) (i32.eq (local.get $op) (i32.const 93)))
      (then (return (call $gl_wgl_present))))
    (if (i32.eq (local.get $op) (i32.const 17)) (then
      (call $gl_wgl_read_pixels (local.get $stack) (local.get $aux)) (return (i32.const 0))))
    (if (i32.eq (local.get $op) (i32.const 74)) (then
      (call $gl_wgl_gen_textures (local.get $stack)) (return (i32.const 0))))
    (if (i32.eq (local.get $op) (i32.const 141)) (then (return (call $glu_scale_image (local.get $stack)))))
    ;; gluBuild2DMipmaps / gluBuild1DMipmaps: WAT built the levels (09a8g,
    ;; 09a8t); only GLU's size check is left to report.
    (if (i32.eq (local.get $op) (i32.const 61)) (then
      (return (select (i32.const 100901) (i32.const 0)
        (i32.or (i32.lt_s (i32.load offset=12 (local.get $stack)) (i32.const 1))
          (i32.lt_s (i32.load offset=16 (local.get $stack)) (i32.const 1)))))))
    (if (i32.eq (local.get $op) (i32.const 98)) (then
      (return (select (i32.const 100901) (i32.const 0)
        (i32.lt_s (i32.load offset=12 (local.get $stack)) (i32.const 1))))))
    (if (i32.eq (local.get $op) (i32.const 0x10006)) (then
      (if (local.get $aux) (then (return (i32.const 0))))
      (return (call $gl_wgl_copy_validate (local.get $stack)))))
    (if (i32.eq (local.get $op) (i32.const 0x10007)) (then (return (i32.const 1))))
    ;; Raw framebuffer and drawable queries are answered by 09a8g while
    ;; software GL is on; reaching here would be a routing bug.
    (if (i32.or (i32.eq (local.get $op) (i32.const 160))
          (i32.or (i32.eq (local.get $op) (i32.const 172)) (i32.eq (local.get $op) (i32.const 173))))
      (then (unreachable)))
    (i32.const 0))

  ;; ---- gluScaleImage --------------------------------------------------------------
  ;; GLU 1.2's area filter over a 16-bit intermediate, periodic at the edges,
  ;; with every GL 1.2 format/type pair and both pixel-store states. Status:
  ;; 0, GLU_INVALID_ENUM 100900, GLU_INVALID_VALUE 100901 (also an unmapped
  ;; guest span), GLU_OUT_OF_MEMORY 100902, GLU_INVALID_OPERATION 100904.
  ;; Layout block (32 bytes): +0 pointer, +4 bitmap, +8 element size,
  ;; +12 bits per pixel, +16 row bytes, +20 start bit (i64 at +24 unused),
  ;; +24 little-endian, +28 lsb-first.
  (func $glu_channels (param $format i32) (result i32)
    (if (i32.or (i32.eq (local.get $format) (i32.const 0x1907)) (i32.eq (local.get $format) (i32.const 0x80e0)))
      (then (return (i32.const 3))))
    (if (i32.or (i32.eq (local.get $format) (i32.const 0x1908)) (i32.eq (local.get $format) (i32.const 0x80e1)))
      (then (return (i32.const 4))))
    (if (i32.eq (local.get $format) (i32.const 0x190a)) (then (return (i32.const 2))))
    (if (i32.or (i32.le_u (i32.sub (local.get $format) (i32.const 0x1900)) (i32.const 6))
          (i32.eq (local.get $format) (i32.const 0x1909)))
      (then (return (i32.const 1))))
    (i32.const 0))

  ;; Packed type: (bytes << 24) | (reversed << 20) | (field count << 16) |
  ;; field widths, 4 bits each from the first field. 0 = not packed.
  (func $glu_packed (param $type i32) (result i32)
    (local $i i32)
    (local.set $i (i32.sub (local.get $type) (i32.const 0x8032)))
    (if (i32.le_u (local.get $i) (i32.const 4)) (then
      (if (i32.eqz (local.get $i)) (then (return (i32.const 0x01030233))))
      (if (i32.eq (local.get $i) (i32.const 1)) (then (return (i32.const 0x02044444))))
      (if (i32.eq (local.get $i) (i32.const 2)) (then (return (i32.const 0x02045551))))
      (if (i32.eq (local.get $i) (i32.const 3)) (then (return (i32.const 0x04048888))))
      (return (i32.const 0x040400aa))))
    (local.set $i (i32.sub (local.get $type) (i32.const 0x8362)))
    (if (i32.le_u (local.get $i) (i32.const 6)) (then
      (if (i32.eqz (local.get $i)) (then (return (i32.const 0x01130233))))
      (if (i32.eq (local.get $i) (i32.const 1)) (then (return (i32.const 0x02030565))))
      (if (i32.eq (local.get $i) (i32.const 2)) (then (return (i32.const 0x02130565))))
      (if (i32.eq (local.get $i) (i32.const 3)) (then (return (i32.const 0x02144444))))
      (if (i32.eq (local.get $i) (i32.const 4)) (then (return (i32.const 0x02145551))))
      (if (i32.eq (local.get $i) (i32.const 5)) (then (return (i32.const 0x04148888))))
      (return (i32.const 0x041400aa))))
    (i32.const 0))

  ;; Field $c's width. 10_10_10_2 does not fit four bits a field: 'a' = 10.
  (func $glu_field_bits (param $spec i32) (param $c i32) (result i32)
    (local $n i32) (local $v i32)
    (local.set $n (i32.and (i32.shr_u (local.get $spec) (i32.const 16)) (i32.const 15)))
    (local.set $v (i32.and (i32.shr_u (local.get $spec)
      (i32.shl (i32.sub (i32.sub (local.get $n) (i32.const 1)) (local.get $c)) (i32.const 2))) (i32.const 15)))
    (if (i32.eq (i32.and (local.get $spec) (i32.const 0xffff)) (i32.const 0x00aa))
      (then (return (select (i32.const 2) (i32.const 10) (i32.eq (local.get $c) (i32.const 3))))))
    (local.get $v))

  ;; Pixel-store word $i (0 swap, 1 lsb, 2 row length, 3 skip rows, 4 skip
  ;; pixels, 5 alignment) of UNPACK (0) or PACK (1).
  (func $glu_store (param $pack i32) (param $i i32) (result i32)
    (if (local.get $pack) (then
      (return (i32.load (i32.add (i32.add (call $gl_texture_block) (i32.const 268))
        (i32.shl (local.get $i) (i32.const 2)))))))
    (if (i32.eqz (local.get $i)) (then (return (i32.load offset=196 (call $gl_texture_block)))))
    (if (i32.eq (local.get $i) (i32.const 1)) (then (return (i32.load offset=96 (call $gl_list_context)))))
    (if (i32.eq (local.get $i) (i32.const 5)) (then (return (i32.load offset=80 (call $gl_list_context)))))
    (i32.load (i32.add (call $gl_list_context) (i32.add (i32.const 76) (i32.shl (local.get $i) (i32.const 2))))))

  ;; Fill layout block $l; 0, or 1 when the span leaves the guest's mapped
  ;; memory (validated page by page, before anything is written).
  (func $glu_layout (param $l i32) (param $pointer i32) (param $w i32) (param $h i32)
      (param $type i32) (param $pack i32) (param $channels i32) (result i32)
    (local $size i32) (local $bits i32) (local $row i64) (local $start i64) (local $end i64)
    (local $align i64) (local $y i32) (local $first i64) (local $last i64) (local $p i64) (local $packed i32)
    (local.set $packed (call $glu_packed (local.get $type)))
    (i32.store (local.get $l) (local.get $pointer))
    (i32.store offset=4 (local.get $l) (i32.eq (local.get $type) (i32.const 0x1a00)))
    (local.set $size (if (result i32) (i32.eq (local.get $type) (i32.const 0x1a00)) (then (i32.const 1))
      (else (if (result i32) (local.get $packed) (then (i32.shr_u (local.get $packed) (i32.const 24)))
        (else (call $gl_1d_type_bytes (local.get $type)))))))
    (local.set $bits (if (result i32) (i32.eq (local.get $type) (i32.const 0x1a00)) (then (local.get $channels))
      (else (i32.mul (i32.shl (local.get $size) (i32.const 3))
        (select (i32.const 1) (local.get $channels) (i32.ne (local.get $packed) (i32.const 0)))))))
    (local.set $align (i64.extend_i32_u (call $glu_store (local.get $pack) (i32.const 5))))
    (local.set $row (i64.extend_i32_u (select (call $glu_store (local.get $pack) (i32.const 2)) (local.get $w)
      (i32.ne (call $glu_store (local.get $pack) (i32.const 2)) (i32.const 0)))))
    ;; ceil(ceil(rowlen * bits / 8) / align) * align
    (local.set $row (i64.div_u (i64.add (i64.mul (local.get $row) (i64.extend_i32_u (local.get $bits))) (i64.const 7)) (i64.const 8)))
    (local.set $row (i64.mul (i64.div_u (i64.add (local.get $row) (i64.sub (local.get $align) (i64.const 1))) (local.get $align))
      (local.get $align)))
    (local.set $start (i64.add (i64.mul (i64.mul (i64.extend_i32_u (call $glu_store (local.get $pack) (i32.const 3)))
      (local.get $row)) (i64.const 8))
      (i64.mul (i64.extend_i32_u (call $glu_store (local.get $pack) (i32.const 4))) (i64.extend_i32_u (local.get $bits)))))
    (i32.store offset=8 (local.get $l) (local.get $size))
    (i32.store offset=12 (local.get $l) (local.get $bits))
    (i32.store offset=16 (local.get $l) (i32.wrap_i64 (local.get $row)))
    (i64.store offset=32 (local.get $l) (local.get $start))
    (i32.store offset=24 (local.get $l) (i32.eqz (call $glu_store (local.get $pack) (i32.const 0))))
    (i32.store offset=28 (local.get $l) (i32.ne (call $glu_store (local.get $pack) (i32.const 1)) (i32.const 0)))
    (if (i32.eqz (local.get $pointer)) (then (return (i32.const 1))))
    (local.set $end (i64.add (i64.extend_i32_u (local.get $pointer)) (i64.div_u (i64.add
      (i64.add (local.get $start) (i64.add (i64.mul (i64.extend_i32_u (i32.sub (local.get $h) (i32.const 1)))
        (i64.mul (local.get $row) (i64.const 8))) (i64.mul (i64.extend_i32_u (local.get $w)) (i64.extend_i32_u (local.get $bits)))))
      (i64.const 7)) (i64.const 8))))
    (if (i64.gt_u (local.get $end) (i64.const 0x100000000)) (then (return (i32.const 1))))
    (block $rows_done (loop $rows
      (br_if $rows_done (i32.ge_u (local.get $y) (local.get $h)))
      (local.set $first (i64.add (i64.extend_i32_u (local.get $pointer))
        (i64.div_u (i64.add (local.get $start) (i64.mul (i64.extend_i32_u (local.get $y)) (i64.mul (local.get $row) (i64.const 8))))
          (i64.const 8))))
      (local.set $last (i64.sub (i64.add (i64.extend_i32_u (local.get $pointer))
        (i64.div_u (i64.add (i64.add (i64.add (local.get $start) (i64.mul (i64.extend_i32_u (local.get $y)) (i64.mul (local.get $row) (i64.const 8))))
          (i64.mul (i64.extend_i32_u (local.get $w)) (i64.extend_i32_u (local.get $bits)))) (i64.const 7)) (i64.const 8)))
        (i64.const 1)))
      (local.set $p (local.get $first))
      (block $pages_done (loop $pages
        (br_if $pages_done (i64.gt_u (local.get $p) (local.get $last)))
        (if (i32.eq (call $g2w (i32.wrap_i64 (local.get $p))) (global.get $NULL_SENTINEL)) (then (return (i32.const 1))))
        (local.set $p (i64.add (i64.and (local.get $p) (i64.const -4096)) (i64.const 4096)))
        (br $pages)))
      (if (i32.eq (call $g2w (i32.wrap_i64 (local.get $last))) (global.get $NULL_SENTINEL)) (then (return (i32.const 1))))
      (local.set $y (i32.add (local.get $y) (i32.const 1)))
      (br $rows)))
    (i32.const 0))

  ;; $size bytes at guest $p in the layout's byte order, as an unsigned word.
  (func $glu_read (param $p i32) (param $size i32) (param $little i32) (result i32)
    (local $v i32) (local $b i32)
    (block $done (loop $bytes
      (br_if $done (i32.ge_u (local.get $b) (local.get $size)))
      (if (local.get $little)
        (then (local.set $v (i32.or (local.get $v) (i32.shl (call $gl8 (i32.add (local.get $p) (local.get $b)))
          (i32.shl (local.get $b) (i32.const 3))))))
        (else (local.set $v (i32.or (i32.shl (local.get $v) (i32.const 8)) (call $gl8 (i32.add (local.get $p) (local.get $b)))))))
      (local.set $b (i32.add (local.get $b) (i32.const 1)))
      (br $bytes)))
    (local.get $v))

  (func $glu_write (param $p i32) (param $size i32) (param $little i32) (param $v i32)
    (local $b i32)
    (block $done (loop $bytes
      (br_if $done (i32.ge_u (local.get $b) (local.get $size)))
      (call $gs8 (i32.add (local.get $p) (local.get $b))
        (i32.shr_u (local.get $v) (i32.shl (select (local.get $b) (i32.sub (i32.sub (local.get $size) (i32.const 1)) (local.get $b))
          (local.get $little)) (i32.const 3))))
      (local.set $b (i32.add (local.get $b) (i32.const 1)))
      (br $bytes))))

  ;; A double to a Uint16Array element: truncate, then modulo 2^16.
  (func $glu_u16 (param $v f64) (result i32)
    (i32.and (i32.wrap_i64 (i64.trunc_sat_f64_s (local.get $v))) (i32.const 0xffff)))

  (func $glu_scale_image (param $stack i32) (result i32)
    (local $format i32) (local $wi i32) (local $hi i32) (local $ti i32) (local $src i32)
    (local $wo i32) (local $ho i32) (local $to i32) (local $dst i32)
    (local $channels i32) (local $index i32) (local $ni i32) (local $no i32)
    (local $scratch i32) (local $before i32) (local $after i32) (local $in i32) (local $out i32)
    (local $x i32) (local $y i32) (local $c i32) (local $off i32) (local $spec i32) (local $size i32)
    (local $bit i64) (local $at i32) (local $word i32) (local $shift i32) (local $fbits i32) (local $mask i32)
    (local $v i32) (local $b i64) (local $byte i32) (local $result i32) (local $ix i32) (local $iy i32)
    (local $cx f64) (local $cy f64) (local $rx f64) (local $ry f64) (local $wy f64) (local $weight f64)
    (local $area f64) (local $t0 f64) (local $t1 f64) (local $t2 f64) (local $t3 f64) (local $fv f64)
    (local $wordf f64)
    (local.set $format (i32.load offset=4 (local.get $stack)))
    (local.set $wi (i32.load offset=8 (local.get $stack)))
    (local.set $hi (i32.load offset=12 (local.get $stack)))
    (local.set $ti (i32.load offset=16 (local.get $stack)))
    (local.set $src (i32.load offset=20 (local.get $stack)))
    (local.set $wo (i32.load offset=24 (local.get $stack)))
    (local.set $ho (i32.load offset=28 (local.get $stack)))
    (local.set $to (i32.load offset=32 (local.get $stack)))
    (local.set $dst (i32.load offset=36 (local.get $stack)))
    (if (i32.or (i32.or (i32.eqz (local.get $wi)) (i32.eqz (local.get $hi)))
          (i32.or (i32.eqz (local.get $wo)) (i32.eqz (local.get $ho)))) (then (return (i32.const 0))))
    (if (i32.or (i32.or (i32.lt_s (local.get $wi) (i32.const 0)) (i32.lt_s (local.get $hi) (i32.const 0)))
          (i32.or (i32.lt_s (local.get $wo) (i32.const 0)) (i32.lt_s (local.get $ho) (i32.const 0))))
      (then (return (i32.const 100901))))
    (local.set $channels (call $glu_channels (local.get $format)))
    (if (i32.or (i32.eqz (local.get $channels))
          (i32.or
            (i32.eqz (i32.or (i32.eq (local.get $ti) (i32.const 0x1a00))
              (i32.or (i32.ne (call $gl_1d_type_bytes (local.get $ti)) (i32.const 0))
                (i32.ne (call $glu_packed (local.get $ti)) (i32.const 0)))))
            (i32.eqz (i32.or (i32.eq (local.get $to) (i32.const 0x1a00))
              (i32.or (i32.ne (call $gl_1d_type_bytes (local.get $to)) (i32.const 0))
                (i32.ne (call $glu_packed (local.get $to)) (i32.const 0)))))))
      (then (return (i32.const 100900))))
    ;; Packed types need the format with as many components as fields.
    (local.set $spec (call $glu_packed (local.get $ti)))
    (if (local.get $spec) (then
      (if (if (result i32) (i32.eq (i32.and (i32.shr_u (local.get $spec) (i32.const 16)) (i32.const 15)) (i32.const 3))
            (then (i32.ne (local.get $format) (i32.const 0x1907)))
            (else (i32.and (i32.ne (local.get $format) (i32.const 0x1908)) (i32.ne (local.get $format) (i32.const 0x80e1)))))
        (then (return (i32.const 100904))))))
    (local.set $spec (call $glu_packed (local.get $to)))
    (if (local.get $spec) (then
      (if (if (result i32) (i32.eq (i32.and (i32.shr_u (local.get $spec) (i32.const 16)) (i32.const 15)) (i32.const 3))
            (then (i32.ne (local.get $format) (i32.const 0x1907)))
            (else (i32.and (i32.ne (local.get $format) (i32.const 0x1908)) (i32.ne (local.get $format) (i32.const 0x80e1)))))
        (then (return (i32.const 100904))))))
    ;; Bounded scratch, failing as GLU does rather than growing without limit.
    (if (i64.gt_u (i64.add
          (i64.mul (i64.mul (i64.extend_i32_u (local.get $wi)) (i64.extend_i32_u (local.get $hi))) (i64.extend_i32_u (local.get $channels)))
          (i64.mul (i64.mul (i64.extend_i32_u (local.get $wo)) (i64.extend_i32_u (local.get $ho))) (i64.extend_i32_u (local.get $channels))))
          (i64.const 0x800000)) (then (return (i32.const 100902))))
    (local.set $ni (i32.mul (i32.mul (local.get $wi) (local.get $hi)) (local.get $channels)))
    (local.set $no (i32.mul (i32.mul (local.get $wo) (local.get $ho)) (local.get $channels)))
    (local.set $index (i32.le_u (i32.sub (local.get $format) (i32.const 0x1900)) (i32.const 1)))
    (local.set $in (call $gl_list_alloc (i32.const 80)))
    (if (i32.eqz (local.get $in)) (then (return (i32.const 100902))))
    (local.set $out (i32.add (local.get $in) (i32.const 40)))
    (if (i32.or (call $glu_layout (local.get $in) (local.get $src) (local.get $wi) (local.get $hi) (local.get $ti)
            (i32.const 0) (local.get $channels))
          (call $glu_layout (local.get $out) (local.get $dst) (local.get $wo) (local.get $ho) (local.get $to)
            (i32.const 1) (local.get $channels)))
      (then (call $heap_free (call $w2g (local.get $in))) (return (i32.const 100901))))
    (local.set $scratch (call $gl_alloc_affine (i32.shl (i32.add (local.get $ni) (local.get $no)) (i32.const 1))))
    (if (i32.eqz (local.get $scratch)) (then
      (call $heap_free (call $w2g (local.get $in))) (return (i32.const 100902))))
    (local.set $before (call $g2w (local.get $scratch)))
    (local.set $after (i32.add (local.get $before) (i32.shl (local.get $ni) (i32.const 1))))
    ;; Unpack to 16 bits a component.
    (local.set $spec (call $glu_packed (local.get $ti)))
    (local.set $size (i32.load offset=8 (local.get $in)))
    (local.set $y (i32.const 0))
    (loop $in_rows
      (local.set $x (i32.const 0))
      (loop $in_cols
        (local.set $bit (i64.add (i64.load offset=32 (local.get $in))
          (i64.add (i64.mul (i64.extend_i32_u (local.get $y)) (i64.mul (i64.extend_i32_u (i32.load offset=16 (local.get $in))) (i64.const 8)))
            (i64.mul (i64.extend_i32_u (local.get $x)) (i64.extend_i32_u (i32.load offset=12 (local.get $in)))))))
        (local.set $at (i32.add (local.get $src) (i32.wrap_i64 (i64.shr_u (local.get $bit) (i64.const 3)))))
        (local.set $off (i32.mul (i32.add (i32.mul (local.get $y) (local.get $wi)) (local.get $x)) (local.get $channels)))
        (local.set $word (i32.const 0)) (local.set $shift (i32.const 0))
        (if (local.get $spec) (then
          (local.set $word (call $glu_read (local.get $at) (local.get $size) (i32.load offset=24 (local.get $in))))
          (if (i32.eqz (i32.and (local.get $spec) (i32.const 0x00100000)))
            (then (local.set $shift (i32.shl (local.get $size) (i32.const 3)))))))
        (local.set $c (i32.const 0))
        (loop $in_components
          (if (i32.load offset=4 (local.get $in))
            (then
              (local.set $b (i64.add (local.get $bit) (i64.extend_i32_u (local.get $c))))
              (local.set $byte (call $gl8 (i32.add (local.get $src) (i32.wrap_i64 (i64.shr_u (local.get $b) (i64.const 3))))))
              (local.set $v (i32.and (i32.shr_u (local.get $byte)
                (if (result i32) (i32.load offset=28 (local.get $in))
                  (then (i32.wrap_i64 (i64.and (local.get $b) (i64.const 7))))
                  (else (i32.sub (i32.const 7) (i32.wrap_i64 (i64.and (local.get $b) (i64.const 7))))))) (i32.const 1)))
              (local.set $v (select (local.get $v) (i32.mul (local.get $v) (i32.const 65535)) (local.get $index))))
            (else (if (local.get $spec)
              (then
                (local.set $fbits (call $glu_field_bits (local.get $spec) (local.get $c)))
                (local.set $mask (i32.sub (i32.shl (i32.const 1) (local.get $fbits)) (i32.const 1)))
                (if (i32.eqz (i32.and (local.get $spec) (i32.const 0x00100000)))
                  (then (local.set $shift (i32.sub (local.get $shift) (local.get $fbits)))))
                (local.set $v (i32.wrap_i64 (i64.div_u (i64.mul
                  (i64.extend_i32_u (i32.and (i32.shr_u (local.get $word) (local.get $shift)) (local.get $mask)))
                  (i64.const 65535)) (i64.extend_i32_u (local.get $mask)))))
                (if (i32.and (local.get $spec) (i32.const 0x00100000))
                  (then (local.set $shift (i32.add (local.get $shift) (local.get $fbits))))))
              (else
                (local.set $v (call $glu_read (i32.add (local.get $at) (i32.mul (local.get $c) (local.get $size)))
                  (local.get $size) (i32.load offset=24 (local.get $in))))
                (if (i32.eqz (local.get $index)) (then
                  (local.set $v
                    (if (result i32) (i32.eq (local.get $ti) (i32.const 0x1400))
                      (then (i32.mul (i32.extend8_s (local.get $v)) (i32.const 516)))
                    (else (if (result i32) (i32.eq (local.get $ti) (i32.const 0x1401))
                      (then (i32.mul (local.get $v) (i32.const 257)))
                    (else (if (result i32) (i32.eq (local.get $ti) (i32.const 0x1402))
                      (then (i32.mul (i32.extend16_s (local.get $v)) (i32.const 2)))
                    (else (if (result i32) (i32.eq (local.get $ti) (i32.const 0x1403))
                      (then (local.get $v))
                    (else (if (result i32) (i32.eq (local.get $ti) (i32.const 0x1404))
                      (then (i32.shr_s (local.get $v) (i32.const 15)))
                    (else (if (result i32) (i32.eq (local.get $ti) (i32.const 0x1405))
                      (then (i32.shr_u (local.get $v) (i32.const 16)))
                      (else (call $glu_u16 (f64.mul (f64.promote_f32 (f32.reinterpret_i32 (local.get $v)))
                        (f64.const 65535))))))))))))))))))))))
          (i32.store16 (i32.add (local.get $before) (i32.shl (i32.add (local.get $off) (local.get $c)) (i32.const 1)))
            (local.get $v))
          (local.set $c (i32.add (local.get $c) (i32.const 1)))
          (br_if $in_components (i32.lt_u (local.get $c) (local.get $channels))))
        (local.set $x (i32.add (local.get $x) (i32.const 1)))
        (br_if $in_cols (i32.lt_u (local.get $x) (local.get $wi))))
      (local.set $y (i32.add (local.get $y) (i32.const 1)))
      (br_if $in_rows (i32.lt_u (local.get $y) (local.get $hi))))
    ;; The footprint is one input pixel while enlarging, or the full
    ;; reduction footprint while shrinking; periodic edges match GLU.
    (local.set $rx (f64.div (f64.max (f64.const 1) (f64.div (f64.convert_i32_u (local.get $wi)) (f64.convert_i32_u (local.get $wo))))
      (f64.const 2)))
    (local.set $ry (f64.div (f64.max (f64.const 1) (f64.div (f64.convert_i32_u (local.get $hi)) (f64.convert_i32_u (local.get $ho))))
      (f64.const 2)))
    (local.set $y (i32.const 0))
    (loop $out_rows
      (local.set $x (i32.const 0))
      (loop $out_cols
        (local.set $cx (f64.div (f64.mul (f64.add (f64.convert_i32_u (local.get $x)) (f64.const 0.5))
          (f64.convert_i32_u (local.get $wi))) (f64.convert_i32_u (local.get $wo))))
        (local.set $cy (f64.div (f64.mul (f64.add (f64.convert_i32_u (local.get $y)) (f64.const 0.5))
          (f64.convert_i32_u (local.get $hi))) (f64.convert_i32_u (local.get $ho))))
        (local.set $t0 (f64.const 0)) (local.set $t1 (f64.const 0))
        (local.set $t2 (f64.const 0)) (local.set $t3 (f64.const 0)) (local.set $area (f64.const 0))
        (local.set $iy (i32.trunc_f64_s (f64.floor (f64.sub (local.get $cy) (local.get $ry)))))
        (block $iy_done (loop $iys
          (br_if $iy_done (i32.eqz (f64.lt (f64.convert_i32_s (local.get $iy)) (f64.add (local.get $cy) (local.get $ry)))))
          (local.set $wy (f64.sub (f64.min (f64.convert_i32_s (i32.add (local.get $iy) (i32.const 1))) (f64.add (local.get $cy) (local.get $ry)))
            (f64.max (f64.convert_i32_s (local.get $iy)) (f64.sub (local.get $cy) (local.get $ry)))))
          (local.set $ix (i32.trunc_f64_s (f64.floor (f64.sub (local.get $cx) (local.get $rx)))))
          (block $ix_done (loop $ixs
            (br_if $ix_done (i32.eqz (f64.lt (f64.convert_i32_s (local.get $ix)) (f64.add (local.get $cx) (local.get $rx)))))
            (local.set $weight (f64.mul (local.get $wy)
              (f64.sub (f64.min (f64.convert_i32_s (i32.add (local.get $ix) (i32.const 1))) (f64.add (local.get $cx) (local.get $rx)))
                (f64.max (f64.convert_i32_s (local.get $ix)) (f64.sub (local.get $cx) (local.get $rx))))))
            (local.set $off (i32.mul (i32.add
              (i32.mul (i32.rem_s (i32.add (local.get $iy) (local.get $hi)) (local.get $hi)) (local.get $wi))
              (i32.rem_s (i32.add (local.get $ix) (local.get $wi)) (local.get $wi))) (local.get $channels)))
            (local.set $off (i32.add (local.get $before) (i32.shl (local.get $off) (i32.const 1))))
            (local.set $area (f64.add (local.get $area) (local.get $weight)))
            (local.set $t0 (f64.add (local.get $t0) (f64.mul (f64.convert_i32_u (i32.load16_u (local.get $off))) (local.get $weight))))
            (if (i32.gt_u (local.get $channels) (i32.const 1)) (then
              (local.set $t1 (f64.add (local.get $t1) (f64.mul (f64.convert_i32_u (i32.load16_u offset=2 (local.get $off))) (local.get $weight))))))
            (if (i32.gt_u (local.get $channels) (i32.const 2)) (then
              (local.set $t2 (f64.add (local.get $t2) (f64.mul (f64.convert_i32_u (i32.load16_u offset=4 (local.get $off))) (local.get $weight))))))
            (if (i32.gt_u (local.get $channels) (i32.const 3)) (then
              (local.set $t3 (f64.add (local.get $t3) (f64.mul (f64.convert_i32_u (i32.load16_u offset=6 (local.get $off))) (local.get $weight))))))
            (local.set $ix (i32.add (local.get $ix) (i32.const 1)))
            (br $ixs)))
          (local.set $iy (i32.add (local.get $iy) (i32.const 1)))
          (br $iys)))
        (local.set $off (i32.add (local.get $after)
          (i32.shl (i32.mul (i32.add (i32.mul (local.get $y) (local.get $wo)) (local.get $x)) (local.get $channels)) (i32.const 1))))
        (i32.store16 (local.get $off) (call $glu_u16 (f64.floor (f64.add (f64.div (local.get $t0) (local.get $area)) (f64.const 0.5)))))
        (if (i32.gt_u (local.get $channels) (i32.const 1)) (then
          (i32.store16 offset=2 (local.get $off) (call $glu_u16 (f64.floor (f64.add (f64.div (local.get $t1) (local.get $area)) (f64.const 0.5)))))))
        (if (i32.gt_u (local.get $channels) (i32.const 2)) (then
          (i32.store16 offset=4 (local.get $off) (call $glu_u16 (f64.floor (f64.add (f64.div (local.get $t2) (local.get $area)) (f64.const 0.5)))))))
        (if (i32.gt_u (local.get $channels) (i32.const 3)) (then
          (i32.store16 offset=6 (local.get $off) (call $glu_u16 (f64.floor (f64.add (f64.div (local.get $t3) (local.get $area)) (f64.const 0.5)))))))
        (local.set $x (i32.add (local.get $x) (i32.const 1)))
        (br_if $out_cols (i32.lt_u (local.get $x) (local.get $wo))))
      (local.set $y (i32.add (local.get $y) (i32.const 1)))
      (br_if $out_rows (i32.lt_u (local.get $y) (local.get $ho))))
    ;; Pack under PACK state.
    (local.set $spec (call $glu_packed (local.get $to)))
    (local.set $size (i32.load offset=8 (local.get $out)))
    (local.set $y (i32.const 0))
    (loop $pack_rows
      (local.set $x (i32.const 0))
      (loop $pack_cols
        (local.set $bit (i64.add (i64.load offset=32 (local.get $out))
          (i64.add (i64.mul (i64.extend_i32_u (local.get $y)) (i64.mul (i64.extend_i32_u (i32.load offset=16 (local.get $out))) (i64.const 8)))
            (i64.mul (i64.extend_i32_u (local.get $x)) (i64.extend_i32_u (i32.load offset=12 (local.get $out)))))))
        (local.set $at (i32.add (local.get $dst) (i32.wrap_i64 (i64.shr_u (local.get $bit) (i64.const 3)))))
        (local.set $off (i32.mul (i32.add (i32.mul (local.get $y) (local.get $wo)) (local.get $x)) (local.get $channels)))
        (local.set $wordf (f64.const 0)) (local.set $shift (i32.const 0))
        (if (i32.and (i32.ne (local.get $spec) (i32.const 0)) (i32.eqz (i32.and (local.get $spec) (i32.const 0x00100000))))
          (then (local.set $shift (i32.shl (local.get $size) (i32.const 3)))))
        (local.set $c (i32.const 0))
        (loop $pack_components
          (local.set $v (i32.load16_u (i32.add (local.get $after) (i32.shl (i32.add (local.get $off) (local.get $c)) (i32.const 1)))))
          (if (i32.load offset=4 (local.get $out))
            (then
              (local.set $b (i64.add (local.get $bit) (i64.extend_i32_u (local.get $c))))
              (local.set $byte (i32.add (local.get $dst) (i32.wrap_i64 (i64.shr_u (local.get $b) (i64.const 3)))))
              (local.set $mask (i32.shl (i32.const 1)
                (if (result i32) (i32.load offset=28 (local.get $out))
                  (then (i32.wrap_i64 (i64.and (local.get $b) (i64.const 7))))
                  (else (i32.sub (i32.const 7) (i32.wrap_i64 (i64.and (local.get $b) (i64.const 7))))))))
              (call $gs8 (local.get $byte) (i32.or (i32.and (call $gl8 (local.get $byte)) (i32.xor (local.get $mask) (i32.const -1)))
                (select (local.get $mask) (i32.const 0)
                  (if (result i32) (local.get $index)
                    (then (i32.and (local.get $v) (i32.const 1)))
                    (else (i32.gt_u (local.get $v) (i32.const 32767))))))))
            (else (if (local.get $spec)
              (then
                (local.set $fbits (call $glu_field_bits (local.get $spec) (local.get $c)))
                (local.set $mask (i32.sub (i32.shl (i32.const 1) (local.get $fbits)) (i32.const 1)))
                (if (i32.eqz (i32.and (local.get $spec) (i32.const 0x00100000)))
                  (then (local.set $shift (i32.sub (local.get $shift) (local.get $fbits)))))
                (local.set $wordf (f64.add (local.get $wordf) (f64.mul
                  (f64.floor (f64.add (f64.div (f64.mul (f64.convert_i32_u (local.get $v)) (f64.convert_i32_u (local.get $mask)))
                    (f64.const 65535)) (f64.const 0.5)))
                  (f64.convert_i64_u (i64.shl (i64.const 1) (i64.extend_i32_u (local.get $shift)))))))
                (if (i32.and (local.get $spec) (i32.const 0x00100000))
                  (then (local.set $shift (i32.add (local.get $shift) (local.get $fbits))))))
              (else
                (if (i32.eq (local.get $to) (i32.const 0x1406))
                  (then
                    (call $glu_write (i32.add (local.get $at) (i32.shl (local.get $c) (i32.const 2))) (i32.const 4)
                      (i32.load offset=24 (local.get $out))
                      (i32.reinterpret_f32 (if (result f32) (local.get $index)
                        (then (f32.convert_i32_u (local.get $v)))
                        (else (f32.demote_f64 (f64.div (f64.convert_i32_u (local.get $v)) (f64.const 65535))))))))
                  (else
                    (call $glu_write (i32.add (local.get $at) (i32.mul (local.get $c) (local.get $size))) (local.get $size)
                      (i32.load offset=24 (local.get $out))
                      (if (result i32) (local.get $index) (then (local.get $v))
                        (else (if (result i32) (i32.eq (local.get $to) (i32.const 0x1400))
                          (then (i32.shr_u (local.get $v) (i32.const 9)))
                        (else (if (result i32) (i32.eq (local.get $to) (i32.const 0x1401))
                          (then (i32.shr_u (local.get $v) (i32.const 8)))
                        (else (if (result i32) (i32.eq (local.get $to) (i32.const 0x1402))
                          (then (i32.shr_u (local.get $v) (i32.const 1)))
                        (else (if (result i32) (i32.eq (local.get $to) (i32.const 0x1403))
                          (then (local.get $v))
                        (else (if (result i32) (i32.eq (local.get $to) (i32.const 0x1404))
                          (then (i32.wrap_i64 (i64.shr_u (i64.mul (i64.extend_i32_u (local.get $v)) (i64.const 65537)) (i64.const 1))))
                          (else (i32.mul (local.get $v) (i32.const 65537)))))))))))))))))))))
          (local.set $c (i32.add (local.get $c) (i32.const 1)))
          (br_if $pack_components (i32.lt_u (local.get $c) (local.get $channels))))
        (if (local.get $spec) (then
          (call $glu_write (local.get $at) (local.get $size) (i32.load offset=24 (local.get $out))
            (i32.wrap_i64 (i64.trunc_sat_f64_u (local.get $wordf))))))
        (local.set $x (i32.add (local.get $x) (i32.const 1)))
        (br_if $pack_cols (i32.lt_u (local.get $x) (local.get $wo))))
      (local.set $y (i32.add (local.get $y) (i32.const 1)))
      (br_if $pack_rows (i32.lt_u (local.get $y) (local.get $ho))))
    (call $heap_free (local.get $scratch))
    (call $heap_free (call $w2g (local.get $in)))
    (i32.const 0))
