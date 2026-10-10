  ;; ============================================================
  ;; EARLY WIN32 BASE HANDLERS\nProcess, loader, locale, DDE, security, file, synchronization and memory APIs.
  ;; ============================================================

  ;; 0: ExitProcess
  (func $handle_ExitProcess (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
    (call $host_exit (local.get $arg0)) (global.set $eip (i32.const 0)) (global.set $steps (i32.const 0)) (return)
  )

  ;; A module stem is followed either by nothing or by the conventional
  ;; ".dll" suffix — GetModuleHandle callers write it both ways.
  (func $guest_name_tail_is_dll (param $p i32) (result i32)
    (local $c i32)
    (local.set $c (call $gl8 (local.get $p)))
    (if (i32.eqz (local.get $c)) (then (return (i32.const 1))))
    (if (i32.ne (local.get $c) (i32.const 0x2e)) (then (return (i32.const 0)))) ;; .
    (if (i32.ne (call $tolower (call $gl8 (i32.add (local.get $p) (i32.const 1))))
                (i32.const 0x64)) (then (return (i32.const 0)))) ;; d
    (if (i32.ne (call $tolower (call $gl8 (i32.add (local.get $p) (i32.const 2))))
                (i32.const 0x6c)) (then (return (i32.const 0)))) ;; l
    (if (i32.ne (call $tolower (call $gl8 (i32.add (local.get $p) (i32.const 3))))
                (i32.const 0x6c)) (then (return (i32.const 0)))) ;; l
    (i32.eqz (call $gl8 (i32.add (local.get $p) (i32.const 4))))
  )

  ;; True when the whole name ends in ".dll". Every module we dispatch
  ;; statically is a .dll; a LoadLibrary of some other extension (.ax, .ocx,
  ;; .drv, .asi) can only be satisfied by a real file, so when the VFS does not
  ;; have one the answer is NULL rather than a synthetic handle. Warcraft III
  ;; asks for "blizzard.ax" — its optional DirectShow filter, absent from the
  ;; small demo build — and calls whatever GetProcAddress hands back.
  (func $guest_name_has_dll_ext (param $name i32) (result i32)
    (local $len i32)
    (block $done (loop $scan
      (br_if $done (i32.eqz (call $gl8 (i32.add (local.get $name) (local.get $len)))))
      (local.set $len (i32.add (local.get $len) (i32.const 1)))
      (br $scan)))
    (if (i32.lt_u (local.get $len) (i32.const 4)) (then (return (i32.const 0))))
    (call $guest_name_tail_is_dll
      (i32.add (local.get $name) (i32.sub (local.get $len) (i32.const 4))))
  )

  ;; Statically dispatched system DLLs do not have a mapped PE image or DLL
  ;; table entry, so a name lookup is the only way to recognize them. Callers
  ;; use the handle with GetProcAddress, which already resolves non-mapped
  ;; modules through the API table, but they also use its mere existence as
  ;; proof the component is present: Age of Empires II creates a DirectPlay
  ;; object, queries the DirectX 6 interface off it, then asks for dplayx's
  ;; module handle — and reports "requires DirectX 6.1a or higher" when that
  ;; last step answers NULL. The names live at $STATIC_SYS_DLL_NAMES.
  ;;
  ;; Returns the 1-based list position, so 0 still reads as "not one of ours".
  (func $guest_name_is_static_system_dll (param $name i32) (result i32)
    (local $entry i32) (local $i i32) (local $a i32) (local $b i32)
    (local $start i32) (local $scan i32) (local $c i32) (local $idx i32)
    (if (i32.eqz (local.get $name)) (then (return (i32.const 0))))
    ;; Match on the basename; a full path reaches here as readily as a stem.
    (block $base_done (loop $base
      (local.set $c (call $gl8 (i32.add (local.get $name) (local.get $scan))))
      (br_if $base_done (i32.eqz (local.get $c)))
      (if (i32.or
            (i32.or (i32.eq (local.get $c) (i32.const 92))   ;; '\'
                    (i32.eq (local.get $c) (i32.const 47)))  ;; '/'
            (i32.eq (local.get $c) (i32.const 58)))          ;; ':'
        (then (local.set $start (i32.add (local.get $scan) (i32.const 1)))))
      (local.set $scan (i32.add (local.get $scan) (i32.const 1)))
      (br $base)))
    (local.set $entry (global.get $STATIC_SYS_DLL_NAMES))
    (block $done (loop $names
      (br_if $done (i32.eqz (i32.load8_u (local.get $entry))))
      (local.set $i (i32.const 0))
      (block $mismatch
        (loop $chars
          (local.set $b (i32.load8_u (i32.add (local.get $entry) (local.get $i))))
          (local.set $a (call $tolower (call $gl8
            (i32.add (local.get $name) (i32.add (local.get $start) (local.get $i))))))
          (if (i32.eqz (local.get $b))
            (then
              (if (call $guest_name_tail_is_dll
                    (i32.add (local.get $name) (i32.add (local.get $start) (local.get $i))))
                (then (return (i32.add (local.get $idx) (i32.const 1)))))
              (br $mismatch)))
          (br_if $mismatch (i32.ne (local.get $a) (local.get $b)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $chars)))
      ;; Step past this entry's NUL to the next one.
      (block $adv (loop $skip
        (br_if $adv (i32.eqz (i32.load8_u (local.get $entry))))
        (local.set $entry (i32.add (local.get $entry) (i32.const 1)))
        (br $skip)))
      (local.set $entry (i32.add (local.get $entry) (i32.const 1)))
      (local.set $idx (i32.add (local.get $idx) (i32.const 1)))
      (br $names)))
    (i32.const 0)
  )

  ;; Address of the 0-based list entry $idx names.
  (func $static_sys_dll_name_at (param $idx i32) (result i32)
    (local $entry i32)
    (local.set $entry (global.get $STATIC_SYS_DLL_NAMES))
    (block $done (loop $skip
      (br_if $done (i32.eqz (local.get $idx)))
      ;; Stop on the terminating empty string: any address at or above the
      ;; handle base reaches here, and a DLL rebased into a high reservation
      ;; is a module handle that indexes far past the list.
      (br_if $done (i32.eqz (i32.load8_u (local.get $entry))))
      (block $adv (loop $chars
        (br_if $adv (i32.eqz (i32.load8_u (local.get $entry))))
        (local.set $entry (i32.add (local.get $entry) (i32.const 1)))
        (br $chars)))
      (local.set $entry (i32.add (local.get $entry) (i32.const 1)))
      (local.set $idx (i32.sub (local.get $idx) (i32.const 1)))
      (br $skip)))
    (local.get $entry))

  ;; Is this guest path one of the statically dispatched DirectX components?
  ;; Only the DirectX range answers with the DirectX version; later static
  ;; modules such as Glide have distinct handles but are not DirectX DLLs.
  (func $name_is_static_dx_dll (param $name i32) (result i32)
    (local $idx i32)
    (if (i32.eqz (local.get $name)) (then (return (i32.const 0))))
    (local.set $idx (call $guest_name_is_static_system_dll (local.get $name)))
    (if (i32.eqz (local.get $idx)) (then (return (i32.const 0))))
    (i32.and
      (i32.ge_u (i32.sub (local.get $idx) (i32.const 1))
        (global.get $STATIC_SYS_DLL_FIRST_DX))
      (i32.lt_u (i32.sub (local.get $idx) (i32.const 1))
        (i32.add (global.get $STATIC_SYS_DLL_FIRST_DX)
          (global.get $STATIC_SYS_DLL_DX_COUNT)))))

  ;; A pseudo module handle back to its 1-based list position, or 0.
  (func $static_sys_dll_from_handle (param $h i32) (result i32)
    (local $idx i32)
    (if (i32.lt_u (local.get $h) (global.get $STATIC_SYS_DLL_HANDLE_BASE))
      (then (return (i32.const 0))))
    (local.set $idx (i32.sub (local.get $h) (global.get $STATIC_SYS_DLL_HANDLE_BASE)))
    ;; Past the end of the list the entry is the terminating empty string.
    (if (i32.eqz (i32.load8_u (call $static_sys_dll_name_at (local.get $idx))))
      (then (return (i32.const 0))))
    (i32.add (local.get $idx) (i32.const 1)))

  ;; Copy a NUL-terminated linear-memory string into a guest buffer at
  ;; character offset $at, stopping at $limit characters. Returns the cursor.
  (func $emit_path_part (param $buf_g i32) (param $at i32) (param $limit i32)
                        (param $src i32) (param $wide i32) (result i32)
    (local $ch i32) (local $step i32)
    (local.set $step (select (i32.const 2) (i32.const 1) (local.get $wide)))
    (block $done (loop $l
      (local.set $ch (i32.load8_u (local.get $src)))
      (br_if $done (i32.eqz (local.get $ch)))
      (br_if $done (i32.ge_u (local.get $at) (local.get $limit)))
      (call $store_char
        (i32.add (local.get $buf_g) (i32.mul (local.get $at) (local.get $step)))
        (local.get $ch) (local.get $wide))
      (local.set $at (i32.add (local.get $at) (i32.const 1)))
      (local.set $src (i32.add (local.get $src) (i32.const 1)))
      (br $l)))
    (local.get $at))

  ;; "C:\WINDOWS\SYSTEM\<name>.dll" for a statically dispatched module. No such
  ;; file exists; the path is here because callers feed GetModuleFileName's
  ;; answer straight into the file-version APIs, which recognize the name back.
  (func $static_sys_dll_file_name (param $idx i32) (param $buf_g i32)
                                  (param $size i32) (param $wide i32) (result i32)
    (local $at i32) (local $limit i32) (local $step i32)
    (if (i32.eqz (local.get $buf_g)) (then (return (i32.const 0))))
    (local.set $limit (i32.const 0x7FFFFFFF))
    (if (local.get $size)
      (then (local.set $limit (i32.sub (local.get $size) (i32.const 1)))))
    (local.set $at (call $emit_path_part (local.get $buf_g) (i32.const 0)
      (local.get $limit) (global.get $STATIC_SYS_DIR) (local.get $wide)))
    (local.set $at (call $emit_path_part (local.get $buf_g) (local.get $at)
      (local.get $limit) (call $static_sys_dll_name_at (local.get $idx)) (local.get $wide)))
    (local.set $at (call $emit_path_part (local.get $buf_g) (local.get $at)
      (local.get $limit) (global.get $STATIC_SYS_DLL_EXT) (local.get $wide)))
    (local.set $step (select (i32.const 2) (i32.const 1) (local.get $wide)))
    (call $store_char
      (i32.add (local.get $buf_g) (i32.mul (local.get $at) (local.get $step)))
      (i32.const 0) (local.get $wide))
    (local.get $at))

  ;; 1: GetModuleHandleA(lpModuleName) — NULL→image_base, else search DLL table
  (func $handle_GetModuleHandleA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $result i32) (local $idx i32)
    (if (i32.eqz (local.get $arg0))
      (then (local.set $result (global.get $image_base)))
      (else
        ;; Prefer a real mapped OLE32 (or any other DLL) over the synthetic
        ;; statically-dispatched module fallback.  Win98 SHELL32 obtains its
        ;; allocator by GetModuleHandle("OLE32.DLL") + GetProcAddress, so
        ;; returning the EXE here silently bypasses a mounted stock OLE32.
        (local.set $idx (call $find_loaded_dll (local.get $arg0)))
        (if (i32.ge_s (local.get $idx) (i32.const 0))
          (then
            (local.set $result
              (i32.load (i32.add (global.get $DLL_TABLE)
                (i32.mul (local.get $idx) (i32.const 32))))))
          (else
            ;; KERNEL32 is implemented by native dispatch rather than a
            ;; mapped PE image.  LoadLibraryA already represents such system
            ;; modules with the image base; GetModuleHandle must agree or
            ;; MSVC's encoded-pointer startup waits up to 60 seconds for a
            ;; KERNEL32 module that can never appear in the DLL table.
            (if (call $dll_name_match (local.get $arg0) (region.addr $RESERVED_PAGE_STRINGS 0x30))
              (then (local.set $result (global.get $image_base)))
              (else
                (local.set $idx (call $guest_name_is_static_system_dll (local.get $arg0)))
                (if (local.get $idx)
                  (then (local.set $result (i32.add (global.get $STATIC_SYS_DLL_HANDLE_BASE)
                          (i32.sub (local.get $idx) (i32.const 1)))))
                  (else (local.set $result (i32.const 0))))))))))
    (i32.store offset=0 (global.get $reg_base) (local.get $result))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 2: GetCommandLineA
  (func $handle_GetCommandLineA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (global.get $fake_cmdline_addr))
      (then (call $store_fake_cmdline)))
    (i32.store offset=0 (global.get $reg_base) (global.get $fake_cmdline_addr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))) (return)
  )

  ;; 3: GetStartupInfoA
  (func $handle_GetStartupInfoA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $startup_info_init (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))) (return)
  )

  ;; 4: GetProcAddress
  (func $handle_GetProcAddress (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $tmp i32) (local $v i32) (local $i i32) (local $dll_base i32) (local $resolved i32) (local $v_wa i32)
    (local $tbl i32) (local $export i32) (local $dll_name i32)
    (local $api_id i32) (local $thunk_wa i32) (local $name_wa i32)
    (if (i32.ge_u (local.get $arg1) (i32.const 0x10000))
      (then (local.set $name_wa (call $g2w (local.get $arg1)))))
    (block $gpa
    ;; Default return value: NULL (function not found)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    ;; The main EXE can export callbacks for runtime-loaded plugins. Hype's
    ;; sound driver asks its EXE for _SND_fn_vDisplayError@8; it is not in
    ;; DLL_TABLE. Read the mapped PE header rather than the loader-instance
    ;; exe_export_rva global: GetProcAddress may run on a secondary thread.
    (if (i32.eq (local.get $arg0) (global.get $image_base))
      (then
        (if (i32.eq (call $gl16 (global.get $image_base)) (i32.const 0x5a4d))
          (then
            (local.set $export (i32.add (global.get $image_base)
              (call $gl32 (i32.add (global.get $image_base) (i32.const 0x3c)))))
            (if (i32.eq (call $gl32 (local.get $export)) (i32.const 0x4550))
              (then
                (local.set $resolved (call $resolve_image_export
                  (global.get $image_base)
                  (call $gl32 (i32.add (local.get $export) (i32.const 120)))
                  (local.get $arg1) (local.get $name_wa)))
                (if (local.get $resolved)
                  (then
                    ;; An EAT RVA inside the export-directory range names a
                    ;; forwarder string, not code/data in this image. The shared
                    ;; image resolver does not follow DLL.Symbol / DLL.#ordinal
                    ;; forwarders yet. Fail explicitly rather than returning a
                    ;; plausible address that the guest would execute as text.
                    (local.set $dll_base (i32.add (global.get $image_base)
                      (call $gl32 (i32.add (local.get $export) (i32.const 120)))))
                    (if (i32.lt_u (i32.sub (local.get $resolved) (local.get $dll_base))
                          (call $gl32 (i32.add (local.get $export) (i32.const 124))))
                      (then
                        (call $host_log_i32 (i32.const 0x46574452)) ;; FWDR
                        (call $host_log_i32 (local.get $resolved))
                        (unreachable)))
                    (i32.store (global.get $reg_base) (local.get $resolved))
                    (i32.store offset=16 (global.get $reg_base)
                      (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
                    (return)))))))))
    ;; COM self-registration exports belong to a real server image, and the
    ;; EXE above did not export one. The image base also stands in for a bare
    ;; DLL name nothing on disk provides (LoadLibrary's last fallback), so
    ;; without this the API-by-name path below handed out our fail-fast
    ;; DllRegisterServer: Explorer loads ACTXPRXY.DLL, which a stock box need
    ;; not have, and registers whatever comes back (crash sweep, 15 s in).
    ;; Answer as Windows does for a module without the export.
    (if (i32.and (i32.eq (local.get $arg0) (global.get $image_base))
          (i32.ne (local.get $name_wa) (i32.const 0)))
      (then
        (if (i32.or (call $str_eq (local.get $name_wa) "DllRegisterServer")
                    (call $str_eq (local.get $name_wa) "DllUnregisterServer"))
          (then
            (global.set $last_error (i32.const 127)) ;; ERROR_PROC_NOT_FOUND
            (i32.store offset=16 (global.get $reg_base)
              (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
            (return)))))
    ;; Preserve the existing fallback below: native KERNEL32 currently shares
    ;; this image-base handle, so a missing EXE name can still be a Win32 API.
    ;; `_acmdln` is an exported data cell, not a callable CRT function. Old
    ;; MSVC runtimes resolve it dynamically and abort startup if it is absent.
    ;; Our static-system-DLL handles are intentionally aliases, so the export
    ;; name is the useful discriminator here.
    (if (i32.and
          (i32.and
            (i32.ne (local.get $name_wa) (i32.const 0))
            (i32.eq (i32.load (local.get $name_wa)) (i32.const 0x6d63615f))) ;; _acm
          (i32.eq (i32.load offset=4 (local.get $name_wa)) (i32.const 0x006e6c64))) ;; dln\0
      (then
        (if (i32.eqz (global.get $fake_cmdline_addr))
          (then (call $store_fake_cmdline)))
        (i32.store offset=0 (global.get $reg_base) (i32.add (global.get $fake_cmdline_addr) (i32.const 504)))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    ;; Check if hModule matches a loaded DLL — if so, resolve from its export table.
    ;; lpProcName may be a MAKEINTRESOURCE ordinal (< 0x10000) rather than a
    ;; string pointer; a real DLL's export table can answer either form, so the
    ;; ordinal case is resolved here and only falls through to the "not loaded"
    ;; Win32-thunk path (which has no ordinals) when no DLL matches.
    (local.set $i (i32.const 0))
    (block $not_dll (loop $scan_dll
      (br_if $not_dll (i32.ge_u (local.get $i) (i32.atomic.load (global.get $DLL_SHARED))))
      (local.set $dll_base (i32.load (i32.add (global.get $DLL_TABLE) (i32.mul (local.get $i) (i32.const 32)))))
      (if (i32.eq (local.get $dll_base) (local.get $arg0))
        (then
          ;; Ordinal form: resolve straight from the export address table.
          (if (i32.lt_u (local.get $arg1) (i32.const 0x10000))
            (then
              ;; A loaded Win9x system DLL can export a 32-bit flat thunk whose
              ;; final target is supplied by ThunkConnect32 from a 16-bit DLL.
              ;; When that ordinal already has a native API handler, return the
              ;; same dispatch thunk an ordinal import would receive instead
              ;; of the unbound flat thunk. Explorer obtains SHELL32 #181
              ;; (RegisterShellHook) this way during startup.
              (local.set $tbl (i32.add (global.get $DLL_TABLE)
                (i32.mul (local.get $i) (i32.const 32))))
              (local.set $export (call $g2w (i32.add (local.get $dll_base)
                (i32.load (i32.add (local.get $tbl) (i32.const 8))))))
              (local.set $dll_name (i32.add (local.get $dll_base)
                (i32.load (i32.add (local.get $export) (i32.const 12)))))
              (local.set $api_id (call $resolve_import_ordinal
                (local.get $dll_name) (call $g2w (local.get $dll_name)) (local.get $arg1)))
              (if (i32.ne (local.get $api_id) (i32.const -1))
                (then
                  ;; Any thread can get here: reserve the index process-wide.
                  (global.set $num_thunks (call $thunk_reserve))
                  (local.set $thunk_wa (i32.add (global.get $THUNK_BASE)
                    (i32.mul (global.get $num_thunks) (i32.const 8))))
                  (i32.store (local.get $thunk_wa)
                    (i32.or (i32.const 0x80000000) (local.get $arg1)))
                  (i32.store offset=4 (local.get $thunk_wa) (local.get $api_id))
                  (i32.store offset=0 (global.get $reg_base) (i32.add
                    (i32.sub (local.get $thunk_wa) (global.get $GUEST_BASE))
                    (global.get $image_base)))
                  (global.set $num_thunks
                    (i32.add (global.get $num_thunks) (i32.const 1)))
                  (call $update_thunk_end)
                  (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
                  (return)))
              (i32.store offset=0 (global.get $reg_base) (call $resolve_ordinal (local.get $i) (local.get $arg1)))
              (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
              (return)))
          ;; Flat scrollbar APIs are optional. Let VCL/common-control callers
          ;; use their USER32 fallback wrappers instead of entering the loaded
          ;; comctl32 FlatSB code path, which depends on native subclass state.
          (if (call $guest_name_contains_flatsb (local.get $arg1))
            (then
              (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
              (return)))
          ;; Found matching DLL — resolve export by name
          (local.set $resolved (call $resolve_name_export (local.get $i) (local.get $name_wa)))
          ;; An absent export belongs to this module's answer too. Falling
          ;; through invents global APIs inside unrelated loaded DLLs, so a
          ;; caller probing optional CRT exports patches functions that the
          ;; module never exported (SmartHeap probing C4dll-R).
          (if (i32.eqz (local.get $resolved))
            (then (global.set $last_error (i32.const 127))))
          (i32.store offset=0 (global.get $reg_base) (local.get $resolved))
          (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
          (return)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan_dll)))
    ;; Not a loaded DLL — create thunk as before (Win32 API). Win32 stubs are
    (if (call $resolve_static_module_ordinal (local.get $arg0) (local.get $arg1)) (then (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))) (return)))
    (br_if $gpa (i32.lt_u (local.get $arg1) (i32.const 0x10000)))
    ;; Allocate hint(2) + name in guest heap
    (local.set $tmp (call $guest_strlen (local.get $arg1)))
    (local.set $v (call $heap_alloc (i32.add (local.get $tmp) (i32.const 3)))) (local.set $v_wa (call $g2w (local.get $v))) ;; 2 hint + name + NUL
    ;; Write hint = 0
    (i32.store16 (local.get $v_wa) (i32.const 0))
    ;; Copy name string
    (call $memcpy (i32.add (local.get $v_wa) (i32.const 2))
    (local.get $name_wa) (i32.add (local.get $tmp) (i32.const 1)))
    ;; Look up api_id — if unknown (0xFFFF), return NULL instead of creating broken thunk
    (local.set $i (i32.const -1))
    (local.set $api_id (call $static_sys_dll_from_handle (local.get $arg0)))
    (if (local.get $api_id) (then
      (if (call $str_eq
          (call $static_sys_dll_name_at (i32.sub (local.get $api_id) (i32.const 1)))
          "glide3x")
        (then (local.set $i (call $glide3_named_api (local.get $name_wa)))))))
    (if (i32.eq (local.get $i) (i32.const -1))
      (then (local.set $i (call $lookup_api_id (i32.add (local.get $v_wa) (i32.const 2))))))
    (if (i32.eq (local.get $i) (i32.const 0xFFFF))
      (then (br $gpa))) ;; return 0 — function not found
    ;; Create thunk: store RVA and api_id at THUNK_BASE + num_thunks*8.
    ;; The index is reserved from the process-wide cursor, not taken from this
    ;; instance's count: GetProcAddress runs on whatever thread the guest calls
    ;; it from, and two threads reading the same local count would be handed the
    ;; same thunk address for two different functions.
    (global.set $num_thunks (call $thunk_reserve))
    ;; The dispatch record is consumed as a WASM-backing offset relative to
    ;; GUEST_BASE, not as a guest virtual address.  Those representations are
    ;; identical for the direct low heap, but diverge after HeapAlloc spills
    ;; into a sparse high mapping.  Translate here so dynamic imports such as
    ;; Half-Life's DirectSoundCreate keep a valid name pointer at dispatch.
    (i32.store (i32.add (global.get $THUNK_BASE) (i32.mul (global.get $num_thunks) (i32.const 8)))
    (i32.sub (local.get $v_wa) (global.get $GUEST_BASE)))
    ;; Store api_id
    (i32.store (i32.add (i32.add (global.get $THUNK_BASE) (i32.mul (global.get $num_thunks) (i32.const 8))) (i32.const 4))
    (local.get $i))
    ;; Compute guest address of this thunk
    (i32.store offset=0 (global.get $reg_base) (i32.add
    (i32.sub (i32.add (global.get $THUNK_BASE) (i32.mul (global.get $num_thunks) (i32.const 8)))
    (global.get $GUEST_BASE))
    (global.get $image_base)))
    (global.set $num_thunks (i32.add (global.get $num_thunks) (i32.const 1)))
    (call $update_thunk_end))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))) (return)
  )

  ;; 5: GetLastError — return thread-global Win32 last-error value.
  (func $handle_GetLastError (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (global.get $last_error))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))  ;; stdcall, 0 args
  )

  ;; Write one host wall-clock record (kind 0/1: 16-byte SYSTEMTIME, kind 2:
  ;; 8-byte FILETIME) to the guest's own buffer at $ga. The host writes $len
  ;; contiguous bytes, and one $g2w translation is only good for one guest
  ;; page -- a SYSTEMTIME straddling two sparse pages would spill its tail
  ;; into unrelated memory. So the host fills a span that is linear by
  ;; construction (the guest's bytes when they already are, else a gathered
  ;; copy) and $guest_span_writeback scatters it back page by page. A NULL
  ;; buffer gets no span and the host writes nothing.
  (func $wall_clock_to_guest (param $ga i32) (param $kind i32) (param $len i32)
    (local $wa i32)
    (local.set $wa (call $guest_span_in (local.get $ga) (local.get $len)))
    (if (i32.eqz (local.get $wa)) (then (return)))
    (drop (call $host_wall_clock (local.get $wa) (local.get $kind)))
    (call $guest_span_writeback (local.get $ga) (local.get $wa) (local.get $len)))

  ;; 6: GetLocalTime(lpSystemTime) — host wall clock in the local time zone.
  (func $handle_GetLocalTime (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $wall_clock_to_guest (local.get $arg0) (i32.const 1) (i32.const 16))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; ---- Calendar and date/time picture formatting --------------------------
  ;;
  ;; GetDateFormatA / GetTimeFormatA, GetLocaleInfo's calendar LCTypes,
  ;; EnumDateFormatsA / EnumTimeFormatsA, the time-zone APIs and the CRT's
  ;; time()/localtime() all answer from here, so the en-US picture strings,
  ;; day and month names and the local-time bias cannot disagree between them.

  ;; One host wall-clock read through a heap scratch: kind 2 is the UTC
  ;; FILETIME, kind 3 the current Win32 Bias in minutes (low dword, signed).
  ;; A heap allocation rather than a fixed scratch because guest threads each
  ;; run their own instance over one memory.
  (func $wall_clock_read64 (param $kind i32) (result i64)
    (local $scratch i32) (local $value i64)
    (local.set $scratch (call $heap_alloc (i32.const 16)))
    (if (i32.eqz (local.get $scratch)) (then (return (i64.const 0))))
    (call $gs64 (local.get $scratch) (i64.const 0))
    (drop (call $host_wall_clock (call $g2w (local.get $scratch)) (local.get $kind)))
    (local.set $value (i64.or
      (i64.extend_i32_u (call $gl32 (local.get $scratch)))
      (i64.shl (i64.extend_i32_u (call $gl32 (i32.add (local.get $scratch) (i32.const 4))))
        (i64.const 32))))
    (call $heap_free (local.get $scratch))
    (local.get $value))

  ;; Win32 Bias of the zone GetLocalTime reports in: UTC = local + Bias.
  (func $tz_bias_minutes (result i32)
    (i32.wrap_i64 (call $wall_clock_read64 (i32.const 3))))

  ;; Current UTC time as a CRT time_t (seconds since 1970-01-01).
  (func $wall_clock_time_t (result i32)
    (i32.wrap_i64 (i64.div_u
      (i64.sub (call $wall_clock_read64 (i32.const 2)) (i64.const 116444736000000000))
      (i64.const 10000000))))

  (func $cal_is_leap (param $y i32) (result i32)
    (i32.or
      (i32.eqz (i32.rem_u (local.get $y) (i32.const 400)))
      (i32.and
        (i32.eqz (i32.rem_u (local.get $y) (i32.const 4)))
        (i32.ne (i32.rem_u (local.get $y) (i32.const 100)) (i32.const 0)))))

  (func $cal_days_in_month (param $y i32) (param $m i32) (result i32)
    (if (i32.eq (local.get $m) (i32.const 2))
      (then (return (i32.add (i32.const 28) (call $cal_is_leap (local.get $y))))))
    (if (i32.or (i32.or (i32.eq (local.get $m) (i32.const 4)) (i32.eq (local.get $m) (i32.const 6)))
          (i32.or (i32.eq (local.get $m) (i32.const 9)) (i32.eq (local.get $m) (i32.const 11))))
      (then (return (i32.const 30))))
    (i32.const 31))

  ;; Day of week, 0 = Sunday (Sakamoto). The month offsets 0,3,2,5,0,3,5,1,
  ;; 4,6,2,4 are packed one per nibble, January lowest.
  (func $cal_day_of_week (param $y i32) (param $m i32) (param $d i32) (result i32)
    (if (i32.lt_u (local.get $m) (i32.const 3))
      (then (local.set $y (i32.sub (local.get $y) (i32.const 1)))))
    (i32.rem_u
      (i32.add
        (i32.add
          (i32.sub
            (i32.add (local.get $y) (i32.div_u (local.get $y) (i32.const 4)))
            (i32.div_u (local.get $y) (i32.const 100)))
          (i32.div_u (local.get $y) (i32.const 400)))
        (i32.add (local.get $d)
          (i32.wrap_i64 (i64.and
            (i64.shr_u (i64.const 0x426415305230)
              (i64.extend_i32_u (i32.shl (i32.sub (local.get $m) (i32.const 1)) (i32.const 2))))
            (i64.const 0xF)))))
      (i32.const 7)))

  ;; Days since 1970-01-01 (non-negative) to a civil date, packed as
  ;; year<<9 | month<<5 | day (Hinnant's civil_from_days).
  (func $cal_civil_from_days (param $z i32) (result i32)
    (local $era i32) (local $doe i32) (local $yoe i32) (local $doy i32)
    (local $mp i32) (local $y i32) (local $m i32) (local $d i32)
    (local.set $z (i32.add (local.get $z) (i32.const 719468)))
    (local.set $era (i32.div_u (local.get $z) (i32.const 146097)))
    (local.set $doe (i32.sub (local.get $z) (i32.mul (local.get $era) (i32.const 146097))))
    (local.set $yoe (i32.div_u
      (i32.sub
        (i32.add (i32.sub (local.get $doe) (i32.div_u (local.get $doe) (i32.const 1460)))
          (i32.div_u (local.get $doe) (i32.const 36524)))
        (i32.div_u (local.get $doe) (i32.const 146096)))
      (i32.const 365)))
    (local.set $y (i32.add (local.get $yoe) (i32.mul (local.get $era) (i32.const 400))))
    (local.set $doy (i32.sub (local.get $doe)
      (i32.sub
        (i32.add (i32.mul (local.get $yoe) (i32.const 365)) (i32.div_u (local.get $yoe) (i32.const 4)))
        (i32.div_u (local.get $yoe) (i32.const 100)))))
    (local.set $mp (i32.div_u (i32.add (i32.mul (local.get $doy) (i32.const 5)) (i32.const 2))
      (i32.const 153)))
    (local.set $d (i32.add
      (i32.sub (local.get $doy)
        (i32.div_u (i32.add (i32.mul (local.get $mp) (i32.const 153)) (i32.const 2)) (i32.const 5)))
      (i32.const 1)))
    (local.set $m (if (result i32) (i32.lt_u (local.get $mp) (i32.const 10))
      (then (i32.add (local.get $mp) (i32.const 3)))
      (else (i32.sub (local.get $mp) (i32.const 9)))))
    (if (i32.le_u (local.get $m) (i32.const 2))
      (then (local.set $y (i32.add (local.get $y) (i32.const 1)))))
    (i32.or (i32.shl (local.get $y) (i32.const 9))
      (i32.or (i32.shl (local.get $m) (i32.const 5)) (local.get $d))))

  ;; The $n-th NUL-separated entry of a packed name list (a WAT literal).
  (func $cal_nth_name (param $list i32) (param $n i32) (result i32)
    (block $found (loop $skip
      (br_if $found (i32.eqz (local.get $n)))
      (block $end (loop $walk
        (local.set $list (i32.add (local.get $list) (i32.const 1)))
        (br_if $end (i32.eqz (i32.load8_u (i32.sub (local.get $list) (i32.const 1)))))
        (br $walk)))
      (local.set $n (i32.sub (local.get $n) (i32.const 1)))
      (br $skip)))
    (local.get $list))

  ;; en-US names. $dow is 0 = Sunday, $month is 0 = January.
  (func $cal_day_name (param $dow i32) (param $abbrev i32) (result i32)
    (call $cal_nth_name
      (select "Sun\0Mon\0Tue\0Wed\0Thu\0Fri\0Sat"
        "Sunday\0Monday\0Tuesday\0Wednesday\0Thursday\0Friday\0Saturday"
        (local.get $abbrev))
      (i32.rem_u (local.get $dow) (i32.const 7))))

  (func $cal_month_name (param $month i32) (param $abbrev i32) (result i32)
    (call $cal_nth_name
      (select "Jan\0Feb\0Mar\0Apr\0May\0Jun\0Jul\0Aug\0Sep\0Oct\0Nov\0Dec"
        "January\0February\0March\0April\0May\0June\0July\0August\0September\0October\0November\0December"
        (local.get $abbrev))
      (i32.rem_u (local.get $month) (i32.const 12))))

  ;; en-US picture strings: 0 LOCALE_SSHORTDATE, 1 LOCALE_SLONGDATE,
  ;; 2 LOCALE_STIMEFORMAT, 3 the DATE_YEARMONTH form.
  (func $dtf_default_picture (param $which i32) (result i32)
    (if (i32.eq (local.get $which) (i32.const 1)) (then (return "dddd, MMMM d, yyyy")))
    (if (i32.eq (local.get $which) (i32.const 2)) (then (return "h:mm:ss tt")))
    (if (i32.eq (local.get $which) (i32.const 3)) (then (return "MMMM, yyyy")))
    "M/d/yy")

  ;; Output primitives. Nothing is written at or past $cap, so a $cap of 0
  ;; only counts; every one returns the advanced position.
  (func $dtf_put (param $out_g i32) (param $cap i32) (param $pos i32) (param $ch i32) (result i32)
    (if (i32.lt_u (local.get $pos) (local.get $cap))
      (then (call $gs8 (i32.add (local.get $out_g) (local.get $pos)) (local.get $ch))))
    (i32.add (local.get $pos) (i32.const 1)))

  (func $dtf_put_str (param $out_g i32) (param $cap i32) (param $pos i32) (param $wa i32) (result i32)
    (local $ch i32)
    (block $done (loop $copy
      (local.set $ch (i32.load8_u (local.get $wa)))
      (br_if $done (i32.eqz (local.get $ch)))
      (local.set $pos (call $dtf_put (local.get $out_g) (local.get $cap) (local.get $pos) (local.get $ch)))
      (local.set $wa (i32.add (local.get $wa) (i32.const 1)))
      (br $copy)))
    (local.get $pos))

  ;; Decimal $n, zero-padded to at least $width digits.
  (func $dtf_put_num (param $out_g i32) (param $cap i32) (param $pos i32) (param $n i32) (param $width i32) (result i32)
    (local $digits i32) (local $scale i32) (local $k i32)
    (local.set $digits (i32.const 1))
    (local.set $scale (i32.const 1))
    (block $sized (loop $size
      (br_if $sized (i32.and
        (i32.lt_u (i32.div_u (local.get $n) (local.get $scale)) (i32.const 10))
        (i32.ge_u (local.get $digits) (local.get $width))))
      (local.set $digits (i32.add (local.get $digits) (i32.const 1)))
      (local.set $scale (i32.mul (local.get $scale) (i32.const 10)))
      (br $size)))
    (block $done (loop $emit
      (local.set $pos (call $dtf_put (local.get $out_g) (local.get $cap) (local.get $pos)
        (i32.add (i32.const 0x30)
          (i32.rem_u (i32.div_u (local.get $n) (local.get $scale)) (i32.const 10)))))
      (br_if $done (i32.le_u (local.get $scale) (i32.const 1)))
      (local.set $scale (i32.div_u (local.get $scale) (i32.const 10)))
      (br $emit)))
    (local.get $pos))

  (func $dtf_pic_char (param $pic i32) (param $guest i32) (param $i i32) (result i32)
    ;; A picture string longer than any real one is treated as ended, so an
    ;; unterminated guest buffer cannot run the formatter away.
    (if (i32.ge_u (local.get $i) (i32.const 1024)) (then (return (i32.const 0))))
    (if (result i32) (local.get $guest)
      (then (call $gl8 (i32.add (local.get $pic) (local.get $i))))
      (else (i32.load8_u (i32.add (local.get $pic) (local.get $i))))))

  ;; Expand a GetDateFormat ($time = 0: d M y g) or GetTimeFormat ($time = 1:
  ;; h H m s t) picture over the SYSTEMTIME at wasm address $st. Characters
  ;; of the other family, and anything else outside quotes, are literal;
  ;; 'text' is literal and '' inside it is one quote. TIME_NOSECONDS,
  ;; TIME_NOMINUTESORSECONDS and TIME_NOTIMEMARKER drop their element together
  ;; with the separator in front of it (or, leading, the one after it), so
  ;; "h:mm:ss tt" becomes "h:mm tt" / "h tt" / "h:mm:ss". Returns the length
  ;; without the NUL; writes only below $cap.
  (func $dtf_format (param $st i32) (param $pic i32) (param $pic_guest i32)
      (param $time i32) (param $flags i32) (param $out_g i32) (param $cap i32) (result i32)
    (local $i i32) (local $ch i32) (local $n i32) (local $pos i32) (local $v i32)
    (local $field_end i32) (local $drop i32) (local $is_field i32) (local $skip i32)
    (block $done (loop $scan
      (local.set $ch (call $dtf_pic_char (local.get $pic) (local.get $pic_guest) (local.get $i)))
      (br_if $done (i32.eqz (local.get $ch)))
      (if (i32.eq (local.get $ch) (i32.const 0x27)) ;; quoted literal
        (then
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (block $qend (loop $q
            (local.set $ch (call $dtf_pic_char (local.get $pic) (local.get $pic_guest) (local.get $i)))
            (br_if $qend (i32.eqz (local.get $ch)))
            (if (i32.eq (local.get $ch) (i32.const 0x27))
              (then
                (local.set $i (i32.add (local.get $i) (i32.const 1)))
                (br_if $qend (i32.ne
                  (call $dtf_pic_char (local.get $pic) (local.get $pic_guest) (local.get $i))
                  (i32.const 0x27)))))
            (if (i32.eqz (local.get $drop))
              (then (local.set $pos (call $dtf_put (local.get $out_g) (local.get $cap)
                (local.get $pos) (local.get $ch)))))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $q)))
          (br $scan)))
      (local.set $is_field
        (if (result i32) (local.get $time)
          (then (i32.or
            (i32.or (i32.eq (local.get $ch) (i32.const 0x68)) (i32.eq (local.get $ch) (i32.const 0x48))) ;; h H
            (i32.or (i32.eq (local.get $ch) (i32.const 0x6D))                                          ;; m
              (i32.or (i32.eq (local.get $ch) (i32.const 0x73)) (i32.eq (local.get $ch) (i32.const 0x74)))))) ;; s t
          (else (i32.or
            (i32.or (i32.eq (local.get $ch) (i32.const 0x64)) (i32.eq (local.get $ch) (i32.const 0x4D))) ;; d M
            (i32.or (i32.eq (local.get $ch) (i32.const 0x79)) (i32.eq (local.get $ch) (i32.const 0x67))))))) ;; y g
      (if (i32.eqz (local.get $is_field))
        (then
          (if (i32.eqz (local.get $drop))
            (then (local.set $pos (call $dtf_put (local.get $out_g) (local.get $cap)
              (local.get $pos) (local.get $ch)))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $scan)))
      ;; A run of one element character: its length picks the form.
      (local.set $n (i32.const 1))
      (block $run_end (loop $run
        (br_if $run_end (i32.ne
          (call $dtf_pic_char (local.get $pic) (local.get $pic_guest)
            (i32.add (local.get $i) (local.get $n)))
          (local.get $ch)))
        (local.set $n (i32.add (local.get $n) (i32.const 1)))
        (br $run)))
      (local.set $i (i32.add (local.get $i) (local.get $n)))
      (local.set $skip (i32.and (local.get $time)
        (i32.or
          (i32.and (i32.eq (local.get $ch) (i32.const 0x73))                       ;; s
            (i32.ne (i32.and (local.get $flags) (i32.const 3)) (i32.const 0)))
          (i32.or
            (i32.and (i32.eq (local.get $ch) (i32.const 0x6D))                     ;; m
              (i32.ne (i32.and (local.get $flags) (i32.const 1)) (i32.const 0)))
            (i32.and (i32.eq (local.get $ch) (i32.const 0x74))                     ;; t
              (i32.ne (i32.and (local.get $flags) (i32.const 4)) (i32.const 0)))))))
      (if (local.get $skip)
        (then
          (local.set $pos (local.get $field_end))
          (local.set $drop (i32.eqz (local.get $field_end)))
          (br $scan)))
      (local.set $drop (i32.const 0))
      (if (i32.eq (local.get $ch) (i32.const 0x64)) ;; d
        (then
          (if (i32.le_u (local.get $n) (i32.const 2))
            (then (local.set $pos (call $dtf_put_num (local.get $out_g) (local.get $cap) (local.get $pos)
              (i32.load16_u offset=6 (local.get $st)) (local.get $n))))
            (else (local.set $pos (call $dtf_put_str (local.get $out_g) (local.get $cap) (local.get $pos)
              (call $cal_day_name (i32.load16_u offset=4 (local.get $st))
                (i32.eq (local.get $n) (i32.const 3)))))))))
      (if (i32.eq (local.get $ch) (i32.const 0x4D)) ;; M
        (then
          (if (i32.le_u (local.get $n) (i32.const 2))
            (then (local.set $pos (call $dtf_put_num (local.get $out_g) (local.get $cap) (local.get $pos)
              (i32.load16_u offset=2 (local.get $st)) (local.get $n))))
            (else (local.set $pos (call $dtf_put_str (local.get $out_g) (local.get $cap) (local.get $pos)
              (call $cal_month_name (i32.sub (i32.load16_u offset=2 (local.get $st)) (i32.const 1))
                (i32.eq (local.get $n) (i32.const 3)))))))))
      (if (i32.eq (local.get $ch) (i32.const 0x79)) ;; y
        (then
          (local.set $v (i32.load16_u offset=0 (local.get $st)))
          (local.set $pos (call $dtf_put_num (local.get $out_g) (local.get $cap) (local.get $pos)
            (select (i32.rem_u (local.get $v) (i32.const 100)) (local.get $v)
              (i32.le_u (local.get $n) (i32.const 2)))
            (select (local.get $n) (i32.const 1) (i32.le_u (local.get $n) (i32.const 2)))))))
      ;; g/gg (era): the Gregorian calendar of this locale has no era text.
      (if (i32.or (i32.eq (local.get $ch) (i32.const 0x68)) (i32.eq (local.get $ch) (i32.const 0x48))) ;; h H
        (then
          (local.set $v (i32.load16_u offset=8 (local.get $st)))
          (if (i32.and (i32.eq (local.get $ch) (i32.const 0x68))
                (i32.eqz (i32.and (local.get $flags) (i32.const 8)))) ;; not TIME_FORCE24HOURFORMAT
            (then
              (local.set $v (i32.rem_u (local.get $v) (i32.const 12)))
              (if (i32.eqz (local.get $v)) (then (local.set $v (i32.const 12))))))
          (local.set $pos (call $dtf_put_num (local.get $out_g) (local.get $cap) (local.get $pos)
            (local.get $v) (select (i32.const 2) (i32.const 1) (i32.ge_u (local.get $n) (i32.const 2)))))))
      (if (i32.or (i32.eq (local.get $ch) (i32.const 0x6D)) (i32.eq (local.get $ch) (i32.const 0x73))) ;; m s
        (then
          (local.set $pos (call $dtf_put_num (local.get $out_g) (local.get $cap) (local.get $pos)
            (select (i32.load16_u offset=10 (local.get $st)) (i32.load16_u offset=12 (local.get $st))
              (i32.eq (local.get $ch) (i32.const 0x6D)))
            (select (i32.const 2) (i32.const 1) (i32.ge_u (local.get $n) (i32.const 2)))))))
      (if (i32.eq (local.get $ch) (i32.const 0x74)) ;; t
        (then
          (local.set $v (select "AM" "PM"
            (i32.lt_u (i32.load16_u offset=8 (local.get $st)) (i32.const 12))))
          (if (i32.eq (local.get $n) (i32.const 1))
            (then (local.set $pos (call $dtf_put (local.get $out_g) (local.get $cap) (local.get $pos)
              (i32.load8_u (local.get $v)))))
            (else (local.set $pos (call $dtf_put_str (local.get $out_g) (local.get $cap) (local.get $pos)
              (local.get $v)))))))
      (local.set $field_end (local.get $pos))
      (br $scan)))
    (local.get $pos))

  ;; Fill the 16-byte SYSTEMTIME at guest $st from the caller's $src, or with
  ;; the current local time when $src is NULL, and validate the members the
  ;; call uses: the date for GetDateFormat (whose wDayOfWeek Windows ignores
  ;; and recomputes), the time for GetTimeFormat. 0 = ERROR_INVALID_PARAMETER.
  (func $dtf_load_time (param $src i32) (param $st i32) (param $time i32) (result i32)
    (local $i i32) (local $wa i32) (local $y i32) (local $m i32) (local $d i32)
    (local.set $wa (call $g2w (local.get $st)))
    (if (local.get $src)
      (then
        (block $copied (loop $copy
          (br_if $copied (i32.ge_u (local.get $i) (i32.const 16)))
          (i32.store16 (i32.add (local.get $wa) (local.get $i))
            (call $gl16 (i32.add (local.get $src) (local.get $i))))
          (local.set $i (i32.add (local.get $i) (i32.const 2)))
          (br $copy))))
      (else (drop (call $host_wall_clock (local.get $wa) (i32.const 1)))))
    (if (local.get $time)
      (then
        (return (i32.and
          (i32.and (i32.lt_u (i32.load16_u offset=8 (local.get $wa)) (i32.const 24))
            (i32.lt_u (i32.load16_u offset=10 (local.get $wa)) (i32.const 60)))
          (i32.and (i32.lt_u (i32.load16_u offset=12 (local.get $wa)) (i32.const 60))
            (i32.lt_u (i32.load16_u offset=14 (local.get $wa)) (i32.const 1000)))))))
    (local.set $y (i32.load16_u offset=0 (local.get $wa)))
    (local.set $m (i32.load16_u offset=2 (local.get $wa)))
    (local.set $d (i32.load16_u offset=6 (local.get $wa)))
    (if (i32.or
          (i32.or (i32.lt_u (local.get $y) (i32.const 1601)) (i32.gt_u (local.get $y) (i32.const 30827)))
          (i32.or
            (i32.or (i32.eqz (local.get $m)) (i32.gt_u (local.get $m) (i32.const 12)))
            (i32.or (i32.eqz (local.get $d))
              (i32.gt_u (local.get $d) (call $cal_days_in_month (local.get $y) (local.get $m))))))
      (then (return (i32.const 0))))
    (i32.store16 offset=4 (local.get $wa)
      (call $cal_day_of_week (local.get $y) (local.get $m) (local.get $d)))
    (i32.const 1))

  ;; The body of GetDateFormatA ($time = 0) and GetTimeFormatA ($time = 1).
  ;; Returns the API result and sets the last error on failure. $cch == 0 is
  ;; the size query (characters including the NUL; $out is not touched); a
  ;; buffer that is too small is left untouched too.
  (func $dtf_api (param $flags i32) (param $src i32) (param $pic i32)
      (param $out i32) (param $cch i32) (param $time i32) (result i32)
    (local $valid i32) (local $pic_guest i32) (local $st i32) (local $len i32)
    (if (i32.or (i32.lt_s (local.get $cch) (i32.const 0))
          (i32.and (i32.ne (local.get $cch) (i32.const 0)) (i32.eqz (local.get $out))))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (return (i32.const 0))))
    ;; LOCALE_NOUSEROVERRIDE and LOCALE_USE_CP_ACP, plus TIME_* (1|2|4|8) or
    ;; DATE_SHORTDATE, DATE_LONGDATE, DATE_USE_ALT_CALENDAR, DATE_YEARMONTH,
    ;; DATE_LTRREADING, DATE_RTLREADING (1..0x20). Short and long together are
    ;; contradictory.
    (local.set $valid (select (i32.const 0xC000000F) (i32.const 0xC000003F) (local.get $time)))
    (if (i32.or
          (i32.ne (i32.and (local.get $flags) (i32.xor (local.get $valid) (i32.const -1))) (i32.const 0))
          (i32.and (i32.eqz (local.get $time))
            (i32.eq (i32.and (local.get $flags) (i32.const 3)) (i32.const 3))))
      (then
        (global.set $last_error (i32.const 1004)) ;; ERROR_INVALID_FLAGS
        (return (i32.const 0))))
    (local.set $pic_guest (i32.ne (local.get $pic) (i32.const 0)))
    (if (i32.eqz (local.get $pic))
      (then (local.set $pic (call $dtf_default_picture
        (if (result i32) (local.get $time)
          (then (i32.const 2))
          (else (if (result i32) (i32.and (local.get $flags) (i32.const 2))  ;; DATE_LONGDATE
            (then (i32.const 1))
            (else (select (i32.const 3) (i32.const 0)
              (i32.ne (i32.and (local.get $flags) (i32.const 8)) (i32.const 0)))))))))))  ;; DATE_YEARMONTH
    (local.set $st (call $heap_alloc (i32.const 16)))
    (if (i32.eqz (local.get $st))
      (then
        (global.set $last_error (i32.const 8)) ;; ERROR_NOT_ENOUGH_MEMORY
        (return (i32.const 0))))
    (if (i32.eqz (call $dtf_load_time (local.get $src) (local.get $st) (local.get $time)))
      (then
        (call $heap_free (local.get $st))
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (return (i32.const 0))))
    (local.set $len (call $dtf_format (call $g2w (local.get $st)) (local.get $pic) (local.get $pic_guest)
      (local.get $time) (local.get $flags) (i32.const 0) (i32.const 0)))
    (if (i32.eqz (local.get $cch))
      (then
        (call $heap_free (local.get $st))
        (return (i32.add (local.get $len) (i32.const 1)))))
    (if (i32.lt_u (local.get $cch) (i32.add (local.get $len) (i32.const 1)))
      (then
        (call $heap_free (local.get $st))
        (global.set $last_error (i32.const 122)) ;; ERROR_INSUFFICIENT_BUFFER
        (return (i32.const 0))))
    (drop (call $dtf_format (call $g2w (local.get $st)) (local.get $pic) (local.get $pic_guest)
      (local.get $time) (local.get $flags) (local.get $out) (local.get $cch)))
    (call $gs8 (i32.add (local.get $out) (local.get $len)) (i32.const 0))
    (call $heap_free (local.get $st))
    (i32.add (local.get $len) (i32.const 1)))

  ;; 7: GetTimeFormatA(Locale, dwFlags, lpTime, lpFormat, lpTimeStr, cchTime) — 6 args stdcall.
  ;; Every locale formats as en-US, the only one this Win98 installs.
  (func $handle_GetTimeFormatA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $dtf_api
      (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4)
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
      (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))  ;; stdcall, 6 args + ret
  )

  ;; 8: GetDateFormatA(Locale, dwFlags, lpDate, lpFormat, lpDateStr, cchDate) — 6 args stdcall
  (func $handle_GetDateFormatA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $dtf_api
      (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4)
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
      (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))  ;; stdcall, 6 args + ret
  )

  ;; EnumDateFormatsA / EnumTimeFormatsA invoke one stable US-English format
  ;; callback per call. Callers such as Win98 WordPad request short and long
  ;; date formats separately, so one representative for each flag is enough
  ;; to populate their Date and Time dialog without inventing locale state.
  ;; The picture is the one GetDateFormatA/GetTimeFormatA and GetLocaleInfo
  ;; use as the default, so the three can never disagree.
  (func $locale_format_enum_a (param $callback i32) (param $flags i32)
        (param $ret_addr i32) (param $is_time i32)
    (local $text i32) (local $wa i32) (local $src i32) (local $i i32)
    (if (i32.eqz (local.get $callback))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (global.set $eip (local.get $ret_addr))
        (return)))
    (local.set $text (call $heap_alloc (i32.const 32)))
    (local.set $wa (call $g2w (local.get $text)))
    (call $zero_memory (local.get $wa) (i32.const 32))
    (local.set $src (call $dtf_default_picture
      (if (result i32) (local.get $is_time)
        (then (i32.const 2))
        (else (select (i32.const 1) (i32.const 0)
          (i32.ne (i32.and (local.get $flags) (i32.const 2)) (i32.const 0))))))) ;; DATE_LONGDATE
    (block $copied (loop $copy
      (br_if $copied (i32.eqz (i32.load8_u (i32.add (local.get $src) (local.get $i)))))
      (br_if $copied (i32.ge_u (local.get $i) (i32.const 31)))
      (i32.store8 (i32.add (local.get $wa) (local.get $i))
        (i32.load8_u (i32.add (local.get $src) (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $copy)))
    ;; Preserve the API caller return address above the callback's stdcall
    ;; frame. CACA0011 is a generic one-callback continuation: it restores this
    ;; address after the callback has popped its LPSTR argument.
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $ret_addr))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $text))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $font_enum_ret_thunk))
    (global.set $eip (local.get $callback))
    (global.set $steps (i32.const 0)))

  (func $handle_EnumDateFormatsA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret i32)
    (local.set $ret (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    (call $locale_format_enum_a (local.get $arg0) (local.get $arg2) (local.get $ret) (i32.const 0)))

  (func $handle_EnumTimeFormatsA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret i32)
    (local.set $ret (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    (call $locale_format_enum_a (local.get $arg0) (local.get $arg2) (local.get $ret) (i32.const 1)))

  ;; EnumResourceLanguagesW(hModule, type, name, callback, lParam). PE resource
  ;; lookup already falls back to the available language; enumerate the stable
  ;; US-English LANGID expected by Win98 common controls and MFC property sheets.
  (func $handle_EnumResourceLanguagesW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret i32)
    (local.set $ret (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
    (if (i32.eqz (local.get $arg3))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (global.set $eip (local.get $ret))
        (return)))
    ;; Preserve API return and push ENUMRESLANGPROCW args right-to-left.
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $ret))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $arg4))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0x0409))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $arg2))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $font_enum_ret_thunk))
    (global.set $eip (local.get $arg3))
    (global.set $steps (i32.const 0)))

  ;; Release the ANSI copy of a named PE resource after its callback has
  ;; returned. Integer MAKEINTRESOURCE names never allocate this buffer.
  (func $enum_rsrc_release_name
    (if (global.get $enum_rsrc_namebuf)
      (then
        (call $heap_free (global.get $enum_rsrc_namebuf))
        (global.set $enum_rsrc_namebuf (i32.const 0)))))

  ;; Complete an ANSI enumeration after exhausting the directory or after its
  ;; callback asks us to stop. The saved API return address is the one word
  ;; left on the stack after the callback's stdcall return.
  (func $enum_rsrc_finish (param $success i32)
    (local $frame i32)
    (call $enum_rsrc_release_name)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (global.set $eip (global.get $enum_rsrc_ret))
    (local.set $frame (global.get $enum_rsrc_frame))
    (global.set $enum_rsrc_module (call $gl32 (i32.add (local.get $frame) (i32.const 4))))
    (global.set $enum_rsrc_type (call $gl32 (i32.add (local.get $frame) (i32.const 8))))
    (global.set $enum_rsrc_cb (call $gl32 (i32.add (local.get $frame) (i32.const 12))))
    (global.set $enum_rsrc_lparam (call $gl32 (i32.add (local.get $frame) (i32.const 16))))
    (global.set $enum_rsrc_ret (call $gl32 (i32.add (local.get $frame) (i32.const 20))))
    (global.set $enum_rsrc_dir (call $gl32 (i32.add (local.get $frame) (i32.const 24))))
    (global.set $enum_rsrc_index (call $gl32 (i32.add (local.get $frame) (i32.const 28))))
    (global.set $enum_rsrc_count (call $gl32 (i32.add (local.get $frame) (i32.const 32))))
    (global.set $enum_rsrc_namebuf (call $gl32 (i32.add (local.get $frame) (i32.const 36))))
    (global.set $enum_rsrc_depth (call $gl32 (i32.add (local.get $frame) (i32.const 40))))
    (global.set $enum_rsrc_kind (call $gl32 (i32.add (local.get $frame) (i32.const 44))))
    (global.set $enum_rsrc_name (call $gl32 (i32.add (local.get $frame) (i32.const 48))))
    (global.set $enum_rsrc_frame (call $gl32 (local.get $frame)))
    (call $heap_free (local.get $frame))
    (i32.store offset=0 (global.get $reg_base) (local.get $success)))

  ;; Invoke the callback for the current directory entry. PE named
  ;; entries are length-prefixed UTF-16; Win32's A API instead supplies a
  ;; temporary NUL-terminated ANSI name. Integer IDs pass through unchanged.
  (func $enum_rsrc_dispatch
    (local $entry i32) (local $eid i32) (local $name i32)
    (local $name_wa i32) (local $len i32) (local $i i32) (local $ch i32)
    (call $enum_rsrc_release_name)
    (if (i32.ge_u (global.get $enum_rsrc_index) (global.get $enum_rsrc_count))
      (then (call $enum_rsrc_finish (i32.const 1)) (return)))
    (call $push_rsrc_ctx (global.get $enum_rsrc_module))
    (local.set $entry (i32.add (global.get $enum_rsrc_dir)
      (i32.add (i32.const 16)
        (i32.mul (global.get $enum_rsrc_index) (i32.const 8)))))
    (local.set $eid (call $gl32 (i32.add (call $r_base) (local.get $entry))))
    (if (i32.and (local.get $eid) (i32.const 0x80000000))
      (then
        (local.set $name_wa (call $g2w (i32.add (call $r_base)
          (i32.add (call $r_rva)
            (i32.and (local.get $eid) (i32.const 0x7fffffff))))))
        (local.set $len (i32.load16_u (local.get $name_wa)))
        (global.set $enum_rsrc_namebuf
          (call $heap_alloc (i32.add (local.get $len) (i32.const 1))))
        (if (i32.eqz (global.get $enum_rsrc_namebuf))
          (then
            (call $pop_rsrc_ctx)
            (global.set $last_error (i32.const 8))
            (call $enum_rsrc_finish (i32.const 0))
            (return)))
        (block $copied (loop $copy
          (br_if $copied (i32.ge_u (local.get $i) (local.get $len)))
          (local.set $ch (i32.load16_u (i32.add (local.get $name_wa)
            (i32.add (i32.const 2) (i32.mul (local.get $i) (i32.const 2))))))
          ;; Use the same Windows-1252 conversion as other ANSI entry points.
          (local.set $ch (call $dpw_encode1252 (local.get $ch)))
          (call $gs8 (i32.add (global.get $enum_rsrc_namebuf) (local.get $i))
            (local.get $ch))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $copy)))
        (call $gs8 (i32.add (global.get $enum_rsrc_namebuf) (local.get $len))
          (i32.const 0))
        (local.set $name (global.get $enum_rsrc_namebuf)))
      (else
        (local.set $name (i32.and (local.get $eid) (i32.const 0xffff)))))
    (call $pop_rsrc_ctx)
    ;; stdcall callbacks: module, [type, [name,]] enumerated value, lParam.
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $enum_rsrc_lparam))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $name))
    (if (i32.eq (global.get $enum_rsrc_kind) (i32.const 2))
      (then
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $enum_rsrc_name))))
    (if (global.get $enum_rsrc_kind)
      (then
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $enum_rsrc_type))))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $enum_rsrc_module))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $enum_rsrc_thunk))
    (global.set $eip (global.get $enum_rsrc_cb))
    (global.set $steps (i32.const 0)))

  ;; CACA0030: callback returned. FALSE requests early termination;
  ;; TRUE advances to the next entry in this invocation's directory.
  (func $enum_rsrc_continue
    (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
      (then
        ;; Windows 98/XP report ERROR_SUCCESS for callback-requested stop.
        (global.set $last_error (i32.const 0))
        (call $enum_rsrc_finish (i32.const 0)) (return)))
    (global.set $enum_rsrc_index
      (i32.add (global.get $enum_rsrc_index) (i32.const 1)))
    (call $enum_rsrc_dispatch))

  ;; Shared ANSI resource walk: kind 0=types, 1=names, 2=languages.
  ;; Resolve the directory before invoking guest code; never retain the shared
  ;; resource lookup context across callbacks. Each invocation owns its state.
  (func $enum_rsrc_begin (param $kind i32) (param $module i32)
      (param $type i32) (param $name i32) (param $cb i32)
      (param $lparam i32) (param $ret i32)
    (local $idx i32) (local $dir i32) (local $subdir i32)
    (local $dir_wa i32) (local $count i32) (local $frame i32)
    (local $stride i32) (local $error i32)
    (global.set $eip (local.get $ret))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (if (i32.eqz (local.get $cb))
      (then (global.set $last_error (i32.const 87)) (return)))
    ;; push_rsrc_ctx intentionally falls back for unknown handles. Enumeration
    ;; must reject those, and must not enumerate the EXE for a resource-less DLL.
    (if (i32.and (i32.ne (local.get $module) (i32.const 0))
                 (i32.ne (local.get $module) (global.get $image_base)))
      (then
        (local.set $idx (call $find_dll_by_base (local.get $module)))
        (if (i32.lt_s (local.get $idx) (i32.const 0))
          (then (global.set $last_error (i32.const 6)) (return)))
        (if (i32.eqz (i32.load (i32.add (global.get $DLL_RSRC_TABLE)
              (i32.mul (local.get $idx) (i32.const 8)))))
          (then (global.set $last_error (i32.const 1812)) (return)))))
    (call $push_rsrc_ctx (local.get $module))
    (local.set $stride (global.get $rsrc_name_char_stride))
    (global.set $rsrc_name_char_stride (i32.const 1))
    (block $resolved
      (local.set $error (i32.const 1812))
      (br_if $resolved (i32.eqz (call $r_rva)))
      (local.set $dir (call $r_rva))
      (if (local.get $kind)
        (then
          (local.set $error (i32.const 1813))
          (local.set $subdir (call $rsrc_find_entry (local.get $dir) (local.get $type)))
          (br_if $resolved (i32.eqz (i32.and (local.get $subdir) (i32.const 0x80000000))))
          (local.set $dir (i32.add (call $r_rva) (i32.and (local.get $subdir) (i32.const 0x7fffffff))))))
      (if (i32.eq (local.get $kind) (i32.const 2))
        (then
          (local.set $error (i32.const 1814))
          (local.set $subdir (call $rsrc_find_entry (local.get $dir) (local.get $name)))
          (br_if $resolved (i32.eqz (i32.and (local.get $subdir) (i32.const 0x80000000))))
          (local.set $dir (i32.add (call $r_rva) (i32.and (local.get $subdir) (i32.const 0x7fffffff))))))
      (local.set $dir_wa (call $g2w (i32.add (call $r_base) (local.get $dir))))
      (local.set $count (i32.add (i32.load16_u offset=12 (local.get $dir_wa))
                                (i32.load16_u offset=14 (local.get $dir_wa))))
      (local.set $error (i32.add (i32.const 1813) (local.get $kind)))
      (br_if $resolved (i32.eqz (local.get $count)))
      (local.set $error (i32.const 0)))
    (global.set $rsrc_name_char_stride (local.get $stride))
    (call $pop_rsrc_ctx)
    (if (local.get $error)
      (then (global.set $last_error (local.get $error)) (return)))
    (local.set $frame (call $heap_alloc (i32.const 52)))
    (if (i32.eqz (local.get $frame))
      (then (global.set $last_error (i32.const 8)) (return)))
    (call $gs32 (i32.add (local.get $frame) (i32.const 0)) (global.get $enum_rsrc_frame))
    (call $gs32 (i32.add (local.get $frame) (i32.const 4)) (global.get $enum_rsrc_module))
    (call $gs32 (i32.add (local.get $frame) (i32.const 8)) (global.get $enum_rsrc_type))
    (call $gs32 (i32.add (local.get $frame) (i32.const 12)) (global.get $enum_rsrc_cb))
    (call $gs32 (i32.add (local.get $frame) (i32.const 16)) (global.get $enum_rsrc_lparam))
    (call $gs32 (i32.add (local.get $frame) (i32.const 20)) (global.get $enum_rsrc_ret))
    (call $gs32 (i32.add (local.get $frame) (i32.const 24)) (global.get $enum_rsrc_dir))
    (call $gs32 (i32.add (local.get $frame) (i32.const 28)) (global.get $enum_rsrc_index))
    (call $gs32 (i32.add (local.get $frame) (i32.const 32)) (global.get $enum_rsrc_count))
    (call $gs32 (i32.add (local.get $frame) (i32.const 36)) (global.get $enum_rsrc_namebuf))
    (call $gs32 (i32.add (local.get $frame) (i32.const 40)) (global.get $enum_rsrc_depth))
    (call $gs32 (i32.add (local.get $frame) (i32.const 44)) (global.get $enum_rsrc_kind))
    (call $gs32 (i32.add (local.get $frame) (i32.const 48)) (global.get $enum_rsrc_name))
    (global.set $enum_rsrc_frame (local.get $frame))
    (global.set $enum_rsrc_namebuf (i32.const 0))
    (global.set $enum_rsrc_dir (local.get $dir))
    (global.set $enum_rsrc_module (local.get $module))
    (global.set $enum_rsrc_type (local.get $type))
    (global.set $enum_rsrc_name (local.get $name))
    (global.set $enum_rsrc_kind (local.get $kind))
    (global.set $enum_rsrc_cb (local.get $cb))
    (global.set $enum_rsrc_lparam (local.get $lparam))
    (global.set $enum_rsrc_ret (local.get $ret))
    (global.set $enum_rsrc_index (i32.const 0))
    (global.set $enum_rsrc_count (local.get $count))
    (global.set $enum_rsrc_depth (i32.const 1))
    (global.set $last_error (i32.const 0))
    ;; Keep one saved return word below the callback's stdcall argument frame.
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $ret))
    (call $enum_rsrc_dispatch))

  (func $handle_EnumResourceTypesA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret i32)
    (local.set $ret (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    (call $enum_rsrc_begin (i32.const 0) (local.get $arg0) (i32.const 0) (i32.const 0) (local.get $arg1) (local.get $arg2) (local.get $ret)))

  (func $handle_EnumResourceNamesA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret i32)
    (local.set $ret (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
    (call $enum_rsrc_begin (i32.const 1) (local.get $arg0) (local.get $arg1) (i32.const 0) (local.get $arg2) (local.get $arg3) (local.get $ret)))

  (func $handle_EnumResourceLanguagesA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret i32)
    (local.set $ret (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
    (call $enum_rsrc_begin (i32.const 2) (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $ret)))

  ;; 9: GetProfileStringA(appName, keyName, default, retBuf, nSize) → chars copied
  (func $handle_GetProfileStringA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; GetProfileStringA(appName, keyName, default, retBuf, nSize) — 5 args stdcall
    ;; Same as GetPrivateProfileStringA with fileName="win.ini"
    (local $wa_esp i32) (local $nSize i32)
    (local.set $wa_esp (call $g2w (i32.load offset=16 (global.get $reg_base))))
    (local.set $nSize (i32.load (i32.add (local.get $wa_esp) (i32.const 20))))
    (i32.store offset=0 (global.get $reg_base) (call $host_ini_get_string
      (if (result i32) (local.get $arg0) (then (call $g2w (local.get $arg0))) (else (i32.const 0)))
      (if (result i32) (local.get $arg1) (then (call $g2w (local.get $arg1))) (else (i32.const 0)))
      (if (result i32) (local.get $arg2) (then (call $g2w (local.get $arg2))) (else (i32.const 0)))
      (local.get $arg3)
      (local.get $nSize)
      (global.get $win_ini_name_ptr)  ;; WASM ptr to "win.ini\0"
      (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
  )

  ;; GetProfileSectionA(appName, retBuf, nSize) → chars copied
  ;;
  ;; RichEdit queries win.ini's "FontSubstitutes" section while processing
  ;; clipboard and formatting paths. Returning an empty double-NUL section is
  ;; valid for "section exists but has no entries" and is safer than crashing;
  ;; callers that need real profile persistence still use GetProfileStringA /
  ;; WriteProfileStringA.
  (func $handle_GetProfileSectionA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $buf i32)
    (drop (local.get $arg0))
    (drop (local.get $arg3))
    (drop (local.get $arg4))
    (drop (local.get $name_ptr))
    (if (i32.and
          (i32.ne (local.get $arg1) (i32.const 0))
          (i32.gt_u (local.get $arg2) (i32.const 0)))
      (then
        (local.set $buf (call $g2w (local.get $arg1)))
        (i32.store8 (local.get $buf) (i32.const 0))
        (if (i32.gt_u (local.get $arg2) (i32.const 1))
          (then (i32.store8 (i32.add (local.get $buf) (i32.const 1)) (i32.const 0))))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 10: GetProfileIntA(appName, keyName, nDefault) — 3 args stdcall
  (func $handle_GetProfileIntA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_ini_get_int
      (call $g2w (local.get $arg0))
      (call $g2w (local.get $arg1))
      (local.get $arg2)
      (global.get $win_ini_name_ptr)
      (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  (func $locale_put_ascii (param $out_g i32) (param $index i32)
      (param $ch i32) (param $wide i32)
    (if (local.get $wide)
      (then (call $gs16
        (i32.add (local.get $out_g) (i32.mul (local.get $index) (i32.const 2)))
        (local.get $ch)))
      (else (call $gs8 (i32.add (local.get $out_g) (local.get $index)) (local.get $ch)))))

  ;; SetLocaleInfo stores user overrides under the same per-user registry key
  ;; that Win9x's Regional Settings control panel owns. Keeping the values in
  ;; the host registry rather than a mutable wasm global makes them visible to
  ;; every real guest-thread instance and lets them survive a browser reload.
  ;; Only the two writable string values this locale surface actually models
  ;; have names here; Get-only or otherwise unmodeled LCType values are not
  ;; accepted merely to make their callers proceed.
  (func $locale_override_name (param $lctype i32) (param $wide i32) (result i32)
    (if (i32.eq (local.get $lctype) (i32.const 0x0E)) ;; LOCALE_SDECIMAL
      (then (return
        (select "s\0D\0e\0c\0i\0m\0a\0l\0"
          "sDecimal" (local.get $wide)))))
    (if (i32.eq (local.get $lctype) (i32.const 0x0F)) ;; LOCALE_STHOUSAND
      (then (return
        (select "s\0T\0h\0o\0u\0s\0a\0n\0d\0"
          "sThousand" (local.get $wide)))))
    (i32.const 0))

  ;; Read one REG_SZ locale override. -1 means that no override exists and the
  ;; caller should use its built-in en-US default; 0 is a documented API
  ;; failure; a positive result is the character count including the NUL.
  (func $locale_read_override (param $lctype i32) (param $out_g i32)
      (param $cch i32) (param $wide i32) (result i32)
    (local $hkey i32) (local $count_g i32) (local $result i32)
    (local $bytes i32) (local $max_chars i32)
    (local.set $hkey (call $host_reg_open_key
      (i32.const 0x80000001) "Control Panel\\International" (i32.const 0))) ;; HKCU
    (if (i32.eqz (local.get $hkey)) (then (return (i32.const -1))))
    (local.set $count_g (call $heap_alloc (i32.const 4)))
    (if (i32.eqz (local.get $count_g))
      (then
        (drop (call $host_reg_close_key (local.get $hkey)))
        (global.set $last_error (i32.const 8)) ;; ERROR_NOT_ENOUGH_MEMORY
        (return (i32.const 0))))
    ;; Both supported values are capped at four characters including NUL.
    ;; Clamp an enormous caller count before converting WCHARs to bytes.
    (local.set $max_chars
      (select (local.get $cch) (i32.const 4)
        (i32.lt_u (local.get $cch) (i32.const 4))))
    (local.set $bytes
      (select (local.get $max_chars)
        (i32.shl (local.get $max_chars) (i32.const 1))
        (i32.eqz (local.get $wide))))
    (call $gs32 (local.get $count_g) (local.get $bytes))
    (local.set $result (call $host_reg_query_value
      (local.get $hkey) (call $locale_override_name
        (local.get $lctype) (local.get $wide))
      (i32.const 0) (local.get $out_g) (local.get $count_g) (local.get $wide)))
    (local.set $bytes (call $gl32 (local.get $count_g)))
    (drop (call $host_reg_close_key (local.get $hkey)))
    (call $heap_free (local.get $count_g))
    (if (i32.eq (local.get $result) (i32.const 2)) ;; ERROR_FILE_NOT_FOUND
      (then (return (i32.const -1))))
    (if (i32.eq (local.get $result) (i32.const 234)) ;; ERROR_MORE_DATA
      (then
        (global.set $last_error (i32.const 122)) ;; ERROR_INSUFFICIENT_BUFFER
        (return (i32.const 0))))
    (if (local.get $result)
      (then
        (global.set $last_error (local.get $result))
        (return (i32.const 0))))
    (select (local.get $bytes) (i32.shr_u (local.get $bytes) (i32.const 1))
      (i32.eqz (local.get $wide))))

  ;; Write the Win98 en-US English country name. Baldur's Gate Chapters I & II
  ;; uses this standard locale query as its North-American release gate.
  (func $locale_write_us_country (param $out_g i32) (param $cch i32)
      (param $wide i32) (result i32)
    (if (i32.eqz (local.get $cch)) (then (return (i32.const 14))))
    (if (i32.or (i32.eqz (local.get $out_g)) (i32.lt_u (local.get $cch) (i32.const 14)))
      (then
        (global.set $last_error (i32.const 122)) ;; ERROR_INSUFFICIENT_BUFFER
        (return (i32.const 0))))
    (call $locale_put_ascii (local.get $out_g) (i32.const 0) (i32.const 0x55) (local.get $wide)) ;; U
    (call $locale_put_ascii (local.get $out_g) (i32.const 1) (i32.const 0x6E) (local.get $wide)) ;; n
    (call $locale_put_ascii (local.get $out_g) (i32.const 2) (i32.const 0x69) (local.get $wide)) ;; i
    (call $locale_put_ascii (local.get $out_g) (i32.const 3) (i32.const 0x74) (local.get $wide)) ;; t
    (call $locale_put_ascii (local.get $out_g) (i32.const 4) (i32.const 0x65) (local.get $wide)) ;; e
    (call $locale_put_ascii (local.get $out_g) (i32.const 5) (i32.const 0x64) (local.get $wide)) ;; d
    (call $locale_put_ascii (local.get $out_g) (i32.const 6) (i32.const 0x20) (local.get $wide)) ;; space
    (call $locale_put_ascii (local.get $out_g) (i32.const 7) (i32.const 0x53) (local.get $wide)) ;; S
    (call $locale_put_ascii (local.get $out_g) (i32.const 8) (i32.const 0x74) (local.get $wide)) ;; t
    (call $locale_put_ascii (local.get $out_g) (i32.const 9) (i32.const 0x61) (local.get $wide)) ;; a
    (call $locale_put_ascii (local.get $out_g) (i32.const 10) (i32.const 0x74) (local.get $wide)) ;; t
    (call $locale_put_ascii (local.get $out_g) (i32.const 11) (i32.const 0x65) (local.get $wide)) ;; e
    (call $locale_put_ascii (local.get $out_g) (i32.const 12) (i32.const 0x73) (local.get $wide)) ;; s
    (call $locale_put_ascii (local.get $out_g) (i32.const 13) (i32.const 0) (local.get $wide))
    (i32.const 14))

  ;; The calendar half of the en-US locale: separators, the three picture
  ;; strings GetDateFormatA/GetTimeFormatA default to, their I* flag digits,
  ;; the AM/PM designators and the day and month names the formatter prints.
  ;; A WAT literal, or 0 for an LCType that is not one of these.
  (func $locale_calendar_text (param $base i32) (result i32)
    (if (i32.eq (local.get $base) (i32.const 0x1D)) (then (return "/")))   ;; LOCALE_SDATE
    (if (i32.eq (local.get $base) (i32.const 0x1E)) (then (return ":")))   ;; LOCALE_STIME
    (if (i32.eq (local.get $base) (i32.const 0x1F))                        ;; LOCALE_SSHORTDATE
      (then (return (call $dtf_default_picture (i32.const 0)))))
    (if (i32.eq (local.get $base) (i32.const 0x20))                        ;; LOCALE_SLONGDATE
      (then (return (call $dtf_default_picture (i32.const 1)))))
    (if (i32.eq (local.get $base) (i32.const 0x1003))                      ;; LOCALE_STIMEFORMAT
      (then (return (call $dtf_default_picture (i32.const 2)))))
    (if (i32.eq (local.get $base) (i32.const 0x28)) (then (return "AM")))  ;; LOCALE_S1159
    (if (i32.eq (local.get $base) (i32.const 0x29)) (then (return "PM")))  ;; LOCALE_S2359
    ;; IDATE/ILDATE (M-D-Y), ITIME (12-hour), ICENTURY, ITLZERO, IDAYLZERO,
    ;; IMONLZERO: all "0" for M/d/yy and h:mm:ss tt.
    (if (i32.and (i32.ge_u (local.get $base) (i32.const 0x21))
          (i32.le_u (local.get $base) (i32.const 0x27)))
      (then (return "0")))
    (if (i32.or (i32.eq (local.get $base) (i32.const 0x1005))              ;; ITIMEMARKPOSN: suffix
          (i32.or (i32.eq (local.get $base) (i32.const 0x100B))            ;; IOPTIONALCALENDAR
            (i32.eq (local.get $base) (i32.const 0x100D))))                ;; IFIRSTWEEKOFYEAR
      (then (return "0")))
    (if (i32.eq (local.get $base) (i32.const 0x1009)) (then (return "1"))) ;; ICALENDARTYPE: Gregorian
    (if (i32.eq (local.get $base) (i32.const 0x100C)) (then (return "6"))) ;; IFIRSTDAYOFWEEK: Sunday
    ;; SDAYNAME1..7 and SABBREVDAYNAME1..7 start the week on Monday.
    (if (i32.and (i32.ge_u (local.get $base) (i32.const 0x2A))
          (i32.le_u (local.get $base) (i32.const 0x30)))
      (then (return (call $cal_day_name (i32.sub (local.get $base) (i32.const 0x29)) (i32.const 0)))))
    (if (i32.and (i32.ge_u (local.get $base) (i32.const 0x31))
          (i32.le_u (local.get $base) (i32.const 0x37)))
      (then (return (call $cal_day_name (i32.sub (local.get $base) (i32.const 0x30)) (i32.const 1)))))
    (if (i32.and (i32.ge_u (local.get $base) (i32.const 0x38))
          (i32.le_u (local.get $base) (i32.const 0x43)))
      (then (return (call $cal_month_name (i32.sub (local.get $base) (i32.const 0x38)) (i32.const 0)))))
    (if (i32.and (i32.ge_u (local.get $base) (i32.const 0x44))
          (i32.le_u (local.get $base) (i32.const 0x4F)))
      (then (return (call $cal_month_name (i32.sub (local.get $base) (i32.const 0x44)) (i32.const 1)))))
    (i32.const 0))

  ;; Write one $locale_calendar_text value with GetLocaleInfo's contract.
  ;; LOCALE_RETURN_NUMBER is honoured for the numeric (single-digit) values
  ;; and returns a DWORD, whose size in characters is 4 (A) or 2 (W).
  (func $locale_write_text (param $text i32) (param $flags i32) (param $out_g i32)
      (param $cch i32) (param $wide i32) (result i32)
    (local $len i32) (local $i i32) (local $numeric i32) (local $need i32)
    (local $as_number i32)
    (local.set $as_number                                   ;; LOCALE_RETURN_NUMBER, bit 29
      (i32.and (i32.shr_u (local.get $flags) (i32.const 29)) (i32.const 1)))
    (local.set $numeric (i32.and
      (i32.lt_u (i32.sub (i32.load8_u (local.get $text)) (i32.const 0x30)) (i32.const 10))
      (i32.eqz (i32.load8_u offset=1 (local.get $text)))))
    (if (i32.or
          (i32.ne (i32.and (local.get $flags) (i32.const 0x1FFFFFFF)) (i32.const 0))
          (i32.and (local.get $as_number) (i32.eqz (local.get $numeric))))
      (then
        (global.set $last_error (i32.const 1004)) ;; ERROR_INVALID_FLAGS
        (return (i32.const 0))))
    (if (local.get $as_number)
      (then
        (local.set $need (select (i32.const 2) (i32.const 4) (local.get $wide)))
        (if (i32.eqz (local.get $cch)) (then (return (local.get $need))))
        (if (i32.lt_u (local.get $cch) (local.get $need))
          (then
            (global.set $last_error (i32.const 122)) ;; ERROR_INSUFFICIENT_BUFFER
            (return (i32.const 0))))
        (call $gs32 (local.get $out_g)
          (i32.sub (i32.load8_u (local.get $text)) (i32.const 0x30)))
        (return (local.get $need))))
    (local.set $len (i32.add (call $strlen_a (local.get $text)) (i32.const 1)))
    (if (i32.eqz (local.get $cch)) (then (return (local.get $len))))
    (if (i32.lt_u (local.get $cch) (local.get $len))
      (then
        (global.set $last_error (i32.const 122)) ;; ERROR_INSUFFICIENT_BUFFER
        (return (i32.const 0))))
    (block $done (loop $copy
      (br_if $done (i32.ge_u (local.get $i) (local.get $len)))
      (call $locale_put_ascii (local.get $out_g) (local.get $i)
        (i32.load8_u (i32.add (local.get $text) (local.get $i))) (local.get $wide))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $copy)))
    (local.get $len))

  ;; Return a small, internally consistent en-US locale surface. The A/W
  ;; spellings share character counts, including the terminating NUL.
  (func $locale_info (param $lctype i32) (param $out_g i32) (param $cch i32)
      (param $wide i32) (result i32)
    (local $ch i32) (local $base i32) (local $flags i32) (local $override i32)
    (local $text i32)
    (if (i32.lt_s (local.get $cch) (i32.const 0))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (return (i32.const 0))))
    (if (i32.and
          (i32.gt_u (local.get $cch) (i32.const 0))
          (i32.eqz (local.get $out_g)))
      (then
        (global.set $last_error (i32.const 122)) ;; ERROR_INSUFFICIENT_BUFFER
        (return (i32.const 0))))
    (local.set $base (i32.and (local.get $lctype) (i32.const 0xFFFF)))
    (local.set $flags (i32.and (local.get $lctype) (i32.const 0xFFFF0000)))
    ;; These string LCType values admit only NOUSEROVERRIDE and USE_CP_ACP.
    ;; RETURN_NUMBER (and every other bit) is invalid for string data.
    (if (i32.and
          (i32.or
            (i32.eq (local.get $base) (i32.const 0x0E))
            (i32.or
              (i32.eq (local.get $base) (i32.const 0x0F))
              (i32.eq (local.get $base) (i32.const 0x1002))))
          (i32.ne (i32.and (local.get $flags) (i32.const 0x3FFFFFFF))
            (i32.const 0)))
      (then
        (global.set $last_error (i32.const 1004)) ;; ERROR_INVALID_FLAGS
        (return (i32.const 0))))
    (if (i32.eq (local.get $base) (i32.const 0x1002)) ;; LOCALE_SENGCOUNTRY
      (then (return (call $locale_write_us_country
        (local.get $out_g) (local.get $cch) (local.get $wide)))))
    (if (i32.and
          (i32.or
            (i32.eq (local.get $base) (i32.const 0x0E))
            (i32.eq (local.get $base) (i32.const 0x0F)))
          (i32.eqz (i32.and (local.get $flags) (i32.const 0x80000000)))) ;; LOCALE_NOUSEROVERRIDE
      (then
        (local.set $override (call $locale_read_override
          (local.get $base) (local.get $out_g) (local.get $cch) (local.get $wide)))
        (if (i32.ne (local.get $override) (i32.const -1))
          (then (return (local.get $override))))))
    (local.set $text (call $locale_calendar_text (local.get $base)))
    (if (local.get $text)
      (then (return (call $locale_write_text (local.get $text) (local.get $flags)
        (local.get $out_g) (local.get $cch) (local.get $wide)))))
    (local.set $ch (i32.const 0x30))                                   ;; "0"
    (if (i32.eq (local.get $base) (i32.const 0x0E))                    ;; LOCALE_SDECIMAL
      (then (local.set $ch (i32.const 0x2E))))                         ;; "."
    (if (i32.eq (local.get $base) (i32.const 0x0F))                    ;; LOCALE_STHOUSAND
      (then (local.set $ch (i32.const 0x2C))))                         ;; ","
    (if (i32.eqz (local.get $cch)) (then (return (i32.const 2))))
    (if (i32.or (i32.eqz (local.get $out_g)) (i32.lt_u (local.get $cch) (i32.const 2)))
      (then
        (global.set $last_error (i32.const 122)) ;; ERROR_INSUFFICIENT_BUFFER
        (return (i32.const 0))))
    (if (local.get $wide)
      (then
        (call $gs16 (local.get $out_g) (local.get $ch))
        (call $gs16 (i32.add (local.get $out_g) (i32.const 2)) (i32.const 0)))
      (else
        (call $gs8 (local.get $out_g) (local.get $ch))
        (call $gs8 (i32.add (local.get $out_g) (i32.const 1)) (i32.const 0))))
    (i32.const 2))

  ;; 11: GetLocaleInfoA(Locale, LCType, lpLCData, cchData).
  (func $handle_GetLocaleInfoA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $locale_info
      (local.get $arg1) (local.get $arg2) (local.get $arg3) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; SetLocaleInfoA(Locale, LCType, lpLCData) stores the two mutable separator
  ;; strings this en-US locale surface exposes. Microsoft caps both strings at
  ;; four characters including NUL; keeping that bound also makes malformed
  ;; guest pointers fail without an unbounded scan.
  (func $handle_SetLocaleInfoA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $base i32) (local $flags i32) (local $len i32) (local $ch i32)
    (local $result_g i32) (local $hkey i32) (local $error i32)
    (local.set $base (i32.and (local.get $arg1) (i32.const 0xFFFF)))
    (local.set $flags (i32.and (local.get $arg1) (i32.const 0xFFFF0000)))
    (if (i32.ne (i32.and (local.get $flags) (i32.const 0xBFFFFFFF))
          (i32.const 0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (global.set $last_error (i32.const 1004)) ;; ERROR_INVALID_FLAGS
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (if (i32.or
          (i32.eqz (call $locale_override_name (local.get $base) (i32.const 0)))
          (i32.or
            (i32.eqz (local.get $arg2))
            (i32.eqz
              (i32.or
                (i32.eq (local.get $arg0) (i32.const 0x0409)) ;; en-US
                (i32.or
                  (i32.eq (local.get $arg0) (i32.const 0x0400)) ;; USER_DEFAULT
                  (i32.eq (local.get $arg0) (i32.const 0x0800))))))) ;; SYSTEM_DEFAULT
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (block $terminated (loop $scan
      (local.set $ch (call $gl8 (i32.add (local.get $arg2) (local.get $len))))
      (br_if $terminated (i32.eqz (local.get $ch)))
      (local.set $len (i32.add (local.get $len) (i32.const 1)))
      (if (i32.ge_u (local.get $len) (i32.const 4))
        (then
          (i32.store offset=0 (global.get $reg_base) (i32.const 0))
          (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
          (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
          (return)))
      (br $scan)))
    (if (i32.eqz (local.get $len))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (global.set $last_error (i32.const 87))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (local.set $result_g (call $heap_alloc (i32.const 4)))
    (if (i32.eqz (local.get $result_g))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (global.set $last_error (i32.const 8)) ;; ERROR_NOT_ENOUGH_MEMORY
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (call $gs32 (local.get $result_g) (i32.const 0))
    (local.set $error (call $host_reg_create_key
      (i32.const 0x80000001) "Control Panel\\International"
      (local.get $result_g) (i32.const 0) (i32.const 0)))
    (local.set $hkey (call $gl32 (local.get $result_g)))
    (if (i32.eqz (local.get $error))
      (then
        (local.set $error (call $host_reg_set_value
          (local.get $hkey) (call $locale_override_name
            (local.get $base) (i32.const 0))
          (i32.const 1) (local.get $arg2) ;; REG_SZ
          (i32.add (local.get $len) (i32.const 1)) (i32.const 0)))))
    (if (local.get $hkey)
      (then (drop (call $host_reg_close_key (local.get $hkey)))))
    (call $heap_free (local.get $result_g))
    (if (local.get $error)
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (global.set $last_error (local.get $error)))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 1))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))  ;; stdcall, 3 args
  )

  ;; SetThreadLocale(Locale) → BOOL. Locale identity belongs to the calling
  ;; thread. The host retains it on the same durable record as priority and COM
  ;; apartment state, so cooperative and real Worker threads agree.
  (func $handle_SetThreadLocale (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_set_thread_locale
      (local.get $arg0) (global.get $current_thread_id)))
    (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
      (then (global.set $last_error (i32.const 87)))) ;; ERROR_INVALID_PARAMETER
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; A successful LoadLibrary of the handle most recently passed to
  ;; FreeLibrary starts a new lifetime for that module. The loader keeps PE
  ;; images mapped, so the handle is deliberately reused; without clearing
  ;; this sentinel the next legitimate unload is mistaken for a repeated free.
  (func $freelib_mark_loaded (param $module i32)
    (if (i32.eq (local.get $module) (global.get $freelib_last_handle))
      (then (global.set $freelib_last_handle (i32.const 0)))))

  ;; 12: LoadLibraryA
  (global $loadlib_normalized_name (mut i32) (i32.const 0))
  ;; Per-instance scratch survives the async load yield. Only the basename
  ;; determines the default extension; a trailing dot suppresses appending.
  (func $loadlib_normalize_name (param $name i32) (result i32)
    (local $length i32) (local $dot i32) (local $ch i32) (local $dst i32)
    (if (i32.eqz (local.get $name)) (then (return (i32.const 0))))
    (block $end (loop $scan
      (if (i32.ge_u (local.get $length) (i32.const 260)) (then (return (i32.const 0))))
      (local.set $ch (call $gl8 (i32.add (local.get $name) (local.get $length))))
      (br_if $end (i32.eqz (local.get $ch)))
      (if (i32.or (i32.eq (local.get $ch) (i32.const 92))
            (i32.eq (local.get $ch) (i32.const 47)))
        (then (local.set $dot (i32.const 0))))
      (if (i32.eq (local.get $ch) (i32.const 46))
        (then (local.set $dot (i32.add (local.get $length) (i32.const 1)))))
      (local.set $length (i32.add (local.get $length) (i32.const 1))) (br $scan)))
    (if (i32.eqz (local.get $length)) (then (return (i32.const 0))))
    (if (i32.and (i32.ne (local.get $dot) (i32.const 0))
          (i32.ne (local.get $dot) (local.get $length)))
      (then (return (local.get $name))))
    (if (i32.and (i32.eqz (local.get $dot)) (i32.gt_u (local.get $length) (i32.const 255)))
      (then (return (i32.const 0))))
    (if (i32.eqz (global.get $loadlib_normalized_name))
      (then (global.set $loadlib_normalized_name (call $heap_alloc (i32.const 260)))))
    (if (i32.eqz (global.get $loadlib_normalized_name)) (then (return (i32.const 0))))
    (local.set $dst (call $g2w (global.get $loadlib_normalized_name)))
    (memory.copy (local.get $dst) (call $g2w (local.get $name)) (local.get $length))
    (if (local.get $dot)
      (then (i32.store8 (i32.add (local.get $dst) (i32.sub (local.get $length) (i32.const 1))) (i32.const 0)))
      (else
        (i32.store (i32.add (local.get $dst) (local.get $length)) (i32.const 0x6c6c642e))
        (i32.store8 (i32.add (local.get $dst) (i32.add (local.get $length) (i32.const 4))) (i32.const 0))))
    (global.get $loadlib_normalized_name))

  ;; True when guest path $name lives directly in $dir (a WAT string with no
  ;; trailing separator), compared case-insensitively with '/' read as '\'.
  (func $loadlib_path_in_dir (param $name i32) (param $dir i32) (result i32)
    (local $i i32) (local $sep i32) (local $c i32) (local $d i32)
    (local.set $sep (i32.const -1))
    (block $end (loop $scan
      (local.set $c (call $gl8 (i32.add (local.get $name) (local.get $i))))
      (br_if $end (i32.eqz (local.get $c)))
      (if (i32.or (i32.eq (local.get $c) (i32.const 92)) (i32.eq (local.get $c) (i32.const 47)))
        (then (local.set $sep (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $end (i32.ge_u (local.get $i) (i32.const 260)))
      (br $scan)))
    (if (i32.lt_s (local.get $sep) (i32.const 1)) (then (return (i32.const 0))))
    (local.set $i (i32.const 0))
    (block $done (loop $cmp
      (br_if $done (i32.ge_u (local.get $i) (local.get $sep)))
      (local.set $c (call $tolower (call $gl8 (i32.add (local.get $name) (local.get $i)))))
      (if (i32.eq (local.get $c) (i32.const 47)) (then (local.set $c (i32.const 92))))
      (local.set $d (call $tolower (i32.load8_u (i32.add (local.get $dir) (local.get $i)))))
      (if (i32.ne (local.get $c) (local.get $d)) (then (return (i32.const 0))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $cmp)))
    (i32.eqz (i32.load8_u (i32.add (local.get $dir) (local.get $sep)))))

  ;; A path into the system or Windows directory names the module installed
  ;; there, which for a built-in DLL is the one we dispatch: Win98's loader
  ;; finds C:\WINDOWS\SYSTEM\kernel32.dll already mapped. Wise installer
  ;; scripts (Die Hard: Nakatomi Plaza) load kernel32 by exactly that path to
  ;; call it, and abort setup when the answer is NULL.
  (func $loadlib_path_in_system_dirs (param $name i32) (result i32)
    (i32.or (call $loadlib_path_in_dir (local.get $name) "c:\\windows\\system")
            (call $loadlib_path_in_dir (local.get $name) "c:\\windows")))

  (func $handle_LoadLibraryA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $tmp i32) (local $src i32) (local $dst i32) (local $ch i32) (local $name_wa i32)
    (local.set $arg0 (call $loadlib_normalize_name (local.get $arg0)))
    (if (i32.eqz (local.get $arg0))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (global.set $last_error (i32.const 126))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))) (return)))
    (local.set $tmp (call $find_loaded_dll (local.get $arg0)))
    (if (i32.ge_s (local.get $tmp) (i32.const 0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.load (i32.add (global.get $DLL_TABLE) (i32.mul (local.get $tmp) (i32.const 32)))))
        (call $freelib_mark_loaded (i32.load offset=0 (global.get $reg_base)))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    ;; LoadLibrary of the running program is a handle request, not a load:
    ;; Windows finds the module already mapped and returns its base with the
    ;; reference count bumped. Winamp's NSIS installer takes this path -- its
    ;; CDDB plug-in asks for the path GetModuleFileName just gave it -- and
    ;; loading a second copy of the EXE image runs its entry point again from
    ;; a worker thread, which is where the extraction used to die.
    (if (call $dll_name_match (local.get $arg0) (global.get $exe_name_wa))
      (then
        (i32.store offset=0 (global.get $reg_base) (global.get $image_base))
        (call $freelib_mark_loaded (i32.load offset=0 (global.get $reg_base)))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    ;; Not already loaded — check if DLL file exists in VFS
    (local.set $name_wa (call $g2w (local.get $arg0)))
    (if (call $host_has_dll_file (local.get $name_wa))
      (then
        ;; DLL file found — yield to JS for loading
        (global.set $loadlib_name_ptr (local.get $name_wa))
        (global.set $eip (call $gl32 (i32.load offset=16 (global.get $reg_base))))
        (global.set $handler_set_eip (i32.const 1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (global.set $yield_reason (i32.const 5))
        (global.set $yield_flag (i32.const 1))
        (global.set $steps (i32.const 0))
        (return)))
    ;; uxtheme.dll is optional and absent on Win98. Returning a synthetic
    ;; handle makes VCL cache NULL theming procedure pointers, then call them.
    (if (call $dll_name_match (local.get $arg0) (i32.const 0x36D))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    ;; Windows Installer is not part of a stock Win98 box: instmsi.exe puts
    ;; msi.dll in the system directory, and from then on the VFS test above
    ;; loads that real file. Wise's MSI bootstrap (Arcanum's Setup.exe) probes
    ;; with exactly this LoadLibrary; the image_base fallback below told it MSI
    ;; was present, so it skipped instmsi and shell-executed the .msi into
    ;; nothing.
    (if (call $dll_name_match (local.get $arg0) "msi.dll")
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (global.set $last_error (i32.const 126)) ;; ERROR_MOD_NOT_FOUND
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (local.set $tmp (call $guest_name_is_static_system_dll (local.get $arg0)))
    ;; Not a system module by name and not a file we hold: a module whose name
    ;; is not a .dll at all has no static dispatch behind it, so report the
    ;; load failure Windows would rather than hand back a handle that resolves
    ;; to nothing.
    ;; A qualified path names one file on disk, and $host_has_dll_file already
    ;; said it is not there, so the load fails. Only a bare name may stand for
    ;; a component we dispatch by API name (dynamic d3d9.dll). Winamp's NSIS
    ;; installer unregisters a previous install's plug-ins by full path; a
    ;; handle here sent it into DllUnregisterServer on our own image.
    (local.set $src (i32.const 0))
    (local.set $dst (i32.const 0))
    (if (i32.eqz (local.get $tmp))
      (then
        (block $end (loop $scan
          (local.set $ch (call $gl8 (i32.add (local.get $arg0) (local.get $src))))
          (br_if $end (i32.eqz (local.get $ch)))
          (if (i32.or (i32.eq (local.get $ch) (i32.const 92))
                      (i32.or (i32.eq (local.get $ch) (i32.const 47))
                              (i32.eq (local.get $ch) (i32.const 58))))
            (then (local.set $dst (i32.const 1)) (br $end)))
          (local.set $src (i32.add (local.get $src) (i32.const 1)))
          (br $scan)))))
    ;; ...except a path into the system/Windows directory, which stands for the
    ;; bare name there exactly as a stem does.
    (if (i32.and (i32.eq (local.get $dst) (i32.const 1))
                 (call $loadlib_path_in_system_dirs (local.get $arg0)))
      (then (local.set $dst (i32.const 0))))
    (if (i32.and (i32.eqz (local.get $tmp))
                 (i32.or (i32.eq (local.get $dst) (i32.const 1))
                         (i32.eqz (call $guest_name_has_dll_ext (local.get $arg0)))))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (global.set $last_error (i32.const 126))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (i32.store offset=0 (global.get $reg_base) (select (i32.add (global.get $STATIC_SYS_DLL_HANDLE_BASE) (i32.sub (local.get $tmp) (i32.const 1))) (global.get $image_base) (i32.ne (local.get $tmp) (i32.const 0))))
    (call $freelib_mark_loaded (i32.load offset=0 (global.get $reg_base)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; LoadLibraryEx adds hFile and dwFlags to the encoding-specific LoadLibrary
  ;; entry point. Keep the common stack/yield behavior in one place: the base
  ;; handler consumes return+name, then this consumes the two Ex-only args.
  (func $handle_LoadLibraryEx_core (param $name i32) (param $hfile i32)
        (param $flags i32) (param $wide i32)
    (if (local.get $wide)
      (then
        (call $handle_LoadLibraryW
          (local.get $name) (local.get $hfile) (local.get $flags)
          (i32.const 0) (i32.const 0) (i32.const 0)))
      (else
        (call $handle_LoadLibraryA
          (local.get $name) (local.get $hfile) (local.get $flags)
          (i32.const 0) (i32.const 0) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_LoadLibraryExA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_LoadLibraryEx_core
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 0)))

  ;; Win32 DDEML state.  DDE objects are scoped to the instance returned by
  ;; DdeInitialize: passing a freed HSZ to another instance, using a dead
  ;; conversation, or reading a freed HDDEDATA must fail rather than treating
  ;; every non-zero integer as a handle.  The bounded repositories live in the
  ;; guest heap so they remain visible to every helper without a fixed address.
  ;;
  ;; Instance (8 x 24): id, callback, flags, last error, service HSZ, filter.
  ;; HSZ      (32 x 16): handle, owner id, refs, copied ANSI string.
  ;; HCONV     (8 x 16): handle, owner id, service HSZ, topic HSZ.
  ;; HDDEDATA (16 x 16): handle, owner id, copied bytes, byte count.
  (global $DDE32_INSTANCE_MAX i32 (i32.const 8))
  (global $DDE32_HSZ_MAX i32 (i32.const 32))
  (global $DDE32_CONV_MAX i32 (i32.const 8))
  (global $DDE32_DATA_MAX i32 (i32.const 16))
  (global $dde32_instances (mut i32) (i32.const 0))
  (global $dde32_hszs (mut i32) (i32.const 0))
  (global $dde32_convs (mut i32) (i32.const 0))
  (global $dde32_data (mut i32) (i32.const 0))
  (global $dde32_next_inst (mut i32) (i32.const 1))
  (global $dde32_next_hsz (mut i32) (i32.const 0xDD200000))
  (global $dde32_next_conv (mut i32) (i32.const 0xDD000100))
  (global $dde32_next_data (mut i32) (i32.const 0xDD100000))
  (global $dde32_current_inst (mut i32) (i32.const 0))

  (func $dde32_table_ensure (param $which i32) (result i32)
    (local $ptr i32) (local $size i32)
    (if (i32.eq (local.get $which) (i32.const 0))
      (then
        (if (i32.eqz (global.get $dde32_instances))
          (then
            (local.set $size (i32.mul (global.get $DDE32_INSTANCE_MAX) (i32.const 24)))
            (global.set $dde32_instances (call $heap_alloc (local.get $size)))
            (if (global.get $dde32_instances)
              (then (call $zero_memory (call $g2w (global.get $dde32_instances)) (local.get $size))))))
        (return (global.get $dde32_instances))))
    (if (i32.eq (local.get $which) (i32.const 1))
      (then
        (if (i32.eqz (global.get $dde32_hszs))
          (then
            (local.set $size (i32.mul (global.get $DDE32_HSZ_MAX) (i32.const 16)))
            (global.set $dde32_hszs (call $heap_alloc (local.get $size)))
            (if (global.get $dde32_hszs)
              (then (call $zero_memory (call $g2w (global.get $dde32_hszs)) (local.get $size))))))
        (return (global.get $dde32_hszs))))
    (if (i32.eq (local.get $which) (i32.const 2))
      (then
        (if (i32.eqz (global.get $dde32_convs))
          (then
            (local.set $size (i32.mul (global.get $DDE32_CONV_MAX) (i32.const 16)))
            (global.set $dde32_convs (call $heap_alloc (local.get $size)))
            (if (global.get $dde32_convs)
              (then (call $zero_memory (call $g2w (global.get $dde32_convs)) (local.get $size))))))
        (return (global.get $dde32_convs))))
    (if (i32.eqz (global.get $dde32_data))
      (then
        (local.set $size (i32.mul (global.get $DDE32_DATA_MAX) (i32.const 16)))
        (global.set $dde32_data (call $heap_alloc (local.get $size)))
        (if (global.get $dde32_data)
          (then (call $zero_memory (call $g2w (global.get $dde32_data)) (local.get $size))))))
    (global.get $dde32_data))

  (func $dde32_inst_find (param $id i32) (result i32)
    (local $i i32) (local $entry i32)
    (if (i32.eqz (local.get $id)) (then (return (i32.const 0))))
    (if (i32.eqz (global.get $dde32_instances)) (then (return (i32.const 0))))
    (block $missing (loop $scan
      (br_if $missing (i32.ge_u (local.get $i) (global.get $DDE32_INSTANCE_MAX)))
      (local.set $entry
        (i32.add (global.get $dde32_instances) (i32.mul (local.get $i) (i32.const 24))))
      (if (i32.eq (call $gl32 (local.get $entry)) (local.get $id))
        (then (return (local.get $entry))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  (func $dde32_set_error (param $id i32) (param $error i32)
    (local $entry i32)
    (local.set $entry (call $dde32_inst_find (local.get $id)))
    (if (local.get $entry)
      (then (call $gs32 (i32.add (local.get $entry) (i32.const 12)) (local.get $error)))))

  (func $dde32_hsz_find (param $handle i32) (param $owner i32) (result i32)
    (local $i i32) (local $entry i32)
    (if (i32.or (i32.eqz (local.get $handle)) (i32.eqz (local.get $owner)))
      (then (return (i32.const 0))))
    (if (i32.eqz (global.get $dde32_hszs)) (then (return (i32.const 0))))
    (block $missing (loop $scan
      (br_if $missing (i32.ge_u (local.get $i) (global.get $DDE32_HSZ_MAX)))
      (local.set $entry
        (i32.add (global.get $dde32_hszs) (i32.mul (local.get $i) (i32.const 16))))
      (if (i32.and
            (i32.eq (call $gl32 (local.get $entry)) (local.get $handle))
            (i32.eq (call $gl32 (i32.add (local.get $entry) (i32.const 4)))
              (local.get $owner)))
        (then (return (local.get $entry))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  (func $dde32_hsz_release_entry (param $entry i32)
    (local $refs i32) (local $string i32)
    (if (i32.eqz (local.get $entry)) (then (return)))
    (local.set $refs (call $gl32 (i32.add (local.get $entry) (i32.const 8))))
    (if (i32.gt_u (local.get $refs) (i32.const 1))
      (then
        (call $gs32 (i32.add (local.get $entry) (i32.const 8))
          (i32.sub (local.get $refs) (i32.const 1)))
        (return)))
    (local.set $string (call $gl32 (i32.add (local.get $entry) (i32.const 12))))
    (if (local.get $string) (then (call $heap_free (local.get $string))))
    (call $zero_memory (call $g2w (local.get $entry)) (i32.const 16)))

  (func $dde32_conv_find (param $handle i32) (result i32)
    (local $i i32) (local $entry i32)
    (if (i32.eqz (local.get $handle)) (then (return (i32.const 0))))
    (if (i32.eqz (global.get $dde32_convs)) (then (return (i32.const 0))))
    (block $missing (loop $scan
      (br_if $missing (i32.ge_u (local.get $i) (global.get $DDE32_CONV_MAX)))
      (local.set $entry
        (i32.add (global.get $dde32_convs) (i32.mul (local.get $i) (i32.const 16))))
      (if (i32.eq (call $gl32 (local.get $entry)) (local.get $handle))
        (then (return (local.get $entry))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  (func $dde32_conv_alloc (param $owner i32) (param $service i32)
      (param $topic i32) (result i32)
    (local $i i32) (local $entry i32) (local $handle i32)
    (if (i32.eqz (call $dde32_table_ensure (i32.const 2)))
      (then (return (i32.const 0))))
    (block $full (loop $scan
      (br_if $full (i32.ge_u (local.get $i) (global.get $DDE32_CONV_MAX)))
      (local.set $entry
        (i32.add (global.get $dde32_convs) (i32.mul (local.get $i) (i32.const 16))))
      (if (i32.eqz (call $gl32 (local.get $entry)))
        (then
          (local.set $handle (global.get $dde32_next_conv))
          (global.set $dde32_next_conv
            (i32.add (global.get $dde32_next_conv) (i32.const 1)))
          (call $gs32 (local.get $entry) (local.get $handle))
          (call $gs32 (i32.add (local.get $entry) (i32.const 4)) (local.get $owner))
          (call $gs32 (i32.add (local.get $entry) (i32.const 8)) (local.get $service))
          (call $gs32 (i32.add (local.get $entry) (i32.const 12)) (local.get $topic))
          (return (local.get $handle))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  (func $dde32_data_find (param $handle i32) (result i32)
    (local $i i32) (local $entry i32)
    (if (i32.eqz (local.get $handle)) (then (return (i32.const 0))))
    (if (i32.eqz (global.get $dde32_data)) (then (return (i32.const 0))))
    (block $missing (loop $scan
      (br_if $missing (i32.ge_u (local.get $i) (global.get $DDE32_DATA_MAX)))
      (local.set $entry
        (i32.add (global.get $dde32_data) (i32.mul (local.get $i) (i32.const 16))))
      (if (i32.eq (call $gl32 (local.get $entry)) (local.get $handle))
        (then (return (local.get $entry))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  ;; Shared by future callback/request support and exported only by the focused
  ;; regression harness.  It creates the exact copied object DdeGetData reads.
  (func $dde32_data_create (param $owner i32) (param $source i32)
      (param $size i32) (result i32)
    (local $i i32) (local $entry i32) (local $copy i32) (local $handle i32)
    (if (i32.eqz (call $dde32_inst_find (local.get $owner)))
      (then (return (i32.const 0))))
    (if (i32.and (i32.ne (local.get $size) (i32.const 0)) (i32.eqz (local.get $source)))
      (then (return (i32.const 0))))
    (if (i32.eqz (call $dde32_table_ensure (i32.const 3)))
      (then (return (i32.const 0))))
    (if (local.get $size)
      (then
        (local.set $copy (call $heap_alloc (local.get $size)))
        (if (i32.eqz (local.get $copy)) (then (return (i32.const 0))))
        (memory.copy (call $g2w (local.get $copy)) (call $g2w (local.get $source))
          (local.get $size))))
    (block $full (loop $scan
      (br_if $full (i32.ge_u (local.get $i) (global.get $DDE32_DATA_MAX)))
      (local.set $entry
        (i32.add (global.get $dde32_data) (i32.mul (local.get $i) (i32.const 16))))
      (if (i32.eqz (call $gl32 (local.get $entry)))
        (then
          (local.set $handle (global.get $dde32_next_data))
          (global.set $dde32_next_data
            (i32.add (global.get $dde32_next_data) (i32.const 1)))
          (call $gs32 (local.get $entry) (local.get $handle))
          (call $gs32 (i32.add (local.get $entry) (i32.const 4)) (local.get $owner))
          (call $gs32 (i32.add (local.get $entry) (i32.const 8)) (local.get $copy))
          (call $gs32 (i32.add (local.get $entry) (i32.const 12)) (local.get $size))
          (return (local.get $handle))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (if (local.get $copy) (then (call $heap_free (local.get $copy))))
    (i32.const 0))

  (func $dde32_hsz_is_progman (param $handle i32) (param $owner i32) (result i32)
    (local $entry i32) (local $string i32)
    ;; A null HSZ is the documented wildcard and selects the one server this
    ;; browser Win98 environment exposes: Program Manager.
    (if (i32.eqz (local.get $handle)) (then (return (i32.const 1))))
    (local.set $entry (call $dde32_hsz_find (local.get $handle) (local.get $owner)))
    (if (i32.eqz (local.get $entry)) (then (return (i32.const 0))))
    (local.set $string (call $gl32 (i32.add (local.get $entry) (i32.const 12))))
    (i32.and
      (i32.eq (call $guest_strlen (local.get $string)) (i32.const 7))
      (i32.and
        (i32.and
          (i32.eq (call $tolower (call $gl8 (local.get $string))) (i32.const 0x70))
          (i32.eq (call $tolower (call $gl8 (i32.add (local.get $string) (i32.const 1)))) (i32.const 0x72)))
        (i32.and
          (i32.and
            (i32.eq (call $tolower (call $gl8 (i32.add (local.get $string) (i32.const 2)))) (i32.const 0x6F))
            (i32.eq (call $tolower (call $gl8 (i32.add (local.get $string) (i32.const 3)))) (i32.const 0x67)))
          (i32.and
            (i32.and
              (i32.eq (call $tolower (call $gl8 (i32.add (local.get $string) (i32.const 4)))) (i32.const 0x6D))
              (i32.eq (call $tolower (call $gl8 (i32.add (local.get $string) (i32.const 5)))) (i32.const 0x61)))
            (i32.eq (call $tolower (call $gl8 (i32.add (local.get $string) (i32.const 6)))) (i32.const 0x6E)))))))

  ;; DdeInitializeA(pidInst, callback, afCmd, ulRes).  Allocate a real
  ;; process-local instance, or update an existing instance when *pidInst is
  ;; already non-zero as specified by DDEML.
  (func $handle_DdeInitializeA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $i i32) (local $entry i32) (local $id i32)
    (if (i32.or
          (i32.or (i32.eqz (local.get $arg0)) (i32.eqz (local.get $arg1)))
          (i32.ne (local.get $arg3) (i32.const 0)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x4006)) ;; DMLERR_INVALIDPARAMETER
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (local.set $id (call $gl32 (local.get $arg0)))
    (if (local.get $id)
      (then
        (local.set $entry (call $dde32_inst_find (local.get $id)))
        (if (i32.eqz (local.get $entry))
          (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x4003)))
          (else
            (call $gs32 (i32.add (local.get $entry) (i32.const 4)) (local.get $arg1))
            (call $gs32 (i32.add (local.get $entry) (i32.const 8)) (local.get $arg2))
            (call $gs32 (i32.add (local.get $entry) (i32.const 12)) (i32.const 0))
            (global.set $dde32_current_inst (local.get $id))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (if (i32.eqz (call $dde32_table_ensure (i32.const 0)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x4008)) ;; DMLERR_MEMORY_ERROR
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (block $full (loop $scan
      (br_if $full (i32.ge_u (local.get $i) (global.get $DDE32_INSTANCE_MAX)))
      (local.set $entry
        (i32.add (global.get $dde32_instances) (i32.mul (local.get $i) (i32.const 24))))
      (if (i32.eqz (call $gl32 (local.get $entry)))
        (then
          (local.set $id (global.get $dde32_next_inst))
          (global.set $dde32_next_inst
            (i32.add (global.get $dde32_next_inst) (i32.const 1)))
          (call $gs32 (local.get $entry) (local.get $id))
          (call $gs32 (i32.add (local.get $entry) (i32.const 4)) (local.get $arg1))
          (call $gs32 (i32.add (local.get $entry) (i32.const 8)) (local.get $arg2))
          (call $gs32 (i32.add (local.get $entry) (i32.const 12)) (i32.const 0))
          (call $gs32 (i32.add (local.get $entry) (i32.const 16)) (i32.const 0))
          (call $gs32 (i32.add (local.get $entry) (i32.const 20)) (i32.const 1))
          (call $gs32 (local.get $arg0) (local.get $id))
          (global.set $dde32_current_inst (local.get $id))
          (i32.store offset=0 (global.get $reg_base) (i32.const 0))
          (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
          (return)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x4008))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; HSZ values own a copied, case-insensitive atom-like string.  They do not
  ;; alias the caller's temporary input buffer.
  (func $handle_DdeCreateStringHandleA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $inst i32) (local $i i32) (local $entry i32) (local $free i32)
    (local $len i32) (local $copy i32) (local $handle i32)
    (local.set $inst (call $dde32_inst_find (local.get $arg0)))
    (global.set $dde32_current_inst (local.get $arg0))
    (if (i32.or
          (i32.or (i32.eqz (local.get $inst)) (i32.eqz (local.get $arg1)))
          (i32.ne (local.get $arg2) (i32.const 1004))) ;; CP_WINANSI
      (then
        (call $dde32_set_error (local.get $arg0) (i32.const 0x4006))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (local.set $len (call $guest_strlen (local.get $arg1)))
    (if (i32.gt_u (local.get $len) (i32.const 255))
      (then
        (call $dde32_set_error (local.get $arg0) (i32.const 0x4006))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (if (i32.eqz (call $dde32_table_ensure (i32.const 1)))
      (then
        (call $dde32_set_error (local.get $arg0) (i32.const 0x4008))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $DDE32_HSZ_MAX)))
      (local.set $entry
        (i32.add (global.get $dde32_hszs) (i32.mul (local.get $i) (i32.const 16))))
      (if (i32.eqz (call $gl32 (local.get $entry)))
        (then
          (if (i32.eqz (local.get $free)) (then (local.set $free (local.get $entry)))))
        (else
          (if (i32.and
                (i32.eq (call $gl32 (i32.add (local.get $entry) (i32.const 4)))
                  (local.get $arg0))
                (i32.eqz (call $guest_stricmp
                  (call $gl32 (i32.add (local.get $entry) (i32.const 12)))
                  (local.get $arg1))))
            (then
              (call $gs32 (i32.add (local.get $entry) (i32.const 8))
                (i32.add
                  (call $gl32 (i32.add (local.get $entry) (i32.const 8)))
                  (i32.const 1)))
              (call $dde32_set_error (local.get $arg0) (i32.const 0))
              (i32.store offset=0 (global.get $reg_base) (call $gl32 (local.get $entry)))
              (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
              (return)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (if (i32.eqz (local.get $free))
      (then
        (call $dde32_set_error (local.get $arg0) (i32.const 0x4007))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (local.set $copy (call $guest_strdup (local.get $arg1)))
    (if (i32.eqz (local.get $copy))
      (then
        (call $dde32_set_error (local.get $arg0) (i32.const 0x4008))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (local.set $handle (global.get $dde32_next_hsz))
    (global.set $dde32_next_hsz
      (i32.add (global.get $dde32_next_hsz) (i32.const 1)))
    (call $gs32 (local.get $free) (local.get $handle))
    (call $gs32 (i32.add (local.get $free) (i32.const 4)) (local.get $arg0))
    (call $gs32 (i32.add (local.get $free) (i32.const 8)) (i32.const 1))
    (call $gs32 (i32.add (local.get $free) (i32.const 12)) (local.get $copy))
    (call $dde32_set_error (local.get $arg0) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (local.get $handle))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  (func $handle_DdeNameService (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $inst i32) (local $hsz i32) (local $old i32)
    (local.set $inst (call $dde32_inst_find (local.get $arg0)))
    (global.set $dde32_current_inst (local.get $arg0))
    (if (i32.or (i32.eqz (local.get $inst)) (i32.ne (local.get $arg2) (i32.const 0)))
      (then
        (call $dde32_set_error (local.get $arg0) (i32.const 0x4006))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (local.set $old (call $gl32 (i32.add (local.get $inst) (i32.const 16))))
    (if (i32.eq (local.get $arg3) (i32.const 1)) ;; DNS_REGISTER
      (then
        (local.set $hsz (call $dde32_hsz_find (local.get $arg1) (local.get $arg0)))
        (if (i32.or
              (i32.eqz (local.get $hsz))
              (i32.ne
                (i32.and (call $gl32 (i32.add (local.get $inst) (i32.const 8)))
                  (i32.const 0x10))
                (i32.const 0))) ;; APPCMD_CLIENTONLY
          (then
            (call $dde32_set_error (local.get $arg0)
              (select (i32.const 0x4004) (i32.const 0x4006)
                (i32.ne
                  (i32.and (call $gl32 (i32.add (local.get $inst) (i32.const 8)))
                    (i32.const 0x10))
                  (i32.const 0))))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
            (return)))
        (if (i32.ne (local.get $old) (local.get $arg1))
          (then
            (if (local.get $old)
              (then (call $dde32_hsz_release_entry
                (call $dde32_hsz_find (local.get $old) (local.get $arg0)))))
            (call $gs32 (i32.add (local.get $hsz) (i32.const 8))
              (i32.add (call $gl32 (i32.add (local.get $hsz) (i32.const 8)))
                (i32.const 1)))
            (call $gs32 (i32.add (local.get $inst) (i32.const 16)) (local.get $arg1)))))
      (else
        (if (i32.eq (local.get $arg3) (i32.const 2)) ;; DNS_UNREGISTER
          (then
            (if (i32.and
                  (i32.ne (local.get $arg1) (i32.const 0))
                  (i32.eqz (call $dde32_hsz_find (local.get $arg1) (local.get $arg0))))
              (then
                (call $dde32_set_error (local.get $arg0) (i32.const 0x4006))
                (i32.store offset=0 (global.get $reg_base) (i32.const 0))
                (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
                (return)))
            (if (i32.and
                  (i32.ne (local.get $old) (i32.const 0))
                  (i32.or (i32.eqz (local.get $arg1)) (i32.eq (local.get $old) (local.get $arg1))))
              (then
                (call $dde32_hsz_release_entry
                  (call $dde32_hsz_find (local.get $old) (local.get $arg0)))
                (call $gs32 (i32.add (local.get $inst) (i32.const 16)) (i32.const 0)))))
          (else
            (if (i32.eq (local.get $arg3) (i32.const 4)) ;; DNS_FILTERON
              (then (call $gs32 (i32.add (local.get $inst) (i32.const 20)) (i32.const 1)))
              (else
                (if (i32.eq (local.get $arg3) (i32.const 8)) ;; DNS_FILTEROFF
                  (then (call $gs32 (i32.add (local.get $inst) (i32.const 20)) (i32.const 0)))
                  (else
                    (call $dde32_set_error (local.get $arg0) (i32.const 0x4006))
                    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
                    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
                    (return)))))))))
    (call $dde32_set_error (local.get $arg0) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1)) ;; Boolean success, not a data handle.
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  (func $handle_DdeFreeStringHandle (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32)
    (global.set $dde32_current_inst (local.get $arg0))
    (local.set $entry (call $dde32_hsz_find (local.get $arg1) (local.get $arg0)))
    (if (i32.eqz (local.get $entry))
      (then
        (call $dde32_set_error (local.get $arg0) (i32.const 0x4006))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (else
        (call $dde32_hsz_release_entry (local.get $entry))
        (call $dde32_set_error (local.get $arg0) (i32.const 0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  (func $handle_DdeUninitialize (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $inst i32) (local $i i32) (local $entry i32) (local $ptr i32)
    (local.set $inst (call $dde32_inst_find (local.get $arg0)))
    (if (i32.eqz (local.get $inst))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    ;; Terminate all conversations owned by the instance.
    (if (global.get $dde32_convs)
      (then
        (local.set $i (i32.const 0))
        (block $conv_done (loop $conv
          (br_if $conv_done (i32.ge_u (local.get $i) (global.get $DDE32_CONV_MAX)))
          (local.set $entry
            (i32.add (global.get $dde32_convs) (i32.mul (local.get $i) (i32.const 16))))
          (if (i32.eq (call $gl32 (i32.add (local.get $entry) (i32.const 4))) (local.get $arg0))
            (then (call $zero_memory (call $g2w (local.get $entry)) (i32.const 16))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $conv)))))
    ;; Free every copied data object owned by the instance.
    (if (global.get $dde32_data)
      (then
        (local.set $i (i32.const 0))
        (block $data_done (loop $data
          (br_if $data_done (i32.ge_u (local.get $i) (global.get $DDE32_DATA_MAX)))
          (local.set $entry
            (i32.add (global.get $dde32_data) (i32.mul (local.get $i) (i32.const 16))))
          (if (i32.eq (call $gl32 (i32.add (local.get $entry) (i32.const 4))) (local.get $arg0))
            (then
              (local.set $ptr (call $gl32 (i32.add (local.get $entry) (i32.const 8))))
              (if (local.get $ptr) (then (call $heap_free (local.get $ptr))))
              (call $zero_memory (call $g2w (local.get $entry)) (i32.const 16))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $data)))))
    ;; DdeUninitialize owns all remaining HSZ references, including service
    ;; registrations, so release the copied strings regardless of refcount.
    (if (global.get $dde32_hszs)
      (then
        (local.set $i (i32.const 0))
        (block $hsz_done (loop $hsz
          (br_if $hsz_done (i32.ge_u (local.get $i) (global.get $DDE32_HSZ_MAX)))
          (local.set $entry
            (i32.add (global.get $dde32_hszs) (i32.mul (local.get $i) (i32.const 16))))
          (if (i32.eq (call $gl32 (i32.add (local.get $entry) (i32.const 4))) (local.get $arg0))
            (then
              (local.set $ptr (call $gl32 (i32.add (local.get $entry) (i32.const 12))))
              (if (local.get $ptr) (then (call $heap_free (local.get $ptr))))
              (call $zero_memory (call $g2w (local.get $entry)) (i32.const 16))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $hsz)))))
    (call $zero_memory (call $g2w (local.get $inst)) (i32.const 24))
    (if (i32.eq (global.get $dde32_current_inst) (local.get $arg0))
      (then (global.set $dde32_current_inst (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; Win9x installers use DDEML as a client of the Program Manager solely to
  ;; submit CreateGroup/AddItem shortcut commands. There is no separate shell
  ;; process in the emulator, so expose one successful process-local
  ;; conversation and acknowledge its transactions. Explorer's real shell
  ;; integration remains independent of this compatibility contract.
  (func $handle_DdeConnect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $inst i32) (local $conv i32)
    (local.set $inst (call $dde32_inst_find (local.get $arg0)))
    (global.set $dde32_current_inst (local.get $arg0))
    (if (i32.eqz (local.get $inst))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (if (i32.or
          (i32.and (i32.ne (local.get $arg1) (i32.const 0))
            (i32.eqz (call $dde32_hsz_find (local.get $arg1) (local.get $arg0))))
          (i32.and (i32.ne (local.get $arg2) (i32.const 0))
            (i32.eqz (call $dde32_hsz_find (local.get $arg2) (local.get $arg0)))))
      (then
        (call $dde32_set_error (local.get $arg0) (i32.const 0x4006))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (if (i32.or
          (i32.eqz (call $dde32_hsz_is_progman (local.get $arg1) (local.get $arg0)))
          (i32.eqz (call $dde32_hsz_is_progman (local.get $arg2) (local.get $arg0))))
      (then
        (call $dde32_set_error (local.get $arg0) (i32.const 0x400A))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (local.set $conv
      (call $dde32_conv_alloc (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (if (i32.eqz (local.get $conv))
      (then (call $dde32_set_error (local.get $arg0) (i32.const 0x4008)))
      (else (call $dde32_set_error (local.get $arg0) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (local.get $conv))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  (func $handle_DdeDisconnect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $conv i32) (local $owner i32)
    (local.set $conv (call $dde32_conv_find (local.get $arg0)))
    (if (local.get $conv)
      (then
        (local.set $owner (call $gl32 (i32.add (local.get $conv) (i32.const 4))))
        (global.set $dde32_current_inst (local.get $owner))
        (call $zero_memory (call $g2w (local.get $conv)) (i32.const 16))
        (call $dde32_set_error (local.get $owner) (i32.const 0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1)))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; ---- Virtual Program Manager: DDE XTYP_EXECUTE command strings ----
  ;; Win9x Explorer answers the PROGMAN DDE service by turning Program Manager
  ;; commands into Start Menu folders and shortcuts. Installers of the era
  ;; (MindVision VISE, older InstallShield) create their program groups only
  ;; this way, so acknowledging the transaction without doing it left Myth: The
  ;; Fallen Lords' installer with no shortcut -- and the browser desktop, which
  ;; turns an installer's Start Menu .lnk into an icon, with nothing to offer.
  ;; Implemented: CreateGroup, ShowGroup, AddItem, ReplaceItem, DeleteItem and
  ;; DeleteGroup (empty groups). Anything else is reported DDE_FNOTPROCESSED.
  (global $progman_group (mut i32) (i32.const 0)) ;; guest buffer, 264 bytes
  (global $PROGMAN_ARG_SLOT i32 (i32.const 264))
  (global $PROGMAN_ARG_MAX i32 (i32.const 10))

  ;; Case-insensitive compare of a guest span with a WASM-literal ASCII name.
  (func $progman_name_eq (param $ga i32) (param $len i32) (param $lit i32) (result i32)
    (local $i i32)
    (block $no (loop $cmp
      (if (i32.ge_u (local.get $i) (local.get $len))
        (then (return (i32.eqz (i32.load8_u (i32.add (local.get $lit) (local.get $i)))))))
      (br_if $no (i32.ne (call $tolower (call $gl8 (i32.add (local.get $ga) (local.get $i))))
        (call $tolower (i32.load8_u (i32.add (local.get $lit) (local.get $i))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $cmp)))
    (i32.const 0))

  ;; Append a NUL-terminated string (guest, or WASM when $src_is_wasm) to the
  ;; guest buffer $dst at offset $at, keeping room for the terminator inside
  ;; $cap. Returns the new offset; always leaves $dst terminated.
  (func $progman_append (param $dst i32) (param $at i32) (param $cap i32)
      (param $src i32) (param $src_is_wasm i32) (result i32)
    (local $c i32)
    (block $end (loop $copy
      (br_if $end (i32.ge_u (i32.add (local.get $at) (i32.const 1)) (local.get $cap)))
      (local.set $c (select (i32.load8_u (local.get $src)) (call $gl8 (local.get $src))
        (local.get $src_is_wasm)))
      (br_if $end (i32.eqz (local.get $c)))
      (call $gs8 (i32.add (local.get $dst) (local.get $at)) (local.get $c))
      (local.set $at (i32.add (local.get $at) (i32.const 1)))
      (local.set $src (i32.add (local.get $src) (i32.const 1)))
      (br $copy)))
    (call $gs8 (i32.add (local.get $dst) (local.get $at)) (i32.const 0))
    (local.get $at))

  ;; "C:\WINDOWS\Start Menu\Programs\<group>[\<item>.lnk]" into guest $dst.
  (func $progman_path (param $dst i32) (param $group i32) (param $item i32)
    (local $at i32)
    (local.set $at (call $progman_append (local.get $dst) (i32.const 0) (i32.const 600)
      (call $csidl_win98_path (i32.const 0x02)) (i32.const 1)))
    (local.set $at (call $progman_append (local.get $dst) (local.get $at) (i32.const 600)
      "\\" (i32.const 1)))
    (local.set $at (call $progman_append (local.get $dst) (local.get $at) (i32.const 600)
      (local.get $group) (i32.const 0)))
    (if (local.get $item)
      (then
        (local.set $at (call $progman_append (local.get $dst) (local.get $at) (i32.const 600)
          "\\" (i32.const 1)))
        (local.set $at (call $progman_append (local.get $dst) (local.get $at) (i32.const 600)
          (local.get $item) (i32.const 0)))
        (drop (call $progman_append (local.get $dst) (local.get $at) (i32.const 600)
          ".lnk" (i32.const 1))))))

  ;; Optional signed decimal; empty or garbage reads as 0.
  (func $progman_atoi (param $s i32) (result i32)
    (local $v i32) (local $neg i32) (local $c i32)
    (if (i32.eq (call $gl8 (local.get $s)) (i32.const 0x2D))
      (then (local.set $neg (i32.const 1)) (local.set $s (i32.add (local.get $s) (i32.const 1)))))
    (block $end (loop $digits
      (local.set $c (call $gl8 (local.get $s)))
      (br_if $end (i32.or (i32.lt_u (local.get $c) (i32.const 0x30)) (i32.gt_u (local.get $c) (i32.const 0x39))))
      (local.set $v (i32.add (i32.mul (local.get $v) (i32.const 10)) (i32.sub (local.get $c) (i32.const 0x30))))
      (local.set $s (i32.add (local.get $s) (i32.const 1)))
      (br $digits)))
    (select (i32.sub (i32.const 0) (local.get $v)) (local.get $v) (local.get $neg)))

  ;; [AddItem(CmdLine[,Name[,IconPath[,IconIndex[,xPos,yPos[,DefDir...]]]]])]
  ;; CmdLine may be an unquoted path with spaces ("C:\Program Files\x.exe"):
  ;; the program ends at the first .exe/.com/.bat/.pif followed by a space or
  ;; the end, and anything after it is the arguments.
  (func $progman_add_item (param $argv i32) (param $argc i32) (param $path i32) (result i32)
    (local $cmd i32) (local $len i32) (local $i i32) (local $split i32) (local $c i32)
    (local $args i32) (local $name i32) (local $icon i32) (local $work i32) (local $slash i32)
    (local $base i32) (local $dot i32)
    (if (i32.or (i32.eqz (global.get $progman_group)) (i32.eqz (local.get $argc)))
      (then (return (i32.const 0))))
    (local.set $cmd (local.get $argv))
    (local.set $len (call $guest_strlen (local.get $cmd)))
    (if (i32.eqz (local.get $len)) (then (return (i32.const 0))))
    (local.set $split (local.get $len))
    (block $found (loop $scan
      (br_if $found (i32.gt_u (i32.add (local.get $i) (i32.const 4)) (local.get $len)))
      (if (i32.and
            (i32.eq (call $gl8 (i32.add (local.get $cmd) (local.get $i))) (i32.const 0x2E))
            (i32.or (i32.eq (i32.add (local.get $i) (i32.const 4)) (local.get $len))
              (i32.eq (call $gl8 (i32.add (local.get $cmd) (i32.add (local.get $i) (i32.const 4)))) (i32.const 0x20))))
        (then
          (if (i32.or (i32.or
                (call $progman_name_eq (i32.add (local.get $cmd) (local.get $i)) (i32.const 4) ".exe")
                (call $progman_name_eq (i32.add (local.get $cmd) (local.get $i)) (i32.const 4) ".com"))
              (i32.or
                (call $progman_name_eq (i32.add (local.get $cmd) (local.get $i)) (i32.const 4) ".bat")
                (call $progman_name_eq (i32.add (local.get $cmd) (local.get $i)) (i32.const 4) ".pif")))
            (then (local.set $split (i32.add (local.get $i) (i32.const 4))) (br $found)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (if (i32.lt_u (local.get $split) (local.get $len))
      (then
        (call $gs8 (i32.add (local.get $cmd) (local.get $split)) (i32.const 0))
        (local.set $args (i32.add (local.get $cmd) (i32.add (local.get $split) (i32.const 1))))
        (block $ws (loop $skip
          (br_if $ws (i32.ne (call $gl8 (local.get $args)) (i32.const 0x20)))
          (local.set $args (i32.add (local.get $args) (i32.const 1)))
          (br $skip)))
        (if (i32.eqz (call $gl8 (local.get $args))) (then (local.set $args (i32.const 0))))))
    ;; Target directory (working-directory default) and file stem (name default).
    (local.set $work (i32.add (local.get $argv) (i32.mul (i32.const 9) (global.get $PROGMAN_ARG_SLOT))))
    (drop (call $progman_append (local.get $work) (i32.const 0) (global.get $PROGMAN_ARG_SLOT)
      (local.get $cmd) (i32.const 0)))
    (local.set $slash (i32.const -1))
    (local.set $i (i32.const 0))
    (block $end (loop $dirs
      (local.set $c (call $gl8 (i32.add (local.get $work) (local.get $i))))
      (br_if $end (i32.eqz (local.get $c)))
      (if (i32.eq (local.get $c) (i32.const 0x5C)) (then (local.set $slash (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $dirs)))
    (local.set $name
      (if (result i32) (i32.and (i32.ge_u (local.get $argc) (i32.const 2))
            (i32.ne (call $gl8 (i32.add (local.get $argv) (global.get $PROGMAN_ARG_SLOT))) (i32.const 0)))
        (then (i32.add (local.get $argv) (global.get $PROGMAN_ARG_SLOT)))
        (else
          (local.set $base (i32.add (local.get $argv) (i32.mul (i32.const 8) (global.get $PROGMAN_ARG_SLOT))))
          (local.set $dot (call $progman_append (local.get $base) (i32.const 0) (global.get $PROGMAN_ARG_SLOT)
            (i32.add (local.get $work) (i32.add (local.get $slash) (i32.const 1))) (i32.const 0)))
          (block $stem (loop $back
            (br_if $stem (i32.eqz (local.get $dot)))
            (local.set $dot (i32.sub (local.get $dot) (i32.const 1)))
            (if (i32.eq (call $gl8 (i32.add (local.get $base) (local.get $dot))) (i32.const 0x2E))
              (then (call $gs8 (i32.add (local.get $base) (local.get $dot)) (i32.const 0)) (br $stem)))
            (br $back)))
          (local.get $base))))
    (if (i32.and (i32.ge_u (local.get $argc) (i32.const 7))
          (i32.ne (call $gl8 (i32.add (local.get $argv) (i32.mul (i32.const 6) (global.get $PROGMAN_ARG_SLOT)))) (i32.const 0)))
      (then (local.set $work (i32.add (local.get $argv) (i32.mul (i32.const 6) (global.get $PROGMAN_ARG_SLOT)))))
      (else
        (if (i32.ge_s (local.get $slash) (i32.const 0))
          (then (call $gs8 (i32.add (local.get $work) (select (local.get $slash) (i32.add (local.get $slash) (i32.const 1))
            (i32.ne (local.get $slash) (i32.const 2)))) (i32.const 0)))
          (else (local.set $work (i32.const 0))))))
    (if (i32.and (i32.ge_u (local.get $argc) (i32.const 3))
          (i32.ne (call $gl8 (i32.add (local.get $argv) (i32.mul (i32.const 2) (global.get $PROGMAN_ARG_SLOT)))) (i32.const 0)))
      (then (local.set $icon (i32.add (local.get $argv) (i32.mul (i32.const 2) (global.get $PROGMAN_ARG_SLOT))))))
    (call $progman_path (local.get $path) (global.get $progman_group) (local.get $name))
    (i32.eq (call $shell_link_write (call $g2w (local.get $path)) (i32.const 0)
      (local.get $cmd) (local.get $args) (local.get $work) (local.get $name) (local.get $icon)
      (select (call $progman_atoi (i32.add (local.get $argv) (i32.mul (i32.const 3) (global.get $PROGMAN_ARG_SLOT))))
        (i32.const 0) (i32.ge_u (local.get $argc) (i32.const 4))))
      (i32.const 1)))

  ;; One parsed command. $path is a 600-byte guest scratch buffer.
  (func $progman_command (param $name i32) (param $nlen i32) (param $argv i32) (param $argc i32)
      (param $path i32) (result i32)
    (if (call $progman_name_eq (local.get $name) (local.get $nlen) "CreateGroup")
      (then
        (if (i32.eqz (local.get $argc)) (then (return (i32.const 0))))
        (if (i32.eqz (global.get $progman_group))
          (then (global.set $progman_group (call $heap_alloc (global.get $PROGMAN_ARG_SLOT)))))
        (if (i32.eqz (global.get $progman_group)) (then (return (i32.const 0))))
        (drop (call $progman_append (global.get $progman_group) (i32.const 0) (global.get $PROGMAN_ARG_SLOT)
          (local.get $argv) (i32.const 0)))
        (call $progman_path (local.get $path) (global.get $progman_group) (i32.const 0))
        (drop (call $host_fs_create_directory (call $g2w (local.get $path)) (i32.const 0)))
        (return (i32.ne (call $host_fs_get_file_attributes (call $g2w (local.get $path)) (i32.const 0)) (i32.const -1)))))
    (if (call $progman_name_eq (local.get $name) (local.get $nlen) "ShowGroup")
      (then (return (i32.ne (local.get $argc) (i32.const 0)))))
    (if (call $progman_name_eq (local.get $name) (local.get $nlen) "AddItem")
      (then (return (call $progman_add_item (local.get $argv) (local.get $argc) (local.get $path)))))
    (if (i32.or (call $progman_name_eq (local.get $name) (local.get $nlen) "ReplaceItem")
          (call $progman_name_eq (local.get $name) (local.get $nlen) "DeleteItem"))
      (then
        (if (i32.or (i32.eqz (local.get $argc)) (i32.eqz (global.get $progman_group)))
          (then (return (i32.const 0))))
        (call $progman_path (local.get $path) (global.get $progman_group) (local.get $argv))
        (drop (call $host_fs_delete_file (call $g2w (local.get $path)) (i32.const 0)))
        (return (i32.const 1))))
    (if (call $progman_name_eq (local.get $name) (local.get $nlen) "DeleteGroup")
      (then
        (if (i32.eqz (local.get $argc)) (then (return (i32.const 0))))
        (call $progman_path (local.get $path) (local.get $argv) (i32.const 0))
        (return (i32.ne (call $host_fs_remove_directory (call $g2w (local.get $path)) (i32.const 0)) (i32.const 0)))))
    (i32.const 0))

  ;; Execute a command string of [Cmd(arg, "arg", ...)] groups. $cmd is a guest
  ;; address; reading stops at $len or the first NUL. 1 only if every command
  ;; was understood and carried out.
  (func $progman_execute (param $cmd i32) (param $len i32) (result i32)
    (local $argv i32) (local $path i32) (local $pos i32) (local $c i32) (local $ok i32)
    (local $name i32) (local $nlen i32) (local $argc i32) (local $slot i32) (local $alen i32)
    (local $quoted i32)
    (local.set $argv (call $heap_alloc (i32.mul (global.get $PROGMAN_ARG_MAX) (global.get $PROGMAN_ARG_SLOT))))
    (local.set $path (call $heap_alloc (i32.const 600)))
    (if (i32.or (i32.eqz (local.get $argv)) (i32.eqz (local.get $path)))
      (then
        (if (local.get $argv) (then (call $heap_free (local.get $argv))))
        (if (local.get $path) (then (call $heap_free (local.get $path))))
        (return (i32.const 0))))
    (local.set $ok (i32.const 1))
    (block $done (loop $commands
      ;; whitespace between commands
      (block $ws (loop $skip
        (br_if $done (i32.ge_u (local.get $pos) (local.get $len)))
        (local.set $c (call $gl8 (i32.add (local.get $cmd) (local.get $pos))))
        (br_if $done (i32.eqz (local.get $c)))
        (br_if $ws (i32.gt_u (local.get $c) (i32.const 0x20)))
        (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
        (br $skip)))
      (if (i32.ne (local.get $c) (i32.const 0x5B)) ;; '['
        (then (local.set $ok (i32.const 0)) (br $done)))
      (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
      (local.set $name (i32.add (local.get $cmd) (local.get $pos)))
      (local.set $nlen (i32.const 0))
      (block $nend (loop $nloop
        (br_if $nend (i32.ge_u (local.get $pos) (local.get $len)))
        (local.set $c (call $gl8 (i32.add (local.get $cmd) (local.get $pos))))
        (br_if $nend (i32.or (i32.or (i32.eqz (local.get $c)) (i32.eq (local.get $c) (i32.const 0x28)))
          (i32.or (i32.eq (local.get $c) (i32.const 0x5D)) (i32.eq (local.get $c) (i32.const 0x20)))))
        (local.set $nlen (i32.add (local.get $nlen) (i32.const 1)))
        (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
        (br $nloop)))
      (local.set $argc (i32.const 0))
      (if (i32.eq (local.get $c) (i32.const 0x28)) ;; '('
        (then
          (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
          (block $aend (loop $args
            (block $sp (loop $sps
              (br_if $sp (i32.ge_u (local.get $pos) (local.get $len)))
              (br_if $sp (i32.ne (call $gl8 (i32.add (local.get $cmd) (local.get $pos))) (i32.const 0x20)))
              (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
              (br $sps)))
            (local.set $slot (i32.add (local.get $argv)
              (i32.mul (select (local.get $argc) (i32.sub (global.get $PROGMAN_ARG_MAX) (i32.const 1))
                (i32.lt_u (local.get $argc) (global.get $PROGMAN_ARG_MAX))) (global.get $PROGMAN_ARG_SLOT))))
            (local.set $alen (i32.const 0))
            (local.set $quoted (i32.eq (call $gl8 (i32.add (local.get $cmd) (local.get $pos))) (i32.const 0x22)))
            (if (local.get $quoted) (then (local.set $pos (i32.add (local.get $pos) (i32.const 1)))))
            (block $vend (loop $value
              (if (i32.ge_u (local.get $pos) (local.get $len))
                (then (local.set $ok (i32.const 0)) (br $done)))
              (local.set $c (call $gl8 (i32.add (local.get $cmd) (local.get $pos))))
              (if (i32.eqz (local.get $c)) (then (local.set $ok (i32.const 0)) (br $done)))
              (if (local.get $quoted)
                (then (if (i32.eq (local.get $c) (i32.const 0x22))
                  (then (local.set $pos (i32.add (local.get $pos) (i32.const 1))) (br $vend))))
                (else (br_if $vend (i32.or (i32.eq (local.get $c) (i32.const 0x2C))
                  (i32.eq (local.get $c) (i32.const 0x29))))))
              (if (i32.lt_u (local.get $alen) (i32.sub (global.get $PROGMAN_ARG_SLOT) (i32.const 1)))
                (then
                  (call $gs8 (i32.add (local.get $slot) (local.get $alen)) (local.get $c))
                  (local.set $alen (i32.add (local.get $alen) (i32.const 1)))))
              (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
              (br $value)))
            ;; Trailing blanks of an unquoted value are not part of it.
            (if (i32.eqz (local.get $quoted))
              (then (block $trimmed (loop $trim
                (br_if $trimmed (i32.eqz (local.get $alen)))
                (br_if $trimmed (i32.ne (call $gl8 (i32.add (local.get $slot) (i32.sub (local.get $alen) (i32.const 1)))) (i32.const 0x20)))
                (local.set $alen (i32.sub (local.get $alen) (i32.const 1)))
                (br $trim)))))
            (call $gs8 (i32.add (local.get $slot) (local.get $alen)) (i32.const 0))
            (if (i32.lt_u (local.get $argc) (global.get $PROGMAN_ARG_MAX))
              (then (local.set $argc (i32.add (local.get $argc) (i32.const 1)))))
            (block $sp2 (loop $sps2
              (br_if $sp2 (i32.ge_u (local.get $pos) (local.get $len)))
              (br_if $sp2 (i32.ne (call $gl8 (i32.add (local.get $cmd) (local.get $pos))) (i32.const 0x20)))
              (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
              (br $sps2)))
            (if (i32.ge_u (local.get $pos) (local.get $len)) (then (local.set $ok (i32.const 0)) (br $done)))
            (local.set $c (call $gl8 (i32.add (local.get $cmd) (local.get $pos))))
            (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
            (br_if $args (i32.eq (local.get $c) (i32.const 0x2C)))
            (br_if $aend (i32.eq (local.get $c) (i32.const 0x29)))
            (local.set $ok (i32.const 0)) (br $done)))))
      ;; closing ']'
      (block $close (loop $cl
        (if (i32.ge_u (local.get $pos) (local.get $len)) (then (local.set $ok (i32.const 0)) (br $done)))
        (local.set $c (call $gl8 (i32.add (local.get $cmd) (local.get $pos))))
        (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
        (br_if $close (i32.eq (local.get $c) (i32.const 0x5D)))
        (if (i32.ne (local.get $c) (i32.const 0x20)) (then (local.set $ok (i32.const 0)) (br $done)))
        (br $cl)))
      (if (i32.eqz (call $progman_command (local.get $name) (local.get $nlen)
            (local.get $argv) (local.get $argc) (local.get $path)))
        (then (local.set $ok (i32.const 0))))
      (br $commands)))
    (call $heap_free (local.get $argv))
    (call $heap_free (local.get $path))
    (local.get $ok))

  (func $handle_DdeClientTransaction (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $result_ptr i32) (local $type i32) (local $conv i32) (local $owner i32)
    (local $data i32) (local $cmd i32) (local $cmd_len i32)
    ;; The dispatcher exposes five fast arguments; read the remaining three
    ;; stdcall arguments from their original stack positions.
    (local.set $type (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (local.set $result_ptr (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32))))
    (local.set $conv (call $dde32_conv_find (local.get $arg2)))
    (if (local.get $result_ptr)
      (then (call $gs32 (local.get $result_ptr) (i32.const 0))))
    (if (i32.eqz (local.get $conv))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36)))
        (return)))
    (local.set $owner (call $gl32 (i32.add (local.get $conv) (i32.const 4))))
    (global.set $dde32_current_inst (local.get $owner))
    ;; The virtual Program Manager accepts synchronous XTYP_EXECUTE commands.
    ;; They return a Boolean non-zero value; only data-returning transactions
    ;; produce an HDDEDATA object that DdeGetData/DdeFreeDataHandle may consume.
    (if (i32.and
          (i32.eq (local.get $type) (i32.const 0x4050)) ;; XTYP_EXECUTE
          (i32.and
            (i32.and (i32.ne (local.get $arg0) (i32.const 0))
              (i32.ne (local.get $arg1) (i32.const 0)))
            ;; hszItem must be 0. wFmt is ignored for an execute: VISE sends
            ;; CF_TEXT (1), and Explorer's Progman server carries it out.
            (i32.eqz (local.get $arg3))))
      (then
        ;; cbData -1 passes an HDDEDATA from DdeCreateDataHandle instead of bytes.
        (if (i32.eq (local.get $arg1) (i32.const -1))
          (then
            (local.set $data (call $dde32_data_find (local.get $arg0)))
            (local.set $cmd (select (call $gl32 (i32.add (local.get $data) (i32.const 8))) (i32.const 0)
              (i32.ne (local.get $data) (i32.const 0))))
            (local.set $cmd_len (select (call $gl32 (i32.add (local.get $data) (i32.const 12))) (i32.const 0)
              (i32.ne (local.get $data) (i32.const 0)))))
          (else
            (local.set $cmd (local.get $arg0))
            (local.set $cmd_len (local.get $arg1))))
        (if (i32.and (i32.ne (local.get $cmd) (i32.const 0))
              (call $progman_execute (local.get $cmd) (local.get $cmd_len)))
          (then
            (if (local.get $result_ptr)
              (then (call $gs32 (local.get $result_ptr) (i32.const 0x8000)))) ;; DDE_FACK
            (call $dde32_set_error (local.get $owner) (i32.const 0))
            (i32.store offset=0 (global.get $reg_base) (i32.const 1)))
          (else
            ;; DDE_FNOTPROCESSED: the result word stays 0, and so does the return.
            (call $dde32_set_error (local.get $owner) (i32.const 0x4009)) ;; DMLERR_NOTPROCESSED
            (i32.store offset=0 (global.get $reg_base) (i32.const 0)))))
      (else
        (call $dde32_set_error (local.get $owner) (i32.const 0x4009))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36)))
  )

  (func $handle_DdeGetLastError (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $inst i32)
    (local.set $inst (call $dde32_inst_find (local.get $arg0)))
    (if (i32.eqz (local.get $inst))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x4003))) ;; DMLERR_DLL_NOT_INITIALIZED
      (else
        (i32.store offset=0 (global.get $reg_base) (call $gl32 (i32.add (local.get $inst) (i32.const 12))))
        (call $gs32 (i32.add (local.get $inst) (i32.const 12)) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  (func $handle_DdeFreeDataHandle (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $owner i32) (local $ptr i32)
    (local.set $entry (call $dde32_data_find (local.get $arg0)))
    (if (i32.eqz (local.get $entry))
      (then
        (call $dde32_set_error (global.get $dde32_current_inst) (i32.const 0x4006))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (else
        (local.set $owner (call $gl32 (i32.add (local.get $entry) (i32.const 4))))
        (local.set $ptr (call $gl32 (i32.add (local.get $entry) (i32.const 8))))
        (if (local.get $ptr) (then (call $heap_free (local.get $ptr))))
        (call $zero_memory (call $g2w (local.get $entry)) (i32.const 16))
        (call $dde32_set_error (local.get $owner) (i32.const 0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  (func $handle_DdeGetData (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $owner i32) (local $ptr i32)
    (local $size i32) (local $count i32)
    (local.set $entry (call $dde32_data_find (local.get $arg0)))
    (if (i32.eqz (local.get $entry))
      (then
        (call $dde32_set_error (global.get $dde32_current_inst) (i32.const 0x4006))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (local.set $owner (call $gl32 (i32.add (local.get $entry) (i32.const 4))))
    (local.set $ptr (call $gl32 (i32.add (local.get $entry) (i32.const 8))))
    (local.set $size (call $gl32 (i32.add (local.get $entry) (i32.const 12))))
    (global.set $dde32_current_inst (local.get $owner))
    (call $dde32_set_error (local.get $owner) (i32.const 0))
    (if (i32.eqz (local.get $arg1))
      (then (i32.store offset=0 (global.get $reg_base) (local.get $size)))
      (else
        (if (i32.lt_u (local.get $arg3) (local.get $size))
          (then
            (local.set $count (i32.sub (local.get $size) (local.get $arg3)))
            (if (i32.gt_u (local.get $count) (local.get $arg2))
              (then (local.set $count (local.get $arg2))))
            (if (local.get $count)
              (then (memory.copy (call $g2w (local.get $arg1))
                (call $g2w (i32.add (local.get $ptr) (local.get $arg3)))
                (local.get $count))))))
        (i32.store offset=0 (global.get $reg_base) (local.get $count))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; Classic absolute SECURITY_DESCRIPTOR support used by InstallShield when
  ;; it creates the destination tree. ACL enforcement is outside this
  ;; single-process Win98 environment, but the in-memory layouts and ownership
  ;; fields are real so callers can build, inspect and release them normally.
  (func $handle_InitializeSecurityDescriptor (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.and
          (i32.ne (local.get $arg0) (i32.const 0))
          (i32.eq (local.get $arg1) (i32.const 1)))
      (then
        (memory.fill (call $g2w (local.get $arg0)) (i32.const 0) (i32.const 20))
        (call $gs8 (local.get $arg0) (i32.const 1))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1)))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; SECURITY_DESCRIPTOR is the 32-bit Win32 layout:
  ;;   +0 Revision/Sbz1, +2 Control, +4 Owner, +8 Group, +12 Sacl, +16 Dacl.
  ;; In an absolute descriptor the four tail DWORDs are guest pointers.  With
  ;; SE_SELF_RELATIVE they are offsets from the descriptor.  Keep validation
  ;; in one place so WinRAR's accessors cannot turn malformed offsets, ACL
  ;; sizes or SID counts into an unbounded guest-memory walk.
  (func $security_span_valid (param $ptr i32) (param $size i32) (result i32)
    (i32.and
      (i32.ne (local.get $ptr) (i32.const 0))
      (i32.ne (call $g2w_affine_span (local.get $ptr) (local.get $size))
        (global.get $NULL_SENTINEL))))

  (func $security_sid_valid (param $sid i32) (result i32)
    (local $count i32) (local $size i32)
    (if (i32.eqz (call $security_span_valid (local.get $sid) (i32.const 8)))
      (then (return (i32.const 0))))
    (local.set $count (call $gl8 (i32.add (local.get $sid) (i32.const 1))))
    (if (i32.or
          (i32.ne (call $gl8 (local.get $sid)) (i32.const 1))
          (i32.gt_u (local.get $count) (i32.const 15)))
      (then (return (i32.const 0))))
    (local.set $size
      (i32.add (i32.const 8) (i32.shl (local.get $count) (i32.const 2))))
    (call $security_span_valid (local.get $sid) (local.get $size)))

  (func $security_sid_length (param $sid i32) (result i32)
    (i32.add (i32.const 8)
      (i32.shl (call $gl8 (i32.add (local.get $sid) (i32.const 1)))
        (i32.const 2))))

  ;; The process token currently publishes one principal SID: the enabled
  ;; BUILTIN\Administrators group, S-1-5-32-544. Account lookup must resolve
  ;; that exact identity rather than assigning its name to every valid SID.
  (func $security_sid_is_builtin_admin (param $sid i32) (result i32)
    (i32.and
      (i32.and
        (i32.eq (call $gl8 (local.get $sid)) (i32.const 1))
        (i32.eq (call $gl8 (i32.add (local.get $sid) (i32.const 1))) (i32.const 2)))
      (i32.and
        (i32.and
          (i32.eq (call $gl32 (i32.add (local.get $sid) (i32.const 2))) (i32.const 0))
          (i32.eq (call $gl16 (i32.add (local.get $sid) (i32.const 6))) (i32.const 0x0500)))
        (i32.and
          (i32.eq (call $gl32 (i32.add (local.get $sid) (i32.const 8))) (i32.const 32))
          (i32.eq (call $gl32 (i32.add (local.get $sid) (i32.const 12))) (i32.const 544))))))

  (func $security_max_u (param $a i32) (param $b i32) (result i32)
    (select (local.get $a) (local.get $b)
      (i32.gt_u (local.get $a) (local.get $b))))

  (func $security_acl_valid (param $acl i32) (result i32)
    (local $revision i32) (local $size i32) (local $count i32)
    (local $used i32) (local $i i32) (local $ace_type i32)
    (local $ace_size i32) (local $sid i32) (local $sid_size i32)
    (if (i32.eqz (call $security_span_valid (local.get $acl) (i32.const 8)))
      (then (return (i32.const 0))))
    (local.set $revision (call $gl8 (local.get $acl)))
    (local.set $size (call $gl16 (i32.add (local.get $acl) (i32.const 2))))
    (local.set $count (call $gl16 (i32.add (local.get $acl) (i32.const 4))))
    (if (i32.or
          (i32.eqz
            (i32.or (i32.eq (local.get $revision) (i32.const 2))
                    (i32.eq (local.get $revision) (i32.const 4))))
          (i32.or
            (i32.lt_u (local.get $size) (i32.const 8))
            (i32.ne (i32.and (local.get $size) (i32.const 3)) (i32.const 0))))
      (then (return (i32.const 0))))
    (if (i32.eqz (call $security_span_valid (local.get $acl) (local.get $size)))
      (then (return (i32.const 0))))
    (local.set $used (i32.const 8))
    (block $valid (loop $walk
      (br_if $valid (i32.ge_u (local.get $i) (local.get $count)))
      (if (i32.lt_u (i32.sub (local.get $size) (local.get $used)) (i32.const 4))
        (then (return (i32.const 0))))
      (local.set $ace_size
        (call $gl16 (i32.add (local.get $acl)
          (i32.add (local.get $used) (i32.const 2)))))
      (if (i32.or
            (i32.or
              (i32.lt_u (local.get $ace_size) (i32.const 4))
              (i32.ne (i32.and (local.get $ace_size) (i32.const 3)) (i32.const 0)))
            (i32.gt_u (local.get $ace_size)
              (i32.sub (local.get $size) (local.get $used))))
        (then (return (i32.const 0))))
      ;; Win98's supported ACE layouts all have {ACE_HEADER, ACCESS_MASK, SID}
      ;; and use types 0 (allow), 1 (deny), or 2 (system audit).  Alarm ACEs
      ;; and later object/callback layouts are not valid classic ACL entries.
      (local.set $ace_type
        (call $gl8 (i32.add (local.get $acl) (local.get $used))))
      (if (i32.or
            (i32.gt_u (local.get $ace_type) (i32.const 2))
            (i32.lt_u (local.get $ace_size) (i32.const 16)))
        (then (return (i32.const 0))))
      (local.set $sid
        (i32.add (local.get $acl) (i32.add (local.get $used) (i32.const 8))))
      (if (i32.eqz (call $security_sid_valid (local.get $sid)))
        (then (return (i32.const 0))))
      (local.set $sid_size (call $security_sid_length (local.get $sid)))
      (if (i32.gt_u (local.get $sid_size)
            (i32.sub (local.get $ace_size) (i32.const 8)))
        (then (return (i32.const 0))))
      (local.set $used (i32.add (local.get $used) (local.get $ace_size)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $walk)))
    (i32.const 1))

  ;; Resolve one Owner/Group/Sacl/Dacl DWORD.  -1 is an invalid non-NULL
  ;; pointer/offset; zero remains the meaningful absent/NULL component.
  (func $security_sd_component
      (param $sd i32) (param $raw i32) (param $self_relative i32) (result i32)
    (local $ptr i32)
    (if (i32.eqz (local.get $raw)) (then (return (i32.const 0))))
    (if (local.get $self_relative)
      (then
        (if (i32.or
              (i32.lt_u (local.get $raw) (i32.const 20))
              (i32.ne (i32.and (local.get $raw) (i32.const 3)) (i32.const 0)))
          (then (return (i32.const -1))))
        (local.set $ptr (i32.add (local.get $sd) (local.get $raw)))
        (if (i32.lt_u (local.get $ptr) (local.get $sd))
          (then (return (i32.const -1)))))
      (else
        (local.set $ptr (local.get $raw))))
    (local.get $ptr))

  (func $security_descriptor_valid (param $sd i32) (result i32)
    (local $control i32) (local $self_relative i32)
    (local $owner i32) (local $group i32) (local $sacl i32) (local $dacl i32)
    (if (i32.eqz (call $security_span_valid (local.get $sd) (i32.const 20)))
      (then (return (i32.const 0))))
    (if (i32.ne (call $gl8 (local.get $sd)) (i32.const 1))
      (then (return (i32.const 0))))
    (local.set $control (call $gl16 (i32.add (local.get $sd) (i32.const 2))))
    (local.set $self_relative
      (i32.ne (i32.and (local.get $control) (i32.const 0x8000)) (i32.const 0)))
    (local.set $owner
      (call $security_sd_component (local.get $sd)
        (call $gl32 (i32.add (local.get $sd) (i32.const 4)))
        (local.get $self_relative)))
    (local.set $group
      (call $security_sd_component (local.get $sd)
        (call $gl32 (i32.add (local.get $sd) (i32.const 8)))
        (local.get $self_relative)))
    (if (i32.or
          (i32.or (i32.eq (local.get $owner) (i32.const -1))
                  (i32.eq (local.get $group) (i32.const -1)))
          (i32.or
            (i32.and (i32.ne (local.get $owner) (i32.const 0))
                     (i32.eqz (call $security_sid_valid (local.get $owner))))
            (i32.and (i32.ne (local.get $group) (i32.const 0))
                     (i32.eqz (call $security_sid_valid (local.get $group))))))
      (then (return (i32.const 0))))
    (if (i32.ne (i32.and (local.get $control) (i32.const 0x10)) (i32.const 0))
      (then
        (local.set $sacl
          (call $security_sd_component (local.get $sd)
            (call $gl32 (i32.add (local.get $sd) (i32.const 12)))
            (local.get $self_relative)))
        (if (i32.or
              (i32.eq (local.get $sacl) (i32.const -1))
              (i32.and (i32.ne (local.get $sacl) (i32.const 0))
                       (i32.eqz (call $security_acl_valid (local.get $sacl)))))
          (then (return (i32.const 0))))))
    (if (i32.ne (i32.and (local.get $control) (i32.const 4)) (i32.const 0))
      (then
        (local.set $dacl
          (call $security_sd_component (local.get $sd)
            (call $gl32 (i32.add (local.get $sd) (i32.const 16)))
            (local.get $self_relative)))
        (if (i32.or
              (i32.eq (local.get $dacl) (i32.const -1))
              (i32.and (i32.ne (local.get $dacl) (i32.const 0))
                       (i32.eqz (call $security_acl_valid (local.get $dacl)))))
          (then (return (i32.const 0))))))
    (i32.const 1))

  (func $security_descriptor_length (param $sd i32) (result i32)
    (local $control i32) (local $self_relative i32) (local $length i32)
    (local $raw i32) (local $ptr i32) (local $component_length i32)
    (local.set $control (call $gl16 (i32.add (local.get $sd) (i32.const 2))))
    (local.set $self_relative
      (i32.ne (i32.and (local.get $control) (i32.const 0x8000)) (i32.const 0)))
    (local.set $length (i32.const 20))

    ;; Owner and primary group SIDs are meaningful whenever their fields are
    ;; nonzero.  The present bits gate SACL/DACL fields.
    (local.set $raw (call $gl32 (i32.add (local.get $sd) (i32.const 4))))
    (if (local.get $raw)
      (then
        (local.set $ptr (call $security_sd_component
          (local.get $sd) (local.get $raw) (local.get $self_relative)))
        (local.set $component_length (call $security_sid_length (local.get $ptr)))
        (local.set $length
          (if (result i32) (local.get $self_relative)
            (then (call $security_max_u (local.get $length)
              (i32.add (local.get $raw) (local.get $component_length))))
            (else (i32.add (local.get $length) (local.get $component_length)))))))
    (local.set $raw (call $gl32 (i32.add (local.get $sd) (i32.const 8))))
    (if (local.get $raw)
      (then
        (local.set $ptr (call $security_sd_component
          (local.get $sd) (local.get $raw) (local.get $self_relative)))
        (local.set $component_length (call $security_sid_length (local.get $ptr)))
        (local.set $length
          (if (result i32) (local.get $self_relative)
            (then (call $security_max_u (local.get $length)
              (i32.add (local.get $raw) (local.get $component_length))))
            (else (i32.add (local.get $length) (local.get $component_length)))))))
    (if (i32.ne (i32.and (local.get $control) (i32.const 0x10)) (i32.const 0))
      (then
        (local.set $raw (call $gl32 (i32.add (local.get $sd) (i32.const 12))))
        (if (local.get $raw)
          (then
            (local.set $ptr (call $security_sd_component
              (local.get $sd) (local.get $raw) (local.get $self_relative)))
            (local.set $component_length
              (call $gl16 (i32.add (local.get $ptr) (i32.const 2))))
            (local.set $length
              (if (result i32) (local.get $self_relative)
                (then (call $security_max_u (local.get $length)
                  (i32.add (local.get $raw) (local.get $component_length))))
                (else (i32.add (local.get $length) (local.get $component_length)))))))))
    (if (i32.ne (i32.and (local.get $control) (i32.const 4)) (i32.const 0))
      (then
        (local.set $raw (call $gl32 (i32.add (local.get $sd) (i32.const 16))))
        (if (local.get $raw)
          (then
            (local.set $ptr (call $security_sd_component
              (local.get $sd) (local.get $raw) (local.get $self_relative)))
            (local.set $component_length
              (call $gl16 (i32.add (local.get $ptr) (i32.const 2))))
            (local.set $length
              (if (result i32) (local.get $self_relative)
                (then (call $security_max_u (local.get $length)
                  (i32.add (local.get $raw) (local.get $component_length))))
                (else (i32.add (local.get $length) (local.get $component_length)))))))))
    (local.get $length))

  (func $security_accessor_fail
    (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $handle_IsValidSid (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $security_sid_valid (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_IsValidAcl (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $security_acl_valid (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_IsValidSecurityDescriptor (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $security_descriptor_valid (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_GetSecurityDescriptorControl (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $revision i32) (local $control i32)
    (if (i32.or
          (i32.eqz (call $security_span_valid (local.get $arg0) (i32.const 20)))
          (i32.or
            (i32.eqz (call $security_span_valid (local.get $arg1) (i32.const 2)))
            (i32.eqz (call $security_span_valid (local.get $arg2) (i32.const 4)))))
      (then (call $security_accessor_fail))
      (else
        (local.set $revision (call $gl8 (local.get $arg0)))
        (local.set $control (call $gl16 (i32.add (local.get $arg0) (i32.const 2))))
        ;; Microsoft documents that lpdwRevision is set even when descriptor
        ;; validation fails.  Load both values before either output is touched.
        (call $gs32 (local.get $arg2) (local.get $revision))
        (if (call $security_descriptor_valid (local.get $arg0))
          (then
            (call $gs16 (local.get $arg1) (local.get $control))
            (i32.store offset=0 (global.get $reg_base) (i32.const 1)))
          (else (call $security_accessor_fail)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_GetSecurityDescriptorLength (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (if (result i32) (call $security_descriptor_valid (local.get $arg0))
        (then (call $security_descriptor_length (local.get $arg0)))
        (else (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $security_get_sid_component
      (param $sd i32) (param $field_offset i32) (param $default_bit i32)
      (param $out_sid i32) (param $out_defaulted i32)
    (local $control i32) (local $raw i32) (local $sid i32)
    (if (i32.or
          (i32.eqz (call $security_descriptor_valid (local.get $sd)))
          (i32.eqz (call $security_span_valid (local.get $out_sid) (i32.const 4))))
      (then (call $security_accessor_fail) (return)))
    (local.set $control (call $gl16 (i32.add (local.get $sd) (i32.const 2))))
    (local.set $raw (call $gl32 (i32.add (local.get $sd) (local.get $field_offset))))
    (local.set $sid
      (call $security_sd_component (local.get $sd) (local.get $raw)
        (i32.ne (i32.and (local.get $control) (i32.const 0x8000)) (i32.const 0))))
    (if (i32.and
          (i32.ne (local.get $sid) (i32.const 0))
          (i32.eqz (call $security_span_valid (local.get $out_defaulted) (i32.const 4))))
      (then (call $security_accessor_fail) (return)))
    ;; An absent owner/group sets the pointer to NULL and leaves the ignored
    ;; Defaulted output unchanged.
    (if (local.get $sid)
      (then
        (call $gs32 (local.get $out_defaulted)
          (i32.ne (i32.and (local.get $control) (local.get $default_bit)) (i32.const 0)))))
    (call $gs32 (local.get $out_sid) (local.get $sid))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1)))

  (func $handle_GetSecurityDescriptorOwner (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $security_get_sid_component (local.get $arg0) (i32.const 4) (i32.const 1)
      (local.get $arg1) (local.get $arg2))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_GetSecurityDescriptorGroup (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $security_get_sid_component (local.get $arg0) (i32.const 8) (i32.const 2)
      (local.get $arg1) (local.get $arg2))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $security_get_acl_component
      (param $sd i32) (param $field_offset i32) (param $present_bit i32)
      (param $default_bit i32) (param $out_present i32) (param $out_acl i32)
      (param $out_defaulted i32)
    (local $control i32) (local $present i32) (local $raw i32) (local $acl i32)
    (if (i32.or
          (i32.eqz (call $security_descriptor_valid (local.get $sd)))
          (i32.eqz (call $security_span_valid (local.get $out_present) (i32.const 4))))
      (then (call $security_accessor_fail) (return)))
    (local.set $control (call $gl16 (i32.add (local.get $sd) (i32.const 2))))
    (local.set $present
      (i32.ne (i32.and (local.get $control) (local.get $present_bit)) (i32.const 0)))
    (if (local.get $present)
      (then
        (if (i32.or
              (i32.eqz (call $security_span_valid (local.get $out_acl) (i32.const 4)))
              (i32.eqz (call $security_span_valid (local.get $out_defaulted) (i32.const 4))))
          (then (call $security_accessor_fail) (return)))
        (local.set $raw
          (call $gl32 (i32.add (local.get $sd) (local.get $field_offset))))
        (local.set $acl
          (call $security_sd_component (local.get $sd) (local.get $raw)
            (i32.ne (i32.and (local.get $control) (i32.const 0x8000)) (i32.const 0))))
        (call $gs32 (local.get $out_acl) (local.get $acl))
        (call $gs32 (local.get $out_defaulted)
          (i32.ne (i32.and (local.get $control) (local.get $default_bit)) (i32.const 0)))))
    ;; If the ACL is absent, only Present is defined and the other outputs are
    ;; deliberately left untouched.
    (call $gs32 (local.get $out_present) (local.get $present))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1)))

  (func $handle_GetSecurityDescriptorSacl (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $security_get_acl_component
      (local.get $arg0) (i32.const 12) (i32.const 0x10) (i32.const 0x20)
      (local.get $arg1) (local.get $arg2) (local.get $arg3))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  (func $handle_GetSecurityDescriptorDacl (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $security_get_acl_component
      (local.get $arg0) (i32.const 16) (i32.const 4) (i32.const 8)
      (local.get $arg1) (local.get $arg2) (local.get $arg3))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; InitializeAcl(pAcl, nAclLength, dwAclRevision). ACL is an 8-byte header
  ;; followed by variable-sized ACE records.
  (func $handle_InitializeAcl (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.and (i32.ne (local.get $arg0) (i32.const 0))
                 (i32.ge_u (local.get $arg1) (i32.const 8)))
      (then
        (memory.fill (call $g2w (local.get $arg0)) (i32.const 0) (local.get $arg1))
        (call $gs8 (local.get $arg0) (local.get $arg2))
        (call $gs16 (i32.add (local.get $arg0) (i32.const 2)) (local.get $arg1))
        (global.set $last_error (i32.const 0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1)))
      (else
        (global.set $last_error (i32.const 87))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; AddAccessAllowedAce(pAcl, revision, mask, pSid).
  (func $handle_AddAccessAllowedAce (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $count i32) (local $i i32) (local $used i32)
    (local $sid_size i32) (local $ace_size i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (if (i32.and (i32.ne (local.get $arg0) (i32.const 0))
                 (i32.ne (local.get $arg3) (i32.const 0)))
      (then
        (local.set $count (call $gl16 (i32.add (local.get $arg0) (i32.const 4))))
        (local.set $used (i32.const 8))
        (block $walk_done (loop $walk
          (br_if $walk_done (i32.ge_u (local.get $i) (local.get $count)))
          (local.set $used (i32.add (local.get $used)
            (call $gl16 (i32.add (local.get $arg0)
              (i32.add (local.get $used) (i32.const 2))))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $walk)))
        (local.set $sid_size (i32.add (i32.const 8)
          (i32.shl (call $gl8 (i32.add (local.get $arg3) (i32.const 1))) (i32.const 2))))
        (local.set $ace_size (i32.add (i32.const 8) (local.get $sid_size)))
        (if (i32.le_u (i32.add (local.get $used) (local.get $ace_size))
                      (call $gl16 (i32.add (local.get $arg0) (i32.const 2))))
          (then
            (call $gs8 (i32.add (local.get $arg0) (local.get $used)) (i32.const 0)) ;; ACCESS_ALLOWED_ACE_TYPE
            (call $gs8 (i32.add (local.get $arg0) (i32.add (local.get $used) (i32.const 1))) (i32.const 0))
            (call $gs16 (i32.add (local.get $arg0) (i32.add (local.get $used) (i32.const 2))) (local.get $ace_size))
            (call $gs32 (i32.add (local.get $arg0) (i32.add (local.get $used) (i32.const 4))) (local.get $arg2))
            (call $memcpy
              (call $g2w (i32.add (local.get $arg0) (i32.add (local.get $used) (i32.const 8))))
              (call $g2w (local.get $arg3)) (local.get $sid_size))
            (call $gs16 (i32.add (local.get $arg0) (i32.const 4))
              (i32.add (local.get $count) (i32.const 1)))
            (global.set $last_error (i32.const 0))
            (i32.store offset=0 (global.get $reg_base) (i32.const 1)))
          (else (global.set $last_error (i32.const 1344)))))) ;; ERROR_ALLOTTED_SPACE_EXCEEDED
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; GetAce(pAcl, index, ppAce).
  (func $handle_GetAce (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $i i32) (local $used i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (if (i32.and
          (i32.and (i32.ne (local.get $arg0) (i32.const 0)) (i32.ne (local.get $arg2) (i32.const 0)))
          (i32.lt_u (local.get $arg1) (call $gl16 (i32.add (local.get $arg0) (i32.const 4)))))
      (then
        (local.set $used (i32.const 8))
        (block $found (loop $walk
          (br_if $found (i32.ge_u (local.get $i) (local.get $arg1)))
          (local.set $used (i32.add (local.get $used)
            (call $gl16 (i32.add (local.get $arg0)
              (i32.add (local.get $used) (i32.const 2))))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $walk)))
        (call $gs32 (local.get $arg2) (i32.add (local.get $arg0) (local.get $used)))
        (global.set $last_error (i32.const 0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; Attach an absolute ACL pointer to SECURITY_DESCRIPTOR.Dacl.
  (func $handle_SetSecurityDescriptorDacl (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg0)
      (then
        (call $gs32 (i32.add (local.get $arg0) (i32.const 16))
          (select (local.get $arg2) (i32.const 0) (local.get $arg1)))
        (call $gs16 (i32.add (local.get $arg0) (i32.const 2))
          (i32.or
            (i32.and (call $gl16 (i32.add (local.get $arg0) (i32.const 2))) (i32.const 0xFFF3))
            (i32.or
              (select (i32.const 4) (i32.const 0) (local.get $arg1))
              (select (i32.const 8) (i32.const 0) (local.get $arg3)))))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1)))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; Win9x has no NT file security descriptors. Keep all four A/W compatibility
  ;; exports callable for binaries that import them unconditionally, but report
  ;; the same unsupported result instead of pretending an ACL mutation stuck.
  (func $file_security_not_supported (param $length_needed i32)
    (if (i32.and
          (i32.ne (local.get $length_needed) (i32.const 0))
          (i32.eqz (call $ptr_range_access_bad
            (local.get $length_needed) (i32.const 4) (i32.const 1))))
      (then (call $gs32 (local.get $length_needed) (i32.const 0))))
    (global.set $last_error (i32.const 120)) ;; ERROR_CALL_NOT_IMPLEMENTED
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  ;; Windows 9x does not attach the NT access-control security descriptors used
  ;; by Get/SetKernelObjectSecurity to kernel handles. Keep these ADVAPI32 names
  ;; callable for applications (including WinRAR 3.10) that import the NT and
  ;; Win9x paths together, but never fabricate a descriptor or retained ACL.
  (func $handle_GetKernelObjectSecurity (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_GetFileSecurityA
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)
      (local.get $arg4) (local.get $name_ptr))
    (return))

  (func $handle_SetKernelObjectSecurity (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_SetFileSecurityA
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
    (return))

  (func $handle_SetFileSecurityA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $file_security_not_supported (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_SetFileSecurityW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_SetFileSecurityA
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $handle_AllocateAndInitializeSid (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $sid i32) (local $out i32) (local $sid_wa i32)
    (local.set $out (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 44))))
    (if (i32.and
          (i32.and
            (i32.ne (local.get $arg0) (i32.const 0))
            (i32.ne (local.get $out) (i32.const 0)))
          (i32.le_u (local.get $arg1) (i32.const 8)))
      (then
        (local.set $sid (call $heap_alloc (i32.const 40)))
        (if (local.get $sid)
          (then
            (local.set $sid_wa (call $g2w (local.get $sid))) (memory.fill (local.get $sid_wa) (i32.const 0) (i32.const 40))
            (call $gs8 (local.get $sid) (i32.const 1))
            (call $gs8 (i32.add (local.get $sid) (i32.const 1)) (local.get $arg1))
            (if (local.get $arg0)
              (then (call $memcpy
                (i32.add (local.get $sid_wa) (i32.const 2))
                (call $g2w (local.get $arg0)) (i32.const 6))))
            (call $gs32 (i32.add (local.get $sid) (i32.const 8)) (local.get $arg2))
            (call $gs32 (i32.add (local.get $sid) (i32.const 12)) (local.get $arg3))
            (call $gs32 (i32.add (local.get $sid) (i32.const 16)) (local.get $arg4))
            (call $gs32 (i32.add (local.get $sid) (i32.const 20))
              (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
            (call $gs32 (i32.add (local.get $sid) (i32.const 24))
              (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
            (call $gs32 (i32.add (local.get $sid) (i32.const 28))
              (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32))))
            (call $gs32 (i32.add (local.get $sid) (i32.const 32))
              (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36))))
            (call $gs32 (i32.add (local.get $sid) (i32.const 36))
              (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 40))))
            (call $gs32 (local.get $out) (local.get $sid))
            (i32.store offset=0 (global.get $reg_base) (i32.const 1)))
          (else (i32.store offset=0 (global.get $reg_base) (i32.const 0)))))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 48)))
  )

  (func $handle_SetSecurityDescriptorOwner (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg0)
      (then
        (call $gs32 (i32.add (local.get $arg0) (i32.const 4)) (local.get $arg1))
        (call $gs16 (i32.add (local.get $arg0) (i32.const 2))
          (i32.or
            (i32.and (call $gl16 (i32.add (local.get $arg0) (i32.const 2)))
              (i32.const 0xFFFE))
            (i32.ne (local.get $arg2) (i32.const 0))))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1)))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  (func $handle_FreeSid (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg0) (then (call $heap_free (local.get $arg0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  (func $handle_EqualSid (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $count i32) (local $size i32) (local $a i32) (local $b i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (if (i32.and
          (i32.ne (local.get $arg0) (i32.const 0))
          (i32.ne (local.get $arg1) (i32.const 0)))
      (then
        (local.set $count (call $gl8 (i32.add (local.get $arg0) (i32.const 1))))
        (if (i32.and
              (i32.le_u (local.get $count) (i32.const 8))
              (i32.eq (local.get $count)
                (call $gl8 (i32.add (local.get $arg1) (i32.const 1)))))
          (then
            (local.set $size (i32.add (i32.const 8)
              (i32.mul (local.get $count) (i32.const 4))))
            (local.set $a (call $g2w (local.get $arg0)))
            (local.set $b (call $g2w (local.get $arg1)))
            (i32.store offset=0 (global.get $reg_base) (i32.const 1))
            (block $different
              (loop $compare
                (br_if $different (i32.eqz (local.get $size)))
                (if (i32.ne (i32.load8_u (local.get $a)) (i32.load8_u (local.get $b)))
                  (then
                    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
                    (br $different)))
                (local.set $a (i32.add (local.get $a) (i32.const 1)))
                (local.set $b (i32.add (local.get $b) (i32.const 1)))
                (local.set $size (i32.sub (local.get $size) (i32.const 1)))
                (br $compare)))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; GetLengthSid(pSid) — fixed SID header plus one DWORD per subauthority.
  (func $handle_GetLengthSid (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (select
        (i32.add (i32.const 8)
          (i32.shl (call $gl8 (i32.add (local.get $arg0) (i32.const 1))) (i32.const 2)))
        (i32.const 0)
        (i32.ne (local.get $arg0) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; CopySid(nDestinationSidLength, pDestinationSid, pSourceSid). Validate the
  ;; complete variable-sized source and destination before copying so failure
  ;; never leaves a partial SID in the caller's buffer.
  (func $handle_CopySid (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $length i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (if (i32.eqz (call $security_sid_valid (local.get $arg2)))
      (then (global.set $last_error (i32.const 1337))) ;; ERROR_INVALID_SID
      (else
        (local.set $length (call $security_sid_length (local.get $arg2)))
        (if (i32.lt_u (local.get $arg0) (local.get $length))
          (then (global.set $last_error (i32.const 122))) ;; ERROR_INSUFFICIENT_BUFFER
          (else
            (if (i32.eqz
                  (call $security_span_valid (local.get $arg1) (local.get $length)))
              (then (global.set $last_error (i32.const 87))) ;; ERROR_INVALID_PARAMETER
              (else
                (memory.copy (call $g2w (local.get $arg1))
                  (call $g2w (local.get $arg2)) (local.get $length))
                (i32.store offset=0 (global.get $reg_base) (i32.const 1))))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; The emulator deliberately presents Windows 98. InstallShield uses a
  ;; successful OpenSCManager call to select its Windows NT service/security
  ;; path, so report that the SCM is unavailable just as on Win9x.
  (func $handle_OpenSCManagerA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $last_error (i32.const 120)) ;; ERROR_CALL_NOT_IMPLEMENTED
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  (func $handle_CloseServiceHandle (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; No service-control-manager handle can be produced by this Win98
    ;; personality, so accepting a fabricated nonzero value would be a false
    ;; success. Match the documented invalid-handle failure contract.
    (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; DosDateTimeToFileTime(wFatDate, wFatTime, lpFileTime). Convert the FAT
  ;; local calendar fields to 100ns ticks since 1601-01-01. Timezone
  ;; conversion, when requested, is handled separately by
  ;; LocalFileTimeToFileTime.
  (func $handle_DosDateTimeToFileTime (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $year i32) (local $month i32) (local $day i32)
    (local $hour i32) (local $minute i32) (local $second i32)
    (local $leap i32) (local $max_day i32) (local $month_days i32)
    (local $year_minus_one i32) (local $days i32) (local $ticks i64)
    (local.set $year (i32.add (i32.const 1980)
      (i32.and (i32.shr_u (local.get $arg0) (i32.const 9)) (i32.const 0x7f))))
    (local.set $month (i32.and (i32.shr_u (local.get $arg0) (i32.const 5)) (i32.const 0x0f)))
    (local.set $day (i32.and (local.get $arg0) (i32.const 0x1f)))
    (local.set $hour (i32.and (i32.shr_u (local.get $arg1) (i32.const 11)) (i32.const 0x1f)))
    (local.set $minute (i32.and (i32.shr_u (local.get $arg1) (i32.const 5)) (i32.const 0x3f)))
    (local.set $second (i32.mul (i32.and (local.get $arg1) (i32.const 0x1f)) (i32.const 2)))

    (local.set $leap
      (i32.or
        (i32.eq (i32.rem_u (local.get $year) (i32.const 400)) (i32.const 0))
        (i32.and
          (i32.eq (i32.rem_u (local.get $year) (i32.const 4)) (i32.const 0))
          (i32.ne (i32.rem_u (local.get $year) (i32.const 100)) (i32.const 0)))))
    (local.set $max_day (i32.const 31))
    (if (i32.eq (local.get $month) (i32.const 2))
      (then (local.set $max_day (i32.add (i32.const 28) (local.get $leap))))
      (else
        (if (i32.or
              (i32.or (i32.eq (local.get $month) (i32.const 4)) (i32.eq (local.get $month) (i32.const 6)))
              (i32.or (i32.eq (local.get $month) (i32.const 9)) (i32.eq (local.get $month) (i32.const 11))))
          (then (local.set $max_day (i32.const 30))))))

    (if
      (i32.and
        (i32.and
          (i32.and (i32.ge_u (local.get $month) (i32.const 1)) (i32.le_u (local.get $month) (i32.const 12)))
          (i32.and (i32.ge_u (local.get $day) (i32.const 1)) (i32.le_u (local.get $day) (local.get $max_day))))
        (i32.and
          (i32.and (i32.le_u (local.get $hour) (i32.const 23)) (i32.le_u (local.get $minute) (i32.const 59)))
          (i32.ne (local.get $arg2) (i32.const 0))))
      (then
        ;; Cumulative days before the selected month in a non-leap year.
        (if (i32.eq (local.get $month) (i32.const 1)) (then (local.set $month_days (i32.const 0)))
          (else (if (i32.eq (local.get $month) (i32.const 2)) (then (local.set $month_days (i32.const 31)))
          (else (if (i32.eq (local.get $month) (i32.const 3)) (then (local.set $month_days (i32.const 59)))
          (else (if (i32.eq (local.get $month) (i32.const 4)) (then (local.set $month_days (i32.const 90)))
          (else (if (i32.eq (local.get $month) (i32.const 5)) (then (local.set $month_days (i32.const 120)))
          (else (if (i32.eq (local.get $month) (i32.const 6)) (then (local.set $month_days (i32.const 151)))
          (else (if (i32.eq (local.get $month) (i32.const 7)) (then (local.set $month_days (i32.const 181)))
          (else (if (i32.eq (local.get $month) (i32.const 8)) (then (local.set $month_days (i32.const 212)))
          (else (if (i32.eq (local.get $month) (i32.const 9)) (then (local.set $month_days (i32.const 243)))
          (else (if (i32.eq (local.get $month) (i32.const 10)) (then (local.set $month_days (i32.const 273)))
          (else (if (i32.eq (local.get $month) (i32.const 11)) (then (local.set $month_days (i32.const 304)))
          (else (local.set $month_days (i32.const 334))))))))))))))))))))))))
        (if (i32.and (i32.gt_u (local.get $month) (i32.const 2)) (local.get $leap))
          (then (local.set $month_days (i32.add (local.get $month_days) (i32.const 1)))))
        (local.set $year_minus_one (i32.sub (local.get $year) (i32.const 1)))
        (local.set $days
          (i32.add
            (i32.sub
              (i32.add
                (i32.add
                  (i32.mul (local.get $year_minus_one) (i32.const 365))
                  (i32.div_u (local.get $year_minus_one) (i32.const 4)))
                (i32.div_u (local.get $year_minus_one) (i32.const 400)))
              (i32.add (i32.div_u (local.get $year_minus_one) (i32.const 100)) (i32.const 584388)))
            (i32.add (local.get $month_days) (i32.sub (local.get $day) (i32.const 1)))))
        (local.set $ticks
          (i64.mul
            (i64.add
              (i64.mul (i64.extend_i32_u (local.get $days)) (i64.const 86400))
              (i64.extend_i32_u
                (i32.add
                  (i32.add (i32.mul (local.get $hour) (i32.const 3600)) (i32.mul (local.get $minute) (i32.const 60)))
                  (local.get $second))))
            (i64.const 10000000)))
        (i64.store (call $g2w (local.get $arg2)) (local.get $ticks))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1)))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 13: DeleteFileA(lpFileName) — 1 arg stdcall
  (func $handle_DeleteFileA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $fs_path_result
      (call $host_fs_delete_file (call $g2w (local.get $arg0)) (i32.const 0))
      (local.get $arg0) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; A path operation's BOOL, with the failure's last error set the way
  ;; Windows does: a name that does not exist is ERROR_FILE_NOT_FOUND, one
  ;; that exists and still refused is ERROR_ACCESS_DENIED. Callers branch on
  ;; that code — SetupAPI's DelFiles skips a missing file and reports any other
  ;; error, so a stale last error turns "nothing to delete" into a failure.
  (func $fs_path_result (param $ok i32) (param $path i32) (param $wide i32) (result i32)
    (if (i32.eqz (local.get $ok))
      (then (global.set $last_error
        (select (i32.const 2) (i32.const 5)
          (i32.eq (call $host_fs_get_file_attributes (call $g2w (local.get $path)) (local.get $wide))
                  (i32.const -1))))))
    (local.get $ok))

  ;; 14: CreateFileA(lpFileName, dwDesiredAccess, dwShareMode, lpSecAttr, dwCreation, dwFlags, hTemplate) — 7 args
  (func $console_device_name (param $name i32) (param $wide i32) (result i32)
    (local $step i32) (local $c i32)
    (local.set $step (select (i32.const 2) (i32.const 1) (local.get $wide)))
    (if (i32.ne (i32.or (call $load_char (local.get $name) (local.get $wide)) (i32.const 0x20))
                (i32.const 0x63)) (then (return (i32.const 0)))) ;; c
    (if (i32.ne (i32.or (call $load_char (i32.add (local.get $name) (local.get $step)) (local.get $wide)) (i32.const 0x20))
                (i32.const 0x6f)) (then (return (i32.const 0)))) ;; o
    (if (i32.ne (i32.or (call $load_char (i32.add (local.get $name) (i32.mul (local.get $step) (i32.const 2))) (local.get $wide)) (i32.const 0x20))
                (i32.const 0x6e)) (then (return (i32.const 0)))) ;; n
    (local.set $c (i32.or
      (call $load_char (i32.add (local.get $name) (i32.mul (local.get $step) (i32.const 3))) (local.get $wide))
      (i32.const 0x20)))
    (if (i32.eq (local.get $c) (i32.const 0x69)) ;; CONIN$
      (then
        (if (i32.and
              (i32.eq (i32.or (call $load_char (i32.add (local.get $name) (i32.mul (local.get $step) (i32.const 4))) (local.get $wide)) (i32.const 0x20)) (i32.const 0x6e))
              (i32.and
                (i32.eq (call $load_char (i32.add (local.get $name) (i32.mul (local.get $step) (i32.const 5))) (local.get $wide)) (i32.const 0x24))
                (i32.eqz (call $load_char (i32.add (local.get $name) (i32.mul (local.get $step) (i32.const 6))) (local.get $wide)))))
          (then (return (i32.const 1))))))
    (if (i32.eq (local.get $c) (i32.const 0x6f)) ;; CONOUT$
      (then
        (if (i32.and
              (i32.eq (i32.or (call $load_char (i32.add (local.get $name) (i32.mul (local.get $step) (i32.const 4))) (local.get $wide)) (i32.const 0x20)) (i32.const 0x75))
              (i32.and
                (i32.eq (i32.or (call $load_char (i32.add (local.get $name) (i32.mul (local.get $step) (i32.const 5))) (local.get $wide)) (i32.const 0x20)) (i32.const 0x74))
                (i32.and
                  (i32.eq (call $load_char (i32.add (local.get $name) (i32.mul (local.get $step) (i32.const 6))) (local.get $wide)) (i32.const 0x24))
                  (i32.eqz (call $load_char (i32.add (local.get $name) (i32.mul (local.get $step) (i32.const 7))) (local.get $wide))))))
          (then (return (i32.const 2))))))
    (i32.const 0))

  (func $handle_CreateFileA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa_esp i32) (local $creation i32) (local $flags i32) (local $device i32) (local $path_wa i32)
    (local.set $path_wa (call $g2w (local.get $arg0)))
    (local.set $device (call $console_device_name (local.get $path_wa) (i32.const 0)))
    (if (call $quartz_vxd_name (local.get $path_wa) (i32.const 0))
      (then (local.set $device (global.get $QUARTZ_VXD_HANDLE))))
    (if (local.get $device)
      (then
        (i32.store offset=0 (global.get $reg_base) (local.get $device))
        (global.set $last_error (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
        (return)))
    (local.set $wa_esp (call $g2w (i32.load offset=16 (global.get $reg_base))))
    (local.set $creation (local.get $arg4))
    (local.set $flags (i32.load (i32.add (local.get $wa_esp) (i32.const 24))))
    (global.set $last_error (call $host_fs_create_file_result
      (local.get $path_wa)           ;; pathWA
      (local.get $arg1)               ;; access
      (local.get $creation)            ;; creation disposition
      (local.get $flags)               ;; flags and attributes
      (i32.const 0) (global.get $reg_base))) ;; isWide=0; handle output in EAX
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))  ;; 7 args + ret
    (if (i32.eq (global.get $last_error) (i32.const 997))
      (then (call $io_block (i32.const 32))))
  )

  ;; 15: FindFirstFileA(lpFileName, lpFindFileData) — 2 args stdcall
  (func $handle_FindFirstFileA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_fs_find_first_file
      (call $g2w (local.get $arg0)) (local.get $arg1) (i32.const 0)))
    (if (i32.eq (i32.load offset=0 (global.get $reg_base)) (i32.const -1))
      (then (global.set $last_error (i32.const 2)))) ;; ERROR_FILE_NOT_FOUND
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; FindFirstFileExA(lpFileName, fInfoLevelId, lpFindFileData, fSearchOp,
  ;; lpSearchFilter, dwAdditionalFlags). FindExInfoStandard (0) and
  ;; FindExInfoBasic (1, which only leaves cAlternateFileName empty) fill the
  ;; same WIN32_FIND_DATAA as FindFirstFileA; FindExSearchLimitToDirectories
  ;; is advisory in Win32 and FindExSearchNameMatch is the plain search, so both
  ;; take the FindFirstFileA path. Pocket Tanks calls this from its LAN Create
  ;; Game screen. Other levels, search operations and filters fail loudly.
  (func $handle_FindFirstFileExA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.or (i32.or (i32.gt_u (local.get $arg1) (i32.const 1))
                        (i32.gt_u (local.get $arg3) (i32.const 1)))
                (i32.ne (local.get $arg4) (i32.const 0)))
      (then (call $crash_unimplemented (local.get $name_ptr))))
    (i32.store offset=0 (global.get $reg_base) (call $host_fs_find_first_file
      (call $g2w (local.get $arg0)) (local.get $arg2) (i32.const 0)))
    (if (i32.eq (i32.load offset=0 (global.get $reg_base)) (i32.const -1))
      (then (global.set $last_error (i32.const 2)))) ;; ERROR_FILE_NOT_FOUND
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
  )

  ;; 16: FindClose(hFindFile) — 1 arg stdcall
  (func $handle_FindClose (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_fs_find_close (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; FindFirst/Next/CloseChangeNotification. The wait object is a manual-reset
  ;; ThreadManager event; the VFS owns the watched path/filter and signals it
  ;; when a matching mutation occurs. FindNext rearms the latch, including a
  ;; change recorded while the prior notification was still signalled.
  (func $find_first_change_notification (param $path_wa i32) (param $subtree i32) (param $filter i32) (param $wide i32) (result i32)
    (local $attrs i32) (local $handle i32)
    (local.set $attrs (if (result i32) (local.get $path_wa)
      (then (call $host_fs_get_file_attributes (local.get $path_wa) (local.get $wide)))
      (else (i32.const -1))))
    (if (i32.or (i32.eq (local.get $attrs) (i32.const -1))
                (i32.eqz (i32.and (local.get $attrs) (i32.const 0x10))))
      (then
        (global.set $last_error (i32.const 3)) ;; ERROR_PATH_NOT_FOUND
        (return (i32.const -1))))
    ;; Win98 accepts the documented name/attribute/size/write/security mask.
    (if (i32.or
          (i32.eqz (local.get $filter))
          (i32.ne (i32.and (local.get $filter) (i32.const 0xfffffee0)) (i32.const 0)))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (return (i32.const -1))))
    (local.set $handle (call $host_create_event
      (i32.const 1) (i32.const 0) (i32.const 0) (i32.const 0)))
    (if (i32.eqz (local.get $handle))
      (then
        (global.set $last_error (i32.const 8)) ;; ERROR_NOT_ENOUGH_MEMORY
        (return (i32.const -1))))
    (if (i32.eqz (call $host_fs_register_change_notification
          (local.get $handle) (local.get $path_wa) (local.get $subtree)
          (local.get $filter) (local.get $wide)))
      (then
        (drop (call $host_fs_close_handle (local.get $handle)))
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (return (i32.const -1))))
    (global.set $last_error (i32.const 0))
    (local.get $handle))

  (func $handle_FindFirstChangeNotificationA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $find_first_change_notification
      (if (result i32) (local.get $arg0)
        (then (call $g2w (local.get $arg0))) (else (i32.const 0)))
      (local.get $arg1) (local.get $arg2) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  (func $handle_FindFirstChangeNotificationW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $find_first_change_notification
      (if (result i32) (local.get $arg0)
        (then (call $g2w (local.get $arg0))) (else (i32.const 0)))
      (local.get $arg1) (local.get $arg2) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  (func $handle_FindNextChangeNotification (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_fs_next_change_notification (local.get $arg0)))
    (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
      (then (global.set $last_error (i32.const 6)))
      (else (global.set $last_error (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  (func $handle_FindCloseChangeNotification (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_fs_close_change_notification (local.get $arg0)))
    (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
      (then (global.set $last_error (i32.const 6))) ;; ERROR_INVALID_HANDLE
      (else (global.set $last_error (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 17: MulDiv
  (func $handle_MulDiv (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; RichEdit uses 32767 twips as an internal "effectively infinite" size
    ;; sentinel. Letting the generic pixel conversion through turns that into
    ;; a thousands-pixel document/font metric and WordPad scrolls typed text
    ;; offscreen. Clamp this exact screen-DPI twips conversion to a normal line
    ;; height.
    (if (i32.and
          (i32.and
            (i32.eq (local.get $arg0) (i32.const 32767))
            (i32.eq (local.get $arg1) (i32.const 96)))
          (i32.eq (local.get $arg2) (i32.const 1440)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 16))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (if (i32.eqz (local.get $arg2))
    (then (i32.store offset=0 (global.get $reg_base) (i32.const -1)))
    (else (i32.store offset=0 (global.get $reg_base) (i32.wrap_i64 (i64.div_s
    (i64.mul (i64.extend_i32_s (local.get $arg0)) (i64.extend_i32_s (local.get $arg1)))
    (i64.extend_i32_s (local.get $arg2)))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))) (return)
  )

  ;; 18: RtlMoveMemory
  (func $handle_RtlMoveMemory (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $guest_memmove (local.get $arg0) (local.get $arg1) (local.get $arg2))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))) (return)
  )

  ;; 19: _lcreat(lpPathName, iAttribute) — 2 args stdcall.
  ;; Equivalent to CreateFile(path, GENERIC_READ|GENERIC_WRITE, 0, NULL,
  ;; CREATE_ALWAYS, iAttribute, NULL). Returns HFILE or HFILE_ERROR(-1).
  (func $handle__lcreat (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $attr i32)
    ;; iAttribute: 0=normal, 1=readonly, 2=hidden, 3=system. Map low bits to
    ;; FILE_ATTRIBUTE_*; default to NORMAL when iAttribute=0.
    (local.set $attr (i32.or (local.get $arg1) (i32.const 0x80)))
    (i32.store offset=0 (global.get $reg_base) (call $host_fs_create_legacy_file
      (call $g2w (local.get $arg0))
      (i32.const 0xC0000000)  ;; GENERIC_READ | GENERIC_WRITE
      (i32.const 2)           ;; CREATE_ALWAYS
      (local.get $attr)
      (i32.const 0)))         ;; isWide=0
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))  ;; 2 args + ret
  )

  ;; 20: _lopen(lpPathName, iReadWrite) — 2 args stdcall. The low two bits of
  ;; iReadWrite are OF_READ (0), OF_WRITE (1) or OF_READWRITE (2); the share
  ;; bits above them do not change what this handle may do. Opening everything
  ;; read-only made every write through it fail: DOS INT 21h AH=3Dh routes here,
  ;; and InstallShield's 16-bit self-extractor reopens each file it creates
  ;; that way before writing it.
  (func $handle__lopen (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $mode i32)
    (local.set $mode (i32.and (local.get $arg1) (i32.const 3)))
    (i32.store offset=0 (global.get $reg_base) (call $host_fs_create_legacy_file
      (call $g2w (local.get $arg0))
      (select (i32.const 0x40000000)                  ;; OF_WRITE: GENERIC_WRITE
        (select (i32.const 0xC0000000) (i32.const 0x80000000)
          (i32.eq (local.get $mode) (i32.const 2)))    ;; OF_READWRITE / OF_READ
        (i32.eq (local.get $mode) (i32.const 1)))
      (i32.const 3)           ;; OPEN_EXISTING
      (i32.const 0x80)        ;; FILE_ATTRIBUTE_NORMAL
      (i32.const 0)))         ;; isWide=0
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))  ;; 2 args + ret
  )

  ;; 21: _lwrite(hFile, lpBuffer, uBytes) — 3 args stdcall.
  ;; Returns bytes written, or HFILE_ERROR(-1) on failure.
  (func $handle__lwrite (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $bytes_written_ga i32) (local $bytes_written_wa i32)
    (local.set $bytes_written_ga (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (local.set $bytes_written_wa (call $g2w (local.get $bytes_written_ga)))
    (i32.store (local.get $bytes_written_wa) (i32.const 0))
    (if (call $host_fs_write_file
          (local.get $arg0) (local.get $arg1)
          (local.get $arg2) (local.get $bytes_written_ga))
      (then (i32.store offset=0 (global.get $reg_base) (i32.load (local.get $bytes_written_wa))))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 0xFFFFFFFF))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))  ;; 3 args + ret
  )

  ;; Legacy HFILE, LZ, and MMIO seeks use the same three origin values and
  ;; return the new absolute position.  Their invalid-origin results differ:
  ;; _llseek/mmioSeek return -1, while LZSeek returns LZERROR_BADVALUE (-7).
  (func $legacy_file_seek
      (param $handle i32) (param $offset i32) (param $origin i32)
      (param $bad_origin i32) (result i32)
    (if (i32.gt_u (local.get $origin) (i32.const 2))
      (then (return (local.get $bad_origin))))
    (call $host_fs_set_file_pointer
      (local.get $handle) (local.get $offset) (local.get $origin)))

  ;; 22: _llseek(hFile, lOffset, iOrigin) — 3 args stdcall.
  (func $handle__llseek (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $legacy_file_seek
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (i32.const -1)))       ;; HFILE_ERROR
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))  ;; 3 args + ret
  )

  ;; 23: _lclose — STUB: unimplemented
  (func $handle__lclose (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; _lclose(hFile) — 1 arg stdcall
    (drop (call $host_fs_close_handle (local.get $arg0)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))  ;; 1 arg + ret
  )

  ;; 24: _lread
  (func $handle__lread (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; _lread(hFile, lpBuffer, uBytes) — 3 args stdcall
    ;; This is the one implementation shared by _hread and mmioRead below.
    ;; A successful zero-byte read is EOF; a host failure is HFILE_ERROR (-1).
    ;; Provider-backed files park and retry this same thunk instead of turning
    ;; a not-yet-resident chunk into false EOF.
    (local $bytes_read_ga i32) (local $bytes_read_wa i32)
    (local $read_ok i32) (local $pending i32)
    (local.set $bytes_read_ga (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (local.set $bytes_read_wa (call $g2w (local.get $bytes_read_ga)))
    (i32.store (local.get $bytes_read_wa) (i32.const 0))
    (local.set $read_ok (call $host_fs_read_file
      (local.get $arg0)
      (local.get $arg1)
      (local.get $arg2)
      (local.get $bytes_read_ga)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))  ;; 3 args + ret
    (if (local.get $read_ok)
      (then (i32.store offset=0 (global.get $reg_base) (i32.load (local.get $bytes_read_wa))))
      (else
        (local.set $pending (call $host_fs_read_pending))
        (if (i32.eq (local.get $pending) (i32.const 1))
          (then
            ;; The Win16 bridge owns its Pascal frame and parks it after the
            ;; temporary 32-bit frame has been restored. Redirecting that
            ;; scratch frame here would make $win16_call32_end trap.
            (if (global.get $win16_in_call32)
              (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
              (else (call $io_block (i32.const 16)))))
          (else
            (i32.store offset=0 (global.get $reg_base) (i32.const -1))
            (if (local.get $pending)
              (then (global.set $last_error (i32.const 30)))))))) ;; ERROR_READ_FAULT
  )

  ;; VkKeyScanA(CHAR ch) → SHORT. The low byte is the virtual-key code and
  ;; the high byte contains modifier state (bit 0 = SHIFT).
  ;; Character → (shift state << 8) | virtual key, or 0xFFFF for a character
  ;; this keyboard cannot produce. Both spellings translate the same character
  ;; set, so they translate it in the same place.
  (func $vk_key_scan (param $ch i32) (result i32)
    ;; 'a'-'z' → vkey = uppercase, shift=0
    (if (i32.and (i32.ge_u (local.get $ch) (i32.const 0x61)) (i32.le_u (local.get $ch) (i32.const 0x7A)))
      (then (return (i32.sub (local.get $ch) (i32.const 0x20)))))
    ;; 'A'-'Z' → vkey = char, shift=1 (high byte = 0x01)
    (if (i32.and (i32.ge_u (local.get $ch) (i32.const 0x41)) (i32.le_u (local.get $ch) (i32.const 0x5A)))
      (then (return (i32.or (local.get $ch) (i32.const 0x0100)))))
    ;; '0'-'9' → vkey = char, shift=0
    (if (i32.and (i32.ge_u (local.get $ch) (i32.const 0x30)) (i32.le_u (local.get $ch) (i32.const 0x39)))
      (then (return (local.get $ch))))
    ;; Space, Tab, Enter, Escape, Backspace
    (if (i32.eq (local.get $ch) (i32.const 0x20)) (then (return (i32.const 0x20))))
    (if (i32.eq (local.get $ch) (i32.const 0x09)) (then (return (i32.const 0x09))))
    (if (i32.eq (local.get $ch) (i32.const 0x0D)) (then (return (i32.const 0x0D))))
    (if (i32.eq (local.get $ch) (i32.const 0x1B)) (then (return (i32.const 0x1B))))
    (if (i32.eq (local.get $ch) (i32.const 0x08)) (then (return (i32.const 0x08))))
    ;; Unshifted punctuation on the Win98 US keyboard.
    (if (i32.eq (local.get $ch) (i32.const 0x60)) (then (return (i32.const 0xc0)))) ;; `
    (if (i32.eq (local.get $ch) (i32.const 0x2d)) (then (return (i32.const 0xbd)))) ;; -
    (if (i32.eq (local.get $ch) (i32.const 0x3d)) (then (return (i32.const 0xbb)))) ;; =
    (if (i32.eq (local.get $ch) (i32.const 0x5b)) (then (return (i32.const 0xdb)))) ;; [
    (if (i32.eq (local.get $ch) (i32.const 0x5d)) (then (return (i32.const 0xdd)))) ;; ]
    (if (i32.eq (local.get $ch) (i32.const 0x5c)) (then (return (i32.const 0xdc)))) ;; backslash
    (if (i32.eq (local.get $ch) (i32.const 0x3b)) (then (return (i32.const 0xba)))) ;; ;
    (if (i32.eq (local.get $ch) (i32.const 0x27)) (then (return (i32.const 0xde)))) ;; '
    (if (i32.eq (local.get $ch) (i32.const 0x2c)) (then (return (i32.const 0xbc)))) ;; ,
    (if (i32.eq (local.get $ch) (i32.const 0x2e)) (then (return (i32.const 0xbe)))) ;; .
    (if (i32.eq (local.get $ch) (i32.const 0x2f)) (then (return (i32.const 0xbf)))) ;; /
    ;; Shifted number row and shifted punctuation. Modifier bit 0 means SHIFT.
    (if (i32.eq (local.get $ch) (i32.const 0x21)) (then (return (i32.const 0x0131)))) ;; !
    (if (i32.eq (local.get $ch) (i32.const 0x40)) (then (return (i32.const 0x0132)))) ;; @
    (if (i32.eq (local.get $ch) (i32.const 0x23)) (then (return (i32.const 0x0133)))) ;; #
    (if (i32.eq (local.get $ch) (i32.const 0x24)) (then (return (i32.const 0x0134)))) ;; $
    (if (i32.eq (local.get $ch) (i32.const 0x25)) (then (return (i32.const 0x0135)))) ;; %
    (if (i32.eq (local.get $ch) (i32.const 0x5e)) (then (return (i32.const 0x0136)))) ;; ^
    (if (i32.eq (local.get $ch) (i32.const 0x26)) (then (return (i32.const 0x0137)))) ;; &
    (if (i32.eq (local.get $ch) (i32.const 0x2a)) (then (return (i32.const 0x0138)))) ;; *
    (if (i32.eq (local.get $ch) (i32.const 0x28)) (then (return (i32.const 0x0139)))) ;; (
    (if (i32.eq (local.get $ch) (i32.const 0x29)) (then (return (i32.const 0x0130)))) ;; )
    (if (i32.eq (local.get $ch) (i32.const 0x7e)) (then (return (i32.const 0x01c0)))) ;; ~
    (if (i32.eq (local.get $ch) (i32.const 0x5f)) (then (return (i32.const 0x01bd)))) ;; _
    (if (i32.eq (local.get $ch) (i32.const 0x2b)) (then (return (i32.const 0x01bb)))) ;; +
    (if (i32.eq (local.get $ch) (i32.const 0x7b)) (then (return (i32.const 0x01db)))) ;; {
    (if (i32.eq (local.get $ch) (i32.const 0x7d)) (then (return (i32.const 0x01dd)))) ;; }
    (if (i32.eq (local.get $ch) (i32.const 0x7c)) (then (return (i32.const 0x01dc)))) ;; |
    (if (i32.eq (local.get $ch) (i32.const 0x3a)) (then (return (i32.const 0x01ba)))) ;; :
    (if (i32.eq (local.get $ch) (i32.const 0x22)) (then (return (i32.const 0x01de)))) ;; "
    (if (i32.eq (local.get $ch) (i32.const 0x3c)) (then (return (i32.const 0x01bc)))) ;; <
    (if (i32.eq (local.get $ch) (i32.const 0x3e)) (then (return (i32.const 0x01be)))) ;; >
    (if (i32.eq (local.get $ch) (i32.const 0x3f)) (then (return (i32.const 0x01bf)))) ;; ?
    (i32.const 0xFFFF))

  (func $handle_VkKeyScanA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $vk_key_scan (i32.and (local.get $arg0) (i32.const 0xFF))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; VkKeyScanExA(CHAR ch, HKL dwhkl). This runtime exposes the Win98 en-US
  ;; keyboard layout, so the explicit-layout form shares the same mapping.
  (func $handle_VkKeyScanExA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $vk_key_scan (i32.and (local.get $arg0) (i32.const 0xFF))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; LZ32's file APIs also accept ordinary, uncompressed files. Font Viewer
  ;; and old InstallShield launchers use that path, so map the handle
  ;; operations onto the VFS. SZDD decompression can be added separately if a
  ;; caller needs it.
  (func $handle_LZOpenFileA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $handle i32) (local $of_wa i32) (local $access i32) (local $creation i32)
    ;; OF_READ=0, OF_WRITE=1, OF_READWRITE=2, OF_CREATE=0x1000.
    (local.set $access (i32.const 0x80000000))
    (if (i32.eq (i32.and (local.get $arg2) (i32.const 3)) (i32.const 1))
      (then (local.set $access (i32.const 0x40000000))))
    (if (i32.eq (i32.and (local.get $arg2) (i32.const 3)) (i32.const 2))
      (then (local.set $access (i32.const 0xC0000000))))
    (local.set $creation
      (select (i32.const 2) (i32.const 3)
        (i32.ne (i32.and (local.get $arg2) (i32.const 0x1000)) (i32.const 0))))
    (local.set $handle (call $host_fs_create_file
      (call $g2w (local.get $arg0))
      (local.get $access)
      (local.get $creation)
      (i32.const 0x80)        ;; FILE_ATTRIBUTE_NORMAL
      (i32.const 0)))         ;; ANSI path
    ;; A read-only open goes through LZInit, so an SZDD file reads expanded.
    (if (i32.and (i32.ne (local.get $handle) (i32.const -1))
          (i32.eqz (i32.and (local.get $arg2) (i32.const 0x1003))))
      (then (local.set $handle (call $lz_init (local.get $handle)))))
    (if (local.get $arg1)
      (then
        (local.set $of_wa (call $g2w (local.get $arg1)))
        (i32.store8 (local.get $of_wa) (i32.const 136))
        (i32.store16 offset=2 (local.get $of_wa)
          (select (i32.const 2) (i32.const 0)
            (i32.eq (local.get $handle) (i32.const -1))))))
    (i32.store offset=0 (global.get $reg_base) (local.get $handle))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; SZDD (COMPRESS.EXE) streams. LZInit expands a compressed file whole into
  ;; a guest heap buffer and answers an LZ handle, 0x400 + slot as in LZ32, so
  ;; LZRead/LZSeek/LZClose can tell it from a file handle. Slot records are
  ;; 16 bytes in a lazily allocated guest table: source file handle, buffer,
  ;; expanded size, read position. Daytona USA Deluxe ships 72 of its
  ;; Resource\ files this way and reads them all through LZInit/LZRead.
  (global $LZ_MAX_STATES i32 (i32.const 16))
  (global $LZ_MIN_HANDLE i32 (i32.const 0x400))
  (global $lz_states_g (mut i32) (i32.const 0))

  ;; Guest address of the live slot record for LZ handle $h, or 0.
  (func $lz_state (param $h i32) (result i32)
    (local $slot i32) (local $rec i32)
    (if (i32.eqz (global.get $lz_states_g)) (then (return (i32.const 0))))
    (local.set $slot (i32.sub (local.get $h) (global.get $LZ_MIN_HANDLE)))
    (if (i32.ge_u (local.get $slot) (global.get $LZ_MAX_STATES))
      (then (return (i32.const 0))))
    (local.set $rec (i32.add (global.get $lz_states_g)
      (i32.shl (local.get $slot) (i32.const 4))))
    (if (i32.eqz (call $gl32 (i32.add (local.get $rec) (i32.const 4))))
      (then (return (i32.const 0))))
    (local.get $rec))

  ;; Expand SZDD LZSS data: a 4 KB ring prefilled with spaces and written
  ;; from 4096-16. Each control byte's bits, low first, select a literal (1)
  ;; or a 2-byte back reference (0): 12-bit ring offset, 4-bit length - 3.
  ;; Returns the number of bytes written to $out (at most $out_size).
  (func $lz_expand_szdd
        (param $src i32) (param $src_len i32) (param $out i32) (param $out_size i32)
        (param $ring i32) (result i32)
    (local $in i32) (local $n i32) (local $pos i32) (local $ctl i32)
    (local $bit i32) (local $b i32) (local $b2 i32) (local $off i32)
    (local $len i32) (local $k i32)
    (block $fill_done (loop $fill
      (br_if $fill_done (i32.ge_u (local.get $k) (i32.const 4096)))
      (call $gs8 (i32.add (local.get $ring) (local.get $k)) (i32.const 0x20))
      (local.set $k (i32.add (local.get $k) (i32.const 1)))
      (br $fill)))
    (local.set $pos (i32.const 4080))
    (block $done (loop $blocks
      (br_if $done (i32.ge_u (local.get $in) (local.get $src_len)))
      (br_if $done (i32.ge_u (local.get $n) (local.get $out_size)))
      (local.set $ctl (call $gl8 (i32.add (local.get $src) (local.get $in))))
      (local.set $in (i32.add (local.get $in) (i32.const 1)))
      (local.set $bit (i32.const 0))
      (block $bits_done (loop $bits
        (br_if $bits_done (i32.ge_u (local.get $bit) (i32.const 8)))
        (br_if $done (i32.ge_u (local.get $in) (local.get $src_len)))
        (br_if $done (i32.ge_u (local.get $n) (local.get $out_size)))
        (if (i32.and (local.get $ctl) (i32.shl (i32.const 1) (local.get $bit)))
          (then
            (local.set $b (call $gl8 (i32.add (local.get $src) (local.get $in))))
            (local.set $in (i32.add (local.get $in) (i32.const 1)))
            (call $gs8 (i32.add (local.get $out) (local.get $n)) (local.get $b))
            (local.set $n (i32.add (local.get $n) (i32.const 1)))
            (call $gs8 (i32.add (local.get $ring) (local.get $pos)) (local.get $b))
            (local.set $pos (i32.and (i32.add (local.get $pos) (i32.const 1)) (i32.const 0xFFF))))
          (else
            (br_if $done (i32.ge_u (i32.add (local.get $in) (i32.const 1)) (local.get $src_len)))
            (local.set $b (call $gl8 (i32.add (local.get $src) (local.get $in))))
            (local.set $b2 (call $gl8 (i32.add (local.get $src) (i32.add (local.get $in) (i32.const 1)))))
            (local.set $in (i32.add (local.get $in) (i32.const 2)))
            (local.set $off (i32.or (local.get $b)
              (i32.shl (i32.and (local.get $b2) (i32.const 0xF0)) (i32.const 4))))
            (local.set $len (i32.add (i32.and (local.get $b2) (i32.const 0x0F)) (i32.const 3)))
            (local.set $k (i32.const 0))
            (block $copy_done (loop $copy
              (br_if $copy_done (i32.ge_u (local.get $k) (local.get $len)))
              (br_if $done (i32.ge_u (local.get $n) (local.get $out_size)))
              (local.set $b (call $gl8 (i32.add (local.get $ring)
                (i32.and (i32.add (local.get $off) (local.get $k)) (i32.const 0xFFF)))))
              (call $gs8 (i32.add (local.get $out) (local.get $n)) (local.get $b))
              (local.set $n (i32.add (local.get $n) (i32.const 1)))
              (call $gs8 (i32.add (local.get $ring) (local.get $pos)) (local.get $b))
              (local.set $pos (i32.and (i32.add (local.get $pos) (i32.const 1)) (i32.const 0xFFF)))
              (local.set $k (i32.add (local.get $k) (i32.const 1)))
              (br $copy)))))
        (local.set $bit (i32.add (local.get $bit) (i32.const 1)))
        (br $bits)))
      (br $blocks)))
    (local.get $n))

  ;; LZInit's body: $hf itself for an ordinary file (rewound), an LZ handle
  ;; for an SZDD file, or a negative LZERROR_* code.
  (func $lz_init (param $hf i32) (result i32)
    (local $hdr i32) (local $nread i32) (local $file_size i32) (local $comp i32)
    (local $comp_len i32) (local $out_size i32) (local $out i32) (local $ring i32)
    (local $slot i32) (local $rec i32) (local $got i32)
    (if (i32.eq (local.get $hf) (i32.const -1)) (then (return (i32.const -1)))) ;; LZERROR_BADINHANDLE
    (local.set $hdr (call $heap_alloc (i32.const 20)))
    (if (i32.eqz (local.get $hdr)) (then (return (i32.const -5))))            ;; LZERROR_GLOBALLOC
    (local.set $nread (i32.add (local.get $hdr) (i32.const 16)))
    (drop (call $host_fs_set_file_pointer (local.get $hf) (i32.const 0) (i32.const 0)))
    (call $gs32 (local.get $nread) (i32.const 0))
    (drop (call $host_fs_read_file (local.get $hf) (local.get $hdr) (i32.const 14) (local.get $nread)))
    (if (i32.or
          (i32.ne (call $gl32 (local.get $nread)) (i32.const 14))
          (i32.or
            (i32.ne (call $gl32 (local.get $hdr)) (i32.const 0x44445A53))   ;; "SZDD"
            (i32.ne (call $gl32 (i32.add (local.get $hdr) (i32.const 4))) (i32.const 0x3327F088))))
      (then
        (call $heap_free (local.get $hdr))
        (drop (call $host_fs_set_file_pointer (local.get $hf) (i32.const 0) (i32.const 0)))
        (return (local.get $hf))))
    (local.set $out_size (call $gl32 (i32.add (local.get $hdr) (i32.const 10))))
    (call $heap_free (local.get $hdr))
    ;; Find a free slot before allocating the buffers.
    (if (i32.eqz (global.get $lz_states_g))
      (then
        (global.set $lz_states_g (call $heap_alloc
          (i32.shl (global.get $LZ_MAX_STATES) (i32.const 4))))
        (if (i32.eqz (global.get $lz_states_g)) (then (return (i32.const -5))))
        (call $zero_memory (call $g2w (global.get $lz_states_g))
          (i32.shl (global.get $LZ_MAX_STATES) (i32.const 4)))))
    (local.set $slot (i32.const 0))
    (block $found (loop $scan
      (if (i32.ge_u (local.get $slot) (global.get $LZ_MAX_STATES))
        (then (return (i32.const -5))))
      (local.set $rec (i32.add (global.get $lz_states_g)
        (i32.shl (local.get $slot) (i32.const 4))))
      (br_if $found (i32.eqz (call $gl32 (i32.add (local.get $rec) (i32.const 4)))))
      (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
      (br $scan)))
    (local.set $file_size
      (call $host_fs_set_file_pointer (local.get $hf) (i32.const 0) (i32.const 2)))
    (local.set $comp_len (i32.sub (local.get $file_size) (i32.const 14)))
    (if (i32.lt_s (local.get $comp_len) (i32.const 0)) (then (return (i32.const -3)))) ;; LZERROR_READ
    (local.set $comp (call $heap_alloc (i32.add (local.get $comp_len) (i32.const 4))))
    (local.set $ring (call $heap_alloc (i32.const 4096)))
    (local.set $out (call $heap_alloc (select (local.get $out_size) (i32.const 1)
      (i32.ne (local.get $out_size) (i32.const 0)))))
    (if (i32.or (i32.eqz (local.get $comp))
          (i32.or (i32.eqz (local.get $ring)) (i32.eqz (local.get $out))))
      (then
        (if (local.get $comp) (then (call $heap_free (local.get $comp))))
        (if (local.get $ring) (then (call $heap_free (local.get $ring))))
        (if (local.get $out) (then (call $heap_free (local.get $out))))
        (return (i32.const -5))))
    (drop (call $host_fs_set_file_pointer (local.get $hf) (i32.const 14) (i32.const 0)))
    (call $gs32 (i32.add (local.get $comp) (local.get $comp_len)) (i32.const 0))
    (if (i32.eqz (call $host_fs_read_file (local.get $hf) (local.get $comp)
          (local.get $comp_len) (i32.add (local.get $comp) (local.get $comp_len))))
      (then
        (call $heap_free (local.get $comp))
        (call $heap_free (local.get $ring))
        (call $heap_free (local.get $out))
        (return (i32.const -3))))
    (local.set $got (call $gl32 (i32.add (local.get $comp) (local.get $comp_len))))
    (drop (call $lz_expand_szdd (local.get $comp) (local.get $got)
      (local.get $out) (local.get $out_size) (local.get $ring)))
    (call $heap_free (local.get $comp))
    (call $heap_free (local.get $ring))
    (call $gs32 (local.get $rec) (local.get $hf))
    (call $gs32 (i32.add (local.get $rec) (i32.const 4)) (local.get $out))
    (call $gs32 (i32.add (local.get $rec) (i32.const 8)) (local.get $out_size))
    (call $gs32 (i32.add (local.get $rec) (i32.const 12)) (i32.const 0))
    (i32.add (global.get $LZ_MIN_HANDLE) (local.get $slot)))

  ;; LZInit(hfSource)
  (func $handle_LZInit (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $lz_init (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_LZRead (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $bytes_ga i32) (local $bytes_wa i32)
    (local $rec i32) (local $pos i32) (local $n i32) (local $buf i32) (local $i i32)
    (local.set $rec (call $lz_state (local.get $arg0)))
    (if (local.get $rec)
      (then
        (local.set $buf (call $gl32 (i32.add (local.get $rec) (i32.const 4))))
        (local.set $pos (call $gl32 (i32.add (local.get $rec) (i32.const 12))))
        (local.set $n (i32.sub (call $gl32 (i32.add (local.get $rec) (i32.const 8))) (local.get $pos)))
        (if (i32.lt_s (local.get $arg2) (i32.const 0))
          (then (local.set $n (i32.const -7)))                                ;; LZERROR_BADVALUE
          (else
            (if (i32.lt_u (local.get $arg2) (local.get $n)) (then (local.set $n (local.get $arg2))))
            (block $done (loop $copy
              (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
              (call $gs8 (i32.add (local.get $arg1) (local.get $i))
                (call $gl8 (i32.add (local.get $buf) (i32.add (local.get $pos) (local.get $i)))))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $copy)))
            (call $gs32 (i32.add (local.get $rec) (i32.const 12))
              (i32.add (local.get $pos) (local.get $n)))))
        (i32.store offset=0 (global.get $reg_base) (local.get $n))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (local.set $bytes_ga (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (local.set $bytes_wa (call $g2w (local.get $bytes_ga)))
    (i32.store (local.get $bytes_wa) (i32.const 0))
    (if (call $host_fs_read_file
          (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $bytes_ga))
      (then (i32.store offset=0 (global.get $reg_base) (i32.load (local.get $bytes_wa))))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const -1))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  (func $handle_LZSeek (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $rec i32) (local $base i32) (local $new i32)
    (local.set $rec (call $lz_state (local.get $arg0)))
    (if (local.get $rec)
      (then
        (local.set $base
          (if (result i32) (i32.eq (local.get $arg2) (i32.const 1))
            (then (call $gl32 (i32.add (local.get $rec) (i32.const 12))))
            (else (if (result i32) (i32.eq (local.get $arg2) (i32.const 2))
              (then (call $gl32 (i32.add (local.get $rec) (i32.const 8))))
              (else (i32.const 0))))))
        (local.set $new (i32.add (local.get $base) (local.get $arg1)))
        (if (i32.or (i32.gt_u (local.get $arg2) (i32.const 2))
              (i32.or (i32.lt_s (local.get $new) (i32.const 0))
                (i32.gt_s (local.get $new) (call $gl32 (i32.add (local.get $rec) (i32.const 8))))))
          (then (local.set $new (i32.const -7)))                              ;; LZERROR_BADVALUE
          (else (call $gs32 (i32.add (local.get $rec) (i32.const 12)) (local.get $new))))
        (i32.store offset=0 (global.get $reg_base) (local.get $new))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (i32.store offset=0 (global.get $reg_base) (call $legacy_file_seek
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (i32.const -7)))       ;; LZERROR_BADVALUE
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; LZCopy(hfSource, hfDest) copies the remaining expanded stream and returns
  ;; its byte count. For an ordinary input file LZ32 defines this as a direct
  ;; copy; that is the path used by InstallShield 5's self-extracting loader.
  (func $handle_LZCopy (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $buffer_ga i32) (local $count_ga i32) (local $count_wa i32)
    (local $count i32) (local $total i32)
    (local.set $count_ga (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 0x1004)))
    (local.set $buffer_ga (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 0x1000)))
    (local.set $count_wa (call $g2w (local.get $count_ga)))
    (block $done
      (loop $copy
        (i32.store (local.get $count_wa) (i32.const 0))
        (if (i32.eqz (call $host_fs_read_file
              (local.get $arg0) (local.get $buffer_ga) (i32.const 0x1000)
              (local.get $count_ga)))
          (then
            (i32.store offset=0 (global.get $reg_base) (i32.const -3)) ;; LZERROR_READ
            (br $done)))
        (local.set $count (i32.load (local.get $count_wa)))
        (if (i32.eqz (local.get $count))
          (then
            (i32.store offset=0 (global.get $reg_base) (local.get $total))
            (br $done)))
        (i32.store (local.get $count_wa) (i32.const 0))
        (if (i32.eqz (call $host_fs_write_file
              (local.get $arg1) (local.get $buffer_ga) (local.get $count)
              (local.get $count_ga)))
          (then
            (i32.store offset=0 (global.get $reg_base) (i32.const -4)) ;; LZERROR_WRITE
            (br $done)))
        (if (i32.ne (i32.load (local.get $count_wa)) (local.get $count))
          (then
            (i32.store offset=0 (global.get $reg_base) (i32.const -4))
            (br $done)))
        (local.set $total (i32.add (local.get $total) (local.get $count)))
        (br $copy)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  (func $handle_LZClose (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $rec i32)
    (local.set $rec (call $lz_state (local.get $arg0)))
    (if (local.get $rec)
      (then
        (drop (call $host_fs_close_handle (call $gl32 (local.get $rec))))
        (call $heap_free (call $gl32 (i32.add (local.get $rec) (i32.const 4))))
        (call $gs32 (local.get $rec) (i32.const 0))
        (call $gs32 (i32.add (local.get $rec) (i32.const 4)) (i32.const 0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (drop (call $host_fs_close_handle (local.get $arg0)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 4093: _hwrite — the LONG-count spelling of _lwrite (Myth demo's VISE installer).
  (func $handle__hwrite (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.lt_s (local.get $arg2) (i32.const 0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (call $handle__lwrite
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; 938: _hread — the LONG-count spelling of _lread.
  (func $handle__hread (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.lt_s (local.get $arg2) (i32.const 0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (call $handle__lread
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; 25: Sleep — STUB: unimplemented
  (func $handle_Sleep (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; Sleep(dwMilliseconds) — 1 arg stdcall.
    ;; Always yield so other threads get execution time.
    ;; Sleep(0) only sets yield_flag (not sleep_yielded) — it won't deprioritize.
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
    (global.set $yield_flag (i32.const 1))
    (if (local.get $arg0)
      (then
        (global.set $sleep_yielded (i32.const 1))
        (global.set $sleep_timeout (local.get $arg0))))
  )

  ;; SleepEx dispatches completed I/O only on its submitting thread and only
  ;; when alertable. Otherwise it uses the ordinary cooperative sleep path.
  (func $handle_SleepEx (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret i32)
    (if (local.get $arg1) (then
      (if (call $io_apc_start (i32.const 12)) (then (return)))))
    (local.set $ret (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
    (global.set $yield_flag (i32.const 1))
    (if (local.get $arg0)
      (then
        (global.set $sleep_yielded (i32.const 1))
        (global.set $sleep_timeout (local.get $arg0))
        ;; An alertable sleep that parks: an APC queued to this thread before
        ;; it resumes is run at the resumption ($apc_resume_alert_sleep), and
        ;; QueueUserAPC's thread_alert cuts the sleep short.
        (if (local.get $arg1)
          (then
            (global.set $apc_alert_sleep (i32.const 1))
            (global.set $apc_alert_ret (local.get $ret))
            (global.set $apc_alert_esp (i32.load offset=16 (global.get $reg_base)))))))
  )

  ;; A token handle close has to run before the generic host-file fallback:
  ;; token handles are WAT-owned and a stale generation is an invalid handle,
  ;; not a request to close a coincidentally numbered host file.
  ;;
  ;; Return -1 when the value is outside the token namespace, 0 for a stale or
  ;; forged token handle, and 1 after atomically claiming and releasing it.
  (func $token_close_handle (param $handle i32) (result i32)
    (local $rec i32)
    (if (i32.ne
          (i32.and (local.get $handle) (i32.const 0xff000000))
          (i32.const 0xfa000000))
      (then (return (i32.const -1))))
    (local.set $rec (call $token_record_from_handle (local.get $handle)))
    (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
    (if (i32.ne
          (i32.atomic.rmw.cmpxchg (local.get $rec)
            (local.get $handle) (i32.const -1))
          (local.get $handle))
      (then (return (i32.const 0))))
    (i32.atomic.store offset=8 (local.get $rec) (i32.const 0))
    (i32.atomic.store offset=12 (local.get $rec) (i32.const 0))
    (i32.atomic.store (local.get $rec) (i32.const 0))
    (i32.const 1))

  ;; 26: CloseHandle(hObject) — 1 arg stdcall
  (func $handle_CloseHandle (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $console_result i32)
    (local.set $console_result (call $toolhelp_close (local.get $arg0)))
    (if (i32.ge_s (local.get $console_result) (i32.const 0)) (then
      (call $toolhelp_return (local.get $console_result) (i32.const 1)) (return)))
    (if (i32.eq (local.get $arg0) (global.get $QUARTZ_VXD_HANDLE))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (local.set $console_result (call $pipe_close (local.get $arg0)))
    (if (i32.ge_s (local.get $console_result) (i32.const 0))
      (then
        (i32.store offset=0 (global.get $reg_base) (local.get $console_result))
        (if (i32.eqz (local.get $console_result))
          (then (global.set $last_error (i32.const 6)))) ;; ERROR_INVALID_HANDLE
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (local.set $console_result (call $token_close_handle (local.get $arg0)))
    (if (i32.ge_s (local.get $console_result) (i32.const 0))
      (then
        (i32.store offset=0 (global.get $reg_base) (local.get $console_result))
        (if (i32.eqz (local.get $console_result))
          (then (global.set $last_error (i32.const 6)))) ;; ERROR_INVALID_HANDLE
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (local.set $console_result (call $console_handle_close (local.get $arg0)))
    (if (i32.ge_s (local.get $console_result) (i32.const 0))
      (then
        (i32.store offset=0 (global.get $reg_base) (local.get $console_result))
        (if (i32.eqz (local.get $console_result))
          (then (global.set $last_error (i32.const 6)))) ;; ERROR_INVALID_HANDLE
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (local.set $console_result (call $console_buffer_close (local.get $arg0)))
    (if (i32.ge_s (local.get $console_result) (i32.const 0))
      (then
        (i32.store offset=0 (global.get $reg_base) (local.get $console_result))
        (if (i32.eqz (local.get $console_result))
          (then (global.set $last_error (i32.const 6)))) ;; ERROR_INVALID_HANDLE
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (if (call $iocp_close (local.get $arg0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    ;; A file may be bound to a completion port; the binding outlives neither
    ;; the file nor the port, and a stale one would send a later request's
    ;; completion to a handle the guest has already reused.
    (call $iocp_assoc_drop (local.get $arg0))
    (i32.store offset=0 (global.get $reg_base) (call $host_fs_close_handle (local.get $arg0)))
    (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
      (then (global.set $last_error (i32.const 6)))) ;; ERROR_INVALID_HANDLE
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; OpenThreadToken(ThreadHandle, DesiredAccess, OpenAsSelf, TokenHandle).
  ;; The emulated process never impersonates, so its threads have no token of
  ;; their own. NT callers use ERROR_NO_TOKEN to fall back to the process token.
  (func $handle_OpenThreadToken (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg3) (then (call $gs32 (local.get $arg3) (i32.const 0))))
    (global.set $last_error (i32.const 1008)) ;; ERROR_NO_TOKEN
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; SetThreadToken(Thread, Token). A NULL token ends impersonation, which for
  ;; threads that never have a token (see OpenThreadToken) is already the
  ;; state: success. Installing a token would need real impersonation, so that
  ;; fails the way Win9x's ADVAPI32 fails every call. msi.dll drops its
  ;; impersonation this way around each registry probe.
  (func $handle_SetThreadToken (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg1)
      (then
        (global.set $last_error (i32.const 120)) ;; ERROR_CALL_NOT_IMPLEMENTED
        (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 1))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; Shared access-token state.  TOKEN_OBJECTS begins with an initialization
  ;; word and the process-wide enabled mask.  Thirty-two 16-byte handle records
  ;; follow at +0x10: exact generation-tagged handle, generation counter,
  ;; granted access and a retained enabled-mask mirror.  Names start at +0x220.
  ;; The declaration gate requires the traditional base/size pair even though
  ;; consumers below use region.addr directly so their offsets are checked.
  (global $TOKEN_OBJECTS i32 (region.addr $TOKEN_OBJECTS 0))
  (global $TOKEN_OBJECTS_SIZE i32 (region.size $TOKEN_OBJECTS))
  (global $TOKEN_OBJECT_COUNT i32 (i32.const 32))
  (global $TOKEN_OBJECT_STRIDE i32 (i32.const 16))

  (data (region.addr $TOKEN_OBJECTS 0x220)
    "SeCreateTokenPrivilege\00SeAssignPrimaryTokenPrivilege\00"
    "SeLockMemoryPrivilege\00SeIncreaseQuotaPrivilege\00"
    "SeMachineAccountPrivilege\00SeTcbPrivilege\00SeSecurityPrivilege\00"
    "SeTakeOwnershipPrivilege\00SeLoadDriverPrivilege\00"
    "SeSystemProfilePrivilege\00SeSystemtimePrivilege\00"
    "SeProfileSingleProcessPrivilege\00SeIncreaseBasePriorityPrivilege\00"
    "SeCreatePagefilePrivilege\00SeCreatePermanentPrivilege\00"
    "SeBackupPrivilege\00SeRestorePrivilege\00SeShutdownPrivilege\00"
    "SeDebugPrivilege\00SeAuditPrivilege\00SeSystemEnvironmentPrivilege\00"
    "SeChangeNotifyPrivilege\00SeRemoteShutdownPrivilege\00"
    "SeUndockPrivilege\00SeSyncAgentPrivilege\00"
    "SeEnableDelegationPrivilege\00SeManageVolumePrivilege\00")

  (func $token_record_addr (param $slot i32) (result i32)
    (i32.add (region.addr $TOKEN_OBJECTS 0x10)
      (i32.shl (local.get $slot) (i32.const 4))))

  (func $token_record_from_handle (param $handle i32) (result i32)
    (local $slot i32) (local $rec i32)
    (if (i32.ne
          (i32.and (local.get $handle) (i32.const 0xff000000))
          (i32.const 0xfa000000))
      (then (return (i32.const 0))))
    (local.set $slot (i32.and (local.get $handle) (i32.const 31)))
    (local.set $rec (call $token_record_addr (local.get $slot)))
    (if (i32.ne (i32.atomic.load (local.get $rec)) (local.get $handle))
      (then (return (i32.const 0))))
    (local.get $rec))

  (func $token_handle_value (param $slot i32) (param $generation i32) (result i32)
    ;; 0xFA is disjoint from VFS's 0x70..0x7F handles, its 0xF0000001
    ;; sentinel, and file mappings' 0xFB namespace.
    (i32.or (i32.const 0xfa000000)
      (i32.or
        ;; Bits 5..23 are the generation; the fixed top byte is never touched.
        (i32.shl
          (i32.and (local.get $generation) (i32.const 0x0007ffff))
          (i32.const 5))
        (i32.and (local.get $slot) (i32.const 31)))))

  ;; Initialize the process token exactly once even when a Worker instance is
  ;; being brought up concurrently.  SeChangeNotifyPrivilege is the one
  ;; classic privilege documented as enabled by default for every user.
  (func $token_process_enabled (result i32)
    (local $state i32)
    (local.set $state (i32.atomic.load (region.addr $TOKEN_OBJECTS 0)))
    (if (i32.eqz (local.get $state))
      (then
        (if (i32.eqz
              (i32.atomic.rmw.cmpxchg (region.addr $TOKEN_OBJECTS 0)
                (i32.const 0) (i32.const 1)))
          (then
            (i32.atomic.store (region.addr $TOKEN_OBJECTS 4)
              (i32.const 0x00800000))
            (i32.atomic.store (region.addr $TOKEN_OBJECTS 0) (i32.const 2))))))
    ;; A competing initializer owns state 1 only for the two stores above.
    (block $ready
      (loop $wait
        (br_if $ready
          (i32.eq (i32.atomic.load (region.addr $TOKEN_OBJECTS 0))
            (i32.const 2)))
        (br $wait)))
    (i32.atomic.load (region.addr $TOKEN_OBJECTS 4)))

  (func $token_allocate_handle (param $access i32) (result i32)
    (local $slot i32) (local $rec i32) (local $generation i32)
    (local $handle i32) (local $enabled i32)
    (local.set $enabled (call $token_process_enabled))
    (block $full
      (loop $scan
        (br_if $full (i32.ge_u (local.get $slot) (global.get $TOKEN_OBJECT_COUNT)))
        (local.set $rec (call $token_record_addr (local.get $slot)))
        (if (i32.eqz
              (i32.atomic.rmw.cmpxchg (local.get $rec)
                (i32.const 0) (i32.const -1)))
          (then
            (local.set $generation
              (i32.and
                (i32.add
                  (i32.atomic.rmw.add offset=4 (local.get $rec) (i32.const 1))
                  (i32.const 1))
                (i32.const 0x0007ffff)))
            (if (i32.eqz (local.get $generation))
              (then (local.set $generation (i32.const 1))))
            ;; Normalize after wrap so stale generations are not retained in
            ;; the counter even though only the masked value enters a handle.
            (i32.atomic.store offset=4 (local.get $rec) (local.get $generation))
            (local.set $handle
              (call $token_handle_value (local.get $slot) (local.get $generation)))
            (i32.atomic.store offset=8 (local.get $rec) (local.get $access))
            (i32.atomic.store offset=12 (local.get $rec) (local.get $enabled))
            (i32.atomic.store (local.get $rec) (local.get $handle))
            (return (local.get $handle))))
        (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
        (br $scan)))
    (i32.const 0))

  (func $token_publish_enabled (param $enabled i32)
    (local $slot i32) (local $rec i32) (local $handle i32)
    (i32.atomic.store (region.addr $TOKEN_OBJECTS 4) (local.get $enabled))
    (block $done
      (loop $scan
        (br_if $done (i32.ge_u (local.get $slot) (global.get $TOKEN_OBJECT_COUNT)))
        (local.set $rec (call $token_record_addr (local.get $slot)))
        (local.set $handle (i32.atomic.load (local.get $rec)))
        (if (i32.and
              (i32.ne (local.get $handle) (i32.const 0))
              (i32.ne (local.get $handle) (i32.const -1)))
          (then (i32.atomic.store offset=12 (local.get $rec) (local.get $enabled))))
        (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
        (br $scan))))

  ;; Win32 leaves the low 64KB unmapped so NULL-adjacent pointers fault rather
  ;; than aliasing image storage.  The generic affine translator deliberately
  ;; models mappings rather than that user-pointer policy, so token APIs add
  ;; the low-page guard before reusing the bounded security span proof.
  (func $token_guest_span_valid (param $ptr i32) (param $size i32) (result i32)
    (i32.and
      (i32.ge_u (local.get $ptr) (i32.const 0x00010000))
      (call $security_span_valid (local.get $ptr) (local.get $size))))

  (func $token_guest_string_valid (param $ptr i32) (result i32)
    (local $i i32)
    (if (i32.eqz (local.get $ptr)) (then (return (i32.const 0))))
    (block $too_long
      (loop $scan
        (br_if $too_long (i32.ge_u (local.get $i) (i32.const 64)))
        (if (i32.eqz
              (call $token_guest_span_valid
                (i32.add (local.get $ptr) (local.get $i)) (i32.const 1)))
          (then (return (i32.const 0))))
        (if (i32.eqz (call $gl8 (i32.add (local.get $ptr) (local.get $i))))
          (then (return (i32.const 1))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $scan)))
    (i32.const 0))

  (func $token_name_equal (param $name i32) (param $known_wa i32) (result i32)
    (local $i i32) (local $a i32) (local $b i32)
    (block $different
      (loop $compare
        (br_if $different (i32.ge_u (local.get $i) (i32.const 64)))
        (local.set $a (call $gl8 (i32.add (local.get $name) (local.get $i))))
        (local.set $b (i32.load8_u (i32.add (local.get $known_wa) (local.get $i))))
        (br_if $different
          (i32.ne (call $tolower (local.get $a)) (call $tolower (local.get $b))))
        (if (i32.eqz (local.get $a)) (then (return (i32.const 1))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $compare)))
    (i32.const 0))

  ;; Return the stable classic privilege LUID low part, or -1 for an unknown
  ;; name.  These are the well-known NT privilege identifiers exposed to old
  ;; Win32 applications; every high part is zero.
  (func $token_luid_from_name (param $name i32) (result i32)
    (if (call $token_name_equal (local.get $name) (region.addr $TOKEN_OBJECTS 0x220)) (then (return (i32.const 2))))
    (if (call $token_name_equal (local.get $name) (region.addr $TOKEN_OBJECTS 0x237)) (then (return (i32.const 3))))
    (if (call $token_name_equal (local.get $name) (region.addr $TOKEN_OBJECTS 0x255)) (then (return (i32.const 4))))
    (if (call $token_name_equal (local.get $name) (region.addr $TOKEN_OBJECTS 0x26b)) (then (return (i32.const 5))))
    (if (call $token_name_equal (local.get $name) (region.addr $TOKEN_OBJECTS 0x284)) (then (return (i32.const 6))))
    (if (call $token_name_equal (local.get $name) (region.addr $TOKEN_OBJECTS 0x29e)) (then (return (i32.const 7))))
    (if (call $token_name_equal (local.get $name) (region.addr $TOKEN_OBJECTS 0x2ad)) (then (return (i32.const 8))))
    (if (call $token_name_equal (local.get $name) (region.addr $TOKEN_OBJECTS 0x2c1)) (then (return (i32.const 9))))
    (if (call $token_name_equal (local.get $name) (region.addr $TOKEN_OBJECTS 0x2da)) (then (return (i32.const 10))))
    (if (call $token_name_equal (local.get $name) (region.addr $TOKEN_OBJECTS 0x2f0)) (then (return (i32.const 11))))
    (if (call $token_name_equal (local.get $name) (region.addr $TOKEN_OBJECTS 0x309)) (then (return (i32.const 12))))
    (if (call $token_name_equal (local.get $name) (region.addr $TOKEN_OBJECTS 0x31f)) (then (return (i32.const 13))))
    (if (call $token_name_equal (local.get $name) (region.addr $TOKEN_OBJECTS 0x33f)) (then (return (i32.const 14))))
    (if (call $token_name_equal (local.get $name) (region.addr $TOKEN_OBJECTS 0x35f)) (then (return (i32.const 15))))
    (if (call $token_name_equal (local.get $name) (region.addr $TOKEN_OBJECTS 0x379)) (then (return (i32.const 16))))
    (if (call $token_name_equal (local.get $name) (region.addr $TOKEN_OBJECTS 0x394)) (then (return (i32.const 17))))
    (if (call $token_name_equal (local.get $name) (region.addr $TOKEN_OBJECTS 0x3a6)) (then (return (i32.const 18))))
    (if (call $token_name_equal (local.get $name) (region.addr $TOKEN_OBJECTS 0x3b9)) (then (return (i32.const 19))))
    (if (call $token_name_equal (local.get $name) (region.addr $TOKEN_OBJECTS 0x3cd)) (then (return (i32.const 20))))
    (if (call $token_name_equal (local.get $name) (region.addr $TOKEN_OBJECTS 0x3de)) (then (return (i32.const 21))))
    (if (call $token_name_equal (local.get $name) (region.addr $TOKEN_OBJECTS 0x3ef)) (then (return (i32.const 22))))
    (if (call $token_name_equal (local.get $name) (region.addr $TOKEN_OBJECTS 0x40c)) (then (return (i32.const 23))))
    (if (call $token_name_equal (local.get $name) (region.addr $TOKEN_OBJECTS 0x424)) (then (return (i32.const 24))))
    (if (call $token_name_equal (local.get $name) (region.addr $TOKEN_OBJECTS 0x43e)) (then (return (i32.const 25))))
    (if (call $token_name_equal (local.get $name) (region.addr $TOKEN_OBJECTS 0x450)) (then (return (i32.const 26))))
    (if (call $token_name_equal (local.get $name) (region.addr $TOKEN_OBJECTS 0x465)) (then (return (i32.const 27))))
    (if (call $token_name_equal (local.get $name) (region.addr $TOKEN_OBJECTS 0x481)) (then (return (i32.const 28))))
    (i32.const -1))

  ;; LookupPrivilegeValueA(lpSystemName, lpName, lpLuid).
  (func $handle_LookupPrivilegeValueA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $luid i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    (if (i32.or
          (i32.eqz (call $token_guest_string_valid (local.get $arg1)))
          (i32.eqz (call $token_guest_span_valid (local.get $arg2) (i32.const 8))))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (if (local.get $arg0)
      (then
        (if (i32.eqz (call $token_guest_string_valid (local.get $arg0)))
          (then
            (global.set $last_error (i32.const 87))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (return)))
        (if (call $gl8 (local.get $arg0))
          (then
            (global.set $last_error (i32.const 53)) ;; ERROR_BAD_NETPATH
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (return)))))
    (local.set $luid (call $token_luid_from_name (local.get $arg1)))
    (if (i32.lt_s (local.get $luid) (i32.const 0))
      (then
        (global.set $last_error (i32.const 1313)) ;; ERROR_NO_SUCH_PRIVILEGE
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (call $gs32 (local.get $arg2) (local.get $luid))
    (call $gs32 (i32.add (local.get $arg2) (i32.const 4)) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1)))

  ;; OpenProcessToken(ProcessHandle, DesiredAccess, TokenHandle).  The browser
  ;; hosts one elevated process token.  Each open gets a distinct closeable
  ;; handle whose access bits are enforced by token APIs.
  (func $handle_OpenProcessToken (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $access i32) (local $handle i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    (if (i32.eqz (call $token_guest_span_valid (local.get $arg2) (i32.const 4)))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (if (i32.eqz (call $current_process_handle_valid (local.get $arg0)))
      (then
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (local.set $access (i32.and (local.get $arg1) (i32.const 0x28)))
    ;; MAXIMUM_ALLOWED and generic access are mapped only to rights this token
    ;; model implements; unrelated requested token rights remain harmless.
    (if (i32.ne (i32.and (local.get $arg1) (i32.const 0x02000000)) (i32.const 0))
      (then (local.set $access (i32.const 0x28))))
    (if (i32.ne (i32.and (local.get $arg1) (i32.const 0x80000000)) (i32.const 0))
      (then (local.set $access (i32.or (local.get $access) (i32.const 8)))))
    (if (i32.ne (i32.and (local.get $arg1) (i32.const 0x50000000)) (i32.const 0))
      (then (local.set $access (i32.or (local.get $access) (i32.const 0x28)))))
    (local.set $handle (call $token_allocate_handle (local.get $access)))
    (if (i32.eqz (local.get $handle))
      (then
        (global.set $last_error (i32.const 8)) ;; ERROR_NOT_ENOUGH_MEMORY
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (call $gs32 (local.get $arg2) (local.get $handle))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
  )

  ;; GetTokenInformation(TokenHandle, TokenInformationClass, TokenInformation,
  ;; TokenInformationLength, ReturnLength). TokenGroups (class 2) is enough
  ;; for setup/admin probes. Report one enabled S-1-5-32-544 (BUILTIN\Admins)
  ;; group, which matches the process model used to run installers directly.
  (func $handle_GetTokenInformation (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $rec i32) (local $needed i32) (local $i i32)
    (local $out i32) (local $enabled i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
    (local.set $rec (call $token_record_from_handle (local.get $arg0)))
    (if (i32.eqz (local.get $rec))
      (then
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (if (i32.eqz (i32.and (i32.atomic.load offset=8 (local.get $rec)) (i32.const 8)))
      (then
        (global.set $last_error (i32.const 5)) ;; ERROR_ACCESS_DENIED
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (if (i32.eq (local.get $arg1) (i32.const 2))
      (then (local.set $needed (i32.const 28)))
      (else
        (if (i32.eq (local.get $arg1) (i32.const 3))
          (then (local.set $needed (i32.const 328)))
          (else
            (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (return)))))
    (if (i32.eqz (call $token_guest_span_valid (local.get $arg4) (i32.const 4)))
      (then
        (global.set $last_error (i32.const 87))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (call $gs32 (local.get $arg4) (local.get $needed))
    (if (i32.or (i32.eqz (local.get $arg2))
                (i32.lt_u (local.get $arg3) (local.get $needed)))
      (then
        (global.set $last_error (i32.const 122)) ;; ERROR_INSUFFICIENT_BUFFER
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (if (i32.eqz (call $token_guest_span_valid (local.get $arg2) (local.get $needed)))
      (then
        (global.set $last_error (i32.const 87))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (if (i32.eq (local.get $arg1) (i32.const 2))
      (then
        (call $gs32 (local.get $arg2) (i32.const 1)) ;; TOKEN_GROUPS.GroupCount
        (call $gs32 (i32.add (local.get $arg2) (i32.const 4))
          (i32.add (local.get $arg2) (i32.const 12))) ;; SID_AND_ATTRIBUTES.Sid
        (call $gs32 (i32.add (local.get $arg2) (i32.const 8)) (i32.const 4)) ;; SE_GROUP_ENABLED
        (call $gs8 (i32.add (local.get $arg2) (i32.const 12)) (i32.const 1)) ;; SID revision
        (call $gs8 (i32.add (local.get $arg2) (i32.const 13)) (i32.const 2)) ;; subauthorities
        ;; SID_IDENTIFIER_AUTHORITY SECURITY_NT_AUTHORITY = {0,0,0,0,0,5}.
        (call $gs32 (i32.add (local.get $arg2) (i32.const 14)) (i32.const 0))
        (call $gs16 (i32.add (local.get $arg2) (i32.const 18)) (i32.const 0x0500))
        (call $gs32 (i32.add (local.get $arg2) (i32.const 20)) (i32.const 32))
        (call $gs32 (i32.add (local.get $arg2) (i32.const 24)) (i32.const 544))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))
        (return)))
    ;; TokenPrivileges: the classic LUIDs 2..28, with the retained enabled bit.
    (call $gs32 (local.get $arg2) (i32.const 27))
    (local.set $enabled (i32.atomic.load offset=12 (local.get $rec)))
    (local.set $out (i32.add (local.get $arg2) (i32.const 4)))
    (local.set $i (i32.const 2))
    (block $done
      (loop $write
        (br_if $done (i32.gt_u (local.get $i) (i32.const 28)))
        (call $gs32 (local.get $out) (local.get $i))
        (call $gs32 (i32.add (local.get $out) (i32.const 4)) (i32.const 0))
        (call $gs32 (i32.add (local.get $out) (i32.const 8))
          (select (i32.const 2) (i32.const 0)
            (i32.ne
              (i32.and (local.get $enabled)
                (i32.shl (i32.const 1) (local.get $i)))
              (i32.const 0))))
        (local.set $out (i32.add (local.get $out) (i32.const 12)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $write)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
  )

  ;; AdjustTokenPrivileges(TokenHandle, DisableAllPrivileges, NewState,
  ;; BufferLength, PreviousState, ReturnLength).
  (func $handle_AdjustTokenPrivileges (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $return_length i32) (local $rec i32) (local $count i32)
    (local $total i32) (local $i i32) (local $entry i32) (local $low i32)
    (local $high i32) (local $attrs i32) (local $old i32) (local $next i32)
    (local $changed i32) (local $changed_count i32) (local $needed i32)
    (local $not_all i32) (local $out i32)
    (local.set $return_length (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
    (local.set $rec (call $token_record_from_handle (local.get $arg0)))
    (if (i32.eqz (local.get $rec))
      (then
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (if (i32.eqz
          (i32.and (i32.atomic.load offset=8 (local.get $rec)) (i32.const 0x20)))
      (then
        (global.set $last_error (i32.const 5)) ;; ERROR_ACCESS_DENIED
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (if (local.get $arg4)
      (then
        (if (i32.eqz
              (i32.and (i32.atomic.load offset=8 (local.get $rec)) (i32.const 8)))
          (then
            (global.set $last_error (i32.const 5))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (return)))
        (if (i32.eqz
              (call $token_guest_span_valid (local.get $return_length) (i32.const 4)))
          (then
            (global.set $last_error (i32.const 87))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (return)))))
    (local.set $old (i32.atomic.load offset=12 (local.get $rec)))
    (local.set $next (local.get $old))
    (if (local.get $arg1)
      (then (local.set $next (i32.const 0)))
      (else
        (if (i32.eqz (call $token_guest_span_valid (local.get $arg2) (i32.const 4)))
          (then
            (global.set $last_error (i32.const 87))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (return)))
        (local.set $count (call $gl32 (local.get $arg2)))
        (if (i32.gt_u (local.get $count) (i32.const 357913940))
          (then
            (global.set $last_error (i32.const 87))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (return)))
        (local.set $total
          (i32.add (i32.const 4) (i32.mul (local.get $count) (i32.const 12))))
        (if (i32.eqz (call $token_guest_span_valid (local.get $arg2) (local.get $total)))
          (then
            (global.set $last_error (i32.const 87))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (return)))
        (block $parsed
          (loop $parse
            (br_if $parsed (i32.ge_u (local.get $i) (local.get $count)))
            (local.set $entry
              (i32.add (local.get $arg2)
                (i32.add (i32.const 4) (i32.mul (local.get $i) (i32.const 12)))))
            (local.set $low (call $gl32 (local.get $entry)))
            (local.set $high (call $gl32 (i32.add (local.get $entry) (i32.const 4))))
            (local.set $attrs (call $gl32 (i32.add (local.get $entry) (i32.const 8))))
            (if (i32.or
                  (i32.ne (local.get $high) (i32.const 0))
                  (i32.or
                    (i32.lt_u (local.get $low) (i32.const 2))
                    (i32.gt_u (local.get $low) (i32.const 28))))
              (then (local.set $not_all (i32.const 1)))
              (else
                (if (i32.ne (i32.and (local.get $attrs) (i32.const 2)) (i32.const 0))
                  (then
                    (local.set $next
                      (i32.or (local.get $next)
                        (i32.shl (i32.const 1) (local.get $low)))))
                  (else
                    (local.set $next
                      (i32.and (local.get $next)
                        (i32.xor
                          (i32.shl (i32.const 1) (local.get $low))
                          (i32.const -1))))))))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $parse)))))
    (local.set $changed (i32.xor (local.get $old) (local.get $next)))
    (local.set $i (i32.const 2))
    (block $counted
      (loop $count_changes
        (br_if $counted (i32.gt_u (local.get $i) (i32.const 28)))
        (if (i32.ne
              (i32.and (local.get $changed)
                (i32.shl (i32.const 1) (local.get $i)))
              (i32.const 0))
          (then
            (local.set $changed_count
              (i32.add (local.get $changed_count) (i32.const 1)))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $count_changes)))
    (local.set $needed
      (i32.add (i32.const 4) (i32.mul (local.get $changed_count) (i32.const 12))))
    (if (local.get $arg4)
      (then
        (call $gs32 (local.get $return_length) (local.get $needed))
        (if (i32.lt_u (local.get $arg3) (local.get $needed))
          (then
            (global.set $last_error (i32.const 122)) ;; ERROR_INSUFFICIENT_BUFFER
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (return)))
        (if (i32.eqz
              (call $token_guest_span_valid (local.get $arg4) (local.get $needed)))
          (then
            (global.set $last_error (i32.const 87))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (return)))
        (call $gs32 (local.get $arg4) (local.get $changed_count))
        (local.set $out (i32.add (local.get $arg4) (i32.const 4)))
        (local.set $i (i32.const 2))
        (block $written
          (loop $write_previous
            (br_if $written (i32.gt_u (local.get $i) (i32.const 28)))
            (if (i32.ne
                  (i32.and (local.get $changed)
                    (i32.shl (i32.const 1) (local.get $i)))
                  (i32.const 0))
              (then
                (call $gs32 (local.get $out) (local.get $i))
                (call $gs32 (i32.add (local.get $out) (i32.const 4)) (i32.const 0))
                (call $gs32 (i32.add (local.get $out) (i32.const 8))
                  (select (i32.const 2) (i32.const 0)
                    (i32.ne
                      (i32.and (local.get $old)
                        (i32.shl (i32.const 1) (local.get $i)))
                      (i32.const 0))))
                (local.set $out (i32.add (local.get $out) (i32.const 12)))))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $write_previous)))))
    (call $token_publish_enabled (local.get $next))
    (global.set $last_error
      (select (i32.const 1300) (i32.const 0) (local.get $not_all)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1)))

  ;; Shared LookupAccountSidA/W identity model. The only principal the process
  ;; token publishes is S-1-5-32-544, the predefined BUILTIN\Administrators
  ;; alias. Buffer capacities include NUL on input; success lengths exclude it.
  (func $lookup_account_sid
      (param $system i32) (param $sid i32)
      (param $name i32) (param $name_len_ptr i32)
      (param $domain i32) (param $domain_len_ptr i32)
      (param $use_ptr i32) (param $wide i32)
    (local $name_cap i32) (local $domain_cap i32) (local $char_size i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (if (i32.or
          (i32.or
            (i32.eqz (call $token_guest_span_valid
              (local.get $name_len_ptr) (i32.const 4)))
            (i32.eqz (call $token_guest_span_valid
              (local.get $domain_len_ptr) (i32.const 4))))
          (i32.eqz (call $token_guest_span_valid
            (local.get $use_ptr) (i32.const 4))))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (return)))
    (if (local.get $system)
      (then
        (if (i32.eqz (call $token_guest_span_valid
              (local.get $system) (i32.const 1)))
          (then
            (global.set $last_error (i32.const 87))
            (return)))
        ;; The browser exposes no remote account database. Empty retains the
        ;; local-system meaning; any named system is an unavailable net path.
        (if (call $gl8 (local.get $system))
          (then
            (global.set $last_error (i32.const 53)) ;; ERROR_BAD_NETPATH
            (return)))))
    (if (i32.eqz (call $security_sid_valid (local.get $sid)))
      (then
        (global.set $last_error (i32.const 1337)) ;; ERROR_INVALID_SID
        (return)))
    (if (i32.eqz (call $security_sid_is_builtin_admin (local.get $sid)))
      (then
        (global.set $last_error (i32.const 1332)) ;; ERROR_NONE_MAPPED
        (return)))
    (local.set $name_cap (call $gl32 (local.get $name_len_ptr)))
    (local.set $domain_cap (call $gl32 (local.get $domain_len_ptr)))
    (if (i32.or
          (i32.or (i32.eqz (local.get $name))
            (i32.lt_u (local.get $name_cap) (i32.const 15)))
          (i32.or (i32.eqz (local.get $domain))
            (i32.lt_u (local.get $domain_cap) (i32.const 8))))
      (then
        ;; Both required sizes are defined on an insufficient-buffer failure;
        ;; name/domain/use payloads remain untouched.
        (call $gs32 (local.get $name_len_ptr) (i32.const 15))
        (call $gs32 (local.get $domain_len_ptr) (i32.const 8))
        (global.set $last_error (i32.const 122)) ;; ERROR_INSUFFICIENT_BUFFER
        (return)))
    (local.set $char_size (select (i32.const 2) (i32.const 1) (local.get $wide)))
    (if (i32.or
          (i32.eqz (call $token_guest_span_valid (local.get $name)
            (i32.mul (i32.const 15) (local.get $char_size))))
          (i32.eqz (call $token_guest_span_valid (local.get $domain)
            (i32.mul (i32.const 8) (local.get $char_size)))))
      (then
        (global.set $last_error (i32.const 87))
        (return)))
    (if (local.get $wide)
      (then
        ;; L"Administrators\0".
        (call $gs32 (local.get $name) (i32.const 0x00640041))
        (call $gs32 (i32.add (local.get $name) (i32.const 4)) (i32.const 0x0069006d))
        (call $gs32 (i32.add (local.get $name) (i32.const 8)) (i32.const 0x0069006e))
        (call $gs32 (i32.add (local.get $name) (i32.const 12)) (i32.const 0x00740073))
        (call $gs32 (i32.add (local.get $name) (i32.const 16)) (i32.const 0x00610072))
        (call $gs32 (i32.add (local.get $name) (i32.const 20)) (i32.const 0x006f0074))
        (call $gs32 (i32.add (local.get $name) (i32.const 24)) (i32.const 0x00730072))
        (call $gs16 (i32.add (local.get $name) (i32.const 28)) (i32.const 0))
        ;; L"BUILTIN\0".
        (call $gs32 (local.get $domain) (i32.const 0x00550042))
        (call $gs32 (i32.add (local.get $domain) (i32.const 4)) (i32.const 0x004c0049))
        (call $gs32 (i32.add (local.get $domain) (i32.const 8)) (i32.const 0x00490054))
        (call $gs32 (i32.add (local.get $domain) (i32.const 12)) (i32.const 0x0000004e)))
      (else
        ;; "Administrators\0" and "BUILTIN\0".
        (call $gs32 (local.get $name) (i32.const 0x696d6441))
        (call $gs32 (i32.add (local.get $name) (i32.const 4)) (i32.const 0x7473696e))
        (call $gs32 (i32.add (local.get $name) (i32.const 8)) (i32.const 0x6f746172))
        (call $gs16 (i32.add (local.get $name) (i32.const 12)) (i32.const 0x7372))
        (call $gs8 (i32.add (local.get $name) (i32.const 14)) (i32.const 0))
        (call $gs32 (local.get $domain) (i32.const 0x4c495542))
        (call $gs32 (i32.add (local.get $domain) (i32.const 4)) (i32.const 0x004e4954))))
    (call $gs32 (local.get $name_len_ptr) (i32.const 14))
    (call $gs32 (local.get $domain_len_ptr) (i32.const 7))
    (call $gs32 (local.get $use_ptr) (i32.const 4)) ;; SidTypeAlias
    ;; Like other Win32 BOOL APIs, success does not define LastError.
    (i32.store offset=0 (global.get $reg_base) (i32.const 1)))

  (func $handle_LookupAccountSidA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $domain_len_ptr i32) (local $use_ptr i32)
    (local.set $domain_len_ptr (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (local.set $use_ptr (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
    (call $lookup_account_sid
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)
      (local.get $arg4) (local.get $domain_len_ptr) (local.get $use_ptr) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32))))

  (func $handle_LookupAccountSidW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $domain_len_ptr i32) (local $use_ptr i32)
    (local.set $domain_len_ptr (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (local.set $use_ptr (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
    (call $lookup_account_sid
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)
      (local.get $arg4) (local.get $domain_len_ptr) (local.get $use_ptr) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32))))

  ;; MsiQueryProductStateW(szProduct) — the emulated MSI database starts
  ;; empty, so a valid product code is neither advertised nor installed.
  (func $handle_MsiQueryProductStateW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (select (i32.const -1) (i32.const -2)
        (i32.ne (local.get $arg0) (i32.const 0)))) ;; UNKNOWN / INVALIDARG
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; Synchronization-object create imports reserve bit 31 for private result
  ;; metadata. A set bit with handle bits means ERROR_ALREADY_EXISTS; the bare
  ;; bit means another synchronization-object type already owns the name.
  (func $sync_created_handle (param $raw i32) (param $failure_error i32) (result i32)
    (local $handle i32)
    (if (i32.eq (local.get $raw) (i32.const 0x80000000))
      (then
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (return (i32.const 0))))
    (local.set $handle (i32.and (local.get $raw) (i32.const 0x7fffffff)))
    (if (i32.eqz (local.get $handle))
      (then (global.set $last_error (local.get $failure_error)))
      (else
        (global.set $last_error
          (if (result i32) (i32.lt_s (local.get $raw) (i32.const 0))
            (then (i32.const 183)) ;; ERROR_ALREADY_EXISTS
            (else (i32.const 0))))))
    (local.get $handle))

  ;; Open imports use the same bare-bit sentinel for a cross-type name.
  (func $sync_opened_handle (param $raw i32) (result i32)
    (if (i32.eq (local.get $raw) (i32.const 0x80000000))
      (then
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (return (i32.const 0))))
    (global.set $last_error
      (if (result i32) (local.get $raw)
        (then (i32.const 0))
        (else (i32.const 2)))) ;; ERROR_FILE_NOT_FOUND
    (local.get $raw))

  (func $create_event_core
      (param $manual_reset i32) (param $initial_state i32)
      (param $name i32) (param $wide i32) (result i32)
    (local $name_wa i32) (local $existing i32)
    (if (local.get $name)
      (then (local.set $name_wa (call $g2w (local.get $name)))))
    ;; Resolve an existing event explicitly so CreateEvent's return path keeps
    ;; the same host ABI as OpenEvent. A cross-type sentinel remains distinct.
    (if (local.get $name_wa)
      (then
        (local.set $existing
          (call $host_open_event (local.get $name_wa) (local.get $wide)))
        (if (local.get $existing)
          (then
            (if (i32.eq (local.get $existing) (i32.const 0x80000000))
              (then (return (call $sync_opened_handle (local.get $existing)))))
            (global.set $last_error (i32.const 183)) ;; ERROR_ALREADY_EXISTS
            (return (local.get $existing))))))
    (call $sync_created_handle
      (call $host_create_event
        (local.get $manual_reset) (local.get $initial_state)
        (local.get $name_wa) (local.get $wide))
      (i32.const 8))) ;; ERROR_NOT_ENOUGH_MEMORY

  ;; 27: CreateEventA(lpAttr, bManualReset, bInitialState, lpName) — 4 args stdcall
  (func $handle_CreateEventA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $create_event_core
      (local.get $arg1) (local.get $arg2) (local.get $arg3) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; OpenEventA(dwDesiredAccess, bInheritHandle, lpName) — 3 args stdcall.
  ;; Access masks and inheritance do not change the cooperative process-local
  ;; object, but the name lookup and reference lifetime match Win32.
  (func $handle_OpenEventA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $sync_opened_handle
      (if (result i32) (local.get $arg2)
        (then (call $host_open_event (call $g2w (local.get $arg2)) (i32.const 0)))
        (else (i32.const 0)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 28: CreateThread(lpAttr, dwStackSize, lpStartAddr, lpParam, dwFlags, lpThreadId) — 6 args stdcall
  (func $handle_CreateThread (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $lpThreadId i32)
    (local.set $lpThreadId (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    ;; Pass dwCreationFlags into the host so CREATE_SUSPENDED is part of the
    ;; atomic creation event instead of a briefly-runnable create followed by
    ;; a separate SuspendThread call.
    ;; A HANDLE and thread id are different Win32 namespaces. The host owns the
    ;; worker-slot allocation, so let it write the stable id while returning the
    ;; independently allocated handle. Writing EAX here made Abe pass 0xE1000
    ;; to PostThreadMessage instead of the loader thread's id 2.
    (i32.store offset=0 (global.get $reg_base) (call $host_create_thread
      (local.get $arg2) (local.get $arg3) (local.get $arg1) (local.get $arg4)
      (if (result i32) (local.get $lpThreadId)
        (then (call $g2w (local.get $lpThreadId)))
        (else (i32.const 0)))
      (global.get $current_thread_id)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
  )

  ;; 29: WaitForSingleObject(hHandle, dwMilliseconds) — 2 args stdcall
  (func $handle_WaitForSingleObject (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $result i32)
    (local.set $result (call $host_wait_single (local.get $arg0) (local.get $arg1)))
    (if (i32.eq (local.get $result) (i32.const 0xFFFF))
      (then
        (global.set $yield_reason (i32.const 1))
        (global.set $wait_handle (local.get $arg0))
        (global.set $wait_timeout (local.get $arg1))
        (global.set $wait_stack_bytes (i32.const 12))
        (global.set $steps (i32.const 0))
        (return)))
    (i32.store offset=0 (global.get $reg_base) (local.get $result))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  (func $handle_WaitForSingleObjectEx (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $result i32)
    (if (local.get $arg2) (then
      (if (call $io_apc_start (i32.const 16)) (then (return)))))
    (local.set $result (call $host_wait_single (local.get $arg0) (local.get $arg1)))
    (if (i32.eq (local.get $result) (i32.const 0xFFFF))
      (then
        (global.set $wait_alertable (i32.ne (local.get $arg2) (i32.const 0)))
        (global.set $yield_reason (i32.const 1))
        (global.set $wait_handle (local.get $arg0))
        (global.set $wait_timeout (local.get $arg1))
        (global.set $wait_stack_bytes (i32.const 16))
        (global.set $steps (i32.const 0))
        (return)))
    (i32.store offset=0 (global.get $reg_base) (local.get $result))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 30: ResetEvent(hEvent) — 1 arg stdcall
  (func $handle_ResetEvent (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_reset_event (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 31: SetEvent(hEvent) — 1 arg stdcall
  (func $handle_SetEvent (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_set_event (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
    ;; A kernel transition that wakes another thread is a natural scheduler
    ;; preemption point.  Cooperative execution otherwise lets the signaler
    ;; run an entire 100k-block browser slice before the waiter gets a turn;
    ;; Storm queues MPQ work and can recycle the destination in that gap.
    (if (i32.load offset=0 (global.get $reg_base))
      (then (global.set $yield_flag (i32.const 1))))
  )

  ;; PulseEvent(hEvent) — 1 arg stdcall. Deprecated on modern Windows, but
  ;; older Win9x-era loaders still resolve it dynamically during startup.
  (func $handle_PulseEvent (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $set_ok i32)
    (local.set $set_ok (call $host_set_event (local.get $arg0)))
    (if (local.get $set_ok)
      (then (drop (call $host_reset_event (local.get $arg0)))))
    (i32.store offset=0 (global.get $reg_base) (local.get $set_ok))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 32: WriteProfileStringA(appName, keyName, lpString) — stub, pretend success
  (func $handle_WriteProfileStringA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; WriteProfileStringA(appName, keyName, string) — 3 args stdcall, writes to win.ini
    (i32.store offset=0 (global.get $reg_base) (call $host_ini_write_string
      (call $g2w (local.get $arg0))
      (if (result i32) (local.get $arg1) (then (call $g2w (local.get $arg1))) (else (i32.const 0)))
      (if (result i32) (local.get $arg2) (then (call $g2w (local.get $arg2))) (else (i32.const 0)))
      (global.get $win_ini_name_ptr)
      (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; Process/private heap handles are opaque, but unlike the old fixed token a
  ;; private handle has its own live record in shared guest memory. This keeps
  ;; identity and destruction visible across real browser Worker instances even
  ;; though allocations still come from the emulator's one process allocator.
  (global $PROCESS_HEAP_HANDLE i32 (i32.const 0x00BEEF00))
  (global $PRIVATE_HEAP_MAGIC i32 (i32.const 0x50414548)) ;; "HEAP"

  (func $heap_api_handle_valid (param $handle i32) (result i32)
    (if (i32.eq (local.get $handle) (global.get $PROCESS_HEAP_HANDLE))
      (then (return (i32.const 1))))
    (if (i32.eqz (local.get $handle)) (then (return (i32.const 0))))
    (i32.eq (i32.load (call $g2w (local.get $handle)))
            (global.get $PRIVATE_HEAP_MAGIC)))

  ;; 33: HeapCreate(flOptions, dwInitialSize, dwMaximumSize) — 3 args stdcall
  (func $handle_HeapCreate (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $heap_alloc (i32.const 8)))
    (if (i32.load offset=0 (global.get $reg_base))
      (then
        (call $gs32 (i32.load offset=0 (global.get $reg_base)) (global.get $PRIVATE_HEAP_MAGIC))
        (call $toolhelp_heap_add (i32.load offset=0 (global.get $reg_base))))
      (else (global.set $last_error (i32.const 8)))) ;; ERROR_NOT_ENOUGH_MEMORY
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 34: HeapDestroy(hHeap) → BOOL. The process heap cannot be destroyed.
  (func $handle_HeapDestroy (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.and
          (i32.ne (local.get $arg0) (global.get $PROCESS_HEAP_HANDLE))
          (call $heap_api_handle_valid (local.get $arg0)))
      (then
        (call $toolhelp_heap_remove (local.get $arg0))
        (call $gs32 (local.get $arg0) (i32.const 0))
        (call $heap_free (local.get $arg0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1)))
      (else
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; 35: HeapAlloc
  (func $handle_HeapAlloc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $record i32) (local $ptr i32)
    (if (i32.eqz (call $heap_api_handle_valid (local.get $arg0)))
      (then
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (local.set $record (call $toolhelp_alloc_reserve (local.get $arg0) (i32.const 0)))
    (if (local.get $record) (then
      (local.set $ptr (call $heap_alloc (local.get $arg2)))
      (call $toolhelp_alloc_commit (local.get $record) (local.get $arg0) (local.get $ptr) (local.get $arg2))))
    (i32.store offset=0 (global.get $reg_base) (local.get $ptr))
    ;; Zero memory if HEAP_ZERO_MEMORY (0x08) — skip on OOM (eax=0)
    (if (i32.and (i32.ne (i32.load offset=0 (global.get $reg_base)) (i32.const 0))
                 (i32.ne (i32.and (local.get $arg1) (i32.const 0x08)) (i32.const 0)))
    (then (call $zero_memory (call $g2w (i32.load offset=0 (global.get $reg_base))) (local.get $arg2))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))) (return)
  )

  ;; 36: HeapFree
  (func $handle_HeapFree (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.or (i32.eqz (call $heap_api_handle_valid (local.get $arg0)))
                (i32.eqz (local.get $arg2)))
      (then
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (if (i32.eqz (call $toolhelp_alloc_remove (local.get $arg0) (local.get $arg2))) (then
      (global.set $last_error (i32.const 87))
      (call $toolhelp_return (i32.const 0) (i32.const 3)) (return)))
    (call $heap_free (local.get $arg2))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))) (return)
  )

  ;; 37: HeapReAlloc(hHeap, dwFlags, lpMem, dwBytes)
  ;;
  ;; A growing block must carry over only what the OLD block actually held.
  ;; This used to copy dwBytes — the NEW size — out of the old allocation,
  ;; so every grow read past the end of the source and pulled whatever
  ;; happened to sit behind it into the fresh block. HEAP_ZERO_MEMORY was
  ;; ignored on top of that, so the caller asked for zeros and got that
  ;; trailing garbage instead. Real d3drm's .x parser grows its arrays this
  ;; way (4 bytes to 8, HEAP_ZERO_MEMORY) while parsing a ProgressiveMesh.
  ;;
  ;; $heap_alloc puts the block size at ptr-4 and it covers the header plus
  ;; padding, so the usable old payload is that size minus the header. A
  ;; pointer below $heap_base is not ours (msvcrt's own sub-allocator hands
  ;; those out) and has no header to read, so it keeps the old best-effort
  ;; copy — there is nothing better to be had without knowing its size.
  (func $handle_HeapReAlloc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $tmp i32) (local $old_usable i32) (local $copy i32) (local $record i32)
    (if (i32.eqz (call $heap_api_handle_valid (local.get $arg0)))
      (then
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (local.set $record (call $toolhelp_alloc_reserve (local.get $arg0) (local.get $arg2)))
    (if (i32.eqz (local.get $record)) (then
      (call $toolhelp_return (i32.const 0) (i32.const 4)) (return)))
    (block $done
      (if (i32.eqz (local.get $arg2))
        (then
          ;; No old block: this is a plain allocation.
          (local.set $tmp (call $heap_alloc (local.get $arg3)))
          (if (i32.and (i32.ne (local.get $tmp) (i32.const 0))
                       (i32.ne (i32.and (local.get $arg1) (i32.const 0x08)) (i32.const 0)))
            (then (call $zero_memory (call $g2w (local.get $tmp)) (local.get $arg3))))
          (br $done)))
      (if (i32.lt_u (local.get $arg2) (global.get $heap_base))
        (then (local.set $old_usable (i32.const -1)))   ;; foreign: size unknown
        (else
          (local.set $old_usable
            (call $heap_payload_size_unchecked (local.get $arg2)))))
      ;; HEAP_REALLOC_IN_PLACE_ONLY (0x10): the caller is telling us other
      ;; pointers into this block are still live, so moving it would corrupt
      ;; them. Satisfy it only when the block already has the room; Windows
      ;; returns NULL rather than relocating, and so do we.
      (if (i32.ne (i32.and (local.get $arg1) (i32.const 0x10)) (i32.const 0))
        (then
          (if (i32.or (i32.eq (local.get $old_usable) (i32.const -1))
                      (i32.gt_u (local.get $arg3) (local.get $old_usable)))
            (then (local.set $tmp (i32.const 0)) (br $done)))
          (if (i32.and (i32.ne (i32.and (local.get $arg1) (i32.const 0x08)) (i32.const 0))
                       (i32.gt_u (local.get $arg3) (local.get $old_usable)))
            (then (call $zero_memory
                    (call $g2w (i32.add (local.get $arg2) (local.get $old_usable)))
                    (i32.sub (local.get $arg3) (local.get $old_usable)))))
          (local.set $tmp (local.get $arg2))
          (br $done)))
      (local.set $tmp (call $heap_alloc (local.get $arg3)))
      (if (i32.eqz (local.get $tmp)) (then (br $done)))
      ;; Carry over min(old payload, new size); a shrink copies only what fits.
      (local.set $copy (local.get $arg3))
      (if (i32.and (i32.ne (local.get $old_usable) (i32.const -1))
                   (i32.lt_u (local.get $old_usable) (local.get $copy)))
        (then (local.set $copy (local.get $old_usable))))
      (call $memcpy (call $g2w (local.get $tmp)) (call $g2w (local.get $arg2)) (local.get $copy))
      ;; The grown tail is the caller's to define; zero it when asked.
      (if (i32.and (i32.ne (i32.and (local.get $arg1) (i32.const 0x08)) (i32.const 0))
                   (i32.gt_u (local.get $arg3) (local.get $copy)))
        (then (call $zero_memory
                (call $g2w (i32.add (local.get $tmp) (local.get $copy)))
                (i32.sub (local.get $arg3) (local.get $copy)))))
      (call $heap_free (local.get $arg2)))
    (call $toolhelp_alloc_commit (local.get $record) (local.get $arg0) (local.get $tmp) (local.get $arg3))
    (i32.store offset=0 (global.get $reg_base) (local.get $tmp))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))) (return)
  )

  ;; Is guest [$ga, $ga + $size) wholly inside one $GUEST_FIXED_POOL_* hole?
  (func $guest_fixed_pool_of (param $ga i32) (param $size i32) (result i32)
    (local $wa i32)
    (local.set $wa (i32.add (i32.sub (local.get $ga) (global.get $image_base)) (global.get $GUEST_BASE)))
    (i32.or (i32.or
      (i32.and (i32.ge_u (local.get $wa) (region.addr $GUEST_FIXED_POOL_A 0))
        (i32.le_u (i32.add (local.get $wa) (local.get $size)) (region.end $GUEST_FIXED_POOL_A)))
      (i32.and (i32.ge_u (local.get $wa) (region.addr $GUEST_FIXED_POOL_B 0))
        (i32.le_u (i32.add (local.get $wa) (local.get $size)) (region.end $GUEST_FIXED_POOL_B))))
      (i32.or
        (i32.and (i32.ge_u (local.get $wa) (region.addr $GUEST_FIXED_POOL_C 0))
          (i32.le_u (i32.add (local.get $wa) (local.get $size)) (region.end $GUEST_FIXED_POOL_C)))
        (i32.and (i32.ge_u (local.get $wa) (region.addr $GUEST_FIXED_POOL_D 0))
          (i32.le_u (i32.add (local.get $wa) (local.get $size)) (region.end $GUEST_FIXED_POOL_D))))))

  ;; 38: VirtualAlloc(lpAddr, dwSize, flAllocType, flProtect)
  ;; NULL reserves return 64KB-granularity bases; commits are page-aligned.
  (func $handle_VirtualAlloc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $size i32) (local $new_top i32)
    (if (i32.eqz (call $guest_page_protection_valid (local.get $arg3)))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    ;; Round size up to page boundary
    (local.set $size (i32.and (i32.add (local.get $arg1) (i32.const 0xFFF)) (i32.const 0xFFFFF000)))
    (if (i32.eqz (local.get $size))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    ;; A fixed reserve or commit wholly inside one of the declared fixed guest
    ;; pools is real guest memory at exactly that address (00-regions.wat).
    (if (i32.and (i32.ne (local.get $arg0) (i32.const 0))
          (call $guest_fixed_pool_of (local.get $arg0) (local.get $size)))
      (then
        (i32.store offset=0 (global.get $reg_base) (local.get $arg0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    ;; A MEM_RESERVE at a fixed low address names guest space that is free in a
    ;; Win98 process but is not ours to give: below the sparse arena, only the
    ;; image's own window [image_base, image_base + GUEST_BASE size) is guest
    ;; memory, and past it the direct window translates straight into the heap,
    ;; the stack and emulator tables. Windows fails a reservation it cannot
    ;; place exactly, and so do we -- it must not quietly hand out emulator
    ;; memory, and it must not move either: Crusaders of Might and Magic
    ;; reserves 0x04000000, 0x06000000 and 0x08000000 because its level files
    ;; are memory images with pointers already relocated to those bases. The
    ;; first of those used to "succeed" onto the window title table.
    (if (i32.and (i32.ne (local.get $arg0) (i32.const 0))
          (i32.and (i32.ne (i32.and (local.get $arg2) (i32.const 0x2000)) (i32.const 0))
            (i32.lt_u (local.get $arg0) (call $virtual_alloc_min))))
      (then
        (if (i32.and (i32.ge_u (local.get $arg0) (global.get $image_base))
              (i32.gt_u
                (i32.add (i32.sub (local.get $arg0) (global.get $image_base)) (local.get $size))
                (i32.sub (region.end $GUEST_BASE) (global.get $GUEST_BASE))))
          (then
            (global.set $last_error (i32.const 487)) ;; ERROR_INVALID_ADDRESS
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
            (return)))))
    (if (local.get $arg0)
      (then
        (if (i32.ge_u (local.get $arg0) (call $virtual_alloc_min))
          (then
            ;; Commit into a sparse high guest reserve.
            (i32.store offset=0 (global.get $reg_base) (call $virtual_map_commit_protect
              (local.get $arg0) (local.get $size) (local.get $arg3))))
          (else
            ;; MEM_COMMIT at an existing low address. Refuse commits that would
            ;; map into emulator-private decoded-code/cache memory.
            (if (i32.gt_u
                  (call $g2w (i32.add (local.get $arg0) (local.get $size)))
                  (global.get $THREAD_CACHE_BASE))
              (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
              (else (i32.store offset=0 (global.get $reg_base) (local.get $arg0)))))))
      (else
        ;; Reserve from a sparse high guest-address arena, separate from
        ;; HeapAlloc's upward-growing low heap. MEM_RESERVE is address-space
        ;; bookkeeping; real backing is added only by MEM_COMMIT.
        (local.set $new_top (call $virtual_reserve_place (local.get $size)
          (select (i32.const 2) (i32.const 0)
            (i32.ne (i32.and (local.get $arg2) (i32.const 0x100000)) (i32.const 0)))
          (local.get $arg3)))
        (if (i32.eqz (local.get $new_top))
          (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
          (else
            (if (i32.and (local.get $arg2) (i32.const 0x1000))
              (then
                (i32.store offset=0 (global.get $reg_base) (call $virtual_map_commit_protect
                  (local.get $new_top) (local.get $size) (local.get $arg3)))
                (if (i32.eqz (i32.load (global.get $reg_base)))
                  (then (drop (call $virtual_map_release (local.get $new_top))))))
              (else
                ;; Ownership was published atomically during placement; a
                ;; reserve-only request consumes no physical backing.
                (i32.store offset=0 (global.get $reg_base) (local.get $new_top))))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))) (return)
  )

  ;; ---- MapViewOfFile views ------------------------------------------------
  ;; guest_map_alloc puts a view in the same high address space as a
  ;; VirtualAlloc commit, and it gets an ordinary VIRTUAL_MAP_TABLE record, so
  ;; by the time VirtualFree sees an address there is nothing in the record to
  ;; say which it is. Windows cares: a view is freed with UnmapViewOfFile, and
  ;; VirtualFree on one fails with ERROR_INVALID_ADDRESS without touching a
  ;; byte. Age of Empires leans on exactly that. Its allocator wraps a
  ;; "decommit these bytes" helper at 0x46ef00 that calls
  ;; VirtualFree(ptr, size, MEM_DECOMMIT) on whatever it is handed, and it
  ;; hands it unaligned interior pointers into the memory-mapped .drs archives
  ;; (0x7de5d197 size 0x183e, inside the guest 0x7d1b0000 view whose 0xdc3000
  ;; is Interfac.drs rounded up to a page). On Windows those calls do nothing.
  ;; Here they used to reach $virtual_map_decommit_zero, which cleared the
  ;; interface shapes out of the mapped archive; the shape count then read 0
  ;; and the game reported it as "Could not initialize graphics system", which
  ;; is a long way from the real cause.
  ;;
  ;; Slot 0 of the table is the live count, slots 1.. are {guest base, size}.
  ;; The table is small and only VirtualFree and the map alloc/free exports
  ;; walk it, all cold paths.
  (func $mapped_view_slot (param $i i32) (result i32)
    (i32.add (global.get $MAPPED_VIEW_TABLE) (i32.shl (local.get $i) (i32.const 3))))

  (func $mapped_view_register (param $guest i32) (param $size i32)
    (local $count i32)
    (if (i32.or (i32.eqz (local.get $guest)) (i32.eqz (local.get $size)))
      (then (return)))
    (local.set $count (i32.load (global.get $MAPPED_VIEW_TABLE)))
    ;; A full table means later views are not recognized as views, which is the
    ;; behaviour that shipped before this table existed. Losing the guard is
    ;; better than dropping a live entry and mis-reporting some other view.
    (if (i32.ge_u (local.get $count) (global.get $MAX_MAPPED_VIEWS))
      (then (return)))
    (i32.store (call $mapped_view_slot (i32.add (local.get $count) (i32.const 1)))
      (local.get $guest))
    (i32.store offset=4 (call $mapped_view_slot (i32.add (local.get $count) (i32.const 1)))
      (local.get $size))
    (i32.store (global.get $MAPPED_VIEW_TABLE) (i32.add (local.get $count) (i32.const 1))))

  (func $mapped_view_unregister (param $guest i32)
    (local $count i32) (local $i i32) (local $slot i32) (local $last i32)
    (local.set $count (i32.load (global.get $MAPPED_VIEW_TABLE)))
    (local.set $i (i32.const 1))
    (block $done (loop $scan
      (br_if $done (i32.gt_u (local.get $i) (local.get $count)))
      (local.set $slot (call $mapped_view_slot (local.get $i)))
      (if (i32.eq (i32.load (local.get $slot)) (local.get $guest))
        (then
          ;; Swap the last entry down; order carries no meaning here.
          (local.set $last (call $mapped_view_slot (local.get $count)))
          (i32.store (local.get $slot) (i32.load (local.get $last)))
          (i32.store offset=4 (local.get $slot) (i32.load offset=4 (local.get $last)))
          (i32.store (global.get $MAPPED_VIEW_TABLE)
            (i32.sub (local.get $count) (i32.const 1)))
          (return)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan))))

  ;; Is this guest address inside a live mapped view?
  (func $mapped_view_contains (param $guest i32) (result i32)
    (local $count i32) (local $i i32) (local $slot i32) (local $base i32)
    (local.set $count (i32.load (global.get $MAPPED_VIEW_TABLE)))
    (local.set $i (i32.const 1))
    (block $done (loop $scan
      (br_if $done (i32.gt_u (local.get $i) (local.get $count)))
      (local.set $slot (call $mapped_view_slot (local.get $i)))
      (local.set $base (i32.load (local.get $slot)))
      (if (i32.and
            (i32.ge_u (local.get $guest) (local.get $base))
            (i32.lt_u (local.get $guest)
              (i32.add (local.get $base) (i32.load offset=4 (local.get $slot)))))
        (then (return (i32.const 1))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  ;; 39: VirtualFree. A sparse MEM_RELEASE must recover its map-table slot;
  ;; otherwise allocation-heavy loaders eventually hit MAX_VIRTUAL_MAPS even
  ;; though every corresponding Windows allocation was freed successfully.
  ;; Decommit and low/direct mappings need no backing operation here.
  (func $handle_VirtualFree (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; A MapViewOfFile view is not VirtualAlloc'd memory: Windows fails the
    ;; call with ERROR_INVALID_ADDRESS and leaves the view alone, whether the
    ;; guest asked to decommit or to release. See $mapped_view_contains.
    (if (call $mapped_view_contains (local.get $arg0))
      (then
        (global.set $last_error (i32.const 487))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base)
          (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    ;; MEM_DECOMMIT. The mapping stays -- decommit is not release, and the guest
    ;; may commit the same addresses again -- but the pages it gets back then
    ;; are zero on Windows, so the backing has to be cleared now. See
    ;; $virtual_map_decommit_zero for the app that proved this matters.
    (if (i32.and
          (i32.ge_u (local.get $arg0) (call $virtual_alloc_min))
          (i32.ne (i32.and (local.get $arg2) (i32.const 0x4000)) (i32.const 0)))
      (then (call $virtual_map_decommit_zero (local.get $arg0) (local.get $arg1))))
    (if (i32.and
          (i32.and
            (i32.ge_u (local.get $arg0) (call $virtual_alloc_min))
            (i32.eqz (local.get $arg1)))
          (i32.ne (i32.and (local.get $arg2) (i32.const 0x8000)) (i32.const 0)))
      (then
        ;; Diagnostic, disarmed unless the page set a caller (see
        ;; $virtual_leak_release_caller). ESP still points at the return
        ;; address here -- the epilogue below is what pops it -- so this is the
        ;; one place that can tell one guest call site from another.
        (global.set $virtual_leak_this_call
          (i32.and
            (i32.ne (global.get $virtual_leak_release_caller) (i32.const 0))
            (i32.eq (i32.load (call $g2w (i32.load offset=16 (global.get $reg_base))))
              (global.get $virtual_leak_release_caller))))
        (drop (call $virtual_map_release (local.get $arg0)))
        (global.set $virtual_leak_this_call (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; Win9x does not page out the emulator's fixed linear-memory backing, so a
  ;; non-empty guest range is already resident. These APIs remain important as
  ;; dynamically resolved capability probes in period audio DLLs.
  (func $virtual_lock_range_valid (param $base i32) (param $size i32) (result i32)
    (i32.and
      (i32.ne (local.get $base) (i32.const 0))
      (i32.ne (local.get $size) (i32.const 0))))

  (func $handle_VirtualLock (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $virtual_lock_range_valid (local.get $arg0) (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_VirtualUnlock (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $virtual_lock_range_valid (local.get $arg0) (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; MSVC 6 applications commonly resolve this during startup even when no
  ;; structured exception is raised. Publish the cdecl thunk, but fail loudly
  ;; if a guest actually asks us to unwind an _except_handler3 frame.
  (func $handle__except_handler3 (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr)))

  ;; 40: GetACP — process ANSI code page
  (func $handle_GetACP (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (global.get $ansi_code_page))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; 791: GetUserDefaultLangID() → LANGID (0x0409 = English US)
  (func $handle_GetUserDefaultLangID (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x0409))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; GetUserDefaultUILanguage() → LANGID. The UI and formatting locale are
  ;; the same en-US environment exposed by the existing default-locale APIs.
  (func $handle_GetUserDefaultUILanguage (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x0409))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; GetSystemDefaultUILanguage() → LANGID. InstallShield 11 resolves this
  ;; post-Win98 API dynamically and requires it while constructing its UI.
  (func $handle_GetSystemDefaultUILanguage (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x0409))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; 41: GetOEMCP — STUB: unimplemented
  (func $handle_GetOEMCP (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 437))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; 42: GetCPInfo
  (func $handle_GetCPInfo (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $cp i32) (local $info i32)
    ;; CPINFO struct: MaxCharSize(4), DefaultChar[2](2), LeadByte[12](12)
    (local.set $cp (call $resolve_code_page (local.get $arg0)))
    ;; Do not publish a plausible SBCS description for a code page the
    ;; conversion layer cannot actually provide. Validate before translating
    ;; or mutating the caller's output structure.
    (if (i32.or
          (i32.eqz (local.get $arg1))
          (i32.eqz (call $is_supported_code_page (local.get $cp))))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (local.set $info (call $g2w (local.get $arg1)))
    (call $zero_memory (local.get $info) (i32.const 18))
    (i32.store8 offset=4 (local.get $info) (i32.const 0x3F)) ;; DefaultChar = "?"
    (if (call $is_dbcs_code_page (local.get $cp))
      (then
        (call $gs32 (local.get $arg1) (i32.const 2)) ;; MaxCharSize = 2
        (if (i32.eq (local.get $cp) (i32.const 932))
          (then
            (i32.store8 offset=6 (local.get $info) (i32.const 0x81))
            (i32.store8 offset=7 (local.get $info) (i32.const 0x9F))
            (i32.store8 offset=8 (local.get $info) (i32.const 0xE0))
            (i32.store8 offset=9 (local.get $info) (i32.const 0xFC)))
          (else
            (if (i32.eq (local.get $cp) (i32.const 1361))
              (then
                (i32.store8 offset=6 (local.get $info) (i32.const 0x84))
                (i32.store8 offset=7 (local.get $info) (i32.const 0xD3))
                (i32.store8 offset=8 (local.get $info) (i32.const 0xD8))
                (i32.store8 offset=9 (local.get $info) (i32.const 0xDE))
                (i32.store8 offset=10 (local.get $info) (i32.const 0xE0))
                (i32.store8 offset=11 (local.get $info) (i32.const 0xF9)))
              (else
                (i32.store8 offset=6 (local.get $info) (i32.const 0x81))
                (i32.store8 offset=7 (local.get $info) (i32.const 0xFE)))))))
      (else
        (call $gs32 (local.get $arg1) (i32.const 1)))) ;; MaxCharSize = 1
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))) (return)
  )

  ;; 43: MultiByteToWideChar
  (func $handle_MultiByteToWideChar (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $v i32) (local $i i32) (local $src_wa i32) (local $dst_wa i32)
    ;; Simple: copy each byte to 16-bit. arg2=src, arg3=srcLen, arg4=dst, [esp+24]=dstLen
    (local.set $v (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))) ;; arg5: dstLen
    (local.set $src_wa (call $g2w (local.get $arg2)))
    (if (local.get $arg4) (then (local.set $dst_wa (call $g2w (local.get $arg4)))))
    (if (i32.eq (local.get $arg3) (i32.const -1)) ;; srcLen=-1 means NUL-terminated
    (then (local.set $arg3 (i32.add (call $strlen (local.get $src_wa)) (i32.const 1)))))
    (if (i32.eqz (local.get $arg4)) ;; query required size
    (then (i32.store offset=0 (global.get $reg_base) (local.get $arg3)))
    (else
    (local.set $i (i32.const 0))
    (block $done (loop $lp
    (br_if $done (i32.ge_u (local.get $i) (local.get $arg3)))
    (br_if $done (i32.ge_u (local.get $i) (local.get $v)))
    (i32.store16 (i32.add (local.get $dst_wa) (i32.shl (local.get $i) (i32.const 1)))
    (i32.load8_u (i32.add (local.get $src_wa) (local.get $i))))
    (local.set $i (i32.add (local.get $i) (i32.const 1)))
    (br $lp)))
    (i32.store offset=0 (global.get $reg_base) (local.get $i))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))) (return)
  )

  ;; 44: WideCharToMultiByte
  (func $handle_WideCharToMultiByte (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $v i32) (local $i i32) (local $src_wa i32) (local $dst_wa i32)
    ;; Simple: copy low byte of each 16-bit char. arg2=src, arg3=srcLen, arg4=dst, [esp+24]=dstLen
    (local.set $v (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))) ;; arg5: dstLen
    (local.set $src_wa (call $g2w (local.get $arg2)))
    (if (local.get $arg4) (then (local.set $dst_wa (call $g2w (local.get $arg4)))))
    (if (i32.eq (local.get $arg3) (i32.const -1))
    (then
    ;; Count wide string length
    (local.set $arg3 (i32.const 0))
    (block $d2 (loop $l2
    (br_if $d2 (i32.eqz (i32.load16_u (i32.add (local.get $src_wa) (i32.shl (local.get $arg3) (i32.const 1))))))
    (local.set $arg3 (i32.add (local.get $arg3) (i32.const 1)))
    (br $l2)))
    (local.set $arg3 (i32.add (local.get $arg3) (i32.const 1)))))
    (if (i32.eqz (local.get $arg4))
    (then (i32.store offset=0 (global.get $reg_base) (local.get $arg3)))
    (else
    (local.set $i (i32.const 0))
    (block $done (loop $lp
    (br_if $done (i32.ge_u (local.get $i) (local.get $arg3)))
    (br_if $done (i32.ge_u (local.get $i) (local.get $v)))
    (i32.store8 (i32.add (local.get $dst_wa) (local.get $i))
    (i32.load8_u (i32.add (local.get $src_wa) (i32.shl (local.get $i) (i32.const 1)))))
    (local.set $i (i32.add (local.get $i) (i32.const 1)))
    (br $lp)))
    (i32.store offset=0 (global.get $reg_base) (local.get $i))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36))) (return)
  )

  ;; Win98 en-US ANSI-byte CT_CTYPE1 classification used by GetStringTypeA,
  ;; its Ex variant, and the IsChar*A family.  This input is a CP1252 byte,
  ;; not a Unicode code unit: e.g. byte 0x8a represents U+0160 (S caron).
  ;; CT_CTYPE1 bits: C1_UPPER=1 C1_LOWER=2 C1_DIGIT=4 C1_SPACE=8
  ;; C1_PUNCT=16 C1_CNTRL=32 C1_ALPHA=256.
  (func $ctype1_ascii_flags (param $ch i32) (result i32)
    (local $ct i32) (local $upper i32) (local $lower i32)
    (if (i32.le_u (local.get $ch) (i32.const 31))
      (then (local.set $ct (i32.const 0x20))))
    (if (i32.or (i32.eq (local.get $ch) (i32.const 32))
          (i32.or (i32.eq (local.get $ch) (i32.const 9))
            (i32.or (i32.eq (local.get $ch) (i32.const 10)) (i32.eq (local.get $ch) (i32.const 13)))))
      (then (local.set $ct (i32.or (local.get $ct) (i32.const 0x08)))))
    (if (i32.and (i32.ge_u (local.get $ch) (i32.const 48)) (i32.le_u (local.get $ch) (i32.const 57)))
      (then (local.set $ct (i32.or (local.get $ct) (i32.const 0x04)))))
    (if (i32.and (i32.ge_u (local.get $ch) (i32.const 65)) (i32.le_u (local.get $ch) (i32.const 90)))
      (then (local.set $ct (i32.or (local.get $ct) (i32.const 0x101)))))
    (if (i32.and (i32.ge_u (local.get $ch) (i32.const 97)) (i32.le_u (local.get $ch) (i32.const 122)))
      (then (local.set $ct (i32.or (local.get $ct) (i32.const 0x102)))))
    (if (i32.and (i32.ge_u (local.get $ch) (i32.const 33)) (i32.le_u (local.get $ch) (i32.const 47)))
      (then (local.set $ct (i32.or (local.get $ct) (i32.const 0x10)))))
    (if (i32.and (i32.ge_u (local.get $ch) (i32.const 58)) (i32.le_u (local.get $ch) (i32.const 64)))
      (then (local.set $ct (i32.or (local.get $ct) (i32.const 0x10)))))
    (if (i32.and (i32.ge_u (local.get $ch) (i32.const 91)) (i32.le_u (local.get $ch) (i32.const 96)))
      (then (local.set $ct (i32.or (local.get $ct) (i32.const 0x10)))))
    (if (i32.and (i32.ge_u (local.get $ch) (i32.const 123)) (i32.le_u (local.get $ch) (i32.const 126)))
      (then (local.set $ct (i32.or (local.get $ct) (i32.const 0x10)))))
    ;; CP1252 letters outside ASCII. Every i32.and combines comparison
    ;; results, keeping the logical-i32 gate's boolean-normalization invariant.
    (local.set $upper
      (i32.or
        (i32.or
          (i32.and (i32.ge_u (local.get $ch) (i32.const 0xc0))
                   (i32.le_u (local.get $ch) (i32.const 0xd6)))
          (i32.and (i32.ge_u (local.get $ch) (i32.const 0xd8))
                   (i32.le_u (local.get $ch) (i32.const 0xde))))
        (i32.or
          (i32.or (i32.eq (local.get $ch) (i32.const 0x8a))
                  (i32.eq (local.get $ch) (i32.const 0x8c)))
          (i32.or (i32.eq (local.get $ch) (i32.const 0x8e))
                  (i32.eq (local.get $ch) (i32.const 0x9f))))))
    (local.set $lower
      (i32.or
        (i32.or
          (i32.and (i32.ge_u (local.get $ch) (i32.const 0xdf))
                   (i32.le_u (local.get $ch) (i32.const 0xf6)))
          (i32.and (i32.ge_u (local.get $ch) (i32.const 0xf8))
                   (i32.le_u (local.get $ch) (i32.const 0xff))))
        (i32.or
          (i32.or (i32.eq (local.get $ch) (i32.const 0x9a))
                  (i32.eq (local.get $ch) (i32.const 0x9c)))
          (i32.or
            (i32.or (i32.eq (local.get $ch) (i32.const 0x9e))
                    (i32.eq (local.get $ch) (i32.const 0xb5)))
            (i32.or (i32.eq (local.get $ch) (i32.const 0xaa))
                    (i32.eq (local.get $ch) (i32.const 0xba)))))))
    (if (local.get $upper)
      (then (local.set $ct (i32.or (local.get $ct) (i32.const 0x101)))))
    (if (local.get $lower)
      (then (local.set $ct (i32.or (local.get $ct) (i32.const 0x102)))))
    (local.get $ct)
  )

  ;; Win98 en-US Unicode-WCHAR CT_CTYPE1 classification.  Keep this separate
  ;; from the ANSI-byte table above: U+008A is a C1 control code while CP1252
  ;; byte 0x8A maps to the uppercase letter U+0160.  The bounded model covers
  ;; ASCII, Latin-1 letters and the CP1252-only Unicode letters; other Unicode
  ;; code units are left unclassified rather than guessed from their low byte.
  (func $ctype1_unicode_flags (param $ch_in i32) (result i32)
    (local $ch i32) (local $ct i32) (local $ansi i32)
    (local.set $ch (i32.and (local.get $ch_in) (i32.const 0xffff)))
    (if (i32.le_u (local.get $ch) (i32.const 0x7f))
      (then
        (local.set $ct (call $ctype1_ascii_flags (local.get $ch)))
        ;; The ANSI helper intentionally preserves its historical byte
        ;; behavior; Unicode DEL is a control code too.
        (if (i32.eq (local.get $ch) (i32.const 0x7f))
          (then (local.set $ct (i32.const 0x20))))
        (return (local.get $ct))))
    ;; Unicode C1 control-code range.  These are not the printable characters
    ;; assigned to CP1252 byte values 0x80..0x9f.
    (if (i32.and (i32.ge_u (local.get $ch) (i32.const 0x80))
                 (i32.le_u (local.get $ch) (i32.const 0x9f)))
      (then (return (i32.const 0x20))))
    ;; Reuse the ANSI helper only where Unicode and CP1252 code points are
    ;; identical (the printable Latin-1 range).
    (if (i32.le_u (local.get $ch) (i32.const 0x00ff))
      (then (return (call $ctype1_ascii_flags (local.get $ch)))))
    ;; Map the seven alphabetic CP1252 additions back to their ANSI bytes and
    ;; reuse the one en-US table instead of maintaining two case-range lists.
    (local.set $ansi (i32.const -1))
    (if (i32.eq (local.get $ch) (i32.const 0x0152)) (then (local.set $ansi (i32.const 0x8c))))
    (if (i32.eq (local.get $ch) (i32.const 0x0153)) (then (local.set $ansi (i32.const 0x9c))))
    (if (i32.eq (local.get $ch) (i32.const 0x0160)) (then (local.set $ansi (i32.const 0x8a))))
    (if (i32.eq (local.get $ch) (i32.const 0x0161)) (then (local.set $ansi (i32.const 0x9a))))
    (if (i32.eq (local.get $ch) (i32.const 0x0178)) (then (local.set $ansi (i32.const 0x9f))))
    (if (i32.eq (local.get $ch) (i32.const 0x017d)) (then (local.set $ansi (i32.const 0x8e))))
    (if (i32.eq (local.get $ch) (i32.const 0x017e)) (then (local.set $ansi (i32.const 0x9e))))
    (if (i32.ne (local.get $ansi) (i32.const -1))
      (then (return (call $ctype1_ascii_flags (local.get $ansi)))))
    (i32.const 0)
  )

  ;; Shared IsChar* predicate. Only decoding/classification differs between
  ;; ANSI bytes and WCHARs; class masks and BOOL normalization stay together.
  (func $is_char_type (param $ch i32) (param $mask i32) (param $wide i32) (result i32)
    (i32.ne (i32.and
      (if (result i32) (local.get $wide)
        (then (call $ctype1_unicode_flags (local.get $ch)))
        (else (call $ctype1_ascii_flags (i32.and (local.get $ch) (i32.const 0xff)))))
      (local.get $mask)) (i32.const 0)))

  ;; BOOL IsCharAlphaA(CHAR ch). Win32 promotes the byte argument to a stack
  ;; slot; use the same invariant ANSI classification as GetStringTypeA.
  (func $handle_IsCharAlphaA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $is_char_type
      (local.get $arg0) (i32.const 0x100) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; BOOL IsCharAlphaNumericA(CHAR ch). C1_ALPHA and C1_DIGIT are the two
  ;; accepted classes; punctuation, spaces and control bytes remain false.
  (func $handle_IsCharAlphaNumericA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $is_char_type
      (local.get $arg0) (i32.const 0x104) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; BOOL IsCharUpperA/IsCharLowerA(CHAR ch). Far 1.70 passes promoted CHAR
  ;; values whose upper bytes are unspecified, so classify the low ANSI byte.
  (func $handle_IsCharUpperA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $is_char_type
      (local.get $arg0) (i32.const 0x01) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_IsCharLowerA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $is_char_type
      (local.get $arg0) (i32.const 0x02) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; BOOL IsCharAlphaW/IsCharUpperW(WCHAR ch).  Classify the Unicode code unit
  ;; rather than interpreting its low byte in the process ANSI code page.
  (func $handle_IsCharAlphaW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $is_char_type
      (local.get $arg0) (i32.const 0x100) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_IsCharUpperW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $is_char_type
      (local.get $arg0) (i32.const 0x01) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; GetStringType{A,W} core: one CT_CTYPE1 word per source character. The
  ;; output is an array of WORDs either way; only the source stride differs.
  (func $get_string_type_core (param $src_guest i32) (param $count_in i32)
                              (param $out_guest i32) (param $wide i32) (result i32)
    (local $i i32) (local $out i32) (local $src i32) (local $count i32) (local $flags i32)
    (if (i32.eqz (local.get $src_guest)) (then (return (i32.const 0))))
    (if (i32.eqz (local.get $out_guest)) (then (return (i32.const 0))))
    (local.set $src (call $g2w (local.get $src_guest)))
    (local.set $out (call $g2w (local.get $out_guest)))
    (local.set $count (local.get $count_in))
    (if (i32.eq (local.get $count) (i32.const -1))
      (then (local.set $count (i32.add
        (select (call $strlen_w (local.get $src)) (call $strlen_a (local.get $src))
                (local.get $wide))
        (i32.const 1)))))
    (block $done (loop $next
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (if (local.get $wide)
        (then
          (local.set $flags
            (call $ctype1_unicode_flags
              (i32.load16_u
                (i32.add (local.get $src) (i32.shl (local.get $i) (i32.const 1)))))))
        (else
          (local.set $flags
            (call $ctype1_ascii_flags
              (i32.load8_u (i32.add (local.get $src) (local.get $i)))))))
      (i32.store16
        (i32.add (local.get $out) (i32.mul (local.get $i) (i32.const 2)))
        (local.get $flags))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $next)))
    (i32.const 1)
  )

  ;; 45: GetStringTypeA(Locale, dwInfoType, lpSrcStr, cchSrc, lpCharType) — single-byte CT_CTYPE1 classification.
  (func $handle_GetStringTypeA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $get_string_type_core
      (local.get $arg2) (local.get $arg3) (local.get $arg4) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))  ;; stdcall, 5 args
  )

  ;; 46: GetStringTypeW(dwInfoType, lpSrcStr, cchSrc, lpCharType) — classify chars.
  (func $handle_GetStringTypeW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $get_string_type_core
      (local.get $arg1) (local.get $arg2) (local.get $arg3) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; Minimal LCMapStringA/W character mapping. Lengths and return values are in
  ;; characters; cchSrc=-1 includes the terminating NUL. ASCII case folding is
  ;; enough for Win9x path/alias normalization while other mapping flags retain
  ;; the previous identity behavior.
  (func $lcmap_string_core (param $src_guest i32) (param $count_in i32)
                           (param $dst_guest i32) (param $dst_count i32)
                           (param $wide i32) (param $map_flags i32) (result i32)
    (local $src i32) (local $dst i32) (local $count i32)
    (local $i i32) (local $ch i32) (local $step i32)
    (if (i32.or (i32.eqz (local.get $src_guest)) (i32.eqz (local.get $count_in)))
      (then (return (i32.const 0))))
    (local.set $src (call $g2w (local.get $src_guest)))
    (local.set $count (local.get $count_in))
    (if (i32.eq (local.get $count) (i32.const -1))
      (then
        (if (local.get $wide)
          (then (local.set $count (i32.add (call $strlen_w (local.get $src)) (i32.const 1))))
          (else (local.set $count (i32.add (call $strlen_a (local.get $src)) (i32.const 1)))))))
    ;; A NULL destination is the documented size-query form.
    (if (i32.eqz (local.get $dst_guest)) (then (return (local.get $count))))
    (if (i32.lt_u (local.get $dst_count) (local.get $count))
      (then
        (global.set $last_error (i32.const 122)) ;; ERROR_INSUFFICIENT_BUFFER
        (return (i32.const 0))))
    (local.set $dst (call $g2w (local.get $dst_guest)))
    (local.set $step (select (i32.const 2) (i32.const 1) (local.get $wide)))
    (block $done (loop $map
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $ch (call $load_char
        (i32.add (local.get $src) (i32.mul (local.get $i) (local.get $step)))
        (local.get $wide)))
      (if (i32.ne (i32.and (local.get $map_flags) (i32.const 0x100)) (i32.const 0)) ;; LCMAP_LOWERCASE
        (then
          (if (i32.and (i32.ge_u (local.get $ch) (i32.const 65))
                       (i32.le_u (local.get $ch) (i32.const 90)))
            (then (local.set $ch (i32.add (local.get $ch) (i32.const 32))))))
        (else
          (if (i32.ne (i32.and (local.get $map_flags) (i32.const 0x200)) (i32.const 0)) ;; LCMAP_UPPERCASE
            (then
              (if (i32.and (i32.ge_u (local.get $ch) (i32.const 97))
                           (i32.le_u (local.get $ch) (i32.const 122)))
                (then (local.set $ch (i32.sub (local.get $ch) (i32.const 32)))))))))
      (if (local.get $wide)
        (then (i32.store16
          (i32.add (local.get $dst) (i32.mul (local.get $i) (local.get $step)))
          (local.get $ch)))
        (else (i32.store8
          (i32.add (local.get $dst) (local.get $i))
          (local.get $ch))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $map)))
    (local.get $count))

  ;; 47: LCMapStringA(Locale, dwMapFlags, lpSrcStr, cchSrc, lpDestStr, cchDest)
  (func $handle_LCMapStringA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $cchDest i32)
    (local.set $cchDest (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (i32.store offset=0 (global.get $reg_base) (call $lcmap_string_core
      (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $cchDest)
      (i32.const 0) (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
  )

  ;; 48: LCMapStringW — wide version of the same bounded mapping.
  (func $handle_LCMapStringW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $cchDest i32)
    (local.set $cchDest (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (i32.store offset=0 (global.get $reg_base) (call $lcmap_string_core
      (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $cchDest)
      (i32.const 1) (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
  )

  ;; FlushInstructionCache(hProcess, lpBaseAddress, dwSize). The browser's x86
  ;; bytes are coherent, but its decoded threaded-code caches are per WASM
  ;; instance. Retire the caller's range and publish a process generation so
  ;; real Workers discard their local stale translations on the next slice.
  (func $handle_FlushInstructionCache (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.and
          (i32.ne (local.get $arg0) (i32.const -1))
          (i32.ne (i32.and (local.get $arg0) (i32.const 0xfffff000))
                  (i32.const 0x000e2000)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    ;; A NULL base requests the complete process cache. A non-NULL zero-length
    ;; range is a successful no-op, matching the absence of bytes to flush.
    (if (i32.or (i32.eqz (local.get $arg1)) (local.get $arg2))
      (then (call $process_code_cache_invalidate
        (local.get $arg1) (local.get $arg2))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; 49: GetStdHandle(nStdHandle) — read the process standard-handle table.
  (func $handle_GetStdHandle (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; STD_INPUT_HANDLE=-10 → 1, STD_OUTPUT_HANDLE=-11 → 2, STD_ERROR_HANDLE=-12 → 3
    (i32.store offset=0 (global.get $reg_base) (call $console_std_handle_get (local.get $arg0)))
    (if (i32.eq (i32.load offset=0 (global.get $reg_base)) (i32.const -1))
      (then (global.set $last_error (i32.const 6)))) ;; ERROR_INVALID_HANDLE
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 50: GetFileType(hFile) — FILE_TYPE_CHAR=2 for console, FILE_TYPE_DISK=1 for files
  (func $handle_GetFileType (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $resolved i32)
    (if (call $pipe_slot (local.get $arg0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 3)) ;; FILE_TYPE_PIPE
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (local.set $resolved (call $console_handle_resolve (local.get $arg0)))
    (i32.store offset=0 (global.get $reg_base) (if (result i32) (i32.or
            (i32.and (i32.ge_u (local.get $resolved) (i32.const 1))
                     (i32.le_u (local.get $resolved) (i32.const 3)))
            (i32.ne (call $console_buffer_record (local.get $arg0)) (i32.const 0)))
        (then (i32.const 2))   ;; FILE_TYPE_CHAR (console)
        (else (i32.const 1)))) ;; FILE_TYPE_DISK (regular file)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 51: WriteFile(hFile, lpBuffer, nBytesToWrite, lpBytesWritten, lpOverlapped) — 5 args
  (func $handle_WriteFile (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $saved_pos i32) (local $ok i32) (local $written i32)
    ;; Anonymous pipes (09d7-pipes.wat) finish or park the call themselves.
    (if (call $pipe_write_file (local.get $arg0) (local.get $arg1)
          (local.get $arg2) (local.get $arg3))
      (then (return)))
    ;; Output screen-buffer handles route through the same active/inactive cell
    ;; store as WriteConsoleA; stdin retains the historical compatibility no-op.
    (if (call $console_buffer_record (local.get $arg0))
      (then
        (i32.store offset=0 (global.get $reg_base) (call $console_write
          (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 0)))
        (if (i32.and (i32.ne (i32.load offset=0 (global.get $reg_base)) (i32.const 0)) (i32.ne (local.get $arg3) (i32.const 0)))
          (then (call $gs32 (local.get $arg3) (local.get $arg2))))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))) (return)))
    (if (i32.eq (call $console_handle_resolve (local.get $arg0)) (i32.const 1))
      (then
        (if (local.get $arg3) (then (call $gs32 (local.get $arg3) (local.get $arg2))))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))) (return)))
    ;; The completion-port twin of the overlapped read in $handle_ReadFile:
    ;; a positioned write that must not disturb the file pointer and reports
    ;; through the port. Warcraft III submits these at 0x00418603 with
    ;; lpNumberOfBytesWritten = NULL and tests GetLastError() == 997.
    ;; There is no fs_write_file_at bridge, so the seek is explicit and the
    ;; original position is put back before returning.
    (if (i32.and (i32.ne (local.get $arg4) (i32.const 0))
                 (i32.ne (call $iocp_assoc_find (local.get $arg0)) (i32.const 0)))
      (then
        (local.set $saved_pos (call $host_fs_set_file_pointer
          (local.get $arg0) (i32.const 0) (i32.const 1))) ;; FILE_CURRENT
        (drop (call $host_fs_set_file_pointer (local.get $arg0)
          (call $gl32 (i32.add (local.get $arg4) (i32.const 8)))
          (i32.const 0))) ;; FILE_BEGIN
        (local.set $ok (call $host_fs_write_file_result
          (local.get $arg0) (local.get $arg1) (local.get $arg2)
          (i32.add (local.get $arg4) (i32.const 4))))
        (drop (call $host_fs_set_file_pointer
          (local.get $arg0) (local.get $saved_pos) (i32.const 0)))
        (if (local.get $ok)
          (then
            (global.set $last_error (local.get $ok))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
            (return)))
        (local.set $written (call $gl32 (i32.add (local.get $arg4) (i32.const 4))))
        (if (local.get $arg3) (then (call $gs32 (local.get $arg3) (local.get $written))))
        (drop (call $iocp_complete_overlapped (local.get $arg0) (local.get $arg4)
          (local.get $written) (i32.const 0)))
        (global.set $last_error (i32.const 997)) ;; ERROR_IO_PENDING
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    ;; File handles — delegate to virtual FS
    (local.set $ok (call $host_fs_write_file_result
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)))
    (if (local.get $ok) (then (global.set $last_error (local.get $ok))))
    (i32.store offset=0 (global.get $reg_base) (i32.eqz (local.get $ok)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
  )

  ;; 52: SetHandleCount(uNumber) — no-op on Win32, return the count
  (func $handle_SetHandleCount (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 53: GetEnvironmentStrings — the undecorated name is the ANSI one.
  (func $handle_GetEnvironmentStrings (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_GetEnvironmentStringsA
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; 54: GetModuleFileNameA
  ;; "<drive>:\<exe_name>" into the caller's buffer, ANSI or wide, truncated to
  ;; nSize characters as Win32 does. Returns the characters written, not
  ;; counting the terminator. One writer for both spellings.
  (func $module_file_name (param $buf_g i32) (param $size i32) (param $wide i32) (result i32)
    (local $i i32) (local $n i32) (local $ch i32) (local $step i32)
    (local.set $step (select (i32.const 2) (i32.const 1) (local.get $wide)))
    (if (i32.eqz (local.get $buf_g)) (then (return (i32.const 0))))
    (local.set $n (i32.add (global.get $exe_name_len) (i32.const 3)))
    ;; Leave room for the terminator.
    (if (i32.and (i32.gt_u (local.get $size) (i32.const 0))
                 (i32.ge_u (local.get $n) (local.get $size)))
      (then (local.set $n (i32.sub (local.get $size) (i32.const 1)))))
    (block $done (loop $copy
      (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
      (local.set $ch (block $c (result i32)
        (if (i32.eq (local.get $i) (i32.const 0)) (then (br $c (global.get $exe_drive))))
        (if (i32.eq (local.get $i) (i32.const 1)) (then (br $c (i32.const 0x3A))))  ;; ':'
        (if (i32.eq (local.get $i) (i32.const 2)) (then (br $c (i32.const 0x5C))))  ;; '\'
        (i32.load8_u (i32.add (global.get $exe_name_wa)
          (i32.sub (local.get $i) (i32.const 3))))))
      (call $store_char
        (i32.add (local.get $buf_g) (i32.mul (local.get $i) (local.get $step)))
        (local.get $ch) (local.get $wide))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $copy)))
    (call $store_char
      (i32.add (local.get $buf_g) (i32.mul (local.get $n) (local.get $step)))
      (i32.const 0) (local.get $wide))
    (local.get $n))

  ;; Copy a host-recorded loaded-module path from guest memory. The loader
  ;; records the actual LoadLibrary spelling so self-extractors which validate
  ;; their own directory (CTL3D32 is a common example) do not see the EXE path.
  (func $loaded_module_file_name
      (param $path_g i32) (param $buf_g i32) (param $size i32) (param $wide i32)
      (result i32)
    (local $n i32) (local $i i32) (local $step i32)
    (if (i32.or (i32.eqz (local.get $path_g)) (i32.eqz (local.get $buf_g)))
      (then (return (i32.const 0))))
    (local.set $step (select (i32.const 2) (i32.const 1) (local.get $wide)))
    (local.set $n (call $guest_strlen (local.get $path_g)))
    ;; Match the existing EXE/static-module behavior by reserving a terminator.
    (if (i32.and (i32.gt_u (local.get $size) (i32.const 0))
                 (i32.ge_u (local.get $n) (local.get $size)))
      (then (local.set $n (i32.sub (local.get $size) (i32.const 1)))))
    (block $done (loop $copy
      (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
      (call $store_char
        (i32.add (local.get $buf_g) (i32.mul (local.get $i) (local.get $step)))
        (call $gl8 (i32.add (local.get $path_g) (local.get $i)))
        (local.get $wide))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $copy)))
    (call $store_char
      (i32.add (local.get $buf_g) (i32.mul (local.get $n) (local.get $step)))
      (i32.const 0) (local.get $wide))
    (local.get $n))

  ;; One character to a guest address, ANSI or wide.
  (func $store_char (param $p_g i32) (param $ch i32) (param $wide i32)
    (if (local.get $wide)
      (then (call $gs16 (local.get $p_g) (local.get $ch)))
      (else (call $gs8 (local.get $p_g) (local.get $ch)))))

  (func $handle_GetModuleFileNameA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $idx i32) (local $path_g i32)
    (local.set $idx (call $static_sys_dll_from_handle (local.get $arg0)))
    (if (local.get $idx)
      (then
        (i32.store offset=0 (global.get $reg_base) (call $static_sys_dll_file_name
          (i32.sub (local.get $idx) (i32.const 1))
          (local.get $arg1) (local.get $arg2) (i32.const 0)))
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
                (local.get $path_g) (local.get $arg1) (local.get $arg2) (i32.const 0)))
              (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
              (return)))))
      (local.set $idx (i32.add (local.get $idx) (i32.const 1)))
      (br $scan_loaded)))
    (i32.store offset=0 (global.get $reg_base) (call $module_file_name (local.get $arg1) (local.get $arg2) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))) (return)
  )

  ;; 55: UnhandledExceptionFilter(ExceptionInfo) -> LONG
  ;;
  ;; The last stop for an exception nobody claimed. A CRT reaches here from its
  ;; own __except filter -- msvcrt's _XcptFilter tail is literally
  ;; `push [ebp+0xc]; call [UnhandledExceptionFilter]` -- so arriving here means
  ;; a fault already happened somewhere else and every registered handler
  ;; declined it. Trapping here used to report this function as the
  ;; unimplemented API, which named the messenger instead of the fault; the
  ;; exception code and faulting address are the only useful facts and they are
  ;; in the record the caller just passed, so report those.
  ;;
  ;;   EXCEPTION_POINTERS { EXCEPTION_RECORD* ExceptionRecord; CONTEXT* Context; }
  ;;   EXCEPTION_RECORD   { DWORD Code; DWORD Flags; EXCEPTION_RECORD* Nested;
  ;;                        PVOID Address; DWORD NumberParameters; ... }
  ;;
  ;; Returns EXCEPTION_EXECUTE_HANDLER, which is what the real API returns on a
  ;; machine with no debugger attached once its fault dialog is dismissed: the
  ;; caller's __except block runs and the process terminates through its own
  ;; shutdown path rather than dying mid-instruction.
  ;;
  ;; Not yet done: re-entering a filter installed by SetUnhandledExceptionFilter.
  ;; Windows calls that filter from here and returns what it returns. Doing so
  ;; needs a continuation thunk to resume this handler after guest code runs
  ;; (the CACA000x mechanism), and every filter we have actually seen installed
  ;; is a CRT's own terminate path, which reaches the same place this does. The
  ;; filter is still stored and still round-trips through the setter, so nothing
  ;; here has to be undone when that trampoline exists.
  (func $handle_UnhandledExceptionFilter (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $rec i32) (local $rec_wa i32)
    ;; arg0 is EXCEPTION_POINTERS*. A null pointer, or a null ExceptionRecord
    ;; inside it, is legal input -- report what is known and skip the rest
    ;; rather than dereferencing it.
    (if (local.get $arg0)
      (then (local.set $rec (i32.load (call $g2w (local.get $arg0))))))
    (if (local.get $rec)
      (then (local.set $rec_wa (call $g2w (local.get $rec))) (call $host_unhandled_exception
              (i32.load (local.get $rec_wa))                  ;; ExceptionCode
              (i32.load offset=4 (local.get $rec_wa))         ;; ExceptionFlags
              (i32.load offset=12 (local.get $rec_wa))        ;; ExceptionAddress
              (global.get $unhandled_exception_filter)))
      (else (call $host_unhandled_exception
              (i32.const 0) (i32.const 0) (i32.const 0)
              (global.get $unhandled_exception_filter))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))  ;; EXCEPTION_EXECUTE_HANDLER
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; 56: GetCurrentProcess — return pseudo-handle -1 (0xFFFFFFFF)
  (func $handle_GetCurrentProcess (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0xFFFFFFFF))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; 57: TerminateProcess
  ;; Only this process's own handles end this process. A child that
  ;; CreateProcess started (09d7-pipes.wat) is stopped by its host -- this
  ;; used to call host_exit for any handle, so a parent killing its engine
  ;; killed itself.
  (func $handle_TerminateProcess (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $pid i32)
    (local.set $pid (call $pipe_child_pid (local.get $arg0)))
    (if (local.get $pid)
      (then
        (if (i32.eq (call $host_process_ctl (i32.const 1) (local.get $pid) (local.get $arg1)) (i32.const 1))
          (then (i32.store offset=0 (global.get $reg_base) (i32.const 1)))
          (else
            (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (call $host_exit (local.get $arg1)) (global.set $eip (i32.const 0)) (global.set $steps (i32.const 0)) (return)
  )

  ;; OpenProcess(dwDesiredAccess, bInheritHandle, dwProcessId). The emulator
  ;; hosts one Win32 process, so only its published PID can be opened. Keep the
  ;; handle in a distinct range so waits can model that live process without
  ;; confusing it with an event or guest thread handle.
  (func $handle_OpenProcess (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eq (local.get $arg2) (call $current_process_id))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.or (i32.const 0x000E2000)
          (i32.and (local.get $arg2) (i32.const 0xFFF))))
        (global.set $last_error (i32.const 0)))
      (else
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (global.set $last_error (i32.const 87)))) ;; ERROR_INVALID_PARAMETER
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; WaitForInputIdle(hProcess, dwMilliseconds). Win32 returns immediately for
  ;; a console process or one without a message queue. That exactly describes
  ;; the single process hosted by the browser, both through its -1 pseudo
  ;; handle and the real-looking handle OpenProcess exposes for it.
  (func $handle_WaitForInputIdle (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.or
          (i32.eq (local.get $arg0) (i32.const -1))
          (i32.eq (i32.and (local.get $arg0) (i32.const 0xfffff000))
                  (i32.const 0x000e2000)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0)) ;; WAIT_OBJECT_0
        (global.set $last_error (i32.const 0)))
      (else
        (i32.store offset=0 (global.get $reg_base) (i32.const -1)) ;; WAIT_FAILED
        (global.set $last_error (i32.const 6)))) ;; ERROR_INVALID_HANDLE
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; 58: GetTickCount
  (func $handle_GetTickCount (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $tick_count (call $host_get_ticks))
    ;; Busy-waiting on the clock? Park until it moves rather than answering
    ;; "not yet" a million times. See $clock_spin_step. The park must happen
    ;; before the ESP pop below, and the handler re-runs from the top on wake.
    (if (call $clock_spin_step (global.get $tick_count))
      (then
        (if (call $clock_spin_arm (global.get $tick_count)) (then (return)))))
    (call $clock_spin_note_raw (global.get $tick_count) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (global.get $tick_count))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))) (return)
  )

  ;; GetDoubleClickTime() → UINT. Win32 default is 500 ms unless customized.
  (func $handle_GetDoubleClickTime (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 500))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; 59: FindResourceA
  (func $handle_FindResourceA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; FindResourceA(hModule, lpName, lpType) → HRSRC (RVA of data entry)
    ;; arg0=hModule, arg1=lpName (MAKEINTRESOURCE or string), arg2=lpType
    ;; Walk resource directory: type(arg2) → name(arg1) → first lang → data entry RVA
    (call $push_rsrc_ctx (local.get $arg0))
    (i32.store offset=0 (global.get $reg_base) (call $find_resource (local.get $arg2) (local.get $arg1)))
    (call $pop_rsrc_ctx)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))) (return)
  )

  ;; 60: LoadResource(hModule, hResInfo) → HGLOBAL/resource-data pointer.
  ;; Keep the module context: HRSRC is an offset relative to the module whose
  ;; resource tree FindResource searched. Returning the raw offset loses that
  ;; context and makes native comctl32 parse the main EXE at a DLL-resource
  ;; offset when it builds property-sheet dialog templates.
  (func $handle_LoadResource (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $rva i32)
    (if (i32.eqz (local.get $arg1))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (call $push_rsrc_ctx (local.get $arg0))
    (local.set $rva
      (call $gl32 (i32.add (call $r_base) (local.get $arg1))))
    (i32.store offset=0 (global.get $reg_base) (i32.add (call $r_base) (local.get $rva)))
    (call $pop_rsrc_ctx)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))  ;; stdcall, 2 args
  )

  ;; 61: LockResource
  (func $handle_LockResource (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; LoadResource already resolves HRSRC through the owning module and
    ;; returns the stable resource-data pointer. LockResource exposes it.
    (i32.store offset=0 (global.get $reg_base) (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))) (return)
  )

  ;; 62: FreeResource(hResData) → BOOL
  ;; On Win32, resources are mapped from the PE image and don't need freeing. Returns FALSE (0).
  (func $handle_FreeResource (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; 63: RtlUnwind
  (func $handle_RtlUnwind (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; Calls every frame handler above TargetFrame with EXCEPTION_UNWINDING and
    ;; unlinks it, then returns to the caller; see $rtl_unwind_begin (11-seh).
    ;; The stdcall frame is popped here; the walk owns EIP from now ($steps = 0).
    (local $ret i32)
    (local.set $ret (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
    (call $rtl_unwind_begin (local.get $arg0) (local.get $arg2) (local.get $arg3) (local.get $ret))
  )

  ;; 64: FreeLibrary — STUB: unimplemented
  (func $handle_FreeLibrary (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; FreeLibrary returns TRUE on success (first call), FALSE if already freed
    ;; This handles the NSIS pattern: while(FreeLibrary(h)) {}
    (if (i32.or (i32.eqz (local.get $arg0))
                (i32.eq (local.get $arg0) (global.get $freelib_last_handle)))
      (then
        ;; Same handle freed again — already unloaded, return FALSE
        (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (else
        ;; First free of this handle — succeed and remember it
        (global.set $freelib_last_handle (local.get $arg0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; Measure an ANSI FAT volume label without reading beyond its documented
  ;; 11-character maximum plus the required terminator. -1 is an inaccessible
  ;; string and -2 is an overlong label.
  (func $set_volume_label_ansi_len (param $label i32) (result i32)
    (local $i i32)
    (block $overlong (loop $scan
      (if (call $ptr_range_access_bad
            (i32.add (local.get $label) (local.get $i))
            (i32.const 1) (i32.const 0))
        (then (return (i32.const -1))))
      (if (i32.eqz (call $gl8
            (i32.add (local.get $label) (local.get $i))))
        (then (return (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $overlong (i32.gt_u (local.get $i) (i32.const 11)))
      (br $scan)))
    (i32.const -2))

  ;; SetVolumeLabelA(lpRootPathName, lpVolumeName). This Win98 environment
  ;; exposes FAT writable volumes and immutable CD media. An explicit root is
  ;; the documented drive-root spelling "X:\\"; NULL selects the current
  ;; drive. A NULL or empty label removes the existing label.
  (func $set_volume_label_a_impl
      (param $root i32) (param $label i32) (result i32)
    (local $drive i32) (local $first i32) (local $length i32)
    (if (local.get $root)
      (then
        (if (call $ptr_range_access_bad
              (local.get $root) (i32.const 4) (i32.const 0))
          (then (return (i32.const 87)))) ;; ERROR_INVALID_PARAMETER
        (local.set $first
          (i32.and (call $gl8 (local.get $root)) (i32.const 0xDF)))
        (if (i32.or
              (i32.or
                (i32.lt_u (local.get $first) (i32.const 0x41))
                (i32.gt_u (local.get $first) (i32.const 0x5A)))
              (i32.or
                (i32.ne (call $gl8
                  (i32.add (local.get $root) (i32.const 1))) (i32.const 0x3A))
                (i32.or
                  (i32.ne (call $gl8
                    (i32.add (local.get $root) (i32.const 2))) (i32.const 0x5C))
                  (i32.ne (call $gl8
                    (i32.add (local.get $root) (i32.const 3))) (i32.const 0)))))
          (then (return (i32.const 123)))) ;; ERROR_INVALID_NAME
        (local.set $drive
          (i32.add (i32.sub (local.get $first) (i32.const 0x41))
                   (i32.const 1)))))
    (if (local.get $label)
      (then
        (local.set $length (call $set_volume_label_ansi_len (local.get $label)))
        (if (i32.eq (local.get $length) (i32.const -1))
          (then (return (i32.const 87)))) ;; ERROR_INVALID_PARAMETER
        (if (i32.eq (local.get $length) (i32.const -2))
          (then (return (i32.const 154)))))) ;; ERROR_LABEL_TOO_LONG
    (call $host_fs_set_volume_label
      (local.get $drive) (local.get $label) (local.get $length)))

  (func $handle_SetVolumeLabelA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $error i32)
    (local.set $error
      (call $set_volume_label_a_impl (local.get $arg0) (local.get $arg1)))
    (if (local.get $error)
      (then
        (global.set $last_error (local.get $error))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 1))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))
