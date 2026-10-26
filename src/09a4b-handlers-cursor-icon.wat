  ;; 108: LoadCursorA(hInstance, lpCursorName) — return HCURSOR encoding the IDC_*.
  ;; System cursors: hInstance=0, lpCursorName is an ordinal (MAKEINTRESOURCE,
  ;; value < 0x10000) in the IDC_* range (32512..). Encoded handle:
  ;;   0x60000 | (IDC_X & 0xFFFF) — system IDC cursor.
  ;;   0x680000 | (resource & 0xFFFF) — app RT_GROUP_CURSOR resource.
  (func $handle_LoadCursorA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.and (i32.eqz (local.get $arg0))
                 (i32.lt_u (local.get $arg1) (i32.const 0x10000)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.or (i32.const 0x60000)
                                     (i32.and (local.get $arg1) (i32.const 0xFFFF)))))
      (else
        (if (i32.lt_u (local.get $arg1) (i32.const 0x10000))
          (then (i32.store offset=0 (global.get $reg_base) (i32.or (i32.const 0x680000)
                                         (i32.and (local.get $arg1) (i32.const 0xFFFF)))))
          (else (i32.store offset=0 (global.get $reg_base) (i32.const 0x67F00)))))) ;; string cursor names unsupported
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; ---- ICON_TABLE: HICON → the resource it was loaded from ----
  ;; An icon handle used to be the constant 0x60001, which meant DrawIconEx
  ;; had nothing to draw and every icon in the system was the same nothing.
  ;; Remembering {hInstance, resource id} is the whole difference: the pixels
  ;; are already decodable from the PE by $gdi_icon_draw_resource_at.
  ;; An icon built from bitmaps rather than loaded from a resource: CreateIcon
  ;; hands over the AND and XOR bits directly, so there is no {module,
  ;; resource} to remember. It is interned with a null instance and the colour
  ;; bitmap as its "resource", and drawing one blits that bitmap — see
  ;; $icon_draw_handle. Visual Basic's controls build their pictures this way.
  (global $ICON_FROM_BITMAP i32 (i32.const 0x1C0B17))
  (global $ICON_FROM_OPAQUE i32 (i32.const 0x0FACED))
  ;; A Win16 NE module id, stored in ICON_TABLE's hInstance word. The low 24
  ;; bits are the $win16_res_module selector (task=1, DLL=0x10000|id).
  (global $ICON_FROM_WIN16 i32 (i32.const 0x16000000))

  (func $icon_intern (param $hinst i32) (param $resid i32) (result i32)
    (local $i i32) (local $p i32) (local $free i32)
    (local.set $free (i32.const -1))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $MAX_ICONS)))
      (local.set $p (i32.add (global.get $ICON_TABLE)
                     (i32.mul (local.get $i) (i32.const 8))))
      ;; A repeat load of the same resource must hand back the same handle:
      ;; apps compare HICONs, and DestroyIcon on a duplicate is common.
      (if (i32.and (i32.eq (i32.load (local.get $p)) (local.get $hinst))
                   (i32.eq (i32.load offset=4 (local.get $p)) (local.get $resid)))
        (then (return (i32.or (global.get $ICON_HANDLE_TAG) (local.get $i)))))
      (if (i32.and (i32.lt_s (local.get $free) (i32.const 0))
                   (i32.eqz (i32.load offset=4 (local.get $p))))
        (then (local.set $free (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (if (i32.lt_s (local.get $free) (i32.const 0)) (then (return (i32.const 0))))
    (local.set $p (i32.add (global.get $ICON_TABLE)
                   (i32.mul (local.get $free) (i32.const 8))))
    (i32.store (local.get $p) (local.get $hinst))
    (i32.store offset=4 (local.get $p) (local.get $resid))
    (i32.or (global.get $ICON_HANDLE_TAG) (local.get $free)))

  ;; Draw a bitmap-backed ICONINFO record.  cursor_rasterize is the one place
  ;; that interprets the AND/XOR planes, including DDB orientation and
  ;; monochrome icons; sampling that canonical BGRA result keeps DrawIcon and
  ;; the browser cursor path on the same pixels.  Win98 icons have binary
  ;; transparency, so an opaque source pixel replaces the destination while a
  ;; transparent one leaves it untouched.
  (func $cursor_draw_handle (param $hicon i32) (param $hdc i32)
        (param $x i32) (param $y i32) (param $cx i32) (param $cy i32)
        (param $di_flags i32) (result i32)
    (local $record i32) (local $src_w i32) (local $src_h i32)
    (local $pixels_ga i32) (local $pixels i32) (local $dst i32)
    (local $dx i32) (local $dy i32) (local $px i32) (local $py i32)
    (local $sx i32) (local $sy i32) (local $pixel i32)
    (local.set $record (call $cursor_record (local.get $hicon)))
    (if (i32.eqz (local.get $record)) (then (return (i32.const 0))))
    (local.set $src_w (call $cursor_width (local.get $record)))
    (local.set $src_h (call $cursor_height (local.get $record)))
    (if (i32.or
          (i32.or (i32.le_s (local.get $src_w) (i32.const 0))
            (i32.gt_s (local.get $src_w) (i32.const 1024)))
          (i32.or (i32.le_s (local.get $src_h) (i32.const 0))
            (i32.gt_s (local.get $src_h) (i32.const 1024))))
      (then (return (i32.const 0))))
    (if (i32.le_s (local.get $cx) (i32.const 0))
      (then (local.set $cx (local.get $src_w))))
    (if (i32.le_s (local.get $cy) (i32.const 0))
      (then (local.set $cy (local.get $src_h))))
    (if (i32.or
          (i32.or (i32.le_s (local.get $cx) (i32.const 0))
            (i32.gt_s (local.get $cx) (i32.const 4096)))
          (i32.or (i32.le_s (local.get $cy) (i32.const 0))
            (i32.gt_s (local.get $cy) (i32.const 4096))))
      (then (return (i32.const 0))))
    (local.set $pixels_ga (call $dib_alloc
      (i32.shl (i32.mul (local.get $src_w) (local.get $src_h)) (i32.const 2))))
    (if (i32.eqz (local.get $pixels_ga)) (then (return (i32.const 0))))
    (local.set $pixels (call $g2w (local.get $pixels_ga)))
    (if (i32.eqz (call $cursor_rasterize (local.get $record) (local.get $pixels)))
      (then
        (call $dib_free_wasm (local.get $pixels))
        (return (i32.const 0))))
    (local.set $dst (global.get $GDI_BLIT_DST_DESC))
    (if (i32.eqz (call $gdi_surface_descriptor (local.get $hdc) (local.get $dst)))
      (then
        (call $dib_free_wasm (local.get $pixels))
        (return (i32.const 0))))
    (local.set $dx (call $gdi_line_map_x (local.get $dst) (local.get $x)))
    (local.set $dy (call $gdi_line_map_y (local.get $dst) (local.get $y)))
    (block $rows_done (loop $rows
      (br_if $rows_done (i32.ge_u (local.get $py) (local.get $cy)))
      (local.set $sy (i32.div_u (i32.mul (local.get $py) (local.get $src_h))
        (local.get $cy)))
      (local.set $px (i32.const 0))
      (block $cols_done (loop $cols
        (br_if $cols_done (i32.ge_u (local.get $px) (local.get $cx)))
        (local.set $sx (i32.div_u (i32.mul (local.get $px) (local.get $src_w))
          (local.get $cx)))
        (local.set $pixel (i32.load (i32.add (local.get $pixels)
          (i32.shl (i32.add (i32.mul (local.get $sy) (local.get $src_w))
            (local.get $sx)) (i32.const 2)))))
        (if (i32.and
              (i32.ne (i32.and (local.get $pixel) (i32.const 0xFF000000))
                (i32.const 0))
              (call $gdi_raster_clip_visible (local.get $hdc) (local.get $dst)
                (i32.add (local.get $dx) (local.get $px))
                (i32.add (local.get $dy) (local.get $py))))
          (then (drop (call $gdi_raster_write (local.get $dst)
            (i32.add (local.get $dx) (local.get $px))
            (i32.add (local.get $dy) (local.get $py))
            (i32.and (local.get $pixel) (i32.const 0x00FFFFFF))))))
        (local.set $px (i32.add (local.get $px) (i32.const 1)))
        (br $cols)))
      (local.set $py (i32.add (local.get $py) (i32.const 1)))
      (br $rows)))
    (call $gdi_geometry_present (local.get $hdc) (local.get $dst)
      (local.get $dx) (local.get $dy)
      (i32.add (local.get $dx) (local.get $cx))
      (i32.add (local.get $dy) (local.get $cy)))
    (call $dib_free_wasm (local.get $pixels))
    (i32.const 1))

  ;; Paint an interned icon. Returns 0 for any handle we did not intern, which
  ;; keeps the old opaque handles (and system icons we ship no pixels for)
  ;; behaving exactly as before instead of drawing garbage.
  (func $icon_draw_handle (param $hicon i32) (param $hdc i32)
        (param $x i32) (param $y i32) (param $cx i32) (param $cy i32)
        (param $di_flags i32) (result i32)
    (local $slot i32) (local $p i32) (local $ok i32)
    (if (call $cursor_draw_handle
          (local.get $hicon) (local.get $hdc)
          (local.get $x) (local.get $y) (local.get $cx) (local.get $cy)
          (local.get $di_flags))
      (then (return (i32.const 1))))
    (if (i32.ne (i32.and (local.get $hicon) (i32.const 0xFFFF0000))
                (global.get $ICON_HANDLE_TAG))
      (then (return (i32.const 0))))
    (local.set $slot (i32.and (local.get $hicon) (i32.const 0xFFFF)))
    (if (i32.ge_u (local.get $slot) (global.get $MAX_ICONS))
      (then (return (i32.const 0))))
    (local.set $p (i32.add (global.get $ICON_TABLE)
                   (i32.mul (local.get $slot) (i32.const 8))))
    (if (i32.eqz (i32.load offset=4 (local.get $p)))
      (then (return (i32.const 0))))
    ;; cx/cy of 0 mean "the icon's own size" — resources and CreateIcon's
    ;; legacy bitmap wrapper default to the Win98 large-icon metric.
    (if (i32.le_s (local.get $cx) (i32.const 0))
      (then (local.set $cx (i32.const 32))))
    (if (i32.le_s (local.get $cy) (i32.const 0))
      (then (local.set $cy (i32.const 32))))
    ;; An icon that was built rather than loaded has a bitmap where its
    ;; resource id would be; blit that instead of walking a resource.
    (if (i32.eq (i32.load (local.get $p)) (global.get $ICON_FROM_BITMAP))
      (then
        (local.set $ok (call $gdi_dc_alloc))
        (if (i32.eqz (local.get $ok)) (then (return (i32.const 0))))
        (drop (call $gdi_native_select_object (local.get $ok)
                (i32.and (i32.load offset=4 (local.get $p))
                  (i32.const 0x7FFFFFFF))))
        (drop (call $gdi_native_bitblt (local.get $hdc) (local.get $x) (local.get $y)
                (local.get $cx) (local.get $cy) (local.get $ok)
                (i32.const 0) (i32.const 0) (i32.const 0x00CC0020)))
        (drop (call $gdi_dc_delete (local.get $ok)))
        (return (i32.const 1))))
    ;; Opaque system/named handles had no drawable pixels before being copied;
    ;; their independent copy remains intentionally opaque too.
    (if (i32.eq (i32.load (local.get $p)) (global.get $ICON_FROM_OPAQUE))
      (then (return (i32.const 0))))
    ;; NE icon resources live in a flat table rather than the PE resource
    ;; tree. Restore the module captured by Win16 LoadIcon while decoding.
    (if (i32.eq
          (i32.and (i32.load (local.get $p)) (i32.const 0xFF000000))
          (global.get $ICON_FROM_WIN16))
      (then
        (global.set $win16_res_module_id
          (i32.and (i32.load (local.get $p)) (i32.const 0x00FFFFFF)))
        (local.set $ok (call $gdi_icon_draw_resource_at
          (local.get $hdc) (i32.and (i32.load offset=4 (local.get $p))
            (i32.const 0x7FFFFFFF))
          (local.get $cx) (local.get $cy) (i32.const 1)
          (local.get $x) (local.get $y) (local.get $di_flags)))
        (global.set $win16_res_module_id (i32.const 0))
        (return (local.get $ok))))
    ;; The icon belongs to the module it was loaded from, which need not be
    ;; the one running now.
    (call $push_rsrc_ctx (i32.load (local.get $p)))
    (local.set $ok (call $gdi_icon_draw_resource_at
      (local.get $hdc) (i32.and (i32.load offset=4 (local.get $p))
        (i32.const 0x7FFFFFFF))
      (local.get $cx) (local.get $cy) (i32.const 1)
      (local.get $x) (local.get $y) (local.get $di_flags)))
    (call $pop_rsrc_ctx)
    (local.get $ok))

  ;; ---- CURSOR_TABLE: an HICON/HCURSOR the guest BUILT from bitmaps ----
  ;; ICON_TABLE remembers {module, resource}; CreateIconIndirect has neither.
  ;; It hands over an ICONINFO — a hotspot and one or two bitmaps — and games
  ;; that draw their own pointer (Heroes of Might and Magic II builds one per
  ;; interface mode) then SetCursor it. Keeping the ICONINFO is what lets the
  ;; AND/XOR planes be composited later; the constant handle this used to
  ;; return dropped the bitmaps on the floor and every cursor in the app
  ;; became the host's default arrow.

  ;; The live record behind a handle, or 0 for a handle we did not intern.
  (func $cursor_record (param $handle i32) (result i32)
    (local $slot i32) (local $p i32)
    (if (i32.ne (i32.and (local.get $handle) (i32.const 0xFFFF0000))
                (global.get $CURSOR_HANDLE_TAG))
      (then (return (i32.const 0))))
    (local.set $slot (i32.and (local.get $handle) (i32.const 0xFFFF)))
    (if (i32.or (i32.eqz (local.get $slot))
                (i32.gt_u (local.get $slot) (global.get $MAX_CURSORS)))
      (then (return (i32.const 0))))
    (local.set $p (i32.add (global.get $CURSOR_TABLE)
      (i32.mul (i32.sub (local.get $slot) (i32.const 1))
               (global.get $CURSOR_TABLE_STRIDE))))
    ;; A slot with no bitmaps is free, not an empty cursor.
    (if (i32.and (i32.eqz (i32.load offset=12 (local.get $p)))
                 (i32.eqz (i32.load offset=16 (local.get $p))))
      (then (return (i32.const 0))))
    (local.get $p))

  (func $cursor_intern (param $is_icon i32) (param $xhot i32) (param $yhot i32)
        (param $mask i32) (param $color i32) (result i32)
    (local $i i32) (local $p i32)
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $MAX_CURSORS)))
      (local.set $p (i32.add (global.get $CURSOR_TABLE)
        (i32.mul (local.get $i) (global.get $CURSOR_TABLE_STRIDE))))
      (if (i32.and (i32.eqz (i32.load offset=12 (local.get $p)))
                   (i32.eqz (i32.load offset=16 (local.get $p))))
        (then
          (i32.store (local.get $p) (local.get $is_icon))
          (i32.store offset=4 (local.get $p) (local.get $xhot))
          (i32.store offset=8 (local.get $p) (local.get $yhot))
          (i32.store offset=12 (local.get $p) (local.get $mask))
          (i32.store offset=16 (local.get $p) (local.get $color))
          (i32.store offset=20 (local.get $p) (i32.const 0))
          (return (i32.or (global.get $CURSOR_HANDLE_TAG)
            (i32.add (local.get $i) (i32.const 1))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  ;; Materialize one plane from packed icon resource bytes. The bitmap owns
  ;; both its pixels and its palette, so the caller may unlock/free the source
  ;; resource immediately after CreateIconFromResourceEx returns.
  (func $cursor_resource_bitmap (param $width i32) (param $height i32)
        (param $bpp i32) (param $top_down i32) (param $stride i32)
        (param $palette i32) (param $palette_count i32) (param $pixels i32)
        (result i32)
    (memory.fill (global.get $GDI_BITMAP_PLAN) (i32.const 0) (i32.const 48))
    (i32.store (global.get $GDI_BITMAP_PLAN) (local.get $width))
    (i32.store offset=4 (global.get $GDI_BITMAP_PLAN) (local.get $height))
    (i32.store offset=8 (global.get $GDI_BITMAP_PLAN) (local.get $bpp))
    (i32.store offset=12 (global.get $GDI_BITMAP_PLAN)
      (i32.shl (local.get $top_down) (i32.const 1)))
    (i32.store offset=16 (global.get $GDI_BITMAP_PLAN) (local.get $stride))
    (i32.store offset=20 (global.get $GDI_BITMAP_PLAN) (local.get $palette))
    (i32.store offset=24 (global.get $GDI_BITMAP_PLAN) (local.get $palette_count))
    (i32.store offset=28 (global.get $GDI_BITMAP_PLAN) (local.get $pixels))
    (i32.store offset=32 (global.get $GDI_BITMAP_PLAN)
      (i32.mul (local.get $stride) (local.get $height)))
    (call $gdi_bitmap_create_owned (global.get $GDI_BITMAP_PLAN)
      (local.get $pixels) (i32.const 1) (i32.const 1)
      (i32.const 1) (i32.const 0) (i32.const 0))) ;; owned DIB orientation

  ;; Nearest-neighbour scaling for an owned icon plane. CreateIconFromResourceEx
  ;; is the size-selecting API, so cx/cy are observable through GetIconInfo and
  ;; SetCursor rather than advisory hints. Preserve indexed palettes while the
  ;; WAT raster path scales the canonical bitmap storage.
  (func $cursor_scale_bitmap (param $bitmap i32) (param $width i32)
        (param $height i32) (result i32)
    (local $record i32) (local $bpp i32) (local $stride i32)
    (local $scaled i32) (local $src i32) (local $dst i32)
    (local.set $record (call $gdi_object_record (local.get $bitmap)))
    (if (i32.eqz (call $gdi_bitmap_record_valid (local.get $record)))
      (then (return (i32.const 0))))
    (if (i32.and
          (i32.eq (load.field.memarg GdiBitmap width (local.get $record)) (local.get $width))
          (i32.eq (load.field.memarg GdiBitmap height (local.get $record)) (local.get $height)))
      (then (return (local.get $bitmap))))
    (if (i32.or (i32.le_s (local.get $width) (i32.const 0))
          (i32.or (i32.gt_s (local.get $width) (i32.const 256))
            (i32.or (i32.le_s (local.get $height) (i32.const 0))
              (i32.gt_s (local.get $height) (i32.const 512)))))
      (then
        (drop (call $gdi_object_delete_full (local.get $bitmap)))
        (return (i32.const 0))))
    (local.set $bpp (load.field.memarg GdiBitmap bpp (local.get $record)))
    (local.set $stride (i32.shl
      (i32.shr_u (i32.add (i32.mul (local.get $width) (local.get $bpp))
        (i32.const 31)) (i32.const 5)) (i32.const 2)))
    (memory.fill (global.get $GDI_BITMAP_PLAN) (i32.const 0) (i32.const 48))
    (i32.store (global.get $GDI_BITMAP_PLAN) (local.get $width))
    (i32.store offset=4 (global.get $GDI_BITMAP_PLAN) (local.get $height))
    (i32.store offset=8 (global.get $GDI_BITMAP_PLAN) (local.get $bpp))
    (i32.store offset=12 (global.get $GDI_BITMAP_PLAN)
      (i32.and (load.field.memarg GdiBitmap flags (local.get $record)) (i32.const 2)))
    (i32.store offset=16 (global.get $GDI_BITMAP_PLAN) (local.get $stride))
    (i32.store offset=20 (global.get $GDI_BITMAP_PLAN)
      (load.field.memarg GdiBitmap palette (local.get $record)))
    (i32.store offset=24 (global.get $GDI_BITMAP_PLAN)
      (load.field.memarg GdiBitmap palette_count (local.get $record)))
    (i32.store offset=32 (global.get $GDI_BITMAP_PLAN)
      (i32.mul (local.get $stride) (local.get $height)))
    (local.set $scaled (call $gdi_bitmap_create_owned (global.get $GDI_BITMAP_PLAN)
      (i32.const 0) (i32.const 0)
      (i32.ne (load.field.memarg GdiBitmap palette_count (local.get $record)) (i32.const 0))
      (i32.const 0) (i32.const 3) (i32.const 0)))
    (if (i32.eqz (local.get $scaled))
      (then
        (drop (call $gdi_object_delete_full (local.get $bitmap)))
        (return (i32.const 0))))
    (local.set $src (global.get $CURSOR_MASK_DESC))
    (local.set $dst (global.get $CURSOR_COLOR_DESC))
    (if (i32.or
          (i32.eqz (call $gdi_raster_desc_from_bitmap
            (local.get $bitmap) (local.get $src)))
          (i32.eqz (call $gdi_raster_desc_from_bitmap
            (local.get $scaled) (local.get $dst))))
      (then
        (drop (call $gdi_object_delete_full (local.get $scaled)))
        (drop (call $gdi_object_delete_full (local.get $bitmap)))
        (return (i32.const 0))))
    (if (i32.eqz (call $gdi_raster_stretch_blt
          (i32.const 0) (i32.const 0) (local.get $dst)
          (i32.const 0) (i32.const 0) (local.get $width) (local.get $height)
          (local.get $src) (i32.const 0) (i32.const 0)
          (load.field.memarg GdiBitmap width (local.get $record))
          (load.field.memarg GdiBitmap height (local.get $record))
          (i32.const 0) (i32.const 0x00CC0020)))
      (then
        (drop (call $gdi_object_delete_full (local.get $scaled)))
        (drop (call $gdi_object_delete_full (local.get $bitmap)))
        (return (i32.const 0))))
    (drop (call $gdi_object_delete_full (local.get $bitmap)))
    (local.get $scaled))

  ;; Decode one RT_ICON or RT_CURSOR image. RT_CURSOR begins with the Win9x
  ;; LOCALHEADER hotspot; both formats then carry a DIB whose stored height is
  ;; XOR+AND (twice the visible height). Only classic uncompressed DIB formats
  ;; are accepted here: those are the formats Win98 USER consumes natively.
  (func $cursor_create_from_resource (param $resource_ga i32) (param $size i32)
        (param $is_icon i32) (param $version i32) (param $want_w i32)
        (param $want_h i32) (param $flags i32) (result i32)
    (local $data i32) (local $dib_size i32) (local $header_size i32)
    (local $width i32) (local $stored_h i32) (local $height i32)
    (local $bpp i32) (local $top_down i32) (local $palette_count i32)
    (local $palette_bytes i32) (local $color_stride i32) (local $mask_stride i32)
    (local $color_bytes i32) (local $mask_bytes i32)
    (local $palette i32) (local $color_bits i32) (local $mask_bits i32)
    (local $mask i32) (local $color i32) (local $handle i32)
    (local $xhot i32) (local $yhot i32)
    (if (i32.or (i32.eqz (local.get $resource_ga))
          (i32.or (i32.lt_u (local.get $version) (i32.const 0x00020000))
            (i32.gt_u (local.get $version) (i32.const 0x00030000))))
      (then (return (i32.const 0))))
    (if (i32.eqz (local.get $is_icon))
      (then
        (if (i32.lt_u (local.get $size) (i32.const 16))
          (then (return (i32.const 0))))
        (local.set $xhot (call $gl16 (local.get $resource_ga)))
        (local.set $yhot (call $gl16
          (i32.add (local.get $resource_ga) (i32.const 2))))
        (local.set $resource_ga (i32.add (local.get $resource_ga) (i32.const 4)))
        (local.set $size (i32.sub (local.get $size) (i32.const 4)))))
    (if (i32.lt_u (local.get $size) (i32.const 12))
      (then (return (i32.const 0))))
    (local.set $data (call $g2w (local.get $resource_ga)))
    (local.set $dib_size (local.get $size))
    (local.set $header_size (i32.load (local.get $data)))
    (if (i32.eq (local.get $header_size) (i32.const 12))
      (then
        (local.set $width (i32.load16_u offset=4 (local.get $data)))
        (local.set $stored_h (i32.load16_u offset=6 (local.get $data)))
        (if (i32.ne (i32.load16_u offset=8 (local.get $data)) (i32.const 1))
          (then (return (i32.const 0))))
        (local.set $bpp (i32.load16_u offset=10 (local.get $data)))
        (if (i32.le_u (local.get $bpp) (i32.const 8))
          (then
            (local.set $palette_count
              (i32.shl (i32.const 1) (local.get $bpp)))
            (local.set $palette_bytes
              (i32.mul (local.get $palette_count) (i32.const 3))))))
      (else
        (if (i32.or (i32.lt_u (local.get $header_size) (i32.const 40))
              (i32.gt_u (local.get $header_size) (local.get $dib_size)))
          (then (return (i32.const 0))))
        (local.set $width (i32.load offset=4 (local.get $data)))
        (local.set $stored_h (i32.load offset=8 (local.get $data)))
        (if (i32.ne (i32.load16_u offset=12 (local.get $data)) (i32.const 1))
          (then (return (i32.const 0))))
        (local.set $bpp (i32.load16_u offset=14 (local.get $data)))
        (if (i32.ne (i32.load offset=16 (local.get $data)) (i32.const 0))
          (then (return (i32.const 0))))
        (local.set $top_down (i32.lt_s (local.get $stored_h) (i32.const 0)))
        (if (local.get $top_down)
          (then (local.set $stored_h
            (i32.sub (i32.const 0) (local.get $stored_h)))))
        (if (i32.le_u (local.get $bpp) (i32.const 8))
          (then
            (local.set $palette_count (i32.load offset=32 (local.get $data)))
            (if (i32.eqz (local.get $palette_count))
              (then (local.set $palette_count
                (i32.shl (i32.const 1) (local.get $bpp)))))
            (if (i32.gt_u (local.get $palette_count)
                  (i32.shl (i32.const 1) (local.get $bpp)))
              (then (return (i32.const 0))))
            (local.set $palette_bytes
              (i32.shl (local.get $palette_count) (i32.const 2)))))))
    (if (i32.or
          (i32.or (i32.le_s (local.get $width) (i32.const 0))
            (i32.gt_s (local.get $width) (i32.const 256)))
          (i32.or (i32.lt_u (local.get $stored_h) (i32.const 2))
            (i32.or (i32.and (local.get $stored_h) (i32.const 1))
              (i32.and
                (i32.and (i32.ne (local.get $bpp) (i32.const 1))
                  (i32.ne (local.get $bpp) (i32.const 4)))
                (i32.and (i32.ne (local.get $bpp) (i32.const 8))
                  (i32.and (i32.ne (local.get $bpp) (i32.const 24))
                    (i32.ne (local.get $bpp) (i32.const 32))))))))
      (then (return (i32.const 0))))
    (local.set $height (i32.shr_u (local.get $stored_h) (i32.const 1)))
    (if (i32.gt_s (local.get $height) (i32.const 256))
      (then (return (i32.const 0))))
    ;; A top-down monochrome resource would need its two planes reordered to
    ;; form Win32's single 2H mask bitmap. Such resources are not a Win9x icon
    ;; format, so reject instead of silently swapping AND and XOR.
    (if (i32.and (local.get $top_down) (i32.eq (local.get $bpp) (i32.const 1)))
      (then (return (i32.const 0))))
    (local.set $color_stride (i32.shl
      (i32.shr_u (i32.add (i32.mul (local.get $width) (local.get $bpp))
        (i32.const 31)) (i32.const 5)) (i32.const 2)))
    (local.set $mask_stride (i32.shl
      (i32.shr_u (i32.add (local.get $width) (i32.const 31))
        (i32.const 5)) (i32.const 2)))
    (local.set $color_bytes (i32.mul (local.get $color_stride) (local.get $height)))
    (local.set $mask_bytes (i32.mul (local.get $mask_stride) (local.get $height)))
    (if (i32.or
          (i32.gt_u (i32.add (local.get $header_size) (local.get $palette_bytes))
            (local.get $dib_size))
          (i32.gt_u (i32.add
              (i32.add (local.get $header_size) (local.get $palette_bytes))
              (i32.add (local.get $color_bytes) (local.get $mask_bytes)))
            (local.get $dib_size)))
      (then (return (i32.const 0))))
    (local.set $palette (i32.add (local.get $data) (local.get $header_size)))
    (local.set $color_bits (i32.add (local.get $palette) (local.get $palette_bytes)))
    (local.set $mask_bits (i32.add (local.get $color_bits) (local.get $color_bytes)))
    (if (i32.eq (local.get $bpp) (i32.const 1))
      (then
        ;; XOR bytes followed by AND bytes are already the memory layout of a
        ;; bottom-up monochrome ICONINFO mask whose logical height is 2H.
        (local.set $mask (call $cursor_resource_bitmap
          (local.get $width) (local.get $stored_h) (i32.const 1) (i32.const 0)
          (local.get $mask_stride) (i32.const 0) (i32.const 0)
          (local.get $color_bits))))
      (else
        (local.set $color (call $cursor_resource_bitmap
          (local.get $width) (local.get $height) (local.get $bpp)
          (local.get $top_down) (local.get $color_stride)
          (local.get $palette) (local.get $palette_count) (local.get $color_bits)))
        (if (local.get $color)
          (then (local.set $mask (call $cursor_resource_bitmap
            (local.get $width) (local.get $height) (i32.const 1)
            (local.get $top_down) (local.get $mask_stride)
            (i32.const 0) (i32.const 0) (local.get $mask_bits)))))))
    (if (i32.eqz (local.get $mask))
      (then
        (if (local.get $color)
          (then (drop (call $gdi_object_delete_full (local.get $color)))))
        (return (i32.const 0))))
    (if (i32.and (local.get $flags) (i32.const 0x40)) ;; LR_DEFAULTSIZE
      (then
        (if (i32.eqz (local.get $want_w)) (then (local.set $want_w (i32.const 32))))
        (if (i32.eqz (local.get $want_h)) (then (local.set $want_h (i32.const 32)))))
      (else
        (if (i32.eqz (local.get $want_w)) (then (local.set $want_w (local.get $width))))
        (if (i32.eqz (local.get $want_h)) (then (local.set $want_h (local.get $height))))))
    (if (i32.or (i32.le_s (local.get $want_w) (i32.const 0))
          (i32.or (i32.gt_s (local.get $want_w) (i32.const 256))
            (i32.or (i32.le_s (local.get $want_h) (i32.const 0))
              (i32.gt_s (local.get $want_h) (i32.const 256)))))
      (then
        (drop (call $gdi_object_delete_full (local.get $mask)))
        (if (local.get $color)
          (then (drop (call $gdi_object_delete_full (local.get $color)))))
        (return (i32.const 0))))
    (if (i32.eq (local.get $bpp) (i32.const 1))
      (then (local.set $mask (call $cursor_scale_bitmap
        (local.get $mask) (local.get $want_w)
        (i32.shl (local.get $want_h) (i32.const 1)))))
      (else
        (local.set $color (call $cursor_scale_bitmap
          (local.get $color) (local.get $want_w) (local.get $want_h)))
        (if (local.get $color)
          (then (local.set $mask (call $cursor_scale_bitmap
            (local.get $mask) (local.get $want_w) (local.get $want_h)))))))
    (if (i32.or (i32.eqz (local.get $mask))
          (i32.and (i32.ne (local.get $bpp) (i32.const 1))
            (i32.eqz (local.get $color))))
      (then
        (if (local.get $mask)
          (then (drop (call $gdi_object_delete_full (local.get $mask)))))
        (if (local.get $color)
          (then (drop (call $gdi_object_delete_full (local.get $color)))))
        (return (i32.const 0))))
    (if (local.get $is_icon)
      (then
        (local.set $xhot (i32.shr_u (local.get $want_w) (i32.const 1)))
        (local.set $yhot (i32.shr_u (local.get $want_h) (i32.const 1))))
      (else
        (local.set $xhot (i32.div_u
          (i32.mul (local.get $xhot) (local.get $want_w)) (local.get $width)))
        (local.set $yhot (i32.div_u
          (i32.mul (local.get $yhot) (local.get $want_h)) (local.get $height)))))
    (local.set $handle (call $cursor_intern (local.get $is_icon)
      (local.get $xhot) (local.get $yhot) (local.get $mask) (local.get $color)))
    (if (i32.eqz (local.get $handle))
      (then
        (drop (call $gdi_object_delete_full (local.get $mask)))
        (if (local.get $color)
          (then (drop (call $gdi_object_delete_full (local.get $color)))))))
    (local.get $handle))

  (func $cursor_width (param $rec i32) (result i32)
    (call $gdi_bitmap_record_width
      (call $gdi_object_record (i32.load offset=12 (local.get $rec)))))

  ;; A monochrome cursor's mask bitmap holds both planes stacked: the AND rows
  ;; on top and the XOR rows below, so the picture is half as tall as it is.
  ;; With a colour plane the mask is the AND rows alone.
  (func $cursor_height (param $rec i32) (result i32)
    (if (i32.load offset=16 (local.get $rec))
      (then (return (call $gdi_bitmap_record_height
        (call $gdi_object_record (i32.load offset=16 (local.get $rec)))))))
    (i32.shr_u (call $gdi_bitmap_record_height
      (call $gdi_object_record (i32.load offset=12 (local.get $rec))))
      (i32.const 1)))

  ;; Which raster row holds picture row $row of a cursor plane.
  ;;
  ;; CreateBitmap's scanlines run top-down — that is what MSDN documents for a
  ;; DDB and what every app building a cursor mask writes — but a plain DDB is
  ;; planned here with no top-down flag, so the raster layer reads it back
  ;; bottom-up and hands out the picture mirrored. Undo that here rather than
  ;; in the raster layer, where it would move every existing blit. A real DIB
  ;; carries its own orientation and is already right.
  (func $cursor_plane_row (param $hbm i32) (param $desc i32) (param $row i32)
        (result i32)
    (local $rec i32)
    (if (i32.load offset=20 (local.get $desc)) (then (return (local.get $row))))
    (local.set $rec (call $gdi_object_record (local.get $hbm)))
    (if (i32.eqz (local.get $rec)) (then (return (local.get $row))))
    (if (i32.and (load.field.memarg GdiBitmap flags (local.get $rec)) (i32.const 1))
      (then (return (local.get $row))))
    (i32.sub (i32.sub (i32.load offset=8 (local.get $desc)) (i32.const 1))
             (local.get $row)))

  ;; Composite the ICONINFO planes into width*height premultiplied BGRA rows,
  ;; top-down, at $dst. Win32's four AND/XOR combinations are: opaque black,
  ;; opaque white, transparent, and invert-the-screen. Nothing on a web page
  ;; can XOR the desktop, so an invert pixel is drawn black — that is what the
  ;; outline strokes of a monochrome pointer are made of, and dropping them
  ;; would leave a shape with no edge.
  (func $cursor_rasterize (param $rec i32) (param $dst i32) (result i32)
    (local $w i32) (local $h i32) (local $x i32) (local $y i32)
    (local $mask i32) (local $color i32) (local $and i32) (local $xor i32)
    (local $rgb i32) (local $p i32) (local $alpha i32)
    (local.set $w (call $cursor_width (local.get $rec)))
    (local.set $h (call $cursor_height (local.get $rec)))
    (if (i32.or (i32.le_s (local.get $w) (i32.const 0))
                (i32.le_s (local.get $h) (i32.const 0)))
      (then (return (i32.const 0))))
    (local.set $mask (global.get $CURSOR_MASK_DESC))
    (if (i32.eqz (call $gdi_raster_desc_from_bitmap
          (i32.load offset=12 (local.get $rec)) (local.get $mask)))
      (then (return (i32.const 0))))
    (if (i32.load offset=16 (local.get $rec))
      (then
        (local.set $color (global.get $CURSOR_COLOR_DESC))
        (if (i32.eqz (call $gdi_raster_desc_from_bitmap
              (i32.load offset=16 (local.get $rec)) (local.get $color)))
          (then (return (i32.const 0))))))
    (local.set $y (i32.const 0))
    (block $rows_done (loop $rows
      (br_if $rows_done (i32.ge_s (local.get $y) (local.get $h)))
      (local.set $x (i32.const 0))
      (block $cols_done (loop $cols
        (br_if $cols_done (i32.ge_s (local.get $x) (local.get $w)))
        ;; A mask read that fails reads as "transparent" rather than as a
        ;; black pixel: a truncated mask must not paint a block of ink.
        (local.set $and (call $gdi_raster_read_index
          (local.get $mask) (local.get $x)
          (call $cursor_plane_row (i32.load offset=12 (local.get $rec))
            (local.get $mask) (local.get $y))))
        (if (i32.lt_s (local.get $and) (i32.const 0))
          (then (local.set $and (i32.const 1))))
        (local.set $alpha (i32.const 255))
        (local.set $rgb (i32.const 0))
        (if (local.get $color)
          (then
            (if (local.get $and)
              (then (local.set $alpha (i32.const 0)))
              (else
                (local.set $rgb (call $gdi_raster_read
                  (local.get $color) (local.get $x)
                  (call $cursor_plane_row (i32.load offset=16 (local.get $rec))
                    (local.get $color) (local.get $y))))
                (if (i32.lt_s (local.get $rgb) (i32.const 0))
                  (then (local.set $rgb (i32.const 0)))))))
          (else
            (local.set $xor (call $gdi_raster_read_index (local.get $mask)
              (local.get $x)
              (call $cursor_plane_row (i32.load offset=12 (local.get $rec))
                (local.get $mask) (i32.add (local.get $y) (local.get $h)))))
            (if (i32.lt_s (local.get $xor) (i32.const 0))
              (then (local.set $xor (i32.const 0))))
            (if (local.get $and)
              (then
                ;; AND=1: leave the screen alone (XOR=0) or invert it (XOR=1).
                (if (i32.eqz (local.get $xor))
                  (then (local.set $alpha (i32.const 0)))))
              (else
                (if (local.get $xor)
                  (then (local.set $rgb (i32.const 0xFFFFFF))))))))
        (local.set $p (i32.add (local.get $dst)
          (i32.shl (i32.add (i32.mul (local.get $y) (local.get $w))
                            (local.get $x)) (i32.const 2))))
        (if (local.get $alpha)
          (then
            (i32.store8 (local.get $p) (local.get $rgb))                       ;; B
            (i32.store8 offset=1 (local.get $p)
              (i32.shr_u (local.get $rgb) (i32.const 8)))                      ;; G
            (i32.store8 offset=2 (local.get $p)
              (i32.shr_u (local.get $rgb) (i32.const 16)))                     ;; R
            (i32.store8 offset=3 (local.get $p) (i32.const 255)))
          (else (i32.store (local.get $p) (i32.const 0))))
        (local.set $x (i32.add (local.get $x) (i32.const 1)))
        (br $cols)))
      (local.set $y (i32.add (local.get $y) (i32.const 1)))
      (br $rows)))
    (i32.const 1))

  ;; Present an interned cursor. Returns 0 for any handle we did not intern,
  ;; leaving the IDC_*/resource path in host_set_cursor untouched.
  (func $cursor_push (param $handle i32) (result i32)
    (local $rec i32) (local $w i32) (local $h i32) (local $ga i32) (local $wa i32)
    (local.set $rec (call $cursor_record (local.get $handle)))
    (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
    (local.set $w (call $cursor_width (local.get $rec)))
    (local.set $h (call $cursor_height (local.get $rec)))
    (if (i32.or (i32.le_s (local.get $w) (i32.const 0))
                (i32.le_s (local.get $h) (i32.const 0)))
      (then (return (i32.const 0))))
    ;; Already composited once: the host keeps the picture under this handle.
    (if (i32.load offset=20 (local.get $rec))
      (then
        (call $host_set_cursor_image (local.get $handle)
          (local.get $w) (local.get $h)
          (i32.load offset=4 (local.get $rec)) (i32.load offset=8 (local.get $rec))
          (i32.const 0))
        (return (i32.const 1))))
    (local.set $ga (call $dib_alloc
      (i32.shl (i32.mul (local.get $w) (local.get $h)) (i32.const 2))))
    (if (i32.eqz (local.get $ga)) (then (return (i32.const 0))))
    (local.set $wa (call $g2w (local.get $ga)))
    (if (i32.eqz (call $cursor_rasterize (local.get $rec) (local.get $wa)))
      (then
        (call $dib_free_wasm (local.get $wa))
        (return (i32.const 0))))
    (call $host_set_cursor_image (local.get $handle)
      (local.get $w) (local.get $h)
      (i32.load offset=4 (local.get $rec)) (i32.load offset=8 (local.get $rec))
      (local.get $wa))
    (call $dib_free_wasm (local.get $wa))
    (i32.store offset=20 (local.get $rec) (i32.const 1))
    (i32.const 1))

  ;; Release a built icon/cursor. The bitmaps are ours — CreateIconIndirect
  ;; copies what the caller passed, exactly as Win32 does, so the app is free
  ;; to delete its originals the moment it returns.
  (func $cursor_destroy (param $handle i32) (result i32)
    (local $rec i32)
    (local.set $rec (call $cursor_record (local.get $handle)))
    (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
    (if (i32.load offset=12 (local.get $rec))
      (then (drop (call $gdi_object_delete_full (i32.load offset=12 (local.get $rec))))))
    (if (i32.load offset=16 (local.get $rec))
      (then (drop (call $gdi_object_delete_full (i32.load offset=16 (local.get $rec))))))
    (memory.fill (local.get $rec) (i32.const 0) (global.get $CURSOR_TABLE_STRIDE))
    (i32.const 1))

  ;; 109: LoadIconA(hInstance, lpIconName)
  (func $handle_LoadIconA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; Named (string-pointer) icon resources are not interned: the resource
    ;; walker addresses RT_GROUP_ICON by ordinal. Those keep the old opaque
    ;; handle rather than a slot that would decode to the wrong picture.
    (if (i32.and (i32.ne (local.get $arg0) (i32.const 0))
                 (i32.le_u (local.get $arg1) (i32.const 0xFFFF)))
      (then
        (i32.store offset=0 (global.get $reg_base) (call $icon_intern (local.get $arg0) (local.get $arg1)))
        (if (i32.load offset=0 (global.get $reg_base))
          (then (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
                (return)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x60001)) ;; opaque HICON, no pixels
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )
