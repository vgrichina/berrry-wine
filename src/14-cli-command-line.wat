  ;; Launch metadata, before any guest initializer. Keep the ordinary CRT argv
  ;; records, but preserve the caller's raw ANSI/Wide spelling and spacing.
  ;; The existing W raw-string area ends at +768; refuse overflow, never trim.
  (func (export "set_raw_command_line") (param $wa i32) (param $len i32) (result i32)
    (local $i i32) (local $ch i32)
    (if (i32.gt_u (local.get $len) (i32.const 383)) (then (return (i32.const 0))))
    (block $checked (loop $check
      (br_if $checked (i32.ge_u (local.get $i) (local.get $len)))
      (local.set $ch (i32.load8_u (i32.add (local.get $wa) (local.get $i))))
      (if (i32.or (i32.eqz (local.get $ch)) (i32.gt_u (local.get $ch) (i32.const 127)))
        (then (return (i32.const 0))))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $check)))
    (if (i32.eqz (global.get $fake_cmdline_addr)) (then (call $store_fake_cmdline)))
    (if (i32.eqz (global.get $msvcrt_wcmdln_ptr)) (then (call $store_fake_wcmdline)))
    (memory.copy (call $g2w (global.get $fake_cmdline_addr)) (local.get $wa) (local.get $len))
    (call $gs8 (i32.add (global.get $fake_cmdline_addr) (local.get $len)) (i32.const 0))
    (local.set $i (i32.const 0))
    (block $done (loop $copy
      (br_if $done (i32.ge_u (local.get $i) (local.get $len)))
      (call $gs16 (i32.add (global.get $msvcrt_wcmdln_ptr) (i32.shl (local.get $i) (i32.const 1)))
        (i32.load8_u (i32.add (local.get $wa) (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $copy)))
    (call $gs16 (i32.add (global.get $msvcrt_wcmdln_ptr) (i32.shl (local.get $len) (i32.const 1))) (i32.const 0))
    (i32.const 1))

