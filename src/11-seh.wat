  ;; ============================================================
  ;; SEH EXCEPTION DISPATCH
  ;; ============================================================
  ;; Raise a hardware exception via Win32 SEH.
  ;; Walks the SEH chain from FS:[0]. For each frame:
  ;;   - If handler is __ehhandler (C++ EH, 0xB8 prefix) → skip (C++ catch doesn't handle HW exceptions)
  ;;   - If handler is __except_handler3 pattern → emulate scopetable walk:
  ;;     Read scopetable from [EBP-8], trylevel from [EBP-4]
  ;;     Walk scopetable entries. If filter is non-NULL, call it via guest execution.
  ;;     Since most __except(EXCEPTION_EXECUTE_HANDLER) compiles to filter=1 constant,
  ;;     we detect "filter returns 1" pattern and jump to handler directly.
  ;;   - Otherwise, call handler via guest execution.
  ;; On match: unwind chain (FS:[0] = frame->next), restore EBP, jump to except body.
  ;; If no match: host_exit as last resort.
  ;;
  ;; Stack frame layout for __except_handler3 / __CxxFrameHandler3 frames
  ;; (MSVC __SEH_prolog4 / _EH_prolog3): 5-dword extended registration record.
  ;;   [EBP+0]   saved_ebp
  ;;   [EBP-4]   trylevel / EH state  (= seh_rec+0xC)
  ;;   [EBP-8]   scopetable ptr / FuncInfo*  (= seh_rec+8)
  ;;   [EBP-C]   handler (_except_handler3 or __ehhandler stub) (= seh_rec+4)
  ;;   [EBP-10]  prev SEH record (= seh_rec+0) — FS:[0] points here
  ;;   ⇒ EBP = seh_rec + 0x10
  ;;
  ;; ScopeTableEntry (12 bytes each):
  ;;   [+0]  enclosingLevel (-1 = top)
  ;;   [+4]  filterFunc (guest addr, or 0)
  ;;   [+8]  handlerFunc (guest addr — the __except block)
  ;;
  ;; A Delphi handler may call RtlUnwind before returning
  ;; ExceptionContinueSearch. That makes FS:[0] the authoritative next frame;
  ;; the old record's link may have been rewritten by the runtime meanwhile.
  ;; Handlers that leave the live chain untouched use the ordinary saved link.
  (global $delphi_seh_head_before (mut i32) (i32.const 0))

  ;; An exception no frame claimed. On Win98 the default UnhandledException
  ;; filter puts up "This program has performed an illegal operation" and the
  ;; process is terminated -- whichever thread faulted. So stop this instance
  ;; exactly the way ExitProcess/exit() do: report the code, then EIP 0 (the
  ;; run loop halts on it), no quantum left, the block abandoned rather than
  ;; parked in $resume_ip, and yield reason 2 so a guest-thread instance is
  ;; reaped by the ThreadManager instead of being rescheduled.
  ;;
  ;; Calling host_exit alone is NOT enough, and was the bug: host_exit only
  ;; tells JS, which acts between batches. The faulting EIP stayed put, the
  ;; batch ran on, re-entered the same faulting block and raised again --
  ;; forever, inside one wasm call, where --max-seconds and SIGTERM cannot
  ;; reach (JigSawedME, 15 hours in one batch).
  ;;
  ;; Process-wide scope from a guest thread: the thread instance stops here,
  ;; but a worker instance's host "exit" import is a no-op (as it already is
  ;; for ExitProcess called on a guest thread), so the main thread is not torn
  ;; down with it. Win98 would end the whole process.
  (func $seh_terminate_unhandled (param $exit_code i32)
    (call $host_log_i32 (i32.const 0xCAE8C0DE))   ;; unhandled -> terminate
    (call $host_log_i32 (local.get $exit_code))
    (call $host_exit (local.get $exit_code))
    (global.set $eip (i32.const 0))
    (global.set $eip_redirected (i32.const 1))
    (global.set $resume_ip (i32.const 0))
    (global.set $steps (i32.const 0))
    (global.set $yield_flag (i32.const 1))
    (global.set $yield_reason (i32.const 2)))

  ;; Raise-storm guard. A handler that "continues execution" without fixing
  ;; the cause re-faults at the same instruction on the same address, and that
  ;; cycle never leaves the batch on its own. Count consecutive identical
  ;; raises (code, EIP, fault address); every 64th one asks $run to return to
  ;; the host, so a harness deadline can still act. The log is kept to the
  ;; first few of a run plus one marker per 64K, since the repeats say nothing
  ;; new. Only the raise path pays for any of this.
  (global $raise_last_code (mut i32) (i32.const 0))
  (global $raise_last_eip (mut i32) (i32.const 0))
  (global $raise_last_addr (mut i32) (i32.const 0))
  (global $raise_repeat (mut i32) (i32.const 0))
  (func $raise_storm_note (param $code i32) (result i32)
    (if (i32.and
          (i32.eq (local.get $code) (global.get $raise_last_code))
          (i32.and
            (i32.eq (global.get $eip) (global.get $raise_last_eip))
            (i32.eq (global.get $fault_address) (global.get $raise_last_addr))))
      (then
        (global.set $raise_repeat (i32.add (global.get $raise_repeat) (i32.const 1))))
      (else
        (global.set $raise_last_code (local.get $code))
        (global.set $raise_last_eip (global.get $eip))
        (global.set $raise_last_addr (global.get $fault_address))
        (global.set $raise_repeat (i32.const 0))))
    (if (i32.eq (i32.and (global.get $raise_repeat) (i32.const 63)) (i32.const 63))
      (then (global.set $yield_flag (i32.const 1))))
    (if (i32.eq (i32.and (global.get $raise_repeat) (i32.const 0xFFFF)) (i32.const 0xFFFF))
      (then
        (call $host_log_i32 (i32.const 0xCAE8C0FF))   ;; raise storm
        (call $host_log_i32 (local.get $code))
        (call $host_log_i32 (global.get $eip))
        (call $host_log_i32 (global.get $raise_repeat))))
    ;; 1 = worth logging this raise individually.
    (i32.lt_u (global.get $raise_repeat) (i32.const 8)))

  (func $delphi_seh_continue_search
    (local $live_head i32)
    ;; We are leaving an unwind/finally handler and returning to the search
    ;; phase. Do not leak EXCEPTION_UNWINDING/EXIT_UNWIND into the next frame;
    ;; Delphi catch handlers deliberately ignore records carrying those bits.
    (if (global.get $delphi_exception_record)
      (then (call $gs32
        (i32.add (global.get $delphi_exception_record) (i32.const 4))
        (i32.and
          (call $gl32 (i32.add (global.get $delphi_exception_record) (i32.const 4)))
          (i32.const 0xFFFFFFF9)))))
    (local.set $live_head (call $gl32 (global.get $fs_base)))
    (if (i32.and
          (i32.eq (global.get $delphi_seh_rec) (global.get $delphi_seh_head_before))
          (i32.ne (local.get $live_head) (global.get $delphi_seh_head_before)))
      (then (global.set $delphi_seh_rec (local.get $live_head)))
      (else (global.set $delphi_seh_rec
        (call $gl32 (global.get $delphi_seh_rec))))))

  (func $dispatch_delphi_exception_handler
    (local $handler i32)
    (block $unhandled (loop $walk
      (br_if $unhandled (i32.eq (global.get $delphi_seh_rec) (i32.const 0xFFFFFFFF)))
      (br_if $unhandled (i32.eqz (global.get $delphi_seh_rec)))
      (local.set $handler (call $gl32 (i32.add (global.get $delphi_seh_rec) (i32.const 4))))
      ;; An earlier dispatch's node (this raise is nested in a handler, e.g.
      ;; a catch block rethrowing): "nested exception", keep searching.
      (if (i32.and (i32.ne (local.get $handler) (i32.const 0))
                   (i32.eq (local.get $handler) (global.get $seh_node_thunk)))
        (then (local.set $handler (i32.const 0))))
      (if (local.get $handler)
        (then
          (global.set $delphi_seh_head_before
            (call $gl32 (global.get $fs_base)))
          ;; Call handler(ExceptionRecord, EstablisherFrame, ContextRecord,
          ;; DispatcherContext) under a dispatcher node: the node takes the
          ;; 20 bytes above the argument frame, and 0xCACA000E pops both.
          ;; The node's +12/+16 keep this raise's resume point, and with the
          ;; node's next (the head before the call) and the record and frame
          ;; arguments they are this dispatch's whole state. A raise inside
          ;; the handler -- MSVC runs a catch block, and its `throw;`, from
          ;; inside the frame handler -- starts a nested dispatch that
          ;; overwrites every $delphi_* global, so 0xCACA000E reloads them
          ;; from here instead of trusting them.
          (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
          (call $seh_push_dispatch_node
            (i32.load offset=16 (global.get $reg_base)) (global.get $delphi_seh_rec))
          (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))
            (global.get $delphi_resume_eip))
          (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))
            (global.get $delphi_resume_esp))
          (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
          (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $delphi_seh_thunk))
          (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)) (global.get $delphi_exception_record))
          (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)) (global.get $delphi_seh_rec))
          (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)) (i32.const 0))
          (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)) (i32.const 0))
          (global.set $eip (local.get $handler))
          (global.set $steps (i32.const 0))
          (return)))
      (global.set $delphi_seh_rec (call $gl32 (global.get $delphi_seh_rec)))
      (br $walk)))
    (call $seh_terminate_unhandled (i32.or (i32.const 0xDE00)
      (call $gl32 (global.get $delphi_exception_record)))))

  (func $raise_delphi_exception (param $code i32) (param $flags i32) (param $nargs i32) (param $args_ptr i32)
    (local $seh_rec i32) (local $rec i32) (local $i i32) (local $n i32)
    ;; Name the thrown C++ type before the chain walk decides its fate. Once a
    ;; frame accepts it the payload is gone, and the only trace left is the
    ;; CRT's ExitProcess(0xE06D7363) -- a code that says "a C++ exception"
    ;; and nothing about which one.
    (if (i32.and
          (i32.eq (local.get $code) (i32.const 0xe06d7363))
          (i32.ge_u (local.get $nargs) (i32.const 3)))
      (then (call $host_cxx_throw (local.get $args_ptr))))
    (local.set $seh_rec (call $gl32 (global.get $fs_base)))
    (if (i32.or
          (i32.eq (local.get $seh_rec) (i32.const 0xFFFFFFFF))
          (i32.eqz (local.get $seh_rec)))
      (then
        (call $seh_terminate_unhandled (i32.or (i32.const 0xDE00) (local.get $code)))
        (return)))
    (local.set $rec (call $heap_alloc (i32.const 80)))
    ;; EXCEPTION_RECORD:
    ;; +0 code, +4 flags, +8 nested record, +C address, +10 arg count,
    ;; +14 ExceptionInformation[] copied from RaiseException lpArguments.
    (call $gs32 (local.get $rec) (local.get $code))
    (call $gs32 (i32.add (local.get $rec) (i32.const 4)) (local.get $flags))
    (call $gs32 (i32.add (local.get $rec) (i32.const 8)) (i32.const 0))
    (call $gs32 (i32.add (local.get $rec) (i32.const 12)) (global.get $eip))
    (local.set $n (if (result i32) (i32.gt_u (local.get $nargs) (i32.const 15))
      (then (i32.const 15))
      (else (local.get $nargs))))
    (call $gs32 (i32.add (local.get $rec) (i32.const 16)) (local.get $n))
    (block $done (loop $copy
      (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
      (call $gs32
        (i32.add (local.get $rec) (i32.add (i32.const 20) (i32.shl (local.get $i) (i32.const 2))))
        (if (result i32) (local.get $args_ptr)
          (then (call $gl32 (i32.add (local.get $args_ptr) (i32.shl (local.get $i) (i32.const 2)))))
          (else (i32.const 0))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $copy)))
    (global.set $delphi_exception_record (local.get $rec))
    (global.set $delphi_seh_rec (local.get $seh_rec))
    (call $dispatch_delphi_exception_handler))

  ;; The SEH walk reads guest memory through $gl32/$g2w. With --fault-null=raise
  ;; armed, an unmapped chain pointer would raise again from inside the walk and
  ;; recurse until the wasm stack gives out, so the walk runs bracketed by a
  ;; guard that $g2w_miss checks before it raises.
  (func $raise_exception (param $code i32)
    ;; A CPU fault is rare and, once a guest __except has swallowed it, leaves
    ;; no other trace: name the code and the faulting block.
    (if (call $raise_storm_note (local.get $code))
      (then
        (call $host_log_i32 (i32.const 0xCAE8C000))
        (call $host_log_i32 (local.get $code))
        (call $host_log_i32 (global.get $eip))))
    (global.set $fault_raising (i32.const 1))
    (call $raise_exception_walk (local.get $code))
    (global.set $fault_raising (i32.const 0)))

  (func $raise_exception_walk (param $code i32)
    (call $seh_walk_from (local.get $code) (call $gl32 (global.get $fs_base))))

  ;; The guest address a CPU fault touched, for the access-violation record's
  ;; ExceptionInformation[1]. Set by whoever raises 0xC0000005.
  (global $fault_address (mut i32) (i32.const 0))
  (global $seh_raw_thunk (mut i32) (i32.const 0))

  ;; Does $seh_rec carry an MSVC __except_handler3 extended record? Its +8 is
  ;; a scope table in the image and its +C a try level, -1 or a small index.
  ;; Anything else -- a packer's bare two-word record, a hand-rolled frame --
  ;; has no scope table to emulate and its handler must be called for real.
  (func $seh_frame_is_msvc (param $seh_rec i32) (result i32)
    (local $scopetable i32) (local $trylevel i32)
    (local.set $scopetable (call $gl32 (i32.add (local.get $seh_rec) (i32.const 8))))
    (local.set $trylevel (call $gl32 (i32.add (local.get $seh_rec) (i32.const 12))))
    (if (i32.eqz (local.get $scopetable)) (then (return (i32.const 0))))
    (if (i32.eqz (call $guest_addr_mapped (local.get $scopetable))) (then (return (i32.const 0))))
    (i32.or (i32.eq (local.get $trylevel) (i32.const -1))
            (i32.lt_u (local.get $trylevel) (i32.const 0x400))))

  ;; Call a frame handler the way KiUserExceptionDispatcher does:
  ;; EXCEPTION_RECORD and CONTEXT built on the faulting thread's stack, then
  ;; handler(ExceptionRecord, EstablisherFrame, ContextRecord, DispatcherContext)
  ;; returning to a thunk that acts on the disposition ($seh_raw_continue).
  (func $seh_call_raw_handler (param $code i32) (param $seh_rec i32) (param $handler i32)
    (local $esp i32) (local $ctx i32) (local $rec i32) (local $sp i32)
    (if (i32.eqz (global.get $seh_raw_thunk))
      (then (global.set $seh_raw_thunk (call $com_cont_thunk (i32.const 0xCACA0037)))))
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (local.set $ctx (i32.and (i32.sub (local.get $esp) (i32.const 0x2cc)) (i32.const 0xFFFFFFFC)))
    (local.set $rec (i32.sub (local.get $ctx) (i32.const 0x50)))
    (call $zero_memory (call $g2w (local.get $rec)) (i32.const 0x31c))
    ;; EXCEPTION_RECORD: code, flags, nested, address, NumberParameters, info[].
    (call $gs32 (local.get $rec) (local.get $code))
    (call $gs32 (i32.add (local.get $rec) (i32.const 12)) (global.get $eip))
    (if (i32.eq (local.get $code) (i32.const 0xC0000005))
      (then
        (call $gs32 (i32.add (local.get $rec) (i32.const 16)) (i32.const 2))
        (call $gs32 (i32.add (local.get $rec) (i32.const 24)) (global.get $fault_address))))
    ;; CONTEXT (x86): CONTEXT_FULL, segments, integer registers, control.
    (call $gs32 (local.get $ctx) (i32.const 0x10007))
    (call $gs32 (i32.add (local.get $ctx) (i32.const 0x90)) (i32.const 0x3b))   ;; SegFs
    (call $gs32 (i32.add (local.get $ctx) (i32.const 0x94)) (i32.const 0x23))   ;; SegEs
    (call $gs32 (i32.add (local.get $ctx) (i32.const 0x98)) (i32.const 0x23))   ;; SegDs
    (call $gs32 (i32.add (local.get $ctx) (i32.const 0x9c)) (i32.load offset=28 (global.get $reg_base)))
    (call $gs32 (i32.add (local.get $ctx) (i32.const 0xa0)) (i32.load offset=24 (global.get $reg_base)))
    (call $gs32 (i32.add (local.get $ctx) (i32.const 0xa4)) (i32.load offset=12 (global.get $reg_base)))
    (call $gs32 (i32.add (local.get $ctx) (i32.const 0xa8)) (i32.load offset=8 (global.get $reg_base)))
    (call $gs32 (i32.add (local.get $ctx) (i32.const 0xac)) (i32.load offset=4 (global.get $reg_base)))
    (call $gs32 (i32.add (local.get $ctx) (i32.const 0xb0)) (i32.load offset=0 (global.get $reg_base)))
    (call $gs32 (i32.add (local.get $ctx) (i32.const 0xb4)) (i32.load offset=20 (global.get $reg_base)))
    (call $gs32 (i32.add (local.get $ctx) (i32.const 0xb8)) (global.get $eip))
    (call $gs32 (i32.add (local.get $ctx) (i32.const 0xbc)) (i32.const 0x1b))   ;; SegCs
    (call $gs32 (i32.add (local.get $ctx) (i32.const 0xc0)) (call $build_eflags))
    (call $gs32 (i32.add (local.get $ctx) (i32.const 0xc4)) (local.get $esp))
    (call $gs32 (i32.add (local.get $ctx) (i32.const 0xc8)) (i32.const 0x23))   ;; SegSs
    ;; Dispatcher node in the 12 bytes above the argument frame.
    (call $seh_push_dispatch_node (i32.sub (local.get $rec) (i32.const 12)) (local.get $seh_rec))
    (local.set $sp (i32.sub (local.get $rec) (i32.const 32)))
    (call $gs32 (local.get $sp) (global.get $seh_raw_thunk))
    (call $gs32 (i32.add (local.get $sp) (i32.const 4)) (local.get $rec))
    (call $gs32 (i32.add (local.get $sp) (i32.const 8)) (local.get $seh_rec))
    (call $gs32 (i32.add (local.get $sp) (i32.const 12)) (local.get $ctx))
    (call $gs32 (i32.add (local.get $sp) (i32.const 16)) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (global.set $eip (local.get $handler))
    (global.set $steps (i32.const 0)))

  ;; Put the thread back exactly as the CONTEXT at $ctx describes it.
  (func $seh_load_context (param $ctx i32)
    (i32.store offset=28 (global.get $reg_base) (call $gl32 (i32.add (local.get $ctx) (i32.const 0x9c))))
    (i32.store offset=24 (global.get $reg_base) (call $gl32 (i32.add (local.get $ctx) (i32.const 0xa0))))
    (i32.store offset=12 (global.get $reg_base) (call $gl32 (i32.add (local.get $ctx) (i32.const 0xa4))))
    (i32.store offset=8 (global.get $reg_base) (call $gl32 (i32.add (local.get $ctx) (i32.const 0xa8))))
    (i32.store offset=4 (global.get $reg_base) (call $gl32 (i32.add (local.get $ctx) (i32.const 0xac))))
    (i32.store offset=0 (global.get $reg_base) (call $gl32 (i32.add (local.get $ctx) (i32.const 0xb0))))
    (i32.store offset=20 (global.get $reg_base) (call $gl32 (i32.add (local.get $ctx) (i32.const 0xb4))))
    (call $load_eflags (call $gl32 (i32.add (local.get $ctx) (i32.const 0xc0))))
    (i32.store offset=16 (global.get $reg_base) (call $gl32 (i32.add (local.get $ctx) (i32.const 0xc4))))
    (global.set $eip (call $gl32 (i32.add (local.get $ctx) (i32.const 0xb8))))
    (global.set $steps (i32.const 0)))

  ;; 0xCACA0037: a handler called by $seh_call_raw_handler returned. The
  ;; handler is cdecl, so ESP is at its four arguments.
  ;; ExceptionContinueExecution (0) resumes from the CONTEXT, which is how a
  ;; handler that edited Eip redirects the thread. ExceptionContinueSearch (1)
  ;; restores the faulting state and offers the exception to the next frame.
  (func $seh_raw_continue
    (local $esp i32) (local $rec i32) (local $frame i32) (local $ctx i32) (local $disp i32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (local.set $rec (call $gl32 (local.get $esp)))
    (local.set $frame (call $gl32 (i32.add (local.get $esp) (i32.const 4))))
    (local.set $ctx (call $gl32 (i32.add (local.get $esp) (i32.const 8))))
    (local.set $disp (i32.load offset=0 (global.get $reg_base)))
    (call $seh_pop_dispatch_node (i32.add (local.get $esp) (i32.const 16)))
    (call $seh_load_context (local.get $ctx))
    (if (i32.eqz (local.get $disp)) (then (return)))
    (if (i32.eq (local.get $disp) (i32.const 1))
      (then
        (global.set $fault_raising (i32.const 1))
        (call $seh_walk_from (call $gl32 (local.get $rec)) (call $gl32 (local.get $frame)))
        (global.set $fault_raising (i32.const 0))
        (return)))
    (call $seh_terminate_unhandled (i32.or (i32.const 0xDE00) (call $gl32 (local.get $rec)))))

  ;; ============================================================
  ;; Dispatcher registration node
  ;; ============================================================
  ;; NT's RtlpExecuteHandlerForException links a registration of its own on
  ;; top of FS:[0] for as long as a frame handler runs (next = the chain head,
  ;; handler = RtlpExceptionHandler, +8 = the establisher frame) and pops it
  ;; when the handler returns. Runtimes depend on it being there: msvcr71's
  ;; _UnwindNestedFrames saves FS:[0], calls RtlUnwind(catching frame), then
  ;; does saved->next = FS:[0]; FS:[0] = saved. With no node the saved head
  ;; is the catching frame itself whenever it was on top, and that relink
  ;; makes it point at itself -- the next exception's walk then never ends
  ;; (UT2004's guard/unguard rethrow during its map load).
  ;;
  ;; Our walks skip a node rather than call it, since its only answers are
  ;; "continue search" while unwinding and "nested exception" (keep
  ;; searching past it) otherwise. The handler address is still a real
  ;; 0xCACA003A thunk that answers the same way, for guest code that walks
  ;; the chain and calls handlers itself.
  (global $seh_node_thunk (mut i32) (i32.const 0))

  (func $seh_push_dispatch_node (param $node i32) (param $frame i32)
    (if (i32.eqz (global.get $seh_node_thunk))
      (then (global.set $seh_node_thunk (call $com_cont_thunk (i32.const 0xCACA003A)))))
    (call $gs32 (local.get $node) (call $gl32 (global.get $fs_base)))
    (call $gs32 (i32.add (local.get $node) (i32.const 4)) (global.get $seh_node_thunk))
    (call $gs32 (i32.add (local.get $node) (i32.const 8)) (local.get $frame))
    (call $gs32 (global.get $fs_base) (local.get $node)))

  ;; The handler returned: drop the node if it is still the head. A handler
  ;; that unwound past it (RtlUnwind unlinks it like any other frame) has
  ;; already taken it off.
  (func $seh_pop_dispatch_node (param $node i32)
    (if (i32.eq (call $gl32 (global.get $fs_base)) (local.get $node))
      (then (call $gs32 (global.get $fs_base) (call $gl32 (local.get $node))))))

  (func $seh_is_dispatch_node (param $rec i32) (result i32)
    (i32.and (i32.ne (global.get $seh_node_thunk) (i32.const 0))
             (i32.eq (call $gl32 (i32.add (local.get $rec) (i32.const 4)))
                     (global.get $seh_node_thunk))))

  ;; Synchronous access-violation dispatch for a reserved page (fault mode 5).
  ;; Offer EXCEPTION_ACCESS_VIOLATION to each FS:[0] handler as a nested guest
  ;; call, from inside the faulting memory access. A handler that answers
  ;; ExceptionContinueExecution (0) is expected to have committed the page;
  ;; the caller then re-translates and the faulting instruction completes, so
  ;; no precise faulting EIP is needed. ExceptionContinueSearch (1) tries the
  ;; next frame. Anything else, or no frame continuing, returns 0 and the
  ;; access keeps today's sentinel. Registers, EIP and flags are restored
  ;; afterwards; a handler's CONTEXT edits are not applied (resumption is the
  ;; instruction itself, not CONTEXT.Eip). Only for handlers that return: one
  ;; that unwinds into an __except body would leave the bounded run.
  (global $fault_sync_active (mut i32) (i32.const 0))
  (func $seh_fault_sync (param $ga i32) (result i32)
    (local $old_eip i32) (local $old_esp i32) (local $old_eflags i32)
    (local $old_eax i32) (local $old_ecx i32) (local $old_edx i32) (local $old_ebx i32)
    (local $old_esi i32) (local $old_edi i32) (local $old_ebp i32)
    (local $old_handler_set_eip i32) (local $old_steps i32)
    (local $old_yield_reason i32) (local $old_yield_flag i32)
    (local $ctx i32) (local $rec i32) (local $sp i32) (local $frame i32)
    (local $handler i32) (local $rounds i32) (local $ok i32) (local $guard i32)
    (if (i32.or (global.get $fault_sync_active)
                (i32.eqz (global.get $sync_msg_ret_thunk)))
      (then (return (i32.const 0))))
    (global.set $fault_sync_active (i32.const 1))
    (global.set $fault_raising (i32.const 1))
    (local.set $old_eip (global.get $eip))
    (local.set $old_esp (i32.load offset=16 (global.get $reg_base)))
    (local.set $old_eflags (call $build_eflags))
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
    ;; EXCEPTION_RECORD and CONTEXT below the faulting thread's stack, as
    ;; $seh_call_raw_handler lays them out.
    (local.set $ctx (i32.and (i32.sub (local.get $old_esp) (i32.const 0x2cc)) (i32.const 0xFFFFFFFC)))
    (local.set $rec (i32.sub (local.get $ctx) (i32.const 0x50)))
    (call $zero_memory (call $g2w (local.get $rec)) (i32.const 0x31c))
    (call $gs32 (local.get $rec) (i32.const 0xC0000005))
    (call $gs32 (i32.add (local.get $rec) (i32.const 12)) (local.get $old_eip))
    (call $gs32 (i32.add (local.get $rec) (i32.const 16)) (i32.const 2))
    (call $gs32 (i32.add (local.get $rec) (i32.const 24)) (local.get $ga))
    (call $gs32 (local.get $ctx) (i32.const 0x10007))
    (call $gs32 (i32.add (local.get $ctx) (i32.const 0x9c)) (local.get $old_edi))
    (call $gs32 (i32.add (local.get $ctx) (i32.const 0xa0)) (local.get $old_esi))
    (call $gs32 (i32.add (local.get $ctx) (i32.const 0xa4)) (local.get $old_ebx))
    (call $gs32 (i32.add (local.get $ctx) (i32.const 0xa8)) (local.get $old_edx))
    (call $gs32 (i32.add (local.get $ctx) (i32.const 0xac)) (local.get $old_ecx))
    (call $gs32 (i32.add (local.get $ctx) (i32.const 0xb0)) (local.get $old_eax))
    (call $gs32 (i32.add (local.get $ctx) (i32.const 0xb4)) (local.get $old_ebp))
    (call $gs32 (i32.add (local.get $ctx) (i32.const 0xb8)) (local.get $old_eip))
    (call $gs32 (i32.add (local.get $ctx) (i32.const 0xc0)) (local.get $old_eflags))
    (call $gs32 (i32.add (local.get $ctx) (i32.const 0xc4)) (local.get $old_esp))
    (local.set $frame (call $gl32 (global.get $fs_base)))
    (block $walked (loop $walk
      (br_if $walked (i32.or (i32.eq (local.get $frame) (i32.const -1))
                             (i32.eqz (local.get $frame))))
      (br_if $walked (i32.ge_u (local.get $guard) (i32.const 64)))
      (local.set $guard (i32.add (local.get $guard) (i32.const 1)))
      (if (i32.eqz (call $seh_is_dispatch_node (local.get $frame)))
        (then
          (local.set $handler (call $gl32 (i32.add (local.get $frame) (i32.const 4))))
          ;; handler(ExceptionRecord, EstablisherFrame, ContextRecord, 0),
          ;; cdecl, returning to the thunk that ends the nested run.
          (local.set $sp (i32.sub (local.get $rec) (i32.const 32)))
          (call $gs32 (local.get $sp) (global.get $sync_msg_ret_thunk))
          (call $gs32 (i32.add (local.get $sp) (i32.const 4)) (local.get $rec))
          (call $gs32 (i32.add (local.get $sp) (i32.const 8)) (local.get $frame))
          (call $gs32 (i32.add (local.get $sp) (i32.const 12)) (local.get $ctx))
          (call $gs32 (i32.add (local.get $sp) (i32.const 16)) (i32.const 0))
          (i32.store offset=16 (global.get $reg_base) (local.get $sp))
          (global.set $eip (local.get $handler))
          (global.set $steps (i32.const 0))
          (global.set $yield_reason (i32.const 0))
          (global.set $yield_flag (i32.const 0))
          (global.set $sync_msg_depth (i32.add (global.get $sync_msg_depth) (i32.const 1)))
          (local.set $rounds (i32.const 0))
          (block $ran (loop $run_more
            (call $run (i32.const 1000000))
            (br_if $ran (i32.eqz (global.get $eip)))
            (local.set $rounds (i32.add (local.get $rounds) (i32.const 1)))
            (br_if $ran (i32.ge_u (local.get $rounds) (i32.const 64)))
            (br $run_more)))
          (global.set $sync_msg_depth (i32.sub (global.get $sync_msg_depth) (i32.const 1)))
          ;; The handler never came back: give up on this fault.
          (br_if $walked (i32.ne (global.get $eip) (i32.const 0)))
          (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
            (then (local.set $ok (i32.const 1)) (br $walked)))
          (br_if $walked (i32.ne (i32.load offset=0 (global.get $reg_base)) (i32.const 1)))))
      (local.set $frame (call $gl32 (local.get $frame)))
      (br $walk)))
    (global.set $eip (local.get $old_eip))
    (i32.store offset=16 (global.get $reg_base) (local.get $old_esp))
    (i32.store offset=0 (global.get $reg_base) (local.get $old_eax))
    (i32.store offset=4 (global.get $reg_base) (local.get $old_ecx))
    (i32.store offset=8 (global.get $reg_base) (local.get $old_edx))
    (i32.store offset=12 (global.get $reg_base) (local.get $old_ebx))
    (i32.store offset=24 (global.get $reg_base) (local.get $old_esi))
    (i32.store offset=28 (global.get $reg_base) (local.get $old_edi))
    (i32.store offset=20 (global.get $reg_base) (local.get $old_ebp))
    (call $load_eflags (local.get $old_eflags))
    (global.set $handler_set_eip (local.get $old_handler_set_eip))
    (global.set $steps (local.get $old_steps))
    (global.set $yield_reason (local.get $old_yield_reason))
    (global.set $yield_flag (local.get $old_yield_flag))
    (global.set $fault_raising (i32.const 0))
    (global.set $fault_sync_active (i32.const 0))
    (local.get $ok))

  ;; 0xCACA003A called as handler(rec, frame, ctx, dispatcher): cdecl, ESP at
  ;; the return address. Unwinding: ExceptionContinueSearch. Otherwise
  ;; ExceptionNestedException, naming the frame whose handler was running.
  (func $seh_dispatch_node_handler
    (local $esp i32) (local $rec i32) (local $frame i32) (local $dc i32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (local.set $rec (call $gl32 (i32.add (local.get $esp) (i32.const 4))))
    (local.set $frame (call $gl32 (i32.add (local.get $esp) (i32.const 8))))
    (local.set $dc (call $gl32 (i32.add (local.get $esp) (i32.const 16))))
    (if (i32.and (call $gl32 (i32.add (local.get $rec) (i32.const 4))) (i32.const 6))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 1)))
      (else
        (if (local.get $dc)
          (then (call $gs32 (local.get $dc)
            (call $gl32 (i32.add (local.get $frame) (i32.const 8))))))
        (i32.store offset=0 (global.get $reg_base) (i32.const 2))))
    (global.set $eip (call $gl32 (local.get $esp)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (local.get $esp) (i32.const 4)))
    (global.set $steps (i32.const 0)))

  ;; ============================================================
  ;; RtlUnwind(TargetFrame, TargetIp, ExceptionRecord, ReturnValue)
  ;; ============================================================
  ;; The x86 NT semantics: every registration from FS:[0] up to but NOT
  ;; including TargetFrame has its handler called with EXCEPTION_UNWINDING
  ;; (plus EXCEPTION_EXIT_UNWIND when TargetFrame is NULL) set in the record,
  ;; and is unlinked after its handler returns. Then RtlUnwind returns to its
  ;; caller with EAX = ReturnValue; TargetIp is ignored on x86.
  ;;
  ;; Those handler calls are what run __finally blocks (_except_handler3's
  ;; _local_unwind2) and C++ destructors/cleanup (__CxxFrameHandler's
  ;; unwind path) in the frames being torn down. Without them msvcr71's
  ;; CallCatchBlock never runs its __finally (_FindAndUnlinkFrame) when a catch
  ;; block rethrows, so a stack FRAMEINFO stays linked in the per-thread chain,
  ;; later forms a cycle, and _IsExceptionObjectToBeDestroyed spins on it for
  ;; good -- UT2004's map load.
  ;;
  ;; Each handler is a real guest call, so the walk is a state machine driven
  ;; by the 0xCACA0039 continuation. Its state lives on the guest stack below
  ;; the caller's frame, which makes nested unwinds (an unwind handler that
  ;; itself unwinds) independent of each other. S = state base:
  ;;   S+0   DispatcherContext dword (handler's 4th arg points here)
  ;;   S+4   TargetFrame        S+8   ReturnValue
  ;;   S+12  return EIP         S+16  return ESP (caller's, args popped)
  ;;   S+20  current frame      S+24  EXCEPTION_RECORD*   S+28  CONTEXT*
  ;;   S+32  magic 'UNWD'       S+36  EBX, ESI, EDI, EBP of the caller
  ;;   S+52  CONTEXT (0x2cc)    S+0x320  built EXCEPTION_RECORD (0x50)
  ;; The handler call frame (thunk, rec, frame, ctx, &dispatcher) sits at S-20,
  ;; so the handler's cdecl argument slots never overlap state it may clobber.
  (global $rtl_unwind_thunk (mut i32) (i32.const 0))

  (func $rtl_unwind_begin (param $target i32) (param $rec_in i32) (param $retval i32) (param $ret i32)
    (local $esp i32) (local $s i32) (local $i i32) (local $rec i32) (local $ctx i32)
    (local $flags i32)
    (if (i32.eqz (global.get $rtl_unwind_thunk))
      (then (global.set $rtl_unwind_thunk (call $com_cont_thunk (i32.const 0xCACA0039)))))
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (local.set $s (i32.and (i32.sub (local.get $esp) (i32.const 0x3a0)) (i32.const 0xFFFFFFF0)))
    (block $z (loop $zl
      (br_if $z (i32.ge_u (local.get $i) (i32.const 0x370)))
      (call $gs32 (i32.add (local.get $s) (local.get $i)) (i32.const 0))
      (local.set $i (i32.add (local.get $i) (i32.const 4)))
      (br $zl)))
    (local.set $ctx (i32.add (local.get $s) (i32.const 52)))
    (local.set $rec (local.get $rec_in))
    (if (i32.eqz (local.get $rec))
      (then
        ;; No record supplied: STATUS_UNWIND raised at the caller's return address.
        (local.set $rec (i32.add (local.get $s) (i32.const 0x320)))
        (call $gs32 (local.get $rec) (i32.const 0xC0000027))
        (call $gs32 (i32.add (local.get $rec) (i32.const 12)) (local.get $ret))))
    (local.set $flags (i32.or (call $gl32 (i32.add (local.get $rec) (i32.const 4))) (i32.const 2)))
    (if (i32.eqz (local.get $target))
      (then (local.set $flags (i32.or (local.get $flags) (i32.const 4)))))
    (call $gs32 (i32.add (local.get $rec) (i32.const 4)) (local.get $flags))
    (call $gs32 (i32.add (local.get $s) (i32.const 4)) (local.get $target))
    (call $gs32 (i32.add (local.get $s) (i32.const 8)) (local.get $retval))
    (call $gs32 (i32.add (local.get $s) (i32.const 12)) (local.get $ret))
    (call $gs32 (i32.add (local.get $s) (i32.const 16)) (local.get $esp))
    (call $gs32 (i32.add (local.get $s) (i32.const 20)) (call $gl32 (global.get $fs_base)))
    (call $gs32 (i32.add (local.get $s) (i32.const 24)) (local.get $rec))
    (call $gs32 (i32.add (local.get $s) (i32.const 28)) (local.get $ctx))
    (call $gs32 (i32.add (local.get $s) (i32.const 32)) (i32.const 0x444E5755))   ;; 'UWND'
    (call $gs32 (i32.add (local.get $s) (i32.const 36)) (i32.load offset=12 (global.get $reg_base)))
    (call $gs32 (i32.add (local.get $s) (i32.const 40)) (i32.load offset=24 (global.get $reg_base)))
    (call $gs32 (i32.add (local.get $s) (i32.const 44)) (i32.load offset=28 (global.get $reg_base)))
    (call $gs32 (i32.add (local.get $s) (i32.const 48)) (i32.load offset=20 (global.get $reg_base)))
    ;; CONTEXT as the caller will see it once RtlUnwind returns.
    (call $gs32 (local.get $ctx) (i32.const 0x10007))
    (call $gs32 (i32.add (local.get $ctx) (i32.const 0x90)) (i32.const 0x3b))
    (call $gs32 (i32.add (local.get $ctx) (i32.const 0x94)) (i32.const 0x23))
    (call $gs32 (i32.add (local.get $ctx) (i32.const 0x98)) (i32.const 0x23))
    (call $gs32 (i32.add (local.get $ctx) (i32.const 0x9c)) (i32.load offset=28 (global.get $reg_base)))
    (call $gs32 (i32.add (local.get $ctx) (i32.const 0xa0)) (i32.load offset=24 (global.get $reg_base)))
    (call $gs32 (i32.add (local.get $ctx) (i32.const 0xa4)) (i32.load offset=12 (global.get $reg_base)))
    (call $gs32 (i32.add (local.get $ctx) (i32.const 0xa8)) (i32.load offset=8 (global.get $reg_base)))
    (call $gs32 (i32.add (local.get $ctx) (i32.const 0xac)) (i32.load offset=4 (global.get $reg_base)))
    (call $gs32 (i32.add (local.get $ctx) (i32.const 0xb0)) (local.get $retval))
    (call $gs32 (i32.add (local.get $ctx) (i32.const 0xb4)) (i32.load offset=20 (global.get $reg_base)))
    (call $gs32 (i32.add (local.get $ctx) (i32.const 0xb8)) (local.get $ret))
    (call $gs32 (i32.add (local.get $ctx) (i32.const 0xbc)) (i32.const 0x1b))
    (call $gs32 (i32.add (local.get $ctx) (i32.const 0xc0)) (call $build_eflags))
    (call $gs32 (i32.add (local.get $ctx) (i32.const 0xc4)) (local.get $esp))
    (call $gs32 (i32.add (local.get $ctx) (i32.const 0xc8)) (i32.const 0x23))
    (call $rtl_unwind_step (local.get $s)))

  ;; Call the current frame's handler, or finish when the walk has reached the
  ;; target (or the end of the chain, or has passed an invalid target).
  (func $rtl_unwind_step (param $s i32)
    (local $cur i32) (local $target i32) (local $handler i32) (local $sp i32)
    (local.set $target (call $gl32 (i32.add (local.get $s) (i32.const 4))))
    (block $finish (loop $walk
      (local.set $cur (call $gl32 (i32.add (local.get $s) (i32.const 20))))
      (br_if $finish (i32.eq (local.get $cur) (local.get $target)))
      (br_if $finish (i32.eq (local.get $cur) (i32.const 0xFFFFFFFF)))
      (br_if $finish (i32.eqz (local.get $cur)))
      ;; Frames are pushed downward: a frame above the target means the target
      ;; is not on the chain. NT raises STATUS_INVALID_UNWIND_TARGET there;
      ;; name it and stop rather than tear down the caller's own frames.
      (if (i32.and (i32.ne (local.get $target) (i32.const 0))
                   (i32.gt_u (local.get $cur) (local.get $target)))
        (then
          (call $host_log_i32 (i32.const 0xCAE8C029))
          (call $host_log_i32 (local.get $target))
          (call $host_log_i32 (local.get $cur))
          (br $finish)))
      (local.set $handler (call $gl32 (i32.add (local.get $cur) (i32.const 4))))
      ;; A dispatcher node would answer "continue search": unlink it uncalled.
      (if (i32.or (i32.eqz (local.get $handler))
                  (i32.eq (local.get $handler) (global.get $seh_node_thunk)))
        (then
          (call $gs32 (global.get $fs_base) (call $gl32 (local.get $cur)))
          (call $gs32 (i32.add (local.get $s) (i32.const 20)) (call $gl32 (local.get $cur)))
          (br $walk)))
      (call $gs32 (local.get $s) (i32.const 0))
      (local.set $sp (i32.sub (local.get $s) (i32.const 20)))
      (call $gs32 (local.get $sp) (global.get $rtl_unwind_thunk))
      (call $gs32 (i32.add (local.get $sp) (i32.const 4)) (call $gl32 (i32.add (local.get $s) (i32.const 24))))
      (call $gs32 (i32.add (local.get $sp) (i32.const 8)) (local.get $cur))
      (call $gs32 (i32.add (local.get $sp) (i32.const 12)) (call $gl32 (i32.add (local.get $s) (i32.const 28))))
      (call $gs32 (i32.add (local.get $sp) (i32.const 16)) (local.get $s))
      (i32.store offset=16 (global.get $reg_base) (local.get $sp))
      (global.set $eip (local.get $handler))
      (global.set $steps (i32.const 0))
      (return)))
    ;; Done: back to RtlUnwind's caller with its registers and stdcall frame popped.
    (i32.store offset=12 (global.get $reg_base) (call $gl32 (i32.add (local.get $s) (i32.const 36))))
    (i32.store offset=24 (global.get $reg_base) (call $gl32 (i32.add (local.get $s) (i32.const 40))))
    (i32.store offset=28 (global.get $reg_base) (call $gl32 (i32.add (local.get $s) (i32.const 44))))
    (i32.store offset=20 (global.get $reg_base) (call $gl32 (i32.add (local.get $s) (i32.const 48))))
    (i32.store offset=0 (global.get $reg_base) (call $gl32 (i32.add (local.get $s) (i32.const 8))))
    (i32.store offset=16 (global.get $reg_base) (call $gl32 (i32.add (local.get $s) (i32.const 16))))
    (global.set $eip (call $gl32 (i32.add (local.get $s) (i32.const 12))))
    (global.set $steps (i32.const 0)))

  ;; 0xCACA0039: an unwind handler returned (cdecl, so ESP is at its four
  ;; arguments and the state block is 16 bytes up). ExceptionCollidedUnwind (3)
  ;; means the handler found a nested unwind already past this point and
  ;; left the frame to resume from in the dispatcher context; any other
  ;; disposition just continues. Either way that frame is unlinked next.
  (func $rtl_unwind_continue
    (local $s i32) (local $cur i32)
    (local.set $s (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    (if (i32.ne (call $gl32 (i32.add (local.get $s) (i32.const 32))) (i32.const 0x444E5755))
      (then
        (call $host_log_i32 (i32.const 0xCAE8C039))
        (call $host_log_i32 (local.get $s))
        (call $seh_terminate_unhandled (i32.const 0xDE39))
        (return)))
    (local.set $cur (call $gl32 (i32.add (local.get $s) (i32.const 20))))
    (if (i32.eq (i32.load offset=0 (global.get $reg_base)) (i32.const 3))
      (then (if (call $gl32 (local.get $s))
        (then (local.set $cur (call $gl32 (local.get $s)))))))
    (call $gs32 (global.get $fs_base) (call $gl32 (local.get $cur)))
    (call $gs32 (i32.add (local.get $s) (i32.const 20)) (call $gl32 (local.get $cur)))
    (call $rtl_unwind_step (local.get $s)))

  (func $seh_walk_from (param $code i32) (param $start i32)
    (local $seh_rec i32) (local $handler i32) (local $frame_ebp i32)
    (local $trylevel i32) (local $scopetable i32) (local $entry i32)
    (local $filter i32) (local $filter_wa i32) (local $except_body i32)
    (local $filter_result i32) (local $first_byte i32)
    ;; Every path out of here that returns has replaced $eip, so claim the
    ;; redirect up front rather than at each of the four exits. $run clears it.
    (global.set $eip_redirected (i32.const 1))
    (local.set $seh_rec (local.get $start))
    (block $unhandled (loop $walk
      ;; End of chain?
      (br_if $unhandled (i32.eq (local.get $seh_rec) (i32.const 0xFFFFFFFF)))
      (br_if $unhandled (i32.eqz (local.get $seh_rec)))
      ;; A dispatcher node (the fault is nested in a running handler): skip it.
      (if (call $seh_is_dispatch_node (local.get $seh_rec))
        (then
          (local.set $seh_rec (call $gl32 (local.get $seh_rec)))
          (br $walk)))
      ;; Handler address
      (local.set $handler (call $gl32 (i32.add (local.get $seh_rec) (i32.const 4))))
      ;; Derive frame EBP: MSVC __SEH_prolog4 installs 5-dword record at EBP-0x10
      ;; (next, handler, scopetable, trylevel, saved_ebp). EBP = seh_rec + 0x10.
      (local.set $frame_ebp (i32.add (local.get $seh_rec) (i32.const 0x10)))
      ;; Check if handler is a C++ __ehhandler stub (starts with 0xB8 = MOV EAX, imm)
      (local.set $first_byte (i32.load8_u (call $g2w (local.get $handler))))
      (if (i32.eq (local.get $first_byte) (i32.const 0xB8))
        (then
          (if (i32.eq (local.get $code) (i32.const 0xe06d7363))
            (then
              ;; C++ exception (throw): parse FuncInfo from __ehhandler stub
              ;; Stub: B8 <FuncInfo*> E9/EB <offset>
              ;; FuncInfo+0: magic, +4: maxState, +8: pUnwindMap, +12: nTryBlocks, +16: pTryBlockMap
              ;; All FuncInfo/TryBlockMap fields live at guest addresses;
              ;; gl32 already does g2w internally, so don't wrap again.
              (local.set $scopetable (call $gl32 (i32.add (local.get $handler) (i32.const 1)))) ;; FuncInfo*
              (local.set $trylevel (call $gl32 (i32.sub (local.get $frame_ebp) (i32.const 4)))) ;; current state
              ;; Read nTryBlocks from FuncInfo+12
              (local.set $filter_result (call $gl32 (i32.add (local.get $scopetable) (i32.const 12))))
              (if (local.get $filter_result) (then
                ;; Read pTryBlockMap from FuncInfo+16
                (local.set $filter (call $gl32 (i32.add (local.get $scopetable) (i32.const 16))))
                ;; Search try blocks for one covering current state
                (local.set $entry (i32.const 0))
                (block $found_catch (loop $try_scan
                  (br_if $found_catch (i32.ge_u (local.get $entry) (local.get $filter_result)))
                  ;; TryBlockMapEntry: +0 tryLow, +4 tryHigh, +8 catchHigh, +12 nCatches, +16 pCatches
                  (local.set $except_body (i32.add (local.get $filter) (i32.mul (local.get $entry) (i32.const 20))))
                  (if (i32.and
                        (i32.ge_s (local.get $trylevel) (call $gl32 (local.get $except_body)))
                        (i32.le_s (local.get $trylevel) (call $gl32 (i32.add (local.get $except_body) (i32.const 4)))))
                    (then
                      ;; Found covering try block. Read first catch handler.
                      ;; HandlerType: +0 adjectives, +4 pType, +8 dispCatchObj, +12 addressOfHandler
                      (local.set $except_body (call $gl32 (i32.add (local.get $except_body) (i32.const 16)))) ;; pCatches
                      (local.set $except_body (call $gl32 (i32.add (local.get $except_body) (i32.const 12)))) ;; handler addr
                      ;; Unwind: FS:[0] = seh_rec->next
                      (call $gs32 (global.get $fs_base) (call $gl32 (local.get $seh_rec)))
                      ;; Restore frame and jump to catch handler
                      (i32.store offset=20 (global.get $reg_base) (local.get $frame_ebp))
                      (i32.store offset=16 (global.get $reg_base) (local.get $seh_rec))
                      ;; Set trylevel to catchHigh
                      (call $gs32 (i32.sub (local.get $frame_ebp) (i32.const 4))
                        (call $gl32 (i32.add (i32.add (local.get $filter) (i32.mul (local.get $entry) (i32.const 20))) (i32.const 8))))
                      (global.set $eip (local.get $except_body))
                      (global.set $steps (i32.const 0))
                      (return)))
                  (local.set $entry (i32.add (local.get $entry) (i32.const 1)))
                  (br $try_scan)))))
              ;; No matching try block in this frame — try next
              (local.set $seh_rec (call $gl32 (local.get $seh_rec)))
              (br $walk)))
          ;; Hardware exception — skip C++ handlers
          (local.set $seh_rec (call $gl32 (local.get $seh_rec)))
          (br $walk)))
      ;; A frame with no MSVC scope table gets its handler called for real.
      (if (i32.eqz (call $seh_frame_is_msvc (local.get $seh_rec)))
        (then
          (call $seh_call_raw_handler (local.get $code) (local.get $seh_rec) (local.get $handler))
          (return)))
      ;; Non-C++ handler: assume __except_handler3 frame layout.
      ;; Read scopetable and trylevel from the stack frame.
      (local.set $scopetable (call $gl32 (i32.sub (local.get $frame_ebp) (i32.const 8))))
      (local.set $trylevel (call $gl32 (i32.sub (local.get $frame_ebp) (i32.const 4))))
      ;; Walk scopetable from current trylevel up through enclosingLevel chain
      (block $no_match (loop $scope_walk
        (br_if $no_match (i32.eq (local.get $trylevel) (i32.const -1)))
        ;; ScopeTableEntry at scopetable + trylevel * 12
        (local.set $entry (i32.add (local.get $scopetable)
          (i32.mul (local.get $trylevel) (i32.const 12))))
        (local.set $filter (call $gl32 (i32.add (local.get $entry) (i32.const 4))))
        (local.set $except_body (call $gl32 (i32.add (local.get $entry) (i32.const 8))))
        (if (i32.ne (local.get $filter) (i32.const 0))
          (then
            ;; Has a filter. Check if it's a trivial "return 1" stub.
            ;; Common pattern: B8 01 00 00 00 C3 (MOV EAX, 1; RET)
            ;; or C2 04 00 variant. Also check for E9/EB jump stubs.
            ;; Read first bytes of filter function.
            (local.set $filter_result (i32.const 0)) (local.set $filter_wa (call $g2w (local.get $filter)))
            (if (i32.and
                  (i32.eq (i32.load8_u (local.get $filter_wa)) (i32.const 0xB8))
                  (i32.eq (i32.load offset=1 (local.get $filter_wa)) (i32.const 1)))
              (then (local.set $filter_result (i32.const 1))))
            ;; Also check: XOR EAX,EAX; INC EAX; RET (33 C0 40 C3) — returns 1
            (if (i32.and
                  (i32.eq (i32.load16_u (local.get $filter_wa)) (i32.const 0xC033))
                  (i32.eq (i32.load8_u offset=2 (local.get $filter_wa)) (i32.const 0x40)))
              (then (local.set $filter_result (i32.const 1))))
            ;; Also check: MOV EAX, 1; RET with C3 at offset 5
            (if (i32.and
                  (i32.eq (local.get $filter_result) (i32.const 1))
                  (i32.or
                    (i32.eq (i32.load8_u offset=5 (local.get $filter_wa)) (i32.const 0xC3))
                    (i32.eq (i32.load8_u offset=3 (local.get $filter_wa)) (i32.const 0xC3))))
              (then
                ;; Filter returns EXCEPTION_EXECUTE_HANDLER (1).
                ;; Unwind: set FS:[0] = seh_rec->next
                (call $gs32 (global.get $fs_base) (call $gl32 (local.get $seh_rec)))
                ;; Restore frame: EBP = frame_ebp, ESP = seh_rec (like RtlUnwind)
                (i32.store offset=20 (global.get $reg_base) (local.get $frame_ebp))
                (i32.store offset=16 (global.get $reg_base) (local.get $seh_rec))
                ;; Update trylevel to enclosingLevel for this scope
                (call $gs32 (i32.sub (local.get $frame_ebp) (i32.const 4))
                  (call $gl32 (local.get $entry))) ;; entry[+0] = enclosingLevel
                ;; Jump to __except block body
                (global.set $eip (local.get $except_body))
                (global.set $steps (i32.const 0))
                (return)))
            ;; Non-trivial filter: call it via guest execution.
            ;; Set up: EBP = frame_ebp, call filter, it returns result in EAX.
            ;; For now, assume non-trivial filters return EXCEPTION_EXECUTE_HANDLER.
            ;; This is a simplification — covers 95% of real-world __except blocks.
            (call $gs32 (global.get $fs_base) (call $gl32 (local.get $seh_rec)))
            (i32.store offset=20 (global.get $reg_base) (local.get $frame_ebp))
            (i32.store offset=16 (global.get $reg_base) (local.get $seh_rec))
            (call $gs32 (i32.sub (local.get $frame_ebp) (i32.const 4))
              (call $gl32 (local.get $entry)))
            (global.set $eip (local.get $except_body))
            (global.set $steps (i32.const 0))
            (return)))
        ;; No filter or filter==0: move to enclosing scope
        (local.set $trylevel (call $gl32 (local.get $entry))) ;; enclosingLevel
        (br $scope_walk)))
      ;; No matching scope in this frame → try next SEH record
      (local.set $seh_rec (call $gl32 (local.get $seh_rec)))
      (br $walk)))
    ;; Unhandled exception: the process ends here.
    (call $seh_terminate_unhandled (i32.or (i32.const 0xDE00) (local.get $code))))
