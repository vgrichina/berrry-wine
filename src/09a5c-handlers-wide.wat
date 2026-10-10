  ;; Wide-character KERNEL/USER adapters. Keep the public W entry points on
  ;; the mature ANSI implementations while preserving UTF-16 message payloads.

  ;; 283: GetModuleHandleW(lpModuleName) — the A lookup, over a narrowed name.
  ;; It used to run its own search ($find_dll_by_wname, now gone) that compared
  ;; the name exactly and knew nothing of the ole32 rule, so the same module
  ;; resolved under one spelling and came back NULL under the other.
  (func $handle_GetModuleHandleW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $len i32) (local $ansi i32)
    (if (local.get $arg0)
      (then
        (local.set $len (i32.add (call $guest_wcslen (local.get $arg0)) (i32.const 1)))
        (local.set $ansi (call $heap_alloc (local.get $len)))
        (if (i32.eqz (local.get $ansi))
          (then (i32.store offset=0 (global.get $reg_base) (i32.const 0))
                (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
                (return)))
        (drop (call $wide_to_ansi (local.get $arg0) (local.get $ansi) (local.get $len)))))
    (call $handle_GetModuleHandleA (local.get $ansi) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
    (if (local.get $ansi) (then (call $heap_free (local.get $ansi))))
  )

  ;; 284: GetModuleFileNameW — write L"C:\<exe_name>\0" as wide string
  (func $handle_GetModuleFileNameW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $idx i32) (local $path_g i32)
    (local.set $idx (call $static_sys_dll_from_handle (local.get $arg0)))
    (if (local.get $idx)
      (then
        (i32.store offset=0 (global.get $reg_base) (call $static_sys_dll_file_name
          (i32.sub (local.get $idx) (i32.const 1))
          (local.get $arg1) (local.get $arg2) (i32.const 1)))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))) (return)))
    (local.set $idx (i32.const 0))
    (block $not_loaded (loop $scan_loaded
      (br_if $not_loaded (i32.ge_u (local.get $idx) (i32.atomic.load (global.get $DLL_SHARED))))
      (if (i32.eq (local.get $arg0)
            (i32.load (i32.add (global.get $DLL_TABLE)
              (i32.mul (local.get $idx) (i32.const 32)))))
        (then
          (local.set $path_g (i32.load (i32.add (global.get $DLL_PATH_TABLE)
            (i32.shl (local.get $idx) (i32.const 2)))))
          (if (local.get $path_g)
            (then
              (i32.store offset=0 (global.get $reg_base) (call $loaded_module_file_name
                (local.get $path_g) (local.get $arg1) (local.get $arg2) (i32.const 1)))
              (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
              (return)))))
      (local.set $idx (i32.add (local.get $idx) (i32.const 1)))
      (br $scan_loaded)))
    (i32.store offset=0 (global.get $reg_base) (call $module_file_name (local.get $arg1) (local.get $arg2) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))) (return)
  )

  ;; 285: GetCommandLineW
  (func $handle_GetCommandLineW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (global.get $msvcrt_wcmdln_ptr))
      (then (call $store_fake_wcmdline)))
    (i32.store offset=0 (global.get $reg_base) (global.get $msvcrt_wcmdln_ptr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))) (return)
  )

  ;; 286: CreateWindowExW — convert ASCII-compatible wide strings and reuse
  ;; the mature A path. This keeps Unicode callers on the same CBT hook,
  ;; WM_CREATE, menu, owner/parent, control-class, and show/paint machinery as
  ;; ANSI callers. Class table keys are byte-string hashes, so RegisterClassW
  ;; and CreateWindowExA-style lookup share the same slots after conversion.
  ;; While the A core runs, these preserve the caller-owned UTF-16 pointers for
  ;; CREATESTRUCTW. They are per-WASM-instance and cleared before returning.
  (global $createwnd_wide_name (mut i32) (i32.const 0))
  (global $createwnd_wide_class (mut i32) (i32.const 0))
  (func $handle_CreateWindowExW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $class_a i32) (local $title_a i32)
    (local.set $class_a (local.get $arg1))
    (if (i32.ge_u (local.get $arg1) (i32.const 0x10000))
      (then
        (local.set $class_a (call $heap_alloc (i32.const 256)))
        (if (local.get $class_a)
          (then
            (drop (call $wide_to_ansi (local.get $arg1) (local.get $class_a) (i32.const 256)))))))
    (local.set $title_a (local.get $arg2))
    (if (i32.ge_u (local.get $arg2) (i32.const 0x10000))
      (then
        (local.set $title_a (call $heap_alloc (i32.const 512)))
        (if (local.get $title_a)
          (then
            (drop (call $wide_to_ansi (local.get $arg2) (local.get $title_a) (i32.const 512)))))))
    (global.set $createwnd_wide_name (local.get $arg2))
    (global.set $createwnd_wide_class (local.get $arg1))
    (call $handle_CreateWindowExA
      (local.get $arg0)
      (local.get $class_a)
      (local.get $title_a)
      (local.get $arg3)
      (local.get $arg4)
      (local.get $name_ptr))
    (global.set $createwnd_wide_name (i32.const 0))
    (global.set $createwnd_wide_class (i32.const 0))
    ;; Free in reverse allocation order so the first-fit free list can reuse
    ;; both differently-sized blocks on the next call without fragmentation.
    (if (i32.and (i32.ne (local.get $title_a) (i32.const 0))
                 (i32.ne (local.get $title_a) (local.get $arg2)))
      (then (call $heap_free (local.get $title_a))))
    (if (i32.and (i32.ne (local.get $class_a) (i32.const 0))
                 (i32.ne (local.get $class_a) (local.get $arg1)))
      (then (call $heap_free (local.get $class_a))))
    (return)
  )

  ;; 287: RegisterClassW
  (func $handle_RegisterClassW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; RegisterClassW — same layout as RegisterClassA, just Unicode strings
    (local $tmp i32) (local $class_name_wa i32) (local $slot i32) (local $dst i32)
    (local.set $tmp (call $gl32 (i32.add (local.get $arg0) (i32.const 4))))
    (local.set $class_name_wa (call $class_wide_name_key (call $gl32 (i32.add (local.get $arg0) (i32.const 36)))))
    (i32.store offset=0 (global.get $reg_base) (call $class_table_register_data
      (local.get $class_name_wa) (call $g2w (local.get $arg0))))
    (if (i32.and (i32.eqz (global.get $wndproc_addr))
      (i32.and (i32.ge_u (local.get $tmp) (global.get $image_base))
               (i32.lt_u (local.get $tmp) (i32.add (global.get $image_base) (global.get $exe_size_of_image)))))
    (then
      (global.set $wndproc_addr (local.get $tmp))
      (global.set $wndclass_style (call $gl32 (local.get $arg0)))
      (global.set $wndclass_bg_brush (call $gl32 (i32.add (local.get $arg0) (i32.const 28)))))
    (else (if (i32.and
      (i32.and (i32.eqz (global.get $wndproc_addr2))
               (i32.ne (local.get $tmp) (global.get $wndproc_addr)))
      (i32.and (i32.ge_u (local.get $tmp) (global.get $image_base))
               (i32.lt_u (local.get $tmp) (i32.add (global.get $image_base) (global.get $exe_size_of_image)))))
    (then (global.set $wndproc_addr2 (local.get $tmp))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 288: RegisterClassExW
  (func $handle_RegisterClassExW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $tmp i32) (local $class_name_wa i32) (local $slot i32) (local $dst i32) (local $src i32)
    ;; WNDCLASSEXW: cbSize(+0) style(+4) lpfnWndProc(+8) ... lpszClassName(+40)
    (local.set $tmp (call $gl32 (i32.add (local.get $arg0) (i32.const 8))))
    (local.set $class_name_wa (call $class_wide_name_key (call $gl32 (i32.add (local.get $arg0) (i32.const 40)))))
    (local.set $src (call $g2w (i32.add (local.get $arg0) (i32.const 4))))
    (i32.store offset=0 (global.get $reg_base) (call $class_table_register_data
      (local.get $class_name_wa) (local.get $src)))
    (if (i32.and (i32.eqz (global.get $wndproc_addr))
      (i32.and (i32.ge_u (local.get $tmp) (global.get $image_base))
               (i32.lt_u (local.get $tmp) (i32.add (global.get $image_base) (global.get $exe_size_of_image)))))
    (then
      (global.set $wndproc_addr (local.get $tmp))
      (global.set $wndclass_style (call $gl32 (i32.add (local.get $arg0) (i32.const 4))))
      (global.set $wndclass_bg_brush (call $gl32 (i32.add (local.get $arg0) (i32.const 32)))))
    (else
      (if (i32.and
            (i32.and (i32.eqz (global.get $wndproc_addr2))
                     (i32.ne (local.get $tmp) (global.get $wndproc_addr)))
            (i32.and (i32.ge_u (local.get $tmp) (global.get $image_base))
                     (i32.lt_u (local.get $tmp) (i32.add (global.get $image_base) (global.get $exe_size_of_image)))))
        (then (global.set $wndproc_addr2 (local.get $tmp))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 289: DefWindowProcW — same as DefWindowProcA
  (func $handle_DefWindowProcW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eq (local.get $arg1) (i32.const 0x0046))
      (then
        (call $windowpos_defproc_minmax (local.get $arg0) (local.get $arg3))
        (i32.store (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (if (i32.eq (local.get $arg1) (i32.const 0x0047))
      (then
        (call $windowpos_defproc_geometry (local.get $arg0) (local.get $arg3))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    ;; WM_NCCREATE (0x81): accepting non-client creation is the documented
    ;; default. Returning zero aborts CreateWindowEx before WM_CREATE.
    (if (i32.eq (local.get $arg1) (i32.const 0x0081))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    ;; Encoding-neutral default: permit WM_QUERYOPEN unless the application
    ;; consumes it before reaching DefWindowProcW.
    (if (i32.eq (local.get $arg1) (i32.const 0x0013))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    ;; WM_CLOSE (0x10): default close destroys the target. Only closing the
    ;; main window should end the message loop; modeless dialogs are ordinary
    ;; owned windows and closing them must not terminate the app.
    (if (i32.eq (local.get $arg1) (i32.const 0x0010))
    (then
      ;; A DialogBoxParamA dialog closed through default WM_CLOSE must end
      ;; the modal pump; destroying the HWND alone leaves the guest waiting
      ;; forever in the CACA0004 loop.
      (if (i32.and
            (i32.ne (i32.load (global.get $SHARED_DLG_PUMP_HWND)) (i32.const 0))
            (i32.eq (local.get $arg0) (i32.load (global.get $SHARED_DLG_PUMP_HWND))))
        (then
          (global.set $dlg_ended (i32.const 1))
          (global.set $dlg_result (i32.const 2)) ;; IDCANCEL
          (i32.store (global.get $SHARED_DLG_ENDED) (i32.const 1))
          (i32.store (global.get $SHARED_DLG_RESULT) (i32.const 2))
          (if (call $wnd_table_get (local.get $arg0))
            (then
              (call $wnd_destroy_children (local.get $arg0))
              (call $wnd_table_remove (local.get $arg0))))
          (call $host_destroy_window (local.get $arg0))
          (global.set $yield_flag (i32.const 1))
          (i32.store offset=0 (global.get $reg_base) (i32.const 0))
          (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
          (return)))
      ;; Same main-window lifecycle as DestroyWindow; see DefWindowProcA.
      (call $destroy_main_window_lifecycle (local.get $arg0))
      (if (i32.eq (local.get $arg0) (global.get $focus_hwnd))
        (then (global.set $focus_hwnd (i32.const 0))))
      (call $wnd_destroy_recursive (local.get $arg0))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0))
      (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))) (return)))
    ;; Background erasing has no text encoding; share HDC ownership, clipping
    ;; and return semantics with the ANSI default procedure.
    (if (i32.eq (local.get $arg1) (i32.const 0x0014))
      (then
        (call $handle_DefWindowProcA (local.get $arg0) (local.get $arg1)
          (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
        (return)))
    ;; WM_PAINT: default handling is an empty paint cycle that validates the
    ;; update region, identical to DefWindowProcA.
    (if (i32.eq (local.get $arg1) (i32.const 0x000F))
    (then
    (call $update_clear_hwnd (local.get $arg0))
    (call $paint_flag_clear_hwnd (local.get $arg0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))) (return)))
    ;; WM_NCPAINT is encoding-neutral. Keep A/W on the same WAT-native
    ;; non-client painter so activation, flashing and frame metrics cannot
    ;; diverge between otherwise identical windows.
    (if (i32.eq (local.get $arg1) (i32.const 0x0085))
    (then
    (call $defwndproc_do_ncpaint (local.get $arg0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))) (return)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))) (return)
  )

  ;; 290: LoadCursorW(hInstance, lpCursorName) — a cursor named by ordinal is
  ;; the only kind either spelling can load, and an ordinal has no encoding,
  ;; so this is exactly LoadCursorA.
  (func $handle_LoadCursorW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_LoadCursorA (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; 291: LoadIconW(hInstance, lpIconName) → HICON. An icon named by ordinal —
  ;; MAKEINTRESOURCE, which is every icon we can actually decode — has no
  ;; encoding, so this is the A implementation verbatim: it used to hand back
  ;; the opaque no-pixels handle and the same icon drew in A and vanished in W.
  (func $handle_LoadIconW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_LoadIconA (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; 293: MessageBoxW — narrow its UTF-16 strings into the one message-box
  ;; implementation shared with MessageBoxA/MessageBoxIndirectA.
  (func $handle_MessageBoxW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_MessageBox_core (local.get $arg0) (local.get $arg1)
      (local.get $arg2) (local.get $arg3) (i32.const 20) (i32.const 1)))

  ;; 294: SetWindowTextW(hwnd, lpString) → BOOL
  (func $handle_SetWindowTextW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $text_gp i32) (local $text_wa i32) (local $len i32)
    (if (i32.eqz (local.get $arg0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (if (i32.ge_u (local.get $arg1) (i32.const 0x10000))
      (then
        (local.set $text_gp (call $heap_alloc
          (i32.add (call $guest_wcslen (local.get $arg1)) (i32.const 1))))
        (if (local.get $text_gp)
          (then
            (local.set $len (call $wide_to_ansi
              (local.get $arg1)
              (local.get $text_gp)
              (i32.add (call $guest_wcslen (local.get $arg1)) (i32.const 1))))
            (local.set $text_wa (call $g2w (local.get $text_gp)))))))
    ;; Child controls treat SetWindowText as WM_SETTEXT on their own wndproc.
    ;; WAT-native controls store byte strings, so pass the converted buffer.
    (if (i32.and
          (i32.ne (call $ctrl_table_get_class (local.get $arg0)) (i32.const 0))
          (i32.or
            (i32.lt_u (call $ctrl_table_get_class (local.get $arg0)) (i32.const 10))
            (i32.gt_u (call $ctrl_table_get_class (local.get $arg0)) (i32.const 16))))
      (then
        (i32.store offset=0 (global.get $reg_base) (call $control_wndproc_dispatch
          (local.get $arg0) (i32.const 0x000C) (i32.const 0) (local.get $text_gp)))
        (call $host_set_window_text (local.get $arg0) (local.get $text_wa))
        (if (local.get $text_gp) (then (call $heap_free (local.get $text_gp))))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    ;; Native child windows such as RichEdit20A are not WAT control-table
    ;; controls, but SetWindowText still maps to WM_SETTEXT for them.
    (if (i32.and
          (i32.ne (call $wnd_get_parent (local.get $arg0)) (i32.const 0))
          (i32.ne (call $wnd_table_get (local.get $arg0)) (i32.const 0)))
      (then
        (call $richedit_format_reset_hwnd (local.get $arg0))
        (call $title_table_set (local.get $arg0) (local.get $text_wa) (local.get $len))
        (i32.store offset=0 (global.get $reg_base) (call $wnd_send_message
          (local.get $arg0) (i32.const 0x000C) (i32.const 0) (local.get $text_gp)))
        (call $host_set_window_text (local.get $arg0) (local.get $text_wa))
        (if (local.get $text_gp) (then (call $heap_free (local.get $text_gp))))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (call $title_table_set (local.get $arg0) (local.get $text_wa) (local.get $len))
    (call $nc_flags_set (local.get $arg0) (i32.const 1))
    (call $defwndproc_do_ncpaint (local.get $arg0))
    (call $host_set_window_text (local.get $arg0) (local.get $text_wa))
    (if (local.get $text_gp) (then (call $heap_free (local.get $text_gp))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; 295: GetWindowTextW(hwnd, lpString, nMaxCount) → int (chars copied)
  ;; The same read as GetWindowTextA, staged through an ANSI buffer of the
  ;; same character count and widened into the caller's. It used to answer
  ;; "" for every window, which is a wrong answer rather than a missing one.
  (func $handle_GetWindowTextW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $tmp i32) (local $len i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    (if (i32.or (i32.eqz (local.get $arg1)) (i32.le_s (local.get $arg2) (i32.const 0)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (i32.store16 (call $g2w (local.get $arg1)) (i32.const 0))
    (local.set $tmp (call $heap_alloc (local.get $arg2)))
    (if (i32.eqz (local.get $tmp))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (call $gs8 (local.get $tmp) (i32.const 0))
    (local.set $len (call $window_text_ansi
      (local.get $arg0) (local.get $tmp) (local.get $arg2)))
    (drop (call $ansi_to_wide (local.get $tmp) (local.get $arg1) (local.get $arg2)))
    (call $heap_free (local.get $tmp))
    (i32.store offset=0 (global.get $reg_base) (local.get $len)))

  ;; 296: SendMessageW — routing and stack layout are identical to A. Message
  ;; payloads remain opaque here; individual WAT controls interpret the
  ;; message-specific buffers. Reuse the synchronous subclass/default-proc
  ;; path so Unicode applications can drive common controls (Media Player 32
  ;; uses TB_ADDBUTTONSW through an app-installed toolbar subclass).
  ;; True for the messages whose lParam is a caller-supplied string. The W
  ;; forms carry UTF-16 there; WAT-native controls store bytes, so the text has
  ;; to be narrowed before it reaches one.
  (func $msg_lparam_is_text (param $msg i32) (result i32)
    (i32.or
      (i32.or
        (i32.eq (local.get $msg) (i32.const 0x000C))   ;; WM_SETTEXT
        (i32.eq (local.get $msg) (i32.const 0x00C2)))  ;; EM_REPLACESEL
      (i32.or
        (i32.or
          (i32.or (i32.eq (local.get $msg) (i32.const 0x0143))    ;; CB_ADDSTRING
                  (i32.eq (local.get $msg) (i32.const 0x014A)))   ;; CB_INSERTSTRING
          (i32.or (i32.eq (local.get $msg) (i32.const 0x014C))    ;; CB_FINDSTRING
                  (i32.eq (local.get $msg) (i32.const 0x014D))))  ;; CB_SELECTSTRING
        (i32.or
          (i32.or (i32.eq (local.get $msg) (i32.const 0x0158))    ;; CB_FINDSTRINGEXACT
                  (i32.eq (local.get $msg) (i32.const 0x0180)))   ;; LB_ADDSTRING
          (i32.or
            (i32.or (i32.eq (local.get $msg) (i32.const 0x0181))  ;; LB_INSERTSTRING
                    (i32.eq (local.get $msg) (i32.const 0x018C))) ;; LB_SELECTSTRING
            (i32.or (i32.eq (local.get $msg) (i32.const 0x018F))  ;; LB_FINDSTRING
                    (i32.eq (local.get $msg) (i32.const 0x01A2)))))))) ;; LB_FINDSTRINGEXACT

  ;; Narrow a W message's string lParam for a WAT-native target, or return 0
  ;; when nothing needs converting. Only WAT-native controls are converted: a
  ;; guest window that was sent a W message wants its UTF-16 pointer intact,
  ;; and for those SendMessage may redirect EIP and read the string long after
  ;; this returns, so a temporary buffer would be freed out from under it.
  (func $msg_narrow_text_lparam (param $hwnd i32) (param $msg i32) (param $lParam i32)
        (result i32)
    (local $n i32) (local $buf i32)
    (if (i32.eqz (call $msg_lparam_is_text (local.get $msg))) (then (return (i32.const 0))))
    (if (i32.lt_u (local.get $lParam) (i32.const 0x10000)) (then (return (i32.const 0))))
    (if (i32.eqz (call $ctrl_table_get_class (local.get $hwnd))) (then (return (i32.const 0))))
    (local.set $n (i32.add (call $guest_wcslen (local.get $lParam)) (i32.const 1)))
    (local.set $buf (call $heap_alloc (local.get $n)))
    (if (i32.eqz (local.get $buf)) (then (return (i32.const 0))))
    (drop (call $wide_to_ansi (local.get $lParam) (local.get $buf) (local.get $n)))
    (local.get $buf))

  ;; SendMessageW — the A path owns dispatch. Only the text-bearing messages
  ;; differ, and only when the target is one of our own controls: XP Sound
  ;; Recorder fills its format combo with CB_ADDSTRING of LoadStringW text, and
  ;; reading that UTF-16 as bytes left every row showing just its first letter.
  (global $sendmessage_wide (mut i32) (i32.const 0))
  (func $handle_SendMessageW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $narrow i32)
    (local.set $narrow
      (call $msg_narrow_text_lparam (local.get $arg0) (local.get $arg1) (local.get $arg3)))
    ;; WM_MDICREATE's MDICREATESTRUCT embeds class/title pointers whose
    ;; encoding follows SendMessageW. The shared A dispatcher reads this flag
    ;; only while it translates that message into CreateWindowExW.
    (global.set $sendmessage_wide (i32.const 1))
    (call $handle_SendMessageA
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (select (local.get $narrow) (local.get $arg3) (local.get $narrow))
      (local.get $arg4) (local.get $name_ptr))
    (global.set $sendmessage_wide (i32.const 0))
    (if (local.get $narrow) (then (call $heap_free (local.get $narrow))))
  )

  ;; 297: PostMessageW — same as PostMessageA
  ;; A posted message carries no text, so the wide spelling is the ANSI one.
  ;; It used to be a copy of an older PostMessageA and had drifted: no
  ;; cross-instance routing, and it wrote the queue inline instead of going
  ;; through $post_queue_push, so Unicode callers were invisible to the
  ;; message tracing and could not post to another instance's window.
  (func $handle_PostMessageW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_PostMessageA (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; SendNotifyMessageW has no string payload of its own. Preserve the A
  ;; implementation's same-thread synchronous and cross-thread queued paths.
  (func $handle_SendNotifyMessageW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_SendNotifyMessageA
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))
