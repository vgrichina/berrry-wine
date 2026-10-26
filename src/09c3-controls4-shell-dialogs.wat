  ;; ---- Shell dialogs: Run (SHELL32 #61) and Shut Down (SHELL32 #60) ----
  ;;
  ;; These are the two commands on Task Manager's File menu, and both were
  ;; no-op stubs that popped their arguments and returned -- so the menu items
  ;; existed, did nothing, and reported nothing. They are shell-owned dialogs:
  ;; the app supplies at most a title, and every control belongs to SHELL32,
  ;; which is us. So they are built here the way ShellAbout's dialog is, out of
  ;; $host_register_dialog_frame plus $ctrl_create_child.
  (global $shelldlg_kind (mut i32) (i32.const 0))        ;; 1 = Run, 2 = Shut Down
  (global $shelldlg_edit_hwnd (mut i32) (i32.const 0))
  (global $shelldlg_owner (mut i32) (i32.const 0))
  ;; Shut Down: hwnd of the first of the four option radios. They are created
  ;; back to back, so the option index is the hwnd's distance from this one.
  (global $shelldlg_option0 (mut i32) (i32.const 0))

  (data (region.addr $RESERVED_PAGE_STRINGS 0x180) "Run\00")
  (data (region.addr $RESERVED_PAGE_STRINGS 0x184) "Type the name of a program, folder, or\00")
  (data (region.addr $RESERVED_PAGE_STRINGS 0x1AB) "document, and Windows will open it for you.\00")
  (data (region.addr $RESERVED_PAGE_STRINGS 0x1D7) "Open:\00")
  (data (region.addr $RESERVED_PAGE_STRINGS 0x1DD) "Browse...\00")
  (data (region.addr $RESERVED_PAGE_STRINGS 0x1E7) "Shut Down Windows\00")
  ;; The options, in dialog order. Windows 98 also offered "Restart in
  ;; MS-DOS mode"; there is no DOS under this machine, so it is not listed.
  ;; The prompt lives in the gap after KERNEL32_Ordinal99 (0x50..0x90)
  ;; because the run from 0x1F9 to the module list at 0x228 is too short.
  (data (region.addr $RESERVED_PAGE_STRINGS 0x1F9) "Stand by\00")
  (data (region.addr $RESERVED_PAGE_STRINGS 0x202) "Shut down\00")
  (data (region.addr $RESERVED_PAGE_STRINGS 0x20C) "Restart\00")
  (data (region.addr $RESERVED_PAGE_STRINGS 0x50) "What do you want the computer to do?\00")
  (data (region.addr $RESERVED_PAGE_STRINGS 0x75) "Help\00")

  ;; Shared frame setup for both dialogs. $title_wa is a linear address.
  (func $shelldlg_frame (param $dlg i32) (param $owner i32)
                        (param $title_wa i32) (param $w i32) (param $h i32)
    (call $host_register_dialog_frame
      (local.get $dlg) (local.get $owner) (local.get $title_wa)
      (local.get $w) (local.get $h) (i32.const 1))
    (call $wnd_table_set (local.get $dlg) (global.get $WNDPROC_CTRL_NATIVE))
    (call $title_table_set (local.get $dlg) (local.get $title_wa)
      (call $strlen (local.get $title_wa)))
    (call $wnd_set_owner (local.get $dlg) (local.get $owner))
    (drop (call $wnd_set_style (local.get $dlg) (i32.const 0x90C80000)))
    ;; Client geometry must exist before the first WM_NCPAINT, or the frame
    ;; repaint erases the child controls (the same ordering ShellAbout needs).
    (call $defwndproc_do_nccalcsize (local.get $dlg))
    (call $ctrl_table_set (call $wnd_table_find (local.get $dlg))
      (i32.const 29) (i32.const 0))
    (call $nc_flags_set (local.get $dlg) (i32.const 3))
    (call $dlg_fill_bkgnd (local.get $dlg)))

  ;; RunFileDlg's dialog. $title_g / $desc_g are guest pointers and may be 0,
  ;; in which case the shell's own wording is used -- which is what the real
  ;; one does when an app passes NULL.
  (func $create_run_dialog (param $dlg i32) (param $owner i32)
                           (param $title_g i32) (param $desc_g i32)
    (local $title_wa i32)
    (local.set $title_wa (region.addr $RESERVED_PAGE_STRINGS 0x180))
    (if (local.get $title_g)
      (then
        (if (i32.load8_u (call $g2w (local.get $title_g)))
          (then (local.set $title_wa (call $g2w (local.get $title_g)))))))
    (global.set $shelldlg_kind (i32.const 1))
    (global.set $shelldlg_owner (local.get $owner))
    (call $shelldlg_frame (local.get $dlg) (local.get $owner)
      (local.get $title_wa) (i32.const 400) (i32.const 176))
    ;; Prompt. A caller-supplied description replaces the first line; the
    ;; standard text is two lines because a STATIC does not wrap.
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 3) (i32.const 0xFFFF)
            (i32.const 14) (i32.const 14) (i32.const 366) (i32.const 18)
            (i32.const 0x50000000)
            (if (result i32) (local.get $desc_g)
              (then (local.get $desc_g))
              (else (call $wat_str_to_heap (region.addr $RESERVED_PAGE_STRINGS 0x184) (i32.const 38))))))
    (if (i32.eqz (local.get $desc_g))
      (then
        (drop (call $ctrl_create_child (local.get $dlg) (i32.const 3) (i32.const 0xFFFF)
                (i32.const 14) (i32.const 32) (i32.const 366) (i32.const 18)
                (i32.const 0x50000000)
                (call $wat_str_to_heap (region.addr $RESERVED_PAGE_STRINGS 0x1AB) (i32.const 43))))))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 3) (i32.const 0xFFFF)
            (i32.const 14) (i32.const 66) (i32.const 44) (i32.const 18)
            (i32.const 0x50000000)
            (call $wat_str_to_heap (region.addr $RESERVED_PAGE_STRINGS 0x1D7) (i32.const 5))))
    (global.set $shelldlg_edit_hwnd
      (call $ctrl_create_child (local.get $dlg) (i32.const 2) (i32.const 1001)
        (i32.const 60) (i32.const 62) (i32.const 320) (i32.const 22)
        (i32.const 0x50810080) (i32.const 0)))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 1) (i32.const 1)
            (i32.const 148) (i32.const 108) (i32.const 72) (i32.const 24)
            (i32.const 0x50010001)
            (call $wat_str_to_heap (i32.const 0x1D9) (i32.const 2))))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 1) (i32.const 2)
            (i32.const 228) (i32.const 108) (i32.const 72) (i32.const 24)
            (i32.const 0x50010000)
            (call $wat_str_to_heap (i32.const 0x1D2) (i32.const 6))))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 1) (i32.const 1002)
            (i32.const 308) (i32.const 108) (i32.const 72) (i32.const 24)
            (i32.const 0x50010000)
            (call $wat_str_to_heap (region.addr $RESERVED_PAGE_STRINGS 0x1DD) (i32.const 9)))))

  ;; The Windows 98 Shut Down Windows dialog, laid out from shell32.dll
  ;; 4.72's dialog 1064 (as carried by aubymori/ClassicShutdown):
  ;;
  ;;   ICON            7,11  18x20      LTEXT  38,11  151x10
  ;;   radios          38,27 155x10, one every 12 DLU
  ;;   OK/Cancel/Help  39|95|151, 52x14, 21 DLU under the last option
  ;;   dialog          211 wide, 127 high with all six options
  ;;
  ;; in dialog units of the 8pt MS Shell Dlg (x*3/2, y*13/8 in pixels,
  ;; docs: reference_dialog_units). Three options are listed, so the dialog
  ;; is 36 DLU shorter and the buttons sit that much higher, exactly what the
  ;; real one does when it drops an option it cannot offer. What OK does is
  ;; the host's: $shelldlg_wndproc hands the chosen option to
  ;; $host_exit_windows and the guest quits on its own.
  (func $create_shutdown_dialog (param $dlg i32) (param $owner i32)
    (local $first i32) (local $second i32)
    (global.set $shelldlg_kind (i32.const 2))
    (global.set $shelldlg_owner (local.get $owner))
    (global.set $shelldlg_edit_hwnd (i32.const 0))
    ;; Client 316x148 plus the caption and the 3px frame on each side.
    (call $shelldlg_frame (local.get $dlg) (local.get $owner)
      (region.addr $RESERVED_PAGE_STRINGS 0x1E7) (i32.const 322) (i32.const 172))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 3) (i32.const 0xFFFF)
            (i32.const 57) (i32.const 18) (i32.const 226) (i32.const 16)
            (i32.const 0x50000000)
            (call $wat_str_to_heap (region.addr $RESERVED_PAGE_STRINGS 0x50) (i32.const 36))))
    ;; BS_AUTORADIOBUTTON = 9. The first carries WS_GROUP so the three behave
    ;; as one group, which is what makes the selection exclusive. Created
    ;; back to back so $shelldlg_option0 + index names each one.
    (local.set $first (call $ctrl_create_child (local.get $dlg) (i32.const 1) (i32.const 1010)
            (i32.const 57) (i32.const 44) (i32.const 232) (i32.const 16)
            (i32.const 0x50030009)
            (call $wat_str_to_heap (region.addr $RESERVED_PAGE_STRINGS 0x1F9) (i32.const 8))))
    (global.set $shelldlg_option0 (local.get $first))
    (local.set $second (call $ctrl_create_child (local.get $dlg) (i32.const 1) (i32.const 1011)
            (i32.const 57) (i32.const 63) (i32.const 232) (i32.const 16)
            (i32.const 0x50010009)
            (call $wat_str_to_heap (region.addr $RESERVED_PAGE_STRINGS 0x202) (i32.const 9))))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 1) (i32.const 1012)
            (i32.const 57) (i32.const 83) (i32.const 232) (i32.const 16)
            (i32.const 0x50010009)
            (call $wat_str_to_heap (region.addr $RESERVED_PAGE_STRINGS 0x20C) (i32.const 7))))
    ;; Windows 98 opens this dialog with "Shut down" already chosen, so OK is
    ;; immediately meaningful. BM_SETCHECK = 0x00F1.
    (drop (call $wnd_send_message (local.get $second) (i32.const 0x00F1)
            (i32.const 1) (i32.const 0)))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 1) (i32.const 1)
            (i32.const 58) (i32.const 117) (i32.const 78) (i32.const 23)
            (i32.const 0x50010001)
            (call $wat_str_to_heap (i32.const 0x1D9) (i32.const 2))))
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 1) (i32.const 2)
            (i32.const 142) (i32.const 117) (i32.const 78) (i32.const 23)
            (i32.const 0x50010000)
            (call $wat_str_to_heap (i32.const 0x1D2) (i32.const 6))))
    ;; Help (IDHELP = 9) is on the real dialog; there is no help topic behind
    ;; it here, so it is there and disabled (WS_DISABLED) rather than absent.
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 1) (i32.const 9)
            (i32.const 226) (i32.const 117) (i32.const 78) (i32.const 23)
            (i32.const 0x58010000)
            (call $wat_str_to_heap (region.addr $RESERVED_PAGE_STRINGS 0x75) (i32.const 4)))))

  ;; The dialog's icon: the small monitor shell32 shows beside the prompt,
  ;; drawn with GDI at client (10,16), 32x32. The dialog owns no guest
  ;; resource to load one from.
  (func $shutdown_dialog_paint_icon (param $hwnd i32)
    (local $hdc i32)
    (local.set $hdc (i32.add (local.get $hwnd) (i32.const 0x40000)))
    ;; Bezel: dark outline, light face, highlight along the top-left.
    (call $power_fill (local.get $hdc) (i32.const 11) (i32.const 17) (i32.const 41) (i32.const 40) (i32.const 0x00000000))
    (call $power_fill (local.get $hdc) (i32.const 12) (i32.const 18) (i32.const 40) (i32.const 39) (i32.const 0x00C0C0C0))
    (call $power_fill (local.get $hdc) (i32.const 12) (i32.const 18) (i32.const 39) (i32.const 19) (i32.const 0x00FFFFFF))
    (call $power_fill (local.get $hdc) (i32.const 12) (i32.const 18) (i32.const 13) (i32.const 38) (i32.const 0x00FFFFFF))
    (call $power_fill (local.get $hdc) (i32.const 12) (i32.const 38) (i32.const 40) (i32.const 39) (i32.const 0x00808080))
    (call $power_fill (local.get $hdc) (i32.const 39) (i32.const 18) (i32.const 40) (i32.const 39) (i32.const 0x00808080))
    ;; Screen: navy with a lighter window in it.
    (call $power_fill (local.get $hdc) (i32.const 15) (i32.const 21) (i32.const 37) (i32.const 35) (i32.const 0x00000000))
    (call $power_fill (local.get $hdc) (i32.const 16) (i32.const 22) (i32.const 36) (i32.const 34) (i32.const 0x00800000))
    (call $power_fill (local.get $hdc) (i32.const 18) (i32.const 24) (i32.const 34) (i32.const 32) (i32.const 0x00D08410))
    (call $power_fill (local.get $hdc) (i32.const 18) (i32.const 24) (i32.const 34) (i32.const 26) (i32.const 0x00800000))
    ;; Neck and base.
    (call $power_fill (local.get $hdc) (i32.const 23) (i32.const 40) (i32.const 29) (i32.const 44) (i32.const 0x00808080))
    (call $power_fill (local.get $hdc) (i32.const 17) (i32.const 44) (i32.const 35) (i32.const 48) (i32.const 0x00C0C0C0))
    (call $power_fill (local.get $hdc) (i32.const 17) (i32.const 44) (i32.const 35) (i32.const 45) (i32.const 0x00FFFFFF))
    (call $power_fill (local.get $hdc) (i32.const 17) (i32.const 47) (i32.const 35) (i32.const 48) (i32.const 0x00000000)))

  ;; Which of the three options is checked, as the exit_windows mode (0 stand
  ;; by, 1 shut down, 2 restart). BM_GETCHECK = 0x00F0. Nothing checked reads
  ;; as shut down, the option the dialog opened on.
  (func $shutdown_dialog_mode (result i32)
    (local $i i32)
    (if (i32.eqz (global.get $shelldlg_option0)) (then (return (i32.const 1))))
    (loop $scan
      (if (call $wnd_send_message
            (i32.add (global.get $shelldlg_option0) (local.get $i))
            (i32.const 0x00F0) (i32.const 0) (i32.const 0))
        (then (return (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $scan (i32.lt_u (local.get $i) (i32.const 3))))
    (i32.const 1))

  ;; ---- The power screens -------------------------------------------------
  ;;
  ;; Windows 98 kept LOGOW.SYS ("Please wait while your computer shuts
  ;; down.") and LOGOS.SYS ("It's now safe to turn off your computer.") as
  ;; 320x400 bitmaps that the display stretched to 640x480, which is where
  ;; their wide pixels come from. The shell paints those two pictures here
  ;; with the same GDI every guest draws with -- the strike fonts included --
  ;; into a 320x400 32bpp top-down DIB, and the host shows the DIB stretched
  ;; the same way. Nothing about the picture lives on the host side.
  ;;
  ;; The strings have a small region of their own (00-regions.wat); the
  ;; dialog-string regions are full.
  (global $POWER_SCREEN_STRINGS i32 (region.addr $POWER_SCREEN_STRINGS 0))
  (global $POWER_SCREEN_STRINGS_SIZE i32 (region.size $POWER_SCREEN_STRINGS))
  (data (region.addr $POWER_SCREEN_STRINGS 0x00) "Please wait while your computer shuts down.\00")
  (data (region.addr $POWER_SCREEN_STRINGS 0x2C) "It's now safe to turn off\00")
  (data (region.addr $POWER_SCREEN_STRINGS 0x46) "your computer.\00")
  ;; The wordmark is this machine's, not Microsoft's.
  (data (region.addr $POWER_SCREEN_STRINGS 0x55) "Wine-Assembly\00")
  (data (region.addr $POWER_SCREEN_STRINGS 0x63) "by berrry.app\00")
  ;; The footer the safe-to-turn-off screen grows a moment later (kind 2).
  (data (region.addr $POWER_SCREEN_STRINGS 0x71) "Thanks for running Wine-Assembly.\00")
  (data (region.addr $POWER_SCREEN_STRINGS 0x93) "Restart\00")
  (data (region.addr $POWER_SCREEN_STRINGS 0x9B) "berrry.app\00")

  ;; Text centred on $cx, top at $y, in the DC's current font and colour.
  (func $power_text_centred (param $hdc i32) (param $cx i32) (param $y i32)
                            (param $text i32) (param $len i32)
    (local $w i32)
    (local.set $w (call $host_measure_text (local.get $hdc) (local.get $text)
                    (local.get $len) (i32.const 0)))
    (drop (call $gdi_native_text_out (local.get $hdc)
      (i32.sub (local.get $cx) (i32.shr_u (local.get $w) (i32.const 1)))
      (local.get $y) (local.get $text) (local.get $len) (i32.const 0))))

  ;; One solid-colour rectangle: a brush made and thrown away, so callers do
  ;; not carry handles around. $color is a COLORREF (0x00BBGGRR).
  (func $power_fill (param $hdc i32) (param $left i32) (param $top i32)
                    (param $right i32) (param $bottom i32) (param $color i32)
    (local $brush i32)
    (local.set $brush (call $gdi_native_create_solid_brush (local.get $color)))
    (drop (call $gdi_native_fill_rect (local.get $hdc) (local.get $left) (local.get $top)
      (local.get $right) (local.get $bottom) (local.get $brush)))
    (drop (call $gdi_native_delete_object (local.get $brush))))

  ;; A face at a pixel height, bound to its strike. MS Sans Serif carries
  ;; 13, 16 and 20 pixel strikes; anything else rounds to the nearest.
  (func $power_font (param $height i32) (param $weight i32) (result i32)
    (local $font i32)
    (local.set $font (call $gdi_font_create (local.get $height) (local.get $weight)
      (i32.const 0) (region.addr $STRING_CONSTANTS 0x170)))
    (call $gdi_bitmap_font_bind (local.get $font) (region.addr $STRING_CONSTANTS 0x170))
    (local.get $font))

  ;; The 8-bit channel mix of two COLORREFs at $t/256.
  (func $power_lerp (param $a i32) (param $b i32) (param $t i32) (result i32)
    (local $out i32) (local $shift i32) (local $ca i32) (local $cb i32)
    (loop $chan
      (local.set $ca (i32.and (i32.shr_u (local.get $a) (local.get $shift)) (i32.const 0xFF)))
      (local.set $cb (i32.and (i32.shr_u (local.get $b) (local.get $shift)) (i32.const 0xFF)))
      (local.set $out (i32.or (local.get $out)
        (i32.shl
          (i32.add (local.get $ca)
            (i32.shr_s (i32.mul (i32.sub (local.get $cb) (local.get $ca)) (local.get $t)) (i32.const 8)))
          (local.get $shift))))
      (local.set $shift (i32.add (local.get $shift) (i32.const 8)))
      (br_if $chan (i32.lt_u (local.get $shift) (i32.const 24))))
    (local.get $out))

  ;; The waving flag: four panes, each a stack of 2px strips whose x offset
  ;; follows one period of a wave down the pane, and the trail of black
  ;; squares flying off to the left that the logo has always had.
  (func $power_flag (param $hdc i32) (param $x i32) (param $y i32)
    (local $pane i32) (local $strip i32) (local $dx i32) (local $px i32) (local $py i32)
    (local $color i32) (local $row i32) (local $col i32)
    ;; Trail: three columns of squares that thin out to the left.
    (local.set $row (i32.const 0))
    (loop $rows
      (local.set $col (i32.const 0))
      (loop $cols
        (if (i32.and
              (i32.lt_u (local.get $col) (i32.sub (i32.const 3) (i32.rem_u (local.get $row) (i32.const 2))))
              (i32.eqz (i32.and (i32.add (local.get $row) (local.get $col)) (i32.const 1))))
          (then
            (local.set $px (i32.sub (local.get $x) (i32.add (i32.const 10) (i32.mul (local.get $col) (i32.const 9)))))
            (local.set $py (i32.add (local.get $y) (i32.add (i32.const 8) (i32.mul (local.get $row) (i32.const 7)))))
            (call $power_fill (local.get $hdc) (local.get $px) (local.get $py)
              (i32.add (local.get $px) (i32.const 4)) (i32.add (local.get $py) (i32.const 4))
              (i32.const 0x00000000))))
        (local.set $col (i32.add (local.get $col) (i32.const 1)))
        (br_if $cols (i32.lt_u (local.get $col) (i32.const 3))))
      (local.set $row (i32.add (local.get $row) (i32.const 1)))
      (br_if $rows (i32.lt_u (local.get $row) (i32.const 10))))
    ;; Panes: red, green over blue, yellow. 30x30 each, 4px apart.
    (local.set $pane (i32.const 0))
    (loop $panes
      (local.set $color
        (select (i32.const 0x000000FF)
          (select (i32.const 0x0000A000)
            (select (i32.const 0x00FF0000) (i32.const 0x0000FFFF)
              (i32.eq (local.get $pane) (i32.const 2)))
            (i32.eq (local.get $pane) (i32.const 1)))
          (i32.eqz (local.get $pane))))
      (local.set $px (i32.add (local.get $x) (i32.mul (i32.and (local.get $pane) (i32.const 1)) (i32.const 34))))
      (local.set $py (i32.add (local.get $y) (i32.mul (i32.shr_u (local.get $pane) (i32.const 1)) (i32.const 34))))
      (local.set $strip (i32.const 0))
      (loop $strips
        ;; A gentle S down each pane: offsets 0..3..0..-3..0 over 15 strips.
        (local.set $dx (i32.sub (i32.const 3)
          (i32.shr_s (i32.mul (i32.sub (i32.rem_u (i32.add (local.get $strip) (i32.const 4)) (i32.const 15)) (i32.const 7)) (i32.const 6)) (i32.const 3))))
        (local.set $dx (select (local.get $dx) (i32.sub (i32.const 0) (local.get $dx))
          (i32.lt_u (i32.rem_u (i32.add (local.get $strip) (i32.const 4)) (i32.const 15)) (i32.const 8))))
        (call $power_fill (local.get $hdc)
          (i32.add (local.get $px) (local.get $dx))
          (i32.add (local.get $py) (i32.mul (local.get $strip) (i32.const 2)))
          (i32.add (i32.add (local.get $px) (local.get $dx)) (i32.const 30))
          (i32.add (local.get $py) (i32.mul (i32.add (local.get $strip) (i32.const 1)) (i32.const 2)))
          (local.get $color))
        (local.set $strip (i32.add (local.get $strip) (i32.const 1)))
        (br_if $strips (i32.lt_u (local.get $strip) (i32.const 15))))
      (local.set $pane (i32.add (local.get $pane) (i32.const 1)))
      (br_if $panes (i32.lt_u (local.get $pane) (i32.const 4)))))

  ;; LOGOW.SYS: a sky that deepens towards the top, the flag with this
  ;; machine's wordmark under it, and the line at the bottom.
  (func $power_paint_wait (param $hdc i32)
    (local $y i32) (local $font i32) (local $old i32)
    (local.set $y (i32.const 0))
    (loop $sky
      (call $power_fill (local.get $hdc) (i32.const 0) (local.get $y)
        (i32.const 320) (i32.add (local.get $y) (i32.const 4))
        (call $power_lerp (i32.const 0x00A0501A) (i32.const 0x00F0C890)
          (i32.div_u (i32.mul (local.get $y) (i32.const 256)) (i32.const 400))))
      (local.set $y (i32.add (local.get $y) (i32.const 4)))
      (br_if $sky (i32.lt_u (local.get $y) (i32.const 400))))
    (call $power_flag (local.get $hdc) (i32.const 128) (i32.const 96))
    (drop (call $gdi_native_set_bk_mode (local.get $hdc) (i32.const 1)))
    ;; The wordmark, bold: shadow first, then white; then who made it.
    (local.set $font (call $power_font (i32.const 20) (i32.const 700)))
    (local.set $old (call $gdi_native_select_object (local.get $hdc) (local.get $font)))
    (drop (call $gdi_native_set_text_color (local.get $hdc) (i32.const 0x00000000)))
    (call $power_text_centred (local.get $hdc) (i32.const 161) (i32.const 175)
      (region.addr $POWER_SCREEN_STRINGS 0x55) (i32.const 13))
    (drop (call $gdi_native_set_text_color (local.get $hdc) (i32.const 0x00FFFFFF)))
    (call $power_text_centred (local.get $hdc) (i32.const 160) (i32.const 174)
      (region.addr $POWER_SCREEN_STRINGS 0x55) (i32.const 13))
    (drop (call $gdi_native_select_object (local.get $hdc) (local.get $old)))
    (drop (call $gdi_native_delete_object (local.get $font)))
    (local.set $font (call $power_font (i32.const 13) (i32.const 400)))
    (local.set $old (call $gdi_native_select_object (local.get $hdc) (local.get $font)))
    (drop (call $gdi_native_set_text_color (local.get $hdc) (i32.const 0x00000000)))
    (call $power_text_centred (local.get $hdc) (i32.const 161) (i32.const 201)
      (region.addr $POWER_SCREEN_STRINGS 0x63) (i32.const 13))
    (drop (call $gdi_native_set_text_color (local.get $hdc) (i32.const 0x00FFFFFF)))
    (call $power_text_centred (local.get $hdc) (i32.const 160) (i32.const 200)
      (region.addr $POWER_SCREEN_STRINGS 0x63) (i32.const 13))
    (drop (call $gdi_native_select_object (local.get $hdc) (local.get $old)))
    (drop (call $gdi_native_delete_object (local.get $font)))
    ;; The line, in the dialog face.
    (local.set $font (call $power_font (i32.const 13) (i32.const 400)))
    (local.set $old (call $gdi_native_select_object (local.get $hdc) (local.get $font)))
    (drop (call $gdi_native_set_text_color (local.get $hdc) (i32.const 0x00000000)))
    (call $power_text_centred (local.get $hdc) (i32.const 161) (i32.const 301)
      (region.addr $POWER_SCREEN_STRINGS 0x00) (i32.const 43))
    (drop (call $gdi_native_set_text_color (local.get $hdc) (i32.const 0x00FFFFFF)))
    (call $power_text_centred (local.get $hdc) (i32.const 160) (i32.const 300)
      (region.addr $POWER_SCREEN_STRINGS 0x00) (i32.const 43))
    (drop (call $gdi_native_select_object (local.get $hdc) (local.get $old)))
    (drop (call $gdi_native_delete_object (local.get $font))))

  ;; A 1px box in the current colour: the footer's two buttons.
  (func $power_box (param $hdc i32) (param $left i32) (param $top i32)
    (param $right i32) (param $bottom i32) (param $color i32)
    (call $power_fill (local.get $hdc) (local.get $left) (local.get $top)
      (local.get $right) (i32.add (local.get $top) (i32.const 1)) (local.get $color))
    (call $power_fill (local.get $hdc) (local.get $left) (i32.sub (local.get $bottom) (i32.const 1))
      (local.get $right) (local.get $bottom) (local.get $color))
    (call $power_fill (local.get $hdc) (local.get $left) (local.get $top)
      (i32.add (local.get $left) (i32.const 1)) (local.get $bottom) (local.get $color))
    (call $power_fill (local.get $hdc) (i32.sub (local.get $right) (i32.const 1)) (local.get $top)
      (local.get $right) (local.get $bottom) (local.get $color)))

  ;; LOGOS.SYS: two orange lines on black. With $footer, the bottom of the
  ;; picture also carries a thank-you line and two boxed choices in the same
  ;; orange -- Restart at (40,352)-(152,376) and berrry.app at
  ;; (168,352)-(280,376), which lib/shutdown.js hit-tests by those numbers.
  (func $power_paint_off (param $hdc i32) (param $footer i32)
    (local $font i32) (local $old i32)
    (call $power_fill (local.get $hdc) (i32.const 0) (i32.const 0)
      (i32.const 320) (i32.const 400) (i32.const 0x00000000))
    (local.set $font (call $power_font (i32.const 20) (i32.const 700)))
    (local.set $old (call $gdi_native_select_object (local.get $hdc) (local.get $font)))
    (drop (call $gdi_native_set_bk_mode (local.get $hdc) (i32.const 1)))
    (drop (call $gdi_native_set_text_color (local.get $hdc) (i32.const 0x003A9CF4)))
    (call $power_text_centred (local.get $hdc) (i32.const 160) (i32.const 176)
      (region.addr $POWER_SCREEN_STRINGS 0x2C) (i32.const 25))
    (call $power_text_centred (local.get $hdc) (i32.const 160) (i32.const 202)
      (region.addr $POWER_SCREEN_STRINGS 0x46) (i32.const 14))
    (drop (call $gdi_native_select_object (local.get $hdc) (local.get $old)))
    (drop (call $gdi_native_delete_object (local.get $font)))
    (if (local.get $footer)
      (then
        ;; The thank-you, in a dimmer orange, plain face.
        (local.set $font (call $power_font (i32.const 13) (i32.const 400)))
        (local.set $old (call $gdi_native_select_object (local.get $hdc) (local.get $font)))
        (drop (call $gdi_native_set_text_color (local.get $hdc) (i32.const 0x00245E92)))
        (call $power_text_centred (local.get $hdc) (i32.const 160) (i32.const 326)
          (region.addr $POWER_SCREEN_STRINGS 0x71) (i32.const 33))
        (drop (call $gdi_native_select_object (local.get $hdc) (local.get $old)))
        (drop (call $gdi_native_delete_object (local.get $font)))
        ;; The two choices, boxed, bold, in the screen's own orange.
        (local.set $font (call $power_font (i32.const 13) (i32.const 700)))
        (local.set $old (call $gdi_native_select_object (local.get $hdc) (local.get $font)))
        (drop (call $gdi_native_set_text_color (local.get $hdc) (i32.const 0x003A9CF4)))
        (call $power_box (local.get $hdc) (i32.const 40) (i32.const 352)
          (i32.const 152) (i32.const 376) (i32.const 0x003A9CF4))
        (call $power_text_centred (local.get $hdc) (i32.const 96) (i32.const 357)
          (region.addr $POWER_SCREEN_STRINGS 0x93) (i32.const 7))
        (call $power_box (local.get $hdc) (i32.const 168) (i32.const 352)
          (i32.const 280) (i32.const 376) (i32.const 0x003A9CF4))
        (call $power_text_centred (local.get $hdc) (i32.const 224) (i32.const 357)
          (region.addr $POWER_SCREEN_STRINGS 0x9B) (i32.const 10))
        (drop (call $gdi_native_select_object (local.get $hdc) (local.get $old)))
        (drop (call $gdi_native_delete_object (local.get $font))))))

  ;; Paint screen $kind (0 shutting down, 1 safe to turn off, 2 the same with
  ;; the what-now footer) and return the
  ;; linear address of its pixels: 320 columns of BGRX, 1280 bytes a row,
  ;; 400 rows top-down. 0 when the DIB could not be made. The bitmap is left
  ;; alive on purpose -- the host reads it and the machine goes down.
  (func $paint_power_screen (param $kind i32) (result i32)
    (local $info_g i32) (local $info i32) (local $hdc i32) (local $bmp i32)
    (local $old i32)
    (local.set $info_g (call $heap_alloc (i32.const 40)))
    (if (i32.eqz (local.get $info_g)) (then (return (i32.const 0))))
    (local.set $info (call $g2w (local.get $info_g)))
    (memory.fill (local.get $info) (i32.const 0) (i32.const 40))
    (i32.store (local.get $info) (i32.const 40))                 ;; biSize
    (i32.store offset=4 (local.get $info) (i32.const 320))       ;; biWidth
    (i32.store offset=8 (local.get $info) (i32.const -400))      ;; biHeight: top-down
    (i32.store16 offset=12 (local.get $info) (i32.const 1))      ;; biPlanes
    (i32.store16 offset=14 (local.get $info) (i32.const 32))     ;; biBitCount
    (local.set $hdc (call $gdi_native_create_compat_dc (i32.const 0)))
    (local.set $bmp (call $gdi_bitmap_create_dib_section
      (local.get $hdc) (local.get $info) (i32.const 0)))
    (call $heap_free (local.get $info_g))
    (if (i32.eqz (local.get $bmp))
      (then
        (drop (call $gdi_native_delete_dc (local.get $hdc)))
        (return (i32.const 0))))
    (local.set $old (call $gdi_native_select_object (local.get $hdc) (local.get $bmp)))
    (if (local.get $kind)
      (then (call $power_paint_off (local.get $hdc) (i32.eq (local.get $kind) (i32.const 2))))
      (else (call $power_paint_wait (local.get $hdc))))
    (drop (call $gdi_native_select_object (local.get $hdc) (local.get $old)))
    (drop (call $gdi_native_delete_dc (local.get $hdc)))
    ;; A DIB section's bits are public by construction, so this is the
    ;; type-checked read of the record's pixel pointer.
    (call $gdi_bitmap_public_bits (local.get $bmp)))

  ;; Class 29. Frame painting and the title-bar-X translation are the same as
  ;; every other WAT-built dialog; what differs is what OK means.
  (func $shelldlg_wndproc
    (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $cmd i32) (local $close i32)
    (local $state i32) (local $state_w i32) (local $len i32) (local $text_g i32)
    (local.set $close (i32.const 0))
    (if (i32.eq (local.get $msg) (i32.const 0x0085))
      (then (call $defwndproc_do_ncpaint (local.get $hwnd)) (return (i32.const 0))))
    ;; Everything on both dialogs is a child that paints itself, except the
    ;; Shut Down dialog's icon, which goes down with the background: the
    ;; erase is the one paint the dialog face itself gets.
    (if (i32.eq (local.get $msg) (i32.const 0x0014))
      (then
        (local.set $cmd (call $host_erase_background (local.get $hwnd) (i32.const 16)))
        (if (i32.eq (global.get $shelldlg_kind) (i32.const 2))
          (then (call $shutdown_dialog_paint_icon (local.get $hwnd))))
        (return (local.get $cmd))))
    (if (i32.eq (local.get $msg) (i32.const 0x0010))
      (then (local.set $close (i32.const 1))))
    (if (i32.and
          (i32.eq (local.get $msg) (i32.const 0x00A1))
          (i32.eq (local.get $wParam) (i32.const 20)))     ;; HTCLOSE
      (then
        (drop (call $wnd_send_message
          (local.get $hwnd) (i32.const 0x0112) (i32.const 0xF060) (i32.const 0)))
        (return (i32.const 0))))
    (if (i32.and
          (i32.eq (local.get $msg) (i32.const 0x0112))
          (i32.eq (i32.and (local.get $wParam) (i32.const 0xFFF0)) (i32.const 0xF060)))
      (then
        (drop (call $wnd_send_message
          (local.get $hwnd) (i32.const 0x0010) (i32.const 0) (i32.const 0)))
        (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0111))
      (then
        (local.set $cmd (i32.and (local.get $wParam) (i32.const 0xFFFF)))
        ;; Cancel, and Browse until there is a file dialog to open from here.
        (if (i32.eq (local.get $cmd) (i32.const 2))
          (then (local.set $close (i32.const 1))))
        (if (i32.eq (local.get $cmd) (i32.const 1))
          (then
            (if (i32.eq (global.get $shelldlg_kind) (i32.const 1))
              (then
                ;; Run: hand the typed command to the same shell-execute path
                ;; ShellExecuteA uses. An EDIT keeps its text pointer at +0 of
                ;; its state block and the length at +4.
                (local.set $state (call $wnd_get_state_ptr (global.get $shelldlg_edit_hwnd)))
                (if (local.get $state)
                  (then
                    (local.set $state_w (call $g2w (local.get $state)))
                    (local.set $len (load.field.memarg EditState text_len (local.get $state_w)))
                    (local.set $text_g (load.field EditState text_buf_ptr (local.get $state_w)))
                    (if (local.get $text_g)
                      (then (if (local.get $len)
                        (then (drop (call $host_shell_execute
                          (global.get $shelldlg_owner)
                          (i32.const 0) (call $g2w (local.get $text_g))
                          (i32.const 0) (i32.const 0) (i32.const 1)))))))))))
            (if (i32.eq (global.get $shelldlg_kind) (i32.const 2))
              (then
                ;; Shut Down: the host powers the machine down (or restarts
                ;; it); this process quits on its own,
                ;; the way every process does when Windows shuts down. Stand
                ;; by is the one option that keeps everything running.
                (local.set $cmd (call $shutdown_dialog_mode))
                (drop (call $host_exit_windows (local.get $cmd)))
                (if (local.get $cmd)
                  (then (global.set $quit_flag (i32.const 1))))))
            (local.set $close (i32.const 1))))))
    (if (local.get $close)
      (then
        (global.set $shelldlg_kind (i32.const 0))
        (global.set $shelldlg_edit_hwnd (i32.const 0))
        (global.set $shelldlg_option0 (i32.const 0))
        (call $wnd_destroy_tree (local.get $hwnd))
        (call $host_destroy_window (local.get $hwnd))
        (return (i32.const 0))))
    (i32.const 0))
