      ;; Yield flag — host needs control (e.g. after WM_TIMER delivery)
      (if (global.get $yield_flag)
        (then
          (global.set $yield_flag (i32.const 0))
          (global.set $last_run_halt (i32.const 3))
          (br $halt)))
      ;; Everything below to the end of this block is a debug facility, and all
      ;; of them are off in a normal run. $dbg_any is the OR of the six arming
      ;; flags, so the common case pays one test instead of six.
      (if (global.get $dbg_any) (then
      ;; Watchpoint: break when watched region (1/2/4 bytes) changes
      (if (global.get $watch_addr)
        (then
          (if (i32.ne (call $watch_load (global.get $watch_addr)) (global.get $watch_val))
            (then
              (global.set $watch_val (call $watch_load (global.get $watch_addr)))
              (global.set $last_run_halt (i32.const 5))
              (br $halt)))))
      ;; EIP breakpoint. On halt we set $bp_skip_once so re-entry (same $eip)
      ;; dispatches the block once before the bp can fire again — without this,
      ;; JS-driven re-arm (e.g. --trace-at) spins halting at the same address.
      (if (i32.eq (global.get $eip) (global.get $bp_addr))
        (then
          ;; Capture caller eip on FIRST hit only (sticky — never overwritten).
          ;; Reading get_bp_first_caller from JS returns the true prev_eip
          ;; from the iteration before bp first matched, even if subsequent
          ;; halts overwrite $dbg_prev_eip with the bp address itself.
          (if (i32.eqz (global.get $bp_first_caller))
            (then (global.set $bp_first_caller (global.get $dbg_prev_eip))))
          (if (global.get $bp_skip_once)
            (then (global.set $bp_skip_once (i32.const 0)))
            (else (global.set $bp_skip_once (i32.const 1))
                  (global.set $last_run_halt (i32.const 5))
                  (br $halt)))))
      ;; EIP hit counters (passive): increment count for any slot whose addr==eip.
      ;; Early-out via $hit_count_n (0 when no --count= flags active).
      (if (global.get $hit_count_n)
        (then
          (local.set $hc_i (i32.const 0))
          (block $hc_done (loop $hc_loop
            (br_if $hc_done (i32.ge_u (local.get $hc_i) (global.get $hit_count_n)))
            (local.set $hc_slot (i32.add (global.get $HIT_COUNT_BASE)
                                         (i32.shl (local.get $hc_i) (i32.const 3))))
            (if (i32.eq (i32.load (local.get $hc_slot)) (global.get $eip))
              (then
                (i32.store offset=4 (local.get $hc_slot)
                  (i32.add (i32.load offset=4 (local.get $hc_slot)) (i32.const 1)))
                (if (i32.eqz (local.get $hc_i))
                  (then
                    (if (i32.eqz (global.get $hit0_first_caller))
                      (then (global.set $hit0_first_caller (global.get $dbg_prev_eip))))
                    (global.set $hit0_last_caller (global.get $dbg_prev_eip))
                    (global.set $hit0_last_ebp (i32.load offset=20 (global.get $reg_base)))
                    ;; The eight GPRs at the latest hit, for a host that has no
                    ;; --trace-at (the page): get_hit0_reg(0..7) = EAX..EDI.
                    (global.set $hit0_r0 (i32.load offset=0 (global.get $reg_base)))
                    (global.set $hit0_r1 (i32.load offset=4 (global.get $reg_base)))
                    (global.set $hit0_r2 (i32.load offset=8 (global.get $reg_base)))
                    (global.set $hit0_r3 (i32.load offset=12 (global.get $reg_base)))
                    (global.set $hit0_r4 (i32.load offset=16 (global.get $reg_base)))
                    (global.set $hit0_r5 (i32.load offset=20 (global.get $reg_base)))
                    (global.set $hit0_r6 (i32.load offset=24 (global.get $reg_base)))
                    (global.set $hit0_r7 (i32.load offset=28 (global.get $reg_base)))
                    (local.set $hc_fp (i32.load offset=20 (global.get $reg_base)))
                    (global.set $hit0_f1 (call $gl32 (i32.add (local.get $hc_fp) (i32.const 4))))
                    (local.set $hc_fp (call $gl32 (local.get $hc_fp)))
                    (global.set $hit0_f2 (call $gl32 (i32.add (local.get $hc_fp) (i32.const 4))))
                    (local.set $hc_fp (call $gl32 (local.get $hc_fp)))
                    (global.set $hit0_f3 (call $gl32 (i32.add (local.get $hc_fp) (i32.const 4))))
                    (local.set $hc_fp (call $gl32 (local.get $hc_fp)))
                    (global.set $hit0_f4 (call $gl32 (i32.add (local.get $hc_fp) (i32.const 4))))))))
            (local.set $hc_i (i32.add (local.get $hc_i) (i32.const 1)))
            (br $hc_loop))))
        )
      ))
      ;; Catch a 16-bit task leaving the selector arena here, before
      ;; $dbg_prev_eip is advanced — at this point it still names the block
      ;; that just ran and produced the bad EIP, which is the only thing that
      ;; identifies the transfer. The decoder makes the same check, but by then
      ;; this assignment has happened and the answer is one step worse.
      (if (global.get $code16)
        (then
          (if (i32.or
                (i32.lt_u (global.get $eip) (call $win16_arena_base))
                (i32.ge_u (global.get $eip)
                  (i32.add (call $win16_arena_base)
                    (i32.mul (global.get $WIN16_SEG_MAX) (i32.const 0x10000)))))
            (then
              (call $host_log_i32 (i32.const 0xCA165E21))
              (call $host_log_i32 (global.get $eip))
              (call $host_log_i32 (global.get $dbg_prev_eip))
              (call $host_log_i32 (global.get $dbg_prev2_eip))
              (call $host_log_i32 (global.get $win16_last_module))
              (call $host_log_i32 (global.get $win16_last_ordinal))
              (call $host_log_i32 (i32.load offset=16 (global.get $reg_base)))
              (unreachable)))))

      ;; Exit if a blocking API yielded. JS owns resuming these waits.
      ;; 16 = render_wait: immutable command already submitted; retry consumes
      ;; its broker token only after the host has observed actual completion.
      (if (i32.eq (global.get $yield_reason) (i32.const 16))
        (then (global.set $last_run_halt (i32.const 4)) (br $halt)))
      (if (i32.eq (global.get $yield_reason) (i32.const 18))
        (then (global.set $last_run_halt (i32.const 4)) (br $halt)))
      (if (i32.or
        (i32.eq (global.get $yield_reason) (i32.const 1))
        (i32.or
          (i32.eq (global.get $yield_reason) (i32.const 5))
          (i32.or
            (i32.eq (global.get $yield_reason) (i32.const 7))
            (i32.or
              (i32.eq (global.get $yield_reason) (i32.const 8))
              (i32.or
                (i32.eq (global.get $yield_reason) (i32.const 9))
                (i32.or
                  (i32.eq (global.get $yield_reason) (i32.const 10))
                  ;; 12 = io_wait: a lazily mounted file needs a chunk the host
                  ;; has not read yet. Same contract as 8/9 — EIP is parked on
                  ;; the thunk, so clearing the yield re-enters the call.
                  (i32.or
                    (i32.eq (global.get $yield_reason) (i32.const 12))
                    ;; 13 = vblank_wait: a DirectDraw call is waiting for the
                    ;; display. Same contract again — the host clears the
                    ;; yield on the next refresh and the call re-tests.
                    (i32.or
                      (i32.eq (global.get $yield_reason) (i32.const 13))
                      ;; 14/15 = a clock or message-queue spin the detectors in
                      ;; src/09a-handlers.wat caught. Same contract once more:
                      ;; the frame is intact and EIP is on the thunk, so the
                      ;; host sleeps to the deadline and the call re-runs. They
                      ;; belong on THIS list rather than the plain yield_flag
                      ;; path so --batch-stats attributes them to "blocking
                      ;; wait" — the batch stopped because the guest is
                      ;; waiting, not because it ran out of budget.
                      (i32.or
                        (i32.eq (global.get $yield_reason) (i32.const 14))
                        (i32.eq (global.get $yield_reason) (i32.const 15)))))))))))
        (then (global.set $last_run_halt (i32.const 4)) (br $halt)))
