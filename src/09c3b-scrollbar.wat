  ;; Draw a scrollbar arrow button: edge box + 4-row triangle glyph.
  ;; dir: 0=up, 1=down, 2=left, 3=right
  ;; (bit0 = apex-trailing, bit1 = horizontal axis)
  ;; pressed: 0 = raised, 1 = sunken + glyph shifted 1px down/right
  ;; disabled: draw Win98's embossed white/gray glyph and never sink the edge
  (func $draw_sb_arrow (param $hdc i32) (param $bx i32) (param $by i32)
                       (param $bw i32) (param $bh i32) (param $dir i32)
                       (param $pressed i32) (param $disabled i32)
    (local $cx i32) (local $cy i32) (local $i i32) (local $u i32) (local $half i32)
    (local $active_pressed i32) (local $glyph_brush i32)
    (local.set $active_pressed
      (i32.and (local.get $pressed) (i32.eqz (local.get $disabled))))
    (local.set $glyph_brush
      (select (i32.const 0x30012) (i32.const 0x30014) (local.get $disabled)))
    ;; Background fill + 3D edge (raised normally, sunken when pressed).
    (drop (call $gdi_native_fill_rect (local.get $hdc)
            (local.get $bx) (local.get $by)
            (i32.add (local.get $bx) (local.get $bw))
            (i32.add (local.get $by) (local.get $bh))
            (i32.const 0x30011))) ;; LTGRAY_BRUSH
    (drop (call $gdi_native_draw_edge (local.get $hdc)
            (local.get $bx) (local.get $by)
            (i32.add (local.get $bx) (local.get $bw))
            (i32.add (local.get $by) (local.get $bh))
            (select (i32.const 0x0A) (i32.const 0x05) (local.get $active_pressed)) ;; BDR_SUNKEN : BDR_RAISED
            (i32.const 0x0F))) ;; BF_RECT
    ;; Glyph center (shift 1px down/right when pressed for the classic Win98 look).
    (local.set $cx (i32.add (i32.add (local.get $bx) (i32.div_s (local.get $bw) (i32.const 2))) (local.get $active_pressed)))
    (local.set $cy (i32.add (i32.add (local.get $by) (i32.div_s (local.get $bh) (i32.const 2))) (local.get $active_pressed)))
    ;; 4 1-thick scanlines forming a triangle (1,3,5,7 wide).
    (local.set $i (i32.const 0))
    (block $end (loop $next
      (br_if $end (i32.ge_s (local.get $i) (i32.const 4)))
      (local.set $u (i32.sub (local.get $i) (i32.const 2)))
      ;; half-extent: bit0=0 → i (apex first); bit0=1 → 3-i (apex last)
      (if (i32.and (local.get $dir) (i32.const 1))
        (then (local.set $half (i32.sub (i32.const 3) (local.get $i))))
        (else (local.set $half (local.get $i))))
      (if (i32.and (local.get $dir) (i32.const 2))
        (then ;; horizontal: u→x, half→y
          (if (local.get $disabled)
            (then
              (drop (call $gdi_native_fill_rect (local.get $hdc)
                (i32.add (i32.add (local.get $cx) (local.get $u)) (i32.const 1))
                (i32.add (i32.sub (local.get $cy) (local.get $half)) (i32.const 1))
                (i32.add (i32.add (local.get $cx) (local.get $u)) (i32.const 2))
                (i32.add (i32.add (local.get $cy) (local.get $half)) (i32.const 2))
                (i32.const 0x30010))))) ;; WHITE_BRUSH highlight
          (drop (call $gdi_native_fill_rect (local.get $hdc)
                  (i32.add (local.get $cx) (local.get $u))
                  (i32.sub (local.get $cy) (local.get $half))
                  (i32.add (i32.add (local.get $cx) (local.get $u)) (i32.const 1))
                  (i32.add (i32.add (local.get $cy) (local.get $half)) (i32.const 1))
                  (local.get $glyph_brush))))
        (else ;; vertical: u→y, half→x
          (if (local.get $disabled)
            (then
              (drop (call $gdi_native_fill_rect (local.get $hdc)
                (i32.add (i32.sub (local.get $cx) (local.get $half)) (i32.const 1))
                (i32.add (i32.add (local.get $cy) (local.get $u)) (i32.const 1))
                (i32.add (i32.add (local.get $cx) (local.get $half)) (i32.const 2))
                (i32.add (i32.add (local.get $cy) (local.get $u)) (i32.const 2))
                (i32.const 0x30010))))) ;; WHITE_BRUSH highlight
          (drop (call $gdi_native_fill_rect (local.get $hdc)
                  (i32.sub (local.get $cx) (local.get $half))
                  (i32.add (local.get $cy) (local.get $u))
                  (i32.add (i32.add (local.get $cx) (local.get $half)) (i32.const 1))
                  (i32.add (i32.add (local.get $cy) (local.get $u)) (i32.const 1))
                  (local.get $glyph_brush)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $next))))

  ;; Paint a vertical scrollbar strip (track + two arrows + thumb) inside
  ;; (bx, by, bw, bh). Used by WS_VSCROLL-decorated controls (listbox, edit);
  ;; the standalone SCROLLBAR control does its own inline drawing.
  ;;
  ;; pos      — scroll position in [0, range]
  ;; range    — max scrollable units (0 = no thumb, arrows only)
  ;; pressed  — 0=none, 1=up arrow held, 2=down arrow held
  ;; One scrollbar thumb: light-gray face with a raised edge. Both the shared
  ;; strip painter and the standalone SCROLLBAR control draw through this, so
  ;; they cannot disagree about it again — the control used to inset the thumb
  ;; 2px on the cross axis while the strip painter drew it full width, which is
  ;; visible whenever both appear on screen. Win98 draws the thumb the full
  ;; width of the strip.
  (func $paint_sb_thumb (param $hdc i32) (param $l i32) (param $t i32) (param $r i32) (param $b i32)
    (drop (call $gdi_native_fill_rect (local.get $hdc)
            (local.get $l) (local.get $t) (local.get $r) (local.get $b)
            (i32.const 0x30011)))   ;; LTGRAY_BRUSH
    (drop (call $gdi_native_draw_edge (local.get $hdc)
            (local.get $l) (local.get $t) (local.get $r) (local.get $b)
            (i32.const 0x05) (i32.const 0x0F))))  ;; BDR_RAISED, BF_RECT

  (func $paint_vscrollbar_rect
        (param $hdc i32) (param $bx i32) (param $by i32)
        (param $bw i32) (param $bh i32)
        (param $pos i32) (param $range i32) (param $pressed i32)
        (param $disabled i32)
    (local $arrow i32) (local $track_y i32) (local $track_h i32)
    (local $thumb_size i32) (local $thumb_pos i32)
    ;; Track background + sunken edge.
    (drop (call $gdi_native_fill_rect (local.get $hdc)
            (local.get $bx) (local.get $by)
            (i32.add (local.get $bx) (local.get $bw))
            (i32.add (local.get $by) (local.get $bh))
            (i32.const 0x30011))) ;; LTGRAY_BRUSH
    ;; Arrows: 16px at each end, suppressed if strip too short.
    (local.set $arrow (call $scrollbar_arrow_size (local.get $bh)))
    (if (local.get $arrow)
      (then
        (call $draw_sb_arrow (local.get $hdc)
          (local.get $bx) (local.get $by)
          (local.get $bw) (local.get $arrow)
          (i32.const 0) ;; up
          (i32.eq (local.get $pressed) (i32.const 1))
          (i32.and (local.get $disabled) (i32.const 1)))
        (call $draw_sb_arrow (local.get $hdc)
          (local.get $bx) (i32.sub (i32.add (local.get $by) (local.get $bh)) (local.get $arrow))
          (local.get $bw) (local.get $arrow)
          (i32.const 1) ;; down
          (i32.eq (local.get $pressed) (i32.const 2))
          (i32.and (local.get $disabled) (i32.const 2)))))
    ;; Thumb. Skip when range is empty (nothing to scroll).
    (if (i32.gt_s (local.get $range) (i32.const 0))
      (then
        (local.set $thumb_size (call $scrollbar_thumb_size (local.get $bh) (local.get $range)))
        (if (local.get $thumb_size)
          (then
            (local.set $thumb_pos
              (i32.add (local.get $by)
                (call $scrollbar_thumb_pos
                  (local.get $bh) (local.get $pos) (i32.const 0) (local.get $range))))
            (call $paint_sb_thumb (local.get $hdc)
              (local.get $bx) (local.get $thumb_pos)
              (i32.add (local.get $bx) (local.get $bw))
              (i32.add (local.get $thumb_pos) (local.get $thumb_size)))))))
  )

  ;; Track-click classifier for a WS_VSCROLL listbox strip. Computes the
  ;; thumb position using the same geometry as $paint_vscrollbar_rect
  ;; (arrow=16, track = h - 32). Returns:
  ;;   0 — geometry degenerate, caller ignores
  ;;   1 — click above thumb: pages up (top -= visible, mutated + stored)
  ;;   2 — click below thumb: pages down (top += visible, mutated + stored)
  ;;   3 — click ON the thumb: caller should begin a drag. Stashes
  ;;       drag_anchor_y (= row_y) and drag_anchor_top (= current top)
  ;;       at ListBoxState+28 / +32 so WM_MOUSEMOVE can recompute top
  ;;       from the cursor delta.
  ;; Arrow length along the long axis. USER gives each arrow SM_CYVSCROLL
  ;; (16) until the bar is too short for two of them plus a 4px minimum
  ;; track; below that the two arrows split what is left, (len - 4) / 2 each.
  ;; That is what makes a 24px SBS_VERT bar a spinner (SimCity 2000's budget
  ;; window): two 10px arrows and no thumb. Returning 0 there left the
  ;; control with nothing to draw and nothing to click.
  (func $scrollbar_arrow_size (param $long_dim i32) (result i32)
    (if (result i32) (i32.gt_s (local.get $long_dim) (i32.const 36))
      (then (i32.const 16))
      (else (if (result i32) (i32.gt_s (local.get $long_dim) (i32.const 4))
        (then (i32.shr_u (i32.sub (local.get $long_dim) (i32.const 4)) (i32.const 1)))
        (else (i32.const 0))))))

  (func $scrollbar_thumb_size (param $long_dim i32) (param $range i32) (result i32)
    (local $arrow i32) (local $track_len i32) (local $thumb_size i32)
    (if (i32.le_s (local.get $range) (i32.const 0)) (then (return (i32.const 0))))
    (local.set $arrow (call $scrollbar_arrow_size (local.get $long_dim)))
    (local.set $track_len
      (i32.sub (local.get $long_dim)
        (select (i32.mul (local.get $arrow) (i32.const 2))
                (i32.const 4)
                (local.get $arrow))))
    ;; Under 6px of track USER draws no thumb at all (SCROLL_MIN_THUMB).
    (if (i32.lt_s (local.get $track_len) (i32.const 6)) (then (return (i32.const 0))))
    (local.set $thumb_size (i32.div_u (local.get $track_len) (i32.add (local.get $range) (i32.const 1))))
    (if (i32.lt_u (local.get $thumb_size) (i32.const 16))
      (then (local.set $thumb_size (i32.const 16))))
    (if (i32.gt_u (local.get $thumb_size) (local.get $track_len))
      (then (local.set $thumb_size (local.get $track_len))))
    (local.get $thumb_size))

  (func $scrollbar_thumb_pos (param $long_dim i32) (param $pos i32) (param $smin i32) (param $smax i32) (result i32)
    (local $arrow i32) (local $track_len i32) (local $thumb_size i32) (local $range i32)
    (local.set $range (i32.sub (local.get $smax) (local.get $smin)))
    (local.set $arrow (call $scrollbar_arrow_size (local.get $long_dim)))
    (local.set $track_len
      (i32.sub (local.get $long_dim)
        (select (i32.mul (local.get $arrow) (i32.const 2))
                (i32.const 4)
                (local.get $arrow))))
    (local.set $thumb_size (call $scrollbar_thumb_size (local.get $long_dim) (local.get $range)))
    (if (i32.eqz (local.get $thumb_size))
      (then (return (select (local.get $arrow) (i32.const 2) (local.get $arrow)))))
    (if (i32.le_s (local.get $range) (i32.const 0))
      (then (return (select (local.get $arrow) (i32.const 2) (local.get $arrow)))))
    (i32.add (select (local.get $arrow) (i32.const 2) (local.get $arrow))
      (i32.div_u
        (i32.mul
          (i32.sub (local.get $pos) (local.get $smin))
          (i32.sub (local.get $track_len) (local.get $thumb_size)))
        (local.get $range))))

  ;; ---- SCROLLINFO scrollbar geometry ----------------------------------
  ;; The helpers below this block predate SCROLLINFO: they size the thumb from
  ;; the range alone, which is what TreeView and ListView still expect. USER's
  ;; own scrollbars size it from nPage instead -- the thumb is as big a
  ;; fraction of the track as the visible page is of the document -- and the
  ;; last valid position is smax - (nPage - 1), not smax.
  ;;
  ;; $defwndproc_paint_standard_scrollbar drew the frame scrollbars with that
  ;; second model inline, so nothing else could hit-test what it painted.
  ;; These are that model, factored out, so the painter and the hit test agree
  ;; by construction rather than by two people doing the same arithmetic.
  (func $sb_track_len (param $long_dim i32) (result i32)
    (i32.sub (local.get $long_dim)
      (i32.mul (call $scrollbar_arrow_size (local.get $long_dim)) (i32.const 2))))

  ;; Thumb length in pixels. total = smax - smin + 1 scroll units.
  (func $sb_page_thumb (param $track i32) (param $page i32) (param $total i32) (result i32)
    (local $thumb i32)
    (if (i32.or (i32.lt_s (local.get $track) (i32.const 6))
                (i32.le_s (local.get $total) (i32.const 0)))
      (then (return (i32.const 0))))
    (local.set $thumb
      (if (result i32) (i32.gt_u (local.get $page) (i32.const 0))
        (then (i32.div_u (i32.mul (local.get $track) (local.get $page)) (local.get $total)))
        (else (i32.const 16))))
    (if (i32.lt_u (local.get $thumb) (i32.const 16)) (then (local.set $thumb (i32.const 16))))
    (if (i32.gt_u (local.get $thumb) (local.get $track)) (then (local.set $thumb (local.get $track))))
    (local.get $thumb))

  ;; Highest position the thumb can represent: a full page is always visible.
  (func $sb_page_max_pos (param $smin i32) (param $smax i32) (param $page i32) (result i32)
    (local $max_pos i32)
    (local.set $max_pos (local.get $smax))
    (if (i32.gt_u (local.get $page) (i32.const 1))
      (then (local.set $max_pos
        (i32.sub (local.get $smax) (i32.sub (local.get $page) (i32.const 1))))))
    (if (i32.lt_s (local.get $max_pos) (local.get $smin))
      (then (local.set $max_pos (local.get $smin))))
    (local.get $max_pos))

  ;; Offset of the thumb from the start of the long axis (past the low arrow).
  (func $sb_page_thumb_pos (param $long_dim i32) (param $pos i32)
        (param $smin i32) (param $smax i32) (param $page i32) (result i32)
    (local $arrow i32) (local $track i32) (local $thumb i32)
    (local $max_pos i32) (local $range i32) (local $travel i32)
    (local.set $arrow (call $scrollbar_arrow_size (local.get $long_dim)))
    (local.set $track (call $sb_track_len (local.get $long_dim)))
    (local.set $thumb (call $sb_page_thumb (local.get $track) (local.get $page)
      (i32.add (i32.sub (local.get $smax) (local.get $smin)) (i32.const 1))))
    (local.set $max_pos (call $sb_page_max_pos
      (local.get $smin) (local.get $smax) (local.get $page)))
    (local.set $range (i32.sub (local.get $max_pos) (local.get $smin)))
    (local.set $travel (i32.sub (local.get $track) (local.get $thumb)))
    (if (i32.or (i32.le_s (local.get $range) (i32.const 0))
                (i32.le_s (local.get $travel) (i32.const 0)))
      (then (return (local.get $arrow))))
    (i32.add (local.get $arrow)
      (i32.div_u
        (i32.mul (i32.sub (local.get $pos) (local.get $smin)) (local.get $travel))
        (local.get $range))))

  ;; Which part of a SCROLLINFO scrollbar a coordinate lands on. Same return
  ;; codes as $scrollbar_hit_part: 0 none, 1 low arrow, 2 high arrow,
  ;; 3 page towards min, 4 page towards max, 5 thumb.
  (func $sb_page_hit_part (param $long_dim i32) (param $coord i32)
        (param $pos i32) (param $smin i32) (param $smax i32) (param $page i32)
        (result i32)
    (local $arrow i32) (local $thumb i32) (local $thumb_pos i32)
    (local.set $arrow (call $scrollbar_arrow_size (local.get $long_dim)))
    (if (local.get $arrow)
      (then
        (if (i32.lt_s (local.get $coord) (local.get $arrow))
          (then (return (i32.const 1))))
        (if (i32.ge_s (local.get $coord) (i32.sub (local.get $long_dim) (local.get $arrow)))
          (then (return (i32.const 2))))))
    (if (i32.le_s (i32.sub (local.get $smax) (local.get $smin)) (i32.const 0))
      (then (return (i32.const 0))))
    (local.set $thumb (call $sb_page_thumb
      (call $sb_track_len (local.get $long_dim)) (local.get $page)
      (i32.add (i32.sub (local.get $smax) (local.get $smin)) (i32.const 1))))
    (if (i32.eqz (local.get $thumb)) (then (return (i32.const 0))))
    (local.set $thumb_pos (call $sb_page_thumb_pos (local.get $long_dim)
      (local.get $pos) (local.get $smin) (local.get $smax) (local.get $page)))
    (if (i32.lt_s (local.get $coord) (local.get $thumb_pos))
      (then (return (i32.const 3))))
    (if (i32.ge_s (local.get $coord) (i32.add (local.get $thumb_pos) (local.get $thumb)))
      (then (return (i32.const 4))))
    (i32.const 5))

  ;; Position for a thumb dragged to $coord, given where the drag started.
  (func $sb_page_drag_pos (param $long_dim i32) (param $coord i32)
        (param $anchor_coord i32) (param $anchor_pos i32)
        (param $smin i32) (param $smax i32) (param $page i32) (result i32)
    (local $track i32) (local $thumb i32) (local $max_pos i32)
    (local $range i32) (local $travel i32) (local $pos i32)
    (local.set $track (call $sb_track_len (local.get $long_dim)))
    (local.set $thumb (call $sb_page_thumb (local.get $track) (local.get $page)
      (i32.add (i32.sub (local.get $smax) (local.get $smin)) (i32.const 1))))
    (local.set $max_pos (call $sb_page_max_pos
      (local.get $smin) (local.get $smax) (local.get $page)))
    (local.set $range (i32.sub (local.get $max_pos) (local.get $smin)))
    (local.set $travel (i32.sub (local.get $track) (local.get $thumb)))
    (if (i32.or (i32.le_s (local.get $range) (i32.const 0))
                (i32.le_s (local.get $travel) (i32.const 0)))
      (then (return (local.get $anchor_pos))))
    (local.set $pos (i32.add (local.get $anchor_pos)
      (i32.div_s
        (i32.mul (i32.sub (local.get $coord) (local.get $anchor_coord)) (local.get $range))
        (local.get $travel))))
    (if (i32.lt_s (local.get $pos) (local.get $smin)) (then (local.set $pos (local.get $smin))))
    (if (i32.gt_s (local.get $pos) (local.get $max_pos)) (then (local.set $pos (local.get $max_pos))))
    (local.get $pos))

  ;; Generic scrollbar hit test on the long axis. Returns:
  ;; 0=none/disabled, 1=low arrow, 2=high arrow, 3=low page, 4=high page, 5=thumb.
  (func $scrollbar_hit_part
        (param $long_dim i32) (param $coord i32)
        (param $pos i32) (param $smin i32) (param $smax i32) (result i32)
    (local $arrow i32) (local $range i32) (local $thumb_size i32) (local $thumb_pos i32)
    (local.set $arrow (call $scrollbar_arrow_size (local.get $long_dim)))
    (if (local.get $arrow)
      (then
        (if (i32.lt_s (local.get $coord) (local.get $arrow))
          (then (return (i32.const 1))))
        (if (i32.ge_s (local.get $coord) (i32.sub (local.get $long_dim) (local.get $arrow)))
          (then (return (i32.const 2))))))
    (local.set $range (i32.sub (local.get $smax) (local.get $smin)))
    (if (i32.le_s (local.get $range) (i32.const 0)) (then (return (i32.const 0))))
    (local.set $thumb_size (call $scrollbar_thumb_size (local.get $long_dim) (local.get $range)))
    (if (i32.eqz (local.get $thumb_size)) (then (return (i32.const 0))))
    (local.set $thumb_pos (call $scrollbar_thumb_pos
      (local.get $long_dim) (local.get $pos) (local.get $smin) (local.get $smax)))
    (if (i32.lt_s (local.get $coord) (local.get $thumb_pos))
      (then (return (i32.const 3))))
    (if (i32.ge_s (local.get $coord) (i32.add (local.get $thumb_pos) (local.get $thumb_size)))
      (then (return (i32.const 4))))
    (i32.const 5))

  (func $scrollbar_drag_pos
        (param $long_dim i32) (param $coord i32)
        (param $anchor_coord i32) (param $anchor_pos i32)
        (param $smin i32) (param $smax i32) (result i32)
    (local $arrow i32) (local $track_len i32) (local $thumb_size i32)
    (local $range i32) (local $travel i32) (local $new_pos i32)
    (local.set $range (i32.sub (local.get $smax) (local.get $smin)))
    (if (i32.le_s (local.get $range) (i32.const 0)) (then (return (local.get $smin))))
    (local.set $arrow (call $scrollbar_arrow_size (local.get $long_dim)))
    (local.set $track_len
      (i32.sub (local.get $long_dim)
        (select (i32.mul (local.get $arrow) (i32.const 2))
                (i32.const 4)
                (local.get $arrow))))
    (local.set $thumb_size (call $scrollbar_thumb_size (local.get $long_dim) (local.get $range)))
    (local.set $travel (i32.sub (local.get $track_len) (local.get $thumb_size)))
    (if (i32.le_s (local.get $travel) (i32.const 0)) (then (return (local.get $anchor_pos))))
    (local.set $new_pos
      (i32.add (local.get $anchor_pos)
        (i32.div_s
          (i32.mul (i32.sub (local.get $coord) (local.get $anchor_coord)) (local.get $range))
          (local.get $travel))))
    (if (i32.lt_s (local.get $new_pos) (local.get $smin))
      (then (local.set $new_pos (local.get $smin))))
    (if (i32.gt_s (local.get $new_pos) (local.get $smax))
      (then (local.set $new_pos (local.get $smax))))
    (local.get $new_pos))

  (func $listbox_page_hit
        (param $hwnd i32) (param $sw i32)
        (param $row_y i32) (param $h i32)
        (param $top i32) (param $max i32) (param $visible i32) (result i32)
    (local $hit i32) (local $new_top i32)
    (if (i32.lt_s (local.get $visible) (i32.const 1))
      (then (local.set $visible (i32.const 1))))
    (local.set $hit (call $scroll_arrow_filter_hit
      (local.get $hwnd) (i32.const 1)
      (call $scrollbar_hit_part
        (local.get $h) (local.get $row_y)
        (local.get $top) (i32.const 0) (local.get $max))))
    (if (i32.eq (local.get $hit) (i32.const 3))
      (then
        (local.set $new_top (i32.sub (local.get $top) (local.get $visible)))
        (if (i32.lt_s (local.get $new_top) (i32.const 0))
          (then (local.set $new_top (i32.const 0))))
        (call $lb_set_top_index (local.get $sw) (local.get $new_top))
        (return (i32.const 1))))
    (if (i32.eq (local.get $hit) (i32.const 4))
      (then
        (local.set $new_top (i32.add (local.get $top) (local.get $visible)))
        (if (i32.gt_s (local.get $new_top) (local.get $max))
          (then (local.set $new_top (local.get $max))))
        (call $lb_set_top_index (local.get $sw) (local.get $new_top))
        (return (i32.const 2))))
    (if (i32.eq (local.get $hit) (i32.const 5))
      (then
        (call $lb_set_drag_anchor_y (local.get $sw) (local.get $row_y))
        (call $lb_set_drag_anchor_top (local.get $sw) (local.get $top))
        (return (i32.const 3))))
    (i32.const 0))

  ;; Recompute top_index from the current cursor y during a thumb drag.
  ;; Anchors (drag_anchor_y at +28, drag_anchor_top at +32) were stashed
  ;; when the drag started. new_top = anchor_top + delta_y * max / range,
  ;; clamped to [0, max], where range = track_h - thumb_size. Uses the
  ;; same geometry as $paint_vscrollbar_rect.
  (func $listbox_drag_to
        (param $hwnd i32) (param $sw i32)
        (param $row_y i32) (param $h i32) (param $max i32)
    (call $lb_set_top_index (local.get $sw)
      (call $scrollbar_drag_pos
        (local.get $h) (local.get $row_y)
        (call $lb_drag_anchor_y (local.get $sw))
        (call $lb_drag_anchor_top (local.get $sw))
        (i32.const 0) (local.get $max))))

  ;; ScrollBar control wndproc (class 7).
  ;; Draws a Win98-style scrollbar: arrow button at each end + sunken track + raised thumb.
  ;; Reads position/range from SCROLL_TABLE (set via SetScrollPos/SetScrollRange).
  (func $scrollbar_ctrl_wndproc (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $hdc i32) (local $sz i32) (local $w i32) (local $h i32)
    (local $slot i32) (local $base i32) (local $pos i32) (local $smin i32) (local $smax i32)
    (local $style i32) (local $is_vert i32) (local $track_len i32) (local $thumb_size i32)
    (local $thumb_pos i32) (local $range i32) (local $brush i32)
    (local $arrow i32) (local $long_dim i32)
    (local $mx i32) (local $my i32) (local $part i32) (local $parent i32)
    (local $sb_msg i32) (local $sb_code i32)
    (local $is_pressed i32) (local $coord i32) (local $new_pos i32)
    (local $disabled i32) (local $changed i32)

    ;; SBM_ENABLE_ARROWS (0x00E4): the message form reports success for every
    ;; valid ESB_* request, while EnableScrollBar itself reports only a state
    ;; transition. Both write the same per-window state.
    (if (i32.eq (local.get $msg) (i32.const 0x00E4))
      (then
        (if (i32.gt_u (local.get $wParam) (i32.const 3))
          (then (return (i32.const 0))))
        (local.set $slot (call $wnd_table_find (local.get $hwnd)))
        (if (i32.lt_s (local.get $slot) (i32.const 0))
          (then (return (i32.const 0))))
        (local.set $style (call $wnd_get_style (local.get $hwnd)))
        (local.set $is_vert
          (i32.ne (i32.and (local.get $style) (i32.const 1)) (i32.const 0)))
        (local.set $changed (call $scroll_arrow_set_slot
          (local.get $slot) (local.get $is_vert) (local.get $wParam)))
        (if (local.get $changed)
          (then (call $invalidate_hwnd (local.get $hwnd))))
        (return (i32.const 1))))

    ;; WM_CREATE: SBS_LEFTALIGN/SBS_RIGHTALIGN (SBS_VERT) and
    ;; SBS_TOPALIGN/SBS_BOTTOMALIGN (SBS_HORZ) share bits 2 and 4. They ask
    ;; USER for the standard thickness along one edge of the rectangle the
    ;; caller gave, so an app may create one 0x0 (or any size) and never
    ;; move it again -- SimCity 2000 Net's chat log does exactly that, and
    ;; without this its scroll bar stays 0 wide beside a text box laid out
    ;; from the bar's rect. Wine and ReactOS both size it SM_CXVSCROLL+1.
    (if (i32.eq (local.get $msg) (i32.const 0x0001))
      (then
        (local.set $style (i32.load offset=32 (call $g2w (local.get $lParam))))
        (if (i32.and (i32.eqz (i32.and (local.get $style) (i32.const 0x18)))
                     (i32.ne (i32.and (local.get $style) (i32.const 6)) (i32.const 0)))
          (then
            (local.set $mx (call $gl32 (i32.add (local.get $lParam) (i32.const 28))))
            (local.set $my (call $gl32 (i32.add (local.get $lParam) (i32.const 24))))
            (local.set $w (call $gl32 (i32.add (local.get $lParam) (i32.const 20))))
            (local.set $h (call $gl32 (i32.add (local.get $lParam) (i32.const 16))))
            (if (i32.and (local.get $style) (i32.const 1))
              (then
                (if (i32.and (local.get $style) (i32.const 4))
                  (then (local.set $mx (i32.sub (i32.add (local.get $mx) (local.get $w)) (i32.const 17)))))
                (local.set $w (i32.const 17)))
              (else
                (if (i32.and (local.get $style) (i32.const 4))
                  (then (local.set $my (i32.sub (i32.add (local.get $my) (local.get $h)) (i32.const 17)))))
                (local.set $h (i32.const 17))))
            (drop (call $move_window_core (local.get $hwnd) (i32.const 0)
              (local.get $mx) (local.get $my) (local.get $w) (local.get $h)
              (i32.const 0x1c) (i32.const 0)))))
        (return (i32.const 0))))

    ;; --- Mouse input: arrows, page regions, and thumb drag ---
    ;; WM_LBUTTONDOWN
    (if (i32.eq (local.get $msg) (i32.const 0x0201))
      (then
        (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
        (local.set $w (i32.and (local.get $sz) (i32.const 0xFFFF)))
        (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
        (local.set $style (call $wnd_get_style (local.get $hwnd)))
        (local.set $is_vert (i32.and (local.get $style) (i32.const 1)))
        (local.set $long_dim (select (local.get $h) (local.get $w) (local.get $is_vert)))
        (local.set $arrow (i32.const 16))
        (if (i32.lt_s (local.get $long_dim) (i32.const 36))
          (then (local.set $arrow (i32.const 0))))
        ;; lParam: low word = x, high word = y (signed 16-bit)
        (local.set $mx (i32.shr_s (i32.shl (local.get $lParam) (i32.const 16)) (i32.const 16)))
        (local.set $my (i32.shr_s (local.get $lParam) (i32.const 16)))
        (local.set $coord (select (local.get $my) (local.get $mx) (local.get $is_vert)))
        (local.set $slot (call $wnd_table_find (local.get $hwnd)))
        (if (i32.ge_s (local.get $slot) (i32.const 0))
          (then
            (local.set $base (call $scroll_bar_addr (local.get $slot) (local.get $is_vert)))
            (local.set $pos (i32.load (local.get $base)))
            (local.set $smin (i32.load offset=4 (local.get $base)))
            (local.set $smax (i32.load offset=8 (local.get $base)))))
        (local.set $part (call $scroll_arrow_filter_hit
          (local.get $hwnd) (local.get $is_vert)
          (call $scrollbar_hit_part
            (local.get $long_dim) (local.get $coord)
            (local.get $pos) (local.get $smin) (local.get $smax))))
        (if (local.get $part)
          (then
            (global.set $sb_pressed_hwnd (local.get $hwnd))
            (global.set $sb_pressed_part (local.get $part))
            (if (i32.eq (local.get $part) (i32.const 5))
              (then
                (global.set $capture_hwnd (local.get $hwnd))
                (global.set $sb_drag_anchor_coord (local.get $coord))
                (global.set $sb_drag_anchor_pos (local.get $pos))))
            (drop (call $wnd_send_message
              (local.get $hwnd) (i32.const 0x000F) (i32.const 0) (i32.const 0)))
            (call $invalidate_hwnd (local.get $hwnd))
            ;; Send WM_VSCROLL (0x115) / WM_HSCROLL (0x114) to parent.
            ;; SB_LINE*=0/1, SB_PAGE*=2/3. Thumb sends while dragging.
            (local.set $sb_code
              (if (result i32) (i32.eq (local.get $part) (i32.const 1))
                (then (i32.const 0))
                (else (if (result i32) (i32.eq (local.get $part) (i32.const 2))
                  (then (i32.const 1))
                  (else (if (result i32) (i32.eq (local.get $part) (i32.const 3))
                    (then (i32.const 2))
                    (else (if (result i32) (i32.eq (local.get $part) (i32.const 4))
                      (then (i32.const 3))
                      (else (i32.const 5))))))))))
            (if (i32.ne (local.get $part) (i32.const 5))
              (then
                (local.set $sb_msg (select (i32.const 0x115) (i32.const 0x114) (local.get $is_vert)))
                (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
                (drop (call $wnd_send_message (local.get $parent) (local.get $sb_msg)
                        (local.get $sb_code) (local.get $hwnd)))))))
        (return (i32.const 0))))

    ;; WM_MOUSEMOVE — update SCROLL_TABLE and notify parent while dragging thumb.
    (if (i32.eq (local.get $msg) (i32.const 0x0200))
      (then
        (if (i32.and (i32.eq (global.get $sb_pressed_hwnd) (local.get $hwnd))
                     (i32.eq (global.get $sb_pressed_part) (i32.const 5)))
          (then
            (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
            (local.set $w (i32.and (local.get $sz) (i32.const 0xFFFF)))
            (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
            (local.set $style (call $wnd_get_style (local.get $hwnd)))
            (local.set $is_vert (i32.and (local.get $style) (i32.const 1)))
            (local.set $long_dim (select (local.get $h) (local.get $w) (local.get $is_vert)))
            (local.set $mx (i32.shr_s (i32.shl (local.get $lParam) (i32.const 16)) (i32.const 16)))
            (local.set $my (i32.shr_s (local.get $lParam) (i32.const 16)))
            (local.set $coord (select (local.get $my) (local.get $mx) (local.get $is_vert)))
            (local.set $slot (call $wnd_table_find (local.get $hwnd)))
            (if (i32.ge_s (local.get $slot) (i32.const 0))
              (then
                (local.set $base (call $scroll_record_addr (local.get $slot)))
                (if (local.get $is_vert)
                  (then (local.set $base (i32.add (local.get $base) (i32.const 12)))))
                (local.set $smin (i32.load offset=4 (local.get $base)))
                (local.set $smax (i32.load offset=8 (local.get $base)))
                (local.set $new_pos (call $scrollbar_drag_pos
                  (local.get $long_dim) (local.get $coord)
                  (global.get $sb_drag_anchor_coord)
                  (global.get $sb_drag_anchor_pos)
                  (local.get $smin) (local.get $smax)))
                (i32.store (local.get $base) (local.get $new_pos))
                (call $invalidate_hwnd (local.get $hwnd))
                (local.set $sb_msg (select (i32.const 0x115) (i32.const 0x114) (local.get $is_vert)))
                (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
                (drop (call $wnd_send_message (local.get $parent) (local.get $sb_msg)
                  (i32.or (i32.const 5) (i32.shl (i32.and (local.get $new_pos) (i32.const 0xFFFF)) (i32.const 16)))
                  (local.get $hwnd)))))))
        (return (i32.const 0))))

    ;; WM_LBUTTONUP — clear pressed state, send SB_ENDSCROLL.
    (if (i32.eq (local.get $msg) (i32.const 0x0202))
      (then
        (if (i32.eq (global.get $sb_pressed_hwnd) (local.get $hwnd))
          (then
            (local.set $style (call $wnd_get_style (local.get $hwnd)))
            (local.set $is_vert (i32.and (local.get $style) (i32.const 1)))
            (local.set $sb_msg (select (i32.const 0x115) (i32.const 0x114) (local.get $is_vert)))
            (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
            (if (i32.eq (global.get $sb_pressed_part) (i32.const 5))
              (then
                (local.set $slot (call $wnd_table_find (local.get $hwnd)))
                (if (i32.ge_s (local.get $slot) (i32.const 0))
                  (then
                    (local.set $base (call $scroll_record_addr (local.get $slot)))
                    (if (local.get $is_vert)
                      (then (local.set $base (i32.add (local.get $base) (i32.const 12)))))
                    (local.set $pos (i32.load (local.get $base)))
                    (drop (call $wnd_send_message (local.get $parent) (local.get $sb_msg)
                      (i32.or (i32.const 4) (i32.shl (i32.and (local.get $pos) (i32.const 0xFFFF)) (i32.const 16)))
                      (local.get $hwnd)))))))
            (global.set $sb_pressed_hwnd (i32.const 0))
            (global.set $sb_pressed_part (i32.const 0))
            (if (i32.eq (global.get $capture_hwnd) (local.get $hwnd))
              (then (global.set $capture_hwnd (i32.const 0))))
            (call $invalidate_hwnd (local.get $hwnd))
            (drop (call $wnd_send_message (local.get $parent) (local.get $sb_msg)
                    (i32.const 8) (local.get $hwnd))))) ;; SB_ENDSCROLL
        (return (i32.const 0))))

    ;; WM_PAINT
    (if (i32.eq (local.get $msg) (i32.const 0x000F))
      (then
        (local.set $hdc (i32.add (local.get $hwnd) (i32.const 0x40000)))
        (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
        (local.set $w (i32.and (local.get $sz) (i32.const 0xFFFF)))
        (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
        (local.set $style (call $wnd_get_style (local.get $hwnd)))
        ;; SBS_VERT = 0x01
        (local.set $is_vert (i32.and (local.get $style) (i32.const 1)))
        (local.set $disabled (call $scroll_arrow_mask
          (local.get $hwnd) (local.get $is_vert)))

        ;; Arrow button size: 16px (Win98 SM_CXVSCROLL). Skip arrows if the
        ;; scrollbar's long axis is too short to fit two arrows + any thumb.
        (local.set $long_dim (select (local.get $h) (local.get $w) (local.get $is_vert)))
        (local.set $arrow (call $scrollbar_arrow_size (local.get $long_dim)))
        ;; This window's pressed flag = 1 if we own the press.
        (local.set $is_pressed
          (i32.eq (global.get $sb_pressed_hwnd) (local.get $hwnd)))

        ;; Fill track with scrollbar background (COLOR_SCROLLBAR = light gray)
        (drop (call $gdi_native_fill_rect (local.get $hdc)
                (i32.const 0) (i32.const 0) (local.get $w) (local.get $h)
                (i32.const 0x30011))) ;; LTGRAY_BRUSH
        ;; Sunken edge around track
        (drop (call $gdi_native_draw_edge (local.get $hdc)
                (i32.const 0) (i32.const 0) (local.get $w) (local.get $h)
                (i32.const 0x0A) (i32.const 0x0F))) ;; BDR_SUNKEN, BF_RECT

        ;; Arrow buttons at each end of the long axis.
        ;; $sb_pressed_part: 1=up, 2=down, 3=left, 4=right.
        (if (local.get $arrow)
          (then
            (if (local.get $is_vert)
              (then
                (call $draw_sb_arrow (local.get $hdc)
                  (i32.const 0) (i32.const 0) (local.get $w) (local.get $arrow)
                  (i32.const 0) ;; up
                  (i32.and (local.get $is_pressed)
                           (i32.eq (global.get $sb_pressed_part) (i32.const 1)))
                  (i32.and (local.get $disabled) (i32.const 1)))
                (call $draw_sb_arrow (local.get $hdc)
                  (i32.const 0) (i32.sub (local.get $h) (local.get $arrow))
                  (local.get $w) (local.get $arrow)
                  (i32.const 1) ;; down
                  (i32.and (local.get $is_pressed)
                           (i32.eq (global.get $sb_pressed_part) (i32.const 2)))
                  (i32.and (local.get $disabled) (i32.const 2))))
              (else
                (call $draw_sb_arrow (local.get $hdc)
                  (i32.const 0) (i32.const 0) (local.get $arrow) (local.get $h)
                  (i32.const 2) ;; left
                  (i32.and (local.get $is_pressed)
                           (i32.or
                             (i32.eq (global.get $sb_pressed_part) (i32.const 1))
                             (i32.eq (global.get $sb_pressed_part) (i32.const 3))))
                  (i32.and (local.get $disabled) (i32.const 1)))
                (call $draw_sb_arrow (local.get $hdc)
                  (i32.sub (local.get $w) (local.get $arrow)) (i32.const 0)
                  (local.get $arrow) (local.get $h)
                  (i32.const 3) ;; right
                  (i32.and (local.get $is_pressed)
                           (i32.or
                             (i32.eq (global.get $sb_pressed_part) (i32.const 2))
                             (i32.eq (global.get $sb_pressed_part) (i32.const 4))))
                  (i32.and (local.get $disabled) (i32.const 2)))))))

        ;; Read scroll state
        (local.set $slot (call $wnd_table_find (local.get $hwnd)))
        (if (i32.ge_s (local.get $slot) (i32.const 0))
          (then
            (local.set $base (call $scroll_record_addr (local.get $slot)))
            ;; Vertical scrollbar: use offset +12
            (if (local.get $is_vert)
              (then (local.set $base (i32.add (local.get $base) (i32.const 12)))))
            (local.set $pos (i32.load (local.get $base)))
            (local.set $smin (i32.load offset=4 (local.get $base)))
            (local.set $smax (i32.load offset=8 (local.get $base)))
            (local.set $range (i32.sub (local.get $smax) (local.get $smin)))
            (if (i32.gt_s (local.get $range) (i32.const 0))
              (then
                (local.set $thumb_size (call $scrollbar_thumb_size (local.get $long_dim) (local.get $range)))
                (local.set $thumb_pos (call $scrollbar_thumb_pos
                  (local.get $long_dim) (local.get $pos) (local.get $smin) (local.get $smax)))
                ;; Draw thumb
                (if (local.get $is_vert)
                  (then
                    ;; Vertical: thumb fills the strip width, moves in Y
                    (call $paint_sb_thumb (local.get $hdc)
                      (i32.const 0) (local.get $thumb_pos)
                      (local.get $w)
                      (i32.add (local.get $thumb_pos) (local.get $thumb_size))))
                  (else
                    ;; Horizontal: thumb fills the strip height, moves in X
                    (call $paint_sb_thumb (local.get $hdc)
                      (local.get $thumb_pos) (i32.const 0)
                      (i32.add (local.get $thumb_pos) (local.get $thumb_size))
                      (local.get $h))))))))
        (return (i32.const 0))))
    (i32.const 0))
