  ;; ============================================================
  ;; Screen Savers browser (WAT-native applet, control class 35)
  ;; ============================================================
  ;;
  ;; Windows shipped no way to *see* what a machine's screen savers were
  ;; without opening Display Properties, and this emulator shipped no way at
  ;; all: the 19 .SCR files in the registry are reachable only from the
  ;; ?debug picker, so on the normal page they may as well not exist. This is
  ;; the applet that lists them, says what each one is, and starts one.
  ;;
  ;; It is an *applet*, not an emulated program: there is no PE, no x86, and
  ;; no guest message pump. The window and every control in it are the same
  ;; WAT-native ones the Run and ShellAbout dialogs are built from
  ;; ($ctrl_create_child + $host_create_window), the host drives them by
  ;; calling $wat_app_pump once per step, and "Preview" hands the .SCR name
  ;; to the same $host_shell_execute path a guest's ShellExecuteA takes. So
  ;; the shell resolves it against lib/apps.js and boots it as a real guest,
  ;; exactly as if a program had asked.
  ;;
  ;; The catalogue below is static because the .SCR files are not in the VFS
  ;; when this applet runs -- nothing has mounted them yet, which is the
  ;; whole point of the applet. Real Display Properties reads each saver's
  ;; name out of its PE resources; doing that here would mean fetching 19
  ;; files totalling ~8MB to draw one list. The names are the ones those
  ;; binaries carry (VS_VERSION_INFO FileDescription where there is one,
  ;; otherwise the display string in the image itself), so the list says what
  ;; Windows would have said.

  ;; ---- Catalogue ----
  ;; Four NUL-terminated strings per entry: display name, .SCR file name, and
  ;; two description lines (a STATIC does not wrap, so the wrap is authored).
  ;; A fifth empty name terminates the table, so nothing here carries a count
  ;; that can drift from the data.
  (global $SCRSAVE_TEXT i32 (region.addr $SCRSAVE_TEXT 0x000))
  (global $SCRSAVE_TEXT_SIZE i32 (region.size $SCRSAVE_TEXT))

  (data (region.addr $SCRSAVE_TEXT 0x000)
    "Water Waves\00" "WIN98.SCR\00"
      "Ripples the desktop wallpaper under a\00" "moving water surface. (Plus! 98)\00"
    "Organic Art\00" "OASAVER.SCR\00"
      "Computer Artworks' evolving 3-D organisms,\00" "rendered through Direct3D retained mode.\00"
    "Architecture\00" "ARCHITEC.SCR\00"
      "Organic Art scene: a slow fly-through of\00" "an architectural interior.\00"
    "Falling Leaves\00" "FALLINGL.SCR\00"
      "Organic Art scene: textured leaves drift\00" "down across a lit backdrop.\00"
    "Geometry\00" "GEOMETRY.SCR\00"
      "Organic Art scene: rotating geometric\00" "solids over a gradient field.\00"
    "Jazz\00" "JAZZ.SCR\00"
      "Organic Art scene: musical notes tumble\00" "through space.\00"
    "Rock 'n' Roll\00" "ROCKROLL.SCR\00"
      "Organic Art scene: a textured guitar and\00" "pick spin against a stage backdrop.\00"
    "Sci-Fi\00" "SCIFI.SCR\00"
      "Organic Art scene: alien silhouettes over\00" "a science-fiction skyline.\00"
    "Corbis\00" "CORBIS.SCR\00"
      "Plus! 98 theme slide show: sixteen Corbis\00" "photographs, cross-faded.\00"
    "Fashion\00" "FASHION.SCR\00"
      "Plus! 98 theme slide show: thirteen\00" "fashion photographs.\00"
    "Horror\00" "HORROR.SCR\00"
      "Plus! 98 theme slide show: fifteen frames\00" "from the Horror desktop theme.\00"
    "World Traveler\00" "WOTRAVEL.SCR\00"
      "Plus! 98 theme slide show: fourteen\00" "travel photographs.\00"
    "PhotoDisc\00" "PHODISC.SCR\00"
      "Stock-photograph slide show with its own\00" "bundled image library.\00"
    "Walkabout\00" "CITYSCAP.SCR\00"
      "A camera walks a textured city street in\00" "software-rendered 3-D.\00"
    "Cathy\00" "CATHY.SCR\00"
      "Daily comic strip saver: Cathy panels\00" "drawn one frame at a time.\00"
    "Doonesbury\00" "DOONBURY.SCR\00"
      "Daily comic strip saver: Doonesbury\00" "panels drawn one frame at a time.\00"
    "FoxTrot\00" "FOXTROT.SCR\00"
      "Daily comic strip saver: FoxTrot panels\00" "drawn one frame at a time.\00"
    "Garfield\00" "GA_SAVER.SCR\00"
      "Daily comic strip saver: Garfield panels\00" "drawn one frame at a time.\00"
    "Peanuts\00" "PEANUTS.SCR\00"
      "Daily comic strip saver: Peanuts panels\00" "drawn one frame at a time.\00"
    "\00")

  ;; UI strings. Kept beside the catalogue rather than in 01-header.wat's
  ;; shared block so the whole applet is one file.
  (data (region.addr $SCRSAVE_TEXT 0xC00)
    "Screen Savers\00"
    "Screen savers on this machine:\00"
    "Preview\00"
    "Close\00"
    "File:\00")
  ;; One explicit NUL, so "no string" has an address instead of relying on a
  ;; page that merely happens to be zero.
  (data (region.addr $SCRSAVE_TEXT 0xC80) "\00")
  (global $SCRSAVE_S_TITLE  i32 (region.addr $SCRSAVE_TEXT 0xC00))
  (global $SCRSAVE_S_PROMPT i32 (region.addr $SCRSAVE_TEXT 0xC0E))
  (global $SCRSAVE_S_RUN    i32 (region.addr $SCRSAVE_TEXT 0xC2D))
  (global $SCRSAVE_S_CLOSE  i32 (region.addr $SCRSAVE_TEXT 0xC35))
  (global $SCRSAVE_S_FILE   i32 (region.addr $SCRSAVE_TEXT 0xC3B))

  (global $scrsave_hwnd      (mut i32) (i32.const 0))
  (global $scrsave_list      (mut i32) (i32.const 0))
  (global $scrsave_name      (mut i32) (i32.const 0))
  (global $scrsave_file      (mut i32) (i32.const 0))
  (global $scrsave_desc1     (mut i32) (i32.const 0))
  (global $scrsave_desc2     (mut i32) (i32.const 0))
  (global $scrsave_msg       (mut i32) (i32.const 0))  ;; guest MSG scratch
  (global $scrsave_pumping   (mut i32) (i32.const 0))  ;; pump owns MSG until callbacks return
  (global $scrsave_launched  (mut i32) (i32.const 0))  ;; entry index + 1

  ;; Control ids. 0x500 is outside every id range the common dialogs use.
  (global $SCRSAVE_ID_LIST i32 (i32.const 0x500))

  ;; ---- Catalogue walker ----
  ;;
  ;; Returns the address of string $field (0..3) of entry $index, or 0 when
  ;; the index is past the end. Walking beats a pointer table: the data and
  ;; the offsets cannot disagree, which is exactly the failure
  ;; tools/data_offsets.js exists to catch elsewhere.
  (func $scrsave_field (param $index i32) (param $field i32) (result i32)
    (local $p i32) (local $i i32) (local $f i32)
    (if (i32.ge_u (local.get $field) (i32.const 4)) (then (return (i32.const 0))))
    (local.set $p (global.get $SCRSAVE_TEXT))
    (block $found (loop $entries
      ;; An empty name is the end of the table.
      (if (i32.eqz (i32.load8_u (local.get $p))) (then (return (i32.const 0))))
      (br_if $found (i32.eq (local.get $i) (local.get $index)))
      ;; Skip this entry's four strings.
      (local.set $f (i32.const 0))
      (block $skipped (loop $skip
        (br_if $skipped (i32.ge_u (local.get $f) (i32.const 4)))
        (local.set $p (i32.add (i32.add (local.get $p)
          (call $strlen (local.get $p))) (i32.const 1)))
        (local.set $f (i32.add (local.get $f) (i32.const 1)))
        (br $skip)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $entries)))
    ;; Advance to the requested field of the entry we stopped on.
    (local.set $f (i32.const 0))
    (block $at (loop $adv
      (br_if $at (i32.ge_u (local.get $f) (local.get $field)))
      (local.set $p (i32.add (i32.add (local.get $p)
        (call $strlen (local.get $p))) (i32.const 1)))
      (local.set $f (i32.add (local.get $f) (i32.const 1)))
      (br $adv)))
    (local.get $p))

  (func $scrsave_count (export "scrsave_count") (result i32)
    (local $n i32)
    (block $done (loop $scan
      (br_if $done (i32.eqz (call $scrsave_field (local.get $n) (i32.const 0))))
      (local.set $n (i32.add (local.get $n) (i32.const 1)))
      (br $scan)))
    (local.get $n))

  ;; Set a STATIC's caption from a catalogue string. WM_SETTEXT takes a guest
  ;; pointer, and $static_wndproc copies it into the control's own state, so
  ;; the temporary heap block is released straight afterwards.
  (func $scrsave_set_static (param $hwnd i32) (param $wa i32)
    (local $buf i32)
    (if (i32.eqz (local.get $hwnd)) (then (return)))
    (if (i32.eqz (local.get $wa)) (then (local.set $wa (global.get $SCRSAVE_TEXT_EMPTY))))
    (local.set $buf (call $wat_str_to_heap
      (local.get $wa) (call $strlen (local.get $wa))))
    (drop (call $wnd_send_message
      (local.get $hwnd) (i32.const 0x000C) (i32.const 0) (local.get $buf)))
    (call $heap_free (local.get $buf)))

  (global $SCRSAVE_TEXT_EMPTY i32 (region.addr $SCRSAVE_TEXT 0xC80))

  ;; Mirror the listbox selection into the three description statics.
  (func $scrsave_show_selection (param $index i32)
    (call $scrsave_set_static (global.get $scrsave_name)
      (call $scrsave_field (local.get $index) (i32.const 0)))
    (call $scrsave_set_static (global.get $scrsave_file)
      (call $scrsave_field (local.get $index) (i32.const 1)))
    (call $scrsave_set_static (global.get $scrsave_desc1)
      (call $scrsave_field (local.get $index) (i32.const 2)))
    (call $scrsave_set_static (global.get $scrsave_desc2)
      (call $scrsave_field (local.get $index) (i32.const 3))))

  ;; ---- Window construction ----
  ;;
  ;; A real top-level (host_create_window), not a $host_register_dialog_frame
  ;; dialog: this applet is the whole program while it runs, and the host
  ;; stops the process when its last top-level window goes away.
  (func $scrsave_open (export "scrsave_open") (result i32)
    (local $hwnd i32) (local $i i32) (local $n i32) (local $s i32)
    (if (global.get $scrsave_pumping) (then (return (i32.const 0))))
    (if (global.get $scrsave_hwnd) (then (return (global.get $scrsave_hwnd))))
    (global.set $scrsave_msg (call $heap_alloc (i32.const 28)))
    (if (i32.eqz (global.get $scrsave_msg)) (then (return (i32.const 0))))
    (local.set $hwnd (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    ;; Register before the host creates the window: $host_create_window
    ;; composites immediately and the first GDI call on hwnd+0x40000 binds
    ;; the DC state record to an HWND only if that HWND is already in
    ;; WND_RECORDS (see $help_create_window for what an unbound one looks
    ;; like -- a correctly sized window that never shows a pixel).
    (call $wnd_table_set (local.get $hwnd) (global.get $WNDPROC_CTRL_NATIVE))
    (drop (call $wnd_set_style (local.get $hwnd) (i32.const 0x10CF0000)))
    (call $ctrl_table_set (call $wnd_table_find (local.get $hwnd))
      (i32.const 35) (i32.const 0))
    (global.set $scrsave_hwnd (local.get $hwnd))
    (if (i32.eqz (call $host_create_window
      (local.get $hwnd)
      (i32.const 0x10CF0000)      ;; WS_OVERLAPPEDWINDOW | WS_VISIBLE
      (i32.const 64) (i32.const 48) (i32.const 468) (i32.const 322)
      (global.get $SCRSAVE_S_TITLE)
      (i32.const 0)))
      (then (call $scrsave_close) (return (i32.const 0))))
    (call $title_table_set (local.get $hwnd)
      (global.get $SCRSAVE_S_TITLE)
      (call $strlen (global.get $SCRSAVE_S_TITLE)))
    (call $nc_flags_set (local.get $hwnd) (i32.const 3))
    ;; Client geometry has to exist before the first WM_NCPAINT or the frame
    ;; repaint erases the children (the ordering ShellAbout and Run need too).
    (call $defwndproc_do_nccalcsize (local.get $hwnd))
    (call $dlg_fill_bkgnd (local.get $hwnd))
    (call $defwndproc_do_ncpaint (local.get $hwnd))
    ;; Bind the client DC to this window explicitly rather than leaving it to
    ;; whichever paint touches hwnd+0x40000 first.
    (drop (call $gdi_dc_set_field
      (i32.add (local.get $hwnd) (i32.const 0x40000))
      (i32.const 92) (local.get $hwnd) (i32.const 0)))

    ;; Prompt.
    (drop (call $ctrl_create_child (local.get $hwnd) (i32.const 3) (i32.const 0xFFFF)
            (i32.const 12) (i32.const 10) (i32.const 240) (i32.const 14)
            (i32.const 0x50000000)
            (call $wat_str_to_heap (global.get $SCRSAVE_S_PROMPT)
              (call $strlen (global.get $SCRSAVE_S_PROMPT)))))
    ;; The list. LBS_NOTIFY (0x0001) is what makes the selection reach us, and
    ;; WS_VSCROLL (0x00200000) is what makes the entries past the fifteenth
    ;; row reachable at all -- the strip hides itself while everything fits.
    (global.set $scrsave_list
      (call $ctrl_create_child (local.get $hwnd) (i32.const 4)
        (global.get $SCRSAVE_ID_LIST)
        (i32.const 12) (i32.const 28) (i32.const 196) (i32.const 232)
        (i32.const 0x50A10001) (i32.const 0)))
    ;; Detail statics, filled by $scrsave_show_selection.
    (global.set $scrsave_name
      (call $ctrl_create_child (local.get $hwnd) (i32.const 3) (i32.const 0xFFFF)
        (i32.const 220) (i32.const 28) (i32.const 224) (i32.const 16)
        (i32.const 0x50000000) (i32.const 0)))
    (drop (call $ctrl_create_child (local.get $hwnd) (i32.const 3) (i32.const 0xFFFF)
            (i32.const 220) (i32.const 50) (i32.const 34) (i32.const 14)
            (i32.const 0x50000000)
            (call $wat_str_to_heap (global.get $SCRSAVE_S_FILE)
              (call $strlen (global.get $SCRSAVE_S_FILE)))))
    (global.set $scrsave_file
      (call $ctrl_create_child (local.get $hwnd) (i32.const 3) (i32.const 0xFFFF)
        (i32.const 256) (i32.const 50) (i32.const 188) (i32.const 14)
        (i32.const 0x50000000) (i32.const 0)))
    (global.set $scrsave_desc1
      (call $ctrl_create_child (local.get $hwnd) (i32.const 3) (i32.const 0xFFFF)
        (i32.const 220) (i32.const 76) (i32.const 232) (i32.const 14)
        (i32.const 0x50000000) (i32.const 0)))
    (global.set $scrsave_desc2
      (call $ctrl_create_child (local.get $hwnd) (i32.const 3) (i32.const 0xFFFF)
        (i32.const 220) (i32.const 92) (i32.const 232) (i32.const 14)
        (i32.const 0x50000000) (i32.const 0)))
    ;; Preview (IDOK) / Close (IDCANCEL).
    (drop (call $ctrl_create_child (local.get $hwnd) (i32.const 1) (i32.const 1)
            (i32.const 220) (i32.const 234) (i32.const 100) (i32.const 26)
            (i32.const 0x50010001)
            (call $wat_str_to_heap (global.get $SCRSAVE_S_RUN)
              (call $strlen (global.get $SCRSAVE_S_RUN)))))
    (drop (call $ctrl_create_child (local.get $hwnd) (i32.const 1) (i32.const 2)
            (i32.const 332) (i32.const 234) (i32.const 100) (i32.const 26)
            (i32.const 0x50010000)
            (call $wat_str_to_heap (global.get $SCRSAVE_S_CLOSE)
              (call $strlen (global.get $SCRSAVE_S_CLOSE)))))

    ;; Fill the list from the catalogue.
    (local.set $n (call $scrsave_count))
    (block $filled (loop $add
      (br_if $filled (i32.ge_u (local.get $i) (local.get $n)))
      (local.set $s (call $scrsave_field (local.get $i) (i32.const 0)))
      (drop (call $wnd_send_message (global.get $scrsave_list)
        (i32.const 0x0180)   ;; LB_ADDSTRING
        (i32.const 0)
        (call $wat_str_to_heap (local.get $s) (call $strlen (local.get $s)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $add)))
    (drop (call $wnd_send_message (global.get $scrsave_list)
      (i32.const 0x0186) (i32.const 0) (i32.const 0)))   ;; LB_SETCURSEL
    (call $scrsave_show_selection (i32.const 0))
    (call $set_focus (global.get $scrsave_list))
    ;; A guest MSG is 28 bytes; the pump reuses one block for the life of the
    ;; applet rather than allocating per message.
    (global.get $scrsave_hwnd))

  ;; ---- Launching ----
  ;;
  ;; The same host entry point ShellExecuteA reaches, so the page resolves the
  ;; .SCR against lib/apps.js and boots it as a real guest process. "/s" is
  ;; the run-full-screen switch every Windows screen saver takes; the shell
  ;; supplies each app's own registered command line, so this is documentation
  ;; of intent as much as an argument.
  (func $scrsave_preview (param $index i32) (result i32)
    (local $file i32)
    (local.set $file (call $scrsave_field (local.get $index) (i32.const 1)))
    (if (i32.eqz (local.get $file)) (then (return (i32.const 0))))
    (if (i32.le_u (call $host_shell_execute
      (global.get $scrsave_hwnd)
      (i32.const 0)              ;; verb: default ("open")
      (local.get $file)
      (i32.const 0) (i32.const 0)
      (i32.const 1))             ;; SW_SHOWNORMAL
      (i32.const 32))            ;; ShellExecute errors are <= 32.
      (then (return (i32.const 0))))
    (global.set $scrsave_launched (i32.add (local.get $index) (i32.const 1)))
    (i32.const 1))

  ;; Which entry Preview last started, 1-based; 0 = none. The headless test
  ;; reads this instead of trying to observe a second process boot.
  (func $scrsave_last_launched (export "scrsave_last_launched") (result i32)
    (global.get $scrsave_launched))

  (func $scrsave_list_hwnd (export "scrsave_list_hwnd") (result i32)
    (global.get $scrsave_list))

  (func $scrsave_window (export "scrsave_window") (result i32)
    (global.get $scrsave_hwnd))

  ;; ---- Class 35 wndproc ----
  (func $scrsave_wndproc
    (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $cmd i32) (local $notif i32) (local $sel i32)
    (if (i32.eq (local.get $msg) (i32.const 0x0085))       ;; WM_NCPAINT
      (then (call $defwndproc_do_ncpaint (local.get $hwnd)) (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0083))       ;; WM_NCCALCSIZE
      (then (call $defwndproc_do_nccalcsize (local.get $hwnd)) (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0014))       ;; WM_ERASEBKGND
      (then (return (call $host_erase_background (local.get $hwnd) (i32.const 16)))))
    (if (i32.eq (local.get $msg) (i32.const 0x000F))       ;; WM_PAINT
      (then (call $dlg_fill_bkgnd (local.get $hwnd)) (return (i32.const 0))))
    ;; Title-bar X, and the SC_CLOSE it turns into.
    (if (i32.and (i32.eq (local.get $msg) (i32.const 0x00A1))
                 (i32.eq (local.get $wParam) (i32.const 20)))   ;; HTCLOSE
      (then
        (drop (call $wnd_send_message
          (local.get $hwnd) (i32.const 0x0112) (i32.const 0xF060) (i32.const 0)))
        (return (i32.const 0))))
    (if (i32.and (i32.eq (local.get $msg) (i32.const 0x0112))
                 (i32.eq (i32.and (local.get $wParam) (i32.const 0xFFF0))
                         (i32.const 0xF060)))
      (then
        (drop (call $wnd_send_message
          (local.get $hwnd) (i32.const 0x0010) (i32.const 0) (i32.const 0)))
        (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0010))       ;; WM_CLOSE
      (then (call $scrsave_close) (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0111))       ;; WM_COMMAND
      (then
        (local.set $cmd (i32.and (local.get $wParam) (i32.const 0xFFFF)))
        (local.set $notif (i32.shr_u (local.get $wParam) (i32.const 16)))
        (if (i32.eq (local.get $cmd) (global.get $SCRSAVE_ID_LIST))
          (then
            (local.set $sel (call $wnd_send_message (global.get $scrsave_list)
              (i32.const 0x0188) (i32.const 0) (i32.const 0)))   ;; LB_GETCURSEL
            (if (i32.ge_s (local.get $sel) (i32.const 0))
              (then (call $scrsave_show_selection (local.get $sel))))
            ;; LBN_DBLCLK (2) starts the saver, the way double-clicking a
            ;; saver in Display Properties does.
            (if (i32.eq (local.get $notif) (i32.const 2))
              (then (if (i32.ge_s (local.get $sel) (i32.const 0))
                (then (drop (call $scrsave_preview (local.get $sel)))))))
            (return (i32.const 0))))
        (if (i32.eq (local.get $cmd) (i32.const 1))        ;; Preview
          (then
            (local.set $sel (call $wnd_send_message (global.get $scrsave_list)
              (i32.const 0x0188) (i32.const 0) (i32.const 0)))
            (if (i32.ge_s (local.get $sel) (i32.const 0))
              (then (drop (call $scrsave_preview (local.get $sel)))))
            (return (i32.const 0))))
        (if (i32.eq (local.get $cmd) (i32.const 2))        ;; Close
          (then (call $scrsave_close) (return (i32.const 0))))))
    (i32.const 0))

  (func $scrsave_close
    (local $hwnd i32)
    (local.set $hwnd (global.get $scrsave_hwnd))
    (if (i32.eqz (local.get $hwnd)) (then (return)))
    (global.set $scrsave_hwnd (i32.const 0))
    (global.set $scrsave_list (i32.const 0))
    (global.set $scrsave_name (i32.const 0))
    (global.set $scrsave_file (i32.const 0))
    (global.set $scrsave_desc1 (i32.const 0))
    (global.set $scrsave_desc2 (i32.const 0))
    (if (global.get $scrsave_msg)
      (then
        ;; Activation restores the captured MSG after synchronous callbacks.
        ;; The outer pump releases its borrow after all such writes complete.
        (if (i32.eqz (global.get $scrsave_pumping))
          (then (call $heap_free (global.get $scrsave_msg))))
        (global.set $scrsave_msg (i32.const 0))))
    (call $wnd_destroy_tree (local.get $hwnd))
    (call $host_destroy_window (local.get $hwnd))
    (global.set $quit_flag (i32.const 1)))

  ;; ---- Applet message pump ----
  ;;
  ;; An emulated program pumps itself: its GetMessageA calls back into
  ;; $handle_GetMessageA, which is where post-queue drain, paint selection and
  ;; timers live. An applet has no x86 to make that call, so the host calls
  ;; this once per step instead. Ordinary renderer input is queued even for
  ;; native controls. Use the host's process-owned dequeue and focus routing,
  ;; then USER's mouse-activation transaction before native wndproc dispatch.
  ;; Never turn a click directly into a command: BUTTON owns press/cancel/
  ;; release and LISTBOX owns selection and parent notification.
  ;;
  ;; Returns 1 while the applet still owns a window, 0 once it has closed, so
  ;; the host can end the process on the same tick.
  (func $scrsave_pump (export "wat_app_pump") (result i32)
    (local $ptr i32) (local $result i32)
    (if (i32.eqz (global.get $scrsave_hwnd)) (then (return (i32.const 0))))
    ;; A nested pump must not overwrite an in-flight activation transaction.
    (if (global.get $scrsave_pumping) (then (return (i32.const 1))))
    (local.set $ptr (global.get $scrsave_msg))
    (global.set $scrsave_pumping (i32.const 1))
    (local.set $result (call $scrsave_pump_run))
    (global.set $scrsave_pumping (i32.const 0))
    (if (i32.eqz (global.get $scrsave_hwnd))
      (then (call $heap_free (local.get $ptr)) (return (i32.const 0))))
    (local.get $result))

  (func $scrsave_pump_run (result i32)
    (local $guard i32) (local $hwnd i32) (local $target i32)
    (local $packed i32) (local $msg i32) (local $wp i32) (local $lp i32)
    (if (i32.eqz (global.get $scrsave_hwnd)) (then (return (i32.const 0))))
    ;; Bound work per tick without clearing the queue. takeInput can also
    ;; defer an UP until the press has been visible; the next host tick polls
    ;; again. Capture all fields before callbacks or another destructive poll.
    (block $inputs (loop $input
      (br_if $inputs (i32.ge_u (local.get $guard) (i32.const 64)))
      (local.set $packed (call $host_check_input))
      (br_if $inputs (i32.eqz (local.get $packed)))
      (local.set $target (call $host_check_input_hwnd (global.get $focus_hwnd)))
      (if (i32.eqz (local.get $target))
        (then (local.set $target (global.get $scrsave_hwnd))))
      (local.set $msg (i32.and (local.get $packed) (i32.const 0xFFFF)))
      (local.set $wp (call $host_check_input_wparam))
      (local.set $lp (call $host_check_input_lparam))
      (call $gs32 (global.get $scrsave_msg) (local.get $target))
      (call $gs32 (i32.add (global.get $scrsave_msg) (i32.const 4)) (local.get $msg))
      (call $gs32 (i32.add (global.get $scrsave_msg) (i32.const 8)) (local.get $wp))
      (call $gs32 (i32.add (global.get $scrsave_msg) (i32.const 12)) (local.get $lp))
      (call $msg_store_input_tail (global.get $scrsave_msg)
        (local.get $target) (local.get $msg) (local.get $lp))
      (if (i32.eqz (call $message_mouse_activate32 (global.get $scrsave_msg)))
        (then
          (if (i32.eqz (global.get $scrsave_hwnd)) (then (return (i32.const 0))))
          (drop (call $wnd_send_message (local.get $target)
            (local.get $msg) (local.get $wp) (local.get $lp)))))
      ;; Native BN_CLICKED can close synchronously; the outer pump owns MSG.
      (if (i32.eqz (global.get $scrsave_hwnd)) (then (return (i32.const 0))))
      (local.set $guard (i32.add (local.get $guard) (i32.const 1)))
      (br $input)))
    ;; 1. Posted messages. Controls notify their parent with PostMessage, so
    ;;    without this drain a click selects a row and nothing else happens.
    (local.set $guard (i32.const 0))
    (block $posts (loop $post
      (br_if $posts (i32.ge_u (local.get $guard) (i32.const 64)))
      (if (global.get $post_queue_count)
        (then
          (memory.copy (call $g2w (global.get $scrsave_msg))
            (call $post_queue_base) (i32.const 16))
          (global.set $post_queue_count (i32.sub (global.get $post_queue_count) (i32.const 1)))
          (memory.copy (call $post_queue_base)
            (i32.add (call $post_queue_base) (i32.const 16))
            (i32.mul (global.get $post_queue_count) (i32.const 16))))
        (else
          (br_if $posts (i32.eqz (call $shared_post_queue_read
            (global.get $scrsave_msg) (i32.const 1))))))
      (local.set $target (call $gl32 (global.get $scrsave_msg)))
      (if (local.get $target)
        (then (drop (call $wnd_send_message
          (local.get $target)
          (call $gl32 (i32.add (global.get $scrsave_msg) (i32.const 4)))
          (call $gl32 (i32.add (global.get $scrsave_msg) (i32.const 8)))
          (call $gl32 (i32.add (global.get $scrsave_msg) (i32.const 12)))))))
      ;; Close clears the scratch handle; stop before reading it.
      (br_if $posts (i32.eqz (global.get $scrsave_hwnd)))
      (local.set $guard (i32.add (local.get $guard) (i32.const 1)))
      (br $post)))
    (if (i32.eqz (global.get $scrsave_hwnd)) (then (return (i32.const 0))))
    ;; 2. Native control repaints.
    (drop (call $paint_drain_native_control_paints))
    (if (i32.eqz (global.get $scrsave_hwnd)) (then (return (i32.const 0))))
    ;; 3. Whatever is left dirty -- in practice the top-level frame.
    (local.set $guard (i32.const 0))
    (block $paints (loop $paint
      (br_if $paints (i32.ge_u (local.get $guard) (i32.const 32)))
      (local.set $hwnd (call $paint_select_next_dirty))
      (br_if $paints (i32.eqz (local.get $hwnd)))
      (call $paint_flag_clear_hwnd (local.get $hwnd))
      (drop (call $paint_seed_child_paints (local.get $hwnd)))
      (drop (call $update_validate_rect (local.get $hwnd)
        (i32.const 0) (i32.const 0) (i32.const 32767) (i32.const 32767)))
      (drop (call $wnd_send_message
        (local.get $hwnd) (i32.const 0x000F) (i32.const 0) (i32.const 0)))
      (if (i32.eqz (global.get $scrsave_hwnd)) (then (return (i32.const 0))))
      (local.set $guard (i32.add (local.get $guard) (i32.const 1)))
      (br $paint)))
    (i32.const 1))
