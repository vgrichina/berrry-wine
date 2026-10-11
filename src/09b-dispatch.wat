  ;; ============================================================
  ;; WIN32 API DISPATCH — hand-written thunk handlers + arg loading
  ;; Calls $dispatch_api_table for the generated br_table portion.
  ;; ============================================================
  ;; Creation failure is not ordinary DestroyWindow. USER tears down any
  ;; descendants, sends WM_NCDESTROY (but not WM_DESTROY), unpublishes the
  ;; HWND, and returns NULL from CreateWindowEx. This is recursive because a
  ;; WM_CREATE handler may have made children before rejecting its own window.
  (func $create_window_abort (param $hwnd i32)
    (local $i i32) (local $ptr i32) (local $child i32)
    (if (i32.eqz (call $wnd_table_get (local.get $hwnd)))
      (then (return)))
    (block $children_done
      (loop $rescan
        (local.set $i (i32.const 0))
        (loop $scan
          (br_if $children_done
            (i32.ge_u (local.get $i) (global.get $MAX_WINDOWS)))
          (local.set $ptr (call $wnd_record_addr (local.get $i)))
          (local.set $child (i32.atomic.load (local.get $ptr)))
          (if (i32.and
                (i32.ne (local.get $child) (i32.const 0))
                (i32.eq (i32.load offset=8 (local.get $ptr))
                        (local.get $hwnd)))
            (then
              (call $create_window_abort (local.get $child))
              (br $rescan)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $scan))))
    (drop (call $wnd_send_message
      (local.get $hwnd) (i32.const 0x0082) (i32.const 0) (i32.const 0)))
    (call $timer_kill_hwnd (local.get $hwnd))
    (if (i32.eq (global.get $focus_hwnd) (local.get $hwnd))
      (then (global.set $focus_hwnd (i32.const 0))))
    (if (i32.eq (global.get $capture_hwnd) (local.get $hwnd))
      (then (global.set $capture_hwnd (i32.const 0))))
    (call $post_queue_purge_hwnd (local.get $hwnd))
    (if (i32.eq (global.get $pending_child_create) (local.get $hwnd))
      (then (global.set $pending_child_create (i32.const 0))))
    (if (i32.eq (global.get $pending_child_size_hwnd) (local.get $hwnd))
      (then
        (global.set $pending_child_size_hwnd (i32.const 0))
        (global.set $pending_child_size (i32.const 0))))
    (if (i32.eq (global.get $child_cbt_saved_hwnd) (local.get $hwnd))
      (then (global.set $child_cbt_saved_hwnd (i32.const 0))))
    (if (i32.eq (global.get $main_hwnd) (local.get $hwnd))
      (then
        (global.set $main_hwnd (i32.const 0))
        (global.set $pending_wm_size (i32.const 0))
        (global.set $createwnd_implicit_show (i32.const 0))))
    (call $host_destroy_window (local.get $hwnd))
    (call $wnd_table_remove (local.get $hwnd)))

  ;; Restore the x86 nonvolatile registers after a Win32 handler. The hot
  ;; message-pump fast paths and the generated dispatcher share this exact ABI
  ;; epilogue; keeping one helper prevents their preservation rules drifting.
  (func $restore_win32_nonvolatile
      (param $saved_ebx i32) (param $saved_esi i32)
      (param $saved_edi i32) (param $saved_ebp i32)
    (i32.store offset=12 (global.get $reg_base) (local.get $saved_ebx))
    (i32.store offset=24 (global.get $reg_base) (local.get $saved_esi))
    (i32.store offset=28 (global.get $reg_base) (local.get $saved_edi))
    (i32.store offset=20 (global.get $reg_base) (local.get $saved_ebp)))

  ;; The clock reads that do not count as Win32 work for the clock-spin
  ;; detector ($spin_nonpoll_seq). QueryPerformanceFrequency belongs here with
  ;; the three reads: it answers a constant and has no side effect, and a QPC
  ;; limiter re-asks it on every pass. Diablo II's d2win.dll menu loop is
  ;; PeekMessage(PM_NOREMOVE) / QPC / QPF / compare (docs/re-notes/
  ;; diablo2-demo.md) and was invisible to both detectors while the latter two
  ;; counted as work between every pair of reads.
  (func $spin_is_clock_read (param $api_id i32) (result i32)
    (i32.or
      (i32.or
        (i32.eq (local.get $api_id) (global.get $API_ID_GetTickCount))
        (i32.eq (local.get $api_id) (global.get $API_ID_timeGetTime)))
      (i32.or
        (i32.eq (local.get $api_id) (global.get $API_ID_QueryPerformanceCounter))
        (i32.eq (local.get $api_id) (global.get $API_ID_QueryPerformanceFrequency)))))

  ;; The per-call API log: the COM marker and name before the handler, and
  ;; log_api_exit after it. Three host calls per Win32 API -- 88M each of log
  ;; and log_api_exit in one Heroes III run -- that a host with no API
  ;; consumer (run.js --quiet-api and no API tracing) answers by doing nothing.
  ;; set_api_log(0) skips them; $api_calls keeps the count the host used to
  ;; take from them (get_api_calls). Per instance.
  (global $api_log_on (mut i32) (i32.const 1))
  (global $api_calls (mut i32) (i32.const 0))
  (func (export "set_api_log") (param $on i32)
    (global.set $api_log_on (i32.ne (local.get $on) (i32.const 0))))
  (func (export "get_api_calls") (result i32) (global.get $api_calls))

  ;; Depth of Win32 handler execution. $g2w_miss uses it to tell a guest
  ;; instruction's access from a handler translating a NULL pointer argument
  ;; it was handed (GetPrivateProfileStringA(NULL, ...)): only the former may
  ;; take --fault-null=page0's access violation. $run saves and clears it, so
  ;; guest code run from inside a handler (a COM callback's nested run()) is
  ;; guest code again.
  (global $api_handler_depth (mut i32) (i32.const 0))
  (func $win32_dispatch (param $thunk_idx i32)
    ;; Cached/direct calls must honor a hook installed since decoding.
    (if (call $thunk_patch_changed (local.get $thunk_idx)) (then
      (global.set $eip (i32.add (global.get $thunk_guest_base) (i32.shl (local.get $thunk_idx) (i32.const 3))))
      (global.set $handler_set_eip (i32.const 1))
      (global.set $steps (i32.const 0)) (return)))
    (global.set $api_handler_depth (i32.add (global.get $api_handler_depth) (i32.const 1)))
    (call $win32_dispatch_inner (local.get $thunk_idx))
    (global.set $api_handler_depth (i32.sub (global.get $api_handler_depth) (i32.const 1))))

  (func $win32_dispatch_inner (param $thunk_idx i32)
    (local $esp i32)
    (local $api_id i32) (local $name_rva i32) (local $name_ptr i32)
    (local $arg0 i32) (local $arg1 i32) (local $arg2 i32) (local $arg3 i32)
    (local $arg4 i32) (local $ending_dlg i32)
    (local $queued i32)
    (local $saved_ebx i32) (local $saved_esi i32)
    (local $saved_edi i32) (local $saved_ebp i32)

    ;; Most imported calls are dispatched directly by the decoded CALL/JMP
    ;; handler rather than by entering the thunk zone through $run. Keep the
    ;; concrete thunk address available to blocking handlers in both paths.
    ;; A parked handler must resume here, not at the caller's decoded block,
    ;; or that block repeats its PUSH/CALL and consumes another stack frame on
    ;; every cooperative retry.
    (global.set $current_thunk_eip
      (i32.add (global.get $thunk_guest_base)
        (i32.mul (local.get $thunk_idx) (i32.const 8))))

    ;; One tick per Win32 call, and this is the single funnel every one of them
    ;; goes through — the decoded CALL/JMP handlers dispatch inline but still
    ;; land here. The spin detectors in src/09a-handlers.wat use it to ask "did
    ;; anything else happen between these two reads", which is what separates a
    ;; frame loop that renders between clock reads from a loop that does
    ;; nothing but read the clock. A parked handler re-runs through here on
    ;; wake, so a park costs exactly one tick, same as any other call.
    (global.set $spin_dispatch_seq
      (i32.add (global.get $spin_dispatch_seq) (i32.const 1)))
    ;; Any call after an alertable sleep or wait parked means that wait is over
    ;; (09a7d, cross-thread user APCs); the Ex handlers set these again.
    (global.set $apc_alert_sleep (i32.const 0))
    (global.set $wait_alertable (i32.const 0))

    ;; Worker threads instantiate a fresh module over the process's shared
    ;; memory. Restore per-instance COM vtable globals before any imported API
    ;; can create or return a DirectX/OLE wrapper.
    (call $dx_sync_thread_vtables_if_needed)

    ;; An EnterCriticalSection that parked left its stdcall frame on the stack
    ;; for the re-entry to find. If the guest arrives at a DIFFERENT thunk while
    ;; that is still outstanding, the call was abandoned: those 8 bytes are now
    ;; stack garbage that the caller's own `ret` will eventually pop, and it will
    ;; "return" to the section pointer. Counted here, at the moment it happens,
    ;; because the crash it causes is thousands of instructions away and names
    ;; nothing.
    (if (global.get $cs_park_pending)
      (then
        (if (i32.ne (global.get $eip) (global.get $cs_park_eip))
          (then
            (global.set $cs_abandoned (i32.add (global.get $cs_abandoned) (i32.const 1)))
            (global.set $cs_abandoned_eip (global.get $eip))
            (global.set $cs_park_pending (i32.const 0))))))

    ;; Which thunk this is, in GUEST addresses — the address a parking handler
    ;; must send EIP to so the call is re-entered rather than re-executed.
    ;;
    ;; $run's thunk branch already set this, but most API calls never go through
    ;; it: the decoded `call` handlers in 05-alu.wat and 06b-core-handlers.wat
    ;; dispatch inline, mid-block, and there EIP still names the BLOCK's first
    ;; instruction. A handler that parks and leaves EIP alone therefore resumes
    ;; by re-running the block — pushing the call's arguments a second time. That
    ;; is an 8-byte stack drift per park for a one-argument API, and the caller's
    ;; own `ret` eventually pops an argument and jumps to it.
    (global.set $current_thunk_eip
      (i32.add (global.get $thunk_guest_base) (i32.mul (local.get $thunk_idx) (i32.const 8))))

    ;; --edge-hist: record (calling block -> thunk) so a window names the API
    ;; every call site reached, whatever form the call took (IAT slot, a
    ;; GetProcAddress-filled pointer, a COM vtable). No thunk is ever a block
    ;; entry, so $edge_hist_prev stays the caller and the return edge after
    ;; it is recorded as before. tools/call-form-weighted.js --apis reads it.
    (if (i32.and (i32.ne (global.get $handler_hist_enabled) (i32.const 0))
                 (i32.ne (global.get $edge_hist_enabled) (i32.const 0)))
      (then (call $edge_hist_record (global.get $edge_hist_prev) (global.get $current_thunk_eip))))

    ;; Read thunk data
    (local.set $name_rva (i32.load (call $thunk_metadata_addr (local.get $thunk_idx))))
    (local.set $api_id (i32.load offset=4 (call $thunk_metadata_addr (local.get $thunk_idx))))

    ;; The handler consumes this one-shot bit at entry. Its Win16 caller does
    ;; not pass through this dispatcher and therefore must not undo activity
    ;; belonging to an earlier Win32 call.
    (global.set $spin_peek_activity_marked
      (i32.or
        (i32.eq (local.get $api_id) (global.get $API_ID_PeekMessageA))
        (i32.eq (local.get $api_id) (global.get $API_ID_PeekMessageW))))

    ;; Clock limiters commonly put one or more empty nonblocking message polls
    ;; between reads. Preserve a second activity sequence that treats clock
    ;; reads as polling. PeekMessage starts as real activity too; only its
    ;; proven-empty return path rolls this one increment back.
    ;; Named IDs are generated from api_table.json alongside the dispatcher.
    (if (i32.eqz (call $spin_is_clock_read (local.get $api_id)))
      (then
        (global.set $spin_nonpoll_seq
          (i32.add (global.get $spin_nonpoll_seq) (i32.const 1)))))

    ;; ── Continuation thunks (CACA markers) ──────────────────────

    ;; DLGPROC returned: ESP points at this invocation's retained DefDlgProc
    ;; frame (return address + four arguments), including contracted
    ;; CallWindowProc frames. Callback BOOL is in EAX, not shared state.
    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA003C))
      (then
        (local.set $esp (i32.load offset=16 (global.get $reg_base)))
        (i32.store offset=0 (global.get $reg_base)
          (call $dialog_proc_result
            (i32.load (call $g2w (i32.add (local.get $esp) (i32.const 4))))
            (i32.load (call $g2w (i32.add (local.get $esp) (i32.const 8))))
            (i32.load (call $g2w (i32.add (local.get $esp) (i32.const 12))))
            (i32.load (call $g2w (i32.add (local.get $esp) (i32.const 16))))
            (i32.load offset=0 (global.get $reg_base))))
        (global.set $eip (i32.load (call $g2w (local.get $esp))))
        (i32.store offset=16 (global.get $reg_base)
          (i32.add (local.get $esp) (i32.const 20)))
        (global.set $handler_set_eip (i32.const 1))
        (return)))

    ;; Catch-return thunk — SEH catch handler returned
    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA0000))
      (then (global.set $eip (i32.load offset=0 (global.get $reg_base))) (return)))

    ;; Delphi SEH handler returned. EAX=1 means ExceptionContinueSearch, so
    ;; clean the handler's cdecl arguments and invoke the next registration.
    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA000E))
      (then
        ;; This dispatch's state, from its own frame: the handler's record and
        ;; frame arguments, and the node's saved head and resume point. A
        ;; nested raise inside the handler overwrote the globals; Unreal
        ;; Tournament's `throw;` from an unguard catch block left the outer
        ;; walk holding the rethrow's null-ThrowInfo record, so every outer
        ;; frame declined it and the int went unhandled.
        (global.set $delphi_exception_record (call $gl32 (i32.load offset=16 (global.get $reg_base))))
        (global.set $delphi_seh_rec
          (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))
        (global.set $delphi_seh_head_before
          (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))
        (global.set $delphi_resume_eip
          (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
        (global.set $delphi_resume_esp
          (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32))))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        ;; Then the dispatcher node $dispatch_delphi_exception_handler linked.
        (call $seh_pop_dispatch_node (i32.load offset=16 (global.get $reg_base)))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (if (i32.eq (i32.load offset=0 (global.get $reg_base)) (i32.const 1))
          (then
            (call $delphi_seh_continue_search)
            (call $dispatch_delphi_exception_handler)
            (return)))
        ;; ExceptionContinueExecution (0): the frame handler accepted the
        ;; exception for continued execution, so the raise is over and the
        ;; raising code runs on. MSVC's __except_handler3 maps a filter result
        ;; of EXCEPTION_CONTINUE_EXECUTION (-1) to this disposition; debuggers'
        ;; conventional thread-name exception is one real caller of that path.
        (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
          (then
            (global.set $eip (global.get $delphi_resume_eip))
            (i32.store offset=16 (global.get $reg_base) (global.get $delphi_resume_esp))
            (global.set $steps (i32.const 0))
            (return)))
        ;; Other dispositions should have resumed inside the Delphi runtime.
        ;; If one returns here, fail closed instead of jumping through stale stack.
        (call $seh_terminate_unhandled (i32.or (i32.const 0xDE00)
          (call $gl32 (global.get $delphi_exception_record))))
        (return)))

    ;; CreateWindowEx continuation — WndProc(WM_CREATE) returned
    ;; Ordinary stack layout: [ESP] = saved_ret, [ESP+4] = saved_hwnd.
    ;; A modeless WM_INITDIALOG return instead starts with the private DIFC
    ;; marker, candidate, then that same saved pair.
    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA0001))
      (then
        ;; CACA0029 puts a private marker in front of the ordinary saved frame
        ;; only while WM_CREATE is outstanding. This keeps the shared thunk's
        ;; ShowWindow/dialog uses from interpreting their LRESULT as a create
        ;; decision. On success discard the marker and retain the old layout.
        (if (i32.eq (call $gl32 (i32.load offset=16 (global.get $reg_base))) (i32.const 0x43524541)) ;; "CREA"
          (then
            (if (i32.eq (i32.load offset=0 (global.get $reg_base)) (i32.const -1))
              (then
                (local.set $arg0
                  (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))
                (call $create_window_abort (local.get $arg0))
                (global.set $eip
                  (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))
                (i32.store offset=0 (global.get $reg_base) (i32.const 0))
                (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
                (return)))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))))
        ;; CreateDialogParamA's DLGPROC just returned from WM_INITDIALOG.
        ;; Its nonzero return accepts the candidate passed in wParam. Keep the
        ;; marker/candidate on the guest stack so nested modeless dialogs each
        ;; retain their own decision state.
        (if (i32.eq (call $gl32 (i32.load offset=16 (global.get $reg_base))) (i32.const 0x44494643)) ;; "DIFC"
          (then
            (call $dialog_apply_init_focus
              (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
              (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
              (i32.load offset=0 (global.get $reg_base)))
            ;; Then USER shows a WS_VISIBLE dialog with SW_SHOWNORMAL, which
            ;; activates it. The window is already visible here, so only the
            ;; activation remains; without it a top-level dialog (Paint's
            ;; MFC Attributes box) never became foreground and kept an
            ;; inactive title bar once that stopped following z-order.
            (if (i32.ne (i32.and (call $wnd_get_style
                  (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))
                  (i32.const 0x10000000)) (i32.const 0))
              (then (call $show_window_activate_top_level
                (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
                (i32.const 1))))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))))
        ;; If WS_VISIBLE was set on main_hwnd's style, kick off the implicit-show
        ;; activation chain (matches real Win32 CreateWindowEx behavior). Leaves
        ;; saved_ret/saved_hwnd in place at [ESP]/[ESP+4]; the chain ends by
        ;; re-entering CACA0001 with this flag cleared, which then pops them.
        (if (global.get $createwnd_implicit_show)
          (then
            (global.set $createwnd_implicit_show (i32.const 0))
            (global.set $show_window_activated (i32.const 1))
            (global.set $active_hwnd (global.get $main_hwnd))
            ;; Publish the desktop activation too, exactly as the explicit
            ;; first ShowWindow does. The host's foreground is the accepted
            ;; activation, not the top of the z-order, so without this an app
            ;; created WS_VISIBLE has no foreground window at all: Dungeon
            ;; Keeper's WM_ACTIVATEAPP compares GetForegroundWindow() against
            ;; its own HWND, never marks itself active, and parks on a black
            ;; screen after the Bullfrog logo.
            (drop (call $host_activate_window (global.get $main_hwnd)))
            (local.set $arg0 (call $wnd_table_get (global.get $main_hwnd)))
            ;; A CreateDialogParamA top-level can retain USER's dialog marker
            ;; when no framework CBT hook subclasses it.  Run the same safe
            ;; synchronous DLGPROC path used by ShowWindow, then fall through
            ;; to the common saved-return restoration below.
            (if (i32.eq (local.get $arg0) (global.get $WNDPROC_DIALOG))
              (then
                (drop (call $dialog_default_proc
                  (global.get $main_hwnd) (i32.const 0x001C) (i32.const 1) (i32.const 0)))
                (drop (call $dialog_default_proc
                  (global.get $main_hwnd) (i32.const 0x0006) (i32.const 1)
                  (global.get $main_hwnd)))
                (global.set $focus_hwnd (global.get $main_hwnd))
                (drop (call $dialog_default_proc
                  (global.get $main_hwnd) (i32.const 0x0007) (i32.const 0) (i32.const 0)))
                (local.set $arg1 (call $paint_scratch_take))
                (call $host_get_window_rect (global.get $main_hwnd) (local.get $arg1))
                (drop (call $dialog_default_proc
                  (global.get $main_hwnd) (i32.const 0x0003) (i32.const 0)
                  (i32.or
                    (i32.and (load.field PaintRect left (local.get $arg1))
                      (i32.const 0xFFFF))
                    (i32.shl (load.field.memarg PaintRect top (local.get $arg1))
                      (i32.const 16)))))
                (local.set $arg1 (global.get $pending_wm_size))
                (if (local.get $arg1)
                  (then
                    (drop (call $dialog_default_proc
                      (global.get $main_hwnd) (i32.const 0x0005) (i32.const 0)
                      (local.get $arg1)))))
                (global.set $pending_wm_size (i32.const 0))
                (global.set $msg_phase (i32.const 5))
                (global.set $paint_pending (i32.const 1))
                (call $host_invalidate (global.get $main_hwnd)))
              (else
                ;; Push WndProc args: hwnd, WM_ACTIVATEAPP(0x001C), TRUE, 0
                (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
                (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0))                ;; lParam
                (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
                (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 1))                ;; wParam = TRUE
                (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
                (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0x001C))           ;; WM_ACTIVATEAPP
                (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
                (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $main_hwnd))      ;; hwnd
                ;; Push CACA0022 as WndProc return; chains through activation,
                ;; focus, move, size, then CACA0001.
                (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
                (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $createwnd_activate_thunk))
                (global.set $eip (local.get $arg0))
                (if (i32.eqz (global.get $eip))
                  (then (global.set $eip (global.get $wndproc_addr))))
                (global.set $steps (i32.const 0))
                (return)))))
        ;; Pop saved_ret and saved_hwnd from stack (supports nested CreateWindowExA).
        ;; Before returning, flush WAT-native children now exposed by WM_CREATE /
        ;; WM_INITDIALOG. NSIS creates/shows wizard pages from dialog init; Win98
        ;; repaints those children through USER's visible-region pass before the
        ;; dialog is observably idle.
        (local.set $arg0 (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))
        (if (i32.and
              (i32.ne (local.get $arg0) (i32.const 0))
              (i32.ne
                (i32.load offset=4 (call $dlg_record_for_hwnd (local.get $arg0)))
                (i32.const 0)))
          (then
            (drop (call $paint_drain_native_control_paints))
            (drop (call $paint_flush_shown_native_children (local.get $arg0)))))
        (global.set $eip (call $gl32 (i32.load offset=16 (global.get $reg_base))))
        (i32.store offset=0 (global.get $reg_base) (local.get $arg0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))

    ;; ── First-ShowWindow synchronous activation chain (main window only) ──
    ;; Triggered by $handle_ShowWindow on the first non-hide call for main_hwnd.
    ;; Each thunk: wndproc returned → push next message → call wndproc again.
    ;; Stack invariant: saved_ret and saved_hwnd sit at bottom throughout.
    ;; Chain: ShowWindow -> WM_ACTIVATE -> WM_SETFOCUS -> WM_MOVE -> WM_SIZE
    ;;      -> CACA0001 (done, pop saved_ret+hwnd)

    ;; CACA0022: WM_ACTIVATEAPP returned → send WM_ACTIVATE synchronously
    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA0022))
      (then
        ;; Push WndProc args: hwnd, WM_ACTIVATE(0x0006), WA_ACTIVE(1), hwnd
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $main_hwnd))        ;; lParam = hwnd
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 1))                  ;; wParam = WA_ACTIVE
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0x0006))             ;; WM_ACTIVATE
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $main_hwnd))        ;; hwnd
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $createwnd_setfocus_thunk))
        (global.set $eip (call $wnd_table_get (global.get $main_hwnd)))
        (if (i32.eqz (global.get $eip))
          (then (global.set $eip (global.get $wndproc_addr))))
        (global.set $steps (i32.const 0))
        (return)))

    ;; CACA0023: WM_ACTIVATE returned → send WM_SETFOCUS synchronously
    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA0023))
      (then
        ;; GetFocus already names the receiving window inside WM_SETFOCUS.
        (global.set $focus_hwnd (global.get $main_hwnd))
        ;; Push WndProc args: hwnd, WM_SETFOCUS(0x0007), 0, 0
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0))                  ;; lParam = 0
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0))                  ;; wParam = hwndLoseFocus
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0x0007))             ;; WM_SETFOCUS
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $main_hwnd))        ;; hwnd
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $createwnd_move_thunk))
        (global.set $eip (call $wnd_table_get (global.get $main_hwnd)))
        (if (i32.eqz (global.get $eip))
          (then (global.set $eip (global.get $wndproc_addr))))
        (global.set $msg_phase (i32.const 5))  ;; skip all activation phases
        ;; Phase 2: seed paint_pending + update rgn so first WM_PAINT arrives
        ;; once the WM_SETFOCUS handler returns (replaces legacy msg_phase==6
        ;; block). host_invalidate seeds the rgn map for region-driven pump.
        (global.set $paint_pending (i32.const 1))
        (call $host_invalidate (global.get $main_hwnd))
        (global.set $steps (i32.const 0))
        (return)))

    ;; CACA0024: WM_SETFOCUS returned -> send WM_MOVE synchronously.
    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA0024))
      (then
        (local.set $arg0 (call $paint_scratch_take))
        (call $host_get_window_rect (global.get $main_hwnd) (local.get $arg0))
        ;; Push WndProc args: hwnd, WM_MOVE, 0, lParam=x|(y<<16).
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base))
          (i32.or
            (i32.and (load.field PaintRect left (local.get $arg0))
              (i32.const 0xFFFF))
            (i32.shl (load.field.memarg PaintRect top (local.get $arg0))
              (i32.const 16))))
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0x0003))
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $main_hwnd))
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $createwnd_size_thunk))
        (global.set $eip (call $wnd_table_get (global.get $main_hwnd)))
        (if (i32.eqz (global.get $eip))
          (then (global.set $eip (global.get $wndproc_addr))))
        (global.set $steps (i32.const 0))
        (return)))

    ;; CACA0031: WM_MOVE returned -> send WM_SIZE synchronously. ShowWindow's
    ;; SetWindowPos sequence must finish before posted commands can run.
    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA0031))
      (then
        ;; Restored startup uses the create-time pending size. Some Win98 apps
        ;; make fragile first-show decisions from that exact value. Maximized
        ;; startup must instead use the host-resized client size.
        (if (call $wnd_max_get (global.get $main_hwnd))
          (then (local.set $arg0 (call $host_get_window_client_size (global.get $main_hwnd))))
          (else (local.set $arg0 (global.get $pending_wm_size))))
        ;; Push WndProc args: hwnd, WM_SIZE(0x0005), SIZE_*, lParam=client size.
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $arg0))              ;; lParam = cx|(cy<<16)
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base))
          (select (i32.const 2) (i32.const 0)
                  (call $wnd_max_get (global.get $main_hwnd))))       ;; wParam = SIZE_MAXIMIZED/RESTORED
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0x0005))             ;; WM_SIZE
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $main_hwnd))        ;; hwnd
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $createwnd_ret_thunk))
	        ;; Consume pending_wm_size so GetMessageA drain path doesn't replay it.
	        (global.set $pending_wm_size (i32.const 0))
	        ;; Match what the GetMessageA-drain path does: set WM_NCCALCSIZE pending.
	        (call $nc_flags_set (global.get $main_hwnd) (i32.const 4))
	        (call $invalidate_hwnd (global.get $main_hwnd))
	        (global.set $eip (call $wnd_table_get (global.get $main_hwnd)))
        (if (i32.eqz (global.get $eip))
          (then (global.set $eip (global.get $wndproc_addr))))
        (global.set $steps (i32.const 0))
        (return)))

    ;; CACA0026: Child CBT hook returned — now dispatch WM_NCCREATE synchronously
    ;; via the subclassed wndproc (MFC installed AfxWndProc via SetWindowLongA
    ;; during the CBT hook). Synchronous dispatch matters because
    ;; CREATESTRUCT.lpCreateParams is typically a CCreateContext* on the
    ;; caller's stack — deferring WM_CREATE to the message loop would leave
    ;; lpCreateParams pointing at unwound stack memory, breaking SDI doc/view
    ;; attach. CACA0027 pops saved state and returns the hwnd to the caller.
    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA0026))
      (then
        ;; Pop the typed outer-active-node frame saved below HookProc. The
        ;; marker keeps direct continuation tests and old saved frames valid.
        (if (i32.eq (call $gl32 (i32.load offset=16 (global.get $reg_base))) (i32.const 0x31544243))
          (then
            (call $hook_dispatch_leave
              (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))))
        ;; Clear pending_child_create — the full create chain is now synchronous.
        ;; (pending_child_size is kept; it flows through the message loop.)
        (global.set $pending_child_create (i32.const 0))
        ;; A CBT hook is allowed to observe a system control without subclassing
        ;; it. Its WAT-native marker is not guest code: WM_CREATE was already
        ;; delivered by CreateWindowEx, so return the HWND exactly like the
        ;; ordinary native-control path and leave its queued WM_SIZE intact.
        (if (i32.eq
              (call $wnd_table_get (global.get $child_cbt_saved_hwnd))
              (global.get $WNDPROC_CTRL_NATIVE))
          (then
            (i32.store offset=0 (global.get $reg_base) (global.get $child_cbt_saved_hwnd))
            (global.set $eip (global.get $child_cbt_saved_ret))
            (global.set $steps (i32.const 0))
            (return)))
        ;; Push saved_size + saved_hwnd + saved_ret on stack for CACA0027.
        ;; The child CreateWindowEx path used to keep WM_SIZE in a single
        ;; global pending slot; burst-created custom children would overwrite
        ;; each other before the message pump ran. Keep the size with this
        ;; synchronous create frame so every child gets its own initial size.
        (local.set $arg0 (i32.const 0))
        (if (i32.eq (global.get $pending_child_size_hwnd) (global.get $child_cbt_saved_hwnd))
          (then
            (local.set $arg0 (global.get $pending_child_size))
            (global.set $pending_child_size (i32.const 0))
            (global.set $pending_child_size_hwnd (i32.const 0))))
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $arg0))
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $child_cbt_saved_hwnd))
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $child_cbt_saved_ret))
        ;; Push WndProc args: hwnd, WM_NCCREATE, 0, &CREATESTRUCT
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.add (global.get $image_base) (i32.const 0x100)))
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0x0081))
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $child_cbt_saved_hwnd))
        ;; Push CACA002E, which sends WM_CREATE then reaches CACA0027.
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $child_create_nccreate_ret_thunk))
        ;; Jump to the child's (possibly-subclassed) wndproc
        (global.set $eip (call $wnd_table_get (global.get $child_cbt_saved_hwnd)))
        (if (i32.eqz (global.get $eip))
          (then (global.set $eip (global.get $wndproc_addr))))
        (global.set $steps (i32.const 0))
        (return)))

    ;; CACA002E: child WM_NCCREATE returned. The stack still contains
    ;; saved_ret, saved_hwnd, saved_size; dispatch WM_CREATE and let CACA0027
    ;; deliver the paired WM_SIZE before returning the HWND to CreateWindowEx.
    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA002E))
      (then
        (local.set $arg0 (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))
        (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
          (then
            (call $create_window_abort (local.get $arg0))
            (global.set $eip (call $gl32 (i32.load offset=16 (global.get $reg_base))))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
            (return)))
        ;; Distinguish the following WM_CREATE result from the WM_SIZE result
        ;; that re-enters CACA0027 with the same ordinary saved frame.
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0x43524541)) ;; "CREA"
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.add (global.get $image_base) (i32.const 0x100)))
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0x0001))
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $arg0))
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $child_create_ret_thunk))
        (global.set $eip (call $wnd_table_get (local.get $arg0)))
        (if (i32.eqz (global.get $eip))
          (then (global.set $eip (global.get $wndproc_addr))))
        (global.set $steps (i32.const 0))
        (return)))

    ;; CACA0027: child WM_CREATE returned → optionally deliver the paired
    ;; initial WM_SIZE, then pop saved state and hand hwnd back.
    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA0027))
      (then
        (if (i32.eq (call $gl32 (i32.load offset=16 (global.get $reg_base))) (i32.const 0x43524541))
          (then
            (if (i32.eq (i32.load offset=0 (global.get $reg_base)) (i32.const -1))
              (then
                (local.set $arg0
                  (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))
                (call $create_window_abort (local.get $arg0))
                (global.set $eip
                  (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))
                (i32.store offset=0 (global.get $reg_base) (i32.const 0))
                (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
                (return)))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))))
        (local.set $arg0 (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))
        (local.set $arg1 (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))
        (if (local.get $arg1)
          (then
            ;; Mark the saved size consumed, then call the child wndproc with
            ;; WM_SIZE. When it returns to CACA0027 again, the zero size marker
            ;; falls through to the final return path below.
            (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)) (i32.const 0))
            (if (call $wnd_is_effectively_visible (local.get $arg0))
              (then (call $nc_flags_set (local.get $arg0) (i32.const 4)))
              (else (call $defwndproc_do_nccalcsize (local.get $arg0))))
            (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
            (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $arg1))
            (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
            (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0))
            (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
            (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0x0005))
            (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
            (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $arg0))
            (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
            (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $child_create_ret_thunk))
            (global.set $eip (call $wnd_table_get (local.get $arg0)))
            (if (i32.eqz (global.get $eip))
              (then (global.set $eip (global.get $wndproc_addr))))
            (global.set $steps (i32.const 0))
            (return)))
        ;; MDI child identity and activation are USER state, not contingent on
        ;; whether the application happened to chain WM_CREATE through
        ;; DefMDIChildProc. Register every successfully created immediate child
        ;; of an MDICLIENT before its CreateWindowEx/WM_MDICREATE call returns.
        (if (i32.eq
              (call $ctrl_table_get_class (call $wnd_get_parent (local.get $arg0)))
              (i32.const 33))
          (then (drop (call $mdi_client_register_child (local.get $arg0)))))
        (global.set $eip (call $gl32 (i32.load offset=16 (global.get $reg_base))))
        (i32.store offset=0 (global.get $reg_base) (local.get $arg0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))

    ;; CACA0029: WM_NCCREATE returned — dispatch WM_CREATE with the same
    ;; CREATESTRUCT while CreateWindowExA's caller stack is still live.
    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA0029))
      (then
        (local.set $arg0 (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))
        (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
          (then
            (call $create_window_abort (local.get $arg0))
            (global.set $eip (call $gl32 (i32.load offset=16 (global.get $reg_base))))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
            (return)))
        ;; This marker survives the stdcall WndProc frame and tells the shared
        ;; CACA0001 return thunk that its EAX is specifically WM_CREATE's.
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0x43524541)) ;; "CREA"
        ;; Push WndProc args: hwnd, WM_CREATE, 0, &CREATESTRUCT.
        ;; saved_ret + saved_hwnd remain below these args for CACA0001.
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.add (global.get $image_base) (i32.const 0x100)))
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0x0001))
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $arg0))
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $createwnd_ret_thunk))
        (global.set $eip (call $wnd_table_get (local.get $arg0)))
        (if (i32.eqz (global.get $eip))
          (then (global.set $eip (global.get $wndproc_addr))))
        (global.set $steps (i32.const 0))
        (return)))

    ;; CACA0028: dialog CBT hook returned → dispatch WM_INITDIALOG or
    ;; return the modeless dialog HWND. This mirrors CreateDialogParamA's
    ;; direct path, but lets MFC's WH_CBT hook attach m_hWnd first.
    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA0028))
      (then
        ;; "CBTM": the modal DialogBoxParam path. $handle_DialogBoxParamA has
        ;; already built the WM_INITDIALOG frame underneath these three private
        ;; words, so there is nothing to push -- leave the hook, drop the
        ;; marker, the outer hook node and the saved DLGPROC, and enter it.
        (if (i32.eq (call $gl32 (i32.load offset=16 (global.get $reg_base))) (i32.const 0x4D544243))
          (then
            (call $hook_dispatch_leave
              (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))
            (local.set $arg0 (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
            (global.set $eip (local.get $arg0))
            (global.set $steps (i32.const 0))
            (return)))
        (if (i32.eq (call $gl32 (i32.load offset=16 (global.get $reg_base))) (i32.const 0x31544243))
          (then
            (call $hook_dispatch_leave
              (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
            ;; USER creates a dialog through CreateWindowEx, so the dialog
            ;; window's own WNDPROC sees WM_CREATE before WM_INITDIALOG. Once
            ;; the hook has subclassed it to a guest procedure (MFC's
            ;; AfxWndProc), deliver that WM_CREATE with the CREATESTRUCT the
            ;; CBT path built at image_base+0x100. MFC's CFormView registers
            ;; itself with its document in WM_CREATE (CView::OnCreate ->
            ;; AddView); without it Monster Truck Madness 2's document had no
            ;; views and its first GetNextView walk called IsKindOf(NULL).
            ;; The procedure returns here with "DCRT" on the stack.
            (local.set $arg1 (call $wnd_table_get (global.get $dialog_cbt_saved_hwnd)))
            (if (i32.and
                  (i32.ne (local.get $arg1) (i32.const 0))
                  (i32.and
                    (i32.ne (local.get $arg1) (global.get $WNDPROC_DIALOG))
                    (i32.lt_u (local.get $arg1) (i32.const 0xFFFF0000))))
              (then
                ;; A dialog created inside WM_CREATE reuses the saved_*
                ;; globals, so keep this dialog's copies under the marker.
                (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
                (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $dialog_cbt_saved_hwnd))
                (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)) (global.get $dialog_cbt_saved_ret))
                (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)) (global.get $dialog_cbt_saved_proc))
                (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)) (global.get $dialog_cbt_saved_lparam))
                (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
                (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0x54524344)) ;; "DCRT"
                (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
                (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.add (global.get $image_base) (i32.const 0x100)))
                (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
                (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0))
                (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
                (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0x0001)) ;; WM_CREATE
                (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
                (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $dialog_cbt_saved_hwnd))
                (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
                (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $dialog_cbt_ret_thunk))
                (global.set $eip (local.get $arg1))
                (global.set $steps (i32.const 0))
                (return)))))
        ;; The dialog's WM_CREATE returned (its result is not a creation veto
        ;; for a dialog we already built); continue with WM_INITDIALOG.
        (if (i32.eq (call $gl32 (i32.load offset=16 (global.get $reg_base))) (i32.const 0x54524344))
          (then
            (global.set $dialog_cbt_saved_hwnd (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))
            (global.set $dialog_cbt_saved_ret (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))
            (global.set $dialog_cbt_saved_proc (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))
            (global.set $dialog_cbt_saved_lparam (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))))
        (if (global.get $dialog_cbt_saved_proc)
          (then
            (local.set $arg0 (call $dialog_first_init_tabstop
              (global.get $dialog_cbt_saved_hwnd)))
            ;; Push saved_hwnd + saved_ret below DlgProc args; CACA0001
            ;; returns saved_hwnd in EAX after WM_INITDIALOG.
            (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
            (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $dialog_cbt_saved_hwnd))
            (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
            (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $dialog_cbt_saved_ret))
            (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
            (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $arg0))
            (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
            (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0x44494643)) ;; "DIFC"
            (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
            (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $dialog_cbt_saved_lparam))
            (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
            (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $arg0))
            (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
            (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0x110))
            (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
            (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $dialog_cbt_saved_hwnd))
            (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
            (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $createwnd_ret_thunk))
            (global.set $eip (global.get $dialog_cbt_saved_proc))
            (global.set $steps (i32.const 0))
            (return)))
        (global.set $eip (global.get $dialog_cbt_saved_ret))
        (i32.store offset=0 (global.get $reg_base) (global.get $dialog_cbt_saved_hwnd))
        (return)))

    ;; CBT hook continuation — hook returned, now dispatch WM_NCCREATE. The
    ;; CACA0029 continuation follows with WM_CREATE using the same CREATESTRUCT.
    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA0002))
      (then
        (if (i32.eq (call $gl32 (i32.load offset=16 (global.get $reg_base))) (i32.const 0x31544243))
          (then
            (call $hook_dispatch_leave
              (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))))
        ;; Push saved_hwnd and saved_ret below WndProc args (for CACA0001 to pop)
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $createwnd_saved_hwnd))
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $createwnd_saved_ret))
        ;; Push WndProc args: hwnd, WM_NCCREATE, 0, &CREATESTRUCT
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.add (global.get $image_base) (i32.const 0x100)))
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0x0081))
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $createwnd_saved_hwnd))
        ;; CACA0029 dispatches WM_CREATE, whose return then reaches CACA0001.
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $createwnd_nccreate_ret_thunk))
        ;; Get WndProc from window table (may have been updated by CBT hook)
        (global.set $eip (call $wnd_table_get (global.get $createwnd_saved_hwnd)))
        (if (i32.eqz (global.get $eip))
          (then (global.set $eip (global.get $wndproc_addr))))
        (global.set $steps (i32.const 0))
        (return)))

    ;; A synchronous WM_SETFOCUS callback returned. The callback's stdcall
    ;; epilogue leaves ESP at the saved API return frame built by SetFocus or
    ;; DestroyWindow's focused-descendant transfer path.
    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA002A))
      (then
        (global.set $eip (call $gl32 (i32.load offset=16 (global.get $reg_base))))
        (i32.store offset=0 (global.get $reg_base) (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))
        (i32.store offset=12 (global.get $reg_base) (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))
        (i32.store offset=24 (global.get $reg_base) (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))
        (i32.store offset=28 (global.get $reg_base) (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))
        (i32.store offset=20 (global.get $reg_base) (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
        (return)))

    ;; DialogBoxParamA continuation — dialog proc returned, pump next message or finish
    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA0004))
      (then
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
            (global.set $dlg_ended (i32.const 0))
            (global.set $dlg_result (i32.const 0))
            (global.set $quit_flag (i32.const 0))
            (return)))
        ;; A guest DlgProc/WndProc has just returned to the modal loop.
        ;; Yield once before draining the next modal-loop unit so host
        ;; canvas/input/timer code gets the same observable boundary Win98
        ;; USER provides between dispatched messages.
        (if (global.get $dlg_callback_yield_pending)
          (then
            (global.set $dlg_callback_yield_pending (i32.const 0))
            (global.set $yield_flag (i32.const 1))
            (global.set $eip (global.get $dlg_loop_thunk))
            (global.set $steps (i32.const 0))
            (return)))
        ;; Drain nc_flags for the dialog hwnd only — children don't have
        ;; NC chrome. Without this filter, typing into an edit control
        ;; (which calls InvalidateRect → host_invalidate → nc_post_paint
        ;; on the edit hwnd) would cause us to draw a 3D edge + title bar
        ;; for the edit's rect, leaving a spurious chrome fragment on the
        ;; dialog back-canvas.
        (if (global.get $nc_flags_count)
          (then
            (local.set $arg1 (call $nc_flags_test (global.get $dlg_pump_hwnd)))
            ;; WM_NCPAINT (bit 0)
            (if (i32.and (local.get $arg1) (i32.const 1))
              (then
                (call $nc_flags_clear (global.get $dlg_pump_hwnd) (i32.const 1))
                (call $defwndproc_do_ncpaint (global.get $dlg_pump_hwnd))
                (global.set $eip (global.get $dlg_loop_thunk))
                (global.set $steps (i32.const 0))
                (return)))
            ;; WM_ERASEBKGND (bit 1) — default: COLOR_BTNFACE for dialogs
            (if (i32.and (local.get $arg1) (i32.const 2))
              (then
                (call $nc_flags_clear (global.get $dlg_pump_hwnd) (i32.const 2))
                (drop (call $host_erase_background (global.get $dlg_pump_hwnd) (i32.const 16)))
                (global.set $eip (global.get $dlg_loop_thunk))
                (global.set $steps (i32.const 0))
                (return)))))
        ;; Drain paint queue — deliver WM_PAINT to pending hwnds.
        ;; Without this, controls added by $dlg_load (and children of
        ;; nested CreateDialogParamA calls inside WM_INITDIALOG) never
        ;; render while the dialog is modal — the outer frame draws via
        ;; synchronous NC paint but the client area stays blank.
        (if (call $paint_flag_any)
          (then
            (local.set $arg0 (call $paint_flag_take))  ;; hwnd
            (local.set $arg1 (i32.const 0x000F))       ;; WM_PAINT
            (local.set $arg2 (i32.const 0))            ;; wParam
            (local.set $arg3 (i32.const 0))            ;; lParam
            (local.set $arg4 (call $wnd_table_get (local.get $arg0)))
            ;; A WAT-native control paints itself, whether or not the app has
            ;; subclassed it. Routing WM_PAINT at its current wndproc sends it
            ;; to the subclass, which chains back through CallWindowProc -- and
            ;; that deliberately drops WM_PAINT, so the control never draws.
            ;; sndvol32 subclasses the volume-controls list exactly this way.
            ;; The modeless drain ($paint_drain_native_control_paints) already
            ;; dispatches natively for the same reason.
            (if (i32.and
                  (i32.ne (local.get $arg0) (global.get $dlg_pump_hwnd))
                  (i32.ne (call $ctrl_table_get_class (local.get $arg0)) (i32.const 0)))
              (then
                (drop (call $control_wndproc_dispatch
                  (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)))
                (global.set $eip (global.get $dlg_loop_thunk))
                (global.set $steps (i32.const 0))
                (return)))
            (if (i32.ge_u (local.get $arg4) (i32.const 0xFFFF0000))
              (then
                (drop (call $wat_wndproc_dispatch
                  (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)))
                (global.set $eip (global.get $dlg_loop_thunk))
                (global.set $steps (i32.const 0))
                (return)))
            (if (i32.eqz (local.get $arg4))
              (then (local.set $arg4 (global.get $dlg_proc))))
            ;; Some NSIS common controls leave a low non-code value in the
            ;; wndproc slot while still getting marked dirty. Treat those as
            ;; default-handled instead of jumping into address 0x00xx.
            (if (i32.lt_u (local.get $arg4) (global.get $image_base))
              (then
                (global.set $eip (global.get $dlg_loop_thunk))
                (global.set $steps (i32.const 0))
                (return)))
            (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
            (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $dlg_loop_thunk))
            (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)) (local.get $arg0))
            (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)) (local.get $arg1))
            (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)) (local.get $arg2))
            (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)) (local.get $arg3))
            (global.set $dlg_callback_yield_pending (i32.const 1))
            (global.set $eip (local.get $arg4))
            (global.set $steps (i32.const 0))
            (return)))
        ;; Check the raw test prefix first, then the canonical shared USER
        ;; queue. Normal same-thread and cross-thread posts both use the latter.
        (local.set $queued (i32.const 0))
        (if (i32.gt_u (global.get $post_queue_count) (i32.const 0))
          (then
            (local.set $arg0 (i32.load (call $post_queue_base)))        ;; hwnd
            (local.set $arg1 (i32.load offset=4 (call $post_queue_base))) ;; msg
            (local.set $arg2 (i32.load offset=8 (call $post_queue_base))) ;; wParam
            (local.set $arg3 (i32.load offset=12 (call $post_queue_base))) ;; lParam
            ;; Remove the inline head and promote the oldest heap overflow node,
            ;; if a burst grew the queue past its allocation-free prefix.
            (drop (call $post_queue_remove_at (i32.const 0)))
            (local.set $queued (i32.const 1)))
          (else
            (if (call $shared_post_queue_read (i32.const 0) (i32.const 1))
              (then
                (local.set $arg0 (global.get $user_queue_probe_hwnd))
                (local.set $arg1 (global.get $user_queue_probe_msg))
                (local.set $arg2 (global.get $user_queue_probe_wparam))
                (local.set $arg3 (global.get $user_queue_probe_lparam))
                (local.set $queued (i32.const 1))))))
        (if (local.get $queued)
          (then
            ;; Dispatch by hwnd wndproc — WAT-native controls handle directly
            (local.set $arg4 (call $wnd_table_get (local.get $arg0)))
            ;; WNDPROC_DIALOG is a USER marker, not a WAT callback. Enter its
            ;; retained DLGPROC on this continuation stack so a posted command
            ;; may open another modal dialog without nesting $wnd_send_message.
            (if (i32.eq (local.get $arg4) (global.get $WNDPROC_DIALOG))
              (then
                (local.set $arg4 (call $dialog_proc_get (local.get $arg0))))
              (else
                (if (i32.ge_u (local.get $arg4) (i32.const 0xFFFF0000))
                  (then
                    (drop (call $wat_wndproc_dispatch
                      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)))
                    ;; Re-enter dialog loop
                    (global.set $eip (global.get $dlg_loop_thunk))
                    (global.set $steps (i32.const 0))
                    (return)))))
            ;; x86 wndproc or dialog proc — call via guest stack
            (if (i32.eqz (local.get $arg4))
              (then (local.set $arg4 (global.get $dlg_proc))))
            (if (i32.lt_u (local.get $arg4) (global.get $image_base))
              (then (local.set $arg4 (global.get $dlg_proc))))
            (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
            (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $dlg_loop_thunk))
            (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)) (local.get $arg0))
            (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)) (local.get $arg1))
            (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)) (local.get $arg2))
            (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)) (local.get $arg3))
            (global.set $dlg_callback_yield_pending (i32.const 1))
            (global.set $eip (local.get $arg4))
            (global.set $steps (i32.const 0))
            (return)))
        ;; Poll host for input
        (local.set $arg0 (call $host_check_input))
        (if (local.get $arg0)
          (then
            ;; Unpack: msg = low 16 bits, wParam = high 16 bits
            (local.set $arg1 (i32.and (local.get $arg0) (i32.const 0xFFFF)))      ;; msg
            (local.set $arg2 (i32.shr_u (local.get $arg0) (i32.const 16)))        ;; wParam
            (local.set $arg3 (call $host_check_input_lparam))                      ;; lParam
            (local.set $arg0 (call $host_check_input_hwnd (global.get $focus_hwnd))) ;; hwnd
            (if (local.get $arg0)
              (then
                ;; Host specified a target hwnd — dispatch by its wndproc
                (local.set $arg4 (call $wnd_table_get (local.get $arg0)))
                ;; Dialog markers retain guest code, just as on the posted
                ;; path above. Long input callbacks must keep their stack
                ;; across scheduler slices rather than nesting a sync send.
                (if (i32.eq (local.get $arg4) (global.get $WNDPROC_DIALOG))
                  (then
                    (local.set $arg4 (call $dialog_proc_get (local.get $arg0))))
                  (else
                    (if (i32.ge_u (local.get $arg4) (i32.const 0xFFFF0000))
                      (then
                        (drop (call $wat_wndproc_dispatch
                          (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)))
                        (global.set $eip (global.get $dlg_loop_thunk))
                        (global.set $steps (i32.const 0))
                        (return)))))
                (if (i32.eqz (local.get $arg4))
                  (then (local.set $arg4 (global.get $dlg_proc))))
                (if (i32.lt_u (local.get $arg4) (global.get $image_base))
                  (then (local.set $arg4 (global.get $dlg_proc)))))
              (else
                ;; No target hwnd — dispatch to the modal dialog proc.
                ;; Use $dlg_pump_hwnd (set only by DialogBoxParamA) so nested
                ;; modeless CreateDialogParamA inside the modal's dlgproc
                ;; can't reroute input to the inner sub-dialog.
                (local.set $arg0 (global.get $dlg_pump_hwnd))
                (local.set $arg4 (global.get $dlg_proc))))
            (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
            (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $dlg_loop_thunk))
            (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)) (local.get $arg0))
            (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)) (local.get $arg1))
            (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)) (local.get $arg2))
            (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)) (local.get $arg3))
            (global.set $dlg_callback_yield_pending (i32.const 1))
            (global.set $eip (local.get $arg4))
            (global.set $steps (i32.const 0))
            (return)))
        ;; WM_TIMER is a synthesized low-priority message: USER only creates
        ;; it after paint, posted, and hardware-input work is exhausted.  This
        ;; modal pump used to stop after those three sources, so a timer armed
        ;; by a dialog procedure remained live forever.  mIRC 5.9 finishes
        ;; scanning its installer payload, arms a 25ms hwnd timer, and then
        ;; waits at "Scanning files... 0%" for exactly this missing dispatch.
        (local.set $arg4 (call $w2g (call $paint_scratch_take)))
        (if (call $timer_check_due (local.get $arg4) (i32.const 1))
          (then
            (local.set $arg0 (call $gl32 (local.get $arg4)))
            (local.set $arg1 (call $gl32 (i32.add (local.get $arg4) (i32.const 4))))
            (local.set $arg2 (call $gl32 (i32.add (local.get $arg4) (i32.const 8))))
            (local.set $arg3 (call $gl32 (i32.add (local.get $arg4) (i32.const 12))))
            ;; A multimedia timer carries dwUser in MSG.hwnd and calls a
            ;; five-argument TimeProc rather than a window procedure.
            (if (i32.eq (local.get $arg1) (i32.const 0x7FF0))
              (then
                (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
                (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $dlg_loop_thunk))
                (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)) (local.get $arg2))
                (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)) (i32.const 0))
                (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)) (local.get $arg0))
                (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)) (i32.const 0))
                (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)) (i32.const 0))
                (global.set $dlg_callback_yield_pending (i32.const 1))
                (global.set $eip (local.get $arg3))
                (global.set $steps (i32.const 0))
                (return)))
            ;; SetTimer may nominate a TimerProc in lParam.  Its four stdcall
            ;; arguments are hwnd, WM_TIMER, id, and the tick count.
            (if (local.get $arg3)
              (then
                (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
                (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $dlg_loop_thunk))
                (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)) (local.get $arg0))
                (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)) (local.get $arg1))
                (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)) (local.get $arg2))
                (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)) (global.get $tick_count))
                (global.set $dlg_callback_yield_pending (i32.const 1))
                (global.set $eip (local.get $arg3))
                (global.set $steps (i32.const 0))
                (return)))
            ;; Ordinary hwnd timer: dispatch by the target's current wndproc,
            ;; matching the posted-message path immediately above.
            (local.set $arg4 (call $wnd_table_get (local.get $arg0)))
            (if (i32.ge_u (local.get $arg4) (i32.const 0xFFFF0000))
              (then
                (drop (call $wat_wndproc_dispatch
                  (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)))
                (global.set $eip (global.get $dlg_loop_thunk))
                (global.set $steps (i32.const 0))
                (return)))
            (if (i32.eqz (local.get $arg4))
              (then (local.set $arg4 (global.get $dlg_proc))))
            (if (i32.lt_u (local.get $arg4) (global.get $image_base))
              (then (local.set $arg4 (global.get $dlg_proc))))
            (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
            (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $dlg_loop_thunk))
            (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)) (local.get $arg0))
            (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)) (local.get $arg1))
            (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)) (local.get $arg2))
            (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)) (local.get $arg3))
            (global.set $dlg_callback_yield_pending (i32.const 1))
            (global.set $eip (local.get $arg4))
            (global.set $steps (i32.const 0))
            (return)))
        ;; No work: queue park, not an immediately rescheduled reason-0 yield.
        (global.set $yield_flag (i32.const 1))
        (global.set $yield_reason (i32.const 15))
        (global.set $eip (global.get $dlg_loop_thunk))
        (global.set $steps (i32.const 0))
        (return)))

    ;; Synchronous SendMessage continuation — WndProc returned
    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA0005))
      (then
        (global.set $handler_set_eip (i32.const 1))
        (global.set $eip (i32.const 0))  ;; Stop nested run loop
        (return)))

    ;; Modal common-dialog pump (marker 0xCACA0006)
    ;; Set by $modal_begin. Each interpreter pass through this thunk:
    ;;   - if $modal_dlg_hwnd != 0 (dialog still open): set yield_flag and
    ;;     return — JS regains control, processes input via DOM events
    ;;     which feed renderer.handleMouseDown → send_message into the
    ;;     dialog's WAT children. The dialog's wndproc clears
    ;;     $modal_dlg_hwnd on OK/Cancel via $modal_done_*.
    ;;   - else (dialog destroyed): restore the saved EIP/ESP/EAX from
    ;;     before the API call, advance ESP past the original args, and
    ;;     return. EIP is now back in guest code, the API call has
    ;;     "returned" with the chosen result.
    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA0006))
      (then
        ;; This thunk re-enters itself on every pump iteration. Mark it so
        ;; $run's thunk-zone auto-pop doesn't misread the unchanged EIP as
        ;; "handler left EIP alone" and pop [esp] — that would splice the
        ;; pump out and let execution fall through to the post-MessageBox
        ;; instruction (LocalFree/ExitProcess) on the very next batch.
        (global.set $handler_set_eip (i32.const 1))
        ;; A wizard page may do the complete installation from PSN_WIZFINISH.
        ;; It returns here through the ordinary modal thunk so that work ran in
        ;; bounded top-level batches instead of inside $wnd_send_message's
        ;; nested 64M-block callback loop.
        (if (global.get $propsheet_finish_page)
          (then
            (local.set $arg4
              (call $dialog_extra_get
                (global.get $propsheet_finish_page) (i32.const 0)))
            (global.set $propsheet_finish_page (i32.const 0))
            (call $heap_free (global.get $propsheet_finish_nmhdr))
            (global.set $propsheet_finish_nmhdr (i32.const 0))
            (if (i32.eqz (local.get $arg4))
              (then (call $modal_done (i32.const 1))))))
        (if (call $modal_pump_step (global.get $modal_loop_thunk)) (then (return)))
        ;; Modal complete — splice the API call back together.
        (i32.store offset=0 (global.get $reg_base) (global.get $modal_result))
        (i32.store offset=12 (global.get $reg_base) (global.get $modal_saved_ebx))
        (i32.store offset=24 (global.get $reg_base) (global.get $modal_saved_esi))
        (i32.store offset=28 (global.get $reg_base) (global.get $modal_saved_edi))
        (i32.store offset=20 (global.get $reg_base) (global.get $modal_saved_ebp))
        (global.set $modal_restore_pending (i32.const 0))
        (global.set $eip (global.get $modal_ret_addr))
        (i32.store offset=16 (global.get $reg_base) (i32.add (global.get $modal_saved_esp) (global.get $modal_esp_adjust)))
        (global.set $yield_reason (i32.const 0))
        (return)))

    ;; _initterm continuation — init function returned, call next entry
    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA0003))
      (then
        (local.set $arg0 (i32.const 0))
        ;; Find next non-NULL entry
        (block $done (loop $scan
          (br_if $done (i32.ge_u (global.get $initterm_ptr) (global.get $initterm_end)))
          (local.set $arg0 (call $gl32 (global.get $initterm_ptr)))
          (global.set $initterm_ptr (i32.add (global.get $initterm_ptr) (i32.const 4)))
          (if (local.get $arg0)
            (then
              (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
              (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $initterm_thunk))
              (global.set $eip (local.get $arg0))
              (global.set $steps (i32.const 0))
              (return)))
          (br $scan)))
        ;; All done — return to original _initterm caller
        (global.set $eip (global.get $initterm_ret))
        (return)))

    ;; Normal CRT exit() callback returned. Continue draining the atexit
    ;; registry in LIFO order; the final step reports the saved exit code.
    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA002C))
      (then
        (call $crt_atexit_run_next)
        (return)))

    ;; Returning CRT cleanup callback: the caller return frame is still on ESP.
    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA0038))
      (then (call $crt_cexit_run_next) (return)))

    ;; bsearch continuation — comparator returned eax = sign(key - elem).
    ;; eax==0 → hit; eax<0 → narrow to [low, mid); eax>0 → narrow to [mid+1, high).
    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA000C))
      (then
        ;; compar's ret popped the thunk addr; our 2 pushed args remain.
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
          (then
            (i32.store offset=0 (global.get $reg_base) (i32.add (global.get $bsearch_base)
              (i32.mul (global.get $bsearch_mid) (global.get $bsearch_size))))
            (global.set $eip (global.get $bsearch_ret))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
            (return)))
        (if (i32.lt_s (i32.load offset=0 (global.get $reg_base)) (i32.const 0))
          (then (global.set $bsearch_high (global.get $bsearch_mid)))
          (else (global.set $bsearch_low
            (i32.add (global.get $bsearch_mid) (i32.const 1)))))
        (call $bsearch_probe)
        (return)))

    ;; qsort comparator returned; swap if needed and schedule the next pair.
    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA002D))
      (then
        (call $qsort_continue)
        (return)))

    ;; DirectDrawEnumerateA callback returned — set EAX=DD_OK and return to caller
    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA0007))
      (then
        ;; EnumSurfaces keeps a typed, stack-resident iterator so callbacks
        ;; may re-enter DirectDraw and enumeration can resume or cancel.
        (if (i32.eq (call $gl32 (i32.load offset=16 (global.get $reg_base))) (i32.const 0x53454444))
          (then (call $dd_enum_surfaces_continue) (return)))
        (if (i32.eq (call $gl32 (i32.load offset=16 (global.get $reg_base))) (i32.const 0x53455344))
          (then (call $dsound_enum_continue) (return)))
        ;; Pop the saved original return address
        (global.set $eip (call $gl32 (i32.load offset=16 (global.get $reg_base))))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))  ;; DD_OK
        (return)))

    ;; EnumDisplayModes continuation — callback returned, try next mode
    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA0008))
      (then
        (call $enum_modes_continue)
        (return)))

    ;; D3D EnumDevices continuation — callback returned, try next device
    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA000B))
      (then
        (call $d3d_enum_devices_continue)
        (return)))

    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA0036))
      (then (call $monitor_enum_continue) (return)))

    ;; A frame handler called for a CPU fault returned (see $seh_raw_continue).
    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA0037))
      (then (call $seh_raw_continue) (return)))

    ;; Guest code called a dispatcher node's handler (see $seh_dispatch_node_handler).
    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA003A))
      (then (call $seh_dispatch_node_handler) (return)))

    ;; An RtlUnwind frame handler returned (see $rtl_unwind_continue).
    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA0039))
      (then (call $rtl_unwind_continue) (return)))

    ;; EnumChildWindows continuation — callback returned, try the next child
    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA002B))
      (then
        (call $enum_child_continue)
        (return)))

    ;; EnumResourceNamesA continuation — callback returned, visit the next
    ;; name in the selected PE resource-type directory.
    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA0030))
      (then
        (call $enum_rsrc_continue)
        (return)))

    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA0032))
      (then (call $io_apc_continue) (return)))

    ;; In-proc CoCreateInstance steps (see $com_activate_begin).
    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA0033))
      (then (call $com_activate_after_gco) (return)))
    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA0034))
      (then (call $com_activate_after_create) (return)))
    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA0035))
      (then (call $com_activate_after_release) (return)))

    ;; D3D EnumZBufferFormats continuation — callback returned, finish enumeration
    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA000D))
      (then
        (call $d3d_enum_zbuf_continue)
        (return)))

    ;; D3D EnumTextureFormats continuation — callback returned, try next format
    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA000F))
      (then
        (call $d3d_enum_tex_continue)
        (return)))

    ;; Generic one-callback continuation. OLE guest COM calls leave a typed
    ;; stack context for their multi-stage API-frame resume; locale/font
    ;; enumerators retain the original saved-return-address form.
    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA0011))
      (then
        ;; A nested HookProc returned from CallNextHookEx. Restore the calling
        ;; hook as the active chain node and resume immediately after the API
        ;; call, preserving the nested hook's exact LRESULT in EAX.
        (if (i32.eq (call $gl32 (i32.load offset=16 (global.get $reg_base))) (i32.const 0x314E4B48))
          (then
            (global.set $eip
              (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))
            (global.set $hook_active_node
              (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
            (return)))
        ;; DirectPlay player/group enumeration leaves its reentrant DPEN frame
        ;; at ESP after the five-argument callback returns.
        (if (i32.eq (call $gl32 (i32.load offset=16 (global.get $reg_base))) (i32.const 0x4E455044))
          (then
            (call $dp_enum_continue)
            (return)))
        ;; DirectPlay EnumSessions leaves its DPES frame after the
        ;; four-argument callback returns (09d4-dplay-net.wat).
        (if (i32.eq (call $gl32 (i32.load offset=16 (global.get $reg_base))) (i32.const 0x53455044))
          (then
            (call $dpn_enum_sessions_continue)
            (return)))
        ;; DirectInput EnumDevices/EnumObjects callbacks leave their reentrant
        ;; stack-resident DIEN frame at ESP after stdcall pops both arguments.
        (if (i32.eq (call $gl32 (i32.load offset=16 (global.get $reg_base))) (i32.const 0x4E454944))
          (then
            (call $di_enum_continue)
            (return)))
        ;; DirectPlayLobby EnumAddress/EnumAddressTypes callbacks leave a
        ;; reentrant DPLA/DPLT frame after popping four/three arguments.
        (if (i32.or
              (i32.eq (call $gl32 (i32.load offset=16 (global.get $reg_base))) (i32.const 0x414C5044))
              (i32.eq (call $gl32 (i32.load offset=16 (global.get $reg_base))) (i32.const 0x544C5044)))
          (then
            (call $dpl_enum_continue)
            (return)))
        ;; Console HandlerRoutine callbacks leave their CCTL chain frame after
        ;; stdcall RET 4. Resume the prior handler or the interrupted console
        ;; API according to the handler's BOOL result.
        (if (i32.eq (call $gl32 (i32.load offset=16 (global.get $reg_base))) (i32.const 0x4C544343))
          (then
            (call $console_ctrl_continue)
            (return)))
        ;; InitCommonControlsEx mixed ICC_LINK_CLASS|legacy request. Authentic
        ;; Win98 COMCTL32 has returned from the masked legacy half, exposing
        ;; ICCT, the temporary structure, and the original stdcall frame.
        ;; Preserve its BOOL in EAX while completing the original RET 4.
        (if (i32.eq (call $gl32 (i32.load offset=16 (global.get $reg_base))) (i32.const 0x54434349))
          (then
            (global.set $eip
              (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
            (return)))
        ;; WH_KEYBOARD callbacks use this existing one-callback thunk with a
        ;; tiny typed context. KeyboardProc's stdcall return leaves KHK1 at
        ;; ESP; restore the USER caller and the successful Get/PeekMessage
        ;; result. (Hook suppression on nonzero return is not modeled yet.)
        (if (i32.eq (call $gl32 (i32.load offset=16 (global.get $reg_base))) (i32.const 0x314B484B))
          (then (call $keyboard_hook_finish) (return)))
        (if (i32.eq (call $gl32 (i32.load offset=16 (global.get $reg_base))) (i32.const 0x314B4D47))
          (then (call $getmessage_hook_continue) (return)))
        ;; TranslateAccelerator's WM_COMMAND returned: the accelerator was
        ;; translated, so the API reports TRUE whatever the wndproc said.
        (if (i32.eq (call $gl32 (i32.load offset=16 (global.get $reg_base))) (i32.const 0x43434154))
          (then
            (global.set $eip (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
            (i32.store offset=0 (global.get $reg_base) (i32.const 1))
            (return)))
        (if (i32.eq (call $gl32 (i32.load offset=16 (global.get $reg_base))) (i32.const 0x434E5446))
          (then
            (call $gdi_font_enum_continue)
            (return)))
        (if (i32.eq (call $gl32 (i32.load offset=16 (global.get $reg_base))) (i32.const 0x4345464D))
          (then
            (call $gdi_metafile_enum_continue)
            (return)))
        (if (i32.eq (call $gl32 (i32.load offset=16 (global.get $reg_base))) (i32.const 0x43454C4F))
          (then
            (call $ole_guest_callback_continue)
            (return)))
        ;; One-string system enumerations use a typed frame so their temporary
        ;; guest buffer is released before the original API caller resumes.
        (if (i32.eq (call $gl32 (i32.load offset=16 (global.get $reg_base))) (i32.const 0x31535953))
          (then
            (call $heap_free (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))
            (global.set $eip (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
            (i32.store offset=0 (global.get $reg_base) (i32.const 1))
            (return)))
        (global.set $eip (call $gl32 (i32.load offset=16 (global.get $reg_base))))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (return)))

    ;; LineDDA point callback returned; stdcall popped its three arguments.
    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA0012))
      (then
        (call $line_dda_advance)
        (return)))

    ;; winmm timer thread: start of the thread, or a callback returned.
    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA003B))
      (then (call $mm_timer_thread_step) (return)))

    ;; mm_timer callback returned — restore caller-saved regs + flags
    (if (i32.eq (local.get $name_rva) (i32.const 0xCACA000A))
      (then
        ;; This dedicated continuation is the authoritative completion event.
        ;; Inferring completion later from ESP fails when the interrupted code
        ;; returns from the callback and immediately enters a deeper call.
        (global.set $mm_timer_in_cb (i32.const 0))
        (call $restore_caller_regs)
        (call $wave_callback_restore_wait)
        (if (global.get $mm_timer_resume_yield)
          (then
            (global.set $yield_reason (global.get $mm_timer_resume_yield))
            (global.set $mm_timer_resume_yield (i32.const 0))
            (global.set $steps (i32.const 0))))
        (return)))

    ;; Unresolved ordinal import from a system DLL (marker "ORD\0")
    ;; — $api_id holds the actual ordinal. Format "KERNEL32.#NNNNN" into
    ;; the scratch buffer at 0x2DA and crash with that name so the user
    ;; sees exactly which ordinal needs implementing.
    (if (i32.eq (local.get $name_rva) (i32.const 0x4F524400))
      (then
        ;; Write 5 decimal digits of $api_id into buffer at WASM 0x2DA..0x2DE
        (local.set $arg0 (local.get $api_id))
        (i32.store8 (i32.const 0x2DE) (i32.add (i32.const 0x30) (i32.rem_u (local.get $arg0) (i32.const 10))))
        (local.set $arg0 (i32.div_u (local.get $arg0) (i32.const 10)))
        (i32.store8 (i32.const 0x2DD) (i32.add (i32.const 0x30) (i32.rem_u (local.get $arg0) (i32.const 10))))
        (local.set $arg0 (i32.div_u (local.get $arg0) (i32.const 10)))
        (i32.store8 (i32.const 0x2DC) (i32.add (i32.const 0x30) (i32.rem_u (local.get $arg0) (i32.const 10))))
        (local.set $arg0 (i32.div_u (local.get $arg0) (i32.const 10)))
        (i32.store8 (i32.const 0x2DB) (i32.add (i32.const 0x30) (i32.rem_u (local.get $arg0) (i32.const 10))))
        (local.set $arg0 (i32.div_u (local.get $arg0) (i32.const 10)))
        (i32.store8 (i32.const 0x2DA) (i32.add (i32.const 0x30) (i32.rem_u (local.get $arg0) (i32.const 10))))
        ;; Log as a synthetic API name so --verbose/--trace-api pick it up
        (call $host_log (i32.const 0x2D0) (i32.const 15))
        (call $crash_unimplemented (i32.const 0x2D0))
        (return)))

    ;; ── Normal API dispatch ─────────────────────────────────────

    ;; Resolved-ordinal import: thunk+0 holds (0x80000000 | ordinal), not an
    ;; IMAGE_IMPORT_BY_NAME RVA. host_resolve_ordinal found a real api_id, so
    ;; we have a handler to run — just substitute a placeholder name for
    ;; logging (and for any handler that prints name_ptr).
    (global.set $api_calls (i32.add (global.get $api_calls) (i32.const 1)))
    (if (i32.and (local.get $name_rva) (i32.const 0x80000000))
      (then
        (local.set $name_ptr (i32.const 0x2E0))
        ;; Emit COM-marker BEFORE the name so JS can substitute the real
        ;; method name in $lastApiName before --trace-api filtering and
        ;; --trace-stack walking happen on the entry log.
        (if (global.get $api_log_on)
          (then
            (call $host_log_i32 (i32.or (i32.const 0xC0DE0000) (local.get $api_id)))
            (call $host_log (local.get $name_ptr) (i32.const 5)))))
      (else
        ;; Through $g2w: a DLL rebased into a sparse reservation keeps its
        ;; hint/name table outside the direct window.
        (local.set $name_ptr (call $g2w (i32.add (global.get $image_base)
          (i32.add (local.get $name_rva) (i32.const 2)))))
        (if (global.get $api_log_on)
          (then (call $host_log (local.get $name_ptr) (call $strlen (local.get $name_ptr)))))))
    ;; Load args from guest stack
    (local.set $arg0 (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))
    (local.set $arg1 (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))
    (local.set $arg2 (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))
    (local.set $arg3 (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))
    (local.set $arg4 (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

    ;; Win32 APIs use stdcall/cdecl ABIs and must preserve the x86 nonvolatile
    ;; registers even when a handler recursively dispatches window messages.
    (local.set $saved_ebx (i32.load offset=12 (global.get $reg_base)))
    (local.set $saved_esi (i32.load offset=24 (global.get $reg_base)))
    (local.set $saved_edi (i32.load offset=28 (global.get $reg_base)))
    (local.set $saved_ebp (i32.load offset=20 (global.get $reg_base)))

    ;; Hot message pumps exercise PeekMessage often enough that a direct path
    ;; avoids large br_table edge cases and keeps idle loops from corrupting ESP.
    (if (i32.eq (local.get $api_id) (global.get $API_ID_PeekMessageA))
      (then
        (call $handle_PeekMessageA
          (local.get $arg0) (local.get $arg1) (local.get $arg2)
          (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
        (call $restore_win32_nonvolatile
          (local.get $saved_ebx) (local.get $saved_esi)
          (local.get $saved_edi) (local.get $saved_ebp))
        (if (global.get $api_log_on) (then (call $host_log_api_exit)))
        (return)))
    (if (i32.eq (local.get $api_id) (global.get $API_ID_PeekMessageW))
      (then
        (call $handle_PeekMessageW
          (local.get $arg0) (local.get $arg1) (local.get $arg2)
          (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
        (call $restore_win32_nonvolatile
          (local.get $saved_ebx) (local.get $saved_esi)
          (local.get $saved_edi) (local.get $saved_ebp))
        (if (global.get $api_log_on) (then (call $host_log_api_exit)))
        (return)))
    ;; Keep the message-aware wait out of the generated page dispatch. Its
    ;; private-pump semantics require a completed stdcall frame before the
    ;; slice yields, just like the hot PeekMessage paths above.
    (if (i32.eq (local.get $api_id) (global.get $API_ID_MsgWaitForMultipleObjects))
      (then
        (local.set $arg4 (i32.const 0xFFFF))
        (if (local.get $arg0)
          (then
            (local.set $arg4 (call $host_wait_multiple
              (local.get $arg0) (call $g2w (local.get $arg1))
              (local.get $arg2) (i32.const 0)))))
        (if (i32.and
              (i32.ne (local.get $arg4) (i32.const 0xFFFF))
              (i32.ne (local.get $arg4) (i32.const 0x102)))
          (then (i32.store offset=0 (global.get $reg_base) (local.get $arg4)))
          (else
            (i32.store offset=0 (global.get $reg_base)
              (call $msgwait_idle_result (local.get $arg0) (local.get $arg3)))))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (global.set $yield_flag (i32.const 1))
        (global.set $steps (i32.const 0))
        (call $restore_win32_nonvolatile
          (local.get $saved_ebx) (local.get $saved_esi)
          (local.get $saved_edi) (local.get $saved_ebp))
        (if (global.get $api_log_on) (then (call $host_log_api_exit)))
        ;; This direct handler deliberately completes its own stdcall frame,
        ;; so resume at the return address instead of relying on thunk auto-pop.
        (global.set $eip (call $gl32 (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
        (return)))

    ;; _EH_prolog's job is to build the caller's frame: it leaves EBP pointing
    ;; at the slot where it saved the old EBP. Restoring EBP here undid that, so
    ;; every MSVC function that opens with it ran on its caller's frame and its
    ;; `leave; ret` returned through garbage (LithTech's lithtech.exe returned
    ;; into NULL at startup). The other nonvolatiles are still restored.
    (if (i32.eq (local.get $api_id) (global.get $API_ID__EH_prolog))
      (then
        (call $handle__EH_prolog
          (local.get $arg0) (local.get $arg1) (local.get $arg2)
          (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
        (call $restore_win32_nonvolatile
          (local.get $saved_ebx) (local.get $saved_esi)
          (local.get $saved_edi) (i32.load offset=20 (global.get $reg_base)))
        (if (global.get $api_log_on) (then (call $host_log_api_exit)))
        (return)))

    ;; Delegate to generated br_table
    (call $dispatch_api_table (local.get $api_id) (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))

    (call $restore_win32_nonvolatile
      (local.get $saved_ebx) (local.get $saved_esi)
      (local.get $saved_edi) (local.get $saved_ebp))

    ;; Post-handler ESP hook for --esp-delta audit
    (if (global.get $api_log_on) (then (call $host_log_api_exit)))
  )
