  ;; ============================================================
  ;; SIMPLE BUILT-IN CONTROL WNDPROCS
  ;; ============================================================
  ;; This is the former tail of 09c3-controls.wat and stays immediately after
  ;; that fragment in main.watx. The adjacency preserves the original
  ;; top-level form order (and therefore function indices); shared state
  ;; layouts/accessors remain in 09c3-controls.wat, while the larger Edit,
  ;; ListBox, ComboBox, ListView, TrackBar, Tooltip, and Toolbar wndprocs remain
  ;; in the 09c3-wndprocs*.wat fragments.

  ;; ---- Shared text-buffer helper for state structs ----
  ;;
  ;; Allocate a text buffer in $heap_alloc and copy len bytes from a guest
  ;; source pointer. Returns the new guest pointer (or 0 if src_guest_ptr=0
  ;; or len=0). Caller is responsible for $heap_free on the returned ptr.
  (func $ctrl_text_dup (param $src_guest_ptr i32) (param $len i32) (result i32)
    (local $buf i32)
    (if (i32.or (i32.eqz (local.get $src_guest_ptr)) (i32.eqz (local.get $len)))
      (then (return (i32.const 0))))
    (local.set $buf (call $heap_alloc (i32.add (local.get $len) (i32.const 1))))
    (call $memcpy (call $g2w (local.get $buf)) (call $g2w (local.get $src_guest_ptr)) (local.get $len))
    (i32.store8 (i32.add (call $g2w (local.get $buf)) (local.get $len)) (i32.const 0))
    (local.get $buf)
  )

  ;; Clear the "checked" bit on every BS_AUTORADIOBUTTON in $hwnd's WS_GROUP,
  ;; then let the caller set $hwnd itself. A group begins at the nearest
  ;; preceding sibling (including self) with WS_GROUP and ends before the next
  ;; WS_GROUP sibling. Paint's Flip/Rotate dialog has an operation group and a
  ;; nested angle group under the same parent; treating all sibling radios as
  ;; one mutex makes choosing 180 degrees clear "Rotate by angle".
  (func $autoradio_clear_siblings (param $hwnd i32)
    (local $parent i32) (local $i i32) (local $rec i32)
    (local $other i32) (local $st i32) (local $stw i32) (local $flags i32)
    (local $target_slot i32) (local $group_start i32) (local $group_end i32)
    (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
    (if (i32.eqz (local.get $parent)) (then (return)))
    (local.set $target_slot (call $wnd_table_find (local.get $hwnd)))
    (if (i32.lt_s (local.get $target_slot) (i32.const 0)) (then (return)))
    ;; Locate the nearest WS_GROUP boundary at or before the target.
    (local.set $i (i32.const 0))
    (block $start_done (loop $start_scan
      (br_if $start_done (i32.gt_u (local.get $i) (local.get $target_slot)))
      (local.set $rec (call $wnd_record_addr (local.get $i)))
      (if (i32.and
            (i32.eq (load.field.memarg WndRecord parent (local.get $rec)) (local.get $parent))
            (i32.ne
              (i32.and (load.field.memarg WndRecord style (local.get $rec)) (i32.const 0x00020000))
              (i32.const 0)))
        (then (local.set $group_start (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $start_scan)))
    ;; The next WS_GROUP sibling starts a different mutex group.
    (local.set $group_end (global.get $MAX_WINDOWS))
    (local.set $i (i32.add (local.get $target_slot) (i32.const 1)))
    (block $end_done (loop $end_scan
      (br_if $end_done (i32.ge_u (local.get $i) (global.get $MAX_WINDOWS)))
      (local.set $rec (call $wnd_record_addr (local.get $i)))
      (if (i32.and
            (i32.eq (load.field.memarg WndRecord parent (local.get $rec)) (local.get $parent))
            (i32.ne
              (i32.and (load.field.memarg WndRecord style (local.get $rec)) (i32.const 0x00020000))
              (i32.const 0)))
        (then
          (local.set $group_end (local.get $i))
          (br $end_done)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $end_scan)))
    (local.set $i (local.get $group_start))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $group_end)))
      (local.set $rec (call $wnd_record_addr (local.get $i)))
      (local.set $other (load.field WndRecord hwnd (local.get $rec)))
      (if (i32.and
            (i32.and (i32.ne (local.get $other) (i32.const 0))
                     (i32.eq (load.field.memarg WndRecord parent (local.get $rec)) (local.get $parent)))
            ;; kind == BS_AUTORADIOBUTTON (9)
            (i32.eq (i32.and (load.field.memarg WndRecord style (local.get $rec)) (i32.const 0x0F))
                    (i32.const 9)))
        (then
          (local.set $st (load.field.memarg WndRecord state_ptr (local.get $rec)))
          (if (local.get $st)
            (then
              (local.set $stw (call $g2w (local.get $st)))
              (local.set $flags (call $btn_flags (local.get $stw)))
              ;; Clear bit1 (checked) on every autoradio sibling — including
              ;; $hwnd itself; the caller will re-set it after this returns.
              (call $btn_set_flags (local.get $stw)
                (i32.and (local.get $flags) (i32.const 0xFFFFFFFD)))
              (call $invalidate_hwnd (local.get $other))
              ;; The browser compositor does not always get another child
              ;; paint before the next frame. Paint cleared siblings now so
              ;; stale radio dots cannot remain visible.
              (if (i32.and (local.get $flags) (i32.const 0x02))
                (then
                  (drop (call $wnd_send_message
                    (local.get $other) (i32.const 0x000F)
                    (i32.const 0) (i32.const 0)))))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
  )

  ;; Walk siblings under the same parent and clear bit2 ("default") on any
  ;; button that has it set. Used when a non-default button gains focus —
  ;; real Win98 promotes the focused button to the temporary default, so
  ;; the originally-default button must lose its border.
  (func $btn_clear_sibling_default (param $hwnd i32) (param $except i32)
    (local $parent i32) (local $i i32) (local $rec i32)
    (local $other i32) (local $st i32) (local $stw i32)
    (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
    (if (i32.eqz (local.get $parent)) (then (return)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $MAX_WINDOWS)))
      (local.set $rec (call $wnd_record_addr (local.get $i)))
      (local.set $other (load.field WndRecord hwnd (local.get $rec)))
      (if (i32.and
            (i32.and (i32.ne (local.get $other) (i32.const 0))
                     (i32.eq (load.field.memarg WndRecord parent (local.get $rec)) (local.get $parent)))
            (i32.ne (local.get $other) (local.get $except)))
        (then
          (if (i32.eq (call $ctrl_table_get_class (local.get $other)) (i32.const 1))
            (then
              (local.set $st (load.field.memarg WndRecord state_ptr (local.get $rec)))
              (if (local.get $st)
                (then
                  (local.set $stw (call $g2w (local.get $st)))
                  (if (i32.and (call $btn_flags (local.get $stw)) (i32.const 0x04))
                    (then
                      (call $btn_set_flags (local.get $stw)
                        (i32.and (call $btn_flags (local.get $stw)) (i32.const 0xFFFFFFFB)))
                      (call $invalidate_hwnd (local.get $other))))))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
  )

  ;; Find sibling button under same parent whose style&0xF == 1 (real
  ;; BS_DEFPUSHBUTTON), set bit2 on it, invalidate. Used on KILLFOCUS so
  ;; the originally-default button regains its border.
  (func $btn_restore_real_default (param $hwnd i32)
    (local $parent i32) (local $i i32) (local $rec i32)
    (local $other i32) (local $st i32) (local $stw i32)
    (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
    (if (i32.eqz (local.get $parent)) (then (return)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $MAX_WINDOWS)))
      (local.set $rec (call $wnd_record_addr (local.get $i)))
      (local.set $other (load.field WndRecord hwnd (local.get $rec)))
      (if (i32.and
            (i32.and (i32.ne (local.get $other) (i32.const 0))
                     (i32.eq (load.field.memarg WndRecord parent (local.get $rec)) (local.get $parent)))
            (i32.eq (i32.and (call $wnd_get_style (local.get $other)) (i32.const 0x0F))
                    (i32.const 1)))
        (then
          (local.set $st (load.field.memarg WndRecord state_ptr (local.get $rec)))
          (if (local.get $st)
            (then
              (local.set $stw (call $g2w (local.get $st)))
              (call $btn_set_flags (local.get $stw)
                (i32.or (call $btn_flags (local.get $stw)) (i32.const 0x04)))
              (call $invalidate_hwnd (local.get $other))
              (return)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
  )

  ;; ---- Owner-draw WM_DRAWITEM dispatch ----
  ;; Build a DRAWITEMSTRUCT on the heap, send WM_DRAWITEM to the parent so
  ;; the owning wndproc paints the button face, then free. Called on state
  ;; transitions (mousedown/up) for BS_OWNERDRAW buttons; the WM_PAINT
  ;; handler skips drawing for that kind.
  ;;
  ;; DRAWITEMSTRUCT (48 bytes):
  ;;   +0x00 CtlType=ODT_BUTTON(4)   +0x04 CtlID
  ;;   +0x08 itemID=0                +0x0C itemAction=ODA_DRAWENTIRE(1)
  ;;   +0x10 itemState (ODS_SELECTED 0x01 | ODS_DISABLED 0x04 |
  ;;                    ODS_FOCUS 0x10 | ODS_DEFAULT 0x20)
  ;;   +0x14 hwndItem                +0x18 hDC
  ;;   +0x1C..+0x2B RECT rcItem      +0x2C itemData=0
  ;; The shared WEP About DLLs use a 260x65 owner-draw button as a monochrome
  ;; branding panel. The Win16 BitBlt adapter consults this while WM_DRAWITEM
  ;; is live so it can reproduce USER's embossed presentation of that panel.
  (global $btn_about_logo_hdc (mut i32) (i32.const 0))

  (func $btn_send_drawitem (param $hwnd i32) (param $state_w i32) (param $flags i32)
    (local $dis i32) (local $disw i32) (local $sz i32) (local $w i32) (local $h i32)
    (local $ctrl_id i32) (local $hdc i32) (local $state_bits i32)
    (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
    (local.set $w (i32.and (local.get $sz) (i32.const 0xFFFF)))
    (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
    (local.set $ctrl_id (i32.and (call $ctrl_table_get_id (local.get $hwnd)) (i32.const 0xFFFF)))
    (local.set $hdc (i32.add (local.get $hwnd) (i32.const 0x40000)))
    (drop (call $gdi_native_select_clip_rgn (local.get $hdc) (i32.const 0)))
    (local.set $state_bits
      (i32.or
        (i32.or
          (i32.or
            (select (i32.const 0x0001) (i32.const 0)
              (i32.and (local.get $flags) (i32.const 0x01)))
            (select (i32.const 4) (i32.const 0)
              (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 134217728))))
          (select (i32.const 0x0010) (i32.const 0)
            (i32.and (local.get $flags) (i32.const 0x08))))
        (select (i32.const 0x0020) (i32.const 0)
          (i32.and (local.get $flags) (i32.const 0x04)))))
    (local.set $dis (call $heap_alloc (i32.const 48)))
    (local.set $disw (call $g2w (local.get $dis)))
    (i32.store           (local.get $disw) (i32.const 4))
    (i32.store offset=4  (local.get $disw) (local.get $ctrl_id))
    (i32.store offset=8  (local.get $disw) (i32.const 0))
    (i32.store offset=12 (local.get $disw) (i32.const 1))
    (i32.store offset=16 (local.get $disw) (local.get $state_bits))
    (i32.store offset=20 (local.get $disw) (local.get $hwnd))
    (i32.store offset=24 (local.get $disw) (local.get $hdc))
    (i32.store offset=28 (local.get $disw) (i32.const 0))
    (i32.store offset=32 (local.get $disw) (i32.const 0))
    (i32.store offset=36 (local.get $disw) (local.get $w))
    (i32.store offset=40 (local.get $disw) (local.get $h))
    (i32.store offset=44 (local.get $disw) (i32.const 0))
    ;; Calc owner-draw button labels move by 1px while pressed. Its draw code
    ;; uses transparent text, so clear the child DC first or stale glyph pixels
    ;; from the previous offset remain visible.
    (if (call $ownerdraw_prefill_allowed (local.get $hwnd))
      (then
        (drop (call $gdi_native_fill_rect (local.get $hdc)
                (i32.const 0) (i32.const 0)
                (local.get $w) (local.get $h)
                (i32.const 0x30011)))))
    ;; Win98 supplies owner-draw button DCs with the standard 3-D colors.
    ;; Monochrome BitBlt maps source 1 through TextColor and source 0 through
    ;; BkColor; ABOUT.DLL relies on this to emboss resource 999 instead of
    ;; painting a literal black-and-white logo.
    (drop (call $gdi_native_set_text_color (local.get $hdc)
      (call $win98_sys_color (i32.const 15))))
    (drop (call $gdi_native_set_bk_color (local.get $hdc)
      (call $win98_sys_color (i32.const 20))))
    (global.set $btn_about_logo_hdc
      (select (local.get $hdc) (i32.const 0)
        (i32.and (i32.eq (local.get $w) (i32.const 260))
          (i32.eq (local.get $h) (i32.const 65)))))
    (drop (call $wnd_send_message
            (call $wnd_get_parent (local.get $hwnd))
            (i32.const 0x002B)
            (local.get $ctrl_id)
            (local.get $dis)))
    (call $heap_free (local.get $dis)))

  ;; Real Win32 hands an owner-draw item's DC to the owner untouched -- the
  ;; owner paints the whole item. We pre-fill COLOR_BTNFACE first because our
  ;; children share the top-level back-canvas, so an owner that draws
  ;; transparent text (Calc's keypad) would otherwise keep stale glyphs. Over
  ;; an app's DirectDraw exclusive-fullscreen primary that pre-fill is
  ;; destructive: such a window shares the game's framebuffer and its surface
  ;; already holds the presented frame, and Diablo's menus are nothing but
  ;; transparent white text over it.
  (func $ownerdraw_prefill_allowed (param $hwnd i32) (result i32)
    (i32.eqz
      (i32.and (i32.ne (call $dx_exclusive_get) (i32.const 0))
        (i32.ne (call $wnd_top_level (local.get $hwnd)) (call $dx_target_hwnd)))))

  (func $dialog_default_idok_close (param $parent i32)
    (local $dlg_rec i32) (local $slot i32) (local $kid i32)
    ;; Only DialogBoxParamA's modal pump supplies a default IDOK close.
    ;; CreateDialogParamA dialogs are modeless: their application owns the
    ;; lifetime even when the dialog proc returns FALSE for WM_COMMAND.
    ;; WAT-native dialogs (FindReplace/About/etc.) have their own class
    ;; handlers, so leave those alone.
    (if (i32.eqz (local.get $parent)) (then (return)))
    (if (i32.ne (global.get $dlg_pump_hwnd) (local.get $parent)) (then (return)))
    (if (i32.eqz (call $wnd_table_get (local.get $parent))) (then (return)))
    (if (call $ctrl_table_get_class (local.get $parent)) (then (return)))
    (local.set $dlg_rec (call $dlg_record_for_hwnd (local.get $parent)))
    (if (i32.eqz (local.get $dlg_rec)) (then (return)))
    (if (i32.eqz (i32.load offset=4 (local.get $dlg_rec))) (then (return)))
    ;; A wizard frame hosts each page as a child dialog of its own: one outer
    ;; modal window with an inner template-loaded dialog swapped in and out.
    ;; Its IDOK button is "Next", not "OK" -- the app's dlgproc destroys the
    ;; current page, creates the next one, and returns FALSE because it has
    ;; nothing to tell USER. Closing the frame on that FALSE ends the whole
    ;; session: the NSIS installers exited with code 1 the instant "I Agree"
    ;; moved them off the licence page.
    (local.set $slot (i32.const 0))
    (block $kids_done (loop $kids
      (local.set $slot (call $wnd_next_child_slot (local.get $parent) (local.get $slot)))
      (br_if $kids_done (i32.eq (local.get $slot) (i32.const -1)))
      (local.set $kid (call $dlg_record_for_hwnd (call $wnd_slot_hwnd (local.get $slot))))
      (if (i32.and (i32.ne (local.get $kid) (i32.const 0))
                   (i32.ne (i32.load offset=28 (local.get $kid)) (i32.const 0)))
        (then (return)))
      (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
      (br $kids)))
    (global.set $dlg_ended (i32.const 1))
    (global.set $dlg_result (i32.const 1))
    (i32.store (global.get $SHARED_DLG_ENDED) (i32.const 1))
    (i32.store (global.get $SHARED_DLG_RESULT) (i32.const 1))
    (call $wnd_destroy_tree (local.get $parent))
    (call $host_destroy_window (local.get $parent)))

  ;; ---- Button WndProc ----
  ;;
  ;; Test path NOT YET WIRED: dialog buttons today receive only BM_GETCHECK
  ;; / BM_SETCHECK via SendMessageA from x86 dialog procs. They never get
  ;; WM_CREATE because the JS-side dialog framework owns control creation.
  ;; STEP 5 will create dialogs from WAT, at which point WM_CREATE/WM_PAINT
  ;; below become live. Until then, the legacy CONTROL_TABLE path is the
  ;; only thing exercised by tests.

  ;; Cancel tracking without toggling a check state or notifying BN_CLICKED.
  ;; Clear both the control state and the dialog router's retained target
  ;; before a capture notification can reenter guest code.
  (func $button_cancel_press (param $hwnd i32)
    (local $state i32) (local $state_w i32) (local $flags i32)
    (local.set $state (call $wnd_get_state_ptr (local.get $hwnd)))
    (if (local.get $state)
      (then
        (local.set $state_w (call $g2w (local.get $state)))
        (local.set $flags (call $btn_flags (local.get $state_w)))
        (if (i32.and (local.get $flags) (i32.const 0x601))
          (then
            (call $btn_set_flags (local.get $state_w) (i32.and (local.get $flags) (i32.const -1538)))
            (call $invalidate_hwnd (local.get $hwnd))))))
    (if (i32.eq (global.get $dialog_button_capture_hwnd) (local.get $hwnd))
      (then
        (global.set $dialog_button_capture_hwnd (i32.const 0))
        (global.set $dialog_button_capture_parent (i32.const 0)))))

  ;; Commit an accepted activation after the caller has retired press tracking.
  ;; Shared by release and Win98's non-mouse focus-loss activation.
  (func $button_activate (param $hwnd i32)
    (local $state i32) (local $state_w i32) (local $flags i32)
    (local $w i32) (local $parent i32) (local $cmd_id i32)
    (local.set $state (call $wnd_get_state_ptr (local.get $hwnd)))
    (if (i32.eqz (local.get $state)) (then (return)))
    (local.set $state_w (call $g2w (local.get $state)))
    (local.set $flags (call $btn_flags (local.get $state_w)))
    ;; USER changes state automatically only for BS_AUTOCHECKBOX(3),
    ;; BS_AUTO3STATE(6), and BS_AUTORADIOBUTTON(9). Plain
    ;; BS_CHECKBOX(2)/BS_3STATE(5) controls deliberately keep their
    ;; old state: frameworks such as VCL subclass those styles and
    ;; update them while handling the reflected BN_CLICKED. Changing
    ;; state here makes that handler observe the wrong old value.
    ;; Push buttons (0,1), plain BS_RADIOBUTTON(4), and groupbox (7)
    ;; likewise do not auto-toggle.
    (local.set $w (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x0F)))
    (if (i32.eq (local.get $w) (i32.const 3))
      (then (local.set $flags (i32.xor (local.get $flags) (i32.const 0x02)))))
    (if (i32.eq (local.get $w) (i32.const 6))
      (then (local.set $flags (call $btn_flags_with_check (local.get $flags)
        (i32.rem_u (i32.add (call $btn_check_from_flags (local.get $flags))
          (i32.const 1)) (i32.const 3))))))
    (if (i32.eq (local.get $w) (i32.const 9))
      (then
        (call $autoradio_clear_siblings (local.get $hwnd))
        (if (i32.ne (call $wnd_get_state_ptr (local.get $hwnd)) (local.get $state))
          (then (return)))
        ;; $autoradio_clear_siblings cleared $hwnd's bit too — set it
        ;; back on. Reload sibling-updated flags, but do not restore
        ;; the press tracking that the activation caller has retired.
        (local.set $flags
          (i32.or
            (i32.and (call $btn_flags (local.get $state_w)) (i32.const -1538))
            (i32.const 0x02)))))
    (call $btn_set_flags (local.get $state_w) (local.get $flags))
    ;; BS_OWNERDRAW: dispatch WM_DRAWITEM to repaint the unpressed
    ;; face. Other kinds use button_wndproc's WM_PAINT.
    (if (i32.eq (local.get $w) (i32.const 0x0B))
      (then (call $btn_send_drawitem (local.get $hwnd) (local.get $state_w) (local.get $flags)))
      (else
        (drop (call $wnd_send_message
          (local.get $hwnd) (i32.const 0x000F) (i32.const 0) (i32.const 0)))))
    ;; Painting can call guest code and destroy the target.
    (if (i32.ne (call $wnd_get_state_ptr (local.get $hwnd)) (local.get $state))
      (then (return)))
    ;; Send WM_COMMAND(MAKEWPARAM(ctrl_id, BN_CLICKED=0), button_hwnd)
    ;; to parent. Native BUTTON controls normally notify parents
    ;; synchronously. A dialog command or an IDOK/IDCANCEL command on
    ;; a native guest window may enter a nested modal loop, though.
    ;; Running that through $wnd_send_message
    ;; traps the browser inside its recursive interpreter frame, so no
    ;; later click can reach the child modal dialog; if its bounded run
    ;; expires, the live x86 continuation is abandoned. Queue those
    ;; dialog commands instead. Wizard pages also use IDOK/IDCANCEL as
    ;; ordinary Next/Back commands, and either one may open another
    ;; modal dialog. A retained DLGPROC receives every WM_COMMAND on
    ;; the main interpreter context. DefDlgProc applies an unhandled
    ;; modal IDOK fallback when that queued message is dispatched.
    ;; VCL's owned forms
    ;; normally reflect that parent notification back to the control as
    ;; CN_COMMAND; its HWND association is private framework state, so
    ;; deliver the reflected message directly to the guest subclass.
    (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
    ;; GWL_ID can change after WM_CREATE (VCL creates TNewButton
    ;; with hMenu=0, then assigns the HWND as its ID). CONTROL_TABLE
    ;; is the canonical current value; ButtonState's creation-time
    ;; copy may legitimately be stale.
    (local.set $cmd_id
      (i32.and (call $ctrl_table_get_id (local.get $hwnd))
               (i32.const 0xFFFF)))
    (global.set $dialog_last_proc_handled (i32.const 0))
    (if (i32.or
          (i32.ne (call $dialog_proc_get (local.get $parent))
                  (i32.const 0))
          (i32.and
            (i32.or
              (i32.eq (local.get $cmd_id) (i32.const 1))
              (i32.eq (local.get $cmd_id) (i32.const 2)))
            (i32.and
              (i32.ne (call $wnd_table_get (local.get $parent))
                      (i32.const 0))
              (i32.lt_u (call $wnd_table_get (local.get $parent))
                        (i32.const 0xFFFE0000)))))
      (then
        (drop (call $post_queue_push
          (local.get $parent)
          (i32.const 0x0111)  ;; WM_COMMAND
          (local.get $cmd_id)
          (local.get $hwnd))))
      (else
        ;; Win16 is excluded: VB1 shadows ThunderCommandButton onto this
        ;; wndproc, and its form (owned by the main window) expects the
        ;; plain WM_COMMAND. Reflecting it to the button as CN_COMMAND left
        ;; JigSawed's Open-file OK button inert.
        (if (i32.and
              (i32.and
                (i32.and
                  (i32.ne (local.get $cmd_id) (i32.const 1))
                  (i32.ne (local.get $cmd_id) (i32.const 2)))
                (i32.eqz (global.get $is_win16)))
              (i32.and
                (i32.or
                  (i32.ne (call $wnd_get_owner (local.get $parent))
                          (i32.const 0))
                  ;; VCL assigns each native child its HWND as
                  ;; GWL_ID, then reflects WM_COMMAND back as
                  ;; CN_COMMAND. Panels nested inside the main
                  ;; form need the same queued reflection even
                  ;; though the immediate panel has no owner.
                  (i32.eq (local.get $cmd_id)
                    (i32.and (local.get $hwnd) (i32.const 0xFFFF))))
                (i32.and
                  (i32.ne (call $wnd_table_get (local.get $parent))
                          (i32.const 0))
                  (i32.lt_u (call $wnd_table_get (local.get $parent))
                            (i32.const 0xFFFE0000)))))
          (then
            ;; CN_BASE(0xBC00) + WM_COMMAND(0x0111).
            (drop (call $post_queue_push
              (local.get $hwnd) (i32.const 0xBD11)
              (local.get $cmd_id) (local.get $hwnd))))
          (else
            ;; A tail call when a USER entry point armed one (see
            ;; $ctrl_notify_parent): the handler may open a modal loop.
            (drop (call $ctrl_notify_parent
              (local.get $parent)
              (i32.const 0x0111)  ;; WM_COMMAND
              ;; wParam: low 16 = current ctrl_id, high 16 = BN_CLICKED (0)
              (local.get $cmd_id)
              (local.get $hwnd))))))) ;; lParam = button hwnd
  )

  (func $button_wndproc (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $state i32) (local $state_w i32)
    (local $cs_w i32) (local $hdc i32) (local $sz i32)
    (local $w i32) (local $h i32) (local $flags i32)
    (local $edge_flags i32) (local $text_w i32) (local $text_len i32)
    (local $brush i32) (local $name_ptr i32)
    (local $kind i32) (local $box_y i32) (local $tw i32) (local $calc i32)
    (local $img i32) (local $img_w i32) (local $img_h i32) (local $img_x i32) (local $img_y i32)
    (local $parent i32)
    (local $click_on_focus_loss i32)

    (local.set $state (call $wnd_get_state_ptr (local.get $hwnd)))

    ;; WM_GETDLGCODE: report the actual button style, not the temporary
    ;; focused/default border paint flag. No input or check state is changed.
    (if (i32.eq (local.get $msg) (i32.const 0x0087))
      (then
        (local.set $kind (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 15)))
        (if (i32.eq (local.get $kind) (i32.const 7))
          (then (return (i32.const 0x0100)))) ;; DLGC_STATIC
        (if (i32.or (i32.eq (local.get $kind) (i32.const 0))
                    (i32.eq (local.get $kind) (i32.const 10)))
          (then (return (i32.const 0x2020)))) ;; BUTTON | UNDEFPUSHBUTTON
        (if (i32.eq (local.get $kind) (i32.const 1))
          (then (return (i32.const 0x2010)))) ;; BUTTON | DEFPUSHBUTTON
        (if (i32.or (i32.eq (local.get $kind) (i32.const 4))
                    (i32.eq (local.get $kind) (i32.const 9)))
          (then (return (i32.const 0x2040)))) ;; BUTTON | RADIOBUTTON
        ;; Native Win98 returns BUTTON without WANTCHARS for checkbox
        ;; styles 2/3/5/6, unlike the current Microsoft documentation table.
        (return (i32.const 0x2000)))) ;; other button kinds

    ;; Capture transfer has already published the next owner. Never release
    ;; or reacquire that owner's capture while processing WM_CAPTURECHANGED.
    (if (i32.or (i32.eq (local.get $msg) (i32.const 0x0215))
                (i32.eq (local.get $msg) (i32.const 0x001F)))
      (then
        (call $button_cancel_press (local.get $hwnd))
        (if (i32.and (i32.eq (local.get $msg) (i32.const 0x001F))
              (i32.eq (global.get $capture_hwnd) (local.get $hwnd)))
          (then (drop (call $capture_replace (i32.const 0)))))
        (return (i32.const 0))))

    ;; EDIT scrollbars are standard non-client strips. Messages sent through
    ;; the control dispatcher do not pass through DefWindowProc automatically,
    ;; so paint the border and both scrollbar styles here instead of leaving
    ;; their backing-surface pixels black.
    (if (i32.and
          (i32.eq (local.get $msg) (i32.const 0x0085)) ;; WM_NCPAINT
          (i32.ne
            (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x00300000))
            (i32.const 0)))
      (then
        (call $defwndproc_do_ncpaint (local.get $hwnd))
        (return (i32.const 0))))

    ;; ---------- WM_CREATE (0x0001) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0001))
      (then
        ;; lParam = guest ptr to CREATESTRUCT
        ;; CREATESTRUCT: hMenu(+8) hwndParent(+12) cy(+16) cx(+20) y(+24) x(+28)
        ;;               style(+32) lpszName(+36) lpszClass(+40) dwExStyle(+44)
        (local.set $cs_w (call $g2w (local.get $lParam)))
        ;; CREATESTRUCT.hMenu is NOT read here: $ctrl_table_set already stored
        ;; that same value in CONTROL_TABLE+4 before this WM_CREATE was sent
        ;; (every creation path does — CreateWindowExA, $dlg_load,
        ;; $ctrl_create_child, the Win16 dialog loader), and that is the copy
        ;; SetWindowLongA(GWL_ID) later updates.
        (local.set $name_ptr (i32.load offset=36 (local.get $cs_w)))
        ;; Allocate ButtonState
        (local.set $state (call $heap_alloc (i32.const 68)))
        (local.set $state_w (call $g2w (local.get $state)))
        (call $btn_set_text_ptr (local.get $state_w) (i32.const 0))
        (call $btn_set_text_len (local.get $state_w) (i32.const 0))
        ;; flags: bit2=default if BS_DEFPUSHBUTTON (style&0xF == 1).
        ;; The control's style is already on the WND record via $dlg_load /
        ;; $ctrl_create_child, so $wnd_get_style returns the right value.
        (call $btn_set_flags (local.get $state_w)
          (select (i32.const 0x04) (i32.const 0)
                  (i32.eq (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x0F))
                          (i32.const 1))))
        (call $btn_set_image (local.get $state_w) (i32.const 0) (i32.const 0))
        ;; Copy initial text from CREATESTRUCT.lpszName
        (if (local.get $name_ptr)
          (then
            (local.set $text_len (call $strlen (call $g2w (local.get $name_ptr))))
            (call $btn_set_text_ptr (local.get $state_w)
              (call $ctrl_text_dup (local.get $name_ptr) (local.get $text_len)))
            (call $btn_set_text_len (local.get $state_w) (local.get $text_len))))
        (call $wnd_set_state_ptr (local.get $hwnd) (local.get $state))
        (return (i32.const 0))))

    ;; ---------- WM_DESTROY (0x0002) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0002))
      (then
        (if (local.get $state)
          (then
            (local.set $state_w (call $g2w (local.get $state)))
            (call $heap_free (call $btn_text_ptr (local.get $state_w))) ;; free text buf
            (call $heap_free (local.get $state))
            (call $wnd_set_state_ptr (local.get $hwnd) (i32.const 0))))
        (return (i32.const 0))))

    ;; ---------- WM_SETFOCUS (0x0007) ----------
    ;; Mark focused (bit3) and become the temporary default (bit2). If
    ;; this button isn't the real default, clear bit2 on whichever
    ;; sibling currently has it.
    (if (i32.eq (local.get $msg) (i32.const 0x0007))
      (then
        (global.set $focus_hwnd (local.get $hwnd))
        (if (local.get $state)
          (then
            (local.set $state_w (call $g2w (local.get $state)))
            (call $btn_clear_sibling_default (local.get $hwnd) (local.get $hwnd))
            (call $btn_set_flags (local.get $state_w)
              (i32.or (call $btn_flags (local.get $state_w)) (i32.const 0x0C))) ;; focused | default
            (call $invalidate_hwnd (local.get $hwnd))))
        ;; BS_NOTIFY asks USER to tell the parent when a button gains focus.
        ;; Diablo's class picker uses BN_SETFOCUS to select the highlighted
        ;; hero and populate its stats; BN_CLICKED only accepts that choice.
        (if (i32.and
              (i32.ne
                (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x00004000))
                (i32.const 0))
              (i32.ne (local.get $state) (i32.const 0)))
          (then
            (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
            (if (local.get $parent)
              (then
                (drop (call $wnd_send_message
                  (local.get $parent) (i32.const 0x0111)
                  (i32.or
                    (i32.and (call $ctrl_table_get_id (local.get $hwnd)) (i32.const 0xFFFF))
                    (i32.shl (i32.const 6) (i32.const 16))) ;; BN_SETFOCUS
                  (local.get $hwnd)))))))
        (return (i32.const 0))))

    ;; ---------- WM_KILLFOCUS (0x0008) ----------
    ;; Clear focused. If this button isn't the real default but currently
    ;; has bit2 (because it was the temp-default), clear it and restore
    ;; bit2 on the real default.
    (if (i32.eq (local.get $msg) (i32.const 0x0008))
      (then
        ;; Native Win98 activates highlighted non-mouse state on focus loss,
        ;; including BM_SETSTATE-only highlighting. Mouse-origin presses cancel.
        (if (local.get $state)
          (then
            (local.set $flags (call $btn_flags (call $g2w (local.get $state))))
            (local.set $click_on_focus_loss
              (i32.eq (i32.and (local.get $flags) (i32.const 0x401)) (i32.const 1)))
            (if (i32.and (local.get $flags) (i32.const 1))
              (then (drop (call $wnd_send_message
                (local.get $hwnd) (i32.const 0x00F3) (i32.const 0) (i32.const 0)))))
            (if (i32.ne (call $wnd_get_state_ptr (local.get $hwnd)) (local.get $state))
              (then (return (i32.const 0))))))
        (call $button_cancel_press (local.get $hwnd))
        (if (i32.eq (global.get $capture_hwnd) (local.get $hwnd))
          (then (drop (call $capture_replace (i32.const 0)))))
        (if (i32.and (i32.ne (local.get $click_on_focus_loss) (i32.const 0))
              (i32.eq (call $wnd_get_state_ptr (local.get $hwnd)) (local.get $state)))
          (then (call $button_activate (local.get $hwnd))))
        ;; Capture notification may destroy/subclass the button; do not use
        ;; the state pointer retained before that callback.
        (local.set $state (call $wnd_get_state_ptr (local.get $hwnd)))
        ;; USER's focus transaction owns the HWND. A BN_CLICKED callback can
        ;; refocus this button; preserve that winner even though native Win98
        ;; still clears the outer button's focus paint bit below.
        (if (local.get $state)
          (then
            (local.set $state_w (call $g2w (local.get $state)))
            ;; Always clear focused bit3.
            (call $btn_set_flags (local.get $state_w)
              (i32.and (call $btn_flags (local.get $state_w)) (i32.const 0xFFFFFFF7)))
            ;; If we aren't the real default, drop bit2 and restore the
            ;; real default's border. wnd style&0xF == 1 means real
            ;; BS_DEFPUSHBUTTON.
            (if (i32.ne (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x0F))
                        (i32.const 1))
              (then
                (call $btn_set_flags (local.get $state_w)
                  (i32.and (call $btn_flags (local.get $state_w)) (i32.const 0xFFFFFFFB)))
                (call $btn_restore_real_default (local.get $hwnd))))
            (call $invalidate_hwnd (local.get $hwnd))
            (if (i32.ne
                  (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x00004000))
                  (i32.const 0))
              (then
                (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
                (if (local.get $parent)
                  (then
                    (drop (call $wnd_send_message
                      (local.get $parent) (i32.const 0x0111)
                      (i32.or
                        (i32.and (call $ctrl_table_get_id (local.get $hwnd)) (i32.const 0xFFFF))
                        (i32.shl (i32.const 7) (i32.const 16))) ;; BN_KILLFOCUS
                      (local.get $hwnd)))))))))
        (return (i32.const 0))))

    ;; Space shares the native press/release transitions below. Enter belongs
    ;; to dialog default-button processing, not a BUTTON key-down click.
    (if (i32.and (i32.eq (local.get $msg) (i32.const 0x0100))
                 (i32.ne (local.get $wParam) (i32.const 0x20)))
      (then (return (i32.const 0))))
    ;; Other key releases cancel capture, except TAB (focus handling owns it).
    (if (i32.and
          (i32.or (i32.eq (local.get $msg) (i32.const 0x0101))
                  (i32.eq (local.get $msg) (i32.const 0x0105)))
          (i32.ne (local.get $wParam) (i32.const 0x20)))
      (then
        (if (i32.ne (local.get $wParam) (i32.const 9))
          (then
            (call $button_cancel_press (local.get $hwnd))
            (if (i32.eq (global.get $capture_hwnd) (local.get $hwnd))
              (then (drop (call $capture_replace (i32.const 0)))))))
        (return (i32.const 0))))

    ;; ---------- WM_SETTEXT (0x000C) ----------
    ;; lParam = guest ptr to NUL-terminated string. Replace text buffer.
    (if (i32.eq (local.get $msg) (i32.const 0x000C))
      (then
        (if (local.get $state)
          (then
            (local.set $state_w (call $g2w (local.get $state)))
            (call $heap_free (call $btn_text_ptr (local.get $state_w)))
            (call $btn_set_text_ptr (local.get $state_w) (i32.const 0))
            (call $btn_set_text_len (local.get $state_w) (i32.const 0))
            (if (local.get $lParam)
              (then
                (local.set $text_len (call $strlen (call $g2w (local.get $lParam))))
                (call $btn_set_text_ptr (local.get $state_w)
                  (call $ctrl_text_dup (local.get $lParam) (local.get $text_len)))
                (call $btn_set_text_len (local.get $state_w) (local.get $text_len))))
            (if (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x10000000))
              (then (call $invalidate_hwnd (local.get $hwnd))))
            (return (i32.const 1)))) ;; TRUE
        (return (i32.const 0))))

    ;; ---------- WM_GETTEXT (0x000D) ----------
    ;; wParam = max chars (incl. NUL), lParam = guest dest buffer.
    (if (i32.eq (local.get $msg) (i32.const 0x000D))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (if (i32.eqz (local.get $wParam)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (local.set $text_len (call $btn_text_len (local.get $state_w)))
        (if (i32.ge_u (local.get $text_len) (local.get $wParam))
          (then (local.set $text_len (i32.sub (local.get $wParam) (i32.const 1)))))
        (if (call $btn_text_ptr (local.get $state_w))
          (then (call $memcpy (call $g2w (local.get $lParam))
                              (call $g2w (call $btn_text_ptr (local.get $state_w)))
                              (local.get $text_len))))
        (i32.store8 (i32.add (call $g2w (local.get $lParam)) (local.get $text_len)) (i32.const 0))
        (return (local.get $text_len))))

    ;; ---------- WM_GETTEXTLENGTH (0x000E) ----------
    ;; Answering only WM_GETTEXT is not enough. VCL's TControl.GetText asks for
    ;; the length first and sizes the result string from it, so a button that
    ;; reports 0 hands every caller an empty caption however correct its
    ;; WM_GETTEXT reply is. TetriNET compares its Connect button's caption
    ;; against "Connect" to decide whether it is connecting or disconnecting,
    ;; and with an empty string it always chose disconnect.
    (if (i32.eq (local.get $msg) (i32.const 0x000E))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (return (call $btn_text_len (call $g2w (local.get $state))))))

    ;; ---------- Mouse DOWN/DBLCLK or Space KEYDOWN ----------
    (if (i32.or
          (i32.eq (local.get $msg) (i32.const 0x0100))
          (i32.or (i32.eq (local.get $msg) (i32.const 0x0201))
                  (i32.eq (local.get $msg) (i32.const 0x0203))))
      (then
        ;; USER gives a BUTTON the focus before delivering its button-down.
        ;; The renderer normally performs that transition while routing the
        ;; browser event, but in real-Threads mode its local WASM instance is
        ;; only an ownership token: changing that instance's focus global does
        ;; not change the live guest Worker. Do it at the control boundary too,
        ;; where both backends execute and where BS_NOTIFY's BN_SETFOCUS must be
        ;; generated. Diablo selects/populates Warrior from that notification;
        ;; BN_CLICKED merely confirms the already-selected class.
        (if (i32.and (i32.ne (local.get $msg) (i32.const 0x0100))
                    (i32.ne (global.get $focus_hwnd) (local.get $hwnd)))
          (then (call $set_focus (local.get $hwnd))))
        (if (local.get $state)
          (then
            (local.set $state_w (call $g2w (local.get $state)))
            (local.set $flags
              (i32.or (call $btn_flags (local.get $state_w))
                (select (i32.const 0x201) (i32.const 0x601)
                  (i32.eq (local.get $msg) (i32.const 0x0100))))) ;; tracking + origin + pressed
            (call $btn_set_flags (local.get $state_w) (local.get $flags))
            (global.set $capture_hwnd (local.get $hwnd))
            ;; BS_OWNERDRAW: ask parent to repaint via WM_DRAWITEM. Other
            ;; kinds rely on WM_PAINT → button_wndproc drawing the bevel.
            (if (i32.eq (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x0F))
                        (i32.const 0x0B))
              (then (call $btn_send_drawitem (local.get $hwnd) (local.get $state_w) (local.get $flags)))
              (else
                (drop (call $wnd_send_message
                  (local.get $hwnd) (i32.const 0x000F) (i32.const 0) (i32.const 0)))))
            ;; BUTTON sends BN_DOUBLECLICKED immediately for the historical
            ;; radio/user/owner-draw kinds, and for any kind with BS_NOTIFY.
            ;; Diablo uses BS_OWNERDRAW|BS_NOTIFY class buttons and advances
            ;; from Choose Class on this notification while OK stays disabled.
            (if (i32.eq (local.get $msg) (i32.const 0x0203))
              (then
                (local.set $w
                  (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x0F)))
                (if (i32.or
                      (i32.ne
                        (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x00004000))
                        (i32.const 0))
                      (i32.or
                        (i32.or (i32.eq (local.get $w) (i32.const 4))
                                (i32.eq (local.get $w) (i32.const 8)))
                        (i32.or (i32.eq (local.get $w) (i32.const 9))
                                (i32.eq (local.get $w) (i32.const 11)))))
                  (then
                    (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
                    (if (local.get $parent)
                      (then
                        (drop (call $wnd_send_message
                          (local.get $parent) (i32.const 0x0111)
                          (i32.or
                            (i32.and (call $ctrl_table_get_id (local.get $hwnd)) (i32.const 0xFFFF))
                            (i32.shl (i32.const 5) (i32.const 16))) ;; BN_DOUBLECLICKED
                          (local.get $hwnd)))))))))))
        (return (i32.const 0))))

    ;; BM_SETSTATE changes appearance only; it must not manufacture a click
    ;; when an otherwise unrelated UP arrives. Press tracking uses bit9.
    ;; Captured movement updates that same appearance without ending tracking.
    (if (i32.or (i32.eq (local.get $msg) (i32.const 0x00F3))
                (i32.eq (local.get $msg) (i32.const 0x0200)))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (local.set $flags (call $btn_flags (local.get $state_w)))
        (local.set $w (i32.ne (local.get $wParam) (i32.const 0)))
        (if (i32.eq (local.get $msg) (i32.const 0x0200))
          (then
            (if (i32.eqz (i32.and (local.get $flags) (i32.const 0x200)))
              (then (return (i32.const 0))))
            (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
            (local.set $w (i32.and
              (i32.lt_u (i32.shr_s (i32.shl (local.get $lParam) (i32.const 16)) (i32.const 16))
                (i32.and (local.get $sz) (i32.const 0xFFFF)))
              (i32.lt_u (i32.shr_s (local.get $lParam) (i32.const 16))
                (i32.shr_u (local.get $sz) (i32.const 16)))))))
        (if (i32.ne (i32.and (local.get $flags) (i32.const 1)) (local.get $w))
          (then
            (local.set $flags (i32.or (i32.and (local.get $flags) (i32.const -2)) (local.get $w)))
            (call $btn_set_flags (local.get $state_w) (local.get $flags))
            (call $invalidate_hwnd (local.get $hwnd))
            (drop (call $wnd_send_message
              (local.get $hwnd) (i32.const 0x000F) (i32.const 0) (i32.const 0)))))
        (return (i32.const 0))))

    ;; ---------- Mouse UP or Space KEYUP/SYSKEYUP ----------
    ;; Clear pressed flag, derive button kind from style&0xF (BS_*), update
    ;; check state for automatic checkbox/radio kinds, then post WM_COMMAND with
    ;; BN_CLICKED to the parent so a future $wndproc_dialog (or an existing
    ;; x86 dialog proc) can react.
    (if (i32.or (i32.eq (local.get $msg) (i32.const 0x0202))
          (i32.or (i32.eq (local.get $msg) (i32.const 0x0101))
                  (i32.eq (local.get $msg) (i32.const 0x0105))))
      (then
        (if (local.get $state)
          (then
            (local.set $state_w (call $g2w (local.get $state)))
            (local.set $flags (call $btn_flags (local.get $state_w)))
            ;; A subclass can consume DOWN and activate the button itself.
            ;; Its subsequent UP must not produce a second BN_CLICKED unless
            ;; the native BUTTON actually began tracking that press. Diablo's
            ;; menu subclass posts its command on DOWN and chains only UP.
            (if (i32.eqz (i32.and (local.get $flags) (i32.const 0x200)))
              (then (return (i32.const 0))))
            ;; Retire tracking and appearance together.
            (local.set $flags (i32.and (local.get $flags) (i32.const -1538)))
            (if (i32.eq (global.get $capture_hwnd) (local.get $hwnd))
              (then (global.set $capture_hwnd (i32.const 0))))
            ;; Captured UP reaches this control even outside its client rect.
            ;; Negative signed coordinates compare above the bounds unsigned;
            ;; right/bottom edges are excluded. Cancel before auto-toggle or
            ;; BN_CLICKED, but retire the pressed state and repaint normally.
            (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
            (if (i32.and (i32.eq (local.get $msg) (i32.const 0x0202)) (i32.or
                  (i32.ge_u (i32.shr_s (i32.shl (local.get $lParam) (i32.const 16)) (i32.const 16))
                    (i32.and (local.get $sz) (i32.const 0xFFFF)))
                  (i32.ge_u (i32.shr_s (local.get $lParam) (i32.const 16))
                    (i32.shr_u (local.get $sz) (i32.const 16)))))
              (then
                (call $btn_set_flags (local.get $state_w) (local.get $flags))
                (call $invalidate_hwnd (local.get $hwnd))
                (return (i32.const 0))))
            (call $btn_set_flags (local.get $state_w) (local.get $flags))
            (call $button_activate (local.get $hwnd))
            ))
        (return (i32.const 0))))

    ;; ---------- WM_PAINT (0x000F) ----------
    ;; Compose a Win98 button face from GDI primitives. hdc encoding matches
    ;; BeginPaint: hwnd + 0x40000. Dispatches by BS_* kind (style & 0x0F):
    ;;   0,1     = push button / default push button
    ;;   2,3,5,6 = checkbox-style (small box + check + label)
    ;;   4,9     = radio-style (small circle + dot + label)
    ;;   7       = groupbox (etched border + label notch)
    (if (i32.eq (local.get $msg) (i32.const 0x000F))
      (then
        ;; A real BUTTON window proc paints inside BeginPaint/EndPaint, which
        ;; validates the update region. Our WAT-native painter draws directly
        ;; through host GDI primitives, so clear the pending region here or a
        ;; pressed button can keep the message pump returning child WM_PAINT.
        (call $update_clear_hwnd (local.get $hwnd))
        (call $paint_flag_clear_hwnd (local.get $hwnd))
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (local.set $flags (call $btn_flags (local.get $state_w)))
        (local.set $hdc (i32.add (local.get $hwnd) (i32.const 0x40000)))
        ;; Native controls paint with a fresh BeginPaint DC. Our synthetic
        ;; hwnd+0x40000 DC can retain a clip region from a previous draw,
        ;; which clipped Spider's MessageBox "No" button top edge.
        (drop (call $gdi_native_select_clip_rgn (local.get $hdc) (i32.const 0)))
        ;; ctrl_get_wh_packed reads CONTROL_GEOM (works for WAT-only children
        ;; that have no JS-side window record).
        (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
        (local.set $w (i32.and (local.get $sz) (i32.const 0xFFFF)))
        (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
        (local.set $kind (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x0F)))

        ;; Common DC setup: select DEFAULT_GUI_FONT and switch to TRANSPARENT
        ;; bk mode so text glyphs don't get an opaque white background box.
        (drop (call $gdi_native_select_object (local.get $hdc) (i32.const 0x30021)))
        (drop (call $gdi_native_set_bk_mode (local.get $hdc) (i32.const 1)))
        (drop (call $gdi_native_set_text_color (local.get $hdc) (i32.const 0x00000000)))
        (if (call $ctrl_style_disabled (call $wnd_get_style (local.get $hwnd)))
          (then
            (drop (call $gdi_native_set_text_color
              (local.get $hdc) (i32.const 0x00808080)))))

        ;; Resolve text pointer/length once (used by every kind that has a label).
        (if (call $btn_text_ptr (local.get $state_w))
          (then
            (local.set $text_w (call $g2w (call $btn_text_ptr (local.get $state_w))))
            (local.set $text_len (call $btn_text_len (local.get $state_w)))))

        ;; ---- Bitmap button (BS_BITMAP 0x80) ----
        ;; Funtris uses BM_SETIMAGE on BS_BITMAP|BS_AUTOCHECKBOX controls for
        ;; the nine brick previews. Draw the stored HBITMAP centered in the
        ;; control before considering the low-nibble button kind.
        (if (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x0080))
          (then
            (local.set $img (call $btn_image_handle (local.get $state_w)))
            (if (local.get $img)
              (then
                (drop (call $gdi_native_fill_rect (local.get $hdc)
                        (i32.const 0) (i32.const 0)
                        (local.get $w) (local.get $h)
                        (i32.const 0x30011)))
                (local.set $img_w (call $gdi_native_get_object_w (local.get $img)))
                (local.set $img_h (call $gdi_native_get_object_h (local.get $img)))
                (if (i32.gt_s (local.get $img_w) (i32.const 0))
                  (then
                    (if (i32.gt_s (local.get $img_h) (i32.const 0))
                      (then
                        (local.set $img_x
                          (i32.div_s (i32.sub (local.get $w) (local.get $img_w)) (i32.const 2)))
                        (local.set $img_y
                          (i32.div_s (i32.sub (local.get $h) (local.get $img_h)) (i32.const 2)))
                        (if (i32.lt_s (local.get $img_x) (i32.const 0))
                          (then (local.set $img_x (i32.const 0))))
                        (if (i32.lt_s (local.get $img_y) (i32.const 0))
                          (then (local.set $img_y (i32.const 0))))
                        (local.set $brush (call $gdi_native_create_compat_dc (local.get $hdc)))
                        (drop (call $gdi_native_select_object (local.get $brush) (local.get $img)))
                        (drop (call $gdi_native_bitblt
                                (local.get $hdc)
                                (local.get $img_x) (local.get $img_y)
                                (local.get $img_w) (local.get $img_h)
                                (local.get $brush)
                                (i32.const 0) (i32.const 0)
                                (i32.const 0x00CC0020))) ;; SRCCOPY
                        (drop (call $gdi_native_delete_dc (local.get $brush)))))))
                (if (i32.and (local.get $flags) (i32.const 0x08))
                  (then
                    (drop (call $gdi_native_draw_focus_rect (local.get $hdc)
                            (i32.const 2) (i32.const 2)
                            (i32.sub (local.get $w) (i32.const 2))
                            (i32.sub (local.get $h) (i32.const 2))))))
                (return (i32.const 0))))))

        ;; ---- Push button (kinds 0, 1) ----
        (if (i32.lt_u (local.get $kind) (i32.const 2))
          (then
            ;; If currently the default (bit2), draw a 1px black border
            ;; around the outer edge and inset the bevel by 1 px.
            (local.set $box_y (i32.and (local.get $flags) (i32.const 0x04))) ;; reuse $box_y as "is default"
            (if (local.get $box_y)
              (then
                ;; 1px black frame via 4 fill_rect strokes (BLACK_BRUSH=0x30014).
                (drop (call $gdi_native_fill_rect (local.get $hdc)
                        (i32.const 0) (i32.const 0)
                        (local.get $w) (i32.const 1) (i32.const 0x30014)))
                (drop (call $gdi_native_fill_rect (local.get $hdc)
                        (i32.const 0) (i32.sub (local.get $h) (i32.const 1))
                        (local.get $w) (local.get $h) (i32.const 0x30014)))
                (drop (call $gdi_native_fill_rect (local.get $hdc)
                        (i32.const 0) (i32.const 0)
                        (i32.const 1) (local.get $h) (i32.const 0x30014)))
                (drop (call $gdi_native_fill_rect (local.get $hdc)
                        (i32.sub (local.get $w) (i32.const 1)) (i32.const 0)
                        (local.get $w) (local.get $h) (i32.const 0x30014)))))
            ;; Fill face with LTGRAY_BRUSH (stock object 1 = 0x30011)
            (drop (call $gdi_native_fill_rect (local.get $hdc)
                    (select (i32.const 1) (i32.const 0) (local.get $box_y))
                    (select (i32.const 1) (i32.const 0) (local.get $box_y))
                    (select (i32.sub (local.get $w) (i32.const 1)) (local.get $w) (local.get $box_y))
                    (select (i32.sub (local.get $h) (i32.const 1)) (local.get $h) (local.get $box_y))
                    (i32.const 0x30011)))
            ;; Bevel: BF_RECT(0x0F) | BDR_RAISEDOUTER(0x01)|BDR_RAISEDINNER(0x04) = 0x05
            ;;        or pressed: BDR_SUNKENOUTER(0x02)|BDR_SUNKENINNER(0x08) = 0x0A
            (local.set $edge_flags (select (i32.const 0x0A) (i32.const 0x05)
                                           (i32.and (local.get $flags) (i32.const 0x01))))
            (drop (call $gdi_native_draw_edge (local.get $hdc)
                    (select (i32.const 1) (i32.const 0) (local.get $box_y))
                    (select (i32.const 1) (i32.const 0) (local.get $box_y))
                    (select (i32.sub (local.get $w) (i32.const 1)) (local.get $w) (local.get $box_y))
                    (select (i32.sub (local.get $h) (i32.const 1)) (local.get $h) (local.get $box_y))
                    (local.get $edge_flags) (i32.const 0x0F)))
            (if (local.get $text_w)
              (then
                ;; DT_CENTER(0x01)|DT_VCENTER(0x04)|DT_SINGLELINE(0x20) = 0x25
                (drop (call $gdi_native_draw_text (local.get $hdc)
                        (local.get $text_w) (local.get $text_len)
                        (call $paint_rect (i32.const 0) (i32.const 0)
                                          (local.get $w) (local.get $h))
                        (i32.const 0x25) (i32.const 0)))))
            ;; Focus rect (bit3): inset 4px from outer edge.
            (if (i32.and (local.get $flags) (i32.const 0x08))
              (then
                (drop (call $gdi_native_draw_focus_rect (local.get $hdc)
                        (i32.const 4) (i32.const 4)
                        (i32.sub (local.get $w) (i32.const 4))
                        (i32.sub (local.get $h) (i32.const 4))))))
            (return (i32.const 0))))

        ;; ---- Checkbox-style (kinds 2, 3, 5, 6) ----
        ;; 12x12 sunken white box, optional check glyph, label to the right.
        (if (i32.or
              (i32.or (i32.eq (local.get $kind) (i32.const 2))
                      (i32.eq (local.get $kind) (i32.const 3)))
              (i32.or (i32.eq (local.get $kind) (i32.const 5))
                      (i32.eq (local.get $kind) (i32.const 6))))
          (then
            ;; Background — face color so a re-paint doesn't leave stale pixels
            (drop (call $gdi_native_fill_rect (local.get $hdc)
                    (i32.const 0) (i32.const 0) (local.get $w) (local.get $h)
                    (i32.const 0x30011)))
            ;; One 13x13 check box, shared with the list-view state images.
            (local.set $box_y (i32.div_u (i32.sub (local.get $h) (i32.const 13)) (i32.const 2)))
            (call $paint_check_box_state (local.get $hdc)
              (i32.const 0) (local.get $box_y)
              (call $btn_check_from_flags (local.get $flags)))
            (if (local.get $text_w)
              (then
                ;; DT_VCENTER(0x04)|DT_SINGLELINE(0x20) = 0x24
                (drop (call $gdi_native_draw_text (local.get $hdc)
                        (local.get $text_w) (local.get $text_len)
                        (call $paint_rect (i32.const 16) (i32.const 0)
                                          (local.get $w) (local.get $h))
                        (i32.const 0x24) (i32.const 0)))))
            ;; Focus rect (bit3) around the label.
            (if (i32.and (local.get $flags) (i32.const 0x08))
              (then
                (drop (call $gdi_native_draw_focus_rect (local.get $hdc)
                        (i32.const 14) (i32.const 1)
                        (i32.sub (local.get $w) (i32.const 1))
                        (i32.sub (local.get $h) (i32.const 1))))))
            (return (i32.const 0))))

        ;; ---- Radio-style (kinds 4, 9) ----
        (if (i32.or (i32.eq (local.get $kind) (i32.const 4))
                    (i32.eq (local.get $kind) (i32.const 9)))
          (then
            (drop (call $gdi_native_fill_rect (local.get $hdc)
                    (i32.const 0) (i32.const 0) (local.get $w) (local.get $h)
                    (i32.const 0x30011)))
            (local.set $box_y (i32.sub (i32.div_u (local.get $h) (i32.const 2)) (i32.const 6)))
            ;; Outline circle: BLACK_PEN + WHITE_BRUSH
            (drop (call $gdi_native_select_object (local.get $hdc) (i32.const 0x30017)))
            (drop (call $gdi_native_select_object (local.get $hdc) (i32.const 0x30010)))
            (drop (call $gdi_native_ellipse (local.get $hdc)
                    (i32.const 0) (local.get $box_y)
                    (i32.const 12) (i32.add (local.get $box_y) (i32.const 12))))
            (if (i32.and (local.get $flags) (i32.const 0x02))
              (then
                (drop (call $gdi_native_fill_rect (local.get $hdc)
                        (i32.const 4) (i32.add (local.get $box_y) (i32.const 4))
                        (i32.const 8) (i32.add (local.get $box_y) (i32.const 8))
                        (i32.const 0x30014)))))
            (if (local.get $text_w)
              (then
                (drop (call $gdi_native_draw_text (local.get $hdc)
                        (local.get $text_w) (local.get $text_len)
                        (call $paint_rect (i32.const 16) (i32.const 0)
                                          (local.get $w) (local.get $h))
                        (i32.const 0x24) (i32.const 0)))))
            ;; Focus rect (bit3) around the label.
            (if (i32.and (local.get $flags) (i32.const 0x08))
              (then
                (drop (call $gdi_native_draw_focus_rect (local.get $hdc)
                        (i32.const 14) (i32.const 1)
                        (i32.sub (local.get $w) (i32.const 1))
                        (i32.sub (local.get $h) (i32.const 1))))))
            (return (i32.const 0))))

        ;; ---- Groupbox (kind 7) ----
        ;; Etched rectangle with a label notched into the top stroke. The label
        ;; width is measured via DT_CALCRECT so we know how wide a hole to clear.
        ;; Do NOT fill the interior — the dialog face is already painted by
        ;; $dlg_fill_bkgnd (WM_ERASEBKGND), and an interior fill here would
        ;; overpaint any siblings created before the groupbox in the template
        ;; (pinball's Player Controls lists groupboxes last; an inner fill
        ;; erases its static labels and combos).
        (if (i32.eq (local.get $kind) (i32.const 7))
          (then
            ;; EDGE_ETCHED = 0x06 (BDR_SUNKENOUTER|BDR_RAISEDINNER), BF_RECT = 0x0F.
            ;; Top edge sits at y=6 so the label can overlap it.
            (drop (call $gdi_native_draw_edge (local.get $hdc)
                    (i32.const 0) (i32.const 6) (local.get $w) (local.get $h)
                    (i32.const 0x06) (i32.const 0x0F)))
            (if (local.get $text_w)
              (then
                ;; Measure with DT_CALCRECT(0x400) | DT_SINGLELINE(0x20) = 0x420
                (local.set $calc (call $paint_rect (i32.const 12) (i32.const 0)
                                                   (local.get $w) (i32.const 13)))
                (drop (call $gdi_native_draw_text (local.get $hdc)
                        (local.get $text_w) (local.get $text_len)
                        (local.get $calc)
                        (i32.const 0x420) (i32.const 0)))
                (local.set $tw (i32.sub
                                 (i32.load offset=8 (local.get $calc))
                                 (i32.const 12)))
                ;; Clear the slot under the label so the etched stroke is hidden
                (drop (call $gdi_native_fill_rect (local.get $hdc)
                        (i32.const 8) (i32.const 0)
                        (i32.add (i32.const 16) (local.get $tw)) (i32.const 13)
                        (i32.const 0x30011)))
                ;; Real draw at left=12, y=0..13
                (drop (call $gdi_native_draw_text (local.get $hdc)
                        (local.get $text_w) (local.get $text_len)
                        (call $paint_rect (i32.const 12) (i32.const 0)
                                          (local.get $w) (i32.const 13))
                        (i32.const 0x20) (i32.const 0)))))
            (return (i32.const 0))))

        ;; ---- Owner-draw (kind 0x0B = BS_OWNERDRAW) ----
        ;; Post WM_DRAWITEM to parent so the x86 dialog proc can paint.
        ;; DRAWITEMSTRUCT (48 bytes) is embedded at ButtonState+16.
        (if (i32.eq (local.get $kind) (i32.const 0x0B))
          (then
            ;; Owner-draw controls must repaint on every WM_PAINT. Unlike
            ;; real Win32 child windows, our children share the top-level
            ;; back-canvas, so a later parent erase can wipe their pixels.
            ;; Fill DRAWITEMSTRUCT at ButtonState+16
            ;; Reuse $edge_flags as WASM address of the struct
            (local.set $edge_flags (call $g2w (call $btn_drawitem_guest (local.get $state))))
            (i32.store         (local.get $edge_flags) (i32.const 4))  ;; CtlType = ODT_BUTTON
            (i32.store offset=4  (local.get $edge_flags)
              (call $ctrl_table_get_id (local.get $hwnd)))                ;; CtlID
            (i32.store offset=8  (local.get $edge_flags) (i32.const 0)) ;; itemID
            (i32.store offset=12 (local.get $edge_flags) (i32.const 1)) ;; itemAction = ODA_DRAWENTIRE
            (i32.store offset=16 (local.get $edge_flags)
              (i32.or
                (i32.or
                  (select (i32.const 0x0001) (i32.const 0)
                    (i32.and (local.get $flags) (i32.const 0x01)))
                  (select (i32.const 4) (i32.const 0)
                    (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 134217728))))
                (i32.or
                  (select (i32.const 0x0010) (i32.const 0)
                    (i32.and (local.get $flags) (i32.const 0x08)))
                  (select (i32.const 0x0020) (i32.const 0)
                    (i32.and (local.get $flags) (i32.const 0x04)))))) ;; itemState
            (i32.store offset=20 (local.get $edge_flags) (local.get $hwnd)) ;; hwndItem
            (i32.store offset=24 (local.get $edge_flags)
              (i32.add (local.get $hwnd) (i32.const 0x40000)))          ;; hDC
            (i32.store offset=28 (local.get $edge_flags) (i32.const 0)) ;; rcItem.left
            (i32.store offset=32 (local.get $edge_flags) (i32.const 0)) ;; rcItem.top
            (i32.store offset=36 (local.get $edge_flags) (local.get $w)) ;; rcItem.right
            (i32.store offset=40 (local.get $edge_flags) (local.get $h)) ;; rcItem.bottom
            (i32.store offset=44 (local.get $edge_flags) (i32.const 0)) ;; itemData
            ;; Clear stale transparent text before delegating to the owner.
            ;; Real Win32 does not do this -- the owner is what paints the
            ;; whole item -- and it is only safe because our children share
            ;; the top-level back-canvas. Over a DirectDraw exclusive-
            ;; fullscreen primary it is actively wrong: that surface holds the
            ;; presented frame the window shares with the game, and Diablo's
            ;; menu buttons are transparent text over it, so filling
            ;; COLOR_BTNFACE first punches a grey slab through the game.
            (if (call $ownerdraw_prefill_allowed (local.get $hwnd))
              (then
                (drop (call $gdi_native_fill_rect (local.get $hdc)
                        (i32.const 0) (i32.const 0)
                        (local.get $w) (local.get $h)
                        (i32.const 0x30011)))))
            (drop (call $gdi_native_set_text_color (local.get $hdc)
              (call $win98_sys_color (i32.const 15))))
            (drop (call $gdi_native_set_bk_color (local.get $hdc)
              (call $win98_sys_color (i32.const 20))))
            ;; Keep the live owner-draw destination visible to the Win16
            ;; BitBlt compatibility path while the parent paints it.
            (global.set $btn_about_logo_hdc
              (select (local.get $hdc) (i32.const 0)
                (i32.and (i32.eq (local.get $w) (i32.const 260))
                  (i32.eq (local.get $h) (i32.const 65)))))
            (drop (call $wnd_send_message
              (call $wnd_get_parent (local.get $hwnd))
              (i32.const 0x002B)
              (call $ctrl_table_get_id (local.get $hwnd))
              (call $btn_drawitem_guest (local.get $state))))
            ;; This WM_PAINT was handled by delegating WM_DRAWITEM to the
            ;; owner. Keep validation in WAT so owner-draw buttons do not
            ;; re-enter the paint pump without a fresh invalidation.
            (call $update_clear_hwnd (local.get $hwnd))
            (call $paint_flag_clear_hwnd (local.get $hwnd))
            (return (i32.const 0))))

        (return (i32.const 0))))

    ;; ---------- BM_GETSTATE (0x00F2) ----------
    ;; Public BST bits are not ButtonState.flags: pressed moves from bit0
    ;; to bit2, checked from bit1 to bit0, indeterminate from bit8 to bit1,
    ;; focus stays bit3. Win98 also exposes tracking/origin at 0x20/0x40.
    ;; Private default-border bit2 is not BST_PUSHED.
    (if (i32.eq (local.get $msg) (i32.const 0x00F2))
      (then
        (if (i32.eqz (local.get $state))
          (then (return (call $ctrl_get_check_state (local.get $hwnd)))))
        (local.set $state_w (call $g2w (local.get $state)))
        (local.set $flags (call $btn_flags (local.get $state_w)))
        (return (i32.or (i32.or (i32.and (local.get $flags) (i32.const 8))
          (i32.shr_u (i32.and (local.get $flags) (i32.const 0x600)) (i32.const 4)))
          (i32.or
            (i32.shl (i32.and (local.get $flags) (i32.const 1)) (i32.const 2))
            (call $btn_check_from_flags (local.get $flags)))))))

    ;; ---------- BM_GETCHECK (0x00F0) ----------
    ;; Share the canonical native/legacy check-state reader.
    (if (i32.eq (local.get $msg) (i32.const 0x00F0))
      (then
        (return (call $ctrl_get_check_state (local.get $hwnd)))))

    ;; ---------- BM_SETCHECK (0x00F1) ----------
    ;; For BS_AUTORADIOBUTTON (kind 9) with wParam=1, enforce radio mutex
    ;; by clearing sibling autoradios first — arrow-key navigation in
    ;; renderer-input.js posts BM_SETCHECK directly without going through
    ;; the click path, so without this two radios end up "checked".
    (if (i32.eq (local.get $msg) (i32.const 0x00F1))
      (then
        (local.set $h (call $btn_normalize_check (local.get $hwnd) (local.get $wParam)))
        (if (i32.lt_s (local.get $h) (i32.const 0)) (then (return (i32.const 0))))
        (if (i32.and
              (i32.ne (local.get $wParam) (i32.const 0))
              (i32.eq (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x0F))
                      (i32.const 9)))
          (then (call $autoradio_clear_siblings (local.get $hwnd))))
        (if (local.get $state)
          (then
            (local.set $state_w (call $g2w (local.get $state)))
            (local.set $flags (call $btn_flags_with_check
              (call $btn_flags (local.get $state_w)) (local.get $h)))
            (call $btn_set_flags (local.get $state_w) (local.get $flags))
            (call $invalidate_hwnd (local.get $hwnd))
            (drop (call $wnd_send_message
              (local.get $hwnd) (i32.const 0x000F) (i32.const 0) (i32.const 0)))
            (return (i32.const 0))))
        (call $ctrl_set_check_state (local.get $hwnd) (local.get $wParam))
        (return (i32.const 0))))

    ;; ---------- BM_SETIMAGE (0x00F7) ----------
    ;; wParam=image type (IMAGE_BITMAP=0), lParam=image handle. Return previous.
    (if (i32.eq (local.get $msg) (i32.const 0x00F7))
      (then
        (if (local.get $state)
          (then
            (local.set $state_w (call $g2w (local.get $state)))
            (local.set $img (call $btn_image_handle (local.get $state_w)))
            (if (i32.eq (local.get $wParam) (i32.const 0))
              (then
                (call $btn_set_image (local.get $state_w) (local.get $wParam) (local.get $lParam))
                (call $invalidate_hwnd (local.get $hwnd))))
            (return (local.get $img))))
        (return (i32.const 0))))

    ;; ---------- BM_GETIMAGE (0x00F6) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x00F6))
      (then
        (if (local.get $state)
          (then
            (local.set $state_w (call $g2w (local.get $state)))
            (if (i32.eq (local.get $wParam) (call $btn_image_type (local.get $state_w)))
              (then (return (call $btn_image_handle (local.get $state_w)))))))
        (return (i32.const 0))))

    ;; Default: return 0
    (i32.const 0)
  )

  ;; ---- Static WndProc ----
  ;;
  ;; Paint-only control. No input handling. Same dormancy caveat as
  ;; $button_wndproc — runs when STEP 5 wires WAT dialog creation.

  ;; WM_DRAWITEM for an SS_OWNERDRAW static. $wnd_send_message runs an x86
  ;; owner on a recursive interpreter frame, so the heap DRAWITEMSTRUCT is live
  ;; for the whole call. Layout as $btn_send_drawitem, with CtlType ODT_STATIC
  ;; (5) and ODS_DISABLED the only item state a static can carry.
  (func $static_send_drawitem
      (param $hwnd i32) (param $hdc i32) (param $ctrl_id i32)
      (param $w i32) (param $h i32)
    (local $dis i32) (local $disw i32)
    (local.set $dis (call $heap_alloc (i32.const 48)))
    (if (i32.eqz (local.get $dis)) (then (return)))
    (local.set $disw (call $g2w (local.get $dis)))
    (i32.store           (local.get $disw) (i32.const 5))
    (i32.store offset=4  (local.get $disw)
      (i32.and (local.get $ctrl_id) (i32.const 0xFFFF)))
    (i32.store offset=8  (local.get $disw) (i32.const 0))
    (i32.store offset=12 (local.get $disw) (i32.const 1))   ;; ODA_DRAWENTIRE
    (i32.store offset=16 (local.get $disw)
      (select (i32.const 4) (i32.const 0)                   ;; ODS_DISABLED
        (i32.ne (i32.and (call $wnd_get_style (local.get $hwnd))
          (i32.const 134217728)) (i32.const 0))))            ;; WS_DISABLED
    (i32.store offset=20 (local.get $disw) (local.get $hwnd))
    (i32.store offset=24 (local.get $disw) (local.get $hdc))
    (i32.store offset=28 (local.get $disw) (i32.const 0))
    (i32.store offset=32 (local.get $disw) (i32.const 0))
    (i32.store offset=36 (local.get $disw) (local.get $w))
    (i32.store offset=40 (local.get $disw) (local.get $h))
    (i32.store offset=44 (local.get $disw) (i32.const 0))
    (drop (call $wnd_send_message
            (call $wnd_get_parent (local.get $hwnd))
            (i32.const 0x002B)
            (i32.and (local.get $ctrl_id) (i32.const 0xFFFF))
            (local.get $dis)))
    (call $heap_free (local.get $dis)))

  (func $static_wndproc (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $state i32) (local $state_w i32) (local $cs_w i32)
    (local $hdc i32) (local $sz i32) (local $w i32) (local $h i32)
    (local $name_ptr i32) (local $text_len i32) (local $style i32)
    (local $fmt i32) (local $ex i32) (local $tx_l i32) (local $tx_t i32)
    (local $tx_r i32) (local $tx_b i32) (local $brush i32) (local $ctrl_id i32)
    (local $origin_clip i32) (local $image i32) (local $previous i32)
    (local $full_style i32) (local $bitmap i32) (local $bitmap_w i32)
    (local $bitmap_h i32) (local $bitmap_dc i32) (local $bitmap_owned i32)
    (local $bitmap_x i32) (local $bitmap_y i32)

    (local.set $state (call $wnd_get_state_ptr (local.get $hwnd)))

    ;; ---------- WM_SETFOCUS (0x0007) / WM_KILLFOCUS (0x0008) ----------
    ;; Statics aren't tabstops, but if focus lands here (e.g. an app calls
    ;; SetFocus on a label) keep the global $focus_hwnd consistent.
    (if (i32.eq (local.get $msg) (i32.const 0x0007))
      (then (global.set $focus_hwnd (local.get $hwnd)) (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0008))
      (then
        (if (i32.eq (global.get $focus_hwnd) (local.get $hwnd))
          (then (global.set $focus_hwnd (i32.const 0))))
        (return (i32.const 0))))

    ;; ---------- WM_CREATE (0x0001) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0001))
      (then
        (local.set $cs_w (call $g2w (local.get $lParam)))
        (local.set $name_ptr (i32.load offset=36 (local.get $cs_w)))
        (local.set $style    (i32.load offset=32 (local.get $cs_w)))
        (local.set $state (call $heap_alloc (i32.const 20)))
        (local.set $state_w (call $g2w (local.get $state)))
        (call $static_set_text_ptr  (local.get $state_w) (i32.const 0))
        (call $static_set_text_len  (local.get $state_w) (i32.const 0))
        (call $static_set_style     (local.get $state_w) (local.get $style))
        (call $static_set_image_ord (local.get $state_w) (i32.const 0))
        (call $static_set_font      (local.get $state_w) (i32.const 0))
        (if (local.get $name_ptr)
          (then
            (if (i32.lt_u (local.get $name_ptr) (i32.const 0x10000))
              (then
                (call $static_set_image_ord (local.get $state_w) (local.get $name_ptr)))
              (else
                (local.set $text_len (call $strlen (call $g2w (local.get $name_ptr))))
                (call $static_set_text_ptr (local.get $state_w)
                  (call $ctrl_text_dup (local.get $name_ptr) (local.get $text_len)))
                (call $static_set_text_len (local.get $state_w) (local.get $text_len))))))
        (call $wnd_set_state_ptr (local.get $hwnd) (local.get $state))
        (return (i32.const 0))))

    ;; ---------- WM_DESTROY ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0002))
      (then
        (if (local.get $state)
          (then
            (local.set $state_w (call $g2w (local.get $state)))
            (call $heap_free (call $static_text_ptr (local.get $state_w)))
            (call $heap_free (local.get $state))
            (call $wnd_set_state_ptr (local.get $hwnd) (i32.const 0))))
        (return (i32.const 0))))

    ;; ---------- WM_SETTEXT ----------
    (if (i32.eq (local.get $msg) (i32.const 0x000C))
      (then
        (if (local.get $state)
          (then
            (local.set $state_w (call $g2w (local.get $state)))
            (call $heap_free (call $static_text_ptr (local.get $state_w)))
            (call $static_set_text_ptr (local.get $state_w) (i32.const 0))
            (call $static_set_text_len (local.get $state_w) (i32.const 0))
            (if (local.get $lParam)
              (then
                (local.set $text_len (call $strlen (call $g2w (local.get $lParam))))
                (call $static_set_text_ptr (local.get $state_w)
                  (call $ctrl_text_dup (local.get $lParam) (local.get $text_len)))
                (call $static_set_text_len (local.get $state_w) (local.get $text_len))))
            (if (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x10000000))
              (then (call $invalidate_hwnd (local.get $hwnd))))
            (return (i32.const 1))))
        (return (i32.const 0))))

    ;; ---------- WM_GETTEXT ----------
    (if (i32.eq (local.get $msg) (i32.const 0x000D))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (if (i32.eqz (local.get $wParam)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (local.set $text_len (call $static_text_len (local.get $state_w)))
        (if (i32.ge_u (local.get $text_len) (local.get $wParam))
          (then (local.set $text_len (i32.sub (local.get $wParam) (i32.const 1)))))
        (if (call $static_text_ptr (local.get $state_w))
          (then (if (local.get $text_len)
                  (then (call $memcpy (call $g2w (local.get $lParam))
                                      (call $g2w (call $static_text_ptr (local.get $state_w)))
                                      (local.get $text_len))))))
        (i32.store8 (i32.add (call $g2w (local.get $lParam)) (local.get $text_len)) (i32.const 0))
        (return (local.get $text_len))))

    ;; ---------- WM_GETTEXTLENGTH ----------
    (if (i32.eq (local.get $msg) (i32.const 0x000E))
      (then
        (if (local.get $state)
          (then (return (call $static_text_len (call $g2w (local.get $state))))))
        (return (i32.const 0))))

    ;; ---------- WM_SETFONT / WM_GETFONT ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0030))
      (then
        (if (local.get $state)
          (then
            (call $static_set_font (call $g2w (local.get $state)) (local.get $wParam))
            (if (local.get $lParam) (then (call $invalidate_hwnd (local.get $hwnd))))))
        (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0031))
      (then
        (if (local.get $state)
          (then (return (call $static_font (call $g2w (local.get $state))))))
        (return (i32.const 0))))

    ;; ---------- STM_SETICON / STM_GETICON ----------
    ;; Win16 STATIC messages are translated from 0x400/0x401 to the Win32
    ;; numbers before arriving here. Preserve the actual interned HICON, not
    ;; merely a template resource ordinal, so dynamically assigned icons paint.
    (if (i32.eq (local.get $msg) (i32.const 0x0170))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (local.set $previous (call $static_image_ord (local.get $state_w)))
        (local.set $image
          (select (call $win16_h32 (local.get $wParam)) (local.get $wParam)
            (global.get $is_win16)))
        (call $static_set_image_ord (local.get $state_w) (local.get $image))
        ;; A zero-sized SS_ICON template asks USER to adopt the icon's natural
        ;; dimensions. WEPUTIL uses exactly this form for its About icon.
        (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
        (local.set $w (i32.and (local.get $sz) (i32.const 0xFFFF)))
        (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
        (if (i32.or (i32.eqz (local.get $w)) (i32.eqz (local.get $h)))
          (then
            (call $ctrl_geom_set (call $wnd_table_find (local.get $hwnd))
              (call $ctrl_get_x_s (local.get $hwnd))
              (call $ctrl_get_y_s (local.get $hwnd))
              (select (local.get $w) (i32.const 32) (local.get $w))
              (select (local.get $h) (i32.const 32) (local.get $h)))))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (local.get $previous))))
    (if (i32.eq (local.get $msg) (i32.const 0x0171))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (return (call $static_image_ord (call $g2w (local.get $state))))))

    ;; ---------- STM_SETIMAGE / STM_GETIMAGE ----------
    ;; HBITMAP is carried in lParam for STM_SETIMAGE; unlike a resource
    ;; ordinal supplied at creation, the caller retains ownership.
    (if (i32.eq (local.get $msg) (i32.const 0x0172))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (if (i32.or
              (i32.ne (local.get $wParam) (i32.const 0)) ;; IMAGE_BITMAP
              (i32.ne
                (i32.and (call $static_style (local.get $state_w)) (i32.const 0x0F))
                (i32.const 0x0E)))
          (then (return (i32.const 0))))
        (local.set $previous (call $static_image_ord (local.get $state_w)))
        (call $static_set_image_ord (local.get $state_w) (local.get $lParam))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (local.get $previous))))
    (if (i32.eq (local.get $msg) (i32.const 0x0173))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (if (i32.or
              (i32.ne (local.get $wParam) (i32.const 0)) ;; IMAGE_BITMAP
              (i32.ne
                (i32.and (call $static_style (local.get $state_w)) (i32.const 0x0F))
                (i32.const 0x0E)))
          (then (return (i32.const 0))))
        (return (call $static_image_ord (local.get $state_w)))))

    ;; ---------- WM_PAINT ----------
    (if (i32.eq (local.get $msg) (i32.const 0x000F))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        ;; NSIS installer branding label. It is decorative, and with the
        ;; emulator's current font metrics it collides with the wizard
        ;; buttons; suppress it instead of painting unreadable overlap.
        (if (i32.eq (call $ctrl_table_get_id (local.get $hwnd)) (i32.const 1028))
          (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (local.set $hdc (i32.add (local.get $hwnd) (i32.const 0x40000)))
        ;; Geometry from CONTROL_GEOM (parent has already painted the
        ;; dialog face background via WM_ERASEBKGND, so no fill here).
        (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
        (local.set $w (i32.and (local.get $sz) (i32.const 0xFFFF)))
        (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
        (local.set $full_style (call $static_style (local.get $state_w)))
        (local.set $style (i32.and (local.get $full_style) (i32.const 0x1F)))
        (local.set $ex (call $ctrl_get_ex_style (local.get $hwnd)))
        (local.set $ctrl_id (call $ctrl_table_get_id (local.get $hwnd)))
        ;; Etched statics are borders, not labels. In particular, do not erase
        ;; artwork the parent painted inside an SS_ETCHEDFRAME rectangle.
        (if (i32.and (i32.ge_u (local.get $style) (i32.const 0x10))
                     (i32.le_u (local.get $style) (i32.const 0x12)))
          (then
            (drop (call $gdi_native_draw_edge (local.get $hdc)
              (i32.const 0) (i32.const 0) (local.get $w) (local.get $h)
              (i32.const 6) ;; EDGE_ETCHED, without BF_MIDDLE
              (if (result i32) (i32.eq (local.get $style) (i32.const 0x10))
                (then (i32.const 0x0A)) ;; BF_TOP | BF_BOTTOM
                (else (select (i32.const 0x05) (i32.const 0x0F)
                  (i32.eq (local.get $style) (i32.const 0x11)))))))
            (return (i32.const 0))))
        ;; SS_OWNERDRAW (0x0D): USER paints nothing itself and hands the
        ;; whole client to the parent as WM_DRAWITEM/ODT_STATIC. War Wind's
        ;; Multiplayer Wizard draws its page artwork this way.
        (if (i32.eq (local.get $style) (i32.const 0x0D))
          (then
            (call $static_send_drawitem (local.get $hwnd) (local.get $hdc)
              (local.get $ctrl_id) (local.get $w) (local.get $h))
            (return (i32.const 0))))
        ;; Default text rect = full client.
        (local.set $tx_l (i32.const 0))
        (local.set $tx_t (i32.const 0))
        (local.set $tx_r (local.get $w))
        (local.set $tx_b (local.get $h))
        ;; WS_EX_CLIENTEDGE (0x200): paint white interior + sunken edge
        ;; (calc's display "0." field + memory indicator both use this).
        ;; Inset the text rect so glyphs don't touch the sunken edge.
        ;; Calc's display is a right-aligned client-edge static; Win98
        ;; leaves a few pixels of inner padding there.
        (if (i32.and (local.get $ex) (i32.const 0x200))
          (then
            (drop (call $gdi_native_fill_rect (local.get $hdc)
                    (i32.const 0) (i32.const 0)
                    (local.get $w) (local.get $h)
                    (i32.const 0x30010)))  ;; WHITE_BRUSH
            (drop (call $gdi_native_draw_edge (local.get $hdc)
                    (i32.const 0) (i32.const 0)
                    (local.get $w) (local.get $h)
                    (i32.const 0x0A) (i32.const 0x0F)))  ;; EDGE_SUNKEN | BF_RECT
            (local.set $tx_l (i32.const 4))
            (local.set $tx_t (i32.const 1))
            (local.set $tx_r (i32.sub (local.get $w) (i32.const 4)))
            (local.set $tx_b (i32.sub (local.get $h) (i32.const 1))))
          (else
            ;; SS_BLACKRECT/SS_GRAYRECT/SS_WHITERECT paint their whole client
            ;; rect and do not render label text.
            (local.set $brush (i32.const 0))
            (if (i32.eq (local.get $style) (i32.const 4))
              (then (local.set $brush (i32.const 0x30014)))) ;; BLACK_BRUSH
            (if (i32.eq (local.get $style) (i32.const 5))
              (then (local.set $brush (i32.const 0x30012)))) ;; GRAY_BRUSH
            (if (i32.eq (local.get $style) (i32.const 6))
              (then (local.set $brush (i32.const 0x30010)))) ;; WHITE_BRUSH
            (if (local.get $brush)
              (then
                (drop (call $gdi_native_fill_rect (local.get $hdc)
                        (i32.const 0) (i32.const 0)
                        (local.get $w) (local.get $h)
                        (local.get $brush)))
                (return (i32.const 0))))
            ;; SS_BLACKFRAME/SS_GRAYFRAME/SS_WHITEFRAME paint a one-pixel
            ;; rectangle frame and do not render label text.
            (local.set $brush (i32.const 0))
            (if (i32.eq (local.get $style) (i32.const 7))
              (then (local.set $brush (i32.const 0x30014)))) ;; BLACK_BRUSH
            (if (i32.eq (local.get $style) (i32.const 8))
              (then (local.set $brush (i32.const 0x30012)))) ;; GRAY_BRUSH
            (if (i32.eq (local.get $style) (i32.const 9))
              (then (local.set $brush (i32.const 0x30010)))) ;; WHITE_BRUSH
            (if (local.get $brush)
              (then
                (drop (call $gdi_native_fill_rect (local.get $hdc)
                        (i32.const 0) (i32.const 0)
                        (local.get $w) (i32.const 1)
                        (local.get $brush)))
                (drop (call $gdi_native_fill_rect (local.get $hdc)
                        (i32.const 0) (i32.sub (local.get $h) (i32.const 1))
                        (local.get $w) (local.get $h)
                        (local.get $brush)))
                (drop (call $gdi_native_fill_rect (local.get $hdc)
                        (i32.const 0) (i32.const 0)
                        (i32.const 1) (local.get $h)
                        (local.get $brush)))
                (drop (call $gdi_native_fill_rect (local.get $hdc)
                        (i32.sub (local.get $w) (i32.const 1)) (i32.const 0)
                        (local.get $w) (local.get $h)
                        (local.get $brush)))
                (return (i32.const 0))))
            ;; Erase the static's rect for label types. Parent's WM_ERASEBKGND
            ;; ran once at create time, but subsequent SetWindowText invalidates
            ;; only the static — without this fill, new text composites on top of
            ;; the previous text (visible in calc's display as digit pile-up).
            (if (i32.or (i32.lt_u (local.get $style) (i32.const 4))
                        (i32.gt_u (local.get $style) (i32.const 9)))
              (then
                ;; VB's bordered ThunderLabel fields use a white BackColor;
                ;; plain captions inherit the form face.
                (local.set $brush
                  (select (i32.const 0x30010) (i32.const 0x30011)
                    (i32.ne (i32.and (call $wnd_get_style (local.get $hwnd))
                      (i32.const 0x00800000)) (i32.const 0))))
                (drop (call $gdi_native_fill_rect (local.get $hdc)
                        (i32.const 0) (i32.const 0)
                        (local.get $w) (local.get $h)
                        (local.get $brush)))))))
        ;; Use the font supplied through WM_SETFONT, falling back to the
        ;; Win98 default GUI font for ordinary dialog labels.
        ;; TRANSPARENT bk mode so the label glyphs let the fill color show
        ;; through instead of painting an opaque white box behind every word.
        (drop (call $gdi_native_select_object (local.get $hdc)
          (select (call $static_font (local.get $state_w)) (i32.const 0x30021)
            (i32.ne (call $static_font (local.get $state_w)) (i32.const 0)))))
        (drop (call $gdi_native_set_bk_mode (local.get $hdc) (i32.const 1)))
        ;; SS_BITMAP accepts either a dialog-template RT_BITMAP ordinal or an
        ;; HBITMAP installed with STM_SETIMAGE. Resource bitmaps are temporary
        ;; WAT GDI objects: release them after the blit so repainting a static
        ;; cannot exhaust the fixed object table.
        (if (i32.and
              (i32.eq (local.get $style) (i32.const 0x0E))
              (i32.ne (call $static_image_ord (local.get $state_w)) (i32.const 0)))
          (then
            (local.set $image (call $static_image_ord (local.get $state_w)))
            (local.set $bitmap_owned (i32.lt_u (local.get $image) (i32.const 0x10000)))
            (local.set $bitmap
              (if (result i32) (local.get $bitmap_owned)
                (then (call $gdi_bitmap_load_resource
                  (i32.const 0) (local.get $image) (i32.const 0)))
                (else (local.get $image))))
            (if (local.get $bitmap)
              (then
                (local.set $bitmap_w (call $gdi_native_get_object_w (local.get $bitmap)))
                (local.set $bitmap_h (call $gdi_native_get_object_h (local.get $bitmap)))
                (if (i32.and
                      (i32.and
                        (i32.gt_s (local.get $bitmap_w) (i32.const 0))
                        (i32.gt_s (local.get $bitmap_h) (i32.const 0)))
                      (i32.and
                        (i32.eqz (i32.and (local.get $full_style) (i32.const 0x200))) ;; SS_CENTERIMAGE
                        (i32.eqz (i32.and (local.get $full_style) (i32.const 0x40))))) ;; SS_REALSIZECONTROL
                  (then
                    ;; SS_BITMAP ignores the requested extent and adopts the
                    ;; image's natural size. SS_RIGHTJUST keeps the original
                    ;; lower-right corner fixed while that adjustment occurs.
                    (local.set $bitmap_x (call $ctrl_get_x_s (local.get $hwnd)))
                    (local.set $bitmap_y (call $ctrl_get_y_s (local.get $hwnd)))
                    (if (i32.and (local.get $full_style) (i32.const 0x400))
                      (then
                        (local.set $bitmap_x
                          (i32.add (local.get $bitmap_x)
                            (i32.sub (local.get $w) (local.get $bitmap_w))))
                        (local.set $bitmap_y
                          (i32.add (local.get $bitmap_y)
                            (i32.sub (local.get $h) (local.get $bitmap_h))))))
                    (call $ctrl_geom_set (call $wnd_table_find (local.get $hwnd))
                      (local.get $bitmap_x) (local.get $bitmap_y)
                      (local.get $bitmap_w) (local.get $bitmap_h))
                    (local.set $w (local.get $bitmap_w))
                    (local.set $h (local.get $bitmap_h))
                    ;; The paint DC was bound above using the template extent.
                    ;; Rebuild its USER clip before drawing the resized image.
                    (call $dc_apply_client_clip (local.get $hdc) (local.get $hwnd))))
                (if (i32.and
                      (i32.gt_s (local.get $bitmap_w) (i32.const 0))
                      (i32.gt_s (local.get $bitmap_h) (i32.const 0)))
                  (then
                    (local.set $bitmap_x (i32.const 0))
                    (local.set $bitmap_y (i32.const 0))
                    (if (i32.and (local.get $full_style) (i32.const 0x200)) ;; SS_CENTERIMAGE
                      (then
                        (local.set $bitmap_x
                          (i32.div_s (i32.sub (local.get $w) (local.get $bitmap_w))
                            (i32.const 2)))
                        (local.set $bitmap_y
                          (i32.div_s (i32.sub (local.get $h) (local.get $bitmap_h))
                            (i32.const 2)))))
                    (local.set $bitmap_dc (call $gdi_native_create_compat_dc (local.get $hdc)))
                    (if (local.get $bitmap_dc)
                      (then
                        (drop (call $gdi_native_select_object
                          (local.get $bitmap_dc) (local.get $bitmap)))
                        (if (i32.and
                              (i32.ne
                                (i32.and (local.get $full_style) (i32.const 0x40))
                                (i32.const 0))
                              (i32.eqz
                                (i32.and (local.get $full_style) (i32.const 0x200))))
                          (then
                            (drop (call $gdi_native_stretch_blt
                              (local.get $hdc) (i32.const 0) (i32.const 0)
                              (local.get $w) (local.get $h)
                              (local.get $bitmap_dc) (i32.const 0) (i32.const 0)
                              (local.get $bitmap_w) (local.get $bitmap_h)
                              (i32.const 0x00CC0020)))) ;; SRCCOPY
                          (else
                            (drop (call $gdi_native_bitblt
                              (local.get $hdc)
                              (local.get $bitmap_x) (local.get $bitmap_y)
                              (local.get $bitmap_w) (local.get $bitmap_h)
                              (local.get $bitmap_dc) (i32.const 0) (i32.const 0)
                              (i32.const 0x00CC0020))))) ;; SRCCOPY
                        (drop (call $gdi_native_delete_dc (local.get $bitmap_dc)))))))
                (if (local.get $bitmap_owned)
                  (then (drop (call $gdi_object_delete_full (local.get $bitmap)))))))
            (return (i32.const 0))))
        ;; SS_ICON dialog controls preserve their RT_GROUP_ICON ordinal in the
        ;; static state. Decode the color plane and transparency mask through
        ;; the canonical WAT raster path.
        (if (i32.and
              (i32.eq (local.get $style) (i32.const 3))
              (i32.ne (call $static_image_ord (local.get $state_w)) (i32.const 0)))
          (then
            ;; Compact Win9x statics commonly clip a padded 32x32 icon DIB at
            ;; its origin; larger illustration controls use centered layout.
            (local.set $origin_clip
              (i32.and (i32.le_u (local.get $w) (i32.const 16))
                       (i32.le_u (local.get $h) (i32.const 16))))
            (local.set $image (call $static_image_ord (local.get $state_w)))
            (if (i32.eq
                  (i32.and (local.get $image) (i32.const 0xFFFF0000))
                  (global.get $ICON_HANDLE_TAG))
              (then
                (if (call $icon_draw_handle (local.get $image) (local.get $hdc)
                      (i32.const 0) (i32.const 0) (local.get $w) (local.get $h)
                      (global.get $DI_NORMAL))
                  (then (return (i32.const 0)))))
              (else
                (if (call $gdi_icon_draw_resource
                      (local.get $hdc) (local.get $image)
                      (local.get $w) (local.get $h) (local.get $origin_clip))
                  (then (return (i32.const 0))))))))
        ;; A few mixer builds reference absent speaker resources 301/302.
        ;; Preserve the compact monochrome fallback for those missing icons.
        (if (i32.and
              (i32.eq (local.get $style) (i32.const 3))
              (i32.and
                (i32.and (i32.ge_u (local.get $w) (i32.const 10))
                         (i32.le_u (local.get $w) (i32.const 16)))
                (i32.and
                  (i32.and (i32.ge_u (local.get $h) (i32.const 10))
                           (i32.le_u (local.get $h) (i32.const 16)))
                  (i32.or
                    (i32.eq (call $static_image_ord (local.get $state_w)) (i32.const 301))
                    (i32.eq (call $static_image_ord (local.get $state_w)) (i32.const 302))))))
          (then
            (if (i32.eq (call $static_image_ord (local.get $state_w)) (i32.const 301))
              (then
                ;; Left-facing speaker.
                (drop (call $gdi_native_fill_rect (local.get $hdc)
                        (i32.const 1) (i32.const 5) (i32.const 4) (i32.const 10)
                        (i32.const 0x30014)))
                (drop (call $gdi_native_fill_rect (local.get $hdc)
                        (i32.const 4) (i32.const 3) (i32.const 6) (i32.const 12)
                        (i32.const 0x30014)))
                (drop (call $gdi_native_fill_rect (local.get $hdc)
                        (i32.const 6) (i32.const 2) (i32.const 7) (i32.const 13)
                        (i32.const 0x30014)))
                (drop (call $gdi_native_fill_rect (local.get $hdc)
                        (i32.const 9) (i32.const 5) (i32.const 10) (i32.const 10)
                        (i32.const 0x30014))))
              (else
                ;; Mirrored right-facing speaker.
                (drop (call $gdi_native_fill_rect (local.get $hdc)
                        (i32.const 8) (i32.const 5) (i32.const 11) (i32.const 10)
                        (i32.const 0x30014)))
                (drop (call $gdi_native_fill_rect (local.get $hdc)
                        (i32.const 6) (i32.const 3) (i32.const 8) (i32.const 12)
                        (i32.const 0x30014)))
                (drop (call $gdi_native_fill_rect (local.get $hdc)
                        (i32.const 5) (i32.const 2) (i32.const 6) (i32.const 13)
                        (i32.const 0x30014)))
                (drop (call $gdi_native_fill_rect (local.get $hdc)
                        (i32.const 2) (i32.const 5) (i32.const 3) (i32.const 10)
                        (i32.const 0x30014)))))
            (return (i32.const 0))))
        ;; SS_ICON(3), SS_BITMAP(0x0E): skip text — these display images, not labels
        (if (i32.and
              (i32.ne (local.get $style) (i32.const 3))
              (i32.ne (local.get $style) (i32.const 0x0E)))
          (then
          (if (call $static_text_ptr (local.get $state_w))
            (then
              ;; SS_LEFT(0)/SS_CENTER(1)/SS_RIGHT(2) use DT_WORDBREAK for multi-line.
              ;; Text statics also expand tabs; Paint's Attributes dialog uses
              ;; them to align the two "Not Available" values.
              ;; SS_SIMPLE(0x0B), SS_LEFTNOWORDWRAP(0x0C) use DT_SINGLELINE.
              (local.set $fmt (if (result i32) (i32.le_u (local.get $style) (i32.const 2))
                (then (i32.const 0x10))    ;; DT_WORDBREAK
                (else (i32.const 0x24))))  ;; DT_VCENTER|DT_SINGLELINE
              (if (i32.eq (local.get $style) (i32.const 1))
                (then (local.set $fmt (i32.or (local.get $fmt) (i32.const 0x01))))) ;; DT_CENTER
              (if (i32.eq (local.get $style) (i32.const 2))
                (then (local.set $fmt (i32.or (local.get $fmt) (i32.const 0x02))))) ;; DT_RIGHT
              (if (i32.and (local.get $ex) (i32.const 0x200))
                (then (local.set $fmt
                  (i32.or
                    (i32.and (local.get $fmt) (i32.const 0x03)) ;; keep horizontal alignment
                    (i32.const 0x24))))) ;; DT_VCENTER|DT_SINGLELINE
              (if (i32.or
                    (i32.le_u (local.get $style) (i32.const 2))
                    (i32.eq (local.get $style) (i32.const 0x0C)))
                (then (local.set $fmt
                  (i32.or (local.get $fmt) (i32.const 0x40))))) ;; DT_EXPANDTABS
              (drop (call $gdi_native_draw_text (local.get $hdc)
                      (call $g2w (call $static_text_ptr (local.get $state_w)))
                      (call $static_text_len (local.get $state_w))
                      (call $paint_rect (local.get $tx_l) (local.get $tx_t)
                                        (local.get $tx_r) (local.get $tx_b))
                      (local.get $fmt) (i32.const 0)))))))
        (return (i32.const 0))))

    ;; Default
    (i32.const 0)
  )

  ;; ---- SysLink WndProc ----
  ;;
  ;; SysLink understands a small markup subset: text outside <a ...>...</a>
  ;; paints as an ordinary label, the anchor run paints in the Win32 hyperlink
  ;; blue with an underline. DrawText cannot express two colors within one
  ;; wrapped paragraph, so the word-wrap loop lives here: measure each word,
  ;; break when it would overflow the client width, emit it with the colour the
  ;; current markup state calls for.
  ;;
  ;; A click falls through to the default: NM_CLICK exists so the owner can
  ;; hand a URL to ShellExecute, and there is no browser here to hand it to.
  (func $syslink_wndproc (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $state i32) (local $state_w i32) (local $cs_w i32)
    (local $name_ptr i32) (local $text_len i32) (local $style i32)
    (local $hdc i32) (local $sz i32) (local $w i32) (local $h i32)
    (local $tw i32) (local $n i32) (local $i i32) (local $j i32)
    (local $c i32) (local $x i32) (local $y i32) (local $lh i32)
    (local $sp i32) (local $ww i32) (local $in_link i32) (local $brush i32)
    (local $closing i32)

    (local.set $state (call $wnd_get_state_ptr (local.get $hwnd)))

    ;; ---------- WM_CREATE ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0001))
      (then
        (local.set $cs_w (call $g2w (local.get $lParam)))
        (local.set $name_ptr (i32.load offset=36 (local.get $cs_w)))
        (local.set $style    (i32.load offset=32 (local.get $cs_w)))
        (local.set $state (call $heap_alloc (i32.const 20)))
        (local.set $state_w (call $g2w (local.get $state)))
        (call $static_set_text_ptr  (local.get $state_w) (i32.const 0))
        (call $static_set_text_len  (local.get $state_w) (i32.const 0))
        (call $static_set_style     (local.get $state_w) (local.get $style))
        (call $static_set_image_ord (local.get $state_w) (i32.const 0))
        (call $static_set_font      (local.get $state_w) (i32.const 0))
        ;; A SysLink caption is always a real string; ordinal captions are a
        ;; static-only convention and would be a template authoring error here.
        (if (i32.gt_u (local.get $name_ptr) (i32.const 0xFFFF))
          (then
            (local.set $text_len (call $strlen (call $g2w (local.get $name_ptr))))
            (call $static_set_text_ptr (local.get $state_w)
              (call $ctrl_text_dup (local.get $name_ptr) (local.get $text_len)))
            (call $static_set_text_len (local.get $state_w) (local.get $text_len))))
        (call $wnd_set_state_ptr (local.get $hwnd) (local.get $state))
        (return (i32.const 0))))

    ;; ---------- WM_DESTROY ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0002))
      (then
        (if (local.get $state)
          (then
            (local.set $state_w (call $g2w (local.get $state)))
            (call $heap_free (call $static_text_ptr (local.get $state_w)))
            (call $heap_free (local.get $state))
            (call $wnd_set_state_ptr (local.get $hwnd) (i32.const 0))))
        (return (i32.const 0))))

    ;; ---------- WM_SETTEXT ----------
    (if (i32.eq (local.get $msg) (i32.const 0x000C))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (call $heap_free (call $static_text_ptr (local.get $state_w)))
        (call $static_set_text_ptr (local.get $state_w) (i32.const 0))
        (call $static_set_text_len (local.get $state_w) (i32.const 0))
        (if (local.get $lParam)
          (then
            (local.set $text_len (call $strlen (call $g2w (local.get $lParam))))
            (call $static_set_text_ptr (local.get $state_w)
              (call $ctrl_text_dup (local.get $lParam) (local.get $text_len)))
            (call $static_set_text_len (local.get $state_w) (local.get $text_len))))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.const 1))))

    ;; ---------- WM_GETTEXTLENGTH ----------
    (if (i32.eq (local.get $msg) (i32.const 0x000E))
      (then
        (if (local.get $state)
          (then (return (call $static_text_len (call $g2w (local.get $state))))))
        (return (i32.const 0))))

    ;; ---------- WM_GETTEXT ----------
    (if (i32.eq (local.get $msg) (i32.const 0x000D))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (if (i32.eqz (local.get $wParam)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (local.set $text_len (call $static_text_len (local.get $state_w)))
        (if (i32.ge_u (local.get $text_len) (local.get $wParam))
          (then (local.set $text_len (i32.sub (local.get $wParam) (i32.const 1)))))
        ;; Both operands have to be 0/1 here: the text pointer is a heap
        ;; address, so ANDing it raw against a predicate cleared its low bit
        ;; and every SysLink WM_GETTEXT answered with an untouched buffer.
        (if (i32.and (i32.ne (call $static_text_ptr (local.get $state_w)) (i32.const 0))
                     (i32.ne (local.get $text_len) (i32.const 0)))
          (then (call $memcpy (call $g2w (local.get $lParam))
                              (call $g2w (call $static_text_ptr (local.get $state_w)))
                              (local.get $text_len))))
        (i32.store8 (i32.add (call $g2w (local.get $lParam)) (local.get $text_len)) (i32.const 0))
        (return (local.get $text_len))))

    ;; ---------- WM_PAINT ----------
    (if (i32.eq (local.get $msg) (i32.const 0x000F))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (if (i32.eqz (call $static_text_ptr (local.get $state_w))) (then (return (i32.const 0))))
        (local.set $hdc (i32.add (local.get $hwnd) (i32.const 0x40000)))
        (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
        (local.set $w (i32.and (local.get $sz) (i32.const 0xFFFF)))
        (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
        (drop (call $gdi_native_fill_rect (local.get $hdc)
                (i32.const 0) (i32.const 0) (local.get $w) (local.get $h)
                (i32.const 0x30011)))  ;; LTGRAY_BRUSH ≈ COLOR_3DFACE
        (drop (call $gdi_native_select_object (local.get $hdc) (i32.const 0x30021)))
        (drop (call $gdi_native_set_bk_mode (local.get $hdc) (i32.const 1)))
        (local.set $lh (i32.and (call $host_get_text_metrics (local.get $hdc)) (i32.const 0xFFFF)))
        (if (i32.eqz (local.get $lh)) (then (local.set $lh (i32.const 13))))
        (local.set $sp (call $host_measure_text (local.get $hdc) (region.addr $RESERVED_PAGE_STRINGS 0xC8) (i32.const 1) (i32.const 0)))
        (local.set $tw (call $g2w (call $static_text_ptr (local.get $state_w))))
        (local.set $n (call $static_text_len (local.get $state_w)))
        (local.set $i (i32.const 0))
        (local.set $x (i32.const 0))
        (local.set $y (i32.const 0))
        (local.set $in_link (i32.const 0))
        (block $done (loop $word
          (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
          (local.set $c (i32.load8_u (i32.add (local.get $tw) (local.get $i))))
          ;; Whitespace: one space of advance, collapsed like HTML.
          (if (i32.or (i32.eq (local.get $c) (i32.const 32))
                      (i32.or (i32.eq (local.get $c) (i32.const 9))
                              (i32.or (i32.eq (local.get $c) (i32.const 13))
                                      (i32.eq (local.get $c) (i32.const 10)))))
            (then
              (if (local.get $x) (then (local.set $x (i32.add (local.get $x) (local.get $sp)))))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $word)))
          ;; Markup tag: <a ...> opens a link run, </a> closes it. Anything
          ;; else in angle brackets is skipped the same way.
          (if (i32.eq (local.get $c) (i32.const 60))
            (then
              (local.set $j (i32.add (local.get $i) (i32.const 1)))
              (local.set $closing
                (i32.eq (i32.load8_u (i32.add (local.get $tw) (local.get $j))) (i32.const 47)))
              (block $tagend (loop $tagscan
                (br_if $tagend (i32.ge_u (local.get $j) (local.get $n)))
                (br_if $tagend (i32.eq (i32.load8_u (i32.add (local.get $tw) (local.get $j)))
                                       (i32.const 62)))
                (local.set $j (i32.add (local.get $j) (i32.const 1)))
                (br $tagscan)))
              (local.set $in_link (i32.eqz (local.get $closing)))
              (local.set $i (i32.add (local.get $j) (i32.const 1)))
              (br $word)))
          ;; Word: runs to the next space or tag.
          (local.set $j (local.get $i))
          (block $wend (loop $wscan
            (br_if $wend (i32.ge_u (local.get $j) (local.get $n)))
            (local.set $c (i32.load8_u (i32.add (local.get $tw) (local.get $j))))
            (br_if $wend (i32.eq (local.get $c) (i32.const 32)))
            (br_if $wend (i32.eq (local.get $c) (i32.const 9)))
            (br_if $wend (i32.eq (local.get $c) (i32.const 13)))
            (br_if $wend (i32.eq (local.get $c) (i32.const 10)))
            (br_if $wend (i32.eq (local.get $c) (i32.const 60)))
            (local.set $j (i32.add (local.get $j) (i32.const 1)))
            (br $wscan)))
          (local.set $ww (call $host_measure_text (local.get $hdc)
                           (i32.add (local.get $tw) (local.get $i))
                           (i32.sub (local.get $j) (local.get $i))
                           (i32.const 0)))
          (if (i32.and (i32.gt_u (i32.add (local.get $x) (local.get $ww)) (local.get $w))
                       (i32.ne (local.get $x) (i32.const 0)))
            (then
              (local.set $x (i32.const 0))
              (local.set $y (i32.add (local.get $y) (local.get $lh)))))
          (br_if $done (i32.gt_u (i32.add (local.get $y) (local.get $lh)) (local.get $h)))
          (drop (call $gdi_native_set_text_color (local.get $hdc)
                  (select (i32.const 0x00CC6600) (i32.const 0x00000000) (local.get $in_link))))
          (drop (call $gdi_native_text_out (local.get $hdc)
                  (local.get $x) (local.get $y)
                  (i32.add (local.get $tw) (local.get $i))
                  (i32.sub (local.get $j) (local.get $i))
                  (i32.const 0)))
          (if (local.get $in_link)
            (then
              (local.set $brush (call $gdi_native_create_solid_brush (i32.const 0x00CC6600)))
              (drop (call $gdi_native_fill_rect (local.get $hdc)
                      (local.get $x) (i32.sub (i32.add (local.get $y) (local.get $lh)) (i32.const 2))
                      (i32.add (local.get $x) (local.get $ww))
                      (i32.sub (i32.add (local.get $y) (local.get $lh)) (i32.const 1))
                      (local.get $brush)))
              (drop (call $gdi_native_delete_object (local.get $brush)))))
          (local.set $x (i32.add (local.get $x) (local.get $ww)))
          (local.set $i (local.get $j))
          (br $word)))
        (drop (call $gdi_native_set_text_color (local.get $hdc) (i32.const 0x00000000)))
        (return (i32.const 0))))

    (i32.const 0)
  )

  ;; ---- StatusBar WndProc ----
  ;;
  ;; Paint a compact Win9x status line into the shared top-level surface.
  ;; Leaving this class as a no-op exposed pixels from the MDI view's initial
  ;; full-height horizontal scrollbar after Paint docked the view above the
  ;; status bar.  The title table is the authoritative text store because MFC
  ;; updates its prompt with SetWindowTextA.

  ;; Paint's MFC status bar is distinguishable without inspecting its title:
  ;; ID 0xE801 is accompanied by the 0xE900 scroll view in the same frame.
  ;; Other applications keep the generic one-pane common-control rendering.
  (func $statusbar_is_paint (param $hwnd i32) (result i32)
    (local $parent i32)
    (if (i32.ne (call $ctrl_table_get_id (local.get $hwnd)) (i32.const 0xE801))
      (then (return (i32.const 0))))
    (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
    (i32.ne (call $ctrl_find_by_id (local.get $parent) (i32.const 0xE900)) (i32.const 0)))

  ;; Write an unsigned decimal value into WAT memory and return its length.
  ;; Paint coordinates are clamped before this helper is called.
  (func $statusbar_write_uint (param $dst i32) (param $value i32) (result i32)
    (local $digits i32) (local $remaining i32) (local $i i32)
    (local.set $remaining (local.get $value))
    (local.set $digits (i32.const 1))
    (block $count_done
      (loop $count
        (br_if $count_done (i32.lt_u (local.get $remaining) (i32.const 10)))
        (local.set $remaining (i32.div_u (local.get $remaining) (i32.const 10)))
        (local.set $digits (i32.add (local.get $digits) (i32.const 1)))
        (br $count)))
    (local.set $remaining (local.get $value))
    (local.set $i (local.get $digits))
    (block $write_done
      (loop $write
        (local.set $i (i32.sub (local.get $i) (i32.const 1)))
        (i32.store8
          (i32.add (local.get $dst) (local.get $i))
          (i32.add (i32.rem_u (local.get $remaining) (i32.const 10)) (i32.const 48)))
        (local.set $remaining (i32.div_u (local.get $remaining) (i32.const 10)))
        (br_if $write_done (i32.eqz (local.get $i)))
        (br $write)))
    (local.get $digits))

  ;; Win98's sizing grip is a right triangle of diagonal ribs in the bar's
  ;; bottom-right corner. Counting back from the corner as dx/dy, a pixel is
  ;; part of the grip while dx + dy <= 11, and its color cycles on
  ;; (dx + dy) mod 4: 3 is 3DHILIGHT, 2 and 1 are 3DSHADOW, 0 is bare face.
  ;; That produces three ribs of one highlight and two shadow pixels, spaced
  ;; four apart, each running from the bottom edge up to the right edge.
  ;;
  ;; Measured off real Windows 98 under v86 with
  ;; `node tools/png-crop.js <shot> --probe=X,Y,W,H`. The previous six-mark
  ;; staircase used DKGRAY_BRUSH (#404040), a color the Win98 grip never
  ;; contains, and covered about a third of the area.
  (func $statusbar_draw_size_grip (param $hdc i32) (param $w i32) (param $h i32)
    (local $dx i32) (local $dy i32) (local $step i32) (local $brush i32)
    (local $x i32) (local $y i32)
    (local.set $dy (i32.const 0))
    (block $rows_done
      (loop $rows
        (br_if $rows_done (i32.gt_u (local.get $dy) (i32.const 11)))
        (local.set $dx (i32.const 0))
        (block $cols_done
          (loop $cols
            (br_if $cols_done (i32.gt_u
              (i32.add (local.get $dx) (local.get $dy)) (i32.const 11)))
            (local.set $step
              (i32.rem_u (i32.add (local.get $dx) (local.get $dy)) (i32.const 4)))
            (local.set $brush (i32.const 0))
            (if (i32.eq (local.get $step) (i32.const 3))
              (then (local.set $brush (i32.const 0x30010))))  ;; WHITE_BRUSH
            (if (i32.or (i32.eq (local.get $step) (i32.const 1))
                        (i32.eq (local.get $step) (i32.const 2)))
              (then (local.set $brush (i32.const 0x30012))))  ;; GRAY_BRUSH
            (if (local.get $brush)
              (then
                (local.set $x (i32.sub (i32.sub (local.get $w) (i32.const 1))
                                       (local.get $dx)))
                (local.set $y (i32.sub (i32.sub (local.get $h) (i32.const 1))
                                       (local.get $dy)))
                (drop (call $gdi_native_fill_rect (local.get $hdc)
                  (local.get $x) (local.get $y)
                  (i32.add (local.get $x) (i32.const 1))
                  (i32.add (local.get $y) (i32.const 1))
                  (local.get $brush)))))
            (local.set $dx (i32.add (local.get $dx) (i32.const 1)))
            (br $cols)))
        (local.set $dy (i32.add (local.get $dy) (i32.const 1)))
        (br $rows))))

  ;; The font a status bar reports and paints with: WM_SETFONT's, else
  ;; DEFAULT_GUI_FONT standing in for comctl32's own status font.
  (func $statusbar_hfont (param $hwnd i32) (result i32)
    (local $state i32) (local $font i32)
    (local.set $state (call $statusbar_state_get (local.get $hwnd) (i32.const 0)))
    (if (local.get $state)
      (then (local.set $font (call $statusbar_font
        (cast ptr<StatusBarState> (call $g2w (local.get $state)))))))
    (if (result i32) (local.get $font)
      (then (local.get $font))
      (else (i32.const 0x30021))))

  (func $statusbar_wndproc (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $hdc i32) (local $sz i32) (local $w i32) (local $h i32)
    (local $text_w i32) (local $text_len i32) (local $right i32)
    (local $state i32) (local $sw ptr<StatusBarState>)
    (local $simple i32) (local $text_g i32) (local $tmp_g i32)
    (local $is_paint i32)
    (local $parent i32) (local $view i32) (local $view_sz i32) (local $slot i32)
    (local $mouse i32) (local $coord_x i32) (local $coord_y i32)
    (local $coord_w i32) (local $coord_len i32) (local $part_len i32)
    ;; A WAT-owned status bar gets its normal text from CREATESTRUCT. Native
    ;; comctl32 bars are initialized lazily from TITLE_TABLE instead because
    ;; their guest wndproc owns WM_CREATE.
    (if (i32.eq (local.get $msg) (i32.const 0x0001))
      (then
        (local.set $state (call $statusbar_state_get (local.get $hwnd) (i32.const 1)))
        (if (local.get $state)
          (then
            (local.set $sw (cast ptr<StatusBarState> (call $g2w (local.get $state))))
            (local.set $text_g (call $gl32 (i32.add (local.get $lParam) (i32.const 36))))
            (local.set $text_len
              (if (result i32) (local.get $text_g)
                (then (call $guest_strlen (local.get $text_g)))
                (else (i32.const 0))))
            (drop (call $statusbar_state_store_text
              (local.get $sw) (i32.const 0)
              (if (result i32) (local.get $text_g)
                (then (call $g2w (local.get $text_g)))
                (else (i32.const 0)))
              (local.get $text_len)))
            (call $statusbar_state_publish (local.get $hwnd) (local.get $sw))))
        (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0002))
      (then
        (call $statusbar_state_release (local.get $hwnd))
        (return (i32.const 0))))
    ;; WM_SETTEXT updates the ordinary pane. SB_SETTEXTA/W part 0xFF updates
    ;; the simple pane that MenuHelp uses; part zero remains the ordinary pane.
    (if (i32.or
          (i32.eq (local.get $msg) (i32.const 0x000C))
          (i32.or
            (i32.eq (local.get $msg) (i32.const 0x0401))
            (i32.eq (local.get $msg) (i32.const 0x040B))))
      (then
        (local.set $simple
          (i32.and
            (i32.ne (local.get $msg) (i32.const 0x000C))
            (i32.eq (i32.and (local.get $wParam) (i32.const 0xFF)) (i32.const 0xFF))))
        (if (i32.or
              (i32.eq (local.get $msg) (i32.const 0x000C))
              (i32.or
                (i32.eqz (i32.and (local.get $wParam) (i32.const 0xFF)))
                (local.get $simple)))
          (then
            (local.set $state (call $statusbar_state_get (local.get $hwnd) (i32.const 1)))
            (if (local.get $state)
              (then
                (local.set $sw (cast ptr<StatusBarState> (call $g2w (local.get $state))))
                (if (i32.eq (local.get $msg) (i32.const 0x040B))
                  (then
                    (local.set $tmp_g (call $heap_alloc (i32.const 256)))
                    (if (local.get $tmp_g)
                      (then
                        (local.set $text_len
                          (if (result i32) (local.get $lParam)
                            (then (call $wide_to_ansi
                              (local.get $lParam) (local.get $tmp_g) (i32.const 256)))
                            (else (i32.const 0))))
                        (drop (call $statusbar_state_store_text
                          (local.get $sw) (local.get $simple)
                          (call $g2w (local.get $tmp_g)) (local.get $text_len)))
                        (call $heap_free (local.get $tmp_g)))))
                  (else
                    (local.set $text_len
                      (if (result i32) (local.get $lParam)
                        (then (call $guest_strlen (local.get $lParam)))
                        (else (i32.const 0))))
                    (drop (call $statusbar_state_store_text
                      (local.get $sw) (local.get $simple)
                      (if (result i32) (local.get $lParam)
                        (then (call $g2w (local.get $lParam)))
                        (else (i32.const 0)))
                      (local.get $text_len)))))
                (if (i32.eq (local.get $simple)
                            (call $statusbar_simple_mode (local.get $sw)))
                  (then (call $statusbar_state_publish
                    (local.get $hwnd) (local.get $sw))))))))
        (return (i32.const 1))))
    ;; SB_SIMPLE selects between the preserved ordinary pane and simple part.
    (if (i32.eq (local.get $msg) (i32.const 0x0409))
      (then
        (local.set $state (call $statusbar_state_get (local.get $hwnd) (i32.const 1)))
        (if (local.get $state)
          (then
            (local.set $sw (cast ptr<StatusBarState> (call $g2w (local.get $state))))
            (call $statusbar_set_simple_mode
              (local.get $sw) (i32.ne (local.get $wParam) (i32.const 0)))
            (call $statusbar_state_publish (local.get $hwnd) (local.get $sw))))
        (return (i32.const 1))))
    ;; WM_SETFONT / WM_GETFONT. With no font set comctl32 answers with the
    ;; status font it made at creation, never NULL; DEFAULT_GUI_FONT is the
    ;; one the painter below draws with. MFC's CStatusBar::CalcFixedLayout
    ;; selects this font and sizes the bar from its TEXTMETRIC.
    (if (i32.eq (local.get $msg) (i32.const 0x0030))
      (then
        (local.set $state (call $statusbar_state_get (local.get $hwnd) (i32.const 1)))
        (if (local.get $state)
          (then
            (call $statusbar_set_font
              (cast ptr<StatusBarState> (call $g2w (local.get $state)))
              (local.get $wParam))
            (if (local.get $lParam) (then (call $invalidate_hwnd (local.get $hwnd))))))
        (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0031))
      (then (return (call $statusbar_hfont (local.get $hwnd)))))
    ;; SB_GETBORDERS fills int[3] = {horizontal border, vertical border, gap
    ;; between parts}; comctl32's defaults are 0, 2, 2. MFC's
    ;; CStatusBar::CalcFixedLayout sizes the bar as font height + 2*[1].
    (if (i32.eq (local.get $msg) (i32.const 0x0407))
      (then
        (if (i32.eqz (local.get $lParam))
          (then (return (i32.const 0))))
        (call $gs32 (local.get $lParam) (i32.const 0))
        (call $gs32 (i32.add (local.get $lParam) (i32.const 4)) (i32.const 2))
        (call $gs32 (i32.add (local.get $lParam) (i32.const 8)) (i32.const 2))
        (return (i32.const 1))))
    ;; SB_SETPARTS: retain API success. The current painter presents one pane.
    (if (i32.eq (local.get $msg) (i32.const 0x0404))
      (then
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.const 1))))
    ;; WM_PAINT
    (if (i32.eq (local.get $msg) (i32.const 0x000F))
      (then
        (local.set $hdc (i32.add (local.get $hwnd) (i32.const 0x40000)))
        (drop (call $gdi_native_select_clip_rgn (local.get $hdc) (i32.const 0)))
        (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
        (local.set $w (i32.and (local.get $sz) (i32.const 0xFFFF)))
        (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
        (local.set $is_paint (call $statusbar_is_paint (local.get $hwnd)))
        (if (i32.and (i32.gt_s (local.get $w) (i32.const 0))
                     (i32.gt_s (local.get $h) (i32.const 0)))
          (then
            (drop (call $gdi_native_fill_rect (local.get $hdc)
              (i32.const 0) (i32.const 0) (local.get $w) (local.get $h)
              (i32.const 0x30011))) ;; COLOR_3DFACE
            ;; Paint's MFC bar has a fixed 166px help pane and a coordinate
            ;; pane extending beneath its size grip. Generic status bars keep
            ;; the SBARS_SIZEGRIP reservation used by comctl32.
            (local.set $right
              (if (result i32)
                  (local.get $is_paint)
                (then (i32.const 167))
                (else
                  (if (result i32)
                      (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x100))
                    (then (i32.sub (local.get $w) (i32.const 17)))
                    (else (i32.sub (local.get $w) (i32.const 2)))))))
            (if (i32.gt_s (local.get $right) (i32.const 3))
              (then
                (drop (call $gdi_native_draw_edge (local.get $hdc)
                  (i32.const 1) (i32.const 2) (local.get $right) (i32.sub (local.get $h) (i32.const 2))
                  (i32.const 0x0A) (i32.const 0x0F))) ;; EDGE_SUNKEN | BF_RECT
                (local.set $text_w (call $title_table_get_ptr (local.get $hwnd)))
                (local.set $text_len (call $title_table_get_len (local.get $hwnd)))
                ;; Both operands must be 0/1: $text_w is a WASM address, and a
                ;; raw address ANDed with a length shares no bits often enough
                ;; to drop the caption entirely (ptr 0x1000 AND len 4 = 0).
                (if (i32.and (i32.ne (local.get $text_w) (i32.const 0))
                             (i32.ne (local.get $text_len) (i32.const 0)))
                  (then
                    (drop (call $gdi_native_select_object (local.get $hdc)
                      (call $statusbar_hfont (local.get $hwnd))))
                    (drop (call $gdi_native_set_bk_mode (local.get $hdc) (i32.const 1)))
                    (drop (call $gdi_native_draw_text
                      (local.get $hdc) (local.get $text_w) (local.get $text_len)
                      (call $paint_rect (i32.const 4) (i32.const 2)
                                        (i32.sub (local.get $right) (i32.const 3))
                                        (i32.sub (local.get $h) (i32.const 2)))
                      (i32.const 0x824) (i32.const 0)))))))
            (if (i32.and (local.get $is_paint) (i32.gt_s (local.get $w) (i32.const 171)))
              (then
                (drop (call $gdi_native_draw_edge (local.get $hdc)
                  (i32.const 169) (i32.const 2) (i32.sub (local.get $w) (i32.const 2))
                  (i32.sub (local.get $h) (i32.const 2))
                  (i32.const 0x0A) (i32.const 0x0F)))
                ;; Paint exposes image coordinates in its second pane while
                ;; the pointer is over the scroll view. The renderer requests
                ;; this small repaint on each relevant pointer movement.
                (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
                (local.set $view (call $ctrl_find_by_id (local.get $parent) (i32.const 0xE900)))
                (local.set $mouse (call $host_get_mouse_position))
                (local.set $coord_x
                  (i32.sub
                    (i32.and (local.get $mouse) (i32.const 0xFFFF))
                    (call $wnd_client_screen_x (local.get $view))))
                (local.set $coord_y
                  (i32.sub
                    (i32.and (i32.shr_u (local.get $mouse) (i32.const 16)) (i32.const 0xFFFF))
                    (call $wnd_client_screen_y (local.get $view))))
                (local.set $view_sz (call $ctrl_get_wh_packed (local.get $view)))
                (if (i32.and
                      ;; Paint's visible image view carries WS_CLIPCHILDREN;
                      ;; MFC's print-preview replacement reuses ID 0xE900
                      ;; without it and is not an image coordinate space.
                      (i32.eq
                        (i32.and (call $wnd_get_style (local.get $view)) (i32.const 0x12000000))
                        (i32.const 0x12000000))
                      (i32.and
                        (i32.and (i32.ge_s (local.get $coord_x) (i32.const 0))
                                 (i32.ge_s (local.get $coord_y) (i32.const 0)))
                        (i32.and
                          (i32.lt_s (local.get $coord_x)
                            (i32.sub (i32.and (local.get $view_sz) (i32.const 0xFFFF)) (i32.const 16)))
                          (i32.lt_s (local.get $coord_y)
                            (i32.sub (i32.shr_u (local.get $view_sz) (i32.const 16)) (i32.const 16))))))
                  (then
                    (local.set $slot (call $wnd_table_find (local.get $view)))
                    (if (i32.ne (local.get $slot) (i32.const -1))
                      (then
                        (local.set $coord_x
                          (i32.add (local.get $coord_x)
                            (i32.load (call $scroll_record_addr (local.get $slot)))))
                        (local.set $coord_y
                          (i32.add (local.get $coord_y)
                            (i32.load offset=12 (call $scroll_record_addr (local.get $slot)))))))
                    (if (i32.gt_u (local.get $coord_x) (i32.const 99999))
                      (then (local.set $coord_x (i32.const 99999))))
                    (if (i32.gt_u (local.get $coord_y) (i32.const 99999))
                      (then (local.set $coord_y (i32.const 99999))))
                    ;; "99999,99999" and its terminator fit inside one scratch
                    ;; slot. This used to write to the 16 bytes past the single
                    ;; shared rect, where +32 was MENU_DATA_TABLE and one digit
                    ;; too many corrupted Paint's main menu.
                    (local.set $coord_w (call $paint_scratch_take))
                    ;; NOT a (layout PaintRect) site, deliberately: this slot is
                    ;; a "X, Y" TEXT buffer, not a RECT, and the byte written
                    ;; below at a RUNTIME offset ($coord_len) is a comma in that
                    ;; string. The ring hands out 16 bytes; what they mean is
                    ;; the caller's business, and naming them l/t/r/b here would
                    ;; be a lie the compiler would happily accept.
                    (local.set $coord_len
                      (call $statusbar_write_uint (local.get $coord_w) (local.get $coord_x)))
                    (i32.store8 (i32.add (local.get $coord_w) (local.get $coord_len)) (i32.const 44))
                    (local.set $coord_len (i32.add (local.get $coord_len) (i32.const 1)))
                    (local.set $part_len
                      (call $statusbar_write_uint
                        (i32.add (local.get $coord_w) (local.get $coord_len)) (local.get $coord_y)))
                    (local.set $coord_len (i32.add (local.get $coord_len) (local.get $part_len)))
                    (drop (call $gdi_native_select_object (local.get $hdc) (i32.const 0x30021)))
                    (drop (call $gdi_native_set_bk_mode (local.get $hdc) (i32.const 1)))
                    (drop (call $gdi_native_text_out (local.get $hdc)
                      (i32.const 173) (i32.const 5)
                      (local.get $coord_w) (local.get $coord_len) (i32.const 0)))))
                (call $statusbar_draw_size_grip (local.get $hdc) (local.get $w) (local.get $h)))
              (else
                ;; Minimal generic Win9x size grip for SBARS_SIZEGRIP bars.
                (if (i32.and
                      (i32.ne
                        (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x100))
                        (i32.const 0))
                      (i32.and (i32.ge_s (local.get $w) (i32.const 16))
                               (i32.ge_s (local.get $h) (i32.const 12))))
                  (then
                    (call $statusbar_draw_size_grip
                      (local.get $hdc) (local.get $w) (local.get $h))))))))
        (return (i32.const 0))))
    (i32.const 0))

  ;; ---- ProgressBar WndProc ----
  ;;
  ;; Minimal native common-control progress bar. Enough for NSIS installers:
  ;; it owns its HWND, tracks Win32 PBM_* range/position state, paints a Win98
  ;; sunken progress well, and invalidates on state changes.

  (func $progress_wndproc (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $hdc i32) (local $sz i32) (local $w i32) (local $h i32)
    (local $state i32) (local $sw i32) (local $old i32)
    (local $min i32) (local $max i32) (local $pos i32) (local $range i32) (local $inner_w i32) (local $fill_w i32)
    (local.set $state (call $wnd_get_state_ptr (local.get $hwnd)))
    ;; WM_CREATE
    (if (i32.eq (local.get $msg) (i32.const 0x0001))
      (then
        (local.set $state (call $heap_alloc (i32.const 16)))
        (local.set $sw (call $g2w (local.get $state)))
        (call $prog_state_init (local.get $sw))
        (call $wnd_set_state_ptr (local.get $hwnd) (local.get $state))
        (return (i32.const 0))))
    ;; WM_DESTROY
    (if (i32.eq (local.get $msg) (i32.const 0x0002))
      (then
        (if (local.get $state)
          (then
            (call $heap_free (local.get $state))
            (call $wnd_set_state_ptr (local.get $hwnd) (i32.const 0))))
        (return (i32.const 0))))
    ;; Some template-created common controls can receive PBM_* before WM_CREATE
    ;; state exists in older paths. Initialise lazily rather than dropping the
    ;; update.
    (if (i32.eqz (local.get $state))
      (then
        (local.set $state (call $heap_alloc (i32.const 16)))
        (local.set $sw (call $g2w (local.get $state)))
        (call $prog_state_init (local.get $sw))
        (call $wnd_set_state_ptr (local.get $hwnd) (local.get $state))))
    (local.set $sw (call $g2w (local.get $state)))
    ;; PBM_SETRANGE(0x0401): lParam low=min, high=max.
    (if (i32.eq (local.get $msg) (i32.const 0x0401))
      (then
        (local.set $min (i32.shr_s (i32.shl (local.get $lParam) (i32.const 16)) (i32.const 16)))
        (local.set $max (i32.shr_s (local.get $lParam) (i32.const 16)))
        (if (i32.le_s (local.get $max) (local.get $min))
          (then (local.set $max (i32.add (local.get $min) (i32.const 1)))))
        (call $prog_set_min (local.get $sw) (local.get $min))
        (call $prog_set_max (local.get $sw) (local.get $max))
        (call $prog_set_pos (local.get $sw)
          (call $prog_clamp (local.get $sw) (call $prog_pos (local.get $sw))))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.const 0))))
    ;; PBM_SETPOS(0x0402): return previous position.
    (if (i32.eq (local.get $msg) (i32.const 0x0402))
      (then
        (local.set $old (call $prog_pos (local.get $sw)))
        (call $prog_set_pos (local.get $sw)
          (call $prog_clamp (local.get $sw) (local.get $wParam)))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (local.get $old))))
    ;; PBM_DELTAPOS(0x0403): return previous position.
    (if (i32.eq (local.get $msg) (i32.const 0x0403))
      (then
        (local.set $old (call $prog_pos (local.get $sw)))
        (call $prog_set_pos (local.get $sw)
          (call $prog_clamp (local.get $sw)
            (i32.add (local.get $old) (local.get $wParam))))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (local.get $old))))
    ;; PBM_SETSTEP(0x0404), PBM_STEPIT(0x0405), PBM_SETRANGE32(0x0406).
    (if (i32.eq (local.get $msg) (i32.const 0x0404))
      (then
        (local.set $old (call $prog_step (local.get $sw)))
        (call $prog_set_step (local.get $sw) (local.get $wParam))
        (return (local.get $old))))
    (if (i32.eq (local.get $msg) (i32.const 0x0405))
      (then
        ;; STEPIT wraps rather than clamps: a stepped bar that runs off the end
        ;; starts again at min, which is why this one does not use $prog_clamp.
        (local.set $old (call $prog_pos (local.get $sw)))
        (local.set $pos (i32.add (local.get $old) (call $prog_step (local.get $sw))))
        (if (i32.gt_s (local.get $pos) (call $prog_max (local.get $sw)))
          (then (local.set $pos (call $prog_min (local.get $sw)))))
        (call $prog_set_pos (local.get $sw) (local.get $pos))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (local.get $old))))
    (if (i32.eq (local.get $msg) (i32.const 0x0406))
      (then
        (local.set $min (local.get $wParam))
        (local.set $max (local.get $lParam))
        (if (i32.le_s (local.get $max) (local.get $min))
          (then (local.set $max (i32.add (local.get $min) (i32.const 1)))))
        (call $prog_set_min (local.get $sw) (local.get $min))
        (call $prog_set_max (local.get $sw) (local.get $max))
        (call $prog_set_pos (local.get $sw)
          (call $prog_clamp (local.get $sw) (call $prog_pos (local.get $sw))))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.const 0))))
    ;; WM_PAINT
    (if (i32.eq (local.get $msg) (i32.const 0x000F))
      (then
        (local.set $hdc (i32.add (local.get $hwnd) (i32.const 0x40000)))
        (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
        (local.set $w (i32.and (local.get $sz) (i32.const 0xFFFF)))
        (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
        (if (i32.and (i32.gt_s (local.get $w) (i32.const 0))
                     (i32.gt_s (local.get $h) (i32.const 0)))
          (then
            (drop (call $gdi_native_fill_rect (local.get $hdc)
                    (i32.const 0) (i32.const 0)
                    (local.get $w) (local.get $h)
                    (i32.const 0x30010))) ;; WHITE_BRUSH
            (local.set $min (call $prog_min (local.get $sw)))
            (local.set $max (call $prog_max (local.get $sw)))
            (local.set $pos (call $prog_clamp (local.get $sw) (call $prog_pos (local.get $sw))))
            (local.set $range (i32.sub (local.get $max) (local.get $min)))
            (local.set $inner_w (i32.sub (local.get $w) (i32.const 4)))
            (if (i32.and (i32.gt_s (local.get $range) (i32.const 0))
                         (i32.gt_s (local.get $inner_w) (i32.const 0)))
              (then
                (local.set $fill_w
                  (i32.div_s
                    (i32.mul (i32.sub (local.get $pos) (local.get $min)) (local.get $inner_w))
                    (local.get $range)))
                (if (i32.gt_s (local.get $fill_w) (i32.const 0))
                  (then
                    (drop (call $gdi_native_fill_rect (local.get $hdc)
                      (i32.const 2) (i32.const 2)
                      (i32.add (i32.const 2) (local.get $fill_w))
                      (i32.sub (local.get $h) (i32.const 2))
                      (i32.const 14))))))) ;; COLOR_HIGHLIGHT
            (drop (call $gdi_native_draw_edge (local.get $hdc)
                    (i32.const 0) (i32.const 0)
                    (local.get $w) (local.get $h)
                    (i32.const 0x0A) (i32.const 0x0F))))) ;; EDGE_SUNKEN | BF_RECT
        (return (i32.const 0))))
    (i32.const 0))
