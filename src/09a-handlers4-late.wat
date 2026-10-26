;; Does [ptr, ptr+len) lack the requested access? $g2w answers whether every
  ;; crossed page is backed. Sparse VirtualAlloc pages additionally retain the
  ;; caller's exact PAGE_* value in their packed PTE, so these cold probe APIs
  ;; can honor NOACCESS, GUARD and read/write distinctions without adding a
  ;; permission branch to the emulator's hot load/store path. Direct image,
  ;; heap and DIB pages remain permissive until they gain equivalent metadata.
  ;;
  ;; The previous test was a flat "above 0x02000000 is bad", which stopped being
  ;; true long ago: the sparse heap and VirtualAlloc arena live up near
  ;; 0x3F800000, and an app's own stack sits well above the cutoff too (the
  ;; Direct3D viewer runs on one at 0x074FFxxx). A caller handing us a stack
  ;; buffer — the ordinary way to use this API — was told its own frame was
  ;; unreadable.
  (func $ptr_range_access_bad
      (param $ptr i32) (param $len i32) (param $write i32) (result i32)
    (local $last i32) (local $cur i32) (local $pte i32) (local $protect i32)
    ;; A zero-length range is accessible even when ptr is NULL.
    (if (i32.eqz (local.get $len)) (then (return (i32.const 0))))
    (if (i32.eqz (local.get $ptr)) (then (return (i32.const 1))))
    (local.set $last (i32.add (local.get $ptr) (i32.sub (local.get $len) (i32.const 1))))
    (if (i32.lt_u (local.get $last) (local.get $ptr)) (then (return (i32.const 1))))
    (local.set $cur (local.get $ptr))
    (block $done (loop $pages
      (if (i32.eq (call $g2w (local.get $cur)) (global.get $NULL_SENTINEL))
        (then (return (i32.const 1))))
      (local.set $pte
        (i32.atomic.load
          (i32.add (global.get $GUEST_PAGE_TABLE)
            (i32.and (i32.shr_u (local.get $cur) (i32.const 10))
              (i32.const 0x003FFFFC)))))
      (if (i32.and (local.get $pte) (global.get $GUEST_PTE_PRESENT))
        (then
          (local.set $protect
            (i32.and (local.get $pte) (global.get $GUEST_PTE_PROTECT_MASK)))
          ;; Guard pages fail a system-service probe. PAGE_NOCACHE does not
          ;; change access. For mapped pages, WRITECOPY remains writable.
          (if (i32.and (local.get $protect) (i32.const 0x100))
            (then (return (i32.const 1))))
          (local.set $protect (i32.and (local.get $protect) (i32.const 0xFF)))
          (if (local.get $write)
            (then
              (if (i32.eqz (i32.or
                    (i32.or
                      (i32.eq (local.get $protect) (i32.const 0x04))
                      (i32.eq (local.get $protect) (i32.const 0x08)))
                    (i32.or
                      (i32.eq (local.get $protect) (i32.const 0x40))
                      (i32.eq (local.get $protect) (i32.const 0x80)))))
                (then (return (i32.const 1)))))
            (else
              (if (i32.eqz (i32.or
                    (i32.or
                      (i32.eq (local.get $protect) (i32.const 0x02))
                      (i32.eq (local.get $protect) (i32.const 0x04)))
                    (i32.or
                      (i32.or
                        (i32.eq (local.get $protect) (i32.const 0x08))
                        (i32.eq (local.get $protect) (i32.const 0x20)))
                      (i32.or
                        (i32.eq (local.get $protect) (i32.const 0x40))
                        (i32.eq (local.get $protect) (i32.const 0x80))))))
                (then (return (i32.const 1))))))))
      (br_if $done
        (i32.le_u (local.get $last) (i32.or (local.get $cur) (i32.const 0xFFF))))
      (local.set $cur
        (i32.add (i32.or (local.get $cur) (i32.const 0xFFF)) (i32.const 1)))
      (br $pages)))
    (i32.const 0))

  (func $ptr_range_bad (param $ptr i32) (param $len i32) (result i32)
    (call $ptr_range_access_bad
      (local.get $ptr) (local.get $len) (i32.const 0)))

  ;; 343: IsBadReadPtr(lp, ucb) → BOOL. Nonzero means the range is NOT readable.
  (func $handle_IsBadReadPtr (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $ptr_range_access_bad
      (local.get $arg0) (local.get $arg1) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; 344: IsBadWritePtr(lp, ucb) → BOOL.
  (func $handle_IsBadWritePtr (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $ptr_range_access_bad
      (local.get $arg0) (local.get $arg1) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))  ;; stdcall, 2 args
  )

  ;; Guarded copies in the current process. Check the complete source and
  ;; destination, including the optional output count, before changing bytes.
  (func $process_memory_copy (param $process i32) (param $dst i32)
      (param $src i32) (param $size i32) (param $count i32) (result i32)
    (if (local.get $count) (then
      (if (call $ptr_range_access_bad (local.get $count) (i32.const 4) (i32.const 1))
        (then (global.set $last_error (i32.const 998)) (return (i32.const 0))))
      (if (i32.eqz (call $thunk_patch_prepare (local.get $count) (i32.const 4))) (then (return (i32.const 0))))
      (call $gs32 (local.get $count) (i32.const 0))))
    (if (i32.eqz (call $current_process_handle_valid (local.get $process)))
      (then (global.set $last_error (i32.const 6)) (return (i32.const 0))))
    (if (i32.or
          (call $ptr_range_access_bad (local.get $src) (local.get $size) (i32.const 0))
          (call $ptr_range_access_bad (local.get $dst) (local.get $size) (i32.const 1)))
      (then (global.set $last_error (i32.const 299)) (return (i32.const 0))))
    (if (i32.eqz (call $thunk_patch_prepare (local.get $dst) (local.get $size)))
      (then (return (i32.const 0))))
    ;; The copy handles sparse backing and local invalidation. Publish the
    ;; process generation after writing so other instances retire stale code.
    (call $guest_memmove (local.get $dst) (local.get $src) (local.get $size))
    (if (local.get $size) (then
      (call $process_code_cache_invalidate (local.get $dst) (local.get $size))))
    (if (local.get $count) (then (call $gs32 (local.get $count) (local.get $size))))
    (i32.const 1))
  (func $handle_ReadProcessMemory (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store (global.get $reg_base) (call $process_memory_copy
      (local.get $arg0) (local.get $arg2) (local.get $arg1) (local.get $arg3)
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
  (func $handle_WriteProcessMemory (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store (global.get $reg_base) (call $process_memory_copy
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  ;; 345: SetUnhandledExceptionFilter(lpTopLevelFilter) -> previous filter.
  ;;
  ;; The comment used to say "store filter" while the body stored nothing and
  ;; returned a constant 0. Both halves matter: a CRT installs its filter at
  ;; startup and a DLL that installs its own is expected to chain to whatever
  ;; it displaced, so returning a fabricated 0 tells every caller it is the
  ;; first one and loses the filter the previous caller had installed.
  (func $handle_SetUnhandledExceptionFilter (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (global.get $unhandled_exception_filter))
    (global.set $unhandled_exception_filter (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; AddVectoredExceptionHandler(First, Handler) -> opaque handle. ScummVM
  ;; installs this as a defensive crash reporter during startup. Keep the
  ;; registration coherent with RemoveVectoredExceptionHandler; the existing
  ;; SEH/top-level-filter machinery remains authoritative for delivered faults.
  (func $handle_AddVectoredExceptionHandler (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (drop (local.get $arg0))
    (global.set $vectored_exception_handler (local.get $arg1))
    (i32.store offset=0 (global.get $reg_base) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; RemoveVectoredExceptionHandler(Handle) -> ULONG.
  (func $handle_RemoveVectoredExceptionHandler (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.and
          (i32.ne (local.get $arg0) (i32.const 0))
          (i32.eq (local.get $arg0) (global.get $vectored_exception_handler)))
      (then
        (global.set $vectored_exception_handler (i32.const 0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1)))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; 937: SetPriorityClass(hProcess, dwPriorityClass). Publish the selected
  ;; Win98 class process-wide; the browser scheduler remains cooperative, but
  ;; callers must observe truthful state and failures instead of fixed success.
  (func $handle_SetPriorityClass (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
    (if (i32.eqz (call $current_process_handle_valid (local.get $arg0)))
      (then
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (if (i32.eqz (call $win98_process_priority_valid (local.get $arg1)))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (i32.atomic.store offset=8
      (global.get $SHARED_COUNTERS) (local.get $arg1))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
  )

  ;; SetProcessShutdownParameters(dwLevel, dwFlags) — record the process's
  ;; shutdown ordering so the matching Get* returns what was set. Explorer sets
  ;; a low level so it shuts down after the apps it hosts. Win32 accepts levels
  ;; through the system-reserved first-shutdown band (0x400-0x4ff), and the
  ;; only defined flag is SHUTDOWN_NORETRY.
  (func $handle_SetProcessShutdownParameters (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
    (if (i32.or
          (i32.gt_u (local.get $arg0) (i32.const 0x4ff))
          (i32.ne (i32.and (local.get $arg1) (i32.const -2)) (i32.const 0)))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (global.set $shutdown_level (local.get $arg0))
    (global.set $shutdown_flags (local.get $arg1))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
  )

  ;; GetProcessShutdownParameters(lpdwLevel, lpdwFlags) — report stored values.
  (func $handle_GetProcessShutdownParameters (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
    (if (i32.or (i32.eqz (local.get $arg0)) (i32.eqz (local.get $arg1)))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (call $gs32 (local.get $arg0) (global.get $shutdown_level))
    (call $gs32 (local.get $arg1) (global.get $shutdown_flags))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
  )

  ;; The browser hosts one Win32 process. Accept its contextual pseudo-handle
  ;; and the durable handle OpenProcess issues for its stable PID; no other
  ;; numeric value names a process object in this runtime.
  (func $current_process_handle_valid (param $handle i32) (result i32)
    (i32.or
      (i32.eq (local.get $handle) (i32.const -1))
      (i32.eq (local.get $handle)
        (i32.or (i32.const 0x000e2000)
          (i32.and (call $current_process_id) (i32.const 0x0fff))))))

  ;; Windows 98 exposes the original four process classes. The later
  ;; ABOVE_NORMAL/BELOW_NORMAL and background-mode values must not be accepted
  ;; merely because a modern header assigns them constants.
  (func $win98_process_priority_valid (param $class i32) (result i32)
    (i32.or
      (i32.or
        (i32.eq (local.get $class) (i32.const 0x20))  ;; NORMAL_PRIORITY_CLASS
        (i32.eq (local.get $class) (i32.const 0x40))) ;; IDLE_PRIORITY_CLASS
      (i32.or
        (i32.eq (local.get $class) (i32.const 0x80))  ;; HIGH_PRIORITY_CLASS
        (i32.eq (local.get $class) (i32.const 0x100))))) ;; REALTIME_PRIORITY_CLASS

  ;; A zero shared cell is the fresh-process default, NORMAL_PRIORITY_CLASS.
  ;; Once SetPriorityClass runs it publishes the explicit class atomically so
  ;; cooperative and real Worker instances see one process-wide value.
  (func $process_priority_class_get (result i32)
    (local $class i32)
    (local.set $class
      (i32.atomic.load offset=8 (global.get $SHARED_COUNTERS)))
    (select (local.get $class) (i32.const 0x20)
      (i32.ne (local.get $class) (i32.const 0))))

  ;; 1264: GetPriorityClass(hProcess) — return the retained process class.
  (func $handle_GetPriorityClass (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
    (if (i32.eqz (call $current_process_handle_valid (local.get $arg0)))
      (then
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (i32.store offset=0 (global.get $reg_base) (call $process_priority_class_get))
  )

  ;; 1265: GetThreadPriority(hThread). The host owns thread HANDLE identity;
  ;; pass the contextual Win32 tid as well so pseudo-handle -2 resolves to the
  ;; calling guest thread rather than always meaning the UI thread.
  (func $handle_GetThreadPriority (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $priority i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
    (local.set $priority (call $host_get_thread_priority
      (local.get $arg0) (global.get $current_thread_id)))
    (if (i32.eq (local.get $priority) (i32.const 0x7fffffff))
      (then (global.set $last_error (i32.const 6)))) ;; ERROR_INVALID_HANDLE
    (i32.store offset=0 (global.get $reg_base) (local.get $priority))
  )

  ;; 1266: GetUpdateRgn(hWnd, hRgn, bErase) — copy updateRgn into hRgn.
  (func $handle_GetUpdateRgn (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $rv i32) (local $rect i32)
    (local.set $rect (call $paint_scratch_take))
    (local.set $rv (call $update_get_rect (local.get $arg0) (local.get $rect)))
    (if (i32.and (i32.ne (local.get $rv) (i32.const 0)) (i32.ne (local.get $arg1) (i32.const 0)))
      (then
        (drop (call $gdi_rgn_set_rect
          (local.get $arg1)
          (load.field PaintRect left (local.get $rect))
          (load.field.memarg PaintRect top (local.get $rect))
          (load.field.memarg PaintRect right (local.get $rect))
          (load.field.memarg PaintRect bottom (local.get $rect))))))
    ;; Win16 USER returned this runtime's historical BOOL-shaped result here.
    ;; Several VB-era libraries check only zero/non-zero instead of the Win32
    ;; region complexity constants; preserve that ABI for thunked callers.
    (if (global.get $code16)
      (then
        (i32.store offset=0 (global.get $reg_base) (select (i32.const 1) (i32.const 0) (local.get $rv)))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    ;; Win32 returns a region type: SIMPLEREGION (2) for the one rectangle we
    ;; track, NULLREGION (1) when nothing is pending. ERROR (0) is reserved for
    ;; a bad window, and Storm treats anything else as pending content.
    (if (i32.eqz (call $wnd_table_get (local.get $arg0)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (i32.store offset=0 (global.get $reg_base) (select (i32.const 2) (i32.const 1) (local.get $rv)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 346: IsDebuggerPresent — no guest debugger is attached.
  (func $handle_IsDebuggerPresent (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; 347: lstrcpynW — copy up to n wide chars
  (func $handle_lstrcpynW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lstr_cpyn (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 1))
    (i32.store offset=0 (global.get $reg_base) (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 348: FindFirstFileW — STUB: unimplemented
  (func $handle_FindFirstFileW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; FindFirstFileW(lpFileName, lpFindFileData) — 2 args
    (i32.store offset=0 (global.get $reg_base) (call $host_fs_find_first_file
      (call $g2w (local.get $arg0)) (local.get $arg1) (i32.const 1)))
    (if (i32.eq (i32.load offset=0 (global.get $reg_base)) (i32.const -1))
      (then (global.set $last_error (i32.const 2)))) ;; ERROR_FILE_NOT_FOUND
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 349: GetFileAttributesW — STUB: unimplemented
  (func $handle_GetFileAttributesW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $attrs i32)
    ;; GetFileAttributesW(lpFileName) — 1 arg
    (local.set $attrs (call $host_fs_get_file_attributes
      (call $g2w (local.get $arg0)) (i32.const 1)))
    (i32.store offset=0 (global.get $reg_base) (local.get $attrs))
    (if (i32.eq (local.get $attrs) (i32.const -1))
      (then (global.set $last_error (i32.const 2)))) ;; ERROR_FILE_NOT_FOUND
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 350: GetShortPathNameW — STUB: unimplemented
  (func $handle_GetShortPathNameW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; GetShortPathNameW(lpszLongPath, lpszShortPath, cchBuffer) — 3 args
    (i32.store offset=0 (global.get $reg_base) (call $host_fs_get_short_path_name
      (call $g2w (local.get $arg0)) (local.get $arg1) (local.get $arg2) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 351: CreateDirectoryW — STUB: unimplemented
  (func $handle_CreateDirectoryW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $path_wa i32)
    (local.set $path_wa (call $g2w (local.get $arg0)))
    ;; CreateDirectoryW(lpPathName, lpSecurityAttributes) — 2 args
    (i32.store offset=0 (global.get $reg_base) (call $host_fs_create_directory
      (local.get $path_wa) (i32.const 1)))
    (if (i32.load offset=0 (global.get $reg_base))
      (then (global.set $last_error (i32.const 0)))
      (else
        (global.set $last_error
          (if (result i32)
            (i32.ne (call $host_fs_get_file_attributes
              (local.get $path_wa) (i32.const 1)) (i32.const -1))
            (then (i32.const 183)) ;; ERROR_ALREADY_EXISTS
            (else (i32.const 5)))))) ;; ERROR_ACCESS_DENIED
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 352: IsDBCSLeadByte(ch)
  (func $handle_IsDBCSLeadByte (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $is_dbcs_lead_byte (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; IsDBCSLeadByteEx(CodePage, BYTE TestChar). Classification only: no trail
  ;; byte or character conversion. Reuse the same ranges as the MBCS helpers.
  (func $handle_IsDBCSLeadByteEx (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $cp i32) (local $locale i32)
    (local.set $cp (local.get $arg0))
    (if (i32.eqz (local.get $cp))
      (then (local.set $cp (global.get $ansi_code_page))))
    ;; Match GetOEMCP's system default, independent of console output state.
    (if (i32.eq (local.get $cp) (i32.const 1))
      (then (local.set $cp (i32.const 437))))
    ;; CP_THREAD_ACP follows the caller's retained LCID, not the process ACP.
    ;; Only the concrete locales below are implemented; unknown locales fail
    ;; through the page validator instead of silently claiming ANSI behavior.
    (if (i32.eq (local.get $cp) (i32.const 3))
      (then
        (local.set $locale (i32.and
          (call $host_get_thread_locale (global.get $current_thread_id)) (i32.const 0xFFFF)))
        (local.set $cp (i32.const -1))
        (if (i32.eq (local.get $locale) (i32.const 0x0409))
          (then (local.set $cp (i32.const 1252))))
        (if (i32.eq (local.get $locale) (i32.const 0x0411))
          (then (local.set $cp (i32.const 932))))
        (if (i32.eq (local.get $locale) (i32.const 0x0412))
          (then (local.set $cp (i32.const 949))))
        (if (i32.or (i32.eq (local.get $locale) (i32.const 0x0804))
                    (i32.eq (local.get $locale) (i32.const 0x1004)))
          (then (local.set $cp (i32.const 936))))
        (if (i32.or (i32.eq (local.get $locale) (i32.const 0x0404))
              (i32.or (i32.eq (local.get $locale) (i32.const 0x0C04))
                      (i32.eq (local.get $locale) (i32.const 0x1404))))
          (then (local.set $cp (i32.const 950))))))
    ;; CP_MACCP uses the default US Macintosh page (10000) in this runtime.
    (if (i32.eq (local.get $cp) (i32.const 2))
      (then (local.set $cp (i32.const 10000))))
    (if (i32.or
          (call $is_supported_code_page (local.get $cp))
          (i32.or (i32.eq (local.get $cp) (i32.const 10000))
            (i32.or (i32.eq (local.get $cp) (i32.const 65000))
                    (i32.eq (local.get $cp) (i32.const 65001)))))
      (then
        (i32.store offset=0 (global.get $reg_base)
          (call $is_dbcs_lead_byte_for_cp (local.get $cp) (local.get $arg1))))
      (else
        (global.set $last_error (i32.const 87)) ;; unsupported/invalid code page
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 353: GetTempPathW — STUB: unimplemented
  (func $handle_GetTempPathW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; GetTempPathW(nBufferLength, lpBuffer) — 2 args
    (i32.store offset=0 (global.get $reg_base) (call $host_fs_get_temp_path
      (local.get $arg0) (local.get $arg1) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 354: GetTempFileNameW — STUB: unimplemented
  (func $handle_GetTempFileNameW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; GetTempFileNameW(lpPathName, lpPrefixString, uUnique, lpTempFileName) — 4 args
    (i32.store offset=0 (global.get $reg_base) (call $host_fs_get_temp_file_name
      (call $g2w (local.get $arg0)) (call $g2w (local.get $arg1)) (local.get $arg2) (local.get $arg3) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; 355: lstrcatW(dst, src) — concatenate wide strings, return dst
  (func $handle_lstrcatW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lstr_cat (local.get $arg0) (local.get $arg1) (i32.const 1))
    (i32.store offset=0 (global.get $reg_base) (local.get $arg0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))  ;; stdcall, 2 args
  )

  ;; 356: GlobalHandle — GlobalLock is identity for our fixed direct-pointer
  ;; representation, after exact live GlobalAlloc provenance validation.
  (func $handle_GlobalHandle (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_GlobalLock
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

ctl32 can route an ANSI status-bar string through ExtTextOutW
  ;; as packed byte pairs. Recognize only a printable byte string terminated
  ;; within the supplied UTF-16 span; ordinary UTF-16 ASCII has zero high
  ;; bytes and cannot match. The count can extend past the ANSI terminator
  ;; because the control obtained it by running lstrlenW over the byte buffer.
  (func $gdi_ext_text_out_w_packed_ansi_len (param $text i32) (param $count i32) (result i32)
    (local $i i32) (local $limit i32) (local $ch i32)
    (if (i32.or (i32.eqz (local.get $text))
          (i32.or (i32.le_s (local.get $count) (i32.const 0))
            (i32.gt_u (local.get $count) (i32.const 0x7FFF))))
      (then (return (i32.const 0))))
    (if (i32.eqz (i32.load8_u offset=1 (local.get $text)))
      (then (return (i32.const 0))))
    (local.set $limit (i32.shl (local.get $count) (i32.const 1)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $limit)))
      (local.set $ch (i32.load8_u (i32.add (local.get $text) (local.get $i))))
      (if (i32.eqz (local.get $ch))
        (then (return (local.get $i))))
      (if (i32.and
            (i32.or (i32.lt_u (local.get $ch) (i32.const 0x20))
              (i32.gt_u (local.get $ch) (i32.const 0x7E)))
            (i32.and (i32.ne (local.get $ch) (i32.const 9))
              (i32.and (i32.ne (local.get $ch) (i32.const 10))
                (i32.ne (local.get $ch) (i32.const 13)))))
        (then (return (i32.const 0))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (if (i32.eqz (i32.load8_u (i32.add (local.get $text) (local.get $limit))))
      (then (return (local.get $limit))))
    (i32.const 0))

rushOrgEx(hdc, x, y, lppt) — canonical WAT-owned brush origin.
  (func $handle_SetBrushOrgEx (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32) (local $old_x i32) (local $old_y i32) (local $aux i32)
    (local.set $aux (call $gdi_dc_aux_entry (local.get $arg0) (i32.const 1)))
    (if (i32.eqz (local.get $aux))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (local.set $old_x (call $gdi_dc_aux_get (local.get $arg0) (i32.const 8) (i32.const 0)))
    (local.set $old_y (call $gdi_dc_aux_get (local.get $arg0) (i32.const 12) (i32.const 0)))
    (if (local.get $arg3)
      (then
        (local.set $wa (call $g2w (local.get $arg3)))
        (store.field Point x (local.get $wa) (local.get $old_x))
        (store.field Point y (local.get $wa) (local.get $old_y))
      )
    )
    (drop (call $gdi_dc_aux_set (local.get $arg0) (i32.const 8)
      (local.get $arg1) (i32.const 0)))
    (drop (call $gdi_dc_aux_set (local.get $arg0) (i32.const 12)
      (local.get $arg2) (i32.const 0)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))  ;; stdcall, 4 args
  )

  ;; Heap-backed USER hook node layout (guest pointer returned as HHOOK):
  ;;   magic "HOK1" while live, proc, next, retired-list link
  ;; Removed nodes stay allocated while any hook callback is active. A hook
  ;; can unhook itself (or an older active hook) and still return safely.
  (func $hook_head_get (param $id_hook i32) (result i32)
    (if (i32.eq (local.get $id_hook) (i32.const 2))
      (then (return (global.get $keyboard_hook_head))))
    (if (i32.eq (local.get $id_hook) (i32.const 5))
      (then (return (global.get $cbt_hook_head))))
    (i32.const 0))

  (func $hook_node_proc (param $node i32) (result i32)
    (if (i32.eqz (local.get $node)) (then (return (i32.const 0))))
    (load.field.memarg HookNode proc (call $g2w (local.get $node))))

  (func $hook_head_set (param $id_hook i32) (param $node i32)
    (local $proc i32)
    (local.set $proc (call $hook_node_proc (local.get $node)))
    (if (i32.eq (local.get $id_hook) (i32.const 2))
      (then
        (global.set $keyboard_hook_head (local.get $node))
        (global.set $keyboard_hook_proc (local.get $proc))
        (return)))
    (if (i32.eq (local.get $id_hook) (i32.const 5))
      (then
        (global.set $cbt_hook_head (local.get $node))
        (global.set $cbt_hook_proc (local.get $proc)))))

  (func $hook_next_live (param $node i32) (result i32)
    (local $wa i32)
    (if (local.get $node)
      (then
        (local.set $wa (load.field HookNode magic (call $g2w (local.get $node))))
        (if (i32.or (i32.eq (local.get $wa) (i32.const 0x31484D47))
                    (i32.eq (local.get $wa) (i32.const 0x30484D47)))
          (then (return (call $getmessage_hook_next (local.get $node)))))))
    (if (local.get $node)
      (then
        (local.set $node
          (load.field.memarg HookNode next (call $g2w (local.get $node))))))
    (block $done (loop $scan
      (br_if $done (i32.eqz (local.get $node)))
      (local.set $wa (call $g2w (local.get $node)))
      (br_if $done
        (i32.eq (load.field HookNode magic (local.get $wa))
          (i32.const 0x314B4F48)))
      (local.set $node (load.field.memarg HookNode next (local.get $wa)))
      (br $scan)))
    (local.get $node))

  (func $hook_reap_retired
    (local $node i32) (local $next i32)
    (if (global.get $hook_dispatch_depth) (then (return)))
    (local.set $node (global.get $hook_retired_head))
    (global.set $hook_retired_head (i32.const 0))
    (block $done (loop $reap
      (br_if $done (i32.eqz (local.get $node)))
      (local.set $next
        (load.field.memarg HookNode retired_next
          (call $g2w (local.get $node))))
      (call $heap_free (local.get $node))
      (local.set $node (local.get $next))
      (br $reap))))

  (func $hook_retire (param $node i32)
    (local $wa i32)
    (local.set $wa (call $g2w (local.get $node)))
    (store.field HookNode magic (local.get $wa) (i32.const 0))
    (if (global.get $hook_dispatch_depth)
      (then
        (store.field.memarg HookNode retired_next (local.get $wa)
          (global.get $hook_retired_head))
        (global.set $hook_retired_head (local.get $node)))
      (else (call $heap_free (local.get $node)))))

  (func $hook_dispatch_enter (param $id_hook i32) (result i32)
    (local $node i32)
    (local.set $node (call $hook_head_get (local.get $id_hook)))
    (if (i32.eqz (local.get $node)) (then (return (i32.const 0))))
    (global.set $hook_active_node (local.get $node))
    (global.set $hook_dispatch_depth
      (i32.add (global.get $hook_dispatch_depth) (i32.const 1)))
    (call $hook_node_proc (local.get $node)))

  (func $hook_dispatch_leave (param $previous i32)
    (global.set $hook_active_node (local.get $previous))
    (if (global.get $hook_dispatch_depth)
      (then
        (global.set $hook_dispatch_depth
          (i32.sub (global.get $hook_dispatch_depth) (i32.const 1)))))
    (call $hook_reap_retired))

  (func $hook_remove_handle_from
      (param $id_hook i32) (param $handle i32) (result i32)
    (local $prev i32) (local $node i32) (local $next i32) (local $wa i32)
    (local.set $node (call $hook_head_get (local.get $id_hook)))
    (block $missing (loop $scan
      (br_if $missing (i32.eqz (local.get $node)))
      (local.set $wa (call $g2w (local.get $node)))
      (local.set $next (load.field.memarg HookNode next (local.get $wa)))
      (if (i32.eq (local.get $node) (local.get $handle))
        (then
          (if (local.get $prev)
            (then
              (store.field.memarg HookNode next (call $g2w (local.get $prev))
                (local.get $next)))
            (else
              (call $hook_head_set (local.get $id_hook) (local.get $next))))
          (call $hook_retire (local.get $node))
          (return (i32.const 1))))
      (local.set $prev (local.get $node))
      (local.set $node (local.get $next))
      (br $scan)))
    (i32.const 0))

  (func $hook_remove_proc
      (param $id_hook i32) (param $proc i32) (result i32)
    (local $node i32)
    (local.set $node (call $hook_head_get (local.get $id_hook)))
    (block $missing (loop $scan
      (br_if $missing (i32.eqz (local.get $node)))
      (if (i32.eq (call $hook_node_proc (local.get $node)) (local.get $proc))
        (then
          (return
            (call $hook_remove_handle_from
              (local.get $id_hook) (local.get $node)))))
      (local.set $node
        (load.field.memarg HookNode next (call $g2w (local.get $node))))
      (br $scan)))
    (i32.const 0))

  ;; CallNextHookEx ignores hhk and enters the next live procedure in the
  ;; currently executing chain. HKN1 leaves EAX untouched so the exact next
  ;; hook LRESULT reaches the suspended caller.
  (func $handle_CallNextHookEx (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $next i32) (local $ret i32)
    ;; CallNextHookEx(hhk, nCode, wParam, lParam) — 4 args stdcall
    (local.set $next (call $hook_next_live (global.get $hook_active_node)))
    (if (i32.eqz (local.get $next))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (local.set $ret (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
    ;; Context below the next HookProc frame: magic, CallNext caller, current.
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $hook_active_node))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $ret))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0x314E4B48)) ;; "HKN1"
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $arg3))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $arg2))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $font_enum_ret_thunk))
    (global.set $hook_active_node (local.get $next))
    (global.set $eip (call $hook_node_proc (local.get $next)))
    (global.set $steps (i32.const 0))
  )

  ;; USER models process-local WH_KEYBOARD and WH_CBT chains. New hooks are
  ;; prepended, matching SetWindowsHookEx ordering; the node pointer is HHOOK.
  (func $install_supported_hook (param $id_hook i32) (param $proc i32) (result i32)
    (local $node i32) (local $wa i32)
    (if (i32.eqz (local.get $proc))
      (then (return (i32.const 0))))
    (if (i32.and
          (i32.ne (local.get $id_hook) (i32.const 2))
          (i32.ne (local.get $id_hook) (i32.const 5)))
      (then (return (i32.const 0))))
    (local.set $node (call $heap_alloc (size-of HookNode)))
    (if (i32.eqz (local.get $node)) (then (return (i32.const 0))))
    (local.set $wa (call $g2w (local.get $node)))
    (store.field HookNode magic (local.get $wa)
      (i32.const 0x314B4F48)) ;; "HOK1"
    (store.field.memarg HookNode proc (local.get $wa) (local.get $proc))
    (store.field.memarg HookNode next (local.get $wa)
      (call $hook_head_get (local.get $id_hook)))
    (store.field.memarg HookNode retired_next (local.get $wa) (i32.const 0))
    (call $hook_head_set (local.get $id_hook) (local.get $node))
    (local.get $node)
  )

  ;; 380: UnhookWindowsHookEx(hhk) → BOOL
  (func $handle_UnhookWindowsHookEx (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $removed i32)
    (if (call $getmessage_hook_remove (local.get $arg0))
      (then
        (i32.store (global.get $reg_base) (i32.const 1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (local.set $removed
      (call $hook_remove_handle_from (i32.const 2) (local.get $arg0)))
    (if (i32.eqz (local.get $removed))
      (then
        (local.set $removed
          (call $hook_remove_handle_from (i32.const 5) (local.get $arg0)))))
    (i32.store offset=0 (global.get $reg_base) (local.get $removed))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; 854: UnhookWindowsHook(nCode, pfnFilterProc) → BOOL — legacy version
  (func $handle_UnhookWindowsHook (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $hook_remove_proc (local.get $arg0) (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; 381: SetWindowsHookExW — same class-specific handle as the A path.
  ;; SetWindowsHookExW(idHook, lpfn, hMod, dwThreadId) — the hook proc is a
  ;; code pointer, so there is nothing to widen; the A path is the whole story.
  (func $handle_SetWindowsHookExW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_SetWindowsHookExA
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; SetWindowsHookExA — install one of USER's process-local hook classes.
  (func $handle_SetWindowsHookExA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; SetWindowsHookExA(idHook, lpfn, hMod, dwThreadId)
    (if (i32.eq (local.get $arg0) (i32.const 3))
      (then
        (i32.store (global.get $reg_base) (call $getmessage_hook_install (local.get $arg1) (local.get $arg3)))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (i32.store offset=0 (global.get $reg_base) (call $install_supported_hook (local.get $arg0) (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; 382: RedrawWindow(hwnd, lprcUpdate, hrgnUpdate, flags). Minimal region
  ;; mutation: RDW_INVALIDATE adds the supplied area and RDW_VALIDATE removes
  ;; it. Flags that only control when/how existing update work is processed
  ;; must not manufacture a new full-client invalidation. Half-Life uses
  ;; RDW_ALLCHILDREN|RDW_UPDATENOW (0x180) under LockWindowUpdate precisely to
  ;; process work already created by its child layout changes.
  ;; RDW_FRAME/RDW_UPDATENOW/RDW_NOCHILDREN delivery nuances remain deferred.
  (func $handle_RedrawWindow (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $l i32) (local $t i32) (local $r i32) (local $b i32) (local $wa i32) (local $cs i32) (local $empty i32)
    (if (i32.eqz (local.get $arg0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))) (return)))
    ;; Derive rect: lprcUpdate if set, else hrgnUpdate bbox, else full client.
    (if (local.get $arg1)
      (then
        (local.set $wa (call $g2w (local.get $arg1)))
        (local.set $l (load.field Rect left (local.get $wa)))
        (local.set $t (load.field.memarg Rect top (local.get $wa)))
        (local.set $r (load.field.memarg Rect right (local.get $wa)))
        (local.set $b (load.field.memarg Rect bottom (local.get $wa))))
      (else
        (local.set $cs (call $host_get_window_client_size (local.get $arg0)))
        (local.set $l (i32.const 0)) (local.set $t (i32.const 0))
        (local.set $r (i32.and (local.get $cs) (i32.const 0xFFFF)))
        (local.set $b (i32.shr_u (local.get $cs) (i32.const 16)))))
    (if (i32.and (local.get $arg3) (i32.const 0x8))  ;; RDW_VALIDATE
      (then
        (local.set $empty
          (call $update_validate_rect (local.get $arg0)
            (local.get $l) (local.get $t) (local.get $r) (local.get $b)))
        (if (local.get $empty)
          (then
            (if (i32.eq (local.get $arg0) (global.get $main_hwnd))
              (then (global.set $paint_pending (i32.const 0)))
              (else (call $paint_flag_clear_hwnd (local.get $arg0)))))))
      (else
        (if (i32.and (local.get $arg3) (i32.const 0x1)) ;; RDW_INVALIDATE
          (then
            (call $update_invalidate_rect (local.get $arg0)
              (local.get $l) (local.get $t) (local.get $r) (local.get $b))
            (if (i32.eq (local.get $arg0) (global.get $main_hwnd))
              (then (global.set $paint_pending (i32.const 1)))
              (else (call $paint_flag_set (local.get $arg0))))
            (call $host_invalidate (local.get $arg0))))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))) (return)
  )

  ;; 383: ValidateRect(hwnd, lprc). lprc=NULL → full client (clear all).
  (func $handle_ValidateRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $l i32) (local $t i32) (local $r i32) (local $b i32) (local $wa i32) (local $empty i32)
    (if (i32.eqz (local.get $arg0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))) (return)))
    (if (local.get $arg1)
      (then
        (local.set $wa (call $g2w (local.get $arg1)))
        (local.set $l (load.field Rect left (local.get $wa)))
        (local.set $t (load.field.memarg Rect top (local.get $wa)))
        (local.set $r (load.field.memarg Rect right (local.get $wa)))
        (local.set $b (load.field.memarg Rect bottom (local.get $wa)))
        (local.set $empty (call $update_validate_rect (local.get $arg0) (local.get $l) (local.get $t) (local.get $r) (local.get $b))))
      (else
        ;; NULL validates the entire update region, independent of host
        ;; geometry (which may belong to another instance during callbacks).
        (call $update_clear_hwnd (local.get $arg0))
        (local.set $empty (i32.const 1))))
    (if (local.get $empty)
      (then
        (call $paint_flag_clear_hwnd (local.get $arg0))
        (if (i32.eq (local.get $arg0) (global.get $main_hwnd))
          (then (global.set $paint_pending (i32.const 0))))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 384: GetWindowDC(hwnd) → HDC. Like GetDC but includes non-client area.
  ;; Phase B: alloc DcRecord with kind='whole' so origin is window top-left.
  (func $handle_GetWindowDC (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $hdc i32)
    ;; GetDesktopWindow returns our fixed pseudo HWND 0x10000. It has no
    ;; ordinary window-table geometry, so binding a window DC to it fails and
    ;; MFC's CWindowDC constructor throws CResourceException. Native Windows
    ;; treats both NULL and the desktop HWND as requests for a screen DC.
    (if (i32.or (i32.eqz (local.get $arg0))
          (i32.eq (local.get $arg0) (i32.const 0x10000)))
      (then (local.set $hdc (call $host_alloc_screen_dc)))
      (else
        (local.set $hdc (call $host_alloc_window_dc (local.get $arg0) (i32.const 1)))
        (if (local.get $hdc)
          (then (call $dc_apply_window_clip (local.get $hdc) (local.get $arg0))))))
    (i32.store offset=0 (global.get $reg_base) (local.get $hdc))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 385: GrayStringW — STUB: unimplemented
  (func $handle_GrayStringW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr))
  )

  ;; 386: DrawTextW
  (func $handle_DrawTextW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $gdi_native_draw_text
      (local.get $arg0)
      (call $g2w (local.get $arg1))
      (local.get $arg2)
      (call $g2w (local.get $arg3))
      (local.get $arg4)
      (i32.const 1) ;; isWide = 1
    ))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))  ;; stdcall, 5 args
  )

  ;; DrawTextExW
  (func $handle_DrawTextExW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $draw_text_ex
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4)
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
      (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))  ;; stdcall, 6 args
  )

  ;; 387: TabbedTextOutW — same WAT layout path with UTF-16 runs.
  (func $handle_TabbedTextOutW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $gdi_tabbed_text
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4)
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
      (i32.const 1) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36)))
  )

  ;; 388: DestroyIcon(hIcon) — release built and copied icons. Loaded shared
  ;; resources remain live; an invalidated private handle fails.
  (func $handle_DestroyIcon (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $icon_destroy_handle (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; One LOGFONT{A,W} of system-font defaults at $buf. The two structs differ
  ;; only in lfFaceName's element width — 28 bytes of fields, then 32 chars —
  ;; so the whole NONCLIENTMETRICS layout below shifts with $wide and cannot be
  ;; written with static offsets.
  (func $spi_write_logfont (param $buf i32) (param $wide i32)
    (local $i i32) (local $ch i32)
    (i32.store offset=0  (local.get $buf) (i32.const -11))  ;; lfHeight
    (i32.store offset=16 (local.get $buf) (i32.const 400))  ;; lfWeight
    ;; lfFaceName at +28: "MS Sans Serif" from the shared constant at 0x270.
    (local.set $i (i32.const 0))
    (block $done (loop $copy
      (local.set $ch (i32.load8_u (i32.add (i32.const 0x270) (local.get $i))))
      (br_if $done (i32.eqz (local.get $ch)))
      (if (local.get $wide)
        (then (i32.store16
                (i32.add (i32.add (local.get $buf) (i32.const 28))
                         (i32.shl (local.get $i) (i32.const 1)))
                (local.get $ch)))
        (else (i32.store8
                (i32.add (i32.add (local.get $buf) (i32.const 28)) (local.get $i))
                (local.get $ch))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $copy)))
    ;; Do not depend on the caller or enclosing structure initialization for
    ;; the LOGFONT face terminator. Some Win9x callers reuse stack storage.
    (if (local.get $wide)
      (then (i32.store16
        (i32.add (i32.add (local.get $buf) (i32.const 28))
          (i32.shl (local.get $i) (i32.const 1)))
        (i32.const 0)))
      (else (i32.store8
        (i32.add (i32.add (local.get $buf) (i32.const 28)) (local.get $i))
        (i32.const 0)))))

  ;; SystemParametersInfo{A,W}(uiAction, uiParam, pvParam, fWinIni) — one body,
  ;; $wide selects the string encoding. The W entry point used to be a 6-line
  ;; return-TRUE stub sitting directly above this implementation, so every W
  ;; caller got a success code and an untouched buffer.
  (func $spi_core (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $wide i32) (result i32)
    (local $buf i32) (local $i i32)
    (local $lf i32) (local $narrow i32) (local $p i32) (local $size i32)
    ;; LOGFONTA is 60 bytes, LOGFONTW 92 — every offset past lfCaptionFont moves.
    (local.set $lf (if (result i32) (local.get $wide) (then (i32.const 92)) (else (i32.const 60))))
    ;; SPI_SETDESKWALLPAPER = 0x14. The host loads the named VFS bitmap and
    ;; interprets uiParam=0/1 as centered/tiled for the Win98 Paint commands.
    (if (i32.eq (local.get $arg0) (i32.const 0x14))
      (then
        (if (i32.eqz (local.get $arg2)) (then (return (i32.const 0))))
        ;; The host reads a NUL-terminated byte path, so a W caller's UTF-16
        ;; name has to be narrowed before it is handed over.
        (if (local.get $wide)
          (then
            (local.set $narrow (call $shellexec_narrow_w (local.get $arg2)))
            (if (i32.eqz (local.get $narrow)) (then (return (i32.const 0))))
            (local.set $i (call $host_set_wallpaper
              (call $g2w (local.get $narrow)) (local.get $arg1)))
            (call $heap_free (local.get $narrow))
            (return (local.get $i))))
        (return (call $host_set_wallpaper
          (call $g2w (local.get $arg2)) (local.get $arg1)))))
    ;; SPI_GETWORKAREA = 0x30: fill RECT with the usable desktop area. The
    ;; browser desktop owns a classic 28px bottom taskbar (the same rectangle
    ;; SHAppBarMessage reports), so applications must not center or maximize
    ;; their windows underneath it.
    (if (i32.eq (local.get $arg0) (i32.const 0x30))
      (then
        (if (i32.eqz (local.get $arg2)) (then (return (i32.const 0))))
        (local.set $buf
          (call $g2w_affine_span (local.get $arg2) (i32.const 16)))
        (if (i32.eq (local.get $buf) (global.get $NULL_SENTINEL))
          (then (return (i32.const 0))))
        (i32.store        (local.get $buf) (i32.const 0))
        (i32.store offset=4  (local.get $buf) (i32.const 0))
        (i32.store offset=8  (local.get $buf) (call $screen_metric_w))
        (i32.store offset=12 (local.get $buf) (call $screen_work_bottom))
        (return (i32.const 1))))
    ;; SPI_GETICONTITLELOGFONT = 0x1f. WinRAR asks for this while creating its
    ;; Settings property sheet. It passes a newer 92-byte declaration even to
    ;; the ANSI entry point, so accept a caller size at least as large as the
    ;; selected Win98 LOGFONT layout and initialize only that recognized prefix.
    (if (i32.eq (local.get $arg0) (i32.const 0x1f))
      (then
        (if (i32.or
              (i32.eqz (local.get $arg2))
              (i32.lt_u (local.get $arg1) (local.get $lf)))
          (then (return (i32.const 0))))
        (local.set $buf
          (call $g2w_affine_span (local.get $arg2) (local.get $lf)))
        (if (i32.eq (local.get $buf) (global.get $NULL_SENTINEL))
          (then (return (i32.const 0))))
        (memory.fill (local.get $buf) (i32.const 0) (local.get $lf))
        (call $spi_write_logfont (local.get $buf) (local.get $wide))
        (return (i32.const 1))))
    ;; The browser moves the complete top-level window while dragging, and the
    ;; classic wheel default is three lines. These are output getters, not
    ;; capability probes: success requires publishing the documented scalar.
    ;; The screen-saver trio describes a machine with no saver selected:
    ;; SPI_GETSCREENSAVEACTIVE FALSE, SPI_GETSCREENSAVERRUNNING FALSE, and the
    ;; stock 900-second SPI_GETSCREENSAVETIMEOUT. Failing them left the caller's
    ;; own presets in place, and PopCap games preset "active, 1 second": Zuma
    ;; then stopped drawing one second after the last input, which is exactly
    ;; "freezes right after CLICK HERE TO PLAY".
    (if (i32.or
          (i32.or
            (i32.eq (local.get $arg0) (i32.const 0x26))  ;; SPI_GETDRAGFULLWINDOWS
            (i32.eq (local.get $arg0) (i32.const 0x68))) ;; SPI_GETWHEELSCROLLLINES
          (i32.or
            (i32.or
              (i32.eq (local.get $arg0) (i32.const 0x0e))  ;; SPI_GETSCREENSAVETIMEOUT
              (i32.eq (local.get $arg0) (i32.const 0x10))) ;; SPI_GETSCREENSAVEACTIVE
            (i32.eq (local.get $arg0) (i32.const 0x72))))  ;; SPI_GETSCREENSAVERRUNNING
      (then
        (if (i32.eqz (local.get $arg2)) (then (return (i32.const 0))))
        (local.set $buf
          (call $g2w_affine_span (local.get $arg2) (i32.const 4)))
        (if (i32.eq (local.get $buf) (global.get $NULL_SENTINEL))
          (then (return (i32.const 0))))
        (i32.store (local.get $buf)
          (if (result i32) (i32.eq (local.get $arg0) (i32.const 0x68))
            (then (i32.const 3))
            (else (if (result i32) (i32.eq (local.get $arg0) (i32.const 0x26))
              (then (i32.const 1))
              (else (if (result i32) (i32.eq (local.get $arg0) (i32.const 0x0e))
                (then (i32.const 900))
                (else (i32.const 0))))))))
        (return (i32.const 1))))
    ;; SPI_GETNONCLIENTMETRICS = 0x29: fill NONCLIENTMETRICS struct
    ;; Win9x applications commonly pass uiParam=0 and declare the versioned
    ;; layout through NONCLIENTMETRICS.cbSize. Newer callers also pass the size
    ;; in uiParam, so accept either source while requiring the complete A/W
    ;; layout before writing its five LOGFONT records.
    (if (i32.eq (local.get $arg0) (i32.const 0x29))
      (then
        (if (i32.eqz (local.get $arg2)) (then (return (i32.const 0))))
        (local.set $buf
          (call $g2w_affine_span (local.get $arg2) (i32.const 4)))
        (if (i32.eq (local.get $buf) (global.get $NULL_SENTINEL))
          (then (return (i32.const 0))))
        (local.set $size (local.get $arg1))
        (if (i32.eqz (local.get $size))
          (then (local.set $size (i32.load (local.get $buf)))))
        (local.set $i
          (i32.add (i32.const 40) (i32.mul (local.get $lf) (i32.const 5))))
        (if (i32.lt_u (local.get $size) (local.get $i))
          (then (return (i32.const 0))))
        (local.set $buf
          (call $g2w_affine_span (local.get $arg2) (local.get $i)))
        (if (i32.eq (local.get $buf) (global.get $NULL_SENTINEL))
          (then (return (i32.const 0))))
            ;; Initialize the complete Win98 layout. A larger declaration may
            ;; include fields added by newer Windows versions; leave that tail
            ;; alone rather than treating an unbounded caller value as a fill
            ;; length.
            (memory.fill (local.get $buf) (i32.const 0)
              (local.get $i))
            ;; cbSize, iBorderWidth, iScrollWidth, iScrollHeight, iCaptionWidth, iCaptionHeight
            (i32.store        (local.get $buf)                       (local.get $size))  ;; cbSize
            (i32.store offset=4  (local.get $buf) (i32.const 1))    ;; iBorderWidth
            (i32.store offset=8  (local.get $buf) (i32.const 16))   ;; iScrollWidth
            (i32.store offset=12 (local.get $buf) (i32.const 16))   ;; iScrollHeight
            (i32.store offset=16 (local.get $buf) (i32.const 18))   ;; iCaptionWidth
            (i32.store offset=20 (local.get $buf) (i32.const 18))   ;; iCaptionHeight
            ;; Five LOGFONTs at their real struct offsets. The A path used to
            ;; place them at 84/148/212/276 — that spacing skips the two
            ;; iSmCaption and two iMenu ints, so every font after the caption
            ;; font landed inside the preceding one. Real layout:
            ;;   lfCaptionFont   24
            ;;   iSmCaptionWidth/Height  24+lf, +4
            ;;   lfSmCaptionFont 32+lf
            ;;   iMenuWidth/Height       32+2lf, +4
            ;;   lfMenuFont      40+2lf
            ;;   lfStatusFont    40+3lf
            ;;   lfMessageFont   40+4lf
            ;; cbSize is therefore 340 (A) / 500 (W).
            (local.set $p (i32.add (local.get $buf) (i32.const 24)))
            (call $spi_write_logfont (local.get $p) (local.get $wide))
            (local.set $p (i32.add (local.get $p) (local.get $lf)))
            (i32.store offset=0 (local.get $p) (i32.const 12))  ;; iSmCaptionWidth
            (i32.store offset=4 (local.get $p) (i32.const 15))  ;; iSmCaptionHeight
            (local.set $p (i32.add (local.get $p) (i32.const 8)))
            (call $spi_write_logfont (local.get $p) (local.get $wide))
            (local.set $p (i32.add (local.get $p) (local.get $lf)))
            (i32.store offset=0 (local.get $p) (i32.const 18))  ;; iMenuWidth
            (i32.store offset=4 (local.get $p) (i32.const 18))  ;; iMenuHeight
            (local.set $p (i32.add (local.get $p) (i32.const 8)))
            (call $spi_write_logfont (local.get $p) (local.get $wide))  ;; lfMenuFont
            (local.set $p (i32.add (local.get $p) (local.get $lf)))
            (call $spi_write_logfont (local.get $p) (local.get $wide))  ;; lfStatusFont
            (local.set $p (i32.add (local.get $p) (local.get $lf)))
            (call $spi_write_logfont (local.get $p) (local.get $wide)) ;; lfMessageFont
        (return (i32.const 1))))
    ;; An action we do not model must fail rather than claim success while
    ;; leaving an output buffer full of stale stack bytes.
    (i32.const 0))

  ;; 389: SystemParametersInfoW — 4 args stdcall
  (func $handle_SystemParametersInfoW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $spi_core (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; SystemParametersInfoA(uiAction, uiParam, pvParam, fWinIni) — 4 args stdcall
  (func $handle_SystemParametersInfoA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $spi_core (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; 390: IsWindowVisible
  (func $handle_IsWindowVisible (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (if (result i32) (i32.ge_s (call $wnd_table_find (local.get $arg0)) (i32.const 0))
        (then
          (if (result i32) (i32.and (call $wnd_get_style (local.get $arg0)) (i32.const 0x10000000))
            (then (i32.const 1))
            (else (i32.const 0))))
        (else (call $host_get_window_info (local.get $arg0) (i32.const 1)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 391: InflateRect(lprc, dx, dy) → BOOL — 3 args stdcall
  (func $handle_InflateRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32)
    (local.set $wa (call $g2w (local.get $arg0)))
    ;; left -= dx
    (store.field Rect left (local.get $wa)
      (i32.sub (load.field Rect left (local.get $wa)) (local.get $arg1)))
    ;; top -= dy
    (store.field Rect top (local.get $wa)
      (i32.sub (load.field Rect top (local.get $wa)) (local.get $arg2)))
    ;; right += dx
    (store.field Rect right (local.get $wa)
      (i32.add (load.field Rect right (local.get $wa)) (local.get $arg1)))
    ;; bottom += dy
    (store.field Rect bottom (local.get $wa)
      (i32.add (load.field Rect bottom (local.get $wa)) (local.get $arg2)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 392: LoadBitmapW
  (func $handle_LoadBitmapW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $gdi_bitmap_load_resource
      (local.get $arg0) (local.get $arg1) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))) (return)
  )

  ;; 393: wvsprintfW — STUB: unimplemented
  ;; wvsprintfW(lpOut, lpFmt, arglist) — the W twin of wvsprintfA, using the
  ;; same wide implementation wsprintfW already goes through. The only
  ;; difference from wsprintfW is where the arguments come from: an explicit
  ;; va_list pointer rather than the caller's stack. NT Paint formats its
  ;; Stretch/Skew dialog through this, and trapped here.
  (func $handle_wvsprintfW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $wsprintf_impl_w
      (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 121: DrawFocusRect(hdc, lprc)
  (func $handle_DrawFocusRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $rc i32) (local $desc i32)
    (local.set $rc (call $g2w (local.get $arg1)))
    (local.set $desc (global.get $GDI_LINE_DESC))
    (if (call $gdi_surface_descriptor (local.get $arg0) (local.get $desc))
      (then (i32.store offset=0 (global.get $reg_base) (call $gdi_focus_rect_desc
        (local.get $arg0) (local.get $desc)
        (load.field Rect left (local.get $rc)) (load.field.memarg Rect top (local.get $rc))
        (load.field.memarg Rect right (local.get $rc)) (load.field.memarg Rect bottom (local.get $rc)))))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))  ;; ret + 2 args
  )

  ;; 395: PtInRect(lprc, pt.x, pt.y) -> BOOL — 3 args stdcall
  (func $handle_PtInRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $rect_w i32)
    (local.set $rect_w (call $g2w (local.get $arg0)))
    ;; Check: left <= x < right && top <= y < bottom
    (if (i32.and
      (i32.and
        (i32.le_s (load.field Rect left (local.get $rect_w)) (local.get $arg1))                          ;; left <= x
        (i32.lt_s (local.get $arg1) (load.field Rect right (local.get $rect_w)))   ;; x < right
      )
      (i32.and
        (i32.le_s (load.field Rect top (local.get $rect_w)) (local.get $arg2))   ;; top <= y
        (i32.lt_s (local.get $arg2) (load.field Rect bottom (local.get $rect_w)))  ;; y < bottom
      )
    )
    (then (i32.store offset=0 (global.get $reg_base) (i32.const 1)))
    (else (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))) ;; stdcall 3 params + ret
  )

  ;; 396: WinHelpW — normalize UTF-16 and share the WinHelpA engine
  (func $handle_WinHelpW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $accepted i32)
    (local.set $accepted (call $help_dispatch_api_w
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)))
    (call $help_present_dispatch (local.get $accepted) (local.get $arg2))
    (i32.store offset=0 (global.get $reg_base) (local.get $accepted))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; 397: GetCapture — capture window associated with the current thread.
  (func $handle_GetCapture (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $capture_current_thread))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))  ;; 0 args
  )

  ;; 398: RegisterClipboardFormatW(lpszFormat) → UINT
  ;; Returns a registered clipboard format ID. "Rich Text Format" is stable so
  ;; Set/GetClipboardData can recognize the non-OLE RTF payload.
  (func $handle_RegisterClipboardFormatW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (drop (local.get $arg1))
    (drop (local.get $arg2))
    (drop (local.get $arg3))
    (drop (local.get $arg4))
    (drop (local.get $name_ptr))
    (i32.store offset=0 (global.get $reg_base) (call $clipboard_register_format (local.get $arg0) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; 399: CopyRect(lprcDst, lprcSrc) → BOOL — 2 args stdcall
  (func $handle_CopyRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dst i32) (local $src i32)
    (local.set $dst (call $g2w (local.get $arg0)))
    (local.set $src (call $g2w (local.get $arg1)))
    (store.field Rect left (local.get $dst) (load.field Rect left (local.get $src)))
    (store.field Rect top (local.get $dst) (load.field Rect top (local.get $src)))
    (store.field Rect right (local.get $dst) (load.field Rect right (local.get $src)))
    (store.field Rect bottom (local.get $dst) (load.field Rect bottom (local.get $src)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 400: IntersectRect(lprcDst, lprcSrc1, lprcSrc2) → BOOL
  (func $handle_IntersectRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dst i32) (local $s1 i32) (local $s2 i32)
    (local $left i32) (local $top i32) (local $right i32) (local $bottom i32)
    (local.set $dst (call $g2w (local.get $arg0)))
    (local.set $s1 (call $g2w (local.get $arg1)))
    (local.set $s2 (call $g2w (local.get $arg2)))
    ;; left = max(s1.left, s2.left)
    (local.set $left (select
      (load.field Rect left (local.get $s1)) (load.field Rect left (local.get $s2))
      (i32.gt_s (load.field Rect left (local.get $s1)) (load.field Rect left (local.get $s2)))))
    ;; top = max(s1.top, s2.top)
    (local.set $top (select
      (load.field Rect top (local.get $s1)) (load.field Rect top (local.get $s2))
      (i32.gt_s (load.field Rect top (local.get $s1)) (load.field Rect top (local.get $s2)))))
    ;; right = min(s1.right, s2.right)
    (local.set $right (select
      (load.field Rect right (local.get $s1)) (load.field Rect right (local.get $s2))
      (i32.lt_s (load.field Rect right (local.get $s1)) (load.field Rect right (local.get $s2)))))
    ;; bottom = min(s1.bottom, s2.bottom)
    (local.set $bottom (select
      (load.field Rect bottom (local.get $s1)) (load.field Rect bottom (local.get $s2))
      (i32.lt_s (load.field Rect bottom (local.get $s1)) (load.field Rect bottom (local.get $s2)))))
    ;; Check if intersection is empty
    (if (i32.or (i32.ge_s (local.get $left) (local.get $right))
                (i32.ge_s (local.get $top) (local.get $bottom)))
      (then
        ;; Empty: zero out dst, return FALSE
        (store.field Rect left (local.get $dst) (i32.const 0))
        (store.field Rect top (local.get $dst) (i32.const 0))
        (store.field Rect right (local.get $dst) (i32.const 0))
        (store.field Rect bottom (local.get $dst) (i32.const 0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
      )
      (else
        (store.field Rect left (local.get $dst) (local.get $left))
        (store.field Rect top (local.get $dst) (local.get $top))
        (store.field Rect right (local.get $dst) (local.get $right))
        (store.field Rect bottom (local.get $dst) (local.get $bottom))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))
      )
    )
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))  ;; stdcall, 3 args
  )

  ;; 401: UnionRect(lprcDst, lprcSrc1, lprcSrc2) → BOOL
  (func $handle_UnionRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dst i32) (local $s1 i32) (local $s2 i32)
    (local $s1l i32) (local $s1t i32) (local $s1r i32) (local $s1b i32)
    (local $s2l i32) (local $s2t i32) (local $s2r i32) (local $s2b i32)
    (local $e1 i32) (local $e2 i32)
    (local.set $dst (call $g2w (local.get $arg0)))
    (local.set $s1 (call $g2w (local.get $arg1)))
    (local.set $s2 (call $g2w (local.get $arg2)))
    (local.set $s1l (load.field Rect left (local.get $s1)))
    (local.set $s1t (load.field.memarg Rect top (local.get $s1)))
    (local.set $s1r (load.field.memarg Rect right (local.get $s1)))
    (local.set $s1b (load.field.memarg Rect bottom (local.get $s1)))
    (local.set $s2l (load.field Rect left (local.get $s2)))
    (local.set $s2t (load.field.memarg Rect top (local.get $s2)))
    (local.set $s2r (load.field.memarg Rect right (local.get $s2)))
    (local.set $s2b (load.field.memarg Rect bottom (local.get $s2)))
    (local.set $e1 (i32.or
      (i32.ge_s (local.get $s1l) (local.get $s1r))
      (i32.ge_s (local.get $s1t) (local.get $s1b))))
    (local.set $e2 (i32.or
      (i32.ge_s (local.get $s2l) (local.get $s2r))
      (i32.ge_s (local.get $s2t) (local.get $s2b))))
    (if (i32.and (local.get $e1) (local.get $e2))
      (then
        (store.field Rect left (local.get $dst) (i32.const 0))
        (store.field.memarg Rect top (local.get $dst) (i32.const 0))
        (store.field.memarg Rect right (local.get $dst) (i32.const 0))
        (store.field.memarg Rect bottom (local.get $dst) (i32.const 0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (else
        (if (local.get $e1)
          (then
            (store.field Rect left (local.get $dst) (local.get $s2l))
            (store.field.memarg Rect top (local.get $dst) (local.get $s2t))
            (store.field.memarg Rect right (local.get $dst) (local.get $s2r))
            (store.field.memarg Rect bottom (local.get $dst) (local.get $s2b)))
          (else
            (if (local.get $e2)
              (then
                (store.field Rect left (local.get $dst) (local.get $s1l))
                (store.field.memarg Rect top (local.get $dst) (local.get $s1t))
                (store.field.memarg Rect right (local.get $dst) (local.get $s1r))
                (store.field.memarg Rect bottom (local.get $dst) (local.get $s1b)))
              (else
                (store.field Rect left (local.get $dst)
                  (select (local.get $s1l) (local.get $s2l) (i32.lt_s (local.get $s1l) (local.get $s2l))))
                (store.field.memarg Rect top (local.get $dst)
                  (select (local.get $s1t) (local.get $s2t) (i32.lt_s (local.get $s1t) (local.get $s2t))))
                (store.field.memarg Rect right (local.get $dst)
                  (select (local.get $s1r) (local.get $s2r) (i32.gt_s (local.get $s1r) (local.get $s2r))))
                (store.field.memarg Rect bottom (local.get $dst)
                  (select (local.get $s1b) (local.get $s2b) (i32.gt_s (local.get $s1b) (local.get $s2b))))))))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; Store the bounding rectangle left after subtracting src2 from src1.
  ;; Win32 only trims when the intersection spans src1 completely along one
  ;; axis; a corner overlap cannot be represented by one RECT and therefore
  ;; leaves src1 unchanged. Inputs are values rather than pointers so dst may
  ;; alias either source, as the API permits in common docking call patterns.
  (func $rect_subtract_to_wa
      (param $dst i32)
      (param $s1l i32) (param $s1t i32) (param $s1r i32) (param $s1b i32)
      (param $s2l i32) (param $s2t i32) (param $s2r i32) (param $s2b i32)
      (result i32)
    (local $il i32) (local $it i32) (local $ir i32) (local $ib i32)
    (store.field Rect left (local.get $dst) (local.get $s1l))
    (store.field.memarg Rect top (local.get $dst) (local.get $s1t))
    (store.field.memarg Rect right (local.get $dst) (local.get $s1r))
    (store.field.memarg Rect bottom (local.get $dst) (local.get $s1b))
    (if (i32.or
          (i32.ge_s (local.get $s1l) (local.get $s1r))
          (i32.ge_s (local.get $s1t) (local.get $s1b)))
      (then
        (store.field Rect left (local.get $dst) (i32.const 0))
        (store.field.memarg Rect top (local.get $dst) (i32.const 0))
        (store.field.memarg Rect right (local.get $dst) (i32.const 0))
        (store.field.memarg Rect bottom (local.get $dst) (i32.const 0))
        (return (i32.const 0))))
    (local.set $il
      (select (local.get $s1l) (local.get $s2l)
        (i32.gt_s (local.get $s1l) (local.get $s2l))))
    (local.set $it
      (select (local.get $s1t) (local.get $s2t)
        (i32.gt_s (local.get $s1t) (local.get $s2t))))
    (local.set $ir
      (select (local.get $s1r) (local.get $s2r)
        (i32.lt_s (local.get $s1r) (local.get $s2r))))
    (local.set $ib
      (select (local.get $s1b) (local.get $s2b)
        (i32.lt_s (local.get $s1b) (local.get $s2b))))
    ;; No intersection: the result is the source rectangle copied above.
    (if (i32.or
          (i32.ge_s (local.get $il) (local.get $ir))
          (i32.ge_s (local.get $it) (local.get $ib)))
      (then (return (i32.const 1))))
    ;; Complete coverage has an empty geometric difference.
    (if (i32.and
          (i32.and (i32.eq (local.get $il) (local.get $s1l))
                   (i32.eq (local.get $it) (local.get $s1t)))
          (i32.and (i32.eq (local.get $ir) (local.get $s1r))
                   (i32.eq (local.get $ib) (local.get $s1b))))
      (then
        (store.field Rect left (local.get $dst) (i32.const 0))
        (store.field.memarg Rect top (local.get $dst) (i32.const 0))
        (store.field.memarg Rect right (local.get $dst) (i32.const 0))
        (store.field.memarg Rect bottom (local.get $dst) (i32.const 0))
        (return (i32.const 0))))
    ;; A full-height intersection can trim a left or right strip.
    (if (i32.and
          (i32.eq (local.get $it) (local.get $s1t))
          (i32.eq (local.get $ib) (local.get $s1b)))
      (then
        (if (i32.eq (local.get $il) (local.get $s1l))
          (then (store.field Rect left (local.get $dst) (local.get $ir)))
          (else
            (if (i32.eq (local.get $ir) (local.get $s1r))
              (then (store.field.memarg Rect right (local.get $dst) (local.get $il)))))))
      (else
        ;; A full-width intersection can trim a top or bottom strip.
        (if (i32.and
              (i32.eq (local.get $il) (local.get $s1l))
              (i32.eq (local.get $ir) (local.get $s1r)))
          (then
            (if (i32.eq (local.get $it) (local.get $s1t))
              (then (store.field.memarg Rect top (local.get $dst) (local.get $ib)))
              (else
                (if (i32.eq (local.get $ib) (local.get $s1b))
                  (then (store.field.memarg Rect bottom (local.get $dst) (local.get $it))))))))))
    (i32.const 1))

  ;; SubtractRect(lprcDst, lprcSrc1, lprcSrc2) → BOOL.
  (func $handle_SubtractRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dst i32) (local $s1 i32) (local $s2 i32)
    (local $s1l i32) (local $s1t i32) (local $s1r i32) (local $s1b i32)
    (local $s2l i32) (local $s2t i32) (local $s2r i32) (local $s2b i32)
    (local.set $dst (call $g2w (local.get $arg0)))
    (local.set $s1 (call $g2w (local.get $arg1)))
    (local.set $s2 (call $g2w (local.get $arg2)))
    (local.set $s1l (load.field Rect left (local.get $s1)))
    (local.set $s1t (load.field.memarg Rect top (local.get $s1)))
    (local.set $s1r (load.field.memarg Rect right (local.get $s1)))
    (local.set $s1b (load.field.memarg Rect bottom (local.get $s1)))
    (local.set $s2l (load.field Rect left (local.get $s2)))
    (local.set $s2t (load.field.memarg Rect top (local.get $s2)))
    (local.set $s2r (load.field.memarg Rect right (local.get $s2)))
    (local.set $s2b (load.field.memarg Rect bottom (local.get $s2)))
    (i32.store offset=0 (global.get $reg_base) (call $rect_subtract_to_wa
        (local.get $dst)
        (local.get $s1l) (local.get $s1t) (local.get $s1r) (local.get $s1b)
        (local.get $s2l) (local.get $s2t) (local.get $s2r) (local.get $s2b)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))  ;; stdcall, 3 args
  )

  ;; 402: WindowFromPoint(POINT pt) → HWND. POINT is passed by value as two
  ;; dwords on the stack, so arg0=x, arg1=y. Pick the highest-z visible
  ;; top-level containing the screen point, then descend through its children.
  ;; Returning main_hwnd unconditionally is observably wrong when an app hides
  ;; its bootstrap HWND and recreates the real surface in a second one. SDL 1.2
  ;; checks WindowFromPoint against its current video HWND before accepting
  ;; mouse motion; DOSBox therefore left its DOS cursor frozen over every game
  ;; after changing video mode from hwnd 0x10001 to hwnd 0x10005.
  (func $handle_WindowFromPoint (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $slot i32) (local $hwnd i32) (local $best i32)
    (local $z i32) (local $best_z i32)
    (local $x i32) (local $y i32) (local $w i32) (local $h i32)
    (local $deep i32)
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $slot) (global.get $MAX_WINDOWS)))
      (local.set $hwnd (call $wnd_slot_hwnd (local.get $slot)))
      (if (i32.and
            (i32.and (i32.ne (local.get $hwnd) (i32.const 0))
                     (i32.eqz (call $wnd_get_parent (local.get $hwnd))))
            (i32.ne (i32.and (call $wnd_get_style (local.get $hwnd))
                             (i32.const 0x10000000))
                    (i32.const 0)))
        (then
          (local.set $x (call $wnd_window_screen_x (local.get $hwnd)))
          (local.set $y (call $wnd_window_screen_y (local.get $hwnd)))
          (local.set $w (call $wnd_screen_w (local.get $hwnd)))
          (local.set $h (call $wnd_screen_h (local.get $hwnd)))
          (if (i32.and
                (i32.and (i32.ge_s (local.get $arg0) (local.get $x))
                         (i32.lt_s (local.get $arg0)
                           (i32.add (local.get $x) (local.get $w))))
                (i32.and (i32.ge_s (local.get $arg1) (local.get $y))
                         (i32.lt_s (local.get $arg1)
                           (i32.add (local.get $y) (local.get $h)))))
            (then
              (local.set $z (call $wnd_z_get (local.get $hwnd)))
              (if (i32.or (i32.eqz (local.get $best))
                          (i32.gt_s (local.get $z) (local.get $best_z)))
                (then
                  (local.set $best (local.get $hwnd))
                  (local.set $best_z (local.get $z))))))))
      (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
      (br $scan)))
    (if (local.get $best)
      (then
        (local.set $deep (call $wnd_child_from_point_deep
          (local.get $best) (local.get $arg0) (local.get $arg1)))))
    (i32.store offset=0 (global.get $reg_base) (select (local.get $deep) (local.get $best) (local.get $deep)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 403: IsRectEmpty — STUB: unimplemented
  ;; IsRectEmpty(lpRect=arg0) → BOOL. Empty iff right<=left OR bottom<=top.
  (func $handle_IsRectEmpty (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $r i32)
    (if (i32.eqz (local.get $arg0))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 1))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
            (return)))
    (local.set $r (call $g2w (local.get $arg0)))
    (i32.store offset=0 (global.get $reg_base) (i32.or
        (i32.le_s (load.field Rect right (local.get $r))   ;; right
                  (load.field Rect left (local.get $r)))                             ;; left
        (i32.le_s (load.field Rect bottom (local.get $r))  ;; bottom
                  (load.field Rect top (local.get $r)))))  ;; top
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 404: EqualRect(lprc1, lprc2) → BOOL. Compares 4 LONGs (16 bytes).
  (func $handle_EqualRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $a i32) (local $b i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (if (i32.or (i32.eqz (local.get $arg0)) (i32.eqz (local.get $arg1)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (else
        (local.set $a (call $g2w (local.get $arg0)))
        (local.set $b (call $g2w (local.get $arg1)))
        (if (i32.or
              (i32.or (i32.ne (load.field Rect left (local.get $a)) (load.field Rect left (local.get $b)))
                      (i32.ne (load.field.memarg Rect top (local.get $a)) (load.field.memarg Rect top (local.get $b))))
              (i32.or (i32.ne (load.field.memarg Rect right (local.get $a)) (load.field.memarg Rect right (local.get $b)))
                      (i32.ne (load.field.memarg Rect bottom (local.get $a)) (load.field.memarg Rect bottom (local.get $b)))))
          (then (i32.store offset=0 (global.get $reg_base) (i32.const 0))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))  ;; stdcall, 2 args
  )

  ;; 405: ClientToScreen
  (func $handle_ClientToScreen (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $pt i32) (local $ox i32) (local $oy i32)
    (local.set $pt (call $g2w (local.get $arg1)))
    (local.set $ox (call $wnd_client_screen_x (local.get $arg0)))
    (local.set $oy (call $wnd_client_screen_y (local.get $arg0)))
    (store.field Point x (local.get $pt)
      (i32.add (load.field Point x (local.get $pt)) (local.get $ox)))
    (store.field.memarg Point y (local.get $pt)
      (i32.add (load.field.memarg Point y (local.get $pt)) (local.get $oy)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))) (return)
  )

  ;; Change this thread queue's active top-level and synchronously deliver the
  ;; documented WM_ACTIVATE pair. Deactivation sees the old active HWND;
  ;; publication occurs before the new window's activation callback. If it picks
  ;; a descendant focus itself, preserve that choice; otherwise DefWindowProc's
  ;; default is represented by moving focus to the activated top-level.
  ;; Queue-instance generation advances only when a different HWND is
  ;; published. This catches nested A->C->A without cancelling on SetActive(A).
  (global $active_transition_serial (mut i32) (i32.const 0))
  (func $active_window_publish (param $target i32)
    (global.set $active_transition_serial (i32.add (global.get $active_transition_serial) (i32.const 1)))
    (global.set $active_hwnd (local.get $target))
    (call $wnd_note_active_popup (local.get $target)))

  (func $active_window_transition (param $target i32) (result i32)
    (call $active_window_transition_reason (local.get $target) (i32.const 1)))

  ;; The cause belongs to this invocation, not a global: a mouse activation
  ;; callback may call SetActiveWindow, whose nested notification is WA_ACTIVE.
  (func $active_window_transition_reason (param $target i32) (param $reason i32) (result i32)
    (local $previous i32) (local $old_focus i32) (local $serial i32) (local $focus_serial i32)
    (local.set $previous (global.get $active_hwnd))
    (if (i32.and
          (i32.ne (local.get $previous) (i32.const 0))
          (i32.lt_s (call $wnd_table_find (local.get $previous)) (i32.const 0)))
      (then
        (local.set $previous (i32.const 0))
        (global.set $active_hwnd (i32.const 0))))
    ;; Reasserting the active HWND can still bring its group above windows
    ;; created/positioned since the last transition, without new notifications.
    (call $wnd_z_raise_owner_group (local.get $target))
    (if (i32.eq (local.get $previous) (local.get $target))
      (then (return (local.get $previous))))

    (local.set $serial (global.get $active_transition_serial))
    (if (local.get $previous)
      (then
        (drop (call $wnd_send_message
          (local.get $previous) (i32.const 0x0006) ;; WM_ACTIVATE
          (i32.shl (call $wnd_min_get (local.get $previous)) (i32.const 16)) ;; WA_INACTIVE
          (local.get $target)))
        (call $host_invalidate_frame (local.get $previous))))
    ;; Synchronous callbacks may activate a different window. That nested
    ;; transition owns its state; do not send the superseded target a later
    ;; activation or clear the focus it just selected.
    (if (i32.ne (global.get $active_transition_serial) (local.get $serial))
      (then (return (local.get $previous))))
    (if (i32.and (i32.ne (local.get $target) (i32.const 0))
          (i32.lt_s (call $wnd_table_find (local.get $target)) (i32.const 0)))
      (then (return (local.get $previous))))
    (call $active_window_publish (local.get $target))
    (local.set $serial (global.get $active_transition_serial))
    (if (i32.and
          (i32.ne (local.get $target) (i32.const 0))
          (i32.ge_s (call $wnd_table_find (local.get $target)) (i32.const 0)))
      (then
        (drop (call $wnd_send_message
          (local.get $target) (i32.const 0x0006) ;; WM_ACTIVATE
          (i32.or (local.get $reason) ;; WA_ACTIVE or WA_CLICKACTIVE
            (i32.shl (call $wnd_min_get (local.get $target)) (i32.const 16)))
          (local.get $previous)))
        (call $host_invalidate_frame (local.get $target))))
    (if (i32.or (i32.ne (global.get $active_transition_serial) (local.get $serial))
          (i32.ne (global.get $active_hwnd) (local.get $target)))
      (then (return (local.get $previous))))

    ;; WM_ACTIVATE's default procedure assigns focus only when the window is
    ;; not minimized. Respect an application-selected child focus established
    ;; by the activation callback itself.
    (local.set $old_focus (global.get $focus_hwnd))
    (if (i32.and
          (i32.and
            (i32.ne (local.get $target) (i32.const 0))
            (i32.eq (global.get $active_hwnd) (local.get $target)))
          (i32.and
            (i32.ge_s (call $wnd_table_find (local.get $target)) (i32.const 0))
            (i32.eqz (call $wnd_min_get (local.get $target)))))
      (then
        (if (i32.or
              (i32.eqz (local.get $old_focus))
              (i32.ne (call $wnd_top_level (local.get $old_focus)) (local.get $target)))
          (then
            (drop (call $focus_publish (local.get $target)))
            (local.set $focus_serial (global.get $focus_transition_serial))
            (if (i32.and
                  (i32.ne (local.get $old_focus) (i32.const 0))
                  (i32.ge_s (call $wnd_table_find (local.get $old_focus)) (i32.const 0)))
              (then
                (drop (call $wnd_send_message
                  (local.get $old_focus) (i32.const 0x0008) ;; WM_KILLFOCUS
                  (local.get $target) (i32.const 0)))))
            (if (i32.or
                  (i32.ne (global.get $active_transition_serial) (local.get $serial))
                  (i32.or (i32.ne (global.get $active_hwnd) (local.get $target))
                    (i32.eqz (call $focus_transfer_current (local.get $target) (local.get $focus_serial)))))
              (then (return (local.get $previous))))
            (drop (call $wnd_send_message
              (local.get $target) (i32.const 0x0007) ;; WM_SETFOCUS
              (local.get $old_focus) (i32.const 0))))))
      (else
        ;; Clearing this thread's active window also releases focus belonging
        ;; to the window being deactivated.
        (if (i32.and
              (i32.ne (local.get $old_focus) (i32.const 0))
              (i32.or
                (i32.eqz (local.get $previous))
                (i32.eq (call $wnd_top_level (local.get $old_focus))
                        (local.get $previous))))
          (then
            (drop (call $focus_publish (i32.const 0)))
            (if (i32.ge_s (call $wnd_table_find (local.get $old_focus)) (i32.const 0))
              (then
                (drop (call $wnd_send_message
                  (local.get $old_focus) (i32.const 0x0008) ;; WM_KILLFOCUS
                  (i32.const 0) (i32.const 0)))))))))
    (local.get $previous))

  ;; Foreground/restore wrappers also activate the browser window. For our
  ;; queue, finish guest notifications first, then publish only if callbacks
  ;; still select this top-level. Foreign-thread targets retain host delegation.
  (func $activate_window_with_host (param $hwnd i32) (result i32)
    (local $top i32)
    (local.set $top (call $wnd_top_level (local.get $hwnd)))
    (if (i32.and
          (i32.ge_s (call $wnd_table_find (local.get $top)) (i32.const 0))
          (i32.eq (call $wnd_get_thread (local.get $top)) (global.get $current_thread_id)))
      (then
        (drop (call $active_window_transition (local.get $top)))
        (if (i32.ne (global.get $active_hwnd) (local.get $top))
          (then (return (i32.const 0))))))
    (call $host_activate_window (local.get $hwnd)))

  ;; 406: SetActiveWindow(hwnd) — previous active top-level for this thread.
  (func $handle_SetActiveWindow (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.or
          (i32.lt_s (call $wnd_table_find (local.get $arg0)) (i32.const 0))
          (i32.ne (i32.and (call $wnd_get_style (local.get $arg0))
                           (i32.const 0x40000000)) (i32.const 0)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (if (i32.ne (call $wnd_get_thread (local.get $arg0))
                (global.get $current_thread_id))
      (then
        ;; USER clears the calling queue's active status when hWnd belongs to
        ;; another thread; it does not transfer ownership across queues.
        (i32.store offset=0 (global.get $reg_base) (call $active_window_transition (i32.const 0))))
      (else
        (i32.store offset=0 (global.get $reg_base) (call $active_window_transition (local.get $arg0)))
        ;; The callback may have completed another SetActiveWindow, including
        ;; its browser activation. Do not undo it after unwinding this call.
        (if (i32.eq (global.get $active_hwnd) (local.get $arg0))
          (then (drop (call $host_activate_window (local.get $arg0)))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

(func $handle_CopyMetaFileA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $gdi_metafile_copy (local.get $arg0) (i32.const 6)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_CopyMetaFileW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $gdi_metafile_copy (local.get $arg0) (i32.const 6)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; 146: ExtCreatePen(style, width, LOGBRUSH*, styleCount, styleEntries).
  (func $handle_ExtCreatePen (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $brush i32) (local $style i32) (local $color i32) (local $flags i32)
    (if (i32.eqz (local.get $arg2))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (else
        (local.set $brush (call $g2w (local.get $arg2)))
        (local.set $style (i32.and (local.get $arg0) (i32.const 0xF)))
        (local.set $color (i32.load offset=4 (local.get $brush)))
        (local.set $flags (i32.or
          (select (i32.const 1) (i32.const 0) (i32.eq (local.get $style) (i32.const 5)))
          (i32.and (local.get $arg0) (i32.const 0x000FFF00))))
        (i32.store offset=0 (global.get $reg_base) (call $gdi_object_alloc (i32.const 1)
          (local.get $style) (local.get $arg1) (local.get $color) (local.get $flags)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
  )

  ;; 561: EnumMetaFile — validate and enumerate each classic WMF record through
  ;; the guest MFENUMPROC. The WAT callback context owns the HANDLETABLE.
  (func $handle_EnumMetaFile (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret i32)
    (local.set $ret (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
    (call $gdi_metafile_enum_start (local.get $arg0) (local.get $arg1)
      (local.get $arg2) (local.get $arg3) (local.get $ret) (i32.load offset=16 (global.get $reg_base)))
  )

;; 563: PlayMetaFileRecord — replay one validated WMF record against the
  ;; caller's live HANDLETABLE, preserving object/state changes for the next
  ;; EnumMetaFile callback.
  (func $handle_PlayMetaFileRecord (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $gdi_metafile_play_wmf_record
      (local.get $arg0)
      (if (result i32) (local.get $arg1)
        (then (call $g2w (local.get $arg1))) (else (i32.const 0)))
      (if (result i32) (local.get $arg2)
        (then (call $g2w (local.get $arg2))) (else (i32.const 0)))
      (local.get $arg3)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

SetColorAdjustment — validate and copy complete per-DC state.
  (func $handle_SetColorAdjustment (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $gdi_color_adjustment_set
      (local.get $arg0)
      (if (result i32) (local.get $arg1)
        (then (call $g2w (local.get $arg1))) (else (i32.const 0)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  (func $handle_GetColorAdjustment (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $gdi_color_adjustment_get
      (local.get $arg0)
      (if (result i32) (local.get $arg1)
        (then (call $g2w (local.get $arg1))) (else (i32.const 0)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

;; 571: PolyDraw — WAT-owned PT_MOVETO/PT_LINETO/PT_BEZIERTO path execution.
  (func $handle_PolyDraw (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $points_wa i32) (local $types_wa i32)
    (local.set $points_wa (call $g2w (local.get $arg1)))
    (local.set $types_wa (call $g2w (local.get $arg2)))
    (if (call $gdi_dc_path_is_open (local.get $arg0))
      (then (i32.store offset=0 (global.get $reg_base) (call $gdi_dc_path_record_polydraw (local.get $arg0)
        (local.get $points_wa) (local.get $types_wa) (local.get $arg3))))
      (else (i32.store offset=0 (global.get $reg_base) (call $gdi_poly_draw (local.get $arg0)
        (local.get $points_wa) (local.get $types_wa) (local.get $arg3)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

 574: SetMapperFlags — per-DC font mapper flags.
  (func $handle_SetMapperFlags (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $gdi_dc_aux_set
      (local.get $arg0) (i32.const 16) (local.get $arg1) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; StartDocW — the DOCINFO strings are only names for a print job nothing
  ;; here reads, so starting the job is the same act in either encoding.
  (func $handle_StartDocW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_StartDocA (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; 603: GetCharWidthW(hdc, first, last, widths) — UTF-16 range width query.
  (func $handle_GetCharWidthW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_GetCharWidth32W
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; 606: GetTextFaceW(hdc, cch, face) — UTF-16 variant of GetTextFaceA.
  (func $handle_GetTextFaceW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $gdi_font_write_text_face
      (local.get $arg0) (local.get $arg1)
      (if (result i32) (local.get $arg2)
        (then (call $g2w (local.get $arg2))) (else (i32.const 0)))
      (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

;; IME stubs — we never inject IME composition, so Immm* are no-ops.
  ;; ImmCreateContext() / ImmDestroyContext(hIMC). This plain en-US machine
  ;; exposes no IME and therefore cannot allocate a meaningful input context;
  ;; keep creation, acquisition and destruction internally consistent.
  (func $handle_ImmCreateContext (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (drop (local.get $name_ptr)) ;; no per-call context is manufactured
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  (func $handle_ImmDestroyContext (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (drop (local.get $arg0)) ;; NULL is the only context we expose
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; ImmAssociateContext(hWnd, hIMC) → prev HIMC (we always return 0 — no previous)
  (func $handle_ImmAssociateContext (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; ImmGetContext(hWnd) → HIMC (return 0 = no IME context)
  (func $handle_ImmGetContext (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; ImmGetDefaultIMEWnd(hWnd) → HWND of the thread's default IME window.
  ;; No IME is installed here, so there is no IME window to return; real
  ;; Windows returns NULL in exactly that case and callers (MCM's input
  ;; setup) treat it as "no IME, use plain keyboard input".
  (func $handle_ImmGetDefaultIMEWnd (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; ImmIsIME(hKL) → BOOL. The emulated machine exposes only the plain
  ;; en-US keyboard layout, so no enumerated HKL is an IME. This still needs a
  ;; real callable export: VCL loads IMM32 dynamically, caches the pointer,
  ;; and calls it for every result from GetKeyboardLayoutList.
  (func $handle_ImmIsIME (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; ImmGetProperty(hKL, dwIndex) queries the IME associated with a layout.
  ;; Only the plain en-US layout is installed (GetKeyboardLayout/List and
  ;; ImmIsIME above). No HKL therefore has IME properties, capabilities or an
  ;; IME version: return zero, including for unknown HKLs/indices. Do not
  ;; advertise IMEVER_0400 merely because the emulated OS is Win98.
  ;; https://learn.microsoft.com/en-us/windows/win32/api/imm/nf-imm-immgetproperty
  (func $handle_ImmGetProperty (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; Share the two-argument no-IME result and stack cleanup. Neither query
    ;; nor attempted opening can create an IME in this machine configuration.
    (call $handle_ImmSetOpenStatus
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; ImmReleaseContext(hWnd, hIMC) balances a successful ImmGetContext call.
  ;; This no-IME machine never issues a HIMC, so neither NULL nor a fabricated
  ;; numeric value can name acquired context state to release.
  (func $handle_ImmReleaseContext (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; ImmNotifyIME(hIMC, action, index, value) → BOOL. We do not create an
  ;; input context or composition state, so there is nothing to notify.
  (func $handle_ImmNotifyIME (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; The rest of the IMM32 surface Warcraft III imports. It asks for all of it
  ;; the moment a text field appears -- the Single Player screen -- and every
  ;; one of these is reached with the HIMC that $handle_ImmGetContext returned,
  ;; which on this no-IME machine is NULL. That is not a shortcut: Windows with
  ;; no IME installed returns NULL there too, and these are then the documented
  ;; results for a context that does not exist. They are constant because the
  ;; answer genuinely does not vary, not because the work was skipped -- the
  ;; day this machine grows an input context, they grow state with it.

  ;; Common no-context failure result; each API retains explicit stdcall cleanup.
  ;; Keep last_error and all caller output memory unchanged.
  (func $imm_no_context_result
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  ;; ImmGetOpenStatus(hIMC) → BOOL: is the IME open. No context, never open.
  (func $handle_ImmGetOpenStatus (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $imm_no_context_result)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; ImmSetOpenStatus(hIMC, fOpen) → BOOL. Opening an IME that is not there
  ;; fails; reporting success would tell the game a composition window exists.
  (func $handle_ImmSetOpenStatus (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $imm_no_context_result)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; ImmGetDescriptionA/W are API-table aliases of this three-argument
  ;; no-result query. No IME is installed for our plain en-US keyboard layout,
  ;; so description and size queries return zero without touching the buffer
  ;; or last_error. The alias must change if IME contexts/layouts are added.
  ;; ImmGetConversionStatus(hIMC, lpfdwConversion, lpfdwSentence) → BOOL.
  ;; FALSE on an invalid context, and on failure Windows leaves both output
  ;; DWORDs untouched -- so this deliberately writes neither. A caller that
  ;; ignores the return value keeps whatever it initialised them to, which is
  ;; the same thing it would keep on a real no-IME machine.
  (func $handle_ImmGetConversionStatus (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $imm_no_context_result)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; ImmSetConversionStatus(hIMC, fdwConversion, fdwSentence) → BOOL.
  (func $handle_ImmSetConversionStatus (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_ImmGetConversionStatus
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; ImmGetCompositionStringA(hIMC, dwIndex, lpBuf, dwBufLen) → LONG. The
  ;; return is a byte COUNT, so 0 means "an empty composition string, and the
  ;; buffer is now valid" -- a lie we would be caught in. IMM_ERROR_GENERAL
  ;; (-2) is what an invalid context returns, and it is negative, which is the
  ;; test every caller of this function performs.
  (func $handle_ImmGetCompositionStringA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const -2))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; ImmGetCandidateListA(hIMC, dwIndex, lpCandList, dwBufLen) → DWORD, the
  ;; size copied or required. Zero is the documented failure here (unlike the
  ;; composition string above, this one returns a size, not a count that could
  ;; legitimately be empty), and no CANDIDATELIST is written.
  (func $handle_ImmGetCandidateListA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $imm_no_context_result)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; CharLower accepts either a character in the low word or a mutable,
  ;; NUL-terminated string. Translate a string pointer once, then vary only
  ;; the character width between A and W.
  (func $char_lower (param $value i32) (param $wide i32) (result i32)
    (local $p_wa i32) (local $c i32) (local $lower i32) (local $step i32)
    (if (i32.eqz (i32.and (local.get $value) (i32.const 0xffff0000)))
      (then
        (local.set $c (i32.and (local.get $value)
          (if (result i32) (local.get $wide)
            (then (i32.const 0xffff)) (else (i32.const 0xff)))))
        (return (call $tolower (local.get $c)))))
    (local.set $p_wa (call $g2w (local.get $value)))
    (local.set $step (i32.shl (i32.const 1) (local.get $wide)))
    (block $done (loop $lp
      (local.set $c
        (if (result i32) (local.get $wide)
          (then (i32.load16_u (local.get $p_wa)))
          (else (i32.load8_u (local.get $p_wa)))))
      (br_if $done (i32.eqz (local.get $c)))
      (local.set $lower (call $tolower (local.get $c)))
      (if (i32.ne (local.get $lower) (local.get $c))
        (then
          (if (local.get $wide)
            (then (i32.store16 (local.get $p_wa) (local.get $lower)))
            (else (i32.store8 (local.get $p_wa) (local.get $lower))))))
      (local.set $p_wa (i32.add (local.get $p_wa) (local.get $step)))
      (br $lp)))
    (local.get $value))

  (func $handle_CharLowerA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $char_lower (local.get $arg0) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_CharLowerW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $char_lower (local.get $arg0) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; CharLowerBuff is count-delimited and therefore processes embedded NULs.
  ;; cchLength is a character count for both encodings, not a byte count for W.
  (func $char_lower_buff (param $buf_g i32) (param $length i32)
        (param $wide i32) (result i32)
    (local $base_wa i32) (local $at_wa i32)
    (local $i i32) (local $c i32) (local $lower i32)
    (if (i32.eqz (local.get $buf_g)) (then (return (i32.const 0))))
    (local.set $base_wa (call $g2w (local.get $buf_g)))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $i) (local.get $length)))
      (local.set $at_wa (i32.add (local.get $base_wa)
        (i32.shl (local.get $i) (local.get $wide))))
      (local.set $c
        (if (result i32) (local.get $wide)
          (then (i32.load16_u (local.get $at_wa)))
          (else (i32.load8_u (local.get $at_wa)))))
      (local.set $lower (call $tolower (local.get $c)))
      (if (i32.ne (local.get $lower) (local.get $c))
        (then
          (if (local.get $wide)
            (then (i32.store16 (local.get $at_wa) (local.get $lower)))
            (else (i32.store8 (local.get $at_wa) (local.get $lower))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp)))
    (local.get $length))

  (func $handle_CharLowerBuffA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $char_lower_buff
      (local.get $arg0) (local.get $arg1) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_CharLowerBuffW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $char_lower_buff
      (local.get $arg0) (local.get $arg1) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; CharUpperBuffA(lpsz, cchLength) — uppercase cchLength characters in
  ;; place and return how many were converted. Unlike CharUpperA this does not
  ;; stop at a NUL: the count is the whole contract.
  (func $handle_CharUpperBuffA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $p i32) (local $i i32) (local $c i32)
    (if (i32.eqz (local.get $arg0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (local.set $p (call $g2w (local.get $arg0)))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $i) (local.get $arg1)))
      (local.set $c (i32.load8_u (i32.add (local.get $p) (local.get $i))))
      (if (i32.and
            (i32.ge_u (local.get $c) (i32.const 0x61))
            (i32.le_u (local.get $c) (i32.const 0x7a)))
        (then
          (i32.store8
            (i32.add (local.get $p) (local.get $i))
            (i32.sub (local.get $c) (i32.const 0x20)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp)))
    (i32.store offset=0 (global.get $reg_base) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; Win98's en-US ANSI/OEM pair is CP1252 <-> CP437, not a byte copy.
  ;; Keep the complete single-byte maps in a free page immediately below the
  ;; branch histograms. Unrepresentable characters use the Windows default
  ;; character '?'. The two 256-byte tables make the string and counted APIs
  ;; share exactly the same conversion, including in-place calls.
  (global $CP1252_TO_CP437 i32 (region.addr $CP1252_TO_CP437 0))
  (global $CP437_TO_CP1252 i32 (region.addr $CP437_TO_CP1252 0))
  (global $file_apis_ansi (mut i32) (i32.const 1))
  (data (region.addr $CP1252_TO_CP437 0)
    "\00\01\02\03\04\05\06\07\08\09\0a\0b\0c\0d\0e\0f\10\11\12\13\14\15\16\17\18\19\1a\1b\1c\1d\1e\1f"
    "\20\21\22\23\24\25\26\27\28\29\2a\2b\2c\2d\2e\2f\30\31\32\33\34\35\36\37\38\39\3a\3b\3c\3d\3e\3f"
    "\40\41\42\43\44\45\46\47\48\49\4a\4b\4c\4d\4e\4f\50\51\52\53\54\55\56\57\58\59\5a\5b\5c\5d\5e\5f"
    "\60\61\62\63\64\65\66\67\68\69\6a\6b\6c\6d\6e\6f\70\71\72\73\74\75\76\77\78\79\7a\7b\7c\7d\7e\7f"
    "\3f\3f\3f\9f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f"
    "\ff\ad\9b\9c\3f\9d\3f\3f\3f\3f\a6\ae\aa\3f\3f\3f\f8\f1\fd\3f\3f\e6\3f\fa\3f\3f\a7\af\ac\ab\3f\a8"
    "\3f\3f\3f\3f\8e\8f\92\80\3f\90\3f\3f\3f\3f\3f\3f\3f\a5\3f\3f\3f\3f\99\3f\3f\3f\3f\3f\9a\3f\3f\e1"
    "\85\a0\83\3f\84\86\91\87\8a\82\88\89\8d\a1\8c\8b\3f\a4\95\a2\93\3f\94\f6\3f\97\a3\96\81\3f\3f\98")
  (data (region.addr $CP437_TO_CP1252 0)
    "\00\01\02\03\04\05\06\07\08\09\0a\0b\0c\0d\0e\0f\10\11\12\13\14\15\16\17\18\19\1a\1b\1c\1d\1e\1f"
    "\20\21\22\23\24\25\26\27\28\29\2a\2b\2c\2d\2e\2f\30\31\32\33\34\35\36\37\38\39\3a\3b\3c\3d\3e\3f"
    "\40\41\42\43\44\45\46\47\48\49\4a\4b\4c\4d\4e\4f\50\51\52\53\54\55\56\57\58\59\5a\5b\5c\5d\5e\5f"
    "\60\61\62\63\64\65\66\67\68\69\6a\6b\6c\6d\6e\6f\70\71\72\73\74\75\76\77\78\79\7a\7b\7c\7d\7e\7f"
    "\c7\fc\e9\e2\e4\e0\e5\e7\ea\eb\e8\ef\ee\ec\c4\c5\c9\e6\c6\f4\f6\f2\fb\f9\ff\d6\dc\a2\a3\a5\3f\83"
    "\e1\ed\f3\fa\f1\d1\aa\ba\bf\3f\ac\bd\bc\a1\ab\bb\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f"
    "\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f"
    "\3f\df\3f\3f\3f\3f\b5\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\b1\3f\3f\3f\3f\f7\3f\b0\3f\b7\3f\3f\b2\3f\a0")

  (func $char_translate_buffer (param $src_g i32) (param $dst_g i32)
        (param $count i32) (param $table i32)
    (local $src i32) (local $dst i32) (local $i i32) (local $ch i32)
    (local.set $src (call $g2w (local.get $src_g)))
    (local.set $dst (call $g2w (local.get $dst_g)))
    (block $done (loop $copy
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $ch (i32.load8_u (i32.add (local.get $src) (local.get $i))))
      (i32.store8 (i32.add (local.get $dst) (local.get $i))
        (i32.load8_u (i32.add (local.get $table) (local.get $ch))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $copy))))

  (func $char_translate_string (param $src_g i32) (param $dst_g i32)
        (param $table i32)
    (local $src i32) (local $dst i32) (local $i i32) (local $ch i32)
    (local.set $src (call $g2w (local.get $src_g)))
    (local.set $dst (call $g2w (local.get $dst_g)))
    (block $done (loop $copy
      (local.set $ch (i32.load8_u (i32.add (local.get $src) (local.get $i))))
      (i32.store8 (i32.add (local.get $dst) (local.get $i))
        (i32.load8_u (i32.add (local.get $table) (local.get $ch))))
      (br_if $done (i32.eqz (local.get $ch)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $copy))))

  ;; CharToOemA(pSrc, pDst) and the counted Buff form. ANSI callers may
  ;; convert in place; a one-byte table lookup naturally preserves that case.
  (func $handle_CharToOemA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $char_translate_string
      (local.get $arg0) (local.get $arg1) (global.get $CP1252_TO_CP437))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_CharToOemBuffA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $char_translate_buffer
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (global.get $CP1252_TO_CP437))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; OemToCharA(lpSrc, lpDst) — CP437 to the process CP1252 page.
  (func $handle_OemToCharA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $char_translate_string
      (local.get $arg0) (local.get $arg1) (global.get $CP437_TO_CP1252))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; OemToCharBuffA converts all cchDstLength bytes and does not stop at NUL.
  (func $handle_OemToCharBuffA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $char_translate_buffer
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (global.get $CP437_TO_CP1252))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; The file-API character-set selector is process global on Win98. FAR uses
  ;; the OEM mode so names received from the console and names passed to the
  ;; ANSI file APIs stay in the same byte domain.
  (func $handle_SetFileApisToOEM (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $file_apis_ansi (i32.const 0)) (drop (call $host_fs_file_api_ansi (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  (func $handle_SetFileApisToANSI (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $file_apis_ansi (i32.const 1)) (drop (call $host_fs_file_api_ansi (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  (func $handle_AreFileApisANSI (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_fs_file_api_ansi (i32.const -1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  ;; 697: ??1type_info@@UAE@XZ — soft-stub — STUB: unimplemented
  (func $handle_??1type_info@@UAE@XZ (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr))
  )

  ;; 698: ?terminate@@YAXXZ — soft-stub — STUB: unimplemented
  (func $handle_?terminate@@YAXXZ (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr))
  )

  ;; 699: HeapSize — return allocation size from heap header
  (func $handle_HeapSize (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; HeapSize(hHeap, dwFlags, lpMem) → size
    ;; Our heap stores block size (including 4-byte header) at [ptr-4]
    ;; Only valid for pointers in our heap range; return -1 for unknown pointers
    (local $size i32)
    (if (i32.eqz (call $heap_api_handle_valid (local.get $arg0)))
      (then
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (i32.store offset=0 (global.get $reg_base) (i32.const 0xFFFFFFFF))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    ;; This used to accept only pointers below this instance's current bump
    ;; pointer. Once the allocator moved on to another chunk, every live block
    ;; outside it answered -1 -- and msvcrt's _onexit compares _msize unsigned,
    ;; so Paint's atexit table "had room" forever and its 38th entry landed on
    ;; the next block's header. Every later GlobalLock that walked past that
    ;; header then failed, Print Preview's DEVNAMES among them.
    (local.set $size (call $heap_block_size_checked (local.get $arg2)))
    (if (local.get $size)
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.sub (local.get $size) (i32.const 4))))
      (else
        (i32.store offset=0 (global.get $reg_base) (i32.const 0xFFFFFFFF))))  ;; not our allocation
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 700: IsProcessorFeaturePresent(dwProcessorFeature) → BOOL
  (func $handle_IsProcessorFeaturePresent (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; Keep this aligned with the CPUID personality in 05-alu.wat. The guest
    ;; implements CMPXCHG8B, MMX, and RDTSC, but deliberately does not advertise
    ;; SSE. In particular PF_FLOATING_POINT_PRECISION_ERRATA (0) must be FALSE:
    ;; the VC runtime queries it during process attach, before a DLL can register
    ;; its native classes.
    (i32.store offset=0 (global.get $reg_base) (i32.or
        (i32.or (i32.eq (local.get $arg0) (i32.const 2))  ;; PF_COMPARE_EXCHANGE_DOUBLE
                (i32.eq (local.get $arg0) (i32.const 3))) ;; PF_MMX_INSTRUCTIONS_AVAILABLE
        (i32.eq (local.get $arg0) (i32.const 8))))        ;; PF_RDTSC_INSTRUCTION_AVAILABLE
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 701: CoRegisterMessageFilter(lpMsgFilter, lplpMsgFilter) — 2 args stdcall
  (func $handle_CoRegisterMessageFilter (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; Write NULL to *lplpMsgFilter if non-null
    (if (local.get $arg1)
      (then (call $gs32 (local.get $arg1) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 716: _EH_prolog — MSVCRT SEH frame setup (special calling convention)
  ;; On entry: EAX = exception handler address, [ESP] = return address
  ;; Builds SEH frame: push -1 (trylevel), push handler (EAX), push old fs:[0],
  ;; set fs:[0] = ESP, save old EBP, set EBP to frame, return to caller.
  (func $handle__EH_prolog (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret_addr i32)
    (local $old_seh i32)
    ;; [ESP] = return address (from the call instruction)
    (local.set $ret_addr (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    ;; Push -1 (initial trylevel)
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0xFFFFFFFF))
    ;; Push EAX (exception handler)
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.load offset=0 (global.get $reg_base)))
    ;; Push old fs:[0] (previous SEH head)
    (local.set $old_seh (call $gl32 (global.get $fs_base)))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $old_seh))
    ;; Set fs:[0] = ESP (install new SEH frame)
    (call $gs32 (global.get $fs_base) (i32.load offset=16 (global.get $reg_base)))
    ;; Save EBP where the return address was: [ESP+12] = EBP
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)) (i32.load offset=20 (global.get $reg_base)))
    ;; LEA EBP, [ESP+12] — EBP points to saved EBP
    (i32.store offset=20 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
    ;; Set EIP to return address
    (global.set $eip (local.get $ret_addr))
  )

  ;; Shared class-3 state: 16 owners, each head/depth/retired/generation.
  ;; The guest HHOOK layout retains HookNode's first four fields. owner is
  ;; private trailing metadata, not a public ABI.
  (layout GetMessageHookNode
    (field magic i32) (field proc i32) (field next i32)
    (field retired_next i32) (field owner i32))

  (func $getmessage_hook_state (param $tid i32) (result i32)
    (if (i32.or (i32.lt_u (local.get $tid) (i32.const 1))
                (i32.gt_u (local.get $tid) (i32.const 16)))
      (then (return (i32.const 0))))
    (i32.add (region.addr $GETMESSAGE_HOOKS 0)
      (i32.mul (i32.sub (local.get $tid) (i32.const 1)) (i32.const 16))))

  ;; Caller holds USER lock. Detach only when no owner callback can retain a
  ;; node. Actual heap frees happen after unlocking, never USER->heap lock order.
  (func $getmessage_hook_detach_retired (param $state i32) (result i32)
    (local $node i32)
    (if (i32.load offset=4 (local.get $state)) (then (return (i32.const 0))))
    (local.set $node (i32.load offset=8 (local.get $state)))
    (i32.store offset=8 (local.get $state) (i32.const 0))
    (local.get $node))

  (func $getmessage_hook_free_list (param $node i32)
    (local $next i32)
    (block $done (loop $scan
      (br_if $done (i32.eqz (local.get $node)))
      (local.set $next (load.field.memarg HookNode retired_next (call $g2w (local.get $node))))
      (call $heap_free (local.get $node))
      (local.set $node (local.get $next)) (br $scan))))

  (func $getmessage_hook_install (param $proc i32) (param $tid i32) (result i32)
    (local $state i32) (local $node i32) (local $wa i32) (local $generation i32)
    (local.set $state (call $getmessage_hook_state (local.get $tid)))
    ;; Global/injected hooks are not emulated by silently choosing this thread.
    (if (i32.or (i32.eqz (local.get $state)) (i32.eqz (local.get $proc)))
      (then (return (i32.const 0))))
    (call $lock_wnd_acquire)
    (local.set $generation (i32.load offset=12 (local.get $state)))
    ;; A cooperative main instance has no init_thread call. Its first real
    ;; registration may publish the initial owner, but a retired generation
    ;; cannot reopen itself merely because a stale instance keeps executing.
    (if (i32.and (i32.eqz (local.get $generation))
                  (i32.eq (local.get $tid) (global.get $current_thread_id)))
      (then
        (local.set $generation (i32.const 1))
        (i32.store offset=12 (local.get $state) (local.get $generation))))
    (call $lock_wnd_release)
    (if (i32.eqz (i32.and (local.get $generation) (i32.const 1)))
      (then (return (i32.const 0))))
    (if (i32.eq (local.get $tid) (global.get $current_thread_id))
      (then
        (if (global.get $getmessage_owner_generation)
          (then
            (if (i32.ne (global.get $getmessage_owner_generation) (local.get $generation))
              (then (return (i32.const 0)))))
          (else (global.set $getmessage_owner_generation (local.get $generation))))))
    (local.set $node (call $heap_alloc (size-of GetMessageHookNode)))
    (if (i32.eqz (local.get $node)) (then (return (i32.const 0))))
    (local.set $wa (call $g2w (local.get $node)))
    (store.field GetMessageHookNode magic (local.get $wa) (i32.const 0x31484D47)) ;; GMH1
    (store.field.memarg GetMessageHookNode proc (local.get $wa) (local.get $proc))
    (store.field.memarg GetMessageHookNode retired_next (local.get $wa) (i32.const 0))
    (store.field.memarg GetMessageHookNode owner (local.get $wa) (local.get $tid))
    (call $lock_wnd_acquire)
    (if (i32.ne (i32.load offset=12 (local.get $state)) (local.get $generation))
      (then
        (call $lock_wnd_release)
        (call $heap_free (local.get $node))
        (return (i32.const 0))))
    (store.field.memarg GetMessageHookNode next (local.get $wa) (i32.load (local.get $state)))
    (i32.store (local.get $state) (local.get $node))
    (call $lock_wnd_release)
    (local.get $node))

  ;; Search known live chains, rather than dereferencing an arbitrary HHOOK.
  (func $getmessage_hook_remove (param $handle i32) (result i32)
    (local $tid i32) (local $state i32) (local $node i32) (local $previous i32)
    (local $next i32) (local $wa i32) (local $free i32) (local $found i32)
    (local.set $tid (i32.const 1))
    (call $lock_wnd_acquire)
    (block $done (loop $owners
      (br_if $done (i32.gt_u (local.get $tid) (i32.const 16)))
      (local.set $state (call $getmessage_hook_state (local.get $tid)))
      (local.set $node (i32.load (local.get $state)))
      (local.set $previous (i32.const 0))
      (block $next_owner (loop $nodes
        (br_if $next_owner (i32.eqz (local.get $node)))
        (local.set $wa (call $g2w (local.get $node)))
        (local.set $next (load.field.memarg HookNode next (local.get $wa)))
        (if (i32.eq (local.get $node) (local.get $handle))
          (then
            (if (local.get $previous)
              (then (store.field.memarg HookNode next (call $g2w (local.get $previous)) (local.get $next)))
              (else (i32.store (local.get $state) (local.get $next))))
            (store.field HookNode magic (local.get $wa) (i32.const 0x30484D47)) ;; GMH0 retired
            (store.field.memarg HookNode retired_next (local.get $wa) (i32.load offset=8 (local.get $state)))
            (i32.store offset=8 (local.get $state) (local.get $node))
            (local.set $free (call $getmessage_hook_detach_retired (local.get $state)))
            (local.set $found (i32.const 1)) (br $done)))
        (local.set $previous (local.get $node))
        (local.set $node (local.get $next)) (br $nodes)))
      (local.set $tid (i32.add (local.get $tid) (i32.const 1))) (br $owners)))
    (call $lock_wnd_release)
    (call $getmessage_hook_free_list (local.get $free))
    (local.get $found))

  (func $getmessage_hook_reset (param $tid i32)
    (local $state i32) (local $node i32) (local $next i32) (local $wa i32) (local $free i32)
    (local.set $state (call $getmessage_hook_state (local.get $tid)))
    (if (i32.eqz (local.get $state)) (then (return)))
    (call $lock_wnd_acquire)
    (local.set $node (i32.load (local.get $state)))
    (i32.store (local.get $state) (i32.const 0))
    (i32.store offset=12 (local.get $state)
      (i32.and (i32.add (i32.load offset=12 (local.get $state)) (i32.const 2)) (i32.const -2)))
    (block $done (loop $nodes
      (br_if $done (i32.eqz (local.get $node)))
      (local.set $wa (call $g2w (local.get $node)))
      (local.set $next (load.field.memarg HookNode next (local.get $wa)))
      (store.field HookNode magic (local.get $wa) (i32.const 0x30484D47))
      (store.field.memarg HookNode retired_next (local.get $wa) (i32.load offset=8 (local.get $state)))
      (i32.store offset=8 (local.get $state) (local.get $node))
      (local.set $node (local.get $next)) (br $nodes)))
    (local.set $free (call $getmessage_hook_detach_retired (local.get $state)))
    (call $lock_wnd_release)
    (call $getmessage_hook_free_list (local.get $free)))

  (func $getmessage_hook_open_owner (param $tid i32)
    (local $state i32)
    (local.set $state (call $getmessage_hook_state (local.get $tid)))
    (if (i32.eqz (local.get $state)) (then (return)))
    (call $lock_wnd_acquire)
    (i32.store offset=12 (local.get $state) (i32.or (i32.load offset=12 (local.get $state)) (i32.const 1)))
    (if (i32.eq (local.get $tid) (global.get $current_thread_id))
      (then (global.set $getmessage_owner_generation (i32.load offset=12 (local.get $state)))))
    (call $lock_wnd_release))

  (func $getmessage_hook_take (result i32)
    (local $state i32) (local $node i32)
    (local.set $state (call $getmessage_hook_state (global.get $current_thread_id)))
    (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
    (call $lock_wnd_acquire)
    ;; First cooperative-main retrieval may precede any same-thread hook
    ;; registration. Only the initial generation is adoptable this way.
    (if (i32.and (i32.eqz (global.get $getmessage_owner_generation))
                  (i32.eq (i32.load offset=12 (local.get $state)) (i32.const 1)))
      (then (global.set $getmessage_owner_generation (i32.const 1))))
    (if (i32.eq (i32.load offset=12 (local.get $state)) (global.get $getmessage_owner_generation))
      (then (local.set $node (i32.load (local.get $state)))))
    (if (local.get $node)
      (then (i32.store offset=4 (local.get $state) (i32.add (i32.load offset=4 (local.get $state)) (i32.const 1)))))
    (call $lock_wnd_release)
    (local.get $node))

  (func $getmessage_hook_leave (param $tid i32)
    (local $state i32) (local $free i32)
    (local.set $state (call $getmessage_hook_state (local.get $tid)))
    (call $lock_wnd_acquire)
    (i32.store offset=4 (local.get $state) (i32.sub (i32.load offset=4 (local.get $state)) (i32.const 1)))
    (local.set $free (call $getmessage_hook_detach_retired (local.get $state)))
    (call $lock_wnd_release)
    (call $getmessage_hook_free_list (local.get $free)))

  (func $getmessage_hook_next (param $node i32) (result i32)
    (local $owner i32) (local $wa i32)
    (call $lock_wnd_acquire)
    (local.set $owner (load.field.memarg GetMessageHookNode owner (call $g2w (local.get $node))))
    (local.set $node (load.field.memarg HookNode next (call $g2w (local.get $node))))
    (block $done (loop $scan
      (br_if $done (i32.eqz (local.get $node)))
      (local.set $wa (call $g2w (local.get $node)))
      (if (i32.ne (load.field.memarg GetMessageHookNode owner (local.get $wa)) (local.get $owner))
        (then (local.set $node (i32.const 0)) (br $done)))
      (br_if $done (i32.eq (load.field HookNode magic (local.get $wa)) (i32.const 0x31484D47)))
      (local.set $node (load.field.memarg HookNode next (local.get $wa))) (br $scan)))
    (call $lock_wnd_release)
    (local.get $node))

  (func $getmessage_hook_begin (param $ret i32) (param $msg i32) (param $remove i32) (param $result i32)
    (local $node i32)
    (local.set $node (call $getmessage_hook_take))
    (if (i32.eqz (local.get $node)) (then (return)))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $current_thread_id))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $result))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $hook_active_node))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $ret))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0x314B4D47))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $msg))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $remove))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $font_enum_ret_thunk))

    (global.set $hook_active_node (local.get $node))
    (global.set $eip (call $hook_node_proc (local.get $node)))
    (global.set $steps (i32.const 0)))

  (func $getmessage_hook_continue
    (local $sp i32) (local $tid i32)
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (local.set $tid (call $gl32 (i32.add (local.get $sp) (i32.const 16))))
    (global.set $eip (call $gl32 (i32.add (local.get $sp) (i32.const 4))))
    (global.set $hook_active_node (call $gl32 (i32.add (local.get $sp) (i32.const 8))))
    (i32.store (global.get $reg_base) (call $gl32 (i32.add (local.get $sp) (i32.const 12))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (local.get $sp) (i32.const 20)))
    (call $getmessage_hook_leave (local.get $tid)))

  (func $keyboard_hook_finish
    (local $sp i32) (local $ret i32) (local $msg i32) (local $remove i32)
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (local.set $ret (call $gl32 (i32.add (local.get $sp) (i32.const 4))))
    (local.set $msg (call $gl32 (i32.add (local.get $sp) (i32.const 12))))
    (local.set $remove (call $gl32 (i32.add (local.get $sp) (i32.const 16))))
    (call $hook_dispatch_leave (call $gl32 (i32.add (local.get $sp) (i32.const 8))))
    (global.set $eip (local.get $ret))
    (i32.store offset=16 (global.get $reg_base) (i32.add (local.get $sp) (i32.const 20)))
    (i32.store (global.get $reg_base) (i32.const 1))
    (call $getmessage_hook_begin (local.get $ret) (local.get $msg) (local.get $remove) (i32.const 1)))
