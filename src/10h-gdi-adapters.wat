  ;; Native GDI adapters retained from the former host-import boundary.
  ;; These are WAT functions, not JS imports. The gdi_native_ prefix makes
  ;; that boundary explicit; only actual host imports retain host_gdi_.

  (func $gdi_native_create_solid_brush (param i32) (result i32)
    (call $gdi_object_alloc (i32.const 2) (i32.const 0) (i32.const 0)
      (local.get 0) (i32.const 0)))

  (func $gdi_native_create_compat_dc (param i32) (result i32) (call $gdi_dc_alloc))

  (func $gdi_native_create_compat_bitmap (param i32 i32 i32 i32) (result i32)
    (call $gdi_create_compat_bitmap_internal (local.get 1) (local.get 2) (local.get 3)))
  ;; gdi_create_compat_bitmap(hdc, width, height, backingWa) registers a DDB
  ;; whose private canonical pixels live at backingWa. The address is not
  ;; exposed through BITMAP.bmBits.

  (func $gdi_native_select_object (param i32 i32) (result i32)
    (local $old i32)
    (local.set $old (call $gdi_dc_select_owned_object (local.get 0) (local.get 1)))
    (select (local.get $old) (i32.const 0) (i32.ne (local.get $old) (i32.const -1))))

  (func $gdi_native_delete_object (param i32) (result i32)
    (call $gdi_object_delete_full (local.get 0)))

  (func $gdi_native_delete_dc (param i32) (result i32)
    (call $gdi_dc_delete (local.get 0)))

  (func $gdi_native_round_rect (param i32 i32 i32 i32 i32 i32 i32) (result i32)
    (local $desc i32)
    (local.set $desc (global.get $GDI_LINE_DESC))
    (if (i32.eqz (call $gdi_surface_descriptor (local.get 0) (local.get $desc)))
      (then (return (i32.const 0))))
    (call $gdi_round_rect_desc (local.get 0) (local.get $desc)
      (local.get 1) (local.get 2) (local.get 3) (local.get 4) (local.get 5) (local.get 6)
      (call $gdi_dc_get_field (local.get 0) (i32.const 4) (i32.const 0x30017))
      (call $gdi_dc_get_field (local.get 0) (i32.const 8) (i32.const 0x30010))
      (call $gdi_dc_get_rop2 (local.get 0))))
  ;; gdi_round_rect(hdc, left, top, right, bottom, ellipseWidth, ellipseHeight)

  (func $gdi_native_fill_rect (param $hdc i32) (param $left i32) (param $top i32)
        (param $right i32) (param $bottom i32) (param $brush i32) (result i32)
    (local $desc i32)
    (if (i32.eqz (local.get $brush))
      (then (local.set $brush
        (call $gdi_dc_get_field (local.get $hdc) (i32.const 8) (i32.const 0x30010)))))
    (local.set $desc (global.get $GDI_LINE_DESC))
    (if (i32.eqz (call $gdi_surface_descriptor (local.get $hdc) (local.get $desc)))
      (then (return (i32.const 0))))
    (call $gdi_fill_rect_desc (local.get $hdc) (local.get $desc)
      (local.get $left) (local.get $top) (local.get $right) (local.get $bottom)
      (local.get $brush)))

  (func $gdi_native_draw_edge (param $hdc i32) (param $left i32) (param $top i32)
        (param $right i32) (param $bottom i32) (param $edge i32) (param $flags i32)
        (result i32)
    (local $desc i32)
    (local.set $desc (global.get $GDI_LINE_DESC))
    (if (i32.eqz (call $gdi_surface_descriptor (local.get $hdc) (local.get $desc)))
      (then (return (i32.const 0))))
    (call $gdi_draw_edge_desc (local.get $hdc) (local.get $desc)
      (local.get $left) (local.get $top) (local.get $right) (local.get $bottom)
      (local.get $edge) (local.get $flags) (i32.const 0)))
  ;; gdi_draw_focus_rect(hdc, left, top, right, bottom) — 1px dotted black rect.

  (func $gdi_native_draw_focus_rect (param $hdc i32) (param $left i32) (param $top i32)
        (param $right i32) (param $bottom i32) (result i32)
    (local $desc i32)
    (local.set $desc (global.get $GDI_LINE_DESC))
    (if (i32.eqz (call $gdi_surface_descriptor (local.get $hdc) (local.get $desc)))
      (then (return (i32.const 0))))
    (call $gdi_focus_rect_desc (local.get $hdc) (local.get $desc)
      (local.get $left) (local.get $top) (local.get $right) (local.get $bottom)))
  ;; gdi_gradient_fill_h(hdc, l, t, r, b, colorL, colorR) — horizontal linear gradient.
  ;; Win32 equivalent: GdiGradientFill(GRADIENT_FILL_RECT_H). Used by defwndproc_ncpaint.

  (func $gdi_native_gradient_fill_h
        (param $hdc i32) (param $left i32) (param $top i32)
        (param $right i32) (param $bottom i32)
        (param $color_left i32) (param $color_right i32) (result i32)
    (local $desc i32)
    (local.set $desc (global.get $GDI_LINE_DESC))
    (if (i32.eqz (call $gdi_surface_descriptor (local.get $hdc) (local.get $desc)))
      (then (return (i32.const 0))))
    (call $gdi_gradient_fill_h_desc
      (local.get $hdc) (local.get $desc)
      (local.get $left) (local.get $top) (local.get $right) (local.get $bottom)
      (local.get $color_left) (local.get $color_right)))
  ;; gdi_fill_rect(hdc, left, top, right, bottom, hbrush)

  (func $gdi_native_ellipse (param $hdc i32) (param $left i32) (param $top i32)
        (param $right i32) (param $bottom i32) (result i32)
    (local $desc i32)
    (local.set $desc (global.get $GDI_LINE_DESC))
    (if (i32.eqz (call $gdi_surface_descriptor (local.get $hdc) (local.get $desc)))
      (then (return (i32.const 0))))
    (call $gdi_ellipse_desc (local.get $hdc) (local.get $desc)
      (local.get $left) (local.get $top) (local.get $right) (local.get $bottom)
      (call $gdi_dc_get_field (local.get $hdc) (i32.const 4) (i32.const 0x30017))
      (call $gdi_dc_get_field (local.get $hdc) (i32.const 8) (i32.const 0x30010))
      (call $gdi_dc_get_rop2 (local.get $hdc))))
  ;; gdi_ellipse(hdc, left, top, right, bottom)

  (func $gdi_native_fill_rgn (param i32 i32 i32) (result i32)
    (call $gdi_hdc_fill_rgn (local.get 0) (local.get 1) (local.get 2)))
  ;; gdi_fill_rgn(hdc, hrgn, hbrush) — hbrush=0 uses DC's current brush (for PaintRgn)

  (func $gdi_native_frame_rgn (param i32 i32 i32 i32 i32) (result i32)
    (call $gdi_hdc_frame_rgn
      (local.get 0) (local.get 1) (local.get 2) (local.get 3) (local.get 4)))
  ;; gdi_frame_rgn(hdc, hrgn, hbrush, width, height) -> bool

  (func $gdi_native_select_clip_rgn (param i32 i32) (result i32)
    (call $gdi_dc_clip_select (local.get 0) (local.get 1)))
  ;; gdi_select_clip_rgn(hdc, hrgn) -> complexity

  (func $gdi_native_intersect_clip_rect (param i32 i32 i32 i32 i32) (result i32)
    (call $gdi_dc_clip_intersect_rect
      (local.get 0) (local.get 1) (local.get 2) (local.get 3) (local.get 4)))
  ;; gdi_intersect_clip_rect(hdc, l, t, r, b) -> complexity

  (func $gdi_native_poly_bezier (param i32 i32 i32 i32) (result i32)
    (call $gdi_poly_bezier (local.get 0) (local.get 1) (local.get 2) (local.get 3)))
  ;; gdi_poly_bezier(hdc, pointsWaPtr, nCount, fromCurrent)

  (func $gdi_native_move_to (param $hdc i32) (param $x i32) (param $y i32) (result i32)
    (if (i32.eqz (call $gdi_dc_state_entry (local.get $hdc) (i32.const 0)))
      (then (return (i32.const 0))))
    (drop (call $gdi_dc_set_field (local.get $hdc) (i32.const 12) (local.get $x) (i32.const 0)))
    (drop (call $gdi_dc_set_field (local.get $hdc) (i32.const 16) (local.get $y) (i32.const 0)))
    (i32.const 1))

  (func $gdi_native_line_to (param $hdc i32) (param $x i32) (param $y i32) (result i32)
    (local $from_x i32) (local $from_y i32) (local $ok i32)
    (local.set $from_x (call $gdi_dc_get_field (local.get $hdc) (i32.const 12) (i32.const 0)))
    (local.set $from_y (call $gdi_dc_get_field (local.get $hdc) (i32.const 16) (i32.const 0)))
    (global.set $gdi_line_style_phase (i32.const 0))
    (local.set $ok (call $gdi_line_try
      (local.get $hdc) (local.get $from_x) (local.get $from_y) (local.get $x) (local.get $y)))
    (if (local.get $ok)
      (then
        (drop (call $gdi_dc_set_field (local.get $hdc) (i32.const 12) (local.get $x) (i32.const 0)))
        (drop (call $gdi_dc_set_field (local.get $hdc) (i32.const 16) (local.get $y) (i32.const 0)))))
    (local.get $ok))
  ;; gdi_line_to(hdc, x, y)

  (func $gdi_native_get_current_object (param $hdc i32) (param $type i32) (result i32)
    (if (i32.eq (local.get $type) (i32.const 1))
      (then (return (call $gdi_dc_get_field (local.get $hdc) (i32.const 4) (i32.const 0x30017)))))
    (if (i32.eq (local.get $type) (i32.const 2))
      (then (return (call $gdi_dc_get_field (local.get $hdc) (i32.const 8) (i32.const 0x30010)))))
    (if (i32.eq (local.get $type) (i32.const 5))
      (then (return (call $gdi_dc_selected_palette (local.get $hdc)))))
    (if (i32.eq (local.get $type) (i32.const 6))
      (then (return (call $gdi_dc_get_field (local.get $hdc) (i32.const 88) (i32.const 0x3001D)))))
    (if (i32.eq (local.get $type) (i32.const 7))
      (then (return (call $gdi_dc_get_field (local.get $hdc) (i32.const 84) (i32.const 0x30007)))))
    (i32.const 0))
  ;; gdi_get_current_object(hdc, objectType) → handle

  (func $gdi_native_arc (param i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32)
    (call $gdi_arc
      (local.get 0) (local.get 1) (local.get 2) (local.get 3) (local.get 4)
      (local.get 5) (local.get 6) (local.get 7) (local.get 8) (i32.const 0)))
  ;; gdi_arc(hdc, left, top, right, bottom, xStart, yStart, xEnd, yEnd)

  (func $gdi_native_bitblt (param i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32)
    (call $gdi_hdc_bitblt
      (local.get 0) (local.get 1) (local.get 2) (local.get 3) (local.get 4)
      (local.get 5) (local.get 6) (local.get 7) (local.get 8)))
  ;; gdi_bitblt(dstDC, dx, dy, w, h, srcDC, sx, sy, rop)

  (func $gdi_native_transparent_blt (param i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32)
    (call $gdi_hdc_transparent_blt
      (local.get 0) (local.get 1) (local.get 2) (local.get 3) (local.get 4)
      (local.get 5) (local.get 6) (local.get 7) (local.get 8)))
  ;; gdi_transparent_blt(dstDC, dx, dy, w, h, srcDC, sx, sy, colorKey)

  (func $gdi_native_disabled_blt (param i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32)
    (call $gdi_hdc_disabled_blt
      (local.get 0) (local.get 1) (local.get 2) (local.get 3) (local.get 4)
      (local.get 5) (local.get 6) (local.get 7) (local.get 8)))
  ;; gdi_disabled_blt(dstDC, dx, dy, w, h, srcDC, sx, sy, colorKey)

  (func $gdi_native_stretch_blt (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32)
    (call $gdi_hdc_stretch_blt
      (local.get 0) (local.get 1) (local.get 2) (local.get 3) (local.get 4)
      (local.get 5) (local.get 6) (local.get 7) (local.get 8) (local.get 9)
      (local.get 10)))
  ;; gdi_stretch_blt(dstDC, dx, dy, dw, dh, srcDC, sx, sy, sw, sh, rop)

  (func $gdi_native_scroll_window (param i32 i32 i32 i32 i32) (result i32)
    (call $gdi_scroll_window
      (local.get 0) (local.get 1) (local.get 2)
      (if (result i32) (local.get 3) (then (call $g2w (local.get 3))) (else (i32.const 0)))
      (if (result i32) (local.get 4) (then (call $g2w (local.get 4))) (else (i32.const 0)))))
  ;; gdi_scroll_window(hwnd, dx, dy, prcScroll, prcClip)

  (func $gdi_native_load_bitmap (param i32 i32) (result i32)
    (call $gdi_bitmap_load_resource (local.get 0) (local.get 1) (i32.const 0)))

  (func $gdi_native_get_object_w (param i32) (result i32)
    (local $record i32)
    (local.set $record (call $gdi_object_record (local.get 0)))
    (if (result i32)
      (i32.and (i32.ne (local.get $record) (i32.const 0))
        (i32.eq (load.field.memarg GdiObject type (local.get $record)) (i32.const 3)))
      (then (load.field.memarg GdiBitmap width (local.get $record))) (else (i32.const 0))))

  (func $gdi_native_get_object_h (param i32) (result i32)
    (local $record i32)
    (local.set $record (call $gdi_object_record (local.get 0)))
    (if (result i32)
      (i32.and (i32.ne (local.get $record) (i32.const 0))
        (i32.eq (load.field.memarg GdiObject type (local.get $record)) (i32.const 3)))
      (then (load.field.memarg GdiBitmap height (local.get $record))) (else (i32.const 0))))

  (func $gdi_native_set_viewport_org (param i32 i32 i32) (result i32)
    (drop (call $gdi_dc_set_field (local.get 0) (i32.const 56) (local.get 1) (i32.const 0)))
    (drop (call $gdi_dc_set_field (local.get 0) (i32.const 60) (local.get 2) (i32.const 0)))
    (i32.const 1))

  (func $gdi_native_get_viewport_org_x (param i32) (result i32)
    (call $gdi_dc_get_field (local.get 0) (i32.const 56) (i32.const 0)))

  (func $gdi_native_get_viewport_org_y (param i32) (result i32)
    (call $gdi_dc_get_field (local.get 0) (i32.const 60) (i32.const 0)))

  (func $gdi_native_set_viewport_ext (param i32 i32 i32) (result i32)
    (if (i32.or (i32.eqz (local.get 1)) (i32.eqz (local.get 2)))
      (then (return (i32.const 0))))
    (drop (call $gdi_dc_set_field (local.get 0) (i32.const 64) (local.get 1) (i32.const 1)))
    (drop (call $gdi_dc_set_field (local.get 0) (i32.const 68) (local.get 2) (i32.const 1)))
    (i32.const 1))

  (func $gdi_native_get_viewport_ext_x (param i32) (result i32)
    (call $gdi_dc_get_field (local.get 0) (i32.const 64) (i32.const 1)))

  (func $gdi_native_get_viewport_ext_y (param i32) (result i32)
    (call $gdi_dc_get_field (local.get 0) (i32.const 68) (i32.const 1)))

  (func $gdi_native_set_window_org (param i32 i32 i32) (result i32)
    (drop (call $gdi_dc_set_field (local.get 0) (i32.const 40) (local.get 1) (i32.const 0)))
    (drop (call $gdi_dc_set_field (local.get 0) (i32.const 44) (local.get 2) (i32.const 0)))
    (i32.const 1))

  (func $gdi_native_get_window_org_x (param i32) (result i32)
    (call $gdi_dc_get_field (local.get 0) (i32.const 40) (i32.const 0)))

  (func $gdi_native_get_window_org_y (param i32) (result i32)
    (call $gdi_dc_get_field (local.get 0) (i32.const 44) (i32.const 0)))

  (func $gdi_native_set_window_ext (param i32 i32 i32) (result i32)
    (if (i32.or (i32.eqz (local.get 1)) (i32.eqz (local.get 2)))
      (then (return (i32.const 0))))
    (drop (call $gdi_dc_set_field (local.get 0) (i32.const 48) (local.get 1) (i32.const 1)))
    (drop (call $gdi_dc_set_field (local.get 0) (i32.const 52) (local.get 2) (i32.const 1)))
    (i32.const 1))

  (func $gdi_native_get_window_ext_x (param i32) (result i32)
    (call $gdi_dc_get_field (local.get 0) (i32.const 48) (i32.const 1)))

  (func $gdi_native_get_window_ext_y (param i32) (result i32)
    (call $gdi_dc_get_field (local.get 0) (i32.const 52) (i32.const 1)))

  (func $gdi_native_set_pixel (param i32 i32 i32 i32) (result i32)
    (call $gdi_hdc_set_pixel (local.get 0) (local.get 1) (local.get 2) (local.get 3)))
  ;; gdi_set_pixel(hdc, x, y, color) → prev color

  (func $gdi_native_get_di_bits (param i32 i32 i32 i32 i32 i32 i32) (result i32)
    (call $gdi_get_dibits
      (local.get 0) (local.get 1) (local.get 2) (local.get 3)
      (if (result i32) (local.get 4) (then (call $g2w (local.get 4))) (else (i32.const 0)))
      (local.get 5) (local.get 6)))
  ;; gdi_get_di_bits(hdc, hBitmap, startScan, numScans, bitsGA, bmiWA, colorUse) → numScans

  (func $gdi_native_set_dib_bits (param i32 i32 i32 i32 i32 i32 i32) (result i32)
    (call $gdi_set_dibits
      (local.get 0) (local.get 1) (local.get 2) (local.get 3)
      (local.get 4) (local.get 5) (local.get 6)))
  ;; gdi_set_dib_bits(hdc, hBitmap, startScan, numScans, bitsWasmAddr, bmiWasmAddr, colorUse) → numScans

  (func $gdi_native_get_dib_color_table (param i32 i32 i32 i32) (result i32)
    (call $gdi_get_dib_color_table
      (local.get 0) (local.get 1) (local.get 2) (call $g2w (local.get 3))))
  ;; gdi_get_dib_color_table(hdc, startIdx, numEntries, colorsGA) → count

  (func $gdi_native_set_dib_to_device
        (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32)
    (call $gdi_set_dib_to_device
      (local.get 0) (local.get 1) (local.get 2) (local.get 3)
      (local.get 4) (local.get 5) (local.get 6) (local.get 7)
      (local.get 8) (local.get 9) (local.get 10) (local.get 11)))
  ;; gdi_set_dib_to_device(hdc, xDest, yDest, w, h, xSrc, ySrc, startScan, cLines, bitsWA, bmiWA, colorUse) → cLines

  (func $gdi_native_stretch_dib_bits (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32)
    (call $gdi_stretch_dibits
      (local.get 0) (local.get 1) (local.get 2) (local.get 3) (local.get 4)
      (local.get 5) (local.get 6) (local.get 7) (local.get 8)
      (local.get 9) (local.get 10) (local.get 11) (local.get 12)))
  ;; gdi_stretch_dib_bits(hdc, xDst, yDst, wDst, hDst, xSrc, ySrc, wSrc, hSrc, bitsWA, bmiWA, usage, rop)
