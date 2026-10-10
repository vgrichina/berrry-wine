  ;; ============================================================
  ;; LATE FILE, REGISTRY, SHELL AND DESKTOP HANDLERS\nFile and registry services followed by shell integration and desktop helpers.
  ;; ============================================================

  ;; 408: SetFilePointer
  (func $handle_SetFilePointer (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; SetFilePointer(hFile, lDistanceToMove, lpDistanceToMoveHigh, dwMoveMethod) — 4 args
    ;; Clear last error on success, including the valid low-word 0xffffffff.
    (global.set $last_error (call $host_fs_seek_result
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (global.get $reg_base)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; ResumeThread(hThread) — 1 arg stdcall, return previous suspend count
  (func $handle_ResumeThread (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_resume_thread (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 410: SetLastError(dwErrCode)
  (func $handle_SetLastError (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $last_error (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; 411: FindNextFileW — STUB: unimplemented
  (func $handle_FindNextFileW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; FindNextFileW(hFindFile, lpFindFileData) — 2 args
    (i32.store offset=0 (global.get $reg_base) (call $host_fs_find_next_file
      (local.get $arg0) (local.get $arg1) (i32.const 1)))
    (if (i32.eqz (i32.load offset=0 (global.get $reg_base))) (then (global.set $last_error (i32.const 18)))) (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 412: RaiseException(dwExceptionCode, dwExceptionFlags, nNumberOfArguments, lpArguments)
  ;; 4 args stdcall. Pop first so SEH walker sees the caller's frame, then dispatch.
  (func $handle_RaiseException (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; A handler whose filter answers EXCEPTION_CONTINUE_EXECUTION resumes the
    ;; interrupted code, which for a software exception is the instruction
    ;; after this call. Record that before the stdcall cleanup discards it.
    (global.set $delphi_resume_eip (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
    (global.set $delphi_resume_esp (i32.load offset=16 (global.get $reg_base)))
    ;; RaiseException is a software exception and must invoke each registered
    ;; handler with the standard four-argument EXCEPTION_DISPOSITION protocol.
    ;; Registration records are runtime-specific: VB6, Delphi and hand-written
    ;; handlers are not necessarily MSVC __except_handler3 frames.  The latter
    ;; can only be decoded safely for CPU faults raised by $raise_exception.
    (call $raise_delphi_exception
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3))
  )

  ;; DebugBreak() — 0 args stdcall. KERNEL32's body is an int3, so it raises
  ;; EXCEPTION_BREAKPOINT to the caller's SEH chain; with no debugger an
  ;; unhandled one ends the process. A handler that continues execution
  ;; resumes after the call. Carmageddon 2's BRender driver loader resolves
  ;; KERNEL32:DebugBreak by name and refuses to load its renderer without it.
  (func $handle_DebugBreak (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $delphi_resume_eip (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (global.set $delphi_resume_esp (i32.load offset=16 (global.get $reg_base)))
    (call $raise_delphi_exception (i32.const 0x80000003) (i32.const 0) (i32.const 0) (i32.const 0)))

  ;; 413: GetUserDefaultLCID — STUB: unimplemented
  (func $handle_GetUserDefaultLCID (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; Return 0x0409 = English (US)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x0409))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))  ;; stdcall, 0 args
  )

  ;; Convert the user/system default aliases; concrete/invariant/unknown LCIDs
  ;; pass through unchanged. This is not the caller's SetThreadLocale setting.
  (func $handle_ConvertDefaultLocale (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.or (i32.eq (local.get $arg0) (i32.const 0x0400))
                (i32.eq (local.get $arg0) (i32.const 0x0800)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x0409)))
      (else (i32.store offset=0 (global.get $reg_base) (local.get $arg0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; GetSystemDefaultLCID() -> LCID. RichEdit asks during DLL init.
  (func $handle_GetSystemDefaultLCID (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x0409))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  ;; GetSystemDefaultLangID() -> LANGID. Match US English locale stubs.
  (func $handle_GetSystemDefaultLangID (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x0409))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  ;; 414: FileTimeToSystemTime
  (func $handle_FileTimeToSystemTime (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; FileTimeToSystemTime(lpFileTime, lpSystemTime) — 2 args
    (i32.store offset=0 (global.get $reg_base) (call $host_fs_filetime_to_systemtime
      (local.get $arg0) (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))  ;; 2 args
  )

  ;; FileTimeToDosDateTime(lpFileTime, LPWORD lpFatDate, LPWORD lpFatTime)
  ;; — 3 args stdcall. The FAT packing MS-DOS used, and still what a ZIP
  ;; directory entry stores, which is why archive code reaches for it.
  ;;
  ;; Built on the SYSTEMTIME conversion we already have rather than redoing
  ;; the 1601-epoch arithmetic: the calendar is the hard part and it is
  ;; already solved. The scratch SYSTEMTIME is ours alone, so it comes from
  ;; the heap once and is reused.
  (global $dosdate_scratch (mut i32) (i32.const 0))
  ;; Microsoft OLE32 4.71.2900, export23, VA7ff8b556: validate the input
  ;; FILETIME and both WORD outputs, then delegate to the Win32 conversion.
  (func $handle_CoFileTimeToDosDateTime (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.or (call $ptr_range_bad (local.get $arg0) (i32.const 8))
          (i32.or (call $ptr_range_bad (local.get $arg1) (i32.const 2))
                  (call $ptr_range_bad (local.get $arg2) (i32.const 2))))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))) (return)))
    (call $handle_FileTimeToDosDateTime (local.get $arg0) (local.get $arg1)
      (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $handle_FileTimeToDosDateTime (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $st i32) (local $year i32)
    (if (i32.eqz (global.get $dosdate_scratch))
      (then (global.set $dosdate_scratch (call $heap_alloc (i32.const 16)))))
    (if (i32.eqz (global.get $dosdate_scratch))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (local.set $st (call $g2w (global.get $dosdate_scratch)))
    (if (i32.eqz (call $host_fs_filetime_to_systemtime
                   (local.get $arg0) (global.get $dosdate_scratch)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    ;; The FAT epoch is 1980, and the field is 7 bits wide. Anything outside
    ;; 1980..2107 has no representation at all; Win32 reports failure rather
    ;; than wrapping into a wrong-but-plausible date.
    (local.set $year (i32.load16_u (local.get $st)))
    (if (i32.or (i32.lt_u (local.get $year) (i32.const 1980))
                (i32.gt_u (local.get $year) (i32.const 2107)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (if (local.get $arg1)
      (then (call $gs16 (local.get $arg1)
        (i32.or
          (i32.shl (i32.sub (local.get $year) (i32.const 1980)) (i32.const 9))
          (i32.or
            (i32.shl (i32.load16_u offset=2 (local.get $st)) (i32.const 5))
            (i32.load16_u offset=6 (local.get $st)))))))
    (if (local.get $arg2)
      (then (call $gs16 (local.get $arg2)
        (i32.or
          (i32.shl (i32.load16_u offset=8 (local.get $st)) (i32.const 11))
          (i32.or
            (i32.shl (i32.load16_u offset=10 (local.get $st)) (i32.const 5))
            ;; Two-second resolution: the low bit does not exist in FAT.
            (i32.shr_u (i32.load16_u offset=12 (local.get $st)) (i32.const 1)))))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 415: FileTimeToLocalFileTime(const FILETIME *src, LPFILETIME dst) → BOOL.
  ;; 2-arg stdcall. local = UTC - Bias, with the Bias GetTimeZoneInformation
  ;; reports (the current one, as Win32 uses, not the one at that date).
  (func $handle_FileTimeToLocalFileTime (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base)
      (call $filetime_shift_bias (local.get $arg0) (local.get $arg1) (i32.const -1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; CompareFileTime(const FILETIME *a, const FILETIME *b) -> -1, 0, or 1.
  ;; FILETIME is an unsigned 64-bit tick count represented as two DWORDs, so
  ;; compare the high halves first and use the low halves only as a tiebreaker.
  (func $handle_CompareFileTime (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $a_hi i32) (local $b_hi i32)
    (local $a_lo i32) (local $b_lo i32)
    (local.set $a_lo (call $gl32 (local.get $arg0)))
    (local.set $b_lo (call $gl32 (local.get $arg1)))
    (local.set $a_hi (call $gl32 (i32.add (local.get $arg0) (i32.const 4))))
    (local.set $b_hi (call $gl32 (i32.add (local.get $arg1) (i32.const 4))))
    (if (i32.lt_u (local.get $a_hi) (local.get $b_hi))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const -1)))
      (else
        (if (i32.gt_u (local.get $a_hi) (local.get $b_hi))
          (then (i32.store offset=0 (global.get $reg_base) (i32.const 1)))
          (else
            (if (i32.lt_u (local.get $a_lo) (local.get $b_lo))
              (then (i32.store offset=0 (global.get $reg_base) (i32.const -1)))
              (else
                (if (i32.gt_u (local.get $a_lo) (local.get $b_lo))
                  (then (i32.store offset=0 (global.get $reg_base) (i32.const 1)))
                  (else (i32.store offset=0 (global.get $reg_base) (i32.const 0))))))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 416: GetCurrentDirectoryW — STUB: unimplemented
  (func $handle_GetCurrentDirectoryW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; GetCurrentDirectoryW(nBufferLength, lpBuffer) — 2 args
    (i32.store offset=0 (global.get $reg_base) (call $host_fs_get_current_directory
      (local.get $arg0) (local.get $arg1) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 417: SetFileAttributesW — STUB: unimplemented
  (func $handle_SetFileAttributesW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; SetFileAttributesW(lpFileName, dwFileAttributes) — 2 args
    (i32.store offset=0 (global.get $reg_base) (call $fs_path_result
      (call $host_fs_set_file_attributes (call $g2w (local.get $arg0)) (local.get $arg1) (i32.const 1))
      (local.get $arg0) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 418: GetFullPathNameW — STUB: unimplemented
  (func $handle_GetFullPathNameW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; GetFullPathNameW(lpFileName, nBufferLength, lpBuffer, lpFilePart) — 4 args
    (i32.store offset=0 (global.get $reg_base) (call $host_fs_get_full_path_name
      (call $g2w (local.get $arg0)) (local.get $arg1) (local.get $arg2) (local.get $arg3) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; 419: DeleteFileW — STUB: unimplemented
  (func $handle_DeleteFileW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; DeleteFileW(lpFileName) — 1 arg
    (i32.store offset=0 (global.get $reg_base) (call $fs_path_result
      (call $host_fs_delete_file (call $g2w (local.get $arg0)) (i32.const 1))
      (local.get $arg0) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 420: MoveFileW — STUB: unimplemented
  (func $handle_MoveFileW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; MoveFileW(lpExistingFileName, lpNewFileName) — 2 args
    (i32.store offset=0 (global.get $reg_base) (call $host_fs_move_file
      (call $g2w (local.get $arg0)) (call $g2w (local.get $arg1)) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 421: SetEndOfFile
  (func $handle_SetEndOfFile (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $error i32)
    ;; SetEndOfFile(hFile) — truncate or extend at the current file pointer.
    (local.set $error (call $host_fs_set_end_of_file_result (local.get $arg0)))
    (if (local.get $error) (then (global.set $last_error (local.get $error))))
    (i32.store offset=0 (global.get $reg_base) (i32.eqz (local.get $error)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 422: DuplicateHandle
  (func $handle_DuplicateHandle (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $duplicate i32) (local $file_duplicate i32) (local $stack_w i32)
    ;; An anonymous pipe handle: a new handle on the same end, carrying the
    ;; caller's bInheritHandle ([ESP+24]); DUPLICATE_CLOSE_SOURCE ([ESP+28]
    ;; bit 0) closes the original. This is how a parent keeps a
    ;; non-inheritable copy of its own end of a child's pipe.
    (if (i32.ne (call $pipe_slot (local.get $arg1)) (i32.const 0))
      (then
        (local.set $stack_w (call $g2w (i32.load offset=16 (global.get $reg_base))))
        (if (i32.eqz (local.get $arg3))
          (then (call $pipe_ret (i32.const 0) (i32.const 87) (i32.const 32)) (return)))
        (local.set $duplicate (call $pipe_duplicate (local.get $arg1)
          (i32.load offset=24 (local.get $stack_w))))
        (if (i32.eqz (local.get $duplicate))
          (then (call $pipe_ret (i32.const 0) (i32.const 4) (i32.const 32)) (return)))
        (if (i32.and (i32.load offset=28 (local.get $stack_w)) (i32.const 1))
          (then (drop (call $pipe_close (local.get $arg1)))))
        (call $gs32 (local.get $arg3) (local.get $duplicate))
        (call $pipe_ret (i32.const 1) (i32.const 0) (i32.const 32))
        (return)))
    ;; Pseudo handles are contextual and cannot be copied into a durable output
    ;; handle. Miles duplicates GetCurrentThread() during startup, then its
    ;; WinMM callback suspends and resumes that real handle while servicing
    ;; DirectSound. File handles also need distinct identities with shared seek
    ;; state. Other kernel-object aliases remain a separate implementation gap.
    (if (local.get $arg3)
      (then
        (if (i32.or
              (i32.and (i32.ge_u (local.get $arg1) (i32.const 1))
                       (i32.le_u (local.get $arg1) (i32.const 3)))
              (i32.eq (i32.and (local.get $arg1) (i32.const 0xFFFF0000))
                      (global.get $CONSOLE_HANDLE_TAG)))
          (then
            (local.set $duplicate (call $console_handle_duplicate (local.get $arg1))))
          (else
            (local.set $stack_w (call $g2w (i32.load offset=16 (global.get $reg_base))))
            (if (i32.eq (i32.shr_u (local.get $arg1) (i32.const 24)) (i32.const 0xfb))
              (then
                (local.set $file_duplicate (call $host_fs_duplicate_mapping_result
                  (local.get $arg1) (local.get $arg4)
                  (i32.load offset=24 (local.get $stack_w))
                  (i32.load offset=28 (local.get $stack_w)) (global.get $reg_base)))
                (if (i32.eqz (local.get $file_duplicate))
                  (then (local.set $duplicate (i32.load (global.get $reg_base))))
                  (else (local.set $file_duplicate
                    (i32.sub (i32.const 0) (local.get $file_duplicate))))))
              (else
                (local.set $file_duplicate (call $host_fs_duplicate_handle
                  (local.get $arg1) (local.get $arg4)
                  (i32.load offset=24 (local.get $stack_w))
                  (i32.load offset=28 (local.get $stack_w))))
                (if (i32.gt_s (local.get $file_duplicate) (i32.const 0))
                  (then (local.set $duplicate (local.get $file_duplicate)))
                  (else (if (i32.eqz (local.get $file_duplicate))
                    (then (local.set $duplicate (local.get $arg1))))))))
            (if (i32.eq (local.get $arg1) (i32.const 0xFFFFFFFE))
              (then
                (local.set $duplicate
                  (call $host_duplicate_current_thread (global.get $current_thread_id)))))))
        (if (local.get $duplicate)
          (then (call $gs32 (local.get $arg3) (local.get $duplicate))))))
    (if (i32.eqz (local.get $duplicate))
      (then (global.set $last_error
        (select (i32.sub (i32.const 0) (local.get $file_duplicate)) (i32.const 6)
          (i32.lt_s (local.get $file_duplicate) (i32.const 0))))))
    (i32.store offset=0 (global.get $reg_base) (i32.and
      (i32.ne (local.get $arg3) (i32.const 0))
      (i32.ne (local.get $duplicate) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32))) ;; 7 args + ret
  )

  ;; 423: LockFile — STUB: unimplemented
  (func $handle_LockFile (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr))
  )

  ;; 424: UnlockFile — STUB: unimplemented
  (func $handle_UnlockFile (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr))
  )

  ;; 425: ReadFile — STUB: unimplemented
  ;; Park an API call that has to wait on host I/O, exactly the way
  ;; $vsock_block parks a blocking socket call: put the stdcall frame back,
  ;; point EIP at the thunk rather than the block that called it, and yield.
  ;; The host fills the missing chunk and clears the yield; the same handler
  ;; then re-runs with the same arguments and takes the cache hit.
  ;;
  ;; $handler_set_eip is load-bearing. $run's thunk-zone auto-pop fires
  ;; whenever a handler leaves EIP alone — yield or no yield — and splices the
  ;; call out entirely, so the guest would resume past its own ReadFile with
  ;; the arguments still on the stack.
  (func $io_block (param $unpop i32)
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (local.get $unpop)))
    (global.set $handler_set_eip (i32.const 1))
    (global.set $eip (global.get $current_thunk_eip))
    (global.set $yield_reason (i32.const 12))
    (global.set $yield_flag (i32.const 1))
    (global.set $steps (i32.const 0)))

  ;; A consumer that opens a file itself, reads it whole and closes it
  ;; (PlaySound, BASS_SampleLoad, LoadImage from a file) cannot close before
  ;; it parks: the close drops the VFS pending-read record, and the host fill
  ;; needs that record and its still-open handle, so the retry parked again
  ;; forever (Dark Colony's cursor LoadImageA: 2716 parks, one chunk). The
  ;; handle is held here instead, and released when the consumer is entered
  ;; again -- which on this thread is the retry of the same call, after the
  ;; fill has put the bytes in the shared cache the fresh handle then reads.
  (global $lazy_park_handle (mut i32) (i32.const 0))
  (func $lazy_park_release
    (if (global.get $lazy_park_handle)
      (then
        (drop (call $host_fs_close_handle (global.get $lazy_park_handle)))
        (global.set $lazy_park_handle (i32.const 0)))))
  (func $lazy_park_hold (param $handle i32)
    (call $lazy_park_release)
    (global.set $lazy_park_handle (local.get $handle)))

  ;; ---- spin parking ----------------------------------------------------
  ;; See the block comment on $spin_dispatch_seq in src/01-header.wat for why
  ;; a guest that busy-waits on the clock or on an empty message queue can be
  ;; parked inside the API call, and what the detector has to prove first.
  ;;
  ;; The park itself is the $io_block contract with a different reason, and it
  ;; is called BEFORE the handler pops its stdcall frame: the frame is left
  ;; exactly as the guest built it, EIP goes back to the thunk rather than to
  ;; the block that called it, and $handler_set_eip opts out of $run's
  ;; thunk-zone auto-pop -- without that last one the call is spliced out and
  ;; the guest resumes past its own timeGetTime with the arguments still on the
  ;; stack. The host clears the yield and the same handler re-runs from the top
  ;; with the same arguments, re-reads the clock, and this time returns it.
  (func $spin_park (param $reason i32)
    (global.set $handler_set_eip (i32.const 1))
    (global.set $eip (global.get $current_thunk_eip))
    (global.set $yield_reason (local.get $reason))
    (global.set $yield_flag (i32.const 1))
    (global.set $steps (i32.const 0)))

  ;; The caller's return address, which at API entry is the top of the stdcall
  ;; frame. Two clock reads from the same call site share it; a program that
  ;; reads the clock from two places does not, and neither detector debounces.
  (func $spin_call_site (result i32)
    (call $gl32 (i32.load offset=16 (global.get $reg_base))))

  ;; One step of the clock debounce. Returns 1 when this read is the Kth in a
  ;; context that is indistinguishable from its last read -- same millisecond,
  ;; call site, stack depth, and no meaningful API work in between. An
  ;; empty PeekMessage is neutral; a successful one is work and resets the run.
  ;; Anything different resets the run to 1, so the state is always about the
  ;; consecutive reads WITHIN A CONTEXT and never across real API work.
  ;; Select this exact call-site/stack context without merging its evidence
  ;; with other callers. Heroes II alternates four depths through one clock
  ;; wrapper; a single last-context slot reset after 3/4/3/1 reads forever.
  ;; Different values or real API activity still invalidate a cached count
  ;; when clock_spin_step compares its tags. Eviction only loses evidence.
  (func $clock_spin_select_context (param $ret i32)
    (local $key i64) (local $old_key i64)
    (local $old i64) (local $chosen i64) (local $chosen_count i32) (local $chosen_blk i32) (local $chosen_regs i32)
    (if (i32.and
          (i32.eq (local.get $ret) (global.get $clock_spin_ret))
          (i32.eq (i32.load offset=16 (global.get $reg_base)) (global.get $clock_spin_esp)))
      (then (return)))
    (local.set $key (i64.or
      (i64.shl (i64.extend_i32_u (local.get $ret)) (i64.const 32))
      (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base)))))
    (local.set $old_key (i64.or
      (i64.shl (i64.extend_i32_u (global.get $clock_spin_ret)) (i64.const 32))
      (i64.extend_i32_u (global.get $clock_spin_esp))))
    (local.set $old (i64.or
      (i64.shl (i64.extend_i32_u (global.get $clock_spin_seq)) (i64.const 32))
      (i64.extend_i32_u (global.get $clock_spin_value))))
    (if (i64.eq (local.get $key) (global.get $clock_spin_key0))
      (then
        (local.set $chosen (global.get $clock_spin_history0))
        (local.set $chosen_count (global.get $clock_spin_count0))
        (local.set $chosen_blk (global.get $clock_spin_blk0))
        (local.set $chosen_regs (global.get $clock_spin_regs0)))
      (else
        (if (i64.eq (local.get $key) (global.get $clock_spin_key1))
          (then
            (local.set $chosen (global.get $clock_spin_history1))
            (local.set $chosen_count (global.get $clock_spin_count1))
            (local.set $chosen_blk (global.get $clock_spin_blk1))
            (local.set $chosen_regs (global.get $clock_spin_regs1)))
          (else
            (if (i64.eq (local.get $key) (global.get $clock_spin_key2))
              (then
                (local.set $chosen (global.get $clock_spin_history2))
                (local.set $chosen_count (global.get $clock_spin_count2))
                (local.set $chosen_blk (global.get $clock_spin_blk2))
                (local.set $chosen_regs (global.get $clock_spin_regs2))))
            (global.set $clock_spin_key2 (global.get $clock_spin_key1))
            (global.set $clock_spin_count2 (global.get $clock_spin_count1))
            (global.set $clock_spin_history2 (global.get $clock_spin_history1))
            (global.set $clock_spin_blk2 (global.get $clock_spin_blk1))
            (global.set $clock_spin_regs2 (global.get $clock_spin_regs1))))
        (global.set $clock_spin_key1 (global.get $clock_spin_key0))
        (global.set $clock_spin_count1 (global.get $clock_spin_count0))
        (global.set $clock_spin_history1 (global.get $clock_spin_history0))
        (global.set $clock_spin_blk1 (global.get $clock_spin_blk0))
        (global.set $clock_spin_regs1 (global.get $clock_spin_regs0))))
    (global.set $clock_spin_key0 (local.get $old_key))
    (global.set $clock_spin_count0 (global.get $clock_spin_count))
    (global.set $clock_spin_history0 (local.get $old))
    (global.set $clock_spin_blk0 (global.get $clock_spin_blk))
    (global.set $clock_spin_regs0 (global.get $clock_spin_regs))
    (global.set $clock_spin_value (i32.wrap_i64 (local.get $chosen)))
    (global.set $clock_spin_seq (i32.wrap_i64 (i64.shr_u (local.get $chosen) (i64.const 32))))
    (global.set $clock_spin_count (local.get $chosen_count))
    (global.set $clock_spin_blk (local.get $chosen_blk))
    (global.set $clock_spin_regs (local.get $chosen_regs))
    (global.set $clock_spin_ret (local.get $ret))
    (global.set $clock_spin_esp (i32.load offset=16 (global.get $reg_base))))

  ;; Fingerprint of the callee-saved registers EBX, EBP, ESI, EDI. Each is
  ;; rotated by a different amount so swapping two of them still changes it.
  ;; $spin_regs_check is a mask of which ones: bit0 EBX, bit1 EBP, bit2 ESI,
  ;; bit3 EDI. A register holding the PREVIOUS clock reading is not evidence of
  ;; work: Diablo II's d2win limiter (0x1000b6e4) keeps the last
  ;; QueryPerformanceCounter in ESI:EDI, and QPC moves every call, so ESI
  ;; differs on every iteration of a real spin. Such registers count as zero.
  (func $clock_spin_reg (param $v i32) (param $rot i32) (param $on i32) (result i32)
    (select (i32.rotl (local.get $v) (local.get $rot)) (i32.const 0)
      (i32.and (i32.ne (local.get $on) (i32.const 0))
        (i32.and (i32.ne (local.get $v) (global.get $clock_spin_raw_lo))
                 (i32.ne (local.get $v) (global.get $clock_spin_raw_hi))))))
  (func $clock_spin_regs_now (result i32)
    (local $m i32)
    (local.set $m (global.get $spin_regs_check))
    (i32.xor
      (i32.xor
        (call $clock_spin_reg (i32.load offset=12 (global.get $reg_base)) (i32.const 0)
          (i32.and (local.get $m) (i32.const 1)))
        (call $clock_spin_reg (i32.load offset=20 (global.get $reg_base)) (i32.const 8)
          (i32.and (local.get $m) (i32.const 2))))
      (i32.xor
        (call $clock_spin_reg (i32.load offset=24 (global.get $reg_base)) (i32.const 16)
          (i32.and (local.get $m) (i32.const 4)))
        (call $clock_spin_reg (i32.load offset=28 (global.get $reg_base)) (i32.const 24)
          (i32.and (local.get $m) (i32.const 8))))))
  ;; What a clock API just handed the guest (after any park decision): QPC's
  ;; 64-bit count, or the millisecond with a zero high half.
  (func $clock_spin_note_raw (param $lo i32) (param $hi i32)
    (global.set $clock_spin_raw_lo (local.get $lo))
    (global.set $clock_spin_raw_hi (local.get $hi)))

  (func $clock_spin_step (param $value i32) (result i32)
    (local $ret i32) (local $threshold i32) (local $blk i32) (local $idle i32) (local $regs i32)
    (local.set $ret (call $spin_call_site))
    (call $clock_spin_select_context (local.get $ret))
    ;; Little enough guest work since this context's last read? (0 = no check.)
    (local.set $blk (call $blocks_now))
    (local.set $idle
      (i32.or (i32.eqz (global.get $spin_work_max))
        (i32.le_u (i32.sub (local.get $blk) (global.get $clock_spin_blk))
                  (global.get $spin_work_max))))
    (global.set $clock_spin_blk (local.get $blk))
    ;; Same guest state as this context's last read? (see $spin_regs_check)
    (local.set $regs (call $clock_spin_regs_now))
    (local.set $idle (i32.and (local.get $idle)
      (i32.or (i32.eqz (global.get $spin_regs_check))
        (i32.eq (local.get $regs) (global.get $clock_spin_regs)))))
    (global.set $clock_spin_regs (local.get $regs))
    (if (i32.and
          (i32.and
            (i32.and
              (i32.eq (local.get $value) (global.get $clock_spin_value))
              (i32.eq (global.get $spin_nonpoll_seq)
                      (global.get $clock_spin_seq)))
            (local.get $idle))
          (i32.and
            (i32.eq (local.get $ret) (global.get $clock_spin_ret))
            (i32.eq (i32.load offset=16 (global.get $reg_base)) (global.get $clock_spin_esp))))
      (then (global.set $clock_spin_count
              (i32.add (global.get $clock_spin_count) (i32.const 1))))
      (else
        (global.set $clock_spin_count (i32.const 1))
        ;; A value we have not parked on yet: the one-park-per-millisecond
        ;; latch is about the value, so a new one re-arms it.
        (if (i32.ne (local.get $value) (global.get $clock_spin_parked_value))
          (then (global.set $clock_spin_parked_valid (i32.const 0))))))
    (global.set $clock_spin_value (local.get $value))
    (global.set $clock_spin_seq (global.get $spin_nonpoll_seq))
    (global.set $clock_spin_ret (local.get $ret))
    (global.set $clock_spin_esp (i32.load offset=16 (global.get $reg_base)))
    (local.set $threshold (global.get $spin_park_k))
    ;; A site must first survive the conservative K-read proof. Once qualified,
    ;; two identical reads are enough to re-arm later milliseconds at that same
    ;; return address and stack depth.
    (if (i32.and
          (global.get $clock_spin_qualified_valid)
          (i32.and
            (i32.eq (local.get $ret) (global.get $clock_spin_qualified_ret))
            (i32.eq (i32.load offset=16 (global.get $reg_base)) (global.get $clock_spin_qualified_esp))))
      (then (local.set $threshold (i32.const 2))))
    (i32.and
      (i32.and
        (i32.ne (global.get $spin_park_k) (i32.const 0))
        (i32.ge_u (global.get $clock_spin_count) (local.get $threshold)))
      (call $spin_park_reaches_host)))

  ;; A park is a yield to the host, and inside a synchronous send the host is
  ;; not there: $wnd_send_message's nested $run returns with EIP still on the
  ;; thunk, nothing waits out the deadline, and every round parks again until
  ;; the 64-round cap abandons the message half-run. AoE II paints its game
  ;; frame from UpdateWindow; a once-a-second wait inside it parked in the
  ;; page, the paint was abandoned before the frame resumed the draw system,
  ;; and game start centred the cursor through the still-NULL surface pointer
  ;; to (0,0) -- the edge-scroll corner. Answer the call instead: the clock
  ;; keeps moving under the nested run, so the wait ends on its own.
  (func $spin_park_reaches_host (result i32)
    (i32.eqz (global.get $sync_msg_depth)))

  ;; Take the park, if this millisecond has not already had one. Returns 1 when
  ;; the caller must return immediately without popping its frame.
  (func $clock_spin_arm (param $value i32) (result i32)
    (if (i32.and (i32.ne (global.get $clock_spin_parked_valid) (i32.const 0))
                 (i32.eq (global.get $clock_spin_parked_value) (local.get $value)))
      (then (return (i32.const 0))))
    (global.set $clock_spin_parked_value (local.get $value))
    (global.set $clock_spin_parked_valid (i32.const 1))
    (global.set $clock_spin_qualified_valid (i32.const 1))
    (global.set $clock_spin_qualified_ret (global.get $clock_spin_ret))
    (global.set $clock_spin_qualified_esp (global.get $clock_spin_esp))
    (global.set $clock_spin_parks (i32.add (global.get $clock_spin_parks) (i32.const 1)))
    ;; The deadline is the next millisecond, because the millisecond is the
    ;; resolution of the thing being waited on: any wake earlier than that finds
    ;; the identical value and parks again. Tier 3 -- learning the deadline the
    ;; guest is actually counting to -- is deliberately not built.
    (global.set $spin_deadline_ms (i32.add (local.get $value) (i32.const 1)))
    ;; A park ends the run of identical reads it was taken for. This site is now
    ;; qualified, so a later millisecond re-arms after two matching reads rather
    ;; than paying the conservative first-proof threshold again.
    (global.set $clock_spin_count (i32.const 0))
    (call $spin_park (i32.const 14))
    (i32.const 1))

  ;; The PeekMessage twin. There is no value to compare -- "the queue was
  ;; empty" IS the repeated observation -- so the dispatch-adjacency test is
  ;; doing the heavy lifting here, and it is exactly the right test: the
  ;; ordinary game loop is empty-peek, RENDER A FRAME, empty-peek, and a frame
  ;; is API calls. Only a pump with nothing at all between two empty peeks
  ;; debounces. A successful peek does not call this, and leaves the sequence
  ;; number two behind, so it resets the run on its own.
  (func $peek_spin_step (result i32)
    (local $ret i32)
    (local.set $ret (call $spin_call_site))
    (if (i32.and
          (i32.eq (global.get $spin_dispatch_seq)
                  (i32.add (global.get $peek_spin_seq) (i32.const 1)))
          (i32.and
            (i32.eq (local.get $ret) (global.get $peek_spin_ret))
            (i32.eq (i32.load offset=16 (global.get $reg_base)) (global.get $peek_spin_esp))))
      (then (global.set $peek_spin_count
              (i32.add (global.get $peek_spin_count) (i32.const 1))))
      (else (global.set $peek_spin_count (i32.const 1))))
    (global.set $peek_spin_seq (global.get $spin_dispatch_seq))
    (global.set $peek_spin_ret (local.get $ret))
    (global.set $peek_spin_esp (i32.load offset=16 (global.get $reg_base)))
    (i32.and
      (i32.and
        (i32.ne (global.get $spin_park_k) (i32.const 0))
        (i32.ge_u (global.get $peek_spin_count) (global.get $spin_park_k)))
      (call $spin_park_reaches_host)))

  (func $peek_spin_arm
    (global.set $peek_spin_parks (i32.add (global.get $peek_spin_parks) (i32.const 1)))
    ;; Rebuild the run from zero, so the worst case is one park per K empty
    ;; peeks even if the host wakes it immediately.
    (global.set $peek_spin_count (i32.const 0))
    (call $spin_park (i32.const 15)))

  ;; The VFS may complete cached reads during submission; completion routines
  ;; are nevertheless queued until an alertable wait. Lazy residency uses the
  ;; existing IO_WAIT retry before submission completes (not a JS guest call).
  ;; Queue nodes: next,arg0,arg1,arg2,callback,argc. A ReadFileEx completion
  ;; passes (error, byteCount, OVERLAPPED); a QueueUserAPC routine its one
  ;; dwData. hEvent is untouched.
  (func $handle_ReadFileEx (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $node i32) (local $wa i32) (local $error i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (global.set $last_error (i32.const 87))
    (block $done
      (br_if $done (i32.eqz (local.get $arg3)))
      (br_if $done (i32.eqz (local.get $arg4)))
      (br_if $done (i32.and (i32.ne (local.get $arg2) (i32.const 0)) (i32.eqz (local.get $arg1))))
      (local.set $node (call $heap_alloc (i32.const 24)))
      (if (i32.eqz (local.get $node)) (then (global.set $last_error (i32.const 8)) (br $done)))
      (local.set $wa (call $g2w (local.get $node)))
      (i32.store offset=20 (local.get $wa) (i32.const 3))
      (local.set $error (call $host_fs_read_file_at (local.get $arg0) (local.get $arg1) (local.get $arg2)
        (i32.add (local.get $node) (i32.const 8))
        (call $gl32 (i32.add (local.get $arg3) (i32.const 8)))
        (call $gl32 (i32.add (local.get $arg3) (i32.const 12)))))
      (if (i32.eq (local.get $error) (i32.const 997)) (then
        (call $heap_free (local.get $node)) (call $io_block (i32.const 0)) (return)))
      (if (i32.and (i32.ne (local.get $error) (i32.const 0)) (i32.ne (local.get $error) (i32.const 38))) (then
        (call $heap_free (local.get $node)) (global.set $last_error (local.get $error)) (br $done)))
      (i32.store (local.get $wa) (i32.const 0))
      (i32.store offset=4 (local.get $wa) (local.get $error))
      (i32.store offset=12 (local.get $wa) (local.get $arg3))
      (i32.store offset=16 (local.get $wa) (local.get $arg4))
      (call $gs32 (local.get $arg3) (select (i32.const 0xc0000011) (i32.const 0) (local.get $error)))
      (call $gs32 (i32.add (local.get $arg3) (i32.const 4)) (i32.load offset=8 (local.get $wa)))
      (call $io_apc_enqueue (local.get $node))
      (global.set $last_error (i32.const 0)) (i32.store offset=0 (global.get $reg_base) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  (func $io_apc_enqueue (param $node i32)
    (call $gs32 (local.get $node) (i32.const 0))
    (if (global.get $io_apc_tail) (then
      (call $gs32 (global.get $io_apc_tail) (local.get $node)))
    (else (global.set $io_apc_head (local.get $node))))
    (global.set $io_apc_tail (local.get $node)))

  ;; ---- Cross-thread user APCs -------------------------------------------
  ;; Every guest thread is its own WASM instance, so the $io_apc_head queue
  ;; above is private to the thread that owns it. QueueUserAPC therefore
  ;; publishes into a shared per-thread inbox: one dword per Win32 thread id
  ;; (1..16, main is 1) holding the guest address of the newest node. Producers
  ;; push with a compare-exchange (any thread may queue to any other), and only
  ;; the owning thread ever consumes, by swapping the whole list out at once
  ;; and reversing it back into arrival order onto its private queue. Nodes are
  ;; the 24-byte io_apc layout and come from the process-wide guest heap.
  ;;
  ;; A queued APC runs only inside an alertable wait on its target. Three
  ;; places consume the inbox:
  ;;   * $io_apc_start, on entry to SleepEx/WaitFor*Ex with bAlertable set;
  ;;   * $apc_resume_alert_sleep at run() entry, for a thread that parked in
  ;;     an alertable SleepEx and is being resumed (early, by thread_alert, or
  ;;     at its timeout) — the sleep had already returned 0, so delivery here
  ;;     replays it as the APC followed by a WAIT_IO_COMPLETION return;
  ;;   * the apc_wake_wait export, which the scheduler calls on a thread
  ;;     parked (yield_reason 1) in an alertable WaitFor*Ex.
  ;; Set by an alertable SleepEx that parked, with the return address and ESP
  ;; it will resume at. Cleared by the next API dispatch or run() resumption.
  (global $apc_alert_sleep (mut i32) (i32.const 0))
  (global $apc_alert_ret (mut i32) (i32.const 0))
  (global $apc_alert_esp (mut i32) (i32.const 0))
  ;; Set by an alertable WaitForSingleObjectEx/WaitForMultipleObjectsEx that
  ;; parked with yield_reason 1. Cleared by the next API dispatch.
  (global $wait_alertable (mut i32) (i32.const 0))

  (func $apc_shared_slot (param $tid i32) (result i32)
    (if (i32.or (i32.lt_u (local.get $tid) (i32.const 1))
                (i32.gt_u (local.get $tid) (i32.const 16)))
      (then (return (i32.const 0))))
    (i32.add (global.get $THREAD_APC_QUEUES)
      (i32.shl (i32.sub (local.get $tid) (i32.const 1)) (i32.const 2))))

  (func $apc_shared_push (param $slot i32) (param $node i32)
    (local $old i32)
    (loop $retry
      (local.set $old (i32.atomic.load (local.get $slot)))
      (call $gs32 (local.get $node) (local.get $old))
      (br_if $retry (i32.ne
        (i32.atomic.rmw.cmpxchg (local.get $slot) (local.get $old) (local.get $node))
        (local.get $old)))))

  ;; Move this thread's inbox onto its private queue, oldest first.
  (func $apc_import_shared
    (local $slot i32) (local $list i32) (local $rev i32) (local $next i32)
    (local.set $slot (call $apc_shared_slot (global.get $current_thread_id)))
    (if (i32.eqz (local.get $slot)) (then (return)))
    (if (i32.eqz (i32.atomic.load (local.get $slot))) (then (return)))
    (local.set $list (i32.atomic.rmw.xchg (local.get $slot) (i32.const 0)))
    (block $rev_done (loop $rev_loop
      (br_if $rev_done (i32.eqz (local.get $list)))
      (local.set $next (call $gl32 (local.get $list)))
      (call $gs32 (local.get $list) (local.get $rev))
      (local.set $rev (local.get $list))
      (local.set $list (local.get $next))
      (br $rev_loop)))
    (block $app_done (loop $app_loop
      (br_if $app_done (i32.eqz (local.get $rev)))
      (local.set $next (call $gl32 (local.get $rev)))
      (call $io_apc_enqueue (local.get $rev))
      (local.set $rev (local.get $next))
      (br $app_loop))))

  (func $apc_pending (result i32)
    (local $slot i32)
    (if (global.get $io_apc_head) (then (return (i32.const 1))))
    (local.set $slot (call $apc_shared_slot (global.get $current_thread_id)))
    (if (i32.eqz (local.get $slot)) (then (return (i32.const 0))))
    (i32.ne (i32.atomic.load (local.get $slot)) (i32.const 0)))

  ;; A thread that ends drops whatever is still queued to it, so a later
  ;; thread reusing the id does not run a stranger's APCs.
  (func $apc_drop_shared_current
    (local $slot i32) (local $list i32) (local $next i32)
    (local.set $slot (call $apc_shared_slot (global.get $current_thread_id)))
    (if (i32.eqz (local.get $slot)) (then (return)))
    (local.set $list (i32.atomic.rmw.xchg (local.get $slot) (i32.const 0)))
    (block $done (loop $free
      (br_if $done (i32.eqz (local.get $list)))
      (local.set $next (call $gl32 (local.get $list)))
      (call $heap_free (local.get $list))
      (local.set $list (local.get $next))
      (br $free))))

  ;; run() entry: the thread is resuming at the return address of an alertable
  ;; SleepEx it parked in. If an APC arrived meanwhile, run it now and return
  ;; WAIT_IO_COMPLETION from the sleep instead of the 0 it already holds.
  ;; Anything else running at this point (a host-injected callback) leaves the
  ;; mark for the real resumption.
  (func $apc_resume_alert_sleep
    (if (i32.eqz (global.get $apc_alert_sleep)) (then (return)))
    (if (i32.or (i32.ne (global.get $eip) (global.get $apc_alert_ret))
                (i32.ne (i32.load offset=16 (global.get $reg_base)) (global.get $apc_alert_esp)))
      (then (return)))
    (global.set $apc_alert_sleep (i32.const 0))
    (if (i32.eqz (call $apc_pending)) (then (return)))
    (call $io_apc_ensure_thunk)
    (call $io_apc_push (global.get $eip))
    (call $io_apc_continue)
    (global.set $handler_set_eip (i32.const 0)))

  ;; Scheduler hook for a thread parked in an alertable WaitFor*Ex: if an APC
  ;; is pending, abandon the wait and run it; the wait returns
  ;; WAIT_IO_COMPLETION. ESP still holds the call's return address and its
  ;; arguments, exactly as $_completeWait in lib/thread-manager.js expects.
  (func (export "apc_wake_wait") (result i32)
    (local $frame i32)
    (if (i32.or (i32.ne (global.get $yield_reason) (i32.const 1))
                (i32.eqz (global.get $wait_alertable)))
      (then (return (i32.const 0))))
    (if (i32.eqz (call $apc_pending)) (then (return (i32.const 0))))
    (local.set $frame (global.get $wait_stack_bytes))
    (global.set $wait_alertable (i32.const 0))
    (global.set $yield_reason (i32.const 0))
    (global.set $wait_handles_ptr (i32.const 0))
    (global.set $wait_all (i32.const 0))
    (global.set $wait_timeout (i32.const 0xFFFFFFFF))
    (global.set $wait_stack_bytes (i32.const 12))
    (drop (call $io_apc_start (local.get $frame)))
    (global.set $handler_set_eip (i32.const 0))
    (i32.const 1))

  ;; Whether thread_alert should cut this instance's sleep short.
  (func (export "apc_alertable_sleeping") (result i32)
    (global.get $apc_alert_sleep))

  ;; QueueUserAPC(pfnAPC, hThread, dwData) -> nonzero on success. The routine
  ;; runs on the target thread the next time it is in an alertable wait
  ;; (SleepEx, WaitForSingleObjectEx, WaitForMultipleObjectsEx), through the
  ;; same CACA0032 continuation as ReadFileEx completions, and the wait then
  ;; returns WAIT_IO_COMPLETION. A target already parked in an alertable sleep
  ;; is woken by thread_alert.
  (func $handle_QueueUserAPC (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $node i32) (local $wa i32) (local $tid i32) (local $slot i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (global.set $last_error (i32.const 87))
    (block $done
      (br_if $done (i32.eqz (local.get $arg0)))
      (local.set $tid
        (if (result i32) (i32.eq (local.get $arg1) (i32.const -2))
          (then (global.get $current_thread_id))
          (else (call $host_thread_apc_target (local.get $arg1) (global.get $current_thread_id)))))
      (if (i32.eqz (local.get $tid)) (then (global.set $last_error (i32.const 6)) (br $done)))
      (local.set $slot (call $apc_shared_slot (local.get $tid)))
      ;; The host only hands out ids 1..16; anything else is a host bug.
      (if (i32.eqz (local.get $slot)) (then (call $crash_unimplemented (local.get $name_ptr))))
      (local.set $node (call $heap_alloc (i32.const 24)))
      (if (i32.eqz (local.get $node)) (then (global.set $last_error (i32.const 8)) (br $done)))
      (local.set $wa (call $g2w (local.get $node)))
      (i32.store offset=4 (local.get $wa) (local.get $arg2))
      (i32.store offset=8 (local.get $wa) (i32.const 0))
      (i32.store offset=12 (local.get $wa) (i32.const 0))
      (i32.store offset=16 (local.get $wa) (local.get $arg0))
      (i32.store offset=20 (local.get $wa) (i32.const 1))
      (call $apc_shared_push (local.get $slot) (local.get $node))
      (if (i32.ne (local.get $tid) (global.get $current_thread_id))
        (then (call $host_thread_alert (local.get $tid))))
      (global.set $last_error (i32.const 0))
      (i32.store offset=0 (global.get $reg_base) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $io_apc_push (param $value i32)
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $value)))

  (func $io_apc_start (param $frame i32) (result i32)
    (local $ret i32)
    (call $apc_import_shared)
    (if (i32.eqz (global.get $io_apc_head)) (then (return (i32.const 0))))
    (call $io_apc_ensure_thunk)
    (local.set $ret (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (local.get $frame)))
    (call $io_apc_push (local.get $ret))
    (call $io_apc_continue) (i32.const 1))

  (func $io_apc_ensure_thunk
    (local $wa i32)
    (if (i32.eqz (global.get $io_apc_thunk)) (then
      (global.set $num_thunks (call $thunk_reserve))
      (local.set $wa (i32.add (global.get $THUNK_BASE) (i32.mul (global.get $num_thunks) (i32.const 8))))
      (i32.store (local.get $wa) (i32.const 0xcaca0032))
      (i32.store offset=4 (local.get $wa) (i32.const 0))
      (global.set $io_apc_thunk (i32.add (i32.sub (local.get $wa) (global.get $GUEST_BASE)) (global.get $image_base)))
      (global.set $num_thunks (i32.add (global.get $num_thunks) (i32.const 1)))
      (call $update_thunk_end))))

  (func $io_apc_continue
    (local $node i32) (local $wa i32) (local $callback i32)
    ;; Inline CALL-reg/mem thunk handlers use steps=0 to retain a redirected
    ;; EIP. handler_set_eip alone protects only the outer thunk-zone path.
    (global.set $steps (i32.const 0))
    (global.set $handler_set_eip (i32.const 1))
    ;; An APC queued from another thread while the previous one ran is still
    ;; delivered inside this same wait, as Windows drains the whole queue.
    (call $apc_import_shared)
    (local.set $node (global.get $io_apc_head))
    (if (i32.eqz (local.get $node)) (then
      (global.set $eip (call $gl32 (i32.load offset=16 (global.get $reg_base))))
      (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
      (i32.store offset=0 (global.get $reg_base) (i32.const 0xc0)) (return)))
    (local.set $wa (call $g2w (local.get $node)))
    (global.set $io_apc_head (i32.load (local.get $wa)))
    (if (i32.eqz (global.get $io_apc_head)) (then (global.set $io_apc_tail (i32.const 0))))
    (local.set $callback (i32.load offset=16 (local.get $wa)))
    (if (i32.ge_u (i32.load offset=20 (local.get $wa)) (i32.const 3)) (then
      (call $io_apc_push (i32.load offset=12 (local.get $wa)))
      (call $io_apc_push (i32.load offset=8 (local.get $wa)))))
    (call $io_apc_push (i32.load offset=4 (local.get $wa)))
    (call $io_apc_push (global.get $io_apc_thunk))
    (call $heap_free (local.get $node))
    (global.set $eip (local.get $callback)))

  (func $handle_ReadFile (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $err i32) (local $bytes i32)
    ;; ReadFile(hFile, lpBuffer, nToRead, lpBytesRead, lpOverlapped) — 5 args
    ;;
    ;; An OVERLAPPED on a handle bound to a completion port is a *positioned*
    ;; read that must not move the file pointer and must report its result
    ;; through the port rather than through the return value. Warcraft III's
    ;; asynchronous file layer is built on exactly this and blocks forever
    ;; without it. The read itself is synchronous here, so the completion is
    ;; queued before the call returns and the guest still sees the
    ;; ERROR_IO_PENDING it is written to expect.
    ;;
    ;; A handle with an OVERLAPPED but no port binding falls through to the
    ;; ordinary path below, which is what Win32 does for a file opened
    ;; without FILE_FLAG_OVERLAPPED.
    ;; Anonymous pipes (09d7-pipes.wat) finish or park the call themselves.
    (if (call $pipe_read_file (local.get $arg0) (local.get $arg1)
          (local.get $arg2) (local.get $arg3))
      (then (return)))
    (if (i32.and (i32.ne (local.get $arg4) (i32.const 0))
                 (i32.ne (call $iocp_assoc_find (local.get $arg0)) (i32.const 0)))
      (then
        ;; InternalHigh (OVERLAPPED+4) is where the byte count belongs, so the
        ;; host writes it there directly instead of into a scratch dword.
        (local.set $err (call $host_fs_read_file_at
          (local.get $arg0) (local.get $arg1) (local.get $arg2)
          (i32.add (local.get $arg4) (i32.const 4))
          (call $gl32 (i32.add (local.get $arg4) (i32.const 8)))
          (call $gl32 (i32.add (local.get $arg4) (i32.const 12)))))
        ;; 997 here is the lazy-mount park, not the guest's pending status:
        ;; re-run this exact call once the host has the bytes.
        (if (i32.eq (local.get $err) (i32.const 997))
          (then (call $io_block (i32.const 24)) (return)))
        (if (i32.and (i32.ne (local.get $err) (i32.const 0))
                     (i32.ne (local.get $err) (i32.const 38)))
          (then
            (global.set $last_error (local.get $err))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
            (return)))
        (local.set $bytes (call $gl32 (i32.add (local.get $arg4) (i32.const 4))))
        (if (local.get $arg3) (then (call $gs32 (local.get $arg3) (local.get $bytes))))
        (drop (call $iocp_complete_overlapped (local.get $arg0) (local.get $arg4)
          (local.get $bytes)
          ;; 38 = ERROR_HANDLE_EOF: a legitimate short read, reported to the
          ;; guest as STATUS_END_OF_FILE in OVERLAPPED.Internal.
          (select (i32.const 0xC0000011) (i32.const 0)
            (i32.eq (local.get $err) (i32.const 38)))))
        (global.set $last_error (i32.const 997)) ;; ERROR_IO_PENDING
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    (local.set $err (call $host_fs_read_file_result
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)))
    (i32.store offset=0 (global.get $reg_base) (i32.eqz (local.get $err)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
    ;; The result belongs to this read, without a second shared-state RPC.
    ;; Lazy fill is an internal retry, not a completed guest operation.
    (if (i32.eq (local.get $err) (i32.const 997))
      (then (call $io_block (i32.const 24)))
      (else
        (if (local.get $err)
          (then (global.set $last_error (local.get $err))))))
  )

  ;; 426: CreateFileW — STUB: unimplemented
  (func $handle_CreateFileW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; CreateFileW — 7 args, same as CreateFileA but wide
    (local $wa_esp_w i32) (local $creation_w i32) (local $flags_w i32) (local $device i32) (local $path_wa i32)
    (local.set $path_wa (call $g2w (local.get $arg0)))
    (local.set $device (call $console_device_name (local.get $path_wa) (i32.const 1)))
    (if (call $quartz_vxd_name (local.get $path_wa) (i32.const 1))
      (then (local.set $device (global.get $QUARTZ_VXD_HANDLE))))
    (if (local.get $device)
      (then
        (i32.store offset=0 (global.get $reg_base) (local.get $device))
        (global.set $last_error (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
        (return)))
    (local.set $wa_esp_w (call $g2w (i32.load offset=16 (global.get $reg_base))))
    (local.set $creation_w (local.get $arg4))
    (local.set $flags_w (i32.load (i32.add (local.get $wa_esp_w) (i32.const 24))))
    (global.set $last_error (call $host_fs_create_file_result
      (local.get $path_wa) (local.get $arg1)
      (local.get $creation_w) (local.get $flags_w) (i32.const 1) (global.get $reg_base)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
    (if (i32.eq (global.get $last_error) (i32.const 997))
      (then (call $io_block (i32.const 32))))
  )

  ;; SetFileTime(hFile, lpCreationTime, lpLastAccessTime, lpLastWriteTime).
  ;; NULL leaves that timestamp unchanged; the VFS also honors the all-ones
  ;; sentinel old Win32 software uses to suppress automatic time updates.
  (func $handle_SetFileTime (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $err i32)
    (local.set $err (call $host_fs_file_time
      (local.get $arg0) (i32.const 1)
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

  ;; Snapshot before writing, so both identity conversions also handle overlap.
  ;; dst = src + $sign * Bias minutes, as 100ns ticks. The source is read
  ;; whole before the destination is written, so src == dst is fine, and
  ;; both go through the page-safe accessors. 0 for a NULL pointer.
  (func $filetime_shift_bias (param $src i32) (param $dst i32) (param $sign i32) (result i32)
    (if (i32.or (i32.eqz (local.get $src)) (i32.eqz (local.get $dst)))
      (then (return (i32.const 0))))
    (call $gs64 (local.get $dst)
      (i64.add
        (i64.or
          (i64.extend_i32_u (call $gl32 (local.get $src)))
          (i64.shl
            (i64.extend_i32_u (call $gl32 (i32.add (local.get $src) (i32.const 4))))
            (i64.const 32)))
        (i64.mul
          (i64.extend_i32_s (i32.mul (local.get $sign) (call $tz_bias_minutes)))
          (i64.const 600000000))))
    (i32.const 1))

  ;; 428: LocalFileTimeToFileTime. UTC = local + Bias — the inverse of
  ;; FileTimeToLocalFileTime above.
  (func $handle_LocalFileTimeToFileTime (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base)
      (call $filetime_shift_bias (local.get $arg0) (local.get $arg1) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 429: SystemTimeToFileTime(const SYSTEMTIME*, FILETIME*) — 2 args stdcall.
  ;; The calendar arithmetic is the civil-days era algorithm: shift March to
  ;; the head of the year so the leap day lands last, then count whole
  ;; 400-year eras. wDayOfWeek is ignored, as Win32 ignores it.
  ;;
  ;; MFC 6.00's CTime/COleDateTime path runs this on every document save, so a
  ;; missing one stopped MSPaint's file round trip at the first Save As.
  (func $handle_SystemTimeToFileTime (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $year i32) (local $mon i32) (local $day i32)
    (local $hour i32) (local $min i32) (local $sec i32) (local $ms i32)
    (local $y i32) (local $era i32) (local $yoe i32) (local $doy i32) (local $doe i32)
    (local $days i32)
    (if (i32.or (i32.eqz (local.get $arg0)) (i32.eqz (local.get $arg1)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (local.set $year (call $gl16 (local.get $arg0)))
    (local.set $mon  (call $gl16 (i32.add (local.get $arg0) (i32.const 2))))
    (local.set $day  (call $gl16 (i32.add (local.get $arg0) (i32.const 6))))
    (local.set $hour (call $gl16 (i32.add (local.get $arg0) (i32.const 8))))
    (local.set $min  (call $gl16 (i32.add (local.get $arg0) (i32.const 10))))
    (local.set $sec  (call $gl16 (i32.add (local.get $arg0) (i32.const 12))))
    (local.set $ms   (call $gl16 (i32.add (local.get $arg0) (i32.const 14))))
    ;; FILETIME cannot represent anything before 1601, and Win32 rejects a
    ;; SYSTEMTIME whose fields are out of range rather than normalizing it.
    (if (i32.or
          (i32.lt_u (local.get $year) (i32.const 1601))
          (i32.or
            (i32.or (i32.eqz (local.get $mon)) (i32.gt_u (local.get $mon) (i32.const 12)))
            (i32.or
              (i32.or (i32.eqz (local.get $day)) (i32.gt_u (local.get $day) (i32.const 31)))
              (i32.or
                (i32.or (i32.gt_u (local.get $hour) (i32.const 23))
                        (i32.gt_u (local.get $min) (i32.const 59)))
                (i32.or (i32.gt_u (local.get $sec) (i32.const 59))
                        (i32.gt_u (local.get $ms) (i32.const 999)))))))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    ;; Days since 1601-01-01.
    (local.set $y (i32.sub (local.get $year)
      (i32.le_u (local.get $mon) (i32.const 2))))
    (local.set $era (i32.div_u (local.get $y) (i32.const 400)))
    (local.set $yoe (i32.sub (local.get $y) (i32.mul (local.get $era) (i32.const 400))))
    (local.set $doy (i32.add
      (i32.div_u
        (i32.add (i32.mul (i32.add (local.get $mon)
                            (select (i32.const -3) (i32.const 9)
                                    (i32.gt_u (local.get $mon) (i32.const 2))))
                          (i32.const 153))
                 (i32.const 2))
        (i32.const 5))
      (i32.sub (local.get $day) (i32.const 1))))
    (local.set $doe (i32.add
      (i32.add (i32.mul (local.get $yoe) (i32.const 365))
               (i32.div_u (local.get $yoe) (i32.const 4)))
      (i32.sub (local.get $doy) (i32.div_u (local.get $yoe) (i32.const 100)))))
    ;; 584694 = 719468 (era day 0 → 1970-01-01) - 134774 (1601-01-01 → 1970),
    ;; so the count comes out relative to the FILETIME epoch directly.
    (local.set $days (i32.sub
      (i32.add (i32.mul (local.get $era) (i32.const 146097)) (local.get $doe))
      (i32.const 584694)))
    (call $gs64 (local.get $arg1)
      (i64.add
        (i64.mul
          (i64.add
            (i64.mul (i64.extend_i32_u (local.get $days)) (i64.const 86400))
            (i64.extend_i32_u
              (i32.add (i32.mul (local.get $hour) (i32.const 3600))
                       (i32.add (i32.mul (local.get $min) (i32.const 60))
                                (local.get $sec)))))
          (i64.const 10000000))
        (i64.mul (i64.extend_i32_u (local.get $ms)) (i64.const 10000))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 430: RegOpenKeyW — STUB: unimplemented
  (func $handle_RegOpenKeyW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; RegOpenKeyW(hKey, lpSubKey, phkResult) — 3 args stdcall
    (local $hResult i32)
    (local.set $hResult (call $host_reg_open_key
      (local.get $arg0) (call $g2w (local.get $arg1)) (i32.const 1)))
    (if (local.get $hResult)
      (then (call $gs32 (local.get $arg2) (local.get $hResult))
             (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 2))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; RegEnumKeyW(hKey, dwIndex, lpName, cchName)
  (func $handle_RegEnumKeyW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_reg_enum_key
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; RegSetValue{A,W}(hKey, lpSubKey, dwType, lpData, cbData) writes the
  ;; unnamed/default value, creating the optional subkey when necessary.
  (func $reg_set_value (param $hkey i32) (param $subkey_g i32)
                       (param $type i32) (param $data_g i32)
                       (param $cb i32) (param $wide i32) (result i32)
    (local $sub_wa i32) (local $target i32) (local $out_g i32) (local $res i32)
    (local.set $sub_wa
      (if (result i32) (local.get $subkey_g)
        (then (call $g2w (local.get $subkey_g)))
        (else (i32.const 0))))
    ;; Even an empty subkey is opened into a normal host handle: predefined
    ;; root constants are not writable handles in the storage backend.
    (local.set $target (call $host_reg_open_key
      (local.get $hkey) (local.get $sub_wa) (local.get $wide)))
    (if (i32.eqz (local.get $target))
      (then
        (local.set $out_g (call $heap_alloc (i32.const 4)))
        (if (i32.eqz (local.get $out_g)) (then (return (i32.const 8)))) ;; ERROR_NOT_ENOUGH_MEMORY
        (local.set $res (call $host_reg_create_key
          (local.get $hkey) (local.get $sub_wa) (local.get $out_g)
          (local.get $wide) (i32.const 0)))
        (if (i32.eqz (local.get $res))
          (then (local.set $target (call $gl32 (local.get $out_g)))))
        (call $heap_free (local.get $out_g))
        (if (local.get $res) (then (return (local.get $res))))))
    (local.set $res (call $host_reg_set_value
      (local.get $target) (i32.const 0) (local.get $type)
      (local.get $data_g) (local.get $cb) (local.get $wide)))
    (drop (call $host_reg_close_key (local.get $target)))
    (local.get $res))

  ;; 432: RegSetValueW — 5 args stdcall.
  (func $handle_RegSetValueW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $reg_set_value
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
  )

  ;; RegSetValueA — 5 args stdcall.
  (func $handle_RegSetValueA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $reg_set_value
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
  )

  ;; RegQueryValueA(hKey, lpSubKey, lpData, lpcbData) — 4 args stdcall
  ;; RegQueryValue{A,W}(hKey, lpSubKey, lpData, lpcbData) — 4 args stdcall.
  ;; The Win16-era spelling: it reads the *default* value (name "") of an
  ;; optional subkey. lpSubKey NULL or empty means hKey itself. This used to
  ;; return ERROR_FILE_NOT_FOUND unconditionally, so a caller could never read
  ;; a default value the registry does hold (every file-association lookup is
  ;; one of these).
  (func $reg_query_value (param $hkey i32) (param $subkey_g i32)
                         (param $data_g i32) (param $cb_g i32) (param $wide i32) (result i32)
    (local $sub i32) (local $res i32) (local $subkey_wa i32)
    (local.set $sub (local.get $hkey)) (local.set $subkey_wa (call $g2w (local.get $subkey_g)))
    (if (i32.and (i32.ne (local.get $subkey_g) (i32.const 0))
                 (i32.ne (i32.load8_u (local.get $subkey_wa)) (i32.const 0)))
      (then
        (local.set $sub (call $host_reg_open_key
          (local.get $hkey) (local.get $subkey_wa) (local.get $wide)))
        (if (i32.eqz (local.get $sub))
          (then (return (i32.const 2))))))  ;; ERROR_FILE_NOT_FOUND
    (local.set $res (call $host_reg_query_value
      (local.get $sub) (i32.const 0) (i32.const 0)
      (local.get $data_g) (local.get $cb_g) (local.get $wide)))
    (if (i32.ne (local.get $sub) (local.get $hkey))
      (then (drop (call $host_reg_close_key (local.get $sub)))))
    (local.get $res))

  (func $handle_RegQueryValueA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $reg_query_value
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  (func $handle_RegQueryValueW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $reg_query_value
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; 433: RegCreateKeyW — STUB: unimplemented
  (func $handle_RegCreateKeyW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; RegCreateKeyW(hKey, lpSubKey, phkResult) — 3 args stdcall
    (i32.store offset=0 (global.get $reg_base) (call $host_reg_create_key
      (local.get $arg0) (call $g2w (local.get $arg1)) (local.get $arg2)
      (i32.const 1) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 434: RegSetValueExW
  (func $handle_RegSetValueExW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $reg_set_value_ex
      (local.get $arg0) (local.get $arg1) (local.get $arg3) (local.get $arg4)
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
  )

  ;; 435: RegCreateKeyExW — STUB: unimplemented
  (func $handle_RegCreateKeyExW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; RegCreateKeyExW(hKey, lpSubKey, Reserved, lpClass, dwOptions, samDesired, lpSecurityAttrs, phkResult, lpdwDisposition)
    ;; 9 args stdcall
    (local $wa_esp i32) (local $phkResult i32) (local $lpdwDisposition i32)
    (local.set $wa_esp (call $g2w (i32.load offset=16 (global.get $reg_base))))
    (local.set $phkResult (i32.load (i32.add (local.get $wa_esp) (i32.const 32))))
    (local.set $lpdwDisposition (i32.load (i32.add (local.get $wa_esp) (i32.const 36))))
    (i32.store offset=0 (global.get $reg_base) (call $host_reg_create_key
      (local.get $arg0) (call $g2w (local.get $arg1)) (local.get $phkResult)
      (i32.const 1) (local.get $lpdwDisposition)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 40)))
  )

  ;; RegCreateKeyExA — same as ExW, 9 args stdcall
  (func $handle_RegCreateKeyExA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa_esp i32) (local $phkResult i32) (local $lpdwDisposition i32)
    (local.set $wa_esp (call $g2w (i32.load offset=16 (global.get $reg_base))))
    (local.set $phkResult (i32.load (i32.add (local.get $wa_esp) (i32.const 32))))
    (local.set $lpdwDisposition (i32.load (i32.add (local.get $wa_esp) (i32.const 36))))
    (i32.store offset=0 (global.get $reg_base) (call $host_reg_create_key
      (local.get $arg0) (call $g2w (local.get $arg1)) (local.get $phkResult)
      (i32.const 0) (local.get $lpdwDisposition)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 40)))
  )

  ;; 436: RegQueryValueExW
  (func $handle_RegQueryValueExW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $reg_query_value_ex
      (local.get $arg0) (local.get $arg1) (local.get $arg3) (local.get $arg4)
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
  )

  ;; 437: GetShortPathNameA(lpszLong, lpszShort, cchBuffer) — 3 args stdcall
  ;; Copy long path to short path buffer, return length
  ;; GetShortPathNameA(lpszLongPath, lpszShortPath, cchBuffer) — 3 args.
  ;; Through the same host call the W spelling uses: this used to copy the
  ;; long path back verbatim, so the two spellings answered differently for
  ;; a path the VFS does have a short name for.
  (func $handle_GetShortPathNameA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_fs_get_short_path_name
      (call $g2w (local.get $arg0)) (local.get $arg1) (local.get $arg2) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; GetLongPathNameA/W(lpszShortPath, lpszLongPath, cchBuffer): Win98
  ;; KERNEL32. The VFS keeps no 8.3 aliases (GetShortPathName hands back the
  ;; path it was given), so the long form of a path that exists is that path.
  ;; Windows Installer 2.0 binds this by name and has no fallback of its own:
  ;; without it msi.dll logs "Could not create LFN path for package" and
  ;; msiexec fails every install with 1619. Returns the length copied, or the
  ;; size needed including the terminator when the buffer is too small (and
  ;; writes nothing), or 0 with ERROR_FILE_NOT_FOUND for a missing path.
  (func $long_path_name (param $src i32) (param $dst i32) (param $size i32) (param $wide i32)
                        (result i32)
    (local $len i32) (local $unit i32)
    (if (i32.eqz (local.get $src))
      (then (global.set $last_error (i32.const 87)) (return (i32.const 0))))
    (if (i32.eq (call $host_fs_get_file_attributes (call $g2w (local.get $src)) (local.get $wide))
                (i32.const -1))
      (then (global.set $last_error (i32.const 2)) (return (i32.const 0))))
    (local.set $unit (select (i32.const 2) (i32.const 1) (local.get $wide)))
    (block $end (loop $count
      (br_if $end (i32.eqz (if (result i32) (local.get $wide)
        (then (call $gl16 (i32.add (local.get $src) (i32.shl (local.get $len) (i32.const 1)))))
        (else (call $gl8 (i32.add (local.get $src) (local.get $len)))))))
      (local.set $len (i32.add (local.get $len) (i32.const 1)))
      (br $count)))
    (if (i32.or (i32.eqz (local.get $dst)) (i32.le_u (local.get $size) (local.get $len)))
      (then (return (i32.add (local.get $len) (i32.const 1)))))
    (if (i32.ne (local.get $dst) (local.get $src))
      (then (call $guest_memmove (local.get $dst) (local.get $src)
        (i32.mul (i32.add (local.get $len) (i32.const 1)) (local.get $unit)))))
    (local.get $len))

  (func $handle_GetLongPathNameA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base)
      (call $long_path_name (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_GetLongPathNameW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base)
      (call $long_path_name (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; 453: ExtFloodFill(hdc, x, y, color, fillType)
  (func $handle_ExtFloodFill (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $desc i32)
    (local.set $desc (global.get $GDI_BLIT_DST_DESC))
    (if (call $gdi_surface_descriptor (local.get $arg0) (local.get $desc))
      (then (i32.store offset=0 (global.get $reg_base) (call $gdi_raster_flood_fill
        (local.get $arg0) (local.get $desc) (local.get $arg1) (local.get $arg2)
        (local.get $arg3) (local.get $arg4)
        (call $gdi_dc_get_field (local.get $arg0) (i32.const 8) (i32.const 0x30010)))))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
  )

  ;; Enable or disable one/both arrows on a standard bar or SCROLLBAR control.
  ;; ESB_* values are a two-bit disable mask (low/up=1, right/down=2). USER32
  ;; returns FALSE when the requested state was already present, so retaining
  ;; this separately from SCROLLINFO is observable even before the next paint.
  (func $enable_scroll_bar_core (param $hwnd i32) (param $bar i32)
      (param $arrows i32) (result i32)
    (local $slot i32) (local $vert i32) (local $changed i32)
    (local $class i32) (local $style i32)
    (local.set $slot (call $wnd_table_find (local.get $hwnd)))
    (if (i32.lt_s (local.get $slot) (i32.const 0))
      (then
        (global.set $last_error (i32.const 1400)) ;; ERROR_INVALID_WINDOW_HANDLE
        (return (i32.const 0))))
    (if (i32.gt_u (local.get $arrows) (i32.const 3))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (return (i32.const 0))))

    ;; SB_CTL addresses a SCROLLBAR control and follows its SBS_VERT bit.
    (if (i32.eq (local.get $bar) (i32.const 2))
      (then
        (local.set $class (call $ctrl_table_get_class (local.get $hwnd)))
        (if (i32.ne (local.get $class) (i32.const 7))
          (then
            (global.set $last_error (i32.const 87))
            (return (i32.const 0))))
        (local.set $style (call $wnd_get_style (local.get $hwnd)))
        (local.set $vert (i32.ne (i32.and (local.get $style) (i32.const 1)) (i32.const 0)))
        (local.set $changed (call $scroll_arrow_set_slot
          (local.get $slot) (local.get $vert) (local.get $arrows))))
      (else
        ;; SB_HORZ=0, SB_VERT=1, SB_BOTH=3. SB_BOTH reports a change if
        ;; either standard bar changed.
        (if (i32.eq (local.get $bar) (i32.const 0))
          (then
            (local.set $changed (call $scroll_arrow_set_slot
              (local.get $slot) (i32.const 0) (local.get $arrows))))
          (else
            (if (i32.eq (local.get $bar) (i32.const 1))
              (then
                (local.set $changed (call $scroll_arrow_set_slot
                  (local.get $slot) (i32.const 1) (local.get $arrows))))
              (else
                (if (i32.eq (local.get $bar) (i32.const 3))
                  (then
                    (local.set $changed (call $scroll_arrow_set_slot
                      (local.get $slot) (i32.const 0) (local.get $arrows)))
                    (local.set $changed (i32.or (local.get $changed)
                      (call $scroll_arrow_set_slot
                        (local.get $slot) (i32.const 1) (local.get $arrows)))))
                  (else
                    (global.set $last_error (i32.const 87))
                    (return (i32.const 0))))))))))

    (if (local.get $changed)
      (then
        ;; Child/common controls repaint their client-owned strips; standard
        ;; bars repaint in the non-client pass. Scheduling both is harmless
        ;; for a plain window and keeps ListView/TreeView/ListBox coherent.
        (call $invalidate_hwnd (local.get $hwnd))
        (if (i32.ne (local.get $bar) (i32.const 2))
          (then
            (if (call $wnd_is_effectively_visible (local.get $hwnd))
              (then
                (call $defwndproc_do_ncpaint (local.get $hwnd))
                (call $nc_flags_set (local.get $hwnd) (i32.const 1))))))))
    (local.get $changed))

  (func $handle_EnableScrollBar (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $enable_scroll_bar_core
      (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))) ;; 3 args stdcall
  )

  (func $caret_schedule_repaint
    (local $hwnd i32) (local $top i32)
    (local.set $hwnd (global.get $caret_hwnd))
    (if (i32.eqz (local.get $hwnd))
      (then (return)))
    (local.set $top (call $wnd_top_level (local.get $hwnd)))
    (if (i32.eqz (local.get $top))
      (then (local.set $top (local.get $hwnd))))
    ;; The renderer composites USER caret state after normal back-canvas paint.
    ;; Scheduling the top-level repaint is enough; direct GDI fills here can land
    ;; before native child layout has settled and then get erased by repaint.
    (call $host_invalidate (local.get $top))
  )

  ;; 459: GetCaretPos(lpPoint) — report the last USER caret coordinates.
  (func $handle_GetCaretPos (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32)
    (if (local.get $arg0)
      (then
        (local.set $wa (call $g2w (local.get $arg0)))
        (i32.store (local.get $wa) (global.get $caret_x))
        (i32.store offset=4 (local.get $wa) (global.get $caret_y))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))) ;; 1 arg stdcall
  )

  ;; GetCaretBlinkTime() — the interval a caret spends in each phase. Callers
  ;; use it as a timer period, so returning a real value matters: HyperTerminal
  ;; feeds it straight to SetTimer for its cursor.
  (func $handle_GetCaretBlinkTime (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (global.get $caret_blink_time))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))) ;; 0 args stdcall
  )

  ;; SetCaretBlinkTime(uMSeconds) — store it so the Get above reports it back.
  (func $handle_SetCaretBlinkTime (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg0)
      (then (global.set $caret_blink_time (local.get $arg0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))) ;; 1 arg stdcall
  )

  ;; Caret APIs — enough USER caret state for native controls such as RichEdit
  ;; to leave a visible caret stroke in the renderer. The renderer composites
  ;; this state after normal back-canvas paint and owns blink/inverted erasure.
  (func $handle_CreateCaret (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $caret_hwnd (local.get $arg0))
    (global.set $caret_x (i32.const 0))
    (global.set $caret_y (i32.const 0))
    (if (i32.gt_s (local.get $arg2) (i32.const 0))
      (then (global.set $caret_w (local.get $arg2)))
      (else (global.set $caret_w (i32.const 1))))
    (if (i32.gt_s (local.get $arg3) (i32.const 0))
      (then (global.set $caret_h (local.get $arg3)))
      (else (global.set $caret_h (i32.const 13))))
    (global.set $caret_visible (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))) ;; 4 args stdcall
  )

  (func $handle_DestroyCaret (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $caret_visible (i32.const 0))
    (call $caret_schedule_repaint)
    (global.set $caret_hwnd (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))) ;; 0 args stdcall
  )

  (func $handle_HideCaret (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.or
          (i32.eqz (local.get $arg0))
          (i32.eq (local.get $arg0) (global.get $caret_hwnd)))
      (then
        (global.set $caret_visible (i32.const 0))
        (call $caret_schedule_repaint)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))) ;; 1 arg stdcall
  )

  (func $handle_ShowCaret (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg0)
      (then (global.set $caret_hwnd (local.get $arg0))))
    (global.set $caret_visible (i32.const 1))
    (call $caret_schedule_repaint)
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))) ;; 1 arg stdcall
  )

  (func $handle_SetCaretPos (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $caret_x (local.get $arg0))
    (global.set $caret_y (local.get $arg1))
    (if (global.get $caret_visible)
      (then (call $caret_schedule_repaint)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))) ;; 2 args stdcall
  )

  ;; 460: GetUpdateRect(hwnd, lpRect, bErase) — writes updateRgn bbox if present;
  ;; otherwise writes the full client rect (back-compat fallback for apps that
  ;; check this on startup before any Invalidate). Returns TRUE iff non-empty.
  (func $handle_GetUpdateRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $rv i32) (local $wa i32) (local $cs i32)
    (if (local.get $arg1)
      (then
        (local.set $wa (call $g2w (local.get $arg1)))
        (local.set $rv (call $update_get_rect (local.get $arg0) (local.get $wa)))
        (if (i32.eqz (local.get $rv))
          (then
            ;; Empty updateRgn. If paint_pending (main) or paint flag set (child),
            ;; the caller will paint full client — hand them the full client rect.
            (local.set $cs (call $host_get_window_client_size (local.get $arg0)))
            (store.field Rect left (local.get $wa) (i32.const 0))
            (store.field.memarg Rect top (local.get $wa) (i32.const 0))
            (store.field.memarg Rect right (local.get $wa) (i32.and (local.get $cs) (i32.const 0xFFFF)))
            (store.field.memarg Rect bottom (local.get $wa) (i32.shr_u (local.get $cs) (i32.const 16)))
            (if (i32.eq (local.get $arg0) (global.get $main_hwnd))
              (then (local.set $rv (global.get $paint_pending)))))))
      (else (local.set $rv (call $update_get_rect (local.get $arg0) (i32.const 0)))))
    (i32.store offset=0 (global.get $reg_base) (local.get $rv))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

;; 462: WriteClassStg(pStg, rclsid) — persist the root storage CLSID.
  (func $handle_WriteClassStg (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.or (i32.eqz (local.get $arg0)) (i32.eqz (local.get $arg1)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)))
      (else
        (memory.copy (call $g2w (i32.add (local.get $arg0) (i32.const 20))) (call $g2w (local.get $arg1)) (i32.const 16))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 463: WriteFmtUserTypeStg(pStg, cf, lpszUserType) — persist \1CompObj.
  (func $handle_WriteFmtUserTypeStg (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $ole_write_fmt_user_type_stg
      (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 464: StringFromCLSID(rclsid, lplpsz) — 2 args stdcall
  ;; Allocate wide string "{00000000-0000-0000-0000-000000000000}" and write GUID
  (func $handle_StringFromCLSID (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $buf i32) (local $dst i32) (local $src i32)
    (local $d1 i32) (local $d2 i32) (local $d3 i32) (local $i i32) (local $b i32) (local $nib i32)
    ;; Allocate 78 bytes (39 wchars) from heap
    (local.set $buf (call $heap_alloc (i32.const 78)))
    (local.set $dst (call $g2w (local.get $buf)))
    (local.set $src (call $g2w (local.get $arg0)))
    ;; Write '{' then hex digits with dashes then '}'
    ;; Simplified: write "{00000000-0000-0000-0000-000000000000}\0"
    ;; Read actual GUID bytes and format
    (i32.store16 (local.get $dst) (i32.const 0x7B)) ;; '{'
    (local.set $dst (i32.add (local.get $dst) (i32.const 2)))
    ;; Data1: 4 bytes, big-endian hex
    (local.set $d1 (i32.load (local.get $src)))
    (local.set $i (i32.const 28))
    (block $hd1 (loop $ld1
      (br_if $hd1 (i32.lt_s (local.get $i) (i32.const 0)))
      (local.set $nib (i32.and (i32.shr_u (local.get $d1) (local.get $i)) (i32.const 0xF)))
      (i32.store16 (local.get $dst) (i32.add (local.get $nib) (select (i32.const 48) (i32.const 55) (i32.lt_u (local.get $nib) (i32.const 10)))))
      (local.set $dst (i32.add (local.get $dst) (i32.const 2)))
      (local.set $i (i32.sub (local.get $i) (i32.const 4)))
      (br $ld1)))
    (i32.store16 (local.get $dst) (i32.const 0x2D)) ;; '-'
    (local.set $dst (i32.add (local.get $dst) (i32.const 2)))
    ;; Data2: 2 bytes
    (local.set $d2 (i32.load16_u (i32.add (local.get $src) (i32.const 4))))
    (local.set $i (i32.const 12))
    (block $hd2 (loop $ld2
      (br_if $hd2 (i32.lt_s (local.get $i) (i32.const 0)))
      (local.set $nib (i32.and (i32.shr_u (local.get $d2) (local.get $i)) (i32.const 0xF)))
      (i32.store16 (local.get $dst) (i32.add (local.get $nib) (select (i32.const 48) (i32.const 55) (i32.lt_u (local.get $nib) (i32.const 10)))))
      (local.set $dst (i32.add (local.get $dst) (i32.const 2)))
      (local.set $i (i32.sub (local.get $i) (i32.const 4)))
      (br $ld2)))
    (i32.store16 (local.get $dst) (i32.const 0x2D))
    (local.set $dst (i32.add (local.get $dst) (i32.const 2)))
    ;; Data3: 2 bytes
    (local.set $d3 (i32.load16_u (i32.add (local.get $src) (i32.const 6))))
    (local.set $i (i32.const 12))
    (block $hd3 (loop $ld3
      (br_if $hd3 (i32.lt_s (local.get $i) (i32.const 0)))
      (local.set $nib (i32.and (i32.shr_u (local.get $d3) (local.get $i)) (i32.const 0xF)))
      (i32.store16 (local.get $dst) (i32.add (local.get $nib) (select (i32.const 48) (i32.const 55) (i32.lt_u (local.get $nib) (i32.const 10)))))
      (local.set $dst (i32.add (local.get $dst) (i32.const 2)))
      (local.set $i (i32.sub (local.get $i) (i32.const 4)))
      (br $ld3)))
    (i32.store16 (local.get $dst) (i32.const 0x2D))
    (local.set $dst (i32.add (local.get $dst) (i32.const 2)))
    ;; Data4[0..1]: 2 bytes
    (local.set $i (i32.const 0))
    (block $hd4a (loop $ld4a
      (br_if $hd4a (i32.ge_u (local.get $i) (i32.const 2)))
      (local.set $b (i32.load8_u (i32.add (local.get $src) (i32.add (i32.const 8) (local.get $i)))))
      (local.set $nib (i32.shr_u (local.get $b) (i32.const 4)))
      (i32.store16 (local.get $dst) (i32.add (local.get $nib) (select (i32.const 48) (i32.const 55) (i32.lt_u (local.get $nib) (i32.const 10)))))
      (local.set $dst (i32.add (local.get $dst) (i32.const 2)))
      (local.set $nib (i32.and (local.get $b) (i32.const 0xF)))
      (i32.store16 (local.get $dst) (i32.add (local.get $nib) (select (i32.const 48) (i32.const 55) (i32.lt_u (local.get $nib) (i32.const 10)))))
      (local.set $dst (i32.add (local.get $dst) (i32.const 2)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $ld4a)))
    (i32.store16 (local.get $dst) (i32.const 0x2D))
    (local.set $dst (i32.add (local.get $dst) (i32.const 2)))
    ;; Data4[2..7]: 6 bytes
    (local.set $i (i32.const 2))
    (block $hd4b (loop $ld4b
      (br_if $hd4b (i32.ge_u (local.get $i) (i32.const 8)))
      (local.set $b (i32.load8_u (i32.add (local.get $src) (i32.add (i32.const 8) (local.get $i)))))
      (local.set $nib (i32.shr_u (local.get $b) (i32.const 4)))
      (i32.store16 (local.get $dst) (i32.add (local.get $nib) (select (i32.const 48) (i32.const 55) (i32.lt_u (local.get $nib) (i32.const 10)))))
      (local.set $dst (i32.add (local.get $dst) (i32.const 2)))
      (local.set $nib (i32.and (local.get $b) (i32.const 0xF)))
      (i32.store16 (local.get $dst) (i32.add (local.get $nib) (select (i32.const 48) (i32.const 55) (i32.lt_u (local.get $nib) (i32.const 10)))))
      (local.set $dst (i32.add (local.get $dst) (i32.const 2)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $ld4b)))
    (i32.store16 (local.get $dst) (i32.const 0x7D)) ;; '}'
    (i32.store16 (i32.add (local.get $dst) (i32.const 2)) (i32.const 0)) ;; null
    ;; Write pointer to *lplpsz
    (call $gs32 (local.get $arg1) (local.get $buf))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)) ;; S_OK
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; Shell container walking stays in the host because the source is a VFS
  ;; file, not a mapped module. The returned bytes are a packed Win9x RT_ICON;
  ;; cursor_create_from_resource copies them into ordinary caller-owned HICON
  ;; mask/color planes before this temporary buffer is released.
  (global $EXTRACT_ICON_RESOURCE_CAPACITY i32 (i32.const 0x50000))

  (func $extract_icon_resource_handle (param $file i32) (param $index i32)
        (param $wide i32) (param $size i32) (param $buffer i32) (result i32)
    (local $bytes i32)
    (local.set $bytes (call $host_shell_extract_icon_resource
      (call $g2w (local.get $file)) (local.get $wide) (local.get $index)
      (local.get $size) (call $g2w (local.get $buffer))
      (global.get $EXTRACT_ICON_RESOURCE_CAPACITY)))
    (if (i32.le_s (local.get $bytes) (i32.const 0))
      (then (return (local.get $bytes))))
    (call $cursor_create_from_resource
      (local.get $buffer) (local.get $bytes) (i32.const 1)
      (i32.const 0x00030000) (local.get $size) (local.get $size) (i32.const 0)))

  (func $extract_icon_one (param $file i32) (param $index i32)
        (param $wide i32) (result i32)
    (local $count i32) (local $buffer i32) (local $icon i32)
    (local.set $count (call $host_shell_extract_icon_resource
      (call $g2w (local.get $file)) (local.get $wide) (local.get $index)
      (i32.const 0) (i32.const 0) (i32.const 0)))
    (if (i32.lt_s (local.get $count) (i32.const 0))
      (then
        (global.set $last_error (i32.sub (i32.const 0) (local.get $count)))
        ;; ExtractIcon's documented bad-container sentinel is HICON 1.
        (return (i32.const 1))))
    (if (i32.eq (local.get $index) (i32.const -1))
      (then (return (local.get $count))))
    (if (i32.and (i32.ge_s (local.get $index) (i32.const 0))
          (i32.ge_u (local.get $index) (local.get $count)))
      (then (return (i32.const 0))))
    (local.set $buffer (call $heap_alloc (global.get $EXTRACT_ICON_RESOURCE_CAPACITY)))
    (if (i32.eqz (local.get $buffer))
      (then
        (global.set $last_error (i32.const 8)) ;; ERROR_NOT_ENOUGH_MEMORY
        (return (i32.const 0))))
    (local.set $icon (call $extract_icon_resource_handle
      (local.get $file) (local.get $index) (local.get $wide)
      (i32.const 32) (local.get $buffer)))
    (call $heap_free (local.get $buffer))
    (if (i32.lt_s (local.get $icon) (i32.const 0))
      (then
        (global.set $last_error (i32.sub (i32.const 0) (local.get $icon)))
        (return (i32.const 1))))
    (local.get $icon))

  ;; 465: ExtractIconW — Unicode filename, same owned HICON contract.
  (func $handle_ExtractIconW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $extract_icon_one
      (local.get $arg1) (local.get $arg2) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; ExtractIconA(hInst, file, index). hInst is retained for ABI compatibility;
  ;; the returned icon is private and must be released with DestroyIcon.
  (func $handle_ExtractIconA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $extract_icon_one
      (local.get $arg1) (local.get $arg2) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; 466: ShellAboutW — return 1, 4 args stdcall
  ;; OleUIAddVerbMenuA(lpOleObj, lpszShortType, hMenu, uPos, uIDVerbMin,
  ;;                   uIDVerbMax, bAddConvert, idConvert, lphMenu) → BOOL
  ;;
  ;; MFC builds the "<<OLE VERBS GO HERE>>" entry of an Edit menu through this,
  ;; from its WM_INITMENUPOPUP handler. It was not registered, so
  ;; GetProcAddress("OleUIAddVerbMenuA") returned 0 and MFC put up "This
  ;; program is linked to the missing export ... in OLEDLG.DLL" -- which only
  ;; became visible once WM_INITMENUPOPUP started being delivered at all.
  ;;
  ;; With no object selected there are no verbs to add, and FALSE with
  ;; *lphMenu = NULL is the documented answer, not a placeholder. An actual
  ;; embedded object would need IOleObject::EnumVerbs, so that case still
  ;; fails loudly rather than silently doing nothing.
  (func $handle_OleUIAddVerbMenuA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $lphMenu i32)
    (if (local.get $arg0)
      (then (call $crash_unimplemented (local.get $name_ptr))))
    (local.set $lphMenu (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36))))
    (if (local.get $lphMenu)
      (then (call $gs32 (local.get $lphMenu) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 40)))  ;; 9 args
  )

  ;; ShellAboutW(hwnd, szApp, szOtherStuff, hIcon) — the W twin of
  ;; ShellAboutA, which builds the whole dialog in WAT. This returned TRUE
  ;; without drawing anything, so XP Minesweeper's Help > About Minesweeper...
  ;; reported success and showed nothing.
  ;;
  ;; The narrowed copies are deliberately not freed: $create_about_dialog hands
  ;; the body string straight to a STATIC that keeps the pointer, and these
  ;; heap copies outlive the call in a way the caller's own stack buffers
  ;; (0x080ffc94 in Minesweeper's case) would not.
  (func $handle_ShellAboutW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dlg i32) (local $app i32) (local $other i32)
    (local.set $app (call $atom_narrow_w (local.get $arg1)))
    (if (local.get $arg2)
      (then (local.set $other (call $atom_narrow_w (local.get $arg2)))))
    (if (local.get $app)
      (then
        (local.set $dlg (global.get $next_hwnd))
        (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
        (drop (call $host_shell_about
          (local.get $dlg) (local.get $arg0) (call $g2w (local.get $app))))
        (call $create_about_dialog
          (local.get $dlg) (local.get $arg0) (local.get $app) (local.get $other))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; 467: CommandLineToArgvW — STUB: unimplemented
  (func $handle_CommandLineToArgvW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; CommandLineToArgvW(lpCmdLine, pNumArgs) — parse wide string command line
    ;; Allocate: argv array (1 pointer) + wide string "app\0" (8 bytes)
    (local $buf i32) (local $buf_wa i32)
    (local.set $buf (call $heap_alloc (i32.const 32))) (local.set $buf_wa (call $g2w (local.get $buf)))
    ;; argv[0] = pointer to wide string at buf+8
    (i32.store (local.get $buf_wa) (i32.add (local.get $buf) (i32.const 8)))
    ;; Write L"app\0" at buf+8 (wide: 'a'=0x0061, 'p'=0x0070, 'p'=0x0070, '\0'=0)
    (i32.store offset=8 (local.get $buf_wa) (i32.const 0x00700061))   ;; "ap"
    (i32.store offset=12 (local.get $buf_wa) (i32.const 0x00000070))  ;; "p\0"
    ;; *pNumArgs = 1
    (i32.store (call $g2w (local.get $arg1)) (i32.const 1))
    (i32.store offset=0 (global.get $reg_base) (local.get $buf))  ;; return pointer to argv array
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))  ;; stdcall, 2 args
  )

  ;; --- Additional Shell32 APIs ---

  ;; ShellExecuteW — same as A version, return >32 for success, 6 args
  ;; ShellExecuteW(hwnd, lpOperation, lpFile, lpParameters, lpDirectory, nShow)
  ;; Narrow the four strings and take the same host path as the A form. This
  ;; returned 33 ("succeeded") without looking at a single argument, so a
  ;; Unicode app's shell request vanished with no log and no failure code --
  ;; XP Sound Recorder's Edit > Audio Properties asks for
  ;; RUNDLL32.EXE MMSYS.CPL,ShowAudioPropertySheet here and appeared to do
  ;; nothing at all. Routing it through $host_shell_execute at least makes the
  ;; request observable; what the host does with rundll32 is its business.
  (func $handle_ShellExecuteW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $op i32) (local $file i32) (local $params i32) (local $dir i32)
    (local.set $op    (call $shellexec_narrow_w (local.get $arg1)))
    (local.set $file  (call $shellexec_narrow_w (local.get $arg2)))
    (local.set $params (call $shellexec_narrow_w (local.get $arg3)))
    (local.set $dir   (call $shellexec_narrow_w (local.get $arg4)))
    (i32.store offset=0 (global.get $reg_base) (call $host_shell_execute
      (local.get $arg0)
      (if (result i32) (local.get $op)    (then (call $g2w (local.get $op)))    (else (i32.const 0)))
      (if (result i32) (local.get $file)  (then (call $g2w (local.get $file)))  (else (i32.const 0)))
      (if (result i32) (local.get $params) (then (call $g2w (local.get $params))) (else (i32.const 0)))
      (if (result i32) (local.get $dir)   (then (call $g2w (local.get $dir)))   (else (i32.const 0)))
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))))  ;; nShowCmd
    (if (local.get $op)     (then (call $heap_free (local.get $op))))
    (if (local.get $file)   (then (call $heap_free (local.get $file))))
    (if (local.get $params) (then (call $heap_free (local.get $params))))
    (if (local.get $dir)    (then (call $heap_free (local.get $dir))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
  )

  ;; UTF-16 → a fresh guest ANSI buffer, or 0 for a NULL argument. Caller frees.
  (func $shellexec_narrow_w (param $ws i32) (result i32)
    (local $n i32) (local $buf i32)
    (if (i32.eqz (local.get $ws)) (then (return (i32.const 0))))
    (local.set $n (i32.add (call $guest_wcslen (local.get $ws)) (i32.const 1)))
    (local.set $buf (call $heap_alloc (local.get $n)))
    (if (i32.eqz (local.get $buf)) (then (return (i32.const 0))))
    (drop (call $wide_to_ansi (local.get $ws) (local.get $buf) (local.get $n)))
    (local.get $buf))

  ;; Win32 SHELLEXECUTEINFO is 60 bytes: nShow +28, hInstApp +32,
  ;; hProcess +56. A shell status is not a process handle.
  (func $shell_execute_ex (param $info i32) (param $wide i32) (result i32)
    (local $verb i32) (local $file i32) (local $params i32) (local $dir i32)
    (local $v i32) (local $f i32) (local $p i32) (local $d i32)
    (local $mask i32) (local $status i32) (local $error i32) (local $ok i32)
    (local $launch i32) (local $n i32) (local $plen i32) (local $pid i32)
    (local.set $error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
    (block $done
      (br_if $done (call $ptr_range_access_bad (local.get $info) (i32.const 60) (i32.const 1)))
      (br_if $done (i32.ne (call $gl32 (local.get $info)) (i32.const 60)))
      (call $gs32 (i32.add (local.get $info) (i32.const 56)) (i32.const 0))
      (local.set $mask (call $gl32 (i32.add (local.get $info) (i32.const 4))))
      ;; ID lists/classes need shell namespace support, not an EXE launch.
      (if (i32.and (local.get $mask) (i32.const 0x0f))
        (then
          (call $gs32 (i32.add (local.get $info) (i32.const 32)) (i32.const 31))
          (local.set $error (i32.const 120)) ;; ERROR_CALL_NOT_IMPLEMENTED
          (br $done)))
      (local.set $verb (call $gl32 (i32.add (local.get $info) (i32.const 12))))
      (local.set $file (call $gl32 (i32.add (local.get $info) (i32.const 16))))
      (local.set $params (call $gl32 (i32.add (local.get $info) (i32.const 20))))
      (local.set $dir (call $gl32 (i32.add (local.get $info) (i32.const 24))))
      (if (i32.eqz (local.get $file))
        (then
          (call $gs32 (i32.add (local.get $info) (i32.const 32)) (i32.const 2))
          (local.set $error (i32.const 2))
          (br $done)))
      (local.set $v (local.get $verb)) (local.set $f (local.get $file))
      (local.set $p (local.get $params)) (local.set $d (local.get $dir))
      (if (local.get $wide)
        (then
          (local.set $v (call $shellexec_narrow_w (local.get $verb)))
          (local.set $f (call $shellexec_narrow_w (local.get $file)))
          (local.set $p (call $shellexec_narrow_w (local.get $params)))
          (local.set $d (call $shellexec_narrow_w (local.get $dir)))
          (if (i32.or (i32.eqz (local.get $f))
                (i32.or
                  (i32.and (i32.ne (local.get $verb) (i32.const 0)) (i32.eqz (local.get $v)))
                  (i32.or
                    (i32.and (i32.ne (local.get $params) (i32.const 0)) (i32.eqz (local.get $p)))
                    (i32.and (i32.ne (local.get $dir) (i32.const 0)) (i32.eqz (local.get $d))))))
            (then
              (call $gs32 (i32.add (local.get $info) (i32.const 32)) (i32.const 8))
              (local.set $error (i32.const 8))
              (br $done)))))
      (if (i32.and (local.get $mask) (i32.const 0x40))
        (then
          ;; SEE_MASK_NOCLOSEPROCESS: request a tracked process, irrespective
          ;; of the legacy CreateProcess per-app opt-in. Do not fall back to
          ;; a fire-and-forget shell call when the host cannot create one.
          (if (local.get $v)
            (then
              ;; WAT and is eager: establish the string length before the
              ;; four-byte read, including strings at a mapped-page edge.
              (if (i32.eqz (if (result i32)
                    (i32.eq (call $guest_strlen (local.get $v)) (i32.const 4))
                    (then (i32.eq (i32.or (call $gl32 (local.get $v)) (i32.const 0x20202020)) (i32.const 0x6e65706f)))
                    (else (i32.const 0))))
                (then
                  (call $gs32 (i32.add (local.get $info) (i32.const 32)) (i32.const 31))
                  (local.set $error (i32.const 120))
                  (br $done)))))
          (local.set $n (call $guest_strlen (local.get $f)))
          (if (local.get $p) (then (local.set $plen (call $guest_strlen (local.get $p)))))
          (local.set $launch (call $heap_alloc (i32.add (i32.add (local.get $n) (local.get $plen)) (i32.const 4))))
          (if (i32.eqz (local.get $launch))
            (then
              (call $gs32 (i32.add (local.get $info) (i32.const 32)) (i32.const 8))
              (local.set $error (i32.const 8))
              (br $done)))
          (call $gs8 (local.get $launch) (i32.const 34))
          (call $guest_memmove (i32.add (local.get $launch) (i32.const 1)) (local.get $f) (local.get $n))
          (call $gs8 (i32.add (local.get $launch) (i32.add (local.get $n) (i32.const 1))) (i32.const 34))
          (call $gs8 (i32.add (local.get $launch) (i32.add (local.get $n) (i32.const 2))) (i32.const 32))
          (if (local.get $plen) (then
            (call $guest_memmove (i32.add (local.get $launch) (i32.add (local.get $n) (i32.const 3)))
              (local.get $p) (local.get $plen))))
          (call $gs8 (i32.add (local.get $launch) (i32.add (i32.add (local.get $n) (local.get $plen)) (i32.const 3))) (i32.const 0))
          (local.set $pid (call $host_process_spawn
            (call $g2w (local.get $launch))
            (if (result i32) (local.get $d) (then (call $g2w (local.get $d))) (else (i32.const 0)))
            (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 1)
            (call $gl32 (i32.add (local.get $info) (i32.const 28)))))
          (call $heap_free (local.get $launch))
          (if (local.get $pid)
            (then
              (call $gs32 (i32.add (local.get $info) (i32.const 56)) (call $pipe_child_process_handle (local.get $pid)))
              (local.set $status (i32.const 33)))
            (else (local.set $status (i32.const 2)))))
        (else (local.set $status (call $host_shell_execute
        (call $gl32 (i32.add (local.get $info) (i32.const 8)))
        (if (result i32) (local.get $v) (then (call $g2w (local.get $v))) (else (i32.const 0)))
        (call $g2w (local.get $f))
        (if (result i32) (local.get $p) (then (call $g2w (local.get $p))) (else (i32.const 0)))
        (if (result i32) (local.get $d) (then (call $g2w (local.get $d))) (else (i32.const 0)))
        (call $gl32 (i32.add (local.get $info) (i32.const 28)))))))
      (call $gs32 (i32.add (local.get $info) (i32.const 32)) (local.get $status))
      (local.set $ok (i32.gt_u (local.get $status) (i32.const 32)))
      (local.set $error (if (result i32) (local.get $ok) (then (i32.const 0))
        (else (if (result i32) (local.get $status) (then (local.get $status)) (else (i32.const 8)))))))
    (if (local.get $wide)
      (then
        (if (local.get $v) (then (call $heap_free (local.get $v))))
        (if (local.get $f) (then (call $heap_free (local.get $f))))
        (if (local.get $p) (then (call $heap_free (local.get $p))))
        (if (local.get $d) (then (call $heap_free (local.get $d))))))
    (global.set $last_error (local.get $error))
    (local.get $ok))

  ;; ShellExecuteExA(lpExecInfo) — 1 stdcall argument.
  (func $handle_ShellExecuteExA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $shell_execute_ex (local.get $arg0) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; ShellExecuteExW has the same fixed-width SHELLEXECUTEINFO layout. The
  ;; string fields point to UTF-16 input and must be narrowed for the host.
  (func $handle_ShellExecuteExW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $shell_execute_ex (local.get $arg0) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; DragQueryFileW — same HDROP, Unicode destination.
  (func $handle_DragQueryFileW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $drop_query_file
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)
      (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; Bounded ANSI/UTF-16 copy. $capacity is the actual byte extent remaining
  ;; in the caller's SHFILEINFO, not merely the public array's nominal size.
  (func $sh_copy_string_bounded
      (param $src i32) (param $dst i32) (param $capacity i32)
      (param $src_wide i32) (param $dst_wide i32)
    (local $src_step i32) (local $dst_step i32) (local $max i32)
    (local $count i32) (local $ch i32)
    (local.set $src_step (select (i32.const 2) (i32.const 1) (local.get $src_wide)))
    (local.set $dst_step (select (i32.const 2) (i32.const 1) (local.get $dst_wide)))
    (local.set $max (i32.div_u (local.get $capacity) (local.get $dst_step)))
    (if (i32.eqz (local.get $max)) (then (return)))
    (block $done (loop $copy
      (br_if $done (i32.ge_u (i32.add (local.get $count) (i32.const 1)) (local.get $max)))
      (local.set $ch (call $load_char (local.get $src) (local.get $src_wide)))
      (br_if $done (i32.eqz (local.get $ch)))
      (if (local.get $dst_wide)
        (then (i32.store16
          (i32.add (local.get $dst) (i32.shl (local.get $count) (i32.const 1)))
          (local.get $ch)))
        (else (i32.store8 (i32.add (local.get $dst) (local.get $count)) (local.get $ch))))
      (local.set $src (i32.add (local.get $src) (local.get $src_step)))
      (local.set $count (i32.add (local.get $count) (i32.const 1)))
      (br $copy)))
    (if (local.get $dst_wide)
      (then (i32.store16
        (i32.add (local.get $dst) (i32.shl (local.get $count) (i32.const 1))) (i32.const 0)))
      (else (i32.store8 (i32.add (local.get $dst) (local.get $count)) (i32.const 0)))))

  (func $sh_path_basename (param $path i32) (param $wide i32) (result i32)
    (local $step i32) (local $scan i32) (local $base i32) (local $ch i32)
    (local.set $step (select (i32.const 2) (i32.const 1) (local.get $wide)))
    (local.set $scan (local.get $path))
    (local.set $base (local.get $path))
    (block $done (loop $chars
      (local.set $ch (call $load_char (local.get $scan) (local.get $wide)))
      (br_if $done (i32.eqz (local.get $ch)))
      ;; Keep the full root name for a trailing separator (not an empty base).
      (if (i32.and
            (i32.or (i32.eq (local.get $ch) (i32.const 47))
                    (i32.eq (local.get $ch) (i32.const 92)))
            (i32.ne (call $load_char
              (i32.add (local.get $scan) (local.get $step)) (local.get $wide)) (i32.const 0)))
        (then (local.set $base (i32.add (local.get $scan) (local.get $step)))))
      (local.set $scan (i32.add (local.get $scan) (local.get $step)))
      (br $chars)))
    (local.get $base))

  ;; Lower-case three-character extension packed little-endian, or zero.
  (func $sh_path_extension3 (param $path i32) (param $wide i32) (result i32)
    (local $step i32) (local $scan i32) (local $dot i32) (local $ch i32)
    (local $a i32) (local $b i32) (local $c i32)
    (local.set $step (select (i32.const 2) (i32.const 1) (local.get $wide)))
    (local.set $scan (local.get $path))
    (block $done (loop $chars
      (local.set $ch (call $load_char (local.get $scan) (local.get $wide)))
      (br_if $done (i32.eqz (local.get $ch)))
      (if (i32.or (i32.eq (local.get $ch) (i32.const 47))
                  (i32.eq (local.get $ch) (i32.const 92)))
        (then (local.set $dot (i32.const 0)))
        (else (if (i32.eq (local.get $ch) (i32.const 46))
          (then (local.set $dot (local.get $scan))))))
      (local.set $scan (i32.add (local.get $scan) (local.get $step)))
      (br $chars)))
    (if (i32.eqz (local.get $dot)) (then (return (i32.const 0))))
    (local.set $a (i32.or (call $load_char
      (i32.add (local.get $dot) (local.get $step)) (local.get $wide)) (i32.const 0x20)))
    (local.set $b (i32.or (call $load_char
      (i32.add (local.get $dot) (i32.mul (local.get $step) (i32.const 2)))
      (local.get $wide)) (i32.const 0x20)))
    (local.set $c (i32.or (call $load_char
      (i32.add (local.get $dot) (i32.mul (local.get $step) (i32.const 3)))
      (local.get $wide)) (i32.const 0x20)))
    (if (i32.ne (call $load_char
          (i32.add (local.get $dot) (i32.mul (local.get $step) (i32.const 4)))
          (local.get $wide)) (i32.const 0))
      (then (return (i32.const 0))))
    (i32.or (local.get $a)
      (i32.or (i32.shl (local.get $b) (i32.const 8))
              (i32.shl (local.get $c) (i32.const 16)))))

  ;; System-list indices used by the Win98-era shell clients in the corpus:
  ;; 0 open folder, 1 closed folder, 2 document, 3 application, 4 drive.
  (func $sh_file_icon_class
      (param $path i32) (param $attrs i32) (param $flags i32) (param $wide i32)
      (result i32)
    (local $step i32) (local $c0 i32) (local $c1 i32) (local $c2 i32) (local $ext i32)
    (if (local.get $path)
      (then
        (local.set $step (select (i32.const 2) (i32.const 1) (local.get $wide)))
        (local.set $c0 (i32.or (call $load_char (local.get $path) (local.get $wide))
          (i32.const 0x20)))
        (local.set $c1 (call $load_char
          (i32.add (local.get $path) (local.get $step)) (local.get $wide)))
        (local.set $c2 (call $load_char
          (i32.add (local.get $path) (i32.shl (local.get $step) (i32.const 1)))
          (local.get $wide)))
        (if (i32.and
              (i32.and (i32.ge_u (local.get $c0) (i32.const 0x61))
                       (i32.le_u (local.get $c0) (i32.const 0x7A)))
              (i32.and (i32.eq (local.get $c1) (i32.const 58))
                (i32.or (i32.eqz (local.get $c2))
                  (i32.and
                    (i32.or (i32.eq (local.get $c2) (i32.const 47))
                            (i32.eq (local.get $c2) (i32.const 92)))
                    (i32.eqz (call $load_char
                      (i32.add (local.get $path) (i32.mul (local.get $step) (i32.const 3)))
                      (local.get $wide)))))))
          (then (return (i32.const 4))))))
    (if (i32.ne (i32.and (local.get $attrs) (i32.const 0x10)) (i32.const 0))
      (then (return (select (i32.const 0) (i32.const 1)
        (i32.ne (i32.and (local.get $flags) (i32.const 2)) (i32.const 0))))))
    (if (local.get $path)
      (then
        (local.set $ext (call $sh_path_extension3 (local.get $path) (local.get $wide)))
        (if (i32.or
              (i32.or (i32.eq (local.get $ext) (i32.const 0x657865))
                      (i32.eq (local.get $ext) (i32.const 0x6D6F63)))
              (i32.or
                (i32.or (i32.eq (local.get $ext) (i32.const 0x746162))
                        (i32.eq (local.get $ext) (i32.const 0x6C6C64)))
                (i32.or
                  (i32.or (i32.eq (local.get $ext) (i32.const 0x726373))
                          (i32.eq (local.get $ext) (i32.const 0x666970)))
                  (i32.eq (local.get $ext) (i32.const 0x6C7063)))))
          (then (return (i32.const 3))))))
    (i32.const 2))

  (func $sh_file_info_copy_literal
      (param $source_offset i32) (param $dst i32) (param $capacity i32) (param $wide i32)
    (call $sh_copy_string_bounded
      (i32.add (global.get $SHELL_FILE_INFO) (local.get $source_offset))
      (local.get $dst) (local.get $capacity) (i32.const 0) (local.get $wide)))

  ;; Translate the file-system facts available to this shell into the
  ;; IShellFolder SFGAO_* namespace required by SHGFI_ATTRIBUTES.  These are
  ;; deliberately not FILE_ATTRIBUTE_* values: the two flag families overlap
  ;; numerically but describe different contracts.
  (func $sh_file_sfgao (param $path i32) (param $attrs i32) (result i32)
    (local $result i32)
    (if (local.get $path)
      (then
        ;; CANCOPY | CANMOVE | CANLINK | CANRENAME | CANDELETE |
        ;; HASPROPSHEET | DROPTARGET | FILESYSTEM.
        (local.set $result (i32.const 0x40000177)))
      (else
        ;; Opaque shell namespace roots are folders and drop targets, but are
        ;; not themselves Win32 file-system paths.
        (local.set $result (i32.const 0x20000100))))
    (if (i32.ne (i32.and (local.get $attrs) (i32.const 0x10)) (i32.const 0))
      (then
        ;; FILESYSANCESTOR | FOLDER. HASSUBFOLDER is intentionally omitted:
        ;; determining it requires enumerating the directory.
        (local.set $result (i32.or (local.get $result) (i32.const 0x30000000)))))
    (if (i32.ne (i32.and (local.get $attrs) (i32.const 2)) (i32.const 0))
      (then (local.set $result (i32.or (local.get $result) (i32.const 0x00080000)))))
    (local.get $result))

  ;; Shared A/W implementation for Win98's SHFILEINFO fields and per-process
  ;; system image list.  PIDLs remain opaque except for this shell's WAFP/WAVP
  ;; formats, so foreign namespace items are safely classified as folders.
  (func $sh_get_file_info
      (param $path_guest i32) (param $attrs_arg i32) (param $psfi_guest i32)
      (param $cb i32) (param $flags i32) (param $wide i32) (result i32)
    (local $path i32) (local $pidl i32) (local $psfi i32)
    (local $attrs i32) (local $class i32) (local $tag i32) (local $csidl i32)
    (local $step i32) (local $path_wide i32)
    (local $field_offset i32) (local $field_capacity i32)
    (local $source_offset i32) (local $list i32) (local $shell_attrs i32)
    (local $icon i32) (local $icon_size i32)
    (if (i32.eqz (local.get $psfi_guest)) (then (return (i32.const 0))))
    (if (i32.and (i32.eqz (local.get $path_guest))
                 (i32.eqz (i32.and (local.get $flags) (i32.const 8))))
      (then (return (i32.const 0))))
    (local.set $psfi (call $g2w (local.get $psfi_guest)))
    (local.set $step (select (i32.const 2) (i32.const 1) (local.get $wide)))
    (if (i32.ne (i32.and (local.get $flags) (i32.const 8)) (i32.const 0))
      (then
        (if (local.get $path_guest)
          (then
            (local.set $pidl (call $g2w (local.get $path_guest)))
            (local.set $tag (i32.load offset=2 align=1 (local.get $pidl)))
            (if (i32.and (i32.eq (local.get $tag) (i32.const 0x50464157))
                  (i32.and (i32.ge_u (i32.load16_u (local.get $pidl)) (i32.const 8))
                           (i32.le_u (i32.load16_u (local.get $pidl)) (i32.const 266))))
              (then
                ;; ITEMIDLIST bytes do not change with the A/W entry point;
                ;; this shell's WAFP provider payload is explicitly ANSI.
                (local.set $path (i32.add (local.get $pidl) (i32.const 6)))
                (local.set $path_wide (i32.const 0)))
              (else (if (i32.and (i32.eq (local.get $tag) (i32.const 0x50564157))
                                  (i32.eq (i32.load16_u (local.get $pidl)) (i32.const 10)))
                (then (local.set $csidl (i32.load offset=6 align=1 (local.get $pidl))))))))))
      (else
        (local.set $path (call $g2w (local.get $path_guest)))
        (local.set $path_wide (local.get $wide))))
    (if (i32.ne (i32.and (local.get $flags) (i32.const 0x10)) (i32.const 0))
      (then (local.set $attrs (local.get $attrs_arg)))
      (else
        (if (local.get $path)
          (then
            (local.set $attrs (call $host_fs_get_file_attributes
              (local.get $path) (local.get $path_wide)))
            (if (i32.eq (local.get $attrs) (i32.const -1))
              (then (return (i32.const 0)))))
          (else (local.set $attrs (i32.const 0x10))))))
    (local.set $class
      (if (result i32) (i32.eq (local.get $csidl) (i32.const 0x11))
        (then (i32.const 4))
        (else (call $sh_file_icon_class
          (local.get $path) (local.get $attrs) (local.get $flags) (local.get $path_wide)))))

    (if (i32.and (i32.ne (i32.and (local.get $flags) (i32.const 0x800)) (i32.const 0))
                 (i32.ge_u (local.get $cb) (i32.const 12)))
      (then
        (local.set $shell_attrs
          (call $sh_file_sfgao (local.get $path) (local.get $attrs)))
        ;; SHGFI_ATTR_SPECIFIED makes the incoming dwAttributes an SFGAO mask.
        (if (i32.ne (i32.and (local.get $flags) (i32.const 0x20000)) (i32.const 0))
          (then (local.set $shell_attrs (i32.and (local.get $shell_attrs)
            (i32.load offset=8 (local.get $psfi))))))
        (i32.store offset=8 (local.get $psfi) (local.get $shell_attrs))))
    (if (i32.and (i32.ne (i32.and (local.get $flags) (i32.const 0x200)) (i32.const 0))
                 (i32.gt_u (local.get $cb) (i32.const 12)))
      (then
        (local.set $field_capacity (i32.sub (local.get $cb) (i32.const 12)))
        (if (i32.gt_u (local.get $field_capacity) (i32.mul (i32.const 260) (local.get $step)))
          (then (local.set $field_capacity (i32.mul (i32.const 260) (local.get $step)))))
        (if (local.get $path)
          (then (call $sh_copy_string_bounded
            (call $sh_path_basename (local.get $path) (local.get $path_wide))
            (i32.add (local.get $psfi) (i32.const 12)) (local.get $field_capacity)
            (local.get $path_wide) (local.get $wide)))
          (else
            (local.set $source_offset
              (if (result i32) (i32.eq (local.get $csidl) (i32.const 0x11))
                (then (i32.const 0x50))
                (else (select (i32.const 0x5C) (i32.const 0x48)
                  (i32.eq (local.get $csidl) (i32.const 0x12))))))
            (call $sh_file_info_copy_literal (local.get $source_offset)
              (i32.add (local.get $psfi) (i32.const 12))
              (local.get $field_capacity) (local.get $wide))))))
    (if (i32.ne (i32.and (local.get $flags) (i32.const 0x400)) (i32.const 0))
      (then
        (local.set $field_offset (select (i32.const 532) (i32.const 272) (local.get $wide)))
        (if (i32.gt_u (local.get $cb) (local.get $field_offset))
          (then
            (local.set $field_capacity (i32.sub (local.get $cb) (local.get $field_offset)))
            (if (i32.gt_u (local.get $field_capacity) (i32.mul (i32.const 80) (local.get $step)))
              (then (local.set $field_capacity (i32.mul (i32.const 80) (local.get $step)))))
            (local.set $source_offset
              (if (result i32) (i32.eq (local.get $class) (i32.const 3))
                (then (i32.const 0x31))
                (else (if (result i32) (i32.eq (local.get $class) (i32.const 4))
                  (then (i32.const 0x3D))
                  (else (select (i32.const 0x25) (i32.const 0x20)
                    (i32.or (i32.eqz (local.get $class))
                            (i32.eq (local.get $class) (i32.const 1)))))))))
            (call $sh_file_info_copy_literal (local.get $source_offset)
              (i32.add (local.get $psfi) (local.get $field_offset))
              (local.get $field_capacity) (local.get $wide))))))
    ;; SHGFI_ICON and SHGFI_SYSICONINDEX both publish the system image index.
    ;; SHGFI_ICON additionally returns an independently owned HICON in hIcon;
    ;; unlike the system HIMAGELIST, the caller must release it with
    ;; DestroyIcon.  Require both leading fields to fit before promising that
    ;; result instead of silently succeeding with a partial SHFILEINFO.
    (if (i32.ne (i32.and (local.get $flags) (i32.const 0x4100)) (i32.const 0))
      (then
        (if (i32.lt_u (local.get $cb) (i32.const 8))
          (then (return (i32.const 0))))
        (i32.store offset=4 (local.get $psfi) (local.get $class))))
    (if (i32.ne (i32.and (local.get $flags) (i32.const 0x100)) (i32.const 0))
      (then
        (local.set $icon_size
          (select (i32.const 16) (i32.const 32)
            (i32.ne (i32.and (local.get $flags) (i32.const 1)) (i32.const 0))))
        (local.set $list (call $shell_system_image_list (local.get $icon_size)))
        (if (i32.eqz (local.get $list)) (then (return (i32.const 0))))
        (local.set $icon
          (call $image_list_icon_handle (local.get $list) (local.get $class)))
        (if (i32.eqz (local.get $icon)) (then (return (i32.const 0))))
        (i32.store (local.get $psfi) (local.get $icon))))
    (if (i32.ne (i32.and (local.get $flags) (i32.const 0x4000)) (i32.const 0))
      (then
        (if (i32.eqz (local.get $list))
          (then (local.set $list (call $shell_system_image_list
            (select (i32.const 16) (i32.const 32)
              (i32.ne (i32.and (local.get $flags) (i32.const 1)) (i32.const 0)))))))
        (if (i32.eqz (local.get $list))
          (then
            (if (local.get $icon)
              (then
                (drop (call $icon_destroy_handle (local.get $icon)))
                (i32.store (local.get $psfi) (i32.const 0))))))
        (return (local.get $list))))
    (i32.const 1))

  ;; SHGetFileInfoW(pszPath, attrs, psfi, cb, flags). Media Player asks for
  ;; DISPLAYNAME; WinRAR also asks for the shared system image list.
  (func $handle_SHGetFileInfoW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $sh_get_file_info
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
  )

  (func $extract_icon_ex (param $file i32) (param $index i32)
        (param $large_out i32) (param $small_out i32) (param $requested i32)
        (param $wide i32) (result i32)
    (local $count i32) (local $limit i32) (local $buffer i32)
    (local $i i32) (local $current i32) (local $large i32) (local $small i32)
    (local $extracted i32) (local $error i32)
    (local.set $count (call $host_shell_extract_icon_resource
      (call $g2w (local.get $file)) (local.get $wide) (local.get $index)
      (i32.const 0) (i32.const 0) (i32.const 0)))
    (if (i32.lt_s (local.get $count) (i32.const 0))
      (then
        ;; The count-only spelling returns zero for a missing/bad container;
        ;; extraction reports UINT_MAX and publishes the host's Win32 error.
        (if (i32.and (i32.eq (local.get $index) (i32.const -1))
              (i32.and (i32.eqz (local.get $large_out))
                (i32.eqz (local.get $small_out))))
          (then (return (i32.const 0))))
        (global.set $last_error (i32.sub (i32.const 0) (local.get $count)))
        (return (i32.const -1))))
    (if (i32.and (i32.eq (local.get $index) (i32.const -1))
          (i32.and (i32.eqz (local.get $large_out))
            (i32.eqz (local.get $small_out))))
      (then (return (local.get $count))))
    (if (i32.or (i32.eqz (local.get $requested))
          (i32.and (i32.eqz (local.get $large_out))
            (i32.eqz (local.get $small_out))))
      (then (return (i32.const 0))))
    (if (i32.lt_s (local.get $index) (i32.const 0))
      (then (local.set $limit (select (i32.const 1) (local.get $requested)
        (i32.gt_u (local.get $requested) (i32.const 1)))))
      (else
        (if (i32.ge_u (local.get $index) (local.get $count))
          (then (return (i32.const 0))))
        (local.set $limit (i32.sub (local.get $count) (local.get $index)))
        (if (i32.gt_u (local.get $limit) (local.get $requested))
          (then (local.set $limit (local.get $requested))))))
    (local.set $buffer (call $heap_alloc (global.get $EXTRACT_ICON_RESOURCE_CAPACITY)))
    (if (i32.eqz (local.get $buffer))
      (then
        (global.set $last_error (i32.const 8))
        (return (i32.const -1))))
    (block $done (loop $icons
      (br_if $done (i32.ge_u (local.get $i) (local.get $limit)))
      (local.set $current (select (local.get $index)
        (i32.add (local.get $index) (local.get $i))
        (i32.lt_s (local.get $index) (i32.const 0))))
      (local.set $large (i32.const 0))
      (local.set $small (i32.const 0))
      (if (local.get $large_out)
        (then
          (call $gs32 (i32.add (local.get $large_out)
            (i32.shl (local.get $i) (i32.const 2))) (i32.const 0))
          (local.set $large (call $extract_icon_resource_handle
            (local.get $file) (local.get $current) (local.get $wide)
            (i32.const 32) (local.get $buffer)))
          (if (i32.lt_s (local.get $large) (i32.const 0))
            (then (local.set $error (local.get $large)) (br $done)))
          (call $gs32 (i32.add (local.get $large_out)
            (i32.shl (local.get $i) (i32.const 2))) (local.get $large))))
      (if (local.get $small_out)
        (then
          (call $gs32 (i32.add (local.get $small_out)
            (i32.shl (local.get $i) (i32.const 2))) (i32.const 0))
          (local.set $small (call $extract_icon_resource_handle
            (local.get $file) (local.get $current) (local.get $wide)
            (i32.const 16) (local.get $buffer)))
          (if (i32.lt_s (local.get $small) (i32.const 0))
            (then
              ;; Do not strand the large icon if the parallel small-image
              ;; selection fails after it was already materialized.
              (if (local.get $large)
                (then
                  (drop (call $icon_destroy_handle (local.get $large)))
                  (call $gs32 (i32.add (local.get $large_out)
                    (i32.shl (local.get $i) (i32.const 2))) (i32.const 0))))
              (local.set $error (local.get $small))
              (br $done)))
          (call $gs32 (i32.add (local.get $small_out)
            (i32.shl (local.get $i) (i32.const 2))) (local.get $small))))
      (br_if $done (i32.eqz (i32.or (local.get $large) (local.get $small))))
      (local.set $extracted (i32.add (local.get $extracted) (i32.const 1)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $icons)))
    (call $heap_free (local.get $buffer))
    (if (local.get $error)
      (then
        (global.set $last_error (i32.sub (i32.const 0) (local.get $error)))
        (return (i32.const -1))))
    (local.get $extracted))

  ;; ExtractIconExA creates parallel arrays of private 32x32 and 16x16 icons.
  (func $handle_ExtractIconExA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $extract_icon_ex
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  ;; ExtractIconExW uses the same resource/lifetime path over a UTF-16 name.
  (func $handle_ExtractIconExW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $extract_icon_ex
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  ;; The GOG ScummVM executable links WinSparkle's updater API directly. The
  ;; emulator has no updater/network service, so expose one coherent disabled
  ;; state: mutators and lifecycle/manual-check calls are no-ops, while every
  ;; getter reports off/never. WinSparkle is cdecl on 32-bit Windows, therefore
  ;; these handlers consume only the thunk return address and leave arguments
  ;; in the caller's preallocated outgoing area.
  (func $handle_win_sparkle_check_update_with_ui (param i32 i32 i32 i32 i32 i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))
  (func $handle_win_sparkle_get_last_check_time (param i32 i32 i32 i32 i32 i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))
  (func $handle_win_sparkle_get_update_check_interval (param i32 i32 i32 i32 i32 i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))
  (func $handle_win_sparkle_set_update_check_interval (param i32 i32 i32 i32 i32 i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))
  (func $handle_win_sparkle_get_automatic_check_for_updates (param i32 i32 i32 i32 i32 i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))
  (func $handle_win_sparkle_set_automatic_check_for_updates (param i32 i32 i32 i32 i32 i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))
  (func $handle_win_sparkle_set_appcast_url (param i32 i32 i32 i32 i32 i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))
  (func $handle_win_sparkle_cleanup (param i32 i32 i32 i32 i32 i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))
  (func $handle_win_sparkle_init (param i32 i32 i32 i32 i32 i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  ;; Shell_NotifyIconA(dwMessage, lpData) — Win98 notification-area icon.
  ;; The v4 shell identifies an icon by (hWnd,uID) and consumes the original
  ;; 64-byte ANSI tooltip. Newer balloon/GUID/version fields are intentionally
  ;; outside the Win98 contract; accepting a larger cbSize is harmless because
  ;; only the common prefix is read.
  (func $handle_Shell_NotifyIconA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $nid i32) (local $cb i32)
    (if (i32.or (i32.eqz (local.get $arg1))
                (i32.gt_u (local.get $arg0) (i32.const 2)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (local.set $nid (call $g2w (local.get $arg1)))
    (local.set $cb (i32.load (local.get $nid)))
    ;; Win95/98 NOTIFYICONDATAA is 88 bytes, including its 64-byte ANSI
    ;; tooltip. cbSize names the structure version the caller supplied, not
    ;; merely the fields a particular NIM_* operation happens to consume.
    (if (i32.or (i32.lt_u (local.get $cb) (i32.const 88))
                (i32.eqz (call $wnd_table_get (i32.load offset=4 (local.get $nid)))))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (i32.store offset=0 (global.get $reg_base) (call $host_notify_icon
      (local.get $arg0)
      (i32.load offset=4 (local.get $nid))
      (i32.load offset=8 (local.get $nid))
      (i32.load offset=12 (local.get $nid))
      (i32.load offset=16 (local.get $nid))
      (i32.load offset=20 (local.get $nid))
      (i32.add (local.get $nid) (i32.const 24))
      (i32.const 64)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; SHBrowseForFolderA(lpbi) — classic Win98 filesystem/namespace picker.
  ;; The selected HTREEITEM crosses the shared modal boundary; the owner-side
  ;; finish path converts it to a task-allocator PIDL and fills pszDisplayName.
  (func $handle_SHBrowseForFolderA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dlg i32) (local $owner i32)
    (if (i32.eqz (local.get $arg0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (call $modal_capture_nonvolatile)
    (local.set $dlg (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (local.set $owner (call $gl32 (local.get $arg0))) ;; BROWSEINFO.hwndOwner
    (call $create_browse_dialog
      (local.get $dlg) (local.get $owner) (local.get $arg0))
    (call $modal_begin (local.get $dlg) (i32.const 8))
  )

  ;; SHGetMalloc(ppMalloc) — the shell allocator is the task's OLE allocator.
  ;; Explorer-era applications use it to release PIDLs returned by shell APIs;
  ;; returning E_NOTIMPL with a null output leaves callers such as WinRAR with
  ;; no IMalloc::Free target after a successful SHGetSpecialFolderLocation.
  (func $handle_SHGetMalloc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $obj_guest i32)
    (if (i32.eqz (local.get $arg0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)) ;; E_POINTER
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (local.set $obj_guest
      (call $dx_create_com_obj (i32.const 30) (global.get $DX_VTBL_IMALLOC)))
    (if (i32.eqz (local.get $obj_guest))
      (then
        (call $gs32 (local.get $arg0) (i32.const 0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000E))) ;; E_OUTOFMEMORY
      (else
        (call $gs32 (local.get $arg0) (local.get $obj_guest))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; SHFileOperationA(lpFileOp) — Win98 shell copy/move/delete/rename over the
  ;; VFS. pFrom/pTo are double-NUL PCZZSTR lists; the host owns filesystem tree
  ;; mutation while this boundary owns the documented in/out structure fields.
  (func $handle_SHFileOperationA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $file_op i32) (local $from i32) (local $to i32)
    (local $from_wa i32) (local $to_wa i32)
    (if (i32.eqz (local.get $arg0))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x7C))) ;; DE_INVALIDFILES
      (else
        (local.set $file_op (call $g2w (local.get $arg0)))
        (local.set $from (i32.load offset=8 (local.get $file_op)))
        (local.set $to (i32.load offset=12 (local.get $file_op)))
        (i32.store offset=20 (local.get $file_op) (i32.const 0)) ;; not aborted
        (i32.store offset=24 (local.get $file_op) (i32.const 0)) ;; no mappings
        (if (i32.eqz (local.get $from))
          (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x7C)))
          (else
            (local.set $from_wa (call $g2w (local.get $from)))
            (if (local.get $to)
              (then (local.set $to_wa (call $g2w (local.get $to)))))
            (i32.store offset=0 (global.get $reg_base) (call $host_fs_shell_file_operation
              (local.get $from_wa) (local.get $to_wa)
              (i32.load offset=4 (local.get $file_op))
              (i32.load16_u offset=16 (local.get $file_op))))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; RunFileDlg(hwndOwner, hIcon, lpszDir, lpszTitle, lpszDesc, uFlags)
  ;; SHELL32 ordinal 61 — Task Manager's File > Run Application...
  ;;
  ;; Six arguments, not five: taskman pushes hwnd, 0, 0, &title, 0, 0 at
  ;; 0x402b9c..0x402ba4. The old stub popped five and left a dword of the
  ;; caller's frame on the stack every time it was called.
  ;;
  ;; The dialog is the shell's, so it is built here rather than by the app --
  ;; the caller supplies at most a title and a prompt.
  (func $handle_RunFileDlg (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dlg i32)
    (local.set $dlg (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (call $create_run_dialog
      (local.get $dlg) (local.get $arg0) (local.get $arg3) (local.get $arg4))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))  ;; 6 args + ret
  )

  ;; ExitWindowsDialog(hwndOwner) — SHELL32 ordinal 60, Task Manager's
  ;; File > Shutdown Windows... The dialog's OK hands the chosen option to
  ;; $host_exit_windows (09c3-controls.wat) and this process quits.
  (func $handle_ExitWindowsDialog (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dlg i32)
    (local.set $dlg (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (call $create_shutdown_dialog (local.get $dlg) (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; ExitWindowsEx(uFlags, dwReserved) — the programmatic Shut Down. The
  ;; flags word names what the machine does next: EWX_REBOOT (2) restarts,
  ;; EWX_SHUTDOWN (1) / EWX_POWEROFF (8) power it off, and a bare EWX_LOGOFF
  ;; (0) only ends the session. EWX_FORCE (4) changes how apps are asked, not
  ;; what happens, so it is not consulted. The host owns the box; this
  ;; process quits the way every process does when Windows goes down.
  (func $handle_ExitWindowsEx (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $mode i32)
    (local.set $mode (i32.const 3))                        ;; log off
    (if (i32.and (local.get $arg0) (i32.const 0x9))        ;; EWX_SHUTDOWN | EWX_POWEROFF
      (then (local.set $mode (i32.const 1))))
    (if (i32.and (local.get $arg0) (i32.const 0x2))        ;; EWX_REBOOT
      (then (local.set $mode (i32.const 2))))
    (drop (call $host_exit_windows (local.get $mode)))
    (global.set $quit_flag (i32.const 1))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; Return the modifiers that are physically down in the emulated desktop.
  ;; The registered virtual key itself is not also counted as a modifier, so a
  ;; bare VK_SHIFT registration can fire when Shift is pressed.
  (func $hotkey_current_modifiers (param $vk i32) (result i32)
    (local $mods i32)
    (if (i32.and
          (i32.ne (local.get $vk) (i32.const 0x12))
          (i32.ne
            (i32.and (call $host_get_key_down_state (i32.const 0x12)) (i32.const 0x8000))
            (i32.const 0)))
      (then (local.set $mods (i32.or (local.get $mods) (i32.const 0x01))))) ;; MOD_ALT
    (if (i32.and
          (i32.ne (local.get $vk) (i32.const 0x11))
          (i32.ne
            (i32.and (call $host_get_key_down_state (i32.const 0x11)) (i32.const 0x8000))
            (i32.const 0)))
      (then (local.set $mods (i32.or (local.get $mods) (i32.const 0x02))))) ;; MOD_CONTROL
    (if (i32.and
          (i32.ne (local.get $vk) (i32.const 0x10))
          (i32.ne
            (i32.and (call $host_get_key_down_state (i32.const 0x10)) (i32.const 0x8000))
            (i32.const 0)))
      (then (local.set $mods (i32.or (local.get $mods) (i32.const 0x04))))) ;; MOD_SHIFT
    (if (i32.and
          (i32.and (i32.ne (local.get $vk) (i32.const 0x5B))
                   (i32.ne (local.get $vk) (i32.const 0x5C)))
          (i32.or
            (i32.ne
              (i32.and (call $host_get_key_down_state (i32.const 0x5B)) (i32.const 0x8000))
              (i32.const 0))
            (i32.ne
              (i32.and (call $host_get_key_down_state (i32.const 0x5C)) (i32.const 0x8000))
              (i32.const 0))))
      (then (local.set $mods (i32.or (local.get $mods) (i32.const 0x08))))) ;; MOD_WIN
    (local.get $mods))

  ;; Match only hardware key-downs. The caller substitutes WM_HOTKEY for the
  ;; raw key message before applying PeekMessage's message-range filter.
  (func $hotkey_match (param $msg i32) (param $vk i32) (result i32)
    (local $node i32) (local $mods i32)
    (if (i32.and
          (i32.ne (local.get $msg) (i32.const 0x0100)) ;; WM_KEYDOWN
          (i32.ne (local.get $msg) (i32.const 0x0104))) ;; WM_SYSKEYDOWN
      (then (return (i32.const 0))))
    (local.set $mods (call $hotkey_current_modifiers (local.get $vk)))
    (local.set $node (global.get $hotkey_head))
    (block $done
      (loop $scan
        (br_if $done (i32.eqz (local.get $node)))
        (if (i32.and
              (i32.eq (call $gl32 (i32.add (local.get $node) (i32.const 12))) (local.get $mods))
              (i32.eq (call $gl32 (i32.add (local.get $node) (i32.const 16))) (local.get $vk)))
          (then (return (local.get $node))))
        (local.set $node (call $gl32 (local.get $node)))
        (br $scan)))
    (i32.const 0))

  ;; Write one MSG from a matched node. WM_HOTKEY uses the registration id as
  ;; wParam and MAKELONG(modifiers, vk) as lParam; hwnd remains NULL for a
  ;; thread registration instead of being rewritten to the main window.
  (func $hotkey_store_message (param $msg_ptr i32) (param $node i32)
    (local $hwnd i32) (local $lparam i32)
    (local.set $hwnd (call $gl32 (i32.add (local.get $node) (i32.const 4))))
    (local.set $lparam
      (i32.or
        (call $gl32 (i32.add (local.get $node) (i32.const 12)))
        (i32.shl
          (call $gl32 (i32.add (local.get $node) (i32.const 16)))
          (i32.const 16))))
    (call $gs32 (local.get $msg_ptr) (local.get $hwnd))
    (call $gs32 (i32.add (local.get $msg_ptr) (i32.const 4)) (i32.const 0x0312))
    (call $gs32 (i32.add (local.get $msg_ptr) (i32.const 8))
      (call $gl32 (i32.add (local.get $node) (i32.const 8))))
    (call $gs32 (i32.add (local.get $msg_ptr) (i32.const 12)) (local.get $lparam))
    (call $msg_store_input_tail
      (local.get $msg_ptr) (local.get $hwnd) (i32.const 0x0312) (local.get $lparam)))

  ;; RegisterHotKey(hwnd, id, modifiers, vk) / UnregisterHotKey(hwnd, id).
  ;; Registrations live in the registering guest thread's emulated desktop,
  ;; never the host OS, so browser shortcuts are not stolen. Explorer's Win-key
  ;; bindings and ordinary utility shortcuts still receive authentic messages.
  (func $handle_RegisterHotKey (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $node i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))

    ;; Win98 recognizes only MOD_ALT/CONTROL/SHIFT/WIN. MOD_NOREPEAT is a much
    ;; later addition and is deliberately rejected rather than silently used.
    (if (i32.or
          (i32.or (i32.eqz (local.get $arg3))
                  (i32.gt_u (local.get $arg3) (i32.const 0xFF)))
          (i32.ne (i32.and (local.get $arg2) (i32.const 0xFFFFFFF0)) (i32.const 0)))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (if (local.get $arg0)
      (then
        (if (i32.lt_s (call $wnd_table_find (local.get $arg0)) (i32.const 0))
          (then
            (global.set $last_error (i32.const 1400)) ;; ERROR_INVALID_WINDOW_HANDLE
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (return)))
        (if (i32.ne (call $wnd_get_thread (local.get $arg0)) (global.get $current_thread_id))
          (then
            (global.set $last_error (i32.const 1408)) ;; ERROR_WINDOW_OF_OTHER_THREAD
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (return)))))
    ;; The desktop key chord is unique even when the receiving hwnd/id differs.
    (local.set $node (global.get $hotkey_head))
    (block $unique
      (loop $scan
        (br_if $unique (i32.eqz (local.get $node)))
        (if (i32.and
              (i32.eq (call $gl32 (i32.add (local.get $node) (i32.const 12))) (local.get $arg2))
              (i32.eq (call $gl32 (i32.add (local.get $node) (i32.const 16))) (local.get $arg3)))
          (then
            (global.set $last_error (i32.const 1409)) ;; ERROR_HOTKEY_ALREADY_REGISTERED
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (return)))
        (local.set $node (call $gl32 (local.get $node)))
        (br $scan)))
    (local.set $node (call $heap_alloc (i32.const 24)))
    (if (i32.eqz (local.get $node))
      (then
        (global.set $last_error (i32.const 8)) ;; ERROR_NOT_ENOUGH_MEMORY
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (call $gs32 (local.get $node) (global.get $hotkey_head))
    (call $gs32 (i32.add (local.get $node) (i32.const 4)) (local.get $arg0))
    (call $gs32 (i32.add (local.get $node) (i32.const 8)) (local.get $arg1))
    (call $gs32 (i32.add (local.get $node) (i32.const 12)) (local.get $arg2))
    (call $gs32 (i32.add (local.get $node) (i32.const 16)) (local.get $arg3))
    (call $gs32 (i32.add (local.get $node) (i32.const 20)) (global.get $current_thread_id))
    (global.set $hotkey_head (local.get $node))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1)))

  (func $handle_UnregisterHotKey (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $node i32) (local $prev i32) (local $next i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
    (local.set $node (global.get $hotkey_head))
    (block $missing
      (loop $scan
        (br_if $missing (i32.eqz (local.get $node)))
        (if (i32.and
              (i32.eq (call $gl32 (i32.add (local.get $node) (i32.const 4))) (local.get $arg0))
              (i32.eq (call $gl32 (i32.add (local.get $node) (i32.const 8))) (local.get $arg1)))
          (then
            (local.set $next (call $gl32 (local.get $node)))
            (if (local.get $prev)
              (then (call $gs32 (local.get $prev) (local.get $next)))
              (else (global.set $hotkey_head (local.get $next))))
            (call $heap_free (local.get $node))
            (i32.store offset=0 (global.get $reg_base) (i32.const 1))
            (return)))
        (local.set $prev (local.get $node))
        (local.set $node (call $gl32 (local.get $node)))
        (br $scan)))
    (global.set $last_error (i32.const 1419)) ;; ERROR_HOTKEY_NOT_REGISTERED
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  ;; RegisterShellHook(hwnd, dwType) — legacy Win9x shell-window subscriber.
  ;; dwType=1 registers and dwType=0 unregisters. TASKMAN.EXE calls
  ;; RegisterWindowMessage("SHELLHOOK") immediately before this API.
  (func $handle_RegisterShellHook (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eq (local.get $arg1) (i32.const 1))
      (then
        (global.set $shell_hook_hwnd (local.get $arg0))
        ;; $register_window_message retained the exact interned SHELLHOOK id.
        ;; Keep a counter-derived fallback for callers that skip the documented
        ;; RegisterWindowMessage("SHELLHOOK") setup sequence.
        (if (i32.eqz (global.get $shell_hook_message))
          (then
            (global.set $shell_hook_message
              (i32.add (i32.const 0xC000) (global.get $clipboard_fmt_counter))))))
      (else
        (if (i32.eq (local.get $arg0) (global.get $shell_hook_hwnd))
          (then
            (global.set $shell_hook_hwnd (i32.const 0))
            (global.set $shell_hook_message (i32.const 0))))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; Win98 SHELL32 ordinal 184: tile visible, non-iconic child windows in the
  ;; requested rectangle. dwReserved is ignored; NULL lpKids enumerates the
  ;; parent's children. Returns the number of windows actually arranged.
  (func $handle_ArrangeWindows (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_arrange_windows
      (i32.const 3) (local.get $arg0)
      (select (call $g2w (local.get $arg2)) (i32.const 0) (i32.ne (local.get $arg2) (i32.const 0)))
      (local.get $arg3)
      (select (call $g2w (local.get $arg4)) (i32.const 0) (i32.ne (local.get $arg4) (i32.const 0)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
  )

  ;; ANSI uses the existing byte-to-wide conversion and the same recursive
  ;; VFS implementation as W. The older standalone A body ignored file ancestors
  ;; and accepted relative paths; those erroneous successes are not retained.
  (func $handle_SHCreateDirectoryExA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $len i32) (local $wide i32) (local $result i32)
    (local.set $result (i32.const 161))
    (if (local.get $arg1) (then
      (local.set $result (i32.const 206))
      (local.set $len (call $findexec_ansi_len (local.get $arg1) (i32.const 248)))
      (if (i32.ge_s (local.get $len) (i32.const 0)) (then
        (local.set $result (i32.const 8))
        (local.set $wide (call $heap_alloc (i32.const 496)))
        (if (local.get $wide) (then
          (drop (call $ansi_to_wide (local.get $arg1) (local.get $wide) (i32.const 248)))
          (local.set $result (call $shell_create_directory_w (local.get $wide) (local.get $arg2)))
          (call $heap_free (local.get $wide))))))))
    (i32.store offset=0 (global.get $reg_base) (local.get $result))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; 468: IsBadCodePtr(lpfn) — 1 arg stdcall. Despite its name, Windows defines
  ;; this as a one-byte readability probe, not an execute-permission test.
  (func $handle_IsBadCodePtr (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $ptr_range_access_bad
      (local.get $arg0) (i32.const 1) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; Return an ANSI string length only when the complete NUL-terminated input
  ;; is readable inside the caller-supplied bound. FindExecutable's public
  ;; buffers are MAX_PATH-sized, so walking beyond 259 bytes would turn a bad
  ;; pointer or unterminated name into a plausible VFS path.
  (func $findexec_ansi_len (param $string i32) (param $bound i32) (result i32)
    (local $i i32)
    (if (i32.eqz (local.get $string)) (then (return (i32.const -1))))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $bound)))
      (if (call $ptr_range_access_bad
            (i32.add (local.get $string) (local.get $i))
            (i32.const 1) (i32.const 0))
        (then (return (i32.const -1))))
      (if (i32.eqz (call $gl8 (i32.add (local.get $string) (local.get $i))))
        (then (return (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const -1))

  (func $findexec_path_is_absolute (param $path i32) (param $len i32) (result i32)
    (if (i32.eqz (local.get $len)) (then (return (i32.const 0))))
    (if (i32.or
          (i32.eq (call $gl8 (local.get $path)) (i32.const 0x5c))
          (i32.eq (call $gl8 (local.get $path)) (i32.const 0x2f)))
      (then (return (i32.const 1))))
    (i32.and
      (i32.ge_u (local.get $len) (i32.const 2))
      (i32.eq (call $gl8 (i32.add (local.get $path) (i32.const 1)))
              (i32.const 0x3a))))

  ;; FindExecutableA(lpFile, lpDirectory, lpResult) -> HINSTANCE-like shell
  ;; status. This is lookup only: the document must already exist in the VFS,
  ;; and the answer comes from the Win9x HKCR extension -> ProgID ->
  ;; shell\open\command chain. It does not launch or synthesize an association.
  (func $find_executable_a
      (param $file i32) (param $directory i32) (param $output i32) (result i32)
    (local $code i32) (local $file_len i32) (local $dir_len i32)
    (local $document i32) (local $document_len i32)
    (local $joined i32) (local $joined_len i32)
    (local $last i32) (local $dot i32) (local $i i32) (local $ch i32)
    (local $attrs i32) (local $prog i32) (local $command i32)
    (local $count i32) (local $type i32) (local $h_ext i32)
    (local $h_class i32) (local $h_command i32) (local $query i32)
    (local $cmd_len i32) (local $start i32) (local $exe_len i32)

    ;; The documented API assumes a writable MAX_PATH output. In the browser
    ;; host an invalid guest pointer must become a bounded shell failure rather
    ;; than a write through the shared NULL sentinel.
    (local.set $code (i32.const 5)) ;; SE_ERR_ACCESSDENIED
    (block $done
      (br_if $done (call $ptr_range_access_bad
        (local.get $output) (i32.const 260) (i32.const 1)))

      (local.set $code (i32.const 2)) ;; SE_ERR_FNF
      (local.set $file_len
        (call $findexec_ansi_len (local.get $file) (i32.const 260)))
      (br_if $done (i32.le_s (local.get $file_len) (i32.const 0)))
      (local.set $document (local.get $file))
      (local.set $document_len (local.get $file_len))

      ;; lpDirectory is the default only for a relative document name. An
      ;; absolute lpFile keeps its own root, matching other Win32 path APIs.
      (if (i32.and
            (i32.eqz (call $findexec_path_is_absolute
              (local.get $file) (local.get $file_len)))
            (i32.ne (local.get $directory) (i32.const 0)))
        (then
          (local.set $code (i32.const 3)) ;; SE_ERR_PNF
          (local.set $dir_len
            (call $findexec_ansi_len (local.get $directory) (i32.const 260)))
          (br_if $done (i32.le_s (local.get $dir_len) (i32.const 0)))
          (local.set $attrs (call $host_fs_get_file_attributes
            (call $g2w (local.get $directory)) (i32.const 0)))
          (br_if $done
            (i32.or
              (i32.eq (local.get $attrs) (i32.const -1))
              (i32.eqz (i32.and (local.get $attrs) (i32.const 0x10)))))
          (local.set $joined_len
            (i32.add (local.get $dir_len) (local.get $file_len)))
          (local.set $last (call $gl8
            (i32.add (local.get $directory)
              (i32.sub (local.get $dir_len) (i32.const 1)))))
          (if (i32.and
                (i32.ne (local.get $last) (i32.const 0x5c))
                (i32.ne (local.get $last) (i32.const 0x2f)))
            (then (local.set $joined_len
              (i32.add (local.get $joined_len) (i32.const 1)))))
          (local.set $code (i32.const 8)) ;; SE_ERR_OOM / resource exhaustion
          (br_if $done (i32.ge_u (local.get $joined_len) (i32.const 260)))
          (local.set $joined
            (call $heap_alloc (i32.add (local.get $joined_len) (i32.const 1))))
          (br_if $done (i32.eqz (local.get $joined)))
          (call $guest_strcpy (local.get $joined) (local.get $directory))
          (if (i32.and
                (i32.ne (local.get $last) (i32.const 0x5c))
                (i32.ne (local.get $last) (i32.const 0x2f)))
            (then
              (call $gs8 (i32.add (local.get $joined) (local.get $dir_len))
                (i32.const 0x5c))
              (local.set $dir_len
                (i32.add (local.get $dir_len) (i32.const 1)))))
          (call $guest_strcpy
            (i32.add (local.get $joined) (local.get $dir_len))
            (local.get $file))
          (local.set $document (local.get $joined))
          (local.set $document_len (local.get $joined_len))))

      (local.set $code (i32.const 2)) ;; missing document, not missing handler
      (local.set $attrs (call $host_fs_get_file_attributes
        (call $g2w (local.get $document)) (i32.const 0)))
      (br_if $done
        (i32.or
          (i32.eq (local.get $attrs) (i32.const -1))
          (i32.ne (i32.and (local.get $attrs) (i32.const 0x10)) (i32.const 0))))

      ;; Find the final component's final dot. Passing its suffix directly to
      ;; RegOpenKey preserves the leading period required by HKCR file types.
      (local.set $code (i32.const 31)) ;; SE_ERR_NOASSOC
      (local.set $i (i32.const 0))
      (block $extension_done (loop $extension_scan
        (br_if $extension_done
          (i32.ge_u (local.get $i) (local.get $document_len)))
        (local.set $ch (call $gl8 (i32.add (local.get $document) (local.get $i))))
        (if (i32.or
              (i32.eq (local.get $ch) (i32.const 0x5c))
              (i32.eq (local.get $ch) (i32.const 0x2f)))
          (then (local.set $dot (i32.const 0)))
          (else
            (if (i32.eq (local.get $ch) (i32.const 0x2e))
              (then (local.set $dot
                (i32.add (local.get $document) (local.get $i)))))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $extension_scan)))
      (br_if $done (i32.eqz (local.get $dot)))
      (br_if $done (i32.eqz (call $gl8 (i32.add (local.get $dot) (i32.const 1)))))

      (local.set $prog (call $heap_alloc (i32.const 260)))
      (local.set $command (call $heap_alloc (i32.const 1024)))
      (local.set $count (call $heap_alloc (i32.const 4)))
      (local.set $type (call $heap_alloc (i32.const 4)))
      (local.set $code (i32.const 8))
      (br_if $done
        (i32.or
          (i32.or (i32.eqz (local.get $prog)) (i32.eqz (local.get $command)))
          (i32.or (i32.eqz (local.get $count)) (i32.eqz (local.get $type)))))

      (local.set $code (i32.const 31))
      (local.set $h_ext (call $host_reg_open_key
        (i32.const 0x80000000) (call $g2w (local.get $dot)) (i32.const 0)))
      (br_if $done (i32.eqz (local.get $h_ext)))
      (call $gs32 (local.get $count) (i32.const 260))
      (local.set $query (call $host_reg_query_value
        (local.get $h_ext) (i32.const 0) (local.get $type)
        (local.get $prog) (local.get $count) (i32.const 0)))
      (drop (call $host_reg_close_key (local.get $h_ext)))
      (local.set $h_ext (i32.const 0))
      (if (i32.eq (local.get $query) (i32.const 234))
        (then (local.set $code (i32.const 8)) (br $done)))
      (local.set $code (i32.const 31))
      (br_if $done (local.get $query))
      (br_if $done
        (i32.and
          (i32.ne (call $gl32 (local.get $type)) (i32.const 1))
          (i32.ne (call $gl32 (local.get $type)) (i32.const 2))))
      (br_if $done
        (i32.le_s (call $findexec_ansi_len (local.get $prog) (i32.const 260))
                  (i32.const 0)))

      (local.set $h_class (call $host_reg_open_key
        (i32.const 0x80000000) (call $g2w (local.get $prog)) (i32.const 0)))
      (br_if $done (i32.eqz (local.get $h_class)))
      (local.set $h_command (call $host_reg_open_key
        (local.get $h_class) "shell\\open\\command" (i32.const 0)))
      (br_if $done (i32.eqz (local.get $h_command)))
      (call $gs32 (local.get $count) (i32.const 1024))
      (local.set $query (call $host_reg_query_value
        (local.get $h_command) (i32.const 0) (local.get $type)
        (local.get $command) (local.get $count) (i32.const 0)))
      (if (i32.eq (local.get $query) (i32.const 234))
        (then (local.set $code (i32.const 8)) (br $done)))
      (local.set $code (i32.const 31))
      (br_if $done (local.get $query))
      (br_if $done
        (i32.and
          (i32.ne (call $gl32 (local.get $type)) (i32.const 1))
          (i32.ne (call $gl32 (local.get $type)) (i32.const 2))))
      (local.set $cmd_len
        (call $findexec_ansi_len (local.get $command) (i32.const 1024)))
      (br_if $done (i32.le_s (local.get $cmd_len) (i32.const 0)))

      ;; Skip command-line padding, then isolate argv[0]. Quoted paths retain
      ;; spaces; unquoted paths end at the first command-line whitespace.
      (local.set $start (i32.const 0))
      (block $padding_done (loop $padding
        (br_if $padding_done (i32.ge_u (local.get $start) (local.get $cmd_len)))
        (local.set $ch (call $gl8
          (i32.add (local.get $command) (local.get $start))))
        (br_if $padding_done (i32.gt_u (local.get $ch) (i32.const 0x20)))
        (local.set $start (i32.add (local.get $start) (i32.const 1)))
        (br $padding)))
      (br_if $done (i32.ge_u (local.get $start) (local.get $cmd_len)))
      (if (i32.eq
            (call $gl8 (i32.add (local.get $command) (local.get $start)))
            (i32.const 0x22))
        (then
          (local.set $start (i32.add (local.get $start) (i32.const 1)))
          (local.set $i (local.get $start))
          (block $quote_done (loop $quote
            (br_if $quote_done (i32.ge_u (local.get $i) (local.get $cmd_len)))
            (br_if $quote_done
              (i32.eq (call $gl8 (i32.add (local.get $command) (local.get $i)))
                      (i32.const 0x22)))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $quote)))
          (br_if $done (i32.ge_u (local.get $i) (local.get $cmd_len)))
          (local.set $exe_len (i32.sub (local.get $i) (local.get $start))))
        (else
          (local.set $i (local.get $start))
          (block $token_done (loop $token
            (br_if $token_done (i32.ge_u (local.get $i) (local.get $cmd_len)))
            (br_if $token_done
              (i32.le_u (call $gl8 (i32.add (local.get $command) (local.get $i)))
                        (i32.const 0x20)))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $token)))
          (local.set $exe_len (i32.sub (local.get $i) (local.get $start)))))
      (br_if $done (i32.eqz (local.get $exe_len)))
      (if (i32.ge_u (local.get $exe_len) (i32.const 260))
        (then (local.set $code (i32.const 8)) (br $done)))

      ;; REG_EXPAND_SZ needs environment expansion. Returning a literal %VAR%
      ;; path would be a plausible lie, so decline the association until that
      ;; expansion is modeled; literal REG_EXPAND_SZ values remain usable.
      (if (i32.eq (call $gl32 (local.get $type)) (i32.const 2))
        (then
          (local.set $i (i32.const 0))
          (block $percent_done (loop $percent
            (br_if $percent_done (i32.ge_u (local.get $i) (local.get $exe_len)))
            (br_if $done
              (i32.eq
                (call $gl8 (i32.add
                  (i32.add (local.get $command) (local.get $start)) (local.get $i)))
                (i32.const 0x25)))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $percent)))))

      ;; Transactional output: no failure above has changed even byte zero.
      (local.set $i (i32.const 0))
      (block $copy_done (loop $copy
        (br_if $copy_done (i32.ge_u (local.get $i) (local.get $exe_len)))
        (call $gs8 (i32.add (local.get $output) (local.get $i))
          (call $gl8 (i32.add
            (i32.add (local.get $command) (local.get $start)) (local.get $i))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $copy)))
      (call $gs8 (i32.add (local.get $output) (local.get $exe_len)) (i32.const 0))
      (local.set $code (i32.const 33)))

    (if (local.get $h_ext)
      (then (drop (call $host_reg_close_key (local.get $h_ext)))))
    (if (local.get $h_command)
      (then (drop (call $host_reg_close_key (local.get $h_command)))))
    (if (local.get $h_class)
      (then (drop (call $host_reg_close_key (local.get $h_class)))))
    (if (local.get $type) (then (call $heap_free (local.get $type))))
    (if (local.get $count) (then (call $heap_free (local.get $count))))
    (if (local.get $command) (then (call $heap_free (local.get $command))))
    (if (local.get $prog) (then (call $heap_free (local.get $prog))))
    (if (local.get $joined) (then (call $heap_free (local.get $joined))))
    (local.get $code))

  (func $handle_FindExecutableA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $find_executable_a
      (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; BackupRead/BackupWrite expose a byte stream made of WIN32_STREAM_ID
  ;; headers followed by their payloads. The Win98 VFS has exactly one kind
  ;; of persistent file data: the unnamed data stream. Keep that boundary
  ;; explicit rather than fabricating ACLs, EAs, hard links, or named streams.
  ;;
  ;; The opaque guest-heap context is deliberately shared by all three APIs:
  ;;   +0  magic, +4 direction (1 read, 2 write), +8 file handle
  ;;   +12 phase (0 header, 1 payload, 2 end), +16 header progress
  ;;   +20 payload bytes remaining, +24 original payload size
  ;;   +28 host byte-count scratch, +32 the 20-byte stream header
  (global $BACKUP_CONTEXT_MAGIC i32 (i32.const 0x31504b42)) ;; "BKP1"
  (global $BACKUP_CONTEXT_SIZE i32 (i32.const 56))

  (func $backup_context_abort (param $slot i32) (param $mode i32) (result i32)
    (local $ctx i32) (local $wa i32)
    (if (call $ptr_range_access_bad
          (local.get $slot) (i32.const 4) (i32.const 1))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (return (i32.const 0))))
    (local.set $ctx (call $gl32 (local.get $slot)))
    ;; An empty slot has no allocation to release. This makes cleanup safe
    ;; after a failed first call while retaining the required non-NULL slot.
    (if (i32.eqz (local.get $ctx))
      (then (return (i32.const 1))))
    (if (call $ptr_range_bad
          (local.get $ctx) (global.get $BACKUP_CONTEXT_SIZE))
      (then
        (global.set $last_error (i32.const 87))
        (return (i32.const 0))))
    (local.set $wa (call $g2w (local.get $ctx)))
    (if (i32.or
          (i32.ne (i32.load (local.get $wa))
                  (global.get $BACKUP_CONTEXT_MAGIC))
          (i32.ne (i32.load offset=4 (local.get $wa)) (local.get $mode)))
      (then
        (global.set $last_error (i32.const 87))
        (return (i32.const 0))))
    ;; Poison before freeing so a copied/stale context value cannot pass the
    ;; signature check unless the allocator has legitimately reused it.
    (i32.store (local.get $wa) (i32.const 0))
    (call $heap_free (local.get $ctx))
    (call $gs32 (local.get $slot) (i32.const 0))
    (i32.const 1))

  ;; BackupRead(hFile, buffer, count, bytesRead, abort, processSecurity,
  ;;            context) -- 7-argument stdcall.
  (func $handle_BackupRead (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $slot i32) (local $ctx i32) (local $wa i32)
    (local $size i32) (local $phase i32) (local $header i32)
    (local $remaining i32) (local $done i32) (local $chunk i32)
    (local $bytes i32) (local $lazy i32) (local $i i32)
    (local $old_phase i32) (local $old_header i32) (local $old_remaining i32)
    (local.set $slot
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))

    ;; Microsoft documents an abort call as context-only: all other arguments
    ;; are ignored, including a stale file handle and buffer pointers.
    (if (local.get $arg4)
      (then
        (i32.store offset=0 (global.get $reg_base) (call $backup_context_abort (local.get $slot) (i32.const 1)))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
        (return)))

    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (if (i32.or
          (call $ptr_range_access_bad
            (local.get $slot) (i32.const 4) (i32.const 1))
          (i32.or
            (call $ptr_range_access_bad
              (local.get $arg3) (i32.const 4) (i32.const 1))
            (i32.and
              (i32.ne (local.get $arg2) (i32.const 0))
              (i32.ne
                (call $ptr_range_access_bad
                  (local.get $arg1) (local.get $arg2) (i32.const 1))
                (i32.const 0)))))
      (then
        (global.set $last_error (i32.const 87))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
        (return)))
    (call $gs32 (local.get $arg3) (i32.const 0))
    ;; The documented contract requires room beyond the fixed 20-byte
    ;; WIN32_STREAM_ID header. A zero-length call remains useful for the
    ;; documented end-of-stream probe, but other undersized calls fail.
    (if (i32.and
          (i32.ne (local.get $arg2) (i32.const 0))
          (i32.le_u (local.get $arg2) (i32.const 20)))
      (then
        (global.set $last_error (i32.const 87))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
        (return)))
    (local.set $ctx (call $gl32 (local.get $slot)))
    (if (i32.eqz (local.get $ctx))
      (then
        (local.set $size (call $host_fs_get_file_size (local.get $arg0)))
        (if (i32.eq (local.get $size) (i32.const -1))
          (then
            (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
            (return)))
        ;; BackupRead describes the whole unnamed stream, independent of a
        ;; cursor the caller happened to leave on the newly supplied handle.
        (if (i32.eq
              (call $host_fs_set_file_pointer
                (local.get $arg0) (i32.const 0) (i32.const 0))
              (i32.const -1))
          (then
            (global.set $last_error (i32.const 25)) ;; ERROR_SEEK
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
            (return)))
        (local.set $ctx (call $heap_alloc (global.get $BACKUP_CONTEXT_SIZE)))
        (if (i32.eqz (local.get $ctx))
          (then
            (global.set $last_error (i32.const 8)) ;; ERROR_NOT_ENOUGH_MEMORY
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
            (return)))
        (local.set $wa (call $g2w (local.get $ctx)))
        (memory.fill (local.get $wa) (i32.const 0)
          (global.get $BACKUP_CONTEXT_SIZE))
        (i32.store (local.get $wa) (global.get $BACKUP_CONTEXT_MAGIC))
        (i32.store offset=4 (local.get $wa) (i32.const 1))
        (i32.store offset=8 (local.get $wa) (local.get $arg0))
        (i32.store offset=20 (local.get $wa) (local.get $size))
        (i32.store offset=24 (local.get $wa) (local.get $size))
        ;; WIN32_STREAM_ID without a name is a fixed 20-byte wire header.
        (i32.store offset=32 (local.get $wa) (i32.const 1)) ;; BACKUP_DATA
        (i32.store offset=40 (local.get $wa) (local.get $size))
        (call $gs32 (local.get $slot) (local.get $ctx)))
      (else
        (if (call $ptr_range_bad
              (local.get $ctx) (global.get $BACKUP_CONTEXT_SIZE))
          (then
            (global.set $last_error (i32.const 87))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
            (return)))
        (local.set $wa (call $g2w (local.get $ctx)))
        (if (i32.or
              (i32.ne (i32.load (local.get $wa))
                      (global.get $BACKUP_CONTEXT_MAGIC))
              (i32.or
                (i32.ne (i32.load offset=4 (local.get $wa)) (i32.const 1))
                (i32.ne (i32.load offset=8 (local.get $wa)) (local.get $arg0))))
          (then
            (global.set $last_error (i32.const 87))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
            (return)))))

    (local.set $phase (i32.load offset=12 (local.get $wa)))
    (local.set $header (i32.load offset=16 (local.get $wa)))
    (local.set $remaining (i32.load offset=20 (local.get $wa)))
    (local.set $old_phase (local.get $phase))
    (local.set $old_header (local.get $header))
    (local.set $old_remaining (local.get $remaining))

    ;; Keep header progress explicit so retry/error rollback remains atomic.
    ;; A conforming first call has room for this whole fixed header.
    (if (i32.and
          (i32.eqz (local.get $phase))
          (i32.lt_u (local.get $done) (local.get $arg2)))
      (then
        (local.set $chunk
          (i32.sub (i32.const 20) (local.get $header)))
        (if (i32.gt_u (local.get $chunk)
                      (i32.sub (local.get $arg2) (local.get $done)))
          (then
            (local.set $chunk
              (i32.sub (local.get $arg2) (local.get $done)))))
        ;; Byte helpers keep this tiny header copy correct even when a caller's
        ;; guest buffer straddles separately backed virtual pages.
        (local.set $i (i32.const 0))
        (block $read_header_done (loop $read_header
          (br_if $read_header_done (i32.ge_u (local.get $i) (local.get $chunk)))
          (call $gs8
            (i32.add (i32.add (local.get $arg1) (local.get $done)) (local.get $i))
            (i32.load8_u
              (i32.add
                (i32.add (local.get $wa) (i32.const 32))
                (i32.add (local.get $header) (local.get $i)))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $read_header)))
        (local.set $header (i32.add (local.get $header) (local.get $chunk)))
        (local.set $done (i32.add (local.get $done) (local.get $chunk)))
        (i32.store offset=16 (local.get $wa) (local.get $header))
        (if (i32.eq (local.get $header) (i32.const 20))
          (then
            (local.set $phase
              (select (i32.const 2) (i32.const 1)
                (i32.eqz (local.get $remaining))))
            (i32.store offset=12 (local.get $wa) (local.get $phase))))))

    (if (i32.and
          (i32.eq (local.get $phase) (i32.const 1))
          (i32.lt_u (local.get $done) (local.get $arg2)))
      (then
        (local.set $chunk
          (i32.sub (local.get $arg2) (local.get $done)))
        (if (i32.gt_u (local.get $chunk) (local.get $remaining))
          (then (local.set $chunk (local.get $remaining))))
        (i32.store offset=28 (local.get $wa) (i32.const 0))
        (if (i32.eqz (call $host_fs_read_file
              (local.get $arg0)
              (i32.add (local.get $arg1) (local.get $done))
              (local.get $chunk)
              (i32.add (local.get $ctx) (i32.const 28))))
          (then
            ;; Restore call-entry progress because a lazy read retries the
            ;; complete API call with the same guest buffer and arguments.
            (i32.store offset=12 (local.get $wa) (local.get $old_phase))
            (i32.store offset=16 (local.get $wa) (local.get $old_header))
            (i32.store offset=20 (local.get $wa) (local.get $old_remaining))
            (local.set $lazy (call $host_fs_read_pending))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
            (if (i32.eq (local.get $lazy) (i32.const 1))
              (then (call $io_block (i32.const 32)))
              (else (global.set $last_error (i32.const 30)))) ;; ERROR_READ_FAULT
            (return)))
        (local.set $bytes
          (i32.load offset=28 (local.get $wa)))
        ;; A file truncated after its stream header (or a broken host bridge)
        ;; must not produce an endless series of successful zero-byte calls
        ;; while the advertised payload still has bytes remaining.
        (if (i32.and
              (i32.ne (local.get $chunk) (i32.const 0))
              (i32.eqz (local.get $bytes)))
          (then
            (i32.store offset=12 (local.get $wa) (local.get $old_phase))
            (i32.store offset=16 (local.get $wa) (local.get $old_header))
            (i32.store offset=20 (local.get $wa) (local.get $old_remaining))
            (global.set $last_error (i32.const 30))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
            (return)))
        (local.set $done (i32.add (local.get $done) (local.get $bytes)))
        (local.set $remaining (i32.sub (local.get $remaining) (local.get $bytes)))
        (i32.store offset=20 (local.get $wa) (local.get $remaining))
        (if (i32.eqz (local.get $remaining))
          (then (i32.store offset=12 (local.get $wa) (i32.const 2))))))
    (call $gs32 (local.get $arg3) (local.get $done))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32))))

  ;; BackupWrite(hFile, buffer, count, bytesWritten, abort, processSecurity,
  ;;             context) -- 7-argument stdcall.
  (func $handle_BackupWrite (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $slot i32) (local $ctx i32) (local $wa i32)
    (local $phase i32) (local $header i32) (local $remaining i32)
    (local $done i32) (local $chunk i32) (local $bytes i32)
    (local $ok i32) (local $i i32)
    (local $old_phase i32) (local $old_header i32) (local $old_remaining i32)
    (local.set $slot
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
    (if (local.get $arg4)
      (then
        (i32.store offset=0 (global.get $reg_base) (call $backup_context_abort (local.get $slot) (i32.const 2)))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
        (return)))

    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (if (i32.or
          (call $ptr_range_access_bad
            (local.get $slot) (i32.const 4) (i32.const 1))
          (i32.or
            (call $ptr_range_access_bad
              (local.get $arg3) (i32.const 4) (i32.const 1))
            (i32.and
              (i32.ne (local.get $arg2) (i32.const 0))
              (i32.ne
                (call $ptr_range_bad (local.get $arg1) (local.get $arg2))
                (i32.const 0)))))
      (then
        (global.set $last_error (i32.const 87))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
        (return)))
    (call $gs32 (local.get $arg3) (i32.const 0))
    (if (i32.and
          (i32.ne (local.get $arg2) (i32.const 0))
          (i32.le_u (local.get $arg2) (i32.const 20)))
      (then
        (global.set $last_error (i32.const 87))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
        (return)))
    (if (i32.eq
          (call $host_fs_get_file_size (local.get $arg0)) (i32.const -1))
      (then
        (global.set $last_error (i32.const 6))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
        (return)))

    (local.set $ctx (call $gl32 (local.get $slot)))
    (if (i32.eqz (local.get $ctx))
      (then
        (if (i32.eq
              (call $host_fs_set_file_pointer
                (local.get $arg0) (i32.const 0) (i32.const 0))
              (i32.const -1))
          (then
            (global.set $last_error (i32.const 25))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
            (return)))
        (local.set $ctx (call $heap_alloc (global.get $BACKUP_CONTEXT_SIZE)))
        (if (i32.eqz (local.get $ctx))
          (then
            (global.set $last_error (i32.const 8))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
            (return)))
        (local.set $wa (call $g2w (local.get $ctx)))
        (memory.fill (local.get $wa) (i32.const 0)
          (global.get $BACKUP_CONTEXT_SIZE))
        (i32.store (local.get $wa) (global.get $BACKUP_CONTEXT_MAGIC))
        (i32.store offset=4 (local.get $wa) (i32.const 2))
        (i32.store offset=8 (local.get $wa) (local.get $arg0))
        (call $gs32 (local.get $slot) (local.get $ctx)))
      (else
        (if (call $ptr_range_bad
              (local.get $ctx) (global.get $BACKUP_CONTEXT_SIZE))
          (then
            (global.set $last_error (i32.const 87))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
            (return)))
        (local.set $wa (call $g2w (local.get $ctx)))
        (if (i32.or
              (i32.ne (i32.load (local.get $wa))
                      (global.get $BACKUP_CONTEXT_MAGIC))
              (i32.or
                (i32.ne (i32.load offset=4 (local.get $wa)) (i32.const 2))
                (i32.ne (i32.load offset=8 (local.get $wa)) (local.get $arg0))))
          (then
            (global.set $last_error (i32.const 87))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
            (return)))))

    (local.set $phase (i32.load offset=12 (local.get $wa)))
    (local.set $header (i32.load offset=16 (local.get $wa)))
    (local.set $remaining (i32.load offset=20 (local.get $wa)))
    (local.set $old_phase (local.get $phase))
    (local.set $old_header (local.get $header))
    (local.set $old_remaining (local.get $remaining))

    (if (i32.and
          (i32.eqz (local.get $phase))
          (i32.lt_u (local.get $done) (local.get $arg2)))
      (then
        (local.set $chunk
          (i32.sub (i32.const 20) (local.get $header)))
        (if (i32.gt_u (local.get $chunk)
                      (i32.sub (local.get $arg2) (local.get $done)))
          (then
            (local.set $chunk
              (i32.sub (local.get $arg2) (local.get $done)))))
        (local.set $i (i32.const 0))
        (block $write_header_done (loop $write_header
          (br_if $write_header_done (i32.ge_u (local.get $i) (local.get $chunk)))
          (i32.store8
            (i32.add
              (i32.add (local.get $wa) (i32.const 32))
              (i32.add (local.get $header) (local.get $i)))
            (call $gl8
              (i32.add
                (i32.add (local.get $arg1) (local.get $done))
                (local.get $i))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $write_header)))
        (local.set $header (i32.add (local.get $header) (local.get $chunk)))
        (local.set $done (i32.add (local.get $done) (local.get $chunk)))
        (i32.store offset=16 (local.get $wa) (local.get $header))
        (if (i32.eq (local.get $header) (i32.const 20))
          (then
            ;; Accept only the default data stream shape that the VFS can
            ;; actually restore. Header rejection occurs before any file byte
            ;; is written, including when header and payload share one call.
            (if (i32.or
                  (i32.ne (i32.load offset=32 (local.get $wa)) (i32.const 1))
                  (i32.or
                    (i32.ne (i32.load offset=36 (local.get $wa)) (i32.const 0))
                    (i32.or
                      (i32.ne (i32.load offset=44 (local.get $wa)) (i32.const 0))
                      (i32.ne (i32.load offset=48 (local.get $wa)) (i32.const 0)))))
              (then
                (i32.store offset=12 (local.get $wa) (local.get $old_phase))
                (i32.store offset=16 (local.get $wa) (local.get $old_header))
                (i32.store offset=20 (local.get $wa) (local.get $old_remaining))
                (global.set $last_error (i32.const 50))
                (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
                (return)))
            (local.set $remaining (i32.load offset=40 (local.get $wa)))
            (i32.store offset=20 (local.get $wa) (local.get $remaining))
            (i32.store offset=24 (local.get $wa) (local.get $remaining))
            (local.set $phase
              (select (i32.const 2) (i32.const 1)
                (i32.eqz (local.get $remaining))))
            (i32.store offset=12 (local.get $wa) (local.get $phase))
            (if (i32.eqz (local.get $remaining))
              (then
                (if (i32.eqz
                      (call $host_fs_set_end_of_file (local.get $arg0)))
                  (then
                    (i32.store offset=12 (local.get $wa) (local.get $old_phase))
                    (i32.store offset=16 (local.get $wa) (local.get $old_header))
                    (i32.store offset=20 (local.get $wa) (local.get $old_remaining))
                    (global.set $last_error (i32.const 29))
                    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
                    (return)))))))))

    (if (i32.and
          (i32.eq (local.get $phase) (i32.const 1))
          (i32.lt_u (local.get $done) (local.get $arg2)))
      (then
        (local.set $chunk
          (i32.sub (local.get $arg2) (local.get $done)))
        (if (i32.gt_u (local.get $chunk) (local.get $remaining))
          (then (local.set $chunk (local.get $remaining))))
        (local.set $ok (call $host_fs_write_file
          (local.get $arg0)
          (i32.add (local.get $arg1) (local.get $done))
          (local.get $chunk)
          (i32.add (local.get $ctx) (i32.const 28))))
        (if (i32.eqz (local.get $ok))
          (then
            (i32.store offset=12 (local.get $wa) (local.get $old_phase))
            (i32.store offset=16 (local.get $wa) (local.get $old_header))
            (i32.store offset=20 (local.get $wa) (local.get $old_remaining))
            (global.set $last_error (i32.const 29)) ;; ERROR_WRITE_FAULT
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
            (return)))
        (local.set $bytes (i32.load offset=28 (local.get $wa)))
        (if (i32.and
              (i32.ne (local.get $chunk) (i32.const 0))
              (i32.eqz (local.get $bytes)))
          (then
            (i32.store offset=12 (local.get $wa) (local.get $old_phase))
            (i32.store offset=16 (local.get $wa) (local.get $old_header))
            (i32.store offset=20 (local.get $wa) (local.get $old_remaining))
            (global.set $last_error (i32.const 29))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
            (return)))
        ;; A successful host write may still be short. Consume exactly the
        ;; bytes it reports so the caller can retry the unconsumed suffix.
        (if (i32.gt_u (local.get $bytes) (local.get $chunk))
          (then
            (global.set $last_error (i32.const 29))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
            (return)))
        (local.set $done (i32.add (local.get $done) (local.get $bytes)))
        (local.set $remaining (i32.sub (local.get $remaining) (local.get $bytes)))
        (i32.store offset=20 (local.get $wa) (local.get $remaining))
        (if (i32.eqz (local.get $remaining))
          (then
            ;; Restoring BACKUP_DATA defines its complete length. Remove a
            ;; stale tail when the destination existed and was longer.
            (if (i32.eqz
                  (call $host_fs_set_end_of_file (local.get $arg0)))
              (then
                (global.set $last_error (i32.const 29))
                (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
                (return)))
            (local.set $phase (i32.const 2))
            (i32.store offset=12 (local.get $wa) (local.get $phase))))))

    ;; One context describes one destination file. Bytes following its sole
    ;; unnamed data stream would begin another (unsupported) stream header.
    (if (i32.and
          (i32.eq (local.get $phase) (i32.const 2))
          (i32.lt_u (local.get $done) (local.get $arg2)))
      (then
        (global.set $last_error (i32.const 50))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
        (return)))
    (call $gs32 (local.get $arg3) (local.get $done))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32))))

  ;; BackupSeek seeks forward only inside the current stream payload. It
  ;; never crosses a header; an overlong request advances to the end of this
  ;; stream, reports the actual distance, and fails as documented.
  (func $handle_BackupSeek (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $slot i32) (local $ctx i32) (local $wa i32)
    (local $phase i32) (local $remaining i32) (local $actual i32)
    (local $chunk i32) (local $left i32) (local $moved i32)
    (local $complete i32) (local $seek_failed i32)
    (local.set $slot
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (if (i32.or
          (call $ptr_range_access_bad
            (local.get $arg3) (i32.const 4) (i32.const 1))
          (i32.or
            (call $ptr_range_access_bad
              (local.get $arg4) (i32.const 4) (i32.const 1))
            (call $ptr_range_bad (local.get $slot) (i32.const 4))))
      (then
        (global.set $last_error (i32.const 87))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
        (return)))
    (call $gs32 (local.get $arg3) (i32.const 0))
    (call $gs32 (local.get $arg4) (i32.const 0))
    (local.set $ctx (call $gl32 (local.get $slot)))
    (if (i32.or
          (i32.eqz (local.get $ctx))
          (call $ptr_range_bad
            (local.get $ctx) (global.get $BACKUP_CONTEXT_SIZE)))
      (then
        (global.set $last_error (i32.const 87))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
        (return)))
    (local.set $wa (call $g2w (local.get $ctx)))
    (if (i32.or
          (i32.ne (i32.load (local.get $wa))
                  (global.get $BACKUP_CONTEXT_MAGIC))
          (i32.or
            (i32.ne (i32.load offset=8 (local.get $wa)) (local.get $arg0))
            (i32.and
              (i32.ne (i32.load offset=4 (local.get $wa)) (i32.const 1))
              (i32.ne (i32.load offset=4 (local.get $wa)) (i32.const 2)))))
      (then
        (global.set $last_error (i32.const 87))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
        (return)))
    (if (i32.eq
          (call $host_fs_get_file_size (local.get $arg0)) (i32.const -1))
      (then
        (global.set $last_error (i32.const 6))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
        (return)))
    (local.set $phase (i32.load offset=12 (local.get $wa)))
    (local.set $remaining (i32.load offset=20 (local.get $wa)))
    ;; Header bytes are not stream payload and BackupSeek cannot cross them.
    (if (i32.eqz (local.get $phase))
      (then
        (global.set $last_error (i32.const 25)) ;; ERROR_SEEK
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
        (return)))

    ;; A nonzero high half necessarily exceeds our bounded (<4 GB) VFS
    ;; stream. Otherwise compare the low halves unsigned.
    (local.set $complete
      (i32.and
        (i32.eqz (local.get $arg2))
        (i32.le_u (local.get $arg1) (local.get $remaining))))
    (local.set $actual
      (select (local.get $arg1) (local.get $remaining) (local.get $complete)))
    (local.set $left (local.get $actual))
    ;; The host bridge takes a signed i32 delta. Split a large forward seek
    ;; so every individual FILE_CURRENT movement stays nonnegative.
    (block $seek_done (loop $seek
      (br_if $seek_done (i32.eqz (local.get $left)))
      (local.set $chunk (local.get $left))
      (if (i32.gt_u (local.get $chunk) (i32.const 0x7fffffff))
        (then (local.set $chunk (i32.const 0x7fffffff))))
      (if (i32.eq
            (call $host_fs_set_file_pointer
              (local.get $arg0) (local.get $chunk) (i32.const 1))
            (i32.const -1))
        (then
          (local.set $seek_failed (i32.const 1))
          (br $seek_done)))
      (local.set $left (i32.sub (local.get $left) (local.get $chunk)))
      (local.set $moved (i32.add (local.get $moved) (local.get $chunk)))
      (br $seek)))
    (local.set $remaining (i32.sub (local.get $remaining) (local.get $moved)))
    (i32.store offset=20 (local.get $wa) (local.get $remaining))
    (if (i32.eqz (local.get $remaining))
      (then (i32.store offset=12 (local.get $wa) (i32.const 2))))
    (call $gs32 (local.get $arg3) (local.get $moved))
    ;; Since actual never exceeds 32 bits, its high half is always zero.
    (call $gs32 (local.get $arg4) (i32.const 0))
    (if (i32.and
          (i32.ne (local.get $complete) (i32.const 0))
          (i32.eqz (local.get $seek_failed)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 1)))
      (else (global.set $last_error (i32.const 25))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))


  ;; Bounded UTF-16 guest reads for the legacy MAX_PATH shell APIs. Validate
  ;; each code unit, including across sparse page mappings, before translating.
  (func $shell_path_wlen (param $path i32) (param $limit i32) (result i32)
    (local $n i32) (local $p i32)
    (if (i32.eqz (local.get $path)) (then (return (i32.const -1))))
    (loop $scan
      (if (i32.ge_u (local.get $n) (local.get $limit)) (then (return (i32.const -1))))
      (local.set $p (i32.add (local.get $path) (i32.shl (local.get $n) (i32.const 1))))
      (if (i32.or (i32.lt_u (local.get $p) (local.get $path))
            (call $ptr_range_access_bad (local.get $p) (i32.const 2) (i32.const 0)))
        (then (return (i32.const -1))))
      (if (i32.eqz (call $gl16 (local.get $p))) (then (return (local.get $n))))
      (local.set $n (i32.add (local.get $n) (i32.const 1))) (br $scan))
    (i32.const -1))

  (func $shell_path_wc (param $path i32) (param $index i32) (result i32)
    (call $gl16 (i32.add (local.get $path) (i32.shl (local.get $index) (i32.const 1)))))
  (func $shell_path_put (param $path i32) (param $index i32) (param $value i32)
    ;; Existing helper is an indexed guest WORD store, with no rectangle or
    ;; Win16-mode state; sharing it avoids another address-arithmetic body.
    (call $win16_rect_set (local.get $path) (local.get $index) (local.get $value)))

  ;; Lexical canonicalization, not VFS resolution: drive/UNC roots are retained,
  ;; dot components disappear and parent components cannot escape the root.
  ;; Repeated separators and non-ASCII code units otherwise remain unchanged.
  (func $shell_path_canonical (param $src i32) (param $len i32) (param $dst i32) (result i32)
    (local $i i32) (local $out i32) (local $floor i32) (local $end i32)
    (local $n i32) (local $c i32) (local $unc i32) (local $parts i32)
    (if (i32.eqz (local.get $len)) (then
      (call $shell_path_put (local.get $dst) (i32.const 0) (i32.const 92))
      (call $shell_path_put (local.get $dst) (i32.const 1) (i32.const 0))
      (return (i32.const 1))))
    (if (i32.eq (call $shell_path_wc (local.get $src) (i32.const 0)) (i32.const 92))
      (then
        (local.set $floor (i32.const 1))
        (if (i32.and (i32.gt_u (local.get $len) (i32.const 1))
              (i32.eq (call $shell_path_wc (local.get $src) (i32.const 1)) (i32.const 92)))
          (then (local.set $unc (i32.const 1)) (local.set $floor (i32.const 2)))))
      (else
        (if (i32.and (i32.gt_u (local.get $len) (i32.const 1))
              (i32.eq (call $shell_path_wc (local.get $src) (i32.const 1)) (i32.const 58)))
          (then
            (local.set $floor (i32.const 2))
            (if (i32.eq (call $shell_path_wc (local.get $src) (i32.const 2)) (i32.const 92))
              (then (local.set $floor (i32.const 3))))))))
    (block $root_done (loop $root
      (br_if $root_done (i32.ge_u (local.get $i) (local.get $floor)))
      (call $shell_path_put (local.get $dst) (local.get $i) (call $shell_path_wc (local.get $src) (local.get $i)))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $root)))
    (local.set $out (local.get $i))
    (block $done (loop $component
      (br_if $done (i32.ge_u (local.get $i) (local.get $len)))
      (local.set $end (local.get $i))
      (block $end_done (loop $find_end
        (br_if $end_done (i32.ge_u (local.get $end) (local.get $len)))
        (br_if $end_done (i32.eq (call $shell_path_wc (local.get $src) (local.get $end)) (i32.const 92)))
        (local.set $end (i32.add (local.get $end) (i32.const 1))) (br $find_end)))
      (local.set $n (i32.sub (local.get $end) (local.get $i)))
      (local.set $c (call $shell_path_wc (local.get $src) (local.get $i)))
      (if (i32.and (i32.eq (local.get $c) (i32.const 46)) (i32.eq (local.get $n) (i32.const 1)))
        (then
          ;; A terminal dot is a filename in legacy PathCanonicalize.
          (if (i32.eq (local.get $end) (local.get $len)) (then
            (call $shell_path_put (local.get $dst) (local.get $out) (local.get $c))
            (local.set $out (i32.add (local.get $out) (i32.const 1))))))
        (else
          (if (i32.and (i32.eq (local.get $n) (i32.const 2))
                (i32.and (i32.eq (local.get $c) (i32.const 46))
                  (i32.eq (call $shell_path_wc (local.get $src) (i32.add (local.get $i) (i32.const 1))) (i32.const 46))))
            (then
              (if (i32.gt_u (local.get $out) (local.get $floor)) (then
                (local.set $out (i32.sub (local.get $out) (i32.const 1)))
                (block $back_done (loop $back
                  (br_if $back_done (i32.le_u (local.get $out) (local.get $floor)))
                  (br_if $back_done (i32.eq (call $shell_path_wc (local.get $dst) (i32.sub (local.get $out) (i32.const 1))) (i32.const 92)))
                  (local.set $out (i32.sub (local.get $out) (i32.const 1))) (br $back)))))
              (if (i32.eqz (local.get $out)) (then
                (call $shell_path_put (local.get $dst) (i32.const 0) (i32.const 92))
                (local.set $out (i32.const 1)) (local.set $floor (i32.const 1)))))
            (else
              (block $copy_done (loop $copy
                (br_if $copy_done (i32.ge_u (local.get $i) (local.get $end)))
                (call $shell_path_put (local.get $dst) (local.get $out) (call $shell_path_wc (local.get $src) (local.get $i)))
                (local.set $out (i32.add (local.get $out) (i32.const 1)))
                (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $copy)))
              (if (i32.lt_u (local.get $end) (local.get $len)) (then
                (call $shell_path_put (local.get $dst) (local.get $out) (i32.const 92))
                (local.set $out (i32.add (local.get $out) (i32.const 1)))))
              (if (i32.and (local.get $unc) (i32.ne (local.get $n) (i32.const 0))) (then
                (local.set $parts (i32.add (local.get $parts) (i32.const 1)))
                (if (i32.le_u (local.get $parts) (i32.const 2)) (then (local.set $floor (local.get $out))))))))))
      (local.set $i (i32.add (local.get $end) (i32.const 1))) (br $component)))
    (if (i32.and (i32.eq (local.get $out) (i32.const 2))
          (i32.eq (call $shell_path_wc (local.get $dst) (i32.const 1)) (i32.const 58))) (then
      (call $shell_path_put (local.get $dst) (local.get $out) (i32.const 92))
      (local.set $out (i32.add (local.get $out) (i32.const 1)))))
    (call $shell_path_put (local.get $dst) (local.get $out) (i32.const 0))
    (local.get $out))

  (func $shell_path_append_w (param $dst i32) (param $more i32) (result i32)
    (local $a i32) (local $b i32) (local $skip i32) (local $i i32) (local $n i32)
    (local $tmp i32) (local $out i32) (local $ok i32)
    (local.set $a (call $shell_path_wlen (local.get $dst) (i32.const 260)))
    (local.set $b (call $shell_path_wlen (local.get $more) (i32.const 260)))
    (if (i32.or (i32.lt_s (local.get $a) (i32.const 0)) (i32.lt_s (local.get $b) (i32.const 0)))
      (then (return (i32.const 0))))
    ;; A single leading slash is ignored; UNC and drive-qualified suffixes replace.
    (if (i32.and (i32.ne (local.get $b) (i32.const 0))
          (i32.eq (call $shell_path_wc (local.get $more) (i32.const 0)) (i32.const 92))) (then
      (if (i32.eq (call $shell_path_wc (local.get $more) (i32.const 1)) (i32.const 92))
        (then (local.set $a (i32.const 0))) (else (local.set $skip (i32.const 1))))))
    (if (i32.gt_u (local.get $b) (i32.const 1)) (then
      (if (i32.eq (call $shell_path_wc (local.get $more) (i32.const 1)) (i32.const 58))
        (then (local.set $a (i32.const 0))))))
    (local.set $n (i32.add (local.get $a) (i32.sub (local.get $b) (local.get $skip))))
    (if (i32.and (i32.ne (local.get $a) (i32.const 0)) (i32.gt_u (local.get $b) (local.get $skip))) (then
      (if (i32.ne (call $shell_path_wc (local.get $dst) (i32.sub (local.get $a) (i32.const 1))) (i32.const 92))
        (then (local.set $n (i32.add (local.get $n) (i32.const 1)))))))
    (if (i32.ge_u (local.get $n) (i32.const 260)) (then
      (if (i32.eqz (call $ptr_range_access_bad (local.get $dst) (i32.const 2) (i32.const 1)))
        (then (call $gs16 (local.get $dst) (i32.const 0)))) (return (i32.const 0))))
    (local.set $tmp (call $heap_alloc (i32.const 1044)))
    (if (i32.eqz (local.get $tmp)) (then (return (i32.const 0))))
    (local.set $out (i32.add (local.get $tmp) (i32.const 522)))
    (block $base_done (loop $base
      (br_if $base_done (i32.ge_u (local.get $i) (local.get $a)))
      (call $shell_path_put (local.get $tmp) (local.get $i) (call $shell_path_wc (local.get $dst) (local.get $i)))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $base)))
    (if (i32.gt_u (local.get $n) (i32.add (local.get $a) (i32.sub (local.get $b) (local.get $skip)))) (then
      (call $shell_path_put (local.get $tmp) (local.get $i) (i32.const 92))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))))
    (block $more_done (loop $suffix
      (br_if $more_done (i32.ge_u (local.get $skip) (local.get $b)))
      (call $shell_path_put (local.get $tmp) (local.get $i) (call $shell_path_wc (local.get $more) (local.get $skip)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (local.set $skip (i32.add (local.get $skip) (i32.const 1))) (br $suffix)))
    (call $shell_path_put (local.get $tmp) (local.get $i) (i32.const 0))
    (local.set $n (call $shell_path_canonical (local.get $tmp) (local.get $n) (local.get $out)))
    (if (i32.eqz (call $ptr_range_access_bad (local.get $dst)
          (i32.shl (i32.add (local.get $n) (i32.const 1)) (i32.const 1)) (i32.const 1))) (then
      (call $guest_wcscpy (local.get $dst) (local.get $out)) (local.set $ok (i32.const 1))))
    (call $heap_free (local.get $tmp)) (local.get $ok))

  (func $handle_PathAppendW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $shell_path_append_w (local.get $arg0) (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; PathAppendA(pszPath, pszMore): PathAppendW's rules over byte strings.
  ;; Every decision in $shell_path_append_w looks only at '\\', '.', ':' and
  ;; NUL, so widening each byte to a code unit and narrowing the result back is
  ;; exact for a single-byte code page. The narrowed result (the joined path,
  ;; or the emptied string PathAppendW's overflow rule leaves) is written back
  ;; only when it fits the caller's buffer.
  (func $handle_PathAppendA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wdst i32) (local $ok i32)
    (local.set $wdst (call $shell_path_widen_pair (local.get $arg0) (local.get $arg1)))
    (if (local.get $wdst) (then
      (local.set $ok (call $shell_path_append_w (local.get $wdst) (i32.add (local.get $wdst) (i32.const 520))))
      (if (i32.eqz (call $shell_path_narrow_into (local.get $arg0) (local.get $wdst)))
        (then (local.set $ok (i32.const 0))))
      (call $heap_free (local.get $wdst))))
    (i32.store offset=0 (global.get $reg_base) (local.get $ok))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; Widen two MAX_PATH byte strings into one heap block: the first at +0, the
  ;; second at +520. 0 when either is NULL, unreadable or unterminated.
  (func $shell_path_widen_pair (param $a_g i32) (param $b_g i32) (result i32)
    (local $a i32) (local $b i32) (local $w i32)
    (local.set $a (call $shell_path_alen (local.get $a_g)))
    (local.set $b (call $shell_path_alen (local.get $b_g)))
    (if (i32.or (i32.lt_s (local.get $a) (i32.const 0)) (i32.lt_s (local.get $b) (i32.const 0)))
      (then (return (i32.const 0))))
    (local.set $w (call $heap_alloc (i32.const 1040)))
    (if (i32.eqz (local.get $w)) (then (return (i32.const 0))))
    (call $shell_path_widen (local.get $w) (local.get $a_g) (local.get $a))
    (call $shell_path_widen (i32.add (local.get $w) (i32.const 520)) (local.get $b_g) (local.get $b))
    (local.get $w))

  ;; Widen one MAX_PATH byte string into a fresh heap buffer; 0 as above.
  (func $shell_path_widen_one (param $a_g i32) (result i32)
    (local $a i32) (local $w i32)
    (local.set $a (call $shell_path_alen (local.get $a_g)))
    (if (i32.lt_s (local.get $a) (i32.const 0)) (then (return (i32.const 0))))
    (local.set $w (call $heap_alloc (i32.const 520)))
    (if (i32.eqz (local.get $w)) (then (return (i32.const 0))))
    (call $shell_path_widen (local.get $w) (local.get $a_g) (local.get $a))
    (local.get $w))

  ;; Copy n bytes plus the terminator into code units.
  (func $shell_path_widen (param $dst i32) (param $src i32) (param $n i32)
    (local $i i32)
    (block $d (loop $l
      (call $shell_path_put (local.get $dst) (local.get $i) (call $gl8 (i32.add (local.get $src) (local.get $i))))
      (br_if $d (i32.ge_u (local.get $i) (local.get $n)))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $l))))

  ;; Narrow a MAX_PATH UTF-16 string back into a guest byte buffer; 0 when it
  ;; is unterminated or the destination cannot hold it.
  (func $shell_path_narrow_into (param $dst i32) (param $src i32) (result i32)
    (local $n i32) (local $i i32)
    (local.set $n (call $shell_path_wlen (local.get $src) (i32.const 260)))
    (if (i32.lt_s (local.get $n) (i32.const 0)) (then (return (i32.const 0))))
    (if (call $ptr_range_access_bad (local.get $dst) (i32.add (local.get $n) (i32.const 1)) (i32.const 1))
      (then (return (i32.const 0))))
    (block $d (loop $l
      (call $gs8 (i32.add (local.get $dst) (local.get $i)) (call $shell_path_wc (local.get $src) (local.get $i)))
      (br_if $d (i32.ge_u (local.get $i) (local.get $n)))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $l)))
    (i32.const 1))

  ;; Bounded byte-string length for the ANSI MAX_PATH shell APIs; -1 for NULL,
  ;; an unreadable byte, or no terminator within MAX_PATH.
  (func $shell_path_alen (param $path i32) (result i32)
    (local $n i32)
    (if (i32.eqz (local.get $path)) (then (return (i32.const -1))))
    (loop $scan
      (if (i32.ge_u (local.get $n) (i32.const 260)) (then (return (i32.const -1))))
      (if (call $ptr_range_access_bad (i32.add (local.get $path) (local.get $n)) (i32.const 1) (i32.const 0))
        (then (return (i32.const -1))))
      (if (i32.eqz (call $gl8 (i32.add (local.get $path) (local.get $n)))) (then (return (local.get $n))))
      (local.set $n (i32.add (local.get $n) (i32.const 1))) (br $scan))
    (i32.const -1))

  (func $shell_path_attrs_w (param $path i32) (param $len i32) (result i32)
    (local $copy i32) (local $attrs i32)
    ;; Per-call heap allocation avoids sharing a gather arena across Workers.
    (local.set $copy (call $heap_alloc (i32.shl (i32.add (local.get $len) (i32.const 1)) (i32.const 1))))
    (if (i32.eqz (local.get $copy)) (then (return (i32.const -1))))
    (call $guest_wcscpy (local.get $copy) (local.get $path))
    (local.set $attrs (call $host_fs_get_file_attributes (call $g2w (local.get $copy)) (i32.const 1)))
    (call $heap_free (local.get $copy)) (local.get $attrs))

  ;; PathFileExists core over a UTF-16 guest string; sets ERROR_FILE_NOT_FOUND
  ;; when the answer is FALSE.
  (func $shell_path_file_exists_w (param $arg0 i32) (result i32)
    (local $len i32) (local $found i32) (local $i i32) (local $slashes i32)
    (local.set $len (call $shell_path_wlen (local.get $arg0) (i32.const 260)))
    ;; UNC server/share roots are not file objects for this API.
    (if (i32.ge_s (local.get $len) (i32.const 2)) (then
      (if (i32.and (i32.eq (call $shell_path_wc (local.get $arg0) (i32.const 0)) (i32.const 92))
            (i32.eq (call $shell_path_wc (local.get $arg0) (i32.const 1)) (i32.const 92))) (then
        (local.set $i (i32.const 2))
        (block $unc_done (loop $unc_scan
          (br_if $unc_done (i32.ge_u (local.get $i) (local.get $len)))
          (if (i32.eq (call $shell_path_wc (local.get $arg0) (local.get $i)) (i32.const 92))
            (then (local.set $slashes (i32.add (local.get $slashes) (i32.const 1)))))
          (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $unc_scan)))
        (if (i32.lt_u (local.get $slashes) (i32.const 2)) (then (local.set $len (i32.const -1))))))))
    (if (i32.gt_s (local.get $len) (i32.const 0)) (then
      (local.set $found (i32.ne (call $shell_path_attrs_w (local.get $arg0) (local.get $len)) (i32.const -1)))))
    (if (i32.eqz (local.get $found)) (then (global.set $last_error (i32.const 2))))
    (local.get $found))

  (func $handle_PathFileExistsW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $shell_path_file_exists_w (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; PathFileExistsA(pszPath): widen the byte string and ask the same core.
  ;; NULL, unreadable or over-long input answers FALSE / ERROR_FILE_NOT_FOUND,
  ;; as the wide spelling does for the same input.
  (func $handle_PathFileExistsA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $w i32) (local $found i32)
    (local.set $w (call $shell_path_widen_one (local.get $arg0)))
    (if (local.get $w)
      (then
        (local.set $found (call $shell_path_file_exists_w (local.get $w)))
        (call $heap_free (local.get $w)))
      (else (global.set $last_error (i32.const 2))))
    (i32.store offset=0 (global.get $reg_base) (local.get $found))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))


  ;; Wide recursive directory creation uses actual VFS attributes and creation,
  ;; never a success-only stub. SECURITY_ATTRIBUTES descriptors are unsupported:
  ;; fail explicitly rather than silently accepting a security contract.
  (func $shell_create_directory_w (param $path i32) (param $security i32) (result i32)
    (local $len i32) (local $copy i32) (local $i i32) (local $ch i32)
    (local $attrs i32) (local $result i32) (local $wa i32) (local $bytes i32) (local $letter i32)
    (if (local.get $security) (then (return (i32.const 50)))) ;; ERROR_NOT_SUPPORTED
    (if (i32.eqz (local.get $path)) (then (return (i32.const 161))))
    (local.set $len (call $shell_path_wlen (local.get $path) (i32.const 248)))
    (if (i32.lt_s (local.get $len) (i32.const 0)) (then (return (i32.const 206))))
    (if (i32.eqz (local.get $path)) (then (return (i32.const 161))))
    (if (i32.lt_u (local.get $len) (i32.const 3)) (then (return (i32.const 161))))
    ;; No remote share provider exists; do not manufacture UNC directories.
    (if (i32.and (i32.eq (call $shell_path_wc (local.get $path) (i32.const 0)) (i32.const 92))
          (i32.eq (call $shell_path_wc (local.get $path) (i32.const 1)) (i32.const 92)))
      (then (return (i32.const 53)))) ;; ERROR_BAD_NETPATH
    ;; A fully-qualified local drive path is required.
    (if (i32.lt_u (local.get $len) (i32.const 3)) (then (return (i32.const 161))))
    (if (i32.or
          (i32.ne (call $shell_path_wc (local.get $path) (i32.const 1)) (i32.const 58))
          (i32.and (i32.ne (call $shell_path_wc (local.get $path) (i32.const 2)) (i32.const 92))
            (i32.ne (call $shell_path_wc (local.get $path) (i32.const 2)) (i32.const 47))))
      (then (return (i32.const 161))))
    (local.set $letter (i32.or (call $shell_path_wc (local.get $path) (i32.const 0)) (i32.const 32)))
    (if (i32.or (i32.lt_u (local.get $letter) (i32.const 97)) (i32.gt_u (local.get $letter) (i32.const 122)))
      (then (return (i32.const 161))))
    (local.set $i (i32.const 3))
    (block $valid (loop $validate
      (br_if $valid (i32.ge_u (local.get $i) (local.get $len)))
      (local.set $ch (call $shell_path_wc (local.get $path) (local.get $i)))
      (if (i32.or (i32.lt_u (local.get $ch) (i32.const 32))
            (i32.or (i32.eq (local.get $ch) (i32.const 58))
              (i32.or (i32.eq (local.get $ch) (i32.const 42))
                (i32.or (i32.eq (local.get $ch) (i32.const 63))
                  (i32.or (i32.eq (local.get $ch) (i32.const 34))
                    (i32.or (i32.eq (local.get $ch) (i32.const 60))
                      (i32.or (i32.eq (local.get $ch) (i32.const 62)) (i32.eq (local.get $ch) (i32.const 124)))))))))
        (then (return (i32.const 123)))) ;; ERROR_INVALID_NAME
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $validate)))
    (local.set $copy (call $heap_alloc (i32.const 520)))
    (if (i32.eqz (local.get $copy)) (then (return (i32.const 8))))
    (call $guest_wcscpy (local.get $copy) (local.get $path))
    (local.set $i (i32.const 2))
    (block $slashes_done (loop $slashes
      (br_if $slashes_done (i32.ge_u (local.get $i) (local.get $len)))
      (if (i32.eq (call $shell_path_wc (local.get $copy) (local.get $i)) (i32.const 47))
        (then (call $shell_path_put (local.get $copy) (local.get $i) (i32.const 92))))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $slashes)))
    ;; Trim trailing separators before leaf/existing classification.
    (block $trim_done (loop $trim
      (br_if $trim_done (i32.le_u (local.get $len) (i32.const 3)))
      (br_if $trim_done (i32.ne (call $shell_path_wc (local.get $copy) (i32.sub (local.get $len) (i32.const 1))) (i32.const 92)))
      (local.set $len (i32.sub (local.get $len) (i32.const 1)))
      (call $shell_path_put (local.get $copy) (local.get $len) (i32.const 0)) (br $trim)))
    (local.set $ch (call $shell_path_wc (local.get $copy) (i32.const 3)))
    (call $shell_path_put (local.get $copy) (i32.const 3) (i32.const 0))
    (local.set $attrs (call $shell_path_attrs_w (local.get $copy) (i32.const 3)))
    (call $shell_path_put (local.get $copy) (i32.const 3) (local.get $ch))
    (if (i32.or (i32.eq (local.get $attrs) (i32.const -1))
          (i32.eqz (i32.and (local.get $attrs) (i32.const 16)))) (then
      (call $heap_free (local.get $copy)) (return (i32.const 3))))
    (local.set $i (i32.const 3))
    (block $done (loop $walk
      (local.set $ch (call $shell_path_wc (local.get $copy) (local.get $i)))
      (if (i32.or (i32.eqz (local.get $ch)) (i32.eq (local.get $ch) (i32.const 92))) (then
        (call $shell_path_put (local.get $copy) (local.get $i) (i32.const 0))
        (local.set $attrs (call $shell_path_attrs_w (local.get $copy) (local.get $i)))
        (if (i32.ne (local.get $attrs) (i32.const -1))
          (then
            (if (i32.eqz (i32.and (local.get $attrs) (i32.const 16)))
              (then
                (local.set $result (select (i32.const 183) (i32.const 3) (i32.eqz (local.get $ch))))
                (br $done)))
            (if (i32.eqz (local.get $ch)) (then (local.set $result (i32.const 183)))))
          (else
            (local.set $attrs (call $host_fs_create_directory (call $g2w (local.get $copy)) (i32.const 1)))
            (if (i32.eqz (local.get $attrs)) (then (local.set $result (i32.const 5)) (br $done)))))
        (call $shell_path_put (local.get $copy) (local.get $i) (local.get $ch))))
      (br_if $done (i32.eqz (local.get $ch)))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $walk)))
    (call $heap_free (local.get $copy)) (local.get $result))

  (func $handle_SHCreateDirectoryExW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $shell_create_directory_w (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))
