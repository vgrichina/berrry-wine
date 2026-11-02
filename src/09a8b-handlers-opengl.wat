  ;; ============================================================
  ;; OpenGL 1.x / WGL compatibility frontend
  ;; ============================================================
  ;; The generated API dispatcher routes the measured Quake II GL/WGL set to
  ;; this one ABI bridge. The host sees the original stack in linear memory;
  ;; it owns fixed-function emulation and lowers to the generic GPU backend.

  (func $gpu_linear_to_guest (param $wa i32) (result i32)
    (i32.add (i32.sub (local.get $wa) (global.get $GUEST_BASE))
      (global.get $image_base)))

  (func $handle_gpu_api
      (param $opcode i32) (param $stack_dwords i32)
      (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
      (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $aux i32) (local $string_wa i32) (local $bmp i32)
    (local $name_wa i32) (local $api_id i32) (local $rec i32) (local $len i32)

    ;; The three WGL pixel-format entry points are aliases of the GDI exports.
    ;; Keep one canonical PIXELFORMATDESCRIPTOR implementation.
    (if (i32.eq (local.get $opcode) (i32.const 52))
      (then
        (call $handle_ChoosePixelFormat
          (local.get $arg0) (local.get $arg1) (local.get $arg2)
          (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
        (return)))
    (if (i32.eq (local.get $opcode) (i32.const 53))
      (then
        (call $handle_DescribePixelFormat
          (local.get $arg0) (local.get $arg1) (local.get $arg2)
          (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
        (return)))
    (if (i32.eq (local.get $opcode) (i32.const 54))
      (then
        (call $handle_SetPixelFormat
          (local.get $arg0) (local.get $arg1) (local.get $arg2)
          (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
        (return)))

    ;; glGetString returns process-stable guest pointers. Claim an extension in
    ;; GL_EXTENSIONS only when this frontend really implements it -- an app that
    ;; reads the string takes a different code path on the strength of it.
    ;; ARB_multitexture is implemented (two fixed-function stages, per-unit
    ;; client arrays and bindings) and Warcraft III's menu text depends on it.
    ;; Quake II is unaffected: its ref_gl.dll only ever tests for the older
    ;; GL_SGIS_multitexture spelling, which its own console log confirms it
    ;; still reports as not found, so it stays on its OpenGL 1.1 path.
    (if (i32.eq (local.get $opcode) (i32.const 14))
      (then
        (local.set $string_wa
          (if (result i32) (i32.eq (local.get $arg0) (i32.const 0x1F00))
            (then (region.addr $TT_FONT_STRING_STORAGE 0x60))
            (else
              (if (result i32) (i32.eq (local.get $arg0) (i32.const 0x1F01))
                (then (region.addr $TT_FONT_STRING_STORAGE 0x70))
                (else
                  (if (result i32) (i32.eq (local.get $arg0) (i32.const 0x1F02))
                    (then (region.addr $TT_FONT_STRING_STORAGE 0x88))
                    (else (region.addr $TT_FONT_STRING_STORAGE 0xA0))))))))
        (i32.store offset=0 (global.get $reg_base) (call $gpu_linear_to_guest (local.get $string_wa)))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))

    ;; wglGetProcAddress. An extension named in GL_EXTENSIONS has to be
    ;; obtainable, and an extension entry point is an ordinary API here, so
    ;; hand back a dispatch thunk exactly as GetProcAddress does. The global
    ;; import table also contains fail-fast aliases and unrelated Win32 APIs;
    ;; existence there is not driver support. The generated predicate uses
    ;; the actual GL/WGL dispatcher implementation set (excluding GLU).
    (if (i32.eq (local.get $opcode) (i32.const 50))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (block $wgpa
          (br_if $wgpa (i32.lt_u (local.get $arg0) (i32.const 0x10000)))
          (local.set $name_wa (call $g2w (local.get $arg0)))
          (local.set $len (call $guest_strlen (local.get $arg0)))
          (local.set $rec (call $heap_alloc (i32.add (local.get $len) (i32.const 3))))
          (br_if $wgpa (i32.eqz (local.get $rec)))
          (local.set $string_wa (call $g2w (local.get $rec)))
          (i32.store16 (local.get $string_wa) (i32.const 0))
          (call $memcpy (i32.add (local.get $string_wa) (i32.const 2))
            (local.get $name_wa) (i32.add (local.get $len) (i32.const 1)))
          (local.set $api_id
            (call $lookup_api_id (i32.add (local.get $string_wa) (i32.const 2))))
          (br_if $wgpa (i32.eq (local.get $api_id) (i32.const 0xFFFF)))
          (br_if $wgpa (i32.eqz (call $wgl_api_available (local.get $api_id))))
          (global.set $num_thunks (call $thunk_reserve))
          (local.set $aux (i32.add (global.get $THUNK_BASE)
            (i32.mul (global.get $num_thunks) (i32.const 8))))
          (i32.store (local.get $aux)
            (i32.sub (local.get $string_wa) (global.get $GUEST_BASE)))
          (i32.store offset=4 (local.get $aux) (local.get $api_id))
          (i32.store offset=0 (global.get $reg_base) (i32.add
            (i32.sub (local.get $aux) (global.get $GUEST_BASE))
            (global.get $image_base)))
          (global.set $num_thunks (i32.add (global.get $num_thunks) (i32.const 1)))
          (call $update_thunk_end))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))

    ;; WGL context creation/make-current needs the target owning the supplied
    ;; HDC. Window DC state stores the HWND at offset 92 (high bit = whole
    ;; window).
    ;;
    ;; A DC with no owning window is not a broken window DC -- it is a memory
    ;; DC, and a GL context created on one is PFD_DRAW_TO_BITMAP: the drawable
    ;; is the DIB section selected into it, and the application blits those
    ;; bits around with ordinary GDI afterwards. SimGolf renders its whole
    ;; course that way (docs/re-notes/simgolf-demo.md), and substituting
    ;; $main_hwnd here published the frame as a window layer while the DIB the
    ;; game actually blits from stayed black -- the course was missing while
    ;; the interface drawn over it was perfect. Hand the host the selected
    ;; bitmap's surface id instead, tagged with the high bit so it can tell a
    ;; bitmap target from an HWND.
    (if (i32.or
          (i32.eq (local.get $opcode) (i32.const 48))
          (i32.eq (local.get $opcode) (i32.const 51)))
      (then
        (local.set $aux (i32.and
          (call $gdi_dc_get_field (local.get $arg0) (i32.const 92) (i32.const 0))
          (i32.const 0x7FFFFFFF)))
        (if (i32.eqz (local.get $aux))
          (then
            (local.set $bmp (call $gdi_dc_bitmap_record (local.get $arg0)))
            (if (i32.eqz (call $gdi_bitmap_record_valid (local.get $bmp)))
              ;; No window and no usable bitmap: nothing to draw into, but the
              ;; app is asking for a context anyway. Keep the historical guess.
              (then (local.set $aux (global.get $main_hwnd)))
              (else
                ;; A plain bitmap has no host presentation -- only window,
                ;; metafile and DirectDraw DCs ever call gdi_surface_create --
                ;; so publish one over the record's own canonical bits before
                ;; naming it as the drawable. The id is the bitmap handle,
                ;; matching the convention gdi_surface_upload already uses for
                ;; bitmaps (10a:764). Creating one that already exists with the
                ;; same geometry is a no-op on the host side.
                (local.set $aux (i32.load (local.get $bmp)))
                (if (call $host_gdi_surface_create
                      (local.get $aux)
                      (i32.load offset=8 (local.get $bmp))
                      (i32.load offset=12 (local.get $bmp))
                      (i32.load offset=16 (local.get $bmp))
                      (i32.load offset=24 (local.get $bmp))
                      (i32.load offset=28 (local.get $bmp))
                      (i32.ne (i32.and (i32.load offset=20 (local.get $bmp))
                        (i32.const 0x02)) (i32.const 0))
                      (i32.load offset=32 (local.get $bmp))
                      (i32.load offset=36 (local.get $bmp))
                      (i32.const 0) (i32.const 0) (i32.const 0))
                  (then
                    (i32.store offset=40 (local.get $bmp) (local.get $aux))
                    (local.set $aux (i32.or (local.get $aux)
                      (i32.const 0x80000000))))
                  (else (local.set $aux (global.get $main_hwnd))))))))))

    (i32.store offset=0 (global.get $reg_base) (call $gl_wat_encode_call
      (local.get $opcode) (call $g2w (i32.load offset=16 (global.get $reg_base))) (local.get $aux)))
    ;; OpenGL entry points use APIENTRY/stdcall. stack_dwords counts physical
    ;; 32-bit stack words, so GLdouble arguments correctly consume two each.
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base))
      (i32.shl (i32.add (local.get $stack_dwords) (i32.const 1)) (i32.const 2))))
    ;; 55 is wglSwapBuffers: the frame end.
    (if (i32.eq (local.get $opcode) (i32.const 55)) (then (call $present_frame_end)))
  )

  ;; wglSwapLayerBuffers(hdc, fuPlanes) -> BOOL. Warcraft III presents through
  ;; this spelling rather than SwapBuffers. This frontend owns exactly one
  ;; drawing surface per context, so only WGL_SWAP_MAIN_PLANE (0x1) can be
  ;; honoured; an overlay or underlay plane request is refused rather than
  ;; silently presenting the main plane in its place.
  (func $handle_wglSwapLayerBuffers
      (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
      (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (i32.and (local.get $arg1) (i32.const 0x00000001)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    ;; Opcode 55 is gpuPresent, shared with SwapBuffers/wglSwapBuffers. A zero
    ;; result means no current context, which is a genuine failure here.
    (i32.store offset=0 (global.get $reg_base) (call $gl_wat_encode_call
      (i32.const 55) (call $g2w (i32.load offset=16 (global.get $reg_base))) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
    (call $present_frame_end)
  )

  ;; Layer planes. The one pixel format DescribePixelFormat reports has no
  ;; overlay or underlay planes (bReserved 0, $gdi_pixel_format_write), so
  ;; there is no layer plane to describe or to hold a palette, and opengl32
  ;; answers as it does for such a format: FALSE, or 0 entries. MDK2's demo
  ;; resolves all four through GetProcAddress and gives up on OpenGL when any
  ;; of them is missing; it never calls them.
  ;; Is iLayerPlane a layer plane of the DC's pixel format? Positive planes
  ;; are overlays and negative ones underlays; the counts are the descriptor's
  ;; bReserved nibbles (overlays low, underlays high), read from the same
  ;; descriptor DescribePixelFormat reports. 0 is the main plane, never a
  ;; layer. ERROR_INVALID_PARAMETER for anything that is not a layer.
  (func $wgl_layer_plane_exists (param $hdc i32) (param $plane i32) (result i32)
    (local $pfd i32) (local $reserved i32) (local $ok i32)
    (if (i32.eqz (call $gdi_dc_state_entry (local.get $hdc) (i32.const 0)))
      (then (global.set $last_error (i32.const 6)) (return (i32.const 0)))) ;; ERROR_INVALID_HANDLE
    (local.set $pfd (call $heap_alloc (i32.const 40)))
    (if (i32.eqz (local.get $pfd)) (then (global.set $last_error (i32.const 8)) (return (i32.const 0))))
    (drop (call $gdi_pixel_format_write (call $g2w (local.get $pfd)) (i32.const 40)))
    (local.set $reserved (call $gl8 (i32.add (local.get $pfd) (i32.const 36))))
    (call $heap_free (local.get $pfd))
    (local.set $ok (if (result i32) (i32.gt_s (local.get $plane) (i32.const 0))
      (then (i32.le_s (local.get $plane) (i32.and (local.get $reserved) (i32.const 0x0f))))
      (else (if (result i32) (i32.lt_s (local.get $plane) (i32.const 0))
        (then (i32.le_s (i32.sub (i32.const 0) (local.get $plane))
          (i32.shr_u (local.get $reserved) (i32.const 4))))
        (else (i32.const 0))))))
    (if (i32.eqz (local.get $ok)) (then (global.set $last_error (i32.const 87))))
    (local.get $ok))

  ;; A plane that does exist has no description or palette this frontend can
  ;; supply yet, so these fail fast for it instead of answering.
  ;; wglDescribeLayerPlane(hdc, iPixelFormat, iLayerPlane, nBytes, plpd) -> BOOL
  (func $handle_wglDescribeLayerPlane (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (call $wgl_layer_plane_exists (local.get $arg0) (local.get $arg2))
      (then (call $crash_unimplemented (local.get $name_ptr))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
  ;; wglGetLayerPaletteEntries / wglSetLayerPaletteEntries(hdc, iLayerPlane,
  ;; iStart, cEntries, pcr) -> entries copied: one body (api_table aliases).
  (func $handle_wgl_layer_palette_entries (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (call $wgl_layer_plane_exists (local.get $arg0) (local.get $arg1))
      (then (call $crash_unimplemented (local.get $name_ptr))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
  ;; wglRealizeLayerPalette(hdc, iLayerPlane, bRealize) -> BOOL
  (func $handle_wglRealizeLayerPalette (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (call $wgl_layer_plane_exists (local.get $arg0) (local.get $arg1))
      (then (call $crash_unimplemented (local.get $name_ptr))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; glRectf is one list command, lowered at execution time to GL_QUADS.
  ;; Keeping it atomic lets replay inside Begin reject the whole rectangle
  ;; without ending or replacing the caller's primitive. The list interceptor
  ;; validates that case (including compilation's shadow Begin state).
  (func $gl_rectf (param $stack i32)
    (local $x1 f32) (local $y1 f32) (local $x2 f32) (local $y2 f32)
    (local.set $x1 (f32.load offset=4 (local.get $stack)))
    (local.set $y1 (f32.load offset=8 (local.get $stack)))
    (local.set $x2 (f32.load offset=12 (local.get $stack)))
    (local.set $y2 (f32.load offset=16 (local.get $stack)))
    (global.set $gl_immediate_mode (i32.const 7))
    (global.set $gl_immediate_floats (i32.const 0))
    (call $gl_append_vertex (local.get $x1) (local.get $y1) (f32.const 0))
    (call $gl_append_vertex (local.get $x2) (local.get $y1) (f32.const 0))
    (call $gl_append_vertex (local.get $x2) (local.get $y2) (f32.const 0))
    (call $gl_append_vertex (local.get $x1) (local.get $y2) (f32.const 0))
    (drop (call $gl_finish_immediate)))

  ;; Rectangle aliases snapshot coordinates at the existing packed-f32 boundary.
  ;; Vertex coordinates use signed numeric conversion, never color normalization.
  ;; Validate each element before page-aware loads (including split doubles).
  (func $gl_rect_component (param $p i32) (param $kind i32) (result f32)
    (local $last i32)
    (local.set $last (if (result i32) (i32.eq (local.get $kind) (i32.const 0x140a))
      (then (i32.const 7)) (else (if (result i32) (i32.eq (local.get $kind) (i32.const 0x1402))
        (then (i32.const 1)) (else (i32.const 3))))))
    (if (i32.gt_u (local.get $p) (i32.sub (i32.const -1) (local.get $last))) (then (unreachable)))
    (if (i32.eq (call $g2w (local.get $p)) (global.get $NULL_SENTINEL)) (then (unreachable)))
    (if (i32.eq (call $g2w (i32.add (local.get $p) (local.get $last))) (global.get $NULL_SENTINEL)) (then (unreachable)))
    (if (i32.eq (local.get $kind) (i32.const 0x140a)) (then
      (return (f32.demote_f64 (f64.reinterpret_i64 (call $gl64 (local.get $p)))))))
    (if (i32.eq (local.get $kind) (i32.const 0x1406)) (then
      (return (f32.reinterpret_i32 (call $gl32 (local.get $p))))))
    (if (i32.eq (local.get $kind) (i32.const 0x1402)) (then
      (return (f32.convert_i32_s
        (i32.shr_s (i32.shl (call $gl16 (local.get $p)) (i32.const 16)) (i32.const 16))))))
    (f32.convert_i32_s (call $gl32 (local.get $p))))

  ;; Each pair has a declared stride: DWORD scalar slots, tightly packed
  ;; vectors, or eight-byte doubles. Load both pairs before allocating/encoding.
  ;; Opcode142 owns list value capture and atomic Begin/replay validation.
  (func $gl_rect_values (param $p1 i32) (param $p2 i32) (param $stride i32) (param $kind i32)
    (local $x1 f32) (local $y1 f32) (local $x2 f32) (local $y2 f32)
    (local $guest i32) (local $stack i32)
    (if (i32.gt_u (local.get $p1) (i32.sub (i32.const -1) (local.get $stride))) (then (unreachable)))
    (if (i32.gt_u (local.get $p2) (i32.sub (i32.const -1) (local.get $stride))) (then (unreachable)))
    (local.set $x1 (call $gl_rect_component (local.get $p1) (local.get $kind)))
    (local.set $y1 (call $gl_rect_component (i32.add (local.get $p1) (local.get $stride)) (local.get $kind)))
    (local.set $x2 (call $gl_rect_component (local.get $p2) (local.get $kind)))
    (local.set $y2 (call $gl_rect_component (i32.add (local.get $p2) (local.get $stride)) (local.get $kind)))
    (local.set $guest (call $gl_alloc_affine (i32.const 20)))
    (if (i32.eqz (local.get $guest)) (then (unreachable)))
    (local.set $stack (call $g2w (local.get $guest)))
    (i32.store (local.get $stack) (i32.const 0))
    (f32.store offset=4 (local.get $stack) (local.get $x1))
    (f32.store offset=8 (local.get $stack) (local.get $y1))
    (f32.store offset=12 (local.get $stack) (local.get $x2))
    (f32.store offset=16 (local.get $stack) (local.get $y2))
    (drop (call $gl_wat_encode_call (i32.const 142) (local.get $stack) (i32.const 0)))
    (call $heap_free (local.get $guest)))

  (func $handle_glRectd (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $esp i32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (if (i32.gt_u (local.get $esp) (i32.const 0xffffffdb)) (then (unreachable)))
    (call $gl_rect_values (i32.add (local.get $esp) (i32.const 4)) (i32.add (local.get $esp) (i32.const 20)) (i32.const 8) (i32.const 0x140a))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36))))

  (func $handle_glRectdv (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $gl_rect_values (local.get $arg0) (local.get $arg1) (i32.const 8) (i32.const 0x140a))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_glRectfv (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $gl_rect_values (local.get $arg0) (local.get $arg1) (i32.const 4) (i32.const 0x1406))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_glRecti (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $esp i32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (if (i32.gt_u (local.get $esp) (i32.const 0xffffffeb)) (then (unreachable)))
    (call $gl_rect_values (i32.add (local.get $esp) (i32.const 4)) (i32.add (local.get $esp) (i32.const 12)) (i32.const 4) (i32.const 0x1404))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  (func $handle_glRectiv (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $gl_rect_values (local.get $arg0) (local.get $arg1) (i32.const 4) (i32.const 0x1404))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_glRects (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $esp i32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (if (i32.gt_u (local.get $esp) (i32.const 0xffffffeb)) (then (unreachable)))
    (call $gl_rect_values (i32.add (local.get $esp) (i32.const 4)) (i32.add (local.get $esp) (i32.const 12)) (i32.const 4) (i32.const 0x1402))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  (func $handle_glRectsv (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $gl_rect_values (local.get $arg0) (local.get $arg1) (i32.const 2) (i32.const 0x1402))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; Snapshot sixteen column-major doubles at the canonical f32 boundary.
  (func $handle_glLoadMatrixd (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $guest i32) (local $stack i32) (local $i i32)
    (if (i32.gt_u (local.get $arg0) (i32.const 0xffffff80)) (then (unreachable)))
    (if (i32.eq (call $g2w (local.get $arg0)) (global.get $NULL_SENTINEL)) (then (unreachable)))
    (if (i32.eq (call $g2w (i32.add (local.get $arg0) (i32.const 127))) (global.get $NULL_SENTINEL)) (then (unreachable)))
    ;; Eight stack bytes and 64 pointed bytes in one invocation-owned affine
    ;; allocation. Do not retain the caller's pointer after returning.
    (local.set $guest (call $gl_alloc_affine (i32.const 72)))
    (if (i32.eqz (local.get $guest)) (then (unreachable)))
    (local.set $stack (call $g2w (local.get $guest)))
    (i32.store (local.get $stack) (i32.const 0))
    (i32.store offset=4 (local.get $stack) (i32.add (local.get $guest) (i32.const 8)))
    (loop $copy
      (f32.store (i32.add (local.get $stack) (i32.add (i32.const 8) (i32.shl (local.get $i) (i32.const 2))))
        (f32.demote_f64 (f64.reinterpret_i64 (call $gl64
          (i32.add (local.get $arg0) (i32.shl (local.get $i) (i32.const 3)))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $copy (i32.lt_u (local.get $i) (i32.const 16))))
    (drop (call $gl_wat_encode_call (i32.const 34) (local.get $stack) (i32.const 0)))
    (call $heap_free (local.get $guest))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; Scalar doubles occupy six DWORDs, not three dispatcher i32 arguments.
  ;; Read all values before allocation/encoding, including across sparse pages.
  (func $gl_double_transform (param $p i32) (param $op i32)
    (local $x f32) (local $y f32) (local $z f32)
    (local $guest i32) (local $stack i32)
    (if (i32.gt_u (local.get $p) (i32.const 0xffffffe8)) (then (unreachable)))
    (if (i32.eq (call $g2w (local.get $p)) (global.get $NULL_SENTINEL)) (then (unreachable)))
    (if (i32.eq (call $g2w (i32.add (local.get $p) (i32.const 23))) (global.get $NULL_SENTINEL)) (then (unreachable)))
    (local.set $x (f32.demote_f64 (f64.reinterpret_i64 (call $gl64 (local.get $p)))))
    (local.set $y (f32.demote_f64 (f64.reinterpret_i64 (call $gl64 (i32.add (local.get $p) (i32.const 8))))))
    (local.set $z (f32.demote_f64 (f64.reinterpret_i64 (call $gl64 (i32.add (local.get $p) (i32.const 16))))))
    (local.set $guest (call $gl_alloc_affine (i32.const 16)))
    (if (i32.eqz (local.get $guest)) (then (unreachable)))
    (local.set $stack (call $g2w (local.get $guest)))
    (i32.store (local.get $stack) (i32.const 0))
    (f32.store offset=4 (local.get $stack) (local.get $x))
    (f32.store offset=8 (local.get $stack) (local.get $y))
    (f32.store offset=12 (local.get $stack) (local.get $z))
    (drop (call $gl_wat_encode_call (local.get $op) (local.get $stack) (i32.const 0)))
    (call $heap_free (local.get $guest)))

  (func $handle_glTranslated (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $esp i32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (if (i32.gt_u (local.get $esp) (i32.const 0xffffffe3)) (then (unreachable)))
    (call $gl_double_transform (i32.add (local.get $esp) (i32.const 4)) (i32.const 41))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))

  (func $handle_glScaled (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $esp i32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (if (i32.gt_u (local.get $esp) (i32.const 0xffffffe3)) (then (unreachable)))
    (call $gl_double_transform (i32.add (local.get $esp) (i32.const 4)) (i32.const 40))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))

  ;; glMultMatrixd: snapshot sixteen guest doubles in column-major order at
  ;; the existing float-matrix encoder boundary. Opcode 109 owns matrix mode,
  ;; postmultiplication, Begin validation, stream copies and list value capture.
  ;; The 128-byte source crosses at most two pages; validate before allocating
  ;; or changing GL state. gl64 reads each double across non-affine pages.
  (func $handle_glMultMatrixd (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $guest i32) (local $stack i32) (local $i i32)
    (if (i32.gt_u (local.get $arg0) (i32.const 0xffffff80)) (then (unreachable)))
    (if (i32.eq (call $g2w (local.get $arg0)) (global.get $NULL_SENTINEL)) (then (unreachable)))
    (if (i32.eq (call $g2w (i32.add (local.get $arg0) (i32.const 127))) (global.get $NULL_SENTINEL)) (then (unreachable)))
    ;; Eight stack bytes and 64 pointed bytes in one invocation-owned affine
    ;; allocation. Do not retain the caller's pointer after returning.
    (local.set $guest (call $gl_alloc_affine (i32.const 72)))
    (if (i32.eqz (local.get $guest)) (then (unreachable)))
    (local.set $stack (call $g2w (local.get $guest)))
    (i32.store (local.get $stack) (i32.const 0))
    (i32.store offset=4 (local.get $stack) (i32.add (local.get $guest) (i32.const 8)))
    (loop $copy
      (f32.store (i32.add (local.get $stack) (i32.add (i32.const 8) (i32.shl (local.get $i) (i32.const 2))))
        (f32.demote_f64 (f64.reinterpret_i64 (call $gl64
          (i32.add (local.get $arg0) (i32.shl (local.get $i) (i32.const 3)))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $copy (i32.lt_u (local.get $i) (i32.const 16))))
    (drop (call $gl_wat_encode_call (i32.const 109) (local.get $stack) (i32.const 0)))
    (call $heap_free (local.get $guest))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; glTexCoord2i uses signed numeric conversion, without normalization.
  ;; Encode the canonical f32 setter so lists and both renderers agree.
  (func $handle_glTexCoord2i (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $guest i32) (local $stack i32)
    (local.set $guest (call $gl_alloc_affine (i32.const 12)))
    (if (i32.eqz (local.get $guest)) (then (unreachable)))
    (local.set $stack (call $g2w (local.get $guest)))
    (i32.store (local.get $stack) (i32.const 0))
    (f32.store offset=4 (local.get $stack) (f32.convert_i32_s (local.get $arg0)))
    (f32.store offset=8 (local.get $stack) (f32.convert_i32_s (local.get $arg1)))
    (drop (call $gl_wat_encode_call (i32.const 28) (local.get $stack) (i32.const 0)))
    (call $heap_free (local.get $guest))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; glTexCoord2d(GLdouble s, GLdouble t): the scalar arguments occupy four
  ;; x86 stack words. Reuse the vector's checked guest-double loads and encoder
  ;; path from ESP+4, never the dispatcher's individual i32 argument values.
  (func $handle_glTexCoord2d (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $esp i32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (if (i32.gt_u (local.get $esp) (i32.const 0xffffffeb)) (then (unreachable)))
    (call $handle_glTexCoord2dv (i32.add (local.get $esp) (i32.const 4))
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (local.get $name_ptr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (local.get $esp) (i32.const 20))))

  ;; glTexCoord2dv(const GLdouble *v): unit zero's current (s,t,0,1).
  ;; Validate both ends of this at-most-two-page vector: gl64 itself permits
  ;; the null sentinel on a missing translation. A miss must not install zero
  ;; coordinates. Load both doubles before changing any current attribute.
  ;; Demotion is the existing packed-f32 encoder boundary, as for glTexCoord2f.
  (func $handle_glTexCoord2dv (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $s f32) (local $t f32) (local $guest i32) (local $stack i32)
    (if (i32.gt_u (local.get $arg0) (i32.const 0xfffffff0)) (then (unreachable)))
    (if (i32.eq (call $g2w (local.get $arg0)) (global.get $NULL_SENTINEL)) (then (unreachable)))
    (if (i32.eq (call $g2w (i32.add (local.get $arg0) (i32.const 15))) (global.get $NULL_SENTINEL)) (then (unreachable)))
    (local.set $s (f32.demote_f64 (f64.reinterpret_i64 (call $gl64 (local.get $arg0)))))
    (local.set $t (f32.demote_f64 (f64.reinterpret_i64 (call $gl64 (i32.add (local.get $arg0) (i32.const 8))))))
    ;; Canonical glTexCoord2f opcode owns list capture/replay as well as current
    ;; state. Snapshot by value on an invocation-owned stack, as glColor4dv does.
    (local.set $guest (call $gl_alloc_affine (i32.const 12)))
    (if (i32.eqz (local.get $guest)) (then (unreachable)))
    (local.set $stack (call $g2w (local.get $guest)))
    (i32.store (local.get $stack) (i32.const 0))
    (f32.store offset=4 (local.get $stack) (local.get $s))
    (f32.store offset=8 (local.get $stack) (local.get $t))
    (drop (call $gl_wat_encode_call (i32.const 28) (local.get $stack) (i32.const 0)))
    (call $heap_free (local.get $guest))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; OpenGL 1.1 table 2.6: signed color uses (2*c+1)/(2^bits-1),
  ;; unsigned color uses c/(2^bits-1). In particular signed zero is not 0.
  ;; Widen before arithmetic so the GLint numerator cannot overflow, then
  ;; demote once at the existing canonical float-color boundary.
  (func $gl_color_integer_component (param $p i32) (param $bits i32) (param $signed i32) (result f32)
    (local $c i32) (local $shift i32) (local $den f64) (local $value f64)
    (local.set $c (if (result i32) (i32.eq (local.get $bits) (i32.const 8))
      (then (call $gl8 (local.get $p)))
      (else (if (result i32) (i32.eq (local.get $bits) (i32.const 16))
        (then (call $gl16 (local.get $p))) (else (call $gl32 (local.get $p)))))))
    (local.set $den (f64.convert_i64_u
      (i64.sub (i64.shl (i64.const 1) (i64.extend_i32_u (local.get $bits))) (i64.const 1))))
    (if (local.get $signed)
      (then
        (local.set $shift (i32.sub (i32.const 32) (local.get $bits)))
        (local.set $c (i32.shr_s (i32.shl (local.get $c) (local.get $shift)) (local.get $shift)))
        (local.set $value (f64.add (f64.mul (f64.convert_i32_s (local.get $c)) (f64.const 2)) (f64.const 1))))
      (else (local.set $value (f64.convert_i32_u (local.get $c)))))
    (f32.demote_f64 (f64.div (local.get $value) (local.get $den))))

  ;; The generator supplies only the twenty implemented integer-color shapes.
  ;; Scalar byte/short arguments occupy DWORD slots but use their low bits;
  ;; vectors contain exactly three/four tightly packed elements. Snapshot all
  ;; values before encoding so display lists own values, never guest pointers.
  (func $handle_glColor_integer (param $components i32) (param $bits i32)
      (param $signed i32) (param $vector i32) (param $arg0 i32)
    (local $esp i32) (local $p i32) (local $stride i32) (local $last i32)
    (local $guest i32) (local $stack i32)
    (local $r f32) (local $g f32) (local $b f32) (local $a f32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (local.set $stride (select (i32.shr_u (local.get $bits) (i32.const 3)) (i32.const 4) (local.get $vector)))
    (if (local.get $vector)
      (then (local.set $p (local.get $arg0)))
      (else
        (if (i32.gt_u (local.get $esp) (i32.const 0xfffffffb)) (then (unreachable)))
        (local.set $p (i32.add (local.get $esp) (i32.const 4)))))
    ;; At most 16 source bytes, crossing at most two guest pages. Validate
    ;; wrap and both mappings before gl8/16/32 could read a null sentinel.
    ;; A scalar's last argument still reads only its declared element width.
    (local.set $last (i32.sub
      (i32.add (i32.mul (i32.sub (local.get $components) (i32.const 1)) (local.get $stride))
        (i32.shr_u (local.get $bits) (i32.const 3))) (i32.const 1)))
    (if (i32.gt_u (local.get $p) (i32.sub (i32.const -1) (local.get $last))) (then (unreachable)))
    (if (i32.eq (call $g2w (local.get $p)) (global.get $NULL_SENTINEL)) (then (unreachable)))
    (if (i32.eq (call $g2w (i32.add (local.get $p) (local.get $last))) (global.get $NULL_SENTINEL)) (then (unreachable)))
    (local.set $r (call $gl_color_integer_component (local.get $p) (local.get $bits) (local.get $signed)))
    (local.set $g (call $gl_color_integer_component (i32.add (local.get $p) (local.get $stride)) (local.get $bits) (local.get $signed)))
    (local.set $b (call $gl_color_integer_component (i32.add (local.get $p) (i32.mul (local.get $stride) (i32.const 2))) (local.get $bits) (local.get $signed)))
    (local.set $a (f32.const 1))
    (if (i32.eq (local.get $components) (i32.const 4))
      (then (local.set $a (call $gl_color_integer_component (i32.add (local.get $p) (i32.mul (local.get $stride) (i32.const 3))) (local.get $bits) (local.get $signed)))))
    (local.set $guest (call $gl_alloc_affine (i32.const 20)))
    (if (i32.eqz (local.get $guest)) (then (unreachable)))
    (local.set $stack (call $g2w (local.get $guest)))
    (i32.store (local.get $stack) (i32.const 0))
    (f32.store offset=4 (local.get $stack) (local.get $r))
    (f32.store offset=8 (local.get $stack) (local.get $g))
    (f32.store offset=12 (local.get $stack) (local.get $b))
    (f32.store offset=16 (local.get $stack) (local.get $a))
    (drop (call $gl_wat_encode_call (i32.const 25) (local.get $stack) (i32.const 0)))
    (call $heap_free (local.get $guest))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (local.get $esp)
      (select (i32.const 8) (i32.shl (i32.add (local.get $components) (i32.const 1)) (i32.const 2)) (local.get $vector)))))

  ;; glColor3dv(const GLdouble *v): exactly three doubles, implicit alpha 1.
  (func $handle_glColor3dv (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $gl_color_dv (local.get $arg0) (i32.const 3))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_glColor4dv (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $gl_color_dv (local.get $arg0) (i32.const 4))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; glColor3d uses the same checked three-double path as glColor3dv.
  (func $handle_glColor3d (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $esp i32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (if (i32.gt_u (local.get $esp) (i32.const 0xffffffe4)) (then (unreachable)))
    (call $gl_color_dv (i32.add (local.get $esp) (i32.const 4)) (i32.const 3))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))

  ;; Double-vector colors. Snapshot all guest components before
  ;; entering the encoder. Canonical scalar opcode 25 owns current color,
  ;; GL_COMPILE/COMPILE_AND_EXECUTE capture and replay, and packed vertices.
  ;; Keep signed/out-of-range floating colors unclamped here, as glColor4f
  ;; does; rasterization owns clamping. No persistent command opcode changes.
  (func $gl_color_dv (param $arg0 i32) (param $components i32)
    (local $r f32) (local $g f32) (local $b f32) (local $a f32)
    (local $guest i32) (local $stack i32) (local $last i32)
    ;; These 24/32-byte vectors cross at most one guest page boundary. Reject
    ;; wraparound and missing translations before gl64 can read the sentinel.
    (local.set $last (i32.sub (i32.shl (local.get $components) (i32.const 3)) (i32.const 1)))
    (if (i32.gt_u (local.get $arg0) (i32.sub (i32.const -1) (local.get $last))) (then (unreachable)))
    (if (i32.eq (call $g2w (local.get $arg0)) (global.get $NULL_SENTINEL)) (then (unreachable)))
    (if (i32.eq (call $g2w (i32.add (local.get $arg0) (local.get $last))) (global.get $NULL_SENTINEL)) (then (unreachable)))
    (local.set $r (f32.demote_f64 (f64.reinterpret_i64 (call $gl64 (local.get $arg0)))))
    (local.set $g (f32.demote_f64 (f64.reinterpret_i64 (call $gl64 (i32.add (local.get $arg0) (i32.const 8))))))
    (local.set $b (f32.demote_f64 (f64.reinterpret_i64 (call $gl64 (i32.add (local.get $arg0) (i32.const 16))))))
    (local.set $a (f32.const 1))
    (if (i32.eq (local.get $components) (i32.const 4))
      (then (local.set $a (f32.demote_f64 (f64.reinterpret_i64 (call $gl64 (i32.add (local.get $arg0) (i32.const 24))))))))
    ;; An invocation-owned synthetic stack avoids overwriting guest arguments
    ;; or relying on a shared scratch buffer during nested list execution.
    (local.set $guest (call $gl_alloc_affine (i32.const 20)))
    (if (i32.eqz (local.get $guest)) (then (unreachable)))
    (local.set $stack (call $g2w (local.get $guest)))
    (i32.store (local.get $stack) (i32.const 0))
    (f32.store offset=4 (local.get $stack) (local.get $r))
    (f32.store offset=8 (local.get $stack) (local.get $g))
    (f32.store offset=12 (local.get $stack) (local.get $b))
    (f32.store offset=16 (local.get $stack) (local.get $a))
    (drop (call $gl_wat_encode_call (i32.const 25) (local.get $stack) (i32.const 0)))
    (call $heap_free (local.get $guest)))

  ;; glVertex2dv(const GLdouble *v): Tux Racer's two-component double vector.
  ;; Use guest loads for each component (including non-affine page crossings),
  ;; then the same packed-float vertex pipeline as glVertex2f/glVertex2fv.
  ;; Supply z=0; gl_append_vertex supplies w=1 and preserves current attributes
  ;; and the existing outside-Begin behavior. No new command-stream opcode.
  (func $handle_glVertex2dv (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (call $gl_wat_init)) (then (unreachable)))
    (global.set $gl_wat_stat_calls (i64.add (global.get $gl_wat_stat_calls) (i64.const 1)))
    (call $gl_append_vertex
      (f32.demote_f64 (f64.reinterpret_i64 (call $gl64 (local.get $arg0))))
      (f32.demote_f64 (f64.reinterpret_i64 (call $gl64 (i32.add (local.get $arg0) (i32.const 8)))))
      (f32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; glVertex2d: four physical argument words, canonical 2D vertex opcode.
  (func $handle_glVertex2d (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $esp i32) (local $guest i32) (local $stack i32)
    (local $x f32) (local $y f32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (if (i32.gt_u (local.get $esp) (i32.const 0xffffffec)) (then (unreachable)))
    (if (i32.eq (call $g2w (i32.add (local.get $esp) (i32.const 4))) (global.get $NULL_SENTINEL)) (then (unreachable)))
    (if (i32.eq (call $g2w (i32.add (local.get $esp) (i32.const 19))) (global.get $NULL_SENTINEL)) (then (unreachable)))
    (local.set $x (f32.demote_f64 (f64.reinterpret_i64 (call $gl64 (i32.add (local.get $esp) (i32.const 4))))))
    (local.set $y (f32.demote_f64 (f64.reinterpret_i64 (call $gl64 (i32.add (local.get $esp) (i32.const 12))))))
    (local.set $guest (call $gl_alloc_affine (i32.const 12)))
    (if (i32.eqz (local.get $guest)) (then (unreachable)))
    (local.set $stack (call $g2w (local.get $guest)))
    (i32.store (local.get $stack) (i32.const 0))
    (f32.store offset=4 (local.get $stack) (local.get $x))
    (f32.store offset=8 (local.get $stack) (local.get $y))
    (drop (call $gl_wat_encode_call (i32.const 29) (local.get $stack) (i32.const 0)))
    (call $heap_free (local.get $guest))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; glVertex3d carries three doubles in six stack words. Snapshot and demote
  ;; before entering the canonical vertex opcode (including display lists).
  (func $handle_glVertex3d (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $esp i32) (local $guest i32) (local $stack i32)
    (local $x f32) (local $y f32) (local $z f32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (if (i32.gt_u (local.get $esp) (i32.const 0xffffffe4)) (then (unreachable)))
    (if (i32.eq (call $g2w (i32.add (local.get $esp) (i32.const 4))) (global.get $NULL_SENTINEL)) (then (unreachable)))
    (if (i32.eq (call $g2w (i32.add (local.get $esp) (i32.const 27))) (global.get $NULL_SENTINEL)) (then (unreachable)))
    (local.set $x (f32.demote_f64 (f64.reinterpret_i64 (call $gl64 (i32.add (local.get $esp) (i32.const 4))))))
    (local.set $y (f32.demote_f64 (f64.reinterpret_i64 (call $gl64 (i32.add (local.get $esp) (i32.const 12))))))
    (local.set $z (f32.demote_f64 (f64.reinterpret_i64 (call $gl64 (i32.add (local.get $esp) (i32.const 20))))))
    (local.set $guest (call $gl_alloc_affine (i32.const 16)))
    (if (i32.eqz (local.get $guest)) (then (unreachable)))
    (local.set $stack (call $g2w (local.get $guest)))
    (i32.store (local.get $stack) (i32.const 0))
    (f32.store offset=4 (local.get $stack) (local.get $x))
    (f32.store offset=8 (local.get $stack) (local.get $y))
    (f32.store offset=12 (local.get $stack) (local.get $z))
    (drop (call $gl_wat_encode_call (i32.const 30) (local.get $stack) (i32.const 0)))
    (call $heap_free (local.get $guest))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))

  ;; The OpenGL 1.1 surface outside the measured set. Unreal-engine OpenGlDrv
  ;; resolves its whole GL table through GetProcAddress and refuses to bind if
  ;; a single name is missing, so every GL 1.1 entry point is an api_table
  ;; name. Those not implemented yet land here: fail fast with the guest frame,
  ;; so the first one an app really calls names itself.
  (func $handle_gl_unimplemented (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $host_crash_unimplemented (local.get $name_ptr)
      (i32.load offset=16 (global.get $reg_base)) (global.get $eip) (i32.load offset=20 (global.get $reg_base)))
    (unreachable))

  ;; wglGetCurrentContext() / wglGetCurrentDC(): this thread's current HGLRC
  ;; and the HDC it was made current on (both NULL when none is current).
  ;; Per guest thread, as in Windows, because each thread instance owns its
  ;; own encoder globals.
  (func $handle_wglGetCurrentContext (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (global.get $gl_current_context))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  (func $handle_wglGetCurrentDC (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (global.get $gl_current_dc))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  ;; glRotated has four GLdouble arguments: eight guest DWORDs. Snapshot
  ;; through checked guest reads before allocation, including sparse pages.
  ;; Opcode 90 retains full doubles for normalization, stream/list capture.
  (func $handle_glRotated (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $esp i32) (local $p i32) (local $guest i32) (local $stack i32)
    (local $a i64) (local $x i64) (local $y i64) (local $z i64)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (if (i32.gt_u (local.get $esp) (i32.const 0xffffffdb)) (then (unreachable)))
    (local.set $p (i32.add (local.get $esp) (i32.const 4)))
    (if (i32.eq (call $g2w (local.get $p)) (global.get $NULL_SENTINEL)) (then (unreachable)))
    (if (i32.eq (call $g2w (i32.add (local.get $p) (i32.const 31))) (global.get $NULL_SENTINEL)) (then (unreachable)))
    (local.set $a (call $gl64 (local.get $p)))
    (local.set $x (call $gl64 (i32.add (local.get $p) (i32.const 8))))
    (local.set $y (call $gl64 (i32.add (local.get $p) (i32.const 16))))
    (local.set $z (call $gl64 (i32.add (local.get $p) (i32.const 24))))
    (local.set $guest (call $gl_alloc_affine (i32.const 36)))
    (if (i32.eqz (local.get $guest)) (then (unreachable)))
    (local.set $stack (call $g2w (local.get $guest)))
    (i32.store (local.get $stack) (i32.const 0))
    (i64.store offset=4 (local.get $stack) (local.get $a))
    (i64.store offset=12 (local.get $stack) (local.get $x))
    (i64.store offset=20 (local.get $stack) (local.get $y))
    (i64.store offset=28 (local.get $stack) (local.get $z))
    (drop (call $gl_wat_encode_call (i32.const 90) (local.get $stack) (i32.const 0)))
    (call $heap_free (local.get $guest))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36))))

  ;; GL1.1 typed texture coordinates lower by value to glTexCoord4f. Native
  ;; signed integers convert numerically (unlike normalized colors/normals).
  ;; The rectangle component reader supplies checked, page-aware short/int,
  ;; float and binary64 loads with a single demotion at the encoder boundary.
  (func $gl_texcoord_check (param $p i32) (param $bytes i32)
    (local $last i32)
    (local.set $last (i32.sub (local.get $bytes) (i32.const 1)))
    (if (i32.gt_u (local.get $p) (i32.sub (i32.const -1) (local.get $last))) (then (unreachable)))
    ;; At most 32 bytes, so translated endpoints cover every touched page.
    (if (i32.eq (call $g2w (local.get $p)) (global.get $NULL_SENTINEL)) (then (unreachable)))
    (if (i32.eq (call $g2w (i32.add (local.get $p) (local.get $last))) (global.get $NULL_SENTINEL)) (then (unreachable))))

  (func $handle_glTexCoord_typed (param $components i32) (param $kind i32) (param $vector i32)
    (local $esp i32) (local $p i32) (local $stride i32) (local $cleanup i32)
    (local $guest i32) (local $stack i32)
    (local $s f32) (local $t f32) (local $r f32) (local $q f32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (local.set $stride (if (result i32) (i32.eq (local.get $kind) (i32.const 0x140a))
      (then (i32.const 8)) (else (i32.const 4))))
    (local.set $cleanup (if (result i32) (local.get $vector)
      (then (i32.const 8)) (else (i32.add (i32.const 4) (i32.mul (local.get $components) (local.get $stride))))))
    (if (i32.gt_u (local.get $esp) (i32.sub (i32.const -1) (local.get $cleanup))) (then (unreachable)))
    (call $gl_texcoord_check (i32.add (local.get $esp) (i32.const 4))
      (i32.sub (local.get $cleanup) (i32.const 4)))
    (local.set $p (i32.add (local.get $esp) (i32.const 4)))
    (if (local.get $vector) (then
      ;; Pointer slots may themselves straddle non-affine guest pages.
      (local.set $p (call $gl32 (local.get $p)))
      (if (i32.eq (local.get $kind) (i32.const 0x1402)) (then (local.set $stride (i32.const 2))))
      (call $gl_texcoord_check (local.get $p) (i32.mul (local.get $components) (local.get $stride)))))
    ;; Load every component before allocation, list capture or current state.
    (local.set $s (call $gl_rect_component (local.get $p) (local.get $kind)))
    (if (i32.ge_u (local.get $components) (i32.const 2)) (then
      (local.set $t (call $gl_rect_component (i32.add (local.get $p) (local.get $stride)) (local.get $kind)))))
    (if (i32.ge_u (local.get $components) (i32.const 3)) (then
      (local.set $r (call $gl_rect_component (i32.add (local.get $p) (i32.mul (local.get $stride) (i32.const 2))) (local.get $kind)))))
    (local.set $q (f32.const 1))
    (if (i32.eq (local.get $components) (i32.const 4)) (then
      (local.set $q (call $gl_rect_component (i32.add (local.get $p) (i32.mul (local.get $stride) (i32.const 3))) (local.get $kind)))))
    (local.set $guest (call $gl_alloc_affine (i32.const 20)))
    (if (i32.eqz (local.get $guest)) (then (unreachable)))
    (local.set $stack (call $g2w (local.get $guest)))
    (i32.store (local.get $stack) (i32.const 0))
    (f32.store offset=4 (local.get $stack) (local.get $s))
    (f32.store offset=8 (local.get $stack) (local.get $t))
    (f32.store offset=12 (local.get $stack) (local.get $r))
    (f32.store offset=16 (local.get $stack) (local.get $q))
    (drop (call $gl_wat_encode_call (i32.const 120) (local.get $stack) (i32.const 0)))
    (call $heap_free (local.get $guest))
    (i32.store (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (local.get $esp) (local.get $cleanup))))

  ;; Typed GL1.1 vertices use the existing signed numeric component reader.
  ;; Scalar shorts occupy DWORD slots; vector shorts are tightly packed.
  ;; Snapshot all coordinates before touching the encoder/list/primitive state.
  (func $handle_glVertex_typed (param $components i32) (param $kind i32) (param $vector i32)
    (local $esp i32) (local $p i32) (local $stride i32) (local $cleanup i32)
    (local $guest i32) (local $stack i32)
    (local $x f32) (local $y f32) (local $z f32) (local $w f32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (local.set $stride (if (result i32) (i32.eq (local.get $kind) (i32.const 0x140a))
      (then (i32.const 8)) (else (i32.const 4))))
    (local.set $cleanup (if (result i32) (local.get $vector)
      (then (i32.const 8)) (else (i32.add (i32.const 4) (i32.mul (local.get $components) (local.get $stride))))))
    (if (i32.gt_u (local.get $esp) (i32.sub (i32.const -1) (local.get $cleanup))) (then (unreachable)))
    (call $gl_texcoord_check (local.get $esp) (local.get $cleanup))
    (local.set $p (i32.add (local.get $esp) (i32.const 4)))
    (if (local.get $vector) (then
      (local.set $p (call $gl32 (local.get $p)))
      (if (i32.eq (local.get $kind) (i32.const 0x1402)) (then (local.set $stride (i32.const 2))))
      (call $gl_texcoord_check (local.get $p) (i32.mul (local.get $components) (local.get $stride)))))
    (local.set $x (call $gl_rect_component (local.get $p) (local.get $kind)))
    (local.set $y (call $gl_rect_component (i32.add (local.get $p) (local.get $stride)) (local.get $kind)))
    ;; Locals initialize z=0. Dimensions two and three supply w=1.
    (if (i32.ge_u (local.get $components) (i32.const 3)) (then
      (local.set $z (call $gl_rect_component (i32.add (local.get $p) (i32.mul (local.get $stride) (i32.const 2))) (local.get $kind)))))
    (local.set $w (f32.const 1))
    (if (i32.eq (local.get $components) (i32.const 4)) (then
      (local.set $w (call $gl_rect_component (i32.add (local.get $p) (i32.mul (local.get $stride) (i32.const 3))) (local.get $kind)))))
    (local.set $guest (call $gl_alloc_affine (i32.const 20)))
    (if (i32.eqz (local.get $guest)) (then (unreachable)))
    (local.set $stack (call $g2w (local.get $guest)))
    (i32.store (local.get $stack) (i32.const 0))
    (f32.store offset=4 (local.get $stack) (local.get $x))
    (f32.store offset=8 (local.get $stack) (local.get $y))
    (f32.store offset=12 (local.get $stack) (local.get $z))
    (f32.store offset=16 (local.get $stack) (local.get $w))
    ;; Canonical glVertex4f owns homogeneous packing, current attributes,
    ;; Begin behavior and display-list value capture.
    (drop (call $gl_wat_encode_call (i32.const 118) (local.get $stack) (i32.const 0)))
    (call $heap_free (local.get $guest))
    (i32.store (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (local.get $esp) (local.get $cleanup))))

  ;; RasterPos aliases snapshot signed numeric coordinates (not normalized),
  ;; with z=0 and w=1 defaults. Opcode146 owns raster/list execution.
  (func $handle_glRasterPos_typed (param $components i32) (param $kind i32) (param $vector i32)
    (local $esp i32) (local $p i32) (local $stride i32) (local $cleanup i32)
    (local $guest i32) (local $stack i32)
    (local $s f32) (local $t f32) (local $r f32) (local $q f32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (local.set $stride (if (result i32) (i32.eq (local.get $kind) (i32.const 0x140a))
      (then (i32.const 8)) (else (i32.const 4))))
    (local.set $cleanup (if (result i32) (local.get $vector)
      (then (i32.const 8)) (else (i32.add (i32.const 4) (i32.mul (local.get $components) (local.get $stride))))))
    (if (i32.gt_u (local.get $esp) (i32.sub (i32.const -1) (local.get $cleanup))) (then (unreachable)))
    (call $gl_texcoord_check (local.get $esp) (local.get $cleanup))
    (local.set $p (i32.add (local.get $esp) (i32.const 4)))
    (if (local.get $vector) (then
      ;; Pointer slots may themselves straddle non-affine guest pages.
      (local.set $p (call $gl32 (local.get $p)))
      (if (i32.eq (local.get $kind) (i32.const 0x1402)) (then (local.set $stride (i32.const 2))))
      (call $gl_texcoord_check (local.get $p) (i32.mul (local.get $components) (local.get $stride)))))
    ;; Load every component before allocation, list capture or current state.
    (local.set $s (call $gl_rect_component (local.get $p) (local.get $kind)))
    (if (i32.ge_u (local.get $components) (i32.const 2)) (then
      (local.set $t (call $gl_rect_component (i32.add (local.get $p) (local.get $stride)) (local.get $kind)))))
    (if (i32.ge_u (local.get $components) (i32.const 3)) (then
      (local.set $r (call $gl_rect_component (i32.add (local.get $p) (i32.mul (local.get $stride) (i32.const 2))) (local.get $kind)))))
    (local.set $q (f32.const 1))
    (if (i32.eq (local.get $components) (i32.const 4)) (then
      (local.set $q (call $gl_rect_component (i32.add (local.get $p) (i32.mul (local.get $stride) (i32.const 3))) (local.get $kind)))))
    (local.set $guest (call $gl_alloc_affine (i32.const 20)))
    (if (i32.eqz (local.get $guest)) (then (unreachable)))
    (local.set $stack (call $g2w (local.get $guest)))
    (i32.store (local.get $stack) (i32.const 0))
    (f32.store offset=4 (local.get $stack) (local.get $s))
    (f32.store offset=8 (local.get $stack) (local.get $t))
    (f32.store offset=12 (local.get $stack) (local.get $r))
    (f32.store offset=16 (local.get $stack) (local.get $q))
    (drop (call $gl_wat_encode_call (i32.const 146) (local.get $stack) (i32.const 0)))
    (call $heap_free (local.get $guest))
    (i32.store (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (local.get $esp) (local.get $cleanup))))

  ;; Integer lighting/fog adapters. GL1.1 tables 2.6 and 2.8 distinguish
  ;; signed normalized colors from numeric positions, directions and reals.
  ;; Families: 0 fog, 1 light model, 2 light source, 3 material.
  (func $gl_lmf_count (param $family i32) (param $name i32) (result i32)
    (if (i32.eqz (local.get $family)) (then
      (if (i32.eq (local.get $name) (i32.const 0xb66)) (then (return (i32.const 4))))
      (if (i32.le_u (i32.sub (local.get $name) (i32.const 0xb61)) (i32.const 4)) (then (return (i32.const 1))))))
    (if (i32.eq (local.get $family) (i32.const 1)) (then
      (if (i32.eq (local.get $name) (i32.const 0xb53)) (then (return (i32.const 4))))
      (if (i32.le_u (i32.sub (local.get $name) (i32.const 0xb51)) (i32.const 1)) (then (return (i32.const 1))))))
    (if (i32.eq (local.get $family) (i32.const 2)) (then
      (if (i32.le_u (i32.sub (local.get $name) (i32.const 0x1200)) (i32.const 3)) (then (return (i32.const 4))))
      (if (i32.eq (local.get $name) (i32.const 0x1204)) (then (return (i32.const 3))))
      (if (i32.le_u (i32.sub (local.get $name) (i32.const 0x1205)) (i32.const 4)) (then (return (i32.const 1))))))
    (if (i32.eq (local.get $family) (i32.const 3)) (then
      (if (i32.or (i32.le_u (i32.sub (local.get $name) (i32.const 0x1200)) (i32.const 2))
          (i32.or (i32.eq (local.get $name) (i32.const 0x1600)) (i32.eq (local.get $name) (i32.const 0x1602)))) (then (return (i32.const 4))))
      (if (i32.eq (local.get $name) (i32.const 0x1601)) (then (return (i32.const 1))))
      (if (i32.eq (local.get $name) (i32.const 0x1603)) (then (return (i32.const 3))))))
    (i32.const 0))

  (func $gl_lmf_color (param $family i32) (param $name i32) (result i32)
    (if (i32.eqz (local.get $family)) (then (return (i32.eq (local.get $name) (i32.const 0xb66)))))
    (if (i32.eq (local.get $family) (i32.const 1)) (then (return (i32.eq (local.get $name) (i32.const 0xb53)))))
    (if (i32.eq (local.get $family) (i32.const 2)) (then
      (return (i32.le_u (i32.sub (local.get $name) (i32.const 0x1200)) (i32.const 2)))))
    (i32.eq (call $gl_lmf_count (local.get $family) (local.get $name)) (i32.const 4)))

  (func $handle_gl_lmf_integer (param $family i32) (param $vector i32) (param $integer i32)
    (local $esp i32) (local $words i32) (local $name i32) (local $first i32)
    (local $n i32) (local $src i32) (local $i i32) (local $raw i32)
    (local $guest i32) (local $stack i32) (local $payload i32) (local $op i32)
    (local $ctx i32) (local $error i32) (local $v f32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (local.set $words (select (i32.const 3) (i32.const 2) (i32.ge_u (local.get $family) (i32.const 2))))
    (call $gl_texcoord_check (local.get $esp) (i32.shl (i32.add (local.get $words) (i32.const 1)) (i32.const 2)))
    (local.set $first (call $gl32 (i32.add (local.get $esp) (i32.const 4))))
    (local.set $name (if (result i32) (i32.ge_u (local.get $family) (i32.const 2))
      (then (call $gl32 (i32.add (local.get $esp) (i32.const 8)))) (else (local.get $first))))
    (local.set $n (call $gl_lmf_count (local.get $family) (local.get $name)))
    (local.set $ctx (call $gl_list_context))
    ;; Invalid enums never dereference an irrelevant vector. Material is legal
    ;; inside Begin/End; the other three parameter families are not.
    (if (i32.eqz (local.get $n)) (then (local.set $error (i32.const 0x500))))
    (if (i32.and (i32.eqz (local.get $vector)) (i32.ne (local.get $n) (i32.const 1)))
      (then (local.set $error (i32.const 0x500))))
    (if (i32.and (i32.eq (local.get $family) (i32.const 2))
        (i32.ge_u (i32.sub (local.get $first) (i32.const 0x4000)) (i32.const 8)))
      (then (local.set $error (i32.const 0x500))))
    (if (i32.and (i32.eq (local.get $family) (i32.const 3))
        (i32.eqz (i32.or (i32.or (i32.eq (local.get $first) (i32.const 0x404)) (i32.eq (local.get $first) (i32.const 0x405)))
          (i32.eq (local.get $first) (i32.const 0x408))))) (then (local.set $error (i32.const 0x500))))
    (if (i32.and (i32.ne (local.get $family) (i32.const 3)) (i32.ne (local.get $ctx) (i32.const 0))) (then
      (if (i32.or (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0)) (i32.ne (i32.load offset=36 (local.get $ctx)) (i32.const 0)))
        (then (local.set $error (i32.const 0x502))))))
    (if (i32.eqz (local.get $error)) (then
      (local.set $src (i32.add (local.get $esp) (i32.shl (local.get $words) (i32.const 2))))
      (if (local.get $vector) (then (local.set $src (call $gl32 (local.get $src)))))
      (call $gl_texcoord_check (local.get $src) (i32.shl (local.get $n) (i32.const 2)))
      ;; Both argument and vector spans are validated before the first effect.
      (local.set $guest (call $gl_alloc_affine (i32.const 32)))
      (if (i32.eqz (local.get $guest)) (then (unreachable)))
      (local.set $stack (call $g2w (local.get $guest)))
      (memory.fill (local.get $stack) (i32.const 0) (i32.const 32))
      (local.set $payload (i32.add (local.get $stack) (i32.const 16)))
      (loop $convert
        (local.set $raw (call $gl32 (i32.add (local.get $src) (i32.shl (local.get $i) (i32.const 2)))))
        (local.set $v (if (result f32) (local.get $integer)
          (then (if (result f32) (call $gl_lmf_color (local.get $family) (local.get $name))
            (then (f32.demote_f64 (f64.div (f64.add (f64.mul (f64.convert_i32_s (local.get $raw)) (f64.const 2)) (f64.const 1)) (f64.const 4294967295))))
            (else (f32.convert_i32_s (local.get $raw)))))
          (else (f32.reinterpret_i32 (local.get $raw)))))
        (f32.store (i32.add (local.get $payload) (i32.shl (local.get $i) (i32.const 2))) (local.get $v))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br_if $convert (i32.lt_u (local.get $i) (local.get $n))))
      (i32.store offset=4 (local.get $stack) (local.get $first))
      (if (i32.ge_u (local.get $family) (i32.const 2)) (then
        (i32.store offset=8 (local.get $stack) (local.get $name))
        (i32.store offset=12 (local.get $stack) (i32.add (local.get $guest) (i32.const 16))))
        (else (i32.store offset=8 (local.get $stack) (i32.add (local.get $guest) (i32.const 16)))))
      (local.set $op (if (result i32) (i32.eqz (local.get $family)) (then (i32.const 78))
        (else (if (result i32) (i32.eq (local.get $family) (i32.const 1)) (then (i32.const 69))
          (else (select (i32.const 67) (i32.const 68) (i32.eq (local.get $family) (i32.const 2))))))))
      (drop (call $gl_wat_encode_call (local.get $op) (local.get $stack) (i32.const 0)))
      (call $heap_free (local.get $guest))))
    (if (i32.and (i32.ne (local.get $error) (i32.const 0)) (i32.ne (local.get $ctx) (i32.const 0)))
      (then (call $gl_list_error (local.get $ctx) (local.get $error))))
    (i32.store (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base)
      (i32.add (local.get $esp) (i32.shl (i32.add (local.get $words) (i32.const 1)) (i32.const 2)))))

  ;; GL1.1 6: indexed lighting queries execute now, including GL_COMPILE.
  ;; Both variants have three DWORD arguments; no stream/list opcode exists.
  (func $handle_gl_lighting_query (param $material i32) (param $integer i32)
    (local $esp i32) (local $target i32) (local $name i32) (local $out i32)
    (local $family i32) (local $n i32) (local $ctx i32) (local $error i32)
    (local $b i32) (local $src i32) (local $i i32) (local $v f64)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (call $gl_texcoord_check (local.get $esp) (i32.const 16))
    (local.set $target (call $gl32 (i32.add (local.get $esp) (i32.const 4))))
    (local.set $name (call $gl32 (i32.add (local.get $esp) (i32.const 8))))
    (local.set $out (call $gl32 (i32.add (local.get $esp) (i32.const 12))))
    (local.set $family (select (i32.const 3) (i32.const 2) (local.get $material)))
    (local.set $n (call $gl_lmf_count (local.get $family) (local.get $name)))
    (if (local.get $material) (then
      ;; AMBIENT_AND_DIFFUSE is a setter convenience, never a query pname.
      (if (i32.or (i32.eq (local.get $name) (i32.const 0x1602))
          (i32.eqz (i32.or (i32.eq (local.get $target) (i32.const 0x404))
            (i32.eq (local.get $target) (i32.const 0x405)))))
        (then (local.set $error (i32.const 0x500)))))
      (else (if (i32.ge_u (i32.sub (local.get $target) (i32.const 0x4000)) (i32.const 8))
        (then (local.set $error (i32.const 0x500))))))
    (if (i32.eqz (local.get $n)) (then (local.set $error (i32.const 0x500))))
    (local.set $ctx (call $gl_list_context))
    ;; Only an executed Begin forbids queries. Compilation's shadow Begin
    ;; does not change execution state for an immediately executed Get.
    (if (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0))
      (then (local.set $error (i32.const 0x502))))
    (if (i32.eqz (local.get $error)) (then
      ;; Validate the whole output before lazy state allocation or any write.
      ;; At most16 bytes; checked stores handle nonadjacent sparse backing.
      (call $gl_texcoord_check (local.get $out) (i32.shl (local.get $n) (i32.const 2)))
      (local.set $b (call $gl_mtx_block))
      (if (local.get $material) (then
        (local.set $src (i32.add (local.get $b) (select (i32.const 11088) (i32.const 8880)
          (i32.eq (local.get $target) (i32.const 0x405)))))
        (if (i32.le_u (i32.sub (local.get $name) (i32.const 0x1200)) (i32.const 2))
          (then (local.set $src (i32.add (local.get $src)
            (i32.shl (i32.sub (local.get $name) (i32.const 0x1200)) (i32.const 4)))))
          (else (local.set $src (i32.add (local.get $src)
            (select (i32.const 48) (select (i32.const 64) (i32.const 68)
              (i32.eq (local.get $name) (i32.const 0x1601)))
              (i32.eq (local.get $name) (i32.const 0x1600))))))))
        (else
          (if (i32.le_u (local.get $name) (i32.const 0x1203)) (then
            (local.set $src (call $gl_mtx_light_slot (local.get $b)
              (i32.sub (local.get $target) (i32.const 0x4000))))
            (if (i32.ne (local.get $name) (i32.const 0x1203)) (then
              (local.set $src (i32.add (local.get $src)
                (i32.shl (i32.add (i32.sub (local.get $name) (i32.const 0x1200)) (i32.const 1)) (i32.const 4)))))))
            (else
              (local.set $src (call $gl_lmf_extra (local.get $b)
                (i32.sub (local.get $target) (i32.const 0x4000))))
              (if (i32.ne (local.get $name) (i32.const 0x1204)) (then
                (local.set $src (i32.add (local.get $src)
                  (i32.shl (i32.sub (local.get $name) (i32.const 0x1202)) (i32.const 2))))))))))
      (loop $values
        (local.set $v (f64.promote_f32 (f32.load
          (i32.add (local.get $src) (i32.shl (local.get $i) (i32.const 2))))))
        (call $gs32 (i32.add (local.get $out) (i32.shl (local.get $i) (i32.const 2)))
          (if (result i32) (local.get $integer) (then
            (if (call $gl_lmf_color (local.get $family) (local.get $name)) (then
              (local.set $v (f64.mul (f64.const 0.5)
                (f64.sub (f64.mul (local.get $v) (f64.const 4294967295)) (f64.const 1))))))
            (i32.trunc_sat_f64_s (f64.nearest (local.get $v))))
            (else (i32.reinterpret_f32 (f32.demote_f64 (local.get $v))))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br_if $values (i32.lt_u (local.get $i) (local.get $n))))))
    (if (i32.and (i32.ne (local.get $error) (i32.const 0)) (i32.ne (local.get $ctx) (i32.const 0)))
      (then (call $gl_list_error (local.get $ctx) (local.get $error))))
    (i32.store (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (local.get $esp) (i32.const 16))))

  ;; Preserve the existing scalar/vector opcodes while capturing legacy texgen
  ;; frames through guest translation, including a pointer split across pages.
  (func $handle_glTexGen_legacy (param $op i32)
    (local $esp i32) (local $guest i32) (local $stack i32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (call $gl_texcoord_check (local.get $esp) (i32.const 16))
    (local.set $guest (call $gl_alloc_affine (i32.const 16)))
    (if (i32.eqz (local.get $guest)) (then (unreachable)))
    (local.set $stack (call $g2w (local.get $guest)))
    (call $gl_copy_from_guest (local.get $stack) (local.get $esp) (i32.const 16))
    (drop (call $gl_wat_encode_call (local.get $op) (local.get $stack) (i32.const 0)))
    (call $heap_free (local.get $guest))
    (i32.store (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (local.get $esp) (i32.const 16))))

  ;; GL1.1 2.10.4: modes have one value; planes have four numeric coefficients.
  (func $gl_texgen_count (param $name i32) (result i32)
    (if (i32.eq (local.get $name) (i32.const 0x2500)) (then (return (i32.const 1))))
    (if (i32.le_u (i32.sub (local.get $name) (i32.const 0x2501)) (i32.const 1))
      (then (return (i32.const 4)))) (i32.const 0))

  ;; kind 0 double, 1 signed integer. Lower by value into the existing native
  ;; vector command so lists own coefficients and eye transforms run on replay.
  (func $handle_glTexGen_typed (param $kind i32) (param $vector i32)
    (local $esp i32) (local $words i32) (local $coord i32) (local $name i32)
    (local $n i32) (local $src i32) (local $i i32) (local $stride i32)
    (local $guest i32) (local $stack i32) (local $ctx i32) (local $error i32) (local $v f64)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (local.set $words (select (i32.const 4) (i32.const 3)
      (i32.and (i32.eqz (local.get $kind)) (i32.eqz (local.get $vector)))))
    (call $gl_texcoord_check (local.get $esp) (i32.shl (i32.add (local.get $words) (i32.const 1)) (i32.const 2)))
    (local.set $coord (call $gl32 (i32.add (local.get $esp) (i32.const 4))))
    (local.set $name (call $gl32 (i32.add (local.get $esp) (i32.const 8))))
    (local.set $n (call $gl_texgen_count (local.get $name)))
    (local.set $ctx (call $gl_list_context))
    (if (i32.or (i32.ge_u (i32.sub (local.get $coord) (i32.const 0x2000)) (i32.const 4))
        (i32.or (i32.eqz (local.get $n))
          (i32.and (i32.eqz (local.get $vector)) (i32.ne (local.get $n) (i32.const 1)))))
      (then (local.set $error (i32.const 0x500))))
    (if (i32.ne (local.get $ctx) (i32.const 0)) (then
      (if (i32.or (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0))
          (i32.ne (i32.load offset=36 (local.get $ctx)) (i32.const 0)))
        (then (local.set $error (i32.const 0x502))))))
    (if (i32.eqz (local.get $error)) (then
      (local.set $src (i32.add (local.get $esp) (i32.const 12)))
      (if (local.get $vector) (then (local.set $src (call $gl32 (local.get $src)))))
      (local.set $stride (select (i32.const 4) (i32.const 8) (local.get $kind)))
      (call $gl_texcoord_check (local.get $src) (i32.mul (local.get $n) (local.get $stride)))
      (local.set $guest (call $gl_alloc_affine (i32.const 32)))
      (if (i32.eqz (local.get $guest)) (then (unreachable)))
      (local.set $stack (call $g2w (local.get $guest)))
      (memory.fill (local.get $stack) (i32.const 0) (i32.const 32))
      (loop $convert
        (local.set $v (if (result f64) (local.get $kind)
          (then (f64.convert_i32_s (call $gl32 (i32.add (local.get $src) (i32.mul (local.get $i) (local.get $stride))))))
          (else (f64.reinterpret_i64 (call $gl64 (i32.add (local.get $src) (i32.mul (local.get $i) (local.get $stride))))))))
        ;; Validate symbolic doubles before narrowing to the canonical f32 plane.
        (if (i32.eq (local.get $n) (i32.const 1)) (then
          (if (i32.eqz (i32.or (i32.or (f64.eq (local.get $v) (f64.const 9216))
              (f64.eq (local.get $v) (f64.const 9217)))
              (i32.and (f64.eq (local.get $v) (f64.const 9218)) (i32.lt_u (local.get $coord) (i32.const 0x2002)))))
            (then (local.set $error (i32.const 0x500))))))
        (f32.store (i32.add (local.get $stack) (i32.add (i32.const 16) (i32.shl (local.get $i) (i32.const 2)))) (f32.demote_f64 (local.get $v)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br_if $convert (i32.lt_u (local.get $i) (local.get $n))))
      (if (i32.eqz (local.get $error)) (then
        (i32.store offset=4 (local.get $stack) (local.get $coord))
        (i32.store offset=8 (local.get $stack) (local.get $name))
        (i32.store offset=12 (local.get $stack) (i32.add (local.get $guest) (i32.const 16)))
        (drop (call $gl_wat_encode_call (i32.const 85) (local.get $stack) (i32.const 0)))))
      (call $heap_free (local.get $guest))))
    (if (i32.and (i32.ne (local.get $error) (i32.const 0)) (i32.ne (local.get $ctx) (i32.const 0)))
      (then (call $gl_list_error (local.get $ctx) (local.get $error))))
    (i32.store (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base)
      (i32.add (local.get $esp) (i32.shl (i32.add (local.get $words) (i32.const 1)) (i32.const 2)))))

  ;; kind 0 double, 1 float, 2 signed integer. Get commands never enter lists.
  (func $handle_glGetTexGen_typed (param $kind i32)
    (local $esp i32) (local $coord i32) (local $name i32) (local $out i32)
    (local $n i32) (local $ctx i32) (local $error i32) (local $src i32)
    (local $i i32) (local $stride i32) (local $v f64) (local $bits i64) (local $dst i32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (call $gl_texcoord_check (local.get $esp) (i32.const 16))
    (local.set $coord (i32.sub (call $gl32 (i32.add (local.get $esp) (i32.const 4))) (i32.const 0x2000)))
    (local.set $name (call $gl32 (i32.add (local.get $esp) (i32.const 8))))
    (local.set $out (call $gl32 (i32.add (local.get $esp) (i32.const 12))))
    (local.set $n (call $gl_texgen_count (local.get $name)))
    (local.set $ctx (call $gl_list_context))
    (if (i32.or (i32.ge_u (local.get $coord) (i32.const 4)) (i32.eqz (local.get $n)))
      (then (local.set $error (i32.const 0x500))))
    ;; Compilation's shadow Begin does not affect an immediately executed query.
    (if (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0))
      (then (local.set $error (i32.const 0x502))))
    (if (i32.and (i32.eqz (local.get $error)) (i32.ne (local.get $ctx) (i32.const 0))) (then
      (local.set $stride (select (i32.const 8) (i32.const 4) (i32.eqz (local.get $kind))))
      (call $gl_texcoord_check (local.get $out) (i32.mul (local.get $n) (local.get $stride)))
      (local.set $src (i32.add (local.get $ctx) (i32.add (i32.const 384)
        (i32.mul (i32.load offset=4 (call $gl_mtx_block)) (i32.const 148)))))
      (local.set $src (i32.add (local.get $src) (if (result i32) (i32.eq (local.get $n) (i32.const 1))
        (then (i32.add (i32.const 4) (i32.shl (local.get $coord) (i32.const 2))))
        (else (i32.add (select (i32.const 84) (i32.const 20) (i32.eq (local.get $name) (i32.const 0x2502)))
          (i32.shl (local.get $coord) (i32.const 4)))))))
      (loop $values
        (local.set $v (if (result f64) (i32.eq (local.get $n) (i32.const 1))
          (then (f64.convert_i32_s (i32.load (local.get $src))))
          (else (f64.promote_f32 (f32.load (i32.add (local.get $src) (i32.shl (local.get $i) (i32.const 2))))))))
        (local.set $dst (i32.add (local.get $out) (i32.mul (local.get $i) (local.get $stride))))
        (if (i32.eqz (local.get $kind)) (then
          (local.set $bits (i64.reinterpret_f64 (local.get $v)))
          (call $gs32 (local.get $dst) (i32.wrap_i64 (local.get $bits)))
          (call $gs32 (i32.add (local.get $dst) (i32.const 4)) (i32.wrap_i64 (i64.shr_u (local.get $bits) (i64.const 32)))))
          (else (call $gs32 (local.get $dst) (if (result i32) (i32.eq (local.get $kind) (i32.const 2))
            (then (i32.trunc_sat_f64_s (f64.nearest (local.get $v))))
            (else (i32.reinterpret_f32 (f32.demote_f64 (local.get $v))))))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br_if $values (i32.lt_u (local.get $i) (local.get $n))))))
    (if (i32.and (i32.ne (local.get $error) (i32.const 0)) (i32.ne (local.get $ctx) (i32.const 0)))
      (then (call $gl_list_error (local.get $ctx) (local.get $error))))
    (i32.store (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (local.get $esp) (i32.const 16))))

  ;; GL1.1 3.8/ch6: texture parameters belong to objects, environment to units.
  ;; listctx+760 owns this block; no host lookup can create a named object.
  ;; block: objects, attrib frames, reserved8, bindings[unit*2+dimension],
  ;; environments[2] {mode,color4}, padding8, default objects[2] (56 each).
  ;; object: next,name,target,min,mag,wrapS,wrapT,border4,priority,baseformat,1d-levels.
  (func $gl_texture_object_init (param $p i32) (param $target i32)
    (i32.store offset=8 (local.get $p) (local.get $target))
    (i32.store offset=12 (local.get $p) (i32.const 0x2702))
    (i32.store offset=16 (local.get $p) (i32.const 0x2601))
    (i32.store offset=20 (local.get $p) (i32.const 0x2901))
    (i32.store offset=24 (local.get $p) (i32.const 0x2901))
    (f32.store offset=44 (local.get $p) (f32.const 1))
    (i32.store offset=48 (local.get $p) (i32.const 1)))

  (func $gl_texture_block (result i32)
    (local $ctx i32) (local $p i32)
    (local.set $ctx (call $gl_list_context))
    (if (i32.eqz (local.get $ctx)) (then (return (i32.const 0))))
    (local.set $p (i32.load offset=760 (local.get $ctx)))
    (if (i32.eqz (local.get $p)) (then
      (local.set $p (call $gl_list_alloc (i32.const 204)))
      (if (i32.eqz (local.get $p)) (then (unreachable)))
      (call $gl_texture_object_init (i32.add (local.get $p) (i32.const 80)) (i32.const 0xde0))
      (call $gl_texture_object_init (i32.add (local.get $p) (i32.const 136)) (i32.const 0xde1))
      (i32.store offset=16 (local.get $p) (i32.add (local.get $p) (i32.const 80)))
      (i32.store offset=20 (local.get $p) (i32.add (local.get $p) (i32.const 136)))
      (i32.store offset=24 (local.get $p) (i32.add (local.get $p) (i32.const 80)))
      (i32.store offset=28 (local.get $p) (i32.add (local.get $p) (i32.const 136)))
      (i32.store offset=32 (local.get $p) (i32.const 0x2100))
      (i32.store offset=52 (local.get $p) (i32.const 0x2100))
      (i32.store offset=760 (local.get $ctx) (local.get $p))))
    (local.get $p))

  (func $gl_texture_binding (param $b i32) (param $target i32) (result i32)
    (i32.add (local.get $b) (i32.add (i32.const 16)
      (i32.add (i32.shl (i32.load offset=4 (call $gl_mtx_block)) (i32.const 3))
        (i32.shl (i32.sub (local.get $target) (i32.const 0xde0)) (i32.const 2))))))
  (func $gl_texture_env (param $b i32) (result i32)
    (i32.add (local.get $b) (i32.add (i32.const 32)
      (i32.mul (i32.load offset=4 (call $gl_mtx_block)) (i32.const 20)))))
  (func $gl_texture_find (param $b i32) (param $name i32) (result i32)
    (local $p i32)
    (local.set $p (i32.load (local.get $b)))
    (block $done (loop $scan
      (br_if $done (i32.eqz (local.get $p)))
      (if (i32.eq (i32.load offset=4 (local.get $p)) (local.get $name)) (then (return (local.get $p))))
      (local.set $p (i32.load (local.get $p))) (br $scan))) (i32.const 0))

  (func $gl_texture_count (param $environment i32) (param $name i32) (param $query i32) (result i32)
    (if (local.get $environment) (then
      (if (i32.eq (local.get $name) (i32.const 0x2200)) (then (return (i32.const 1))))
      (return (select (i32.const 4) (i32.const 0) (i32.eq (local.get $name) (i32.const 0x2201))))))
    (if (i32.eq (local.get $name) (i32.const 0x1004)) (then (return (i32.const 4))))
    (if (i32.or (i32.le_u (i32.sub (local.get $name) (i32.const 0x2800)) (i32.const 3))
        (i32.or (i32.eq (local.get $name) (i32.const 0x8066))
          (i32.and (local.get $query) (i32.eq (local.get $name) (i32.const 0x8067)))))
      (then (return (i32.const 1)))) (i32.const 0))
  (func $gl_texture_offset (param $name i32) (result i32)
    (if (i32.eq (local.get $name) (i32.const 0x1004)) (then (return (i32.const 28))))
    (if (i32.eq (local.get $name) (i32.const 0x8066)) (then (return (i32.const 44))))
    (if (i32.eq (local.get $name) (i32.const 0x2801)) (then (return (i32.const 12))))
    (if (i32.eq (local.get $name) (i32.const 0x2800)) (then (return (i32.const 16))))
    (i32.add (i32.const 20) (i32.shl (i32.sub (local.get $name) (i32.const 0x2802)) (i32.const 2))))
  (func $gl_texture_clamp (param $v f32) (result f32)
    (if (result f32) (f32.ne (local.get $v) (local.get $v)) (then (f32.const 0))
      (else (f32.min (f32.const 1) (f32.max (f32.const 0) (local.get $v))))))
  (func $gl_texture_enum_valid (param $environment i32) (param $name i32) (param $v i32) (result i32)
    (if (local.get $environment) (then
      (return (i32.or (i32.or (i32.eq (local.get $v) (i32.const 0x2100)) (i32.eq (local.get $v) (i32.const 0x2101)))
        (i32.or (i32.eq (local.get $v) (i32.const 0x1e01)) (i32.eq (local.get $v) (i32.const 0xbe2)))))))
    (if (i32.eq (local.get $name) (i32.const 0x2800)) (then
      (return (i32.le_u (i32.sub (local.get $v) (i32.const 0x2600)) (i32.const 1)))))
    (if (i32.eq (local.get $name) (i32.const 0x2801)) (then
      (return (i32.or (i32.le_u (i32.sub (local.get $v) (i32.const 0x2600)) (i32.const 1))
        (i32.le_u (i32.sub (local.get $v) (i32.const 0x2700)) (i32.const 3))))))
    ;; Retain accepted extension wrap values alongside core1.1 CLAMP/REPEAT.
    (i32.or (i32.le_u (i32.sub (local.get $v) (i32.const 0x2900)) (i32.const 1))
      (i32.or (i32.eq (local.get $v) (i32.const 0x812f)) (i32.eq (local.get $v) (i32.const 0x8370)))))

  ;; Called before display-list capture; rejects without modifying state or
  ;; dereferencing irrelevant vector arguments. Valid payloads are checked whole.
  (func $gl_texture_validate (param $ctx i32) (param $op i32) (param $s i32) (result i32)
    (local $env i32) (local $vector i32) (local $target i32) (local $name i32)
    (local $n i32) (local $src i32) (local $v i32) (local $error i32) (local $p i32)
    (local.set $env (i32.or (i32.eq (local.get $op) (i32.const 44))
      (i32.or (i32.eq (local.get $op) (i32.const 82)) (i32.eq (local.get $op) (i32.const 147)))))
    (if (i32.eqz (i32.or (local.get $env) (i32.or (i32.eq (local.get $op) (i32.const 42))
        (i32.or (i32.eq (local.get $op) (i32.const 46))
          (i32.or (i32.eq (local.get $op) (i32.const 96)) (i32.eq (local.get $op) (i32.const 112)))))))
      (then (return (i32.const 0))))
    (local.set $target (i32.load offset=4 (local.get $s)))
    (local.set $name (i32.load offset=8 (local.get $s)))
    (local.set $vector (i32.or (i32.eq (local.get $op) (i32.const 112)) (i32.eq (local.get $op) (i32.const 147))))
    (local.set $n (call $gl_texture_count (local.get $env) (local.get $name) (i32.const 0)))
    (if (i32.eqz (if (result i32) (local.get $env)
      (then (i32.eq (local.get $target) (i32.const 0x2300)))
      (else (i32.le_u (i32.sub (local.get $target) (i32.const 0xde0)) (i32.const 1)))))
      (then (local.set $error (i32.const 0x500))))
    (if (i32.ne (local.get $op) (i32.const 42)) (then
      (if (i32.or (i32.eqz (local.get $n))
          (i32.and (i32.eqz (local.get $vector)) (i32.ne (local.get $n) (i32.const 1))))
        (then (local.set $error (i32.const 0x500))))))
    (if (i32.or (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0))
        (i32.ne (i32.load offset=36 (local.get $ctx)) (i32.const 0)))
      (then (local.set $error (i32.const 0x502))))
    (if (i32.eqz (local.get $error)) (then
      (if (i32.eq (local.get $op) (i32.const 42)) (then
        (if (local.get $name) (then
          (local.set $p (call $gl_texture_find (call $gl_texture_block) (local.get $name)))
          (if (local.get $p) (then
            (if (i32.ne (i32.load offset=8 (local.get $p)) (local.get $target))
              (then (local.set $error (i32.const 0x502)))))))))
        (else
          (local.set $src (i32.add (local.get $s) (i32.const 12)))
          (if (local.get $vector) (then
            (local.set $src (i32.load (local.get $src)))
            (call $gl_texcoord_check (local.get $src) (i32.shl (local.get $n) (i32.const 2)))
            (local.set $v (call $gl32 (local.get $src))))
            (else (local.set $v (i32.load (local.get $src)))))
          (if (i32.and (i32.eq (local.get $n) (i32.const 1)) (i32.ne (local.get $name) (i32.const 0x8066))) (then
            (if (i32.and (i32.ne (local.get $op) (i32.const 82)) (i32.ne (local.get $op) (i32.const 96)))
              (then (local.set $v (i32.trunc_sat_f64_s (f64.nearest (f64.promote_f32 (f32.reinterpret_i32 (local.get $v))))))))
            (if (i32.eqz (call $gl_texture_enum_valid (local.get $env) (local.get $name) (local.get $v)))
              (then (local.set $error (i32.const 0x500))))))))))
    (if (local.get $error) (then
      (call $gl_list_error (local.get $ctx) (local.get $error)) (return (i32.const 1))))
    (i32.const 0))

  ;; Attribute frame: next,mask, saved bindings16, env40, bound properties4*40.
  (func $gl_texture_attributes (param $b i32) (param $op i32) (param $mask i32)
    (local $p i32) (local $i i32) (local $obj i32)
    (if (i32.eq (local.get $op) (i32.const 76)) (then
      (if (i32.ge_u (i32.load offset=9032 (call $gl_mtx_block)) (i32.const 16)) (then (return)))
      (local.set $p (call $gl_list_alloc (i32.const 228)))
      (if (i32.eqz (local.get $p)) (then (unreachable)))
      (i32.store (local.get $p) (i32.load offset=4 (local.get $b)))
      (i32.store offset=4 (local.get $p) (local.get $mask))
      (i32.store offset=224 (local.get $p) (i32.load offset=192 (local.get $b)))
      (memory.copy (i32.add (local.get $p) (i32.const 8)) (i32.add (local.get $b) (i32.const 16)) (i32.const 56))
      (loop $save
        (local.set $obj (i32.load (i32.add (local.get $b) (i32.add (i32.const 16) (i32.shl (local.get $i) (i32.const 2))))))
        (memory.copy (i32.add (local.get $p) (i32.add (i32.const 64) (i32.mul (local.get $i) (i32.const 40))))
          (i32.add (local.get $obj) (i32.const 12)) (i32.const 36))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br_if $save (i32.lt_u (local.get $i) (i32.const 4))))
      (i32.store offset=4 (local.get $b) (local.get $p)) (return)))
    (local.set $p (i32.load offset=4 (local.get $b)))
    (if (i32.eqz (local.get $p)) (then (return)))
    (if (i32.and (i32.load offset=4 (local.get $p)) (i32.const 0x40000)) (then
      (memory.copy (i32.add (local.get $b) (i32.const 16)) (i32.add (local.get $p) (i32.const 8)) (i32.const 56))
      (loop $restore
        (local.set $obj (i32.load (i32.add (local.get $b) (i32.add (i32.const 16) (i32.shl (local.get $i) (i32.const 2))))))
        (memory.copy (i32.add (local.get $obj) (i32.const 12))
          (i32.add (local.get $p) (i32.add (i32.const 64) (i32.mul (local.get $i) (i32.const 40)))) (i32.const 36))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br_if $restore (i32.lt_u (local.get $i) (i32.const 4))))))
    (if (i32.and (i32.load offset=4 (local.get $p)) (i32.const 0x42000)) (then
      (i32.store offset=192 (local.get $b) (i32.load offset=224 (local.get $p)))))
    (i32.store offset=4 (local.get $b) (i32.load (local.get $p)))
    (call $heap_free (call $w2g (local.get $p))))

  (func $gl_texture_observe (param $op i32) (param $s i32)
    (local $b i32) (local $obj i32) (local $at i32) (local $target i32)
    (local $name i32) (local $env i32) (local $src i32) (local $n i32)
    (local $i i32) (local $v f32) (local $raw i32)
    (if (i32.eqz (global.get $gl_current_context)) (then (return)))
    (if (i32.and (i32.or (i32.eq (local.get $op) (i32.const 8)) (i32.eq (local.get $op) (i32.const 10)))
        (i32.eq (i32.load offset=4 (local.get $s)) (i32.const 0xde0))) (then
      (local.set $b (call $gl_texture_block))
      (local.set $raw (i32.shl (i32.const 1) (i32.load offset=4 (call $gl_mtx_block))))
      (i32.store offset=192 (local.get $b) (select
        (i32.or (i32.load offset=192 (local.get $b)) (local.get $raw))
        (i32.and (i32.load offset=192 (local.get $b)) (i32.xor (local.get $raw) (i32.const -1)))
        (i32.eq (local.get $op) (i32.const 10)))) (return)))
    (if (i32.eqz (i32.or (i32.or (i32.eq (local.get $op) (i32.const 76)) (i32.eq (local.get $op) (i32.const 77)))
        (i32.or (i32.or (i32.eq (local.get $op) (i32.const 42)) (i32.eq (local.get $op) (i32.const 45)))
          (i32.or (i32.or (i32.eq (local.get $op) (i32.const 44)) (i32.eq (local.get $op) (i32.const 82)))
            (i32.or (i32.eq (local.get $op) (i32.const 147))
              (i32.or (i32.eq (local.get $op) (i32.const 112))
                (i32.or (i32.eq (local.get $op) (i32.const 46)) (i32.eq (local.get $op) (i32.const 96)))))))))
      (then (return)))
    (local.set $b (call $gl_texture_block))
    (if (i32.or (i32.eq (local.get $op) (i32.const 76)) (i32.eq (local.get $op) (i32.const 77))) (then
      (call $gl_texture_attributes (local.get $b) (local.get $op) (i32.load offset=4 (local.get $s))) (return)))
    (local.set $target (i32.load offset=4 (local.get $s)))
    (local.set $name (i32.load offset=8 (local.get $s)))
    (if (i32.eq (local.get $op) (i32.const 42)) (then
      (local.set $at (call $gl_texture_binding (local.get $b) (local.get $target)))
      (local.set $obj (if (result i32) (local.get $name)
        (then (call $gl_texture_find (local.get $b) (local.get $name)))
        (else (i32.add (local.get $b) (select (i32.const 136) (i32.const 80) (i32.eq (local.get $target) (i32.const 0xde1)))))))
      (if (i32.eqz (local.get $obj)) (then
        (local.set $obj (call $gl_list_alloc (i32.const 56)))
        (if (i32.eqz (local.get $obj)) (then (unreachable)))
        (call $gl_texture_object_init (local.get $obj) (local.get $target))
        (i32.store offset=4 (local.get $obj) (local.get $name))
        (i32.store (local.get $obj) (i32.load (local.get $b)))
        (i32.store (local.get $b) (local.get $obj))))
      (i32.store (local.get $at) (local.get $obj)) (return)))
    (if (i32.eq (local.get $op) (i32.const 45)) (then
      (if (i32.and (i32.eq (local.get $target) (i32.const 0xde1)) (i32.eqz (local.get $name))) (then
        (local.set $obj (i32.load (call $gl_texture_binding (local.get $b) (local.get $target))))
        (i32.store offset=48 (local.get $obj) (i32.load offset=12 (local.get $s))))) (return)))
    (local.set $env (i32.or (i32.eq (local.get $op) (i32.const 147))
      (i32.or (i32.eq (local.get $op) (i32.const 44)) (i32.eq (local.get $op) (i32.const 82)))))
    (local.set $n (call $gl_texture_count (local.get $env) (local.get $name) (i32.const 0)))
    (local.set $at (if (result i32) (local.get $env)
      (then (i32.add (call $gl_texture_env (local.get $b)) (select (i32.const 4) (i32.const 0) (i32.eq (local.get $n) (i32.const 4)))))
      (else (i32.add (i32.load (call $gl_texture_binding (local.get $b) (local.get $target))) (call $gl_texture_offset (local.get $name))))))
    (local.set $src (i32.add (local.get $s) (i32.const 12)))
    (if (i32.or (i32.eq (local.get $op) (i32.const 147)) (i32.eq (local.get $op) (i32.const 112)))
      (then (local.set $src (i32.load (local.get $src))))
      (else (local.set $src (call $w2g (local.get $src)))))
    (loop $values
      (local.set $raw (call $gl32 (i32.add (local.get $src) (i32.shl (local.get $i) (i32.const 2)))))
      (local.set $v (if (result f32) (i32.or (i32.eq (local.get $op) (i32.const 82)) (i32.eq (local.get $op) (i32.const 96)))
        (then (f32.convert_i32_s (local.get $raw))) (else (f32.reinterpret_i32 (local.get $raw)))))
      (if (i32.or (i32.eq (local.get $n) (i32.const 4)) (i32.eq (local.get $name) (i32.const 0x8066)))
        (then (f32.store (i32.add (local.get $at) (i32.shl (local.get $i) (i32.const 2))) (call $gl_texture_clamp (local.get $v))))
        (else (i32.store (local.get $at) (i32.trunc_sat_f64_s (f64.nearest (f64.promote_f32 (local.get $v)))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $values (i32.lt_u (local.get $i) (local.get $n)))))

  (func $gl_texture_query (param $env i32) (param $integer i32)
      (param $target i32) (param $name i32) (param $out i32)
    (local $n i32)
    (local $ctx i32) (local $error i32) (local $b i32) (local $src i32)
    (local $i i32) (local $v f64) (local $color i32)
    (local.set $n (call $gl_texture_count (local.get $env) (local.get $name) (i32.const 1)))
    (local.set $ctx (call $gl_list_context))
    (if (i32.eqz (local.get $ctx)) (then (return)))
    (if (i32.or (i32.eqz (local.get $n)) (i32.eqz (if (result i32) (local.get $env)
        (then (i32.eq (local.get $target) (i32.const 0x2300)))
        (else (i32.le_u (i32.sub (local.get $target) (i32.const 0xde0)) (i32.const 1))))))
      (then (local.set $error (i32.const 0x500))))
    (if (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0))
      (then (local.set $error (i32.const 0x502))))
    (if (local.get $error) (then (call $gl_list_error (local.get $ctx) (local.get $error)) (return)))
    (call $gl_texcoord_check (local.get $out) (i32.shl (local.get $n) (i32.const 2)))
    (local.set $b (call $gl_texture_block))
    (local.set $color (i32.eq (local.get $n) (i32.const 4)))
    (local.set $src (if (result i32) (local.get $env)
      (then (i32.add (call $gl_texture_env (local.get $b)) (select (i32.const 4) (i32.const 0) (local.get $color))))
      (else (i32.add (i32.load (call $gl_texture_binding (local.get $b) (local.get $target))) (call $gl_texture_offset (local.get $name))))))
    (loop $values
      (local.set $v (if (result f64) (i32.eq (local.get $name) (i32.const 0x8067))
        (then (f64.const 1))
        (else (if (result f64) (i32.or (local.get $color) (i32.eq (local.get $name) (i32.const 0x8066)))
          (then (f64.promote_f32 (f32.load (i32.add (local.get $src) (i32.shl (local.get $i) (i32.const 2))))))
          (else (f64.convert_i32_s (i32.load (local.get $src))))))))
      (call $gs32 (i32.add (local.get $out) (i32.shl (local.get $i) (i32.const 2)))
        (if (result i32) (local.get $integer) (then
          (if (local.get $color) (then
            (local.set $v (f64.mul (f64.const 0.5)
              (f64.sub (f64.mul (local.get $v) (f64.const 4294967295)) (f64.const 1))))))
          (i32.trunc_sat_f64_s (f64.nearest (local.get $v))))
          (else (i32.reinterpret_f32 (f32.demote_f64 (local.get $v))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $values (i32.lt_u (local.get $i) (local.get $n)))))

  ;; All guest variants validate the complete stdcall frame and gather sparse
  ;; inputs before encoding. Canonical float vectors are owned by lists/stream.
  (func $handle_gl_texture_set (param $env i32) (param $integer i32) (param $vector i32)
    (local $esp i32) (local $target i32) (local $name i32) (local $n i32)
    (local $src i32) (local $ctx i32) (local $error i32) (local $i i32)
    (local $guest i32) (local $s i32) (local $raw i32) (local $v f32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (call $gl_texcoord_check (local.get $esp) (i32.const 16))
    (local.set $target (call $gl32 (i32.add (local.get $esp) (i32.const 4))))
    (local.set $name (call $gl32 (i32.add (local.get $esp) (i32.const 8))))
    (local.set $n (call $gl_texture_count (local.get $env) (local.get $name) (i32.const 0)))
    (local.set $ctx (call $gl_list_context))
    (if (i32.or (i32.eqz (local.get $n))
        (i32.or (i32.and (i32.eqz (local.get $vector)) (i32.ne (local.get $n) (i32.const 1)))
          (i32.eqz (if (result i32) (local.get $env)
            (then (i32.eq (local.get $target) (i32.const 0x2300)))
            (else (i32.le_u (i32.sub (local.get $target) (i32.const 0xde0)) (i32.const 1)))))))
      (then (local.set $error (i32.const 0x500))))
    (if (local.get $ctx) (then
      (if (i32.or (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0))
          (i32.ne (i32.load offset=36 (local.get $ctx)) (i32.const 0)))
        (then (local.set $error (i32.const 0x502))))))
    (if (i32.eqz (local.get $error)) (then
      (local.set $src (i32.add (local.get $esp) (i32.const 12)))
      (if (local.get $vector) (then (local.set $src (call $gl32 (local.get $src)))))
      (call $gl_texcoord_check (local.get $src) (i32.shl (local.get $n) (i32.const 2)))
      (local.set $guest (call $gl_alloc_affine (i32.const 32)))
      (if (i32.eqz (local.get $guest)) (then (unreachable)))
      (local.set $s (call $g2w (local.get $guest)))
      (memory.fill (local.get $s) (i32.const 0) (i32.const 32))
      (loop $convert
        (local.set $raw (call $gl32 (i32.add (local.get $src) (i32.shl (local.get $i) (i32.const 2)))))
        (local.set $v (if (result f32) (local.get $integer)
          (then (if (result f32) (i32.eq (local.get $n) (i32.const 4))
            (then (f32.demote_f64 (f64.div (f64.add (f64.mul (f64.convert_i32_s (local.get $raw)) (f64.const 2)) (f64.const 1)) (f64.const 4294967295))))
            (else (f32.convert_i32_s (local.get $raw)))))
          (else (f32.reinterpret_i32 (local.get $raw)))))
        (f32.store (i32.add (local.get $s) (i32.add (i32.const 16) (i32.shl (local.get $i) (i32.const 2)))) (local.get $v))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br_if $convert (i32.lt_u (local.get $i) (local.get $n))))
      (i32.store offset=4 (local.get $s) (local.get $target))
      (i32.store offset=8 (local.get $s) (local.get $name))
      (i32.store offset=12 (local.get $s) (i32.add (local.get $guest) (i32.const 16)))
      (drop (call $gl_wat_encode_call (select (i32.const 147) (i32.const 112) (local.get $env)) (local.get $s) (i32.const 0)))
      (call $heap_free (local.get $guest))))
    (if (i32.and (i32.ne (local.get $error) (i32.const 0)) (i32.ne (local.get $ctx) (i32.const 0)))
      (then (call $gl_list_error (local.get $ctx) (local.get $error))))
    (i32.store (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (local.get $esp) (i32.const 16))))

  (func $handle_gl_texture_query (param $env i32) (param $integer i32)
    (local $esp i32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (call $gl_texcoord_check (local.get $esp) (i32.const 16))
    (call $gl_texture_query (local.get $env) (local.get $integer)
      (call $gl32 (i32.add (local.get $esp) (i32.const 4)))
      (call $gl32 (i32.add (local.get $esp) (i32.const 8)))
      (call $gl32 (i32.add (local.get $esp) (i32.const 12))))
    (i32.store (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (local.get $esp) (i32.const 16))))
  (func $gl_texture_delete (param $s i32)
    (local $b i32) (local $p i32) (local $prev i32) (local $next i32)
    (local $i i32) (local $j i32) (local $name i32) (local $n i32) (local $at i32)
    (if (i32.eqz (global.get $gl_current_context)) (then (return)))
    (local.set $n (i32.load offset=4 (local.get $s)))
    (if (i32.lt_s (local.get $n) (i32.const 0)) (then
      (call $gl_list_error (call $gl_list_context) (i32.const 0x501)) (return)))
    (if (i32.eqz (local.get $n)) (then (return)))
    (if (i32.gt_u (local.get $n) (i32.const 0x1fffffff)) (then (unreachable)))
    (call $gl_texcoord_check (i32.load offset=8 (local.get $s)) (i32.shl (local.get $n) (i32.const 2)))
    (local.set $b (call $gl_texture_block))
    (loop $names
      (local.set $name (call $gl32 (i32.add (i32.load offset=8 (local.get $s)) (i32.shl (local.get $i) (i32.const 2)))))
      (local.set $prev (i32.const 0))
      (local.set $p (i32.load (local.get $b)))
      (block $done (loop $scan
        (br_if $done (i32.eqz (local.get $p)))
        (local.set $next (i32.load (local.get $p)))
        (if (i32.eq (i32.load offset=4 (local.get $p)) (local.get $name)) (then
          (if (local.get $prev) (then (i32.store (local.get $prev) (local.get $next)))
            (else (i32.store (local.get $b) (local.get $next))))
          (local.set $j (i32.const 0))
          (loop $units
            (local.set $at (i32.add (local.get $b) (i32.add (i32.const 16) (i32.shl (local.get $j) (i32.const 2)))))
            (if (i32.eq (i32.load (local.get $at)) (local.get $p)) (then
              (i32.store (local.get $at) (i32.add (local.get $b)
                (select (i32.const 136) (i32.const 80) (i32.and (local.get $j) (i32.const 1)))))))
            (local.set $j (i32.add (local.get $j) (i32.const 1)))
            (br_if $units (i32.lt_u (local.get $j) (i32.const 4))))
          ;; An attribute frame may still reference the object. Retire until
          ;; context destruction, never recycle it as a newly bound name.
          (call $gl_1d_free (local.get $p))
          (i32.store (local.get $p) (i32.load offset=8 (local.get $b)))
          (i32.store offset=8 (local.get $b) (local.get $p)) (br $done)))
        (local.set $prev (local.get $p)) (local.set $p (local.get $next)) (br $scan)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $names (i32.lt_u (local.get $i) (local.get $n)))))

  (func $gl_texture_free (param $ctx i32)
    (local $b i32) (local $p i32) (local $next i32) (local $i i32)
    (local.set $b (i32.load offset=760 (local.get $ctx)))
    (if (i32.eqz (local.get $b)) (then (return)))
    (loop $heads
      (local.set $p (i32.load (i32.add (local.get $b) (i32.shl (local.get $i) (i32.const 2)))))
      (block $done (loop $free
        (br_if $done (i32.eqz (local.get $p)))
        (local.set $next (i32.load (local.get $p)))
        (if (i32.ne (local.get $i) (i32.const 1)) (then (call $gl_1d_free (local.get $p))))
        (call $heap_free (call $w2g (local.get $p)))
        (local.set $p (local.get $next)) (br $free)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $heads (i32.lt_u (local.get $i) (i32.const 3))))
    (call $gl_1d_free (i32.add (local.get $b) (i32.const 80)))
    (if (i32.load offset=200 (local.get $b)) (then (call $heap_free (call $w2g (i32.load offset=200 (local.get $b))))))
    (call $heap_free (call $w2g (local.get $b))))

  ;; Rebuild raster sampling state from restored bound-object values. The
  ;; native getters and both native texture units use the same object record.
  (func $gl_texture_sync_sampling
    (local $b i32) (local $obj i32) (local $i i32) (local $old i32)
    (if (i32.or (i32.eqz (global.get $gl_sw_enabled)) (i32.eqz (global.get $gl_current_context))) (then (return)))
    (local.set $b (call $gl_texture_block))
    (local.set $old (i32.load offset=40 (global.get $gl_sw_st)))
    (loop $units
      (local.set $obj (i32.load (i32.add (local.get $b) (i32.add (i32.const 20) (i32.shl (local.get $i) (i32.const 3))))))
      (i32.store offset=40 (global.get $gl_sw_st) (i32.load offset=4 (local.get $obj)))
      (call $gl_sw_tex_param (i32.const 0x2801) (i32.load offset=12 (local.get $obj)))
      (call $gl_sw_tex_param (i32.const 0x2800) (i32.load offset=16 (local.get $obj)))
      (call $gl_sw_tex_param (i32.const 0x2802) (i32.load offset=20 (local.get $obj)))
      (call $gl_sw_tex_param (i32.const 0x2803) (i32.load offset=24 (local.get $obj)))
      (if (i32.or (global.get $gl_sw_border_colors)
          (i32.or (i64.ne (i64.load offset=28 (local.get $obj)) (i64.const 0))
                  (i64.ne (i64.load offset=36 (local.get $obj)) (i64.const 0)))) (then
        (drop (call $gl_sw_border_set (call $gl_sw_tex_slot (i32.load offset=4 (local.get $obj)))
          (i32.add (local.get $obj) (i32.const 28))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $units (i32.lt_u (local.get $i) (i32.const 2))))
    (i32.store offset=40 (global.get $gl_sw_st) (local.get $old)))
  ;; Draw-owned environment descriptor: two {mode,RGBA} and baseformat[2].
  ;; A queued renderer receives a value copy; no producer context lookup occurs.
  (global $gl_texture_draw (mut i32) (i32.const 0))
  (global $gl_texture_draw_storage (mut i32) (i32.const 0))
  (func $gl_texture_capture
    (local $b i32) (local $p i32)
    (global.set $gl_texture_draw (i32.const 0))
    (if (i32.eqz (global.get $gl_current_context)) (then (return)))
    (local.set $b (call $gl_texture_block))
    (local.set $p (global.get $gl_texture_draw_storage))
    (if (i32.eqz (local.get $p)) (then
      (local.set $p (call $gl_list_alloc (i32.const 48)))
      (if (i32.eqz (local.get $p)) (then (unreachable)))
      (global.set $gl_texture_draw_storage (local.get $p))))
    (memory.copy (local.get $p) (i32.add (local.get $b) (i32.const 32)) (i32.const 40))
    (i32.store offset=40 (local.get $p) (i32.load offset=48 (i32.load offset=20 (local.get $b))))
    (i32.store offset=44 (local.get $p) (i32.load offset=48 (i32.load offset=28 (local.get $b))))
    (if (call $gl_1d_selected (i32.const 0)) (then (i32.store offset=40 (local.get $p)
      (i32.load offset=24 (i32.add (global.get $gl_1d_draw) (i32.const 0))))))
    (if (call $gl_1d_selected (i32.const 1)) (then (i32.store offset=44 (local.get $p)
      (i32.load offset=24 (i32.add (global.get $gl_1d_draw) (i32.const 56))))))
    (global.set $gl_texture_draw (local.get $p)))

  ;; Base formats of all GL1.1 sized/unsized internal formats (table3.8).
  (func $gl_texture_base (param $fmt i32) (result i32)
    (if (i32.or (i32.eq (local.get $fmt) (i32.const 1))
      (i32.or (i32.eq (local.get $fmt) (i32.const 0x1909))
        (i32.le_u (i32.sub (local.get $fmt) (i32.const 0x803f)) (i32.const 3)))) (then (return (i32.const 1))))
    (if (i32.or (i32.eq (local.get $fmt) (i32.const 2))
      (i32.or (i32.eq (local.get $fmt) (i32.const 0x190a))
        (i32.le_u (i32.sub (local.get $fmt) (i32.const 0x8043)) (i32.const 5)))) (then (return (i32.const 2))))
    (if (i32.or (i32.eq (local.get $fmt) (i32.const 3))
      (i32.or (i32.eq (local.get $fmt) (i32.const 0x1907))
        (i32.or (i32.eq (local.get $fmt) (i32.const 0x2a10))
          (i32.le_u (i32.sub (local.get $fmt) (i32.const 0x804f)) (i32.const 5))))) (then (return (i32.const 3))))
    (if (i32.or (i32.eq (local.get $fmt) (i32.const 4))
      (i32.or (i32.eq (local.get $fmt) (i32.const 0x1908))
        (i32.le_u (i32.sub (local.get $fmt) (i32.const 0x8055)) (i32.const 6)))) (then (return (i32.const 4))))
    (if (i32.or (i32.eq (local.get $fmt) (i32.const 0x1906))
        (i32.le_u (i32.sub (local.get $fmt) (i32.const 0x803b)) (i32.const 3))) (then (return (i32.const 5))))
    (i32.const 6)) ;; INTENSITY

  ;; GL1.1 tables3.10/3.11. Byte arithmetic occurs only at rasterization;
  ;; authoritative environment colors retain their original clamped f32s.
  (func $gl_texture_combine (param $tex i32) (param $diff i32) (param $unit i32) (result i32)
    (local $p i32) (local $mode i32) (local $base i32) (local $out i32)
    (local $i i32) (local $shift i32) (local $t i32) (local $d i32)
    (local $c i32) (local $v i32) (local $a i32)
    (local.set $p (i32.add (global.get $gl_texture_draw) (i32.mul (local.get $unit) (i32.const 20))))
    (local.set $mode (i32.load (local.get $p)))
    (local.set $base (call $gl_texture_base (i32.load (i32.add (global.get $gl_texture_draw)
      (i32.add (i32.const 40) (i32.shl (local.get $unit) (i32.const 2)))))))
    (local.set $a (i32.shr_u (local.get $tex) (i32.const 24)))
    (if (i32.eq (local.get $base) (i32.const 6))
      (then (local.set $a (i32.and (i32.shr_u (local.get $tex) (i32.const 16)) (i32.const 255)))))
    (loop $channels
      ;; Packed pixels are ARGB; environment vectors are RGBA.
      (local.set $shift (select (i32.const 24) (i32.sub (i32.const 16) (i32.shl (local.get $i) (i32.const 3)))
        (i32.eq (local.get $i) (i32.const 3))))
      (local.set $t (i32.and (i32.shr_u (local.get $tex) (local.get $shift)) (i32.const 255)))
      (if (i32.and (i32.eq (local.get $base) (i32.const 6)) (i32.eq (local.get $i) (i32.const 3)))
        (then (local.set $t (local.get $a))))
      (local.set $d (i32.and (i32.shr_u (local.get $diff) (local.get $shift)) (i32.const 255)))
      (local.set $c (i32.trunc_sat_f32_s (f32.nearest (f32.mul (f32.const 255)
        (f32.load (i32.add (local.get $p) (i32.add (i32.const 4) (i32.shl (local.get $i) (i32.const 2)))))))))
      (local.set $v (local.get $d))
      (if (i32.eq (local.get $i) (i32.const 3)) (then
        (if (i32.and (i32.ne (local.get $base) (i32.const 1)) (i32.ne (local.get $base) (i32.const 3))) (then
          (local.set $v (if (result i32) (i32.eq (local.get $mode) (i32.const 0x1e01))
            (then (local.get $t))
            (else (if (result i32) (i32.eq (local.get $mode) (i32.const 0x2101))
              (then (local.get $d))
              (else (if (result i32) (i32.and (i32.eq (local.get $mode) (i32.const 0xbe2)) (i32.eq (local.get $base) (i32.const 6)))
                (then (i32.div_u (i32.add (i32.add (i32.mul (local.get $d) (i32.sub (i32.const 255) (local.get $t)))
                  (i32.mul (local.get $c) (local.get $t))) (i32.const 127)) (i32.const 255)))
                (else (i32.div_u (i32.add (i32.mul (local.get $t) (local.get $d)) (i32.const 127)) (i32.const 255))))))))))))
        (else (if (i32.ne (local.get $base) (i32.const 5)) (then
          (local.set $v (if (result i32) (i32.eq (local.get $mode) (i32.const 0x1e01))
            (then (local.get $t))
            (else (if (result i32) (i32.eq (local.get $mode) (i32.const 0xbe2))
              (then (i32.div_u (i32.add (i32.add (i32.mul (local.get $d) (i32.sub (i32.const 255) (local.get $t)))
                (i32.mul (local.get $c) (local.get $t))) (i32.const 127)) (i32.const 255)))
              (else (if (result i32) (i32.eq (local.get $mode) (i32.const 0x2101))
                (then (if (result i32) (i32.eq (local.get $base) (i32.const 3))
                  (then (local.get $t))
                  (else (i32.div_u (i32.add (i32.add (i32.mul (local.get $t) (local.get $a))
                    (i32.mul (local.get $d) (i32.sub (i32.const 255) (local.get $a)))) (i32.const 127)) (i32.const 255)))))
                (else (i32.div_u (i32.add (i32.mul (local.get $t) (local.get $d)) (i32.const 127)) (i32.const 255)))))))))))))
      (local.set $out (i32.or (local.get $out) (i32.shl (local.get $v) (local.get $shift))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $channels (i32.lt_u (local.get $i) (i32.const 4))))
    (local.get $out))

  (func $handle_gl_texture_is
    (local $esp i32) (local $value i32) (local $ctx i32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (call $gl_texcoord_check (local.get $esp) (i32.const 8))
    (local.set $ctx (call $gl_list_context))
    (if (local.get $ctx) (then
      (if (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0))
        (then (call $gl_list_error (local.get $ctx) (i32.const 0x502)))
        (else (local.set $value (i32.ne (call $gl_texture_find (call $gl_texture_block)
          (call $gl32 (i32.add (local.get $esp) (i32.const 4)))) (i32.const 0)))))))
    (i32.store (global.get $reg_base) (local.get $value))
    (i32.store offset=16 (global.get $reg_base) (i32.add (local.get $esp) (i32.const 8))))

  ;; glClipPlane and glGetClipPlane share the exact two-word stdcall ABI.
  ;; Validate the complete guest frame/span before changing registers/state.
  (func $handle_gl_clip (param $get i32)
    (local $esp i32) (local $plane i32) (local $ptr i32) (local $ctx i32)
    (local $error i32) (local $g i32) (local $s i32) (local $i i32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (call $gl_texcoord_check (local.get $esp) (i32.const 12))
    (local.set $plane (call $gl32 (i32.add (local.get $esp) (i32.const 4))))
    (local.set $ptr (call $gl32 (i32.add (local.get $esp) (i32.const 8))))
    (local.set $ctx (call $gl_list_context))
    (if (i32.ge_u (i32.sub (local.get $plane) (i32.const 0x3000)) (i32.const 6))
      (then (local.set $error (i32.const 0x500))))
    (if (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0))
      (then (local.set $error (i32.const 0x502))))
    (if (i32.and (i32.eqz (local.get $get)) (i32.ne (local.get $ctx) (i32.const 0))) (then
      (if (i32.load offset=36 (local.get $ctx)) (then (local.set $error (i32.const 0x502))))))
    (if (i32.and (i32.eqz (local.get $error)) (i32.ne (local.get $ctx) (i32.const 0))) (then
      (call $gl_texcoord_check (local.get $ptr) (i32.const 32))
      (if (local.get $get) (then
        (local.set $s (i32.add (call $gl_clip_state)
          (i32.shl (i32.sub (local.get $plane) (i32.const 0x3000)) (i32.const 5))))
        (loop $output
          (call $gs64 (i32.add (local.get $ptr) (local.get $i)) (i64.load (i32.add (local.get $s) (local.get $i))))
          (local.set $i (i32.add (local.get $i) (i32.const 8)))
          (br_if $output (i32.lt_u (local.get $i) (i32.const 32)))))
        (else
          (local.set $g (call $gl_alloc_affine (i32.const 48)))
          (if (i32.eqz (local.get $g)) (then (unreachable)))
          (local.set $s (call $g2w (local.get $g)))
          (memory.fill (local.get $s) (i32.const 0) (i32.const 16))
          (i32.store offset=4 (local.get $s) (local.get $plane))
          (i32.store offset=8 (local.get $s) (i32.add (local.get $g) (i32.const 16)))
          (call $gl_copy_from_guest (i32.add (local.get $s) (i32.const 16)) (local.get $ptr) (i32.const 32))
          (drop (call $gl_wat_encode_call (i32.const 148) (local.get $s) (i32.const 0)))
          (call $heap_free (local.get $g))))))
    (if (i32.and (i32.ne (local.get $error) (i32.const 0)) (i32.ne (local.get $ctx) (i32.const 0)))
      (then (call $gl_list_error (local.get $ctx) (local.get $error))))
    (i32.store (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (local.get $esp) (i32.const 12))))

  ;; Draft only. 149/150 are assigned after predecessor release.
  ;; Call adapter scratch: canonical transport uses RGBA/UNSIGNED_BYTE,
  ;; tightly packed and independent of later unpack-state changes.
  (func $handle_gl_tex1d_upload (param $sub i32)
    (local $esp i32) (local $words i32) (local $frame i32) (local $s i32)
    (local $ctx i32) (local $i i32) (local $error i32) (local $w i32)
    (local $format i32) (local $type i32) (local $src i32) (local $n i32)
    (local $align i32) (local $row i32) (local $bytes i32) (local $bit i32)
    (local $guest i32) (local $out i32) (local $px i32) (local $swap i32)
    (local $offset i64) (local $pitch i64) (local $start i64)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (local.set $words (select (i32.const 7) (i32.const 8) (local.get $sub)))
    (call $gl_texcoord_check (local.get $esp) (i32.shl (i32.add (local.get $words) (i32.const 1)) (i32.const 2)))
    ;; The guest frame may straddle non-affine pages, so first gather it.
    (local.set $frame (call $gl_alloc_affine (i32.const 36)))
    (if (i32.eqz (local.get $frame)) (then (unreachable)))
    (local.set $s (call $g2w (local.get $frame)))
    (loop $args
      (i32.store (i32.add (local.get $s) (i32.shl (local.get $i) (i32.const 2)))
        (call $gl32 (i32.add (local.get $esp) (i32.shl (local.get $i) (i32.const 2)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $args (i32.le_u (local.get $i) (local.get $words))))
    (local.set $ctx (call $gl_list_context))
    (if (local.get $ctx) (then
      (local.set $error (call $gl_1d_validate (local.get $ctx) (local.get $sub) (local.get $s)))
      (if (local.get $error) (then (call $gl_list_error (local.get $ctx) (local.get $error))))
      (if (i32.eqz (local.get $error)) (then
        (local.set $w (i32.load offset=16 (local.get $s)))
        ;; A proxy never reads data, even for a huge otherwise legal image.
        (if (i32.eq (i32.load offset=4 (local.get $s)) (i32.const 0x8063))
          (then (drop (call $gl_wat_encode_call (i32.const 149) (local.get $s) (i32.const 0))))
          (else
            (local.set $format (i32.load (i32.add (local.get $s) (select (i32.const 20) (i32.const 24) (local.get $sub)))))
            (local.set $type (i32.load (i32.add (local.get $s) (select (i32.const 24) (i32.const 28) (local.get $sub)))))
            (local.set $src (i32.load (i32.add (local.get $s) (i32.shl (local.get $words) (i32.const 2)))))
            (local.set $n (i32.mul (call $gl_1d_components (local.get $format)) (call $gl_1d_type_bytes (local.get $type))))
            (local.set $row (i32.load offset=84 (local.get $ctx)))
            (if (i32.eqz (local.get $row)) (then (local.set $row (local.get $w))))
            (local.set $align (i32.load offset=80 (local.get $ctx)))
            (local.set $pitch (if (result i64) (i32.eq (local.get $type) (i32.const 0x1a00))
              (then (i64.shr_u (i64.add (i64.extend_i32_u (local.get $row)) (i64.const 7)) (i64.const 3)))
              (else (i64.mul (i64.extend_i32_u (local.get $row)) (i64.extend_i32_u (local.get $n))))))
            (local.set $pitch (i64.and (i64.add (local.get $pitch) (i64.sub (i64.extend_i32_u (local.get $align)) (i64.const 1)))
              (i64.sub (i64.const 0) (i64.extend_i32_u (local.get $align)))))
            ;; Bound before multiplying: the legal pixel-store integers can
            ;; otherwise overflow even a 64-bit intermediate. A zero skipped
            ;; row count consumes no pitch, and null data consumes no memory.
            (if (i32.and (i32.and (i32.ne (local.get $src) (i32.const 0)) (i32.ne (local.get $w) (i32.const 0)))
                (i32.and (i64.gt_u (local.get $pitch) (i64.const 4294967295))
                  (i32.ne (i32.load offset=88 (local.get $ctx)) (i32.const 0)))) (then (unreachable)))
            (local.set $offset (i64.mul (local.get $pitch) (i64.extend_i32_u (i32.load offset=88 (local.get $ctx)))))
            (if (i32.eq (local.get $type) (i32.const 0x1a00))
              (then
                (local.set $bit (i32.and (i32.load offset=92 (local.get $ctx)) (i32.const 7)))
                (local.set $offset (i64.add (local.get $offset) (i64.extend_i32_u (i32.shr_u (i32.load offset=92 (local.get $ctx)) (i32.const 3)))))
                (local.set $bytes (i32.shr_u (i32.add (i32.add (local.get $w) (local.get $bit)) (i32.const 7)) (i32.const 3))))
              (else
                (local.set $offset (i64.add (local.get $offset) (i64.mul
                  (i64.extend_i32_u (i32.load offset=92 (local.get $ctx))) (i64.extend_i32_u (local.get $n)))))
                (local.set $bytes (i32.mul (local.get $w) (local.get $n)))))
            (local.set $start (i64.add (i64.extend_i32_u (local.get $src)) (local.get $offset)))
            (if (i32.and (i32.ne (local.get $src) (i32.const 0)) (i32.ne (local.get $w) (i32.const 0))) (then
              (if (i64.gt_u (i64.add (local.get $start) (i64.extend_i32_u (local.get $bytes))) (i64.const 4294967296)) (then (unreachable)))
              (call $gl_1d_span (i32.wrap_i64 (local.get $start)) (local.get $bytes))))
            (local.set $guest (call $gl_alloc_affine (i32.add (i32.const 36) (i32.shl (local.get $w) (i32.const 2)))))
            (if (i32.eqz (local.get $guest)) (then (unreachable)))
            (local.set $out (call $g2w (local.get $guest)))
            (memory.copy (local.get $out) (local.get $s) (i32.const 36))
            (i32.store (i32.add (local.get $out) (select (i32.const 20) (i32.const 24) (local.get $sub))) (i32.const 0x1908))
            (i32.store (i32.add (local.get $out) (select (i32.const 24) (i32.const 28) (local.get $sub))) (i32.const 0x1401))
            (i32.store (i32.add (local.get $out) (i32.shl (local.get $words) (i32.const 2))) (i32.add (local.get $guest) (i32.const 36)))
            (local.set $swap (i32.load offset=196 (call $gl_texture_block)))
            (local.set $i (i32.const 0))
            (block $done (loop $pixels
              (br_if $done (i32.ge_u (local.get $i) (local.get $w)))
              (local.set $px (i32.const 0))
              (if (local.get $src) (then (local.set $px (call $gl_1d_external
                (i32.add (i32.wrap_i64 (local.get $start)) (i32.mul (local.get $i) (local.get $n)))
                (local.get $format) (local.get $type) (local.get $swap)))))
              (i32.store8 (i32.add (local.get $out) (i32.add (i32.const 36) (i32.shl (local.get $i) (i32.const 2)))) (i32.shr_u (local.get $px) (i32.const 16)))
              (i32.store8 (i32.add (local.get $out) (i32.add (i32.const 37) (i32.shl (local.get $i) (i32.const 2)))) (i32.shr_u (local.get $px) (i32.const 8)))
              (i32.store8 (i32.add (local.get $out) (i32.add (i32.const 38) (i32.shl (local.get $i) (i32.const 2)))) (local.get $px))
              (i32.store8 (i32.add (local.get $out) (i32.add (i32.const 39) (i32.shl (local.get $i) (i32.const 2)))) (i32.shr_u (local.get $px) (i32.const 24)))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $pixels)))
            (drop (call $gl_wat_encode_call (select (i32.const 150) (i32.const 149) (local.get $sub)) (local.get $out) (i32.const 0)))
            (call $heap_free (local.get $guest))))))))
    (call $heap_free (local.get $frame))
    (i32.store (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (local.get $esp) (i32.shl (i32.add (local.get $words) (i32.const 1)) (i32.const 2)))))
  ;; 1D arrays are owned by the canonical texture object (+52). Each of the
  ;; twelve levels is {surface,width,border,internal,defined}, twenty bytes.
  (func $gl_1d_levels (param $object i32) (param $create i32) (result i32)
    (local $p i32)
    (local.set $p (i32.load offset=52 (local.get $object)))
    (if (i32.and (i32.eqz (local.get $p)) (local.get $create)) (then
      (local.set $p (call $gl_list_alloc (i32.const 240)))
      (i32.store offset=52 (local.get $object) (local.get $p))))
    (local.get $p))

  (func $gl_1d_level (param $target i32) (param $level i32) (param $create i32) (result i32)
    (local $b i32) (local $p i32)
    (local.set $b (call $gl_texture_block))
    (if (i32.eq (local.get $target) (i32.const 0x8063)) (then
      (local.set $p (i32.load offset=200 (local.get $b)))
      (if (i32.and (i32.eqz (local.get $p)) (local.get $create)) (then
        (local.set $p (call $gl_list_alloc (i32.const 240)))
        (i32.store offset=200 (local.get $b) (local.get $p)))))
      (else (local.set $p (call $gl_1d_levels
        (i32.load (call $gl_texture_binding (local.get $b) (i32.const 0xde0))) (local.get $create)))))
    (if (i32.eqz (local.get $p)) (then (return (i32.const 0))))
    (i32.add (local.get $p) (i32.mul (local.get $level) (i32.const 20))))

  (func $gl_1d_free (param $object i32)
    (local $p i32) (local $i i32) (local $obj i32)
    (local.set $p (i32.load offset=52 (local.get $object)))
    (if (i32.eqz (local.get $p)) (then (return)))
    (call $d3dim_worker_fence)
    (loop $levels
      (local.set $obj (i32.load (i32.add (local.get $p) (i32.mul (local.get $i) (i32.const 20)))))
      (if (local.get $obj) (then (drop (call $dx_surface_release (local.get $obj)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $levels (i32.lt_u (local.get $i) (i32.const 12))))
    (call $heap_free (call $w2g (local.get $p)))
    (i32.store offset=52 (local.get $object) (i32.const 0)))

  (func $gl_1d_internal_valid (param $f i32) (result i32)
    (i32.or (i32.le_u (i32.sub (local.get $f) (i32.const 1)) (i32.const 3))
      (i32.or (i32.eq (local.get $f) (i32.const 0x2a10))
        (i32.or (i32.le_u (i32.sub (local.get $f) (i32.const 0x1906)) (i32.const 4))
          (i32.and (i32.le_u (i32.sub (local.get $f) (i32.const 0x803b)) (i32.const 32))
            (i32.ne (local.get $f) (i32.const 0x804e)))))))

  (func $gl_1d_components (param $format i32) (result i32)
    (if (i32.eq (local.get $format) (i32.const 0x1900)) (then (return (i32.const 1))))
    (if (i32.le_u (i32.sub (local.get $format) (i32.const 0x1903)) (i32.const 3)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $format) (i32.const 0x1909)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $format) (i32.const 0x190a)) (then (return (i32.const 2))))
    (if (i32.eq (local.get $format) (i32.const 0x1907)) (then (return (i32.const 3))))
    (if (i32.eq (local.get $format) (i32.const 0x1908)) (then (return (i32.const 4))))
    (i32.const 0))

  ;; A normalized upload component set, expanded before internal selection.
  (func $gl_1d_external (param $p i32) (param $format i32) (param $type i32)
      (param $swap i32) (result i32)
    (local $r i32) (local $g i32) (local $b i32) (local $a i32) (local $n i32)
    ;; The GL1.1 initial I_TO_RGBA maps contain one zero entry each. PixelMap
    ;; and PixelTransfer are not exposed by this implementation.
    (if (i32.eq (local.get $format) (i32.const 0x1900)) (then (return (i32.const 0))))
    (local.set $a (i32.const 255))
    (local.set $n (call $gl_1d_type_bytes (local.get $type)))
    (local.set $r (call $gl_sw_u8 (call $gl_1d_component (local.get $p) (local.get $type) (local.get $swap))))
    (if (i32.eq (local.get $format) (i32.const 0x1904)) (then
      (local.set $g (local.get $r)) (local.set $r (i32.const 0))))
    (if (i32.eq (local.get $format) (i32.const 0x1905)) (then
      (local.set $b (local.get $r)) (local.set $r (i32.const 0))))
    (if (i32.eq (local.get $format) (i32.const 0x1906)) (then
      (local.set $a (local.get $r)) (local.set $r (i32.const 0))))
    (if (i32.ge_u (local.get $format) (i32.const 0x1909)) (then
      (local.set $g (local.get $r)) (local.set $b (local.get $r))
      (if (i32.eq (local.get $format) (i32.const 0x190a)) (then
        (local.set $a (call $gl_sw_u8 (call $gl_1d_component
          (i32.add (local.get $p) (local.get $n)) (local.get $type) (local.get $swap))))))))
    (if (i32.or (i32.eq (local.get $format) (i32.const 0x1907))
        (i32.eq (local.get $format) (i32.const 0x1908))) (then
      (local.set $g (call $gl_sw_u8 (call $gl_1d_component
        (i32.add (local.get $p) (local.get $n)) (local.get $type) (local.get $swap))))
      (local.set $b (call $gl_sw_u8 (call $gl_1d_component
        (i32.add (local.get $p) (i32.shl (local.get $n) (i32.const 1))) (local.get $type) (local.get $swap))))
      (if (i32.eq (local.get $format) (i32.const 0x1908)) (then
        (local.set $a (call $gl_sw_u8 (call $gl_1d_component
          (i32.add (local.get $p) (i32.mul (local.get $n) (i32.const 3))) (local.get $type) (local.get $swap))))))))
    (i32.or (i32.or (i32.shl (local.get $a) (i32.const 24)) (i32.shl (local.get $r) (i32.const 16)))
      (i32.or (i32.shl (local.get $g) (i32.const 8)) (local.get $b))))

  ;; Unlike the <=32-byte vector helper, texture spans may contain an
  ;; unmapped interior page. Check every page and the exact final byte.
  (func $gl_1d_span (param $p i32) (param $n i32)
    (local $at i32) (local $end i32)
    (if (i32.eqz (local.get $n)) (then (return)))
    (if (i32.gt_u (local.get $p) (i32.sub (i32.const -1) (i32.sub (local.get $n) (i32.const 1))))
      (then (unreachable)))
    (local.set $at (local.get $p))
    (local.set $end (i32.add (local.get $p) (i32.sub (local.get $n) (i32.const 1))))
    (loop $pages
      (if (i32.eq (call $g2w (local.get $at)) (global.get $NULL_SENTINEL)) (then (unreachable)))
      (local.set $at (i32.add (i32.and (local.get $at) (i32.const -4096)) (i32.const 4096)))
      (br_if $pages (i32.and (i32.ne (local.get $at) (i32.const 0)) (i32.le_u (local.get $at) (local.get $end)))))
    (if (i32.eq (call $g2w (local.get $end)) (global.get $NULL_SENTINEL)) (then (unreachable))))

  (func $gl_1d_type_bytes (param $type i32) (result i32)
    (if (i32.le_u (i32.sub (local.get $type) (i32.const 0x1400)) (i32.const 1)) (then (return (i32.const 1))))
    (if (i32.le_u (i32.sub (local.get $type) (i32.const 0x1402)) (i32.const 1)) (then (return (i32.const 2))))
    (if (i32.le_u (i32.sub (local.get $type) (i32.const 0x1404)) (i32.const 2)) (then (return (i32.const 4))))
    (i32.const 0))

  ;; Read a component bytewise; no affine guest-page assumption. Swapping is
  ;; within each component, including floating-point components.
  (func $gl_1d_component (param $p i32) (param $type i32) (param $swap i32) (result f32)
    (local $n i32) (local $i i32) (local $v i32) (local $at i32) (local $f f64)
    (local.set $n (call $gl_1d_type_bytes (local.get $type)))
    (loop $bytes
      (local.set $at (select (i32.sub (i32.sub (local.get $n) (i32.const 1)) (local.get $i))
        (local.get $i) (local.get $swap)))
      (local.set $v (i32.or (local.get $v) (i32.shl
        (i32.load8_u (call $g2w (i32.add (local.get $p) (local.get $at))))
        (i32.shl (local.get $i) (i32.const 3)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $bytes (i32.lt_u (local.get $i) (local.get $n))))
    (if (i32.eq (local.get $type) (i32.const 0x1406)) (then (return (f32.reinterpret_i32 (local.get $v)))))
    (if (i32.eqz (i32.and (local.get $type) (i32.const 1))) (then
      (if (i32.eq (local.get $n) (i32.const 1)) (then (local.set $v (i32.extend8_s (local.get $v)))))
      (if (i32.eq (local.get $n) (i32.const 2)) (then (local.set $v (i32.extend16_s (local.get $v)))))
      (local.set $f (f64.div (f64.add (f64.mul (f64.convert_i32_s (local.get $v)) (f64.const 2)) (f64.const 1))
        (f64.sub (f64.convert_i64_u (i64.shl (i64.const 1) (i64.extend_i32_u (i32.shl (local.get $n) (i32.const 3))))) (f64.const 1)))))
      (else (local.set $f (f64.div (f64.convert_i32_u (local.get $v))
        (f64.sub (f64.convert_i64_u (i64.shl (i64.const 1) (i64.extend_i32_u (i32.shl (local.get $n) (i32.const 3))))) (f64.const 1))))))
    (f32.demote_f64 (local.get $f)))

  ;; Internal components are selected after external expansion, GL1.1 table3.7.
  (func $gl_1d_select (param $px i32) (param $internal i32) (result i32)
    (local $base i32) (local $r i32)
    (local.set $base (call $gl_texture_base (local.get $internal)))
    (local.set $r (i32.and (i32.shr_u (local.get $px) (i32.const 16)) (i32.const 255)))
    (if (i32.eq (local.get $base) (i32.const 3)) (then (return (i32.or (local.get $px) (i32.const 0xff000000)))))
    (if (i32.eq (local.get $base) (i32.const 4)) (then (return (local.get $px))))
    (if (i32.eq (local.get $base) (i32.const 5)) (then (return (i32.and (local.get $px) (i32.const 0xff000000)))))
    (i32.or (i32.mul (local.get $r) (i32.const 0x10101))
      (if (result i32) (i32.eq (local.get $base) (i32.const 1)) (then (i32.const 0xff000000))
        (else (if (result i32) (i32.eq (local.get $base) (i32.const 2))
          (then (i32.and (local.get $px) (i32.const 0xff000000)))
          (else (i32.shl (local.get $r) (i32.const 24))))))))

  ;; Metadata validation runs before list capture and again during playback.
  ;; Source format/type checks precede any client pointer access in the adapter.
  (func $gl_1d_validate (param $ctx i32) (param $sub i32) (param $s i32) (result i32)
    (local $target i32) (local $level i32) (local $w i32) (local $b i32)
    (local $x i32) (local $p i32) (local $format i32) (local $type i32) (local $error i32)
    (local.set $target (i32.load offset=4 (local.get $s)))
    (local.set $level (i32.load offset=8 (local.get $s)))
    (local.set $w (i32.load offset=16 (local.get $s)))
    (local.set $format (i32.load offset=24 (local.get $s)))
    (local.set $type (i32.load offset=28 (local.get $s)))
    (if (local.get $sub) (then
      (local.set $format (i32.load offset=20 (local.get $s)))
      (local.set $type (i32.load offset=24 (local.get $s)))))
    (if (i32.and (i32.ne (local.get $target) (i32.const 0xde0))
        (i32.or (local.get $sub) (i32.ne (local.get $target) (i32.const 0x8063))))
      (then (local.set $error (i32.const 0x500))))
    (if (i32.or (i32.eqz (call $gl_1d_components (local.get $format)))
        (i32.and (i32.eqz (call $gl_1d_type_bytes (local.get $type))) (i32.ne (local.get $type) (i32.const 0x1a00))))
      (then (local.set $error (i32.const 0x500))))
    (if (i32.and (i32.eq (local.get $type) (i32.const 0x1a00)) (i32.ne (local.get $format) (i32.const 0x1900)))
      (then (local.set $error (i32.const 0x500))))
    (if (i32.or (i32.gt_u (local.get $level) (i32.const 11))
        (i32.or (i32.lt_s (local.get $w) (i32.const 0))
          (i32.and (i32.ne (local.get $sub) (i32.const 0)) (i32.gt_u (local.get $w) (i32.const 2050)))))
      (then (local.set $error (i32.const 0x501))))
    (if (i32.eqz (local.get $sub)) (then
      (local.set $b (i32.load offset=20 (local.get $s)))
      (local.set $x (i32.sub (local.get $w) (i32.shl (local.get $b) (i32.const 1))))
      (if (i32.or (i32.eqz (call $gl_1d_internal_valid (i32.load offset=12 (local.get $s))))
          (i32.or (i32.gt_u (local.get $b) (i32.const 1))
            (i32.and (i32.ne (local.get $w) (i32.const 0))
              (i32.or (i32.le_s (local.get $x) (i32.const 0))
                (i32.ne (i32.and (local.get $x) (i32.sub (local.get $x) (i32.const 1))) (i32.const 0))))))
        (then (local.set $error (i32.const 0x501))))
      (if (i32.and (i32.ne (local.get $w) (i32.const 0))
          (i32.and (i32.eq (local.get $target) (i32.const 0xde0))
            (i32.gt_u (local.get $x) (i32.shr_u (i32.const 2048) (local.get $level)))))
        (then (local.set $error (i32.const 0x501))))))
    (if (i32.or (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0))
        (i32.and (i32.ne (local.get $target) (i32.const 0x8063)) (i32.ne (i32.load offset=36 (local.get $ctx)) (i32.const 0))))
      (then (local.set $error (i32.const 0x502))))
    (if (local.get $error) (then (return (local.get $error))))
    ;; The bound image can be defined by an earlier command in this very list.
    (if (i32.and (local.get $sub) (i32.eqz (i32.load offset=12 (local.get $ctx)))) (then
      (local.set $p (call $gl_1d_level (local.get $target) (local.get $level) (i32.const 0)))
      (if (i32.eqz (local.get $p)) (then (return (i32.const 0x502))))
      (if (i32.eqz (i32.load offset=16 (local.get $p))) (then (return (i32.const 0x502))))
      (local.set $b (i32.load offset=8 (local.get $p)))
      (local.set $x (i32.load offset=12 (local.get $s)))
      (if (i32.or (i32.lt_s (local.get $x) (i32.sub (i32.const 0) (local.get $b)))
          (i64.gt_s (i64.add (i64.extend_i32_s (local.get $x)) (i64.extend_i32_u (local.get $w)))
            (i64.extend_i32_s (i32.sub (i32.load offset=4 (local.get $p)) (local.get $b)))))
        (then (return (i32.const 0x501))))))
    (i32.const 0))

  ;; Immediate queries must precede list interception in the encoder.
  (func $gl_1d_query (param $op i32) (param $s i32) (result i32)
    (local $ctx i32) (local $target i32) (local $level i32) (local $name i32)
    (local $out i32) (local $value i32) (local $error i32)
    (if (i32.eqz (i32.or (i32.eq (local.get $op) (i32.const 65))
      (i32.or (i32.eq (local.get $op) (i32.const 114)) (i32.eq (local.get $op) (i32.const 115))))) (then (return (i32.const 0))))
    (local.set $target (i32.load offset=4 (local.get $s)))
    (if (i32.eq (local.get $op) (i32.const 65)) (then
      (if (i32.ne (local.get $target) (i32.const 0xde0)) (then (return (i32.const 0)))))
      (else
        (if (i32.eqz (i32.or (i32.eq (local.get $op) (i32.const 114)) (i32.eq (local.get $op) (i32.const 115))))
          (then (return (i32.const 0))))
        (if (i32.eqz (i32.or (i32.eq (local.get $target) (i32.const 0xde0)) (i32.eq (local.get $target) (i32.const 0x8063))))
          (then (return (i32.const 0))))))
    (local.set $ctx (call $gl_list_context))
    (global.set $gl_list_result (i32.const 0))
    (if (i32.eqz (local.get $ctx)) (then (return (i32.const 1))))
    (if (i32.ge_s (global.get $gl_immediate_mode) (i32.const 0)) (then
      (call $gl_list_error (local.get $ctx) (i32.const 0x502)) (return (i32.const 1))))
    (if (i32.eq (local.get $op) (i32.const 65)) (then
      (global.set $gl_list_result (i32.and (i32.const 1) (i32.shr_u
        (i32.load offset=192 (call $gl_texture_block)) (i32.load offset=4 (call $gl_mtx_block)))))
      (return (i32.const 1))))
    (local.set $level (i32.load offset=8 (local.get $s)))
    (local.set $name (i32.load offset=12 (local.get $s)))
    (local.set $out (i32.load offset=16 (local.get $s)))
    (if (i32.gt_u (local.get $level) (i32.const 11)) (then (local.set $error (i32.const 0x501))))
    (if (i32.eqz (i32.or (i32.or (i32.eq (local.get $name) (i32.const 0x1000))
          (i32.eq (local.get $name) (i32.const 0x1001)))
        (i32.or (i32.or (i32.eq (local.get $name) (i32.const 0x1003)) (i32.eq (local.get $name) (i32.const 0x1005)))
          (i32.le_u (i32.sub (local.get $name) (i32.const 0x805c)) (i32.const 5)))))
      (then (local.set $error (i32.const 0x500))))
    (if (local.get $error) (then
      (call $gl_list_error (local.get $ctx) (local.get $error)) (return (i32.const 1))))
    (call $gl_texcoord_check (local.get $out) (i32.const 4))
    (local.set $value (call $gl_1d_level_value
      (call $gl_1d_level (local.get $target) (local.get $level) (i32.const 0)) (local.get $name)))
    (if (i32.eq (local.get $op) (i32.const 114))
      (then (call $gs32 (local.get $out) (local.get $value)))
      (else (call $gs32 (local.get $out) (i32.reinterpret_f32 (f32.convert_i32_s (local.get $value))))))
    (i32.const 1))

  ;; Native storage executes only after list interception.
  ;; Canonical pixels are RGBA8; conversion to the image's base format occurs
  ;; here, independently for each mip level (and on every subimage write).
  (func $gl_1d_store (param $sub i32) (param $s i32) (result i32)
    (local $ctx i32) (local $p i32) (local $old i32) (local $obj i32)
    (local $entry i32) (local $w i32) (local $b i32) (local $x i32)
    (local $internal i32) (local $i i32) (local $src i32) (local $dst i32)
    (local $r i32) (local $g i32) (local $blue i32) (local $a i32) (local $error i32)
    (local.set $ctx (call $gl_list_context))
    (if (i32.eqz (local.get $ctx)) (then (return (i32.const 0))))
    (local.set $error (call $gl_1d_validate (local.get $ctx) (local.get $sub) (local.get $s)))
    (if (local.get $error) (then (call $gl_list_error (local.get $ctx) (local.get $error)) (return (i32.const 0))))
    (local.set $w (i32.load offset=16 (local.get $s)))
    (if (i32.eq (i32.load offset=4 (local.get $s)) (i32.const 0x8063)) (then
      (local.set $p (call $gl_1d_level (i32.const 0x8063) (i32.load offset=8 (local.get $s)) (i32.const 1)))
      (if (i32.eqz (local.get $p)) (then
        (call $gl_list_error (local.get $ctx) (i32.const 0x505)) (return (i32.const 0))))
      (memory.fill (local.get $p) (i32.const 0) (i32.const 20))
      (i32.store offset=16 (local.get $p) (i32.const 2))
      (local.set $b (i32.load offset=20 (local.get $s)))
      (if (i32.or (i32.eqz (local.get $w)) (i32.le_u (i32.sub (local.get $w) (i32.shl (local.get $b) (i32.const 1)))
          (i32.shr_u (i32.const 2048) (i32.load offset=8 (local.get $s))))) (then
        (i32.store offset=4 (local.get $p) (local.get $w))
        (i32.store offset=8 (local.get $p) (local.get $b))
        (i32.store offset=12 (local.get $p) (i32.load offset=12 (local.get $s)))
        (i32.store offset=16 (local.get $p) (i32.const 1))))
      ;; Proxy commands are immediate and have no host upload.
      (return (i32.const 0))))
    (local.set $p (call $gl_1d_level (i32.const 0xde0) (i32.load offset=8 (local.get $s)) (i32.const 1)))
    (if (i32.eqz (local.get $p)) (then
      (call $gl_list_error (local.get $ctx) (i32.const 0x505)) (return (i32.const 0))))
    (if (local.get $sub) (then
      (if (i32.eqz (i32.load offset=16 (local.get $p))) (then
        (call $gl_list_error (local.get $ctx) (i32.const 0x502)) (return (i32.const 0))))
      (local.set $b (i32.load offset=8 (local.get $p)))
      (local.set $x (i32.load offset=12 (local.get $s)))
      (if (i32.or (i32.lt_s (local.get $x) (i32.sub (i32.const 0) (local.get $b)))
          (i64.gt_s (i64.add (i64.extend_i32_s (local.get $x)) (i64.extend_i32_u (local.get $w)))
            (i64.extend_i32_s (i32.sub (i32.load offset=4 (local.get $p)) (local.get $b))))) (then
        (call $gl_list_error (local.get $ctx) (i32.const 0x501)) (return (i32.const 0))))
      (local.set $obj (i32.load (local.get $p)))
      (local.set $internal (i32.load offset=12 (local.get $p)))
      (local.set $src (i32.load offset=28 (local.get $s)))
      (local.set $x (i32.add (local.get $x) (local.get $b))))
      (else
        (local.set $b (i32.load offset=20 (local.get $s)))
        (local.set $internal (i32.load offset=12 (local.get $s)))
        (local.set $src (i32.load offset=32 (local.get $s)))
        (if (local.get $w) (then
          (local.set $obj (call $d3d9_create_surface (local.get $w) (i32.const 1) (i32.const 32) (i32.const 4)))
          (if (i32.eqz (local.get $obj)) (then
            (call $gl_list_error (local.get $ctx) (i32.const 0x505)) (return (i32.const 0))))))))
    ;; All validation and allocation precede mutation, including queued use.
    (call $d3dim_worker_fence)
    (if (i32.eqz (local.get $sub)) (then
      (call $gl_sw_tex_release (local.get $p))
      (i32.store (local.get $p) (local.get $obj))
      (i32.store offset=4 (local.get $p) (local.get $w))
      (i32.store offset=8 (local.get $p) (local.get $b))
      (i32.store offset=12 (local.get $p) (local.get $internal))
      (i32.store offset=16 (local.get $p) (i32.const 1))))
    (if (i32.eqz (local.get $w)) (then (return (i32.const 1))))
    (local.set $entry (call $dx_from_this (local.get $obj)))
    (call $dx_surf_fmt_set (local.get $entry) (i32.const 5))
    (local.set $dst (i32.add (load.field DxObject misc1 (local.get $entry)) (i32.shl (local.get $x) (i32.const 2))))
    (loop $pixels
      (local.set $r (i32.load8_u (call $g2w (local.get $src))))
      (local.set $g (i32.load8_u (call $g2w (i32.add (local.get $src) (i32.const 1)))))
      (local.set $blue (i32.load8_u (call $g2w (i32.add (local.get $src) (i32.const 2)))))
      (local.set $a (i32.load8_u (call $g2w (i32.add (local.get $src) (i32.const 3)))))
      (i32.store (i32.add (local.get $dst) (i32.shl (local.get $i) (i32.const 2)))
        (call $gl_1d_select (i32.or (i32.or (i32.shl (local.get $a) (i32.const 24)) (i32.shl (local.get $r) (i32.const 16)))
          (i32.or (i32.shl (local.get $g) (i32.const 8)) (local.get $blue))) (local.get $internal)))
      (local.set $src (i32.add (local.get $src) (i32.const 4)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $pixels (i32.lt_u (local.get $i) (local.get $w))))
    (i32.const 1))

  ;; A level query returns a scalar. Invalid target/level/pname must be
  ;; rejected before validating the caller's output pointer.
  (func $gl_1d_level_value (param $p i32) (param $pname i32) (result i32)
    (local $internal i32) (local $base i32)
    (if (i32.eqz (local.get $p)) (then (return (select (i32.const 1) (i32.const 0)
      (i32.eq (local.get $pname) (i32.const 0x1003))))))
    (if (i32.eq (i32.load offset=16 (local.get $p)) (i32.const 2)) (then (return (i32.const 0))))
    (if (i32.eqz (i32.load offset=16 (local.get $p))) (then (return (select (i32.const 1) (i32.const 0)
      (i32.eq (local.get $pname) (i32.const 0x1003))))))
    (if (i32.eq (local.get $pname) (i32.const 0x1000)) (then (return (i32.load offset=4 (local.get $p)))))
    (if (i32.eq (local.get $pname) (i32.const 0x1001)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $pname) (i32.const 0x1005)) (then (return (i32.load offset=8 (local.get $p)))))
    (local.set $internal (i32.load offset=12 (local.get $p)))
    (if (i32.eq (local.get $pname) (i32.const 0x1003)) (then (return (local.get $internal))))
    (local.set $base (call $gl_texture_base (local.get $internal)))
    ;; Canonical storage chooses eight bits for every present component.
    (if (i32.le_u (i32.sub (local.get $pname) (i32.const 0x805c)) (i32.const 2))
      (then (return (select (i32.const 8) (i32.const 0) (i32.or (i32.eq (local.get $base) (i32.const 3)) (i32.eq (local.get $base) (i32.const 4)))))))
    (if (i32.eq (local.get $pname) (i32.const 0x805f))
      (then (return (select (i32.const 8) (i32.const 0) (i32.or (i32.eq (local.get $base) (i32.const 2))
        (i32.or (i32.eq (local.get $base) (i32.const 4)) (i32.eq (local.get $base) (i32.const 5))))))))
    (if (i32.eq (local.get $pname) (i32.const 0x8060))
      (then (return (select (i32.const 8) (i32.const 0) (i32.le_u (i32.sub (local.get $base) (i32.const 1)) (i32.const 1))))))
    (select (i32.const 8) (i32.const 0) (i32.eq (local.get $base) (i32.const 6))))

  ;; Per-draw sampler descriptor, two units *56B.
  (global $gl_1d_draw_storage (mut i32) (i32.const 0))
  (global $gl_1d_draw (mut i32) (i32.const 0))

  (func $gl_1d_capture
    (local $b i32) (local $object i32) (local $d i32) (local $unit i32)
    (local $last i32) (local $px i32) (local $i i32) (local $levels i32)
    (global.set $gl_1d_draw (i32.const 0))
    (if (i32.eqz (global.get $gl_current_context)) (then (return)))
    (if (i32.eqz (global.get $gl_1d_draw_storage)) (then
      (global.set $gl_1d_draw_storage (call $gl_list_alloc (i32.const 112)))))
    (if (i32.eqz (global.get $gl_1d_draw_storage)) (then (unreachable)))
    (global.set $gl_1d_draw (global.get $gl_1d_draw_storage))
    (local.set $b (call $gl_texture_block))
    (loop $units
      (local.set $d (i32.add (global.get $gl_1d_draw) (i32.mul (local.get $unit) (i32.const 56))))
      (memory.fill (local.get $d) (i32.const 0) (i32.const 56))
      (local.set $object (i32.load (i32.add (local.get $b) (i32.add (i32.const 16) (i32.shl (local.get $unit) (i32.const 3))))))
      (local.set $levels (i32.load offset=52 (local.get $object)))
      (local.set $last (call $gl_1d_complete (local.get $object)))
      (i32.store (local.get $d) (local.get $levels))
      (memory.copy (i32.add (local.get $d) (i32.const 4)) (i32.add (local.get $object) (i32.const 12)) (i32.const 12))
      (local.set $px (i32.const 0)) (local.set $i (i32.const 0))
      (loop $color
        (local.set $px (i32.or (local.get $px) (i32.shl
          (call $gl_sw_u8 (f32.load (i32.add (local.get $object) (i32.add (i32.const 28) (i32.shl (local.get $i) (i32.const 2))))))
          (select (i32.const 24) (i32.sub (i32.const 16) (i32.shl (local.get $i) (i32.const 3))) (i32.eq (local.get $i) (i32.const 3))))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br_if $color (i32.lt_u (local.get $i) (i32.const 4))))
      (if (local.get $levels) (then
        (local.set $px (call $gl_1d_select (local.get $px) (i32.load offset=12 (local.get $levels))))
        (i32.store offset=24 (local.get $d) (i32.load offset=12 (local.get $levels)))))
      (i32.store offset=16 (local.get $d) (local.get $px))
      (i32.store offset=20 (local.get $d) (local.get $last))
      (i32.store offset=28 (local.get $d) (i32.and (i32.ge_s (local.get $last) (i32.const 0))
        (i32.ne (i32.and (i32.load offset=192 (local.get $b)) (i32.shl (i32.const 1) (local.get $unit))) (i32.const 0))))
      (local.set $unit (i32.add (local.get $unit) (i32.const 1)))
      (br_if $units (i32.lt_u (local.get $unit) (i32.const 2)))))

  (func $gl_1d_selected (param $unit i32) (result i32)
    (if (i32.eqz (global.get $gl_1d_draw)) (then (return (i32.const 0))))
    (if (i32.and (i32.load (global.get $gl_sw_st)) (select (i32.const 0x80000) (i32.const 1) (local.get $unit)))
      (then (return (i32.const 0))))
    (i32.load offset=28 (i32.add (global.get $gl_1d_draw) (i32.mul (local.get $unit) (i32.const 56)))))

  ;; Return the required final level, or -1 for an incomplete image chain.
  (func $gl_1d_complete (param $object i32) (result i32)
    (local $levels i32) (local $p i32) (local $n i32) (local $border i32)
    (local $internal i32) (local $level i32) (local $filter i32)
    (local.set $levels (i32.load offset=52 (local.get $object)))
    (if (i32.eqz (local.get $levels)) (then (return (i32.const -1))))
    (local.set $border (i32.load offset=8 (local.get $levels)))
    (local.set $internal (i32.load offset=12 (local.get $levels)))
    (local.set $n (i32.sub (i32.load offset=4 (local.get $levels)) (i32.shl (local.get $border) (i32.const 1))))
    (if (i32.or (i32.eqz (i32.load (local.get $levels))) (i32.le_s (local.get $n) (i32.const 0)))
      (then (return (i32.const -1))))
    (local.set $filter (i32.load offset=12 (local.get $object)))
    (if (i32.or (i32.eq (local.get $filter) (i32.const 0x2600)) (i32.eq (local.get $filter) (i32.const 0x2601)))
      (then (return (i32.const 0))))
    (block $done (loop $chain
      (br_if $done (i32.eq (local.get $n) (i32.const 1)))
      (local.set $n (i32.shr_u (local.get $n) (i32.const 1)))
      (local.set $level (i32.add (local.get $level) (i32.const 1)))
      (local.set $p (i32.add (local.get $levels) (i32.mul (local.get $level) (i32.const 20))))
      (if (i32.or (i32.eqz (i32.load (local.get $p)))
          (i32.or (i32.ne (i32.load offset=4 (local.get $p)) (i32.add (local.get $n) (i32.shl (local.get $border) (i32.const 1))))
            (i32.or (i32.ne (i32.load offset=8 (local.get $p)) (local.get $border))
              (i32.ne (i32.load offset=12 (local.get $p)) (local.get $internal)))))
        (then (return (i32.const -1))))
      (br $chain)))
    (local.get $level))

  (func $gl_1d_tap (param $d i32) (param $level i32) (param $x i32) (result i32)
    (local $p i32) (local $n i32) (local $b i32) (local $e i32)
    (local.set $p (i32.add (i32.load (local.get $d)) (i32.mul (local.get $level) (i32.const 20))))
    (local.set $b (i32.load offset=8 (local.get $p)))
    (local.set $n (i32.sub (i32.load offset=4 (local.get $p)) (i32.shl (local.get $b) (i32.const 1))))
    (if (i32.eq (i32.load offset=12 (local.get $d)) (i32.const 0x2901)) (then
      ;; The interior is a power of two, so this also wraps negative taps.
      (local.set $x (i32.and (local.get $x) (i32.sub (local.get $n) (i32.const 1))))))
    (if (i32.eq (i32.load offset=12 (local.get $d)) (i32.const 0x812f)) (then
      (local.set $x (select (i32.const 0) (select (i32.sub (local.get $n) (i32.const 1)) (local.get $x) (i32.ge_s (local.get $x) (local.get $n))) (i32.lt_s (local.get $x) (i32.const 0))))))
    (if (i32.eq (i32.load offset=12 (local.get $d)) (i32.const 0x8370)) (then
      (local.set $x (i32.and (local.get $x) (i32.sub (i32.shl (local.get $n) (i32.const 1)) (i32.const 1))))
      (if (i32.ge_u (local.get $x) (local.get $n)) (then
        (local.set $x (i32.sub (i32.sub (i32.shl (local.get $n) (i32.const 1)) (i32.const 1)) (local.get $x)))))))
    (if (i32.or (i32.lt_s (local.get $x) (i32.sub (i32.const 0) (local.get $b)))
        (i32.ge_s (local.get $x) (i32.add (local.get $n) (local.get $b))))
      (then (return (i32.load offset=16 (local.get $d)))))
    (local.set $e (call $dx_from_this (i32.load (local.get $p))))
    (i32.load (i32.add (load.field DxObject misc1 (local.get $e))
      (i32.shl (i32.add (local.get $x) (local.get $b)) (i32.const 2)))))

  (func $gl_1d_level_sample (param $d i32) (param $level i32) (param $s f32) (param $linear i32) (result i32)
    (local $p i32) (local $n i32) (local $x i32) (local $f f32)
    (local.set $p (i32.add (i32.load (local.get $d)) (i32.mul (local.get $level) (i32.const 20))))
    (local.set $n (i32.sub (i32.load offset=4 (local.get $p)) (i32.shl (i32.load offset=8 (local.get $p)) (i32.const 1))))
    (if (f32.ne (f32.mul (local.get $s) (f32.const 0)) (f32.const 0)) (then (local.set $s (f32.const 0))))
    (if (i32.eq (i32.load offset=12 (local.get $d)) (i32.const 0x8370)) (then
      (local.set $s (f32.sub (local.get $s) (f32.mul (f32.const 2) (f32.floor (f32.mul (local.get $s) (f32.const 0.5))))))
      (if (f32.gt (local.get $s) (f32.const 1)) (then (local.set $s (f32.sub (f32.const 2) (local.get $s)))))))
    (if (i32.eq (i32.load offset=12 (local.get $d)) (i32.const 0x2901))
      (then (local.set $s (f32.sub (local.get $s) (f32.floor (local.get $s)))))
      (else (local.set $s (f32.max (f32.const 0) (f32.min (f32.const 1) (local.get $s))))))
    (local.set $f (f32.mul (local.get $s) (f32.convert_i32_u (local.get $n))))
    (if (i32.eqz (local.get $linear)) (then
      (local.set $x (i32.trunc_sat_f32_u (f32.floor (local.get $f))))
      (if (i32.ge_u (local.get $x) (local.get $n)) (then (local.set $x (i32.sub (local.get $n) (i32.const 1)))))
      (return (call $gl_1d_tap (local.get $d) (local.get $level) (local.get $x)))))
    (local.set $f (f32.sub (local.get $f) (f32.const 0.5)))
    (local.set $x (i32.trunc_sat_f32_s (f32.floor (local.get $f))))
    (call $d3dim_color_lerp
      (call $gl_1d_tap (local.get $d) (local.get $level) (local.get $x))
      (call $gl_1d_tap (local.get $d) (local.get $level) (i32.add (local.get $x) (i32.const 1)))
      (f32.sub (local.get $f) (f32.floor (local.get $f)))))

  ;; Derivatives of S/Q, not T, choose mip/filter independently per fragment.
  (func $gl_1d_sample (param $unit i32) (param $x i32) (param $y i32) (param $s f32) (result i32)
    (local $d i32) (local $filter i32) (local $linear i32) (local $level i32)
    (local $last i32) (local $c i32) (local $n f32) (local $q f32) (local $u f32)
    (local $fx f32) (local $fy f32) (local $dx f32) (local $dy f32) (local $rho f32)
    (local $lod f32) (local $threshold f32) (local $frac f32)
    (local.set $d (i32.add (global.get $gl_1d_draw) (i32.mul (local.get $unit) (i32.const 56))))
    (local.set $filter (i32.load offset=4 (local.get $d)))
    (local.set $linear (i32.eq (i32.load offset=8 (local.get $d)) (i32.const 0x2601)))
    (local.set $last (i32.load offset=20 (local.get $d)))
    (local.set $n (f32.convert_i32_u (i32.sub (i32.load offset=4 (i32.load (local.get $d)))
      (i32.shl (i32.load offset=8 (i32.load (local.get $d))) (i32.const 1)))))
    (local.set $fx (f32.add (f32.convert_i32_s (local.get $x)) (f32.const 0.5)))
    (local.set $fy (f32.add (f32.convert_i32_s (local.get $y)) (f32.const 0.5)))
    (local.set $q (f32.add (f32.load offset=52 (local.get $d))
      (f32.add (f32.mul (f32.load offset=44 (local.get $d)) (local.get $fx)) (f32.mul (f32.load offset=48 (local.get $d)) (local.get $fy)))))
    (if (f32.gt (f32.abs (local.get $q)) (f32.const 0.000000000001)) (then
      (local.set $u (f32.div (f32.add (f32.load offset=40 (local.get $d))
        (f32.add (f32.mul (f32.load offset=32 (local.get $d)) (local.get $fx)) (f32.mul (f32.load offset=36 (local.get $d)) (local.get $fy)))) (local.get $q)))
      (local.set $s (local.get $u))
      (local.set $dx (f32.mul (local.get $n) (f32.div (f32.sub (f32.load offset=32 (local.get $d))
        (f32.mul (local.get $u) (f32.load offset=44 (local.get $d)))) (local.get $q))))
      (local.set $dy (f32.mul (local.get $n) (f32.div (f32.sub (f32.load offset=36 (local.get $d))
        (f32.mul (local.get $u) (f32.load offset=48 (local.get $d)))) (local.get $q))))
      (local.set $rho (f32.max (f32.abs (local.get $dx)) (f32.abs (local.get $dy))))))
    (local.set $lod (f32x4.extract_lane 0 (call $d3d_shader_vm_log2 (f32x4.splat (local.get $rho)))))
    ;; GL1.1 c=1/2 only for linear magnification paired with nearest within
    ;; a mip level; all other filter combinations use c=0.
    (if (i32.and (local.get $linear) (i32.or (i32.eq (local.get $filter) (i32.const 0x2700))
        (i32.eq (local.get $filter) (i32.const 0x2702)))) (then (local.set $threshold (f32.const 0.5))))
    (if (f32.gt (local.get $lod) (local.get $threshold)) (then
      (local.set $linear (i32.or (i32.eq (local.get $filter) (i32.const 0x2601))
        (i32.or (i32.eq (local.get $filter) (i32.const 0x2701)) (i32.eq (local.get $filter) (i32.const 0x2703)))))
      (if (i32.ge_u (local.get $filter) (i32.const 0x2700)) (then
        (local.set $lod (f32.max (f32.const 0) (f32.min (f32.convert_i32_u (local.get $last)) (local.get $lod))))
        (if (i32.lt_u (local.get $filter) (i32.const 0x2702))
          (then (local.set $level (i32.trunc_sat_f32_u
            (f32.sub (f32.ceil (f32.add (local.get $lod) (f32.const 0.5))) (f32.const 1)))))
          (else (local.set $level (i32.trunc_sat_f32_u (local.get $lod)))
            (local.set $frac (f32.sub (local.get $lod) (f32.floor (local.get $lod))))))))))
    (local.set $c (call $gl_1d_level_sample (local.get $d) (local.get $level) (local.get $s) (local.get $linear)))
    (if (f32.gt (local.get $frac) (f32.const 0)) (then
      (local.set $c (call $d3dim_color_lerp (local.get $c)
        (call $gl_1d_level_sample (local.get $d) (i32.add (local.get $level) (i32.const 1)) (local.get $s) (local.get $linear)) (local.get $frac)))))
    (local.get $c))

  ;; Called after projection/scissor shifting, before raster spans execute.
  (func $gl_1d_planes (param $n i32) (param $a i32) (param $b i32) (param $c i32)
    (local $unit i32) (local $kind i32) (local $offset i32) (local $out i32)
    (local $s0 i32) (local $s1 i32) (local $s2 i32)
    (local $v0 f32) (local $v1 f32) (local $v2 f32)
    (local.set $s0 (call $gl_sw_screen_at (i32.const 0)))
    (local.set $s1 (call $gl_sw_screen_at (i32.const 1)))
    (local.set $s2 (call $gl_sw_screen_at (i32.const 2)))
    (if (i32.lt_u (local.get $n) (i32.const 2)) (then (local.set $b (local.get $a)) (local.set $s1 (local.get $s0))))
    (loop $units
      (if (call $gl_1d_selected (local.get $unit)) (then
        (local.set $kind (i32.const 0))
        (loop $planes
          (local.set $offset (if (result i32) (local.get $kind)
            (then (select (i32.const 52) (i32.const 48) (local.get $unit)))
            (else (select (i32.const 40) (i32.const 16) (local.get $unit)))))
          (local.set $out (i32.add (global.get $gl_1d_draw)
            (i32.add (i32.mul (local.get $unit) (i32.const 56)) (i32.add (i32.const 32) (i32.mul (local.get $kind) (i32.const 12))))))
          (local.set $v0 (f32.mul (f32.load (i32.add (local.get $a) (local.get $offset))) (f32.load offset=12 (local.get $s0))))
          (local.set $v1 (f32.mul (f32.load (i32.add (local.get $b) (local.get $offset))) (f32.load offset=12 (local.get $s1))))
          (if (i32.eq (local.get $n) (i32.const 3)) (then
            (local.set $v2 (f32.mul (f32.load (i32.add (local.get $c) (local.get $offset))) (f32.load offset=12 (local.get $s2))))
            (call $rast_plane
              (i32.load (local.get $s0)) (i32.load offset=4 (local.get $s0)) (local.get $v0)
              (i32.load (local.get $s1)) (i32.load offset=4 (local.get $s1)) (local.get $v1)
              (i32.load (local.get $s2)) (i32.load offset=4 (local.get $s2)) (local.get $v2)))
            (else (call $gl_sw_line_plane (local.get $s0) (local.get $s1) (local.get $v0) (local.get $v1))))
          (f32.store (local.get $out) (global.get $rast_pa))
          (f32.store offset=4 (local.get $out) (global.get $rast_pb))
          (f32.store offset=8 (local.get $out) (global.get $rast_pc))
          (local.set $kind (i32.add (local.get $kind) (i32.const 1)))
          (br_if $planes (i32.lt_u (local.get $kind) (i32.const 2))))))
      (local.set $unit (i32.add (local.get $unit) (i32.const 1)))
      (br_if $units (i32.lt_u (local.get $unit) (i32.const 2)))))
