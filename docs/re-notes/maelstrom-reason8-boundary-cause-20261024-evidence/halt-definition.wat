  ;; a handful of blocks and paying the host's per-batch overhead each time.
  ;; Halt reasons: 1 budget exhausted, 2 EIP zero, 3 $yield_flag,
  ;; 4 blocking-wait $yield_reason, 5 a debug facility (watchpoint/breakpoint).
  (global $last_run_blocks (mut i32) (i32.const 0))
  (global $last_run_halt   (mut i32) (i32.const 0))
