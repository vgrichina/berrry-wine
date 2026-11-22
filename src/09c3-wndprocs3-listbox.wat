  ;; Set while LB_INSERTSTRING appends through LB_ADDSTRING, so an LBS_SORT
  ;; listbox does not move the row it is about to rotate into place.
  (global $lb_add_unsorted (mut i32) (i32.const 0))
  ;; Caret messages currently support ordinary fixed-height string lists.
  ;; Reject owner-draw, multicolumn, no-data and no-selection styles instead
  ;; of assigning their unimplemented geometry/selection models new semantics.
  (func $lb_caret_supported (param $hwnd i32) (result i32)
    (i32.eqz (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x6230))))

  (func $lb_caret_visible_rows (param $hwnd i32) (param $sw i32)
                              (param $partial i32) (result i32)
    (local $h i32) (local $row_h i32)
    (local.set $h (call $listbox_content_h (local.get $hwnd) (local.get $sw)))
    (if (i32.and (i32.ne (local.get $partial) (i32.const 0))
                 (i32.gt_s (local.get $h) (i32.const 4)))
      (then
        (local.set $row_h (call $lb_row_height (local.get $sw)))
        (return (i32.div_u
          (i32.add (i32.sub (local.get $h) (i32.const 4))
                   (i32.sub (local.get $row_h) (i32.const 1)))
          (local.get $row_h)))))
    (call $listbox_visible_rows (local.get $hwnd) (local.get $sw)))
  (func $lb_append_unsorted (param $hwnd i32) (param $str i32) (result i32)
    (local $r i32)
    (global.set $lb_add_unsorted (i32.const 1))
    (local.set $r (call $listbox_wndproc (local.get $hwnd)
      (i32.const 0x0180) (i32.const 0) (local.get $str)))
    (global.set $lb_add_unsorted (i32.const 0))
    (local.get $r))

  ;; Per-window tab records, independent of the shared ListBoxState layout.
  ;; Each heap record is {next, hwnd, count, pixel_stops_guest_ptr} (16 bytes).
  ;; Only explicitly configured windows need one. RESETCONTENT keeps tabs;
  ;; WM_DESTROY unlinks the record before USER can reuse the window handle.
  (global $lb_tabs_head (mut i32) (i32.const 0))
  (func $lb_tabs_find (param $hwnd i32) (result i32)
    (local $entry i32) (local $node i32)
    (local.set $entry (global.get $lb_tabs_head))
    (block $done (loop $find
      (br_if $done (i32.eqz (local.get $entry)))
      (local.set $node (call $g2w (local.get $entry)))
      (if (i32.eq (i32.load offset=4 (local.get $node)) (local.get $hwnd))
        (then (return (local.get $entry))))
      (local.set $entry (i32.load (local.get $node)))
      (br $find)))
    (i32.const 0))
  (func $lb_tabs_remove (param $hwnd i32)
    (local $entry i32) (local $prev i32) (local $node i32)
    (local.set $entry (global.get $lb_tabs_head))
    (block $done (loop $find
      (br_if $done (i32.eqz (local.get $entry)))
      (local.set $node (call $g2w (local.get $entry)))
      (if (i32.eq (i32.load offset=4 (local.get $node)) (local.get $hwnd))
        (then
          (if (local.get $prev)
            (then (i32.store (call $g2w (local.get $prev)) (i32.load (local.get $node))))
            (else (global.set $lb_tabs_head (i32.load (local.get $node)))))
          (call $heap_free (i32.load offset=12 (local.get $node)))
          (call $heap_free (local.get $entry))
          (br $done)))
      (local.set $prev (local.get $entry))
      (local.set $entry (i32.load (local.get $node)))
      (br $find))))
  (func $lb_tabs_replace (param $hwnd i32) (param $count i32)
                        (param $stops i32) (result i32)
    (local $entry i32) (local $node i32)
    (if (i32.eqz (local.get $count))
      (then (call $lb_tabs_remove (local.get $hwnd)) (return (i32.const 1))))
    (local.set $entry (call $lb_tabs_find (local.get $hwnd)))
    (if (i32.eqz (local.get $entry))
      (then
        (local.set $entry (call $heap_alloc (i32.const 16)))
        (if (i32.eqz (local.get $entry)) (then (return (i32.const 0))))
        (local.set $node (call $g2w (local.get $entry)))
        (i32.store (local.get $node) (global.get $lb_tabs_head))
        (i32.store offset=4 (local.get $node) (local.get $hwnd))
        (i32.store offset=12 (local.get $node) (i32.const 0))
        (global.set $lb_tabs_head (local.get $entry))))
    (local.set $node (call $g2w (local.get $entry)))
    (call $heap_free (i32.load offset=12 (local.get $node)))
    (i32.store offset=8 (local.get $node) (local.get $count))
    (i32.store offset=12 (local.get $node) (local.get $stops))
    (i32.const 1))
  (func $lb_draw_string (param $hwnd i32) (param $sw i32) (param $hdc i32)
                       (param $x i32) (param $y i32) (param $text i32)
                       (param $count i32) (result i32)
    (local $entry i32) (local $tab_count i32) (local $stops i32)
    (if (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x0080))
      (then
        (local.set $entry (call $lb_tabs_find (local.get $hwnd)))
        (if (local.get $entry)
          (then
            (local.set $entry (call $g2w (local.get $entry)))
            (local.set $tab_count (i32.load offset=8 (local.get $entry)))
            (local.set $stops (i32.load offset=12 (local.get $entry)))))
        ;; The origin scrolls with the text, so tabs remain content columns
        ;; even when the row starts left of the clipped viewport.
        (return (call $gdi_tabbed_text (local.get $hdc)
          (local.get $x) (local.get $y) (call $w2g (local.get $text))
          (local.get $count) (local.get $tab_count)
          (local.get $stops) (local.get $x)
          (i32.const 0) (i32.const 1)))))
    (call $gdi_native_text_out (local.get $hdc) (local.get $x)
      (local.get $y) (local.get $text) (local.get $count) (i32.const 0)))

  ;; ============================================================
  ;; ListBox WndProc  (control class 4)
  ;; ============================================================
  ;;
  ;; ListBoxState (64 bytes, allocated in WM_CREATE)
  ;;   +0   items_buf_ptr    guest ptr to flat NUL-separated string buffer
  ;;                         ("item1\0item2\0item3\0", or 0 if empty)
  ;;   +4   items_used       bytes in items_buf actually used (incl. NULs)
  ;;   +8   items_cap        bytes allocated for items_buf
  ;;   +12  count            number of items
  ;;   +16  cur_sel          keyboard caret (-1 = none); selection is in sel_buf
  ;;   +20  top_index        first visible row (vertical scroll)
  ;;   +24  drag_anchor_y
  ;;   +28  drag_anchor_top
  ;;   +32  data_buf_ptr     guest ptr to u32[] parallel item-data array (LB_SETITEMDATA)
  ;;   +36  data_cap         capacity of data array, in u32 slots
  ;;   +40  sel_buf_ptr      guest ptr to u8[] multi-selection flags
  ;;   +44  sel_cap          capacity of selection array, in bytes
  ;;   +48  item_h           shared row height, 0 = default/unmeasured
  ;;   +52  horizontal_extent configured width, independent of text/scroll offset
  ;;   +56  scroll_x         content offset in pixels
  ;;   +60  font             WM_SETFONT handle, 0 = default GUI font
  ;; The control id is NOT in the record: $ctrl_table_get_id($hwnd).
  ;;
  ;; Items are stored as concatenated NUL-terminated strings. LB_ADDSTRING
  ;; appends; LB_RESETCONTENT zeros count + items_used (keeps the buffer for
  ;; reuse). LB_GETTEXT walks NULs to find item N. There's no per-item index
  ;; array — for the workloads we care about (file dialogs, font picker)
  ;; the count is small enough that linear walks are cheap.
  ;;
  ;; Click → set cur_sel + post WM_COMMAND (HIWORD=LBN_SELCHANGE=1, LOWORD=ctrl_id).
  ;; Double-click → post WM_COMMAND (HIWORD=LBN_DBLCLK=2). Default height = 16px.
  ;;
  ;; WM_PAINT draws rows and both scrollbar strips through the native GDI path.
  (func $listbox_wndproc (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $state i32) (local $sw i32) (local $cs_w i32)
    (local $items i32) (local $items_w i32) (local $used i32) (local $cap i32)
    (local $count i32) (local $idx i32) (local $i i32) (local $p i32)
    (local $src_g i32) (local $src_w i32) (local $slen i32)
    (local $need i32) (local $new_buf i32) (local $new_w i32)
    (local $dest_g i32) (local $dest_w i32) (local $max i32)
    (local $row i32) (local $parent i32) (local $notif i32) (local $sz i32)
    (local $w i32) (local $h i32) (local $hdc i32) (local $sel i32)
    (local $top i32) (local $visible i32) (local $row_y i32) (local $row_h i32)
    (local $brush i32)
    (local $find_handle i32) (local $fd_g i32) (local $fd_w i32) (local $attrs i32)
    (local $last i32) (local $tmp_g i32) (local $tmp_w i32)
    (local $ownerdraw i32) (local $code i32) (local $delta i32)
    (local $saved_dc i32) (local $x i32) (local $page i32)
    (local $simple_multi i32)
    (local $notify_single i32)
    (local $vkey_generation i64)

    (local.set $state (call $wnd_get_state_ptr (local.get $hwnd)))
    ;; WIN32.HLP (1992-1994), LBN_SELCHANGE: LBS_NOTIFY is required.
    ;; Restrict this guard addition to enabled ordinary single-selection
    ;; string lists; retain owner-draw, keyboard-owner and multiple routes.
    (local.set $notify_single
      (i32.eqz (i32.and (call $wnd_get_style (local.get $hwnd))
        (i32.const 0x08006E38))))

    ;; Keep arrows in the list when a setup/menu loop uses IsDialogMessage.
    ;; Otherwise the dialog manager consumes them as group-focus navigation
    ;; before WM_KEYDOWN can select a row and scroll it into view. Tab and
    ;; the dialog command keys retain their normal dialog handling.
    (if (i32.eq (local.get $msg) (i32.const 0x0087)) ;; WM_GETDLGCODE
      (then (return (i32.const 0x0001)))) ;; DLGC_WANTARROWS

    ;; ---------- WM_SETFOCUS (0x0007) / WM_KILLFOCUS (0x0008) ----------
    ;; LBN_SETFOCUS(4) / LBN_KILLFOCUS(5) to the parent. A combobox's dropdown
    ;; list is one of these, and its parent combo turns the pair back into
    ;; CBN_SETFOCUS/CBN_KILLFOCUS — the notification WordPad's format bar
    ;; applies the picked font on.
    (if (i32.or (i32.eq (local.get $msg) (i32.const 0x0007))
                (i32.eq (local.get $msg) (i32.const 0x0008)))
      (then
        (if (i32.eq (local.get $msg) (i32.const 0x0007))
          (then (global.set $focus_hwnd (local.get $hwnd)))
          (else
            (if (i32.eq (global.get $focus_hwnd) (local.get $hwnd))
              (then (global.set $focus_hwnd (i32.const 0))))))
        (if (local.get $state)
          (then
            (local.set $sw (call $g2w (local.get $state)))
            (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
            (if (local.get $parent)
              (then (drop (call $wnd_send_message (local.get $parent) (i32.const 0x0111)
                      (i32.or (i32.and (call $ctrl_table_get_id (local.get $hwnd)) (i32.const 0xFFFF))
                              (i32.shl (select (i32.const 4) (i32.const 5)
                                         (i32.eq (local.get $msg) (i32.const 0x0007)))
                                       (i32.const 16)))
                      (local.get $hwnd)))))))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.const 0))))

    ;; ---------- WM_CREATE (0x0001) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0001))
      (then
        (local.set $cs_w (call $g2w (local.get $lParam)))
        (local.set $state (call $heap_alloc (size-of ListBoxState)))
        (local.set $sw (call $g2w (local.get $state)))
        (call $lb_set_item_h (local.get $sw) (i32.const 0))
        (call $lb_set_items_ptr (local.get $sw) (i32.const 0))
        (call $lb_set_items_used (local.get $sw) (i32.const 0))
        (call $lb_set_items_cap (local.get $sw) (i32.const 0))
        (call $lb_set_count (local.get $sw) (i32.const 0))
        (call $lb_set_cur_sel (local.get $sw) (i32.const -1))
        (call $lb_set_top_index (local.get $sw) (i32.const 0))
        ;; CREATESTRUCT.hMenu is not copied in: it is already CONTROL_TABLE+4.
        (call $lb_set_drag_anchor_y (local.get $sw) (i32.const 0))
        (call $lb_set_drag_anchor_top (local.get $sw) (i32.const 0))
        (call $lb_set_data_ptr (local.get $sw) (i32.const 0))
        (call $lb_set_data_cap (local.get $sw) (i32.const 0))
        (call $lb_set_sel_ptr (local.get $sw) (i32.const 0))
        (call $lb_set_sel_cap (local.get $sw) (i32.const 0))
        (call $lb_set_horizontal_extent (local.get $sw) (i32.const 0))
        (call $lb_set_scroll_x (local.get $sw) (i32.const 0))
        (store.field.memarg ListBoxState font (local.get $sw) (i32.const 0))
        (call $wnd_set_state_ptr (local.get $hwnd) (local.get $state))
        (call $listbox_hscroll_to (local.get $hwnd) (local.get $sw) (i32.const 0))
        (return (i32.const 0))))

    ;; ---------- WM_DESTROY (0x0002) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0002))
      (then
        (if (local.get $state)
          (then
            (local.set $sw (call $g2w (local.get $state)))
            (call $heap_free (call $lb_items_ptr (local.get $sw)))
            (call $heap_free (call $lb_data_ptr (local.get $sw)))
            (call $heap_free (call $lb_sel_ptr (local.get $sw)))
            (call $lb_tabs_remove (local.get $hwnd))
            (call $heap_free (local.get $state))
            (call $wnd_set_state_ptr (local.get $hwnd) (i32.const 0))))
        (return (i32.const 0))))

    (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
    (local.set $sw (call $g2w (local.get $state)))

    ;; Microsoft WIN32.HLP (1992-1994), LISTBOX processing/WM_SETREDRAW,
    ;; and KB Q66479: suppress drawing during bulk model changes. The list
    ;; owns LBS_NOREDRAW; reenabling permits the caller's explicit repaint.
    (if (i32.eq (local.get $msg) (i32.const 0x000B))
      (then
        (call $wnd_set_style (local.get $hwnd)
          (i32.or
            (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const -5))
            (select (i32.const 0) (i32.const 4) (local.get $wParam))))
        (return (i32.const 0))))

    ;; Microsoft Windows 3.1 Programmer's Reference (1992), pp128/190-191:
    ;; retain the caller's font, NULL selects the default, LOWORD requests
    ;; redraw. The caller owns the font. Keep explicit row geometry separate;
    ;; no automatic font-to-item-height formula is established here.
    (if (i32.eq (local.get $msg) (i32.const 0x0030)) ;; WM_SETFONT
      (then
        (store.field.memarg ListBoxState font (local.get $sw) (local.get $wParam))
        (if (i32.and (local.get $lParam) (i32.const 0xFFFF))
          (then (call $invalidate_hwnd (local.get $hwnd))))
        (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0031)) ;; WM_GETFONT
      (then (return (load.field.memarg ListBoxState font (local.get $sw)))))

    ;; LB_SETTABSTOPS. Microsoft, List Box Controls (1992-03-23): zero
    ;; restores 32 dialog units; one repeats the supplied interval; multiple
    ;; gives ascending positions. Units use the list's font and setting tabs
    ;; redraws. Ordinary rows below select DEFAULT_GUI_FONT for painting.
    (if (i32.eq (local.get $msg) (i32.const 0x0192))
      (then
        (if (i32.eqz (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x0080)))
          (then (return (i32.const 0))))
        ;; Check allocation multiplication before calling the heap. Failure
        ;; leaves the previous array intact rather than losing window state.
        (if (i32.gt_u (local.get $wParam) (i32.const 0x1FFFFFFC))
          (then (return (i32.const 0))))
        (local.set $new_buf (i32.const 0))
        (if (local.get $wParam)
          (then
            (local.set $new_buf (call $heap_alloc (i32.shl (local.get $wParam) (i32.const 2))))
            (if (i32.eqz (local.get $new_buf)) (then (return (i32.const 0))))
            (local.set $new_w (call $g2w (local.get $new_buf)))
            (local.set $src_w (call $g2w (local.get $lParam)))
            (local.set $hdc (i32.add (local.get $hwnd) (i32.const 0x40000)))
            (local.set $saved_dc (call $gdi_dc_save (local.get $hdc)))
            (drop (call $gdi_native_select_object (local.get $hdc) (i32.const 0x30021)))
            (local.set $sz (i32.shr_u (call $host_get_text_metrics (local.get $hdc)) (i32.const 16)))
            (if (i32.eqz (local.get $sz)) (then (local.set $sz (i32.const 8))))
            (drop (call $gdi_dc_restore (local.get $hdc) (local.get $saved_dc)))
            (local.set $i (i32.const 0))
            (block $tabs_done (loop $tabs_copy
              (br_if $tabs_done (i32.ge_u (local.get $i) (local.get $wParam)))
              (local.set $idx (i32.shl (local.get $i) (i32.const 2)))
              (i32.store (i32.add (local.get $new_w) (local.get $idx))
                (i32.wrap_i64 (i64.div_s
                  (i64.add (i64.mul
                    (i64.extend_i32_s (i32.load (i32.add (local.get $src_w) (local.get $idx))))
                    (i64.extend_i32_u (local.get $sz))) (i64.const 2)) (i64.const 4))))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $tabs_copy)))))
        (if (i32.eqz (call $lb_tabs_replace (local.get $hwnd) (local.get $wParam) (local.get $new_buf)))
          (then (call $heap_free (local.get $new_buf)) (return (i32.const 0))))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.const 1))))

    ;; LB_GETHORIZONTALEXTENT / LB_SETHORIZONTALEXTENT. The documented
    ;; setter has no result; lParam is unused. Multiple-column lists ignore it.
    ;; No row insertion/deletion measures text or replaces this explicit width.
    (if (i32.eq (local.get $msg) (i32.const 0x0193))
      (then (return (call $lb_horizontal_extent (local.get $sw)))))
    (if (i32.eq (local.get $msg) (i32.const 0x0194))
      (then
        (if (call $listbox_hscroll_supported (local.get $hwnd))
          (then
            (call $lb_set_horizontal_extent (local.get $sw)
              (select (local.get $wParam) (i32.const 0) (i32.ge_s (local.get $wParam) (i32.const 0))))
            (call $listbox_hscroll_to (local.get $hwnd) (local.get $sw) (call $lb_scroll_x (local.get $sw)))
            (drop (call $listbox_scroll_to (local.get $hwnd) (local.get $sw) (call $lb_top_index (local.get $sw))))
            (call $invalidate_hwnd (local.get $hwnd))))
        (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0005)) ;; WM_SIZE
      (then
        (call $listbox_hscroll_to (local.get $hwnd) (local.get $sw) (call $lb_scroll_x (local.get $sw)))
        (drop (call $listbox_scroll_to (local.get $hwnd) (local.get $sw) (call $lb_top_index (local.get $sw))))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.const 0))))

    ;; WM_HSCROLL: the private pixel viewport, not SetScrollPos's thumb.
    (if (i32.eq (local.get $msg) (i32.const 0x0114))
      (then
        (if (i32.eqz (call $listbox_hscroll_supported (local.get $hwnd))) (then (return (i32.const 0))))
        (local.set $code (i32.and (local.get $wParam) (i32.const 0xFFFF)))
        (local.set $x (call $lb_scroll_x (local.get $sw)))
        (local.set $page (call $listbox_hscroll_page (local.get $hwnd) (local.get $sw)))
        (if (i32.eq (local.get $code) (i32.const 0)) (then (local.set $x (i32.sub (local.get $x) (i32.const 8)))))
        (if (i32.eq (local.get $code) (i32.const 1)) (then (local.set $x (i32.add (local.get $x) (i32.const 8)))))
        (if (i32.eq (local.get $code) (i32.const 2)) (then (local.set $x (i32.sub (local.get $x) (local.get $page)))))
        (if (i32.eq (local.get $code) (i32.const 3)) (then (local.set $x (i32.add (local.get $x) (local.get $page)))))
        (if (i32.or (i32.eq (local.get $code) (i32.const 4)) (i32.eq (local.get $code) (i32.const 5)))
          (then (local.set $x (i32.shr_u (local.get $wParam) (i32.const 16)))))
        (if (i32.eq (local.get $code) (i32.const 6)) (then (local.set $x (i32.const 0))))
        (if (i32.eq (local.get $code) (i32.const 7)) (then (local.set $x (call $listbox_hscroll_max (local.get $hwnd) (local.get $sw)))))
        (call $listbox_hscroll_to (local.get $hwnd) (local.get $sw) (local.get $x))
        (return (i32.const 0))))

    ;; ---------- LB_ADDSTRING (0x0180) ----------
    ;; Without LBS_HASSTRINGS, owner-draw lists receive item data rather than text.
    (if (i32.eq (local.get $msg) (i32.const 0x0180))
      (then
        (local.set $ownerdraw (i32.and (i32.ne (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x0030)) (i32.const 0)) (i32.eqz (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x0040))))) (local.set $slen (i32.const 0))
        (if (i32.eqz (local.get $ownerdraw)) (then (local.set $src_g (local.get $lParam))
          (if (i32.eqz (local.get $src_g)) (then (return (i32.const -1))))
          (local.set $src_w (call $g2w (local.get $src_g)))
          (local.set $slen (call $strlen (local.get $src_w)))))
        ;; LBS_SORT (0002h): a string listbox keeps its rows in lstrcmpi order,
        ;; a new row going after every row that does not sort above it. Only
        ;; LB_ADDSTRING (and LB_DIR/DlgDirList, which add through it) sort;
        ;; LB_INSERTSTRING puts a row where it is told, even in a sorted list,
        ;; and sets $lb_add_unsorted around the append it builds on.
        ;;
        ;; Appending here instead put DlgDirList's "[-x-]" drives after the
        ;; files. Civilization II walks that list for its CD, copying each row
        ;; into a 6-byte stack buffer and stopping at the drive it wants, so it
        ;; never reaches a file on Windows; here every 12-character name
        ;; (council0.fre) ran over its saved DS, and the next fopen wrote its
        ;; FILE record into the game's own code, trapping at the Defense
        ;; Minister (F2) much later.
        (if (i32.and (i32.eqz (local.get $ownerdraw))
              (i32.and (i32.eqz (global.get $lb_add_unsorted))
                (i32.ne (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x0002))
                        (i32.const 0))))
          (then
            (local.set $count (call $lb_count (local.get $sw)))
            (local.set $p (call $lb_items_ptr (local.get $sw)))
            (local.set $i (i32.const 0))
            (block $sorted_at (loop $sorted_scan
              (br_if $sorted_at (i32.ge_s (local.get $i) (local.get $count)))
              (br_if $sorted_at (i32.lt_s
                (call $lstr_cmp (local.get $src_g) (local.get $p) (i32.const 0) (i32.const 1))
                (i32.const 0)))
              (local.set $p (i32.add (local.get $p)
                (i32.add (call $strlen (call $g2w (local.get $p))) (i32.const 1))))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $sorted_scan)))
            (if (i32.lt_s (local.get $i) (local.get $count))
              (then (return (call $listbox_wndproc (local.get $hwnd)
                (i32.const 0x0181) (local.get $i) (local.get $lParam)))))))
        (local.set $used (call $lb_items_used (local.get $sw)))
        (local.set $cap  (call $lb_items_cap (local.get $sw)))
        (local.set $need (i32.add (local.get $used) (i32.add (local.get $slen) (i32.const 1))))
        ;; Grow buffer if needed: alloc max(256, need*2), copy old, free old.
        (if (i32.gt_u (local.get $need) (local.get $cap))
          (then
            (local.set $cap (i32.mul (local.get $need) (i32.const 2)))
            (if (i32.lt_u (local.get $cap) (i32.const 256))
              (then (local.set $cap (i32.const 256))))
            (local.set $new_buf (call $heap_alloc (local.get $cap)))
            (local.set $new_w (call $g2w (local.get $new_buf)))
            (if (local.get $used)
              (then (call $memcpy (local.get $new_w)
                                  (call $g2w (call $lb_items_ptr (local.get $sw)))
                                  (local.get $used))))
            (call $heap_free (call $lb_items_ptr (local.get $sw)))
            (call $lb_set_items_ptr (local.get $sw) (local.get $new_buf))
            (call $lb_set_items_cap (local.get $sw) (local.get $cap))))
        ;; Append the new string + NUL at items[used].
        (local.set $items_w (call $g2w (call $lb_items_ptr (local.get $sw))))
        (call $memcpy (i32.add (local.get $items_w) (local.get $used))
                      (local.get $src_w) (local.get $slen))
        (i32.store8 (i32.add (i32.add (local.get $items_w) (local.get $used)) (local.get $slen))
                    (i32.const 0))
        (local.set $count (call $lb_count (local.get $sw)))
        (call $lb_set_items_used (local.get $sw)
          (i32.add (local.get $used) (i32.add (local.get $slen) (i32.const 1))))
        (call $lb_set_count (local.get $sw) (i32.add (local.get $count) (i32.const 1)))
        (call $listbox_hscroll_to (local.get $hwnd) (local.get $sw) (call $lb_scroll_x (local.get $sw)))
        ;; Grow parallel data array; no-string owner-draw items start with lParam.
        (local.set $cap (call $lb_data_cap (local.get $sw)))
        (if (i32.ge_u (local.get $count) (local.get $cap))
          (then
            (local.set $cap (i32.mul (i32.add (local.get $count) (i32.const 1)) (i32.const 2)))
            (if (i32.lt_u (local.get $cap) (i32.const 16))
              (then (local.set $cap (i32.const 16))))
            (local.set $new_buf (call $heap_alloc (i32.mul (local.get $cap) (i32.const 4))))
            (local.set $new_w (call $g2w (local.get $new_buf)))
            (if (local.get $count)
              (then (call $memcpy (local.get $new_w)
                                  (call $g2w (call $lb_data_ptr (local.get $sw)))
                                  (i32.mul (local.get $count) (i32.const 4)))))
            (call $heap_free (call $lb_data_ptr (local.get $sw)))
            (call $lb_set_data_ptr (local.get $sw) (local.get $new_buf))
            (call $lb_set_data_cap (local.get $sw) (local.get $cap))))
        (i32.store
          (i32.add (call $g2w (call $lb_data_ptr (local.get $sw)))
                   (i32.mul (local.get $count) (i32.const 4)))
          (select (local.get $lParam) (i32.const 0) (local.get $ownerdraw)))
        ;; Grow the byte-per-row multi-selection array in parallel.
        (local.set $cap (call $lb_sel_cap (local.get $sw)))
        (if (i32.ge_u (local.get $count) (local.get $cap))
          (then
            (local.set $cap (i32.mul (i32.add (local.get $count) (i32.const 1)) (i32.const 2)))
            (if (i32.lt_u (local.get $cap) (i32.const 16))
              (then (local.set $cap (i32.const 16))))
            (local.set $new_buf (call $heap_alloc (local.get $cap)))
            (local.set $new_w (call $g2w (local.get $new_buf)))
            (if (local.get $count)
              (then (call $memcpy (local.get $new_w)
                                  (call $g2w (call $lb_sel_ptr (local.get $sw)))
                                  (local.get $count))))
            (call $heap_free (call $lb_sel_ptr (local.get $sw)))
            (call $lb_set_sel_ptr (local.get $sw) (local.get $new_buf))
            (call $lb_set_sel_cap (local.get $sw) (local.get $cap))))
        (i32.store8
          (i32.add (call $g2w (call $lb_sel_ptr (local.get $sw))) (local.get $count))
          (i32.const 0))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (local.get $count))))  ;; index of newly inserted item

    ;; ---------- LB_RESETCONTENT (0x0184) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0184))
      (then
        (call $lb_set_items_used (local.get $sw) (i32.const 0))
        (call $lb_set_count (local.get $sw) (i32.const 0))
        (call $listbox_hscroll_to (local.get $hwnd) (local.get $sw) (i32.const 0))
        (call $lb_set_cur_sel (local.get $sw) (i32.const -1))
        (call $lb_set_top_index (local.get $sw) (i32.const 0))
        (local.set $p (call $g2w (call $lb_sel_ptr (local.get $sw))))
        (local.set $i (i32.const 0))
        (block $reset_sel_done (loop $reset_sel
          (br_if $reset_sel_done (i32.ge_u (local.get $i) (call $lb_sel_cap (local.get $sw))))
          (i32.store8 (i32.add (local.get $p) (local.get $i)) (i32.const 0))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $reset_sel)))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.const 0))))

    ;; ---------- LB_DIR (0x018D) ----------
    ;; wParam = DDL_* attribute flags, lParam = wildcard path. Adds matching
    ;; files to the listbox and, when DDL_DIRECTORY is set, matching
    ;; directories too. Returns the last inserted index or LB_ERR(-1).
    (if (i32.eq (local.get $msg) (i32.const 0x018D))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const -1))))
        (local.set $fd_g (call $heap_alloc (i32.const 320)))
        (local.set $fd_w (call $g2w (local.get $fd_g)))
        (local.set $tmp_g (call $heap_alloc (i32.const 280)))
        (local.set $tmp_w (call $g2w (local.get $tmp_g)))
        (local.set $last (i32.const -1))
        (local.set $find_handle (call $host_fs_find_first_file
          (call $g2w (local.get $lParam)) (local.get $fd_g) (i32.const 0)))
        (if (i32.eq (local.get $find_handle) (i32.const -1))
          (then
            (call $heap_free (local.get $tmp_g))
            (call $heap_free (local.get $fd_g))
            (return (i32.const -1))))
        (block $lbdir_done (loop $lbdir_loop
          (local.set $attrs (i32.load (local.get $fd_w)))
          ;; Microsoft WIN32.HLP (1992-1994), LB_DIR: the directory-only
          ;; exclusive request omits the default read/write file fallback.
          ;; Keep requests for other file attributes on their existing route.
          (if (i32.or
                (i32.and
                  (i32.eqz (i32.and (local.get $attrs) (i32.const 0x10)))
                  (i32.ne (local.get $wParam) (i32.const 0x8010)))
                (i32.and
                  (i32.ne (i32.and (local.get $attrs) (i32.const 0x10)) (i32.const 0))
                  (i32.ne (i32.and (local.get $wParam) (i32.const 0x10)) (i32.const 0))))
            (then
              (local.set $slen (call $strlen (i32.add (local.get $fd_w) (i32.const 44))))
              ;; Subdirectory names, including exact-path matches, use [].
              (if (i32.and (local.get $attrs) (i32.const 0x10))
                (then
                  (i32.store8 (local.get $tmp_w) (i32.const 91))
                  (call $memcpy (i32.add (local.get $tmp_w) (i32.const 1))
                                (i32.add (local.get $fd_w) (i32.const 44))
                                (local.get $slen))
                  (local.set $slen (i32.add (local.get $slen) (i32.const 1)))
                  (i32.store8 (i32.add (local.get $tmp_w) (local.get $slen)) (i32.const 93))
                  (local.set $slen (i32.add (local.get $slen) (i32.const 1))))
                (else
                  (call $memcpy (local.get $tmp_w)
                                (i32.add (local.get $fd_w) (i32.const 44))
                                (local.get $slen))))
              (i32.store8 (i32.add (local.get $tmp_w) (local.get $slen)) (i32.const 0))
              (local.set $last (call $listbox_wndproc (local.get $hwnd)
                (i32.const 0x0180) (i32.const 0)
                (local.get $tmp_g)))))
          (br_if $lbdir_done (i32.eqz (call $host_fs_find_next_file
                                        (local.get $find_handle)
                                        (local.get $fd_g)
                                        (i32.const 0))))
          (br $lbdir_loop)))
        (drop (call $host_fs_find_close (local.get $find_handle)))
        (call $heap_free (local.get $tmp_g))
        (call $heap_free (local.get $fd_g))
        (return (local.get $last))))

    ;; ---------- LB_GETCOUNT (0x018B) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x018B))
      (then (return (call $lb_count (local.get $sw)))))

    ;; ---------- LB_GETCURSEL (0x0188) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0188))
      (then
        (local.set $sel (call $lb_cur_sel (local.get $sw)))
        ;; A single-select list can have a programmatic caret without a
        ;; selection. Paint and input already use the parallel selection flags;
        ;; do not report the caret-only row as selected to callers/comboboxes.
        (if (i32.and (call $lb_caret_supported (local.get $hwnd))
              (i32.eqz (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x0808))))
          (then
            (if (i32.lt_u (local.get $sel) (call $lb_count (local.get $sw)))
              (then
                (if (i32.eqz (i32.load8_u
                      (i32.add (call $g2w (call $lb_sel_ptr (local.get $sw))) (local.get $sel))))
                  (then (return (i32.const -1))))))))
        (return (local.get $sel))))

    ;; ---------- LB_SETCARETINDEX (0x019E) / LB_GETCARETINDEX (0x019F) ----------
    ;; Microsoft desktop contracts:
    ;; https://learn.microsoft.com/en-us/windows/win32/controls/lb-setcaretindex
    ;; https://learn.microsoft.com/en-us/windows/win32/controls/lb-getcaretindex
    ;; lParam FALSE reveals a full row; TRUE permits a partial row. Neither
    ;; changes selection, input focus, or sends LBN_SELCHANGE. A single-select
    ;; list accepts SET only while it has no selected item. GET returns 0 when
    ;; no item has the caret. Invalid indices and unsupported styles: LB_ERR.
    (if (i32.or (i32.eq (local.get $msg) (i32.const 0x019E))
                (i32.eq (local.get $msg) (i32.const 0x019F)))
      (then
        (if (i32.eqz (call $lb_caret_supported (local.get $hwnd)))
          (then (return (i32.const -1))))
        (if (i32.eq (local.get $msg) (i32.const 0x019F))
          (then
            (local.set $sel (call $lb_cur_sel (local.get $sw)))
            (return (select (local.get $sel) (i32.const 0)
              (i32.ge_s (local.get $sel) (i32.const 0))))))
        (local.set $idx (local.get $wParam))
        (if (i32.ge_u (local.get $idx) (call $lb_count (local.get $sw)))
          (then (return (i32.const -1))))
        (if (i32.eqz (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x0808)))
          (then
            (if (i32.ge_s (call $listbox_wndproc (local.get $hwnd)
                  (i32.const 0x0188) (i32.const 0) (i32.const 0)) (i32.const 0))
              (then (return (i32.const -1))))))
        (call $lb_set_cur_sel (local.get $sw) (local.get $idx))
        (local.set $top (call $lb_top_index (local.get $sw)))
        (local.set $visible (call $lb_caret_visible_rows
          (local.get $hwnd) (local.get $sw) (local.get $lParam)))
        (if (i32.lt_s (local.get $idx) (local.get $top))
          (then (drop (call $listbox_scroll_to
            (local.get $hwnd) (local.get $sw) (local.get $idx))))
          (else
            (if (i32.ge_s (local.get $idx) (i32.add (local.get $top) (local.get $visible)))
              (then (drop (call $listbox_scroll_to (local.get $hwnd) (local.get $sw)
                (i32.sub (i32.add (local.get $idx) (i32.const 1)) (local.get $visible))))))))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.const 0))))

    ;; ---------- LB_SELITEMRANGE (0x019B) / LB_SELITEMRANGEEX (0x0183) ----------
    ;; Microsoft desktop contracts:
    ;; https://learn.microsoft.com/en-us/windows/win32/controls/lb-selitemrange
    ;; https://learn.microsoft.com/en-us/windows/win32/controls/lb-selitemrangeex
    ;; Both endpoints are included. RANGE packs unsigned WORD indices and
    ;; uses a BOOL; EX uses separate indices and selects only when first<last.
    ;; EX reversed OR equal endpoints deselect. Only ordinary string multi-
    ;; selection lists are supported here; refuse other selection models.
    (if (i32.or (i32.eq (local.get $msg) (i32.const 0x019B))
                (i32.eq (local.get $msg) (i32.const 0x0183)))
      (then
        (if (i32.or (i32.eqz (call $lb_caret_supported (local.get $hwnd)))
              (i32.eqz (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x0808))))
          (then (return (i32.const -1))))
        (if (i32.eq (local.get $msg) (i32.const 0x019B))
          (then
            (local.set $idx (i32.and (local.get $lParam) (i32.const 0xFFFF)))
            (local.set $last (i32.shr_u (local.get $lParam) (i32.const 16)))
            (local.set $sel (i32.ne (local.get $wParam) (i32.const 0))))
          (else
            (local.set $idx (local.get $wParam))
            (local.set $last (local.get $lParam))
            (local.set $sel (i32.lt_s (local.get $idx) (local.get $last)))))
        ;; Validate the complete range before changing a flag. Unsigned
        ;; comparisons also reject negative EX indices and empty lists.
        (local.set $count (call $lb_count (local.get $sw)))
        (if (i32.or
              (i32.or (i32.ge_u (local.get $idx) (local.get $count))
                      (i32.ge_u (local.get $last) (local.get $count)))
              (i32.or (i32.gt_u (local.get $idx) (i32.const 0xFFFF))
                      (i32.gt_u (local.get $last) (i32.const 0xFFFF))))
          (then (return (i32.const -1))))
        (if (i32.gt_u (local.get $idx) (local.get $last))
          (then
            (local.set $i (local.get $idx))
            (local.set $idx (local.get $last))
            (local.set $last (local.get $i))))
        (local.set $p (call $g2w (call $lb_sel_ptr (local.get $sw))))
        (local.set $i (local.get $idx))
        (loop $select_range
          (i32.store8 (i32.add (local.get $p) (local.get $i)) (local.get $sel))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br_if $select_range (i32.le_u (local.get $i) (local.get $last))))
        ;; Paint and public selection queries already read sel_buf. Keep the
        ;; input caret, viewports, focus and parent notifications unchanged.
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.const 0))))

    ;; ---------- LB_SETSEL (0x0185) / LB_GETSEL (0x0187) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0185))
      (then
        (local.set $idx (local.get $lParam))
        (local.set $count (call $lb_count (local.get $sw)))
        (if (i32.eq (local.get $idx) (i32.const -1))
          (then
            (local.set $i (i32.const 0))
            (block $set_all_done (loop $set_all
              (br_if $set_all_done (i32.ge_u (local.get $i) (local.get $count)))
              (i32.store8
                (i32.add (call $g2w (call $lb_sel_ptr (local.get $sw))) (local.get $i))
                (i32.ne (local.get $wParam) (i32.const 0)))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $set_all))))
          (else
            (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                        (i32.ge_s (local.get $idx) (local.get $count)))
              (then (return (i32.const -1))))
            (i32.store8
              (i32.add (call $g2w (call $lb_sel_ptr (local.get $sw))) (local.get $idx))
              (i32.ne (local.get $wParam) (i32.const 0)))))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.const 0))))

    (if (i32.eq (local.get $msg) (i32.const 0x0187))
      (then
        (local.set $idx (local.get $wParam))
        (local.set $count (call $lb_count (local.get $sw)))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_s (local.get $idx) (local.get $count)))
          (then (return (i32.const -1))))
        (if (call $lb_sel_ptr (local.get $sw))
          (then (return (i32.load8_u
            (i32.add (call $g2w (call $lb_sel_ptr (local.get $sw))) (local.get $idx))))))
        (return (i32.eq (local.get $idx) (call $lb_cur_sel (local.get $sw))))))

    ;; ---------- LB_GETSELCOUNT (0x0190) / LB_GETSELITEMS (0x0191) ----------
    ;; Microsoft WIN32.HLP (1992-1994), LB_GETSELCOUNT: a single-selection
    ;; list box returns LB_ERR. Both multiple-selection styles remain valid.
    (if (i32.and (i32.eq (local.get $msg) (i32.const 0x0190))
          (i32.eqz (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x0808))))
      (then (return (i32.const -1))))
    (if (i32.or (i32.eq (local.get $msg) (i32.const 0x0190))
                (i32.eq (local.get $msg) (i32.const 0x0191)))
      (then
        (local.set $count (call $lb_count (local.get $sw)))
        (local.set $i (i32.const 0))
        (local.set $sel (i32.const 0))
        (if (i32.eq (local.get $msg) (i32.const 0x0191))
          (then (local.set $dest_w (call $g2w (local.get $lParam)))))
        (block $get_sels_done (loop $get_sels
          (br_if $get_sels_done (i32.ge_u (local.get $i) (local.get $count)))
          (if (i32.load8_u
                (i32.add (call $g2w (call $lb_sel_ptr (local.get $sw))) (local.get $i)))
            (then
              (if (i32.eq (local.get $msg) (i32.const 0x0191))
                (then
                  (br_if $get_sels_done (i32.ge_u (local.get $sel) (local.get $wParam)))
                  (i32.store
                    (i32.add (local.get $dest_w) (i32.mul (local.get $sel) (i32.const 4)))
                    (local.get $i))))
              (local.set $sel (i32.add (local.get $sel) (i32.const 1)))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $get_sels)))
        (return (local.get $sel))))

    ;; ---------- LB_SETITEMHEIGHT (0x01A0) ----------
    ;; Microsoft: outside LBS_OWNERDRAWVARIABLE, wParam=0 changes all rows;
    ;; the maximum height is 255 pixels, and an invalid height returns LB_ERR.
    ;; https://learn.microsoft.com/en-us/windows/win32/controls/lb-setitemheight
    ;; Support positive fixed heights only. Preserve the previous no-op path
    ;; for variable-height/multicolumn lists, nonzero fixed indices, and the
    ;; undocumented zero-height case; do not invent their Windows semantics.
    (if (i32.eq (local.get $msg) (i32.const 0x01A0))
      (then
        (if (i32.or
              (i32.ne (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x0220)) (i32.const 0))
              (i32.ne (local.get $wParam) (i32.const 0)))
          (then (return (i32.const 0))))
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (if (i32.gt_u (local.get $lParam) (i32.const 255))
          (then (return (i32.const -1))))
        (call $lb_set_item_h (local.get $sw) (local.get $lParam))
        ;; The existing row accessor drives paint, public geometry, hit tests,
        ;; reveal and resize. Refresh the viewport without changing selection,
        ;; item data, explicit horizontal extent, focus, or notifications.
        (call $listbox_hscroll_to (local.get $hwnd) (local.get $sw) (call $lb_scroll_x (local.get $sw)))
        (drop (call $listbox_scroll_to (local.get $hwnd) (local.get $sw) (call $lb_top_index (local.get $sw))))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.const 0))))

    ;; ---------- LB_GETITEMHEIGHT (0x01A1) ----------
    ;; The default 16px row, WM_MEASUREITEM, or LB_SETITEMHEIGHT's shared height.
    (if (i32.eq (local.get $msg) (i32.const 0x01A1))
      (then (return (call $lb_row_height (local.get $sw)))))

    ;; ---------- LB_GETITEMRECT (0x0198) ----------
    ;; Return the row bounds in listbox client coordinates. Rows scrolled
    ;; above the viewport intentionally have negative top/bottom values.
    (if (i32.eq (local.get $msg) (i32.const 0x0198))
      (then
        (local.set $idx (local.get $wParam))
        (local.set $count (call $lb_count (local.get $sw)))
        (if (i32.or
              (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                      (i32.ge_s (local.get $idx) (local.get $count)))
              (i32.eqz (local.get $lParam)))
          (then (return (i32.const -1))))
        (local.set $row_h (call $lb_row_height (local.get $sw)))
        (local.set $row_y
          (i32.mul
            (i32.sub (local.get $idx) (call $lb_top_index (local.get $sw)))
            (local.get $row_h)))
        (local.set $w
          (i32.and (call $ctrl_get_wh_packed (local.get $hwnd))
                   (i32.const 0xFFFF)))
        (local.set $dest_w (call $g2w (local.get $lParam)))
        (i32.store           (local.get $dest_w) (i32.const 0))
        (i32.store offset=4  (local.get $dest_w) (local.get $row_y))
        (i32.store offset=8  (local.get $dest_w) (local.get $w))
        (i32.store offset=12 (local.get $dest_w)
          (i32.add (local.get $row_y) (local.get $row_h)))
        (return (i32.const 0))))

    ;; ---------- LB_ITEMFROMPOINT (0x01A9) ----------
    ;; LOWORD is the nearest item; HIWORD reports whether the point lies
    ;; outside the listbox client area. This remains distinct from whether the
    ;; point lies below the final populated row.
    (if (i32.eq (local.get $msg) (i32.const 0x01A9))
      (then
        (local.set $count (call $lb_count (local.get $sw)))
        (if (i32.eqz (local.get $count))
          (then (return (i32.const 0x0000FFFF))))
        (local.set $w (i32.extend16_s (local.get $lParam)))
        (local.set $h
          (i32.extend16_s
            (i32.shr_u (local.get $lParam) (i32.const 16))))
        (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
        (local.set $code
          (i32.or
            (i32.or (i32.lt_s (local.get $w) (i32.const 0))
                    (i32.lt_s (local.get $h) (i32.const 0)))
            (i32.or
              (i32.ge_s (local.get $w)
                (i32.and (local.get $sz) (i32.const 0xFFFF)))
              (i32.ge_s (local.get $h)
                (i32.shr_u (local.get $sz) (i32.const 16))))))
        (local.set $row_h (call $lb_row_height (local.get $sw)))
        (local.set $idx (call $lb_top_index (local.get $sw)))
        (if (i32.gt_s (local.get $h) (i32.const 0))
          (then
            (local.set $idx
              (i32.add (local.get $idx)
                (i32.div_s (local.get $h) (local.get $row_h))))))
        (if (i32.lt_s (local.get $idx) (i32.const 0))
          (then (local.set $idx (i32.const 0))))
        (if (i32.ge_s (local.get $idx) (local.get $count))
          (then (local.set $idx (i32.sub (local.get $count) (i32.const 1)))))
        (return
          (i32.or
            (i32.and (local.get $idx) (i32.const 0xFFFF))
            (i32.shl (local.get $code) (i32.const 16))))))

    ;; ---------- LB_SETCURSEL (0x0186) ----------
    ;; wParam = index (-1 to clear). Clamp to count-1 if out of range.
    (if (i32.eq (local.get $msg) (i32.const 0x0186))
      (then
        (local.set $idx (local.get $wParam))
        (local.set $count (call $lb_count (local.get $sw)))
        (if (i32.ge_s (local.get $idx) (local.get $count))
          (then (local.set $idx (i32.const -1))))
        (call $lb_set_cur_sel (local.get $sw) (local.get $idx))
        ;; Programmatic selection follows USER: make the selected row visible.
        (if (i32.ge_s (local.get $idx) (i32.const 0))
          (then
            (local.set $top (call $lb_top_index (local.get $sw)))
            (local.set $visible (call $listbox_visible_rows (local.get $hwnd) (local.get $sw)))
            (if (i32.lt_s (local.get $idx) (local.get $top))
              (then (drop (call $listbox_scroll_to
                (local.get $hwnd) (local.get $sw) (local.get $idx))))
              (else
                (if (i32.ge_s (local.get $idx) (i32.add (local.get $top) (local.get $visible)))
                  (then (drop (call $listbox_scroll_to
                    (local.get $hwnd) (local.get $sw)
                    (i32.sub (i32.add (local.get $idx) (i32.const 1)) (local.get $visible))))))))))
        (local.set $i (i32.const 0))
        (block $setcur_clear_done (loop $setcur_clear
          (br_if $setcur_clear_done (i32.ge_u (local.get $i) (local.get $count)))
          (i32.store8 (i32.add (call $g2w (call $lb_sel_ptr (local.get $sw))) (local.get $i))
            (i32.eq (local.get $i) (local.get $idx)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $setcur_clear)))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (local.get $idx))))

    ;; ---------- LB_GETTEXT (0x0189) ----------
    ;; wParam = index, lParam = guest dest buffer. Returns chars copied (excl NUL),
    ;; or LB_ERR(-1) if index out of range.
    (if (i32.eq (local.get $msg) (i32.const 0x0189))
      (then
        (local.set $idx (local.get $wParam))
        (local.set $count (call $lb_count (local.get $sw)))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_s (local.get $idx) (local.get $count)))
          (then (return (i32.const -1))))
        ;; Walk NUL-separated buffer to item $idx.
        (local.set $items_w (call $g2w (call $lb_items_ptr (local.get $sw))))
        (local.set $p (local.get $items_w))
        (local.set $i (i32.const 0))
        (block $found (loop $skip
          (br_if $found (i32.eq (local.get $i) (local.get $idx)))
          (local.set $p (i32.add (local.get $p)
                          (i32.add (call $strlen (local.get $p)) (i32.const 1))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $skip)))
        (local.set $slen (call $strlen (local.get $p)))
        (local.set $dest_w (call $g2w (local.get $lParam)))
        (call $memcpy (local.get $dest_w) (local.get $p) (local.get $slen))
        (i32.store8 (i32.add (local.get $dest_w) (local.get $slen)) (i32.const 0))
        (return (local.get $slen))))

    ;; ---------- LB_GETTEXTLEN (0x018A) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x018A))
      (then
        (local.set $idx (local.get $wParam))
        (local.set $count (call $lb_count (local.get $sw)))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_s (local.get $idx) (local.get $count)))
          (then (return (i32.const -1))))
        (local.set $items_w (call $g2w (call $lb_items_ptr (local.get $sw))))
        (local.set $p (local.get $items_w))
        (local.set $i (i32.const 0))
        (block $found2 (loop $skip2
          (br_if $found2 (i32.eq (local.get $i) (local.get $idx)))
          (local.set $p (i32.add (local.get $p)
                          (i32.add (call $strlen (local.get $p)) (i32.const 1))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $skip2)))
        (return (call $strlen (local.get $p)))))

    ;; ---------- WM_LBUTTONDOWN (0x0201) / WM_LBUTTONDBLCLK (0x0203) ----------
    ;; lParam = MAKELPARAM(x, y) within the listbox client. Compute row =
    ;; top_index + y/item-height. Blank client rows do not select an item.
    ;; with notification = LBN_SELCHANGE (single click) or LBN_DBLCLK (dbl).
    (if (i32.or (i32.eq (local.get $msg) (i32.const 0x0201))
                (i32.eq (local.get $msg) (i32.const 0x0203)))
      (then
        (local.set $count (call $lb_count (local.get $sw)))
        ;; Horizontal strip owns its whole rectangle, including the corner.
        ;; Reuse the SCROLLINFO painter's page/thumb geometry for input.
        (if (call $listbox_hscroll_visible (local.get $hwnd) (local.get $sw))
          (then
            (local.set $h (call $listbox_content_h (local.get $hwnd) (local.get $sw)))
            (local.set $row_y (i32.shr_s (local.get $lParam) (i32.const 16)))
            (if (i32.ge_s (local.get $row_y) (local.get $h))
              (then
                (local.set $w (call $listbox_content_w (local.get $hwnd) (local.get $sw)))
                (local.set $x (i32.extend16_s (local.get $lParam)))
                (if (i32.or (i32.lt_s (local.get $x) (i32.const 0)) (i32.ge_s (local.get $x) (local.get $w)))
                  (then (return (i32.const 0))))
                (if (i32.eqz (call $listbox_hscroll_max (local.get $hwnd) (local.get $sw)))
                  (then (return (i32.const 0))))
                (local.set $code (call $scroll_arrow_filter_hit (local.get $hwnd) (i32.const 0)
                  (call $sb_page_hit_part (local.get $w) (local.get $x) (call $lb_scroll_x (local.get $sw))
                    (i32.const 0) (i32.sub (call $lb_horizontal_extent (local.get $sw)) (i32.const 1))
                    (call $listbox_hscroll_page (local.get $hwnd) (local.get $sw)))))
                (if (i32.eqz (local.get $code)) (then (return (i32.const 0))))
                (global.set $sb_pressed_hwnd (local.get $hwnd))
                (if (i32.eq (local.get $code) (i32.const 5))
                  (then
                    (call $lb_set_drag_anchor_y (local.get $sw) (local.get $x))
                    (call $lb_set_drag_anchor_top (local.get $sw) (call $lb_scroll_x (local.get $sw)))
                    (global.set $sb_pressed_part (i32.const 6))
                    (call $capture_store (local.get $hwnd)))
                  (else
                    (global.set $sb_pressed_part
                      (select (i32.add (local.get $code) (i32.const 2)) (i32.const 0)
                        (i32.le_u (local.get $code) (i32.const 2))))
                    (drop (call $listbox_wndproc (local.get $hwnd) (i32.const 0x0114)
                      (i32.sub (local.get $code) (i32.const 1)) (i32.const 0)))))
                (call $invalidate_hwnd (local.get $hwnd))
                (return (i32.const 0))))))
        ;; --- visible WS_VSCROLL strip hit-test (arrows only) ---
        ;; If the click lands in the right-edge 16px scrollbar strip, adjust
        ;; top_index and short-circuit before the row-select path.
        (if (call $listbox_vscroll_visible (local.get $hwnd) (local.get $sw))
          (then
            (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
            (local.set $w (i32.and (local.get $sz) (i32.const 0xFFFF)))
            (local.set $h (call $listbox_content_h (local.get $hwnd) (local.get $sw)))
            (local.set $row (i32.shr_s (i32.shl (local.get $lParam) (i32.const 16)) (i32.const 16)))
            (local.set $row_y (i32.shr_s (local.get $lParam) (i32.const 16)))
            (if (i32.ge_s (local.get $row) (i32.sub (local.get $w) (i32.const 16)))
              (then
                ;; visible rows based on strip-reduced client
                (local.set $visible (call $listbox_visible_rows (local.get $hwnd) (local.get $sw)))
                (local.set $top (call $lb_top_index (local.get $sw)))
                (local.set $max (i32.sub (local.get $count) (local.get $visible)))
                (if (i32.lt_s (local.get $max) (i32.const 0))
                  (then (local.set $max (i32.const 0))))
                ;; A disabled arrow still owns its rectangle; consume the
                ;; click without turning it into a page hit or a row select.
                (if (i32.and
                      (i32.lt_s (local.get $row_y) (i32.const 16))
                      (i32.ne (i32.and
                        (call $scroll_arrow_mask (local.get $hwnd) (i32.const 1))
                        (i32.const 1)) (i32.const 0)))
                  (then (return (i32.const 0))))
                (if (i32.and
                      (i32.ge_s (local.get $row_y)
                        (i32.sub (local.get $h) (i32.const 16)))
                      (i32.ne (i32.and
                        (call $scroll_arrow_mask (local.get $hwnd) (i32.const 1))
                        (i32.const 2)) (i32.const 0)))
                  (then (return (i32.const 0))))
                (if (i32.lt_s (local.get $row_y) (i32.const 16))
                  (then ;; up arrow
                    (if (i32.gt_s (local.get $top) (i32.const 0))
                      (then (call $lb_set_top_index (local.get $sw)
                              (i32.sub (local.get $top) (i32.const 1)))))
                    (global.set $sb_pressed_hwnd (local.get $hwnd))
                    (global.set $sb_pressed_part (i32.const 1)))
                  (else (if (i32.ge_s (local.get $row_y) (i32.sub (local.get $h) (i32.const 16)))
                    (then ;; down arrow
                      (if (i32.lt_s (local.get $top) (local.get $max))
                        (then (call $lb_set_top_index (local.get $sw)
                                (i32.add (local.get $top) (i32.const 1)))))
                      (global.set $sb_pressed_hwnd (local.get $hwnd))
                      (global.set $sb_pressed_part (i32.const 2)))
                    (else ;; track click — page or thumb-drag start
                      (if (i32.gt_s (local.get $max) (i32.const 0))
                        (then
                          (if (i32.eq
                                (call $listbox_page_hit
                                  (local.get $hwnd) (local.get $sw)
                                  (local.get $row_y) (local.get $h)
                                  (local.get $top) (local.get $max)
                                  (local.get $visible))
                                (i32.const 3))
                            (then
                              ;; Thumb hit — take mouse capture so WM_MOUSEMOVE
                              ;; and WM_LBUTTONUP are routed to this listbox
                              ;; even when the cursor leaves it. sb_pressed
                              ;; drives the thumb-pressed paint visual.
                              (call $capture_store (local.get $hwnd))
                              (global.set $sb_pressed_hwnd (local.get $hwnd))
                              (global.set $sb_pressed_part (i32.const 5))))))))))
                (drop (call $wnd_send_message
                  (local.get $hwnd) (i32.const 0x000F) (i32.const 0) (i32.const 0)))
                (call $invalidate_hwnd (local.get $hwnd))
                (return (i32.const 0))))))
        (if (i32.eqz (local.get $count)) (then (return (i32.const 0))))
        ;; Signed y from the high word; ignore points outside populated rows.
        (local.set $row_y (i32.shr_s (local.get $lParam) (i32.const 16)))
        (if (i32.lt_s (local.get $row_y) (i32.const 0)) (then (return (i32.const 0))))
        (local.set $row (i32.div_s (local.get $row_y) (call $lb_row_height (local.get $sw))))
        (local.set $row (i32.add (local.get $row) (call $lb_top_index (local.get $sw))))
        (if (i32.ge_s (local.get $row) (local.get $count))
          (then (return (i32.const 0))))
        ;; Microsoft Visual C++ v4 (Sep 1995), List-Box Styles p2273:
        ;; LBS_MULTIPLESEL clicks toggle each item independently. Limit this
        ;; path to an ordinary supported simple list and WM_LBUTTONDOWN;
        ;; retain the existing double-click and unsupported-style behavior.
        (local.set $simple_multi (i32.and
          (i32.eq (local.get $msg) (i32.const 0x0201))
          (i32.and
            (call $lb_caret_supported (local.get $hwnd))
            (i32.eq (i32.and (call $wnd_get_style (local.get $hwnd))
                      (i32.const 0x0C08)) (i32.const 0x0008)))))
        (if (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x00000800))
          (then
            ;; LBS_EXTENDEDSEL: Ctrl toggles a row; Shift selects the range
            ;; from the previous caret; an unmodified click replaces all.
            (local.set $sel (call $lb_cur_sel (local.get $sw)))
            (if (i32.and (local.get $wParam) (i32.const 0x0008)) ;; MK_CONTROL
              (then
                (i32.store8
                  (i32.add (call $g2w (call $lb_sel_ptr (local.get $sw))) (local.get $row))
                  (i32.eqz (i32.load8_u
                    (i32.add (call $g2w (call $lb_sel_ptr (local.get $sw))) (local.get $row))))))
              (else
                (local.set $i (i32.const 0))
                (block $click_sel_done (loop $click_sel
                  (br_if $click_sel_done (i32.ge_u (local.get $i) (local.get $count)))
                  (if (i32.and (local.get $wParam) (i32.const 0x0004)) ;; MK_SHIFT
                    (then
                      (i32.store8
                        (i32.add (call $g2w (call $lb_sel_ptr (local.get $sw))) (local.get $i))
                        (i32.or
                          (i32.and (i32.ge_s (local.get $i) (local.get $sel))
                                   (i32.le_s (local.get $i) (local.get $row)))
                          (i32.and (i32.ge_s (local.get $i) (local.get $row))
                                   (i32.le_s (local.get $i) (local.get $sel))))))
                    (else
                      (i32.store8
                        (i32.add (call $g2w (call $lb_sel_ptr (local.get $sw))) (local.get $i))
                        (i32.eq (local.get $i) (local.get $row)))))
                  (local.set $i (i32.add (local.get $i) (i32.const 1)))
                  (br $click_sel))))))
          (else
            (if (local.get $simple_multi)
              (then
                ;; Ctrl/Shift do not turn simple selection into an extended
                ;; range or replacement. Preserve every other selection.
                (local.set $p (i32.add
                  (call $g2w (call $lb_sel_ptr (local.get $sw))) (local.get $row)))
                (i32.store8 (local.get $p) (i32.eqz (i32.load8_u (local.get $p)))))
              (else
                (local.set $i (i32.const 0))
                (block $click_single_done (loop $click_single
                  (br_if $click_single_done (i32.ge_u (local.get $i) (local.get $count)))
                  (i32.store8
                    (i32.add (call $g2w (call $lb_sel_ptr (local.get $sw))) (local.get $i))
                    (i32.eq (local.get $i) (local.get $row)))
                  (local.set $i (i32.add (local.get $i) (i32.const 1)))
                  (br $click_single)))))))
        (call $lb_set_cur_sel (local.get $sw) (local.get $row))
        ;; Post WM_COMMAND to parent: HIWORD = notification, LOWORD = ctrl_id.
        (local.set $notif (i32.const 1))  ;; LBN_SELCHANGE
        (if (i32.eq (local.get $msg) (i32.const 0x0203))
          (then (local.set $notif (i32.const 2))))  ;; LBN_DBLCLK
        (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
        ;; WIN32.HLP topic3646 requires LBS_NOTIFY for LBN_SELCHANGE.
        ;; Add ordinary single clicks to the guard, retaining double-clicks.
        (if (i32.and (i32.ne (local.get $parent) (i32.const 0))
              (i32.or (i32.eqz (i32.or (local.get $simple_multi)
                  (i32.and (local.get $notify_single)
                    (i32.eq (local.get $msg) (i32.const 0x0201)))))
                (i32.ne (i32.and (call $wnd_get_style (local.get $hwnd))
                          (i32.const 1)) (i32.const 0))))
          (then
            (drop (call $wnd_send_message (local.get $parent) (i32.const 0x0111)
                    (i32.or (call $ctrl_table_get_id (local.get $hwnd))
                            (i32.shl (local.get $notif) (i32.const 16)))
                    (local.get $hwnd)))))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.const 0))))

    ;; ---------- WM_LBUTTONUP (0x0202) — release scrollbar press ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0202))
      (then
        (if (i32.eq (global.get $sb_pressed_hwnd) (local.get $hwnd))
          (then
            (global.set $sb_pressed_hwnd (i32.const 0))
            (global.set $sb_pressed_part (i32.const 0))
            (call $invalidate_hwnd (local.get $hwnd))))
        ;; Release mouse capture if we owned it (thumb drag). Harmless if
        ;; another hwnd holds capture — we only clear our own.
        (if (i32.eq (call $capture_live) (local.get $hwnd))
          (then (call $capture_store (i32.const 0))))
        (return (i32.const 0))))

    ;; ---------- WM_MOUSEMOVE (0x0200) — thumb drag ----------
    ;; Active only when this hwnd owns sb_pressed with part=5 (thumb).
    ;; Recomputes top from anchor_top + delta_y mapped to [0,max] using
    ;; the same arrow=16 / track=h-32 geometry as $paint_vscrollbar_rect.
    (if (i32.eq (local.get $msg) (i32.const 0x0200))
      (then
        (if (i32.and (i32.eq (global.get $sb_pressed_hwnd) (local.get $hwnd))
                     (i32.eq (global.get $sb_pressed_part) (i32.const 6)))
          (then
            (call $listbox_hscroll_to (local.get $hwnd) (local.get $sw)
              (call $sb_page_drag_pos
                (call $listbox_content_w (local.get $hwnd) (local.get $sw))
                (i32.extend16_s (local.get $lParam))
                (call $lb_drag_anchor_y (local.get $sw)) (call $lb_drag_anchor_top (local.get $sw))
                (i32.const 0) (i32.sub (call $lb_horizontal_extent (local.get $sw)) (i32.const 1))
                (call $listbox_hscroll_page (local.get $hwnd) (local.get $sw))))
            (return (i32.const 0))))
        (if (i32.and (i32.eq (global.get $sb_pressed_hwnd) (local.get $hwnd))
                     (i32.eq (global.get $sb_pressed_part) (i32.const 5)))
          (then
            (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
            (local.set $h (call $listbox_content_h (local.get $hwnd) (local.get $sw)))
            (local.set $row_y (i32.shr_s (local.get $lParam) (i32.const 16)))
            (local.set $count (call $lb_count (local.get $sw)))
            (local.set $visible (call $listbox_visible_rows (local.get $hwnd) (local.get $sw)))
            (local.set $max (i32.sub (local.get $count) (local.get $visible)))
            (if (i32.lt_s (local.get $max) (i32.const 0))
              (then (local.set $max (i32.const 0))))
            (if (i32.gt_s (local.get $max) (i32.const 0))
              (then
                (call $listbox_drag_to (local.get $hwnd) (local.get $sw)
                  (local.get $row_y) (local.get $h) (local.get $max))
                (call $invalidate_hwnd (local.get $hwnd))))))
        (return (i32.const 0))))

    ;; ---------- WM_CHAR (0x0102) ----------
    ;; Microsoft Windows 98 Keyboard Guide (1998-07-07), section 1.2:
    ;; an initial selects an item; repeating it selects the next match.
    ;; Keep this first-character search stateless. Do not infer a later
    ;; platform's incremental-search buffer or timeout policy.
    (if (i32.eq (local.get $msg) (i32.const 0x0102))
      (then
        ;; Ordinary single-selection ANSI string lists only. Owner-draw,
        ;; multi-selection and unsupported geometries keep their old path;
        ;; WANTKEYBOARDINPUT requires the owner's WM_CHARTOITEM callback.
        (if (i32.or
              (i32.eqz (call $lb_caret_supported (local.get $hwnd)))
              (i32.ne (i32.and (call $wnd_get_style (local.get $hwnd))
                        (i32.const 0x0C08)) (i32.const 0)))
          (then (return (i32.const 0))))
        (if (i32.or
              (i32.or (i32.lt_u (local.get $wParam) (i32.const 0x20))
                      (i32.gt_u (local.get $wParam) (i32.const 0xFF)))
              (i32.eq (local.get $wParam) (i32.const 0x7F)))
          (then (return (i32.const 0))))
        (local.set $count (call $lb_count (local.get $sw)))
        (if (i32.eqz (local.get $count)) (then (return (i32.const 0))))
        (local.set $sel (call $lb_cur_sel (local.get $sw)))
        (local.set $code (call $tolower (local.get $wParam)))
        (local.set $p (call $g2w (call $lb_items_ptr (local.get $sw))))
        (local.set $idx (i32.const -1))
        (local.set $i (i32.const 0))
        ;; One walk: save the first wraparound match, but prefer the first
        ;; match strictly after the current selection. No selection starts
        ;; at row zero; the current row is considered last when cycling.
        (block $char_found (loop $char_search
          (br_if $char_found (i32.ge_u (local.get $i) (local.get $count)))
          (if (i32.eq (call $tolower (i32.load8_u (local.get $p))) (local.get $code))
            (then
              (if (i32.gt_s (local.get $i) (local.get $sel))
                (then (local.set $idx (local.get $i)) (br $char_found)))
              (if (i32.lt_s (local.get $idx) (i32.const 0))
                (then (local.set $idx (local.get $i))))))
          (local.set $p (i32.add (local.get $p)
            (i32.add (call $strlen (local.get $p)) (i32.const 1))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $char_search)))
        (if (i32.lt_s (local.get $idx) (i32.const 0))
          (then (return (i32.const 0))))
        ;; Reuse selection flags, viewport reveal and invalidation. Complete
        ;; all state changes before the synchronous parent notification.
        (drop (call $listbox_wndproc (local.get $hwnd) (i32.const 0x0186)
          (local.get $idx) (i32.const 0)))
        (if (i32.and
              (i32.ne (local.get $idx) (local.get $sel))
              (i32.ne (i32.and (call $wnd_get_style (local.get $hwnd))
                        (i32.const 1)) (i32.const 0))) ;; LBS_NOTIFY
          (then
            (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
            (if (local.get $parent)
              (then (drop (call $wnd_send_message (local.get $parent) (i32.const 0x0111)
                (i32.or (call $ctrl_table_get_id (local.get $hwnd))
                        (i32.const 0x00010000)) ;; LBN_SELCHANGE
                (local.get $hwnd)))))))
        (return (i32.const 0))))

    ;; ---------- WM_KEYDOWN (0x0100) ----------
    ;; Microsoft Windows 98 Keyboard Guide (1998-07-07), dialog controls:
    ;; simple multiple-selection navigation moves without selecting; Space
    ;; toggles only the caret item. LBN_SELCHANGE still accompanies arrow
    ;; navigation even when selection is unchanged (Microsoft LBN_SELCHANGE),
    ;; with LBS_NOTIFY required. Other selection/style paths retain their
    ;; existing behavior, including the combobox popup's inner listbox.
    (if (i32.eq (local.get $msg) (i32.const 0x0100))
      (then
        ;; Q108941 (reviewed 1995-11-02), regular Windows95 lists:
        ;; -2 suppresses noncharacter arrow processing; WIN32.HLP 3876
        ;; defines -1 as default and packs key/caret with the list HWND.
        ;; This qualified path covers Up/Down, ordinary enabled ANSI lists
        ;; and synchronous Win32 guest owners only. Nonnegative returned
        ;; indices, character input and notification-entry timing are not
        ;; implemented or inferred here.
        (if (i32.and
              (i32.eq (i32.and (call $wnd_get_style (local.get $hwnd))
                        (i32.const 0x08006E38)) (i32.const 0x0400))
              (i32.and
                (i32.eqz (i32.or (global.get $code16) (global.get $host_shadow)))
                (i32.or (i32.eq (local.get $wParam) (i32.const 0x26))
                        (i32.eq (local.get $wParam) (i32.const 0x28)))))
          (then
            (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
            (local.set $notif (call $wnd_table_get (local.get $parent)))
            ;; Exclude missing, native and dialog procedure sentinels.
            (if (i32.and (i32.ne (local.get $notif) (i32.const 0))
                         (i32.lt_u (local.get $notif) (i32.const 0xFFFE0000)))
              (then
                (local.set $vkey_generation (call $wnd_lookup_generation (local.get $hwnd)))
                (local.set $notif (call $wnd_send_message (local.get $parent) (i32.const 0x002E)
                  (i32.or (i32.and (local.get $wParam) (i32.const 0xFFFF))
                    (i32.shl (call $lb_cur_sel (local.get $sw)) (i32.const 16)))
                  (local.get $hwnd)))
                ;; Only a completed callback supplies an LRESULT. Never
                ;; continue with state freed/replaced by a nested callback.
                (if (i32.eqz (global.get $wnd_send_completed))
                  (then (return (i32.const 0))))
                (if (i32.eq (local.get $notif) (i32.const -2))
                  (then (return (i32.const 0))))
                (if (i32.or
                      (i64.ne (local.get $vkey_generation) (call $wnd_lookup_generation (local.get $hwnd)))
                      (i32.ne (local.get $state) (call $wnd_get_state_ptr (local.get $hwnd))))
                  (then (return (i32.const 0))))
                ;; Re-read count/selection below: callbacks may synchronously
                ;; send list messages. Keep the old fallback for other results;
                ;; this change claims only the documented negative returns.
                (local.set $sw (call $g2w (local.get $state)))))))
        (local.set $count (call $lb_count (local.get $sw)))
        (if (i32.eqz (local.get $count)) (then (return (i32.const 0))))
        (local.set $sel (call $lb_cur_sel (local.get $sw)))
        (local.set $simple_multi (i32.and
          (call $lb_caret_supported (local.get $hwnd))
          (i32.eq (i32.and (call $wnd_get_style (local.get $hwnd))
                    (i32.const 0x0C08)) (i32.const 0x0008))))
        ;; Compute visible rows for PGUP/PGDN
        (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
        (local.set $h (call $listbox_content_h (local.get $hwnd) (local.get $sw)))
        (local.set $visible (call $listbox_visible_rows (local.get $hwnd) (local.get $sw)))
        (if (i32.lt_s (local.get $visible) (i32.const 1))
          (then (local.set $visible (i32.const 1))))
        (local.set $row (local.get $sel))
        (block $key_target
          (if (i32.and (local.get $simple_multi)
                       (i32.eq (local.get $wParam) (i32.const 0x20))) ;; VK_SPACE
            (then
              ;; No caret means there is no item to toggle.
              (if (i32.ge_u (local.get $row) (local.get $count))
                (then (return (i32.const 0))))
              (br $key_target)))
        (if (i32.eq (local.get $wParam) (i32.const 0x24)) ;; VK_HOME
          (then (local.set $row (i32.const 0)))
          (else (if (i32.eq (local.get $wParam) (i32.const 0x23)) ;; VK_END
            (then (local.set $row (i32.sub (local.get $count) (i32.const 1))))
            (else (if (i32.eq (local.get $wParam) (i32.const 0x28)) ;; VK_DOWN
              (then
                (if (i32.lt_s (local.get $row) (i32.const 0))
                  (then (local.set $row (i32.const 0)))
                  (else
                    (local.set $row (i32.add (local.get $row) (i32.const 1)))
                    (if (i32.ge_s (local.get $row) (local.get $count))
                      (then (local.set $row (i32.sub (local.get $count) (i32.const 1))))))))
              (else (if (i32.eq (local.get $wParam) (i32.const 0x26)) ;; VK_UP
                (then
                  (if (i32.le_s (local.get $row) (i32.const 0))
                    (then (local.set $row (i32.const 0)))
                    (else (local.set $row (i32.sub (local.get $row) (i32.const 1))))))
                (else (if (i32.eq (local.get $wParam) (i32.const 0x21)) ;; VK_PRIOR
                  (then
                    (if (i32.lt_s (local.get $row) (i32.const 0))
                      (then (local.set $row (i32.const 0)))
                      (else
                        (local.set $row (i32.sub (local.get $row) (local.get $visible)))
                        (if (i32.lt_s (local.get $row) (i32.const 0))
                          (then (local.set $row (i32.const 0)))))))
                  (else (if (i32.eq (local.get $wParam) (i32.const 0x22)) ;; VK_NEXT
                    (then
                      (if (i32.lt_s (local.get $row) (i32.const 0))
                        (then (local.set $row (i32.const 0)))
                        (else
                          (local.set $row (i32.add (local.get $row) (local.get $visible)))
                          (if (i32.ge_s (local.get $row) (local.get $count))
                            (then (local.set $row (i32.sub (local.get $count) (i32.const 1))))))))
                    (else (return (i32.const 0)))))))))))))))
        (call $lb_set_cur_sel (local.get $sw) (local.get $row))
        (if (local.get $simple_multi)
          (then
            (if (i32.eq (local.get $wParam) (i32.const 0x20))
              (then
                (local.set $p (i32.add
                  (call $g2w (call $lb_sel_ptr (local.get $sw))) (local.get $row)))
                (i32.store8 (local.get $p) (i32.eqz (i32.load8_u (local.get $p)))))))
          (else
            (local.set $i (i32.const 0))
            (block $key_sel_done (loop $key_sel
              (br_if $key_sel_done (i32.ge_u (local.get $i) (local.get $count)))
              (i32.store8
                (i32.add (call $g2w (call $lb_sel_ptr (local.get $sw))) (local.get $i))
                (i32.eq (local.get $i) (local.get $row)))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $key_sel)))))
        ;; Adjust top_index so $row stays visible.
        (local.set $top (call $lb_top_index (local.get $sw)))
        (if (i32.lt_s (local.get $row) (local.get $top))
          (then (call $lb_set_top_index (local.get $sw) (local.get $row)))
          (else
            (if (i32.ge_s (local.get $row) (i32.add (local.get $top) (local.get $visible)))
              (then (call $lb_set_top_index (local.get $sw)
                      (i32.add (i32.sub (local.get $row) (local.get $visible)) (i32.const 1)))))))
        (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
        (if (i32.and (i32.ne (local.get $parent) (i32.const 0))
              (i32.or (i32.eqz (i32.or (local.get $simple_multi) (local.get $notify_single)))
                (i32.ne (i32.and (call $wnd_get_style (local.get $hwnd))
                          (i32.const 1)) (i32.const 0))))
          (then (drop (call $wnd_send_message (local.get $parent) (i32.const 0x0111)
                  (i32.or (call $ctrl_table_get_id (local.get $hwnd))
                          (i32.shl (i32.const 1) (i32.const 16)))  ;; LBN_SELCHANGE
                  (local.get $hwnd)))))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.const 0))))

    ;; ---------- LB_INSERTSTRING (0x0181) — wParam=index, lParam=string ptr ----------
    ;; -1 (or any index past the end) means "append" — LB_ADDSTRING semantics.
    ;; A real mid-list insert matters beyond sorted listboxes: an app that keeps
    ;; a parallel array of its own records indexes both by row, so appending a
    ;; string the caller asked to insert at N silently shifts every row past N
    ;; out of step with that array. Task Manager does exactly this (its rows
    ;; pair with a comctl32 DSA), and End Task then acted on the wrong window.
    ;;
    ;; Strategy: let LB_ADDSTRING do the appending and all three buffer grows,
    ;; then rotate that last item down into place.
    (if (i32.eq (local.get $msg) (i32.const 0x0181))
      (then
        (local.set $idx (local.get $wParam))
        (local.set $count (call $lb_count (local.get $sw)))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_s (local.get $idx) (local.get $count)))
          (then (return (call $lb_append_unsorted (local.get $hwnd) (local.get $lParam)))))
        (if (i32.lt_s (call $lb_append_unsorted (local.get $hwnd) (local.get $lParam))
                      (i32.const 0))
          (then (return (i32.const -1))))
        (local.set $items_w (call $g2w (call $lb_items_ptr (local.get $sw))))
        (local.set $used (call $lb_items_used (local.get $sw)))
        ;; Byte offset of item $idx, then of the item just appended.
        (local.set $p (local.get $items_w))
        (local.set $i (i32.const 0))
        (block $ins_at (loop $ins_skip
          (br_if $ins_at (i32.eq (local.get $i) (local.get $idx)))
          (local.set $p (i32.add (local.get $p)
                          (i32.add (call $strlen (local.get $p)) (i32.const 1))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $ins_skip)))
        (local.set $dest_g (i32.sub (local.get $p) (local.get $items_w)))
        (local.set $tmp_w (local.get $p))
        (block $ins_last (loop $ins_walk
          (br_if $ins_last (i32.ge_s (local.get $i) (local.get $count)))
          (local.set $tmp_w (i32.add (local.get $tmp_w)
                              (i32.add (call $strlen (local.get $tmp_w)) (i32.const 1))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $ins_walk)))
        (local.set $last (i32.sub (local.get $tmp_w) (local.get $items_w)))
        (local.set $slen (i32.sub (local.get $used) (local.get $last)))
        ;; Park the appended string, open the gap, drop it in. memory.copy is
        ;; memmove-like, so the overlapping shift up is safe.
        (local.set $tmp_g (call $heap_alloc (local.get $slen)))
        (memory.copy (call $g2w (local.get $tmp_g))
                     (i32.add (local.get $items_w) (local.get $last))
                     (local.get $slen))
        (memory.copy (i32.add (local.get $items_w)
                       (i32.add (local.get $dest_g) (local.get $slen)))
                     (i32.add (local.get $items_w) (local.get $dest_g))
                     (i32.sub (local.get $last) (local.get $dest_g)))
        (memory.copy (i32.add (local.get $items_w) (local.get $dest_g))
                     (call $g2w (local.get $tmp_g))
                     (local.get $slen))
        (call $heap_free (local.get $tmp_g))
        ;; Rotate the parallel item-data array the same way. LB_ADDSTRING
        ;; zeroed the appended slot, so $idx ends up with a fresh 0.
        (if (call $lb_data_ptr (local.get $sw))
          (then
            (local.set $dest_w (call $g2w (call $lb_data_ptr (local.get $sw))))
            (local.set $sz (i32.load
              (i32.add (local.get $dest_w) (i32.mul (local.get $count) (i32.const 4)))))
            (memory.copy
              (i32.add (local.get $dest_w)
                (i32.mul (i32.add (local.get $idx) (i32.const 1)) (i32.const 4)))
              (i32.add (local.get $dest_w) (i32.mul (local.get $idx) (i32.const 4)))
              (i32.mul (i32.sub (local.get $count) (local.get $idx)) (i32.const 4)))
            (i32.store (i32.add (local.get $dest_w) (i32.mul (local.get $idx) (i32.const 4)))
              (local.get $sz))))
        ;; And the byte-per-row multi-selection flags.
        (if (call $lb_sel_ptr (local.get $sw))
          (then
            (local.set $dest_w (call $g2w (call $lb_sel_ptr (local.get $sw))))
            (local.set $sz (i32.load8_u
              (i32.add (local.get $dest_w) (local.get $count))))
            (memory.copy
              (i32.add (local.get $dest_w) (i32.add (local.get $idx) (i32.const 1)))
              (i32.add (local.get $dest_w) (local.get $idx))
              (i32.sub (local.get $count) (local.get $idx)))
            (i32.store8 (i32.add (local.get $dest_w) (local.get $idx)) (local.get $sz))))
        ;; A selection at or after the insert point moves down a row.
        (local.set $sel (call $lb_cur_sel (local.get $sw)))
        (if (i32.ge_s (local.get $sel) (local.get $idx))
          (then (call $lb_set_cur_sel (local.get $sw)
                  (i32.add (local.get $sel) (i32.const 1)))))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (local.get $idx))))

    ;; ---------- LB_DELETESTRING (0x0182) ----------
    ;; wParam = index. Removes the item; returns new count, or LB_ERR(-1).
    (if (i32.eq (local.get $msg) (i32.const 0x0182))
      (then
        (local.set $idx (local.get $wParam))
        (local.set $count (call $lb_count (local.get $sw)))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_s (local.get $idx) (local.get $count)))
          (then (return (i32.const -1))))
        (local.set $items_w (call $g2w (call $lb_items_ptr (local.get $sw))))
        (local.set $p (local.get $items_w))
        (local.set $i (i32.const 0))
        (block $delfound (loop $delskip
          (br_if $delfound (i32.eq (local.get $i) (local.get $idx)))
          (local.set $p (i32.add (local.get $p)
                          (i32.add (call $strlen (local.get $p)) (i32.const 1))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $delskip)))
        (local.set $slen (i32.add (call $strlen (local.get $p)) (i32.const 1)))
        ;; Shift tail down by $slen bytes
        (local.set $used (call $lb_items_used (local.get $sw)))
        (local.set $i (i32.sub (local.get $p) (local.get $items_w)))
        (call $memcpy (local.get $p)
                      (i32.add (local.get $p) (local.get $slen))
                      (i32.sub (local.get $used) (i32.add (local.get $i) (local.get $slen))))
        (call $lb_set_items_used (local.get $sw) (i32.sub (local.get $used) (local.get $slen)))
        (call $lb_set_count (local.get $sw) (i32.sub (local.get $count) (i32.const 1)))
        (call $listbox_hscroll_to (local.get $hwnd) (local.get $sw) (call $lb_scroll_x (local.get $sw)))
        ;; Keep ordinary string-list queries valid before the next paint.
        ;; Reuse the top-index/reveal clamp after count and scrollbar geometry
        ;; change; preserve a valid top, and reset an empty viewport to zero.
        (if (call $lb_caret_supported (local.get $hwnd))
          (then (drop (call $listbox_scroll_to
            (local.get $hwnd) (local.get $sw) (call $lb_top_index (local.get $sw))))))
        ;; Shift parallel data array down by one slot at $idx.
        (if (call $lb_data_ptr (local.get $sw))
          (then
            (local.set $dest_w
              (i32.add (call $g2w (call $lb_data_ptr (local.get $sw)))
                       (i32.mul (local.get $idx) (i32.const 4))))
            (call $memcpy (local.get $dest_w)
                          (i32.add (local.get $dest_w) (i32.const 4))
                          (i32.mul (i32.sub (i32.sub (local.get $count) (local.get $idx))
                                            (i32.const 1))
                                   (i32.const 4)))))
        ;; Shift parallel multi-selection flags down by one row.
        (if (call $lb_sel_ptr (local.get $sw))
          (then
            (local.set $dest_w
              (i32.add (call $g2w (call $lb_sel_ptr (local.get $sw))) (local.get $idx)))
            (call $memcpy (local.get $dest_w)
                          (i32.add (local.get $dest_w) (i32.const 1))
                          (i32.sub (i32.sub (local.get $count) (local.get $idx)) (i32.const 1)))
            (i32.store8
              (i32.add (call $g2w (call $lb_sel_ptr (local.get $sw)))
                       (i32.sub (local.get $count) (i32.const 1)))
              (i32.const 0))))
        ;; Adjust cur_sel if affected
        (local.set $sel (call $lb_cur_sel (local.get $sw)))
        (if (i32.eq (local.get $sel) (local.get $idx))
          (then (call $lb_set_cur_sel (local.get $sw) (i32.const -1)))
          (else (if (i32.gt_s (local.get $sel) (local.get $idx))
            (then (call $lb_set_cur_sel (local.get $sw) (i32.sub (local.get $sel) (i32.const 1)))))))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.sub (local.get $count) (i32.const 1)))))

    ;; ---------- LB_GETITEMDATA (0x0199) / LB_SETITEMDATA (0x019A) ----------
    ;; wParam = index. SETITEMDATA's lParam is the new u32. Out-of-range → -1.
    (if (i32.or (i32.eq (local.get $msg) (i32.const 0x0199))
                (i32.eq (local.get $msg) (i32.const 0x019A)))
      (then
        (local.set $idx (local.get $wParam))
        (local.set $count (call $lb_count (local.get $sw)))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_s (local.get $idx) (local.get $count)))
          (then (return (i32.const -1))))
        (if (i32.eqz (call $lb_data_ptr (local.get $sw)))
          (then (return (i32.const 0))))
        (local.set $dest_w
          (i32.add (call $g2w (call $lb_data_ptr (local.get $sw)))
                   (i32.mul (local.get $idx) (i32.const 4))))
        (if (i32.eq (local.get $msg) (i32.const 0x019A))
          (then
            (i32.store (local.get $dest_w) (local.get $lParam))
            (return (i32.const 0))))
        (return (i32.load (local.get $dest_w)))))

    ;; ---------- LB_FINDSTRING (0x018F) / LB_FINDSTRINGEXACT (0x01A2) ----------
    ;; Text lists compare strings; no-string owner-draw lists compare item data.
    (if (i32.or (i32.eq (local.get $msg) (i32.const 0x018F))
                (i32.eq (local.get $msg) (i32.const 0x01A2)))
      (then
        (local.set $count (call $lb_count (local.get $sw)))
        (if (i32.eqz (local.get $count)) (then (return (i32.const -1))))
        (local.set $ownerdraw (i32.and (i32.ne (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x0030)) (i32.const 0)) (i32.eqz (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x0040)))))
        (if (i32.eqz (local.get $ownerdraw)) (then
          (if (i32.eqz (local.get $lParam)) (then (return (i32.const -1))))
          (local.set $src_w (call $g2w (local.get $lParam)))
          (local.set $slen (call $strlen (local.get $src_w)))))
        (local.set $idx (local.get $wParam))
        (if (i32.lt_s (local.get $idx) (i32.const 0))
          (then (local.set $idx (i32.sub (local.get $count) (i32.const 1)))))
        (local.set $items_w (call $g2w (call $lb_items_ptr (local.get $sw))))
        (local.set $i (i32.const 0))
        (block $fsdone (loop $fsloop
          (br_if $fsdone (i32.ge_s (local.get $i) (local.get $count)))
          (local.set $idx (i32.add (local.get $idx) (i32.const 1)))
          (if (i32.ge_s (local.get $idx) (local.get $count))
            (then (local.set $idx (i32.const 0))))
          (if (local.get $ownerdraw) (then
            (if (i32.eq (i32.load (i32.add (call $g2w (call $lb_data_ptr (local.get $sw)))
                                           (i32.mul (local.get $idx) (i32.const 4)))) (local.get $lParam))
              (then (return (local.get $idx))))
            (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $fsloop)))
          (local.set $p (local.get $items_w))
          (local.set $row (i32.const 0))
          (block $fsskip (loop $fssk
            (br_if $fsskip (i32.eq (local.get $row) (local.get $idx)))
            (local.set $p (i32.add (local.get $p)
                            (i32.add (call $strlen (local.get $p)) (i32.const 1))))
            (local.set $row (i32.add (local.get $row) (i32.const 1)))
            (br $fssk)))
          (local.set $row_y (call $strlen (local.get $p))) ;; reuse $row_y as item-len
          (if (i32.eq (local.get $msg) (i32.const 0x01A2))
            (then (if (i32.ne (local.get $row_y) (local.get $slen))
                    (then (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $fsloop))))
            (else (if (i32.lt_u (local.get $row_y) (local.get $slen))
                    (then (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $fsloop)))))
          (if (call $listbox_strncmpi (local.get $p) (local.get $src_w) (local.get $slen))
            (then (return (local.get $idx))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $fsloop)))
        (return (i32.const -1))))

    ;; ---------- LB_SELECTSTRING (0x018C) ----------
    ;; FINDSTRING + SETCURSEL. Returns selected index or LB_ERR.
    (if (i32.eq (local.get $msg) (i32.const 0x018C))
      (then
        (local.set $idx (call $listbox_wndproc (local.get $hwnd)
                          (i32.const 0x018F) (local.get $wParam) (local.get $lParam)))
        (if (i32.lt_s (local.get $idx) (i32.const 0)) (then (return (i32.const -1))))
        (drop (call $listbox_wndproc (local.get $hwnd)
                (i32.const 0x0186) (local.get $idx) (i32.const 0)))
        (return (local.get $idx))))

    ;; ---------- LB_GETTOPINDEX (0x018E) / LB_SETTOPINDEX (0x0197) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x018E))
      (then (return (call $lb_top_index (local.get $sw)))))
    (if (i32.eq (local.get $msg) (i32.const 0x0197))
      (then
        (drop (call $listbox_scroll_to
          (local.get $hwnd) (local.get $sw) (local.get $wParam)))
        (return (i32.const 0))))

    ;; ---------- WM_MOUSEWHEEL (0x020A) ----------
    ;; Three rows per 120-unit wheel notch, matching the sibling controls.
    (if (i32.eq (local.get $msg) (i32.const 0x020A))
      (then
        (local.set $delta
          (i32.div_s
            (i32.sub (i32.const 0) (i32.shr_s (local.get $wParam) (i32.const 16)))
            (i32.const 40)))
        (drop (call $listbox_scroll_to
          (local.get $hwnd) (local.get $sw)
          (i32.add (call $lb_top_index (local.get $sw)) (local.get $delta))))
        (return (i32.const 0))))

    ;; ---------- WM_VSCROLL (0x0115) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0115))
      (then
        (local.set $code (i32.and (local.get $wParam) (i32.const 0xFFFF)))
        (local.set $top (call $lb_top_index (local.get $sw)))
        (local.set $visible (call $listbox_visible_rows (local.get $hwnd) (local.get $sw)))
        (local.set $idx (local.get $top))
        (if (i32.eq (local.get $code) (i32.const 0)) ;; SB_LINEUP
          (then (local.set $idx (i32.sub (local.get $top) (i32.const 1)))))
        (if (i32.eq (local.get $code) (i32.const 1)) ;; SB_LINEDOWN
          (then (local.set $idx (i32.add (local.get $top) (i32.const 1)))))
        (if (i32.eq (local.get $code) (i32.const 2)) ;; SB_PAGEUP
          (then (local.set $idx (i32.sub (local.get $top) (local.get $visible)))))
        (if (i32.eq (local.get $code) (i32.const 3)) ;; SB_PAGEDOWN
          (then (local.set $idx (i32.add (local.get $top) (local.get $visible)))))
        (if (i32.or (i32.eq (local.get $code) (i32.const 4)) ;; SB_THUMBPOSITION
                    (i32.eq (local.get $code) (i32.const 5))) ;; SB_THUMBTRACK
          (then (local.set $idx (i32.shr_u (local.get $wParam) (i32.const 16)))))
        (if (i32.eq (local.get $code) (i32.const 6)) ;; SB_TOP
          (then (local.set $idx (i32.const 0))))
        (if (i32.eq (local.get $code) (i32.const 7)) ;; SB_BOTTOM
          (then (local.set $idx (call $lb_count (local.get $sw)))))
        (drop (call $listbox_scroll_to
          (local.get $hwnd) (local.get $sw) (local.get $idx)))
        (return (i32.const 0))))

    ;; ---------- WM_PAINT (0x000F) ----------
    ;; Draw inset frame, white interior, and visible item rows. Selected
    ;; item is rendered with the system highlight (blue background +
    ;; white text). Item height is fixed at 16 px. If WS_VSCROLL is set,
    ;; a 16px scrollbar strip is reserved at the right edge.
    (if (i32.eq (local.get $msg) (i32.const 0x000F))
      (then
        (if (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 4))
          (then (return (i32.const 0))))
        ;; Skip paint when not WS_VISIBLE — combobox dropdowns rely on this:
        ;; their inner listbox child is invisible until $combobox_open_dropdown
        ;; sets WS_VISIBLE. Without this guard, LB_ADDSTRING's invalidate path
        ;; would paint the invisible dropped-area onto the parent every time
        ;; the combobox is populated.
        (if (i32.eqz (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x10000000)))
          (then (return (i32.const 0))))
        (call $host_paint_begin (local.get $hwnd))
        (call $listbox_hscroll_to (local.get $hwnd) (local.get $sw) (call $lb_scroll_x (local.get $sw)))
        (drop (call $listbox_scroll_to (local.get $hwnd) (local.get $sw) (call $lb_top_index (local.get $sw))))
        (local.set $hdc (i32.add (local.get $hwnd) (i32.const 0x40000)))
        (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
        (local.set $w (i32.and (local.get $sz) (i32.const 0xFFFF)))
        (local.set $h (call $listbox_content_h (local.get $hwnd) (local.get $sw)))
        (drop (call $gdi_native_select_object (local.get $hdc)
          (select (load.field.memarg ListBoxState font (local.get $sw))
            (i32.const 0x30021)
            (i32.ne (load.field.memarg ListBoxState font (local.get $sw)) (i32.const 0)))))
        (drop (call $gdi_native_set_bk_mode (local.get $hdc) (i32.const 1)))
        ;; Reserve the right strip only while USER would make it visible.
        (if (call $listbox_vscroll_visible (local.get $hwnd) (local.get $sw))
          (then (local.set $w (i32.sub (local.get $w) (i32.const 16)))))
        ;; White interior + sunken edge (content rect only).
        (drop (call $gdi_native_fill_rect (local.get $hdc)
                (i32.const 0) (i32.const 0) (local.get $w) (local.get $h)
                (i32.const 0x30010)))
        (drop (call $gdi_native_draw_edge (local.get $hdc)
                (i32.const 0) (i32.const 0) (local.get $w) (local.get $h)
                (i32.const 0x0A) (i32.const 0x0F)))
        (local.set $count (call $lb_count (local.get $sw)))
        (local.set $sel   (call $lb_cur_sel (local.get $sw)))
        (local.set $top   (call $lb_top_index (local.get $sw)))
        ;; LBS_OWNERDRAWFIXED (0x0010) / LBS_OWNERDRAWVARIABLE (0x0020).
        (local.set $ownerdraw
          (i32.ne (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x0030))
                  (i32.const 0)))
        ;; Measure once, on the first paint: by now the owner's dlgproc is
        ;; installed, which it need not be while the control is being created.
        (if (i32.and (local.get $ownerdraw) (i32.eqz (call $lb_item_h (local.get $sw))))
          (then (call $lb_set_item_h (local.get $sw)
                  (call $lb_measure_item (local.get $hwnd) (local.get $sw)))))
        (local.set $row_h (call $lb_row_height (local.get $sw)))
        (local.set $visible (call $listbox_visible_rows (local.get $hwnd) (local.get $sw)))
        ;; Ordinary string rows include the clipped bottom row. Otherwise a
        ;; successful partial reveal could leave the requested item unpainted.
        ;; Owner-draw keeps its existing callback domain.
        (if (call $lb_caret_supported (local.get $hwnd))
          (then (local.set $visible (call $lb_caret_visible_rows
            (local.get $hwnd) (local.get $sw) (i32.const 1)))))
        ;; Native controls do not call BeginPaint. Clip rows to the inset
        ;; content rectangle, preserving the caller's clip and restoring it
        ;; before drawing either strip. This also contains negative text x.
        (local.set $saved_dc (call $gdi_dc_save (local.get $hdc)))
        (drop (call $gdi_native_intersect_clip_rect (local.get $hdc)
          (i32.const 2) (i32.const 2) (i32.sub (local.get $w) (i32.const 2)) (i32.sub (local.get $h) (i32.const 2))))
        ;; Walk to the first visible item.
        (local.set $items_w (call $g2w (call $lb_items_ptr (local.get $sw))))
        (local.set $p (local.get $items_w))
        (local.set $i (i32.const 0))
        (block $skip_done (loop $skip
          (br_if $skip_done (i32.ge_u (local.get $i) (local.get $top)))
          (br_if $skip_done (i32.ge_u (local.get $i) (local.get $count)))
          (local.set $p (i32.add (local.get $p)
                          (i32.add (call $strlen (local.get $p)) (i32.const 1))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $skip)))
        ;; Render visible rows.
        (local.set $row (i32.const 0))
        (block $rows_done (loop $rows
          (br_if $rows_done (i32.ge_u (local.get $row) (local.get $visible)))
          (local.set $idx (i32.add (local.get $top) (local.get $row)))
          (br_if $rows_done (i32.ge_u (local.get $idx) (local.get $count)))
          (local.set $row_y (i32.add (i32.const 2) (i32.mul (local.get $row) (local.get $row_h))))
          (local.set $slen (call $strlen (local.get $p)))
          (if (local.get $ownerdraw)
            (then
              (call $lb_send_drawitem (local.get $hwnd) (local.get $sw) (local.get $idx)
                (local.get $row_y) (local.get $w) (local.get $row_h)
                (i32.load8_u (i32.add (call $g2w (call $lb_sel_ptr (local.get $sw)))
                                      (local.get $idx))))
              ;; The owner owns the whole row; skip our own text/highlight pass.
              (local.set $p (i32.add (local.get $p) (i32.add (local.get $slen) (i32.const 1))))
              (local.set $row (i32.add (local.get $row) (i32.const 1)))
              (br $rows)))
          (if (i32.load8_u
                (i32.add (call $g2w (call $lb_sel_ptr (local.get $sw))) (local.get $idx)))
            (then
              ;; Highlight bar (system blue) + white text. We use a fresh
              ;; solid brush each time so we don't depend on COLOR_HIGHLIGHT
              ;; being mapped in the stock-brush table.
              (local.set $brush (call $gdi_native_create_solid_brush (i32.const 0x00800000)))
              (drop (call $gdi_native_fill_rect (local.get $hdc)
                      (i32.const 2) (local.get $row_y)
                      (i32.sub (local.get $w) (i32.const 2))
                      (i32.add (local.get $row_y) (local.get $row_h))
                      (local.get $brush)))
              (drop (call $gdi_native_delete_object (local.get $brush)))
              (drop (call $gdi_native_set_text_color (local.get $hdc) (i32.const 0x00FFFFFF)))
              (if (local.get $slen)
                (then (drop (call $lb_draw_string (local.get $hwnd) (local.get $sw) (local.get $hdc)
                              (i32.sub (i32.const 4) (call $lb_scroll_x (local.get $sw))) (i32.add (local.get $row_y) (i32.const 2))
                              (local.get $p) (local.get $slen)))))
              (drop (call $gdi_native_set_text_color (local.get $hdc) (i32.const 0x00000000))))
            (else
              (if (local.get $slen)
                (then (drop (call $lb_draw_string (local.get $hwnd) (local.get $sw) (local.get $hdc)
                              (i32.sub (i32.const 4) (call $lb_scroll_x (local.get $sw))) (i32.add (local.get $row_y) (i32.const 2))
                              (local.get $p) (local.get $slen)))))))
          (local.set $p (i32.add (local.get $p) (i32.add (local.get $slen) (i32.const 1))))
          (local.set $row (i32.add (local.get $row) (i32.const 1)))
          (br $rows)))
        (drop (call $gdi_dc_restore (local.get $hdc) (local.get $saved_dc)))
        (if (call $listbox_hscroll_visible (local.get $hwnd) (local.get $sw))
          (then
            (local.set $page (call $listbox_hscroll_page (local.get $hwnd) (local.get $sw)))
            (local.set $max (call $lb_horizontal_extent (local.get $sw)))
            (call $defwndproc_paint_standard_scrollbar (local.get $hdc)
              (i32.const 0) (local.get $h) (local.get $w) (i32.const 16) (i32.const 0)
              (call $lb_scroll_x (local.get $sw)) (i32.const 0)
              (select (i32.sub (local.get $max) (i32.const 1)) (i32.const 0) (i32.gt_s (local.get $max) (i32.const 0)))
              (local.get $page)
              (select (global.get $sb_pressed_part) (i32.const 0) (i32.eq (global.get $sb_pressed_hwnd) (local.get $hwnd)))
              (select (i32.const 3) (call $scroll_arrow_mask (local.get $hwnd) (i32.const 0))
                (i32.le_s (local.get $max) (local.get $page))))
            (if (call $listbox_vscroll_visible (local.get $hwnd) (local.get $sw))
              (then (drop (call $gdi_native_fill_rect (local.get $hdc)
                (local.get $w) (local.get $h) (i32.add (local.get $w) (i32.const 16))
                (i32.add (local.get $h) (i32.const 16)) (i32.const 0x30011)))))))
        ;; Visible WS_VSCROLL strip. $w here is already reduced; full width is via sz.
        (if (call $listbox_vscroll_visible (local.get $hwnd) (local.get $sw))
          (then
            (local.set $visible (call $listbox_visible_rows (local.get $hwnd) (local.get $sw)))
            (local.set $max (i32.sub (local.get $count) (local.get $visible)))
            (if (i32.lt_s (local.get $max) (i32.const 0))
              (then (local.set $max (i32.const 0))))
            (call $paint_vscrollbar_rect (local.get $hdc)
              (local.get $w) (i32.const 0) (i32.const 16) (local.get $h)
              (call $lb_top_index (local.get $sw)) (local.get $max)
              (select (global.get $sb_pressed_part) (i32.const 0)
                      (i32.eq (global.get $sb_pressed_hwnd) (local.get $hwnd)))
              (call $scroll_arrow_mask (local.get $hwnd) (i32.const 1)))))
        (call $host_paint_end (local.get $hwnd))
        (return (i32.const 0))))

    ;; Default
    (i32.const 0)
  )

