  ;; ============================================================
  ;; Edit WndProc
  ;; ============================================================
  ;; Status: STEP 4 — dormant. No path delivers WM_CREATE to an EDIT
  ;; class hwnd today; the new code is unreachable until STEP 5 wires
  ;; WAT-side dialog creation through $create_findreplace_dialog.
  ;;
  ;; EditState (32 bytes, allocated in WM_CREATE)
  ;;   +0   text_buf_ptr   guest ptr (NUL-terminated)
  ;;   +4   text_len       chars (excluding NUL)
  ;;   +8   text_cap       allocated capacity (excluding NUL slot)
  ;;   +12  cursor         char position
  ;;   +16  sel_anchor     selection anchor (== cursor → no selection)
  ;;   +20  scroll_top     reserved for multi-line (0 in single-line)
  ;;   +24  flags          bit0=multiline bit1=password bit2=readonly bit3=focused
  ;;                       bit4=dragging selection bit5=caret visible
  ;;   +28  max_length     0 = unlimited
  ;;   +32  font           HFONT from WM_SETFONT (0 = default GUI font)
  ;;   +36  scroll_x       horizontal scroll offset in pixels (WS_HSCROLL)

  ;; Word wrap is on when the edit has WS_VSCROLL and cannot scroll sideways:
  ;; no ES_AUTOHSCROLL, and no WS_HSCROLL either. USER32 implies the style bit
  ;; from the scrollbar on a multiline edit ("if (WS_HSCROLL) style |=
  ;; ES_AUTOHSCROLL"), which is why Win98 Notepad opens *unwrapped* — it asks
  ;; for both bars and no ES_AUTO* at all, and Word Wrap is it recreating the
  ;; edit without WS_HSCROLL. Reading only ES_AUTOHSCROLL wrapped it from the
  ;; start, against the real control.
  ;;
  ;; The two halves have to agree: a wrapped edit has nothing to scroll
  ;; horizontally over and its paint path draws no bottom strip, so it must not
  ;; reserve one either. Where they disagreed the control left a 16px band it
  ;; never painted into, showing whatever the parent last erased there.
  (func $edit_wraps (param $hwnd i32) (result i32)
    (local $style i32)
    (local.set $style (call $wnd_get_style (local.get $hwnd)))
    (i32.and
      (i32.ne (i32.and (local.get $style) (i32.const 0x00200000)) (i32.const 0))
      (i32.eqz (i32.and (local.get $style) (i32.const 0x00100080)))))

  ;; WS_HSCROLL that actually costs the client 16px at the bottom: the style
  ;; bit, minus the wrapped case above. Every place that reserves the strip
  ;; must agree with the painter, or the caret and the hit-test measure a
  ;; viewport a different height from the one on screen.
  (func $edit_hscroll_reserved (param $hwnd i32) (result i32)
    (i32.and
      (i32.ne
        (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x00100000))
        (i32.const 0))
      (i32.eqz (call $edit_wraps (local.get $hwnd)))))

  ;; Keep the caret inside the viewport, which is what USER's EM_SCROLLCARET
  ;; does and what every EDIT operation that moves the caret ends with. Without
  ;; it, typing past the last visible line keeps editing text nobody can see:
  ;; the buffer grows, the caret advances, and the window still shows line 1.
  ;; Returns 1 when the viewport moved, so callers can tell a scroll from a
  ;; plain edit if they ever need to.
  (func $edit_scroll_caret_into_view (param $hwnd i32) (result i32)
    (local $state i32) (local $state_w i32) (local $style i32)
    (local $sz i32) (local $w i32) (local $h i32)
    (local $visible i32) (local $line i32) (local $top i32)
    (local $total i32) (local $max i32)
    (local.set $state (call $wnd_get_state_ptr (local.get $hwnd)))
    (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
    (local.set $state_w (call $g2w (local.get $state)))
    (local.set $style (call $wnd_get_style (local.get $hwnd)))
    ;; ES_MULTILINE only: a single-line edit scrolls horizontally, and that is
    ;; handled by the painter's own left-clamp.
    (if (i32.eqz (i32.and (local.get $style) (i32.const 0x00000004)))
      (then (return (i32.const 0))))
    (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
    (local.set $w (i32.and (local.get $sz) (i32.const 0xFFFF)))
    (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
    (if (i32.and (local.get $style) (i32.const 0x00200000)) ;; WS_VSCROLL
      (then
        (if (i32.gt_u (local.get $w) (i32.const 16))
          (then (local.set $w (i32.sub (local.get $w) (i32.const 16)))))))
    (if (call $edit_hscroll_reserved (local.get $hwnd))
      (then
        (if (i32.gt_u (local.get $h) (i32.const 16))
          (then (local.set $h (i32.sub (local.get $h) (i32.const 16)))))))
    ;; Same viewport arithmetic the wheel handler and the painter use.
    (local.set $visible (i32.div_u (i32.sub (local.get $h) (i32.const 8)) (i32.const 16)))
    (if (i32.eqz (local.get $visible)) (then (local.set $visible (i32.const 1))))
    (if (call $edit_wraps (local.get $hwnd))
      (then
        ;; Wrapped: visual lines, so a wrapped paragraph counts for each row.
        (local.set $total (call $edit_layout_build (local.get $state_w)
          (i32.add (local.get $hwnd) (i32.const 0x40000)) (local.get $w)))
        (local.set $line (call $edit_layout_line_for_char (local.get $total)
          (load.field.memarg EditState cursor (local.get $state_w)))))
      (else
        (local.set $total (i32.add
          (call $edit_line_from_char (local.get $state_w)
            (load.field.memarg EditState text_len (local.get $state_w)))
          (i32.const 1)))
        (local.set $line (call $edit_line_from_char (local.get $state_w)
          (load.field.memarg EditState cursor (local.get $state_w))))))
    (local.set $top (load.field.memarg EditState scroll_top (local.get $state_w)))
    (if (i32.lt_s (local.get $line) (local.get $top))
      (then (local.set $top (local.get $line))))
    (if (i32.ge_s (local.get $line) (i32.add (local.get $top) (local.get $visible)))
      (then (local.set $top (i32.add (i32.sub (local.get $line) (local.get $visible))
                                     (i32.const 1)))))
    (local.set $max (i32.sub (local.get $total) (local.get $visible)))
    (if (i32.lt_s (local.get $max) (i32.const 0)) (then (local.set $max (i32.const 0))))
    (if (i32.gt_s (local.get $top) (local.get $max)) (then (local.set $top (local.get $max))))
    (if (i32.lt_s (local.get $top) (i32.const 0)) (then (local.set $top (i32.const 0))))
    (call $edit_publish_scroll_info (local.get $hwnd)
      (local.get $top) (local.get $total) (local.get $visible))
    (if (i32.eq (local.get $top) (load.field.memarg EditState scroll_top (local.get $state_w)))
      (then (return (i32.const 0))))
    (store.field.memarg EditState scroll_top (local.get $state_w) (local.get $top))
    (i32.const 1))

  ;; Publish the viewport into the window's scrollbar state, which is what an
  ;; EDIT does with SetScrollInfo after every change. $defwndproc_ncpaint
  ;; paints the strip straight out of SCROLL_TABLE, so without this the thumb
  ;; sits at the top of the track no matter where the text is scrolled to --
  ;; and a click on that stale thumb gets classified as a page, not a drag.
  (func $edit_publish_scroll_info (param $hwnd i32)
        (param $pos i32) (param $total i32) (param $visible i32)
    (local $slot i32) (local $base i32) (local $aux i32)
    (local.set $slot (call $wnd_table_find (local.get $hwnd)))
    (if (i32.lt_s (local.get $slot) (i32.const 0)) (then (return)))
    (local.set $base (call $scroll_record_addr (local.get $slot)))
    (local.set $aux (call $scroll_aux_addr (local.get $slot)))
    (if (i32.lt_s (local.get $total) (i32.const 1)) (then (local.set $total (i32.const 1))))
    (if (i32.lt_s (local.get $visible) (i32.const 1)) (then (local.set $visible (i32.const 1))))
    (i32.store offset=12 (local.get $base) (local.get $pos))
    (i32.store offset=16 (local.get $base) (i32.const 0))
    (i32.store offset=20 (local.get $base) (i32.sub (local.get $total) (i32.const 1)))
    (i32.store offset=8 (local.get $aux) (local.get $visible)))

  ;; Total lines and visible rows for a multiline edit, packed visible<<16 |
  ;; total. The wheel handler, the scrollbar click, the thumb drag and the
  ;; painter each computed this inline, and any drift between the four showed
  ;; up as a scrollbar that scrolled somewhere the text was not. It runs per
  ;; input event, not per pixel, so sharing it costs nothing measurable.
  (func $edit_view_metrics (param $hwnd i32) (param $state_w ptr<EditState>) (result i32)
    (local $style i32) (local $sz i32) (local $w i32) (local $h i32)
    (local $total i32) (local $visible i32)
    (local.set $style (call $wnd_get_style (local.get $hwnd)))
    (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
    (local.set $w (i32.and (local.get $sz) (i32.const 0xFFFF)))
    (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
    (if (i32.and (local.get $style) (i32.const 0x00200000)) ;; WS_VSCROLL
      (then
        (if (i32.gt_u (local.get $w) (i32.const 16))
          (then (local.set $w (i32.sub (local.get $w) (i32.const 16)))))))
    (if (call $edit_hscroll_reserved (local.get $hwnd))
      (then
        (if (i32.gt_u (local.get $h) (i32.const 16))
          (then (local.set $h (i32.sub (local.get $h) (i32.const 16)))))))
    (local.set $visible (i32.div_u
      (select (i32.sub (local.get $h) (i32.const 8)) (i32.const 1)
              (i32.gt_u (local.get $h) (i32.const 8)))
      (i32.const 16)))
    (if (i32.eqz (local.get $visible)) (then (local.set $visible (i32.const 1))))
    (if (call $edit_wraps (local.get $hwnd))
      (then (local.set $total (call $edit_layout_build (local.get $state_w)
        (i32.add (local.get $hwnd) (i32.const 0x40000)) (local.get $w))))
      (else (local.set $total (i32.add
        (call $edit_line_from_char (local.get $state_w)
          (load.field.memarg EditState text_len (local.get $state_w)))
        (i32.const 1)))))
    (if (i32.lt_s (local.get $total) (i32.const 1)) (then (local.set $total (i32.const 1))))
    (i32.or (i32.and (local.get $total) (i32.const 0xFFFF))
            (i32.shl (local.get $visible) (i32.const 16))))

  ;; Clamp and store a new first-visible line, publishing it to the scrollbar.
  ;; Returns 1 when the viewport actually moved.
  (func $edit_scroll_to (param $hwnd i32) (param $state_w ptr<EditState>) (param $top i32)
        (param $total i32) (param $visible i32) (result i32)
    (local $max i32)
    (local.set $max (i32.sub (local.get $total) (local.get $visible)))
    (if (i32.lt_s (local.get $max) (i32.const 0)) (then (local.set $max (i32.const 0))))
    (if (i32.gt_s (local.get $top) (local.get $max)) (then (local.set $top (local.get $max))))
    (if (i32.lt_s (local.get $top) (i32.const 0)) (then (local.set $top (i32.const 0))))
    (call $edit_publish_scroll_info (local.get $hwnd)
      (local.get $top) (local.get $total) (local.get $visible))
    (if (i32.eq (local.get $top) (load.field.memarg EditState scroll_top (local.get $state_w)))
      (then (return (i32.const 0))))
    (store.field.memarg EditState scroll_top (local.get $state_w) (local.get $top))
    (i32.const 1))

  ;; Drop-in for $invalidate_hwnd at the sites where the user moved the caret.
  (func $edit_invalidate_caret (param $hwnd i32)
    (drop (call $edit_scroll_caret_into_view (local.get $hwnd)))
    (call $invalidate_hwnd (local.get $hwnd)))

  ;; A real EDIT does not own a caret of its own: on WM_SETFOCUS it calls
  ;; CreateCaret + SetCaretPos + ShowCaret and USER draws and blinks it. Doing
  ;; the same here means one caret mechanism instead of two -- the compositor
  ;; blinks it, GetCaretPos answers about it, and the page can tell that
  ;; keystrokes have somewhere to land (which is what raises a phone keyboard)
  ;; without knowing anything about this control.
  (func $edit_reset_caret_timer (param $hwnd i32) (param $state_w ptr<EditState>)
    (global.set $tick_count (call $host_get_ticks))
    (store.field.memarg EditState flags (local.get $state_w)
      (i32.or (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0x20)))
    (global.set $caret_hwnd (local.get $hwnd))
    (global.set $caret_w (i32.const 2))
    (global.set $caret_h (i32.const 15))
    (global.set $caret_visible (i32.const 1)))

  ;; WM_KILLFOCUS: DestroyCaret. The page reads this as "text no longer has
  ;; anywhere to land", which is what takes a phone's keyboard back down.
  (func $edit_stop_caret_timer (param $hwnd i32) (param $state_w ptr<EditState>)
    (drop (call $timer_kill (local.get $hwnd) (i32.const 0xCA47)))
    (store.field.memarg EditState flags (local.get $state_w)
      (i32.and (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0xFFFFFFDF)))
    (if (i32.eq (global.get $caret_hwnd) (local.get $hwnd))
      (then
        (global.set $caret_visible (i32.const 0))
        (global.set $caret_hwnd (i32.const 0)))))

  ;; Right-shift n bytes by 1 (memmove src→src+1). Reverse copy so overlap is safe.
  (func $edit_memmove_right (param $src i32) (param $n i32)
    ;; Backward byte copy of n bytes to src+1 — memmove, hence memory.copy.
    (memory.copy (i32.add (local.get $src) (i32.const 1))
                 (local.get $src)
                 (local.get $n))
  )

  ;; Ensure EditState has capacity for at least $need_cap chars (excl NUL).
  (func $edit_ensure_cap (param $state_w ptr<EditState>) (param $need_cap i32)
    (local $cap i32) (local $new_cap i32) (local $old_buf i32) (local $new_buf i32) (local $len i32)
    (local.set $cap (load.field.memarg EditState text_cap (local.get $state_w)))
    (if (i32.le_u (local.get $need_cap) (local.get $cap)) (then (return)))
    (local.set $new_cap (i32.shl (local.get $cap) (i32.const 1)))
    (if (i32.lt_u (local.get $new_cap) (local.get $need_cap))
      (then (local.set $new_cap (local.get $need_cap))))
    (if (i32.lt_u (local.get $new_cap) (i32.const 32))
      (then (local.set $new_cap (i32.const 32))))
    (local.set $new_buf (call $heap_alloc (i32.add (local.get $new_cap) (i32.const 1))))
    (local.set $old_buf (load.field EditState text_buf_ptr (local.get $state_w)))
    (local.set $len (load.field.memarg EditState text_len (local.get $state_w)))
    (if (local.get $old_buf)
      (then (if (local.get $len)
              (then (call $memcpy (call $g2w (local.get $new_buf))
                                  (call $g2w (local.get $old_buf))
                                  (local.get $len))))))
    (i32.store8 (i32.add (call $g2w (local.get $new_buf)) (local.get $len)) (i32.const 0))
    (if (local.get $old_buf) (then (call $heap_free (local.get $old_buf))))
    (store.field EditState text_buf_ptr (local.get $state_w) (local.get $new_buf))
    (store.field.memarg EditState text_cap (local.get $state_w) (local.get $new_cap))
  )

  (func $edit_sel_lo (param $state_w ptr<EditState>) (result i32)
    (local $a i32) (local $b i32)
    (local.set $a (load.field.memarg EditState cursor (local.get $state_w)))
    (local.set $b (load.field.memarg EditState sel_anchor (local.get $state_w)))
    (select (local.get $a) (local.get $b) (i32.lt_u (local.get $a) (local.get $b))))

  (func $edit_sel_hi (param $state_w ptr<EditState>) (result i32)
    (local $a i32) (local $b i32)
    (local.set $a (load.field.memarg EditState cursor (local.get $state_w)))
    (local.set $b (load.field.memarg EditState sel_anchor (local.get $state_w)))
    (select (local.get $a) (local.get $b) (i32.gt_u (local.get $a) (local.get $b))))

  ;; Delete characters in [lo..hi). Updates text_len, cursor, sel_anchor → lo.
  (func $edit_delete_range (param $state_w ptr<EditState>) (param $lo i32) (param $hi i32)
    (local $buf_w i32) (local $len i32) (local $tail i32)
    (if (i32.ge_u (local.get $lo) (local.get $hi)) (then (return)))
    (local.set $len (load.field.memarg EditState text_len (local.get $state_w)))
    (if (i32.gt_u (local.get $hi) (local.get $len)) (then (local.set $hi (local.get $len))))
    (local.set $buf_w (call $g2w (load.field EditState text_buf_ptr (local.get $state_w))))
    (local.set $tail (i32.sub (local.get $len) (local.get $hi)))
    (if (local.get $tail)
      (then (call $memcpy
              (i32.add (local.get $buf_w) (local.get $lo))
              (i32.add (local.get $buf_w) (local.get $hi))
              (local.get $tail))))
    (local.set $len (i32.sub (local.get $len) (i32.sub (local.get $hi) (local.get $lo))))
    (store.field.memarg EditState text_len (local.get $state_w) (local.get $len))
    (i32.store8 (i32.add (local.get $buf_w) (local.get $len)) (i32.const 0))
    (store.field.memarg EditState cursor (local.get $state_w) (local.get $lo))
    (store.field.memarg EditState sel_anchor (local.get $state_w) (local.get $lo))
  )

  ;; Insert one byte at cursor (delete selection first).
  (func $edit_insert_char (param $state_w ptr<EditState>) (param $ch i32)
    (local $lo i32) (local $hi i32) (local $cur i32) (local $len i32) (local $buf_w i32) (local $tail i32) (local $maxlen i32)
    (local.set $lo (call $edit_sel_lo (local.get $state_w)))
    (local.set $hi (call $edit_sel_hi (local.get $state_w)))
    (if (i32.ne (local.get $lo) (local.get $hi))
      (then (call $edit_delete_range (local.get $state_w) (local.get $lo) (local.get $hi))))
    (local.set $len (load.field.memarg EditState text_len (local.get $state_w)))
    (local.set $maxlen (load.field.memarg EditState max_length (local.get $state_w)))
    (if (local.get $maxlen)
      (then (if (i32.ge_u (local.get $len) (local.get $maxlen))
              (then (return)))))
    (call $edit_ensure_cap (local.get $state_w) (i32.add (local.get $len) (i32.const 1)))
    (local.set $cur (load.field.memarg EditState cursor (local.get $state_w)))
    (local.set $buf_w (call $g2w (load.field EditState text_buf_ptr (local.get $state_w))))
    (local.set $tail (i32.sub (local.get $len) (local.get $cur)))
    (if (local.get $tail)
      (then (call $edit_memmove_right
              (i32.add (local.get $buf_w) (local.get $cur))
              (local.get $tail))))
    (i32.store8 (i32.add (local.get $buf_w) (local.get $cur)) (local.get $ch))
    (local.set $cur (i32.add (local.get $cur) (i32.const 1)))
    (local.set $len (i32.add (local.get $len) (i32.const 1)))
    (store.field.memarg EditState text_len (local.get $state_w) (local.get $len))
    (store.field.memarg EditState cursor (local.get $state_w) (local.get $cur))
    (store.field.memarg EditState sel_anchor (local.get $state_w) (local.get $cur))
    (i32.store8 (i32.add (local.get $buf_w) (local.get $len)) (i32.const 0))
  )

  ;; Insert $n bytes from guest-ptr $src at cursor (delete selection first).
  ;; Used by WM_PASTE / Ctrl+V to bulk-insert clipboard text in one pass
  ;; (avoids per-char memmove storms on large pastes).
  (func $edit_insert_bytes (param $state_w ptr<EditState>) (param $src_g i32) (param $n i32)
    (local $lo i32) (local $hi i32) (local $cur i32) (local $len i32) (local $buf_w i32) (local $tail i32) (local $maxlen i32) (local $src_w i32) (local $room i32)
    (if (i32.eqz (local.get $n)) (then (return)))
    (local.set $lo (call $edit_sel_lo (local.get $state_w)))
    (local.set $hi (call $edit_sel_hi (local.get $state_w)))
    (if (i32.ne (local.get $lo) (local.get $hi))
      (then (call $edit_delete_range (local.get $state_w) (local.get $lo) (local.get $hi))))
    (local.set $len (load.field.memarg EditState text_len (local.get $state_w)))
    (local.set $maxlen (load.field.memarg EditState max_length (local.get $state_w)))
    (if (local.get $maxlen)
      (then
        (local.set $room (i32.sub (local.get $maxlen) (local.get $len)))
        (if (i32.lt_s (local.get $room) (i32.const 0)) (then (local.set $room (i32.const 0))))
        (if (i32.gt_u (local.get $n) (local.get $room))
          (then (local.set $n (local.get $room))))))
    (if (i32.eqz (local.get $n)) (then (return)))
    (call $edit_ensure_cap (local.get $state_w) (i32.add (local.get $len) (local.get $n)))
    (local.set $cur (load.field.memarg EditState cursor (local.get $state_w)))
    (local.set $buf_w (call $g2w (load.field EditState text_buf_ptr (local.get $state_w))))
    ;; Shift tail right by $n bytes. The old reverse byte loop is memmove for a
    ;; destination above the source, so memory.copy does it in one op.
    (local.set $tail (i32.sub (local.get $len) (local.get $cur)))
    (if (local.get $tail)
      (then
        (memory.copy
          (i32.add (local.get $buf_w) (i32.add (local.get $cur) (local.get $n)))
          (i32.add (local.get $buf_w) (local.get $cur))
          (local.get $tail))))
    (local.set $src_w (call $g2w (local.get $src_g)))
    (call $memcpy
      (i32.add (local.get $buf_w) (local.get $cur))
      (local.get $src_w)
      (local.get $n))
    (local.set $cur (i32.add (local.get $cur) (local.get $n)))
    (local.set $len (i32.add (local.get $len) (local.get $n)))
    (store.field.memarg EditState text_len (local.get $state_w) (local.get $len))
    (store.field.memarg EditState cursor (local.get $state_w) (local.get $cur))
    (store.field.memarg EditState sel_anchor (local.get $state_w) (local.get $cur))
    (i32.store8 (i32.add (local.get $buf_w) (local.get $len)) (i32.const 0))
  )

  ;; Copy [lo..hi) from edit to the global clipboard, reallocating to fit.
  ;; No-op when lo >= hi (empty selection — leaves clipboard untouched so
  ;; Ctrl+C on nothing doesn't wipe a prior copy).
  (func $edit_copy_range (param $state_w ptr<EditState>) (param $lo i32) (param $hi i32)
    (local $len i32) (local $src_g i32) (local $dst_g i32) (local $cap i32) (local $need i32)
    (if (i32.ge_u (local.get $lo) (local.get $hi)) (then (return)))
    (local.set $len (i32.sub (local.get $hi) (local.get $lo)))
    (local.set $need (i32.add (local.get $len) (i32.const 1)))
    (local.set $src_g (load.field EditState text_buf_ptr (local.get $state_w)))
    (if (i32.eqz (local.get $src_g)) (then (return)))
    ;; Grow capacity if needed (round up to multiple of 64).
    (if (i32.gt_u (local.get $need) (global.get $clipboard_cap))
      (then
        (if (global.get $clipboard_ptr)
          (then (call $heap_free (global.get $clipboard_ptr))
                (global.set $clipboard_text_present (i32.const 0))
                (global.set $clipboard_len (i32.const 0))
                (global.set $clipboard_ptr (i32.const 0))))
        (local.set $cap (i32.and (i32.add (local.get $need) (i32.const 63)) (i32.const -64)))
        (global.set $clipboard_ptr (call $heap_alloc (local.get $cap)))
        (global.set $clipboard_cap (local.get $cap))))
    (local.set $dst_g (global.get $clipboard_ptr))
    (if (i32.eqz (local.get $dst_g)) (then (return)))
    (call $memcpy
      (call $g2w (local.get $dst_g))
      (i32.add (call $g2w (local.get $src_g)) (local.get $lo))
      (local.get $len))
    (i32.store8 (i32.add (call $g2w (local.get $dst_g)) (local.get $len)) (i32.const 0))
    (global.set $clipboard_text_present (i32.const 1)) (global.set $clipboard_len (local.get $len))
    (call $richedit_clipboard_clear_format)
    (call $clipboard_clear_rtf_data)
  )

  ;; Convert click (x,y) in edit client coords to a char offset.
  ;; Uses $host_measure_text to binary-ish-search the column within a line.
  ;; y-based line pick clamps to last line; x-based col picks the half-char
  ;; the click falls into (standard Win32 caret behavior).
  ;; Width in pixels of the widest line, which is what an unwrapped EDIT
  ;; scrolls horizontally over. Measuring every line with $host_measure_text
  ;; would mean one GDI text measurement per line on every paint, so the
  ;; longest line is picked by character count first and only that one is
  ;; measured. Notepad's default Fixedsys is fixed-pitch, where that is exact;
  ;; with a proportional font it is an approximation of which line is widest.
  (func $edit_doc_width (param $state_w ptr<EditState>) (param $hdc i32) (result i32)
    (local $buf_g i32) (local $text_len i32) (local $pos i32) (local $len i32)
    (local $best_start i32) (local $best_len i32) (local $w i32)
    (local.set $buf_g (load.field EditState text_buf_ptr (local.get $state_w)))
    (if (i32.eqz (local.get $buf_g)) (then (return (i32.const 0))))
    (local.set $text_len (load.field.memarg EditState text_len (local.get $state_w)))
    (local.set $pos (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.gt_u (local.get $pos) (local.get $text_len)))
      (local.set $len (call $edit_line_text_len (local.get $state_w) (local.get $pos)))
      (if (i32.gt_u (local.get $len) (local.get $best_len))
        (then
          (local.set $best_len (local.get $len))
          (local.set $best_start (local.get $pos))))
      (local.set $pos (i32.add (i32.add (local.get $pos)
        (call $edit_line_len (local.get $state_w) (local.get $pos))) (i32.const 1)))
      (br $scan)))
    (if (i32.eqz (local.get $best_len)) (then (return (i32.const 0))))
    (local.set $w (call $host_measure_text (local.get $hdc)
      (i32.add (call $g2w (local.get $buf_g)) (local.get $best_start))
      (local.get $best_len) (i32.const 0)))
    (if (i32.eqz (local.get $w))
      (then (local.set $w (i32.mul (local.get $best_len) (i32.const 8)))))
    (local.get $w))

  ;; Largest horizontal scroll offset for an unwrapped edit whose content area
  ;; is $view_w wide. The 8 covers the 4px text margin on each side.
  (func $edit_max_hscroll (param $state_w i32) (param $hdc i32) (param $view_w i32) (result i32)
    (local $max i32)
    (local.set $max (i32.sub
      (i32.add (call $edit_doc_width (local.get $state_w) (local.get $hdc)) (i32.const 8))
      (local.get $view_w)))
    (if (i32.lt_s (local.get $max) (i32.const 0)) (then (local.set $max (i32.const 0))))
    (local.get $max))

  ;; Clamp and store scroll_x. Returns 1 when the viewport actually moved.
  (func $edit_hscroll_to (param $state_w ptr<EditState>) (param $x i32) (param $max i32) (result i32)
    (if (i32.gt_s (local.get $x) (local.get $max)) (then (local.set $x (local.get $max))))
    (if (i32.lt_s (local.get $x) (i32.const 0)) (then (local.set $x (i32.const 0))))
    (if (i32.eq (local.get $x) (load.field.memarg EditState scroll_x (local.get $state_w)))
      (then (return (i32.const 0))))
    (store.field.memarg EditState scroll_x (local.get $state_w) (local.get $x))
    (i32.const 1))

  (func $edit_xy_to_offset (param $state_w ptr<EditState>) (param $hdc i32) (param $x i32) (param $y i32) (result i32)
    (local $line_num i32) (local $line_start i32) (local $line_len i32)
    (local $text_len i32) (local $buf_g i32) (local $line_w i32)
    (local $i i32) (local $w i32) (local $prev_w i32) (local $mid i32)
    (local $total_lines i32)
    (local.set $text_len (load.field.memarg EditState text_len (local.get $state_w)))
    (local.set $buf_g (load.field EditState text_buf_ptr (local.get $state_w)))
    (if (i32.eqz (local.get $buf_g)) (then (return (i32.const 0))))
    ;; Subtract 4px text margin, add the horizontal scroll offset so a click
    ;; lands on the character under the cursor rather than the one that would
    ;; be there if the view were scrolled home, clamp x>=0, y>=0.
    (local.set $x (i32.sub (local.get $x) (i32.const 4)))
    (local.set $x (i32.add (local.get $x) (load.field.memarg EditState scroll_x (local.get $state_w))))
    (if (i32.lt_s (local.get $x) (i32.const 0)) (then (local.set $x (i32.const 0))))
    (local.set $y (i32.sub (local.get $y) (i32.const 4)))
    (if (i32.lt_s (local.get $y) (i32.const 0)) (then (local.set $y (i32.const 0))))
    (local.set $line_num (i32.div_s (local.get $y) (i32.const 16)))
    (local.set $line_num (i32.add (local.get $line_num) (load.field.memarg EditState scroll_top (local.get $state_w))))
    ;; Clamp to last line: total_lines = edit_line_from_char(text_len) + 1
    (local.set $total_lines (i32.add
      (call $edit_line_from_char (local.get $state_w) (local.get $text_len))
      (i32.const 1)))
    (if (i32.ge_u (local.get $line_num) (local.get $total_lines))
      (then (local.set $line_num (i32.sub (local.get $total_lines) (i32.const 1)))))
    (local.set $line_start (call $edit_line_index (local.get $state_w) (local.get $line_num)))
    (local.set $line_len (call $edit_line_text_len (local.get $state_w) (local.get $line_start)))
    (local.set $line_w (i32.add (call $g2w (local.get $buf_g)) (local.get $line_start)))
    (local.set $prev_w (i32.const 0))
    (local.set $i (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $line_len)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (local.set $w (call $host_measure_text
        (local.get $hdc) (local.get $line_w) (local.get $i) (i32.const 0)))
      (local.set $mid (i32.shr_s (i32.add (local.get $prev_w) (local.get $w)) (i32.const 1)))
      (if (i32.gt_s (local.get $mid) (local.get $x))
        (then (return (i32.add (local.get $line_start) (i32.sub (local.get $i) (i32.const 1))))))
      (local.set $prev_w (local.get $w))
      (br $scan)))
    (i32.add (local.get $line_start) (local.get $line_len)))

  (func $edit_layout_store (param $idx i32) (param $start i32) (param $len i32)
    (local $p i32)
    (if (i32.ge_u (local.get $idx) (global.get $EDIT_LAYOUT_MAX)) (then (return)))
    (local.set $p (i32.add (global.get $EDIT_LAYOUT_SCRATCH)
                    (i32.mul (local.get $idx) (i32.const 8))))
    (i32.store (local.get $p) (local.get $start))
    (i32.store offset=4 (local.get $p) (local.get $len)))

  (func $edit_layout_start (param $idx i32) (result i32)
    (i32.load (i32.add (global.get $EDIT_LAYOUT_SCRATCH)
              (i32.mul (local.get $idx) (i32.const 8)))))

  (func $edit_layout_len (param $idx i32) (result i32)
    (i32.load offset=4 (i32.add (global.get $EDIT_LAYOUT_SCRATCH)
                       (i32.mul (local.get $idx) (i32.const 8)))))

  ;; Build the visual-line table used by wrapped multiline edits. This is the
  ;; WAT-side equivalent of USER32 EDIT's internal line layout: explicit CR/LF
  ;; breaks plus simple word wrapping against the edit client width.
  (func $edit_layout_build (param $state_w ptr<EditState>) (param $hdc i32) (param $text_w i32) (result i32)
    (local $buf_g i32) (local $buf_w i32) (local $text_len i32)
    (local $count i32) (local $line_start i32) (local $pos i32)
    (local $ch i32) (local $next_ch i32) (local $max_w i32)
    (local $candidate_len i32) (local $width i32)
    (local $last_space i32) (local $break_len i32) (local $next_start i32)

    (local.set $buf_g (load.field EditState text_buf_ptr (local.get $state_w)))
    (local.set $text_len (load.field.memarg EditState text_len (local.get $state_w)))
    (if (i32.eqz (local.get $buf_g))
      (then
        (call $edit_layout_store (i32.const 0) (i32.const 0) (i32.const 0))
        (return (i32.const 1))))
    (local.set $buf_w (call $g2w (local.get $buf_g)))
    (local.set $max_w (i32.sub (local.get $text_w) (i32.const 8)))
    (if (i32.lt_s (local.get $max_w) (i32.const 8))
      (then (local.set $max_w (i32.const 8))))
    (local.set $line_start (i32.const 0))
    (local.set $count (i32.const 0))

    (block $done (loop $outer
      (br_if $done (i32.ge_u (local.get $count) (global.get $EDIT_LAYOUT_MAX)))
      (if (i32.gt_u (local.get $line_start) (local.get $text_len))
        (then (br $done)))

      (local.set $pos (local.get $line_start))
      (local.set $last_space (i32.const -1))
      (block $line_done (loop $scan
        (br_if $line_done (i32.ge_u (local.get $pos) (local.get $text_len)))
        (local.set $ch (i32.load8_u (i32.add (local.get $buf_w) (local.get $pos))))
        (if (i32.or (i32.eq (local.get $ch) (i32.const 10))
                    (i32.eq (local.get $ch) (i32.const 13)))
          (then
            (local.set $break_len (i32.sub (local.get $pos) (local.get $line_start)))
            (call $edit_layout_store (local.get $count) (local.get $line_start) (local.get $break_len))
            (local.set $count (i32.add (local.get $count) (i32.const 1)))
            (local.set $next_start (i32.add (local.get $pos) (i32.const 1)))
            (if (i32.and
                  (i32.eq (local.get $ch) (i32.const 13))
                  (i32.lt_u (local.get $next_start) (local.get $text_len)))
              (then
                (local.set $next_ch (i32.load8_u (i32.add (local.get $buf_w) (local.get $next_start))))
                (if (i32.eq (local.get $next_ch) (i32.const 10))
                  (then (local.set $next_start (i32.add (local.get $next_start) (i32.const 1)))))))
            (local.set $line_start (local.get $next_start))
            (br $line_done)))
        (if (i32.eq (local.get $ch) (i32.const 32))
          (then (local.set $last_space (local.get $pos))))
        (local.set $candidate_len (i32.add (i32.sub (local.get $pos) (local.get $line_start)) (i32.const 1)))
        (local.set $width (call $host_measure_text
          (local.get $hdc)
          (i32.add (local.get $buf_w) (local.get $line_start))
          (local.get $candidate_len) (i32.const 0)))
        (if (i32.and (i32.gt_s (local.get $width) (local.get $max_w))
                     (i32.gt_u (local.get $candidate_len) (i32.const 1)))
          (then
            (if (i32.and (i32.ge_s (local.get $last_space) (local.get $line_start))
                         (i32.gt_u (local.get $last_space) (local.get $line_start)))
              (then
                (local.set $break_len (i32.sub (local.get $last_space) (local.get $line_start)))
                (local.set $next_start (i32.add (local.get $last_space) (i32.const 1))))
              (else
                (local.set $break_len (i32.sub (local.get $pos) (local.get $line_start)))
                (local.set $next_start (local.get $pos))))
            (call $edit_layout_store (local.get $count) (local.get $line_start) (local.get $break_len))
            (local.set $count (i32.add (local.get $count) (i32.const 1)))
            (local.set $line_start (local.get $next_start))
            (br $line_done)))
        (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
        (br $scan)))

      (if (i32.ge_u (local.get $pos) (local.get $text_len))
        (then
          (call $edit_layout_store
            (local.get $count)
            (local.get $line_start)
            (i32.sub (local.get $text_len) (local.get $line_start)))
          (local.set $count (i32.add (local.get $count) (i32.const 1)))
          (br $done)))
      (br $outer)))
    (if (i32.eqz (local.get $count))
      (then
        (call $edit_layout_store (i32.const 0) (i32.const 0) (i32.const 0))
        (return (i32.const 1))))
    (local.get $count))

  (func $edit_layout_line_for_char (param $line_count i32) (param $cur i32) (result i32)
    (local $i i32) (local $s i32) (local $e i32)
    (local.set $i (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $line_count)))
      (local.set $s (call $edit_layout_start (local.get $i)))
      (local.set $e (i32.add (local.get $s) (call $edit_layout_len (local.get $i))))
      (if (i32.and (i32.ge_u (local.get $cur) (local.get $s))
                   (i32.le_u (local.get $cur) (local.get $e)))
        (then (return (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (select (i32.sub (local.get $line_count) (i32.const 1)) (i32.const 0)
            (i32.gt_u (local.get $line_count) (i32.const 0))))

  (func $edit_layout_xy_to_offset
        (param $state_w ptr<EditState>) (param $hdc i32) (param $text_w i32) (param $x i32) (param $y i32) (result i32)
    (local $line_count i32) (local $line_num i32) (local $line_start i32) (local $line_len i32)
    (local $buf_w i32) (local $i i32) (local $w i32) (local $prev_w i32) (local $mid i32)
    (local.set $line_count (call $edit_layout_build (local.get $state_w) (local.get $hdc) (local.get $text_w)))
    (local.set $x (i32.sub (local.get $x) (i32.const 4)))
    (if (i32.lt_s (local.get $x) (i32.const 0)) (then (local.set $x (i32.const 0))))
    (local.set $y (i32.sub (local.get $y) (i32.const 4)))
    (if (i32.lt_s (local.get $y) (i32.const 0)) (then (local.set $y (i32.const 0))))
    (local.set $line_num (i32.add
      (i32.div_s (local.get $y) (i32.const 16))
      (load.field.memarg EditState scroll_top (local.get $state_w))))
    (if (i32.ge_u (local.get $line_num) (local.get $line_count))
      (then (local.set $line_num (i32.sub (local.get $line_count) (i32.const 1)))))
    (local.set $line_start (call $edit_layout_start (local.get $line_num)))
    (local.set $line_len (call $edit_layout_len (local.get $line_num)))
    (local.set $buf_w (call $g2w (load.field EditState text_buf_ptr (local.get $state_w))))
    (local.set $prev_w (i32.const 0))
    (local.set $i (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $line_len)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (local.set $w (call $host_measure_text
        (local.get $hdc) (i32.add (local.get $buf_w) (local.get $line_start))
        (local.get $i) (i32.const 0)))
      (if (i32.eqz (local.get $w))
        (then (local.set $w (i32.mul (local.get $i) (i32.const 8)))))
      (local.set $mid (i32.shr_s (i32.add (local.get $prev_w) (local.get $w)) (i32.const 1)))
      (if (i32.gt_s (local.get $mid) (local.get $x))
        (then (return (i32.add (local.get $line_start) (i32.sub (local.get $i) (i32.const 1))))))
      (local.set $prev_w (local.get $w))
      (br $scan)))
    (i32.add (local.get $line_start) (local.get $line_len)))

  ;; Word-boundary classification: 1 if $ch is part of a word (alnum/underscore),
  ;; else 0. Matches Win32 default word break for ASCII.
  (func $edit_is_word_char (param $ch i32) (result i32)
    (if (i32.eq (local.get $ch) (i32.const 0x5F)) (then (return (i32.const 1))))  ;; _
    (if (i32.and (i32.ge_u (local.get $ch) (i32.const 0x30))
                 (i32.le_u (local.get $ch) (i32.const 0x39)))
      (then (return (i32.const 1))))  ;; 0-9
    (if (i32.and (i32.ge_u (local.get $ch) (i32.const 0x41))
                 (i32.le_u (local.get $ch) (i32.const 0x5A)))
      (then (return (i32.const 1))))  ;; A-Z
    (if (i32.and (i32.ge_u (local.get $ch) (i32.const 0x61))
                 (i32.le_u (local.get $ch) (i32.const 0x7A)))
      (then (return (i32.const 1))))  ;; a-z
    (i32.const 0))

  (func $edit_word_start (param $state_w ptr<EditState>) (param $pos i32) (result i32)
    (local $buf_w i32) (local $ch i32)
    (local.set $buf_w (load.field EditState text_buf_ptr (local.get $state_w)))
    (if (i32.eqz (local.get $buf_w)) (then (return (local.get $pos))))
    (local.set $buf_w (call $g2w (local.get $buf_w)))
    (block $done (loop $scan
      (br_if $done (i32.le_s (local.get $pos) (i32.const 0)))
      (local.set $ch (i32.load8_u (i32.add (local.get $buf_w) (i32.sub (local.get $pos) (i32.const 1)))))
      (br_if $done (i32.eqz (call $edit_is_word_char (local.get $ch))))
      (local.set $pos (i32.sub (local.get $pos) (i32.const 1)))
      (br $scan)))
    (local.get $pos))

  (func $edit_word_end (param $state_w ptr<EditState>) (param $pos i32) (result i32)
    (local $buf_w i32) (local $text_len i32) (local $ch i32)
    (local.set $buf_w (load.field EditState text_buf_ptr (local.get $state_w)))
    (if (i32.eqz (local.get $buf_w)) (then (return (local.get $pos))))
    (local.set $buf_w (call $g2w (local.get $buf_w)))
    (local.set $text_len (load.field.memarg EditState text_len (local.get $state_w)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $pos) (local.get $text_len)))
      (local.set $ch (i32.load8_u (i32.add (local.get $buf_w) (local.get $pos))))
      (br_if $done (i32.eqz (call $edit_is_word_char (local.get $ch))))
      (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
      (br $scan)))
    (local.get $pos))

  ;; True if VK_SHIFT/VK_CONTROL are physically down (uses host async state).
  (func $edit_shift_down (result i32)
    (i32.and (call $host_get_async_key_state (i32.const 0x10)) (i32.const 0x8000)))
  (func $edit_ctrl_down (result i32)
    (i32.and (call $host_get_async_key_state (i32.const 0x11)) (i32.const 0x8000)))

  (func $edit_notify (param $hwnd i32) (param $code i32)
    (local $parent i32) (local $id i32)
    (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
    (if (local.get $parent)
      (then
        (local.set $id (call $ctrl_table_get_id (local.get $hwnd)))
        (drop (call $wnd_send_message
          (local.get $parent)
          (i32.const 0x0111)  ;; WM_COMMAND
          (i32.or (i32.and (local.get $id) (i32.const 0xFFFF))
                  (i32.shl (local.get $code) (i32.const 16)))
          (local.get $hwnd))))))

  (func $edit_notify_change (param $hwnd i32)
    ;; A standard multiline EDIT sends EN_UPDATE immediately before repaint,
    ;; followed by EN_CHANGE once its text has changed. Paint consumes the
    ;; update notification to refresh the text object that is later committed.
    (call $edit_notify (local.get $hwnd) (i32.const 0x0400)) ;; EN_UPDATE
    (call $edit_notify (local.get $hwnd) (i32.const 0x0300))) ;; EN_CHANGE

  ;; Invoke an EDITSTREAM callback synchronously.  The callback is the Win32
  ;; `DWORD CALLBACK(cookie, buffer, capacity, bytes_read)` shape and therefore
  ;; pops its four arguments.  EM_STREAMIN is itself reached from inside a
  ;; guest SendMessage call, so preserve the interrupted x86 context around the
  ;; bounded nested interpreter run just as $wnd_send_message_inner does.
  (func $edit_stream_call
    (param $callback i32) (param $cookie i32) (param $buffer i32)
    (param $capacity i32) (param $bytes_read i32) (result i32)
    (local $old_eip i32) (local $old_esp i32) (local $old_eax i32)
    (local $old_ecx i32) (local $old_edx i32) (local $old_ebx i32)
    (local $old_esi i32) (local $old_edi i32) (local $old_ebp i32)
    (local $old_handler_set_eip i32) (local $old_steps i32)
    (local $old_yield_reason i32) (local $old_yield_flag i32)
    (local $result i32) (local $rounds i32)
    (if (i32.eqz (local.get $callback)) (then (return (i32.const 1))))
    (local.set $old_eip (global.get $eip))
    (local.set $old_esp (i32.load offset=16 (global.get $reg_base)))
    (local.set $old_eax (i32.load offset=0 (global.get $reg_base)))
    (local.set $old_ecx (i32.load offset=4 (global.get $reg_base)))
    (local.set $old_edx (i32.load offset=8 (global.get $reg_base)))
    (local.set $old_ebx (i32.load offset=12 (global.get $reg_base)))
    (local.set $old_esi (i32.load offset=24 (global.get $reg_base)))
    (local.set $old_edi (i32.load offset=28 (global.get $reg_base)))
    (local.set $old_ebp (i32.load offset=20 (global.get $reg_base)))
    (local.set $old_handler_set_eip (global.get $handler_set_eip))
    (local.set $old_steps (global.get $steps))
    (local.set $old_yield_reason (global.get $yield_reason))
    (local.set $old_yield_flag (global.get $yield_flag))
    ;; Push right-to-left: pcb, cb, buffer, cookie, return thunk.
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $bytes_read))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $capacity))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $buffer))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $cookie))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $sync_msg_ret_thunk))
    (global.set $eip (local.get $callback))
    (global.set $steps (i32.const 0))
    (global.set $yield_reason (i32.const 0))
    (global.set $yield_flag (i32.const 0))
    (global.set $sync_msg_depth (i32.add (global.get $sync_msg_depth) (i32.const 1)))
    (block $done (loop $run_callback
      (call $run (i32.const 1000000))
      (br_if $done (i32.eqz (global.get $eip)))
      (local.set $rounds (i32.add (local.get $rounds) (i32.const 1)))
      (br_if $done (i32.ge_u (local.get $rounds) (i32.const 64)))
      (br $run_callback)))
    (global.set $sync_msg_depth (i32.sub (global.get $sync_msg_depth) (i32.const 1)))
    (local.set $result
      (select (i32.load offset=0 (global.get $reg_base)) (i32.const 1) (i32.eqz (global.get $eip))))
    (global.set $eip (local.get $old_eip))
    (i32.store offset=16 (global.get $reg_base) (local.get $old_esp))
    (i32.store offset=0 (global.get $reg_base) (local.get $old_eax))
    (i32.store offset=4 (global.get $reg_base) (local.get $old_ecx))
    (i32.store offset=8 (global.get $reg_base) (local.get $old_edx))
    (i32.store offset=12 (global.get $reg_base) (local.get $old_ebx))
    (i32.store offset=24 (global.get $reg_base) (local.get $old_esi))
    (i32.store offset=28 (global.get $reg_base) (local.get $old_edi))
    (i32.store offset=20 (global.get $reg_base) (local.get $old_ebp))
    (global.set $handler_set_eip (local.get $old_handler_set_eip))
    (global.set $steps (local.get $old_steps))
    (global.set $yield_reason (local.get $old_yield_reason))
    (global.set $yield_flag (local.get $old_yield_flag))
    (local.get $result))

  (func $edit_hex_nibble (param $ch i32) (result i32)
    (if (i32.and (i32.ge_u (local.get $ch) (i32.const 0x30))
                 (i32.le_u (local.get $ch) (i32.const 0x39)))
      (then (return (i32.sub (local.get $ch) (i32.const 0x30)))))
    (local.set $ch (call $tolower (local.get $ch)))
    (if (i32.and (i32.ge_u (local.get $ch) (i32.const 0x61))
                 (i32.le_u (local.get $ch) (i32.const 0x66)))
      (then (return (i32.add (i32.sub (local.get $ch) (i32.const 0x61)) (i32.const 10)))))
    (i32.const 0))

  ;; Project the streamed bytes into the plain-text EditState used by the WAT
  ;; control.  RichEdit normally owns the RTF parser; this bounded projection
  ;; keeps visible text, paragraph/tab breaks and ANSI hex escapes while
  ;; discarding formatting and destination groups (font/color tables, pictures,
  ;; metadata).  The output cannot be larger than the input.
  (func $edit_stream_project
    (param $state_w ptr<EditState>) (param $raw_g i32) (param $raw_len i32)
    (param $is_rtf i32) (result i32)
    (local $src i32) (local $dst i32) (local $i i32) (local $out i32)
    (local $ch i32) (local $depth i32) (local $skip_depth i32)
    (local $group_start i32) (local $hash i32) (local $word_start i32)
    (local $hi i32) (local $lo i32)
    (call $edit_ensure_cap (local.get $state_w) (local.get $raw_len))
    (local.set $src (call $g2w (local.get $raw_g)))
    (local.set $dst (call $g2w (load.field EditState text_buf_ptr (local.get $state_w))))
    (if (i32.eqz (local.get $is_rtf))
      (then
        (if (local.get $raw_len)
          (then (call $memcpy (local.get $dst) (local.get $src) (local.get $raw_len))))
        (local.set $out (local.get $raw_len)))
      (else
        (local.set $i (i32.const 0))
        (local.set $out (i32.const 0))
        (block $done (loop $scan
          (br_if $done (i32.ge_u (local.get $i) (local.get $raw_len)))
          (local.set $ch (i32.load8_u (i32.add (local.get $src) (local.get $i))))
          (if (i32.eq (local.get $ch) (i32.const 0x7B)) ;; {
            (then
              (local.set $depth (i32.add (local.get $depth) (i32.const 1)))
              (local.set $group_start (i32.const 1))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $scan)))
          (if (i32.eq (local.get $ch) (i32.const 0x7D)) ;; }
            (then
              (if (i32.eq (local.get $skip_depth) (local.get $depth))
                (then (local.set $skip_depth (i32.const 0))))
              (if (local.get $depth)
                (then (local.set $depth (i32.sub (local.get $depth) (i32.const 1)))))
              (local.set $group_start (i32.const 0))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $scan)))
          (if (i32.eq (local.get $ch) (i32.const 0x5C)) ;; backslash
            (then
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br_if $done (i32.ge_u (local.get $i) (local.get $raw_len)))
              (local.set $ch (i32.load8_u (i32.add (local.get $src) (local.get $i))))
              ;; ANSI hex escape: \'hh.
              (if (i32.eq (local.get $ch) (i32.const 0x27))
                (then
                  (if (i32.lt_u (i32.add (local.get $i) (i32.const 2)) (local.get $raw_len))
                    (then
                      (local.set $hi (call $edit_hex_nibble
                        (i32.load8_u (i32.add (local.get $src) (i32.add (local.get $i) (i32.const 1))))))
                      (local.set $lo (call $edit_hex_nibble
                        (i32.load8_u (i32.add (local.get $src) (i32.add (local.get $i) (i32.const 2))))))
                      (if (i32.eqz (local.get $skip_depth))
                        (then
                          (i32.store8 (i32.add (local.get $dst) (local.get $out))
                            (i32.or (i32.shl (local.get $hi) (i32.const 4)) (local.get $lo)))
                          (local.set $out (i32.add (local.get $out) (i32.const 1)))))
                      (local.set $i (i32.add (local.get $i) (i32.const 3)))
                      (local.set $group_start (i32.const 0))
                      (br $scan)))))
              ;; Escaped literal or control symbol.
              (if (i32.or
                    (i32.or (i32.eq (local.get $ch) (i32.const 0x5C))
                            (i32.eq (local.get $ch) (i32.const 0x7B)))
                    (i32.eq (local.get $ch) (i32.const 0x7D)))
                (then
                  (if (i32.eqz (local.get $skip_depth))
                    (then
                      (i32.store8 (i32.add (local.get $dst) (local.get $out)) (local.get $ch))
                      (local.set $out (i32.add (local.get $out) (i32.const 1)))))
                  (local.set $i (i32.add (local.get $i) (i32.const 1)))
                  (local.set $group_start (i32.const 0))
                  (br $scan)))
              (if (i32.eq (local.get $ch) (i32.const 0x2A)) ;; \* destination marker
                (then
                  ;; Keep the outermost ignored destination until its closing
                  ;; brace. Nested panose/falt groups must not end fonttbl.
                  (if (i32.and (local.get $group_start) (i32.eqz (local.get $skip_depth)))
                    (then (local.set $skip_depth (local.get $depth))))
                  (local.set $i (i32.add (local.get $i) (i32.const 1)))
                  (br $scan)))
              (if (i32.or (i32.eq (local.get $ch) (i32.const 0x7E))
                          (i32.eq (local.get $ch) (i32.const 0x5F)))
                (then
                  (if (i32.eqz (local.get $skip_depth))
                    (then
                      (i32.store8 (i32.add (local.get $dst) (local.get $out))
                        (select (i32.const 0x2D) (i32.const 0x20)
                          (i32.eq (local.get $ch) (i32.const 0x5F))))
                      (local.set $out (i32.add (local.get $out) (i32.const 1)))))
                  (local.set $i (i32.add (local.get $i) (i32.const 1)))
                  (local.set $group_start (i32.const 0))
                  (br $scan)))
              ;; Control word hash (lowercase FNV-1a), then discard its
              ;; optional signed numeric parameter and one delimiter space.
              (local.set $hash (i32.const 0x811C9DC5))
              (local.set $word_start (local.get $i))
              (block $word_done (loop $word
                (br_if $word_done (i32.ge_u (local.get $i) (local.get $raw_len)))
                (local.set $ch (call $tolower
                  (i32.load8_u (i32.add (local.get $src) (local.get $i)))))
                (br_if $word_done
                  (i32.or (i32.lt_u (local.get $ch) (i32.const 0x61))
                          (i32.gt_u (local.get $ch) (i32.const 0x7A))))
                (local.set $hash
                  (i32.mul (i32.xor (local.get $hash) (local.get $ch)) (i32.const 0x01000193)))
                (local.set $i (i32.add (local.get $i) (i32.const 1)))
                (br $word)))
              (if (i32.lt_u (local.get $word_start) (local.get $i))
                (then
                  (if (i32.and (i32.lt_u (local.get $i) (local.get $raw_len))
                               (i32.eq (i32.load8_u (i32.add (local.get $src) (local.get $i))) (i32.const 0x2D)))
                    (then (local.set $i (i32.add (local.get $i) (i32.const 1)))))
                  (block $number_done (loop $number
                    (br_if $number_done (i32.ge_u (local.get $i) (local.get $raw_len)))
                    (local.set $ch (i32.load8_u (i32.add (local.get $src) (local.get $i))))
                    (br_if $number_done
                      (i32.or (i32.lt_u (local.get $ch) (i32.const 0x30))
                              (i32.gt_u (local.get $ch) (i32.const 0x39))))
                    (local.set $i (i32.add (local.get $i) (i32.const 1)))
                    (br $number)))
                  (if (i32.and (i32.lt_u (local.get $i) (local.get $raw_len))
                               (i32.eq (i32.load8_u (i32.add (local.get $src) (local.get $i))) (i32.const 0x20)))
                    (then (local.set $i (i32.add (local.get $i) (i32.const 1)))))))
              ;; Destination groups whose payload is not document text.
              (if (i32.and
                    (i32.and (local.get $group_start) (i32.eqz (local.get $skip_depth)))
                    (i32.or
                      (i32.or (i32.eq (local.get $hash) (i32.const 0xB3049312)) ;; fonttbl
                              (i32.eq (local.get $hash) (i32.const 0xB5E90F1A))) ;; colortbl
                      (i32.or
                        (i32.or (i32.eq (local.get $hash) (i32.const 0x752FF961)) ;; stylesheet
                                (i32.eq (local.get $hash) (i32.const 0x0FB40705))) ;; info
                        (i32.or
                          (i32.or (i32.eq (local.get $hash) (i32.const 0x09420595)) ;; pict
                                  (i32.eq (local.get $hash) (i32.const 0xB8C60CBA))) ;; object
                          (i32.eq (local.get $hash) (i32.const 0x6EEC35C2)))))) ;; generator
                (then (local.set $skip_depth (local.get $depth))))
              (if (i32.eqz (local.get $skip_depth))
                (then
                  (if (i32.or (i32.eq (local.get $hash) (i32.const 0x63560E68)) ;; par
                              (i32.eq (local.get $hash) (i32.const 0x17DB1627))) ;; line
                    (then
                      (i32.store8 (i32.add (local.get $dst) (local.get $out)) (i32.const 0x0A))
                      (local.set $out (i32.add (local.get $out) (i32.const 1)))))
                  (if (i32.eq (local.get $hash) (i32.const 0x98F72E4C)) ;; tab
                    (then
                      (i32.store8 (i32.add (local.get $dst) (local.get $out)) (i32.const 0x09))
                      (local.set $out (i32.add (local.get $out) (i32.const 1)))))
                  (if (i32.or (i32.eq (local.get $hash) (i32.const 0xCCB67FB5)) ;; ldblquote
                              (i32.eq (local.get $hash) (i32.const 0xB352B75F))) ;; rdblquote
                    (then
                      (i32.store8 (i32.add (local.get $dst) (local.get $out)) (i32.const 0x22))
                      (local.set $out (i32.add (local.get $out) (i32.const 1)))))))
              (local.set $group_start (i32.const 0))
              (br $scan)))
          ;; Source newlines merely format the RTF itself.
          (if (i32.or (i32.eq (local.get $ch) (i32.const 0x0D))
                      (i32.eq (local.get $ch) (i32.const 0x0A)))
            (then
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $scan)))
          (if (i32.eqz (local.get $skip_depth))
            (then
              (i32.store8 (i32.add (local.get $dst) (local.get $out)) (local.get $ch))
              (local.set $out (i32.add (local.get $out) (i32.const 1)))))
          (local.set $group_start (i32.const 0))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $scan)))))
    (i32.store8 (i32.add (local.get $dst) (local.get $out)) (i32.const 0))
    (store.field.memarg EditState text_len (local.get $state_w) (local.get $out))
    (store.field.memarg EditState cursor (local.get $state_w) (local.get $out))
    (store.field.memarg EditState sel_anchor (local.get $state_w) (local.get $out))
    (local.get $out))

  ;; Read EDITSTREAM until callback EOF/error. RTF metadata can exceed 64K
  ;; before any visible text, independently of the control's text limit.
  ;; Grow the raw buffer geometrically; allocation failure is dwError=8,
  ;; never a silently successful truncated document.
  (func $edit_stream_read
    (param $state_w i32) (param $stream_g i32) (param $flags i32) (result i32)
    (local $stream_w i32) (local $cookie i32) (local $callback i32)
    (local $raw i32) (local $pcb i32) (local $len i32) (local $capacity i32)
    (local $got i32) (local $error i32) (local $allocated i32)
    (local $new_size i32) (local $new_raw i32)
    (local.set $stream_w (call $g2w (local.get $stream_g)))
    (local.set $cookie (i32.load (local.get $stream_w)))
    (local.set $callback (i32.load offset=8 (local.get $stream_w)))
    ;; Compatibility with the older installer shim, whose cookie is directly
    ;; the source string and whose callback slot is zero.
    (if (i32.eqz (local.get $callback))
      (then
        (if (i32.eqz (local.get $cookie)) (then (return (i32.const 0))))
        (local.set $len (call $strlen (call $g2w (local.get $cookie))))
        (return (call $edit_stream_project
          (local.get $state_w) (local.get $cookie) (local.get $len)
          (i32.ne (i32.and (local.get $flags) (i32.const 2)) (i32.const 0))))))
    (local.set $allocated (i32.const 4096))
    (local.set $raw (call $heap_alloc (local.get $allocated)))
    (if (i32.eqz (local.get $raw))
      (then
        (i32.store offset=4 (local.get $stream_w) (i32.const 8))
        (return (i32.const 0))))
    (local.set $pcb (call $heap_alloc (i32.const 4)))
    (if (i32.eqz (local.get $pcb))
      (then
        (call $heap_free (local.get $raw))
        (i32.store offset=4 (local.get $stream_w) (i32.const 8))
        (return (i32.const 0))))
    (block $done (loop $read
      (if (i32.eq (local.get $len) (local.get $allocated))
        (then
          (local.set $error (i32.const 8))
          (br_if $done (i32.gt_u (local.get $allocated) (i32.const 0x3FFFFFFF)))
          (local.set $new_size (i32.shl (local.get $allocated) (i32.const 1)))
          (local.set $new_raw (call $heap_alloc (local.get $new_size)))
          (br_if $done (i32.eqz (local.get $new_raw)))
          (call $memcpy (call $g2w (local.get $new_raw))
            (call $g2w (local.get $raw)) (local.get $len))
          (call $heap_free (local.get $raw))
          (local.set $raw (local.get $new_raw))
          (local.set $allocated (local.get $new_size))))
      (local.set $capacity
        (select (i32.const 4096) (i32.sub (local.get $allocated) (local.get $len))
          (i32.gt_u (i32.sub (local.get $allocated) (local.get $len)) (i32.const 4096))))
      (call $gs32 (local.get $pcb) (i32.const 0))
      (local.set $error (call $edit_stream_call
        (local.get $callback) (local.get $cookie)
        (i32.add (local.get $raw) (local.get $len))
        (local.get $capacity) (local.get $pcb)))
      ;; A failing callback's buffer is not part of the document.
      (br_if $done (i32.ne (local.get $error) (i32.const 0)))
      (local.set $got (call $gl32 (local.get $pcb)))
      (if (i32.gt_u (local.get $got) (local.get $capacity))
        (then (local.set $got (local.get $capacity))))
      (local.set $len (i32.add (local.get $len) (local.get $got)))
      (br_if $done (i32.eqz (local.get $got)))
      (br $read)))
    (i32.store offset=4 (local.get $stream_w) (local.get $error))
    (local.set $len (call $edit_stream_project
      (local.get $state_w) (local.get $raw) (local.get $len)
      (i32.ne (i32.and (local.get $flags) (i32.const 2)) (i32.const 0))))
    (call $heap_free (local.get $raw))
    (call $heap_free (local.get $pcb))
    (local.get $len))

  (func $edit_wndproc (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $state i32) (local $state_w i32) (local $cs_w i32)
    (local $name_ptr i32) (local $text_len i32) (local $hdc i32)
    (local $sz i32) (local $w i32) (local $h i32) (local $buf i32)
    (local $cur i32) (local $px i32) (local $lo i32) (local $hi i32)
    (local $vk i32) (local $flags i32)
    (local $sel_lo i32) (local $sel_hi i32) (local $a i32) (local $b i32)
    (local $line_end i32) (local $pre_w i32) (local $sel_w i32)
    (local $line_y i32) (local $line_buf_w i32) (local $brush i32)
    (local $full_w i32) (local $total_lines i32) (local $visible_lines i32) (local $max_scroll i32)
    (local $full_h i32) (local $tx i32) (local $max_hscroll i32)
    (local $cx i32) (local $cy i32)

    (local.set $state (call $wnd_get_state_ptr (local.get $hwnd)))

    ;; ---------- WM_CREATE (0x0001) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0001))
      (then
        ;; EditState additionally keeps the font installed by WM_SETFONT at
        ;; +32.  Paint replaces this font whenever its floating Fonts palette
        ;; changes, and queries it back with WM_GETFONT for text metrics.
        ;; +36 is the horizontal scroll offset in pixels, used by unwrapped
        ;; WS_HSCROLL edits (Notepad with Word Wrap off).
        (local.set $state (call $heap_alloc (i32.const 40)))
        (local.set $state_w (call $g2w (local.get $state)))
        (store.field EditState text_buf_ptr (local.get $state_w) (i32.const 0))
        (store.field.memarg EditState text_len (local.get $state_w) (i32.const 0))
        (store.field.memarg EditState text_cap (local.get $state_w) (i32.const 0))
        (store.field.memarg EditState cursor (local.get $state_w) (i32.const 0))
        (store.field.memarg EditState sel_anchor (local.get $state_w) (i32.const 0))
        (store.field.memarg EditState scroll_top (local.get $state_w) (i32.const 0))
        (store.field.memarg EditState flags (local.get $state_w) (i32.const 0))
        ;; Plain EDIT keeps the existing unlimited internal default. Both
        ;; Win9x RichEdit generations start at the documented 32,767-character
        ;; input limit until the application explicitly changes it.
        (store.field.memarg EditState max_length (local.get $state_w)
          (select (i32.const 32767) (i32.const 0)
            (i32.or
              (i32.eq (call $ctrl_table_get_class (local.get $hwnd)) (i32.const 24))
              (i32.eq (call $ctrl_table_get_class (local.get $hwnd)) (i32.const 25)))))
        (store.field.memarg EditState font (local.get $state_w) (i32.const 0))
        (store.field.memarg EditState scroll_x (local.get $state_w) (i32.const 0))
        ;; Copy initial text from CREATESTRUCT if provided (lParam may be 0
        ;; when WM_CREATE is delivered via pending_child_create from GetMessageA)
        (if (local.get $lParam)
          (then
            (local.set $cs_w (call $g2w (local.get $lParam)))
            (local.set $name_ptr (i32.load offset=36 (local.get $cs_w)))
            (if (local.get $name_ptr)
              (then
                (local.set $text_len (call $strlen (call $g2w (local.get $name_ptr))))
                (call $edit_ensure_cap (local.get $state_w) (local.get $text_len))
                (if (local.get $text_len)
                  (then (call $memcpy (call $g2w (load.field EditState text_buf_ptr (local.get $state_w)))
                                      (call $g2w (local.get $name_ptr))
                                      (local.get $text_len))))
                (store.field.memarg EditState text_len (local.get $state_w) (local.get $text_len))
                (store.field.memarg EditState cursor (local.get $state_w) (local.get $text_len))
                (store.field.memarg EditState sel_anchor (local.get $state_w) (local.get $text_len))
                (if (load.field EditState text_buf_ptr (local.get $state_w))
                  (then (i32.store8 (i32.add (call $g2w (load.field EditState text_buf_ptr (local.get $state_w))) (local.get $text_len))
                                    (i32.const 0))))))))
        ;; Set flags from window style: ES_MULTILINE(0x04)→bit0, ES_PASSWORD(0x20)→bit1, ES_READONLY(0x800)→bit2
        (local.set $flags (call $wnd_get_style (local.get $hwnd)))
        (if (i32.and (local.get $flags) (i32.const 0x04))
          (then (store.field.memarg EditState flags (local.get $state_w)
            (i32.or (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0x01)))))
        (if (i32.and (local.get $flags) (i32.const 0x0020))
          (then (store.field.memarg EditState flags (local.get $state_w)
            (i32.or (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0x02)))))
        (if (i32.and (local.get $flags) (i32.const 0x0800))
          (then (store.field.memarg EditState flags (local.get $state_w)
            (i32.or (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0x04)))))
        (call $wnd_set_state_ptr (local.get $hwnd) (local.get $state))
        (return (i32.const 0))))

    ;; ---------- WM_SETFONT (0x0030) / WM_GETFONT (0x0031) ----------
    ;; MFC's CWnd::SetFont sends these through the application's EDIT
    ;; subclass. Keep the handle in native EditState so Paint's font toolbar
    ;; can both retrieve it for metrics and use it during control painting.
    (if (i32.eq (local.get $msg) (i32.const 0x0030))
      (then
        (if (local.get $state)
          (then
            (store.field.memarg EditState font (call $g2w (local.get $state)) (local.get $wParam))
            (if (local.get $lParam)
              (then (call $invalidate_hwnd (local.get $hwnd))))))
        (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0031))
      (then
        (if (local.get $state)
          (then (return (load.field.memarg EditState font (call $g2w (local.get $state))))))
        (return (i32.const 0))))

    ;; ---------- WM_DESTROY (0x0002) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0002))
      (then
        (if (local.get $state)
          (then
            (drop (call $timer_kill (local.get $hwnd) (i32.const 0xCA47)))
            (local.set $state_w (call $g2w (local.get $state)))
            (if (load.field EditState text_buf_ptr (local.get $state_w))
              (then (call $heap_free (load.field EditState text_buf_ptr (local.get $state_w)))))
            (call $heap_free (local.get $state))
            (call $wnd_set_state_ptr (local.get $hwnd) (i32.const 0))))
        (if (i32.eq (global.get $focus_hwnd) (local.get $hwnd))
          (then (global.set $focus_hwnd (i32.const 0))))
        (return (i32.const 0))))

    ;; ---------- WM_SETCURSOR (0x0020) ----------
    ;; Show the I-beam over the edit client area (HTCLIENT=1) — but not over
    ;; the scrollbar strips. $defwndproc_do_nccalcsize does not carve those out
    ;; of a WAT-native control's client rect (the control measures and paints
    ;; them itself), so every pixel of the bar still hit-tests as HTCLIENT and
    ;; would otherwise get the text cursor.
    (if (i32.eq (local.get $msg) (i32.const 0x0020))
      (then
        (if (i32.eq (i32.and (local.get $lParam) (i32.const 0xFFFF)) (i32.const 1))
          (then
            (local.set $a (call $host_get_mouse_position))
            (local.set $cx (i32.sub (i32.and (local.get $a) (i32.const 0xFFFF))
                                   (call $wnd_client_screen_x (local.get $hwnd))))
            (local.set $cy (i32.sub (i32.and (i32.shr_u (local.get $a) (i32.const 16)) (i32.const 0xFFFF))
                                   (call $wnd_client_screen_y (local.get $hwnd))))
            (local.set $b (call $ctrl_get_wh_packed (local.get $hwnd)))
            (if (i32.or
                  (i32.and
                    (i32.ne (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x00200000)) (i32.const 0))
                    (i32.ge_s (local.get $cx)
                      (i32.sub (i32.and (local.get $b) (i32.const 0xFFFF)) (i32.const 16))))
                  (i32.and
                    (call $edit_hscroll_reserved (local.get $hwnd))
                    (i32.ge_s (local.get $cy)
                      (i32.sub (i32.shr_u (local.get $b) (i32.const 16)) (i32.const 16)))))
              (then
                (drop (call $set_cursor_internal (i32.const 0x67F00))) ;; IDC_ARROW
                (return (i32.const 1))))
            (drop (call $set_cursor_internal (i32.const 0x67F01))) ;; IDC_IBEAM
            (return (i32.const 1))))
        (return (i32.const 0))))

    ;; ---------- WM_SETTEXT (0x000C) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x000C))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (store.field.memarg EditState text_len (local.get $state_w) (i32.const 0))
        (store.field.memarg EditState cursor (local.get $state_w) (i32.const 0))
        (store.field.memarg EditState sel_anchor (local.get $state_w) (i32.const 0))
        (if (local.get $lParam)
          (then
            (local.set $text_len
              (if (result i32) (call $wnd_unicode_get (local.get $hwnd))
                (then (call $strlen_w (call $g2w (local.get $lParam))))
                (else (call $strlen (call $g2w (local.get $lParam))))))
            (call $edit_ensure_cap (local.get $state_w) (local.get $text_len))
            (if (local.get $text_len)
              (then
                (if (call $wnd_unicode_get (local.get $hwnd))
                  (then
                    (drop (call $wide_to_ansi
                      (local.get $lParam) (load.field EditState text_buf_ptr (local.get $state_w))
                      (i32.add (local.get $text_len) (i32.const 1)))))
                  (else
                    (call $memcpy (call $g2w (load.field EditState text_buf_ptr (local.get $state_w)))
                                  (call $g2w (local.get $lParam))
                                  (local.get $text_len))))))
            (store.field.memarg EditState text_len (local.get $state_w) (local.get $text_len))
            (store.field.memarg EditState cursor (local.get $state_w) (local.get $text_len))
            (store.field.memarg EditState sel_anchor (local.get $state_w) (local.get $text_len))
            (if (load.field EditState text_buf_ptr (local.get $state_w))
              (then (i32.store8 (i32.add (call $g2w (load.field EditState text_buf_ptr (local.get $state_w))) (local.get $text_len))
                                (i32.const 0))))))
        (if (i32.and (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0x08))
          (then
            (call $edit_reset_caret_timer (local.get $hwnd) (local.get $state_w))))
        (call $edit_notify_change (local.get $hwnd))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.const 1))))

    ;; ---------- WM_GETTEXT (0x000D) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x000D))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (if (i32.eqz (local.get $wParam)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (local.set $text_len (load.field.memarg EditState text_len (local.get $state_w)))
        (if (i32.ge_u (local.get $text_len) (local.get $wParam))
          (then (local.set $text_len (i32.sub (local.get $wParam) (i32.const 1)))))
        (if (load.field EditState text_buf_ptr (local.get $state_w))
          (then
            (if (call $wnd_unicode_get (local.get $hwnd))
              (then
                (drop (call $ansi_to_wide
                  (load.field EditState text_buf_ptr (local.get $state_w)) (local.get $lParam)
                  (i32.add (local.get $text_len) (i32.const 1)))))
              (else
                (if (local.get $text_len)
                  (then (call $memcpy (call $g2w (local.get $lParam))
                                      (call $g2w (load.field EditState text_buf_ptr (local.get $state_w)))
                                      (local.get $text_len))))))))
        (if (call $wnd_unicode_get (local.get $hwnd))
          (then
            (call $gs16
              (i32.add (local.get $lParam) (i32.shl (local.get $text_len) (i32.const 1)))
              (i32.const 0)))
          (else
            (i32.store8 (i32.add (call $g2w (local.get $lParam)) (local.get $text_len)) (i32.const 0))))
        (return (local.get $text_len))))

    ;; ---------- WM_GETTEXTLENGTH (0x000E) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x000E))
      (then
        (if (local.get $state)
          (then (return (load.field.memarg EditState text_len (call $g2w (local.get $state))))))
        (return (i32.const 0))))

    ;; ---------- EM_STREAMIN (0x0449) ----------
    ;; RichEdit accepts either the documented callback-backed EDITSTREAM or the
    ;; older direct-cookie compatibility shape used by a few installers.
    (if (i32.eq (local.get $msg) (i32.const 0x0449))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (store.field.memarg EditState text_len (local.get $state_w) (i32.const 0))
        (store.field.memarg EditState cursor (local.get $state_w) (i32.const 0))
        (store.field.memarg EditState sel_anchor (local.get $state_w) (i32.const 0))
        (local.set $text_len (call $edit_stream_read
          (local.get $state_w) (local.get $lParam) (local.get $wParam)))
        (call $invalidate_hwnd (local.get $hwnd))
        (if (call $wnd_is_effectively_visible (local.get $hwnd))
          (then
            (drop (call $edit_wndproc
              (local.get $hwnd) (i32.const 0x000F)
              (i32.const 0) (i32.const 0)))
            (call $update_clear_hwnd (local.get $hwnd))
            (call $paint_flag_clear_hwnd (local.get $hwnd))))
        (return (load.field.memarg EditState text_len (local.get $state_w)))))

    ;; ---------- WM_SETFOCUS (0x0007) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0007))
      (then
        (global.set $focus_hwnd (local.get $hwnd))
        (if (local.get $state)
          (then
            (local.set $state_w (call $g2w (local.get $state)))
            (store.field.memarg EditState flags (local.get $state_w)
              (i32.or (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0x08)))
            (call $edit_reset_caret_timer (local.get $hwnd) (local.get $state_w))))
        (call $edit_notify (local.get $hwnd) (i32.const 0x0100)) ;; EN_SETFOCUS
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.const 0))))

    ;; ---------- WM_KILLFOCUS (0x0008) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0008))
      (then
        (if (i32.eq (global.get $focus_hwnd) (local.get $hwnd))
          (then (global.set $focus_hwnd (i32.const 0))))
        (if (local.get $state)
          (then
            (local.set $state_w (call $g2w (local.get $state)))
            (call $edit_stop_caret_timer (local.get $hwnd) (local.get $state_w))
            (store.field.memarg EditState flags (local.get $state_w)
              (i32.and (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0xFFFFFFF7)))))
        (call $edit_notify (local.get $hwnd) (i32.const 0x0200)) ;; EN_KILLFOCUS
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.const 0))))

    ;; ---------- WM_SIZE (0x0005) ----------
    ;; Wrapped multiline edits derive max_scroll from current control geometry.
    ;; Clamp immediately on resize so EM_GETFIRSTVISIBLELINE cannot expose a
    ;; stale top line after a window/control grows wider or taller.
    (if (i32.eq (local.get $msg) (i32.const 0x0005))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (if (i32.eqz (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x00000004)))
          (then (return (i32.const 0))))
        ;; $edit_view_metrics is the one place that knows a WS_HSCROLL edit
        ;; loses 16px of height to its own scrollbar. This site used to
        ;; re-derive the viewport inline and omit exactly that, so a horizontal
        ;; scrollbar bought the control one extra "visible" line it does not have.
        (local.set $sz (call $edit_view_metrics (local.get $hwnd) (local.get $state_w)))
        (local.set $total_lines (i32.and (local.get $sz) (i32.const 0xFFFF)))
        (local.set $visible_lines (i32.shr_u (local.get $sz) (i32.const 16)))
        (local.set $max_scroll (i32.sub (local.get $total_lines) (local.get $visible_lines)))
        (if (i32.lt_s (local.get $max_scroll) (i32.const 0))
          (then (local.set $max_scroll (i32.const 0))))
        (if (i32.gt_s (load.field.memarg EditState scroll_top (local.get $state_w)) (local.get $max_scroll))
          (then (store.field.memarg EditState scroll_top (local.get $state_w) (local.get $max_scroll))))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.const 0))))

    ;; ---------- WM_TIMER (0x0113) ----------
    ;; Swallowed. 0xCA47 was this control's private caret-blink timer, back when
    ;; it drew and blinked a caret of its own; USER owns the caret now and
    ;; nothing sets that timer any more.
    (if (i32.eq (local.get $msg) (i32.const 0x0113))
      (then (return (i32.const 0))))

    ;; ---------- WM_CHAR (0x0102) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0102))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (if (i32.and (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0x04))
          (then (return (i32.const 0))))
        ;; VK_BACK = 0x08 — backspace
        (if (i32.eq (local.get $wParam) (i32.const 0x08))
          (then
            (local.set $lo (call $edit_sel_lo (local.get $state_w)))
            (local.set $hi (call $edit_sel_hi (local.get $state_w)))
            (if (i32.ne (local.get $lo) (local.get $hi))
              (then (call $edit_delete_range (local.get $state_w) (local.get $lo) (local.get $hi)))
              (else
                (if (local.get $lo)
                  (then (call $edit_delete_range (local.get $state_w)
                          (i32.sub (local.get $lo) (i32.const 1))
                          (local.get $lo))))))
            (call $edit_reset_caret_timer (local.get $hwnd) (local.get $state_w))
            (call $edit_notify_change (local.get $hwnd))
            (call $edit_invalidate_caret (local.get $hwnd))
            (return (i32.const 0))))
        ;; CR (0x0D) — Enter key: insert newline only for multiline edits (bit 0 of flags)
        (if (i32.eq (local.get $wParam) (i32.const 0x0D))
          (then
            (if (i32.and (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0x01))
              (then
                (call $edit_insert_char (local.get $state_w) (i32.const 0x0A))
                (store.field.memarg EditState flags (local.get $state_w)
                  (i32.or (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0x08)))
                (call $edit_reset_caret_timer (local.get $hwnd) (local.get $state_w))
                (call $edit_notify_change (local.get $hwnd))
                (call $edit_invalidate_caret (local.get $hwnd))))
            (return (i32.const 0))))
        (if (i32.lt_u (local.get $wParam) (i32.const 0x20))
          (then (return (i32.const 0))))
        (call $edit_insert_char (local.get $state_w) (local.get $wParam))
        (store.field.memarg EditState flags (local.get $state_w)
          (i32.or (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0x08)))
        (call $edit_reset_caret_timer (local.get $hwnd) (local.get $state_w))
        (call $edit_notify_change (local.get $hwnd))
        (call $edit_invalidate_caret (local.get $hwnd))
        (return (i32.const 0))))

    ;; ---------- WM_KEYDOWN (0x0100) ----------
    ;; Keyboard navigation + editing. Shift-held keeps sel_anchor so arrows
    ;; extend the selection; plain arrows collapse. Ctrl+A/C/X/V handle
    ;; select-all / copy / cut / paste. Ctrl+Left/Right jump word boundaries;
    ;; Ctrl+Home/End jump to start/end of text. $a = shift_down, $b = ctrl_down
    ;; (high bit of host_get_async_key_state, read once at top).
    (if (i32.eq (local.get $msg) (i32.const 0x0100))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (local.set $vk (local.get $wParam))
        (local.set $cur (load.field.memarg EditState cursor (local.get $state_w)))
        (local.set $text_len (load.field.memarg EditState text_len (local.get $state_w)))
        (local.set $a (call $edit_shift_down))
        (local.set $b (call $edit_ctrl_down))
        ;; ---- Ctrl combos ----
        (if (local.get $b)
          (then
            ;; Ctrl+A (0x41) — select all
            (if (i32.eq (local.get $vk) (i32.const 0x41))
              (then
                (store.field.memarg EditState sel_anchor (local.get $state_w) (i32.const 0))
                (store.field.memarg EditState cursor (local.get $state_w) (local.get $text_len))
                (call $edit_invalidate_caret (local.get $hwnd))
                (return (i32.const 0))))
            ;; Ctrl+C (0x43) — copy
            (if (i32.eq (local.get $vk) (i32.const 0x43))
              (then
                (call $edit_copy_range (local.get $state_w)
                  (call $edit_sel_lo (local.get $state_w))
                  (call $edit_sel_hi (local.get $state_w)))
                (return (i32.const 0))))
            ;; Ctrl+X (0x58) — cut (read-only blocks deletion but copy still fires)
            (if (i32.eq (local.get $vk) (i32.const 0x58))
              (then
                (local.set $lo (call $edit_sel_lo (local.get $state_w)))
                (local.set $hi (call $edit_sel_hi (local.get $state_w)))
                (call $edit_copy_range (local.get $state_w) (local.get $lo) (local.get $hi))
                (if (i32.eqz (i32.and (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0x04)))
                  (then
                    (call $edit_delete_range (local.get $state_w) (local.get $lo) (local.get $hi))
                    (call $edit_notify_change (local.get $hwnd))
                    (call $edit_invalidate_caret (local.get $hwnd))))
                (return (i32.const 0))))
            ;; Ctrl+V (0x56) — paste
            (if (i32.eq (local.get $vk) (i32.const 0x56))
              (then
                (if (i32.eqz (i32.and (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0x04)))
                  (then
                    (if (global.get $clipboard_len)
                      (then (call $edit_insert_bytes (local.get $state_w)
                              (global.get $clipboard_ptr) (global.get $clipboard_len))
                            (call $edit_notify_change (local.get $hwnd))))
                    (call $edit_invalidate_caret (local.get $hwnd))))
                (return (i32.const 0))))))
        ;; VK_LEFT 0x25
        (if (i32.eq (local.get $vk) (i32.const 0x25))
          (then
            (if (local.get $cur)
              (then
                (if (local.get $b)
                  (then (local.set $cur (call $edit_word_start (local.get $state_w)
                          (i32.sub (local.get $cur) (i32.const 1)))))
                  (else (local.set $cur (i32.sub (local.get $cur) (i32.const 1)))))
                (store.field.memarg EditState cursor (local.get $state_w) (local.get $cur))
                (if (i32.eqz (local.get $a))
                  (then (store.field.memarg EditState sel_anchor (local.get $state_w) (local.get $cur))))
                (call $edit_invalidate_caret (local.get $hwnd))))
            (return (i32.const 0))))
        ;; VK_RIGHT 0x27
        (if (i32.eq (local.get $vk) (i32.const 0x27))
          (then
            (if (i32.lt_u (local.get $cur) (local.get $text_len))
              (then
                (if (local.get $b)
                  (then (local.set $cur (call $edit_word_end (local.get $state_w)
                          (i32.add (local.get $cur) (i32.const 1)))))
                  (else (local.set $cur (i32.add (local.get $cur) (i32.const 1)))))
                (store.field.memarg EditState cursor (local.get $state_w) (local.get $cur))
                (if (i32.eqz (local.get $a))
                  (then (store.field.memarg EditState sel_anchor (local.get $state_w) (local.get $cur))))
                (call $edit_invalidate_caret (local.get $hwnd))))
            (return (i32.const 0))))
        ;; VK_HOME 0x24 — start of line (or start of text with Ctrl)
        (if (i32.eq (local.get $vk) (i32.const 0x24))
          (then
            (if (local.get $b)
              (then (local.set $cur (i32.const 0)))
              (else (local.set $cur (call $edit_line_start (local.get $state_w) (local.get $cur)))))
            (store.field.memarg EditState cursor (local.get $state_w) (local.get $cur))
            (if (i32.eqz (local.get $a))
              (then (store.field.memarg EditState sel_anchor (local.get $state_w) (local.get $cur))))
            (call $edit_invalidate_caret (local.get $hwnd))
            (return (i32.const 0))))
        ;; VK_END 0x23 — end of line (or end of text with Ctrl)
        (if (i32.eq (local.get $vk) (i32.const 0x23))
          (then
            (if (local.get $b)
              (then (local.set $cur (local.get $text_len)))
              (else
                (local.set $lo (call $edit_line_start (local.get $state_w) (local.get $cur)))
                (local.set $cur (i32.add (local.get $lo)
                  (call $edit_line_text_len (local.get $state_w) (local.get $lo))))))
            (store.field.memarg EditState cursor (local.get $state_w) (local.get $cur))
            (if (i32.eqz (local.get $a))
              (then (store.field.memarg EditState sel_anchor (local.get $state_w) (local.get $cur))))
            (call $edit_invalidate_caret (local.get $hwnd))
            (return (i32.const 0))))
        ;; VK_BACK 0x08 — backspace. Browsers don't fire keypress for VK_BACK,
        ;; so WM_CHAR 0x08 never arrives for WAT-native edits; handle it here.
        (if (i32.eq (local.get $vk) (i32.const 0x08))
          (then
            (if (i32.and (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0x04))
              (then (return (i32.const 0))))
            (local.set $lo (call $edit_sel_lo (local.get $state_w)))
            (local.set $hi (call $edit_sel_hi (local.get $state_w)))
            (if (i32.ne (local.get $lo) (local.get $hi))
              (then (call $edit_delete_range (local.get $state_w) (local.get $lo) (local.get $hi)))
              (else
                (if (local.get $cur)
                  (then (call $edit_delete_range (local.get $state_w)
                          (i32.sub (local.get $cur) (i32.const 1))
                          (local.get $cur))))))
            (call $edit_notify_change (local.get $hwnd))
            (call $edit_invalidate_caret (local.get $hwnd))
            (return (i32.const 0))))
        ;; VK_DELETE 0x2E
        (if (i32.eq (local.get $vk) (i32.const 0x2E))
          (then
            (if (i32.and (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0x04))
              (then (return (i32.const 0))))
            (local.set $lo (call $edit_sel_lo (local.get $state_w)))
            (local.set $hi (call $edit_sel_hi (local.get $state_w)))
            (if (i32.ne (local.get $lo) (local.get $hi))
              (then (call $edit_delete_range (local.get $state_w) (local.get $lo) (local.get $hi)))
              (else
                (if (i32.lt_u (local.get $cur) (local.get $text_len))
                  (then (call $edit_delete_range (local.get $state_w)
                          (local.get $cur)
                          (i32.add (local.get $cur) (i32.const 1)))))))
            (call $edit_notify_change (local.get $hwnd))
            (call $edit_invalidate_caret (local.get $hwnd))
            (return (i32.const 0))))
        ;; VK_UP 0x26
        (if (i32.eq (local.get $vk) (i32.const 0x26))
          (then
            (local.set $lo (call $edit_line_start (local.get $state_w) (local.get $cur)))
            (if (local.get $lo)  ;; not on first line
              (then
                ;; col = cur - line_start
                (local.set $hi (i32.sub (local.get $cur) (local.get $lo)))
                ;; find start of previous line
                (local.set $lo (call $edit_line_start (local.get $state_w) (i32.sub (local.get $lo) (i32.const 1))))
                ;; prev line length
                (local.set $px (call $edit_line_text_len (local.get $state_w) (local.get $lo)))
                ;; clamp col to prev line length
                (if (i32.gt_u (local.get $hi) (local.get $px))
                  (then (local.set $hi (local.get $px))))
                (local.set $cur (i32.add (local.get $lo) (local.get $hi)))
                (store.field.memarg EditState cursor (local.get $state_w) (local.get $cur))
                (if (i32.eqz (local.get $a))
                  (then (store.field.memarg EditState sel_anchor (local.get $state_w) (local.get $cur))))
                (call $edit_invalidate_caret (local.get $hwnd))))
            (return (i32.const 0))))
        ;; VK_DOWN 0x28
        (if (i32.eq (local.get $vk) (i32.const 0x28))
          (then
            ;; col = cur - line_start
            (local.set $lo (call $edit_line_start (local.get $state_w) (local.get $cur)))
            (local.set $hi (i32.sub (local.get $cur) (local.get $lo)))
            ;; find end of current line (next \n or text_len)
            (local.set $px (i32.add (local.get $lo) (call $edit_line_len (local.get $state_w) (local.get $lo))))
            (if (i32.lt_u (local.get $px) (local.get $text_len))
              (then
                ;; next line starts after the \n
                (local.set $lo (i32.add (local.get $px) (i32.const 1)))
                ;; next line length
                (local.set $px (call $edit_line_text_len (local.get $state_w) (local.get $lo)))
                ;; clamp col
                (if (i32.gt_u (local.get $hi) (local.get $px))
                  (then (local.set $hi (local.get $px))))
                (local.set $cur (i32.add (local.get $lo) (local.get $hi)))
                (store.field.memarg EditState cursor (local.get $state_w) (local.get $cur))
                (if (i32.eqz (local.get $a))
                  (then (store.field.memarg EditState sel_anchor (local.get $state_w) (local.get $cur))))
                (call $edit_invalidate_caret (local.get $hwnd))))
            (return (i32.const 0))))
        (return (i32.const 0))))

    ;; ---------- WM_LBUTTONDOWN (0x0201) / WM_LBUTTONDBLCLK (0x0203) ----------
    ;; Click: hit-test via $edit_xy_to_offset, move cursor there. Shift-held
    ;; keeps the anchor (extends selection); plain click collapses both.
    ;; Double-click selects the word under the cursor. lParam = x | y<<16.
    (if (i32.or (i32.eq (local.get $msg) (i32.const 0x0201))
                (i32.eq (local.get $msg) (i32.const 0x0203)))
      (then
        ;; Focus transfer: mirror SetFocus's WM_KILLFOCUS to the previous
        ;; focus window. Without this, the old edit keeps its 0x08 focus
        ;; flag and keeps drawing a caret after the user clicks another
        ;; control. WAT-native wndprocs dispatch synchronously; x86 ones
        ;; fall back to the post queue (matches $handle_SetFocus).
        (if (i32.and (i32.ne (global.get $focus_hwnd) (local.get $hwnd))
                     (i32.ne (global.get $focus_hwnd) (i32.const 0)))
          (then
            (if (i32.ge_u (call $wnd_table_get (global.get $focus_hwnd))
                          (i32.const 0xFFFF0000))
              (then (drop (call $wat_wndproc_dispatch
                      (global.get $focus_hwnd) (i32.const 0x0008)
                      (local.get $hwnd) (i32.const 0))))
              (else (drop (call $post_queue_push
                      (global.get $focus_hwnd) (i32.const 0x0008)
                      (local.get $hwnd) (i32.const 0)))))))
        (global.set $focus_hwnd (local.get $hwnd))
        ;; Grab mouse capture so the renderer routes WM_MOUSEMOVE here
        ;; with MK_LBUTTON while the user drags — needed for selection
        ;; extension. Released on WM_LBUTTONUP below.
        (global.set $capture_hwnd (local.get $hwnd))
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        ;; Mark focused + drag-tracking bit 4 (0x10).
        (store.field.memarg EditState flags (local.get $state_w)
          (i32.or (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0x18)))
        (call $edit_reset_caret_timer (local.get $hwnd) (local.get $state_w))
	        (local.set $hdc (i32.add (local.get $hwnd) (i32.const 0x40000)))
	        (local.set $w (i32.shr_s (i32.shl (local.get $lParam) (i32.const 16)) (i32.const 16)))
	        (local.set $h (i32.shr_s (local.get $lParam) (i32.const 16)))
	        ;; Inside the horizontal strip. Checked before the vertical one and
	        ;; before the text hit-test, since the bottom-right corner belongs
	        ;; to neither scrollbar and a press in the strip is not a caret
	        ;; placement. Parts: 3 = left arrow held, 4 = right arrow held,
	        ;; 6 = thumb drag (the vertical thumb owns 5).
	        (if (call $edit_hscroll_reserved (local.get $hwnd))
	          (then
	            (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
	            (local.set $full_w (i32.and (local.get $sz) (i32.const 0xFFFF)))
	            (local.set $full_h (i32.shr_u (local.get $sz) (i32.const 16)))
	            (local.set $line_buf_w (local.get $full_w))
	            (if (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x00200000))
	              (then (local.set $line_buf_w (i32.sub (local.get $full_w) (i32.const 16)))))
	            (if (i32.and
	                  (i32.ge_s (local.get $h) (i32.sub (local.get $full_h) (i32.const 16)))
	                  (i32.lt_s (local.get $w) (local.get $line_buf_w)))
	              (then
	                (local.set $max_hscroll (call $edit_max_hscroll
	                  (local.get $state_w) (local.get $hdc) (local.get $line_buf_w)))
	                (local.set $lo (load.field.memarg EditState scroll_x (local.get $state_w)))
	                (local.set $b (call $scroll_arrow_filter_hit
	                  (local.get $hwnd) (i32.const 0)
	                  (call $sb_page_hit_part
	                    (local.get $line_buf_w) (local.get $w) (local.get $lo)
	                    (i32.const 0)
	                    (i32.sub (i32.add (local.get $max_hscroll) (local.get $line_buf_w))
	                             (i32.const 1))
	                    (local.get $line_buf_w))))
	                ;; One arrow click is one average character wide; a page is
	                ;; the visible width, matching what USER does with a
	                ;; proportional font.
	                (if (i32.eq (local.get $b) (i32.const 1))
	                  (then (drop (call $edit_hscroll_to (local.get $state_w)
	                    (i32.sub (local.get $lo) (i32.const 8)) (local.get $max_hscroll)))
	                    (global.set $sb_pressed_hwnd (local.get $hwnd))
	                    (global.set $sb_pressed_part (i32.const 3))))
	                (if (i32.eq (local.get $b) (i32.const 2))
	                  (then (drop (call $edit_hscroll_to (local.get $state_w)
	                    (i32.add (local.get $lo) (i32.const 8)) (local.get $max_hscroll)))
	                    (global.set $sb_pressed_hwnd (local.get $hwnd))
	                    (global.set $sb_pressed_part (i32.const 4))))
	                (if (i32.eq (local.get $b) (i32.const 3))
	                  (then (drop (call $edit_hscroll_to (local.get $state_w)
	                    (i32.sub (local.get $lo) (local.get $line_buf_w))
	                    (local.get $max_hscroll)))))
	                (if (i32.eq (local.get $b) (i32.const 4))
	                  (then (drop (call $edit_hscroll_to (local.get $state_w)
	                    (i32.add (local.get $lo) (local.get $line_buf_w))
	                    (local.get $max_hscroll)))))
	                (if (i32.eq (local.get $b) (i32.const 5))
	                  (then
	                    (global.set $edit_sb_drag_anchor_y (local.get $w))
	                    (global.set $edit_sb_drag_anchor_top (local.get $lo))
	                    (global.set $sb_pressed_hwnd (local.get $hwnd))
	                    (global.set $sb_pressed_part (i32.const 6))))
	                ;; Not the start of a text selection.
	                (store.field.memarg EditState flags (local.get $state_w)
	                  (i32.and (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0xFFFFFFEF)))
	                (call $invalidate_hwnd (local.get $hwnd))
	                (return (i32.const 0))))))
	        (if (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x00200000))
	          (then
	            (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
	            (local.set $full_w (i32.and (local.get $sz) (i32.const 0xFFFF)))
	            (local.set $line_y (i32.shr_u (local.get $sz) (i32.const 16)))
	            ;; The vertical strip stops above the horizontal one, so its
	            ;; track is that much shorter when both are present.
	            (if (call $edit_hscroll_reserved (local.get $hwnd))
	              (then (local.set $line_y (i32.sub (local.get $line_y) (i32.const 16)))))
	            ;; Inside the vertical strip: classify with the same geometry
	            ;; $defwndproc_paint_standard_scrollbar painted it with, so a
	            ;; press on the thumb the user can see starts a drag rather than
	            ;; a page. This used to be a fourth private copy of the thumb
	            ;; arithmetic, which sized the thumb at 16px while the painter
	            ;; sized it by nPage -- so most of the visible thumb paged.
	            (if (i32.ge_s (local.get $w) (i32.sub (local.get $full_w) (i32.const 16)))
	              (then
	                (local.set $a (call $edit_view_metrics (local.get $hwnd) (local.get $state_w)))
	                (local.set $total_lines (i32.and (local.get $a) (i32.const 0xFFFF)))
	                (local.set $visible_lines (i32.shr_u (local.get $a) (i32.const 16)))
	                (local.set $lo (load.field.memarg EditState scroll_top (local.get $state_w)))
	                (local.set $b (call $scroll_arrow_filter_hit
	                  (local.get $hwnd) (i32.const 1)
	                  (call $sb_page_hit_part
	                    (local.get $line_y) (local.get $h) (local.get $lo)
	                    (i32.const 0) (i32.sub (local.get $total_lines) (i32.const 1))
	                    (local.get $visible_lines))))
	                (if (i32.eq (local.get $b) (i32.const 1))
	                  (then (drop (call $edit_scroll_to (local.get $hwnd) (local.get $state_w)
	                    (i32.sub (local.get $lo) (i32.const 1))
	                    (local.get $total_lines) (local.get $visible_lines)))))
	                (if (i32.eq (local.get $b) (i32.const 2))
	                  (then (drop (call $edit_scroll_to (local.get $hwnd) (local.get $state_w)
	                    (i32.add (local.get $lo) (i32.const 1))
	                    (local.get $total_lines) (local.get $visible_lines)))))
	                (if (i32.eq (local.get $b) (i32.const 3))
	                  (then (drop (call $edit_scroll_to (local.get $hwnd) (local.get $state_w)
	                    (i32.sub (local.get $lo) (local.get $visible_lines))
	                    (local.get $total_lines) (local.get $visible_lines)))))
	                (if (i32.eq (local.get $b) (i32.const 4))
	                  (then (drop (call $edit_scroll_to (local.get $hwnd) (local.get $state_w)
	                    (i32.add (local.get $lo) (local.get $visible_lines))
	                    (local.get $total_lines) (local.get $visible_lines)))))
	                (if (i32.eq (local.get $b) (i32.const 5))
	                  (then
	                    (global.set $edit_sb_drag_anchor_y (local.get $h))
	                    (global.set $edit_sb_drag_anchor_top (local.get $lo))))
	                (if (local.get $b)
	                  (then
	                    (global.set $sb_pressed_hwnd (local.get $hwnd))
	                    (global.set $sb_pressed_part (local.get $b))))
	                ;; A press on the scrollbar is not the start of a text
	                ;; selection. WM_LBUTTONDOWN arms tracking bit 0x10 before it
	                ;; knows where the click landed, so clear it here or every
	                ;; following WM_MOUSEMOVE extends a selection while the user
	                ;; is only dragging the thumb.
	                (store.field.memarg EditState flags (local.get $state_w)
	                  (i32.and (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0xFFFFFFEF)))
	                (drop (call $wnd_send_message
	                  (local.get $hwnd) (i32.const 0x000F) (i32.const 0) (i32.const 0)))
	                (call $invalidate_hwnd (local.get $hwnd))
	                (return (i32.const 0))))))
	        (if (call $edit_wraps (local.get $hwnd))
	          (then
	            (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
	            (local.set $cur (call $edit_layout_xy_to_offset
	              (local.get $state_w) (local.get $hdc)
	              (i32.sub (i32.and (local.get $sz) (i32.const 0xFFFF)) (i32.const 16))
	              (local.get $w) (local.get $h))))
	          (else
	            (local.set $cur (call $edit_xy_to_offset
	              (local.get $state_w) (local.get $hdc) (local.get $w) (local.get $h)))))
        (if (i32.eq (local.get $msg) (i32.const 0x0203))
          (then
            ;; Double-click: select word spanning $cur
            (local.set $lo (call $edit_word_start (local.get $state_w) (local.get $cur)))
            (local.set $hi (call $edit_word_end (local.get $state_w) (local.get $cur)))
            (store.field.memarg EditState sel_anchor (local.get $state_w) (local.get $lo))
            (store.field.memarg EditState cursor (local.get $state_w) (local.get $hi)))
          (else
            (store.field.memarg EditState cursor (local.get $state_w) (local.get $cur))
            ;; Only collapse anchor when Shift is NOT held (extends existing selection).
            (if (i32.eqz (call $edit_shift_down))
              (then (store.field.memarg EditState sel_anchor (local.get $state_w) (local.get $cur))))))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.const 0))))

    ;; ---------- WM_MOUSEMOVE (0x0200) ----------
    ;; Extend selection while the left button is held (tracking bit 0x10
    ;; set by LBUTTONDOWN). MK_LBUTTON in wParam confirms the button is
    ;; actually down — guards against stray moves after a button-up we
    ;; didn't see.
    (if (i32.eq (local.get $msg) (i32.const 0x0200))
      (then
	        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
	        (local.set $state_w (call $g2w (local.get $state)))
	        ;; Horizontal thumb drag (part 6): same shared geometry as the
	        ;; strip painter, in pixels rather than lines.
	        (if (i32.and (i32.eq (global.get $sb_pressed_hwnd) (local.get $hwnd))
	                     (i32.eq (global.get $sb_pressed_part) (i32.const 6)))
	          (then
	            (if (i32.eqz (i32.and (local.get $wParam) (i32.const 0x0001)))
	              (then
	                (global.set $sb_pressed_hwnd (i32.const 0))
	                (global.set $sb_pressed_part (i32.const 0))
	                (if (i32.eq (global.get $capture_hwnd) (local.get $hwnd))
	                  (then (global.set $capture_hwnd (i32.const 0))))
	                (return (i32.const 0))))
	            (local.set $hdc (i32.add (local.get $hwnd) (i32.const 0x40000)))
	            (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
	            (local.set $line_buf_w (i32.and (local.get $sz) (i32.const 0xFFFF)))
	            (if (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x00200000))
	              (then (local.set $line_buf_w (i32.sub (local.get $line_buf_w) (i32.const 16)))))
	            (local.set $w (i32.shr_s (i32.shl (local.get $lParam) (i32.const 16)) (i32.const 16)))
	            (local.set $max_hscroll (call $edit_max_hscroll
	              (local.get $state_w) (local.get $hdc) (local.get $line_buf_w)))
	            (drop (call $edit_hscroll_to (local.get $state_w)
	              (call $sb_page_drag_pos
	                (local.get $line_buf_w) (local.get $w)
	                (global.get $edit_sb_drag_anchor_y) (global.get $edit_sb_drag_anchor_top)
	                (i32.const 0)
	                (i32.sub (i32.add (local.get $max_hscroll) (local.get $line_buf_w))
	                         (i32.const 1))
	                (local.get $line_buf_w))
	              (local.get $max_hscroll)))
	            (call $invalidate_hwnd (local.get $hwnd))
	            (return (i32.const 0))))
	        (if (i32.and (i32.eq (global.get $sb_pressed_hwnd) (local.get $hwnd))
	                     (i32.eq (global.get $sb_pressed_part) (i32.const 5)))
	          (then
	            (if (i32.eqz (i32.and (local.get $wParam) (i32.const 0x0001)))
	              (then
	                (global.set $sb_pressed_hwnd (i32.const 0))
	                (global.set $sb_pressed_part (i32.const 0))
	                (if (i32.eq (global.get $capture_hwnd) (local.get $hwnd))
	                  (then (global.set $capture_hwnd (i32.const 0))))
	                (return (i32.const 0))))
	            ;; Thumb drag through the shared geometry, so the thumb tracks
	            ;; the pointer instead of the private 16px thumb this used to
	            ;; assume while the painter drew one sized by nPage.
	            (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
	            (local.set $line_y (i32.shr_u (local.get $sz) (i32.const 16)))
	            (local.set $h (i32.shr_s (local.get $lParam) (i32.const 16)))
	            (local.set $a (call $edit_view_metrics (local.get $hwnd) (local.get $state_w)))
	            (local.set $total_lines (i32.and (local.get $a) (i32.const 0xFFFF)))
	            (local.set $visible_lines (i32.shr_u (local.get $a) (i32.const 16)))
	            (drop (call $edit_scroll_to (local.get $hwnd) (local.get $state_w)
	              (call $sb_page_drag_pos
	                (local.get $line_y) (local.get $h)
	                (global.get $edit_sb_drag_anchor_y) (global.get $edit_sb_drag_anchor_top)
	                (i32.const 0) (i32.sub (local.get $total_lines) (i32.const 1))
	                (local.get $visible_lines))
	              (local.get $total_lines) (local.get $visible_lines)))
	            (call $invalidate_hwnd (local.get $hwnd))
	            (return (i32.const 0))))
	        (local.set $flags (load.field.memarg EditState flags (local.get $state_w)))
        (if (i32.eqz (i32.and (local.get $flags) (i32.const 0x10)))
          (then (return (i32.const 0))))
        (if (i32.eqz (i32.and (local.get $wParam) (i32.const 0x0001)))
          (then
            ;; Lost the button without a WM_LBUTTONUP — clear drag flag.
            (store.field.memarg EditState flags (local.get $state_w)
              (i32.and (local.get $flags) (i32.const 0xFFFFFFEF)))
            (return (i32.const 0))))
        (local.set $hdc (i32.add (local.get $hwnd) (i32.const 0x40000)))
        (local.set $w (i32.shr_s (i32.shl (local.get $lParam) (i32.const 16)) (i32.const 16)))
        (local.set $h (i32.shr_s (local.get $lParam) (i32.const 16)))
        (if (call $edit_wraps (local.get $hwnd))
          (then
            (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
            (local.set $cur (call $edit_layout_xy_to_offset
              (local.get $state_w) (local.get $hdc)
              (i32.sub (i32.and (local.get $sz) (i32.const 0xFFFF)) (i32.const 16))
              (local.get $w) (local.get $h))))
          (else
            (local.set $cur (call $edit_xy_to_offset
              (local.get $state_w) (local.get $hdc) (local.get $w) (local.get $h)))))
        (if (i32.ne (local.get $cur) (load.field.memarg EditState cursor (local.get $state_w)))
          (then
            (store.field.memarg EditState cursor (local.get $state_w) (local.get $cur))
            (call $invalidate_hwnd (local.get $hwnd))))
        (return (i32.const 0))))

    ;; ---------- WM_LBUTTONUP (0x0202) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0202))
      (then
	        (if (local.get $state)
	          (then
	            (local.set $state_w (call $g2w (local.get $state)))
	            (store.field.memarg EditState flags (local.get $state_w)
	              (i32.and (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0xFFFFFFEF)))))
	        (if (i32.eq (global.get $sb_pressed_hwnd) (local.get $hwnd))
	          (then
	            (global.set $sb_pressed_hwnd (i32.const 0))
	            (global.set $sb_pressed_part (i32.const 0))
	            (call $invalidate_hwnd (local.get $hwnd))))
	        ;; Release capture grabbed on WM_LBUTTONDOWN.
        (if (i32.eq (global.get $capture_hwnd) (local.get $hwnd))
          (then (global.set $capture_hwnd (i32.const 0))))
        (return (i32.const 0))))

    ;; ---------- WM_PAINT (0x000F) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x000F))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        ;; Native EDIT painting has the same publication boundary as
        ;; BeginPaint/EndPaint. In Worker mode a slice may end after the white
        ;; fill and before TextOut; keep those pixels private until this whole
        ;; control paint is complete.
        (call $host_paint_begin (local.get $hwnd))
        ;; Paint commits a text object by asking its EDIT to render into the
        ;; picture memory DC via SendMessage(WM_PAINT, hdc, 0). Honor that
        ;; Win9x control convention; ordinary paints still use the window DC.
        (local.set $hdc
          (select (local.get $wParam)
                  (i32.add (local.get $hwnd) (i32.const 0x40000))
                  (i32.ne (local.get $wParam) (i32.const 0))))
        ;; Native control paints don't call BeginPaint, so establish the
        ;; child-client clip explicitly before drawing wrapped/scrolling text.
        ;; Preserve an explicitly supplied DC's clip and viewport: its caller
        ;; owns both and may have translated them into a backing bitmap.
        (if (i32.eqz (local.get $wParam))
          (then
            (drop (call $gdi_native_select_clip_rgn (local.get $hdc) (i32.const 0)))
            (call $dc_apply_client_clip (local.get $hdc) (local.get $hwnd))))
        ;; ctrl_get_wh_packed reads CONTROL_GEOM (works for WAT-only children
        ;; that have no JS-side window record).
        (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
        (local.set $w (i32.and (local.get $sz) (i32.const 0xFFFF)))
        (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
        (local.set $full_w (local.get $w))
        (local.set $full_h (local.get $h))
        ;; Reserve the right strip for multiline edits created with WS_VSCROLL.
        (if (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x00200000))
          (then
            (if (i32.gt_u (local.get $w) (i32.const 16))
              (then (local.set $w (i32.sub (local.get $w) (i32.const 16)))))))
        ;; And the bottom strip for WS_HSCROLL. Without this the last row of
        ;; text and its caret are drawn underneath the horizontal scrollbar,
        ;; which only became visible once the caret could reach the last row.
        ;; A wrapped edit keeps the full height: it draws no horizontal strip,
        ;; so reserving one leaves a band nothing in this paint ever covers.
        (if (call $edit_hscroll_reserved (local.get $hwnd))
          (then
            (if (i32.gt_u (local.get $h) (i32.const 16))
              (then (local.set $h (i32.sub (local.get $h) (i32.const 16)))))))
        ;; Text origin: the 4px left margin, moved left by the horizontal
        ;; scroll offset. A wrapped edit has nothing to scroll horizontally
        ;; over, so its offset is forced home rather than left stale from
        ;; before the app turned word wrap on.
        (if (call $edit_wraps (local.get $hwnd))
          (then (store.field.memarg EditState scroll_x (local.get $state_w) (i32.const 0))))
        (local.set $tx (i32.sub (i32.const 4)
          (load.field.memarg EditState scroll_x (local.get $state_w))))
        ;; Use the font installed with WM_SETFONT, falling back to the default
        ;; GUI font. Paint relies on this when committing its text object into
        ;; the picture memory DC.
        (drop (call $gdi_native_select_object
          (local.get $hdc)
          (select
            (load.field.memarg EditState font (local.get $state_w))
            (i32.const 0x30021)
            (i32.ne (load.field.memarg EditState font (local.get $state_w)) (i32.const 0)))))
        (drop (call $gdi_native_set_bk_mode (local.get $hdc) (i32.const 1)))
        ;; 1) White background (WHITE_BRUSH stock obj 0 = 0x30010)
        (drop (call $gdi_native_fill_rect (local.get $hdc)
                (i32.const 0) (i32.const 0) (local.get $w) (local.get $h)
                (i32.const 0x30010)))
        ;; 2) Sunken edge: BDR_SUNKENOUTER(0x02)|BDR_SUNKENINNER(0x08) = 0x0A; BF_RECT = 0x0F
        (if (i32.eqz (local.get $wParam))
          (then
            (drop (call $gdi_native_draw_edge (local.get $hdc)
                    (i32.const 0) (i32.const 0) (local.get $w) (local.get $h)
                    (i32.const 0x0A) (i32.const 0x0F)))))
        ;; 3) Text — draw line by line, splitting on \n. Each line is split
        ;; into up to three segments (pre-sel / sel / post-sel) so selected
        ;; text renders white-on-blue while unselected text stays black.
        (local.set $buf (load.field EditState text_buf_ptr (local.get $state_w)))
        (local.set $text_len (load.field.memarg EditState text_len (local.get $state_w)))
        (local.set $sel_lo (call $edit_sel_lo (local.get $state_w)))
        (local.set $sel_hi (call $edit_sel_hi (local.get $state_w)))
        ;; Multiline edits with a vertical scrollbar and no ES_AUTOHSCROLL
        ;; behave like RichEdit license viewers: word-wrap text inside the
        ;; client rect.
        (if (i32.and
              (i32.ne (local.get $buf) (i32.const 0))
              (call $edit_wraps (local.get $hwnd)))
          (then
            (local.set $total_lines
              (call $edit_layout_build
                (local.get $state_w) (local.get $hdc) (local.get $w)))
            (local.set $visible_lines (i32.div_u
              (select (i32.sub (local.get $h) (i32.const 8)) (i32.const 1)
                      (i32.gt_u (local.get $h) (i32.const 8)))
              (i32.const 16)))
            (if (i32.eqz (local.get $visible_lines))
              (then (local.set $visible_lines (i32.const 1))))
            (local.set $max_scroll (i32.sub (local.get $total_lines) (local.get $visible_lines)))
            (if (i32.lt_s (local.get $max_scroll) (i32.const 0))
              (then (local.set $max_scroll (i32.const 0))))
            (if (i32.gt_s (load.field.memarg EditState scroll_top (local.get $state_w)) (local.get $max_scroll))
              (then (store.field.memarg EditState scroll_top (local.get $state_w) (local.get $max_scroll))))
            (local.set $lo (load.field.memarg EditState scroll_top (local.get $state_w)))
            (local.set $line_y (i32.const 4))
            (block $wrapped_done (loop $wrapped_loop
              (br_if $wrapped_done (i32.ge_u (local.get $lo) (local.get $total_lines)))
              (br_if $wrapped_done (i32.ge_s (local.get $line_y) (local.get $h)))
              (local.set $line_buf_w (call $edit_layout_start (local.get $lo)))
              (local.set $hi (call $edit_layout_len (local.get $lo)))
              (local.set $line_end (i32.add (local.get $line_buf_w) (local.get $hi)))
              (local.set $a (i32.const 0))
              (local.set $b (i32.const 0))
              (if (i32.and (i32.lt_u (local.get $sel_lo) (local.get $sel_hi))
                           (i32.and (i32.le_u (local.get $sel_lo) (local.get $line_end))
                                    (i32.ge_u (local.get $sel_hi) (local.get $line_buf_w))))
                (then
                  (local.set $a (local.get $sel_lo))
                  (if (i32.lt_u (local.get $a) (local.get $line_buf_w))
                    (then (local.set $a (local.get $line_buf_w))))
                  (local.set $a (i32.sub (local.get $a) (local.get $line_buf_w)))
                  (local.set $b (local.get $sel_hi))
                  (if (i32.gt_u (local.get $b) (local.get $line_end))
                    (then (local.set $b (local.get $line_end))))
                  (local.set $b (i32.sub (local.get $b) (local.get $line_buf_w)))))
              (local.set $line_buf_w (i32.add (call $g2w (local.get $buf)) (local.get $line_buf_w)))
              (if (i32.lt_u (local.get $a) (local.get $b))
                (then
                  (local.set $pre_w (i32.const 0))
                  (if (local.get $a)
                    (then (local.set $pre_w
                      (call $host_measure_text (local.get $hdc) (local.get $line_buf_w)
                        (local.get $a) (i32.const 0)))))
                  (local.set $sel_w (i32.sub
                    (call $host_measure_text (local.get $hdc) (local.get $line_buf_w)
                      (local.get $b) (i32.const 0))
                    (local.get $pre_w)))
                  (if (i32.eqz (local.get $sel_w))
                    (then (local.set $sel_w (i32.mul (i32.sub (local.get $b) (local.get $a)) (i32.const 8)))))
                  (local.set $brush (call $gdi_native_create_solid_brush (i32.const 0x00800000)))
                  (drop (call $gdi_native_fill_rect (local.get $hdc)
                          (i32.add (local.get $pre_w) (i32.const 4))
                          (i32.sub (local.get $line_y) (i32.const 2))
                          (i32.add (i32.add (local.get $pre_w) (local.get $sel_w)) (i32.const 4))
                          (i32.add (local.get $line_y) (i32.const 13))
                          (local.get $brush)))
                  (drop (call $gdi_native_delete_object (local.get $brush)))
                  (if (local.get $a)
                    (then (drop (call $gdi_native_text_out
                      (local.get $hdc) (i32.const 4) (local.get $line_y)
                      (local.get $line_buf_w) (local.get $a) (i32.const 0)))))
                  (drop (call $gdi_native_set_text_color (local.get $hdc) (i32.const 0x00FFFFFF)))
                  (drop (call $gdi_native_text_out
                    (local.get $hdc) (i32.add (local.get $pre_w) (i32.const 4)) (local.get $line_y)
                    (i32.add (local.get $line_buf_w) (local.get $a))
                    (i32.sub (local.get $b) (local.get $a)) (i32.const 0)))
                  (drop (call $gdi_native_set_text_color (local.get $hdc) (i32.const 0x00000000)))
                  (if (i32.lt_u (local.get $b) (local.get $hi))
                    (then (drop (call $gdi_native_text_out
                      (local.get $hdc)
                      (i32.add (i32.add (local.get $pre_w) (local.get $sel_w)) (i32.const 4))
                      (local.get $line_y)
                      (i32.add (local.get $line_buf_w) (local.get $b))
                      (i32.sub (local.get $hi) (local.get $b)) (i32.const 0))))))
                (else
                  (if (local.get $hi)
                    (then (drop (call $gdi_native_text_out
                      (local.get $hdc) (i32.const 4) (local.get $line_y)
                      (local.get $line_buf_w) (local.get $hi) (i32.const 0)))))))
              (local.set $lo (i32.add (local.get $lo) (i32.const 1)))
              (local.set $line_y (i32.add (local.get $line_y) (i32.const 16)))
              (br $wrapped_loop)))

            (local.set $flags (load.field.memarg EditState flags (local.get $state_w)))
            (if (i32.eq
                  (i32.and (local.get $flags) (i32.const 0x28))
                  (i32.const 0x28))
              (then
                (local.set $cur (load.field.memarg EditState cursor (local.get $state_w)))
                (local.set $lo (call $edit_layout_line_for_char (local.get $total_lines) (local.get $cur)))
                (local.set $a (i32.sub (local.get $lo) (load.field.memarg EditState scroll_top (local.get $state_w))))
                (local.set $hi (i32.mul (local.get $a) (i32.const 16)))
                (local.set $px (i32.const 0))
                (local.set $line_end (call $edit_layout_start (local.get $lo)))
                (if (i32.gt_u (local.get $cur) (local.get $line_end))
                  (then
                    (local.set $px (call $host_measure_text
                      (local.get $hdc)
                      (i32.add (call $g2w (local.get $buf)) (local.get $line_end))
                      (i32.sub (local.get $cur) (local.get $line_end))
                      (i32.const 0)))))
                (if (i32.and (i32.eqz (local.get $px)) (i32.gt_u (local.get $cur) (local.get $line_end)))
                  (then
                    (local.set $px
                      (i32.mul (i32.sub (local.get $cur) (local.get $line_end)) (i32.const 8)))))
                (if (i32.and
                      (i32.ge_s (local.get $a) (i32.const 0))
                      (i32.lt_s (local.get $hi) (local.get $h)))
                  (then
                    (drop (call $gdi_native_fill_rect (local.get $hdc)
                            (i32.add (local.get $px) (i32.const 4))
                            (i32.add (local.get $hi) (i32.const 2))
                            (i32.add (local.get $px) (i32.const 6))
                            (i32.add (local.get $hi) (i32.const 17))
                            (i32.const 0x30014)))))))
            (if (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x00200000))
              (then
                (call $defwndproc_paint_standard_scrollbar (local.get $hdc)
                  (i32.sub (local.get $full_w) (i32.const 16)) (i32.const 0)
                  (i32.const 16) (local.get $h) (i32.const 1)
                  (load.field.memarg EditState scroll_top (local.get $state_w))
                  (i32.const 0) (i32.sub (local.get $total_lines) (i32.const 1))
                  (local.get $visible_lines)
                  (select (global.get $sb_pressed_part) (i32.const 0)
                          (i32.eq (global.get $sb_pressed_hwnd) (local.get $hwnd)))
                  (call $scroll_arrow_mask (local.get $hwnd) (i32.const 1)))))
            ;; Refresh non-client chrome after the edit reaches its final
            ;; size. Notepad does not send another WM_NCPAINT after sizing its
            ;; child, and client clipping intentionally excludes these strips.
            (if (i32.and
                  (i32.eqz (local.get $wParam))
                  (i32.ne
                    (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x00300000))
                    (i32.const 0)))
              (then (call $defwndproc_do_ncpaint (local.get $hwnd))))
            (call $host_paint_end (local.get $hwnd))
            (return (i32.const 0))))
        (if (local.get $buf)
          (then
            ;; Start at the scroll_top line (multi-line scroll). scroll_top is
            ;; 0 for single-line and by default for multi-line.
            (local.set $lo (call $edit_line_index (local.get $state_w)
                             (load.field.memarg EditState scroll_top (local.get $state_w))))
            (local.set $line_y (i32.const 4))
            (block $lines_done (loop $line_loop
              (br_if $lines_done (i32.gt_u (local.get $lo) (local.get $text_len)))
              (local.set $hi (call $edit_line_len (local.get $state_w) (local.get $lo)))
              (local.set $line_end (i32.add (local.get $lo) (local.get $hi)))
              ;; line_end (the \n) steps the loop; only the text is drawn.
              (local.set $hi (call $edit_line_text_len (local.get $state_w) (local.get $lo)))
              (local.set $line_buf_w (i32.add (call $g2w (local.get $buf)) (local.get $lo)))
              ;; Selection intersection within this line (relative to line start).
              (local.set $a (i32.const 0))
              (local.set $b (i32.const 0))
              (if (i32.and (i32.lt_u (local.get $sel_lo) (local.get $sel_hi))
                           (i32.and (i32.le_u (local.get $sel_lo) (local.get $line_end))
                                    (i32.ge_u (local.get $sel_hi) (local.get $lo))))
                (then
                  (local.set $a (local.get $sel_lo))
                  (if (i32.lt_u (local.get $a) (local.get $lo)) (then (local.set $a (local.get $lo))))
                  (local.set $a (i32.sub (local.get $a) (local.get $lo)))
                  (local.set $b (local.get $sel_hi))
                  (if (i32.gt_u (local.get $b) (local.get $line_end)) (then (local.set $b (local.get $line_end))))
                  (local.set $b (i32.sub (local.get $b) (local.get $lo)))))
              ;; A selection may cover the CR; it is not drawn.
              (if (i32.gt_u (local.get $b) (local.get $hi)) (then (local.set $b (local.get $hi))))
              (if (i32.gt_u (local.get $a) (local.get $hi)) (then (local.set $a (local.get $hi))))
              ;; ...but a selection running on past the line break still pads
              ;; to the right edge, even on a blank CRLF line.
              (if (i32.or
                    (i32.lt_u (local.get $a) (local.get $b))
                    (i32.and (i32.lt_u (local.get $sel_lo) (local.get $sel_hi))
                             (i32.and (i32.le_u (local.get $sel_lo) (local.get $line_end))
                                      (i32.gt_u (local.get $sel_hi) (local.get $line_end)))))
                (then
                  ;; Highlight rect: measure widths up to $a and up to $b.
                  (local.set $pre_w (i32.const 0))
                  (if (local.get $a)
                    (then (local.set $pre_w (call $host_measure_text
                            (local.get $hdc) (local.get $line_buf_w)
                            (local.get $a) (i32.const 0)))))
                  (local.set $sel_w (i32.sub
                    (call $host_measure_text (local.get $hdc) (local.get $line_buf_w)
                      (local.get $b) (i32.const 0))
                    (local.get $pre_w)))
                  ;; If sel extends past the \n (to the next line), pad to right edge.
                  (if (i32.gt_u (local.get $sel_hi) (local.get $line_end))
                    (then (local.set $sel_w (i32.sub (local.get $w)
                            (i32.add (local.get $pre_w) (local.get $tx))))))
                  (local.set $brush (call $gdi_native_create_solid_brush (i32.const 0x00800000)))
	                  (drop (call $gdi_native_fill_rect (local.get $hdc)
	                          (i32.add (local.get $pre_w) (local.get $tx))
	                          (i32.sub (local.get $line_y) (i32.const 2))
	                          (i32.add (i32.add (local.get $pre_w) (local.get $sel_w)) (local.get $tx))
	                          (i32.add (local.get $line_y) (i32.const 13))
	                          (local.get $brush)))
                  (drop (call $gdi_native_delete_object (local.get $brush)))
                  ;; pre-sel text (black)
                  (if (local.get $a)
                    (then (drop (call $gdi_native_text_out (local.get $hdc)
                                  (local.get $tx) (local.get $line_y)
                                  (local.get $line_buf_w) (local.get $a) (i32.const 0)))))
                  ;; selected text (white)
                  (drop (call $gdi_native_set_text_color (local.get $hdc) (i32.const 0x00FFFFFF)))
                  (drop (call $gdi_native_text_out (local.get $hdc)
                          (i32.add (local.get $pre_w) (local.get $tx)) (local.get $line_y)
                          (i32.add (local.get $line_buf_w) (local.get $a))
                          (i32.sub (local.get $b) (local.get $a)) (i32.const 0)))
                  (drop (call $gdi_native_set_text_color (local.get $hdc) (i32.const 0x00000000)))
                  ;; post-sel text (black)
                  (if (i32.lt_u (local.get $b) (local.get $hi))
                    (then (drop (call $gdi_native_text_out (local.get $hdc)
                                  (i32.add (i32.add (local.get $pre_w) (local.get $sel_w)) (local.get $tx))
                                  (local.get $line_y)
                                  (i32.add (local.get $line_buf_w) (local.get $b))
                                  (i32.sub (local.get $hi) (local.get $b)) (i32.const 0))))))
                (else
                  (if (local.get $hi)
                    (then (drop (call $gdi_native_text_out (local.get $hdc)
                                  (local.get $tx) (local.get $line_y)
                                  (local.get $line_buf_w) (local.get $hi) (i32.const 0)))))))
              (local.set $lo (i32.add (local.get $line_end) (i32.const 1)))
              (local.set $line_y (i32.add (local.get $line_y) (i32.const 16)))
              (br $line_loop)))))
        ;; 4) Caret position (only if focused — bit 3 of flags). This is
        ;; SetCaretPos, not a draw: the compositor paints and blinks the USER
        ;; caret, exactly as USER does for a real EDIT. Drawing it here as well
        ;; would put two carets in the control, on two blink clocks.
        (local.set $flags (load.field.memarg EditState flags (local.get $state_w)))
        (if (i32.eq
              (i32.and (local.get $flags) (i32.const 0x08))
              (i32.const 0x08))
          (then
            (local.set $cur (load.field.memarg EditState cursor (local.get $state_w)))
            ;; Find which line the cursor is on and the offset within that line.
            ;; Subtract scroll_top so the caret tracks the visible viewport.
            (local.set $lo (call $edit_line_start (local.get $state_w) (local.get $cur)))
            (local.set $a (i32.sub
                            (call $edit_line_from_char (local.get $state_w) (local.get $cur))
                            (load.field.memarg EditState scroll_top (local.get $state_w))))
            (local.set $hi (i32.mul (local.get $a) (i32.const 16)))
            (local.set $px (i32.const 0))
            (if (i32.and (i32.ne (local.get $buf) (i32.const 0)) (i32.gt_u (local.get $cur) (local.get $lo)))
              (then (local.set $px (call $host_measure_text (local.get $hdc)
                                        (i32.add (call $g2w (local.get $buf)) (local.get $lo))
                                        (i32.sub (local.get $cur) (local.get $lo))
                                        (i32.const 0)))))
            (if (i32.and (i32.eqz (local.get $px)) (i32.gt_u (local.get $cur) (local.get $lo)))
              (then (local.set $px
                (i32.mul (i32.sub (local.get $cur) (local.get $lo)) (i32.const 8)))))
            (if (i32.and
                  (i32.ge_s (local.get $a) (i32.const 0))
                  (i32.const 1))
              (then
            (global.set $caret_hwnd (local.get $hwnd))
            (global.set $caret_x (i32.add (local.get $px) (local.get $tx)))
            (global.set $caret_y (i32.add (local.get $hi) (i32.const 2)))
            (global.set $caret_w (i32.const 2))
            (global.set $caret_h (i32.const 15))
            (global.set $caret_visible (i32.const 1))))))
        ;; 5) Optional vertical scrollbar strip. Scrolling state is line-based.
        (if (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x00200000))
          (then
            (local.set $total_lines
              (i32.add (call $edit_line_from_char (local.get $state_w) (local.get $text_len))
                       (i32.const 1)))
            (local.set $visible_lines (i32.div_u
              (select (i32.sub (local.get $h) (i32.const 8)) (i32.const 1)
                      (i32.gt_u (local.get $h) (i32.const 8)))
              (i32.const 16)))
            (if (i32.eqz (local.get $visible_lines))
              (then (local.set $visible_lines (i32.const 1))))
            (local.set $max_scroll (i32.sub (local.get $total_lines) (local.get $visible_lines)))
            (if (i32.lt_s (local.get $max_scroll) (i32.const 0))
              (then (local.set $max_scroll (i32.const 0))))
            ;; Through the SCROLLINFO painter, which is the same page model
            ;; $sb_page_hit_part and $sb_page_drag_pos classify clicks with.
            ;; Painting it with the older range model instead sized and placed
            ;; the thumb differently from the geometry the drag code assumed,
            ;; so dragging the thumb moved the text further than the pointer.
            (call $defwndproc_paint_standard_scrollbar (local.get $hdc)
              (i32.sub (local.get $full_w) (i32.const 16)) (i32.const 0)
              (i32.const 16) (local.get $h) (i32.const 1)
              (load.field.memarg EditState scroll_top (local.get $state_w))
              (i32.const 0) (i32.sub (local.get $total_lines) (i32.const 1))
              (local.get $visible_lines)
              (select (global.get $sb_pressed_part) (i32.const 0)
                      (i32.eq (global.get $sb_pressed_hwnd) (local.get $hwnd)))
              (call $scroll_arrow_mask (local.get $hwnd) (i32.const 1)))))
        ;; 6) Optional horizontal scrollbar strip. Scrolling state is in
        ;; pixels, since an unwrapped line is measured, not counted. Same
        ;; predicate the prologue reserved the band with, so the strip is
        ;; drawn exactly when the room for it was taken.
        (if (call $edit_hscroll_reserved (local.get $hwnd))
          (then
            (local.set $max_hscroll (call $edit_max_hscroll
              (local.get $state_w) (local.get $hdc) (local.get $w)))
            ;; Text shrinking (or the window growing) can leave the stored
            ;; offset past the new end of the document.
            (drop (call $edit_hscroll_to (local.get $state_w)
              (load.field.memarg EditState scroll_x (local.get $state_w)) (local.get $max_hscroll)))
            ;; Same page model as the vertical strip, with pixels for units:
            ;; the document is max_hscroll + one visible width wide, and the
            ;; page is that visible width.
            (call $defwndproc_paint_standard_scrollbar (local.get $hdc)
              (i32.const 0) (i32.sub (local.get $full_h) (i32.const 16))
              (local.get $w) (i32.const 16) (i32.const 0)
              (load.field.memarg EditState scroll_x (local.get $state_w))
              (i32.const 0)
              (i32.sub (i32.add (local.get $max_hscroll) (local.get $w)) (i32.const 1))
              (local.get $w)
              (select (global.get $sb_pressed_part) (i32.const 0)
                      (i32.eq (global.get $sb_pressed_hwnd) (local.get $hwnd)))
              (call $scroll_arrow_mask (local.get $hwnd) (i32.const 0)))
            ;; The dead square where the two strips meet is scrollbar-grey,
            ;; not white: it belongs to neither track.
            (if (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x00200000))
              (then (drop (call $gdi_native_fill_rect (local.get $hdc)
                (i32.sub (local.get $full_w) (i32.const 16))
                (i32.sub (local.get $full_h) (i32.const 16))
                (local.get $full_w) (local.get $full_h)
                (i32.const 0x30011)))))))
        (if (i32.and
              (i32.eqz (local.get $wParam))
              (i32.ne
                (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x00300000))
                (i32.const 0)))
          (then (call $defwndproc_do_ncpaint (local.get $hwnd))))
        (call $host_paint_end (local.get $hwnd))
        (return (i32.const 0))))

    ;; ---------- EM_SETLIMITTEXT / EM_LIMITTEXT (0x00C5) ----------
    ;; wParam = max chars (0 → unlimited; semantics differ across versions —
    ;; we treat 0 as unlimited as the Win9x docs state). No return value.
    (if (i32.eq (local.get $msg) (i32.const 0x00C5))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $text_len (local.get $wParam))
        ;; For both RichEdit generations, zero selects the documented 64,000
        ;; compatibility limit. Plain EDIT retains the emulator's unlimited
        ;; zero sentinel.
        (if (i32.and
              (i32.eqz (local.get $text_len))
              (i32.or
                (i32.eq (call $ctrl_table_get_class (local.get $hwnd)) (i32.const 24))
                (i32.eq (call $ctrl_table_get_class (local.get $hwnd)) (i32.const 25))))
          (then (local.set $text_len (i32.const 64000))))
        (store.field.memarg EditState max_length (call $g2w (local.get $state)) (local.get $text_len))
        (return (i32.const 0))))

    ;; ---------- EM_GETLIMITTEXT (0x00D5) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x00D5))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (return (load.field.memarg EditState max_length (call $g2w (local.get $state))))))

    ;; ---------- RichEdit 2.0+ extended range/limit messages ----------
    ;; RichEdit 1.0 intentionally leaves these unsupported and continues to
    ;; expose EM_GETSEL/EM_SETSEL/EM_LIMITTEXT, which are shared with EDIT.
    (if (i32.and
          (i32.eq (call $ctrl_table_get_class (local.get $hwnd)) (i32.const 25))
          (i32.eq (local.get $msg) (i32.const 0x0434))) ;; EM_EXGETSEL
      (then
        (if (i32.or (i32.eqz (local.get $state)) (i32.eqz (local.get $lParam)))
          (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (call $gs32 (local.get $lParam) (call $edit_sel_lo (local.get $state_w)))
        (call $gs32 (i32.add (local.get $lParam) (i32.const 4))
          (call $edit_sel_hi (local.get $state_w)))
        (return (i32.const 0))))

    (if (i32.and
          (i32.eq (call $ctrl_table_get_class (local.get $hwnd)) (i32.const 25))
          (i32.eq (local.get $msg) (i32.const 0x0435))) ;; EM_EXLIMITTEXT
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $text_len (local.get $lParam))
        (if (i32.eqz (local.get $text_len))
          (then (local.set $text_len (i32.const 64000))))
        (store.field.memarg EditState max_length (call $g2w (local.get $state)) (local.get $text_len))
        (return (i32.const 0))))

    (if (i32.and
          (i32.eq (call $ctrl_table_get_class (local.get $hwnd)) (i32.const 25))
          (i32.eq (local.get $msg) (i32.const 0x0437))) ;; EM_EXSETSEL
      (then
        (if (i32.or (i32.eqz (local.get $state)) (i32.eqz (local.get $lParam)))
          (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (local.set $text_len (load.field.memarg EditState text_len (local.get $state_w)))
        (local.set $lo (call $gl32 (local.get $lParam)))
        (local.set $hi (call $gl32 (i32.add (local.get $lParam) (i32.const 4))))
        (if (i32.eq (local.get $lo) (i32.const -1))
          (then (local.set $lo (local.get $text_len))))
        (if (i32.eq (local.get $hi) (i32.const -1))
          (then (local.set $hi (local.get $text_len))))
        (if (i32.gt_u (local.get $lo) (local.get $text_len))
          (then (local.set $lo (local.get $text_len))))
        (if (i32.gt_u (local.get $hi) (local.get $text_len))
          (then (local.set $hi (local.get $text_len))))
        (store.field.memarg EditState sel_anchor (local.get $state_w) (local.get $lo))
        (store.field.memarg EditState cursor (local.get $state_w) (local.get $hi))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (local.get $hi))))

    ;; ---------- EM_GETSEL (0x00B0) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x00B0))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (local.set $lo (call $edit_sel_lo (local.get $state_w)))
        (local.set $hi (call $edit_sel_hi (local.get $state_w)))
        (if (local.get $wParam)
          (then (call $gs32 (local.get $wParam) (local.get $lo))))
        (if (local.get $lParam)
          (then (call $gs32 (local.get $lParam) (local.get $hi))))
        (return (i32.or (i32.and (local.get $lo) (i32.const 0xFFFF))
                        (i32.shl (local.get $hi) (i32.const 16))))))

    ;; ---------- WM_COPY (0x0301) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0301))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (call $edit_copy_range (local.get $state_w)
          (call $edit_sel_lo (local.get $state_w))
          (call $edit_sel_hi (local.get $state_w)))
        (return (i32.const 0))))

    ;; ---------- WM_CUT (0x0300) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0300))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (local.set $lo (call $edit_sel_lo (local.get $state_w)))
        (local.set $hi (call $edit_sel_hi (local.get $state_w)))
        (call $edit_copy_range (local.get $state_w) (local.get $lo) (local.get $hi))
        (if (i32.eqz (i32.and (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0x04)))
          (then
            (call $edit_delete_range (local.get $state_w) (local.get $lo) (local.get $hi))
            (call $edit_notify_change (local.get $hwnd))
            (call $invalidate_hwnd (local.get $hwnd))))
        (return (i32.const 0))))

    ;; ---------- WM_PASTE (0x0302) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0302))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (if (i32.and (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0x04))
          (then (return (i32.const 0))))
        (if (global.get $clipboard_len)
          (then (call $edit_insert_bytes (local.get $state_w)
                  (global.get $clipboard_ptr) (global.get $clipboard_len))
                (call $edit_notify_change (local.get $hwnd))))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.const 0))))

    ;; ---------- WM_CLEAR (0x0303) — delete selection without copying ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0303))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (if (i32.and (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0x04))
          (then (return (i32.const 0))))
        (local.set $lo (call $edit_sel_lo (local.get $state_w)))
        (local.set $hi (call $edit_sel_hi (local.get $state_w)))
        (if (i32.ne (local.get $lo) (local.get $hi))
          (then
            (call $edit_delete_range (local.get $state_w) (local.get $lo) (local.get $hi))
            (call $edit_notify_change (local.get $hwnd))
            (call $invalidate_hwnd (local.get $hwnd))))
        (return (i32.const 0))))

    ;; ---------- EM_SETSEL (0x00B1) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x00B1))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (local.set $text_len (load.field.memarg EditState text_len (local.get $state_w)))
        ;; wParam = start, lParam = end (-1 = end of text)
        (local.set $lo (local.get $wParam))
        (local.set $hi (local.get $lParam))
        ;; EM_SETSEL(-1, 0) removes the current selection. Paint uses this
        ;; immediately before rendering the edit into its backing bitmap.
        (if (i32.eq (local.get $lo) (i32.const -1))
          (then
            (store.field.memarg EditState sel_anchor (local.get $state_w) (local.get $text_len))
            (store.field.memarg EditState cursor (local.get $state_w) (local.get $text_len))
            (call $invalidate_hwnd (local.get $hwnd))
            (return (i32.const 0))))
        (if (i32.eq (local.get $hi) (i32.const -1))
          (then (local.set $hi (local.get $text_len))))
        (if (i32.gt_u (local.get $lo) (local.get $text_len))
          (then (local.set $lo (local.get $text_len))))
        (if (i32.gt_u (local.get $hi) (local.get $text_len))
          (then (local.set $hi (local.get $text_len))))
        (store.field.memarg EditState sel_anchor (local.get $state_w) (local.get $lo))  ;; sel_anchor = start
        (store.field.memarg EditState cursor (local.get $state_w) (local.get $hi))  ;; cursor = end
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.const 0))))

    ;; ---------- EM_REPLACESEL (0x00C2) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x00C2))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        ;; Delete current selection
        (local.set $lo (call $edit_sel_lo (local.get $state_w)))
        (local.set $hi (call $edit_sel_hi (local.get $state_w)))
        (if (i32.ne (local.get $lo) (local.get $hi))
          (then (call $edit_delete_range (local.get $state_w) (local.get $lo) (local.get $hi))))
        ;; Insert replacement text char by char
        (if (local.get $lParam)
          (then
            (local.set $buf (call $g2w (local.get $lParam)))
            (block $done (loop $ins
              (local.set $vk (i32.load8_u (local.get $buf)))
              (br_if $done (i32.eqz (local.get $vk)))
              (call $edit_insert_char (local.get $state_w) (local.get $vk))
              (local.set $buf (i32.add (local.get $buf) (i32.const 1)))
              (br $ins)))))
        (store.field.memarg EditState flags (local.get $state_w)
          (i32.or (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0x08)))
        (call $edit_reset_caret_timer (local.get $hwnd) (local.get $state_w))
        (call $edit_notify_change (local.get $hwnd))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.const 0))))

    ;; ---------- EM_LINEFROMCHAR (0x00C9) ----------
    ;; wParam = char index (-1 = cursor). Returns 0-based line number.
    (if (i32.eq (local.get $msg) (i32.const 0x00C9))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (local.set $cur (local.get $wParam))
        (if (i32.eq (local.get $cur) (i32.const -1))
          (then (local.set $cur (load.field.memarg EditState cursor (local.get $state_w)))))
        (return (call $edit_line_from_char (local.get $state_w) (local.get $cur)))))

    ;; ---------- EM_LINEINDEX (0x00BB) ----------
    ;; wParam = line number (-1 = current line). Returns char index of line start.
    (if (i32.eq (local.get $msg) (i32.const 0x00BB))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (local.set $lo (local.get $wParam))
        (if (i32.eq (local.get $lo) (i32.const -1))
          (then (local.set $lo (call $edit_line_from_char (local.get $state_w)
                                 (load.field.memarg EditState cursor (local.get $state_w))))))
        (return (call $edit_line_index (local.get $state_w) (local.get $lo)))))

    ;; ---------- EM_GETLINECOUNT (0x00BA) ----------
    ;; Display lines, not paragraphs: on a wrapped multiline edit Windows
    ;; counts every visual row, which is also the unit EM_GETFIRSTVISIBLELINE
    ;; and the scrollbar already speak here. Counting hard breaks instead made
    ;; the two disagree -- Winamp's license viewer reports 24 lines for a text
    ;; its own scrollbar walks past row 80.
    (if (i32.eq (local.get $msg) (i32.const 0x00BA))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 1))))
        (local.set $state_w (call $g2w (local.get $state)))
        (if (call $edit_wraps (local.get $hwnd))
          (then (return (i32.and
                  (call $edit_view_metrics (local.get $hwnd) (local.get $state_w))
                  (i32.const 0xFFFF)))))
        (return (i32.add (call $edit_line_from_char (local.get $state_w)
                           (load.field.memarg EditState text_len (local.get $state_w)))
                         (i32.const 1)))))

    ;; ---------- EM_LINELENGTH (0x00C1) ----------
    ;; wParam = char index. Returns length of line containing that char.
    (if (i32.eq (local.get $msg) (i32.const 0x00C1))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (local.set $lo (call $edit_line_start (local.get $state_w) (local.get $wParam)))
        (return (call $edit_line_text_len (local.get $state_w) (local.get $lo)))))

    ;; ---------- EM_SCROLLCARET (0x00B7) ----------
    ;; The EM_SETSEL + EM_SCROLLCARET pair is how an app (notepad's Find, for
    ;; one) brings a selection into view, so this has to do the scrolling that
    ;; EM_SETSEL deliberately does not.
    (if (i32.eq (local.get $msg) (i32.const 0x00B7))
      (then
        (if (call $edit_scroll_caret_into_view (local.get $hwnd))
          (then (call $invalidate_hwnd (local.get $hwnd))))
        (return (i32.const 0))))

    ;; ---------- EM_GETFIRSTVISIBLELINE (0x00CE) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x00CE))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (return (load.field.memarg EditState scroll_top (call $g2w (local.get $state))))))

    ;; ---------- WM_MOUSEWHEEL (0x020A) ----------
    ;; wParam hi-word = signed wheel delta (120 per notch, positive = scroll up).
    ;; Only multi-line edits (flags bit 0) scroll; otherwise no-op.
    (if (i32.eq (local.get $msg) (i32.const 0x020A))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (if (i32.eqz (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x00000004)))
          (then (return (i32.const 0))))
        ;; lines_delta = -delta_raw / 40  (120/3 = 40 → 3 lines per notch)
        (local.set $vk (i32.div_s
                         (i32.sub (i32.const 0)
                           (i32.shr_s (local.get $wParam) (i32.const 16)))
                         (i32.const 40)))
        ;; Through the shared viewport metrics. This used to be a private copy
        ;; that measured visible lines against the full control height, so on
        ;; an edit with a horizontal strip it believed one more line fitted
        ;; than the painter drew -- and the wheel stopped one line short of the
        ;; end of the document while the thumb still had track left.
        (local.set $a (call $edit_view_metrics (local.get $hwnd) (local.get $state_w)))
        (local.set $b (i32.and (local.get $a) (i32.const 0xFFFF)))      ;; total lines
        (local.set $a (i32.shr_u (local.get $a) (i32.const 16)))        ;; visible lines
        (if (call $edit_scroll_to (local.get $hwnd) (local.get $state_w)
              (i32.add (load.field.memarg EditState scroll_top (local.get $state_w)) (local.get $vk))
              (local.get $b) (local.get $a))
          (then (call $invalidate_hwnd (local.get $hwnd))))
        (return (i32.const 0))))

    ;; Default
    (i32.const 0)
  )

  ;; ---- Multiline edit helpers ----
  ;; Find start of line containing char at $pos. Scans backward for \n.
  (func $edit_line_start (param $state_w ptr<EditState>) (param $pos i32) (result i32)
    (local $buf_w i32) (local $i i32)
    (local.set $buf_w (load.field EditState text_buf_ptr (local.get $state_w)))
    (if (i32.eqz (local.get $buf_w)) (then (return (i32.const 0))))
    (local.set $buf_w (call $g2w (local.get $buf_w)))
    (local.set $i (local.get $pos))
    (block $done (loop $scan
      (br_if $done (i32.le_s (local.get $i) (i32.const 0)))
      (if (i32.eq (i32.load8_u (i32.add (local.get $buf_w) (i32.sub (local.get $i) (i32.const 1))))
                  (i32.const 0x0A))
        (then (return (local.get $i))))
      (local.set $i (i32.sub (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  ;; Length of line starting at $line_start (chars until \n or end of text).
  (func $edit_line_len (param $state_w ptr<EditState>) (param $line_start i32) (result i32)
    (local $buf_w i32) (local $text_len i32) (local $i i32)
    (local.set $buf_w (load.field EditState text_buf_ptr (local.get $state_w)))
    (if (i32.eqz (local.get $buf_w)) (then (return (i32.const 0))))
    (local.set $buf_w (call $g2w (local.get $buf_w)))
    (local.set $text_len (load.field.memarg EditState text_len (local.get $state_w)))
    (local.set $i (local.get $line_start))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $text_len)))
      (br_if $done (i32.eq (i32.load8_u (i32.add (local.get $buf_w) (local.get $i)))
                           (i32.const 0x0A)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.sub (local.get $i) (local.get $line_start)))

  ;; The line's text length: $edit_line_len without the CR of a CRLF break.
  ;; $edit_line_len stops at the \n and so still counts that CR, which is
  ;; right for stepping to the next line (start + len + 1) and wrong for
  ;; anything that draws, measures or places a caret in the line: USER's
  ;; EM_LINELENGTH excludes it, and drawn it is a '?' glyph at every line end
  ;; (SC2000's budget header "New City\r\n1903 Budget\r\n...").
  (func $edit_line_text_len (param $state_w ptr<EditState>) (param $line_start i32) (result i32)
    (local $len i32)
    (local.set $len (call $edit_line_len (local.get $state_w) (local.get $line_start)))
    (if (i32.eqz (local.get $len)) (then (return (i32.const 0))))
    (if (i32.eq
          (i32.load8_u (i32.add
            (call $g2w (load.field EditState text_buf_ptr (local.get $state_w)))
            (i32.sub (i32.add (local.get $line_start) (local.get $len)) (i32.const 1))))
          (i32.const 0x0D))
      (then (return (i32.sub (local.get $len) (i32.const 1)))))
    (local.get $len))

  ;; Return 0-based line number containing char at $pos.
  (func $edit_line_from_char (param $state_w ptr<EditState>) (param $pos i32) (result i32)
    (local $buf_w i32) (local $i i32) (local $line i32)
    (local.set $buf_w (load.field EditState text_buf_ptr (local.get $state_w)))
    (if (i32.eqz (local.get $buf_w)) (then (return (i32.const 0))))
    (local.set $buf_w (call $g2w (local.get $buf_w)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $pos)))
      (if (i32.eq (i32.load8_u (i32.add (local.get $buf_w) (local.get $i))) (i32.const 0x0A))
        (then (local.set $line (i32.add (local.get $line) (i32.const 1)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (local.get $line))

  ;; Return char index of the first character on line $line_num (0-based).
  (func $edit_line_index (param $state_w ptr<EditState>) (param $line_num i32) (result i32)
    (local $buf_w i32) (local $text_len i32) (local $i i32) (local $line i32)
    (local.set $buf_w (load.field EditState text_buf_ptr (local.get $state_w)))
    (if (i32.eqz (local.get $buf_w)) (then (return (i32.const 0))))
    (local.set $buf_w (call $g2w (local.get $buf_w)))
    (local.set $text_len (load.field.memarg EditState text_len (local.get $state_w)))
    (if (i32.eqz (local.get $line_num)) (then (return (i32.const 0))))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $text_len)))
      (if (i32.eq (i32.load8_u (i32.add (local.get $buf_w) (local.get $i))) (i32.const 0x0A))
        (then
          (local.set $line (i32.add (local.get $line) (i32.const 1)))
          (if (i32.eq (local.get $line) (local.get $line_num))
            (then (return (i32.add (local.get $i) (i32.const 1)))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (local.get $text_len))
