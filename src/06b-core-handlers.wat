  ;; ============================================================
  ;; NON-FPU THREADED HANDLERS
  ;; Flag ops, LEAVE, BSWAP, XCHG, IMUL, the 16-bit ALU/MOV family, and every
  ;; memory-form (_ro) handler: EA computation, ALU, TEST, shifts, indirect
  ;; call/jmp, push/pop, movzx/movsx, mul/div.
  ;; 
  ;; These lived in 06-fpu.wat, which is named for the x87 unit and ends at
  ;; $th_fpu_mem_ro. Nothing here is FPU.
  ;; ============================================================

  (func $th_cld (param $op i32) (local $nx_fn i32) (local $nx_op i32) (global.set $df (i32.const 0)) (dispatch-next))
  (func $th_std (param $op i32) (local $nx_fn i32) (local $nx_op i32) (global.set $df (i32.const 1)) (dispatch-next))
  (func $th_clc (param $op i32)
     (local $nx_fn i32) (local $nx_op i32);; CLC/STC/CMC modify CF only. Materialize the other lazy arithmetic flags
    ;; before changing that bit, then restore the complete flag word in raw
    ;; mode. Replacing the lazy operation here also replaced ZF/SF/OF/PF: in
    ;; particular, DOSBox emits `cmp; stc; pushfd; jz` and relies on STC leaving
    ;; the comparison's ZF intact.
    (call $load_eflags (i32.and (call $build_eflags) (i32.const 0xFFFFFFFE)))
    (dispatch-next))
  (func $th_stc (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (call $load_eflags (i32.or (call $build_eflags) (i32.const 1)))
    (dispatch-next))
  (func $th_cmc (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (call $load_eflags (i32.xor (call $build_eflags) (i32.const 1)))
    (dispatch-next))
  (func $th_leave (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (i32.store offset=16 (global.get $reg_base) (i32.load offset=20 (global.get $reg_base)))
    (i32.store offset=20 (global.get $reg_base) (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))) (dispatch-next))
  ;; 399: ENTER imm16,0 — the ordinary 32-bit compiler frame prologue.
  ;; Non-zero nesting levels are rejected by the decoder.
  (func $th_enter (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.load offset=20 (global.get $reg_base)))
    (i32.store offset=20 (global.get $reg_base) (i32.load offset=16 (global.get $reg_base)))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.and (local.get $op) (i32.const 0xFFFF))))
    (dispatch-next))
  (func $th_nop2 (param $op i32) (local $nx_fn i32) (local $nx_op i32) (dispatch-next))
  (func $th_bswap (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $v i32) (local.set $v (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $op) (i32.const 2)))))
    (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $op) (i32.const 2))) (i32.or (i32.or
        (i32.shl (i32.and (local.get $v) (i32.const 0xFF)) (i32.const 24))
        (i32.shl (i32.and (i32.shr_u (local.get $v) (i32.const 8)) (i32.const 0xFF)) (i32.const 16)))
        (i32.or
          (i32.shl (i32.and (i32.shr_u (local.get $v) (i32.const 16)) (i32.const 0xFF)) (i32.const 8))
          (i32.shr_u (local.get $v) (i32.const 24)))))
    (dispatch-next))
  (func $th_xchg_eax_r (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $tmp i32) (local.set $tmp (i32.load offset=0 (global.get $reg_base)))
    (i32.store offset=0 (global.get $reg_base) (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $op) (i32.const 2)))))
    (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $op) (i32.const 2))) (local.get $tmp)) (dispatch-next))
  (func $th_thunk_call (param $op i32)
    (call $win32_dispatch (local.get $op)))
  (func $th_imul_r_r (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $d i32) (local $full i64) (local $low i32)
    (local.set $d (i32.shr_u (local.get $op) (i32.const 4)))
    (local.set $full (i64.mul
      (i64.extend_i32_s (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $d) (i32.const 2)))))
      (i64.extend_i32_s (i32.load (i32.add (global.get $reg_base) (i32.shl (i32.and (local.get $op) (i32.const 0xF)) (i32.const 2)))))))
    (local.set $low (i32.wrap_i64 (local.get $full)))
    (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $d) (i32.const 2))) (local.get $low))
    (global.set $flag_op (i32.const 6))
    (global.set $flag_sign_shift (i32.const 31))
    (global.set $flag_b (i64.ne (local.get $full) (i64.extend_i32_s (local.get $low))))
    (global.set $flag_res (local.get $low))
    (dispatch-next))
  ;; 157: imul reg, [base+disp] — 2-operand imul with memory source (simple base)
  (func $th_imul_r_m_ro (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $addr i32) (local $dst i32) (local $full i64) (local $low i32)
    (local.set $addr (call $ea_from_op (local.get $op)))
    (local.set $dst (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
    (local.set $full (i64.mul
      (i64.extend_i32_s (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $dst) (i32.const 2)))))
      (i64.extend_i32_s (call $gl32 (local.get $addr)))))
    (local.set $low (i32.wrap_i64 (local.get $full)))
    (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $dst) (i32.const 2))) (local.get $low))
    (global.set $flag_op (i32.const 6))
    (global.set $flag_sign_shift (i32.const 31))
    (global.set $flag_b (i64.ne (local.get $full) (i64.extend_i32_s (local.get $low))))
    (global.set $flag_res (local.get $low))
    (dispatch-next))
  ;; 158: imul reg, [addr] — 2-operand imul with memory source (absolute/SIB)
  (func $th_imul_r_m_abs (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $addr i32) (local $full i64) (local $low i32)
    (local.set $addr (call $read_addr))
    (local.set $full (i64.mul
      (i64.extend_i32_s (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $op) (i32.const 2)))))
      (i64.extend_i32_s (call $gl32 (local.get $addr)))))
    (local.set $low (i32.wrap_i64 (local.get $full)))
    (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $op) (i32.const 2))) (local.get $low))
    (global.set $flag_op (i32.const 6))
    (global.set $flag_sign_shift (i32.const 31))
    (global.set $flag_b (i64.ne (local.get $full) (i64.extend_i32_s (local.get $low))))
    (global.set $flag_res (local.get $low))
    (dispatch-next))
  ;; 159: r16 OP= [addr] (op=alu_op<<4|reg, addr in next word)
  (func $th_alu_r16_m16 (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $addr i32) (local $reg i32) (local $alu i32) (local $val i32)
    (local.set $addr (call $read_addr))
    (local.set $reg (i32.and (local.get $op) (i32.const 0xF)))
    (local.set $alu (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0x7)))
    (local.set $val (call $do_alu_sized (local.get $alu) (i32.and (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $reg) (i32.const 2)))) (i32.const 0xFFFF)) (call $gl16 (local.get $addr)) (i32.const 0xFFFF) (i32.const 15)))
    (if (i32.ne (local.get $alu) (i32.const 7))
      (then (i32.store16 (i32.add (global.get $reg_base) (i32.shl (local.get $reg) (i32.const 2))) (local.get $val))))
    (dispatch-next))
  ;; 160: [addr] OP= r16 (op=alu_op<<4|reg, addr in next word)
  (func $th_alu_m16_r16 (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $addr i32) (local $reg i32) (local $alu i32) (local $val i32)
    (local.set $addr (call $read_addr))
    (local.set $reg (i32.and (local.get $op) (i32.const 0xF)))
    (local.set $alu (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0x7)))
    (local.set $val (call $do_alu_sized (local.get $alu) (call $gl16 (local.get $addr)) (i32.and (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $reg) (i32.const 2)))) (i32.const 0xFFFF)) (i32.const 0xFFFF) (i32.const 15)))
    (if (i32.ne (local.get $alu) (i32.const 7))
      (then (call $gs16 (local.get $addr) (local.get $val))))
    (dispatch-next))
  ;; 161: r16 OP= [base+disp] (op=alu_op<<8|reg<<4|base, disp in word)
  (func $th_alu_r16_m16_ro (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $addr i32) (local $reg i32) (local $alu i32) (local $val i32)
    (local.set $addr (call $ea_from_op (local.get $op)))
    (local.set $reg (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
    (local.set $alu (i32.and (i32.shr_u (local.get $op) (i32.const 8)) (i32.const 0x7)))
    (local.set $val (call $do_alu_sized (local.get $alu) (i32.and (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $reg) (i32.const 2)))) (i32.const 0xFFFF)) (call $gl16 (local.get $addr)) (i32.const 0xFFFF) (i32.const 15)))
    (if (i32.ne (local.get $alu) (i32.const 7))
      (then (i32.store16 (i32.add (global.get $reg_base) (i32.shl (local.get $reg) (i32.const 2))) (local.get $val))))
    (dispatch-next))
  ;; 162: [base+disp] OP= r16 (op=alu_op<<8|reg<<4|base, disp in word)
  (func $th_alu_m16_r16_ro (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $addr i32) (local $reg i32) (local $alu i32) (local $val i32)
    (local.set $addr (call $ea_from_op (local.get $op)))
    (local.set $reg (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
    (local.set $alu (i32.and (i32.shr_u (local.get $op) (i32.const 8)) (i32.const 0x7)))
    (local.set $val (call $do_alu_sized (local.get $alu) (call $gl16 (local.get $addr)) (i32.and (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $reg) (i32.const 2)))) (i32.const 0xFFFF)) (i32.const 0xFFFF) (i32.const 15)))
    (if (i32.ne (local.get $alu) (i32.const 7))
      (then (call $gs16 (local.get $addr) (local.get $val))))
    (dispatch-next))
  ;; 163: mov [addr], r16 (op=reg, addr in next word)
  (func $th_mov_m16_r16 (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (call $gs16 (call $read_addr) (i32.and (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $op) (i32.const 2)))) (i32.const 0xFFFF)))
    (dispatch-next))
  ;; 164: mov r16, [addr] (op=reg, addr in next word)
  (func $th_mov_r16_m16 (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $val i32) (local.set $val (call $gl16 (call $read_addr)))
    (i32.store16 (i32.add (global.get $reg_base) (i32.shl (local.get $op) (i32.const 2))) (local.get $val))
    (dispatch-next))
  ;; 165: mov [base+disp], r16 (op=reg<<4|base, disp in word)
  (func $th_mov_m16_r16_ro (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $addr i32) (local $reg i32)
    (local.set $addr (call $ea_from_op (local.get $op)))
    (local.set $reg (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
    (call $gs16 (local.get $addr) (i32.and (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $reg) (i32.const 2)))) (i32.const 0xFFFF)))
    (dispatch-next))
  ;; 166: mov r16, [base+disp] (op=reg<<4|base, disp in word)
  (func $th_mov_r16_m16_ro (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $addr i32) (local $dst i32) (local $val i32)
    (local.set $addr (call $ea_from_op (local.get $op)))
    (local.set $dst (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
    (local.set $val (call $gl16 (local.get $addr)))
    (i32.store16 (i32.add (global.get $reg_base) (i32.shl (local.get $dst) (i32.const 2))) (local.get $val))
    (dispatch-next))
  ;; 167: mov [addr], imm16 (op=0, addr+imm in words)
  (func $th_mov_m16_i16 (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $addr i32)
    (local.set $addr (call $read_addr))
    (call $gs16 (local.get $addr) (read-thread-word))
    (dispatch-next))
  ;; 168: mov [base+disp], imm16 (op=base, disp+imm in words)
  (func $th_mov_m16_i16_ro (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $addr i32)
    (local.set $addr (i32.add (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $op) (i32.const 2)))) (read-thread-word)))
    (call $gs16 (local.get $addr) (read-thread-word))
    (dispatch-next))
  (func $th_call_r (param $op i32)
    (local $reg i32) (local $target i32)
    (local.set $reg (read-thread-word))
    (local.set $target (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $reg) (i32.const 2)))))
    ;; Check thunk zone (guest-space bounds)
    (if (thunk-contains (local.get $target))
      (then
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $op))
        (call $win32_dispatch (i32.div_u (i32.sub (local.get $target) (global.get $thunk_guest_base)) (i32.const 8)))
        (if (global.get $steps) (then (global.set $eip (local.get $op))))
        (return)))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $op))
    (global.set $eip (local.get $target)))
  (func $th_jmp_r (param $op i32)
    (local $target i32) (local $ret_addr i32)
    (local.set $target (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $op) (i32.const 2)))))
    ;; Check thunk zone — JMP reg, return addr already on stack from prior CALL
    (if (thunk-contains (local.get $target))
      (then
        (local.set $ret_addr (call $gl32 (i32.load offset=16 (global.get $reg_base))))
        (call $win32_dispatch (i32.div_u (i32.sub (local.get $target) (global.get $thunk_guest_base)) (i32.const 8)))
        (if (global.get $steps) (then (global.set $eip (local.get $ret_addr))))
        (return)))
    (global.set $eip (local.get $target)))
  (func $th_push_m32 (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (call $gl32 (call $read_addr))) (dispatch-next))
  (func $th_pop_m32 (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $addr i32)
    (local.set $addr (call $read_addr))
    (call $gs32 (local.get $addr) (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))) (dispatch-next))
  (func $th_alu_m16_i16 (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $addr i32) (local $imm i32) (local $val i32)
    ;; The immediate is masked to sixteen bits like the memory operand: a
    ;; sign-extended imm8 arrives as 0xFFFFFFxx and would compare unsigned
    ;; against a 16-bit value as though it were enormous. See $th_alu_r16_i16.
    (local.set $addr (call $read_addr))
    (local.set $imm (i32.and (read-thread-word) (i32.const 0xFFFF)))
    (local.set $val (call $do_alu_sized (local.get $op) (call $gl16 (local.get $addr)) (local.get $imm) (i32.const 0xFFFF) (i32.const 15)))
    (if (i32.ne (local.get $op) (i32.const 7)) (then (call $gs16 (local.get $addr) (local.get $val))))
    (dispatch-next))
  (func $th_load8s (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $v i32) (local.set $v (call $gl8 (call $read_addr)))
    (if (i32.ge_u (local.get $v) (i32.const 0x80))
      (then (local.set $v (i32.or (local.get $v) (i32.const 0xFFFFFF00)))))
    (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $op) (i32.const 2))) (local.get $v)) (dispatch-next))
  (func $th_test_m8_i8 (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (call $set_flags_logic (i32.and (call $gl8 (call $read_addr)) (local.get $op)))
    (global.set $flag_sign_shift (i32.const 7)) (dispatch-next))

  ;; 125: jmp [mem] — for jmp through IAT or vtable
  ;; operand=ignored, mem_addr in next thread word
  (func $th_jmp_ind (param $op i32)
    (local $mem_addr i32) (local $target i32) (local $ret_addr i32)
    (local.set $mem_addr (call $read_addr))
    (local.set $target (call $gl32 (local.get $mem_addr)))
    ;; Check thunk zone (guest-space bounds) — JMP, not CALL. Return addr already on stack.
    (if (thunk-contains (local.get $target))
      (then
        (local.set $ret_addr (call $gl32 (i32.load offset=16 (global.get $reg_base))))
        (call $win32_dispatch (i32.div_u (i32.sub (local.get $target) (global.get $thunk_guest_base)) (i32.const 8)))
        (if (global.get $steps) (then (global.set $eip (local.get $ret_addr))))
        (return)))
    ;; Not a thunk — regular indirect jump
    (global.set $eip (local.get $target)))

  ;; --- Runtime EA handlers (compute address from base_reg + disp at execution time) ---

  ;; 126: LEA dst, [base+disp]. operand=dst<<4|base, disp in next word.
  (func $th_lea_ro (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (i32.store (i32.add (global.get $reg_base) (i32.shl (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 2))) (i32.add (i32.load (i32.add (global.get $reg_base) (i32.shl (i32.and (local.get $op) (i32.const 0xF)) (i32.const 2)))) (read-thread-word)))
    (dispatch-next))

  ;; 148: LEA dst, [base+index*scale+disp]. op=dst. Words: base|index<<4|scale<<8, disp.
  (func $th_lea_sib (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $info i32) (local $base_val i32) (local $index_val i32) (local $scale i32) (local $disp i32)
    (local.set $info (read-thread-word))
    (local.set $disp (read-thread-word))
    ;; base: low 4 bits (0xF = no base)
    (if (i32.ne (i32.and (local.get $info) (i32.const 0xF)) (i32.const 0xF))
      (then (local.set $base_val (i32.load (i32.add (global.get $reg_base) (i32.shl (i32.and (local.get $info) (i32.const 0xF)) (i32.const 2)))))))
    ;; index: bits 4-7 (0xF = no index)
    (if (i32.ne (i32.and (i32.shr_u (local.get $info) (i32.const 4)) (i32.const 0xF)) (i32.const 0xF))
      (then
        (local.set $scale (i32.and (i32.shr_u (local.get $info) (i32.const 8)) (i32.const 3)))
        (local.set $index_val (i32.shl
          (i32.load (i32.add (global.get $reg_base) (i32.shl (i32.and (i32.shr_u (local.get $info) (i32.const 4)) (i32.const 0xF)) (i32.const 2))))
          (local.get $scale)))))
    (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $op) (i32.const 2))) (i32.add (i32.add (local.get $base_val) (local.get $index_val)) (local.get $disp)))
    (dispatch-next))

  ;; 149: compute SIB EA → ea_temp, then continue to next handler.
  ;; op bit 8 fuses the overwhelmingly common SIB byte-load consumer; low
  ;; three bits are the destination byte register. Keeping this in the EA
  ;; handler preserves the generic SIB encoding while avoiding a second
  ;; indirect threaded dispatch and the sentinel word it used to consume.
  (func $th_compute_ea_sib (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $info i32) (local $base_val i32) (local $index_val i32) (local $scale i32) (local $disp i32)
    (local.set $info (read-thread-word))
    (local.set $disp (read-thread-word))
    (if (global.get $handler_hist_enabled)
      (then
        (if (i32.and (local.get $op) (i32.const 0x100))
          (then
            ;; Report the semantic consumer so profiles before and after the
            ;; fusion remain directly comparable.
            (call $sib_consumer_hist_record
              (i32.const 24)
              (i32.and (local.get $op) (i32.const 7))
              (local.get $info)))
          (else
            (call $sib_consumer_hist_record
              (i32.load (global.get $ip))
              (i32.load offset=4 (global.get $ip))
              (local.get $info))))))
    (if (i32.ne (i32.and (local.get $info) (i32.const 0xF)) (i32.const 0xF))
      (then (local.set $base_val (i32.load (i32.add (global.get $reg_base) (i32.shl (i32.and (local.get $info) (i32.const 0xF)) (i32.const 2)))))))
    (if (i32.ne (i32.and (i32.shr_u (local.get $info) (i32.const 4)) (i32.const 0xF)) (i32.const 0xF))
      (then
        (local.set $scale (i32.and (i32.shr_u (local.get $info) (i32.const 8)) (i32.const 3)))
        (local.set $index_val (i32.shl
          (i32.load (i32.add (global.get $reg_base) (i32.shl (i32.and (i32.shr_u (local.get $info) (i32.const 4)) (i32.const 0xF)) (i32.const 2))))
          (local.get $scale)))))
    (global.set $ea_temp (i32.add (i32.add (local.get $base_val) (local.get $index_val)) (local.get $disp)))
    (if (i32.and (local.get $op) (i32.const 0x100))
      (then
        (call $set_reg8
          (i32.and (local.get $op) (i32.const 7))
          (call $gl8 (global.get $ea_temp)))))
    (dispatch-next))

  ;; 465: [base+index*scale+disp] OP= r8 -- handler 149's EA and handler 49's
  ;; ALU in one dispatch. op = alu<<4 | reg8; info and disp words follow, in
  ;; 149's encoding. PKWARE implode's `cmp [ebp+esi],bl` is the case.
  (func $th_alu_m8_r_sib (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $info i32) (local $base_val i32) (local $index_val i32) (local $disp i32)
    (local $addr i32) (local $alu i32) (local $r i32)
    (local.set $info (read-thread-word))
    (local.set $disp (read-thread-word))
    (if (i32.ne (i32.and (local.get $info) (i32.const 0xF)) (i32.const 0xF))
      (then (local.set $base_val (i32.load (i32.add (global.get $reg_base) (i32.shl (i32.and (local.get $info) (i32.const 0xF)) (i32.const 2)))))))
    (if (i32.ne (i32.and (i32.shr_u (local.get $info) (i32.const 4)) (i32.const 0xF)) (i32.const 0xF))
      (then
        (local.set $index_val (i32.shl
          (i32.load (i32.add (global.get $reg_base) (i32.shl (i32.and (i32.shr_u (local.get $info) (i32.const 4)) (i32.const 0xF)) (i32.const 2))))
          (i32.and (i32.shr_u (local.get $info) (i32.const 8)) (i32.const 3))))))
    (local.set $addr (i32.add (i32.add (local.get $base_val) (local.get $index_val)) (local.get $disp)))
    (local.set $alu (i32.shr_u (local.get $op) (i32.const 4)))
    (local.set $r (call $do_alu_sized (local.get $alu)
      (call $gl8 (local.get $addr))
      (call $get_reg8 (i32.and (local.get $op) (i32.const 0xF)))
      (i32.const 0xFF) (i32.const 7)))
    (if (i32.ne (local.get $alu) (i32.const 7)) (then (call $gs8 (local.get $addr) (local.get $r))))
    (dispatch-next))

  ;; 389: MOV r32,[base+index*scale+disp]. This is deliberately separate from
  ;; handler 149: StarCraft's generated Smacker converter executes indexed
  ;; dword loads millions of times, while adding another mode branch to the
  ;; generic SIB handler slows every other SIB operation.
  (func $th_load32_sib (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $info i32) (local $base_val i32) (local $index_val i32) (local $scale i32) (local $disp i32)
    (local.set $info (read-thread-word))
    (local.set $disp (read-thread-word))
    (if (i32.ne (i32.and (local.get $info) (i32.const 0xF)) (i32.const 0xF))
      (then (local.set $base_val (i32.load (i32.add (global.get $reg_base) (i32.shl (i32.and (local.get $info) (i32.const 0xF)) (i32.const 2)))))))
    (if (i32.ne (i32.and (i32.shr_u (local.get $info) (i32.const 4)) (i32.const 0xF)) (i32.const 0xF))
      (then
        (local.set $scale (i32.and (i32.shr_u (local.get $info) (i32.const 8)) (i32.const 3)))
        (local.set $index_val (i32.shl
          (i32.load (i32.add (global.get $reg_base) (i32.shl (i32.and (i32.shr_u (local.get $info) (i32.const 4)) (i32.const 0xF)) (i32.const 2))))
          (local.get $scale)))))
    (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $op) (i32.const 2))) (call $gl32 (i32.add (i32.add (local.get $base_val) (local.get $index_val)) (local.get $disp))))
    (dispatch-next))

  ;; 400/401/402: the other three dominant SIB consumers, fused the same way
  ;; 389 fuses the dword load. Heroes II's ICN sprite blitter is the case that
  ;; forced these: a --handler-hist run of its adventure map attributes 37.7%
  ;; of every SIB EA computed to MOVSX r32, byte [eax+ecx], 24.3% to a byte
  ;; store through [ecx*4+disp] and 8.1% to a byte-immediate store, so three
  ;; quarters of the generic handler-149 traffic in that loop was paying for a
  ;; second threaded dispatch and a SIB_SENTINEL word per pixel.
  ;;
  ;; Each keeps the 149 encoding — info word then disp word — so the decoder
  ;; change is only which opcode it emits, and reports its semantic consumer to
  ;; the SIB histogram so profiles stay comparable across the fusion.
  (func $sib_ea (param $info i32) (param $disp i32) (result i32)
    (local $addr i32)
    (local.set $addr (local.get $disp))
    (if (i32.ne (i32.and (local.get $info) (i32.const 0xF)) (i32.const 0xF))
      (then (local.set $addr (i32.add (local.get $addr)
        (i32.load (i32.add (global.get $reg_base) (i32.shl (i32.and (local.get $info) (i32.const 0xF)) (i32.const 2))))))))
    (if (i32.ne (i32.and (i32.shr_u (local.get $info) (i32.const 4)) (i32.const 0xF)) (i32.const 0xF))
      (then (local.set $addr (i32.add (local.get $addr) (i32.shl
        (i32.load (i32.add (global.get $reg_base) (i32.shl (i32.and (i32.shr_u (local.get $info) (i32.const 4)) (i32.const 0xF)) (i32.const 2))))
        (i32.and (i32.shr_u (local.get $info) (i32.const 8)) (i32.const 3)))))))
    (local.get $addr))

  ;; 400: MOVSX r32, byte [base+index*scale+disp]
  (func $th_movsx8_sib (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $info i32) (local $v i32)
    (local.set $info (read-thread-word))
    (if (global.get $handler_hist_enabled)
      (then (call $sib_consumer_hist_record (i32.const 79) (local.get $op) (local.get $info))))
    (local.set $v (call $gl8 (call $sib_ea (local.get $info) (read-thread-word))))
    (if (i32.ge_u (local.get $v) (i32.const 0x80))
      (then (local.set $v (i32.or (local.get $v) (i32.const 0xFFFFFF00)))))
    (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $op) (i32.const 2))) (local.get $v))
    (dispatch-next))

  ;; 401: MOV byte [base+index*scale+disp], r8
  (func $th_store8_sib (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $info i32)
    (local.set $info (read-thread-word))
    (if (global.get $handler_hist_enabled)
      (then (call $sib_consumer_hist_record (i32.const 25) (local.get $op) (local.get $info))))
    (call $gs8 (call $sib_ea (local.get $info) (read-thread-word))
      (call $get_reg8 (local.get $op)))
    (dispatch-next))

  ;; 402: MOV byte [base+index*scale+disp], imm8 (op = the immediate)
  (func $th_mov_m8_i8_sib (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $info i32)
    (local.set $info (read-thread-word))
    (if (global.get $handler_hist_enabled)
      (then (call $sib_consumer_hist_record (i32.const 77) (local.get $op) (local.get $info))))
    (call $gs8 (call $sib_ea (local.get $info) (read-thread-word)) (local.get $op))
    (dispatch-next))

  ;; 420: MOV dword [base+index*scale+disp], r32 — the dword twin of 401.
  ;; Caesar III's RLE sprite decoder (0x0040f6d9) is the case that forced this
  ;; one: its per-length unrolled copy runs are `mov eax,[esi+k]` /
  ;; `mov [edi+edx*1+k],eax` pairs, and a --handler-hist run of the city view
  ;; attributes 96.66% of every SIB EA computed — 11,248,380 of them — to this
  ;; single consumer shape. Before the fusion each copied dword paid for a
  ;; second threaded dispatch and a SIB_SENTINEL word.
  ;;
  ;; Separate handler rather than another mode bit in 149, for the reason 389
  ;; states: an extra branch there is paid by every other SIB operation, and
  ;; docs/aoe-performance-optimization.md measured broad SIB fusions losing
  ;; more than they saved. Keeps the 149 encoding (info word, then disp), so
  ;; the decoder change is only which opcode it emits.
  (func $th_store32_sib (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $info i32)
    ;; Charge the step the fused-away dispatch would have cost. $next bills
    ;; $steps once per dispatch, so without this the guest advances ~12%
    ;; further per host batch on this workload and every frame captured at a
    ;; fixed batch number lands on a different game state -- DX-Ball's
    ;; ball-animation frames caught it. $th_copy_run's `cost` word is the same
    ;; contract: how an instruction is LOWERED must not change how much guest
    ;; work a batch buys. The win here is the removed call_indirect, the
    ;; SIB_SENTINEL word and the $ea_temp round trip, not the step.
    (global.set $steps (i32.sub (global.get $steps) (i32.const 1)))
    (local.set $info (read-thread-word))
    (if (global.get $handler_hist_enabled)
      (then (call $sib_consumer_hist_record (i32.const 21) (local.get $op) (local.get $info))))
    (call $gs32 (call $sib_ea (local.get $info) (read-thread-word))
      (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $op) (i32.const 2)))))
    (dispatch-next))

  ;; 444-446: Alpha Centauri's palette/conversion loops repeatedly use the
  ;; exact base-free SIB form `add reg,[eax*2+disp32]`. A complete-turn SIB
  ;; census attributes 6.89M operations (2.39% of all guest dispatches) to
  ;; these three destinations. Specializing the complete operation removes
  ;; the synthetic EA dispatch, two thread operands, the ea_temp round trip,
  ;; generic SIB register selection, and the generic ALU branch table.
  ;;
  ;; The one explicit step preserves the synthetic EA dispatch's scheduling
  ;; cost, as H420 does. The operand is the displacement itself.
  (func $th_add_edx_eax2_disp (param $disp i32)
     (local $nx_fn i32) (local $nx_op i32) (local $a i32) (local $b i32) (local $r i32)
    (global.set $steps (i32.sub (global.get $steps) (i32.const 1)))
    (if (global.get $handler_hist_enabled)
      (then (call $sib_consumer_hist_record (i32.const 48) (i32.const 2) (i32.const 0x10F))))
    (local.set $a (i32.load offset=8 (global.get $reg_base)))
    (local.set $b (call $gl32 (i32.add (i32.shl (i32.load offset=0 (global.get $reg_base)) (i32.const 1)) (local.get $disp))))
    (local.set $r (i32.add (local.get $a) (local.get $b)))
    (i32.store offset=8 (global.get $reg_base) (local.get $r))
    (call $set_flags_add (local.get $a) (local.get $b) (local.get $r))
    (dispatch-next))

  (func $th_add_ebp_eax2_disp (param $disp i32)
     (local $nx_fn i32) (local $nx_op i32) (local $a i32) (local $b i32) (local $r i32)
    (global.set $steps (i32.sub (global.get $steps) (i32.const 1)))
    (if (global.get $handler_hist_enabled)
      (then (call $sib_consumer_hist_record (i32.const 48) (i32.const 5) (i32.const 0x10F))))
    (local.set $a (i32.load offset=20 (global.get $reg_base)))
    (local.set $b (call $gl32 (i32.add (i32.shl (i32.load offset=0 (global.get $reg_base)) (i32.const 1)) (local.get $disp))))
    (local.set $r (i32.add (local.get $a) (local.get $b)))
    (i32.store offset=20 (global.get $reg_base) (local.get $r))
    (call $set_flags_add (local.get $a) (local.get $b) (local.get $r))
    (dispatch-next))

  (func $th_add_esi_eax2_disp (param $disp i32)
     (local $nx_fn i32) (local $nx_op i32) (local $a i32) (local $b i32) (local $r i32)
    (global.set $steps (i32.sub (global.get $steps) (i32.const 1)))
    (if (global.get $handler_hist_enabled)
      (then (call $sib_consumer_hist_record (i32.const 48) (i32.const 6) (i32.const 0x10F))))
    (local.set $a (i32.load offset=24 (global.get $reg_base)))
    (local.set $b (call $gl32 (i32.add (i32.shl (i32.load offset=0 (global.get $reg_base)) (i32.const 1)) (local.get $disp))))
    (local.set $r (i32.add (local.get $a) (local.get $b)))
    (i32.store offset=24 (global.get $reg_base) (local.get $r))
    (call $set_flags_add (local.get $a) (local.get $b) (local.get $r))
    (dispatch-next))

  ;; 421: the whole copied dword —
  ;;
  ;;   mov  r32, [base+disp]                 ; H345 when base is esi
  ;;   mov  [base+index*scale+disp], r32     ; H420 since the fusion above
  ;;
  ;; which is what Caesar III's unrolled sprite blitters are made of -- ~787
  ;; of them between 0x0041cf11 and 0x004ffefd, one per tile shape, each a
  ;; diamond of rows 1, 3, 5, 7 ... dwords wide with an `add edx,ecx` between
  ;; rows and no branch from the prologue to the ret. Together they were
  ;; 21.3M dispatches, 5.2% of a Caesar gameplay drive. 420 already removed
  ;; the second of the three dispatches each dword used to cost; this removes
  ;; the first, so a copied dword is one dispatch and three operand words
  ;; instead of three dispatches and four. Handler 422 below folds a whole
  ;; sprite when it can; this stays the fallback for a pair that stands alone
  ;; and for the tail of a run 422 declined.
  ;;
  ;; (Two earlier revisions of this comment named the wrong site. The RLE
  ;; decoder at 0x0040f6d9 stores through `mov [edi+0x4],eax`, a simple base
  ;; form that goes to 354, so this never fires there; and the rectangular
  ;; tile blit at 0x00410407 does not execute at all -- it is absent from
  ;; every one of the 1859 blocks a gameplay drive enters.)
  ;;
  ;; op = src_base | dst_reg<<4; words follow in x86 order: src disp, then the
  ;; store's 149-style info word, then its disp.
  ;;
  ;; The register is written BEFORE the store address is computed, because it
  ;; may be part of that address -- `mov edx,[esi+4] / mov [edi+edx*1],edx` is a
  ;; legal member of this family and reads the new edx. Doing it in x86 order
  ;; costs nothing and means the fusion needs no predicate about which registers
  ;; may overlap.
  (func $th_copy32_ro_to_sib (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $v i32) (local $info i32)
    ;; Two dispatches folded away, so two steps to charge on top of the one
    ;; $next bills -- see 420's note. Three total, matching what H345 + H149 +
    ;; H21 billed before either fusion existed, so pacing is unchanged by how
    ;; deep the lowering goes.
    (global.set $steps (i32.sub (global.get $steps) (i32.const 2)))
    (local.set $v (call $gl32 (i32.add
      (i32.load (i32.add (global.get $reg_base) (i32.shl (i32.and (local.get $op) (i32.const 0xF)) (i32.const 2))))
      (read-thread-word))))
    (i32.store (i32.add (global.get $reg_base) (i32.shl (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 2))) (local.get $v))
    (local.set $info (read-thread-word))
    ;; Report the store, not the fusion: the SIB EA this computes is consumed by
    ;; a store32 exactly as it was before, and a profile that renamed it would
    ;; stop being comparable across the change.
    (if (global.get $handler_hist_enabled)
      (then (call $sib_consumer_hist_record (i32.const 21)
              (i32.shr_u (local.get $op) (i32.const 4)) (local.get $info))))
    (call $gs32 (call $sib_ea (local.get $info) (read-thread-word))
      (local.get $v))
    (dispatch-next))

  ;; 403: the post-increment byte fetch through a pointer *variable*:
  ;;
  ;;   mov ecx,[0x525d80]      ; the stream pointer lives in memory, not a reg
  ;;   inc ecx
  ;;   mov [0x525d80],ecx
  ;;   mov al,[ecx-1]          ; optional: read the byte just stepped over
  ;;
  ;; Heroes II's ICN decoder is written entirely out of this idiom -- it reads
  ;; every RLE control byte and every pixel run this way, and the profile shows
  ;; the shape rather than the operation: load32-abs 6.5%, store32-abs 8.8%,
  ;; inc_r 3.4%, with the adjacent pairs load32->inc, inc->store32 and
  ;; store32->load8_ro all in the top ten. Folding the group into one dispatch
  ;; is worth three or four of them per byte consumed.
  ;;
  ;; op: bits 0-3 pointer register, bit 8 set when the byte load is present,
  ;; and then bits 4-6 its destination byte register. Words: the absolute
  ;; address of the pointer variable, then the byte load's displacement (only
  ;; when bit 8 is set). Flags are INC's, exactly as the separate ops left them.
  (func $th_ptrvar_fetch8 (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $abs i32) (local $old i32) (local $ptr i32)
    (local.set $abs (read-thread-word))
    (local.set $old (call $gl32 (local.get $abs)))
    (local.set $ptr (i32.add (local.get $old) (i32.const 1)))
    (i32.store (i32.add (global.get $reg_base) (i32.shl (i32.and (local.get $op) (i32.const 0xF)) (i32.const 2))) (local.get $ptr))
    (call $gs32 (local.get $abs) (local.get $ptr))
    (call $set_flags_inc (local.get $old) (local.get $ptr))
    (if (i32.and (local.get $op) (i32.const 0x100))
      (then
        (call $set_reg8 (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 7))
          (call $gl8 (i32.add (local.get $ptr) (read-thread-word))))))
    (dispatch-next))

  ;; 404: TEST r,r (or TEST r8,r8) immediately followed by a Jcc. The branch is
  ;; the only consumer of those flags in every occurrence the decoder fuses, so
  ;; the pair costs one dispatch instead of two, and the condition is read off
  ;; the AND result directly — a logic op leaves CF=0 and OF=0, which collapses
  ;; BE to ZF, A to !ZF, L/GE to the sign bit and LE/G to a sign-or-zero test.
  ;; Lazy-flag state is still published so any later reader (PUSHFD, SETcc, a
  ;; second branch) sees exactly what the separate TEST would have left.
  ;;
  ;; op: bits 0-3 and 4-7 the two registers, bits 8-11 the x86 condition code,
  ;; bit 12 set for the byte form. Words: fall-through EIP, then target EIP.
  (func $th_test_jcc (param $op i32)
    (local $r i32) (local $cc i32) (local $sign i32) (local $taken i32)
    (local $fall i32) (local $target i32)
    (local.set $cc (i32.and (i32.shr_u (local.get $op) (i32.const 8)) (i32.const 0xF)))
    (if (global.get $handler_hist_enabled)
      (then (call $branch_hist_record_jcc (local.get $cc))))
    (if (i32.and (local.get $op) (i32.const 0x1000))
      (then
        (local.set $r (i32.and
          (call $get_reg8 (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
          (call $get_reg8 (i32.and (local.get $op) (i32.const 0xF)))))
        (call $set_flags_logic (local.get $r))
        (global.set $flag_sign_shift (i32.const 7))
        (local.set $sign (i32.and (i32.shr_u (local.get $r) (i32.const 7)) (i32.const 1))))
      (else
        (local.set $r (i32.and
          (i32.load (i32.add (global.get $reg_base) (i32.shl (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)) (i32.const 2))))
          (i32.load (i32.add (global.get $reg_base) (i32.shl (i32.and (local.get $op) (i32.const 0xF)) (i32.const 2))))))
        (call $set_flags_logic (local.get $r))
        (local.set $sign (i32.shr_u (local.get $r) (i32.const 31)))))
    (local.set $fall (read-thread-word))
    (local.set $target (read-thread-word))
    (block $cc_done
      (if (i32.or (i32.eq (local.get $cc) (i32.const 0x4)) (i32.eq (local.get $cc) (i32.const 0x6)))
        (then (local.set $taken (i32.eqz (local.get $r))) (br $cc_done)))
      (if (i32.or (i32.eq (local.get $cc) (i32.const 0x5)) (i32.eq (local.get $cc) (i32.const 0x7)))
        (then (local.set $taken (i32.ne (local.get $r) (i32.const 0))) (br $cc_done)))
      (if (i32.or (i32.eq (local.get $cc) (i32.const 0x8)) (i32.eq (local.get $cc) (i32.const 0xC)))
        (then (local.set $taken (local.get $sign)) (br $cc_done)))
      (if (i32.or (i32.eq (local.get $cc) (i32.const 0x9)) (i32.eq (local.get $cc) (i32.const 0xD)))
        (then (local.set $taken (i32.eqz (local.get $sign))) (br $cc_done)))
      (if (i32.eq (local.get $cc) (i32.const 0xE))
        (then
          (local.set $taken (i32.or (i32.eqz (local.get $r)) (local.get $sign)))
          (br $cc_done)))
      (if (i32.eq (local.get $cc) (i32.const 0xF))
        (then
          (local.set $taken (i32.and (i32.ne (local.get $r) (i32.const 0)) (i32.eqz (local.get $sign))))
          (br $cc_done)))
      ;; O/NO/B/AE/P/NP are rare after a logic op; let the general evaluator
      ;; answer them from the state just published.
      (local.set $taken (call $eval_cc (local.get $cc))))
    (if (local.get $taken)
      (then (global.set $eip (local.get $target)))
      (else (global.set $eip (local.get $fall))))
    (return_call $branch_end))

  ;; 405/406: a run of 2-4 back-to-back absolute MOVs — `mov [abs],reg` or
  ;; `mov reg,[abs]` with nothing in between. Absolute loads and stores are the
  ;; two heaviest handlers in Heroes II's blitter (8.6% and 6.0% of all ops) and
  ;; the compiler emits them in clusters when it spills a register set, so the
  ;; run costs one dispatch instead of four.
  ;;
  ;; op: bits 0-3 the run length, then one register per nibble from bit 4 up.
  ;; Words: one absolute address per element, in program order.
  (func $th_store32_abs_run (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $n i32) (local $i i32) (local $addr i32)
    (local.set $n (i32.and (local.get $op) (i32.const 0xF)))
    (block $done (loop $l
      (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
      (local.set $addr (read-thread-word))
      (call $gs32 (local.get $addr)
        (i32.load (i32.add (global.get $reg_base) (i32.shl (i32.and
          (i32.shr_u (local.get $op)
            (i32.add (i32.const 4) (i32.shl (local.get $i) (i32.const 2))))
          (i32.const 0xF)) (i32.const 2)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $l)))
    (dispatch-next))

  ;; 448: a straight-line span of contiguous dword stores from one register.
  ;; The decoder proved that every instruction is exactly
  ;; `mov [base+disp+4*i],src`, so the base and source are sampled once just as
  ;; the original instructions would sample them.  A zero source over one
  ;; physically contiguous guest page is the common compiler-generated array
  ;; clear: translate and invalidate the full range once, then use Wasm bulk
  ;; memory.  Page-crossing, sparse/discontinuous and nonzero cases retain the
  ;; ordinary per-dword helper, including its partial-write and code-retirement
  ;; semantics.
  ;;
  ;; op: src in bits 0..3, base in bits 4..7, count in bits 8..31.
  ;; word: signed starting displacement.
  (func $th_store32_base_span (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $src i32) (local $base i32) (local $n i32) (local $disp i32)
    (local $ga i32) (local $wa i32)
    (local $len i32) (local $v i32) (local $i i32)
    (local.set $src (i32.and (local.get $op) (i32.const 0xF)))
    (local.set $base (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
    (local.set $n (i32.shr_u (local.get $op) (i32.const 8)))
    (local.set $disp (read-thread-word))
    (local.set $ga (i32.add (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $base) (i32.const 2)))) (local.get $disp)))
    (local.set $v (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $src) (i32.const 2)))))
    (local.set $len (i32.shl (local.get $n) (i32.const 2)))

    ;; memory.fill repeats a byte, so only zero has dword-store semantics here.
    ;; $g2w_affine_span rejects wrapped ends, holes, and mapping boundaries;
    ;; only then is one bulk write equivalent to the original dword stores.
    (if (i32.and
          (i32.eqz (local.get $v))
          (i32.le_u
            (i32.add (i32.and (local.get $ga) (i32.const 0xFFF)) (local.get $len))
            (i32.const 4096)))
      (then
        (local.set $wa (call $g2w_affine_span (local.get $ga) (local.get $len)))
        (if (i32.ne (local.get $wa) (global.get $NULL_SENTINEL))
          (then
            (call $invalidate_code_write (local.get $ga) (local.get $len))
            (memory.fill (local.get $wa) (i32.const 0) (local.get $len))
            (dispatch-next)))))

    (block $done (loop $store
      (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
      (call $gs32
        (i32.add (local.get $ga) (i32.shl (local.get $i) (i32.const 2)))
        (local.get $v))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $store)))
    (dispatch-next))

  (func $th_load32_abs_run (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $n i32) (local $i i32) (local $addr i32)
    (local.set $n (i32.and (local.get $op) (i32.const 0xF)))
    (block $done (loop $l
      (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
      (local.set $addr (read-thread-word))
      (i32.store (i32.add (global.get $reg_base) (i32.shl (i32.and
          (i32.shr_u (local.get $op)
            (i32.add (i32.const 4) (i32.shl (local.get $i) (i32.const 2))))
          (i32.const 0xF)) (i32.const 2))) (call $gl32 (local.get $addr)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $l)))
    (dispatch-next))

  ;; 407: `OP dword [base+disp], imm32` with the Jcc that immediately follows
  ;; it. This is the largest remaining adjacent pair in the Heroes II gameplay
  ;; histogram (537,833 back-to-back 131 -> jcc dispatches): the compare-a-
  ;; local-against-a-constant-and-branch shape every compiled loop is built
  ;; from. Unlike the TEST fusion in 404 the condition is not readable off the
  ;; result — a CMP/ADD/SUB publishes real CF and OF — so the flags are
  ;; published exactly as handler 131 leaves them and $eval_cc answers from
  ;; that state. The saving is the second dispatch, not the flag work, and the
  ;; lazy-flag globals are byte-for-byte what the unfused pair produced, so
  ;; PUSHFD, SETcc or a second branch after the group still see the truth.
  ;;
  ;; op: bits 0-3 base reg, 8-11 the ALU op, 12-15 the condition code.
  ;; Words: disp, imm32, fall-through EIP, branch target — the 131 payload with
  ;; the ordinary Jcc payload appended, so the emitter is unchanged apart from
  ;; which opcode it writes.
  (func $th_alu_m32_i_jcc (param $op i32)
    (local $addr i32) (local $alu i32) (local $imm i32) (local $val i32)
    (local $cc i32) (local $fall i32) (local $target i32)
    (local.set $cc (i32.and (i32.shr_u (local.get $op) (i32.const 12)) (i32.const 0xF)))
    (if (global.get $handler_hist_enabled)
      (then (call $branch_hist_record_jcc (local.get $cc))))
    (local.set $addr (call $ea_from_op (local.get $op)))
    (local.set $alu (i32.and (i32.shr_u (local.get $op) (i32.const 8)) (i32.const 0xF)))
    (local.set $imm (read-thread-word))
    (local.set $val (call $do_alu32 (local.get $alu) (call $gl32 (local.get $addr)) (local.get $imm)))
    (if (i32.ne (local.get $alu) (i32.const 7)) (then (call $gs32 (local.get $addr) (local.get $val))))
    (local.set $fall (read-thread-word))
    (local.set $target (read-thread-word))
    (if (call $eval_cc (local.get $cc))
      (then (global.set $eip (local.get $target)))
      (else (global.set $eip (local.get $fall))))
    (return_call $branch_end))

  ;; 408: 2-4 back-to-back `mov r32,[base+disp]` sharing one base register —
  ;; the frame-local read the compiler emits everywhere, and by a wide margin
  ;; the hottest single handler in a real game (11.6% of Heroes II's gameplay
  ;; dispatches land in $th_load32_ro_base_ebp alone).
  ;;
  ;; op is (n) | (base<<4) | (dst_i << (8 + 4*i)); the n words that follow are
  ;; the displacements, already segment-adjusted by the decoder. The base
  ;; register is read once, up front: the decoder ends a run at the element
  ;; whose destination IS the base (`mov ebp,[ebp+0xc]`), so every address in
  ;; the group is computed from the base value the group started with, which
  ;; is exactly what the unfused sequence would have done.
  (func $th_load32_base_run (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $n i32) (local $i i32) (local $base i32)
    (local.set $n (i32.and (local.get $op) (i32.const 0xF)))
    (local.set $base
      (i32.load (i32.add (global.get $reg_base) (i32.shl (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)) (i32.const 2)))))
    (block $done (loop $l
      (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
      (i32.store (i32.add (global.get $reg_base) (i32.shl (i32.and
          (i32.shr_u (local.get $op)
            (i32.add (i32.const 8) (i32.shl (local.get $i) (i32.const 2))))
          (i32.const 0xF)) (i32.const 2))) (call $gl32 (i32.add (local.get $base) (read-thread-word))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $l)))
    (dispatch-next))

  ;; 409: a memory unary (inc/dec/not/neg dword [base+disp]) immediately
  ;; followed by an ALU of an immediate against the SAME [base+disp] — the
  ;; loop-counter idiom every compiler emits for a counter that lives on the
  ;; stack rather than in a register:
  ;;
  ;;   inc dword [ebp-8]
  ;;   cmp dword [ebp-8], 0x64
  ;;
  ;; Handlers 135 and 131 each recompute the effective address and each pay a
  ;; dispatch; fused they compute it once, and the second op reads the value
  ;; the first just stored instead of loading it back.
  ;;
  ;; The operations are performed in exactly the order the two handlers would
  ;; have performed them, using the same helpers, so the lazy-flag state left
  ;; behind is the ALU op's — whatever $do_alu32 publishes — exactly as in the
  ;; unfused pair. op: bits 0-3 base reg, 4-7 the unary op, 8-11 the ALU op.
  ;; Words: the displacement, then the immediate.
  (func $th_unary_alu_m32_ro (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $addr i32) (local $uop i32) (local $alu i32)
    (local $old i32) (local $r i32) (local $imm i32)
    (local.set $addr (i32.add
      (i32.load (i32.add (global.get $reg_base) (i32.shl (i32.and (local.get $op) (i32.const 0xF)) (i32.const 2))))
      (read-thread-word)))
    (local.set $imm (read-thread-word))
    (local.set $uop (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
    (local.set $alu (i32.and (i32.shr_u (local.get $op) (i32.const 8)) (i32.const 0xF)))
    (local.set $old (call $gl32 (local.get $addr)))
    (if (i32.eq (local.get $uop) (i32.const 0))
      (then (local.set $r (i32.add (local.get $old) (i32.const 1)))
            (call $set_flags_inc (local.get $old) (local.get $r))))
    (if (i32.eq (local.get $uop) (i32.const 1))
      (then (local.set $r (i32.sub (local.get $old) (i32.const 1)))
            (call $set_flags_dec (local.get $old) (local.get $r))))
    (if (i32.eq (local.get $uop) (i32.const 2))
      (then (local.set $r (i32.xor (local.get $old) (i32.const -1)))))
    (if (i32.eq (local.get $uop) (i32.const 3))
      (then (local.set $r (i32.sub (i32.const 0) (local.get $old)))
            (call $set_flags_sub (i32.const 0) (local.get $old) (local.get $r))))
    (call $gs32 (local.get $addr) (local.get $r))
    (local.set $r (call $do_alu32 (local.get $alu) (local.get $r) (local.get $imm)))
    (if (i32.ne (local.get $alu) (i32.const 7))
      (then (call $gs32 (local.get $addr) (local.get $r))))
    (dispatch-next))

  ;; 390: two adjacent SIB LEAs. Words are info1, disp1, info2, disp2 and the
  ;; destination registers are packed into op. The second address is computed
  ;; after committing the first result, preserving dependent LEA semantics.
  (func $th_lea_sib_pair (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $info1 i32) (local $disp1 i32) (local $info2 i32) (local $disp2 i32)
    (local $base_val i32) (local $index_val i32) (local $scale i32)
    (local.set $info1 (read-thread-word))
    (local.set $disp1 (read-thread-word))
    (local.set $info2 (read-thread-word))
    (local.set $disp2 (read-thread-word))
    (if (i32.ne (i32.and (local.get $info1) (i32.const 0xF)) (i32.const 0xF))
      (then (local.set $base_val (i32.load (i32.add (global.get $reg_base) (i32.shl (i32.and (local.get $info1) (i32.const 0xF)) (i32.const 2)))))))
    (if (i32.ne (i32.and (i32.shr_u (local.get $info1) (i32.const 4)) (i32.const 0xF)) (i32.const 0xF))
      (then
        (local.set $scale (i32.and (i32.shr_u (local.get $info1) (i32.const 8)) (i32.const 3)))
        (local.set $index_val (i32.shl
          (i32.load (i32.add (global.get $reg_base) (i32.shl (i32.and (i32.shr_u (local.get $info1) (i32.const 4)) (i32.const 0xF)) (i32.const 2))))
          (local.get $scale)))))
    (i32.store (i32.add (global.get $reg_base) (i32.shl (i32.and (local.get $op) (i32.const 7)) (i32.const 2))) (i32.add (i32.add (local.get $base_val) (local.get $index_val)) (local.get $disp1)))
    (local.set $base_val (i32.const 0))
    (local.set $index_val (i32.const 0))
    (if (i32.ne (i32.and (local.get $info2) (i32.const 0xF)) (i32.const 0xF))
      (then (local.set $base_val (i32.load (i32.add (global.get $reg_base) (i32.shl (i32.and (local.get $info2) (i32.const 0xF)) (i32.const 2)))))))
    (if (i32.ne (i32.and (i32.shr_u (local.get $info2) (i32.const 4)) (i32.const 0xF)) (i32.const 0xF))
      (then
        (local.set $scale (i32.and (i32.shr_u (local.get $info2) (i32.const 8)) (i32.const 3)))
        (local.set $index_val (i32.shl
          (i32.load (i32.add (global.get $reg_base) (i32.shl (i32.and (i32.shr_u (local.get $info2) (i32.const 4)) (i32.const 0xF)) (i32.const 2))))
          (local.get $scale)))))
    (i32.store (i32.add (global.get $reg_base) (i32.shl (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 7)) (i32.const 2))) (i32.add (i32.add (local.get $base_val) (local.get $index_val)) (local.get $disp2)))
    (dispatch-next))

  ;; 391: MOV EAX,[EDX+disp] followed by TEST EAX,imm32. Smacker's Huffman
  ;; tree builder uses this pair for every node probe. MOV leaves flags alone;
  ;; TEST publishes the same lazy logic flags as the two ordinary handlers.
  (func $th_load_eax_edx_test_i32 (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (i32.store offset=0 (global.get $reg_base) (call $gl32
        (i32.add (i32.load offset=8 (global.get $reg_base)) (read-thread-word))))
    (call $set_flags_logic
      (i32.and (i32.load offset=0 (global.get $reg_base)) (read-thread-word)))
    (dispatch-next))

  ;; 392: ADD EDX,EAX followed by the zero-displacement form of handler 391.
  ;; TEST overwrites every arithmetic flag written by ADD, so the only live
  ;; intermediate state is the updated EDX used as the load address.
  (func $th_add_edx_eax_load_test (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (i32.store offset=8 (global.get $reg_base) (i32.add (i32.load offset=8 (global.get $reg_base)) (i32.load offset=0 (global.get $reg_base))))
    (i32.store offset=0 (global.get $reg_base) (call $gl32 (i32.load offset=8 (global.get $reg_base))))
    (call $set_flags_logic
      (i32.and (i32.load offset=0 (global.get $reg_base)) (read-thread-word)))
    (dispatch-next))

  ;; 393: Smacker refills its bit reservoir after decrementing an absolute
  ;; byte counter, then immediately branches on DEC's ZF. The fall-through
  ;; and target words make this block-ending just like $th_jcc_nz; DEC's full
  ;; lazy-flag state (including preserved CF) remains visible at either edge.
  (func $th_dec_m8_abs_jnz (param $op i32)
    (local $old i32) (local $r i32) (local $fall i32) (local $target i32)
    (local.set $old (call $gl8 (local.get $op)))
    (local.set $r
      (i32.and (i32.sub (local.get $old) (i32.const 1)) (i32.const 0xFF)))
    (call $set_flags_dec (local.get $old) (local.get $r))
    (global.set $flag_sign_shift (i32.const 7))
    (call $gs8 (local.get $op) (local.get $r))
    (local.set $fall (read-thread-word))
    (local.set $target (read-thread-word))
    (if (global.get $handler_hist_enabled)
      (then (call $branch_hist_record_jcc (i32.const 5))))
    (if (local.get $r)
      (then (global.set $eip (local.get $target)))
      (else (global.set $eip (local.get $fall))))
    (return_call $branch_end))

  ;; 394: Smacker consumes one input bit with SHR EBP,1 and immediately uses
  ;; CF through JB or JAE. op=0 is JB, op=1 is JAE. $do_shift32 publishes the
  ;; exact count-one shift flags; the saved low bit selects the successor
  ;; without resolving the lazy CF a second time.
  (func $th_shr_ebp_1_jcc_b (param $op i32)
    (local $old i32) (local $taken i32) (local $fall i32) (local $target i32)
    (local.set $old (i32.load offset=20 (global.get $reg_base)))
    (i32.store offset=20 (global.get $reg_base) (call $do_shift32 (i32.const 5) (local.get $old) (i32.const 1)))
    (local.set $fall (read-thread-word))
    (local.set $target (read-thread-word))
    (if (global.get $handler_hist_enabled)
      (then (call $branch_hist_record_jcc (i32.add (i32.const 2) (local.get $op)))))
    (local.set $taken
      (if (result i32) (i32.eqz (local.get $op))
        (then (i32.and (local.get $old) (i32.const 1)))
        (else (i32.eqz (i32.and (local.get $old) (i32.const 1))))))
    (if (local.get $taken)
      (then (global.set $eip (local.get $target)))
      (else (global.set $eip (local.get $fall))))
    (return_call $branch_end))

  ;; 397: ASCII adjust after multiply. The immediate is normally decimal 10,
  ;; but 32-bit x86 accepts any non-zero byte base. Only AL participates; AH
  ;; receives the quotient and AL the remainder while EAX[31:16] is preserved.
  (func $th_aam (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $al i32) (local $quotient i32) (local $remainder i32)
    (if (i32.eqz (local.get $op))
      (then
        (call $raise_exception (i32.const 0xC0000094))
        (return)))
    (local.set $al (i32.and (i32.load offset=0 (global.get $reg_base)) (i32.const 0xFF)))
    (local.set $quotient (i32.div_u (local.get $al) (local.get $op)))
    (local.set $remainder (i32.rem_u (local.get $al) (local.get $op)))
    (i32.store16 (global.get $reg_base) (i32.or
          (i32.shl (local.get $quotient) (i32.const 8))
          (local.get $remainder)))
    (call $set_flags_logic (local.get $remainder))
    (global.set $flag_sign_shift (i32.const 7))
    (dispatch-next))

  ;; Minimal PC port state used by Win9x applications that legitimately issue
  ;; user-mode IN/OUT. Channel 0 is latched through port 0x43 and returned low
  ;; byte then high byte from 0x40, matching the 8254 access Fallout uses for
  ;; its random/timer seed. Port 0x3DA alternates vertical-retrace status so a
  ;; legacy VGA polling loop cannot deadlock. Other ports float high.
  (global $io_pit_latch (mut i32) (i32.const 0))
  (global $io_pit_phase (mut i32) (i32.const 0))
  (global $io_vga_status (mut i32) (i32.const 0))

  ;; PCI configuration mechanism #1: a dword written to 0xCF8 selects
  ;; bus/device/function/register, and 0xCFC..0xCFF read that register. Win9x
  ;; leaves both ports open to ring 3, and 3Dfx's fxPCI scan (NFS II SE's
  ;; SETUP calls it through SHELL.DLL!PCICheckVendorDevice) walks the bus this
  ;; way to look for a Voodoo. With every port floating high the scan found no
  ;; bus at all and setup stopped on "Error: Can not detect hardware!". The
  ;; machine is a 440BX board: host bridge at 0:0.0 and PIIX4 ISA bridge at
  ;; 0:7.0, nothing else. An empty slot reads all ones, as on hardware.
  (global $io_pci_addr (mut i32) (i32.const 0))

  (func $pci_config_read (param $addr i32) (result i32)
    (local $dev i32) (local $reg i32) (local $id i32) (local $class i32)
    (if (i32.eqz (i32.and (local.get $addr) (i32.const 0x80000000)))
      (then (return (i32.const -1))))
    ;; bus 0, function 0; device in bits 11..15
    (if (i32.and (local.get $addr) (i32.const 0x00FF0700))
      (then (return (i32.const -1))))
    (local.set $dev (i32.and (i32.shr_u (local.get $addr) (i32.const 11)) (i32.const 0x1F)))
    (local.set $reg (i32.and (local.get $addr) (i32.const 0xFC)))
    (if (i32.eqz (local.get $dev))
      (then
        (local.set $id (i32.const 0x71908086))        ;; Intel 82443BX host bridge
        (local.set $class (i32.const 0x06000003)))     ;; host bridge, rev 03
      (else
        (if (i32.eq (local.get $dev) (i32.const 7))
          (then
            (local.set $id (i32.const 0x71108086))    ;; Intel 82371AB PIIX4 ISA
            (local.set $class (i32.const 0x06010002))) ;; ISA bridge, rev 02
          (else (return (i32.const -1))))))
    (if (i32.eqz (local.get $reg)) (then (return (local.get $id))))
    (if (i32.eq (local.get $reg) (i32.const 0x04))
      (then (return (i32.const 0x02000006))))          ;; mem+master; medium DEVSEL
    (if (i32.eq (local.get $reg) (i32.const 0x08)) (then (return (local.get $class))))
    (i32.const 0))

  ;; 398: IN/OUT AL/AX/EAX with an immediate or DX port. Operand bits 0..7 are
  ;; the x86 opcode, 8..15 hold an immediate port, and bit 16 records 66h.
  (func $th_port_io (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $opcode i32) (local $port i32) (local $value i32)
    (local $wide i32) (local $word i32) (local $is_in i32)
    (local.set $opcode (i32.and (local.get $op) (i32.const 0xFF)))
    (local.set $port
      (if (result i32) (i32.lt_u (local.get $opcode) (i32.const 0xEC))
        (then (i32.and (i32.shr_u (local.get $op) (i32.const 8)) (i32.const 0xFF)))
        (else (i32.and (i32.load offset=8 (global.get $reg_base)) (i32.const 0xFFFF)))))
    (local.set $wide (i32.and (local.get $opcode) (i32.const 1)))
    (local.set $word
      (i32.and
        (local.get $wide)
        (i32.ne (i32.and (local.get $op) (i32.const 0x10000)) (i32.const 0))))
    (local.set $is_in
      (i32.or
        (i32.eq (local.get $opcode) (i32.const 0xE4))
        (i32.or
          (i32.eq (local.get $opcode) (i32.const 0xE5))
          (i32.or
            (i32.eq (local.get $opcode) (i32.const 0xEC))
            (i32.eq (local.get $opcode) (i32.const 0xED))))))

    (if (local.get $is_in)
      (then
        (local.set $value (i32.const -1))
        (if (i32.and (i32.eqz (local.get $wide))
              (i32.eq (i32.and (local.get $port) (i32.const 0xFFFE)) (i32.const 0x70)))
          (then (local.set $value (call $host_cmos_io (local.get $port) (i32.const 0) (i32.const 0)))))
        (if (i32.eq (local.get $port) (i32.const 0x40))
          (then
            (if (i32.eqz (global.get $io_pit_phase))
              (then
                (local.set $value (i32.and (global.get $io_pit_latch) (i32.const 0xFF)))
                (global.set $io_pit_phase (i32.const 1)))
              (else
                (local.set $value
                  (i32.and (i32.shr_u (global.get $io_pit_latch) (i32.const 8)) (i32.const 0xFF)))
                (global.set $io_pit_phase (i32.const 0))))))
        (if (i32.eq (local.get $port) (i32.const 0x61))
          (then (local.set $value (i32.const 0))))
        (if (i32.eq (local.get $port) (i32.const 0x3DA))
          (then
            (global.set $io_vga_status
              (i32.xor (global.get $io_vga_status) (i32.const 8)))
            (local.set $value (global.get $io_vga_status))))
        (if (i32.and (i32.eq (local.get $port) (i32.const 0xCF8))
                     (i32.and (local.get $wide) (i32.eqz (local.get $word))))
          (then (local.set $value (global.get $io_pci_addr))))
        (if (i32.eq (i32.and (local.get $port) (i32.const 0xFFFC)) (i32.const 0xCFC))
          (then
            (local.set $value
              (i32.shr_u
                (call $pci_config_read (global.get $io_pci_addr))
                (i32.shl (i32.and (local.get $port) (i32.const 3)) (i32.const 3))))))
        (if (i32.eqz (local.get $wide))
          (then
            (i32.store8 (global.get $reg_base) (local.get $value)))
          (else
            (if (local.get $word)
              (then
                (i32.store16 (global.get $reg_base) (local.get $value)))
              (else (i32.store offset=0 (global.get $reg_base) (local.get $value)))))))
      (else
        (local.set $value
          (if (result i32) (i32.eqz (local.get $wide))
            (then (i32.and (i32.load offset=0 (global.get $reg_base)) (i32.const 0xFF)))
            (else
              (if (result i32) (local.get $word)
                (then (i32.and (i32.load offset=0 (global.get $reg_base)) (i32.const 0xFFFF)))
                (else (i32.load offset=0 (global.get $reg_base)))))))
        (if (i32.and (i32.eqz (local.get $wide))
              (i32.eq (i32.and (local.get $port) (i32.const 0xFFFE)) (i32.const 0x70)))
          (then (drop (call $host_cmos_io (local.get $port) (local.get $value) (i32.const 1)))))
        ;; Only a dword write reaches the mechanism #1 address register; a byte
        ;; write to 0xCF8 is mechanism #2's enable register, which is absent.
        (if (i32.and (i32.eq (local.get $port) (i32.const 0xCF8))
                     (i32.and (local.get $wide) (i32.eqz (local.get $word))))
          (then (global.set $io_pci_addr (i32.and (local.get $value) (i32.const 0x80FFFFFC)))))
        (if (i32.and
              (i32.eq (local.get $port) (i32.const 0x43))
              (i32.eqz (i32.and (local.get $value) (i32.const 0xC0))))
          (then
            (global.set $io_pit_latch
              (i32.and
                (i32.sub
                  (i32.const 0)
                  (i32.mul (call $host_get_ticks) (i32.const 1193)))
                (i32.const 0xFFFF)))
            (global.set $io_pit_phase (i32.const 0))))))
    (dispatch-next))

  ;; Helper: compute EA from operand encoding (alu_op<<8 | reg<<4 | base)
  (func $ea_from_op (param $op i32) (result i32)
    (i32.add (i32.load (i32.add (global.get $reg_base) (i32.shl (i32.and (local.get $op) (i32.const 0xF)) (i32.const 2)))) (read-thread-word)))

  ;; 127: [base+disp] OP= reg32. operand = alu_op<<8 | reg<<4 | base. disp in next word.
  (func $th_alu_m32_r_ro (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $addr i32) (local $alu i32) (local $reg i32) (local $val i32)
    (local.set $addr (call $ea_from_op (local.get $op)))
    (local.set $alu (i32.and (i32.shr_u (local.get $op) (i32.const 8)) (i32.const 0xF)))
    (local.set $reg (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
    (local.set $val (call $do_alu32 (local.get $alu) (call $gl32 (local.get $addr)) (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $reg) (i32.const 2))))))
    (if (i32.ne (local.get $alu) (i32.const 7)) (then (call $gs32 (local.get $addr) (local.get $val))))
    (dispatch-next))

  ;; 128: reg32 OP= [base+disp]. operand = alu_op<<8 | reg<<4 | base.
  (func $th_alu_r_m32_ro (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $addr i32) (local $alu i32) (local $reg i32) (local $val i32)
    (if (global.get $handler_hist_enabled)
      (then
        (call $branch_hist_set (i32.const 3)
          (i32.or
            (i32.shl (i32.and (i32.shr_u (local.get $op) (i32.const 8)) (i32.const 7)) (i32.const 6))
            (i32.or
              (i32.shl (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 7)) (i32.const 3))
              (i32.and (local.get $op) (i32.const 7)))))))
    (local.set $addr (call $ea_from_op (local.get $op)))
    (local.set $alu (i32.and (i32.shr_u (local.get $op) (i32.const 8)) (i32.const 0xF)))
    (local.set $reg (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
    (local.set $val (call $do_alu32 (local.get $alu) (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $reg) (i32.const 2)))) (call $gl32 (local.get $addr))))
    (if (i32.ne (local.get $alu) (i32.const 7)) (then (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $reg) (i32.const 2))) (local.get $val))))
    (dispatch-next))

  ;; 129: [base+disp] OP= reg8. operand = alu_op<<8 | reg<<4 | base.
  (func $th_alu_m8_r_ro (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $addr i32) (local $alu i32) (local $reg i32) (local $val i32)
    (local.set $addr (call $ea_from_op (local.get $op)))
    (local.set $alu (i32.and (i32.shr_u (local.get $op) (i32.const 8)) (i32.const 0xF)))
    (local.set $reg (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
    (local.set $val (call $do_alu_sized (local.get $alu) (call $gl8 (local.get $addr)) (call $get_reg8 (local.get $reg)) (i32.const 0xFF) (i32.const 7)))
    (if (i32.ne (local.get $alu) (i32.const 7)) (then (call $gs8 (local.get $addr) (local.get $val))))
    (dispatch-next))

  ;; 130: reg8 OP= [base+disp]. operand = alu_op<<8 | reg<<4 | base.
  (func $th_alu_r_m8_ro (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $addr i32) (local $alu i32) (local $reg i32) (local $val i32)
    (local.set $addr (call $ea_from_op (local.get $op)))
    (local.set $alu (i32.and (i32.shr_u (local.get $op) (i32.const 8)) (i32.const 0xF)))
    (local.set $reg (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
    (local.set $val (call $do_alu_sized (local.get $alu) (call $get_reg8 (local.get $reg)) (call $gl8 (local.get $addr)) (i32.const 0xFF) (i32.const 7)))
    (if (i32.ne (local.get $alu) (i32.const 7)) (then (call $set_reg8 (local.get $reg) (local.get $val))))
    (dispatch-next))

  ;; 131: [base+disp] OP= imm32. operand = alu_op<<8 | base. disp+imm in next words.
  (func $th_alu_m32_i_ro (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $addr i32) (local $alu i32) (local $imm i32) (local $val i32)
    (local.set $addr (call $ea_from_op (local.get $op)))
    (local.set $alu (i32.and (i32.shr_u (local.get $op) (i32.const 8)) (i32.const 0xF)))
    (local.set $imm (read-thread-word))
    (local.set $val (call $do_alu32 (local.get $alu) (call $gl32 (local.get $addr)) (local.get $imm)))
    (if (i32.ne (local.get $alu) (i32.const 7)) (then (call $gs32 (local.get $addr) (local.get $val))))
    (dispatch-next))

  ;; 132: [base+disp] OP= imm8. operand = alu_op<<8 | base. disp+imm in next words.
  (func $th_alu_m8_i_ro (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $addr i32) (local $alu i32) (local $imm i32) (local $val i32)
    (local.set $addr (call $ea_from_op (local.get $op)))
    (local.set $alu (i32.and (i32.shr_u (local.get $op) (i32.const 8)) (i32.const 0xF)))
    ;; The immediate is masked to eight bits like the memory operand: a
    ;; sign-extended imm8 arrives as 0xFFFFFFxx and would compare unsigned
    ;; against a byte as though it were enormous. See $th_alu_m16_i_ro.
    (local.set $imm (i32.and (read-thread-word) (i32.const 0xFF)))
    (local.set $val (call $do_alu_sized (local.get $alu) (call $gl8 (local.get $addr)) (local.get $imm) (i32.const 0xFF) (i32.const 7)))
    (if (i32.ne (local.get $alu) (i32.const 7)) (then (call $gs8 (local.get $addr) (local.get $val))))
    (dispatch-next))

  ;; 220: [base+disp] OP= imm16. operand = alu_op<<8 | base. disp+imm in next words.
  (func $th_alu_m16_i_ro (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $addr i32) (local $alu i32) (local $imm i32) (local $val i32)
    (local.set $addr (call $ea_from_op (local.get $op)))
    (local.set $alu (i32.and (i32.shr_u (local.get $op) (i32.const 8)) (i32.const 0xF)))
    (local.set $imm (i32.and (read-thread-word) (i32.const 0xFFFF)))
    (local.set $val (call $do_alu_sized (local.get $alu) (call $gl16 (local.get $addr)) (local.get $imm) (i32.const 0xFFFF) (i32.const 15)))
    (if (i32.ne (local.get $alu) (i32.const 7)) (then (call $gs16 (local.get $addr) (local.get $val))))
    (dispatch-next))

  ;; 133: mov [base+disp], imm32. op=base, disp+imm in next words.
  (func $th_mov_m32_i32_ro (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $addr i32)
    (local.set $addr (call $ea_from_op (local.get $op)))
    (call $gs32 (local.get $addr) (read-thread-word))
    (dispatch-next))
  ;; 134: mov [base+disp], imm8.
  (func $th_mov_m8_i8_ro (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $addr i32)
    (local.set $addr (call $ea_from_op (local.get $op)))
    (call $gs8 (local.get $addr) (read-thread-word))
    (dispatch-next))
  ;; 135: inc/dec/not/neg [base+disp]. op=unary_op<<4|base, disp in word.
  (func $th_unary_m32_ro (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $addr i32) (local $uop i32) (local $old i32) (local $r i32)
    (local.set $addr (call $ea_from_op (local.get $op)))
    (local.set $uop (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
    (local.set $old (call $gl32 (local.get $addr)))
    (if (i32.eq (local.get $uop) (i32.const 0))
      (then (local.set $r (i32.add (local.get $old) (i32.const 1)))
            (call $set_flags_inc (local.get $old) (local.get $r))))
    (if (i32.eq (local.get $uop) (i32.const 1))
      (then (local.set $r (i32.sub (local.get $old) (i32.const 1)))
            (call $set_flags_dec (local.get $old) (local.get $r))))
    (if (i32.eq (local.get $uop) (i32.const 2))
      (then (local.set $r (i32.xor (local.get $old) (i32.const -1)))))
    (if (i32.eq (local.get $uop) (i32.const 3))
      (then (local.set $r (i32.sub (i32.const 0) (local.get $old)))
            (call $set_flags_sub (i32.const 0) (local.get $old) (local.get $r))))
    (call $gs32 (local.get $addr) (local.get $r)) (dispatch-next))
  ;; 136: test [base+disp], reg. op=reg<<4|base, disp in word.
  (func $th_test_m32_r_ro (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $addr i32)
    (local.set $addr (call $ea_from_op (local.get $op)))
    (drop (call $do_alu32 (i32.const 4) (call $gl32 (local.get $addr))
      (i32.load (i32.add (global.get $reg_base) (i32.shl (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)) (i32.const 2))))))
    (dispatch-next))
  ;; 137: test [base+disp], imm32. op=base, disp+imm in words.
  (func $th_test_m32_i32_ro (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $addr i32)
    (local.set $addr (call $ea_from_op (local.get $op)))
    (drop (call $do_alu32 (i32.const 4) (call $gl32 (local.get $addr)) (read-thread-word)))
    (dispatch-next))
  ;; 138: test [base+disp], imm8. op=base, disp+imm in words.
  (func $th_test_m8_i8_ro (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $addr i32)
    (local.set $addr (call $ea_from_op (local.get $op)))
    (drop (call $do_alu32 (i32.const 4) (call $gl8 (local.get $addr)) (read-thread-word)))
    (global.set $flag_sign_shift (i32.const 7)) (dispatch-next))
  ;; 139: shift [base+disp]. op=base, next word=shift_info (type<<8|count), next word=disp.
  ;; Wait — ea_from_op reads disp as first word. So: op=base, word1=disp (from ea_from_op), word2=shift_info.
  ;; Actually let me not use ea_from_op here for flexibility. op=base, w1=disp, w2=shift_type<<8|count.
  (func $th_shift_m32_ro (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $addr i32) (local $info i32) (local $stype i32) (local $count i32) (local $val i32)
    (local.set $addr (call $ea_from_op (local.get $op)))
    (local.set $info (read-thread-word))
    (local.set $stype (i32.and (i32.shr_u (local.get $info) (i32.const 8)) (i32.const 7)))
    (local.set $count (i32.and (local.get $info) (i32.const 0xFF)))
    (if (i32.eq (local.get $count) (i32.const 0xFF)) (then (local.set $count (i32.and (i32.load offset=4 (global.get $reg_base)) (i32.const 31)))))
    (local.set $val (call $gl32 (local.get $addr)))
    (call $gs32 (local.get $addr) (call $do_shift32 (local.get $stype) (local.get $val) (local.get $count)))
    (dispatch-next))
  ;; 140: call [base+disp]. op=ret_addr, w1=base, w2=disp.
  ;; Different encoding: we need ret_addr in operand AND base+disp. Pack base in w1, disp in w2.
  (func $th_call_ind_ro (param $op i32)
    (local $base i32) (local $disp i32) (local $mem_addr i32) (local $target i32)
    (local.set $base (read-thread-word))
    (local.set $disp (read-thread-word))
    (local.set $mem_addr (i32.add (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $base) (i32.const 2)))) (local.get $disp)))
    (local.set $target (call $gl32 (local.get $mem_addr)))
    (if (thunk-contains (local.get $target))
      (then
        (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $op))
        (call $win32_dispatch (i32.div_u (i32.sub (local.get $target) (global.get $thunk_guest_base)) (i32.const 8)))
        (if (global.get $steps) (then (global.set $eip (local.get $op))))
        (return)))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $op))
    (call $cs_push (local.get $op))
    (global.set $eip (local.get $target)))
  ;; 141: jmp [base+disp]. op=0, w1=base, w2=disp.
  (func $th_jmp_ind_ro (param $op i32)
    (local $base i32) (local $disp i32) (local $mem_addr i32) (local $target i32)
    (local $ret_addr i32)
    (local.set $base (read-thread-word))
    (local.set $disp (read-thread-word))
    (local.set $mem_addr (i32.add (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $base) (i32.const 2)))) (local.get $disp)))
    (local.set $target (call $gl32 (local.get $mem_addr)))
    (if (thunk-contains (local.get $target))
      (then
        ;; JMP to thunk (e.g. JMP [IAT] trampoline). The return address is at [ESP]
        ;; (pushed by the preceding CALL). Save it before the handler pops it.
        (local.set $ret_addr (call $gl32 (i32.load offset=16 (global.get $reg_base))))
        (call $win32_dispatch (i32.div_u (i32.sub (local.get $target) (global.get $thunk_guest_base)) (i32.const 8)))
        ;; If dispatch redirected (steps=0), EIP was already set by the handler
        (if (global.get $steps) (then (global.set $eip (local.get $ret_addr))))
        (return)))
    (global.set $eip (local.get $target)))
  ;; 355: jmp [disp+eax*4]. Hot AoE blitter command-table dispatch.
  (func $th_jmp_ind_sib_eax4_abs (param $op i32)
    (local $disp i32) (local $target i32) (local $ret_addr i32)
    (local.set $disp (read-thread-word))
    (local.set $target
      (call $gl32
        (i32.add (local.get $disp)
          (i32.shl (i32.load offset=0 (global.get $reg_base)) (i32.const 2)))))
    (if (thunk-contains (local.get $target))
      (then
        (local.set $ret_addr (call $gl32 (i32.load offset=16 (global.get $reg_base))))
        (call $win32_dispatch (i32.div_u (i32.sub (local.get $target) (global.get $thunk_guest_base)) (i32.const 8)))
        (if (global.get $steps) (then (global.set $eip (local.get $ret_addr))))
        (return)))
    (global.set $eip (local.get $target)))
  ;; 498: jmp [disp+r*4] -- a switch statement's table jump (op = r, disp in
  ;; the word). Emitted instead of 355/125 while $jump_table_on. Two changes
  ;; against those, and nothing else:
  ;;   * the table word is read with $g2w's direct-window arithmetic inline
  ;;     (the same answer $gl32 gives there, which is where every image's
  ;;     .text/.rdata lives), $gl32 only off it;
  ;;   * the transfer takes $branch_end, like a jmp rel32, instead of
  ;;     returning to $run's desk. That saves the desk trip, and it is what
  ;;     lets a case target be hot-bumped into a uop head at all: the desk
  ;;     never calls $bx_hot_bump. Both charge the transfer one block.
  ;; Nothing is cached: the word is re-read on every dispatch, so a table the
  ;; guest rewrites needs no invalidation. See docs/uop-tier-design.md §16.
  (func $th_jmp_tbl (param $op i32)
    (local $ga i32) (local $wa i32) (local $target i32) (local $ret_addr i32)
    (local.set $ga
      (i32.add (read-thread-word)
        (i32.shl (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $op) (i32.const 2))))
                 (i32.const 2))))
    (local.set $wa (i32.add (i32.sub (local.get $ga) (global.get $image_base)) (global.get $GUEST_BASE)))
    (local.set $target
      (if (result i32) (i32.lt_u (local.get $wa) (i32.sub (region.end $DIRECT_WINDOW) (i32.const 3)))
        (then (i32.load (local.get $wa)))
        (else (call $gl32 (local.get $ga)))))
    (if (i32.and (i32.ge_u (local.get $target) (global.get $thunk_guest_base))
                 (i32.lt_u (local.get $target) (global.get $thunk_guest_end)))
      (then
        (local.set $ret_addr (call $gl32 (i32.load offset=16 (global.get $reg_base))))
        (call $win32_dispatch (i32.div_u (i32.sub (local.get $target) (global.get $thunk_guest_base)) (i32.const 8)))
        (if (global.get $steps) (then (global.set $eip (local.get $ret_addr))))
        (return)))
    (global.set $eip (local.get $target))
    (return_call $branch_end))
  ;; 142: push [base+disp]. op=base, disp in word.
  (func $th_push_m32_ro (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $addr i32)
    (local.set $addr (call $ea_from_op (local.get $op)))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (call $gl32 (local.get $addr)))
    (dispatch-next))
  (func $th_pop_m32_ro (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $addr i32)
    (local.set $addr (call $ea_from_op (local.get $op)))
    (call $gs32 (local.get $addr) (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))) (dispatch-next))
  ;; 143-146: movzx/movsx [base+disp] variants. op=dst<<4|base, disp in word.
  (func $th_movzx8_ro (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (i32.store (i32.add (global.get $reg_base) (i32.shl (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 2))) (call $gl8 (call $ea_from_op (local.get $op))))
    (dispatch-next))
  (func $th_movsx8_ro (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (i32.store (i32.add (global.get $reg_base) (i32.shl (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 2))) (call $sign_ext8 (call $gl8 (call $ea_from_op (local.get $op)))))
    (dispatch-next))
  (func $th_movzx16_ro (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (i32.store (i32.add (global.get $reg_base) (i32.shl (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 2))) (call $gl16 (call $ea_from_op (local.get $op))))
    (dispatch-next))
  (func $th_movsx16_ro (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (i32.store (i32.add (global.get $reg_base) (i32.shl (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 2))) (call $sign_ext16 (call $gl16 (call $ea_from_op (local.get $op)))))
    (dispatch-next))
  ;; 147: mul/imul/div/idiv [base+disp]. op=type<<4|base, disp in word. type: 0=mul,1=imul,2=div,3=idiv
  (func $th_muldiv_m32_ro (param $op i32)
     (local $nx_fn i32) (local $nx_op i32) (local $addr i32) (local $mtype i32) (local $mval i32) (local $val64 i64) (local $divisor i64) (local $dividend i64) (local $quotient i64)
    (local.set $addr (call $ea_from_op (local.get $op)))
    (local.set $mtype (i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 0xF)))
    (local.set $mval (call $gl32 (local.get $addr)))
    (if (i32.eq (local.get $mtype) (i32.const 0)) ;; MUL
      (then (local.set $val64 (i64.mul (i64.extend_i32_u (i32.load offset=0 (global.get $reg_base))) (i64.extend_i32_u (local.get $mval))))
            (i32.store offset=0 (global.get $reg_base) (i32.wrap_i64 (local.get $val64)))
            (i32.store offset=8 (global.get $reg_base) (i32.wrap_i64 (i64.shr_u (local.get $val64) (i64.const 32))))
            (call $set_flags_mul (i32.ne (i32.load offset=8 (global.get $reg_base)) (i32.const 0)))))
    (if (i32.eq (local.get $mtype) (i32.const 1)) ;; IMUL
      (then (local.set $val64 (i64.mul (i64.extend_i32_s (i32.load offset=0 (global.get $reg_base))) (i64.extend_i32_s (local.get $mval))))
            (i32.store offset=0 (global.get $reg_base) (i32.wrap_i64 (local.get $val64)))
            (i32.store offset=8 (global.get $reg_base) (i32.wrap_i64 (i64.shr_s (local.get $val64) (i64.const 32))))
            (call $set_flags_mul (i32.ne (i32.load offset=8 (global.get $reg_base)) (i32.shr_s (i32.load offset=0 (global.get $reg_base)) (i32.const 31))))))
    ;; DIV/IDIV here must match $th_div_m32/$th_idiv_m32 exactly: same divide
    ;; signedness, same #DE code, same quotient-range check. IDIV divided
    ;; unsignedly for years, so any `idiv [base+disp]` with a negative operand
    ;; silently returned 0 -- that is what flattened MSPaint's round brush on
    ;; every stroke heading up or left.
    (if (i32.eq (local.get $mtype) (i32.const 2)) ;; DIV
      (then (local.set $divisor (i64.extend_i32_u (local.get $mval)))
            (local.set $dividend (i64.or (i64.extend_i32_u (i32.load offset=0 (global.get $reg_base)))
              (i64.shl (i64.extend_i32_u (i32.load offset=8 (global.get $reg_base))) (i64.const 32))))
            (if (i64.eqz (local.get $divisor)) (then (call $raise_exception (i32.const 0xC0000094)) (return)))
            (local.set $quotient (i64.div_u (local.get $dividend) (local.get $divisor)))
            (if (i64.gt_u (local.get $quotient) (i64.const 0xFFFFFFFF))
              (then (call $raise_exception (i32.const 0xC0000094)) (return)))
            (i32.store offset=0 (global.get $reg_base) (i32.wrap_i64 (local.get $quotient)))
            (i32.store offset=8 (global.get $reg_base) (i32.wrap_i64 (i64.rem_u (local.get $dividend) (local.get $divisor))))))
    (if (i32.eq (local.get $mtype) (i32.const 3)) ;; IDIV
      (then (local.set $divisor (i64.extend_i32_s (local.get $mval)))
            (local.set $dividend (i64.or (i64.extend_i32_u (i32.load offset=0 (global.get $reg_base)))
              (i64.shl (i64.extend_i32_u (i32.load offset=8 (global.get $reg_base))) (i64.const 32))))
            (if (i32.or (i64.eqz (local.get $divisor))
                        (i32.and (i64.eq (local.get $divisor) (i64.const -1))
                                 (i64.eq (local.get $dividend) (i64.shl (i64.const 1) (i64.const 63)))))
              (then (call $raise_exception (i32.const 0xC0000094)) (return)))
            (local.set $quotient (i64.div_s (local.get $dividend) (local.get $divisor)))
            (if (i32.or (i64.gt_s (local.get $quotient) (i64.const 0x7FFFFFFF))
                        (i64.lt_s (local.get $quotient) (i64.const -2147483648)))
              (then (call $raise_exception (i32.const 0xC0000094)) (return)))
            (i32.store offset=0 (global.get $reg_base) (i32.wrap_i64 (local.get $quotient)))
            (i32.store offset=8 (global.get $reg_base) (i32.wrap_i64 (i64.rem_s (local.get $dividend) (local.get $divisor))))))
            (dispatch-next))

  ;; 424: a whole run-length sprite blit ROW. Caesar III's decoder at 0x40f71c
  ;; is a loop nest, not a self-loop, so neither the Design-A matcher in
  ;; 07b-loop-match.wat nor a straight-line scan can see it:
  ;;
  ;;   head:  cmp C, imm / jle EXIT          <- 934k entries in a 400-batch window
  ;;          mov T8, [S]                    <- the token byte
  ;;          cmp T8,imm / jz case   x N     <- folded on its own by 423
  ;;   caseK: mov X,[S+d] / mov [D+d],X  (k times, branch-free)
  ;;          add S,a / add D,b / sub C,c / jmp head
  ;;   0xff:  n = [S+1]; D += 2n; S += 2; C -= n     (transparent run)
  ;;
  ;; 34.7% of all dispatches in a gameplay window, at ~21 dispatches and ~3.4
  ;; painted pixels per token. This runs the whole row in one dispatch.
  ;;
  ;; Descriptor at $ip: [exit_eip][cmp_imm][head_cost][head_eip] then N+1
  ;; 8-word case records, the last being the ladder's default. $op packs
  ;; S | D<<4 | C<<8 | T<<12 | N<<16.
  ;;
  ;; Every field is *replayed*, never inferred: the decoder read each body's
  ;; displacements and its three literal advances out of the instruction
  ;; stream and checked them for contiguity, so copying $bytes and adding
  ;; $src_adv is by construction what the unrolled instructions did.
  (func $th_rle_run (param $op i32)
    (local $tp i32) (local $desc i32) (local $n i32)
    (local $S i32) (local $D i32) (local $C i32) (local $T i32)
    (local $s i32) (local $d i32) (local $c i32) (local $x i32)
    (local $exit_eip i32) (local $cmp_imm i32) (local $head i32)
    (local $head_eip i32) (local $tok i32) (local $i i32) (local $hit i32)
    (local $walked i32) (local $p i32) (local $kind i32) (local $insn i32)
    (local $src i32) (local $dst i32) (local $nb i32) (local $cnt i32)
    (local $cost i32) (local $iters i32)
    (local.set $tp (global.get $ip))
    (local.set $n (i32.and (i32.shr_u (local.get $op) (i32.const 16)) (i32.const 0xFF)))
    (local.set $exit_eip (i32.load          (local.get $tp)))
    (local.set $cmp_imm  (i32.load offset=4  (local.get $tp)))
    (local.set $head     (i32.load offset=8  (local.get $tp)))
    (local.set $head_eip (i32.load offset=12 (local.get $tp)))
    (local.set $desc (i32.add (local.get $tp) (i32.const 16)))
    (global.set $ip (i32.add (local.get $desc)
      (i32.shl (i32.add (local.get $n) (i32.const 1)) (i32.const 5))))

    (local.set $S (i32.and                  (local.get $op)                    (i32.const 0xF)))
    (local.set $D (i32.and (i32.shr_u (local.get $op) (i32.const 4))  (i32.const 0xF)))
    (local.set $C (i32.and (i32.shr_u (local.get $op) (i32.const 8))  (i32.const 0xF)))
    (local.set $T (i32.and (i32.shr_u (local.get $op) (i32.const 12)) (i32.const 0xF)))
    (local.set $s (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $S) (i32.const 2)))))
    (local.set $d (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $D) (i32.const 2)))))
    (local.set $c (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $C) (i32.const 2)))))
    (local.set $x (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $T) (i32.const 2)))))

    (block $done (loop $tokl
      ;; the head: cmp C,imm / jle EXIT
      (br_if $done (i32.le_s (local.get $c) (local.get $cmp_imm)))
      ;; A row is bounded by the guest's own counter, but a descriptor whose
      ;; skip run reads a zero count would spin here forever where the x86
      ;; would too. Park at the head instead -- resuming there is exactly
      ;; equivalent, and it hands the scheduler back a turn.
      (local.set $iters (i32.add (local.get $iters) (i32.const 1)))
      (if (i32.gt_u (local.get $iters) (i32.const 4096))
        (then
          (local.set $exit_eip (local.get $head_eip))
          (br $done)))

      (local.set $tok (call $gl8 (local.get $s)))
      ;; the head's `mov T8,[S]` writes only the low byte
      (local.set $x (i32.or (i32.and (local.get $x) (i32.const 0xFFFFFF00))
                            (local.get $tok)))

      ;; the ladder, walked linearly because that is what the x86 pays for
      (local.set $hit (local.get $n))
      (local.set $i (i32.const 0))
      (block $found (loop $l
        (br_if $found (i32.ge_u (local.get $i) (local.get $n)))
        (if (i32.eq (i32.load
              (i32.add (local.get $desc) (i32.shl (local.get $i) (i32.const 5))))
              (local.get $tok))
          (then (local.set $hit (local.get $i)) (br $found)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $l)))
      (local.set $walked (if (result i32) (i32.eq (local.get $hit) (local.get $n))
        (then (local.get $n)) (else (i32.add (local.get $hit) (i32.const 1)))))

      (local.set $p (i32.add (local.get $desc) (i32.shl (local.get $hit) (i32.const 5))))
      (local.set $kind (i32.load offset=4 (local.get $p)))
      (local.set $insn (i32.shr_u (local.get $kind) (i32.const 16)))

      (if (i32.and (local.get $kind) (i32.const 0xFF))
        (then
          ;; transparent run: n = [S + cnt_off]; D += n*mul; S += adv; C -= n
          (local.set $cnt (call $gl8
            (i32.add (local.get $s) (i32.load offset=8 (local.get $p)))))
          (local.set $x (local.get $cnt))
          (local.set $d (i32.add (local.get $d)
            (i32.mul (local.get $cnt) (i32.load offset=16 (local.get $p)))))
          (local.set $s (i32.add (local.get $s) (i32.load offset=20 (local.get $p))))
          (local.set $c (i32.sub (local.get $c) (local.get $cnt))))
        (else
          ;; literal run: the k unrolled load/store pairs, in order
          (local.set $src (i32.add (local.get $s) (i32.load offset=8  (local.get $p))))
          (local.set $dst (i32.add (local.get $d) (i32.load offset=12 (local.get $p))))
          (local.set $nb  (i32.load offset=16 (local.get $p)))
          (block $cdone (loop $cl
            (br_if $cdone (i32.lt_u (local.get $nb) (i32.const 4)))
            (local.set $x (call $gl32 (local.get $src)))
            (call $gs32 (local.get $dst) (local.get $x))
            (local.set $src (i32.add (local.get $src) (i32.const 4)))
            (local.set $dst (i32.add (local.get $dst) (i32.const 4)))
            (local.set $nb (i32.sub (local.get $nb) (i32.const 4)))
            (br $cl)))
          ;; an odd pixel at the end is a 16-bit pair, and it writes only AX
          (if (local.get $nb)
            (then
              (local.set $x (i32.or (i32.and (local.get $x) (i32.const 0xFFFF0000))
                                    (call $gl16 (local.get $src))))
              (call $gs16 (local.get $dst) (local.get $x))))
          (local.set $s (i32.add (local.get $s) (i32.load offset=20 (local.get $p))))
          (local.set $d (i32.add (local.get $d) (i32.load offset=24 (local.get $p))))
          (local.set $c (i32.sub (local.get $c) (i32.load offset=28 (local.get $p))))))

      ;; Pacing, both meters, same contract as 420-423: what this dispatch
      ;; swallowed is what the folded form must still be billed for, or a
      ;; batch buys more guest work here than it does with the fold off and
      ;; the two builds stop being comparable at a fixed batch number.
      ;; Per token: head cmp+jle+mov (3), the ladder's cmp/jz pairs (2 each,
      ;; which is what 423 bills), and the body's own dispatches.
      (local.set $cost (i32.add (local.get $cost)
        (i32.add (i32.add (local.get $head) (local.get $insn))
                 (i32.shl (local.get $walked) (i32.const 1)))))
      ;; three block ends a token: the head, the ladder block, the body.
      (global.set $block_budget (i32.sub (global.get $block_budget) (i32.const 3)))
      (br $tokl)))

    ;; the final cmp that fell out of the loop is billed too; $next billed one.
    (global.set $steps (i32.sub (global.get $steps)
      (i32.add (local.get $cost) (i32.const 1))))

    (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $S) (i32.const 2))) (local.get $s))
    (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $D) (i32.const 2))) (local.get $d))
    (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $C) (i32.const 2))) (local.get $c))
    (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $T) (i32.const 2))) (local.get $x))
    ;; Flags are the head's `cmp C,imm` -- the only ones that survive the loop,
    ;; exactly as every body's `sub C,c` is overwritten by the next head.
    (call $set_flags_sub (local.get $c) (local.get $cmp_imm)
      (i32.sub (local.get $c) (local.get $cmp_imm)))
    (global.set $flag_sign_shift (i32.const 31))
    (global.set $eip (local.get $exit_eip))
    (return_call $branch_end))

  ;; A handler slot whose game-specific fold was retired because the uop tier
  ;; runs the same loop at least as fast (docs/uop-tier-design.md section 18).
  ;; The decoder never emits it; the slot stays so every later handler index
  ;; keeps its number.
  (func $th_retired_fold (param $op i32)
    (unreachable))

  ;; 466: PKWARE implode's two match-extension loops, run to their exit.
  ;; op 0 -- `inc esi / cmp esi,0x204 / jge X / mov ebp,[esp+0x2c] /
  ;;          inc dword [esp+0x14] / mov edx,[esp+0x14] / mov bl,[edx] /
  ;;          cmp [ebp+esi],bl / jz head`
  ;; op 1 -- `mov dl,[ecx+1] / inc esi / inc ecx / cmp [esi],dl / jnz X /
  ;;          inc ebx / cmp ebx,0x204 / jl head`
  ;; Every guest load and store happens in the guest's order each iteration,
  ;; so aliasing behaves as on hardware; flags are those of the compare that
  ;; took the exit, set through the same helpers the unfolded handlers use.
  ;; Both loops are bounded by the 0x204 compare, so one dispatch is at most
  ;; 516 iterations. Thread words: head eip, exit eip.
  ;; The registers, the frame displacements and the match bound all come from
  ;; the op, because $try_emit_implode_cmp_run reads them out of the encoding
  ;; rather than pinning one build's allocation. The quadruple is the same for
  ;; both forms: I is the index that walks the window, V the byte register the
  ;; compare reads, and X/Y are the two form-specific cursors --
  ;;   form 0: X = the window base reloaded from [esp+d1], Y = the candidate
  ;;           cursor reloaded from the frame slot [esp+d2], d3 the compare's
  ;;           own displacement;
  ;;   form 1: X = the candidate cursor in a register, Y = the match length,
  ;;           d1 the displacement of the byte peek, d2/d3 unused.
  (func $th_implode_cmp_run (param $op i32)
    (local $tp i32) (local $exit_eip i32) (local $esp i32) (local $regs i32)
    (local $limit i32) (local $d1 i32) (local $d2 i32) (local $d3 i32)
    (local $ri i32) (local $rx i32) (local $ry i32) (local $rv i32)
    (local $I i32) (local $X i32) (local $Y i32) (local $V i32)
    (local $t i32) (local $b i32) (local $m i32)
    (local $iters i32) (local $blocks i32) (local $cost i32)
    (local.set $tp (global.get $ip))
    (local.set $exit_eip (i32.load offset=4  (local.get $tp)))
    (local.set $regs     (i32.load offset=8  (local.get $tp)))
    (local.set $limit    (i32.load offset=12 (local.get $tp)))
    (local.set $d1       (i32.load offset=16 (local.get $tp)))
    (local.set $d2       (i32.load offset=20 (local.get $tp)))
    (local.set $d3       (i32.load offset=24 (local.get $tp)))
    (global.set $ip (i32.add (local.get $tp) (i32.const 28)))
    (local.set $ri (i32.and             (local.get $regs)                    (i32.const 0xF)))
    (local.set $rx (i32.and (i32.shr_u  (local.get $regs) (i32.const 4))     (i32.const 0xF)))
    (local.set $ry (i32.and (i32.shr_u  (local.get $regs) (i32.const 8))     (i32.const 0xF)))
    (local.set $rv (i32.and (i32.shr_u  (local.get $regs) (i32.const 12))    (i32.const 0xF)))
    (local.set $I (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $ri) (i32.const 2)))))
    (local.set $X (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $rx) (i32.const 2)))))
    (local.set $Y (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $ry) (i32.const 2)))))
    (local.set $V (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $rv) (i32.const 2)))))
    (if (i32.eqz (local.get $op))
      (then
        (local.set $esp (i32.load (i32.add (global.get $reg_base) (i32.shl (i32.const 4) (i32.const 2)))))
        (block $done (loop $iter
          ;; inc I / cmp I,LIMIT / jge exit
          (local.set $I (i32.add (local.get $I) (i32.const 1)))
          (local.set $blocks (i32.add (local.get $blocks) (i32.const 1)))
          (local.set $cost (i32.add (local.get $cost) (i32.const 3)))
          (if (i32.ge_s (local.get $I) (local.get $limit))
            (then
              (drop (call $do_alu32 (i32.const 7) (local.get $I) (local.get $limit)))
              (br $done)))
          ;; mov X,[esp+d1] / inc dword [esp+d2] / mov Y,[esp+d2]
          (local.set $X (call $gl32 (i32.add (local.get $esp) (local.get $d1))))
          (local.set $t (i32.add (call $gl32 (i32.add (local.get $esp) (local.get $d2)))
                                 (i32.const 1)))
          (call $gs32 (i32.add (local.get $esp) (local.get $d2)) (local.get $t))
          (local.set $Y (call $gl32 (i32.add (local.get $esp) (local.get $d2))))
          ;; mov V8,[Y] / cmp [X+I+d3],V8 / jz head
          (local.set $b (call $gl8 (local.get $Y)))
          (local.set $V (i32.or (i32.and (local.get $V) (i32.const 0xFFFFFF00))
                                (local.get $b)))
          (local.set $m (call $gl8 (i32.add (i32.add (local.get $X) (local.get $I))
                                            (local.get $d3))))
          (drop (call $do_alu_sized (i32.const 7) (local.get $m) (local.get $b)
                  (i32.const 0xFF) (i32.const 7)))
          (local.set $blocks (i32.add (local.get $blocks) (i32.const 1)))
          (local.set $cost (i32.add (local.get $cost) (i32.const 6)))
          (local.set $iters (i32.add (local.get $iters) (i32.const 1)))
          (br_if $iter (i32.eq (local.get $m) (local.get $b))))))
      (else
        (block $done (loop $iter
          ;; mov V8,[X+d1] / inc I / inc X / cmp [I],V8 / jnz exit
          (local.set $b (call $gl8 (i32.add (local.get $X) (local.get $d1))))
          (local.set $V (i32.or (i32.and (local.get $V) (i32.const 0xFFFFFF00))
                                (local.get $b)))
          (local.set $I (i32.add (local.get $I) (i32.const 1)))
          (local.set $X (i32.add (local.get $X) (i32.const 1)))
          (local.set $m (call $gl8 (local.get $I)))
          (drop (call $do_alu_sized (i32.const 7) (local.get $m) (local.get $b)
                  (i32.const 0xFF) (i32.const 7)))
          (local.set $blocks (i32.add (local.get $blocks) (i32.const 1)))
          (local.set $cost (i32.add (local.get $cost) (i32.const 5)))
          (local.set $iters (i32.add (local.get $iters) (i32.const 1)))
          (br_if $done (i32.ne (local.get $m) (local.get $b)))
          ;; inc Y / cmp Y,LIMIT / jl head
          (local.set $Y (i32.add (local.get $Y) (i32.const 1)))
          (drop (call $do_alu32 (i32.const 7) (local.get $Y) (local.get $limit)))
          (local.set $blocks (i32.add (local.get $blocks) (i32.const 1)))
          (local.set $cost (i32.add (local.get $cost) (i32.const 3)))
          (br_if $iter (i32.lt_s (local.get $Y) (local.get $limit)))))))
    (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $ri) (i32.const 2))) (local.get $I))
    (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $rx) (i32.const 2))) (local.get $X))
    (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $ry) (i32.const 2))) (local.get $Y))
    (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $rv) (i32.const 2))) (local.get $V))
    (global.set $block_budget (i32.sub (global.get $block_budget) (local.get $blocks)))
    (global.set $steps (i32.sub (global.get $steps) (i32.add (local.get $cost) (i32.const 1))))
    (global.set $implode_cmp_run_runs (i32.add (global.get $implode_cmp_run_runs) (i32.const 1)))
    (global.set $implode_cmp_run_iters
      (i64.add (global.get $implode_cmp_run_iters) (i64.extend_i32_u (local.get $iters))))
    (global.set $eip (local.get $exit_eip))
    (return_call $branch_end))

  ;; 469: a block whose entry is zero bytes (see the guard in $decode_block).
  ;; `00 00` is `add [eax],al`; with EAX unmapped that faults, so raise the
  ;; access violation at the entry exactly as the CPU would. A mapped EAX would
  ;; run on through the zeros, which is never real code: keep the diagnostic.
  (func $th_zero_entry (param $op i32)
    (global.set $eip (local.get $op))
    (if (i32.eqz (call $guest_addr_mapped (i32.load offset=0 (global.get $reg_base))))
      (then
        (global.set $fault_address (i32.load offset=0 (global.get $reg_base)))
        (call $raise_exception (i32.const 0xC0000005))
        (return)))
    (call $host_log_i32 (i32.const 0xCA002E20))  ;; execution entered zeros
    (call $host_log_i32 (local.get $op))
    (call $host_log_i32 (global.get $dbg_prev2_eip))
    (unreachable))
