  ;; ============================================================
  ;; ComboBox WndProc  (control class 5)
  ;; ============================================================
  ;;
  ;; Real combobox: item storage delegates to an inner listbox child (class 4).
  ;; The listbox is created at WM_CREATE sized to fill (0, FIELD_H, w, h-FIELD_H)
  ;; — using the cy budget from the dialog template, which always reserves
  ;; enough height for the dropped state. Toggling the dropdown shows/hides
  ;; the listbox (via WS_VISIBLE).
  ;;
  ;; CBS_* variants (style & 0x3):
  ;;   1=CBS_SIMPLE       listbox is always WS_VISIBLE
  ;;   2=CBS_DROPDOWN     listbox toggled by click/F4/Alt+Down; field is editable
  ;;   3=CBS_DROPDOWNLIST listbox toggled, field shows selection (read-only)
  ;;
  ;; ComboBoxState (40 bytes, allocated in WM_CREATE)
  ;;   +0   text_buf_ptr   guest ptr to selected/typed item text
  ;;   +4   text_len
  ;;   +8   style          full window style
  ;;   +12  cur_sel        mirror of listbox cur_sel; -1 = none
  ;;   +16  lb_hwnd        inner listbox hwnd
  ;;   +20  popup_hwnd     reserved for future WS_POPUP escape (0 today)
  ;;   +24  edit_hwnd      CBS_DROPDOWN inner edit child; 0 for SIMPLE/DROPDOWNLIST
  ;;   +28  is_dropped     0/1 — CB_GETDROPPEDSTATE
  ;;   +32  variant        1=SIMPLE 2=DROPDOWN 3=DROPDOWNLIST
  ;;   +36  suppress_edit_notify — combo-originated edit WM_SETTEXT nesting
  ;; The control id is NOT in the record: $ctrl_table_get_id($hwnd).
  ;;
  ;; FIELD_H = 21 px; arrow box = 16 px wide on right edge.

  ;; ============================================================
  ;; ComboBox dropdown popup shell — class 9, WS_POPUP top-level.
  ;; Hosts the inner listbox child for CBS_DROPDOWN/DROPDOWNLIST.
  ;; Owns no state of its own; userdata stores the owner combobox hwnd
  ;; so messages can be forwarded back. Outside-click dismissal happens
  ;; here (combobox SetCapture's the popup). Inside clicks fall through
  ;; to the listbox child via normal hit-testing.
  ;;
  ;;   userdata = owner combo hwnd
  ;; ============================================================
  (func $combo_popup_wndproc (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $owner i32) (local $rect i32) (local $w i32) (local $h i32)
    (local $mx i32) (local $my i32) (local $sw i32) (local $lb i32)
    (local.set $owner (call $wnd_get_userdata (local.get $hwnd)))
    ;; WM_LBUTTONDOWN / WM_LBUTTONUP / WM_MOUSEMOVE / WM_LBUTTONDBLCLK:
    ;; outside-rect → ask owner combo to close as cancel; inside → forward
    ;; to inner listbox child (which lives at popup-local (0,0), so lParam
    ;; passes through unchanged). The listbox isn't a renderer-known
    ;; window, so the renderer can't deep-hit-test it — forwarding here
    ;; makes click-to-select work for CBS_DROPDOWNLIST popups.
    (if (i32.or
          (i32.or (i32.eq (local.get $msg) (i32.const 0x0201))   ;; WM_LBUTTONDOWN
                  (i32.eq (local.get $msg) (i32.const 0x0202)))  ;; WM_LBUTTONUP
          (i32.or (i32.eq (local.get $msg) (i32.const 0x0200))   ;; WM_MOUSEMOVE
                  (i32.eq (local.get $msg) (i32.const 0x0203)))) ;; WM_LBUTTONDBLCLK
      (then
        (local.set $mx (i32.shr_s (i32.shl (local.get $lParam) (i32.const 16)) (i32.const 16)))
        (local.set $my (i32.shr_s (local.get $lParam) (i32.const 16)))
        (local.set $rect (call $paint_scratch_take))
        (call $host_get_window_rect (local.get $hwnd) (local.get $rect))
        (local.set $w (i32.sub (load.field.memarg PaintRect right (local.get $rect))
                                (load.field PaintRect left (local.get $rect))))
        (local.set $h (i32.sub (load.field.memarg PaintRect bottom (local.get $rect))
                                (load.field.memarg PaintRect top (local.get $rect))))
        (if (i32.or
              (i32.or (i32.lt_s (local.get $mx) (i32.const 0))
                      (i32.lt_s (local.get $my) (i32.const 0)))
              (i32.or (i32.ge_s (local.get $mx) (local.get $w))
                      (i32.ge_s (local.get $my) (local.get $h))))
          (then
            ;; Outside rect: only LBUTTONDOWN dismisses the dropdown.
            ;; (UP/MOVE outside should be ignored, not trigger close.)
            (if (i32.eq (local.get $msg) (i32.const 0x0201))
              (then
                (if (local.get $owner)
                  (then (call $combobox_close_dropdown (local.get $owner) (i32.const 0))))))
            (return (i32.const 0))))
        ;; Inside: forward to listbox child (state offset +20).
        (if (local.get $owner)
          (then
            (local.set $sw (call $wnd_get_state_ptr (local.get $owner)))
            (if (local.get $sw)
              (then
                (local.set $lb (call $cb_lb_hwnd (call $g2w (local.get $sw))))
                (if (local.get $lb)
                  (then (drop (call $wnd_send_message (local.get $lb)
                                (local.get $msg) (local.get $wParam) (local.get $lParam)))))))))
        (return (i32.const 0))))
    ;; WM_COMMAND from inner listbox child — forward to owner combo so its
    ;; existing LBN_SELCHANGE / LBN_DBLCLK handling fires.
    (if (i32.eq (local.get $msg) (i32.const 0x0111))
      (then
        (if (local.get $owner)
          (then (return (call $wnd_send_message (local.get $owner)
                              (local.get $msg) (local.get $wParam) (local.get $lParam)))))
        (return (i32.const 0))))
    ;; WM_KEYDOWN: forward to owner combo (it already handles VK_ESC/RETURN/UP/DOWN).
    (if (i32.eq (local.get $msg) (i32.const 0x0100))
      (then
        (if (local.get $owner)
          (then (return (call $wnd_send_message (local.get $owner)
                              (local.get $msg) (local.get $wParam) (local.get $lParam)))))
        (return (i32.const 0))))
    ;; WM_MOUSEACTIVATE (0x0021): MA_NOACTIVATE. This shell is USER's
    ;; ComboLBox, which never takes activation (Wine listbox.c answers the
    ;; same for LBS_COMBOBOX); the inner list's own query reaches here through
    ;; the parent-first default. Activating the popup deactivated the owner
    ;; frame instead, and MFC answers that by closing its combo dropdowns:
    ;; Paint's font-size list shut under the press on its own scrollbar.
    (if (i32.eq (local.get $msg) (i32.const 0x0021))
      (then (return (i32.const 3))))
    ;; WM_CAPTURECHANGED (0x0215): popup lost capture → close as cancel.
    (if (i32.eq (local.get $msg) (i32.const 0x0215))
      (then
        (if (local.get $owner)
          (then (call $combobox_close_dropdown (local.get $owner) (i32.const 0))))
        (return (i32.const 0))))
    ;; All others: DefWindowProc (return 0).
    (i32.const 0)
  )

  ;; Allocate + register a WS_POPUP top-level dropdown shell owned by the
  ;; given combobox. Returns the popup hwnd. Created hidden — caller (or
  ;; $combobox_open_dropdown) ShowWindows it later. Userdata stores the
  ;; owner combo hwnd so $combo_popup_wndproc can forward messages back.
  (func $combo_create_popup (param $combo i32) (param $w i32) (param $h i32) (result i32)
    (local $popup i32) (local $slot i32)
    (local.set $popup (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    ;; Register a JS-side window record (no chrome — kind bit 2 = isPopup).
    (call $host_register_dialog_frame
      (local.get $popup) (local.get $combo)
      (i32.const 0)              ;; no title
      (local.get $w) (local.get $h)
      (i32.const 4))             ;; kind = 4 (isPopup)
    (call $wnd_table_set (local.get $popup) (global.get $WNDPROC_CTRL_NATIVE))
    ;; A dropdown list is a popup owned by the combo, not its child. Keeping
    ;; it in the child tree makes EnumChildWindows(dialog, ...) recurse into
    ;; USER's implementation detail. CD Player enumerates its dialog controls
    ;; into an ID-indexed array; the synthetic list ID then aliases button
    ;; 1000 and replaces the Play HWND after it was found correctly.
    (call $wnd_set_owner (local.get $popup) (local.get $combo))
    ;; WS_POPUP — explicitly hidden until open_dropdown shows it.
    (drop (call $wnd_set_style (local.get $popup) (i32.const 0x80000000)))
    (local.set $slot (call $wnd_table_find (local.get $popup)))
    (call $ctrl_table_set (local.get $slot) (i32.const 9) (i32.const 0))
    (drop (call $wnd_set_userdata (local.get $popup) (local.get $combo)))
    (local.get $popup))

  ;; Helper: open the dropdown (show inner listbox, fire CBN_DROPDOWN, set
  ;; capture so outside clicks dismiss). Idempotent.
  ;;
  ;; CBS_DROPDOWN/CBS_DROPDOWNLIST (variants 2/3): the listbox is migrated
  ;; under the pre-allocated WS_POPUP shell (offset=24) and the shell is
  ;; positioned in screen coords directly below the combo's field, then shown
  ;; via host_move_window(SWP_SHOWWINDOW). This lets the dropdown extend past
  ;; the parent dialog's clip rect — a real top-level window.
  (func $combobox_open_dropdown (param $hwnd i32)
    (local $state i32) (local $sw i32) (local $lb i32) (local $style i32) (local $parent i32)
    (local $popup i32) (local $rect i32) (local $lb_wh i32) (local $lb_w i32) (local $lb_h i32)
    (local.set $state (call $wnd_get_state_ptr (local.get $hwnd)))
    (if (i32.eqz (local.get $state)) (then (return)))
    (local.set $sw (call $g2w (local.get $state)))
    (if (call $cb_is_dropped (local.get $sw)) (then (return)))  ;; already dropped
    ;; Another combo already dropped on the same dialog? Close it (cancel) before
    ;; opening this one — Win32 only allows one expanded combo dropdown at a time.
    (if (i32.and
          (i32.ne (global.get $combo_open_hwnd) (i32.const 0))
          (i32.ne (global.get $combo_open_hwnd) (local.get $hwnd)))
      (then (call $combobox_close_dropdown (global.get $combo_open_hwnd) (i32.const 0))))
    (local.set $lb (call $cb_lb_hwnd (local.get $sw)))
    (if (i32.eqz (local.get $lb)) (then (return)))
    (local.set $popup (call $cb_popup_hwnd (local.get $sw)))
    ;; Dropdown variants with a pre-allocated popup: migrate listbox under popup,
    ;; position popup at combo screen pos + (0, FIELD_H), show it.
    (if (i32.and
          (i32.ne (call $cb_variant (local.get $sw)) (i32.const 1))
          (i32.ne (local.get $popup) (i32.const 0)))
      (then
        (local.set $lb_wh (call $ctrl_get_wh_packed (local.get $lb)))
        (local.set $lb_w (i32.and (local.get $lb_wh) (i32.const 0xFFFF)))
        (local.set $lb_h (i32.shr_u (local.get $lb_wh) (i32.const 16)))
        ;; Reparent listbox under popup (WAT side + renderer side).
        (call $wnd_set_parent (local.get $lb) (local.get $popup))
        (call $host_set_parent (local.get $lb) (local.get $popup))
        ;; Listbox is now top-left of popup interior.
        (call $ctrl_geom_set (call $wnd_table_find (local.get $lb))
          (i32.const 0) (i32.const 0) (local.get $lb_w) (local.get $lb_h))
        ;; Position popup directly below combo's field area in screen coords.
        (local.set $rect (call $paint_scratch_take))
        (call $host_get_window_rect (local.get $hwnd) (local.get $rect))
        (call $host_move_window (local.get $popup)
          (load.field PaintRect left (local.get $rect))           ;; left
          (i32.add (load.field.memarg PaintRect top (local.get $rect)) (i32.const 21)) ;; top + FIELD_H
          (local.get $lb_w) (local.get $lb_h)
          (i32.const 0x40))                               ;; SWP_SHOWWINDOW
        ;; host_move_window updates renderer geometry/visibility, while USER
        ;; effective-visibility checks read the WAT style. Keep both sides in
        ;; sync so the reparented listbox is eligible for WM_PAINT.
        (drop (call $wnd_set_style (local.get $popup)
          (i32.or (call $wnd_get_style (local.get $popup)) (i32.const 0x10000000))))))
    (local.set $style (call $wnd_get_style (local.get $lb)))
    (drop (call $wnd_set_style (local.get $lb) (i32.or (local.get $style) (i32.const 0x10000000))))
    (call $cb_set_is_dropped (local.get $sw) (i32.const 1))
    (global.set $combo_open_hwnd (local.get $hwnd))
    ;; Capture: prefer the popup so DOWN+UP both flow through
    ;; $combo_popup_wndproc, which forwards inside-rect events to the inner
    ;; listbox. Without this, UP gets routed via capture to the combo and
    ;; misses the listbox entirely. Falls back to combo for variants without
    ;; a popup shell (CBS_SIMPLE).
    (if (local.get $popup)
      (then  (global.set $capture_hwnd (local.get $popup)))
      (else  (global.set $capture_hwnd (local.get $hwnd))))
    ;; CBN_DROPDOWN(7) → parent
    (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
    (if (local.get $parent)
      (then (drop (call $wnd_send_message (local.get $parent) (i32.const 0x0111)
              (i32.or (i32.and (call $ctrl_table_get_id (local.get $hwnd)) (i32.const 0xFFFF))
                      (i32.shl (i32.const 7) (i32.const 16)))
              (local.get $hwnd)))))
    (call $invalidate_hwnd (local.get $hwnd))
    (call $invalidate_hwnd (local.get $lb)))

  ;; Helper: close the dropdown. $accept=1 fires CBN_SELENDOK; 0 → CBN_SELENDCANCEL.
  ;; Always fires CBN_CLOSEUP. Releases capture.
  (func $combobox_close_dropdown (param $hwnd i32) (param $accept i32)
    (local $state i32) (local $sw i32) (local $lb i32) (local $style i32)
    (local $parent i32) (local $ctrl_id i32) (local $notif i32)
    (local $popup i32) (local $lb_wh i32) (local $lb_w i32) (local $lb_h i32)
    (local.set $state (call $wnd_get_state_ptr (local.get $hwnd)))
    (if (i32.eqz (local.get $state)) (then (return)))
    (local.set $sw (call $g2w (local.get $state)))
    (if (i32.eqz (call $cb_is_dropped (local.get $sw))) (then (return)))  ;; not dropped
    (local.set $lb (call $cb_lb_hwnd (local.get $sw)))
    (local.set $popup (call $cb_popup_hwnd (local.get $sw)))
    ;; Dropdown variant with popup: reparent listbox back under combo, restore its
    ;; original geom (y=FIELD_H), and hide popup via SWP_HIDEWINDOW. Symmetric
    ;; with $combobox_open_dropdown.
    (if (i32.and
          (i32.ne (call $cb_variant (local.get $sw)) (i32.const 1))
          (i32.and (i32.ne (local.get $popup) (i32.const 0))
                   (i32.ne (local.get $lb) (i32.const 0))))
      (then
        (local.set $lb_wh (call $ctrl_get_wh_packed (local.get $lb)))
        (local.set $lb_w (i32.and (local.get $lb_wh) (i32.const 0xFFFF)))
        (local.set $lb_h (i32.shr_u (local.get $lb_wh) (i32.const 16)))
        (call $wnd_set_parent (local.get $lb) (local.get $hwnd))
        (call $host_set_parent (local.get $lb) (local.get $hwnd))
        (call $ctrl_geom_set (call $wnd_table_find (local.get $lb))
          (i32.const 0) (i32.const 21) (local.get $lb_w) (local.get $lb_h))
        (call $host_move_window (local.get $popup)
          (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)
          (i32.const 0x83))                               ;; SWP_NOMOVE|SWP_NOSIZE|SWP_HIDEWINDOW
        (drop (call $wnd_set_style (local.get $popup)
          (i32.and (call $wnd_get_style (local.get $popup)) (i32.const 0xEFFFFFFF))))))
    ;; Hide listbox (CBS_SIMPLE keeps it visible — variant=1 means "always open")
    (if (i32.ne (call $cb_variant (local.get $sw)) (i32.const 1))
      (then
        (if (local.get $lb)
          (then
            (local.set $style (call $wnd_get_style (local.get $lb)))
            (drop (call $wnd_set_style (local.get $lb)
                    (i32.and (local.get $style) (i32.const 0xEFFFFFFF))))))))
    (call $cb_set_is_dropped (local.get $sw) (i32.const 0))
    (if (i32.eq (global.get $combo_open_hwnd) (local.get $hwnd))
      (then (global.set $combo_open_hwnd (i32.const 0))))
    (if (i32.or (i32.eq (global.get $capture_hwnd) (local.get $hwnd))
                (i32.and (i32.ne (local.get $popup) (i32.const 0))
                         (i32.eq (global.get $capture_hwnd) (local.get $popup))))
      (then (global.set $capture_hwnd (i32.const 0))))
    (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
    (local.set $ctrl_id (i32.and (call $ctrl_table_get_id (local.get $hwnd)) (i32.const 0xFFFF)))
    (if (local.get $parent)
      (then
        ;; CBN_SELENDOK(9) or CBN_SELENDCANCEL(10) — POSTED, not sent.
        ;; Real Win32 sends these synchronously, but doing so here means
        ;; the row-pick click (which already runs nested under JS-driven
        ;; $wnd_send_message into our popup wndproc) recursively reenters
        ;; the dialog wndproc one frame deep. In pinball.exe specifically,
        ;; the dialog wndproc returns through a stack-pop sequence that
        ;; depends on x86 callee-save state established by its outer
        ;; PeekMessage caller — when reentered nested, the saved ESI on
        ;; the dialog's stack frame is the recursive-run scratch (0),
        ;; and after the wndproc's pop esi the outer pump calls esi=0
        ;; (EIP=0 freeze). Posting defers the notification to the next
        ;; PeekMessage iteration, where the dialog wndproc runs as a
        ;; first-class dispatch instead of nested-reentry.
        (local.set $notif (select (i32.const 9) (i32.const 10) (local.get $accept)))
        (drop (call $post_queue_push (local.get $parent) (i32.const 0x0111)
                (i32.or (local.get $ctrl_id) (i32.shl (local.get $notif) (i32.const 16)))
                (local.get $hwnd)))
        ;; CBN_CLOSEUP(8) — also posted for the same reason.
        (drop (call $post_queue_push (local.get $parent) (i32.const 0x0111)
                (i32.or (local.get $ctrl_id) (i32.shl (i32.const 8) (i32.const 16)))
                (local.get $hwnd)))))
    (call $invalidate_hwnd (local.get $hwnd))
    ;; The inner listbox was painted into the parent's back-canvas while
    ;; visible; hiding it via WS_VISIBLE removal stops future paints but
    ;; leaves stale dropdown pixels on the canvas. Repaint the parent
    ;; (dialog) AND every sibling so the gray background reappears under
    ;; the dropdown area and other controls (labels, buttons, other combos)
    ;; aren't left as gaps. The renderer doesn't cascade parent → children
    ;; on its own — child paint flags are tracked per-slot.
    (if (local.get $parent)
      (then
        (call $invalidate_hwnd (local.get $parent))
        (call $combobox_invalidate_siblings (local.get $parent) (local.get $hwnd)))))

  ;; Mark every direct child of $parent (including $hwnd, harmless) as
  ;; needing WM_PAINT, so closing a dropdown doesn't leave the dialog's
  ;; other controls unpainted after the parent's background re-erase.
  (func $combobox_invalidate_siblings (param $parent i32) (param $hwnd i32)
    (local $slot i32) (local $ch i32)
    (local.set $slot (i32.const 0))
    (block $done (loop $walk
      (local.set $slot (call $wnd_next_child_slot (local.get $parent) (local.get $slot)))
      (br_if $done (i32.eq (local.get $slot) (i32.const -1)))
      (local.set $ch (call $wnd_slot_hwnd (local.get $slot)))
      (if (local.get $ch)
        (then (call $paint_flag_set_inv (local.get $ch))))
      (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
      (br $walk))))

  ;; Helper: copy the inner listbox's selected item text into combobox text_buf.
  ;; Called after CB_SETCURSEL or LBN_SELCHANGE so WM_GETTEXT returns the right thing.
  ;; CBS_DROPDOWN has a real inner EDIT, which owns the visible field text, so
  ;; keep that child synchronized with the same selection as well.
  (func $combobox_sync_text (param $sw i32)
    (local $lb i32) (local $sel i32) (local $buf_g i32) (local $slen i32)
    (local.set $lb (call $cb_lb_hwnd (local.get $sw)))
    (if (i32.eqz (local.get $lb)) (then (return)))
    (local.set $sel (call $wnd_send_message (local.get $lb) (i32.const 0x0188) (i32.const 0) (i32.const 0)))
    (call $cb_set_cur_sel (local.get $sw) (local.get $sel))
    ;; Free old text_buf
    (call $heap_free (call $cb_text_ptr (local.get $sw)))
    (call $cb_set_text_ptr (local.get $sw) (i32.const 0))
    (call $cb_set_text_len (local.get $sw) (i32.const 0))
    (if (i32.lt_s (local.get $sel) (i32.const 0))
      (then
        (if (i32.and
              (i32.eq (call $cb_variant (local.get $sw)) (i32.const 2))
              (i32.ne (call $cb_edit_hwnd (local.get $sw)) (i32.const 0)))
          (then
            (call $cb_set_suppress_edit_notify (local.get $sw) (i32.const 1))
            (drop (call $wnd_send_message
              (call $cb_edit_hwnd (local.get $sw))
              (i32.const 0x000C) (i32.const 0) (i32.const 0)))
            (call $cb_set_suppress_edit_notify (local.get $sw) (i32.const 0))))
        (return)))
    ;; Get LB_GETTEXTLEN, alloc buf, LB_GETTEXT into it, store.
    (local.set $slen (call $wnd_send_message (local.get $lb) (i32.const 0x018A) (local.get $sel) (i32.const 0)))
    (if (i32.lt_s (local.get $slen) (i32.const 0)) (then (return)))
    (local.set $buf_g (call $heap_alloc (i32.add (local.get $slen) (i32.const 1))))
    (drop (call $wnd_send_message (local.get $lb) (i32.const 0x0189) (local.get $sel) (local.get $buf_g)))
    (call $cb_set_text_ptr (local.get $sw) (local.get $buf_g))
    (call $cb_set_text_len (local.get $sw) (local.get $slen))
    (if (i32.and
          (i32.eq (call $cb_variant (local.get $sw)) (i32.const 2))
          (i32.ne (call $cb_edit_hwnd (local.get $sw)) (i32.const 0)))
      (then
        (call $cb_set_suppress_edit_notify (local.get $sw) (i32.const 1))
        (drop (call $wnd_send_message
          (call $cb_edit_hwnd (local.get $sw))
          (i32.const 0x000C) (i32.const 0) (local.get $buf_g)))
        (call $cb_set_suppress_edit_notify (local.get $sw) (i32.const 0)))))

  (func $combobox_wndproc (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $state i32) (local $state_w i32) (local $cs_w i32)
    (local $hdc i32) (local $sz i32) (local $w i32) (local $h i32)
    (local $name_ptr i32) (local $text_len i32)
    (local $idx i32) (local $slen i32) (local $count i32)
    (local $arrow_x i32) (local $variant i32) (local $lb i32)
    (local $style i32) (local $cy i32) (local $cmd i32) (local $notif i32)
    (local $parent i32) (local $ctrl_id i32) (local $field_h i32)
    (local $px i32) (local $py i32)
    (local $scan_slot i32) (local $sibling_hwnd i32)
    (local $combo_max_x i32) (local $sibling_right i32)
    (local $paint_state_w ptr<ControlTextState>) (local $edit_text_w ptr<ControlTextState>)
    (local $paint_state_g i32)
    (local $prev_lb i32) (local $prev_edit i32) (local $prev_popup i32)

    (local.set $field_h (i32.const 21))
    (local.set $state (call $wnd_get_state_ptr (local.get $hwnd)))

    ;; ---------- WM_WINDOWPOSCHANGING (0x0046) ----------
    ;; A drop-down combo's window is only ever the closed field: the cy an app
    ;; passes to MoveWindow/SetWindowPos is the *dropped* extent, exactly as
    ;; at CreateWindowEx. Windows takes that height for the list and rewrites
    ;; the WINDOWPOS to the field height here. Without this, a combo laid out
    ;; after creation (SimCity 2000 Net's chat recipient list) grows to its
    ;; dropped height, and every sibling the app placed below the field in
    ;; the belief that the combo is 21 tall sits underneath it.
    (if (i32.eq (local.get $msg) (i32.const 0x0046))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (if (i32.eq (call $cb_variant (local.get $state_w)) (i32.const 1))
          (then (return (i32.const 0))))
        (if (i32.and (call $gl32 (i32.add (local.get $lParam) (i32.const 24))) (i32.const 1))
          (then (return (i32.const 0))))  ;; SWP_NOSIZE
        (local.set $cy (call $gl32 (i32.add (local.get $lParam) (i32.const 20))))
        (if (i32.le_s (local.get $cy) (local.get $field_h)) (then (return (i32.const 0))))
        (local.set $lb (call $cb_lb_hwnd (local.get $state_w)))
        (if (local.get $lb)
          (then
            (local.set $idx (call $wnd_table_find (local.get $lb)))
            (if (i32.ge_s (local.get $idx) (i32.const 0))
              (then
                (local.set $sz (call $ctrl_get_xy_packed (local.get $lb)))
                (call $ctrl_geom_set (local.get $idx)
                  (i32.and (local.get $sz) (i32.const 0xFFFF))
                  (i32.shr_u (local.get $sz) (i32.const 16))
                  (call $gl32 (i32.add (local.get $lParam) (i32.const 16)))
                  (select (i32.sub (local.get $cy) (local.get $field_h)) (i32.const 64)
                    (i32.ge_s (i32.sub (local.get $cy) (local.get $field_h)) (i32.const 32))))))))
        (call $gs32 (i32.add (local.get $lParam) (i32.const 20)) (local.get $field_h))
        (return (i32.const 0))))

    ;; ---------- WM_CREATE ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0001))
      (then
        (local.set $cs_w (call $g2w (local.get $lParam)))
        (local.set $name_ptr (i32.load offset=36 (local.get $cs_w)))
        (local.set $style (i32.load offset=32 (local.get $cs_w)))
        (local.set $variant (i32.and (local.get $style) (i32.const 0x3)))
        (if (i32.eqz (local.get $variant)) (then (local.set $variant (i32.const 3))))
        ;; A toolbar-hosted combo can be sent WM_CREATE a second time (MFC
        ;; creates it 288 wide, then the toolbar lays it out again). The old
        ;; state block is still on $hwnd here, so carry its children across:
        ;; creating a second inner EDIT left the first one orphaned at the
        ;; original width, painting white over the drop arrow it no longer
        ;; had room for.
        (if (local.get $state)
          (then
            (local.set $prev_lb
              (call $cb_lb_hwnd (call $g2w (local.get $state))))
            (local.set $prev_popup
              (call $cb_popup_hwnd (call $g2w (local.get $state))))
            (local.set $prev_edit
              (call $cb_edit_hwnd (call $g2w (local.get $state))))))
        (local.set $state (call $heap_alloc (i32.const 40)))
        (local.set $state_w (call $g2w (local.get $state)))
        (call $cb_set_text_ptr (local.get $state_w) (i32.const 0))
        (call $cb_set_text_len (local.get $state_w) (i32.const 0))
        (call $cb_set_style (local.get $state_w) (local.get $style))
        ;; CREATESTRUCT.hMenu is not copied in: it is already CONTROL_TABLE+4.
        ;; Readers mask it to 16 bits at the point of use, where the WM_COMMAND
        ;; wParam packing needs that, rather than truncating the stored id.
        (call $cb_set_cur_sel (local.get $state_w) (i32.const -1))
        (call $cb_set_lb_hwnd (local.get $state_w) (local.get $prev_lb))
        (call $cb_set_popup_hwnd (local.get $state_w) (local.get $prev_popup))
        (call $cb_set_edit_hwnd (local.get $state_w) (local.get $prev_edit))
        (call $cb_set_is_dropped (local.get $state_w) (i32.const 0))
        (call $cb_set_variant (local.get $state_w) (local.get $variant))
        (call $cb_set_suppress_edit_notify (local.get $state_w) (i32.const 0))
        (if (local.get $name_ptr)
          (then
            (local.set $text_len (call $strlen (call $g2w (local.get $name_ptr))))
            (call $cb_set_text_ptr (local.get $state_w)
              (call $ctrl_text_dup (local.get $name_ptr) (local.get $text_len)))
            (call $cb_set_text_len (local.get $state_w) (local.get $text_len))))
        (call $wnd_set_state_ptr (local.get $hwnd) (local.get $state))
        ;; Create inner listbox child filling the dropped area. Geometry from
        ;; CREATESTRUCT: cx at +20, cy at +16. Listbox is at (0, FIELD_H, cx, cy-FIELD_H).
        ;; CBS_SIMPLE keeps it always visible; others start hidden.
        (local.set $w (i32.load offset=20 (local.get $cs_w)))
        (local.set $cy (i32.load offset=16 (local.get $cs_w)))
        (local.set $h (i32.sub (local.get $cy) (local.get $field_h)))
        (if (i32.lt_s (local.get $h) (i32.const 32))
          (then (local.set $h (i32.const 64)))) ;; minimum sensible dropdown
        ;; Listbox style: WS_CHILD(0x40000000) | WS_VSCROLL(0x00200000) | WS_BORDER(0x00800000)
        ;; + WS_VISIBLE(0x10000000) only for CBS_SIMPLE.
        (local.set $style (i32.const 0x40A00000))
        (if (i32.eq (local.get $variant) (i32.const 1))
          (then (local.set $style (i32.or (local.get $style) (i32.const 0x10000000)))))
        (if (local.get $prev_lb)
          (then (local.set $lb (local.get $prev_lb)))
          (else
        (local.set $lb (call $ctrl_create_child (local.get $hwnd) (i32.const 4)
                          (i32.const 1000) ;; synthetic ctrl_id for inner listbox
                          (i32.const 0)
                          (select (i32.const 0) (local.get $field_h) (i32.eq (local.get $variant) (i32.const 1)))
                          (local.get $w)
                          (select (local.get $cy) (local.get $h) (i32.eq (local.get $variant) (i32.const 1)))
                          (local.get $style) (i32.const 0)))))
        (call $cb_set_lb_hwnd (local.get $state_w) (local.get $lb))
        ;; CBS_SIMPLE: always-dropped state.
        (if (i32.eq (local.get $variant) (i32.const 1))
          (then (call $cb_set_is_dropped (local.get $state_w) (i32.const 1))))
        ;; CBS_DROPDOWN (variant=2): create EDIT child filling the field
        ;; area minus the arrow box (18px wide on right). Style: WS_CHILD |
        ;; WS_VISIBLE | ES_AUTOHSCROLL(0x80). Field width = w - 18 to leave
        ;; room for the arrow.
        (if (i32.and (i32.eq (local.get $variant) (i32.const 2))
                     (i32.eqz (local.get $prev_edit)))
          (then
            (call $cb_set_edit_hwnd (local.get $state_w)
              (call $ctrl_create_child (local.get $hwnd) (i32.const 2)
                (i32.const 1001) ;; synthetic ctrl_id for inner edit
                (i32.const 2) (i32.const 2)
                (i32.sub (local.get $w) (i32.const 20))
                (i32.sub (local.get $field_h) (i32.const 4))
                (i32.const 0x50000080)  ;; WS_CHILD|WS_VISIBLE|ES_AUTOHSCROLL
                (i32.load offset=36 (local.get $cs_w)))))) ;; pass initial title
        ;; Dropdown variants (2/3): pre-allocate a WS_POPUP shell sized to the
        ;; listbox area. Hidden until $combobox_open_dropdown shows it. Put the
        ;; listbox under that popup immediately so it never appears among the
        ;; dialog's EnumChildWindows descendants before the first drop.
        (if (i32.and (i32.ne (local.get $variant) (i32.const 1))
                     (i32.eqz (local.get $prev_popup)))
          (then
            (call $cb_set_popup_hwnd (local.get $state_w)
              (call $combo_create_popup (local.get $hwnd) (local.get $w) (local.get $h)))
            (call $wnd_set_parent
              (local.get $lb) (call $cb_popup_hwnd (local.get $state_w)))
            (call $host_set_parent
              (local.get $lb) (call $cb_popup_hwnd (local.get $state_w)))
            (call $ctrl_geom_set (call $wnd_table_find (local.get $lb))
              (i32.const 0) (i32.const 0) (local.get $w) (local.get $h))))
        ;; MFC toolbar-hosted combo boxes are often created at (0,0) and then
        ;; left for common-control layout to position. Keep additional direct
        ;; COMBOBOX children of the same ToolbarWindow32 from covering the
        ;; first combo field when no explicit move has arrived yet.
        (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
        (if (i32.and
              (i32.and
                (i32.eq (call $ctrl_table_get_class (local.get $parent)) (i32.const 21))
                (i32.eq (call $ctrl_get_x_s (local.get $hwnd)) (i32.const 0)))
              (i32.eq (call $ctrl_get_y_s (local.get $hwnd)) (i32.const 0)))
          (then
            (local.set $scan_slot (i32.const 0))
            (local.set $combo_max_x (i32.const 0))
            (block $combo_scan_done (loop $combo_scan
              (local.set $scan_slot
                (call $wnd_next_child_slot (local.get $parent) (local.get $scan_slot)))
              (br_if $combo_scan_done (i32.lt_s (local.get $scan_slot) (i32.const 0)))
              (local.set $sibling_hwnd (call $wnd_slot_hwnd (local.get $scan_slot)))
              (if (i32.and
                    (i32.ne (local.get $sibling_hwnd) (local.get $hwnd))
                    (i32.eq (call $ctrl_table_get_class (local.get $sibling_hwnd)) (i32.const 5)))
                (then
                  (local.set $sibling_right
                    (i32.add
                      (i32.add
                        (call $ctrl_get_x_s (local.get $sibling_hwnd))
                        (i32.and
                          (call $ctrl_get_wh_packed (local.get $sibling_hwnd))
                          (i32.const 0xFFFF)))
                      (i32.const 4)))
                  (if (i32.gt_s (local.get $sibling_right) (local.get $combo_max_x))
                    (then (local.set $combo_max_x (local.get $sibling_right))))))
              (local.set $scan_slot (i32.add (local.get $scan_slot) (i32.const 1)))
              (br $combo_scan)))
            (if (i32.gt_s (local.get $combo_max_x) (i32.const 0))
              (then
                (call $host_move_window
                  (local.get $hwnd)
                  (local.get $combo_max_x)
                  (i32.const 0)
                  (local.get $w)
                  (local.get $cy)
                  (i32.const 0))
                (call $ctrl_geom_sync
                  (local.get $hwnd)
                  (local.get $combo_max_x)
                  (i32.const 0)
                  (local.get $w)
                  (local.get $field_h)
                  (i32.const 0))
                (call $defwndproc_do_nccalcsize (local.get $hwnd))))))
        (return (i32.const 0))))

    ;; ---------- WM_DESTROY ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0002))
      (then
        (if (local.get $state)
          (then
            (local.set $state_w (call $g2w (local.get $state)))
            ;; A dropdown's listbox belongs to the top-level popup from
            ;; creation until the first close reparents it to the combo.  The
            ;; dialog's child walk therefore cannot assume it already removed
            ;; that listbox.  Destroy the owned popup as a real window subtree:
            ;; this reaches a never-opened listbox, sends the normal destroy
            ;; messages, and removes both guest and renderer window records.
            (if (call $cb_popup_hwnd (local.get $state_w))
              (then (call $wnd_destroy_recursive
                (call $cb_popup_hwnd (local.get $state_w)))))
            (call $heap_free (call $cb_text_ptr (local.get $state_w)))
            (call $heap_free (local.get $state))
            (call $wnd_set_state_ptr (local.get $hwnd) (i32.const 0))))
        (if (i32.eq (global.get $combo_open_hwnd) (local.get $hwnd))
          (then (global.set $combo_open_hwnd (i32.const 0))))
        (return (i32.const 0))))

    (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
    (local.set $state_w (call $g2w (local.get $state)))
    (local.set $variant (call $cb_variant (local.get $state_w)))
    (local.set $lb      (call $cb_lb_hwnd (local.get $state_w)))

    ;; ---------- WM_SETTEXT ----------
    ;; CBS_DROPDOWN (variant=2): forward to inner edit; the edit owns the text.
    (if (i32.eq (local.get $msg) (i32.const 0x000C))
      (then
        (if (i32.eq (local.get $variant) (i32.const 2))
          (then
            ;; WordPad converts RichEdit 2.0's empty-document 32767-twip
            ;; sentinel to literal point-size text "1638.5". Normalize that
            ;; exact value only in its toolbar size combo (control id 166).
            (if (i32.and
                  (i32.eq (i32.and (call $ctrl_table_get_id (local.get $hwnd)) (i32.const 0xFFFF)) (i32.const 166))
                  (i32.and
                    (i32.eq (call $strlen (call $g2w (local.get $lParam))) (i32.const 6))
                    (i32.and
                      (i32.eq (i32.load (call $g2w (local.get $lParam))) (i32.const 0x38333631))
                      (i32.eq (i32.load16_u offset=4 (call $g2w (local.get $lParam))) (i32.const 0x352E)))))
              (then
                (local.set $name_ptr (call $heap_alloc (i32.const 3)))
                (i32.store16 (call $g2w (local.get $name_ptr)) (i32.const 0x3031))
                (i32.store8 offset=2 (call $g2w (local.get $name_ptr)) (i32.const 0))
                (call $cb_set_suppress_edit_notify (local.get $state_w) (i32.const 1))
                (local.set $idx (call $wnd_send_message
                  (call $cb_edit_hwnd (local.get $state_w))
                  (i32.const 0x000C) (local.get $wParam) (local.get $name_ptr)))
                (call $cb_set_suppress_edit_notify (local.get $state_w) (i32.const 0))
                (call $heap_free (local.get $name_ptr))
                (return (local.get $idx))))
            (call $cb_set_suppress_edit_notify (local.get $state_w) (i32.const 1))
            (local.set $idx (call $wnd_send_message
              (call $cb_edit_hwnd (local.get $state_w))
              (i32.const 0x000C) (local.get $wParam) (local.get $lParam)))
            (call $cb_set_suppress_edit_notify (local.get $state_w) (i32.const 0))
            (return (local.get $idx))))
        (call $heap_free (call $cb_text_ptr (local.get $state_w)))
        (call $cb_set_text_ptr (local.get $state_w) (i32.const 0))
        (call $cb_set_text_len (local.get $state_w) (i32.const 0))
        (if (local.get $lParam)
          (then
            (local.set $text_len (call $strlen (call $g2w (local.get $lParam))))
            (call $cb_set_text_ptr (local.get $state_w)
              (call $ctrl_text_dup (local.get $lParam) (local.get $text_len)))
            (call $cb_set_text_len (local.get $state_w) (local.get $text_len))))
        (call $invalidate_hwnd (local.get $hwnd))
        (if (call $wnd_is_effectively_visible (local.get $hwnd))
          (then
            (drop (call $edit_wndproc
              (local.get $hwnd) (i32.const 0x000F)
              (i32.const 0) (i32.const 0)))
            (call $update_clear_hwnd (local.get $hwnd))
            (call $paint_flag_clear_hwnd (local.get $hwnd))))
        (return (i32.const 1))))

    ;; ---------- WM_GETTEXT ----------
    (if (i32.eq (local.get $msg) (i32.const 0x000D))
      (then
        (if (i32.eq (local.get $variant) (i32.const 2))
          (then (return (call $wnd_send_message
                          (call $cb_edit_hwnd (local.get $state_w))
                          (i32.const 0x000D) (local.get $wParam) (local.get $lParam)))))
        (if (i32.eqz (local.get $wParam)) (then (return (i32.const 0))))
        (local.set $text_len (call $cb_text_len (local.get $state_w)))
        (if (i32.ge_u (local.get $text_len) (local.get $wParam))
          (then (local.set $text_len (i32.sub (local.get $wParam) (i32.const 1)))))
        (if (call $cb_text_ptr (local.get $state_w))
          (then (if (local.get $text_len)
                  (then (call $memcpy (call $g2w (local.get $lParam))
                                      (call $g2w (call $cb_text_ptr (local.get $state_w)))
                                      (local.get $text_len))))))
        (i32.store8 (i32.add (call $g2w (local.get $lParam)) (local.get $text_len)) (i32.const 0))
        (return (local.get $text_len))))

    ;; ---------- WM_GETTEXTLENGTH ----------
    (if (i32.eq (local.get $msg) (i32.const 0x000E))
      (then
        (if (i32.eq (local.get $variant) (i32.const 2))
          (then (return (call $wnd_send_message
                          (call $cb_edit_hwnd (local.get $state_w))
                          (i32.const 0x000E) (i32.const 0) (i32.const 0)))))
        (return (call $cb_text_len (local.get $state_w)))))

    ;; ---------- WM_SETFOCUS (0x0007) — fire CBN_SETFOCUS(3) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0007))
      (then
        (global.set $focus_hwnd (local.get $hwnd))
        (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
        (if (local.get $parent)
          (then (drop (call $wnd_send_message (local.get $parent) (i32.const 0x0111)
                  (i32.or (i32.and (call $ctrl_table_get_id (local.get $hwnd)) (i32.const 0xFFFF))
                          (i32.shl (i32.const 3) (i32.const 16)))
                  (local.get $hwnd)))))
        (return (i32.const 0))))

    ;; ---------- WM_KILLFOCUS (0x0008) — close dropdown + fire CBN_KILLFOCUS(4) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0008))
      (then
        (if (call $cb_is_dropped (local.get $state_w))
          (then (call $combobox_close_dropdown (local.get $hwnd) (i32.const 0))))
        (if (i32.eq (global.get $focus_hwnd) (local.get $hwnd))
          (then (global.set $focus_hwnd (i32.const 0))))
        (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
        (if (local.get $parent)
          (then (drop (call $wnd_send_message (local.get $parent) (i32.const 0x0111)
                  (i32.or (i32.and (call $ctrl_table_get_id (local.get $hwnd)) (i32.const 0xFFFF))
                          (i32.shl (i32.const 4) (i32.const 16)))
                  (local.get $hwnd)))))
        (return (i32.const 0))))

    ;; ---------- CB_RESETCONTENT (0x014B) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x014B))
      (then
        (if (local.get $lb)
          (then (drop (call $wnd_send_message (local.get $lb) (i32.const 0x0184) (i32.const 0) (i32.const 0)))))
        (call $cb_set_cur_sel (local.get $state_w) (i32.const -1))
        (call $heap_free (call $cb_text_ptr (local.get $state_w)))
        (call $cb_set_text_ptr (local.get $state_w) (i32.const 0))
        (call $cb_set_text_len (local.get $state_w) (i32.const 0))
        (if (i32.and
              (i32.eq (local.get $variant) (i32.const 2))
              (i32.ne (call $cb_edit_hwnd (local.get $state_w)) (i32.const 0)))
          (then (drop (call $wnd_send_message
            (call $cb_edit_hwnd (local.get $state_w))
            (i32.const 0x000C) (i32.const 0) (i32.const 0)))))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.const 0))))

    ;; ---------- CB_GETCOUNT (0x0146) — forward to listbox LB_GETCOUNT (0x018B) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0146))
      (then (return (call $wnd_send_message (local.get $lb) (i32.const 0x018B) (i32.const 0) (i32.const 0)))))

    ;; ---------- CB_GETCURSEL (0x0147) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0147))
      (then (return (call $cb_cur_sel (local.get $state_w)))))

    ;; ---------- CB_ADDSTRING (0x0143) → LB_ADDSTRING (0x0180) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0143))
      (then (return (call $wnd_send_message (local.get $lb) (i32.const 0x0180) (i32.const 0) (local.get $lParam)))))

    ;; ---------- CB_INSERTSTRING (0x014A) → LB_INSERTSTRING (0x0181) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x014A))
      (then (return (call $wnd_send_message (local.get $lb) (i32.const 0x0181) (local.get $wParam) (local.get $lParam)))))

    ;; ---------- CB_DELETESTRING (0x0144) → LB_DELETESTRING (0x0182) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0144))
      (then (return (call $wnd_send_message (local.get $lb) (i32.const 0x0182) (local.get $wParam) (i32.const 0)))))

    ;; ---------- CB_FINDSTRING (0x014C) / CB_FINDSTRINGEXACT (0x0158) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x014C))
      (then (return (call $wnd_send_message (local.get $lb) (i32.const 0x018F) (local.get $wParam) (local.get $lParam)))))
    (if (i32.eq (local.get $msg) (i32.const 0x0158))
      (then (return (call $wnd_send_message (local.get $lb) (i32.const 0x01A2) (local.get $wParam) (local.get $lParam)))))

    ;; ---------- CB_SELECTSTRING (0x014D) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x014D))
      (then
        (local.set $idx (call $wnd_send_message (local.get $lb) (i32.const 0x018C) (local.get $wParam) (local.get $lParam)))
        (if (i32.ge_s (local.get $idx) (i32.const 0))
          (then (call $combobox_sync_text (local.get $state_w))
                (call $invalidate_hwnd (local.get $hwnd))))
        (return (local.get $idx))))

    ;; ---------- CB_GETLBTEXT (0x0148) → LB_GETTEXT (0x0189) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0148))
      (then (return (call $wnd_send_message (local.get $lb) (i32.const 0x0189) (local.get $wParam) (local.get $lParam)))))

    ;; ---------- CB_GETLBTEXTLEN (0x0149) → LB_GETTEXTLEN (0x018A) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0149))
      (then (return (call $wnd_send_message (local.get $lb) (i32.const 0x018A) (local.get $wParam) (i32.const 0)))))

    ;; ---------- CB_SETCURSEL (0x014E) → LB_SETCURSEL + sync text ----------
    (if (i32.eq (local.get $msg) (i32.const 0x014E))
      (then
        (drop (call $wnd_send_message (local.get $lb) (i32.const 0x0186) (local.get $wParam) (i32.const 0)))
        (call $combobox_sync_text (local.get $state_w))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (local.get $wParam))))

    ;; ---------- CB_GETDROPPEDSTATE (0x0157) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0157))
      (then (return (call $cb_is_dropped (local.get $state_w)))))

    ;; ---------- CB_SHOWDROPDOWN (0x014F) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x014F))
      (then
        (if (local.get $wParam)
          (then (call $combobox_open_dropdown (local.get $hwnd)))
          (else (call $combobox_close_dropdown (local.get $hwnd) (i32.const 0))))
        (return (i32.const 1))))

    ;; ---------- CB_GETDROPPEDCONTROLRECT (0x0152) ----------
    ;; lParam = guest RECT* (filled with screen coords of dropped popup area).
    ;; Our dropdown is in-rect: report the listbox's rect translated to screen coords.
    ;; For simplicity, compute (0, FIELD_H, w, full_h) in window-local coords; caller
    ;; can translate via ClientToScreen. (Real Win32 returns screen coords; many apps
    ;; only check w/h though.)
    (if (i32.eq (local.get $msg) (i32.const 0x0152))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
        (local.set $w (i32.and (local.get $sz) (i32.const 0xFFFF)))
        (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
        (i32.store          (call $g2w (local.get $lParam)) (i32.const 0))
        (i32.store offset=4 (call $g2w (local.get $lParam)) (local.get $field_h))
        (i32.store offset=8 (call $g2w (local.get $lParam)) (local.get $w))
        (i32.store offset=12 (call $g2w (local.get $lParam)) (local.get $h))
        (return (i32.const 1))))

    ;; ---------- CB_LIMITTEXT (0x0141) → EM_SETLIMITTEXT (0x00C5) ----------
    ;; Only meaningful for CBS_DROPDOWN; CBS_DROPDOWNLIST/SIMPLE return TRUE no-op.
    (if (i32.eq (local.get $msg) (i32.const 0x0141))
      (then
        (if (i32.eq (local.get $variant) (i32.const 2))
          (then (drop (call $wnd_send_message
                        (call $cb_edit_hwnd (local.get $state_w))
                        (i32.const 0x00C5) (local.get $wParam) (i32.const 0)))))
        (return (i32.const 1))))

    ;; ---------- CB_GETEDITSEL (0x0140) → EM_GETSEL (0x00B0) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0140))
      (then
        (if (i32.eq (local.get $variant) (i32.const 2))
          (then (return (call $wnd_send_message
                          (call $cb_edit_hwnd (local.get $state_w))
                          (i32.const 0x00B0) (local.get $wParam) (local.get $lParam)))))
        (return (i32.const 0))))

    ;; ---------- CB_SETEDITSEL (0x0142) → EM_SETSEL (0x00B1) ----------
    ;; Win32: lParam packs (start | end<<16); EM_SETSEL takes wParam=start, lParam=end.
    (if (i32.eq (local.get $msg) (i32.const 0x0142))
      (then
        (if (i32.eq (local.get $variant) (i32.const 2))
          (then (return (call $wnd_send_message
                          (call $cb_edit_hwnd (local.get $state_w))
                          (i32.const 0x00B1)
                          (i32.and (local.get $lParam) (i32.const 0xFFFF))
                          (i32.shr_u (local.get $lParam) (i32.const 16))))))
        (return (i32.const 0))))

    ;; ---------- CB_SETEXTENDEDUI / CB_GETEXTENDEDUI ----------
    ;; Stash in a high bit of the stored style word — see $cb_set_extended_ui.
    (if (i32.eq (local.get $msg) (i32.const 0x0155))
      (then
        (call $cb_set_extended_ui (local.get $state_w) (local.get $wParam))
        (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0156))
      (then (return (call $cb_extended_ui (local.get $state_w)))))

    ;; ---------- CB_GETITEMDATA (0x0150) → LB_GETITEMDATA (0x0199) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0150))
      (then (return (call $wnd_send_message (local.get $lb) (i32.const 0x0199) (local.get $wParam) (i32.const 0)))))
    ;; ---------- CB_SETITEMDATA (0x0151) → LB_SETITEMDATA (0x019A) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0151))
      (then (return (call $wnd_send_message (local.get $lb) (i32.const 0x019A) (local.get $wParam) (local.get $lParam)))))

    ;; ---------- CB_SETITEMHEIGHT / CB_GETITEMHEIGHT ----------
    ;; WordPad's MFC toolbar combo setup adjusts the editable field/item
    ;; height once the CComboBox wrapper is attached. We keep a fixed Win98-ish
    ;; field height for now, but report success/height so setup can continue.
    (if (i32.eq (local.get $msg) (i32.const 0x0153))
      (then (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0154))
      (then
        (return
          (select
            (local.get $field_h)
            (i32.const 16)
            (i32.eq (local.get $wParam) (i32.const -1))))))

    ;; ---------- CB_DIR / ownerdraw paths ----------
    ;; Fail-fast (memory: feedback_fail_fast_stubs).
    (if (i32.eq (local.get $msg) (i32.const 0x0145))   ;; CB_DIR
      (then (call $crash_unimplemented (i32.const 0x100))))

    ;; ---------- WM_LBUTTONDOWN (0x0201) — toggle dropdown ----------
    ;; While dropped with capture, lParam is in our window-local coords. We
    ;; only swallow clicks on the field; clicks below FIELD_H land on the
    ;; child listbox via z-order routing (or, when dropped with capture,
    ;; we route them to the listbox manually).
    (if (i32.eq (local.get $msg) (i32.const 0x0201))
      (then
        (local.set $px (i32.shr_s (i32.shl (local.get $lParam) (i32.const 16)) (i32.const 16)))
        (local.set $py (i32.shr_s (local.get $lParam) (i32.const 16)))
        (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
        (local.set $w (i32.and (local.get $sz) (i32.const 0xFFFF)))
        ;; If dropped, click below field area → forward to listbox in lb-local coords.
        (if (call $cb_is_dropped (local.get $state_w))
          (then
            (if (i32.ge_s (local.get $py) (local.get $field_h))
              (then
                (if (i32.and
                      (i32.ge_s (local.get $px) (i32.const 0))
                      (i32.lt_s (local.get $px) (local.get $w)))
                  (then
                    (drop (call $wnd_send_message (local.get $lb) (i32.const 0x0201)
                            (local.get $wParam)
                            (i32.or (i32.and (local.get $px) (i32.const 0xFFFF))
                                    (i32.shl (i32.sub (local.get $py) (local.get $field_h)) (i32.const 16)))))
                    ;; Real Windows: clicking an item in the dropdown selects it
                    ;; AND closes the dropdown (accept). The listbox already
                    ;; updated cur_sel and fired LBN_SELCHANGE; close as accept.
                    ;; CBS_SIMPLE (variant=1) keeps its always-visible listbox
                    ;; embedded — close_dropdown is a no-op for it.
                    (if (i32.ne (local.get $variant) (i32.const 1))
                      (then (call $combobox_close_dropdown (local.get $hwnd) (i32.const 1))))
                    (return (i32.const 0)))
                  (else
                    ;; Click outside field, outside listbox → cancel-close.
                    (call $combobox_close_dropdown (local.get $hwnd) (i32.const 0))
                    (return (i32.const 0)))))))
          (else
            ;; Not dropped: any click on the field opens the dropdown (CBS_DROPDOWNLIST/
            ;; CBS_DROPDOWN). CBS_SIMPLE has no toggle behavior.
            (if (i32.ne (local.get $variant) (i32.const 1))
              (then
                (call $combobox_open_dropdown (local.get $hwnd))
                (return (i32.const 0))))))
        ;; Toggle when click hits field area while already dropped (closes via outside-test
        ;; above; but if click is INSIDE field, toggle close as cancel).
        (if (call $cb_is_dropped (local.get $state_w))
          (then (call $combobox_close_dropdown (local.get $hwnd) (i32.const 0))))
        (return (i32.const 0))))

    ;; ---------- WM_LBUTTONUP — when dropped with capture, route to listbox ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0202))
      (then
        (if (call $cb_is_dropped (local.get $state_w))
          (then
            (local.set $py (i32.shr_s (local.get $lParam) (i32.const 16)))
            (if (i32.ge_s (local.get $py) (local.get $field_h))
              (then
                (local.set $px (i32.shr_s (i32.shl (local.get $lParam) (i32.const 16)) (i32.const 16)))
                (drop (call $wnd_send_message (local.get $lb) (i32.const 0x0202)
                        (local.get $wParam)
                        (i32.or (i32.and (local.get $px) (i32.const 0xFFFF))
                                (i32.shl (i32.sub (local.get $py) (local.get $field_h)) (i32.const 16)))))))))
        (return (i32.const 0))))

    ;; ---------- WM_KEYDOWN (0x0100) ----------
    ;; F4 (0x73) or Alt+Down (we approximate by VK_F4 since we don't have
    ;; modifier key state cleanly here): toggle dropdown.
    ;; Esc (0x1B): cancel-close. Enter (0x0D): accept-close (if dropped).
    ;; Arrow/PgUp/PgDn/Home/End: forward to listbox (which fires LBN_SELCHANGE
    ;; back to us via WM_COMMAND, where we'll sync_text + relay CBN_SELCHANGE).
    (if (i32.eq (local.get $msg) (i32.const 0x0100))
      (then
        (if (i32.eq (local.get $wParam) (i32.const 0x73))  ;; VK_F4
          (then
            (if (call $cb_is_dropped (local.get $state_w))
              (then (call $combobox_close_dropdown (local.get $hwnd) (i32.const 1)))
              (else (call $combobox_open_dropdown  (local.get $hwnd))))
            (return (i32.const 0))))
        (if (i32.eq (local.get $wParam) (i32.const 0x1B))  ;; VK_ESCAPE
          (then
            (if (call $cb_is_dropped (local.get $state_w))
              (then (call $combobox_close_dropdown (local.get $hwnd) (i32.const 0))))
            (return (i32.const 0))))
        ;; VK_TAB: dismiss dropdown (cancel) so focus-change leaves no stranded
        ;; popup. Real dialog tabstop navigation isn't wired up here, but at
        ;; least the dropdown shouldn't linger.
        (if (i32.eq (local.get $wParam) (i32.const 0x09))  ;; VK_TAB
          (then
            (if (call $cb_is_dropped (local.get $state_w))
              (then (call $combobox_close_dropdown (local.get $hwnd) (i32.const 0))))))
        (if (i32.eq (local.get $wParam) (i32.const 0x0D))  ;; VK_RETURN
          (then
            (if (call $cb_is_dropped (local.get $state_w))
              (then (call $combobox_close_dropdown (local.get $hwnd) (i32.const 1))))
            (return (i32.const 0))))
        ;; Navigation keys → forward to listbox.
        (if (i32.or
              (i32.or (i32.eq (local.get $wParam) (i32.const 0x28))   ;; VK_DOWN
                      (i32.eq (local.get $wParam) (i32.const 0x26)))  ;; VK_UP
              (i32.or
                (i32.or (i32.eq (local.get $wParam) (i32.const 0x24))  ;; VK_HOME
                        (i32.eq (local.get $wParam) (i32.const 0x23))) ;; VK_END
                (i32.or (i32.eq (local.get $wParam) (i32.const 0x21))  ;; VK_PRIOR
                        (i32.eq (local.get $wParam) (i32.const 0x22))))) ;; VK_NEXT
          (then
            ;; Suppress click-driven close: keyboard nav fires LBN_SELCHANGE
            ;; via the listbox synchronously, but we don't want that to close
            ;; the dropdown.
            (global.set $combo_kbd_nav_active (i32.const 1))
            (drop (call $wnd_send_message (local.get $lb) (i32.const 0x0100)
                    (local.get $wParam) (local.get $lParam)))
            (global.set $combo_kbd_nav_active (i32.const 0))
            (return (i32.const 0))))
        (return (i32.const 0))))

    ;; ---------- WM_COMMAND (0x0111) from inner listbox or edit ----------
    ;; Listbox: LBN_SELCHANGE/LBN_DBLCLK → sync_text + relay CBN_SELCHANGE.
    ;; Edit (variant=2 only): EN_CHANGE(0x0300) → CBN_EDITCHANGE(5);
    ;;                        EN_UPDATE(0x0400) → CBN_EDITUPDATE(6);
    ;;                        EN_SETFOCUS(0x0100) → CBN_SETFOCUS(3);
    ;;                        EN_KILLFOCUS(0x0200) → CBN_KILLFOCUS(4).
    ;; The focus pair matters as much as the selection ones: a CBS_DROPDOWN
    ;; combo never holds the focus itself, its edit child does, so a combo
    ;; that only fired CBN_SETFOCUS/CBN_KILLFOCUS from its own WM_SETFOCUS/
    ;; WM_KILLFOCUS never fired them at all. WordPad's format bar applies the
    ;; picked font on CBN_KILLFOCUS of the font-name combo (it has no
    ;; CBN_SELCHANGE/CBN_SELENDOK handler), so picking a font from the toolbar
    ;; changed the combo's own text and nothing else.
    ;; Focus moving between the combo's own parts (field ↔ dropdown list) is
    ;; not a focus loss for the combo, so it must not relay CBN_KILLFOCUS.
    (if (i32.eq (local.get $msg) (i32.const 0x0111))
      (then
        ;; Edit notification path
        (if (i32.and (i32.eq (local.get $variant) (i32.const 2))
                     (i32.eq (local.get $lParam)
                             (call $cb_edit_hwnd (local.get $state_w))))
          (then
            (local.set $notif (i32.shr_u (local.get $wParam) (i32.const 16)))
            (local.set $cmd (i32.const 0))  ;; CBN_* code
            (if (i32.eq (local.get $notif) (i32.const 0x0300))  ;; EN_CHANGE
              (then (local.set $cmd (i32.const 5))))           ;; CBN_EDITCHANGE
            (if (i32.eq (local.get $notif) (i32.const 0x0400))  ;; EN_UPDATE
              (then (local.set $cmd (i32.const 6))))           ;; CBN_EDITUPDATE
            (if (i32.eq (local.get $notif) (i32.const 0x0100))  ;; EN_SETFOCUS
              (then (local.set $cmd (i32.const 3))))           ;; CBN_SETFOCUS
            (if (i32.eq (local.get $notif) (i32.const 0x0200))  ;; EN_KILLFOCUS
              (then
                ;; $focus_hwnd already names the incoming window: SetFocus
                ;; updates it before the outgoing WM_KILLFOCUS is delivered.
                (if (i32.eqz (i32.or
                      (i32.eq (global.get $focus_hwnd) (local.get $hwnd))
                      (i32.or
                        (i32.eq (global.get $focus_hwnd)
                                (call $cb_edit_hwnd (local.get $state_w)))
                        (i32.eq (global.get $focus_hwnd) (local.get $lb)))))
                  (then (local.set $cmd (i32.const 4))))))    ;; CBN_KILLFOCUS
            ;; CBN_EDITUPDATE/CBN_EDITCHANGE describe user edits. A combo's
            ;; own WM_SETTEXT/selection synchronization changes the inner EDIT
            ;; too, but must not recursively notify its parent as user input.
            (if (i32.and
                  (call $cb_suppress_edit_notify (local.get $state_w))
                  (i32.or (i32.eq (local.get $cmd) (i32.const 5))
                          (i32.eq (local.get $cmd) (i32.const 6))))
              (then (return (i32.const 0))))
            (if (local.get $cmd)
              (then
                (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
                (local.set $ctrl_id (i32.and (call $ctrl_table_get_id (local.get $hwnd)) (i32.const 0xFFFF)))
                (if (local.get $parent)
                  (then
                    ;; Every relayed edit notification is posted. They originate
                    ;; inside the edit child's own message dispatch, and their
                    ;; parent handlers may run guest callbacks that must own the
                    ;; main pump. Inno's skinned setup, for example, changes a
                    ;; combo during InitializeWizard; synchronously invoking its
                    ;; CBN_EDITCHANGE handler recursively enters Pascal Script.
                    (drop (call $post_queue_push
                      (local.get $parent) (i32.const 0x0111)
                      (i32.or (local.get $ctrl_id)
                              (i32.shl (local.get $cmd) (i32.const 16)))
                      (local.get $hwnd)))))))
            (return (i32.const 0))))
        (if (i32.eq (local.get $lParam) (local.get $lb))
          (then
            (local.set $notif (i32.shr_u (local.get $wParam) (i32.const 16)))
            ;; LBN_SETFOCUS(4)/LBN_KILLFOCUS(5) from the dropdown list are the
            ;; combo's own focus changes: clicking the field focuses the list,
            ;; and the app that then takes the focus back (WordPad's format bar
            ;; puts it on the view) is what ends the combo's edit.
            (if (i32.or (i32.eq (local.get $notif) (i32.const 4))
                        (i32.eq (local.get $notif) (i32.const 5)))
              (then
                (local.set $cmd (i32.const 0))
                (if (i32.eq (local.get $notif) (i32.const 4))
                  (then (local.set $cmd (i32.const 3)))          ;; CBN_SETFOCUS
                  (else
                    ;; Focus moving inside the combo (list ↔ field) is not a
                    ;; focus loss for the combo itself.
                    (if (i32.eqz (i32.or
                          (i32.eq (global.get $focus_hwnd) (local.get $hwnd))
                          (i32.or
                            (i32.eq (global.get $focus_hwnd)
                                    (call $cb_edit_hwnd (local.get $state_w)))
                            (i32.eq (global.get $focus_hwnd) (local.get $lb)))))
                      (then (local.set $cmd (i32.const 4))))))   ;; CBN_KILLFOCUS
                (if (local.get $cmd)
                  (then
                    (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
                    (local.set $ctrl_id (i32.and (call $ctrl_table_get_id (local.get $hwnd)) (i32.const 0xFFFF)))
                    (if (local.get $parent)
                      (then (drop (call $post_queue_push (local.get $parent) (i32.const 0x0111)
                              (i32.or (local.get $ctrl_id) (i32.shl (local.get $cmd) (i32.const 16)))
                              (local.get $hwnd)))))))
                (return (i32.const 0))))
            ;; LBN_SELCHANGE(1) or LBN_DBLCLK(2) → sync text + relay CBN_SELCHANGE
            (if (i32.or (i32.eq (local.get $notif) (i32.const 1))
                        (i32.eq (local.get $notif) (i32.const 2)))
              (then
                (call $combobox_sync_text (local.get $state_w))
                (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
                (local.set $ctrl_id (i32.and (call $ctrl_table_get_id (local.get $hwnd)) (i32.const 0xFFFF)))
                ;; CBN_SELCHANGE(1) → parent dialog. POSTED for the same
                ;; reentrancy reason as CBN_SELENDOK below (close_dropdown).
                (if (local.get $parent)
                  (then (drop (call $post_queue_push (local.get $parent) (i32.const 0x0111)
                          (i32.or (local.get $ctrl_id) (i32.shl (i32.const 1) (i32.const 16)))
                          (local.get $hwnd)))))
                (call $invalidate_hwnd (local.get $hwnd))
                ;; Click-driven LBN_SELCHANGE/LBN_DBLCLK while dropped →
                ;; accept-close. Keyboard nav suppresses this via
                ;; $combo_kbd_nav_active so VK_DOWN/UP can scroll the listbox
                ;; without dismissing the dropdown. CBS_SIMPLE (variant=1)
                ;; has no dropdown to close.
                (if (i32.and
                      (i32.ne (call $cb_is_dropped (local.get $state_w)) (i32.const 0))
                      (i32.eqz (global.get $combo_kbd_nav_active)))
                  (then
                    (if (i32.ne (local.get $variant) (i32.const 1))
                      (then (call $combobox_close_dropdown (local.get $hwnd) (i32.const 1))))))
                (return (i32.const 0))))))
        (return (i32.const 0))))

    ;; ---------- WM_PAINT ----------
    (if (i32.eq (local.get $msg) (i32.const 0x000F))
      (then
        (local.set $hdc (i32.add (local.get $hwnd) (i32.const 0x40000)))
        (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
        (local.set $w (i32.and (local.get $sz) (i32.const 0xFFFF)))
        (local.set $h (local.get $field_h))
        ;; Skip field paint for CBS_SIMPLE — entire window is the listbox.
        (if (i32.ne (local.get $variant) (i32.const 1))
          (then
            ;; Toolbar-hosted CBS_DROPDOWN inner EDIT children are not
            ;; independently composited, so paint the field here for both
            ;; editable and read-only dropdown variants.
            (drop (call $gdi_native_fill_rect (local.get $hdc)
                    (i32.const 0) (i32.const 0)
                    (local.get $w) (local.get $h)
                    (i32.const 0x30010)))  ;; WHITE_BRUSH
            (drop (call $gdi_native_draw_edge (local.get $hdc)
                    (i32.const 0) (i32.const 0)
                    (local.get $w) (local.get $h)
                    (i32.const 0x0A) (i32.const 0x0F)))  ;; EDGE_SUNKEN | BF_RECT
            (local.set $arrow_x (i32.sub (local.get $w) (i32.const 18)))
            (drop (call $gdi_native_fill_rect (local.get $hdc)
                    (local.get $arrow_x) (i32.const 2)
                    (i32.sub (local.get $w) (i32.const 2))
                    (i32.sub (local.get $h) (i32.const 2))
                    (i32.const 0x30011)))  ;; LTGRAY_BRUSH
            ;; Arrow box edge: pressed (sunken) when dropped, raised when closed.
            (drop (call $gdi_native_draw_edge (local.get $hdc)
                    (local.get $arrow_x) (i32.const 2)
                    (i32.sub (local.get $w) (i32.const 2))
                    (i32.sub (local.get $h) (i32.const 2))
                    (select (i32.const 0x0A) (i32.const 0x05) (call $cb_is_dropped (local.get $state_w)))
                    (i32.const 0x0F)))
            ;; Triangle ▼
            (drop (call $gdi_native_fill_rect (local.get $hdc)
                    (i32.add (local.get $arrow_x) (i32.const 4)) (i32.const 9)
                    (i32.add (local.get $arrow_x) (i32.const 11)) (i32.const 10)
                    (i32.const 0x30014)))
            (drop (call $gdi_native_fill_rect (local.get $hdc)
                    (i32.add (local.get $arrow_x) (i32.const 5)) (i32.const 10)
                    (i32.add (local.get $arrow_x) (i32.const 10)) (i32.const 11)
                    (i32.const 0x30014)))
            (drop (call $gdi_native_fill_rect (local.get $hdc)
                    (i32.add (local.get $arrow_x) (i32.const 6)) (i32.const 11)
                    (i32.add (local.get $arrow_x) (i32.const 9)) (i32.const 12)
                    (i32.const 0x30014)))
            (drop (call $gdi_native_fill_rect (local.get $hdc)
                    (i32.add (local.get $arrow_x) (i32.const 7)) (i32.const 12)
                    (i32.add (local.get $arrow_x) (i32.const 8)) (i32.const 13)
                    (i32.const 0x30014)))
            (drop (call $gdi_native_select_object (local.get $hdc) (i32.const 0x30021)))
            (drop (call $gdi_native_set_bk_mode (local.get $hdc) (i32.const 1)))
            ;; CBS_DROPDOWN delegates text ownership to its inner EDIT. Paint
            ;; from that same state so WM_PAINT agrees with WM_GETTEXT.
            (local.set $paint_state_w (cast ptr<ControlTextState> (local.get $state_w)))
            (if (i32.eq (local.get $variant) (i32.const 2))
              (then
                (local.set $paint_state_g
                  (call $wnd_get_state_ptr (call $cb_edit_hwnd (local.get $state_w))))
                (if (local.get $paint_state_g)
                  (then
                    (local.set $edit_text_w (cast ptr<ControlTextState>
                      (call $g2w (local.get $paint_state_g))))
                    (local.set $paint_state_w (local.get $edit_text_w))))))
            (if (i32.and
                  (i32.ne (local.get $paint_state_w) (i32.const 0))
                  (i32.ne (load.field ControlTextState text_buf_ptr (local.get $paint_state_w)) (i32.const 0)))
              (then
                (drop (call $gdi_native_draw_text (local.get $hdc)
                        (call $g2w (load.field ControlTextState text_buf_ptr (local.get $paint_state_w)))
                        (load.field.memarg ControlTextState text_len (local.get $paint_state_w))
                        (call $paint_rect (i32.const 4) (i32.const 2)
                                          (i32.sub (local.get $arrow_x) (i32.const 2))
                                          (i32.sub (local.get $h) (i32.const 2)))
                        (i32.const 0x24) (i32.const 0)))))))
        (return (i32.const 0))))

    ;; Default
    (i32.const 0)
  )
