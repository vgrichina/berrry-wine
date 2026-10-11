  ;; ============================================================
  ;; STEP 5 dormant additions: $wnd_send_message + $create_findreplace_dialog
  ;; ============================================================
  ;; Status: STEP 5 — dormant. The helpers below compile and are reachable
  ;; only by future code. $handle_FindTextA still calls $host_show_find_dialog,
  ;; the JS-side find dialog is unchanged, and the test gate is unaffected.
  ;; STEP 8 will (a) flip $handle_FindTextA to $create_findreplace_dialog,
  ;; (b) delete the JS path, and (c) rewire the test bridge.

  ;; Send a message to a window. Routes WAT-native wndprocs (wndproc >=
  ;; 0xFFFF0000) directly through $wat_wndproc_dispatch. For x86 wndprocs
  ;; the message is queued via the existing PostMessage queue (PostMessage
  ;; semantics, not synchronous SendMessage — return value is always 0).
  ;; True synchronous WAT->x86 SendMessage would require a nested $run
  ;; invocation; defer that until a consumer actually needs the return.
  ;; This is where painting nests: a wndproc that is holding a scratch rect
  ;; sends a message, and whatever that paints takes scratch slots of its own.
  ;; Marking here and resetting on the way out recycles everything the inner
  ;; frame took while leaving the caller's slots (taken before the mark) alone.
  ;; Completion of the immediately returned synchronous send, not its LRESULT.
  ;; Consumers of temporary output structs must reject a bounded-run timeout.
  (global $wnd_send_completed (mut i32) (i32.const 0))
  (func $wnd_send_message
    (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $mark i32) (local $r i32)
    (local.set $mark (call $paint_scratch_mark))
    (global.set $wnd_send_completed (i32.const 1))
    (local.set $r (call $wnd_send_message_inner
      (local.get $hwnd) (local.get $msg) (local.get $wParam) (local.get $lParam)))
    (call $paint_scratch_reset (local.get $mark))
    (local.get $r))

  (func $wnd_send_message_inner
    (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $wp i32) (local $slot i32) (local $ctrl_class i32)
    (local $old_eip i32) (local $old_esp i32) (local $old_eax i32) (local $old_ecx i32) (local $old_edx i32)
    (local $old_ebx i32) (local $old_esi i32) (local $old_edi i32) (local $old_ebp i32)
    (local $old_handler_set_eip i32) (local $old_steps i32)
    (local $old_yield_reason i32) (local $old_yield_flag i32)
    (local $result i32) (local $edit_state i32) (local $edit_state_w ptr<EditState>)
    (local $edit_len_before i32)
    (local $sync_rounds i32) (local $sleep_rounds i32) (local $old_sleep_yielded i32)
    (local.set $wp (call $wnd_table_get (local.get $hwnd)))
    (if (i32.eqz (local.get $wp)) (then (return (i32.const 0))))
    (local.set $ctrl_class (call $ctrl_table_get_class (local.get $hwnd)))
    (if (call $tab_native_is (local.get $hwnd))
      (then
        (call $tab_native_note_message
          (local.get $hwnd) (local.get $msg) (local.get $wParam) (local.get $lParam))
        (if (i32.eq (local.get $msg) (i32.const 0x000F))
          (then (return (call $tab_native_paint (local.get $hwnd)))))))
    ;; A registered status bar keeps ctrl_class=0 so its guest wndproc can
    ;; perform MFC layout. Its shared-surface paint and text/simple-mode mirror
    ;; are WAT-owned; otherwise Print Preview can leave an old prompt visible,
    ;; and MenuHelp's SB_SETTEXTW/SB_SIMPLE pair never reaches the pixels.
    (if (i32.and (call $statusbar_native_is (local.get $hwnd))
                 (i32.or
                   (i32.or
                     (i32.eq (local.get $msg) (i32.const 0x000F))
                     (i32.eq (local.get $msg) (i32.const 0x000C)))
                   (i32.or
                     (i32.eq (local.get $msg) (i32.const 0x0401))
                     (i32.or
                       (i32.eq (local.get $msg) (i32.const 0x0409))
                       (i32.eq (local.get $msg) (i32.const 0x040B))))))
      (then (return (call $statusbar_wndproc
        (local.get $hwnd) (local.get $msg) (local.get $wParam) (local.get $lParam)))))
    ;; Keep the exported/test-driver path consistent with SendMessageA and
    ;; DispatchMessageA: only unsubclassed controls bypass the guest proc.
    ;; A subclass owns WM_PAINT and may choose whether to chain to native.
    (if (i32.and
          (i32.and (i32.ne (local.get $ctrl_class) (i32.const 0))
                   (i32.eq (local.get $msg) (i32.const 0x000F)))
          (i32.eqz (call $ctrl_is_subclassed (local.get $hwnd))))
      (then (return (call $control_wndproc_dispatch
        (local.get $hwnd) (local.get $msg) (local.get $wParam) (local.get $lParam)))))
    ;; Do not bypass an app-installed EDIT subclass here. In particular,
    ;; Paint's CEdit wrapper consumes WM_CHAR before chaining to the native
    ;; control proc; skipping that wrapper leaves its text object empty even
    ;; though the WAT edit visibly contains the typed characters. Unsubclassed
    ;; EDIT and RichEdit controls continue through the WAT-native branch below.
    ;; Standard Edit menu/command ids should act on the focused edit control
    ;; before app frameworks forward them into native RichEdit's rich/OLE
    ;; clipboard path. Non-edit command ids fall through to the app wndproc.
    ;; Only for an application's own frame window. A WAT-owned window
    ;; (ctrl_class != 0 -- a message box is class 15) defines its own command
    ;; ids, and they collide: IDNO is 7 and so is one app's
    ;; ID_EDIT_SELECT_ALL, so "No" on WordPad's "Save changes?" box used to
    ;; select all the text behind it and leave the modal up forever.
    (if (i32.and (i32.eq (local.get $msg) (i32.const 0x0111)) ;; WM_COMMAND
                 (i32.eqz (local.get $ctrl_class)))
      (then
        (if (call $menu_try_edit_command (i32.and (local.get $wParam) (i32.const 0xFFFF)))
          (then (return (i32.const 0))))))
    ;; Dialog HWNDs install a USER DefDlgProc marker rather than exposing the
    ;; application DLGPROC as their window procedure.
    (if (i32.eq (local.get $wp) (global.get $WNDPROC_DIALOG))
      (then (return (call $dialog_default_proc
        (local.get $hwnd) (local.get $msg)
        (local.get $wParam) (local.get $lParam)))))
    ;; $WNDPROC_BUILTIN is an emulator routing sentinel, not executable guest
    ;; code. Public SendMessage/CallWindowProc already recognize it; keep this
    ;; internal synchronous path on the same invariant or an unclassified
    ;; built-in/common-control window sends 0xFFFE0001 into the x86 decoder.
    (if (i32.eq (local.get $wp) (global.get $WNDPROC_BUILTIN))
      (then
        (if (local.get $ctrl_class)
          (then (return (call $control_wndproc_dispatch
            (local.get $hwnd) (local.get $msg)
            (local.get $wParam) (local.get $lParam)))))
        (return (i32.const 0))))
    ;; WAT-native (>= 0xFFFF0000)
    (if (i32.ge_u (local.get $wp) (i32.const 0xFFFF0000))
      (then (return (call $wat_wndproc_dispatch
                      (local.get $hwnd) (local.get $msg)
                      (local.get $wParam) (local.get $lParam)))))
    ;; Paint subclasses its multiline text EDIT and handles WM_CHAR before
    ;; chaining. Its wrapper consumes Return without reaching the built-in
    ;; EDIT proc, so remember the native state and supply the standard newline
    ;; only if the subclass leaves it unchanged. Subclasses that already chain
    ;; get exactly one newline.
    (if (i32.and
          (i32.and (i32.eq (local.get $ctrl_class) (i32.const 2))
                   (i32.eq (local.get $msg) (i32.const 0x0102)))
          (i32.and
            (i32.eq (local.get $wParam) (i32.const 0x0D))
            (i32.ne
              (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x00000004))
              (i32.const 0))))
      (then
        (local.set $edit_state (call $wnd_get_state_ptr (local.get $hwnd)))
        (if (local.get $edit_state)
          (then
            (local.set $edit_state_w (cast ptr<EditState> (call $g2w (local.get $edit_state))))
            (local.set $edit_len_before
              (load.field.memarg EditState text_len (local.get $edit_state_w)))))))
    ;; A 16-bit task's window procedure cannot be entered this way. The frame
    ;; built below is stdcall with 32-bit arguments and a near return thunk,
    ;; and $wp is a packed selector:offset rather than a linear address — the
    ;; recursive run would decode whatever those bits happen to point at.
    ;; Posting is both safe and closer to what Win16 does: an app pumps its own
    ;; messages, so the procedure still sees this one, on its next iteration
    ;; and with the Pascal frame it expects. See $win16_enter_wndproc in
    ;; src/09e-win16-api.wat for the path that does call it.
    (if (global.get $code16)
      (then
        (global.set $wnd_send_completed (i32.const 0))
        ;; Only for a procedure the task could actually be entered at. A
        ;; sentinel below 0xFFFF0000 — the built-in default, which is what a
        ;; window whose class went unresolved is given — is not one, and
        ;; posting to it puts the message back where it came from: the pump
        ;; hands it over, this posts it again, and nothing else ever gets a
        ;; turn. Pipe Dream span on its own six startup messages that way.
        (if (call $win16_is_far_proc (local.get $wp))
          (then
            (drop (call $post_queue_push (local.get $hwnd) (local.get $msg)
                    (local.get $wParam) (local.get $lParam)))))
        (return (i32.const 0))))

    ;; x86 wndproc — synchronous dispatch via recursive $run.
    ;; Save full guest register context: this is invoked between message-pump
    ;; iterations (often via JS test driver or WAT control-side $wnd_send_message
    ;; from a WAT child wndproc), so when we resume the pump's EIP must see the
    ;; same register state it had before the recursive run. The wndproc's EAX
    ;; return value is extracted separately and returned as the WAT result.
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
    ;; Push args + return thunk on guest stack. Wndproc is stdcall ret 0x10
    ;; so it pops these on return; ESP returns to its current value.
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)) (local.get $lParam))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)) (local.get $wParam))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)) (local.get $msg))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $hwnd))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $sync_msg_ret_thunk))
    (global.set $eip (local.get $wp))
    (global.set $steps (i32.const 0))
    (global.set $yield_reason (i32.const 0))
    (global.set $yield_flag (i32.const 0))
    (call $sync_depth_enter)
    ;; A synchronous native-control procedure may legitimately execute more
    ;; than one interpreter slice (property-sheet Cancel walks every tab/page
    ;; before destroying the frame). Continue bounded slices until the return
    ;; thunk sets EIP=0 instead of silently abandoning the guest call midway.
    ;;
    ;; A round the procedure ended itself with Sleep is not runaway work, and
    ;; nothing outside this loop gets a turn between rounds, so the sleep
    ;; cannot be honoured anyway: count those against their own, larger cap.
    ;; Unreal Tournament's first-run wizard probes each 3D device from
    ;; WM_PAINT (sent here by UpdateWindow), polling for the probe's log with
    ;; Sleep(100) up to 100 times a device; 64 rounds abandoned that paint
    ;; mid-probe and left "Detecting 3D video devices, please wait..." up for
    ;; good. A procedure that spins without sleeping is still cut at 64 full
    ;; slices.
    (local.set $sync_rounds (i32.const 0))
    (local.set $sleep_rounds (i32.const 0))
    (local.set $old_sleep_yielded (global.get $sleep_yielded))
    (global.set $sleep_yielded (i32.const 0))
    (block $sync_done (loop $sync_run
      (call $run (i32.const 1000000))
      (br_if $sync_done (i32.eqz (global.get $eip)))
      ;; A LoadLibraryA inside the procedure (Diablo's Select Connection
      ;; dialog loads every *.snp from WM_INITDIALOG) yields for the host to
      ;; map the DLL, and nothing returns to the host from here: every later
      ;; round would stop on the same yield and the message be abandoned.
      ;; Have the host finish the load now, as it does for one in a DllMain.
      (if (i32.and (i32.eq (global.get $yield_reason) (i32.const 5))
            (i32.ne (call $host_service_load_library) (i32.const 0)))
        (then (br $sync_run)))
      (if (global.get $sleep_yielded)
        (then
          (global.set $sleep_yielded (i32.const 0))
          (local.set $sleep_rounds (i32.add (local.get $sleep_rounds) (i32.const 1))))
        (else
          (local.set $sync_rounds (i32.add (local.get $sync_rounds) (i32.const 1)))))
      (if (i32.or (i32.ge_u (local.get $sync_rounds) (i32.const 64))
                  (i32.ge_u (local.get $sleep_rounds) (i32.const 4096)))
        (then
          (call $host_log_i32 (i32.const 0xCADE5000))
          (call $host_log_i32 (global.get $eip))
          (call $host_log_i32 (global.get $yield_reason))
          (call $host_log_i32 (local.get $msg))
          (call $host_log_i32 (local.get $hwnd))
          (call $host_log_i32 (local.get $wParam))
          (call $host_log_i32 (local.get $lParam))
          (br $sync_done)))
      (br $sync_run)))
    (global.set $sleep_yielded (local.get $old_sleep_yielded))
    (call $sync_depth_leave)
    (global.set $wnd_send_completed (i32.eqz (global.get $eip)))
    ;; Capture wndproc result (its EAX) before restoring caller's regs.
    (local.set $result (i32.load offset=0 (global.get $reg_base)))
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
    (if (i32.and
          (i32.ne (local.get $edit_state) (i32.const 0))
          (i32.eq
            (load.field.memarg EditState text_len (local.get $edit_state_w))
            (local.get $edit_len_before)))
      (then
        (drop (call $control_wndproc_dispatch
          (local.get $hwnd) (local.get $msg)
          (local.get $wParam) (local.get $lParam)))))
    (local.get $result)
  )

  ;; A native control's notification to an x86 parent, as a guest tail call.
  ;;
  ;; $wnd_send_message runs an x86 wndproc in a bounded nested $run, and a
  ;; handler that opens a modal loop there can never receive the input that
  ;; would end it: after 64 rounds the rest of the handler is abandoned. When
  ;; the control is running under a USER entry point that returns straight to
  ;; guest code (DispatchMessage, CallWindowProc), there is a better frame to
  ;; use: that entry point's own. The control records the notification, and
  ;; once it returns, the entry point replaces its frame with a call to the
  ;; parent's wndproc that returns to the entry point's caller — the same
  ;; shape DispatchMessage already uses for any x86 window. The parent then
  ;; runs on the ordinary interpreter stack, modal loops and all. VB5's
  ;; ThunderCommandButton chains WM_LBUTTONUP to BUTTON through CallWindowProc,
  ;; and every VB Click handler that shows a MsgBox needs this.
  ;;
  ;; $ctrl_tail_depth is the $sync_msg_depth of the entry point that armed the
  ;; tail (-1: none), so a notification from inside some deeper nested run is
  ;; never hoisted out of it. One slot suffices: an entry point finishes its
  ;; tail before returning, and a second notification in the same dispatch
  ;; falls back to the synchronous send.
  (global $ctrl_tail_depth (mut i32) (i32.const -1))
  (global $ctrl_tail_pending (mut i32) (i32.const 0))
  (global $ctrl_tail_proc (mut i32) (i32.const 0))
  (global $ctrl_tail_hwnd (mut i32) (i32.const 0))
  (global $ctrl_tail_msg (mut i32) (i32.const 0))
  (global $ctrl_tail_wparam (mut i32) (i32.const 0))
  (global $ctrl_tail_lparam (mut i32) (i32.const 0))

  ;; Arm the tail for this entry point; returns the value to hand back to
  ;; $ctrl_tail_disarm.
  (func $ctrl_tail_arm (result i32)
    (local $saved i32)
    (local.set $saved (global.get $ctrl_tail_depth))
    (global.set $ctrl_tail_depth (global.get $sync_msg_depth))
    (local.get $saved))

  (func $ctrl_tail_disarm (param $saved i32)
    (global.set $ctrl_tail_depth (local.get $saved)))

  ;; Notify an x86 parent: as a recorded tail call when the current entry
  ;; point armed one, otherwise through $wnd_send_message. Returns the send's
  ;; LRESULT, or 0 for a deferred call (whose result becomes the entry
  ;; point's).
  (func $ctrl_notify_parent
    (param $parent i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $proc i32)
    (local.set $proc (call $wnd_table_get (local.get $parent)))
    (if (i32.and
          (i32.and
            (i32.eq (global.get $ctrl_tail_depth) (global.get $sync_msg_depth))
            (i32.eqz (global.get $ctrl_tail_pending)))
          (i32.and
            (i32.and (i32.ne (local.get $proc) (i32.const 0))
                     (i32.lt_u (local.get $proc) (i32.const 0xFFFE0000)))
            (i32.and (i32.eqz (global.get $code16))
                     (i32.eqz (call $ctrl_table_get_class (local.get $parent))))))
      (then
        ;; Same pre-dispatch rule $wnd_send_message applies to a guest frame.
        (if (i32.eq (local.get $msg) (i32.const 0x0111))
          (then
            (if (call $menu_try_edit_command (i32.and (local.get $wParam) (i32.const 0xFFFF)))
              (then (return (i32.const 0))))))
        (global.set $ctrl_tail_pending (i32.const 1))
        (global.set $ctrl_tail_proc (local.get $proc))
        (global.set $ctrl_tail_hwnd (local.get $parent))
        (global.set $ctrl_tail_msg (local.get $msg))
        (global.set $ctrl_tail_wparam (local.get $wParam))
        (global.set $ctrl_tail_lparam (local.get $lParam))
        (return (i32.const 0))))
    (call $wnd_send_message (local.get $parent) (local.get $msg) (local.get $wParam) (local.get $lParam)))

  ;; Called by the entry point after the control returned and after it popped
  ;; its own frame as usual (so ESP is the caller's post-return ESP). If a
  ;; tail is pending, push the parent's wndproc frame returning to $ret and
  ;; jump there.
  (func $ctrl_tail_finish (param $ret i32)
    (if (i32.eqz (global.get $ctrl_tail_pending)) (then (return)))
    (global.set $ctrl_tail_pending (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $ret))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)) (global.get $ctrl_tail_hwnd))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)) (global.get $ctrl_tail_msg))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)) (global.get $ctrl_tail_wparam))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)) (global.get $ctrl_tail_lparam))
    (global.set $eip (global.get $ctrl_tail_proc))
    (global.set $steps (i32.const 0)))

  ;; $control_wndproc_dispatch for an entry point whose frame is FRAME bytes
  ;; including the return address: dispatches with the tail armed, stores
  ;; EAX, pops the frame, and completes a pending tail.
  (func $ctrl_dispatch_with_tail
    (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (param $frame i32)
    (local $saved i32) (local $ret i32)
    (local.set $ret (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (local.set $saved (call $ctrl_tail_arm))
    (i32.store offset=0 (global.get $reg_base) (call $control_wndproc_dispatch
      (local.get $hwnd) (local.get $msg) (local.get $wParam) (local.get $lParam)))
    (call $ctrl_tail_disarm (local.get $saved))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (local.get $frame)))
    (call $ctrl_tail_finish (local.get $ret)))

  ;; The most recent dialog-procedure handled BOOL is separate from the
  ;; message LRESULT returned by DefDlgProc. In particular, a DLGPROC can
  ;; handle WM_COMMAND (TRUE) while leaving DWL_MSGRESULT at zero. Control-side
  ;; default behavior must consult this immediately after synchronous dispatch.
  (global $dialog_last_proc_handled (mut i32) (i32.const 0))
  (global $dialog_proc_ret_thunk (mut i32) (i32.const 0)) ;; CACA003C

  ;; Minimal DefDlgProc semantics around the stored per-window DLGPROC.
  ;; The DLGPROC returns BOOL; when TRUE, the actual message result comes from
  ;; DWL_MSGRESULT. Temporarily exposing the guest proc lets the established
  ;; synchronous sender execute it without duplicating the interpreter-state
  ;; save/restore machinery. Restore only if the proc did not destroy the HWND.
  (func $dialog_default_proc
    (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $installed i32) (local $proc i32) (local $handled i32)
    (global.set $dialog_last_proc_handled (i32.const 0))
    (local.set $installed (call $wnd_table_get (local.get $hwnd)))
    (local.set $proc (call $dialog_proc_get (local.get $hwnd)))
    ;; A dialog with no DLGPROC (CreateDialogParam(..., NULL, ...), MFC's
    ;; CDialogBar) skips only the callback: USER still does the default
    ;; processing below, and WM_ERASEBKGND is the one such a dialog relies on.
    (if (local.get $proc) (then
    (call $wnd_table_set (local.get $hwnd) (local.get $proc))
    (local.set $handled (call $wnd_send_message
      (local.get $hwnd) (local.get $msg)
      (local.get $wParam) (local.get $lParam)))
    ;; Set this after the callback returns so any nested dialog dispatch cannot
    ;; overwrite the outer message's handled state.
    (global.set $dialog_last_proc_handled (i32.ne (local.get $handled) (i32.const 0)))
    (if (i32.ge_s (call $wnd_table_find (local.get $hwnd)) (i32.const 0))
      (then (call $wnd_table_set (local.get $hwnd) (local.get $installed))))))
    (call $dialog_proc_result (local.get $hwnd) (local.get $msg)
      (local.get $wParam) (local.get $lParam) (local.get $handled)))

  ;; Shared epilog for synchronous and guest-continuation DLGPROC calls.
  ;; Handled is invocation-owned, never inferred from a nested call's global.
  (func $dialog_proc_result
    (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32)
    (param $handled i32) (result i32)
    (if (local.get $handled)
      (then
        ;; USER's DefDlgProc epilog returns the DLGPROC's own BOOL — not
        ;; DWL_MSGRESULT — for the handful of messages whose result *is* that
        ;; BOOL. WM_INITDIALOG is the load-bearing one: its caller reads the
        ;; return as "did the dialog set the focus itself, or should I focus
        ;; the control I picked". Storm's dialog manager (Diablo's front end)
        ;; sends WM_INITDIALOG to its own dialog class, lets the message reach
        ;; the app through DefDlgProc, and then does
        ;;     if (!result) focusTarget = NULL;
        ;; before its SetFocus. Returning DWL_MSGRESULT (zero, because a
        ;; DLGPROC that returns TRUE normally never writes it) therefore left
        ;; every Diablo menu and the name-entry field with no focused control
        ;; at all: keystrokes had nowhere to land.
        (if (i32.or
              (i32.eq (local.get $msg) (i32.const 0x0110))    ;; WM_INITDIALOG
              (i32.or
                (i32.eq (local.get $msg) (i32.const 0x0039))  ;; WM_COMPAREITEM
                (i32.or
                  (i32.eq (local.get $msg) (i32.const 0x002E)) ;; WM_VKEYTOITEM
                  (i32.or
                    (i32.eq (local.get $msg) (i32.const 0x002F))   ;; WM_CHARTOITEM
                    (i32.eq (local.get $msg) (i32.const 0x0037)))))) ;; WM_QUERYDRAGICON
          (then (return (local.get $handled))))
        (return (call $dialog_extra_get (local.get $hwnd) (i32.const 0)))))
    ;; BUTTON notifications arrive through the ordinary message pump so a
    ;; dialog procedure can enter another modal loop without stranding a
    ;; recursive WAT interpreter frame. If a true DialogBox DLGPROC leaves
    ;; IDOK unhandled, apply USER's default close now, after that queued
    ;; WM_COMMAND has run. Modeless dialogs remain application-owned.
    (if (i32.and
          (i32.eq (local.get $msg) (i32.const 0x0111))
          (i32.eq (i32.and (local.get $wParam) (i32.const 0xFFFF))
                  (i32.const 1)))
      (then
        (call $dialog_default_idok_close (local.get $hwnd))
        (return (i32.const 0))))
    ;; USER's internal DefDlgProc path performs the same first-tabstop work as
    ;; an application calling exported DefDlgProcA itself. SetFocus(dialog)
    ;; reaches this dispatcher directly; without the fallback the dialog HWND
    ;; kept focus and its child controls never received WM_SETFOCUS.
    (if (i32.eq (local.get $msg) (i32.const 0x0007)) ;; WM_SETFOCUS
      (then
        (drop (call $dlg_focus_first_tabstop (local.get $hwnd)))
        (return (i32.const 0))))
    ;; WM_GETFONT: the font the dialog manager made from a DS_SETFONT template.
    (if (i32.and (i32.eq (local.get $msg) (i32.const 0x0031))
                 (i32.ne (call $dialog_font_get (local.get $hwnd)) (i32.const 0)))
      (then (return (call $dialog_font_get (local.get $hwnd)))))
    ;; FALSE from the DLGPROC hands WM_WINDOWPOSCHANGED to DefDlgProc's
    ;; DefWindowProc tail, which owns the derived WM_MOVE/WM_SIZE messages.
    (if (i32.eq (local.get $msg) (i32.const 0x0047))
      (then
        (call $windowpos_defproc_geometry
          (local.get $hwnd) (local.get $lParam))
        (return (i32.const 0))))
    ;; A FALSE DLGPROC result falls through to DefDlgProc's default work. In
    ;; particular, WM_PAINT is not merely validated: BeginPaint first erases
    ;; an invalid dialog whose update region carries the erase bit. Keeping
    ;; that work in ShowWindow made property-sheet pages paint before COMCTL
    ;; hid the preceding page, so both pages briefly occupied our shared
    ;; top-level canvas. Do the default erase here, when USER actually
    ;; dispatches the new page's paint and the old page is already hidden.
    (if (i32.eq (local.get $msg) (i32.const 0x0014)) ;; WM_ERASEBKGND
      (then
        (call $nc_flags_clear (local.get $hwnd) (i32.const 2))
        ;; Erase through wParam's DC: BeginPaint's is clipped to the update
        ;; region, and filling the whole client through a fresh DC wiped
        ;; SimCity's status-bar frames, which the clipped paint cannot redraw.
        (if (local.get $wParam)
          (then (return (call $erase_background_dc
            (local.get $hwnd) (local.get $wParam) (i32.const 16)))))
        (return (call $host_erase_background
          (local.get $hwnd) (i32.const 16))))) ;; COLOR_BTNFACE+1
    (if (i32.eq (local.get $msg) (i32.const 0x000F)) ;; WM_PAINT
      (then
        ;; Preserve the parent's update geometry long enough to expose each
        ;; visible child. They paint after this default background pass, as
        ;; USER's child clipping requires.
        (drop (call $paint_seed_child_paints (local.get $hwnd)))
        (if (i32.and (call $nc_flags_test (local.get $hwnd)) (i32.const 2))
          (then
            (call $nc_flags_clear (local.get $hwnd) (i32.const 2))
            (drop (call $host_erase_background
              (local.get $hwnd) (i32.const 16))))) ;; COLOR_BTNFACE+1
        (call $update_clear_hwnd (local.get $hwnd))
        (call $paint_flag_clear_hwnd (local.get $hwnd))
        (return (i32.const 0))))
    (i32.const 0))

  ;; Route a client-relative mouse event to the first WAT-managed child
  ;; under (x,y). Returns 1 if a child was hit and the message dispatched,
  ;; 0 otherwise. lParam is the client-relative cursor position packed as
  ;; x|(y<<16); the child receives a child-relative lParam. Button kind=7
  ;; (group-box) is skipped as non-interactive. Used by JS to avoid
  ;; reimplementing CONTROL_GEOM hit-testing for WAT-managed dialogs.
  ;; NSIS wizard pages are child dialogs inside an outer dialog frame, so
  ;; recurse into child windows before delivering the mouse event to the page.
  (func $dialog_route_mouse (export "dialog_route_mouse")
    (param $parent i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $slot i32) (local $ch i32) (local $cls i32)
    (local $xy i32) (local $wh i32)
    (local $cx i32) (local $cy i32) (local $cw i32) (local $chh i32)
    (local $px i32) (local $py i32) (local $style i32) (local $ch_lp i32)
    (local $hit i32) (local $dispatchable i32)
    (local.set $px (i32.shr_s (i32.shl (local.get $lParam) (i32.const 16)) (i32.const 16)))
    (local.set $py (i32.shr_s (local.get $lParam) (i32.const 16)))
    (if (i32.and
          (i32.eq (local.get $msg) (i32.const 0x0202))
          (i32.and
            (i32.eq (global.get $dialog_button_capture_parent) (local.get $parent))
            (i32.ne (global.get $dialog_button_capture_hwnd) (i32.const 0))))
      (then
        (local.set $ch (global.get $dialog_button_capture_hwnd))
        (global.set $dialog_button_capture_parent (i32.const 0))
        (global.set $dialog_button_capture_hwnd (i32.const 0))
        (local.set $xy (call $ctrl_get_xy_packed (local.get $ch)))
        (local.set $cx (i32.shr_s (i32.shl (local.get $xy) (i32.const 16)) (i32.const 16)))
        (local.set $cy (i32.shr_s (local.get $xy) (i32.const 16)))
        (local.set $ch_lp (i32.or
          (i32.and (i32.sub (local.get $px) (local.get $cx)) (i32.const 0xFFFF))
          (i32.shl
            (i32.and (i32.sub (local.get $py) (local.get $cy)) (i32.const 0xFFFF))
            (i32.const 16))))
        (drop (call $wnd_send_message (local.get $ch)
                (local.get $msg) (local.get $wParam) (local.get $ch_lp)))
        (return (i32.const 1))))
    (block $done (loop $walk
      (local.set $slot (call $wnd_next_child_slot (local.get $parent) (local.get $slot)))
      (br_if $done (i32.eq (local.get $slot) (i32.const -1)))
      (local.set $ch (call $wnd_slot_hwnd (local.get $slot)))
      (local.set $cls (call $ctrl_table_get_class (local.get $ch)))
      (local.set $style (call $wnd_get_style (local.get $ch)))
      ;; Win98 hit-testing ignores effectively hidden child windows. NSIS
      ;; wizard pages keep prior-page controls WS_VISIBLE under a hidden page.
      (if (i32.eqz (call $wnd_is_effectively_visible (local.get $ch)))
        (then
          (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
          (br $walk)))
      (if (call $ctrl_style_disabled (local.get $style))
        (then
          (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
          (br $walk)))
      (local.set $xy (call $ctrl_get_xy_packed (local.get $ch)))
      (local.set $wh (call $ctrl_get_wh_packed (local.get $ch)))
      (local.set $cx (i32.shr_s (i32.shl (local.get $xy) (i32.const 16)) (i32.const 16)))
      (local.set $cy (i32.shr_s (local.get $xy) (i32.const 16)))
      (local.set $cw (i32.and (local.get $wh) (i32.const 0xFFFF)))
      (local.set $chh (i32.shr_u (local.get $wh) (i32.const 16)))
      (if (i32.eq (local.get $cls) (i32.const 5))
        (then (local.set $chh (call $combobox_hit_h (local.get $ch) (local.get $chh)))))
      (local.set $hit (i32.and
        (i32.and (i32.ge_s (local.get $px) (local.get $cx))
                 (i32.lt_s (local.get $px) (i32.add (local.get $cx) (local.get $cw))))
        (i32.and (i32.ge_s (local.get $py) (local.get $cy))
                 (i32.lt_s (local.get $py) (i32.add (local.get $cy) (local.get $chh))))))
      ;; Button group-box (kind=7) is non-interactive; ignore hits on it.
        (if (i32.and (i32.ne (local.get $hit) (i32.const 0))
                     (i32.eq (local.get $cls) (i32.const 1)))
        (then
          (if (i32.eq (i32.and (local.get $style) (i32.const 0x0F)) (i32.const 7))
            (then (local.set $hit (i32.const 0))))))
      (if (local.get $hit)
        (then
          (local.set $ch_lp (i32.or
            (i32.and (i32.sub (local.get $px) (local.get $cx)) (i32.const 0xFFFF))
            (i32.shl
              (i32.and (i32.sub (local.get $py) (local.get $cy)) (i32.const 0xFFFF))
              (i32.const 16))))
          ;; Descend into the hit child first -- except into a combobox. A
          ;; combobox owns an edit field and a button, and its own wndproc is
          ;; what opens the list and forwards clicks to its listbox. Recursing
          ;; here hands the click to one of those parts instead, which is why
          ;; WordPad's font combo opened when clicked near its middle (below the
          ;; edit child) and did nothing when clicked on the field or arrow.
          (if (i32.ne (local.get $cls) (i32.const 5))
            (then
              (if (call $dialog_route_mouse
                    (local.get $ch) (local.get $msg) (local.get $wParam) (local.get $ch_lp))
                (then (return (i32.const 1))))))
          ;; Click on a sibling control while another combo is dropped → cancel
          ;; that combo first (matches Win98: any click outside the dropdown's
          ;; field/listbox dismisses it). Skip when the hit IS the open combo
          ;; itself — its wndproc handles open/close internally.
          (if (i32.and
                (i32.eq (local.get $msg) (i32.const 0x0201))
                (i32.and
                  (i32.ne (global.get $combo_open_hwnd) (i32.const 0))
                  (i32.ne (global.get $combo_open_hwnd) (local.get $ch))))
            (then (call $combobox_close_dropdown (global.get $combo_open_hwnd) (i32.const 0))))
          (local.set $dispatchable
            (i32.or
              (i32.or
                (i32.or (i32.eq (local.get $cls) (i32.const 1))
                        (i32.eq (local.get $cls) (i32.const 2)))
                (i32.or (i32.eq (local.get $cls) (i32.const 4))
                        (i32.eq (local.get $cls) (i32.const 5))))
              (i32.or
                (i32.or (i32.eq (local.get $cls) (i32.const 6))
                        (i32.eq (local.get $cls) (i32.const 7)))
                (i32.or (i32.eq (local.get $cls) (i32.const 8))
                        (i32.or (i32.eq (local.get $cls) (i32.const 9))
                          (i32.or (i32.eq (local.get $cls) (i32.const 19))
                                  (i32.eq (local.get $cls) (i32.const 27))))))))
          (if (local.get $dispatchable)
            (then
              (if (i32.and
                    (i32.eq (local.get $msg) (i32.const 0x0201))
                    (i32.eq (local.get $cls) (i32.const 1)))
                (then
                  (global.set $dialog_button_capture_parent (local.get $parent))
                  (global.set $dialog_button_capture_hwnd (local.get $ch))))
              (drop (call $wnd_send_message (local.get $ch)
                      (local.get $msg) (local.get $wParam) (local.get $ch_lp)))
              (return (i32.const 1))))))
      (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
      (br $walk)))
    ;; No child hit. If a combo is dropped, an empty-area click on the dialog
    ;; should still dismiss it.
    (if (i32.and
          (i32.eq (local.get $msg) (i32.const 0x0201))
          (i32.ne (global.get $combo_open_hwnd) (i32.const 0)))
      (then (call $combobox_close_dropdown (global.get $combo_open_hwnd) (i32.const 0))))
    (i32.const 0))

  ;; Recursively destroy a window and all of its WAT-managed descendants.
  ;; For each descendant (depth-first), sends WM_DESTROY so the wndproc
  ;; can free its per-window state struct + sub-allocations, then clears
  ;; the WND_RECORDS slot. The caller is responsible for calling
  ;; $host_destroy_window if the window was visible to the renderer.
  ;;
  ;; The scan restarts after each recursive descend because slot indices
  ;; can shift as $wnd_table_remove zeroes records — simpler than tracking
  ;; a worklist, and MAX_WINDOWS is small enough that the O(N²) cost is
  ;; irrelevant for the small subtrees this is currently used on
  ;; (find dialog: 1 parent + 8 children).
  (func $wnd_destroy_tree (param $hwnd i32)
    (local $i i32) (local $addr i32) (local $child i32)
    (if (i32.eqz (local.get $hwnd)) (then (return)))
    (call $wnd_destroy_children (local.get $hwnd))
    ;; All children gone — let the wndproc free per-window state, then drop the slot.
    (drop (call $wnd_send_message (local.get $hwnd) (i32.const 0x0002)
            (i32.const 0) (i32.const 0)))
    (call $timer_kill_hwnd (local.get $hwnd))
    (call $wnd_table_remove (local.get $hwnd)))

  ;; Destroy all children of a window (depth-first) but not the window itself.
  (func $wnd_destroy_children (export "wnd_destroy_children") (param $hwnd i32)
    (local $i i32) (local $addr i32) (local $child i32)
    (if (i32.eqz (local.get $hwnd)) (then (return)))
    (block $outer
      (loop $rescan
        (local.set $i (i32.const 0))
        (loop $scan
          (br_if $outer (i32.ge_u (local.get $i) (global.get $MAX_WINDOWS)))
          (local.set $addr (call $wnd_record_addr (local.get $i)))
          (local.set $child (load.field WndRecord hwnd (local.get $addr)))
          (if (i32.and (i32.ne (local.get $child) (i32.const 0))
                       (i32.eq (load.field.memarg WndRecord parent (local.get $addr)) (local.get $hwnd)))
            (then
              (call $wnd_destroy_tree (local.get $child))
              ;; Tell the renderer about every descendant, as
              ;; $wnd_destroy_recursive does; the root is the caller's to
              ;; report. A CreateDialog page under a sheet's frame control is
              ;; a renderer window whose parent the renderer never saw, so the
              ;; root's host_destroy_window cannot reach it: Unreal
              ;; Tournament's last wizard page stayed hit-testable over the
              ;; game window and swallowed every click. Unknown hwnds are a
              ;; no-op on the host.
              (call $host_destroy_window (local.get $child))
              (br $rescan)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $scan)))))

  ;; ============================================================
  ;; Modal common-dialog scaffolding
  ;; ============================================================
  ;;
  ;; Wraps the CACA0006 thunk pump from $win32_dispatch. Used by
  ;; $handle_GetOpenFileNameA / GetSaveFileNameA / ChooseColorA / etc.
  ;;
  ;;   $modal_begin(dlg_hwnd, esp_adjust):
  ;;     Save current ret addr ([esp]), esp, and the post-call esp delta.
  ;;     Park EIP at the modal_loop_thunk so subsequent interpreter passes
  ;;     hit the CACA0006 case until the dialog is destroyed.
  ;;     $steps=0 prevents th_call_ind (or whatever called us) from
  ;;     overriding our EIP redirect.
  ;;
  ;;   $modal_done_ok(result_hint) / $modal_done_cancel():
  ;;     Called by the dialog's wndproc on OK or Cancel/X. Records the
  ;;     result, tears the dialog down, and clears $modal_dlg_hwnd which
  ;;     unblocks the CACA0006 pump on the next interpreter iteration.
  (func $modal_capture_nonvolatile
    (global.set $modal_restore_pending (i32.const 1))
    (global.set $modal_saved_ebx (i32.load offset=12 (global.get $reg_base)))
    (global.set $modal_saved_esi (i32.load offset=24 (global.get $reg_base)))
    (global.set $modal_saved_edi (i32.load offset=28 (global.get $reg_base)))
    (global.set $modal_saved_ebp (i32.load offset=20 (global.get $reg_base))))

  (func $modal_begin (param $dlg i32) (param $esp_adjust i32)
    (global.set $modal_dlg_hwnd  (local.get $dlg))
    (global.set $modal_result    (i32.const 0))
    (i32.atomic.store (global.get $SHARED_MODAL_DLG_HWND) (local.get $dlg))
    (i32.atomic.store (global.get $SHARED_MODAL_RESULT) (i32.const 0))
    (i32.atomic.store (global.get $SHARED_MODAL_DONE) (i32.const 0))
    (global.set $modal_ret_addr  (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (global.set $modal_saved_esp (i32.load offset=16 (global.get $reg_base)))
    (global.set $modal_esp_adjust (local.get $esp_adjust))
    ;; Direct exported test helpers may call modal_begin without entering a
    ;; guest ABI handler. Do not restore stale register state in that case.
    (if (i32.eqz (global.get $modal_restore_pending))
      (then
        (global.set $modal_saved_ebx (i32.load offset=12 (global.get $reg_base)))
        (global.set $modal_saved_esi (i32.load offset=24 (global.get $reg_base)))
        (global.set $modal_saved_edi (i32.load offset=28 (global.get $reg_base)))
        (global.set $modal_saved_ebp (i32.load offset=20 (global.get $reg_base)))))
    (global.set $eip             (global.get $modal_loop_thunk))
    (global.set $yield_flag      (i32.const 1))
    (global.set $yield_reason    (i32.const 6))
    (global.set $steps           (i32.const 0)))

  ;; One pass of the modal pump, shared by the 32-bit CACA0006 thunk and the
  ;; 16-bit one. Returns 1 while the dialog is still up — EIP has been re-parked
  ;; at `pump_eip`, or the caller should yield — and 0 once it has been
  ;; dismissed, which is when the API call it belongs to can be spliced back
  ;; together. The two worlds differ only in how that splice works, which is why
  ;; the splice stays with each caller and only this part is shared.
  (func $modal_pump_step (param $pump_eip i32) (result i32)
    (local $flags i32) (local $hwnd i32) (local $proc i32)
    ;; A renderer-side shadow instance may have delivered the button command.
    ;; Finish in the instance that owns the parked API call: its private
    ;; common-dialog kind/struct and saved register frame are authoritative.
    (if (i32.atomic.load (global.get $SHARED_MODAL_DONE))
      (then
        (i32.atomic.store (global.get $SHARED_MODAL_DONE) (i32.const 0))
        (call $modal_finish_local
          (i32.atomic.load (global.get $SHARED_MODAL_RESULT)))))
    (if (i32.eqz (global.get $modal_dlg_hwnd)) (then (return (i32.const 0))))
    ;; Drain nc_flags for the dialog hwnd only: child controls have no
    ;; non-client chrome and would leave spurious fragments.
    (if (global.get $nc_flags_count)
      (then
        (local.set $flags (call $nc_flags_test (global.get $modal_dlg_hwnd)))
        (if (i32.and (local.get $flags) (i32.const 1))          ;; WM_NCPAINT
          (then
            (call $nc_flags_clear (global.get $modal_dlg_hwnd) (i32.const 1))
            (call $defwndproc_do_ncpaint (global.get $modal_dlg_hwnd))
            (global.set $eip (local.get $pump_eip))
            (global.set $steps (i32.const 0))
            (return (i32.const 1))))
        (if (i32.and (local.get $flags) (i32.const 2))          ;; WM_ERASEBKGND
          (then
            (call $nc_flags_clear (global.get $modal_dlg_hwnd) (i32.const 2))
            (drop (call $host_erase_background (global.get $modal_dlg_hwnd) (i32.const 16)))
            (global.set $eip (local.get $pump_eip))
            (global.set $steps (i32.const 0))
            (return (i32.const 1))))))
    ;; WM_PAINT for the child controls. The dialog was built from WAT controls,
    ;; so every valid target here is a WAT-native window procedure.
    (if (call $paint_flag_any)
      (then
        (local.set $hwnd (call $paint_flag_take))
        (local.set $proc (call $wnd_table_get (local.get $hwnd)))
        (if (i32.ge_u (local.get $proc) (i32.const 0xFFFF0000))
          (then
            (drop (call $wat_wndproc_dispatch
              (local.get $hwnd) (i32.const 0x000F) (i32.const 0) (i32.const 0)))
            ;; The modal pump paints one child per yield=6 slice. The damage
            ;; notification that queued these paints may already have been
            ;; composited after an earlier child, while the later painters
            ;; write only to canonical shared memory. Publish every completed
            ;; child so the final list/button pixels cannot remain off-screen.
            (call $host_invalidate (local.get $hwnd))
            (global.set $eip (local.get $pump_eip))
            (global.set $steps (i32.const 0))
            (return (i32.const 1))))))
    (global.set $yield_flag (i32.const 1))
    (global.set $yield_reason (i32.const 15)) ;; drained paints: sleep until input
    (i32.const 1))

  (func $modal_finish_local (param $result i32)
    (local $owner i32) (local $hwnd i32) (local $class i32)
    (local $ret i32) (local $esp i32) (local $adjust i32) (local $pending i32)
    (local $ebx i32) (local $esi i32) (local $edi i32) (local $ebp i32)
    (local.set $hwnd (global.get $modal_dlg_hwnd))
    (if (i32.eqz (local.get $hwnd)) (then (return)))
    ;; A callback during teardown may complete another common dialog. Keep
    ;; this parked API's continuation invocation-owned until it is published
    ;; back for the owning pump, rather than borrowing the nested globals.
    (local.set $ret (global.get $modal_ret_addr))
    (local.set $esp (global.get $modal_saved_esp))
    (local.set $adjust (global.get $modal_esp_adjust))
    (local.set $pending (global.get $modal_restore_pending))
    (local.set $ebx (global.get $modal_saved_ebx))
    (local.set $esi (global.get $modal_saved_esi))
    (local.set $edi (global.get $modal_saved_edi))
    (local.set $ebp (global.get $modal_saved_ebp))
    (local.set $class (call $ctrl_table_get_class (local.get $hwnd)))
    ;; The shell picker sends the selected HTREEITEM through shared modal
    ;; state. Convert it to a caller-owned PIDL only in this owning instance;
    ;; renderer shadows have separate heap globals even though memory is shared.
    (if (i32.eq (local.get $class) (i32.const 31))
      (then (local.set $result
        (call $browse_modal_finish (local.get $hwnd) (local.get $result)))))
    ;; A successful PropertySheet call owns every HPROPSHEETPAGE passed in its
    ;; handle array. Retire those copied page objects with the frame, matching
    ;; the lifetime transfer documented for PropertySheet.
    (if (i32.eq (local.get $class) (i32.const 32))
      (then
        (call $propsheet_release_pages)
        (call $propsheet_page_hwnds_release)))
    ;; The Open/Save wndproc tags a filename-buffer overflow so the value can
    ;; cross the renderer-shadow modal bridge. Keep the API's BOOL result zero
    ;; like Cancel, while retaining the documented extended error in the
    ;; guest instance that owns the parked call.
    (if (i32.and
          (i32.eq (local.get $class) (i32.const 12))
          (i32.eq (local.get $result) (i32.const 0xFFFF3003)))
      (then
        (global.set $common_dialog_error (i32.const 0x3003))
        (local.set $result (i32.const 0))))
    (global.set $modal_result (local.get $result))
    (call $cd_modal_writeback (local.get $result))
    (local.set $owner (call $wnd_get_owner (local.get $hwnd)))
    (call $wnd_destroy_tree (local.get $hwnd))
    (call $host_destroy_window (local.get $hwnd))
    (global.set $modal_dlg_hwnd (i32.const 0))
    (i32.atomic.store (global.get $SHARED_MODAL_RESULT) (local.get $result))
    (i32.atomic.store (global.get $SHARED_MODAL_DLG_HWND) (i32.const 0))
    (i32.atomic.store (global.get $SHARED_MODAL_DONE) (i32.const 0))
    ;; The dialog held the focus; give it back to the owner, or the app never
    ;; hears WM_SETFOCUS again. See $focus_restore_after_modal.
    (call $focus_restore_after_modal (local.get $owner))
    ;; A completed nested dialog may have published a different shared result.
    (i32.atomic.store (global.get $SHARED_MODAL_RESULT) (local.get $result))
    (global.set $modal_result (local.get $result))
    (global.set $modal_ret_addr (local.get $ret))
    (global.set $modal_saved_esp (local.get $esp))
    (global.set $modal_esp_adjust (local.get $adjust))
    (global.set $modal_restore_pending (local.get $pending))
    (global.set $modal_saved_ebx (local.get $ebx))
    (global.set $modal_saved_esi (local.get $esi))
    (global.set $modal_saved_edi (local.get $edi))
    (global.set $modal_saved_ebp (local.get $ebp)))

  (func $modal_done (param $result i32)
    (local $shared_hwnd i32)
    (local.set $shared_hwnd (i32.atomic.load (global.get $SHARED_MODAL_DLG_HWND)))
    (i32.atomic.store (global.get $SHARED_MODAL_RESULT) (local.get $result))
    ;; The instance that opened the modal can tear it down immediately. A
    ;; main-thread renderer shadow only signals completion; the guest Worker
    ;; performs writeback and restores its own saved x86 frame on its next
    ;; modal-pump turn.
    (if (i32.and
          (i32.ne (global.get $modal_dlg_hwnd) (i32.const 0))
          (i32.eq (global.get $modal_dlg_hwnd) (local.get $shared_hwnd)))
      (then (call $modal_finish_local (local.get $result)))
      (else
        (if (local.get $shared_hwnd)
          (then (i32.atomic.store (global.get $SHARED_MODAL_DONE) (i32.const 1)))))))

  ;; ---- COMCTL32 property-sheet wizard ----
  ;; This implements both classic PROPSHEETHEADERA page forms: an inline
  ;; PROPSHEETPAGEA array and an HPROPSHEETPAGE array produced by
  ;; CreatePropertySheetPageA. The page itself remains application code: its
  ;; resource template is loaded normally and its DLGPROC receives the standard
  ;; initialization and PSN_* notifications.
  ;; PROPSHEETHEADERA/W share one 32-bit layout. This bit selects how inline
  ;; page string/resource pointers are interpreted; opaque page handles retain
  ;; their own encoding in the owned page record.
  (global $propsheet_pages_wide (mut i32) (i32.const 0))

  (func $propsheet_resolve_page (param $index i32) (result i32)
    (local $pages_w i32) (local $psp_g i32) (local $psp_w i32)
    (local $size i32) (local $flags i32) (local $page i32)
    (if (i32.ge_u (local.get $index) (global.get $propsheet_page_count))
      (then (return (i32.const 0))))
    ;; Convert the array base once. Inline entries use wasm pointer arithmetic;
    ;; handle arrays translate each validated page through its owned record.
    (local.set $pages_w (call $g2w (global.get $propsheet_pages)))
    (if (global.get $propsheet_pages_are_handles)
      (then
        (local.set $page (i32.load (i32.add (local.get $pages_w)
          (i32.shl (local.get $index) (i32.const 2)))))
        (if (i32.eqz (call $propsheet_page_record (local.get $page)))
          (then (return (i32.const 0))))
        (return (local.get $page))))
    (local.set $size (i32.load (local.get $pages_w)))
    (if (i32.or (i32.lt_u (local.get $size) (i32.const 40))
                (i32.gt_u (local.get $size) (i32.const 0x1000)))
      (then (return (i32.const 0))))
    (local.set $psp_g (i32.add (global.get $propsheet_pages)
      (i32.mul (local.get $index) (local.get $size))))
    (local.set $psp_w (i32.add (local.get $pages_w)
      (i32.mul (local.get $index) (local.get $size))))
    (local.set $flags (i32.load offset=4 (local.get $psp_w)))
    (if (i32.or
          (i32.ne (i32.load (local.get $psp_w)) (local.get $size))
          (i32.ne (i32.and (local.get $flags) (i32.const 0xFFFF0000)) (i32.const 0)))
      (then (return (i32.const 0))))
    (local.get $psp_g))

  (func $propsheet_prepare_inline_pages (result i32)
    (local $i i32) (local $page i32) (local $page_w i32) (local $size i32)
    (global.set $propsheet_inline_pages_initialized (i32.const 0))
    (block $done (loop $pages
      (br_if $done (i32.ge_u (local.get $i) (global.get $propsheet_page_count)))
      (local.set $page (call $propsheet_resolve_page (local.get $i)))
      (if (i32.eqz (local.get $page)) (then (return (i32.const 0))))
      (local.set $page_w (call $g2w (local.get $page)))
      (local.set $size (i32.load (local.get $page_w)))
      (call $propsheet_page_ref_change (local.get $page_w) (i32.const 1))
      (if (i32.gt_u (local.get $size) (i32.const 40))
        (then
          (drop (call $propsheet_page_callback
            (local.get $page) (local.get $page_w) (i32.const 0))))) ;; PSPCB_ADDREF
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (global.set $propsheet_inline_pages_initialized (local.get $i))
      (br $pages)))
    (i32.const 1))

  (func $propsheet_release_pages
    (local $pages_w i32) (local $i i32) (local $page i32) (local $page_w i32)
    (local.set $pages_w (call $g2w (global.get $propsheet_pages)))
    (if (global.get $propsheet_owns_page_handles)
      (then
        ;; PropertySheet owns a successful handle array and destroys those
        ;; pages in reverse array order. Start one past the last entry so the
        ;; decrement also makes zero-page/partial setup safe.
        (local.set $i (global.get $propsheet_page_count))
        (block $handles_done (loop $handles
          (br_if $handles_done (i32.eqz (local.get $i)))
          (local.set $i (i32.sub (local.get $i) (i32.const 1)))
          (local.set $page (i32.load (i32.add (local.get $pages_w)
            (i32.shl (local.get $i) (i32.const 2)))))
          (drop (call $propsheet_page_destroy_owned (local.get $page)))
          (br $handles)))
        (global.set $propsheet_owns_page_handles (i32.const 0))
        (return)))
    ;; PSH_PROPSHEETPAGE creates its inline records implicitly. Release every
    ;; initialized record, including a page whose dialog was never selected,
    ;; in the same documented reverse array order as explicit page handles.
    (local.set $i (global.get $propsheet_inline_pages_initialized))
    (block $inline_done (loop $inline
      (br_if $inline_done (i32.eqz (local.get $i)))
      (local.set $i (i32.sub (local.get $i) (i32.const 1)))
      (local.set $page (call $propsheet_resolve_page (local.get $i)))
      (if (local.get $page)
        (then
          (local.set $page_w (call $g2w (local.get $page)))
          (drop (call $propsheet_page_callback
            (local.get $page) (local.get $page_w) (i32.const 1))) ;; PSPCB_RELEASE
          (call $propsheet_page_ref_change (local.get $page_w) (i32.const -1))))
      (br $inline)))
    (global.set $propsheet_inline_pages_initialized (i32.const 0)))
  (func $propsheet_notify (param $page i32) (param $code i32) (result i32)
    (local $nm_g i32) (local $nm_w i32) (local $ret i32)
    (if (i32.eqz (local.get $page)) (then (return (i32.const 0))))
    (local.set $nm_g (call $heap_alloc (i32.const 12)))
    (if (i32.eqz (local.get $nm_g)) (then (return (i32.const 0))))
    (local.set $nm_w (call $g2w (local.get $nm_g)))
    (i32.store (local.get $nm_w) (global.get $propsheet_frame_hwnd))
    (i32.store offset=4 (local.get $nm_w) (i32.const 0))
    (i32.store offset=8 (local.get $nm_w) (local.get $code))
    (drop (call $dialog_extra_set (local.get $page) (i32.const 0) (i32.const 0)))
    (local.set $ret (call $wnd_send_message
      (local.get $page) (i32.const 0x004E) (i32.const 0) (local.get $nm_g)))
    (call $heap_free (local.get $nm_g))
    (local.get $ret))

  (func $propsheet_page_hwnds_release
    (if (global.get $propsheet_page_hwnds)
      (then
        (call $heap_free (global.get $propsheet_page_hwnds))
        (global.set $propsheet_page_hwnds (i32.const 0)))))

  (func $propsheet_page_hwnds_alloc (result i32)
    (local $bytes i32) (local $page_hwnds_w i32)
    (call $propsheet_page_hwnds_release)
    (local.set $bytes
      (i32.shl (global.get $propsheet_page_count) (i32.const 2)))
    (global.set $propsheet_page_hwnds (call $heap_alloc (local.get $bytes)))
    (if (i32.eqz (global.get $propsheet_page_hwnds))
      (then (return (i32.const 0))))
    (local.set $page_hwnds_w (call $g2w (global.get $propsheet_page_hwnds)))
    (memory.fill (local.get $page_hwnds_w) (i32.const 0) (local.get $bytes))
    (i32.const 1))

  (func $propsheet_page_hwnd_get (param $index i32) (result i32)
    (if (i32.or
          (i32.eqz (global.get $propsheet_page_hwnds))
          (i32.ge_u (local.get $index) (global.get $propsheet_page_count)))
      (then (return (i32.const 0))))
    (i32.load (i32.add
      (call $g2w (global.get $propsheet_page_hwnds))
      (i32.shl (local.get $index) (i32.const 2)))))

  (func $propsheet_page_hwnd_set (param $index i32) (param $page i32)
    (if (i32.or
          (i32.eqz (global.get $propsheet_page_hwnds))
          (i32.ge_u (local.get $index) (global.get $propsheet_page_count)))
      (then (return)))
    (i32.store (i32.add
      (call $g2w (global.get $propsheet_page_hwnds))
      (i32.shl (local.get $index) (i32.const 2)))
      (local.get $page)))

  ;; Inactive property pages remain live children. Mirror ShowWindow's
  ;; visibility bookkeeping so hidden descendants neither paint nor receive
  ;; mouse input, while their HWND/control records remain untouched.
  (func $propsheet_hide_page
    (local $page i32)
    (local.set $page (global.get $propsheet_page_hwnd))
    (if (local.get $page)
      (then
        (drop (call $host_show_window (local.get $page) (i32.const 0)))
        (call $wnd_uncover_parent (local.get $page))
        (drop (call $wnd_set_style (local.get $page)
          (i32.and (call $wnd_get_style (local.get $page))
            (i32.const 0xEFFFFFFF))))
        (call $paint_clear_subtree (local.get $page))
        (global.set $propsheet_page_hwnd (i32.const 0)))))

  ;; PSN_WIZFINISH is allowed to perform the complete install before it
  ;; returns. Enter that DLGPROC through the modal continuation so the CLI and
  ;; browser regain control between bounded batches while it copies files.
  (func $propsheet_begin_finish (param $page i32)
    (local $nm_g i32) (local $nm_w i32) (local $proc i32)
    (if (i32.or (i32.eqz (local.get $page))
                (global.get $propsheet_finish_page))
      (then (return)))
    (local.set $proc (call $dialog_proc_get (local.get $page)))
    (if (i32.eqz (local.get $proc)) (then (return)))
    (local.set $nm_g (call $heap_alloc (i32.const 12)))
    (if (i32.eqz (local.get $nm_g)) (then (return)))
    (local.set $nm_w (call $g2w (local.get $nm_g)))
    (i32.store (local.get $nm_w) (global.get $propsheet_frame_hwnd))
    (i32.store offset=4 (local.get $nm_w) (i32.const 0))
    (i32.store offset=8 (local.get $nm_w) (i32.const -208)) ;; PSN_WIZFINISH
    (drop (call $dialog_extra_set (local.get $page) (i32.const 0) (i32.const 0)))
    (global.set $propsheet_finish_page (local.get $page))
    (global.set $propsheet_finish_nmhdr (local.get $nm_g))
    ;; DLGPROC(hwnd, WM_NOTIFY, 0, nmhdr), stdcall return through CACA0006.
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $modal_loop_thunk))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)) (local.get $page))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)) (i32.const 0x004E))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)) (i32.const 0))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)) (local.get $nm_g))
    (global.set $eip (local.get $proc))
    (global.set $steps (i32.const 0)))

  (func $propsheet_show_page (param $index i32) (result i32)
    (local $psp_g i32) (local $psp_w i32) (local $size i32) (local $flags i32)
    (local $wide i32)
    (local $page i32) (local $hinst i32) (local $template i32) (local $proc i32)
    (local.set $psp_g (call $propsheet_resolve_page (local.get $index)))
    (if (i32.eqz (local.get $psp_g)) (then (return (i32.const 0))))
    (local.set $psp_w (call $g2w (local.get $psp_g)))
    (local.set $size (i32.load (local.get $psp_w)))
    (local.set $flags (i32.load offset=4 (local.get $psp_w)))
    (if (global.get $propsheet_pages_are_handles)
      (then
        (local.set $wide
          (call $propsheet_page_is_wide (local.get $psp_g))))
      (else
        (local.set $wide (global.get $propsheet_pages_wide))))
    ;; A page already visited owns a live dialog. Show that exact HWND again;
    ;; do not repeat PSPCB_CREATE, WM_INITDIALOG, resource loading, or control
    ;; construction, because Win98 preserves the page between activations.
    (local.set $page (call $propsheet_page_hwnd_get (local.get $index)))
    (if (local.get $page)
      (then
        (drop (call $host_show_window (local.get $page) (i32.const 5)))
        (drop (call $wnd_set_style (local.get $page)
          (i32.or (call $wnd_get_style (local.get $page))
            (i32.const 0x10000000))))
        (global.set $propsheet_page_index (local.get $index))
        (global.set $propsheet_page_hwnd (local.get $page))
        (global.set $dlg_hwnd (local.get $page))
        (drop (call $propsheet_notify
          (local.get $page) (i32.const -200))) ;; PSN_SETACTIVE
        (call $dlg_seed_focus (local.get $page))
        (call $dlg_fill_bkgnd (local.get $page))
        (call $paint_flag_set_inv (local.get $page))
        (return (local.get $page))))
    ;; PSPCB_CREATE belongs to dialog materialization, not handle allocation.
    ;; Its zero return vetoes this page before any HWND or resource is created.
    (if (i32.eqz (call $propsheet_page_callback
          (local.get $psp_g) (local.get $psp_w) (i32.const 2)))
      (then (return (i32.const 0))))
    (local.set $hinst (i32.load offset=8 (local.get $psp_w)))
    (local.set $template (i32.load offset=12 (local.get $psp_w)))
    (local.set $proc (i32.load offset=24 (local.get $psp_w)))
    (if (i32.or (i32.eqz (local.get $template)) (i32.eqz (local.get $proc)))
      (then (return (i32.const 0))))
    (local.set $page (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (call $wnd_table_set (local.get $page) (global.get $WNDPROC_DIALOG))
    (call $wnd_unicode_set (local.get $page) (local.get $wide))
    (drop (call $dialog_proc_set (local.get $page) (local.get $proc)))
    (call $wnd_set_parent (local.get $page) (global.get $propsheet_frame_hwnd))
    (call $push_rsrc_ctx (local.get $hinst))
    ;; Zero controls is valid: installers commonly use an empty page template
    ;; and create all controls from WM_INITDIALOG.
    (if (i32.ne (i32.and (local.get $flags) (i32.const 1)) (i32.const 0))
      (then (global.set $dlg_indirect_template_ptr (local.get $template))))
    (if (local.get $wide)
      (then (drop (call $dlg_load_w (local.get $page) (local.get $template))))
      (else (drop (call $dlg_load (local.get $page) (local.get $template)))))
    (call $pop_rsrc_ctx)
    ;; COMCTL strips WS_DISABLED from a page template and owns visibility.
    (drop (call $wnd_set_style (local.get $page)
      (i32.or
        (i32.and (call $wnd_get_style (local.get $page)) (i32.const 0xF7FFFFFF))
        (i32.const 0x50000000))))
    (call $ctrl_geom_set (call $wnd_table_find (local.get $page))
      (i32.const 10) (i32.const 10) (i32.const 420) (i32.const 228))
    (call $host_dialog_loaded (local.get $page) (global.get $propsheet_frame_hwnd))
    (call $host_set_parent (local.get $page) (global.get $propsheet_frame_hwnd))
    (call $host_move_window (local.get $page)
      (i32.const 10) (i32.const 10) (i32.const 420) (i32.const 228) (i32.const 1))
    (call $host_show_window (local.get $page) (i32.const 5))
    (call $propsheet_page_hwnd_set (local.get $index) (local.get $page))
    (global.set $propsheet_page_index (local.get $index))
    (global.set $propsheet_page_hwnd (local.get $page))
    (global.set $dlg_hwnd (local.get $page))
    (drop (call $wnd_send_message
      (local.get $page) (i32.const 0x0110) (i32.const 0) (local.get $psp_g)))
    (drop (call $propsheet_notify (local.get $page) (i32.const -200))) ;; PSN_SETACTIVE
    (call $dlg_seed_focus (local.get $page))
    (call $dlg_fill_bkgnd (local.get $page))
    (call $paint_flag_set_inv (local.get $page))
    (local.get $page))

  (func $propsheet_change_page (param $delta i32)
    (local $old i32) (local $old_index i32) (local $next i32)
    (local $notify i32) (local $ret i32)
    (local.set $old (global.get $propsheet_page_hwnd))
    (local.set $old_index (global.get $propsheet_page_index))
    (if (i32.eqz (local.get $old)) (then (return)))
    (local.set $notify (select (i32.const -207) (i32.const -206) (i32.gt_s (local.get $delta) (i32.const 0))))
    (local.set $ret (call $propsheet_notify (local.get $old) (local.get $notify)))
    ;; A non-zero DWL_MSGRESULT vetoes the transition or names a page. The
    ;; common installer path returns zero for the adjacent page.
    (if (local.get $ret) (then (return)))
    (local.set $next (i32.add (global.get $propsheet_page_index) (local.get $delta)))
    (if (i32.lt_s (local.get $next) (i32.const 0)) (then (return)))
    (if (i32.ge_u (local.get $next) (global.get $propsheet_page_count))
      (then
        (call $propsheet_begin_finish (local.get $old))
        (return)))
    (drop (call $propsheet_notify (local.get $old) (i32.const -201))) ;; PSN_KILLACTIVE
    (call $propsheet_hide_page)
    ;; If a lazy target cannot be materialized, restore the previous live page
    ;; instead of leaving a blank sheet after PSN_KILLACTIVE.
    (if (i32.eqz (call $propsheet_show_page (local.get $next)))
      (then (drop (call $propsheet_show_page (local.get $old_index))))))

  (func $propsheet_wndproc
    (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $cmd i32)
    ;; PSM_SETWIZBUTTONS. Page code commonly posts this during PSN_SETACTIVE;
    ;; navigation state is also derived from the current page below.
    (if (i32.eq (local.get $msg) (i32.const 0x0470))
      (then (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0111))
      (then
        (local.set $cmd (i32.and (local.get $wParam) (i32.const 0xFFFF)))
        (if (i32.or (i32.eq (local.get $cmd) (i32.const 1))
                    (i32.eq (local.get $cmd) (i32.const 0x3024)))
          (then (call $propsheet_change_page (i32.const 1)) (return (i32.const 0))))
        (if (i32.eq (local.get $cmd) (i32.const 0x3023))
          (then (call $propsheet_change_page (i32.const -1)) (return (i32.const 0))))
        (if (i32.eq (local.get $cmd) (i32.const 2))
          (then
            ;; Page-level PSN_QUERYCANCEL may open a nested modal prompt. The
            ;; common modal pump is intentionally single-level, so return the
            ;; documented PropertySheetA cancel result without replacing its
            ;; saved frame with an inner MessageBox frame.
            (call $modal_done (i32.const 0))
            (return (i32.const 0))))))
    (if (i32.and (i32.eq (local.get $msg) (i32.const 0x0112))
                 (i32.eq (local.get $wParam) (i32.const 0xF060)))
      (then (call $modal_done (i32.const 0)) (return (i32.const 0))))
    (i32.const 0))

  ;; Win98's PropertySheetA accepts only the three 32-bit header versions that
  ;; shipped with its common-controls line.  It rejects nPages >= 100 and flag
  ;; bits 26..31 before allocating the internal sheet.  Keep our additional
  ;; zero-page/NULL-array guard: those inputs cannot describe a usable sheet
  ;; and otherwise reach an unchecked page-array dereference below.
  (func $propsheet_header_valid (param $header_w i32) (result i32)
    (local $size i32) (local $flags i32) (local $count i32)
    (local.set $size (i32.load (local.get $header_w)))
    (if (i32.and
          (i32.ne (local.get $size) (i32.const 36))
          (i32.and
            (i32.ne (local.get $size) (i32.const 40))
            (i32.ne (local.get $size) (i32.const 52))))
      (then (return (i32.const 0))))
    (local.set $flags (i32.load offset=4 (local.get $header_w)))
    (if (i32.ne
          (i32.and (local.get $flags) (i32.const 0xFC000000))
          (i32.const 0))
      (then (return (i32.const 0))))
    (local.set $count (i32.load offset=24 (local.get $header_w)))
    (if (i32.or
          (i32.or (i32.eqz (local.get $count))
                  (i32.ge_u (local.get $count) (i32.const 100)))
          (i32.eqz (i32.load offset=32 (local.get $header_w))))
      (then (return (i32.const 0))))
    (i32.const 1))

  (func $create_property_sheet
      (param $header_g i32) (param $wide i32) (result i32)
    (local $header_w i32) (local $flags i32) (local $owner i32)
    (local $caption_g i32) (local $caption_w i32) (local $caption_copy i32)
    (local $caption_len i32) (local $dlg i32)
    (local $start i32)
    (local.set $header_w (call $g2w (local.get $header_g)))
    (if (i32.eqz (call $propsheet_header_valid (local.get $header_w)))
      (then (return (i32.const 0))))
    (local.set $flags (i32.load offset=4 (local.get $header_w)))
    (global.set $propsheet_header (local.get $header_g))
    (global.set $propsheet_pages_wide (local.get $wide))
    (global.set $propsheet_page_count (i32.load offset=24 (local.get $header_w)))
    (global.set $propsheet_pages (i32.load offset=32 (local.get $header_w)))
    (global.set $propsheet_pages_are_handles
      (i32.eqz (i32.and (local.get $flags) (i32.const 0x00000008))))
    (global.set $propsheet_owns_page_handles (i32.const 0))
    (global.set $propsheet_inline_pages_initialized (i32.const 0))
    (global.set $propsheet_owns_page_handles
      (global.get $propsheet_pages_are_handles))
    (if (i32.and
          (i32.eqz (global.get $propsheet_pages_are_handles))
          (i32.eqz (call $propsheet_prepare_inline_pages)))
      (then
        (call $propsheet_release_pages)
        (return (i32.const 0))))
    (if (i32.eqz (call $propsheet_page_hwnds_alloc))
      (then
        (call $propsheet_release_pages)
        (return (i32.const 0))))
    (local.set $owner (i32.load offset=8 (local.get $header_w)))
    (local.set $caption_g (i32.load offset=20 (local.get $header_w)))
    (if (local.get $caption_g)
      (then
        (if (local.get $wide)
          (then
            (local.set $caption_len (call $guest_wcslen (local.get $caption_g)))
            (local.set $caption_copy
              (call $heap_alloc (i32.add (local.get $caption_len) (i32.const 1))))
            (if (i32.eqz (local.get $caption_copy))
              (then
                (call $propsheet_page_hwnds_release)
                (call $propsheet_release_pages)
                (return (i32.const 0))))
            (drop (call $wide_to_ansi
              (local.get $caption_g) (local.get $caption_copy)
              (i32.add (local.get $caption_len) (i32.const 1))))
            (local.set $caption_w (call $g2w (local.get $caption_copy))))
          (else
            (local.set $caption_w (call $g2w (local.get $caption_g)))
            (local.set $caption_len (call $strlen (local.get $caption_w)))))))
    (local.set $dlg (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (call $host_register_dialog_frame
      (local.get $dlg) (local.get $owner) (local.get $caption_w)
      (i32.const 440) (i32.const 310) (i32.const 1))
    (call $wnd_table_set (local.get $dlg) (global.get $WNDPROC_CTRL_NATIVE))
    (call $wnd_unicode_set (local.get $dlg) (local.get $wide))
    (call $wnd_set_owner (local.get $dlg) (local.get $owner))
    (drop (call $wnd_set_style (local.get $dlg) (i32.const 0x90C80000)))
    (call $ctrl_table_set (call $wnd_table_find (local.get $dlg)) (i32.const 32) (i32.const 0))
    (if (local.get $caption_w)
      (then (call $title_table_set
        (local.get $dlg) (local.get $caption_w) (local.get $caption_len))))
    (if (local.get $caption_copy)
      (then (call $heap_free (local.get $caption_copy))))
    (call $defwndproc_do_nccalcsize (local.get $dlg))
    (call $nc_flags_set (local.get $dlg) (i32.const 3))
    (call $dlg_fill_bkgnd (local.get $dlg))
    (global.set $propsheet_frame_hwnd (local.get $dlg))
    (global.set $propsheet_page_hwnd (i32.const 0))
    ;; Standard Win98 wizard navigation controls.
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 1) (i32.const 0x3023)
      (i32.const 188) (i32.const 250) (i32.const 74) (i32.const 24) (i32.const 0x50010000)
      (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x215) (i32.const 4))))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 1) (i32.const 0x3024)
      (i32.const 266) (i32.const 250) (i32.const 74) (i32.const 24) (i32.const 0x50010001)
      (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x21A) (i32.const 4))))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 1) (i32.const 2)
      (i32.const 350) (i32.const 250) (i32.const 74) (i32.const 24) (i32.const 0x50010000)
      (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x3) (i32.const 6))))
    (local.set $start (i32.load offset=28 (local.get $header_w)))
    (if (i32.ge_u (local.get $start) (global.get $propsheet_page_count))
      (then (local.set $start (i32.const 0))))
    (if (i32.eqz (call $propsheet_show_page (local.get $start)))
      (then
        (call $wnd_destroy_tree (local.get $dlg))
        (call $host_destroy_window (local.get $dlg))
        (global.set $propsheet_frame_hwnd (i32.const 0))
        (call $propsheet_page_hwnds_release)
        (call $propsheet_release_pages)
        (return (i32.const 0))))
    ;; The sheet becomes the app's main window only when there is no visible
    ;; one to keep -- an installer whose whole UI is the wizard (Jazz2's demo
    ;; setup). A game that opens a wizard over its own window must keep that
    ;; window as main: $main_hwnd is also where a DirectDraw primary is
    ;; presented (get_dx_present_hwnd), so handing it to War Wind's
    ;; Multiplayer Wizard, opened over its exclusive 640x480 display, put the
    ;; primary into a frame layer over the wizard's client area. Every page
    ;; control and label was buried under the game frame, and the page read as
    ;; a captioned hole in the screen.
    (if (i32.or
          (i32.eqz (global.get $main_hwnd))
          (i32.eqz (call $wnd_is_effectively_visible (global.get $main_hwnd))))
      (then (call $main_hwnd_adopt (local.get $dlg))))
    (local.get $dlg))

  ;; Allocate a new control hwnd, register it as WNDPROC_CTRL_NATIVE,
  ;; populate CONTROL_TABLE with class+id, set parent, then deliver
  ;; WM_CREATE to trigger the wndproc's state allocation.
  ;;
  ;; STEP 6 note: this does NOT call $host_create_window. The renderer
  ;; doesn't see these child windows yet — they're WAT-internal state
  ;; only. The JS-side find dialog (still created by $host_show_find_dialog)
  ;; provides the visible UI. Visual unification is STEP 8.
  ;;
  ;; ctrl_class: 1=Button, 2=Edit, 3=Static (matches $control_wndproc_dispatch)
  (func $ctrl_create_child
    (param $parent i32) (param $ctrl_class i32) (param $ctrl_id i32)
    (param $x i32) (param $y i32) (param $w i32) (param $h i32)
    (param $style i32) (param $text_wa i32) (result i32)
    (local $hwnd i32) (local $cs i32) (local $cs_w i32)
    (local.set $hwnd (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (call $wnd_table_set (local.get $hwnd) (global.get $WNDPROC_CTRL_NATIVE))
    (call $wnd_set_parent (local.get $hwnd) (local.get $parent))
    (drop (call $wnd_set_style (local.get $hwnd) (local.get $style)))
    (call $ctrl_table_set
      (call $wnd_table_find (local.get $hwnd))
      (local.get $ctrl_class) (local.get $ctrl_id))
    (call $ctrl_geom_set
      (call $wnd_table_find (local.get $hwnd))
      (local.get $x) (local.get $y) (local.get $w) (local.get $h))
    ;; Build a minimal CREATESTRUCT on the heap and deliver WM_CREATE.
    (local.set $cs (call $heap_alloc (i32.const 48)))
    (local.set $cs_w (call $g2w (local.get $cs)))
    (i32.store (local.get $cs_w) (i32.const 0))
    (i32.store offset=4 (local.get $cs_w) (i32.const 0))
    (i32.store offset=8 (local.get $cs_w) (local.get $ctrl_id))
    (i32.store offset=12 (local.get $cs_w) (local.get $parent))
    (i32.store offset=16 (local.get $cs_w) (local.get $h))
    (i32.store offset=20 (local.get $cs_w) (local.get $w))
    (i32.store offset=24 (local.get $cs_w) (local.get $y))
    (i32.store offset=28 (local.get $cs_w) (local.get $x))
    (i32.store offset=32 (local.get $cs_w) (local.get $style))
    (i32.store offset=36 (local.get $cs_w) (local.get $text_wa))
    (i32.store offset=40 (local.get $cs_w) (i32.const 0))
    (i32.store offset=44 (local.get $cs_w) (i32.const 0))
    (drop (call $wnd_send_message
            (local.get $hwnd) (i32.const 0x0001) (i32.const 0) (local.get $cs)))
    (call $heap_free (local.get $cs))
    ;; Queue an initial WM_PAINT so the control draws on next GetMessage
    ;; cycle — same path CreateWindowExA takes for guest-created children.
    (if (i32.and (local.get $style) (i32.const 0x10000000))  ;; WS_VISIBLE
      (then (call $paint_flag_set_inv (local.get $hwnd))))
    (local.get $hwnd)
  )

  ;; Build WAT-side state for the Find/Replace dialog as a parallel shadow
  ;; of the JS-side find dialog. The JS dialog (created by show_find_dialog)
  ;; remains the visible UI and the legacy test path still works through
  ;; renderer.windows[]. The new WAT side provides EditState that the test
  ;; bridge queries via get_findreplace_edit + get_edit_text exports.
  ;;
  ;; $dlg is pre-allocated by the caller (typically $handle_FindTextA's
  ;; $hwnd, the same hwnd handed to the renderer). We register it in the
  ;; window table as WNDPROC_CTRL_NATIVE so $wnd_send_message routes
  ;; messages to it via $control_wndproc_dispatch.
  (func $create_findreplace_dialog (param $dlg i32) (param $owner i32) (param $fr_guest i32) (param $is_replace i32)
    (local $edit i32) (local $replace_edit i32) (local $down i32) (local $slot i32) (local $ch i32)
    ;; Frame (renderer.windows[] entry, isFindDialog flag for hit-test path).
    ;; Same pattern as $create_about_dialog: WAT calls into JS via the
    ;; bare host_register_dialog_frame import — JS does no Win32 logic.
    (call $host_register_dialog_frame
      (local.get $dlg) (local.get $owner)
      (select (region.addr $USER_DIALOG_STRINGS 0x160) (region.addr $USER_DIALOG_STRINGS 0x17B) (local.get $is_replace))
      (i32.const 340) (select (i32.const 160) (i32.const 128) (local.get $is_replace))
      (i32.const 2))      ;; kind bit 1 = isFindDialog
    (call $wnd_table_set (local.get $dlg) (global.get $WNDPROC_CTRL_NATIVE))
    (call $title_table_set (local.get $dlg)
      (select (region.addr $USER_DIALOG_STRINGS 0x160) (region.addr $USER_DIALOG_STRINGS 0x17B) (local.get $is_replace))
      (select (i32.const 7) (i32.const 4) (local.get $is_replace)))
    (call $wnd_set_owner (local.get $dlg) (local.get $owner))
    (drop (call $wnd_set_style (local.get $dlg) (i32.const 0x90C80000)))
    ;; Tag the parent dialog as control class 10 so $control_wndproc_dispatch
    ;; routes WM_COMMAND from child buttons to $findreplace_wndproc.
    (call $ctrl_table_set (call $wnd_table_find (local.get $dlg))
      (i32.const 10) (i32.const 0))
    ;; Establish the dialog client rect before creating/painting children.
    ;; Child geometry is client-relative; without NCCALCSIZE it is treated
    ;; as window-relative until the later message pump catches up.
    (call $defwndproc_do_nccalcsize (local.get $dlg))
    ;; Paint the dialog chrome/background before child creation. The modeless
    ;; Find dialog shares one back-canvas with its WAT children, so a later
    ;; queued parent paint would cover the children.
    (drop (call $host_erase_background (local.get $dlg) (i32.const 16)))
    (call $defwndproc_do_ncpaint (local.get $dlg))
    ;; Static "Find what:"
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 3) (i32.const 0xFFFF)
            (i32.const 8) (i32.const 10) (i32.const 64) (i32.const 14)
            (i32.const 0x50000000)
            (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x120) (i32.const 10))))
    ;; Edit (the one the test cares about)
    (local.set $edit (call $ctrl_create_child (local.get $dlg) (i32.const 2) (i32.const 0x480)
                       (i32.const 74) (i32.const 8) (i32.const 164) (i32.const 18)
                       (i32.const 0x50810000) (i32.const 0)))
    (global.set $findreplace_edit_hwnd (local.get $edit))
    (global.set $findreplace_replace_hwnd (i32.const 0))
    (global.set $findreplace_is_replace (local.get $is_replace))
    (if (local.get $is_replace)
      (then
        (drop (call $ctrl_create_child (local.get $dlg) (i32.const 3) (i32.const 0xFFFF)
                (i32.const 8) (i32.const 38) (i32.const 74) (i32.const 14)
                (i32.const 0x50000000)
                (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x12B) (i32.const 13))))
        (local.set $replace_edit (call $ctrl_create_child
          (local.get $dlg) (i32.const 2) (i32.const 0x481)
          (i32.const 84) (i32.const 34) (i32.const 154) (i32.const 18)
          (i32.const 0x50810000) (i32.const 0)))
        (global.set $findreplace_replace_hwnd (local.get $replace_edit))))
    ;; Match case checkbox
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 1) (i32.const 0x411)
            (i32.const 8) (select (i32.const 64) (i32.const 38) (local.get $is_replace))
            (i32.const 80) (i32.const 14)
            (i32.const 0x50010003)
            (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x139) (i32.const 10))))
    ;; Direction groupbox + radios
    (if (i32.eqz (local.get $is_replace))
      (then
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 1) (i32.const 0x440)
            (i32.const 128) (i32.const 28) (i32.const 110) (i32.const 38)
            (i32.const 0x50000007)
            (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x144) (i32.const 9))))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 1) (i32.const 0x420)
            (i32.const 136) (i32.const 40) (i32.const 42) (i32.const 14)
            (i32.const 0x50010009)
            (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x14E) (i32.const 2))))
    (local.set $down (call $ctrl_create_child (local.get $dlg) (i32.const 1) (i32.const 0x421)
            (i32.const 184) (i32.const 40) (i32.const 48) (i32.const 14)
            (i32.const 0x50010009)
            (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x151) (i32.const 4))))
    ;; Default: Down direction checked (matches Win98 Notepad Find dialog).
    (drop (call $wnd_send_message (local.get $down) (i32.const 0x00F1) (i32.const 1) (i32.const 0)))))
    ;; Find Next + Cancel buttons
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 1) (i32.const 1)
            (i32.const 248) (i32.const 6) (i32.const 80) (i32.const 24)
            (i32.const 0x50010001)
            (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x156) (i32.const 9))))
    (if (local.get $is_replace)
      (then
        (drop (call $ctrl_create_child (local.get $dlg) (i32.const 1) (i32.const 0x400)
                (i32.const 248) (i32.const 34) (i32.const 80) (i32.const 24)
                (i32.const 0x50010000)
                (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x160) (i32.const 7))))
        (drop (call $ctrl_create_child (local.get $dlg) (i32.const 1) (i32.const 0x401)
                (i32.const 248) (i32.const 62) (i32.const 80) (i32.const 24)
                (i32.const 0x50010000)
                (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x168) (i32.const 11))))))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 1) (i32.const 2)
            (i32.const 248) (select (i32.const 90) (i32.const 34) (local.get $is_replace))
            (i32.const 80) (i32.const 24)
            (i32.const 0x50010000)
            (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x3) (i32.const 6))))
    ;; Stash FR struct ptr in dialog userdata for a future $wndproc_dialog.
    (drop (call $wnd_set_userdata (local.get $dlg) (local.get $fr_guest)))
    (global.set $findreplace_dlg_hwnd (local.get $dlg))
    ;; Publish ctrl_count in WND_DLG_RECORDS so renderer-input.js's Tab
    ;; traversal (gated on dlg_get_ctrl_count > 0) recognises this hwnd as
    ;; a dialog. $dlg_load writes this for resource dialogs; WAT-built
    ;; dialogs must do it themselves. Find has 8 controls; Replace has 9.
    (i32.store offset=28 (call $dlg_record_for_hwnd (local.get $dlg))
               (select (i32.const 9) (i32.const 8) (local.get $is_replace)))
    ;; Modeless Find has no modal child-paint drain. Paint the WAT-built
    ;; children once now so the dialog opens with labels/buttons visible.
    (local.set $slot (i32.const 0))
    (block $paint_done (loop $paint_children
      (local.set $slot (call $wnd_next_child_slot (local.get $dlg) (local.get $slot)))
      (br_if $paint_done (i32.eq (local.get $slot) (i32.const -1)))
      (local.set $ch (call $wnd_slot_hwnd (local.get $slot)))
      (if (local.get $ch)
        (then (drop (call $wnd_send_message
          (local.get $ch) (i32.const 0x000F) (i32.const 0) (i32.const 0)))))
      (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
      (br $paint_children)))
    ;; Seed initial focus on the first tabstop child (the "Find what" edit)
    ;; so Tab/Shift+Tab traversal works without a prior click.
    (call $dlg_seed_focus (local.get $dlg))
  )
