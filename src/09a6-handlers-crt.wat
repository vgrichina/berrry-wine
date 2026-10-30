  ;; ============================================================
  ;; C RUNTIME / STRING FUNCTION HANDLERS
  ;; ============================================================

  (global $msvcrt_errno_ptr (mut i32) (i32.const 0))
  (global $msvcrt_signal_table (mut i32) (i32.const 0))
  (global $msvcrt_tm_ptr (mut i32) (i32.const 0))
  (global $msvcrt_getdrive_ptr (mut i32) (i32.const 0))
  (global $msvcrt_mb_cur_max_ptr (mut i32) (i32.const 0))
  (global $msvcrt_pctype_var (mut i32) (i32.const 0))

  ;; __mb_cur_max() — cdecl. Win9x ANSI DBCS pages use at most two bytes per
  ;; multibyte character; Western/OEM single-byte pages use one.
  (func $handle___mb_cur_max (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (select
        (i32.const 2)
        (i32.const 1)
        (call $is_dbcs_code_page (global.get $ansi_code_page))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; __p___mb_cur_max() — cdecl. The address of msvcrt's __mb_cur_max int,
  ;; holding the value above (MB_CUR_MAX reads it through this). 0 when no
  ;; storage could be allocated.
  (func $handle___p___mb_cur_max (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (global.get $msvcrt_mb_cur_max_ptr))
      (then (global.set $msvcrt_mb_cur_max_ptr (call $heap_alloc (i32.const 4)))))
    (if (global.get $msvcrt_mb_cur_max_ptr)
      (then (call $gs32 (global.get $msvcrt_mb_cur_max_ptr)
        (select (i32.const 2) (i32.const 1)
          (call $is_dbcs_code_page (global.get $ansi_code_page))))))
    (i32.store offset=0 (global.get $reg_base) (global.get $msvcrt_mb_cur_max_ptr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; _getdrive() — cdecl, returns 1 for A:, 2 for B:, 3 for C:, etc.
  (func $handle__getdrive (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $len i32) (local $letter i32)
    ;; The CRT uses an internal current-directory buffer too. Retain one per
    ;; process instance so this cold query does not churn the guest free list.
    (if (i32.eqz (global.get $msvcrt_getdrive_ptr))
      (then
        (global.set $msvcrt_getdrive_ptr (call $heap_alloc (i32.const 260)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (if (global.get $msvcrt_getdrive_ptr)
      (then
        (local.set $len (call $host_fs_get_current_directory
          (i32.const 260) (global.get $msvcrt_getdrive_ptr) (i32.const 0)))
        (if (i32.and
              (i32.and (i32.gt_u (local.get $len) (i32.const 1))
                       (i32.lt_u (local.get $len) (i32.const 260)))
              (i32.eq
                (call $gl8 (i32.add (global.get $msvcrt_getdrive_ptr) (i32.const 1)))
                (i32.const 0x3a)))
          (then
            (local.set $letter
              (i32.and (call $gl8 (global.get $msvcrt_getdrive_ptr)) (i32.const 0xdf)))
            (if (i32.and (i32.ge_u (local.get $letter) (i32.const 0x41))
                         (i32.le_u (local.get $letter) (i32.const 0x5a)))
              (then
                (i32.store offset=0 (global.get $reg_base) (i32.sub (local.get $letter) (i32.const 0x40)))))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; _iob() — cdecl, returns the CRT stdin/stdout/stderr FILE table: three
  ;; real 32-byte MSVCRT FILE structs (see $crt_iob_ensure).
  (func $handle__iob (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $crt_iob_ensure))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; _mbschr(str, ch) — cdecl, find first occurrence of byte in MBCS string
  (func $handle__mbschr (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32) (local $ch i32) (local $cur i32)
    (local.set $wa (call $g2w (local.get $arg0)))
    (local.set $ch (i32.and (local.get $arg1) (i32.const 0xFF)))
    (block $d (loop $l
      (local.set $cur (i32.load8_u (local.get $wa)))
      (if (i32.eq (local.get $cur) (local.get $ch))
        (then
          (i32.store offset=0 (global.get $reg_base) (i32.add (i32.sub (local.get $wa) (region.addr $GUEST_BASE 0)) (global.get $image_base)))
          (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
          (return)))
      (br_if $d (i32.eqz (local.get $cur)))
      (local.set $wa
        (i32.add (local.get $wa)
          (select
            (i32.const 2)
            (i32.const 1)
            (i32.and
              (call $is_dbcs_lead_byte (local.get $cur))
              (i32.ne (i32.load8_u (i32.add (local.get $wa) (i32.const 1))) (i32.const 0))))))
      (br $l)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; 720: _mbsrchr(str, ch) — cdecl, find last occurrence of byte in MBCS string
  (func $handle__mbsrchr (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32) (local $last i32) (local $ch i32) (local $cur i32)
    (local.set $wa (call $g2w (local.get $arg0)))
    (local.set $last (i32.const 0))
    (local.set $ch (i32.and (local.get $arg1) (i32.const 0xFF)))
    (block $d (loop $l
      (local.set $cur (i32.load8_u (local.get $wa)))
      (if (i32.eq (local.get $cur) (local.get $ch))
        (then (local.set $last (local.get $wa))))
      (br_if $d (i32.eqz (local.get $cur)))
      (local.set $wa
        (i32.add (local.get $wa)
          (select
            (i32.const 2)
            (i32.const 1)
            (i32.and
              (call $is_dbcs_lead_byte (local.get $cur))
              (i32.ne (i32.load8_u (i32.add (local.get $wa) (i32.const 1))) (i32.const 0))))))
      (br $l)))
    ;; Convert WASM addr back to guest addr, or 0 if not found
    (if (local.get $last)
      (then (i32.store offset=0 (global.get $reg_base) (i32.add (i32.sub (local.get $last) (region.addr $GUEST_BASE 0)) (global.get $image_base))))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; _mbsstr(str, substr) — cdecl. MBCS substring search: candidates start only
  ;; on character boundaries (a DBCS lead byte and its trail byte are stepped
  ;; over together, as in _mbschr), so a match can never begin on a trail
  ;; byte. The compare itself is bytewise. Returns the guest pointer to the
  ;; first match, str for an empty substr, or NULL if absent.
  (func $handle__mbsstr (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $hay_base i32) (local $hay i32) (local $needle i32)
    (local $h i32) (local $n i32) (local $cur i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (block $done
      (br_if $done (i32.or (i32.eqz (local.get $arg0)) (i32.eqz (local.get $arg1))))
      (local.set $hay_base (call $g2w (local.get $arg0)))
      (local.set $hay (local.get $hay_base))
      (local.set $needle (call $g2w (local.get $arg1)))
      (if (i32.eqz (i32.load8_u (local.get $needle)))
        (then
          (i32.store offset=0 (global.get $reg_base) (local.get $arg0))
          (br $done)))
      (loop $candidate
        (local.set $cur (i32.load8_u (local.get $hay)))
        (br_if $done (i32.eqz (local.get $cur)))
        (local.set $h (local.get $hay))
        (local.set $n (local.get $needle))
        (block $mismatch (loop $compare
          (br_if $mismatch
            (i32.ne (i32.load8_u (local.get $h)) (i32.load8_u (local.get $n))))
          (local.set $n (i32.add (local.get $n) (i32.const 1)))
          (if (i32.eqz (i32.load8_u (local.get $n)))
            (then
              (i32.store offset=0 (global.get $reg_base)
                (i32.add (local.get $arg0) (i32.sub (local.get $hay) (local.get $hay_base))))
              (br $done)))
          (local.set $h (i32.add (local.get $h) (i32.const 1)))
          (br_if $mismatch (i32.eqz (i32.load8_u (local.get $h))))
          (br $compare)))
        (local.set $hay
          (i32.add (local.get $hay)
            (select
              (i32.const 2)
              (i32.const 1)
              (i32.and
                (call $is_dbcs_lead_byte (local.get $cur))
                (i32.ne (i32.load8_u (i32.add (local.get $hay) (i32.const 1))) (i32.const 0))))))
        (br $candidate)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; Compare at most n unsigned bytes. _mbsnbcmp counts bytes rather than
  ;; characters, so unlike memcmp it stops after the shared terminating NUL.
  (func $crt_compare_bytes
      (param $s1 i32) (param $s2 i32) (param $n i32)
      (param $stop_at_nul i32) (result i32)
    (local $wa1 i32) (local $wa2 i32) (local $b1 i32) (local $b2 i32)
    (local.set $wa1 (call $g2w (local.get $s1)))
    (local.set $wa2 (call $g2w (local.get $s2)))
    (block $done (loop $cmp
      (br_if $done (i32.eqz (local.get $n)))
      (local.set $b1 (i32.load8_u (local.get $wa1)))
      (local.set $b2 (i32.load8_u (local.get $wa2)))
      (if (i32.ne (local.get $b1) (local.get $b2))
        (then (return (i32.sub (local.get $b1) (local.get $b2)))))
      (if (i32.and (local.get $stop_at_nul) (i32.eqz (local.get $b1)))
        (then (return (i32.const 0))))
      (local.set $wa1 (i32.add (local.get $wa1) (i32.const 1)))
      (local.set $wa2 (i32.add (local.get $wa2) (i32.const 1)))
      (local.set $n (i32.sub (local.get $n) (i32.const 1)))
      (br $cmp)))
    (i32.const 0))

  ;; 781: _mbsnbcmp(s1, s2, n) — cdecl, current single-byte locale.
  (func $handle__mbsnbcmp (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $crt_compare_bytes
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; memcmp(s1, s2, n) — cdecl, compare raw bytes as unsigned chars.
  (func $handle_memcmp (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $crt_compare_bytes
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; memchr(buf, ch, n) — cdecl, return a guest pointer to the first byte match.
  (func $handle_memchr (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32) (local $i i32) (local $ch i32)
    (local.set $wa (call $g2w (local.get $arg0)))
    (local.set $ch (i32.and (local.get $arg1) (i32.const 0xFF)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $arg2)))
      (if (i32.eq (i32.load8_u (i32.add (local.get $wa) (local.get $i))) (local.get $ch))
        (then
          (i32.store offset=0 (global.get $reg_base) (i32.add (local.get $arg0) (local.get $i)))
          (br $done)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; 783: SHGetFileInfoA(pszPath, dwFileAttributes, psfi, cbFileInfo, uFlags) — 5 args stdcall
  ;; Share the bounded shell-field and system-image-list implementation with W.
  (func $handle_SHGetFileInfoA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $sh_get_file_info
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
  )

  ;; 721: _mbsinc(ptr) — cdecl, advance to next MBCS character
  (func $handle__mbsinc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $mbsinc_ptr (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; 722: _strdup(str) — cdecl, allocate copy of string
  (func $handle__strdup (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $guest_strdup (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; 723: _stricmp(s1, s2) — cdecl, case-insensitive compare. The native
  ;; loop is the C-locale fold; bound over a real MSVCRT/MSVCR7x it defers to
  ;; the authentic export once setlocale has left "C", like _wcsicmp.
  (func $handle__stricmp (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa1 i32) (local $wa2 i32) (local $c1 i32) (local $c2 i32)
    (if (call $crt_locale_changed)
      (then (if (call $crt_fallback) (then (return)))))
    (local.set $wa1 (call $g2w (local.get $arg0)))
    (local.set $wa2 (call $g2w (local.get $arg1)))
    (block $d (loop $l
      (local.set $c1 (i32.load8_u (local.get $wa1)))
      (local.set $c2 (i32.load8_u (local.get $wa2)))
      ;; tolower
      (if (i32.and (i32.ge_u (local.get $c1) (i32.const 0x41)) (i32.le_u (local.get $c1) (i32.const 0x5A)))
        (then (local.set $c1 (i32.or (local.get $c1) (i32.const 0x20)))))
      (if (i32.and (i32.ge_u (local.get $c2) (i32.const 0x41)) (i32.le_u (local.get $c2) (i32.const 0x5A)))
        (then (local.set $c2 (i32.or (local.get $c2) (i32.const 0x20)))))
      (br_if $d (i32.ne (local.get $c1) (local.get $c2)))
      (br_if $d (i32.eqz (local.get $c1)))
      (local.set $wa1 (i32.add (local.get $wa1) (i32.const 1)))
      (local.set $wa2 (i32.add (local.get $wa2) (i32.const 1)))
      (br $l)))
    ;; -1/0/1, not the byte difference: the C-locale path of VC6 msvcrt,
    ;; msvcr70 and msvcr71 alike ends in sbb eax,eax / sbb eax,-1
    ;; (test-crt-native-overrides.js compares EAX against all three).
    (i32.store offset=0 (global.get $reg_base)
      (i32.sub (i32.gt_u (local.get $c1) (local.get $c2))
               (i32.lt_u (local.get $c1) (local.get $c2))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; _strnicmp(s1, s2, count) — cdecl, ASCII case-insensitive bounded compare.
  (func $handle__strnicmp (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa1 i32) (local $wa2 i32) (local $i i32)
    (local $c1 i32) (local $c2 i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (if (i32.eqz (local.get $arg2))
      (then
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (return)))
    (local.set $wa1 (call $g2w (local.get $arg0)))
    (local.set $wa2 (call $g2w (local.get $arg1)))
    (block $done (loop $compare
      (local.set $c1 (i32.load8_u (i32.add (local.get $wa1) (local.get $i))))
      (local.set $c2 (i32.load8_u (i32.add (local.get $wa2) (local.get $i))))
      (if (i32.and (i32.ge_u (local.get $c1) (i32.const 0x41))
                   (i32.le_u (local.get $c1) (i32.const 0x5a)))
        (then (local.set $c1 (i32.or (local.get $c1) (i32.const 0x20)))))
      (if (i32.and (i32.ge_u (local.get $c2) (i32.const 0x41))
                   (i32.le_u (local.get $c2) (i32.const 0x5a)))
        (then (local.set $c2 (i32.or (local.get $c2) (i32.const 0x20)))))
      (if (i32.ne (local.get $c1) (local.get $c2))
        (then
          (i32.store offset=0 (global.get $reg_base) (i32.sub (local.get $c1) (local.get $c2)))
          (br $done)))
      (br_if $done (i32.eqz (local.get $c1)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $compare (i32.lt_u (local.get $i) (local.get $arg2)))))
    ;; cdecl: the caller removes all three arguments.
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; 724: strlen(str) — cdecl
  (func $handle_strlen (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32) (local $len i32)
    (local.set $wa (call $g2w (local.get $arg0)))
    (block $d (loop $l
      (br_if $d (i32.eqz (i32.load8_u (i32.add (local.get $wa) (local.get $len)))))
      (local.set $len (i32.add (local.get $len) (i32.const 1))) (br $l)))
    (i32.store offset=0 (global.get $reg_base) (local.get $len))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; mbstowcs(dst, src, count) — cdecl, single-byte codepage approximation.
  ;; Returns converted WCHAR count excluding the terminating NUL.
  (func $handle_mbstowcs (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dst i32) (local $src i32) (local $i i32) (local $ch i32)
    (local.set $src (call $g2w (local.get $arg1)))
    (if (i32.eqz (local.get $arg0))
      (then
        (i32.store offset=0 (global.get $reg_base) (call $strlen (local.get $src)))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (return)))
    (local.set $dst (call $g2w (local.get $arg0)))
    (block $done (loop $copy
      (br_if $done (i32.ge_u (local.get $i) (local.get $arg2)))
      (local.set $ch (i32.load8_u (i32.add (local.get $src) (local.get $i))))
      (i32.store16 (i32.add (local.get $dst) (i32.shl (local.get $i) (i32.const 1))) (local.get $ch))
      (br_if $done (i32.eqz (local.get $ch)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $copy)))
    (i32.store offset=0 (global.get $reg_base) (local.get $i))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; wcstombs(dst, src, count) — cdecl, maps low byte of each WCHAR.
  ;; Returns converted byte count excluding the terminating NUL.
  (func $handle_wcstombs (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dst i32) (local $src i32) (local $i i32) (local $ch i32)
    (local.set $src (call $g2w (local.get $arg1)))
    (if (i32.eqz (local.get $arg0))
      (then
        (i32.store offset=0 (global.get $reg_base) (call $strlen_w (local.get $src)))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (return)))
    (local.set $dst (call $g2w (local.get $arg0)))
    (block $done (loop $copy
      (br_if $done (i32.ge_u (local.get $i) (local.get $arg2)))
      (local.set $ch (i32.load16_u (i32.add (local.get $src) (i32.shl (local.get $i) (i32.const 1)))))
      (i32.store8 (i32.add (local.get $dst) (local.get $i)) (local.get $ch))
      (br_if $done (i32.eqz (local.get $ch)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $copy)))
    (i32.store offset=0 (global.get $reg_base) (local.get $i))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; 725: strrchr(str, ch) — cdecl
  (func $handle_strrchr (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32) (local $last i32) (local $ch i32)
    (local.set $wa (call $g2w (local.get $arg0)))
    (local.set $ch (i32.and (local.get $arg1) (i32.const 0xFF)))
    (block $d (loop $l
      (if (i32.eq (i32.load8_u (local.get $wa)) (local.get $ch))
        (then (local.set $last (local.get $wa))))
      (br_if $d (i32.eqz (i32.load8_u (local.get $wa))))
      (local.set $wa (i32.add (local.get $wa) (i32.const 1)))
      (br $l)))
    (if (local.get $last)
      (then (i32.store offset=0 (global.get $reg_base) (i32.add (i32.sub (local.get $last) (region.addr $GUEST_BASE 0)) (global.get $image_base))))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; Is $ch one of the NUL-terminated characters at $set_wa? The span family
  ;; below all reduce to this question.
  (func $crt_char_in_set (param $set_wa i32) (param $ch i32) (result i32)
    (local $c i32)
    (block $d (loop $l
      (local.set $c (i32.load8_u (local.get $set_wa)))
      (br_if $d (i32.eqz (local.get $c)))
      (if (i32.eq (local.get $c) (local.get $ch)) (then (return (i32.const 1))))
      (local.set $set_wa (i32.add (local.get $set_wa) (i32.const 1)))
      (br $l)))
    (i32.const 0))

  ;; strspn(s, accept) — length of the initial run of s made only of accept
  ;; characters. cdecl, so only the return address comes off here.
  (func $handle_strspn (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32) (local $set i32) (local $n i32) (local $c i32)
    (local.set $wa (call $g2w (local.get $arg0)))
    (local.set $set (call $g2w (local.get $arg1)))
    (block $d (loop $l
      (local.set $c (i32.load8_u (i32.add (local.get $wa) (local.get $n))))
      (br_if $d (i32.eqz (local.get $c)))
      (br_if $d (i32.eqz (call $crt_char_in_set (local.get $set) (local.get $c))))
      (local.set $n (i32.add (local.get $n) (i32.const 1)))
      (br $l)))
    (i32.store offset=0 (global.get $reg_base) (local.get $n))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; strcspn(s, reject) — the complement: length of the initial run containing
  ;; none of the reject characters.
  (func $handle_strcspn (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32) (local $set i32) (local $n i32) (local $c i32)
    (local.set $wa (call $g2w (local.get $arg0)))
    (local.set $set (call $g2w (local.get $arg1)))
    (block $d (loop $l
      (local.set $c (i32.load8_u (i32.add (local.get $wa) (local.get $n))))
      (br_if $d (i32.eqz (local.get $c)))
      (br_if $d (call $crt_char_in_set (local.get $set) (local.get $c)))
      (local.set $n (i32.add (local.get $n) (i32.const 1)))
      (br $l)))
    (i32.store offset=0 (global.get $reg_base) (local.get $n))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; strtok(s, delim) — msvcrt keeps one continuation pointer; s == NULL
  ;; resumes from it. Leading delimiters are skipped, the token's terminating
  ;; delimiter is overwritten with NUL, and the next call resumes past it.
  ;; Byte-wise through $gl8/$gs8, since the string can cross a guest page.
  (global $crt_strtok_next (mut i32) (i32.const 0))
  (func $handle_strtok (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $s i32) (local $set i32) (local $c i32) (local $tok i32)
    (local.set $s (select (local.get $arg0) (global.get $crt_strtok_next) (i32.ne (local.get $arg0) (i32.const 0))))
    (local.set $set (call $g2w (local.get $arg1)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (block $done
      (br_if $done (i32.eqz (local.get $s)))
      (block $start (loop $skip
        (local.set $c (call $gl8 (local.get $s)))
        (br_if $start (i32.eqz (local.get $c)))
        (br_if $start (i32.eqz (call $crt_char_in_set (local.get $set) (local.get $c))))
        (local.set $s (i32.add (local.get $s) (i32.const 1)))
        (br $skip)))
      (if (i32.eqz (local.get $c))
        (then (global.set $crt_strtok_next (local.get $s)) (br $done)))
      (local.set $tok (local.get $s))
      (block $end (loop $scan
        (local.set $c (call $gl8 (local.get $s)))
        (br_if $end (i32.eqz (local.get $c)))
        (br_if $end (call $crt_char_in_set (local.get $set) (local.get $c)))
        (local.set $s (i32.add (local.get $s) (i32.const 1)))
        (br $scan)))
      (if (local.get $c)
        (then
          (call $gs8 (local.get $s) (i32.const 0))
          (local.set $s (i32.add (local.get $s) (i32.const 1)))))
      (global.set $crt_strtok_next (local.get $s))
      (i32.store offset=0 (global.get $reg_base) (local.get $tok)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; strpbrk(s, accept) — pointer to the first accept character in s, or NULL.
  (func $handle_strpbrk (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32) (local $set i32) (local $c i32)
    (local.set $wa (call $g2w (local.get $arg0)))
    (local.set $set (call $g2w (local.get $arg1)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (block $d (loop $l
      (local.set $c (i32.load8_u (local.get $wa)))
      (br_if $d (i32.eqz (local.get $c)))
      (if (call $crt_char_in_set (local.get $set) (local.get $c))
        (then
          (i32.store offset=0 (global.get $reg_base) (call $w2g (local.get $wa)))
          (br $d)))
      (local.set $wa (i32.add (local.get $wa) (i32.const 1)))
      (br $l)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; 726: strcmp(s1, s2) — cdecl
  (func $handle_strcmp (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa1 i32) (local $wa2 i32) (local $c1 i32) (local $c2 i32)
    (local.set $wa1 (call $g2w (local.get $arg0)))
    (local.set $wa2 (call $g2w (local.get $arg1)))
    (block $d (loop $l
      (local.set $c1 (i32.load8_u (local.get $wa1)))
      (local.set $c2 (i32.load8_u (local.get $wa2)))
      (br_if $d (i32.ne (local.get $c1) (local.get $c2)))
      (br_if $d (i32.eqz (local.get $c1)))
      (local.set $wa1 (i32.add (local.get $wa1) (i32.const 1)))
      (local.set $wa2 (i32.add (local.get $wa2) (i32.const 1)))
      (br $l)))
    (i32.store offset=0 (global.get $reg_base) (i32.sub (local.get $c1) (local.get $c2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; strncmp(s1, s2, count) — cdecl. Compare bytes as unsigned characters,
  ;; stopping at the first difference, a shared NUL, or count bytes.
  (func $handle_strncmp (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa1 i32) (local $wa2 i32) (local $i i32)
    (local $c1 i32) (local $c2 i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (if (i32.eqz (local.get $arg2))
      (then
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (return)))
    (local.set $wa1 (call $g2w (local.get $arg0)))
    (local.set $wa2 (call $g2w (local.get $arg1)))
    (block $done (loop $compare
      (local.set $c1 (i32.load8_u (i32.add (local.get $wa1) (local.get $i))))
      (local.set $c2 (i32.load8_u (i32.add (local.get $wa2) (local.get $i))))
      (if (i32.ne (local.get $c1) (local.get $c2))
        (then
          (i32.store offset=0 (global.get $reg_base) (i32.sub (local.get $c1) (local.get $c2)))
          (br $done)))
      (br_if $done (i32.eqz (local.get $c1)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $compare (i32.lt_u (local.get $i) (local.get $arg2)))))
    ;; cdecl: the caller removes all three arguments.
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; wcsncmp(s1, s2, count) — cdecl. Compare at most count unsigned UTF-16
  ;; code units, stopping at the first difference or a shared NUL. Keep guest
  ;; addresses intact so each load may cross a translated-page boundary.
  (func $handle_wcsncmp (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $i i32) (local $c1 i32) (local $c2 i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (block $done
      ;; A zero count compares no characters and must not dereference either
      ;; pointer. wcsncmp itself performs no invalid-parameter validation.
      (br_if $done (i32.eqz (local.get $arg2)))
      (loop $compare
        (local.set $c1 (call $gl16
          (i32.add (local.get $arg0)
            (i32.shl (local.get $i) (i32.const 1)))))
        (local.set $c2 (call $gl16
          (i32.add (local.get $arg1)
            (i32.shl (local.get $i) (i32.const 1)))))
        (if (i32.ne (local.get $c1) (local.get $c2))
          (then
            (i32.store offset=0 (global.get $reg_base) (i32.sub (local.get $c1) (local.get $c2)))
            (br $done)))
        (br_if $done (i32.eqz (local.get $c1)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br_if $compare (i32.lt_u (local.get $i) (local.get $arg2)))))
    ;; cdecl: the caller removes all three arguments.
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; 727: strcpy(dest, src) — cdecl
  (func $handle_strcpy (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dst i32) (local $src i32) (local $ch i32) (local $i i32)
    (local.set $dst (call $g2w (local.get $arg0)))
    (local.set $src (call $g2w (local.get $arg1)))
    (block $d (loop $l
      (br_if $d (i32.ge_u (local.get $i) (i32.const 65536)))
      (local.set $ch (i32.load8_u (local.get $src)))
      (i32.store8 (local.get $dst) (local.get $ch))
      (br_if $d (i32.eqz (local.get $ch)))
      (local.set $dst (i32.add (local.get $dst) (i32.const 1)))
      (local.set $src (i32.add (local.get $src) (i32.const 1)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $l)))
    (i32.store8 (local.get $dst) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; 728: strncpy(dest, src, count) — cdecl
  (func $handle_strncpy (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dst i32) (local $src i32) (local $i i32) (local $ch i32)
    (local.set $dst (call $g2w (local.get $arg0)))
    (local.set $src (call $g2w (local.get $arg1)))
    (block $d (loop $l
      (br_if $d (i32.ge_u (local.get $i) (local.get $arg2)))
      (local.set $ch (i32.load8_u (i32.add (local.get $src) (local.get $i))))
      (i32.store8 (i32.add (local.get $dst) (local.get $i)) (local.get $ch))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $l (local.get $ch))
      ;; pad with zeros -- the NUL is already stored, $i is past it, and every
      ;; remaining byte up to $arg2 gets the same value.
      (memory.fill (i32.add (local.get $dst) (local.get $i)) (i32.const 0)
        (i32.sub (local.get $arg2) (local.get $i)))))
    (i32.store offset=0 (global.get $reg_base) (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; strncat(dest, src, count) — cdecl. Appends at most `count` characters of
  ;; src (stopping early at its NUL) at dest's terminator, then ALWAYS writes a
  ;; terminator — unlike strncpy it never pads. Returns dest. Byte-wise through
  ;; $gl8/$gs8 on guest addresses, so a string straddling two sparse guest
  ;; pages stays correct. A handler body existed (Liquid War) but had no
  ;; api_table entry, so the import resolved to "unimplemented" — ScummVM's
  ;; Queen engine crashed on it at its first gameplay room.
  (func $handle_strncat (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $d i32) (local $i i32) (local $ch i32)
    (local.set $d (local.get $arg0))
    (block $end (loop $scan
      (br_if $end (i32.eqz (call $gl8 (local.get $d))))
      (local.set $d (i32.add (local.get $d) (i32.const 1)))
      (br $scan)))
    (block $done (loop $copy
      (br_if $done (i32.ge_u (local.get $i) (local.get $arg2)))
      (local.set $ch (call $gl8 (i32.add (local.get $arg1) (local.get $i))))
      (br_if $done (i32.eqz (local.get $ch)))
      (call $gs8 (i32.add (local.get $d) (local.get $i)) (local.get $ch))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $copy)))
    (call $gs8 (i32.add (local.get $d) (local.get $i)) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; 729: strcat(dest, src) — cdecl
  (func $handle_strcat (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dst i32) (local $src i32) (local $ch i32) (local $i i32)
    (local.set $dst (call $g2w (local.get $arg0)))
    ;; find end of dest
    (block $d (loop $l
      (br_if $d (i32.ge_u (local.get $i) (i32.const 65536)))
      (br_if $d (i32.eqz (i32.load8_u (local.get $dst))))
      (local.set $dst (i32.add (local.get $dst) (i32.const 1)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $l)))
    ;; copy src
    (local.set $src (call $g2w (local.get $arg1)))
    (local.set $i (i32.const 0))
    (block $d2 (loop $l2
      (br_if $d2 (i32.ge_u (local.get $i) (i32.const 65536)))
      (local.set $ch (i32.load8_u (local.get $src)))
      (i32.store8 (local.get $dst) (local.get $ch))
      (br_if $d2 (i32.eqz (local.get $ch)))
      (local.set $dst (i32.add (local.get $dst) (i32.const 1)))
      (local.set $src (i32.add (local.get $src) (i32.const 1)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $l2)))
    (i32.store8 (local.get $dst) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; 730: atoi(str) — cdecl
  (func $handle_atoi (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32) (local $val i32) (local $neg i32) (local $ch i32)
    (local.set $wa (call $g2w (local.get $arg0)))
    ;; skip whitespace
    (block $d (loop $l
      (local.set $ch (i32.load8_u (local.get $wa)))
      (br_if $d (i32.gt_u (local.get $ch) (i32.const 0x20)))
      (local.set $wa (i32.add (local.get $wa) (i32.const 1))) (br $l)))
    ;; sign
    (if (i32.eq (local.get $ch) (i32.const 0x2D)) ;; '-'
      (then (local.set $neg (i32.const 1))
            (local.set $wa (i32.add (local.get $wa) (i32.const 1))))
      (else (if (i32.eq (local.get $ch) (i32.const 0x2B))
        (then (local.set $wa (i32.add (local.get $wa) (i32.const 1)))))))
    ;; digits
    (block $d2 (loop $l2
      (local.set $ch (i32.load8_u (local.get $wa)))
      (br_if $d2 (i32.lt_u (local.get $ch) (i32.const 0x30)))
      (br_if $d2 (i32.gt_u (local.get $ch) (i32.const 0x39)))
      (local.set $val (i32.add (i32.mul (local.get $val) (i32.const 10)) (i32.sub (local.get $ch) (i32.const 0x30))))
      (local.set $wa (i32.add (local.get $wa) (i32.const 1))) (br $l2)))
    (if (local.get $neg) (then (local.set $val (i32.sub (i32.const 0) (local.get $val)))))
    (i32.store offset=0 (global.get $reg_base) (local.get $val))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $crt_digit_value (param $ch i32) (result i32)
    (if (i32.and (i32.ge_u (local.get $ch) (i32.const 0x30)) (i32.le_u (local.get $ch) (i32.const 0x39)))
      (then (return (i32.sub (local.get $ch) (i32.const 0x30)))))
    (if (i32.and (i32.ge_u (local.get $ch) (i32.const 0x41)) (i32.le_u (local.get $ch) (i32.const 0x5a)))
      (then (return (i32.add (i32.sub (local.get $ch) (i32.const 0x41)) (i32.const 10)))))
    (if (i32.and (i32.ge_u (local.get $ch) (i32.const 0x61)) (i32.le_u (local.get $ch) (i32.const 0x7a)))
      (then (return (i32.add (i32.sub (local.get $ch) (i32.const 0x61)) (i32.const 10)))))
    (i32.const -1))

  (func $crt_strto32 (param $nptr i32) (param $endptr i32) (param $base_arg i32) (result i32)
    (local $start_wa i32) (local $wa i32) (local $digits_start i32)
    (local $base i32) (local $ch i32) (local $digit i32)
    (local $neg i32) (local $any i32) (local $value i32)
    (local.set $start_wa (call $g2w (local.get $nptr)))
    (local.set $wa (local.get $start_wa))
    (block $space_done (loop $skip_space
      (local.set $ch (i32.load8_u (local.get $wa)))
      (br_if $space_done (i32.eqz (call $crt_is_space (local.get $ch))))
      (local.set $wa (i32.add (local.get $wa) (i32.const 1)))
      (br $skip_space)))
    (local.set $ch (i32.load8_u (local.get $wa)))
    (if (i32.eq (local.get $ch) (i32.const 0x2d))
      (then
        (local.set $neg (i32.const 1))
        (local.set $wa (i32.add (local.get $wa) (i32.const 1))))
      (else
        (if (i32.eq (local.get $ch) (i32.const 0x2b))
          (then (local.set $wa (i32.add (local.get $wa) (i32.const 1)))))))
    (local.set $base (local.get $base_arg))
    (if (i32.and
          (i32.or (i32.eq (local.get $base) (i32.const 0)) (i32.eq (local.get $base) (i32.const 16)))
          (i32.and
            (i32.eq (i32.load8_u (local.get $wa)) (i32.const 0x30))
            (i32.or
              (i32.eq (i32.load8_u (i32.add (local.get $wa) (i32.const 1))) (i32.const 0x78))
              (i32.eq (i32.load8_u (i32.add (local.get $wa) (i32.const 1))) (i32.const 0x58)))))
      (then
        (local.set $base (i32.const 16))
        (local.set $wa (i32.add (local.get $wa) (i32.const 2)))))
    (if (i32.eqz (local.get $base))
      (then
        (local.set $base (i32.const 10))
        (if (i32.eq (i32.load8_u (local.get $wa)) (i32.const 0x30))
          (then (local.set $base (i32.const 8))))))
    (local.set $digits_start (local.get $wa))
    (block $done (loop $digits
      (local.set $digit (call $crt_digit_value (i32.load8_u (local.get $wa))))
      (br_if $done (i32.lt_s (local.get $digit) (i32.const 0)))
      (br_if $done (i32.ge_u (local.get $digit) (local.get $base)))
      (local.set $value (i32.add (i32.mul (local.get $value) (local.get $base)) (local.get $digit)))
      (local.set $any (i32.const 1))
      (local.set $wa (i32.add (local.get $wa) (i32.const 1)))
      (br $digits)))
    (if (i32.eqz (local.get $any)) (then (local.set $wa (local.get $digits_start))))
    (if (local.get $endptr)
      (then (call $gs32 (local.get $endptr)
        (i32.add (local.get $nptr) (i32.sub (local.get $wa) (local.get $start_wa))))))
    (if (local.get $neg)
      (then (local.set $value (i32.sub (i32.const 0) (local.get $value)))))
    (local.get $value))

  (func $handle_strtol (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $crt_strto32 (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle_strtoul (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $crt_strto32 (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; atof ignores the end pointer; strtod shares the same decimal scanner.
  (func $crt_strtod_simple (param $nptr i32) (result f64)
    (call $crt_strtod_parse (local.get $nptr) (i32.const 0)))

  (func $crt_strtod_parse (param $nptr i32) (param $endptr i32) (result f64)
    (local $exp_start i32) (local $exp_digits i32)
    (local $s i32) (local $ch i32) (local $val i32)
    (local $neg i32) (local $digits i32) (local $exp_neg i32) (local $exp i32)
    (local $fval f64) (local $frac f64)
    (local.set $s (call $g2w (local.get $nptr)))
    (block $space_done (loop $skip_space
      (local.set $ch (i32.load8_u (local.get $s)))
      (br_if $space_done (i32.eqz (call $crt_is_space (local.get $ch))))
      (local.set $s (i32.add (local.get $s) (i32.const 1)))
      (br $skip_space)))
    (local.set $ch (i32.load8_u (local.get $s)))
    (if (i32.or (i32.eq (local.get $ch) (i32.const 0x2D)) (i32.eq (local.get $ch) (i32.const 0x2B)))
      (then
        (local.set $neg (i32.eq (local.get $ch) (i32.const 0x2D)))
        (local.set $s (i32.add (local.get $s) (i32.const 1)))))
    (local.set $fval (f64.const 0))
    (block $ip_done (loop $ip
      (local.set $val (call $crt_digit_value (i32.load8_u (local.get $s))))
      (br_if $ip_done (i32.or (i32.lt_s (local.get $val) (i32.const 0)) (i32.gt_u (local.get $val) (i32.const 9))))
      (local.set $fval (f64.add (f64.mul (local.get $fval) (f64.const 10))
                                (f64.convert_i32_s (local.get $val))))
      (local.set $digits (i32.add (local.get $digits) (i32.const 1)))
      (local.set $s (i32.add (local.get $s) (i32.const 1)))
      (br $ip)))
    (if (i32.eq (i32.load8_u (local.get $s)) (i32.const 0x2E))
      (then
        (local.set $s (i32.add (local.get $s) (i32.const 1)))
        (local.set $frac (f64.const 1))
        (block $fp_done (loop $fp
          (local.set $val (call $crt_digit_value (i32.load8_u (local.get $s))))
          (br_if $fp_done (i32.or (i32.lt_s (local.get $val) (i32.const 0)) (i32.gt_u (local.get $val) (i32.const 9))))
          (local.set $frac (f64.div (local.get $frac) (f64.const 10)))
          (local.set $fval (f64.add (local.get $fval)
            (f64.mul (f64.convert_i32_s (local.get $val)) (local.get $frac))))
          (local.set $digits (i32.add (local.get $digits) (i32.const 1)))
          (local.set $s (i32.add (local.get $s) (i32.const 1)))
          (br $fp)))))
    (if (local.get $digits)
      (then
        (local.set $ch (i32.load8_u (local.get $s)))
        (if (i32.or (i32.eq (local.get $ch) (i32.const 0x65)) (i32.eq (local.get $ch) (i32.const 0x45)))
          (then
            (local.set $exp_start (local.get $s))
            (local.set $s (i32.add (local.get $s) (i32.const 1)))
            (local.set $ch (i32.load8_u (local.get $s)))
            (if (i32.or (i32.eq (local.get $ch) (i32.const 0x2D)) (i32.eq (local.get $ch) (i32.const 0x2B)))
              (then
                (local.set $exp_neg (i32.eq (local.get $ch) (i32.const 0x2D)))
                (local.set $s (i32.add (local.get $s) (i32.const 1)))))
            (block $ex_done (loop $ex
              (local.set $val (call $crt_digit_value (i32.load8_u (local.get $s))))
              (br_if $ex_done (i32.or (i32.lt_s (local.get $val) (i32.const 0)) (i32.gt_u (local.get $val) (i32.const 9))))
              (local.set $exp_digits (i32.add (local.get $exp_digits) (i32.const 1)))
              (local.set $exp (i32.add (i32.mul (local.get $exp) (i32.const 10)) (local.get $val)))
              (local.set $s (i32.add (local.get $s) (i32.const 1)))
              (br $ex)))
            ;; An incomplete exponent is not part of the converted prefix.
            (if (i32.eqz (local.get $exp_digits))
              (then (local.set $s (local.get $exp_start))))
            (block $scale_done (loop $scale
              (br_if $scale_done (i32.eqz (local.get $exp)))
              (if (local.get $exp_neg)
                (then (local.set $fval (f64.div (local.get $fval) (f64.const 10))))
                (else (local.set $fval (f64.mul (local.get $fval) (f64.const 10)))))
              (local.set $exp (i32.sub (local.get $exp) (i32.const 1)))
              (br $scale)))))))
    ;; No conversion means endptr is nptr, before whitespace/sign/dot.
    (if (i32.eqz (local.get $digits))
      (then
        (local.set $s (call $g2w (local.get $nptr)))
        (local.set $neg (i32.const 0))))
    (if (local.get $endptr)
      (then (call $gs32 (local.get $endptr)
        (i32.add (local.get $nptr)
          (i32.sub (local.get $s) (call $g2w (local.get $nptr)))))))
    (if (local.get $neg) (then (return (f64.neg (local.get $fval)))))
    (local.get $fval))

  (func $handle_atof (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $fpu_push (call $crt_strtod_simple (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle_strtod (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $fpu_push (call $crt_strtod_parse (local.get $arg0) (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle_clock (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_get_ticks))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; MSVCRT double math returns through x87 ST(0). These are cdecl, so the
  ;; callee only pops the return address; the caller removes stack arguments.
  (func $handle_ceil (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $fpu_push (f64.ceil (f64.load (call $g2w (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle_sqrt (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $fpu_push (f64.sqrt (f64.load (call $g2w (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle_sin (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $fpu_push (call $host_math_sin (f64.load (call $g2w (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle_cos (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $fpu_push (call $host_math_cos (f64.load (call $g2w (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle_tan (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $fpu_push (call $host_math_tan (f64.load (call $g2w (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle_atan2 (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $fpu_push
      (call $host_math_atan2
        (f64.load (call $g2w (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))
        (f64.load (call $g2w (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle_atan (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $fpu_push
      (call $host_math_atan2
        (f64.load (call $g2w (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))
        (f64.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle_asin (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $x f64) (local $root f64)
    (local.set $x (f64.load (call $g2w (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))))
    (local.set $root (f64.sub (f64.const 1) (f64.mul (local.get $x) (local.get $x))))
    (if (f64.lt (local.get $root) (f64.const 0))
      (then (local.set $root (f64.const nan))))
    (call $fpu_push
      (call $host_math_atan2
        (local.get $x)
        (f64.sqrt (local.get $root))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle_acos (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $x f64) (local $root f64)
    (local.set $x (f64.load (call $g2w (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))))
    (local.set $root (f64.sub (f64.const 1) (f64.mul (local.get $x) (local.get $x))))
    (if (f64.lt (local.get $root) (f64.const 0))
      (then (local.set $root (f64.const nan))))
    (call $fpu_push
      (call $host_math_atan2
        (f64.sqrt (local.get $root))
        (local.get $x)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; floor(x) — cdecl, result in ST(0). For a finite x the authentic VC6-VC7.1
  ;; x87 path sets RC=down, FRNDINTs, compares the result with x (FCOMP), and
  ;; restores the caller's control word, so what it leaves behind is the
  ;; result pushed once and C0/C3 of that compare in the status word (C1 and
  ;; C2 clear). That is reproduced here. Two cases go to the authentic export
  ;; when one is behind this thunk: a NaN or infinity (its _handle_qnan1 /
  ;; _except1 paths), and an inexact result under an unmasked precision
  ;; exception, which the real code turns into a matherr report.
  (func $handle_floor (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $x f64) (local $r f64) (local $esp i32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (local.set $x (f64.reinterpret_i64 (i64.or
      (i64.extend_i32_u (call $gl32 (i32.add (local.get $esp) (i32.const 4))))
      (i64.shl (i64.extend_i32_u (call $gl32 (i32.add (local.get $esp) (i32.const 8))))
               (i64.const 32)))))
    (local.set $r (f64.floor (local.get $x)))
    (if (i32.eq (i32.and (call $gl32 (i32.add (local.get $esp) (i32.const 8))) (i32.const 0x7FF00000))
                (i32.const 0x7FF00000))
      (then (if (call $crt_fallback) (then (return))))
      (else
        (if (i32.and (f64.ne (local.get $r) (local.get $x))
                     (i32.eqz (i32.and (global.get $fpu_cw) (i32.const 0x20))))
          (then (if (call $crt_fallback) (then (return)))))
        (global.set $fpu_sw (i32.or
          (i32.and (global.get $fpu_sw) (i32.const 0xB8FF))
          (select (i32.const 0x0100) (i32.const 0x4000)
            (f64.lt (local.get $r) (local.get $x)))))))
    (call $fpu_push (local.get $r))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle_fabs (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $fpu_push (f64.abs (f64.load (call $g2w (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle_log (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $fpu_push
      (f64.mul
        (call $host_math_log2 (f64.load (call $g2w (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))))
        (f64.const 0.69314718055994530942)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle_exp (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $fpu_push
      (call $host_math_pow2
        (f64.div
          (f64.load (call $g2w (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))
          (f64.const 0.69314718055994530942))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle_fmod (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $x f64) (local $y f64)
    (local.set $x (f64.load (call $g2w (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))))
    (local.set $y (f64.load (call $g2w (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))))
    (call $fpu_push
      (f64.sub
        (local.get $x)
        (f64.mul
          (f64.trunc (f64.div (local.get $x) (local.get $y)))
          (local.get $y))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle_frexp (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $x f64) (local $absx f64) (local $exp i32)
    (local.set $x (f64.load (call $g2w (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))))
    (local.set $absx (f64.abs (local.get $x)))
    (if (f64.eq (local.get $x) (f64.const 0))
      (then
        (if (local.get $arg1) (then (call $gs32 (local.get $arg1) (i32.const 0))))
        (call $fpu_push (f64.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (return)))
    (local.set $exp
      (i32.add
        (i32.trunc_f64_s
          (f64.floor (call $host_math_log2 (local.get $absx))))
        (i32.const 1)))
    (if (local.get $arg1) (then (call $gs32 (local.get $arg1) (local.get $exp))))
    (call $fpu_push
      (f64.div
        (local.get $x)
        (call $host_math_pow2 (f64.convert_i32_s (local.get $exp)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle_ldexp (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $fpu_push
      (f64.mul
        (f64.load (call $g2w (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))
        (call $host_math_pow2
          (f64.convert_i32_s (i32.load (call $g2w (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle_log10 (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $fpu_push
      (f64.div
        (call $host_math_log2 (f64.load (call $g2w (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))))
        (f64.const 3.32192809488736234787)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle_pow (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $fpu_push
      (call $host_math_pow
        (f64.load (call $g2w (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))
        (f64.load (call $g2w (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; _CIpow is MSVC's x87-stack helper: ST(1)=base, ST(0)=exponent.
  (func $handle__CIpow (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $exponent f64) (local $base f64)
    (local.set $exponent (call $fpu_pop))
    (local.set $base (call $fpu_pop))
    (call $fpu_push (call $host_math_pow (local.get $base) (local.get $exponent)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; _CIfmod is the corresponding MSVC x87-stack remainder helper:
  ;; ST(1)=dividend, ST(0)=divisor, with one result left in ST(0).
  (func $handle__CIfmod (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $divisor f64) (local $dividend f64)
    (local.set $divisor (call $fpu_pop))
    (local.set $dividend (call $fpu_pop))
    (call $fpu_push
      (f64.sub
        (local.get $dividend)
        (f64.mul
          (f64.trunc (f64.div (local.get $dividend) (local.get $divisor)))
          (local.get $divisor))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; 759: _ftol — cdecl MSVC helper, ST(0) -> signed i64 in EDX:EAX.
  ;;
  ;; Win98 MSVCRT saves the caller's control word, temporarily selects truncate
  ;; rounding, executes FISTP qword, restores the control word, then returns the
  ;; two halves.  Keep those observable semantics here; callers commonly use
  ;; only EAX, but returning a 32-bit value and leaving stale EDX is not the ABI.
  (func $handle__ftol (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $saved_cw i32) (local $value i64)
    (local.set $saved_cw (global.get $fpu_cw))
    (global.set $fpu_cw (i32.or (local.get $saved_cw) (i32.const 0x0C00)))
    (local.set $value (call $fpu_to_i64 (call $fpu_pop)))
    (global.set $fpu_cw (local.get $saved_cw))
    (i32.store offset=0 (global.get $reg_base) (i32.wrap_i64 (local.get $value)))
    (i32.store offset=8 (global.get $reg_base) (i32.wrap_i64 (i64.shr_u (local.get $value) (i64.const 32))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; 732: sprintf(buf, fmt, ...) — cdecl. It shares the currently-supported
  ;; conversion engine with wsprintfA, but keeps a distinct policy wrapper:
  ;; User32 documents a 1024-byte buffer contract while sprintf has no size
  ;; argument. Do not turn the public front doors into aliases.
  (func $handle_sprintf (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $sprintf_impl
      (local.get $arg0) (local.get $arg1) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))
    ;; cdecl: only pop return address
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; CRTDLL _vsnprintf(buffer, count, format, argptr) — cdecl.
  ;;
  ;; The shared formatter writes an unbounded temporary result. Copy at most
  ;; count bytes into the caller's buffer and preserve the Win9x CRT behavior:
  ;; a truncated result is not NUL-terminated and returns -1.
  (func $handle__vsnprintf (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $scratch i32) (local $written i32) (local $copy_len i32)
    (if (i32.or (i32.eqz (local.get $arg0)) (i32.eqz (local.get $arg2)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (return)))
    ;; Installer-era CRT log messages are small; 64 KiB gives the existing
    ;; unbounded formatter ample headroom before the bounded copy below.
    (local.set $scratch (call $heap_alloc (i32.const 65536)))
    (if (i32.eqz (local.get $scratch))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (return)))
    (local.set $written
      (call $sprintf_impl (local.get $scratch) (local.get $arg2) (local.get $arg3)))
    (local.set $copy_len
      (select (local.get $arg1) (local.get $written)
        (i32.gt_u (local.get $written) (local.get $arg1))))
    (if (local.get $copy_len)
      (then
        (call $memcpy (call $g2w (local.get $arg0))
          (call $g2w (local.get $scratch)) (local.get $copy_len))))
    (if (i32.lt_u (local.get $written) (local.get $arg1))
      (then
        (call $gs8 (i32.add (local.get $arg0) (local.get $written)) (i32.const 0))
        (i32.store offset=0 (global.get $reg_base) (local.get $written)))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const -1))))
    (call $heap_free (local.get $scratch))
    ;; cdecl: the caller removes all four arguments.
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; ---- MSVCRT FILE streams ---------------------------------------------
  ;; Every FILE* this CRT hands out is a real 32-byte MSVCRT FILE in guest
  ;; memory, because MSVC-compiled code reads it directly: getc/putc, feof and
  ;; ferror are macros over these fields. Winamp 2.91 inlines feof as
  ;; `test byte [FILE+0xc],0x10` (0x41a598) and spun forever on a bare handle.
  ;;   +0x00 _ptr   +0x04 _cnt      +0x08 _base    +0x0c _flag
  ;;   +0x10 _file  +0x14 _charbuf  +0x18 _bufsiz  +0x1c _tmpfname
  ;; Streams are unbuffered, laid out exactly as MSVCRT lays out an _IONBF
  ;; stream: _base = _ptr = &_charbuf, _bufsiz = 2, _cnt = 0, _IONBF in _flag.
  ;; An inline getc/putc therefore always falls through to the library, and
  ;; every operation reaches the VFS synchronously. _flag carries the real
  ;; bits -- _IOREAD 0x1, _IOWRT 0x2, _IONBF 0x4, _IOEOF 0x10, _IOERR 0x20,
  ;; _IOSTRG 0x40, _IORW 0x80 -- moved through MSVCRT's _filbuf/_flsbuf
  ;; transitions. _file holds the VFS handle: this CRT's _open/_read/_write
  ;; also traffic in raw handles, so the descriptor view stays consistent.
  ;; Text-mode CRLF translation is not performed (bytes pass through).
  ;;
  ;; Ownership is process-shared, not a per-WASM-instance global: a stream
  ;; opened by a Worker must be visible to cleanup on the main thread.
  ;; $CRT_STREAM_STATE: recursive lock at +0/+4, record list at +8, the _iob
  ;; table's guest pointer at +12. A record is 48 bytes:
  ;;   +0 next  +4 handle  +8 the FILE* it describes  +12 aux  +16 FILE storage
  ;; aux bit0 = append ('a' mode: seek to the end before every write, as
  ;; O_APPEND does), bit1 = standard stream (its FILE lives in _iob). A
  ;; standard stream whose handle is 0 writes to the console std handle; a
  ;; freopen gives it a VFS handle instead.
  ;; Never hold the list lock across host RPC or heap allocation/free.
  (global $CRT_STREAM_STATE i32 (region.addr $CRT_STREAM_STATE 0))
  (global $CRT_STREAM_STATE_SIZE i32 (region.size $CRT_STREAM_STATE))

  ;; FILE* -> its stream record (guest pointer), or 0 when this CRT did not
  ;; hand that pointer out. Nothing is ever written through an unknown FILE*.
  (func $crt_stream_lookup (param $file i32) (result i32)
    (local $node i32) (local $node_w i32)
    (if (i32.eqz (local.get $file)) (then (return (i32.const 0))))
    (call $lock_acquire (global.get $CRT_STREAM_STATE))
    (local.set $node (i32.load offset=8 (global.get $CRT_STREAM_STATE)))
    (block $done (loop $scan
      (br_if $done (i32.eqz (local.get $node)))
      (local.set $node_w (call $g2w (local.get $node)))
      (br_if $done (i32.eq (i32.load offset=8 (local.get $node_w)) (local.get $file)))
      (local.set $node (i32.load (local.get $node_w)))
      (br $scan)))
    (call $lock_release (global.get $CRT_STREAM_STATE))
    (local.get $node))

  (func $crt_stream_unlink (param $rec i32)
    (local $link_w i32) (local $node i32)
    (call $lock_acquire (global.get $CRT_STREAM_STATE))
    (local.set $link_w (region.addr $CRT_STREAM_STATE 8))
    (block $done (loop $scan
      (local.set $node (i32.load (local.get $link_w)))
      (br_if $done (i32.eqz (local.get $node)))
      (if (i32.eq (local.get $node) (local.get $rec))
        (then
          (i32.store (local.get $link_w) (i32.load (call $g2w (local.get $node))))
          (br $done)))
      (local.set $link_w (call $g2w (local.get $node)))
      (br $scan)))
    (call $lock_release (global.get $CRT_STREAM_STATE)))

  (func $crt_stream_link (param $rec i32)
    (call $lock_acquire (global.get $CRT_STREAM_STATE))
    (i32.store (call $g2w (local.get $rec)) (i32.load offset=8 (global.get $CRT_STREAM_STATE)))
    (i32.store offset=8 (global.get $CRT_STREAM_STATE) (local.get $rec))
    (call $lock_release (global.get $CRT_STREAM_STATE)))

  ;; Fill a FILE as MSVCRT leaves a freshly opened unbuffered stream.
  (func $crt_file_init (param $file i32) (param $handle i32) (param $flags i32)
    (call $gs32 (local.get $file) (i32.add (local.get $file) (i32.const 0x14)))       ;; _ptr
    (call $gs32 (i32.add (local.get $file) (i32.const 0x04)) (i32.const 0))          ;; _cnt
    (call $gs32 (i32.add (local.get $file) (i32.const 0x08))
      (i32.add (local.get $file) (i32.const 0x14)))                                  ;; _base
    (call $gs32 (i32.add (local.get $file) (i32.const 0x0c))
      (i32.or (local.get $flags) (i32.const 0x04)))                                  ;; _flag | _IONBF
    (call $gs32 (i32.add (local.get $file) (i32.const 0x10)) (local.get $handle))    ;; _file
    (call $gs32 (i32.add (local.get $file) (i32.const 0x14)) (i32.const 0))          ;; _charbuf
    (call $gs32 (i32.add (local.get $file) (i32.const 0x18)) (i32.const 2))          ;; _bufsiz
    (call $gs32 (i32.add (local.get $file) (i32.const 0x1c)) (i32.const 0)))         ;; _tmpfname

  (func $crt_file_flags (param $file i32) (result i32)
    (call $gl32 (i32.add (local.get $file) (i32.const 0x0c))))

  (func $crt_file_set_flags (param $file i32) (param $flags i32)
    (call $gs32 (i32.add (local.get $file) (i32.const 0x0c)) (local.get $flags)))

  ;; An unbuffered stream has nothing in hand after any operation.
  (func $crt_file_reset_buffer (param $file i32)
    (call $gs32 (local.get $file) (call $gl32 (i32.add (local.get $file) (i32.const 0x08))))
    (call $gs32 (i32.add (local.get $file) (i32.const 0x04)) (i32.const 0)))

  ;; fopen mode string -> initial _flag bits, or 0 for an invalid mode.
  ;; 'r' reads, 'w'/'a' write, and a '+' anywhere after makes it _IORW alone.
  (func $crt_mode_flags (param $mode i32) (result i32)
    (local $c i32) (local $flags i32) (local $p i32)
    (if (i32.eqz (local.get $mode)) (then (return (i32.const 0))))
    (local.set $c (call $gl8 (local.get $mode)))
    (if (i32.eq (local.get $c) (i32.const 0x72)) ;; r
      (then (local.set $flags (i32.const 0x01)))
      (else
        (if (i32.or (i32.eq (local.get $c) (i32.const 0x77))   ;; w
                    (i32.eq (local.get $c) (i32.const 0x61)))  ;; a
          (then (local.set $flags (i32.const 0x02)))
          (else (return (i32.const 0))))))
    (local.set $p (i32.add (local.get $mode) (i32.const 1)))
    (block $done (loop $scan
      (local.set $c (call $gl8 (local.get $p)))
      (br_if $done (i32.eqz (local.get $c)))
      (if (i32.eq (local.get $c) (i32.const 0x2b)) ;; +
        (then (local.set $flags (i32.const 0x80))))
      (local.set $p (i32.add (local.get $p) (i32.const 1)))
      (br $scan)))
    (local.get $flags))

  (func $crt_mode_is_append (param $mode i32) (result i32)
    (i32.eq (call $gl8 (local.get $mode)) (i32.const 0x61)))

  ;; Open the VFS file behind a validated mode; -1 on failure.
  (func $crt_open_stream_handle (param $path i32) (param $mode i32) (result i32)
    (local $c i32) (local $creation i32) (local $handle i32)
    (local.set $c (call $gl8 (local.get $mode)))
    (local.set $creation (i32.const 3))                  ;; OPEN_EXISTING
    (if (i32.eq (local.get $c) (i32.const 0x77))         ;; w
      (then (local.set $creation (i32.const 2))))        ;; CREATE_ALWAYS
    (if (i32.eq (local.get $c) (i32.const 0x61))         ;; a
      (then (local.set $creation (i32.const 4))))        ;; OPEN_ALWAYS
    (local.set $handle (call $host_fs_create_file
      (call $g2w (local.get $path))
      (i32.const 0xC0000000) ;; GENERIC_READ | GENERIC_WRITE
      (local.get $creation)
      (i32.const 0x80)
      (i32.const 0)))
    (if (i32.and (i32.ne (local.get $handle) (i32.const -1))
                 (call $crt_mode_is_append (local.get $mode)))
      (then (drop (call $host_fs_set_file_pointer
        (local.get $handle) (i32.const 0) (i32.const 2)))))
    (local.get $handle))

  (func $crt_fopen (param $path i32) (param $mode i32) (result i32)
    (local $flags i32) (local $rec i32) (local $rec_w i32) (local $handle i32)
    (local $file i32)
    (if (i32.eqz (local.get $path)) (then (return (i32.const 0))))
    (local.set $flags (call $crt_mode_flags (local.get $mode)))
    (if (i32.eqz (local.get $flags)) (then (return (i32.const 0))))
    ;; Reserve ownership before opening so OOM cannot leak an untracked stream.
    (local.set $rec (call $heap_alloc (i32.const 48)))
    (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
    (local.set $handle (call $crt_open_stream_handle (local.get $path) (local.get $mode)))
    (if (i32.eq (local.get $handle) (i32.const -1))
      (then (call $heap_free (local.get $rec)) (return (i32.const 0))))
    (local.set $file (i32.add (local.get $rec) (i32.const 16)))
    (local.set $rec_w (call $g2w (local.get $rec)))
    (i32.store offset=4 (local.get $rec_w) (local.get $handle))
    (i32.store offset=8 (local.get $rec_w) (local.get $file))
    (i32.store offset=12 (local.get $rec_w) (call $crt_mode_is_append (local.get $mode)))
    (call $crt_file_init (local.get $file) (local.get $handle) (local.get $flags))
    (call $crt_stream_link (local.get $rec))
    (local.get $file))

  ;; Bounded fdopen grammar: [rwa](b[+]?|[+]b), with text/default
  ;; recognized but explicitly unsupported (-1). Malformed strings return 0.
  ;; Positive result: FILE flags in low byte, append request in bit 8.
  (func $crt_fdopen_mode (param $mode i32) (result i32)
    (local $first i32) (local $c i32) (local $i i32)
    (local $flags i32) (local $translation i32) (local $plus i32)
    (if (i32.eqz (local.get $mode)) (then (return (i32.const 0))))
    (local.set $first (call $gl8 (local.get $mode)))
    (if (i32.eq (local.get $first) (i32.const 114))
      (then (local.set $flags (i32.const 1)))
      (else
        (if (i32.or (i32.eq (local.get $first) (i32.const 119))
                     (i32.eq (local.get $first) (i32.const 97)))
          (then (local.set $flags (i32.const 2)))
          (else (return (i32.const 0))))))
    (local.set $i (i32.const 1))
    (block $done (loop $scan
      (local.set $c (call $gl8 (i32.add (local.get $mode) (local.get $i))))
      (br_if $done (i32.eqz (local.get $c)))
      (if (i32.ge_u (local.get $i) (i32.const 3)) (then (return (i32.const 0))))
      (if (i32.eq (local.get $c) (i32.const 43))
        (then
          (if (local.get $plus) (then (return (i32.const 0))))
          (local.set $plus (i32.const 1)))
        (else
          (if (i32.or (i32.eq (local.get $c) (i32.const 98))
                       (i32.eq (local.get $c) (i32.const 116)))
            (then
              (if (local.get $translation) (then (return (i32.const 0))))
              (local.set $translation (local.get $c)))
            (else (return (i32.const 0))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (if (i32.ne (local.get $translation) (i32.const 98)) (then (return (i32.const -1))))
    (i32.or
      (select (i32.const 128) (local.get $flags) (local.get $plus))
      (select (i32.const 256) (i32.const 0) (i32.eq (local.get $first) (i32.const 97)))))

  ;; Return NULL with errno, including safe OOM when no errno cell exists yet.
  (func $crt_fdopen_error (param $error i32) (result i32)
    (if (i32.eqz (global.get $msvcrt_errno_ptr))
      (then (global.set $msvcrt_errno_ptr (call $heap_alloc (i32.const 4)))))
    (if (global.get $msvcrt_errno_ptr)
      (then (call $gs32 (global.get $msvcrt_errno_ptr) (local.get $error))))
    (i32.const 0))

  (func $crt_fdopen (param $fd i32) (param $mode i32) (param $name_ptr i32) (result i32)
    (local $parsed i32) (local $state i32) (local $rights i32) (local $append i32)
    (local $rec i32) (local $rec_w i32) (local $file i32) (local $error i32)
    (local.set $parsed (call $crt_fdopen_mode (local.get $mode)))
    (if (i32.eqz (local.get $parsed)) (then (return (call $crt_fdopen_error (i32.const 22)))))
    (if (i32.eq (local.get $parsed) (i32.const -1))
      (then (call $crash_unimplemented (local.get $name_ptr)) (unreachable)))
    (local.set $state (call $host_fs_crt_descriptor_query (local.get $fd)))
    (if (i32.eqz (local.get $state)) (then (return (call $crt_fdopen_error (i32.const 9)))))
    (local.set $append (i32.ne (i32.and (local.get $parsed) (i32.const 256)) (i32.const 0)))
    ;; Never silently translate text/default descriptors as binary, nor invent
    ;; append flag mutation. Append mode needs an existing _O_APPEND fd.
    (if (i32.or (i32.eqz (i32.and (local.get $state) (i32.const 8)))
          (i32.and (local.get $append) (i32.eqz (i32.and (local.get $state) (i32.const 64)))))
      (then (call $crash_unimplemented (local.get $name_ptr)) (unreachable)))
    (local.set $rights
      (if (result i32) (i32.and (local.get $parsed) (i32.const 128))
        (then (i32.const 6))
        (else (select (i32.const 2) (i32.const 4) (i32.and (local.get $parsed) (i32.const 1))))))
    (if (i32.ne (i32.and (local.get $state) (local.get $rights)) (local.get $rights))
      (then (return (call $crt_fdopen_error (i32.const 13)))))
    (local.set $rec (call $heap_alloc (i32.const 48)))
    (if (i32.eqz (local.get $rec)) (then (return (call $crt_fdopen_error (i32.const 12)))))
    (local.set $file (i32.add (local.get $rec) (i32.const 16)))
    (local.set $rec_w (call $g2w (local.get $rec)))
    (i32.store offset=4 (local.get $rec_w) (local.get $fd))
    (i32.store offset=8 (local.get $rec_w) (local.get $file))
    ;; Append remains in the descriptor: no separate seek RPC before writes.
    (i32.store offset=12 (local.get $rec_w) (i32.const 0))
    (call $crt_file_init (local.get $file) (local.get $fd)
      (i32.and (local.get $parsed) (i32.const 255)))
    ;; Revalidate live identity/access and reserve unique FILE ownership AFTER
    ;; allocation. No list lock spans this synchronous main-host operation.
    (local.set $error (call $host_fs_crt_descriptor_adopt
      (local.get $fd) (local.get $rights) (local.get $append) (local.get $file)))
    (if (local.get $error)
      (then
        (call $heap_free (local.get $rec))
        (if (i32.eq (local.get $error) (i32.const -1))
          (then (call $crash_unimplemented (local.get $name_ptr)) (unreachable)))
        (return (call $crt_fdopen_error (local.get $error)))))
    (call $crt_stream_link (local.get $rec))
    (local.get $file))

  (func $handle__fdopen (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base)
      (call $crt_fdopen (local.get $arg0) (local.get $arg1) (local.get $name_ptr)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  ;; The _iob table: stdin, stdout, stderr as three consecutive FILEs, each
  ;; with a standard-stream record. Created once per process.
  (func $crt_iob_ensure (result i32)
    (local $iob i32) (local $recs i32) (local $i i32) (local $file i32)
    (local $rec i32) (local $rec_w i32) (local $winner i32)
    (local.set $iob (i32.atomic.load offset=12 (global.get $CRT_STREAM_STATE)))
    (if (local.get $iob) (then (return (local.get $iob))))
    (local.set $iob (call $heap_alloc (i32.const 96)))
    (if (i32.eqz (local.get $iob)) (then (return (i32.const 0))))
    (local.set $recs (call $heap_alloc (i32.const 144)))
    (if (i32.eqz (local.get $recs))
      (then (call $heap_free (local.get $iob)) (return (i32.const 0))))
    (call $zero_memory (call $g2w (local.get $iob)) (i32.const 96))
    (call $zero_memory (call $g2w (local.get $recs)) (i32.const 144))
    (block $done (loop $init
      (br_if $done (i32.ge_u (local.get $i) (i32.const 3)))
      (local.set $file (i32.add (local.get $iob) (i32.shl (local.get $i) (i32.const 5))))
      ;; stdin _IOREAD, stdout/stderr _IOWRT; _file is the descriptor number.
      (call $crt_file_set_flags (local.get $file)
        (select (i32.const 0x01) (i32.const 0x02) (i32.eqz (local.get $i))))
      (call $gs32 (i32.add (local.get $file) (i32.const 0x10)) (local.get $i))
      (local.set $rec_w (call $g2w
        (i32.add (local.get $recs) (i32.mul (local.get $i) (i32.const 48)))))
      (i32.store offset=8 (local.get $rec_w) (local.get $file))
      (i32.store offset=12 (local.get $rec_w) (i32.const 2))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $init)))
    (call $lock_acquire (global.get $CRT_STREAM_STATE))
    (local.set $winner (i32.load offset=12 (global.get $CRT_STREAM_STATE)))
    (if (i32.eqz (local.get $winner))
      (then
        (local.set $i (i32.const 0))
        (block $done (loop $link
          (br_if $done (i32.ge_u (local.get $i) (i32.const 3)))
          (local.set $rec (i32.add (local.get $recs) (i32.mul (local.get $i) (i32.const 48))))
          (i32.store (call $g2w (local.get $rec)) (i32.load offset=8 (global.get $CRT_STREAM_STATE)))
          (i32.store offset=8 (global.get $CRT_STREAM_STATE) (local.get $rec))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $link)))
        (i32.atomic.store offset=12 (global.get $CRT_STREAM_STATE) (local.get $iob))))
    (call $lock_release (global.get $CRT_STREAM_STATE))
    (if (local.get $winner)
      (then
        (call $heap_free (local.get $recs))
        (call $heap_free (local.get $iob))
        (return (local.get $winner))))
    (local.get $iob))

  ;; CRTDLL's _iob is an exported FILE array, not a callable accessor. Restrict
  ;; this import rule to that module/symbol pair: another vendor's _iob must
  ;; still resolve normally. Both loader paths pass linear-memory string ptrs.
  ;; The shared publisher above owns allocation, initialization and list links;
  ;; no loader-private table or per-thread replica may be introduced here.
  (func $resolve_crtdll_iob_import (param $dll_wa i32) (param $name_wa i32) (result i32)
    (local $iob i32)
    (if (i32.eqz (call $str_eq (local.get $name_wa) "_iob"))
      (then (return (i32.const 0))))
    (if (i32.ne (i32.or (i32.load (local.get $dll_wa)) (i32.const 0x20202020))
                 (i32.const 0x64747263)) ;; crtd
      (then (return (i32.const 0))))
    (if (i32.ne (i32.or (i32.load offset=4 (local.get $dll_wa)) (i32.const 0x20202020))
                 (i32.const 0x642e6c6c)) ;; ll.d
      (then (return (i32.const 0))))
    (if (i32.ne (i32.or (i32.load16_u offset=8 (local.get $dll_wa)) (i32.const 0x2020))
                 (i32.const 0x6c6c)) ;; ll
      (then (return (i32.const 0))))
    (if (i32.load8_u offset=10 (local.get $dll_wa))
      (then (return (i32.const 0))))
    (local.set $iob (call $crt_iob_ensure))
    ;; Allocation failure must not fall back to a callable thunk for data.
    (if (i32.eqz (local.get $iob)) (then (unreachable)))
    (local.get $iob))

  ;; A standard stream that was never reopened talks to the console.
  (func $crt_stream_is_console (param $rec i32) (result i32)
    (local $rec_w i32)
    (local.set $rec_w (call $g2w (local.get $rec)))
    (i32.and (i32.eqz (i32.load offset=4 (local.get $rec_w)))
             (i32.ne (i32.and (i32.load offset=12 (local.get $rec_w)) (i32.const 2)) (i32.const 0))))

  ;; The host handle behind a record, or 0 when there is none.
  (func $crt_stream_handle (param $rec i32) (result i32)
    (local $rec_w i32) (local $handle i32) (local $fd i32)
    (local.set $rec_w (call $g2w (local.get $rec)))
    (local.set $handle (i32.load offset=4 (local.get $rec_w)))
    (if (local.get $handle) (then (return (local.get $handle))))
    (if (i32.eqz (i32.and (i32.load offset=12 (local.get $rec_w)) (i32.const 2)))
      (then (return (i32.const 0))))
    (local.set $fd (i32.shr_u
      (i32.sub (i32.load offset=8 (local.get $rec_w))
               (i32.atomic.load offset=12 (global.get $CRT_STREAM_STATE)))
      (i32.const 5)))
    ;; STD_INPUT_HANDLE = -10, STD_OUTPUT_HANDLE = -11, STD_ERROR_HANDLE = -12
    (local.set $handle (call $console_std_handle_get (i32.sub (i32.const -10) (local.get $fd))))
    (select (i32.const 0) (local.get $handle) (i32.eq (local.get $handle) (i32.const -1))))

  ;; Write to a raw VFS handle; bytes written, or -1. The written-count out
  ;; parameter borrows the dword just below the guest ESP.
  (func $crt_handle_write (param $handle i32) (param $buf i32) (param $len i32) (result i32)
    (local $bytes_ga i32) (local $bytes_wa i32)
    (local.set $bytes_ga (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (local.set $bytes_wa (call $g2w (local.get $bytes_ga)))
    (i32.store (local.get $bytes_wa) (i32.const 0))
    (if (i32.or (i32.eqz (local.get $handle)) (i32.eqz (local.get $buf)))
      (then (return (i32.const -1))))
    (if (call $host_fs_write_file
          (local.get $handle) (local.get $buf) (local.get $len)
          (local.get $bytes_ga))
      (then (return (i32.load (local.get $bytes_wa)))))
    (i32.const -1)
  )

  ;; fwrite/fputs/fputc/fprintf core: MSVCRT's _flsbuf state checks, then an
  ;; unbuffered write. Returns bytes written, or -1 (with _IOERR set on a
  ;; stream we own; an unknown FILE* is never written through).
  (func $crt_file_write (param $file i32) (param $buf i32) (param $len i32) (result i32)
    (local $rec i32) (local $flags i32) (local $handle i32) (local $written i32)
    (local.set $rec (call $crt_stream_lookup (local.get $file)))
    (if (i32.eqz (local.get $rec)) (then (return (i32.const -1))))
    (local.set $flags (call $crt_file_flags (local.get $file)))
    (if (i32.or (i32.eqz (i32.and (local.get $flags) (i32.const 0x82)))  ;; !_IOWRT && !_IORW
                (i32.ne (i32.and (local.get $flags) (i32.const 0x40)) (i32.const 0))) ;; _IOSTRG
      (then
        (call $crt_file_set_flags (local.get $file) (i32.or (local.get $flags) (i32.const 0x20)))
        (return (i32.const -1))))
    (if (i32.and (local.get $flags) (i32.const 0x01)) ;; was reading (an _IORW stream)
      (then
        (if (i32.and (local.get $flags) (i32.const 0x10))
          ;; Reading reached EOF: switching direction is allowed.
          (then (local.set $flags (i32.and (local.get $flags) (i32.const -2))))
          (else
            (call $crt_file_set_flags (local.get $file) (i32.or (local.get $flags) (i32.const 0x20)))
            (return (i32.const -1))))))
    (call $crt_file_set_flags (local.get $file)
      (i32.and (i32.or (local.get $flags) (i32.const 0x02)) (i32.const -17))) ;; |_IOWRT, ~_IOEOF
    (call $crt_file_reset_buffer (local.get $file))
    (if (i32.eqz (local.get $len)) (then (return (i32.const 0))))
    (if (call $crt_stream_is_console (local.get $rec))
      (then
        (local.set $handle (call $crt_stream_handle (local.get $rec)))
        (local.set $written (i32.const -1))
        (if (i32.ne (local.get $handle) (i32.const 0))
          (then
            (if (i32.ne (call $console_buffer_record (local.get $handle)) (i32.const 0))
              (then
                (if (call $console_write (local.get $handle) (local.get $buf) (local.get $len) (i32.const 0))
                  (then (local.set $written (local.get $len)))))))))
      (else
        (local.set $handle (call $crt_stream_handle (local.get $rec)))
        (if (i32.and (i32.load offset=12 (call $g2w (local.get $rec))) (i32.const 1)) ;; append
          (then (drop (call $host_fs_set_file_pointer
            (local.get $handle) (i32.const 0) (i32.const 2)))))
        (local.set $written (call $crt_handle_write
          (local.get $handle) (local.get $buf) (local.get $len)))))
    (if (i32.ne (local.get $written) (local.get $len))
      (then (call $crt_file_set_flags (local.get $file)
        (i32.or (call $crt_file_flags (local.get $file)) (i32.const 0x20)))))
    (local.get $written))

  ;; fread/fgets core: MSVCRT's _filbuf state checks, then an unbuffered read.
  ;; Returns bytes read (a short count sets _IOEOF, a failure _IOERR), -1 for
  ;; a FILE* this CRT does not own, or $CRT_READ_PARKED when the bytes are in
  ;; a lazy file chunk that has not arrived. The host has then rewound the
  ;; position and nothing reached the stream's flags, so the calling API parks
  ;; ($crt_park) and runs again once the host has filled the chunk -- the
  ;; ReadFile contract. Treating it as a failed read made a streamed file look
  ;; empty: Dark Reign's cursor loader (_open/_read of mouse.crs) died with
  ;; "Invalid cursor file" in the browser and only there.
  (func $crt_file_read (param $file i32) (param $buf i32) (param $len i32) (result i32)
    (local $rec i32) (local $flags i32) (local $handle i32) (local $read i32)
    (local $bytes_ga i32) (local $bytes_wa i32) (local $err i32) (local $pending i32)
    (local.set $rec (call $crt_stream_lookup (local.get $file)))
    (if (i32.eqz (local.get $rec)) (then (return (i32.const -1))))
    (local.set $flags (call $crt_file_flags (local.get $file)))
    ;; Not in use (a closed standard stream) or a string stream: plain EOF.
    (if (i32.or (i32.eqz (i32.and (local.get $flags) (i32.const 0x83)))
                (i32.ne (i32.and (local.get $flags) (i32.const 0x40)) (i32.const 0)))
      (then (return (i32.const 0))))
    (if (i32.and (local.get $flags) (i32.const 0x02)) ;; _IOWRT: write-only, or no seek since writing
      (then
        (call $crt_file_set_flags (local.get $file) (i32.or (local.get $flags) (i32.const 0x20)))
        (return (i32.const 0))))
    (local.set $flags (i32.or (local.get $flags) (i32.const 0x01)))
    (call $crt_file_set_flags (local.get $file) (local.get $flags))
    (if (i32.eqz (local.get $len)) (then (return (i32.const 0))))
    ;; ungetc uses the real FILE buffer, also visible to an inline getc.
    ;; Keep it pending until host I/O succeeds: a parked fread retries whole.
    (if (i32.gt_s (call $gl32 (i32.add (local.get $file) (i32.const 4))) (i32.const 0))
      (then
        (local.set $pending (i32.const 1))
        (i32.store8 (call $g2w (local.get $buf))
          (i32.load8_u (call $g2w (call $gl32 (local.get $file)))))
        (if (i32.eq (local.get $len) (i32.const 1))
          (then (call $crt_file_reset_buffer (local.get $file)) (return (i32.const 1))))))
    (local.set $handle (call $crt_stream_handle (local.get $rec)))
    (local.set $bytes_ga (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (local.set $bytes_wa (call $g2w (local.get $bytes_ga)))
    (i32.store (local.get $bytes_wa) (i32.const 0))
    (local.set $err (if (result i32) (local.get $handle)
      (then (call $host_fs_read_file_result
        (local.get $handle) (i32.add (local.get $buf) (local.get $pending))
        (i32.sub (local.get $len) (local.get $pending)) (local.get $bytes_ga)))
      (else (i32.const 6)))) ;; ERROR_INVALID_HANDLE
    (if (i32.eq (local.get $err) (i32.const 997)) (then (return (global.get $CRT_READ_PARKED))))
    (call $crt_file_reset_buffer (local.get $file))
    (if (local.get $err)
      (then
        (call $crt_file_set_flags (local.get $file) (i32.or (local.get $flags) (i32.const 0x20)))
        (return (local.get $pending))))
    (local.set $read (i32.add (i32.load (local.get $bytes_wa)) (local.get $pending)))
    (if (i32.lt_u (local.get $read) (local.get $len))
      (then (call $crt_file_set_flags (local.get $file) (i32.or (local.get $flags) (i32.const 0x10)))))
    (local.get $read))

  ;; A CRT read that reached a nonresident lazy chunk. Distinct from every
  ;; byte count and from -1 (a stream this CRT does not own).
  (global $CRT_READ_PARKED i32 (i32.const -2))

  ;; Park a cdecl CRT call on IO_WAIT. Called before the handler pops its
  ;; return address, so nothing is unpopped: the guest's frame is exactly as
  ;; it built it and the retry runs the same call with the same arguments.
  (func $crt_park
    (call $io_block (i32.const 0)))

  ;; Give back $count bytes a parked call already took from the stream, so its
  ;; retry starts where the call did (fgets reads one byte at a time).
  (func $crt_file_unread (param $file i32) (param $count i32)
    (local $rec i32)
    (if (i32.eqz (local.get $count)) (then (return)))
    (local.set $rec (call $crt_stream_lookup (local.get $file)))
    (if (i32.eqz (local.get $rec)) (then (return)))
    (drop (call $host_fs_set_file_pointer (call $crt_stream_handle (local.get $rec))
      (i32.sub (i32.const 0) (local.get $count)) (i32.const 1))))

  ;; Close a raw handle (_close's descriptor contract): 0, or -1 on failure.
  (func $crt_close_raw_handle (param $handle i32) (result i32)
    (if (result i32) (call $host_fs_close_handle (local.get $handle))
      (then (i32.const 0))
      (else (i32.const -1))))

  ;; fclose: an fopen stream gives its record back; a standard stream stays
  ;; in _iob with _flag 0 (not in use), as MSVCRT leaves it.
  (func $crt_fclose (param $file i32) (result i32)
    (local $rec i32) (local $rec_w i32) (local $handle i32)
    (local.set $rec (call $crt_stream_lookup (local.get $file)))
    (if (i32.eqz (local.get $rec)) (then (return (i32.const -1))))
    (local.set $rec_w (call $g2w (local.get $rec)))
    (local.set $handle (i32.load offset=4 (local.get $rec_w)))
    (if (i32.and (i32.load offset=12 (local.get $rec_w)) (i32.const 2))
      (then
        (i32.store offset=4 (local.get $rec_w) (i32.const 0))
        (call $crt_file_set_flags (local.get $file) (i32.const 0))
        (if (i32.eqz (local.get $handle)) (then (return (i32.const 0)))))
      (else
        (call $crt_stream_unlink (local.get $rec))
        (call $heap_free (local.get $rec))))
    (call $crt_close_raw_handle (local.get $handle)))

  ;; Process termination: close every stream still open. fopen records are
  ;; released; standard streams keep their _iob slot and lose only a VFS
  ;; handle a freopen gave them. One close error cannot strand the rest.
  (func $crt_stream_close_all
    (local $link_w i32) (local $node i32) (local $node_w i32) (local $handle i32)
    (local $kind i32)
    (block $finished (loop $close
      (local.set $kind (i32.const 0))
      (call $lock_acquire (global.get $CRT_STREAM_STATE))
      (local.set $link_w (region.addr $CRT_STREAM_STATE 8))
      (block $found (loop $scan
        (local.set $node (i32.load (local.get $link_w)))
        (br_if $found (i32.eqz (local.get $node)))
        (local.set $node_w (call $g2w (local.get $node)))
        (local.set $handle (i32.load offset=4 (local.get $node_w)))
        (if (i32.eqz (i32.and (i32.load offset=12 (local.get $node_w)) (i32.const 2)))
          (then
            (i32.store (local.get $link_w) (i32.load (local.get $node_w)))
            (local.set $kind (i32.const 1))
            (br $found)))
        (if (local.get $handle)
          (then
            (i32.store offset=4 (local.get $node_w) (i32.const 0))
            (local.set $kind (i32.const 2))
            (br $found)))
        (local.set $link_w (local.get $node_w))
        (br $scan)))
      (call $lock_release (global.get $CRT_STREAM_STATE))
      (br_if $finished (i32.eqz (local.get $kind)))
      (if (i32.eq (local.get $kind) (i32.const 1))
        (then (call $heap_free (local.get $node))))
      (drop (call $crt_close_raw_handle (local.get $handle)))
      (br $close))))

  (func $handle_fopen (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $crt_fopen (local.get $arg0) (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; freopen(path, mode, stream): the same FILE* is reused, as in MSVCRT, so
  ;; freopen(..., stdout) keeps stdout meaning the new file. Even a failed
  ;; replacement closes the old stream; failure returns NULL and leaves the
  ;; FILE not in use.
  (func $crt_freopen (param $path i32) (param $mode i32) (param $file i32) (result i32)
    (local $rec i32) (local $rec_w i32) (local $old i32) (local $flags i32)
    (local $handle i32) (local $std i32)
    (local.set $rec (call $crt_stream_lookup (local.get $file)))
    (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
    (local.set $rec_w (call $g2w (local.get $rec)))
    (local.set $std (i32.and (i32.load offset=12 (local.get $rec_w)) (i32.const 2)))
    (local.set $old (i32.load offset=4 (local.get $rec_w)))
    (i32.store offset=4 (local.get $rec_w) (i32.const 0))
    (if (local.get $old) (then (drop (call $crt_close_raw_handle (local.get $old)))))
    (local.set $flags (if (result i32) (local.get $path)
      (then (call $crt_mode_flags (local.get $mode))) (else (i32.const 0))))
    (local.set $handle (if (result i32) (local.get $flags)
      (then (call $crt_open_stream_handle (local.get $path) (local.get $mode)))
      (else (i32.const -1))))
    (if (i32.eq (local.get $handle) (i32.const -1))
      (then
        (if (local.get $std)
          (then (call $crt_file_set_flags (local.get $file) (i32.const 0)))
          (else
            (call $crt_stream_unlink (local.get $rec))
            (call $heap_free (local.get $rec))))
        (return (i32.const 0))))
    (i32.store offset=4 (local.get $rec_w) (local.get $handle))
    (i32.store offset=12 (local.get $rec_w)
      (i32.or (local.get $std) (call $crt_mode_is_append (local.get $mode))))
    (call $crt_file_init (local.get $file) (local.get $handle) (local.get $flags))
    (local.get $file))

  (func $handle_freopen (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base)
      (call $crt_freopen (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle_fclose (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $crt_fclose (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; feof/ferror are MSVCRT macros over _flag; the functions read the same bit.
  ;; A NULL stream answers "at end" / "in error" so a polling loop terminates.
  (func $handle_feof (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (if (result i32) (local.get $arg0)
        (then (i32.and (call $crt_file_flags (local.get $arg0)) (i32.const 0x10)))
        (else (i32.const 1))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle_ferror (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (if (result i32) (local.get $arg0)
        (then (i32.and (call $crt_file_flags (local.get $arg0)) (i32.const 0x20)))
        (else (i32.const 1))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; setbuf(FILE*, buf) is setvbuf(file, buf, buf ? _IOFBF : _IONBF,
  ;; BUFSIZ), with MSVCRT BUFSIZ = 512. Share setvbuf's immediate-I/O
  ;; policy: never advertise a guest buffer that our stdio does not fill or
  ;; drain. No bytes are pending, and the caller buffer is not retained.
  ;; Invalid/closed streams leave memory alone and report EINVAL via errno.
  (func $handle_setbuf (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $saved_eax i32)
    (local.set $saved_eax (i32.load (global.get $reg_base)))
    (block $invalid
      (br_if $invalid (i32.eqz (call $crt_stream_lookup (local.get $arg0))))
      (br_if $invalid (i32.eqz (i32.and (call $crt_file_flags (local.get $arg0)) (i32.const 0x83))))
      (call $handle_setvbuf (local.get $arg0) (local.get $arg1)
        (select (i32.const 0) (i32.const 4) (local.get $arg1))
        (i32.const 512) (i32.const 0) (local.get $name_ptr))
      ;; setvbuf already consumed the return address. setbuf returns void.
      (i32.store (global.get $reg_base) (local.get $saved_eax))
      (return))
    (drop (call $crt_fdopen_error (i32.const 22)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  ;; setvbuf(FILE*, buf, mode, size) -> 0, or -1 (cdecl). msvcrt refuses a
  ;; stream it does not know, a mode other than _IOFBF 0 / _IOLBF 0x40 /
  ;; _IONBF 4, and for a buffered mode a size outside 2..INT_MAX. Every stream
  ;; here stays the unbuffered FILE $crt_file_init lays out and reaches the
  ;; VFS on each call, so an accepted request changes only when bytes become
  ;; visible -- sooner, never later -- and the caller's buf is never retained.
  (func $handle_setvbuf (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ok i32)
    (local.set $ok (i32.ne (call $crt_stream_lookup (local.get $arg0)) (i32.const 0)))
    (if (i32.and (local.get $ok)
          (i32.eqz (i32.or (i32.eqz (local.get $arg2))
                     (i32.or (i32.eq (local.get $arg2) (i32.const 0x40))
                             (i32.eq (local.get $arg2) (i32.const 4))))))
      (then (local.set $ok (i32.const 0))))
    (if (i32.and (local.get $ok) (i32.ne (local.get $arg2) (i32.const 4)))
      (then
        (if (i32.or (i32.lt_u (local.get $arg3) (i32.const 2))
                    (i32.gt_u (local.get $arg3) (i32.const 0x7FFFFFFF)))
          (then (local.set $ok (i32.const 0))))))
    (i32.store offset=0 (global.get $reg_base)
      (select (i32.const 0) (i32.const -1) (local.get $ok)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; clearerr(FILE*) -> void (cdecl). Resets _IOERR and _IOEOF.
  (func $handle_clearerr (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (call $crt_stream_lookup (local.get $arg0))
      (then (call $crt_file_set_flags (local.get $arg0)
        (i32.and (call $crt_file_flags (local.get $arg0)) (i32.const -49)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; fgets(buf, n, stream): up to n-1 bytes, stopping after '\n'. NULL when
  ;; end-of-file or an error comes before any byte was stored.
  (func $handle_fgets (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $count i32) (local $ch i32) (local $got i32) (local $result i32)
    (local $pending i32) (local $pushed i32)
    (local.set $result (local.get $arg0))
    (if (i32.or
          (i32.or (i32.eqz (local.get $arg0)) (i32.le_s (local.get $arg1) (i32.const 0)))
          (i32.eqz (call $crt_stream_lookup (local.get $arg2))))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (return)))
    (if (i32.gt_s (call $gl32 (i32.add (local.get $arg2) (i32.const 4))) (i32.const 0))
      (then
        (local.set $pending (i32.const 1))
        (local.set $pushed (call $gl8 (call $gl32 (local.get $arg2))))))
    (block $done (loop $read
      (br_if $done (i32.ge_u (local.get $count) (i32.sub (local.get $arg1) (i32.const 1))))
      (local.set $got (call $crt_file_read (local.get $arg2)
        (i32.add (local.get $arg0) (local.get $count)) (i32.const 1)))
      (if (i32.eq (local.get $got) (global.get $CRT_READ_PARKED))
        (then
          (call $crt_file_unread (local.get $arg2)
            (i32.sub (local.get $count) (local.get $pending)))
          (if (local.get $pending)
            (then
              (call $crt_file_reset_buffer (local.get $arg2))
              (call $gs8 (call $gl32 (local.get $arg2)) (local.get $pushed))
              (call $gs32 (i32.add (local.get $arg2) (i32.const 4)) (i32.const 1))))
          (call $crt_park)
          (return)))
      (if (i32.ne (local.get $got) (i32.const 1))
        (then
          (if (i32.eqz (local.get $count)) (then (local.set $result (i32.const 0))))
          (br $done)))
      (local.set $ch (call $gl8 (i32.add (local.get $arg0) (local.get $count))))
      (local.set $count (i32.add (local.get $count) (i32.const 1)))
      (br_if $done (i32.eq (local.get $ch) (i32.const 0x0a)))
      (br $read)))
    (if (local.get $result)
      (then (call $gs8 (i32.add (local.get $arg0) (local.get $count)) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (local.get $result))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle_fread (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $read i32)
    (if (i32.or
          (i32.or (i32.eqz (local.get $arg0)) (i32.eqz (local.get $arg1)))
          (i32.eqz (local.get $arg2)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (return)))
    (local.set $read (call $crt_file_read (local.get $arg3) (local.get $arg0)
      (i32.mul (local.get $arg1) (local.get $arg2))))
    (if (i32.eq (local.get $read) (global.get $CRT_READ_PARKED))
      (then (call $crt_park) (return)))
    (i32.store offset=0 (global.get $reg_base) (if (result i32) (i32.lt_s (local.get $read) (i32.const 0))
        (then (i32.const 0))
        (else (i32.div_u (local.get $read) (local.get $arg1)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle_ftell (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $rec i32) (local $handle i32)
    (local.set $rec (call $crt_stream_lookup (local.get $arg0)))
    (local.set $handle (if (result i32) (local.get $rec)
      (then (call $crt_stream_handle (local.get $rec))) (else (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (if (result i32) (local.get $handle)
        (then (call $host_fs_set_file_pointer
          (local.get $handle) (i32.const 0) (i32.const 1)))
        (else (i32.const -1))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; fseek clears _IOEOF and, on an _IORW stream, the current direction.
  (func $handle_fseek (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $rec i32) (local $flags i32) (local $handle i32) (local $result i32)
    (local.set $result (i32.const -1))
    (local.set $rec (call $crt_stream_lookup (local.get $arg0)))
    (if (i32.and (i32.ne (local.get $rec) (i32.const 0))
                 (i32.le_u (local.get $arg2) (i32.const 2)))
      (then
        (local.set $flags (i32.and (call $crt_file_flags (local.get $arg0)) (i32.const -17)))
        (if (i32.and (local.get $flags) (i32.const 0x80))
          (then (local.set $flags (i32.and (local.get $flags) (i32.const -4)))))
        (call $crt_file_set_flags (local.get $arg0) (local.get $flags))
        (call $crt_file_reset_buffer (local.get $arg0))
        (local.set $handle (call $crt_stream_handle (local.get $rec)))
        (if (i32.and (i32.ne (local.get $handle) (i32.const 0))
              (i32.ne
                (call $host_fs_set_file_pointer
                  (local.get $handle) (local.get $arg1) (local.get $arg2))
                (i32.const -1)))
          (then (local.set $result (i32.const 0))))))
    (i32.store offset=0 (global.get $reg_base) (local.get $result))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; rewind for this CRT's owned unbuffered disk FILEs. No pending output
  ;; exists in that representation; do not discard an unknown/custom buffer.
  ;; Like fseek(...,0,SEEK_SET), reset update direction and buffer pointers;
  ;; unlike fseek, clear BOTH EOF and error, even when the seek fails.
  (func $crt_rewind (param $file i32) (param $name_ptr i32)
    (local $rec i32) (local $flags i32) (local $handle i32)
    (local $charbuf i32) (local $error i32) (local $result_w i32)
    (block $unsupported
      (local.set $rec (call $crt_stream_lookup (local.get $file)))
      (br_if $unsupported (i32.eqz (local.get $rec)))
      (local.set $handle (i32.load offset=4 (call $g2w (local.get $rec))))
      ;; Console stdin's keyboard-discard semantics are a separate contract.
      (br_if $unsupported (i32.eqz (local.get $handle)))
      (br_if $unsupported (i32.ne (call $gl32 (i32.add (local.get $file) (i32.const 16))) (local.get $handle)))
      (local.set $flags (call $crt_file_flags (local.get $file)))
      (br_if $unsupported (i32.eqz (i32.and (local.get $flags) (i32.const 0x83))))
      (br_if $unsupported (i32.eqz (i32.and (local.get $flags) (i32.const 4))))
      (br_if $unsupported (i32.and (local.get $flags) (i32.const 0x148)))
      (br_if $unsupported (call $gl32 (i32.add (local.get $file) (i32.const 4))))
      (local.set $charbuf (i32.add (local.get $file) (i32.const 20)))
      (br_if $unsupported (i32.ne (call $gl32 (local.get $file)) (local.get $charbuf)))
      (br_if $unsupported (i32.ne (call $gl32 (i32.add (local.get $file) (i32.const 8))) (local.get $charbuf)))
      (br_if $unsupported (i32.ne (call $gl32 (i32.add (local.get $file) (i32.const 24))) (i32.const 2)))
      ;; Private result scratch below the caller frame; keep void EAX intact.
      ;; No stream-list lock spans the synchronous host call.
      (local.set $result_w (call $g2w (i32.sub
        (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))
      (local.set $error (call $host_fs_seek_result (local.get $handle)
        (i32.const 0) (i32.const 0) (i32.const 0) (local.get $result_w)))
      (local.set $flags (i32.and (local.get $flags) (i32.const -49)))
      (if (i32.and (local.get $flags) (i32.const 0x80))
        (then (local.set $flags (i32.and (local.get $flags) (i32.const -4)))))
      (call $crt_file_set_flags (local.get $file) (local.get $flags))
      (call $crt_file_reset_buffer (local.get $file))
      (if (local.get $error)
        ;; Same existing errno cell as fdopen. Bad/closed fd -> EBADF;
        ;; other failed seeks -> EINVAL. Success leaves errno untouched.
        (then (drop (call $crt_fdopen_error
          (select (i32.const 9) (i32.const 22) (i32.eq (local.get $error) (i32.const 6)))))))
      (return))
    (call $crash_unimplemented (local.get $name_ptr)))

  (func $handle_rewind (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crt_rewind (local.get $arg0) (local.get $name_ptr))
    ;; void, cdecl: pop only the return address and preserve EAX.
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  (func $crt_open_access (param $flags i32) (result i32)
    (if (result i32) (i32.and (local.get $flags) (i32.const 2)) ;; _O_RDWR
      (then (i32.const 0xC0000000)) ;; GENERIC_READ | GENERIC_WRITE
      (else
        (if (result i32) (i32.and (local.get $flags) (i32.const 1)) ;; _O_WRONLY
          (then (i32.const 0x40000000)) ;; GENERIC_WRITE
          (else (i32.const 0x80000000)))))) ;; GENERIC_READ

  (func $crt_open_creation (param $flags i32) (result i32)
    (if (result i32) (i32.and (local.get $flags) (i32.const 0x100)) ;; _O_CREAT
      (then
        (if (result i32) (i32.and (local.get $flags) (i32.const 0x400)) ;; _O_EXCL
          (then (i32.const 1)) ;; CREATE_NEW
          (else
            (if (result i32) (i32.and (local.get $flags) (i32.const 0x200)) ;; _O_TRUNC
              (then (i32.const 2)) ;; CREATE_ALWAYS
              (else (i32.const 4)))))) ;; OPEN_ALWAYS
      (else
        (if (result i32) (i32.and (local.get $flags) (i32.const 0x200)) ;; _O_TRUNC
          (then (i32.const 5)) ;; TRUNCATE_EXISTING
          (else (i32.const 3)))))) ;; OPEN_EXISTING

  (func $handle__open (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $handle i32)
    ;; Publish only after the process-owned VFS has retained the CRT flags.
    ;; The same broker operation runs for main and Worker calls.
    (local.set $handle (call $host_fs_crt_open
      (call $g2w (local.get $arg0)) (local.get $arg1)))
    (i32.store offset=0 (global.get $reg_base) (local.get $handle))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; _close(fd): this CRT's descriptors are raw VFS handles. Closing one does
  ;; not touch a FILE that wraps it -- as in MSVCRT, a later fclose of that
  ;; FILE then fails its own close and releases the FILE.
  (func $handle__close (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $crt_close_raw_handle (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle__dup (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $duplicate i32)
    (local.set $duplicate (call $host_fs_duplicate_handle (local.get $arg0)
      (i32.const 0) (i32.const 0) (i32.const 2) (i32.const 1)))
    (if (i32.le_s (local.get $duplicate) (i32.const 0))
      (then
        (if (i32.eqz (global.get $msvcrt_errno_ptr))
          (then (global.set $msvcrt_errno_ptr (call $heap_alloc (i32.const 4)))))
        (if (global.get $msvcrt_errno_ptr)
          (then (call $gs32 (global.get $msvcrt_errno_ptr)
            (select (i32.const 24) (i32.const 9) ;; EMFILE / EBADF
              (i32.eq (local.get $duplicate) (i32.const -4))))))))
    (i32.store offset=0 (global.get $reg_base)
      (select (local.get $duplicate) (i32.const -1)
        (i32.gt_s (local.get $duplicate) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; MSVCRT remove(filename) has the same file deletion and cdecl contract as
  ;; _unlink. Keep deletion in the owning VFS, including read-only policy.
  ;; The current boolean host interface supplies no detailed errno value.
  (func $handle_remove (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle__unlink (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  (func $handle__unlink (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (if (result i32) (call $host_fs_delete_file (call $g2w (local.get $arg0)) (i32.const 0))
        (then (i32.const 0))
        (else (i32.const -1))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; _read(fd, buf, count) -> bytes read, 0 at end of file, -1 on error. A
  ;; nonresident lazy chunk parks the call like ReadFile (see $crt_file_read).
  (func $handle__read (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $bytes_ga i32) (local $bytes_wa i32) (local $err i32)
    (local.set $bytes_ga (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (local.set $bytes_wa (call $g2w (local.get $bytes_ga)))
    (i32.store (local.get $bytes_wa) (i32.const 0))
    (local.set $err (call $host_fs_read_file_result
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $bytes_ga)))
    (if (i32.eq (local.get $err) (i32.const 997))
      (then (call $crt_park) (return)))
    (i32.store offset=0 (global.get $reg_base) (if (result i32) (i32.eqz (local.get $err))
        (then (i32.load (local.get $bytes_wa)))
        (else (i32.const -1))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle__write (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $crt_handle_write
      (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle__lseek (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_fs_set_file_pointer
      (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle__filelength (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $pos i32) (local $end i32)
    (local.set $pos (call $host_fs_set_file_pointer
      (local.get $arg0) (i32.const 0) (i32.const 1)))
    (local.set $end (call $host_fs_set_file_pointer
      (local.get $arg0) (i32.const 0) (i32.const 2)))
    (if (i32.ne (local.get $pos) (i32.const -1))
      (then (drop (call $host_fs_set_file_pointer
        (local.get $arg0) (local.get $pos) (i32.const 0)))))
    (i32.store offset=0 (global.get $reg_base) (local.get $end))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; fflush: streams are unbuffered, so there are never bytes to push. As in
  ;; MSVCRT's _flush, an _IORW stream that was writing drops its direction.
  ;; fflush(NULL) flushes every stream and succeeds.
  (func $handle_fflush (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $flags i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (if (local.get $arg0)
      (then
        (if (call $crt_stream_lookup (local.get $arg0))
          (then
            (local.set $flags (call $crt_file_flags (local.get $arg0)))
            (if (i32.eq (i32.and (local.get $flags) (i32.const 0x82)) (i32.const 0x82))
              (then (call $crt_file_set_flags (local.get $arg0)
                (i32.and (local.get $flags) (i32.const -3)))))
            (call $crt_file_reset_buffer (local.get $arg0)))
          (else (i32.store offset=0 (global.get $reg_base) (i32.const -1))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; fputs(str, stream) -> 0, or EOF (-1) when the string was not written.
  (func $handle_fputs (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $len i32) (local $written i32)
    (local.set $len (if (result i32) (local.get $arg0)
      (then (call $guest_strlen (local.get $arg0))) (else (i32.const 0))))
    (local.set $written (if (result i32) (local.get $arg0)
      (then (call $crt_file_write (local.get $arg1) (local.get $arg0) (local.get $len)))
      (else (i32.const -1))))
    (i32.store offset=0 (global.get $reg_base)
      (select (i32.const 0) (i32.const -1) (i32.eq (local.get $written) (local.get $len))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; fputc(c, FILE*) -> (unsigned char)c, or EOF (-1) when the byte was not
  ;; written. The byte goes to the stream straight from the caller's own
  ;; argument slot ([esp+4], low byte first), which is guest memory and needs
  ;; no scratch. ScummVM's Queen engine writes the tail of its autosave
  ;; (queen.asd) with it at the end of the intro.
  (func $handle_fputc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $written i32)
    (local.set $written (call $crt_file_write (local.get $arg1)
      (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))
      (i32.const 1)))
    (i32.store offset=0 (global.get $reg_base)
      (select (i32.and (local.get $arg0) (i32.const 0xff)) (i32.const -1)
        (i32.eq (local.get $written) (i32.const 1))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; getc(FILE*) -> the next byte as an unsigned char, or EOF (-1) at end of
  ;; file, on error, or for a stream this CRT does not own. The byte lands in
  ;; the caller's own argument slot ([esp+4]); a cdecl callee owns its
  ;; parameters, and the FILE* is already in $arg0.
  ;; That slot IS the FILE*, so a call that parks must put it back: the retry
  ;; runs on the frame as left, and with the slot zeroed it was fgetc(NULL),
  ;; i.e. EOF. Anno 1602 reads haeuser.cod, figuren.cod and its .gad files
  ;; with fgetc; under the browser's lazy file policy the first byte parked,
  ;; the retry saw EOF, every file looked empty and the main menu never drew
  ;; (ANNO-LAZY-BLACK-20261011).
  (func $handle_getc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $slot i32) (local $read i32)
    (local.set $slot (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (local.get $slot) (i32.const 0))
    (local.set $read (call $crt_file_read (local.get $arg0) (local.get $slot) (i32.const 1)))
    (if (i32.eq (local.get $read) (global.get $CRT_READ_PARKED))
      (then
        (call $gs32 (local.get $slot) (local.get $arg0))
        (call $crt_park) (return)))
    (i32.store offset=0 (global.get $reg_base)
      (select (call $gl8 (local.get $slot)) (i32.const -1)
        (i32.eq (local.get $read) (i32.const 1))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; One byte of pushback in the existing unbuffered FILE's _charbuf.
  ;; EOF and rejected streams leave both flags and buffered input untouched.
  (func $handle_ungetc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $flags i32) (local $result i32)
    (local.set $result (i32.const -1))
    (block $done
      (br_if $done (i32.eq (local.get $arg0) (i32.const -1)))
      (br_if $done (i32.eqz (call $crt_stream_lookup (local.get $arg1))))
      (local.set $flags (call $crt_file_flags (local.get $arg1)))
      (br_if $done (i32.eqz (i32.and (local.get $flags) (i32.const 0x81))))
      (br_if $done (i32.and (local.get $flags) (i32.const 0x42)))
      (br_if $done (call $gl32 (i32.add (local.get $arg1) (i32.const 4))))
      (local.set $result (i32.and (local.get $arg0) (i32.const 255)))
      (call $crt_file_reset_buffer (local.get $arg1))
      (call $gs8 (call $gl32 (local.get $arg1)) (local.get $result))
      (call $gs32 (i32.add (local.get $arg1) (i32.const 4)) (i32.const 1))
      (call $crt_file_set_flags (local.get $arg1)
        (i32.and (i32.or (local.get $flags) (i32.const 1)) (i32.const -17))))
    (i32.store (global.get $reg_base) (local.get $result))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  ;; fgetc(FILE*) — msvcrt's getc is this function, not a macro over it.
  (func $handle_fgetc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_getc (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $handle_fwrite (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $written i32)
    (if (i32.or (i32.eqz (local.get $arg1)) (i32.eqz (local.get $arg2)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (return)))
    (local.set $written (call $crt_file_write
      (local.get $arg3) (local.get $arg0) (i32.mul (local.get $arg1) (local.get $arg2))))
    (i32.store offset=0 (global.get $reg_base) (if (result i32) (i32.lt_s (local.get $written) (i32.const 0))
        (then (i32.const 0))
        (else (i32.div_u (local.get $written) (local.get $arg1)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; Format into a scratch buffer, then write it to a stream. Returns the
  ;; character count, or -1 when formatting or the write failed.
  (func $crt_vfprintf (param $file i32) (param $fmt i32) (param $args i32) (result i32)
    (local $scratch i32) (local $written i32)
    (if (i32.eqz (local.get $fmt)) (then (return (i32.const -1))))
    (local.set $scratch (call $heap_alloc (i32.const 65536)))
    (if (i32.eqz (local.get $scratch)) (then (return (i32.const -1))))
    (local.set $written
      (call $sprintf_impl (local.get $scratch) (local.get $fmt) (local.get $args)))
    (if (i32.ge_s (local.get $written) (i32.const 0))
      (then
        (if (i32.ne (call $crt_file_write (local.get $file) (local.get $scratch) (local.get $written))
                    (local.get $written))
          (then (local.set $written (i32.const -1))))))
    (call $heap_free (local.get $scratch))
    (local.get $written))

  (func $handle_fprintf (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $crt_vfprintf (local.get $arg0) (local.get $arg1)
      (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; printf writes to stdout (_iob[1]). MSVCRT buffers stdout, so the call
  ;; reports the formatted count even when a GUI process has no console to
  ;; receive it; that failure surfaces only as _IOERR on the stream.
  (func $handle_printf (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $scratch i32) (local $written i32) (local $iob i32)
    (if (i32.eqz (local.get $arg0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (return)))
    (local.set $scratch (call $heap_alloc (i32.const 65536)))
    (if (i32.eqz (local.get $scratch))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (return)))
    (local.set $written
      (call $sprintf_impl (local.get $scratch) (local.get $arg0)
        (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))
    (local.set $iob (call $crt_iob_ensure))
    (if (i32.and (i32.ne (local.get $iob) (i32.const 0))
                 (i32.gt_s (local.get $written) (i32.const 0)))
      (then (drop (call $crt_file_write (i32.add (local.get $iob) (i32.const 32))
        (local.get $scratch) (local.get $written)))))
    (call $heap_free (local.get $scratch))
    (i32.store offset=0 (global.get $reg_base) (local.get $written))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle_vfprintf (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base)
      (call $crt_vfprintf (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle_vsprintf (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $sprintf_impl (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle__errno (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (global.get $msvcrt_errno_ptr))
      (then
        (global.set $msvcrt_errno_ptr (call $heap_alloc (i32.const 4)))
        (call $gs32 (global.get $msvcrt_errno_ptr) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (global.get $msvcrt_errno_ptr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle_strerror (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (global.get $msvcrt_strerror_ptr))
      (then
        (global.set $msvcrt_strerror_ptr (call $heap_alloc (i32.const 14)))
        (call $gs8 (global.get $msvcrt_strerror_ptr) (i32.const 0x55))
        (call $gs8 (i32.add (global.get $msvcrt_strerror_ptr) (i32.const 1)) (i32.const 0x6e))
        (call $gs8 (i32.add (global.get $msvcrt_strerror_ptr) (i32.const 2)) (i32.const 0x6b))
        (call $gs8 (i32.add (global.get $msvcrt_strerror_ptr) (i32.const 3)) (i32.const 0x6e))
        (call $gs8 (i32.add (global.get $msvcrt_strerror_ptr) (i32.const 4)) (i32.const 0x6f))
        (call $gs8 (i32.add (global.get $msvcrt_strerror_ptr) (i32.const 5)) (i32.const 0x77))
        (call $gs8 (i32.add (global.get $msvcrt_strerror_ptr) (i32.const 6)) (i32.const 0x6e))
        (call $gs8 (i32.add (global.get $msvcrt_strerror_ptr) (i32.const 7)) (i32.const 0x20))
        (call $gs8 (i32.add (global.get $msvcrt_strerror_ptr) (i32.const 8)) (i32.const 0x65))
        (call $gs8 (i32.add (global.get $msvcrt_strerror_ptr) (i32.const 9)) (i32.const 0x72))
        (call $gs8 (i32.add (global.get $msvcrt_strerror_ptr) (i32.const 10)) (i32.const 0x72))
        (call $gs8 (i32.add (global.get $msvcrt_strerror_ptr) (i32.const 11)) (i32.const 0x6f))
        (call $gs8 (i32.add (global.get $msvcrt_strerror_ptr) (i32.const 12)) (i32.const 0x72))
        (call $gs8 (i32.add (global.get $msvcrt_strerror_ptr) (i32.const 13)) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (global.get $msvcrt_strerror_ptr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $crt_write_tmpnam (param $dst i32)
    (call $gs8 (local.get $dst) (i32.const 0x43)) ;; C
    (call $gs8 (i32.add (local.get $dst) (i32.const 1)) (i32.const 0x3a)) ;; :
    (call $gs8 (i32.add (local.get $dst) (i32.const 2)) (i32.const 0x5c)) ;; backslash
    (call $gs8 (i32.add (local.get $dst) (i32.const 3)) (i32.const 0x54)) ;; T
    (call $gs8 (i32.add (local.get $dst) (i32.const 4)) (i32.const 0x45)) ;; E
    (call $gs8 (i32.add (local.get $dst) (i32.const 5)) (i32.const 0x4d)) ;; M
    (call $gs8 (i32.add (local.get $dst) (i32.const 6)) (i32.const 0x50)) ;; P
    (call $gs8 (i32.add (local.get $dst) (i32.const 7)) (i32.const 0x5c))
    (call $gs8 (i32.add (local.get $dst) (i32.const 8)) (i32.const 0x57)) ;; W
    (call $gs8 (i32.add (local.get $dst) (i32.const 9)) (i32.const 0x41)) ;; A
    (call $gs8 (i32.add (local.get $dst) (i32.const 10)) (i32.const 0x30)) ;; 0
    (call $gs8 (i32.add (local.get $dst) (i32.const 11)) (i32.const 0x30))
    (call $gs8 (i32.add (local.get $dst) (i32.const 12)) (i32.const 0x30))
    (call $gs8 (i32.add (local.get $dst) (i32.const 13)) (i32.const 0x30))
    (call $gs8 (i32.add (local.get $dst) (i32.const 14)) (i32.const 0x30))
    (call $gs8 (i32.add (local.get $dst) (i32.const 15)) (i32.const 0x30))
    (call $gs8 (i32.add (local.get $dst) (i32.const 16)) (i32.const 0x2e)) ;; .
    (call $gs8 (i32.add (local.get $dst) (i32.const 17)) (i32.const 0x54)) ;; T
    (call $gs8 (i32.add (local.get $dst) (i32.const 18)) (i32.const 0x4d)) ;; M
    (call $gs8 (i32.add (local.get $dst) (i32.const 19)) (i32.const 0x50)) ;; P
    (call $gs8 (i32.add (local.get $dst) (i32.const 20)) (i32.const 0)))

  (func $handle_tmpnam (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dst i32)
    (local.set $dst (local.get $arg0))
    (if (i32.eqz (local.get $dst))
      (then
        (if (i32.eqz (global.get $msvcrt_tmpnam_ptr))
          (then (global.set $msvcrt_tmpnam_ptr (call $heap_alloc (i32.const 21)))))
        (local.set $dst (global.get $msvcrt_tmpnam_ptr))))
    (call $crt_write_tmpnam (local.get $dst))
    (i32.store offset=0 (global.get $reg_base) (local.get $dst))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; _lock/_unlock guard MSVCRT's process-local tables. The startup paths that
  ;; import them run on one guest thread here, so the lock index is only a
  ;; compatibility token.
  (func $handle__lock (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle__unlock (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; __lconv_init initializes MSVCRT's locale-conversion cache. The emulator's
  ;; locale APIs already provide the C/en-US data SDL2 expects, so this reports
  ;; success without allocating a separate lconv object.
  (func $handle___lconv_init (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle_tolower (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (local.get $arg0))
    (if (i32.and
          (i32.ge_s (local.get $arg0) (i32.const 0x41))
          (i32.le_s (local.get $arg0) (i32.const 0x5a)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.add (local.get $arg0) (i32.const 0x20)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle_toupper (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (local.get $arg0))
    (if (i32.and
          (i32.ge_s (local.get $arg0) (i32.const 0x61))
          (i32.le_s (local.get $arg0) (i32.const 0x7a)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.sub (local.get $arg0) (i32.const 0x20)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle_towlower (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_tolower (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $handle_towupper (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_toupper (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $crt_is_alpha (param $ch i32) (result i32)
    (i32.or
      (i32.and (i32.ge_u (local.get $ch) (i32.const 0x41)) (i32.le_u (local.get $ch) (i32.const 0x5a)))
      (i32.and (i32.ge_u (local.get $ch) (i32.const 0x61)) (i32.le_u (local.get $ch) (i32.const 0x7a)))))

  (func $crt_is_digit (param $ch i32) (result i32)
    (i32.and (i32.ge_u (local.get $ch) (i32.const 0x30)) (i32.le_u (local.get $ch) (i32.const 0x39))))

  (func $crt_is_space (param $ch i32) (result i32)
    (i32.or (i32.eq (local.get $ch) (i32.const 0x20))
      (i32.and (i32.ge_u (local.get $ch) (i32.const 0x09)) (i32.le_u (local.get $ch) (i32.const 0x0d)))))

  (func $crt_ctype_return (param $value i32)
    (i32.store offset=0 (global.get $reg_base) (local.get $value)))

  (func $handle_isalpha (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crt_ctype_return (call $crt_is_alpha (i32.and (local.get $arg0) (i32.const 0xff))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  (func $handle_isdigit (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crt_ctype_return (call $crt_is_digit (i32.and (local.get $arg0) (i32.const 0xff))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  (func $handle_isalnum (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crt_ctype_return
      (i32.or
        (call $crt_is_alpha (i32.and (local.get $arg0) (i32.const 0xff)))
        (call $crt_is_digit (i32.and (local.get $arg0) (i32.const 0xff)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  (func $handle_isupper (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crt_ctype_return
      (i32.and
        (i32.ge_u (i32.and (local.get $arg0) (i32.const 0xff)) (i32.const 0x41))
        (i32.le_u (i32.and (local.get $arg0) (i32.const 0xff)) (i32.const 0x5a))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  (func $handle_islower (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crt_ctype_return
      (i32.and
        (i32.ge_u (i32.and (local.get $arg0) (i32.const 0xff)) (i32.const 0x61))
        (i32.le_u (i32.and (local.get $arg0) (i32.const 0xff)) (i32.const 0x7a))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  (func $handle_isspace (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crt_ctype_return (call $crt_is_space (i32.and (local.get $arg0) (i32.const 0xff))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  (func $handle_iscntrl (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crt_ctype_return
      (i32.or
        (i32.lt_u (i32.and (local.get $arg0) (i32.const 0xff)) (i32.const 0x20))
        (i32.eq (i32.and (local.get $arg0) (i32.const 0xff)) (i32.const 0x7f))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  (func $handle_isprint (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crt_ctype_return
      (i32.and
        (i32.ge_u (i32.and (local.get $arg0) (i32.const 0xff)) (i32.const 0x20))
        (i32.le_u (i32.and (local.get $arg0) (i32.const 0xff)) (i32.const 0x7e))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  (func $handle_ispunct (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ch i32)
    (local.set $ch (i32.and (local.get $arg0) (i32.const 0xff)))
    (call $crt_ctype_return
      (i32.and
        (i32.and
          (i32.ge_u (local.get $ch) (i32.const 0x21))
          (i32.le_u (local.get $ch) (i32.const 0x7e)))
          (i32.eqz
            (i32.or
              (i32.or (call $crt_is_alpha (local.get $ch)) (call $crt_is_digit (local.get $ch)))
              (call $crt_is_space (local.get $ch))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  (func $handle_isxdigit (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ch i32)
    (local.set $ch (i32.and (local.get $arg0) (i32.const 0xff)))
    (call $crt_ctype_return
      (i32.or
        (call $crt_is_digit (local.get $ch))
        (i32.or
          (i32.and (i32.ge_u (local.get $ch) (i32.const 0x41)) (i32.le_u (local.get $ch) (i32.const 0x46)))
          (i32.and (i32.ge_u (local.get $ch) (i32.const 0x61)) (i32.le_u (local.get $ch) (i32.const 0x66))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  (func $handle__isctype (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ch i32) (local $flags i32)
    (local.set $ch (i32.and (local.get $arg0) (i32.const 0xff)))
    (local.set $flags (call $ctype1_ascii_flags (local.get $ch)))
    (if (i32.eq (local.get $ch) (i32.const 0x20))
      (then (local.set $flags (i32.or (local.get $flags) (i32.const 0x40)))))
    (if (i32.or
          (call $crt_is_digit (local.get $ch))
          (i32.or
            (i32.and (i32.ge_u (local.get $ch) (i32.const 0x41)) (i32.le_u (local.get $ch) (i32.const 0x46)))
            (i32.and (i32.ge_u (local.get $ch) (i32.const 0x61)) (i32.le_u (local.get $ch) (i32.const 0x66)))))
      (then (local.set $flags (i32.or (local.get $flags) (i32.const 0x80)))))
    (i32.store offset=0 (global.get $reg_base) (i32.and (local.get $flags) (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  (func $msvcrt_ctype_flags (param $ch i32) (result i32)
    (local $flags i32)
    (local.set $flags (call $ctype1_ascii_flags (i32.and (local.get $ch) (i32.const 0xff))))
    (if (i32.eq (i32.and (local.get $ch) (i32.const 0xff)) (i32.const 0x20))
      (then (local.set $flags (i32.or (local.get $flags) (i32.const 0x40)))))
    (if (i32.or
          (call $crt_is_digit (i32.and (local.get $ch) (i32.const 0xff)))
          (i32.or
            (i32.and
              (i32.ge_u (i32.and (local.get $ch) (i32.const 0xff)) (i32.const 0x41))
              (i32.le_u (i32.and (local.get $ch) (i32.const 0xff)) (i32.const 0x46)))
            (i32.and
              (i32.ge_u (i32.and (local.get $ch) (i32.const 0xff)) (i32.const 0x61))
              (i32.le_u (i32.and (local.get $ch) (i32.const 0xff)) (i32.const 0x66)))))
      (then (local.set $flags (i32.or (local.get $flags) (i32.const 0x80)))))
    (local.get $flags))

  ;; The CRT ctype table, built once. Entry zero is EOF; byte values are
  ;; indexed at table[ch + 1]. 0 when no storage could be allocated.
  (func $msvcrt_pctype_table (result i32)
    (local $i i32)
    (if (i32.eqz (global.get $msvcrt_pctype_ptr))
      (then
        (global.set $msvcrt_pctype_ptr (call $heap_alloc (i32.const 514)))
        (call $zero_memory (call $g2w (global.get $msvcrt_pctype_ptr)) (i32.const 514))
        (local.set $i (i32.const 0))
        (block $done (loop $fill
          (br_if $done (i32.ge_u (local.get $i) (i32.const 256)))
          (call $gs16
            (i32.add (global.get $msvcrt_pctype_ptr)
              (i32.shl (i32.add (local.get $i) (i32.const 1)) (i32.const 1)))
            (call $msvcrt_ctype_flags (local.get $i)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $fill)))))
    (global.get $msvcrt_pctype_ptr))

  ;; _pctype() — cdecl, returns the CRT ctype table's base (see above).
  (func $handle__pctype (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $msvcrt_pctype_table))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  ;; __p__pctype() — cdecl, the address of msvcrt's _pctype variable. As in
  ;; msvcrt that variable points one entry past the EOF slot, so isalpha(c)
  ;; is (*__p__pctype())[c] & _ALPHA for c in -1..255.
  (func $handle___p__pctype (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $table i32)
    (local.set $table (call $msvcrt_pctype_table))
    (if (i32.and (i32.ne (local.get $table) (i32.const 0))
                 (i32.eqz (global.get $msvcrt_pctype_var)))
      (then (global.set $msvcrt_pctype_var (call $heap_alloc (i32.const 4)))))
    (if (i32.and (i32.ne (local.get $table) (i32.const 0))
                 (i32.ne (global.get $msvcrt_pctype_var) (i32.const 0)))
      (then (call $gs32 (global.get $msvcrt_pctype_var)
        (i32.add (local.get $table) (i32.const 2)))))
    (i32.store offset=0 (global.get $reg_base)
      (select (global.get $msvcrt_pctype_var) (i32.const 0) (i32.ne (local.get $table) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  ;; _setmode(fd, mode) — cdecl. The emulator does not distinguish text and
  ;; binary stdio streams; return the previous text mode.
  (func $handle__setmode (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x4000))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  (func $handle_abort (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $host_exit (i32.const 3))
    (global.set $eip (i32.const 0))
    (global.set $yield_flag (i32.const 1))
    (global.set $steps (i32.const 0)))

  (func $handle_iswctype (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crt_ctype_return (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle_signal (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $slot i32)
    ;; Keep handlers for the usual small MSVCRT signal numbers. Invalid signal
    ;; ids return SIG_ERR (-1); valid registrations return the previous handler.
    (if (i32.or (i32.lt_s (local.get $arg0) (i32.const 0)) (i32.ge_s (local.get $arg0) (i32.const 32)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (return)))
    (if (i32.eqz (global.get $msvcrt_signal_table))
      (then
        (global.set $msvcrt_signal_table (call $heap_alloc (i32.const 128)))
        (memory.fill (call $g2w (global.get $msvcrt_signal_table)) (i32.const 0) (i32.const 128))))
    (local.set $slot
      (i32.add (global.get $msvcrt_signal_table) (i32.shl (local.get $arg0) (i32.const 2))))
    (i32.store offset=0 (global.get $reg_base) (call $gl32 (local.get $slot)))
    (call $gs32 (local.get $slot) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; localtime(const time_t *timer) -> struct tm * in the zone GetLocalTime
  ;; uses (local = UTC - Bias). One static struct tm, as msvcrt has per
  ;; thread: sec, min, hour, mday, mon, year-1900, wday, yday, isdst. A NULL
  ;; or negative time_t, or one that lands before 1970 locally, is NULL.
  (func $handle_localtime (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $t i64) (local $days i32) (local $secs i32) (local $ymd i32)
    (local $y i32) (local $m i32) (local $yday i32) (local $i i32) (local $tm i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (if (i32.eqz (local.get $arg0)) (then (return)))
    (local.set $t (i64.sub
      (i64.extend_i32_s (call $gl32 (local.get $arg0)))
      (i64.mul (i64.extend_i32_s (call $tz_bias_minutes)) (i64.const 60))))
    (if (i32.or (i32.lt_s (call $gl32 (local.get $arg0)) (i32.const 0))
          (i64.lt_s (local.get $t) (i64.const 0)))
      (then (return)))
    (if (i32.eqz (global.get $msvcrt_tm_ptr))
      (then (global.set $msvcrt_tm_ptr (call $heap_alloc (i32.const 36)))))
    (local.set $tm (global.get $msvcrt_tm_ptr))
    (if (i32.eqz (local.get $tm)) (then (return)))
    (local.set $days (i32.wrap_i64 (i64.div_u (local.get $t) (i64.const 86400))))
    (local.set $secs (i32.wrap_i64 (i64.rem_u (local.get $t) (i64.const 86400))))
    (local.set $ymd (call $cal_civil_from_days (local.get $days)))
    (local.set $y (i32.shr_u (local.get $ymd) (i32.const 9)))
    (local.set $m (i32.and (i32.shr_u (local.get $ymd) (i32.const 5)) (i32.const 15)))
    (local.set $yday (i32.sub (i32.and (local.get $ymd) (i32.const 31)) (i32.const 1)))
    (local.set $i (i32.const 1))
    (block $counted (loop $months
      (br_if $counted (i32.ge_u (local.get $i) (local.get $m)))
      (local.set $yday (i32.add (local.get $yday)
        (call $cal_days_in_month (local.get $y) (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $months)))
    (call $gs32 (local.get $tm) (i32.rem_u (local.get $secs) (i32.const 60)))
    (call $gs32 (i32.add (local.get $tm) (i32.const 4))
      (i32.rem_u (i32.div_u (local.get $secs) (i32.const 60)) (i32.const 60)))
    (call $gs32 (i32.add (local.get $tm) (i32.const 8)) (i32.div_u (local.get $secs) (i32.const 3600)))
    (call $gs32 (i32.add (local.get $tm) (i32.const 12)) (i32.and (local.get $ymd) (i32.const 31)))
    (call $gs32 (i32.add (local.get $tm) (i32.const 16)) (i32.sub (local.get $m) (i32.const 1)))
    (call $gs32 (i32.add (local.get $tm) (i32.const 20)) (i32.sub (local.get $y) (i32.const 1900)))
    (call $gs32 (i32.add (local.get $tm) (i32.const 24))
      (i32.rem_u (i32.add (local.get $days) (i32.const 4)) (i32.const 7))) ;; 1970-01-01 was a Thursday
    (call $gs32 (i32.add (local.get $tm) (i32.const 28)) (local.get $yday))
    (call $gs32 (i32.add (local.get $tm) (i32.const 32)) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (local.get $tm))
  )

  (func $crt_copy_finddata_a (param $dst i32) (param $src i32)
    (local $i i32) (local $ch i32)
    (if (i32.or (i32.eqz (local.get $dst)) (i32.eqz (local.get $src)))
      (then (return)))
    ;; struct _finddata_t: attrib, time_create/access/write, size, name[260].
    ;; WIN32_FIND_DATAA: attrs at +0, size high/low at +28/+32, cFileName at +44.
    (call $gs32 (local.get $dst) (call $gl32 (local.get $src)))
    (call $gs32 (i32.add (local.get $dst) (i32.const 4)) (i32.const 0))
    (call $gs32 (i32.add (local.get $dst) (i32.const 8)) (i32.const 0))
    (call $gs32 (i32.add (local.get $dst) (i32.const 12)) (i32.const 0))
    (call $gs32 (i32.add (local.get $dst) (i32.const 16))
      (call $gl32 (i32.add (local.get $src) (i32.const 32))))
    (block $done (loop $copy
      (br_if $done (i32.ge_u (local.get $i) (i32.const 260)))
      (local.set $ch (call $gl8
        (i32.add (i32.add (local.get $src) (i32.const 44)) (local.get $i))))
      (call $gs8
        (i32.add (i32.add (local.get $dst) (i32.const 20)) (local.get $i))
        (local.get $ch))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $copy (local.get $ch))))
  )

  (func $handle__findfirst (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $scratch i32) (local $handle i32)
    (local.set $scratch (call $heap_alloc (i32.const 320)))
    (if (i32.eqz (local.get $scratch))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (return)))
    (local.set $handle (call $host_fs_find_first_file
      (call $g2w (local.get $arg0)) (local.get $scratch) (i32.const 0)))
    (if (i32.eq (local.get $handle) (i32.const -1))
      (then
        (call $heap_free (local.get $scratch))
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (return)))
    (call $crt_copy_finddata_a (local.get $arg1) (local.get $scratch))
    (call $heap_free (local.get $scratch))
    (i32.store offset=0 (global.get $reg_base) (local.get $handle))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle__findnext (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $scratch i32) (local $ok i32)
    (local.set $scratch (call $heap_alloc (i32.const 320)))
    (if (i32.eqz (local.get $scratch))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (return)))
    (local.set $ok (call $host_fs_find_next_file
      (local.get $arg0) (local.get $scratch) (i32.const 0)))
    (if (local.get $ok)
      (then
        (call $crt_copy_finddata_a (local.get $arg1) (local.get $scratch))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const -1))))
    (call $heap_free (local.get $scratch))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle__findclose (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (if (result i32) (call $host_fs_find_close (local.get $arg0))
        (then (i32.const 0))
        (else (i32.const -1))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle_getenv (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32)
    (local.set $entry (call $env_find (local.get $arg0) (i32.const 0)))
    (i32.store offset=0 (global.get $reg_base) (if (result i32) (local.get $entry)
        (then (i32.add (i32.add (local.get $entry)
          (call $env_name_len (local.get $entry))) (i32.const 1)))
        (else (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; _putenv("NAME=value") -- cdecl. Sets the variable in the process
  ;; environment block getenv and GetEnvironmentVariable read; "NAME=" (empty
  ;; value) removes it, as msvcrt does. 0 on success, -1 when there is no '='
  ;; or no name before it, or the block is full. Slave Zero calls it at startup.
  (func $handle__putenv (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $len i32) (local $eq i32) (local $copy i32) (local $ok i32)
    (local.set $ok (i32.const -1))
    (if (local.get $arg0)
      (then
        (local.set $len (call $guest_strlen (local.get $arg0)))
        (local.set $eq (i32.const 0))
        (block $found (loop $scan
          (br_if $found (i32.ge_u (local.get $eq) (local.get $len)))
          (br_if $found (i32.eq (call $gl8 (i32.add (local.get $arg0) (local.get $eq))) (i32.const 0x3D)))
          (local.set $eq (i32.add (local.get $eq) (i32.const 1)))
          (br $scan)))
        ;; A copy, split at the '=': the caller's string is left untouched.
        (if (i32.and (i32.lt_u (local.get $eq) (local.get $len))
                     (i32.ne (local.get $eq) (i32.const 0)))
          (then
            (local.set $copy (call $heap_alloc (i32.add (local.get $len) (i32.const 1))))
            (if (local.get $copy)
              (then
                (call $memcpy (call $g2w (local.get $copy)) (call $g2w (local.get $arg0))
                  (i32.add (local.get $len) (i32.const 1)))
                (call $gs8 (i32.add (local.get $copy) (local.get $eq)) (i32.const 0))
                (if (call $env_set (local.get $copy)
                      (select
                        (i32.add (local.get $copy) (i32.add (local.get $eq) (i32.const 1)))
                        (i32.const 0)
                        (i32.lt_u (i32.add (local.get $eq) (i32.const 1)) (local.get $len)))
                      (i32.const 0))
                  (then (local.set $ok (i32.const 0))))
                (call $heap_free (local.get $copy))))))))
    (i32.store offset=0 (global.get $reg_base) (local.get $ok))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; A WIN32_FIND_DATA FILETIME (100ns since 1601) at guest $p as a time_t:
  ;; -1 when it predates 1970, as msvcrt reports it, and 0 for a FILETIME of
  ;; 0, which is how the VFS leaves a time it does not record.
  (func $crt_filetime_to_time_t (param $p i32) (result i32)
    (local $ft i64)
    (local.set $ft (i64.or
      (i64.extend_i32_u (call $gl32 (local.get $p)))
      (i64.shl (i64.extend_i32_u (call $gl32 (i32.add (local.get $p) (i32.const 4)))) (i64.const 32))))
    (if (i64.eqz (local.get $ft)) (then (return (i32.const 0))))
    (if (i64.lt_u (local.get $ft) (i64.const 116444736000000000))
      (then (return (i32.const -1))))
    (i32.wrap_i64 (i64.div_u (i64.sub (local.get $ft) (i64.const 116444736000000000))
      (i64.const 10000000))))

  ;; _stat(path, struct _stat*) -- cdecl. msvcrt's struct _stat is 36 bytes:
  ;;   +0 st_dev u32  +4 st_ino u16  +6 st_mode u16  +8 st_nlink i16
  ;;   +10 st_uid i16  +12 st_gid i16  +16 st_rdev u32  +20 st_size i32
  ;;   +24 st_atime  +28 st_mtime  +32 st_ctime
  ;; and nothing past +36 is ours: callers keep it at the top of their frame.
  ;; This used to zero 64 bytes, which ran over Dark Reign's saved EBP and
  ;; return address (a 36-byte local at [ebp-0x38]) and returned to NULL.
  ;; Every field goes through $gs16/$gs32, so a buffer straddling two sparse
  ;; guest pages is written correctly.
  (func $handle__stat (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $attrs i32) (local $scratch i32) (local $find i32) (local $path_wa i32)
    (local $i i32) (local $drive i32) (local $len i32)
    (if (i32.or (i32.eqz (local.get $arg0)) (i32.eqz (local.get $arg1)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (return)))
    (local.set $path_wa (call $g2w (local.get $arg0)))
    (local.set $attrs (call $host_fs_get_file_attributes
      (local.get $path_wa) (i32.const 0)))
    (if (i32.eq (local.get $attrs) (i32.const -1))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (return)))
    (block $zeroed (loop $zero
      (br_if $zeroed (i32.ge_u (local.get $i) (i32.const 36)))
      (call $gs32 (i32.add (local.get $arg1) (local.get $i)) (i32.const 0))
      (local.set $i (i32.add (local.get $i) (i32.const 4)))
      (br $zero)))
    (call $gs16 (i32.add (local.get $arg1) (i32.const 6))
      (if (result i32) (i32.and (local.get $attrs) (i32.const 0x10))
        (then (i32.const 0x41ff)) ;; _S_IFDIR | broad rwx perms
        (else (i32.const 0x81b6)))) ;; _S_IFREG | 0666
    (call $gs16 (i32.add (local.get $arg1) (i32.const 8)) (i32.const 1)) ;; st_nlink
    (local.set $scratch (call $heap_alloc (i32.const 320)))
    (if (local.get $scratch)
      (then
        ;; st_dev = st_rdev = the drive, 0 for A:, from the resolved path.
        (local.set $len (call $host_fs_get_full_path_name
          (local.get $path_wa) (i32.const 260) (local.get $scratch) (i32.const 0) (i32.const 0)))
        (if (i32.and (i32.and (i32.gt_u (local.get $len) (i32.const 1)) (i32.lt_u (local.get $len) (i32.const 260)))
                     (i32.eq (call $gl8 (i32.add (local.get $scratch) (i32.const 1))) (i32.const 0x3a)))
          (then
            (local.set $drive (i32.sub (i32.and (call $gl8 (local.get $scratch)) (i32.const 0xdf)) (i32.const 0x41)))
            (if (i32.lt_u (local.get $drive) (i32.const 26))
              (then
                (call $gs32 (local.get $arg1) (local.get $drive))
                (call $gs32 (i32.add (local.get $arg1) (i32.const 16)) (local.get $drive))))))
        (local.set $find (call $host_fs_find_first_file
          (local.get $path_wa) (local.get $scratch) (i32.const 0)))
        (if (i32.ne (local.get $find) (i32.const -1))
          (then
            ;; WIN32_FIND_DATA: ftCreationTime +4, ftLastAccessTime +12,
            ;; ftLastWriteTime +20, nFileSizeLow +32.
            (call $gs32 (i32.add (local.get $arg1) (i32.const 20))
              (call $gl32 (i32.add (local.get $scratch) (i32.const 32))))
            (call $gs32 (i32.add (local.get $arg1) (i32.const 24))
              (call $crt_filetime_to_time_t (i32.add (local.get $scratch) (i32.const 12))))
            (call $gs32 (i32.add (local.get $arg1) (i32.const 28))
              (call $crt_filetime_to_time_t (i32.add (local.get $scratch) (i32.const 20))))
            (call $gs32 (i32.add (local.get $arg1) (i32.const 32))
              (call $crt_filetime_to_time_t (i32.add (local.get $scratch) (i32.const 4))))
            (drop (call $host_fs_find_close (local.get $find)))))
        (call $heap_free (local.get $scratch))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle__access (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $attrs i32)
    (if (i32.eqz (local.get $arg0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (return)))
    (local.set $attrs (call $host_fs_get_file_attributes
      (call $g2w (local.get $arg0)) (i32.const 0)))
    (if (i32.eq (local.get $attrs) (i32.const -1))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (return)))
    (if (i32.and
          (i32.and (local.get $arg1) (i32.const 0x02))
          (i32.and (local.get $attrs) (i32.const 0x01)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (return)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle__beginthread (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_create_thread
      (local.get $arg0) (local.get $arg2) (local.get $arg1)
      (i32.const 0) (i32.const 0) (global.get $current_thread_id)))
    (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const -1))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle__beginthreadex (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $thread_id_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_create_thread
      (local.get $arg2) (local.get $arg3) (local.get $arg1)
      (local.get $arg4) (i32.const 0) (global.get $current_thread_id)))
    (local.set $thread_id_ptr (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (if (local.get $thread_id_ptr)
      (then (call $gs32 (local.get $thread_id_ptr) (i32.load offset=0 (global.get $reg_base)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle__endthreadex (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $apc_drop_shared_current)
    (call $host_exit_thread (local.get $arg0))
    (global.set $yield_reason (i32.const 2))
    (global.set $eip (i32.const 0))
    (global.set $steps (i32.const 0))
  )

  ;; _itoa / _itow(value, buffer, radix) — cdecl, returns the buffer.
  ;; Radix 10 is the only one MSVC formats as signed; every other radix prints
  ;; the raw 32-bit pattern, which is what a caller asking for hex expects.
  ;; Digits come out least-significant first, so the run is reversed in place.
  (func $crt_itoa (param $value i32) (param $buf i32) (param $radix i32) (param $wide i32) (result i32)
    (local $i i32) (local $neg i32) (local $u i32) (local $d i32)
    (local $lo i32) (local $hi i32) (local $a i32) (local $b i32)
    (if (i32.eqz (local.get $buf)) (then (return (i32.const 0))))
    (if (i32.or (i32.lt_s (local.get $radix) (i32.const 2))
                (i32.gt_s (local.get $radix) (i32.const 36)))
      (then
        (if (local.get $wide)
          (then (call $gs16 (local.get $buf) (i32.const 0)))
          (else (call $gs8 (local.get $buf) (i32.const 0))))
        (return (local.get $buf))))
    (local.set $u (local.get $value))
    (if (i32.and (i32.eq (local.get $radix) (i32.const 10))
                 (i32.lt_s (local.get $value) (i32.const 0)))
      (then
        (local.set $neg (i32.const 1))
        (local.set $u (i32.sub (i32.const 0) (local.get $value)))))
    (block $done (loop $emit
      (local.set $d (i32.rem_u (local.get $u) (local.get $radix)))
      (local.set $d
        (if (result i32) (i32.lt_u (local.get $d) (i32.const 10))
          (then (i32.add (local.get $d) (i32.const 48)))       ;; '0'
          (else (i32.add (local.get $d) (i32.const 87)))))     ;; 'a' - 10
      (if (local.get $wide)
        (then (call $gs16 (i32.add (local.get $buf) (i32.shl (local.get $i) (i32.const 1))) (local.get $d)))
        (else (call $gs8 (i32.add (local.get $buf) (local.get $i)) (local.get $d))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (local.set $u (i32.div_u (local.get $u) (local.get $radix)))
      (br_if $emit (local.get $u))
      (br $done)))
    (if (local.get $neg)
      (then
        (if (local.get $wide)
          (then (call $gs16 (i32.add (local.get $buf) (i32.shl (local.get $i) (i32.const 1))) (i32.const 45)))
          (else (call $gs8 (i32.add (local.get $buf) (local.get $i)) (i32.const 45))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))))
    (if (local.get $wide)
      (then (call $gs16 (i32.add (local.get $buf) (i32.shl (local.get $i) (i32.const 1))) (i32.const 0)))
      (else (call $gs8 (i32.add (local.get $buf) (local.get $i)) (i32.const 0))))
    ;; Reverse the digits (and the sign) into their printed order.
    (local.set $lo (i32.const 0))
    (local.set $hi (i32.sub (local.get $i) (i32.const 1)))
    (block $rdone (loop $rev
      (br_if $rdone (i32.ge_s (local.get $lo) (local.get $hi)))
      (if (local.get $wide)
        (then
          (local.set $a (call $gl16 (i32.add (local.get $buf) (i32.shl (local.get $lo) (i32.const 1)))))
          (local.set $b (call $gl16 (i32.add (local.get $buf) (i32.shl (local.get $hi) (i32.const 1)))))
          (call $gs16 (i32.add (local.get $buf) (i32.shl (local.get $lo) (i32.const 1))) (local.get $b))
          (call $gs16 (i32.add (local.get $buf) (i32.shl (local.get $hi) (i32.const 1))) (local.get $a)))
        (else
          (local.set $a (call $gl8 (i32.add (local.get $buf) (local.get $lo))))
          (local.set $b (call $gl8 (i32.add (local.get $buf) (local.get $hi))))
          (call $gs8 (i32.add (local.get $buf) (local.get $lo)) (local.get $b))
          (call $gs8 (i32.add (local.get $buf) (local.get $hi)) (local.get $a))))
      (local.set $lo (i32.add (local.get $lo) (i32.const 1)))
      (local.set $hi (i32.sub (local.get $hi) (i32.const 1)))
      (br $rev)))
    (local.get $buf))

  ;; _getcwd(buffer, maxlen) — cdecl. With a NULL buffer the CRT allocates one
  ;; of at least maxlen bytes; otherwise it fills the caller's. Returns the
  ;; buffer, or NULL when the path will not fit, matching the C runtime.
  (func $handle__getcwd (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $buf i32) (local $len i32) (local $cap i32)
    (local.set $cap (local.get $arg1))
    (if (i32.le_s (local.get $cap) (i32.const 0)) (then (local.set $cap (i32.const 260))))
    (local.set $buf (local.get $arg0))
    (if (i32.eqz (local.get $buf))
      (then (local.set $buf (call $heap_alloc (local.get $cap)))))
    (if (i32.eqz (local.get $buf))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (return)))
    (local.set $len (call $host_fs_get_current_directory
      (local.get $cap) (local.get $buf) (i32.const 0)))
    ;; GetCurrentDirectory returns the needed size when the buffer is too
    ;; small; _getcwd reports that as failure.
    (i32.store offset=0 (global.get $reg_base) (if (result i32)
        (i32.and (i32.ne (local.get $len) (i32.const 0))
                 (i32.lt_u (local.get $len) (local.get $cap)))
        (then (local.get $buf))
        (else (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle__chdir (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (if (result i32) (call $host_fs_set_current_directory
            (call $g2w (local.get $arg0)) (i32.const 0))
        (then (i32.const 0))
        (else (i32.const -1))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; _mkdir(dirname) — cdecl. 0, or -1 with errno EEXIST when the path
  ;; already exists (file or directory) and ENOENT otherwise, as msvcrt maps
  ;; CreateDirectory's ERROR_ALREADY_EXISTS / ERROR_PATH_NOT_FOUND.
  (func $handle__mkdir (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $path_wa i32) (local $ok i32)
    (local.set $path_wa (call $g2w (local.get $arg0)))
    (local.set $ok (call $host_fs_create_directory (local.get $path_wa) (i32.const 0)))
    (if (i32.eqz (local.get $ok))
      (then
        (if (i32.eqz (global.get $msvcrt_errno_ptr))
          (then (global.set $msvcrt_errno_ptr (call $heap_alloc (i32.const 4)))))
        (if (global.get $msvcrt_errno_ptr)
          (then (call $gs32 (global.get $msvcrt_errno_ptr)
            (select (i32.const 17) (i32.const 2) ;; EEXIST / ENOENT
              (i32.ne (call $host_fs_get_file_attributes (local.get $path_wa) (i32.const 0))
                (i32.const -1))))))))
    (i32.store offset=0 (global.get $reg_base)
      (select (i32.const 0) (i32.const -1) (i32.ne (local.get $ok) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; Append the NUL-terminated guest string $src at guest $dst; returns the
  ;; new end. Byte-wise, so either string may straddle sparse guest pages.
  (func $crt_append_str (param $dst i32) (param $src i32) (result i32)
    (local $c i32)
    (if (i32.eqz (local.get $src)) (then (return (local.get $dst))))
    (block $done (loop $copy
      (local.set $c (call $gl8 (local.get $src)))
      (br_if $done (i32.eqz (local.get $c)))
      (call $gs8 (local.get $dst) (local.get $c))
      (local.set $dst (i32.add (local.get $dst) (i32.const 1)))
      (local.set $src (i32.add (local.get $src) (i32.const 1)))
      (br $copy)))
    (local.get $dst))

  ;; _makepath(path, drive, dir, fname, ext) -- cdecl, void. As msvcrt: the
  ;; drive's first character and ':', dir with a '\' added unless it ends in
  ;; '\' or '/', fname, then ext with a '.' added unless it starts with one.
  ;; NULL or empty components are skipped; the result is NUL-terminated and,
  ;; as the API documents, not bounded.
  (func $handle__makepath (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $p i32) (local $last i32)
    (local.set $p (local.get $arg0))
    (if (local.get $p)
      (then
        (if (i32.and (i32.ne (local.get $arg1) (i32.const 0))
                     (i32.ne (call $gl8 (local.get $arg1)) (i32.const 0)))
          (then
            (call $gs8 (local.get $p) (call $gl8 (local.get $arg1)))
            (call $gs8 (i32.add (local.get $p) (i32.const 1)) (i32.const 0x3a))
            (local.set $p (i32.add (local.get $p) (i32.const 2)))))
        (if (i32.and (i32.ne (local.get $arg2) (i32.const 0))
                     (i32.ne (call $gl8 (local.get $arg2)) (i32.const 0)))
          (then
            (local.set $p (call $crt_append_str (local.get $p) (local.get $arg2)))
            (local.set $last (call $gl8 (i32.sub (local.get $p) (i32.const 1))))
            (if (i32.and (i32.ne (local.get $last) (i32.const 0x5c))
                         (i32.ne (local.get $last) (i32.const 0x2f)))
              (then
                (call $gs8 (local.get $p) (i32.const 0x5c))
                (local.set $p (i32.add (local.get $p) (i32.const 1)))))))
        (local.set $p (call $crt_append_str (local.get $p) (local.get $arg3)))
        (if (i32.and (i32.ne (local.get $arg4) (i32.const 0))
                     (i32.ne (call $gl8 (local.get $arg4)) (i32.const 0)))
          (then
            (if (i32.ne (call $gl8 (local.get $arg4)) (i32.const 0x2e))
              (then
                (call $gs8 (local.get $p) (i32.const 0x2e))
                (local.set $p (i32.add (local.get $p) (i32.const 1)))))
            (local.set $p (call $crt_append_str (local.get $p) (local.get $arg4)))))
        (call $gs8 (local.get $p) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; _fullpath(absPath, relPath, maxLength) — cdecl. The VFS owns DOS drive,
  ;; root-relative, current-directory, and dot-component normalization, so use
  ;; the same resolver as GetFullPathNameA. A NULL destination asks the CRT to
  ;; allocate the result buffer.
  (func $handle__fullpath (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $buf i32) (local $cap i32) (local $len i32) (local $owned i32)
    (local.set $cap (local.get $arg2))
    (if (i32.le_s (local.get $cap) (i32.const 0))
      (then (local.set $cap (i32.const 260))))
    (local.set $buf (local.get $arg0))
    (if (i32.eqz (local.get $buf))
      (then
        (local.set $buf (call $heap_alloc (local.get $cap)))
        (local.set $owned (i32.const 1))))
    (if (i32.and (i32.ne (local.get $buf) (i32.const 0))
                 (i32.ne (local.get $arg1) (i32.const 0)))
      (then
        (local.set $len (call $host_fs_get_full_path_name
          (call $g2w (local.get $arg1)) (local.get $cap) (local.get $buf)
          (i32.const 0) (i32.const 0)))))
    (if (i32.or (i32.eqz (local.get $len))
                (i32.ge_u (local.get $len) (local.get $cap)))
      (then
        (if (local.get $owned) (then (call $heap_free (local.get $buf))))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (else (i32.store offset=0 (global.get $reg_base) (local.get $buf))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  (func $handle__itoa (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $crt_itoa (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; Microsoft CRT int and long are both signed 32-bit values, and the two
  ;; routines otherwise have the same buffer/radix/result contract.
  (func $handle__ltoa (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle__itoa
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; ============================================================
  ;; sscanf — the inverse of the wsprintf in 12-wsprintf.wat
  ;; ============================================================
  ;; cdplayer.exe parses its stored disc/track database with it. Supported
  ;; directives: %d %i %u %x %o %c %s %e %f %g %[...] %%, each with an optional
  ;; '*' suppression flag, a field width, and h/l/L length modifiers.
  ;; Whitespace in the format matches any run of input whitespace; any other
  ;; format character must match the input exactly. The return value is the
  ;; number of items assigned, or -1 (EOF) when input ran out before the first
  ;; conversion, exactly as the C runtime reports it.

  (func $scan_is_space (param $ch i32) (result i32)
    (i32.or
      (i32.eq (local.get $ch) (i32.const 0x20))
      (i32.and (i32.ge_u (local.get $ch) (i32.const 0x09))
               (i32.le_u (local.get $ch) (i32.const 0x0D)))))

  ;; Digit value of $ch in $base, or -1.
  (func $scan_digit (param $ch i32) (param $base i32) (result i32)
    (local $v i32)
    (local.set $v (i32.const -1))
    (if (i32.and (i32.ge_u (local.get $ch) (i32.const 0x30))
                 (i32.le_u (local.get $ch) (i32.const 0x39)))
      (then (local.set $v (i32.sub (local.get $ch) (i32.const 0x30)))))
    (if (i32.and (i32.ge_u (local.get $ch) (i32.const 0x61))
                 (i32.le_u (local.get $ch) (i32.const 0x7A)))
      (then (local.set $v (i32.add (i32.sub (local.get $ch) (i32.const 0x61)) (i32.const 10)))))
    (if (i32.and (i32.ge_u (local.get $ch) (i32.const 0x41))
                 (i32.le_u (local.get $ch) (i32.const 0x5A)))
      (then (local.set $v (i32.add (i32.sub (local.get $ch) (i32.const 0x41)) (i32.const 10)))))
    (if (i32.ge_u (local.get $v) (local.get $base)) (then (local.set $v (i32.const -1))))
    (local.get $v))

  ;; Store an integer through the next vararg pointer, honouring 'h' (short)
  ;; and 'l' (long, same 32 bits here). $len: 0 = int, 1 = short, 2 = long.
  (func $scan_store_int (param $dst i32) (param $val i32) (param $len i32)
    (if (i32.eqz (local.get $dst)) (then (return)))
    (if (i32.eq (local.get $len) (i32.const 1))
      (then (call $gs16 (local.get $dst) (local.get $val)) (return)))
    (call $gs32 (local.get $dst) (local.get $val)))

  ;; Is $ch a member of the scanset starting at $set (just past the '[')?
  ;; $set_end is the index of the closing ']'. Handles a leading '^' negation
  ;; and a-z style ranges.
  (func $scan_set_match (param $set i32) (param $set_end i32) (param $ch i32) (result i32)
    (local $i i32) (local $neg i32) (local $hit i32) (local $c i32) (local $next i32)
    (local.set $i (local.get $set))
    (if (i32.eq (call $gl8 (local.get $i)) (i32.const 0x5E)) ;; '^'
      (then (local.set $neg (i32.const 1))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $set_end)))
      (local.set $c (call $gl8 (local.get $i)))
      (local.set $next (call $gl8 (i32.add (local.get $i) (i32.const 1))))
      ;; "a-z": a range, but only when the '-' is not the last set character.
      (if (i32.and (i32.eq (local.get $next) (i32.const 0x2D))
                   (i32.lt_u (i32.add (local.get $i) (i32.const 2)) (local.get $set_end)))
        (then
          (if (i32.and
                (i32.ge_u (local.get $ch) (local.get $c))
                (i32.le_u (local.get $ch) (call $gl8 (i32.add (local.get $i) (i32.const 2)))))
            (then (local.set $hit (i32.const 1))))
          (local.set $i (i32.add (local.get $i) (i32.const 3)))
          (br $scan)))
      (if (i32.eq (local.get $ch) (local.get $c)) (then (local.set $hit (i32.const 1))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (if (local.get $neg) (then (return (i32.eqz (local.get $hit)))))
    (local.get $hit))

  ;; $src, $fmt: guest pointers. $va: guest address of the first vararg slot.
  (func $sscanf_impl (param $src i32) (param $fmt i32) (param $va i32) (result i32)
    (local $s i32) (local $f i32) (local $assigned i32) (local $ch i32) (local $fc i32)
    (local $suppress i32) (local $width i32) (local $len i32) (local $conv i32)
    (local $base i32) (local $neg i32) (local $val i32) (local $digits i32)
    (local $dst i32) (local $count i32) (local $set_start i32) (local $set_end i32)
    (local $fval f64) (local $frac f64) (local $any i32) (local $consumed i32)
    (local.set $s (local.get $src))
    (local.set $f (local.get $fmt))
    (if (i32.or (i32.eqz (local.get $src)) (i32.eqz (local.get $fmt)))
      (then (return (i32.const -1))))
    (block $stop (loop $next_fmt
      (local.set $fc (call $gl8 (local.get $f)))
      (br_if $stop (i32.eqz (local.get $fc)))

      ;; Whitespace in the format: match any amount, including none.
      (if (call $scan_is_space (local.get $fc))
        (then
          (local.set $f (i32.add (local.get $f) (i32.const 1)))
          (block $ws_done (loop $ws
            (br_if $ws_done (i32.eqz (call $scan_is_space (call $gl8 (local.get $s)))))
            (local.set $s (i32.add (local.get $s) (i32.const 1)))
            (br $ws)))
          (br $next_fmt)))

      ;; Ordinary character: must match exactly.
      (if (i32.ne (local.get $fc) (i32.const 0x25)) ;; '%'
        (then
          (br_if $stop (i32.ne (call $gl8 (local.get $s)) (local.get $fc)))
          (local.set $s (i32.add (local.get $s) (i32.const 1)))
          (local.set $f (i32.add (local.get $f) (i32.const 1)))
          (br $next_fmt)))

      ;; --- a directive ---
      (local.set $f (i32.add (local.get $f) (i32.const 1)))
      (local.set $suppress (i32.const 0))
      (local.set $width (i32.const 0))
      (local.set $len (i32.const 0))
      (if (i32.eq (call $gl8 (local.get $f)) (i32.const 0x2A)) ;; '*'
        (then (local.set $suppress (i32.const 1))
              (local.set $f (i32.add (local.get $f) (i32.const 1)))))
      (block $w_done (loop $w
        (local.set $ch (call $gl8 (local.get $f)))
        (br_if $w_done (i32.or (i32.lt_u (local.get $ch) (i32.const 0x30))
                               (i32.gt_u (local.get $ch) (i32.const 0x39))))
        (local.set $width (i32.add (i32.mul (local.get $width) (i32.const 10))
                                   (i32.sub (local.get $ch) (i32.const 0x30))))
        (local.set $f (i32.add (local.get $f) (i32.const 1)))
        (br $w)))
      (block $len_done (loop $lm
        (local.set $ch (call $gl8 (local.get $f)))
        (if (i32.eq (local.get $ch) (i32.const 0x68)) ;; 'h'
          (then (local.set $len (i32.const 1))
                (local.set $f (i32.add (local.get $f) (i32.const 1))) (br $lm)))
        (if (i32.or (i32.eq (local.get $ch) (i32.const 0x6C))    ;; 'l'
                    (i32.eq (local.get $ch) (i32.const 0x4C)))   ;; 'L'
          (then (local.set $len (i32.const 2))
                (local.set $f (i32.add (local.get $f) (i32.const 1))) (br $lm)))
        (br $len_done)))
      (local.set $conv (call $gl8 (local.get $f)))
      (local.set $f (i32.add (local.get $f) (i32.const 1)))

      ;; "%%" matches a literal percent and assigns nothing.
      (if (i32.eq (local.get $conv) (i32.const 0x25))
        (then
          (br_if $stop (i32.ne (call $gl8 (local.get $s)) (i32.const 0x25)))
          (local.set $s (i32.add (local.get $s) (i32.const 1)))
          (br $next_fmt)))

      ;; The vararg slot for this directive, unless assignment is suppressed.
      (local.set $dst (i32.const 0))
      (if (i32.eqz (local.get $suppress))
        (then
          (local.set $dst (call $gl32 (local.get $va)))
          (local.set $va (i32.add (local.get $va) (i32.const 4)))))

      ;; %c — exactly $width characters (default 1), no whitespace skipping.
      (if (i32.eq (local.get $conv) (i32.const 0x63))
        (then
          (if (i32.eqz (local.get $width)) (then (local.set $width (i32.const 1))))
          (local.set $count (i32.const 0))
          (block $c_done (loop $c
            (br_if $c_done (i32.ge_u (local.get $count) (local.get $width)))
            (local.set $ch (call $gl8 (local.get $s)))
            (br_if $c_done (i32.eqz (local.get $ch)))
            (if (local.get $dst)
              (then (call $gs8 (i32.add (local.get $dst) (local.get $count)) (local.get $ch))))
            (local.set $s (i32.add (local.get $s) (i32.const 1)))
            (local.set $count (i32.add (local.get $count) (i32.const 1)))
            (br $c)))
          (br_if $stop (i32.lt_u (local.get $count) (local.get $width)))
          (if (i32.eqz (local.get $suppress))
            (then (local.set $assigned (i32.add (local.get $assigned) (i32.const 1)))))
          (br $next_fmt)))

      ;; %[...] — a scanset, also without leading whitespace skipping.
      (if (i32.eq (local.get $conv) (i32.const 0x5B))
        (then
          (local.set $set_start (local.get $f))
          ;; A ']' immediately after '[' or '[^' is a literal member.
          (local.set $set_end (local.get $f))
          (if (i32.eq (call $gl8 (local.get $set_end)) (i32.const 0x5E))
            (then (local.set $set_end (i32.add (local.get $set_end) (i32.const 1)))))
          (if (i32.eq (call $gl8 (local.get $set_end)) (i32.const 0x5D))
            (then (local.set $set_end (i32.add (local.get $set_end) (i32.const 1)))))
          (block $set_done (loop $find
            (local.set $ch (call $gl8 (local.get $set_end)))
            (br_if $stop (i32.eqz (local.get $ch)))
            (br_if $set_done (i32.eq (local.get $ch) (i32.const 0x5D)))
            (local.set $set_end (i32.add (local.get $set_end) (i32.const 1)))
            (br $find)))
          (local.set $f (i32.add (local.get $set_end) (i32.const 1)))
          (local.set $count (i32.const 0))
          (block $sset_done (loop $sset
            (if (local.get $width)
              (then (br_if $sset_done (i32.ge_u (local.get $count) (local.get $width)))))
            (local.set $ch (call $gl8 (local.get $s)))
            (br_if $sset_done (i32.eqz (local.get $ch)))
            (br_if $sset_done
              (i32.eqz (call $scan_set_match (local.get $set_start) (local.get $set_end) (local.get $ch))))
            (if (local.get $dst)
              (then (call $gs8 (i32.add (local.get $dst) (local.get $count)) (local.get $ch))))
            (local.set $s (i32.add (local.get $s) (i32.const 1)))
            (local.set $count (i32.add (local.get $count) (i32.const 1)))
            (br $sset)))
          (br_if $stop (i32.eqz (local.get $count)))
          (if (local.get $dst)
            (then (call $gs8 (i32.add (local.get $dst) (local.get $count)) (i32.const 0))))
          (if (i32.eqz (local.get $suppress))
            (then (local.set $assigned (i32.add (local.get $assigned) (i32.const 1)))))
          (br $next_fmt)))

      ;; Every remaining conversion skips leading whitespace first.
      (block $ws2_done (loop $ws2
        (br_if $ws2_done (i32.eqz (call $scan_is_space (call $gl8 (local.get $s)))))
        (local.set $s (i32.add (local.get $s) (i32.const 1)))
        (br $ws2)))

      ;; %s — a run of non-whitespace.
      (if (i32.eq (local.get $conv) (i32.const 0x73))
        (then
          (local.set $count (i32.const 0))
          (block $s_done (loop $sl
            (if (local.get $width)
              (then (br_if $s_done (i32.ge_u (local.get $count) (local.get $width)))))
            (local.set $ch (call $gl8 (local.get $s)))
            (br_if $s_done (i32.eqz (local.get $ch)))
            (br_if $s_done (call $scan_is_space (local.get $ch)))
            (if (local.get $dst)
              (then (call $gs8 (i32.add (local.get $dst) (local.get $count)) (local.get $ch))))
            (local.set $s (i32.add (local.get $s) (i32.const 1)))
            (local.set $count (i32.add (local.get $count) (i32.const 1)))
            (br $sl)))
          (br_if $stop (i32.eqz (local.get $count)))
          (if (local.get $dst)
            (then (call $gs8 (i32.add (local.get $dst) (local.get $count)) (i32.const 0))))
          (if (i32.eqz (local.get $suppress))
            (then (local.set $assigned (i32.add (local.get $assigned) (i32.const 1)))))
          (br $next_fmt)))

      ;; %e %f %g — a decimal float, optionally with an exponent.
      (if (i32.or (i32.eq (local.get $conv) (i32.const 0x66))   ;; 'f'
            (i32.or (i32.eq (local.get $conv) (i32.const 0x65)) ;; 'e'
                    (i32.eq (local.get $conv) (i32.const 0x67)))) ;; 'g'
        (then
          (local.set $neg (i32.const 0))
          (local.set $ch (call $gl8 (local.get $s)))
          (if (i32.or (i32.eq (local.get $ch) (i32.const 0x2D)) (i32.eq (local.get $ch) (i32.const 0x2B)))
            (then
              (local.set $neg (i32.eq (local.get $ch) (i32.const 0x2D)))
              (local.set $s (i32.add (local.get $s) (i32.const 1)))))
          (local.set $fval (f64.const 0))
          (local.set $digits (i32.const 0))
          (block $ip_done (loop $ip
            (local.set $val (call $scan_digit (call $gl8 (local.get $s)) (i32.const 10)))
            (br_if $ip_done (i32.lt_s (local.get $val) (i32.const 0)))
            (local.set $fval (f64.add (f64.mul (local.get $fval) (f64.const 10))
                                      (f64.convert_i32_s (local.get $val))))
            (local.set $digits (i32.add (local.get $digits) (i32.const 1)))
            (local.set $s (i32.add (local.get $s) (i32.const 1)))
            (br $ip)))
          (if (i32.eq (call $gl8 (local.get $s)) (i32.const 0x2E)) ;; '.'
            (then
              (local.set $s (i32.add (local.get $s) (i32.const 1)))
              (local.set $frac (f64.const 1))
              (block $fp_done (loop $fp
                (local.set $val (call $scan_digit (call $gl8 (local.get $s)) (i32.const 10)))
                (br_if $fp_done (i32.lt_s (local.get $val) (i32.const 0)))
                (local.set $frac (f64.div (local.get $frac) (f64.const 10)))
                (local.set $fval (f64.add (local.get $fval)
                  (f64.mul (f64.convert_i32_s (local.get $val)) (local.get $frac))))
                (local.set $digits (i32.add (local.get $digits) (i32.const 1)))
                (local.set $s (i32.add (local.get $s) (i32.const 1)))
                (br $fp)))))
          (br_if $stop (i32.eqz (local.get $digits)))
          ;; Exponent, only when it is actually well formed.
          (local.set $ch (call $gl8 (local.get $s)))
          (if (i32.or (i32.eq (local.get $ch) (i32.const 0x65)) (i32.eq (local.get $ch) (i32.const 0x45)))
            (then
              (local.set $consumed (i32.const 1))
              (local.set $any (i32.const 0))
              (local.set $count (i32.const 0))
              (local.set $ch (call $gl8 (i32.add (local.get $s) (local.get $consumed))))
              (if (i32.or (i32.eq (local.get $ch) (i32.const 0x2D)) (i32.eq (local.get $ch) (i32.const 0x2B)))
                (then
                  (local.set $any (i32.eq (local.get $ch) (i32.const 0x2D)))
                  (local.set $consumed (i32.add (local.get $consumed) (i32.const 1)))))
              (local.set $digits (i32.const 0))
              (block $ex_done (loop $ex
                (local.set $val (call $scan_digit
                  (call $gl8 (i32.add (local.get $s) (local.get $consumed))) (i32.const 10)))
                (br_if $ex_done (i32.lt_s (local.get $val) (i32.const 0)))
                (local.set $count (i32.add (i32.mul (local.get $count) (i32.const 10)) (local.get $val)))
                (local.set $digits (i32.add (local.get $digits) (i32.const 1)))
                (local.set $consumed (i32.add (local.get $consumed) (i32.const 1)))
                (br $ex)))
              (if (local.get $digits)
                (then
                  (local.set $s (i32.add (local.get $s) (local.get $consumed)))
                  (block $sc_done (loop $sc
                    (br_if $sc_done (i32.eqz (local.get $count)))
                    (if (local.get $any)
                      (then (local.set $fval (f64.div (local.get $fval) (f64.const 10))))
                      (else (local.set $fval (f64.mul (local.get $fval) (f64.const 10)))))
                    (local.set $count (i32.sub (local.get $count) (i32.const 1)))
                    (br $sc)))))))
          (if (local.get $neg) (then (local.set $fval (f64.neg (local.get $fval)))))
          (if (local.get $dst)
            (then
              ;; 'l'/'L' means double; a bare %f is a float.
              (if (i32.eq (local.get $len) (i32.const 2))
                (then (call $gs64 (local.get $dst) (i64.reinterpret_f64 (local.get $fval))))
                (else (call $gs32 (local.get $dst)
                        (i32.reinterpret_f32 (f32.demote_f64 (local.get $fval))))))))
          (if (i32.eqz (local.get $suppress))
            (then (local.set $assigned (i32.add (local.get $assigned) (i32.const 1)))))
          (br $next_fmt)))

      ;; %d %i %u %x %X %o — integers.
      (local.set $base (i32.const 10))
      (if (i32.or (i32.eq (local.get $conv) (i32.const 0x78))    ;; 'x'
                  (i32.eq (local.get $conv) (i32.const 0x58)))   ;; 'X'
        (then (local.set $base (i32.const 16))))
      (if (i32.eq (local.get $conv) (i32.const 0x6F)) (then (local.set $base (i32.const 8)))) ;; 'o'
      (br_if $stop
        (i32.eqz (i32.or (i32.eq (local.get $conv) (i32.const 0x64))   ;; 'd'
          (i32.or (i32.eq (local.get $conv) (i32.const 0x69))          ;; 'i'
            (i32.or (i32.eq (local.get $conv) (i32.const 0x75))        ;; 'u'
              (i32.or (i32.eq (local.get $conv) (i32.const 0x78))
                (i32.or (i32.eq (local.get $conv) (i32.const 0x58))
                        (i32.eq (local.get $conv) (i32.const 0x6F)))))))))
      (local.set $neg (i32.const 0))
      (local.set $ch (call $gl8 (local.get $s)))
      (if (i32.or (i32.eq (local.get $ch) (i32.const 0x2D)) (i32.eq (local.get $ch) (i32.const 0x2B)))
        (then
          (local.set $neg (i32.eq (local.get $ch) (i32.const 0x2D)))
          (local.set $s (i32.add (local.get $s) (i32.const 1)))))
      ;; A 0x prefix is part of %x, and of %i's base detection.
      (if (i32.and (i32.eq (call $gl8 (local.get $s)) (i32.const 0x30))
                   (i32.or (i32.eq (local.get $base) (i32.const 16))
                           (i32.eq (local.get $conv) (i32.const 0x69))))
        (then
          (local.set $ch (call $gl8 (i32.add (local.get $s) (i32.const 1))))
          (if (i32.or (i32.eq (local.get $ch) (i32.const 0x78)) (i32.eq (local.get $ch) (i32.const 0x58)))
            (then
              (local.set $base (i32.const 16))
              (local.set $s (i32.add (local.get $s) (i32.const 2)))))))
      (local.set $val (i32.const 0))
      (local.set $digits (i32.const 0))
      (block $int_done (loop $int
        (if (local.get $width)
          (then (br_if $int_done (i32.ge_u (local.get $digits) (local.get $width)))))
        (local.set $count (call $scan_digit (call $gl8 (local.get $s)) (local.get $base)))
        (br_if $int_done (i32.lt_s (local.get $count) (i32.const 0)))
        (local.set $val (i32.add (i32.mul (local.get $val) (local.get $base)) (local.get $count)))
        (local.set $digits (i32.add (local.get $digits) (i32.const 1)))
        (local.set $s (i32.add (local.get $s) (i32.const 1)))
        (br $int)))
      (br_if $stop (i32.eqz (local.get $digits)))
      (if (local.get $neg) (then (local.set $val (i32.sub (i32.const 0) (local.get $val)))))
      (call $scan_store_int (local.get $dst) (local.get $val) (local.get $len))
      (if (i32.eqz (local.get $suppress))
        (then (local.set $assigned (i32.add (local.get $assigned) (i32.const 1)))))
      (br $next_fmt)))
    ;; Input exhausted before anything was converted is EOF, not "zero items".
    (if (i32.and (i32.eqz (local.get $assigned))
                 (i32.eqz (call $gl8 (local.get $src))))
      (then (return (i32.const -1))))
    (local.get $assigned))

  ;; sscanf(buffer, format, ...) — cdecl
  (func $handle_sscanf (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $sscanf_impl
      (local.get $arg0) (local.get $arg1) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; 733: realloc(ptr, size) — cdecl
  (func $handle_realloc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $new_ptr i32)
    ;; The CRT frees a non-null allocation for size zero; the shared heap
    ;; reallocator intentionally retains it for Global/LocalReAlloc callers.
    (if (i32.and (i32.ne (local.get $arg0) (i32.const 0)) (i32.eqz (local.get $arg1)))
      (then (call $heap_free (local.get $arg0)))
      (else
        ;; Shared core copies only payload bytes and preserves the original
        ;; allocation on failure. NULL input follows its allocation path.
        (local.set $new_ptr (call $heap_realloc (local.get $arg0) (local.get $arg1) (i32.const 0)))
        (if (i32.eqz (local.get $new_ptr))
          (then (call $msvcrt_set_errno (i32.const 12)))))) ;; ENOMEM
    (i32.store offset=0 (global.get $reg_base) (local.get $new_ptr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; 734: _strlwr(str) — cdecl, lowercase string in-place
  (func $handle__strlwr (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $guest i32) (local $ch i32)
    (local.set $guest (local.get $arg0))
    (block $d (loop $l
      (local.set $ch (call $gl8 (local.get $guest)))
      (br_if $d (i32.eqz (local.get $ch)))
      (if (i32.and (i32.ge_u (local.get $ch) (i32.const 0x41)) (i32.le_u (local.get $ch) (i32.const 0x5A)))
        (then (call $gs8 (local.get $guest) (i32.or (local.get $ch) (i32.const 0x20)))))
      (local.set $guest (i32.add (local.get $guest) (i32.const 1))) (br $l)))
    (i32.store offset=0 (global.get $reg_base) (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; _strupr(str) — cdecl, uppercase ASCII string in-place. Storm uses this
  ;; during DllMain to normalize its app-local search path.
  (func $handle__strupr (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $guest i32) (local $ch i32)
    (local.set $guest (local.get $arg0))
    (block $d (loop $l
      (local.set $ch (call $gl8 (local.get $guest)))
      (br_if $d (i32.eqz (local.get $ch)))
      (if (i32.and (i32.ge_u (local.get $ch) (i32.const 0x61)) (i32.le_u (local.get $ch) (i32.const 0x7A)))
        (then (call $gs8 (local.get $guest) (i32.sub (local.get $ch) (i32.const 0x20)))))
      (local.set $guest (i32.add (local.get $guest) (i32.const 1)))
      (br $l)))
    (i32.store offset=0 (global.get $reg_base) (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; Retained bsearch frames: sixteen thread partitions, 64 x 64-byte frames.
  ;; ret/key/base/size/compar/low/high/mid at 0..28, parent/child/root at
  ;; 32/40/48, expected cdecl return ESP at 56. Lifetime matches qsort's:
  ;; explicit host-quiescent root reset retires abandoned frames lazily.
  (global $BSEARCH_CONTEXTS i32 (region.addr $BSEARCH_CONTEXTS 0))
  (global $BSEARCH_CONTEXTS_SIZE i32 (region.size $BSEARCH_CONTEXTS))
  (global $bsearch_owner (mut i64) (i64.const 0))
  (global $bsearch_depth (mut i32) (i32.const 0))

  (func $bsearch_frame_at (param $index i32) (result i32)
    (i32.add (region.addr $BSEARCH_CONTEXTS 0)
      (i32.add
        (i32.shl (i32.sub (global.get $invocation_tid) (i32.const 1)) (i32.const 12))
        (i32.shl (local.get $index) (i32.const 6)))))

  (func $bsearch_frame (result i32)
    (local $frame i32)
    (call $invocation_validate)
    (if (i64.ne (global.get $bsearch_owner) (global.get $invocation_root)) (then (unreachable)))
    (if (i32.eqz (global.get $bsearch_depth)) (then (unreachable)))
    (if (i32.gt_u (global.get $bsearch_depth) (i32.const 64)) (then (unreachable)))
    (local.set $frame (call $bsearch_frame_at (i32.sub (global.get $bsearch_depth) (i32.const 1))))
    (if (i64.ne (i64.load offset=48 (local.get $frame)) (global.get $invocation_root))
      (then (unreachable)))
    (local.get $frame))

  (func $bsearch_finish (param $result i32)
    (local $frame i32)
    (local.set $frame (call $bsearch_frame))
    (if (i64.ne (i64.load offset=40 (local.get $frame)) (i64.const 0)) (then (unreachable)))
    (if (i64.ne (i64.load offset=32 (local.get $frame)) (call $invocation_current))
      (then (unreachable)))
    (i32.store (global.get $reg_base) (local.get $result))
    (global.set $eip (i32.load (local.get $frame)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (global.set $bsearch_depth (i32.sub (global.get $bsearch_depth) (i32.const 1))))

  ;; bsearch(key, base, nmemb, size, compar) — cdecl, guest-callback comparator.
  ;; Drives the binary search step-by-step: each probe pushes (key, elem) on the
  ;; stack plus the CACA000C return thunk, then jumps to compar. The continuation
  ;; handler in 09b-dispatch.wat narrows [low, high) based on the returned eax and
  ;; re-enters this helper until the range collapses or a match is found.
  (func $bsearch_probe
    (local $mid i32) (local $elem i32) (local $frame i32)
    (local.set $frame (call $bsearch_frame))
    ;; range empty → return NULL to caller
    (if (i32.ge_u (i32.load offset=20 (local.get $frame)) (i32.load offset=24 (local.get $frame)))
      (then (call $bsearch_finish (i32.const 0)) (return)))
    (if (i64.eqz (i64.load offset=40 (local.get $frame)))
      (then
        (if (i64.ne (i64.load offset=32 (local.get $frame)) (call $invocation_current))
          (then (unreachable)))
        (i64.store offset=40 (local.get $frame) (call $invocation_enter)))
      (else
        (if (i64.ne (i64.load offset=40 (local.get $frame)) (call $invocation_current))
          (then (unreachable)))))
    ;; low + (high-low)/2 avoids an overflowing unsigned bound sum.
    (local.set $mid (i32.add (i32.load offset=20 (local.get $frame))
      (i32.shr_u (i32.sub (i32.load offset=24 (local.get $frame))
        (i32.load offset=20 (local.get $frame))) (i32.const 1))))
    (i32.store offset=28 (local.get $frame) (local.get $mid))
    (i32.store offset=56 (local.get $frame)
      (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
    (local.set $elem (i32.add (i32.load offset=8 (local.get $frame))
      (i32.mul (local.get $mid) (i32.load offset=12 (local.get $frame)))))
    ;; Push compar args (cdecl: right-to-left) then return thunk.
    ;; At comparator entry: [esp]=thunk, [esp+4]=key, [esp+8]=elem.
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $elem))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.load offset=4 (local.get $frame)))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $bsearch_thunk))
    (global.set $eip (i32.load offset=16 (local.get $frame)))
    (global.set $steps (i32.const 0))
  )

  (func $bsearch_continue
    (local $frame i32)
    (local.set $frame (call $bsearch_frame))
    ;; Reject stale roots/children or a malformed cdecl return before mutation.
    (if (i32.ne (i32.load offset=16 (global.get $reg_base))
          (i32.load offset=56 (local.get $frame))) (then (unreachable)))
    (call $invocation_leave (i64.load offset=40 (local.get $frame)))
    (i64.store offset=40 (local.get $frame) (i64.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
    (if (i32.eqz (i32.load (global.get $reg_base)))
      (then
        (call $bsearch_finish (i32.add (i32.load offset=8 (local.get $frame))
          (i32.mul (i32.load offset=28 (local.get $frame)) (i32.load offset=12 (local.get $frame)))))
        (return)))
    (if (i32.lt_s (i32.load (global.get $reg_base)) (i32.const 0))
      (then (i32.store offset=24 (local.get $frame) (i32.load offset=28 (local.get $frame))))
      (else (i32.store offset=20 (local.get $frame)
        (i32.add (i32.load offset=28 (local.get $frame)) (i32.const 1)))))
    (call $bsearch_probe))

  (func $handle_bsearch (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $depth i32) (local $frame i32) (local $ret i32) (local $parent i64) (local $child i64)
    ;; arg0=key, arg1=base, arg2=nmemb, arg3=size, arg4=compar. cdecl → caller
    ;; pops the 5 args; we only save the return address and leave args in place.
    ;; Empty array or NULL comparator → return NULL immediately.
    (if (i32.or (i32.eqz (local.get $arg2)) (i32.eqz (local.get $arg4)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (return)))
    (call $invocation_ensure)
    (local.set $depth (select (global.get $bsearch_depth) (i32.const 0)
      (i64.eq (global.get $bsearch_owner) (global.get $invocation_root))))
    (if (i32.ge_u (local.get $depth) (i32.const 64)) (then (unreachable)))
    (local.set $ret (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (local.set $parent (call $invocation_current))
    (local.set $child (call $invocation_enter))
    (local.set $frame (call $bsearch_frame_at (local.get $depth)))
    (global.set $bsearch_owner (global.get $invocation_root))
    (global.set $bsearch_depth (i32.add (local.get $depth) (i32.const 1)))
    (i32.store (local.get $frame) (local.get $ret))
    (i32.store offset=4 (local.get $frame) (local.get $arg0))
    (i32.store offset=8 (local.get $frame) (local.get $arg1))
    (i32.store offset=12 (local.get $frame) (local.get $arg3))
    (i32.store offset=16 (local.get $frame) (local.get $arg4))
    (i32.store offset=20 (local.get $frame) (i32.const 0))
    (i32.store offset=24 (local.get $frame) (local.get $arg2))
    (i64.store offset=32 (local.get $frame) (local.get $parent))
    (i64.store offset=40 (local.get $frame) (local.get $child))
    (i64.store offset=48 (local.get $frame) (global.get $invocation_root))
    (call $bsearch_probe)
  )

  ;; Private retained qsort contexts: sixteen thread partitions, 64 frames of
  ;; 64 bytes each. Frames keep return/base/count/size/compar/pass/index/ESP at
  ;; 0..28, parent invocation at 32, expected child at 40, and root at 48.
  ;; They outlive run slices. A nested comparator's qsort owns a separate frame.
  (global $QSORT_CONTEXTS i32 (region.addr $QSORT_CONTEXTS 0))
  (global $QSORT_CONTEXTS_SIZE i32 (region.size $QSORT_CONTEXTS))
  (global $qsort_owner (mut i64) (i64.const 0))
  (global $qsort_depth (mut i32) (i32.const 0))

  (func $qsort_frame_at (param $index i32) (result i32)
    (i32.add (region.addr $QSORT_CONTEXTS 0)
      (i32.add
        (i32.shl (i32.sub (global.get $invocation_tid) (i32.const 1)) (i32.const 12))
        (i32.shl (local.get $index) (i32.const 6)))))

  (func $qsort_frame (result i32)
    (local $frame i32)
    (call $invocation_validate)
    (if (i64.ne (global.get $qsort_owner) (global.get $invocation_root)) (then (unreachable)))
    (if (i32.eqz (global.get $qsort_depth)) (then (unreachable)))
    (if (i32.gt_u (global.get $qsort_depth) (i32.const 64)) (then (unreachable)))
    (local.set $frame (call $qsort_frame_at (i32.sub (global.get $qsort_depth) (i32.const 1))))
    (if (i64.ne (i64.load offset=48 (local.get $frame)) (global.get $invocation_root))
      (then (unreachable)))
    (local.get $frame))

  ;; qsort(base, nmemb, size, compar) — cdecl. A callback-driven adjacent sort
  ;; is intentionally simple but complete; the guest comparator defines the
  ;; ordering, and byte swaps remain correct when an element crosses sparse
  ;; guest-page backing boundaries.
  (func $qsort_finish
    (local $frame i32)
    (local.set $frame (call $qsort_frame))
    (if (i64.ne (i64.load offset=40 (local.get $frame)) (i64.const 0)) (then (unreachable)))
    (if (i64.ne (i64.load offset=32 (local.get $frame)) (call $invocation_current))
      (then (unreachable)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (global.set $eip (i32.load (local.get $frame)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (global.set $qsort_depth (i32.sub (global.get $qsort_depth) (i32.const 1)))
  )

  (func $qsort_probe
    (local $limit i32) (local $left i32) (local $right i32) (local $frame i32)
    (local.set $frame (call $qsort_frame))
    (if (i32.or
          (i32.or (i32.lt_u (i32.load offset=8 (local.get $frame)) (i32.const 2))
                  (i32.eqz (i32.load offset=12 (local.get $frame))))
          (i32.eqz (i32.load offset=16 (local.get $frame))))
      (then (call $qsort_finish) (return)))
    (if (i32.ge_u (i32.load offset=20 (local.get $frame))
                   (i32.sub (i32.load offset=8 (local.get $frame)) (i32.const 1)))
      (then (call $qsort_finish) (return)))
    (local.set $limit
      (i32.sub (i32.load offset=8 (local.get $frame)) (i32.load offset=20 (local.get $frame))))
    (if (i32.ge_u (i32.add (i32.load offset=24 (local.get $frame)) (i32.const 1))
                   (local.get $limit))
      (then
        (i32.store offset=20 (local.get $frame) (i32.add (i32.load offset=20 (local.get $frame)) (i32.const 1)))
        (i32.store offset=24 (local.get $frame) (i32.const 0))
        (call $qsort_probe)
        (return)))
    ;; First probe already owns the child allocated transactionally at API
    ;; entry. Each subsequent comparator receives a distinct fresh identity.
    (if (i64.eqz (i64.load offset=40 (local.get $frame)))
      (then
        (if (i64.ne (i64.load offset=32 (local.get $frame)) (call $invocation_current))
          (then (unreachable)))
        (i64.store offset=40 (local.get $frame) (call $invocation_enter)))
      (else
        (if (i64.ne (i64.load offset=40 (local.get $frame)) (call $invocation_current))
          (then (unreachable)))))
    (i32.store offset=28 (local.get $frame)
      (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
    (local.set $left (i32.add (i32.load offset=4 (local.get $frame))
      (i32.mul (i32.load offset=24 (local.get $frame)) (i32.load offset=12 (local.get $frame)))))
    (local.set $right (i32.add (local.get $left) (i32.load offset=12 (local.get $frame))))
    ;; compar(left, right), cdecl: push right-to-left and leave its two args
    ;; for CACA002D to discard after the callback's plain RET.
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $right))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $left))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $qsort_thunk))
    (global.set $eip (i32.load offset=16 (local.get $frame)))
    (global.set $steps (i32.const 0))
  )

  (func $qsort_continue
    (local $left i32) (local $right i32) (local $i i32) (local $byte i32) (local $frame i32)
    (local.set $frame (call $qsort_frame))
    ;; Validate the retained child and exact cdecl return stack BEFORE either
    ;; popping ownership or touching guest arguments/data. A fabricated/stale
    ;; CACA002D continuation cannot silently complete the current invocation.
    (if (i32.ne (i32.load offset=16 (global.get $reg_base))
          (i32.load offset=28 (local.get $frame))) (then (unreachable)))
    (call $invocation_leave (i64.load offset=40 (local.get $frame)))
    (i64.store offset=40 (local.get $frame) (i64.const 0))
    ;; The comparator's RET consumed the thunk; discard its cdecl arguments.
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
    (if (i32.gt_s (i32.load offset=0 (global.get $reg_base)) (i32.const 0))
      (then
        (local.set $left (i32.add (i32.load offset=4 (local.get $frame))
          (i32.mul (i32.load offset=24 (local.get $frame)) (i32.load offset=12 (local.get $frame)))))
        (local.set $right (i32.add (local.get $left) (i32.load offset=12 (local.get $frame))))
        (block $done (loop $swap
          (br_if $done (i32.ge_u (local.get $i) (i32.load offset=12 (local.get $frame))))
          (local.set $byte (call $gl8 (i32.add (local.get $left) (local.get $i))))
          (call $gs8 (i32.add (local.get $left) (local.get $i))
            (call $gl8 (i32.add (local.get $right) (local.get $i))))
          (call $gs8 (i32.add (local.get $right) (local.get $i)) (local.get $byte))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $swap)))))
    (i32.store offset=24 (local.get $frame) (i32.add (i32.load offset=24 (local.get $frame)) (i32.const 1)))
    (call $qsort_probe)
  )

  (func $handle_qsort (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $depth i32) (local $frame i32) (local $ret i32) (local $parent i64) (local $child i64)
    (if (i32.or
          (i32.or (i32.lt_u (local.get $arg1) (i32.const 2))
                  (i32.eqz (local.get $arg2)))
          (i32.eqz (local.get $arg3)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (return)))
    (call $invocation_ensure)
    (local.set $depth (select (global.get $qsort_depth) (i32.const 0)
      (i64.eq (global.get $qsort_owner) (global.get $invocation_root))))
    (if (i32.ge_u (local.get $depth) (i32.const 64)) (then (unreachable)))
    (local.set $ret (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (local.set $parent (call $invocation_current))
    ;; Capacity/identity exhaustion fails before publishing a retained frame.
    (local.set $child (call $invocation_enter))
    (local.set $frame (call $qsort_frame_at (local.get $depth)))
    (global.set $qsort_owner (global.get $invocation_root))
    (global.set $qsort_depth (i32.add (local.get $depth) (i32.const 1)))
    (i32.store (local.get $frame) (local.get $ret))
    (i32.store offset=4 (local.get $frame) (local.get $arg0))
    (i32.store offset=8 (local.get $frame) (local.get $arg1))
    (i32.store offset=12 (local.get $frame) (local.get $arg2))
    (i32.store offset=16 (local.get $frame) (local.get $arg3))
    (i32.store offset=20 (local.get $frame) (i32.const 0))
    (i32.store offset=24 (local.get $frame) (i32.const 0))
    (i64.store offset=32 (local.get $frame) (local.get $parent))
    (i64.store offset=40 (local.get $frame) (local.get $child))
    (i64.store offset=48 (local.get $frame) (global.get $invocation_root))
    (call $qsort_probe)
  )

  ;; IsEqualGUID(rguid1, rguid2) — compare all 16 bytes of the two GUIDs.
  ;; The Windows headers commonly expose this as an inline/macro, but some
  ;; Win9x-era runtimes import the helper from OLE32.
  (func $handle_IsEqualGUID (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa0 i32) (local $wa1 i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (if (i32.eq (local.get $arg0) (local.get $arg1))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 1)))
      (else
        (if (i32.and
              (i32.ne (local.get $arg0) (i32.const 0))
              (i32.ne (local.get $arg1) (i32.const 0)))
          (then
            (local.set $wa0 (call $g2w (local.get $arg0)))
            (local.set $wa1 (call $g2w (local.get $arg1)))
            (i32.store offset=0 (global.get $reg_base) (i32.and
                (i32.and
                  (i32.eq (i32.load (local.get $wa0))
                          (i32.load (local.get $wa1)))
                  (i32.eq (i32.load offset=4 (local.get $wa0))
                          (i32.load offset=4 (local.get $wa1))))
                (i32.and
                  (i32.eq (i32.load offset=8 (local.get $wa0))
                          (i32.load offset=8 (local.get $wa1)))
                  (i32.eq (i32.load offset=12 (local.get $wa0))
                          (i32.load offset=12 (local.get $wa1))))))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; Register one CRT termination callback. Returns 0 on success and -1 for a
  ;; NULL callback or allocation failure, matching the Microsoft CRT contract.
  (func $crt_atexit_register (param $fn i32) (result i32)
    (local $new_capacity i32) (local $new_table i32)
    (if (i32.eqz (local.get $fn))
      (then (return (i32.const -1))))
    (if (i32.eqz (global.get $atexit_table))
      (then
        (global.set $atexit_capacity (i32.const 32))
        (global.set $atexit_table (call $heap_alloc (i32.const 128)))
        (if (i32.eqz (global.get $atexit_table))
          (then
            (global.set $atexit_capacity (i32.const 0))
            (return (i32.const -1))))))
    (if (i32.ge_u (global.get $atexit_count) (global.get $atexit_capacity))
      (then
        (local.set $new_capacity
          (i32.shl (global.get $atexit_capacity) (i32.const 1)))
        ;; Keep size arithmetic bounded even for a hostile registration loop.
        (if (i32.gt_u (local.get $new_capacity) (i32.const 0x10000000))
          (then (return (i32.const -1))))
        (local.set $new_table
          (call $heap_alloc (i32.shl (local.get $new_capacity) (i32.const 2))))
        (if (i32.eqz (local.get $new_table))
          (then (return (i32.const -1))))
        (call $memcpy
          (call $g2w (local.get $new_table))
          (call $g2w (global.get $atexit_table))
          (i32.shl (global.get $atexit_count) (i32.const 2)))
        (call $heap_free (global.get $atexit_table))
        (global.set $atexit_table (local.get $new_table))
        (global.set $atexit_capacity (local.get $new_capacity))))
    (call $gs32
      (i32.add (global.get $atexit_table)
        (i32.shl (global.get $atexit_count) (i32.const 2)))
      (local.get $fn))
    (global.set $atexit_count
      (i32.add (global.get $atexit_count) (i32.const 1)))
    (i32.const 0)
  )

  ;; Both exit and returning cleanup consume the same LIFO registry. Pop before
  ;; entering guest code so nested cleanup cannot run the same callback twice.
  (func $crt_atexit_pop (result i32)
    (local $fn i32)
    (block $done (loop $scan
      (if (i32.eqz (global.get $atexit_count))
        (then (br $done)))
      (global.set $atexit_count
        (i32.sub (global.get $atexit_count) (i32.const 1)))
      (local.set $fn
        (call $gl32
          (i32.add (global.get $atexit_table)
            (i32.shl (global.get $atexit_count) (i32.const 2)))))
      ;; Be defensive about a corrupt/cleared slot while still draining the
      ;; rest of the registry.
      (if (i32.eqz (local.get $fn))
        (then (br $scan)))
      (return (local.get $fn))))
    (i32.const 0))

  ;; Retained init/exit frames: mode 0=_initterm, 1=exit, 2=_cexit.
  ;; 0 ret, 4 cursor, 8 end, 12 mode, 16 exit code, 20 expected ESP;
  ;; 32 parent, 40 expected child, 48 root. Sixteen independent partitions.
  (global $CRT_CALLBACK_CONTEXTS i32 (region.addr $CRT_CALLBACK_CONTEXTS 0))
  (global $CRT_CALLBACK_CONTEXTS_SIZE i32 (region.size $CRT_CALLBACK_CONTEXTS))
  (global $crt_callback_owner (mut i64) (i64.const 0))
  (global $crt_callback_depth (mut i32) (i32.const 0))
  (global $crt_cexit_thunk (mut i32) (i32.const 0))

  (func $crt_callback_frame_at (param $index i32) (result i32)
    (i32.add (region.addr $CRT_CALLBACK_CONTEXTS 0)
      (i32.add (i32.shl (i32.sub (global.get $invocation_tid) (i32.const 1)) (i32.const 12))
        (i32.shl (local.get $index) (i32.const 6)))))

  (func $crt_callback_frame (result i32)
    (local $frame i32)
    (call $invocation_validate)
    (if (i64.ne (global.get $crt_callback_owner) (global.get $invocation_root)) (then (unreachable)))
    (if (i32.eqz (global.get $crt_callback_depth)) (then (unreachable)))
    (if (i32.gt_u (global.get $crt_callback_depth) (i32.const 64)) (then (unreachable)))
    (local.set $frame (call $crt_callback_frame_at (i32.sub (global.get $crt_callback_depth) (i32.const 1))))
    (if (i64.ne (i64.load offset=48 (local.get $frame)) (global.get $invocation_root)) (then (unreachable)))
    (local.get $frame))

  ;; Locate a non-null slot without consuming registry/table state. Entry can
  ;; then reserve its child identity before committing any callback state.
  (func $crt_callback_slot (param $mode i32) (param $ptr i32) (param $end i32) (result i32)
    (local $n i32)
    (if (i32.eqz (local.get $mode))
      (then
        (block $done (loop $scan
          (br_if $done (i32.ge_u (local.get $ptr) (local.get $end)))
          (if (call $gl32 (local.get $ptr)) (then (return (local.get $ptr))))
          (local.set $ptr (i32.add (local.get $ptr) (i32.const 4)))
          (br $scan))))
      (else
        (local.set $n (global.get $atexit_count))
        (block $done (loop $scan
          (br_if $done (i32.eqz (local.get $n)))
          (local.set $n (i32.sub (local.get $n) (i32.const 1)))
          (local.set $ptr (i32.add (global.get $atexit_table) (i32.shl (local.get $n) (i32.const 2))))
          (if (call $gl32 (local.get $ptr)) (then (return (local.get $ptr))))
          (br $scan)))))
    (i32.const 0))

  (func $crt_callback_complete (param $mode i32) (param $ret i32) (param $sp i32) (param $code i32)
    (if (local.get $mode)
      (then
        (global.set $atexit_count (i32.const 0))
        (call $crt_stream_close_all)))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (if (i32.eq (local.get $mode) (i32.const 1))
      (then
        (call $host_exit (local.get $code))
        (global.set $eip (i32.const 0))
        (global.set $yield_flag (i32.const 1))
        (global.set $yield_reason (i32.const 2))
        (global.set $steps (i32.const 0)))
      (else (call $com_jump (local.get $ret)))))

  (func $crt_callback_launch (param $frame i32) (param $slot i32)
    (local $thunk i32) (local $fn i32) (local $sp i32)
    (local.set $fn (call $gl32 (local.get $slot)))
    (if (i32.eqz (i32.load offset=12 (local.get $frame)))
      (then
        (i32.store offset=4 (local.get $frame) (i32.add (local.get $slot) (i32.const 4)))
        (local.set $thunk (global.get $initterm_thunk)))
      (else
        ;; Pop before entering guest code: nested cleanup cannot repeat this callback.
        (global.set $atexit_count (i32.shr_u (i32.sub (local.get $slot) (global.get $atexit_table)) (i32.const 2)))
        (local.set $thunk (global.get $atexit_ret_thunk))
        (if (i32.eq (i32.load offset=12 (local.get $frame)) (i32.const 2))
          (then
            (if (i32.eqz (global.get $crt_cexit_thunk))
              (then (global.set $crt_cexit_thunk (call $com_cont_thunk (i32.const 0xCACA0038)))))
            (local.set $thunk (global.get $crt_cexit_thunk))))))
    (local.set $sp (i32.sub (i32.load offset=20 (local.get $frame)) (i32.const 4)))
    (call $gs32 (local.get $sp) (local.get $thunk))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (call $com_jump (local.get $fn)))

  (func $crt_callback_begin (param $mode i32) (param $ptr i32) (param $end i32) (param $code i32)
    (local $slot i32) (local $sp i32) (local $ret i32) (local $depth i32) (local $frame i32)
    (local $parent i64) (local $child i64)
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (local.set $ret (call $gl32 (local.get $sp)))
    (local.set $sp (i32.add (local.get $sp) (i32.const 4)))
    (local.set $slot (call $crt_callback_slot (local.get $mode) (local.get $ptr) (local.get $end)))
    (if (i32.eqz (local.get $slot))
      (then (call $crt_callback_complete (local.get $mode) (local.get $ret) (local.get $sp) (local.get $code)) (return)))
    (call $invocation_ensure)
    (local.set $depth (select (global.get $crt_callback_depth) (i32.const 0)
      (i64.eq (global.get $crt_callback_owner) (global.get $invocation_root))))
    (if (i32.ge_u (local.get $depth) (i32.const 64)) (then (unreachable)))
    (local.set $parent (call $invocation_current))
    (local.set $child (call $invocation_enter))
    (local.set $frame (call $crt_callback_frame_at (local.get $depth)))
    (global.set $crt_callback_owner (global.get $invocation_root))
    (global.set $crt_callback_depth (i32.add (local.get $depth) (i32.const 1)))
    (i32.store (local.get $frame) (local.get $ret))
    (i32.store offset=4 (local.get $frame) (local.get $ptr))
    (i32.store offset=8 (local.get $frame) (local.get $end))
    (i32.store offset=12 (local.get $frame) (local.get $mode))
    (i32.store offset=16 (local.get $frame) (local.get $code))
    (i32.store offset=20 (local.get $frame) (local.get $sp))
    (i64.store offset=32 (local.get $frame) (local.get $parent))
    (i64.store offset=40 (local.get $frame) (local.get $child))
    (i64.store offset=48 (local.get $frame) (global.get $invocation_root))
    (call $crt_callback_launch (local.get $frame) (local.get $slot)))

  (func $crt_callback_continue (param $mode i32)
    (local $frame i32) (local $slot i32)
    (local.set $frame (call $crt_callback_frame))
    (if (i32.ne (local.get $mode) (i32.load offset=12 (local.get $frame))) (then (unreachable)))
    (if (i32.ne (i32.load offset=16 (global.get $reg_base)) (i32.load offset=20 (local.get $frame))) (then (unreachable)))
    (if (i32.eqz (global.get $invocation_depth)) (then (unreachable)))
    (if (i64.ne (i64.load offset=32 (local.get $frame))
          (i64.load (i32.add (global.get $invocation_slot)
            (i32.add (i32.const 16) (i32.shl (i32.sub (global.get $invocation_depth) (i32.const 1)) (i32.const 3))))))
      (then (unreachable)))
    (call $invocation_leave (i64.load offset=40 (local.get $frame)))
    (i64.store offset=40 (local.get $frame) (i64.const 0))
    (if (i64.ne (call $invocation_current) (i64.load offset=32 (local.get $frame))) (then (unreachable)))
    (local.set $slot (call $crt_callback_slot (local.get $mode) (i32.load offset=4 (local.get $frame)) (i32.load offset=8 (local.get $frame))))
    (if (local.get $slot)
      (then
        (i64.store offset=40 (local.get $frame) (call $invocation_enter))
        (call $crt_callback_launch (local.get $frame) (local.get $slot)))
      (else
        (global.set $crt_callback_depth (i32.sub (global.get $crt_callback_depth) (i32.const 1)))
        (call $crt_callback_complete (local.get $mode) (i32.load (local.get $frame))
          (i32.load offset=20 (local.get $frame)) (i32.load offset=16 (local.get $frame))))))

  ;; atexit(fn) — cdecl, so the caller retains the argument word.
  (func $handle_atexit (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $crt_atexit_register (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; strstr(haystack, needle) — cdecl. Return the guest pointer to the first
  ;; exact byte substring, haystack for an empty needle, or NULL if absent.
  (func $handle_strstr (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $hay_base i32) (local $hay i32) (local $needle i32)
    (local $h i32) (local $n i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (block $done
      (if (i32.and (i32.ne (local.get $arg0) (i32.const 0))
                    (i32.ne (local.get $arg1) (i32.const 0)))
        (then
        (local.set $hay_base (call $g2w (local.get $arg0)))
        (local.set $hay (local.get $hay_base))
        (local.set $needle (call $g2w (local.get $arg1)))
        (if (i32.eqz (i32.load8_u (local.get $needle)))
          (then (i32.store offset=0 (global.get $reg_base) (local.get $arg0)))
          (else
            (block $absent (loop $candidate
              (br_if $absent (i32.eqz (i32.load8_u (local.get $hay))))
              (local.set $h (local.get $hay))
              (local.set $n (local.get $needle))
              (block $mismatch (loop $compare
                (br_if $mismatch
                  (i32.ne (i32.load8_u (local.get $h))
                          (i32.load8_u (local.get $n))))
                (local.set $n (i32.add (local.get $n) (i32.const 1)))
                (if (i32.eqz (i32.load8_u (local.get $n)))
                  (then
                    (i32.store offset=0 (global.get $reg_base) (i32.add (local.get $arg0)
                        (i32.sub (local.get $hay) (local.get $hay_base))))
                    (br $done)))
                (local.set $h (i32.add (local.get $h) (i32.const 1)))
                ;; The haystack ended while the needle still has bytes.
                (br_if $mismatch (i32.eqz (i32.load8_u (local.get $h))))
                (br $compare)))
              (local.set $hay (i32.add (local.get $hay) (i32.const 1)))
              (br $candidate))))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; MSVC i386 _JUMP_BUFFER (16 DWORDs): EBP, EBX, EDI, ESI, entry ESP,
  ;; return EIP, FS:[0], TryLevel, VC20 cookie, stdcall unwind function,
  ;; six unwind arguments. ESP is saved BEFORE the return-address pop.
  ;; See Wine include/msvcrt/setjmp.h and dlls/msvcrt/except_i386.c.
  ;; Invalid/unmapped buffers fail fast; ISO C gives them no defined result.
  (func $crt_jump_buffer (param $p i32) (result i32)
    (local $w i32)
    (local.set $w (call $g2w (local.get $p)))
    (if (i32.or (i32.eqz (local.get $p))
          (i32.or (i32.gt_u (local.get $p) (i32.const 0xffffffc0))
            (i32.or (i32.eq (local.get $w) (i32.const 0xf0))
              (i32.ne (call $g2w (i32.add (local.get $p) (i32.const 63)))
                      (i32.add (local.get $w) (i32.const 63))))))
      (then (unreachable)))
    (local.get $w))

  (func $handle__setjmp3 (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $b i32) (local $sp i32) (local $reg i32) (local $i i32)
    (local.set $b (call $crt_jump_buffer (local.get $arg0)))
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (local.set $reg (call $gl32 (global.get $fs_base)))
    (call $zero_memory (local.get $b) (i32.const 64))
    (i32.store offset=0 (local.get $b) (i32.load offset=20 (global.get $reg_base)))
    (i32.store offset=4 (local.get $b) (i32.load offset=12 (global.get $reg_base)))
    (i32.store offset=8 (local.get $b) (i32.load offset=28 (global.get $reg_base)))
    (i32.store offset=12 (local.get $b) (i32.load offset=24 (global.get $reg_base)))
    (i32.store offset=16 (local.get $b) (local.get $sp))
    (i32.store offset=20 (local.get $b) (call $gl32 (local.get $sp)))
    (i32.store offset=24 (local.get $b) (local.get $reg))
    (i32.store offset=28 (local.get $b) (i32.const -1))
    (i32.store offset=32 (local.get $b) (i32.const 0x56433230))
    (if (i32.and (i32.ne (local.get $reg) (i32.const -1))
                 (i32.ne (local.get $reg) (i32.const 0)))
      (then
        (i32.store offset=28 (local.get $b)
          (if (result i32) (i32.gt_s (local.get $arg1) (i32.const 1))
            (then (local.get $arg3))
            (else (call $gl32 (i32.add (local.get $reg) (i32.const 12))))))
        (if (i32.gt_s (local.get $arg1) (i32.const 0))
          (then (i32.store offset=36 (local.get $b) (local.get $arg2))))
        (block $done (loop $copy
          (br_if $done (i32.ge_u (local.get $i) (i32.const 6)))
          (br_if $done (i32.ge_s (i32.add (local.get $i) (i32.const 2)) (local.get $arg1)))
          (i32.store (i32.add (local.get $b) (i32.add (i32.const 40) (i32.shl (local.get $i) (i32.const 2))))
            (call $gl32 (i32.add (local.get $sp) (i32.add (i32.const 20) (i32.shl (local.get $i) (i32.const 2))))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $copy)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  ;; Invocation-owned state below the longjmp frame survives real guest SEH
  ;; handlers and the optional stdcall UnwindFunc. No singleton saved context:
  ;; separate buffers, nested callbacks and threads cannot overwrite it.
  (global $crt_longjmp_thunk (mut i32) (i32.const 0))
  (func $crt_longjmp_continue
    (local $s i32) (local $b i32) (local $buf i32) (local $value i32)
    (local.set $s (i32.load offset=16 (global.get $reg_base)))
    (if (i32.ne (call $gl32 (local.get $s)) (i32.const 0x504d4a4c))
      (then (unreachable)))
    (local.set $buf (call $gl32 (i32.add (local.get $s) (i32.const 4))))
    (local.set $b (call $crt_jump_buffer (local.get $buf)))
    (if (i32.and (i32.eqz (call $gl32 (i32.add (local.get $s) (i32.const 12))))
                 (i32.ne (i32.load offset=36 (local.get $b)) (i32.const 0)))
      (then
        (call $gs32 (i32.add (local.get $s) (i32.const 12)) (i32.const 1))
        (call $gs32 (i32.sub (local.get $s) (i32.const 8)) (global.get $crt_longjmp_thunk))
        (call $gs32 (i32.sub (local.get $s) (i32.const 4)) (local.get $buf))
        (i32.store offset=16 (global.get $reg_base) (i32.sub (local.get $s) (i32.const 8)))
        (global.set $eip (i32.load offset=36 (local.get $b)))
        (global.set $handler_set_eip (i32.const 1))
        (global.set $steps (i32.const 0))
        (return)))
    (local.set $value (call $gl32 (i32.add (local.get $s) (i32.const 8))))
    (i32.store offset=20 (global.get $reg_base) (i32.load offset=0 (local.get $b)))
    (i32.store offset=12 (global.get $reg_base) (i32.load offset=4 (local.get $b)))
    (i32.store offset=28 (global.get $reg_base) (i32.load offset=8 (local.get $b)))
    (i32.store offset=24 (global.get $reg_base) (i32.load offset=12 (local.get $b)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (local.get $b)) (i32.const 4)))
    (i32.store offset=0 (global.get $reg_base)
      (select (local.get $value) (i32.const 1) (local.get $value)))
    (global.set $eip (i32.load offset=20 (local.get $b)))
    ;; Decoded CALL/JMP tests steps; thunk-zone run tests handler_set_eip.
    (global.set $resume_ip (i32.const 0))
    (global.set $eip_redirected (i32.const 1))
    (global.set $handler_set_eip (i32.const 1))
    (global.set $steps (i32.const 0)))

  (func $handle_longjmp (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $b i32) (local $s i32) (local $cur i32) (local $target i32) (local $n i32)
    (local.set $b (call $crt_jump_buffer (local.get $arg0)))
    ;; This handler supports the observed _setjmp3 ABI, not legacy _setjmp's
    ;; cookie-less local-unwind format. Reject it rather than skipping cleanup.
    (if (i32.or (i32.ne (i32.load offset=32 (local.get $b)) (i32.const 0x56433230))
          (i32.or (i32.eqz (i32.load offset=16 (local.get $b)))
                  (i32.eqz (i32.load offset=20 (local.get $b)))))
      (then (unreachable)))
    ;; Stack bounds come from the active thread TIB, so a context belonging to
    ;; another thread is rejected even when both exception chains end in -1.
    (if (i32.or
          (i32.lt_u (i32.load offset=16 (local.get $b)) (call $gl32 (i32.add (global.get $fs_base) (i32.const 8))))
          (i32.ge_u (i32.load offset=16 (local.get $b)) (call $gl32 (i32.add (global.get $fs_base) (i32.const 4)))))
      (then (unreachable)))
    (local.set $target (i32.load offset=24 (local.get $b)))
    (local.set $cur (call $gl32 (global.get $fs_base)))
    ;; A saved registration must belong to THIS thread's live chain. Bounded
    ;; validation rejects missing targets/cycles before RtlUnwind can unlink.
    (block $found (loop $chain
      (br_if $found (i32.eq (local.get $cur) (local.get $target)))
      (if (i32.or (i32.ge_u (local.get $n) (i32.const 4096))
            (i32.or (i32.eqz (local.get $cur)) (i32.eq (local.get $cur) (i32.const -1))))
        (then (unreachable)))
      (local.set $cur (call $gl32 (local.get $cur)))
      (local.set $n (i32.add (local.get $n) (i32.const 1)))
      (br $chain)))
    ;; MSVCR70 restores EBP before invoking either unwind path: MSVC cleanup
    ;; funclets may address the saving frame through it.
    (i32.store offset=20 (global.get $reg_base) (i32.load offset=0 (local.get $b)))
    (if (i32.eqz (global.get $crt_longjmp_thunk))
      (then (global.set $crt_longjmp_thunk (call $com_cont_thunk (i32.const 0xCACA0041)))))
    (local.set $s (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
    (call $gs32 (local.get $s) (i32.const 0x504d4a4c))
    (call $gs32 (i32.add (local.get $s) (i32.const 4)) (local.get $arg0))
    (call $gs32 (i32.add (local.get $s) (i32.const 8)) (local.get $arg1))
    (call $gs32 (i32.add (local.get $s) (i32.const 12)) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $s))
    (global.set $resume_ip (i32.const 0))
    (global.set $eip_redirected (i32.const 1))
    (global.set $handler_set_eip (i32.const 1))
    (global.set $steps (i32.const 0))
    (if (i32.ne (call $gl32 (global.get $fs_base)) (local.get $target))
      (then (call $rtl_unwind_begin (local.get $target) (i32.const 0) (i32.const 0) (global.get $crt_longjmp_thunk)))
      (else (call $crt_longjmp_continue))))

  ;; ── CRT exports answered natively, with the authentic export behind them ──
  ;;
  ;; When a real MSVCRT/MSVCR70/MSVCR71 is loaded, its callers' imports of the
  ;; names in $crt_override_api_id are bound to API thunks instead of to the
  ;; DLL's code (08b-dll-loader.wat, $patch_caller_iat), and the authentic
  ;; export's address is recorded here against the thunk's index. A handler
  ;; answers natively only when it can be exact, and otherwise calls
  ;; $crt_fallback, which sends the guest into the authentic export with the
  ;; caller's frame untouched (return address still at [ESP], cdecl arguments
  ;; still above it) -- so the real code runs as though the thunk never
  ;; existed. See docs/crt-native-overrides.md for the census that chose the
  ;; names and for what each handler must match.
  ;;
  ;; The locale is the reason a fallback exists at all. VC6-VC7.1 case-folding
  ;; and ctype routines take an ASCII-only path while LC_CTYPE is "C" and go
  ;; through the locale tables otherwise; the native handlers implement only
  ;; the first. Every import of setlocale/_wsetlocale from the same DLLs is
  ;; bound here too, and any call that can move the locale away from "C" sets
  ;; the sticky flag at +4 before running the real setlocale, after which the
  ;; locale-sensitive handlers always defer. (A setlocale reached through
  ;; GetProcAddress bypasses the hook; none of the measured apps do that.)
  (global $CRT_OVERRIDE_TABLE i32 (region.addr $CRT_OVERRIDE_TABLE 0))
  (global $CRT_OVERRIDE_TABLE_SIZE i32 (region.size $CRT_OVERRIDE_TABLE))

  (func $crt_override_capacity (result i32)
    (i32.shr_u (i32.sub (global.get $CRT_OVERRIDE_TABLE_SIZE) (i32.const 8)) (i32.const 3)))

  (func $crt_dll_is_msvcr (param $dll_name_ga i32) (result i32)
    (i32.or
      (call $dll_name_match (local.get $dll_name_ga) "msvcrt.dll")
      (i32.or
        (call $dll_name_match (local.get $dll_name_ga) "msvcr70.dll")
        (call $dll_name_match (local.get $dll_name_ga) "msvcr71.dll"))))

  ;; The CRT-only overrides: an api id when $name_wa is one, else -1.
  (func $crt_override_api_id (param $name_wa i32) (result i32)
    (if (i32.or
          (i32.or
            (i32.or (call $str_eq (local.get $name_wa) "wcslen")
                    (call $str_eq (local.get $name_wa) "wcscpy"))
            (i32.or (call $str_eq (local.get $name_wa) "wcscat")
                    (call $str_eq (local.get $name_wa) "wcsstr")))
          (i32.or
            (i32.or (call $str_eq (local.get $name_wa) "_wcsicmp")
                    (call $str_eq (local.get $name_wa) "_wcsnicmp"))
            (i32.or (call $str_eq (local.get $name_wa) "floor")
                    (i32.or (call $str_eq (local.get $name_wa) "setlocale")
                            (call $str_eq (local.get $name_wa) "_wsetlocale")))))
      (then (return (call $lookup_api_id (local.get $name_wa)))))
    (i32.const -1))

  ;; Names on the older $native_override_export_api_id list whose handler is
  ;; locale-sensitive: over a real MSVCRT/MSVCR7x their authentic export is
  ;; recorded too, so the handler can defer once the locale leaves "C".
  (func $crt_native_override_defers (param $name_wa i32) (result i32)
    (call $str_eq (local.get $name_wa) "_stricmp"))

  ;; Record the authentic export behind a CRT override thunk. Returns 0 when
  ;; the table is full, in which case the caller must bind the import to the
  ;; authentic export instead.
  (func $crt_override_record (param $thunk_idx i32) (param $real i32) (result i32)
    (local $n i32) (local $slot i32)
    (local.set $n (i32.atomic.rmw.add (global.get $CRT_OVERRIDE_TABLE) (i32.const 1)))
    (if (i32.ge_u (local.get $n) (call $crt_override_capacity))
      (then
        (drop (i32.atomic.rmw.sub (global.get $CRT_OVERRIDE_TABLE) (i32.const 1)))
        (return (i32.const 0))))
    (local.set $slot (i32.add (global.get $CRT_OVERRIDE_TABLE)
      (i32.add (i32.const 8) (i32.shl (local.get $n) (i32.const 3)))))
    (i32.store offset=4 (local.get $slot) (local.get $real))
    (i32.atomic.store (local.get $slot) (local.get $thunk_idx))
    (i32.const 1))

  ;; The authentic export behind the thunk now being dispatched, or 0.
  (func $crt_override_real (result i32)
    (local $idx i32) (local $i i32) (local $slot i32)
    (local.set $idx (i32.shr_u
      (i32.sub (global.get $current_thunk_eip) (global.get $thunk_guest_base))
      (i32.const 3)))
    (local.set $i (i32.atomic.load (global.get $CRT_OVERRIDE_TABLE)))
    (if (i32.gt_u (local.get $i) (call $crt_override_capacity))
      (then (local.set $i (call $crt_override_capacity))))
    (block $done (loop $scan
      (br_if $done (i32.eqz (local.get $i)))
      (local.set $i (i32.sub (local.get $i) (i32.const 1)))
      (local.set $slot (i32.add (global.get $CRT_OVERRIDE_TABLE)
        (i32.add (i32.const 8) (i32.shl (local.get $i) (i32.const 3)))))
      (if (i32.eq (i32.atomic.load (local.get $slot)) (local.get $idx))
        (then (return (i32.load offset=4 (local.get $slot)))))
      (br $scan)))
    (i32.const 0))

  ;; Hand the current call to the authentic export. Leaves ESP and every
  ;; register as the caller set them; returns 0 (nothing done) when this
  ;; thunk has no authentic export behind it.
  (func $crt_fallback (result i32)
    (local $real i32)
    (local.set $real (call $crt_override_real))
    (if (i32.eqz (local.get $real)) (then (return (i32.const 0))))
    (global.set $crt_fallback_count (i32.add (global.get $crt_fallback_count) (i32.const 1)))
    (global.set $eip (local.get $real))
    ;; Tells the decoded call handlers and $run's thunk branch that EIP was
    ;; redirected, as a callback-driven handler (qsort) does.
    (global.set $steps (i32.const 0))
    (global.set $handler_set_eip (i32.const 1))
    (i32.const 1))

  (global $crt_fallback_count (mut i32) (i32.const 0))
  (func (export "get_crt_fallback_count") (result i32) (global.get $crt_fallback_count))

  (func $crt_locale_changed (result i32)
    (i32.atomic.load offset=4 (global.get $CRT_OVERRIDE_TABLE)))

  ;; setlocale(category, locale) / _wsetlocale — cdecl. A NULL locale is a
  ;; query and "C" keeps the C locale; anything else may leave it, so mark the
  ;; process before the authentic setlocale runs.
  (func $handle_setlocale (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.ne (local.get $arg1) (i32.const 0))
      (then
        (if (i32.eqz (i32.and
              (i32.eq (call $gl8 (local.get $arg1)) (i32.const 0x43))
              (i32.eqz (call $gl8 (i32.add (local.get $arg1) (i32.const 1))))))
          (then (i32.atomic.store offset=4 (global.get $CRT_OVERRIDE_TABLE) (i32.const 1))))))
    (if (call $crt_fallback) (then (return)))
    (call $crash_unimplemented (local.get $name_ptr)))

  (func $handle__wsetlocale (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.ne (local.get $arg1) (i32.const 0))
      (then
        (if (i32.eqz (i32.and
              (i32.eq (call $gl16 (local.get $arg1)) (i32.const 0x43))
              (i32.eqz (call $gl16 (i32.add (local.get $arg1) (i32.const 2))))))
          (then (i32.atomic.store offset=4 (global.get $CRT_OVERRIDE_TABLE) (i32.const 1))))))
    (if (call $crt_fallback) (then (return)))
    (call $crash_unimplemented (local.get $name_ptr)))

  ;; __ascii_towlower: the C-locale fold every VC6-VC7.1 wide compare uses.
  (func $crt_ascii_towlower (param $c i32) (result i32)
    (select
      (i32.add (local.get $c) (i32.const 0x20))
      (local.get $c)
      (i32.lt_u (i32.sub (local.get $c) (i32.const 0x41)) (i32.const 26))))

  ;; _wcsicmp(a, b) — cdecl. C locale: fold A-Z, stop at the first difference
  ;; or at a NUL in a, return the difference of the folded code units.
  (func $handle__wcsicmp (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $f i32) (local $l i32)
    (if (call $crt_locale_changed)
      (then (if (call $crt_fallback) (then (return)))))
    (block $d (loop $l
      (local.set $f (call $crt_ascii_towlower (call $gl16 (local.get $arg0))))
      (local.set $l (call $crt_ascii_towlower (call $gl16 (local.get $arg1))))
      (local.set $arg0 (i32.add (local.get $arg0) (i32.const 2)))
      (local.set $arg1 (i32.add (local.get $arg1) (i32.const 2)))
      (br_if $d (i32.eqz (local.get $f)))
      (br_if $l (i32.eq (local.get $f) (local.get $l)))))
    (i32.store offset=0 (global.get $reg_base) (i32.sub (local.get $f) (local.get $l)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  ;; _wcsnicmp(a, b, count) — cdecl. As _wcsicmp, at most count units; a zero
  ;; count compares equal without reading either string.
  (func $handle__wcsnicmp (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $f i32) (local $l i32)
    (if (call $crt_locale_changed)
      (then (if (call $crt_fallback) (then (return)))))
    (if (local.get $arg2)
      (then
        (block $d (loop $l
          (local.set $f (call $crt_ascii_towlower (call $gl16 (local.get $arg0))))
          (local.set $l (call $crt_ascii_towlower (call $gl16 (local.get $arg1))))
          (local.set $arg0 (i32.add (local.get $arg0) (i32.const 2)))
          (local.set $arg1 (i32.add (local.get $arg1) (i32.const 2)))
          (local.set $arg2 (i32.sub (local.get $arg2) (i32.const 1)))
          (br_if $d (i32.eqz (local.get $arg2)))
          (br_if $d (i32.eqz (local.get $f)))
          (br_if $l (i32.eq (local.get $f) (local.get $l)))))))
    (i32.store offset=0 (global.get $reg_base) (i32.sub (local.get $f) (local.get $l)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  ;; wcslen(s) — cdecl. No cap: the authentic loop has none either.
  (func $handle_wcslen (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $p i32)
    (local.set $p (local.get $arg0))
    (block $d (loop $l
      (br_if $d (i32.eqz (call $gl16 (local.get $p))))
      (local.set $p (i32.add (local.get $p) (i32.const 2)))
      (br $l)))
    (i32.store offset=0 (global.get $reg_base)
      (i32.shr_s (i32.sub (local.get $p) (local.get $arg0)) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  ;; One forward code-unit copy through the terminator, as the authentic loop
  ;; does -- so an overlapping destination ends up exactly as it would there.
  (func $crt_wcs_copy (param $dst i32) (param $src i32)
    (local $c i32)
    (block $d (loop $l
      (local.set $c (call $gl16 (local.get $src)))
      (call $gs16 (local.get $dst) (local.get $c))
      (local.set $dst (i32.add (local.get $dst) (i32.const 2)))
      (local.set $src (i32.add (local.get $src) (i32.const 2)))
      (br_if $l (local.get $c)))))

  ;; wcscpy(dst, src) — cdecl, returns dst.
  (func $handle_wcscpy (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crt_wcs_copy (local.get $arg0) (local.get $arg1))
    (i32.store offset=0 (global.get $reg_base) (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  ;; wcscat(dst, src) — cdecl, returns dst.
  (func $handle_wcscat (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $p i32)
    (local.set $p (local.get $arg0))
    (block $d (loop $l
      (br_if $d (i32.eqz (call $gl16 (local.get $p))))
      (local.set $p (i32.add (local.get $p) (i32.const 2)))
      (br $l)))
    (call $crt_wcs_copy (local.get $p) (local.get $arg1))
    (i32.store offset=0 (global.get $reg_base) (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  ;; wcsstr(hay, needle) — cdecl. An empty needle returns hay; otherwise the
  ;; first position whose units match the whole needle, or NULL. The builds
  ;; disagree on exactly one input: VC6 has no empty-needle test, so its scan
  ;; loop never runs on an empty haystack and wcsstr(L"", L"") is NULL there,
  ;; while VC7's returns the haystack. That case goes to the authentic export.
  (func $handle_wcsstr (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $cp i32) (local $s1 i32) (local $s2 i32) (local $c2 i32) (local $r i32)
    (if (i32.eqz (i32.or (call $gl16 (local.get $arg0)) (call $gl16 (local.get $arg1))))
      (then (if (call $crt_fallback) (then (return)))))
    (local.set $r (local.get $arg0))
    (if (call $gl16 (local.get $arg1))
      (then
        (local.set $r (i32.const 0))
        (local.set $cp (local.get $arg0))
        (block $found (loop $cand
          (br_if $found (i32.eqz (call $gl16 (local.get $cp))))
          (local.set $s1 (local.get $cp))
          (local.set $s2 (local.get $arg1))
          (block $cmp_done (loop $cmp
            (local.set $c2 (call $gl16 (local.get $s2)))
            (br_if $cmp_done (i32.eqz (local.get $c2)))
            (br_if $cmp_done (i32.ne (call $gl16 (local.get $s1)) (local.get $c2)))
            (local.set $s1 (i32.add (local.get $s1) (i32.const 2)))
            (local.set $s2 (i32.add (local.get $s2) (i32.const 2)))
            (br $cmp)))
          (if (i32.eqz (local.get $c2))
            (then (local.set $r (local.get $cp)) (br $found)))
          (local.set $cp (i32.add (local.get $cp) (i32.const 2)))
          (br $cand)))))
    (i32.store offset=0 (global.get $reg_base) (local.get $r))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  ;; fallback: unknown API — crash with full details
  (func $handle_fallback (param $name_ptr i32) (param $api_id i32)
    (call $host_log_i32 (local.get $api_id))
    (call $host_crash_unimplemented
      (local.get $name_ptr)
      (i32.load offset=16 (global.get $reg_base))
      (global.get $eip)
      (i32.load offset=20 (global.get $reg_base)))
    (unreachable)
  )
  ;; _fpreset(void) — x86 CRT reset: all exceptions masked, nearest rounding,
  ;; 53-bit precision (027F), unlike FNINIT's 64-bit precision (037F).
  ;; The empty stack retains its physical payload bytes. This resets only the
  ;; calling thread's live environment; no process-wide state is changed.
  (func $handle__fpreset (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $fpu_trace_exc (i32.and (global.get $fpu_sw) (i32.const 0xFF)) (i32.const 0))
    (call $fpu_reset (i32.const 0x027F))
    ;; void cdecl: preserve EAX; consume only the return address.
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))
