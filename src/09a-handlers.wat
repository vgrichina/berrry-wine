  ;; ============================================================
  ;; WIN32 API HANDLER FUNCTIONS
  ;; Hand-written implementations called from the generated dispatch.
  ;; Each handler receives (arg0..arg4, name_ptr) and must set $eax
  ;; and adjust $esp for stdcall cleanup before returning.
  ;; ============================================================

  ;; =====================================================================
  ;; RECT — the first CLASS-C layout (docs/watx-layout-migration-design.md
  ;; §7, wave 6). Class C is the guest's memory: the address descends from
  ;; $g2w, so these bytes belong to the application, and the offsets below
  ;; are not a choice we get to make.
  ;;
  (; FROZEN: RECT — Win32 ABI, windef.h. Four LONGs, in this order, and the
     guest binary already contains the compiled instructions that read them at
     these offsets. Moving one is not a refactor: it is a wire-format change,
     it traps nowhere, and it misreads every app at once.
     tools/gen-layout-offsets.js --check refuses any movement. ;)
  (layout Rect
    (field left   i32)    ;; +0
    (field top    i32)    ;; +4
    (field right  i32)    ;; +8
    (field bottom i32))   ;; +12  ends at +16 == sizeof(RECT)

  ;; A SECOND layout for the same C structure, deliberately, with the reason
  ;; stated as docs/watx-layout-migration-design.md §7 requires: `PaintRect`
  ;; (src/10-helpers.wat) describes a slot of the emulator's OWN PAINT_SCRATCH
  ;; ring, and that ring is NOT a RECT array. It hands out 16 opaque bytes and
  ;; three of its live slots are something else entirely — a "X, Y" status
  ;; string, a single '>' glyph byte, an address passed straight to $w2g. So
  ;; PaintRect cannot carry the FROZEN marker (its bytes are ours, and a slot
  ;; may legitimately stop being a rect), and `Rect` cannot be merged into it
  ;; (its bytes are Microsoft's, and must never stop being a rect). Same four
  ;; fields, opposite ownership.
  ;;
  ;; WHAT THE $g2w BASE DOES AND DOES NOT PROVE, because this is the finding
  ;; the class-C waves have to carry: `--base-local-from-call=$g2w` proves a
  ;; local holds a GUEST pointer. It does not prove WHICH guest structure,
  ;; because every class-C record in the tree arrives through the same one
  ;; call. Read at +0/+4/+8/+12 off a $g2w'd local, in this file alone:
  ;; $handle_GetSystemDirectoryA's `$dst` (an ANSI path buffer),
  ;; $handle_CoCreateGuid's `$wa` (a GUID) and $handle_GetLogicalDriveStringsW's
  ;; `$buf` (a UTF-16 buffer) are all indistinguishable from a rect to any
  ;; mechanical rule, and all three would convert BYTE-IDENTICALLY. So the
  ;; attribution here is the Win32 SIGNATURE — every converted function takes
  ;; an LPRECT at that argument position per the SDK — and it is spelled as an
  ;; explicit --only-func list in tools/build.sh, not derived.
  ;; =====================================================================

  ;; =====================================================================
  ;; POINT — the second CLASS-C layout, and the same ownership story as RECT
  ;; above: the address comes out of $g2w, the bytes are the application's,
  ;; and the two offsets are Microsoft's.
  ;;
  (; FROZEN: POINT — Win32 ABI, windef.h. Two LONGs, x then y, and the guest
     binary already contains the compiled instructions that read them at these
     offsets. Moving one is a wire-format change: it traps nowhere and
     misreads every app at once.
     tools/gen-layout-offsets.js --check refuses any movement. ;)
  (layout Point
    (field x i32)    ;; +0
    (field y i32))   ;; +4  ends at +8 == sizeof(POINT)

  ;; Emulator-private heap record backing the opaque HHOOK values returned by
  ;; SetWindowsHook[Ex]. Unlike RECT/POINT this is not a guest ABI: USER owns
  ;; every byte and can retire or extend the representation internally.
  (layout HookNode
    (field magic        i32)  ;; +0  "HOK1" while linked
    (field proc         i32)  ;; +4  guest HookProc
    (field next         i32)  ;; +8  older hook in this class
    (field retired_next i32)) ;; +12 deferred-free list

  ;; WHY THIS LAYOUT IS SMALL, and it is a finding about the tree and not
  ;; about POINT: almost every guest POINT in this emulator is touched through
  ;; the $gs32/$gl32 guest accessors, which take a GUEST address and are calls,
  ;; not `i32.load`/`i32.store` on a $g2w'd local. The layout system describes
  ;; the latter, so it cannot see the former at all. $handle_GetCursorPos,
  ;; $handle_GetViewportOrgEx, $handle_SetViewportOrgEx, $handle_GetWindowOrgEx,
  ;; $handle_SetWindowOrgEx, $handle_OffsetViewportOrgEx,
  ;; $handle_OffsetWindowOrgEx, $handle_GetCurrentPositionEx,
  ;; $handle_GetBrushOrgEx, $handle_DPtoLP and $handle_LPtoDP all take an
  ;; LPPOINT by their SDK prototype and are all declined for exactly that
  ;; reason — the access width and kind disagree with the field, not the name.
  ;; $handle_GetCaretPos is declined for a narrower one: its base is an inline
  ;; `(call $g2w …)` per access rather than a local, so there is no base local
  ;; to attribute. None of these is a judgement about whether the pointer is a
  ;; POINT; they all are.
  ;;
  ;; And the same $g2w warning as RECT applies with more force at eight bytes
  ;; than at sixteen. In src/09a7-handlers-dispatch.wat, $handle_GetDCOrgEx
  ;; (an LPPOINT, converted) and $handle_QueryPerformanceCounter (a
  ;; LARGE_INTEGER, NOT converted) sit four lines apart and write +0/+4 off a
  ;; $g2w'd local named `$wa` in the same shape. Both convert byte-identically
  ;; and one of them would be a lie. The --only-func list in tools/build.sh is
  ;; what separates them, and it is a claim about the SDK prototype.
  ;; =====================================================================

  ;; ---- Timer table helpers ----
  ;; Timer table at 0x24C0: 16 entries × 20 bytes
  ;; Each entry: [hwnd:4][id:4][interval:4][last_tick:4][callback:4]
  ;; A zero hwnd/id pair means the slot is empty. Window-owned timers may use
  ;; ID 0 (Tetris does), while thread/callback timers have hwnd=0 and an
  ;; auto-generated nonzero ID.

  ;; $timer_set(hwnd, id, interval_ms, callback) — add or update a timer
  ;;
  ;; Locked for the same reason as the window table: this is a scan-then-claim
  ;; over a table every instance shares, so two threads calling SetTimer at the
  ;; same instant can both settle on the same free slot and one timer never
  ;; fires. The clock read is deliberately OUTSIDE the lock — it is a host
  ;; import, and rule 1 on $lock_acquire is that a section holding a spinlock
  ;; must not make one: in worker mode that call blocks in Atomics.wait for the
  ;; main thread, which may itself be spinning for this lock.
  (func $timer_set (param $hwnd i32) (param $id i32) (param $interval i32) (param $callback i32)
    (local $i i32)
    (local $addr i32)
    (local $free_slot i32)
    (local $owner_tid i32)
    (global.set $tick_count (call $host_get_ticks))
    (local.set $owner_tid (call $wnd_get_thread (local.get $hwnd)))
    (if (i32.eqz (local.get $owner_tid))
      (then (local.set $owner_tid (global.get $current_thread_id))))
    (local.set $free_slot (i32.const -1))
    (local.set $i (i32.const 0))
    (call $lock_wnd_acquire)
    (block $break
      (loop $loop
        (br_if $break (i32.ge_u (local.get $i) (global.get $TIMER_MAX)))
        (local.set $addr (i32.add (global.get $TIMER_TABLE) (i32.mul (local.get $i) (global.get $TIMER_ENTRY_SIZE))))
        ;; Check if this slot matches (same hwnd + id) — update in place.
        ;; Either half may legitimately be zero, so only the zero/zero pair is
        ;; empty.
        (if (i32.and
              (i32.or
                (i32.ne (i32.load (local.get $addr)) (i32.const 0))
                (i32.ne (i32.load (i32.add (local.get $addr) (i32.const 4))) (i32.const 0)))
              (i32.and
                (i32.eq (i32.load (local.get $addr)) (local.get $hwnd))
                (i32.eq (i32.load (i32.add (local.get $addr) (i32.const 4))) (local.get $id))))
          (then
            ;; Existing records follow the same publish protocol as inserts:
            ;; hide the id while rewriting the payload, then publish it last.
            (i32.atomic.store offset=4 (local.get $addr) (i32.const 0))
            (i32.store (i32.add (local.get $addr) (i32.const 8)) (local.get $interval))
            (i32.store (i32.add (local.get $addr) (i32.const 12)) (global.get $tick_count))
            (i32.store (i32.add (local.get $addr) (i32.const 16)) (local.get $callback))
            (i32.store (i32.add (global.get $TIMER_SHARED)
              (i32.add (i32.const 0x10) (i32.mul (local.get $i) (i32.const 4))))
              (local.get $owner_tid))
            (i32.atomic.store offset=4 (local.get $addr) (local.get $id))
            (call $lock_wnd_release)
            (return)
          )
        )
        ;; Track first free slot (only hwnd=0,id=0 is empty).
        (if (i32.and
              (i32.eq (local.get $free_slot) (i32.const -1))
              (i32.and
                (i32.eqz (i32.load (local.get $addr)))
                (i32.eqz (i32.load (i32.add (local.get $addr) (i32.const 4))))))
          (then (local.set $free_slot (local.get $i))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $loop)
      )
    )
    ;; Not found — insert into free slot
    (if (i32.ge_s (local.get $free_slot) (i32.const 0))
      (then
        (local.set $addr (i32.add (global.get $TIMER_TABLE) (i32.mul (local.get $free_slot) (global.get $TIMER_ENTRY_SIZE))))
        (i32.store (local.get $addr) (local.get $hwnd))
        (i32.store (i32.add (local.get $addr) (i32.const 8)) (local.get $interval))
        (i32.store (i32.add (local.get $addr) (i32.const 12)) (global.get $tick_count))
        (i32.store (i32.add (local.get $addr) (i32.const 16)) (local.get $callback))
        (i32.store (i32.add (global.get $TIMER_SHARED)
          (i32.add (i32.const 0x10) (i32.mul (local.get $free_slot) (i32.const 4))))
          (local.get $owner_tid))
        ;; id is the publication word and is written after the complete entry.
        (i32.atomic.store offset=4 (local.get $addr) (local.get $id))
        (drop (i32.atomic.rmw.add (global.get $TIMER_SHARED) (i32.const 1)))
      )
    )
    (call $lock_wnd_release)
  )

  ;; $timer_kill(hwnd, id) — remove a timer, return 1 if found
  ;; Under the same lock as $timer_set: freeing a slot while another thread is
  ;; mid-scan for a free one is how a slot ends up claimed twice.
  (func $timer_kill (param $hwnd i32) (param $id i32) (result i32)
    (local $i i32)
    (local $addr i32)
    (local.set $i (i32.const 0))
    (call $lock_wnd_acquire)
    (block $break
      (loop $loop
        (br_if $break (i32.ge_u (local.get $i) (global.get $TIMER_MAX)))
        (local.set $addr (i32.add (global.get $TIMER_TABLE) (i32.mul (local.get $i) (global.get $TIMER_ENTRY_SIZE))))
        (if (i32.and
              (i32.or
                (i32.ne (i32.load (local.get $addr)) (i32.const 0))
                (i32.ne (i32.load (i32.add (local.get $addr) (i32.const 4))) (i32.const 0)))
              (i32.and
                (i32.eq (i32.load (local.get $addr)) (local.get $hwnd))
                (i32.eq (i32.load (i32.add (local.get $addr) (i32.const 4))) (local.get $id))))
          (then
            ;; Clear both identity fields to mark the slot empty. The id is the
            ;; field another thread's scan tests, so publish that one atomically.
            (i32.atomic.store offset=4 (local.get $addr) (i32.const 0))
            (i32.store (local.get $addr) (i32.const 0))
            (i32.store (i32.add (global.get $TIMER_SHARED)
              (i32.add (i32.const 0x10) (i32.mul (local.get $i) (i32.const 4)))) (i32.const 0))
            (drop (i32.atomic.rmw.sub (global.get $TIMER_SHARED) (i32.const 1)))
            (call $lock_wnd_release)
            (return (i32.const 1))
          )
        )
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $loop)
      )
    )
    (call $lock_wnd_release)
    (i32.const 0)
  )

  ;; Real USER tears down HWND-owned timers when the window is destroyed.
  ;; Without this, timer-driven child pages can keep sending WM_TIMER after
  ;; their HWND has gone away and continue drawing through cached parent DCs.
  (func $timer_kill_hwnd (param $hwnd i32)
    (local $i i32)
    (local $addr i32)
    (local.set $i (i32.const 0))
    (call $lock_wnd_acquire)
    (block $break
      (loop $loop
        (br_if $break (i32.ge_u (local.get $i) (global.get $TIMER_MAX)))
        (local.set $addr (i32.add (global.get $TIMER_TABLE) (i32.mul (local.get $i) (global.get $TIMER_ENTRY_SIZE))))
        (if (i32.and
              (i32.eq (i32.load (local.get $addr)) (local.get $hwnd))
              (i32.or
                (i32.ne (i32.load (local.get $addr)) (i32.const 0))
                (i32.ne (i32.load (i32.add (local.get $addr) (i32.const 4))) (i32.const 0))))
          (then
            (i32.atomic.store offset=4 (local.get $addr) (i32.const 0))
            (i32.store (local.get $addr) (i32.const 0))
            (i32.store (i32.add (global.get $TIMER_SHARED)
              (i32.add (i32.const 0x10) (i32.mul (local.get $i) (i32.const 4)))) (i32.const 0))
            (drop (i32.atomic.rmw.sub (global.get $TIMER_SHARED) (i32.const 1)))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $loop)))
    (call $lock_wnd_release))

  ;; Consume one due multimedia-timer period without moving its phase to the
  ;; late delivery time. A 5ms periodic timer polled at t=6,12,18 otherwise
  ;; becomes a 6ms timer permanently; advancing to the latest 5ms boundary
  ;; keeps future callbacks aligned while still skipping missed callbacks.
  (func $mm_timer_consume_due_tick (param $slot i32)
    (local $periods i32) (local $interval i32)
    (local.set $interval (i32.load offset=4 (local.get $slot)))
    (if (i32.eqz (local.get $interval))
      (then (i32.store offset=16 (local.get $slot) (global.get $tick_count)))
      (else
        (local.set $periods
          (i32.div_u
            (i32.sub (global.get $tick_count) (i32.load offset=16 (local.get $slot)))
            (local.get $interval)))
        (i32.store offset=16 (local.get $slot)
          (i32.add
            (i32.load offset=16 (local.get $slot))
            (i32.mul (local.get $periods) (local.get $interval)))))))

  ;; Address of multimedia-timer slot $i.
  (func $mm_timer_slot (param $i i32) (result i32)
    (i32.add (global.get $MM_TIMER_TABLE)
      (i32.mul (local.get $i) (global.get $MM_TIMER_ENTRY))))

  ;; Slot holding timer id $id, or 0. Id 0 is the free marker, never a timer.
  (func $mm_timer_find (param $id i32) (result i32)
    (local $i i32) (local $slot i32)
    (if (i32.eqz (local.get $id)) (then (return (i32.const 0))))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $MM_TIMER_MAX)))
      (local.set $slot (call $mm_timer_slot (local.get $i)))
      (if (i32.eq (i32.load (local.get $slot)) (local.get $id))
        (then (return (local.get $slot))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  ;; First slot whose period has elapsed, or 0. Refreshes $tick_count, so the
  ;; caller does not have to.
  (func $mm_timer_due_slot (result i32)
    (local $i i32) (local $slot i32)
    (global.set $tick_count (call $host_get_ticks))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $MM_TIMER_MAX)))
      (local.set $slot (call $mm_timer_slot (local.get $i)))
      (if (i32.load (local.get $slot))
        (then
          (if (i32.ge_u
                (i32.sub (global.get $tick_count) (i32.load offset=16 (local.get $slot)))
                (i32.load offset=4 (local.get $slot)))
            (then (return (local.get $slot))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  ;; Charge one period to a due slot, retiring it if it was a one-shot.
  (func $mm_timer_consume_slot (param $slot i32)
    (call $mm_timer_consume_due_tick (local.get $slot))
    (if (i32.load offset=20 (local.get $slot))
      (then (i32.store (local.get $slot) (i32.const 0)))))

  ;; Milliseconds until the earliest multimedia timer is due: 0 when one is
  ;; already due, -1 when there is no timer at all. The host shortens its run
  ;; quantum to this, so a 5ms timer is served at its deadline instead of at
  ;; the end of whatever slice happened to be running.
  (func $mm_timer_ms_until_due (result i32)
    (local $i i32) (local $slot i32) (local $left i32) (local $best i32)
    (local $elapsed i32) (local $interval i32)
    (local.set $best (i32.const -1))
    (global.set $tick_count (call $host_get_ticks))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $MM_TIMER_MAX)))
      (local.set $slot (call $mm_timer_slot (local.get $i)))
      (if (i32.load (local.get $slot))
        (then
          (local.set $elapsed
            (i32.sub (global.get $tick_count) (i32.load offset=16 (local.get $slot))))
          (local.set $interval (i32.load offset=4 (local.get $slot)))
          (local.set $left
            (if (result i32) (i32.ge_u (local.get $elapsed) (local.get $interval))
              (then (i32.const 0))
              (else (i32.sub (local.get $interval) (local.get $elapsed)))))
          (if (i32.or (i32.lt_s (local.get $best) (i32.const 0))
                      (i32.lt_u (local.get $left) (local.get $best)))
            (then (local.set $best (local.get $left))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (local.get $best))

  ;; 1 once the winmm timer thread exists: from then on it alone runs
  ;; timeSetEvent callbacks, and the main-thread paths (the MM_TIMER
  ;; pseudo-message and fire_mm_timer's injection) stand down.
  (func $mm_timer_thread_owned (result i32)
    (i32.ne (i32.atomic.load offset=4 (global.get $MM_TIMER_THREAD)) (i32.const 0)))

  ;; Start the winmm timer thread on the first timeSetEvent when the host chose
  ;; that mode. On Windows the callbacks run on a time-critical thread of
  ;; winmm's own, preempting whatever the application's threads are doing;
  ;; run on the caller's thread they inherit its id, its SEH chain and its
  ;; held critical sections, and only run when that thread pumps or is
  ;; interrupted between slices.
  (func $mm_timer_thread_ensure
    (local $thunk i32) (local $handle i32)
    (if (i32.ne (i32.load (global.get $MM_TIMER_THREAD)) (i32.const 1)) (then (return)))
    (if (call $mm_timer_thread_owned) (then (return)))
    (local.set $thunk (call $com_cont_thunk (i32.const 0xCACA003B)))
    (i32.store offset=8 (global.get $MM_TIMER_THREAD) (local.get $thunk))
    (i32.store offset=12 (global.get $MM_TIMER_THREAD) (i32.const 0))
    ;; host_create_thread(start, param, stack, flags, lpThreadId wasm, creator)
    (local.set $handle (call $host_create_thread
      (local.get $thunk) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)
      (global.get $current_thread_id)))
    (i32.atomic.store offset=4 (global.get $MM_TIMER_THREAD) (local.get $handle)))

  ;; 0xCACA003B: one turn of the winmm timer thread. The thread starts here and
  ;; every callback returns here. Call the first due timer, or sleep until the
  ;; next one is due. The loop ESP is pinned, so a callback declared with the
  ;; wrong convention cannot walk the stack away.
  (func $mm_timer_thread_step
    (local $slot i32) (local $esp i32) (local $thunk i32) (local $wait i32)
    (local $id i32) (local $dwuser i32) (local $cb i32)
    (local.set $thunk (i32.load offset=8 (global.get $MM_TIMER_THREAD)))
    (local.set $esp (i32.load offset=12 (global.get $MM_TIMER_THREAD)))
    (if (i32.eqz (local.get $esp))
      (then
        (local.set $esp (i32.load offset=16 (global.get $reg_base)))
        (i32.store offset=12 (global.get $MM_TIMER_THREAD) (local.get $esp))))
    (i32.store offset=16 (global.get $reg_base) (local.get $esp))
    (global.set $steps (i32.const 0))
    (local.set $slot (call $mm_timer_due_slot))
    (if (local.get $slot)
      (then
        (local.set $id (i32.load (local.get $slot)))
        (local.set $dwuser (i32.load offset=12 (local.get $slot)))
        (local.set $cb (i32.load offset=8 (local.get $slot)))
        (call $mm_timer_consume_slot (local.get $slot))
        ;; TimeProc(uTimerID, uMsg=0, dwUser, dw1=0, dw2=0), stdcall.
        (call $io_apc_push (i32.const 0))
        (call $io_apc_push (i32.const 0))
        (call $io_apc_push (local.get $dwuser))
        (call $io_apc_push (i32.const 0))
        (call $io_apc_push (local.get $id))
        (call $io_apc_push (local.get $thunk))
        (global.set $eip (local.get $cb))
        (return)))
    ;; Nothing due: Sleep until the next deadline, re-entering here. With no
    ;; timer at all the thread idles in 50ms sleeps, as winmm's does.
    (local.set $wait (call $mm_timer_ms_until_due))
    (if (i32.le_s (local.get $wait) (i32.const 0))
      (then (local.set $wait
        (if (result i32) (i32.lt_s (local.get $wait) (i32.const 0))
          (then (i32.const 50)) (else (i32.const 1))))))
    ;; Re-entering the same thunk: opt out of the run loop's auto-pop.
    (global.set $eip (local.get $thunk))
    (global.set $handler_set_eip (i32.const 1))
    (global.set $yield_flag (i32.const 1))
    (global.set $sleep_yielded (i32.const 1))
    (global.set $sleep_timeout (local.get $wait)))

  ;; Consume one due WM_TIMER period at table entry $addr ($elapsed ms since
  ;; its last_tick, already >= the interval) without moving its phase to the
  ;; delivery time; the WM_TIMER twin of $mm_timer_consume_due_tick. A zero
  ;; interval has no phase to keep.
  (func $timer_consume_due_tick (param $addr i32) (param $elapsed i32)
    (local $interval i32)
    (local.set $interval (i32.load offset=8 (local.get $addr)))
    (if (i32.eqz (local.get $interval))
      (then (i32.store offset=12 (local.get $addr) (global.get $tick_count)))
      (else
        (i32.store offset=12 (local.get $addr)
          (i32.add (i32.load offset=12 (local.get $addr))
            (i32.mul (i32.div_u (local.get $elapsed) (local.get $interval))
                     (local.get $interval)))))))

  ;; $timer_check_due(msg_ptr, consume) — scan timer table, fill MSG with first due timer, return 1 if found
  ;; $consume: 1 = update last_tick (PM_REMOVE/GetMessage), 0 = peek only (PM_NOREMOVE)
  (func $timer_check_due (param $msg_ptr i32) (param $consume i32) (result i32)
    (local $i i32)
    (local $addr i32)
    (local $elapsed i32)
    (local $found i32)
    ;; Update tick_count from host real time
    (global.set $tick_count (call $host_get_ticks))
    (local.set $i (i32.const 0))
    (call $lock_wnd_acquire)
    (block $break
      (loop $loop
        (br_if $break (i32.ge_u (local.get $i) (global.get $TIMER_MAX)))
        (local.set $addr (i32.add (global.get $TIMER_TABLE) (i32.mul (local.get $i) (global.get $TIMER_ENTRY_SIZE))))
        ;; Skip the empty zero/zero identity pair, and every slot owned by
        ;; another guest thread: a WM_TIMER is delivered to the thread that set
        ;; the timer. Both halves are normalized to 0/1 before the i32.and —
        ;; the raw id is arbitrary and an even one would clear the low bit.
        (if (i32.and
              (i32.or
                (i32.ne (i32.load (local.get $addr)) (i32.const 0))
                (i32.ne (i32.atomic.load offset=4 (local.get $addr)) (i32.const 0)))
              (i32.eq (i32.load (i32.add (global.get $TIMER_SHARED)
                (i32.add (i32.const 0x10) (i32.mul (local.get $i) (i32.const 4)))))
                (global.get $current_thread_id)))
          (then
            (local.set $elapsed (i32.sub (global.get $tick_count) (i32.load (i32.add (local.get $addr) (i32.const 12)))))
            (if (i32.ge_u (local.get $elapsed) (i32.load (i32.add (local.get $addr) (i32.const 8))))
              (then
                ;; Timer is due — only advance last_tick if consuming. It
                ;; advances by whole intervals, not to the delivery time:
                ;; USER's timer stays on its own period, so a 1000ms timer
                ;; noticed 150ms late is next due 850ms later, not 1000ms.
                ;; Restarting from delivery lost up to 40% of ticks at the
                ;; CLI's 200ms batches (sol16's clock read 13 after 20s).
                ;; Missed periods still coalesce into this one WM_TIMER.
                (if (local.get $consume)
                  (then (call $timer_consume_due_tick (local.get $addr) (local.get $elapsed))))
                (call $gs32 (local.get $msg_ptr) (i32.load (local.get $addr)))                          ;; hwnd
                (call $gs32 (i32.add (local.get $msg_ptr) (i32.const 4)) (i32.const 0x0113))            ;; WM_TIMER
                (call $gs32 (i32.add (local.get $msg_ptr) (i32.const 8)) (i32.load (i32.add (local.get $addr) (i32.const 4))))   ;; wParam=timerID
                (call $gs32 (i32.add (local.get $msg_ptr) (i32.const 12)) (i32.load (i32.add (local.get $addr) (i32.const 16)))) ;; lParam=callback
                ;; MSG.time participates in application-side queue ordering.
                ;; SMAC peeks three disjoint ranges into three MSG structs and
                ;; removes the one with the oldest timestamp. Leaving the tail
                ;; untouched (the caller initializes it to UINT_MAX) makes a
                ;; timer found in the second range lose a three-way tie to the
                ;; empty first struct, so the due timer is never consumed.
                (call $msg_store_input_tail
                  (local.get $msg_ptr)
                  (i32.load (local.get $addr))
                  (i32.const 0x0113)
                  (i32.load (i32.add (local.get $addr) (i32.const 16))))
                (local.set $found (i32.const 1))
                (br $break)
              )
            )
          )
        )
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $loop)
      )
    )
    (call $lock_wnd_release)
    (if (local.get $found) (then (return (i32.const 1))))
    ;; Check multimedia timers (timeSetEvent) -- unless the winmm timer
    ;; thread owns them, in which case no application thread delivers them.
    (if (call $mm_timer_thread_owned) (then (return (i32.const 0))))
    (local.set $addr (call $mm_timer_due_slot))
    (if (local.get $addr)
      (then
        ;; The MSG carries dwUser itself: a one-shot retires the moment it is
        ;; taken, so DispatchMessage can no longer find its slot by timer id.
        (call $gs32 (local.get $msg_ptr) (i32.load offset=12 (local.get $addr)))          ;; hwnd field = dwUser
        (call $gs32 (i32.add (local.get $msg_ptr) (i32.const 4)) (i32.const 0x7FF0))      ;; internal MM_TIMER
        (call $gs32 (i32.add (local.get $msg_ptr) (i32.const 8)) (i32.load (local.get $addr)))  ;; wParam=timerID
        (call $gs32 (i32.add (local.get $msg_ptr) (i32.const 12))
          (i32.load offset=8 (local.get $addr)))                                          ;; lParam=callback
        (call $msg_store_input_tail
          (local.get $msg_ptr)
          (i32.load offset=12 (local.get $addr))
          (i32.const 0x7FF0)
          (i32.load offset=8 (local.get $addr)))
        ;; Retire the one-shot only when the caller is really taking the
        ;; message; a PM_NOREMOVE peek must still see it next time.
        (if (local.get $consume)
          (then (call $mm_timer_consume_slot (local.get $addr))))
        (return (i32.const 1))))
    (i32.const 0)
  )

  ;; Shared cross-instance posted-message queues, one per owning Win32 thread.
  ;; The former implementation was one unlocked count+array at hard-coded
  ;; 0xB400.  Besides allowing two producers to overwrite the same slot, that
  ;; address is inside WND_DLG_RECORDS.  Posting from a worker could therefore
  ;; corrupt a dialog even when the queue race did not fire.
  (func $thread_msg_queue_addr (param $tid i32) (result i32)
    (if (i32.or (i32.lt_u (local.get $tid) (i32.const 1))
                (i32.gt_u (local.get $tid) (i32.const 16)))
      (then (return (i32.const 0))))
    (if (i32.gt_u (local.get $tid) (i32.const 8))
      (then
        (return (i32.add (global.get $THREAD_MSG_QUEUES_HIGH)
          (i32.mul (i32.sub (local.get $tid) (i32.const 9))
            (global.get $THREAD_MSG_QUEUE_STRIDE))))))
    (i32.add (global.get $THREAD_MSG_QUEUES)
      (i32.mul (i32.sub (local.get $tid) (i32.const 1))
        (global.get $THREAD_MSG_QUEUE_STRIDE))))

  (global $THREAD_MSG_INPUT_FLAGS i32 (region.addr $THREAD_MSG_INPUT_FLAGS 0))
  (global $THREAD_MSG_INPUT_FLAGS_SIZE i32 (region.size $THREAD_MSG_INPUT_FLAGS))
  ;; Source metadata is private to USER, not a bit stolen from guest messages.
  ;; One dword per ring slot, 16 queues of 64 slots. Moved under LOCK_WND.
  (global $user_queue_input_flags (mut i32) (i32.const 0))
  ;; Slot flag bits: 1 = hardware input (published as $user_queue_input_flags),
  ;; 2 = produced by WAT menu tracking ($menu_post). The raw word and the
  ;; retrieved hwnd/msg are kept for $shared_post_queue_peek_tid's filter.
  (global $USER_QUEUE_FLAG_INPUT i32 (i32.const 1))
  (global $USER_QUEUE_FLAG_MENU i32 (i32.const 2))
  (global $user_queue_raw_flags (mut i32) (i32.const 0))
  (global $user_queue_raw_hwnd (mut i32) (i32.const 0))
  (global $user_queue_raw_msg (mut i32) (i32.const 0))
  (func $thread_msg_input_flags_addr (param $tid i32) (param $queue i32) (param $slot i32) (result i32)
    (i32.add (global.get $THREAD_MSG_INPUT_FLAGS)
      (i32.add (i32.mul (i32.sub (local.get $tid) (i32.const 1)) (i32.const 256))
        (i32.shr_u (i32.sub (i32.sub (local.get $slot) (local.get $queue)) (i32.const 16)) (i32.const 2)))))

  ;; The ring is the cross-instance fast path. Queue+12 points to a heap-backed
  ;; {head,tail,count} overflow state only while a burst exceeds 64 messages;
  ;; each overflow node is {next,hwnd,msg,wParam,lParam,inputFlags}. Producers allocate
  ;; outside LOCK_WND, whose critical sections may never call a host import.
  (func $shared_post_queue_enqueue (param $hwnd i32) (param $msg i32) (param $wparam i32) (param $lparam i32) (result i32)
    (call $shared_post_queue_enqueue_flags (local.get $hwnd) (local.get $msg)
      (local.get $wparam) (local.get $lparam) (i32.const 0)))
  (func $shared_post_queue_enqueue_flags (param $hwnd i32) (param $msg i32)
    (param $wparam i32) (param $lparam i32) (param $flags i32) (result i32)
    (local $cnt i32) (local $tail i32) (local $slot i32) (local $queue i32) (local $tid i32)
    (local $state i32) (local $state_candidate i32) (local $state_wa i32)
    (local $node i32) (local $node_wa i32)
    (local.set $tid (call $wnd_get_thread (local.get $hwnd)))
    ;; HWND 0 and handles which vanished between routing and enqueue belong to
    ;; the caller's queue.  PostThreadMessage is a separate API.
    (if (i32.eqz (local.get $tid))
      (then (local.set $tid (global.get $current_thread_id))))
    (local.set $queue (call $thread_msg_queue_addr (local.get $tid)))
    (if (i32.eqz (local.get $queue)) (then (return (i32.const 0))))
    (call $lock_wnd_acquire)
    (if (i32.and (i32.ne (local.get $hwnd) (i32.const 0))
          (i32.ne (call $wnd_get_thread (local.get $hwnd)) (local.get $tid)))
      (then
        (call $lock_wnd_release)
        (return (i32.const 0))))
    (local.set $cnt (i32.load (local.get $queue)))
    (local.set $state (i32.load offset=12 (local.get $queue)))
    (if (i32.or (local.get $state)
                (i32.ge_u (local.get $cnt) (global.get $THREAD_MSG_QUEUE_MAX)))
      (then
        (call $lock_wnd_release)
        ;; This is the rare overflow path. Allocate both possible objects before
        ;; reacquiring the process-wide window lock; a racing producer may have
        ;; published the state first, in which case the spare is freed below.
        (local.set $node (call $heap_alloc (i32.const 24)))
        (if (i32.eqz (local.get $node)) (then (return (i32.const 0))))
        (local.set $state_candidate (call $heap_alloc (i32.const 12)))
        (if (i32.eqz (local.get $state_candidate))
          (then
            (call $heap_free (local.get $node))
            (return (i32.const 0))))
        (local.set $state_wa (call $g2w (local.get $state_candidate)))
        (i32.store          (local.get $state_wa) (i32.const 0))
        (i32.store offset=4 (local.get $state_wa) (i32.const 0))
        (i32.store offset=8 (local.get $state_wa) (i32.const 0))
        (local.set $node_wa (call $g2w (local.get $node)))
        (i32.store          (local.get $node_wa) (i32.const 0))
        (i32.store offset=4 (local.get $node_wa) (local.get $hwnd))
        (i32.store offset=8 (local.get $node_wa) (local.get $msg))
        (i32.store offset=12 (local.get $node_wa) (local.get $wparam))
        (i32.store offset=16 (local.get $node_wa) (local.get $lparam))
        (i32.store offset=20 (local.get $node_wa) (local.get $flags))
        (call $lock_wnd_acquire)
        (if (i32.and (i32.ne (local.get $hwnd) (i32.const 0))
              (i32.ne (call $wnd_get_thread (local.get $hwnd)) (local.get $tid)))
          (then
            (call $lock_wnd_release)
            (call $heap_free (local.get $state_candidate))
            (call $heap_free (local.get $node))
            (return (i32.const 0))))
        (local.set $cnt (i32.load (local.get $queue)))
        (local.set $state (i32.load offset=12 (local.get $queue)))
        ;; If the consumer made room and drained the old overflow while this
        ;; producer allocated, return to the ring and discard both spare blocks.
        (if (i32.and (i32.eqz (local.get $state))
                     (i32.lt_u (local.get $cnt) (global.get $THREAD_MSG_QUEUE_MAX)))
          (then
            (local.set $tail (i32.load offset=8 (local.get $queue)))
            (local.set $slot (i32.add (local.get $queue)
              (i32.add (i32.const 0x10) (i32.mul (local.get $tail) (i32.const 16)))))
            (i32.store          (local.get $slot) (local.get $hwnd))
            (i32.store offset=4 (local.get $slot) (local.get $msg))
            (i32.store offset=8 (local.get $slot) (local.get $wparam))
            (i32.store offset=12 (local.get $slot) (local.get $lparam))
            (i32.store (call $thread_msg_input_flags_addr (local.get $tid) (local.get $queue) (local.get $slot)) (local.get $flags))
            (i32.store offset=8 (local.get $queue)
              (i32.rem_u (i32.add (local.get $tail) (i32.const 1))
                (global.get $THREAD_MSG_QUEUE_MAX)))
            (i32.store (local.get $queue) (i32.add (local.get $cnt) (i32.const 1)))
            (call $lock_wnd_release)
            (call $heap_free (local.get $state_candidate))
            (call $heap_free (local.get $node))
            (return (i32.const 1))))
        (if (i32.eqz (local.get $state))
          (then
            (local.set $state (local.get $state_candidate))
            (local.set $state_candidate (i32.const 0))
            (i32.store offset=12 (local.get $queue) (local.get $state))))
        (local.set $state_wa (call $g2w (local.get $state)))
        (local.set $tail (i32.load offset=4 (local.get $state_wa)))
        (if (local.get $tail)
          (then (i32.store (call $g2w (local.get $tail)) (local.get $node)))
          (else (i32.store (local.get $state_wa) (local.get $node))))
        (i32.store offset=4 (local.get $state_wa) (local.get $node))
        (i32.store offset=8 (local.get $state_wa)
          (i32.add (i32.load offset=8 (local.get $state_wa)) (i32.const 1)))
        (call $lock_wnd_release)
        (if (local.get $state_candidate)
          (then (call $heap_free (local.get $state_candidate))))
        (return (i32.const 1))))
    (local.set $tail (i32.load offset=8 (local.get $queue)))
    (local.set $slot (i32.add (local.get $queue)
      (i32.add (i32.const 0x10) (i32.mul (local.get $tail) (i32.const 16)))))
    (i32.store          (local.get $slot) (local.get $hwnd))
    (i32.store offset=4 (local.get $slot) (local.get $msg))
    (i32.store offset=8 (local.get $slot) (local.get $wparam))
    (i32.store offset=12 (local.get $slot) (local.get $lparam))
    (i32.store (call $thread_msg_input_flags_addr (local.get $tid) (local.get $queue) (local.get $slot)) (local.get $flags))
    (i32.store offset=8 (local.get $queue)
      (i32.rem_u (i32.add (local.get $tail) (i32.const 1))
        (global.get $THREAD_MSG_QUEUE_MAX)))
    ;; Count is the publication word and is written after the payload.
    (i32.store (local.get $queue) (i32.add (local.get $cnt) (i32.const 1)))
    (call $lock_wnd_release)
    (i32.const 1)
  )

  ;; A window filter includes child descendants, never owned/reparented
  ;; top-level popups. NULL admits thread messages too; -1 admits only those.
  ;; Pure WND reads: shared queue scans call this while holding LOCK_WND.
  (func $message_hwnd_matches (param $hwnd i32) (param $filter i32) (result i32)
    (if (i32.eqz (local.get $filter)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $filter) (i32.const -1))
      (then (return (i32.eqz (local.get $hwnd)))))
    (if (i32.eq (local.get $hwnd) (local.get $filter)) (then (return (i32.const 1))))
    (call $wnd_is_child (local.get $filter) (local.get $hwnd)))

  (func $shared_post_queue_matches
        (param $hwnd i32) (param $msg i32) (param $hwnd_filter i32)
        (param $msg_min i32) (param $msg_max i32) (result i32)
    (i32.and
      (i32.ne (call $message_hwnd_matches (local.get $hwnd) (local.get $hwnd_filter)) (i32.const 0))
      (i32.or
        (i32.and (i32.eqz (local.get $msg_min)) (i32.eqz (local.get $msg_max)))
        (i32.and
          (i32.ge_u (local.get $msg) (local.get $msg_min))
          (i32.le_u (local.get $msg) (local.get $msg_max))))))

  ;; Scan both the fixed shared ring and its overflow list with PeekMessage's
  ;; filters. Queue mutation stays under LOCK_WND; timestamp/point synthesis
  ;; happens after release because it calls the host clock.
  ;; Windows discards input aimed at a disabled window. Menu tracking here is
  ;; asynchronous to the guest, so its WM_COMMAND/WM_INITMENU* can outlive the
  ;; moment the owner was enabled; a modal loop that disabled the owner must
  ;; not receive them. Walks WS_CHILD parents so an MDI child's system-menu
  ;; command is judged by its frame.
  (func $menu_post_target_disabled (param $hwnd i32) (result i32)
    (local $style i32) (local $depth i32)
    (block $done (loop $walk
      (br_if $done (i32.eqz (local.get $hwnd)))
      (br_if $done (i32.ge_u (local.get $depth) (i32.const 64)))
      (br_if $done (i32.eq (call $wnd_table_find (local.get $hwnd)) (i32.const -1)))
      (local.set $style (call $wnd_get_style (local.get $hwnd)))
      (if (call $ctrl_style_disabled (local.get $style))
        (then (return (i32.const 1))))
      (br_if $done (i32.eqz (i32.and (local.get $style) (i32.const 0x40000000))))
      (local.set $hwnd (call $wnd_get_parent (local.get $hwnd)))
      (local.set $depth (i32.add (local.get $depth) (i32.const 1)))
      (br $walk)))
    (i32.const 0))

  ;; PeekMessage's queue retrieval, minus stale menu output (see above). A
  ;; discarded message is removed even by a PM_NOREMOVE peek, since no later
  ;; retrieval may see it either; the narrow removal filter (its own hwnd and
  ;; msg) cannot match an earlier entry, which would have matched first.
  (func $shared_post_queue_peek_tid
        (param $tid i32) (param $msg_ptr i32) (param $hwnd_filter i32)
        (param $msg_min i32) (param $msg_max i32) (param $remove i32)
        (result i32)
    (loop $retry
      (if (i32.eqz (call $shared_post_queue_peek_tid_raw
            (local.get $tid) (local.get $msg_ptr) (local.get $hwnd_filter)
            (local.get $msg_min) (local.get $msg_max) (local.get $remove)))
        (then (return (i32.const 0))))
      (if (i32.eqz (i32.and (global.get $user_queue_raw_flags)
                            (global.get $USER_QUEUE_FLAG_MENU)))
        (then (return (i32.const 1))))
      (if (i32.eqz (call $menu_post_target_disabled (global.get $user_queue_raw_hwnd)))
        (then (return (i32.const 1))))
      (if (i32.eqz (local.get $remove))
        (then
          (drop (call $shared_post_queue_peek_tid_raw
            (local.get $tid) (i32.const 0) (global.get $user_queue_raw_hwnd)
            (global.get $user_queue_raw_msg) (global.get $user_queue_raw_msg)
            (i32.const 1)))))
      (br $retry))
    (i32.const 0))

  (func $shared_post_queue_peek_tid_raw
        (param $tid i32) (param $msg_ptr i32) (param $hwnd_filter i32)
        (param $msg_min i32) (param $msg_max i32) (param $remove i32)
        (result i32)
    (local $cnt i32) (local $head i32) (local $tail i32) (local $queue i32)
    (local $slot i32) (local $src i32) (local $index i32) (local $j i32)
    (local $found i32) (local $hwnd i32) (local $msg i32)
    (local $wparam i32) (local $lparam i32)
    (local $state i32) (local $state_wa i32)
    (local $node i32) (local $prev i32) (local $node_wa i32) (local $next i32)
    (local $free_node i32) (local $free_state i32)
    (local $flags i32)
    (global.set $user_queue_input_flags (i32.const 0))
    (local.set $queue (call $thread_msg_queue_addr (local.get $tid)))
    (if (i32.eqz (local.get $queue)) (then (return (i32.const 0))))
    ;; Count is the producer's publication word. Avoid taking the process-wide
    ;; window lock for the overwhelmingly common empty poll; a producer racing
    ;; this hint may make this one nonblocking read report empty, then the next
    ;; poll observes it. A nonzero hint still goes through the locked,
    ;; authoritative count below.
    (if (i32.eqz (i32.load (local.get $queue)))
      (then (return (i32.const 0))))
    (call $lock_wnd_acquire)
    (local.set $cnt (i32.load (local.get $queue)))
    (if (i32.eqz (local.get $cnt))
      (then
        (call $lock_wnd_release)
        (return (i32.const 0))))
    (local.set $head (i32.load offset=4 (local.get $queue)))
    ;; Ring entries are logical head..head+count even when their storage wraps.
    (block $ring_done (loop $ring_scan
      (br_if $ring_done (i32.ge_u (local.get $index) (local.get $cnt)))
      (local.set $slot (i32.add (local.get $queue)
        (i32.add (i32.const 0x10)
          (i32.mul
            (i32.rem_u (i32.add (local.get $head) (local.get $index))
              (global.get $THREAD_MSG_QUEUE_MAX))
            (i32.const 16)))))
      (if (call $shared_post_queue_matches
            (i32.load (local.get $slot)) (i32.load offset=4 (local.get $slot))
            (local.get $hwnd_filter) (local.get $msg_min) (local.get $msg_max))
        (then
          (local.set $found (i32.const 1))
          (br $ring_done)))
      (local.set $index (i32.add (local.get $index) (i32.const 1)))
      (br $ring_scan)))
    ;; If the inline prefix has no match, continue through heap overflow in
    ;; exact FIFO order rather than returning/removing the shared head.
    (if (i32.eqz (local.get $found))
      (then
        (local.set $state (i32.load offset=12 (local.get $queue)))
        (if (local.get $state)
          (then
            (local.set $state_wa (call $g2w (local.get $state)))
            (local.set $node (i32.load (local.get $state_wa)))
            (block $overflow_done (loop $overflow_scan
              (br_if $overflow_done (i32.eqz (local.get $node)))
              (local.set $node_wa (call $g2w (local.get $node)))
              (local.set $next (i32.load (local.get $node_wa)))
              (if (call $shared_post_queue_matches
                    (i32.load offset=4 (local.get $node_wa))
                    (i32.load offset=8 (local.get $node_wa))
                    (local.get $hwnd_filter) (local.get $msg_min) (local.get $msg_max))
                (then
                  (local.set $found (i32.const 2))
                  (br $overflow_done)))
              (local.set $prev (local.get $node))
              (local.set $node (local.get $next))
              (br $overflow_scan)))))))
    (if (i32.eqz (local.get $found))
      (then
        (call $lock_wnd_release)
        (return (i32.const 0))))
    (if (i32.eq (local.get $found) (i32.const 1))
      (then
        (local.set $hwnd (i32.load (local.get $slot)))
        (local.set $msg (i32.load offset=4 (local.get $slot)))
        (local.set $wparam (i32.load offset=8 (local.get $slot)))
        (local.set $lparam (i32.load offset=12 (local.get $slot)))
        (local.set $flags (i32.load (call $thread_msg_input_flags_addr (local.get $tid) (local.get $queue) (local.get $slot)))))
      (else
        (local.set $hwnd (i32.load offset=4 (local.get $node_wa)))
        (local.set $msg (i32.load offset=8 (local.get $node_wa)))
        (local.set $wparam (i32.load offset=12 (local.get $node_wa)))
        (local.set $lparam (i32.load offset=16 (local.get $node_wa)))
        (local.set $flags (i32.load offset=20 (local.get $node_wa)))))
    (if (local.get $remove)
      (then
        (if (i32.eq (local.get $found) (i32.const 1))
          (then
            ;; Close the logical gap inside the circular ring.
            (local.set $j (local.get $index))
            (block $shift_done (loop $shift
              (br_if $shift_done
                (i32.ge_u (i32.add (local.get $j) (i32.const 1)) (local.get $cnt)))
              (local.set $slot (i32.add (local.get $queue)
                (i32.add (i32.const 0x10)
                  (i32.mul
                    (i32.rem_u (i32.add (local.get $head) (local.get $j))
                      (global.get $THREAD_MSG_QUEUE_MAX))
                    (i32.const 16)))))
              (local.set $src (i32.add (local.get $queue)
                (i32.add (i32.const 0x10)
                  (i32.mul
                    (i32.rem_u
                      (i32.add (i32.add (local.get $head) (local.get $j)) (i32.const 1))
                      (global.get $THREAD_MSG_QUEUE_MAX))
                    (i32.const 16)))))
              (call $memcpy (local.get $slot) (local.get $src) (i32.const 16))
              (i32.store (call $thread_msg_input_flags_addr (local.get $tid) (local.get $queue) (local.get $slot))
                (i32.load (call $thread_msg_input_flags_addr (local.get $tid) (local.get $queue) (local.get $src))))
              (local.set $j (i32.add (local.get $j) (i32.const 1)))
              (br $shift)))
            (local.set $cnt (i32.sub (local.get $cnt) (i32.const 1)))
            (local.set $tail
              (i32.rem_u
                (i32.add (i32.load offset=8 (local.get $queue))
                  (i32.sub (global.get $THREAD_MSG_QUEUE_MAX) (i32.const 1)))
                (global.get $THREAD_MSG_QUEUE_MAX)))
            (i32.store offset=8 (local.get $queue) (local.get $tail))
            ;; Refill the ring from overflow, preserving the invariant used by
            ;; the lock-free empty hint.
            (local.set $state (i32.load offset=12 (local.get $queue)))
            (if (local.get $state)
              (then
                (local.set $state_wa (call $g2w (local.get $state)))
                (local.set $node (i32.load (local.get $state_wa)))
                (local.set $node_wa (call $g2w (local.get $node)))
                (local.set $next (i32.load (local.get $node_wa)))
                (local.set $slot (i32.add (local.get $queue)
                  (i32.add (i32.const 0x10) (i32.mul (local.get $tail) (i32.const 16)))))
                (i32.store          (local.get $slot) (i32.load offset=4 (local.get $node_wa)))
                (i32.store offset=4 (local.get $slot) (i32.load offset=8 (local.get $node_wa)))
                (i32.store offset=8 (local.get $slot) (i32.load offset=12 (local.get $node_wa)))
                (i32.store offset=12 (local.get $slot) (i32.load offset=16 (local.get $node_wa)))
                (i32.store (call $thread_msg_input_flags_addr (local.get $tid) (local.get $queue) (local.get $slot))
                  (i32.load offset=20 (local.get $node_wa)))
                (i32.store offset=8 (local.get $queue)
                  (i32.rem_u (i32.add (local.get $tail) (i32.const 1))
                    (global.get $THREAD_MSG_QUEUE_MAX)))
                (local.set $cnt (i32.add (local.get $cnt) (i32.const 1)))
                (i32.store (local.get $state_wa) (local.get $next))
                (i32.store offset=8 (local.get $state_wa)
                  (i32.sub (i32.load offset=8 (local.get $state_wa)) (i32.const 1)))
                (local.set $free_node (local.get $node))
                (if (i32.eqz (local.get $next))
                  (then
                    (i32.store offset=4 (local.get $state_wa) (i32.const 0))
                    (i32.store offset=12 (local.get $queue) (i32.const 0))
                    (local.set $free_state (local.get $state))))))
            ;; Count is the publication word and follows every moved payload.
            (i32.store (local.get $queue) (local.get $cnt)))
          (else
            ;; Removing a filtered overflow node never disturbs the ring.
            (if (local.get $prev)
              (then (i32.store (call $g2w (local.get $prev)) (local.get $next)))
              (else (i32.store (local.get $state_wa) (local.get $next))))
            (if (i32.eq (local.get $node) (i32.load offset=4 (local.get $state_wa)))
              (then (i32.store offset=4 (local.get $state_wa) (local.get $prev))))
            (i32.store offset=8 (local.get $state_wa)
              (i32.sub (i32.load offset=8 (local.get $state_wa)) (i32.const 1)))
            (local.set $free_node (local.get $node))
            (if (i32.eqz (local.get $next))
              (then
                (if (i32.eqz (local.get $prev))
                  (then
                    (i32.store offset=12 (local.get $queue) (i32.const 0))
                    (local.set $free_state (local.get $state))))))))))
    (call $lock_wnd_release)
    (if (local.get $free_node) (then (call $heap_free (local.get $free_node))))
    (if (local.get $free_state) (then (call $heap_free (local.get $free_state))))
    (global.set $user_queue_raw_flags (local.get $flags))
    (global.set $user_queue_raw_hwnd (local.get $hwnd))
    (global.set $user_queue_raw_msg (local.get $msg))
    (global.set $user_queue_input_flags
      (i32.and (local.get $flags) (global.get $USER_QUEUE_FLAG_INPUT)))
    ;; A null pointer is an internal USER probe: publish only the four fields
    ;; its caller needs in instance-private globals. Full guest MSG writes also
    ;; synthesize time/pt; they must receive a real 28-byte output buffer.
    (if (local.get $msg_ptr)
      (then
        (call $gs32 (local.get $msg_ptr) (local.get $hwnd))
        (call $gs32 (i32.add (local.get $msg_ptr) (i32.const 4)) (local.get $msg))
        (call $gs32 (i32.add (local.get $msg_ptr) (i32.const 8)) (local.get $wparam))
        (call $gs32 (i32.add (local.get $msg_ptr) (i32.const 12)) (local.get $lparam))
        (call $msg_store_input_tail
          (local.get $msg_ptr) (local.get $hwnd) (local.get $msg) (local.get $lparam)))
      (else
        (global.set $user_queue_probe_hwnd (local.get $hwnd))
        (global.set $user_queue_probe_msg (local.get $msg))
        (global.set $user_queue_probe_wparam (local.get $wparam))
        (global.set $user_queue_probe_lparam (local.get $lparam))))
    (i32.const 1)
  )

  (func $shared_post_queue_peek
        (param $msg_ptr i32) (param $hwnd_filter i32)
        (param $msg_min i32) (param $msg_max i32) (param $remove i32)
        (result i32)
    (call $shared_post_queue_peek_tid
      (global.get $current_thread_id)
      (local.get $msg_ptr) (local.get $hwnd_filter)
      (local.get $msg_min) (local.get $msg_max) (local.get $remove)))

  (func $shared_post_queue_read (param $msg_ptr i32) (param $remove i32) (result i32)
    (call $shared_post_queue_peek
      (local.get $msg_ptr) (i32.const 0) (i32.const 0) (i32.const 0)
      (local.get $remove)))

  ;; Window destruction may run on a thread other than the HWND's owner, and a
  ;; producer may have resolved the owner just before unpublication. Scan every
  ;; canonical queue; the enqueue-side locked recheck plus a post-unpublish
  ;; purge makes that race failure-atomic.
  (func $shared_post_queue_purge_hwnd (param $hwnd i32)
    (local $tid i32)
    (if (i32.eqz (local.get $hwnd)) (then (return)))
    (local.set $tid (i32.const 1))
    (block $done (loop $queues
      (br_if $done (i32.gt_u (local.get $tid) (i32.const 16)))
      (block $queue_done (loop $remove
        (br_if $queue_done
          (i32.eqz (call $shared_post_queue_peek_tid
            (local.get $tid) (i32.const 0) (local.get $hwnd)
            (i32.const 0) (i32.const 0) (i32.const 1))))
        (br $remove)))
      (local.set $tid (i32.add (local.get $tid) (i32.const 1)))
      (br $queues))))

  ;; Locked queue introspection is used by USER wake predicates and the debug
  ;; exports. The 64-entry ring count alone is not the queue depth once a burst
  ;; has reached the heap-backed FIFO.
  (func $shared_post_queue_total_count_tid (param $tid i32) (result i32)
    (local $queue i32) (local $state i32) (local $count i32)
    (local.set $queue (call $thread_msg_queue_addr (local.get $tid)))
    (if (i32.eqz (local.get $queue)) (then (return (i32.const 0))))
    (call $lock_wnd_acquire)
    (local.set $count (i32.load (local.get $queue)))
    (local.set $state (i32.load offset=12 (local.get $queue)))
    (if (local.get $state)
      (then
        (local.set $count (i32.add (local.get $count)
          (i32.load offset=8 (call $g2w (local.get $state)))))))
    (call $lock_wnd_release)
    (local.get $count))

  (func $shared_post_queue_total_count (result i32)
    (call $shared_post_queue_total_count_tid (global.get $current_thread_id)))

  (func $shared_post_queue_peek_field_tid
        (param $tid i32) (param $index i32) (param $field i32) (result i32)
    (local $queue i32) (local $count i32) (local $head i32)
    (local $slot i32) (local $state i32) (local $node i32)
    (local $i i32) (local $value i32)
    (if (i32.ge_u (local.get $field) (i32.const 4))
      (then (return (i32.const 0))))
    (local.set $queue (call $thread_msg_queue_addr (local.get $tid)))
    (if (i32.eqz (local.get $queue)) (then (return (i32.const 0))))
    (call $lock_wnd_acquire)
    (local.set $count (i32.load (local.get $queue)))
    (if (i32.lt_u (local.get $index) (local.get $count))
      (then
        (local.set $head (i32.load offset=4 (local.get $queue)))
        (local.set $slot (i32.add (local.get $queue)
          (i32.add (i32.const 0x10)
            (i32.mul
              (i32.rem_u (i32.add (local.get $head) (local.get $index))
                (global.get $THREAD_MSG_QUEUE_MAX))
              (i32.const 16)))))
        (local.set $value (i32.load (i32.add (local.get $slot)
          (i32.shl (local.get $field) (i32.const 2))))))
      (else
        (local.set $state (i32.load offset=12 (local.get $queue)))
        (if (local.get $state)
          (then
            (local.set $node (i32.load (call $g2w (local.get $state))))
            (local.set $i (local.get $count))
            (block $done (loop $scan
              (br_if $done (i32.eqz (local.get $node)))
              (if (i32.eq (local.get $i) (local.get $index))
                (then
                  (local.set $value (i32.load (i32.add
                    (call $g2w (local.get $node))
                    (i32.add (i32.const 4)
                      (i32.shl (local.get $field) (i32.const 2))))))
                  (br $done)))
              (local.set $node (i32.load (call $g2w (local.get $node))))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $scan)))))))
    (call $lock_wnd_release)
    (local.get $value))

  ;; Detach under USER's process lock, then free after releasing it. Keeping the
  ;; overflow pointers in shared memory means a dead Worker cannot orphan them;
  ;; thread exit and slot reuse can both reclaim the same canonical queue.
  (func $shared_post_queue_reset_tid (param $tid i32)
    (local $queue i32) (local $state i32) (local $state_wa i32)
    (local $node i32) (local $next i32)
    (local.set $queue (call $thread_msg_queue_addr (local.get $tid)))
    (if (i32.eqz (local.get $queue)) (then (return)))
    (call $lock_wnd_acquire)
    (local.set $state (i32.load offset=12 (local.get $queue)))
    (if (local.get $state)
      (then
        (local.set $state_wa (call $g2w (local.get $state)))
        (local.set $node (i32.load (local.get $state_wa)))))
    (i32.store          (local.get $queue) (i32.const 0))
    (i32.store offset=4 (local.get $queue) (i32.const 0))
    (i32.store offset=8 (local.get $queue) (i32.const 0))
    (i32.store offset=12 (local.get $queue) (i32.const 0))
    (call $lock_wnd_release)
    (block $done (loop $free
      (br_if $done (i32.eqz (local.get $node)))
      (local.set $next (i32.load (call $g2w (local.get $node))))
      (call $heap_free (local.get $node))
      (local.set $node (local.get $next))
      (br $free)))
    (if (local.get $state) (then (call $heap_free (local.get $state)))))
