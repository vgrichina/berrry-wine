 139: OffsetRect — STUB: unimplemented
  (func $handle_OffsetRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; OffsetRect(lprc, dx, dy) → BOOL. Moves rect by (dx, dy)
    ;; RECT: left, top, right, bottom (4 DWORDs)
    (local $wa i32)
    (local.set $wa (call $g2w (local.get $arg0)))
    (store.field Rect left (local.get $wa) (i32.add (load.field Rect left (local.get $wa)) (local.get $arg1)))                        ;; left += dx
    (store.field Rect top (local.get $wa) (i32.add (load.field Rect top (local.get $wa)) (local.get $arg2)))  ;; top += dy
    (store.field Rect right (local.get $wa) (i32.add (load.field Rect right (local.get $wa)) (local.get $arg1)))  ;; right += dx
    (store.field Rect bottom (local.get $wa) (i32.add (load.field Rect bottom (local.get $wa)) (local.get $arg2))) ;; bottom += dy
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))  ;; stdcall, 3 args
  )

  ;; 140: MapWindowPoints(hWndFrom, hWndTo, lpPoints, cPoints) → int
  ;; Translate an array of POINTs from hWndFrom's client space into hWndTo's.
  ;; hWndFrom/hWndTo==NULL means screen coordinates. Return packs dx/dy in
  ;; signed 16-bit halves, matching the Win32 contract.
  (func $handle_MapWindowPoints (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dx i32) (local $dy i32)
    (local $i i32) (local $p i32)
    (local.set $dx (i32.sub
      (call $wnd_client_screen_x (local.get $arg0))
      (call $wnd_client_screen_x (local.get $arg1))))
    (local.set $dy (i32.sub
      (call $wnd_client_screen_y (local.get $arg0))
      (call $wnd_client_screen_y (local.get $arg1))))
    ;; Apply to each POINT (or RECT = 2 POINTs, caller picks cPoints)
    (local.set $i (i32.const 0))
    (local.set $p (call $g2w (local.get $arg2)))
    (block $apply_done (loop $apply
      (br_if $apply_done (i32.ge_u (local.get $i) (local.get $arg3)))
      (store.field Point x (local.get $p)
        (i32.add (load.field Point x (local.get $p)) (local.get $dx)))
      (store.field.memarg Point y (local.get $p)
        (i32.add (load.field.memarg Point y (local.get $p)) (local.get $dy)))
      (local.set $p (i32.add (local.get $p) (i32.const 8)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $apply)))
    (i32.store offset=0 (global.get $reg_base) (i32.or (i32.and (local.get $dx) (i32.const 0xFFFF))
                             (i32.shl (local.get $dy) (i32.const 16))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; 141: SetWindowPos
  ;; WINDOWPOS structs handed to guest wndprocs by $windowpos_notify. These are
  ;; guest-visible, so they come from $heap_alloc (which returns guest
  ;; addresses) rather than one of the emulator-private scratch regions, which
  ;; live outside the g2w window and cannot be dereferenced by the guest.
  ;;
  ;; A wndproc handling WM_WINDOWPOSCHANGED routinely calls SetWindowPos again
  ;; — VCL does it while laying out children — so a single shared struct would
  ;; be rewritten underneath an outer frame that still holds the pointer. The
  ;; depth counter picks the slot and bounds the recursion in one move.
  ;; Base of the wndproc markers GetClassInfo hands out for USER's own control
  ;; classes; the low byte carries the $control_wndproc_dispatch class id.
  ;; Sits in the same reserved 0xFFFE_xxxx space as $WNDPROC_BUILTIN.
  (global $WNDPROC_SYSCLASS i32 (i32.const 0xFFFE0100))

  ;; Native control kind K, as a wndproc value: what GetWindowLong(GWL_WNDPROC)
  ;; shows for an unsubclassed native control. On Windows that value is the
  ;; control's real code in USER, and an app may build a class on it:
  ;; Civilization II MGE creates a throwaway EDIT, reads its GWL_WNDPROC,
  ;; registers "MSEditBoxClass" with it and makes its name fields from that.
  ;; The generic $WNDPROC_CTRL_NATIVE says nothing about which control it was,
  ;; so those fields came up with no edit state and swallowed every keystroke.
  ;; This marker is never stored as a window's proc -- SetWindowLong,
  ;; CreateWindowEx, dialog creation and CallWindowProc turn it back into
  ;; $WNDPROC_CTRL_NATIVE -- so it dispatches exactly as that marker does,
  ;; unlike $WNDPROC_SYSCLASS, whose chained calls route notifications as tail
  ;; calls for a window USER never classified.
  (global $WNDPROC_CTRL_KIND i32 (i32.const 0xFFFF0100))

  (func $wndproc_public (param $hwnd i32) (param $proc i32) (result i32)
    (local $class i32)
    (if (i32.ne (local.get $proc) (global.get $WNDPROC_CTRL_NATIVE)) (then (return (local.get $proc))))
    (local.set $class (call $ctrl_table_get_class (local.get $hwnd)))
    (if (i32.or (i32.eqz (local.get $class)) (i32.gt_u (local.get $class) (i32.const 0xFF)))
      (then (return (local.get $proc))))
    (i32.or (global.get $WNDPROC_CTRL_KIND) (local.get $class)))

  ;; The control kind a $WNDPROC_CTRL_KIND marker names, or 0 for any other value.
  (func $wndproc_ctrl_kind (param $proc i32) (result i32)
    (if (result i32) (i32.eq (i32.and (local.get $proc) (i32.const 0xFFFFFF00)) (global.get $WNDPROC_CTRL_KIND))
      (then (i32.and (local.get $proc) (i32.const 0xFF)))
      (else (i32.const 0))))

  ;; HWND is now run by native control KIND: classify it if nothing has, and
  ;; give it the creation the native control missed.
  (func $wndproc_adopt_ctrl_kind (param $hwnd i32) (param $kind i32)
    (local $slot i32)
    (if (call $ctrl_table_get_class (local.get $hwnd)) (then (return)))
    (local.set $slot (call $wnd_table_find (local.get $hwnd)))
    (if (i32.eq (local.get $slot) (i32.const -1)) (then (return)))
    (call $ctrl_table_set (local.get $slot) (local.get $kind)
      (call $ctrl_table_get_id (local.get $hwnd)))
    (call $sysclass_replay_create (local.get $hwnd) (local.get $slot)))

  ;; Give a newly adopted control the WM_CREATE it never received.
  ;;
  ;; Every control proc allocates its state block in WM_CREATE, and a window
  ;; created under the app's own class name never had one routed to it. Left
  ;; alone the state pointer stays NULL and the procs then read and write
  ;; through guest address zero -- which superficially works, because both
  ;; sides use the same bad pointer, while quietly corrupting low guest
  ;; memory. Replaying creation is also how the control learns its id, caption
  ;; and button kind, none of which it can recover later.
  (global $sysclass_cs (mut i32) (i32.const 0))
  (func $sysclass_replay_create (param $hwnd i32) (param $slot i32)
    (local $cs i32) (local $cs_w i32) (local $name i32) (local $geom i32)
    (if (i32.eqz (global.get $sysclass_cs))
      ;; 48-byte CREATESTRUCT followed by the caption it points at.
      (then (global.set $sysclass_cs (call $heap_alloc (i32.const 304)))))
    (if (i32.eqz (global.get $sysclass_cs)) (then (return)))
    (local.set $cs (global.get $sysclass_cs))
    (local.set $name (i32.add (local.get $cs) (i32.const 48)))
    (local.set $cs_w (call $g2w (local.get $cs)))
    (drop (call $host_get_window_text
      (local.get $hwnd) (call $g2w (local.get $name)) (i32.const 255)))
    (local.set $geom (call $ctrl_geom_addr (local.get $slot)))
    (i32.store           (local.get $cs_w) (i32.const 0))  ;; lpCreateParams
    (i32.store offset=4  (local.get $cs_w) (i32.const 0))  ;; hInstance
    (i32.store offset=8  (local.get $cs_w) (call $ctrl_table_get_id (local.get $hwnd)))
    (i32.store offset=12 (local.get $cs_w) (call $wnd_get_parent (local.get $hwnd)))
    (i32.store offset=16 (local.get $cs_w) (i32.load16_u offset=6 (local.get $geom)))
    (i32.store offset=20 (local.get $cs_w) (i32.load16_u offset=4 (local.get $geom)))
    (i32.store offset=24 (local.get $cs_w) (i32.load16_u offset=2 (local.get $geom)))
    (i32.store offset=28 (local.get $cs_w) (i32.load16_u (local.get $geom)))
    (i32.store offset=32 (local.get $cs_w) (call $wnd_get_style (local.get $hwnd)))
    (i32.store offset=36 (local.get $cs_w) (local.get $name))
    (i32.store offset=40 (local.get $cs_w) (i32.const 0))  ;; lpszClass
    (i32.store offset=44 (local.get $cs_w) (call $ctrl_get_ex_style (local.get $hwnd)))
    (drop (call $control_wndproc_dispatch
      (local.get $hwnd) (i32.const 0x0001) (i32.const 0) (local.get $cs))))

  (global $windowpos_ring (mut i32) (i32.const 0))
  (global $windowpos_depth (mut i32) (i32.const 0))
  (global $WINDOWPOS_SLOT i32 (i32.const 32))   ;; 28-byte struct, padded
  (global $WINDOWPOS_DEPTH_MAX i32 (i32.const 8))

  ;; DefWindowProc's sizing negotiation owns one MINMAXINFO per synchronous
  ;; invocation. Never lend a singleton struct to a reentrant guest wndproc.
  (global $windowpos_minmax_depth (mut i32) (i32.const 0))
  (func $windowpos_guest_span_valid (param $p i32) (param $n i32) (result i32)
    (local $i i32)
    (if (i32.or (i32.eqz (local.get $p))
          (i32.gt_u (local.get $p) (i32.sub (i32.const -1) (i32.sub (local.get $n) (i32.const 1)))))
      (then (return (i32.const 0))))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
      (if (i32.eq (call $g2w (i32.add (local.get $p) (local.get $i))) (global.get $NULL_SENTINEL))
        (then (return (i32.const 0))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 1))

  (func $windowpos_defproc_minmax (param $hwnd i32) (param $pos i32)
    (local $style i32) (local $info i32) (local $i i32)
    (local $min_x i32) (local $min_y i32) (local $max_x i32) (local $max_y i32)
    (local $cx i32) (local $cy i32)
    (if (i32.or (i32.lt_s (call $wnd_table_find (local.get $hwnd)) (i32.const 0))
          (i32.eqz (call $windowpos_guest_span_valid (local.get $pos) (i32.const 28))))
      (then (return)))
    (if (i32.or (i32.ne (call $gl32 (local.get $pos)) (local.get $hwnd))
          (i32.and (call $gl32 (i32.add (local.get $pos) (i32.const 24))) (i32.const 1)))
      (then (return))) ;; SWP_NOSIZE
    (local.set $style (call $wnd_get_style (local.get $hwnd)))
    ;; Overlapped windows, sizing frames, and captioned popup/child windows
    ;; receive the default minimum-size query; borderless controls do not.
    (if (i32.eqz (i32.or
          (i32.eqz (i32.and (local.get $style) (i32.const 0xC0000000)))
          (i32.or (i32.and (local.get $style) (i32.const 0x00040000))
            (i32.eq (i32.and (local.get $style) (i32.const 0x00C00000)) (i32.const 0x00C00000)))))
      (then (return)))
    ;; This sender posts far Win16 procedures asynchronously. Do not hand it
    ;; temporary storage whose lifetime ends when this near call returns.
    (if (i32.and (global.get $code16) (call $win16_is_far_proc (call $wnd_table_get (local.get $hwnd))))
      (then (return)))
    (if (i32.ge_u (global.get $windowpos_minmax_depth) (global.get $WINDOWPOS_DEPTH_MAX))
      (then (return)))
    (local.set $info (call $heap_alloc (i32.const 40)))
    (if (i32.eqz (local.get $info)) (then (return)))
    (global.set $windowpos_minmax_depth (i32.add (global.get $windowpos_minmax_depth) (i32.const 1)))
    (loop $clear
      (call $gs32 (i32.add (local.get $info) (local.get $i)) (i32.const 0))
      (local.set $i (i32.add (local.get $i) (i32.const 4)))
      (br_if $clear (i32.lt_u (local.get $i) (i32.const 40))))
    (call $gs32 (i32.add (local.get $info) (i32.const 8)) (call $screen_metric_w))
    (call $gs32 (i32.add (local.get $info) (i32.const 12)) (call $screen_work_bottom))
    (call $gs32 (i32.add (local.get $info) (i32.const 24)) (call $system_metric (i32.const 34)))
    (call $gs32 (i32.add (local.get $info) (i32.const 28)) (call $system_metric (i32.const 35)))
    (call $gs32 (i32.add (local.get $info) (i32.const 32)) (call $system_metric (i32.const 59)))
    (call $gs32 (i32.add (local.get $info) (i32.const 36)) (call $system_metric (i32.const 60)))
    (drop (call $wnd_send_message (local.get $hwnd) (i32.const 0x0024) (i32.const 0) (local.get $info)))
    (block $release
      ;; An incomplete bounded callback is not a valid MINMAXINFO response.
      (br_if $release (i32.eqz (global.get $wnd_send_completed)))
      (br_if $release (i32.lt_s (call $wnd_table_find (local.get $hwnd)) (i32.const 0)))
      (br_if $release (i32.eqz (call $windowpos_guest_span_valid (local.get $pos) (i32.const 28))))
      (br_if $release (i32.eqz (call $windowpos_guest_span_valid (local.get $info) (i32.const 40))))
      (br_if $release (i32.ne (call $gl32 (local.get $pos)) (local.get $hwnd)))
      (br_if $release (i32.and (call $gl32 (i32.add (local.get $pos) (i32.const 24))) (i32.const 1)))
      (local.set $min_x (call $gl32 (i32.add (local.get $info) (i32.const 24))))
      (local.set $min_y (call $gl32 (i32.add (local.get $info) (i32.const 28))))
      (local.set $max_x (call $gl32 (i32.add (local.get $info) (i32.const 32))))
      (local.set $max_y (call $gl32 (i32.add (local.get $info) (i32.const 36))))
      ;; Malformed limits are not dimensions: leave the proposal untouched.
      (br_if $release (i32.or (i32.lt_s (local.get $min_x) (i32.const 0)) (i32.lt_s (local.get $min_y) (i32.const 0))))
      (br_if $release (i32.or (i32.lt_s (local.get $max_x) (local.get $min_x)) (i32.lt_s (local.get $max_y) (local.get $min_y))))
      (local.set $cx (call $gl32 (i32.add (local.get $pos) (i32.const 16))))
      (local.set $cy (call $gl32 (i32.add (local.get $pos) (i32.const 20))))
      (local.set $cx (select (local.get $min_x) (local.get $cx) (i32.lt_s (local.get $cx) (local.get $min_x))))
      (local.set $cy (select (local.get $min_y) (local.get $cy) (i32.lt_s (local.get $cy) (local.get $min_y))))
      (call $gs32 (i32.add (local.get $pos) (i32.const 16))
        (select (local.get $max_x) (local.get $cx) (i32.gt_s (local.get $cx) (local.get $max_x))))
      (call $gs32 (i32.add (local.get $pos) (i32.const 20))
        (select (local.get $max_y) (local.get $cy) (i32.gt_s (local.get $cy) (local.get $max_y)))))
    (call $heap_free (local.get $info))
    (global.set $windowpos_minmax_depth (i32.sub (global.get $windowpos_minmax_depth) (i32.const 1))))

  ;; Allocate one reentrant guest-visible WINDOWPOS and send the mutable
  ;; WM_WINDOWPOSCHANGING half of USER's positioning transaction. The same
  ;; slot remains live until $windowpos_message_end sends WM_WINDOWPOSCHANGED,
  ;; so nested SetWindowPos calls cannot rewrite the outer wndproc's lParam.
  ;; SWP_NOSENDCHANGING suppresses only the first message.
  (func $windowpos_message_begin
    (param $hwnd i32) (param $insert_after i32) (param $x i32) (param $y i32)
    (param $cx i32) (param $cy i32) (param $flags i32) (result i32)
    (local $wp i32) (local $slot i32) (local $w i32)
    (local.set $wp (call $wnd_table_get (local.get $hwnd)))
    (if (i32.eqz (local.get $wp)) (then (return (i32.const 0))))
    ;; 0xFFFE_xxxx values are emulator markers, not callable procedures. WAT
    ;; wndprocs live at 0xFFFF_xxxx and are safe through $wnd_send_message.
    (if (i32.and
          (i32.ge_u (local.get $wp) (i32.const 0xFFFE0000))
          (i32.lt_u (local.get $wp) (i32.const 0xFFFF0000)))
      (then (return (i32.const 0))))
    ;; The Win16 far-procedure path constructs its own Pascal message frames;
    ;; this 32-bit stdcall sender cannot keep a queued WINDOWPOS alive for it.
    (if (i32.and
          (i32.ne (global.get $code16) (i32.const 0))
          (call $win16_is_far_proc (local.get $wp)))
      (then (return (i32.const 0))))
    (if (i32.ge_u (global.get $windowpos_depth) (global.get $WINDOWPOS_DEPTH_MAX))
      (then (return (i32.const 0))))
    (if (i32.eqz (global.get $windowpos_ring))
      (then
        (global.set $windowpos_ring (call $heap_alloc
          (i32.mul (global.get $WINDOWPOS_SLOT) (global.get $WINDOWPOS_DEPTH_MAX))))))
    (if (i32.eqz (global.get $windowpos_ring))
      (then (return (i32.const 0))))
    (local.set $slot (i32.add (global.get $windowpos_ring)
      (i32.mul (global.get $windowpos_depth) (global.get $WINDOWPOS_SLOT))))
    (local.set $w (call $g2w (local.get $slot)))
    (i32.store (local.get $w) (local.get $hwnd))
    (i32.store offset=4 (local.get $w) (local.get $insert_after))
    (i32.store offset=8 (local.get $w) (local.get $x))
    (i32.store offset=12 (local.get $w) (local.get $y))
    (i32.store offset=16 (local.get $w) (local.get $cx))
    (i32.store offset=20 (local.get $w) (local.get $cy))
    (i32.store offset=24 (local.get $w) (local.get $flags))
    (global.set $windowpos_depth (i32.add (global.get $windowpos_depth) (i32.const 1)))
    (if (i32.eqz (i32.and (local.get $flags) (i32.const 0x0400))) ;; !SWP_NOSENDCHANGING
      (then
        (drop (call $wnd_send_message
          (local.get $hwnd) (i32.const 0x0046) (i32.const 0) (local.get $slot)))))
    (local.get $slot))

  ;; Publish the final values through the same WINDOWPOS before the changed
  ;; notification. Mutating this second message has no effect because USER has
  ;; already committed the operation.
  (func $windowpos_message_update
    (param $slot i32) (param $hwnd i32) (param $insert_after i32)
    (param $x i32) (param $y i32) (param $cx i32) (param $cy i32)
    (param $flags i32)
    (local $w i32)
    (if (i32.eqz (local.get $slot)) (then (return)))
    (local.set $w (call $g2w (local.get $slot)))
    (i32.store (local.get $w) (local.get $hwnd))
    (i32.store offset=4 (local.get $w) (local.get $insert_after))
    (i32.store offset=8 (local.get $w) (local.get $x))
    (i32.store offset=12 (local.get $w) (local.get $y))
    (i32.store offset=16 (local.get $w) (local.get $cx))
    (i32.store offset=20 (local.get $w) (local.get $cy))
    (i32.store offset=24 (local.get $w) (local.get $flags)))

  (func $windowpos_message_end (param $slot i32) (param $hwnd i32)
    (if (i32.eqz (local.get $slot)) (then (return)))
    (drop (call $wnd_send_message
      (local.get $hwnd) (i32.const 0x0047) (i32.const 0) (local.get $slot)))
    (global.set $windowpos_depth (i32.sub (global.get $windowpos_depth) (i32.const 1)))
  )

  (func $windowpos_message_cancel (param $slot i32)
    (if (i32.eqz (local.get $slot)) (then (return)))
    (global.set $windowpos_depth
      (i32.sub (global.get $windowpos_depth) (i32.const 1))))

  ;; WM_MOVE carries the upper-left of the client area. Top-level coordinates
  ;; are screen-relative; child coordinates are relative to the parent's
  ;; client origin.
  (func $window_client_xy_packed (param $hwnd i32) (result i32)
    (local $x i32) (local $y i32) (local $parent i32)
    (local.set $x (call $wnd_client_screen_x (local.get $hwnd)))
    (local.set $y (call $wnd_client_screen_y (local.get $hwnd)))
    (if (i32.ne
          (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x40000000))
          (i32.const 0))
      (then
        (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
        (if (local.get $parent)
          (then
            (local.set $x (i32.sub (local.get $x)
              (call $wnd_client_screen_x (local.get $parent))))
            (local.set $y (i32.sub (local.get $y)
              (call $wnd_client_screen_y (local.get $parent))))))))
    (i32.or
      (i32.and (local.get $x) (i32.const 0xFFFF))
      (i32.shl (i32.and (local.get $y) (i32.const 0xFFFF)) (i32.const 16))))

  ;; DefWindowProc owns the legacy geometry messages. A wndproc that consumes
  ;; WM_WINDOWPOSCHANGED without chaining here intentionally receives neither,
  ;; exactly as USER documents.
  (func $windowpos_defproc_geometry (param $hwnd i32) (param $windowpos i32)
    (local $flags i32)
    (if (i32.eqz (local.get $windowpos)) (then (return)))
    (local.set $flags
      (call $gl32 (i32.add (local.get $windowpos) (i32.const 24))))
    (if (i32.eqz (i32.and (local.get $flags) (i32.const 2))) ;; !SWP_NOMOVE
      (then
        (drop (call $wnd_send_message
          (local.get $hwnd) (i32.const 0x0003) (i32.const 0)
          (call $window_client_xy_packed (local.get $hwnd))))))
    (if (i32.eqz (i32.and (local.get $flags) (i32.const 1))) ;; !SWP_NOSIZE
      (then
        (drop (call $wnd_send_message
          (local.get $hwnd) (i32.const 0x0005) (i32.const 0)
          (call $client_rect_wh_packed (local.get $hwnd)))))))

  ;; Both positioning APIs normalize NOMOVE/NOSIZE against committed
  ;; geometry before calling here. A real change exposes non-client pixels
  ;; (including standard scrollbars); NOREDRAW leaves them to the app.
  (func $windowpos_queue_ncpaint (param $hwnd i32) (param $flags i32)
    (if (i32.and
          (i32.and
            (i32.eqz (i32.and (local.get $flags) (i32.const 0x0008)))
            (call $wnd_is_effectively_visible (local.get $hwnd)))
          (i32.ne (i32.and (local.get $flags) (i32.const 3)) (i32.const 3)))
      (then (call $nc_flags_set (local.get $hwnd) (i32.const 1)))))

  (func $handle_SetWindowPos (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; SetWindowPos(hwnd, hWndInsertAfter, X, Y, cx, cy, uFlags)
    (i32.store offset=0 (global.get $reg_base)
      (call $set_window_pos_core (local.get $arg0) (local.get $arg1)
        (local.get $arg2) (local.get $arg3) (local.get $arg4)
        (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
        (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32))))

  ;; An external result WINDOWPOS lets the Win16 far continuation own its
  ;; notifications while sharing every geometry/paint commit below. Zero
  ;; retains the ordinary Win32 changing/changed transaction.
  (func $set_window_pos_core
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32)
    (param $cy i32) (param $uFlags i32) (param $result_pos i32) (result i32)
    (local $x i32) (local $y i32) (local $cx i32)
    (local $original_flags i32)
    (local $screen i32) (local $insert_after i32) (local $windowpos i32)
    (local $old_wh i32) (local $new_wh i32) (local $old_xy i32) (local $new_xy i32)
    ;; A missing target is not a successful host no-op. Reject it before
    ;; looking up geometry or sending notifications (NULL is an empty slot).
    (if (i32.or (i32.eqz (local.get $arg0))
          (i32.lt_s (call $wnd_table_find (local.get $arg0)) (i32.const 0)))
      (then
        (global.set $last_error (i32.const 1400)) ;; ERROR_INVALID_WINDOW_HANDLE
        (return (i32.const 0))))
    (local.set $insert_after (local.get $arg1))
    (local.set $x (local.get $arg2))
    (local.set $y (local.get $arg3))
    (local.set $cx (local.get $arg4))
    ;; An AdjustWindowRectEx-expanded CW_USEDEFAULT remains "leave this part
    ;; alone" during SDL's first SetWindowPos, even though it is no longer the
    ;; exact 0x80000000 bit pattern understood by the host fallback.
    (if (i32.or
          (call $is_cw_usedefault_value (local.get $x))
          (call $is_cw_usedefault_value (local.get $y)))
      (then (local.set $uFlags (i32.or (local.get $uFlags) (i32.const 2))))) ;; SWP_NOMOVE
    (if (i32.or
          (call $is_cw_usedefault_value (local.get $cx))
          (call $is_cw_usedefault_value (local.get $cy)))
      (then (local.set $uFlags (i32.or (local.get $uFlags) (i32.const 1))))) ;; SWP_NOSIZE
    ;; Once SDL supplies a real size, its adjusted 0xc0000000 coordinates mean
    ;; center that top-level window in the current display mode.
    (if (i32.eqz (i32.and (call $wnd_get_style (local.get $arg0)) (i32.const 0x40000000)))
      (then
        (local.set $screen (call $host_get_screen_size))
        (if (call $is_adjusted_center_coord (local.get $x))
          (then (local.set $x
            (if (result i32)
              (i32.gt_u (i32.and (local.get $screen) (i32.const 0xffff)) (local.get $cx))
              (then (i32.div_u
                (i32.sub (i32.and (local.get $screen) (i32.const 0xffff)) (local.get $cx))
                (i32.const 2)))
              (else (i32.const 0))))))
        (if (call $is_adjusted_center_coord (local.get $y))
          (then (local.set $y
            (if (result i32)
              (i32.gt_u (i32.shr_u (local.get $screen) (i32.const 16)) (local.get $cy))
              (then (i32.div_u
                (i32.sub (i32.shr_u (local.get $screen) (i32.const 16)) (local.get $cy))
                (i32.const 2)))
              (else (i32.const 0))))))))
    ;; USER exposes one mutable WINDOWPOS before touching geometry. The app
    ;; may change position, size, z-order and most flags. NOACTIVATE and
    ;; NOOWNERZORDER are explicitly documented as immutable in this message.
    (local.set $original_flags (local.get $uFlags))
    (local.set $windowpos (local.get $result_pos))
    (if (i32.eqz (local.get $result_pos))
      (then (local.set $windowpos (call $windowpos_message_begin
        (local.get $arg0) (local.get $insert_after)
        (local.get $x) (local.get $y) (local.get $cx) (local.get $cy)
        (local.get $uFlags)))))
    (if (i32.and (i32.ne (local.get $windowpos) (i32.const 0))
                (i32.eqz (local.get $result_pos)))
      (then
        (local.set $insert_after
          (call $gl32 (i32.add (local.get $windowpos) (i32.const 4))))
        (local.set $x
          (call $gl32 (i32.add (local.get $windowpos) (i32.const 8))))
        (local.set $y
          (call $gl32 (i32.add (local.get $windowpos) (i32.const 12))))
        (local.set $cx
          (call $gl32 (i32.add (local.get $windowpos) (i32.const 16))))
        (local.set $cy
          (call $gl32 (i32.add (local.get $windowpos) (i32.const 20))))
        (local.set $uFlags
          (i32.or
            (i32.and
              (call $gl32 (i32.add (local.get $windowpos) (i32.const 24)))
              (i32.const 0xFFFFFDEF))
            (i32.and (local.get $original_flags) (i32.const 0x00000210))))
        ;; A wndproc is allowed to destroy the target while processing the
        ;; synchronous changing message. Never apply its stale HWND afterward.
        (if (i32.lt_s (call $wnd_table_find (local.get $arg0)) (i32.const 0))
          (then
            (call $windowpos_message_cancel (local.get $windowpos))
            (global.set $last_error (i32.const 1400)) ;; ERROR_INVALID_WINDOW_HANDLE
            (return (i32.const 0))))))
    ;; Child controls own their geometry in CONTROL_GEOM. Top-level frames do
    ;; not: their renderer window can still be at the resource-template size
    ;; while the compatibility record and client rectangle already contain
    ;; the requested final dimensions. Read the live outer window rectangle,
    ;; which is also the coordinate space of SetWindowPos cx/cy. Reading the
    ;; stale compatibility record made a real frame resize look
    ;; like a no-op, added SWP_NOSIZE to WM_WINDOWPOSCHANGED, and suppressed
    ;; the derived WM_SIZE that common controls use for bottom anchoring.
    (if (i32.and (call $wnd_get_style (local.get $arg0)) (i32.const 0x40000000))
      (then (local.set $old_wh (call $ctrl_get_wh_packed (local.get $arg0))))
      (else
        (call $host_get_window_rect (local.get $arg0) (global.get $WINDOW_RECT_SCRATCH))
        (local.set $old_wh
          (i32.or
            (i32.and
              (i32.sub
                (i32.load offset=8 (global.get $WINDOW_RECT_SCRATCH))
                (i32.load (global.get $WINDOW_RECT_SCRATCH)))
              (i32.const 0xFFFF))
            (i32.shl
              (i32.and
                (i32.sub
                  (i32.load offset=12 (global.get $WINDOW_RECT_SCRATCH))
                  (i32.load offset=4 (global.get $WINDOW_RECT_SCRATCH)))
                (i32.const 0xFFFF))
              (i32.const 16))))))
    (local.set $old_xy (call $window_xy_packed (local.get $arg0)))
    ;; Commit geometry and z-order independently, as the SWP flags require.
    (call $host_move_window (local.get $arg0) (local.get $x) (local.get $y) (local.get $cx) (local.get $cy) (local.get $uFlags))
    (if (i32.and (i32.eqz (i32.and (local.get $uFlags) (i32.const 0x0004))) (i32.eqz (i32.and (call $wnd_get_style (local.get $arg0)) (i32.const 0x40000000)))) (then (call $host_set_window_zorder (local.get $arg0) (local.get $insert_after))))
    (call $ctrl_geom_sync (local.get $arg0) (local.get $x) (local.get $y) (local.get $cx) (local.get $cy) (local.get $uFlags))
    (if (i32.and (call $wnd_get_style (local.get $arg0)) (i32.const 0x40000000))
      (then (local.set $new_wh (call $ctrl_get_wh_packed (local.get $arg0))))
      (else
        (call $host_get_window_rect (local.get $arg0) (global.get $WINDOW_RECT_SCRATCH))
        (local.set $new_wh
          (i32.or
            (i32.and
              (i32.sub
                (i32.load offset=8 (global.get $WINDOW_RECT_SCRATCH))
                (i32.load (global.get $WINDOW_RECT_SCRATCH)))
              (i32.const 0xFFFF))
            (i32.shl
              (i32.and
                (i32.sub
                  (i32.load offset=12 (global.get $WINDOW_RECT_SCRATCH))
                  (i32.load offset=4 (global.get $WINDOW_RECT_SCRATCH)))
                (i32.const 0xFFFF))
              (i32.const 16))))))
    (local.set $new_xy (call $window_xy_packed (local.get $arg0)))
    ;; Make the changed WINDOWPOS describe what USER actually changed, so its
    ;; default procedure does not derive geometry messages for a no-op half.
    (if (i32.eq (local.get $old_xy) (local.get $new_xy))
      (then (local.set $uFlags (i32.or (local.get $uFlags) (i32.const 2)))))
    (if (i32.eq (local.get $old_wh) (local.get $new_wh))
      (then (local.set $uFlags (i32.or (local.get $uFlags) (i32.const 1)))))
    ;; Keep WAT's GWL_STYLE in sync with SetWindowPos visibility flags. Apps
    ;; such as Tetravex show custom child panels via SWP_SHOWWINDOW instead of
    ;; ShowWindow; if WS_VISIBLE stays clear here, WAT's paint selector treats
    ;; their later InvalidateRect calls as hidden-window work and drops them.
    (if (i32.and (local.get $uFlags) (i32.const 0x0040)) ;; SWP_SHOWWINDOW
      (then
        (drop (call $wnd_set_style (local.get $arg0)
          (i32.or (call $wnd_get_style (local.get $arg0)) (i32.const 0x10000000))))
        (if (i32.eqz (i32.and (local.get $uFlags) (i32.const 0x0008))) ;; !SWP_NOREDRAW
          (then
            (if (i32.eq (local.get $arg0) (global.get $main_hwnd))
              (then
                (global.set $paint_pending (i32.const 1))
                (call $update_invalidate_full (local.get $arg0))
                ;; SWP_SHOWWINDOW: the frame itself is appearing, so the
                ;; non-client area needs painting, not just a composite.
                (call $host_invalidate_frame (local.get $arg0)))
              (else (call $paint_flag_set_inv (local.get $arg0))))))))
    (if (i32.and (local.get $uFlags) (i32.const 0x0080)) ;; SWP_HIDEWINDOW
      (then
        (drop (call $wnd_set_style (local.get $arg0)
          (i32.and (call $wnd_get_style (local.get $arg0)) (i32.const 0xEFFFFFFF))))
        (call $paint_clear_subtree (local.get $arg0))))
    (call $defwndproc_do_nccalcsize (local.get $arg0))
    (call $host_sync_window_client
      (local.get $arg0)
      (call $wnd_client_screen_x (local.get $arg0))
      (call $wnd_client_screen_y (local.get $arg0))
      (i32.sub (call $client_rect_get_r (local.get $arg0)) (call $client_rect_get_l (local.get $arg0)))
      (i32.sub (call $client_rect_get_b (local.get $arg0)) (call $client_rect_get_t (local.get $arg0))))
    ;; SetWindowPos can resize retained-DC controls; refresh after NCCALCSIZE.
    (if (i32.ne (local.get $new_wh) (local.get $old_wh))
      (then (call $gdi_refresh_window_dc_system_clips)))
    ;; USER's MDICLIENT re-sizes its maximized child to its new client area.
    ;; This path is how an MFC frame resizes its MDICLIENT -- RecalcLayout
    ;; batches the control bars and the client into one DeferWindowPos, and
    ;; EndDeferWindowPos replays them through SetWindowPos -- and it delivers
    ;; no WM_SIZE to $mdiclient_wndproc, so route that one effect directly.
    ;; Without it a child that was already zoomed kept the rect it had at the
    ;; old frame size: maximizing SimCity 2000's frame left its city window at
    ;; 392x254 in the corner of a full-screen frame, with its own maximize
    ;; button apparently dead, because the child already believed it was
    ;; maximized. It has to run after the NCCALCSIZE above, which is what
    ;; gives the client its new CLIENT_RECT -- the child is sized from that.
    ;; The helper is a no-op for a window with no maximized MDI children.
    (call $mdi_client_size_children (local.get $arg0))
    (call $windowpos_message_update
      (local.get $windowpos) (local.get $arg0) (local.get $insert_after)
      (local.get $x) (local.get $y) (local.get $cx) (local.get $cy)
      (local.get $uFlags))
    (if (i32.eqz (local.get $result_pos))
      (then
        (call $windowpos_message_end (local.get $windowpos) (local.get $arg0))
        (call $windowpos_finish_paint (local.get $arg0) (local.get $uFlags))))
    (i32.const 1))

  ;; Run after CHANGED returns, whether it used Win32 synchronous dispatch or
  ;; the Win16 far continuation. Never paint ahead of the guest notification.
  (func $windowpos_finish_paint (param $arg0 i32) (param $uFlags i32)
    (local $dlg_rec i32)
    (if (i32.lt_s (call $wnd_table_find (local.get $arg0)) (i32.const 0))
      (then (return)))
    (call $windowpos_queue_ncpaint (local.get $arg0) (local.get $uFlags))
    ;; Repaint a moved WAT-native control immediately, but only if it is
    ;; actually on screen. Its own WS_VISIBLE bit is not enough: a control
    ;; inside a hidden dialog page keeps that bit set, and painting it writes
    ;; onto the top-level back-canvas at a position the page is about to leave,
    ;; where nothing will erase it. $handle_DeferWindowPos already tests it
    ;; this way.
    (if (i32.and
          (i32.and
            (i32.ne (call $ctrl_table_get_class (local.get $arg0)) (i32.const 0))
            (call $wnd_is_effectively_visible (local.get $arg0)))
          (i32.eqz (i32.and (local.get $uFlags) (i32.const 0x0008)))) ;; !SWP_NOREDRAW
      (then
        (drop (call $control_wndproc_dispatch
          (local.get $arg0) (i32.const 0x000F) (i32.const 0) (i32.const 0)))))
    (if (i32.eqz (i32.and (local.get $uFlags) (i32.const 0x0008))) ;; !SWP_NOREDRAW
      (then
        (local.set $dlg_rec (call $dlg_record_for_hwnd (local.get $arg0)))
        (if (i32.and
              (i32.and
                (i32.ne (local.get $dlg_rec) (i32.const 0))
                (i32.ne (i32.load offset=4 (local.get $dlg_rec)) (i32.const 0)))
              (i32.lt_s (call $wnd_get_class_slot (local.get $arg0)) (i32.const 0)))
          (then (drop (call $host_erase_background (local.get $arg0) (i32.const 16)))))))
  )
