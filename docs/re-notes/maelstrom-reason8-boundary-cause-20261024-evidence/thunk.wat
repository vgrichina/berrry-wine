      ;; If EIP landed in thunk zone (e.g. ret-to-thunk for sync message continuation),
      ;; dispatch the thunk directly instead of trying to decode it as x86
      (if (thunk-contains (global.get $eip))
        (then
          (local.set $prev_eip (global.get $eip))
          (local.set $prev_esp (i32.load offset=16 (global.get $reg_base)))
          (global.set $current_thunk_eip (global.get $eip))
          (global.set $handler_set_eip (i32.const 0))
          (call $win32_dispatch (i32.div_u
            (i32.sub (global.get $eip) (global.get $thunk_guest_base)) (i32.const 8)))
          ;; If handler didn't redirect EIP, pop the saved return address.
          ;; Normal API handlers do `esp += 4 + nargs*4` but never set EIP;
          ;; without this, re-entry to the same thunk loops forever and
          ;; bleeds ESP by the handler's pop each pass. Continuation thunks
          ;; (CACA*) that deliberately re-enter by setting EIP to the same
          ;; thunk addr raise $handler_set_eip to opt out of the auto-pop.
          (if (i32.and
                (i32.eq (global.get $eip) (local.get $prev_eip))
                (i32.eqz (global.get $handler_set_eip)))
            (then (global.set $eip (call $gl32 (local.get $prev_esp)))))
          (br $main)))
      ;; A wndproc marker (0xFFFE____/0xFFFF____) called directly as code.
      (if (i32.ge_u (global.get $eip) (i32.const 0xFFFE0000))
