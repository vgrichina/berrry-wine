  ;; ---------------------------------------------------------------------
  ;; DISPDIB — the Video for Windows full-screen DIB display driver.
  ;;
  ;; DISPDIB.DLL is not an API a program calls through GetProcAddress. A
  ;; caller LoadModule()s it and then drives it entirely through messages to a
  ;; window of the class it registers, "DisplayDibWindow" — which is why a
  ;; trace of a DISPDIB user shows a module load, a CreateWindowEx and nothing
  ;; else. So the emulated surface is a built-in module answer plus a
  ;; WAT-native wndproc, not a DLL.
  ;;
  ;; The protocol below is what Pitfall (Over 1000 Games CD, ARCADE/PITFALL)
  ;; actually sends, read out of PITFALL.EXE at 0x0044104e; see
  ;; docs/re-notes/over1000games-shareware.md. Three sends are visible
  ;; statically: WM_COPYDATA with dwData 0x400 (mode + palette), 0x403 (start)
  ;; and 0x404 (stop). How a frame of pixels arrives is deliberately NOT
  ;; guessed here: every other private message traps by name, so the first run
  ;; that needs one says which it is instead of silently drawing nothing.
  ;;
  ;; Every send answers a dispdib.h DISPLAYDIB_* code, so 0 (NOERROR) is
  ;; success. Monster Truck Madness 2 (Monsterx.exe 0x5439a0 / 0x4200db) tests
  ;; both the WM_COPYDATA mode send and 0x403 with `test eax,eax / jnz` into
  ;; "Unable to start DisplayDIB Mode!", and sends 0x402 (DDM_CLOSE) on exit.
  ;;
  ;; The pixels. Real DISPDIB switches the card into VGA mode 13h, and on
  ;; Win9x the VGA window at linear 0xA0000 is mapped into every process, so a
  ;; program writes its frames there itself: MTM2 `rep movsd`s each 320x200
  ;; frame to 0xA0000 (Monsterx.exe 0x543cba) and makes no call at all per
  ;; frame. So 0x403 maps that window as ordinary guest memory, and
  ;; $dispdib_present -- run from PeekMessage, the one call such a game loop
  ;; does make each frame -- shows it through the mode's palette, stretched
  ;; over the DisplayDibWindow. The window only appears once the framebuffer
  ;; holds a pixel: Pitfall sends 0x403 too but draws with GDI into its own
  ;; window, which a black full-screen popup would cover.
  ;;
  ;; $DISPDIB_STATE: +0 hwnd, +4 running, +8 width, +12 height, +16 bpp,
  ;; +20 palette sent, +24 mode set, +28 guest BITMAPINFO copy (header +
  ;; 256 RGBQUADs, top-down), +32 bytes of VGA window mapped, +36 shown.
  ;; ---------------------------------------------------------------------

  (data (region.addr $DISPDIB_STRINGS 0x00) "DisplayDibWindow\00")
  (data (region.addr $DISPDIB_STRINGS 0x20) "dispdib.dll\00")
  (data (region.addr $DISPDIB_STRINGS 0x30) "DISPDIB DisplayDibWindow message\00")

  ;; Is this CreateWindowEx class name DISPDIB's window class? Callers must
  ;; already have rejected MAKEINTATOM values; a class atom is not a pointer.
  (func $dispdib_is_class_name (param $guest i32) (result i32)
    (if (i32.lt_u (local.get $guest) (i32.const 0x10000))
      (then (return (i32.const 0))))
    (call $guest_ansi_eq_wasm_ci (local.get $guest)
      (region.addr $DISPDIB_STRINGS 0x00)))

  ;; Does this LoadModule/OpenFile path name DISPDIB? The caller builds it
  ;; from GetSystemDirectory, so the match is on the basename.
  (func $dispdib_is_module_path (param $guest i32) (result i32)
    (if (i32.eqz (local.get $guest)) (then (return (i32.const 0))))
    (call $dll_name_match (local.get $guest)
      (region.addr $DISPDIB_STRINGS 0x20)))

  (func $dispdib_attach (param $hwnd i32)
    (i32.store offset=0 (global.get $DISPDIB_STATE) (local.get $hwnd)))

  ;; WM_COPYDATA dwData=0x400: a BITMAPINFO — BITMAPINFOHEADER followed by the
  ;; palette. cbData is 0x428 for the 8bpp case (0x28 + 256 RGBQUADs), which is
  ;; how one message carries both the mode and the colours.
  (func $dispdib_set_mode (param $cds i32) (result i32)
    (local $bits i32) (local $cb i32) (local $bpp i32)
    (local.set $cb (call $gl32 (i32.add (local.get $cds) (i32.const 4))))
    (local.set $bits (call $gl32 (i32.add (local.get $cds) (i32.const 8))))
    ;; DISPLAYDIB_INVALIDDIB (2) for a send with no header in it.
    (if (i32.eqz (local.get $bits)) (then (return (i32.const 2))))
    (if (i32.lt_u (local.get $cb) (i32.const 0x28)) (then (return (i32.const 2))))
    (local.set $bpp (call $gl16 (i32.add (local.get $bits) (i32.const 14))))
    (i32.store offset=8 (global.get $DISPDIB_STATE)
      (call $gl32 (i32.add (local.get $bits) (i32.const 4))))
    (i32.store offset=12 (global.get $DISPDIB_STATE)
      (call $gl32 (i32.add (local.get $bits) (i32.const 8))))
    (i32.store offset=16 (global.get $DISPDIB_STATE) (local.get $bpp))
    ;; Palette present only when the caller paid for one past the header.
    (i32.store offset=20 (global.get $DISPDIB_STATE)
      (i32.gt_u (local.get $cb) (i32.const 0x28)))
    (i32.store offset=24 (global.get $DISPDIB_STATE) (i32.const 1))
    (call $dispdib_keep_format (local.get $bits) (local.get $cb))
    (i32.const 0))

  ;; Keep the mode as a BITMAPINFO the presenter can hand to StretchDIBits:
  ;; top-down, since 0xA0000 is the top scanline, with the palette the same
  ;; send carried. A later mode send with only a new palette (MTM2 sends five)
  ;; replaces it.
  (func $dispdib_keep_format (param $bits i32) (param $cb i32)
    (local $bmi i32) (local $wa i32) (local $colors i32) (local $h i32)
    (local.set $bmi (i32.load offset=28 (global.get $DISPDIB_STATE)))
    (if (i32.eqz (local.get $bmi))
      (then
        (local.set $bmi (call $heap_alloc (i32.const 0x428)))
        (if (i32.eqz (local.get $bmi)) (then (return)))
        (i32.store offset=28 (global.get $DISPDIB_STATE) (local.get $bmi))))
    (local.set $wa (call $g2w (local.get $bmi)))
    (call $zero_memory (local.get $wa) (i32.const 0x428))
    (memory.copy (local.get $wa) (call $g2w (local.get $bits)) (i32.const 0x28))
    (i32.store (local.get $wa) (i32.const 0x28))
    (local.set $h (i32.load offset=8 (local.get $wa)))
    (if (i32.gt_s (local.get $h) (i32.const 0))
      (then (i32.store offset=8 (local.get $wa) (i32.sub (i32.const 0) (local.get $h)))))
    (local.set $colors (i32.shr_u (i32.sub (local.get $cb) (i32.const 0x28)) (i32.const 2)))
    (if (i32.gt_u (local.get $colors) (i32.const 256)) (then (local.set $colors (i32.const 256))))
    (memory.copy (i32.add (local.get $wa) (i32.const 0x28))
      (call $g2w (i32.add (local.get $bits) (i32.const 0x28)))
      (i32.shl (local.get $colors) (i32.const 2)))
    (i32.store offset=32 (local.get $wa) (i32.const 256)))

  ;; 0x403: map the VGA window the program is about to write. 64 KB is the
  ;; real window; a mode bigger than that (no DISPDIB mode is) gets its size.
  ;; The mode's scanline count. biHeight is negative for a top-down header,
  ;; which is what MTM2 sends (320 x -200).
  (func $dispdib_rows (result i32)
    (local $h i32)
    (local.set $h (i32.load offset=12 (global.get $DISPDIB_STATE)))
    (select (i32.sub (i32.const 0) (local.get $h)) (local.get $h)
      (i32.lt_s (local.get $h) (i32.const 0))))

  (func $dispdib_map_framebuffer
    (local $size i32)
    (if (i32.ne (i32.load offset=16 (global.get $DISPDIB_STATE)) (i32.const 8))
      (then (return)))
    (if (i32.load offset=32 (global.get $DISPDIB_STATE)) (then (return)))
    (local.set $size (i32.and
      (i32.add (i32.mul (i32.load offset=8 (global.get $DISPDIB_STATE))
                        (call $dispdib_rows))
               (i32.const 0xFFF))
      (i32.const 0xFFFFF000)))
    (if (i32.lt_u (local.get $size) (i32.const 0x10000))
      (then (local.set $size (i32.const 0x10000))))
    (if (i32.eqz (call $virtual_map_commit (i32.const 0xA0000) (local.get $size)))
      (then (return)))
    (i32.store offset=32 (global.get $DISPDIB_STATE) (local.get $size)))

  ;; Show the VGA window. Called from PeekMessageA while the display runs.
  (func $dispdib_present
    (local $hwnd i32) (local $size i32) (local $fb i32) (local $i i32)
    (local $cs i32) (local $cw i32) (local $ch i32)
    (local.set $hwnd (i32.load (global.get $DISPDIB_STATE)))
    (local.set $size (i32.load offset=32 (global.get $DISPDIB_STATE)))
    (if (i32.or (i32.eqz (local.get $size))
                (i32.eqz (i32.load offset=28 (global.get $DISPDIB_STATE))))
      (then (return)))
    ;; Through $g2w, which is what the program's own stores resolve with; the
    ;; whole window must be one run of linear memory to hand to StretchDIBits.
    (local.set $fb (call $g2w (i32.const 0xA0000)))
    (if (i32.ne (call $g2w (i32.add (i32.const 0xA0000) (i32.sub (local.get $size) (i32.const 1))))
                (i32.add (local.get $fb) (i32.sub (local.get $size) (i32.const 1))))
      (then (return)))
    (if (i32.eqz (i32.load offset=36 (global.get $DISPDIB_STATE)))
      (then
        ;; Not shown until the program has drawn something.
        (block $drawn (loop $scan
          (br_if $drawn (i32.load (i32.add (local.get $fb) (local.get $i))))
          (local.set $i (i32.add (local.get $i) (i32.const 4)))
          (br_if $scan (i32.lt_u (local.get $i) (local.get $size)))
          (return)))
        (drop (call $host_show_window (local.get $hwnd) (i32.const 5)))
        (drop (call $wnd_set_style (local.get $hwnd)
          (i32.or (call $wnd_get_style (local.get $hwnd)) (i32.const 0x10000000))))
        (i32.store offset=36 (global.get $DISPDIB_STATE) (i32.const 1))))
    (local.set $cs (call $host_get_window_client_size (local.get $hwnd)))
    (local.set $cw (i32.and (local.get $cs) (i32.const 0xFFFF)))
    (local.set $ch (i32.shr_u (local.get $cs) (i32.const 16)))
    (if (i32.or (i32.eqz (local.get $cw)) (i32.eqz (local.get $ch)))
      (then (return)))
    (drop (call $gdi_native_stretch_dib_bits
      (i32.add (local.get $hwnd) (i32.const 0x40000))
      (i32.const 0) (i32.const 0) (local.get $cw) (local.get $ch)
      (i32.const 0) (i32.const 0)
      (i32.load offset=8 (global.get $DISPDIB_STATE))
      (call $dispdib_rows)
      (local.get $fb)
      (call $g2w (i32.load offset=28 (global.get $DISPDIB_STATE)))
      (i32.const 0) (i32.const 0x00CC0020))))

  ;; Leaving the mode takes the full-screen window down again.
  (func $dispdib_stop
    (i32.store offset=4 (global.get $DISPDIB_STATE) (i32.const 0))
    (if (i32.load offset=36 (global.get $DISPDIB_STATE))
      (then
        (drop (call $host_show_window (i32.load (global.get $DISPDIB_STATE)) (i32.const 0)))
        (drop (call $wnd_set_style (i32.load (global.get $DISPDIB_STATE))
          (i32.and (call $wnd_get_style (i32.load (global.get $DISPDIB_STATE)))
                   (i32.const 0xEFFFFFFF))))
        (i32.store offset=36 (global.get $DISPDIB_STATE) (i32.const 0)))))

  (func $dispdib_wndproc (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $target i32)
    (call $dispdib_attach (local.get $hwnd))
    ;; WM_COPYDATA
    (if (i32.eq (local.get $msg) (i32.const 0x004A))
      (then
        (if (i32.eq (call $gl32 (local.get $lParam)) (i32.const 0x400))
          (then (return (call $dispdib_set_mode (local.get $lParam)))))
        (call $host_log_i32 (call $gl32 (local.get $lParam)))
        (call $crash_unimplemented
          (region.addr $DISPDIB_STRINGS 0x30))
        (return (i32.const 0))))
    ;; 0x403 start / 0x404 stop the full-screen display; 0x402 (DDM_CLOSE)
    ;; leaves it, which stops it too.
    (if (i32.eq (local.get $msg) (i32.const 0x403))
      (then
        (i32.store offset=4 (global.get $DISPDIB_STATE) (i32.const 1))
        (call $dispdib_map_framebuffer)
        (return (i32.const 0))))
    (if (i32.or (i32.eq (local.get $msg) (i32.const 0x404))
                (i32.eq (local.get $msg) (i32.const 0x402)))
      (then
        (call $dispdib_stop)
        (return (i32.const 0))))
    ;; Keyboard and mouse input belongs to the program, not the display:
    ;; DisplayDibWindow hands it to its parent (for this WS_POPUP, the owner it
    ;; was created with). MTM2 SetFocus()es the display for the race and reads
    ;; its controls from WM_KEYDOWN in the view's own wndproc.
    (if (i32.or
          (i32.and (i32.ge_u (local.get $msg) (i32.const 0x0100))
                   (i32.le_u (local.get $msg) (i32.const 0x0108)))
          (i32.and (i32.ge_u (local.get $msg) (i32.const 0x0200))
                   (i32.le_u (local.get $msg) (i32.const 0x020D))))
      (then
        (local.set $target (call $wnd_get_parent_api (local.get $hwnd)))
        (if (local.get $target)
          (then (drop (call $post_queue_push_input (local.get $target) (local.get $msg)
            (local.get $wParam) (local.get $lParam)))))
        (return (i32.const 0))))
    ;; Anything else in the private range is a piece of the protocol we have
    ;; not seen yet. Trapping names it; returning 0 would leave a program
    ;; drawing into a driver that quietly discards every frame.
    (if (i32.ge_u (local.get $msg) (i32.const 0x400))
      (then
        (call $host_log_i32 (local.get $msg))
        (call $crash_unimplemented
          (region.addr $DISPDIB_STRINGS 0x30))))
    (i32.const 0))
