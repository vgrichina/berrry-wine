(import "host" "log_eip" (func $host_log_eip (param i32))) (memory 128 128) (export "memory" (memory 0))
(global $eip (mut i32) (i32.const 0))
(global $last_run_halt (mut i32) (i32.const 0))
(global $dlg_pump_hwnd (mut i32) (i32.const 0))
(global $dlg_ret_addr (mut i32) (i32.const 0))
(global $dlg_ended (mut i32) (i32.const 0))
(global $sync_msg_depth (mut i32) (i32.const 0))
(global $code16 (mut i32) (i32.const 0))
(global $host_shadow (mut i32) (i32.const 0))
(global $handler_set_eip (mut i32) (i32.const 0))
(global $steps (mut i32) (i32.const 0))
(global $yield_reason (mut i32) (i32.const 0))
(global $yield_flag (mut i32) (i32.const 0))
(global $sleep_yielded (mut i32) (i32.const 0))
(global $wnd_send_completed (mut i32) (i32.const 0))
(global $dlg_result (mut i32) (i32.const 0))
(global $dlg_proc (mut i32) (i32.const 0))
(global $dlg_callback_yield_pending (mut i32) (i32.const 0))
(global $dlg_init_focus_hwnd (mut i32) (i32.const 0))
(global $dlg_hwnd (mut i32) (i32.const 0))
(global $dlg_show_pending (mut i32) (i32.const 0))
(global $active_hwnd (mut i32) (i32.const 0))
(global $main_hwnd (mut i32) (i32.const 0))
(global $quit_flag (mut i32) (i32.const 0))
(global $review_run_mode (mut i32) (i32.const 0))(global $reg_base i32 (i32.const 0)) (global $SHARED_DLG_PUMP_HWND i32 (i32.const 128)) (global $SHARED_DLG_ENDED i32 (i32.const 132)) (global $SHARED_DLG_RESULT i32 (i32.const 136)) (global $WNDPROC_DIALOG i32 (i32.const -2)) (global $WNDPROC_BUILTIN i32 (i32.const -3)) (global $sync_msg_ret_thunk i32 (i32.const 0x7500000)) (global $invocation_root i64 (i64.const 900)) (global $token (mut i64) (i64.const 100))
(layout EditState (field text_buf_ptr i32) (field text_len i32))
(func $invocation_current (result i64) (global.get $token)) (func $sync_depth_enter (global.set $sync_msg_depth (i32.add (global.get $sync_msg_depth) (i32.const 1))) (global.set $token (i64.add (global.get $token) (i64.const 1)))) (func $sync_depth_leave (global.set $sync_msg_depth (i32.sub (global.get $sync_msg_depth) (i32.const 1))) (global.set $token (i64.sub (global.get $token) (i64.const 1))))
  ;; Opt-in NULL boundary diagnostics. Existing log_eip import only; no arena.
  ;; Negative tags -1..-6 belong to this protocol only while explicitly armed.
  (global $null_diag_on (mut i32) (i32.const 0))
  (global $null_diag_count (mut i32) (i32.const 0))
  (global $null_diag_saved_eip (mut i32) (i32.const 0))
  (global $null_diag_saved_esp (mut i32) (i32.const 0))
  (func (export "set_null_diag") (param $on i32)
    (global.set $null_diag_on (i32.ne (local.get $on) (i32.const 0)))
    (global.set $null_diag_count (i32.const 0)))
  (func $null_diag_event (param $kind i32) (param $saved_eip i32) (param $saved_esp i32)
    (if (global.get $null_diag_on) (then
      (global.set $null_diag_saved_eip (local.get $saved_eip))
      (global.set $null_diag_saved_esp (local.get $saved_esp))
      (global.set $null_diag_count (i32.add (global.get $null_diag_count) (i32.const 1)))
      (if (i32.gt_u (global.get $null_diag_count) (i32.const 32))
        (then (call $host_log_eip (i32.const -6)) (unreachable)))
      (call $host_log_eip (i32.sub (i32.const 0) (local.get $kind)))
      ;; A returning/misconfigured observer must never resume a zero guest.
      (if (i32.eq (local.get $kind) (i32.const 5)) (then (unreachable))))))
  (func (export "null_diag_field") (param $field i32) (result i32)
    (if (i32.eq (local.get $field) (i32.const 0)) (then (return (global.get $null_diag_saved_eip))))
    (if (i32.eq (local.get $field) (i32.const 1)) (then (return (global.get $null_diag_saved_esp))))
    (if (i32.eq (local.get $field) (i32.const 2)) (then (return (global.get $dlg_pump_hwnd))))
    (if (i32.eq (local.get $field) (i32.const 3)) (then (return (global.get $dlg_ret_addr))))
    (if (i32.eq (local.get $field) (i32.const 4)) (then (return (global.get $dlg_ended))))
    (if (i32.eq (local.get $field) (i32.const 5)) (then (return (i32.load (global.get $SHARED_DLG_PUMP_HWND)))))
    (if (i32.eq (local.get $field) (i32.const 6)) (then (return (i32.load (global.get $SHARED_DLG_ENDED)))))
    (if (i32.eq (local.get $field) (i32.const 7)) (then (return (global.get $sync_msg_depth))))
    (if (i32.eq (local.get $field) (i32.const 8)) (then (return (global.get $null_diag_count))))
    (i32.const -1))
  (func (export "null_diag_token") (result i64) (call $invocation_current))
  (func (export "null_diag_root") (result i64) (global.get $invocation_root))
(func $wnd_table_get (param i32) (result i32) (i32.const 4198400))
(func $ctrl_table_get_class (param i32) (result i32) (i32.const 0))
(func $tab_native_is (param i32) (result i32) (i32.const 0))
(func $tab_native_note_message (param i32) (param i32) (param i32) (param i32) )
(func $tab_native_paint (param i32) (result i32) (i32.const 0))
(func $statusbar_native_is (param i32) (result i32) (i32.const 0))
(func $statusbar_wndproc (param i32) (param i32) (param i32) (param i32) (result i32) (i32.const 0))
(func $ctrl_is_subclassed (param i32) (result i32) (i32.const 0))
(func $control_wndproc_dispatch (param i32) (param i32) (param i32) (param i32) (result i32) (i32.const 0))
(func $menu_try_edit_command (param i32) (result i32) (i32.const 0))
(func $dialog_default_proc (param i32) (param i32) (param i32) (param i32) (result i32) (i32.const 0))
(func $wat_wndproc_dispatch (param i32) (param i32) (param i32) (param i32) (result i32) (i32.const 0))
(func $wnd_get_style (param i32) (result i32) (i32.const 0))
(func $wnd_get_state_ptr (param i32) (result i32) (i32.const 0))
(func $win16_is_far_proc (param i32) (result i32) (i32.const 0))
(func $post_queue_push (param i32) (param i32) (param i32) (param i32) (result i32) (i32.const 0))
(func $host_service_load_library (result i32) (i32.const 0))
(func $host_log_i32 (param i32) )
(func $wnd_get_owner (param i32) (result i32) (i32.const 0))
(func $wnd_table_remove (param i32) )
(func $host_destroy_window (param i32) )
(func $focus_restore_after_modal (param i32) )
(func $activate_window_with_host (param i32) (result i32) (i32.const 0))
(func $dialog_apply_init_focus (param i32) (param i32) (param i32) )
(func $dlg_show_now (param i32) )
(func $wnd_destroy_children (param i32) (global.set $dlg_pump_hwnd (i32.const 999)) (global.set $dlg_ret_addr (i32.const 888)))
(func $g2w (param $a i32) (result i32) (local.get $a)) (func $gl32 (param $a i32) (result i32) (i32.load (local.get $a))) (func $gs32 (param $a i32) (param $v i32) (i32.store (local.get $a) (local.get $v)))
(func $sync_continuation (param $name_rva i32) (if (i32.eq (local.get $name_rva) (i32.const 0xCACA0005))
      (then
        (global.set $handler_set_eip (i32.const 1))
        (global.set $eip (i32.const 0))  ;; Stop nested run loop
        (return))))
(func $run (param i32)
 (if (global.get $review_run_mode) (then (return)))
 ;; Scripted successful stdcall seam, then REAL CACA0005 and REAL run zero check.
 (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
 (i32.store (i32.const 0) (i32.const 57005))
 (call $sync_continuation (i32.const 0xCACA0005))
 (block $halt       (if (i32.eqz (global.get $eip))
        (then
          (call $null_diag_event (i32.const 5) (i32.const 0) (i32.const 0))
          (global.set $last_run_halt (i32.const 2)) (br $halt)))
))
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
    (local $expected_child i64) (local $expected_root i64) (local $expected_depth i32)
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

    ;; The browser's idle host shadow (Threads: the guest's main thread runs in
    ;; a Worker) has no guest thread, so it must never enter guest code: its
    ;; registers, stack and decoded-code cache are not the owning thread's.
    ;; Running a wndproc here ran Solitaire's on that state when the
    ;; single-app maximizer sent SC_MAXIMIZE, which reached DialogBoxParamA
    ;; with the main window's handle and replaced its renderer record with an
    ;; empty dialog: the phone showed the desktop and nothing else
    ;; (THREADS-PHONE-SOL-BLANK-20261011). Post to the owner's queue instead,
    ;; as the comment on this function promises; the owning thread runs the
    ;; procedure from its own message pump.
    (if (global.get $host_shadow)
      (then
        (global.set $wnd_send_completed (i32.const 0))
        (drop (call $post_queue_push (local.get $hwnd) (local.get $msg)
                (local.get $wParam) (local.get $lParam)))
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
    ;; Allocate before touching the guest frame. These locals belong to this
    ;; nested WAT call, so another synchronous send cannot overwrite them.
    (call $sync_depth_enter)
    (local.set $expected_child (call $invocation_current))
    (local.set $expected_root (global.get $invocation_root))
    (local.set $expected_depth (global.get $sync_msg_depth))
    (call $null_diag_event (i32.const 1) (local.get $old_eip) (local.get $old_esp))
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
    (call $null_diag_event (i32.const 2) (local.get $old_eip) (local.get $old_esp))
    ;; Never pop whichever child happens to be current. A nested deferred
    ;; callback may still own execution when the bounded run stops. Reject
    ;; before restoring any caller state; host-quiescent reset owns recovery.
    (if (i64.ne (local.get $expected_child) (call $invocation_current))
      (then (unreachable)))
    (if (i64.ne (local.get $expected_root) (global.get $invocation_root))
      (then (unreachable)))
    (if (i32.ne (local.get $expected_depth) (global.get $sync_msg_depth))
      (then (unreachable)))
    ;; A completed stdcall must consume the four arguments and return word.
    ;; An incomplete bounded send retains its historical abandonment result.
    (if (i32.and (i32.eqz (global.get $eip))
          (i32.ne (local.get $old_esp) (i32.load offset=16 (global.get $reg_base))))
      (then (unreachable)))
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
(export "send" (func $wnd_send_message_inner))
(func (export "modal") (param $name_rva i32) (local $arg0 i32) (local $arg1 i32) (local $arg4 i32) (local $ending_dlg i32) (if (i32.eq (local.get $name_rva) (i32.const 0xCACA0004))
      (then
        ;; USER accepts old cdecl dialog/window callbacks. Every guest call
        ;; from this pump owns a sentinel below its four args. Stdcall leaves
        ;; it at ESP; cdecl leaves it at ESP+16. Idle reentry has no marker.
        (if (i32.eq (call $gl32 (i32.load offset=16 (global.get $reg_base))) (i32.const 0xDCBAABCD))
          (then (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))
          (else
            (if (i32.eq (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))) (i32.const 0xDCBAABCD))
              (then (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))))))
        ;; This branch always re-dispatches the pump by setting EIP; mark it
        ;; so the outer thunk-zone auto-pop (in $run) doesn't misread an
        ;; unchanged EIP as "handler left EIP alone" and pop [esp].
        (global.set $handler_set_eip (i32.const 1))
        (local.set $arg4 (i32.const 0))  ;; reuse as wndproc temp
        (if (i32.load (global.get $SHARED_DLG_ENDED))
          (then
            (global.set $dlg_ended (i32.const 1))
            (global.set $dlg_result (i32.load (global.get $SHARED_DLG_RESULT)))
            (i32.store (global.get $SHARED_DLG_ENDED) (i32.const 0))))
        ;; Initial WM_INITDIALOG just returned. If the dialog proc accepted
        ;; default focus (TRUE), mirror USER's post-init focus step now,
        ;; after the app has populated controls. Edit controls receive
        ;; EM_SETSEL(0,-1), matching Win98's selected default edit text.
        (if (global.get $dlg_init_focus_hwnd)
          (then
            (call $dialog_apply_init_focus
              (global.get $dlg_pump_hwnd)
              (global.get $dlg_init_focus_hwnd)
              (i32.load offset=0 (global.get $reg_base)))
            (global.set $dlg_init_focus_hwnd (i32.const 0))))
        ;; First return from WM_INITDIALOG: USER shows the dialog now, unless
        ;; the init already ended it (then it is never seen at all).
        (if (i32.eq (global.get $dlg_show_pending) (global.get $dlg_pump_hwnd))
          (then
            (if (global.get $dlg_ended)
              (then (global.set $dlg_show_pending (i32.const 0)))
              (else (call $dlg_show_now (global.get $dlg_pump_hwnd))))))
        ;; If EndDialog was called, destroy dialog and return result
        (if (global.get $dlg_ended)
          (then
            ;; Teardown and owner notification can reenter USER. The retiring
            ;; call owns its result/return address, not the mutable pump globals.
            (local.set $ending_dlg (global.get $dlg_pump_hwnd))
            (local.set $arg0 (global.get $dlg_result))
            (local.set $arg1 (global.get $dlg_ret_addr))
            ;; Destroy WAT-managed child controls (sends WM_DESTROY to each)
            ;; but not the dialog itself — its x86 dlg_proc would interpret
            ;; WM_DESTROY as app shutdown and call PostQuitMessage.
            ;; Use the captured pump HWND: $dlg_hwnd may already have been
            ;; clobbered by modeless creation, and teardown may replace the
            ;; pump global as well.
            (local.set $arg4 (call $wnd_get_owner (local.get $ending_dlg)))
            (if (call $wnd_table_get (local.get $ending_dlg))
              (then
                (call $wnd_destroy_children (local.get $ending_dlg))
                (call $wnd_table_remove (local.get $ending_dlg))
                (call $host_destroy_window (local.get $ending_dlg))))
            ;; The dialog and its controls held the focus; hand it back to the
            ;; owner so an app that paused on WM_KILLFOCUS resumes.
            (call $focus_restore_after_modal (local.get $arg4))
            ;; An active dialog's destruction activates its owner. Dialogs are
            ;; activated when shown (82658957a), so without this the owner
            ;; stayed inactive: FreeCell, back from Select Game, drew a grey
            ;; caption and ignored the next double-click.
            (if (i32.or (i32.eqz (global.get $active_hwnd))
                  (i32.eq (global.get $active_hwnd) (local.get $ending_dlg)))
              (then
                (if (i32.eqz (local.get $arg4))
                  (then (local.set $arg4 (global.get $main_hwnd))))
                (if (i32.and (i32.ne (local.get $arg4) (i32.const 0))
                      (i32.ne (call $wnd_table_get (local.get $arg4)) (i32.const 0)))
                  (then (drop (call $activate_window_with_host (local.get $arg4)))))))
            ;; The consumed DialogBoxParamA frame remains at ESP. Preserve the
            ;; completed call's return/result while restoring the previous
            ;; modal pump saved in its five argument slots.
            (call $null_diag_event (i32.const 3) (local.get $arg1) (i32.load offset=16 (global.get $reg_base)))
            (global.set $dlg_pump_hwnd
              (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))
            (global.set $dlg_proc
              (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))
            (global.set $dlg_ret_addr
              (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))
            (global.set $dlg_callback_yield_pending
              (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))
            (global.set $dlg_init_focus_hwnd
              (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))
            (if (global.get $dlg_pump_hwnd)
              (then (global.set $dlg_hwnd (global.get $dlg_pump_hwnd))))
            (i32.store (global.get $SHARED_DLG_PUMP_HWND)
              (global.get $dlg_pump_hwnd))
            (i32.store offset=0 (global.get $reg_base) (local.get $arg0))
            (global.set $eip (local.get $arg1))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
            (call $null_diag_event (i32.const 4) (local.get $arg1) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
            (global.set $dlg_ended (i32.const 0))
            (global.set $dlg_result (i32.const 0))
            (global.set $quit_flag (i32.const 0))
            (return))))))
(func (export "get_eax") (result i32) (i32.load (i32.const 0)))
(func (export "get_ecx") (result i32) (i32.load (i32.const 4)))
(func (export "get_edx") (result i32) (i32.load (i32.const 8)))
(func (export "get_ebx") (result i32) (i32.load (i32.const 12)))
(func (export "get_esp") (result i32) (i32.load (i32.const 16)))
(func (export "get_ebp") (result i32) (i32.load (i32.const 20)))
(func (export "get_esi") (result i32) (i32.load (i32.const 24)))
(func (export "get_edi") (result i32) (i32.load (i32.const 28)))(func (export "get_eip") (result i32) (global.get $eip)) (func (export "guest_read8") (param $a i32) (result i32) (i32.load8_u (local.get $a))) (func (export "set_bp") (param i32)) (func (export "set_trace_eip_range") (param i32) (param i32) (param i32))
(func (export "set_eip") (param $v i32) (global.set $eip (local.get $v)))
(func (export "set_last_run_halt") (param $v i32) (global.set $last_run_halt (local.get $v)))
(func (export "set_dlg_pump_hwnd") (param $v i32) (global.set $dlg_pump_hwnd (local.get $v)))
(func (export "set_dlg_ret_addr") (param $v i32) (global.set $dlg_ret_addr (local.get $v)))
(func (export "set_dlg_ended") (param $v i32) (global.set $dlg_ended (local.get $v)))
(func (export "set_sync_msg_depth") (param $v i32) (global.set $sync_msg_depth (local.get $v)))
(func (export "set_code16") (param $v i32) (global.set $code16 (local.get $v)))
(func (export "set_host_shadow") (param $v i32) (global.set $host_shadow (local.get $v)))
(func (export "set_handler_set_eip") (param $v i32) (global.set $handler_set_eip (local.get $v)))
(func (export "set_steps") (param $v i32) (global.set $steps (local.get $v)))
(func (export "set_yield_reason") (param $v i32) (global.set $yield_reason (local.get $v)))
(func (export "set_yield_flag") (param $v i32) (global.set $yield_flag (local.get $v)))
(func (export "set_sleep_yielded") (param $v i32) (global.set $sleep_yielded (local.get $v)))
(func (export "set_wnd_send_completed") (param $v i32) (global.set $wnd_send_completed (local.get $v)))
(func (export "set_dlg_result") (param $v i32) (global.set $dlg_result (local.get $v)))
(func (export "set_dlg_proc") (param $v i32) (global.set $dlg_proc (local.get $v)))
(func (export "set_dlg_callback_yield_pending") (param $v i32) (global.set $dlg_callback_yield_pending (local.get $v)))
(func (export "set_dlg_init_focus_hwnd") (param $v i32) (global.set $dlg_init_focus_hwnd (local.get $v)))
(func (export "set_dlg_hwnd") (param $v i32) (global.set $dlg_hwnd (local.get $v)))
(func (export "set_dlg_show_pending") (param $v i32) (global.set $dlg_show_pending (local.get $v)))
(func (export "set_active_hwnd") (param $v i32) (global.set $active_hwnd (local.get $v)))
(func (export "set_main_hwnd") (param $v i32) (global.set $main_hwnd (local.get $v)))
(func (export "set_quit_flag") (param $v i32) (global.set $quit_flag (local.get $v)))
(func (export "set_review_run_mode") (param $v i32) (global.set $review_run_mode (local.get $v)))
(import "probe" "modal" (func $probe_modal (result i32)))
(import "probe" "parent" (func $probe_parent (param i32) (result i32)))
(import "probe" "slot" (func $probe_slot (param i32) (result i32)))
(export "modal_dialog_hwnd" (func $probe_modal))
(export "wnd_get_parent" (func $probe_parent))
(export "wnd_slot_hwnd" (func $probe_slot))
(func (export "dlg_get_style") (param i32) (result i32) (i32.const 1))
(export "send_message" (func $wnd_send_message_inner))
