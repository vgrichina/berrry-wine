  ;; ============================================================
  ;; ColorGrid control (class 6) + Color (ChooseColor) dialog (class 15)
  ;; ============================================================
  ;;
  ;; ColorGrid renders either the standard 8x6 basic-color table (id 0x460)
  ;; or the CHOOSECOLOR-owned 8x2 custom-color table (id 0x461). Cells use
  ;; the classic common-dialog spacing: a bordered swatch followed by a small
  ;; COLOR_BTNFACE gutter. Clicks pick a cell and notify the parent through
  ;; WM_COMMAND + LBN_SELCHANGE (we reuse notification code 1).
  ;;
  ;; ColorGridState (4 bytes, allocated in WM_CREATE)
  ;;   +0   sel_idx       selected cell, -1 = none
  ;; The control id is NOT in the record: $ctrl_table_get_id($hwnd).
  ;;
  ;; The predefined values match the classic comdlg32 6x8 palette. Custom
  ;; colors are read directly from CHOOSECOLOR.lpCustColors so the application's
  ;; persistent 16-entry array is reflected every time the grid repaints.
  ;; Build the few labels used only by the expanded custom-color pane at
  ;; runtime. Keeping them here avoids reserving more global static-string
  ;; addresses for a pane that most callers never open.
  (global $colordlg_syncing (mut i32) (i32.const 0))

  (func $colordlg_make_label (param $kind i32) (result i32)
    (local $buf i32) (local $bw i32)
    (local.set $buf (call $heap_alloc (i32.const 21)))
    (local.set $bw (call $g2w (local.get $buf)))
    (call $zero_memory (local.get $bw) (i32.const 21))
    (if (i32.eq (local.get $kind) (i32.const 0))
      (then
        (i32.store (local.get $bw) (i32.const 0x3A646552)) ;; "Red:"
        (i32.store8 offset=4 (local.get $bw) (i32.const 0)))
      (else (if (i32.eq (local.get $kind) (i32.const 1))
        (then
          (i32.store (local.get $bw) (i32.const 0x65657247)) ;; "Gree"
          (i32.store16 offset=4 (local.get $bw) (i32.const 0x3A6E)) ;; "n:"
          (i32.store8 offset=6 (local.get $bw) (i32.const 0)))
        (else (if (i32.eq (local.get $kind) (i32.const 2))
          (then
            (i32.store (local.get $bw) (i32.const 0x65756C42)) ;; "Blue"
            (i32.store8 offset=4 (local.get $bw) (i32.const 0x3A))
            (i32.store8 offset=5 (local.get $bw) (i32.const 0)))
          (else (if (i32.eq (local.get $kind) (i32.const 3))
            (then
              (i32.store         (local.get $bw) (i32.const 0x20646441)) ;; "Add "
              (i32.store offset=4  (local.get $bw) (i32.const 0x43206F74)) ;; "to C"
              (i32.store offset=8  (local.get $bw) (i32.const 0x6F747375)) ;; "usto"
              (i32.store offset=12 (local.get $bw) (i32.const 0x6F43206D)) ;; "m Co"
              (i32.store offset=16 (local.get $bw) (i32.const 0x73726F6C))) ;; "lors"
            (else (if (i32.eq (local.get $kind) (i32.const 4))
              (then (i32.store (local.get $bw) (i32.const 0x3A657548))) ;; "Hue:"
              (else (if (i32.eq (local.get $kind) (i32.const 5))
                (then (i32.store (local.get $bw) (i32.const 0x3A746153))) ;; "Sat:"
                (else (if (i32.eq (local.get $kind) (i32.const 6))
                  (then (i32.store (local.get $bw) (i32.const 0x3A6D754C))) ;; "Lum:"
                  (else (if (i32.eq (local.get $kind) (i32.const 7))
                    (then
                      (i32.store (local.get $bw) (i32.const 0x6F6C6F43)) ;; "Colo"
                      (i32.store8 offset=4 (local.get $bw) (i32.const 0x72))) ;; "r"
                    (else
                      (i32.store (local.get $bw) (i32.const 0x6C6F537C)) ;; "|Sol"
                      (i32.store16 offset=4 (local.get $bw) (i32.const 0x6469))))))))))))))))))
    (local.get $buf))

  (func $colordlg_set_u8_text (param $hwnd i32) (param $value i32)
    (local $buf i32) (local $bw i32) (local $n i32) (local $was_syncing i32)
    (if (i32.gt_u (local.get $value) (i32.const 255))
      (then (local.set $value (i32.const 255))))
    (local.set $buf (call $heap_alloc (i32.const 4)))
    (local.set $bw (call $g2w (local.get $buf)))
    (if (i32.ge_u (local.get $value) (i32.const 100))
      (then
        (i32.store8 (local.get $bw)
          (i32.add (i32.div_u (local.get $value) (i32.const 100)) (i32.const 48)))
        (i32.store8 offset=1 (local.get $bw)
          (i32.add (i32.rem_u (i32.div_u (local.get $value) (i32.const 10)) (i32.const 10)) (i32.const 48)))
        (i32.store8 offset=2 (local.get $bw)
          (i32.add (i32.rem_u (local.get $value) (i32.const 10)) (i32.const 48)))
        (local.set $n (i32.const 3)))
      (else (if (i32.ge_u (local.get $value) (i32.const 10))
        (then
          (i32.store8 (local.get $bw)
            (i32.add (i32.div_u (local.get $value) (i32.const 10)) (i32.const 48)))
          (i32.store8 offset=1 (local.get $bw)
            (i32.add (i32.rem_u (local.get $value) (i32.const 10)) (i32.const 48)))
          (local.set $n (i32.const 2)))
        (else
          (i32.store8 (local.get $bw) (i32.add (local.get $value) (i32.const 48)))
          (local.set $n (i32.const 1))))))
    (i32.store8 (i32.add (local.get $bw) (local.get $n)) (i32.const 0))
    ;; EDIT sends EN_UPDATE/EN_CHANGE for WM_SETTEXT. Suppress only the
    ;; common-dialog's own synchronization response so updating one field
    ;; cannot recursively rebuild all six fields.
    (local.set $was_syncing (global.get $colordlg_syncing))
    (global.set $colordlg_syncing (i32.const 1))
    (drop (call $wnd_send_message
      (local.get $hwnd) (i32.const 0x000C) (i32.const 0) (local.get $buf)))
    (global.set $colordlg_syncing (local.get $was_syncing))
    (call $heap_free (local.get $buf)))

  (func $colordlg_sync_rgb_fields (param $dlg i32) (param $rgb i32)
    (local $edit i32)
    (local.set $edit (call $ctrl_find_by_id (local.get $dlg) (i32.const 0x463)))
    (if (local.get $edit)
      (then (call $colordlg_set_u8_text
        (local.get $edit) (i32.and (local.get $rgb) (i32.const 0xFF)))))
    (local.set $edit (call $ctrl_find_by_id (local.get $dlg) (i32.const 0x464)))
    (if (local.get $edit)
      (then (call $colordlg_set_u8_text (local.get $edit)
        (i32.and (i32.shr_u (local.get $rgb) (i32.const 8)) (i32.const 0xFF)))))
    (local.set $edit (call $ctrl_find_by_id (local.get $dlg) (i32.const 0x465)))
    (if (local.get $edit)
      (then (call $colordlg_set_u8_text (local.get $edit)
        (i32.and (i32.shr_u (local.get $rgb) (i32.const 16)) (i32.const 0xFF))))))

  ;; Convert COLORREF to the 0..240 HSL units used by the classic common
  ;; dialog. Return h | (s << 8) | (l << 16).
  (func $colordlg_rgb_to_hsl (param $rgb i32) (result i32)
    (local $r i32) (local $g i32) (local $b i32)
    (local $max i32) (local $min i32) (local $sum i32) (local $delta i32)
    (local $h i32) (local $s i32) (local $l i32)
    (local.set $r (i32.and (local.get $rgb) (i32.const 0xFF)))
    (local.set $g (i32.and (i32.shr_u (local.get $rgb) (i32.const 8)) (i32.const 0xFF)))
    (local.set $b (i32.and (i32.shr_u (local.get $rgb) (i32.const 16)) (i32.const 0xFF)))
    (local.set $max (local.get $r))
    (if (i32.gt_u (local.get $g) (local.get $max)) (then (local.set $max (local.get $g))))
    (if (i32.gt_u (local.get $b) (local.get $max)) (then (local.set $max (local.get $b))))
    (local.set $min (local.get $r))
    (if (i32.lt_u (local.get $g) (local.get $min)) (then (local.set $min (local.get $g))))
    (if (i32.lt_u (local.get $b) (local.get $min)) (then (local.set $min (local.get $b))))
    (local.set $sum (i32.add (local.get $max) (local.get $min)))
    (local.set $delta (i32.sub (local.get $max) (local.get $min)))
    (local.set $l (i32.div_u (i32.mul (local.get $sum) (i32.const 120)) (i32.const 255)))
    (if (local.get $delta)
      (then
        (local.set $s
          (if (result i32) (i32.le_u (local.get $sum) (i32.const 255))
            (then (i32.div_u (i32.mul (local.get $delta) (i32.const 240)) (local.get $sum)))
            (else (i32.div_u (i32.mul (local.get $delta) (i32.const 240))
              (i32.sub (i32.const 510) (local.get $sum))))))
        (if (i32.eq (local.get $max) (local.get $r))
          (then (local.set $h (i32.div_s
            (i32.mul (i32.sub (local.get $g) (local.get $b)) (i32.const 40))
            (local.get $delta))))
          (else (if (i32.eq (local.get $max) (local.get $g))
            (then (local.set $h (i32.add (i32.const 80) (i32.div_s
              (i32.mul (i32.sub (local.get $b) (local.get $r)) (i32.const 40))
              (local.get $delta)))))
            (else (local.set $h (i32.add (i32.const 160) (i32.div_s
              (i32.mul (i32.sub (local.get $r) (local.get $g)) (i32.const 40))
              (local.get $delta))))))))
        (if (i32.lt_s (local.get $h) (i32.const 0))
          (then (local.set $h (i32.add (local.get $h) (i32.const 240)))))
        (if (i32.ge_s (local.get $h) (i32.const 240))
          (then (local.set $h (i32.sub (local.get $h) (i32.const 240)))))))
    (i32.or (local.get $h)
      (i32.or (i32.shl (local.get $s) (i32.const 8))
              (i32.shl (local.get $l) (i32.const 16)))))

  (func $colordlg_sync_hsl_fields
    (param $dlg i32) (param $h i32) (param $s i32) (param $l i32)
    (local $edit i32)
    (local.set $edit (call $ctrl_find_by_id (local.get $dlg) (i32.const 0x468)))
    (if (local.get $edit) (then (call $colordlg_set_u8_text (local.get $edit) (local.get $h))))
    (local.set $edit (call $ctrl_find_by_id (local.get $dlg) (i32.const 0x469)))
    (if (local.get $edit) (then (call $colordlg_set_u8_text (local.get $edit) (local.get $s))))
    (local.set $edit (call $ctrl_find_by_id (local.get $dlg) (i32.const 0x46A)))
    (if (local.get $edit) (then (call $colordlg_set_u8_text (local.get $edit) (local.get $l)))))

  (func $colordlg_invalidate_preview (param $dlg i32)
    (local $preview i32)
    (local.set $preview (call $ctrl_find_by_id (local.get $dlg) (i32.const 0x46B)))
    (if (local.get $preview) (then (call $invalidate_hwnd (local.get $preview)))))

  (func $colordlg_sync_spectrum_from_rgb (param $dlg i32) (param $rgb i32)
    (local $packed i32) (local $picker i32) (local $state i32) (local $sw ptr<ColorSpectrumState>)
    (local.set $packed (call $colordlg_rgb_to_hsl (local.get $rgb)))
    (local.set $picker (call $ctrl_find_by_id (local.get $dlg) (i32.const 0x467)))
    (if (local.get $picker)
      (then
        (local.set $state (call $wnd_get_state_ptr (local.get $picker)))
        (if (local.get $state)
          (then
            (local.set $sw (cast ptr<ColorSpectrumState> (call $g2w (local.get $state))))
            (store.field ColorSpectrumState hue (local.get $sw) (i32.and (local.get $packed) (i32.const 0xFF)))
            (store.field.memarg ColorSpectrumState sat (local.get $sw)
              (i32.and (i32.shr_u (local.get $packed) (i32.const 8)) (i32.const 0xFF)))
            (store.field.memarg ColorSpectrumState lum (local.get $sw)
              (i32.and (i32.shr_u (local.get $packed) (i32.const 16)) (i32.const 0xFF)))))
        (call $invalidate_hwnd (local.get $picker))))
    (call $colordlg_sync_hsl_fields
      (local.get $dlg)
      (i32.and (local.get $packed) (i32.const 0xFF))
      (i32.and (i32.shr_u (local.get $packed) (i32.const 8)) (i32.const 0xFF))
      (i32.and (i32.shr_u (local.get $packed) (i32.const 16)) (i32.const 0xFF)))
    (call $colordlg_invalidate_preview (local.get $dlg)))

  (func $colordlg_sync_from_rgb (param $dlg i32) (param $rgb i32)
    (call $colordlg_sync_rgb_fields (local.get $dlg) (local.get $rgb))
    (call $colordlg_sync_spectrum_from_rgb (local.get $dlg) (local.get $rgb)))

  ;; Convert classic common-dialog HSL units (0..240) to one RGB channel.
  (func $colordlg_hue_component
    (param $p i32) (param $q i32) (param $t i32) (result i32)
    (local $v i32)
    (if (i32.lt_s (local.get $t) (i32.const 0))
      (then (local.set $t (i32.add (local.get $t) (i32.const 240)))))
    (if (i32.gt_s (local.get $t) (i32.const 240))
      (then (local.set $t (i32.sub (local.get $t) (i32.const 240)))))
    (local.set $v
      (if (result i32) (i32.lt_s (local.get $t) (i32.const 40))
        (then (i32.add (local.get $p)
          (i32.div_s
            (i32.mul (i32.sub (local.get $q) (local.get $p)) (local.get $t))
            (i32.const 40))))
        (else (if (result i32) (i32.lt_s (local.get $t) (i32.const 120))
          (then (local.get $q))
          (else (if (result i32) (i32.lt_s (local.get $t) (i32.const 160))
            (then (i32.add (local.get $p)
              (i32.div_s
                (i32.mul (i32.sub (local.get $q) (local.get $p))
                  (i32.sub (i32.const 160) (local.get $t)))
                (i32.const 40))))
            (else (local.get $p))))))))
    (i32.div_s (i32.mul (local.get $v) (i32.const 255)) (i32.const 240)))

  (func $colordlg_hsl_to_rgb
    (param $h i32) (param $s i32) (param $l i32) (result i32)
    (local $p i32) (local $q i32)
    (local $r i32) (local $g i32) (local $b i32)
    (if (i32.eqz (local.get $s))
      (then
        (local.set $r (i32.div_s
          (i32.mul (local.get $l) (i32.const 255)) (i32.const 240)))
        (return (i32.or (local.get $r)
          (i32.or (i32.shl (local.get $r) (i32.const 8))
                  (i32.shl (local.get $r) (i32.const 16)))))))
    (local.set $q
      (if (result i32) (i32.lt_s (local.get $l) (i32.const 120))
        (then (i32.div_s
          (i32.mul (local.get $l) (i32.add (i32.const 240) (local.get $s)))
          (i32.const 240)))
        (else (i32.sub
          (i32.add (local.get $l) (local.get $s))
          (i32.div_s (i32.mul (local.get $l) (local.get $s)) (i32.const 240))))))
    (local.set $p (i32.sub (i32.mul (local.get $l) (i32.const 2)) (local.get $q)))
    (local.set $r (call $colordlg_hue_component
      (local.get $p) (local.get $q) (i32.add (local.get $h) (i32.const 80))))
    (local.set $g (call $colordlg_hue_component
      (local.get $p) (local.get $q) (local.get $h)))
    (local.set $b (call $colordlg_hue_component
      (local.get $p) (local.get $q) (i32.sub (local.get $h) (i32.const 80))))
    (i32.or (local.get $r)
      (i32.or (i32.shl (local.get $g) (i32.const 8))
              (i32.shl (local.get $b) (i32.const 16)))))

  ;; State: hue, saturation, luminosity (all 0..240).
  (func $colorspectrum_commit (param $hwnd i32) (param $sw ptr<ColorSpectrumState>)
    (local $dlg i32) (local $cc i32) (local $rgb i32)
    (local.set $rgb (call $colordlg_hsl_to_rgb
      (load.field ColorSpectrumState hue (local.get $sw))
      (load.field.memarg ColorSpectrumState sat (local.get $sw))
      (load.field.memarg ColorSpectrumState lum (local.get $sw))))
    (local.set $dlg (call $wnd_get_parent (local.get $hwnd)))
    (local.set $cc (call $wnd_get_userdata (local.get $dlg)))
    (if (local.get $cc)
      (then (i32.store offset=12 (call $g2w (local.get $cc)) (local.get $rgb))))
    (call $colordlg_sync_rgb_fields (local.get $dlg) (local.get $rgb))
    (call $colordlg_sync_hsl_fields
      (local.get $dlg)
      (load.field ColorSpectrumState hue (local.get $sw))
      (load.field.memarg ColorSpectrumState sat (local.get $sw))
      (load.field.memarg ColorSpectrumState lum (local.get $sw)))
    (call $colordlg_invalidate_preview (local.get $dlg))
    (call $invalidate_hwnd (local.get $hwnd)))

  (func $colorspectrum_wndproc
    (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $state i32) (local $sw ptr<ColorSpectrumState>) (local $hdc i32)
    (local $x i32) (local $y i32)
    (local $row i32) (local $seg i32) (local $sat i32) (local $lum i32)
    (local $x0 i32) (local $x1 i32) (local $c0 i32) (local $c1 i32)
    (local $mark_x i32) (local $mark_y i32)
    (local.set $state (call $wnd_get_state_ptr (local.get $hwnd)))

    (if (i32.eq (local.get $msg) (i32.const 0x0001))
      (then (local.set $state (call $heap_alloc (i32.const 12)))))

    (if (i32.eq (local.get $msg) (i32.const 0x0002))
      (then
        (if (local.get $state)
          (then (call $heap_free (local.get $state))
                (call $wnd_set_state_ptr (local.get $hwnd) (i32.const 0))))
        (return (i32.const 0))))
    (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
    (local.set $sw (cast ptr<ColorSpectrumState> (call $g2w (local.get $state))))
    (if (i32.eq (local.get $msg) (i32.const 0x0001))
      (then
        (store.field ColorSpectrumState hue (local.get $sw) (i32.const 0))
        (store.field.memarg ColorSpectrumState sat (local.get $sw) (i32.const 0))
        (store.field.memarg ColorSpectrumState lum (local.get $sw) (i32.const 0))
        (call $wnd_set_state_ptr (local.get $hwnd) (local.get $state))
        (return (i32.const 0))))

    (if (i32.eq (local.get $msg) (i32.const 0x000F))
      (then
        (local.set $hdc (i32.add (local.get $hwnd) (i32.const 0x40000)))
        (drop (call $gdi_native_fill_rect (local.get $hdc)
          (i32.const 0) (i32.const 0) (i32.const 196) (i32.const 140)
          (i32.const 0x30011)))
        (drop (call $gdi_native_draw_edge (local.get $hdc)
          (i32.const 0) (i32.const 0) (i32.const 164) (i32.const 124)
          (i32.const 0x0A) (i32.const 0x0F)))
        (drop (call $gdi_native_draw_edge (local.get $hdc)
          (i32.const 174) (i32.const 0) (i32.const 194) (i32.const 124)
          (i32.const 0x0A) (i32.const 0x0F)))
        (local.set $row (i32.const 0))
        (block $paint_done (loop $paint_rows
          (br_if $paint_done (i32.ge_u (local.get $row) (i32.const 120)))
          (local.set $sat (i32.sub (i32.const 240)
            (i32.div_u (i32.mul (local.get $row) (i32.const 240)) (i32.const 119))))
          (local.set $seg (i32.const 0))
          (block $segments_done (loop $paint_segments
            (br_if $segments_done (i32.ge_u (local.get $seg) (i32.const 6)))
            (local.set $x0 (i32.add (i32.const 2)
              (i32.div_u (i32.mul (local.get $seg) (i32.const 160)) (i32.const 6))))
            (local.set $x1 (i32.add (i32.const 2)
              (i32.div_u (i32.mul (i32.add (local.get $seg) (i32.const 1)) (i32.const 160)) (i32.const 6))))
            (local.set $c0 (call $colordlg_hsl_to_rgb
              (i32.mul (local.get $seg) (i32.const 40)) (local.get $sat) (i32.const 120)))
            (local.set $c1 (call $colordlg_hsl_to_rgb
              (i32.mul (i32.add (local.get $seg) (i32.const 1)) (i32.const 40))
              (local.get $sat) (i32.const 120)))
            (drop (call $gdi_native_gradient_fill_h (local.get $hdc)
              (local.get $x0) (i32.add (local.get $row) (i32.const 2))
              (local.get $x1) (i32.add (local.get $row) (i32.const 3))
              (local.get $c0) (local.get $c1)))
            (local.set $seg (i32.add (local.get $seg) (i32.const 1)))
            (br $paint_segments)))
          (local.set $lum (i32.sub (i32.const 240)
            (i32.div_u (i32.mul (local.get $row) (i32.const 240)) (i32.const 119))))
          (local.set $c0 (call $colordlg_hsl_to_rgb
            (load.field ColorSpectrumState hue (local.get $sw)) (load.field.memarg ColorSpectrumState sat (local.get $sw)) (local.get $lum)))
          (drop (call $gdi_native_gradient_fill_h (local.get $hdc)
            (i32.const 176) (i32.add (local.get $row) (i32.const 2))
            (i32.const 192) (i32.add (local.get $row) (i32.const 3))
            (local.get $c0) (local.get $c0)))
          (local.set $row (i32.add (local.get $row) (i32.const 1)))
          (br $paint_rows)))
        (local.set $mark_x (i32.add (i32.const 2)
          (i32.div_u (i32.mul (load.field ColorSpectrumState hue (local.get $sw)) (i32.const 159)) (i32.const 240))))
        (local.set $mark_y (i32.add (i32.const 2)
          (i32.div_u
            (i32.mul (i32.sub (i32.const 240) (load.field.memarg ColorSpectrumState sat (local.get $sw))) (i32.const 119))
            (i32.const 240))))
        (drop (call $gdi_native_draw_focus_rect (local.get $hdc)
          (i32.sub (local.get $mark_x) (i32.const 3))
          (i32.sub (local.get $mark_y) (i32.const 3))
          (i32.add (local.get $mark_x) (i32.const 4))
          (i32.add (local.get $mark_y) (i32.const 4))))
        (local.set $mark_y (i32.add (i32.const 2)
          (i32.div_u
            (i32.mul (i32.sub (i32.const 240) (load.field.memarg ColorSpectrumState lum (local.get $sw))) (i32.const 119))
            (i32.const 240))))
        (drop (call $gdi_native_draw_focus_rect (local.get $hdc)
          (i32.const 174) (i32.sub (local.get $mark_y) (i32.const 2))
          (i32.const 195) (i32.add (local.get $mark_y) (i32.const 3))))
        (return (i32.const 0))))

    (if (i32.eq (local.get $msg) (i32.const 0x0201))
      (then
        (local.set $x (i32.and (local.get $lParam) (i32.const 0xFFFF)))
        (local.set $y (i32.and (i32.shr_u (local.get $lParam) (i32.const 16)) (i32.const 0xFFFF)))
        (if (i32.and
              (i32.and (i32.ge_u (local.get $x) (i32.const 2))
                       (i32.lt_u (local.get $x) (i32.const 162)))
              (i32.and (i32.ge_u (local.get $y) (i32.const 2))
                       (i32.lt_u (local.get $y) (i32.const 122))))
          (then
            (store.field ColorSpectrumState hue (local.get $sw)
              (i32.div_u (i32.mul (i32.sub (local.get $x) (i32.const 2)) (i32.const 240)) (i32.const 159)))
            (store.field.memarg ColorSpectrumState sat (local.get $sw)
              (i32.sub (i32.const 240)
                (i32.div_u (i32.mul (i32.sub (local.get $y) (i32.const 2)) (i32.const 240)) (i32.const 119))))
            ;; A first spectrum click should produce a visible color even when
            ;; the caller's initial black selected luminosity zero.
            (if (i32.eqz (load.field.memarg ColorSpectrumState lum (local.get $sw)))
              (then (store.field.memarg ColorSpectrumState lum (local.get $sw) (i32.const 120))))
            (call $colorspectrum_commit (local.get $hwnd) (local.get $sw))))
        (if (i32.and
              (i32.and (i32.ge_u (local.get $x) (i32.const 176))
                       (i32.lt_u (local.get $x) (i32.const 192)))
              (i32.and (i32.ge_u (local.get $y) (i32.const 2))
                       (i32.lt_u (local.get $y) (i32.const 122))))
          (then
            (store.field.memarg ColorSpectrumState lum (local.get $sw)
              (i32.sub (i32.const 240)
                (i32.div_u (i32.mul (i32.sub (local.get $y) (i32.const 2)) (i32.const 240)) (i32.const 119))))
            (call $colorspectrum_commit (local.get $hwnd) (local.get $sw))))
        (return (i32.const 0))))
    (i32.const 0))

  ;; The classic dialog presents the selected RGB value as a two-half
  ;; "Color|Solid" swatch. On our true-color surface both halves are the same
  ;; exact color; retaining the split and labels matches Win98 while leaving a
  ;; future palette-mode nearest-solid conversion straightforward.
  (func $colorpreview_wndproc
    (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $dlg i32) (local $cc i32) (local $rgb i32) (local $hdc i32)
    (local $sz i32) (local $w i32) (local $h i32) (local $brush i32)
    (if (i32.ne (local.get $msg) (i32.const 0x000F))
      (then (return (i32.const 0))))
    (local.set $dlg (call $wnd_get_parent (local.get $hwnd)))
    (local.set $cc (call $wnd_get_userdata (local.get $dlg)))
    (if (local.get $cc)
      (then (local.set $rgb (i32.load offset=12 (call $g2w (local.get $cc))))))
    (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
    (local.set $w (i32.and (local.get $sz) (i32.const 0xFFFF)))
    (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
    (local.set $hdc (i32.add (local.get $hwnd) (i32.const 0x40000)))
    (drop (call $gdi_native_fill_rect (local.get $hdc)
      (i32.const 0) (i32.const 0) (local.get $w) (local.get $h)
      (i32.const 0x30014))) ;; black frame
    (local.set $brush (call $gdi_native_create_solid_brush (local.get $rgb)))
    (drop (call $gdi_native_fill_rect (local.get $hdc)
      (i32.const 2) (i32.const 2)
      (i32.sub (local.get $w) (i32.const 2))
      (i32.sub (local.get $h) (i32.const 2))
      (local.get $brush)))
    (drop (call $gdi_native_delete_object (local.get $brush)))
    ;; Preserve the visible Color/Solid split even when both true-color halves
    ;; resolve identically.
    (drop (call $gdi_native_fill_rect (local.get $hdc)
      (i32.sub (i32.div_u (local.get $w) (i32.const 2)) (i32.const 1))
      (i32.const 1)
      (i32.div_u (local.get $w) (i32.const 2))
      (i32.sub (local.get $h) (i32.const 1))
      (i32.const 0x30014)))
    (i32.const 0))

  (func $colordlg_commit_rgb_edits (param $dlg i32)
    (local $cc i32) (local $r i32) (local $g i32) (local $b i32) (local $rgb i32)
    (local.set $cc (call $wnd_get_userdata (local.get $dlg)))
    (if (i32.eqz (local.get $cc)) (then (return)))
    (local.set $r (call $ctrl_decimal_value (local.get $dlg) (i32.const 0x463) (i32.const 0)))
    (local.set $g (call $ctrl_decimal_value (local.get $dlg) (i32.const 0x464) (i32.const 0)))
    (local.set $b (call $ctrl_decimal_value (local.get $dlg) (i32.const 0x465) (i32.const 0)))
    (if (i32.gt_u (local.get $r) (i32.const 255)) (then (local.set $r (i32.const 255))))
    (if (i32.gt_u (local.get $g) (i32.const 255)) (then (local.set $g (i32.const 255))))
    (if (i32.gt_u (local.get $b) (i32.const 255)) (then (local.set $b (i32.const 255))))
    (local.set $rgb (i32.or (local.get $r)
      (i32.or (i32.shl (local.get $g) (i32.const 8))
              (i32.shl (local.get $b) (i32.const 16)))))
    (i32.store offset=12 (call $g2w (local.get $cc)) (local.get $rgb))
    (call $colordlg_sync_spectrum_from_rgb (local.get $dlg) (local.get $rgb)))

  (func $colordlg_commit_hsl_edits (param $dlg i32)
    (local $cc i32) (local $picker i32) (local $state i32) (local $sw ptr<ColorSpectrumState>)
    (local $h i32) (local $s i32) (local $l i32) (local $rgb i32)
    (local.set $cc (call $wnd_get_userdata (local.get $dlg)))
    (local.set $picker (call $ctrl_find_by_id (local.get $dlg) (i32.const 0x467)))
    (if (i32.or (i32.eqz (local.get $cc)) (i32.eqz (local.get $picker))) (then (return)))
    (local.set $state (call $wnd_get_state_ptr (local.get $picker)))
    (if (i32.eqz (local.get $state)) (then (return)))
    (local.set $h (call $ctrl_decimal_value (local.get $dlg) (i32.const 0x468) (i32.const 0)))
    (local.set $s (call $ctrl_decimal_value (local.get $dlg) (i32.const 0x469) (i32.const 0)))
    (local.set $l (call $ctrl_decimal_value (local.get $dlg) (i32.const 0x46A) (i32.const 0)))
    (if (i32.gt_u (local.get $h) (i32.const 240)) (then (local.set $h (i32.const 240))))
    (if (i32.gt_u (local.get $s) (i32.const 240)) (then (local.set $s (i32.const 240))))
    (if (i32.gt_u (local.get $l) (i32.const 240)) (then (local.set $l (i32.const 240))))
    (local.set $sw (cast ptr<ColorSpectrumState> (call $g2w (local.get $state))))
    (store.field ColorSpectrumState hue (local.get $sw) (local.get $h))
    (store.field.memarg ColorSpectrumState sat (local.get $sw) (local.get $s))
    (store.field.memarg ColorSpectrumState lum (local.get $sw) (local.get $l))
    (local.set $rgb (call $colordlg_hsl_to_rgb
      (local.get $h) (local.get $s) (local.get $l)))
    (i32.store offset=12 (call $g2w (local.get $cc)) (local.get $rgb))
    (call $colordlg_sync_rgb_fields (local.get $dlg) (local.get $rgb))
    (call $colordlg_sync_hsl_fields
      (local.get $dlg) (local.get $h) (local.get $s) (local.get $l))
    (call $colordlg_invalidate_preview (local.get $dlg))
    (call $invalidate_hwnd (local.get $picker)))

  (func $colordlg_expand_custom (param $dlg i32)
    (local $rect i32) (local $cc i32) (local $rgb i32)
    (local $label i32) (local $edit i32)
    (local $slot i32) (local $child i32)
    ;; Presence of the first RGB edit is also the expanded-state flag.
    (if (call $ctrl_find_by_id (local.get $dlg) (i32.const 0x463)) (then (return)))
    (local.set $rect (call $paint_scratch_take))
    (call $host_get_window_rect (local.get $dlg) (local.get $rect))
    (call $host_move_window
      (local.get $dlg)
      (load.field PaintRect left (local.get $rect)) (load.field.memarg PaintRect top (local.get $rect))
      (i32.const 436) (i32.const 330) (i32.const 0))
    (call $defwndproc_do_nccalcsize (local.get $dlg))
    ;; Allocate/fill the resized back-canvas now. If its first allocation is
    ;; deferred until a newly-created right-pane child paints, that resize
    ;; clears the left palette children that were already painted this pass.
    (drop (call $host_erase_background (local.get $dlg) (i32.const 16)))

    (local.set $cc (call $wnd_get_userdata (local.get $dlg)))
    (if (local.get $cc)
      (then (local.set $rgb (i32.load offset=12 (call $g2w (local.get $cc))))))

    ;; Win98's full ChooseColor pane starts with an interactive hue/saturation
    ;; square and a luminance strip. The RGB fields sit below this visual
    ;; picker rather than occupying its space.
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 23) (i32.const 0x467)
      (i32.const 226) (i32.const 10) (i32.const 196) (i32.const 140)
      (i32.const 0x50000000) (i32.const 0)))

    ;; Current/nearest-solid preview and its split caption. On a true-color
    ;; display the two halves intentionally match.
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 26) (i32.const 0x46B)
      (i32.const 226) (i32.const 142) (i32.const 58) (i32.const 34)
      (i32.const 0x50000000) (i32.const 0)))
    (local.set $label (call $colordlg_make_label (i32.const 7)))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 3) (i32.const 0xFFFF)
      (i32.const 226) (i32.const 178) (i32.const 29) (i32.const 16)
      (i32.const 0x50000000) (local.get $label)))
    (call $heap_free (local.get $label))
    (local.set $label (call $colordlg_make_label (i32.const 8)))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 3) (i32.const 0xFFFF)
      (i32.const 255) (i32.const 178) (i32.const 29) (i32.const 16)
      (i32.const 0x50000000) (local.get $label)))
    (call $heap_free (local.get $label))

    ;; Hue, saturation, and luminance share the classic 0..240 scale.
    (local.set $label (call $colordlg_make_label (i32.const 4)))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 3) (i32.const 0xFFFF)
      (i32.const 292) (i32.const 148) (i32.const 32) (i32.const 18)
      (i32.const 0x50000000) (local.get $label)))
    (call $heap_free (local.get $label))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 2) (i32.const 0x468)
      (i32.const 324) (i32.const 144) (i32.const 28) (i32.const 22)
      (i32.const 0x50812080) (i32.const 0)))
    (local.set $label (call $colordlg_make_label (i32.const 5)))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 3) (i32.const 0xFFFF)
      (i32.const 292) (i32.const 178) (i32.const 32) (i32.const 18)
      (i32.const 0x50000000) (local.get $label)))
    (call $heap_free (local.get $label))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 2) (i32.const 0x469)
      (i32.const 324) (i32.const 174) (i32.const 28) (i32.const 22)
      (i32.const 0x50812080) (i32.const 0)))
    (local.set $label (call $colordlg_make_label (i32.const 6)))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 3) (i32.const 0xFFFF)
      (i32.const 292) (i32.const 208) (i32.const 32) (i32.const 18)
      (i32.const 0x50000000) (local.get $label)))
    (call $heap_free (local.get $label))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 2) (i32.const 0x46A)
      (i32.const 324) (i32.const 204) (i32.const 28) (i32.const 22)
      (i32.const 0x50812080) (i32.const 0)))

    (local.set $label (call $colordlg_make_label (i32.const 0)))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 3) (i32.const 0xFFFF)
      (i32.const 356) (i32.const 148) (i32.const 34) (i32.const 18)
      (i32.const 0x50000000) (local.get $label)))
    (call $heap_free (local.get $label))
    (local.set $edit (call $ctrl_create_child (local.get $dlg) (i32.const 2) (i32.const 0x463)
      (i32.const 390) (i32.const 144) (i32.const 32) (i32.const 22)
      (i32.const 0x50812080) (i32.const 0)))

    (local.set $label (call $colordlg_make_label (i32.const 1)))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 3) (i32.const 0xFFFF)
      (i32.const 356) (i32.const 178) (i32.const 34) (i32.const 18)
      (i32.const 0x50000000) (local.get $label)))
    (call $heap_free (local.get $label))
    (local.set $edit (call $ctrl_create_child (local.get $dlg) (i32.const 2) (i32.const 0x464)
      (i32.const 390) (i32.const 174) (i32.const 32) (i32.const 22)
      (i32.const 0x50812080) (i32.const 0)))

    (local.set $label (call $colordlg_make_label (i32.const 2)))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 3) (i32.const 0xFFFF)
      (i32.const 356) (i32.const 208) (i32.const 34) (i32.const 18)
      (i32.const 0x50000000) (local.get $label)))
    (call $heap_free (local.get $label))
    (local.set $edit (call $ctrl_create_child (local.get $dlg) (i32.const 2) (i32.const 0x465)
      (i32.const 390) (i32.const 204) (i32.const 32) (i32.const 22)
      (i32.const 0x50812080) (i32.const 0)))

    (call $colordlg_sync_from_rgb (local.get $dlg) (local.get $rgb))

    (local.set $label (call $colordlg_make_label (i32.const 3)))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 1) (i32.const 0x466)
      (i32.const 226) (i32.const 250) (i32.const 196) (i32.const 24)
      (i32.const 0x50010000) (local.get $label)))
    (call $heap_free (local.get $label))
    ;; Resizing reallocates and clears the dialog's shared back-canvas. Paint
    ;; every child now so the existing left palette is restored along with the
    ;; new RGB controls; invalidating only the parent leaves a blank gray pane.
    (local.set $slot (i32.const 0))
    (block $paint_done (loop $paint_children
      (local.set $slot (call $wnd_next_child_slot (local.get $dlg) (local.get $slot)))
      (br_if $paint_done (i32.eq (local.get $slot) (i32.const -1)))
      (local.set $child (call $wnd_slot_hwnd (local.get $slot)))
      (if (local.get $child)
        (then (drop (call $wnd_send_message
          (local.get $child) (i32.const 0x000F) (i32.const 0) (i32.const 0)))))
      (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
      (br $paint_children)))
    (call $invalidate_hwnd (local.get $dlg)))

  (func $colordlg_add_custom (param $dlg i32)
    (local $cc i32) (local $custom i32) (local $rgb i32)
    (local $r i32) (local $g i32) (local $b i32) (local $idx i32)
    (local $grid i32) (local $state i32) (local $basic i32)
    (local $grid_sw ptr<ColorGridState>) (local $basic_sw ptr<ColorGridState>)
    (local.set $cc (call $wnd_get_userdata (local.get $dlg)))
    (if (i32.eqz (local.get $cc)) (then (return)))
    (local.set $custom (i32.load offset=16 (call $g2w (local.get $cc))))
    (if (i32.eqz (local.get $custom)) (then (return)))
    (local.set $r (call $ctrl_decimal_value (local.get $dlg) (i32.const 0x463) (i32.const 0)))
    (local.set $g (call $ctrl_decimal_value (local.get $dlg) (i32.const 0x464) (i32.const 0)))
    (local.set $b (call $ctrl_decimal_value (local.get $dlg) (i32.const 0x465) (i32.const 0)))
    (if (i32.gt_u (local.get $r) (i32.const 255)) (then (local.set $r (i32.const 255))))
    (if (i32.gt_u (local.get $g) (i32.const 255)) (then (local.set $g (i32.const 255))))
    (if (i32.gt_u (local.get $b) (i32.const 255)) (then (local.set $b (i32.const 255))))
    (local.set $rgb
      (i32.or (local.get $r)
        (i32.or (i32.shl (local.get $g) (i32.const 8))
                (i32.shl (local.get $b) (i32.const 16)))))
    (local.set $grid (call $ctrl_find_by_id (local.get $dlg) (i32.const 0x461)))
    (if (local.get $grid)
      (then
        (local.set $state (call $wnd_get_state_ptr (local.get $grid)))
        (if (local.get $state)
          (then
            (local.set $grid_sw (cast ptr<ColorGridState> (call $g2w (local.get $state))))
            (local.set $idx (load.field ColorGridState sel_idx (local.get $grid_sw)))))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_s (local.get $idx) (i32.const 16)))
          (then (local.set $idx (i32.const 0))))
        (i32.store (i32.add (call $g2w (local.get $custom))
          (i32.mul (local.get $idx) (i32.const 4))) (local.get $rgb))
        (if (local.get $state)
          (then (store.field ColorGridState sel_idx (local.get $grid_sw) (local.get $idx))))
        (call $invalidate_hwnd (local.get $grid))))
    (local.set $basic (call $ctrl_find_by_id (local.get $dlg) (i32.const 0x460)))
    (if (local.get $basic)
      (then
        (local.set $state (call $wnd_get_state_ptr (local.get $basic)))
        (if (local.get $state)
          (then
            (local.set $basic_sw (cast ptr<ColorGridState> (call $g2w (local.get $state))))
            (store.field ColorGridState sel_idx (local.get $basic_sw) (i32.const -1))))
        (call $invalidate_hwnd (local.get $basic))))
    (i32.store offset=12 (call $g2w (local.get $cc)) (local.get $rgb))
    (call $colordlg_sync_from_rgb (local.get $dlg) (local.get $rgb)))

  (func $colorgrid_color_for_idx (param $idx i32) (result i32)
    ;; Values are COLORREF (0x00BBGGRR), indexed row-major.
    (if (i32.eq (local.get $idx) (i32.const  0)) (then (return (i32.const 0x008080FF))))
    (if (i32.eq (local.get $idx) (i32.const  1)) (then (return (i32.const 0x0080FFFF))))
    (if (i32.eq (local.get $idx) (i32.const  2)) (then (return (i32.const 0x0080FF80))))
    (if (i32.eq (local.get $idx) (i32.const  3)) (then (return (i32.const 0x0080FF00))))
    (if (i32.eq (local.get $idx) (i32.const  4)) (then (return (i32.const 0x00FFFF80))))
    (if (i32.eq (local.get $idx) (i32.const  5)) (then (return (i32.const 0x00FF8000))))
    (if (i32.eq (local.get $idx) (i32.const  6)) (then (return (i32.const 0x00C080FF))))
    (if (i32.eq (local.get $idx) (i32.const  7)) (then (return (i32.const 0x00FF80FF))))
    (if (i32.eq (local.get $idx) (i32.const  8)) (then (return (i32.const 0x000000FF))))
    (if (i32.eq (local.get $idx) (i32.const  9)) (then (return (i32.const 0x0000FFFF))))
    (if (i32.eq (local.get $idx) (i32.const 10)) (then (return (i32.const 0x0000FF80))))
    (if (i32.eq (local.get $idx) (i32.const 11)) (then (return (i32.const 0x0040FF00))))
    (if (i32.eq (local.get $idx) (i32.const 12)) (then (return (i32.const 0x00FFFF00))))
    (if (i32.eq (local.get $idx) (i32.const 13)) (then (return (i32.const 0x00C08000))))
    (if (i32.eq (local.get $idx) (i32.const 14)) (then (return (i32.const 0x00C08080))))
    (if (i32.eq (local.get $idx) (i32.const 15)) (then (return (i32.const 0x00FF00FF))))
    (if (i32.eq (local.get $idx) (i32.const 16)) (then (return (i32.const 0x00404080))))
    (if (i32.eq (local.get $idx) (i32.const 17)) (then (return (i32.const 0x004080FF))))
    (if (i32.eq (local.get $idx) (i32.const 18)) (then (return (i32.const 0x0000FF00))))
    (if (i32.eq (local.get $idx) (i32.const 19)) (then (return (i32.const 0x00808000))))
    (if (i32.eq (local.get $idx) (i32.const 20)) (then (return (i32.const 0x00804000))))
    (if (i32.eq (local.get $idx) (i32.const 21)) (then (return (i32.const 0x00FF8080))))
    (if (i32.eq (local.get $idx) (i32.const 22)) (then (return (i32.const 0x00400080))))
    (if (i32.eq (local.get $idx) (i32.const 23)) (then (return (i32.const 0x008000FF))))
    (if (i32.eq (local.get $idx) (i32.const 24)) (then (return (i32.const 0x00000080))))
    (if (i32.eq (local.get $idx) (i32.const 25)) (then (return (i32.const 0x000080FF))))
    (if (i32.eq (local.get $idx) (i32.const 26)) (then (return (i32.const 0x00008000))))
    (if (i32.eq (local.get $idx) (i32.const 27)) (then (return (i32.const 0x00408000))))
    (if (i32.eq (local.get $idx) (i32.const 28)) (then (return (i32.const 0x00FF0000))))
    (if (i32.eq (local.get $idx) (i32.const 29)) (then (return (i32.const 0x00A00000))))
    (if (i32.eq (local.get $idx) (i32.const 30)) (then (return (i32.const 0x00800080))))
    (if (i32.eq (local.get $idx) (i32.const 31)) (then (return (i32.const 0x00FF0080))))
    (if (i32.eq (local.get $idx) (i32.const 32)) (then (return (i32.const 0x00000040))))
    (if (i32.eq (local.get $idx) (i32.const 33)) (then (return (i32.const 0x00004080))))
    (if (i32.eq (local.get $idx) (i32.const 34)) (then (return (i32.const 0x00004000))))
    (if (i32.eq (local.get $idx) (i32.const 35)) (then (return (i32.const 0x00404000))))
    (if (i32.eq (local.get $idx) (i32.const 36)) (then (return (i32.const 0x00800000))))
    (if (i32.eq (local.get $idx) (i32.const 37)) (then (return (i32.const 0x00400000))))
    (if (i32.eq (local.get $idx) (i32.const 38)) (then (return (i32.const 0x00400040))))
    (if (i32.eq (local.get $idx) (i32.const 39)) (then (return (i32.const 0x00800040))))
    (if (i32.eq (local.get $idx) (i32.const 40)) (then (return (i32.const 0x00000000))))
    (if (i32.eq (local.get $idx) (i32.const 41)) (then (return (i32.const 0x00008080))))
    (if (i32.eq (local.get $idx) (i32.const 42)) (then (return (i32.const 0x00408080))))
    (if (i32.eq (local.get $idx) (i32.const 43)) (then (return (i32.const 0x00808080))))
    (if (i32.eq (local.get $idx) (i32.const 44)) (then (return (i32.const 0x00808040))))
    (if (i32.eq (local.get $idx) (i32.const 45)) (then (return (i32.const 0x00C0C0C0))))
    (if (i32.eq (local.get $idx) (i32.const 46)) (then (return (i32.const 0x00400040))))
    (if (i32.eq (local.get $idx) (i32.const 47)) (then (return (i32.const 0x00FFFFFF))))
    (i32.const 0x00FFFFFF))

  (func $colorgrid_color_for_hwnd (param $hwnd i32) (param $idx i32) (result i32)
    (local $state i32) (local $ctrl_id i32) (local $parent i32)
    (local $cc i32) (local $custom i32)
    (local.set $state (call $wnd_get_state_ptr (local.get $hwnd)))
    (if (i32.eqz (local.get $state)) (then (return (i32.const 0x00FFFFFF))))
    (local.set $ctrl_id (call $ctrl_table_get_id (local.get $hwnd)))
    (if (i32.ne (local.get $ctrl_id) (i32.const 0x461))
      (then (return (call $colorgrid_color_for_idx (local.get $idx)))))
    (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
    (local.set $cc (call $wnd_get_userdata (local.get $parent)))
    (if (i32.eqz (local.get $cc)) (then (return (i32.const 0x00FFFFFF))))
    (local.set $custom (i32.load offset=16 (call $g2w (local.get $cc))))
    (if (i32.eqz (local.get $custom)) (then (return (i32.const 0x00FFFFFF))))
    (i32.load (i32.add (call $g2w (local.get $custom))
              (i32.mul (local.get $idx) (i32.const 4)))))

  (func $colorgrid_wndproc (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $state i32) (local $sw ptr<ColorGridState>) (local $cs_w i32)
    (local $x i32) (local $y i32) (local $col i32) (local $row i32)
    (local $idx i32) (local $parent i32) (local $ctrl_id i32)
    (local $hdc i32) (local $sel i32) (local $brush i32)
    (local $cx i32) (local $cy i32) (local $row_count i32)
    (local $other i32) (local $other_state i32) (local $other_sw ptr<ColorGridState>) (local $cc i32) (local $rgb i32)

    (local.set $state (call $wnd_get_state_ptr (local.get $hwnd)))

    (if (i32.eq (local.get $msg) (i32.const 0x0001))
      (then
        (local.set $cs_w (call $g2w (local.get $lParam)))
        (local.set $state (call $heap_alloc (i32.const 4)))))

    (if (i32.eq (local.get $msg) (i32.const 0x0002))
      (then
        (if (local.get $state)
          (then (call $heap_free (local.get $state))
                (call $wnd_set_state_ptr (local.get $hwnd) (i32.const 0))))
        (return (i32.const 0))))

    (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
    (local.set $sw (cast ptr<ColorGridState> (call $g2w (local.get $state))))
    (if (i32.eq (local.get $msg) (i32.const 0x0001))
      (then
        (store.field ColorGridState sel_idx (local.get $sw) (i32.const -1))
        ;; CREATESTRUCT.hMenu is not copied in: it is already CONTROL_TABLE+4.
        (call $wnd_set_state_ptr (local.get $hwnd) (local.get $state))
        (return (i32.const 0))))

    ;; ---------- WM_PAINT (0x000F) ----------
    ;; Basic grid = 8x6; custom grid = 8x2. Each 26x22 cell contains a
    ;; 22x18 bordered swatch and a four-pixel gutter, matching the spacing in
    ;; the classic common-dialog template.
    (if (i32.eq (local.get $msg) (i32.const 0x000F))
      (then
        (local.set $hdc (i32.add (local.get $hwnd) (i32.const 0x40000)))
        (local.set $sel (load.field ColorGridState sel_idx (local.get $sw)))
        (local.set $ctrl_id (call $ctrl_table_get_id (local.get $hwnd)))
        (local.set $row_count
          (select (i32.const 2) (i32.const 6)
            (i32.eq (local.get $ctrl_id) (i32.const 0x461))))
        (drop (call $gdi_native_fill_rect (local.get $hdc)
                (i32.const 0) (i32.const 0) (i32.const 208)
                (i32.mul (local.get $row_count) (i32.const 22))
                (i32.const 0x30011)))  ;; LTGRAY_BRUSH / COLOR_BTNFACE
        (local.set $row (i32.const 0))
        (block $rows_done (loop $rows
          (br_if $rows_done (i32.ge_u (local.get $row) (local.get $row_count)))
          (local.set $col (i32.const 0))
          (block $cols_done (loop $cols
            (br_if $cols_done (i32.ge_u (local.get $col) (i32.const 8)))
            (local.set $idx (i32.add (i32.mul (local.get $row) (i32.const 8)) (local.get $col)))
            (local.set $cx (i32.mul (local.get $col) (i32.const 26)))
            (local.set $cy (i32.mul (local.get $row) (i32.const 22)))
            ;; 1-px black border = full cell painted black, then color fill 1px in
            (drop (call $gdi_native_fill_rect (local.get $hdc)
                    (local.get $cx) (local.get $cy)
                    (i32.add (local.get $cx) (i32.const 22))
                    (i32.add (local.get $cy) (i32.const 18))
                    (i32.const 0x30014)))  ;; BLACK_BRUSH
            (local.set $brush (call $gdi_native_create_solid_brush
                                (call $colorgrid_color_for_hwnd
                                  (local.get $hwnd) (local.get $idx))))
            (drop (call $gdi_native_fill_rect (local.get $hdc)
                    (i32.add (local.get $cx) (i32.const 1))
                    (i32.add (local.get $cy) (i32.const 1))
                    (i32.add (local.get $cx) (i32.const 21))
                    (i32.add (local.get $cy) (i32.const 17))
                    (local.get $brush)))
            (drop (call $gdi_native_delete_object (local.get $brush)))
            ;; Selection: white ring 2 px in from the border
            (if (i32.eq (local.get $idx) (local.get $sel))
              (then
                (drop (call $gdi_native_draw_edge (local.get $hdc)
                        (i32.add (local.get $cx) (i32.const 2))
                        (i32.add (local.get $cy) (i32.const 2))
                        (i32.add (local.get $cx) (i32.const 20))
                        (i32.add (local.get $cy) (i32.const 16))
                        (i32.const 0x05) (i32.const 0x0F)))))  ;; raised
            (local.set $col (i32.add (local.get $col) (i32.const 1)))
            (br $cols)))
          (local.set $row (i32.add (local.get $row) (i32.const 1)))
          (br $rows)))
        (return (i32.const 0))))

    (if (i32.eq (local.get $msg) (i32.const 0x0201))   ;; WM_LBUTTONDOWN
      (then
        (local.set $x (i32.and (local.get $lParam) (i32.const 0xFFFF)))
        (local.set $y (i32.shr_u (local.get $lParam) (i32.const 16)))
        (local.set $ctrl_id (call $ctrl_table_get_id (local.get $hwnd)))
        (local.set $row_count
          (select (i32.const 2) (i32.const 6)
            (i32.eq (local.get $ctrl_id) (i32.const 0x461))))
        (local.set $col (i32.div_s (local.get $x) (i32.const 26)))
        (local.set $row (i32.div_s (local.get $y) (i32.const 22)))
        (if (i32.or (i32.or (i32.lt_s (local.get $col) (i32.const 0))
                            (i32.ge_s (local.get $col) (i32.const 8)))
                    (i32.or (i32.lt_s (local.get $row) (i32.const 0))
                            (i32.ge_s (local.get $row) (local.get $row_count))))
          (then (return (i32.const 0))))
        ;; Ignore the four-pixel gutter after each visible swatch.
        (if (i32.or
              (i32.ge_u (i32.rem_u (local.get $x) (i32.const 26)) (i32.const 22))
              (i32.ge_u (i32.rem_u (local.get $y) (i32.const 22)) (i32.const 18)))
          (then (return (i32.const 0))))
        (local.set $idx (i32.add (i32.mul (local.get $row) (i32.const 8)) (local.get $col)))
        (store.field ColorGridState sel_idx (local.get $sw) (local.get $idx))
        (call $invalidate_hwnd (local.get $hwnd))
        (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
        (if (local.get $parent)
          (then
            ;; Only one of the two palettes owns the focus ring.
            (local.set $other (call $ctrl_find_by_id (local.get $parent)
              (select (i32.const 0x460) (i32.const 0x461)
                (i32.eq (local.get $ctrl_id) (i32.const 0x461)))))
            (if (local.get $other)
              (then
                (local.set $other_state (call $wnd_get_state_ptr (local.get $other)))
                (if (local.get $other_state)
                  (then
                    (local.set $other_sw (cast ptr<ColorGridState> (call $g2w (local.get $other_state))))
                    (store.field ColorGridState sel_idx (local.get $other_sw) (i32.const -1))))
                (call $invalidate_hwnd (local.get $other))))
            ;; Keep rgbResult current for both basic and custom selections.
            (local.set $cc (call $wnd_get_userdata (local.get $parent)))
            (if (local.get $cc)
              (then
                (local.set $rgb (call $colorgrid_color_for_hwnd
                  (local.get $hwnd) (local.get $idx)))
                (i32.store offset=12 (call $g2w (local.get $cc)) (local.get $rgb))
                (call $colordlg_sync_from_rgb (local.get $parent) (local.get $rgb))))
            (drop (call $wnd_send_message (local.get $parent) (i32.const 0x0111)
                    (i32.or (local.get $ctrl_id) (i32.const 0x10000))   ;; HIWORD=1 (LBN_SELCHANGE reused)
                    (local.get $hwnd)))))
        (return (i32.const 0))))

    (i32.const 0))

  (func $colordlg_wndproc
    (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $cmd i32) (local $notif i32)

    ;; CC_ENABLEHOOK lets applications customize the common dialog. Paint's
    ;; hook changes the stock "Color" caption to "Edit Colors" and expects to
    ;; observe the normal dialog message stream. A nonzero hook result consumes
    ;; the message before the common-dialog default behavior.
    (if (call $colordlg_call_hook
          (local.get $hwnd) (local.get $msg)
          (local.get $wParam) (local.get $lParam))
      (then (return (i32.const 1))))

    (if (i32.eq (local.get $msg) (i32.const 0x0085))   ;; WM_NCPAINT
      (then (call $defwndproc_do_ncpaint (local.get $hwnd)) (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0014))   ;; WM_ERASEBKGND
      (then (return (call $host_erase_background (local.get $hwnd) (i32.const 16)))))
    (if (i32.eq (local.get $msg) (i32.const 0x0010))   ;; WM_CLOSE
      (then (call $modal_done (i32.const 0)) (return (i32.const 0))))
    (if (i32.ne (local.get $msg) (i32.const 0x0111)) (then (return (i32.const 0))))
    (local.set $cmd (i32.and (local.get $wParam) (i32.const 0xFFFF)))
    (local.set $notif (i32.and (i32.shr_u (local.get $wParam) (i32.const 16)) (i32.const 0xFFFF)))

    (if (i32.eq (local.get $notif) (i32.const 0x0300)) ;; EN_CHANGE
      (then
        (if (global.get $colordlg_syncing) (then (return (i32.const 0))))
        (if (i32.and (i32.ge_u (local.get $cmd) (i32.const 0x463))
                     (i32.le_u (local.get $cmd) (i32.const 0x465)))
          (then (call $colordlg_commit_rgb_edits (local.get $hwnd)) (return (i32.const 0))))
        (if (i32.and (i32.ge_u (local.get $cmd) (i32.const 0x468))
                     (i32.le_u (local.get $cmd) (i32.const 0x46A)))
          (then (call $colordlg_commit_hsl_edits (local.get $hwnd)) (return (i32.const 0))))))

    (if (i32.eq (local.get $cmd) (i32.const 2))
      (then (call $modal_done (i32.const 0)) (return (i32.const 0))))

    (if (i32.eq (local.get $cmd) (i32.const 1))
      (then
        ;; A palette click already wrote the chosen basic/custom color into
        ;; CHOOSECOLOR.rgbResult; IDOK only commits the modal result.
        (call $modal_done (i32.const 1))
        (return (i32.const 0))))
    (if (i32.eq (local.get $cmd) (i32.const 0x462))
      (then
        (call $colordlg_expand_custom (local.get $hwnd))
        (return (i32.const 0))))
    (if (i32.eq (local.get $cmd) (i32.const 0x466))
      (then
        (call $colordlg_add_custom (local.get $hwnd))
        (return (i32.const 0))))
    (i32.const 0))

  (func $colordlg_call_hook
    (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $cc i32) (local $cc_w i32) (local $flags i32) (local $proc i32)
    (local $installed i32) (local $result i32)
    (local.set $cc (call $wnd_get_userdata (local.get $hwnd)))
    (if (i32.eqz (local.get $cc)) (then (return (i32.const 0))))
    (local.set $cc_w (call $g2w (local.get $cc)))
    (local.set $flags (i32.load offset=20 (local.get $cc_w)))
    (if (i32.eqz (i32.and (local.get $flags) (i32.const 0x10)))
      (then (return (i32.const 0))))
    (local.set $proc (i32.load offset=28 (local.get $cc_w)))
    (if (i32.eqz (local.get $proc)) (then (return (i32.const 0))))
    ;; Hooks commonly chain unhandled messages to DefWindowProc. That call
    ;; re-enters this WAT common-dialog proc, so suppress the hook while its
    ;; callback is active or the same message recursively invokes the hook
    ;; until the host WebAssembly stack overflows. Preserve every caller flag
    ;; and restore them before inspecting whether the callback destroyed the
    ;; dialog.
    (i32.store offset=20 (local.get $cc_w)
      (i32.and (local.get $flags) (i32.const -17))) ;; ~CC_ENABLEHOOK
    ;; Reuse the bounded synchronous x86 wndproc bridge. The dialog remains a
    ;; WAT-native common dialog before and after the callback.
    (local.set $installed (call $wnd_table_get (local.get $hwnd)))
    (call $wnd_table_set (local.get $hwnd) (local.get $proc))
    (local.set $result (call $wnd_send_message
      (local.get $hwnd) (local.get $msg)
      (local.get $wParam) (local.get $lParam)))
    (i32.store offset=20 (local.get $cc_w) (local.get $flags))
    (if (i32.lt_s (call $wnd_table_find (local.get $hwnd)) (i32.const 0))
      (then (return (i32.const 1))))
    (call $wnd_table_set (local.get $hwnd) (local.get $installed))
    (local.get $result))

  (func $create_color_dialog (param $dlg i32) (param $owner i32) (param $cc i32)
    (local $grid i32) (local $custom_grid i32) (local $rgb i32)
    (local $i i32) (local $sw i32) (local $basic_sw ptr<ColorGridState>)
    (local $custom_sw ptr<ColorGridState>) (local $flags i32)
    (local $custom i32) (local $found i32)
    (call $host_register_dialog_frame
      (local.get $dlg) (local.get $owner)
      (i32.const 0x252)   ;; "Color"
      (i32.const 236) (i32.const 330)
      (i32.const 1))
    (call $wnd_table_set (local.get $dlg) (global.get $WNDPROC_CTRL_NATIVE))
    (call $title_table_set (local.get $dlg) (i32.const 0x252) (i32.const 5))
    (call $wnd_set_owner (local.get $dlg) (local.get $owner))
    (drop (call $wnd_set_style (local.get $dlg) (i32.const 0x90C80000)))
    (call $defwndproc_do_nccalcsize (local.get $dlg))
    (call $ctrl_table_set (call $wnd_table_find (local.get $dlg))
      (i32.const 15) (i32.const 0))
    (call $nc_flags_set (local.get $dlg) (i32.const 3))
    (call $dlg_fill_bkgnd (local.get $dlg))
    (drop (call $wnd_set_userdata (local.get $dlg) (local.get $cc)))

    ;; The left/partial half of the stock Win98 color.dlg template.
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 3) (i32.const 0xFFFF)
            (i32.const 8) (i32.const 6) (i32.const 208) (i32.const 16)
            (i32.const 0x50000000)
            (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x235) (i32.const 13))))
    ;; Basic swatches: 8 columns * 26px, 6 rows * 22px.
    (local.set $grid (call $ctrl_create_child (local.get $dlg) (i32.const 6) (i32.const 0x460)
            (i32.const 8) (i32.const 24) (i32.const 208) (i32.const 132)
            (i32.const 0x50000000) (i32.const 0)))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 3) (i32.const 0xFFFF)
            (i32.const 8) (i32.const 164) (i32.const 208) (i32.const 16)
            (i32.const 0x50000000)
            (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x243) (i32.const 14))))
    ;; Custom swatches reflect the caller's persistent lpCustColors[16].
    (local.set $custom_grid (call $ctrl_create_child
            (local.get $dlg) (i32.const 6) (i32.const 0x461)
            (i32.const 8) (i32.const 182) (i32.const 208) (i32.const 44)
            (i32.const 0x50000000) (i32.const 0)))

    ;; CC_RGBINIT controls whether rgbResult is used initially; without it,
    ;; the documented default is black. Highlight either the matching basic
    ;; swatch or the matching caller-provided custom swatch.
    (if (local.get $cc)
      (then
        (local.set $flags (i32.load offset=20 (call $g2w (local.get $cc))))
        (if (i32.and (local.get $flags) (i32.const 1))
          (then (local.set $rgb (i32.load offset=12 (call $g2w (local.get $cc)))))
          (else
            (local.set $rgb (i32.const 0))
            (i32.store offset=12 (call $g2w (local.get $cc)) (i32.const 0))))
        (local.set $i (i32.const 0))
        (block $basic_done (loop $scan_basic
          (br_if $basic_done (i32.ge_u (local.get $i) (i32.const 48)))
          (if (i32.eq (call $colorgrid_color_for_idx (local.get $i)) (local.get $rgb))
            (then
              (local.set $sw (call $wnd_get_state_ptr (local.get $grid)))
              (if (local.get $sw)
                (then
                  (local.set $basic_sw (cast ptr<ColorGridState> (call $g2w (local.get $sw))))
                  (store.field ColorGridState sel_idx (local.get $basic_sw) (local.get $i))))
              (local.set $found (i32.const 1))
              (br $basic_done)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $scan_basic)))
        (if (i32.eqz (local.get $found))
          (then
            (local.set $custom (i32.load offset=16 (call $g2w (local.get $cc))))
            (if (local.get $custom)
              (then
                (local.set $i (i32.const 0))
                (block $custom_done (loop $scan_custom
                  (br_if $custom_done (i32.ge_u (local.get $i) (i32.const 16)))
                  (if (i32.eq
                        (i32.load (i32.add (call $g2w (local.get $custom))
                          (i32.mul (local.get $i) (i32.const 4))))
                        (local.get $rgb))
                    (then
                      (local.set $sw (call $wnd_get_state_ptr (local.get $custom_grid)))
                      (if (local.get $sw)
                        (then
                          (local.set $custom_sw (cast ptr<ColorGridState> (call $g2w (local.get $sw))))
                          (store.field ColorGridState sel_idx (local.get $custom_sw) (local.get $i))))
                      (br $custom_done)))
                  (local.set $i (i32.add (local.get $i) (i32.const 1)))
                  (br $scan_custom)))))))))
    ;; The stock partial dialog exposes custom-color expansion below the
    ;; persistent swatches. Keep OK/Cancel below it so controls never overlap.
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 1) (i32.const 0x462)
            (i32.const 8) (i32.const 234) (i32.const 208) (i32.const 24)
            (i32.const 0x50010000)
            (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x252) (i32.const 23))))
    ;; OK + Cancel
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 1) (i32.const 1)
            (i32.const 8) (i32.const 266) (i32.const 68) (i32.const 24)
            (i32.const 0x50010001)
            (call $wat_str_to_heap (i32.const 0x1D9) (i32.const 2))))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 1) (i32.const 2)
            (i32.const 82) (i32.const 266) (i32.const 68) (i32.const 24)
            (i32.const 0x50010000)
            (call $wat_str_to_heap (i32.const 0x1D2) (i32.const 6))))
    ;; CCHookProc receives WM_INITDIALOG with lParam pointing at CHOOSECOLOR.
    ;; Paint uses this to install the expected "Edit Colors" caption.
    (drop (call $colordlg_call_hook
      (local.get $dlg) (i32.const 0x0110) (i32.const 0) (local.get $cc))))
