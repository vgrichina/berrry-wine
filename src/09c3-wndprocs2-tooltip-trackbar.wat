  ;; ---- Tooltip WndProc ----
  ;;
  ;; Stateful tooltips_class32 subset. State layout:
  ;; +0 items_guest (array of 48-byte TOOLINFOA snapshots)
  ;; +4 count, +8 capacity, +12 active flag, +16 current index
  ;; +20 bk color, +24 text color, +28 max tip width, +32 autopop delay
  ;; +36 initial delay, +40 reshow delay, +44 margin l/t/r/b.
  (func $tooltip_item_ptr (param $sw ptr<TooltipState>) (param $idx i32) (result i32)
    (i32.add (call $g2w (load.field TooltipState items_guest (local.get $sw)))
             (i32.mul (local.get $idx) (i32.const 48))))

  (func $tooltip_find_tool (param $sw ptr<TooltipState>) (param $tool_hwnd i32) (param $tool_id i32) (result i32)
    (local $i i32) (local $count i32) (local $rec i32)
    (local.set $count (load.field.memarg TooltipState count (local.get $sw)))
    (local.set $i (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $rec (call $tooltip_item_ptr (local.get $sw) (local.get $i)))
      (if (i32.and
            (i32.eq (i32.load offset=8 (local.get $rec)) (local.get $tool_hwnd))
            (i32.eq (i32.load offset=12 (local.get $rec)) (local.get $tool_id)))
        (then (return (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const -1))

  (func $tooltip_hit_test (param $sw ptr<TooltipState>) (param $tool_hwnd i32) (param $x i32) (param $y i32) (result i32)
    (local $i i32) (local $count i32) (local $rec i32)
    (local.set $count (load.field.memarg TooltipState count (local.get $sw)))
    (local.set $i (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $rec (call $tooltip_item_ptr (local.get $sw) (local.get $i)))
      (if (i32.and
            (i32.eq (i32.load offset=8 (local.get $rec)) (local.get $tool_hwnd))
            (i32.and
              (i32.ge_s (local.get $x) (i32.load offset=16 (local.get $rec)))
              (i32.and
                (i32.lt_s (local.get $x) (i32.load offset=24 (local.get $rec)))
                (i32.and
                  (i32.ge_s (local.get $y) (i32.load offset=20 (local.get $rec)))
                  (i32.lt_s (local.get $y) (i32.load offset=28 (local.get $rec)))))))
        (then (return (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const -1))

  (func $tooltip_copy_in (param $dst i32) (param $src_guest i32)
    (local $src i32) (local $size i32)
    (local.set $src (call $g2w (local.get $src_guest)))
    (call $zero_memory (local.get $dst) (i32.const 48))
    (if (i32.eqz (local.get $src_guest)) (then (return)))
    (local.set $size (i32.load (local.get $src)))
    (if (i32.gt_u (local.get $size) (i32.const 48)) (then (local.set $size (i32.const 48))))
    (if (i32.lt_u (local.get $size) (i32.const 40)) (then (local.set $size (i32.const 40))))
    (call $memcpy (local.get $dst) (local.get $src) (local.get $size)))

  (func $tooltip_wndproc (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $state i32) (local $sw ptr<TooltipState>) (local $items i32) (local $new_items i32)
    (local $count i32) (local $cap i32) (local $idx i32) (local $rec i32)
    (local $src i32) (local $dst i32) (local $text_src i32) (local $text_dst i32)
    (local $len i32) (local $ti i32) (local $x i32) (local $y i32) (local $old i32)
    (local $created i32)

    (local.set $state (call $wnd_get_state_ptr (local.get $hwnd)))
    (if (i32.eqz (local.get $state))
      (then
        (local.set $state (call $heap_alloc (i32.const 64)))
        (local.set $created (i32.const 1))))
    (local.set $sw (cast ptr<TooltipState> (call $g2w (local.get $state))))
    (if (local.get $created)
      (then
        (call $zero_memory (local.get $sw) (i32.const 64))
        (local.set $items (call $heap_alloc (i32.mul (i32.const 4) (i32.const 48))))
        (call $zero_memory (call $g2w (local.get $items)) (i32.mul (i32.const 4) (i32.const 48)))
        (store.field TooltipState items_guest (local.get $sw) (local.get $items))
        (store.field.memarg TooltipState capacity (local.get $sw) (i32.const 4))
        (store.field.memarg TooltipState active (local.get $sw) (i32.const 1))
        (store.field.memarg TooltipState current_index (local.get $sw) (i32.const -1))
        (store.field.memarg TooltipState bk_color (local.get $sw) (i32.const 0x00FFFFE1))
        (store.field.memarg TooltipState text_color (local.get $sw) (i32.const 0x00000000))
        (store.field.memarg TooltipState max_tip_width (local.get $sw) (i32.const -1))
        (store.field.memarg TooltipState autopop_delay (local.get $sw) (i32.const 5000))
        (store.field.memarg TooltipState initial_delay (local.get $sw) (i32.const 500))
        (store.field.memarg TooltipState reshow_delay (local.get $sw) (i32.const 100))
        (call $wnd_set_state_ptr (local.get $hwnd) (local.get $state))))

    ;; WM_CREATE
    (if (i32.eq (local.get $msg) (i32.const 0x0001)) (then (return (i32.const 0))))
    ;; WM_DESTROY
    (if (i32.eq (local.get $msg) (i32.const 0x0002))
      (then
        (call $heap_free (load.field TooltipState items_guest (local.get $sw)))
        (call $heap_free (local.get $state))
        (call $wnd_set_state_ptr (local.get $hwnd) (i32.const 0))
        (return (i32.const 0))))

    ;; TTM_ACTIVATE
    (if (i32.eq (local.get $msg) (i32.const 0x0401))
      (then
        (store.field.memarg TooltipState active (local.get $sw) (select (i32.const 1) (i32.const 0) (i32.ne (local.get $wParam) (i32.const 0))))
        (return (i32.const 0))))

    ;; TTM_SETDELAYTIME / TTM_GETDELAYTIME
    (if (i32.eq (local.get $msg) (i32.const 0x0403))
      (then
        (if (i32.eq (local.get $wParam) (i32.const 1)) (then (store.field.memarg TooltipState reshow_delay (local.get $sw) (local.get $lParam))))
        (if (i32.eq (local.get $wParam) (i32.const 2)) (then (store.field.memarg TooltipState autopop_delay (local.get $sw) (local.get $lParam))))
        (if (i32.eq (local.get $wParam) (i32.const 3)) (then (store.field.memarg TooltipState initial_delay (local.get $sw) (local.get $lParam))))
        (if (i32.eq (local.get $wParam) (i32.const 0))
          (then
            (store.field.memarg TooltipState initial_delay (local.get $sw) (local.get $lParam))
            (store.field.memarg TooltipState reshow_delay (local.get $sw) (i32.div_s (local.get $lParam) (i32.const 5)))
            (store.field.memarg TooltipState autopop_delay (local.get $sw) (i32.mul (local.get $lParam) (i32.const 10)))))
        (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0415))
      (then
        (if (i32.eq (local.get $wParam) (i32.const 1)) (then (return (load.field.memarg TooltipState reshow_delay (local.get $sw)))))
        (if (i32.eq (local.get $wParam) (i32.const 2)) (then (return (load.field.memarg TooltipState autopop_delay (local.get $sw)))))
        (if (i32.eq (local.get $wParam) (i32.const 3)) (then (return (load.field.memarg TooltipState initial_delay (local.get $sw)))))
        (return (load.field.memarg TooltipState initial_delay (local.get $sw)))))

    ;; TTM_ADDTOOLA
    (if (i32.eq (local.get $msg) (i32.const 0x0404))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $src (call $g2w (local.get $lParam)))
        (local.set $idx (call $tooltip_find_tool (local.get $sw)
          (i32.load offset=8 (local.get $src)) (i32.load offset=12 (local.get $src))))
        (if (i32.ge_s (local.get $idx) (i32.const 0))
          (then
            (call $tooltip_copy_in (call $tooltip_item_ptr (local.get $sw) (local.get $idx)) (local.get $lParam))
            (return (i32.const 1))))
        (local.set $count (load.field.memarg TooltipState count (local.get $sw)))
        (local.set $cap (load.field.memarg TooltipState capacity (local.get $sw)))
        (if (i32.ge_u (local.get $count) (local.get $cap))
          (then
            (local.set $new_items (call $heap_alloc (i32.mul (i32.mul (local.get $cap) (i32.const 2)) (i32.const 48))))
            (call $zero_memory (call $g2w (local.get $new_items)) (i32.mul (i32.mul (local.get $cap) (i32.const 2)) (i32.const 48)))
            (call $memcpy (call $g2w (local.get $new_items)) (call $g2w (load.field TooltipState items_guest (local.get $sw))) (i32.mul (local.get $count) (i32.const 48)))
            (call $heap_free (load.field TooltipState items_guest (local.get $sw)))
            (store.field TooltipState items_guest (local.get $sw) (local.get $new_items))
            (store.field.memarg TooltipState capacity (local.get $sw) (i32.mul (local.get $cap) (i32.const 2)))))
        (call $tooltip_copy_in (call $tooltip_item_ptr (local.get $sw) (local.get $count)) (local.get $lParam))
        (store.field.memarg TooltipState count (local.get $sw) (i32.add (local.get $count) (i32.const 1)))
        (if (i32.lt_s (load.field.memarg TooltipState current_index (local.get $sw)) (i32.const 0))
          (then (store.field.memarg TooltipState current_index (local.get $sw) (local.get $count))))
        (return (i32.const 1))))

    ;; TTM_DELTOOLA
    (if (i32.eq (local.get $msg) (i32.const 0x0405))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $src (call $g2w (local.get $lParam)))
        (local.set $idx (call $tooltip_find_tool (local.get $sw)
          (i32.load offset=8 (local.get $src)) (i32.load offset=12 (local.get $src))))
        (if (i32.lt_s (local.get $idx) (i32.const 0)) (then (return (i32.const 0))))
        (local.set $count (load.field.memarg TooltipState count (local.get $sw)))
        (local.set $rec (call $tooltip_item_ptr (local.get $sw) (local.get $idx)))
        (if (i32.lt_u (i32.add (local.get $idx) (i32.const 1)) (local.get $count))
          (then
            (call $memcpy (local.get $rec)
              (i32.add (local.get $rec) (i32.const 48))
              (i32.mul (i32.sub (i32.sub (local.get $count) (local.get $idx)) (i32.const 1)) (i32.const 48)))))
        (store.field.memarg TooltipState count (local.get $sw) (i32.sub (local.get $count) (i32.const 1)))
        (if (i32.ge_s (load.field.memarg TooltipState current_index (local.get $sw)) (i32.sub (local.get $count) (i32.const 1)))
          (then (store.field.memarg TooltipState current_index (local.get $sw) (i32.sub (load.field.memarg TooltipState count (local.get $sw)) (i32.const 1)))))
        (return (i32.const 1))))

    ;; TTM_NEWTOOLRECTA / TTM_SETTOOLINFOA / TTM_UPDATETIPTEXTA
    (if (i32.or (i32.eq (local.get $msg) (i32.const 0x0406))
                (i32.or (i32.eq (local.get $msg) (i32.const 0x0409))
                        (i32.eq (local.get $msg) (i32.const 0x040C))))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $src (call $g2w (local.get $lParam)))
        (local.set $idx (call $tooltip_find_tool (local.get $sw)
          (i32.load offset=8 (local.get $src)) (i32.load offset=12 (local.get $src))))
        (if (i32.lt_s (local.get $idx) (i32.const 0)) (then (return (i32.const 0))))
        (local.set $rec (call $tooltip_item_ptr (local.get $sw) (local.get $idx)))
        (if (i32.eq (local.get $msg) (i32.const 0x0406))
          (then (call $memcpy (i32.add (local.get $rec) (i32.const 16)) (i32.add (local.get $src) (i32.const 16)) (i32.const 16)))
          (else
            (if (i32.eq (local.get $msg) (i32.const 0x040C))
              (then (i32.store offset=36 (local.get $rec) (i32.load offset=36 (local.get $src))))
              (else (call $tooltip_copy_in (local.get $rec) (local.get $lParam))))))
        (return (i32.const 1))))

    ;; TTM_GETTOOLINFOA / TTM_ENUMTOOLSA / TTM_GETCURRENTTOOLA
    (if (i32.or (i32.eq (local.get $msg) (i32.const 0x0408))
                (i32.or (i32.eq (local.get $msg) (i32.const 0x040E))
                        (i32.eq (local.get $msg) (i32.const 0x040F))))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $dst (call $g2w (local.get $lParam)))
        (if (i32.eq (local.get $msg) (i32.const 0x040E))
          (then (local.set $idx (local.get $wParam)))
          (else
            (if (i32.eq (local.get $msg) (i32.const 0x040F))
              (then (local.set $idx (load.field.memarg TooltipState current_index (local.get $sw))))
              (else
                (local.set $idx (call $tooltip_find_tool (local.get $sw)
                  (i32.load offset=8 (local.get $dst)) (i32.load offset=12 (local.get $dst))))))))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_u (local.get $idx) (load.field.memarg TooltipState count (local.get $sw))))
          (then (return (i32.const 0))))
        (call $memcpy (local.get $dst) (call $tooltip_item_ptr (local.get $sw) (local.get $idx)) (i32.const 48))
        (return (i32.const 1))))

    ;; TTM_GETTEXTA
    (if (i32.eq (local.get $msg) (i32.const 0x040B))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $ti (call $g2w (local.get $lParam)))
        (local.set $idx (call $tooltip_find_tool (local.get $sw)
          (i32.load offset=8 (local.get $ti)) (i32.load offset=12 (local.get $ti))))
        (if (i32.lt_s (local.get $idx) (i32.const 0)) (then (return (i32.const 0))))
        (local.set $rec (call $tooltip_item_ptr (local.get $sw) (local.get $idx)))
        (local.set $text_dst (call $g2w (i32.load offset=36 (local.get $ti))))
        (local.set $text_src (call $g2w (i32.load offset=36 (local.get $rec))))
        (if (i32.and
              (i32.ne (local.get $text_dst) (i32.const 0))
              (i32.ne (local.get $text_src) (i32.const 0)))
          (then
            (local.set $len (call $strlen (local.get $text_src)))
            (if (i32.gt_u (local.get $len) (i32.const 255)) (then (local.set $len (i32.const 255))))
            (call $memcpy (local.get $text_dst) (local.get $text_src) (local.get $len))
            (i32.store8 (i32.add (local.get $text_dst) (local.get $len)) (i32.const 0))))
        (return (i32.const 1))))

    ;; TTM_GETTOOLCOUNT
    (if (i32.eq (local.get $msg) (i32.const 0x040D))
      (then (return (load.field.memarg TooltipState count (local.get $sw)))))

    ;; TTM_HITTESTA. TTHITTESTINFOA: hwnd(+0), pt(+4,+8), ti(+12).
    (if (i32.eq (local.get $msg) (i32.const 0x040A))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $src (call $g2w (local.get $lParam)))
        (local.set $idx (call $tooltip_hit_test (local.get $sw)
          (i32.load (local.get $src)) (i32.load offset=4 (local.get $src)) (i32.load offset=8 (local.get $src))))
        (if (i32.lt_s (local.get $idx) (i32.const 0)) (then (return (i32.const 0))))
        (call $memcpy (i32.add (local.get $src) (i32.const 12))
          (call $tooltip_item_ptr (local.get $sw) (local.get $idx)) (i32.const 48))
        (return (i32.const 1))))

    ;; TTM_RELAYEVENT. MSG: hwnd,msg,wParam,lParam,time,pt.x,pt.y.
    (if (i32.eq (local.get $msg) (i32.const 0x0407))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $src (call $g2w (local.get $lParam)))
        (local.set $x (i32.shr_s (i32.shl (i32.load offset=12 (local.get $src)) (i32.const 16)) (i32.const 16)))
        (local.set $y (i32.shr_s (i32.load offset=12 (local.get $src)) (i32.const 16)))
        (local.set $idx (call $tooltip_hit_test (local.get $sw)
          (i32.load (local.get $src)) (local.get $x) (local.get $y)))
        (store.field.memarg TooltipState current_index (local.get $sw) (local.get $idx))
        (return (i32.const 0))))

    ;; TTM_WINDOWFROMPOINT: return current matched hwnd if available.
    (if (i32.eq (local.get $msg) (i32.const 0x0410))
      (then
        (local.set $idx (load.field.memarg TooltipState current_index (local.get $sw)))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_u (local.get $idx) (load.field.memarg TooltipState count (local.get $sw))))
          (then (return (i32.const 0))))
        (return (i32.load offset=8 (call $tooltip_item_ptr (local.get $sw) (local.get $idx))))))

    ;; TTM_TRACKACTIVATE / TTM_POP / TTM_UPDATE
    (if (i32.or (i32.eq (local.get $msg) (i32.const 0x0411))
                (i32.or (i32.eq (local.get $msg) (i32.const 0x041C))
                        (i32.eq (local.get $msg) (i32.const 0x041D))))
      (then (return (i32.const 1))))
    ;; TTM_TRACKPOSITION
    (if (i32.eq (local.get $msg) (i32.const 0x0412)) (then (return (i32.const 0))))

    ;; Colors / max width / margin.
    (if (i32.eq (local.get $msg) (i32.const 0x0413)) (then (store.field.memarg TooltipState bk_color (local.get $sw) (local.get $wParam)) (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0414)) (then (store.field.memarg TooltipState text_color (local.get $sw) (local.get $wParam)) (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0416)) (then (return (load.field.memarg TooltipState bk_color (local.get $sw)))))
    (if (i32.eq (local.get $msg) (i32.const 0x0417)) (then (return (load.field.memarg TooltipState text_color (local.get $sw)))))
    (if (i32.eq (local.get $msg) (i32.const 0x0418))
      (then
        (local.set $old (load.field.memarg TooltipState max_tip_width (local.get $sw)))
        (store.field.memarg TooltipState max_tip_width (local.get $sw) (local.get $lParam))
        (return (local.get $old))))
    (if (i32.eq (local.get $msg) (i32.const 0x0419)) (then (return (load.field.memarg TooltipState max_tip_width (local.get $sw)))))
    (if (i32.eq (local.get $msg) (i32.const 0x041A))
      (then
        (if (local.get $lParam) (then (call $memcpy (i32.add (local.get $sw) (i32.const 44)) (call $g2w (local.get $lParam)) (i32.const 16))))
        (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x041B))
      (then
        (if (local.get $lParam) (then (call $memcpy (call $g2w (local.get $lParam)) (i32.add (local.get $sw) (i32.const 44)) (i32.const 16))))
        (return (i32.const 0))))

    (i32.const 0))

  ;; ---- TrackBar / Slider WndProc ----
  ;;
  ;; Minimal common-control trackbar for Funpack dialogs. State:
  ;; +0 min, +4 max, +8 pos, +12 line, +16 page, +20 thumb length.
  (func $trackbar_wndproc (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $state i32) (local $sw i32) (local $min i32) (local $max i32) (local $pos i32)
    (local $old i32) (local $hdc i32) (local $sz i32) (local $w i32) (local $h i32)
    (local $style i32) (local $vert i32) (local $range i32) (local $track_len i32)
    (local $thumb_len i32) (local $thumb_pos i32) (local $cx i32) (local $cy i32)
    (local $coord i32) (local $long_dim i32) (local $parent i32) (local $scroll_msg i32)
    (local $i i32)

    (local.set $state (call $wnd_get_state_ptr (local.get $hwnd)))
    (if (i32.eqz (local.get $state))
      (then
        (local.set $state (call $heap_alloc (i32.const 24)))
        (local.set $sw (call $g2w (local.get $state)))
        (call $trk_state_init (local.get $sw))
        (call $wnd_set_state_ptr (local.get $hwnd) (local.get $state))))
    (local.set $sw (call $g2w (local.get $state)))

    ;; WM_CREATE
    (if (i32.eq (local.get $msg) (i32.const 0x0001))
      (then (return (i32.const 0))))
    ;; WM_DESTROY
    (if (i32.eq (local.get $msg) (i32.const 0x0002))
      (then
        (call $heap_free (local.get $state))
        (call $wnd_set_state_ptr (local.get $hwnd) (i32.const 0))
        (return (i32.const 0))))

    ;; TBM_GETPOS / TBM_GETRANGEMIN / TBM_GETRANGEMAX
    (if (i32.eq (local.get $msg) (i32.const 0x0400))
      (then (return (call $trk_pos (local.get $sw)))))
    (if (i32.eq (local.get $msg) (i32.const 0x0401))
      (then (return (call $trk_min (local.get $sw)))))
    (if (i32.eq (local.get $msg) (i32.const 0x0402))
      (then (return (call $trk_max (local.get $sw)))))
    ;; TBM_SETPOS(fRedraw, pos)
    (if (i32.eq (local.get $msg) (i32.const 0x0405))
      (then
        (call $trk_set_pos (local.get $sw)
          (call $trk_clamp (local.get $sw) (local.get $lParam)))
        (if (local.get $wParam) (then (call $invalidate_hwnd (local.get $hwnd))))
        (return (i32.const 0))))
    ;; TBM_SETRANGE(fRedraw, MAKELONG(min,max))
    (if (i32.eq (local.get $msg) (i32.const 0x0406))
      (then
        (local.set $min (i32.shr_s (i32.shl (local.get $lParam) (i32.const 16)) (i32.const 16)))
        (local.set $max (i32.shr_s (local.get $lParam) (i32.const 16)))
        (if (i32.le_s (local.get $max) (local.get $min))
          (then (local.set $max (i32.add (local.get $min) (i32.const 1)))))
        (call $trk_set_min (local.get $sw) (local.get $min))
        (call $trk_set_max (local.get $sw) (local.get $max))
        (call $trk_set_pos (local.get $sw)
          (call $trk_clamp (local.get $sw) (call $trk_pos (local.get $sw))))
        (if (local.get $wParam) (then (call $invalidate_hwnd (local.get $hwnd))))
        (return (i32.const 0))))
    ;; TBM_SETRANGEMIN / TBM_SETRANGEMAX
    (if (i32.eq (local.get $msg) (i32.const 0x0407))
      (then
        (call $trk_set_min (local.get $sw) (local.get $lParam))
        (if (local.get $wParam) (then (call $invalidate_hwnd (local.get $hwnd))))
        (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0408))
      (then
        (call $trk_set_max (local.get $sw) (local.get $lParam))
        (if (local.get $wParam) (then (call $invalidate_hwnd (local.get $hwnd))))
        (return (i32.const 0))))
    ;; TBM_SETPAGESIZE / GETPAGESIZE / SETLINESIZE / GETLINESIZE
    (if (i32.eq (local.get $msg) (i32.const 0x0415))
      (then
        (local.set $old (call $trk_page (local.get $sw)))
        (call $trk_set_page (local.get $sw) (local.get $lParam))
        (return (local.get $old))))
    (if (i32.eq (local.get $msg) (i32.const 0x0416))
      (then (return (call $trk_page (local.get $sw)))))
    (if (i32.eq (local.get $msg) (i32.const 0x0417))
      (then
        (local.set $old (call $trk_line (local.get $sw)))
        (call $trk_set_line (local.get $sw) (local.get $lParam))
        (return (local.get $old))))
    (if (i32.eq (local.get $msg) (i32.const 0x0418))
      (then (return (call $trk_line (local.get $sw)))))
    ;; TBM_SETTHUMBLENGTH / GETTHUMBLENGTH
    (if (i32.eq (local.get $msg) (i32.const 0x041B))
      (then
        (call $trk_set_thumb_len (local.get $sw) (local.get $wParam))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x041C))
      (then (return (call $trk_thumb_len (local.get $sw)))))

    ;; Mouse tracking. Native trackbars capture the thumb and synchronously
    ;; notify their parent with WM_HSCROLL/WM_VSCROLL while it moves.
    (if (i32.or
          (i32.eq (local.get $msg) (i32.const 0x0201))
          (i32.and (i32.eq (local.get $msg) (i32.const 0x0200))
                   (i32.eq (global.get $capture_hwnd) (local.get $hwnd))))
      (then
        (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
        (local.set $w (i32.and (local.get $sz) (i32.const 0xffff)))
        (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
        (local.set $style (call $wnd_get_style (local.get $hwnd)))
        (local.set $vert (i32.and (local.get $style) (i32.const 0x0002)))
        (local.set $long_dim (select (local.get $h) (local.get $w) (local.get $vert)))
        (local.set $coord
          (select
            (i32.shr_s (local.get $lParam) (i32.const 16))
            (i32.shr_s (i32.shl (local.get $lParam) (i32.const 16)) (i32.const 16))
            (local.get $vert)))
        (local.set $thumb_len (call $trk_thumb_len (local.get $sw)))
        (if (i32.lt_s (local.get $thumb_len) (i32.const 8))
          (then (local.set $thumb_len (i32.const 8))))
        (local.set $track_len (i32.sub (local.get $long_dim) (local.get $thumb_len)))
        (if (i32.lt_s (local.get $track_len) (i32.const 1))
          (then (local.set $track_len (i32.const 1))))
        (local.set $coord (i32.sub (local.get $coord) (i32.div_s (local.get $thumb_len) (i32.const 2))))
        (if (i32.lt_s (local.get $coord) (i32.const 0)) (then (local.set $coord (i32.const 0))))
        (if (i32.gt_s (local.get $coord) (local.get $track_len)) (then (local.set $coord (local.get $track_len))))
        (local.set $min (call $trk_min (local.get $sw)))
        (local.set $max (call $trk_max (local.get $sw)))
        (local.set $range (i32.sub (local.get $max) (local.get $min)))
        (if (i32.le_s (local.get $range) (i32.const 0)) (then (local.set $range (i32.const 1))))
        (local.set $pos
          (i32.add (local.get $min)
            (i32.div_s (i32.mul (local.get $coord) (local.get $range)) (local.get $track_len))))
        (call $trk_set_pos (local.get $sw) (local.get $pos))
        (if (i32.eq (local.get $msg) (i32.const 0x0201))
          (then (global.set $capture_hwnd (local.get $hwnd))))
        (call $invalidate_hwnd (local.get $hwnd))
        (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
        (local.set $scroll_msg (select (i32.const 0x0115) (i32.const 0x0114) (local.get $vert)))
        (drop (call $wnd_send_message
          (local.get $parent) (local.get $scroll_msg)
          (i32.or (i32.const 5) (i32.shl (i32.and (local.get $pos) (i32.const 0xffff)) (i32.const 16)))
          (local.get $hwnd)))
        (return (i32.const 0))))

    (if (i32.eq (local.get $msg) (i32.const 0x0202))
      (then
        (if (i32.eq (global.get $capture_hwnd) (local.get $hwnd))
          (then
            (global.set $capture_hwnd (i32.const 0))
            (local.set $pos (call $trk_pos (local.get $sw)))
            (local.set $vert (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x0002)))
            (local.set $scroll_msg (select (i32.const 0x0115) (i32.const 0x0114) (local.get $vert)))
            (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
            (drop (call $wnd_send_message
              (local.get $parent) (local.get $scroll_msg)
              (i32.or (i32.const 4) (i32.shl (i32.and (local.get $pos) (i32.const 0xffff)) (i32.const 16)))
              (local.get $hwnd)))
            (drop (call $wnd_send_message
              (local.get $parent) (local.get $scroll_msg) (i32.const 8) (local.get $hwnd)))))
        (return (i32.const 0))))

    ;; WM_PAINT
    (if (i32.eq (local.get $msg) (i32.const 0x000F))
      (then
        (local.set $hdc (i32.add (local.get $hwnd) (i32.const 0x40000)))
        (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
        (local.set $w (i32.and (local.get $sz) (i32.const 0xFFFF)))
        (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
        (local.set $style (call $wnd_get_style (local.get $hwnd)))
        (local.set $vert (i32.and (local.get $style) (i32.const 0x0002)))
        (drop (call $gdi_native_fill_rect (local.get $hdc)
                (i32.const 0) (i32.const 0) (local.get $w) (local.get $h)
                (i32.const 0x30011))) ;; LTGRAY_BRUSH / COLOR_BTNFACE.
        (local.set $min (call $trk_min (local.get $sw)))
        (local.set $max (call $trk_max (local.get $sw)))
        (local.set $pos (call $trk_pos (local.get $sw)))
        (local.set $range (i32.sub (local.get $max) (local.get $min)))
        (if (i32.le_s (local.get $range) (i32.const 0)) (then (local.set $range (i32.const 1))))
        (local.set $thumb_len (call $trk_thumb_len (local.get $sw)))
        (if (i32.lt_s (local.get $thumb_len) (i32.const 8)) (then (local.set $thumb_len (i32.const 8))))
        (if (local.get $vert)
          (then
            (local.set $track_len (i32.sub (local.get $h) (local.get $thumb_len)))
            (if (i32.lt_s (local.get $track_len) (i32.const 1)) (then (local.set $track_len (i32.const 1))))
            (local.set $thumb_pos
              (i32.div_s
                (i32.mul (i32.sub (local.get $pos) (local.get $min)) (local.get $track_len))
                (local.get $range)))
            (local.set $cx (i32.div_s (local.get $w) (i32.const 2)))
            (drop (call $gdi_native_draw_edge (local.get $hdc)
                    (i32.sub (local.get $cx) (i32.const 2)) (i32.const 4)
                    (i32.add (local.get $cx) (i32.const 2)) (i32.sub (local.get $h) (i32.const 4))
                    (i32.const 0x0A) (i32.const 0x0F)))
            ;; Vertical Win9x mixer faders show evenly spaced tick marks on
            ;; both sides of the groove unless TBS_NOTICKS is requested.
            (if (i32.eqz (i32.and (local.get $style) (i32.const 0x0010)))
              (then
                (drop (call $gdi_native_fill_rect (local.get $hdc)
                        (i32.const 2) (i32.const 4) (i32.const 5) (i32.const 5)
                        (i32.const 0x30014)))
                (drop (call $gdi_native_fill_rect (local.get $hdc)
                        (i32.sub (local.get $w) (i32.const 5)) (i32.const 4)
                        (i32.sub (local.get $w) (i32.const 2)) (i32.const 5)
                        (i32.const 0x30014)))
                (drop (call $gdi_native_fill_rect (local.get $hdc)
                        (i32.const 2) (i32.div_u (local.get $h) (i32.const 2))
                        (i32.const 5) (i32.add (i32.div_u (local.get $h) (i32.const 2)) (i32.const 1))
                        (i32.const 0x30014)))
                (drop (call $gdi_native_fill_rect (local.get $hdc)
                        (i32.sub (local.get $w) (i32.const 5)) (i32.div_u (local.get $h) (i32.const 2))
                        (i32.sub (local.get $w) (i32.const 2))
                        (i32.add (i32.div_u (local.get $h) (i32.const 2)) (i32.const 1))
                        (i32.const 0x30014)))
                (drop (call $gdi_native_fill_rect (local.get $hdc)
                        (i32.const 2) (i32.sub (local.get $h) (i32.const 5))
                        (i32.const 5) (i32.sub (local.get $h) (i32.const 4))
                        (i32.const 0x30014)))
                (drop (call $gdi_native_fill_rect (local.get $hdc)
                        (i32.sub (local.get $w) (i32.const 5)) (i32.sub (local.get $h) (i32.const 5))
                        (i32.sub (local.get $w) (i32.const 2)) (i32.sub (local.get $h) (i32.const 4))
                        (i32.const 0x30014)))))
            (drop (call $gdi_native_fill_rect (local.get $hdc)
                    (i32.sub (local.get $cx) (i32.const 8)) (local.get $thumb_pos)
                    (i32.add (local.get $cx) (i32.const 8)) (i32.add (local.get $thumb_pos) (local.get $thumb_len))
                    (i32.const 0x30011)))
            (drop (call $gdi_native_draw_edge (local.get $hdc)
                    (i32.sub (local.get $cx) (i32.const 8)) (local.get $thumb_pos)
                    (i32.add (local.get $cx) (i32.const 8)) (i32.add (local.get $thumb_pos) (local.get $thumb_len))
                    (i32.const 0x05) (i32.const 0x0F))))
          (else
            (local.set $track_len (i32.sub (local.get $w) (local.get $thumb_len)))
            (if (i32.lt_s (local.get $track_len) (i32.const 1)) (then (local.set $track_len (i32.const 1))))
            (local.set $thumb_pos
              (i32.div_s
                (i32.mul (i32.sub (local.get $pos) (local.get $min)) (local.get $track_len))
                (local.get $range)))
            (local.set $cy (i32.div_s (local.get $h) (i32.const 2)))
            (drop (call $gdi_native_draw_edge (local.get $hdc)
                    (i32.const 4) (i32.sub (local.get $cy) (i32.const 2))
                    (i32.sub (local.get $w) (i32.const 4)) (i32.add (local.get $cy) (i32.const 2))
                    (i32.const 0x0A) (i32.const 0x0F)))
            ;; TBS_AUTOTICKS is the horizontal default. The Win98 control
            ;; chooses a readable interval as the range grows; ten divisions
            ;; reproduce that automatic density for Media Player's time line.
            (if (i32.eqz (i32.and (local.get $style) (i32.const 0x0010)))
              (then
                (local.set $i (i32.const 0))
                (block $ticks_done (loop $ticks
                  (br_if $ticks_done (i32.gt_u (local.get $i) (i32.const 10)))
                  (local.set $cx
                    (i32.add (i32.const 4)
                      (i32.div_u
                        (i32.mul (i32.sub (local.get $w) (i32.const 8)) (local.get $i))
                        (i32.const 10))))
                  (drop (call $gdi_native_fill_rect (local.get $hdc)
                    (local.get $cx) (i32.add (local.get $cy) (i32.const 9))
                    (i32.add (local.get $cx) (i32.const 1))
                    (i32.add (local.get $cy) (i32.const 11))
                    (i32.const 0x30014)))
                  (local.set $i (i32.add (local.get $i) (i32.const 1)))
                  (br $ticks)))))
            (drop (call $gdi_native_fill_rect (local.get $hdc)
                    (local.get $thumb_pos) (i32.sub (local.get $cy) (i32.const 8))
                    (i32.add (local.get $thumb_pos) (local.get $thumb_len)) (i32.add (local.get $cy) (i32.const 8))
                    (i32.const 0x30011)))
            (drop (call $gdi_native_draw_edge (local.get $hdc)
                    (local.get $thumb_pos) (i32.sub (local.get $cy) (i32.const 8))
                    (i32.add (local.get $thumb_pos) (local.get $thumb_len)) (i32.add (local.get $cy) (i32.const 8))
                    (i32.const 0x05) (i32.const 0x0F)))))
        (return (i32.const 0))))
    (i32.const 0))

  ;; Case-insensitive memcmp of $n bytes at WASM-linear $a / $b. Returns 1
  ;; if equal (treating ASCII A-Z and a-z as equivalent), 0 otherwise.
  ;; Used by LB_FINDSTRING / LB_FINDSTRINGEXACT.
  (func $listbox_strncmpi (param $a i32) (param $b i32) (param $n i32) (result i32)
    (local $ca i32) (local $cb i32)
    (block $done (loop $lp
      (br_if $done (i32.eqz (local.get $n)))
      (local.set $ca (i32.load8_u (local.get $a)))
      (local.set $cb (i32.load8_u (local.get $b)))
      (if (i32.and (i32.ge_u (local.get $ca) (i32.const 0x41))
                   (i32.le_u (local.get $ca) (i32.const 0x5A)))
        (then (local.set $ca (i32.or (local.get $ca) (i32.const 0x20)))))
      (if (i32.and (i32.ge_u (local.get $cb) (i32.const 0x41))
                   (i32.le_u (local.get $cb) (i32.const 0x5A)))
        (then (local.set $cb (i32.or (local.get $cb) (i32.const 0x20)))))
      (if (i32.ne (local.get $ca) (local.get $cb))
        (then (return (i32.const 0))))
      (local.set $a (i32.add (local.get $a) (i32.const 1)))
      (local.set $b (i32.add (local.get $b) (i32.const 1)))
      (local.set $n (i32.sub (local.get $n) (i32.const 1)))
      (br $lp)))
    (i32.const 1))

  ;; An owner-draw listbox gets its row height from the owner, not from us:
  ;; USER sends WM_MEASUREITEM and the owner fills in itemHeight. HyperTerminal
  ;; asks for a 32px row so a full icon fits; against our fixed 16 it drew each
  ;; icon 8px above the row it belonged to and the list came out empty-looking.
  ;;
  ;; MEASUREITEMSTRUCT: +0 CtlType, +4 CtlID, +8 itemID, +12 itemWidth,
  ;; +16 itemHeight, +20 itemData. We ask once, for item 0, which is exactly
  ;; right for LBS_OWNERDRAWFIXED; a VARIABLE listbox gets item 0's height for
  ;; every row, which is still far closer than ignoring the owner entirely.
  (func $lb_measure_item (param $hwnd i32) (param $sw i32) (result i32)
    (local $mis i32) (local $misw i32) (local $h i32)
    (local.set $mis (call $heap_alloc (i32.const 24)))
    (local.set $misw (call $g2w (local.get $mis)))
    (i32.store           (local.get $misw) (i32.const 2))   ;; ODT_LISTBOX
    (i32.store offset=4  (local.get $misw) (call $ctrl_table_get_id (local.get $hwnd)))
    (i32.store offset=8  (local.get $misw) (i32.const 0))
    (i32.store offset=12 (local.get $misw) (i32.const 0))
    (i32.store offset=16 (local.get $misw) (i32.const 16))
    (i32.store offset=20 (local.get $misw) (i32.const 0))
    (drop (call $wnd_send_message
            (call $wnd_get_parent (local.get $hwnd))
            (i32.const 0x002C)
            (call $ctrl_table_get_id (local.get $hwnd))
            (local.get $mis)))
    (local.set $h (i32.load offset=16 (local.get $misw)))
    (call $heap_free (local.get $mis))
    ;; An owner that ignores the message leaves our 16 in place; one that
    ;; answers with nonsense must not divide the row loop by zero.
    (if (i32.or (i32.lt_s (local.get $h) (i32.const 1))
                (i32.gt_s (local.get $h) (i32.const 255)))
      (then (local.set $h (i32.const 16))))
    (local.get $h))

  ;; An LBS_OWNERDRAW* listbox draws none of its own rows: USER hands each
  ;; visible item to the owner as WM_DRAWITEM and the owner paints it. Without
  ;; this we fell through to $gdi_native_text_out on the item string, which for
  ;; such a listbox is not a label at all -- HyperTerminal's icon picker stores
  ;; "Hilgraeve is Great !!!" in every slot and paints the icon from itemData,
  ;; so the dialog came up with the same joke string repeated down the list.
  ;;
  ;; Modelled on $btn_send_drawitem: DRAWITEMSTRUCT is 48 bytes on the heap,
  ;; sent synchronously, then freed. The rect is in the listbox's own client
  ;; coordinates, which is what the child DC (hwnd + 0x40000) is already based
  ;; on, so no translation is needed.
  (func $lb_send_drawitem
      (param $hwnd i32) (param $sw i32) (param $idx i32)
      (param $row_y i32) (param $w i32) (param $row_h i32) (param $selected i32)
    (local $dis i32) (local $disw i32) (local $hdc i32) (local $data i32)
    (local.set $hdc (i32.add (local.get $hwnd) (i32.const 0x40000)))
    ;; itemData is whatever LB_SETITEMDATA stored; a listbox that was never
    ;; given any keeps the field zero rather than reading off the null array.
    (if (call $lb_data_ptr (local.get $sw))
      (then
        (local.set $data
          (i32.load (i32.add (call $g2w (call $lb_data_ptr (local.get $sw)))
                             (i32.mul (local.get $idx) (i32.const 4)))))))
    (local.set $dis (call $heap_alloc (i32.const 48)))
    (local.set $disw (call $g2w (local.get $dis)))
    (i32.store           (local.get $disw) (i32.const 2))    ;; ODT_LISTBOX
    (i32.store offset=4  (local.get $disw) (call $ctrl_table_get_id (local.get $hwnd)))
    (i32.store offset=8  (local.get $disw) (local.get $idx))
    (i32.store offset=12 (local.get $disw) (i32.const 1))     ;; ODA_DRAWENTIRE
    (i32.store offset=16 (local.get $disw)
      (select (i32.const 0x0001) (i32.const 0) (local.get $selected)))
    (i32.store offset=20 (local.get $disw) (local.get $hwnd))
    (i32.store offset=24 (local.get $disw) (local.get $hdc))
    (i32.store offset=28 (local.get $disw) (i32.const 2))
    (i32.store offset=32 (local.get $disw) (local.get $row_y))
    (i32.store offset=36 (local.get $disw) (local.get $w))
    (i32.store offset=40 (local.get $disw) (i32.add (local.get $row_y) (local.get $row_h)))
    (i32.store offset=44 (local.get $disw) (local.get $data))
    (drop (call $wnd_send_message
            (call $wnd_get_parent (local.get $hwnd))
            (i32.const 0x002B)
            (call $ctrl_table_get_id (local.get $hwnd))
            (local.get $dis)))
    (call $heap_free (local.get $dis)))

