  ;; RegisterWindowMessage is an *interning* call: registering the same name
  ;; twice must give the same number back, which is how two components (or two
  ;; spellings of one API) agree on what "commdlg_FindReplace" means. On
  ;; Windows the number comes from the global atom table, shared with
  ;; RegisterClipboardFormat, so intern through the same table $clipfmt_intern
  ;; owns. Both spellings land here; the W one only narrows on the way in.
  (func $register_window_message (param $name_g i32) (result i32)
    (local $id i32) (local $name_wa i32)
    (local.set $id (call $clipfmt_intern (local.get $name_g))) (local.set $name_wa (call $g2w (local.get $name_g)))
    ;; FNV-1a("commdlg_FindReplace") = 0x1A9C8FD4. Common-dialog clients
    ;; register FINDMSGSTRING and later compare a delivered message against the
    ;; value they got, so the find/replace dialog has to send that same one.
    (if (i32.and
          (i32.ne (local.get $id) (i32.const 0))
          (i32.eq (call $hash_api_name (local.get $name_wa))
                  (i32.const 0x1A9C8FD4)))
      (then (global.set $findreplace_message (local.get $id))))
    ;; FNV-1a("SHELLHOOK") = 0x684BA376. RegisterShellHook has no message-id
    ;; argument, so retain the exact interned value while the name is still
    ;; available instead of trying to reconstruct it from a counter later.
    (if (i32.and
          (i32.ne (local.get $id) (i32.const 0))
          (i32.eq (call $hash_api_name (local.get $name_wa))
                  (i32.const 0x684BA376)))
      (then (global.set $shell_hook_message (local.get $id))))
    (local.get $id))

  ;; A registered message id is only this process's numbering. On Windows it
  ;; comes from the global atom table, so every process agrees on it; here each
  ;; emulated app interns into its own table. A broadcast of one to the other
  ;; running apps therefore travels by name -- a case-folded FNV-1a, since the
  ;; names compare case-insensitively -- and each receiver maps it back to its
  ;; own id. InstallShield 3 is why: its 32-bit engine closes the 16-bit
  ;; SETUP.EXE's "preparing the InstallShield Wizard" window by sending
  ;; LOGO_MSG_LOGOCLOSE_30 to HWND_BROADCAST, and without this the launcher
  ;; and its 28% progress box stayed up behind the wizard for good.
  (func $regmsg_name_hash (param $name_g i32) (result i32)
    (local $h i32) (local $c i32)
    (local.set $h (i32.const 0x811C9DC5))
    (block $done (loop $next
      (local.set $c (call $gl8 (local.get $name_g)))
      (br_if $done (i32.eqz (local.get $c)))
      (local.set $h (i32.mul
        (i32.xor (local.get $h) (call $tolower (local.get $c)))
        (i32.const 0x01000193)))
      (local.set $name_g (i32.add (local.get $name_g) (i32.const 1)))
      (br $next)))
    (local.get $h))

  ;; Sender half: HWND_BROADCAST of a registered message also goes to every
  ;; other app. A message nobody registered by name has no meaning outside this
  ;; process, so only an interned id is sent on.
  (func $regmsg_broadcast_out (param $msg i32) (param $wparam i32) (param $lparam i32)
    (local $name i32)
    (if (i32.or (i32.lt_u (local.get $msg) (i32.const 0xC000))
                (i32.gt_u (local.get $msg) (i32.const 0xFFFF)))
      (then (return)))
    (local.set $name (call $clipfmt_name_of (local.get $msg)))
    (if (i32.eqz (local.get $name)) (then (return)))
    (drop (call $host_broadcast_registered_message
      (call $regmsg_name_hash (local.get $name))
      (local.get $wparam) (local.get $lparam))))

  ;; Receiver half: post this process's id for that name to each of its
  ;; top-level windows, hidden ones included -- InstallShield's listener is a
  ;; hidden popup. A process that never registered the name has no window that
  ;; could recognise the number, so it gets nothing, which is what an unknown
  ;; registered message amounts to on Windows. Returns the windows posted to.
  (func $regmsg_broadcast_in (param $hash i32) (param $wparam i32) (param $lparam i32) (result i32)
    (local $i i32) (local $e i32) (local $id i32) (local $rec i32) (local $hwnd i32)
    (local $posted i32)
    (block $found (loop $scan
      (br_if $found (i32.ge_u (local.get $i) (global.get $CLIPFORMAT_SLOTS)))
      (local.set $e (i32.add (global.get $CLIPFORMAT_TABLE)
        (i32.mul (local.get $i) (i32.const 8))))
      (br_if $found (i32.eqz (i32.load (local.get $e))))
      (if (i32.eq (call $regmsg_name_hash (i32.load (local.get $e))) (local.get $hash))
        (then
          (local.set $id (i32.load offset=4 (local.get $e)))
          (br $found)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (if (i32.eqz (local.get $id)) (then (return (i32.const 0))))
    (local.set $i (i32.const 0))
    (block $done (loop $walk
      (br_if $done (i32.ge_u (local.get $i) (global.get $MAX_WINDOWS)))
      (local.set $rec (call $wnd_record_addr (local.get $i)))
      (local.set $hwnd (i32.load (local.get $rec)))
      (if (i32.and (i32.ne (local.get $hwnd) (i32.const 0))
                   (i32.eqz (i32.load offset=8 (local.get $rec))))
        (then
          (local.set $posted (i32.add (local.get $posted)
            (call $post_queue_push (local.get $hwnd) (local.get $id)
              (local.get $wparam) (local.get $lparam))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $walk)))
    (local.get $posted))

  ;; 66: RegisterWindowMessageA(lpString) — return unique msg ID from 0xC000+ range
  (func $handle_RegisterWindowMessageA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $register_window_message (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; Retire or promote the process-wide main window before its table record is
  ;; removed. Kept separate so lifecycle tests can exercise this decision
  ;; without invoking the host-facing recursive destruction path.
  ;;
  ;; Real USER posts nothing when a window dies: WM_QUIT only ever comes from
  ;; PostQuitMessage (usually the app's own WM_DESTROY/WM_NCDESTROY handler,
  ;; which $wnd_destroy_recursive delivers). So a surviving top-level window
  ;; simply inherits the emulator's convenience $main_hwnd and nothing quits.
  ;; UT2004 is why this matters: its startup splash is the first top-level,
  ;; so it is main, and destroying it while the game viewport lives on used
  ;; to leave $quit_flag=1 for the rest of the run. The game pumps with
  ;; PeekMessage, which ignores that marker, but has_pending_message and
  ;; MsgWaitForMultipleObjects count it, so every idle wait returned at once.
  ;;
  ;; Only when no top-level survives at all does the old synthetic marker
  ;; (flag 1) remain -- the loop-exit shape GetMessageA gives a launcher whose
  ;; last window just died -- and $main_hwnd_adopt retires it the moment a
  ;; replacement main window appears. An explicit PostQuitMessage (flag 2)
  ;; is never downgraded.
  (func $destroy_main_window_lifecycle (param $hwnd i32)
    (local $repl i32)
    (if (i32.eq (local.get $hwnd) (global.get $main_hwnd))
      (then
        (if (i32.and
              (i32.ne (call $wnd_table_get (i32.add (global.get $main_hwnd) (i32.const 1))) (i32.const 0))
              (i32.ne (call $wnd_get_parent (i32.add (global.get $main_hwnd) (i32.const 1)))
                      (global.get $main_hwnd)))
          (then (local.set $repl (i32.add (global.get $main_hwnd) (i32.const 1))))
          (else (local.set $repl (call $main_hwnd_successor (local.get $hwnd)))))
        (if (local.get $repl)
          (then (call $main_hwnd_adopt (local.get $repl)))
          (else
            (if (i32.and
                  (i32.eqz (global.get $quit_flag))
                  (call $wnd_is_effectively_visible (local.get $hwnd)))
              (then (global.set $quit_flag (i32.const 1))))
            ;; The slot is removed next. Leave no stale main handle behind so
            ;; a replacement top-level created during an SDL video-mode reset
            ;; becomes the new input/paint target.
            (global.set $main_hwnd (i32.const 0)))))))

  ;; The visible top-level window that takes over as $main_hwnd when $dying
  ;; goes away, or 0. Top-level means no parent; a window $dying owns is
  ;; excluded because USER destroys owned windows with their owner, and so
  ;; are WAT-native control records. The newest (highest HWND) candidate wins:
  ;; a replacement is normally created just before its predecessor is torn
  ;; down, which is exactly UT2004's splash -> viewport hand-off.
  (func $main_hwnd_successor (param $dying i32) (result i32)
    (local $i i32) (local $ptr i32) (local $h i32) (local $best i32)
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $MAX_WINDOWS)))
      (local.set $ptr (call $wnd_record_addr (local.get $i)))
      (local.set $h (i32.atomic.load (local.get $ptr)))
      (if (i32.and
            (i32.and
              (i32.ne (local.get $h) (i32.const 0))
              (i32.ne (local.get $h) (local.get $dying)))
            (i32.and
              (i32.eqz (load.field.memarg WndRecord parent (local.get $ptr)))
              (i32.ne (load.field.memarg WndRecord wndproc (local.get $ptr))
                      (global.get $WNDPROC_CTRL_NATIVE))))
        (then
          (if (i32.and
                (i32.and
                  (i32.ne (call $wnd_get_owner (local.get $h)) (local.get $dying))
                  (i32.gt_u (local.get $h) (local.get $best)))
                (call $wnd_is_effectively_visible (local.get $h)))
            (then (local.set $best (local.get $h))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (local.get $best))

  ;; Make $hwnd the emulator's main window. A synthetic teardown marker
  ;; (flag 1) is stale from this moment: it stood for "the app has no main
  ;; window left", and now it has one. GetMessageA used to be the only place
  ;; that noticed, so an app pumping with PeekMessage kept the marker forever.
  (func $main_hwnd_adopt (param $hwnd i32)
    (global.set $main_hwnd (local.get $hwnd))
    (if (i32.and
          (i32.ne (local.get $hwnd) (i32.const 0))
          (i32.eq (global.get $quit_flag) (i32.const 1)))
      (then (global.set $quit_flag (i32.const 0)))))

  ;; 83: DestroyWindow
  (func $handle_DestroyWindow (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $focus_lost i32) (local $focus_parent i32) (local $focus_guard i32)
    (local $wndproc i32) (local $ret_addr i32)
    ;; Recursive destruction also removes every child. If any of them held
    ;; focus, that focus is lost just as surely as when the root itself held
    ;; it. Tetris closes an About dialog whose OK child has focus; retaining
    ;; that dead child made every subsequent arrow key disappear.
    (if (global.get $focus_hwnd)
      (then
        (if (i32.eq (local.get $arg0) (global.get $focus_hwnd))
          (then (local.set $focus_lost (i32.const 1)))
          (else
            (local.set $focus_parent (call $wnd_get_parent (global.get $focus_hwnd)))
            (block $focus_done (loop $focus_ancestors
              (br_if $focus_done (i32.eqz (local.get $focus_parent)))
              (if (i32.eq (local.get $focus_parent) (local.get $arg0))
                (then
                  (local.set $focus_lost (i32.const 1))
                  (br $focus_done)))
              (local.set $focus_guard (i32.add (local.get $focus_guard) (i32.const 1)))
              (br_if $focus_done (i32.ge_u (local.get $focus_guard) (global.get $MAX_WINDOWS)))
              (local.set $focus_parent (call $wnd_get_parent (local.get $focus_parent)))
              (br $focus_ancestors)))))))
    ;; After main_hwnd promotion below, transfer focus to the (possibly new)
    ;; main window rather than leaving a handle that recursive destruction
    ;; just removed from the table.
    (if (local.get $focus_lost)
      (then (global.set $focus_hwnd (i32.const 0))))
    ;; When destroying main_hwnd, promote to next window only if it's a sibling
    ;; top-level window — NOT a child of the destroyed window.  A hidden first
    ;; window may only be a startup/helper HWND: Pinball destroys its invisible
    ;; splash before creating the visible table window.  Do not leave a stale
    ;; WM_QUIT behind in that case; a later GetMessage path (Options > Music)
    ;; would consume it and terminate an otherwise healthy app.
    (call $destroy_main_window_lifecycle (local.get $arg0))
    ;; Give the parent back the area this window covered, before the record
    ;; that says who the parent is goes away.
    (call $wnd_uncover_parent (local.get $arg0))
    ;; Recursively destroy window and all its children (frees table slots)
    (call $wnd_destroy_recursive (local.get $arg0))
    ;; Transfer focus to main_hwnd: deliver WM_SETFOCUS synchronously via EIP redirect.
    ;; On real Windows, destroying the focused window gives focus to the next foreground window.
    ;; Only if main_hwnd is valid and different from the destroyed window (may have been promoted).
    (if (i32.and (i32.ne (local.get $focus_lost) (i32.const 0))
                 (i32.and (i32.ne (global.get $main_hwnd) (i32.const 0))
                          (i32.ne (global.get $main_hwnd) (local.get $arg0))))
      (then
        (local.set $wndproc (call $wnd_table_get (global.get $main_hwnd)))
        (if (i32.eqz (local.get $wndproc))
          (then (local.set $wndproc (global.get $wndproc_addr))))
        ;; A Win16 WndProc is a packed selector:offset, not a linear EIP. This
        ;; handler can run below the Win16 call32 bridge (USER.53), so let the
        ;; task's ordinary queue dispatcher resolve that far procedure after
        ;; the bridge has restored its real stack. Tic Tac Drop destroys its
        ;; splash this way while promoting the playable VB form.
        (if (global.get $win16_in_call32)
          (then
            (global.set $focus_hwnd (global.get $main_hwnd))
            (drop (call $post_queue_push (global.get $main_hwnd)
              (i32.const 0x0007) (i32.const 0) (i32.const 0))))
          (else
        (if (i32.and (i32.ne (local.get $wndproc) (i32.const 0))
                     (i32.lt_u (local.get $wndproc) (i32.const 0xFFFF0000)))
          (then
            (global.set $focus_hwnd (global.get $main_hwnd))
            (local.set $ret_addr (call $gl32 (i32.load offset=16 (global.get $reg_base))))
            ;; DestroyWindow stdcall(1): [ret, hwnd] = 8 bytes. The focus
            ;; wndproc must return through CACA002A before the API caller:
            ;; otherwise its LRESULT (commonly zero) becomes DestroyWindow's
            ;; BOOL. Use the same saved-return frame as SetFocus, but retain
            ;; TRUE as this API's result.
            (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 40)))
            (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $setfocus_ret_thunk))
            (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)) (global.get $main_hwnd))
            (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)) (i32.const 0x0007))  ;; WM_SETFOCUS
            (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)) (i32.const 0))      ;; wParam = 0
            (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)) (i32.const 0))      ;; lParam = 0
            (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)) (local.get $ret_addr))
            (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (i32.const 1))
            (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (i32.load offset=12 (global.get $reg_base)))
            (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)) (i32.load offset=24 (global.get $reg_base)))
            (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36)) (i32.load offset=28 (global.get $reg_base)))
            (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 40)) (i32.load offset=20 (global.get $reg_base)))
            (global.set $eip (local.get $wndproc))
            (global.set $steps (i32.const 0))
            (return)))))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))) (return)
  )

(func $compat_is_pinball_exe (result i32)
    (if (i32.ne (global.get $exe_name_len) (i32.const 11))
      (then (return (i32.const 0))))
    (if (i32.ne (i32.load (global.get $exe_name_wa)) (i32.const 0x626E6970))
      (then (return (i32.const 0)))) ;; pinb
    (if (i32.ne (i32.load offset=4 (global.get $exe_name_wa)) (i32.const 0x2E6C6C61))
      (then (return (i32.const 0)))) ;; all.
    (if (i32.ne (i32.load offset=8 (global.get $exe_name_wa)) (i32.const 0x00657865))
      (then (return (i32.const 0)))) ;; exe\0
    (i32.const 1))

  ;; 85: GetDC — Phase B: alloc DcRecord via host_alloc_window_dc
  ;; (whole=0). GetDC(NULL) and GetDC(GetDesktopWindow()) → screen DC.
  (func $handle_GetDC (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $hdc i32) (local $target_hwnd i32)
    ;; Pinball uses its desktop handle as a window-clipped primary surface.
    ;; Giving it the canonical desktop bitmap draws the table behind
    ;; an opaque gray main window. Keep native desktop-DC behavior for other
    ;; apps (notably MFC WinHelp), but bind this request to Pinball's actual
    ;; compositor window.
    (if (i32.and
          (i32.eq (local.get $arg0) (i32.const 0x10000))
          (i32.and
            (call $compat_is_pinball_exe)
            (i32.ne (global.get $main_hwnd) (i32.const 0))))
      (then (local.set $target_hwnd (global.get $main_hwnd)))
      (else
        (if (i32.ne (local.get $arg0) (i32.const 0x10000))
          (then (local.set $target_hwnd (local.get $arg0))))))
    (if (local.get $target_hwnd)
      (then
        (local.set $hdc (call $host_alloc_window_dc (local.get $target_hwnd) (i32.const 0)))
        (call $dc_apply_client_clip (local.get $hdc) (local.get $target_hwnd)))
      (else
        (local.set $hdc (call $host_alloc_screen_dc))))
    (i32.store offset=0 (global.get $reg_base) (local.get $hdc))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))) (return)
  )

  ;; The SM_* table, with no calling convention attached. GetSystemMetrics is
  ;; the same question in Win32 and in Win16 — USER.179 takes the same indices
  ;; and means the same things — so the answers live here and both dispatchers
  ;; call in. An index with no entry is 0, which is what Windows returns for a
  ;; metric it does not define.
  ;; A DirectDraw SetDisplayMode replaces the screen metrics for as long as the
  ;; mode is in effect — it switches the whole display, so on Windows
  ;; SM_CXSCREEN/SM_CYSCREEN report the mode, not the desktop the app was
  ;; launched from, until RestoreDisplayMode. Caesar III depends on it
  ;; — in fullscreen it takes SetRect(0, 0, SM_CXSCREEN, SM_CYSCREEN) as its
  ;; client size and scales the cursor from there down to its 800x600 logical
  ;; screen, so reporting the host canvas (1280 wide in the browser) put every
  ;; click at ~62% of the position the player aimed at, and nothing in the main
  ;; menu ever highlighted or responded.
  (func $screen_metric_w (result i32)
    (if (call $dx_display_mode_get)
      (then (return (call $dx_display_w_get))))
    (i32.and (call $host_get_screen_size) (i32.const 0xFFFF)))

  (func $screen_metric_h (result i32)
    (if (call $dx_display_mode_get)
      (then (return (call $dx_display_h_get))))
    (i32.shr_u (call $host_get_screen_size) (i32.const 16)))

  ;; Bottom edge of the browser desktop's usable area. Keep the classic
  ;; taskbar reservation in one place so SPI_GETWORKAREA, GetMonitorInfo and
  ;; SHAppBarMessage cannot describe three different desktops.
  (func $screen_work_bottom (result i32)
    (local $height i32)
    (local.set $height (call $screen_metric_h))
    (select (i32.sub (local.get $height) (i32.const 28)) (i32.const 0)
      (i32.gt_u (local.get $height) (i32.const 28))))

  (func $system_metric (param $index i32) (result i32)
    (if (i32.eq (local.get $index) (i32.const 0))  ;; SM_CXSCREEN
      (then (return (call $screen_metric_w))))
    (if (i32.eq (local.get $index) (i32.const 1))  ;; SM_CYSCREEN
      (then (return (call $screen_metric_h))))
    (if (i32.eq (local.get $index) (i32.const 2))  ;; SM_CXVSCROLL
      (then (return (i32.const 16))))
    (if (i32.eq (local.get $index) (i32.const 3))  ;; SM_CYHSCROLL
      (then (return (i32.const 16))))
    (if (i32.eq (local.get $index) (i32.const 4))  ;; SM_CYCAPTION
      (then (return (i32.const 19))))
    (if (i32.eq (local.get $index) (i32.const 5))  ;; SM_CXBORDER
      (then (return (i32.const 1))))
    (if (i32.eq (local.get $index) (i32.const 6))  ;; SM_CYBORDER
      (then (return (i32.const 1))))
    (if (i32.eq (local.get $index) (i32.const 7))  ;; SM_CXFIXEDFRAME
      (then (return (i32.const 3))))
    (if (i32.eq (local.get $index) (i32.const 8))  ;; SM_CYFIXEDFRAME
      (then (return (i32.const 3))))
    (if (i32.eq (local.get $index) (i32.const 9))  ;; SM_CYVTHUMB
      (then (return (i32.const 16))))
    (if (i32.eq (local.get $index) (i32.const 10)) ;; SM_CXHTHUMB
      (then (return (i32.const 16))))
    (if (i32.eq (local.get $index) (i32.const 11)) ;; SM_CXICON
      (then (return (i32.const 32))))
    (if (i32.eq (local.get $index) (i32.const 12)) ;; SM_CYICON
      (then (return (i32.const 32))))
    (if (i32.eq (local.get $index) (i32.const 13)) ;; SM_CXCURSOR
      (then (return (i32.const 32))))
    (if (i32.eq (local.get $index) (i32.const 14)) ;; SM_CYCURSOR
      (then (return (i32.const 32))))
    (if (i32.eq (local.get $index) (i32.const 15)) ;; SM_CYMENU
      (then (return (i32.const 19))))
    (if (i32.eq (local.get $index) (i32.const 16)) ;; SM_CXFULLSCREEN
      (then (return (call $screen_metric_w))))
    ;; The 46 rows are caption + frame, which a mode-switched fullscreen app
    ;; does not have: there the full-screen client area is the whole mode.
    (if (i32.eq (local.get $index) (i32.const 17)) ;; SM_CYFULLSCREEN
      (then
        (if (call $dx_display_mode_get)
          (then (return (call $dx_display_h_get))))
        (return (i32.sub (i32.shr_u (call $host_get_screen_size) (i32.const 16))
                         (i32.const 46)))))
    (if (i32.eq (local.get $index) (i32.const 19)) ;; SM_MOUSEPRESENT
      (then (return (i32.const 1))))
    (if (i32.eq (local.get $index) (i32.const 20)) ;; SM_CYVSCROLL
      (then (return (i32.const 16))))
    (if (i32.eq (local.get $index) (i32.const 21)) ;; SM_CXHSCROLL
      (then (return (i32.const 16))))
    (if (i32.eq (local.get $index) (i32.const 28)) ;; SM_CXMIN
      (then (return (i32.const 112))))
    (if (i32.eq (local.get $index) (i32.const 29)) ;; SM_CYMIN
      (then (return (i32.const 27))))
    (if (i32.eq (local.get $index) (i32.const 30)) ;; SM_CXSIZE
      (then (return (i32.const 18))))
    (if (i32.eq (local.get $index) (i32.const 31)) ;; SM_CYSIZE
      (then (return (i32.const 18))))
    (if (i32.eq (local.get $index) (i32.const 32)) ;; SM_CXFRAME
      (then (return (i32.const 4))))
    (if (i32.eq (local.get $index) (i32.const 33)) ;; SM_CYFRAME
      (then (return (i32.const 4))))
    (if (i32.eq (local.get $index) (i32.const 34)) ;; SM_CXMINTRACK
      (then (return (i32.const 112))))
    (if (i32.eq (local.get $index) (i32.const 35)) ;; SM_CYMINTRACK
      (then (return (i32.const 27))))
    ;; Single virtual desktop, including the sizing frame on both edges.
    (if (i32.eq (local.get $index) (i32.const 59)) ;; SM_CXMAXTRACK
      (then (return (i32.add (call $screen_metric_w) (i32.mul (i32.const 2) (call $system_metric (i32.const 32)))))))
    (if (i32.eq (local.get $index) (i32.const 60)) ;; SM_CYMAXTRACK
      (then (return (i32.add (call $screen_metric_h) (i32.mul (i32.const 2) (call $system_metric (i32.const 33)))))))
    (if (i32.eq (local.get $index) (i32.const 36)) ;; SM_CXDOUBLECLK
      (then (return (i32.const 4))))
    (if (i32.eq (local.get $index) (i32.const 37)) ;; SM_CYDOUBLECLK
      (then (return (i32.const 4))))
    (if (i32.eq (local.get $index) (i32.const 38)) ;; SM_CXICONSPACING
      (then (return (i32.const 75))))
    (if (i32.eq (local.get $index) (i32.const 39)) ;; SM_CYICONSPACING
      (then (return (i32.const 75))))
    (if (i32.eq (local.get $index) (i32.const 43)) ;; SM_CMOUSEBUTTONS
      (then (return (i32.const 3))))
    (if (i32.eq (local.get $index) (i32.const 45)) ;; SM_CXEDGE
      (then (return (i32.const 2))))
    (if (i32.eq (local.get $index) (i32.const 46)) ;; SM_CYEDGE
      (then (return (i32.const 2))))
    (if (i32.eq (local.get $index) (i32.const 23)) ;; SM_SWAPBUTTON
      (then (return (global.get $mouse_buttons_swapped))))
    ;; Native Win98 COMCTL32 uses the small-icon metrics to size image lists.
    ;; Returning zero makes ImageList_Create fail before controls can populate.
    (if (i32.eq (local.get $index) (i32.const 49)) ;; SM_CXSMICON
      (then (return (i32.const 16))))
    (if (i32.eq (local.get $index) (i32.const 50)) ;; SM_CYSMICON
      (then (return (i32.const 16))))
    (if (i32.eq (local.get $index) (i32.const 0x3D)) ;; SM_CXMAXIMIZED
      (then (return (i32.add (call $screen_metric_w) (i32.const 8)))))
    (if (i32.eq (local.get $index) (i32.const 0x3E)) ;; SM_CYMAXIMIZED
      (then (return (i32.add (call $screen_metric_h) (i32.const 8)))))
    ;; These late Win98 metrics describe the bitmap itself, not the padded
    ;; column the menu painter reserves around it. GetMenuCheckMarkDimensions
    ;; shares this exact authority and packs the same value into both words.
    (if (i32.eq (local.get $index) (i32.const 71)) ;; SM_CXMENUCHECK
      (then (return (call $menu_checkmark_size))))
    (if (i32.eq (local.get $index) (i32.const 72)) ;; SM_CYMENUCHECK
      (then (return (call $menu_checkmark_size))))
    (i32.const 0))

  ;; 90: GetSystemMetrics (actual slot used by imports)
  (func $handle_GetSystemMetrics (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $system_metric (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; ConvertToGlobalHandle promotes a process-local kernel handle so it can be
  ;; inherited by another process. This emulator has one process and stable
  ;; handle identities, therefore the promoted handle is the same handle.
  (func $handle_ConvertToGlobalHandle (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; Primary-monitor enumeration. Each suspended callback owns a stack frame:
  ;; saved return, saved final ESP, RECT, HDC, SaveDC level (32 bytes).
  ;; Nested calls cannot overwrite it or consume another invocation's DC save.
  (global $monitor_enum_thunk (mut i32) (i32.const 0))
  ;; Return a saved DC level, -1 for an empty intersection, or 0 on failure.
  ;; Regions and RECTs here are DC-relative device coordinates, not logical
  ;; drawing units. Keep the actual region, including holes, for painting.
  (func $monitor_enum_prepare_dc (param $hdc i32) (param $clip i32)
      (param $rect_w i32) (result i32)
    (local $dc i32) (local $binding i32) (local $hwnd i32)
    (local $ox i32) (local $oy i32) (local $effective i32) (local $limit i32)
    (local $saved i32) (local $result i32)
    (local $clip_w ptr<Rect>)
    (local $cl i32) (local $ct i32) (local $cr i32) (local $cb i32)
    (local.set $dc (call $gdi_dc_state_entry (local.get $hdc) (i32.const 0)))
    (if (i32.eqz (local.get $dc))
      (then (global.set $last_error (i32.const 6)) (return (i32.const 0))))
    (local.set $binding (load.field.memarg GdiDcState window_binding (local.get $dc)))
    (local.set $hwnd (i32.and (local.get $binding) (i32.const 0x7fffffff)))
    (if (local.get $hwnd)
      (then
        (if (i32.lt_s (local.get $binding) (i32.const 0))
          (then
            (local.set $ox (call $wnd_window_screen_x (local.get $hwnd)))
            (local.set $oy (call $wnd_window_screen_y (local.get $hwnd))))
          (else
            (local.set $ox (call $wnd_client_screen_x (local.get $hwnd)))
            (local.set $oy (call $wnd_client_screen_y (local.get $hwnd))))))
      (else
        (if (i32.eqz (call $gdi_dc_is_screen (local.get $hdc)))
          (then (global.set $last_error (i32.const 6)) (return (i32.const 0))))))
    (block $cleanup
      (local.set $effective (call $gdi_dc_effective_clip_region (local.get $hdc)))
      (br_if $cleanup (i32.eqz (local.get $effective)))
      (local.set $limit (call $gdi_rgn_alloc_rect
        (i32.sub (i32.const 0) (local.get $ox)) (i32.sub (i32.const 0) (local.get $oy))
        (i32.sub (call $screen_metric_w) (local.get $ox))
        (i32.sub (call $screen_metric_h) (local.get $oy))))
      (br_if $cleanup (i32.eqz (local.get $limit)))
      (br_if $cleanup (i32.eqz (call $gdi_rgn_combine
        (local.get $effective) (local.get $effective) (local.get $limit) (i32.const 1))))
      (drop (call $gdi_rgn_delete (local.get $limit)))
      (local.set $limit (i32.const 0))
      (if (local.get $clip)
        (then
          (local.set $clip_w (cast ptr<Rect> (call $g2w (local.get $clip))))
          (local.set $cl (load.field Rect left (local.get $clip_w)))
          (local.set $ct (load.field Rect top (local.get $clip_w)))
          (local.set $cr (load.field Rect right (local.get $clip_w)))
          (local.set $cb (load.field Rect bottom (local.get $clip_w)))
          (if (i32.or (i32.ge_s (local.get $cl) (local.get $cr))
                      (i32.ge_s (local.get $ct) (local.get $cb)))
            (then (local.set $result (i32.const -1)) (br $cleanup)))
          (local.set $limit (call $gdi_rgn_alloc_rect
            (local.get $cl) (local.get $ct) (local.get $cr) (local.get $cb)))
          (br_if $cleanup (i32.eqz (local.get $limit)))
          (br_if $cleanup (i32.eqz (call $gdi_rgn_combine
            (local.get $effective) (local.get $effective) (local.get $limit) (i32.const 1))))))
      (if (i32.eq (call $gdi_rgn_get_box (local.get $effective) (local.get $rect_w)) (i32.const 1))
        (then (local.set $result (i32.const -1)) (br $cleanup)))
      (local.set $saved (call $gdi_dc_save (local.get $hdc)))
      (br_if $cleanup (i32.eqz (local.get $saved)))
      (if (i32.eqz (call $gdi_dc_clip_select (local.get $hdc) (local.get $effective)))
        (then (drop (call $gdi_dc_restore (local.get $hdc) (local.get $saved))) (br $cleanup)))
      (local.set $result (local.get $saved)))
    (if (local.get $limit) (then (drop (call $gdi_rgn_delete (local.get $limit)))))
    (if (local.get $effective) (then (drop (call $gdi_rgn_delete (local.get $effective)))))
    (if (i32.eqz (local.get $result)) (then (global.set $last_error (i32.const 8))))
    (local.get $result))

  (func $monitor_enum_continue
    (local $frame i32) (local $ret i32) (local $esp i32)
    (local.set $frame (i32.load offset=16 (global.get $reg_base)))
    (local.set $ret (call $gl32 (local.get $frame)))
    (local.set $esp (call $gl32 (i32.add (local.get $frame) (i32.const 4))))
    (if (call $gl32 (i32.add (local.get $frame) (i32.const 24)))
      (then (drop (call $gdi_dc_restore
        (call $gl32 (i32.add (local.get $frame) (i32.const 24)))
        (call $gl32 (i32.add (local.get $frame) (i32.const 28)))))))
    (i32.store offset=16 (global.get $reg_base) (local.get $esp))
    (i32.store offset=0 (global.get $reg_base)
      (i32.ne (i32.load offset=0 (global.get $reg_base)) (i32.const 0)))
    (global.set $eip (local.get $ret)))

  (func $handle_EnumDisplayMonitors (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret i32) (local $end i32) (local $frame i32) (local $rect i32)
    (local $left i32) (local $top i32) (local $right i32) (local $bottom i32)
    (local $clip_right i32) (local $clip_bottom i32) (local $saved i32)
    (local.set $ret (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
    (local.set $end (i32.load offset=16 (global.get $reg_base)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (if (i32.eqz (local.get $arg2))
      (then (global.set $last_error (i32.const 87)) (return)))
    (local.set $frame (i32.sub (local.get $end) (i32.const 32)))
    (local.set $rect (i32.add (local.get $frame) (i32.const 8)))
    (if (local.get $arg0)
      (then
        (local.set $saved (call $monitor_enum_prepare_dc
          (local.get $arg0) (local.get $arg1) (call $g2w (local.get $rect))))
        (if (i32.eqz (local.get $saved)) (then (return)))
        (if (i32.lt_s (local.get $saved) (i32.const 0))
          (then (i32.store offset=0 (global.get $reg_base) (i32.const 1)) (return)))
        (call $monitor_enum_invoke (local.get $arg2) (local.get $arg3)
          (local.get $ret) (local.get $end) (local.get $arg0) (local.get $saved))
        (return)))
    (local.set $right (call $screen_metric_w))
    (local.set $bottom (call $screen_metric_h))
    (if (local.get $arg1)
      (then
        (local.set $left (call $gl32 (local.get $arg1)))
        (local.set $top (call $gl32 (i32.add (local.get $arg1) (i32.const 4))))
        (local.set $clip_right (call $gl32 (i32.add (local.get $arg1) (i32.const 8))))
        (local.set $clip_bottom (call $gl32 (i32.add (local.get $arg1) (i32.const 12))))
        (if (i32.lt_s (local.get $clip_right) (local.get $right))
          (then (local.set $right (local.get $clip_right))))
        (if (i32.lt_s (local.get $clip_bottom) (local.get $bottom))
          (then (local.set $bottom (local.get $clip_bottom))))
        (if (i32.lt_s (local.get $left) (i32.const 0))
          (then (local.set $left (i32.const 0))))
        (if (i32.lt_s (local.get $top) (i32.const 0))
          (then (local.set $top (i32.const 0))))))
    (if (i32.or (i32.ge_s (local.get $left) (local.get $right))
                (i32.ge_s (local.get $top) (local.get $bottom)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 1)) (return)))
    ;; With NULL HDC, clipping selects monitors; the callback still receives
    ;; the full monitor rectangle, not the selection intersection.
    (local.set $left (i32.const 0))
    (local.set $top (i32.const 0))
    (local.set $right (call $screen_metric_w))
    (local.set $bottom (call $screen_metric_h))
    (call $gs32 (local.get $rect) (local.get $left))
    (call $gs32 (i32.add (local.get $rect) (i32.const 4)) (local.get $top))
    (call $gs32 (i32.add (local.get $rect) (i32.const 8)) (local.get $right))
    (call $gs32 (i32.add (local.get $rect) (i32.const 12)) (local.get $bottom))
    (call $monitor_enum_invoke (local.get $arg2) (local.get $arg3)
      (local.get $ret) (local.get $end) (i32.const 0) (i32.const 0)))

  (func $monitor_enum_invoke (param $callback i32) (param $data i32)
      (param $ret i32) (param $end i32) (param $hdc i32) (param $saved i32)
    (local $frame i32) (local $rect i32)
    (if (i32.eqz (global.get $monitor_enum_thunk))
      (then (global.set $monitor_enum_thunk (call $com_cont_thunk (i32.const 0xCACA0036)))))
    (local.set $frame (i32.sub (local.get $end) (i32.const 32)))
    (local.set $rect (i32.add (local.get $frame) (i32.const 8)))
    (call $gs32 (local.get $frame) (local.get $ret))
    (call $gs32 (i32.add (local.get $frame) (i32.const 4)) (local.get $end))
    (call $gs32 (i32.add (local.get $frame) (i32.const 24)) (local.get $hdc))
    (call $gs32 (i32.add (local.get $frame) (i32.const 28)) (local.get $saved))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (local.get $frame) (i32.const 20)))
    (call $gs32 (i32.sub (local.get $frame) (i32.const 20)) (global.get $monitor_enum_thunk))
    (call $gs32 (i32.sub (local.get $frame) (i32.const 16)) (i32.const 0x10000))
    (call $gs32 (i32.sub (local.get $frame) (i32.const 12)) (local.get $hdc))
    (call $gs32 (i32.sub (local.get $frame) (i32.const 8)) (local.get $rect))
    (call $gs32 (i32.sub (local.get $frame) (i32.const 4)) (local.get $data))
    (global.set $eip (local.get $callback))
    (global.set $handler_set_eip (i32.const 1))
    (global.set $steps (i32.const 0)))

  ;; 91: GetClientRect
  (func $handle_GetClientRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $cs i32)
    (local.set $cs (call $wnd_get_client_size_packed (local.get $arg0)))
    (call $gs32 (local.get $arg1) (i32.const 0))       ;; left
    (call $gs32 (i32.add (local.get $arg1) (i32.const 4)) (i32.const 0))   ;; top
    (call $gs32 (i32.add (local.get $arg1) (i32.const 8))
      (i32.and (local.get $cs) (i32.const 0xFFFF)))     ;; right = clientW
    (call $gs32 (i32.add (local.get $arg1) (i32.const 12))
      (i32.shr_u (local.get $cs) (i32.const 16)))       ;; bottom = clientH
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))) (return)
  )

  ;; 92: GetWindowTextA(hwnd, lpString, nMaxCount) → int
  ;; A window's title as ANSI, into the guest buffer $buf ($max bytes), with
  ;; the character count as the result. There are three places a title can
  ;; live and both spellings of GetWindowText have to look in all of them, so
  ;; the search lives here and GetWindowTextW widens what it finds.
  (func $window_text_ansi (param $hwnd i32) (param $buf i32) (param $max i32) (result i32)
    (local $src i32) (local $len i32) (local $copy_len i32) (local $buf_wa i32)
    ;; Child controls own their text in their WAT-side wndproc state. Route
    ;; the read through WM_GETTEXT so edit/button/static text stays consistent
    ;; with GetDlgItemTextA and SetWindowTextA.
    (if (call $ctrl_table_get_class (local.get $hwnd))
      (then
        (return (call $control_wndproc_dispatch
          (local.get $hwnd) (i32.const 0x000D)
          (local.get $max) (local.get $buf)))))
    ;; Registered custom controls created from dialog resources live in the
    ;; WAT window table but may have no renderer-side child mirror. Their
    ;; wndprocs still expect USER's normal window-text storage to work.
    (local.set $src (call $title_table_get_ptr (local.get $hwnd)))
    (if (local.get $src)
      (then
        (if (i32.le_s (local.get $max) (i32.const 0))
          (then (return (i32.const 0))))
        (local.set $len (call $title_table_get_len (local.get $hwnd)))
        (local.set $copy_len (local.get $len))
        (if (i32.ge_u (local.get $copy_len) (local.get $max))
          (then (local.set $copy_len (i32.sub (local.get $max) (i32.const 1)))))
        (local.set $buf_wa (call $g2w (local.get $buf))) (call $memcpy (local.get $buf_wa) (local.get $src) (local.get $copy_len))
        (i32.store8 (i32.add (local.get $buf_wa) (local.get $copy_len)) (i32.const 0))
        (return (local.get $copy_len))))
    (call $host_get_window_text
      (local.get $hwnd) (call $g2w (local.get $buf)) (local.get $max)))

  (func $handle_GetWindowTextA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $window_text_ansi
      (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; Return the canonical Win32 name for a WAT-owned standard control. These
  ;; children deliberately do not have renderer.windows entries, so the host
  ;; fallback cannot identify them. Frameworks such as InstallShield inspect
  ;; the notification HWND with GetClassNameA before dispatching WM_COMMAND.
  (func $control_class_name_ptr (param $hwnd i32) (result i32)
    (local $class i32)
    (local.set $class (call $ctrl_table_get_class (local.get $hwnd)))
    (if (i32.eq (local.get $class) (i32.const 1)) (then (return (region.addr $CLASS_NAME_STRINGS 0x00)))) ;; Button
    (if (i32.or (i32.eq (local.get $class) (i32.const 2))
                (i32.or (i32.eq (local.get $class) (i32.const 24))
                        (i32.eq (local.get $class) (i32.const 25))))
      (then (return (region.addr $CLASS_NAME_STRINGS 0x08)))) ;; Edit / RichEdit-backed edit
    (if (i32.eq (local.get $class) (i32.const 3)) (then (return (region.addr $CLASS_NAME_STRINGS 0x0D)))) ;; Static
    (if (i32.eq (local.get $class) (i32.const 4)) (then (return (region.addr $CLASS_NAME_STRINGS 0x14)))) ;; ListBox
    (if (i32.eq (local.get $class) (i32.const 5)) (then (return (region.addr $CLASS_NAME_STRINGS 0x26)))) ;; ComboBox
    (if (i32.eq (local.get $class) (i32.const 7)) (then (return (region.addr $CLASS_NAME_STRINGS 0x1C)))) ;; ScrollBar
    (if (i32.eq (local.get $class) (i32.const 8)) (then (return (region.addr $CLASS_NAME_STRINGS 0x6A)))) ;; SysTreeView32
    (if (i32.eq (local.get $class) (i32.const 17)) (then (return (region.addr $CLASS_NAME_STRINGS 0x2F)))) ;; progress
    (if (i32.eq (local.get $class) (i32.const 18)) (then (return (region.addr $CLASS_NAME_STRINGS 0x41)))) ;; SysListView32
    (if (i32.eq (local.get $class) (i32.const 19)) (then (return (region.addr $CLASS_NAME_STRINGS 0x58)))) ;; trackbar
    (if (i32.eq (local.get $class) (i32.const 21)) (then (return (region.addr $CLASS_NAME_STRINGS 0x174)))) ;; toolbar
    (i32.const 0))

  ;; The name a window's class was actually registered under, as a WASM
  ;; address, or 0 when this hwnd has no class record or the class was named
  ;; by atom rather than by string.
  ;;
  ;; This outranks the built-in name because a superclass is still its own
  ;; class: Storm registers "SDlgStatic" over USER's Static and then decides
  ;; which artwork each dialog child gets by strcmp'ing GetClassNameA's answer
  ;; against that exact string (storm.dll 0x15005112). Answering "Static"
  ;; makes every lookup miss, and a child with no art record paints black.
  (func $wnd_registered_class_name (param $hwnd i32) (result i32)
    (local $slot i32) (local $name i32)
    (local.set $slot (call $wnd_get_class_slot (local.get $hwnd)))
    (if (i32.lt_s (local.get $slot) (i32.const 0)) (then (return (i32.const 0))))
    ;; WNDCLASSA sits at class record + 8; lpszClassName is its +36 field.
    (local.set $name (i32.load offset=44 (call $class_record_addr (local.get $slot))))
    ;; A small value is MAKEINTATOM, which names no string to hand back.
    (if (i32.lt_u (local.get $name) (i32.const 0x10000)) (then (return (i32.const 0))))
    (call $g2w (local.get $name)))

  (func $copy_control_class_name
    (param $hwnd i32) (param $buf i32) (param $max i32) (result i32)
    (local $src i32) (local $len i32) (local $buf_wa i32)
    (local.set $src (call $wnd_registered_class_name (local.get $hwnd)))
    (if (i32.eqz (local.get $src))
      (then (local.set $src (call $control_class_name_ptr (local.get $hwnd)))))
    (if (i32.or (i32.eqz (local.get $src)) (i32.le_s (local.get $max) (i32.const 0)))
      (then (return (i32.const -1))))
    (local.set $len (call $strlen (local.get $src)))
    (if (i32.ge_u (local.get $len) (local.get $max))
      (then (local.set $len (i32.sub (local.get $max) (i32.const 1)))))
    (local.set $buf_wa (call $g2w (local.get $buf))) (call $memcpy (local.get $buf_wa) (local.get $src) (local.get $len))
    (i32.store8 (i32.add (local.get $buf_wa) (local.get $len)) (i32.const 0))
    (local.get $len))

  ;; GetClassNameA(hwnd, lpClassName, nMaxCount) → chars copied
  (func $handle_GetClassNameA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $len i32)
    (local.set $len (call $copy_control_class_name
      (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (if (i32.ge_s (local.get $len) (i32.const 0))
      (then
        (i32.store offset=0 (global.get $reg_base) (local.get $len))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (i32.store offset=0 (global.get $reg_base) (call $host_get_window_class
      (local.get $arg0) (call $g2w (local.get $arg1)) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; A local WND_RECORDS entry, the permanent desktop, or a top-level window
  ;; owned by another process through the shared renderer are the three valid
  ;; HWND domains. Keep this predicate shared so geometry APIs and IsWindow do
  ;; not drift on cross renderer-only windows.
  (func $window_handle_valid (param $hwnd i32) (result i32)
    (i32.and
      (i32.ne (local.get $hwnd) (i32.const 0))
      (i32.or
        (i32.eq (local.get $hwnd) (i32.const 0x10000))
        (i32.or
          (i32.ge_s (call $wnd_table_find (local.get $hwnd)) (i32.const 0))
          (call $host_get_window_info (local.get $hwnd) (i32.const 4))))))

  ;; 93: GetWindowRect
  (func $handle_GetWindowRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; GetWindowRect(hwnd, lpRect) — fills RECT with screen coords
    (if (i32.eqz (call $window_handle_valid (local.get $arg0)))
      (then
        (global.set $last_error (i32.const 1400)) ;; ERROR_INVALID_WINDOW_HANDLE
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (call $host_get_window_rect (local.get $arg0) (call $g2w (local.get $arg1)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))) (return)
  )

  ;; 94: GetDlgCtrlID(hwnd) → the control id in this window's CONTROL_TABLE row
  (func $handle_GetDlgCtrlID (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $ctrl_table_get_id (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; 95: GetDlgItemTextA(hDlg, nIDDlgItem, lpString, nMaxCount) → int
  ;; Implemented as GetDlgItem + WM_GETTEXT so the control's own wndproc
  ;; serves the text from its EditState / ButtonState / StaticState — the
  ;; JS _controlText Map that used to cache these strings is gone.
  ;; A dialog item's text as ANSI, into the guest buffer $buf ($max bytes).
  ;; Both spellings of GetDlgItemText ask the control the same question and
  ;; differ only in the encoding they hand back.
  (func $dlg_item_text_ansi (param $hdlg i32) (param $id i32) (param $buf i32) (param $max i32) (result i32)
    (local $ctrl i32)
    (local.set $ctrl (call $ctrl_find_by_id (local.get $hdlg) (local.get $id)))
    (if (local.get $ctrl)
      (then (return (call $wnd_send_message (local.get $ctrl)
              (i32.const 0x000D)              ;; WM_GETTEXT
              (local.get $max)                ;; nMaxCount
              (local.get $buf)))))            ;; lpString (guest ptr)
    ;; Empty string on miss, matching Win32. NOTE: i32.and is BITWISE — for
    ;; a logical "ptr non-null AND len > 0" coerce both sides to 0/1 first,
    ;; otherwise an even-aligned ptr & 1 = 0 and the null-terminator never lands.
    (if (i32.and (i32.ne (local.get $buf) (i32.const 0))
                 (i32.gt_u (local.get $max) (i32.const 0)))
      (then (i32.store8 (call $g2w (local.get $buf)) (i32.const 0))))
    (i32.const 0))

  (func $handle_GetDlgItemTextA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $dlg_item_text_ansi
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))) (return)
  )

  ;; 96: GetDlgItem(hDlg, nIDDlgItem) → HWND of child control
  ;; Returns NULL if hDlg is 0 or child not found; otherwise real control HWND
  (func $handle_GetDlgItem (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $result i32)
    ;; NULL parent → no dialog → return NULL
    (if (i32.eqz (local.get $arg0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    ;; Look up real HWND from the control table. Returning a fabricated HWND
    ;; makes later APIs like SetWindowTextA report success against a non-window,
    ;; which hides missing-template/control bugs from the app.
    (local.set $result (call $ctrl_find_by_id (local.get $arg0) (local.get $arg1)))
    (i32.store offset=0 (global.get $reg_base) (local.get $result))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))  ;; stdcall, 2 args
  )

  ;; 97: GetCursorPos
  (func $handle_GetCursorPos (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $pos i32)
    (local $x i32)
    (local $y i32)
    (local.set $pos (call $host_get_mouse_position))
    (local.set $x (i32.and (local.get $pos) (i32.const 0xFFFF)))
    (local.set $y (i32.and (i32.shr_u (local.get $pos) (i32.const 16)) (i32.const 0xFFFF)))
    (global.set $last_msg_pos_x (local.get $x))
    (global.set $last_msg_pos_y (local.get $y))
    (call $gs32 (local.get $arg0) (local.get $x))
    (call $gs32 (i32.add (local.get $arg0) (i32.const 4)) (local.get $y))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))) (return)
  )

  ;; 98: GetLastActivePopup(hWnd) — 1 arg stdcall. USER remembers the last
  ;; active direct owned popup; child/owned windows and empty groups return hWnd.
  ;; The per-owner state and validation are keyed by live window-table slots.
  (func $handle_GetLastActivePopup (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $wnd_get_last_active_popup (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; 99: GetFocus — STUB: unimplemented
  (func $handle_GetFocus (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (global.get $focus_hwnd))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  ;; 100: ReleaseDC(hwnd, hdc) — release the WAT-owned DC, return 1.
  (func $handle_ReleaseDC (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (drop (call $host_release_dc (local.get $arg1)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 101: SetWindowLongA — STUB: unimplemented
  (func $handle_SetWindowLongA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wndproc i32) (local $thunk_idx i32) (local $thunk_api i32)
    (local $slot i32) (local $dialog_marked i32)
    ;; SetWindowLongA(hWnd, nIndex, dwNewLong) — nIndex is signed
    ;; GWL_WNDPROC=-4, GWL_USERDATA=-21, GWL_STYLE=-16, GWL_EXSTYLE=-20, GWL_ID=-12
    ;; Also positive indices for dialog extra bytes (DWLP_USER etc.)
    (if (i32.eq (local.get $arg1) (i32.const -21))  ;; GWL_USERDATA
      (then
        (i32.store offset=0 (global.get $reg_base) (call $wnd_set_userdata (local.get $arg0) (local.get $arg2)))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))) (return)))
    (if (i32.eq (local.get $arg1) (i32.const -4))   ;; GWL_WNDPROC — subclass
      (then
        (i32.store offset=0 (global.get $reg_base)
          (call $wndproc_public (local.get $arg0) (call $wnd_table_get (local.get $arg0))))  ;; return old wndproc
        ;; Top-level placeholders have no previous guest proc. Native controls,
        ;; however, must return the built-in sentinel so subclasses can chain
        ;; stateful messages through CallWindowProc.
        (if (i32.and
              (i32.eq (i32.load offset=0 (global.get $reg_base)) (global.get $WNDPROC_BUILTIN))
              (i32.eqz (call $ctrl_table_get_class (local.get $arg0))))
          (then (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
        ;; If old wndproc is 0 (not in table), fall back to global wndproc for main window
        (if (i32.and (i32.eqz (i32.load offset=0 (global.get $reg_base)))
                     (i32.eq (local.get $arg0) (global.get $main_hwnd)))
          (then (i32.store offset=0 (global.get $reg_base) (global.get $wndproc_addr))))
        ;; WAT-native trackbars already implement the common-control messages
        ;; Funtris uses. Letting the app replace their wndproc routes every
        ;; initialization SendMessage through an x86 subclass chain that never
        ;; reaches browser-idle again, so keep the native wndproc installed.
        (if (i32.eq (call $ctrl_table_get_class (local.get $arg0)) (i32.const 19))
          (then
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
            (return)))
        ;; Putting a native control's GWL_WNDPROC back (an app removing its
        ;; subclass) reinstalls the native proc, and makes an unclassified
        ;; window that control, as installing USER's EDIT proc would on Windows.
        (local.set $wndproc (local.get $arg2))
        (local.set $slot (call $wndproc_ctrl_kind (local.get $arg2)))
        (if (local.get $slot)
          (then
            (local.set $wndproc (global.get $WNDPROC_CTRL_NATIVE))
            (call $wndproc_adopt_ctrl_kind (local.get $arg0) (local.get $slot))))
        (call $wnd_table_set (local.get $arg0) (local.get $wndproc)) ;; set new wndproc
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))) (return)))
    (if (i32.eq (local.get $arg1) (i32.const -12))  ;; GWL_ID
      (then
        ;; CONTROL_TABLE+4 is the ONLY copy of the notification id, so this one
        ;; store is the whole of GWL_ID. There used to be a second store here
        ;; hand-syncing ButtonState's own copy — a bare (i32.store offset=12)
        ;; against a record declared in another file — because a control whose
        ;; id is reassigned after creation must notify with the NEW id (VCL
        ;; creates TNewButton with hMenu=0 and assigns its id immediately
        ;; afterward; a stale zero made its mouse release notify the form as
        ;; command 0). That sync covered ctrl_class 1 and no other, so combo
        ;; boxes, list boxes, list views and colour grids kept notifying with
        ;; the id they were created with. Deleting the duplicate field fixes
        ;; all five at once and removes the raw offset.
        (i32.store offset=0 (global.get $reg_base) (call $ctrl_table_set_id (local.get $arg0) (local.get $arg2)))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))) (return)))
    (if (i32.eq (local.get $arg1) (i32.const -16))  ;; GWL_STYLE
      (then
        (i32.store offset=0 (global.get $reg_base) (call $wnd_set_style (local.get $arg0) (local.get $arg2)))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))) (return)))
    (if (i32.eq (local.get $arg1) (i32.const -20))  ;; GWL_EXSTYLE
      (then
        (i32.store offset=0 (global.get $reg_base) (call $ctrl_get_ex_style (local.get $arg0)))  ;; old value
        (call $ctrl_set_ex_style (local.get $arg0) (local.get $arg2))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))) (return)))
    ;; Dialog and registered-window extra bytes are independent of application
    ;; GWL_USERDATA. WinHelp's toolbar uses multiple positive LONG offsets.
    (if (i32.ge_s (local.get $arg1) (i32.const 0))
      (then
        ;; DWLP_DLGPROC is byte offset 4 on Win32. A raw dialog class can use
        ;; USER32's imported DefDlgProcA/W thunk as its registered WNDPROC,
        ;; then attach the actual DLGPROC with SetWindowLong. Keep that proc in
        ;; the dialog table: treating it as ordinary class-extra data makes
        ;; DefDlgProc silently discard WM_INITDIALOG and every owner-draw call.
        (local.set $wndproc (call $wnd_table_get (local.get $arg0)))
        (local.set $slot (call $wnd_table_find (local.get $arg0)))
        (local.set $dialog_marked (i32.const 0))
        (if (i32.ge_s (local.get $slot) (i32.const 0))
          (then
            (local.set $dialog_marked
              (i32.load offset=8 (call $dialog_state_addr (local.get $slot))))))
        (local.set $thunk_api (i32.const -1))
        (if (thunk-contains (local.get $wndproc))
          (then
            (local.set $thunk_idx
              (i32.div_u
                (i32.sub (local.get $wndproc) (global.get $thunk_guest_base))
                (i32.const 8)))
            (local.set $thunk_api
              (i32.load (i32.add
                (i32.add (global.get $THUNK_BASE)
                  (i32.mul (local.get $thunk_idx) (i32.const 8)))
                (i32.const 4))))))
        (if (i32.and
              (i32.eq (local.get $arg1) (i32.const 4))
              (i32.or
                (i32.eq (local.get $wndproc) (global.get $WNDPROC_DIALOG))
                (i32.or
                  (i32.ne (local.get $dialog_marked) (i32.const 0))
                  (i32.or
                    (call $wnd_class_is_dialog (local.get $arg0))
                    (i32.or
                      (i32.eq (local.get $thunk_api) (i32.const 2649))
                      (i32.eq (local.get $thunk_api) (i32.const 2650)))))))
          (then
            (i32.store offset=0 (global.get $reg_base) (call $dialog_proc_set (local.get $arg0) (local.get $arg2)))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
            (return)))
        (if (call $dialog_proc_get (local.get $arg0))
          (then
            (i32.store offset=0 (global.get $reg_base) (call $dialog_extra_set
              (local.get $arg0) (local.get $arg1) (local.get $arg2))))
          (else
            (i32.store offset=0 (global.get $reg_base) (call $wnd_extra_set
              (local.get $arg0) (local.get $arg1) (local.get $arg2)))))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))) (return)))
    ;; Default: return 0 for unhandled indices
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; SetWindowWord(hWnd, nIndex, wNewWord) → WORD (previous value)
  ;;
  ;; Win16's window-word API, still exported by USER32 and still used: Win98's
  ;; System Monitor calls it for View > Hide Title Bar, and with no entry point
  ;; registered that menu item was a hard fail-fast crash.
  ;;
  ;; A negative index names the same field as SetWindowLong -- GWL_WNDPROC -4,
  ;; GWL_ID -12, GWL_STYLE -16 and friends -- so hand those to the 32-bit
  ;; handler and narrow the result, rather than keeping a second copy of that
  ;; logic. Both are stdcall(3), so it pops the frame correctly for us too.
  ;;
  ;; A non-negative index is a byte offset into the window's extra bytes, and
  ;; the whole point of this call is that it touches exactly two of them:
  ;; widening it to a dword store would silently clobber the neighbouring word.
  (func $handle_SetWindowWord (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $slot i32) (local $p i32) (local $old i32)
    (if (i32.lt_s (local.get $arg1) (i32.const 0))
      (then
        (call $handle_SetWindowLongA
          (local.get $arg0) (local.get $arg1)
          (i32.and (local.get $arg2) (i32.const 0xFFFF))
          (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
        (i32.store offset=0 (global.get $reg_base) (i32.and (i32.load offset=0 (global.get $reg_base)) (i32.const 0xFFFF)))
        (return)))
    (local.set $slot (call $wnd_table_find (local.get $arg0)))
    ;; $WND_EXTRA_STRIDE bytes of extra storage per window; a word needs both
    ;; of its bytes inside it.
    (if (i32.or (i32.lt_s (local.get $slot) (i32.const 0))
                (i32.gt_u (local.get $arg1)
                  (i32.sub (global.get $WND_EXTRA_STRIDE) (i32.const 2))))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (local.set $p (call $wnd_extra_addr (local.get $slot) (local.get $arg1)))
    (local.set $old (i32.load16_u (local.get $p)))
    (i32.store16 (local.get $p) (i32.and (local.get $arg2) (i32.const 0xFFFF)))
    (i32.store offset=0 (global.get $reg_base) (local.get $old))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; GetWindowWord(hWnd, nIndex) → WORD. Negative indices and the aligned
  ;; window-extra offsets used by Win32 applications share GetWindowLong's
  ;; backing state; return its low word. Both APIs are stdcall(2), so the long
  ;; handler also performs the correct stack cleanup.
  (func $handle_GetWindowWord (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_GetWindowLongA
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
    (i32.store offset=0 (global.get $reg_base) (i32.and (i32.load offset=0 (global.get $reg_base)) (i32.const 0xFFFF)))
  )

  ;; 102: SetWindowTextA
  (func $handle_SetWindowTextA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32) (local $len i32)
    (if (i32.eqz (local.get $arg0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (local.set $wa (call $g2w (local.get $arg1)))
    (local.set $len (call $guest_strlen (local.get $arg1)))
    ;; Child controls treat SetWindowText as WM_SETTEXT on their own wndproc.
    ;; Top-level dialogs/windows still update the caption title table below.
    (if (i32.and
          (i32.ne (call $ctrl_table_get_class (local.get $arg0)) (i32.const 0))
          (i32.or
            (i32.lt_u (call $ctrl_table_get_class (local.get $arg0)) (i32.const 10))
            (i32.gt_u (call $ctrl_table_get_class (local.get $arg0)) (i32.const 16))))
      (then
        (i32.store offset=0 (global.get $reg_base) (call $control_wndproc_dispatch
          (local.get $arg0) (i32.const 0x000C) (i32.const 0) (local.get $arg1)))
        (call $host_set_window_text (local.get $arg0) (local.get $wa))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    ;; Native child windows such as RichEdit20A are not WAT control-table
    ;; controls, but SetWindowText still maps to WM_SETTEXT for them. Without
    ;; this, WordPad's File->New title reset succeeds while the RichEdit buffer
    ;; keeps the previous document text.
    (if (i32.and
          (i32.ne (call $wnd_get_parent (local.get $arg0)) (i32.const 0))
          (i32.ne (call $wnd_table_get (local.get $arg0)) (i32.const 0)))
      (then
        (call $richedit_format_reset_hwnd (local.get $arg0))
        (call $title_table_set (local.get $arg0) (local.get $wa) (local.get $len))
        (i32.store offset=0 (global.get $reg_base) (call $wnd_send_message
          (local.get $arg0) (i32.const 0x000C) (i32.const 0) (local.get $arg1)))
        (call $host_set_window_text (local.get $arg0) (local.get $wa))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    ;; Store in TITLE_TABLE so DefWindowProc WM_NCPAINT can redraw the
    ;; caption text from WAT-side state. Also post WM_NCPAINT.
    (call $title_table_set (local.get $arg0) (local.get $wa) (local.get $len))
    (call $nc_flags_set (local.get $arg0) (i32.const 1))
    ;; SetWindowText can run inside a synchronous common-dialog hook, where
    ;; the normal deferred NC-paint scan cannot run until after the modal
    ;; frame is already exposed. Paint the new caption immediately as USER does.
    (call $defwndproc_do_ncpaint (local.get $arg0))
    (call $host_set_window_text (local.get $arg0) (local.get $wa))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))) (return)
  )

  ;; 103: SetDlgItemTextA — delegate to the control's wndproc via
  ;; WM_SETTEXT so EditState / ButtonState / StaticState own the string.
  (func $handle_SetDlgItemTextA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ctrl i32) (local $wa i32) (local $len i32)
    (local.set $ctrl (call $ctrl_find_by_id (local.get $arg0) (local.get $arg1)))
    (if (local.get $ctrl)
      (then
        ;; USER's window text is independent of the class wndproc. Registered
        ;; dialog controls such as Sound Recorder's noflicker readout query it
        ;; through GetWindowTextA while painting.
        (if (local.get $arg2)
          (then
            (local.set $wa (call $g2w (local.get $arg2)))
            (local.set $len (call $strlen (local.get $wa)))))
        (call $title_table_set (local.get $ctrl) (local.get $wa) (local.get $len))
        (drop (call $wnd_send_message (local.get $ctrl)
                (i32.const 0x000C)                    ;; WM_SETTEXT
                (i32.const 0)
                (local.get $arg2)))))                 ;; lpString (guest ptr)
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))) (return)
  )

  ;; 104: SetDlgItemInt(hDlg, nIDDlgItem, uValue, bSigned) — format integer
  ;; into decimal ASCII and delegate to WM_SETTEXT on the child edit.
  (func $handle_SetDlgItemInt (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ctrl i32) (local $buf i32) (local $buf_w i32)
    (local $val i32) (local $neg i32) (local $tmp i32)
    (local $digits i32) (local $i i32)
    (local.set $ctrl (call $ctrl_find_by_id (local.get $arg0) (local.get $arg1)))
    (if (local.get $ctrl)
      (then
        (local.set $val (local.get $arg2))
        (local.set $neg (i32.const 0))
        (if (i32.and (i32.ne (local.get $arg3) (i32.const 0))
                     (i32.lt_s (local.get $val) (i32.const 0)))
          (then
            (local.set $neg (i32.const 1))
            (local.set $val (i32.sub (i32.const 0) (local.get $val)))))
        ;; 16-byte scratch is plenty: max 10 digits + sign + NUL
        (local.set $buf (call $heap_alloc (i32.const 16)))
        (if (local.get $buf)
          (then
            (local.set $buf_w (call $g2w (local.get $buf)))
            ;; Count digits (at least 1 for val==0)
            (local.set $tmp (local.get $val))
            (local.set $digits (i32.const 1))
            (block $cnt_done (loop $cnt
              (local.set $tmp (i32.div_u (local.get $tmp) (i32.const 10)))
              (br_if $cnt_done (i32.eqz (local.get $tmp)))
              (local.set $digits (i32.add (local.get $digits) (i32.const 1)))
              (br $cnt)))
            ;; Write sign if needed
            (if (local.get $neg)
              (then
                (i32.store8 (local.get $buf_w) (i32.const 0x2D))  ;; '-'
                (local.set $buf_w (i32.add (local.get $buf_w) (i32.const 1)))))
            ;; Emit digits right-to-left
            (local.set $i (i32.sub (local.get $digits) (i32.const 1)))
            (local.set $tmp (local.get $val))
            (block $emit_done (loop $emit
              (i32.store8
                (i32.add (local.get $buf_w) (local.get $i))
                (i32.add (i32.const 0x30) (i32.rem_u (local.get $tmp) (i32.const 10))))
              (local.set $tmp (i32.div_u (local.get $tmp) (i32.const 10)))
              (br_if $emit_done (i32.eqz (local.get $i)))
              (local.set $i (i32.sub (local.get $i) (i32.const 1)))
              (br $emit)))
            ;; NUL terminator
            (i32.store8 (i32.add (local.get $buf_w) (local.get $digits)) (i32.const 0))
            (drop (call $wnd_send_message (local.get $ctrl)
                    (i32.const 0x000C)          ;; WM_SETTEXT
                    (i32.const 0)
                    (local.get $buf)))
            (call $heap_free (local.get $buf)))))
      )
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))  ;; stdcall, 4 args
  )

  ;; 105: SetForegroundWindow(hWnd) — 1 arg stdcall
  (func $handle_SetForegroundWindow (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $activate_window_with_host (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; SwitchToThisWindow(hWnd, fAltTab) — activate renderer window
  (func $handle_SwitchToThisWindow (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (drop (call $activate_window_with_host (local.get $arg0)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; CloseWindow(hWnd) — despite the name, Win32 minimizes the window.
  (func $handle_CloseWindow (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $top i32) (local $slot i32)
    (local.set $slot (call $wnd_table_find (local.get $arg0)))
    (if (i32.and (i32.lt_s (local.get $slot) (i32.const 0))
                 (i32.eqz (call $host_get_window_info (local.get $arg0) (i32.const 4))))
      (then
        (global.set $last_error (i32.const 1400)) ;; ERROR_INVALID_WINDOW_HANDLE
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    ;; Use the same browser-side transition as SC_MINIMIZE and retain the
    ;; guest-visible bit queried by IsIconic/GetWindowPlacement.
    (call $host_sys_command (local.get $arg0) (i32.const 0xF020)) ;; SC_MINIMIZE
    (if (i32.ge_s (local.get $slot) (i32.const 0))
      (then
        (call $wnd_apply_show_state (local.get $arg0) (i32.const 6)) ;; SW_MINIMIZE
        (local.set $top (call $wnd_top_level (local.get $arg0)))
        (if (i32.eq (global.get $active_hwnd) (local.get $top))
          (then (drop (call $active_window_transition (i32.const 0)))))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; CascadeWindows(hwndParent, how, lpRect, cKids, lpKids) → arranged count.
  (func $handle_CascadeWindows (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_arrange_windows
      (i32.const 0) (local.get $arg1)
      (select (call $g2w (local.get $arg2)) (i32.const 0) (i32.ne (local.get $arg2) (i32.const 0)))
      (local.get $arg3)
      (select (call $g2w (local.get $arg4)) (i32.const 0) (i32.ne (local.get $arg4) (i32.const 0)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  ;; TileWindows(hwndParent, how, lpRect, cKids, lpKids) → arranged count.
  (func $handle_TileWindows (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_arrange_windows
      (i32.const 1) (local.get $arg1)
      (select (call $g2w (local.get $arg2)) (i32.const 0) (i32.ne (local.get $arg2) (i32.const 0)))
      (local.get $arg3)
      (select (call $g2w (local.get $arg4)) (i32.const 0) (i32.ne (local.get $arg4) (i32.const 0)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  ;; ArrangeIconicWindows(hwndParent) → height occupied by icon rows.
  (func $handle_ArrangeIconicWindows (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_arrange_windows
      (i32.const 2) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; Helper: apply a new cursor and return the previous handle. Shared by
  ;; $handle_SetCursor and DefWindowProc's WM_SETCURSOR path.
  (func $set_cursor_internal (param $hcur i32) (result i32)
    (local $prev i32)
    (local.set $prev (global.get $current_cursor))
    (global.set $current_cursor (local.get $hcur))
    ;; A cursor the guest built from bitmaps carries its own pixels; anything
    ;; else is an IDC_* or a PE resource the host resolves from the handle.
    (if (i32.eqz (call $cursor_push (local.get $hcur)))
      (then (call $host_set_cursor (call $icon_opaque_cursor_source (local.get $hcur)))))
    (local.get $prev))

  ;; 106: SetCursor(hCursor) — 1 arg stdcall, returns previous HCURSOR.
  (func $handle_SetCursor (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $set_cursor_internal (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; GetCursor() — return the cursor most recently installed by SetCursor.
  ;; SDL queries this while bringing its DirectDraw window to the foreground.
  (func $handle_GetCursor (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (global.get $current_cursor))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; Focus transfer policy is shared by Win32 and the far continuation.
  (global $focus_transition_serial (mut i32) (i32.const 0))
  (func $focus_target_allowed (param $hwnd i32) (result i32)
    (local $h i32) (local $depth i32)
    (if (i32.eqz (local.get $hwnd)) (then (return (i32.const 1))))
    (if (i32.lt_s (call $wnd_table_find (local.get $hwnd)) (i32.const 0))
      (then (global.set $last_error (i32.const 1400)) (return (i32.const 0))))
    (if (i32.ne (call $wnd_get_thread (local.get $hwnd)) (global.get $current_thread_id))
      (then (return (i32.const 0))))
    (local.set $h (local.get $hwnd))
    (loop $parents
      (if (i32.or (call $ctrl_style_disabled (call $wnd_get_style (local.get $h)))
            (call $wnd_min_get (local.get $h)))
        (then (global.set $last_error (i32.const 87)) (return (i32.const 0))))
      (if (i32.eqz (i32.and (call $wnd_get_style (local.get $h)) (i32.const 0x40000000)))
        (then (return (i32.const 1))))
      (local.set $h (call $wnd_get_parent (local.get $h)))
      (local.set $depth (i32.add (local.get $depth) (i32.const 1)))
      (if (i32.or (i32.lt_s (call $wnd_table_find (local.get $h)) (i32.const 0))
            (i32.ge_u (local.get $depth) (global.get $MAX_WINDOWS)))
        (then (return (i32.const 0))))
      (br $parents))
    (i32.const 0))

  (func $focus_publish (param $hwnd i32) (result i32)
    (local $old i32)
    (local.set $old (global.get $focus_hwnd))
    (global.set $focus_transition_serial (i32.add (global.get $focus_transition_serial) (i32.const 1)))
    (global.set $focus_hwnd (local.get $hwnd))
    (local.get $old))

  (func $focus_transfer_current (param $hwnd i32) (param $serial i32) (result i32)
    (i32.and
      (i32.eq (global.get $focus_transition_serial) (local.get $serial))
      (i32.and (i32.eq (global.get $focus_hwnd) (local.get $hwnd))
        (i32.or (i32.eqz (local.get $hwnd))
          (i32.ge_s (call $wnd_table_find (local.get $hwnd)) (i32.const 0))))))

  (func $focus_set_core (param $hwnd i32) (result i32)
    (local $top i32)
    (if (i32.eqz (call $focus_target_allowed (local.get $hwnd))) (then (return (i32.const 0))))
    (if (i32.eq (global.get $focus_hwnd) (local.get $hwnd))
      (then (return (local.get $hwnd))))
    (if (local.get $hwnd)
      (then
        (local.set $top (call $wnd_top_level (local.get $hwnd)))
        (if (i32.ne (global.get $active_hwnd) (local.get $top))
          (then (drop (call $activate_window_with_host (local.get $top)))))
        (if (i32.or (i32.ne (global.get $active_hwnd) (local.get $top))
              (i32.eqz (call $focus_target_allowed (local.get $hwnd))))
          (then (return (i32.const 0))))))
    (call $focus_notify_transfer (local.get $hwnd)))

  ;; Publish before notifications and preserve a callback-selected winner.
  ;; Internal control focus changes share this transaction; API activation
  ;; and ABI-specific far completion remain the caller's responsibility.
  (func $focus_notify_transfer (param $hwnd i32) (result i32)
    (local $old i32) (local $serial i32)
    ;; Native Win98 snapshots the return HWND AFTER ancestor activation.
    ;; Do not short-circuit a same-focus value reached during that activation:
    ;; the outer transfer still sends the measured self kill/set pair.
    (local.set $old (call $focus_publish (local.get $hwnd)))
    (local.set $serial (global.get $focus_transition_serial))
    (if (local.get $old)
      (then (drop (call $wnd_send_message (local.get $old) (i32.const 8) (local.get $hwnd) (i32.const 0)))))
    (if (i32.and (i32.ne (local.get $hwnd) (i32.const 0))
          (i32.ne (call $focus_transfer_current (local.get $hwnd) (local.get $serial)) (i32.const 0)))
      (then (drop (call $wnd_send_message (local.get $hwnd) (i32.const 7) (local.get $old) (i32.const 0)))))
    (local.get $old))

  ;; 107: SetFocus(hwnd) — synchronous USER transaction, not posted messages.
  (func $handle_SetFocus (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store (global.get $reg_base) (call $focus_set_core (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; 110: LoadStringA
  (func $handle_LoadStringA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; RT_STRING walker lives in WAT — see $string_load_a in 10-helpers.wat.
    ;; arg0 = hInstance — may be a satellite DLL (e.g. MCM's lang.dll). Route
    ;; the resource lookup to that module for the duration of the call.
    (call $push_rsrc_ctx (local.get $arg0))
    (i32.store offset=0 (global.get $reg_base) (call $string_load_a
      (local.get $arg1)                ;; string ID
      (call $g2w (local.get $arg2))    ;; buffer (WASM ptr)
      (local.get $arg3)))              ;; max chars
    (call $pop_rsrc_ctx)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))) (return)
  )

  ;; 111: LoadAcceleratorsA(hInstance, lpTableName). Each distinct resource
  ;; receives a real repository handle; a miss returns NULL rather than the old
  ;; unconditional fixed handle.
  (func $handle_LoadAcceleratorsA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $data i32)
    (call $push_rsrc_ctx (local.get $arg0))
    (local.set $data (call $rsrc_find_data_wa (i32.const 9) (local.get $arg1)))
    (call $pop_rsrc_ctx)
    (i32.store offset=0 (global.get $reg_base) (call $accel_table_load
      (local.get $data) (i32.div_u (global.get $rsrc_last_size) (i32.const 8))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))) (return)
  )

  ;; 112: EnableWindow
  ;; EnableWindow(hWnd, bEnable) returns nonzero only when the window was
  ;; previously disabled. COMCTL32's modal PropertySheet loop relies on that
  ;; exact Win32 contract: it remembers the owner only when its own disable
  ;; changed state, then re-enables the owner after destroying the sheet.
  (func $handle_EnableWindow (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $idx i32) (local $style i32) (local $new_style i32) (local $prev_disabled i32)
    (local.set $idx (call $wnd_table_find (local.get $arg0)))
    (if (i32.eq (local.get $idx) (i32.const -1))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (local.set $style (call $wnd_get_style (local.get $arg0)))
    (local.set $prev_disabled
      (i32.ne
        (i32.and (local.get $style) (i32.const 0x08000000))
        (i32.const 0)))
    (if (local.get $arg1)
      (then
        (local.set $new_style
          (i32.and (local.get $style) (i32.const 0xF7FFFFFF))))
      (else
        (local.set $new_style
          (i32.or (local.get $style) (i32.const 0x08000000)))))
    (if (i32.ne (local.get $new_style) (local.get $style))
      (then
        (drop (call $wnd_set_style (local.get $arg0) (local.get $new_style)))
        ;; WM_ENABLE(wParam=bEnable). Most built-in controls ignore it, but
        ;; owner/subclassed windows may rely on the notification.
        (drop (call $wnd_send_message
          (local.get $arg0) (i32.const 0x000A)
          (select (i32.const 1) (i32.const 0) (local.get $arg1))
          (i32.const 0)))))
    (i32.store offset=0 (global.get $reg_base) (local.get $prev_disabled))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))  ;; stdcall, 2 args
  )

;; 114: EndDialog(hDlg, nResult) — end modal dialog, set result
  (func $handle_EndDialog (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $deferred i32)
    ;; MFC also calls EndDialog on dialogs created through CreateDialogParamA.
    ;; Those modeless dialogs have no CACA0004 pump, so do not poison the
    ;; global modal-completion flags unless this hwnd is the active modal.
    ;; Both tests read the shared mirrors, not this instance's own
    ;; $dlg_pump_hwnd/$dlg_ended: the pump lives on main, and an NSIS installer
    ;; calls EndDialog from its extraction thread, whose private copies are 0.
    ;;
    ;; First EndDialog wins. Real USER only records the result and lets the
    ;; DialogBox loop destroy the window once the DLGPROC has returned, so the
    ;; WM_DESTROY the app then sees is delivered *after* the result has been
    ;; read. We destroy inline, so a DLGPROC that calls EndDialog again from
    ;; its own WM_DESTROY (Disk Cleanup answers WM_DESTROY with
    ;; EndDialog(hDlg, IDCANCEL)) would otherwise overwrite the IDOK the user
    ;; actually chose, and the caller would take the cancel path and exit.
    (if (i32.and
          (i32.and
            (i32.ne (i32.load (global.get $SHARED_DLG_PUMP_HWND)) (i32.const 0))
            (i32.eq (local.get $arg0) (i32.load (global.get $SHARED_DLG_PUMP_HWND))))
          (i32.eqz (i32.load (global.get $SHARED_DLG_ENDED))))
      (then
        (global.set $dlg_ended (i32.const 1))
        (global.set $dlg_result (local.get $arg1))
        (i32.store (global.get $SHARED_DLG_ENDED) (i32.const 1))
        (i32.store (global.get $SHARED_DLG_RESULT) (local.get $arg1))
        ;; CACA0004 checks dlg_ended to exit Wine Assembly's own modal pump.
        ;; A modeless/native dialog loop must finish its synchronous call stack
        ;; instead; yielding here strands Storm's SDlgDialogBoxParam before it
        ;; can observe SDlg_EndDialog and return the selected class.
        (global.set $yield_flag (i32.const 1))
        ;; This dialog belongs to our own modal pump, and CACA0004 tears it
        ;; down the moment the DLGPROC returns. Leave the window standing
        ;; until then, exactly as USER does: EndDialog only records the
        ;; result. A DLGPROC routinely keeps using its own controls after
        ;; calling EndDialog -- the DirectX SDK's bellhop reads the service
        ;; provider combo's item data back with SendDlgItemMessage(CB_
        ;; GETITEMDATA) in a `while (data != CB_ERR)` free loop right after
        ;; EndDialog(hDlg, 1). Destroying the controls here makes every one
        ;; of those calls answer 0 instead of CB_ERR, so the loop never ends
        ;; and the run dies with the host log buffer eating all of the JS
        ;; heap.
        (local.set $deferred (i32.const 1))))
    ;; Remove the visible frame here, even for DialogBoxParamA. Renderer-side
    ;; WAT dialog routing can call EndDialog synchronously while the guest is
    ;; between modal-pump turns; waiting for the pump leaves the dialog stuck
    ;; on screen. Use the normal recursive destruction path so the dialog and
    ;; its children receive WM_DESTROY/WM_NCDESTROY and dead focus/capture is
    ;; cleared. Storm's SDlgEndDialog relies on that lifecycle to advance from
    ;; Diablo's modeless class picker. The pump cleanup path below is guarded
    ;; for already-removed dialogs.
    (if (i32.and
          (i32.eqz (local.get $deferred))
          (i32.and
            (i32.ne (call $wnd_table_get (local.get $arg0)) (i32.const 0))
            (i32.ne (local.get $arg0) (global.get $dlg_ending_hwnd))))
      (then
        (global.set $dlg_ending_hwnd (local.get $arg0))
        (call $wnd_destroy_recursive (local.get $arg0))
        (global.set $dlg_ending_hwnd (i32.const 0))))
    ;; Don't set quit_flag — that kills the main message loop.
    ;; CACA0004 checks dlg_ended to exit the modal loop.
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))  ;; stdcall, 2 args
  )

  ;; 115: InvalidateRect(hwnd, lprc, bErase). lprc=NULL → full client rect.
  (func $handle_InvalidateRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $l i32) (local $t i32) (local $r i32) (local $b i32) (local $wa i32) (local $cs i32)
    (if (i32.eqz (local.get $arg0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))) (return)))
    (if (local.get $arg1)
      (then
        (local.set $wa (call $g2w (local.get $arg1)))
        (local.set $l (load.field Rect left (local.get $wa)))
        (local.set $t (load.field.memarg Rect top (local.get $wa)))
        (local.set $r (load.field.memarg Rect right (local.get $wa)))
        (local.set $b (load.field.memarg Rect bottom (local.get $wa))))
      (else
        (local.set $cs (call $host_get_window_client_size (local.get $arg0)))
        (local.set $l (i32.const 0)) (local.set $t (i32.const 0))
        (local.set $r (i32.and (local.get $cs) (i32.const 0xFFFF)))
        (local.set $b (i32.shr_u (local.get $cs) (i32.const 16)))))
    (call $update_invalidate_rect (local.get $arg0) (local.get $l) (local.get $t) (local.get $r) (local.get $b))
    ;; Both ABIs record bErase for BeginPaint's synchronous callback, never
    ;; as a separately queued erase. FALSE leaves an existing request intact.
    ;; Win16 used to discard TRUE to avoid the old queued-erase shortcut;
    ;; that shortcut is gone and its BeginPaint now owns the far callback.
    (if (local.get $arg2)
      (then
        (call $nc_flags_set (local.get $arg0) (i32.const 2))
        (call $invalidate_erase_children (local.get $arg0)
          (local.get $l) (local.get $t) (local.get $r) (local.get $b))))
    (if (i32.eq (local.get $arg0) (global.get $main_hwnd))
      (then (global.set $paint_pending (i32.const 1)))
      (else (call $paint_flag_set (local.get $arg0))))
    (call $host_invalidate (local.get $arg0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))) (return)
  )

  ;; 116: FillRect(hdc, lprc, hbr)
  (func $handle_FillRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $desc i32) (local $rc i32)
    (local.set $desc (global.get $GDI_LINE_DESC))
    (local.set $rc (call $g2w (local.get $arg1)))
    (if (call $gdi_surface_descriptor (local.get $arg0) (local.get $desc))
      (then (i32.store offset=0 (global.get $reg_base) (call $gdi_fill_rect_desc
        (local.get $arg0) (local.get $desc)
        (load.field Rect left (local.get $rc)) (load.field.memarg Rect top (local.get $rc))
        (load.field.memarg Rect right (local.get $rc)) (load.field.memarg Rect bottom (local.get $rc))
        (local.get $arg2))))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 117: FrameRect(hdc, lprc, hbr) — draw 1px frame using brush
  (func $handle_FrameRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32) (local $desc i32)
    (local.set $wa (call $g2w (local.get $arg1)))
    (local.set $desc (global.get $GDI_LINE_DESC))
    (if (call $gdi_surface_descriptor (local.get $arg0) (local.get $desc))
      (then (i32.store offset=0 (global.get $reg_base) (call $gdi_frame_rect_desc
        (local.get $arg0) (local.get $desc)
        (load.field Rect left (local.get $wa)) (load.field.memarg Rect top (local.get $wa))
        (load.field.memarg Rect right (local.get $wa)) (load.field.memarg Rect bottom (local.get $wa))
        (local.get $arg2))))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))  ;; stdcall, 3 args
  )

  ;; 118: LoadBitmapA
  (func $handle_LoadBitmapA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $gdi_bitmap_load_resource
      (local.get $arg0) (local.get $arg1) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))) (return)
  )

  ;; Restore and activate an iconic window. OpenIcon is not just a spelling of
  ;; ShowWindow(SW_RESTORE): USER first gives the wndproc a synchronous
  ;; WM_QUERYOPEN veto. WAT-native top-levels have no application override, so
  ;; their zero result means "use the default TRUE"; an x86 wndproc's zero is
  ;; an intentional veto unless it is a dialog that declined the message.
  (func $wnd_query_open_allowed (param $hwnd i32) (result i32)
    (local $wp i32) (local $query i32)
    (local.set $wp (call $wnd_table_get (local.get $hwnd)))
    (local.set $query
      (call $wnd_send_message
        (local.get $hwnd) (i32.const 0x0013) ;; WM_QUERYOPEN
        (i32.const 0) (i32.const 0)))
    (if (i32.and
          (i32.eqz (local.get $query))
          (i32.or
            (i32.and (i32.lt_u (local.get $wp) (i32.const 0xFFFF0000))
              (i32.ne (local.get $wp) (global.get $WNDPROC_BUILTIN)))
            (i32.and
              (i32.eq (local.get $wp) (global.get $WNDPROC_DIALOG))
              (global.get $dialog_last_proc_handled))))
      (then (return (i32.const 0))))
    ;; TRUE is not proof that application code left its target alive.
    (i32.ge_s (call $wnd_table_find (local.get $hwnd)) (i32.const 0)))

  (func $open_icon_core (param $hwnd i32) (result i32)
    (if (i32.lt_s (call $wnd_table_find (local.get $hwnd)) (i32.const 0))
      (then
        (global.set $last_error (i32.const 1400)) ;; ERROR_INVALID_WINDOW_HANDLE
        (return (i32.const 0))))
    (if (i32.eqz (call $wnd_min_get (local.get $hwnd)))
      (then (return (i32.const 0))))
    (if (i32.eqz (call $wnd_query_open_allowed (local.get $hwnd)))
      (then (return (i32.const 0))))

    (call $window_system_show_commit (local.get $hwnd) (i32.const 0xF120))
    (call $paint_flag_set_inv (local.get $hwnd))
    (call $nc_flags_set (local.get $hwnd) (i32.const 4))
    (drop (call $activate_window_with_host (local.get $hwnd)))
    (i32.const 1))

  ;; 119: OpenIcon(hwnd) — restores a minimized window; return nonzero.
  (func $handle_OpenIcon (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $open_icon_core (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; Pack an HWND's current window origin. Child coordinates are parent-client
  ;; relative; top-level coordinates come from the renderer-owned window rect.
  (func $window_xy_packed (param $hwnd i32) (result i32)
    (if (i32.ne
          (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x40000000))
          (i32.const 0))
      (then (return (call $ctrl_get_xy_packed (local.get $hwnd)))))
    (call $host_get_window_rect (local.get $hwnd) (global.get $WINDOW_RECT_SCRATCH))
    (i32.or
      (i32.and (i32.load (global.get $WINDOW_RECT_SCRATCH)) (i32.const 0xFFFF))
      (i32.shl
        (i32.and (i32.load offset=4 (global.get $WINDOW_RECT_SCRATCH)) (i32.const 0xFFFF))
        (i32.const 16))))

  ;; 120: MoveWindow — hwnd(arg0), x(arg1), y(arg2), w(arg3), h(arg4), bRepaint=[esp+24]
  ;; MoveWindow is SetWindowPos without z-order/activation changes. A false
  ;; bRepaint maps to SWP_NOREDRAW and suppresses update-region creation.
  ;; A same-size MoveWindow is marked SWP_NOSIZE before WM_WINDOWPOSCHANGED, so
  ;; DefWindowProc does not send another WM_SIZE. Some applications enforce an
  ;; aspect ratio from WM_SIZE by calling MoveWindow with the dimensions they
  ;; already have; repeating the message would recurse forever.
  (func $handle_MoveWindow (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $flags i32)
    (local.set $flags (select (i32.const 0x14) (i32.const 0x1c)
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
    (i32.store offset=0 (global.get $reg_base)
      (call $move_window_core (local.get $arg0) (i32.const 0)
        (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4)
        (local.get $flags) (i32.const 0))))

  ;; External result ownership has the same contract as set_window_pos_core:
  ;; the far caller owns CHANGING/CHANGED and invokes finish after CHANGED.
  (func $move_window_core
    (param $arg0 i32) (param $insert_after i32)
    (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32)
    (param $flags i32) (param $result_pos i32) (result i32)
    (local $cx i32) (local $cy i32) (local $cs i32) (local $old_cs i32)
    (local $x i32) (local $y i32) (local $old_xy i32) (local $new_xy i32)
    (local $original_flags i32) (local $windowpos i32)
    (if (i32.or (i32.eqz (local.get $arg0))
          (i32.lt_s (call $wnd_table_find (local.get $arg0)) (i32.const 0)))
      (then (global.set $last_error (i32.const 1400)) (return (i32.const 0))))
    (local.set $x (local.get $arg1))
    (local.set $y (local.get $arg2))
    (local.set $cx (local.get $arg3))
    (local.set $cy (local.get $arg4))
    (local.set $original_flags (local.get $flags))
    (local.set $windowpos (local.get $result_pos))
    (if (i32.eqz (local.get $result_pos))
      (then (local.set $windowpos (call $windowpos_message_begin
        (local.get $arg0) (local.get $insert_after)
        (local.get $x) (local.get $y) (local.get $cx) (local.get $cy)
        (local.get $flags)))))
    (if (i32.and (i32.ne (local.get $windowpos) (i32.const 0)) (i32.eqz (local.get $result_pos)))
      (then
        (local.set $insert_after
          (call $gl32 (i32.add (local.get $windowpos) (i32.const 4))))
        (local.set $x
          (call $gl32 (i32.add (local.get $windowpos) (i32.const 8))))
        (local.set $y
          (call $gl32 (i32.add (local.get $windowpos) (i32.const 12))))
        (local.set $cx
          (call $gl32 (i32.add (local.get $windowpos) (i32.const 16))))
        (local.set $cy
          (call $gl32 (i32.add (local.get $windowpos) (i32.const 20))))
        (local.set $flags
          (i32.or
            (i32.and
              (call $gl32 (i32.add (local.get $windowpos) (i32.const 24)))
              (i32.const 0xFFFFFDEF))
            (i32.and (local.get $original_flags) (i32.const 0x00000210))))
        (if (i32.lt_s (call $wnd_table_find (local.get $arg0)) (i32.const 0))
          (then
            (call $windowpos_message_cancel (local.get $windowpos))
            (global.set $last_error (i32.const 1400))
            (return (i32.const 0))))))
    (local.set $old_cs (call $host_get_window_client_size (local.get $arg0)))
    (local.set $old_xy (call $window_xy_packed (local.get $arg0)))
    (call $host_move_window (local.get $arg0) (local.get $x) (local.get $y)
      (local.get $cx) (local.get $cy) (local.get $flags))
    (if (i32.and (i32.eqz (i32.and (local.get $flags) (i32.const 4)))
          (i32.eqz (i32.and (call $wnd_get_style (local.get $arg0)) (i32.const 0x40000000))))
      (then (call $host_set_window_zorder (local.get $arg0) (local.get $insert_after))))
    (call $ctrl_geom_sync (local.get $arg0) (local.get $x) (local.get $y)
      (local.get $cx) (local.get $cy) (local.get $flags))
    (call $defwndproc_do_nccalcsize (local.get $arg0))
    (call $host_sync_window_client
      (local.get $arg0)
      (call $wnd_client_screen_x (local.get $arg0))
      (call $wnd_client_screen_y (local.get $arg0))
      (i32.sub (call $client_rect_get_r (local.get $arg0)) (call $client_rect_get_l (local.get $arg0)))
      (i32.sub (call $client_rect_get_b (local.get $arg0)) (call $client_rect_get_t (local.get $arg0))))
    ;; A window DC may outlive the geometry it was acquired under. Visual
    ;; Basic picture boxes retain a DC while the control grows from its 1x1
    ;; creation fallback to its authored size, so rebuild USER-visible clips
    ;; after a real client-size transition.
    (local.set $cs (call $host_get_window_client_size (local.get $arg0)))
    (local.set $new_xy (call $window_xy_packed (local.get $arg0)))
    (if (i32.eq (local.get $old_xy) (local.get $new_xy))
      (then (local.set $flags (i32.or (local.get $flags) (i32.const 2)))))
    (if (i32.eq (local.get $old_cs) (local.get $cs))
      (then (local.set $flags (i32.or (local.get $flags) (i32.const 1)))))
    (if (i32.ne (local.get $cs) (local.get $old_cs))
      (then (call $gdi_refresh_window_dc_system_clips)))
    (call $windowpos_message_update
      (local.get $windowpos) (local.get $arg0) (local.get $insert_after)
      (local.get $x) (local.get $y) (local.get $cx) (local.get $cy)
      (local.get $flags))
    (if (i32.eqz (local.get $result_pos))
      (then
        (call $windowpos_message_end (local.get $windowpos) (local.get $arg0))
        (call $move_window_finish (local.get $arg0) (local.get $flags))
        (if (i32.eqz (i32.and (local.get $flags) (i32.const 8)))
          (then (call $update_window_now (local.get $arg0))))))
    (i32.const 1))

  (func $move_window_finish (param $arg0 i32) (param $flags i32)
    (local $dlg_rec i32) (local $repaint i32) (local $cs i32)
    (if (i32.lt_s (call $wnd_table_find (local.get $arg0)) (i32.const 0)) (then (return)))
    (local.set $repaint (i32.eqz (i32.and (local.get $flags) (i32.const 8))))
    (local.set $cs (call $host_get_window_client_size (local.get $arg0)))
    (local.set $dlg_rec (call $dlg_record_for_hwnd (local.get $arg0)))
    (call $windowpos_queue_ncpaint (local.get $arg0) (local.get $flags))
    (if (i32.and
          (i32.and
            (i32.ne (local.get $dlg_rec) (i32.const 0))
            (i32.ne (i32.load offset=4 (local.get $dlg_rec)) (i32.const 0)))
          (i32.lt_s (call $wnd_get_class_slot (local.get $arg0)) (i32.const 0)))
      (then
        (if (local.get $repaint)
          (then (drop (call $host_erase_background (local.get $arg0) (i32.const 16)))))))
    ;; If the main window is moved/resized before its first ShowWindow, refresh
    ;; the pending WM_SIZE that was seeded during CreateWindowExA. EmPipe does
    ;; exactly this; using the stale 0x0 create size moves its controls offscreen.
    (if (i32.eq (local.get $arg0) (global.get $main_hwnd))
    (then
	      (if (i32.eqz (i32.and (local.get $flags) (i32.const 1)))
	        (then
	          (global.set $pending_wm_size (local.get $cs))
	          (if (local.get $repaint)
	            (then (call $invalidate_hwnd (local.get $arg0)))))))
	    (else
	      (if (i32.eqz (i32.and (local.get $flags) (i32.const 1)))
	        (then
	          (if (local.get $repaint)
	            (then (call $invalidate_hwnd (local.get $arg0))))
              ;; A child that grew covers parent pixels it has never erased. It
              ;; owns no surface of its own, so whatever the parent left there
              ;; stays until something fills it -- Solitaire's score bar is
              ;; WHITE_BRUSH-classed and draws its text opaquely, so after the
              ;; main window widened, the widened part of the bar stayed the
              ;; grey the reallocated back-canvas came with. Queue the erase the
              ;; way USER's invalidate-on-resize does.
              (if (local.get $repaint)
                (then (call $nc_flags_set (local.get $arg0) (i32.const 2))))))))
    ;; The ABI caller performs UpdateWindow after this preparation: Win16
    ;; must enter a far callback instead of the Win32 synchronous sender.
  )

 123: CheckRadioButton(hDlg, firstId, lastId, checkId) — clear all in
  ;; [firstId,lastId] and set checkId. Pure WAT path now that ButtonState
  ;; bit 1 is the source of truth.
  (func $handle_CheckRadioButton (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $id i32) (local $ctrl i32)
    (local.set $id (local.get $arg1))
    (block $done (loop $scan
      (br_if $done (i32.gt_u (local.get $id) (local.get $arg2)))
      (local.set $ctrl (call $ctrl_find_by_id (local.get $arg0) (local.get $id)))
      (if (local.get $ctrl)
        (then
          ;; Drive the real BUTTON message path so ButtonState.flags,
          ;; CONTROL_TABLE fallback state, invalidation, and immediate repaint
          ;; stay in sync. Calc relies on CheckRadioButton after BN_CLICKED.
          (drop (call $wnd_send_message
            (local.get $ctrl)
            (i32.const 0x00F1) ;; BM_SETCHECK
            (select (i32.const 1) (i32.const 0)
              (i32.eq (local.get $id) (local.get $arg3)))
            (i32.const 0)))))
      (local.set $id (i32.add (local.get $id) (i32.const 1)))
      (br $scan)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))) (return)
  )

  ;; 124: CheckDlgButton — WAT-only; the _checkStates Map in host-imports
  ;; is gone, ButtonState.flags bit 1 is the source of truth.
  (func $handle_CheckDlgButton (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ctrl_hwnd i32)
    (local.set $ctrl_hwnd (call $ctrl_find_by_id (local.get $arg0) (local.get $arg1)))
    (if (local.get $ctrl_hwnd)
      (then (call $ctrl_set_check_state (local.get $ctrl_hwnd) (local.get $arg2))
            (call $host_invalidate (local.get $ctrl_hwnd))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))) (return)
  )

  ;; 125: CharNextA
  ;; CharNext{A,W}(lpsz) — advance one character, stopping on the terminator.
  ;; One character is one byte in ANSI and one UTF-16 code unit wide.
  (func $char_next (param $p i32) (param $wide i32) (result i32)
    (select
      (local.get $p)
      (i32.add (local.get $p) (select (i32.const 2) (i32.const 1) (local.get $wide)))
      (i32.eqz (call $gl_char (local.get $p) (local.get $wide)))))

  ;; CharPrev{A,W}(lpszStart, lpszCurrent) — step back one character, never
  ;; before the start of the string.
  (func $char_prev (param $start i32) (param $cur i32) (param $wide i32) (result i32)
    (select
      (local.get $start)
      (i32.sub (local.get $cur) (select (i32.const 2) (i32.const 1) (local.get $wide)))
      (i32.le_u (local.get $cur) (local.get $start))))

  (func $handle_CharNextA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $char_next (local.get $arg0) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))) (return)
  )

  ;; 126: CharPrevA
  (func $handle_CharPrevA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $char_prev (local.get $arg0) (local.get $arg1) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))) (return)
  )

  ;; 127: IsDialogMessageA(hDlg, lpMsg)
  ;;
  ;; The keyboard half of a dialog lives here, not in the control: a plain
  ;; edit control ignores VK_RETURN, and USER is what turns that keystroke
  ;; into the default command. Diablo's name-entry dialog is exactly that
  ;; shape -- DIABLOEDIT's WM_KEYDOWN handles only VK_LEFT, the OK button is
  ;; WS_DISABLED and ownerdrawn so it is not a default pushbutton either, and
  ;; the dialog procedure advances the game from WM_COMMAND id IDOK. Storm
  ;; calls IsDialogMessageA on every pump iteration; while this answered 0
  ;; unconditionally, Enter simply fell through to the edit and vanished.
  ;;
  ;; Only the two command keys are claimed. Everything else still answers 0,
  ;; so the caller goes on to TranslateMessage/DispatchMessage exactly as it
  ;; did before -- USER would have dispatched those same messages itself and
  ;; returned TRUE, and this way the app's own pump stays in charge of them.
  (func $handle_IsDialogMessageA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $target i32) (local $msg i32) (local $vk i32)
    (local $walk i32) (local $depth i32) (local $inside i32)
    (local $code i32) (local $def i32) (local $id i32) (local $btn i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))  ;; stdcall, 2 args
    (if (i32.or (i32.eqz (local.get $arg0)) (i32.eqz (local.get $arg1)))
      (then (return)))
    (local.set $target (call $gl32 (local.get $arg1)))
    (local.set $msg (call $gl32 (i32.add (local.get $arg1) (i32.const 4))))
    (local.set $vk (call $gl32 (i32.add (local.get $arg1) (i32.const 8))))
    ;; WM_KEYDOWN only, and only the keys USER itself claims: the two command
    ;; keys, Tab, and the four arrows. Everything else still falls through.
    (if (i32.ne (local.get $msg) (i32.const 0x0100)) (then (return)))
    (if (i32.eqz (i32.or
          (i32.or
            (i32.eq (local.get $vk) (i32.const 0x0D))
            (i32.eq (local.get $vk) (i32.const 0x1B)))
          (i32.or
            (i32.eq (local.get $vk) (i32.const 0x09))
            (i32.and (i32.ge_u (local.get $vk) (i32.const 0x25))
                     (i32.le_u (local.get $vk) (i32.const 0x28))))))
      (then (return)))
    ;; The message must belong to this dialog or one of its descendants.
    (local.set $inside (i32.eq (local.get $target) (local.get $arg0)))
    (local.set $walk (local.get $target))
    (local.set $depth (i32.const 0))
    (block $done_walk (loop $up
      (br_if $done_walk (local.get $inside))
      (local.set $walk (call $wnd_get_parent (local.get $walk)))
      (br_if $done_walk (i32.eqz (local.get $walk)))
      (local.set $inside (i32.eq (local.get $walk) (local.get $arg0)))
      (local.set $depth (i32.add (local.get $depth) (i32.const 1)))
      (br_if $done_walk (i32.ge_u (local.get $depth) (i32.const 32)))
      (br $up)))
    (if (i32.eqz (local.get $inside)) (then (return)))
    ;; A control that asks for every key keeps it (DLGC_WANTALLKEYS/MESSAGE).
    (local.set $code (call $wnd_send_message
      (local.get $target) (i32.const 0x0087)
      (local.get $vk) (local.get $arg1)))
    (if (i32.and (local.get $code) (i32.const 0x0004)) (then (return)))
    ;; Tab and the arrows move the focus, and a control that asked for them
    ;; (DLGC_WANTTAB / DLGC_WANTARROWS -- an edit or a listbox) keeps them.
    (if (i32.eq (local.get $vk) (i32.const 0x09))
      (then
        (if (i32.and (local.get $code) (i32.const 0x0002)) (then (return)))
        (local.set $btn (call $dialog_next_tabstop
          (local.get $arg0) (local.get $target)
          (select (i32.const -1) (i32.const 1)
            (i32.and (call $host_get_key_down_state (i32.const 0x10))
                     (i32.const 0x8000)))))
        (if (local.get $btn) (then (call $set_focus (local.get $btn))))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))
        (return)))
    (if (i32.and (i32.ge_u (local.get $vk) (i32.const 0x25))
                 (i32.le_u (local.get $vk) (i32.const 0x28)))
      (then
        (if (i32.and (local.get $code) (i32.const 0x0001)) (then (return)))
        ;; VK_LEFT (0x25) and VK_UP (0x26) go back; VK_RIGHT/VK_DOWN forward.
        (local.set $btn (call $dialog_next_group_item
          (local.get $arg0) (local.get $target)
          (select (i32.const -1) (i32.const 1)
            (i32.le_u (local.get $vk) (i32.const 0x26)))))
        (if (i32.and
              (i32.ne (local.get $btn) (i32.const 0))
              (i32.ne (local.get $btn) (local.get $target)))
          (then (call $set_focus (local.get $btn))))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))
        (return)))
    (if (i32.eq (local.get $vk) (i32.const 0x1B))
      (then
        (drop (call $wnd_send_message
          (local.get $arg0) (i32.const 0x0111) (i32.const 2)
          (call $ctrl_find_by_id (local.get $arg0) (i32.const 2))))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))
        (return)))
    ;; VK_RETURN on a focused pushbutton fires that button, not the dialog's
    ;; default -- USER makes the focused button the default for as long as it
    ;; holds the focus. Diablo's menus are exactly this shape: five ownerdrawn
    ;; Buttons and no default id, so without this the arrow keys moved the
    ;; highlight and Enter still launched the first item.
    (if (i32.and
          (i32.ne (local.get $target) (local.get $arg0))
          (i32.eq (call $ctrl_table_get_class (local.get $target)) (i32.const 1)))
      (then
        (if (i32.eqz (i32.and (call $wnd_get_style (local.get $target))
                              (i32.const 0x08000000)))  ;; !WS_DISABLED
          (then
            (drop (call $wnd_send_message
              (local.get $arg0) (i32.const 0x0111)
              (call $ctrl_table_get_id (local.get $target)) (local.get $target)))
            (i32.store offset=0 (global.get $reg_base) (i32.const 1))
            (return)))))
    ;; VK_RETURN: the dialog's own default id when it claims one, IDOK when
    ;; it does not. A default button that exists but is disabled swallows the
    ;; key rather than firing -- an absent one does not.
    (local.set $def (call $wnd_send_message
      (local.get $arg0) (i32.const 0x0400) (i32.const 0) (i32.const 0)))  ;; DM_GETDEFID
    (if (i32.eq (i32.shr_u (local.get $def) (i32.const 16)) (i32.const 0x554B))
      (then
        (local.set $id (i32.and (local.get $def) (i32.const 0xFFFF)))
        (local.set $btn (call $ctrl_find_by_id (local.get $arg0) (local.get $id)))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))
        (if (i32.eqz (local.get $btn)) (then (return)))
        (if (i32.and (call $wnd_get_style (local.get $btn)) (i32.const 0x08000000))
          (then (return)))
        (drop (call $wnd_send_message
          (local.get $arg0) (i32.const 0x0111) (local.get $id) (local.get $btn)))
        (return)))
    (drop (call $wnd_send_message
      (local.get $arg0) (i32.const 0x0111) (i32.const 1)
      (call $ctrl_find_by_id (local.get $arg0) (i32.const 1))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
  )

  ;; 128: IsIconic(hwnd) → BOOL — is the window minimized?
  ;; This answered 0 unconditionally while ShowWindow(SW_MINIMIZE) and
  ;; SC_MINIMIZE were both plainly reaching the renderer, so an app that
  ;; minimizes itself and then asks — the ordinary shape of a WM_SIZE or
  ;; WM_PAINT guard, and of "restore me before showing a dialog" — was told no.
  (func $handle_IsIconic (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $wnd_min_get (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 129: ChildWindowFromPoint(hWndParent, POINT). POINT is passed by value.
  ;; The shared USER query core searches immediate children in Z order and,
  ;; unlike the input router, includes hidden, disabled, and transparent ones.
  (func $handle_ChildWindowFromPoint (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $wnd_child_from_point_immediate
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; ChildWindowFromPointEx(hWndParent, POINT, flags). POINT consumes two stack
  ;; dwords in the 32-bit ABI; flags is the fourth argument dword.
  (func $handle_ChildWindowFromPointEx (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $wnd_child_from_point_immediate
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; 130: ScreenToClient
  (func $handle_ScreenToClient (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $pt i32) (local $ox i32) (local $oy i32)
    (local.set $pt (call $g2w (local.get $arg1)))
    (local.set $ox (call $wnd_client_screen_x (local.get $arg0)))
    (local.set $oy (call $wnd_client_screen_y (local.get $arg0)))
    (store.field Point x (local.get $pt)
      (i32.sub (load.field Point x (local.get $pt)) (local.get $ox)))
    (store.field.memarg Point y (local.get $pt)
      (i32.sub (load.field.memarg Point y (local.get $pt)) (local.get $oy)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))) (return)
  )

;; 132: WinHelpA(hwnd, lpszHelp, uCommand, dwData) — unified WAT dispatcher
  (func $handle_WinHelpA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $accepted i32)
    (local.set $accepted (call $help_dispatch_api_a
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)))
    (call $help_present_dispatch (local.get $accepted) (local.get $arg2))
    (i32.store offset=0 (global.get $reg_base) (local.get $accepted))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; 133: IsChild
  (func $handle_IsChild (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $wnd_is_child (local.get $arg0) (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))) (return)
  )

  ;; 134: GetSysColorBrush(nIndex) — 1 arg stdcall
  (func $handle_GetSysColorBrush (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $gdi_native_create_solid_brush (call $win98_sys_color (local.get $arg0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 135: GetSysColor
  (func $handle_GetSysColor (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $win98_sys_color (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))) (return)
  )

  ;; SetSysColors(cElements, lpaElements, lpaRgbValues) — take the caller's
  ;; palette for the rest of the session. Both arrays are cElements long: the
  ;; first holds COLOR_ indices, the second the COLORREF for each. The write is
  ;; what matters, because the program that does this is about to paint its own
  ;; chrome and then read the values straight back out of GetSysColor.
  ;;
  ;; Windows also broadcasts WM_SYSCOLORCHANGE to every top-level window. We do
  ;; not, so a window already on screen keeps the pixels it drew with the old
  ;; palette until something else invalidates it; nothing repaints on its own.
  (func $handle_SetSysColors (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $i i32)
    (if (i32.and (i32.ne (local.get $arg1) (i32.const 0))
                 (i32.ne (local.get $arg2) (i32.const 0)))
      (then
        (block $done
          (loop $each
            (br_if $done (i32.ge_s (local.get $i) (local.get $arg0)))
            (call $win98_set_sys_color
              (call $gl32 (i32.add (local.get $arg1) (i32.shl (local.get $i) (i32.const 2))))
              (call $gl32 (i32.add (local.get $arg2) (i32.shl (local.get $i) (i32.const 2)))))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $each)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 136: DialogBoxParamA(hInstance, lpTemplate, hWndParent, lpDialogFunc, dwInitParam)
  ;; DialogBoxParamA(hInstance, lpTemplateName, hWndParent, lpDialogFunc, dwInitParam)
  ;; Creates modal dialog, sends WM_INITDIALOG, enters message loop, returns EndDialog result
  ;; Make a modal dialog visible: the WS_VISIBLE bit and the host window.
  (func $dlg_show_now (param $hwnd i32)
    (global.set $dlg_show_pending (i32.const 0))
    (if (i32.eqz (call $wnd_table_get (local.get $hwnd))) (then (return)))
    (drop (call $wnd_set_style (local.get $hwnd)
      (i32.or (call $wnd_get_style (local.get $hwnd)) (i32.const 0x10000000))))
    (drop (call $host_show_window (local.get $hwnd) (i32.const 1))))

  (func $handle_DialogBoxParamA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $hwnd i32) (local $init_param i32)
    (local $dlg_rec i32) (local $ctrl_count i32) (local $i i32) (local $ctrl_hwnd i32)
    (local $tmpl_visible i32)
    ;; arg0=hInstance, arg1=lpTemplateName (resource ID), arg2=hWndParent
    ;; arg3=lpDialogFunc, arg4=dwInitParam. Five stdcall args live at
    ;; [esp+4]..[esp+20]; [esp+24] is already the caller's own frame, so
    ;; reading it handed WM_INITDIALOG a garbage lParam (usually 0).
    ;; HyperTerminal's "Connect To" DlgProc stores that lParam in its
    ;; per-dialog block and then asserts it non-NULL — a 0 there took the
    ;; app straight to ExitProcess(1).
    (local.set $init_param (local.get $arg4))
    ;; Keep the previous modal pump in this call's consumed argument frame.
    ;; The initial DLGPROC frame is placed below it, and CACA0004 restores
    ;; these words when this DialogBox returns. Nested modal dialogs therefore
    ;; compose on the guest stack instead of overwriting one global pump.
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))
      (global.get $dlg_pump_hwnd))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))
      (global.get $dlg_proc))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))
      (global.get $dlg_ret_addr))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))
      (global.get $dlg_callback_yield_pending))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))
      (global.get $dlg_init_focus_hwnd))
    ;; Allocate HWND
    (local.set $hwnd (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    ;; Set as dialog hwnd (and dedicated modal-pump hwnd so nested
    ;; CreateDialogParamA can't hijack the pump's hwnd-less fallback)
    (global.set $dlg_hwnd (local.get $hwnd))
    (global.set $dlg_pump_hwnd (local.get $hwnd))
    (i32.store (global.get $SHARED_DLG_PUMP_HWND) (local.get $hwnd))
    (global.set $dlg_ended (i32.const 0))
    (global.set $dlg_result (i32.const 0))
    (i32.store (global.get $SHARED_DLG_ENDED) (i32.const 0))
    (i32.store (global.get $SHARED_DLG_RESULT) (i32.const 0))
    (global.set $dlg_proc (local.get $arg3))
    ;; USER keeps the DLGPROC separate from the dialog window's DefDlgProc
    ;; WNDPROC. This is observable when a framework subclasses the dialog and
    ;; chains to the saved previous procedure.
    (call $wnd_table_set (local.get $hwnd) (global.get $WNDPROC_DIALOG))
    (drop (call $dialog_proc_set (local.get $hwnd) (local.get $arg3)))
    ;; Parse the RT_DIALOG template fully in WAT — allocates child hwnds,
    ;; fills CONTROL_TABLE + CONTROL_GEOM, sends WM_CREATE, stores header
    ;; state in WND_DLG_RECORDS[slot]. Handles int IDs and guest string
    ;; pointers (named entries) via $find_resource. Route resource lookup
    ;; through hInstance so templates in a satellite DLL resolve.
    (call $push_rsrc_ctx (local.get $arg0))
    (drop (call $dlg_load (local.get $hwnd) (local.get $arg1)))
    (call $pop_rsrc_ctx)
    ;; DialogBoxParam creates a top-level owned dialog, hidden: USER strips
    ;; WS_VISIBLE from a modal template and shows the window only once
    ;; WM_INITDIALOG has returned (see $dlg_show_pending in CACA0004). An init
    ;; that does real work would otherwise sit on screen half-built -- SimCity
    ;; 2000's Select Power Plant box showed as an empty grey frame at (0,0)
    ;; for ~1,900 batches while it built its eight plant pictures.
    (call $wnd_set_parent (local.get $hwnd) (i32.const 0))
    (call $wnd_set_owner (local.get $hwnd) (local.get $arg2))
    (local.set $tmpl_visible
      (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x10000000)))
    (drop (call $wnd_set_style (local.get $hwnd)
      (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0xEFFFFFFF)))) (call $wnd_note_active_popup (local.get $hwnd))
    ;; Tell the renderer the dialog has been loaded; JS reads geom /
    ;; style / controls from the dlg_* / ctrl_* exports.
    (call $host_dialog_loaded (local.get $hwnd) (local.get $arg2))
    ;; The renderer takes the mirror's visibility from the template, which for
    ;; a modal dialog is the one bit USER does not honour yet.
    (if (local.get $tmpl_visible)
      (then (drop (call $host_show_window (local.get $hwnd) (i32.const 0)))))
    ;; USER's dialog manager places the frame relative to the owner's client
    ;; area (DS_ABSALIGN opts out) and centres a DS_CENTER template. The host
    ;; has mirrored the window by now, so this measures both rects and moves.
    (call $dlg_place_owner_relative (local.get $hwnd))
    ;; Populate WAT CLIENT_RECT from the same frame metrics the renderer
    ;; uses so ScreenToClient/MapWindowPoints subtract the real client origin.
    (call $defwndproc_do_nccalcsize (local.get $hwnd))
    ;; Fill dialog client area with COLOR_BTNFACE — template DlgProcs
    ;; typically don't handle WM_PAINT, expecting DefDlgProc to erase,
    ;; but our modal pump doesn't fall through to DefWindowProc on a
    ;; FALSE return from WM_PAINT. Without this, the back-canvas stays
    ;; transparent/teal between control bodies.
    (call $dlg_fill_bkgnd (local.get $hwnd))
    ;; Seed WM_NCPAINT so the modal pump delivers chrome paint to the
    ;; dialog's wndproc → DefDlgProc/DefWindowProc → back-canvas chrome.
    ;; Without this, modal dialogs stay chrome-less in the PNG.
    (call $nc_flags_set (local.get $hwnd) (i32.const 1))
    ;; Enqueue WM_PAINT for each child control. Mirrors CreateDialogParamA;
    ;; otherwise buttons/edits/statics never get their first WM_PAINT while
    ;; the modal pump runs. Walk via $wnd_next_child_slot rather than
    ;; assuming contiguous hwnd allocation — combobox WM_CREATE may
    ;; allocate auxiliary windows (inner listbox, WS_POPUP shell) that
    ;; punch holes in the dlg_hwnd+1..dlg_hwnd+ctrl_count range.
    (local.set $i (i32.const 0))
    (block $done (loop $push_loop
      (local.set $i (call $wnd_next_child_slot (local.get $hwnd) (local.get $i)))
      (br_if $done (i32.eq (local.get $i) (i32.const -1)))
      (local.set $ctrl_hwnd (call $wnd_slot_hwnd (local.get $i)))
      (if (i32.and (call $wnd_get_style (local.get $ctrl_hwnd)) (i32.const 0x10000000))
        (then (call $paint_flag_set_inv (local.get $ctrl_hwnd))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $push_loop)))
    ;; The dialog's own client area needs a WM_PAINT too. A template DlgProc
    ;; that ignores it costs nothing — $dlg_fill_bkgnd already painted the
    ;; COLOR_BTNFACE and the pump's take clears the flag, so there is no
    ;; repaint loop — but an app that draws its client itself never sees a
    ;; single paint otherwise. Welcome to Windows 98 is exactly that shape:
    ;; every visible element (banner bitmap, the seven menu rows, the body
    ;; text) is drawn by its DLGPROC over invisible SS_SUNKEN statics that
    ;; exist only as geometry anchors, so the dialog rendered as an empty
    ;; grey box with nothing but the Close button.
    (call $paint_flag_set_inv (local.get $hwnd))
    ;; Do not synchronously paint children during DialogBoxParamA creation.
    ;; The modal pump below drains seeded WAT-native paints after the dialog
    ;; is visible and its USER-style visible region is stable.
    ;; Shown after WM_INITDIALOG. A dialog opened from another's init takes
    ;; the slot; show the outer one now rather than leave it hidden for good.
    (if (global.get $dlg_show_pending)
      (then (call $dlg_show_now (global.get $dlg_show_pending))))
    (global.set $dlg_show_pending (local.get $hwnd))
    ;; Save return address — we'll restore it when EndDialog is called
    (global.set $dlg_ret_addr (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    ;; Apply the five-argument stdcall cleanup explicitly. The callback frame
    ;; below reaches back across these 24 bytes so the consumed API frame stays
    ;; beneath it as nested-pump storage.
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
    ;; Determine the control USER passes in WM_INITDIALOG.wParam before the
    ;; callback runs. A TRUE callback return applies this default afterward;
    ;; FALSE means the application assigned focus itself.
    (local.set $ctrl_hwnd (call $dialog_first_init_tabstop (local.get $hwnd)))
    ;; Set up call to dialog proc: DlgProc(hwnd, WM_INITDIALOG, ctrl, init).
    ;; Return to dialog loop thunk which pumps messages until EndDialog. Keep
    ;; this API frame in place until then: its consumed args hold the previous
    ;; pump state, and CACA0004 pops all 24 bytes after restoring them.
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 44)))  ;; API frame + 4 args + ret
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $dlg_loop_thunk))  ;; ret → dialog message loop
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)) (local.get $hwnd))          ;; hDlg
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)) (i32.const 0x0110))         ;; WM_INITDIALOG
    (global.set $dlg_init_focus_hwnd (local.get $ctrl_hwnd))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)) (global.get $dlg_init_focus_hwnd)) ;; wParam (focus hwnd)
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)) (local.get $init_param))   ;; lParam
    ;; Fire WH_CBT/HCBT_CREATEWND before WM_INITDIALOG, exactly as the modeless
    ;; $handle_CreateDialogParamA path does. MFC's modal creation installs a CBT
    ;; hook and attaches the freshly created HWND to the CDialog object from it,
    ;; so a modal dialog that never sees the hook leaves CWnd::FromHandlePermanent
    ;; returning NULL. AfxDlgProc does not check: it calls pWnd->WindowProc
    ;; through the object's vtable, which is a call through address 0. SimCity
    ;; 2000's demo died on its first DialogBoxParamA that way.
    ;;
    ;; The WM_INITDIALOG frame built above stays where it is; the hook frame goes
    ;; on top of it, and CACA0028's "CBTM" branch pops the three private words
    ;; and jumps to the DLGPROC with that frame already in place.
    (if (global.get $cbt_hook_proc)
      (then
        (local.set $dlg_rec (call $dlg_record_for_hwnd (local.get $hwnd)))
        ;; CREATESTRUCT at image_base+0x100, CBT_CREATEWND at image_base+0x140.
        (call $gs32 (i32.add (global.get $image_base) (i32.const 0x100)) (local.get $init_param)) ;; lpCreateParams
        (call $gs32 (i32.add (global.get $image_base) (i32.const 0x104)) (local.get $arg0))      ;; hInstance
        (call $gs32 (i32.add (global.get $image_base) (i32.const 0x108)) (i32.const 0))          ;; hMenu
        (call $gs32 (i32.add (global.get $image_base) (i32.const 0x10c)) (local.get $arg2))      ;; hwndParent
        (call $gs32 (i32.add (global.get $image_base) (i32.const 0x110))
          (select (i32.load16_s (i32.add (local.get $dlg_rec) (i32.const 18))) (i32.const 0) (local.get $dlg_rec)))
        (call $gs32 (i32.add (global.get $image_base) (i32.const 0x114))
          (select (i32.load16_s (i32.add (local.get $dlg_rec) (i32.const 16))) (i32.const 0) (local.get $dlg_rec)))
        (call $gs32 (i32.add (global.get $image_base) (i32.const 0x118))
          (select (i32.load16_s (i32.add (local.get $dlg_rec) (i32.const 14))) (i32.const 0) (local.get $dlg_rec)))
        (call $gs32 (i32.add (global.get $image_base) (i32.const 0x11c))
          (select (i32.load16_s (i32.add (local.get $dlg_rec) (i32.const 12))) (i32.const 0) (local.get $dlg_rec)))
        (call $gs32 (i32.add (global.get $image_base) (i32.const 0x120)) (call $wnd_get_style (local.get $hwnd)))
        (call $gs32 (i32.add (global.get $image_base) (i32.const 0x124))
          (select (i32.load (i32.add (local.get $dlg_rec) (i32.const 20))) (i32.const 0) (local.get $dlg_rec)))
        (call $gs32 (i32.add (global.get $image_base) (i32.const 0x128)) (i32.const 0))          ;; lpszClass
        (call $gs32 (i32.add (global.get $image_base) (i32.const 0x12c))
          (select (i32.load (i32.add (local.get $dlg_rec) (i32.const 8))) (i32.const 0) (local.get $dlg_rec)))
        (call $gs32 (i32.add (global.get $image_base) (i32.const 0x140)) (i32.add (global.get $image_base) (i32.const 0x100)))
        (call $gs32 (i32.add (global.get $image_base) (i32.const 0x144)) (i32.const 0))
        ;; Private words under the hook's own stdcall frame: the DLGPROC to
        ;; resume into, the outer hook-dispatch node, and the marker that tells
        ;; CACA0028 this was the modal path. Keeping the DLGPROC on the stack
        ;; instead of in a global is what makes a dialog created from inside
        ;; another dialog's hook safe.
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $arg3))
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $hook_active_node))
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0x4D544243)) ;; "CBTM"
        ;; CBTProc(nCode=HCBT_CREATEWND, wParam=hwnd, lParam=&CBT_CREATEWND)
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.add (global.get $image_base) (i32.const 0x140)))
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $hwnd))
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 3))
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $dialog_cbt_ret_thunk))
        (i32.store offset=0 (global.get $reg_base) (local.get $hwnd))
        (global.set $eip (call $hook_dispatch_enter (i32.const 5)))
        (global.set $dlg_callback_yield_pending (i32.const 1))
        (global.set $yield_flag (i32.const 1))
        (global.set $steps (i32.const 0))
        (return)))
    ;; Set EIP to dialog proc and signal redirection (don't let caller override EIP)
    (global.set $eip (local.get $arg3))
    ;; Let the host observe/show the modal shell before WM_INITDIALOG starts,
    ;; then yield once more when that guest callback returns to CACA0004.
    (global.set $dlg_callback_yield_pending (i32.const 1))
    (global.set $yield_flag (i32.const 1))
    (global.set $steps (i32.const 0))
  )

  ;; DialogBoxParamW — same as A. Template names, if strings, are UTF-16,
  ;; but $find_resource only matches integer IDs and ASCII strings, so
  ;; UTF-16 string templates fall to the int branch either way (like
  ;; CreateDialogParamW). Winmine's Custom dialog uses int IDs (0x5A).
  (func $handle_DialogBoxParamW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $hwnd i32)
    (local.set $hwnd (global.get $next_hwnd))
    (call $handle_DialogBoxParamA (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
    (call $wnd_unicode_set (local.get $hwnd) (i32.const 1))
  )

  ;; DialogBoxIndirectParamA uses the same modal creation/pump as
  ;; DialogBoxParamA, but arg1 already points at a DLGTEMPLATE rather than an
  ;; RT_DIALOG resource name. $dlg_load consumes and clears this one-shot.
  (func $handle_DialogBoxIndirectParamA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $dlg_indirect_template_ptr (local.get $arg1))
    (call $handle_DialogBoxParamA
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

;; 142: DrawTextA(hdc, lpString, nCount, lpRect, uFormat)
  (func $handle_DrawTextA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $gdi_native_draw_text
      (local.get $arg0)
      (call $g2w (local.get $arg1))
      (local.get $arg2)
      (call $g2w (local.get $arg3))
      (local.get $arg4)
      (i32.const 0) ;; isWide = 0
    ))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))  ;; stdcall, 5 args
  )

  ;; DrawTextEx applies DRAWTEXTPARAMS around the common DrawText backend.
  ;; Margins are logical rectangle units; the tab length is an average-cell
  ;; count consumed directly by the WAT bitmap layout without overlapping the
  ;; legacy DrawText DT_TABSTOP bits.
  (func $draw_text_ex (param $hdc i32) (param $text_guest i32) (param $count i32)
        (param $rect_guest i32) (param $format i32) (param $params_guest i32)
        (param $wide i32) (result i32)
    (local $text i32) (local $rect i32) (local $params i32) (local $valid i32)
    (local $left i32) (local $top i32) (local $right i32) (local $bottom i32)
    (local $left_margin i32) (local $right_margin i32) (local $tab_chars i32)
    (local $result i32) (local $drawn i32) (local $calculated_right i32)
    (local.set $text (call $g2w (local.get $text_guest)))
    (local.set $rect (call $g2w (local.get $rect_guest)))
    (if (local.get $params_guest)
      (then
        (local.set $params (call $g2w (local.get $params_guest)))
        (local.set $valid (i32.ge_u (i32.load (local.get $params)) (i32.const 20)))))
    (if (i32.and (local.get $valid) (i32.ne (local.get $rect_guest) (i32.const 0)))
      (then
        (local.set $left (load.field Rect left (local.get $rect)))
        (local.set $top (load.field.memarg Rect top (local.get $rect)))
        (local.set $right (load.field.memarg Rect right (local.get $rect)))
        (local.set $bottom (load.field.memarg Rect bottom (local.get $rect)))
        (local.set $left_margin (i32.load offset=8 (local.get $params)))
        (local.set $right_margin (i32.load offset=12 (local.get $params)))
        (store.field Rect left (local.get $rect) (i32.add (local.get $left) (local.get $left_margin)))
        (store.field.memarg Rect right (local.get $rect)
          (i32.sub (local.get $right) (local.get $right_margin)))))
    (if (i32.and (local.get $valid)
          (i32.ne (i32.and (local.get $format) (i32.const 0x40)) (i32.const 0)))
      (then
        (local.set $tab_chars (i32.load offset=4 (local.get $params)))
        (if (i32.lt_s (local.get $tab_chars) (i32.const 0))
          (then (local.set $tab_chars (i32.const 0))))
        (if (i32.gt_s (local.get $tab_chars) (i32.const 255))
          (then (local.set $tab_chars (i32.const 255))))))
    (global.set $gdi_bitmap_draw_text_tab_chars (local.get $tab_chars))
    (local.set $result (call $gdi_native_draw_text
      (local.get $hdc) (local.get $text) (local.get $count) (local.get $rect)
      (local.get $format) (local.get $wide)))
    (global.set $gdi_bitmap_draw_text_tab_chars (i32.const 0))
    (if (local.get $valid)
      (then
        (local.set $drawn (local.get $count))
        (if (i32.eq (local.get $drawn) (i32.const -1))
          (then (local.set $drawn
            (if (result i32) (local.get $wide)
              (then (call $strlen_w (local.get $text)))
              (else (call $strlen_a (local.get $text)))))))
        (if (i32.lt_s (local.get $drawn) (i32.const 0))
          (then (local.set $drawn (i32.const 0))))
        (i32.store offset=16 (local.get $params) (local.get $drawn))))
    (if (i32.and (local.get $valid) (i32.ne (local.get $rect_guest) (i32.const 0)))
      (then
        (if (i32.ne (i32.and (local.get $format) (i32.const 0x400)) (i32.const 0))
          (then
            (local.set $calculated_right (load.field.memarg Rect right (local.get $rect)))
            (store.field Rect left (local.get $rect) (local.get $left))
            (store.field.memarg Rect top (local.get $rect) (local.get $top))
            (store.field.memarg Rect right (local.get $rect)
              (i32.add (local.get $calculated_right) (local.get $right_margin))))
          (else
            (store.field Rect left (local.get $rect) (local.get $left))
            (store.field.memarg Rect top (local.get $rect) (local.get $top))
            (store.field.memarg Rect right (local.get $rect) (local.get $right))
            (store.field.memarg Rect bottom (local.get $rect) (local.get $bottom))))))
    (local.get $result))

  ;; DrawTextExA(hdc, lpString, nCount, lpRect, uFormat, lpDTParams)
  (func $handle_DrawTextExA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $draw_text_ex
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4)
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
      (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))  ;; stdcall, 6 args
  )

  ;; DrawEdge(hdc, qrc, edge, grfFlags) — 4 args stdcall
  (func $handle_DrawEdge (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $rc i32) (local $desc i32)
    (local.set $rc (call $g2w (local.get $arg1)))
    (local.set $desc (global.get $GDI_LINE_DESC))
    (if (call $gdi_surface_descriptor (local.get $arg0) (local.get $desc))
      (then (i32.store offset=0 (global.get $reg_base) (call $gdi_draw_edge_desc
        (local.get $arg0) (local.get $desc)
        (load.field Rect left (local.get $rc)) (load.field.memarg Rect top (local.get $rc))
        (load.field.memarg Rect right (local.get $rc)) (load.field.memarg Rect bottom (local.get $rc))
        (local.get $arg2) (local.get $arg3) (local.get $rc))))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; 144: GetClipboardData(uFormat) → HANDLE
  ;; CF_TEXT/CF_OEMTEXT plus registered non-OLE Rich Text Format clipboard
  ;; data. Handles are direct heap pointers, matching the emulator's GlobalLock
  ;; identity behavior.
  (func $handle_GetClipboardData (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (drop (local.get $arg1))
    (drop (local.get $arg2))
    (drop (local.get $arg3))
    (drop (local.get $arg4))
    (drop (local.get $name_ptr))
    (if (i32.eqz (global.get $clipboard_open))
      (then
        (global.set $last_error (i32.const 1418)) ;; ERROR_CLIPBOARD_NOT_OPEN
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (i32.store offset=0 (global.get $reg_base) (call $clipboard_get_data_handle (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )


  ;; 187: KillTimer(hwnd, nIDEvent) — clear the timer
  (func $handle_KillTimer (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $timer_kill (local.get $arg0) (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 188: SetTimer
  (func $timer_next_auto_id (result i32)
    (i32.add (i32.const 0x1001)
      (i32.atomic.rmw.add offset=4 (global.get $TIMER_SHARED) (i32.const 1))))

  (func $handle_SetTimer (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $tid i32)
    (local.set $tid (local.get $arg1))
    ;; Only thread timers need an auto-generated ID. A window timer retains
    ;; the caller's ID verbatim, including zero, because WM_TIMER and
    ;; KillTimer identify it with that same value.
    (if (i32.and (i32.eqz (local.get $arg0)) (i32.eqz (local.get $tid)))
      (then
        (local.set $tid (call $timer_next_auto_id))))
    (call $timer_set (local.get $arg0) (local.get $tid) (local.get $arg2) (local.get $arg3))
    ;; Window-timer success is boolean; do not turn an ID-zero timer into an
    ;; apparent failure even though its delivered/stored ID stays zero.
    (i32.store offset=0 (global.get $reg_base) (select (i32.const 1) (local.get $tid)
        (i32.and (i32.ne (local.get $arg0) (i32.const 0)) (i32.eqz (local.get $tid)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))) (return)
  )

  ;; 189: FindWindowA(lpClassName, lpWindowName). USER searches only top-level
  ;; windows and compares both optional filters case-insensitively.
  (func $handle_FindWindowA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $find_window_core
      (i32.const 0) (i32.const 0) (local.get $arg0) (local.get $arg1)
      (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))  ;; stdcall, 2 args
  )

  ;; 915: SearchPathA(lpPath, lpFileName, lpExtension, nBufLen, lpBuffer, lpFilePart) — 6 args stdcall
  ;; SearchPath{A,W}(lpPath, lpFileName, lpExtension, nBufLen, lpBuffer, lpFilePart).
  ;; The host walks the VFS the same way for both spellings; $wide only decides
  ;; how it reads the three input strings and writes the result back.
  (func $search_path (param $path_g i32) (param $file_g i32) (param $ext_g i32)
                     (param $buflen i32) (param $buf_g i32) (param $part_g i32)
                     (param $wide i32) (result i32)
    (call $host_fs_search_path
      (select (i32.const 0) (call $g2w (local.get $path_g)) (i32.eqz (local.get $path_g)))
      (select (i32.const 0) (call $g2w (local.get $file_g)) (i32.eqz (local.get $file_g)))
      (select (i32.const 0) (call $g2w (local.get $ext_g)) (i32.eqz (local.get $ext_g)))
      (local.get $buflen)
      (local.get $buf_g)       ;; guest addr, host g2w's
      (local.get $part_g)      ;; filePartPtrGA
      (local.get $wide)))

  (func $handle_SearchPathA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; 6th arg (lpFilePart) lives at esp+24 (skip ret addr + 5 visible args)
    (i32.store offset=0 (global.get $reg_base) (call $search_path
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4)
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
      (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))  ;; stdcall, 6 args
  )

  ;; DllUnregisterServer is implemented by each self-registering server: only
  ;; that module knows which registry entries it owns. A generic success would
  ;; claim those persistent side effects happened when none did. Delegate the
  ;; shared absence to the canonical self-registration failure path.
  (func $handle_DllUnregisterServer (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_DllRegisterServer
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; DllRegisterServer: no generic registration implementation. A native DLL's
  ;; own export must perform its registration; never fabricate that success.
  (func $handle_DllRegisterServer (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  ;; One candidate against FindWindowEx's two filters. Either guest pointer
  ;; may be 0, which means "any". A class is matched through the class table
  ;; rather than by string, so the MAKEINTATOM form of a class key selects the
  ;; same record its name does; a title is compared case-insensitively against
  ;; the window's stored text, the way USER's own comparison does.
  (func $find_window_matches (param $hwnd i32) (param $class_g i32)
                             (param $title_g i32) (param $wide i32) (result i32)
    (local $slot i32) (local $title_wa i32)
    (if (local.get $class_g)
      (then
        (local.set $slot (call $class_find_slot
          (if (result i32) (local.get $wide)
            (then (call $class_wide_name_key (local.get $class_g)))
            (else (call $class_name_key (local.get $class_g))))))
        (if (i32.lt_s (local.get $slot) (i32.const 0)) (then (return (i32.const 0))))
        (if (i32.ne (local.get $slot) (call $wnd_get_class_slot (local.get $hwnd)))
          (then (return (i32.const 0))))))
    (if (local.get $title_g)
      (then
        (local.set $title_wa (call $title_table_get_ptr (local.get $hwnd)))
        (if (i32.eqz (local.get $title_wa)) (then (return (i32.const 0))))
        (if (i32.eqz
              (if (result i32) (local.get $wide)
                (then (call $wide_ascii_eq
                  (call $g2w (local.get $title_g)) (local.get $title_wa)))
                (else (call $guest_ansi_eq_wasm_ci
                  (local.get $title_g) (local.get $title_wa)))))
          (then (return (i32.const 0))))))
    (i32.const 1))

  ;; Highest sibling in USER's WAT-owned Z order. parent=0 selects top-level
  ;; records, the WAT equivalent of treating the desktop as their parent.
  (func $find_window_z_first (param $parent i32) (result i32)
    (local $i i32) (local $hwnd i32) (local $rank i32)
    (local $best i32) (local $best_rank i32)
    (local.set $i (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $MAX_WINDOWS)))
      (local.set $hwnd (call $wnd_slot_hwnd (local.get $i)))
      (if (i32.and
            (i32.ne (local.get $hwnd) (i32.const 0))
            (i32.eq (call $wnd_get_parent (local.get $hwnd)) (local.get $parent)))
        (then
          (local.set $rank (call $wnd_z_get (local.get $hwnd)))
          (if (i32.or
                (i32.eqz (local.get $best))
                (i32.gt_s (local.get $rank) (local.get $best_rank)))
            (then
              (local.set $best (local.get $hwnd))
              (local.set $best_rank (local.get $rank))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (local.get $best))

  ;; Highest sibling below hwndChildAfter. SetWindowPos owns the rank updates,
  ;; so this follows live Z-order mutations instead of window allocation slots.
  (func $find_window_z_next (param $parent i32) (param $after i32) (result i32)
    (local $i i32) (local $hwnd i32) (local $rank i32)
    (local $after_rank i32) (local $best i32) (local $best_rank i32)
    (local.set $after_rank (call $wnd_z_get (local.get $after)))
    (local.set $i (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $MAX_WINDOWS)))
      (local.set $hwnd (call $wnd_slot_hwnd (local.get $i)))
      (if (i32.and
            (i32.ne (local.get $hwnd) (i32.const 0))
            (i32.eq (call $wnd_get_parent (local.get $hwnd)) (local.get $parent)))
        (then
          (local.set $rank (call $wnd_z_get (local.get $hwnd)))
          (if (i32.and
                (i32.lt_s (local.get $rank) (local.get $after_rank))
                (i32.or
                  (i32.eqz (local.get $best))
                  (i32.gt_s (local.get $rank) (local.get $best_rank))))
            (then
              (local.set $best (local.get $hwnd))
              (local.set $best_rank (local.get $rank))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (local.get $best))

  ;; Shared FindWindow/FindWindowEx walk. A non-null hwndChildAfter must be a
  ;; live direct child of the requested parent; accepting an unrelated window
  ;; would silently continue in the wrong tree. Candidates are visited from
  ;; top to bottom in the same sibling Z order SetWindowPos mutates.
  (func $find_window_core (param $parent i32) (param $after i32)
                          (param $class_g i32) (param $title_g i32)
                          (param $wide i32) (result i32)
    (local $cur i32)
    (if (local.get $after)
      (then
        (if (i32.or
              (i32.eq (call $wnd_table_find (local.get $after)) (i32.const -1))
              (i32.ne (call $wnd_get_parent (local.get $after)) (local.get $parent)))
          (then (return (i32.const 0))))
        (local.set $cur
          (call $find_window_z_next (local.get $parent) (local.get $after))))
      (else
        (local.set $cur (call $find_window_z_first (local.get $parent)))))
    (block $done (loop $scan
      (br_if $done (i32.eqz (local.get $cur)))
      (if (call $find_window_matches
            (local.get $cur) (local.get $class_g) (local.get $title_g)
            (local.get $wide))
        (then (return (local.get $cur))))
      (local.set $cur
        (call $find_window_z_next (local.get $parent) (local.get $cur)))
      (br $scan)))
    (i32.const 0))

  ;; 913: FindWindowExA(hwndParent, hwndChildAfter, lpszClass, lpszWindow)
  ;; Walks hwndParent's direct children in Z order, resuming after
  ;; hwndChildAfter when one is given. Winamp's "Winamp Gen" frame locates the
  ;; embedded plug-in window it has to size with exactly this call --
  ;; FindWindowEx(parent, 0, 0, 0) from its WM_SIZE/WM_SHOWWINDOW arm -- so
  ;; while this answered NULL every embedded plug-in kept the 100x100 box it
  ;; was created with instead of being fitted to the frame's client area. AVS
  ;; was the visible case: its visualisation drew as a small square over the
  ;; window's titlebar.
  ;;
  (func $handle_FindWindowExA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $find_window_core
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)
      (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))  ;; stdcall, 4 args
  )

  ;; 190: BringWindowToTop(hWnd) — 1 arg stdcall
  ;; Raise the HWND among siblings, then activate its associated top-level window.
  (func $handle_BringWindowToTop (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $top i32)
    (local.set $top (call $wnd_top_level (local.get $arg0)))
    (call $host_set_window_zorder (local.get $arg0) (i32.const 0)) (i32.store offset=0 (global.get $reg_base) (call $host_activate_window (local.get $arg0))) ;; HWND_TOP then activate
    (if (i32.and
          (i32.ge_s (call $wnd_table_find (local.get $top)) (i32.const 0))
          (i32.eq (call $wnd_get_thread (local.get $top)) (global.get $current_thread_id)))
      (then (drop (call $active_window_transition (local.get $top)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; 191: GetPrivateProfileIntA(lpAppName, lpKeyName, nDefault, lpFileName)
  ;; No INI file support — return nDefault (arg2)
  (func $handle_GetPrivateProfileIntA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; GetPrivateProfileIntA(appName, keyName, nDefault, fileName) — 4 args stdcall
    (i32.store offset=0 (global.get $reg_base) (call $host_ini_get_int
      (call $g2w (local.get $arg0))
      (call $g2w (local.get $arg1))
      (local.get $arg2)
      (call $g2w (local.get $arg3))
      (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; 192: WritePrivateProfileStringA(appName, keyName, string, fileName) — 4 args stdcall
  (func $handle_WritePrivateProfileStringA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_ini_write_string
      (call $g2w (local.get $arg0))
      (if (result i32) (local.get $arg1) (then (call $g2w (local.get $arg1))) (else (i32.const 0)))
      (if (result i32) (local.get $arg2) (then (call $g2w (local.get $arg2))) (else (i32.const 0)))
      (call $g2w (local.get $arg3))
      (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  (func $write_private_profile_section (param $app i32) (param $strings i32) (param $file i32) (param $wide i32)
    (local $error i32)
    (local.set $error (call $host_ini_write_section
      (if (result i32) (local.get $app) (then (call $g2w (local.get $app))) (else (i32.const 0)))
      (if (result i32) (local.get $strings) (then (call $g2w (local.get $strings))) (else (i32.const 0)))
      (if (result i32) (local.get $file) (then (call $g2w (local.get $file))) (else (i32.const 0)))
      (local.get $wide)))
    (if (local.get $error) (then (global.set $last_error (local.get $error))))
    (i32.store offset=0 (global.get $reg_base) (i32.eqz (local.get $error))))

  (func $handle_WritePrivateProfileSectionA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $write_private_profile_section (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_WritePrivateProfileSectionW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $write_private_profile_section (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; 193: ShellExecuteA(hwnd, lpOperation, lpFile, lpParameters, lpDirectory, nShowCmd)
  (func $handle_ShellExecuteA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_shell_execute
      (local.get $arg0)
      (if (result i32) (local.get $arg1) (then (call $g2w (local.get $arg1))) (else (i32.const 0)))
      (if (result i32) (local.get $arg2) (then (call $g2w (local.get $arg2))) (else (i32.const 0)))
      (if (result i32) (local.get $arg3) (then (call $g2w (local.get $arg3))) (else (i32.const 0)))
      (if (result i32) (local.get $arg4) (then (call $g2w (local.get $arg4))) (else (i32.const 0)))
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))) ;; nShowCmd
    (drop (local.get $name_ptr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))  ;; 6 args + ret
  )

  ;; 194: ShellAboutA(hwnd, szApp, szOtherStuff, hIcon) — show About dialog
  ;; ShellAbout's strings come straight from the guest call. No PE
  ;; version-resource parsing needed; WAT can build the dialog entirely
  ;; from the args. The host_shell_about import only logs (so the
  ;; existing [ShellAbout] log gate keeps firing); all rendering state
  ;; comes from $create_about_dialog → $host_register_dialog_frame +
  ;; $ctrl_create_child.
  (func $handle_ShellAboutA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dlg i32)
    (local.set $dlg (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (drop (call $host_shell_about
      (local.get $dlg) (local.get $arg0) (call $g2w (local.get $arg1))))
    (call $create_about_dialog
      (local.get $dlg) (local.get $arg0)
      (local.get $arg1) (local.get $arg2))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; 195: SHGetSpecialFolderPathA(hwnd, pszPath, csidl, fCreate) -> BOOL.
  ;; Use SHGetFolderPathW's canonical CSIDL table, then narrow its result. This
  ;; keeps the ANSI legacy export aligned with the Win2k shfolder forwarder.
  (func $handle_SHGetSpecialFolderPathA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $saved_esp i32) (local $wide i32) (local $hr i32) (local $folder i32)
    (local.set $saved_esp (i32.load offset=16 (global.get $reg_base)))
    (if (i32.eqz (local.get $arg1))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (local.set $wide (call $heap_alloc (i32.const 520)))
    (if (i32.eqz (local.get $wide))
      (then
        (call $gs8 (local.get $arg1) (i32.const 0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (local.set $folder (local.get $arg2))
    (if (local.get $arg3)
      (then (local.set $folder (i32.or (local.get $folder) (i32.const 0x8000)))))
    (call $handle_SHGetFolderPathW
      (local.get $arg0) (local.get $folder) (i32.const 0) (i32.const 0)
      (local.get $wide) (local.get $name_ptr))
    (local.set $hr (i32.load offset=0 (global.get $reg_base)))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved_esp))
    (if (i32.eqz (local.get $hr))
      (then
        (drop (call $wide_to_ansi (local.get $wide) (local.get $arg1) (i32.const 260)))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1)))
      (else
        (call $gs8 (local.get $arg1) (i32.const 0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (call $heap_free (local.get $wide))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; CSIDL_FLAG_CREATE asks the shell path API to create the returned folder.
  ;; The host VFS accepts the UTF-16 path we just wrote and creates its parent
  ;; entry as well; an already-present path is still a successful lookup.
  (func $sh_folder_maybe_create (param $nFolder i32) (param $dst i32)
    (if (i32.and (local.get $nFolder) (i32.const 0x8000))
      (then (drop (call $host_fs_create_directory
        (local.get $dst) (i32.const 1))))))

  ;; The file-system CSIDLs of a single-user Win98 box (profiles off), with
  ;; the IE4 desktop update's All Users tree and the paths shfolder.dll's own
  ;; Win9x emulation hands out for the folders shell32 predates (LOCAL_APPDATA,
  ;; MYPICTURES, ADMINTOOLS...). Returns the ANSI path, or 0 for a virtual
  ;; folder (CONTROLS, PRINTERS, BITBUCKET, DRIVES, NETWORK) or an unknown id.
  ;; Windows Installer resolves every one of these while it costs a package;
  ;; one failure is "Internal Error 2103" (Arcanum's installer, CSIDL 0x30).
  (func $csidl_win98_path (param $folder i32) (result i32)
    (if (i32.eq (local.get $folder) (i32.const 0x00)) (then (return "C:\\WINDOWS\\Desktop"))) ;; DESKTOP
    (if (i32.eq (local.get $folder) (i32.const 0x02)) (then (return "C:\\WINDOWS\\Start Menu\\Programs"))) ;; PROGRAMS
    (if (i32.eq (local.get $folder) (i32.const 0x05)) (then (return "C:\\My Documents"))) ;; PERSONAL
    (if (i32.eq (local.get $folder) (i32.const 0x06)) (then (return "C:\\WINDOWS\\Favorites"))) ;; FAVORITES
    (if (i32.eq (local.get $folder) (i32.const 0x07)) (then (return "C:\\WINDOWS\\Start Menu\\Programs\\StartUp"))) ;; STARTUP
    (if (i32.eq (local.get $folder) (i32.const 0x08)) (then (return "C:\\WINDOWS\\Recent"))) ;; RECENT
    (if (i32.eq (local.get $folder) (i32.const 0x09)) (then (return "C:\\WINDOWS\\SendTo"))) ;; SENDTO
    (if (i32.eq (local.get $folder) (i32.const 0x0b)) (then (return "C:\\WINDOWS\\Start Menu"))) ;; STARTMENU
    (if (i32.eq (local.get $folder) (i32.const 0x10)) (then (return "C:\\WINDOWS\\Desktop"))) ;; DESKTOPDIRECTORY
    (if (i32.eq (local.get $folder) (i32.const 0x13)) (then (return "C:\\WINDOWS\\NetHood"))) ;; NETHOOD
    (if (i32.eq (local.get $folder) (i32.const 0x14)) (then (return "C:\\WINDOWS\\Fonts"))) ;; FONTS
    (if (i32.eq (local.get $folder) (i32.const 0x15)) (then (return "C:\\WINDOWS\\ShellNew"))) ;; TEMPLATES
    (if (i32.eq (local.get $folder) (i32.const 0x16)) (then (return "C:\\WINDOWS\\All Users\\Start Menu"))) ;; COMMON_STARTMENU
    (if (i32.eq (local.get $folder) (i32.const 0x17)) (then (return "C:\\WINDOWS\\All Users\\Start Menu\\Programs"))) ;; COMMON_PROGRAMS
    (if (i32.eq (local.get $folder) (i32.const 0x18)) (then (return "C:\\WINDOWS\\All Users\\Start Menu\\Programs\\StartUp"))) ;; COMMON_STARTUP
    (if (i32.eq (local.get $folder) (i32.const 0x19)) (then (return "C:\\WINDOWS\\All Users\\Desktop"))) ;; COMMON_DESKTOPDIRECTORY
    (if (i32.eq (local.get $folder) (i32.const 0x1a)) (then (return "C:\\WINDOWS\\Application Data"))) ;; APPDATA
    (if (i32.eq (local.get $folder) (i32.const 0x1b)) (then (return "C:\\WINDOWS\\PrintHood"))) ;; PRINTHOOD
    (if (i32.eq (local.get $folder) (i32.const 0x1c)) (then (return "C:\\WINDOWS\\Local Settings\\Application Data"))) ;; LOCAL_APPDATA
    (if (i32.eq (local.get $folder) (i32.const 0x1f)) (then (return "C:\\WINDOWS\\All Users\\Favorites"))) ;; COMMON_FAVORITES
    (if (i32.eq (local.get $folder) (i32.const 0x20)) (then (return "C:\\WINDOWS\\Temporary Internet Files"))) ;; INTERNET_CACHE
    (if (i32.eq (local.get $folder) (i32.const 0x21)) (then (return "C:\\WINDOWS\\Cookies"))) ;; COOKIES
    (if (i32.eq (local.get $folder) (i32.const 0x22)) (then (return "C:\\WINDOWS\\History"))) ;; HISTORY
    (if (i32.eq (local.get $folder) (i32.const 0x23)) (then (return "C:\\WINDOWS\\All Users\\Application Data"))) ;; COMMON_APPDATA
    (if (i32.eq (local.get $folder) (i32.const 0x24)) (then (return "C:\\WINDOWS"))) ;; WINDOWS
    (if (i32.eq (local.get $folder) (i32.const 0x25)) (then (return "C:\\WINDOWS\\SYSTEM"))) ;; SYSTEM
    (if (i32.eq (local.get $folder) (i32.const 0x26)) (then (return "C:\\Program Files"))) ;; PROGRAM_FILES
    (if (i32.eq (local.get $folder) (i32.const 0x27)) (then (return "C:\\My Documents\\My Pictures"))) ;; MYPICTURES
    (if (i32.eq (local.get $folder) (i32.const 0x29)) (then (return "C:\\WINDOWS\\SYSTEM"))) ;; SYSTEMX86
    (if (i32.eq (local.get $folder) (i32.const 0x2a)) (then (return "C:\\Program Files"))) ;; PROGRAM_FILESX86
    (if (i32.eq (local.get $folder) (i32.const 0x2b)) (then (return "C:\\Program Files\\Common Files"))) ;; PROGRAM_FILES_COMMON
    (if (i32.eq (local.get $folder) (i32.const 0x2c)) (then (return "C:\\Program Files\\Common Files"))) ;; PROGRAM_FILES_COMMONX86
    (if (i32.eq (local.get $folder) (i32.const 0x2d)) (then (return "C:\\WINDOWS\\All Users\\Templates"))) ;; COMMON_TEMPLATES
    (if (i32.eq (local.get $folder) (i32.const 0x2e)) (then (return "C:\\WINDOWS\\All Users\\Documents"))) ;; COMMON_DOCUMENTS
    (if (i32.eq (local.get $folder) (i32.const 0x2f)) (then (return "C:\\WINDOWS\\All Users\\Start Menu\\Programs\\Administrative Tools"))) ;; COMMON_ADMINTOOLS
    (if (i32.eq (local.get $folder) (i32.const 0x30)) (then (return "C:\\WINDOWS\\Start Menu\\Programs\\Administrative Tools"))) ;; ADMINTOOLS
    (i32.const 0))

  ;; SHGetFolderPathW(hwndOwner, nFolder, hToken, dwFlags, pszPath) -> HRESULT.
  ;; The Win2k shfolder forwarder resolves this dynamically before trying its
  ;; legacy shell32 ordinal. pszPath is always MAX_PATH.
  (func $handle_SHGetFolderPathW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $src i32) (local $i i32) (local $ch i32)
    (drop (local.get $arg0)) (drop (local.get $arg2))
    (drop (local.get $arg3)) (drop (local.get $name_ptr))
    (if (i32.eqz (local.get $arg4))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)) ;; E_POINTER
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    ;; Mask CSIDL_FLAG_* from the high bits before selecting the folder.
    (local.set $src (call $csidl_win98_path (i32.and (local.get $arg1) (i32.const 0x00ff))))
    (if (i32.eqz (local.get $src))
      (then
        (call $gs16 (local.get $arg4) (i32.const 0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070002)) ;; HRESULT_FROM_WIN32(ERROR_FILE_NOT_FOUND)
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    ;; pszPath is MAX_PATH wide chars and may straddle a guest page: widen
    ;; through $gs16, not through one g2w of the start.
    (block $done (loop $widen
      (local.set $ch (i32.load8_u (i32.add (local.get $src) (local.get $i))))
      (call $gs16 (i32.add (local.get $arg4) (i32.shl (local.get $i) (i32.const 1))) (local.get $ch))
      (br_if $done (i32.eqz (local.get $ch)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $widen)))
    (call $sh_folder_maybe_create (local.get $arg1) (call $g2w (local.get $arg4)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
  )

  ;; SHGetFolderPathA(hwndOwner, nFolder, hToken, dwFlags, pszPath) -> HRESULT.
  ;; ANSI forwarder for setup engines that dynamically resolve the A spelling.
  (func $handle_SHGetFolderPathA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $saved_esp i32) (local $wide i32) (local $hr i32)
    (local.set $saved_esp (i32.load offset=16 (global.get $reg_base)))
    (if (i32.eqz (local.get $arg4))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)) ;; E_POINTER
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    (local.set $wide (call $heap_alloc (i32.const 520)))
    (if (i32.eqz (local.get $wide))
      (then
        (call $gs8 (local.get $arg4) (i32.const 0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000e)) ;; E_OUTOFMEMORY
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    (call $handle_SHGetFolderPathW
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)
      (local.get $wide) (local.get $name_ptr))
    (local.set $hr (i32.load offset=0 (global.get $reg_base)))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved_esp))
    (if (i32.eqz (local.get $hr))
      (then
        (drop (call $wide_to_ansi (local.get $wide) (local.get $arg4) (i32.const 260))))
      (else
        (call $gs8 (local.get $arg4) (i32.const 0))))
    (call $heap_free (local.get $wide))
    (i32.store offset=0 (global.get $reg_base) (local.get $hr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
  )

  ;; 196: DragAcceptFiles(hwnd, fAccept). Win9x records this as the
  ;; WS_EX_ACCEPTFILES bit on the destination window; the browser shell reads
  ;; the same WAT-owned style through $drop_target_at before constructing an
  ;; HDROP and posting WM_DROPFILES.
  (func $handle_DragAcceptFiles (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ex i32)
    (local.set $ex (call $ctrl_get_ex_style (local.get $arg0)))
    (if (local.get $arg1)
      (then (local.set $ex (i32.or (local.get $ex) (i32.const 0x10))))
      (else (local.set $ex (i32.and (local.get $ex) (i32.const -17)))))
    (call $ctrl_set_ex_style (local.get $arg0) (local.get $ex))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; Query one path in the DROPFILES payload. The format describes the source
  ;; encoding independently of whether the caller selected DragQueryFileA or
  ;; DragQueryFileW, so this helper converts in either direction. Return value
  ;; excludes the terminator, and iFile=-1 asks for the number of paths.
  (func $drop_read_char (param $src i32) (param $wide i32) (result i32)
    (if (result i32) (local.get $wide)
      (then (call $gl16 (local.get $src)))
      (else (call $gl8 (local.get $src)))))

  (func $drop_query_file (param $hdrop i32) (param $index i32)
        (param $dst i32) (param $cch i32) (param $dst_wide i32) (result i32)
    (local $src i32) (local $source_wide i32) (local $source_step i32)
    (local $file i32) (local $length i32) (local $copied i32) (local $ch i32)
    (if (i32.eqz (local.get $hdrop)) (then (return (i32.const 0))))
    (local.set $src (i32.add (local.get $hdrop) (call $gl32 (local.get $hdrop))))
    (local.set $source_wide
      (i32.ne (call $gl32 (i32.add (local.get $hdrop) (i32.const 16))) (i32.const 0)))
    (local.set $source_step
      (select (i32.const 2) (i32.const 1) (local.get $source_wide)))

    ;; Locate the requested string, or count every string for index=-1.
    (block $located (loop $files
      (local.set $ch (call $drop_read_char
        (local.get $src) (local.get $source_wide)))
      (if (i32.eqz (local.get $ch))
        (then
          (if (i32.eq (local.get $index) (i32.const -1))
            (then (return (local.get $file))))
          (return (i32.const 0))))
      (if (i32.eq (local.get $file) (local.get $index))
        (then (br $located)))
      (block $name_done (loop $skip_name
        (local.set $ch (call $drop_read_char
          (local.get $src) (local.get $source_wide)))
        (local.set $src (i32.add (local.get $src) (local.get $source_step)))
        (br_if $name_done (i32.eqz (local.get $ch)))
        (br $skip_name)))
      (local.set $file (i32.add (local.get $file) (i32.const 1)))
      (br $files)))

    ;; Measure in source characters. Our browser-created paths are 7-bit ANSI,
    ;; but accepting either DROPFILES spelling also keeps app-created HDROPs
    ;; coherent with the documented structure.
    (block $length_done (loop $measure
      (local.set $ch (call $drop_read_char
        (i32.add (local.get $src)
          (i32.mul (local.get $length) (local.get $source_step)))
        (local.get $source_wide)))
      (br_if $length_done (i32.eqz (local.get $ch)))
      (local.set $length (i32.add (local.get $length) (i32.const 1)))
      (br $measure)))
    (if (i32.eqz (local.get $dst)) (then (return (local.get $length))))
    (if (i32.eqz (local.get $cch)) (then (return (i32.const 0))))

    (local.set $copied
      (select (local.get $length) (i32.sub (local.get $cch) (i32.const 1))
        (i32.lt_u (local.get $length) (local.get $cch))))
    (local.set $file (i32.const 0))
    (block $copy_done (loop $copy
      (br_if $copy_done (i32.ge_u (local.get $file) (local.get $copied)))
      (local.set $ch (call $drop_read_char
        (i32.add (local.get $src)
          (i32.mul (local.get $file) (local.get $source_step)))
        (local.get $source_wide)))
      (if (local.get $dst_wide)
        (then (call $gs16
          (i32.add (local.get $dst) (i32.mul (local.get $file) (i32.const 2)))
          (local.get $ch)))
        (else (call $gs8 (i32.add (local.get $dst) (local.get $file))
          (select (local.get $ch) (i32.const 63)
            (i32.le_u (local.get $ch) (i32.const 255))))))
      (local.set $file (i32.add (local.get $file) (i32.const 1)))
      (br $copy)))
    (if (local.get $dst_wide)
      (then (call $gs16
        (i32.add (local.get $dst) (i32.mul (local.get $copied) (i32.const 2)))
        (i32.const 0)))
      (else (call $gs8 (i32.add (local.get $dst) (local.get $copied)) (i32.const 0))))
    (local.get $copied))

  ;; 197: DragQueryFileA(hDrop, iFile, lpszFile, cch)
  (func $handle_DragQueryFileA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $drop_query_file
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)
      (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))  ;; stdcall, 4 args
  )

  ;; 198: DragFinish(hDrop) — release the heap block supplied with
  ;; WM_DROPFILES. It is legal to pass the handle to several DragQueryFile
  ;; calls before this one final release.
  (func $handle_DragFinish (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg0) (then (call $heap_free (local.get $arg0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; Validate a caller-owned common-dialog structure without touching it. A
  ;; readable but wrong lStructSize is CDERR_STRUCTSIZE; a NULL, unmapped, or
  ;; truncated structure is the runtime's safe CDERR_INITIALIZATION failure.
  ;; $alternate_size is zero when the structure has only one accepted Win98
  ;; layout. OPENFILENAME also accepts the later 88-byte layout because the
  ;; existing A/W handlers already expose that compatible front door.
  (func $common_dialog_validate_struct
      (param $ptr i32) (param $win98_size i32) (param $alternate_size i32)
      (result i32)
    (local $header i32) (local $size i32)
    (if (i32.eqz (local.get $ptr))
      (then (return (i32.const 2)))) ;; CDERR_INITIALIZATION
    (local.set $header (call $g2w_affine_span (local.get $ptr) (i32.const 4)))
    (if (i32.eq (local.get $header) (global.get $NULL_SENTINEL))
      (then (return (i32.const 2)))) ;; CDERR_INITIALIZATION
    (local.set $size (i32.load (local.get $header)))
    (if (i32.eqz
          (i32.or
            (i32.eq (local.get $size) (local.get $win98_size))
            (i32.and
              (i32.ne (local.get $alternate_size) (i32.const 0))
              (i32.eq (local.get $size) (local.get $alternate_size)))))
      (then (return (i32.const 1)))) ;; CDERR_STRUCTSIZE
    (if (i32.eq
          (call $g2w_affine_span (local.get $ptr) (local.get $size))
          (global.get $NULL_SENTINEL))
      (then (return (i32.const 2)))) ;; CDERR_INITIALIZATION
    (i32.const 0))

  (func $common_dialog_fail (param $error i32)
    (global.set $common_dialog_error (local.get $error))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $common_dialog_extended_error (result i32)
    (global.get $common_dialog_error))

  ;; 199: GetOpenFileNameA(lpOFN) — show modal Open dialog
  ;;
  ;; Builds a WAT-driven Open dialog (class 12), parks EIP at the
  ;; CACA0006 modal pump thunk via $modal_begin, and yields to JS.
  ;; The dialog's wndproc writes the chosen filename back into
  ;; OFN.lpstrFile and calls $modal_done(1/0) on OK/Cancel. The pump
  ;; restores eax/eip/esp on the next interpreter pass after that.
  (func $handle_GetOpenFileNameA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dlg i32) (local $owner i32) (local $error i32)
    (global.set $common_dialog_error (i32.const 0))
    (local.set $error (call $common_dialog_validate_struct
      (local.get $arg0) (i32.const 76) (i32.const 88)))
    (if (local.get $error)
      (then (call $common_dialog_fail (local.get $error)) (return)))
    (call $modal_capture_nonvolatile)
    (global.set $opendlg_wide (i32.const 0))
    (local.set $dlg (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    ;; OPENFILENAME.hwndOwner at +4
    (local.set $owner (call $gl32 (i32.add (local.get $arg0) (i32.const 4))))
    (call $create_open_dialog (local.get $dlg) (local.get $owner) (i32.const 0) (local.get $arg0))
    ;; 1-arg stdcall: ret addr (4) + arg (4) = 8 bytes to pop on return.
    (call $modal_begin (local.get $dlg) (i32.const 8))
  )

  ;; GetOpenFileNameW(lpOFN) — the dialog UI uses the same byte-oriented WAT
  ;; controls, while filter parsing and the selected output buffer honor the
  ;; Unicode OPENFILENAME contract.
  (func $handle_GetOpenFileNameW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dlg i32) (local $owner i32) (local $error i32)
    (global.set $common_dialog_error (i32.const 0))
    (local.set $error (call $common_dialog_validate_struct
      (local.get $arg0) (i32.const 76) (i32.const 88)))
    (if (local.get $error)
      (then (call $common_dialog_fail (local.get $error)) (return)))
    (call $modal_capture_nonvolatile)
    (global.set $opendlg_wide (i32.const 1))
    (local.set $dlg (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (local.set $owner (call $gl32 (i32.add (local.get $arg0) (i32.const 4))))
    (call $create_open_dialog (local.get $dlg) (local.get $owner) (i32.const 0) (local.get $arg0))
    (call $modal_begin (local.get $dlg) (i32.const 8))
  )

  ;; 200: GetFileTitleA(lpszFile, lpszTitle, cbBuf)
  ;; Return the display title portion of a path. Success returns 0; if the
  ;; destination buffer is too small, return the required char count including
  ;; the NUL terminator. Good enough for Notepad's File->Open title update.
  (func $handle_GetFileTitleA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $p i32) (local $base i32) (local $ch i32) (local $len i32)
    (if (i32.eqz (local.get $arg0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (local.set $p (local.get $arg0))
    (local.set $base (local.get $arg0))
    (block $done (loop $scan
      (local.set $ch (call $gl8 (local.get $p)))
      (br_if $done (i32.eqz (local.get $ch)))
      (if (i32.or
            (i32.or (i32.eq (local.get $ch) (i32.const 0x5C)) ;; '\'
                    (i32.eq (local.get $ch) (i32.const 0x2F))) ;; '/'
            (i32.eq (local.get $ch) (i32.const 0x3A)))         ;; ':'
        (then (local.set $base (i32.add (local.get $p) (i32.const 1)))))
      (local.set $p (i32.add (local.get $p) (i32.const 1)))
      (br $scan)))
    (local.set $len (call $guest_strlen (local.get $base)))
    (if (i32.or (i32.eqz (local.get $arg1))
                (i32.lt_u (local.get $arg2) (i32.add (local.get $len) (i32.const 1))))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.add (local.get $len) (i32.const 1)))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (call $guest_strcpy (local.get $arg1) (local.get $base))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 201: ChooseFontA(lpCF) — show the WAT-driven Font picker with face/
  ;; style/size listboxes. On OK, writes chosen size back to LOGFONT.lfHeight.
  (func $handle_ChooseFontA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dlg i32) (local $owner i32) (local $error i32)
    (global.set $common_dialog_error (i32.const 0))
    (local.set $error (call $common_dialog_validate_struct
      (local.get $arg0) (i32.const 60) (i32.const 0)))
    (if (local.get $error)
      (then (call $common_dialog_fail (local.get $error)) (return)))
    ;; CF_LIMITSIZE: the maximum point size must not precede the minimum.
    (if (i32.and
          (i32.ne (i32.and (call $gl32 (i32.add (local.get $arg0) (i32.const 20)))
                            (i32.const 0x00002000)) (i32.const 0))
          (i32.lt_s (call $gl32 (i32.add (local.get $arg0) (i32.const 56)))
                    (call $gl32 (i32.add (local.get $arg0) (i32.const 52)))))
      (then (call $common_dialog_fail (i32.const 0x2002)) (return)))
    (call $modal_capture_nonvolatile)
    (local.set $dlg (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (local.set $owner (call $gl32 (i32.add (local.get $arg0) (i32.const 4))))
    (call $create_font_dialog (local.get $dlg) (local.get $owner) (local.get $arg0))
    (call $modal_begin (local.get $dlg) (i32.const 8)))

  ;; 202: FindTextA(lpFR) — create modeless Find dialog, return HWND
  (func $handle_FindTextA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $hwnd i32) (local $owner i32) (local $error i32)
    (global.set $common_dialog_error (i32.const 0))
    (local.set $error (call $common_dialog_validate_struct
      (local.get $arg0) (i32.const 40) (i32.const 0)))
    (if (local.get $error)
      (then (call $common_dialog_fail (local.get $error)) (return)))
    (if (i32.or
          (i32.eqz (call $gl16 (i32.add (local.get $arg0) (i32.const 24))))
          (i32.eq (call $g2w_affine_span
            (call $gl32 (i32.add (local.get $arg0) (i32.const 16)))
            (call $gl16 (i32.add (local.get $arg0) (i32.const 24))))
            (global.get $NULL_SENTINEL)))
      (then (call $common_dialog_fail (i32.const 0x4001)) (return)))
    (local.set $hwnd (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    ;; Read hwndOwner from FINDREPLACE struct at offset +4
    (local.set $owner (call $gl32 (i32.add (local.get $arg0) (i32.const 4))))
    ;; Bare host log line for the [FindTextA] gate. All renderer state is
    ;; created from inside $create_findreplace_dialog via host_register_dialog_frame.
    (drop (call $host_show_find_dialog (local.get $hwnd) (local.get $owner) (local.get $arg0)))
    (call $create_findreplace_dialog (local.get $hwnd) (local.get $owner) (local.get $arg0) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (local.get $hwnd))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; ReplaceTextA(lpFR) — create modeless Replace dialog, return HWND.
  ;; This is commonly resolved dynamically by MFC, so it must participate in
  ;; the normal API hash/GetProcAddress path even when no PE imports it.
  (func $handle_ReplaceTextA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $hwnd i32) (local $owner i32) (local $error i32)
    (global.set $common_dialog_error (i32.const 0))
    (local.set $error (call $common_dialog_validate_struct
      (local.get $arg0) (i32.const 40) (i32.const 0)))
    (if (local.get $error)
      (then (call $common_dialog_fail (local.get $error)) (return)))
    (if (i32.or
          (i32.or
            (i32.eqz (call $gl16 (i32.add (local.get $arg0) (i32.const 24))))
            (i32.eq (call $g2w_affine_span
              (call $gl32 (i32.add (local.get $arg0) (i32.const 16)))
              (call $gl16 (i32.add (local.get $arg0) (i32.const 24))))
              (global.get $NULL_SENTINEL)))
          (i32.or
            (i32.eqz (call $gl16 (i32.add (local.get $arg0) (i32.const 26))))
            (i32.eq (call $g2w_affine_span
              (call $gl32 (i32.add (local.get $arg0) (i32.const 20)))
              (call $gl16 (i32.add (local.get $arg0) (i32.const 26))))
              (global.get $NULL_SENTINEL))))
      (then (call $common_dialog_fail (i32.const 0x4001)) (return)))
    (local.set $hwnd (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (local.set $owner (call $gl32 (i32.add (local.get $arg0) (i32.const 4))))
    (call $create_findreplace_dialog (local.get $hwnd) (local.get $owner) (local.get $arg0) (i32.const 1))
    (i32.store offset=0 (global.get $reg_base) (local.get $hwnd))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 203: PageSetupDlgA(lpPS) — show placeholder modal dialog
  (func $handle_PageSetupDlgA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dlg i32) (local $owner i32) (local $flags i32) (local $error i32)
    (global.set $common_dialog_error (i32.const 0))
    (local.set $error (call $common_dialog_validate_struct
      (local.get $arg0) (i32.const 84) (i32.const 0)))
    (if (local.get $error)
      (then (call $common_dialog_fail (local.get $error)) (return)))
    (call $modal_capture_nonvolatile)
    (local.set $flags (call $gl32 (i32.add (local.get $arg0) (i32.const 16))))
    ;; PAGESETUPDLG ptPaperSize + rtMinMargin + rtMargin. WordPad requests
    ;; thousandths of an inch; also honor hundredths-of-mm callers.
    (if (i32.and (local.get $flags) (i32.const 8)) ;; PSD_INHUNDREDTHSOFMILLIMETERS
      (then
        (call $gs32 (i32.add (local.get $arg0) (i32.const 20)) (i32.const 21590))
        (call $gs32 (i32.add (local.get $arg0) (i32.const 24)) (i32.const 27940))
        (call $gs32 (i32.add (local.get $arg0) (i32.const 28)) (i32.const 635))
        (call $gs32 (i32.add (local.get $arg0) (i32.const 32)) (i32.const 635))
        (call $gs32 (i32.add (local.get $arg0) (i32.const 36)) (i32.const 635))
        (call $gs32 (i32.add (local.get $arg0) (i32.const 40)) (i32.const 635))
        (call $gs32 (i32.add (local.get $arg0) (i32.const 44)) (i32.const 2540))
        (call $gs32 (i32.add (local.get $arg0) (i32.const 48)) (i32.const 2540))
        (call $gs32 (i32.add (local.get $arg0) (i32.const 52)) (i32.const 2540))
        (call $gs32 (i32.add (local.get $arg0) (i32.const 56)) (i32.const 2540)))
      (else
        (call $gs32 (i32.add (local.get $arg0) (i32.const 20)) (i32.const 8500))
        (call $gs32 (i32.add (local.get $arg0) (i32.const 24)) (i32.const 11000))
        (call $gs32 (i32.add (local.get $arg0) (i32.const 28)) (i32.const 250))
        (call $gs32 (i32.add (local.get $arg0) (i32.const 32)) (i32.const 250))
        (call $gs32 (i32.add (local.get $arg0) (i32.const 36)) (i32.const 250))
        (call $gs32 (i32.add (local.get $arg0) (i32.const 40)) (i32.const 250))
        (call $gs32 (i32.add (local.get $arg0) (i32.const 44)) (i32.const 1000))
        (call $gs32 (i32.add (local.get $arg0) (i32.const 48)) (i32.const 1000))
        (call $gs32 (i32.add (local.get $arg0) (i32.const 52)) (i32.const 1000))
        (call $gs32 (i32.add (local.get $arg0) (i32.const 56)) (i32.const 1000))))
    (local.set $dlg (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (local.set $owner (call $gl32 (i32.add (local.get $arg0) (i32.const 4))))
    (global.set $common_dialog_kind (i32.const 1))
    (global.set $common_dialog_struct (local.get $arg0))
    (call $create_page_setup_dialog (local.get $dlg) (local.get $owner))
    (call $modal_begin (local.get $dlg) (i32.const 8)))

  ;; 204: CommDlgExtendedError() — report the latest common-dialog failure.
  ;; Reading the value does not consume it. Cancel paths leave zero.
  (func $handle_CommDlgExtendedError (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $common_dialog_extended_error))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))  ;; stdcall, 0 args
  )
