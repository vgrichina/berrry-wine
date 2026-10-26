  ;; ---- MCI avivideo: the MCIAVI device ---------------------------------
  ;;
  ;; The movie player apps without their own decode loop use:
  ;;   open media\intro.avi type AVIVideo alias A parent H style child
  ;;   window A handle H state restore
  ;;   put A destination at x y w h
  ;;   seek A to start       break A on 27       play A wait
  ;;   stop A                close A
  ;; (Half-Life Uplink, every command with a trailing "wait").
  ;;
  ;; $mci_send_string (09a7-handlers-dispatch.wat) offers every command here
  ;; first; anything that is not an avivideo open or one of these devices'
  ;; aliases goes on to the host's parser (waveaudio, sequencer, cdaudio).
  ;;
  ;; The device reuses the rest of Video for Windows: the AVI reader
  ;; (09a7f) for the file and its chunk tables, and an ICM record (09a7g) to
  ;; decode frames into a 32-bit DIB, painted onto the target window with the
  ;; StretchDIBits path. Frames follow the guest clock from the moment play
  ;; starts; a frame the clock has already passed is decoded (inter frames
  ;; need their predecessors) but only the newest one is painted. The PCM
  ;; audio stream, when there is one, is fed to a host waveOut voice about
  ;; half a second ahead of the picture.
  ;;
  ;; "play ... wait" blocks the guest call: the handler parks on its import
  ;; thunk with the stdcall frame intact and runs again next turn, each run
  ;; advancing the movie, until the end, "stop", or the "break" key. A play
  ;; without wait advances from the app's own GetMessage/PeekMessage calls,
  ;; and $mciavi_due_ms tells the host when to wake a GetMessage that blocks.
  ;;
  ;; $MCIAVI_TABLE:
  ;;   +0x000  device records, $MCIAVI_SLOTS x 0x100
  ;;   +0x400  token table, 32 x {wa, len}
  ;;   +0x500  return-string staging (0x100)
  ;;   +0x800  keyword strings
  ;;
  ;; device record:
  ;;   +0x00 open  +0x04 device id  +0x08 AVI file record  +0x0C video block
  ;;   +0x10 audio block (0 = none)  +0x14 HIC  +0x18 input format (guest)
  ;;   +0x1C chunk buffer (guest)  +0x20 its capacity  +0x24 output BITMAPINFO
  ;;   (guest, bits follow at +40)  +0x28 target hwnd  +0x2C..+0x38 destination
  ;;   x y w h (w 0 = the movie's size)  +0x3C frames decoded (next to decode)
  ;;   +0x40 frame count  +0x44 us per frame  +0x48 mode (0 stop, 1 play,
  ;;   2 pause)  +0x4C tick at play start  +0x50 frame at play start
  ;;   +0x54 end frame (exclusive)  +0x58 ESP of a parked "play wait"
  ;;   +0x5C break vk  +0x60 wave voice  +0x64 next audio entry
  ;;   +0x68 audio bytes queued  +0x6C audio bytes/s  +0x70 notify hwnd
  ;;   +0x74 time format (0 ms, 3 frames)  +0x78 audio buffer (guest)
  ;;   +0x7C its capacity  +0x80 alias, lower case (64)  +0xC0 last painted
  ;;   +0xC4 hidden  +0xC8 parent hwnd  +0xCC width  +0xD0 height
  ;;   +0xD4 1 = an installed codec's DLL was loading at open; open it at
  ;;   the first frame (HIC 0 until then)
  (global $MCIAVI_TABLE i32 (region.addr $MCIAVI_TABLE 0))
  (global $MCIAVI_TABLE_SIZE i32 (region.size $MCIAVI_TABLE))
  (global $MCIAVI_SLOTS i32 (i32.const 4))
  (global $MCIAVI_ID_BASE i32 (i32.const 0x7F00))
  (global $mciavi_active (mut i32) (i32.const 0))   ;; devices in play mode
  (global $mciavi_ntok (mut i32) (i32.const 0))

  (global $MCIERR_INVALID_DEVICE_ID i32 (i32.const 257))
  (global $MCIERR_UNRECOGNIZED_KEYWORD i32 (i32.const 259))
  (global $MCIERR_UNRECOGNIZED_COMMAND i32 (i32.const 261))
  (global $MCIERR_OUT_OF_MEMORY i32 (i32.const 264))
  (global $MCIERR_MISSING_PARAMETER i32 (i32.const 273))
  (global $MCIERR_UNSUPPORTED_FUNCTION i32 (i32.const 274))
  (global $MCIERR_FILE_NOT_FOUND i32 (i32.const 275))
  (global $MCIERR_OUTOFRANGE i32 (i32.const 282))
  (global $MCIERR_DUPLICATE_ALIAS i32 (i32.const 289))
  (global $MCIERR_INVALID_FILE i32 (i32.const 296))
  (global $MCIERR_BAD_INTEGER i32 (i32.const 270))

  ;; $mciavi_string results that are not MCI errors.
  (global $MCIAVI_NOT_MINE i32 (i32.const -1))
  (global $MCIAVI_PARKED i32 (i32.const -2))

  ;; Keywords, NUL-terminated, at +0x800 + 16 * n.
  (data (region.addr $MCIAVI_TABLE 0x800) "open\00")
  (data (region.addr $MCIAVI_TABLE 0x810) "type\00")
  (data (region.addr $MCIAVI_TABLE 0x820) "alias\00")
  (data (region.addr $MCIAVI_TABLE 0x830) "avivideo\00")
  (data (region.addr $MCIAVI_TABLE 0x840) "parent\00")
  (data (region.addr $MCIAVI_TABLE 0x850) "style\00")
  (data (region.addr $MCIAVI_TABLE 0x860) "wait\00")
  (data (region.addr $MCIAVI_TABLE 0x870) "notify\00")
  (data (region.addr $MCIAVI_TABLE 0x880) "window\00")
  (data (region.addr $MCIAVI_TABLE 0x890) "handle\00")
  (data (region.addr $MCIAVI_TABLE 0x8A0) "state\00")
  (data (region.addr $MCIAVI_TABLE 0x8B0) "put\00")
  (data (region.addr $MCIAVI_TABLE 0x8C0) "destination\00")
  (data (region.addr $MCIAVI_TABLE 0x8D0) "at\00")
  (data (region.addr $MCIAVI_TABLE 0x8E0) "seek\00")
  (data (region.addr $MCIAVI_TABLE 0x8F0) "to\00")
  (data (region.addr $MCIAVI_TABLE 0x900) "start\00")
  (data (region.addr $MCIAVI_TABLE 0x910) "end\00")
  (data (region.addr $MCIAVI_TABLE 0x920) "break\00")
  (data (region.addr $MCIAVI_TABLE 0x930) "on\00")
  (data (region.addr $MCIAVI_TABLE 0x940) "off\00")
  (data (region.addr $MCIAVI_TABLE 0x950) "play\00")
  (data (region.addr $MCIAVI_TABLE 0x960) "from\00")
  (data (region.addr $MCIAVI_TABLE 0x970) "stop\00")
  (data (region.addr $MCIAVI_TABLE 0x980) "pause\00")
  (data (region.addr $MCIAVI_TABLE 0x990) "resume\00")
  (data (region.addr $MCIAVI_TABLE 0x9A0) "close\00")
  (data (region.addr $MCIAVI_TABLE 0x9B0) "status\00")
  (data (region.addr $MCIAVI_TABLE 0x9C0) "length\00")
  (data (region.addr $MCIAVI_TABLE 0x9D0) "position\00")
  (data (region.addr $MCIAVI_TABLE 0x9E0) "mode\00")
  (data (region.addr $MCIAVI_TABLE 0x9F0) "set\00")
  (data (region.addr $MCIAVI_TABLE 0xA00) "time\00")
  (data (region.addr $MCIAVI_TABLE 0xA10) "format\00")
  (data (region.addr $MCIAVI_TABLE 0xA20) "frames\00")
  (data (region.addr $MCIAVI_TABLE 0xA30) "ms\00")
  (data (region.addr $MCIAVI_TABLE 0xA40) "milliseconds\00")
  (data (region.addr $MCIAVI_TABLE 0xA50) "show\00")
  (data (region.addr $MCIAVI_TABLE 0xA60) "hide\00")
  (data (region.addr $MCIAVI_TABLE 0xA70) "all\00")
  (data (region.addr $MCIAVI_TABLE 0xA80) "where\00")
  (data (region.addr $MCIAVI_TABLE 0xA90) "source\00")
  (data (region.addr $MCIAVI_TABLE 0xAA0) "ready\00")
  (data (region.addr $MCIAVI_TABLE 0xAB0) "stopped\00")
  (data (region.addr $MCIAVI_TABLE 0xAC0) "playing\00")
  (data (region.addr $MCIAVI_TABLE 0xAD0) "paused\00")
  (data (region.addr $MCIAVI_TABLE 0xAE0) "true\00")
  (data (region.addr $MCIAVI_TABLE 0xAF0) "realize\00")
  (data (region.addr $MCIAVI_TABLE 0xB00) "update\00")
  (data (region.addr $MCIAVI_TABLE 0xB10) "restore\00")
  (data (region.addr $MCIAVI_TABLE 0xB20) "minimize\00")
  (data (region.addr $MCIAVI_TABLE 0xB30) "maximize\00")
  (data (region.addr $MCIAVI_TABLE 0xB40) "child\00")
  (data (region.addr $MCIAVI_TABLE 0xB50) "popup\00")
  (data (region.addr $MCIAVI_TABLE 0xB60) "overlapped\00")
  (data (region.addr $MCIAVI_TABLE 0xB70) "cue\00")
  (data (region.addr $MCIAVI_TABLE 0xB80) "output\00")
  (data (region.addr $MCIAVI_TABLE 0xB90) "repeat\00")
  (data (region.addr $MCIAVI_TABLE 0xBA0) "fullscreen\00")
  (data (region.addr $MCIAVI_TABLE 0xBB0) "exactly\00")
  (data (region.addr $MCIAVI_TABLE 0xBC0) "false\00")

  (func $mciavi_kw (param $n i32) (result i32)
    (i32.add (region.addr $MCIAVI_TABLE 0x800) (i32.shl (local.get $n) (i32.const 4))))

  (func $mciavi_rec (param $slot i32) (result i32)
    (i32.add (region.addr $MCIAVI_TABLE 0) (i32.shl (local.get $slot) (i32.const 8))))

  ;; ---- tokens ---------------------------------------------------------
  ;; Split a command on blanks; "double quoted" tokens may hold blanks.
  (func $mciavi_tokenize (param $p i32)
    (local $c i32) (local $start i32) (local $n i32) (local $ent i32)
    (block $done (loop $tok
      (block $skip_done (loop $skip
        (local.set $c (i32.load8_u (local.get $p)))
        (br_if $skip_done (i32.eqz (i32.or (i32.eq (local.get $c) (i32.const 32))
          (i32.or (i32.eq (local.get $c) (i32.const 9))
            (i32.or (i32.eq (local.get $c) (i32.const 10)) (i32.eq (local.get $c) (i32.const 13)))))))
        (local.set $p (i32.add (local.get $p) (i32.const 1)))
        (br $skip)))
      (br_if $done (i32.eqz (local.get $c)))
      (br_if $done (i32.ge_u (local.get $n) (i32.const 32)))
      (local.set $ent (i32.add (region.addr $MCIAVI_TABLE 0x400) (i32.shl (local.get $n) (i32.const 3))))
      (if (i32.eq (local.get $c) (i32.const 34))
        (then
          (local.set $p (i32.add (local.get $p) (i32.const 1)))
          (local.set $start (local.get $p))
          (block $q_done (loop $q
            (local.set $c (i32.load8_u (local.get $p)))
            (br_if $q_done (i32.or (i32.eqz (local.get $c)) (i32.eq (local.get $c) (i32.const 34))))
            (local.set $p (i32.add (local.get $p) (i32.const 1)))
            (br $q)))
          (i32.store (local.get $ent) (local.get $start))
          (i32.store offset=4 (local.get $ent) (i32.sub (local.get $p) (local.get $start)))
          (if (local.get $c) (then (local.set $p (i32.add (local.get $p) (i32.const 1))))))
        (else
          (local.set $start (local.get $p))
          (block $w_done (loop $w
            (local.set $c (i32.load8_u (local.get $p)))
            (br_if $w_done (i32.or (i32.eqz (local.get $c))
              (i32.or (i32.eq (local.get $c) (i32.const 32))
                (i32.or (i32.eq (local.get $c) (i32.const 9))
                  (i32.or (i32.eq (local.get $c) (i32.const 10)) (i32.eq (local.get $c) (i32.const 13)))))))
            (local.set $p (i32.add (local.get $p) (i32.const 1)))
            (br $w)))
          (i32.store (local.get $ent) (local.get $start))
          (i32.store offset=4 (local.get $ent) (i32.sub (local.get $p) (local.get $start)))))
      (local.set $n (i32.add (local.get $n) (i32.const 1)))
      (br $tok)))
    (global.set $mciavi_ntok (local.get $n)))

  (func $mciavi_tok_wa (param $i i32) (result i32)
    (i32.load (i32.add (region.addr $MCIAVI_TABLE 0x400) (i32.shl (local.get $i) (i32.const 3)))))
  (func $mciavi_tok_len (param $i i32) (result i32)
    (if (i32.ge_u (local.get $i) (global.get $mciavi_ntok)) (then (return (i32.const 0))))
    (i32.load offset=4 (i32.add (region.addr $MCIAVI_TABLE 0x400) (i32.shl (local.get $i) (i32.const 3)))))

  (func $mciavi_lower (param $c i32) (result i32)
    (select (i32.or (local.get $c) (i32.const 0x20)) (local.get $c)
      (i32.lt_u (i32.sub (local.get $c) (i32.const 65)) (i32.const 26))))

  ;; Token $i equals the NUL-terminated keyword (or string) at $kw, ignoring case.
  (func $mciavi_tok_is (param $i i32) (param $kw i32) (result i32)
    (local $len i32) (local $p i32) (local $j i32)
    (if (i32.ge_u (local.get $i) (global.get $mciavi_ntok)) (then (return (i32.const 0))))
    (local.set $len (call $mciavi_tok_len (local.get $i)))
    (local.set $p (call $mciavi_tok_wa (local.get $i)))
    (block $done (loop $cmp
      (br_if $done (i32.ge_u (local.get $j) (local.get $len)))
      (if (i32.ne (call $mciavi_lower (i32.load8_u (i32.add (local.get $p) (local.get $j))))
                  (call $mciavi_lower (i32.load8_u (i32.add (local.get $kw) (local.get $j)))))
        (then (return (i32.const 0))))
      (local.set $j (i32.add (local.get $j) (i32.const 1)))
      (br $cmp)))
    (i32.eqz (i32.load8_u (i32.add (local.get $kw) (local.get $len)))))

  ;; Index of the first token at or after $from equal to keyword $n, or -1.
  (func $mciavi_find (param $from i32) (param $n i32) (result i32)
    (local $i i32)
    (local.set $i (local.get $from))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $mciavi_ntok)))
      (if (call $mciavi_tok_is (local.get $i) (call $mciavi_kw (local.get $n)))
        (then (return (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const -1))

  ;; Token $i as an unsigned decimal; -1 when it is not one.
  (func $mciavi_tok_int (param $i i32) (result i32)
    (local $len i32) (local $p i32) (local $j i32) (local $c i32) (local $v i32)
    (local.set $len (call $mciavi_tok_len (local.get $i)))
    (if (i32.eqz (local.get $len)) (then (return (i32.const -1))))
    (local.set $p (call $mciavi_tok_wa (local.get $i)))
    (block $done (loop $digits
      (br_if $done (i32.ge_u (local.get $j) (local.get $len)))
      (local.set $c (i32.sub (i32.load8_u (i32.add (local.get $p) (local.get $j))) (i32.const 48)))
      (if (i32.gt_u (local.get $c) (i32.const 9)) (then (return (i32.const -1))))
      (local.set $v (i32.add (i32.mul (local.get $v) (i32.const 10)) (local.get $c)))
      (local.set $j (i32.add (local.get $j) (i32.const 1)))
      (br $digits)))
    (local.get $v))

  ;; Token $i names a file with an .avi extension.
  (func $mciavi_tok_is_avi (param $i i32) (result i32)
    (local $len i32) (local $p i32)
    (local.set $len (call $mciavi_tok_len (local.get $i)))
    (if (i32.lt_u (local.get $len) (i32.const 4)) (then (return (i32.const 0))))
    (local.set $p (i32.add (call $mciavi_tok_wa (local.get $i)) (i32.sub (local.get $len) (i32.const 4))))
    (i32.and (i32.eq (i32.load8_u (local.get $p)) (i32.const 46))
      (i32.eq (i32.or (i32.or (i32.load8_u offset=1 (local.get $p))
                (i32.shl (i32.load8_u offset=2 (local.get $p)) (i32.const 8)))
                (i32.shl (i32.load8_u offset=3 (local.get $p)) (i32.const 16)))
              (i32.or (i32.const 0x697661) (i32.const 0x202020)))
      ))

  ;; The open device whose alias (or decimal device id) token $i names; 0.
  (func $mciavi_lookup (param $i i32) (result i32)
    (local $slot i32) (local $rec i32)
    (if (i32.ge_u (local.get $i) (global.get $mciavi_ntok)) (then (return (i32.const 0))))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $slot) (global.get $MCIAVI_SLOTS)))
      (local.set $rec (call $mciavi_rec (local.get $slot)))
      (if (i32.load (local.get $rec))
        (then
          (if (call $mciavi_tok_is (local.get $i) (i32.add (local.get $rec) (i32.const 0x80)))
            (then (return (local.get $rec))))
          (if (i32.eq (call $mciavi_tok_int (local.get $i)) (i32.load offset=4 (local.get $rec)))
            (then (return (local.get $rec))))))
      (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  ;; mciGetDeviceID: the id of the open device with this alias, or 0.
  (func $mciavi_device_id (param $name_wa i32) (result i32)
    (local $slot i32) (local $rec i32) (local $j i32) (local $c i32)
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $slot) (global.get $MCIAVI_SLOTS)))
      (local.set $rec (call $mciavi_rec (local.get $slot)))
      (if (i32.load (local.get $rec))
        (then
          (local.set $j (i32.const 0))
          (block $differ (loop $cmp
            (local.set $c (call $mciavi_lower (i32.load8_u (i32.add (local.get $name_wa) (local.get $j)))))
            (br_if $differ (i32.ne (local.get $c)
              (i32.load8_u (i32.add (i32.add (local.get $rec) (i32.const 0x80)) (local.get $j)))))
            (if (i32.eqz (local.get $c)) (then (return (i32.load offset=4 (local.get $rec)))))
            (local.set $j (i32.add (local.get $j) (i32.const 1)))
            (br_if $differ (i32.ge_u (local.get $j) (i32.const 64)))
            (br $cmp)))))
      (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  ;; ---- return strings -------------------------------------------------
  (func $mciavi_ret_str (param $ret_wa i32) (param $cap i32) (param $s i32)
    (local $i i32) (local $c i32)
    (if (i32.or (i32.eqz (local.get $ret_wa)) (i32.eqz (local.get $cap))) (then (return)))
    (block $done (loop $copy
      (br_if $done (i32.ge_u (i32.add (local.get $i) (i32.const 1)) (local.get $cap)))
      (local.set $c (i32.load8_u (i32.add (local.get $s) (local.get $i))))
      (br_if $done (i32.eqz (local.get $c)))
      (i32.store8 (i32.add (local.get $ret_wa) (local.get $i)) (local.get $c))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $copy)))
    (i32.store8 (i32.add (local.get $ret_wa) (local.get $i)) (i32.const 0)))

  ;; Append the decimal $v at $p; the byte after it.
  (func $mciavi_put_dec (param $p i32) (param $v i32) (result i32)
    (local $tmp i32) (local $n i32)
    (local.set $tmp (i32.add (region.addr $MCIAVI_TABLE 0x5F0) (i32.const 0)))
    (loop $digits
      (i32.store8 (i32.add (local.get $tmp) (local.get $n))
        (i32.add (i32.const 48) (i32.rem_u (local.get $v) (i32.const 10))))
      (local.set $n (i32.add (local.get $n) (i32.const 1)))
      (local.set $v (i32.div_u (local.get $v) (i32.const 10)))
      (br_if $digits (i32.ne (local.get $v) (i32.const 0))))
    (block $done (loop $rev
      (br_if $done (i32.eqz (local.get $n)))
      (local.set $n (i32.sub (local.get $n) (i32.const 1)))
      (i32.store8 (local.get $p) (i32.load8_u (i32.add (local.get $tmp) (local.get $n))))
      (local.set $p (i32.add (local.get $p) (i32.const 1)))
      (br $rev)))
    (i32.store8 (local.get $p) (i32.const 0))
    (local.get $p))

  (func $mciavi_ret_dec (param $ret_wa i32) (param $cap i32) (param $v i32)
    (drop (call $mciavi_put_dec (region.addr $MCIAVI_TABLE 0x500) (local.get $v)))
    (call $mciavi_ret_str (local.get $ret_wa) (local.get $cap) (region.addr $MCIAVI_TABLE 0x500)))

  ;; ---- time -----------------------------------------------------------
  ;; A position in the device's time format → a frame, clamped to the movie.
  (func $mciavi_to_frame (param $rec i32) (param $v i32) (result i32)
    (local $f i32)
    (local.set $f (local.get $v))
    (if (i32.eqz (i32.load offset=0x74 (local.get $rec)))
      (then (local.set $f (i32.wrap_i64 (i64.div_u
        (i64.mul (i64.extend_i32_u (local.get $v)) (i64.const 1000))
        (i64.extend_i32_u (i32.load offset=0x44 (local.get $rec))))))))
    (if (i32.gt_u (local.get $f) (i32.load offset=0x40 (local.get $rec)))
      (then (local.set $f (i32.load offset=0x40 (local.get $rec)))))
    (local.get $f))

  (func $mciavi_from_frame (param $rec i32) (param $f i32) (result i32)
    (if (i32.eqz (i32.load offset=0x74 (local.get $rec)))
      (then (return (i32.wrap_i64 (i64.div_u
        (i64.mul (i64.extend_i32_u (local.get $f)) (i64.extend_i32_u (i32.load offset=0x44 (local.get $rec))))
        (i64.const 1000))))))
    (local.get $f))

  ;; ---- open / close ---------------------------------------------------
  ;; A NUL-terminated guest copy of token $i (heap), or 0.
  (func $mciavi_tok_guest (param $i i32) (result i32)
    (local $len i32) (local $g i32) (local $j i32) (local $p i32)
    (local.set $len (call $mciavi_tok_len (local.get $i)))
    (local.set $g (call $heap_alloc (i32.add (local.get $len) (i32.const 1))))
    (if (i32.eqz (local.get $g)) (then (return (i32.const 0))))
    (local.set $p (call $mciavi_tok_wa (local.get $i)))
    (block $done (loop $copy
      (br_if $done (i32.ge_u (local.get $j) (local.get $len)))
      (call $gs8 (i32.add (local.get $g) (local.get $j)) (i32.load8_u (i32.add (local.get $p) (local.get $j))))
      (local.set $j (i32.add (local.get $j) (i32.const 1)))
      (br $copy)))
    (call $gs8 (i32.add (local.get $g) (local.get $len)) (i32.const 0))
    (local.get $g))

  (func $mciavi_free_buffers (param $rec i32)
    (if (i32.load offset=0x14 (local.get $rec))
      (then (drop (call $mciavi_icm_close (i32.load offset=0x14 (local.get $rec))))))
    (if (i32.load offset=0x18 (local.get $rec))
      (then (call $dib_free_wasm (call $avi_dib_wa (i32.load offset=0x18 (local.get $rec))))))
    (if (i32.load offset=0x1C (local.get $rec))
      (then (call $dib_free_wasm (call $avi_dib_wa (i32.load offset=0x1C (local.get $rec))))))
    (if (i32.load offset=0x24 (local.get $rec))
      (then (call $dib_free_wasm (call $avi_dib_wa (i32.load offset=0x24 (local.get $rec))))))
    (if (i32.load offset=0x78 (local.get $rec))
      (then (call $dib_free_wasm (call $avi_dib_wa (i32.load offset=0x78 (local.get $rec))))))
    (if (i32.load offset=0x60 (local.get $rec))
      (then (drop (call $host_wave_out_reset (i32.load offset=0x60 (local.get $rec))))
            (drop (call $host_wave_out_close (i32.load offset=0x60 (local.get $rec))))))
    (if (i32.load offset=0x08 (local.get $rec))
      (then (drop (call $avi_file_release (i32.load offset=0x08 (local.get $rec)))))))

  (func $mciavi_icm_close (param $hic i32) (result i32)
    (local $r i32)
    (local.set $r (call $icm_rec_of (local.get $hic)))
    (if (i32.eqz (local.get $r)) (then (return (i32.const 0))))
    (call $icm_close_rec (local.get $r))
    (i32.const 1))

  ;; DECOMPRESS_BEGIN into the 32-bit output DIB. An installed codec may
  ;; not write 32 bpp (Indeo writes 24 and 16), so the output header steps
  ;; down until one is accepted; the painter reads whatever the header says.
  ;; 1 on success.
  (func $mciavi_codec_begin (param $rec i32) (result i32)
    (local $hrec i32) (local $k i32) (local $bpp i32) (local $w i32) (local $h i32)
    (local.set $hrec (call $icm_rec_of (i32.load offset=0x14 (local.get $rec))))
    (if (i32.eqz (local.get $hrec)) (then (return (i32.const 0))))
    (local.set $k (call $avi_dib_wa (i32.load offset=0x24 (local.get $rec))))
    (local.set $w (i32.load offset=4 (local.get $k)))
    (local.set $h (i32.load offset=8 (local.get $k)))
    (local.set $bpp (i32.const 32))
    (block $done (loop $try
      (i32.store16 offset=14 (local.get $k) (local.get $bpp))
      (i32.store offset=20 (local.get $k) (i32.mul (local.get $h) (i32.shr_u
        (i32.and (i32.add (i32.mul (local.get $w) (local.get $bpp)) (i32.const 31)) (i32.const -32))
        (i32.const 3))))
      (if (i32.eqz (call $icm_begin (local.get $hrec) (i32.load offset=0x18 (local.get $rec))
            (i32.load offset=0x24 (local.get $rec))))
        (then (return (i32.const 1))))
      (br_if $done (i32.ne (i32.load offset=4 (local.get $hrec)) (global.get $ICM_CODEC_GUEST)))
      (local.set $bpp (i32.sub (local.get $bpp) (i32.const 8)))
      (br_if $done (i32.lt_u (local.get $bpp) (i32.const 16)))
      (br $try)))
    (i32.const 0))

  (func $mciavi_close (param $rec i32)
    (if (i32.eq (i32.load offset=0x48 (local.get $rec)) (i32.const 1))
      (then (global.set $mciavi_active (i32.sub (global.get $mciavi_active) (i32.const 1)))))
    (call $mciavi_free_buffers (local.get $rec))
    (call $zero_memory (local.get $rec) (i32.const 0x100)))

  ;; "open <file> [type avivideo] [alias A] [parent H] [style S]". The
  ;; element token is $el; returns an MCI error or $MCIAVI_PARKED.
  (func $mciavi_open (param $el i32) (param $ret_wa i32) (param $cap i32) (result i32)
    (local $slot i32) (local $rec i32) (local $path i32) (local $frec i32)
    (local $ws i32) (local $i i32) (local $sb i32) (local $vsb i32) (local $asb i32)
    (local $fmtlen i32) (local $bi i32) (local $w i32) (local $h i32) (local $codec i32)
    (local $hic i32) (local $hrec i32) (local $out i32) (local $k i32) (local $alias_tok i32)
    (local $len i32) (local $scale i32) (local $rate i32) (local $wfx i32)
    (local.set $alias_tok (call $mciavi_find (i32.const 0) (i32.const 2)))
    (if (i32.ge_s (local.get $alias_tok) (i32.const 0))
      (then
        (local.set $alias_tok (i32.add (local.get $alias_tok) (i32.const 1)))
        (if (i32.eqz (call $mciavi_tok_len (local.get $alias_tok)))
          (then (return (global.get $MCIERR_MISSING_PARAMETER))))
        (if (call $mciavi_lookup (local.get $alias_tok))
          (then (return (global.get $MCIERR_DUPLICATE_ALIAS)))))
      (else (local.set $alias_tok (local.get $el))))
    (if (i32.gt_u (call $mciavi_tok_len (local.get $alias_tok)) (i32.const 63))
      (then (return (global.get $MCIERR_UNRECOGNIZED_KEYWORD))))
    (block $found (loop $scan
      (if (i32.ge_u (local.get $slot) (global.get $MCIAVI_SLOTS))
        (then (return (global.get $MCIERR_OUT_OF_MEMORY))))
      (local.set $rec (call $mciavi_rec (local.get $slot)))
      (br_if $found (i32.eqz (i32.load (local.get $rec))))
      (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
      (br $scan)))
    (local.set $path (call $mciavi_tok_guest (local.get $el)))
    (if (i32.eqz (local.get $path)) (then (return (global.get $MCIERR_OUT_OF_MEMORY))))
    (local.set $frec (call $avi_open (local.get $path)))
    (call $heap_free (local.get $path))
    (if (i32.eqz (local.get $frec))
      (then
        (if (i32.eq (global.get $avi_open_status) (global.get $AVI_PENDING))
          (then (return (global.get $MCIAVI_PARKED))))
        (if (i32.eq (global.get $avi_open_status) (global.get $AVIERR_FILEOPEN))
          (then (return (global.get $MCIERR_FILE_NOT_FOUND))))
        (return (global.get $MCIERR_INVALID_FILE))))
    (call $zero_memory (local.get $rec) (i32.const 0x100))
    (i32.store offset=0x08 (local.get $rec) (local.get $frec))
    ;; First video and first PCM audio stream.
    (local.set $ws (i32.load offset=12 (local.get $frec)))
    (block $s_done (loop $streams
      (br_if $s_done (i32.ge_u (local.get $i) (i32.load offset=8 (local.get $frec))))
      (local.set $sb (call $avi_sblock (local.get $ws) (local.get $i)))
      (if (i32.and (i32.eqz (local.get $vsb)) (i32.eq (i32.load (local.get $sb)) (i32.const 0x73646976)))  ;; vids
        (then (local.set $vsb (local.get $sb))))
      (if (i32.and (i32.eqz (local.get $asb)) (i32.eq (i32.load (local.get $sb)) (i32.const 0x73647561)))  ;; auds
        (then
          (if (i32.and (i32.ge_u (i32.load offset=0x40 (local.get $sb)) (i32.const 16))
                       (i32.eq (i32.load16_u offset=0x80 (local.get $sb)) (i32.const 1)))   ;; WAVE_FORMAT_PCM
            (then (local.set $asb (local.get $sb))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $streams)))
    (block $fail
      (br_if $fail (i32.eqz (local.get $vsb)))
      (local.set $fmtlen (i32.load offset=0x40 (local.get $vsb)))
      (br_if $fail (i32.lt_u (local.get $fmtlen) (i32.const 40)))
      ;; A private copy of the format: biSizeImage is rewritten per chunk.
      (local.set $bi (call $dib_alloc (i32.add (local.get $fmtlen) (i32.const 16))))
      (br_if $fail (i32.eqz (local.get $bi)))
      (i32.store offset=0x18 (local.get $rec) (local.get $bi))
      (memory.copy (call $avi_dib_wa (local.get $bi)) (i32.add (local.get $vsb) (i32.const 0x80)) (local.get $fmtlen))
      (local.set $w (i32.load offset=0x84 (local.get $vsb)))
      (local.set $h (call $tt_abs (i32.load offset=0x88 (local.get $vsb))))
      (local.set $codec (call $icm_codec_for_format (local.get $bi)))
      (if (local.get $codec)
        (then
          (local.set $hic (call $icm_open_codec (local.get $codec) (i32.load offset=4 (local.get $vsb)) (i32.const 3)))
          (br_if $fail (i32.eqz (local.get $hic))))
        (else
          ;; No built-in decoder: an installed driver (09a7g). One whose DLL
          ;; is not mapped yet is asked for now and opened at the first frame.
          (local.set $hic (call $icm_locate_guest (i32.load offset=4 (local.get $vsb))
            (local.get $bi) (i32.const 0) (i32.const 3)))
          (if (i32.eq (local.get $hic) (global.get $ICM_PARK))
            (then (call $icm_request_load) (local.set $hic (i32.const 0))
                  (i32.store offset=0xD4 (local.get $rec) (i32.const 1)))
            (else (br_if $fail (i32.eqz (local.get $hic)))))))
      (i32.store offset=0x14 (local.get $rec) (local.get $hic))
      ;; Output: a bottom-up 32-bit BI_RGB DIB, header then bits.
      (local.set $out (call $dib_alloc (i32.add (i32.const 64)
        (i32.shl (i32.mul (local.get $w) (local.get $h)) (i32.const 2)))))
      (br_if $fail (i32.eqz (local.get $out)))
      (i32.store offset=0x24 (local.get $rec) (local.get $out))
      (local.set $k (call $avi_dib_wa (local.get $out)))
      (i32.store (local.get $k) (i32.const 40))
      (i32.store offset=4 (local.get $k) (local.get $w))
      (i32.store offset=8 (local.get $k) (local.get $h))
      (i32.store16 offset=12 (local.get $k) (i32.const 1))
      (i32.store16 offset=14 (local.get $k) (i32.const 32))
      (i32.store offset=20 (local.get $k) (i32.shl (i32.mul (local.get $w) (local.get $h)) (i32.const 2)))
      (if (local.get $hic)
        (then (br_if $fail (i32.eqz (call $mciavi_codec_begin (local.get $rec))))))
      ;; One chunk buffer as large as the largest chunk.
      (local.set $len (i32.add (i32.load offset=0x60 (local.get $vsb)) (i32.const 16)))
      (i32.store offset=0x1C (local.get $rec) (call $dib_alloc (local.get $len)))
      (br_if $fail (i32.eqz (i32.load offset=0x1C (local.get $rec))))
      (i32.store offset=0x20 (local.get $rec) (local.get $len))
      (i32.store offset=0x0C (local.get $rec) (local.get $vsb))
      (i32.store offset=0x40 (local.get $rec) (i32.load offset=0x48 (local.get $vsb)))
      (local.set $scale (i32.load offset=20 (local.get $vsb)))
      (local.set $rate (i32.load offset=24 (local.get $vsb)))
      (if (i32.or (i32.eqz (local.get $scale)) (i32.eqz (local.get $rate)))
        (then (local.set $scale (i32.const 1)) (local.set $rate (i32.const 15))))
      (i32.store offset=0x44 (local.get $rec) (i32.wrap_i64 (i64.div_u
        (i64.mul (i64.extend_i32_u (local.get $scale)) (i64.const 1000000))
        (i64.extend_i32_u (local.get $rate)))))
      (if (i32.eqz (i32.load offset=0x44 (local.get $rec)))
        (then (i32.store offset=0x44 (local.get $rec) (i32.const 1))))
      (if (local.get $asb)
        (then
          (local.set $wfx (i32.add (local.get $asb) (i32.const 0x80)))
          (i32.store offset=0x10 (local.get $rec) (local.get $asb))
          (i32.store offset=0x6C (local.get $rec) (i32.load offset=8 (local.get $wfx)))))
      (i32.store offset=0xCC (local.get $rec) (local.get $w))
      (i32.store offset=0xD0 (local.get $rec) (local.get $h))
      (i32.store offset=0x04 (local.get $rec) (i32.add (global.get $MCIAVI_ID_BASE) (local.get $slot)))
      (local.set $k (call $mciavi_find (i32.const 0) (i32.const 4)))    ;; parent
      (if (i32.ge_s (local.get $k) (i32.const 0))
        (then
          (i32.store offset=0xC8 (local.get $rec) (call $mciavi_tok_int (i32.add (local.get $k) (i32.const 1))))
          (i32.store offset=0x28 (local.get $rec) (i32.load offset=0xC8 (local.get $rec)))))
      ;; Alias, lower case.
      (local.set $len (call $mciavi_tok_len (local.get $alias_tok)))
      (local.set $i (i32.const 0))
      (block $a_done (loop $alias
        (br_if $a_done (i32.ge_u (local.get $i) (local.get $len)))
        (i32.store8 (i32.add (i32.add (local.get $rec) (i32.const 0x80)) (local.get $i))
          (call $mciavi_lower (i32.load8_u (i32.add (call $mciavi_tok_wa (local.get $alias_tok)) (local.get $i)))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $alias)))
      (i32.store (local.get $rec) (i32.const 1))
      (call $mciavi_ret_dec (local.get $ret_wa) (local.get $cap) (i32.load offset=4 (local.get $rec)))
      (return (i32.const 0)))
    (call $mciavi_free_buffers (local.get $rec))
    (call $zero_memory (local.get $rec) (i32.const 0x100))
    (global.get $MCIERR_INVALID_FILE))

  ;; ---- frames ---------------------------------------------------------
  (func $mciavi_paint (param $rec i32)
    (local $hdc i32) (local $hwnd i32) (local $out i32) (local $dw i32) (local $dh i32)
    (local.set $hwnd (i32.load offset=0x28 (local.get $rec)))
    (if (i32.or (i32.eqz (local.get $hwnd)) (i32.ne (i32.load offset=0xC4 (local.get $rec)) (i32.const 0)))
      (then (return)))
    (if (i32.lt_s (call $wnd_table_find (local.get $hwnd)) (i32.const 0)) (then (return)))
    (local.set $out (call $avi_dib_wa (i32.load offset=0x24 (local.get $rec))))
    (local.set $dw (i32.load offset=0x34 (local.get $rec)))
    (local.set $dh (i32.load offset=0x38 (local.get $rec)))
    (if (i32.eqz (local.get $dw)) (then (local.set $dw (i32.load offset=0xCC (local.get $rec)))))
    (if (i32.eqz (local.get $dh)) (then (local.set $dh (i32.load offset=0xD0 (local.get $rec)))))
    (local.set $hdc (call $host_alloc_window_dc (local.get $hwnd) (i32.const 0)))
    (if (i32.eqz (local.get $hdc)) (then (return)))
    (call $dc_apply_client_clip (local.get $hdc) (local.get $hwnd))
    (drop (call $gdi_native_stretch_dib_bits (local.get $hdc)
      (i32.load offset=0x2C (local.get $rec)) (i32.load offset=0x30 (local.get $rec))
      (local.get $dw) (local.get $dh)
      (i32.const 0) (i32.const 0)
      (i32.load offset=0xCC (local.get $rec)) (i32.load offset=0xD0 (local.get $rec))
      (i32.add (local.get $out) (i32.const 64)) (local.get $out)
      (i32.const 0) (i32.const 0x00CC0020)))
    (drop (call $host_release_dc (local.get $hdc)))
    (i32.store offset=0xC0 (local.get $rec) (i32.sub (i32.load offset=0x3C (local.get $rec)) (i32.const 1))))

  ;; Decode frame $f (the next one in order). 1 done, 0 not resident yet.
  (func $mciavi_decode (param $rec i32) (param $f i32) (param $show i32) (result i32)
    (local $vsb i32) (local $ent i32) (local $size i32) (local $r i32) (local $data i32) (local $hic i32)
    (local.set $vsb (i32.load offset=0x0C (local.get $rec)))
    (local.set $ent (i32.add (i32.load offset=0x44 (local.get $vsb)) (i32.shl (local.get $f) (i32.const 4))))
    (local.set $size (i32.load offset=4 (local.get $ent)))
    (if (i32.gt_u (local.get $size) (i32.sub (i32.load offset=0x20 (local.get $rec)) (i32.const 16)))
      (then (local.set $size (i32.const 0))))
    (if (local.get $size)
      (then
        (local.set $data (i32.load offset=0x1C (local.get $rec)))
        (local.set $r (call $avi_read
          (i32.load offset=4 (i32.load offset=0x08 (local.get $rec)))
          (i32.load (local.get $ent)) (local.get $data) (local.get $size)))
        (if (i32.eq (local.get $r) (global.get $AVI_PENDING)) (then (return (i32.const 0))))
        (if (i32.lt_s (local.get $r) (i32.const 0)) (then (local.set $size (i32.const 0)) (local.set $data (i32.const 0))))))
    ;; biSizeImage of the private format copy is this chunk's length.
    (i32.store offset=20 (call $avi_dib_wa (i32.load offset=0x18 (local.get $rec))) (local.get $size))
    ;; An installed codec whose DLL was still loading at open.
    (if (i32.and (i32.eqz (i32.load offset=0x14 (local.get $rec)))
                 (i32.ne (i32.load offset=0xD4 (local.get $rec)) (i32.const 0)))
      (then
        (local.set $hic (call $icm_locate_guest (i32.load offset=4 (local.get $vsb))
          (i32.load offset=0x18 (local.get $rec)) (i32.const 0) (i32.const 3)))
        (if (i32.eq (local.get $hic) (global.get $ICM_PARK))
          (then (call $icm_request_load) (return (i32.const 0))))
        (i32.store offset=0xD4 (local.get $rec) (i32.const 0))
        (i32.store offset=0x14 (local.get $rec) (local.get $hic))
        (if (local.get $hic)
          (then
            (if (i32.eqz (call $mciavi_codec_begin (local.get $rec)))
              (then
                (drop (call $mciavi_icm_close (local.get $hic)))
                (i32.store offset=0x14 (local.get $rec) (i32.const 0))))))))
    ;; No decoder at all: the frame counts, the picture stays as it was.
    (if (i32.load offset=0x14 (local.get $rec))
      (then
    (drop (call $icm_decompress (call $icm_rec_of (i32.load offset=0x14 (local.get $rec)))
      (select (i32.const 0) (i32.const 0x80000000) (local.get $show))
      (i32.load offset=0x18 (local.get $rec))
      (select (local.get $data) (i32.const 0) (i32.ne (local.get $size) (i32.const 0)))
      (i32.load offset=0x24 (local.get $rec))
      (i32.add (i32.load offset=0x24 (local.get $rec)) (i32.const 64))))))
    (i32.store offset=0x3C (local.get $rec) (i32.add (local.get $f) (i32.const 1)))
    (i32.const 1))

  ;; Bring the picture to frame $target - 1: from the last key frame at or
  ;; before it when that is past what is decoded, painting only the last.
  (func $mciavi_advance (param $rec i32) (param $target i32)
    (local $pos i32) (local $f i32) (local $ent i32) (local $tbl i32)
    (local.set $pos (i32.load offset=0x3C (local.get $rec)))
    (if (i32.le_u (local.get $target) (local.get $pos)) (then (return)))
    (local.set $tbl (i32.load offset=0x44 (i32.load offset=0x0C (local.get $rec))))
    (local.set $f (i32.sub (local.get $target) (i32.const 1)))
    (block $k_done (loop $key
      (br_if $k_done (i32.le_u (local.get $f) (local.get $pos)))
      (local.set $ent (i32.add (local.get $tbl) (i32.shl (local.get $f) (i32.const 4))))
      (br_if $k_done (i32.and (i32.load offset=8 (local.get $ent)) (i32.const 0x10)))
      (local.set $f (i32.sub (local.get $f) (i32.const 1)))
      (br $key)))
    (if (i32.gt_u (local.get $f) (local.get $pos))
      (then (i32.store offset=0x3C (local.get $rec) (local.get $f)) (local.set $pos (local.get $f))))
    (block $done (loop $frames
      (br_if $done (i32.ge_u (local.get $pos) (local.get $target)))
      (br_if $done (i32.eqz (call $mciavi_decode (local.get $rec) (local.get $pos)
        (i32.eq (i32.add (local.get $pos) (i32.const 1)) (local.get $target)))))
      (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
      (br $frames)))
    (if (i32.gt_u (i32.load offset=0x3C (local.get $rec)) (i32.const 0))
      (then (call $mciavi_paint (local.get $rec)))))

  ;; ---- audio ----------------------------------------------------------
  (func $mciavi_audio_start (param $rec i32)
    (local $asb i32) (local $wfx i32) (local $byte i32) (local $i i32) (local $n i32) (local $tbl i32)
    (local.set $asb (i32.load offset=0x10 (local.get $rec)))
    (if (i32.eqz (local.get $asb)) (then (return)))
    (local.set $wfx (i32.add (local.get $asb) (i32.const 0x80)))
    (if (i32.eqz (i32.load offset=0x60 (local.get $rec)))
      (then (i32.store offset=0x60 (local.get $rec) (call $host_wave_out_open
        (i32.load offset=4 (local.get $wfx)) (i32.load16_u offset=2 (local.get $wfx))
        (i32.load16_u offset=14 (local.get $wfx)) (i32.const 0) (i32.const 0) (i32.const 0)))))
    ;; The audio chunk that holds the start frame's time.
    (local.set $byte (i32.wrap_i64 (i64.div_u
      (i64.mul (i64.mul (i64.extend_i32_u (i32.load offset=0x50 (local.get $rec)))
                        (i64.extend_i32_u (i32.load offset=0x44 (local.get $rec))))
               (i64.extend_i32_u (i32.load offset=0x6C (local.get $rec))))
      (i64.const 1000000))))
    (local.set $tbl (i32.load offset=0x44 (local.get $asb)))
    (local.set $n (i32.load offset=0x48 (local.get $asb)))
    (block $done (loop $find
      (br_if $done (i32.ge_u (i32.add (local.get $i) (i32.const 1)) (local.get $n)))
      (br_if $done (i32.gt_u (i32.load offset=12 (i32.add (local.get $tbl)
        (i32.shl (i32.add (local.get $i) (i32.const 1)) (i32.const 4)))) (local.get $byte)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $find)))
    (i32.store offset=0x64 (local.get $rec) (local.get $i))
    (i32.store offset=0x68 (local.get $rec)
      (select (i32.load offset=12 (i32.add (local.get $tbl) (i32.shl (local.get $i) (i32.const 4)))) (i32.const 0)
        (i32.lt_u (local.get $i) (local.get $n)))))

  (func $mciavi_audio_stop (param $rec i32)
    (if (i32.load offset=0x60 (local.get $rec))
      (then (drop (call $host_wave_out_reset (i32.load offset=0x60 (local.get $rec)))))))

  ;; Queue audio chunks until they reach half a second past $now_ms of movie time.
  (func $mciavi_audio_feed (param $rec i32) (param $movie_ms i32)
    (local $asb i32) (local $tbl i32) (local $i i32) (local $ent i32) (local $size i32)
    (local $want i32) (local $buf i32) (local $r i32)
    (local.set $asb (i32.load offset=0x10 (local.get $rec)))
    (if (i32.or (i32.eqz (local.get $asb)) (i32.eqz (i32.load offset=0x60 (local.get $rec)))) (then (return)))
    (local.set $want (i32.wrap_i64 (i64.div_u
      (i64.mul (i64.extend_i32_u (i32.add (local.get $movie_ms) (i32.const 500)))
               (i64.extend_i32_u (i32.load offset=0x6C (local.get $rec))))
      (i64.const 1000))))
    (local.set $tbl (i32.load offset=0x44 (local.get $asb)))
    (block $done (loop $feed
      (local.set $i (i32.load offset=0x64 (local.get $rec)))
      (br_if $done (i32.ge_u (local.get $i) (i32.load offset=0x48 (local.get $asb))))
      (br_if $done (i32.ge_u (i32.load offset=0x68 (local.get $rec)) (local.get $want)))
      (local.set $ent (i32.add (local.get $tbl) (i32.shl (local.get $i) (i32.const 4))))
      (local.set $size (i32.load offset=4 (local.get $ent)))
      (if (i32.gt_u (local.get $size) (i32.load offset=0x7C (local.get $rec)))
        (then
          (if (i32.load offset=0x78 (local.get $rec))
            (then (call $dib_free_wasm (call $avi_dib_wa (i32.load offset=0x78 (local.get $rec))))))
          (i32.store offset=0x78 (local.get $rec) (call $dib_alloc (local.get $size)))
          (i32.store offset=0x7C (local.get $rec)
            (select (local.get $size) (i32.const 0) (i32.ne (i32.load offset=0x78 (local.get $rec)) (i32.const 0))))
          (br_if $done (i32.eqz (i32.load offset=0x78 (local.get $rec))))))
      (local.set $buf (i32.load offset=0x78 (local.get $rec)))
      (if (local.get $size)
        (then
          (local.set $r (call $avi_read (i32.load offset=4 (i32.load offset=0x08 (local.get $rec)))
            (i32.load (local.get $ent)) (local.get $buf) (local.get $size)))
          (br_if $done (i32.eq (local.get $r) (global.get $AVI_PENDING)))
          (if (i32.gt_s (local.get $r) (i32.const 0))
            (then (drop (call $host_wave_out_write (i32.load offset=0x60 (local.get $rec))
              (call $avi_dib_wa (local.get $buf)) (local.get $r)))))))
      (i32.store offset=0x68 (local.get $rec) (i32.add (i32.load offset=0x68 (local.get $rec)) (local.get $size)))
      (i32.store offset=0x64 (local.get $rec) (i32.add (local.get $i) (i32.const 1)))
      (br $feed))))

  ;; ---- play -----------------------------------------------------------
  (func $mciavi_set_mode (param $rec i32) (param $mode i32)
    (local $was i32)
    (local.set $was (i32.eq (i32.load offset=0x48 (local.get $rec)) (i32.const 1)))
    (if (i32.and (local.get $was) (i32.ne (local.get $mode) (i32.const 1)))
      (then (global.set $mciavi_active (i32.sub (global.get $mciavi_active) (i32.const 1)))))
    (if (i32.and (i32.eqz (local.get $was)) (i32.eq (local.get $mode) (i32.const 1)))
      (then (global.set $mciavi_active (i32.add (global.get $mciavi_active) (i32.const 1)))))
    (i32.store offset=0x48 (local.get $rec) (local.get $mode)))

  (func $mciavi_start (param $rec i32) (param $from i32) (param $to i32)
    (if (i32.ne (local.get $from) (i32.load offset=0x3C (local.get $rec)))
      (then (i32.store offset=0x3C (local.get $rec) (local.get $from))))
    (i32.store offset=0x50 (local.get $rec) (local.get $from))
    (i32.store offset=0x54 (local.get $rec) (local.get $to))
    (i32.store offset=0x4C (local.get $rec) (call $host_get_ticks))
    (call $mciavi_set_mode (local.get $rec) (i32.const 1))
    (call $mciavi_audio_start (local.get $rec)))

  (func $mciavi_notify (param $rec i32) (param $code i32)
    (if (i32.load offset=0x70 (local.get $rec))
      (then
        (drop (call $post_queue_push (i32.load offset=0x70 (local.get $rec)) (i32.const 0x3B9)   ;; MM_MCINOTIFY
          (local.get $code) (i32.load offset=4 (local.get $rec))))
        (i32.store offset=0x70 (local.get $rec) (i32.const 0)))))

  ;; One step of a playing device. 1 while it is still playing.
  (func $mciavi_step (param $rec i32) (result i32)
    (local $elapsed i32) (local $target i32) (local $ms i32)
    (if (i32.ne (i32.load offset=0x48 (local.get $rec)) (i32.const 1)) (then (return (i32.const 0))))
    (local.set $elapsed (i32.sub (call $host_get_ticks) (i32.load offset=0x4C (local.get $rec))))
    (local.set $target (i32.add (i32.load offset=0x50 (local.get $rec))
      (i32.add (i32.const 1) (i32.wrap_i64 (i64.div_u
        (i64.mul (i64.extend_i32_u (local.get $elapsed)) (i64.const 1000))
        (i64.extend_i32_u (i32.load offset=0x44 (local.get $rec))))))))
    (if (i32.gt_u (local.get $target) (i32.load offset=0x54 (local.get $rec)))
      (then (local.set $target (i32.load offset=0x54 (local.get $rec)))))
    (local.set $ms (i32.wrap_i64 (i64.div_u
      (i64.mul (i64.extend_i32_u (i32.load offset=0x50 (local.get $rec)))
               (i64.extend_i32_u (i32.load offset=0x44 (local.get $rec))))
      (i64.const 1000))))
    (call $mciavi_audio_feed (local.get $rec) (i32.add (local.get $ms) (local.get $elapsed)))
    (call $mciavi_advance (local.get $rec) (local.get $target))
    ;; "break A on vk": the key ends a play, as it does on Windows.
    (if (i32.load offset=0x5C (local.get $rec))
      (then
        (if (i32.and (call $host_get_async_key_state (i32.load offset=0x5C (local.get $rec))) (i32.const 0x8000))
          (then
            (call $mciavi_audio_stop (local.get $rec))
            (call $mciavi_set_mode (local.get $rec) (i32.const 0))
            (call $mciavi_notify (local.get $rec) (i32.const 4))   ;; MCI_NOTIFY_ABORTED
            (return (i32.const 0))))))
    (if (i32.ge_u (i32.load offset=0x3C (local.get $rec)) (i32.load offset=0x54 (local.get $rec)))
      (then
        (call $mciavi_set_mode (local.get $rec) (i32.const 0))
        (call $mciavi_notify (local.get $rec) (i32.const 1))   ;; MCI_NOTIFY_SUCCESSFUL
        (return (i32.const 0))))
    (i32.const 1))

  ;; Advance every playing device; called from the message pump.
  (func $mciavi_tick_all
    (local $slot i32) (local $rec i32)
    (if (i32.eqz (global.get $mciavi_active)) (then (return)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $slot) (global.get $MCIAVI_SLOTS)))
      (local.set $rec (call $mciavi_rec (local.get $slot)))
      (if (i32.and (i32.ne (i32.load (local.get $rec)) (i32.const 0))
                   (i32.eqz (i32.load offset=0x58 (local.get $rec))))
        (then (drop (call $mciavi_step (local.get $rec)))))
      (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
      (br $scan))))

  ;; Milliseconds until a playing device wants its next frame, folded into
  ;; $best the way next_timer_due_ms folds timers (-1 = nothing due).
  (func $mciavi_due_ms (param $best i32) (result i32)
    (local $slot i32) (local $rec i32) (local $next_at i32) (local $remain i32)
    (if (i32.eqz (global.get $mciavi_active)) (then (return (local.get $best))))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $slot) (global.get $MCIAVI_SLOTS)))
      (local.set $rec (call $mciavi_rec (local.get $slot)))
      (if (i32.and (i32.ne (i32.load (local.get $rec)) (i32.const 0))
                   (i32.eq (i32.load offset=0x48 (local.get $rec)) (i32.const 1)))
        (then
          (local.set $next_at (i32.add (i32.load offset=0x4C (local.get $rec))
            (i32.wrap_i64 (i64.div_u
              (i64.mul (i64.extend_i32_u (i32.sub (i32.load offset=0x3C (local.get $rec))
                                                  (i32.load offset=0x50 (local.get $rec))))
                       (i64.extend_i32_u (i32.load offset=0x44 (local.get $rec))))
              (i64.const 1000)))))
          (local.set $remain (i32.sub (local.get $next_at) (call $host_get_ticks)))
          (if (i32.lt_s (local.get $remain) (i32.const 0)) (then (local.set $remain (i32.const 0))))
          (if (i32.or (i32.lt_s (local.get $best) (i32.const 0)) (i32.lt_u (local.get $remain) (local.get $best)))
            (then (local.set $best (local.get $remain))))))
      (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
      (br $scan)))
    (local.get $best))

  ;; Park a "play ... wait" on its import thunk with the stdcall frame intact
  ;; (as $iocp_block does), but as a timed sleep until the next frame is due,
  ;; so the host lets the clock run instead of re-entering the call at once.
  ;; A park whose cause is a lazy file chunk that is not resident yet (an
  ;; "open" whose header read, or a "play wait" whose frame read, returned
  ;; $AVI_PENDING) must be the IO wait instead: only that yield makes the host
  ;; fill the chunk, and a timed sleep re-entered the call against the same
  ;; missing bytes forever (Half-Life: Uplink's intro.avi in the page).
  (func $mciavi_park
    (local $ms i32)
    (if (i32.eq (call $host_fs_read_pending) (i32.const 1))
      (then (call $io_block (i32.const 0)) (return)))
    (if (global.get $current_thunk_eip)
      (then (global.set $eip (global.get $current_thunk_eip))))
    (global.set $handler_set_eip (i32.const 1))
    (global.set $yield_flag (i32.const 1))
    (global.set $steps (i32.const 0))
    (local.set $ms (call $mciavi_due_ms (i32.const -1)))
    (if (i32.lt_s (local.get $ms) (i32.const 1)) (then (local.set $ms (i32.const 1))))
    (global.set $sleep_yielded (i32.const 1))
    (global.set $sleep_timeout (local.get $ms)))

  ;; ---- the command interpreter ----------------------------------------
  ;; $cmd_wa: the ANSI command in WASM memory. An MCI error, 0,
  ;; $MCIAVI_NOT_MINE (the host parser takes it), or $MCIAVI_PARKED (the
  ;; caller parks on its thunk and leaves the frame alone).
  (func $mciavi_string (param $cmd_wa i32) (param $ret_wa i32) (param $cap i32) (param $cb_hwnd i32) (result i32)
    (local $rec i32) (local $k i32) (local $v i32) (local $from i32) (local $to i32)
    (local $wait i32) (local $p i32) (local $slot i32) (local $el i32)
    (if (i32.eqz (local.get $cmd_wa)) (then (return (global.get $MCIAVI_NOT_MINE))))
    (call $mciavi_tokenize (local.get $cmd_wa))
    (if (i32.lt_u (global.get $mciavi_ntok) (i32.const 2)) (then (return (global.get $MCIAVI_NOT_MINE))))
    ;; open: an avivideo type, "avivideo!file", or a .avi element with no type.
    (if (call $mciavi_tok_is (i32.const 0) (call $mciavi_kw (i32.const 0)))
      (then
        (local.set $k (call $mciavi_find (i32.const 1) (i32.const 1)))   ;; type
        (if (i32.ge_s (local.get $k) (i32.const 0))
          (then
            (if (i32.eqz (call $mciavi_tok_is (i32.add (local.get $k) (i32.const 1)) (call $mciavi_kw (i32.const 3))))
              (then (return (global.get $MCIAVI_NOT_MINE)))))
          (else
            (if (i32.eqz (call $mciavi_tok_is_avi (i32.const 1)))
              (then (return (global.get $MCIAVI_NOT_MINE))))))
        (local.set $el (i32.const 1))
        (if (i32.or (call $mciavi_tok_is (local.get $el) (call $mciavi_kw (i32.const 1)))
                    (call $mciavi_tok_is (local.get $el) (call $mciavi_kw (i32.const 2))))
          (then (return (global.get $MCIERR_MISSING_PARAMETER))))
        (return (call $mciavi_open (local.get $el) (local.get $ret_wa) (local.get $cap)))))
    ;; "close all" also reaches the host's devices.
    (if (i32.and (call $mciavi_tok_is (i32.const 0) (call $mciavi_kw (i32.const 26)))
                 (call $mciavi_tok_is (i32.const 1) (call $mciavi_kw (i32.const 39))))
      (then
        (block $done (loop $all
          (br_if $done (i32.ge_u (local.get $slot) (global.get $MCIAVI_SLOTS)))
          (local.set $rec (call $mciavi_rec (local.get $slot)))
          (if (i32.load (local.get $rec)) (then (call $mciavi_close (local.get $rec))))
          (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
          (br $all)))
        (return (global.get $MCIAVI_NOT_MINE))))
    (local.set $rec (call $mciavi_lookup (i32.const 1)))
    (if (i32.eqz (local.get $rec)) (then (return (global.get $MCIAVI_NOT_MINE))))
    (local.set $wait (i32.ge_s (call $mciavi_find (i32.const 2) (i32.const 6)) (i32.const 0)))
    (if (i32.and (i32.ge_s (call $mciavi_find (i32.const 2) (i32.const 7)) (i32.const 0))
                 (i32.ne (local.get $cb_hwnd) (i32.const 0)))
      (then
        ;; A new notify supersedes an outstanding one.
        (call $mciavi_notify (local.get $rec) (i32.const 2))   ;; MCI_NOTIFY_SUPERSEDED
        (i32.store offset=0x70 (local.get $rec) (local.get $cb_hwnd))))

    ;; play [from N] [to N] [wait] [notify] [repeat] [fullscreen]
    (if (call $mciavi_tok_is (i32.const 0) (call $mciavi_kw (i32.const 21)))
      (then
        ;; The re-entry of a parked "play ... wait": keep going.
        (if (i32.and (i32.ne (i32.load offset=0x58 (local.get $rec)) (i32.const 0))
                     (i32.eq (i32.load offset=0x58 (local.get $rec)) (i32.load offset=16 (global.get $reg_base))))
          (then
            (if (call $mciavi_step (local.get $rec)) (then (return (global.get $MCIAVI_PARKED))))
            (i32.store offset=0x58 (local.get $rec) (i32.const 0))
            (return (i32.const 0))))
        (if (i32.ge_s (call $mciavi_find (i32.const 2) (i32.const 57)) (i32.const 0))
          (then (return (global.get $MCIERR_UNSUPPORTED_FUNCTION))))   ;; repeat
        (local.set $from (i32.load offset=0x3C (local.get $rec)))
        (if (i32.ge_u (local.get $from) (i32.load offset=0x40 (local.get $rec)))
          (then (local.set $from (i32.const 0))))
        (local.set $to (i32.load offset=0x40 (local.get $rec)))
        (local.set $k (call $mciavi_find (i32.const 2) (i32.const 22)))
        (if (i32.ge_s (local.get $k) (i32.const 0))
          (then
            (local.set $v (call $mciavi_tok_int (i32.add (local.get $k) (i32.const 1))))
            (if (i32.lt_s (local.get $v) (i32.const 0)) (then (return (global.get $MCIERR_BAD_INTEGER))))
            (local.set $from (call $mciavi_to_frame (local.get $rec) (local.get $v)))))
        (local.set $k (call $mciavi_find (i32.const 2) (i32.const 15)))
        (if (i32.ge_s (local.get $k) (i32.const 0))
          (then
            (local.set $v (call $mciavi_tok_int (i32.add (local.get $k) (i32.const 1))))
            (if (i32.lt_s (local.get $v) (i32.const 0)) (then (return (global.get $MCIERR_BAD_INTEGER))))
            (local.set $to (call $mciavi_to_frame (local.get $rec) (local.get $v)))))
        (if (i32.gt_u (local.get $from) (local.get $to)) (then (return (global.get $MCIERR_OUTOFRANGE))))
        (call $mciavi_start (local.get $rec) (local.get $from) (local.get $to))
        (if (local.get $wait)
          (then
            (if (call $mciavi_step (local.get $rec))
              (then
                (i32.store offset=0x58 (local.get $rec) (i32.load offset=16 (global.get $reg_base)))
                (return (global.get $MCIAVI_PARKED))))
            (return (i32.const 0))))
        (drop (call $mciavi_step (local.get $rec)))
        (return (i32.const 0))))
    ;; stop / pause / resume
    (if (i32.or (call $mciavi_tok_is (i32.const 0) (call $mciavi_kw (i32.const 23)))
                (call $mciavi_tok_is (i32.const 0) (call $mciavi_kw (i32.const 24))))
      (then
        (if (i32.eq (i32.load offset=0x48 (local.get $rec)) (i32.const 1))
          (then
            (call $mciavi_audio_stop (local.get $rec))
            (call $mciavi_notify (local.get $rec) (i32.const 4))
            (call $mciavi_set_mode (local.get $rec)
              (select (i32.const 2) (i32.const 0) (call $mciavi_tok_is (i32.const 0) (call $mciavi_kw (i32.const 24)))))))
        (i32.store offset=0x58 (local.get $rec) (i32.const 0))
        (return (i32.const 0))))
    (if (call $mciavi_tok_is (i32.const 0) (call $mciavi_kw (i32.const 25)))
      (then
        (if (i32.eq (i32.load offset=0x48 (local.get $rec)) (i32.const 2))
          (then (call $mciavi_start (local.get $rec) (i32.load offset=0x3C (local.get $rec))
                  (i32.load offset=0x54 (local.get $rec)))))
        (return (i32.const 0))))
    ;; close
    (if (call $mciavi_tok_is (i32.const 0) (call $mciavi_kw (i32.const 26)))
      (then
        (call $mciavi_notify (local.get $rec) (i32.const 4))
        (call $mciavi_close (local.get $rec))
        (return (i32.const 0))))
    ;; seek to start|end|N
    (if (call $mciavi_tok_is (i32.const 0) (call $mciavi_kw (i32.const 14)))
      (then
        (local.set $k (call $mciavi_find (i32.const 2) (i32.const 15)))
        (if (i32.lt_s (local.get $k) (i32.const 0)) (then (return (global.get $MCIERR_MISSING_PARAMETER))))
        (local.set $k (i32.add (local.get $k) (i32.const 1)))
        (if (call $mciavi_tok_is (local.get $k) (call $mciavi_kw (i32.const 16)))
          (then (local.set $v (i32.const 0)))
          (else
            (if (call $mciavi_tok_is (local.get $k) (call $mciavi_kw (i32.const 17)))
              (then (local.set $v (i32.load offset=0x40 (local.get $rec))))
              (else
                (local.set $v (call $mciavi_tok_int (local.get $k)))
                (if (i32.lt_s (local.get $v) (i32.const 0)) (then (return (global.get $MCIERR_BAD_INTEGER))))
                (local.set $v (call $mciavi_to_frame (local.get $rec) (local.get $v)))))))
        (if (i32.eq (i32.load offset=0x48 (local.get $rec)) (i32.const 1))
          (then (call $mciavi_audio_stop (local.get $rec)) (call $mciavi_set_mode (local.get $rec) (i32.const 0))))
        ;; Seeking back re-decodes from the key frame before the target.
        (if (i32.lt_u (local.get $v) (i32.load offset=0x3C (local.get $rec)))
          (then (i32.store offset=0x3C (local.get $rec) (i32.const 0))))
        (if (local.get $v)
          (then (call $mciavi_advance (local.get $rec) (local.get $v))))
        (i32.store offset=0x3C (local.get $rec) (local.get $v))
        (return (i32.const 0))))
    ;; break on vk | off
    (if (call $mciavi_tok_is (i32.const 0) (call $mciavi_kw (i32.const 18)))
      (then
        (local.set $k (call $mciavi_find (i32.const 2) (i32.const 19)))
        (if (i32.ge_s (local.get $k) (i32.const 0))
          (then
            (local.set $v (call $mciavi_tok_int (i32.add (local.get $k) (i32.const 1))))
            (if (i32.lt_s (local.get $v) (i32.const 0)) (then (return (global.get $MCIERR_BAD_INTEGER))))
            (i32.store offset=0x5C (local.get $rec) (local.get $v))
            (return (i32.const 0))))
        (if (i32.ge_s (call $mciavi_find (i32.const 2) (i32.const 20)) (i32.const 0))
          (then (i32.store offset=0x5C (local.get $rec) (i32.const 0)) (return (i32.const 0))))
        (return (global.get $MCIERR_MISSING_PARAMETER))))
    ;; window handle H | state show|hide|restore|minimize|maximize
    (if (call $mciavi_tok_is (i32.const 0) (call $mciavi_kw (i32.const 8)))
      (then
        (local.set $k (call $mciavi_find (i32.const 2) (i32.const 9)))
        (if (i32.ge_s (local.get $k) (i32.const 0))
          (then
            (local.set $v (call $mciavi_tok_int (i32.add (local.get $k) (i32.const 1))))
            (if (i32.lt_s (local.get $v) (i32.const 0)) (then (return (global.get $MCIERR_BAD_INTEGER))))
            (i32.store offset=0x28 (local.get $rec)
              (select (i32.load offset=0xC8 (local.get $rec)) (local.get $v) (i32.eqz (local.get $v))))))
        (local.set $k (call $mciavi_find (i32.const 2) (i32.const 10)))
        (if (i32.ge_s (local.get $k) (i32.const 0))
          (then
            (local.set $k (i32.add (local.get $k) (i32.const 1)))
            ;; hide | minimize
            (if (i32.or (call $mciavi_tok_is (local.get $k) (call $mciavi_kw (i32.const 38)))
                        (call $mciavi_tok_is (local.get $k) (call $mciavi_kw (i32.const 50))))
              (then (i32.store offset=0xC4 (local.get $rec) (i32.const 1)))
              (else
                ;; show | restore | maximize
                (if (i32.or (call $mciavi_tok_is (local.get $k) (call $mciavi_kw (i32.const 37)))
                      (i32.or (call $mciavi_tok_is (local.get $k) (call $mciavi_kw (i32.const 49)))
                              (call $mciavi_tok_is (local.get $k) (call $mciavi_kw (i32.const 51)))))
                  (then (i32.store offset=0xC4 (local.get $rec) (i32.const 0)))
                  (else (return (global.get $MCIERR_UNRECOGNIZED_KEYWORD))))))))
        (if (i32.and (i32.lt_s (call $mciavi_find (i32.const 2) (i32.const 9)) (i32.const 0))
                     (i32.lt_s (call $mciavi_find (i32.const 2) (i32.const 10)) (i32.const 0)))
          (then (return (global.get $MCIERR_UNSUPPORTED_FUNCTION))))   ;; text, fixed, ...
        (return (i32.const 0))))
    ;; put destination [at x y w h]
    (if (call $mciavi_tok_is (i32.const 0) (call $mciavi_kw (i32.const 11)))
      (then
        (if (i32.lt_s (call $mciavi_find (i32.const 2) (i32.const 12)) (i32.const 0))
          (then (return (global.get $MCIERR_UNSUPPORTED_FUNCTION))))   ;; source, window, frame
        (local.set $k (call $mciavi_find (i32.const 2) (i32.const 13)))
        (if (i32.lt_s (local.get $k) (i32.const 0))
          (then
            (i32.store offset=0x2C (local.get $rec) (i32.const 0))
            (i32.store offset=0x30 (local.get $rec) (i32.const 0))
            (i32.store offset=0x34 (local.get $rec) (i32.const 0))
            (i32.store offset=0x38 (local.get $rec) (i32.const 0))
            (return (i32.const 0))))
        (local.set $p (i32.const 0))
        (block $bad (loop $nums
          (br_if $bad (i32.ge_u (local.get $p) (i32.const 4)))
          (local.set $v (call $mciavi_tok_int (i32.add (local.get $k) (i32.add (local.get $p) (i32.const 1)))))
          (if (i32.lt_s (local.get $v) (i32.const 0)) (then (return (global.get $MCIERR_BAD_INTEGER))))
          (i32.store offset=0x2C (i32.add (local.get $rec) (i32.shl (local.get $p) (i32.const 2))) (local.get $v))
          (local.set $p (i32.add (local.get $p) (i32.const 1)))
          (br $nums)))
        (return (i32.const 0))))
    ;; where destination|source
    (if (call $mciavi_tok_is (i32.const 0) (call $mciavi_kw (i32.const 40)))
      (then
        (local.set $p (region.addr $MCIAVI_TABLE 0x500))
        (if (i32.ge_s (call $mciavi_find (i32.const 2) (i32.const 12)) (i32.const 0))
          (then
            (local.set $p (call $mciavi_put_dec (local.get $p) (i32.load offset=0x2C (local.get $rec))))
            (i32.store8 (local.get $p) (i32.const 32))
            (local.set $p (call $mciavi_put_dec (i32.add (local.get $p) (i32.const 1)) (i32.load offset=0x30 (local.get $rec))))
            (i32.store8 (local.get $p) (i32.const 32))
            (local.set $p (call $mciavi_put_dec (i32.add (local.get $p) (i32.const 1))
              (select (i32.load offset=0x34 (local.get $rec)) (i32.load offset=0xCC (local.get $rec))
                (i32.ne (i32.load offset=0x34 (local.get $rec)) (i32.const 0)))))
            (i32.store8 (local.get $p) (i32.const 32))
            (drop (call $mciavi_put_dec (i32.add (local.get $p) (i32.const 1))
              (select (i32.load offset=0x38 (local.get $rec)) (i32.load offset=0xD0 (local.get $rec))
                (i32.ne (i32.load offset=0x38 (local.get $rec)) (i32.const 0)))))
            (call $mciavi_ret_str (local.get $ret_wa) (local.get $cap) (region.addr $MCIAVI_TABLE 0x500))
            (return (i32.const 0))))
        (if (i32.ge_s (call $mciavi_find (i32.const 2) (i32.const 41)) (i32.const 0))
          (then
            (i32.store8 (local.get $p) (i32.const 48))
            (i32.store8 offset=1 (local.get $p) (i32.const 32))
            (i32.store8 offset=2 (local.get $p) (i32.const 48))
            (i32.store8 offset=3 (local.get $p) (i32.const 32))
            (local.set $p (call $mciavi_put_dec (i32.add (local.get $p) (i32.const 4)) (i32.load offset=0xCC (local.get $rec))))
            (i32.store8 (local.get $p) (i32.const 32))
            (drop (call $mciavi_put_dec (i32.add (local.get $p) (i32.const 1)) (i32.load offset=0xD0 (local.get $rec))))
            (call $mciavi_ret_str (local.get $ret_wa) (local.get $cap) (region.addr $MCIAVI_TABLE 0x500))
            (return (i32.const 0))))
        (return (global.get $MCIERR_UNSUPPORTED_FUNCTION))))
    ;; status length|position|mode|ready|window handle
    (if (call $mciavi_tok_is (i32.const 0) (call $mciavi_kw (i32.const 27)))
      (then
        (if (call $mciavi_tok_is (i32.const 2) (call $mciavi_kw (i32.const 28)))
          (then (call $mciavi_ret_dec (local.get $ret_wa) (local.get $cap)
                  (call $mciavi_from_frame (local.get $rec) (i32.load offset=0x40 (local.get $rec))))
                (return (i32.const 0))))
        (if (call $mciavi_tok_is (i32.const 2) (call $mciavi_kw (i32.const 29)))
          (then (call $mciavi_ret_dec (local.get $ret_wa) (local.get $cap)
                  (call $mciavi_from_frame (local.get $rec) (i32.load offset=0x3C (local.get $rec))))
                (return (i32.const 0))))
        (if (call $mciavi_tok_is (i32.const 2) (call $mciavi_kw (i32.const 30)))
          (then
            (call $mciavi_ret_str (local.get $ret_wa) (local.get $cap)
              (call $mciavi_kw (i32.add (i32.const 43)
                (select (i32.const 1) (select (i32.const 2) (i32.const 0)
                  (i32.eq (i32.load offset=0x48 (local.get $rec)) (i32.const 2)))
                  (i32.eq (i32.load offset=0x48 (local.get $rec)) (i32.const 1))))))
            (return (i32.const 0))))
        (if (call $mciavi_tok_is (i32.const 2) (call $mciavi_kw (i32.const 42)))
          (then (call $mciavi_ret_str (local.get $ret_wa) (local.get $cap) (call $mciavi_kw (i32.const 46)))
                (return (i32.const 0))))
        (if (i32.and (call $mciavi_tok_is (i32.const 2) (call $mciavi_kw (i32.const 8)))
                     (call $mciavi_tok_is (i32.const 3) (call $mciavi_kw (i32.const 9))))
          (then (call $mciavi_ret_dec (local.get $ret_wa) (local.get $cap) (i32.load offset=0x28 (local.get $rec)))
                (return (i32.const 0))))
        (return (global.get $MCIERR_UNSUPPORTED_FUNCTION))))
    ;; set time format frames|ms  (and "seek exactly", which this device always is)
    (if (call $mciavi_tok_is (i32.const 0) (call $mciavi_kw (i32.const 31)))
      (then
        (local.set $k (call $mciavi_find (i32.const 2) (i32.const 33)))
        (if (i32.ge_s (local.get $k) (i32.const 0))
          (then
            (local.set $k (i32.add (local.get $k) (i32.const 1)))
            (if (call $mciavi_tok_is (local.get $k) (call $mciavi_kw (i32.const 34)))
              (then (i32.store offset=0x74 (local.get $rec) (i32.const 3)) (return (i32.const 0))))
            (if (i32.or (call $mciavi_tok_is (local.get $k) (call $mciavi_kw (i32.const 35)))
                        (call $mciavi_tok_is (local.get $k) (call $mciavi_kw (i32.const 36))))
              (then (i32.store offset=0x74 (local.get $rec) (i32.const 0)) (return (i32.const 0))))
            (return (global.get $MCIERR_UNRECOGNIZED_KEYWORD))))
        (if (i32.ge_s (call $mciavi_find (i32.const 2) (i32.const 59)) (i32.const 0))
          (then (return (i32.const 0))))
        (return (global.get $MCIERR_UNSUPPORTED_FUNCTION))))
    ;; realize (palette) and update (repaint the current frame)
    (if (call $mciavi_tok_is (i32.const 0) (call $mciavi_kw (i32.const 47)))
      (then (return (i32.const 0))))
    (if (call $mciavi_tok_is (i32.const 0) (call $mciavi_kw (i32.const 48)))
      (then
        (if (i32.load offset=0x3C (local.get $rec)) (then (call $mciavi_paint (local.get $rec))))
        (return (i32.const 0))))
    (global.get $MCIERR_UNRECOGNIZED_COMMAND))
