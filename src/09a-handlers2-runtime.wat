  ;; 205: exit
  (func $handle_exit (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; cdecl: pop only the return address; the caller owns the status arg.
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (global.set $atexit_exit_code (local.get $arg0))
    (call $crt_atexit_run_next)
  )

  ;; 206: _exit
  (func $handle__exit (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $host_exit (local.get $arg0))
    (global.set $eip (i32.const 0))
    (global.set $yield_flag (i32.const 1))
    (global.set $steps (i32.const 0)) (return)
  )

  ;; _cexit() — cdecl, drain callbacks and return without host termination.
  ;; Its return address remains on the stack until the returning chain finishes.
  (func $handle__cexit (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crt_cexit_run_next)
  )

  ;; 207: __getmainargs
  (func $handle___getmainargs (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; arg0=&argc, arg1=&argv, arg2=&envp
    (if (i32.eqz (global.get $fake_cmdline_addr))
      (then (call $store_fake_cmdline)))
    (call $gs32 (local.get $arg0)
      (call $gl32 (i32.add (global.get $fake_cmdline_addr) (i32.const 508))))
    (call $gs32 (local.get $arg1)
      (i32.add (global.get $fake_cmdline_addr) (i32.const 1024)))
    (call $gs32 (local.get $arg2)
      (i32.add (global.get $fake_cmdline_addr) (i32.const 1532)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))) (return)
  )

  ;; 208: __p__fmode
  (func $handle___p__fmode (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (global.get $msvcrt_fmode_ptr))
    (then (global.set $msvcrt_fmode_ptr (call $heap_alloc (i32.const 4)))
    (call $gs32 (global.get $msvcrt_fmode_ptr) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (global.get $msvcrt_fmode_ptr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))) (return)
  )

  ;; 209: __p__commode
  (func $handle___p__commode (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (global.get $msvcrt_commode_ptr))
    (then (global.set $msvcrt_commode_ptr (call $heap_alloc (i32.const 4)))
    (call $gs32 (global.get $msvcrt_commode_ptr) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (global.get $msvcrt_commode_ptr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))) (return)
  )

  ;; 210: _initterm(start, end) — CRT init table walker
  ;; Iterates function pointers from [start] to [end), calling each non-NULL entry.
  ;; Uses continuation thunk (0xCACA0003) to chain calls through the emulator.
  (func $handle__initterm (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $fn i32)
    ;; Save return address and end pointer for continuation
    (global.set $initterm_ret (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (global.set $initterm_end (local.get $arg1))
    (global.set $initterm_ptr (local.get $arg0))
    ;; cdecl: pop only the return address; the caller owns both arguments.
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    ;; Find first non-NULL entry and call it
    (block $done (loop $scan
      (br_if $done (i32.ge_u (global.get $initterm_ptr) (global.get $initterm_end)))
      (local.set $fn (call $gl32 (global.get $initterm_ptr)))
      (global.set $initterm_ptr (i32.add (global.get $initterm_ptr) (i32.const 4)))
      (if (local.get $fn)
        (then
          ;; Push continuation thunk as return address, then jump to fn
          (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
          (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $initterm_thunk))
          (global.set $eip (local.get $fn))
          (global.set $steps (i32.const 0))
          (return)))
      (br $scan)))
    ;; All entries processed — return to original caller
    (global.set $eip (global.get $initterm_ret))
  )

  ;; Translate the x87 control word into the bit layout exposed by the 32-bit
  ;; Microsoft CRT. Exception bits are deliberately reordered; RC moves from
  ;; x87 bits 10..11 to CRT bits 8..9, and PC uses the reverse encoding.
  (func $msvcrt_control_from_x87 (result i32)
    (local $cw i32) (local $out i32) (local $pc i32)
    (local.set $cw (global.get $fpu_cw))
    (if (i32.and (local.get $cw) (i32.const 0x01))
      (then (local.set $out (i32.or (local.get $out) (i32.const 0x00000010))))) ;; INVALID
    (if (i32.and (local.get $cw) (i32.const 0x02))
      (then (local.set $out (i32.or (local.get $out) (i32.const 0x00080000))))) ;; DENORMAL
    (if (i32.and (local.get $cw) (i32.const 0x04))
      (then (local.set $out (i32.or (local.get $out) (i32.const 0x00000008))))) ;; ZERODIVIDE
    (if (i32.and (local.get $cw) (i32.const 0x08))
      (then (local.set $out (i32.or (local.get $out) (i32.const 0x00000004))))) ;; OVERFLOW
    (if (i32.and (local.get $cw) (i32.const 0x10))
      (then (local.set $out (i32.or (local.get $out) (i32.const 0x00000002))))) ;; UNDERFLOW
    (if (i32.and (local.get $cw) (i32.const 0x20))
      (then (local.set $out (i32.or (local.get $out) (i32.const 0x00000001))))) ;; INEXACT
    (local.set $out (i32.or (local.get $out)
      (i32.shr_u (i32.and (local.get $cw) (i32.const 0x0C00)) (i32.const 2))))
    (local.set $pc (i32.and (i32.shr_u (local.get $cw) (i32.const 8)) (i32.const 3)))
    ;; x87 00/01/10/11 = 24/reserved/53/64; CRT 10/11/01/00.
    (if (i32.eq (local.get $pc) (i32.const 0))
      (then (local.set $pc (i32.const 2)))
      (else (if (i32.eq (local.get $pc) (i32.const 1))
        (then (local.set $pc (i32.const 3)))
        (else (if (i32.eq (local.get $pc) (i32.const 2))
          (then (local.set $pc (i32.const 1)))
          (else (local.set $pc (i32.const 0))))))))
    (local.set $out (i32.or (local.get $out)
      (i32.shl (local.get $pc) (i32.const 16))))
    (local.set $out (i32.or (local.get $out)
      (i32.shl (i32.and (local.get $cw) (i32.const 0x1000)) (i32.const 6))))
    (local.get $out))

  ;; Apply a complete CRT-format control word to the x87 state while
  ;; retaining reserved x87 bits. Precision is represented even though the
  ;; f64-backed arithmetic cannot reproduce x87's selectable mantissa width.
  (func $msvcrt_control_to_x87 (param $control i32)
    (local $cw i32) (local $pc i32)
    (local.set $cw (i32.and (global.get $fpu_cw) (i32.const 0xFFFFE0C0)))
    (if (i32.and (local.get $control) (i32.const 0x00000010))
      (then (local.set $cw (i32.or (local.get $cw) (i32.const 0x01)))))
    (if (i32.and (local.get $control) (i32.const 0x00080000))
      (then (local.set $cw (i32.or (local.get $cw) (i32.const 0x02)))))
    (if (i32.and (local.get $control) (i32.const 0x00000008))
      (then (local.set $cw (i32.or (local.get $cw) (i32.const 0x04)))))
    (if (i32.and (local.get $control) (i32.const 0x00000004))
      (then (local.set $cw (i32.or (local.get $cw) (i32.const 0x08)))))
    (if (i32.and (local.get $control) (i32.const 0x00000002))
      (then (local.set $cw (i32.or (local.get $cw) (i32.const 0x10)))))
    (if (i32.and (local.get $control) (i32.const 0x00000001))
      (then (local.set $cw (i32.or (local.get $cw) (i32.const 0x20)))))
    (local.set $cw (i32.or (local.get $cw)
      (i32.shl (i32.and (local.get $control) (i32.const 0x0300)) (i32.const 2))))
    (local.set $pc (i32.and (i32.shr_u (local.get $control) (i32.const 16)) (i32.const 3)))
    ;; CRT 00/01/10/11 = 64/53/24/reserved; x87 11/10/00/01.
    (if (i32.eq (local.get $pc) (i32.const 0))
      (then (local.set $pc (i32.const 3)))
      (else (if (i32.eq (local.get $pc) (i32.const 1))
        (then (local.set $pc (i32.const 2)))
        (else (if (i32.eq (local.get $pc) (i32.const 2))
          (then (local.set $pc (i32.const 0)))
          (else (local.set $pc (i32.const 1))))))))
    (local.set $cw (i32.or (local.get $cw)
      (i32.shl (local.get $pc) (i32.const 8))))
    (local.set $cw (i32.or (local.get $cw)
      (i32.shr_u (i32.and (local.get $control) (i32.const 0x00040000)) (i32.const 6))))
    (global.set $fpu_cw (local.get $cw)))

  ;; 211: _controlfp(new, mask) — cdecl; query/update the current x87 word.
  (func $handle__controlfp (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $control i32) (local $mask i32)
    (local.set $control (call $msvcrt_control_from_x87))
    ;; _controlfp does not modify the x86 DENORMAL OPERAND exception mask;
    ;; _control87 is the API which may change that bit.
    (local.set $mask (i32.and (local.get $arg1) (i32.const 0x0007031F)))
    (local.set $control
      (i32.or
        (i32.and (local.get $control) (i32.xor (local.get $mask) (i32.const -1)))
        (i32.and (local.get $arg0) (local.get $mask))))
    (call $msvcrt_control_to_x87 (local.get $control))
    (i32.store offset=0 (global.get $reg_base) (call $msvcrt_control_from_x87))
    ;; The caller owns the two arguments. Pop only our return address.
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; 212: _strrev
  (func $handle__strrev (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $v i32) (local $i i32) (local $j i32)
    ;; Implement _strrev: reverse string in-place
    (local.set $i (call $g2w (local.get $arg0)))  ;; start pointer (wasm addr)
    (local.set $j (local.get $i))
    ;; Find end of string
    (block $end (loop $find
    (br_if $end (i32.eqz (i32.load8_u (local.get $j))))
    (local.set $j (i32.add (local.get $j) (i32.const 1)))
    (br $find)))
    ;; j now points to null terminator; back up one
    (if (i32.gt_u (local.get $j) (local.get $i))
    (then (local.set $j (i32.sub (local.get $j) (i32.const 1)))))
    ;; Swap from both ends
    (block $done (loop $swap
    (br_if $done (i32.ge_u (local.get $i) (local.get $j)))
    (local.set $v (i32.load8_u (local.get $i)))
    (i32.store8 (local.get $i) (i32.load8_u (local.get $j)))
    (i32.store8 (local.get $j) (local.get $v))
    (local.set $i (i32.add (local.get $i) (i32.const 1)))
    (local.set $j (i32.sub (local.get $j) (i32.const 1)))
    (br $swap)))
    (i32.store offset=0 (global.get $reg_base) (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))) (return)
  )

  ;; 213: toupper lives in src/09a6-handlers-crt.wat beside $handle_tolower and
  ;; $handle_towupper, which delegates to it. A SECOND $handle_toupper stood here
  ;; until 2026-08-31 and had never run: the compiler's `funcIndexMap` is
  ;; last-wins, so every call to the name — including the generated dispatch
  ;; table's — resolved to the CRT file's body, and this one was emitted and
  ;; never reached. Nothing said so, because `strictDeclarations` was off in
  ;; every shipped build; it is on now (tools/watx-closure.js).

  ;; 214: memmove
  (func $handle_memmove (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $guest_memmove (local.get $arg0) (local.get $arg1) (local.get $arg2))
    (i32.store offset=0 (global.get $reg_base) (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))) (return)
  )

  ;; 215: strchr
  (func $handle_strchr (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $v i32) (local $i i32) (local $j i32)
    ;; Implement strchr(str, char) — find char in string, return ptr or NULL
    (local.set $i (call $g2w (local.get $arg0)))
    (local.set $v (i32.and (local.get $arg1) (i32.const 0xFF)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)) ;; default: not found
    (block $done (loop $scan
    (local.set $j (i32.load8_u (local.get $i)))
    (if (i32.eq (local.get $j) (local.get $v))
    (then (i32.store offset=0 (global.get $reg_base) (i32.add (i32.sub (local.get $i) (global.get $GUEST_BASE)) (global.get $image_base))) (br $done)))
    (br_if $done (i32.eqz (local.get $j)))
    (local.set $i (i32.add (local.get $i) (i32.const 1)))
    (br $scan)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))) (return)
  )

  ;; 216: _XcptFilter — cdecl, returns EXCEPTION_CONTINUE_SEARCH (0).
  ;; nop was leaving ret-addr on stack and corrupting subsequent instructions;
  ;; pop the ret-addr (cdecl: caller pops args).
  (func $handle__XcptFilter (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; 217: _CxxThrowException — STUB: unimplemented
  (func $handle__CxxThrowException (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr))
  )

  ;; 218-222, 250: the lstr* family. These used to call $dispatch_lstr, which
  ;; re-read the API *name* one character at a time to decide which of them it
  ;; was — after the generated br_table had already resolved that name to this
  ;; exact function. The name-sniffing layer is gone; each handler is its own
  ;; body, which is also what lets the Win16 bridge (09e) call them directly:
  ;; it has an ordinal, not a name, and so used to reimplement them instead.

  ;; The two spellings of each lstr* entry point differ only in character
  ;; width, so each operation has one body here with a $wide flag and both
  ;; handlers are thin spellings of it. They used to be written twice, and the
  ;; copies had drifted apart on NULL handling: lstrlenW and lstrcpyW checked
  ;; for NULL (which is what Win98 does — its lstr* sit behind an SEH handler
  ;; that turns a bad pointer into a benign result) while the ANSI twins
  ;; dereferenced it.

  (func $lstr_len (param $s i32) (param $wide i32) (result i32)
    (if (i32.eqz (local.get $s)) (then (return (i32.const 0))))
    (if (local.get $wide) (then (return (call $guest_wcslen (local.get $s)))))
    (call $guest_strlen (local.get $s)))

  (func $lstr_cpy (param $dst i32) (param $src i32) (param $wide i32)
    (if (i32.or (i32.eqz (local.get $dst)) (i32.eqz (local.get $src))) (then (return)))
    (if (local.get $wide)
      (then (call $guest_wcscpy (local.get $dst) (local.get $src)))
      (else (call $guest_strcpy (local.get $dst) (local.get $src)))))

  (func $lstr_cat (param $dst i32) (param $src i32) (param $wide i32)
    (if (i32.or (i32.eqz (local.get $dst)) (i32.eqz (local.get $src))) (then (return)))
    (call $lstr_cpy
      (i32.add (local.get $dst) (i32.mul (call $lstr_len (local.get $dst) (local.get $wide))
                                         (select (i32.const 2) (i32.const 1) (local.get $wide))))
      (local.get $src) (local.get $wide)))

  ;; Copies at most count-1 characters and always terminates.
  (func $lstr_cpyn (param $dst i32) (param $src i32) (param $max i32) (param $wide i32)
    (if (i32.or (i32.eqz (local.get $dst)) (i32.eqz (local.get $src))) (then (return)))
    (if (local.get $wide)
      (then (call $guest_wcsncpy (local.get $dst) (local.get $src) (local.get $max)))
      (else (call $guest_strncpy (local.get $dst) (local.get $src) (local.get $max)))))

  ;; lstrcmp[i]: CompareString(LOCALE_USER_DEFAULT) order as -1/0/1, not a
  ;; byte compare — "a" < "B" and "a" < "A". A NULL string sorts before a
  ;; non-NULL one, and two NULLs are equal.
  (func $lstr_cmp (param $a i32) (param $b i32) (param $wide i32) (param $fold i32) (result i32)
    (if (i32.or (i32.eqz (local.get $a)) (i32.eqz (local.get $b)))
      (then (return (i32.sub (i32.ne (local.get $a) (i32.const 0))
                             (i32.ne (local.get $b) (i32.const 0))))))
    (call $nls_compare (local.get $a) (i32.const -1) (local.get $b) (i32.const -1)
      (local.get $wide) (i32.ne (local.get $fold) (i32.const 0))))

  ;; PathRemoveFileSpecA/W(pszPath) removes the final component in place and
  ;; returns TRUE only when the string actually changed.
  (func $path_remove_file_spec (param $path i32) (param $wide i32) (result i32)
    (local $step i32) (local $off i32) (local $last i32) (local $ch i32)
    (if (i32.eqz (local.get $path)) (then (return (i32.const 0))))
    (local.set $step (select (i32.const 2) (i32.const 1) (local.get $wide)))
    (local.set $last (i32.const 0xffffffff))
    (block $done (loop $scan
      (local.set $ch (call $gl_char (i32.add (local.get $path) (local.get $off)) (local.get $wide)))
      (br_if $done (i32.eqz (local.get $ch)))
      (if (i32.or (i32.eq (local.get $ch) (i32.const 0x5c))
                  (i32.eq (local.get $ch) (i32.const 0x2f)))
        (then (local.set $last (local.get $off))))
      (local.set $off (i32.add (local.get $off) (local.get $step)))
      (br $scan)))
    (if (i32.eq (local.get $last) (i32.const 0xffffffff))
      (then (return (i32.const 0))))
    ;; Preserve drive roots: "C:\foo" becomes "C:\", not "C:".
    (if (i32.and
          (i32.eq (local.get $last) (i32.mul (local.get $step) (i32.const 2)))
          (i32.eq (call $gl_char (i32.add (local.get $path) (local.get $step)) (local.get $wide)) (i32.const 0x3a)))
      (then
        (local.set $last (i32.add (local.get $last) (local.get $step)))))
    (if (local.get $wide)
      (then (i32.store16 (call $g2w (i32.add (local.get $path) (local.get $last))) (i32.const 0)))
      (else (i32.store8 (call $g2w (i32.add (local.get $path) (local.get $last))) (i32.const 0))))
    (i32.const 1))

  ;; One character at a guest address, ANSI or wide.
  (func $gl_char (param $p_g i32) (param $wide i32) (result i32)
    (if (local.get $wide) (then (return (call $gl16 (local.get $p_g)))))
    (call $gl8 (local.get $p_g)))

  ;; 218: lstrlenA
  (func $handle_lstrlenA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $lstr_len (local.get $arg0) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; InstallShield 11 dynamically asks KERNEL32 for the historical unsuffixed
  ;; export. Microsoft documents lstrlen as selecting lstrlenA in ANSI builds.
  (func $handle_lstrlen (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_lstrlenA
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; 219: lstrcpyA
  (func $handle_lstrcpyA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lstr_cpy (local.get $arg0) (local.get $arg1) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 220: lstrcatA
  (func $handle_lstrcatA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lstr_cat (local.get $arg0) (local.get $arg1) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 221: lstrcpynA(dst, src, count) — copies at most count-1 chars.
  (func $handle_lstrcpynA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lstr_cpyn (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 222: lstrcmpA
  (func $handle_lstrcmpA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $lstr_cmp (local.get $arg0) (local.get $arg1) (i32.const 0) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  (func $handle_PathRemoveFileSpecA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $path_remove_file_spec (local.get $arg0) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 223: RegCloseKey(hKey) — 1 arg stdcall
  (func $handle_RegCloseKey (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_reg_close_key (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; RegFlushKey(hKey) — 1 arg stdcall
  (func $handle_RegFlushKey (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_reg_flush_key (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; RegDeleteKeyA(hKey, lpSubKey) — 2 args stdcall
  (func $handle_RegDeleteKeyA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_reg_delete_key
      (local.get $arg0)
      (if (result i32) (local.get $arg1)
        (then (call $g2w (local.get $arg1))) (else (i32.const 0)))
      (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; RegDeleteKeyW(hKey, lpSubKey) — 2 args stdcall
  (func $handle_RegDeleteKeyW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_reg_delete_key
      (local.get $arg0)
      (if (result i32) (local.get $arg1)
        (then (call $g2w (local.get $arg1))) (else (i32.const 0)))
      (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; SHDeleteKey removes descendants too. A NULL/empty subkey clears the
  ;; open key's contents; the host mode's bit 1 retains that key itself.
  (func $handle_SHDeleteKeyA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_reg_delete_key
      (local.get $arg0)
      (if (result i32) (local.get $arg1)
        (then (call $g2w (local.get $arg1))) (else (i32.const 0)))
      (i32.const 2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_SHDeleteKeyW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_reg_delete_key
      (local.get $arg0)
      (if (result i32) (local.get $arg1)
        (then (call $g2w (local.get $arg1))) (else (i32.const 0)))
      (i32.const 3)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; RegDeleteValueA(hKey, lpValueName) — 2 args stdcall
  (func $handle_RegDeleteValueA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_reg_delete_value
      (local.get $arg0)
      (if (result i32) (local.get $arg1)
        (then (call $g2w (local.get $arg1))) (else (i32.const 0)))
      (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; RegDeleteValueW(hKey, lpValueName) — 2 args stdcall
  (func $handle_RegDeleteValueW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_reg_delete_value
      (local.get $arg0)
      (if (result i32) (local.get $arg1)
        (then (call $g2w (local.get $arg1))) (else (i32.const 0)))
      (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 224: RegCreateKeyA(hKey, lpSubKey, phkResult) — 3 args stdcall
  (func $handle_RegCreateKeyA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_reg_create_key
      (local.get $arg0) (call $g2w (local.get $arg1)) (local.get $arg2)
      (i32.const 0) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 225: RegQueryValueExA(hKey, lpValueName, lpReserved, lpType, lpData, lpcbData) — 6 args stdcall
  ;; RegQueryValueEx{A,W}(hKey, lpValueName, lpReserved, lpType, lpData,
  ;; lpcbData) — 6 args stdcall. The host does the whole read; the only thing
  ;; the spelling decides is how it reads the value name and writes strings
  ;; back, which is the $wide flag it already takes.
  (func $reg_query_value_ex (param $hkey i32) (param $name_g i32) (param $type_g i32)
                            (param $data_g i32) (param $cb_g i32) (param $wide i32) (result i32)
    (call $host_reg_query_value
      (local.get $hkey)
      (select (i32.const 0) (call $g2w (local.get $name_g)) (i32.eqz (local.get $name_g)))
      (local.get $type_g) (local.get $data_g) (local.get $cb_g) (local.get $wide)))

  (func $handle_RegQueryValueExA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $reg_query_value_ex
      (local.get $arg0) (local.get $arg1) (local.get $arg3) (local.get $arg4)
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
  )

  ;; SHQueryValueExA/W(hKey, pszValue, pdwReserved, pdwType, pvData, pcbData)
  ;; SHLWAPI exposes the same six-argument query contract modeled by
  ;; RegQueryValueEx: the spelling changes the DLL front door, not the value
  ;; name/data encoding or byte-count/error result. Keep the public symbol for
  ;; imports (Explorer also reaches A through SHELL32 ordinal 509), but let the
  ;; canonical Reg handler perform the one host query and stdcall cleanup.
  (func $handle_SHQueryValueExA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_RegQueryValueExA
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)
      (local.get $arg4) (local.get $name_ptr))
  )

  (func $handle_SHQueryValueExW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_RegQueryValueExW
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)
      (local.get $arg4) (local.get $name_ptr))
  )

  ;; RegSetValueEx{A,W}(hKey, lpValueName, Reserved, dwType, lpData, cbData)
  ;; — 6 args stdcall, one write with the spelling as a flag.
  (func $reg_set_value_ex (param $hkey i32) (param $name_g i32) (param $type i32)
                          (param $data_g i32) (param $cb i32) (param $wide i32) (result i32)
    (call $host_reg_set_value
      (local.get $hkey)
      (select (i32.const 0) (call $g2w (local.get $name_g)) (i32.eqz (local.get $name_g)))
      (local.get $type) (local.get $data_g) (local.get $cb) (local.get $wide)))

  ;; 226: RegSetValueExA
  (func $handle_RegSetValueExA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $reg_set_value_ex
      (local.get $arg0) (local.get $arg1) (local.get $arg3) (local.get $arg4)
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
  )

  ;; 227-231: the Local* family, formerly routed through $dispatch_local, which
  ;; picked the operation from name[5]. Local and Global memory are the same
  ;; heap here, so the pairs are deliberately identical bodies.

  ;; 227: LocalAlloc(uFlags, uBytes)
  (func $handle_LocalAlloc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $heap_alloc (local.get $arg1)))
    (if (i32.and (local.get $arg0) (i32.const 0x40)) ;; LMEM_ZEROINIT
      (then (if (i32.load offset=0 (global.get $reg_base))
              (then (call $zero_memory (call $g2w (i32.load offset=0 (global.get $reg_base))) (local.get $arg1))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 228: LocalFree
  (func $handle_LocalFree (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $heap_free (local.get $arg0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 229: LocalLock — handles are pointers here, so locking is the identity.
  (func $handle_LocalLock (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 230: LocalUnlock — returns FALSE, meaning the lock count reached zero.
  (func $handle_LocalUnlock (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 231: LocalReAlloc(hMem, uBytes, uFlags)
  (func $handle_LocalReAlloc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $heap_realloc (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; LocalSize(hMem) — LocalAlloc returns a fixed guest pointer whose aligned
  ;; allocation size is stored in the four-byte heap header immediately before
  ;; it. Return the usable data bytes, matching the existing GlobalSize path.
  (func $handle_LocalSize (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (local.get $arg0))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (else
        (i32.store offset=0 (global.get $reg_base) (call $heap_payload_size_unchecked (local.get $arg0)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; LocalHandle(pMem): LocalAlloc hands out fixed blocks whose handle is the
  ;; pointer itself (LocalLock is the identity), so the handle of a live heap
  ;; block is its own address. Anything the allocator does not recognise as a
  ;; block boundary is ERROR_INVALID_HANDLE. Intel's ir41_32.dll calls it when
  ;; a decompression stream ends.
  (func $handle_LocalHandle (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (call $heap_block_size_checked (local.get $arg0))
      (then (i32.store offset=0 (global.get $reg_base) (local.get $arg0)))
      (else
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 232-237: the Global* family, formerly routed through $dispatch_global,
  ;; which picked the operation from name[6]. That byte aliased
  ;; GlobalAddAtomA with GlobalAlloc and GlobalFindAtomA/GlobalFlags with
  ;; GlobalFree — safe only because those happened to have their own handlers.

  ;; 232: GlobalAlloc(uFlags, dwBytes)
  (func $handle_GlobalAlloc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $heap_alloc (local.get $arg1)))
    ;; The unified emulator heap reuses blocks freed by HeapAlloc/LocalAlloc as
    ;; GlobalAlloc results. That makes unrelated stale bytes much more visible
    ;; than on Win9x (Diablo's CEL decoder leaves transparent skip runs alone).
    ;; Zero is a valid result for memory whose contents are otherwise
    ;; unspecified, and keeps GlobalAlloc deterministic; GMEM_ZEROINIT remains
    ;; satisfied as a strict subset of this behavior.
    (if (i32.load offset=0 (global.get $reg_base))
      (then
        (call $zero_memory (call $g2w (i32.load offset=0 (global.get $reg_base))) (local.get $arg1))
        ;; Sizes are eight-byte aligned, so bit zero is process-wide
        ;; GlobalAlloc provenance rather than part of the allocation extent.
        (call $heap_global_mark (i32.load offset=0 (global.get $reg_base)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 233: GlobalFree
  (func $handle_GlobalFree (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; GlobalFree returns NULL only when it invalidated a live Global handle.
    ;; NULL itself remains the documented no-op success case.
    (if (i32.or
          (i32.eqz (local.get $arg0))
          (call $heap_global_free (local.get $arg0)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (else
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (i32.store offset=0 (global.get $reg_base) (local.get $arg0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 234: GlobalLock — Global allocations are fixed direct pointers in this
  ;; runtime, but the input must still be an exact live GlobalAlloc boundary.
  (func $handle_GlobalLock (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (call $heap_global_block_size (local.get $arg0) (i32.const 0))
      (then (i32.store offset=0 (global.get $reg_base) (local.get $arg0)))
      (else
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 235: GlobalUnlock — fixed blocks always have a zero lock count and the
  ;; documented success result is TRUE. Movable handles are not represented.
  (func $handle_GlobalUnlock (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (call $heap_global_block_size (local.get $arg0) (i32.const 0))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 1)))
      (else
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 236: GlobalReAlloc(hMem, dwBytes, uFlags)
  (func $handle_GlobalReAlloc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; Claim the old handle before reallocating it. This closes the validation /
    ;; mutation race with GlobalFree in another Worker. GlobalReAlloc requires
    ;; a handle returned by GlobalAlloc/ReAlloc; unlike heap_realloc, NULL is
    ;; not an allocation shortcut.
    (if (i32.eqz
          (call $heap_global_block_size (local.get $arg0) (i32.const 1)))
      (then
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (i32.store offset=0 (global.get $reg_base) (call $heap_realloc (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    ;; Success publishes provenance on either the same or moved block. On OOM,
    ;; Win32 leaves the original handle valid, so restore the marker there.
    (if (i32.load offset=0 (global.get $reg_base))
      (then (call $heap_global_mark (i32.load offset=0 (global.get $reg_base))))
      (else (call $heap_global_mark (local.get $arg0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 237: GlobalSize — usable bytes from a live Global allocation. The helper
  ;; validates exact block identity before reading the tagged header.
  (func $handle_GlobalSize (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $size i32)
    (local.set $size
      (call $heap_global_block_size (local.get $arg0) (i32.const 0)))
    (if (local.get $size)
      (then (i32.store offset=0 (global.get $reg_base) (i32.sub (local.get $size) (i32.const 4))))
      (else
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 238: GlobalCompact(dwMinFree) — 1 arg stdcall. On Win32 the global and
  ;; local allocation families are wrappers around the process default heap.
  ;; The observable operation is therefore the same real coalesce-and-query
  ;; path as HeapCompact(GetProcessHeap(), 0), including fragmented free runs.
  ;; dwMinFree is the retained Win16 compatibility hint; it cannot move fixed
  ;; Win32 allocations and does not change the returned largest block here.
  (func $handle_GlobalCompact (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; HeapCompact owns a two-argument stdcall cleanup (+12 including return),
    ;; while GlobalCompact owns one (+8). Give the shared handler one synthetic
    ;; stack word so its cleanup lands at GlobalCompact's documented boundary.
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $handle_HeapCompact
      (global.get $PROCESS_HEAP_HANDLE) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0) (local.get $name_ptr))
  )

  ;; 239: RegOpenKeyA
  (func $handle_RegOpenKeyA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; RegOpenKeyA(hKey, lpSubKey, phkResult) — 3 args stdcall
    (local $hResult i32)
    (local.set $hResult (call $host_reg_open_key
      (local.get $arg0) (call $g2w (local.get $arg1)) (i32.const 0)))
    (if (local.get $hResult)
      (then (call $gs32 (local.get $arg2) (local.get $hResult))
             (i32.store offset=0 (global.get $reg_base) (i32.const 0)))  ;; ERROR_SUCCESS
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 2))))  ;; ERROR_FILE_NOT_FOUND
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 240: RegOpenKeyExA(hKey, lpSubKey, ulOptions, samDesired, phkResult) — 5 args stdcall
  (func $handle_RegOpenKeyExA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $hResult i32)
    (local.set $hResult (call $host_reg_open_key
      (local.get $arg0) (call $g2w (local.get $arg1)) (i32.const 0)))
    (if (local.get $hResult)
      (then (call $gs32 (local.get $arg4) (local.get $hResult))
             (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 2))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
  )

  ;; 241: RegisterClassExA
  (func $handle_RegisterClassExA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $tmp i32) (local $class_name_wa i32) (local $slot i32) (local $dst i32) (local $src i32)
    ;; WNDCLASSEX: cbSize(+0) style(+4) lpfnWndProc(+8) cbClsExtra(+12) cbWndExtra(+16)
    ;;   hInstance(+20) hIcon(+24) hCursor(+28) hbrBackground(+32) lpszMenuName(+36)
    ;;   lpszClassName(+40) hIconSm(+44)
    (local.set $tmp (call $gl32 (i32.add (local.get $arg0) (i32.const 8)))) ;; lpfnWndProc
    (local.set $class_name_wa (call $g2w (call $gl32 (i32.add (local.get $arg0) (i32.const 40)))))
    ;; WNDCLASSEX without cbSize/hIconSm is exactly WNDCLASSA.  Copy and
    ;; publish it while the class-table writer lock is still held.
    (local.set $src (call $g2w (i32.add (local.get $arg0) (i32.const 4))))
    (i32.store offset=0 (global.get $reg_base) (call $class_table_register_data
      (local.get $class_name_wa) (local.get $src)))
    ;; Store first EXE-space wndproc as main (skip DLL-registered classes)
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
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))) (return)
  )

  ;; 242: RegisterClassA
  (func $handle_RegisterClassA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $tmp i32) (local $class_name_wa i32) (local $slot i32) (local $dst i32)
    ;; WNDCLASSA: style(+0) lpfnWndProc(+4) cbClsExtra(+8) cbWndExtra(+12)
    ;;   hInstance(+16) hIcon(+20) hCursor(+24) hbrBackground(+28)
    ;;   lpszMenuName(+32) lpszClassName(+36)
    (local.set $tmp (call $gl32 (i32.add (local.get $arg0) (i32.const 4)))) ;; lpfnWndProc
    (local.set $class_name_wa (call $class_name_key (call $gl32 (i32.add (local.get $arg0) (i32.const 36)))))
    (i32.store offset=0 (global.get $reg_base) (call $class_table_register_data
      (local.get $class_name_wa) (call $g2w (local.get $arg0))))
    ;; Store first EXE-space wndproc as main (skip DLL-registered classes)
    (if (i32.and (i32.eqz (global.get $wndproc_addr))
      (i32.and (i32.ge_u (local.get $tmp) (global.get $image_base))
               (i32.lt_u (local.get $tmp) (i32.add (global.get $image_base) (global.get $exe_size_of_image)))))
    (then
      (global.set $wndproc_addr (local.get $tmp))
      (global.set $wndclass_style (call $gl32 (local.get $arg0)))
      (global.set $wndclass_bg_brush (call $gl32 (i32.add (local.get $arg0) (i32.const 28)))))
    (else
      (if (i32.and
            (i32.and (i32.eqz (global.get $wndproc_addr2))
                     (i32.ne (local.get $tmp) (global.get $wndproc_addr)))
            (i32.and (i32.ge_u (local.get $tmp) (global.get $image_base))
                     (i32.lt_u (local.get $tmp) (i32.add (global.get $image_base) (global.get $exe_size_of_image)))))
        (then (global.set $wndproc_addr2 (local.get $tmp))))))
    ;; Keep the atom returned by class_table_register.  Callers commonly pass
    ;; it straight back to CreateWindowEx; collapsing every registration to
    ;; 0xC001 attaches later classes to the first registered WNDCLASS.
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))) (return)
  )

  ;; Shared paint preparation; the ABI caller owns its frame and result.
  ;; win16_bridge selects the far caller's clip preparation and leaves erase
  ;; dispatch to its continuation, without a mutable global ABI mode.
  (func $begin_paint_core (param $arg0 i32) (param $arg1 i32) (param $win16_bridge i32) (result i32)
    (local $cs i32) (local $hdc i32) (local $wa i32) (local $partial i32)
    (local $erase_pending i32) (local $erase_result i32)
    ;; The window procedure, not the class brush alone, decides whether an
    ;; outstanding erase is handled. Its default procedure owns brush lookup.
    (local.set $erase_pending
      (i32.ne (i32.and (call $nc_flags_test (local.get $arg0)) (i32.const 2))
              (i32.const 0)))
    ;; Fill PAINTSTRUCT: hdc(+0), fErase(+4), rcPaint(+8: left,top,right,bottom)
    (local.set $wa (call $g2w (local.get $arg1)))
    (call $zero_memory (local.get $wa) (i32.const 64))
    (local.set $hdc (call $host_alloc_window_dc (local.get $arg0) (i32.const 0)))
    (if (local.get $hdc)
      (then (call $host_paint_begin (local.get $arg0))))
    (call $gs32 (local.get $arg1) (local.get $hdc)) ;; hdc
    (call $gs32 (i32.add (local.get $arg1) (i32.const 4)) (i32.const 0)) ;; fErase
    ;; WAT owns the update rect. rcPaint is the pending update bbox; if no
    ;; update exists, return the full client rect like Win32's empty fallback.
    (local.set $wa (i32.add (local.get $wa) (i32.const 8)))
    (local.set $partial (call $update_get_rect (local.get $arg0) (local.get $wa)))
	    (if (i32.eqz (local.get $partial))
	      (then
	        ;; Empty update rect: rcPaint = full client.
	        (local.set $cs (call $host_get_window_client_size (local.get $arg0)))
	        (i32.store (local.get $wa) (i32.const 0))
	        (i32.store offset=4 (local.get $wa) (i32.const 0))
	        (i32.store offset=8 (local.get $wa) (i32.and (local.get $cs) (i32.const 0xFFFF)))
	        (i32.store offset=12 (local.get $wa) (i32.shr_u (local.get $cs) (i32.const 16)))))
	    ;; Some Win9x games resize/maximize from inside WM_PAINT and then draw a
	    ;; complete redraw-class scene while the old partial update region is still
	    ;; installed. For maximized CS_HREDRAW/CS_VREDRAW top-levels, promote that
	    ;; paint to the full client so the redraw is not clipped to the pre-resize
	    ;; splash/update rectangle.
	    (if (i32.and
	          (i32.and (local.get $partial) (call $wnd_max_get (local.get $arg0)))
	          (i32.ne (i32.and (global.get $wndclass_style) (i32.const 0x0003)) (i32.const 0)))
	      (then
	        (local.set $cs (call $host_get_window_client_size (local.get $arg0)))
	        (i32.store (local.get $wa) (i32.const 0))
	        (i32.store offset=4 (local.get $wa) (i32.const 0))
	        (i32.store offset=8 (local.get $wa) (i32.and (local.get $cs) (i32.const 0xFFFF)))
	        (i32.store offset=12 (local.get $wa) (i32.shr_u (local.get $cs) (i32.const 16)))
	        (local.set $partial (i32.const 0))))
    ;; Win16/VBRUN paint code commonly probes GetClipBox immediately after
    ;; BeginPaint and uses that rectangle to copy an AutoRedraw backing bitmap
    ;; to the visible HDC. Keep its historical update rect in the app clip
    ;; before applying the USER/system clip; moving it solely into the system
    ;; clip made Tic Tac Drop see a 1x1 paint box and copy only one pixel of
    ;; its completed board.
    (if (i32.and
          (i32.or (global.get $code16) (local.get $win16_bridge))
          (local.get $partial))
      (then
        (drop (call $gdi_native_intersect_clip_rect
          (local.get $hdc)
          (i32.load (local.get $wa))
          (i32.load offset=4 (local.get $wa))
          (i32.load offset=8 (local.get $wa))
          (i32.load offset=12 (local.get $wa))))))
    ;; WAT-owned visible clipping: client bounds, parent, CLIPCHILDREN and
    ;; CLIPSIBLINGS establish USER's system clip. The update rectangle is part
    ;; of that same system region, not the application-selected clip:
    ;; SelectClipRgn/IntersectClipRect may replace the latter during WM_PAINT
    ;; but must never let drawing escape rcPaint. CARDS.DLL selects one card
    ;; rectangle at a time; keeping rcPaint in the app clip let those selects
    ;; erase Hearts' three already-dealt opponent hands outside the update.
    (call $dc_apply_client_clip (local.get $hdc) (local.get $arg0))
    (if (i32.and
          (i32.eqz
            (i32.or (global.get $code16) (local.get $win16_bridge)))
          (local.get $partial))
      (then
        (drop (call $gdi_dc_system_clip_rect
          (local.get $hdc)
          (i32.load (local.get $wa))
          (i32.load offset=4 (local.get $wa))
          (i32.load offset=8 (local.get $wa))
          (i32.load offset=12 (local.get $wa))
          (i32.const 1))))) ;; RGN_AND
    ;; Snapshot damage into PAINTSTRUCT/DC, then validate before entering any
    ;; callback. UpdateWindow from inside WM_PAINT must not recursively paint
    ;; this same damage. Later invalidations belong to a new paint cycle and
    ;; EndPaint must not erase them using this snapshot's rectangle.
    (if (local.get $hdc)
      (then
        (call $update_clear_hwnd (local.get $arg0))
        (call $paint_flag_clear_hwnd (local.get $arg0))
        (if (i32.eq (local.get $arg0) (global.get $main_hwnd))
          (then (global.set $paint_pending (i32.const 0))))))
    ;; Win32 can enter a guest wndproc synchronously here, after the paint
    ;; DC's update/system clip is installed. The callback, not the presence
    ;; of a class brush, decides whether the application still owes erasing.
    ;; Consume this cycle's erase request before entry so nested BeginPaint
    ;; cannot recursively redispatch the same request. Reinvalidations made
    ;; by the callback retain their newly set erase bit.
    ;; The Win16 caller owns its far callback continuation. Leave its pending
    ;; request intact here; it uses the prepared DC after this helper returns.
    (if (i32.and (i32.eqz (local.get $win16_bridge)) (i32.eqz (global.get $code16)))
      (then
        (if (local.get $erase_pending)
          (then
            (call $nc_flags_clear (local.get $arg0) (i32.const 2))
            (local.set $erase_result (call $wnd_send_message (local.get $arg0) (i32.const 0x14)
              (local.get $hdc) (i32.const 0)))
            (call $gs32 (i32.add (local.get $arg1) (i32.const 4)) (i32.eqz (local.get $erase_result)))
            ;; Returning zero explicitly leaves the window marked for erase.
            ;; Do not discard that state when the current paint completes.
            (if (i32.and (i32.eqz (local.get $erase_result))
                  (i32.ge_s (call $wnd_table_find (local.get $arg0)) (i32.const 0)))
              (then (call $nc_flags_set (local.get $arg0) (i32.const 2))))))
        (return (local.get $hdc))))
    (local.get $hdc))

  ;; 243: BeginPaint
  (func $handle_BeginPaint (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base)
      (call $begin_paint_core (local.get $arg0) (local.get $arg1) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))) (return)
  )

  ;; USER's clipboard transaction is exclusive even though this emulator has
  ;; one Windows process. EmptyClipboard later transfers ownership to the HWND
  ;; associated here; a NULL HWND means the task may inspect the clipboard but
  ;; cannot publish new data after emptying it.
  (global $clipboard_open (mut i32) (i32.const 0))
  (global $clipboard_open_hwnd (mut i32) (i32.const 0))
  (global $clipboard_owner_hwnd (mut i32) (i32.const 0))
  (global $clipboard_emptied_by_opener (mut i32) (i32.const 0))

  ;; 244: OpenClipboard(hwndNewOwner).
  (func $handle_OpenClipboard (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (drop (local.get $arg1))
    (drop (local.get $arg2))
    (drop (local.get $arg3))
    (drop (local.get $arg4))
    (drop (local.get $name_ptr))
    (if (global.get $clipboard_open)
      (then
        (global.set $last_error (i32.const 5)) ;; ERROR_ACCESS_DENIED
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (if (i32.and
          (i32.ne (local.get $arg0) (i32.const 0))
          (i32.lt_s (call $wnd_table_find (local.get $arg0)) (i32.const 0)))
      (then
        (global.set $last_error (i32.const 1400)) ;; ERROR_INVALID_WINDOW_HANDLE
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (global.set $clipboard_open (i32.const 1))
    (global.set $clipboard_open_hwnd (local.get $arg0))
    (global.set $clipboard_emptied_by_opener (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 245: CloseClipboard(). Ownership survives closing; only the exclusive
  ;; access transaction ends.
  (func $handle_CloseClipboard (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
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
    (global.set $clipboard_open (i32.const 0))
    (global.set $clipboard_open_hwnd (i32.const 0))
    (global.set $clipboard_emptied_by_opener (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; 246: IsClipboardFormatAvailable(format)
  (func $handle_IsClipboardFormatAvailable (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (drop (local.get $arg1))
    (drop (local.get $arg2))
    (drop (local.get $arg3))
    (drop (local.get $arg4))
    (drop (local.get $name_ptr))
    (i32.store offset=0 (global.get $reg_base) (call $clipboard_is_format_available (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 247: GetEnvironmentStringsW — a wide copy of the process environment.
  ;; This used to answer with a literal L"A=B\0\0" while the ANSI spelling
  ;; handed back the command line, so the two disagreed about the environment
  ;; and neither described it. Both are copies of one real block now.
  (func $handle_GetEnvironmentStringsW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $env_strings (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))) (return)
  )

  ;; 248: GetSaveFileNameA(lpOFN) — show modal Save As dialog
  ;; Same UI as GetOpenFileName, just kind=1 → "Save As" title + "Save" button.
  (func $handle_GetSaveFileNameA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
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
    (local.set $owner (call $gl32 (i32.add (local.get $arg0) (i32.const 4))))
    (call $create_open_dialog (local.get $dlg) (local.get $owner) (i32.const 1) (local.get $arg0))
    (call $modal_begin (local.get $dlg) (i32.const 8))
  )

  ;; GetSaveFileNameW(lpOFN) — the W twin of the above, exactly as
  ;; GetOpenFileNameW is to GetOpenFileNameA. It was simply missing, so
  ;; the XP Sound Recorder (a Unicode app) trapped on File > Save and
  ;; File > Save As instead of showing a dialog.
  (func $handle_GetSaveFileNameW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
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
    (call $create_open_dialog (local.get $dlg) (local.get $owner) (i32.const 1) (local.get $arg0))
    (call $modal_begin (local.get $dlg) (i32.const 8))
  )

;; 250: lstrcmpiA
  (func $handle_lstrcmpiA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $lstr_cmp (local.get $arg0) (local.get $arg1) (i32.const 0) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 251-252: FreeEnvironmentStrings{A,W} — release the copy handed out by
  ;; GetEnvironmentStrings. Both spellings free the same kind of heap block.
  (func $handle_FreeEnvironmentStringsA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg0) (then (call $heap_free (local.get $arg0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  (func $handle_FreeEnvironmentStringsW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_FreeEnvironmentStringsA (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; 253: GetVersion — return winver, 0 args
  (func $handle_GetVersion (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (global.get $winver))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

;; 255: wsprintfA
  (func $handle_wsprintfA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; wsprintfA(buf, fmt, ...) — cdecl, caller cleans stack
    (i32.store offset=0 (global.get $reg_base) (call $wsprintf_impl
      (local.get $arg0) (local.get $arg1) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))
    ;; cdecl: only pop return address
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; wvsprintfA(buf, fmt, arglist) — stdcall, 3 args
  (func $handle_wvsprintfA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; wsprintf_impl expects arg_ptr as a guest address and reads args with gl32.
    (i32.store offset=0 (global.get $reg_base) (call $wsprintf_impl
      (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; GetPrivateProfileString{A,W}(appName, keyName, default, retBuf, nSize, fileName)
  ;; — 6 args stdcall. One INI read for both spellings; $wide picks the encoding.
  (func $ini_get_string (param $app_g i32) (param $key_g i32) (param $def_g i32)
                        (param $buf_g i32) (param $size i32) (param $file_g i32)
                        (param $wide i32) (result i32)
    (call $host_ini_get_string
      (select (i32.const 0) (call $g2w (local.get $app_g)) (i32.eqz (local.get $app_g)))
      (select (i32.const 0) (call $g2w (local.get $key_g)) (i32.eqz (local.get $key_g)))
      (select (i32.const 0) (call $g2w (local.get $def_g)) (i32.eqz (local.get $def_g)))
      (local.get $buf_g)        ;; retBuf (guest addr — host will g2w)
      (local.get $size)         ;; nSize
      (call $g2w (local.get $file_g))
      (local.get $wide)))

  (func $handle_GetPrivateProfileStringA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $ini_get_string
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4)
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
      (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
  )

  ;; GetPrivateProfileSectionA(appName, returnedString, size, fileName)
  ;; returns a double-NUL-terminated sequence of key=value strings.
  (func $handle_GetPrivateProfileSectionA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_ini_get_section
      (call $g2w (local.get $arg0))
      (local.get $arg1)
      (local.get $arg2)
      (call $g2w (local.get $arg3))
      (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; 257: __wgetmainargs
  (func $handle___wgetmainargs (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; arg0=&argc, arg1=&argv, arg2=&envp (wide versions)
    (if (i32.eqz (global.get $msvcrt_wcmdln_ptr))
      (then (call $store_fake_wcmdline)))
    (call $gs32 (local.get $arg0)
      (call $gl32 (i32.add (global.get $msvcrt_wcmdln_ptr) (i32.const 772))))
    (call $gs32 (local.get $arg1) (i32.add (global.get $msvcrt_wcmdln_ptr) (i32.const 776)))
    (call $gs32 (local.get $arg2) (i32.add (global.get $msvcrt_wcmdln_ptr) (i32.const 784)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))) (return)
  )

  ;; 258: __p__wcmdln
  (func $handle___p__wcmdln (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (global.get $msvcrt_wcmdln_ptr))
      (then (call $store_fake_wcmdline)))
    (call $gs32 (i32.add (global.get $msvcrt_wcmdln_ptr) (i32.const 768)) (global.get $msvcrt_wcmdln_ptr))
    (i32.store offset=0 (global.get $reg_base) (i32.add (global.get $msvcrt_wcmdln_ptr) (i32.const 768)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))) (return)
  )

  ;; 259: __p__acmdln
  (func $handle___p__acmdln (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (global.get $fake_cmdline_addr))
      (then (call $store_fake_cmdline)))
    (i32.store offset=0 (global.get $reg_base) (i32.add (global.get $fake_cmdline_addr) (i32.const 504)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))) (return)
  )

  ;; __p__environ() — cdecl, returns &_environ for the narrow CRT. Keep the
  ;; distinct __initenv slot in the adjacent word: MSVCRT initializes
  ;; `__initenv = _environ`, but they remain two globals so a later assignment
  ;; through &_environ does not rewrite the initial-environment snapshot.
  (func $handle___p__environ (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (global.get $fake_cmdline_addr))
      (then (call $store_fake_cmdline)))
    (if (i32.eqz (global.get $msvcrt_environ_ptr))
      (then
        (global.set $msvcrt_environ_ptr (call $heap_alloc (i32.const 8)))
        (call $gs32 (global.get $msvcrt_environ_ptr)
          (i32.add (global.get $fake_cmdline_addr) (i32.const 1532)))
        (call $gs32 (i32.add (global.get $msvcrt_environ_ptr) (i32.const 4))
          (i32.add (global.get $fake_cmdline_addr) (i32.const 1532)))))
    (i32.store offset=0 (global.get $reg_base) (global.get $msvcrt_environ_ptr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))) (return)
  )

  ;; __p___argv() / __p___argc() — cdecl, return &__argv and &__argc, the
  ;; same arrays __getmainargs hands out (LithTech's lithtech.exe reads its
  ;; -rez arguments this way). __argc already lives in the command-line block;
  ;; __argv is a variable of its own, so a program that reassigns it does not
  ;; rewrite the block.
  (func $handle___p___argv (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (global.get $fake_cmdline_addr))
      (then (call $store_fake_cmdline)))
    (if (i32.eqz (global.get $msvcrt_argv_ptr))
      (then
        (global.set $msvcrt_argv_ptr (call $heap_alloc (i32.const 4)))
        (call $gs32 (global.get $msvcrt_argv_ptr)
          (i32.add (global.get $fake_cmdline_addr) (i32.const 1024)))))
    (i32.store offset=0 (global.get $reg_base) (global.get $msvcrt_argv_ptr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))) (return)
  )

  (func $handle___p___argc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (global.get $fake_cmdline_addr))
      (then (call $store_fake_cmdline)))
    (i32.store offset=0 (global.get $reg_base) (i32.add (global.get $fake_cmdline_addr) (i32.const 508)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))) (return)
  )

  ;; __p___initenv() — cdecl, returns &__initenv for the narrow CRT startup path.
  (func $handle___p___initenv (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle___p__environ
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
    (i32.store offset=0 (global.get $reg_base) (i32.add (global.get $msvcrt_environ_ptr) (i32.const 4)))
  )

  ;; 260: __set_app_type(type) — cdecl; sets GUI vs console, no-op for us
  (func $handle___set_app_type (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; 261: __setusermatherr(handler) — cdecl; set math error handler, no-op
  (func $handle___setusermatherr (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; 262: _adjust_fdiv
  (func $handle__adjust_fdiv (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; Return pointer to a 0 dword (no FDIV bug)
    (if (i32.eqz (global.get $msvcrt_fmode_ptr))
      (then (global.set $msvcrt_fmode_ptr (call $heap_alloc (i32.const 4)))))
    (i32.store offset=0 (global.get $reg_base) (global.get $msvcrt_fmode_ptr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))) (return)
  )

  ;; 263: free(ptr) — cdecl
  (func $handle_free (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $heap_free (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; 264: malloc(size) — cdecl
  (func $handle_malloc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $heap_alloc (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; operator new(size_t) / operator new[](size_t) — cdecl. The MSVC decorated
  ;; names ??2@YAPAXI@Z and ??_U@YAPAXI@Z; both are plain allocations, and
  ;; MSVC's own implementations are malloc with a new-handler retry loop we
  ;; have no use for. Returning NULL on exhaustion matches the non-throwing
  ;; behaviour of the msvcrt these binaries link against.
  (func $cpp_operator_new (param $size i32)
    (i32.store offset=0 (global.get $reg_base) (call $heap_alloc (local.get $size)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )
  (func $handle_??2@YAPAXI@Z (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $cpp_operator_new (local.get $arg0))
  )
  (func $handle_??_U@YAPAXI@Z (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $cpp_operator_new (local.get $arg0))
  )

  ;; operator delete(void*) / operator delete[](void*) — cdecl, and a NULL
  ;; pointer is explicitly a no-op in C++.
  (func $cpp_operator_delete (param $ptr i32)
    (if (local.get $ptr) (then (call $heap_free (local.get $ptr))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )
  (func $handle_??3@YAXPAX@Z (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $cpp_operator_delete (local.get $arg0))
  )
  (func $handle_??_V@YAXPAX@Z (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $cpp_operator_delete (local.get $arg0))
  )

  ;; 265: calloc(num, size) — cdecl
  (func $handle_calloc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $tmp i32)
    (local.set $tmp (i32.mul (local.get $arg0) (local.get $arg1)))
    (i32.store offset=0 (global.get $reg_base) (call $heap_alloc (local.get $tmp)))
    (call $zero_memory (call $g2w (i32.load offset=0 (global.get $reg_base))) (local.get $tmp))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; 266: rand
  (func $handle_rand (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $rand_seed (i32.add (i32.mul (global.get $rand_seed) (i32.const 1103515245)) (i32.const 12345)))
    (i32.store offset=0 (global.get $reg_base) (i32.and (i32.shr_u (global.get $rand_seed) (i32.const 16)) (i32.const 0x7FFF)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))) (return)
  )

  ;; 267: srand(seed) — cdecl
  (func $handle_srand (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $rand_seed (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; 268: _purecall
  ;; msvcrt's _purecall is _amsg_exit(_RT_PURECALL): R6025 and the process
  ;; ends. It must not return into the caller -- that caller has just called
  ;; through a NULL-ish vtable slot and would run on in a broken object.
  (func $handle__purecall (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $host_exit (i32.const 3))
    (global.set $eip (i32.const 0))
    (global.set $yield_flag (i32.const 1))
    (global.set $steps (i32.const 0)) (return)
  )

  ;; 269: _onexit(func) — cdecl; shares the CRT's LIFO atexit registry.
  ;; Unlike atexit, return the function pointer on success and NULL on failure.
  ;; Callback return values are ignored by the termination dispatcher.
  (func $handle__onexit (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base)
      (select (local.get $arg0) (i32.const 0)
        (i32.eqz (call $crt_atexit_register (local.get $arg0)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; DLL CRTs own these malloc-family tables and walk them backwards at detach.
  ;; end is one past the last callback, not the allocation's capacity. Publish
  ;; relocated pointers only after realloc succeeds; leave the process queue alone.
  (func $crt_dllonexit_register (param $fn i32) (param $pbegin i32) (param $pend i32) (result i32)
    (local $begin_w i32) (local $end_w i32) (local $begin i32) (local $end i32)
    (local $bytes i32) (local $table i32)
    (if (i32.eqz (local.get $fn)) (then (return (i32.const 0))))
    (if (i32.eqz (local.get $pbegin)) (then (return (i32.const 0))))
    (if (i32.eqz (local.get $pend)) (then (return (i32.const 0))))
    (local.set $begin_w (call $g2w (local.get $pbegin)))
    (local.set $end_w (call $g2w (local.get $pend)))
    (local.set $begin (i32.load (local.get $begin_w)))
    (local.set $end (i32.load (local.get $end_w)))
    ;; Defensive span checks, including allocator rounding/size overflow.
    (if (i32.lt_u (local.get $end) (local.get $begin)) (then (return (i32.const 0))))
    (local.set $bytes (i32.sub (local.get $end) (local.get $begin)))
    (if (i32.and (local.get $bytes) (i32.const 3)) (then (return (i32.const 0))))
    (if (i32.gt_u (local.get $bytes) (i32.const 0x7ffffff0)) (then (return (i32.const 0))))
    (if (i32.eqz (local.get $begin))
      (then (if (local.get $end) (then (return (i32.const 0))))))
    (local.set $table (call $heap_realloc (local.get $begin)
      (i32.add (local.get $bytes) (i32.const 4)) (i32.const 0)))
    (if (i32.eqz (local.get $table)) (then (return (i32.const 0))))
    (call $gs32 (i32.add (local.get $table) (local.get $bytes)) (local.get $fn))
    (i32.store (local.get $begin_w) (local.get $table))
    (i32.store (local.get $end_w) (i32.add (local.get $table)
      (i32.add (local.get $bytes) (i32.const 4))))
    (local.get $fn))

  ;; 270: __dllonexit(func, begin, end) — cdecl; DLL-local counterpart.
  (func $handle___dllonexit (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base)
      (call $crt_dllonexit_register (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; Copy one byte range out of a guest path and terminate it. The four legacy
  ;; _splitpath outputs have no size arguments; the caller owns their capacity.
  (func $crt_splitpath_copy (param $dst i32) (param $src i32)
                            (param $start i32) (param $end i32)
    (local $i i32)
    (if (i32.eqz (local.get $dst)) (then (return)))
    (block $done (loop $copy
      (br_if $done
        (i32.ge_u (i32.add (local.get $start) (local.get $i)) (local.get $end)))
      (call $gs8 (i32.add (local.get $dst) (local.get $i))
        (call $gl8
          (i32.add (local.get $src) (i32.add (local.get $start) (local.get $i)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $copy)))
    (call $gs8 (i32.add (local.get $dst) (local.get $i)) (i32.const 0)))

  ;; 271: _splitpath(path, drive, dir, fname, ext) — cdecl
  (func $handle__splitpath (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $i i32) (local $ch i32) (local $drive_end i32)
    (local $dir_end i32) (local $dot i32) (local $has_dot i32)
    (local $end i32) (local $ext i32)
    ;; A drive component is exactly the first two bytes when byte 1 is ':'.
    (if (i32.and
          (i32.ne (call $gl8 (local.get $arg0)) (i32.const 0))
          (i32.eq (call $gl8 (i32.add (local.get $arg0) (i32.const 1)))
                  (i32.const 0x3a)))
      (then (local.set $drive_end (i32.const 2))))
    (local.set $i (local.get $drive_end))
    (block $done (loop $scan
      (local.set $ch (call $gl8 (i32.add (local.get $arg0) (local.get $i))))
      (br_if $done (i32.eqz (local.get $ch)))
      ;; A DBCS trail byte is data even when it equals '.', '/' or '\\'.
      (if (i32.and
            (call $is_dbcs_lead_byte (local.get $ch))
            (i32.ne
              (call $gl8
                (i32.add (local.get $arg0) (i32.add (local.get $i) (i32.const 1))))
              (i32.const 0)))
        (then
          (local.set $i (i32.add (local.get $i) (i32.const 2)))
          (br $scan)))
      (if (i32.or (i32.eq (local.get $ch) (i32.const 0x2f))
                  (i32.eq (local.get $ch) (i32.const 0x5c)))
        (then
          (local.set $dir_end (i32.add (local.get $i) (i32.const 1)))
          (local.set $has_dot (i32.const 0)))
        (else
          (if (i32.eq (local.get $ch) (i32.const 0x2e))
            (then
              (local.set $dot (local.get $i))
              (local.set $has_dot (i32.const 1))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (local.set $end (local.get $i))
    (local.set $ext (select (local.get $dot) (local.get $end) (local.get $has_dot)))
    (call $crt_splitpath_copy
      (local.get $arg1) (local.get $arg0) (i32.const 0) (local.get $drive_end))
    (call $crt_splitpath_copy
      (local.get $arg2) (local.get $arg0) (local.get $drive_end) (local.get $dir_end))
    (call $crt_splitpath_copy
      (local.get $arg3) (local.get $arg0) (local.get $dir_end) (local.get $ext))
    (call $crt_splitpath_copy
      (local.get $arg4) (local.get $arg0) (local.get $ext) (local.get $end))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; _wcsicmp lives with the other CRT overrides in 09a6-handlers-crt.wat.

  ;; 273: _wtoi — cdecl; wide string to int
  (func $handle__wtoi (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $tmp i32) (local $v i32) (local $i i32)
    (local.set $i (i32.const 0))
    (local.set $tmp (i32.const 0))
    (local.set $v (call $gl16 (local.get $arg0)))
    ;; Skip whitespace
    (block $ws_done (loop $ws
      (br_if $ws_done (i32.ne (local.get $v) (i32.const 0x20)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (local.set $v (call $gl16 (i32.add (local.get $arg0) (i32.shl (local.get $i) (i32.const 1)))))
      (br $ws)))
    ;; Parse digits
    (block $done (loop $parse
      (br_if $done (i32.lt_u (local.get $v) (i32.const 0x30)))
      (br_if $done (i32.gt_u (local.get $v) (i32.const 0x39)))
      (local.set $tmp (i32.add (i32.mul (local.get $tmp) (i32.const 10)) (i32.sub (local.get $v) (i32.const 0x30))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (local.set $v (call $gl16 (i32.add (local.get $arg0) (i32.shl (local.get $i) (i32.const 1)))))
      (br $parse)))
    (i32.store offset=0 (global.get $reg_base) (local.get $tmp))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))) (return)
  )

  ;; 274: _itow — int to wide string (STUB: unimplemented: write "0")
  (func $handle__itow (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $crt_itoa (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; 275: wcscmp — cdecl, case-sensitive UTF-16 comparison
  (func $handle_wcscmp (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $guest_wcscmp (local.get $arg0) (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; 276: wcsncpy
  (func $handle_wcsncpy (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $v i32) (local $i i32) (local $ended i32)
    (local.set $i (i32.const 0))
    (block $d (loop $l
      (br_if $d (i32.ge_u (local.get $i) (local.get $arg2)))
      (if (i32.eqz (local.get $ended))
        (then
          (local.set $v (call $gl16
            (i32.add (local.get $arg1) (i32.shl (local.get $i) (i32.const 1)))))
          (if (i32.eqz (local.get $v)) (then (local.set $ended (i32.const 1)))))
        (else (local.set $v (i32.const 0))))
      (call $gs16 (i32.add (local.get $arg0) (i32.shl (local.get $i) (i32.const 1))) (local.get $v))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $l)))
    (i32.store offset=0 (global.get $reg_base) (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; wcslen lives with the other CRT overrides in 09a6-handlers-crt.wat.

  ;; 278: memset(dest, ch, count) — cdecl
  (func $handle_memset (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $guest_memset (local.get $arg0) (local.get $arg1) (local.get $arg2))
    (i32.store offset=0 (global.get $reg_base) (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; 279: memcpy(dest, src, count) — cdecl
  (func $handle_memcpy (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $guest_memmove (local.get $arg0) (local.get $arg1) (local.get $arg2))
    (i32.store offset=0 (global.get $reg_base) (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; 280: __CxxFrameHandler — C++ exception frame handler (STUB: unimplemented, return 1=ExceptionContinueSearch)
  (func $handle___CxxFrameHandler (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr))
  )

  ;; 281: _global_unwind2 — STUB: unimplemented
  (func $handle__global_unwind2 (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr))
  )

  ;; Store a CRT error lazily.  The public _errno entry point owns the same
  ;; pointer; failures that occur before an application asks for it must still
  ;; be observable by the next _errno() call.
  (func $msvcrt_set_errno (param $value i32)
    (if (i32.eqz (global.get $msvcrt_errno_ptr))
      (then
        (global.set $msvcrt_errno_ptr (call $heap_alloc (i32.const 4)))))
    (if (global.get $msvcrt_errno_ptr)
      (then (call $gs32 (global.get $msvcrt_errno_ptr) (local.get $value)))))

  ;; 282: _getdcwd(drive, buffer, maxlen) — cdecl.  The VFS has one mutable
  ;; current directory.  Its documented drive-relative rule treats every
  ;; other mounted drive as being at that drive's root, so expose exactly that
  ;; model rather than fabricating per-drive mutable state.
  (func $handle__getdcwd (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $scratch_g i32) (local $scratch_w i32) (local $dst_w i32)
    (local $len i32) (local $needed i32) (local $buf i32)
    (local $letter i32) (local $current_drive i32) (local $drive i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))

    ;; Microsoft specifies a positive maxlen and drive 0..26 (0 means the
    ;; default drive).  This CRT has no invalid-parameter callback, so retain
    ;; the documented NULL result and make the validation failure observable.
    (if (i32.or
          (i32.le_s (local.get $arg2) (i32.const 0))
          (i32.gt_u (local.get $arg0) (i32.const 26)))
      (then
        (call $msvcrt_set_errno (i32.const 22)) ;; EINVAL
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (return)))

    ;; Read through a private MAX_PATH buffer first.  fs_get_current_directory
    ;; is a Win32-style producer, while _getdcwd must not touch a too-small CRT
    ;; caller buffer before returning ERANGE.
    (local.set $scratch_g (call $heap_alloc (i32.const 260)))
    (if (i32.eqz (local.get $scratch_g))
      (then
        (call $msvcrt_set_errno (i32.const 12)) ;; ENOMEM
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (return)))
    (local.set $scratch_w (call $g2w (local.get $scratch_g)))
    (local.set $len (call $host_fs_get_current_directory
      (i32.const 260) (local.get $scratch_g) (i32.const 0)))
    (if (i32.or
          (i32.or (i32.lt_u (local.get $len) (i32.const 3))
                  (i32.ge_u (local.get $len) (i32.const 260)))
          (i32.ne (i32.load8_u offset=1 (local.get $scratch_w)) (i32.const 0x3a)))
      (then
        (call $heap_free (local.get $scratch_g))
        (call $msvcrt_set_errno (i32.const 34)) ;; ERANGE
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (return)))

    (local.set $letter
      (i32.and (i32.load8_u (local.get $scratch_w)) (i32.const 0xdf)))
    (if (i32.or (i32.lt_u (local.get $letter) (i32.const 0x41))
                (i32.gt_u (local.get $letter) (i32.const 0x5a)))
      (then
        (call $heap_free (local.get $scratch_g))
        (call $msvcrt_set_errno (i32.const 22)) ;; EINVAL
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (return)))
    (local.set $current_drive
      (i32.sub (local.get $letter) (i32.const 0x40)))
    (local.set $drive
      (select (local.get $arg0) (local.get $current_drive)
        (i32.ne (local.get $arg0) (i32.const 0))))

    ;; A non-current drive has no private remembered directory in this VFS;
    ;; its drive-relative base is the root.  It must nevertheless be mounted.
    (if (i32.ne (local.get $drive) (local.get $current_drive))
      (then
        (if (i32.eqz (i32.and
              (call $host_fs_logical_drive_mask)
              (i32.shl (i32.const 1) (i32.sub (local.get $drive) (i32.const 1)))))
          (then
            (call $heap_free (local.get $scratch_g))
            (call $msvcrt_set_errno (i32.const 22)) ;; EINVAL/unavailable drive
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
            (return)))
        (local.set $len (i32.const 3))))

    (local.set $needed (i32.add (local.get $len) (i32.const 1)))
    (if (i32.gt_u (local.get $needed) (local.get $arg2))
      (then
        (call $heap_free (local.get $scratch_g))
        (call $msvcrt_set_errno (i32.const 34)) ;; ERANGE
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (return)))

    (local.set $buf (local.get $arg1))
    (if (i32.eqz (local.get $buf))
      (then
        ;; A NULL buffer requests a malloc-compatible block of at least
        ;; maxlen bytes, not merely the bytes occupied by today's path.
        (local.set $buf (call $heap_alloc (local.get $arg2)))
        (if (i32.eqz (local.get $buf))
          (then
            (call $heap_free (local.get $scratch_g))
            (call $msvcrt_set_errno (i32.const 12)) ;; ENOMEM
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
            (return)))))

    ;; Validate the complete span before the first write.  In particular, an
    ;; unmapped guest pointer must not turn into a successful write to the
    ;; shared NULL sentinel.
    (local.set $dst_w (call $g2w_affine_span (local.get $buf) (local.get $needed)))
    (if (i32.eq (local.get $dst_w) (global.get $NULL_SENTINEL))
      (then
        (if (i32.eqz (local.get $arg1))
          (then (call $heap_free (local.get $buf))))
        (call $heap_free (local.get $scratch_g))
        (call $msvcrt_set_errno (i32.const 22)) ;; EINVAL
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (return)))

    (if (i32.eq (local.get $drive) (local.get $current_drive))
      (then
        (call $memcpy (local.get $dst_w) (local.get $scratch_w) (local.get $needed)))
      (else
        (i32.store8 (local.get $dst_w)
          (i32.add (local.get $drive) (i32.const 0x40)))
        (i32.store8 offset=1 (local.get $dst_w) (i32.const 0x3a))
        (i32.store8 offset=2 (local.get $dst_w) (i32.const 0x5c))
        (i32.store8 offset=3 (local.get $dst_w) (i32.const 0))))
    (call $heap_free (local.get $scratch_g))
    (i32.store offset=0 (global.get $reg_base) (local.get $buf))
    ;; cdecl: pop only the API thunk's synthetic return address.  The caller
    ;; owns all three arguments.
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )
