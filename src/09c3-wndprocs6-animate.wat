  ;; ---- COMCTL32 Animate control (SysAnimate32, ctrl_class 34) ----
  ;;
  ;; A timer-driven player for the silent, uncompressed or RLE8 AVI clips
  ;; comctl32 accepts (docs/video-support-design.md section 4). It owns no
  ;; parser or decoder of its own: the file is opened by the AVI reader in
  ;; 09a7f (from disk, or from an "AVI" resource through its memory source)
  ;; and every frame goes through the 09a7e converters.
  ;;
  ;;   ACM_OPENA 0x464 / ACM_OPENW 0x467  wParam hInstance (0 = the window's),
  ;;       lParam a resource id, a resource name or a file path; 0 closes.
  ;;   ACM_PLAY 0x465   wParam repeat count (-1 forever), lParam MAKELONG(from, to),
  ;;       to 0xFFFF = the last frame.
  ;;   ACM_STOP 0x466, ACM_ISPLAYING 0x468.
  ;;   Styles ACS_CENTER 1, ACS_TRANSPARENT 2, ACS_AUTOPLAY 4, ACS_TIMER 8.
  ;;   The parent gets WM_COMMAND(MAKEWPARAM(id, ACN_START 1 / ACN_STOP 2), hwnd).
  ;;
  ;; A play without ACS_TIMER runs from $anim_service at each main-thread
  ;; slice (comctl32's player thread, see below); ACS_TIMER plays, and any
  ;; play the service cannot take, use WM_TIMER. Semantics follow Wine's animate.c:
  ;; opening resizes the control to the clip unless ACS_CENTER, a play of one
  ;; frame draws it without notifying, and the frame counter wraps at `to`
  ;; and counts down the repeat.

  (global $anim_dbg_acn_start (mut i32) (i32.const 0))
  (global $anim_dbg_acn_stop (mut i32) (i32.const 0))
  (global $anim_dbg_frames (mut i32) (i32.const 0))   ;; frames decoded for display
  (global $anim_dbg_last_open (mut i32) (i32.const 0)) ;; 1 ok, else the AVIERR/reason

  ;; Per-window state: $animate_wndproc heap_allocs it in WM_CREATE.
  (layout AnimateState
    (field frec        i32)   ;; 09a7f file record (WASM addr), 0 = nothing open
    (field sb          i32)   ;; the video stream's block in its workspace
    (field width       i32)
    (field height      i32)
    (field bpp         i32)
    (field compression i32)   ;; 0 BI_RGB, 1 BI_RLE8
    (field top_down    i32)   ;; BI_RGB with a negative biHeight
    (field frames      i32)
    (field interval    i32)   ;; ms per frame
    (field from_frame  i32)
    (field to_frame    i32)
    (field loop_count  i32)   ;; -1 forever
    (field cur_frame   i32)   ;; next frame WM_TIMER draws
    (field decoded     i32)   ;; frame held in plane/frame, -1 none
    (field pc_next     i32)   ;; next palette-change entry to apply
    (field timer_on    i32)
    (field buf         i32)   ;; one DIB-arena block holding everything below
    (field pal0_wa     i32)   ;; the format's palette
    (field pal_wa      i32)   ;; the palette as changed by '##pc' chunks so far
    (field bmi_wa      i32)   ;; 32bpp top-down BITMAPINFOHEADER for the blit
    (field plane_wa    i32)   ;; RLE8 index plane, retained between frames
    (field frame_wa    i32)   ;; BGRX picture of `decoded`
    (field comp_wa     i32)   ;; ACS_TRANSPARENT composite, 0 otherwise
    (field chunk_ga    i32)   ;; chunk read buffer (guest address, for $avi_read)
    (field chunk_cap   i32)
    (field key         i32)   ;; transparent key (BGRX) or -1
    (field threaded    i32)   ;; playing from $anim_service rather than WM_TIMER
    (field next_tick   i32)   ;; host tick the service shows the next frame at
    (field bg_brush    i32))  ;; last WM_CTLCOLORSTATIC answer, 0 = none yet

  (func $anim_notify (param $hwnd i32) (param $code i32)
    (if (i32.eq (local.get $code) (i32.const 1))
      (then (global.set $anim_dbg_acn_start (i32.add (global.get $anim_dbg_acn_start) (i32.const 1)))))
    (if (i32.eq (local.get $code) (i32.const 2))
      (then (global.set $anim_dbg_acn_stop (i32.add (global.get $anim_dbg_acn_stop) (i32.const 1)))))
    ;; From the slice-boundary service no guest code may run, so the
    ;; notification is posted -- what comctl32's cross-thread SendMessage from
    ;; its player thread amounts to when the UI thread is busy.
    (if (global.get $anim_in_service)
      (then
        (drop (call $post_queue_push (call $wnd_get_parent (local.get $hwnd)) (i32.const 0x0111)
          (i32.or (i32.and (call $ctrl_table_get_id (local.get $hwnd)) (i32.const 0xFFFF))
                  (i32.shl (local.get $code) (i32.const 16)))
          (local.get $hwnd)))
        (return)))
    (drop (call $ctrl_notify_parent (call $wnd_get_parent (local.get $hwnd)) (i32.const 0x0111)
      (i32.or (i32.and (call $ctrl_table_get_id (local.get $hwnd)) (i32.const 0xFFFF))
              (i32.shl (local.get $code) (i32.const 16)))
      (local.get $hwnd))))

  ;; ---- Threaded plays ----
  ;; comctl32 plays a clip on its own thread unless ACS_TIMER, so the picture
  ;; moves while the application's UI thread is busy and pumps nothing --
  ;; HyperTerminal's splash is exactly that: it opens and plays its globe, then
  ;; loads for seconds without a message loop. Here the "thread" is
  ;; $anim_service, which $run calls once per main-thread slice: it advances
  ;; each live control by the wall clock and paints it directly, never running
  ;; guest code. ACS_TIMER plays keep a WM_TIMER through the message loop.
  (global $anim_live_ga (mut i32) (i32.const 0))    ;; heap array of live hwnds
  (global $anim_live_count (mut i32) (i32.const 0))
  (global $ANIM_LIVE_MAX i32 (i32.const 16))
  (global $anim_in_service (mut i32) (i32.const 0))

  (func $anim_live_add (param $hwnd i32) (result i32)
    (local $wa i32) (local $i i32)
    ;; The list is per instance; a control owned by a guest Worker thread
    ;; falls back to a WM_TIMER play.
    (if (i32.ne (global.get $current_thread_id) (i32.const 1)) (then (return (i32.const 0))))
    (if (i32.eqz (global.get $anim_live_ga))
      (then
        (global.set $anim_live_ga (call $heap_alloc (i32.shl (global.get $ANIM_LIVE_MAX) (i32.const 2))))
        (if (i32.eqz (global.get $anim_live_ga)) (then (return (i32.const 0))))))
    (local.set $wa (call $g2w (global.get $anim_live_ga)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $anim_live_count)))
      (if (i32.eq (i32.load (i32.add (local.get $wa) (i32.shl (local.get $i) (i32.const 2)))) (local.get $hwnd))
        (then (return (i32.const 1))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (if (i32.ge_u (global.get $anim_live_count) (global.get $ANIM_LIVE_MAX)) (then (return (i32.const 0))))
    (i32.store (i32.add (local.get $wa) (i32.shl (global.get $anim_live_count) (i32.const 2))) (local.get $hwnd))
    (global.set $anim_live_count (i32.add (global.get $anim_live_count) (i32.const 1)))
    (i32.const 1))

  (func $anim_live_remove (param $hwnd i32)
    (local $wa i32) (local $i i32) (local $last i32)
    (if (i32.eqz (global.get $anim_live_count)) (then (return)))
    (local.set $wa (call $g2w (global.get $anim_live_ga)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $anim_live_count)))
      (if (i32.eq (i32.load (i32.add (local.get $wa) (i32.shl (local.get $i) (i32.const 2)))) (local.get $hwnd))
        (then
          (local.set $last (i32.sub (global.get $anim_live_count) (i32.const 1)))
          (i32.store (i32.add (local.get $wa) (i32.shl (local.get $i) (i32.const 2)))
            (i32.load (i32.add (local.get $wa) (i32.shl (local.get $last) (i32.const 2)))))
          (global.set $anim_live_count (local.get $last))
          (return)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan))))

  ;; Wine's DoStop: stop the player and, only if something was playing, ACN_STOP.
  (func $anim_stop (param $hwnd i32) (param $sw ptr<AnimateState>)
    (if (load.field AnimateState timer_on (local.get $sw))
      (then
        (if (load.field AnimateState threaded (local.get $sw))
          (then
            (call $anim_live_remove (local.get $hwnd))
            (store.field AnimateState threaded (local.get $sw) (i32.const 0)))
          (else (drop (call $timer_kill (local.get $hwnd) (i32.const 1)))))
        (store.field AnimateState timer_on (local.get $sw) (i32.const 0))
        (call $anim_notify (local.get $hwnd) (i32.const 2)))))

  (func $anim_close (param $hwnd i32) (param $sw ptr<AnimateState>)
    (call $anim_stop (local.get $hwnd) (local.get $sw))
    (if (load.field AnimateState frec (local.get $sw))
      (then (drop (call $avi_file_release (load.field AnimateState frec (local.get $sw))))))
    (if (load.field AnimateState buf (local.get $sw))
      (then (call $dib_free_wasm (call $avi_dib_wa (load.field AnimateState buf (local.get $sw))))))
    (call $zero_memory (local.get $sw) (size-of AnimateState))
    (store.field AnimateState decoded (local.get $sw) (i32.const -1))
    (store.field AnimateState key (local.get $sw) (i32.const -1)))

  ;; Read table entry $ent's chunk into the chunk buffer: its WASM address, or
  ;; 0 when it cannot be read (a lazily-fetched file that is not here yet
  ;; reads as a dropped frame rather than parking inside a wndproc).
  (func $anim_read_chunk (param $sw ptr<AnimateState>) (param $ent i32) (result i32)
    (local $n i32) (local $r i32)
    (local.set $n (i32.load offset=4 (local.get $ent)))
    (if (i32.gt_u (local.get $n) (load.field AnimateState chunk_cap (local.get $sw)))
      (then (local.set $n (load.field AnimateState chunk_cap (local.get $sw)))))
    (global.set $anim_read_len (i32.const 0))
    (if (i32.eqz (local.get $n)) (then (return (i32.const 0))))
    (local.set $r (call $avi_read
      (i32.load offset=4 (load.field AnimateState frec (local.get $sw)))
      (i32.load (local.get $ent))
      (load.field AnimateState chunk_ga (local.get $sw)) (local.get $n)))
    (if (i32.le_s (local.get $r) (i32.const 0)) (then (return (i32.const 0))))
    (global.set $anim_read_len (local.get $r))
    (call $avi_dib_wa (load.field AnimateState chunk_ga (local.get $sw))))
  (global $anim_read_len (mut i32) (i32.const 0))

  ;; Apply the '##pc' palette changes that come before data frame $f.
  (func $anim_apply_palette (param $sw ptr<AnimateState>) (param $f i32)
    (local $sb i32) (local $i i32) (local $ent i32) (local $wa i32)
    (local.set $sb (load.field AnimateState sb (local.get $sw)))
    (local.set $i (load.field AnimateState pc_next (local.get $sw)))
    (block $done (loop $each
      (br_if $done (i32.ge_u (local.get $i) (i32.load offset=0x50 (local.get $sb))))
      (local.set $ent (i32.add (i32.load offset=0x4C (local.get $sb)) (i32.shl (local.get $i) (i32.const 4))))
      (br_if $done (i32.gt_u (i32.load offset=12 (local.get $ent)) (local.get $f)))
      (local.set $wa (call $anim_read_chunk (local.get $sw) (local.get $ent)))
      (if (local.get $wa)
        (then (call $vid_palette_change (load.field AnimateState pal_wa (local.get $sw))
                (local.get $wa) (global.get $anim_read_len))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $each)))
    (store.field AnimateState pc_next (local.get $sw) (local.get $i)))

  ;; Make `frame` hold data frame $f. RLE8 frames are deltas over the retained
  ;; index plane, so a backward seek restarts from frame 0 and replays.
  (func $anim_decode_to (param $sw ptr<AnimateState>) (param $f i32)
    (local $g i32) (local $w i32) (local $h i32) (local $ent i32) (local $wa i32)
    (local $sb i32)
    (local.set $sb (load.field AnimateState sb (local.get $sw)))
    (local.set $w (load.field AnimateState width (local.get $sw)))
    (local.set $h (load.field AnimateState height (local.get $sw)))
    (if (i32.ge_u (local.get $f) (load.field AnimateState frames (local.get $sw)))
      (then (return)))
    (if (i32.eq (local.get $f) (load.field AnimateState decoded (local.get $sw)))
      (then (return)))
    (if (i32.or (i32.lt_s (load.field AnimateState decoded (local.get $sw)) (i32.const 0))
                (i32.lt_s (local.get $f) (load.field AnimateState decoded (local.get $sw))))
      (then
        (call $zero_memory (load.field AnimateState plane_wa (local.get $sw))
          (i32.mul (local.get $w) (local.get $h)))
        (memory.copy (load.field AnimateState pal_wa (local.get $sw))
          (load.field AnimateState pal0_wa (local.get $sw)) (i32.const 1024))
        (store.field AnimateState pc_next (local.get $sw) (i32.const 0))
        (store.field AnimateState decoded (local.get $sw) (i32.const -1))))
    (if (i32.eq (load.field AnimateState compression (local.get $sw)) (i32.const 1))
      (then
        (local.set $g (i32.add (load.field AnimateState decoded (local.get $sw)) (i32.const 1)))
        (block $done (loop $replay
          (br_if $done (i32.gt_s (local.get $g) (local.get $f)))
          (call $anim_apply_palette (local.get $sw) (local.get $g))
          (local.set $ent (i32.add (i32.load offset=0x44 (local.get $sb)) (i32.shl (local.get $g) (i32.const 4))))
          (local.set $wa (call $anim_read_chunk (local.get $sw) (local.get $ent)))
          (if (local.get $wa)
            (then (call $vid_rle8_decode (load.field AnimateState plane_wa (local.get $sw))
                    (local.get $wa) (global.get $anim_read_len) (local.get $w) (local.get $h))))
          (local.set $g (i32.add (local.get $g) (i32.const 1)))
          (br $replay)))
        (call $vid_index_to_bgrx (load.field AnimateState plane_wa (local.get $sw))
          (load.field AnimateState pal_wa (local.get $sw))
          (load.field AnimateState frame_wa (local.get $sw))
          (i32.mul (local.get $w) (local.get $h))))
      (else
        ;; Every BI_RGB frame is whole: only the palette history matters.
        (call $anim_apply_palette (local.get $sw) (local.get $f))
        (local.set $ent (i32.add (i32.load offset=0x44 (local.get $sb)) (i32.shl (local.get $f) (i32.const 4))))
        (local.set $wa (call $anim_read_chunk (local.get $sw) (local.get $ent)))
        (if (local.get $wa)
          (then (call $vid_raw_decode (local.get $wa) (global.get $anim_read_len)
                  (load.field AnimateState pal_wa (local.get $sw))
                  (load.field AnimateState bpp (local.get $sw))
                  (local.get $w) (local.get $h)
                  (load.field AnimateState top_down (local.get $sw))
                  (load.field AnimateState frame_wa (local.get $sw)))))))
    (store.field AnimateState decoded (local.get $sw) (local.get $f))
    (global.set $anim_dbg_frames (i32.add (global.get $anim_dbg_frames) (i32.const 1))))

  ;; Take over an opened 09a7f file record: validate it is a lone silent video
  ;; stream comctl32 can play, and lay out the frame buffers. 1, or 0 with the
  ;; record released.
  (func $anim_adopt (param $hwnd i32) (param $sw ptr<AnimateState>) (param $frec i32) (result i32)
    (local $sb i32) (local $bih i32) (local $w i32) (local $h i32) (local $bpp i32)
    (local $comp i32) (local $fmtlen i32) (local $clr i32) (local $cap i32)
    (local $plane_sz i32) (local $total i32) (local $buf i32) (local $wa i32)
    (local $scale i32) (local $rate i32) (local $interval i32) (local $i i32)
    (block $bad
      (br_if $bad (i32.ne (i32.load offset=8 (local.get $frec)) (i32.const 1)))
      (local.set $sb (call $avi_sblock (i32.load offset=12 (local.get $frec)) (i32.const 0)))
      (br_if $bad (i32.ne (i32.load (local.get $sb)) (i32.const 0x73646976)))       ;; 'vids'
      (local.set $fmtlen (i32.load offset=0x40 (local.get $sb)))
      (br_if $bad (i32.lt_u (local.get $fmtlen) (i32.const 40)))
      (local.set $bih (i32.add (local.get $sb) (i32.const 0x80)))
      (local.set $w (i32.load offset=4 (local.get $bih)))
      (local.set $h (i32.load offset=8 (local.get $bih)))
      (local.set $bpp (i32.load16_u offset=14 (local.get $bih)))
      (local.set $comp (i32.load offset=16 (local.get $bih)))
      (store.field AnimateState top_down (local.get $sw) (i32.lt_s (local.get $h) (i32.const 0)))
      (if (i32.lt_s (local.get $h) (i32.const 0)) (then (local.set $h (i32.sub (i32.const 0) (local.get $h)))))
      (br_if $bad (i32.or (i32.le_s (local.get $w) (i32.const 0)) (i32.gt_s (local.get $w) (i32.const 2048))))
      (br_if $bad (i32.or (i32.le_s (local.get $h) (i32.const 0)) (i32.gt_s (local.get $h) (i32.const 2048))))
      (if (i32.eq (local.get $comp) (i32.const 1))
        (then (br_if $bad (i32.ne (local.get $bpp) (i32.const 8))))
        (else
          (br_if $bad (i32.ne (local.get $comp) (i32.const 0)))
          (br_if $bad (i32.eqz (i32.or (i32.or (i32.eq (local.get $bpp) (i32.const 8))
                                               (i32.eq (local.get $bpp) (i32.const 16)))
                                       (i32.or (i32.eq (local.get $bpp) (i32.const 24))
                                               (i32.eq (local.get $bpp) (i32.const 32))))))))
      (br_if $bad (i32.eqz (i32.load offset=0x48 (local.get $sb))))
      ;; pal0 1K, pal 1K, bmi 64, plane, frame, [composite], chunk buffer.
      (local.set $cap (i32.load offset=0x60 (local.get $sb)))
      (if (i32.lt_u (local.get $cap) (i32.const 1028)) (then (local.set $cap (i32.const 1028))))
      (local.set $plane_sz (i32.and (i32.add (i32.mul (local.get $w) (local.get $h)) (i32.const 3)) (i32.const -4)))
      (local.set $total (i32.add (i32.add (i32.const 2112) (local.get $plane_sz))
        (i32.add (i32.shl (i32.mul (local.get $w) (local.get $h)) (i32.const 2)) (local.get $cap))))
      (if (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 2))
        (then (local.set $total (i32.add (local.get $total) (i32.shl (i32.mul (local.get $w) (local.get $h)) (i32.const 2))))))
      (local.set $buf (call $dib_alloc (local.get $total)))
      (br_if $bad (i32.eqz (local.get $buf)))
      (local.set $wa (call $avi_dib_wa (local.get $buf)))
      (store.field AnimateState buf (local.get $sw) (local.get $buf))
      (store.field AnimateState pal0_wa (local.get $sw) (local.get $wa))
      (store.field AnimateState pal_wa (local.get $sw) (i32.add (local.get $wa) (i32.const 1024)))
      (store.field AnimateState bmi_wa (local.get $sw) (i32.add (local.get $wa) (i32.const 2048)))
      (store.field AnimateState plane_wa (local.get $sw) (i32.add (local.get $wa) (i32.const 2112)))
      (local.set $wa (i32.add (local.get $wa) (i32.add (i32.const 2112) (local.get $plane_sz))))
      (store.field AnimateState frame_wa (local.get $sw) (local.get $wa))
      (local.set $wa (i32.add (local.get $wa) (i32.shl (i32.mul (local.get $w) (local.get $h)) (i32.const 2))))
      (if (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 2))
        (then
          (store.field AnimateState comp_wa (local.get $sw) (local.get $wa))
          (local.set $wa (i32.add (local.get $wa) (i32.shl (i32.mul (local.get $w) (local.get $h)) (i32.const 2))))))
      (store.field AnimateState chunk_ga (local.get $sw)
        (i32.add (local.get $buf) (i32.sub (local.get $wa) (call $avi_dib_wa (local.get $buf)))))
      (store.field AnimateState chunk_cap (local.get $sw) (local.get $cap))
      ;; The format's palette: biClrUsed entries after the header (all 2^bpp
      ;; when it says 0), bounded by what the format chunk actually holds.
      (if (i32.le_u (local.get $bpp) (i32.const 8))
        (then
          (local.set $clr (i32.load offset=32 (local.get $bih)))
          (if (i32.eqz (local.get $clr)) (then (local.set $clr (i32.shl (i32.const 1) (local.get $bpp)))))
          (if (i32.gt_u (local.get $clr) (i32.const 256)) (then (local.set $clr (i32.const 256))))
          (local.set $i (i32.load (local.get $bih)))   ;; biSize
          (if (i32.gt_u (local.get $i) (local.get $fmtlen)) (then (local.set $i (local.get $fmtlen))))
          (if (i32.gt_u (local.get $clr) (i32.shr_u (i32.sub (local.get $fmtlen) (local.get $i)) (i32.const 2)))
            (then (local.set $clr (i32.shr_u (i32.sub (local.get $fmtlen) (local.get $i)) (i32.const 2)))))
          (memory.copy (load.field AnimateState pal0_wa (local.get $sw))
            (i32.add (local.get $bih) (local.get $i)) (i32.shl (local.get $clr) (i32.const 2)))))
      ;; 32bpp top-down header for the blit.
      (local.set $wa (load.field AnimateState bmi_wa (local.get $sw)))
      (i32.store (local.get $wa) (i32.const 40))
      (i32.store offset=4 (local.get $wa) (local.get $w))
      (i32.store offset=8 (local.get $wa) (i32.sub (i32.const 0) (local.get $h)))
      (i32.store16 offset=12 (local.get $wa) (i32.const 1))
      (i32.store16 offset=14 (local.get $wa) (i32.const 32))
      ;; Frame period from the stream's dwRate/dwScale frames per second.
      (local.set $scale (i32.load offset=20 (local.get $sb)))
      (local.set $rate (i32.load offset=24 (local.get $sb)))
      (local.set $interval (i32.const 66))
      (if (i32.and (i32.ne (local.get $scale) (i32.const 0)) (i32.ne (local.get $rate) (i32.const 0)))
        (then (local.set $interval (i32.wrap_i64 (i64.div_u
          (i64.mul (i64.extend_i32_u (local.get $scale)) (i64.const 1000))
          (i64.extend_i32_u (local.get $rate)))))))
      (if (i32.eqz (local.get $interval)) (then (local.set $interval (i32.const 1))))
      (store.field AnimateState frec (local.get $sw) (local.get $frec))
      (store.field AnimateState sb (local.get $sw) (local.get $sb))
      (store.field AnimateState width (local.get $sw) (local.get $w))
      (store.field AnimateState height (local.get $sw) (local.get $h))
      (store.field AnimateState bpp (local.get $sw) (local.get $bpp))
      (store.field AnimateState compression (local.get $sw) (local.get $comp))
      (store.field AnimateState frames (local.get $sw) (i32.load offset=0x48 (local.get $sb)))
      (store.field AnimateState interval (local.get $sw) (local.get $interval))
      (store.field AnimateState decoded (local.get $sw) (i32.const -1))
      (store.field AnimateState key (local.get $sw) (i32.const -1))
      (return (i32.const 1)))
    (global.set $anim_dbg_last_open (i32.const -3))   ;; not a clip comctl32 plays
    (drop (call $avi_file_release (local.get $frec)))
    (i32.const 0))

  ;; Resolve ACM_OPEN's lParam to an opened file record, or 0. $wide selects
  ;; ACM_OPENW's UTF-16 name.
  (func $anim_open_source (param $hwnd i32) (param $hinst i32) (param $name i32) (param $wide i32) (result i32)
    (local $type i32) (local $entry i32) (local $rva i32) (local $len i32)
    (local $ga i32) (local $frec i32) (local $path i32)
    (if (i32.eqz (local.get $hinst)) (then (local.set $hinst (call $wnd_get_hinstance (local.get $hwnd)))))
    ;; The resource first ("AVI" type, id or name), as comctl32 does.
    (local.set $type (call $heap_alloc (i32.const 8)))
    (if (local.get $wide)
      (then
        (call $gs32 (local.get $type) (i32.const 0x00560041))              ;; L"AV"
        (call $gs32 (i32.add (local.get $type) (i32.const 4)) (i32.const 0x49)))  ;; L"I\0"
      (else (call $gs32 (local.get $type) (i32.const 0x00495641))))        ;; "AVI\0"
    (call $push_rsrc_ctx (local.get $hinst))
    (local.set $entry
      (if (result i32) (local.get $wide)
        (then (call $find_resource_w (local.get $type) (local.get $name)))
        (else (call $find_resource (local.get $type) (local.get $name)))))
    (if (local.get $entry)
      (then
        (local.set $rva (call $gl32 (i32.add (call $r_base) (local.get $entry))))
        (local.set $len (call $gl32 (i32.add (i32.add (call $r_base) (local.get $entry)) (i32.const 4))))
        (local.set $ga (i32.add (call $r_base) (local.get $rva)))))
    (if (local.get $entry)
      (then
        (local.set $frec (call $avi_open_memory (local.get $ga) (local.get $len)))
        (call $pop_rsrc_ctx)
        (call $heap_free (local.get $type))
        (global.set $anim_dbg_last_open (global.get $avi_open_status))
        (return (local.get $frec))))
    (call $pop_rsrc_ctx)
    (call $heap_free (local.get $type))
    ;; Not a resource: an integer id names nothing further.
    (if (i32.lt_u (local.get $name) (i32.const 0x10000))
      (then (global.set $anim_dbg_last_open (i32.const -4)) (return (i32.const 0))))
    (local.set $path (local.get $name))
    (if (local.get $wide)
      (then
        (local.set $path (call $heap_alloc (i32.const 260)))
        (drop (call $wide_to_ansi (local.get $name) (local.get $path) (i32.const 260)))))
    (local.set $frec (call $avi_open (local.get $path)))
    (global.set $anim_dbg_last_open (global.get $avi_open_status))
    (if (local.get $wide) (then (call $heap_free (local.get $path))))
    (local.get $frec))

  (func $anim_open (param $hwnd i32) (param $sw ptr<AnimateState>) (param $frec i32) (result i32)
    (local $style i32)
    (if (i32.eqz (local.get $frec)) (then (return (i32.const 0))))
    (if (i32.eqz (call $anim_adopt (local.get $hwnd) (local.get $sw) (local.get $frec)))
      (then (call $anim_close (local.get $hwnd) (local.get $sw)) (return (i32.const 0))))
    (global.set $anim_dbg_last_open (i32.const 1))
    (call $anim_decode_to (local.get $sw) (i32.const 0))
    (local.set $style (call $wnd_get_style (local.get $hwnd)))
    (if (i32.eqz (i32.and (local.get $style) (i32.const 1)))
      (then (call $ctrl_geom_sync (local.get $hwnd) (i32.const 0) (i32.const 0)
              (load.field AnimateState width (local.get $sw))
              (load.field AnimateState height (local.get $sw))
              (i32.const 2))))   ;; SWP_NOMOVE
    (call $invalidate_hwnd (local.get $hwnd))
    (if (i32.and (local.get $style) (i32.const 4))
      (then (return (call $anim_play (local.get $hwnd) (local.get $sw) (i32.const -1)
              (i32.const 0) (i32.sub (load.field AnimateState frames (local.get $sw)) (i32.const 1))))))
    (i32.const 1))

  (func $anim_play (param $hwnd i32) (param $sw ptr<AnimateState>)
        (param $repeat i32) (param $from i32) (param $to i32) (result i32)
    (local $n i32)
    (if (i32.eqz (load.field AnimateState frec (local.get $sw))) (then (return (i32.const 0))))
    (if (load.field AnimateState timer_on (local.get $sw)) (then (return (i32.const 1))))
    (local.set $n (load.field AnimateState frames (local.get $sw)))
    (if (i32.eq (local.get $to) (i32.const 0xFFFF)) (then (local.set $to (i32.sub (local.get $n) (i32.const 1)))))
    (if (i32.and (i32.ge_u (local.get $from) (local.get $n)) (i32.ge_u (local.get $to) (local.get $n)))
      (then (return (i32.const 0))))
    (if (i32.ge_u (local.get $to) (local.get $n)) (then (local.set $to (i32.sub (local.get $n) (i32.const 1)))))
    (if (i32.ge_u (local.get $from) (local.get $n)) (then (local.set $from (local.get $to))))
    (store.field AnimateState from_frame (local.get $sw) (local.get $from))
    (store.field AnimateState to_frame (local.get $sw) (local.get $to))
    (store.field AnimateState loop_count (local.get $sw) (local.get $repeat))
    (store.field AnimateState cur_frame (local.get $sw) (local.get $from))
    ;; A seek: show the frame, no timer, no notification.
    (if (i32.eq (local.get $from) (local.get $to))
      (then
        (call $anim_decode_to (local.get $sw) (local.get $from))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.const 1))))
    (call $anim_notify (local.get $hwnd) (i32.const 1))
    (store.field AnimateState timer_on (local.get $sw) (i32.const 1))
    ;; Not an i32.and: that would register an ACS_TIMER control too.
    (if (if (result i32) (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 8))
          (then (i32.const 0))
          (else (call $anim_live_add (local.get $hwnd))))
      (then
        (store.field AnimateState threaded (local.get $sw) (i32.const 1))
        (store.field AnimateState next_tick (local.get $sw)
          (i32.add (call $host_get_ticks) (load.field AnimateState interval (local.get $sw))))
        ;; The first frame appears now, as comctl32's draw-then-wait loop has
        ;; it -- painted directly, since the caller may not pump for a while.
        (call $anim_step (local.get $hwnd) (local.get $sw) (i32.const 1))
        (if (call $anim_visible (local.get $hwnd))
          (then (call $anim_paint (local.get $hwnd) (local.get $sw) (i32.const 0))))
        (return (i32.const 1))))
    (call $timer_set (local.get $hwnd) (i32.const 1)
      (load.field AnimateState interval (local.get $sw)) (i32.const 0))
    (call $anim_step (local.get $hwnd) (local.get $sw) (i32.const 0))
    (i32.const 1))

  ;; The control and its parent are both WS_VISIBLE.
  (func $anim_visible (param $hwnd i32) (result i32)
    (local $parent i32)
    (if (i32.eqz (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x10000000)))
      (then (return (i32.const 0))))
    (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
    (if (local.get $parent)
      (then (return (i32.ne (i32.and (call $wnd_get_style (local.get $parent)) (i32.const 0x10000000))
                            (i32.const 0)))))
    (i32.const 1))

  ;; The player "thread": once per main-thread slice, from $run. Each live
  ;; control catches up to the host clock (at most 16 frames a slice, as a
  ;; late thread would redraw at once rather than replay a backlog) and the
  ;; last frame is painted straight to its DC.
  (func $anim_service
    (local $i i32) (local $hwnd i32) (local $state i32) (local $sw ptr<AnimateState>)
    (local $now i32) (local $n i32)
    (if (i32.eqz (global.get $anim_live_count)) (then (return)))
    (if (i32.ne (global.get $current_thread_id) (i32.const 1)) (then (return)))
    (if (global.get $anim_in_service) (then (return)))
    (global.set $anim_in_service (i32.const 1))
    (local.set $now (call $host_get_ticks))
    (block $done (loop $each
      (br_if $done (i32.ge_u (local.get $i) (global.get $anim_live_count)))
      (local.set $hwnd (i32.load (i32.add (call $g2w (global.get $anim_live_ga))
        (i32.shl (local.get $i) (i32.const 2)))))
      (local.set $state (i32.const 0))
      (if (i32.ge_s (call $wnd_table_find (local.get $hwnd)) (i32.const 0))
        (then (local.set $state (call $wnd_get_state_ptr (local.get $hwnd)))))
      (if (i32.eqz (local.get $state))
        (then (call $anim_live_remove (local.get $hwnd)) (br $each)))
      (local.set $sw (call $g2w (local.get $state)))
      (if (i32.or (i32.eqz (load.field AnimateState timer_on (local.get $sw)))
                  (i32.eqz (load.field AnimateState threaded (local.get $sw))))
        (then (call $anim_live_remove (local.get $hwnd)) (br $each)))
      (local.set $n (i32.const 0))
      (block $caught (loop $catch_up
        (br_if $caught (i32.lt_s (i32.sub (local.get $now)
          (load.field AnimateState next_tick (local.get $sw))) (i32.const 0)))
        (br_if $caught (i32.ge_u (local.get $n) (i32.const 16)))
        (br_if $caught (i32.eqz (load.field AnimateState threaded (local.get $sw))))
        (call $anim_step (local.get $hwnd) (local.get $sw) (i32.const 1))
        (store.field AnimateState next_tick (local.get $sw)
          (i32.add (load.field AnimateState next_tick (local.get $sw))
                   (load.field AnimateState interval (local.get $sw))))
        (local.set $n (i32.add (local.get $n) (i32.const 1)))
        (br $catch_up)))
      (if (local.get $n)
        (then
          (if (i32.ge_s (i32.sub (local.get $now) (load.field AnimateState next_tick (local.get $sw))) (i32.const 0))
            (then (store.field AnimateState next_tick (local.get $sw)
                    (i32.add (local.get $now) (load.field AnimateState interval (local.get $sw))))))
          (if (call $anim_visible (local.get $hwnd))
            (then (call $anim_paint (local.get $hwnd) (local.get $sw) (i32.const 0))))))
      ;; A play that just ended removed itself and moved the last entry here.
      (if (i32.lt_u (local.get $i) (global.get $anim_live_count))
        (then
          (if (i32.eq (local.get $hwnd) (i32.load (i32.add (call $g2w (global.get $anim_live_ga))
                                                  (i32.shl (local.get $i) (i32.const 2)))))
            (then (local.set $i (i32.add (local.get $i) (i32.const 1)))))))
      (br $each)))
    (global.set $anim_in_service (i32.const 0)))

  ;; Wine's DrawFrame: show cur_frame, then advance, wrapping at `to` and
  ;; counting down the repeat. $direct: the caller paints (threaded play);
  ;; otherwise the frame is invalidated for the next WM_PAINT.
  (func $anim_step (param $hwnd i32) (param $sw ptr<AnimateState>) (param $direct i32)
    (local $cur i32) (local $loop i32)
    (local.set $cur (load.field AnimateState cur_frame (local.get $sw)))
    (call $anim_decode_to (local.get $sw) (local.get $cur))
    (if (i32.eqz (local.get $direct)) (then (call $invalidate_hwnd (local.get $hwnd))))
    (if (i32.ge_s (local.get $cur) (load.field AnimateState to_frame (local.get $sw)))
      (then
        (store.field AnimateState cur_frame (local.get $sw) (load.field AnimateState from_frame (local.get $sw)))
        (local.set $loop (load.field AnimateState loop_count (local.get $sw)))
        (if (i32.ne (local.get $loop) (i32.const -1))
          (then
            (local.set $loop (i32.sub (local.get $loop) (i32.const 1)))
            (store.field AnimateState loop_count (local.get $sw) (local.get $loop))
            (if (i32.le_s (local.get $loop) (i32.const 0))
              (then (call $anim_stop (local.get $hwnd) (local.get $sw)))))))
      (else (store.field AnimateState cur_frame (local.get $sw) (i32.add (local.get $cur) (i32.const 1))))))

  ;; $live: may send WM_CTLCOLORSTATIC to the parent (a WM_PAINT); a direct
  ;; paint from a threaded play reuses the last answer instead.
  (func $anim_paint (param $hwnd i32) (param $sw ptr<AnimateState>) (param $live i32)
    (local $hdc i32) (local $sz i32) (local $cw i32) (local $ch i32)
    (local $style i32) (local $brush i32) (local $bg i32)
    (local $w i32) (local $h i32) (local $x0 i32) (local $y0 i32)
    (local $sx i32) (local $sy i32) (local $bw i32) (local $bh i32)
    (local $src i32) (local $i i32) (local $n i32) (local $px i32) (local $key i32)
    (local.set $hdc (i32.add (local.get $hwnd) (i32.const 0x40000)))
    (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
    (local.set $cw (i32.and (local.get $sz) (i32.const 0xFFFF)))
    (local.set $ch (i32.shr_u (local.get $sz) (i32.const 16)))
    (if (i32.or (i32.le_s (local.get $cw) (i32.const 0)) (i32.le_s (local.get $ch) (i32.const 0)))
      (then (return)))
    (local.set $style (call $wnd_get_style (local.get $hwnd)))
    ;; Background: the parent's WM_CTLCOLORSTATIC brush for a transparent
    ;; clip, the 3D face otherwise.
    (local.set $brush (i32.const 16))   ;; COLOR_BTNFACE + 1
    (if (i32.and (local.get $style) (i32.const 2))
      (then
        (if (local.get $live)
          (then
            (local.set $bg (call $wnd_send_message (call $wnd_get_parent (local.get $hwnd))
              (i32.const 0x0138) (local.get $hdc) (local.get $hwnd)))
            (store.field AnimateState bg_brush (local.get $sw) (local.get $bg)))
          (else (local.set $bg (load.field AnimateState bg_brush (local.get $sw)))))
        (if (local.get $bg) (then (local.set $brush (local.get $bg))))))
    (local.set $w (load.field AnimateState width (local.get $sw)))
    (local.set $h (load.field AnimateState height (local.get $sw)))
    (if (i32.or (i32.eqz (load.field AnimateState frec (local.get $sw)))
                (i32.lt_s (load.field AnimateState decoded (local.get $sw)) (i32.const 0)))
      (then
        (drop (call $gdi_native_fill_rect (local.get $hdc) (i32.const 0) (i32.const 0)
          (local.get $cw) (local.get $ch) (local.get $brush)))
        (return)))
    (if (i32.and (local.get $style) (i32.const 1))
      (then
        (local.set $x0 (i32.div_s (i32.sub (local.get $cw) (local.get $w)) (i32.const 2)))
        (local.set $y0 (i32.div_s (i32.sub (local.get $ch) (local.get $h)) (i32.const 2)))))
    (if (i32.or (i32.or (i32.gt_s (local.get $x0) (i32.const 0)) (i32.gt_s (local.get $y0) (i32.const 0)))
                (i32.or (i32.lt_s (local.get $w) (local.get $cw)) (i32.lt_s (local.get $h) (local.get $ch))))
      (then (drop (call $gdi_native_fill_rect (local.get $hdc) (i32.const 0) (i32.const 0)
              (local.get $cw) (local.get $ch) (local.get $brush)))))
    (local.set $src (load.field AnimateState frame_wa (local.get $sw)))
    ;; ACS_TRANSPARENT: the first frame's top-left pixel is the key, and keyed
    ;; pixels take the background colour.
    (if (i32.and (i32.ne (i32.and (local.get $style) (i32.const 2)) (i32.const 0))
                 (i32.ne (load.field AnimateState comp_wa (local.get $sw)) (i32.const 0)))
      (then
        (if (i32.eq (load.field AnimateState key (local.get $sw)) (i32.const -1))
          (then (store.field AnimateState key (local.get $sw)
                  (i32.and (i32.load (local.get $src)) (i32.const 0x00FFFFFF)))))
        (local.set $key (load.field AnimateState key (local.get $sw)))
        (local.set $bg (call $gdi_brush_solid_color (local.get $hdc) (local.get $brush)))
        (if (i32.gt_u (local.get $bg) (i32.const 0x00FFFFFF))
          (then (local.set $bg (call $win98_sys_color (i32.const 15)))))
        ;; COLORREF 0x00BBGGRR -> the BGRX dword the converters write.
        (local.set $bg (call $gdi_raster_swap_rb (local.get $bg)))
        (local.set $n (i32.mul (local.get $w) (local.get $h)))
        (block $done (loop $px_loop
          (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
          (local.set $px (i32.load (i32.add (local.get $src) (i32.shl (local.get $i) (i32.const 2)))))
          (i32.store (i32.add (load.field AnimateState comp_wa (local.get $sw)) (i32.shl (local.get $i) (i32.const 2)))
            (select (local.get $bg) (local.get $px)
              (i32.eq (i32.and (local.get $px) (i32.const 0x00FFFFFF)) (local.get $key))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $px_loop)))
        (local.set $src (load.field AnimateState comp_wa (local.get $sw)))))
    ;; Clip the clip to the control.
    (local.set $bw (local.get $w))
    (local.set $bh (local.get $h))
    (if (i32.lt_s (local.get $x0) (i32.const 0))
      (then (local.set $sx (i32.sub (i32.const 0) (local.get $x0))) (local.set $x0 (i32.const 0))))
    (if (i32.lt_s (local.get $y0) (i32.const 0))
      (then (local.set $sy (i32.sub (i32.const 0) (local.get $y0))) (local.set $y0 (i32.const 0))))
    (local.set $bw (i32.sub (local.get $bw) (local.get $sx)))
    (local.set $bh (i32.sub (local.get $bh) (local.get $sy)))
    (if (i32.gt_s (i32.add (local.get $x0) (local.get $bw)) (local.get $cw))
      (then (local.set $bw (i32.sub (local.get $cw) (local.get $x0)))))
    (if (i32.gt_s (i32.add (local.get $y0) (local.get $bh)) (local.get $ch))
      (then (local.set $bh (i32.sub (local.get $ch) (local.get $y0)))))
    (if (i32.or (i32.le_s (local.get $bw) (i32.const 0)) (i32.le_s (local.get $bh) (i32.const 0)))
      (then (return)))
    ;; Rows are top-down, so the vertical offset goes on the bits pointer
    ;; (see the DirectDraw present for why ySrc stays 0).
    (drop (call $gdi_native_set_dib_to_device (local.get $hdc)
      (local.get $x0) (local.get $y0) (local.get $bw) (local.get $bh)
      (local.get $sx) (i32.const 0) (i32.const 0) (local.get $bh)
      (i32.add (local.get $src) (i32.shl (i32.mul (local.get $sy) (local.get $w)) (i32.const 2)))
      (load.field AnimateState bmi_wa (local.get $sw)) (i32.const 0))))

  (func $animate_wndproc (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $state i32) (local $sw ptr<AnimateState>)
    (local.set $state (call $wnd_get_state_ptr (local.get $hwnd)))
    ;; WM_CREATE, or the first message of a window that missed it.
    (if (i32.or (i32.eq (local.get $msg) (i32.const 0x0001)) (i32.eqz (local.get $state)))
      (then
        (if (i32.eq (local.get $msg) (i32.const 0x0002)) (then (return (i32.const 0))))
        (if (i32.eqz (local.get $state))
          (then
            (local.set $state (call $heap_alloc (size-of AnimateState)))
            (if (i32.eqz (local.get $state)) (then (return (i32.const -1))))
            (local.set $sw (call $g2w (local.get $state)))
            (call $zero_memory (local.get $sw) (size-of AnimateState))
            (store.field AnimateState decoded (local.get $sw) (i32.const -1))
            (store.field AnimateState key (local.get $sw) (i32.const -1))
            (call $wnd_set_state_ptr (local.get $hwnd) (local.get $state))))
        (if (i32.eq (local.get $msg) (i32.const 0x0001)) (then (return (i32.const 0))))))
    (local.set $sw (call $g2w (local.get $state)))
    ;; WM_DESTROY
    (if (i32.eq (local.get $msg) (i32.const 0x0002))
      (then
        (call $anim_close (local.get $hwnd) (local.get $sw))
        (call $heap_free (local.get $state))
        (call $wnd_set_state_ptr (local.get $hwnd) (i32.const 0))
        (return (i32.const 0))))
    ;; ACM_OPENA / ACM_OPENW
    (if (i32.or (i32.eq (local.get $msg) (i32.const 0x0464)) (i32.eq (local.get $msg) (i32.const 0x0467)))
      (then
        (call $anim_close (local.get $hwnd) (local.get $sw))
        (call $invalidate_hwnd (local.get $hwnd))
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 1))))
        (return (call $anim_open (local.get $hwnd) (local.get $sw)
          (call $anim_open_source (local.get $hwnd) (local.get $wParam) (local.get $lParam)
            (i32.eq (local.get $msg) (i32.const 0x0467)))))))
    ;; ACM_PLAY
    (if (i32.eq (local.get $msg) (i32.const 0x0465))
      (then (return (call $anim_play (local.get $hwnd) (local.get $sw) (local.get $wParam)
        (i32.and (local.get $lParam) (i32.const 0xFFFF))
        (i32.shr_u (local.get $lParam) (i32.const 16))))))
    ;; ACM_STOP
    (if (i32.eq (local.get $msg) (i32.const 0x0466))
      (then (call $anim_stop (local.get $hwnd) (local.get $sw)) (return (i32.const 1))))
    ;; ACM_ISPLAYING
    (if (i32.eq (local.get $msg) (i32.const 0x0468))
      (then (return (load.field AnimateState timer_on (local.get $sw)))))
    ;; WM_TIMER
    (if (i32.eq (local.get $msg) (i32.const 0x0113))
      (then
        (if (i32.and (i32.eq (local.get $wParam) (i32.const 1))
                     (i32.ne (load.field AnimateState timer_on (local.get $sw)) (i32.const 0)))
          (then (call $anim_step (local.get $hwnd) (local.get $sw) (i32.const 0))))
        (return (i32.const 0))))
    ;; WM_ERASEBKGND: WM_PAINT covers the whole client.
    (if (i32.eq (local.get $msg) (i32.const 0x0014)) (then (return (i32.const 1))))
    ;; WM_PAINT
    (if (i32.eq (local.get $msg) (i32.const 0x000F))
      (then (call $anim_paint (local.get $hwnd) (local.get $sw) (i32.const 1)) (return (i32.const 0))))
    (i32.const 0))
