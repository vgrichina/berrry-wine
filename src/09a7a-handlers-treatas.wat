;; OLE class emulation. Registry work runs on the existing storage owner;
;; redirected activation uses a private guest-stack copy, including across
;; DLL-load yields, nested constructors and registered class factories.
(import "host" "com_treat_as_class"
  (func $host_com_treat_as_class (param i32 i32 i32) (result i32)))
(global $com_treatas_return_thunk (mut i32) (i32.const 0))

(func $handle_CoTreatAsClass (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
  (local $hr i32)
  (local.set $hr (i32.const 0x80070057))
  (if (i32.and (i32.ne (local.get $arg0) (i32.const 0)) (i32.ne (local.get $arg1) (i32.const 0)))
    (then (local.set $hr (call $host_com_treat_as_class
      (call $g2w (local.get $arg0)) (call $g2w (local.get $arg1)) (i32.const 0)))))
  (i32.store offset=0 (global.get $reg_base) (local.get $hr))
  (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

(func $handle_CoGetTreatAsClass (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
  (local $hr i32)
  (local.set $hr (i32.const 0x80070057))
  (if (i32.and (i32.ne (local.get $arg0) (i32.const 0)) (i32.ne (local.get $arg1) (i32.const 0)))
    (then (local.set $hr (call $host_com_treat_as_class
      (call $g2w (local.get $arg0)) (call $g2w (local.get $arg1)) (i32.const 1)))))
  (i32.store offset=0 (global.get $reg_base) (local.get $hr))
  (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

;; E' = E-40: [continuation, targetGUID*, arg1..arg4, targetGUID(16)].
;; The ordinary API completes at E'+24; continuation restores E+24 and [E].
;; The original input GUID and all normal activation frames stay untouched.
(func $com_treatas_redirect (param $clsid i32) (param $out i32) (result i32)
  (local $e i32) (local $f i32) (local $hr i32) (local $i i32)
  (if (i32.eqz (local.get $clsid)) (then (return (i32.const 0))))
  (local.set $e (i32.load offset=16 (global.get $reg_base)))
  (local.set $f (i32.sub (local.get $e) (i32.const 40)))
  (local.set $hr (call $host_com_treat_as_class (call $g2w (local.get $clsid))
    (call $g2w (i32.sub (local.get $e) (i32.const 16))) (i32.const 2)))
  (if (i32.eq (local.get $hr) (i32.const 1)) (then (return (i32.const 0))))
  (if (local.get $hr) (then
    (if (local.get $out) (then (call $gs32 (local.get $out) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (local.get $hr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (local.get $e) (i32.const 24)))
    (return (i32.const 1))))
  (if (i32.eqz (global.get $com_treatas_return_thunk))
    (then (global.set $com_treatas_return_thunk (call $com_cont_thunk (i32.const 0xCACA0041)))))
  (call $gs32 (local.get $f) (global.get $com_treatas_return_thunk))
  (call $gs32 (i32.add (local.get $f) (i32.const 4)) (i32.sub (local.get $e) (i32.const 16)))
  (local.set $i (i32.const 8))
  (loop $copy
    (call $gs32 (i32.add (local.get $f) (local.get $i)) (call $gl32 (i32.add (local.get $e) (local.get $i))))
    (local.set $i (i32.add (local.get $i) (i32.const 4)))
    (br_if $copy (i32.lt_u (local.get $i) (i32.const 24))))
  (i32.store offset=16 (global.get $reg_base) (local.get $f))
  (call $com_jump (global.get $current_thunk_eip))
  (i32.const 1))

(func $com_treatas_after
  (local $e i32)
  (local.set $e (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  (i32.store offset=16 (global.get $reg_base) (i32.add (local.get $e) (i32.const 24)))
  (call $com_jump (call $gl32 (local.get $e))))

(func $handle_CoCreateInstance_TreatAs (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
  (if (call $com_treatas_redirect (local.get $arg0) (local.get $arg4)) (then (return)))
  (if (i32.and (i32.and (i32.ne (local.get $arg0) (i32.const 0))
                           (i32.ne (local.get $arg3) (i32.const 0)))
                (i32.ne (local.get $arg4) (i32.const 0)))
    (then
      (if (call $host_com_localserver_information (call $g2w (local.get $arg0))
            (local.get $arg2) (i32.const 0) (i32.const 0))
        (then (call $com_interface_bridge (i32.const 17) (i32.const 5)) (return)))))
  (call $handle_CoCreateInstance (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))
(func $handle_CoGetClassObject_TreatAs (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
  (local $hr i32) (local $factory i32) (local $frame i32)
  (if (call $com_treatas_redirect (local.get $arg0) (local.get $arg4)) (then (return)))
  (if (i32.and (i32.and (i32.ne (local.get $arg0) (i32.const 0))
                           (i32.ne (local.get $arg3) (i32.const 0)))
                (i32.ne (local.get $arg4) (i32.const 0)))
    (then
      (if (call $host_com_localserver_information (call $g2w (local.get $arg0))
            (local.get $arg1) (i32.const 0) (i32.const 0))
        (then (call $com_interface_bridge (i32.const 18) (i32.const 5)) (return)))))
  ;; Resolve only the current process's registration. The actual requested
  ;; QueryInterface runs on the calling CPU, with its own activation frame,
  ;; so a blocking factory never borrows an idle host shadow's registers.
  (if (i32.and (i32.and (i32.ne (local.get $arg0) (i32.const 0)) (i32.ne (local.get $arg3) (i32.const 0))) (i32.ne (local.get $arg4) (i32.const 0)))
    (then
      (local.set $hr (call $host_com_create_instance
        (call $g2w (local.get $arg0)) (local.get $arg2)
        (i32.or (local.get $arg1) (i32.const 0xE0000000))
        (call $g2w (local.get $arg3)) (local.get $arg4)))
      (if (i32.eq (local.get $hr) (i32.const 3))
        (then
          (local.set $factory (call $gl32 (local.get $arg4)))
          (local.set $frame (call $com_activate_frame_begin (local.get $arg4)))
          ;; The existing class-only return frame owns QI's output at F.
          (call $gs32 (i32.add (local.get $frame) (i32.const 4)) (i32.const 0))
          (call $io_apc_push (local.get $frame))
          (call $io_apc_push (local.get $arg3))
          (call $io_apc_push (local.get $factory))
          (call $io_apc_push (global.get $com_gco_thunk))
          (call $com_jump (call $gl32 (call $gl32 (local.get $factory))))
          (return)))))
  (call $handle_CoGetClassObject (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))
