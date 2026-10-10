  ;; ============================================================
  ;; LATE USER/GDI WINDOW HANDLERS\nMessage, placement, scrolling, dialogs, clipboard, cursor and window-enumeration APIs.
  ;; ============================================================

  ;; Is there queued work a following PeekMessage could hand back? This is the
  ;; message half of $win32_dispatch's MsgWaitForMultipleObjects fast path.
  ;;
  ;; NC work counts only for the two bits PeekMessage/GetMessage turn into a
  ;; MSG: 1 (WM_NCPAINT) and 4 (WM_NCCALCSIZE). It used to test
  ;; $nc_flags_count, which is nonzero whenever any window holds ANY NC bit --
  ;; including a pending erase (2), which only BeginPaint consumes, and the
  ;; persistent default-erase ownership bit (8), which never goes away. So the
  ;; wait reported "a message" forever while the peek that followed found none
  ;; of it. SDL 1.2's DX5_CheckInput (ScummVM) loops while MsgWait says
  ;; message; each of its one-per-batch waits let a 10ms timeSetEvent come due,
  ;; the peek then found THAT, the pump never returned 0, and ScummVM's
  ;; pollEvent ran once in 11,000 batches: black screen, then no mouse.
  ;; $has_pending_message fixed the same test for GetMessage's wake.
  (func $msgwait_queue_ready (result i32)
    (if (global.get $quit_flag) (then (return (i32.const 1))))
    (if (i32.gt_u (call $post_queue_total_count) (i32.const 0))
      (then (return (i32.const 1))))
    (if (i32.gt_u (call $shared_post_queue_total_count) (i32.const 0))
      (then (return (i32.const 1))))
    (if (global.get $paint_pending) (then (return (i32.const 1))))
    (if (call $nc_flags_scan (i32.const 5)) (then (return (i32.const 1))))
    (call $paint_flag_any))

  ;; What MsgWaitForMultipleObjects answers once neither a message nor a
  ;; handle is ready. An INFINITE wait never times out on Windows, so it must
  ;; not answer WAIT_TIMEOUT: report a message wake (WAIT_OBJECT_0 + nCount),
  ;; the one result every correct caller already loops on (pump, wait again),
  ;; while the caller's yield lets the object's owner run first. Windows
  ;; Installer waits for each custom-action EXE with
  ;; MsgWaitForMultipleObjects(1, &hProcess, FALSE, INFINITE, QS_ALLINPUT)
  ;; (msi.dll 0x4b96d6) and treats anything but 1 or WAIT_OBJECT_0 as
  ;; "finished": on WAIT_TIMEOUT it read STILL_ACTIVE from GetExitCodeProcess,
  ;; logged Info 1722 and ran `msiexec /Y` before `msiexec /D` had exited.
  ;; A finite timeout keeps the immediate WAIT_TIMEOUT.
  (func $msgwait_idle_result (param $count i32) (param $timeout i32) (result i32)
    (select (local.get $count) (i32.const 0x102) ;; WAIT_TIMEOUT
      (i32.or (call $msgwait_queue_ready)
              (i32.eq (local.get $timeout) (i32.const -1)))))

  ;; 607: MsgWaitForMultipleObjects(nCount, pHandles, fWaitAll, dwMilliseconds, dwWakeMask) → DWORD
  ;; 5 args stdcall = 24 bytes. Returns WAIT_OBJECT_0+i for signaled handle, or nCount for messages.
  (func $handle_MsgWaitForMultipleObjects (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $result i32) (local $packed i32)
    (if (call $incoming_send_yield) (then (return)))
    ;; Check if messages are pending first (post queue, paint, timers, host input).
    ;; host_check_input is destructive, so cache the event for the next
    ;; GetMessage/PeekMessage call instead of using it as a throwaway probe.
    (if (i32.eqz (global.get $pending_input_packed))
      (then
        (local.set $packed (call $host_check_input))
        (if (i32.ne (local.get $packed) (i32.const 0))
          (then
            (global.set $pending_input_packed (local.get $packed))
            (global.set $pending_input_hwnd (call $host_check_input_hwnd (global.get $focus_hwnd)))
            (global.set $pending_input_lparam (call $host_check_input_lparam))))))
    (if (i32.or
          (i32.or
            (i32.or (global.get $quit_flag)
                    (i32.gt_u (call $post_queue_total_count) (i32.const 0)))
            (i32.or (call $shared_post_queue_read
                      (call $w2g (call $paint_scratch_take)) (i32.const 0))
                    (global.get $pending_input_packed)))
          (i32.or
            (i32.or (global.get $paint_pending)
                    (call $nc_flags_scan (i32.const 5)))
            (i32.or (call $paint_flag_any)
                    (call $timer_check_due (call $paint_scratch_take) (i32.const 0)))))
      (then
        ;; Message available: return WAIT_OBJECT_0 + nCount
        (i32.store offset=0 (global.get $reg_base) (local.get $arg0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    ;; A signaled handle is a result, not just a wake source: Win32 reports it
    ;; as WAIT_OBJECT_0+i and a successful wait consumes an auto-reset event,
    ;; exactly as WaitForMultipleObjects would. msi.dll's cross-thread Invoke
    ;; loop waits here for the main thread's completion event and only leaves
    ;; on WAIT_OBJECT_0; reporting WAIT_TIMEOUT forever stranded its engine
    ;; thread, so the installer wizard's Next button never advanced.
    (if (i32.gt_u (local.get $arg0) (i32.const 0))
      (then
        (local.set $result (call $host_wait_multiple
          (local.get $arg0) (call $g2w (local.get $arg1))
          (local.get $arg2) (i32.const 0)))
        (if (i32.and (i32.ne (local.get $result) (i32.const 0xFFFF))
                     (i32.ne (local.get $result) (i32.const 0x102)))
          (then
            (i32.store offset=0 (global.get $reg_base) (local.get $result))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
            (return)))))
    ;; Nothing ready — if timeout is 0, return WAIT_TIMEOUT
    (if (i32.eqz (local.get $arg3))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x102))  ;; WAIT_TIMEOUT
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    ;; Message-aware waits are commonly embedded in private PeekMessage loops.
    ;; Complete the stdcall frame before yielding the emulator slice so host
    ;; input cannot synchronously re-enter guest code with this frame live.
    (i32.store offset=0 (global.get $reg_base)
      (call $msgwait_idle_result (local.get $arg0) (local.get $arg3)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
    (global.set $yield_flag (i32.const 1))
    (global.set $steps (i32.const 0)))

  ;; MsgWaitForMultipleObjectsEx: immediate all-input polling with no object
  ;; handles and MWMO_INPUTAVAILABLE. This is a real non-consuming queue poll,
  ;; not the legacy handler's synthetic INFINITE wake. Other modes still need
  ;; masked queue/change-latch and scheduler support and remain fail-fast.
  (func $handle_MsgWaitForMultipleObjectsEx (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $packed i32)
    (if (i32.or (local.get $arg0) (i32.or (local.get $arg2)
      (i32.or (i32.eqz (i32.and (local.get $arg4) (i32.const 4)))
      (i32.or (i32.ne (i32.and (local.get $arg4) (i32.const -8)) (i32.const 0))
        (i32.and (i32.ne (local.get $arg3) (i32.const 255))
          (i32.ne (local.get $arg3) (i32.const 1279)))))))
      (then (call $crash_unimplemented (local.get $name_ptr)) (return)))
    (if (call $incoming_send_yield) (then (return)))
    (if (i32.and (local.get $arg4) (i32.const 2)) (then
      (if (call $io_apc_start (i32.const 24)) (then (return)))))
    ;; The host probe removes an event. Keep all its fields for the following
    ;; PeekMessage/GetMessage and do not probe again while that event is cached.
    (if (i32.eqz (global.get $pending_input_packed)) (then
      (local.set $packed (call $host_check_input))
      (if (local.get $packed) (then
        (global.set $pending_input_packed (local.get $packed))
        (global.set $pending_input_hwnd (call $host_check_input_hwnd (global.get $focus_hwnd)))
        (global.set $pending_input_lparam (call $host_check_input_lparam))))))
    (i32.store (global.get $reg_base)
      (select (i32.const 0) (i32.const 258) (call $has_pending_message)))
    (i32.store offset=16 (global.get $reg_base)
      (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  ;; 608: GetWindowPlacement(hWnd, lpwndpl) — 2 args stdcall
  ;; WINDOWPLACEMENT's normal rect describes the requested window, not the
  ;; desktop. MFC uses this for child layout too (Font Viewer sizes its sample
  ;; pane from dialog-control placements), so a fixed 640x480 rect produces
  ;; negative child dimensions.
  (func $handle_GetWindowPlacement (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32) (local $x i32) (local $y i32)
    (local.set $wa (call $g2w (local.get $arg1)))
    ;; length = 44
    (i32.store (local.get $wa) (i32.const 44))
    ;; flags: WPF_RESTORETOMAXIMIZED (0x0002) when this icon will come back
    ;; maximized. That is the one thing an app cannot work out from showCmd.
    (i32.store offset=4 (local.get $wa)
      (select (i32.const 2) (i32.const 0)
        (i32.and (call $wnd_min_get (local.get $arg0))
                 (call $wnd_max_get (local.get $arg0)))))
    ;; showCmd: SW_SHOWMINIMIZED(2) / SW_SHOWMAXIMIZED(3) / SW_SHOWNORMAL(1).
    ;; It was the constant 1, so an app restoring its own window from its saved
    ;; placement — how Win9x apps persist "start maximized" — always came back
    ;; normal no matter what it had been.
    (i32.store offset=8 (local.get $wa)
      (select (i32.const 2)
        (select (i32.const 3) (i32.const 1) (call $wnd_max_get (local.get $arg0)))
        (call $wnd_min_get (local.get $arg0))))
    ;; ptMinPosition = (0,0)
    (i32.store offset=12 (local.get $wa) (i32.const 0))
    (i32.store offset=16 (local.get $wa) (i32.const 0))
    ;; ptMaxPosition = (-1,-1)
    (i32.store offset=20 (local.get $wa) (i32.const -1))
    (i32.store offset=24 (local.get $wa) (i32.const -1))
    ;; rcNormalPosition = current window rectangle. Child placement uses
    ;; parent-client coordinates; top-level placement uses screen coordinates.
    ;;
    ;; Both operands are coerced to 0/1 first. `i32.and` is bitwise, and
    ;; WS_CHILD (0x40000000) shares no bit with a real hwnd like 0x10001, so
    ;; ANDing them raw is always 0 - every child then reported screen
    ;; coordinates. An app that reads one control's placement and lays its
    ;; siblings out against it moves them by the parent's whole non-client
    ;; offset: fontview.exe reads Done at y=31 instead of y=8 and drops its
    ;; other three buttons a row lower than the row Win98 puts them in.
    (if (i32.and
          (i32.ne
            (i32.and (call $wnd_get_style (local.get $arg0)) (i32.const 0x40000000))
            (i32.const 0))
          (i32.ne (call $wnd_get_parent (local.get $arg0)) (i32.const 0)))
      (then
        (local.set $x (call $ctrl_get_x_s (local.get $arg0)))
        (local.set $y (call $ctrl_get_y_s (local.get $arg0)))
        (i32.store offset=28 (local.get $wa) (local.get $x))
        (i32.store offset=32 (local.get $wa) (local.get $y))
        (i32.store offset=36 (local.get $wa)
          (i32.add (local.get $x) (call $wnd_screen_w (local.get $arg0))))
        (i32.store offset=40 (local.get $wa)
          (i32.add (local.get $y) (call $wnd_screen_h (local.get $arg0)))))
      (else
        (call $host_get_window_rect (local.get $arg0)
          (i32.add (local.get $wa) (i32.const 28)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))  ;; stdcall, 2 args
  )

  ;; 609: RegisterWindowMessageW(lpString) — the A spelling's message, by name.
  ;; It used to mint its own number, so an app that registered a message as W
  ;; and received it from a component that registered it as A never matched.
  (func $handle_RegisterWindowMessageW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ansi i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
    (if (i32.eqz (local.get $arg0))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (local.set $ansi (call $clipfmt_wide_to_ansi (local.get $arg0)))
    (if (i32.eqz (local.get $ansi))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (i32.store offset=0 (global.get $reg_base) (call $register_window_message (local.get $ansi)))
    (call $heap_free (local.get $ansi))
  )

  ;; 610: GetForegroundWindow
  (func $handle_GetForegroundWindow (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; This is system-wide, unlike GetActiveWindow's calling-thread queue.
    ;; The renderer owns the cross-process top-level z-order.
    ;; With nothing of ours foreground, a real Win98 session still has the
    ;; shell's window there, never NULL: an app launched from Explorer sees
    ;; that before its own window exists. Answer with the desktop, the one
    ;; shell-owned top level we model. Moorhuhn 2's fmod passes this to
    ;; IDirectSound::SetCooperativeLevel before creating any window, and a
    ;; NULL there failed DirectSound init and left the game silent.
    (local $hwnd i32)
    (local.set $hwnd (call $host_foreground_window))
    (if (i32.eqz (local.get $hwnd)) (then (local.set $hwnd (i32.const 0x10000))))
    (i32.store offset=0 (global.get $reg_base) (local.get $hwnd))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; 611: GetMessagePos — returns the screen-space cursor position
  ;; (y<<16 | x) at the time of the last retrieved message.
  (func $handle_GetMessagePos (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.or
        (i32.and (global.get $last_msg_pos_x) (i32.const 0xFFFF))
        (i32.shl
          (i32.and (global.get $last_msg_pos_y) (i32.const 0xFFFF))
          (i32.const 16))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))) (return)
  )

  ;; 612: GetMessageTime — return tick count of the last message retrieved via
  ;; GetMessage/PeekMessage.
  (func $handle_GetMessageTime (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (global.get $last_msg_time))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))) (return)
  )

  ;; GetMessageExtraInfo() -> LPARAM: the extra-info value of the last message
  ;; this thread retrieved with GetMessage/PeekMessage, or whatever
  ;; SetMessageExtraInfo stored since. Mouse/keyboard input carries 0 here
  ;; (no device driver attaches a signature).
  (func $handle_GetMessageExtraInfo (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (global.get $msg_extra_info))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  ;; SetMessageExtraInfo(lParam) -> LPARAM: replace the calling thread's extra
  ;; info, returning the previous value.
  (func $handle_SetMessageExtraInfo (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (global.get $msg_extra_info))
    (global.set $msg_extra_info (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; 613: RemovePropW(hwnd, lpString) -> HANDLE.
  ;; Share the lightweight USER32 property table with the A variant; atom names
  ;; already pass through unchanged, and app-local string properties only need a
  ;; stable key across Set/Get/Remove.
  (func $handle_RemovePropW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_RemovePropA
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; 614: CallWindowProcW — same ABI as CallWindowProcA
  (func $handle_CallWindowProcW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_CallWindowProcA
      (local.get $arg0)
      (local.get $arg1)
      (local.get $arg2)
      (local.get $arg3)
      (local.get $arg4)
      (local.get $name_ptr))
  )

  ;; Is ADDR one of the wndproc markers GetWindowLong/GetClassLong/GetClassInfo
  ;; hand out in place of a USER32 code address?
  (func $is_wndproc_marker (param $addr i32) (result i32)
    (i32.or
      (i32.ge_u (local.get $addr) (i32.const 0xFFFF0000))
      (i32.or
        (i32.eq (local.get $addr) (global.get $WNDPROC_BUILTIN))
        (i32.eq (i32.and (local.get $addr) (i32.const 0xFFFFFF00))
                (global.get $WNDPROC_SYSCLASS)))))

  ;; EIP landed on a wndproc marker: the guest `call`ed a saved "previous
  ;; wndproc" directly instead of going through CallWindowProc. On Windows that
  ;; value is a real USER32 entry point, so this is legal. Civilization II MGE
  ;; stores the stock control proc in its window extra bytes and does
  ;; `call [ebp-8]` with it on every message it does not handle itself.
  ;;
  ;; Stack on entry: [ret][hWnd][Msg][wParam][lParam]. Rewrite it into the
  ;; CallWindowProcA frame [ret][proc][hWnd][Msg][wParam][lParam] and run that
  ;; handler, whose marker paths return in EAX and pop all 24 bytes. Returns 1
  ;; when handled.
  (func $wndproc_marker_direct_call (result i32)
    (local $marker i32) (local $ret i32)
    (local.set $marker (global.get $eip))
    (if (i32.or (global.get $code16)
                (i32.eqz (call $is_wndproc_marker (local.get $marker))))
      (then (return (i32.const 0))))
    (local.set $ret (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $ret))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)) (local.get $marker))
    (global.set $handler_set_eip (i32.const 0))
    (call $handle_CallWindowProcA
      (local.get $marker)
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
      (i32.const 0))
    ;; A marker handler that entered guest code (a nested send) set EIP itself
    ;; and returns to $ret through the guest stack; otherwise return here.
    (if (i32.and (i32.eq (global.get $eip) (local.get $marker))
                 (i32.eqz (global.get $handler_set_eip)))
      (then (global.set $eip (local.get $ret))))
    (i32.const 1))

  ;; 793: CallWindowProcA — call a WndProc with (hwnd, msg, wParam, lParam)
  ;; Stack on entry: [ret][lpPrevWndFunc][hWnd][Msg][wParam][lParam]
  ;; We set up a call frame to the WndProc so it returns to our caller.
  (func $handle_CallWindowProcA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret_addr i32) (local $ctrl_class i32) (local $thunk_idx i32) (local $thunk_api i32)
    ;; NULL wndproc — route TreeView messages or return 0
    (if (i32.eqz (local.get $arg0))
      (then
        ;; Route TreeView messages (0x1100-0x1150) to WAT-native TreeView
        (if (i32.and (i32.ge_u (local.get $arg2) (i32.const 0x1100))
                     (i32.le_u (local.get $arg2) (i32.const 0x1150)))
          (then
            (i32.store offset=0 (global.get $reg_base) (call $treeview_dispatch
              (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4)))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
            (return)))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    ;; A native control's GWL_WNDPROC ($wndproc_public) is the native proc.
    (local.set $ctrl_class (call $wndproc_ctrl_kind (local.get $arg0)))
    (if (local.get $ctrl_class)
      (then
        (call $wndproc_adopt_ctrl_kind (local.get $arg1) (local.get $ctrl_class))
        (local.set $arg0 (global.get $WNDPROC_CTRL_NATIVE))))
    ;; A system class marker handed out by GetClassInfo. The app subclassed one
    ;; of USER's controls and is chaining back to it for default handling, so
    ;; this is where the control actually gets drawn and where it learns about
    ;; clicks, including WM_PAINT when the subclass requests native painting.
    ;;
    ;; The window was created under the app's own class name, so it is not in
    ;; the control table yet. Adopt it on the first chained call — the app has
    ;; just told us what it started life as, which is the only evidence we get.
    (if (i32.eq (i32.and (local.get $arg0) (i32.const 0xFFFFFF00))
                (global.get $WNDPROC_SYSCLASS))
      (then
        (local.set $ctrl_class (i32.and (local.get $arg0) (i32.const 0xFF)))
        (if (i32.eqz (call $ctrl_table_get_class (local.get $arg1)))
          (then
            (local.set $thunk_idx (call $wnd_table_find (local.get $arg1)))
            (if (i32.ne (local.get $thunk_idx) (i32.const -1))
              (then
                (call $ctrl_table_set (local.get $thunk_idx)
                  (local.get $ctrl_class)
                  (call $ctrl_table_get_id (local.get $arg1)))
                (call $sysclass_replay_create (local.get $arg1) (local.get $thunk_idx))))))
        (if (i32.ne (local.get $arg2) (i32.const 0x0081))
          (then
            ;; Pops the 24-byte frame itself, and turns a control's parent
            ;; notification into a tail call returning to our caller.
            (call $ctrl_dispatch_with_tail
              (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4)
              (i32.const 24))
            (return)))
        (i32.store offset=0 (global.get $reg_base) (call $control_wndproc_dispatch
          (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4)))
        ;; Every USER system-class default proc accepts WM_NCCREATE. The
        ;; control dispatcher has no state to create for that message and
        ;; historically returns zero; once CreateWindowEx began honoring the
        ;; documented rejection result, subclassed VB6 controls were therefore
        ;; torn down before WM_CREATE and Rodent 2000 reported "Out of memory".
        ;; Keep the adoption/dispatch side effects above, but return USER's
        ;; required creation result to the subclass that chained here.
        (if (i32.eq (local.get $arg2) (i32.const 0x0081))
          (then (i32.store offset=0 (global.get $reg_base) (i32.const 1))))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    ;; Sentinel 0xFFFE0001 = built-in control default wndproc.
    ;; Subclassed WAT controls chain here for stateful control messages such as
    ;; BM_SETIMAGE and WM_PAINT; the subclass, not the caller, decides whether
    ;; native painting is wanted.
    (if (i32.eq (local.get $arg0) (global.get $WNDPROC_BUILTIN))
      (then
        (local.set $ctrl_class (call $ctrl_table_get_class (local.get $arg1)))
        (if (i32.ne (local.get $ctrl_class) (i32.const 0))
          (then
            (call $ctrl_dispatch_with_tail
              (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4)
              (i32.const 24))
            (return)))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    ;; DefDlgProc marker returned by GWL_WNDPROC before a dialog is
    ;; subclassed. Execute the per-window DLGPROC and honor DWL_MSGRESULT.
    (if (i32.eq (local.get $arg0) (global.get $WNDPROC_DIALOG))
      (then
        ;; Remove CallWindowProc's extra lpPrevWndFunc argument, retaining
        ;; the subclass return address and the four dialog arguments. Use the
        ;; same default handling and modal-capable continuation as DefDlgProc;
        ;; a bounded recursive send abandons an open nested dialog's stack.
        (call $gs32
          (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))
          (i32.load (call $g2w (i32.load offset=16 (global.get $reg_base)))))
        (i32.store offset=16 (global.get $reg_base)
          (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $handle_DefDlgProcA
          (local.get $arg1) (local.get $arg2) (local.get $arg3)
          (local.get $arg4) (i32.const 0) (local.get $name_ptr))
        (return)))
    ;; WAT-native wndprocs (for current controls, 0xFFFF0002) are markers,
    ;; not guest-code addresses. Dispatch them directly instead of jumping.
    (if (i32.ge_u (local.get $arg0) (i32.const 0xFFFF0000))
      (then
        ;; Some subclass procs chain WM_PAINT only to let the native control
        ;; render. Our renderer paints WAT-native controls out of band, and
        ;; avoiding this chain keeps NSIS treeview paint from re-entering while
        ;; its dialog procedure is unwinding.
        ;;
        ;; But "out of band" stops being true the moment the app owns the
        ;; WNDPROC: $paint_drain_native_control_paints deliberately leaves a
        ;; subclassed control's WM_PAINT for the pump, precisely so the app's
        ;; proc runs. If that proc then chains here for the built-in look --
        ;; which is what $ctrl_is_subclassed documents as the way to get it --
        ;; swallowing the message means nobody paints at all. WinHelp's three
        ;; command buttons are stock "button" children subclassed to one shared
        ;; proc, and its whole button bar came out flat grey.
        (if (i32.and
              (i32.eq (local.get $arg2) (i32.const 0x000F))
              (i32.eqz (call $ctrl_is_subclassed (local.get $arg1))))
          (then
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
            (return)))
        (if (i32.eq (local.get $arg0) (global.get $WNDPROC_CTRL_NATIVE))
          (then
            ;; A subclass may chain the native WM_PAINT and then render its
            ;; owner-drawn face through GetDC instead of BeginPaint. The
            ;; native paint is still the background half of that paint cycle;
            ;; do not leave the creation erase queued for the pump to deliver
            ;; afterward over the child's pixels on our shared top-level
            ;; surface. Half-Life's bitmap buttons follow exactly this path.
            ;; MDICLIENT is the exception: it has no face, and its native
            ;; WM_PAINT exists to deliver that erase ($control_wndproc_dispatch).
            (if (i32.and (i32.eq (local.get $arg2) (i32.const 0x000F))
                         (i32.ne (call $ctrl_table_get_class (local.get $arg1)) (i32.const 33)))
              (then (call $nc_flags_clear (local.get $arg1) (i32.const 2))))
            (i32.store offset=0 (global.get $reg_base) (call $control_wndproc_dispatch
              (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4)))
            ;; A stock control subclass chains WM_NCCREATE through the native
            ;; marker before its WM_CREATE. The control dispatcher has no
            ;; per-class work for WM_NCCREATE and returns zero, but USER's
            ;; default control proc must accept creation. Returning that zero
            ;; makes CreateWindowEx tear down the new control. This is the same
            ;; contract as the WNDPROC_SYSCLASS marker above, including for a
            ;; class (such as ToolbarWindow32) routed native from creation.
            (if (i32.eq (local.get $arg2) (i32.const 0x0081))
              (then (i32.store offset=0 (global.get $reg_base) (i32.const 1)))))
          (else
            (i32.store offset=0 (global.get $reg_base) (call $wat_wndproc_dispatch
              (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4)))))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    ;; DefWindowProc import thunks are common saved "previous wndprocs" for
    ;; MFC subclasses. Dispatch them directly instead of recursively entering
    ;; the generic thunk path from inside CallWindowProc*.
    (if (thunk-contains (local.get $arg0))
      (then
        (local.set $thunk_idx
          (i32.div_u (i32.sub (local.get $arg0) (global.get $thunk_guest_base)) (i32.const 8)))
        (local.set $thunk_api
          (i32.load (i32.add
            (i32.add (global.get $THUNK_BASE) (i32.mul (local.get $thunk_idx) (i32.const 8)))
            (i32.const 4))))
        (if (i32.or (i32.eq (local.get $thunk_api) (i32.const 98))
                    (i32.eq (local.get $thunk_api) (i32.const 99)))
          (then
            ;; Skip lpPrevWndFunc; DefWindowProc's own stdcall cleanup then
            ;; consumes ret+hWnd+Msg+wParam+lParam = the full CallWindowProc
            ;; frame size.
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
            (if (i32.eq (local.get $thunk_api) (i32.const 98))
              (then
                (call $handle_DefWindowProcA
                  (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4)
                  (i32.const 0) (local.get $name_ptr)))
              (else
                (call $handle_DefWindowProcW
                  (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4)
                  (i32.const 0) (local.get $name_ptr))))
            (return)))))
    ;; If prevWndFunc is in thunk zone, dispatch inline (thunks can't be jumped to via EIP)
    (if (thunk-contains (local.get $arg0))
      (then
        ;; Current stack: [ret][prevFunc][hWnd][Msg][wParam][lParam]
        ;; WndProc thunk expects: [ret][hWnd][Msg][wParam][lParam]
        ;; Write ret over prevFunc slot, then advance ESP by 4
        (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))
          (call $gl32 (i32.load offset=16 (global.get $reg_base))))  ;; copy ret into prevFunc slot
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        ;; Now stack: [ret][hWnd][Msg][wParam][lParam] — correct for stdcall(4)
        ;; Dispatch the thunk directly
        (call $win32_dispatch (i32.div_u
          (i32.sub (local.get $arg0) (global.get $thunk_guest_base)) (i32.const 8)))
        (return)))
    ;; prevWndFunc is real x86 code — set up call frame and jump
    (local.set $ret_addr (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    ;; Clean CallWindowProcA stdcall frame: ret + 5 args = 24 bytes
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
    ;; Push WndProc args (stdcall order: lParam, wParam, Msg, hWnd)
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $arg4))   ;; lParam
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $arg3))   ;; wParam
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $arg2))   ;; Msg
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $arg1))   ;; hWnd
    ;; Push return address — WndProc returns directly to our caller
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $ret_addr))
    ;; Jump to WndProc
    (global.set $eip (local.get $arg0))
    (global.set $steps (i32.const 0))
  )

  ;; Deferred-window-position repositories. USER owns the opaque HDWP and the
  ;; WINDOWPOS array behind it; callers only receive a typed handle. Geometry
  ;; remains unchanged until EndDeferWindowPos walks the retained entries.
  ;;
  ;; HDWP record (8 x 24): handle, entries, count, capacity, common parent,
  ;; state (0=collecting, 1=End is applying it).
  ;; Entry (up to the 256-window USER table): hwnd, insert-after, x, y, cx,
  ;; cy, flags, padding.
  (global $HDWP_MAX i32 (i32.const 8))
  (global $HDWP_ENTRY_MAX i32 (i32.const 256))
  (global $hdwp_table (mut i32) (i32.const 0))
  (global $hdwp_next_handle (mut i32) (i32.const 0xDDF00001))

  (func $hdwp_table_ensure (result i32)
    (local $size i32)
    (if (i32.eqz (global.get $hdwp_table))
      (then
        (local.set $size (i32.mul (global.get $HDWP_MAX) (i32.const 24)))
        (global.set $hdwp_table (call $heap_alloc (local.get $size)))
        (if (global.get $hdwp_table)
          (then
            (call $zero_memory
              (call $g2w (global.get $hdwp_table)) (local.get $size))))))
    (global.get $hdwp_table))

  (func $hdwp_find (param $handle i32) (result i32)
    (local $i i32) (local $record i32)
    (if (i32.eqz (local.get $handle)) (then (return (i32.const 0))))
    (if (i32.eqz (global.get $hdwp_table)) (then (return (i32.const 0))))
    (block $missing (loop $scan
      (br_if $missing (i32.ge_u (local.get $i) (global.get $HDWP_MAX)))
      (local.set $record
        (i32.add (global.get $hdwp_table)
          (i32.mul (local.get $i) (i32.const 24))))
      (if (i32.eq (call $gl32 (local.get $record)) (local.get $handle))
        (then (return (local.get $record))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  (func $hdwp_release (param $record i32)
    (local $entries i32)
    (if (i32.eqz (local.get $record)) (then (return)))
    (local.set $entries
      (call $gl32 (i32.add (local.get $record) (i32.const 4))))
    (if (local.get $entries) (then (call $heap_free (local.get $entries))))
    (call $zero_memory (call $g2w (local.get $record)) (i32.const 24)))

  (func $hdwp_abort (param $record i32) (param $error i32)
    ;; Microsoft documents a failed DeferWindowPos as abandoning the entire
    ;; sequence. Reclaim it here so an application that correctly omits End
    ;; cannot exhaust the browser's bounded HDWP table.
    (call $hdwp_release (local.get $record))
    (global.set $last_error (local.get $error)))

  (func $hdwp_resize (param $record i32) (param $capacity i32) (result i32)
    (local $old i32) (local $fresh i32) (local $count i32) (local $fresh_wa i32)
    (local.set $fresh
      (call $heap_alloc (i32.mul (local.get $capacity) (i32.const 32))))
    (if (i32.eqz (local.get $fresh)) (then (return (i32.const 0))))
    (local.set $fresh_wa (call $g2w (local.get $fresh))) (call $zero_memory (local.get $fresh_wa)
      (i32.mul (local.get $capacity) (i32.const 32)))
    (local.set $old (call $gl32 (i32.add (local.get $record) (i32.const 4))))
    (local.set $count (call $gl32 (i32.add (local.get $record) (i32.const 8))))
    (if (local.get $old)
      (then
        (if (local.get $count)
          (then
            (memory.copy (local.get $fresh_wa) (call $g2w (local.get $old))
              (i32.mul (local.get $count) (i32.const 32)))))
        (call $heap_free (local.get $old))))
    (call $gs32 (i32.add (local.get $record) (i32.const 4)) (local.get $fresh))
    (call $gs32 (i32.add (local.get $record) (i32.const 12)) (local.get $capacity))
    (i32.const 1))

  (func $hdwp_ensure_capacity (param $record i32) (param $needed i32) (result i32)
    (local $capacity i32)
    (if (i32.gt_u (local.get $needed) (global.get $HDWP_ENTRY_MAX))
      (then (return (i32.const 0))))
    (local.set $capacity
      (call $gl32 (i32.add (local.get $record) (i32.const 12))))
    (if (i32.ge_u (local.get $capacity) (local.get $needed))
      (then (return (i32.const 1))))
    (if (i32.eqz (local.get $capacity))
      (then (local.set $capacity (i32.const 1))))
    (block $ready (loop $grow
      (br_if $ready (i32.ge_u (local.get $capacity) (local.get $needed)))
      (local.set $capacity (i32.mul (local.get $capacity) (i32.const 2)))
      (if (i32.gt_u (local.get $capacity) (global.get $HDWP_ENTRY_MAX))
        (then (local.set $capacity (global.get $HDWP_ENTRY_MAX))))
      (br $grow)))
    (call $hdwp_resize (local.get $record) (local.get $capacity)))

  ;; 632: BeginDeferWindowPos(nNumWindows) → HDWP handle
  (func $handle_BeginDeferWindowPos (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $i i32) (local $record i32) (local $capacity i32) (local $handle i32)
    (if (i32.lt_s (local.get $arg0) (i32.const 0))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (if (i32.gt_u (local.get $arg0) (global.get $HDWP_ENTRY_MAX))
      (then
        (global.set $last_error (i32.const 8)) ;; ERROR_NOT_ENOUGH_MEMORY
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (if (i32.eqz (call $hdwp_table_ensure))
      (then
        (global.set $last_error (i32.const 8))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (block $found (loop $scan
      (br_if $found (i32.ge_u (local.get $i) (global.get $HDWP_MAX)))
      (local.set $record
        (i32.add (global.get $hdwp_table) (i32.mul (local.get $i) (i32.const 24))))
      (if (i32.eqz (call $gl32 (local.get $record))) (then (br $found)))
      (local.set $record (i32.const 0))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (if (i32.eqz (local.get $record))
      (then
        (global.set $last_error (i32.const 8))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (local.set $capacity
      (select (local.get $arg0) (i32.const 1) (i32.ne (local.get $arg0) (i32.const 0))))
    (if (i32.eqz (call $hdwp_resize (local.get $record) (local.get $capacity)))
      (then
        (global.set $last_error (i32.const 8))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (local.set $handle (global.get $hdwp_next_handle))
    (global.set $hdwp_next_handle
      (i32.add (global.get $hdwp_next_handle) (i32.const 1)))
    (call $gs32 (local.get $record) (local.get $handle))
    (i32.store offset=0 (global.get $reg_base) (local.get $handle))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; 633: DeferWindowPos(hWinPosInfo, hWnd, hWndInsertAfter, x, y, cx, cy, uFlags) → HDWP
  (func $handle_DeferWindowPos (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $record i32) (local $entries i32) (local $entry i32)
    (local $count i32) (local $parent i32) (local $insert_slot i32)
    (local $cx i32) (local $cy i32) (local $flags i32)
    ;; arg0=hDWP, arg1=hWnd, arg2=hInsertAfter, arg3=x, arg4=y,
    ;; cx=stack[24], cy=stack[28], uFlags=stack[32].
    (local.set $cx (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (local.set $cy (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
    (local.set $flags (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32))))
    (local.set $record (call $hdwp_find (local.get $arg0)))
    (if (i32.eqz (local.get $record))
      (then
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36)))
        (return)))
    (if (call $gl32 (i32.add (local.get $record) (i32.const 20)))
      (then
        (global.set $last_error (i32.const 6))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36)))
        (return)))
    (if (i32.or
          (i32.eqz (local.get $arg1))
          (i32.lt_s (call $wnd_table_find (local.get $arg1)) (i32.const 0)))
      (then
        (call $hdwp_abort (local.get $record) (i32.const 1400)) ;; ERROR_INVALID_WINDOW_HANDLE
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36)))
        (return)))
    (local.set $parent (call $wnd_get_parent (local.get $arg1)))
    (local.set $count (call $gl32 (i32.add (local.get $record) (i32.const 8))))
    (if (i32.and
          (i32.ne (local.get $count) (i32.const 0))
          (i32.ne
            (call $gl32 (i32.add (local.get $record) (i32.const 16)))
            (local.get $parent)))
      (then
        (call $hdwp_abort (local.get $record) (i32.const 87))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36)))
        (return)))
    ;; A real sibling HWND is required for z-order insertion unless one of
    ;; USER's four sentinel values was supplied. SWP_NOZORDER ignores it.
    (if (i32.and
          (i32.eqz (i32.and (local.get $flags) (i32.const 4)))
          (i32.and
            (i32.ne (local.get $arg2) (i32.const 0))
            (i32.and
              (i32.ne (local.get $arg2) (i32.const 1))
              (i32.and
                (i32.ne (local.get $arg2) (i32.const -1))
                (i32.ne (local.get $arg2) (i32.const -2))))))
      (then
        (local.set $insert_slot (call $wnd_table_find (local.get $arg2)))
        (if (i32.or
              (i32.lt_s (local.get $insert_slot) (i32.const 0))
              (i32.ne (call $wnd_get_parent (local.get $arg2)) (local.get $parent)))
          (then
            (call $hdwp_abort (local.get $record) (i32.const 1400))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36)))
            (return)))))
    (if (i32.eqz (call $hdwp_ensure_capacity
          (local.get $record) (i32.add (local.get $count) (i32.const 1))))
      (then
        (call $hdwp_abort (local.get $record) (i32.const 8))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36)))
        (return)))
    (local.set $entries (call $gl32 (i32.add (local.get $record) (i32.const 4))))
    (local.set $entry
      (i32.add (local.get $entries) (i32.mul (local.get $count) (i32.const 32))))
    (call $gs32 (local.get $entry) (local.get $arg1))
    (call $gs32 (i32.add (local.get $entry) (i32.const 4)) (local.get $arg2))
    (call $gs32 (i32.add (local.get $entry) (i32.const 8)) (local.get $arg3))
    (call $gs32 (i32.add (local.get $entry) (i32.const 12)) (local.get $arg4))
    (call $gs32 (i32.add (local.get $entry) (i32.const 16)) (local.get $cx))
    (call $gs32 (i32.add (local.get $entry) (i32.const 20)) (local.get $cy))
    (call $gs32 (i32.add (local.get $entry) (i32.const 24)) (local.get $flags))
    (call $gs32 (i32.add (local.get $record) (i32.const 8))
      (i32.add (local.get $count) (i32.const 1)))
    (if (i32.eqz (local.get $count))
      (then
        (call $gs32 (i32.add (local.get $record) (i32.const 16)) (local.get $parent))))
    (i32.store offset=0 (global.get $reg_base) (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36)))  ;; stdcall, 8 args
  )

  ;; Validate and claim a batch without changing the caller's CPU frame.
  ;; The Win32 and Win16 commit loops can then use their own callback ABI.
  ;; Returns the claimed record, or zero; failures retain their existing
  ;; abort/last-error behavior, while a busy batch is never released.
  (func $hdwp_prepare_end (param $handle i32) (result i32)
    (local $record i32) (local $entries i32) (local $entry i32)
    (local $count i32) (local $i i32)
    (local $hwnd i32) (local $after i32) (local $flags i32) (local $parent i32)
    (local.set $record (call $hdwp_find (local.get $handle)))
    (if (i32.eqz (local.get $record))
      (then
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (return (i32.const 0))))
    (if (call $gl32 (i32.add (local.get $record) (i32.const 20)))
      (then
        ;; A guest wndproc re-entering End with the handle currently being
        ;; applied must not double-apply or free the outer operation.
        (global.set $last_error (i32.const 6))
        (return (i32.const 0))))
    (local.set $entries (call $gl32 (i32.add (local.get $record) (i32.const 4))))
    (local.set $count (call $gl32 (i32.add (local.get $record) (i32.const 8))))
    (local.set $parent (call $gl32 (i32.add (local.get $record) (i32.const 16))))
    ;; Validate the complete set before committing the first operation. A
    ;; window destroyed/reparented between Defer and End, or a stale sibling
    ;; insertion target, fails the sequence atomically.
    (block $valid (loop $validate
      (br_if $valid (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $entry
        (i32.add (local.get $entries) (i32.mul (local.get $i) (i32.const 32))))
      (local.set $hwnd (call $gl32 (local.get $entry)))
      (local.set $after (call $gl32 (i32.add (local.get $entry) (i32.const 4))))
      (local.set $flags (call $gl32 (i32.add (local.get $entry) (i32.const 24))))
      (if (i32.or
            (i32.eqz (local.get $hwnd))
            (i32.lt_s (call $wnd_table_find (local.get $hwnd)) (i32.const 0)))
        (then
          (call $hdwp_abort (local.get $record) (i32.const 1400))
          (return (i32.const 0))))
      (if (i32.ne (call $wnd_get_parent (local.get $hwnd)) (local.get $parent))
        (then
          (call $hdwp_abort (local.get $record) (i32.const 87))
          (return (i32.const 0))))
      (if (i32.and
            (i32.eqz (i32.and (local.get $flags) (i32.const 4)))
            (i32.and
              (i32.ne (local.get $after) (i32.const 0))
              (i32.and
                (i32.ne (local.get $after) (i32.const 1))
                (i32.and
                  (i32.ne (local.get $after) (i32.const -1))
                  (i32.ne (local.get $after) (i32.const -2))))))
        (then
          (if (i32.or
                (i32.lt_s (call $wnd_table_find (local.get $after)) (i32.const 0))
                (i32.ne (call $wnd_get_parent (local.get $after)) (local.get $parent)))
            (then
              (call $hdwp_abort (local.get $record) (i32.const 1400))
              (return (i32.const 0))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $validate)))
    (call $gs32 (i32.add (local.get $record) (i32.const 20)) (i32.const 1))
    (local.get $record))

  ;; 631: EndDeferWindowPos(hWinPosInfo) → BOOL
  (func $handle_EndDeferWindowPos (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $record i32) (local $entries i32) (local $entry i32)
    (local $count i32) (local $i i32) (local $saved_esp i32)
    (local.set $record (call $hdwp_prepare_end (local.get $arg0)))
    (if (i32.eqz (local.get $record))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (local.set $entries (call $gl32 (i32.add (local.get $record) (i32.const 4))))
    (local.set $count (call $gl32 (i32.add (local.get $record) (i32.const 8))))
    (local.set $saved_esp (i32.load offset=16 (global.get $reg_base)))
    (local.set $i (i32.const 0))
    (block $done (loop $apply
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $entry
        (i32.add (local.get $entries) (i32.mul (local.get $i) (i32.const 32))))
      ;; Reuse the one SetWindowPos implementation so deferred changes retain
      ;; its CLIENT_RECT, visibility, WM_WINDOWPOSCHANGED, WM_MOVE/WM_SIZE and
      ;; paint behavior. The temporary 7-argument frame lives below End's.
      (i32.store offset=16 (global.get $reg_base) (i32.sub (local.get $saved_esp) (i32.const 32)))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))
        (call $gl32 (i32.add (local.get $entry) (i32.const 20))))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))
        (call $gl32 (i32.add (local.get $entry) (i32.const 24))))
      (call $handle_SetWindowPos
        (call $gl32 (local.get $entry))
        (call $gl32 (i32.add (local.get $entry) (i32.const 4)))
        (call $gl32 (i32.add (local.get $entry) (i32.const 8)))
        (call $gl32 (i32.add (local.get $entry) (i32.const 12)))
        (call $gl32 (i32.add (local.get $entry) (i32.const 16)))
        (i32.const 0))
      (i32.store offset=16 (global.get $reg_base) (local.get $saved_esp))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $apply)))
    (call $hdwp_release (local.get $record))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; 615: GetPropW(hwnd, lpString) -> HANDLE
  (func $handle_GetPropW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_GetPropA
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; 616: SetPropW(hwnd, lpString, hData) -> BOOL
  (func $handle_SetPropW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_SetPropA
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; 617: GetWindowTextLengthW(hwnd) → length in characters. A title's length
  ;; in characters does not depend on the encoding it is asked for, and the
  ;; conversion on either side of this emulator is one byte per character, so
  ;; this is the A answer exactly.
  (func $handle_GetWindowTextLengthW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_GetWindowTextLengthA (local.get $arg0) (local.get $arg1)
      (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; 618: SetWindowPlacement(hWnd, lpwndpl) — 2 args stdcall
  ;; WINDOWPLACEMENT: length(0), flags(4), showCmd(8), ptMin(12,16), ptMax(20,24), rcNormal(28: left,top,right,bottom)
  (func $handle_SetWindowPlacement (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32) (local $left i32) (local $top i32) (local $right i32) (local $bottom i32)
    (local $show i32)
    (local.set $wa (call $g2w (local.get $arg1)))
    ;; Read rcNormalPosition from WINDOWPLACEMENT at offset 28
    (local.set $left   (i32.load offset=28 (local.get $wa)))
    (local.set $top    (i32.load offset=32 (local.get $wa)))
    (local.set $right  (i32.load offset=36 (local.get $wa)))
    (local.set $bottom (i32.load offset=40 (local.get $wa)))
    ;; Move window to rcNormalPosition
    (call $host_move_window (local.get $arg0) (local.get $left) (local.get $top)
      (i32.sub (local.get $right) (local.get $left))
      (i32.sub (local.get $bottom) (local.get $top))
      (i32.const 0))
    ;; showCmd used to be read and dropped, so an app that saved "I was
    ;; maximized" and set the placement back at startup got its normal rect and
    ;; nothing else.
    (local.set $show (i32.load offset=8 (local.get $wa)))
    ;; Windows applies showCmd the way ShowWindow does (Wine: WINPOS_SetPlacement
    ;; ends in ShowWindow(hwnd, showCmd)), so a hidden window given anything but
    ;; SW_HIDE comes on screen here. WinBoard never calls ShowWindow on its main
    ;; window: it creates it hidden, sizes the board, and shows it with
    ;; SetWindowPlacement(SW_SHOWNORMAL) -- treating that as "not yet shown"
    ;; left its whole board drawn into an invisible window. Same arity as
    ;; ShowWindow, so its handler completes this call.
    (if (i32.and
          (i32.eqz (i32.and (call $wnd_get_style (local.get $arg0)) (i32.const 0x10000000)))
          (i32.ne (local.get $show) (i32.const 0)))
      (then
        (call $handle_ShowWindow (local.get $arg0) (local.get $show)
          (i32.const 0) (i32.const 0) (i32.const 0) (local.get $name_ptr))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))
        (return)))
    ;; A window already on screen: only a command that changes the min/max
    ;; state needs forwarding.
    (if (i32.or (i32.eq (local.get $show) (i32.const 1))
          (i32.or (i32.eq (local.get $show) (i32.const 2))
            (i32.or (i32.eq (local.get $show) (i32.const 3))
                    (i32.eq (local.get $show) (i32.const 9)))))
      (then
        (if (i32.or
              (i32.ne (i32.eq (local.get $show) (i32.const 2))
                      (call $wnd_min_get (local.get $arg0)))
              (i32.ne (i32.eq (local.get $show) (i32.const 3))
                      (call $wnd_max_get (local.get $arg0))))
          (then
            ;; SetWindowPlacement may be the first call that shows a restored
            ;; maximized/minimized window. Keep USER's GWL_STYLE visibility in
            ;; sync with the renderer: otherwise the frame is on screen but
            ;; WM_PAINT skips its tree/list/status children as hidden.
            (drop (call $wnd_set_style (local.get $arg0)
              (i32.or (call $wnd_get_style (local.get $arg0))
                      (i32.const 0x10000000))))
            (drop (call $host_show_window (local.get $arg0) (local.get $show)))
            (call $wnd_apply_show_state (local.get $arg0) (local.get $show))
            ;; The host changed the frame size. Tell the application so it can
            ;; MoveWindow its children; Regedit otherwise keeps a 234px tree
            ;; beneath a 670px maximized parent on a phone.
            (if (i32.ne (local.get $show) (i32.const 2)) ;; not minimized
              (then
                (call $post_resize_messages (local.get $arg0)
                  (select (i32.const 2) (i32.const 0)
                    (i32.eq (local.get $show) (i32.const 3))))
                (call $paint_mark_visible_tree (local.get $arg0))))))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))  ;; stdcall, 2 args
  )

GetTopWindow(hWnd) — 1 arg stdcall
  (func $handle_GetTopWindow (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $wnd_find_first_child (local.get $arg0)))
    (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
      (then (i32.store offset=0 (global.get $reg_base) (call $host_get_window_related (local.get $arg0) (i32.const 5)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; Which of a window's two bar records nBar names. SB_HORZ (0) and SB_VERT
  ;; (1) say so; SB_CTL (2) is the scrollbar control's own bar, horizontal or
  ;; vertical by its SBS_VERT style bit -- the record its wndproc paints from.
  ;; Treating SB_CTL as "not SB_HORZ" put every horizontal control's range and
  ;; position in the vertical record, so it drew no thumb and ignored the
  ;; app's SetScrollPos (Civilization II's tax-rate sliders).
  (func $scroll_bar_is_vert (param $hwnd i32) (param $bar i32) (result i32)
    (if (i32.eq (local.get $bar) (i32.const 2))
      (then (return (i32.ne (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 1))
                            (i32.const 0)))))
    (i32.ne (local.get $bar) (i32.const 0)))

  ;; 623: SetScrollPos(hwnd, nBar, nPos, bRedraw) → old pos
  (func $handle_SetScrollPos (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $slot i32) (local $base i32) (local $old i32)
    (local.set $slot (call $wnd_table_find (local.get $arg0)))
    (if (i32.ge_s (local.get $slot) (i32.const 0))
      (then
        (local.set $base (call $scroll_bar_addr (local.get $slot)
          (call $scroll_bar_is_vert (local.get $arg0) (local.get $arg1))))
        (local.set $old (i32.load (local.get $base)))
        (i32.store (local.get $base) (local.get $arg2))
        ;; A control bar repaints itself when asked to (bRedraw), as
        ;; SetScrollInfo does; the thumb would otherwise stay where it was.
        (if (i32.and (i32.eq (local.get $arg1) (i32.const 2))
                     (i32.ne (local.get $arg3) (i32.const 0)))
          (then (call $invalidate_hwnd (local.get $arg0))))
        (i32.store offset=0 (global.get $reg_base) (local.get $old)))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; 624: GetScrollPos(hwnd, nBar) → pos
  (func $handle_GetScrollPos (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $slot i32) (local $base i32)
    (local.set $slot (call $wnd_table_find (local.get $arg0)))
    (if (i32.ge_s (local.get $slot) (i32.const 0))
      (then
        (local.set $base (call $scroll_bar_addr (local.get $slot)
          (call $scroll_bar_is_vert (local.get $arg0) (local.get $arg1))))
        (i32.store offset=0 (global.get $reg_base) (i32.load (local.get $base))))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; 625: SetScrollRange(hwnd, nBar, nMinPos, nMaxPos, bRedraw) → BOOL
  (func $handle_SetScrollRange (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $slot i32) (local $base i32)
    (local.set $slot (call $wnd_table_find (local.get $arg0)))
    (if (i32.ge_s (local.get $slot) (i32.const 0))
      (then
        (local.set $base (call $scroll_bar_addr (local.get $slot)
          (call $scroll_bar_is_vert (local.get $arg0) (local.get $arg1))))
        (i32.store offset=4 (local.get $base) (local.get $arg2))
        (i32.store offset=8 (local.get $base) (local.get $arg3))
        (if (i32.and (i32.eq (local.get $arg1) (i32.const 2))
                     (i32.ne (local.get $arg4) (i32.const 0)))
          (then (call $invalidate_hwnd (local.get $arg0))))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  ;; 626: GetScrollRange(hwnd, nBar, lpMinPos, lpMaxPos) → BOOL
  (func $handle_GetScrollRange (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $slot i32) (local $base i32) (local $wmin i32) (local $wmax i32)
    (local.set $slot (call $wnd_table_find (local.get $arg0)))
    (if (i32.ge_s (local.get $slot) (i32.const 0))
      (then
        (local.set $base (call $scroll_bar_addr (local.get $slot)
          (call $scroll_bar_is_vert (local.get $arg0) (local.get $arg1))))
        (local.set $wmin (i32.load offset=4 (local.get $base)))
        (local.set $wmax (i32.load offset=8 (local.get $base)))))
    (if (local.get $arg2)
      (then (i32.store (call $g2w (local.get $arg2)) (local.get $wmin))))
    (if (local.get $arg3)
      (then (i32.store (call $g2w (local.get $arg3)) (local.get $wmax))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; Apply ShowScrollBar to a standard non-client bar or to a scrollbar
  ;; control. The stored style is the source of truth for client layout,
  ;; hit-testing, painting, and GetWindowLong.
  (func $show_scroll_bar_core (param $hwnd i32) (param $bar i32) (param $show i32) (result i32)
    (local $style i32) (local $new_style i32) (local $bar_bits i32)
    (if (i32.lt_s (call $wnd_table_find (local.get $hwnd)) (i32.const 0))
      (then (return (i32.const 0))))
    (local.set $style (call $wnd_get_style (local.get $hwnd)))

    ;; SB_CTL = 2: show or hide the scrollbar control window itself.
    (if (i32.eq (local.get $bar) (i32.const 2))
      (then
        (local.set $new_style
          (if (result i32) (i32.ne (local.get $show) (i32.const 0))
            (then (i32.or (local.get $style) (i32.const 0x10000000)))
            (else (i32.and (local.get $style) (i32.const 0xEFFFFFFF)))))
        (if (i32.ne (local.get $new_style) (local.get $style))
          (then
            (if (local.get $show)
              (then
                (drop (call $host_show_window (local.get $hwnd) (i32.const 5))) ;; SW_SHOW
                (drop (call $wnd_set_style (local.get $hwnd) (local.get $new_style)))
                (call $nc_flags_set (local.get $hwnd) (i32.const 2)))
              (else
                (call $wnd_uncover_parent (local.get $hwnd))
                (drop (call $host_show_window (local.get $hwnd) (i32.const 0))) ;; SW_HIDE
                (drop (call $wnd_set_style (local.get $hwnd) (local.get $new_style)))
                (call $paint_clear_subtree (local.get $hwnd))))))
        (return (i32.const 1))))

    ;; SB_HORZ = 0, SB_VERT = 1, SB_BOTH = 3.
    (if (i32.eq (local.get $bar) (i32.const 0))
      (then (local.set $bar_bits (i32.const 0x00100000)))
      (else
        (if (i32.eq (local.get $bar) (i32.const 1))
          (then (local.set $bar_bits (i32.const 0x00200000)))
          (else
            (if (i32.eq (local.get $bar) (i32.const 3))
              (then (local.set $bar_bits (i32.const 0x00300000)))
              (else (return (i32.const 0))))))))
    (local.set $new_style
      (if (result i32) (i32.ne (local.get $show) (i32.const 0))
        (then (i32.or (local.get $style) (local.get $bar_bits)))
        (else (i32.and (local.get $style) (i32.xor (local.get $bar_bits) (i32.const -1))))))
    (if (i32.ne (local.get $new_style) (local.get $style))
      (then
        (drop (call $wnd_set_style (local.get $hwnd) (local.get $new_style)))
        (call $defwndproc_do_nccalcsize (local.get $hwnd))
        (call $host_sync_window_client
          (local.get $hwnd)
          (call $wnd_client_screen_x (local.get $hwnd))
          (call $wnd_client_screen_y (local.get $hwnd))
          (i32.sub (call $client_rect_get_r (local.get $hwnd))
                   (call $client_rect_get_l (local.get $hwnd)))
          (i32.sub (call $client_rect_get_b (local.get $hwnd))
                   (call $client_rect_get_t (local.get $hwnd))))
        (if (call $wnd_is_effectively_visible (local.get $hwnd))
          (then
            (call $defwndproc_do_ncpaint (local.get $hwnd))
            (call $nc_flags_set (local.get $hwnd) (i32.const 1))))))
    (i32.const 1))

  ;; 627: ShowScrollBar(hwnd, wBar, bShow) → BOOL
  (func $handle_ShowScrollBar (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $show_scroll_bar_core
      (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; 628: SetScrollInfo(hwnd, nBar, lpsi, bRedraw) → pos
  (func $handle_SetScrollInfo (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $slot i32) (local $base i32) (local $aux i32) (local $lpsi i32) (local $fMask i32)
    (local $smin i32) (local $smax i32) (local $page i32) (local $pos i32) (local $max_pos i32)
    (local $style i32) (local $new_style i32) (local $bar_bit i32)
    (local $is_ctl i32) (local $vert i32) (local $scrollable i32) (local $arrows_changed i32)
    (local.set $slot (call $wnd_table_find (local.get $arg0)))
    (local.set $lpsi (call $g2w (local.get $arg2)))
    (local.set $fMask (i32.load offset=4 (local.get $lpsi)))
    (if (i32.ge_s (local.get $slot) (i32.const 0))
      (then
        (local.set $is_ctl (i32.eq (local.get $arg1) (i32.const 2)))
        (local.set $vert
          (if (result i32) (local.get $is_ctl)
            (then
              (i32.ne
                (i32.and (call $wnd_get_style (local.get $arg0)) (i32.const 1))
                (i32.const 0)))
            (else (i32.eq (local.get $arg1) (i32.const 1)))))
        (local.set $base (call $scroll_bar_addr (local.get $slot)
          (local.get $vert)))
        (local.set $aux (call $scroll_aux_bar_addr (local.get $slot)
          (local.get $vert)))
        ;; SIF_RANGE = 0x01
        (if (i32.and (local.get $fMask) (i32.const 1))
          (then
            (i32.store offset=4 (local.get $base) (i32.load offset=8 (local.get $lpsi)))
            (i32.store offset=8 (local.get $base) (i32.load offset=12 (local.get $lpsi)))))
        ;; SIF_PAGE = 0x02
        (if (i32.and (local.get $fMask) (i32.const 2))
          (then
            (i32.store (local.get $aux) (i32.load offset=16 (local.get $lpsi)))))
        ;; SIF_POS = 0x04
        (if (i32.and (local.get $fMask) (i32.const 4))
          (then
            (i32.store (local.get $base) (i32.load offset=20 (local.get $lpsi)))))
        ;; SIF_TRACKPOS = 0x10. Real SetScrollInfo does not make the thumb
        ;; position from nTrackPos, but preserving it lets later GetScrollInfo
        ;; calls see coherent state.
        (if (i32.and (local.get $fMask) (i32.const 16))
          (then
            (i32.store offset=4 (local.get $aux) (i32.load offset=24 (local.get $lpsi)))))
        ;; Clamp the stored position to the Win32 scrollbar range. With a page
        ;; size, the largest useful position is nMax - max(nPage - 1, 0).
        (local.set $smin (i32.load offset=4 (local.get $base)))
        (local.set $smax (i32.load offset=8 (local.get $base)))
        (local.set $page (i32.load (local.get $aux)))
        (local.set $max_pos (local.get $smax))
        (if (i32.gt_u (local.get $page) (i32.const 1))
          (then
            (local.set $max_pos
              (if (result i32)
                (i32.gt_s
                  (i32.sub (local.get $smax) (i32.sub (local.get $page) (i32.const 1)))
                  (local.get $smin))
                (then (i32.sub (local.get $smax) (i32.sub (local.get $page) (i32.const 1))))
                (else (local.get $smin))))))
        (local.set $pos (i32.load (local.get $base)))
        (if (i32.lt_s (local.get $pos) (local.get $smin))
          (then (local.set $pos (local.get $smin))))
        (if (i32.gt_s (local.get $pos) (local.get $max_pos))
          (then (local.set $pos (local.get $max_pos))))
        (i32.store (local.get $base) (local.get $pos))
        ;; A page that covers the inclusive range makes the bar unnecessary.
        ;; SIF_DISABLENOSCROLL (0x08) keeps it present and disables both
        ;; arrows; when it becomes useful again the same flag re-enables them.
        ;; A SCROLLBAR control owns its visibility, so only its arrow state is
        ;; changed here — SB_CTL must never synthesize WS_VSCROLL on the child.
        (local.set $scrollable
          (i32.and
            (i32.gt_s (local.get $smax) (local.get $smin))
            (i32.or
              (i32.eqz (local.get $page))
              (i32.lt_u (local.get $page)
                (i32.add (i32.sub (local.get $smax) (local.get $smin)) (i32.const 1))))))
        (if (i32.and (local.get $fMask) (i32.const 8))
          (then
            (local.set $arrows_changed (call $scroll_arrow_set_slot
              (local.get $slot) (local.get $vert)
              (select (i32.const 0) (i32.const 3) (local.get $scrollable))))))
        (local.set $style (call $wnd_get_style (local.get $arg0)))
        (local.set $new_style (local.get $style))
        (if (i32.eqz (local.get $is_ctl))
          (then
            (local.set $bar_bit
              (select (i32.const 0x00200000) (i32.const 0x00100000) (local.get $vert)))
            (if (local.get $scrollable)
              (then (local.set $new_style (i32.or (local.get $style) (local.get $bar_bit))))
              (else
                (if (i32.and (local.get $fMask) (i32.const 8))
                  (then (local.set $new_style (i32.or (local.get $style) (local.get $bar_bit))))
                  (else (local.set $new_style
                    (i32.and (local.get $style)
                      (i32.xor (local.get $bar_bit) (i32.const -1))))))))))
        (if (i32.and
              (i32.eqz (local.get $is_ctl))
              (i32.ne (local.get $new_style) (local.get $style)))
          (then
            (drop (call $wnd_set_style (local.get $arg0) (local.get $new_style)))
            (call $defwndproc_do_nccalcsize (local.get $arg0))
            (call $host_sync_window_client
              (local.get $arg0)
              (call $wnd_client_screen_x (local.get $arg0))
              (call $wnd_client_screen_y (local.get $arg0))
              (i32.sub (call $client_rect_get_r (local.get $arg0)) (call $client_rect_get_l (local.get $arg0)))
              (i32.sub (call $client_rect_get_b (local.get $arg0)) (call $client_rect_get_t (local.get $arg0))))))
        (if (i32.or
              (i32.ne (local.get $arg3) (i32.const 0))
              (i32.or
                (local.get $arrows_changed)
                (i32.ne (local.get $new_style) (local.get $style))))
          (then
            (if (local.get $is_ctl)
              (then (call $invalidate_hwnd (local.get $arg0)))
              (else
                (call $defwndproc_do_ncpaint (local.get $arg0))
                ;; Leave the non-client area dirty. Children share their
                ;; parent's back-canvas, so a client paint immediately after
                ;; this call can cover the bar until the pump restores it.
                (call $nc_flags_set (local.get $arg0) (i32.const 1))))))
        (i32.store offset=0 (global.get $reg_base) (i32.load (local.get $base))))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; 629: GetScrollInfo(hwnd, nBar, lpsi) → BOOL
  (func $handle_GetScrollInfo (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $slot i32) (local $base i32) (local $aux i32) (local $lpsi i32) (local $fMask i32)
    (local.set $slot (call $wnd_table_find (local.get $arg0)))
    (local.set $lpsi (call $g2w (local.get $arg2)))
    (local.set $fMask (i32.load offset=4 (local.get $lpsi)))
    (if (i32.ge_s (local.get $slot) (i32.const 0))
      (then
        (local.set $base (call $scroll_bar_addr (local.get $slot)
          (call $scroll_bar_is_vert (local.get $arg0) (local.get $arg1))))
        (local.set $aux (call $scroll_aux_bar_addr (local.get $slot)
          (i32.ne (local.get $arg1) (i32.const 0))))
        ;; SIF_RANGE = 0x01
        (if (i32.and (local.get $fMask) (i32.const 1))
          (then
            (i32.store offset=8 (local.get $lpsi) (i32.load offset=4 (local.get $base)))
            (i32.store offset=12 (local.get $lpsi) (i32.load offset=8 (local.get $base)))))
        ;; SIF_POS = 0x04
        (if (i32.and (local.get $fMask) (i32.const 4))
          (then
            (i32.store offset=20 (local.get $lpsi) (i32.load (local.get $base)))))
        ;; SIF_PAGE = 0x02
        (if (i32.and (local.get $fMask) (i32.const 2))
          (then
            (i32.store offset=16 (local.get $lpsi) (i32.load (local.get $aux)))))
        ;; SIF_TRACKPOS = 0x10
        (if (i32.and (local.get $fMask) (i32.const 16))
          (then
            (i32.store offset=24 (local.get $lpsi) (i32.load offset=4 (local.get $aux)))))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1)))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; 630: ScrollWindow(hWnd, XAmount, YAmount, lpRect, lpClipRect)
  ;; Host scrolls the target client backing-store rectangle by the requested
  ;; delta and fills exposed strips. lpRect/lpClipRect are client-relative and
  ;; are clipped/intersected host-side.
  (func $handle_ScrollWindow (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $gdi_native_scroll_window
        (local.get $arg0) (local.get $arg1) (local.get $arg2)
        (local.get $arg3) (local.get $arg4)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  ;; 634: AdjustWindowRectEx(lpRect, dwStyle, bMenu, dwExStyle) — 4 args stdcall
  ;; Same as AdjustWindowRect but with extended style (ignored for now)
  (func $handle_AdjustWindowRectEx (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32) (local $border i32) (local $caption i32) (local $frame i32)
    ;; Match the existing non-client fixed/sizing frame. Bottom chrome keeps
    ;; its established four-pixel extent; only side/top frame varies.
    (local.set $frame
      (select (call $defwndproc_style_frame_width (local.get $arg1)) (i32.const 4)
        (i32.eq (i32.and (local.get $arg1) (i32.const 0x00C00000)) (i32.const 0x00C00000))))
    (local.set $wa (call $g2w (local.get $arg0)))
    ;; border (1px) when WS_BORDER|WS_DLGFRAME|WS_THICKFRAME present
    (local.set $border (i32.ne (i32.and (local.get $arg1) (i32.const 0x00CC0000)) (i32.const 0)))
    ;; caption (chrome 20px) only with WS_CAPTION (which == DLGFRAME|BORDER)
    (local.set $caption (i32.eq (i32.and (local.get $arg1) (i32.const 0x00C00000)) (i32.const 0x00C00000)))
    ;; A child with a border and no caption gets a 1px frame: the rule
    ;; $defwndproc_do_nccalcsize applies. MFC places a view at
    ;; AdjustWindowRectEx(WS_BORDER) outside its frame's client. With 4px here
    ;; and 1px there, SimCity 2000's map view sat 3px too far up and left, and
    ;; its scrollbars were painted into the MDI child's frame.
    (if (i32.and
          (i32.ne (i32.and (local.get $arg1) (i32.const 0x40000000)) (i32.const 0))
          (i32.and (local.get $border) (i32.eqz (local.get $caption))))
      (then
        (local.set $border (i32.const 0))
        (store.field Rect left (local.get $wa) (i32.sub (load.field Rect left (local.get $wa)) (i32.const 1)))
        (store.field.memarg Rect top (local.get $wa) (i32.sub (load.field.memarg Rect top (local.get $wa)) (i32.const 1)))
        (store.field.memarg Rect right (local.get $wa) (i32.add (load.field.memarg Rect right (local.get $wa)) (i32.const 1)))
        (store.field.memarg Rect bottom (local.get $wa) (i32.add (load.field.memarg Rect bottom (local.get $wa)) (i32.const 1)))))
    (if (i32.or (local.get $border) (local.get $caption)) (then
      (store.field Rect left (local.get $wa) (i32.sub (load.field Rect left (local.get $wa)) (local.get $frame)))
      (store.field.memarg Rect top (local.get $wa)
        (i32.sub (load.field.memarg Rect top (local.get $wa))
          (i32.add (local.get $frame)
            (i32.add (select (i32.const 20) (i32.const 0) (local.get $caption))
                     (select (i32.const 18) (i32.const 0) (local.get $arg2))))))
      (store.field.memarg Rect right (local.get $wa) (i32.add (load.field.memarg Rect right (local.get $wa)) (local.get $frame)))
      (store.field.memarg Rect bottom (local.get $wa) (i32.add (load.field.memarg Rect bottom (local.get $wa)) (i32.const 4)))
    ))
    ;; WS_EX_CLIENTEDGE sinks the client two pixels on every side, and
    ;; $defwndproc_do_nccalcsize takes those two pixels back out. The two have
    ;; to agree: an app that sizes its window through this call and then lays
    ;; itself out inside GetClientRect gets four pixels less than it asked for
    ;; when they do not. Solitaire is exactly that app -- it asks for the width
    ;; seven card columns need, is handed four pixels less, decides the window
    ;; is too narrow to lay out at all, and leaves every pile at the origin.
    (if (i32.and (local.get $arg3) (i32.const 0x00000200)) (then
      (store.field Rect left (local.get $wa) (i32.sub (load.field Rect left (local.get $wa)) (i32.const 2)))
      (store.field.memarg Rect top (local.get $wa) (i32.sub (load.field.memarg Rect top (local.get $wa)) (i32.const 2)))
      (store.field.memarg Rect right (local.get $wa) (i32.add (load.field.memarg Rect right (local.get $wa)) (i32.const 2)))
      (store.field.memarg Rect bottom (local.get $wa) (i32.add (load.field.memarg Rect bottom (local.get $wa)) (i32.const 2)))
    ))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))  ;; stdcall, 4 args
  )

  ;; DispatchMessageW — see the note on $handle_GetMessageW. The parallel copy
  ;; did not know about the native status bar or tab control, so a W app with
  ;; either one silently lost their messages.
  (func $handle_DispatchMessageW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_DispatchMessageA (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; PeekMessageW — see the note on $handle_GetMessageW. The A version was
  ;; missing twenty-two things this one does, timers and the post queue among
  ;; them.
  (func $handle_PeekMessageW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_PeekMessageA (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; 637: SendDlgItemMessageW — routing and stack layout are identical to A,
  ;; and the message payload is opaque here: the control that receives it is
  ;; what interprets the buffer. Same treatment SendMessageW gets.
  (func $handle_SendDlgItemMessageW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_SendDlgItemMessageA (local.get $arg0) (local.get $arg1)
      (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; 638: LoadAcceleratorsW. Integer identifiers share the A path; named
  ;; resources select the UTF-16 resource-directory comparator.
  (func $handle_LoadAcceleratorsW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $data i32)
    (call $push_rsrc_ctx (local.get $arg0))
    (global.set $rsrc_name_char_stride (i32.const 2))
    (local.set $data (call $rsrc_find_data_wa (i32.const 9) (local.get $arg1)))
    (global.set $rsrc_name_char_stride (i32.const 1))
    (call $pop_rsrc_ctx)
    (i32.store offset=0 (global.get $reg_base) (call $accel_table_load
      (local.get $data) (i32.div_u (global.get $rsrc_last_size) (i32.const 8))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 639: TranslateAcceleratorW — identical behaviour to A (MSG layout is the same).
  (func $handle_TranslateAcceleratorW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_TranslateAcceleratorA
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; 640: IsWindowEnabled
  (func $handle_IsWindowEnabled (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eq (call $wnd_table_find (local.get $arg0)) (i32.const -1))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (i32.store offset=0 (global.get $reg_base) (select (i32.const 0) (i32.const 1)
        (call $ctrl_style_disabled (call $wnd_get_style (local.get $arg0)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))) (return)
  )

  ;; 641: GetDesktopWindow — STUB: unimplemented
  (func $handle_GetDesktopWindow (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; GetDesktopWindow() → HWND of desktop window. No args (0 params on stack, but ret addr is there)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x10000))  ;; return a fixed desktop HWND
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))  ;; stdcall, 0 args
  )

  ;; 642: GetActiveWindow — active top-level attached to this thread queue.
  (func $handle_GetActiveWindow (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.and
          (i32.ne (global.get $active_hwnd) (i32.const 0))
          (i32.lt_s (call $wnd_table_find (global.get $active_hwnd)) (i32.const 0)))
      (then (global.set $active_hwnd (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (global.get $active_hwnd))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))  ;; stdcall, 0 args
  )

  ;; USER32 owns the storage behind packed 32-bit DDE lParams. Keep that
  ;; storage opaque to the application just as Win32 does, but give it normal
  ;; Global-memory provenance so it can move safely between worker instances
  ;; and be invalidated exactly once. The message tag matters: a packed DATA
  ;; lParam cannot be unpacked as POKE merely because both carry two values.
  ;;
  ;; Payload: magic, message, 32-bit low value, 32-bit high value. The public
  ;; value is the guest pointer itself; callers are explicitly forbidden from
  ;; using it for anything except a posted DDE message.
  (global $DDE_LPARAM_MAGIC i32 (i32.const 0x50454444)) ;; "DDEP"

  (func $dde_lparam_message_supported (param $msg i32) (result i32)
    (i32.or
      (i32.or
        (i32.or
          (i32.eq (local.get $msg) (i32.const 0x03E2)) ;; WM_DDE_ADVISE
          (i32.eq (local.get $msg) (i32.const 0x03E3))) ;; WM_DDE_UNADVISE
        (i32.or
          (i32.eq (local.get $msg) (i32.const 0x03E4)) ;; WM_DDE_ACK
          (i32.eq (local.get $msg) (i32.const 0x03E5)))) ;; WM_DDE_DATA
      (i32.or
        (i32.or
          (i32.eq (local.get $msg) (i32.const 0x03E6)) ;; WM_DDE_REQUEST
          (i32.eq (local.get $msg) (i32.const 0x03E7))) ;; WM_DDE_POKE
        (i32.eq (local.get $msg) (i32.const 0x03E8))))) ;; WM_DDE_EXECUTE

  ;; ADVISE/DATA/POKE pair a 32-bit HGLOBAL with an atom and therefore need
  ;; an allocated 32-bit packing object. REQUEST/UNADVISE are two 16-bit
  ;; values and stay inline. EXECUTE carries its HGLOBAL directly. ACK is
  ;; conditional: an atom fits inline, while the HGLOBAL returned for an
  ;; EXECUTE acknowledgement needs the packing object.
  (func $dde_lparam_message_needs_object
      (param $msg i32) (param $hi i32) (result i32)
    (i32.or
      (i32.or
        (i32.eq (local.get $msg) (i32.const 0x03E2))
        (i32.eq (local.get $msg) (i32.const 0x03E5)))
      (i32.or
        (i32.eq (local.get $msg) (i32.const 0x03E7))
        (i32.and
          (i32.eq (local.get $msg) (i32.const 0x03E4))
          (i32.ne (i32.and (local.get $hi) (i32.const 0xFFFF0000))
                  (i32.const 0))))))

  (func $dde_lparam_object_valid
      (param $lparam i32) (param $msg i32) (result i32)
    ;; heap_global_block_size proves an exact, live allocation boundary before
    ;; either metadata dword is read. heap_alloc(16) has a 24-byte extent.
    (if (i32.ne
          (call $heap_global_block_size (local.get $lparam) (i32.const 0))
          (i32.const 24))
      (then (return (i32.const 0))))
    (i32.and
      (i32.eq (call $gl32 (local.get $lparam)) (global.get $DDE_LPARAM_MAGIC))
      (i32.eq (call $gl32 (i32.add (local.get $lparam) (i32.const 4)))
              (local.get $msg))))

  (func $dde_lparam_object_write
      (param $lparam i32) (param $msg i32) (param $lo i32) (param $hi i32)
    (call $gs32 (local.get $lparam) (global.get $DDE_LPARAM_MAGIC))
    (call $gs32 (i32.add (local.get $lparam) (i32.const 4)) (local.get $msg))
    (call $gs32 (i32.add (local.get $lparam) (i32.const 8)) (local.get $lo))
    (call $gs32 (i32.add (local.get $lparam) (i32.const 12)) (local.get $hi)))

  ;; 643: ReuseDDElParam(lParam, msgIn, msgOut, uiLo, uiHi)
  (func $handle_ReuseDDElParam (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $old_object i32) (local $new_object i32)
    ;; These are the seven DDE messages for which the low/high abstraction is
    ;; defined. INITIATE is sent synchronously and TERMINATE has no payload;
    ;; Microsoft documents the packing family for posted messages only.
    (if (i32.eqz (i32.and
          (call $dde_lparam_message_supported (local.get $arg1))
          (call $dde_lparam_message_supported (local.get $arg2))))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))

    ;; The three always-packed inputs must be one of our live packing objects.
    ;; ACK may be either inline (atom) or packed (EXECUTE HGLOBAL), so only
    ;; recognize it as allocated when the opaque object validates completely.
    (if (call $dde_lparam_message_needs_object
          (local.get $arg1) (i32.const 0))
      (then
        (if (i32.eqz (call $dde_lparam_object_valid
              (local.get $arg0) (local.get $arg1)))
          (then
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
            (return)))
        (local.set $old_object (local.get $arg0)))
      (else
        (if (i32.and
              (i32.eq (local.get $arg1) (i32.const 0x03E4))
              (call $dde_lparam_object_valid
                (local.get $arg0) (local.get $arg1)))
          (then (local.set $old_object (local.get $arg0))))))

    (if (call $dde_lparam_message_needs_object
          (local.get $arg2) (local.get $arg4))
      (then
        ;; Reuse the incoming allocation whenever both message layouts need
        ;; one; otherwise allocate the opaque storage the outgoing post owns.
        (local.set $new_object (local.get $old_object))
        (if (i32.eqz (local.get $new_object))
          (then
            (local.set $new_object (call $heap_alloc (i32.const 16)))
            (if (i32.eqz (local.get $new_object))
              (then
                (i32.store offset=0 (global.get $reg_base) (i32.const 0))
                (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
                (return)))
            (call $heap_global_mark (local.get $new_object))))
        (call $dde_lparam_object_write
          (local.get $new_object) (local.get $arg2)
          (local.get $arg3) (local.get $arg4))
        (i32.store offset=0 (global.get $reg_base) (local.get $new_object)))
      (else
        ;; Converting an allocated incoming pair to an inline/direct outgoing
        ;; value consumes the old packing storage, but never its lo/hi contents.
        (if (local.get $old_object)
          (then
            (if (i32.eqz (call $heap_global_free (local.get $old_object)))
              (then
                (i32.store offset=0 (global.get $reg_base) (i32.const 0))
                (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
                (return)))))
        (if (i32.eq (local.get $arg2) (i32.const 0x03E8)) ;; WM_DDE_EXECUTE
          (then (i32.store offset=0 (global.get $reg_base) (local.get $arg4)))
          (else
            (i32.store offset=0 (global.get $reg_base) (i32.or
                (i32.and (local.get $arg3) (i32.const 0xFFFF))
                (i32.shl (i32.and (local.get $arg4) (i32.const 0xFFFF))
                         (i32.const 16))))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
  )

  ;; 644: UnpackDDElParam(msg, lParam, puiLo, puiHi)
  (func $handle_UnpackDDElParam (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $lo i32) (local $hi i32)
    ;; Validate both required outputs before writing either one. This avoids a
    ;; plausible half-result when the second pointer crosses an unmapped page.
    (if (i32.or
          (i32.eqz (call $dde_lparam_message_supported (local.get $arg0)))
          (i32.or
            (call $ptr_range_access_bad
              (local.get $arg2) (i32.const 4) (i32.const 1))
            (call $ptr_range_access_bad
              (local.get $arg3) (i32.const 4) (i32.const 1))))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))

    (if (call $dde_lparam_message_needs_object
          (local.get $arg0) (i32.const 0))
      (then
        (if (i32.eqz (call $dde_lparam_object_valid
              (local.get $arg1) (local.get $arg0)))
          (then
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
            (return)))
        (local.set $lo (call $gl32
          (i32.add (local.get $arg1) (i32.const 8))))
        (local.set $hi (call $gl32
          (i32.add (local.get $arg1) (i32.const 12)))))
      (else
        (if (i32.and
              (i32.eq (local.get $arg0) (i32.const 0x03E4))
              (call $dde_lparam_object_valid
                (local.get $arg1) (local.get $arg0)))
          (then
            (local.set $lo (call $gl32
              (i32.add (local.get $arg1) (i32.const 8))))
            (local.set $hi (call $gl32
              (i32.add (local.get $arg1) (i32.const 12)))))
          (else
            (if (i32.eq (local.get $arg0) (i32.const 0x03E8))
              (then
                (local.set $lo (i32.const 0))
                (local.set $hi (local.get $arg1)))
              (else
                (local.set $lo (i32.and (local.get $arg1) (i32.const 0xFFFF)))
                (local.set $hi (i32.shr_u (local.get $arg1) (i32.const 16)))))))))
    (call $gs32 (local.get $arg2) (local.get $lo))
    (call $gs32 (local.get $arg3) (local.get $hi))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; 645: WaitMessage() — block until USER has queue work. The message remains
  ;; queued; unlike GetMessage/PeekMessage, WaitMessage only waits for it.
  (func $handle_WaitMessage (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (call $incoming_send_yield) (then (return)))
    (if (call $has_pending_message)
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (return)))
    ;; A zero message pointer distinguishes this wait from GetMessage's live
    ;; frame when the browser/Worker scheduler resumes yield reason 7.
    (global.set $message_wait_msg_ptr (i32.const 0))
    (global.set $yield_reason (i32.const 7))
    (global.set $yield_flag (i32.const 1))
    (global.set $steps (i32.const 0))
  )

  ;; 646: GetWindowThreadProcessId
  (func $handle_GetWindowThreadProcessId (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $pid i32)
    ;; GetWindowThreadProcessId(hWnd, lpdwProcessId) → threadId
    ;; Renderer-owned top-level enumeration can return an HWND from another
    ;; emulator instance, so ask the shared host window registry first.
    (local.set $pid (call $host_get_window_info (local.get $arg0) (i32.const 3)))
    ;; Headless/minimal hosts may not mirror windows. A HWND in our local USER
    ;; table still belongs to this process.
    (if (i32.eqz (local.get $pid))
      (then
        (if (i32.ge_s (call $wnd_table_find (local.get $arg0)) (i32.const 0))
          (then (local.set $pid (call $current_process_id))))))
    ;; Invalid HWND: return zero and leave the caller's PID storage untouched.
    (if (i32.eqz (local.get $pid))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (if (local.get $arg1)
      (then (call $gs32 (local.get $arg1) (local.get $pid))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))  ;; fake thread ID = 1
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; GetMessageW — the A pump, which is the maintained one.
  ;;
  ;; This used to be a 189-line parallel copy of $handle_GetMessageA, and it
  ;; had fallen behind: no WM_NCPAINT delivery (the $nc_flags_scan pass), no
  ;; virtual-LAN pump, no per-message hwnd/lParam from the input queue, no
  ;; WM_NCCALCSIZE for a child's WM_SIZE. Its one piece of unique state,
  ;; $pending_wm_create, was dead — nothing in the module ever set it, so the
  ;; WM_NCCREATE/WM_CREATE arms it carried could not run.
  ;;
  ;; A and W differ in the *encoding of text payloads*, and nothing in this
  ;; emulator produces a non-ASCII WM_CHAR, so there is nothing left to
  ;; translate. If that changes, convert here rather than forking the pump.
  (func $handle_GetMessageW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_GetMessageA (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; MDICLIENT's private state, allocated on WM_CREATE:
  ;;   +0 hWindowMenu from CLIENTCREATESTRUCT
  ;;   +4 idFirstChild
  ;;   +8 active MDI child HWND
  ;;  +12 next child command ID
  (func $mdi_client_state (param $client i32) (result i32)
    (if (i32.ne (call $ctrl_table_get_class (local.get $client)) (i32.const 33))
      (then (return (i32.const 0))))
    (call $wnd_get_state_ptr (local.get $client)))

  (func $mdi_client_active (param $client i32) (result i32)
    (local $state i32)
    (local.set $state (call $mdi_client_state (local.get $client)))
    (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
    (call $gl32 (i32.add (local.get $state) (i32.const 8))))

  ;; Reserve the next command ID from CLIENTCREATESTRUCT.idFirstChild before
  ;; CreateWindowEx publishes the child. USER uses this as the child hMenu/ID;
  ;; DefFrameProc later recognizes the same value in the frame's Window menu.
  (func $mdi_client_take_child_id (param $client i32) (result i32)
    (local $state i32) (local $id i32)
    (local.set $state (call $mdi_client_state (local.get $client)))
    (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
    (local.set $id (call $gl32 (i32.add (local.get $state) (i32.const 12))))
    (call $gs32 (i32.add (local.get $state) (i32.const 12))
      (i32.add (local.get $id) (i32.const 1)))
    (local.get $id))

  ;; Select a live immediate child, tell both sides of the transition, and
  ;; move keyboard focus to the newly active MDI child.
  (func $mdi_client_activate (param $client i32) (param $child i32) (result i32)
    (local $state i32) (local $old i32)
    (local.set $state (call $mdi_client_state (local.get $client)))
    (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
    (if (i32.and
          (i32.ne (local.get $child) (i32.const 0))
          (i32.ne (call $wnd_get_parent (local.get $child)) (local.get $client)))
      (then (return (i32.const 0))))
    (local.set $old (call $gl32 (i32.add (local.get $state) (i32.const 8))))
    (if (i32.eq (local.get $old) (local.get $child))
      (then
        (if (local.get $child) (then (call $set_focus (local.get $child))))
        (return (i32.const 1))))
    (call $gs32 (i32.add (local.get $state) (i32.const 8)) (local.get $child))
    (if (local.get $old)
      (then (drop (call $wnd_send_message
        (local.get $old) (i32.const 0x0222)
        (local.get $old) (local.get $child))))) ;; WM_MDIACTIVATE
    (if (local.get $child)
      (then
        (call $host_set_window_zorder (local.get $child) (i32.const 0))
        (drop (call $wnd_send_message
          (local.get $child) (i32.const 0x0222)
          (local.get $old) (local.get $child)))
        (call $set_focus (local.get $child))))
    (i32.const 1))

  ;; Give a newly created MDI child the next CLIENTCREATESTRUCT command ID
  ;; when CreateWindowEx did not provide one, then make the first/new child
  ;; active. The ID is what DefFrameProc receives from the frame's Window menu.
  (func $mdi_client_register_child (param $child i32) (result i32)
    (local $client i32) (local $state i32) (local $id i32)
    (local.set $client (call $wnd_get_parent (local.get $child)))
    (local.set $state (call $mdi_client_state (local.get $client)))
    (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
    (if (i32.eqz (call $ctrl_table_get_id (local.get $child)))
      (then
        (local.set $id (call $mdi_client_take_child_id (local.get $client)))
        (drop (call $ctrl_table_set_id (local.get $child) (local.get $id)))))
    (drop (call $mdi_client_activate (local.get $client) (local.get $child)))
    (i32.const 1))

  (func $mdi_client_next_child (param $client i32) (param $from i32) (param $previous i32) (result i32)
    (local $next i32)
    (if (i32.eqz (local.get $from))
      (then (local.set $from (call $mdi_client_active (local.get $client)))))
    (if (local.get $previous)
      (then (local.set $next (call $wnd_find_prev_sibling (local.get $from))))
      (else (local.set $next (call $wnd_find_next_sibling (local.get $from)))))
    (if (i32.eqz (local.get $next))
      (then
        (if (local.get $previous)
          (then (local.set $next (call $wnd_find_last_child (local.get $client))))
          (else (local.set $next (call $wnd_find_first_child (local.get $client)))))))
    (local.get $next))

  ;; USER's preregistered MDICLIENT default procedure. This is deliberately a
  ;; bounded Win98 slice: creation state, activation/query/navigation, child
  ;; destruction, and menu replacement. Arrangement is intentionally left to
  ;; a later child-aware renderer path: the generic arrange host API targets
  ;; desktop top-level windows, not children of one MDICLIENT.
  ;; USER's MDICLIENT re-sizes a *maximized* child to whatever its client area
  ;; has just become. Nothing else in this emulator does: $mdi_child_maximize
  ;; runs only from the child's own SC_MAXIMIZE, so a child that was already
  ;; zoomed when the frame grew kept the rect it was given at the old frame
  ;; size. Maximizing SimCity 2000's MDI frame to the full desktop left its
  ;; city window at the 392x254 it had when the frame was 400x300, and the
  ;; child's own maximize button then did nothing visible because the child
  ;; already believed it was maximized.
  (func $mdi_client_size_children (param $client i32)
    (local $child i32) (local $next i32) (local $guard i32)
    (local.set $child (call $wnd_find_first_child (local.get $client)))
    (local.set $guard (i32.const 256)) ;; one WND_RECORDS' worth of siblings
    (block $done
      (loop $walk
        (br_if $done (i32.eqz (local.get $child)))
        (br_if $done (i32.eqz (local.get $guard)))
        (local.set $guard (i32.sub (local.get $guard) (i32.const 1)))
        ;; Read the next sibling first: re-maximizing may reorder the list.
        (local.set $next (call $wnd_find_next_sibling (local.get $child)))
        (if (call $wnd_max_get (local.get $child))
          (then (drop (call $mdi_child_maximize (local.get $child)))))
        (local.set $child (local.get $next))
        (br $walk))))

  (func $mdiclient_wndproc (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $state i32) (local $ccs i32) (local $child i32) (local $next i32)
    (local $frame i32) (local $old_menu i32) (local $new_menu i32)
    (if (i32.eq (local.get $msg) (i32.const 0x0001)) ;; WM_CREATE
      (then
        (local.set $state (call $heap_alloc (i32.const 16)))
        (if (i32.eqz (local.get $state)) (then (return (i32.const -1))))
        (memory.fill (call $g2w (local.get $state)) (i32.const 0) (i32.const 16))
        (local.set $ccs (call $gl32 (local.get $lParam))) ;; CREATESTRUCT.lpCreateParams
        (if (local.get $ccs)
          (then
            (call $gs32 (local.get $state) (call $gl32 (local.get $ccs)))
            (call $gs32 (i32.add (local.get $state) (i32.const 4))
              (call $gl32 (i32.add (local.get $ccs) (i32.const 4))))
            (call $gs32 (i32.add (local.get $state) (i32.const 12))
              (call $gl32 (i32.add (local.get $ccs) (i32.const 4))))))
        (call $wnd_set_state_ptr (local.get $hwnd) (local.get $state))
        (return (i32.const 0))))
    (local.set $state (call $mdi_client_state (local.get $hwnd)))
    (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0002)) ;; WM_DESTROY
      (then
        (call $heap_free (local.get $state))
        (call $wnd_set_state_ptr (local.get $hwnd) (i32.const 0))
        (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0007)) ;; WM_SETFOCUS
      (then
        (local.set $child (call $mdi_client_active (local.get $hwnd)))
        (if (local.get $child) (then (call $set_focus (local.get $child))))
        (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0005)) ;; WM_SIZE
      (then
        (call $mdi_client_size_children (local.get $hwnd))
        (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0222)) ;; WM_MDIACTIVATE
      (then
        (drop (call $mdi_client_activate (local.get $hwnd) (local.get $wParam)))
        (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0229)) ;; WM_MDIGETACTIVE
      (then
        (local.set $child (call $mdi_client_active (local.get $hwnd)))
        (if (local.get $lParam)
          (then (call $gs32 (local.get $lParam) (call $wnd_max_get (local.get $child)))))
        (return (local.get $child))))
    (if (i32.eq (local.get $msg) (i32.const 0x0224)) ;; WM_MDINEXT
      (then
        (local.set $next (call $mdi_client_next_child
          (local.get $hwnd) (local.get $wParam)
          (i32.ne (local.get $lParam) (i32.const 0))))
        (if (local.get $next)
          (then (drop (call $mdi_client_activate (local.get $hwnd) (local.get $next)))))
        (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0221)) ;; WM_MDIDESTROY
      (then
        (local.set $child (local.get $wParam))
        (if (i32.eq (call $wnd_get_parent (local.get $child)) (local.get $hwnd))
          (then
            (local.set $next (call $mdi_client_next_child
              (local.get $hwnd) (local.get $child) (i32.const 0)))
            (if (i32.eq (local.get $next) (local.get $child))
              (then (local.set $next (i32.const 0))))
            (drop (call $mdi_client_activate (local.get $hwnd) (local.get $next)))
            (call $wnd_destroy_recursive (local.get $child))))
        (return (i32.const 0))))
    (if (i32.or
          (i32.eq (local.get $msg) (i32.const 0x0225)) ;; WM_MDIMAXIMIZE
          (i32.eq (local.get $msg) (i32.const 0x0223))) ;; WM_MDIRESTORE
      (then
        (local.set $child (local.get $wParam))
        (if (i32.eq (call $wnd_get_parent (local.get $child)) (local.get $hwnd))
          (then
            (drop (call $wnd_send_message
              (local.get $child) (i32.const 0x0112)
              (select (i32.const 0xF030) (i32.const 0xF120)
                (i32.eq (local.get $msg) (i32.const 0x0225)))
              (i32.const 0)))))
        (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0230)) ;; WM_MDISETMENU
      (then
        (local.set $frame (call $wnd_get_parent (local.get $hwnd)))
        (local.set $old_menu (call $menu_source_get (local.get $frame)))
        (local.set $new_menu (local.get $wParam))
        (if (local.get $new_menu)
          (then
            (if (i32.eq
                  (i32.and (local.get $new_menu) (i32.const 0xFFFF0000))
                  (i32.const 0x00BE0000))
              (then (local.set $new_menu
                (i32.and (local.get $new_menu) (i32.const 0xFFFF)))))
            (call $menu_load (local.get $frame) (local.get $new_menu))
            (call $host_set_menu (local.get $frame) (local.get $new_menu))
            (call $defwndproc_do_nccalcsize (local.get $frame))
            (call $paint_flag_set_inv (local.get $frame))))
        (if (local.get $lParam)
          (then (call $gs32 (local.get $state) (local.get $lParam))))
        (return (local.get $old_menu))))
    (if (i32.eq (local.get $msg) (i32.const 0x0234)) ;; WM_MDIREFRESHMENU
      (then (return (call $menu_source_get (call $wnd_get_parent (local.get $hwnd))))))
    (i32.const 0))

  ;; DefFrameProc's MDI-specific messages. Return one when consumed; all
  ;; others must pass through the encoding-matched DefWindowProc entry.
  (func $mdi_frame_message (param $frame i32) (param $client i32)
      (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $child i32) (local $wh i32) (local $w i32) (local $h i32)
    (if (i32.eqz (call $mdi_client_state (local.get $client)))
      (then (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0111)) ;; WM_COMMAND
      (then
        (local.set $child (call $ctrl_find_by_id
          (local.get $client) (i32.and (local.get $wParam) (i32.const 0xFFFF))))
        (if (local.get $child)
          (then
            (drop (call $mdi_client_activate (local.get $client) (local.get $child)))
            (return (i32.const 1))))))
    ;; MDI child activation is independent of frame activation. When the frame
    ;; changes active state, USER asks the last active child to repaint its
    ;; nonclient area, then still gives the frame's DefWindowProc its turn.
    (if (i32.eq (local.get $msg) (i32.const 0x0086)) ;; WM_NCACTIVATE
      (then
        (local.set $child (call $mdi_client_active (local.get $client)))
        (if (local.get $child)
          (then (drop (call $wnd_send_message
            (local.get $child) (local.get $msg)
            (local.get $wParam) (local.get $lParam)))))))
    (if (i32.eq (local.get $msg) (i32.const 0x0007)) ;; WM_SETFOCUS
      (then
        (local.set $child (call $mdi_client_active (local.get $client)))
        (call $set_focus (select (local.get $child) (local.get $client)
          (i32.ne (local.get $child) (i32.const 0))))
        (return (i32.const 1))))
    (if (i32.eq (local.get $msg) (i32.const 0x0005)) ;; WM_SIZE
      (then
        (local.set $wh (local.get $lParam))
        (local.set $w (i32.and (local.get $wh) (i32.const 0xFFFF)))
        (local.set $h (i32.and (i32.shr_u (local.get $wh) (i32.const 16)) (i32.const 0xFFFF)))
        (call $host_move_window (local.get $client)
          (i32.const 0) (i32.const 0) (local.get $w) (local.get $h) (i32.const 4))
        (call $ctrl_geom_sync (local.get $client)
          (i32.const 0) (i32.const 0) (local.get $w) (local.get $h) (i32.const 4))
        ;; This is the path that actually resizes the client for an MFC frame:
        ;; the WM_SIZE sent below goes to the application's own window
        ;; procedure, not to $mdiclient_wndproc, so the maximized-child
        ;; relayout has to be invoked here as well. Do it before the send, so
        ;; the guest's handler sees the finished layout.
        (call $mdi_client_size_children (local.get $client))
        (drop (call $wnd_send_message
          (local.get $client) (i32.const 0x0005) (local.get $wParam) (local.get $lParam)))
        (return (i32.const 1))))
    (i32.const 0))

  ;; DefMDIChildProc's SC_MAXIMIZE geometry: USER sizes a maximized MDI child
  ;; to the whole MDI client area. Nothing else in this emulator does it --
  ;; the renderer's showWindow gates its cmd===3 resize on !win.isChild, and
  ;; $handle_ShowWindow posts the maximize move/size pair only for main_hwnd --
  ;; so a child asked to maximize kept its creation rect and never saw a
  ;; WM_SIZE. MFC's CMDIChildWnd::ActivateFrame is exactly that call, and a
  ;; view sized from that missing WM_SIZE (SimCity 2000's AfxFrameOrView)
  ;; stayed at the 0x0 it was created with. Returns 0 when $child is not an
  ;; MDI child, so an ordinary child costs one parent lookup.
  (func $mdi_child_maximize (param $child i32) (result i32)
    (local $client i32) (local $w i32) (local $h i32)
    (local $l i32) (local $t i32) (local $r i32) (local $b i32) (local $wh i32)
    (local.set $client (call $wnd_get_parent (local.get $child)))
    (if (i32.eqz (call $mdi_client_state (local.get $client)))
      (then (return (i32.const 0))))
    (local.set $w (i32.sub (call $client_rect_get_r (local.get $client))
                           (call $client_rect_get_l (local.get $client))))
    (local.set $h (i32.sub (call $client_rect_get_b (local.get $client))
                           (call $client_rect_get_t (local.get $client))))
    (if (i32.or (i32.le_s (local.get $w) (i32.const 0))
                (i32.le_s (local.get $h) (i32.const 0)))
      (then (return (i32.const 0))))
    ;; A maximized MDI child's CLIENT area is the MDICLIENT's client area:
    ;; its caption and borders sit outside the MDICLIENT, clipped away, and
    ;; the frame's menu bar carries its min/restore/close buttons instead
    ;; ($mdi_frame_maximized_child). The non-client insets are read off the
    ;; child as it stands, where its window and client rects agree.
    (local.set $wh (call $ctrl_get_wh_packed (local.get $child)))
    (local.set $l (call $client_rect_get_l (local.get $child)))
    (local.set $t (call $client_rect_get_t (local.get $child)))
    (local.set $r (i32.sub (i32.and (local.get $wh) (i32.const 0xFFFF))
                           (call $client_rect_get_r (local.get $child))))
    (local.set $b (i32.sub (i32.shr_u (local.get $wh) (i32.const 16))
                           (call $client_rect_get_b (local.get $child))))
    (if (i32.or (i32.or (i32.gt_u (local.get $l) (i32.const 64)) (i32.gt_u (local.get $t) (i32.const 64)))
                (i32.or (i32.gt_u (local.get $r) (i32.const 64)) (i32.gt_u (local.get $b) (i32.const 64))))
      (then
        (local.set $l (i32.const 0)) (local.set $t (i32.const 0))
        (local.set $r (i32.const 0)) (local.set $b (i32.const 0))))
    (local.set $w (i32.add (local.get $w) (i32.add (local.get $l) (local.get $r))))
    (local.set $h (i32.add (local.get $h) (i32.add (local.get $t) (local.get $b))))
    ;; SWP_NOZORDER | SWP_NOACTIVATE -- maximizing does not reorder the MDI
    ;; child list, and the frame owns activation.
    (call $host_move_window (local.get $child)
      (i32.sub (i32.const 0) (local.get $l)) (i32.sub (i32.const 0) (local.get $t))
      (local.get $w) (local.get $h) (i32.const 0x0014))
    (call $ctrl_geom_sync (local.get $child)
      (i32.sub (i32.const 0) (local.get $l)) (i32.sub (i32.const 0) (local.get $t))
      (local.get $w) (local.get $h) (i32.const 0x0014))
    (call $defwndproc_do_nccalcsize (local.get $child))
    (call $paint_flag_set_inv (call $wnd_get_parent (local.get $client)))
    (call $host_sync_window_client
      (local.get $child)
      (call $wnd_client_screen_x (local.get $child))
      (call $wnd_client_screen_y (local.get $child))
      (i32.sub (call $client_rect_get_r (local.get $child))
               (call $client_rect_get_l (local.get $child)))
      (i32.sub (call $client_rect_get_b (local.get $child))
               (call $client_rect_get_t (local.get $child))))
    ;; wParam 2 = SIZE_MAXIMIZED. $post_resize_messages recomputes the
    ;; non-client area itself and queues the matching erase/paint.
    (call $post_resize_messages (local.get $child) (i32.const 2))
    (i32.const 1))

  ;; MDI-child messages that add behavior beyond DefWindowProc. The caller
  ;; owns the encoding-specific fallback and stdcall cleanup.
  (func $mdi_child_message (param $child i32) (param $msg i32)
      (param $wParam i32) (param $lParam i32) (result i32)
    (local $client i32) (local $next i32) (local $cmd i32)
    (local.set $client (call $wnd_get_parent (local.get $child)))
    (if (i32.eqz (call $mdi_client_state (local.get $client)))
      (then (return (i32.const 0))))
    (if (i32.or
          (i32.eq (local.get $msg) (i32.const 0x0001))  ;; WM_CREATE
          (i32.or
            (i32.eq (local.get $msg) (i32.const 0x0022)) ;; WM_CHILDACTIVATE
            (i32.eq (local.get $msg) (i32.const 0x0007)))) ;; WM_SETFOCUS
      (then
        (drop (call $mdi_client_register_child (local.get $child)))
        (return (i32.const 1))))
    (if (i32.eq (local.get $msg) (i32.const 0x0002)) ;; WM_DESTROY
      (then
        (if (i32.eq (call $mdi_client_active (local.get $client)) (local.get $child))
          (then
            (local.set $next (call $mdi_client_next_child
              (local.get $client) (local.get $child) (i32.const 0)))
            (if (i32.eq (local.get $next) (local.get $child))
              (then (local.set $next (i32.const 0))))
            (drop (call $mdi_client_activate (local.get $client) (local.get $next)))))
        (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0112)) ;; WM_SYSCOMMAND
      (then
        (local.set $cmd (i32.and (local.get $wParam) (i32.const 0xFFF0)))
        (if (i32.or
              (i32.eq (local.get $cmd) (i32.const 0xF040)) ;; SC_NEXTWINDOW
              (i32.eq (local.get $cmd) (i32.const 0xF050))) ;; SC_PREVWINDOW
          (then
            (drop (call $mdiclient_wndproc
              (local.get $client) (i32.const 0x0224) (local.get $child)
              (i32.eq (local.get $cmd) (i32.const 0xF050))))
            (return (i32.const 1))))
        (if (i32.eq (local.get $cmd) (i32.const 0xF030)) ;; SC_MAXIMIZE
          (then
            (call $wnd_apply_show_state (local.get $child) (i32.const 3))
            (if (call $mdi_child_maximize (local.get $child))
              (then (return (i32.const 1))))))
        ;; Restore, minimize and close take the child's buttons off the
        ;; frame's menu bar; DefWindowProc still does the work.
        (if (call $wnd_max_get (local.get $child))
          (then (call $paint_flag_set_inv (call $wnd_get_parent (local.get $client)))))))
    (i32.const 0))

  ;; The maximized, active MDI child whose buttons $frame's menu bar carries,
  ;; or 0. Windows puts them there because the child's own caption is outside
  ;; the MDICLIENT ($mdi_child_maximize).
  (func $mdi_frame_maximized_child (param $frame i32) (result i32)
    (local $client i32) (local $child i32) (local $guard i32)
    (local.set $client (call $wnd_find_first_child (local.get $frame)))
    (local.set $guard (i32.const 256))
    (block $done
      (loop $walk
        (br_if $done (i32.eqz (local.get $client)))
        (br_if $done (i32.eqz (local.get $guard)))
        (local.set $guard (i32.sub (local.get $guard) (i32.const 1)))
        (if (call $mdi_client_state (local.get $client))
          (then
            (local.set $child (call $mdi_client_active (local.get $client)))
            (if (i32.and (i32.ne (local.get $child) (i32.const 0))
                         (i32.ne (call $wnd_max_get (local.get $child)) (i32.const 0)))
              (then (return (local.get $child))))
            (return (i32.const 0))))
        (local.set $client (call $wnd_find_next_sibling (local.get $client)))
        (br $walk)))
    (i32.const 0))

  ;; Default MDI frame processing. The MDI-specific branches are filled in
  ;; below; every other message retains DefWindowProc's encoding-specific
  ;; behavior. DefFrameProc has one extra HWND argument, so add the remaining
  ;; dword after DefWindowProc consumes its normal four-argument frame.
  (func $handle_DefFrameProcW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (call $mdi_frame_message
          (local.get $arg0) (local.get $arg1) (local.get $arg2)
          (local.get $arg3) (local.get $arg4))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    (call $handle_DefWindowProcW
      (local.get $arg0) (local.get $arg2) (local.get $arg3) (local.get $arg4)
      (i32.const 0) (local.get $name_ptr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; Translate the documented MDI Ctrl+F4 / Ctrl+F6 system accelerators. Key-up
  ;; is consumed too, but only key-down sends the WM_SYSCOMMAND.
  (func $handle_TranslateMDISysAccel (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $msg i32) (local $message i32) (local $vk i32)
    (local $active i32) (local $command i32)
    (if (i32.and
          (i32.ne (local.get $arg1) (i32.const 0))
          (i32.ne (call $mdi_client_state (local.get $arg0)) (i32.const 0)))
      (then
        (local.set $msg (call $g2w (local.get $arg1)))
        (local.set $message (i32.load offset=4 (local.get $msg)))
        (local.set $vk (i32.load offset=8 (local.get $msg)))
        (if (i32.and
              (i32.or
                (i32.eq (local.get $message) (i32.const 0x0100))
                (i32.eq (local.get $message) (i32.const 0x0101)))
              (i32.ne
                (i32.and (call $host_get_key_down_state (i32.const 0x11)) (i32.const 0x8000))
                (i32.const 0)))
          (then
            (if (i32.eq (local.get $vk) (i32.const 0x73))
              (then (local.set $command (i32.const 0xF060)))) ;; Ctrl+F4: SC_CLOSE
            (if (i32.eq (local.get $vk) (i32.const 0x75))
              (then
                (local.set $command
                  (select (i32.const 0xF050) (i32.const 0xF040)
                    (i32.ne
                      (i32.and (call $host_get_key_down_state (i32.const 0x10)) (i32.const 0x8000))
                      (i32.const 0)))))))) ;; Ctrl+[Shift+]F6
        (if (local.get $command)
          (then
            (if (i32.eq (local.get $message) (i32.const 0x0100))
              (then
                (local.set $active (call $mdi_client_active (local.get $arg0)))
                (if (local.get $active)
                  (then (drop (call $wnd_send_message
                    (local.get $active) (i32.const 0x0112)
                    (local.get $command) (i32.const 0)))))))
            (i32.store offset=0 (global.get $reg_base) (i32.const 1))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
            (return)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; Default MDI child processing falls through to the ordinary default
  ;; procedure for messages with no MDI-specific action.
  (func $handle_DefMDIChildProcW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (call $mdi_child_message
          (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (call $handle_DefWindowProcW
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)
      (local.get $arg4) (local.get $name_ptr))
  )

  ;; ANSI spellings are distinct USER32 exports, even though all of the MDI
  ;; state and non-text messages are shared with the W entry points.
  (func $handle_DefFrameProcA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (call $mdi_frame_message
          (local.get $arg0) (local.get $arg1) (local.get $arg2)
          (local.get $arg3) (local.get $arg4))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    (call $handle_DefWindowProcA
      (local.get $arg0) (local.get $arg2) (local.get $arg3) (local.get $arg4)
      (i32.const 0) (local.get $name_ptr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle_DefMDIChildProcA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (call $mdi_child_message
          (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (call $handle_DefWindowProcA
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)
      (local.get $arg4) (local.get $name_ptr))
  )

  ;; 652: InvertRect(hdc, lpRect) — 2 args stdcall
  ;; Inverts pixels in the rectangle. Equivalent to BitBlt with DSTINVERT.
  (func $handle_InvertRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32) (local $left i32) (local $top i32) (local $right i32) (local $bottom i32)
    (local.set $wa (call $g2w (local.get $arg1)))
    (local.set $left (load.field Rect left (local.get $wa)))
    (local.set $top (load.field Rect top (local.get $wa)))
    (local.set $right (load.field Rect right (local.get $wa)))
    (local.set $bottom (load.field Rect bottom (local.get $wa)))
    (i32.store offset=0 (global.get $reg_base) (call $gdi_native_bitblt
      (local.get $arg0) (local.get $left) (local.get $top)
      (i32.sub (local.get $right) (local.get $left))
      (i32.sub (local.get $bottom) (local.get $top))
      (i32.const 0) (i32.const 0) (i32.const 0)
      (i32.const 0x00550009)))  ;; DSTINVERT
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))  ;; stdcall, 2 args + ret
  )

  ;; 653: IsZoomed(hwnd) → BOOL — returns TRUE if window is maximized.
  ;; The comment this replaces said windows here are never maximized; they are,
  ;; and $wnd_max_get has tracked it since the caption's maximize glyph needed
  ;; to know which way to draw itself.
  (func $handle_IsZoomed (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $wnd_max_get (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; 654: SetParent(hWndChild, hWndNewParent) — previous parent, or NULL on
  ;; failure. NULL and our fixed desktop HWND both select the internal root.
  ;; SetParent deliberately does not rewrite WS_CHILD/WS_POPUP; callers own
  ;; those compatibility style changes.
  (func $handle_SetParent (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $parent i32) (local $walk i32) (local $depth i32)
    ;; Neither half of the window model may observe a reparenting that USER
    ;; rejected. In particular, $wnd_set_parent itself is intentionally void,
    ;; so validate handles and ancestry before calling it or the renderer.
    (if (i32.lt_s (call $wnd_table_find (local.get $arg0)) (i32.const 0))
      (then
        (global.set $last_error (i32.const 1400)) ;; ERROR_INVALID_WINDOW_HANDLE
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (local.set $parent
      (select (i32.const 0) (local.get $arg1)
        (i32.or
          (i32.eqz (local.get $arg1))
          (i32.eq (local.get $arg1) (i32.const 0x00010000)))))
    (if (i32.and
          (i32.ne (local.get $parent) (i32.const 0))
          (i32.lt_s (call $wnd_table_find (local.get $parent)) (i32.const 0)))
      (then
        (global.set $last_error (i32.const 1400)) ;; ERROR_INVALID_WINDOW_HANDLE
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    ;; Reject a direct or indirect cycle. Besides being invalid USER state,
    ;; one would make coordinate conversion recurse WAT -> host -> WAT.
    (local.set $walk (local.get $parent))
    (block $valid_parent (loop $ancestors
      (br_if $valid_parent (i32.eqz (local.get $walk)))
      (if (i32.or
            (i32.eq (local.get $walk) (local.get $arg0))
            (i32.ge_u (local.get $depth) (global.get $MAX_WINDOWS)))
        (then
          (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
          (i32.store offset=0 (global.get $reg_base) (i32.const 0))
          (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
          (return)))
      (local.set $walk (call $wnd_get_parent (local.get $walk)))
      (local.set $depth (i32.add (local.get $depth) (i32.const 1)))
      (br $ancestors)))
    (i32.store offset=0 (global.get $reg_base) (call $wnd_get_parent (local.get $arg0)))
    (call $wnd_set_parent (local.get $arg0) (local.get $parent))
    (call $host_set_parent (local.get $arg0) (local.get $parent))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; RegisterDragDrop/RevokeDragDrop ownership and duplicate/error semantics
  ;; live with the OLE continuation bridge in 09a7b-ole.wat. Browser-originated
  ;; drop delivery can now use that retained target without inventing lifetime.
  (func $handle_RegisterDragDrop (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $com_register_drag_drop (local.get $arg0) (local.get $arg1))
  )

  (func $handle_RevokeDragDrop (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $com_revoke_drag_drop (local.get $arg0))
  )

  ;; CoLockObjectExternal retains balanced strong references through the OLE
  ;; guest-callback bridge; mspaint and embedded-object servers use this to
  ;; keep a visible object alive independently of their ordinary references.
  (func $handle_CoLockObjectExternal (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $com_lock_object_external
      (local.get $arg0) (local.get $arg1) (local.get $arg2))
  )

;; 657: GetDCEx — STUB: unimplemented
  (func $handle_GetDCEx (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $hdc i32)
    ;; GetDCEx(hwnd, hrgnClip, flags). Minimal USER/GDI compatibility:
    ;; ignore the optional region for now, but honor DCX_WINDOW enough for MFC
    ;; toolbar/nonclient update code to choose whole-window vs client origin.
    ;; hwnd=NULL and the fixed desktop hwnd both use the host screen DC path.
    (if (i32.or
          (i32.eqz (local.get $arg0))
          (i32.eq (local.get $arg0) (i32.const 0x00010000)))
      (then
        (local.set $hdc (call $host_alloc_screen_dc)))
      (else
        (if (i32.eq (call $wnd_table_find (local.get $arg0)) (i32.const -1))
          (then (local.set $hdc (i32.const 0)))
          (else (if (i32.and (local.get $arg2) (i32.const 0x00000001)) ;; DCX_WINDOW
          (then
            (local.set $hdc (call $host_alloc_window_dc (local.get $arg0) (i32.const 1)))
            (if (i32.and (local.get $arg2) (i32.const 0x00000400)) ;; DCX_LOCKWINDOWUPDATE
              (then (call $dc_apply_window_clip_unlocked (local.get $hdc) (local.get $arg0)))
              (else (call $dc_apply_window_clip (local.get $hdc) (local.get $arg0)))))
          (else
            (local.set $hdc (call $host_alloc_window_dc (local.get $arg0) (i32.const 0)))
            (if (i32.and (local.get $arg2) (i32.const 0x00000400)) ;; DCX_LOCKWINDOWUPDATE
              (then (call $dc_apply_client_clip_unlocked (local.get $hdc) (local.get $arg0)))
              (else (call $dc_apply_client_clip (local.get $hdc) (local.get $arg0))))))))))
    (i32.store offset=0 (global.get $reg_base) (local.get $hdc))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 658: LockWindowUpdate(hwnd). USER permits one locked window, shared by
  ;; every guest thread. Ordinary display DCs for that window and its children
  ;; receive an empty visible region until LockWindowUpdate(NULL). Drawing
  ;; attempted through those DCs is unioned in locked-window client space; on
  ;; unlock that exact bound becomes the update region of the window and the
  ;; intersecting portion is translated into each visible child.
  (func $handle_LockWindowUpdate (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $old i32) (local $damaged i32)
    (local $left i32) (local $top i32) (local $right i32) (local $bottom i32)
    (if (i32.eqz (local.get $arg0))
      (then
        ;; -1 keeps another Worker from acquiring a new lock while retained
        ;; DC clips are being restored. It does not cover any HWND.
        (local.set $old (i32.atomic.load (global.get $WINDOW_UPDATE_LOCK)))
        (if (i32.eq (local.get $old) (i32.const -1))
          (then
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
            (return)))
        (if (i32.eqz (local.get $old))
          (then
            (i32.store offset=0 (global.get $reg_base) (i32.const 1))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
            (return)))
        (if (i32.ne
              (i32.atomic.rmw.cmpxchg (global.get $WINDOW_UPDATE_LOCK)
                (local.get $old) (i32.const -1))
              (local.get $old))
          (then
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
            (return)))
        ;; A recorder that started before -1 was published finishes under this
        ;; guard; one that starts later fails its HWND recheck and is not lost.
        (call $window_update_damage_guard_acquire)
        (local.set $damaged
          (i32.atomic.load offset=8 (global.get $WINDOW_UPDATE_LOCK)))
        (local.set $left
          (i32.atomic.load offset=12 (global.get $WINDOW_UPDATE_LOCK)))
        (local.set $top
          (i32.atomic.load offset=16 (global.get $WINDOW_UPDATE_LOCK)))
        (local.set $right
          (i32.atomic.load offset=20 (global.get $WINDOW_UPDATE_LOCK)))
        (local.set $bottom
          (i32.atomic.load offset=24 (global.get $WINDOW_UPDATE_LOCK)))
        (i32.atomic.store offset=8 (global.get $WINDOW_UPDATE_LOCK) (i32.const 0))
        (i32.atomic.store offset=12 (global.get $WINDOW_UPDATE_LOCK) (i32.const 0))
        (i32.atomic.store offset=16 (global.get $WINDOW_UPDATE_LOCK) (i32.const 0))
        (i32.atomic.store offset=20 (global.get $WINDOW_UPDATE_LOCK) (i32.const 0))
        (i32.atomic.store offset=24 (global.get $WINDOW_UPDATE_LOCK) (i32.const 0))
        (call $window_update_damage_guard_release)
        ;; With -1 published, the common clip helpers rebuild ordinary USER
        ;; regions instead of reinstalling the lock's NULLREGION.
        (call $gdi_refresh_window_dc_system_clips)
        (if (local.get $damaged)
          (then
            (call $update_invalidate_rect (local.get $old)
              (local.get $left) (local.get $top)
              (local.get $right) (local.get $bottom))
            (if (i32.eq (local.get $old) (global.get $main_hwnd))
              (then (global.set $paint_pending (i32.const 1)))
              (else (call $paint_flag_set (local.get $old))))
            (drop (call $paint_seed_child_paints (local.get $old)))
            (call $host_invalidate (local.get $old))))
        (i32.atomic.store (global.get $WINDOW_UPDATE_LOCK) (i32.const 0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (if (i32.eq (call $wnd_table_find (local.get $arg0)) (i32.const -1))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    ;; Clear the previous transaction while holding the same guard recorders
    ;; use, before they can observe the newly-published HWND.
    (call $window_update_damage_guard_acquire)
    (local.set $old (i32.atomic.rmw.cmpxchg (global.get $WINDOW_UPDATE_LOCK)
      (i32.const 0) (local.get $arg0)))
    ;; Re-locking the same HWND is idempotent; a different active lock fails.
    (if (i32.or (i32.eqz (local.get $old))
          (i32.eq (local.get $old) (local.get $arg0)))
      (then
        (if (i32.eqz (local.get $old))
          (then
            (i32.atomic.store offset=8 (global.get $WINDOW_UPDATE_LOCK) (i32.const 0))
            (i32.atomic.store offset=12 (global.get $WINDOW_UPDATE_LOCK) (i32.const 0))
            (i32.atomic.store offset=16 (global.get $WINDOW_UPDATE_LOCK) (i32.const 0))
            (i32.atomic.store offset=20 (global.get $WINDOW_UPDATE_LOCK) (i32.const 0))
            (i32.atomic.store offset=24 (global.get $WINDOW_UPDATE_LOCK) (i32.const 0))))
        (call $window_update_damage_guard_release)
        (if (i32.eqz (local.get $old))
          (then (call $gdi_refresh_window_dc_system_clips)))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1)))
      (else
        (call $window_update_damage_guard_release)
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 659: GetTabbedTextExtentA — packed width/height for tab-expanded text.
  (func $handle_GetTabbedTextExtentA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $gdi_tabbed_text
      (local.get $arg0) (i32.const 0) (i32.const 0)
      (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4)
      (i32.const 0) (i32.const 0) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
  )

  ;; 660: CreateDialogIndirectParamW — STUB: unimplemented
  (func $handle_CreateDialogIndirectParamW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $hwnd i32)
    (local.set $hwnd (global.get $next_hwnd))
    (global.set $dlg_indirect_template_ptr (local.get $arg1))
    (call $handle_CreateDialogParamA
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
    (call $wnd_unicode_set (local.get $hwnd) (i32.const 1))
  )

  (func $handle_CreateDialogIndirectParamA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $dlg_indirect_template_ptr (local.get $arg1))
    (call $handle_CreateDialogParamA
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; 661: GetNextDlgTabItem — use the same visible/enabled WS_TABSTOP walk as
  ;; IsDialogMessage keyboard traversal. bPrevious selects reverse order and
  ;; both directions wrap at the ends, matching USER32.
  (func $handle_GetNextDlgTabItem (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $dialog_next_tabstop (local.get $arg0) (local.get $arg1)
        (select (i32.const -1) (i32.const 1) (local.get $arg2))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 662: GetAsyncKeyState — STUB: unimplemented
  ;; GetAsyncKeyState(vKey) — stdcall(1). Reports current key state via host.
  (func $handle_GetAsyncKeyState (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_get_async_key_state (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))) (return)
  )

  ;; 663: MapDialogRect(hDlg, lpRect) — convert dialog units to pixels.
  (func $handle_MapDialogRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $p i32) (local $base_x i32) (local $base_y i32)
    (if (i32.eqz (local.get $arg1))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (local.set $p (call $g2w (local.get $arg1)))
    ;; The units of THIS dialog: a DS_SETFONT template's own font, else stock.
    (local.set $base_x
      (i32.and (call $dialog_base_units (local.get $arg0)) (i32.const 0xFFFF)))
    (local.set $base_y
      (i32.shr_u (call $dialog_base_units (local.get $arg0)) (i32.const 16)))
    ;; x pixels = MulDiv(dialogX, baseX, 4)
    (store.field.memarg Rect left (local.get $p)
      (i32.div_s (i32.mul (load.field.memarg Rect left (local.get $p)) (local.get $base_x)) (i32.const 4)))
    (store.field.memarg Rect right (local.get $p)
      (i32.div_s (i32.mul (load.field.memarg Rect right (local.get $p)) (local.get $base_x)) (i32.const 4)))
    ;; y pixels = MulDiv(dialogY, baseY, 8)
    (store.field.memarg Rect top (local.get $p)
      (i32.div_s (i32.mul (load.field.memarg Rect top (local.get $p)) (local.get $base_y)) (i32.const 8)))
    (store.field.memarg Rect bottom (local.get $p)
      (i32.div_s (i32.mul (load.field.memarg Rect bottom (local.get $p)) (local.get $base_y)) (i32.const 8)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 664: GetDialogBaseUnits() → DWORD (loword=X, hiword=Y base units)
  ;; Win16 SYSTEM_FONT is 8x16; Win32's 8pt MS Sans Serif base is 6x13.
  (func $handle_GetDialogBaseUnits (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (select (i32.const 0x00100008) (i32.const 0x000D0006)
        (global.get $is_win16)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  ;; 665: GetClassNameW(hwnd, lpClassName, nMaxCount) → chars copied.
  ;; The class name comes from the same place GetClassNameA reads it; only
  ;; the encoding handed back differs. A window class named in wide characters
  ;; still matches ASCII everywhere else in this emulator, so a narrow read
  ;; and a widen is the whole of it.
  (func $handle_GetClassNameW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $tmp i32) (local $len i32) (local $control_len i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    (if (i32.or (i32.eqz (local.get $arg1)) (i32.le_s (local.get $arg2) (i32.const 0)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (i32.store16 (call $g2w (local.get $arg1)) (i32.const 0))
    (local.set $tmp (call $heap_alloc (local.get $arg2)))
    (if (i32.eqz (local.get $tmp))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (call $gs8 (local.get $tmp) (i32.const 0))
    (local.set $control_len (call $copy_control_class_name
      (local.get $arg0) (local.get $tmp) (local.get $arg2)))
    (if (i32.ge_s (local.get $control_len) (i32.const 0))
      (then (local.set $len (local.get $control_len)))
      (else
        (local.set $len (call $host_get_window_class
          (local.get $arg0) (call $g2w (local.get $tmp)) (local.get $arg2)))))
    (drop (call $ansi_to_wide (local.get $tmp) (local.get $arg1) (local.get $arg2)))
    (call $heap_free (local.get $tmp))
    (i32.store offset=0 (global.get $reg_base) (local.get $len))
  )

  ;; 666: GetDlgItemInt(hDlg, nIDDlgItem, lpTranslated, bSigned) → UINT
  ;; Reads the child Edit control's WAT-side text buffer directly (via
  ;; state_ptr offsets that match $handle_edit_wndproc WM_GETTEXT) and
  ;; parses a decimal integer. bSigned lets a leading '-' flip the sign.
  ;; *lpTranslated receives TRUE iff at least one digit was consumed.
  (func $handle_GetDlgItemInt (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $child i32) (local $state i32) (local $state_w ptr<ControlTextState>)
    (local $buf_wa i32) (local $text_len i32)
    (local $i i32) (local $c i32) (local $val i32)
    (local $neg i32) (local $ok i32)
    (local.set $val (i32.const 0))
    (local.set $neg (i32.const 0))
    (local.set $ok  (i32.const 0))
    (local.set $child (call $ctrl_find_by_id (local.get $arg0) (local.get $arg1)))
    (if (local.get $child)
      (then
        (local.set $state (call $wnd_get_state_ptr (local.get $child)))
        (if (local.get $state)
          (then
            (local.set $state_w (cast ptr<ControlTextState> (call $g2w (local.get $state))))
            (local.set $text_len (load.field.memarg ControlTextState text_len (local.get $state_w)))
            (if (i32.and
                  (i32.ne (i32.const 0) (load.field ControlTextState text_buf_ptr (local.get $state_w)))
                  (i32.ne (i32.const 0) (local.get $text_len)))
              (then
                (local.set $buf_wa (call $g2w (load.field ControlTextState text_buf_ptr (local.get $state_w))))
                (local.set $i (i32.const 0))
                (block $skip_done (loop $skip
                  (br_if $skip_done (i32.ge_u (local.get $i) (local.get $text_len)))
                  (br_if $skip_done (i32.ne
                    (i32.load8_u (i32.add (local.get $buf_wa) (local.get $i)))
                    (i32.const 0x20)))
                  (local.set $i (i32.add (local.get $i) (i32.const 1)))
                  (br $skip)))
                (if (i32.and (i32.ne (local.get $arg3) (i32.const 0))
                             (i32.lt_u (local.get $i) (local.get $text_len)))
                  (then
                    (if (i32.eq
                          (i32.load8_u (i32.add (local.get $buf_wa) (local.get $i)))
                          (i32.const 0x2D))
                      (then
                        (local.set $neg (i32.const 1))
                        (local.set $i (i32.add (local.get $i) (i32.const 1)))))))
                (block $parse_done (loop $parse
                  (br_if $parse_done (i32.ge_u (local.get $i) (local.get $text_len)))
                  (local.set $c (i32.load8_u (i32.add (local.get $buf_wa) (local.get $i))))
                  (br_if $parse_done (i32.lt_u (local.get $c) (i32.const 0x30)))
                  (br_if $parse_done (i32.gt_u (local.get $c) (i32.const 0x39)))
                  (local.set $val (i32.add
                    (i32.mul (local.get $val) (i32.const 10))
                    (i32.sub (local.get $c) (i32.const 0x30))))
                  (local.set $ok (i32.const 1))
                  (local.set $i (i32.add (local.get $i) (i32.const 1)))
                  (br $parse)))
                (if (local.get $neg)
                  (then (local.set $val (i32.sub (i32.const 0) (local.get $val)))))))))))
    (if (local.get $arg2)
      (then (call $gs32 (local.get $arg2) (local.get $ok))))
    (i32.store offset=0 (global.get $reg_base) (local.get $val))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))  ;; stdcall, 4 args
  )

  ;; 667: GetDlgItemTextW(hDlg, nIDDlgItem, lpString, cchMax) — the same read
  ;; GetDlgItemTextA does, staged through an ANSI buffer of the same character
  ;; count and widened into the caller's. It used to answer "" for every
  ;; control, which is a wrong answer rather than a missing one.
  (func $handle_GetDlgItemTextW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $tmp i32) (local $len i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
    (if (i32.or (i32.eqz (local.get $arg2)) (i32.le_s (local.get $arg3) (i32.const 0)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (i32.store16 (call $g2w (local.get $arg2)) (i32.const 0))
    (local.set $tmp (call $heap_alloc (local.get $arg3)))
    (if (i32.eqz (local.get $tmp))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (call $gs8 (local.get $tmp) (i32.const 0))
    (local.set $len (call $dlg_item_text_ansi
      (local.get $arg0) (local.get $arg1) (local.get $tmp) (local.get $arg3)))
    (drop (call $ansi_to_wide (local.get $tmp) (local.get $arg2) (local.get $arg3)))
    (call $heap_free (local.get $tmp))
    (i32.store offset=0 (global.get $reg_base) (local.get $len))
  )

  ;; 668: SetDlgItemTextW — return 1, 3 args stdcall
  ;; SetDlgItemTextW(hDlg, nIDDlgItem, lpString) — narrow and hand to the A
  ;; path, which owns the window-text table and the WM_SETTEXT dispatch.
  ;;
  ;; This used to return TRUE without storing anything. Every field a Unicode
  ;; app filled in was then blank with no diagnostic: XP Sound Recorder's
  ;; File > Properties sets its name, copyright, length, data size and audio
  ;; format this way, and the whole sheet rendered empty.
  (func $handle_SetDlgItemTextW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $narrow i32) (local $n i32)
    (if (i32.ge_u (local.get $arg2) (i32.const 0x10000))
      (then
        (local.set $n (i32.add (call $guest_wcslen (local.get $arg2)) (i32.const 1)))
        (local.set $narrow (call $heap_alloc (local.get $n)))
        (if (local.get $narrow)
          (then (drop (call $wide_to_ansi
                  (local.get $arg2) (local.get $narrow) (local.get $n)))))))
    (call $handle_SetDlgItemTextA
      (local.get $arg0) (local.get $arg1) (local.get $narrow)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
    (if (local.get $narrow) (then (call $heap_free (local.get $narrow))))
  )

  ;; 669: IsDlgButtonChecked — BST_UNCHECKED(0) or BST_CHECKED(1)
  (func $handle_IsDlgButtonChecked (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ctrl_hwnd i32)
    (local.set $ctrl_hwnd (call $ctrl_find_by_id (local.get $arg0) (local.get $arg1)))
    (if (local.get $ctrl_hwnd)
      (then (i32.store offset=0 (global.get $reg_base) (call $ctrl_get_check_state (local.get $ctrl_hwnd))))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 670: ScrollWindowEx(hWnd, dx, dy, prcScroll, prcClip, hrgnUpdate,
  ;;                     prcUpdate, flags) → region complexity.
  ;; Scroll the host backing store when possible, report the invalidated area,
  ;; and mark the window for repaint. Region details are approximated to a
  ;; single rectangle, but prcScroll/prcClip are intersected in client coords.
  (func $handle_ScrollWindowEx (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $l i32) (local $t i32) (local $r i32) (local $b i32)
    (local $wa i32) (local $cs i32) (local $prcUpdate i32)
    (if (i32.eqz (local.get $arg0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36)))
        (return)))
    (drop
      (call $gdi_native_scroll_window
        (local.get $arg0) (local.get $arg1) (local.get $arg2)
        (local.get $arg3) (local.get $arg4)))
    (if (local.get $arg3)
      (then
        (local.set $wa (call $g2w (local.get $arg3)))
        (local.set $l (load.field Rect left (local.get $wa)))
        (local.set $t (load.field.memarg Rect top (local.get $wa)))
        (local.set $r (load.field.memarg Rect right (local.get $wa)))
        (local.set $b (load.field.memarg Rect bottom (local.get $wa))))
      (else
        (local.set $cs (call $host_get_window_client_size (local.get $arg0)))
        (local.set $l (i32.const 0))
        (local.set $t (i32.const 0))
        (local.set $r (i32.and (local.get $cs) (i32.const 0xFFFF)))
        (local.set $b (i32.shr_u (local.get $cs) (i32.const 16)))))
    (if (local.get $arg4)
      (then
        (local.set $wa (call $g2w (local.get $arg4)))
        (if (i32.gt_s (load.field Rect left (local.get $wa)) (local.get $l))
          (then (local.set $l (load.field Rect left (local.get $wa)))))
        (if (i32.gt_s (load.field.memarg Rect top (local.get $wa)) (local.get $t))
          (then (local.set $t (load.field.memarg Rect top (local.get $wa)))))
        (if (i32.lt_s (load.field.memarg Rect right (local.get $wa)) (local.get $r))
          (then (local.set $r (load.field.memarg Rect right (local.get $wa)))))
        (if (i32.lt_s (load.field.memarg Rect bottom (local.get $wa)) (local.get $b))
          (then (local.set $b (load.field.memarg Rect bottom (local.get $wa)))))))
    ;; prcUpdate is the 7th argument at [esp+28].
    (local.set $prcUpdate (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
    (if (i32.or
          (i32.le_s (local.get $r) (local.get $l))
          (i32.le_s (local.get $b) (local.get $t)))
      (then
        (if (local.get $prcUpdate)
          (then
            (local.set $wa (call $g2w (local.get $prcUpdate)))
            (i64.store (local.get $wa) (i64.const 0))
            (i64.store offset=8 (local.get $wa) (i64.const 0))))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1)) ;; NULLREGION
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36)))
        (return)))
    (if (local.get $prcUpdate)
      (then
        (local.set $wa (call $g2w (local.get $prcUpdate)))
        (store.field Rect left (local.get $wa) (local.get $l))
        (store.field.memarg Rect top (local.get $wa) (local.get $t))
        (store.field.memarg Rect right (local.get $wa) (local.get $r))
        (store.field.memarg Rect bottom (local.get $wa) (local.get $b))))
    (call $update_invalidate_rect (local.get $arg0) (local.get $l) (local.get $t) (local.get $r) (local.get $b))
    (if (i32.eq (local.get $arg0) (global.get $main_hwnd))
      (then (global.set $paint_pending (i32.const 1)))
      (else (call $paint_flag_set (local.get $arg0))))
    (call $host_invalidate (local.get $arg0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 2)) ;; SIMPLEREGION
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36)))
  )

  ;; 671: IsDialogMessageW — same policy as A: let the app dispatch messages.
  (func $handle_IsDialogMessageW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IsDialogMessageA
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

Layout(hdc) -> DWORD — return 0 (LTR layout)
 676: SetCursorPos(x, y) → BOOL — 2 args stdcall
  (func $handle_SetCursorPos (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $host_set_mouse_position (local.get $arg0) (local.get $arg1))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 677: DestroyCursor — release built cursors and private CopyImage wrappers.
  ;; Shared LoadCursor handles remain valid, matching USER's shared-resource
  ;; ownership, while a stale copied handle fails instead of succeeding again.
  ;; Encoded IDC/resource handles have no allocation behind them. CURSOR_TABLE
  ;; records own their bitmap planes, and the private ICON_TABLE marker owns
  ;; only its wrapper slot. The shared helper distinguishes all three forms,
  ;; keeping DestroyCursor and DestroyIcon lifetime behavior consistent.
  (func $handle_DestroyCursor (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $icon_destroy_handle (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 678: FindWindowW(lpClassName, lpWindowName) → HWND. Window records retain
  ;; canonical byte class/title strings, so compare the caller's UTF-16 filters
  ;; against those records rather than misreading them through the A handler.
  (func $handle_FindWindowW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $find_window_core
      (i32.const 0) (i32.const 0) (local.get $arg0) (local.get $arg1)
      (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; 679: GetTabbedTextExtentW — packed width/height for UTF-16 text.
  (func $handle_GetTabbedTextExtentW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $gdi_tabbed_text
      (local.get $arg0) (i32.const 0) (i32.const 0)
      (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4)
      (i32.const 0) (i32.const 1) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
  )

  ;; 680: UnregisterClassW(lpClassName, hInstance). Convert the UTF-16 class
  ;; name before lookup; class atoms use the same low-word form as the A API.
  (func $handle_UnregisterClassW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $unregister_class_core
        (local.get $arg0) (local.get $arg1) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; Show or hide every top-level popup directly owned by hwndOwner. OWNER_TABLE
  ;; is separate from the child-parent hierarchy, matching USER: an owned popup
  ;; keeps screen-relative geometry and its own browser surface.
  (func $show_owned_popups_core (param $owner i32) (param $show i32) (result i32)
    (local $i i32) (local $rec i32) (local $hwnd i32)
    (local $style i32) (local $new_style i32)
    (if (i32.lt_s (call $wnd_table_find (local.get $owner)) (i32.const 0))
      (then (return (i32.const 0))))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $MAX_WINDOWS)))
      (local.set $rec (call $wnd_record_addr (local.get $i)))
      (local.set $hwnd (i32.atomic.load (local.get $rec)))
      (if (i32.and
            (i32.ne (local.get $hwnd) (i32.const 0))
            (i32.and
              (i32.eq (call $wnd_get_owner (local.get $hwnd)) (local.get $owner))
              (i32.eqz (i32.and (call $wnd_get_style (local.get $hwnd))
                                (i32.const 0x40000000))))) ;; !WS_CHILD
        (then
          (local.set $style (call $wnd_get_style (local.get $hwnd)))
          (local.set $new_style
            (if (result i32) (i32.ne (local.get $show) (i32.const 0))
              (then (i32.or (local.get $style) (i32.const 0x10000000)))
              (else (i32.and (local.get $style) (i32.const 0xEFFFFFFF)))))
          (if (i32.ne (local.get $new_style) (local.get $style))
            (then
              ;; WM_SHOWWINDOW reports an owner-driven transition. Win9x uses
              ;; SW_PARENTCLOSING(1) while hiding and SW_PARENTOPENING(3) while
              ;; restoring owned popups.
              (drop (call $post_queue_push
                (local.get $hwnd) (i32.const 0x0018)
                (i32.ne (local.get $show) (i32.const 0))
                (select (i32.const 3) (i32.const 1)
                  (i32.ne (local.get $show) (i32.const 0)))))
              (if (local.get $show)
                (then
                  (drop (call $host_show_window (local.get $hwnd) (i32.const 5))) ;; SW_SHOW
                  (drop (call $wnd_set_style (local.get $hwnd) (local.get $new_style)))
                  (call $nc_flags_set (local.get $hwnd) (i32.const 2)))
                (else
                  (call $wnd_uncover_parent (local.get $hwnd))
                  (drop (call $host_show_window (local.get $hwnd) (i32.const 0))) ;; SW_HIDE
                  (drop (call $wnd_set_style (local.get $hwnd) (local.get $new_style)))
                  (call $paint_clear_subtree (local.get $hwnd))))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 1))

  ;; 681: ShowOwnedPopups(hwndOwner, fShow)
  (func $handle_ShowOwnedPopups (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $show_owned_popups_core (local.get $arg0) (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; CopyAcceleratorTableW(hAccel, lpAccelDst, cAccelEntries). ACCEL contains no
  ;; text, so A/W have the same six-byte public representation.
  (func $handle_CopyAcceleratorTableW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $accel_table_copy (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 685: InSendMessage — TRUE only while this window procedure is processing
  ;; a SendMessage delivered by another guest thread. $sync_msg_depth is
  ;; broader because same-thread recursive sends need the same interpreter
  ;; protection; the owner-thread dispatcher maintains the narrower depth.
  (func $handle_InSendMessage (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.ne (global.get $cross_thread_send_depth) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; ReplyMessage(lResult). Outside a SendMessage from another thread it
  ;; returns FALSE, which is the answer DirectShow's worker windows get for
  ;; their posted messages. Inside one it fixes the LRESULT the sender will
  ;; receive. The sender is still released only when the WndProc returns —
  ;; every host driver runs the receiving WndProc to completion — so a
  ;; receiver that then waits on its sender would deadlock here where it
  ;; would not on Windows; that has not been seen yet.
  (func $handle_ReplyMessage (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
    (if (i32.or (i32.eqz (global.get $cross_thread_send_depth))
                (i32.eq (global.get $send_reply_depth) (global.get $cross_thread_send_depth)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    ;; One slot: a nested send replying while an outer reply is pending.
    (if (global.get $send_reply_depth)
      (then (call $crash_unimplemented (local.get $name_ptr))))
    (global.set $send_reply_depth (global.get $cross_thread_send_depth))
    (global.set $send_reply_value (local.get $arg0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1)))

  ;; EnumWindows(lpEnumFunc, lParam) — enumerate top-level windows through the
  ;; same CACA002B suspended walk used by EnumChildWindows. A parent sentinel of
  ;; zero selects top-level records instead of descendant records.
  (func $handle_EnumWindows (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret i32)
    (local.set $ret (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
    (call $enum_window_walk_begin
      (i32.const 0) (local.get $arg0) (local.get $arg1) (local.get $ret))
  )

  ;; EnumThreadWindows(dwThreadId, lpfn, lParam). WND_RECORDS does not yet keep
  ;; thread ownership, so enumerate the process's top-level records rather than
  ;; returning success without ever invoking the callback.
  (func $handle_EnumThreadWindows (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret i32)
    (local.set $ret (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    (call $enum_window_walk_begin
      (i32.const 0) (local.get $arg1) (local.get $arg2) (local.get $ret))
  )

  ;; EnumSystemCodePagesA(lpCodePageEnumProc, dwFlags). Report the process ANSI
  ;; code page through the real callback contract instead of a silent success.
  (func $handle_EnumSystemCodePagesA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret i32) (local $value i32)
    (local.set $ret (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
    (local.set $value (i32.const 0x2DA))
    (i32.store (local.get $value) (i32.const 0x32353132)) ;; "1252"
    (i32.store8 offset=4 (local.get $value) (i32.const 0))
    (call $system_string_enum_a (local.get $arg0) (local.get $value) (local.get $ret))
  )

  ;; PostThreadMessageA/W(threadId, msg, wParam, lParam) — post to the target's
  ;; shared USER queue with hwnd=0. Thread ids are the same 1..8 values returned
  ;; by GetCurrentThreadId, not thread handles.
  (func $handle_PostThreadMessageA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $queue i32) (local $slot i32) (local $cnt i32) (local $tail i32)
    (local.set $queue (call $thread_msg_queue_addr (local.get $arg0)))
    (if (i32.eqz (local.get $queue))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (else
        (call $lock_wnd_acquire)
        (local.set $cnt (i32.load (local.get $queue)))
        (if (i32.ge_u (local.get $cnt) (global.get $THREAD_MSG_QUEUE_MAX))
          (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
          (else
            (local.set $tail (i32.load offset=8 (local.get $queue)))
            (local.set $slot (i32.add (local.get $queue)
              (i32.add (i32.const 0x10) (i32.mul (local.get $tail) (i32.const 16)))))
            (i32.store (local.get $slot) (i32.const 0))
            (i32.store offset=4 (local.get $slot) (local.get $arg1))
            (i32.store offset=8 (local.get $slot) (local.get $arg2))
            (i32.store offset=12 (local.get $slot) (local.get $arg3))
            (i32.store offset=8 (local.get $queue)
              (i32.rem_u (i32.add (local.get $tail) (i32.const 1))
                (global.get $THREAD_MSG_QUEUE_MAX)))
            (i32.store (local.get $queue) (i32.add (local.get $cnt) (i32.const 1)))
            (i32.store offset=0 (global.get $reg_base) (i32.const 1))))
        (call $lock_wnd_release)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  (func $handle_PostThreadMessageW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_PostThreadMessageA (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; 688: WindowFromDC — return the live window bound to this display DC.
  (func $handle_WindowFromDC (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $binding i32) (local $hwnd i32)
    (local.set $binding
      (call $gdi_dc_get_field (local.get $arg0) (i32.const 92) (i32.const 0)))
    (local.set $hwnd (i32.and (local.get $binding) (i32.const 0x7FFFFFFF)))
    (if (i32.and
          (i32.ne (local.get $hwnd) (i32.const 0))
          (i32.ne (call $wnd_table_find (local.get $hwnd)) (i32.const -1)))
      (then (i32.store offset=0 (global.get $reg_base) (local.get $hwnd)))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 689: CountClipboardFormats()
  (func $handle_CountClipboardFormats (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (drop (local.get $arg0))
    (drop (local.get $arg1))
    (drop (local.get $arg2))
    (drop (local.get $arg3))
    (drop (local.get $arg4))
    (drop (local.get $name_ptr))
    (i32.store offset=0 (global.get $reg_base) (call $clipboard_count_formats))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; Return the materialized clipboard format after $current. USER keeps an
  ;; ordered list; our bounded clipboard has four concrete entries instead:
  ;; opaque/DIB, registered RTF, and the ANSI/OEM text conversion pair. Keep
  ;; the richer formats first, as applications are instructed to publish them.
  ;; -1 means $current was not one of the currently available formats; zero is
  ;; the normal end-of-enumeration result.
  (func $clipboard_enum_next (param $current i32) (result i32)
    (local $seen i32) (local $candidate i32)
    (local.set $seen (i32.eqz (local.get $current)))

    (if (i32.and
          (i32.ne (global.get $clipboard_binary_format) (i32.const 0))
          (i32.ne (global.get $clipboard_binary_ptr) (i32.const 0)))
      (then
        (local.set $candidate (global.get $clipboard_binary_format))
        (if (local.get $seen) (then (return (local.get $candidate))))
        (if (i32.eq (local.get $current) (local.get $candidate))
          (then (local.set $seen (i32.const 1))))))

    (if (i32.and
          (i32.ne (global.get $clipboard_rtf_format_id) (i32.const 0))
          (i32.ne (global.get $clipboard_rtf_present) (i32.const 0)))
      (then
        (local.set $candidate (global.get $clipboard_rtf_format_id))
        (if (local.get $seen) (then (return (local.get $candidate))))
        (if (i32.eq (local.get $current) (local.get $candidate))
          (then (local.set $seen (i32.const 1))))))

    (if (i32.ne (global.get $clipboard_text_present) (i32.const 0))
      (then
        ;; CF_TEXT is the stored representation. CF_OEMTEXT follows as the
        ;; system-provided conversion exposed by GetClipboardData.
        (local.set $candidate (i32.const 1))
        (if (local.get $seen) (then (return (local.get $candidate))))
        (if (i32.eq (local.get $current) (local.get $candidate))
          (then (local.set $seen (i32.const 1))))
        (local.set $candidate (i32.const 7))
        (if (local.get $seen) (then (return (local.get $candidate))))
        (if (i32.eq (local.get $current) (local.get $candidate))
          (then (local.set $seen (i32.const 1))))))

    (select (i32.const 0) (i32.const -1) (local.get $seen)))

  ;; EnumClipboardFormats(format). The clipboard must remain open across the
  ;; sequence. A zero result with ERROR_SUCCESS is the documented end marker;
  ;; zero with another error is a failure.
  (func $handle_EnumClipboardFormats (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $next_format i32)
    (if (i32.eqz (global.get $clipboard_open))
      (then
        (global.set $last_error (i32.const 1418)) ;; ERROR_CLIPBOARD_NOT_OPEN
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (local.set $next_format (call $clipboard_enum_next (local.get $arg0)))
    (if (i32.eq (local.get $next_format) (i32.const -1))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (else
        (i32.store offset=0 (global.get $reg_base) (local.get $next_format))
        (if (i32.eqz (local.get $next_format))
          (then (global.set $last_error (i32.const 0))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; EmptyClipboard() — clear all supported clipboard data, notify the old
  ;; owner synchronously, then make the opening HWND the new owner.
  (func $handle_EmptyClipboard (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (drop (local.get $arg0))
    (drop (local.get $arg1))
    (drop (local.get $arg2))
    (drop (local.get $arg3))
    (drop (local.get $arg4))
    (drop (local.get $name_ptr))
    (if (i32.eqz (global.get $clipboard_open))
      (then
        (global.set $last_error (i32.const 1418)) ;; ERROR_CLIPBOARD_NOT_OPEN
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (return)))
    (if (i32.and
          (i32.ne (global.get $clipboard_owner_hwnd) (i32.const 0))
          (i32.ge_s
            (call $wnd_table_find (global.get $clipboard_owner_hwnd))
            (i32.const 0)))
      (then
        (drop (call $wnd_send_message
          (global.get $clipboard_owner_hwnd)
          (i32.const 0x0307) ;; WM_DESTROYCLIPBOARD
          (i32.const 0) (i32.const 0)))))
    (call $clipboard_clear_all_data)
    (global.set $clipboard_owner_hwnd (global.get $clipboard_open_hwnd))
    (global.set $clipboard_emptied_by_opener (i32.const 1)) (call $clipboard_sequence_bump)
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; SetClipboardData(uFormat, hMem) — copy CF_TEXT/CF_OEMTEXT and registered
  ;; non-OLE Rich Text Format payloads into emulator-owned buffers. CF_DIB is
  ;; copied as opaque HGLOBAL bytes for the RichEdit static-object path. Other
  ;; formats remain inert success until their ownership rules are implemented.
  (func $handle_SetClipboardData (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $len i32) (local $copy i32)
    (drop (local.get $arg2))
    (drop (local.get $arg3))
    (drop (local.get $arg4))
    (drop (local.get $name_ptr))
    (if (i32.eqz
          (i32.and
            (i32.ne (global.get $clipboard_open) (i32.const 0))
            (i32.and
              (i32.ne
                (global.get $clipboard_emptied_by_opener) (i32.const 0))
              (i32.ne (global.get $clipboard_owner_hwnd) (i32.const 0)))))
      (then
        (global.set $last_error (i32.const 1418)) ;; ERROR_CLIPBOARD_NOT_OPEN
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (if (i32.eqz (local.get $arg1))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (if (i32.and
          (i32.ne (global.get $clipboard_rtf_format_id) (i32.const 0))
          (i32.eq (local.get $arg0) (global.get $clipboard_rtf_format_id)))
      (then
        (i32.store offset=0 (global.get $reg_base) (if (result i32) (call $clipboard_store_rtf_data (local.get $arg1))
            (then (local.get $arg1))
            (else (i32.const 0)))) (if (i32.load offset=0 (global.get $reg_base)) (then (call $clipboard_sequence_bump)))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (if (i32.eqz
          (i32.or (i32.eq (local.get $arg0) (i32.const 1))  ;; CF_TEXT
                  (i32.eq (local.get $arg0) (i32.const 7)))) ;; CF_OEMTEXT
      (then
        (if (i32.eq (local.get $arg0) (i32.const 8)) ;; CF_DIB
          (then
            ;; Public callers supply a live HGLOBAL, not an arbitrary pointer
            ;; with a plausible size word before it. The internal copy helper
            ;; also serves trusted host image injection from ordinary heap blocks.
            (if (i32.eqz (call $heap_global_block_size (local.get $arg1) (i32.const 0)))
              (then
                (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
                (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
              (else
                (i32.store offset=0 (global.get $reg_base)
                  (if (result i32) (call $clipboard_store_binary_data (local.get $arg0) (local.get $arg1))
                    (then (local.get $arg1)) (else (i32.const 0))))))
            (if (i32.load offset=0 (global.get $reg_base)) (then (call $clipboard_sequence_bump)))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
            (return)))
        (i32.store offset=0 (global.get $reg_base) (local.get $arg1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    ;; Duplicate through guest-aware accesses, before retiring the old snapshot.
    ;; The caller string may exceed guest_strlen's cap or span sparse pages.
    (local.set $copy (call $guest_strdup (local.get $arg1)))
    (if (i32.eqz (local.get $copy))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    ;; The newly allocated heap copy is contiguous and fully terminated.
    (local.set $len (call $strlen (call $g2w (local.get $copy))))
    (if (global.get $clipboard_ptr)
      (then (call $heap_free (global.get $clipboard_ptr))))
    (call $richedit_clipboard_clear_format)
    (global.set $clipboard_ptr (local.get $copy))
    (global.set $clipboard_cap (i32.add (local.get $len) (i32.const 1)))
    (global.set $clipboard_text_present (i32.const 1)) (global.set $clipboard_len (local.get $len)) (call $clipboard_sequence_bump)
    (i32.store offset=0 (global.get $reg_base) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; GetClipboardOwner() returns the HWND that most recently emptied the
  ;; clipboard. Data remains valid if that window has since gone away, but the
  ;; stale HWND is no longer an owner.
  (func $handle_GetClipboardOwner (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (drop (local.get $arg0))
    (drop (local.get $arg1))
    (drop (local.get $arg2))
    (drop (local.get $arg3))
    (drop (local.get $arg4))
    (drop (local.get $name_ptr))
    (if (i32.and
          (i32.ne (global.get $clipboard_owner_hwnd) (i32.const 0))
          (i32.lt_s
            (call $wnd_table_find (global.get $clipboard_owner_hwnd))
            (i32.const 0)))
      (then (global.set $clipboard_owner_hwnd (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (global.get $clipboard_owner_hwnd))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; GetClipboardSequenceNumber() — the process-wide/window-station serial;
  ;; successful materialized mutations advance it, failures and polls do not.
  (func $handle_GetClipboardSequenceNumber (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $clipboard_sequence_get))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  ;; 690: SetWindowContextHelpId(hwnd, dwContextHelpId). No imported getter
  ;; currently observes the value, but frameworks use the BOOL result while
  ;; initializing a real HWND (VB6 passes -1 to disable context help).
  (func $handle_SetWindowContextHelpId (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (if (result i32) (i32.ge_s (call $wnd_table_find (local.get $arg0)) (i32.const 0))
        (then (i32.const 1))
        (else (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 691: GetNextDlgGroupItem(hDlg, hCtl, bPrevious) — the arrow-key walk, the
  ;; same one IsDialogMessage uses. bPrevious reverses it; both directions
  ;; wrap inside the WS_GROUP run, matching USER32.
  (func $handle_GetNextDlgGroupItem (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $dialog_next_group_item (local.get $arg0) (local.get $arg1)
        (select (i32.const -1) (i32.const 1) (local.get $arg2))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 692: ClipCursor(lprc) — store the screen-coordinate confinement rect.
  ;; JS clamps subsequent mouse input to this rect so apps that watch for the
  ;; cursor reaching a clipped edge (Bricks/Klotski) see Win32-like coords.
  (func $handle_ClipCursor (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $rc i32)
    (if (i32.eqz (local.get $arg0))
      (then
        (global.set $clip_cursor_active (i32.const 0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (local.set $rc (call $g2w (local.get $arg0)))
    (global.set $clip_cursor_l (load.field Rect left (local.get $rc)))
    (global.set $clip_cursor_t (load.field.memarg Rect top (local.get $rc)))
    (global.set $clip_cursor_r (load.field.memarg Rect right (local.get $rc)))
    (global.set $clip_cursor_b (load.field.memarg Rect bottom (local.get $rc)))
    (global.set $clip_cursor_active
      (i32.and
        (i32.lt_s (global.get $clip_cursor_l) (global.get $clip_cursor_r))
        (i32.lt_s (global.get $clip_cursor_t) (global.get $clip_cursor_b))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; GetClipCursor(lpRect) returns the current screen-coordinate confinement.
  ;; With no explicit ClipCursor rectangle, Windows reports the full virtual
  ;; screen rather than failing; fullscreen games use that successful query
  ;; while switching from a menu cursor to their playfield cursor.
  (func $handle_GetClipCursor (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $rc i32)
    (if (i32.eqz (local.get $arg0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (local.set $rc (call $g2w (local.get $arg0)))
    (store.field Rect left (local.get $rc)
      (select (global.get $clip_cursor_l) (i32.const 0)
        (global.get $clip_cursor_active)))
    (store.field Rect top (local.get $rc)
      (select (global.get $clip_cursor_t) (i32.const 0)
        (global.get $clip_cursor_active)))
    (store.field Rect right (local.get $rc)
      (select (global.get $clip_cursor_r) (call $screen_metric_w)
        (global.get $clip_cursor_active)))
    (store.field Rect bottom (local.get $rc)
      (select (global.get $clip_cursor_b) (call $screen_metric_h)
        (global.get $clip_cursor_active)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 693: EnumChildWindows — STUB: unimplemented
  ;; EnumChildWindows(hwndParent, lpEnumFunc, lParam)
  ;;
  ;; Win32 enumerates every descendant, not just immediate children, and stops
  ;; early when the callback returns FALSE. Each callback is a guest call, so
  ;; the walk suspends on the CACA002B continuation and resumes at the next
  ;; slot — the same shape as the D3D device enumerators.
  (func $enum_child_is_descendant (param $hwnd i32) (param $ancestor i32) (result i32)
    (call $wnd_is_child (local.get $ancestor) (local.get $hwnd)))

  ;; Finish the walk: drop the saved API return address and resume the caller.
  ;; EnumChildWindows reports TRUE whenever it ran, including a callback-
  ;; requested early stop.
  (func $enum_child_finish
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (global.set $eip (global.get $enum_child_ret))
    (global.set $enum_child_depth (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1)))

  ;; Invoke the callback for the next matching record at or after
  ;; $enum_child_slot. parent=0 selects top-level records; otherwise it selects
  ;; every descendant of that parent.
  (func $enum_child_dispatch
    (local $slot i32) (local $hwnd i32)
    (local.set $slot (global.get $enum_child_slot))
    (block $found (loop $scan
      (if (i32.ge_u (local.get $slot) (global.get $MAX_WINDOWS))
        (then (call $enum_child_finish) (return)))
      (local.set $hwnd (call $wnd_slot_hwnd (local.get $slot)))
      (br_if $found
        (i32.and
          (i32.ne (local.get $hwnd) (i32.const 0))
          (if (result i32) (global.get $enum_child_parent)
            (then (call $enum_child_is_descendant
              (local.get $hwnd) (global.get $enum_child_parent)))
            (else (i32.eqz (call $wnd_get_parent (local.get $hwnd)))))))
      (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
      (br $scan)))
    (global.set $enum_child_slot (local.get $slot))
    ;; WNDENUMPROC(hwnd, lParam), stdcall — push right to left.
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $enum_child_lparam))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $hwnd))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $enum_child_thunk))
    (global.set $eip (global.get $enum_child_cb))
    (global.set $steps (i32.const 0)))

  ;; CACA002B: the callback returned. FALSE stops the walk.
  (func $enum_child_continue
    (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
      (then (call $enum_child_finish) (return)))
    (global.set $enum_child_slot (i32.add (global.get $enum_child_slot) (i32.const 1)))
    (call $enum_child_dispatch))

  ;; Start either the EnumWindows/EnumThreadWindows top-level walk or the
  ;; EnumChildWindows descendant walk after its public handler has removed the
  ;; original stdcall frame.
  (func $enum_window_walk_begin (param $parent i32) (param $callback i32)
        (param $lparam i32) (param $ret i32)
    (if (i32.or (i32.eqz (local.get $callback)) (global.get $enum_child_depth))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))
        (global.set $eip (local.get $ret))
        (return)))
    (global.set $enum_child_depth (i32.const 1))
    (global.set $enum_child_parent (local.get $parent))
    (global.set $enum_child_cb (local.get $callback))
    (global.set $enum_child_lparam (local.get $lparam))
    (global.set $enum_child_ret (local.get $ret))
    (global.set $enum_child_slot (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $ret))
    (call $enum_child_dispatch))

  (func $handle_EnumChildWindows (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret i32)
    (local.set $ret (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))) ;; ret addr + 3 args
    (call $enum_window_walk_begin
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $ret))
  )

  ;; 694: InvalidateRgn(hwnd, hrgn, bErase). hrgn=NULL → full client rect.
  (func $handle_InvalidateRgn (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $cs i32) (local $rt i32) (local $box i32)
    (if (i32.eqz (local.get $arg0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))) (return)))
    (if (local.get $arg1)
      (then
        (local.set $box (call $paint_scratch_take))
        (local.set $rt (call $gdi_rgn_get_box (local.get $arg1) (local.get $box)))
        (if (local.get $rt)
          (then
            (call $update_invalidate_rect (local.get $arg0)
              (load.field PaintRect left (local.get $box))
              (load.field.memarg PaintRect top (local.get $box))
              (load.field.memarg PaintRect right (local.get $box))
              (load.field.memarg PaintRect bottom (local.get $box))))))
      (else
        (local.set $cs (call $host_get_window_client_size (local.get $arg0)))
        (call $update_invalidate_rect (local.get $arg0) (i32.const 0) (i32.const 0)
          (i32.and (local.get $cs) (i32.const 0xFFFF))
          (i32.shr_u (local.get $cs) (i32.const 16)))))
    (if (i32.eq (local.get $arg0) (global.get $main_hwnd))
      (then (global.set $paint_pending (i32.const 1)))
      (else (call $paint_flag_set (local.get $arg0))))
    (call $host_invalidate (local.get $arg0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))) (return)
  )

  ;; 4166: ValidateRgn(hwnd, hrgn) -> BOOL. The update region is kept as one
  ;; rectangle, so this validates hrgn's bounding box, the same reduction
  ;; InvalidateRgn makes; hrgn NULL validates the whole client area, as
  ;; ValidateRect(hwnd, NULL) does. A NULL hwnd is TRUE and changes nothing.
  ;; Dark Earth's demo calls it after drawing its window itself.
  (func $handle_ValidateRgn (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $cs i32) (local $box i32) (local $empty i32) (local $l i32) (local $t i32) (local $r i32) (local $b i32)
    (if (local.get $arg0)
      (then
        (if (local.get $arg1)
          (then
            (local.set $box (call $paint_scratch_take))
            (if (call $gdi_rgn_get_box (local.get $arg1) (local.get $box))
              (then
                (local.set $l (load.field PaintRect left (local.get $box)))
                (local.set $t (load.field.memarg PaintRect top (local.get $box)))
                (local.set $r (load.field.memarg PaintRect right (local.get $box)))
                (local.set $b (load.field.memarg PaintRect bottom (local.get $box))))))
          (else
            (local.set $cs (call $host_get_window_client_size (local.get $arg0)))
            (local.set $r (i32.and (local.get $cs) (i32.const 0xFFFF)))
            (local.set $b (i32.shr_u (local.get $cs) (i32.const 16)))))
        (local.set $empty (call $update_validate_rect (local.get $arg0)
          (local.get $l) (local.get $t) (local.get $r) (local.get $b)))
        (if (local.get $empty)
          (then
            (if (i32.eq (local.get $arg0) (global.get $main_hwnd))
              (then (global.set $paint_pending (i32.const 0)))
              (else (call $paint_flag_clear_hwnd (local.get $arg0))))))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; 695: LoadStringW — load UTF-16 string resource
  (func $handle_LoadStringW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $push_rsrc_ctx (local.get $arg0))
    (i32.store offset=0 (global.get $reg_base) (call $string_load_w
      (local.get $arg1)                ;; string ID
      (call $g2w (local.get $arg2))    ;; buffer (WASM ptr)
      (local.get $arg3)))              ;; max chars
    (call $pop_rsrc_ctx)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; 696: CharUpperW(lpsz) — the wide twin of CharUpperA, with the same two
  ;; modes: a HIWORD of 0 means lpsz is a single character rather than a
  ;; pointer, and a string is uppercased in place. Only a-z is folded, which
  ;; is the same range the ANSI side folds; the rest of UTF-16 is left alone
  ;; rather than guessed at.
  ;; CharUpper's two spellings differ only in the width of the characters they
  ;; walk: with a high word of zero the argument is a single character to
  ;; uppercase and return, otherwise it is a pointer to a string uppercased in
  ;; place. Returns the input unchanged (char or pointer) either way.
  (func $char_upper (param $arg i32) (param $wide i32) (result i32)
    (local $p_g i32) (local $c i32) (local $step i32)
    (if (i32.eqz (i32.and (local.get $arg) (i32.const 0xffff0000)))
      (then
        (local.set $c (i32.and (local.get $arg)
          (select (i32.const 0xffff) (i32.const 0xff) (local.get $wide))))
        (if (i32.and (i32.ge_u (local.get $c) (i32.const 0x61))
                     (i32.le_u (local.get $c) (i32.const 0x7a)))
          (then (return (i32.sub (local.get $c) (i32.const 0x20)))))
        (return (local.get $arg))))
    (local.set $step (select (i32.const 2) (i32.const 1) (local.get $wide)))
    (local.set $p_g (local.get $arg))
    (block $done (loop $lp
      (local.set $c (call $gl_char (local.get $p_g) (local.get $wide)))
      (br_if $done (i32.eqz (local.get $c)))
      (if (i32.and (i32.ge_u (local.get $c) (i32.const 0x61))
                   (i32.le_u (local.get $c) (i32.const 0x7a)))
        (then (call $store_char (local.get $p_g)
                (i32.sub (local.get $c) (i32.const 0x20)) (local.get $wide))))
      (local.set $p_g (i32.add (local.get $p_g) (local.get $step)))
      (br $lp)))
    (local.get $arg))

  (func $handle_CharUpperW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $char_upper (local.get $arg0) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; CharUpperA(lpsz) — if high word is 0, uppercase the single char; else
  ;; lpsz is a pointer to a nul-terminated ANSI string uppercased in place.
  ;; Returns the input unchanged (char or pointer).
  (func $handle_CharUpperA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $char_upper (local.get $arg0) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; SwapMouseButton(fSwap) sets the user's primary-button setting and returns
  ;; whether the buttons were swapped before the call. SM_SWAPBUTTON reads the
  ;; same state. The host pointer still delivers the physical left button as
  ;; WM_LBUTTONDOWN; games call this to read the setting (and restore it), not
  ;; to remap a mouse the emulator's user is holding.
  (global $mouse_buttons_swapped (mut i32) (i32.const 0))
  (func $handle_SwapMouseButton (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (global.get $mouse_buttons_swapped))
    (global.set $mouse_buttons_swapped (i32.ne (local.get $arg0) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )
