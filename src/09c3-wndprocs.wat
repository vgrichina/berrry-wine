  ;; ---- ListView WndProc ----
  ;;
  ;; Bounded SysListView32 subset for report/list panes. This is intentionally
  ;; smaller than a full common-control clone: it stores columns, fixed 8-slot
  ;; subitem text rows, per-item LVIS_* state, and a vertical top index. That is
  ;; enough for RegEdit/installer details panes to become stateful and for the
  ;; shared Win98 scrollbar helpers to be reused here.
  ;;
  ;; ListViewState (80 bytes, allocated in WM_CREATE)
  ;;   +0   item_count
  ;;   +4   item_cap
  ;;   +8   item_cells_ptr   guest ptr to item_cap * 44-byte rows:
  ;;                          +0..+31 8 x u32 subitem text pointers,
  ;;                          +32 iImage, +36 lParam, +40 LVIS_* state
  ;;   +12  reserved
  ;;   +16  col_count
  ;;   +20  col_cap
  ;;   +24  col_widths_ptr   guest ptr to u32[]
  ;;   +28  col_texts_ptr    guest ptr to u32[] heap string pointers
  ;;   +32  selection_mark   most recently selected row, -1 = none. Selection
  ;;                         itself is the per-item LVIS_SELECTED bit: Win98's
  ;;                         default ListView permits multiple selected rows.
  ;;   +36  top_index        content viewport (LVM_GETTOPINDEX), distinct from
  ;;                         the thumb-only state changed by SetScrollPos
  ;;   +40  extended_style   LVM_SETEXTENDEDLISTVIEWSTYLE shadow
  ;;   +44  drag_anchor_y
  ;;   +48  drag_anchor_top
  ;;   +52  small_image_list handle from LVM_SETIMAGELIST
  ;;   +56  bk_color COLORREF
  ;;   +60  text_color COLORREF
  ;;   +64  text_bk_color COLORREF or CLR_NONE
  ;;   +68  state_image_list handle from LVM_SETIMAGELIST(LVSIL_STATE)
  ;;   +72  normal_image_list handle from LVM_SETIMAGELIST(LVSIL_NORMAL)
  ;; The control id is NOT in the record: $ctrl_table_get_id($hwnd).

  ;; ---- ListViewState accessors ----
  ;;
  ;; Eighteen fields, and three of them are counts whose neighbour is the
  ;; matching capacity (+0/+4 items, +16/+20 columns) — spelled as bare
  ;; offsets, storing an item count into item_cap reads as a plausible line
  ;; and corrupts the next grow. The three COLORREFs at +60/+64/+68 have the
  ;; same problem in the other direction: all three take the same kind of
  ;; value, so a wrong offset paints rather than traps. See the layout
  ;; comment directly above.
  (func $lv_item_count (param $sw ptr<ListViewState>) (result i32)
    (load.field ListViewState item_count (local.get $sw)))
  (func $lv_set_item_count (param $sw ptr<ListViewState>) (param $v i32)
    (store.field ListViewState item_count (local.get $sw) (local.get $v)))
  (func $lv_item_cap (param $sw ptr<ListViewState>) (result i32)
    (load.field.memarg ListViewState item_cap (local.get $sw)))
  (func $lv_set_item_cap (param $sw ptr<ListViewState>) (param $v i32)
    (store.field.memarg ListViewState item_cap (local.get $sw) (local.get $v)))
  (func $lv_cells_ptr (param $sw ptr<ListViewState>) (result i32)
    (load.field.memarg ListViewState item_cells_ptr (local.get $sw)))
  (func $lv_set_cells_ptr (param $sw ptr<ListViewState>) (param $v i32)
    (store.field.memarg ListViewState item_cells_ptr (local.get $sw) (local.get $v)))
  (func $lv_col_count (param $sw ptr<ListViewState>) (result i32)
    (load.field.memarg ListViewState col_count (local.get $sw)))
  (func $lv_set_col_count (param $sw ptr<ListViewState>) (param $v i32)
    (store.field.memarg ListViewState col_count (local.get $sw) (local.get $v)))
  (func $lv_col_cap (param $sw ptr<ListViewState>) (result i32)
    (load.field.memarg ListViewState col_cap (local.get $sw)))
  (func $lv_set_col_cap (param $sw ptr<ListViewState>) (param $v i32)
    (store.field.memarg ListViewState col_cap (local.get $sw) (local.get $v)))
  (func $lv_col_widths_ptr (param $sw ptr<ListViewState>) (result i32)
    (load.field.memarg ListViewState col_widths_ptr (local.get $sw)))
  (func $lv_set_col_widths_ptr (param $sw ptr<ListViewState>) (param $v i32)
    (store.field.memarg ListViewState col_widths_ptr (local.get $sw) (local.get $v)))
  (func $lv_col_texts_ptr (param $sw ptr<ListViewState>) (result i32)
    (load.field.memarg ListViewState col_texts_ptr (local.get $sw)))
  (func $lv_set_col_texts_ptr (param $sw ptr<ListViewState>) (param $v i32)
    (store.field.memarg ListViewState col_texts_ptr (local.get $sw) (local.get $v)))
  (func $lv_selected (param $sw ptr<ListViewState>) (result i32)
    (load.field.memarg ListViewState selected_index (local.get $sw)))
  (func $lv_set_selected (param $sw ptr<ListViewState>) (param $v i32)
    (store.field.memarg ListViewState selected_index (local.get $sw) (local.get $v)))
  (func $lv_top_index (param $sw ptr<ListViewState>) (result i32)
    (load.field.memarg ListViewState top_index (local.get $sw)))
  (func $lv_set_top_index (param $sw ptr<ListViewState>) (param $v i32)
    (store.field.memarg ListViewState top_index (local.get $sw) (local.get $v)))
  (func $lv_ex_style (param $sw ptr<ListViewState>) (result i32)
    (load.field.memarg ListViewState extended_style (local.get $sw)))
  (func $lv_set_ex_style (param $sw ptr<ListViewState>) (param $v i32)
    (store.field.memarg ListViewState extended_style (local.get $sw) (local.get $v)))
  (func $lv_drag_anchor_y (param $sw ptr<ListViewState>) (result i32)
    (load.field.memarg ListViewState drag_anchor_y (local.get $sw)))
  (func $lv_set_drag_anchor_y (param $sw ptr<ListViewState>) (param $v i32)
    (store.field.memarg ListViewState drag_anchor_y (local.get $sw) (local.get $v)))
  (func $lv_drag_anchor_top (param $sw ptr<ListViewState>) (result i32)
    (load.field.memarg ListViewState drag_anchor_top (local.get $sw)))
  (func $lv_set_drag_anchor_top (param $sw ptr<ListViewState>) (param $v i32)
    (store.field.memarg ListViewState drag_anchor_top (local.get $sw) (local.get $v)))
  (func $lv_image_list (param $sw ptr<ListViewState>) (result i32)
    (load.field.memarg ListViewState small_image_list (local.get $sw)))
  (func $lv_set_image_list (param $sw ptr<ListViewState>) (param $v i32)
    (store.field.memarg ListViewState small_image_list (local.get $sw) (local.get $v)))
  (func $lv_bk_color (param $sw ptr<ListViewState>) (result i32)
    (load.field.memarg ListViewState bk_color (local.get $sw)))
  (func $lv_set_bk_color (param $sw ptr<ListViewState>) (param $v i32)
    (store.field.memarg ListViewState bk_color (local.get $sw) (local.get $v)))
  (func $lv_text_color (param $sw ptr<ListViewState>) (result i32)
    (load.field.memarg ListViewState text_color (local.get $sw)))
  (func $lv_set_text_color (param $sw ptr<ListViewState>) (param $v i32)
    (store.field.memarg ListViewState text_color (local.get $sw) (local.get $v)))
  (func $lv_text_bk_color (param $sw ptr<ListViewState>) (result i32)
    (load.field.memarg ListViewState text_bk_color (local.get $sw)))
  (func $lv_set_text_bk_color (param $sw ptr<ListViewState>) (param $v i32)
    (store.field.memarg ListViewState text_bk_color (local.get $sw) (local.get $v)))
  (func $lv_state_image_list (param $sw ptr<ListViewState>) (result i32)
    (load.field.memarg ListViewState state_image_list (local.get $sw)))
  (func $lv_set_state_image_list (param $sw ptr<ListViewState>) (param $v i32)
    (store.field.memarg ListViewState state_image_list (local.get $sw) (local.get $v)))
  (func $lv_normal_image_list (param $sw ptr<ListViewState>) (result i32)
    (load.field.memarg ListViewState normal_image_list (local.get $sw)))
  (func $lv_set_normal_image_list (param $sw ptr<ListViewState>) (param $v i32)
    (store.field.memarg ListViewState normal_image_list (local.get $sw) (local.get $v)))

  (func $lv_header_h (param $sw i32) (result i32)
    (if (result i32) (i32.gt_s (call $lv_col_count (local.get $sw)) (i32.const 0))
      (then (i32.const 18))
      (else (i32.const 0))))

  (func $lv_visible_rows_for_h (param $sw i32) (param $h i32) (result i32)
    (local $avail i32) (local $rows i32)
    (local.set $avail (i32.sub (local.get $h) (call $lv_header_h (local.get $sw))))
    (if (i32.lt_s (local.get $avail) (i32.const 16))
      (then (local.set $avail (i32.const 16))))
    (local.set $rows (i32.div_u (local.get $avail) (i32.const 16)))
    (if (i32.eqz (local.get $rows))
      (then (local.set $rows (i32.const 1))))
    (local.get $rows))

  (func $lv_max_scroll_for_h (param $sw i32) (param $h i32) (result i32)
    (local $max i32)
    (local.set $max
      (i32.sub (call $lv_item_count (local.get $sw))
               (call $lv_visible_rows_for_h (local.get $sw) (local.get $h))))
    (if (i32.lt_s (local.get $max) (i32.const 0))
      (then (local.set $max (i32.const 0))))
    (local.get $max))

  (func $lv_content_right_for_size (param $sw i32) (param $w i32) (param $h i32) (result i32)
    (if (i32.and
          (i32.gt_s (call $lv_max_scroll_for_h (local.get $sw) (local.get $h)) (i32.const 0))
          (i32.gt_s (local.get $w) (i32.const 16)))
      (then (return (i32.sub (local.get $w) (i32.const 16)))))
    (local.get $w))

  (func $lv_report_col_width (param $sw i32) (param $idx i32) (result i32)
    (local $col_count i32) (local $width i32)
    (local.set $col_count (call $lv_col_count (local.get $sw)))
    (if (i32.eqz (local.get $col_count))
      (then
        (if (i32.eq (local.get $idx) (i32.const 0))
          (then (return (i32.const 120))))
        (return (i32.const 0))))
    (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                (i32.ge_s (local.get $idx) (local.get $col_count)))
      (then (return (i32.const 0))))
    (local.set $width
      (i32.load
        (i32.add (call $g2w (call $lv_col_widths_ptr (local.get $sw)))
                 (i32.mul (local.get $idx) (i32.const 4)))))
    (if (i32.le_s (local.get $width) (i32.const 0))
      (then (local.set $width (i32.const 80))))
    (local.get $width))

  (func $lv_report_col_left (param $sw i32) (param $idx i32) (result i32)
    (local $i i32) (local $x i32) (local $width i32)
    (local.set $i (i32.const 0))
    (local.set $x (i32.const 0))
    (block $done (loop $cols
      (br_if $done (i32.ge_s (local.get $i) (local.get $idx)))
      (local.set $width (call $lv_report_col_width (local.get $sw) (local.get $i)))
      (if (i32.le_s (local.get $width) (i32.const 0))
        (then (return (local.get $x))))
      (local.set $x (i32.add (local.get $x) (local.get $width)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $cols)))
    (local.get $x))

  (func $lv_report_total_width (param $sw i32) (result i32)
    (local $col_count i32) (local $i i32) (local $x i32) (local $width i32)
    (local.set $col_count (call $lv_col_count (local.get $sw)))
    (if (i32.eqz (local.get $col_count))
      (then (return (i32.const 120))))
    (local.set $i (i32.const 0))
    (local.set $x (i32.const 0))
    (block $done (loop $cols
      (br_if $done (i32.ge_s (local.get $i) (local.get $col_count)))
      (local.set $width (call $lv_report_col_width (local.get $sw) (local.get $i)))
      (if (i32.le_s (local.get $width) (i32.const 0))
        (then (local.set $width (i32.const 80))))
      (local.set $x (i32.add (local.get $x) (local.get $width)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $cols)))
    (local.get $x))

  (func $lv_cell_text_matches (param $cell_g i32) (param $needle_g i32) (param $partial i32) (result i32)
    (local $hay_w i32) (local $needle_w i32) (local $i i32) (local $hc i32) (local $nc i32)
    (if (i32.or (i32.eqz (local.get $cell_g)) (i32.eqz (local.get $needle_g)))
      (then (return (i32.const 0))))
    (local.set $hay_w (call $g2w (local.get $cell_g)))
    (local.set $needle_w (call $g2w (local.get $needle_g)))
    (block $done (loop $scan
      (local.set $hc (i32.load8_u (i32.add (local.get $hay_w) (local.get $i))))
      (local.set $nc (i32.load8_u (i32.add (local.get $needle_w) (local.get $i))))
      (if (i32.eqz (local.get $nc))
        (then
          (if (local.get $partial) (then (return (i32.const 1))))
          (return (select (i32.const 1) (i32.const 0) (i32.eqz (local.get $hc))))))
      (if (i32.eqz (local.get $hc))
        (then (return (i32.const 0))))
      (if (i32.ne (call $tolower (local.get $hc)) (call $tolower (local.get $nc)))
        (then (return (i32.const 0))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  ;; Per-item record, 44 bytes: 8 subitem text pointers, then image (+32),
  ;; lParam (+36) and state (+40). $lv_ensure_item_capacity, the insert and
  ;; delete shifts and the LVM_SETITEMCOUNT clear all stride by 44 too --
  ;; a WAT global would read better, but lib/compile-wat.js only parses
  ;; globals ahead of the functions and silently loses every definition
  ;; after one declared here.
  (func $lv_cell_addr (param $sw i32) (param $item i32) (param $sub i32) (result i32)
    (i32.add
      (call $g2w (call $lv_cells_ptr (local.get $sw)))
      (i32.add
        (i32.mul (local.get $item) (i32.const 44))
        (i32.mul (local.get $sub) (i32.const 4)))))

  (func $lv_item_image_addr (param $sw i32) (param $item i32) (result i32)
    (i32.add
      (call $g2w (call $lv_cells_ptr (local.get $sw)))
      (i32.add (i32.mul (local.get $item) (i32.const 44)) (i32.const 32))))

  (func $lv_item_param_addr (param $sw i32) (param $item i32) (result i32)
    (i32.add
      (call $g2w (call $lv_cells_ptr (local.get $sw)))
      (i32.add (i32.mul (local.get $item) (i32.const 44)) (i32.const 36))))

  ;; THE Win98 check box: a 13x13 sunken well with a black tick. Used by the
  ;; BUTTON painter (BS_CHECKBOX/BS_AUTOCHECKBOX/BS_3STATE) and by list-view
  ;; state images alike — an app supplies the latter as a two-image LVSIL_STATE
  ;; list, but the images are comctl32's own standard check boxes.
  ;;
  ;; This used to be two implementations: this one, and a 12x12 pen-stroked
  ;; copy inside $button_wndproc whose own comment promised to "compose them the
  ;; way the BUTTON painter does". One pixel apart is a visible mismatch when a
  ;; dialog puts a check box and a checked list-view row on the same line.
  (func $paint_check_box (param $hdc i32) (param $x i32) (param $y i32) (param $checked i32)
    (call $paint_check_box_state (local.get $hdc) (local.get $x) (local.get $y)
      (i32.ne (local.get $checked) (i32.const 0))))

  (func $paint_check_box_state (param $hdc i32) (param $x i32) (param $y i32) (param $checked i32)
    (local $i i32)
    (drop (call $gdi_native_fill_rect (local.get $hdc)
      (local.get $x) (local.get $y)
      (i32.add (local.get $x) (i32.const 13)) (i32.add (local.get $y) (i32.const 13))
      (select (i32.const 0x30011) (i32.const 0x30010)
        (i32.eq (local.get $checked) (i32.const 2)))))
    ;; EDGE_SUNKEN (0x0A), BF_RECT (0x0F).
    (drop (call $gdi_native_draw_edge (local.get $hdc)
      (local.get $x) (local.get $y)
      (i32.add (local.get $x) (i32.const 13)) (i32.add (local.get $y) (i32.const 13))
      (i32.const 0x0A) (i32.const 0x0F)))
    (if (local.get $checked)
      (then
        ;; Six 2px strokes: down-right to the elbow, then up-right.
        (block $done (loop $tick
          (br_if $done (i32.ge_s (local.get $i) (i32.const 6)))
          (drop (call $gdi_native_fill_rect (local.get $hdc)
            (i32.add (local.get $x) (i32.add (local.get $i) (i32.const 3)))
            (i32.add (local.get $y)
              (select (i32.add (local.get $i) (i32.const 4))
                      (i32.sub (i32.const 10) (local.get $i))
                      (i32.lt_s (local.get $i) (i32.const 3))))
            (i32.add (local.get $x) (i32.add (local.get $i) (i32.const 4)))
            (i32.add (local.get $y)
              (select (i32.add (local.get $i) (i32.const 6))
                      (i32.sub (i32.const 12) (local.get $i))
                      (i32.lt_s (local.get $i) (i32.const 3))))
            (select (i32.const 0x30012) (i32.const 0x30014)
              (i32.eq (local.get $checked) (i32.const 2)))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $tick))))))

  ;; Complete LVIS_* state for one item. Selection, focus, cut/drop highlight,
  ;; overlay index and state-image index all belong to the item; +32 in the
  ;; control record is only the most recent selection mark.
  (func $lv_item_state_addr (param $sw i32) (param $item i32) (result i32)
    (i32.add
      (call $g2w (call $lv_cells_ptr (local.get $sw)))
      (i32.add (i32.mul (local.get $item) (i32.const 44)) (i32.const 40))))

  (func $lv_find_item_with_state (param $sw i32) (param $after i32) (param $mask i32) (result i32)
    (local $i i32) (local $count i32)
    (local.set $i (i32.add (local.get $after) (i32.const 1)))
    (if (i32.lt_s (local.get $i) (i32.const 0))
      (then (local.set $i (i32.const 0))))
    (local.set $count (call $lv_item_count (local.get $sw)))
    (block $done (loop $items
      (br_if $done (i32.ge_s (local.get $i) (local.get $count)))
      (if (i32.eq
            (i32.and
              (i32.load (call $lv_item_state_addr (local.get $sw) (local.get $i)))
              (local.get $mask))
            (local.get $mask))
        (then (return (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $items)))
    (i32.const -1))

  (func $lv_selected_count (param $sw i32) (result i32)
    (local $i i32) (local $count i32) (local $selected i32)
    (local.set $count (call $lv_item_count (local.get $sw)))
    (block $done (loop $items
      (br_if $done (i32.ge_s (local.get $i) (local.get $count)))
      (if (i32.and
            (i32.load (call $lv_item_state_addr (local.get $sw) (local.get $i)))
            (i32.const 0x0002))
        (then (local.set $selected (i32.add (local.get $selected) (i32.const 1)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $items)))
    (local.get $selected))

  (func $lv_refresh_selection_mark (param $sw i32)
    (local $mark i32)
    (local.set $mark (call $lv_selected (local.get $sw)))
    (if (i32.and
          (i32.and (i32.ge_s (local.get $mark) (i32.const 0))
                   (i32.lt_s (local.get $mark) (call $lv_item_count (local.get $sw))))
          (i32.ne
            (i32.and
              (i32.load (call $lv_item_state_addr (local.get $sw) (local.get $mark)))
              (i32.const 0x0002))
            (i32.const 0)))
      (then (return)))
    (call $lv_set_selected (local.get $sw)
      (call $lv_find_item_with_state (local.get $sw) (i32.const -1) (i32.const 0x0002))))

  (func $lv_ensure_item_capacity (param $sw i32) (param $want i32)
    (local $cap i32) (local $new_cap i32) (local $new_bytes i32)
    (local $old_buf i32) (local $new_buf i32) (local $count i32)
    (local.set $cap (call $lv_item_cap (local.get $sw)))
    (if (i32.le_u (local.get $want) (local.get $cap))
      (then (return)))
    (local.set $new_cap (local.get $cap))
    (if (i32.eqz (local.get $new_cap))
      (then (local.set $new_cap (i32.const 16))))
    (block $grown (loop $grow
      (br_if $grown (i32.le_u (local.get $want) (local.get $new_cap)))
      (local.set $new_cap (i32.mul (local.get $new_cap) (i32.const 2)))
      (br $grow)))
    (local.set $new_bytes (i32.mul (local.get $new_cap) (i32.const 44)))
    (local.set $new_buf (call $heap_alloc (local.get $new_bytes)))
    (call $zero_memory (call $g2w (local.get $new_buf)) (local.get $new_bytes))
    (local.set $old_buf (call $lv_cells_ptr (local.get $sw)))
    (local.set $count (call $lv_item_count (local.get $sw)))
    (if (local.get $old_buf)
      (then
        (if (local.get $count)
          (then
            (call $memcpy (call $g2w (local.get $new_buf))
                          (call $g2w (local.get $old_buf))
                          (i32.mul (local.get $count) (i32.const 44)))))))
    (call $heap_free (local.get $old_buf))
    (call $lv_set_item_cap (local.get $sw) (local.get $new_cap))
    (call $lv_set_cells_ptr (local.get $sw) (local.get $new_buf)))

  (func $lv_ensure_col_capacity (param $sw i32) (param $want i32)
    (local $cap i32) (local $new_cap i32) (local $new_bytes i32)
    (local $old_widths i32) (local $old_texts i32)
    (local $new_widths i32) (local $new_texts i32) (local $count i32)
    (local.set $cap (call $lv_col_cap (local.get $sw)))
    (if (i32.le_u (local.get $want) (local.get $cap))
      (then (return)))
    (local.set $new_cap (local.get $cap))
    (if (i32.eqz (local.get $new_cap))
      (then (local.set $new_cap (i32.const 4))))
    (block $grown (loop $grow
      (br_if $grown (i32.le_u (local.get $want) (local.get $new_cap)))
      (local.set $new_cap (i32.mul (local.get $new_cap) (i32.const 2)))
      (br $grow)))
    (local.set $new_bytes (i32.mul (local.get $new_cap) (i32.const 4)))
    (local.set $new_widths (call $heap_alloc (local.get $new_bytes)))
    (local.set $new_texts (call $heap_alloc (local.get $new_bytes)))
    (call $zero_memory (call $g2w (local.get $new_widths)) (local.get $new_bytes))
    (call $zero_memory (call $g2w (local.get $new_texts)) (local.get $new_bytes))
    (local.set $old_widths (call $lv_col_widths_ptr (local.get $sw)))
    (local.set $old_texts (call $lv_col_texts_ptr (local.get $sw)))
    (local.set $count (call $lv_col_count (local.get $sw)))
    (if (local.get $old_widths)
      (then
        (if (local.get $count)
          (then
            (call $memcpy (call $g2w (local.get $new_widths))
                          (call $g2w (local.get $old_widths))
                          (i32.mul (local.get $count) (i32.const 4)))))))
    (if (local.get $old_texts)
      (then
        (if (local.get $count)
          (then
            (call $memcpy (call $g2w (local.get $new_texts))
                          (call $g2w (local.get $old_texts))
                          (i32.mul (local.get $count) (i32.const 4)))))))
    (call $heap_free (local.get $old_widths))
    (call $heap_free (local.get $old_texts))
    (call $lv_set_col_cap (local.get $sw) (local.get $new_cap))
    (call $lv_set_col_widths_ptr (local.get $sw) (local.get $new_widths))
    (call $lv_set_col_texts_ptr (local.get $sw) (local.get $new_texts)))

  (func $lv_set_cell_text (param $sw i32) (param $item i32) (param $sub i32) (param $src_g i32)
    (local $cell i32) (local $old i32) (local $copy_g i32)
    (if (i32.or
          (i32.or (i32.lt_s (local.get $item) (i32.const 0))
                  (i32.ge_s (local.get $item) (call $lv_item_count (local.get $sw))))
          (i32.or (i32.lt_s (local.get $sub) (i32.const 0))
                  (i32.ge_s (local.get $sub) (i32.const 8))))
      (then (return)))
    (local.set $cell (call $lv_cell_addr (local.get $sw) (local.get $item) (local.get $sub)))
    (local.set $old (i32.load (local.get $cell)))
    (if (local.get $old)
      (then (call $heap_free (local.get $old))))
    (i32.store (local.get $cell) (i32.const 0))
    (if (i32.or (i32.eqz (local.get $src_g)) (i32.eq (local.get $src_g) (i32.const -1)))
      (then (return)))
    (local.set $copy_g (call $guest_strdup (local.get $src_g)))
    (i32.store (local.get $cell) (local.get $copy_g)))

  (func $lv_set_col_text (param $sw i32) (param $idx i32) (param $src_g i32)
    (local $cell i32) (local $old i32) (local $copy_g i32)
    (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                (i32.ge_s (local.get $idx) (call $lv_col_count (local.get $sw))))
      (then (return)))
    (if (i32.eqz (call $lv_col_texts_ptr (local.get $sw)))
      (then (return)))
    (local.set $cell
      (i32.add (call $g2w (call $lv_col_texts_ptr (local.get $sw)))
               (i32.mul (local.get $idx) (i32.const 4))))
    (local.set $old (i32.load (local.get $cell)))
    (if (local.get $old)
      (then (call $heap_free (local.get $old))))
    (i32.store (local.get $cell) (i32.const 0))
    (if (i32.or (i32.eqz (local.get $src_g)) (i32.eq (local.get $src_g) (i32.const -1)))
      (then (return)))
    (local.set $copy_g (call $guest_strdup (local.get $src_g)))
    (i32.store (local.get $cell) (local.get $copy_g)))

  (func $lv_copy_cell_text
    (param $sw i32) (param $item i32) (param $sub i32) (param $dest_g i32) (param $max i32) (result i32)
    (local $src_g i32) (local $src_w i32) (local $dest_w i32) (local $len i32)
    (if (i32.or
          (i32.or (i32.le_u (local.get $max) (i32.const 0))
                  (i32.eqz (local.get $dest_g)))
          (i32.or (i32.lt_s (local.get $item) (i32.const 0))
                  (i32.ge_s (local.get $item) (call $lv_item_count (local.get $sw)))))
      (then (return (i32.const 0))))
    (if (i32.or (i32.lt_s (local.get $sub) (i32.const 0))
                (i32.ge_s (local.get $sub) (i32.const 8)))
      (then (return (i32.const 0))))
    (local.set $dest_w (call $g2w (local.get $dest_g)))
    (local.set $src_g (i32.load (call $lv_cell_addr (local.get $sw) (local.get $item) (local.get $sub))))
    (if (i32.eqz (local.get $src_g))
      (then
        (i32.store8 (local.get $dest_w) (i32.const 0))
        (return (i32.const 0))))
    (local.set $src_w (call $g2w (local.get $src_g)))
    (local.set $len (call $strlen (local.get $src_w)))
    (if (i32.ge_u (local.get $len) (local.get $max))
      (then (local.set $len (i32.sub (local.get $max) (i32.const 1)))))
    (if (local.get $len)
      (then (call $memcpy (local.get $dest_w) (local.get $src_w) (local.get $len))))
    (i32.store8 (i32.add (local.get $dest_w) (local.get $len)) (i32.const 0))
    (local.get $len))

  (func $lv_clear_items (param $hwnd i32) (param $sw i32)
    (local $count i32) (local $i i32) (local $sub i32) (local $cell i32) (local $ptr i32)
    (local.set $count (call $lv_item_count (local.get $sw)))
    (local.set $i (i32.const 0))
    (block $done (loop $items
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $sub (i32.const 0))
      (block $subs_done (loop $subs
        (br_if $subs_done (i32.ge_u (local.get $sub) (i32.const 8)))
        (local.set $cell (call $lv_cell_addr (local.get $sw) (local.get $i) (local.get $sub)))
        (local.set $ptr (i32.load (local.get $cell)))
        (if (local.get $ptr) (then (call $heap_free (local.get $ptr))))
        (i32.store (local.get $cell) (i32.const 0))
        (local.set $sub (i32.add (local.get $sub) (i32.const 1)))
        (br $subs)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $items)))
    (call $lv_set_item_count (local.get $sw) (i32.const 0))
    (call $lv_set_selected (local.get $sw) (i32.const -1))
    (drop (call $lv_scroll_to_for_h
      (local.get $hwnd) (local.get $sw) (call $ctrl_get_h (local.get $hwnd)) (i32.const 0))))

  (func $lv_free_row_text (param $sw i32) (param $idx i32)
    (local $sub i32) (local $cell i32) (local $ptr i32)
    (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                (i32.ge_s (local.get $idx) (call $lv_item_count (local.get $sw))))
      (then (return)))
    (local.set $sub (i32.const 0))
    (block $done (loop $subs
      (br_if $done (i32.ge_u (local.get $sub) (i32.const 8)))
      (local.set $cell (call $lv_cell_addr (local.get $sw) (local.get $idx) (local.get $sub)))
      (local.set $ptr (i32.load (local.get $cell)))
      (if (local.get $ptr) (then (call $heap_free (local.get $ptr))))
      (i32.store (local.get $cell) (i32.const 0))
      (local.set $sub (i32.add (local.get $sub) (i32.const 1)))
      (br $subs))))

  (func $lv_delete_item (param $hwnd i32) (param $sw i32) (param $idx i32) (result i32)
    (local $count i32) (local $tail i32) (local $selected i32) (local $h i32)
    (local.set $count (call $lv_item_count (local.get $sw)))
    (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                (i32.ge_s (local.get $idx) (local.get $count)))
      (then (return (i32.const 0))))
    (local.set $selected (call $lv_selected (local.get $sw)))
    (call $lv_free_row_text (local.get $sw) (local.get $idx))
    (local.set $tail (i32.sub (i32.sub (local.get $count) (local.get $idx)) (i32.const 1)))
    (if (i32.gt_s (local.get $tail) (i32.const 0))
      (then
        (call $memcpy
          (call $lv_cell_addr (local.get $sw) (local.get $idx) (i32.const 0))
          (call $lv_cell_addr (local.get $sw) (i32.add (local.get $idx) (i32.const 1)) (i32.const 0))
          (i32.mul (local.get $tail) (i32.const 44)))))
    (call $zero_memory
      (call $lv_cell_addr (local.get $sw) (i32.sub (local.get $count) (i32.const 1)) (i32.const 0))
      (i32.const 44))
    (call $lv_set_item_count (local.get $sw) (i32.sub (local.get $count) (i32.const 1)))
    (if (i32.gt_s (local.get $selected) (local.get $idx))
      (then (call $lv_set_selected (local.get $sw) (i32.sub (local.get $selected) (i32.const 1)))))
    (if (i32.eq (local.get $selected) (local.get $idx))
      (then
        (call $lv_set_selected (local.get $sw) (i32.const -1))
        (call $lv_refresh_selection_mark (local.get $sw))))
    (local.set $h (call $ctrl_get_h (local.get $hwnd)))
    (drop (call $lv_scroll_to_for_h
      (local.get $hwnd) (local.get $sw) (local.get $h) (call $lv_top_index (local.get $sw))))
    (call $paint_flag_set_inv (local.get $hwnd))
    (i32.const 1))

  (func $lv_clear_columns (param $sw i32)
    (local $count i32) (local $i i32) (local $texts_w i32) (local $ptr i32)
    (local.set $count (call $lv_col_count (local.get $sw)))
    (if (i32.eqz (call $lv_col_texts_ptr (local.get $sw)))
      (then
        (call $lv_set_col_count (local.get $sw) (i32.const 0))
        (return)))
    (local.set $texts_w (call $g2w (call $lv_col_texts_ptr (local.get $sw))))
    (local.set $i (i32.const 0))
    (block $done (loop $cols
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $ptr (i32.load (i32.add (local.get $texts_w) (i32.mul (local.get $i) (i32.const 4)))))
      (if (local.get $ptr) (then (call $heap_free (local.get $ptr))))
      (i32.store (i32.add (local.get $texts_w) (i32.mul (local.get $i) (i32.const 4))) (i32.const 0))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $cols)))
    (call $lv_set_col_count (local.get $sw) (i32.const 0)))

  (func $lv_delete_column (param $hwnd i32) (param $sw i32) (param $idx i32) (result i32)
    (local $col_count i32) (local $row_count i32) (local $i i32) (local $sub i32)
    (local $widths_w i32) (local $texts_w i32) (local $ptr i32)
    (local.set $col_count (call $lv_col_count (local.get $sw)))
    (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                (i32.ge_s (local.get $idx) (local.get $col_count)))
      (then (return (i32.const 0))))
    (local.set $widths_w (call $g2w (call $lv_col_widths_ptr (local.get $sw))))
    (local.set $texts_w (call $g2w (call $lv_col_texts_ptr (local.get $sw))))
    (local.set $ptr (i32.load (i32.add (local.get $texts_w) (i32.mul (local.get $idx) (i32.const 4)))))
    (if (local.get $ptr) (then (call $heap_free (local.get $ptr))))
    ;; Close the hole at $idx: columns (idx, col_count) move down one slot. The
    ;; ranges overlap with the destination BELOW the source, which memory.copy
    ;; handles because it is specified as memmove -- one $memcpy per array. The
    ;; guard above bounds $idx to [0, col_count), so the length is never
    ;; negative and is zero exactly when $idx is the last column.
    (call $memcpy
      (i32.add (local.get $widths_w) (i32.mul (local.get $idx) (i32.const 4)))
      (i32.add (local.get $widths_w) (i32.mul (i32.add (local.get $idx) (i32.const 1)) (i32.const 4)))
      (i32.mul (i32.sub (i32.sub (local.get $col_count) (local.get $idx)) (i32.const 1)) (i32.const 4)))
    (call $memcpy
      (i32.add (local.get $texts_w) (i32.mul (local.get $idx) (i32.const 4)))
      (i32.add (local.get $texts_w) (i32.mul (i32.add (local.get $idx) (i32.const 1)) (i32.const 4)))
      (i32.mul (i32.sub (i32.sub (local.get $col_count) (local.get $idx)) (i32.const 1)) (i32.const 4)))
    (i32.store
      (i32.add (local.get $widths_w) (i32.mul (i32.sub (local.get $col_count) (i32.const 1)) (i32.const 4)))
      (i32.const 0))
    (i32.store
      (i32.add (local.get $texts_w) (i32.mul (i32.sub (local.get $col_count) (i32.const 1)) (i32.const 4)))
      (i32.const 0))
    (if (i32.lt_s (local.get $idx) (i32.const 8))
      (then
        (local.set $row_count (call $lv_item_count (local.get $sw)))
        (local.set $i (i32.const 0))
        (block $rows_done (loop $rows
          (br_if $rows_done (i32.ge_s (local.get $i) (local.get $row_count)))
          (local.set $ptr (i32.load (call $lv_cell_addr (local.get $sw) (local.get $i) (local.get $idx))))
          (if (local.get $ptr) (then (call $heap_free (local.get $ptr))))
          (local.set $sub (local.get $idx))
          (block $subs_done (loop $subs
            (br_if $subs_done (i32.ge_s (local.get $sub) (i32.const 7)))
            (i32.store
              (call $lv_cell_addr (local.get $sw) (local.get $i) (local.get $sub))
              (i32.load (call $lv_cell_addr (local.get $sw) (local.get $i) (i32.add (local.get $sub) (i32.const 1)))))
            (local.set $sub (i32.add (local.get $sub) (i32.const 1)))
            (br $subs)))
          (i32.store (call $lv_cell_addr (local.get $sw) (local.get $i) (i32.const 7)) (i32.const 0))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $rows)))))
    (call $lv_set_col_count (local.get $sw) (i32.sub (local.get $col_count) (i32.const 1)))
    (call $paint_flag_set_inv (local.get $hwnd))
    (i32.const 1))

  (func $lv_scroll_to_for_h (param $hwnd i32) (param $sw i32) (param $h i32) (param $row i32) (result i32)
    (local $max i32)
    (local.set $max (call $lv_max_scroll_for_h (local.get $sw) (local.get $h)))
    (if (i32.lt_s (local.get $row) (i32.const 0))
      (then (local.set $row (i32.const 0))))
    (if (i32.gt_s (local.get $row) (local.get $max))
      (then (local.set $row (local.get $max))))
    (call $lv_set_top_index (local.get $sw) (local.get $row))
    (call $scroll_publish_vertical_info
      (local.get $hwnd) (local.get $row)
      (call $lv_item_count (local.get $sw))
      (call $lv_visible_rows_for_h (local.get $sw) (local.get $h)))
    (local.get $row))

  (func $lv_scroll_by (param $hwnd i32) (param $delta i32) (result i32)
    (local $state i32) (local $sw i32) (local $sz i32) (local $h i32)
    (local $old_top i32) (local $new_top i32)
    (local.set $state (call $wnd_get_state_ptr (local.get $hwnd)))
    (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
    (local.set $sw (call $g2w (local.get $state)))
    (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
    (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
    (local.set $old_top (call $lv_top_index (local.get $sw)))
    (local.set $new_top
      (call $lv_scroll_to_for_h
        (local.get $hwnd) (local.get $sw) (local.get $h)
        (i32.add (local.get $old_top) (local.get $delta))))
    (if (i32.ne (local.get $new_top) (local.get $old_top))
      (then (call $paint_flag_set_inv (local.get $hwnd))))
    (local.get $new_top))

  (func $lv_notify_simple (param $hwnd i32) (param $code i32)
    (local $parent i32) (local $notify_g i32) (local $notify_w i32)
    (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
    (if (i32.eqz (local.get $parent)) (then (return)))
    (local.set $notify_g (call $heap_alloc (i32.const 12)))
    (if (i32.eqz (local.get $notify_g)) (then (return)))
    (local.set $notify_w (call $g2w (local.get $notify_g)))
    (i32.store          (local.get $notify_w) (local.get $hwnd))
    (i32.store offset=4 (local.get $notify_w) (call $ctrl_table_get_id (local.get $hwnd)))
    (i32.store offset=8 (local.get $notify_w) (local.get $code))
    (global.set $lv_debug_notify_count (i32.add (global.get $lv_debug_notify_count) (i32.const 1)))
    (global.set $lv_debug_notify_code (local.get $code))
    (global.set $lv_debug_notify_item (i32.const -1))
    (global.set $lv_debug_notify_old_state (i32.const 0))
    (global.set $lv_debug_notify_new_state (i32.const 0))
    (drop (call $wnd_send_message
      (local.get $parent) (i32.const 0x004E)
      (call $ctrl_table_get_id (local.get $hwnd))
      (local.get $notify_g)))
    (call $heap_free (local.get $notify_g)))

  (func $lv_notify_item_state
    (param $hwnd i32) (param $item i32) (param $old_state i32) (param $new_state i32) (param $code i32) (result i32)
    (local $parent i32) (local $notify_g i32) (local $notify_w i32) (local $ret i32)
    (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
    (if (i32.eqz (local.get $parent)) (then (return (i32.const 0))))
    (local.set $notify_g (call $heap_alloc (i32.const 44)))
    (if (i32.eqz (local.get $notify_g)) (then (return (i32.const 0))))
    (local.set $notify_w (call $g2w (local.get $notify_g)))
    (call $zero_memory (local.get $notify_w) (i32.const 44))
    (i32.store          (local.get $notify_w) (local.get $hwnd))
    (i32.store offset=4 (local.get $notify_w) (call $ctrl_table_get_id (local.get $hwnd)))
    (i32.store offset=8 (local.get $notify_w) (local.get $code))
    (i32.store offset=12 (local.get $notify_w) (local.get $item))
    (i32.store offset=16 (local.get $notify_w) (i32.const 0))
    (i32.store offset=20 (local.get $notify_w) (local.get $new_state))
    (i32.store offset=24 (local.get $notify_w) (local.get $old_state))
    (i32.store offset=28 (local.get $notify_w) (i32.const 0x0008)) ;; LVIF_STATE
    (global.set $lv_debug_notify_count (i32.add (global.get $lv_debug_notify_count) (i32.const 1)))
    (global.set $lv_debug_notify_code (local.get $code))
    (global.set $lv_debug_notify_item (local.get $item))
    (global.set $lv_debug_notify_old_state (local.get $old_state))
    (global.set $lv_debug_notify_new_state (local.get $new_state))
    (local.set $ret (call $wnd_send_message
      (local.get $parent) (i32.const 0x004E)
      (call $ctrl_table_get_id (local.get $hwnd))
      (local.get $notify_g)))
    (call $heap_free (local.get $notify_g))
    (local.get $ret))

  ;; Apply one LVITEM.state/stateMask pair. The record at +40 is authoritative;
  ;; the control-level selection mark merely remembers the most recently
  ;; selected row. Win98 enforces one focused item, and LVS_SINGLESEL enforces
  ;; one selected item, by clearing the old row as part of the same operation.
  ;; Broadcast callers can request LVN_ITEMCHANGING even for an unchanged row,
  ;; which is what Win98 comctl32 does while walking a normal multi-select list.
  (func $lv_change_item_state
    (param $hwnd i32) (param $sw i32) (param $idx i32)
    (param $state i32) (param $mask i32)
    (param $exclusive_selection i32) (param $notify_unchanged i32) (result i32)
    (local $old_state i32) (local $new_state i32) (local $unique_mask i32)
    (local $i i32) (local $other_state i32) (local $other_new i32)
    (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                (i32.ge_s (local.get $idx) (call $lv_item_count (local.get $sw))))
      (then (return (i32.const 0))))
    (local.set $old_state
      (i32.load (call $lv_item_state_addr (local.get $sw) (local.get $idx))))
    (local.set $new_state
      (i32.or
        (i32.and (local.get $old_state) (i32.xor (local.get $mask) (i32.const -1)))
        (i32.and (local.get $state) (local.get $mask))))

    ;; Ask the parent about the requested row before disturbing any row whose
    ;; unique focus/selection would have to be cleared for it.
    (if (i32.or (local.get $notify_unchanged)
                (i32.ne (local.get $old_state) (local.get $new_state)))
      (then
        (if (call $lv_notify_item_state
              (local.get $hwnd) (local.get $idx)
              (i32.and (local.get $old_state) (local.get $mask))
              (i32.and (local.get $new_state) (local.get $mask))
              (i32.const -100)) ;; LVN_ITEMCHANGINGA
          (then (return (i32.const 0))))))

    (local.set $unique_mask (i32.const 0))
    (if (i32.and (local.get $state)
          (i32.and (local.get $mask) (i32.const 0x0001))) ;; LVIS_FOCUSED
      (then (local.set $unique_mask (i32.or (local.get $unique_mask) (i32.const 0x0001)))))
    (if (i32.and
          (i32.ne
            (i32.and (local.get $state)
                     (i32.and (local.get $mask) (i32.const 0x0002)))
            (i32.const 0))
          (i32.or
            (local.get $exclusive_selection)
            (i32.ne (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x0004))
                    (i32.const 0)))) ;; LVS_SINGLESEL
      (then (local.set $unique_mask (i32.or (local.get $unique_mask) (i32.const 0x0002)))))

    ;; Clear unique bits on every other row. Notify only rows that really lose
    ;; state; native comctl32 does not fabricate ITEMCHANGED for no-op rows.
    (if (local.get $unique_mask)
      (then
        (local.set $i (i32.const 0))
        (block $unique_done (loop $unique_rows
          (br_if $unique_done (i32.ge_s (local.get $i) (call $lv_item_count (local.get $sw))))
          (if (i32.ne (local.get $i) (local.get $idx))
            (then
              (local.set $other_state
                (i32.load (call $lv_item_state_addr (local.get $sw) (local.get $i))))
              (local.set $other_new
                (i32.and (local.get $other_state)
                         (i32.xor (local.get $unique_mask) (i32.const -1))))
              (if (i32.ne (local.get $other_state) (local.get $other_new))
                (then
                  (if (call $lv_notify_item_state
                        (local.get $hwnd) (local.get $i)
                        (i32.and (local.get $other_state) (local.get $unique_mask))
                        (i32.const 0) (i32.const -100))
                    (then (return (i32.const 0))))
                  (i32.store
                    (call $lv_item_state_addr (local.get $sw) (local.get $i))
                    (local.get $other_new))
                  (drop (call $lv_notify_item_state
                    (local.get $hwnd) (local.get $i)
                    (i32.and (local.get $other_state) (local.get $unique_mask))
                    (i32.const 0) (i32.const -101)))))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $unique_rows)))))

    (if (i32.ne (local.get $old_state) (local.get $new_state))
      (then
        (i32.store (call $lv_item_state_addr (local.get $sw) (local.get $idx))
          (local.get $new_state))
        (drop (call $lv_notify_item_state
          (local.get $hwnd) (local.get $idx)
          (i32.and (local.get $old_state) (local.get $mask))
          (i32.and (local.get $new_state) (local.get $mask))
          (i32.const -101))))) ;; LVN_ITEMCHANGEDA

    (if (i32.and (local.get $mask) (i32.const 0x0002))
      (then
        (if (i32.and (local.get $state) (i32.const 0x0002))
          (then (call $lv_set_selected (local.get $sw) (local.get $idx)))
          (else (call $lv_refresh_selection_mark (local.get $sw))))))
    (i32.const 1))

  (func $lv_select_item (param $hwnd i32) (param $sw i32) (param $idx i32) (result i32)
    (if (i32.and
          (i32.ne (local.get $idx) (i32.const -1))
          (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                  (i32.ge_s (local.get $idx) (call $lv_item_count (local.get $sw)))))
      (then (return (i32.const 0))))
    (if (i32.eq (local.get $idx) (i32.const -1))
      (then
        (block $clear_done (loop $clear_selected
          (local.set $idx
            (call $lv_find_item_with_state (local.get $sw) (i32.const -1) (i32.const 0x0002)))
          (br_if $clear_done (i32.lt_s (local.get $idx) (i32.const 0)))
          (if (i32.eqz (call $lv_change_item_state
                (local.get $hwnd) (local.get $sw) (local.get $idx)
                (i32.const 0) (i32.const 0x0002) (i32.const 0) (i32.const 0)))
            (then (return (i32.const 0))))
          (br $clear_selected)))
        (call $lv_set_selected (local.get $sw) (i32.const -1))
        (return (i32.const 1))))
    (call $lv_change_item_state
      (local.get $hwnd) (local.get $sw) (local.get $idx)
      (i32.const 0x0002) (i32.const 0x0002) (i32.const 1) (i32.const 0)))

  (func $lv_paint_report_icon
    (param $hdc i32) (param $sw i32) (param $row i32) (param $x i32) (param $y i32) (result i32)
    (local $img_list i32) (local $img_idx i32) (local $img_sw i32)
    (local $img_cx i32) (local $img_cy i32) (local $img_count i32) (local $img_bmp i32)
    (local $img_bmp_w i32) (local $img_bmp_h i32) (local $img_src_x i32)
    (local $img_draw_w i32) (local $img_draw_h i32) (local $img_dst_y i32)
    (local $img_memdc i32) (local $ret i32)
    (local.set $img_list (call $lv_image_list (local.get $sw)))
    (if (i32.eqz (local.get $img_list)) (then (return (i32.const 0))))
    (local.set $img_idx (i32.load (call $lv_item_image_addr (local.get $sw) (local.get $row))))
    (if (i32.lt_s (local.get $img_idx) (i32.const 0)) (then (return (i32.const 0))))
    (local.set $img_sw (call $g2w (local.get $img_list)))
    (local.set $img_cx (i32.load (local.get $img_sw)))
    (local.set $img_cy (i32.load offset=4 (local.get $img_sw)))
    (local.set $img_count (i32.load offset=12 (local.get $img_sw)))
    (local.set $img_bmp (i32.load offset=16 (local.get $img_sw)))
    (if (i32.or
          (i32.or (i32.le_s (local.get $img_cx) (i32.const 0))
                  (i32.le_s (local.get $img_cy) (i32.const 0)))
          (i32.or (i32.le_s (local.get $img_count) (local.get $img_idx))
                  (i32.eqz (local.get $img_bmp))))
      (then (return (i32.const 0))))
    (local.set $img_bmp_w (call $gdi_native_get_object_w (local.get $img_bmp)))
    (local.set $img_bmp_h (call $gdi_native_get_object_h (local.get $img_bmp)))
    (local.set $img_src_x (i32.mul (local.get $img_idx) (local.get $img_cx)))
    (if (i32.or
          (i32.gt_s (i32.add (local.get $img_src_x) (local.get $img_cx)) (local.get $img_bmp_w))
          (i32.gt_s (local.get $img_cy) (local.get $img_bmp_h)))
      (then (return (i32.const 0))))
    (local.set $img_draw_w (local.get $img_cx))
    (if (i32.gt_s (local.get $img_draw_w) (i32.const 16))
      (then (local.set $img_draw_w (i32.const 16))))
    (local.set $img_draw_h (local.get $img_cy))
    (if (i32.gt_s (local.get $img_draw_h) (i32.const 16))
      (then (local.set $img_draw_h (i32.const 16))))
    (local.set $img_dst_y
      (i32.add (local.get $y)
        (i32.div_s (i32.sub (i32.const 16) (local.get $img_draw_h)) (i32.const 2))))
    (local.set $img_memdc (call $gdi_native_create_compat_dc (local.get $hdc)))
    (if (i32.eqz (local.get $img_memdc)) (then (return (i32.const 0))))
    (drop (call $gdi_native_select_object (local.get $img_memdc) (local.get $img_bmp)))
    (local.set $ret
      (call $gdi_native_transparent_blt
        (local.get $hdc)
        (i32.add (local.get $x) (i32.const 4)) (local.get $img_dst_y)
        (local.get $img_draw_w) (local.get $img_draw_h)
        (local.get $img_memdc)
        (local.get $img_src_x) (i32.const 0)
        (i32.load offset=20 (local.get $img_sw))))
    (drop (call $gdi_native_delete_dc (local.get $img_memdc)))
    (local.get $ret))

  (func $lv_paint_normal_icon
    (param $hdc i32) (param $sw i32) (param $row i32) (param $x i32) (param $y i32) (result i32)
    (local $img_list i32) (local $img_idx i32) (local $img_sw i32)
    (local $img_cx i32) (local $img_cy i32) (local $img_count i32) (local $img_bmp i32)
    (local $img_bmp_w i32) (local $img_bmp_h i32) (local $img_src_x i32)
    (local $draw_w i32) (local $draw_h i32) (local $dst_x i32) (local $dst_y i32)
    (local $memdc i32) (local $image_dc i32) (local $mask_dc i32)
    (local $stock_himl i32) (local $ret i32)
    (local.set $img_list (call $lv_normal_image_list (local.get $sw)))
    (if (i32.eqz (local.get $img_list))
      (then (local.set $img_list (call $lv_image_list (local.get $sw)))))
    (if (i32.eqz (local.get $img_list)) (then (return (i32.const 0))))
    (local.set $img_idx (i32.load (call $lv_item_image_addr (local.get $sw) (local.get $row))))
    (if (i32.lt_s (local.get $img_idx) (i32.const 0)) (then (return (i32.const 0))))
    (local.set $img_sw (call $g2w (local.get $img_list)))
    (local.set $stock_himl
      (i32.eq (i32.load (local.get $img_sw)) (i32.const 0x4C4D4948))) ;; "HIML"
    (if (local.get $stock_himl)
      (then
        ;; Authentic Win98 COMCTL32 image-list object. The stock DLL keeps
        ;; ready-to-blit colour/mask DCs in the object, as TreeView already
        ;; consumes, rather than our bounded bitmap-strip wrapper.
        (local.set $img_count (i32.load offset=4 (local.get $img_sw)))
        (local.set $img_cx (i32.load offset=16 (local.get $img_sw)))
        (local.set $img_cy (i32.load offset=20 (local.get $img_sw)))
        (local.set $image_dc (i32.load offset=56 (local.get $img_sw)))
        (local.set $mask_dc (i32.load offset=60 (local.get $img_sw))))
      (else
        (local.set $img_cx (i32.load (local.get $img_sw)))
        (local.set $img_cy (i32.load offset=4 (local.get $img_sw)))
        (local.set $img_count (i32.load offset=12 (local.get $img_sw)))
        (local.set $img_bmp (i32.load offset=16 (local.get $img_sw)))))
    (if (i32.or
          (i32.or (i32.le_s (local.get $img_cx) (i32.const 0))
                  (i32.or (i32.le_s (local.get $img_cy) (i32.const 0))
                          (i32.gt_s (local.get $img_cx) (i32.const 256))))
          (i32.or (i32.le_s (local.get $img_count) (local.get $img_idx))
                  (i32.and (i32.eqz (local.get $image_dc))
                           (i32.eqz (local.get $img_bmp)))))
      (then (return (i32.const 0))))
    (local.set $img_src_x (i32.mul (local.get $img_idx) (local.get $img_cx)))
    (if (local.get $img_bmp)
      (then
        (local.set $img_bmp_w (call $gdi_native_get_object_w (local.get $img_bmp)))
        (local.set $img_bmp_h (call $gdi_native_get_object_h (local.get $img_bmp)))
        (if (i32.or
              (i32.gt_s (i32.add (local.get $img_src_x) (local.get $img_cx)) (local.get $img_bmp_w))
              (i32.gt_s (local.get $img_cy) (local.get $img_bmp_h)))
          (then (return (i32.const 0))))))
    (local.set $draw_w (local.get $img_cx))
    (if (i32.gt_s (local.get $draw_w) (i32.const 32))
      (then (local.set $draw_w (i32.const 32))))
    (local.set $draw_h (local.get $img_cy))
    (if (i32.gt_s (local.get $draw_h) (i32.const 32))
      (then (local.set $draw_h (i32.const 32))))
    (local.set $dst_x (i32.add (local.get $x)
      (i32.div_s (i32.sub (i32.const 32) (local.get $draw_w)) (i32.const 2))))
    (local.set $dst_y (i32.add (local.get $y)
      (i32.div_s (i32.sub (i32.const 32) (local.get $draw_h)) (i32.const 2))))
    (if (local.get $image_dc)
      (then
        (if (local.get $mask_dc)
          (then
            (drop (call $gdi_native_bitblt
              (local.get $hdc) (local.get $dst_x) (local.get $dst_y)
              (local.get $draw_w) (local.get $draw_h)
              (local.get $mask_dc) (local.get $img_src_x) (i32.const 0)
              (i32.const 0x008800C6))) ;; SRCAND
            (local.set $ret (call $gdi_native_bitblt
              (local.get $hdc) (local.get $dst_x) (local.get $dst_y)
              (local.get $draw_w) (local.get $draw_h)
              (local.get $image_dc) (local.get $img_src_x) (i32.const 0)
              (i32.const 0x00EE0086)))) ;; SRCPAINT
          (else
            (local.set $ret (call $gdi_native_bitblt
              (local.get $hdc) (local.get $dst_x) (local.get $dst_y)
              (local.get $draw_w) (local.get $draw_h)
              (local.get $image_dc) (local.get $img_src_x) (i32.const 0)
              (i32.const 0x00CC0020)))))) ;; SRCCOPY
      (else
        (local.set $memdc (call $gdi_native_create_compat_dc (local.get $hdc)))
        (if (i32.eqz (local.get $memdc)) (then (return (i32.const 0))))
        (drop (call $gdi_native_select_object (local.get $memdc) (local.get $img_bmp)))
        (local.set $ret (call $gdi_native_transparent_blt
          (local.get $hdc) (local.get $dst_x) (local.get $dst_y)
          (local.get $draw_w) (local.get $draw_h)
          (local.get $memdc) (local.get $img_src_x) (i32.const 0)
          (i32.load offset=20 (local.get $img_sw))))
        (drop (call $gdi_native_delete_dc (local.get $memdc)))))
    (local.get $ret))

  ;; Resolve LPSTR_TEXTCALLBACKA/I_IMAGECALLBACK while the item is inserted.
  ;; The stock desktop DefView uses both callbacks: it owns the PIDLs and lets
  ;; SysListView32 ask for the visible names and system-image-list indices.
  ;; Retain private values exactly as the TreeView callback path does so later
  ;; paints never depend on the parent's temporary NMLVDISPINFO buffer.
  (func $lv_resolve_insert_callbacks
      (param $hwnd i32) (param $sw i32) (param $item i32)
      (param $want_text i32) (param $want_image i32)
    (local $parent i32) (local $notify_g i32) (local $notify_w i32)
    (local $mask i32) (local $text_g i32)
    (if (i32.eqz (i32.or (local.get $want_text) (local.get $want_image)))
      (then (return)))
    (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
    (if (i32.eqz (local.get $parent)) (then (return)))
    ;; NMLVDISPINFOA (NMHDR + LVITEMA = 52 bytes), followed by MAX_PATH.
    (local.set $notify_g (call $heap_alloc (i32.const 312)))
    (if (i32.eqz (local.get $notify_g)) (then (return)))
    (local.set $notify_w (call $g2w (local.get $notify_g)))
    (call $zero_memory (local.get $notify_w) (i32.const 312))
    (local.set $mask (i32.const 0x0004)) ;; LVIF_PARAM
    (if (local.get $want_text)
      (then (local.set $mask (i32.or (local.get $mask) (i32.const 0x0001)))))
    (if (local.get $want_image)
      (then (local.set $mask (i32.or (local.get $mask) (i32.const 0x0002)))))
    ;; NMHDR.
    (i32.store          (local.get $notify_w) (local.get $hwnd))
    (i32.store offset=4 (local.get $notify_w) (call $ctrl_table_get_id (local.get $hwnd)))
    (i32.store offset=8 (local.get $notify_w) (i32.const -150)) ;; LVN_GETDISPINFOA
    ;; LVITEMA at +12.
    (i32.store offset=12 (local.get $notify_w) (local.get $mask))
    (i32.store offset=16 (local.get $notify_w) (local.get $item))
    (i32.store offset=20 (local.get $notify_w) (i32.const 0))
    (i32.store offset=24 (local.get $notify_w)
      (i32.load (call $lv_item_state_addr (local.get $sw) (local.get $item))))
    (i32.store offset=32 (local.get $notify_w)
      (i32.add (local.get $notify_g) (i32.const 52)))
    (i32.store offset=36 (local.get $notify_w) (i32.const 260))
    (i32.store offset=40 (local.get $notify_w) (i32.const -1))
    (i32.store offset=44 (local.get $notify_w)
      (i32.load (call $lv_item_param_addr (local.get $sw) (local.get $item))))
    (drop (call $wnd_send_message
      (local.get $parent) (i32.const 0x004E)
      (call $ctrl_table_get_id (local.get $hwnd)) (local.get $notify_g)))
    (if (local.get $want_text)
      (then
        (local.set $text_g (i32.load offset=32 (local.get $notify_w)))
        (if (i32.and
              (i32.ne (local.get $text_g) (i32.const 0))
              (i32.lt_u (local.get $text_g) (i32.const 0xFFFF0000)))
          (then (call $lv_set_cell_text
            (local.get $sw) (local.get $item) (i32.const 0) (local.get $text_g))))))
    (if (local.get $want_image)
      (then (i32.store
        (call $lv_item_image_addr (local.get $sw) (local.get $item))
        (i32.load offset=40 (local.get $notify_w)))))
    (call $heap_free (local.get $notify_g)))

  ;; Does this LVM_* message change what the control looks like?
  ;;
  ;; A real SysListView32 invalidates itself whenever its content, columns
  ;; or colours change; ours only ever painted when something else happened
  ;; to invalidate it. sndvol32 fills its "Show the following volume
  ;; controls" list from WM_INITDIALOG, after the dialog's one paint pass,
  ;; so the list stayed empty for the life of the window. Enumerated rather
  ;; than range-tested on purpose: the LVM_GET* messages outnumber these and
  ;; repainting on a query would be a repaint per redraw.
  (func $lv_msg_repaints (param $msg i32) (result i32)
    (i32.or
      (i32.or
        (i32.or
          (i32.or (i32.eq (local.get $msg) (i32.const 0x1001))  ;; SETBKCOLOR
                  (i32.eq (local.get $msg) (i32.const 0x1003))) ;; SETIMAGELIST
          (i32.or (i32.eq (local.get $msg) (i32.const 0x1006))  ;; SETITEMA
                  (i32.eq (local.get $msg) (i32.const 0x1007)))) ;; INSERTITEMA
        (i32.or
          (i32.or (i32.eq (local.get $msg) (i32.const 0x1008))  ;; DELETEITEM
                  (i32.eq (local.get $msg) (i32.const 0x1009))) ;; DELETEALLITEMS
          (i32.or (i32.eq (local.get $msg) (i32.const 0x100F))  ;; SETITEMPOSITION
                  (i32.eq (local.get $msg) (i32.const 0x1013))))) ;; ENSUREVISIBLE
      (i32.or
        (i32.or
          (i32.or (i32.eq (local.get $msg) (i32.const 0x101A))  ;; SETCOLUMNA
                  (i32.eq (local.get $msg) (i32.const 0x101B))) ;; INSERTCOLUMNA
          (i32.or (i32.eq (local.get $msg) (i32.const 0x101C))  ;; DELETECOLUMN
                  (i32.eq (local.get $msg) (i32.const 0x101E)))) ;; SETCOLUMNWIDTH
        (i32.or
          (i32.or (i32.eq (local.get $msg) (i32.const 0x1024))  ;; SETTEXTCOLOR
                  (i32.eq (local.get $msg) (i32.const 0x1026))) ;; SETTEXTBKCOLOR
          (i32.or
            (i32.or (i32.eq (local.get $msg) (i32.const 0x102B))  ;; SETITEMSTATE
                    (i32.eq (local.get $msg) (i32.const 0x102E))) ;; SETITEMTEXTA
            (i32.or (i32.eq (local.get $msg) (i32.const 0x1030))  ;; SORTITEMS
                    (i32.eq (local.get $msg) (i32.const 0x1036)))))))) ;; SETEXTENDEDLISTVIEWSTYLE

  (func $listview_wndproc (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $state i32) (local $sw i32) (local $cs_w i32)
    (local $hdc i32) (local $sz i32) (local $w i32) (local $h i32)
    (local $mask i32) (local $idx i32) (local $sub i32) (local $count i32)
    (local $lvi_w i32) (local $col_w i32) (local $width i32) (local $ptr i32)
    (local $i i32) (local $src i32) (local $dst i32) (local $old i32)
    (local $top i32) (local $visible i32) (local $max i32) (local $hit i32)
    (local $x i32) (local $y i32) (local $row i32) (local $new_top i32)
    (local $header_h i32) (local $content_right i32) (local $draw_row i32)
    (local $cell_g i32) (local $cell_w i32) (local $text_len i32) (local $icon_brush i32)
    (local $bk_brush i32)
    (local $col_count i32) (local $col_x i32) (local $col_idx i32)
    (local $widths_w i32) (local $texts_w i32) (local $pressed_part i32)
    (local $delta i32) (local $code i32)
    (local $indent i32) (local $icon_x i32)

    (local.set $state (call $wnd_get_state_ptr (local.get $hwnd)))

    ;; WM_CREATE
    (if (i32.eq (local.get $msg) (i32.const 0x0001))
      (then
        (local.set $cs_w (call $g2w (local.get $lParam)))
        (local.set $state (call $heap_alloc (i32.const 76)))
        (local.set $sw (call $g2w (local.get $state)))
        (call $zero_memory (local.get $sw) (i32.const 76))
        (call $lv_set_selected (local.get $sw) (i32.const -1))
        ;; CREATESTRUCT.hMenu is not copied in: it is already CONTROL_TABLE+4.
        ;; Nothing ever read the copy that used to be stored here.
        (call $lv_set_bk_color (local.get $sw) (i32.const 0x00FFFFFF))
        (call $lv_set_text_color (local.get $sw) (i32.const 0x00000000))
        (call $lv_set_text_bk_color (local.get $sw) (i32.const 0x00FFFFFF))
        (call $wnd_set_state_ptr (local.get $hwnd) (local.get $state))
        (return (i32.const 0))))

    ;; WM_DESTROY
    (if (i32.eq (local.get $msg) (i32.const 0x0002))
      (then
        (if (local.get $state)
          (then
            (local.set $sw (call $g2w (local.get $state)))
            (call $lv_clear_items (local.get $hwnd) (local.get $sw))
            (call $lv_clear_columns (local.get $sw))
            (call $heap_free (call $lv_cells_ptr (local.get $sw)))
            (call $heap_free (call $lv_col_widths_ptr (local.get $sw)))
            (call $heap_free (call $lv_col_texts_ptr (local.get $sw)))
            (call $heap_free (local.get $state))
            (call $wnd_set_state_ptr (local.get $hwnd) (i32.const 0))))
        (return (i32.const 0))))

    (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
    (local.set $sw (call $g2w (local.get $state)))

    (if (call $lv_msg_repaints (local.get $msg))
      (then (call $invalidate_hwnd (local.get $hwnd))))

    ;; LVM_GETIMAGELIST / LVM_SETIMAGELIST. Keep normal and small image lists
    ;; separate: report rows use LVSIL_SMALL while desktop LVS_ICON uses the
    ;; authentic 32x32 LVSIL_NORMAL strip.
    (if (i32.eq (local.get $msg) (i32.const 0x1002))
      (then
        (if (i32.eqz (local.get $wParam))
          (then (return (call $lv_normal_image_list (local.get $sw)))))
        (if (i32.eq (local.get $wParam) (i32.const 2))
          (then (return (call $lv_state_image_list (local.get $sw)))))
        (return (call $lv_image_list (local.get $sw)))))
    (if (i32.eq (local.get $msg) (i32.const 0x1003))
      (then
        ;; LVSIL_NORMAL (0).
        (if (i32.eqz (local.get $wParam))
          (then
            (local.set $old (call $lv_normal_image_list (local.get $sw)))
            (call $lv_set_normal_image_list (local.get $sw) (local.get $lParam))
            (return (local.get $old))))
        ;; LVSIL_STATE (2) is how a pre-XP app asks for check boxes: it hands
        ;; over a two-image list and then sets each item's state-image index.
        ;; Keep it apart from the small-icon list -- what it selects is not an
        ;; icon to draw but a check box to compose, and only its presence
        ;; matters to the painter.
        (if (i32.eq (local.get $wParam) (i32.const 2))
          (then
            (local.set $old (call $lv_state_image_list (local.get $sw)))
            (call $lv_set_state_image_list (local.get $sw) (local.get $lParam))
            (return (local.get $old))))
        (local.set $old (call $lv_image_list (local.get $sw)))
        (call $lv_set_image_list (local.get $sw) (local.get $lParam))
        (return (local.get $old))))

    ;; LVM_GETITEMCOUNT
    (if (i32.eq (local.get $msg) (i32.const 0x1004))
      (then (return (call $lv_item_count (local.get $sw)))))

    ;; LVM_GETSTRINGWIDTHA
    (if (i32.eq (local.get $msg) (i32.const 0x1011))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (return (i32.add
          (i32.mul (call $strlen (call $g2w (local.get $lParam))) (i32.const 6))
          (i32.const 8)))))

    ;; LVM_GETITEMPOSITION / LVM_SETITEMPOSITION
    (if (i32.eq (local.get $msg) (i32.const 0x1010))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $idx (local.get $wParam))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_s (local.get $idx) (call $lv_item_count (local.get $sw))))
          (then (return (i32.const 0))))
        (local.set $ptr (call $g2w (local.get $lParam)))
        (i32.store (local.get $ptr) (i32.const 0))
        (i32.store offset=4 (local.get $ptr)
          (i32.add (call $lv_header_h (local.get $sw))
                   (i32.mul (i32.sub (local.get $idx) (call $lv_top_index (local.get $sw))) (i32.const 16))))
        (return (i32.const 1))))
    (if (i32.eq (local.get $msg) (i32.const 0x100F))
      (then
        ;; Report mode owns row layout; accept the message as a compatibility
        ;; no-op so apps that cache icon positions can continue.
        (call $paint_flag_set_inv (local.get $hwnd))
        (return (i32.const 1))))

    ;; LVM_FINDITEMA
    (if (i32.eq (local.get $msg) (i32.const 0x100D))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const -1))))
        (local.set $ptr (call $g2w (local.get $lParam)))
        (local.set $mask (i32.load (local.get $ptr)))
        (local.set $idx (i32.add (local.get $wParam) (i32.const 1)))
        (if (i32.lt_s (local.get $idx) (i32.const 0))
          (then (local.set $idx (i32.const 0))))
        (block $find_done (loop $find
          (br_if $find_done (i32.ge_s (local.get $idx) (call $lv_item_count (local.get $sw))))
          (if (i32.and (local.get $mask) (i32.const 0x0002)) ;; LVFI_STRING
            (then
              (if (call $lv_cell_text_matches
                    (i32.load (call $lv_cell_addr (local.get $sw) (local.get $idx) (i32.const 0)))
                    (i32.load offset=4 (local.get $ptr))
                    (i32.and (local.get $mask) (i32.const 0x0008)))
                (then (return (local.get $idx))))))
          (if (i32.and (local.get $mask) (i32.const 0x0001)) ;; LVFI_PARAM
            (then
              (if (i32.eq (i32.load (call $lv_item_param_addr (local.get $sw) (local.get $idx)))
                          (i32.load offset=8 (local.get $ptr)))
                (then (return (local.get $idx))))))
          (local.set $idx (i32.add (local.get $idx) (i32.const 1)))
          (br $find)))
        (return (i32.const -1))))

    ;; LVM_GETORIGIN / LVM_GETVIEWRECT / LVM_GETITEMSPACING
    (if (i32.eq (local.get $msg) (i32.const 0x1029))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $ptr (call $g2w (local.get $lParam)))
        (i32.store (local.get $ptr) (i32.const 0))
        (i32.store offset=4 (local.get $ptr)
          (i32.sub (i32.const 0) (i32.mul (call $lv_top_index (local.get $sw)) (i32.const 16))))
        (return (i32.const 1))))
    (if (i32.eq (local.get $msg) (i32.const 0x1022))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $ptr (call $g2w (local.get $lParam)))
        (i32.store (local.get $ptr) (i32.const 0))
        (i32.store offset=4 (local.get $ptr) (i32.const 0))
        (i32.store offset=8 (local.get $ptr) (call $lv_report_total_width (local.get $sw)))
        (i32.store offset=12 (local.get $ptr)
          (i32.add (call $lv_header_h (local.get $sw))
                   (i32.mul (call $lv_item_count (local.get $sw)) (i32.const 16))))
        (return (i32.const 1))))
    (if (i32.eq (local.get $msg) (i32.const 0x1033))
      (then
        (return (i32.or (i32.const 120) (i32.shl (i32.const 16) (i32.const 16))))))

    ;; LVM_UPDATE / LVM_REDRAWITEMS. The WAT control repaints as one surface;
    ;; accept these range invalidation hints and schedule a repaint.
    (if (i32.or (i32.eq (local.get $msg) (i32.const 0x102A))
                (i32.eq (local.get $msg) (i32.const 0x1015)))
      (then
        (call $paint_flag_set_inv (local.get $hwnd))
        (return (i32.const 1))))

    ;; LVM_DELETEITEM / LVM_DELETEALLITEMS
    (if (i32.eq (local.get $msg) (i32.const 0x1008))
      (then
        (return (call $lv_delete_item (local.get $hwnd) (local.get $sw) (local.get $wParam)))))
    (if (i32.eq (local.get $msg) (i32.const 0x1009))
      (then
        (call $lv_clear_items (local.get $hwnd) (local.get $sw))
        (call $paint_flag_set_inv (local.get $hwnd))
        (return (i32.const 1))))

    ;; LVM_SETITEMCOUNT
    (if (i32.eq (local.get $msg) (i32.const 0x102F))
      (then
        (if (i32.lt_s (local.get $wParam) (i32.const 0))
          (then (local.set $wParam (i32.const 0))))
        (local.set $count (call $lv_item_count (local.get $sw)))
        (if (i32.lt_s (local.get $wParam) (local.get $count))
          (then
            (local.set $i (local.get $wParam))
            (block $done (loop $items
              (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
              (local.set $sub (i32.const 0))
              (block $subs_done (loop $subs
                (br_if $subs_done (i32.ge_u (local.get $sub) (i32.const 8)))
                (local.set $ptr (i32.load (call $lv_cell_addr (local.get $sw) (local.get $i) (local.get $sub))))
                (if (local.get $ptr) (then (call $heap_free (local.get $ptr))))
                (i32.store (call $lv_cell_addr (local.get $sw) (local.get $i) (local.get $sub)) (i32.const 0))
                (local.set $sub (i32.add (local.get $sub) (i32.const 1)))
                (br $subs)))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $items)))))
        (if (i32.gt_s (local.get $wParam) (local.get $count))
          (then
            (call $lv_ensure_item_capacity (local.get $sw) (local.get $wParam))
            (local.set $i (local.get $count))
            (block $done2 (loop $clear_new
              (br_if $done2 (i32.ge_u (local.get $i) (local.get $wParam)))
              (call $zero_memory (call $lv_cell_addr (local.get $sw) (local.get $i) (i32.const 0)) (i32.const 44))
              (i32.store (call $lv_item_image_addr (local.get $sw) (local.get $i)) (i32.const -1))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $clear_new)))))
        (call $lv_set_item_count (local.get $sw) (local.get $wParam))
        (if (i32.ge_s (call $lv_selected (local.get $sw)) (local.get $wParam))
          (then (call $lv_set_selected (local.get $sw) (i32.const -1))))
        (drop (call $lv_scroll_to_for_h
          (local.get $hwnd)
          (local.get $sw)
          (call $ctrl_get_h (local.get $hwnd))
          (call $lv_top_index (local.get $sw))))
        (call $paint_flag_set_inv (local.get $hwnd))
        (return (i32.const 1))))

    ;; LVM_INSERTCOLUMNA
    (if (i32.eq (local.get $msg) (i32.const 0x101B))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const -1))))
        (local.set $idx (local.get $wParam))
        (local.set $count (call $lv_col_count (local.get $sw)))
        (if (i32.lt_s (local.get $idx) (i32.const 0)) (then (local.set $idx (i32.const 0))))
        (if (i32.gt_s (local.get $idx) (local.get $count)) (then (local.set $idx (local.get $count))))
        (call $lv_ensure_col_capacity (local.get $sw) (i32.add (local.get $count) (i32.const 1)))
        (local.set $widths_w (call $g2w (call $lv_col_widths_ptr (local.get $sw))))
        (local.set $texts_w (call $g2w (call $lv_col_texts_ptr (local.get $sw))))
        ;; Open a hole at $idx: columns [idx, count) move up one slot. The loop
        ;; walked high-to-low for the overlap, which is memmove of the whole run
        ;; for a destination above the source -- one $memcpy per parallel array.
        ;; $idx is clamped to [0, count] above, so the length is never negative.
        (call $memcpy
          (i32.add (local.get $widths_w) (i32.mul (i32.add (local.get $idx) (i32.const 1)) (i32.const 4)))
          (i32.add (local.get $widths_w) (i32.mul (local.get $idx) (i32.const 4)))
          (i32.mul (i32.sub (local.get $count) (local.get $idx)) (i32.const 4)))
        (call $memcpy
          (i32.add (local.get $texts_w) (i32.mul (i32.add (local.get $idx) (i32.const 1)) (i32.const 4)))
          (i32.add (local.get $texts_w) (i32.mul (local.get $idx) (i32.const 4)))
          (i32.mul (i32.sub (local.get $count) (local.get $idx)) (i32.const 4)))
        (local.set $col_w (call $g2w (local.get $lParam)))
        (local.set $mask (i32.load (local.get $col_w)))
        (local.set $width (i32.const 80))
        (if (i32.and (local.get $mask) (i32.const 0x0002))
          (then (local.set $width (i32.load offset=8 (local.get $col_w)))))
        (if (i32.le_s (local.get $width) (i32.const 0))
          (then (local.set $width (i32.const 80))))
        (i32.store (i32.add (local.get $widths_w) (i32.mul (local.get $idx) (i32.const 4))) (local.get $width))
        (i32.store (i32.add (local.get $texts_w) (i32.mul (local.get $idx) (i32.const 4))) (i32.const 0))
        (if (i32.and (local.get $mask) (i32.const 0x0004))
          (then
            (local.set $ptr (i32.load offset=12 (local.get $col_w)))
            (if (local.get $ptr)
              (then
                (if (i32.ne (local.get $ptr) (i32.const -1))
                  (then
                    (local.set $old (call $wat_str_to_heap (call $g2w (local.get $ptr)) (call $strlen (call $g2w (local.get $ptr)))))
                    (i32.store (i32.add (local.get $texts_w) (i32.mul (local.get $idx) (i32.const 4))) (local.get $old))))))))
        (call $lv_set_col_count (local.get $sw) (i32.add (local.get $count) (i32.const 1)))
        (call $paint_flag_set_inv (local.get $hwnd))
        (return (local.get $idx))))

    ;; LVM_DELETECOLUMN
    (if (i32.eq (local.get $msg) (i32.const 0x101C))
      (then
        (return (call $lv_delete_column (local.get $hwnd) (local.get $sw) (local.get $wParam)))))

    ;; LVM_GETCOLUMNA / LVM_SETCOLUMNA
    (if (i32.eq (local.get $msg) (i32.const 0x1019))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $idx (local.get $wParam))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_s (local.get $idx) (call $lv_col_count (local.get $sw))))
          (then (return (i32.const 0))))
        (local.set $col_w (call $g2w (local.get $lParam)))
        (local.set $mask (i32.load (local.get $col_w)))
        (if (i32.and (local.get $mask) (i32.const 0x0001))
          (then (i32.store offset=4 (local.get $col_w) (i32.const 0))))
        (if (i32.and (local.get $mask) (i32.const 0x0002))
          (then (i32.store offset=8 (local.get $col_w)
            (call $lv_report_col_width (local.get $sw) (local.get $idx)))))
        (if (i32.and (local.get $mask) (i32.const 0x0004))
          (then
            (local.set $dst (i32.load offset=12 (local.get $col_w)))
            (local.set $max (i32.load offset=16 (local.get $col_w)))
            (if (i32.and (i32.ne (local.get $dst) (i32.const 0))
                         (i32.gt_s (local.get $max) (i32.const 0)))
              (then
                (local.set $dst (call $g2w (local.get $dst)))
                (local.set $ptr
                  (i32.load
                    (i32.add (call $g2w (call $lv_col_texts_ptr (local.get $sw)))
                             (i32.mul (local.get $idx) (i32.const 4)))))
                (if (local.get $ptr)
                  (then
                    (local.set $src (call $g2w (local.get $ptr)))
                    (local.set $text_len (call $strlen (local.get $src)))
                    (if (i32.ge_u (local.get $text_len) (local.get $max))
                      (then (local.set $text_len (i32.sub (local.get $max) (i32.const 1)))))
                    (if (local.get $text_len)
                      (then (call $memcpy (local.get $dst) (local.get $src) (local.get $text_len))))
                    (i32.store8 (i32.add (local.get $dst) (local.get $text_len)) (i32.const 0)))
                  (else
                    (i32.store8 (local.get $dst) (i32.const 0))))))))
        (if (i32.and (local.get $mask) (i32.const 0x0008))
          (then (i32.store offset=20 (local.get $col_w) (local.get $idx))))
        (return (i32.const 1))))
    (if (i32.eq (local.get $msg) (i32.const 0x101A))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $idx (local.get $wParam))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_s (local.get $idx) (call $lv_col_count (local.get $sw))))
          (then (return (i32.const 0))))
        (local.set $col_w (call $g2w (local.get $lParam)))
        (local.set $mask (i32.load (local.get $col_w)))
        (if (i32.and (local.get $mask) (i32.const 0x0002))
          (then
            (local.set $width (i32.load offset=8 (local.get $col_w)))
            (if (i32.le_s (local.get $width) (i32.const 0))
              (then (local.set $width (i32.const 80))))
            (i32.store
              (i32.add (call $g2w (call $lv_col_widths_ptr (local.get $sw)))
                       (i32.mul (local.get $idx) (i32.const 4)))
              (local.get $width))))
        (if (i32.and (local.get $mask) (i32.const 0x0004))
          (then
            (call $lv_set_col_text (local.get $sw) (local.get $idx) (i32.load offset=12 (local.get $col_w)))))
        (call $paint_flag_set_inv (local.get $hwnd))
        (return (i32.const 1))))

    ;; LVM_GETCOLUMNWIDTH / LVM_SETCOLUMNWIDTH
    (if (i32.eq (local.get $msg) (i32.const 0x101D))
      (then
        (local.set $idx (local.get $wParam))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_s (local.get $idx) (call $lv_col_count (local.get $sw))))
          (then (return (i32.const 0))))
        (return (i32.load (i32.add (call $g2w (call $lv_col_widths_ptr (local.get $sw))) (i32.mul (local.get $idx) (i32.const 4)))))))
    (if (i32.eq (local.get $msg) (i32.const 0x101E))
      (then
        (local.set $idx (local.get $wParam))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_s (local.get $idx) (call $lv_col_count (local.get $sw))))
          (then (return (i32.const 0))))
        (local.set $width (local.get $lParam))
        (if (i32.le_s (local.get $width) (i32.const 0)) (then (local.set $width (i32.const 80))))
        (i32.store (i32.add (call $g2w (call $lv_col_widths_ptr (local.get $sw))) (i32.mul (local.get $idx) (i32.const 4))) (local.get $width))
        (call $paint_flag_set_inv (local.get $hwnd))
        (return (i32.const 1))))

    ;; LVM_GETHEADER plus a bounded pseudo-Header message surface. Returning
    ;; the ListView hwnd lets apps that only query/send HDM_* messages proceed
    ;; without a real child SysHeader32 window yet.
    (if (i32.eq (local.get $msg) (i32.const 0x101F))
      (then
        (if (i32.gt_s (call $lv_col_count (local.get $sw)) (i32.const 0))
          (then (return (local.get $hwnd))))
        (return (i32.const 0))))
    ;; HDM_GETITEMCOUNT
    (if (i32.eq (local.get $msg) (i32.const 0x1200))
      (then (return (call $lv_col_count (local.get $sw)))))
    ;; HDM_GETITEMA
    (if (i32.eq (local.get $msg) (i32.const 0x1203))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $idx (local.get $wParam))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_s (local.get $idx) (call $lv_col_count (local.get $sw))))
          (then (return (i32.const 0))))
        (local.set $ptr (call $g2w (local.get $lParam)))
        (local.set $mask (i32.load (local.get $ptr)))
        (if (i32.and (local.get $mask) (i32.const 0x0001))
          (then (i32.store offset=4 (local.get $ptr)
            (call $lv_report_col_width (local.get $sw) (local.get $idx)))))
        (if (i32.and (local.get $mask) (i32.const 0x0002))
          (then
            (local.set $dst (i32.load offset=8 (local.get $ptr)))
            (local.set $max (i32.load offset=16 (local.get $ptr)))
            (if (i32.and (i32.ne (local.get $dst) (i32.const 0))
                         (i32.gt_s (local.get $max) (i32.const 0)))
              (then
                (local.set $dst (call $g2w (local.get $dst)))
                (local.set $src
                  (i32.load
                    (i32.add (call $g2w (call $lv_col_texts_ptr (local.get $sw)))
                             (i32.mul (local.get $idx) (i32.const 4)))))
                (if (local.get $src)
                  (then
                    (local.set $src (call $g2w (local.get $src)))
                    (local.set $text_len (call $strlen (local.get $src)))
                    (if (i32.ge_u (local.get $text_len) (local.get $max))
                      (then (local.set $text_len (i32.sub (local.get $max) (i32.const 1)))))
                    (if (local.get $text_len)
                      (then (call $memcpy (local.get $dst) (local.get $src) (local.get $text_len))))
                    (i32.store8 (i32.add (local.get $dst) (local.get $text_len)) (i32.const 0)))
                  (else
                    (i32.store8 (local.get $dst) (i32.const 0))))))))
        (if (i32.and (local.get $mask) (i32.const 0x0004))
          (then (i32.store offset=20 (local.get $ptr) (i32.const 0))))
        (if (i32.and (local.get $mask) (i32.const 0x0080))
          (then (i32.store offset=32 (local.get $ptr) (local.get $idx))))
        (return (i32.const 1))))
    ;; HDM_SETITEMA. Update the same bounded report-column backing state used
    ;; by LVM_SETCOLUMNA. Header reordering is still identity-only.
    (if (i32.eq (local.get $msg) (i32.const 0x1204))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $idx (local.get $wParam))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_s (local.get $idx) (call $lv_col_count (local.get $sw))))
          (then (return (i32.const 0))))
        (local.set $ptr (call $g2w (local.get $lParam)))
        (local.set $mask (i32.load (local.get $ptr)))
        (if (i32.and (local.get $mask) (i32.const 0x0080))
          (then
            (if (i32.ne (i32.load offset=32 (local.get $ptr)) (local.get $idx))
              (then (return (i32.const 0))))))
        (if (i32.and (local.get $mask) (i32.const 0x0001))
          (then
            (local.set $width (i32.load offset=4 (local.get $ptr)))
            (if (i32.le_s (local.get $width) (i32.const 0))
              (then (local.set $width (i32.const 80))))
            (i32.store
              (i32.add (call $g2w (call $lv_col_widths_ptr (local.get $sw)))
                       (i32.mul (local.get $idx) (i32.const 4)))
              (local.get $width))))
        (if (i32.and (local.get $mask) (i32.const 0x0002))
          (then
            (call $lv_set_col_text (local.get $sw) (local.get $idx) (i32.load offset=8 (local.get $ptr)))))
        (call $paint_flag_set_inv (local.get $hwnd))
        (return (i32.const 1))))
    ;; HDM_LAYOUT
    (if (i32.eq (local.get $msg) (i32.const 0x1205))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $ptr (call $g2w (local.get $lParam)))
        (local.set $src (i32.load (local.get $ptr))) ;; RECT*
        (local.set $dst (i32.load offset=4 (local.get $ptr))) ;; WINDOWPOS*
        (if (i32.eqz (local.get $dst)) (then (return (i32.const 0))))
        (local.set $header_h (call $lv_header_h (local.get $sw)))
        (if (i32.eqz (local.get $header_h)) (then (local.set $header_h (i32.const 18))))
        (if (local.get $src)
          (then
            (local.set $src (call $g2w (local.get $src)))
            (local.set $x (i32.load (local.get $src)))
            (local.set $y (i32.load offset=4 (local.get $src)))
            (local.set $width (i32.sub (i32.load offset=8 (local.get $src)) (local.get $x)))
            (i32.store offset=4 (local.get $src) (i32.add (local.get $y) (local.get $header_h))))
          (else
            (local.set $x (i32.const 0))
            (local.set $y (i32.const 0))
            (local.set $width (call $ctrl_get_w (local.get $hwnd)))))
        (local.set $dst (call $g2w (local.get $dst)))
        (i32.store          (local.get $dst) (local.get $hwnd))
        (i32.store offset=4 (local.get $dst) (i32.const 0))
        (i32.store offset=8 (local.get $dst) (local.get $x))
        (i32.store offset=12 (local.get $dst) (local.get $y))
        (i32.store offset=16 (local.get $dst) (local.get $width))
        (i32.store offset=20 (local.get $dst) (local.get $header_h))
        (i32.store offset=24 (local.get $dst) (i32.const 0x0014)) ;; SWP_NOZORDER | SWP_NOACTIVATE
        (return (i32.const 1))))
    ;; HDM_ORDERTOINDEX / HDM_GETORDERARRAY / HDM_SETORDERARRAY. The pseudo
    ;; header exposes only identity order until real header reordering lands.
    (if (i32.eq (local.get $msg) (i32.const 0x120F))
      (then
        (if (i32.or (i32.lt_s (local.get $wParam) (i32.const 0))
                    (i32.ge_s (local.get $wParam) (call $lv_col_count (local.get $sw))))
          (then (return (i32.const -1))))
        (return (local.get $wParam))))
    (if (i32.eq (local.get $msg) (i32.const 0x1211))
      (then
        (local.set $count (call $lv_col_count (local.get $sw)))
        (if (i32.or (i32.eqz (local.get $lParam))
                    (i32.lt_u (local.get $wParam) (local.get $count)))
          (then (return (i32.const 0))))
        (local.set $ptr (call $g2w (local.get $lParam)))
        (local.set $i (i32.const 0))
        (block $order_get_done (loop $order_get
          (br_if $order_get_done (i32.ge_u (local.get $i) (local.get $count)))
          (i32.store (i32.add (local.get $ptr) (i32.mul (local.get $i) (i32.const 4))) (local.get $i))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $order_get)))
        (return (i32.const 1))))
    (if (i32.eq (local.get $msg) (i32.const 0x1212))
      (then
        (local.set $count (call $lv_col_count (local.get $sw)))
        (if (i32.or (i32.eqz (local.get $lParam))
                    (i32.lt_u (local.get $wParam) (local.get $count)))
          (then (return (i32.const 0))))
        (local.set $ptr (call $g2w (local.get $lParam)))
        (local.set $i (i32.const 0))
        (block $order_set_done (loop $order_set
          (br_if $order_set_done (i32.ge_u (local.get $i) (local.get $count)))
          (if (i32.ne (i32.load (i32.add (local.get $ptr) (i32.mul (local.get $i) (i32.const 4)))) (local.get $i))
            (then (return (i32.const 0))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $order_set)))
        (return (i32.const 1))))
    ;; HDM_HITTEST
    (if (i32.eq (local.get $msg) (i32.const 0x1206))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const -1))))
        (local.set $ptr (call $g2w (local.get $lParam)))
        (local.set $x (i32.load (local.get $ptr)))
        (local.set $y (i32.load offset=4 (local.get $ptr)))
        (local.set $header_h (call $lv_header_h (local.get $sw)))
        (if (i32.or (i32.lt_s (local.get $y) (i32.const 0))
                    (i32.ge_s (local.get $y) (local.get $header_h)))
          (then
            (i32.store offset=8 (local.get $ptr) (i32.const 0x0001))
            (i32.store offset=12 (local.get $ptr) (i32.const -1))
            (return (i32.const -1))))
        (local.set $col_idx (i32.const 0))
        (local.set $col_x (i32.const 0))
        (block $hd_hit_done (loop $hd_hit_cols
          (br_if $hd_hit_done (i32.ge_s (local.get $col_idx) (call $lv_col_count (local.get $sw))))
          (local.set $width (call $lv_report_col_width (local.get $sw) (local.get $col_idx)))
          (if (i32.and
                (i32.ge_s (local.get $x) (local.get $col_x))
                (i32.lt_s (local.get $x) (i32.add (local.get $col_x) (local.get $width))))
            (then
              (i32.store offset=8 (local.get $ptr) (i32.const 0x0002))
              (i32.store offset=12 (local.get $ptr) (local.get $col_idx))
              (return (local.get $col_idx))))
          (local.set $col_x (i32.add (local.get $col_x) (local.get $width)))
          (local.set $col_idx (i32.add (local.get $col_idx) (i32.const 1)))
          (br $hd_hit_cols)))
        (i32.store offset=8 (local.get $ptr) (i32.const 0x0001))
        (i32.store offset=12 (local.get $ptr) (i32.const -1))
        (return (i32.const -1))))
    ;; HDM_GETITEMRECT
    (if (i32.eq (local.get $msg) (i32.const 0x1207))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $idx (local.get $wParam))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_s (local.get $idx) (call $lv_col_count (local.get $sw))))
          (then (return (i32.const 0))))
        (local.set $ptr (call $g2w (local.get $lParam)))
        (local.set $col_x (call $lv_report_col_left (local.get $sw) (local.get $idx)))
        (local.set $width (call $lv_report_col_width (local.get $sw) (local.get $idx)))
        (i32.store (local.get $ptr) (local.get $col_x))
        (i32.store offset=4 (local.get $ptr) (i32.const 0))
        (i32.store offset=8 (local.get $ptr) (i32.add (local.get $col_x) (local.get $width)))
        (i32.store offset=12 (local.get $ptr) (call $lv_header_h (local.get $sw)))
        (return (i32.const 1))))

    ;; LVM_INSERTITEMA
    (if (i32.eq (local.get $msg) (i32.const 0x1007))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const -1))))
        (local.set $lvi_w (call $g2w (local.get $lParam)))
        (local.set $mask (i32.load (local.get $lvi_w)))
        (local.set $idx (i32.load offset=4 (local.get $lvi_w)))
        (local.set $count (call $lv_item_count (local.get $sw)))
        (if (i32.lt_s (local.get $idx) (i32.const 0)) (then (local.set $idx (i32.const 0))))
        (if (i32.gt_s (local.get $idx) (local.get $count)) (then (local.set $idx (local.get $count))))
        (call $lv_ensure_item_capacity (local.get $sw) (i32.add (local.get $count) (i32.const 1)))
        ;; Open a hole at $idx: records [idx, count) move up one 44-byte slot.
        ;; The loop copied one record at a time from the top for the overlap,
        ;; and $lv_cell_addr is linear in $item, so the whole run is one
        ;; memmove -- the mirror of the single $memcpy in $lv_delete_item.
        (call $memcpy
          (call $lv_cell_addr (local.get $sw) (i32.add (local.get $idx) (i32.const 1)) (i32.const 0))
          (call $lv_cell_addr (local.get $sw) (local.get $idx) (i32.const 0))
          (i32.mul (i32.sub (local.get $count) (local.get $idx)) (i32.const 44)))
        (call $zero_memory (call $lv_cell_addr (local.get $sw) (local.get $idx) (i32.const 0)) (i32.const 44))
        (i32.store (call $lv_item_image_addr (local.get $sw) (local.get $idx)) (i32.const -1))
        ;; The record shift also moves per-item state. Keep the control-level
        ;; selection mark attached to the same logical row.
        (local.set $old (call $lv_selected (local.get $sw)))
        (if (i32.ge_s (local.get $old) (local.get $idx))
          (then (call $lv_set_selected (local.get $sw)
            (i32.add (local.get $old) (i32.const 1)))))
        (call $lv_set_item_count (local.get $sw) (i32.add (local.get $count) (i32.const 1)))
        (if (i32.and (local.get $mask) (i32.const 0x0001))
          (then
            (local.set $sub (i32.load offset=8 (local.get $lvi_w)))
            (call $lv_set_cell_text (local.get $sw) (local.get $idx) (local.get $sub) (i32.load offset=20 (local.get $lvi_w)))))
        (if (i32.and (local.get $mask) (i32.const 0x0002))
          (then
            (i32.store
              (call $lv_item_image_addr (local.get $sw) (local.get $idx))
              (i32.load offset=28 (local.get $lvi_w)))))
        (if (i32.and (local.get $mask) (i32.const 0x0004))
          (then
            (i32.store
              (call $lv_item_param_addr (local.get $sw) (local.get $idx))
              (i32.load offset=32 (local.get $lvi_w)))))
        (if (i32.and (local.get $mask) (i32.const 0x0008))
          (then
            (drop (call $lv_change_item_state
              (local.get $hwnd) (local.get $sw) (local.get $idx)
              (i32.load offset=12 (local.get $lvi_w))
              (i32.load offset=16 (local.get $lvi_w))
              (i32.const 0) (i32.const 0)))))
        (call $lv_resolve_insert_callbacks
          (local.get $hwnd) (local.get $sw) (local.get $idx)
          (i32.and
            (i32.ne (i32.and (local.get $mask) (i32.const 0x0001)) (i32.const 0))
            (i32.eq (i32.load offset=20 (local.get $lvi_w)) (i32.const -1)))
          (i32.and
            (i32.ne (i32.and (local.get $mask) (i32.const 0x0002)) (i32.const 0))
            (i32.eq (i32.load offset=28 (local.get $lvi_w)) (i32.const -1))))
        (call $paint_flag_set_inv (local.get $hwnd))
        (return (local.get $idx))))

    ;; LVM_SETITEMA / LVM_SETITEMTEXTA
    (if (i32.or (i32.eq (local.get $msg) (i32.const 0x1006))
                (i32.eq (local.get $msg) (i32.const 0x102E)))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $lvi_w (call $g2w (local.get $lParam)))
        (local.set $idx
          (select (i32.load offset=4 (local.get $lvi_w)) (local.get $wParam)
                  (i32.eq (local.get $msg) (i32.const 0x1006))))
        (local.set $sub (i32.load offset=8 (local.get $lvi_w)))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_s (local.get $idx) (call $lv_item_count (local.get $sw))))
          (then (return (i32.const 0))))
        (if (i32.or (i32.eq (local.get $msg) (i32.const 0x102E))
                    (i32.and (i32.load (local.get $lvi_w)) (i32.const 0x0001)))
          (then (call $lv_set_cell_text (local.get $sw) (local.get $idx) (local.get $sub) (i32.load offset=20 (local.get $lvi_w)))))
        (if (i32.and (i32.load (local.get $lvi_w)) (i32.const 0x0002))
          (then
            (i32.store
              (call $lv_item_image_addr (local.get $sw) (local.get $idx))
              (i32.load offset=28 (local.get $lvi_w)))))
        (if (i32.and (i32.load (local.get $lvi_w)) (i32.const 0x0004))
          (then
            (i32.store
              (call $lv_item_param_addr (local.get $sw) (local.get $idx))
              (i32.load offset=32 (local.get $lvi_w)))))
        (if (i32.and (i32.load (local.get $lvi_w)) (i32.const 0x0008))
          (then
            (if (i32.eqz (call $lv_change_item_state
                  (local.get $hwnd) (local.get $sw) (local.get $idx)
                  (i32.load offset=12 (local.get $lvi_w))
                  (i32.load offset=16 (local.get $lvi_w))
                  (i32.const 0) (i32.const 0)))
              (then (return (i32.const 0))))))
        ;; DefView commonly inserts the PIDL/lParam first and assigns
        ;; LPSTR_TEXTCALLBACKA/I_IMAGECALLBACK with a later LVM_SETITEMA.
        ;; Resolve that form too; handling only INSERTITEM left stock desktop
        ;; rows permanently anonymous even though their private PIDLs existed.
        (call $lv_resolve_insert_callbacks
          (local.get $hwnd) (local.get $sw) (local.get $idx)
          (i32.and
            (i32.or
              (i32.eq (local.get $msg) (i32.const 0x102E))
              (i32.ne (i32.and (i32.load (local.get $lvi_w)) (i32.const 0x0001)) (i32.const 0)))
            (i32.eq (i32.load offset=20 (local.get $lvi_w)) (i32.const -1)))
          (i32.and
            (i32.eq (local.get $msg) (i32.const 0x1006))
            (i32.and
              (i32.ne (i32.and (i32.load (local.get $lvi_w)) (i32.const 0x0002)) (i32.const 0))
              (i32.eq (i32.load offset=28 (local.get $lvi_w)) (i32.const -1)))))
        (call $paint_flag_set_inv (local.get $hwnd))
        (return (i32.const 1))))

    ;; LVM_GETITEMTEXTA / LVM_GETITEMA
    (if (i32.or (i32.eq (local.get $msg) (i32.const 0x102D))
                (i32.eq (local.get $msg) (i32.const 0x1005)))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $lvi_w (call $g2w (local.get $lParam)))
        (local.set $idx
          (select (i32.load offset=4 (local.get $lvi_w)) (local.get $wParam)
                  (i32.eq (local.get $msg) (i32.const 0x1005))))
        (local.set $sub (i32.load offset=8 (local.get $lvi_w)))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_s (local.get $idx) (call $lv_item_count (local.get $sw))))
          (then (return (i32.const 0))))
        (if (i32.eq (local.get $msg) (i32.const 0x1005))
          (then
            (if (i32.and (i32.load (local.get $lvi_w)) (i32.const 0x0002))
              (then
                (i32.store offset=28 (local.get $lvi_w)
                  (i32.load (call $lv_item_image_addr (local.get $sw) (local.get $idx))))))
            (if (i32.and (i32.load (local.get $lvi_w)) (i32.const 0x0004))
              (then
                (i32.store offset=32 (local.get $lvi_w)
                  (i32.load (call $lv_item_param_addr (local.get $sw) (local.get $idx))))))
            (if (i32.and (i32.load (local.get $lvi_w)) (i32.const 0x0008))
              (then
                (i32.store offset=12 (local.get $lvi_w)
                  (i32.and
                    (i32.load (call $lv_item_state_addr (local.get $sw) (local.get $idx)))
                    (i32.load offset=16 (local.get $lvi_w))))))
            (if (i32.and (i32.load (local.get $lvi_w)) (i32.const 0x0001))
              (then
                (drop (call $lv_copy_cell_text
                  (local.get $sw) (local.get $idx) (local.get $sub)
                  (i32.load offset=20 (local.get $lvi_w))
                  (i32.load offset=24 (local.get $lvi_w))))))
            ;; LVM_GETITEM returns BOOL, not the copied text length.
            (return (i32.const 1))))
        (return (call $lv_copy_cell_text
          (local.get $sw) (local.get $idx) (local.get $sub)
          (i32.load offset=20 (local.get $lvi_w))
          (i32.load offset=24 (local.get $lvi_w))))))

    ;; LVM_SETITEMSTATE / LVM_GETITEMSTATE / LVM_GETSELECTEDCOUNT / LVM_GETNEXTITEM
    (if (i32.eq (local.get $msg) (i32.const 0x102B))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $idx (local.get $wParam))
        (local.set $lvi_w (call $g2w (local.get $lParam)))
        (local.set $mask (i32.load offset=16 (local.get $lvi_w)))
        (local.set $old (i32.load offset=12 (local.get $lvi_w)))
        ;; Win98 applies index -1 to every item, except when the requested
        ;; state cannot be shared: focus is unique, and LVS_SINGLESEL cannot
        ;; select all. Those two requests fail atomically.
        (if (i32.eq (local.get $idx) (i32.const -1))
          (then
            (if (i32.and
                  (i32.and (local.get $old) (local.get $mask))
                  (i32.const 0x0001)) ;; LVIS_FOCUSED
              (then (return (i32.const 0))))
            (if (i32.and
                  (i32.ne
                    (i32.and (i32.and (local.get $old) (local.get $mask)) (i32.const 0x0002))
                    (i32.const 0))
                  (i32.ne
                    (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x0004))
                    (i32.const 0))) ;; LVS_SINGLESEL
              (then (return (i32.const 0))))
            ;; Win98's single-select clear visits only its selected row.
            (if (i32.and
                  (i32.and
                    (i32.eqz (i32.and (local.get $old) (i32.const 0x0002)))
                    (i32.ne (i32.and (local.get $mask) (i32.const 0x0002)) (i32.const 0)))
                  (i32.ne
                    (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x0004))
                    (i32.const 0)))
              (then
                (local.set $i
                  (call $lv_find_item_with_state
                    (local.get $sw) (i32.const -1) (i32.const 0x0002)))
                (if (i32.ge_s (local.get $i) (i32.const 0))
                  (then
                    (if (i32.eqz (call $lv_change_item_state
                          (local.get $hwnd) (local.get $sw) (local.get $i)
                          (local.get $old) (local.get $mask)
                          (i32.const 0) (i32.const 0)))
                      (then (return (i32.const 0))))))
                (call $paint_flag_set_inv (local.get $hwnd))
                (return (i32.const 1))))
            (local.set $i (i32.const 0))
            (block $broadcast_done (loop $broadcast_items
              (br_if $broadcast_done
                (i32.ge_s (local.get $i) (call $lv_item_count (local.get $sw))))
              (if (i32.eqz (call $lv_change_item_state
                    (local.get $hwnd) (local.get $sw) (local.get $i)
                    (local.get $old) (local.get $mask)
                    (i32.const 0) (i32.const 1)))
                (then (return (i32.const 0))))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $broadcast_items)))
            (call $paint_flag_set_inv (local.get $hwnd))
            (return (i32.const 1))))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_s (local.get $idx) (call $lv_item_count (local.get $sw))))
          (then (return (i32.const 0))))
        (if (i32.eqz (call $lv_change_item_state
              (local.get $hwnd) (local.get $sw) (local.get $idx)
              (local.get $old) (local.get $mask)
              (i32.const 0) (i32.const 0)))
          (then (return (i32.const 0))))
        (call $paint_flag_set_inv (local.get $hwnd))
        (return (i32.const 1))))
    (if (i32.eq (local.get $msg) (i32.const 0x102C))
      (then
        (if (i32.or (i32.lt_s (local.get $wParam) (i32.const 0))
                    (i32.ge_s (local.get $wParam) (call $lv_item_count (local.get $sw))))
          (then (return (i32.const 0))))
        (return (i32.and
          (i32.load (call $lv_item_state_addr (local.get $sw) (local.get $wParam)))
          (local.get $lParam)))))
    (if (i32.eq (local.get $msg) (i32.const 0x1032))
      (then (return (call $lv_selected_count (local.get $sw)))))
    (if (i32.eq (local.get $msg) (i32.const 0x100C))
      (then
        (local.set $idx (i32.add (local.get $wParam) (i32.const 1)))
        (local.set $mask (i32.and (local.get $lParam) (i32.const 0x000F)))
        (if (local.get $mask)
          (then (return (call $lv_find_item_with_state
            (local.get $sw) (local.get $wParam) (local.get $mask)))))
        (if (i32.lt_s (local.get $idx) (call $lv_item_count (local.get $sw)))
          (then (return (local.get $idx))))
        (return (i32.const -1))))

    ;; LVM_GETITEMRECT
    (if (i32.eq (local.get $msg) (i32.const 0x100E))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $idx (local.get $wParam))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_s (local.get $idx) (call $lv_item_count (local.get $sw))))
          (then (return (i32.const 0))))
        (local.set $ptr (call $g2w (local.get $lParam)))
        (local.set $code (i32.load (local.get $ptr)))
        (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
        (local.set $w (i32.and (local.get $sz) (i32.const 0xFFFF)))
        (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
        (local.set $header_h (call $lv_header_h (local.get $sw)))
        (local.set $content_right (call $lv_content_right_for_size (local.get $sw) (local.get $w) (local.get $h)))
        (local.set $y
          (i32.add (local.get $header_h)
            (i32.mul
              (i32.sub (local.get $idx) (call $lv_top_index (local.get $sw)))
              (i32.const 16))))
        (local.set $col_w (call $lv_report_col_width (local.get $sw) (i32.const 0)))
        (if (i32.le_s (local.get $col_w) (i32.const 0))
          (then (local.set $col_w (local.get $content_right))))
        (if (i32.or (i32.eq (local.get $code) (i32.const 1))
                    (i32.eq (local.get $code) (i32.const 2)))
          (then
            (i32.store (local.get $ptr)
              (select (i32.const 4) (i32.const 0)
                      (i32.gt_s (local.get $content_right) (i32.const 4))))
            (i32.store offset=8 (local.get $ptr)
              (select (local.get $col_w) (local.get $content_right)
                      (i32.lt_s (local.get $col_w) (local.get $content_right)))))
          (else
            (i32.store (local.get $ptr) (i32.const 0))
            (i32.store offset=8 (local.get $ptr) (local.get $content_right))))
        (i32.store offset=4 (local.get $ptr) (local.get $y))
        (i32.store offset=12 (local.get $ptr) (i32.add (local.get $y) (i32.const 16)))
        (return (i32.const 1))))

    ;; LVM_GETSUBITEMRECT
    (if (i32.eq (local.get $msg) (i32.const 0x1038))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $idx (local.get $wParam))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_s (local.get $idx) (call $lv_item_count (local.get $sw))))
          (then (return (i32.const 0))))
        (local.set $ptr (call $g2w (local.get $lParam)))
        (local.set $code (i32.load (local.get $ptr)))
        (local.set $sub (i32.load offset=4 (local.get $ptr)))
        (local.set $col_w (call $lv_report_col_width (local.get $sw) (local.get $sub)))
        (if (i32.le_s (local.get $col_w) (i32.const 0))
          (then (return (i32.const 0))))
        (local.set $col_x (call $lv_report_col_left (local.get $sw) (local.get $sub)))
        (local.set $header_h (call $lv_header_h (local.get $sw)))
        (local.set $y
          (i32.add (local.get $header_h)
            (i32.mul
              (i32.sub (local.get $idx) (call $lv_top_index (local.get $sw)))
              (i32.const 16))))
        (if (i32.or (i32.eq (local.get $code) (i32.const 1))
                    (i32.eq (local.get $code) (i32.const 2)))
          (then
            (i32.store (local.get $ptr) (i32.add (local.get $col_x) (i32.const 4))))
          (else
            (i32.store (local.get $ptr) (local.get $col_x))))
        (i32.store offset=4 (local.get $ptr) (local.get $y))
        (i32.store offset=8 (local.get $ptr) (i32.add (local.get $col_x) (local.get $col_w)))
        (i32.store offset=12 (local.get $ptr) (i32.add (local.get $y) (i32.const 16)))
        (return (i32.const 1))))

    ;; LVM_GETTOPINDEX / LVM_GETCOUNTPERPAGE / LVM_ENSUREVISIBLE / LVM_SCROLL
    (if (i32.eq (local.get $msg) (i32.const 0x1027))
      (then (return (call $lv_top_index (local.get $sw)))))
    (if (i32.eq (local.get $msg) (i32.const 0x1028))
      (then
        (return (call $lv_visible_rows_for_h
          (local.get $sw)
          (call $ctrl_get_h (local.get $hwnd))))))
    (if (i32.eq (local.get $msg) (i32.const 0x1013))
      (then
        (local.set $idx (local.get $wParam))
        (if (i32.lt_s (local.get $idx) (i32.const 0)) (then (return (i32.const 0))))
        (if (i32.ge_s (local.get $idx) (call $lv_item_count (local.get $sw))) (then (return (i32.const 0))))
        (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
        (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
        (local.set $top (call $lv_top_index (local.get $sw)))
        (local.set $visible (call $lv_visible_rows_for_h (local.get $sw) (local.get $h)))
        (if (i32.lt_s (local.get $idx) (local.get $top))
          (then (drop (call $lv_scroll_to_for_h
            (local.get $hwnd) (local.get $sw) (local.get $h) (local.get $idx)))))
        (if (i32.ge_s (local.get $idx) (i32.add (local.get $top) (local.get $visible)))
          (then
            (drop (call $lv_scroll_to_for_h
              (local.get $hwnd) (local.get $sw) (local.get $h)
              (i32.sub (i32.add (local.get $idx) (i32.const 1)) (local.get $visible))))))
        (call $paint_flag_set_inv (local.get $hwnd))
        (return (i32.const 1))))
    (if (i32.eq (local.get $msg) (i32.const 0x1014))
      (then
        (local.set $delta (i32.div_s (local.get $lParam) (i32.const 16)))
        (if (i32.and (i32.eqz (local.get $delta)) (i32.ne (local.get $lParam) (i32.const 0)))
          (then (local.set $delta (select (i32.const 1) (i32.const -1) (i32.gt_s (local.get $lParam) (i32.const 0))))))
        (drop (call $lv_scroll_by (local.get $hwnd) (local.get $delta)))
        (return (i32.const 1))))

    ;; LVM_HITTEST
    (if (i32.eq (local.get $msg) (i32.const 0x1012))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const -1))))
        (local.set $ptr (call $g2w (local.get $lParam)))
        (local.set $x (i32.load (local.get $ptr)))
        (local.set $y (i32.load offset=4 (local.get $ptr)))
        (local.set $header_h (call $lv_header_h (local.get $sw)))
        (local.set $row
          (i32.add (call $lv_top_index (local.get $sw))
            (i32.div_s (i32.sub (local.get $y) (local.get $header_h)) (i32.const 16))))
        (if (i32.or
              (i32.lt_s (local.get $y) (local.get $header_h))
              (i32.or (i32.lt_s (local.get $row) (i32.const 0))
                      (i32.ge_s (local.get $row) (call $lv_item_count (local.get $sw)))))
          (then
            (i32.store offset=8 (local.get $ptr) (i32.const 0))
            (i32.store offset=12 (local.get $ptr) (i32.const -1))
            (i32.store offset=16 (local.get $ptr) (i32.const 0))
            (return (i32.const -1))))
        (local.set $sub (i32.const 0))
        (local.set $col_count (call $lv_col_count (local.get $sw)))
        (if (i32.eqz (local.get $col_count))
          (then (local.set $col_count (i32.const 1))))
        (local.set $col_x (i32.const 0))
        (local.set $col_idx (i32.const 0))
        (block $hit_col_done (loop $hit_cols
          (br_if $hit_col_done (i32.ge_u (local.get $col_idx) (local.get $col_count)))
          (local.set $width (call $lv_report_col_width (local.get $sw) (local.get $col_idx)))
          (if (i32.le_s (local.get $width) (i32.const 0))
            (then (local.set $width (i32.const 120))))
          (if (i32.and
                (i32.ge_s (local.get $x) (local.get $col_x))
                (i32.lt_s (local.get $x) (i32.add (local.get $col_x) (local.get $width))))
            (then
              (local.set $sub (local.get $col_idx))
              (br $hit_col_done)))
          (local.set $col_x (i32.add (local.get $col_x) (local.get $width)))
          (local.set $col_idx (i32.add (local.get $col_idx) (i32.const 1)))
          (br $hit_cols)))
        (i32.store offset=8 (local.get $ptr) (i32.const 0x0004))
        (i32.store offset=12 (local.get $ptr) (local.get $row))
        (i32.store offset=16 (local.get $ptr) (local.get $sub))
        (return (local.get $row))))

    ;; WM_MOUSEWHEEL
    (if (i32.eq (local.get $msg) (i32.const 0x020A))
      (then
        (local.set $delta
          (i32.div_s
            (i32.sub (i32.const 0) (i32.shr_s (local.get $wParam) (i32.const 16)))
            (i32.const 40)))
        (drop (call $lv_scroll_by (local.get $hwnd) (local.get $delta)))
        (return (i32.const 0))))

    ;; WM_VSCROLL
    (if (i32.eq (local.get $msg) (i32.const 0x0115))
      (then
        (local.set $code (i32.and (local.get $wParam) (i32.const 0xFFFF)))
        (if (i32.eq (local.get $code) (i32.const 0))
          (then (drop (call $lv_scroll_by (local.get $hwnd) (i32.const -1)))))
        (if (i32.eq (local.get $code) (i32.const 1))
          (then (drop (call $lv_scroll_by (local.get $hwnd) (i32.const 1)))))
        (if (i32.or (i32.eq (local.get $code) (i32.const 2))
                    (i32.eq (local.get $code) (i32.const 3)))
          (then
            (local.set $h (call $ctrl_get_h (local.get $hwnd)))
            (local.set $delta (call $lv_visible_rows_for_h (local.get $sw) (local.get $h)))
            (if (i32.eq (local.get $code) (i32.const 2))
              (then (local.set $delta (i32.sub (i32.const 0) (local.get $delta)))))
            (drop (call $lv_scroll_by (local.get $hwnd) (local.get $delta)))))
        (if (i32.or (i32.eq (local.get $code) (i32.const 4))
                    (i32.eq (local.get $code) (i32.const 5)))
          (then
            (local.set $h (call $ctrl_get_h (local.get $hwnd)))
            (drop (call $lv_scroll_to_for_h
              (local.get $hwnd) (local.get $sw) (local.get $h)
              (i32.shr_s (local.get $wParam) (i32.const 16))))
            (call $paint_flag_set_inv (local.get $hwnd))))
        (if (i32.eq (local.get $code) (i32.const 6))
          (then (drop (call $lv_scroll_by (local.get $hwnd) (i32.sub (i32.const 0) (call $lv_top_index (local.get $sw)))))))
        (if (i32.eq (local.get $code) (i32.const 7))
          (then
            (local.set $h (call $ctrl_get_h (local.get $hwnd)))
            (drop (call $lv_scroll_by
              (local.get $hwnd)
              (i32.sub (call $lv_max_scroll_for_h (local.get $sw) (local.get $h)) (call $lv_top_index (local.get $sw)))))))
        (return (i32.const 0))))

    ;; Shared scrollbar mouse handling.
    (if (i32.and
          (i32.eq (local.get $msg) (i32.const 0x0202))
          (i32.eq (global.get $sb_pressed_hwnd) (local.get $hwnd)))
      (then
        (global.set $sb_pressed_hwnd (i32.const 0))
        (global.set $sb_pressed_part (i32.const 0))
        (if (i32.eq (global.get $capture_hwnd) (local.get $hwnd))
          (then (global.set $capture_hwnd (i32.const 0))))
        (call $paint_flag_set_inv (local.get $hwnd))
        (return (i32.const 1))))

    (if (i32.eq (local.get $msg) (i32.const 0x0202))
      (then
        (local.set $y (i32.shr_s (local.get $lParam) (i32.const 16)))
        (local.set $header_h (call $lv_header_h (local.get $sw)))
        (if (i32.lt_s (local.get $y) (local.get $header_h))
          (then (return (i32.const 0))))
        (local.set $row
          (i32.add (call $lv_top_index (local.get $sw))
            (i32.div_s (i32.sub (local.get $y) (local.get $header_h)) (i32.const 16))))
        (if (i32.and (i32.ge_s (local.get $row) (i32.const 0))
                     (i32.lt_s (local.get $row) (call $lv_item_count (local.get $sw))))
          (then
            (call $lv_notify_simple (local.get $hwnd) (i32.const -2))))
        (return (i32.const 0))))

    (if (i32.eq (local.get $msg) (i32.const 0x0200))
      (then
        (if (i32.and
              (i32.eq (global.get $sb_pressed_hwnd) (local.get $hwnd))
              (i32.eq (global.get $sb_pressed_part) (i32.const 5)))
          (then
            (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
            (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
            (local.set $max (call $lv_max_scroll_for_h (local.get $sw) (local.get $h)))
            (if (i32.gt_s (local.get $max) (i32.const 0))
              (then
                (local.set $y (i32.shr_s (local.get $lParam) (i32.const 16)))
                (local.set $new_top
                  (call $scrollbar_drag_pos
                    (local.get $h) (local.get $y)
                    (call $lv_drag_anchor_y (local.get $sw))
                    (call $lv_drag_anchor_top (local.get $sw))
                    (i32.const 0) (local.get $max)))
                (if (i32.ne (local.get $new_top) (call $lv_top_index (local.get $sw)))
                  (then
                    (drop (call $lv_scroll_to_for_h
                      (local.get $hwnd) (local.get $sw) (local.get $h) (local.get $new_top)))
                    (call $paint_flag_set_inv (local.get $hwnd))))))
            (return (i32.const 1))))
        (return (i32.const 0))))

    (if (i32.eq (local.get $msg) (i32.const 0x0201))
      (then
        (local.set $x (i32.and (local.get $lParam) (i32.const 0xFFFF)))
        (local.set $y (i32.shr_s (local.get $lParam) (i32.const 16)))
        (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
        (local.set $w (i32.and (local.get $sz) (i32.const 0xFFFF)))
        (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
        (local.set $max (call $lv_max_scroll_for_h (local.get $sw) (local.get $h)))
        (if (i32.and
              (i32.gt_s (local.get $max) (i32.const 0))
              (i32.and (i32.gt_s (local.get $w) (i32.const 16))
                       (i32.ge_s (local.get $x) (i32.sub (local.get $w) (i32.const 16)))))
          (then
            (local.set $hit (call $scroll_arrow_filter_hit
              (local.get $hwnd) (i32.const 1)
              (call $scrollbar_hit_part
                (local.get $h) (local.get $y)
                (call $lv_top_index (local.get $sw)) (i32.const 0) (local.get $max))))
            (if (local.get $hit)
              (then
                (global.set $sb_pressed_hwnd (local.get $hwnd))
                (global.set $sb_pressed_part (local.get $hit))
                (local.set $visible (call $lv_visible_rows_for_h (local.get $sw) (local.get $h)))
                (if (i32.eq (local.get $hit) (i32.const 1))
                  (then (drop (call $lv_scroll_by (local.get $hwnd) (i32.const -1)))))
                (if (i32.eq (local.get $hit) (i32.const 2))
                  (then (drop (call $lv_scroll_by (local.get $hwnd) (i32.const 1)))))
                (if (i32.eq (local.get $hit) (i32.const 3))
                  (then (drop (call $lv_scroll_by
                    (local.get $hwnd) (i32.sub (i32.const 0) (local.get $visible))))))
                (if (i32.eq (local.get $hit) (i32.const 4))
                  (then (drop (call $lv_scroll_by (local.get $hwnd) (local.get $visible)))))
                (if (i32.eq (local.get $hit) (i32.const 5))
                  (then
                    (call $lv_set_drag_anchor_y (local.get $sw) (local.get $y))
                    (call $lv_set_drag_anchor_top (local.get $sw) (call $lv_top_index (local.get $sw)))
                    (global.set $capture_hwnd (local.get $hwnd))))
                (call $paint_flag_set_inv (local.get $hwnd))
                (return (i32.const 1))))))
        (local.set $header_h (call $lv_header_h (local.get $sw)))
        (if (i32.lt_s (local.get $y) (local.get $header_h))
          (then (return (i32.const 0))))
        (local.set $row
          (i32.add (call $lv_top_index (local.get $sw))
            (i32.div_s (i32.sub (local.get $y) (local.get $header_h)) (i32.const 16))))
        (if (i32.and (i32.ge_s (local.get $row) (i32.const 0))
                     (i32.lt_s (local.get $row) (call $lv_item_count (local.get $sw))))
          (then
            (if (i32.eqz (call $lv_select_item (local.get $hwnd) (local.get $sw) (local.get $row)))
              (then (return (i32.const 0))))
            (call $paint_flag_set_inv (local.get $hwnd))
            (return (i32.const 1))))
        (return (i32.const 0))))

    ;; LVM_SETEXTENDEDLISTVIEWSTYLE / LVM_GETEXTENDEDLISTVIEWSTYLE
    (if (i32.eq (local.get $msg) (i32.const 0x1036))
      (then
        (local.set $old (call $lv_ex_style (local.get $sw)))
        (if (local.get $wParam)
          (then
            (call $lv_set_ex_style (local.get $sw)
              (i32.or (i32.and (local.get $old) (i32.xor (local.get $wParam) (i32.const -1)))
                      (i32.and (local.get $lParam) (local.get $wParam)))))
          (else
            (call $lv_set_ex_style (local.get $sw) (local.get $lParam))))
        (return (local.get $old))))
    (if (i32.eq (local.get $msg) (i32.const 0x1037))
      (then (return (call $lv_ex_style (local.get $sw)))))

    ;; LVM_GET/SETBKCOLOR, LVM_GET/SETTEXTCOLOR, LVM_GET/SETTEXTBKCOLOR.
    ;; Store caller-provided COLORREF values exactly so CLR_NONE round-trips.
    (if (i32.eq (local.get $msg) (i32.const 0x1000))
      (then (return (call $lv_bk_color (local.get $sw)))))
    (if (i32.eq (local.get $msg) (i32.const 0x1001))
      (then
        (local.set $old (call $lv_bk_color (local.get $sw)))
        (call $lv_set_bk_color (local.get $sw) (local.get $lParam))
        (call $paint_flag_set_inv (local.get $hwnd))
        (return (local.get $old))))
    (if (i32.eq (local.get $msg) (i32.const 0x1023))
      (then (return (call $lv_text_color (local.get $sw)))))
    (if (i32.eq (local.get $msg) (i32.const 0x1024))
      (then
        (local.set $old (call $lv_text_color (local.get $sw)))
        (call $lv_set_text_color (local.get $sw) (local.get $lParam))
        (call $paint_flag_set_inv (local.get $hwnd))
        (return (local.get $old))))
    (if (i32.eq (local.get $msg) (i32.const 0x1025))
      (then (return (call $lv_text_bk_color (local.get $sw)))))
    (if (i32.eq (local.get $msg) (i32.const 0x1026))
      (then
        (local.set $old (call $lv_text_bk_color (local.get $sw)))
        (call $lv_set_text_bk_color (local.get $sw) (local.get $lParam))
        (call $paint_flag_set_inv (local.get $hwnd))
        (return (local.get $old))))

    ;; WM_ERASEBKGND
    (if (i32.eq (local.get $msg) (i32.const 0x0014))
      (then (return (call $host_erase_background (local.get $hwnd) (i32.const 0)))))

    ;; WM_PAINT
    (if (i32.eq (local.get $msg) (i32.const 0x000F))
      (then
        (local.set $hdc (i32.add (local.get $hwnd) (i32.const 0x40000)))
        (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
        (local.set $w (i32.and (local.get $sz) (i32.const 0xFFFF)))
        (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
        (if (i32.or (i32.le_s (local.get $w) (i32.const 0))
                    (i32.le_s (local.get $h) (i32.const 0)))
          (then (return (i32.const 0))))
        (local.set $max (call $lv_max_scroll_for_h (local.get $sw) (local.get $h)))
        (if (i32.and (i32.gt_s (local.get $max) (i32.const 0))
                     (i32.le_s (local.get $w) (i32.const 16)))
          (then (local.set $max (i32.const 0))))
        (if (i32.gt_s (local.get $max) (i32.const 0))
          (then
            (drop (call $lv_scroll_to_for_h
              (local.get $hwnd) (local.get $sw) (local.get $h) (call $lv_top_index (local.get $sw)))))
          (else
            (drop (call $lv_scroll_to_for_h
              (local.get $hwnd) (local.get $sw) (local.get $h) (i32.const 0)))))
        (local.set $top (call $lv_top_index (local.get $sw)))
        (local.set $header_h (call $lv_header_h (local.get $sw)))
        (local.set $content_right (local.get $w))
        (if (i32.gt_s (local.get $max) (i32.const 0))
          (then (local.set $content_right (i32.sub (local.get $w) (i32.const 16)))))
        (local.set $bk_brush (i32.const 0))
        (if (i32.ne (call $lv_bk_color (local.get $sw)) (i32.const -1))
          (then
            (local.set $bk_brush
              (call $gdi_native_create_solid_brush
                (i32.and (call $lv_bk_color (local.get $sw)) (i32.const 0x00FFFFFF))))))
        ;; CLR_NONE is meaningful for icon views: the shell's desktop has
        ;; already painted wallpaper/COLOR_DESKTOP into the shared surface.
        ;; Report views keep their historical white fallback.
        (if (i32.or
              (i32.eq (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 3)) (i32.const 1))
              (i32.ne (call $lv_bk_color (local.get $sw)) (i32.const -1)))
          (then
            (drop (call $gdi_native_fill_rect (local.get $hdc)
              (i32.const 0) (i32.const 0)
              (local.get $w) (local.get $h)
              (select (local.get $bk_brush) (i32.const 0x30010)
                (i32.ne (local.get $bk_brush) (i32.const 0)))))))
        (if (local.get $bk_brush)
          (then (drop (call $gdi_native_delete_object (local.get $bk_brush)))))
        (drop (call $gdi_native_select_object (local.get $hdc) (i32.const 0x30021)))
        (drop (call $gdi_native_set_bk_mode (local.get $hdc) (i32.const 1)))
        (drop (call $gdi_native_set_text_color (local.get $hdc)
          (i32.and (call $lv_text_color (local.get $sw)) (i32.const 0x00FFFFFF))))

        ;; LVS_ICON/LVS_SMALLICON/LVS_LIST. The desktop is LVS_ICON with
        ;; LVS_ALIGNLEFT|LVS_AUTOARRANGE: arrange 75x70 cells down the left,
        ;; draw the normal image list, and center the callback-resolved label.
        ;; Non-report modes intentionally do not expose report columns/header.
        (if (i32.ne
              (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 3))
              (i32.const 1))
          (then
            (local.set $visible (i32.div_u (local.get $h) (i32.const 70)))
            (if (i32.eqz (local.get $visible))
              (then (local.set $visible (i32.const 1))))
            (local.set $i (i32.const 0))
            (block $icon_items_done (loop $icon_items
              (br_if $icon_items_done
                (i32.ge_u (local.get $i) (call $lv_item_count (local.get $sw))))
              ;; Callback data may not be available during insertion while
              ;; DefView is still constructing its PIDL array. Common controls
              ;; ask again when a row is displayed, so retry unresolved text
              ;; or image fields at the paint boundary.
              (call $lv_resolve_insert_callbacks
                (local.get $hwnd) (local.get $sw) (local.get $i)
                (i32.eqz
                  (i32.load (call $lv_cell_addr
                    (local.get $sw) (local.get $i) (i32.const 0))))
                (i32.eq
                  (i32.load (call $lv_item_image_addr (local.get $sw) (local.get $i)))
                  (i32.const -1)))
              (if (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x0800))
                (then
                  (local.set $x (i32.add (i32.const 8)
                    (i32.mul (i32.div_u (local.get $i) (local.get $visible)) (i32.const 75))))
                  (local.set $y (i32.add (i32.const 8)
                    (i32.mul (i32.rem_u (local.get $i) (local.get $visible)) (i32.const 70)))))
                (else
                  (local.set $width (i32.div_u (local.get $w) (i32.const 75)))
                  (if (i32.eqz (local.get $width)) (then (local.set $width (i32.const 1))))
                  (local.set $x (i32.add (i32.const 8)
                    (i32.mul (i32.rem_u (local.get $i) (local.get $width)) (i32.const 75))))
                  (local.set $y (i32.add (i32.const 8)
                    (i32.mul (i32.div_u (local.get $i) (local.get $width)) (i32.const 70))))))
              (drop (call $lv_paint_normal_icon
                (local.get $hdc) (local.get $sw) (local.get $i)
                (i32.add (local.get $x) (i32.const 20)) (local.get $y)))
              (local.set $cell_g
                (i32.load (call $lv_cell_addr (local.get $sw) (local.get $i) (i32.const 0))))
              (if (local.get $cell_g)
                (then
                  (local.set $cell_w (call $g2w (local.get $cell_g)))
                  (local.set $text_len (call $strlen (local.get $cell_w)))
                  (if (local.get $text_len)
                    (then
                      (drop (call $gdi_native_draw_text
                        (local.get $hdc) (local.get $cell_w) (local.get $text_len)
                        (call $paint_rect
                          (local.get $x) (i32.add (local.get $y) (i32.const 36))
                          (i32.add (local.get $x) (i32.const 72))
                          (i32.add (local.get $y) (i32.const 69)))
                        (i32.const 0x0811) (i32.const 0))))))) ;; CENTER|WORDBREAK|NOPREFIX
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $icon_items)))
            (return (i32.const 0))))

        ;; Header.
        (local.set $col_count (call $lv_col_count (local.get $sw)))
        (if (i32.gt_s (local.get $col_count) (i32.const 0))
          (then
            (drop (call $gdi_native_fill_rect (local.get $hdc)
                    (i32.const 0) (i32.const 0)
                    (local.get $content_right) (local.get $header_h)
                    (i32.const 0x30011)))
            (local.set $widths_w (call $g2w (call $lv_col_widths_ptr (local.get $sw))))
            (local.set $texts_w (call $g2w (call $lv_col_texts_ptr (local.get $sw))))
            (local.set $col_x (i32.const 0))
            (local.set $col_idx (i32.const 0))
            (block $header_done (loop $header_cols
              (br_if $header_done (i32.or
                (i32.ge_u (local.get $col_idx) (local.get $col_count))
                (i32.ge_s (local.get $col_x) (local.get $content_right))))
              (local.set $width (i32.load (i32.add (local.get $widths_w) (i32.mul (local.get $col_idx) (i32.const 4)))))
              (if (i32.le_s (local.get $width) (i32.const 0))
                (then (local.set $width (i32.const 80))))
              (drop (call $gdi_native_draw_edge (local.get $hdc)
                      (local.get $col_x) (i32.const 0)
                      (select (i32.add (local.get $col_x) (local.get $width)) (local.get $content_right)
                              (i32.lt_s (i32.add (local.get $col_x) (local.get $width)) (local.get $content_right)))
                      (local.get $header_h)
                      (i32.const 0x05) (i32.const 0x0F)))
              (local.set $cell_g (i32.load (i32.add (local.get $texts_w) (i32.mul (local.get $col_idx) (i32.const 4)))))
              (if (local.get $cell_g)
                (then
                  (local.set $cell_w (call $g2w (local.get $cell_g)))
                  (local.set $text_len (call $strlen (local.get $cell_w)))
                  (drop (call $gdi_native_text_out (local.get $hdc)
                    (i32.add (local.get $col_x) (i32.const 4)) (i32.const 3)
                    (local.get $cell_w) (local.get $text_len) (i32.const 0)))))
              (local.set $col_x (i32.add (local.get $col_x) (local.get $width)))
              (local.set $col_idx (i32.add (local.get $col_idx) (i32.const 1)))
              (br $header_cols)))))

        ;; Rows.
        (if (call $lv_image_list (local.get $sw))
          (then
            (local.set $icon_brush
              (call $gdi_native_create_solid_brush (i32.const 0x00800000)))))
        (local.set $draw_row (i32.const 0))
        (local.set $visible (call $lv_visible_rows_for_h (local.get $sw) (local.get $h)))
        (block $rows_done (loop $rows
          (br_if $rows_done (i32.ge_u (local.get $draw_row) (local.get $visible)))
          (local.set $row (i32.add (local.get $top) (local.get $draw_row)))
          (br_if $rows_done (i32.ge_u (local.get $row) (call $lv_item_count (local.get $sw))))
          (local.set $y (i32.add (local.get $header_h) (i32.mul (local.get $draw_row) (i32.const 16))))
          (if (i32.lt_s (local.get $y) (local.get $h))
            (then
              (if (i32.and
                    (i32.load (call $lv_item_state_addr (local.get $sw) (local.get $row)))
                    (i32.const 0x0002))
                (then
                  (drop (call $gdi_native_fill_rect (local.get $hdc)
                          (i32.const 0) (local.get $y)
                          (local.get $content_right) (select (i32.add (local.get $y) (i32.const 16)) (local.get $h)
                            (i32.lt_s (i32.add (local.get $y) (i32.const 16)) (local.get $h)))
                          (i32.const 14)))
                  (drop (call $gdi_native_set_text_color (local.get $hdc) (i32.const 0x00FFFFFF)))
                  (drop (call $gdi_native_set_bk_color (local.get $hdc) (i32.const 0x00800000)))
                  (drop (call $gdi_native_set_bk_mode (local.get $hdc) (i32.const 2))))
                (else
                  (drop (call $gdi_native_set_text_color
                    (local.get $hdc)
                    (i32.and (call $lv_text_color (local.get $sw)) (i32.const 0x00FFFFFF))))
                  (if (i32.eq (call $lv_text_bk_color (local.get $sw)) (i32.const -1))
                    (then
                      (drop (call $gdi_native_set_bk_mode (local.get $hdc) (i32.const 1))))
                    (else
                      (drop (call $gdi_native_set_bk_color
                        (local.get $hdc)
                        (i32.and (call $lv_text_bk_color (local.get $sw)) (i32.const 0x00FFFFFF))))
                      (drop (call $gdi_native_set_bk_mode (local.get $hdc) (i32.const 2)))))))
              (local.set $col_count (call $lv_col_count (local.get $sw)))
              (if (i32.eqz (local.get $col_count))
                (then (local.set $col_count (i32.const 1))))
              (local.set $col_x (i32.const 0))
              (local.set $col_idx (i32.const 0))
              (block $row_cols_done (loop $row_cols
                (br_if $row_cols_done (i32.or
                  (i32.ge_u (local.get $col_idx) (local.get $col_count))
                  (i32.ge_s (local.get $col_x) (local.get $content_right))))
                (local.set $width (i32.const 120))
                (if (i32.gt_s (call $lv_col_count (local.get $sw)) (i32.const 0))
                  (then
                    (local.set $widths_w (call $g2w (call $lv_col_widths_ptr (local.get $sw))))
                    (local.set $width (i32.load (i32.add (local.get $widths_w) (i32.mul (local.get $col_idx) (i32.const 4)))))))
                (if (i32.le_s (local.get $width) (i32.const 0))
                  (then (local.set $width (i32.const 80))))
                (local.set $cell_g (i32.load (call $lv_cell_addr (local.get $sw) (local.get $row) (local.get $col_idx))))
                (if (local.get $cell_g)
                  (then
                    (local.set $cell_w (call $g2w (local.get $cell_g)))
                    (local.set $text_len (call $strlen (local.get $cell_w)))
                    ;; Column 0 carries the check box (LVSIL_STATE) and then the
                    ;; small icon, each claiming 17px, and the text starts after
                    ;; whichever of them are present.
                    (local.set $indent (i32.const 4))
                    ;; A row with a state-image index gets a check box, which is
                    ;; what that index selects out of an LVSIL_STATE list. The
                    ;; list itself is not consulted: sndvol32 hands us a NULL
                    ;; one and then sets indices anyway, and the images every
                    ;; caller means are comctl32's own two check boxes.
                    (if (i32.and (i32.eqz (local.get $col_idx))
                          (i32.ne (i32.and
                                    (i32.load (call $lv_item_state_addr (local.get $sw) (local.get $row)))
                                    (i32.const 0xF000))
                                  (i32.const 0)))
                      (then
                        (call $paint_check_box (local.get $hdc)
                          (i32.add (local.get $col_x) (i32.const 3))
                          (i32.add (local.get $y) (i32.const 1))
                          ;; Index 2 is the checked box, 1 the empty one.
                          (i32.eq (i32.and
                                    (i32.load (call $lv_item_state_addr (local.get $sw) (local.get $row)))
                                    (i32.const 0xF000))
                                  (i32.const 0x2000)))
                        (local.set $indent (i32.add (local.get $indent) (i32.const 17)))))
                    (local.set $icon_x
                      (i32.add (local.get $col_x) (i32.sub (local.get $indent) (i32.const 4))))
                    (if (i32.eqz (local.get $col_idx))
                      (then
                        (if (call $lv_image_list (local.get $sw))
                          (then
                            (if (i32.eqz (call $lv_paint_report_icon
                                  (local.get $hdc) (local.get $sw) (local.get $row)
                                  (local.get $icon_x) (local.get $y)))
                              (then
                                ;; Fallback registry/document glyph: outlined page
                                ;; with the blue Win98 registry mark inside.
                                (drop (call $gdi_native_fill_rect (local.get $hdc)
                                  (i32.add (local.get $icon_x) (i32.const 4)) (i32.add (local.get $y) (i32.const 2))
                                  (i32.add (local.get $icon_x) (i32.const 16)) (i32.add (local.get $y) (i32.const 15))
                                  (i32.const 0x30014)))
                                (drop (call $gdi_native_fill_rect (local.get $hdc)
                                  (i32.add (local.get $icon_x) (i32.const 5)) (i32.add (local.get $y) (i32.const 3))
                                  (i32.add (local.get $icon_x) (i32.const 15)) (i32.add (local.get $y) (i32.const 14))
                                  (i32.const 0x30010)))
                                (drop (call $gdi_native_fill_rect (local.get $hdc)
                                  (i32.add (local.get $icon_x) (i32.const 7)) (i32.add (local.get $y) (i32.const 6))
                                  (i32.add (local.get $icon_x) (i32.const 13)) (i32.add (local.get $y) (i32.const 11))
                                  (local.get $icon_brush)))))
                        (local.set $indent (i32.add (local.get $indent) (i32.const 17)))))))
                    (drop (call $gdi_native_text_out (local.get $hdc)
                      (i32.add (local.get $col_x) (local.get $indent))
                      (i32.add (local.get $y) (i32.const 2))
                      (local.get $cell_w) (local.get $text_len) (i32.const 0)))))
                (local.set $col_x (i32.add (local.get $col_x) (local.get $width)))
                (local.set $col_idx (i32.add (local.get $col_idx) (i32.const 1)))
                (br $row_cols)))
              (drop (call $gdi_native_set_text_color (local.get $hdc) (i32.const 0x00000000)))
              (drop (call $gdi_native_set_bk_color (local.get $hdc) (i32.const 0x00FFFFFF)))
              (drop (call $gdi_native_set_bk_mode (local.get $hdc) (i32.const 1)))))
          (local.set $draw_row (i32.add (local.get $draw_row) (i32.const 1)))
          (br $rows)))
        (if (local.get $icon_brush)
          (then (drop (call $gdi_native_delete_object (local.get $icon_brush)))))

        (if (i32.gt_s (local.get $max) (i32.const 0))
          (then
            (local.set $pressed_part
              (select (global.get $sb_pressed_part) (i32.const 0)
                      (i32.eq (global.get $sb_pressed_hwnd) (local.get $hwnd))))
            (call $paint_vscrollbar_rect (local.get $hdc)
              (i32.sub (local.get $w) (i32.const 16)) (i32.const 0)
              (i32.const 16) (local.get $h)
              (local.get $top) (local.get $max) (local.get $pressed_part)
              (call $scroll_arrow_mask (local.get $hwnd) (i32.const 1)))))
        (if (i32.and (call $ctrl_get_ex_style (local.get $hwnd)) (i32.const 0x200))
          (then
            (drop (call $gdi_native_draw_edge (local.get $hdc)
                    (i32.const 0) (i32.const 0)
                    (local.get $w) (local.get $h)
                    (i32.const 0x0A) (i32.const 0x0F)))))
        (return (i32.const 0))))

    (i32.const 0))
