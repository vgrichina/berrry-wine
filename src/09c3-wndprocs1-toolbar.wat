
  ;; ---- Toolbar WndProc ----
  ;;
  ;; Minimal ToolbarWindow32 common-control default proc. WordPad subclasses
  ;; this child with MFC's CToolBar proc, then chains TB_* messages to the
  ;; previous wndproc through CallWindowProcA. Returning a real button count and
  ;; button geometry is enough for MFC's WM_SIZEPARENT layout to allocate a
  ;; visible toolbar instead of collapsing it to its border height.
  ;;
  ;; ToolbarState (80 bytes):
  ;; +0 button_count, +4 button_w, +8 button_h, +12 bitmap_w, +16 bitmap_h,
  ;; +20 rows, +24 tbutton_struct_size, +28 bitmap_count,
  ;; +32 buttons_guest (20-byte TBBUTTON snapshots), +36 capacity,
  ;; +40 pressed_index, +44 hwnd, +48 bitmap_handle,
  ;; +52 image_list, +56 hot_image_list, +60 disabled_image_list,
  ;; +64 style, +68 extended_style, +72 padding packed, +76 hot_index.

  (func $toolbar_ensure_state (param $hwnd i32) (result i32)
    (local $state i32) (local $sw ptr<ToolbarState>) (local $created i32)
    (local.set $state (call $wnd_get_state_ptr (local.get $hwnd)))
    (if (i32.eqz (local.get $state))
      (then
        (local.set $state (call $heap_alloc (i32.const 80)))
        (local.set $created (i32.const 1))))
    (local.set $sw (cast ptr<ToolbarState> (call $g2w (local.get $state))))
    (if (local.get $created)
      (then
        (call $zero_memory (local.get $sw) (i32.const 80))
        (store.field.memarg ToolbarState button_w (local.get $sw) (i32.const 23)) ;; default dxButton
        (store.field.memarg ToolbarState button_h (local.get $sw) (i32.const 22)) ;; default dyButton
        (store.field.memarg ToolbarState bitmap_w (local.get $sw) (i32.const 16)) ;; default dxBitmap
        (store.field.memarg ToolbarState bitmap_h (local.get $sw) (i32.const 15)) ;; default dyBitmap
        (store.field.memarg ToolbarState rows (local.get $sw) (i32.const 1))  ;; one row
        (store.field.memarg ToolbarState tbutton_struct_size (local.get $sw) (i32.const 20)) ;; sizeof(TBBUTTON)
        (store.field.memarg ToolbarState pressed_index (local.get $sw) (i32.const -1))
        (store.field.memarg ToolbarState hot_index (local.get $sw) (i32.const -1))
        (call $wnd_set_state_ptr (local.get $hwnd) (local.get $state))))
    (store.field.memarg ToolbarState hwnd (local.get $sw) (local.get $hwnd))
    (local.get $state))

  (func $toolbar_button_ptr (param $sw ptr<ToolbarState>) (param $idx i32) (result i32)
    (i32.add
      (call $g2w (load.field.memarg ToolbarState buttons_guest (local.get $sw)))
      (i32.mul (local.get $idx) (i32.const 20))))

  (func $toolbar_memmove_right (param $src i32) (param $n i32) (param $shift i32)
    ;; Move n bytes from src to src+shift. The hand loop copied backward for
    ;; overlap safety, which is memmove — memory.copy is specified as memmove,
    ;; so it replaces the loop exactly, shift>0 or not.
    (if (i32.or (i32.eqz (local.get $n)) (i32.eqz (local.get $shift)))
      (then (return)))
    (memory.copy
      (i32.add (local.get $src) (local.get $shift))
      (local.get $src)
      (local.get $n)))

  (func $toolbar_child_combo_raw_width_by_cmd
    (param $toolbar_hwnd i32) (param $cmd i32) (result i32)
    (local $slot i32) (local $ch i32) (local $wh i32)
    (local.set $slot (i32.const 0))
    (block $done (loop $scan
      (local.set $slot (call $wnd_next_child_slot (local.get $toolbar_hwnd) (local.get $slot)))
      (br_if $done (i32.lt_s (local.get $slot) (i32.const 0)))
      (local.set $ch (call $wnd_slot_hwnd (local.get $slot)))
      (if (i32.and
            (i32.eq (call $ctrl_table_get_class (local.get $ch)) (i32.const 5))
            (i32.eq (call $ctrl_table_get_id (local.get $ch)) (local.get $cmd)))
        (then
          (local.set $wh (call $ctrl_get_wh_packed (local.get $ch)))
          (return (i32.and (local.get $wh) (i32.const 0xFFFF)))))
      (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  ;; Shared item sizing. Negotiation must use raw sibling widths, so the
  ;; caller explicitly chooses whether embedded combo widths are constrained.
  (func $toolbar_button_width_core (param $sw ptr<ToolbarState>) (param $idx i32)
    (param $constrain i32) (result i32)
    (local $count i32) (local $rec i32) (local $width i32) (local $combo_width i32)
    (local.set $width (load.field.memarg ToolbarState button_w (local.get $sw)))
    (if (i32.le_s (local.get $width) (i32.const 0))
      (then (local.set $width (i32.const 23))))
    (local.set $count (load.field ToolbarState button_count (local.get $sw)))
    (if (i32.or
          (i32.eqz (load.field.memarg ToolbarState buttons_guest (local.get $sw)))
          (i32.ge_u (local.get $idx) (local.get $count)))
      (then (return (local.get $width))))
    (local.set $rec (call $toolbar_button_ptr (local.get $sw) (local.get $idx)))
    ;; TBSTYLE_SEP uses iBitmap as its width unless a matching embedded combo
    ;; supplies the width. Both modes share the same fallback bounds.
    (if (i32.and (i32.load8_u offset=9 (local.get $rec)) (i32.const 0x01))
      (then
        (local.set $combo_width
          (if (result i32) (local.get $constrain)
            (then (call $toolbar_child_combo_width_by_cmd
              (local.get $sw) (i32.load offset=4 (local.get $rec))))
            (else (call $toolbar_child_combo_raw_width_by_cmd
              (load.field.memarg ToolbarState hwnd (local.get $sw))
              (i32.load offset=4 (local.get $rec))))))
        (if (i32.gt_s (local.get $combo_width) (i32.const 0))
          (then (return (local.get $combo_width))))
        (local.set $width (i32.load (local.get $rec)))
        (if (i32.or
              (i32.lt_s (local.get $width) (i32.const 4))
              (i32.gt_s (local.get $width) (i32.const 512)))
          (then (local.set $width (i32.const 8))))))
    (local.get $width))

  ;; Unconstrained sizing breaks the large-combo negotiation's recursion.
  (func $toolbar_button_raw_width (param $sw ptr<ToolbarState>) (param $idx i32) (result i32)
    (call $toolbar_button_width_core (local.get $sw) (local.get $idx) (i32.const 0)))

  (func $toolbar_child_combo_width_by_cmd (param $sw ptr<ToolbarState>) (param $cmd i32) (result i32)
    (local $toolbar_hwnd i32) (local $combo_width i32)
    (local $parent i32) (local $parent_w i32) (local $cap i32)
    (local $i i32) (local $count i32) (local $rec i32) (local $fixed_width i32)
    (local.set $toolbar_hwnd (load.field.memarg ToolbarState hwnd (local.get $sw)))
    (if (i32.eqz (local.get $toolbar_hwnd)) (then (return (i32.const 0))))
    (local.set $combo_width
      (call $toolbar_child_combo_raw_width_by_cmd
        (local.get $toolbar_hwnd) (local.get $cmd)))
    ;; Some MFC toolbars create a wide combo before the containing control bar
    ;; receives its final narrow width. Native common controls negotiate the
    ;; embedded item against its sibling TBBUTTON widths. Do the same for large
    ;; toolbar-hosted combos, leaving small combos and wide windows unchanged.
    (if (i32.gt_s (local.get $combo_width) (i32.const 160))
      (then
        (local.set $parent (call $wnd_get_parent (local.get $toolbar_hwnd)))
        (if (local.get $parent)
          (then
            (local.set $parent_w (call $wnd_client_w_for_clip (local.get $parent)))))
        (if (i32.gt_s (local.get $parent_w) (i32.const 0))
          (then
            ;; Layout starts at x=2. Sum every raw sibling width, skipping only
            ;; this combo's separator slot, so the last button remains in bounds.
            (local.set $fixed_width (i32.const 2))
            (local.set $count (load.field ToolbarState button_count (local.get $sw)))
            (local.set $i (i32.const 0))
            (block $widths_done (loop $widths
              (br_if $widths_done (i32.ge_u (local.get $i) (local.get $count)))
              (local.set $rec (call $toolbar_button_ptr (local.get $sw) (local.get $i)))
              (if (i32.eqz
                    (i32.and
                      (i32.and (i32.load8_u offset=9 (local.get $rec)) (i32.const 0x01))
                      (i32.eq (i32.load offset=4 (local.get $rec)) (local.get $cmd))))
                (then
                  (local.set $fixed_width
                    (i32.add
                      (local.get $fixed_width)
                      (call $toolbar_button_raw_width (local.get $sw) (local.get $i))))))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $widths)))
            (local.set $cap (i32.sub (local.get $parent_w) (local.get $fixed_width)))
            (if (i32.lt_s (local.get $cap) (i32.const 80))
              (then (local.set $cap (i32.const 80))))
            (if (i32.gt_s (local.get $combo_width) (local.get $cap))
              (then (local.set $combo_width (local.get $cap))))))))
    (local.get $combo_width))

  (func $toolbar_ensure_capacity (param $sw ptr<ToolbarState>) (param $want i32) (result i32)
    (local $cap i32) (local $new_cap i32) (local $new_items i32)
    (local.set $cap (load.field.memarg ToolbarState capacity (local.get $sw)))
    (if (i32.le_u (local.get $want) (local.get $cap))
      (then (return (i32.const 1))))
    (local.set $new_cap (local.get $cap))
    (if (i32.eqz (local.get $new_cap))
      (then (local.set $new_cap (i32.const 8))))
    (block $done (loop $grow
      (br_if $done (i32.ge_u (local.get $new_cap) (local.get $want)))
      (local.set $new_cap (i32.mul (local.get $new_cap) (i32.const 2)))
      (br $grow)))
    (local.set $new_items
      (call $heap_realloc
        (load.field.memarg ToolbarState buttons_guest (local.get $sw))
        (i32.mul (local.get $new_cap) (i32.const 20))
        (i32.const 0x40)))
    (if (i32.eqz (local.get $new_items))
      (then (return (i32.const 0))))
    (store.field.memarg ToolbarState buttons_guest (local.get $sw) (local.get $new_items))
    (store.field.memarg ToolbarState capacity (local.get $sw) (local.get $new_cap))
    (i32.const 1))

  (func $toolbar_init_button (param $dst i32) (param $idx i32)
    (call $zero_memory (local.get $dst) (i32.const 20))
    (i32.store        (local.get $dst) (local.get $idx)) ;; iBitmap fallback
    (i32.store8 offset=8 (local.get $dst) (i32.const 4)) ;; TBSTATE_ENABLED
    (i32.store8 offset=9 (local.get $dst) (i32.const 0))) ;; TBSTYLE_BUTTON

  (func $toolbar_copy_button_in
    (param $dst i32) (param $src_guest i32) (param $src_size i32) (param $idx i32)
    (local $src i32) (local $copy i32)
    (call $toolbar_init_button (local.get $dst) (local.get $idx))
    (if (i32.eqz (local.get $src_guest)) (then (return)))
    (local.set $copy (local.get $src_size))
    (if (i32.gt_u (local.get $copy) (i32.const 20))
      (then (local.set $copy (i32.const 20))))
    (if (i32.eqz (local.get $copy)) (then (return)))
    (local.set $src (call $g2w (local.get $src_guest)))
    (call $memcpy (local.get $dst) (local.get $src) (local.get $copy)))

  (func $toolbar_find_command_index (param $sw ptr<ToolbarState>) (param $cmd i32) (result i32)
    (local $i i32) (local $count i32) (local $rec i32)
    (if (i32.eqz (load.field.memarg ToolbarState buttons_guest (local.get $sw)))
      (then (return (i32.const -1))))
    (local.set $count (load.field ToolbarState button_count (local.get $sw)))
    (local.set $i (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $rec (call $toolbar_button_ptr (local.get $sw) (local.get $i)))
      (if (i32.eq (i32.load offset=4 (local.get $rec)) (local.get $cmd))
        (then (return (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const -1))

  (func $toolbar_button_width (param $sw ptr<ToolbarState>) (param $idx i32) (result i32)
    (call $toolbar_button_width_core (local.get $sw) (local.get $idx) (i32.const 1)))

  (func $toolbar_layout_width (param $sw ptr<ToolbarState>) (result i32)
    (local $hwnd i32) (local $parent i32) (local $wh i32) (local $w i32) (local $parent_w i32)
    (local.set $hwnd (load.field.memarg ToolbarState hwnd (local.get $sw)))
    (if (local.get $hwnd)
      (then
        (local.set $wh (call $ctrl_get_wh_packed (local.get $hwnd)))
        (local.set $w (i32.and (local.get $wh) (i32.const 0xFFFF)))
        (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
        (if (local.get $parent)
          (then
            (local.set $parent_w (call $wnd_client_w_for_clip (local.get $parent)))))
        (if (i32.gt_s (local.get $parent_w) (i32.const 0))
          (then
            (if (i32.or
                  (i32.le_s (local.get $w) (i32.const 0))
                  (i32.gt_s (local.get $w) (i32.add (local.get $parent_w) (i32.const 8))))
              (then (local.set $w (local.get $parent_w))))))))
    (if (i32.le_s (local.get $w) (i32.const 0))
      (then (local.set $w (i32.const 160))))
    (local.get $w))

  (func $toolbar_button_rect (param $sw ptr<ToolbarState>) (param $idx i32) (param $rect i32) (result i32)
    (local $i i32) (local $count i32) (local $left i32) (local $top i32)
    (local $bw i32) (local $bh i32) (local $limit i32)
    (local.set $count (load.field ToolbarState button_count (local.get $sw)))
    (if (i32.or
          (i32.eqz (local.get $rect))
          (i32.ge_u (local.get $idx) (local.get $count)))
      (then (return (i32.const 0))))
    (local.set $bh (load.field.memarg ToolbarState button_h (local.get $sw)))
    (if (i32.le_s (local.get $bh) (i32.const 0))
      (then (local.set $bh (i32.const 22))))
    (local.set $limit (call $toolbar_layout_width (local.get $sw)))
    (if (i32.lt_s (local.get $limit) (i32.const 24))
      (then (local.set $limit (i32.const 24))))
    (local.set $left (i32.const 2))
    (local.set $top (i32.const 2))
    (local.set $i (i32.const 0))
    (block $done (loop $sum
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $bw (call $toolbar_button_width (local.get $sw) (local.get $i)))
      (if (i32.and
            (i32.gt_s (local.get $left) (i32.const 2))
            (i32.gt_s (i32.add (local.get $left) (local.get $bw)) (local.get $limit)))
        (then
          (local.set $left (i32.const 2))
          (local.set $top (i32.add (local.get $top) (i32.add (local.get $bh) (i32.const 2))))))
      (if (i32.eq (local.get $i) (local.get $idx))
        (then
          (i32.store        (local.get $rect) (local.get $left))
          (i32.store offset=4  (local.get $rect) (local.get $top))
          (i32.store offset=8  (local.get $rect) (i32.add (local.get $left) (local.get $bw)))
          (i32.store offset=12 (local.get $rect) (i32.add (local.get $top) (local.get $bh)))
          (return (i32.const 1))))
      (local.set $left (i32.add (local.get $left) (local.get $bw)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $sum)))
    (i32.const 0))

  (func $toolbar_calc_rows (param $sw ptr<ToolbarState>) (result i32)
    (local $i i32) (local $count i32) (local $left i32) (local $bw i32)
    (local $limit i32) (local $rows i32)
    (local.set $count (load.field ToolbarState button_count (local.get $sw)))
    (local.set $limit (call $toolbar_layout_width (local.get $sw)))
    (if (i32.lt_s (local.get $limit) (i32.const 24))
      (then (local.set $limit (i32.const 24))))
    (local.set $left (i32.const 2))
    (local.set $rows (i32.const 1))
    (local.set $i (i32.const 0))
    (block $done (loop $sum
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $bw (call $toolbar_button_width (local.get $sw) (local.get $i)))
      (if (i32.and
            (i32.gt_s (local.get $left) (i32.const 2))
            (i32.gt_s (i32.add (local.get $left) (local.get $bw)) (local.get $limit)))
        (then
          (local.set $left (i32.const 2))
          (local.set $rows (i32.add (local.get $rows) (i32.const 1)))))
      (local.set $left (i32.add (local.get $left) (local.get $bw)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $sum)))
    (local.get $rows))

  ;; Re-lay-out a combobox's own children after the control itself is resized.
  ;; MFC creates a toolbar combo at its template width -- WordPad's is 288 --
  ;; and the toolbar then moves it to the button rect, 110 wide. Nothing
  ;; resized the inner edit and listbox, so a 268-wide edit stayed sitting
  ;; across the 110-wide control: it covered the drop arrow (which is why the
  ;; box appeared to have none) and it swallowed clicks meant for the field.
  ;; The geometry is the same arithmetic WM_CREATE uses.
  ;; How much of a combobox's window rect may claim a click.
  ;;
  ;; Our combobox is created at its full dropped height -- WordPad's font box is
  ;; 110x200 -- with the list as an inner child that is shown and hidden. So its
  ;; window rect covers a large part of the frame even while the list is closed,
  ;; and anything that hit-tests by window rect swallows clicks belonging to
  ;; whatever is drawn over that area. A menu popup is drawn over exactly that
  ;; area: WordPad's File menu drops at 7,40 180x284 and the font combo occupies
  ;; 6,74 110x200 underneath it, so making comboboxes hit-testable outside
  ;; dialogs stopped every menu item from responding. Closed, a combobox owns
  ;; its field and nothing more.
  (func $combobox_hit_h (param $hwnd i32) (param $full_h i32) (result i32)
    (local $state_g i32) (local $state_w ptr<ComboBoxState>)
    (if (i32.eq (global.get $combo_open_hwnd) (local.get $hwnd))
      (then (return (local.get $full_h))))
    (local.set $state_g (call $wnd_get_state_ptr (local.get $hwnd)))
    (if (local.get $state_g)
      (then
        (local.set $state_w (cast ptr<ComboBoxState> (call $g2w (local.get $state_g))))
        (if (load.field.memarg ComboBoxState variant (local.get $state_w))
          (then (return (local.get $full_h))))))
    (if (i32.gt_s (local.get $full_h) (i32.const 21))
      (then (return (i32.const 21))))
    (local.get $full_h))

  (func $combobox_relayout_children (param $hwnd i32)
    (local $state_g i32) (local $state_w i32) (local $w i32) (local $h i32)
    (local $field_h i32) (local $edit i32) (local $lb i32)
    (local.set $state_g (call $wnd_get_state_ptr (local.get $hwnd)))
    (if (i32.eqz (local.get $state_g)) (then (return)))
    (local.set $state_w (call $g2w (local.get $state_g)))
    (local.set $field_h (i32.const 21))
    (local.set $w (i32.and (call $ctrl_get_wh_packed (local.get $hwnd)) (i32.const 0xFFFF)))
    (local.set $h (i32.shr_u (call $ctrl_get_wh_packed (local.get $hwnd)) (i32.const 16)))
    (if (i32.le_s (local.get $w) (i32.const 24)) (then (return)))
    (local.set $edit (load.field.memarg ComboBoxState edit_hwnd (local.get $state_w)))
    (if (local.get $edit)
      (then
        (call $host_move_window (local.get $edit) (i32.const 2) (i32.const 2)
          (i32.sub (local.get $w) (i32.const 20))
          (i32.sub (local.get $field_h) (i32.const 4)) (i32.const 0))
        (call $ctrl_geom_sync (local.get $edit) (i32.const 2) (i32.const 2)
          (i32.sub (local.get $w) (i32.const 20))
          (i32.sub (local.get $field_h) (i32.const 4)) (i32.const 0))))
    (local.set $lb (load.field.memarg ComboBoxState lb_hwnd (local.get $state_w)))
    (if (local.get $lb)
      (then
        (local.set $h (i32.sub (local.get $h) (local.get $field_h)))
        (if (i32.lt_s (local.get $h) (i32.const 32)) (then (local.set $h (i32.const 64))))
        (call $host_move_window (local.get $lb) (i32.const 0) (local.get $field_h)
          (local.get $w) (local.get $h) (i32.const 0))
        (call $ctrl_geom_sync (local.get $lb) (i32.const 0) (local.get $field_h)
          (local.get $w) (local.get $h) (i32.const 0))))
    ;; The field was painted at the old width -- the drop arrow sits at
    ;; w - 18, so a resize leaves it drawn off in the wrong place, or off the
    ;; control entirely. Ask for a repaint at the new size.
    (call $paint_flag_set_inv (local.get $hwnd))
    (if (local.get $edit) (then (call $paint_flag_set_inv (local.get $edit)))))

  (func $toolbar_sync_child_combos (param $sw ptr<ToolbarState>)
    (local $toolbar_hwnd i32) (local $slot i32) (local $ch i32) (local $child_id i32)
    (local $i i32) (local $count i32) (local $rec i32)
    (local $left i32) (local $top i32) (local $right i32) (local $brect i32)
    (local.set $toolbar_hwnd (load.field.memarg ToolbarState hwnd (local.get $sw)))
    (if (i32.eqz (local.get $toolbar_hwnd)) (then (return)))
    (if (i32.eqz (load.field.memarg ToolbarState buttons_guest (local.get $sw))) (then (return)))
    (local.set $count (load.field ToolbarState button_count (local.get $sw)))
    (local.set $slot (i32.const 0))
    (block $children_done (loop $children
      (local.set $slot
        (call $wnd_next_child_slot (local.get $toolbar_hwnd) (local.get $slot)))
      (br_if $children_done (i32.lt_s (local.get $slot) (i32.const 0)))
      (local.set $ch (call $wnd_slot_hwnd (local.get $slot)))
      (if (i32.eq (call $ctrl_table_get_class (local.get $ch)) (i32.const 5))
        (then
          (local.set $child_id (call $ctrl_table_get_id (local.get $ch)))
          (local.set $i (i32.const 0))
          (block $matched (loop $buttons
            (br_if $matched (i32.ge_u (local.get $i) (local.get $count)))
            (local.set $rec (call $toolbar_button_ptr (local.get $sw) (local.get $i)))
            (local.set $brect (call $paint_scratch_take))
            (if (i32.and
                  (i32.and
                    (i32.and (i32.load8_u offset=9 (local.get $rec)) (i32.const 0x01))
                    (i32.eq (i32.load offset=4 (local.get $rec)) (local.get $child_id)))
                  (call $toolbar_button_rect (local.get $sw) (local.get $i) (local.get $brect)))
              (then
                (local.set $left (load.field PaintRect left (local.get $brect)))
                (local.set $top (load.field.memarg PaintRect top (local.get $brect)))
                (local.set $right (load.field.memarg PaintRect right (local.get $brect)))
                (call $host_move_window
                  (local.get $ch)
                  (local.get $left)
                  (local.get $top)
                  (i32.sub (local.get $right) (local.get $left))
                  (i32.const 200)
                  (i32.const 0))
                (call $ctrl_geom_sync
                  (local.get $ch)
                  (local.get $left)
                  (local.get $top)
                  (i32.sub (local.get $right) (local.get $left))
                  (i32.const 200)
                  (i32.const 0))
                (call $defwndproc_do_nccalcsize (local.get $ch))
                (call $combobox_relayout_children (local.get $ch))
                (br $matched)))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $buttons)))))
      (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
      (br $children))))

  (func $toolbar_update_state_bit
    (param $sw i32) (param $cmd i32) (param $mask i32) (param $on i32) (result i32)
    (local $idx i32) (local $rec i32) (local $state i32)
    (local.set $idx (call $toolbar_find_command_index (local.get $sw) (local.get $cmd)))
    (if (i32.lt_s (local.get $idx) (i32.const 0))
      (then (return (i32.const 0))))
    (local.set $rec (call $toolbar_button_ptr (local.get $sw) (local.get $idx)))
    (local.set $state (i32.load8_u offset=8 (local.get $rec)))
    (if (i32.and (local.get $on) (i32.const 0xFFFF))
      (then
        (local.set $state (i32.or (local.get $state) (local.get $mask))))
      (else
        (local.set $state
          (i32.and (local.get $state) (i32.xor (local.get $mask) (i32.const -1))))))
    (i32.store8 offset=8 (local.get $rec) (local.get $state))
    (i32.const 1))

  (func $toolbar_hit_test (param $sw ptr<ToolbarState>) (param $x i32) (param $y i32) (result i32)
    (local $idx i32) (local $left i32) (local $top i32) (local $right i32) (local $bottom i32)
    (local $rec i32) (local $brect i32)
    (if (i32.or (i32.lt_s (local.get $x) (i32.const 2))
                (i32.lt_s (local.get $y) (i32.const 2)))
      (then (return (i32.const -1))))
    (local.set $idx (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $idx) (load.field ToolbarState button_count (local.get $sw))))
      (local.set $brect (call $paint_scratch_take))
      (if (i32.eqz (call $toolbar_button_rect (local.get $sw) (local.get $idx) (local.get $brect)))
        (then (return (i32.const -1))))
      (local.set $left (load.field PaintRect left (local.get $brect)))
      (local.set $top (load.field.memarg PaintRect top (local.get $brect)))
      (local.set $right (load.field.memarg PaintRect right (local.get $brect)))
      (local.set $bottom (load.field.memarg PaintRect bottom (local.get $brect)))
      (if (i32.and
            (i32.and
              (i32.ge_s (local.get $x) (local.get $left))
              (i32.lt_s (local.get $x) (local.get $right)))
            (i32.and
              (i32.ge_s (local.get $y) (local.get $top))
              (i32.lt_s (local.get $y) (local.get $bottom))))
        (then
          (if (load.field.memarg ToolbarState buttons_guest (local.get $sw))
            (then
              (local.set $rec (call $toolbar_button_ptr (local.get $sw) (local.get $idx)))
              (if (i32.or
                    (i32.and (i32.load8_u offset=8 (local.get $rec)) (i32.const 0x08))
                    (i32.and (i32.load8_u offset=9 (local.get $rec)) (i32.const 0x01)))
                (then (return (i32.const -1))))))
          (return (local.get $idx))))
      (local.set $idx (i32.add (local.get $idx) (i32.const 1)))
      (br $scan)))
    (i32.const -1))

  ;; Image-list handles in this runtime are guest pointers to the bounded
  ;; 24-byte ImageList record created by ImageList_Create/LoadImage. Toolbar
  ;; messages are also used by probes that pass opaque sentinel handles, so
  ;; validate both the translated address and record geometry before painting.
  (func $toolbar_imagelist_ptr (param $himl i32) (result i32)
    (local $wa i32) (local $cx i32) (local $cy i32)
    (if (i32.eqz (local.get $himl)) (then (return (i32.const 0))))
    (if (i32.lt_u (local.get $himl) (global.get $image_base))
      (then (return (i32.const 0))))
    (local.set $wa (call $g2w (local.get $himl)))
    (if (i32.gt_u
          (local.get $wa)
          (i32.sub (i32.shl (memory.size) (i32.const 16)) (i32.const 24)))
      (then (return (i32.const 0))))
    (local.set $cx (i32.load (local.get $wa)))
    (local.set $cy (i32.load offset=4 (local.get $wa)))
    (if (i32.or
          (i32.or (i32.le_s (local.get $cx) (i32.const 0))
                  (i32.gt_s (local.get $cx) (i32.const 256)))
          (i32.or (i32.le_s (local.get $cy) (i32.const 0))
                  (i32.gt_s (local.get $cy) (i32.const 256))))
      (then (return (i32.const 0))))
    (local.get $wa))

  (func $toolbar_repaint_now (param $hwnd i32)
    ;; Queue the common-control repaint through USER instead of drawing it
    ;; synchronously during layout. A direct child draw can be overwritten by
    ;; a still-dirty application-owned control-bar ancestor; the paint pump
    ;; orders that ancestor first and then drains this native child.
    (call $paint_flag_set_inv (local.get $hwnd)))

  (func $toolbar_autosize (param $hwnd i32)
    (local $idx i32) (local $state i32) (local $sw ptr<ToolbarState>) (local $parent i32)
    (local $xy i32) (local $wh i32) (local $x i32) (local $y i32)
    (local $w i32) (local $h i32) (local $parent_w i32) (local $rows i32) (local $bh i32)
    (local.set $idx (call $wnd_table_find (local.get $hwnd)))
    (if (i32.eq (local.get $idx) (i32.const -1)) (then (return)))
    (local.set $state (call $toolbar_ensure_state (local.get $hwnd)))
    (local.set $sw (cast ptr<ToolbarState> (call $g2w (local.get $state))))
    (local.set $xy (call $ctrl_get_xy_packed (local.get $hwnd)))
    (local.set $wh (call $ctrl_get_wh_packed (local.get $hwnd)))
    (local.set $x (i32.shr_s (i32.shl (local.get $xy) (i32.const 16)) (i32.const 16)))
    (local.set $y (i32.shr_s (local.get $xy) (i32.const 16)))
    (local.set $w (i32.and (local.get $wh) (i32.const 0xFFFF)))
    (local.set $h (i32.shr_u (local.get $wh) (i32.const 16)))
    (if (i32.le_s (local.get $w) (i32.const 0))
      (then
        (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
        (if (local.get $parent)
          (then (local.set $w (call $wnd_client_w_for_clip (local.get $parent)))))))
    (if (i32.le_s (local.get $w) (i32.const 0)) (then (local.set $w (i32.const 160))))
    ;; MFC control bars can cache the toolbar's ideal button span, then move
    ;; the child with SWP_NOSIZE. Keep the real child surface bounded by the
    ;; containing bar so oversized formatting toolbars do not allocate/dump as
    ;; multi-screen-wide children while still letting button positions extend
    ;; within the clipped parent.
    (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
    (if (local.get $parent)
      (then
        (local.set $parent_w (call $wnd_client_w_for_clip (local.get $parent)))
        (if (i32.and
              (i32.gt_s (local.get $parent_w) (i32.const 0))
              (i32.gt_s (local.get $w) (i32.add (local.get $parent_w) (i32.const 8))))
          (then (local.set $w (local.get $parent_w))))))
    (local.set $rows (call $toolbar_calc_rows (local.get $sw)))
    (if (i32.lt_s (local.get $rows) (i32.const 1))
      (then (local.set $rows (i32.const 1))))
    (store.field.memarg ToolbarState rows (local.get $sw) (local.get $rows))
    (local.set $bh (load.field.memarg ToolbarState button_h (local.get $sw)))
    (if (i32.le_s (local.get $bh) (i32.const 0))
      (then (local.set $bh (i32.const 22))))
    (local.set $h
      (i32.add
        (i32.add
          (i32.mul (local.get $rows) (local.get $bh))
          (i32.mul (i32.sub (local.get $rows) (i32.const 1)) (i32.const 2)))
        (i32.const 6)))
    (if (i32.lt_s (local.get $h) (i32.const 24)) (then (local.set $h (i32.const 24))))
    (call $host_move_window (local.get $hwnd) (local.get $x) (local.get $y) (local.get $w) (local.get $h) (i32.const 0))
    (call $ctrl_geom_set (local.get $idx) (local.get $x) (local.get $y) (local.get $w) (local.get $h))
    (call $defwndproc_do_nccalcsize (local.get $hwnd))
    (call $toolbar_sync_child_combos (local.get $sw))
    (call $paint_flag_set_inv (local.get $hwnd))
    (call $toolbar_repaint_now (local.get $hwnd)))

  (func $toolbar_wndproc (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $state i32) (local $sw ptr<ToolbarState>) (local $hdc i32)
    (local $sz i32) (local $w i32) (local $h i32)
    (local $count i32) (local $i i32) (local $left i32) (local $top i32)
    (local $bw i32) (local $bh i32) (local $old i32) (local $rect i32)
    (local $src i32) (local $dst i32) (local $copy i32) (local $idx i32)
    (local $rec i32) (local $cmd i32) (local $parent i32)
    (local $x i32) (local $y i32) (local $state_byte i32) (local $hit i32)
    (local $bmp i32) (local $bmp_w i32) (local $bmp_h i32)
    (local $bmp_draw_w i32) (local $bmp_draw_h i32) (local $bmp_src_x i32)
    (local $bmp_dst_x i32) (local $bmp_dst_y i32) (local $memdc i32)
    (local $drawn i32) (local $image_list i32) (local $image_sw i32)
    (local $mask_color i32) (local $use_disabled_effect i32) (local $is_hot i32)
    (local $brect i32)

    (local.set $state
      (if (result i32) (i32.eq (local.get $msg) (i32.const 0x0002))
        (then (call $wnd_get_state_ptr (local.get $hwnd)))
        (else (call $toolbar_ensure_state (local.get $hwnd)))))
    (if (local.get $state)
      (then (local.set $sw (cast ptr<ToolbarState> (call $g2w (local.get $state))))))

    ;; WM_DESTROY
    (if (i32.eq (local.get $msg) (i32.const 0x0002))
      (then
        (if (local.get $state)
          (then
            (if (load.field.memarg ToolbarState buttons_guest (local.get $sw))
              (then (call $heap_free (load.field.memarg ToolbarState buttons_guest (local.get $sw)))))
            (call $heap_free (local.get $state))
            (call $wnd_set_state_ptr (local.get $hwnd) (i32.const 0))))
        (return (i32.const 0))))

    ;; WM_CREATE
    (if (i32.eq (local.get $msg) (i32.const 0x0001))
      (then
        (call $toolbar_autosize (local.get $hwnd))
        (return (i32.const 0))))

    ;; WM_ERASEBKGND
    (if (i32.eq (local.get $msg) (i32.const 0x0014))
      (then
        (drop (call $host_erase_background (local.get $hwnd) (i32.const 16)))
        (return (i32.const 1))))

    ;; TB_BUTTONSTRUCTSIZE (WM_USER+30): remember caller's TBBUTTON size.
    (if (i32.eq (local.get $msg) (i32.const 0x041E))
      (then
        (if (local.get $wParam)
          (then (store.field.memarg ToolbarState tbutton_struct_size (local.get $sw) (local.get $wParam))))
        (return (i32.const 1))))

    ;; TB_ADDBITMAP (WM_USER+19): remember the caller's bitmap strip and
    ;; return the first allocated bitmap index.
    (if (i32.eq (local.get $msg) (i32.const 0x0413))
      (then
        (local.set $old (load.field.memarg ToolbarState bitmap_count (local.get $sw)))
        (local.set $bmp (i32.const 0))
        (if (local.get $lParam)
          (then
            (local.set $src (call $g2w (local.get $lParam)))
            (if (i32.eqz (i32.load (local.get $src)))
              (then
                ;; hInst == NULL: nID is already an HBITMAP.
                (local.set $bmp (i32.load offset=4 (local.get $src))))
              (else
                ;; hInst == HINST_COMMCTRL (-1) names a built-in common-control
                ;; strip; other non-NULL hInst values name app/DLL resources.
                (local.set $cmd (i32.load offset=4 (local.get $src)))
                (if (i32.le_u (local.get $cmd) (i32.const 0xFFFF))
                  (then
                    (local.set $cmd (i32.and (local.get $cmd) (i32.const 0xFFFF)))))
                (local.set $bmp
                  (call $gdi_native_load_bitmap
                    (i32.load (local.get $src))
                    (local.get $cmd)))))))
        (if (local.get $bmp)
          (then
            (local.set $bmp_w (call $gdi_native_get_object_w (local.get $bmp)))
            (if (i32.gt_s (local.get $bmp_w) (i32.const 0))
              (then
                ;; Bounded toolbar model: one strip per toolbar. Keep the
                ;; first valid strip so returned iBitmap bases keep indexing
                ;; into the original image list.
                (if (i32.eqz (load.field.memarg ToolbarState bitmap_handle (local.get $sw)))
                  (then (store.field.memarg ToolbarState bitmap_handle (local.get $sw) (local.get $bmp))))))))
        (store.field.memarg ToolbarState bitmap_count (local.get $sw)
          (i32.add (local.get $old) (local.get $wParam)))
        (call $toolbar_repaint_now (local.get $hwnd))
        (return (local.get $old))))

    ;; TB_ADDBUTTONSA / TB_ADDBUTTONSW: TBBUTTON itself contains no encoded
    ;; text, so both messages share the same record-copy path. Media Player 32
    ;; uses the Unicode message even for image-only buttons.
    (if (i32.or
          (i32.eq (local.get $msg) (i32.const 0x0414))
          (i32.eq (local.get $msg) (i32.const 0x0444)))
      (then
        (if (i32.gt_u (local.get $wParam) (i32.const 0))
          (then
            (local.set $count (load.field ToolbarState button_count (local.get $sw)))
            (if (i32.eqz
                  (call $toolbar_ensure_capacity
                    (local.get $sw)
                    (i32.add (local.get $count) (local.get $wParam))))
              (then (return (i32.const 0))))
            (local.set $i (i32.const 0))
            (block $done (loop $copy_buttons
              (br_if $done (i32.ge_u (local.get $i) (local.get $wParam)))
              (local.set $dst
                (call $toolbar_button_ptr
                  (local.get $sw)
                  (i32.add (local.get $count) (local.get $i))))
              (local.set $src (i32.const 0))
              (if (local.get $lParam)
                (then
                  (local.set $src
                    (i32.add
                      (local.get $lParam)
                      (i32.mul (local.get $i) (load.field.memarg ToolbarState tbutton_struct_size (local.get $sw)))))))
              (call $toolbar_copy_button_in
                (local.get $dst)
                (local.get $src)
                (load.field.memarg ToolbarState tbutton_struct_size (local.get $sw))
                (i32.add (local.get $count) (local.get $i)))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $copy_buttons)))
            (store.field ToolbarState button_count (local.get $sw)
              (i32.add (local.get $count) (local.get $wParam)))))
        (call $toolbar_autosize (local.get $hwnd))
        (return (i32.const 1))))

    ;; TB_INSERTBUTTONA/W: insert one TBBUTTON at wParam. TBBUTTON itself is
    ;; encoding-neutral; only optional text pointers differ, which this control
    ;; does not dereference while copying the record.
    (if (i32.or
          (i32.eq (local.get $msg) (i32.const 0x0415))
          (i32.eq (local.get $msg) (i32.const 0x0443)))
      (then
        (local.set $count (load.field ToolbarState button_count (local.get $sw)))
        (local.set $idx (local.get $wParam))
        (if (i32.gt_u (local.get $idx) (local.get $count))
          (then (local.set $idx (local.get $count))))
        (if (i32.eqz
              (call $toolbar_ensure_capacity
                (local.get $sw)
                (i32.add (local.get $count) (i32.const 1))))
          (then (return (i32.const 0))))
        (local.set $dst (call $toolbar_button_ptr (local.get $sw) (local.get $idx)))
        (if (i32.lt_u (local.get $idx) (local.get $count))
          (then
            (call $toolbar_memmove_right
              (local.get $dst)
              (i32.mul (i32.sub (local.get $count) (local.get $idx)) (i32.const 20))
              (i32.const 20))))
        (call $toolbar_copy_button_in
          (local.get $dst)
          (local.get $lParam)
          (load.field.memarg ToolbarState tbutton_struct_size (local.get $sw))
          (local.get $idx))
        (store.field ToolbarState button_count (local.get $sw) (i32.add (local.get $count) (i32.const 1)))
        (call $toolbar_autosize (local.get $hwnd))
        (return (i32.const 1))))

    ;; TB_DELETEBUTTON (WM_USER+22): remove button by index.
    (if (i32.eq (local.get $msg) (i32.const 0x0416))
      (then
        (local.set $count (load.field ToolbarState button_count (local.get $sw)))
        (if (i32.ge_u (local.get $wParam) (local.get $count))
          (then (return (i32.const 0))))
        (local.set $dst (call $toolbar_button_ptr (local.get $sw) (local.get $wParam)))
        (if (i32.lt_u (i32.add (local.get $wParam) (i32.const 1)) (local.get $count))
          (then
            (call $memcpy
              (local.get $dst)
              (i32.add (local.get $dst) (i32.const 20))
              (i32.mul
                (i32.sub (i32.sub (local.get $count) (local.get $wParam)) (i32.const 1))
                (i32.const 20)))))
        (store.field ToolbarState button_count (local.get $sw) (i32.sub (local.get $count) (i32.const 1)))
        (if (i32.eq (load.field.memarg ToolbarState pressed_index (local.get $sw)) (local.get $wParam))
          (then (store.field.memarg ToolbarState pressed_index (local.get $sw) (i32.const -1))))
        (call $toolbar_autosize (local.get $hwnd))
        (return (i32.const 1))))

    ;; TB_GETBUTTON (WM_USER+23): copy the stored TBBUTTON by index.
    (if (i32.eq (local.get $msg) (i32.const 0x0417))
      (then
        (if (i32.or
              (i32.eqz (local.get $lParam))
              (i32.ge_u (local.get $wParam) (load.field ToolbarState button_count (local.get $sw))))
          (then (return (i32.const 0))))
        (local.set $rect (call $g2w (local.get $lParam)))
        (local.set $copy (load.field.memarg ToolbarState tbutton_struct_size (local.get $sw)))
        (if (i32.gt_u (local.get $copy) (i32.const 20))
          (then (local.set $copy (i32.const 20))))
        (if (i32.eqz (local.get $copy))
          (then (return (i32.const 0))))
        (if (load.field.memarg ToolbarState buttons_guest (local.get $sw))
          (then
            (call $memcpy
              (local.get $rect)
              (call $toolbar_button_ptr (local.get $sw) (local.get $wParam))
              (local.get $copy)))
          (else
            (call $toolbar_init_button (local.get $rect) (local.get $wParam))))
        (return (i32.const 1))))

    ;; TB_GETRECT (WM_USER+51): command ID -> RECT.
    (if (i32.eq (local.get $msg) (i32.const 0x0433))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $idx (call $toolbar_find_command_index (local.get $sw) (local.get $wParam)))
        (if (i32.lt_s (local.get $idx) (i32.const 0)) (then (return (i32.const 0))))
        (local.set $rect (call $g2w (local.get $lParam)))
        (return (call $toolbar_button_rect (local.get $sw) (local.get $idx) (local.get $rect)))))

    ;; TB_GETBITMAP / TB_GETBUTTONTEXTA. The bounded toolbar stores command
    ;; records but not string tables, so text lookup is an empty successful
    ;; copy when a buffer is supplied.
    (if (i32.eq (local.get $msg) (i32.const 0x042C))
      (then
        (local.set $idx (call $toolbar_find_command_index (local.get $sw) (local.get $wParam)))
        (if (i32.lt_s (local.get $idx) (i32.const 0)) (then (return (i32.const -1))))
        (local.set $rec (call $toolbar_button_ptr (local.get $sw) (local.get $idx)))
        (return (i32.load (local.get $rec)))))
    (if (i32.eq (local.get $msg) (i32.const 0x042D))
      (then
        (if (local.get $lParam)
          (then (i32.store8 (call $g2w (local.get $lParam)) (i32.const 0))))
        (return (i32.const 0))))

    ;; TB_BUTTONCOUNT (WM_USER+24), TB_GETROWS (WM_USER+40).
    (if (i32.eq (local.get $msg) (i32.const 0x0418))
      (then (return (load.field ToolbarState button_count (local.get $sw)))))
    (if (i32.eq (local.get $msg) (i32.const 0x0428))
      (then (return (load.field.memarg ToolbarState rows (local.get $sw)))))
    ;; TB_COMMANDTOINDEX (WM_USER+25): map command ID to button index.
    (if (i32.eq (local.get $msg) (i32.const 0x0419))
      (then (return (call $toolbar_find_command_index (local.get $sw) (local.get $wParam)))))

    ;; TB_GETITEMRECT (WM_USER+29): lParam -> RECT for button index wParam.
    (if (i32.eq (local.get $msg) (i32.const 0x041D))
      (then
        (if (i32.or
              (i32.eqz (local.get $lParam))
              (i32.ge_u (local.get $wParam) (load.field ToolbarState button_count (local.get $sw))))
          (then (return (i32.const 0))))
        (local.set $rect (call $g2w (local.get $lParam)))
        (local.set $hit (call $toolbar_button_rect
          (local.get $sw)
          (local.get $wParam)
          (local.get $rect)))
        (return (local.get $hit))))

    ;; TB_SETBUTTONSIZE / TB_SETBITMAPSIZE / TB_AUTOSIZE.
    (if (i32.eq (local.get $msg) (i32.const 0x041F))
      (then
        (local.set $bw (i32.and (local.get $lParam) (i32.const 0xFFFF)))
        (local.set $bh (i32.shr_u (local.get $lParam) (i32.const 16)))
        (if (i32.gt_u (local.get $bw) (i32.const 0)) (then (store.field.memarg ToolbarState button_w (local.get $sw) (local.get $bw))))
        (if (i32.gt_u (local.get $bh) (i32.const 0)) (then (store.field.memarg ToolbarState button_h (local.get $sw) (local.get $bh))))
        (call $toolbar_autosize (local.get $hwnd))
        (return (i32.const 1))))
    (if (i32.eq (local.get $msg) (i32.const 0x0420))
      (then
        (local.set $bw (i32.and (local.get $lParam) (i32.const 0xFFFF)))
        (local.set $bh (i32.shr_u (local.get $lParam) (i32.const 16)))
        (if (i32.gt_u (local.get $bw) (i32.const 0)) (then (store.field.memarg ToolbarState bitmap_w (local.get $sw) (local.get $bw))))
        (if (i32.gt_u (local.get $bh) (i32.const 0)) (then (store.field.memarg ToolbarState bitmap_h (local.get $sw) (local.get $bh))))
        (return (i32.const 1))))
    (if (i32.eq (local.get $msg) (i32.const 0x0421))
      (then
        (call $toolbar_autosize (local.get $hwnd))
        (return (i32.const 0))))

    ;; TB_GETBUTTONSIZE (WM_USER+58), TB_SETROWS (WM_USER+39).
    (if (i32.eq (local.get $msg) (i32.const 0x043A))
      (then
        (return
          (i32.or
            (i32.and (load.field.memarg ToolbarState button_w (local.get $sw)) (i32.const 0xFFFF))
            (i32.shl (load.field.memarg ToolbarState button_h (local.get $sw)) (i32.const 16))))))
    (if (i32.eq (local.get $msg) (i32.const 0x0427))
      (then
        (if (i32.gt_u (i32.and (local.get $wParam) (i32.const 0xFFFF)) (i32.const 0))
          (then (store.field.memarg ToolbarState rows (local.get $sw) (i32.and (local.get $wParam) (i32.const 0xFFFF)))))
        (call $toolbar_autosize (local.get $hwnd))
        (return (i32.const 0))))

    ;; TB_SETIMAGELIST / TB_GETIMAGELIST and hot/disabled variants.
    (if (i32.eq (local.get $msg) (i32.const 0x0430))
      (then
        (local.set $old (load.field.memarg ToolbarState image_list (local.get $sw)))
        (store.field.memarg ToolbarState image_list (local.get $sw) (local.get $lParam))
        (call $toolbar_repaint_now (local.get $hwnd))
        (return (local.get $old))))
    (if (i32.eq (local.get $msg) (i32.const 0x0431))
      (then (return (load.field.memarg ToolbarState image_list (local.get $sw)))))
    (if (i32.eq (local.get $msg) (i32.const 0x0434))
      (then
        (local.set $old (load.field.memarg ToolbarState hot_image_list (local.get $sw)))
        (store.field.memarg ToolbarState hot_image_list (local.get $sw) (local.get $lParam))
        (call $toolbar_repaint_now (local.get $hwnd))
        (return (local.get $old))))
    (if (i32.eq (local.get $msg) (i32.const 0x0435))
      (then (return (load.field.memarg ToolbarState hot_image_list (local.get $sw)))))
    (if (i32.eq (local.get $msg) (i32.const 0x0436))
      (then
        (local.set $old (load.field.memarg ToolbarState disabled_image_list (local.get $sw)))
        (store.field.memarg ToolbarState disabled_image_list (local.get $sw) (local.get $lParam))
        (call $toolbar_repaint_now (local.get $hwnd))
        (return (local.get $old))))
    (if (i32.eq (local.get $msg) (i32.const 0x0437))
      (then (return (load.field.memarg ToolbarState disabled_image_list (local.get $sw)))))

    ;; TB_GETHOTITEM / TB_SETHOTITEM. The hot item is an index, not a command
    ;; id. Return the previous index exactly as the common-control contract
    ;; requires and repaint so flat toolbar edges/image lists switch at once.
    (if (i32.eq (local.get $msg) (i32.const 0x0447))
      (then (return (load.field.memarg ToolbarState hot_index (local.get $sw)))))
    (if (i32.eq (local.get $msg) (i32.const 0x0448))
      (then
        (local.set $old (load.field.memarg ToolbarState hot_index (local.get $sw)))
        (local.set $idx (local.get $wParam))
        (if (i32.and
              (i32.ne (local.get $idx) (i32.const -1))
              (i32.ge_u (local.get $idx) (load.field ToolbarState button_count (local.get $sw))))
          (then (local.set $idx (i32.const -1))))
        (store.field.memarg ToolbarState hot_index (local.get $sw) (local.get $idx))
        (if (i32.ne (local.get $idx) (local.get $old))
          (then (call $toolbar_repaint_now (local.get $hwnd))))
        (return (local.get $old))))

    ;; TB_SETSTYLE / TB_GETSTYLE / TB_SETEXTENDEDSTYLE / TB_GETEXTENDEDSTYLE.
    (if (i32.eq (local.get $msg) (i32.const 0x0438))
      (then
        (store.field.memarg ToolbarState style (local.get $sw) (local.get $lParam))
        (call $paint_flag_set_inv (local.get $hwnd))
        (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0439))
      (then (return (load.field.memarg ToolbarState style (local.get $sw)))))
    (if (i32.eq (local.get $msg) (i32.const 0x0454))
      (then
        (local.set $old (load.field.memarg ToolbarState extended_style (local.get $sw)))
        (if (local.get $wParam)
          (then
            (store.field.memarg ToolbarState extended_style (local.get $sw)
              (i32.or (i32.and (local.get $old) (i32.xor (local.get $wParam) (i32.const -1)))
                      (i32.and (local.get $lParam) (local.get $wParam)))))
          (else
            (store.field.memarg ToolbarState extended_style (local.get $sw) (local.get $lParam))))
        (return (local.get $old))))
    (if (i32.eq (local.get $msg) (i32.const 0x0455))
      (then (return (load.field.memarg ToolbarState extended_style (local.get $sw)))))

    ;; TB_SETPADDING / TB_GETPADDING.
    (if (i32.eq (local.get $msg) (i32.const 0x0457))
      (then
        (local.set $old (load.field.memarg ToolbarState padding_packed (local.get $sw)))
        (store.field.memarg ToolbarState padding_packed (local.get $sw) (local.get $lParam))
        (return (local.get $old))))
    (if (i32.eq (local.get $msg) (i32.const 0x0456))
      (then (return (load.field.memarg ToolbarState padding_packed (local.get $sw)))))

    ;; Basic state/probe messages by command ID.
    (if (i32.or
          (i32.or (i32.eq (local.get $msg) (i32.const 0x0409)) ;; TB_ISBUTTONENABLED
                  (i32.eq (local.get $msg) (i32.const 0x040A))) ;; TB_ISBUTTONCHECKED
          (i32.or
            (i32.or (i32.eq (local.get $msg) (i32.const 0x040B)) ;; TB_ISBUTTONPRESSED
                    (i32.eq (local.get $msg) (i32.const 0x040C))) ;; TB_ISBUTTONHIDDEN
            (i32.or (i32.eq (local.get $msg) (i32.const 0x040D)) ;; TB_ISBUTTONINDETERMINATE
                    (i32.eq (local.get $msg) (i32.const 0x0412))))) ;; TB_GETSTATE
      (then
        (local.set $idx (call $toolbar_find_command_index (local.get $sw) (local.get $wParam)))
        (if (i32.lt_s (local.get $idx) (i32.const 0))
          (then
            (if (i32.eq (local.get $msg) (i32.const 0x0412))
              (then (return (i32.const -1))))
            (return (i32.const 0))))
        (local.set $rec (call $toolbar_button_ptr (local.get $sw) (local.get $idx)))
        (local.set $state_byte (i32.load8_u offset=8 (local.get $rec)))
        (if (i32.eq (local.get $msg) (i32.const 0x0412))
          (then (return (local.get $state_byte))))
        (if (i32.eq (local.get $msg) (i32.const 0x0409))
          (then (return (select (i32.const 1) (i32.const 0)
            (i32.ne (i32.and (local.get $state_byte) (i32.const 0x04)) (i32.const 0))))))
        (if (i32.eq (local.get $msg) (i32.const 0x040A))
          (then (return (select (i32.const 1) (i32.const 0)
            (i32.ne (i32.and (local.get $state_byte) (i32.const 0x01)) (i32.const 0))))))
        (if (i32.eq (local.get $msg) (i32.const 0x040B))
          (then (return (select (i32.const 1) (i32.const 0)
            (i32.ne (i32.and (local.get $state_byte) (i32.const 0x02)) (i32.const 0))))))
        (if (i32.eq (local.get $msg) (i32.const 0x040C))
          (then (return (select (i32.const 1) (i32.const 0)
            (i32.ne (i32.and (local.get $state_byte) (i32.const 0x08)) (i32.const 0))))))
        (return (select (i32.const 1) (i32.const 0)
          (i32.ne (i32.and (local.get $state_byte) (i32.const 0x10)) (i32.const 0))))))

    ;; TB_ENABLEBUTTON / TB_CHECKBUTTON / TB_PRESSBUTTON /
    ;; TB_HIDEBUTTON / TB_INDETERMINATE.
    (if (i32.or
          (i32.or (i32.eq (local.get $msg) (i32.const 0x0401))
                  (i32.eq (local.get $msg) (i32.const 0x0402)))
          (i32.or
            (i32.or (i32.eq (local.get $msg) (i32.const 0x0403))
                    (i32.eq (local.get $msg) (i32.const 0x0404)))
            (i32.eq (local.get $msg) (i32.const 0x0405))))
      (then
        (local.set $state_byte (i32.const 0x04))
        (if (i32.eq (local.get $msg) (i32.const 0x0402)) (then (local.set $state_byte (i32.const 0x01))))
        (if (i32.eq (local.get $msg) (i32.const 0x0403)) (then (local.set $state_byte (i32.const 0x02))))
        (if (i32.eq (local.get $msg) (i32.const 0x0404)) (then (local.set $state_byte (i32.const 0x08))))
        (if (i32.eq (local.get $msg) (i32.const 0x0405)) (then (local.set $state_byte (i32.const 0x10))))
        (drop (call $toolbar_update_state_bit
          (local.get $sw)
          (local.get $wParam)
          (local.get $state_byte)
          (local.get $lParam)))
        (call $paint_flag_set_inv (local.get $hwnd))
        (call $toolbar_repaint_now (local.get $hwnd))
        (return (i32.const 1))))

    ;; TB_SETSTATE (WM_USER+17): replace fsState for command ID.
    (if (i32.eq (local.get $msg) (i32.const 0x0411))
      (then
        (local.set $idx (call $toolbar_find_command_index (local.get $sw) (local.get $wParam)))
        (if (i32.lt_s (local.get $idx) (i32.const 0))
          (then (return (i32.const 0))))
        (local.set $rec (call $toolbar_button_ptr (local.get $sw) (local.get $idx)))
        (i32.store8 offset=8 (local.get $rec) (local.get $lParam))
        (call $paint_flag_set_inv (local.get $hwnd))
        (call $toolbar_repaint_now (local.get $hwnd))
        (return (i32.const 1))))

    ;; TB_HITTEST (WM_USER+69): lParam points to a POINT in toolbar coords.
    (if (i32.eq (local.get $msg) (i32.const 0x0445))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const -1))))
        (local.set $rect (call $g2w (local.get $lParam)))
        (return
          (call $toolbar_hit_test
            (local.get $sw)
            (i32.load (local.get $rect))
            (i32.load offset=4 (local.get $rect))))))

    ;; WM_MOUSEMOVE / WM_MOUSELEAVE maintain the hot index used by flat edges
    ;; and the optional hot image list. Disabled buttons do not become hot.
    (if (i32.eq (local.get $msg) (i32.const 0x0200))
      (then
        (local.set $x (i32.shr_s (i32.shl (local.get $lParam) (i32.const 16)) (i32.const 16)))
        (local.set $y (i32.shr_s (local.get $lParam) (i32.const 16)))
        (local.set $hit (call $toolbar_hit_test (local.get $sw) (local.get $x) (local.get $y)))
        (if (i32.ge_s (local.get $hit) (i32.const 0))
          (then
            (local.set $rec (call $toolbar_button_ptr (local.get $sw) (local.get $hit)))
            (if (i32.eqz (i32.and (i32.load8_u offset=8 (local.get $rec)) (i32.const 0x04)))
              (then (local.set $hit (i32.const -1))))))
        (if (i32.ne (local.get $hit) (load.field.memarg ToolbarState hot_index (local.get $sw)))
          (then
            (store.field.memarg ToolbarState hot_index (local.get $sw) (local.get $hit))
            (call $toolbar_repaint_now (local.get $hwnd))))
        (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x02A3))
      (then
        (if (i32.ne (load.field.memarg ToolbarState hot_index (local.get $sw)) (i32.const -1))
          (then
            (store.field.memarg ToolbarState hot_index (local.get $sw) (i32.const -1))
            (call $toolbar_repaint_now (local.get $hwnd))))
        (return (i32.const 0))))

    ;; WM_LBUTTONDOWN: remember the pressed button by hit-tested index.
    (if (i32.eq (local.get $msg) (i32.const 0x0201))
      (then
        (local.set $x (i32.shr_s (i32.shl (local.get $lParam) (i32.const 16)) (i32.const 16)))
        (local.set $y (i32.shr_s (local.get $lParam) (i32.const 16)))
        (local.set $hit (call $toolbar_hit_test (local.get $sw) (local.get $x) (local.get $y)))
        (store.field.memarg ToolbarState pressed_index (local.get $sw) (local.get $hit))
        (if (i32.ge_s (local.get $hit) (i32.const 0))
          (then
            (local.set $rec (call $toolbar_button_ptr (local.get $sw) (local.get $hit)))
            (if (i32.eqz (i32.and (i32.load8_u offset=8 (local.get $rec)) (i32.const 0x04)))
              (then
                (store.field.memarg ToolbarState pressed_index (local.get $sw) (i32.const -1))
                (return (i32.const 0))))
            (i32.store8 offset=8 (local.get $rec)
              (i32.or (i32.load8_u offset=8 (local.get $rec)) (i32.const 0x02)))
            (global.set $capture_hwnd (local.get $hwnd))
            (call $paint_flag_set_inv (local.get $hwnd))
            (call $toolbar_repaint_now (local.get $hwnd))))
        (return (i32.const 0))))

    ;; WM_LBUTTONUP: clear pressed state and send WM_COMMAND(idCommand, hwnd).
    (if (i32.eq (local.get $msg) (i32.const 0x0202))
      (then
        (local.set $x (i32.shr_s (i32.shl (local.get $lParam) (i32.const 16)) (i32.const 16)))
        (local.set $y (i32.shr_s (local.get $lParam) (i32.const 16)))
        (local.set $hit (call $toolbar_hit_test (local.get $sw) (local.get $x) (local.get $y)))
        (local.set $idx (load.field.memarg ToolbarState pressed_index (local.get $sw)))
        (store.field.memarg ToolbarState pressed_index (local.get $sw) (i32.const -1))
        (if (i32.eq (global.get $capture_hwnd) (local.get $hwnd))
          (then (global.set $capture_hwnd (i32.const 0))))
        (if (i32.ge_s (local.get $idx) (i32.const 0))
          (then
            (local.set $rec (call $toolbar_button_ptr (local.get $sw) (local.get $idx)))
            (i32.store8 offset=8 (local.get $rec)
              (i32.and (i32.load8_u offset=8 (local.get $rec)) (i32.const 0xFD)))
            (call $paint_flag_set_inv (local.get $hwnd))
            (call $toolbar_repaint_now (local.get $hwnd))
            (if (i32.and
                  (i32.eq (local.get $idx) (local.get $hit))
                  (i32.and
                    (i32.ne (i32.load offset=4 (local.get $rec)) (i32.const 0))
                    (i32.ne (i32.and (i32.load8_u offset=8 (local.get $rec)) (i32.const 0x04)) (i32.const 0))))
              (then
                (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
                (if (local.get $parent)
                  (then
                    (drop (call $wnd_send_message
                      (local.get $parent)
                      (i32.const 0x0111)
                      (i32.and (i32.load offset=4 (local.get $rec)) (i32.const 0xFFFF))
                      (local.get $hwnd)))))))))
        (return (i32.const 0))))

    ;; WM_PAINT
    (if (i32.eq (local.get $msg) (i32.const 0x000F))
      (then
        (local.set $hdc (i32.add (local.get $hwnd) (i32.const 0x40000)))
        ;; Native toolbar paints start with a fresh BeginPaint-style clip.
        ;; Synthetic hwnd+0x40000 DCs can retain an empty clip from prior MFC
        ;; control-bar drawing, erasing the row while clipping every button.
        (drop (call $gdi_native_select_clip_rgn (local.get $hdc) (i32.const 0)))
        (call $dc_apply_client_clip (local.get $hdc) (local.get $hwnd))
        (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
        (local.set $w (i32.and (local.get $sz) (i32.const 0xFFFF)))
        (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
        (if (i32.and (i32.gt_s (local.get $w) (i32.const 0))
                     (i32.gt_s (local.get $h) (i32.const 0)))
          (then
            (drop (call $gdi_native_fill_rect (local.get $hdc)
                    (i32.const 0) (i32.const 0)
                    (local.get $w) (local.get $h)
                    (i32.const 0x30011))) ;; COLOR_BTNFACE approximation.
            (drop (call $gdi_native_draw_edge (local.get $hdc)
                    (i32.const 0) (i32.const 0)
                    (local.get $w) (local.get $h)
                    (i32.const 0x04) (i32.const 0x08))) ;; BDR_RAISEDINNER | BF_BOTTOM
            (local.set $count (load.field ToolbarState button_count (local.get $sw)))
            (local.set $bh (load.field.memarg ToolbarState button_h (local.get $sw)))
            (if (i32.lt_s (local.get $count) (i32.const 1))
              (then (local.set $count (i32.const 1))))
            (local.set $i (i32.const 0))
            (block $done (loop $buttons
              (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
              (local.set $brect (call $paint_scratch_take))
              (if (i32.eqz (call $toolbar_button_rect (local.get $sw) (local.get $i) (local.get $brect)))
                (then (br $done)))
              (local.set $left (load.field PaintRect left (local.get $brect)))
              (local.set $top (load.field.memarg PaintRect top (local.get $brect)))
              (local.set $bw (i32.sub
                (load.field.memarg PaintRect right (local.get $brect))
                (local.get $left)))
              (local.set $bh (i32.sub
                (load.field.memarg PaintRect bottom (local.get $brect))
                (local.get $top)))
              (br_if $done (i32.ge_s (local.get $top) (i32.sub (local.get $h) (i32.const 2))))
              (local.set $state_byte (i32.const 4))
              (if (load.field.memarg ToolbarState buttons_guest (local.get $sw))
                (then
                  (local.set $rec (call $toolbar_button_ptr (local.get $sw) (local.get $i)))
                  (local.set $state_byte (i32.load8_u offset=8 (local.get $rec)))))
              (local.set $hit
                (i32.ne
                  (i32.and (local.get $state_byte) (i32.const 0x03)) ;; CHECKED | PRESSED
                  (i32.const 0)))
              (local.set $is_hot
                (i32.eq (local.get $i) (load.field.memarg ToolbarState hot_index (local.get $sw))))
              (if (i32.and (local.get $state_byte) (i32.const 0x08))
                (then
                  (local.set $i (i32.add (local.get $i) (i32.const 1)))
                  (br $buttons)))
              (if (i32.and
                    (i32.and (i32.ne (load.field.memarg ToolbarState buttons_guest (local.get $sw)) (i32.const 0))
                      (i32.ne (local.get $rec) (i32.const 0)))
                    (i32.and (i32.load8_u offset=9 (local.get $rec)) (i32.const 0x01)))
                (then
                  (if (i32.gt_s (local.get $bw) (i32.const 8))
                    (then
                      (drop (call $gdi_native_draw_edge (local.get $hdc)
                        (i32.add (local.get $left) (i32.const 3))
                        (i32.add (local.get $top) (i32.const 3))
                        (i32.add (local.get $left) (i32.const 5))
                        (i32.sub (i32.add (local.get $top) (local.get $bh)) (i32.const 3))
                        (i32.const 0x0A)
                        (i32.const 0x04)))))
                  (local.set $i (i32.add (local.get $i) (i32.const 1)))
                  (br $buttons)))
              ;; TBSTYLE_FLAT keeps idle/disabled button faces borderless.
              ;; The Win98 common control raises a flat button while it is hot
              ;; and sinks it while pressed/checked.
              (if (i32.or
                    (i32.or (local.get $hit) (local.get $is_hot))
                    (i32.eqz (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x0800))))
                (then
                  (drop (call $gdi_native_draw_edge (local.get $hdc)
                          (local.get $left) (local.get $top)
                          (i32.add (local.get $left) (local.get $bw))
                          (i32.add (local.get $top) (local.get $bh))
                          (select (i32.const 0x0A) (i32.const 0x05) (local.get $hit))
                          (i32.const 0x0F))))) ;; EDGE_RAISED/SUNKEN | BF_RECT
              (local.set $drawn (i32.const 0))
              (local.set $bmp (load.field.memarg ToolbarState bitmap_handle (local.get $sw)))
              (local.set $bmp_draw_w (load.field.memarg ToolbarState bitmap_w (local.get $sw)))
              (local.set $bmp_draw_h (load.field.memarg ToolbarState bitmap_h (local.get $sw)))
              (local.set $mask_color (i32.const 0x00C0C0C0))
              (local.set $use_disabled_effect
                (i32.eqz (i32.and (local.get $state_byte) (i32.const 0x04))))
              ;; Prefer a state-specific image list, then the normal image
              ;; list, then the legacy TB_ADDBITMAP strip. A disabled image
              ;; list already contains its intended pixels and must not be
              ;; embossed a second time.
              (local.set $image_list (i32.const 0))
              (if (local.get $use_disabled_effect)
                (then (local.set $image_list (load.field.memarg ToolbarState disabled_image_list (local.get $sw))))
                (else
                  (if (local.get $is_hot)
                    (then (local.set $image_list (load.field.memarg ToolbarState hot_image_list (local.get $sw)))))))
              (local.set $image_sw
                (call $toolbar_imagelist_ptr (local.get $image_list)))
              (if (i32.eqz (local.get $image_sw))
                (then
                  (local.set $image_list (load.field.memarg ToolbarState image_list (local.get $sw)))
                  (local.set $image_sw
                    (call $toolbar_imagelist_ptr (local.get $image_list)))))
              (if (local.get $image_sw)
                (then
                  (local.set $bmp (i32.load offset=16 (local.get $image_sw)))
                  (local.set $bmp_draw_w (i32.load (local.get $image_sw)))
                  (local.set $bmp_draw_h (i32.load offset=4 (local.get $image_sw)))
                  (local.set $mask_color (i32.load offset=20 (local.get $image_sw)))
                  (if (i32.ne
                        (local.get $image_list)
                        (load.field.memarg ToolbarState image_list (local.get $sw)))
                    (then (local.set $use_disabled_effect (i32.const 0))))))
              (if (i32.and
                    (i32.and
                      (i32.ne (load.field.memarg ToolbarState buttons_guest (local.get $sw)) (i32.const 0))
                      (i32.ne (local.get $rec) (i32.const 0)))
                    (i32.and
                      (i32.ge_s (i32.load (local.get $rec)) (i32.const 0))
                      (i32.ne (local.get $bmp) (i32.const 0))))
                (then
                  (local.set $bmp_w (call $gdi_native_get_object_w (local.get $bmp)))
                  (local.set $bmp_h (call $gdi_native_get_object_h (local.get $bmp)))
                  (if (i32.le_s (local.get $bmp_draw_w) (i32.const 0))
                    (then (local.set $bmp_draw_w (i32.const 16))))
                  (if (i32.le_s (local.get $bmp_draw_h) (i32.const 0))
                    (then (local.set $bmp_draw_h (i32.const 16))))
                  (local.set $bmp_src_x
                    (i32.mul (i32.load (local.get $rec)) (local.get $bmp_draw_w)))
                  (if (i32.and
                        (i32.and
                          (i32.gt_s (local.get $bmp_w) (i32.const 0))
                          (i32.gt_s (local.get $bmp_h) (i32.const 0)))
                        (i32.and
                          (i32.le_s (i32.add (local.get $bmp_src_x) (local.get $bmp_draw_w)) (local.get $bmp_w))
                          (i32.le_s (local.get $bmp_draw_h) (local.get $bmp_h))))
                    (then
                      (local.set $bmp_dst_x
                        (i32.add
                          (i32.add
                            (local.get $left)
                            (i32.div_s
                              (i32.sub (local.get $bw) (local.get $bmp_draw_w))
                              (i32.const 2)))
                          (local.get $hit)))
                      (local.set $bmp_dst_y
                        (i32.add
                          (i32.add
                            (local.get $top)
                            (i32.div_s
                              (i32.sub (local.get $bh) (local.get $bmp_draw_h))
                              (i32.const 2)))
                          (local.get $hit)))
                      (local.set $memdc (call $gdi_native_create_compat_dc (local.get $hdc)))
                      (if (local.get $memdc)
                        (then
                          (drop (call $gdi_native_select_object (local.get $memdc) (local.get $bmp)))
                          (local.set $drawn
                            (if (result i32)
                              (i32.eqz (local.get $use_disabled_effect))
                              (then
                                (call $gdi_native_transparent_blt
                                  (local.get $hdc)
                                  (local.get $bmp_dst_x) (local.get $bmp_dst_y)
                                  (local.get $bmp_draw_w) (local.get $bmp_draw_h)
                                  (local.get $memdc)
                                  (local.get $bmp_src_x) (i32.const 0)
                                  (local.get $mask_color)))
                              (else
                                (call $gdi_native_disabled_blt
                                  (local.get $hdc)
                                  (local.get $bmp_dst_x) (local.get $bmp_dst_y)
                                  (local.get $bmp_draw_w) (local.get $bmp_draw_h)
                                  (local.get $memdc)
                                  (local.get $bmp_src_x) (i32.const 0)
                                  (local.get $mask_color)))))
                          (drop (call $gdi_native_delete_dc (local.get $memdc)))))))))
              (if (i32.eqz (local.get $drawn))
                (then
                  ;; Fallback glyph: a small dark mark inside each button, so
                  ;; screenshots still distinguish toolbar buttons from a plain
                  ;; gray band when no app bitmap strip is available.
                  (drop (call $gdi_native_fill_rect (local.get $hdc)
                          (i32.add (i32.add (local.get $left) (i32.const 8)) (local.get $hit))
                          (i32.add (i32.add (local.get $top) (i32.const 7)) (local.get $hit))
                          (i32.add (i32.add (local.get $left) (i32.const 15)) (local.get $hit))
                          (i32.add (i32.add (local.get $top) (i32.const 14)) (local.get $hit))
                          (i32.const 0x30012)))))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $buttons)))))
        (return (i32.const 0))))

    (i32.const 0))
