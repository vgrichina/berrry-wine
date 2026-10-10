;; 298: SetErrorMode — atomically replace the process-wide Win98 x86 mode.
  (func $handle_SetErrorMode (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.atomic.rmw.xchg offset=12 (global.get $SHARED_COUNTERS) (i32.and (local.get $arg0) (i32.const 0x8003))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 299: GetCurrentThreadId — main thread is 1; worker threads get stable ids.
  (func $handle_GetCurrentThreadId (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (global.get $current_thread_id))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; 300: LoadLibraryW — convert the module name and use the same lookup/load
  ;; path as LoadLibraryA. TEXT_SCRATCH is WAT-private, so expose its inverse
  ;; g2w address while the synchronous host loader consumes the name.
  (func $handle_LoadLibraryW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ansi_gp i32)
    ;; Keep the optional theming-module contract identical to LoadLibraryA.
    ;; Decide optional-module availability before conversion and delegation so
    ;; mutable guest-side staging cannot alter the ANSI lookup contract. Use a
    ;; Boolean null check: i32.and is bitwise, and UTF-16 pointers are aligned.
    (if (i32.and (i32.ne (local.get $arg0) (i32.const 0))
          (call $wide_ascii_eq (call $g2w (local.get $arg0)) (i32.const 0x36D)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (local.set $ansi_gp
      (i32.add
        (i32.sub (global.get $TEXT_SCRATCH) (global.get $GUEST_BASE))
        (global.get $image_base)))
    (drop (call $wide_to_ansi
      (local.get $arg0) (local.get $ansi_gp) (global.get $TEXT_SCRATCH_SIZE)))
    (call $handle_LoadLibraryA
      (local.get $ansi_gp) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  (func $handle_LoadLibraryExW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_LoadLibraryEx_core
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 1)))

  ;; Both startup-info encodings currently expose no strings or inherited
  ;; handles. Keep their identical structure initialization guest-addressed.
  ;; A program launched from Explorer or Start > Run gets
  ;; dwFlags = STARTF_USESHOWWINDOW and wShowWindow = SW_SHOWNORMAL, and the
  ;; CRT hands that to WinMain as nCmdShow. With the flag clear it falls back
  ;; to SW_SHOWDEFAULT (10) instead, which apps that build a show command from
  ;; it get wrong: SimCity 2000 shows its frame with nCmdShow|3, meant to be
  ;; SW_SHOWMAXIMIZED, and 10|3 is 11.
  (func $startup_info_init (param $out i32)
    (call $guest_memset (local.get $out) (i32.const 0) (i32.const 68))
    (call $gs32 (local.get $out) (i32.const 68))
    (call $gs32 (i32.add (local.get $out) (i32.const 44)) (i32.const 1)) ;; dwFlags = STARTF_USESHOWWINDOW
    (call $gs16 (i32.add (local.get $out) (i32.const 48)) (i32.const 1))) ;; wShowWindow = SW_SHOWNORMAL

  ;; 301: GetStartupInfoW — zero-fill the struct
  (func $handle_GetStartupInfoW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $startup_info_init (local.get $arg0))
    (i32.store offset=0 (global.get $reg_base) (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))) (return)
  )

  ;; 302: GetKeyState(nVirtKey) → SHORT — 1 arg stdcall
  (func $handle_GetKeyState (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; Return the current high-bit down state without consuming
    ;; GetAsyncKeyState's one-shot press latch. Toggle-key low bits are not
    ;; tracked yet.
    (i32.store offset=0 (global.get $reg_base) (i32.and
        (call $host_get_key_down_state (local.get $arg0))
        (i32.const 0x8000)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  (func $handle_keybd_event (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; keybd_event synthesizes system keyboard input. Feed the host FIFO used
    ;; by real browser keys rather than the posted-message queue: Get/PeekMessage
    ;; will then apply normal thread routing, hot-key matching and WH_KEYBOARD
    ;; callbacks. Prefer the focused child as the system-input target.
    (drop (call $host_queue_keyboard_input
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)
      (select (global.get $focus_hwnd) (global.get $main_hwnd)
        (i32.ne (global.get $focus_hwnd) (i32.const 0)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; mouse_event(flags, dx, dy, data, extraInfo): system input, not PostMessage.
  (func $handle_mouse_event (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (drop (call $host_queue_mouse_input (local.get $arg0) (local.get $arg1)
      (local.get $arg2) (local.get $arg3) (local.get $arg4)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  ;; ToAsciiEx(uVirtKey, uScanCode, lpKeyState, lpChar, uFlags, hkl) → int.
  ;; 6-arg stdcall. Translate vkey + Shift state to up to one ASCII char in
  ;; *lpChar. Returns 1 on success, 0 if no translation, -1 for dead keys.
  ;; Minimal: handle letters/digits with Shift, and a handful of punctuation
  ;; that SDL apps rely on (Space, Enter, Esc, Tab).
  (func $handle_ToAsciiEx
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $vk i32) (local $ks i32) (local $out i32) (local $shift i32) (local $ch i32)
    (local.set $vk (local.get $arg0))
    (local.set $ks (call $g2w (local.get $arg2)))
    (local.set $out (call $g2w (local.get $arg3)))
    (local.set $shift (i32.and (i32.load8_u (i32.add (local.get $ks) (i32.const 0x10))) (i32.const 0x80)))
    (local.set $ch (i32.const 0))
    ;; A-Z (0x41-0x5A): lowercase unless Shift held
    (if (i32.and (i32.ge_u (local.get $vk) (i32.const 0x41)) (i32.le_u (local.get $vk) (i32.const 0x5A)))
      (then (local.set $ch
        (select (local.get $vk) (i32.add (local.get $vk) (i32.const 0x20)) (local.get $shift)))))
    ;; 0-9 (0x30-0x39): direct ASCII when no Shift; ignored with Shift here.
    (if (i32.eqz (local.get $ch))
      (then (if (i32.and (i32.ge_u (local.get $vk) (i32.const 0x30)) (i32.le_u (local.get $vk) (i32.const 0x39)))
        (then (if (i32.eqz (local.get $shift))
          (then (local.set $ch (local.get $vk))))))))
    ;; Space=0x20, Enter=0x0D, Esc=0x1B, Tab=0x09, Back=0x08
    (if (i32.eqz (local.get $ch))
      (then
        (if (i32.eq (local.get $vk) (i32.const 0x20)) (then (local.set $ch (i32.const 0x20))))
        (if (i32.eq (local.get $vk) (i32.const 0x0D)) (then (local.set $ch (i32.const 0x0D))))
        (if (i32.eq (local.get $vk) (i32.const 0x1B)) (then (local.set $ch (i32.const 0x1B))))
        (if (i32.eq (local.get $vk) (i32.const 0x09)) (then (local.set $ch (i32.const 0x09))))
        (if (i32.eq (local.get $vk) (i32.const 0x08)) (then (local.set $ch (i32.const 0x08))))))
    (if (local.get $ch)
      (then
        (i32.store16 (local.get $out) (local.get $ch))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1)))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
  )

  ;; ToAscii(uVirtKey, uScanCode, lpKeyState, lpChar, uFlags) → int.
  ;; The non-Ex entry point uses the same current keyboard layout and output
  ;; contract. Delegate to the tested translator, then correct its six-argument
  ;; stdcall pop to this API's five-argument frame.
  (func $handle_ToAscii
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_ToAsciiEx
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  ;; ToUnicode(uVirtKey, uScanCode, lpKeyState, pwszBuff, cchBuff, wFlags).
  ;; The supported US-layout subset is identical to ToAsciiEx's and that
  ;; implementation already writes a UTF-16 code unit. The sixth argument has
  ;; different meaning (flags rather than HKL), but neither path consumes it.
  (func $handle_ToUnicode
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.or (i32.eqz (local.get $arg3)) (i32.le_s (local.get $arg4) (i32.const 0)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
        (return)))
    (call $handle_ToAsciiEx
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; GetKeyboardState(LPBYTE lpKeyState[256]) → BOOL — 1 arg stdcall.
  ;; SDL polls this every frame to build its keyboard snapshot. Snapshot the
  ;; complete table in one host call: in a guest Worker, calling the scalar
  ;; get_key_down_state import 256 times parked and woke the Worker 256 times.
  ;; The host still uses the non-consuming physical/down-state view, preserving
  ;; GetAsyncKeyState's separate one-shot low press bit.
  (func $handle_GetKeyboardState (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_get_keyboard_state (call $g2w (local.get $arg0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; SetKeyboardState(LPBYTE lpKeyState[256]) → BOOL — 1 arg stdcall.
  ;; Only the high bit of each entry contributes to our modeled down state;
  ;; toggle bits remain intentionally unmodeled. The host setter updates the
  ;; same async-key backing consumed by subsequent keyboard-state queries.
  (func $handle_SetKeyboardState (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $state i32) (local $i i32)
    (if (i32.eqz (local.get $arg0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (local.set $state (call $g2w_affine_span (local.get $arg0) (i32.const 256)))
    (if (i32.eq (local.get $state) (global.get $NULL_SENTINEL))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (block $done (loop $keys
      (br_if $done (i32.ge_u (local.get $i) (i32.const 256)))
      (call $host_set_key_down_state (local.get $i)
        (i32.and (i32.load8_u (i32.add (local.get $state) (local.get $i)))
                 (i32.const 0x80)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $keys)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; AttachThreadInput(idAttach, idAttachTo, fAttach) is deliberately not
  ;; modeled yet: input queues remain per emulated thread. Resolve the import
  ;; and fail honestly so callers that treat attachment as optional (including
  ;; UT2003's viewport setup) can continue without a fatal unknown API.
  (func $handle_AttachThreadInput (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; 303: GetParent — STUB: unimplemented
  ;; GetParent(hwnd) — 1 arg stdcall, return parent hwnd or 0
  (func $handle_GetParent (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $wnd_get_parent_api (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; GetAncestor(hWnd, gaFlags). Unlike GetParent, GA_PARENT never substitutes
  ;; a top-level popup's owner. GA_ROOTOWNER first reaches the child root, then
  ;; follows each owner and that owner's child root.
  (func $handle_GetAncestor (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $walk i32) (local $next i32) (local $guard i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (if (i32.lt_s (call $wnd_table_find (local.get $arg0)) (i32.const 0))
      (then
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    ;; GA_PARENT = 1.
    (if (i32.eq (local.get $arg1) (i32.const 1))
      (then
        (i32.store offset=0 (global.get $reg_base) (call $wnd_get_parent (local.get $arg0)))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (if (i32.or
          (i32.eq (local.get $arg1) (i32.const 2))  ;; GA_ROOT
          (i32.eq (local.get $arg1) (i32.const 3))) ;; GA_ROOTOWNER
      (then
        (local.set $walk (local.get $arg0))
        (block $parents_done (loop $parents
          (local.set $next (call $wnd_get_parent (local.get $walk)))
          (br_if $parents_done (i32.eqz (local.get $next)))
          (local.set $walk (local.get $next))
          (local.set $guard (i32.add (local.get $guard) (i32.const 1)))
          (br_if $parents_done (i32.ge_u (local.get $guard) (global.get $MAX_WINDOWS)))
          (br $parents)))
        ;; GA_ROOTOWNER = 3. An owner's root may itself be a child in a
        ;; malformed table, so apply the same bounded parent walk each time.
        (if (i32.eq (local.get $arg1) (i32.const 3))
          (then
            (block $owners_done (loop $owners
              (local.set $next (call $wnd_get_owner (local.get $walk)))
              (br_if $owners_done (i32.eqz (local.get $next)))
              (local.set $walk (local.get $next))
              (block $owner_parents_done (loop $owner_parents
                (local.set $next (call $wnd_get_parent (local.get $walk)))
                (br_if $owner_parents_done (i32.eqz (local.get $next)))
                (local.set $walk (local.get $next))
                (local.set $guard (i32.add (local.get $guard) (i32.const 1)))
                (br_if $owner_parents_done
                  (i32.ge_u (local.get $guard) (global.get $MAX_WINDOWS)))
                (br $owner_parents)))
              (local.set $guard (i32.add (local.get $guard) (i32.const 1)))
              (br_if $owners_done (i32.ge_u (local.get $guard) (global.get $MAX_WINDOWS)))
              (br $owners)))))
        (i32.store offset=0 (global.get $reg_base) (local.get $walk))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 304: GetWindow(hWnd, uCmd) — 2 args stdcall.
  ;; Prefer WAT's per-instance window table, then fall back to the JS renderer's
  ;; full window list so cross-instance top-level/dialog relationships are still
  ;; visible to apps walking USER z-order.
  (func $handle_GetWindow (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $parent i32) (local $known i32)
    (local.set $known
      (i32.ne (call $wnd_table_find (local.get $arg0)) (i32.const -1)))
    ;; GW_HWNDFIRST(0) / GW_HWNDLAST(1): first/last sibling at same parent.
    (if (i32.eq (local.get $arg1) (i32.const 0))
      (then
        (local.set $parent (call $wnd_get_parent (local.get $arg0)))
        ;; The renderer owns the combined top-level z-order across app
        ;; instances. WAT remains authoritative for local child siblings.
        (i32.store offset=0 (global.get $reg_base) (if (result i32) (i32.eqz (local.get $parent))
            (then (call $host_get_window_related (local.get $arg0) (local.get $arg1)))
            (else (call $wnd_find_first_child (local.get $parent)))))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (if (i32.eq (local.get $arg1) (i32.const 1))
      (then
        (local.set $parent (call $wnd_get_parent (local.get $arg0)))
        (i32.store offset=0 (global.get $reg_base) (if (result i32) (i32.eqz (local.get $parent))
            (then (call $host_get_window_related (local.get $arg0) (local.get $arg1)))
            (else (call $wnd_find_last_child (local.get $parent)))))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    ;; GW_HWNDNEXT = 2
    (if (i32.eq (local.get $arg1) (i32.const 2))
      (then
        (local.set $parent (call $wnd_get_parent (local.get $arg0)))
        (i32.store offset=0 (global.get $reg_base) (if (result i32) (i32.eqz (local.get $parent))
            (then (call $host_get_window_related (local.get $arg0) (local.get $arg1)))
            (else (call $wnd_find_next_sibling (local.get $arg0)))))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    ;; GW_HWNDPREV = 3
    (if (i32.eq (local.get $arg1) (i32.const 3))
      (then
        (local.set $parent (call $wnd_get_parent (local.get $arg0)))
        (i32.store offset=0 (global.get $reg_base) (if (result i32) (i32.eqz (local.get $parent))
            (then (call $host_get_window_related (local.get $arg0) (local.get $arg1)))
            (else (call $wnd_find_prev_sibling (local.get $arg0)))))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    ;; GW_OWNER = 4 → return owner hwnd, not child geometry parent.
    (if (i32.eq (local.get $arg1) (i32.const 4))
      (then
        (i32.store offset=0 (global.get $reg_base) (call $wnd_get_owner (local.get $arg0)))
        (if (i32.and (i32.eqz (i32.load offset=0 (global.get $reg_base))) (i32.eqz (local.get $known)))
          (then (i32.store offset=0 (global.get $reg_base) (call $host_get_window_related (local.get $arg0) (local.get $arg1)))))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    ;; GW_CHILD = 5 → first child of hwnd
    (if (i32.eq (local.get $arg1) (i32.const 5))
      (then
        (i32.store offset=0 (global.get $reg_base) (call $wnd_find_first_child (local.get $arg0)))
        (if (i32.and (i32.eqz (i32.load offset=0 (global.get $reg_base))) (i32.eqz (local.get $known)))
          (then (i32.store offset=0 (global.get $reg_base) (call $host_get_window_related (local.get $arg0) (local.get $arg1)))))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    ;; GW_ENABLEDPOPUP = 6 → enabled visible popup owned by hwnd, or hwnd itself.
    (if (i32.eq (local.get $arg1) (i32.const 6))
      (then
        (i32.store offset=0 (global.get $reg_base) (call $host_get_window_related (local.get $arg0) (local.get $arg1)))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))  ;; stdcall, 2 args
  )

  ;; IsWindow(hwnd) → BOOL. Desktop has no WND_RECORDS slot, and windows owned
  ;; by another process exist only in the shared renderer window registry.
  ;; A value merely resembling the 0x10000+ handle range is not sufficient:
  ;; HWND_BROADCAST (-1) is unsigned-greater than 0x10000, and treating it as a
  ;; window leaves old InstallShield splash pumps waiting for it forever.
  (func $handle_IsWindow (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $window_handle_valid (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; IsWindowUnicode(hwnd) reflects whether the HWND was created through a W
  ;; entry point. Native common controls use this to choose A/W message layouts.
  (func $handle_IsWindowUnicode (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $wnd_unicode_get (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; Describe a system control class to an app that asked about it.
  ;;
  ;; Neither VCL nor MFC creates a BUTTON window directly. They call
  ;; GetClassInfo on the system class, keep its lpfnWndProc, register their own
  ;; class name (TButton, Afx:...) with their own wndproc, and chain whatever
  ;; they do not handle back to the proc they kept. Painting is one of the
  ;; things they do not handle. Returning FALSE here sends VCL down its
  ;; DefWindowProc fallback, and the control is then painted by nobody.
  ;;
  ;; The wndproc handed out is a marker carrying the class id, because by the
  ;; time it is called back the window's own class name is the app's, not
  ;; USER's — the marker is the only remaining link to what it started as.
  ;; $name_key is the class key ($class_name_key for A, $class_wide_name_key
  ;; for W): an atom, or the WASM address of the name. $name_guest is what the
  ;; caller passed, and is echoed back as lpszClassName.
  (func $system_class_describe (param $name_key i32) (param $name_guest i32)
        (param $out_guest i32) (param $hinstance i32) (result i32)
    (local $class i32) (local $out i32)
    ;; Both spellings resolve here. USER classes also accept atoms, while the
    ;; implemented common-control classes registered by InitCommonControls are
    ;; string-only; both expose the existing WAT wndproc markers.
    (local.set $class (call $builtin_ctrl_class_id_key (local.get $name_key)))
    ;; RICHEDIT is a predefined system class after RICHED32 has initialized,
    ;; just like EDIT from the caller's point of view. Unreal's Window.dll
    ;; queries it with a NULL instance before registering a superclass. The
    ;; browser already implements both Win9x RichEdit generations; make their
    ;; class metadata discoverable through the same WNDPROC marker contract.
    (if (i32.and (i32.eqz (local.get $class))
                 (i32.ge_u (local.get $name_key) (i32.const 0x10000)))
      (then
        (local.set $class (call $richedit_class_version_key (local.get $name_key)))
        (if (i32.eq (local.get $class) (i32.const 1))
          (then (local.set $class (i32.const 24)))
          (else
            (if (i32.eq (local.get $class) (i32.const 2))
              (then (local.set $class (i32.const 25))))))))
    ;; COMCTL window classes are not predefined system classes. Its DllMain
    ;; probes them with its own HINSTANCE before registering the native
    ;; wndprocs, so fabricating a hit there makes the DLL skip registration.
    ;; A NULL instance is the documented system-class query and remains the
    ;; browser/WAT fallback when no native class record exists.
    (if (i32.and
          (i32.and (i32.eqz (local.get $class))
                   (i32.ge_u (local.get $name_key) (i32.const 0x10000)))
          (i32.eqz (local.get $hinstance)))
      (then
        (local.set $class (call $comctl_class_ctrl_id (local.get $name_key)))))
    (if (i32.eqz (local.get $class)) (then (return (i32.const 0))))
    (local.set $out (call $g2w (local.get $out_guest)))
    ;; CS_VREDRAW|CS_HREDRAW|CS_DBLCLKS|CS_GLOBALCLASS, as USER registers these.
    ;; VCL masks the DC bits off and forces CS_PARENTDC regardless of what it is
    ;; told. CS_GLOBALCLASS is what makes them visible to every process, which
    ;; is precisely the property an app is confirming when it asks.
    (i32.store (local.get $out) (i32.const 0x400B))
    (i32.store offset=4 (local.get $out)
      (i32.or (global.get $WNDPROC_SYSCLASS) (local.get $class)))
    (i32.store offset=8 (local.get $out) (i32.const 0))   ;; cbClsExtra
    (i32.store offset=12 (local.get $out) (i32.const 0))  ;; cbWndExtra
    (i32.store offset=16 (local.get $out) (local.get $hinstance))
    (i32.store offset=20 (local.get $out) (i32.const 0))  ;; hIcon
    (i32.store offset=24 (local.get $out) (i32.const 0))  ;; hCursor
    (i32.store offset=28 (local.get $out) (i32.const 0))  ;; hbrBackground
    (i32.store offset=32 (local.get $out) (i32.const 0))  ;; lpszMenuName
    (i32.store offset=36 (local.get $out) (local.get $name_guest))
    (i32.const 1))

  (func $handle_GetClassInfoA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; GetClassInfoA(hInstance, lpClassName, lpWndClass) → BOOL
    ;; Look up class in our class table; if found, copy saved WNDCLASS to output
    (local $slot i32) (local $src i32)
    (local.set $slot (call $class_find_slot (call $g2w (local.get $arg1))))
    (if (i32.ge_s (local.get $slot) (i32.const 0))
      (then
        ;; Found — copy 40-byte WNDCLASS from class record to output buffer
        (local.set $src (call $class_wndclass_addr (local.get $slot)))
        (call $memcpy (call $g2w (local.get $arg2)) (local.get $src) (i32.const 40))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    ;; Not one of the app's own classes — it may be one of USER's.
    (if (call $system_class_describe
          (call $class_name_key (local.get $arg1))
          (local.get $arg1) (local.get $arg2) (local.get $arg0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    ;; Not found — return FALSE
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 306: GetClassInfoW(hInstance, lpClassName, lpWndClass)
  (func $handle_GetClassInfoW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $slot i32) (local $src i32) (local $key i32)
    (local.set $key (call $class_wide_name_key (local.get $arg1)))
    (local.set $slot (call $class_find_slot (local.get $key)))
    (if (i32.ge_s (local.get $slot) (i32.const 0))
      (then
        (local.set $src (call $class_wndclass_addr (local.get $slot)))
        (call $memcpy (call $g2w (local.get $arg2)) (local.get $src) (i32.const 40))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    ;; USER's own classes answer the W entry point too. Before this, an app that
    ;; asked for L"BUTTON" was told no such class exists, which is the same
    ;; DefWindowProc fallback $system_class_describe was written to prevent --
    ;; it just could not be reached from here.
    (if (call $system_class_describe
          (local.get $key) (local.get $arg1) (local.get $arg2) (local.get $arg0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; GetClassInfoExA/W expose the same saved class data with cbSize prepended
  ;; and hIconSm appended. $wide selects the class-name lookup spelling.
  (func $get_class_info_ex (param $hinstance i32) (param $name_guest i32)
                           (param $out_guest i32) (param $wide i32) (result i32)
    (local $key i32) (local $slot i32) (local $src i32) (local $out i32)
    (if (i32.or (i32.eqz (local.get $name_guest)) (i32.eqz (local.get $out_guest)))
      (then (return (i32.const 0))))
    (local.set $key
      (if (result i32) (local.get $wide)
        (then (call $class_wide_name_key (local.get $name_guest)))
        (else (call $class_name_key (local.get $name_guest)))))
    (local.set $slot (call $class_find_slot (local.get $key)))
    (local.set $out (call $g2w (local.get $out_guest)))
    (if (i32.ge_s (local.get $slot) (i32.const 0))
      (then
        (local.set $src (call $class_wndclass_addr (local.get $slot)))
        (call $memcpy (i32.add (local.get $out) (i32.const 4))
          (local.get $src) (i32.const 40)))
      (else
        (if (i32.eqz (call $system_class_describe
              (local.get $key) (local.get $name_guest)
              (i32.add (local.get $out_guest) (i32.const 4)) (local.get $hinstance)))
          (then (return (i32.const 0))))))
    (i32.store (local.get $out) (i32.const 48))
    ;; WNDCLASSEX.hIcon is at +24 after the four-byte cbSize prefix.
    (i32.store offset=44 (local.get $out) (i32.load offset=24 (local.get $out)))
    (i32.const 1))

  (func $handle_GetClassInfoExA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $get_class_info_ex
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_GetClassInfoExW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $get_class_info_ex
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; 307: SetWindowLongW — STUB: unimplemented, return 0 (previous value)
  ;; SetWindowLongW — same as A for non-string indices
  (func $handle_SetWindowLongW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_SetWindowLongA (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; 308: GetWindowLongW — STUB: unimplemented, return 0
  ;; GetWindowLongW — same as A for non-string indices
  (func $handle_GetWindowLongW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_GetWindowLongA (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  (func $handle_PathRemoveFileSpecW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $path_remove_file_spec (local.get $arg0) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; Set/GetClassLongW — same scalar indices as A; class string fields are not
  ;; modeled by the current lightweight class table.
  (func $handle_SetClassLongW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_SetClassLongA
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  (func $handle_GetClassLongW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_GetClassLongA
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; Find the authentic mapped COMCTL32 export, not the native IAT override.
  ;; The DLL table is process-shared while dll_count is synchronized into each
  ;; worker instance, so resolving on the rare initialization call is safer
  ;; than caching a guest address in a per-instance mutable global.
  (func $guest_comctl32_init_common_controls_ex (result i32)
    (local $idx i32) (local $tbl i32) (local $base i32)
    (local $exp_rva i32) (local $name_rva i32)
    (block $missing (loop $scan
      (br_if $missing (i32.ge_u (local.get $idx) (global.get $dll_count)))
      (local.set $tbl (i32.add (global.get $DLL_TABLE)
        (i32.mul (local.get $idx) (i32.const 32))))
      (local.set $base (i32.load (local.get $tbl)))
      (local.set $exp_rva (i32.load offset=8 (local.get $tbl)))
      (if (local.get $exp_rva)
        (then
          (local.set $name_rva (i32.load offset=12
            (call $g2w (i32.add (local.get $base) (local.get $exp_rva)))))
          (if (i32.and
                (i32.ne (local.get $name_rva) (i32.const 0))
                (call $dll_name_match
                  (i32.add (local.get $base) (local.get $name_rva))
                  "COMCTL32.dll"))
            (then
              (return (call $resolve_name_export
                (local.get $idx) "InitCommonControlsEx"))))))
      (local.set $idx (i32.add (local.get $idx) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  ;; 309: InitCommonControlsEx(lpInitCtrls). Authentic Win98 COMCTL32 must see
  ;; the flags it supports so its optional classes are actually registered.
  ;; WAT supplies only the later ICC_LINK_CLASS compatibility gap. Microsoft
  ;; documents the initialization as cumulative, so a mixed request first
  ;; runs the authentic legacy half and then returns its exact BOOL result.
  (func $handle_InitCommonControlsEx (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $flags i32) (local $guest i32) (local $caller_esp i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (if (i32.eqz (local.get $arg0))
      (then
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (if (i32.ne (call $gl32 (local.get $arg0)) (i32.const 8))
      (then
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (local.set $flags (call $gl32 (i32.add (local.get $arg0) (i32.const 4))))
    ;; The documented ICC_* namespace occupies the low 16 bits. Do not claim
    ;; that an unknown newer class was registered when neither backend did it.
    (if (i32.and (local.get $flags) (i32.const 0xffff0000))
      (then
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (local.set $guest (call $guest_comctl32_init_common_controls_ex))
    ;; Without a mapped authentic DLL, retain the existing native common-
    ;; control compatibility path. Built-in controls need no guest registration.
    (if (i32.eqz (local.get $guest))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    ;; Pure Win98-era requests run in authentic COMCTL32 with the caller's
    ;; original stdcall frame. Its RET 4 returns straight to the API caller.
    (if (i32.eqz (i32.and (local.get $flags) (i32.const 0x8000)))
      (then
        (global.set $eip (local.get $guest))
        (global.set $handler_set_eip (i32.const 1))
        (global.set $steps (i32.const 0))
        (return)))
    ;; ICC_LINK_CLASS alone is implemented by the WAT SysLink control. Passing
    ;; it to authentic Win98 COMCTL32 would make the compatibility call fail.
    (if (i32.eqz (i32.and (local.get $flags) (i32.const 0x7fff)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    ;; Mixed LINK|legacy request. Keep the caller-owned structure untouched;
    ;; place a masked copy and typed continuation between this call frame and
    ;; the authentic callee. After its RET 4, CACA0011 sees ICCT at ESP.
    (local.set $caller_esp (i32.load offset=16 (global.get $reg_base)))
    (call $gs32 (i32.sub (local.get $caller_esp) (i32.const 20))
      (global.get $font_enum_ret_thunk))
    (call $gs32 (i32.sub (local.get $caller_esp) (i32.const 16))
      (i32.sub (local.get $caller_esp) (i32.const 8)))
    (call $gs32 (i32.sub (local.get $caller_esp) (i32.const 12))
      (i32.const 0x54434349)) ;; "ICCT"
    (call $gs32 (i32.sub (local.get $caller_esp) (i32.const 8)) (i32.const 8))
    (call $gs32 (i32.sub (local.get $caller_esp) (i32.const 4))
      (i32.and (local.get $flags) (i32.const 0x7fff)))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (local.get $caller_esp) (i32.const 20)))
    (global.set $eip (local.get $guest))
    (global.set $handler_set_eip (i32.const 1))
    (global.set $steps (i32.const 0))
  )

  ;; OleInitialize lives with the other COM/OLE apartment handlers in
  ;; 09a7b-ole.wat. The old fixed-S_OK duplicate here was dead after WATX name
  ;; resolution and made the silent-stub inventory count one API twice.
  ;; Keeping one definition also makes the handler table's name resolve to one
  ;; implementation instead of depending on source-order shadowing.

  ;; 311: CoTaskMemFree(pv) — 1 arg stdcall, free via heap_free
  (func $handle_CoTaskMemFree (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg0)
      (then (call $heap_free (local.get $arg0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

nW — STUB: unimplemented
  (func $handle_lstrlenW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $lstr_len (local.get $arg0) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 321: lstrcpyW
  (func $handle_lstrcpyW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lstr_cpy (local.get $arg0) (local.get $arg1) (i32.const 1))
    (i32.store offset=0 (global.get $reg_base) (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))) (return)
  )

  ;; 322: lstrcmpW(lpString1, lpString2) → int
  (func $handle_lstrcmpW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $lstr_cmp (local.get $arg0) (local.get $arg1) (i32.const 1) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; 323: lstrcmpiW(lpString1, lpString2) → int, ASCII case-insensitive
  (func $handle_lstrcmpiW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $lstr_cmp (local.get $arg0) (local.get $arg1) (i32.const 1) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 324: CharNextW — advance by one wide char
  (func $handle_CharNextW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $char_next (local.get $arg0) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))) (return)
  )

  ;; CharPrevW(lpszStart, lpszCurrent) — step back one UTF-16 code unit.
  (func $handle_CharPrevW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $char_prev (local.get $arg0) (local.get $arg1) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))) (return)
  )

  ;; 325: wsprintfW — wide sprintf (cdecl, caller cleans up)
  ;; wsprintfW(buf, fmt, ...) — cdecl; varargs at guest esp+12 (after ret + buf + fmt)
  (func $handle_wsprintfW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; wsprintf_impl_w treats out/fmt/arg_ptr all as guest addresses (uses gl16/gl32 internally)
    (i32.store offset=0 (global.get $reg_base) (call $wsprintf_impl_w
      (local.get $arg0)
      (local.get $arg1)
      (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))
    ;; cdecl: only pop return address
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  ;; TLS state is process-shared; no host calls or allocation occur under this
  ;; lock. Bitmap changes, vector publication and API reads/writes serialize.
  (func $tls_lock
    (loop $retry
      (br_if $retry (i32.atomic.rmw.cmpxchg offset=4
        (global.get $TLS_NEXT_INDEX_SHARED) (i32.const 0) (i32.const 1)))))
  (func $tls_unlock
    (i32.atomic.store offset=4 (global.get $TLS_NEXT_INDEX_SHARED) (i32.const 0)))
  (func $tls_bitmap_word (param $index i32) (result i32)
    (i32.add (global.get $TLS_NEXT_INDEX_SHARED)
      (i32.add (i32.const 12) (i32.shl (i32.shr_u (local.get $index) (i32.const 5)) (i32.const 2)))))
  ;; Caller holds TLS lock. Vectors are process-lifetime allocations, as before;
  ;; clearing never frees the application-owned values stored in their slots.
  (func $tls_clear_index (param $index i32)
    (local $node i32) (local $vector i32)
    (local.set $node (i32.load offset=8 (global.get $TLS_NEXT_INDEX_SHARED)))
    (block $done (loop $next
      (br_if $done (i32.eqz (local.get $node)))
      (local.set $vector (call $gl32 (i32.add (local.get $node) (i32.const 4))))
      (if (local.get $vector)
        (then (call $gs32 (i32.add (local.get $vector) (i32.shl (local.get $index) (i32.const 2))) (i32.const 0))))
      (local.set $node (call $gl32 (local.get $node)))
      (br $next))))
  (func $tls_attach_slots (param $vector i32) (result i32)
    (local $node i32)
    (if (i32.eqz (global.get $tls_registry_node))
      (then
        (local.set $node (call $heap_alloc (i32.const 8)))
        (if (i32.eqz (local.get $node)) (then (return (i32.const 0))))))
    (call $tls_lock)
    (if (local.get $node)
      (then
        (call $gs32 (local.get $node) (i32.load offset=8 (global.get $TLS_NEXT_INDEX_SHARED)))
        (i32.store offset=8 (global.get $TLS_NEXT_INDEX_SHARED) (local.get $node))
        (global.set $tls_registry_node (local.get $node))))
    (call $gs32 (i32.add (global.get $tls_registry_node) (i32.const 4)) (local.get $vector))
    (global.set $tls_slots (local.get $vector))
    (call $tls_unlock)
    (i32.const 1))
  (func $tls_ensure_slots (result i32)
    (local $vector i32)
    (if (global.get $tls_slots) (then (return (global.get $tls_slots))))
    (local.set $vector (call $heap_alloc (i32.shl (global.get $TLS_SLOT_COUNT) (i32.const 2))))
    (if (i32.eqz (local.get $vector)) (then (return (i32.const 0))))
    (call $zero_memory (call $g2w (local.get $vector)) (i32.shl (global.get $TLS_SLOT_COUNT) (i32.const 2)))
    (if (i32.eqz (call $tls_attach_slots (local.get $vector)))
      (then (call $heap_free (local.get $vector)) (return (i32.const 0))))
    (local.get $vector))
  (func $tls_reserve (result i32)
    (local $index i32) (local $word i32) (local $mask i32)
    (call $tls_lock)
    (block $full (loop $scan
      (br_if $full (i32.ge_u (local.get $index) (global.get $TLS_SLOT_COUNT)))
      (local.set $word (call $tls_bitmap_word (local.get $index)))
      (local.set $mask (i32.shl (i32.const 1) (local.get $index)))
      (if (i32.eqz (i32.and (i32.load (local.get $word)) (local.get $mask)))
        (then
          (call $tls_clear_index (local.get $index))
          (i32.store (local.get $word) (i32.or (i32.load (local.get $word)) (local.get $mask)))
          (if (i32.ge_u (local.get $index) (i32.atomic.load (global.get $TLS_NEXT_INDEX_SHARED)))
            (then (i32.atomic.store (global.get $TLS_NEXT_INDEX_SHARED) (i32.add (local.get $index) (i32.const 1)))))
          (call $tls_unlock)
          (return (local.get $index))))
      (local.set $index (i32.add (local.get $index) (i32.const 1)))
      (br $scan)))
    (call $tls_unlock)
    (i32.const -1))
  (func $tls_release_index (param $index i32) (result i32)
    (local $word i32) (local $mask i32)
    (if (i32.ge_u (local.get $index) (global.get $TLS_SLOT_COUNT)) (then (return (i32.const 0))))
    (local.set $word (call $tls_bitmap_word (local.get $index)))
    (local.set $mask (i32.shl (i32.const 1) (local.get $index)))
    (call $tls_lock)
    (if (i32.eqz (i32.and (i32.load (local.get $word)) (local.get $mask)))
      (then (call $tls_unlock) (return (i32.const 0))))
    (call $tls_clear_index (local.get $index))
    (i32.store (local.get $word) (i32.and (i32.load (local.get $word)) (i32.xor (local.get $mask) (i32.const -1))))
    (call $tls_unlock)
    (i32.const 1))
  ;; Compatibility spawn metadata is a high-water mark, not the current used
  ;; set. Never reserve a freed hole merely because a stale snapshot arrives.
  (func $tls_publish_minimum (param $minimum i32)
    (local $index i32) (local $word i32)
    (if (i32.gt_u (local.get $minimum) (global.get $TLS_SLOT_COUNT))
      (then (local.set $minimum (global.get $TLS_SLOT_COUNT))))
    (call $tls_lock)
    (local.set $index (i32.atomic.load (global.get $TLS_NEXT_INDEX_SHARED)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $index) (local.get $minimum)))
      (local.set $word (call $tls_bitmap_word (local.get $index)))
      (i32.store (local.get $word) (i32.or (i32.load (local.get $word)) (i32.shl (i32.const 1) (local.get $index))))
      (local.set $index (i32.add (local.get $index) (i32.const 1)))
      (br $scan)))
    (i32.atomic.store (global.get $TLS_NEXT_INDEX_SHARED) (local.get $index))
    (call $tls_unlock))

  ;; 326: TlsAlloc — reserve a reusable process index, with a per-thread vector.
  (func $handle_TlsAlloc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $index i32)
    (if (i32.eqz (call $tls_ensure_slots))
      (then
        (global.set $last_error (i32.const 8))
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (return)))
    (local.set $index (call $tls_reserve))
    (if (i32.eq (local.get $index) (i32.const -1))
      (then
        (global.set $last_error (i32.const 259))
        (i32.store offset=0 (global.get $reg_base) (i32.const -1)) ;; TLS_OUT_OF_INDEXES
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (return)))
    (i32.store offset=0 (global.get $reg_base) (local.get $index))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))) (return)
  )

  ;; 327: TlsGetValue(index)
  (func $handle_TlsGetValue (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.ge_u (local.get $arg0) (global.get $TLS_SLOT_COUNT))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (if (i32.eqz (global.get $tls_slots))
      (then
        (global.set $last_error (i32.const 0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (call $tls_lock)
    (i32.store offset=0 (global.get $reg_base) (call $gl32 (i32.add (global.get $tls_slots) (i32.shl (local.get $arg0) (i32.const 2)))))
    (call $tls_unlock)
    (global.set $last_error (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))) (return)
  )

  ;; 328: TlsSetValue(index, value)
  (func $handle_TlsSetValue (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.ge_u (local.get $arg0) (global.get $TLS_SLOT_COUNT))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (if (i32.eqz (call $tls_ensure_slots))
      (then
        (global.set $last_error (i32.const 8))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (call $tls_lock)
    (call $gs32 (i32.add (global.get $tls_slots) (i32.shl (local.get $arg0) (i32.const 2))) (local.get $arg1))
    (call $tls_unlock)
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))) (return)
  )

  ;; 329: TlsFree(index) — clear all vectors and return the index to the bitmap.
  (func $handle_TlsFree (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (call $tls_release_index (local.get $arg0)))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; CRITICAL_SECTION: +0=DebugInfo, +4=LockCount, +8=RecursionCount,
  ;; +0C=OwningThread, +10=LockSemaphore, +14=SpinCount.
  (func $critical_section_init (param $arg0 i32) (param $spin i32)
    (local $cs i32)
    (local.set $cs (call $g2w (local.get $arg0)))
    ;; Zero the struct then set LockCount = -1 (unlocked)
    (i32.store (local.get $cs) (i32.const 0))            ;; DebugInfo
    (i32.store offset=4 (local.get $cs) (i32.const -1))  ;; LockCount = -1 (unlocked)
    (i32.store offset=8 (local.get $cs) (i32.const 0))   ;; RecursionCount
    (i32.store offset=12 (local.get $cs) (i32.const 0))  ;; OwningThread
    (i32.store offset=16 (local.get $cs) (i32.const 0))  ;; LockSemaphore
    (i32.store offset=20 (local.get $cs) (local.get $spin)) ;; SpinCount
    ;; The only place a section is legitimately born, so the only place worth
    ;; recording it. See $cs_release_owned.
    (call $cs_register (local.get $cs)))

  ;; 330: InitializeCriticalSection(lpCriticalSection)
  (func $handle_InitializeCriticalSection (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $critical_section_init (local.get $arg0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; InitializeCriticalSectionAndSpinCount(lpCriticalSection, dwSpinCount).
  ;; Uniprocessor Windows may ignore the requested spin count, but retaining it
  ;; is observable through the public structure and costs nothing here.
  (func $handle_InitializeCriticalSectionAndSpinCount (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $critical_section_init (local.get $arg0) (local.get $arg1))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; ---- the section registry -------------------------------------------------
  ;;
  ;; A section held by a thread that has ended is not held, it is LOST, and every
  ;; waiter then parks forever. Windows has the same hazard and no answer for it;
  ;; we do have one, because we know exactly when a guest thread ends — including
  ;; when it ends by trapping, which no guest can clean up after.
  ;;
  ;; This replaces taking a section by force after a timeout. That guessed from
  ;; elapsed rounds and rewrote the counters under a live owner, which corrupted
  ;; the very data the section protected. Releasing at exit fires when the owner
  ;; is *known* to be gone.

  ;; Slot address for index i.
  (func $cs_slot (param $i i32) (result i32)
    (i32.add (global.get $CS_TABLE) (i32.mul (local.get $i) (i32.const 4))))

  ;; Remember this section (WASM address). Idempotent, and safe against two
  ;; threads initialising sections at the same time — the slot is claimed with a
  ;; CAS rather than a load-then-store.
  (func $cs_register (param $cs i32)
    (local $i i32) (local $slot i32) (local $cur i32)
    (block $done
      (loop $scan
        (br_if $done (i32.ge_u (local.get $i) (global.get $CS_TABLE_ENTRIES)))
        (local.set $slot (call $cs_slot (local.get $i)))
        (local.set $cur (i32.atomic.load (local.get $slot)))
        (br_if $done (i32.eq (local.get $cur) (local.get $cs)))   ;; already known
        (if (i32.eqz (local.get $cur))
          (then
            ;; Won the slot? Done. Lost it to another thread? Keep scanning.
            (br_if $done (i32.eqz (i32.atomic.rmw.cmpxchg
              (local.get $slot) (i32.const 0) (local.get $cs))))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $scan))))

  (func $cs_unregister (param $cs i32)
    (local $i i32) (local $slot i32)
    (block $done
      (loop $scan
        (br_if $done (i32.ge_u (local.get $i) (global.get $CS_TABLE_ENTRIES)))
        (local.set $slot (call $cs_slot (local.get $i)))
        (if (i32.eq (i32.atomic.load (local.get $slot)) (local.get $cs))
          (then
            (i32.atomic.store (local.get $slot) (i32.const 0))
            (br $done)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $scan))))

  ;; Release every registered section owned by $owner ($current_thread_id of the
  ;; thread that has ended — main is 1, a spawned thread is tid+1). Returns how
  ;; many were released, which is never routine: a nonzero answer means a thread
  ;; ended inside a section, and callers report it.
  (func $cs_release_owned (param $owner i32) (result i32)
    (local $i i32) (local $cs i32) (local $n i32)
    (block $done
      (loop $scan
        (br_if $done (i32.ge_u (local.get $i) (global.get $CS_TABLE_ENTRIES)))
        (local.set $cs (i32.atomic.load (call $cs_slot (local.get $i))))
        (if (local.get $cs)
          (then
            (call $cs_unaligned_lock (local.get $cs))
            (if (i32.eq (i32.load offset=12 (local.get $cs)) (local.get $owner))
              (then
                ;; Counters first, owner last — the same publish-last order the
                ;; WAT's own locks use, so a thread that sees it free sees the
                ;; counters already settled.
                (i32.store offset=8 (local.get $cs) (i32.const 0))
                (i32.store offset=4 (local.get $cs) (i32.const -1))
                (if (call $cs_owner_aligned (local.get $cs))
                  (then (i32.atomic.store offset=12 (local.get $cs) (i32.const 0)))
                  (else (i32.store offset=12 (local.get $cs) (i32.const 0))))
                (local.set $n (i32.add (local.get $n) (i32.const 1)))))
            (call $cs_unaligned_unlock (local.get $cs))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $scan)))
    (local.get $n))

  ;; Park an EnterCriticalSection that cannot be satisfied yet (reason 9).
  ;;
  ;; It CANNOT spin. The holder is another guest thread that will release the
  ;; section when it next runs, and on the browser's main thread — or the CLI's,
  ;; which both runs guest code and serves the workers' host imports — spinning
  ;; is the deadlock: the holder is parked in Atomics.wait for an import this
  ;; thread would have served. So the whole API call parks the same way a
  ;; blocking socket call does: EIP is still on the thunk, and clearing the yield
  ;; re-enters this handler with the same argument once someone else has had a
  ;; turn.
  ;;
  ;; ESP is deliberately NOT touched: this is called before the handler pops its
  ;; stdcall frame, so the return address and the argument are already where a
  ;; re-entry needs them. (The winsock equivalent subtracts, because those
  ;; handlers pop on entry and have to put it back — the invariant is the same,
  ;; the arithmetic is not. Subtracting here dropped ESP by 8 per park and
  ;; WordPad's thread trapped after three of them.)
  (func $cs_block (param $cs i32) (param $owner i32)
    (global.set $cs_waits (i32.add (global.get $cs_waits) (i32.const 1)))
    ;; The frame is deliberately left on the stack for the re-entry to find, so
    ;; record where it is. If the guest is dispatched anywhere else before it
    ;; comes back, those bytes are lost — see $cs_park_pending.
    (global.set $cs_park_pending (i32.const 1))
    (global.set $cs_park_esp (i32.load offset=16 (global.get $reg_base)))
    (global.set $cs_park_eip (global.get $eip))
    ;; What this thread is parked on, and who had it. "Thread blocked" is not a
    ;; diagnosis; "thread blocked on section X held by thread N" is, and it is the
    ;; difference between guessing at a deadlock and reading it.
    (global.set $cs_wait_addr (local.get $cs))
    (global.set $cs_wait_owner (local.get $owner))
    ;; Opt out of $run's thunk-zone auto-pop. It fires whenever a handler leaves
    ;; EIP alone, yield or no yield, and sets EIP = [ESP] — which splices the call
    ;; out entirely: the guest resumes after it without the section, with the
    ;; argument still on the stack. Four bytes leak per park, and the thread dies
    ;; later at a garbage EIP (0x113, in the browser). Every other re-entering
    ;; thunk raises this for the same reason; see the CACA000x continuations.
    (global.set $handler_set_eip (i32.const 1))
    ;; Re-enter the CALL, not the block. Most API calls are dispatched inline
    ;; from inside a decoded block, where EIP still names that block's first
    ;; instruction — so leaving EIP alone makes the resume re-execute the
    ;; argument pushes and call the API again on top of the frame it already
    ;; left on the stack. Measured on Winamp: ESP 8 bytes lower on the retry,
    ;; and thread 1 later returning into .data at winamp.exe+0x4fe9c.
    (global.set $eip (global.get $current_thunk_eip))
    (global.set $yield_reason (i32.const 9))
    (global.set $yield_flag (i32.const 1))
    (global.set $steps (i32.const 0)))

  ;; 331: EnterCriticalSection(lpCriticalSection)
  ;;
  ;; Real mutual exclusion, because there are real threads now. The old version
  ;; bumped the counters and wrote OwningThread = 1 unconditionally, which is
  ;; survivable when exactly one instance runs at a time and is not a defensible
  ;; basis for anything else: two threads inside one section corrupt whatever it
  ;; was protecting, and the symptom shows up far away as bad data.
  ;;
  ;; OwningThread is the lock word, claimed with a CAS. It holds
  ;; $current_thread_id, which is exactly what GetCurrentThreadId returns —
  ;; guest CRT and MFC lock code reads this field and compares it against that,
  ;; so it has to be the same number and not a private one. 0 means free, and no
  ;; thread id is ever 0 (main is 1, a spawned thread is tid+1).
  (func $handle_EnterCriticalSection (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $cs i32) (local $me i32) (local $prev i32) (local $spin i32)
    (local $owner i32) (local $round i32)
    (local.set $cs (call $g2w (local.get $arg0)))
    (local.set $me (global.get $current_thread_id))
    ;; Contended from inside a synchronous wndproc: parking is not available.
    ;; $wnd_send_message runs the procedure on a recursive interpreter frame,
    ;; and a yield there returns to that loop, not to the host -- so the owning
    ;; thread never gets a turn, the loop burns its round budget in an instant
    ;; and silently abandons the wndproc. That is what left Diablo's main menu
    ;; without its flaming logo: the PCX loader in its WM_INITDIALOG takes a
    ;; Storm section, and the tail of the handler (which posts the message that
    ;; starts the flame animation) never ran. Give the owner a bounded inline
    ;; turn instead, exactly as waitSingleCooperative does for events. With the
    ;; worker backend the pump is a no-op and the CAS spin below carries it.
    (local.set $owner (i32.load offset=12 (local.get $cs)))
    (if (i32.and (i32.ne (local.get $owner) (i32.const 0))
                 (i32.and (i32.ne (local.get $owner) (local.get $me))
                          (i32.ne (global.get $sync_msg_depth) (i32.const 0))))
      (then
        (block $pumped (loop $pump_round
          (br_if $pumped (i32.eqz (call $host_cs_pump)))
          (local.set $owner (i32.load offset=12 (local.get $cs)))
          (br_if $pumped (i32.eqz (local.get $owner)))
          (br_if $pumped (i32.eq (local.get $owner) (local.get $me)))
          (local.set $round (i32.add (local.get $round) (i32.const 1)))
          (br_if $pumped (i32.ge_u (local.get $round) (i32.const 16)))
          (br $pump_round)))))
    (if (call $cs_owner_aligned (local.get $cs))
      (then
        ;; Spin briefly before considering a park. The holder is a guest thread
        ;; on another OS thread and is running RIGHT NOW, so most contention
        ;; clears in microseconds — which is exactly what CRITICAL_SECTION's
        ;; SpinCount is for on a multiprocessor. Parking instead costs a whole
        ;; scheduler round per attempt, and that is not a small constant:
        ;; measured on Winamp in worker mode, each of its three threads parked
        ;; ~2000 times and the decoded audio barely started before the run ended.
        ;;
        ;; The spin is BOUNDED and always ends — in a park for a spawned thread,
        ;; or in taking the section for the guest's main thread (see below) — so
        ;; unlike the WAT's own locks it cannot deadlock the thread that serves
        ;; the holder's host imports. A few thousand atomic ops is tens of
        ;; microseconds; a wait would be unbounded, and that is the difference.
        (local.set $spin (i32.const 0))
        (block $done
          (loop $again
            (local.set $prev (i32.atomic.rmw.cmpxchg offset=12
              (local.get $cs) (i32.const 0) (local.get $me)))
            (br_if $done (i32.eqz (local.get $prev)))
            (br_if $done (i32.eq (local.get $prev) (local.get $me)))
            (local.set $spin (i32.add (local.get $spin) (i32.const 1)))
            (br_if $again (i32.lt_u (local.get $spin) (i32.const 2000))))))
      (else
        ;; Packed guest structs can put this word across an atomic boundary.
        ;; Serialize the claim with the split-lock mutex, never across guest
        ;; execution, imports, callbacks, or a park.
        (call $cs_unaligned_lock (local.get $cs))
        (local.set $prev (i32.load offset=12 (local.get $cs)))
        (if (i32.eqz (local.get $prev))
          (then (i32.store offset=12 (local.get $cs) (local.get $me))))
        (call $cs_unaligned_unlock (local.get $cs))))
    ;; Held by somebody else: park and retry. Both operands are 0/1 predicates.
    (if (i32.and (i32.ne (local.get $prev) (i32.const 0))
                 (i32.ne (local.get $prev) (local.get $me)))
      (then
        (global.set $cs_wait_spins (i32.add (global.get $cs_wait_spins) (i32.const 1)))
        ;; Never barge and never steal. Owner-thread callback dispatch now parks
        ;; and resumes nested sends explicitly, so there is no longer a callback
        ;; running on the wrong instance that needs this semantic escape hatch.
        (call $cs_block (local.get $cs) (local.get $prev))
        (return)))
    (global.set $cs_wait_spins (i32.const 0))
    ;; Came back to a park: the frame must be exactly where it was left, or the
    ;; caller's `ret` will pop something that is not its return address.
    (if (global.get $cs_park_pending)
      (then
        (if (i32.ne (i32.load offset=16 (global.get $reg_base)) (global.get $cs_park_esp))
          (then (global.set $cs_resume_esp_delta
            (i32.sub (i32.load offset=16 (global.get $reg_base)) (global.get $cs_park_esp)))))
        (global.set $cs_park_pending (i32.const 0))))
    ;; Not parked any more. Left set, this reads as "still waiting" long after the
    ;; section was acquired, and a stale name in a deadlock report is worse than
    ;; no name — it accuses a thread that let go.
    (global.set $cs_wait_addr (i32.const 0))
    (global.set $cs_wait_owner (i32.const 0))
    ;; Ours now, or already ours — recursive entry is allowed and only counted.
    ;; LockCount: -1 -> 0 on the first acquire, then up with each recursion.
    (i32.store offset=4 (local.get $cs)
      (i32.add (i32.load offset=4 (local.get $cs)) (i32.const 1)))
    (i32.store offset=8 (local.get $cs)
      (i32.add (i32.load offset=8 (local.get $cs)) (i32.const 1)))
    ;; A contended attempt sets this flag so $run preserves the import frame.
    ;; Once the retry acquires the section it is an ordinary completed API call.
    (global.set $handler_set_eip (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; TryEnterCriticalSection(lpCriticalSection) -> BOOL. Use the same owner
  ;; word and recursive counters as EnterCriticalSection, but contention is an
  ;; immediate FALSE and never parks the calling guest thread.
  (func $handle_TryEnterCriticalSection (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $cs i32) (local $me i32) (local $prev i32)
    (local.set $cs (call $g2w (local.get $arg0)))
    (local.set $me (global.get $current_thread_id))
    (if (call $cs_owner_aligned (local.get $cs))
      (then
        (local.set $prev (i32.atomic.rmw.cmpxchg offset=12
          (local.get $cs) (i32.const 0) (local.get $me))))
      (else
        (call $cs_unaligned_lock (local.get $cs))
        (local.set $prev (i32.load offset=12 (local.get $cs)))
        (if (i32.eqz (local.get $prev))
          (then (i32.store offset=12 (local.get $cs) (local.get $me))))
        (call $cs_unaligned_unlock (local.get $cs))))
    (if (i32.or (i32.eqz (local.get $prev))
                (i32.eq (local.get $prev) (local.get $me)))
      (then
        (i32.store offset=4 (local.get $cs)
          (i32.add (i32.load offset=4 (local.get $cs)) (i32.const 1)))
        (i32.store offset=8 (local.get $cs)
          (i32.add (i32.load offset=8 (local.get $cs)) (i32.const 1)))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1)))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; Is this section's OwningThread word 4-byte aligned, i.e. can it be the
  ;; target of an atomic? Its address is guest-derived and GUEST_BASE is aligned,
  ;; so this follows the guest's own alignment.
  (func $cs_owner_aligned (param $cs i32) (result i32)
    (i32.eqz (i32.and (i32.add (local.get $cs) (i32.const 12)) (i32.const 3))))

  ;; This internal mutex protects only bounded plain-memory accesses. Aligned
  ;; sections retain their existing CAS path and never take this mutex.
  (func $cs_unaligned_lock (param $cs i32)
    (if (i32.eqz (call $cs_owner_aligned (local.get $cs)))
      (then (loop $retry
        (br_if $retry (i32.atomic.rmw.cmpxchg
          (global.get $LOCK_MUTEX) (i32.const 0) (i32.const 1)))))))
  (func $cs_unaligned_unlock (param $cs i32)
    (if (i32.eqz (call $cs_owner_aligned (local.get $cs)))
      (then (i32.atomic.store (global.get $LOCK_MUTEX) (i32.const 0)))))

  ;; 332: LeaveCriticalSection(lpCriticalSection)
  (func $handle_LeaveCriticalSection (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $cs i32) (local $rec i32)
    (local.set $cs (call $g2w (local.get $arg0)))
    (call $cs_unaligned_lock (local.get $cs))
    ;; A non-owner Leave is invalid and must not mutate the section. The former
    ;; compatibility path released somebody else's lock because callbacks could
    ;; execute on the wrong instance; owner-thread SendMessage removes that cause.
    (if (i32.ne (i32.load offset=12 (local.get $cs)) (global.get $current_thread_id))
      (then
        (global.set $cs_bad_leaves (i32.add (global.get $cs_bad_leaves) (i32.const 1)))
        (global.set $cs_bad_leave_addr (local.get $cs))
        (global.set $cs_bad_leave_owner (i32.load offset=12 (local.get $cs)))
        (call $cs_unaligned_unlock (local.get $cs))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    ;; RecursionCount-- / LockCount--
    (local.set $rec (i32.sub (i32.load offset=8 (local.get $cs)) (i32.const 1)))
    (i32.store offset=8 (local.get $cs) (local.get $rec))
    (i32.store offset=4 (local.get $cs)
      (i32.sub (i32.load offset=4 (local.get $cs)) (i32.const 1)))
    ;; Release LAST, and atomically: the counters have to be settled before
    ;; another thread can see the section free and start writing them, which is
    ;; the same publish-last ordering the WAT's own locks use.
    (if (i32.le_s (local.get $rec) (i32.const 0))
      (then
        (i32.store offset=8 (local.get $cs) (i32.const 0))
        (i32.store offset=4 (local.get $cs) (i32.const -1))
        (if (call $cs_owner_aligned (local.get $cs))
          (then (i32.atomic.store offset=12 (local.get $cs) (i32.const 0)))
          (else (i32.store offset=12 (local.get $cs) (i32.const 0))))))
    (call $cs_unaligned_unlock (local.get $cs))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 333: DeleteCriticalSection(lpCriticalSection)
  (func $handle_DeleteCriticalSection (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $cs i32)
    (local.set $cs (call $g2w (local.get $arg0)))
    (i32.store (local.get $cs) (i32.const 0))
    (i32.store offset=4 (local.get $cs) (i32.const -1))
    (i32.store offset=8 (local.get $cs) (i32.const 0))
    (i32.store offset=12 (local.get $cs) (i32.const 0))
    (i32.store offset=16 (local.get $cs) (i32.const 0))
    (i32.store offset=20 (local.get $cs) (i32.const 0))
    ;; Freed memory can be reallocated as something else, and a stale entry would
    ;; have a later thread's exit writing zeroes into whatever now lives there.
    (call $cs_unregister (local.get $cs))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 334: GetCurrentThread — 0 args, return pseudo-handle 0xFFFFFFFE (-2)
  (func $handle_GetCurrentThread (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0xFFFFFFFE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; 335: GetProcessHeap — stable process heap handle accepted by Heap* APIs.
  (func $handle_GetProcessHeap (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (global.get $PROCESS_HEAP_HANDLE))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))  ;; stdcall, 0 args
  )

  ;; 336: SetStdHandle(nStdHandle, hHandle) — replace the corresponding raw
  ;; value in the process standard-handle table. Windows deliberately does not
  ;; validate hHandle here; the later read/write operation validates it.
  (func $handle_SetStdHandle (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $console_std_handle_set (local.get $arg0) (local.get $arg1)))
    (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
      (then (global.set $last_error (i32.const 6)))) ;; ERROR_INVALID_HANDLE
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; FreeConsole() — detach console handles/window/state. Windows reports
  ;; success even when the process was already detached.
  (func $handle_FreeConsole (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $console_detach)
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; 337: FlushFileBuffers — VFS writes are synchronous; validate the writable handle.
  (func $handle_FlushFileBuffers (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $error i32)
    (local.set $error (call $host_fs_flush_file_buffers (local.get $arg0)))
    (if (local.get $error) (then (global.set $last_error (local.get $error))))
    (i32.store offset=0 (global.get $reg_base) (i32.eqz (local.get $error))) (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; 338: IsValidCodePage(CodePage)
  (func $handle_IsValidCodePage (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $is_supported_code_page (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; 339: GetEnvironmentStringsA — an ANSI copy of the process environment.
  ;; It used to return the command line, which is a different string entirely
  ;; and has no double NUL, so a CRT walking it read past the end.
  (func $handle_GetEnvironmentStringsA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $env_strings (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))) (return)
  )

  ;; One indivisible DWORD operation across guest WASM instances. Interlocked
  ;; refcounts are often acquired BEFORE an object's critical section, so a
  ;; load followed by a store can free an object while another thread uses it.
  ;; op 0 = add, 1 = exchange, 2 = compare/exchange; return the OLD value.
  (func $interlocked_rmw32
      (param $ga i32) (param $value i32) (param $compare i32) (param $op i32)
      (result i32)
    (local $wa i32) (local $old i32)
    ;; An aligned DWORD cannot straddle a guest page. Translation preserves
    ;; alignment for all normal mappings; check the result too for the sink.
    (if (i32.eqz (i32.and (local.get $ga) (i32.const 3)))
      (then
        (local.set $wa (call $g2w (local.get $ga)))
        (if (i32.eqz (i32.and (local.get $wa) (i32.const 3)))
          (then
            ;; Keep gs32's executable-page invalidation before publishing the
            ;; write. A failed compare/exchange conservatively invalidates too,
            ;; but does not report a write to page watchers.
            (if (call $code_page_test (local.get $ga))
              (then (call $code_write_hit (local.get $ga) (i32.const 4))))
            (if (i32.eqz (local.get $op))
              (then (local.set $old (i32.atomic.rmw.add
                (local.get $wa) (local.get $value))))
              (else (if (i32.eq (local.get $op) (i32.const 1))
                (then (local.set $old (i32.atomic.rmw.xchg
                  (local.get $wa) (local.get $value))))
                (else (local.set $old (i32.atomic.rmw.cmpxchg
                  (local.get $wa) (local.get $compare) (local.get $value)))))))
            (if (i32.or (i32.ne (local.get $op) (i32.const 2))
                  (i32.eq (local.get $old) (local.get $compare)))
              (then (call $page_watch_write_one (local.get $wa))))
            (return (local.get $old))))))
    ;; Win32's interlocked atomicity contract requires DWORD alignment. Keep
    ;; legacy unaligned callers working without a WASM atomic-alignment trap;
    ;; gl32/gs32 also gather/scatter noncontiguous sparse page boundaries.
    (local.set $old (call $gl32 (local.get $ga)))
    (if (i32.eqz (local.get $op))
      (then (call $gs32 (local.get $ga) (i32.add (local.get $old) (local.get $value))))
      (else (if (i32.or (i32.eq (local.get $op) (i32.const 1))
                  (i32.eq (local.get $old) (local.get $compare)))
        (then (call $gs32 (local.get $ga) (local.get $value))))))
    (local.get $old))

  ;; 340: InterlockedIncrement(ptr)
  (func $handle_InterlockedIncrement (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $tmp i32)
    (local.set $tmp (i32.add (call $interlocked_rmw32
      (local.get $arg0) (i32.const 1) (i32.const 0) (i32.const 0)) (i32.const 1)))
    (i32.store offset=0 (global.get $reg_base) (local.get $tmp))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))) (return)
  )

  ;; 341: InterlockedDecrement(ptr)
  (func $handle_InterlockedDecrement (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $tmp i32)
    (local.set $tmp (i32.sub (call $interlocked_rmw32
      (local.get $arg0) (i32.const -1) (i32.const 0) (i32.const 0)) (i32.const 1)))
    (i32.store offset=0 (global.get $reg_base) (local.get $tmp))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))) (return)
  )

  ;; 342: InterlockedExchange(ptr, value)
  (func $handle_InterlockedExchange (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $interlocked_rmw32
      (local.get $arg0) (local.get $arg1) (i32.const 0) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))) (return)
  )

  ;; InterlockedExchangeAdd(ptr, delta) → original (unlike Increment/Decrement).
  (func $handle_InterlockedExchangeAdd (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $interlocked_rmw32
      (local.get $arg0) (local.get $arg1) (i32.const 0) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; InterlockedCompareExchange(ptr, newVal, comparand) → original
  ;; Atomically replace only when *ptr == comparand; return the prior value.
  (func $handle_InterlockedCompareExchange (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $orig i32)
    (local.set $orig (call $interlocked_rmw32
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 2)))
    (i32.store offset=0 (global.get $reg_base) (local.get $orig))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )
