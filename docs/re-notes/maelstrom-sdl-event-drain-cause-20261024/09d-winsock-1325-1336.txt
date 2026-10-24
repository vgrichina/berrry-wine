  (func $vsock_block (param $unpop i32)
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (local.get $unpop)))
    (global.set $handler_set_eip (i32.const 1))
    ;; And re-enter the CALL rather than the block that made it: an API call
    ;; dispatched inline from inside a decoded block leaves EIP naming that
    ;; block's first instruction, so a park that does not set EIP resumes by
    ;; re-executing the argument pushes. See the same line in $cs_block, where
    ;; that cost 8 bytes of stack per park and a wild jump much later.
    (global.set $eip (global.get $current_thunk_eip))
    (global.set $yield_reason (i32.const 8))
    (global.set $yield_flag (i32.const 1))
    (global.set $steps (i32.const 0)))
