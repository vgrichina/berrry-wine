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
    (i32.store (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base)
      (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

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
