  ;; ---- MCIWnd: MSVFW32's movie window ---------------------------------
  ;;
  ;; MCIWndCreateA makes a child window of class "MCIWndClass" and the app
  ;; then drives it with messages instead of command strings. Civilization II
  ;; MGE (civ2.exe 0x58e203..0x58e6f6) is the shape this follows:
  ;;   MCIWndCreateA(parent, hinst, WS_CHILD|NOTIFYMODE|NOMENU|NOPLAYBAR, file)
  ;;   MCIWNDM_OPENA file, MCIWNDM_SETTIMEFORMATA "frames", ShowWindow,
  ;;   MCIWNDM_REALIZE, MCI_SEEK, MCI_PLAY ... MCIWNDM_NOTIFYMODE back ...
  ;;   MCI_STOP, MCIWNDM_GETPOSITIONA, MCI_CLOSE, WM_CLOSE.
  ;;
  ;; The window owns no player of its own. Every message is turned into a
  ;; command string for the avivideo device in 09a7h-video-mciavi.wat, under
  ;; the alias "mciwnd<hwnd>" with the window itself as "parent", so frames
  ;; land in this window and the device's completion MM_MCINOTIFY comes back
  ;; here. That keeps one implementation of open/decode/clock/audio.
  ;;
  ;; Not drawn: the playbar (trackbar + play button) and the menu button a
  ;; window without MCIWNDF_NOPLAYBAR / MCIWNDF_NOMENU would have. The movie
  ;; still plays in the window; the controls are absent.
  ;;
  ;; $MCIWND_TABLE:
  ;;   +0x000 class name   +0x020 alias prefix   +0x040 error text
  ;;   +0x100 command string being built (0x300)
  ;;   +0x400 device reply (0x100)
  (global $MCIWND_TABLE i32 (region.addr $MCIWND_TABLE 0))
  (global $MCIWND_TABLE_SIZE i32 (region.size $MCIWND_TABLE))

  (data (region.addr $MCIWND_TABLE 0x000) "MCIWndClass\00")
  (data (region.addr $MCIWND_TABLE 0x020) "mciwnd\00")
  (data (region.addr $MCIWND_TABLE 0x040) "MCIWnd message\00")

  ;; MCIWNDF_* style bits
  (global $MCIWNDF_NOAUTOSIZEWINDOW i32 (i32.const 0x0001))
  (global $MCIWNDF_NOTIFYMODE i32 (i32.const 0x0100))

  ;; MCI_MODE_* as MCIWNDM_GETMODE / MCIWNDM_NOTIFYMODE report them.
  (global $MCI_MODE_NOT_READY i32 (i32.const 524))
  (global $MCI_MODE_STOP i32 (i32.const 525))
  (global $MCI_MODE_PLAY i32 (i32.const 526))
  (global $MCI_MODE_PAUSE i32 (i32.const 529))

  ;; Append the NUL-terminated $src at $p, return the NUL's address.
  (func $mciwnd_cat (param $p i32) (param $src i32) (result i32)
    (local $c i32)
    (block $done (loop $copy
      (local.set $c (i32.load8_u (local.get $src)))
      (br_if $done (i32.eqz (local.get $c)))
      (i32.store8 (local.get $p) (local.get $c))
      (local.set $p (i32.add (local.get $p) (i32.const 1)))
      (local.set $src (i32.add (local.get $src) (i32.const 1)))
      (br $copy)))
    (i32.store8 (local.get $p) (i32.const 0))
    (local.get $p))

  ;; Append " " + device keyword $n (09a7h's table).
  (func $mciwnd_word (param $p i32) (param $n i32) (result i32)
    (i32.store8 (local.get $p) (i32.const 32))
    (call $mciwnd_cat (i32.add (local.get $p) (i32.const 1)) (call $mciavi_kw (local.get $n))))

  ;; Append " " + decimal $v.
  (func $mciwnd_num (param $p i32) (param $v i32) (result i32)
    (i32.store8 (local.get $p) (i32.const 32))
    (call $mciavi_put_dec (i32.add (local.get $p) (i32.const 1)) (local.get $v)))

  ;; Append " mciwnd<hwnd>".
  (func $mciwnd_put_alias (param $p i32) (param $hwnd i32) (result i32)
    (i32.store8 (local.get $p) (i32.const 32))
    (local.set $p (call $mciwnd_cat (i32.add (local.get $p) (i32.const 1))
      (region.addr $MCIWND_TABLE 0x020)))
    (call $mciavi_put_dec (local.get $p) (local.get $hwnd)))

  ;; Start a command "<verb> mciwnd<hwnd>"; the end of it.
  (func $mciwnd_begin (param $verb i32) (param $hwnd i32) (result i32)
    (call $mciwnd_put_alias
      (call $mciwnd_cat (region.addr $MCIWND_TABLE 0x100) (call $mciavi_kw (local.get $verb)))
      (local.get $hwnd)))

  ;; Send the command built at +0x100; the MCI error (0 = success). The reply,
  ;; if any, is at +0x400. Completion notifications come back to $hwnd.
  (func $mciwnd_run (param $hwnd i32) (result i32)
    (local $err i32)
    (i32.store8 (region.addr $MCIWND_TABLE 0x400) (i32.const 0))
    (local.set $err (call $mciavi_string (region.addr $MCIWND_TABLE 0x100)
      (region.addr $MCIWND_TABLE 0x400) (i32.const 0x100) (local.get $hwnd)))
    ;; Only commands naming our own alias get here, so the device always
    ;; claims them; NOT_MINE means the alias is not open.
    (if (i32.eq (local.get $err) (global.get $MCIAVI_NOT_MINE))
      (then (return (global.get $MCIERR_INVALID_DEVICE_ID))))
    (local.get $err))

  (func $mciwnd_simple (param $verb i32) (param $hwnd i32) (result i32)
    (drop (call $mciwnd_begin (local.get $verb) (local.get $hwnd)))
    (call $mciwnd_run (local.get $hwnd)))

  ;; The device id of this window's movie, 0 when none is open.
  (func $mciwnd_device (param $hwnd i32) (result i32)
    (drop (call $mciwnd_put_alias (region.addr $MCIWND_TABLE 0x0FF) (local.get $hwnd)))
    (call $mciavi_device_id (region.addr $MCIWND_TABLE 0x100)))

  ;; Parse a decimal at $p (the device's replies); $end receives the byte after.
  (func $mciwnd_dec (param $p i32) (result i32)
    (local $v i32) (local $c i32)
    (block $done (loop $digits
      (local.set $c (i32.sub (i32.load8_u (local.get $p)) (i32.const 48)))
      (br_if $done (i32.gt_u (local.get $c) (i32.const 9)))
      (local.set $v (i32.add (i32.mul (local.get $v) (i32.const 10)) (local.get $c)))
      (local.set $p (i32.add (local.get $p) (i32.const 1)))
      (br $digits)))
    (local.get $v))

  ;; "status mciwndN <what>" as a number, -1 on error.
  (func $mciwnd_status_num (param $hwnd i32) (param $what i32) (result i32)
    (drop (call $mciwnd_word (call $mciwnd_begin (i32.const 27) (local.get $hwnd)) (local.get $what)))
    (if (call $mciwnd_run (local.get $hwnd)) (then (return (i32.const -1))))
    (call $mciwnd_dec (region.addr $MCIWND_TABLE 0x400)))

  ;; The MCI_MODE_* of this window's device.
  (func $mciwnd_mode (param $hwnd i32) (result i32)
    (local $c i32)
    (if (i32.eqz (call $mciwnd_device (local.get $hwnd)))
      (then (return (global.get $MCI_MODE_NOT_READY))))
    (drop (call $mciwnd_word (call $mciwnd_begin (i32.const 27) (local.get $hwnd)) (i32.const 30)))
    (if (call $mciwnd_run (local.get $hwnd)) (then (return (global.get $MCI_MODE_NOT_READY))))
    ;; "stopped" / "playing" / "paused"
    (local.set $c (i32.load8_u offset=1 (region.addr $MCIWND_TABLE 0x400)))
    (if (i32.eq (local.get $c) (i32.const 0x6C)) (then (return (global.get $MCI_MODE_PLAY))))
    (if (i32.eq (local.get $c) (i32.const 0x61)) (then (return (global.get $MCI_MODE_PAUSE))))
    (global.get $MCI_MODE_STOP))

  ;; MCIWNDF_NOTIFYMODE: tell the parent the mode after anything that may
  ;; have changed it. Posted, since the parent is guest code and this runs
  ;; inside a message the guest sent.
  (func $mciwnd_notify_mode (param $hwnd i32)
    (if (i32.eqz (i32.and (call $wnd_get_style (local.get $hwnd)) (global.get $MCIWNDF_NOTIFYMODE)))
      (then (return)))
    (drop (call $post_queue_push (call $wnd_get_parent (local.get $hwnd))
      (i32.const 0x4C8)   ;; MCIWNDM_NOTIFYMODE
      (local.get $hwnd) (call $mciwnd_mode (local.get $hwnd)))))

  ;; Copy a guest ANSI string to $p inside quotes; the end.
  (func $mciwnd_put_guest_quoted (param $p i32) (param $g i32) (result i32)
    (local $c i32) (local $n i32)
    (i32.store8 (local.get $p) (i32.const 32))
    (i32.store8 offset=1 (local.get $p) (i32.const 34))
    (local.set $p (i32.add (local.get $p) (i32.const 2)))
    (block $done (loop $copy
      (br_if $done (i32.ge_u (local.get $n) (i32.const 0x200)))
      (local.set $c (call $gl8 (i32.add (local.get $g) (local.get $n))))
      (br_if $done (i32.eqz (local.get $c)))
      (i32.store8 (local.get $p) (local.get $c))
      (local.set $p (i32.add (local.get $p) (i32.const 1)))
      (local.set $n (i32.add (local.get $n) (i32.const 1)))
      (br $copy)))
    (i32.store8 (local.get $p) (i32.const 34))
    (i32.store8 offset=1 (local.get $p) (i32.const 0))
    (i32.add (local.get $p) (i32.const 1)))

  ;; MCIWNDM_OPENA: close any movie, open $file_g, size the window to it.
  (func $mciwnd_open (param $hwnd i32) (param $file_g i32) (result i32)
    (local $p i32) (local $err i32) (local $w i32) (local $h i32)
    (if (call $mciwnd_device (local.get $hwnd))
      (then (drop (call $mciwnd_simple (i32.const 26) (local.get $hwnd)))))
    (if (i32.eqz (local.get $file_g)) (then (return (global.get $MCIERR_MISSING_PARAMETER))))
    ;; open "<file>" type avivideo alias mciwndN parent <hwnd> style child
    (local.set $p (call $mciwnd_cat (region.addr $MCIWND_TABLE 0x100) (call $mciavi_kw (i32.const 0))))
    (local.set $p (call $mciwnd_put_guest_quoted (local.get $p) (local.get $file_g)))
    (local.set $p (call $mciwnd_word (local.get $p) (i32.const 1)))
    (local.set $p (call $mciwnd_word (local.get $p) (i32.const 3)))
    (local.set $p (call $mciwnd_word (local.get $p) (i32.const 2)))
    (local.set $p (call $mciwnd_put_alias (local.get $p) (local.get $hwnd)))
    (local.set $p (call $mciwnd_word (local.get $p) (i32.const 4)))
    (local.set $p (call $mciwnd_num (local.get $p) (local.get $hwnd)))
    (local.set $p (call $mciwnd_word (local.get $p) (i32.const 5)))
    (drop (call $mciwnd_word (local.get $p) (i32.const 52)))
    (local.set $err (call $mciavi_string (region.addr $MCIWND_TABLE 0x100)
      (region.addr $MCIWND_TABLE 0x400) (i32.const 0x100) (i32.const 0)))
    ;; A file the avivideo device does not take (not an AVI) is NOT_MINE.
    (if (i32.eq (local.get $err) (global.get $MCIAVI_NOT_MINE))
      (then (return (global.get $MCIERR_INVALID_FILE))))
    (if (local.get $err) (then (return (local.get $err))))
    ;; Size the window to the movie: "where mciwndN source" -> "0 0 w h".
    (if (i32.eqz (i32.and (call $wnd_get_style (local.get $hwnd)) (global.get $MCIWNDF_NOAUTOSIZEWINDOW)))
      (then
        (drop (call $mciwnd_word (call $mciwnd_begin (i32.const 40) (local.get $hwnd)) (i32.const 41)))
        (if (i32.eqz (call $mciwnd_run (local.get $hwnd)))
          (then
            (local.set $p (region.addr $MCIWND_TABLE 0x400))
            (local.set $p (i32.add (local.get $p) (i32.const 4)))   ;; past "0 0 "
            (local.set $w (call $mciwnd_dec (local.get $p)))
            (block $sp (loop $skip
              (br_if $sp (i32.eq (i32.load8_u (local.get $p)) (i32.const 32)))
              (br_if $sp (i32.eqz (i32.load8_u (local.get $p))))
              (local.set $p (i32.add (local.get $p) (i32.const 1)))
              (br $skip)))
            (local.set $h (call $mciwnd_dec (i32.add (local.get $p) (i32.const 1))))
            (if (i32.and (i32.ne (local.get $w) (i32.const 0)) (i32.ne (local.get $h) (i32.const 0)))
              (then
                (drop (call $move_window_core (local.get $hwnd) (i32.const 0)
                  (i32.const 0) (i32.const 0) (local.get $w) (local.get $h)
                  (i32.const 0x16)   ;; SWP_NOMOVE|SWP_NOZORDER|SWP_NOACTIVATE
                  (i32.const 0)))))))))
    (call $mciwnd_notify_mode (local.get $hwnd))
    (i32.const 0))

  ;; MCI_SEEK: lParam is a position, MCIWND_START (-1) or MCIWND_END (-2).
  (func $mciwnd_seek (param $hwnd i32) (param $pos i32) (result i32)
    (local $p i32)
    (local.set $p (call $mciwnd_word (call $mciwnd_begin (i32.const 14) (local.get $hwnd)) (i32.const 15)))
    (if (i32.eq (local.get $pos) (i32.const -1))
      (then (drop (call $mciwnd_word (local.get $p) (i32.const 16))))
      (else
        (if (i32.eq (local.get $pos) (i32.const -2))
          (then (drop (call $mciwnd_word (local.get $p) (i32.const 17))))
          (else (drop (call $mciwnd_num (local.get $p) (local.get $pos)))))))
    (call $mciwnd_run (local.get $hwnd)))

  ;; Copy the last reply into a guest buffer of $cap bytes, if one was given.
  (func $mciwnd_reply_to_guest (param $buf_g i32) (param $cap i32)
    (local $i i32) (local $c i32)
    (if (i32.or (i32.eqz (local.get $buf_g)) (i32.eqz (local.get $cap))) (then (return)))
    (block $done (loop $copy
      (br_if $done (i32.ge_u (i32.add (local.get $i) (i32.const 1)) (local.get $cap)))
      (local.set $c (i32.load8_u (i32.add (region.addr $MCIWND_TABLE 0x400) (local.get $i))))
      (br_if $done (i32.eqz (local.get $c)))
      (call $gs8 (i32.add (local.get $buf_g) (local.get $i)) (local.get $c))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $copy)))
    (call $gs8 (i32.add (local.get $buf_g) (local.get $i)) (i32.const 0)))

  (func $mciwnd_wndproc (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $r i32) (local $p i32)
    ;; WM_PAINT: the current frame, if a movie is open.
    (if (i32.eq (local.get $msg) (i32.const 0x000F))
      (then
        (call $update_clear_hwnd (local.get $hwnd))
        (call $paint_flag_clear_hwnd (local.get $hwnd))
        (if (call $mciwnd_device (local.get $hwnd))
          (then (drop (call $mciwnd_simple (i32.const 48) (local.get $hwnd)))))
        (return (i32.const 0))))
    ;; WM_ERASEBKGND: the frame covers the client.
    (if (i32.eq (local.get $msg) (i32.const 0x0014)) (then (return (i32.const 1))))
    ;; WM_DESTROY: close the movie with the window.
    (if (i32.eq (local.get $msg) (i32.const 0x0002))
      (then
        (if (call $mciwnd_device (local.get $hwnd))
          (then (drop (call $mciwnd_simple (i32.const 26) (local.get $hwnd)))))
        (return (i32.const 0))))
    ;; WM_CLOSE: DefWindowProc destroys the window.
    (if (i32.eq (local.get $msg) (i32.const 0x0010))
      (then (call $wnd_destroy_recursive (local.get $hwnd)) (return (i32.const 0))))
    ;; MM_MCINOTIFY from the device: playback ended or was superseded.
    (if (i32.eq (local.get $msg) (i32.const 0x03B9))
      (then (call $mciwnd_notify_mode (local.get $hwnd)) (return (i32.const 0))))
    (if (i32.lt_u (local.get $msg) (i32.const 0x400)) (then (return (i32.const 0))))

    ;; MCIWNDM_OPENA
    (if (i32.eq (local.get $msg) (i32.const 0x499))
      (then (return (call $mciwnd_open (local.get $hwnd) (local.get $lParam)))))
    ;; MCIWNDM_GETDEVICEID
    (if (i32.eq (local.get $msg) (i32.const 0x464))
      (then (return (call $mciwnd_device (local.get $hwnd)))))
    ;; MCIWNDM_SENDSTRINGA: a command string for this window's device. The
    ;; app omits the alias; MCIWnd inserts it after the verb.
    (if (i32.eq (local.get $msg) (i32.const 0x465))
      (then
        (local.set $p (region.addr $MCIWND_TABLE 0x100))
        (local.set $r (i32.const 0))
        (block $verb (loop $copy
          (br_if $verb (i32.ge_u (local.get $r) (i32.const 0x40)))
          (local.set $msg (call $gl8 (i32.add (local.get $lParam) (local.get $r))))
          (br_if $verb (i32.or (i32.eqz (local.get $msg)) (i32.eq (local.get $msg) (i32.const 32))))
          (i32.store8 (local.get $p) (local.get $msg))
          (local.set $p (i32.add (local.get $p) (i32.const 1)))
          (local.set $r (i32.add (local.get $r) (i32.const 1)))
          (br $copy)))
        (local.set $p (call $mciwnd_put_alias (local.get $p) (local.get $hwnd)))
        (block $rest (loop $copy2
          (br_if $rest (i32.ge_u (local.get $r) (i32.const 0x200)))
          (local.set $msg (call $gl8 (i32.add (local.get $lParam) (local.get $r))))
          (br_if $rest (i32.eqz (local.get $msg)))
          (i32.store8 (local.get $p) (local.get $msg))
          (local.set $p (i32.add (local.get $p) (i32.const 1)))
          (local.set $r (i32.add (local.get $r) (i32.const 1)))
          (br $copy2)))
        (i32.store8 (local.get $p) (i32.const 0))
        (local.set $r (call $mciwnd_run (local.get $hwnd)))
        (call $mciwnd_notify_mode (local.get $hwnd))
        (return (local.get $r))))
    ;; MCIWNDM_GETPOSITIONA (wParam = cch, lParam = buffer): the position.
    (if (i32.eq (local.get $msg) (i32.const 0x466))
      (then
        (local.set $r (call $mciwnd_status_num (local.get $hwnd) (i32.const 29)))
        (call $mciwnd_reply_to_guest (local.get $lParam) (local.get $wParam))
        (return (local.get $r))))
    ;; MCIWNDM_GETSTART
    (if (i32.eq (local.get $msg) (i32.const 0x467)) (then (return (i32.const 0))))
    ;; MCIWNDM_GETLENGTH / MCIWNDM_GETEND
    (if (i32.or (i32.eq (local.get $msg) (i32.const 0x468)) (i32.eq (local.get $msg) (i32.const 0x469)))
      (then (return (call $mciwnd_status_num (local.get $hwnd) (i32.const 28)))))
    ;; MCIWNDM_GETMODEA (wParam = cch, lParam = buffer)
    (if (i32.eq (local.get $msg) (i32.const 0x46A))
      (then
        (local.set $r (call $mciwnd_mode (local.get $hwnd)))
        (call $mciwnd_reply_to_guest (local.get $lParam) (local.get $wParam))
        (return (local.get $r))))
    ;; MCIWNDM_REALIZE: the device decodes to true colour; nothing to realize.
    (if (i32.eq (local.get $msg) (i32.const 0x476))
      (then (return (call $mciwnd_simple (i32.const 47) (local.get $hwnd)))))
    ;; MCIWNDM_SETTIMEFORMATA: lParam "frames" / "ms".
    (if (i32.eq (local.get $msg) (i32.const 0x477))
      (then
        (local.set $p (call $mciwnd_word (call $mciwnd_word
          (call $mciwnd_begin (i32.const 31) (local.get $hwnd)) (i32.const 32)) (i32.const 33)))
        (i32.store8 (local.get $p) (i32.const 32))
        (local.set $p (i32.add (local.get $p) (i32.const 1)))
        (local.set $r (i32.const 0))
        (block $done (loop $copy
          (br_if $done (i32.ge_u (local.get $r) (i32.const 0x20)))
          (local.set $msg (call $gl8 (i32.add (local.get $lParam) (local.get $r))))
          (br_if $done (i32.eqz (local.get $msg)))
          (i32.store8 (local.get $p) (local.get $msg))
          (local.set $p (i32.add (local.get $p) (i32.const 1)))
          (local.set $r (i32.add (local.get $r) (i32.const 1)))
          (br $copy)))
        (i32.store8 (local.get $p) (i32.const 0))
        (return (call $mciwnd_run (local.get $hwnd)))))
    ;; MCIWNDM_GETPALETTE: no palette, frames are decoded to 32 bpp.
    ;; MCIWNDM_SETPALETTE: accepted and unused for the same reason.
    (if (i32.or (i32.eq (local.get $msg) (i32.const 0x47E)) (i32.eq (local.get $msg) (i32.const 0x47F)))
      (then (return (i32.const 0))))
    ;; MCI_CLOSE
    (if (i32.eq (local.get $msg) (i32.const 0x804))
      (then
        (local.set $r (i32.const 0))
        (if (call $mciwnd_device (local.get $hwnd))
          (then (local.set $r (call $mciwnd_simple (i32.const 26) (local.get $hwnd)))))
        (call $mciwnd_notify_mode (local.get $hwnd))
        (return (local.get $r))))
    ;; MCI_PLAY: "play mciwndN notify", so the end comes back as MM_MCINOTIFY.
    (if (i32.eq (local.get $msg) (i32.const 0x806))
      (then
        (drop (call $mciwnd_word (call $mciwnd_begin (i32.const 21) (local.get $hwnd)) (i32.const 7)))
        (local.set $r (call $mciwnd_run (local.get $hwnd)))
        (call $mciwnd_notify_mode (local.get $hwnd))
        (return (local.get $r))))
    ;; MCI_SEEK
    (if (i32.eq (local.get $msg) (i32.const 0x807))
      (then
        (local.set $r (call $mciwnd_seek (local.get $hwnd) (local.get $lParam)))
        (call $mciwnd_notify_mode (local.get $hwnd))
        (return (local.get $r))))
    ;; MCI_STOP / MCI_PAUSE / MCI_RESUME
    (if (i32.eq (local.get $msg) (i32.const 0x808))
      (then (local.set $r (call $mciwnd_simple (i32.const 23) (local.get $hwnd)))
            (call $mciwnd_notify_mode (local.get $hwnd)) (return (local.get $r))))
    (if (i32.eq (local.get $msg) (i32.const 0x809))
      (then (local.set $r (call $mciwnd_simple (i32.const 24) (local.get $hwnd)))
            (call $mciwnd_notify_mode (local.get $hwnd)) (return (local.get $r))))
    (if (i32.eq (local.get $msg) (i32.const 0x855))
      (then (local.set $r (call $mciwnd_simple (i32.const 25) (local.get $hwnd)))
            (call $mciwnd_notify_mode (local.get $hwnd)) (return (local.get $r))))
    ;; Any other private message is part of the MCIWnd protocol this file
    ;; does not have yet; name it rather than answer 0.
    (call $host_log_i32 (local.get $msg))
    (call $crash_unimplemented (region.addr $MCIWND_TABLE 0x040))
    (i32.const 0))

  ;; MCIWndCreateA(hwndParent, hInstance, dwStyle, szFile) -- cdecl (VFWAPIV).
  ;; With a parent the window is visible (MSVFW32 ORs in WS_VISIBLE); it
  ;; starts empty and takes the movie's size when szFile opens.
  (func $handle_MCIWndCreateA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base)
      (call $mciwnd_create (local.get $arg0) (local.get $arg2) (local.get $arg3)))
    ;; cdecl: pop only the return address.
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  (func $mciwnd_create (param $arg0 i32) (param $arg2 i32) (param $arg3 i32) (result i32)
    (local $hwnd i32) (local $style i32)
    (local.set $style (local.get $arg2))
    (if (local.get $arg0)
      (then (local.set $style (i32.or (local.get $style) (i32.const 0x10000000)))))
    (local.set $style (i32.or (local.get $style) (i32.const 0x06000000)))   ;; CLIPSIBLINGS|CLIPCHILDREN
    (local.set $hwnd (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (call $wnd_table_set (local.get $hwnd) (global.get $WNDPROC_MCIWND))
    (call $wnd_set_parent (local.get $hwnd) (local.get $arg0))
    (drop (call $wnd_set_style (local.get $hwnd) (local.get $style)))
    (call $ctrl_geom_set (call $wnd_table_find (local.get $hwnd))
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (drop (call $host_create_window (local.get $hwnd) (local.get $style)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
    (call $host_set_parent (local.get $hwnd) (local.get $arg0))
    (call $host_set_window_class (local.get $hwnd) (region.addr $MCIWND_TABLE 0x000))
    (if (local.get $arg3)
      (then (drop (call $mciwnd_open (local.get $hwnd) (local.get $arg3)))))
    (if (i32.and (local.get $style) (i32.const 0x10000000))
      (then (call $paint_flag_set_inv (local.get $hwnd))))
    (local.get $hwnd))
