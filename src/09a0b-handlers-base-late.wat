  ;; Internal file-import adapters attach the calling WASM instance's
  ;; 1-based thread ID. Browser broker tables may be shared across Workers;
  ;; host closure identity is therefore not the identity of the guest caller.
  (func $host_fs_read_file (param $a0 i32) (param $a1 i32) (param $a2 i32) (param $a3 i32) (result i32)
    ;; Ordinary filesystem reads keep the signed import count; negative
    ;; counts copy no bytes. Positioned reads explicitly normalize to uint32.
    (if (i32.gt_s (local.get $a2) (i32.const 0)) (then
      (call $d3dim_host_write_fence (local.get $a1) (local.get $a2))))
    (if (local.get $a3) (then (call $d3dim_host_write_fence (local.get $a3) (i32.const 4))))
    (call $host_fs_read_file_owned (local.get $a0) (local.get $a1) (local.get $a2) (local.get $a3) (global.get $current_thread_id)))
  (func $host_fs_read_file_at (param $a0 i32) (param $a1 i32) (param $a2 i32) (param $a3 i32) (param $a4 i32) (param $a5 i32) (result i32)
    (call $d3dim_host_write_fence (local.get $a1) (local.get $a2))
    (if (local.get $a3) (then (call $d3dim_host_write_fence (local.get $a3) (i32.const 4))))
    (call $host_fs_read_file_at_owned (local.get $a0) (local.get $a1) (local.get $a2) (local.get $a3) (local.get $a4) (local.get $a5) (global.get $current_thread_id)))
  (func $host_fs_read_pending  (result i32)
    (call $host_fs_read_pending_owned  (global.get $current_thread_id)))
  (func $host_fs_read_file_result (param $a0 i32) (param $a1 i32) (param $a2 i32) (param $a3 i32) (result i32)
    (if (i32.gt_s (local.get $a2) (i32.const 0)) (then
      (call $d3dim_host_write_fence (local.get $a1) (local.get $a2))))
    (if (local.get $a3) (then (call $d3dim_host_write_fence (local.get $a3) (i32.const 4))))
    (call $host_fs_read_file_result_owned (local.get $a0) (local.get $a1) (local.get $a2) (local.get $a3) (global.get $current_thread_id)))
  (func $host_fs_map_view_of_file (param $a0 i32) (param $a1 i32) (param $a2 i32) (param $a3 i32) (param $a4 i32) (result i32)
    (call $host_fs_map_view_of_file_owned (local.get $a0) (local.get $a1) (local.get $a2) (local.get $a3) (local.get $a4) (global.get $current_thread_id)))

  ;; ============================================================
  ;; LATE BASE SYSTEM HANDLERS
  ;; Environment, locale, process, console, synchronization, memory, filesystem and atom services.
  ;; ============================================================

;; 469: ExitThread(dwExitCode) — 1 arg, no return
  (func $handle_ExitThread (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $apc_drop_shared_current)
    (call $host_exit_thread (local.get $arg0))
    (global.set $yield_reason (i32.const 2))
    (global.set $eip (i32.const 0))
    (global.set $steps (i32.const 0))
  )

  ;; 470: FindNextFileA — STUB: unimplemented
  (func $handle_FindNextFileA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; FindNextFileA(hFindFile, lpFindFileData) — 2 args
    (i32.store offset=0 (global.get $reg_base) (call $host_fs_find_next_file
      (local.get $arg0) (local.get $arg1) (i32.const 0)))
    (if (i32.eqz (i32.load offset=0 (global.get $reg_base))) (then (global.set $last_error (i32.const 18)))) (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 471: GetEnvironmentVariableA(lpName, lpBuffer, nSize) → chars written
  (func $handle_GetEnvironmentVariableA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $env_get (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; GetEnvironmentVariableW(lpName, lpBuffer, nSize) — the environment core
  ;; stores one ANSI block and widens values on output, keeping A/W mutations
  ;; coherent through the existing $env_get helper.
  (func $handle_GetEnvironmentVariableW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $env_get (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; ExpandEnvironmentStringsA(lpSrc, lpDst, nSize) -> required chars,
  ;; including the terminating NUL. Unknown variables remain verbatim.
  (func $handle_ExpandEnvironmentStringsA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $env_expand_a
      (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; Fill OSVERSIONINFO from $winver. Both spellings share this: the struct is
  ;; identical up to szCSDVersion, which is empty either way. The W handler
  ;; used to hardcode Windows 98 instead, so an app told (via $winver) that it
  ;; was running on NT still read 4.10 back if it asked in Unicode.
  ;; winver uses GetVersion format: high word = build (bit 31: set=Win9x, clear=NT)
  ;; low word = (minor<<8)|major
  (func $version_info (param $out_g i32)
    (local $w0 i32)
    (local.set $w0 (call $g2w (local.get $out_g)))
    ;; dwMajorVersion at +4
    (i32.store (i32.add (local.get $w0) (i32.const 4))
      (i32.and (global.get $winver) (i32.const 0xFF)))
    ;; dwMinorVersion at +8
    (i32.store (i32.add (local.get $w0) (i32.const 8))
      (i32.and (i32.shr_u (global.get $winver) (i32.const 8)) (i32.const 0xFF)))
    ;; dwBuildNumber at +12 (bits 16-30, mask off platform bit)
    (i32.store (i32.add (local.get $w0) (i32.const 12))
      (i32.and (i32.shr_u (global.get $winver) (i32.const 16)) (i32.const 0x7FFF)))
    ;; dwPlatformId at +16: bit 31 set = Win9x (1), clear = NT (2)
    (i32.store (i32.add (local.get $w0) (i32.const 16))
      (if (result i32) (i32.and (global.get $winver) (i32.const 0x80000000))
        (then (i32.const 1))    ;; VER_PLATFORM_WIN32_WINDOWS
        (else (i32.const 2))))  ;; VER_PLATFORM_WIN32_NT
    ;; szCSDVersion at +20: empty string. Two zero bytes terminate it whether
    ;; the caller reads it as CHAR or WCHAR.
    (i32.store8 (i32.add (local.get $w0) (i32.const 20)) (i32.const 0))
    (i32.store8 (i32.add (local.get $w0) (i32.const 21)) (i32.const 0)))

  ;; 472: GetVersionExA — fill OSVERSIONINFOA (148 bytes min) from $winver
  (func $handle_GetVersionExA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $version_info (local.get $arg0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; InstallShield 11 dynamically asks KERNEL32 for the historical unsuffixed
  ;; GetVersionEx export. Win9x resolves that spelling to the ANSI contract.
  (func $handle_GetVersionEx (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_GetVersionExA
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; 473: SetConsoleCtrlHandler(HandlerRoutine, Add) → BOOL
  (func $handle_SetConsoleCtrlHandler (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $console_ctrl_handler_set (local.get $arg0) (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; 474: SetEnvironmentVariableW(lpName, lpValue) → BOOL
  (func $handle_SetEnvironmentVariableW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $env_set (local.get $arg0) (local.get $arg1) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; Primary sort weight of one character in the default (en-US) word sort:
  ;; symbols, then digits, then letters with case folded, then everything
  ;; above ASCII. 0 is the end of the string.
  (func $nls_sort_weight (param $c i32) (result i32)
    (if (i32.eqz (local.get $c)) (then (return (i32.const 0))))
    (if (i32.and (i32.ge_u (local.get $c) (i32.const 0x41)) (i32.le_u (local.get $c) (i32.const 0x5A)))
      (then (return (i32.add (i32.const 0x300) (i32.sub (local.get $c) (i32.const 0x41))))))
    (if (i32.and (i32.ge_u (local.get $c) (i32.const 0x61)) (i32.le_u (local.get $c) (i32.const 0x7A)))
      (then (return (i32.add (i32.const 0x300) (i32.sub (local.get $c) (i32.const 0x61))))))
    (if (i32.and (i32.ge_u (local.get $c) (i32.const 0x30)) (i32.le_u (local.get $c) (i32.const 0x39)))
      (then (return (i32.add (i32.const 0x200) (local.get $c)))))
    (if (i32.lt_u (local.get $c) (i32.const 0x80))
      (then (return (i32.add (i32.const 0x100) (local.get $c)))))
    (i32.add (i32.const 0x400) (local.get $c)))

  ;; Character $i of a guest string, or 0 past its length (-1 = NUL-terminated).
  (func $nls_char_at (param $p i32) (param $i i32) (param $len i32) (param $wide i32) (result i32)
    (if (i32.and (i32.ne (local.get $len) (i32.const -1)) (i32.ge_u (local.get $i) (local.get $len)))
      (then (return (i32.const 0))))
    (if (local.get $wide)
      (then (return (call $gl16 (i32.add (local.get $p) (i32.shl (local.get $i) (i32.const 1)))))))
    (call $gl8 (i32.add (local.get $p) (local.get $i))))

  ;; Characters the word sort skips at the primary level: hyphen and apostrophe
  ;; always (unless SORT_STRINGSORT), every symbol under NORM_IGNORESYMBOLS.
  (func $nls_ignorable (param $c i32) (param $flags i32) (result i32)
    (if (i32.eqz (local.get $c)) (then (return (i32.const 0))))
    (if (i32.and (i32.eqz (i32.and (local.get $flags) (i32.const 0x1000)))
                 (i32.or (i32.eq (local.get $c) (i32.const 0x2D)) (i32.eq (local.get $c) (i32.const 0x27))))
      (then (return (i32.const 1))))
    (if (i32.and (local.get $flags) (i32.const 4))
      (then (return (i32.and (i32.ge_u (call $nls_sort_weight (local.get $c)) (i32.const 0x100))
                             (i32.lt_u (call $nls_sort_weight (local.get $c)) (i32.const 0x200))))))
    (i32.const 0))

  ;; CompareString's ordering over guest strings, as -1/0/1: letters compare
  ;; case-insensitively first, so "commonfilesdir" < "SetupkitSetup1" (a byte
  ;; compare says the opposite, which broke SetupAPI's sorted string table).
  ;; Case is only a tie-break (lowercase first) unless NORM_IGNORECASE, and
  ;; the skipped hyphens/apostrophes decide last.
  (func $nls_compare (param $p1 i32) (param $len1 i32) (param $p2 i32) (param $len2 i32)
                     (param $wide i32) (param $flags i32) (result i32)
    (local $i1 i32) (local $i2 i32) (local $c1 i32) (local $c2 i32)
    (local $w1 i32) (local $w2 i32) (local $case i32)
    (block $primary_done (loop $primary
      (loop $skip1
        (local.set $c1 (call $nls_char_at (local.get $p1) (local.get $i1) (local.get $len1) (local.get $wide)))
        (if (call $nls_ignorable (local.get $c1) (local.get $flags))
          (then (local.set $i1 (i32.add (local.get $i1) (i32.const 1))) (br $skip1))))
      (loop $skip2
        (local.set $c2 (call $nls_char_at (local.get $p2) (local.get $i2) (local.get $len2) (local.get $wide)))
        (if (call $nls_ignorable (local.get $c2) (local.get $flags))
          (then (local.set $i2 (i32.add (local.get $i2) (i32.const 1))) (br $skip2))))
      (local.set $w1 (call $nls_sort_weight (local.get $c1)))
      (local.set $w2 (call $nls_sort_weight (local.get $c2)))
      (if (i32.ne (local.get $w1) (local.get $w2))
        (then (return (select (i32.const -1) (i32.const 1) (i32.lt_u (local.get $w1) (local.get $w2))))))
      (br_if $primary_done (i32.eqz (local.get $c1)))
      (if (i32.and (i32.eqz (local.get $case)) (i32.ne (local.get $c1) (local.get $c2)))
        (then (local.set $case (select (i32.const -1) (i32.const 1)
          (i32.and (i32.ge_u (local.get $c1) (i32.const 0x61)) (i32.le_u (local.get $c1) (i32.const 0x7A)))))))
      (local.set $i1 (i32.add (local.get $i1) (i32.const 1)))
      (local.set $i2 (i32.add (local.get $i2) (i32.const 1)))
      (br $primary)))
    (if (i32.eqz (i32.and (local.get $flags) (i32.const 1)))
      (then (if (local.get $case) (then (return (local.get $case))))))
    ;; Equal apart from skipped characters: the first position where only one
    ;; string has a skipped character makes that string the greater ("coop" <
    ;; "co-op"); otherwise plain code order decides.
    (local.set $i1 (i32.const 0))
    (block $raw_done (loop $raw
      (local.set $c1 (call $nls_char_at (local.get $p1) (local.get $i1) (local.get $len1) (local.get $wide)))
      (local.set $c2 (call $nls_char_at (local.get $p2) (local.get $i1) (local.get $len2) (local.get $wide)))
      (local.set $w1 (call $nls_ignorable (local.get $c1) (local.get $flags)))
      (local.set $w2 (call $nls_ignorable (local.get $c2) (local.get $flags)))
      (if (i32.ne (local.get $w1) (local.get $w2))
        (then (return (select (i32.const 1) (i32.const -1) (local.get $w1)))))
      (if (i32.and (local.get $flags) (i32.const 1))
        (then (local.set $c1 (call $tolower (local.get $c1)))
              (local.set $c2 (call $tolower (local.get $c2)))))
      (if (i32.ne (local.get $c1) (local.get $c2))
        (then (return (select (i32.const -1) (i32.const 1) (i32.lt_u (local.get $c1) (local.get $c2))))))
      (br_if $raw_done (i32.eqz (local.get $c1)))
      (local.set $i1 (i32.add (local.get $i1) (i32.const 1)))
      (br $raw)))
    (i32.const 0))

  ;; One character at a WASM address, ANSI or wide.
  (func $load_char (param $p i32) (param $wide i32) (result i32)
    (if (local.get $wide) (then (return (i32.load16_u (local.get $p)))))
    (i32.load8_u (local.get $p)))

  ;; 475: CompareStringA(Locale, dwCmpFlags, lpString1, cchCount1, lpString2, cchCount2) → int
  (func $handle_CompareStringA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; arg4 = lpString2, cchCount2 (6th arg) is still on the guest stack at esp+24
    (i32.store offset=0 (global.get $reg_base) (i32.add (i32.const 2) (call $nls_compare
      (local.get $arg2) (local.get $arg3)
      (local.get $arg4) (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
      (i32.const 0) (local.get $arg1))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))

  ;; 476: CompareStringW — same comparison, wide characters
  (func $handle_CompareStringW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.add (i32.const 2) (call $nls_compare
      (local.get $arg2) (local.get $arg3)
      (local.get $arg4) (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
      (i32.const 1) (local.get $arg1))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))

  ;; 477: IsValidLocale(Locale, dwFlags) → BOOL
  (func $handle_IsValidLocale (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; EnumSystemLocalesA, the default-locale APIs, locale data, keyboard
    ;; layout, and code pages all expose one internally consistent en-US
    ;; installation. The default aliases resolve to that same locale.
    (i32.store offset=0 (global.get $reg_base) (i32.and
        (i32.or
          (i32.eq (local.get $arg1) (i32.const 1)) ;; LCID_INSTALLED
          (i32.eq (local.get $arg1) (i32.const 2))) ;; LCID_SUPPORTED
        (i32.or
          (i32.eq (local.get $arg0) (i32.const 0x0409)) ;; en-US
          (i32.or
            (i32.eq (local.get $arg0) (i32.const 0x0400)) ;; LOCALE_USER_DEFAULT
            (i32.eq (local.get $arg0) (i32.const 0x0800)))))) ;; LOCALE_SYSTEM_DEFAULT
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; Invoke one ANSI string enumeration callback and free its temporary buffer
  ;; after the callback returns through CACA0011. The SYS1 typed context keeps
  ;; this distinct from the older saved-return-only users of that thunk.
  (func $system_string_enum_a (param $callback i32) (param $value i32)
        (param $ret_addr i32)
    (local $text i32) (local $wa i32) (local $len i32)
    (if (i32.eqz (local.get $callback))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (global.set $eip (local.get $ret_addr))
        (return)))
    (local.set $len (call $strlen_a (local.get $value)))
    (local.set $text (call $heap_alloc (i32.add (local.get $len) (i32.const 1))))
    (if (i32.eqz (local.get $text))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (global.set $eip (local.get $ret_addr))
        (return)))
    (local.set $wa (call $g2w (local.get $text)))
    (memory.copy (local.get $wa) (local.get $value) (i32.add (local.get $len) (i32.const 1)))
    ;; Context after the callback's RET 4: marker, allocation, API return.
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $ret_addr))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $text))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0x31535953)) ;; "SYS1"
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $text))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $font_enum_ret_thunk))
    (global.set $eip (local.get $callback))
    (global.set $steps (i32.const 0)))

  ;; 478: EnumSystemLocalesA(lpLocaleEnumProc, dwFlags) → BOOL. This
  ;; compatibility layer exposes one stable US-English system locale.
  (func $handle_EnumSystemLocalesA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret i32) (local $value i32)
    (local.set $ret (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
    (local.set $value (i32.const 0x2DA))
    (i32.store (local.get $value) (i32.const 0x30303030))
    (i32.store offset=4 (local.get $value) (i32.const 0x39303430))
    (i32.store8 offset=8 (local.get $value) (i32.const 0))
    (call $system_string_enum_a (local.get $arg0) (local.get $value) (local.get $ret)))

  ;; 479: GetLocaleInfoW(Locale, LCType, lpLCData, cchData) → chars written.
  ;; Same values as the A spelling, written as UTF-16 — see $locale_info.
  (func $handle_GetLocaleInfoW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $locale_info
      (local.get $arg1) (local.get $arg2) (local.get $arg3) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; 480: GetTimeZoneInformation(lpTZI). Bias is the zone GetLocalTime
  ;; answers in (UTC = local + Bias), read from the host at the moment of the
  ;; call; no daylight transition is modeled, so both SYSTEMTIME rules stay
  ;; zero and the result is TIME_ZONE_ID_UNKNOWN (0). FileTimeToLocalFileTime
  ;; and LocalFileTimeToFileTime apply the same Bias.
  (func $handle_GetTimeZoneInformation (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $guest_memset (local.get $arg0) (i32.const 0) (i32.const 172))
    (call $gs32 (local.get $arg0) (call $tz_bias_minutes))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))  ;; TIME_ZONE_ID_UNKNOWN
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; Win98 KERNEL32 ordinal 99 (ordinal-only, native RVA 0x1e260).
  ;; This is the internal timezone-cache classifier used by Explorer, not the
  ;; public GetTimeZoneInformation API.  The guest has no modeled daylight
  ;; transition, so it is always in standard time after the optional refresh.
  (func $handle_KERNEL32_Ordinal99 (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 1)) ;; TIME_ZONE_ID_STANDARD
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))) ;; ret 4
  )

  ;; 481: SetEnvironmentVariableA(lpName, lpValue) → BOOL
  (func $handle_SetEnvironmentVariableA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $env_set (local.get $arg0) (local.get $arg1) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 482: Beep — STUB: unimplemented
  (func $handle_Beep (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr))
  )

  ;; 483: GetDiskFreeSpace{A,W}(lpRoot, lpSectorsPerCluster, lpBytesPerSector,
  ;; lpFreeClusters, lpTotalClusters). What the root names decides the answer:
  ;; a mounted CD-ROM reports Win98 CDFS geometry — 2048-byte sectors, one
  ;; sector per cluster, nothing free, and the disc's own block count — because
  ;; era CD checks read exactly these numbers (Diablo XOR-folds BytesPerSector
  ;; with the drive type and the filesystem name and compares the fold against
  ;; a constant, so 512-byte sectors here read as "not a CD"). Anything else is
  ;; the fixed disk: just under 1GB free of just under 2GB at 8 sectors/cluster,
  ;; 512 bytes/sector. Keep both byte products below INT32_MAX: some Win95-era
  ;; installers multiply this legacy geometry with signed 32-bit arithmetic.
  (func $disk_free_space (param $root i32) (param $spc i32) (param $bps i32)
                         (param $free i32) (param $total i32) (param $wide i32)
    (local $root_wa i32)
    (local.set $root_wa
      (if (result i32) (local.get $root)
        (then (call $g2w (local.get $root)))
        (else (i32.const 0))))
    (if (i32.eq (call $host_fs_drive_type (local.get $root_wa) (local.get $wide))
                (i32.const 5)) ;; DRIVE_CDROM
      (then
        (if (local.get $spc) (then (call $gs32 (local.get $spc) (i32.const 1))))
        (if (local.get $bps) (then (call $gs32 (local.get $bps) (i32.const 2048))))
        (if (local.get $free) (then (call $gs32 (local.get $free) (i32.const 0))))
        (if (local.get $total)
          (then (call $gs32 (local.get $total)
            (call $host_fs_volume_size (local.get $root_wa) (local.get $wide))))))
      (else
        (if (local.get $spc) (then (call $gs32 (local.get $spc) (i32.const 8))))
        (if (local.get $bps) (then (call $gs32 (local.get $bps) (i32.const 512))))
        (if (local.get $free) (then (call $gs32 (local.get $free) (i32.const 262143))))
        (if (local.get $total) (then (call $gs32 (local.get $total) (i32.const 524287)))))))

  (func $handle_GetDiskFreeSpaceA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $disk_free_space (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))  ;; stdcall, 5 args
  )

  ;; GetDiskFreeSpaceExA(lpDirectoryName, lpFreeBytesAvailableToCaller,
  ;; lpTotalNumberOfBytes, lpTotalNumberOfFreeBytes) — the OSR2 byte-count
  ;; form of the same geometry, so both calls always agree. No quotas: the
  ;; caller's share is the whole free count. msi.dll requires this export on
  ;; any Win9x build above 1000 and fails the install when it is missing.
  ;; The shared A/W core: $wide selects how lpDirectoryName is read.
  ;; Returns 1, or 0 with last_error set.
  (func $disk_free_space_ex (param $dir i32) (param $avail i32) (param $total_out i32)
                            (param $free_out i32) (param $wide i32) (result i32)
    (local $geo i32) (local $unit i64) (local $free i64) (local $total i64)
    (local.set $geo (call $heap_alloc (i32.const 16)))
    (if (i32.eqz (local.get $geo))
      (then
        (global.set $last_error (i32.const 8)) ;; ERROR_NOT_ENOUGH_MEMORY
        (return (i32.const 0))))
    (call $disk_free_space (local.get $dir)
      (local.get $geo) (i32.add (local.get $geo) (i32.const 4))
      (i32.add (local.get $geo) (i32.const 8)) (i32.add (local.get $geo) (i32.const 12))
      (local.get $wide))
    (local.set $unit (i64.mul
      (i64.extend_i32_u (call $gl32 (local.get $geo)))
      (i64.extend_i32_u (call $gl32 (i32.add (local.get $geo) (i32.const 4))))))
    (local.set $free (i64.mul (local.get $unit)
      (i64.extend_i32_u (call $gl32 (i32.add (local.get $geo) (i32.const 8))))))
    (local.set $total (i64.mul (local.get $unit)
      (i64.extend_i32_u (call $gl32 (i32.add (local.get $geo) (i32.const 12))))))
    (call $heap_free (local.get $geo))
    (if (local.get $avail) (then (call $gs64 (local.get $avail) (local.get $free))))
    (if (local.get $total_out) (then (call $gs64 (local.get $total_out) (local.get $total))))
    (if (local.get $free_out) (then (call $gs64 (local.get $free_out) (local.get $free))))
    (i32.const 1))

  (func $handle_GetDiskFreeSpaceExA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $disk_free_space_ex
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))  ;; stdcall, 4 args
  )

  ;; GetDiskFreeSpaceExW: the same answer for a wide path. The Movies demo
  ;; checks the space on its drive with it right after its first-run notice.
  (func $handle_GetDiskFreeSpaceExW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $disk_free_space_ex
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))  ;; stdcall, 4 args
  )

  ;; 484: GetLogicalDrives() — one bit per currently assigned drive letter.
  (func $handle_GetLogicalDrives (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_fs_logical_drive_mask))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))  ;; stdcall, 0 args
  )

  ;; GetLogicalDriveStringsA/W returns each assigned root plus one final NUL.
  ;; The required size includes that final NUL; a successful return excludes it.
  (func $logical_drive_strings
        (param $length i32) (param $buffer_g i32) (param $wide i32) (result i32)
    (local $mask i32) (local $letter i32) (local $count i32)
    (local $required i32) (local $buf i32) (local $out i32) (local $stride i32)
    (local.set $mask (call $host_fs_logical_drive_mask))
    (local.set $letter (i32.const 0))
    (block $count_done (loop $count_loop
      (br_if $count_done (i32.ge_u (local.get $letter) (i32.const 26)))
      (if (i32.and (local.get $mask) (i32.shl (i32.const 1) (local.get $letter)))
        (then (local.set $count (i32.add (local.get $count) (i32.const 1)))))
      (local.set $letter (i32.add (local.get $letter) (i32.const 1)))
      (br $count_loop)))
    (local.set $required (i32.add (i32.mul (local.get $count) (i32.const 4)) (i32.const 1)))
    (if (i32.lt_u (local.get $length) (local.get $required))
      (then (return (local.get $required))))
    (if (i32.eqz (local.get $buffer_g))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (return (i32.const 0))))
    (local.set $buf (call $g2w (local.get $buffer_g)))
    (local.set $stride (select (i32.const 2) (i32.const 1) (local.get $wide)))
    (local.set $letter (i32.const 0))
    (block $write_done (loop $write_loop
      (br_if $write_done (i32.ge_u (local.get $letter) (i32.const 26)))
      (if (i32.and (local.get $mask) (i32.shl (i32.const 1) (local.get $letter)))
        (then
          (if (local.get $wide)
            (then
              (i32.store16 (i32.add (local.get $buf) (local.get $out))
                (i32.add (i32.const 0x41) (local.get $letter)))
              (i32.store16 (i32.add (local.get $buf) (i32.add (local.get $out) (i32.const 2))) (i32.const 0x3A))
              (i32.store16 (i32.add (local.get $buf) (i32.add (local.get $out) (i32.const 4))) (i32.const 0x5C))
              (i32.store16 (i32.add (local.get $buf) (i32.add (local.get $out) (i32.const 6))) (i32.const 0)))
            (else
              (i32.store8 (i32.add (local.get $buf) (local.get $out))
                (i32.add (i32.const 0x41) (local.get $letter)))
              (i32.store8 (i32.add (local.get $buf) (i32.add (local.get $out) (i32.const 1))) (i32.const 0x3A))
              (i32.store8 (i32.add (local.get $buf) (i32.add (local.get $out) (i32.const 2))) (i32.const 0x5C))
              (i32.store8 (i32.add (local.get $buf) (i32.add (local.get $out) (i32.const 3))) (i32.const 0))))
          (local.set $out (i32.add (local.get $out) (i32.mul (i32.const 4) (local.get $stride))))))
      (local.set $letter (i32.add (local.get $letter) (i32.const 1)))
      (br $write_loop)))
    (if (local.get $wide)
      (then (i32.store16 (i32.add (local.get $buf) (local.get $out)) (i32.const 0)))
      (else (i32.store8 (i32.add (local.get $buf) (local.get $out)) (i32.const 0))))
    (i32.sub (local.get $required) (i32.const 1)))

  (func $handle_GetLogicalDriveStringsA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $logical_drive_strings (local.get $arg0) (local.get $arg1) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))  ;; stdcall, 2 args
  )

  (func $handle_GetLogicalDriveStringsW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $logical_drive_strings (local.get $arg0) (local.get $arg1) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; GetKeyboardType(nTypeFlag) → int. Enhanced 101/102-key (type 4, 12 func keys).
  ;; nTypeFlag: 0=type, 1=subtype, 2=num func keys. Unsupported selectors fail
  ;; with zero; they must not accidentally look like another type query.
  (func $handle_GetKeyboardType (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (if (result i32) (i32.eq (local.get $arg0) (i32.const 0))
        (then (i32.const 4))
        (else
          (if (result i32) (i32.eq (local.get $arg0) (i32.const 2))
            (then (i32.const 12))
            (else (i32.const 0))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; GetKeyboardLayout(idThread) → HKL. Return US English (0x04090409, device+lang both en-US).
  (func $handle_GetKeyboardLayout (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x04090409))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; CreateIconFromResourceEx(presbits, dwResSize, fIcon, dwVer, cx, cy, Flags)
  ;; — 7 args. Decode the packed RT_ICON/RT_CURSOR bytes into an owned
  ;; CURSOR_TABLE object, preserving Win9x LOCALHEADER hotspots and requested
  ;; sizing. The handle then works with SetCursor, GetIconInfo and DestroyIcon.
  (func $handle_CreateIconFromResourceEx (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $cursor_create_from_resource
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)
      (local.get $arg4)
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))))
    (if (i32.load offset=0 (global.get $reg_base))
      (then (global.set $last_error (i32.const 0)))
      (else (global.set $last_error (i32.const 13)))) ;; ERROR_INVALID_DATA
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
  )

  ;; LookupIconIdFromDirectoryEx(presbits, fIcon, cxDesired, cyDesired, Flags)
  ;; selects an RT_ICON/RT_CURSOR id from a packed GRPICONDIR. SHELL32 uses
  ;; this while reopening shell32.dll's authentic group-icon resources; the
  ;; returned WORD is a resource id, not an HICON. Prefer the closest geometry
  ;; and, for equally sized images, the greatest available color depth.
  (func $handle_LookupIconIdFromDirectoryEx (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $count i32) (local $i i32) (local $entry i32)
    (local $want_w i32) (local $want_h i32) (local $w i32) (local $h i32)
    (local $dw i32) (local $dh i32) (local $score i32) (local $best_score i32)
    (local $bpp i32) (local $best_bpp i32) (local $best_id i32)
    (local.set $best_score (i32.const 0x7fffffff))
    (if (i32.or (i32.eqz (local.get $arg0))
          (i32.ne (call $gl16 (local.get $arg0)) (i32.const 0)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    (if (i32.or
          (i32.and (local.get $arg1)
            (i32.ne (call $gl16 (i32.add (local.get $arg0) (i32.const 2)))
                    (i32.const 1)))
          (i32.and (i32.eqz (local.get $arg1))
            (i32.ne (call $gl16 (i32.add (local.get $arg0) (i32.const 2)))
                    (i32.const 2))))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    (local.set $count (call $gl16 (i32.add (local.get $arg0) (i32.const 4))))
    (local.set $want_w (local.get $arg2))
    (local.set $want_h (local.get $arg3))
    (if (i32.eqz (local.get $want_w)) (then (local.set $want_w (i32.const 32))))
    (if (i32.eqz (local.get $want_h)) (then (local.set $want_h (i32.const 32))))
    (local.set $entry (i32.add (local.get $arg0) (i32.const 6)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $w (call $gl8 (local.get $entry)))
      (local.set $h (call $gl8 (i32.add (local.get $entry) (i32.const 1))))
      ;; ICO encodes 256 pixels as a zero byte.
      (if (i32.eqz (local.get $w)) (then (local.set $w (i32.const 256))))
      (if (i32.eqz (local.get $h)) (then (local.set $h (i32.const 256))))
      (local.set $bpp (call $gl16 (i32.add (local.get $entry) (i32.const 6))))
      (local.set $dw (i32.sub (local.get $w) (local.get $want_w)))
      (if (i32.lt_s (local.get $dw) (i32.const 0))
        (then (local.set $dw (i32.sub (i32.const 0) (local.get $dw)))))
      (local.set $dh (i32.sub (local.get $h) (local.get $want_h)))
      (if (i32.lt_s (local.get $dh) (i32.const 0))
        (then (local.set $dh (i32.sub (i32.const 0) (local.get $dh)))))
      (local.set $score (i32.add (local.get $dw) (local.get $dh)))
      (if (i32.or
            (i32.lt_u (local.get $score) (local.get $best_score))
            (i32.and (i32.eq (local.get $score) (local.get $best_score))
                     (i32.gt_u (local.get $bpp) (local.get $best_bpp))))
        (then
          (local.set $best_score (local.get $score))
          (local.set $best_bpp (local.get $bpp))
          (local.set $best_id (call $gl16
            (i32.add (local.get $entry) (i32.const 12))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (local.set $entry (i32.add (local.get $entry) (i32.const 14)))
      (br $scan)))
    (i32.store offset=0 (global.get $reg_base) (local.get $best_id))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
  )

  ;; LoadKeyboardLayoutA(pwszKLID, Flags). This browser machine exposes one
  ;; installed layout, US English. Windows accepts an eight-hex-digit KLID and
  ;; falls back to the system default when no matching layout is available.
  (func $handle_LoadKeyboardLayoutA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $p i32) (local $i i32)
    (if (i32.eqz (local.get $arg0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    ;; Keep the guest address while validating KL_NAMELENGTH: adjacent bytes
    ;; can cross noncontiguous backing pages. Read eight hex bytes then NUL.
    (local.set $p (local.get $arg0))
    (block $valid (loop $digit
      (br_if $valid (i32.ge_u (local.get $i) (i32.const 8)))
      (if (i32.lt_s
            (call $hex_digit_value
              (call $gl8 (i32.add (local.get $p) (local.get $i))))
            (i32.const 0))
        (then
          (i32.store offset=0 (global.get $reg_base) (i32.const 0))
          (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
          (return)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $digit)))
    (if (call $gl8 (i32.add (local.get $p) (i32.const 8)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x04090409))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; GetKeyboardLayoutNameA(pwszKLID) — write 9-byte ASCIIZ "00000409" (US English) and return TRUE.
  (func $handle_GetKeyboardLayoutNameA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $p i32)
    (if (i32.eqz (local.get $arg0))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))) (return)))
    (local.set $p (local.get $arg0))
    (call $gs32 (local.get $p) (i32.const 0x30303030))         ;; "0000"
    (call $gs32 (i32.add (local.get $p) (i32.const 4)) (i32.const 0x39303430)) ;; "0409"
    (call $gs8 (i32.add (local.get $p) (i32.const 8)) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; GetKeyboardLayoutList(nBuff, lpList) — report one layout (US English).
  ;; If lpList non-NULL and nBuff>=1, write HKL 0x04090409. Return total count (1).
  (func $handle_GetKeyboardLayoutList (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.and (i32.ne (local.get $arg1) (i32.const 0)) (i32.ge_s (local.get $arg0) (i32.const 1)))
      (then (call $gs32 (local.get $arg1) (i32.const 0x04090409))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; GetTextCharacterExtra(hdc) → int. Inter-character spacing (0 = default).
  (func $handle_GetTextCharacterExtra (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $gdi_dc_aux_get (local.get $arg0) (i32.const 20) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; 485: GetFileAttributesA — STUB: unimplemented
  (func $handle_GetFileAttributesA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $attrs i32)
    ;; GetFileAttributesA(lpFileName) — 1 arg
    (local.set $attrs (call $host_fs_get_file_attributes
      (call $g2w (local.get $arg0)) (i32.const 0)))
    (i32.store offset=0 (global.get $reg_base) (local.get $attrs))
    (if (i32.eq (local.get $attrs) (i32.const -1))
      (then (global.set $last_error (i32.const 2)))) ;; ERROR_FILE_NOT_FOUND
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 486: GetCurrentDirectoryA — STUB: unimplemented
  (func $handle_GetCurrentDirectoryA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; GetCurrentDirectoryA(nBufferLength, lpBuffer) — 2 args
    (i32.store offset=0 (global.get $reg_base) (call $host_fs_get_current_directory
      (local.get $arg0) (local.get $arg1) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 487: SetCurrentDirectoryA — STUB: unimplemented
  (func $handle_SetCurrentDirectoryA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; SetCurrentDirectoryA(lpPathName) — 1 arg
    (i32.store offset=0 (global.get $reg_base) (call $host_fs_set_current_directory
      (call $g2w (local.get $arg0)) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 488: SetFileAttributesA — STUB: unimplemented
  (func $handle_SetFileAttributesA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; SetFileAttributesA(lpFileName, dwFileAttributes) — 2 args
    (i32.store offset=0 (global.get $reg_base) (call $fs_path_result
      (call $host_fs_set_file_attributes (call $g2w (local.get $arg0)) (local.get $arg1) (i32.const 0))
      (local.get $arg0) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 489: GetFullPathNameA — STUB: unimplemented
  (func $handle_GetFullPathNameA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; GetFullPathNameA(lpFileName, nBufferLength, lpBuffer, lpFilePart) — 4 args
    (i32.store offset=0 (global.get $reg_base) (call $host_fs_get_full_path_name
      (call $g2w (local.get $arg0)) (local.get $arg1) (local.get $arg2) (local.get $arg3) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; GetDriveType{A,W}(lpRootPathName). The Win98 environment advertises only
  ;; fixed C: and CD-ROM D:. Installers enumerate letters independently of
  ;; GetLogicalDrives, so reporting every other letter as fixed makes them pick
  ;; the nonexistent A: drive as their default destination.
  ;; A mounted volume owns its letter, so ask the host before falling back to
  ;; that built-in map: an ISO mounted at D:\ reports DRIVE_CDROM from its own
  ;; mount record, and a mount at any other letter is answered too. 0 means no
  ;; mount claims the letter.
  (func $drive_type (param $root_g i32) (param $wide i32) (result i32)
    (local $drive i32) (local $mounted i32)
    (local.set $mounted (call $host_fs_drive_type
      (if (result i32) (local.get $root_g)
        (then (call $g2w (local.get $root_g)))
        (else (i32.const 0)))
      (local.get $wide)))
    (if (local.get $mounted) (then (return (local.get $mounted))))
    (if (i32.eqz (local.get $root_g)) (then (return (i32.const 3))))
    (if (i32.ne
          (call $gl_char
            (i32.add (local.get $root_g)
              (select (i32.const 2) (i32.const 1) (local.get $wide)))
            (local.get $wide))
          (i32.const 0x3A))
      (then (return (i32.const 1)))) ;; DRIVE_NO_ROOT_DIR
    (local.set $drive
      (i32.and (call $gl_char (local.get $root_g) (local.get $wide))
        (i32.const 0xDF)))
    (if (i32.eq (local.get $drive) (i32.const 0x43))
      (then (return (i32.const 3)))) ;; DRIVE_FIXED
    (if (i32.eq (local.get $drive) (i32.const 0x44))
      (then (return (i32.const 5)))) ;; DRIVE_CDROM
    (i32.const 1)) ;; DRIVE_NO_ROOT_DIR

  (func $handle_GetDriveTypeA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $drive_type (local.get $arg0) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; 491: GetCurrentProcessId — return this emulated process's stable PID
  (func $handle_GetCurrentProcessId (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $current_process_id))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; 492: CreateDirectoryA — STUB: unimplemented
  (func $handle_CreateDirectoryA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $path_wa i32)
    (local.set $path_wa (call $g2w (local.get $arg0)))
    ;; CreateDirectoryA(lpPathName, lpSecurityAttributes) — 2 args
    (i32.store offset=0 (global.get $reg_base) (call $host_fs_create_directory
      (local.get $path_wa) (i32.const 0)))
    (if (i32.load offset=0 (global.get $reg_base))
      (then (global.set $last_error (i32.const 0)))
      (else
        (global.set $last_error
          (if (result i32)
            (i32.ne (call $host_fs_get_file_attributes
              (local.get $path_wa) (i32.const 0)) (i32.const -1))
            (then (i32.const 183)) ;; ERROR_ALREADY_EXISTS
            (else (i32.const 5)))))) ;; ERROR_ACCESS_DENIED
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 493: RemoveDirectoryA — STUB: unimplemented
  (func $handle_RemoveDirectoryA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; RemoveDirectoryA(lpPathName) — 1 arg
    (i32.store offset=0 (global.get $reg_base) (call $host_fs_remove_directory
      (call $g2w (local.get $arg0)) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 494: SetCurrentDirectoryW — STUB: unimplemented
  (func $handle_SetCurrentDirectoryW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; SetCurrentDirectoryW(lpPathName) — 1 arg
    (i32.store offset=0 (global.get $reg_base) (call $host_fs_set_current_directory
      (call $g2w (local.get $arg0)) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 495: RemoveDirectoryW — STUB: unimplemented
  (func $handle_RemoveDirectoryW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; RemoveDirectoryW(lpPathName) — 1 arg
    (i32.store offset=0 (global.get $reg_base) (call $host_fs_remove_directory
      (call $g2w (local.get $arg0)) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 496: GetDriveTypeW — Unicode counterpart of GetDriveTypeA.
  (func $handle_GetDriveTypeW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $drive_type (local.get $arg0) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 497: MoveFileA — STUB: unimplemented
  (func $handle_MoveFileA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; MoveFileA(lpExistingFileName, lpNewFileName) — 2 args
    (i32.store offset=0 (global.get $reg_base) (call $host_fs_move_file
      (call $g2w (local.get $arg0)) (call $g2w (local.get $arg1)) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 498: GetExitCodeProcess — STUB: unimplemented
  (func $handle_GetExitCodeProcess (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; A child CreateProcess started (09d7-pipes.wat): the host knows.
    (if (call $pipe_child_pid (local.get $arg0))
      (then
        (local.set $arg2 (call $host_process_ctl (i32.const 0)
          (call $pipe_child_pid (local.get $arg0)) (i32.const 0)))
        (if (i32.eq (local.get $arg2) (i32.const -1))
          (then
            (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
            (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
          (else
            (if (local.get $arg1) (then (call $gs32 (local.get $arg1) (local.get $arg2))))
            (i32.store offset=0 (global.get $reg_base) (i32.const 1))))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (if (local.get $arg1)
      (then (call $gs32 (local.get $arg1)
        (if (result i32)
          (i32.eq (local.get $arg0)
            (i32.or (i32.const 0x000E2000)
              (i32.and (call $current_process_id) (i32.const 0xFFF))))
          (then (i32.const 259))  ;; STILL_ACTIVE
          (else (i32.const 0))))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))) ;; stdcall, 2 args
  )

  ;; The arguments of a command line: what follows its program-name token,
  ;; with the separating whitespace skipped. The token is read the way the
  ;; C runtime reads argv[0]: from an opening quote to the next quote, or else
  ;; up to the first space/tab -- so a line that starts with whitespace has an
  ;; EMPTY program name, and " -deleter " (InstallShield's child setup) has the
  ;; argument "-deleter ". Returns a guest pointer into the same string.
  (func $cmdline_args_ptr (param $cmd i32) (result i32)
    (local $p i32) (local $c i32)
    (local.set $p (local.get $cmd))
    (if (i32.eq (call $gl8 (local.get $p)) (i32.const 0x22)) ;; '"'
      (then
        (local.set $p (i32.add (local.get $p) (i32.const 1)))
        (block $q_done (loop $q
          (local.set $c (call $gl8 (local.get $p)))
          (br_if $q_done (i32.eqz (local.get $c)))
          (local.set $p (i32.add (local.get $p) (i32.const 1)))
          (br_if $q_done (i32.eq (local.get $c) (i32.const 0x22)))
          (br $q))))
      (else
        (block $t_done (loop $t
          (local.set $c (call $gl8 (local.get $p)))
          (br_if $t_done (i32.or (i32.eqz (local.get $c))
            (i32.or (i32.eq (local.get $c) (i32.const 0x20)) (i32.eq (local.get $c) (i32.const 0x09)))))
          (local.set $p (i32.add (local.get $p) (i32.const 1)))
          (br $t)))))
    (block $s_done (loop $s
      (local.set $c (call $gl8 (local.get $p)))
      (br_if $s_done (i32.eqz (i32.or (i32.eq (local.get $c) (i32.const 0x20)) (i32.eq (local.get $c) (i32.const 0x09)))))
      (local.set $p (i32.add (local.get $p) (i32.const 1)))
      (br $s)))
    (local.get $p))

  ;; 499: CreateProcessA — STUB: unimplemented
  (func $handle_CreateProcessA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $pi i32) (local $launch_file i32) (local $launch_dir i32) (local $launch_result i32)
    (local $launch_params i32)
    ;; Browser hosts can chain-launch an EXE from the caller's VFS through the
    ;; same handoff ShellExecute uses. Headless hosts keep returning success,
    ;; which models the launch boundary for installer extraction tests.
    (local.set $launch_file (if (result i32) (local.get $arg0)
      (then (local.get $arg0))
      (else (local.get $arg1))))
    (local.set $launch_dir (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32))))
    (if (i32.eqz (local.get $launch_file))
      (then
        (global.set $last_error (i32.const 2)) ;; ERROR_FILE_NOT_FOUND
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 44)))
        (return)))
    ;; A real child process when the host can start one: always for
    ;; redirected standard handles (bInheritHandles + STARTF_USESTDHANDLES
    ;; naming inheritable pipe ends), and for every launch on a host that runs
    ;; children for CreateProcess (09d7-pipes.wat). Otherwise this falls
    ;; through unchanged.
    (if (call $pipe_create_process
          (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36)))
          (local.get $arg0) (local.get $arg1) (local.get $arg4) (local.get $launch_dir)
          (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 40))))
      (then
        (global.set $last_error (i32.const 0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 44)))
        (return)))
    ;; lpApplicationName names the program; lpCommandLine is then the whole
    ;; command line the child sees, program token first. Hand the shell the
    ;; program and the arguments separately -- dropping lpCommandLine here
    ;; sent InstallShield's child setup.exe off without "-deleter". Without an
    ;; application name the command line goes as the file, and the host splits
    ;; its program token off as before.
    (if (i32.and (i32.ne (local.get $arg0) (i32.const 0)) (i32.ne (local.get $arg1) (i32.const 0)))
      (then (local.set $launch_params (call $cmdline_args_ptr (local.get $arg1)))))
    (local.set $launch_result (call $host_shell_execute
      (i32.const 0) (i32.const 0)
      (call $g2w (local.get $launch_file))
      (if (result i32) (local.get $launch_params)
        (then (call $g2w (local.get $launch_params))) (else (i32.const 0)))
      (if (result i32) (local.get $launch_dir) (then (call $g2w (local.get $launch_dir))) (else (i32.const 0)))
      (i32.const 1)))
    (if (i32.le_u (local.get $launch_result) (i32.const 32))
      (then
        (global.set $last_error
          (if (result i32) (local.get $launch_result)
            (then (local.get $launch_result))
            (else (i32.const 2))))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 44)))
        (return)))
    (local.set $pi (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 40))))
    (if (local.get $pi)
      (then
        (call $gs32 (local.get $pi) (i32.const 0x000E3001))       ;; hProcess
        (call $gs32 (i32.add (local.get $pi) (i32.const 4)) (i32.const 0x000E3002)) ;; hThread
        (call $gs32 (i32.add (local.get $pi) (i32.const 8)) (i32.const 0x3001))     ;; dwProcessId
        (call $gs32 (i32.add (local.get $pi) (i32.const 12)) (i32.const 0x3002))))  ;; dwThreadId
    (drop (local.get $arg0))
    (drop (local.get $arg1))
    (drop (local.get $arg2))
    (drop (local.get $arg3))
    (drop (local.get $arg4))
    (drop (local.get $name_ptr))
    (global.set $last_error (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 44))) ;; stdcall, 10 args
  )

  ;; WinExec(lpCmdLine, uCmdShow) — legacy launcher. Pinball's Options →
  ;; Select Table and Win9x installers expect a real child-launch attempt.
  ;; Mark this call so the browser host applies WinExec parsing/error rules.
  (func $handle_WinExec (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_shell_execute
      (i32.const 0) (local.get $name_ptr)
      (if (result i32) (local.get $arg0) (then (call $g2w (local.get $arg0))) (else (i32.const 0)))
      (i32.const 0) (i32.const 0) (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; LoadModule(lpModuleName, lpParameterBlock) -> an instance handle above 31,
  ;; or a DOS error code below it. WinExec's older twin, kept in KERNEL32 for
  ;; ports of 16-bit code, and still imported by them: Pitfall (1997) builds
  ;; `\DISPDIB.DLL` in a stack buffer and asks for it here, having already said
  ;; it wants 256-colour mode. DISPDIB is the Video for Windows full-screen DIB
  ;; driver, which this machine does not have — and 2, ERROR_FILE_NOT_FOUND, is
  ;; what Windows answers for a module that is not there. That is a real
  ;; answer, not a stub: the caller is asking whether a facility exists, and no
  ;; is the truth here, which is why it then falls back to ordinary GDI.
  ;;
  ;; A module that does exist is launched through the same shell boundary
  ;; WinExec uses, so the two cannot disagree about what launching means.
  (func $handle_LoadModule (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $esp i32) (local $attr i32) (local $show i32) (local $show_ptr i32)
    ;; DISPDIB is a built-in surface of ours (09d5-dispdib.wat), not a file on
    ;; the disk: a caller LoadModule()s it and then talks to the window class
    ;; it registers. Answer what Windows answers for a module that loaded, an
    ;; instance handle above 32, before the file test below can refuse it.
    ;; A program that instead *stats* the DLL still sees nothing there, which
    ;; is a real gap and is recorded in the re-notes rather than papered over.
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (if (call $dispdib_is_module_path (local.get $arg0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x2000))
        (i32.store offset=16 (global.get $reg_base) (i32.add (local.get $esp) (i32.const 12)))
        (return)))
    ;; GetFileAttributesA is a one-argument handler and pops its own frame, so
    ;; its stack adjustment is not ours; take the answer and put ESP back.
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_GetFileAttributesA (local.get $arg0) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (local.set $attr (i32.load offset=0 (global.get $reg_base)))
    (i32.store offset=16 (global.get $reg_base) (local.get $esp))
    (if (i32.eq (local.get $attr) (i32.const -1))
      (then
        (global.set $last_error (i32.const 2))
        (i32.store offset=0 (global.get $reg_base) (i32.const 2))
        (i32.store offset=16 (global.get $reg_base)
          (i32.add (local.get $esp) (i32.const 12)))
        (return)))
    ;; LOADPARMS32 { WORD segEnv; LPSTR lpCmdLine; WORD *lpCmdShow; DWORD }.
    ;; lpCmdShow points at two words, the second of which is the show command;
    ;; without a block the module gets an ordinary window.
    (local.set $show (i32.const 1))
    (if (local.get $arg1)
      (then
        (local.set $show_ptr (call $gl32 (i32.add (local.get $arg1) (i32.const 8))))
        (if (local.get $show_ptr)
          (then (local.set $show
            (call $gl16 (i32.add (local.get $show_ptr) (i32.const 2))))))))
    ;; Same arity as WinExec, so its own stdcall adjustment is the right one.
    (call $handle_WinExec (local.get $arg0) (local.get $show) (i32.const 0)
      (i32.const 0) (i32.const 0) (local.get $name_ptr))
  )

  ;; 500: CreateProcessW — STUB: unimplemented
  (func $handle_CreateProcessW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $app i32) (local $cmd i32) (local $dir i32) (local $dir_w i32)
    (local.set $app (call $shellexec_narrow_w (local.get $arg0)))
    (local.set $cmd (call $shellexec_narrow_w (local.get $arg1)))
    (local.set $dir_w (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32))))
    (local.set $dir (call $shellexec_narrow_w (local.get $dir_w)))
    (if (local.get $dir)
      (then (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)) (local.get $dir))))
    (call $handle_CreateProcessA
      (local.get $app) (local.get $cmd) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
    (if (local.get $app) (then (call $heap_free (local.get $app))))
    (if (local.get $cmd) (then (call $heap_free (local.get $cmd))))
    (if (local.get $dir) (then (call $heap_free (local.get $dir))))
  )

  ;; Prove that a guest pointer names an exact allocator block boundary. The
  ;; header at ptr-4 is not evidence by itself: an interior pointer can have a
  ;; plausible aligned dword planted in the caller's payload. Start at the
  ;; authoritative arena base and follow each extent until the requested
  ;; header is reached. Return its aligned size (including the header), or zero
  ;; for an interior, unmapped, malformed, or stale pointer.
  (func $heap_validate_exact_block (param $guest_ptr i32) (result i32)
    (local $block i32) (local $rec i32) (local $cur i32)
    (local $allocated_end i32) (local $reserved_end i32)
    (local $wa i32) (local $raw i32) (local $size i32) (local $next i32)
    (if (i32.or
          (i32.lt_u (local.get $guest_ptr) (i32.const 4))
          (i32.ne (i32.and (local.get $guest_ptr) (i32.const 7)) (i32.const 4)))
      (then (return (i32.const 0))))
    (local.set $block (i32.sub (local.get $guest_ptr) (i32.const 4)))
    (local.set $rec (call $heap_arena_find (local.get $block)))
    (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
    (local.set $cur (i32.atomic.load (local.get $rec)))
    (local.set $reserved_end (i32.load offset=4 (local.get $rec)))
    (local.set $allocated_end (i32.atomic.load offset=8 (local.get $rec)))
    (block $invalid (loop $walk
      (br_if $invalid (i32.ge_u (local.get $cur) (local.get $allocated_end)))
      (br_if $invalid (i32.gt_u (local.get $cur) (local.get $block)))
      (local.set $wa (call $g2w (local.get $cur)))
      (local.set $raw (i32.atomic.load (local.get $wa)))
      ;; Bit zero is GlobalAlloc's live tag; bits 1..2 are always malformed.
      (br_if $invalid (i32.ne (i32.and (local.get $raw) (i32.const 6)) (i32.const 0)))
      (local.set $size (i32.and (local.get $raw) (i32.const -8)))
      (br_if $invalid (i32.lt_u (local.get $size) (i32.const 16)))
      (local.set $next (i32.add (local.get $cur) (local.get $size)))
      (br_if $invalid (i32.le_u (local.get $next) (local.get $cur)))
      (br_if $invalid (i32.gt_u (local.get $next) (local.get $allocated_end)))
      (br_if $invalid (i32.gt_u (local.get $next) (local.get $reserved_end)))
      (if (i32.eq (local.get $cur) (local.get $block))
        (then (return (local.get $size))))
      (br_if $invalid (i32.gt_u (local.get $next) (local.get $block)))
      (local.set $cur (local.get $next))
      (br $walk)))
    (i32.const 0))

  ;; A block header remains structurally valid after free, so exact-boundary
  ;; validation alone would accept it. Walk this instance's allocator list to
  ;; prove the requested block is absent. The list is itself guest-writable;
  ;; malformed links and cycles make the proof fail rather than reaching g2w
  ;; through an unchecked address or spinning forever.
  (func $heap_validate_free_list_excludes (param $target i32) (result i32)
    (local $cur i32) (local $raw i32) (local $steps i32)
    (call $heap_bins_flush)
    (local.set $cur (global.get $free_list))
    (block $valid (loop $walk
      (br_if $valid (i32.eqz (local.get $cur)))
      (local.set $steps (i32.add (local.get $steps) (i32.const 1)))
      (if (i32.gt_u (local.get $steps) (i32.const 65536))
        (then (return (i32.const 0))))
      (if (i32.eqz
            (call $heap_validate_exact_block
              (i32.add (local.get $cur) (i32.const 4))))
        (then (return (i32.const 0))))
      (local.set $raw (i32.atomic.load (call $g2w (local.get $cur))))
      ;; Free blocks have an untagged aligned extent.
      (if (i32.ne (i32.and (local.get $raw) (i32.const 7)) (i32.const 0))
        (then (return (i32.const 0))))
      (if (i32.eq (local.get $cur) (local.get $target))
        (then (return (i32.const 0))))
      (local.set $cur (i32.load offset=4 (call $g2w (local.get $cur))))
      (br $walk)))
    (i32.const 1))

  ;; Arena live-byte accounting is shared across Worker instances, while each
  ;; instance owns a private free-list head. If another instance owns a free
  ;; block in this arena, its header is indistinguishable from a live header to
  ;; this instance. In that case do not guess: only call a target live when the
  ;; shared live-byte count plus every locally provable free extent accounts
  ;; for the entire published block chain. This can conservatively reject a
  ;; live neighbor of a cross-instance free, but it cannot bless that freed
  ;; block as allocated.
  (func $heap_validate_arena_accounts_live
      (param $rec i32) (param $target i32) (result i32)
    (local $base i32) (local $allocated_end i32) (local $total i32)
    (local $live i32) (local $free i32) (local $cur i32)
    (local $cur_rec i32) (local $size i32) (local $steps i32)
    (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
    (local.set $base (i32.atomic.load (local.get $rec)))
    (local.set $allocated_end (i32.atomic.load offset=8 (local.get $rec)))
    (if (i32.lt_u (local.get $allocated_end) (local.get $base))
      (then (return (i32.const 0))))
    (local.set $total (i32.sub (local.get $allocated_end) (local.get $base)))
    (local.set $live (i32.atomic.load offset=12 (local.get $rec)))
    (if (i32.gt_u (local.get $live) (local.get $total))
      (then (return (i32.const 0))))
    (call $heap_bins_flush)
    (local.set $cur (global.get $free_list))
    (block $list_done (loop $list
      (br_if $list_done (i32.eqz (local.get $cur)))
      (local.set $steps (i32.add (local.get $steps) (i32.const 1)))
      (if (i32.gt_u (local.get $steps) (i32.const 65536))
        (then (return (i32.const 0))))
      (local.set $size (call $heap_validate_exact_block
        (i32.add (local.get $cur) (i32.const 4))))
      (if (i32.eqz (local.get $size)) (then (return (i32.const 0))))
      (if (i32.ne
            (i32.and (i32.atomic.load (call $g2w (local.get $cur))) (i32.const 7))
            (i32.const 0))
        (then (return (i32.const 0))))
      (local.set $cur_rec (call $heap_arena_find (local.get $cur)))
      (if (i32.eq (local.get $cur) (local.get $target))
        (then (return (i32.const 0))))
      (if (i32.eq (local.get $cur_rec) (local.get $rec))
        (then
          (if (i32.lt_u (i32.add (local.get $free) (local.get $size)) (local.get $free))
            (then (return (i32.const 0))))
          (local.set $free (i32.add (local.get $free) (local.get $size)))))
      (local.set $cur (i32.load offset=4 (call $g2w (local.get $cur))))
      (br $list)))
    (if (i32.lt_u (i32.add (local.get $live) (local.get $free)) (local.get $live))
      (then (return (i32.const 0))))
    (i32.eq (i32.add (local.get $live) (local.get $free)) (local.get $total)))

  (func $heap_validate_live_block (param $guest_ptr i32) (result i32)
    (local $block i32) (local $rec i32)
    (if (i32.eqz (call $heap_validate_exact_block (local.get $guest_ptr)))
      (then (return (i32.const 0))))
    (local.set $block (i32.sub (local.get $guest_ptr) (i32.const 4)))
    (local.set $rec (call $heap_arena_find (local.get $block)))
    (call $heap_validate_arena_accounts_live (local.get $rec) (local.get $block)))

  ;; Validate every published arena and every block extent the current
  ;; allocator can observe. Private HeapCreate handles share this one process
  ;; allocator in our model, so whole-heap validation is intentionally the same
  ;; structural scan for either kind of recognized heap handle.
  (func $heap_validate_all_arenas (result i32)
    (local $count i32) (local $i i32) (local $rec i32)
    (local $base i32) (local $reserved_end i32) (local $allocated_end i32)
    (local $cur i32) (local $raw i32) (local $size i32) (local $next i32)
    (local $steps i32)
    (local.set $count (i32.atomic.load (global.get $HEAP_ARENAS)))
    (if (i32.gt_u (local.get $count) (i32.const 1024))
      (then (return (i32.const 0))))
    (block $arenas_done (loop $arena
      (br_if $arenas_done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $rec (i32.add (global.get $HEAP_ARENAS)
        (i32.add (i32.const 16) (i32.mul (local.get $i) (i32.const 16)))))
      (local.set $base (i32.atomic.load (local.get $rec)))
      (if (local.get $base) (then
        (local.set $reserved_end (i32.load offset=4 (local.get $rec)))
        (local.set $allocated_end (i32.atomic.load offset=8 (local.get $rec)))
        (if (i32.or
              (i32.ne (i32.and (local.get $base) (i32.const 7)) (i32.const 0))
              (i32.or
                (i32.le_u (local.get $reserved_end) (local.get $base))
                (i32.or
                  (i32.lt_u (local.get $allocated_end) (local.get $base))
                  (i32.gt_u (local.get $allocated_end) (local.get $reserved_end)))))
          (then (return (i32.const 0))))
        (local.set $cur (local.get $base))
        (local.set $steps (i32.const 0))
        (block $blocks_done (loop $block
          (br_if $blocks_done (i32.eq (local.get $cur) (local.get $allocated_end)))
          (if (i32.gt_u (local.get $cur) (local.get $allocated_end))
            (then (return (i32.const 0))))
          (local.set $steps (i32.add (local.get $steps) (i32.const 1)))
          (if (i32.gt_u (local.get $steps) (i32.const 65536))
            (then (return (i32.const 0))))
          (local.set $raw (i32.atomic.load (call $g2w (local.get $cur))))
          (if (i32.ne (i32.and (local.get $raw) (i32.const 6)) (i32.const 0))
            (then (return (i32.const 0))))
          (local.set $size (i32.and (local.get $raw) (i32.const -8)))
          (if (i32.lt_u (local.get $size) (i32.const 16))
            (then (return (i32.const 0))))
          (local.set $next (i32.add (local.get $cur) (local.get $size)))
          (if (i32.or
                (i32.le_u (local.get $next) (local.get $cur))
                (i32.or
                  (i32.gt_u (local.get $next) (local.get $allocated_end))
                  (i32.gt_u (local.get $next) (local.get $reserved_end))))
            (then (return (i32.const 0))))
          (local.set $cur (local.get $next))
          (br $block)))
        (if (i32.eqz
              (call $heap_validate_arena_accounts_live
                (local.get $rec) (i32.const 0)))
          (then (return (i32.const 0))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $arena)))
    (call $heap_validate_free_list_excludes (i32.const 0)))

  ;; A private heap handle is an allocator-owned live record, not merely an
  ;; arbitrary readable address containing the HEAP magic. The fixed process
  ;; handle is the one exception because it is intentionally not heap memory.
  (func $heap_validate_handle (param $handle i32) (result i32)
    (if (i32.eq (local.get $handle) (global.get $PROCESS_HEAP_HANDLE))
      (then (return (i32.const 1))))
    (if (i32.eqz (call $heap_validate_live_block (local.get $handle)))
      (then (return (i32.const 0))))
    (i32.eq (call $gl32 (local.get $handle)) (global.get $PRIVATE_HEAP_MAGIC)))

  ;; 501: HeapValidate(hHeap, dwFlags, lpMem) → BOOL. Microsoft documents
  ;; HEAP_NO_SERIALIZE as the sole call flag (and warns callers not to use it
  ;; for the process heap); it changes locking policy, not the structures being
  ;; checked here. A non-NULL pointer must be a live allocation; NULL scans
  ;; every arena invariant this allocator actually maintains. HeapValidate
  ;; deliberately never changes last error, on either success or failure.
  (func $handle_HeapValidate (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $valid i32)
    (block $done
      (br_if $done
        (i32.ne (i32.and (local.get $arg1) (i32.const -2)) (i32.const 0)))
      (br_if $done (i32.eqz (call $heap_validate_handle (local.get $arg0))))
      (if (local.get $arg2)
        (then (local.set $valid (call $heap_validate_live_block (local.get $arg2))))
        (else (local.set $valid (call $heap_validate_all_arenas)))))
    (i32.store offset=0 (global.get $reg_base) (local.get $valid))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; Compact this instance's free list and return its largest usable block, or
  ;; -1 when the list is malformed. heap_free_impl deliberately prepends in
  ;; O(1), so unlike the old comment claimed, adjacent frees are not already
  ;; coalesced. HeapCompact must do that work itself.
  ;;
  ;; First validate the complete guest-writable list without mutating it. Then
  ;; radix-sort the aligned 32-bit block addresses through their 29 meaningful
  ;; bits. This is O(29*n), bounded, allocation-free, and makes adjacent arena
  ;; extents neighbors without an O(n^2) pair search. A final linear pass joins
  ;; consecutive extents only when both belong to the same allocator arena.
  (func $heap_compact_free_list (result i32)
    (local $cur i32) (local $next i32) (local $size i32)
    (local $count i32) (local $bit i32) (local $mask i32)
    (local $head0 i32) (local $tail0 i32)
    (local $head1 i32) (local $tail1 i32)
    (local $largest i32)
    ;; Validate exact block boundaries, untagged free extents, and a finite
    ;; list before any link is rewritten. The count cap also rejects cycles.
    (call $heap_bins_flush)
    (local.set $cur (global.get $free_list))
    (block $valid (loop $check
      (br_if $valid (i32.eqz (local.get $cur)))
      (local.set $count (i32.add (local.get $count) (i32.const 1)))
      (if (i32.gt_u (local.get $count) (i32.const 65536))
        (then (return (i32.const -1))))
      (local.set $size (call $heap_validate_exact_block
        (i32.add (local.get $cur) (i32.const 4))))
      (if (i32.or
            (i32.eqz (local.get $size))
            (i32.ne
              (i32.and (i32.atomic.load (call $g2w (local.get $cur)))
                (i32.const 7))
              (i32.const 0)))
        (then (return (i32.const -1))))
      (local.set $cur
        (i32.load offset=4 (call $g2w (local.get $cur))))
      (br $check)))

    ;; A zero- or one-node list is already sorted; the merge/report pass below
    ;; handles both without a special return.
    (local.set $bit (i32.const 3))
    (block $sorted (loop $radix
      (br_if $sorted (i32.gt_u (local.get $bit) (i32.const 31)))
      (local.set $mask (i32.shl (i32.const 1) (local.get $bit)))
      (local.set $head0 (i32.const 0))
      (local.set $tail0 (i32.const 0))
      (local.set $head1 (i32.const 0))
      (local.set $tail1 (i32.const 0))
      (local.set $cur (global.get $free_list))
      (block $partitioned (loop $partition
        (br_if $partitioned (i32.eqz (local.get $cur)))
        (local.set $next
          (i32.load offset=4 (call $g2w (local.get $cur))))
        (i32.store offset=4 (call $g2w (local.get $cur)) (i32.const 0))
        (if (i32.and (local.get $cur) (local.get $mask))
          (then
            (if (local.get $tail1)
              (then (i32.store offset=4 (call $g2w (local.get $tail1))
                (local.get $cur)))
              (else (local.set $head1 (local.get $cur))))
            (local.set $tail1 (local.get $cur)))
          (else
            (if (local.get $tail0)
              (then (i32.store offset=4 (call $g2w (local.get $tail0))
                (local.get $cur)))
              (else (local.set $head0 (local.get $cur))))
            (local.set $tail0 (local.get $cur))))
        (local.set $cur (local.get $next))
        (br $partition)))
      (if (local.get $head0)
        (then
          (if (local.get $head1)
            (then (i32.store offset=4 (call $g2w (local.get $tail0))
              (local.get $head1))))
          (global.set $free_list (local.get $head0)))
        (else (global.set $free_list (local.get $head1))))
      (local.set $bit (i32.add (local.get $bit) (i32.const 1)))
      (br $radix)))

    ;; Sorted neighbors can be coalesced in place. Keep $cur on a successful
    ;; join so a run of three or more extents collapses into one block.
    (local.set $cur (global.get $free_list))
    (block $done (loop $merge
      (br_if $done (i32.eqz (local.get $cur)))
      (local.set $size (i32.atomic.load (call $g2w (local.get $cur))))
      (local.set $next
        (i32.load offset=4 (call $g2w (local.get $cur))))
      (if (i32.and
            (i32.ne (local.get $next) (i32.const 0))
            (i32.and
              (i32.eq (call $heap_arena_find (local.get $cur))
                      (call $heap_arena_find (local.get $next)))
              (i32.eq (i32.add (local.get $cur) (local.get $size))
                      (local.get $next))))
        (then
          (i32.store (call $g2w (local.get $cur))
            (i32.add (local.get $size)
              (i32.atomic.load (call $g2w (local.get $next)))))
          (i32.store offset=4 (call $g2w (local.get $cur))
            (i32.load offset=4 (call $g2w (local.get $next))))
          (br $merge)))
      ;; The 4-byte header is not caller-usable space.
      (if (i32.gt_u (i32.sub (local.get $size) (i32.const 4))
                    (local.get $largest))
        (then
          (local.set $largest
            (i32.sub (local.get $size) (i32.const 4)))))
      (local.set $cur (local.get $next))
      (br $merge)))
    (local.get $largest))

  ;; 502: HeapCompact(hHeap, dwFlags) — 2 args stdcall. Coalesce adjacent
  ;; current-owner free extents and return the largest committed free block.
  ;; Black & White 2's CRT calls this while loading a land; Civ II reaches the
  ;; same canonical path through GlobalCompact.
  (func $handle_HeapCompact (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $largest i32)
    (if (i32.eqz (call $heap_validate_handle (local.get $arg0)))
      (then
        (global.set $last_error (i32.const 6))  ;; ERROR_INVALID_HANDLE
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (if (i32.ne (i32.and (local.get $arg1) (i32.const -2)) (i32.const 0))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (local.set $largest (call $heap_compact_free_list))
    (if (i32.eq (local.get $largest) (i32.const -1))
      (then
        (global.set $last_error (i32.const 87)) ;; corrupt free list
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    ;; Zero means "no free block", not failure, so clear the error either way.
    (global.set $last_error (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (local.get $largest))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 503: HeapWalk(hHeap, lpEntry) and GetProcessHeaps(NumberOfHeaps,
  ;; ProcessHeaps) are NT-only: the Windows 95/98 KERNEL32 exports both, and
  ;; both fail with ERROR_CALL_NOT_IMPLEMENTED. Software probes for exactly that.
  ;; SmartHeap's SHW32.DLL DllMain calls GetProcessHeaps, then HeapWalk on the
  ;; process heap, and takes its Win9x path when GetLastError() is 120.
  (func $handle_HeapWalk (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $last_error (i32.const 120)) ;; ERROR_CALL_NOT_IMPLEMENTED
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; Same two stdcall arguments, same Win9x answer (0, ERROR_CALL_NOT_IMPLEMENTED).
  (func $handle_GetProcessHeaps (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_HeapWalk (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; HeapSetInformation(hHeap, HeapInformationClass, HeapInformation, HeapInformationLength)
  ;; Win9x-era heaps have no LFH mode to apply. Accept recognized heap handles so
  ;; modern VC runtimes can continue after their compatibility probe.
  (func $handle_HeapSetInformation (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (call $heap_api_handle_valid (local.get $arg0)))
      (then
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; 504: ReadConsoleA(hConsole, lpBuffer, nCharsToRead, lpCharsRead, lpReserved) → BOOL
  ;; Blocks on the console input queue; see $console_read.
  (func $handle_ReadConsoleA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (call $console_read (local.get $arg1) (local.get $arg2) (local.get $arg3) (i32.const 0))
      (then (return)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  ;; 505: SetConsoleMode(hConsole, dwMode) → BOOL
  (func $handle_SetConsoleMode (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $console_mode (local.get $arg1))
    (call $console_input_set_mode (local.get $arg1))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; 506: GetConsoleMode(hConsole, lpMode) → BOOL
  (func $handle_GetConsoleMode (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $gs32 (local.get $arg1) (call $console_input_mode))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; 507: WriteConsoleA — delegates to console buffer write
  (func $handle_WriteConsoleA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $console_write
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 0)))
    (if (i32.and (i32.ne (i32.load offset=0 (global.get $reg_base)) (i32.const 0)) (i32.ne (local.get $arg3) (i32.const 0)))
      (then (call $gs32 (local.get $arg3) (local.get $arg2))))
    (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
      (then (global.set $last_error (i32.const 6))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  ;; 508: GetFileInformationByHandle(hFile, lpFileInformation) → BOOL
  ;; One VFS snapshot supplies metadata and entry identity, shared by opens.
  (func $handle_GetFileInformationByHandle (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $error i32)
    (if (i32.eqz (local.get $arg1))
      (then
        (global.set $last_error (i32.const 87))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (local.set $error (call $host_fs_file_information
      (local.get $arg0) (local.get $arg1)))
    (if (local.get $error)
      (then
        (global.set $last_error (local.get $error))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 509: PeekNamedPipe lives in 09d7-pipes.wat.

  ;; 510: ReadConsoleInputA(hConsole, lpBuffer, nLength, lpNumberOfEventsRead) → BOOL
  ;; Blocking, like the real API: it returns only once at least one event is
  ;; queued.
  (func $handle_ReadConsoleInputA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (call $console_input_records_api
          (local.get $arg0) (local.get $arg1) (local.get $arg2)
          (local.get $arg3) (i32.const 0) (i32.const 0))
      (then (return)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; 511: PeekConsoleInputA(hConsole, lpBuffer, nLength, lpNumberOfEventsRead) → BOOL
  ;; Non-destructive: copies without dropping, and never blocks.
  (func $handle_PeekConsoleInputA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (call $console_input_records_api
          (local.get $arg0) (local.get $arg1) (local.get $arg2)
          (local.get $arg3) (i32.const 0) (i32.const 1))
      (then (return)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; 512: GetNumberOfConsoleInputEvents(hConsole, lpNumberOfEvents) → BOOL
  (func $handle_GetNumberOfConsoleInputEvents (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (call $console_input_count_api (local.get $arg0) (local.get $arg1))
      (then (return)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; 513: CreatePipe lives in 09d7-pipes.wat.

  ;; 514: GetSystemTimeAsFileTime(lpFileTime) — exact UTC wall-clock FILETIME.
  (func $handle_GetSystemTimeAsFileTime (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $wall_clock_to_guest (local.get $arg0) (i32.const 2) (i32.const 8))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 515: SetLocalTime — STUB: unimplemented
  (func $handle_SetLocalTime (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr))
  )

  ;; 516: GetSystemTime(lpSystemTime) — host wall clock in UTC.
  (func $handle_GetSystemTime (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $wall_clock_to_guest (local.get $arg0) (i32.const 0) (i32.const 16))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 517: FormatMessageW(dwFlags, lpSource, dwMessageId, dwLanguageId, lpBuffer, nSize, Arguments)
  ;; The same call as FormatMessageA with UTF-16 on both ends: the template is
  ;; narrowed on the way in, the finished text widened on the way out, and
  ;; nSize counts WCHARs rather than bytes. The decisions in between belong to
  ;; $format_message_ansi, which is the only implementation either spelling has.
  (func $handle_FormatMessageW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $nSize i32) (local $args_g i32) (local $len i32) (local $fmt_ga i32)
    (local $fmt_wa i32) (local $tmp_ga i32) (local $dst i32) (local $buf_ga i32)
    (local.set $nSize (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (local.set $args_g (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
    (if (i32.and (local.get $arg0) (i32.const 0x200))
      (then (local.set $args_g (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))  ;; stdcall, 7 args
    (if (i32.and (local.get $arg0) (i32.const 0x400))
      (then
        (if (i32.eqz (local.get $arg1))
          (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
        (local.set $fmt_ga (call $heap_alloc
          (i32.add (call $guest_wcslen (local.get $arg1)) (i32.const 1))))
        (if (i32.eqz (local.get $fmt_ga))
          (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
        (drop (call $wide_to_ansi (local.get $arg1) (local.get $fmt_ga)
          (i32.add (call $guest_wcslen (local.get $arg1)) (i32.const 1))))
        (local.set $fmt_wa (call $g2w (local.get $fmt_ga)))))
    (local.set $len (call $format_message_ansi (local.get $arg0) (local.get $fmt_wa)
      (local.get $arg1) (local.get $arg2) (local.get $args_g) (i32.const 0) (i32.const 0)))
    ;; Expanded once more into an ANSI staging buffer and widened from there:
    ;; the caller's buffer is UTF-16, which $format_message_ansi cannot write.
    (local.set $tmp_ga (call $heap_alloc (i32.add (local.get $len) (i32.const 1))))
    (if (local.get $tmp_ga)
      (then
        (drop (call $format_message_ansi (local.get $arg0) (local.get $fmt_wa)
          (local.get $arg1) (local.get $arg2) (local.get $args_g)
          (call $g2w (local.get $tmp_ga)) (i32.add (local.get $len) (i32.const 1))))
        (if (i32.and (local.get $arg0) (i32.const 0x100))
          (then
            (local.set $buf_ga (call $heap_alloc
              (i32.shl (i32.add (local.get $len) (i32.const 1)) (i32.const 1))))
            (call $gs32 (local.get $arg4) (local.get $buf_ga))
            (local.set $dst (local.get $buf_ga))
            (local.set $nSize (i32.add (local.get $len) (i32.const 1))))
          (else
            (local.set $dst (local.get $arg4))))
        (if (i32.and (i32.ne (local.get $dst) (i32.const 0))
                     (i32.ne (local.get $nSize) (i32.const 0)))
          (then (drop (call $ansi_to_wide
            (local.get $tmp_ga) (local.get $dst) (local.get $nSize)))))
        (call $heap_free (local.get $tmp_ga))))
    (if (local.get $fmt_ga) (then (call $heap_free (local.get $fmt_ga))))
    (i32.store offset=0 (global.get $reg_base) (local.get $len))
  )

  ;; 518: GetFileSize
  (func $handle_GetFileSize (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; GetFileSize(hFile, lpFileSizeHigh) — 2 args
    (i32.store offset=0 (global.get $reg_base) (i32.const -1))
    (global.set $last_error (call $host_fs_file_size_result
      (local.get $arg0) (global.get $reg_base) (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; Validate one Win9x-length filename before handing it to the host string
  ;; decoder. Besides keeping an unmapped pointer out of JavaScript, reject
  ;; wildcards: GetCompressedFileSize names one file, not a search pattern.
  ;; Return a Win32 error code, or zero.
  (func $compressed_file_path_error
      (param $path i32) (param $wide i32) (result i32)
    (local $i i32) (local $step i32) (local $wa i32) (local $ch i32)
    (if (i32.eqz (local.get $path))
      (then (return (i32.const 87)))) ;; ERROR_INVALID_PARAMETER
    (local.set $step (select (i32.const 2) (i32.const 1) (local.get $wide)))
    (block $too_long (loop $scan
      (br_if $too_long (i32.ge_u (local.get $i) (i32.const 260)))
      (local.set $wa (call $g2w_affine_span
        (i32.add (local.get $path) (i32.mul (local.get $i) (local.get $step)))
        (local.get $step)))
      (if (i32.eq (local.get $wa) (global.get $NULL_SENTINEL))
        (then (return (i32.const 87)))) ;; ERROR_INVALID_PARAMETER
      (local.set $ch (call $load_char (local.get $wa) (local.get $wide)))
      (if (i32.eqz (local.get $ch))
        (then (return (select (i32.const 0) (i32.const 2)
          (i32.ne (local.get $i) (i32.const 0)))))) ;; empty -> FILE_NOT_FOUND
      (if (i32.or (i32.eq (local.get $ch) (i32.const 0x2A))
                   (i32.eq (local.get $ch) (i32.const 0x3F)))
        (then (return (i32.const 123)))) ;; ERROR_INVALID_NAME
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 206)) ;; ERROR_FILENAME_EXCED_RANGE

  ;; On our uncompressed FAT-like VFS, compressed size equals logical size.
  ;; Query the opened file itself; enumeration must not supply a second identity.
  (func $get_compressed_file_size
      (param $path i32) (param $high_out i32) (param $wide i32) (result i32)
    (local $err i32) (local $head i32) (local $valid i32) (local $handle i32)
    (local $low i32)
    (local.set $err (call $compressed_file_path_error
      (local.get $path) (local.get $wide)))
    (if (local.get $err)
      (then
        (global.set $last_error (local.get $err))
        (return (i32.const -1))))
    (if (local.get $high_out)
      (then
        ;; Validate each page fragment, not physical adjacency of the DWORD.
        ;; Reject wrap before translating the optional second fragment.
        (if (i32.gt_u (local.get $high_out) (i32.const 0xfffffffc))
          (then (global.set $last_error (i32.const 87)) (return (i32.const -1))))
        (local.set $head (i32.sub (i32.const 4096) (i32.and (local.get $high_out) (i32.const 4095))))
        (if (i32.gt_u (local.get $head) (i32.const 4)) (then (local.set $head (i32.const 4))))
        (local.set $valid (i32.ne
          (call $g2w_affine_span (local.get $high_out) (local.get $head)) (global.get $NULL_SENTINEL)))
        (if (i32.lt_u (local.get $head) (i32.const 4))
          (then (local.set $valid (i32.and (local.get $valid) (i32.ne
            (call $g2w_affine_span (i32.add (local.get $high_out) (local.get $head))
              (i32.sub (i32.const 4) (local.get $head))) (global.get $NULL_SENTINEL))))))
        (if (i32.eqz (local.get $valid))
          (then
            (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
            (return (i32.const -1))))))
    ;; DesiredAccess=0 is the documented metadata-only open shape; it neither
    ;; materializes provider-backed bytes nor asks for read/write permission.
    (local.set $handle (call $host_fs_create_file
      (call $g2w (local.get $path)) (i32.const 0) (i32.const 3)
      (i32.const 0) (local.get $wide))) ;; OPEN_EXISTING
    (if (i32.eq (local.get $handle) (i32.const -1))
      (then
        (global.set $last_error (i32.const 2)) ;; ERROR_FILE_NOT_FOUND
        (return (i32.const -1))))
    (local.set $err (call $host_fs_file_size_result
      (local.get $handle) (global.get $reg_base) (local.get $high_out)))
    (local.set $low (i32.load (global.get $reg_base)))
    (drop (call $host_fs_close_handle (local.get $handle)))
    (if (local.get $err)
      (then
        (global.set $last_error (local.get $err))
        (return (i32.const -1))))
    ;; 0xffffffff is a valid low DWORD.  Only that ambiguous success must
    ;; publish NO_ERROR so callers can distinguish it from failure.
    (if (i32.eq (local.get $low) (i32.const -1))
      (then (global.set $last_error (i32.const 0))))
    (local.get $low))

  (func $handle_GetCompressedFileSizeA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $get_compressed_file_size
      (local.get $arg0) (local.get $arg1) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_GetCompressedFileSizeW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $get_compressed_file_size
      (local.get $arg0) (local.get $arg1) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; GetFileTime(hFile, lpCreationTime, lpLastAccessTime, lpLastWriteTime).
  ;; File timestamps belong to the VFS entry, so enumeration and subsequent
  ;; opens observe exactly what SetFileTime stored (not a fresh clock sample).
  (func $handle_GetFileTime (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $err i32)
    (local.set $err (call $host_fs_file_time
      (local.get $arg0) (i32.const 0)
      (local.get $arg1) (local.get $arg2) (local.get $arg3)))
    (if (local.get $err)
      (then
        (global.set $last_error (local.get $err))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (else
        (global.set $last_error (i32.const 0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; 520: GetStringTypeExW(Locale, dwInfoType, lpSrcStr, cchSrc, lpCharType)
  (func $handle_GetStringTypeExW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $get_string_type_core
      (local.get $arg2) (local.get $arg3) (local.get $arg4) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  ;; 521: GetThreadLocale() → LCID. A new process begins at the en-US user
  ;; locale, and subsequently returns the calling thread's retained setting.
  (func $handle_GetThreadLocale (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_get_thread_locale
      (global.get $current_thread_id)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  (func $create_semaphore_core
      (param $initial i32) (param $maximum i32)
      (param $name i32) (param $wide i32) (result i32)
    (local $name_wa i32) (local $failure_error i32)
    (if (local.get $name)
      (then (local.set $name_wa (call $g2w (local.get $name)))))
    (local.set $failure_error
      (if (result i32)
          (i32.or
            (i32.le_s (local.get $maximum) (i32.const 0))
            (i32.or
              (i32.lt_s (local.get $initial) (i32.const 0))
              (i32.gt_s (local.get $initial) (local.get $maximum))))
        (then (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (else (i32.const 8)))) ;; ERROR_NOT_ENOUGH_MEMORY
    ;; The host resolves a same-name existing object before validating the new
    ;; counts, because Win32 explicitly ignores those counts on reopen.
    (call $sync_created_handle
      (call $host_create_semaphore
        (local.get $initial) (local.get $maximum)
        (local.get $name_wa) (local.get $wide))
      (local.get $failure_error)))

  (func $open_semaphore_core (param $name i32) (param $wide i32) (result i32)
    (call $sync_opened_handle
      (if (result i32) (local.get $name)
        (then (call $host_open_semaphore
          (call $g2w (local.get $name)) (local.get $wide)))
        (else (i32.const 0)))))

  ;; 522: CreateSemaphoreW(lpAttr, lInit, lMax, lpName) → counted named semaphore.
  (func $handle_CreateSemaphoreW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $create_semaphore_core
      (local.get $arg1) (local.get $arg2) (local.get $arg3) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; 523: ReleaseSemaphore(hSem, lReleaseCount, lpPrevCount) → host increments and writes back prior count.
  (func $handle_ReleaseSemaphore (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_release_semaphore
      (local.get $arg0)
      (local.get $arg1)
      (if (result i32) (local.get $arg2) (then (call $g2w (local.get $arg2))) (else (i32.const 0)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; Mutexes reuse the shared event host ABI with private kind bits in `wide`:
  ;; bit 0 selects A/W string decoding and bit 1 selects mutex semantics.
  (func $create_mutex_core (param $initial_owner i32) (param $name i32) (param $wide i32) (result i32)
    (local $name_wa i32)
    (if (local.get $name)
      (then (local.set $name_wa (call $g2w (local.get $name)))))
    (call $sync_created_handle
      (call $host_create_event
        (i32.const 0) (local.get $initial_owner) (local.get $name_wa)
        (i32.or (local.get $wide) (i32.const 2)))
      (i32.const 8))) ;; ERROR_NOT_ENOUGH_MEMORY

  (func $open_mutex_core (param $name i32) (param $wide i32) (result i32)
    (call $sync_opened_handle
      (if (result i32) (local.get $name)
        (then (call $host_open_event
          (call $g2w (local.get $name))
          (i32.or (local.get $wide) (i32.const 2))))
        (else (i32.const 0)))))

  ;; 524: CreateMutexW(lpMutexAttributes, bInitialOwner, lpName) → HANDLE
  (func $handle_CreateMutexW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $create_mutex_core (local.get $arg1) (local.get $arg2) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; 525: ReleaseMutex(hMutex) — release only the calling thread's ownership.
  ;; Bit 31 privately distinguishes this operation from SetEvent on the shared
  ;; one-argument host ABI.
  (func $handle_ReleaseMutex (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $result i32)
    (local.set $result (call $host_set_event
      (i32.or (local.get $arg0) (i32.const 0x80000000))))
    (if (i32.eq (local.get $result) (i32.const 1))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))
        (global.set $last_error (i32.const 0)))
      (else
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (global.set $last_error
          (if (result i32) (i32.eq (local.get $result) (i32.const -1))
            (then (i32.const 6))     ;; ERROR_INVALID_HANDLE
            (else (i32.const 288)))))) ;; ERROR_NOT_OWNER
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; OpenMutexA/W resolve named mutexes in this emulated process.
  (func $handle_OpenMutexA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $open_mutex_core (local.get $arg2) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_OpenMutexW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $open_mutex_core (local.get $arg2) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; CreateMutexA(lpAttr, bInitialOwner, lpName)
  (func $handle_CreateMutexA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $create_mutex_core (local.get $arg1) (local.get $arg2) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; CreateSemaphoreA(lpAttr, lInit, lMax, lpName) → counted named semaphore.
  (func $handle_CreateSemaphoreA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $create_semaphore_core
      (local.get $arg1) (local.get $arg2) (local.get $arg3) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; OpenSemaphoreA(dwDesiredAccess, bInheritHandle, lpName). Access masks and
  ;; inheritance are not yet represented, but lookup and reference lifetime are.
  (func $handle_OpenSemaphoreA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $open_semaphore_core (local.get $arg2) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; 526: CreateEventW(lpAttr, bManualReset, bInitialState, lpName) — 4 args stdcall
  (func $handle_CreateEventW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $create_event_core
      (local.get $arg1) (local.get $arg2) (local.get $arg3) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; 527: WaitForMultipleObjects(nCount, lpHandles, bWaitAll, dwMilliseconds) — 4 args stdcall
  (func $handle_WaitForMultipleObjects (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $result i32) (local $handles_wa i32)
    (local.set $handles_wa (call $g2w (local.get $arg1)))
    (local.set $result (call $host_wait_multiple (local.get $arg0) (local.get $handles_wa) (local.get $arg2) (local.get $arg3)))
    (if (i32.eq (local.get $result) (i32.const 0xFFFF))
      (then
        (global.set $yield_reason (i32.const 1))
        (global.set $wait_handle (local.get $arg0)) ;; nCount
        (global.set $wait_handles_ptr (local.get $handles_wa))
        (global.set $wait_all (i32.ne (local.get $arg2) (i32.const 0)))
        (global.set $wait_timeout (local.get $arg3))
        (global.set $wait_stack_bytes (i32.const 20))
        (global.set $steps (i32.const 0))
        (return)))
    (i32.store offset=0 (global.get $reg_base) (local.get $result))
    (drop (local.get $arg4))
    (drop (local.get $name_ptr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; Alertable multi-object wait uses the same scheduler contract, with one
  ;; additional stdcall argument. Both the immediate and parked paths must
  ;; pop 24 bytes; the non-Ex handler's parked path records only 20.
  (func $handle_WaitForMultipleObjectsEx (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg4) (then
      (if (call $io_apc_start (i32.const 24)) (then (return)))))
    (call $handle_WaitForMultipleObjects
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (i32.const 0) (local.get $name_ptr))
    (if (i32.eq (global.get $yield_reason) (i32.const 1))
      (then
        (global.set $wait_alertable (i32.ne (local.get $arg4) (i32.const 0)))
        (global.set $wait_stack_bytes (i32.const 24)))
      (else
        (i32.store offset=16 (global.get $reg_base)
          (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))))

  ;; 528: GlobalAddAtomW(lpString) — 1 arg stdcall, shares the A namespace.
  (func $handle_GlobalAddAtomW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $narrow i32)
    (local.set $narrow (call $atom_narrow_w (local.get $arg0)))
    (i32.store offset=0 (global.get $reg_base) (call $atom_add (global.get $ATOM_GLOBAL_TABLE) (local.get $narrow)))
    (call $atom_narrow_free (local.get $arg0) (local.get $narrow))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 529: FindResourceW — integer IDs share the A walk; named resources are
  ;; UTF-16 and must temporarily select the wide-name comparator.
  (func $handle_FindResourceW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $push_rsrc_ctx (local.get $arg0))
    (i32.store offset=0 (global.get $reg_base) (call $find_resource_w (local.get $arg2) (local.get $arg1)))
    (call $pop_rsrc_ctx)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 530: GlobalGetAtomNameW(nAtom, lpBuffer, nSize)
  (func $handle_GlobalGetAtomNameW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $atom_get_name (global.get $ATOM_GLOBAL_TABLE)
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 531: GetProfileIntW(appName, keyName, nDefault) — Unicode win.ini read
  (func $handle_GetProfileIntW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_ini_get_int
      (if (result i32) (local.get $arg0) (then (call $g2w (local.get $arg0))) (else (i32.const 0)))
      (if (result i32) (local.get $arg1) (then (call $g2w (local.get $arg1))) (else (i32.const 0)))
      (local.get $arg2)
      (global.get $win_ini_name_ptr)
      (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; GetProfileStringW(appName, keyName, default, retBuf, nSize) — Unicode win.ini read
  (func $handle_GetProfileStringW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_ini_get_string
      (if (result i32) (local.get $arg0) (then (call $g2w (local.get $arg0))) (else (i32.const 0)))
      (if (result i32) (local.get $arg1) (then (call $g2w (local.get $arg1))) (else (i32.const 0)))
      (if (result i32) (local.get $arg2) (then (call $g2w (local.get $arg2))) (else (i32.const 0)))
      (local.get $arg3)
      (local.get $arg4)
      (global.get $win_ini_name_ptr)
      (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
  )

  ;; Find the mapped PE image which owns an address. The executable headers are
  ;; copied by $load_pe, and $load_dll now does the same for DLLs, so the cold
  ;; query path can read the real section table instead of maintaining a second
  ;; protection mirror which could drift from the loader.
  (func $virtual_query_image_base (param $address i32) (result i32)
    (local $i i32) (local $rec i32) (local $base i32) (local $size i32)
    (local.set $base (global.get $image_base))
    (local.set $size (global.get $exe_size_of_image))
    (if (i32.and (i32.ne (local.get $base) (i32.const 0))
          (i32.lt_u (i32.sub (local.get $address) (local.get $base))
            (local.get $size)))
      (then (return (local.get $base))))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (i32.atomic.load (global.get $DLL_SHARED))))
      (local.set $rec (i32.add (global.get $DLL_TABLE)
        (i32.shl (local.get $i) (i32.const 5))))
      (local.set $base (i32.load (local.get $rec)))
      (local.set $size (i32.load offset=4 (local.get $rec)))
      (if (i32.and (i32.ne (local.get $base) (i32.const 0))
            (i32.lt_u (i32.sub (local.get $address) (local.get $base))
              (local.get $size)))
        (then (return (local.get $base))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  (func $virtual_query_image_size (param $base i32) (result i32)
    (local $i i32) (local $rec i32)
    (if (i32.eq (local.get $base) (global.get $image_base))
      (then (return (global.get $exe_size_of_image))))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (i32.atomic.load (global.get $DLL_SHARED))))
      (local.set $rec (i32.add (global.get $DLL_TABLE)
        (i32.shl (local.get $i) (i32.const 5))))
      (if (i32.eq (i32.load (local.get $rec)) (local.get $base))
        (then (return (i32.load offset=4 (local.get $rec)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  ;; Translate IMAGE_SCN_MEM_* access bits into the page protections exposed by
  ;; Win32. Win98 has executable page constants but no DEP enforcement; keeping
  ;; EXECUTE here is nevertheless observable metadata used by MSVC's protected
  ;; exception-handler validation.
  (func $virtual_query_section_protect (param $characteristics i32) (result i32)
    (local $protect i32)
    ;; Spell IMAGE_SCN_MEM_EXECUTE by bit position: its numeric value aliases a
    ;; declared emulator region and must not become a raw address-map literal.
    (if (i32.ne (i32.and (local.get $characteristics)
          (i32.shl (i32.const 1) (i32.const 29)))
          (i32.const 0))
      (then
        (if (i32.ne (i32.and (local.get $characteristics) (i32.const 0x80000000))
              (i32.const 0))
          (then
            (local.set $protect (i32.const 0x40))) ;; PAGE_EXECUTE_READWRITE
          (else
            (if (i32.ne (i32.and (local.get $characteristics) (i32.const 0x40000000))
                  (i32.const 0))
              (then
                (local.set $protect (i32.const 0x20))) ;; PAGE_EXECUTE_READ
              (else
                (local.set $protect (i32.const 0x10))))))) ;; PAGE_EXECUTE
      (else
        (if (i32.ne (i32.and (local.get $characteristics) (i32.const 0x80000000))
              (i32.const 0))
          (then
            (local.set $protect (i32.const 0x04))) ;; PAGE_READWRITE
          (else
            (if (i32.ne (i32.and (local.get $characteristics) (i32.const 0x40000000))
                  (i32.const 0))
              (then
                (local.set $protect (i32.const 0x02))) ;; PAGE_READONLY
              (else
                (local.set $protect (i32.const 0x01)))))))) ;; PAGE_NOACCESS
    (if (i32.ne (i32.and (local.get $characteristics) (i32.const 0x04000000))
          (i32.const 0))
      (then (local.set $protect (i32.or (local.get $protect) (i32.const 0x200)))))
    (local.get $protect))

  (func $virtual_query_pte (param $address i32) (result i32)
    (i32.atomic.load
      (i32.add (global.get $GUEST_PAGE_TABLE)
        (i32.and (i32.shr_u (local.get $address) (i32.const 10))
          (i32.const 0x003FFFFC)))))

  ;; Return the current protection for one page of an image. A direct-image
  ;; VirtualProtect override is recorded in the packed PTE metadata but does not
  ;; participate in translation, so the established affine fast path is
  ;; unchanged. Otherwise derive the protection from the mapped PE section.
  (func $virtual_query_image_protect
      (param $address i32) (param $base i32) (param $image_size i32) (result i32)
    (local $pte i32) (local $base_wa i32) (local $pe_delta i32) (local $pe i32)
    (local $count i32) (local $opt_size i32) (local $section i32) (local $i i32)
    (local $offset i32) (local $headers i32) (local $vaddr i32)
    (local $vsize i32) (local $raw_size i32) (local $mapped i32)
    (local $section_start i32) (local $section_end i32)
    (local.set $pte (call $virtual_query_pte (local.get $address)))
    (if (i32.ne (i32.and (local.get $pte) (global.get $GUEST_PTE_PRESENT))
          (i32.const 0))
      (then (return
        (i32.and (local.get $pte) (global.get $GUEST_PTE_PROTECT_MASK)))))
    (if (i32.lt_u (local.get $image_size) (i32.const 64))
      (then (return (i32.const 0x01))))
    (local.set $base_wa (call $g2w (local.get $base)))
    (if (i32.or
          (i32.eq (local.get $base_wa) (global.get $NULL_SENTINEL))
          (i32.ne (i32.load16_u (local.get $base_wa)) (i32.const 0x5A4D)))
      (then (return (i32.const 0x01))))
    (local.set $pe_delta (i32.load offset=0x3C (local.get $base_wa)))
    (if (i32.gt_u (local.get $pe_delta)
          (i32.sub (local.get $image_size) (i32.const 24)))
      (then (return (i32.const 0x01))))
    (local.set $pe (i32.add (local.get $base_wa) (local.get $pe_delta)))
    (if (i32.ne (i32.load (local.get $pe)) (i32.const 0x00004550))
      (then (return (i32.const 0x01))))
    (local.set $count (i32.load16_u offset=6 (local.get $pe)))
    (if (i32.gt_u (local.get $count) (i32.const 96))
      (then (return (i32.const 0x01))))
    (local.set $opt_size (i32.load16_u offset=20 (local.get $pe)))
    (local.set $section
      (i32.add (local.get $pe) (i32.add (i32.const 24) (local.get $opt_size))))
    (local.set $offset (i32.sub (local.get $address) (local.get $base)))
    (local.set $headers (i32.load offset=84 (local.get $pe)))
    (local.set $headers
      (i32.and (i32.add (local.get $headers) (i32.const 0xFFF))
        (i32.const 0xFFFFF000)))
    (if (i32.lt_u (local.get $offset) (local.get $headers))
      (then (return (i32.const 0x02)))) ;; mapped image headers are read-only
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (if (i32.gt_u (i32.sub (local.get $section) (local.get $base_wa))
            (i32.sub (local.get $image_size) (i32.const 40)))
        (then (return (i32.const 0x01))))
      (local.set $vaddr (i32.load offset=12 (local.get $section)))
      (local.set $vsize (i32.load offset=8 (local.get $section)))
      (local.set $raw_size (i32.load offset=16 (local.get $section)))
      (local.set $mapped
        (select (local.get $vsize) (local.get $raw_size)
          (i32.gt_u (local.get $vsize) (local.get $raw_size))))
      (if (local.get $mapped)
        (then
          (local.set $section_start
            (i32.and (local.get $vaddr) (i32.const 0xFFFFF000)))
          (local.set $section_end
            (i32.and
              (i32.add (i32.add (local.get $vaddr) (local.get $mapped))
                (i32.const 0xFFF))
              (i32.const 0xFFFFF000)))
          (if (i32.and
                (i32.ge_u (local.get $offset) (local.get $section_start))
                (i32.lt_u (local.get $offset) (local.get $section_end)))
            (then (return (call $virtual_query_section_protect
              (i32.load offset=36 (local.get $section))))))))
      (local.set $section (i32.add (local.get $section) (i32.const 40)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    ;; Alignment gaps are part of the image mapping but are inaccessible.
    (i32.const 0x01))

  ;; Locate the initial sparse VirtualAlloc reservation. Reserved-only ranges
  ;; live in VIRTUAL_RESERVE_TABLE; committed ranges live in VIRTUAL_MAP_TABLE.
  ;; Split commits mark every record after the first as a continuation, so walk
  ;; exact predecessors back to the allocation base without touching the PTE
  ;; translation path.
  (func $virtual_query_sparse_base (param $address i32) (result i32)
    (local $count i32) (local $i i32) (local $rec i32) (local $base i32)
    (local $flags i32) (local $steps i32) (local $found i32)
    (local.set $count (i32.load offset=16 (global.get $VIRTUAL_MAP_STATE)))
    (block $reserve_done (loop $reserve
      (br_if $reserve_done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $rec (i32.add (global.get $VIRTUAL_RESERVE_TABLE)
        (i32.shl (local.get $i) (i32.const 3))))
      (local.set $base
        (i32.and (i32.load (local.get $rec)) (i32.const 0xFFFFF000)))
      (if (i32.lt_u (i32.sub (local.get $address) (local.get $base))
            (i32.load offset=4 (local.get $rec)))
        (then (return (local.get $base))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $reserve)))
    (local.set $count (i32.load (global.get $VIRTUAL_MAP_STATE)))
    (local.set $i (i32.const 0))
    (block $map_done (loop $map
      (br_if $map_done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $rec (i32.add (global.get $VIRTUAL_MAP_TABLE)
        (i32.shl (local.get $i) (i32.const 4))))
      (local.set $flags (i32.load offset=12 (local.get $rec)))
      (local.set $base (i32.load (local.get $rec)))
      (if (i32.and
            (i32.eqz (i32.and (local.get $flags) (i32.const 0x40000000)))
            (i32.lt_u (i32.sub (local.get $address) (local.get $base))
              (i32.load offset=4 (local.get $rec))))
        (then (local.set $found (i32.const 1)) (br $map_done)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $map)))
    (if (i32.eqz (local.get $found)) (then (return (i32.const 0))))
    (block $root (loop $previous
      (br_if $root (i32.eqz (i32.and (local.get $flags) (i32.const 0x80000000))))
      (br_if $root (i32.ge_u (local.get $steps) (local.get $count)))
      (local.set $steps (i32.add (local.get $steps) (i32.const 1)))
      (local.set $i (i32.const 0))
      (local.set $found (i32.const 0))
      (block $pred_done (loop $pred
        (br_if $pred_done (i32.ge_u (local.get $i) (local.get $count)))
        (local.set $rec (i32.add (global.get $VIRTUAL_MAP_TABLE)
          (i32.shl (local.get $i) (i32.const 4))))
        (if (i32.eq (i32.add (i32.load (local.get $rec))
              (i32.load offset=4 (local.get $rec))) (local.get $base))
          (then
            (local.set $base (i32.load (local.get $rec)))
            (local.set $flags (i32.load offset=12 (local.get $rec)))
            (local.set $found (i32.const 1))
            (br $pred_done)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $pred)))
      (br_if $root (i32.eqz (local.get $found)))
      (br $previous)))
    (local.get $base))

  (func $virtual_query_sparse_end
      (param $address i32) (param $allocation_base i32) (result i32)
    (local $count i32) (local $i i32) (local $rec i32) (local $end i32)
    (local $found i32) (local $steps i32)
    (local.set $count (i32.load offset=16 (global.get $VIRTUAL_MAP_STATE)))
    (block $reserve_done (loop $reserve
      (br_if $reserve_done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $rec (i32.add (global.get $VIRTUAL_RESERVE_TABLE)
        (i32.shl (local.get $i) (i32.const 3))))
      (if (i32.eq
            (i32.and (i32.load (local.get $rec)) (i32.const 0xFFFFF000))
            (local.get $allocation_base))
        (then (return (i32.add (local.get $allocation_base)
          (i32.load offset=4 (local.get $rec))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $reserve)))
    (local.set $count (i32.load (global.get $VIRTUAL_MAP_STATE)))
    (local.set $end (local.get $allocation_base))
    (block $done (loop $next
      (br_if $done (i32.ge_u (local.get $steps) (local.get $count)))
      (local.set $steps (i32.add (local.get $steps) (i32.const 1)))
      (local.set $i (i32.const 0))
      (local.set $found (i32.const 0))
      (block $record_done (loop $record
        (br_if $record_done (i32.ge_u (local.get $i) (local.get $count)))
        (local.set $rec (i32.add (global.get $VIRTUAL_MAP_TABLE)
          (i32.shl (local.get $i) (i32.const 4))))
        (if (i32.and
              (i32.eq (i32.load (local.get $rec)) (local.get $end))
              (i32.eqz (i32.and (i32.load offset=12 (local.get $rec))
                (i32.const 0x40000000))))
          (then
            (if (i32.and (i32.ne (local.get $end) (local.get $allocation_base))
                  (i32.eqz (i32.and (i32.load offset=12 (local.get $rec))
                    (i32.const 0x80000000))))
              (then (br $record_done)))
            (local.set $end
              (i32.add (local.get $end) (i32.load offset=4 (local.get $rec))))
            (local.set $found (i32.const 1))
            (br $record_done)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $record)))
      (br_if $done (i32.eqz (local.get $found)))
      (br $next)))
    (select (local.get $end) (i32.add (local.get $address) (i32.const 0x1000))
      (i32.gt_u (local.get $end) (local.get $address))))

  (func $virtual_query_sparse_allocation_protect
      (param $address i32) (result i32)
    (local $count i32) (local $i i32) (local $rec i32) (local $base i32)
    (local.set $count (i32.load offset=16 (global.get $VIRTUAL_MAP_STATE)))
    (block $reserve_done (loop $reserve
      (br_if $reserve_done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $rec (i32.add (global.get $VIRTUAL_RESERVE_TABLE)
        (i32.shl (local.get $i) (i32.const 3))))
      (local.set $base
        (i32.and (i32.load (local.get $rec)) (i32.const 0xFFFFF000)))
      (if (i32.lt_u (i32.sub (local.get $address) (local.get $base))
            (i32.load offset=4 (local.get $rec)))
        (then (return (i32.and (i32.load (local.get $rec))
          (global.get $GUEST_PTE_PROTECT_MASK)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $reserve)))
    (local.set $i (i32.const 0))
    (local.set $count (i32.load (global.get $VIRTUAL_MAP_STATE)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $rec (i32.add (global.get $VIRTUAL_MAP_TABLE)
        (i32.shl (local.get $i) (i32.const 4))))
      (local.set $base (i32.load (local.get $rec)))
      (if (i32.and
            (i32.eqz (i32.and (i32.load offset=12 (local.get $rec))
              (i32.const 0x40000000)))
            (i32.lt_u (i32.sub (local.get $address) (local.get $base))
              (i32.load offset=4 (local.get $rec))))
        (then (return (i32.and (i32.load offset=12 (local.get $rec))
          (global.get $GUEST_PTE_PROTECT_MASK)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  ;; First known occupied address after a free page. VirtualQuery defines a
  ;; free region from the queried page forward, so no predecessor scan is
  ;; needed. Unknown low direct-window pages retain the former permissive
  ;; committed classification for compatibility; high sparse gaps are free.
  (func $virtual_query_next_allocation (param $address i32) (result i32)
    (local $next i32) (local $candidate i32) (local $count i32)
    (local $i i32) (local $rec i32)
    (local.set $next (i32.const 0x80000000))
    (local.set $candidate (global.get $image_base))
    (if (i32.and (i32.gt_u (local.get $candidate) (local.get $address))
          (i32.lt_u (local.get $candidate) (local.get $next)))
      (then (local.set $next (local.get $candidate))))
    (local.set $count (i32.atomic.load (global.get $DLL_SHARED)))
    (block $dll_done (loop $dll
      (br_if $dll_done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $candidate (i32.load (i32.add (global.get $DLL_TABLE)
        (i32.shl (local.get $i) (i32.const 5)))))
      (if (i32.and (i32.gt_u (local.get $candidate) (local.get $address))
            (i32.lt_u (local.get $candidate) (local.get $next)))
        (then (local.set $next (local.get $candidate))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $dll)))
    (local.set $i (i32.const 0))
    (local.set $count (i32.load offset=16 (global.get $VIRTUAL_MAP_STATE)))
    (block $reserve_done (loop $reserve
      (br_if $reserve_done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $candidate (i32.and
        (i32.load (i32.add (global.get $VIRTUAL_RESERVE_TABLE)
          (i32.shl (local.get $i) (i32.const 3)))) (i32.const 0xFFFFF000)))
      (if (i32.and (i32.gt_u (local.get $candidate) (local.get $address))
            (i32.lt_u (local.get $candidate) (local.get $next)))
        (then (local.set $next (local.get $candidate))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $reserve)))
    (local.set $i (i32.const 0))
    (local.set $count (i32.load (global.get $VIRTUAL_MAP_STATE)))
    (block $map_done (loop $map
      (br_if $map_done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $rec (i32.add (global.get $VIRTUAL_MAP_TABLE)
        (i32.shl (local.get $i) (i32.const 4))))
      (local.set $candidate (i32.load (local.get $rec)))
      (if (i32.and
            (i32.eqz (i32.and (i32.load offset=12 (local.get $rec))
              (i32.const 0x40000000)))
            (i32.and (i32.gt_u (local.get $candidate) (local.get $address))
              (i32.lt_u (local.get $candidate) (local.get $next))))
        (then (local.set $next (local.get $candidate))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $map)))
    (local.get $next))

  ;; VirtualProtect(lpAddress, dwSize, flNewProtect, lpflOldProtect).
  ;; Sparse VirtualAlloc pages retain their exact PAGE_* value in packed PTEs.
  ;; Validate the complete page-rounded range before changing any page and
  ;; publish the first page's actual previous value. Direct image pages retain
  ;; their affine translation but publish an override PTE so VirtualQuery sees
  ;; the protection transition without adding a check to the memory hot path.
  (func $handle_VirtualProtect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $old i32) (local $old_wa i32) (local $image i32)
    (local $page_base i32) (local $raw_end i32) (local $page_end i32)
    (local $backing i32)
    (if (i32.or
          (i32.eqz (local.get $arg0))
          (i32.or
            (i32.eqz (local.get $arg1))
            (i32.or
              (i32.eqz (local.get $arg3))
              (i32.eqz (call $guest_page_protection_valid (local.get $arg2))))))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (else
        (local.set $old_wa (call $g2w (local.get $arg3)))
        (if (i32.eq (local.get $old_wa) (global.get $NULL_SENTINEL))
          (then
            (global.set $last_error (i32.const 87))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
          (else
            (if (i32.ge_u (local.get $arg0) (call $virtual_alloc_min))
              (then
                (local.set $old (call $virtual_map_protect
                  (local.get $arg0) (local.get $arg1) (local.get $arg2))))
              (else
                (local.set $page_base
                  (i32.and (local.get $arg0) (i32.const 0xFFFFF000)))
                (local.set $raw_end (i32.add (local.get $arg0) (local.get $arg1)))
                (if (i32.le_u (local.get $raw_end) (local.get $arg0))
                  (then (local.set $old (i32.const -1)))
                  (else
                    (local.set $page_end
                      (i32.and (i32.add (local.get $raw_end) (i32.const 0xFFF))
                        (i32.const 0xFFFFF000)))
                    (local.set $backing (call $g2w_affine_span
                      (local.get $page_base)
                      (i32.sub (local.get $page_end) (local.get $page_base))))
                    (if (i32.eq (local.get $backing) (global.get $NULL_SENTINEL))
                      (then (local.set $old (i32.const -1)))
                      (else
                        (local.set $image
                          (call $virtual_query_image_base (local.get $page_base)))
                        (if (local.get $image)
                          (then (local.set $old (call $virtual_query_image_protect
                            (local.get $page_base) (local.get $image)
                            (call $virtual_query_image_size (local.get $image)))))
                          (else
                            (local.set $old (i32.and
                              (call $virtual_query_pte (local.get $page_base))
                              (global.get $GUEST_PTE_PROTECT_MASK)))
                            (if (i32.eqz (local.get $old))
                              (then (local.set $old (i32.const 0x04))))))
                        (if (i32.eqz (call $guest_page_publish_range
                              (local.get $page_base)
                              (i32.sub (local.get $page_end) (local.get $page_base))
                              (local.get $backing) (local.get $arg2)))
                          (then (local.set $old (i32.const -1))))))))))
            (if (i32.eq (local.get $old) (i32.const -1))
              (then
                (global.set $last_error (i32.const 487)) ;; ERROR_INVALID_ADDRESS
                (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
              (else
                (i32.store (local.get $old_wa) (local.get $old))
                (i32.store offset=0 (global.get $reg_base) (i32.const 1))))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; VirtualQuery(lpAddress, lpBuffer, dwLength) → SIZE_T
  ;; Describe a region beginning at the page containing lpAddress, exactly as
  ;; VirtualQuery does: consecutive pages must retain one allocation, state,
  ;; protection and type. PE images derive protections from their actual mapped
  ;; section table; sparse VirtualAlloc derives state/protection from its
  ;; reservation/map records and packed PTEs. Unknown low direct-window pages
  ;; keep the historical permissive private-RW answer so this metadata fix does
  ;; not change which legacy heap probes succeed.
  ;; GetSystemInfo publishes 0x7FFEFFFF as the maximum application address, so
  ;; queries at 0x80000000 or above must fail. Without that boundary, address-
  ;; space walkers wrap back to zero and scan our synthetic regions forever.
  ;; MEMORY_BASIC_INFORMATION layout (28 bytes):
  ;;   +0  BaseAddress     PVOID
  ;;   +4  AllocationBase  PVOID
  ;;   +8  AllocationProtect DWORD  (PAGE_READWRITE = 0x04)
  ;;   +12 RegionSize      SIZE_T
  ;;   +16 State           DWORD   (MEM_COMMIT = 0x1000)
  ;;   +20 Protect         DWORD   (PAGE_READWRITE = 0x04)
  ;;   +24 Type            DWORD   (MEM_PRIVATE = 0x20000)
  (func $handle_VirtualQuery (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $buf i32) (local $page i32) (local $end i32) (local $next i32)
    (local $image i32) (local $image_size i32) (local $protect i32)
    (local $allocation_base i32) (local $allocation_protect i32)
    (local $pte i32) (local $state i32) (local $signature i32)
    (local $next_pte i32) (local $next_signature i32)
    (local $reserved_protect i32)
    (local $direct_start i32) (local $direct_end i32)
    (if (i32.eqz (local.get $arg1))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
            (return)))
    (if (i32.lt_u (local.get $arg2) (i32.const 28))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
            (return)))
    (if (i32.ge_u (local.get $arg0) (i32.const 0x80000000))
      (then (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
            (return)))
    (local.set $buf (call $g2w (local.get $arg1)))
    (if (i32.eq (local.get $buf) (global.get $NULL_SENTINEL))
      (then
        (global.set $last_error (i32.const 87))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (local.set $page (i32.and (local.get $arg0) (i32.const 0xFFFFF000)))
    (local.set $image (call $virtual_query_image_base (local.get $page)))
    (if (local.get $image)
      (then
        (local.set $image_size (call $virtual_query_image_size (local.get $image)))
        (local.set $protect (call $virtual_query_image_protect
          (local.get $page) (local.get $image) (local.get $image_size)))
        (local.set $end (i32.add (local.get $image) (local.get $image_size)))
        (local.set $next (i32.add (local.get $page) (i32.const 0x1000)))
        (block $image_done (loop $image_pages
          (br_if $image_done (i32.ge_u (local.get $next) (local.get $end)))
          (br_if $image_done (i32.ne (call $virtual_query_image_protect
              (local.get $next) (local.get $image) (local.get $image_size))
            (local.get $protect)))
          (local.set $next (i32.add (local.get $next) (i32.const 0x1000)))
          (br $image_pages)))
        (local.set $end (select (local.get $next) (local.get $end)
          (i32.lt_u (local.get $next) (local.get $end))))
        (local.set $allocation_base (local.get $image))
        ;; Microsoft's documented !vprot MEM_IMAGE example reports this image-
        ;; mapping allocation default independently of the queried page's
        ;; section-specific current protection.
        (local.set $allocation_protect (i32.const 0x80)) ;; PAGE_EXECUTE_WRITECOPY
        (local.set $state (i32.const 0x1000)) ;; MEM_COMMIT
        (i32.store offset=24 (local.get $buf) (i32.const 0x01000000))) ;; MEM_IMAGE
      (else
        (local.set $allocation_base
          (call $virtual_query_sparse_base (local.get $page)))
        (if (local.get $allocation_base)
          (then
            (local.set $reserved_protect (select (i32.const 1) (i32.const 0)
              (call $mapped_view_contains (local.get $page))))
            (local.set $end (call $virtual_query_sparse_end
              (local.get $page) (local.get $allocation_base)))
            (local.set $allocation_protect
              (call $virtual_query_sparse_allocation_protect (local.get $page)))
            (local.set $pte (call $virtual_query_pte (local.get $page)))
            (if (i32.ne (i32.and (local.get $pte) (global.get $GUEST_PTE_PRESENT))
                  (i32.const 0))
              (then
                (local.set $state (i32.const 0x1000))
                (local.set $protect
                  (i32.and (local.get $pte) (global.get $GUEST_PTE_PROTECT_MASK))))
              (else
                (local.set $state (i32.const 0x2000))
                ;; Native Win98 section holes report PAGE_NOACCESS, while
                ;; ordinary VirtualAlloc reservations retain their own path.
                (local.set $protect (local.get $reserved_protect))))
            (local.set $signature
              (i32.or (local.get $state) (i32.shl (local.get $protect) (i32.const 16))))
            (local.set $next (i32.add (local.get $page) (i32.const 0x1000)))
            (block $sparse_done (loop $sparse_pages
              (br_if $sparse_done (i32.ge_u (local.get $next) (local.get $end)))
              (local.set $next_pte (call $virtual_query_pte (local.get $next)))
              (if (i32.ne (i32.and (local.get $next_pte)
                    (global.get $GUEST_PTE_PRESENT)) (i32.const 0))
                (then (local.set $next_signature
                  (i32.or (i32.const 0x1000)
                    (i32.shl (i32.and (local.get $next_pte)
                      (global.get $GUEST_PTE_PROTECT_MASK)) (i32.const 16)))))
                (else (local.set $next_signature
                  (i32.or (i32.const 0x2000)
                    (i32.shl (local.get $reserved_protect) (i32.const 16))))))
              (br_if $sparse_done
                (i32.ne (local.get $next_signature) (local.get $signature)))
              (local.set $next (i32.add (local.get $next) (i32.const 0x1000)))
              (br $sparse_pages)))
            (local.set $end (select (local.get $next) (local.get $end)
              (i32.lt_u (local.get $next) (local.get $end))))
            (i32.store offset=24 (local.get $buf) (i32.const 0x00020000))) ;; MEM_PRIVATE
          (else
            (local.set $direct_start
              (i32.sub (global.get $image_base) (global.get $GUEST_BASE)))
            (local.set $direct_end
              (i32.add (local.get $direct_start) (region.end $DIRECT_WINDOW)))
            (if (i32.lt_u (i32.sub (local.get $page) (local.get $direct_start))
                  (region.end $DIRECT_WINDOW))
              (then
                (local.set $pte (call $virtual_query_pte (local.get $page)))
                (local.set $protect
                  (i32.and (local.get $pte) (global.get $GUEST_PTE_PROTECT_MASK)))
                (if (i32.eqz (local.get $protect))
                  (then (local.set $protect (i32.const 0x04))))
                (local.set $allocation_base (local.get $direct_start))
                (local.set $allocation_protect (i32.const 0x04))
                (local.set $state (i32.const 0x1000))
                (local.set $end (local.get $direct_end))
                (i32.store offset=24 (local.get $buf) (i32.const 0x00020000)))
              (else
                (local.set $end
                  (call $virtual_query_next_allocation (local.get $page)))
                (if (i32.le_u (local.get $end) (local.get $page))
                  (then (local.set $end (i32.add (local.get $page) (i32.const 0x1000)))))
                (local.set $allocation_base (i32.const 0))
                (local.set $allocation_protect (i32.const 0))
                (local.set $state (i32.const 0x10000)) ;; MEM_FREE
                (local.set $protect (i32.const 0))
                (i32.store offset=24 (local.get $buf) (i32.const 0))))))))
    (i32.store (local.get $buf) (local.get $page))
    (i32.store offset=4 (local.get $buf) (local.get $allocation_base))
    (i32.store offset=8 (local.get $buf) (local.get $allocation_protect))
    (i32.store offset=12 (local.get $buf) (i32.sub (local.get $end) (local.get $page)))
    (i32.store offset=16 (local.get $buf) (local.get $state))
    (i32.store offset=20 (local.get $buf) (local.get $protect))
    (i32.store offset=0 (global.get $reg_base) (i32.const 28))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; VirtualQueryEx(hProcess, lpAddress, lpBuffer, dwLength) -> SIZE_T
  ;; Wine-Assembly hosts one guest process, so the current-process pseudo
  ;; handle is the only cross-process query target it can describe. Delegate
  ;; that case to VirtualQuery and reject invented external process handles.
  (func $handle_VirtualQueryEx (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.ne (local.get $arg0) (i32.const -1))
      (then
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (call $handle_VirtualQuery
      (local.get $arg1) (local.get $arg2) (local.get $arg3)
      (i32.const 0) (i32.const 0) (local.get $name_ptr))
    ;; VirtualQuery popped its return address and three arguments; account for
    ;; VirtualQueryEx's leading process handle as the fourth argument.
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  ;; GetDeviceGammaRamp(hdc, lpRamp) — retrieve WAT-owned display LUT state.
  (func $handle_GetDeviceGammaRamp (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $gdi_gamma_ramp_get (local.get $arg0)
      (if (result i32) (local.get $arg1)
        (then (call $g2w (local.get $arg1))) (else (i32.const 0)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; 533: FindResourceExW(hModule, lpType, lpName, wLanguage) → HRSRC
  ;; The resource walker addresses types and names by ordinal and matches
  ;; string names as ASCII, which is exactly what FindResourceW already does
  ;; with the same pointers — the Ex form only adds a language we ignore.
  (func $handle_FindResourceExW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_FindResourceExA (local.get $arg0) (local.get $arg1)
      (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; 534: SizeofResource(hModule, hResInfo) — return size from resource data entry
  (func $handle_SizeofResource (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; hResInfo (arg1) is relative to hModule (same as FindResource return).
    ;; Data entry: [RVA:4][Size:4][CodePage:4][Reserved:4]
    (if (i32.eqz (local.get $arg1))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0))
      (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))) (return)))
    (call $push_rsrc_ctx (local.get $arg0))
    (i32.store offset=0 (global.get $reg_base) (call $gl32
        (i32.add (call $r_base)
          (i32.add (local.get $arg1) (i32.const 4)))))
    (call $pop_rsrc_ctx)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 535: GetProcessVersion(ProcessId). PID zero names the caller. This runtime
  ;; has one process, whose original PE headers remain mapped at image_base.
  ;; Windows returns the executable's stamped subsystem version with the major
  ;; component in the high word and minor component in the low word; this is
  ;; not the differently encoded operating-system value returned by GetVersion.
  (func $handle_GetProcessVersion (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $pe_wa i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
    (if (i32.and
          (i32.ne (local.get $arg0) (i32.const 0))
          (i32.ne (local.get $arg0) (call $current_process_id)))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (local.set $pe_wa
      (call $g2w
        (i32.add (global.get $image_base)
          (call $gl32 (i32.add (global.get $image_base) (i32.const 0x3c))))))
    (i32.store offset=0 (global.get $reg_base) (i32.or
        (i32.shl
          (i32.load16_u offset=0x48 (local.get $pe_wa))
          (i32.const 16))
        (i32.load16_u offset=0x4a (local.get $pe_wa))))
  )

  ;; GetProcessAffinityMask(hProcess, *processMask, *systemMask) → BOOL.
  ;; The browser machine has one logical processor, but the process handle is
  ;; still part of the contract: a fabricated external process must not gain a
  ;; plausible mask merely because both real outputs happen to be constants.
  (func $handle_GetProcessAffinityMask (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    (if (i32.eqz (call $current_process_handle_valid (local.get $arg0)))
      (then
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (if (local.get $arg1)
      (then (call $gs32 (local.get $arg1) (i32.const 1))))
    (if (local.get $arg2)
      (then (call $gs32 (local.get $arg2) (i32.const 1))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
  )

  ;; SetThreadAffinityMask(hThread, dwAffinityMask) → previous mask (DWORD_PTR).
  ;; The only possible current and previous mask is bit zero. Resolve the
  ;; handle through the same process-wide thread authority as priority APIs so
  ;; pseudo and durable handles work while closed/fabricated handles fail.
  (func $handle_SetThreadAffinityMask (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
    (if (i32.eq
          (call $host_get_thread_priority
            (local.get $arg0) (global.get $current_thread_id))
          (i32.const 0x7fffffff))
      (then
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (if (i32.ne (local.get $arg1) (i32.const 1))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
  )

  ;; 536: GlobalFlags(hMem) → flags/lock count.
  ;; Our GlobalAlloc returns a direct heap pointer and GlobalLock is identity,
  ;; so there is no movable/discardable/lock-count state to report. A live
  ;; allocation therefore returns 0, the normal unlocked/fixed-memory result;
  ;; every other value returns GMEM_INVALID_HANDLE. The helper validates arena
  ;; residency and exact block identity before touching the guest mapping.
  (func $handle_GlobalFlags (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (call $heap_global_block_size (local.get $arg0) (i32.const 0))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (else
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x8000)))) ;; GMEM_INVALID_HANDLE
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 537: GetDiskFreeSpaceW(lpRootPathName, ...) — every value this call
  ;; returns is a number written through a caller pointer; only the root
  ;; string's encoding differs, and $disk_free_space takes that as a flag.
  (func $handle_GetDiskFreeSpaceW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $disk_free_space (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (i32.const 1))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))  ;; stdcall, 5 args
  )

  ;; 538: SearchPathW(lpPath, lpFileName, lpExtension, nBufferLength,
  ;;                  lpBuffer, lpFilePart) → chars written
  ;; The host search takes an isWide flag and does the conversion on both
  ;; sides of itself, so this is SearchPathA with that flag set.
  (func $handle_SearchPathW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $search_path
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4)
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
      (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))  ;; stdcall, 6 args
  )

  ;; Win98 accepts the seven ordinary relative values. A REALTIME process also
  ;; accepts the intermediate -7..6 values documented for that priority class;
  ;; background-processing mode is a post-Win98 API and stays invalid here.
  (func $win98_thread_priority_valid (param $priority i32) (result i32)
    (i32.or
      (i32.or
        (i32.eq (local.get $priority) (i32.const -15)) ;; THREAD_PRIORITY_IDLE
        (i32.eq (local.get $priority) (i32.const 15))) ;; THREAD_PRIORITY_TIME_CRITICAL
      (if (result i32)
        (i32.eq (call $process_priority_class_get) (i32.const 0x100))
        (then
          (i32.and
            (i32.ge_s (local.get $priority) (i32.const -7))
            (i32.le_s (local.get $priority) (i32.const 6))))
        (else
          (i32.and
            (i32.ge_s (local.get $priority) (i32.const -2))
            (i32.le_s (local.get $priority) (i32.const 2)))))))

  ;; 539: SetThreadPriority(hThread, nPriority). ThreadManager retains the value
  ;; on the underlying thread object, so CreateThread handles and duplicates
  ;; observe the same state in cooperative and real-Worker backends.
  (func $handle_SetThreadPriority (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
    (if (i32.eqz (call $win98_thread_priority_valid (local.get $arg1)))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (i32.store offset=0 (global.get $reg_base) (call $host_set_thread_priority
      (local.get $arg0) (local.get $arg1) (global.get $current_thread_id)))
    (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
      (then (global.set $last_error (i32.const 6)))) ;; ERROR_INVALID_HANDLE
  )

  ;; 1250: GetExitCodeThread(hThread, lpExitCode) — 2 args stdcall
  (func $handle_GetExitCodeThread (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; Write exit code to lpExitCode
    (call $gs32 (local.get $arg1) (call $host_get_exit_code_thread (local.get $arg0)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; TerminateThread(hThread, dwExitCode) — legacy installers use this to tear
  ;; down helper threads during setup cleanup.
  (func $handle_TerminateThread (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_terminate_thread (local.get $arg0) (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; SuspendThread(hThread) — 1 arg stdcall, return previous suspend count (0 = not suspended)
  (func $handle_SuspendThread (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $result i32)
    (local.set $result (call $host_suspend_thread (local.get $arg0)))
    ;; The host privately tags a successful self-suspend in bit 31. Hide that
    ;; bit from the Win32 caller and stop this guest slice immediately; Windows
    ;; would not let the suspended thread execute its next instruction until a
    ;; different thread resumed it.
    (i32.store offset=0 (global.get $reg_base) (i32.and (local.get $result) (i32.const 0x7FFFFFFF)))
    (if (i32.ne (i32.and (local.get $result) (i32.const 0x80000000)) (i32.const 0))
      (then
        (global.set $yield_reason (i32.const 11)) ;; private self-suspend yield
        (global.set $yield_flag (i32.const 1))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 541: GetPrivateProfileIntW — STUB: unimplemented
  (func $handle_GetPrivateProfileIntW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; GetPrivateProfileIntW(appName, keyName, nDefault, fileName) — 4 args stdcall
    (i32.store offset=0 (global.get $reg_base) (call $host_ini_get_int
      (call $g2w (local.get $arg0))
      (call $g2w (local.get $arg1))
      (local.get $arg2)
      (call $g2w (local.get $arg3))
      (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; 542: GetPrivateProfileStringW — STUB: unimplemented
  (func $handle_GetPrivateProfileStringW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $ini_get_string
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4)
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
      (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
  )

  ;; 543: WritePrivateProfileStringW(appName, keyName, string, fileName) — 4 args stdcall
  (func $handle_WritePrivateProfileStringW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_ini_write_string
      (call $g2w (local.get $arg0))
      (if (result i32) (local.get $arg1) (then (call $g2w (local.get $arg1))) (else (i32.const 0)))
      (if (result i32) (local.get $arg2) (then (call $g2w (local.get $arg2))) (else (i32.const 0)))
      (call $g2w (local.get $arg3))
      (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; 544: CopyFileW — STUB: unimplemented
  (func $handle_CopyFileW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; CopyFileW(lpExistingFileName, lpNewFileName, bFailIfExists) — 3 args
    (i32.store offset=0 (global.get $reg_base) (call $host_fs_copy_file
      (call $g2w (local.get $arg0)) (call $g2w (local.get $arg1)) (local.get $arg2) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  (func $fixed_windows_path_char (param $i i32) (result i32)
    (local $c i32)
    (if (i32.eq (local.get $i) (i32.const 0)) (then (local.set $c (i32.const 67))))  ;; C
    (if (i32.eq (local.get $i) (i32.const 1)) (then (local.set $c (i32.const 58))))  ;; :
    (if (i32.eq (local.get $i) (i32.const 2)) (then (local.set $c (i32.const 92))))  ;; \
    (if (i32.eq (local.get $i) (i32.const 3)) (then (local.set $c (i32.const 87))))  ;; W
    (if (i32.eq (local.get $i) (i32.const 4)) (then (local.set $c (i32.const 73))))  ;; I
    (if (i32.eq (local.get $i) (i32.const 5)) (then (local.set $c (i32.const 78))))  ;; N
    (if (i32.eq (local.get $i) (i32.const 6)) (then (local.set $c (i32.const 68))))  ;; D
    (if (i32.eq (local.get $i) (i32.const 7)) (then (local.set $c (i32.const 79))))  ;; O
    (if (i32.eq (local.get $i) (i32.const 8)) (then (local.set $c (i32.const 87))))  ;; W
    (if (i32.eq (local.get $i) (i32.const 9)) (then (local.set $c (i32.const 83))))  ;; S
    (if (i32.eq (local.get $i) (i32.const 10)) (then (local.set $c (i32.const 92)))) ;; \
    (if (i32.eq (local.get $i) (i32.const 11)) (then (local.set $c (i32.const 83)))) ;; S
    (if (i32.eq (local.get $i) (i32.const 12)) (then (local.set $c (i32.const 89)))) ;; Y
    (if (i32.eq (local.get $i) (i32.const 13)) (then (local.set $c (i32.const 83)))) ;; S
    (if (i32.eq (local.get $i) (i32.const 14)) (then (local.set $c (i32.const 84)))) ;; T
    (if (i32.eq (local.get $i) (i32.const 15)) (then (local.set $c (i32.const 69)))) ;; E
    (if (i32.eq (local.get $i) (i32.const 16)) (then (local.set $c (i32.const 77)))) ;; M
    (local.get $c))

  ;; The emulated Win98 installation has one fixed Windows directory and its
  ;; SYSTEM child. Both APIs share the same TCHAR-count and truncation rules.
  (func $get_fixed_windows_directory (param $buf_g i32) (param $size i32)
        (param $wide i32) (param $system i32) (result i32)
    (local $required i32) (local $length i32)
    (local $base_wa i32) (local $at_wa i32) (local $i i32) (local $c i32)
    (local.set $required
      (select (i32.const 18) (i32.const 11) (local.get $system)))
    (local.set $length (i32.sub (local.get $required) (i32.const 1)))
    (if (i32.or (i32.eqz (local.get $buf_g))
                (i32.lt_u (local.get $size) (local.get $required)))
      (then (return (local.get $required))))
    (local.set $base_wa (call $g2w (local.get $buf_g)))
    (block $done (loop $copy
      (br_if $done (i32.ge_u (local.get $i) (local.get $required)))
      (local.set $at_wa (i32.add (local.get $base_wa)
        (i32.shl (local.get $i) (local.get $wide))))
      (local.set $c
        (if (result i32) (i32.lt_u (local.get $i) (local.get $length))
          (then (call $fixed_windows_path_char (local.get $i)))
          (else (i32.const 0))))
      (if (local.get $wide)
        (then (i32.store16 (local.get $at_wa) (local.get $c)))
        (else (i32.store8 (local.get $at_wa) (local.get $c))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $copy)))
    (local.get $length))

  (func $handle_GetSystemDirectoryA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $get_fixed_windows_directory
      (local.get $arg0) (local.get $arg1) (i32.const 0) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_GetSystemDirectoryW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $get_fixed_windows_directory
      (local.get $arg0) (local.get $arg1) (i32.const 1) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_GetWindowsDirectoryA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $get_fixed_windows_directory
      (local.get $arg0) (local.get $arg1) (i32.const 0) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; GetSystemWindowsDirectoryA was introduced for terminal-server-aware
  ;; callers. Win98 has one Windows directory, so it is the same path and
  ;; buffer contract as GetWindowsDirectoryA.
  (func $handle_GetSystemWindowsDirectoryA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_GetWindowsDirectoryA
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; GetWindowsDirectoryW(lpBuffer, uSize) — UTF-16 counterpart with the
  ;; Win32 required-size contract used by Unicode setup runtimes.
  (func $handle_GetWindowsDirectoryW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $get_fixed_windows_directory
      (local.get $arg0) (local.get $arg1) (i32.const 1) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; 546: GetVolumeInformationW — the same volume GetVolumeInformationA
  ;; describes, with its two strings written as UTF-16.
  (func $handle_GetVolumeInformationW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $volume_information
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36))) ;; stdcall 8 args
  )

  ;; Win98 ANSI output order is scalar fields, filesystem name, then label.
  ;; Each string is all-or-nothing: short buffers fail with error 111.
  ;; The W entry point intentionally retains the project's Unicode extension;
  ;; native Win98 W returns error 120 instead (see native volume fixture).
  (func $volume_information (param $root i32) (param $name_buf i32)
                            (param $name_size i32) (param $serial i32)
                            (param $max_comp i32) (param $wide i32) (result i32)
    (local $sp i32) (local $fs_flags i32) (local $fs_name i32)
    (local $fs_size i32) (local $root_wa i32) (local $mounted_serial i32)
    (local $cd i32) (local $length i32) (local $packed i32)
    (local $i i32) (local $at i32) (local $ch i32) (local $label_length i32)
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (local.set $fs_flags (call $gl32 (i32.add (local.get $sp) (i32.const 24))))
    (local.set $fs_name (call $gl32 (i32.add (local.get $sp) (i32.const 28))))
    (local.set $fs_size (call $gl32 (i32.add (local.get $sp) (i32.const 32))))
    (if (local.get $root) (then (local.set $root_wa (call $g2w (local.get $root)))))
    (local.set $cd (i32.eq (call $host_fs_drive_type
      (local.get $root_wa) (local.get $wide)) (i32.const 5)))
    (if (local.get $serial)
      (then
        (local.set $mounted_serial (call $host_fs_volume_serial (local.get $root_wa) (local.get $wide)))
        (call $gs32 (local.get $serial)
          (select (local.get $mounted_serial) (i32.const 0x12345678)
            (i32.ne (local.get $mounted_serial) (i32.const 0))))))
    (if (local.get $max_comp)
      (then (call $gs32 (local.get $max_comp)
        (select (i32.const 221) (i32.const 255) (local.get $cd)))))
    (if (local.get $fs_flags)
      (then (call $gs32 (local.get $fs_flags)
        (select (i32.const 0x4000) (i32.const 0x4006) (local.get $cd)))))
    (if (local.get $fs_name)
      (then
        (local.set $length (select (i32.const 4) (i32.const 3) (local.get $cd)))
        (if (i32.le_u (local.get $fs_size) (local.get $length))
          (then (global.set $last_error (i32.const 111)) (return (i32.const 0))))
        (local.set $packed (select (i32.const 0x53464443) (i32.const 0x00544146) (local.get $cd)))
        (local.set $at (local.get $fs_name))
        (loop $copy_fs
          (local.set $ch (if (result i32) (i32.lt_u (local.get $i) (local.get $length))
            (then (i32.and (i32.shr_u (local.get $packed)
              (i32.shl (local.get $i) (i32.const 3))) (i32.const 255)))
            (else (i32.const 0))))
          (if (local.get $wide)
            (then (call $gs16 (local.get $at) (local.get $ch)))
            (else (call $gs8 (local.get $at) (local.get $ch))))
          (local.set $at (i32.add (local.get $at)
            (select (i32.const 2) (i32.const 1) (local.get $wide))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br_if $copy_fs (i32.le_u (local.get $i) (local.get $length))))))
    (if (local.get $name_buf)
      (then
        (local.set $label_length (call $host_fs_volume_label
          (local.get $root_wa) (local.get $wide) (local.get $name_buf) (local.get $name_size)))
        (if (i32.eq (local.get $label_length) (i32.const -1))
          (then (global.set $last_error (i32.const 111)) (return (i32.const 0))))
        ;; The native empty FAT-label query leaves ERROR_FILE_NOT_FOUND even
        ;; though the overall volume query succeeds. NULL label skips it.
        (if (i32.and (i32.eqz (local.get $cd)) (i32.eqz (local.get $label_length)))
          (then (global.set $last_error (i32.const 2))))))
    (i32.const 1))

  (func $handle_GetVolumeInformationA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $volume_information
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36))) ;; stdcall 8 args
  )

  ;; 547: OutputDebugStringW — STUB: unimplemented
  (func $handle_OutputDebugStringW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_OutputDebugStringA
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; IsBadStringPtr checks readable characters only through the first NUL or
  ;; ucchMax, whichever comes first. A zero maximum succeeds even for NULL.
  (func $ptr_string_bad
      (param $ptr i32) (param $max i32) (param $wide i32) (result i32)
    (local $i i32) (local $at i32) (local $width i32) (local $wa i32)
    (if (i32.eqz (local.get $max)) (then (return (i32.const 0))))
    (if (i32.eqz (local.get $ptr)) (then (return (i32.const 1))))
    (local.set $width (select (i32.const 2) (i32.const 1) (local.get $wide)))
    (local.set $at (local.get $ptr))
    (block $done (loop $chars
      (br_if $done (i32.ge_u (local.get $i) (local.get $max)))
      (if (call $ptr_range_access_bad
            (local.get $at) (local.get $width) (i32.const 0))
        (then (return (i32.const 1))))
      (local.set $wa (call $g2w (local.get $at)))
      (if (if (result i32) (local.get $wide)
            (then
              (i32.and
                (i32.eqz (i32.load8_u (local.get $wa)))
                (i32.eqz (i32.load8_u (call $g2w
                  (i32.add (local.get $at) (i32.const 1)))))))
            (else (i32.eqz (i32.load8_u (local.get $wa)))))
        (then (return (i32.const 0))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $done (i32.ge_u (local.get $i) (local.get $max)))
      (if (i32.gt_u (local.get $at) (i32.sub (i32.const -1) (local.get $width)))
        (then (return (i32.const 1))))
      (local.set $at (i32.add (local.get $at) (local.get $width)))
      (br $chars)))
    (i32.const 0))

  ;; 548: IsBadStringPtrA(lpsz, ucchMax)
  (func $handle_IsBadStringPtrA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $ptr_string_bad
      (local.get $arg0) (local.get $arg1) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 549: IsBadStringPtrW(lpsz, ucchMax)
  (func $handle_IsBadStringPtrW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $ptr_string_bad
      (local.get $arg0) (local.get $arg1) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 550: GlobalDeleteAtom(nAtom) — release one global reference; 0 = success.
  (func $handle_GlobalDeleteAtom (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $atom_delete (global.get $ATOM_GLOBAL_TABLE) (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; FindAtomA/W(lpString) — process-local lookup; 0 when never added.
  (func $handle_FindAtomA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $atom_find (global.get $ATOM_LOCAL_TABLE) (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  (func $handle_FindAtomW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $narrow i32)
    (local.set $narrow (call $atom_narrow_w (local.get $arg0)))
    (i32.store offset=0 (global.get $reg_base) (call $atom_find (global.get $ATOM_LOCAL_TABLE) (local.get $narrow)))
    (call $atom_narrow_free (local.get $arg0) (local.get $narrow))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 551: GlobalFindAtomW(lpString) — global lookup; 0 when never added.
  (func $handle_GlobalFindAtomW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $narrow i32)
    (local.set $narrow (call $atom_narrow_w (local.get $arg0)))
    (i32.store offset=0 (global.get $reg_base) (call $atom_find (global.get $ATOM_GLOBAL_TABLE) (local.get $narrow)))
    (call $atom_narrow_free (local.get $arg0) (local.get $narrow))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; Win9x has one machine/process DOS-device namespace rather than the
  ;; per-logon Local/Global split introduced later.  Keep the mutable mapping
  ;; stack in shared memory so calls made by different Worker instances see
  ;; one coherent namespace.  These definitions are namespace metadata only:
  ;; they are intentionally not treated as fabricated file/device handles by
  ;; CreateFile or the browser VFS.
  ;;
  ;; DOS_DEVICE_NAMESPACE layout:
  ;;   +0x000 lock owner/depth, +0x008 next sequence
  ;;   +0x010 immutable system-target strings
  ;;   +0x100 32 records, 0x160 bytes each:
  ;;     +0 active, +4 sequence, +8 name length, +12 target length
  ;;     +0x10 name[64], +0x50 target[260]
  (global $DOS_DEVICE_NAMESPACE i32 (region.addr $DOS_DEVICE_NAMESPACE 0))
  (global $DOS_DEVICE_NAMESPACE_SIZE i32 (region.size $DOS_DEVICE_NAMESPACE))
  (global $DOS_DEVICE_RECORD_SIZE i32 (i32.const 0x160))
  (global $DOS_DEVICE_RECORD_MAX i32 (i32.const 32))
  (data (region.addr $DOS_DEVICE_NAMESPACE 0x010) "\\Device\\HarddiskVolume1\00")
  (data (region.addr $DOS_DEVICE_NAMESPACE 0x030) "\\Device\\CdRom0\00")
  (data (region.addr $DOS_DEVICE_NAMESPACE 0x040) "\\Device\\VfsVolume\00")
  (data (region.addr $DOS_DEVICE_NAMESPACE 0x070) "\\??\\\00")
  (data (region.addr $DOS_DEVICE_NAMESPACE 0x078) "\\??\\UNC\\\00")

  (func $dos_device_record (param $index i32) (result i32)
    (i32.add (region.addr $DOS_DEVICE_NAMESPACE 0x100)
      (i32.mul (local.get $index) (global.get $DOS_DEVICE_RECORD_SIZE))))

  ;; Bounded ANSI input measurement. -1 is an inaccessible pointer and -2 is
  ;; a readable string with no terminator inside the supplied bound.
  (func $dos_device_ansi_len
      (param $string i32) (param $bound i32) (result i32)
    (local $i i32)
    (if (i32.eqz (local.get $string)) (then (return (i32.const -1))))
    (block $full (loop $scan
      (br_if $full (i32.ge_u (local.get $i) (local.get $bound)))
      (if (call $ptr_range_access_bad
            (i32.add (local.get $string) (local.get $i))
            (i32.const 1) (i32.const 0))
        (then (return (i32.const -1))))
      (if (i32.eqz (call $gl8 (i32.add (local.get $string) (local.get $i))))
        (then (return (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const -2))

  ;; Device names are at most 63 bytes in this bounded namespace.  The final
  ;; colon is legal only for a drive letter; a trailing slash is never legal.
  ;; -1/-2 retain the measurement errors, -3 is invalid name syntax.
  (func $dos_device_name_len (param $name i32) (result i32)
    (local $len i32) (local $last i32) (local $first i32)
    (local.set $len
      (call $dos_device_ansi_len (local.get $name) (i32.const 64)))
    (if (i32.lt_s (local.get $len) (i32.const 0))
      (then (return (local.get $len))))
    (if (i32.eqz (local.get $len)) (then (return (i32.const -3))))
    (local.set $last (call $gl8
      (i32.add (local.get $name) (i32.sub (local.get $len) (i32.const 1)))))
    (if (i32.or (i32.eq (local.get $last) (i32.const 0x5c))
                 (i32.eq (local.get $last) (i32.const 0x2f)))
      (then (return (i32.const -3))))
    (if (i32.eq (local.get $last) (i32.const 0x3a))
      (then
        (if (i32.ne (local.get $len) (i32.const 2))
          (then (return (i32.const -3))))
        (local.set $first (call $tolower (call $gl8 (local.get $name))))
        (if (i32.or (i32.lt_u (local.get $first) (i32.const 0x61))
                     (i32.gt_u (local.get $first) (i32.const 0x7a)))
          (then (return (i32.const -3))))))
    (local.get $len))

  (func $dos_device_name_equals_record
      (param $name i32) (param $len i32) (param $record i32) (result i32)
    (local $i i32)
    (if (i32.ne (local.get $len) (i32.load offset=8 (local.get $record)))
      (then (return (i32.const 0))))
    (block $equal (loop $compare
      (br_if $equal (i32.ge_u (local.get $i) (local.get $len)))
      (if (i32.ne
            (call $tolower (call $gl8
              (i32.add (local.get $name) (local.get $i))))
            (call $tolower (i32.load8_u
              (i32.add (local.get $record)
                (i32.add (i32.const 0x10) (local.get $i))))))
        (then (return (i32.const 0))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $compare)))
    (i32.const 1))

  (func $dos_device_records_same_name
      (param $a i32) (param $b i32) (result i32)
    (local $i i32) (local $len i32)
    (local.set $len (i32.load offset=8 (local.get $a)))
    (if (i32.ne (local.get $len) (i32.load offset=8 (local.get $b)))
      (then (return (i32.const 0))))
    (block $equal (loop $compare
      (br_if $equal (i32.ge_u (local.get $i) (local.get $len)))
      (if (i32.ne
            (i32.load8_u (i32.add (local.get $a)
              (i32.add (i32.const 0x10) (local.get $i))))
            (i32.load8_u (i32.add (local.get $b)
              (i32.add (i32.const 0x10) (local.get $i)))))
        (then (return (i32.const 0))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $compare)))
    (i32.const 1))

  (func $dos_device_copy_name_to_record
      (param $name i32) (param $len i32) (param $record i32)
    (local $i i32) (local $ch i32)
    (block $done (loop $copy
      (br_if $done (i32.ge_u (local.get $i) (local.get $len)))
      (local.set $ch (call $gl8 (i32.add (local.get $name) (local.get $i))))
      (if (i32.and (i32.ge_u (local.get $ch) (i32.const 0x61))
                   (i32.le_u (local.get $ch) (i32.const 0x7a)))
        (then (local.set $ch (i32.sub (local.get $ch) (i32.const 0x20)))))
      (i32.store8 (i32.add (local.get $record)
        (i32.add (i32.const 0x10) (local.get $i))) (local.get $ch))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $copy)))
    (i32.store8 (i32.add (local.get $record)
      (i32.add (i32.const 0x10) (local.get $len))) (i32.const 0)))

  ;; A non-raw target is representable when it is an absolute drive or UNC
  ;; path.  It is stored in the documented object-path form under \\??\\.
  ;; Return output length, -2 for overflow, or -3 for a relative DOS path.
  (func $dos_device_target_output_len
      (param $path i32) (param $source_len i32) (param $raw i32) (result i32)
    (local $first i32) (local $second i32) (local $third i32) (local $length i32)
    (if (local.get $raw) (then (return (local.get $source_len))))
    (if (i32.ge_u (local.get $source_len) (i32.const 2))
      (then
        (local.set $first (call $gl8 (local.get $path)))
        (local.set $second (call $gl8 (i32.add (local.get $path) (i32.const 1))))
        (if (i32.and
              (i32.or (i32.eq (local.get $first) (i32.const 0x5c))
                      (i32.eq (local.get $first) (i32.const 0x2f)))
              (i32.or (i32.eq (local.get $second) (i32.const 0x5c))
                      (i32.eq (local.get $second) (i32.const 0x2f))))
          (then
            (local.set $length (i32.add (local.get $source_len) (i32.const 6)))
            (return (select (local.get $length) (i32.const -2)
              (i32.le_u (local.get $length) (i32.const 259))))))))
    (if (i32.ge_u (local.get $source_len) (i32.const 3))
      (then
        (local.set $first (call $tolower (call $gl8 (local.get $path))))
        (local.set $second (call $gl8 (i32.add (local.get $path) (i32.const 1))))
        (local.set $third (call $gl8 (i32.add (local.get $path) (i32.const 2))))
        (if (i32.and
              (i32.and (i32.ge_u (local.get $first) (i32.const 0x61))
                       (i32.le_u (local.get $first) (i32.const 0x7a)))
              (i32.and (i32.eq (local.get $second) (i32.const 0x3a))
                (i32.or (i32.eq (local.get $third) (i32.const 0x5c))
                        (i32.eq (local.get $third) (i32.const 0x2f)))))
          (then
            (local.set $length (i32.add (local.get $source_len) (i32.const 4)))
            (return (select (local.get $length) (i32.const -2)
              (i32.le_u (local.get $length) (i32.const 259))))))))
    (i32.const -3))

  (func $dos_device_target_char
      (param $path i32) (param $raw i32) (param $index i32) (result i32)
    (local $unc i32) (local $ch i32)
    (if (local.get $raw)
      (then (return (call $gl8 (i32.add (local.get $path) (local.get $index))))))
    (local.set $unc
      (i32.and
        (i32.or (i32.eq (call $gl8 (local.get $path)) (i32.const 0x5c))
                (i32.eq (call $gl8 (local.get $path)) (i32.const 0x2f)))
        (i32.or (i32.eq (call $gl8 (i32.add (local.get $path) (i32.const 1))) (i32.const 0x5c))
                (i32.eq (call $gl8 (i32.add (local.get $path) (i32.const 1))) (i32.const 0x2f)))))
    (if (local.get $unc)
      (then
        (if (i32.lt_u (local.get $index) (i32.const 8))
          (then (return (i32.load8_u
            (i32.add (region.addr $DOS_DEVICE_NAMESPACE 0x078)
              (local.get $index))))))
        (local.set $ch (call $gl8 (i32.add (local.get $path)
          (i32.sub (local.get $index) (i32.const 6))))))
      (else
        (if (i32.lt_u (local.get $index) (i32.const 4))
          (then (return (i32.load8_u
            (i32.add (region.addr $DOS_DEVICE_NAMESPACE 0x070)
              (local.get $index))))))
        (local.set $ch (call $gl8 (i32.add (local.get $path)
          (i32.sub (local.get $index) (i32.const 4)))))))
    (select (i32.const 0x5c) (local.get $ch)
      (i32.eq (local.get $ch) (i32.const 0x2f))))

  (func $dos_device_write_target_to_record
      (param $path i32) (param $raw i32) (param $length i32) (param $record i32)
    (local $i i32)
    (block $done (loop $copy
      (br_if $done (i32.ge_u (local.get $i) (local.get $length)))
      (i32.store8 (i32.add (local.get $record)
        (i32.add (i32.const 0x50) (local.get $i)))
        (call $dos_device_target_char
          (local.get $path) (local.get $raw) (local.get $i)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $copy)))
    (i32.store8 (i32.add (local.get $record)
      (i32.add (i32.const 0x50) (local.get $length))) (i32.const 0)))

  (func $dos_device_record_target_matches
      (param $record i32) (param $path i32) (param $raw i32)
      (param $length i32) (param $exact i32) (result i32)
    (local $i i32) (local $stored i32)
    (local.set $stored (i32.load offset=12 (local.get $record)))
    (if (i32.lt_u (local.get $stored) (local.get $length))
      (then (return (i32.const 0))))
    (if (i32.and (local.get $exact)
                 (i32.ne (local.get $stored) (local.get $length)))
      (then (return (i32.const 0))))
    (block $equal (loop $compare
      (br_if $equal (i32.ge_u (local.get $i) (local.get $length)))
      (if (i32.ne
            (i32.load8_u (i32.add (local.get $record)
              (i32.add (i32.const 0x50) (local.get $i))))
            (call $dos_device_target_char
              (local.get $path) (local.get $raw) (local.get $i)))
        (then (return (i32.const 0))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $compare)))
    (i32.const 1))

  (func $dos_device_guest_drive_letter
      (param $name i32) (param $len i32) (param $mask i32) (result i32)
    (local $letter i32) (local $bit i32)
    (if (i32.ne (local.get $len) (i32.const 2))
      (then (return (i32.const 0))))
    (if (i32.ne (call $gl8 (i32.add (local.get $name) (i32.const 1)))
                (i32.const 0x3a))
      (then (return (i32.const 0))))
    (local.set $letter (call $tolower (call $gl8 (local.get $name))))
    (if (i32.or (i32.lt_u (local.get $letter) (i32.const 0x61))
                 (i32.gt_u (local.get $letter) (i32.const 0x7a)))
      (then (return (i32.const 0))))
    (local.set $bit (i32.sub (local.get $letter) (i32.const 0x61)))
    (select (i32.sub (local.get $letter) (i32.const 0x20)) (i32.const 0)
      (i32.ne (i32.and (local.get $mask)
        (i32.shl (i32.const 1) (local.get $bit))) (i32.const 0))))

  (func $dos_device_record_drive_letter
      (param $record i32) (param $mask i32) (result i32)
    (local $letter i32) (local $bit i32)
    (if (i32.ne (i32.load offset=8 (local.get $record)) (i32.const 2))
      (then (return (i32.const 0))))
    (if (i32.ne (i32.load8_u offset=0x11 (local.get $record)) (i32.const 0x3a))
      (then (return (i32.const 0))))
    (local.set $letter (call $tolower
      (i32.load8_u offset=0x10 (local.get $record))))
    (local.set $bit (i32.sub (local.get $letter) (i32.const 0x61)))
    (select (i32.sub (local.get $letter) (i32.const 0x20)) (i32.const 0)
      (i32.and
        (i32.le_u (local.get $bit) (i32.const 25))
        (i32.ne (i32.and (local.get $mask)
          (i32.shl (i32.const 1) (local.get $bit))) (i32.const 0)))))

  (func $dos_device_system_target_len (param $letter i32) (result i32)
    (select (i32.const 23)
      (select (i32.const 14) (i32.const 18)
        (i32.eq (local.get $letter) (i32.const 0x44)))
      (i32.eq (local.get $letter) (i32.const 0x43))))

  ;; Copy one system drive mapping and return the new guest output offset.
  (func $dos_device_write_system_target
      (param $letter i32) (param $out i32) (result i32)
    (local $src i32) (local $len i32) (local $i i32)
    (local.set $len (call $dos_device_system_target_len (local.get $letter)))
    (local.set $src
      (select (region.addr $DOS_DEVICE_NAMESPACE 0x010)
        (select (region.addr $DOS_DEVICE_NAMESPACE 0x030)
                (region.addr $DOS_DEVICE_NAMESPACE 0x040)
          (i32.eq (local.get $letter) (i32.const 0x44)))
        (i32.eq (local.get $letter) (i32.const 0x43))))
    (block $done (loop $copy
      (br_if $done (i32.ge_u (local.get $i) (local.get $len)))
      (if (i32.and (i32.eq (local.get $len) (i32.const 18))
                   (i32.eq (local.get $i) (i32.const 17)))
        (then (call $gs8 (i32.add (local.get $out) (local.get $i))
          (local.get $letter)))
        (else (call $gs8 (i32.add (local.get $out) (local.get $i))
          (i32.load8_u (i32.add (local.get $src) (local.get $i))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $copy)))
    (call $gs8 (i32.add (local.get $out) (local.get $len)) (i32.const 0))
    (i32.add (local.get $out) (i32.add (local.get $len) (i32.const 1))))

  (func $dos_device_write_record_target
      (param $record i32) (param $out i32) (result i32)
    (local $i i32) (local $len i32)
    (local.set $len (i32.load offset=12 (local.get $record)))
    (block $done (loop $copy
      (br_if $done (i32.gt_u (local.get $i) (local.get $len)))
      (call $gs8 (i32.add (local.get $out) (local.get $i))
        (i32.load8_u (i32.add (local.get $record)
          (i32.add (i32.const 0x50) (local.get $i)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $copy)))
    (i32.add (local.get $out) (i32.add (local.get $len) (i32.const 1))))

  (func $dos_device_write_record_name
      (param $record i32) (param $out i32) (result i32)
    (local $i i32) (local $len i32)
    (local.set $len (i32.load offset=8 (local.get $record)))
    (block $done (loop $copy
      (br_if $done (i32.gt_u (local.get $i) (local.get $len)))
      (call $gs8 (i32.add (local.get $out) (local.get $i))
        (i32.load8_u (i32.add (local.get $record)
          (i32.add (i32.const 0x10) (local.get $i)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $copy)))
    (i32.add (local.get $out) (i32.add (local.get $len) (i32.const 1))))

  (func $dos_device_record_is_current_name
      (param $record i32) (result i32)
    (local $i i32) (local $other i32)
    (block $current (loop $scan
      (br_if $current
        (i32.ge_u (local.get $i) (global.get $DOS_DEVICE_RECORD_MAX)))
      (local.set $other (call $dos_device_record (local.get $i)))
      (if (i32.and
            (i32.and (i32.ne (local.get $other) (local.get $record))
                     (i32.ne (i32.load (local.get $other)) (i32.const 0)))
            (i32.and
              (i32.gt_u (i32.load offset=4 (local.get $other))
                        (i32.load offset=4 (local.get $record)))
              (i32.ne (call $dos_device_records_same_name
                (local.get $record) (local.get $other)) (i32.const 0))))
        (then (return (i32.const 0))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 1))

  (func $query_dos_device_a
      (param $name i32) (param $target i32) (param $max i32) (result i32)
    (local $name_len i32) (local $mask i32) (local $letter i32)
    (local $required i32) (local $out i32) (local $i i32)
    (local $record i32) (local $best i32) (local $best_seq i32)
    (local $before_seq i32) (local $seq i32) (local $error i32)
    (local $result i32) (local $j i32) (local $other i32)
    (if (local.get $name)
      (then
        (local.set $name_len (call $dos_device_name_len (local.get $name)))
        (if (i32.lt_s (local.get $name_len) (i32.const 0))
          (then
            (global.set $last_error
              (select (i32.const 87) (i32.const 123)
                (i32.eq (local.get $name_len) (i32.const -1))))
            (return (i32.const 0))))))
    ;; The host call stays outside the process-table lock.
    (local.set $mask (call $host_fs_logical_drive_mask))
    (call $lock_acquire (region.addr $DOS_DEVICE_NAMESPACE 0x000))
    (block $done
      (if (local.get $name)
        (then
          (local.set $letter (call $dos_device_guest_drive_letter
            (local.get $name) (local.get $name_len) (local.get $mask)))
          (local.set $i (i32.const 0))
          (block $count_done (loop $count
            (br_if $count_done
              (i32.ge_u (local.get $i) (global.get $DOS_DEVICE_RECORD_MAX)))
            (local.set $record (call $dos_device_record (local.get $i)))
            (if (i32.and (i32.ne (i32.load (local.get $record)) (i32.const 0))
                         (i32.ne (call $dos_device_name_equals_record
                           (local.get $name) (local.get $name_len) (local.get $record))
                           (i32.const 0)))
              (then (local.set $required (i32.add (local.get $required)
                (i32.add (i32.load offset=12 (local.get $record)) (i32.const 1))))))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $count)))
          (if (local.get $letter)
            (then (local.set $required (i32.add (local.get $required)
              (i32.add (call $dos_device_system_target_len (local.get $letter))
                       (i32.const 1))))))
          (if (i32.eqz (local.get $required))
            (then (local.set $error (i32.const 2)) (br $done)))
          (local.set $required (i32.add (local.get $required) (i32.const 1))))
        (else
          ;; Enumeration starts with every VFS-visible drive letter.
          (local.set $required (i32.const 1)) ;; extra final NUL
          (local.set $i (i32.const 0))
          (block $drives_done (loop $drives
            (br_if $drives_done (i32.ge_u (local.get $i) (i32.const 26)))
            (if (i32.ne (i32.and (local.get $mask)
                  (i32.shl (i32.const 1) (local.get $i))) (i32.const 0))
              (then (local.set $required
                (i32.add (local.get $required) (i32.const 3)))))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $drives)))
          ;; Add one name for each current custom definition not already
          ;; represented by a mounted drive letter.
          (local.set $i (i32.const 0))
          (block $custom_done (loop $custom
            (br_if $custom_done
              (i32.ge_u (local.get $i) (global.get $DOS_DEVICE_RECORD_MAX)))
            (local.set $record (call $dos_device_record (local.get $i)))
            (if (i32.and
                  (i32.and (i32.ne (i32.load (local.get $record)) (i32.const 0))
                           (i32.eqz (call $dos_device_record_drive_letter
                             (local.get $record) (local.get $mask))))
                  (call $dos_device_record_is_current_name (local.get $record)))
              (then (local.set $required (i32.add (local.get $required)
                (i32.add (i32.load offset=8 (local.get $record)) (i32.const 1))))))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $custom)))))
      (if (i32.lt_u (local.get $max) (local.get $required))
        (then (local.set $error (i32.const 122)) (br $done)))
      (if (call $ptr_range_access_bad
            (local.get $target) (local.get $required) (i32.const 1))
        (then (local.set $error (i32.const 87)) (br $done)))
      (local.set $out (local.get $target))
      (if (local.get $name)
        (then
          ;; Emit newest mapping first by repeatedly selecting the highest
          ;; sequence below the one emitted previously.
          (local.set $before_seq (i32.const -1))
          (block $records_done (loop $records
            (local.set $best (i32.const 0))
            (local.set $best_seq (i32.const 0))
            (local.set $i (i32.const 0))
            (block $select_done (loop $select
              (br_if $select_done
                (i32.ge_u (local.get $i) (global.get $DOS_DEVICE_RECORD_MAX)))
              (local.set $record (call $dos_device_record (local.get $i)))
              (local.set $seq (i32.load offset=4 (local.get $record)))
              (if (i32.and
                    (i32.and (i32.ne (i32.load (local.get $record)) (i32.const 0))
                             (i32.ne (call $dos_device_name_equals_record
                               (local.get $name) (local.get $name_len) (local.get $record))
                               (i32.const 0)))
                    (i32.and (i32.lt_u (local.get $seq) (local.get $before_seq))
                             (i32.gt_u (local.get $seq) (local.get $best_seq))))
                (then
                  (local.set $best (local.get $record))
                  (local.set $best_seq (local.get $seq))))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $select)))
            (br_if $records_done (i32.eqz (local.get $best)))
            (local.set $out (call $dos_device_write_record_target
              (local.get $best) (local.get $out)))
            (local.set $before_seq (local.get $best_seq))
            (br $records)))
          (if (local.get $letter)
            (then (local.set $out (call $dos_device_write_system_target
              (local.get $letter) (local.get $out))))))
        (else
          (local.set $i (i32.const 0))
          (block $write_drives_done (loop $write_drives
            (br_if $write_drives_done (i32.ge_u (local.get $i) (i32.const 26)))
            (if (i32.ne (i32.and (local.get $mask)
                  (i32.shl (i32.const 1) (local.get $i))) (i32.const 0))
              (then
                (call $gs8 (local.get $out) (i32.add (i32.const 0x41) (local.get $i)))
                (call $gs8 (i32.add (local.get $out) (i32.const 1)) (i32.const 0x3a))
                (call $gs8 (i32.add (local.get $out) (i32.const 2)) (i32.const 0))
                (local.set $out (i32.add (local.get $out) (i32.const 3)))))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $write_drives)))
          (local.set $before_seq (i32.const -1))
          (block $write_custom_done (loop $write_custom
            (local.set $best (i32.const 0))
            (local.set $best_seq (i32.const 0))
            (local.set $i (i32.const 0))
            (block $select_custom_done (loop $select_custom
              (br_if $select_custom_done
                (i32.ge_u (local.get $i) (global.get $DOS_DEVICE_RECORD_MAX)))
              (local.set $record (call $dos_device_record (local.get $i)))
              (local.set $seq (i32.load offset=4 (local.get $record)))
              (if (i32.and
                    (i32.and
                      (i32.and (i32.ne (i32.load (local.get $record)) (i32.const 0))
                               (i32.eqz (call $dos_device_record_drive_letter
                                 (local.get $record) (local.get $mask))))
                      (call $dos_device_record_is_current_name (local.get $record)))
                    (i32.and (i32.lt_u (local.get $seq) (local.get $before_seq))
                             (i32.gt_u (local.get $seq) (local.get $best_seq))))
                (then
                  (local.set $best (local.get $record))
                  (local.set $best_seq (local.get $seq))))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $select_custom)))
            (br_if $write_custom_done (i32.eqz (local.get $best)))
            (local.set $out (call $dos_device_write_record_name
              (local.get $best) (local.get $out)))
            (local.set $before_seq (local.get $best_seq))
            (br $write_custom)))))
      (call $gs8 (local.get $out) (i32.const 0))
      (local.set $result (local.get $required)))
    (call $lock_release (region.addr $DOS_DEVICE_NAMESPACE 0x000))
    (if (local.get $error)
      (then (global.set $last_error (local.get $error))))
    (local.get $result))

  (func $define_dos_device_a
      (param $flags i32) (param $name i32) (param $target i32) (result i32)
    (local $name_len i32) (local $source_len i32) (local $target_len i32)
    (local $remove i32) (local $raw i32) (local $exact i32)
    (local $i i32) (local $record i32) (local $free i32)
    (local $best i32) (local $best_seq i32) (local $seq i32)
    (local $error i32) (local $result i32)
    (local.set $remove (i32.and (local.get $flags) (i32.const 0x2)))
    (local.set $raw (i32.and (local.get $flags) (i32.const 0x1)))
    (local.set $exact (i32.and (local.get $flags) (i32.const 0x4)))
    (if (i32.or
          (i32.ne (i32.and (local.get $flags) (i32.const 0xfffffff0)) (i32.const 0))
          (i32.and (i32.eqz (local.get $remove))
                   (i32.ne (local.get $exact) (i32.const 0))))
      (then
        (global.set $last_error (i32.const 87))
        (return (i32.const 0))))
    (local.set $name_len (call $dos_device_name_len (local.get $name)))
    (if (i32.lt_s (local.get $name_len) (i32.const 0))
      (then
        (global.set $last_error
          (select (i32.const 87) (i32.const 123)
            (i32.eq (local.get $name_len) (i32.const -1))))
        (return (i32.const 0))))
    (if (local.get $target)
      (then
        (local.set $source_len
          (call $dos_device_ansi_len (local.get $target) (i32.const 260)))
        (if (i32.lt_s (local.get $source_len) (i32.const 0))
          (then
            (global.set $last_error
              (select (i32.const 87) (i32.const 206)
                (i32.eq (local.get $source_len) (i32.const -1))))
            (return (i32.const 0))))))
    (if (i32.and (i32.eqz (local.get $remove))
                 (i32.or (i32.eqz (local.get $target))
                         (i32.eqz (local.get $source_len))))
      (then
        (global.set $last_error (i32.const 87))
        (return (i32.const 0))))
    (if (i32.ne (local.get $source_len) (i32.const 0))
      (then
        (local.set $target_len (call $dos_device_target_output_len
          (local.get $target) (local.get $source_len) (local.get $raw)))
        (if (i32.lt_s (local.get $target_len) (i32.const 0))
          (then
            (global.set $last_error
              (select (i32.const 206) (i32.const 123)
                (i32.eq (local.get $target_len) (i32.const -2))))
            (return (i32.const 0))))))
    (call $lock_acquire (region.addr $DOS_DEVICE_NAMESPACE 0x000))
    (block $done
      (if (local.get $remove)
        (then
          (local.set $i (i32.const 0))
          (block $find_done (loop $find
            (br_if $find_done
              (i32.ge_u (local.get $i) (global.get $DOS_DEVICE_RECORD_MAX)))
            (local.set $record (call $dos_device_record (local.get $i)))
            (local.set $seq (i32.load offset=4 (local.get $record)))
            (if (i32.and
                  (i32.and (i32.ne (i32.load (local.get $record)) (i32.const 0))
                           (i32.ne (call $dos_device_name_equals_record
                             (local.get $name) (local.get $name_len) (local.get $record))
                             (i32.const 0)))
                  (i32.and (i32.gt_u (local.get $seq) (local.get $best_seq))
                    (i32.or (i32.eqz (local.get $source_len))
                      (call $dos_device_record_target_matches
                        (local.get $record) (local.get $target) (local.get $raw)
                        (local.get $target_len) (local.get $exact)))))
              (then
                (local.set $best (local.get $record))
                (local.set $best_seq (local.get $seq))))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $find)))
          (if (i32.eqz (local.get $best))
            (then (local.set $error (i32.const 2)) (br $done)))
          (i32.store (local.get $best) (i32.const 0))
          (local.set $result (i32.const 1)))
        (else
          (local.set $i (i32.const 0))
          (block $free_done (loop $find_free
            (br_if $free_done
              (i32.ge_u (local.get $i) (global.get $DOS_DEVICE_RECORD_MAX)))
            (local.set $record (call $dos_device_record (local.get $i)))
            (if (i32.eqz (i32.load (local.get $record)))
              (then (local.set $free (local.get $record)) (br $free_done)))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $find_free)))
          (if (i32.eqz (local.get $free))
            (then (local.set $error (i32.const 8)) (br $done)))
          (local.set $seq (i32.add
            (i32.load (region.addr $DOS_DEVICE_NAMESPACE 0x008)) (i32.const 1)))
          (if (i32.eqz (local.get $seq)) (then (local.set $seq (i32.const 1))))
          (i32.store (region.addr $DOS_DEVICE_NAMESPACE 0x008) (local.get $seq))
          (call $dos_device_copy_name_to_record
            (local.get $name) (local.get $name_len) (local.get $free))
          (call $dos_device_write_target_to_record
            (local.get $target) (local.get $raw) (local.get $target_len) (local.get $free))
          (i32.store offset=4 (local.get $free) (local.get $seq))
          (i32.store offset=8 (local.get $free) (local.get $name_len))
          (i32.store offset=12 (local.get $free) (local.get $target_len))
          (i32.store (local.get $free) (i32.const 1))
          (local.set $result (i32.const 1)))))
    (call $lock_release (region.addr $DOS_DEVICE_NAMESPACE 0x000))
    (if (local.get $error) (then (global.set $last_error (local.get $error))))
    (local.get $result))

  (func $handle_QueryDosDeviceA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $query_dos_device_a
      (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_DefineDosDeviceA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $define_dos_device_a
      (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; Version-resource LANGID descriptions for the English Win98 environment.
  ;; Names: https://learn.microsoft.com/en-us/previous-versions/commerce-server/ee785500(v=cs.20)
  ;; Contract: https://learn.microsoft.com/en-us/windows/win32/api/winver/nf-winver-verlanguagenamea
  ;; Unknown identifiers are Language Neutral, not silently US English.
  (func $version_language_text (param $lang i32) (result i32)
    (if (i32.eq (local.get $lang) (i32.const 0x401)) (then (return "Arabic (Saudi Arabia)")))
    (if (i32.eq (local.get $lang) (i32.const 0x801)) (then (return "Arabic (Iraq)")))
    (if (i32.eq (local.get $lang) (i32.const 0xc01)) (then (return "Arabic (Egypt)")))
    (if (i32.eq (local.get $lang) (i32.const 0x1001)) (then (return "Arabic (Libya)")))
    (if (i32.eq (local.get $lang) (i32.const 0x1401)) (then (return "Arabic (Algeria)")))
    (if (i32.eq (local.get $lang) (i32.const 0x1801)) (then (return "Arabic (Morocco)")))
    (if (i32.eq (local.get $lang) (i32.const 0x1c01)) (then (return "Arabic (Tunisia)")))
    (if (i32.eq (local.get $lang) (i32.const 0x2001)) (then (return "Arabic (Oman)")))
    (if (i32.eq (local.get $lang) (i32.const 0x2401)) (then (return "Arabic (Yemen)")))
    (if (i32.eq (local.get $lang) (i32.const 0x2801)) (then (return "Arabic (Syria)")))
    (if (i32.eq (local.get $lang) (i32.const 0x2c01)) (then (return "Arabic (Jordan)")))
    (if (i32.eq (local.get $lang) (i32.const 0x3001)) (then (return "Arabic (Lebanon)")))
    (if (i32.eq (local.get $lang) (i32.const 0x3401)) (then (return "Arabic (Kuwait)")))
    (if (i32.eq (local.get $lang) (i32.const 0x3801)) (then (return "Arabic (U.A.E.)")))
    (if (i32.eq (local.get $lang) (i32.const 0x3c01)) (then (return "Arabic (Bahrain)")))
    (if (i32.eq (local.get $lang) (i32.const 0x4001)) (then (return "Arabic (Qatar)")))
    (if (i32.eq (local.get $lang) (i32.const 0x402)) (then (return "Bulgarian")))
    (if (i32.eq (local.get $lang) (i32.const 0x403)) (then (return "Catalan")))
    (if (i32.eq (local.get $lang) (i32.const 0x404)) (then (return "Chinese (Taiwan)")))
    (if (i32.eq (local.get $lang) (i32.const 0x804)) (then (return "Chinese (PRC)")))
    (if (i32.eq (local.get $lang) (i32.const 0xc04)) (then (return "Chinese (Hong Kong SAR)")))
    (if (i32.eq (local.get $lang) (i32.const 0x1004)) (then (return "Chinese (Singapore)")))
    (if (i32.eq (local.get $lang) (i32.const 0x405)) (then (return "Czech")))
    (if (i32.eq (local.get $lang) (i32.const 0x406)) (then (return "Danish")))
    (if (i32.eq (local.get $lang) (i32.const 0x407)) (then (return "German (Standard)")))
    (if (i32.eq (local.get $lang) (i32.const 0x807)) (then (return "German (Swiss)")))
    (if (i32.eq (local.get $lang) (i32.const 0xc07)) (then (return "German (Austrian)")))
    (if (i32.eq (local.get $lang) (i32.const 0x1007)) (then (return "German (Luxembourg)")))
    (if (i32.eq (local.get $lang) (i32.const 0x1407)) (then (return "German (Liechtenstein)")))
    (if (i32.eq (local.get $lang) (i32.const 0x408)) (then (return "Greek")))
    (if (i32.eq (local.get $lang) (i32.const 0x409)) (then (return "English (United States)")))
    (if (i32.eq (local.get $lang) (i32.const 0x809)) (then (return "English (United Kingdom)")))
    (if (i32.eq (local.get $lang) (i32.const 0xc09)) (then (return "English (Australian)")))
    (if (i32.eq (local.get $lang) (i32.const 0x1009)) (then (return "English (Canadian)")))
    (if (i32.eq (local.get $lang) (i32.const 0x1409)) (then (return "English (New Zealand)")))
    (if (i32.eq (local.get $lang) (i32.const 0x1809)) (then (return "English (Ireland)")))
    (if (i32.eq (local.get $lang) (i32.const 0x1c09)) (then (return "English (South Africa)")))
    (if (i32.eq (local.get $lang) (i32.const 0x2009)) (then (return "English (Jamaica)")))
    (if (i32.eq (local.get $lang) (i32.const 0x2409)) (then (return "English (Caribbean)")))
    (if (i32.eq (local.get $lang) (i32.const 0x2809)) (then (return "English (Belize)")))
    (if (i32.eq (local.get $lang) (i32.const 0x2c09)) (then (return "English (Trinidad)")))
    (if (i32.eq (local.get $lang) (i32.const 0x40a)) (then (return "Spanish (Traditional Sort)")))
    (if (i32.eq (local.get $lang) (i32.const 0x80a)) (then (return "Spanish (Mexican)")))
    (if (i32.eq (local.get $lang) (i32.const 0xc0a)) (then (return "Spanish (Modern Sort)")))
    (if (i32.eq (local.get $lang) (i32.const 0x100a)) (then (return "Spanish (Guatemala)")))
    (if (i32.eq (local.get $lang) (i32.const 0x140a)) (then (return "Spanish (Costa Rica)")))
    (if (i32.eq (local.get $lang) (i32.const 0x180a)) (then (return "Spanish (Panama)")))
    (if (i32.eq (local.get $lang) (i32.const 0x1c0a)) (then (return "Spanish (Dominican Republic)")))
    (if (i32.eq (local.get $lang) (i32.const 0x200a)) (then (return "Spanish (Venezuela)")))
    (if (i32.eq (local.get $lang) (i32.const 0x240a)) (then (return "Spanish (Colombia)")))
    (if (i32.eq (local.get $lang) (i32.const 0x280a)) (then (return "Spanish (Peru)")))
    (if (i32.eq (local.get $lang) (i32.const 0x2c0a)) (then (return "Spanish (Argentina)")))
    (if (i32.eq (local.get $lang) (i32.const 0x300a)) (then (return "Spanish (Ecuador)")))
    (if (i32.eq (local.get $lang) (i32.const 0x340a)) (then (return "Spanish (Chile)")))
    (if (i32.eq (local.get $lang) (i32.const 0x380a)) (then (return "Spanish (Uruguay)")))
    (if (i32.eq (local.get $lang) (i32.const 0x3c0a)) (then (return "Spanish (Paraguay)")))
    (if (i32.eq (local.get $lang) (i32.const 0x400a)) (then (return "Spanish (Bolivia)")))
    (if (i32.eq (local.get $lang) (i32.const 0x440a)) (then (return "Spanish (El Salvador)")))
    (if (i32.eq (local.get $lang) (i32.const 0x480a)) (then (return "Spanish (Honduras)")))
    (if (i32.eq (local.get $lang) (i32.const 0x4c0a)) (then (return "Spanish (Nicaragua)")))
    (if (i32.eq (local.get $lang) (i32.const 0x500a)) (then (return "Spanish (Puerto Rico)")))
    (if (i32.eq (local.get $lang) (i32.const 0x40b)) (then (return "Finnish")))
    (if (i32.eq (local.get $lang) (i32.const 0x40c)) (then (return "French (Standard)")))
    (if (i32.eq (local.get $lang) (i32.const 0x80c)) (then (return "French (Belgian)")))
    (if (i32.eq (local.get $lang) (i32.const 0xc0c)) (then (return "French (Canadian)")))
    (if (i32.eq (local.get $lang) (i32.const 0x100c)) (then (return "French (Swiss)")))
    (if (i32.eq (local.get $lang) (i32.const 0x140c)) (then (return "French (Luxembourg)")))
    (if (i32.eq (local.get $lang) (i32.const 0x40d)) (then (return "Hebrew")))
    (if (i32.eq (local.get $lang) (i32.const 0x40e)) (then (return "Hungarian")))
    (if (i32.eq (local.get $lang) (i32.const 0x40f)) (then (return "Icelandic")))
    (if (i32.eq (local.get $lang) (i32.const 0x410)) (then (return "Italian (Standard)")))
    (if (i32.eq (local.get $lang) (i32.const 0x810)) (then (return "Italian (Swiss)")))
    (if (i32.eq (local.get $lang) (i32.const 0x411)) (then (return "Japanese")))
    (if (i32.eq (local.get $lang) (i32.const 0x412)) (then (return "Korean")))
    (if (i32.eq (local.get $lang) (i32.const 0x812)) (then (return "Korean (Johab)")))
    (if (i32.eq (local.get $lang) (i32.const 0x413)) (then (return "Dutch (Standard)")))
    (if (i32.eq (local.get $lang) (i32.const 0x813)) (then (return "Dutch (Belgian)")))
    (if (i32.eq (local.get $lang) (i32.const 0x414)) (then (return "Norwegian (Bokmal)")))
    (if (i32.eq (local.get $lang) (i32.const 0x814)) (then (return "Norwegian (Nynorsk)")))
    (if (i32.eq (local.get $lang) (i32.const 0x415)) (then (return "Polish")))
    (if (i32.eq (local.get $lang) (i32.const 0x416)) (then (return "Portuguese (Brazil)")))
    (if (i32.eq (local.get $lang) (i32.const 0x816)) (then (return "Portuguese (Portugal)")))
    (if (i32.eq (local.get $lang) (i32.const 0x418)) (then (return "Romanian")))
    (if (i32.eq (local.get $lang) (i32.const 0x419)) (then (return "Russian")))
    (if (i32.eq (local.get $lang) (i32.const 0x41a)) (then (return "Croatian")))
    (if (i32.eq (local.get $lang) (i32.const 0x81a)) (then (return "Serbian (Latin)")))
    (if (i32.eq (local.get $lang) (i32.const 0xc1a)) (then (return "Serbian (Cyrillic)")))
    (if (i32.eq (local.get $lang) (i32.const 0x41b)) (then (return "Slovak")))
    (if (i32.eq (local.get $lang) (i32.const 0x41c)) (then (return "Albanian")))
    (if (i32.eq (local.get $lang) (i32.const 0x41d)) (then (return "Swedish")))
    (if (i32.eq (local.get $lang) (i32.const 0x81d)) (then (return "Swedish (Finland)")))
    (if (i32.eq (local.get $lang) (i32.const 0x41e)) (then (return "Thai")))
    (if (i32.eq (local.get $lang) (i32.const 0x41f)) (then (return "Turkish")))
    (if (i32.eq (local.get $lang) (i32.const 0x421)) (then (return "Indonesian")))
    (if (i32.eq (local.get $lang) (i32.const 0x422)) (then (return "Ukrainian")))
    (if (i32.eq (local.get $lang) (i32.const 0x423)) (then (return "Belarusian")))
    (if (i32.eq (local.get $lang) (i32.const 0x424)) (then (return "Slovenian")))
    (if (i32.eq (local.get $lang) (i32.const 0x425)) (then (return "Estonian")))
    (if (i32.eq (local.get $lang) (i32.const 0x426)) (then (return "Latvian")))
    (if (i32.eq (local.get $lang) (i32.const 0x427)) (then (return "Lithuanian")))
    (if (i32.eq (local.get $lang) (i32.const 0x429)) (then (return "Farsi")))
    (if (i32.eq (local.get $lang) (i32.const 0x42a)) (then (return "Vietnamese")))
    (if (i32.eq (local.get $lang) (i32.const 0x42d)) (then (return "Basque")))
    (if (i32.eq (local.get $lang) (i32.const 0x436)) (then (return "Afrikaans")))
    (if (i32.eq (local.get $lang) (i32.const 0x438)) (then (return "Faeroese")))
    "Language Neutral")

  (func $version_language_name (param $lang i32) (param $out i32)
      (param $capacity i32) (param $wide i32) (result i32)
    (local $text i32) (local $length i32) (local $i i32)
    (if (i32.or (i32.eqz (local.get $out)) (i32.eqz (local.get $capacity)))
      (then (return (i32.const 0))))
    (local.set $text (call $version_language_text (local.get $lang)))
    (local.set $length (call $strlen_a (local.get $text)))
    ;; Capacity counts characters including the terminator for both spellings.
    (if (i32.ge_u (local.get $length) (local.get $capacity))
      (then (local.set $length (i32.sub (local.get $capacity) (i32.const 1)))))
    (block $done (loop $copy
      (br_if $done (i32.ge_u (local.get $i) (local.get $length)))
      (call $locale_put_ascii (local.get $out) (local.get $i)
        (i32.load8_u (i32.add (local.get $text) (local.get $i))) (local.get $wide))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $copy)))
    (call $locale_put_ascii (local.get $out) (local.get $length) (i32.const 0) (local.get $wide))
    (local.get $length))

  ;; 4478: VerLanguageNameA(lang, output, capacity) -> chars excluding NUL.
  (func $handle_VerLanguageNameA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $version_language_name
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; 4479: VerLanguageNameW(lang, output, capacity) -> chars excluding NUL.
  (func $handle_VerLanguageNameW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $version_language_name
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; CreateFileA/W's whole-RTF consumer shares the per-thread IO_WAIT path.
  (func $host_fs_create_file_result (param $a0 i32) (param $a1 i32) (param $a2 i32) (param $a3 i32) (param $a4 i32) (param $a5 i32) (result i32)
    (call $host_fs_create_file_result_owned (local.get $a0) (local.get $a1) (local.get $a2) (local.get $a3) (local.get $a4) (local.get $a5) (global.get $current_thread_id)))
