  ;; ============================================================
  ;; Open / Save common dialog (control class 12)
  ;; ============================================================
  ;;
  ;; Built by $create_open_dialog (called from $handle_GetOpenFileNameA
  ;; and $handle_GetSaveFileNameA — same UI, different title + button
  ;; label + IDOK semantics). Children:
  ;;
  ;;   id 0xFFFF "Look in:" static
  ;;   id 0x440  current-directory edit (read-only, displays current path)
  ;;   id 0x441  file listbox (LB_ADDSTRING-populated from fs_find_*)
  ;;   id 0xFFFF "File name:" static
  ;;   id 0x442  filename edit
  ;;   id 0xFFFF "Files of type:" static (when OFN.lpstrFilter exists)
  ;;   id 0x445  filter combobox (when OFN.lpstrFilter exists)
  ;;   id 1      Open / Save button (IDOK)
  ;;   id 2      Cancel button (IDCANCEL)
  ;;
  ;; Userdata stores the guest OFN ptr so the OK handler can write back
  ;; the chosen filename to OFN.lpstrFile.
  ;;
  ;; OPENFILENAME (offsets we touch):
  ;;   +0x00  lStructSize
  ;;   +0x04  hwndOwner
  ;;   +0x0C  lpstrFilter
  ;;   +0x18  nFilterIndex     — 1-based selected filter
  ;;   +0x1C  lpstrFile        — guest ptr to writable buffer
  ;;   +0x20  nMaxFile         — capacity
  ;;   +0x24  lpstrFileTitle
  ;;   +0x28  nMaxFileTitle
  ;;   +0x2C  lpstrInitialDir
  ;;   +0x30  lpstrTitle

  ;; ---- File-type filter ----
  ;;
  ;; "Files of type" decides which files the list shows; directories are
  ;; always listed so the user can still navigate. The pattern is found from
  ;; state every instance shares — the filter combo's selection and the OFN
  ;; pointer in the dialog's userdata — because a renderer shadow can repaint
  ;; the list with none of the owning instance's globals.

  ;; Character $i of a filter string, ASCII-folded to lower case; 0 past the
  ;; end. ';' also ends one pattern of a "*.bmp;*.dib" list.
  (func $opendlg_pat_char (param $pat_g i32) (param $i i32) (param $wide i32) (result i32)
    (local $c i32)
    (local.set $c
      (if (result i32) (local.get $wide)
        (then (i32.load16_u (call $g2w (i32.add (local.get $pat_g) (i32.shl (local.get $i) (i32.const 1))))))
        (else (i32.load8_u (call $g2w (i32.add (local.get $pat_g) (local.get $i)))))))
    (if (i32.eq (local.get $c) (i32.const 0x3B)) (then (return (i32.const 0))))
    (if (i32.and (i32.ge_u (local.get $c) (i32.const 0x41)) (i32.le_u (local.get $c) (i32.const 0x5A)))
      (then (return (i32.or (local.get $c) (i32.const 0x20)))))
    (local.get $c))

  ;; Does the NUL-terminated ANSI name at $name_w match the one pattern that
  ;; starts at $pat_g? '*' is any run, '?' any one character, case-folded.
  ;; "*.*" is every file, with or without a dot, as it is on Windows.
  (func $opendlg_wild_match (param $name_w i32) (param $pat_g i32) (param $wide i32) (result i32)
    (local $n i32) (local $p i32) (local $star i32) (local $mark i32)
    (local $nc i32) (local $pc i32)
    (if (i32.and
          (i32.and (i32.eq (call $opendlg_pat_char (local.get $pat_g) (i32.const 0) (local.get $wide)) (i32.const 0x2A))
                   (i32.eq (call $opendlg_pat_char (local.get $pat_g) (i32.const 1) (local.get $wide)) (i32.const 0x2E)))
          (i32.and (i32.eq (call $opendlg_pat_char (local.get $pat_g) (i32.const 2) (local.get $wide)) (i32.const 0x2A))
                   (i32.eqz (call $opendlg_pat_char (local.get $pat_g) (i32.const 3) (local.get $wide)))))
      (then (return (i32.const 1))))
    (local.set $star (i32.const -1))
    (block $done (loop $step
      (local.set $nc (i32.load8_u (i32.add (local.get $name_w) (local.get $n))))
      (br_if $done (i32.eqz (local.get $nc)))
      (if (i32.and (i32.ge_u (local.get $nc) (i32.const 0x41)) (i32.le_u (local.get $nc) (i32.const 0x5A)))
        (then (local.set $nc (i32.or (local.get $nc) (i32.const 0x20)))))
      (local.set $pc (call $opendlg_pat_char (local.get $pat_g) (local.get $p) (local.get $wide)))
      (if (i32.eq (local.get $pc) (i32.const 0x2A))
        (then
          (local.set $star (local.get $p))
          (local.set $mark (local.get $n))
          (local.set $p (i32.add (local.get $p) (i32.const 1)))
          (br $step)))
      (if (i32.and (i32.ne (local.get $pc) (i32.const 0))
                   (i32.or (i32.eq (local.get $pc) (i32.const 0x3F))
                           (i32.eq (local.get $pc) (local.get $nc))))
        (then
          (local.set $n (i32.add (local.get $n) (i32.const 1)))
          (local.set $p (i32.add (local.get $p) (i32.const 1)))
          (br $step)))
      (if (i32.lt_s (local.get $star) (i32.const 0)) (then (return (i32.const 0))))
      (local.set $p (i32.add (local.get $star) (i32.const 1)))
      (local.set $mark (i32.add (local.get $mark) (i32.const 1)))
      (local.set $n (local.get $mark))
      (br $step)))
    (block $tail (loop $stars
      (br_if $tail (i32.ne (call $opendlg_pat_char (local.get $pat_g) (local.get $p) (local.get $wide))
                           (i32.const 0x2A)))
      (local.set $p (i32.add (local.get $p) (i32.const 1)))
      (br $stars)))
    (i32.eqz (call $opendlg_pat_char (local.get $pat_g) (local.get $p) (local.get $wide))))

  ;; Match against every ';'-separated pattern of a filter's pattern string.
  ;; Spaces after a ';' are skipped ("*.bmp; *.dib").
  (func $opendlg_name_matches (param $name_w i32) (param $pat_g i32) (param $wide i32) (result i32)
    (local $i i32) (local $c i32) (local $unit i32)
    (local.set $unit (select (i32.const 2) (i32.const 1) (local.get $wide)))
    (block $done (loop $each
      (if (call $opendlg_wild_match (local.get $name_w)
            (i32.add (local.get $pat_g) (i32.mul (local.get $i) (local.get $unit))) (local.get $wide))
        (then (return (i32.const 1))))
      ;; Advance past this pattern's ';', or stop at the terminator.
      (block $next (loop $scan
        (local.set $c
          (if (result i32) (local.get $wide)
            (then (i32.load16_u (call $g2w (i32.add (local.get $pat_g) (i32.shl (local.get $i) (i32.const 1))))))
            (else (i32.load8_u (call $g2w (i32.add (local.get $pat_g) (local.get $i)))))))
        (br_if $done (i32.eqz (local.get $c)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br_if $next (i32.eq (local.get $c) (i32.const 0x3B)))
        (br $scan)))
      (block $trimmed (loop $spaces
        (br_if $trimmed (i32.ne (call $opendlg_pat_char (local.get $pat_g) (local.get $i) (local.get $wide))
                                (i32.const 0x20)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $spaces)))
      (br $each)))
    (i32.const 0))

  ;; The pattern string of the filter the dialog currently shows, or 0 when
  ;; there is no filter list (every file is listed). High bit of the result
  ;; set means the string is UTF-16, from a wide OPENFILENAMEW.
  (func $opendlg_current_pattern (param $dlg i32) (result i32)
    (local $ofn i32) (local $wide i32) (local $unit i32) (local $p_g i32)
    (local $cb i32) (local $sel i32) (local $k i32)
    (local.set $ofn (call $wnd_get_userdata (local.get $dlg)))
    (local.set $wide (i32.lt_s (local.get $ofn) (i32.const 0)))
    (local.set $ofn (i32.and (local.get $ofn) (i32.const 0x7FFFFFFF)))
    (if (i32.eqz (local.get $ofn)) (then (return (i32.const 0))))
    (local.set $p_g (call $gl32 (i32.add (local.get $ofn) (i32.const 12))))
    (if (i32.eqz (local.get $p_g)) (then (return (i32.const 0))))
    (local.set $cb (call $ctrl_find_by_id (local.get $dlg) (i32.const 0x445)))
    (if (i32.eqz (local.get $cb)) (then (return (i32.const 0))))
    (local.set $sel (call $wnd_send_message (local.get $cb) (i32.const 0x0147) (i32.const 0) (i32.const 0)))
    (if (i32.lt_s (local.get $sel) (i32.const 0)) (then (return (i32.const 0))))
    (local.set $unit (select (i32.const 2) (i32.const 1) (local.get $wide)))
    ;; Pair $sel is display string 2*sel; its pattern is string 2*sel+1.
    (local.set $k (i32.add (i32.shl (local.get $sel) (i32.const 1)) (i32.const 1)))
    (block $found (loop $skip
      (br_if $found (i32.eqz (local.get $k)))
      (if (i32.eqz
            (if (result i32) (local.get $wide)
              (then (i32.load16_u (call $g2w (local.get $p_g))))
              (else (i32.load8_u (call $g2w (local.get $p_g))))))
        (then (return (i32.const 0))))
      (block $end (loop $chars
        (br_if $end (i32.eqz
          (if (result i32) (local.get $wide)
            (then (i32.load16_u (call $g2w (local.get $p_g))))
            (else (i32.load8_u (call $g2w (local.get $p_g)))))))
        (local.set $p_g (i32.add (local.get $p_g) (local.get $unit)))
        (br $chars)))
      (local.set $p_g (i32.add (local.get $p_g) (local.get $unit)))
      (local.set $k (i32.sub (local.get $k) (i32.const 1)))
      (br $skip)))
    (i32.or (local.get $p_g) (i32.shl (local.get $wide) (i32.const 31))))

  ;; ---- Listbox population helper ----
  ;;
  ;; Walks fs_find_first_file/next from a given pattern (e.g. "C:\*"),
  ;; LB_ADDSTRINGs each entry, prepending "[" and appending "]" for
  ;; directories so they sort first visually. Adds ".." as the first
  ;; entry unconditionally so the user can navigate up.
  ;;
  ;; Uses heap allocations (below) for the WIN32_FIND_DATA
  ;; (320 bytes) plus a temporary 280-byte string slot for the bracketed
  ;; directory entry.
  (func $opendlg_populate_listbox (param $lb i32) (param $pattern_g i32)
    (local $find_handle i32) (local $fd_g i32) (local $fd_w i32)
    (local $name_g i32) (local $name_w i32) (local $attrs i32)
    (local $tmp_g i32) (local $tmp_w i32) (local $name_len i32)
    (local $pat i32) (local $pat_wide i32)
    (local.set $pat (call $opendlg_current_pattern (call $wnd_get_parent (local.get $lb))))
    (local.set $pat_wide (i32.lt_s (local.get $pat) (i32.const 0)))
    (local.set $pat (i32.and (local.get $pat) (i32.const 0x7FFFFFFF)))
    ;; An empty pattern string is a malformed list; show everything.
    (if (local.get $pat)
      (then
        (if (i32.eqz (call $opendlg_pat_char (local.get $pat) (i32.const 0) (local.get $pat_wide)))
          (then (local.set $pat (i32.const 0))))))
    ;; Reset listbox first.
    (drop (call $wnd_send_message (local.get $lb) (i32.const 0x0184) (i32.const 0) (i32.const 0)))
    ;; Add ".." entry as the first row so the user can navigate up.
    ;; Skipped at the C:\ root (where ".." has no meaningful target) so
    ;; the listbox doesn't show a no-op entry.
    (if (i32.gt_u (call $strlen (call $g2w (global.get $opendlg_current_dir))) (i32.const 3))
      (then
        (drop (call $wnd_send_message (local.get $lb) (i32.const 0x0180) (i32.const 0)
                (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x66) (i32.const 2))))))
    ;; FIND_DATA buffer + tmp string buffer in heap.
    (local.set $fd_g (call $heap_alloc (i32.const 320)))
    (local.set $fd_w (call $g2w (local.get $fd_g)))
    (local.set $tmp_g (call $heap_alloc (i32.const 280)))
    (local.set $tmp_w (call $g2w (local.get $tmp_g)))
    (local.set $find_handle (call $host_fs_find_first_file
      (call $g2w (local.get $pattern_g)) (local.get $fd_g) (i32.const 0)))
    (if (i32.eq (local.get $find_handle) (i32.const -1))
      (then
        (call $heap_free (local.get $tmp_g))
        (call $heap_free (local.get $fd_g))
        (return)))
    (block $done (loop $next
      ;; Skip "." and ".."
      (local.set $name_w (i32.add (local.get $fd_w) (i32.const 44)))
      (local.set $attrs (i32.load (local.get $fd_w)))
      (if (i32.eqz (i32.and
              (i32.eq (i32.load8_u (local.get $name_w)) (i32.const 46))   ;; '.'
              (i32.or (i32.eqz (i32.load8_u (i32.add (local.get $name_w) (i32.const 1))))
                      (i32.and (i32.eq (i32.load8_u (i32.add (local.get $name_w) (i32.const 1))) (i32.const 46))
                               (i32.eqz (i32.load8_u (i32.add (local.get $name_w) (i32.const 2))))))))
        (then
          (if (i32.and (local.get $attrs) (i32.const 0x10))
            (then
              ;; Directory: render as "[name]" so it sorts/looks distinct.
              (local.set $name_len (call $strlen (local.get $name_w)))
              (i32.store8 (local.get $tmp_w) (i32.const 0x5B))  ;; '['
              (call $memcpy (i32.add (local.get $tmp_w) (i32.const 1))
                            (local.get $name_w) (local.get $name_len))
              (i32.store8 (i32.add (local.get $tmp_w) (i32.add (local.get $name_len) (i32.const 1)))
                          (i32.const 0x5D))  ;; ']'
              (i32.store8 (i32.add (local.get $tmp_w) (i32.add (local.get $name_len) (i32.const 2)))
                          (i32.const 0))
              (drop (call $wnd_send_message (local.get $lb) (i32.const 0x0180) (i32.const 0)
                      (local.get $tmp_g))))
            (else
              ;; File: add as-is via the FIND_DATA's cFileName guest ptr,
              ;; when it is of the type the filter combo names.
              (if (i32.or (i32.eqz (local.get $pat))
                          (call $opendlg_name_matches (local.get $name_w)
                            (local.get $pat) (local.get $pat_wide)))
                (then
                  (drop (call $wnd_send_message (local.get $lb) (i32.const 0x0180) (i32.const 0)
                          (i32.add (local.get $fd_g) (i32.const 44))))))))))
      (br_if $done (i32.eqz (call $host_fs_find_next_file
                              (local.get $find_handle) (local.get $fd_g) (i32.const 0))))
      (br $next)))
    (drop (call $host_fs_find_close (local.get $find_handle)))
    (call $heap_free (local.get $tmp_g))
    (call $heap_free (local.get $fd_g)))

  ;; Populate the common-dialog filter combobox from OPENFILENAME.lpstrFilter.
  ;; The filter buffer is a double-NUL-terminated sequence of display/pattern
  ;; pairs: "Rich Text Format\0*.rtf\0Text Document\0*.txt\0\0". The combobox
  ;; shows only display strings and mirrors OPENFILENAME.nFilterIndex, which is
  ;; 1-based in Win32.
  (func $opendlg_populate_filter_combo (param $cb i32) (param $ofn i32)
    (local $ofn_w i32) (local $filter_g i32) (local $p_g i32) (local $p_w i32)
    (local $slen i32) (local $count i32) (local $sel i32) (local $label_g i32)
    (if (i32.or (i32.eqz (local.get $cb)) (i32.eqz (local.get $ofn)))
      (then (return)))
    (local.set $ofn_w (call $g2w (local.get $ofn)))
    (local.set $filter_g (i32.load offset=12 (local.get $ofn_w)))
    (if (i32.eqz (local.get $filter_g)) (then (return)))
    (local.set $p_g (local.get $filter_g))
    (local.set $p_w (call $g2w (local.get $p_g)))
    (local.set $count (i32.const 0))
    (block $done (loop $scan
      ;; Empty display string marks the double-NUL terminator.
      (br_if $done
        (if (result i32) (global.get $opendlg_wide)
          (then (i32.eqz (i32.load16_u (local.get $p_w))))
          (else (i32.eqz (i32.load8_u (local.get $p_w))))))
      (if (global.get $opendlg_wide)
        (then
          (local.set $slen (call $guest_wcslen (local.get $p_g)))
          (local.set $label_g (call $heap_alloc (i32.add (local.get $slen) (i32.const 1))))
          (drop (call $wide_to_ansi (local.get $p_g) (local.get $label_g)
                  (i32.add (local.get $slen) (i32.const 1))))
          (drop (call $wnd_send_message (local.get $cb) (i32.const 0x0143)
                  (i32.const 0) (local.get $label_g)))
          (call $heap_free (local.get $label_g)))
        (else
          (drop (call $wnd_send_message (local.get $cb) (i32.const 0x0143)
                  (i32.const 0) (local.get $p_g)))))
      (local.set $count (i32.add (local.get $count) (i32.const 1)))
      ;; Skip display string.
      (local.set $slen
        (if (result i32) (global.get $opendlg_wide)
          (then (call $guest_wcslen (local.get $p_g)))
          (else (call $strlen (local.get $p_w)))))
      (local.set $p_g (i32.add (local.get $p_g)
        (if (result i32) (global.get $opendlg_wide)
          (then (i32.shl (i32.add (local.get $slen) (i32.const 1)) (i32.const 1)))
          (else (i32.add (local.get $slen) (i32.const 1))))))
      (local.set $p_w (call $g2w (local.get $p_g)))
      ;; Skip pattern string. Malformed filter lists with a missing pattern end
      ;; at the same double-NUL sentinel on the next loop.
      (local.set $slen
        (if (result i32) (global.get $opendlg_wide)
          (then (call $guest_wcslen (local.get $p_g)))
          (else (call $strlen (local.get $p_w)))))
      (local.set $p_g (i32.add (local.get $p_g)
        (if (result i32) (global.get $opendlg_wide)
          (then (i32.shl (i32.add (local.get $slen) (i32.const 1)) (i32.const 1)))
          (else (i32.add (local.get $slen) (i32.const 1))))))
      (local.set $p_w (call $g2w (local.get $p_g)))
      (br $scan)))
    (if (i32.eqz (local.get $count)) (then (return)))
    (local.set $sel (i32.load offset=24 (local.get $ofn_w))) ;; nFilterIndex, 1-based
    (if (i32.or (i32.eqz (local.get $sel)) (i32.gt_u (local.get $sel) (local.get $count)))
      (then (local.set $sel (i32.const 1))))
    (drop (call $wnd_send_message (local.get $cb) (i32.const 0x014E) ;; CB_SETCURSEL
            (i32.sub (local.get $sel) (i32.const 1)) (i32.const 0))))

  ;; Absolute filename edit text must not receive the displayed directory.
  ;; These EditState bytes are internally allocated, not a caller guest span.
  (func $opendlg_path_absolute (param $p i32) (param $len i32) (result i32)
    (local $c i32)
    (if (i32.ge_u (local.get $len) (i32.const 2))
      (then
        (if (i32.and
              (i32.or (i32.eq (i32.load8_u (local.get $p)) (i32.const 92))
                      (i32.eq (i32.load8_u (local.get $p)) (i32.const 47)))
              (i32.or (i32.eq (i32.load8_u offset=1 (local.get $p)) (i32.const 92))
                      (i32.eq (i32.load8_u offset=1 (local.get $p)) (i32.const 47))))
          (then (return (i32.const 1))))))
    (if (i32.ge_u (local.get $len) (i32.const 3))
      (then
        (local.set $c (i32.or (i32.load8_u (local.get $p)) (i32.const 32)))
        (if (i32.and
              (i32.and (i32.ge_u (local.get $c) (i32.const 97))
                       (i32.le_u (local.get $c) (i32.const 122)))
              (i32.and (i32.eq (i32.load8_u offset=1 (local.get $p)) (i32.const 58))
                (i32.or (i32.eq (i32.load8_u offset=2 (local.get $p)) (i32.const 92))
                        (i32.eq (i32.load8_u offset=2 (local.get $p)) (i32.const 47)))))
          (then (return (i32.const 1))))))
    (i32.const 0))

  ;; ---- Open dialog wndproc ----
  (func $opendlg_wndproc
    (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $cmd i32) (local $notif i32) (local $ofn i32) (local $ofn_w i32)
    (local $edit_h i32) (local $edit_state i32) (local $edit_sw ptr<EditState>)
    (local $dir_h i32) (local $dir_state i32) (local $dir_sw ptr<EditState>)
    (local $text_len i32) (local $text_src_w i32)
    (local $dir_len i32) (local $dir_src_w i32) (local $sep_len i32)
    (local $path_g i32) (local $path_w i32) (local $path_len i32)
    (local $file_offset i32) (local $extension_offset i32) (local $i i32) (local $path_char i32)
    (local $dst_g i32) (local $dst_w i32) (local $max_len i32)
    (local $required_w i32) (local $is_wide i32)
    (local $filter_cb i32) (local $filter_sel i32)

    (if (i32.eq (local.get $msg) (i32.const 0x0085))   ;; WM_NCPAINT
      (then (call $defwndproc_do_ncpaint (local.get $hwnd)) (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0014))   ;; WM_ERASEBKGND
      (then (return (call $host_erase_background (local.get $hwnd) (i32.const 16)))))

    ;; ---- WM_CLOSE → Cancel ----
    (if (i32.eq (local.get $msg) (i32.const 0x0010))
      (then
        (call $modal_done (i32.const 0))
        (return (i32.const 0))))

    (if (i32.ne (local.get $msg) (i32.const 0x0111))  ;; only WM_COMMAND past here
      (then (return (i32.const 0))))

    (local.set $cmd   (i32.and (local.get $wParam) (i32.const 0xFFFF)))
    (local.set $notif (i32.shr_u (local.get $wParam) (i32.const 16)))

    ;; ---- Cancel ----
    (if (i32.eq (local.get $cmd) (i32.const 2))
      (then
        (call $modal_done (i32.const 0))
        (return (i32.const 0))))

    ;; ---- Files of type changed: list the directory again under it ----
    ;; The directory comes from the path edit, which every instance shares.
    (if (i32.and (i32.eq (local.get $cmd) (i32.const 0x445))
                 (i32.eq (local.get $notif) (i32.const 1)))   ;; CBN_SELCHANGE
      (then
        (local.set $dir_h (call $ctrl_find_by_id (local.get $hwnd) (i32.const 0x440)))
        (if (local.get $dir_h)
          (then
            (local.set $path_g (call $heap_alloc (i32.const 280)))
            (call $gs8 (local.get $path_g) (i32.const 0))
            (drop (call $wnd_send_message (local.get $dir_h) (i32.const 0x000D)
                    (i32.const 280) (local.get $path_g)))
            (if (call $gl8 (local.get $path_g))
              (then (call $opendlg_set_dir (local.get $hwnd) (local.get $path_g))))
            (call $heap_free (local.get $path_g))))
        (return (i32.const 0))))

    ;; ---- OK / Open / Save: copy filename edit text into OFN.lpstrFile ----
    (if (i32.eq (local.get $cmd) (i32.const 1))
      (then
        ;; The dialog can be clicked in the renderer shadow while the parked
        ;; API call belongs to a guest Worker. Keep the A/W bit beside the OFN
        ;; pointer in shared window memory instead of consulting the shadow's
        ;; private $opendlg_wide global.
        (local.set $ofn (call $wnd_get_userdata (local.get $hwnd)))
        (local.set $is_wide (i32.lt_s (local.get $ofn) (i32.const 0)))
        (local.set $ofn (i32.and (local.get $ofn) (i32.const 0x7FFFFFFF)))
        (if (i32.eqz (local.get $ofn))
          (then (call $modal_done (i32.const 0)) (return (i32.const 0))))
        (local.set $ofn_w (call $g2w (local.get $ofn)))
        (local.set $dst_g (i32.load offset=28 (local.get $ofn_w)))         ;; lpstrFile
        (local.set $max_len (i32.load offset=32 (local.get $ofn_w)))       ;; nMaxFile
        (local.set $edit_h (call $ctrl_find_by_id (local.get $hwnd) (i32.const 0x442)))
        ;; i32.and is bitwise: must coerce $dst_g and $edit_h pointers to 0/1
        ;; (their bit 0 is normally clear and would zero the AND silently).
        (if (i32.and
              (i32.and (i32.ne (local.get $dst_g) (i32.const 0))
                       (i32.gt_u (local.get $max_len) (i32.const 0)))
              (i32.ne (local.get $edit_h) (i32.const 0)))
          (then
            (local.set $edit_state (call $wnd_get_state_ptr (local.get $edit_h)))
            (if (local.get $edit_state)
              (then
                (local.set $edit_sw (cast ptr<EditState> (call $g2w (local.get $edit_state))))
                (local.set $text_len (load.field.memarg EditState text_len (local.get $edit_sw)))
                (if (load.field EditState text_buf_ptr (local.get $edit_sw))
                  (then (local.set $text_src_w
                    (call $g2w (load.field EditState text_buf_ptr (local.get $edit_sw))))))
                ;; The edit may hold a leaf, relative path, or absolute path.
                ;; Successful lpstrFile is the full path. Read the
                ;; displayed current directory from shared EditState rather
                ;; than $opendlg_current_dir: a renderer shadow accepting a
                ;; Worker-owned modal has private globals but shared controls.
                (local.set $dir_h (call $ctrl_find_by_id (local.get $hwnd) (i32.const 0x440)))
                (if (local.get $dir_h)
                  (then
                    (local.set $dir_state (call $wnd_get_state_ptr (local.get $dir_h)))
                    (if (local.get $dir_state)
                      (then
                        (local.set $dir_sw (cast ptr<EditState> (call $g2w (local.get $dir_state))))
                        (local.set $dir_len (load.field.memarg EditState text_len (local.get $dir_sw)))
                        (if (load.field EditState text_buf_ptr (local.get $dir_sw))
                          (then
                            (local.set $dir_src_w
                              (call $g2w (load.field EditState text_buf_ptr (local.get $dir_sw))))))))))
                (if (i32.and
                      (i32.gt_u (local.get $dir_len) (i32.const 0))
                      (i32.ne (i32.load8_u
                        (i32.add (local.get $dir_src_w) (i32.sub (local.get $dir_len) (i32.const 1))))
                        (i32.const 0x5C)))
                  (then (local.set $sep_len (i32.const 1))))
                (if (call $opendlg_path_absolute (local.get $text_src_w) (local.get $text_len))
                  (then
                    (local.set $dir_len (i32.const 0))
                    (local.set $sep_len (i32.const 0))))
                (local.set $file_offset (i32.add (local.get $dir_len) (local.get $sep_len)))
                (local.set $path_len (i32.add (local.get $file_offset) (local.get $text_len)))
                ;; OPENFILENAME.nMaxFile counts characters including the NUL.
                ;; Never truncate a successful selection: USER's documented
                ;; failure writes the required character count into the first
                ;; two lpstrFile bytes and CommDlgExtendedError reports
                ;; FNERR_BUFFERTOOSMALL. The tagged modal result carries that
                ;; error from a renderer shadow back to the parked guest
                ;; instance without confusing it with an ordinary Cancel.
                (if (i32.ge_u (local.get $path_len) (local.get $max_len))
                  (then
                    (local.set $required_w
                      (call $g2w_affine_span (local.get $dst_g) (i32.const 2)))
                    (if (i32.ne (local.get $required_w) (global.get $NULL_SENTINEL))
                      (then
                        (i32.store16 (local.get $required_w)
                          (i32.add (local.get $path_len) (i32.const 1)))))
                    (call $modal_done (i32.const 0xFFFF3003))
                    (return (i32.const 0))))
                (local.set $path_g (call $heap_alloc (i32.add (local.get $path_len) (i32.const 1))))
                (local.set $path_w (call $g2w (local.get $path_g)))
                (if (local.get $dir_len)
                  (then (call $memcpy (local.get $path_w) (local.get $dir_src_w) (local.get $dir_len))))
                (if (local.get $sep_len)
                  (then (i32.store8 (i32.add (local.get $path_w) (local.get $dir_len)) (i32.const 0x5C))))
                (local.set $dst_w (call $g2w (local.get $dst_g)))
                (if (load.field EditState text_buf_ptr (local.get $edit_sw))
                  (then
                    (local.set $text_src_w (call $g2w (load.field EditState text_buf_ptr (local.get $edit_sw))))
                    (if (local.get $text_len)
                      (then
                        (call $memcpy (i32.add (local.get $path_w) (local.get $file_offset))
                          (local.get $text_src_w) (local.get $text_len))))))
                (i32.store8 (i32.add (local.get $path_w) (local.get $path_len)) (i32.const 0))
                (if (local.get $is_wide)
                  (then
                    (drop (call $ansi_to_wide (local.get $path_g) (local.get $dst_g)
                      (local.get $max_len))))
                  (else
                    (call $memcpy (local.get $dst_w) (local.get $path_w) (local.get $path_len))))
                (if (local.get $is_wide)
                  (then (i32.store16 (i32.add (local.get $dst_w)
                          (i32.shl (local.get $path_len) (i32.const 1))) (i32.const 0)))
                  (else (i32.store8 (i32.add (local.get $dst_w) (local.get $path_len)) (i32.const 0))))
                ;; nFileOffset names the leaf within the returned full path;
                ;; nFileExtension names the first character after the last
                ;; dot, or zero when the leaf has no extension.
                (local.set $file_offset (i32.const 0))
                (local.set $extension_offset (i32.const 0))
                (local.set $i (i32.const 0))
                (block $ext_done (loop $ext_scan
                  (br_if $ext_done (i32.ge_u (local.get $i) (local.get $path_len)))
                  (local.set $path_char (i32.load8_u (i32.add (local.get $path_w) (local.get $i))))
                  (if (i32.or (i32.eq (local.get $path_char) (i32.const 92))
                              (i32.eq (local.get $path_char) (i32.const 47)))
                    (then
                      (local.set $file_offset (i32.add (local.get $i) (i32.const 1)))
                      (local.set $extension_offset (i32.const 0)))
                    (else
                      (if (i32.eq (local.get $path_char) (i32.const 46))
                        (then (local.set $extension_offset (i32.add (local.get $i) (i32.const 1)))))))
                  (local.set $i (i32.add (local.get $i) (i32.const 1)))
                  (br $ext_scan)))
                (i32.store16 offset=56 (local.get $ofn_w) (local.get $file_offset))
                (i32.store16 offset=58 (local.get $ofn_w) (local.get $extension_offset))
                (call $heap_free (local.get $path_g))))))
        (local.set $filter_cb (call $ctrl_find_by_id (local.get $hwnd) (i32.const 0x445)))
        (if (local.get $filter_cb)
          (then
            (local.set $filter_sel (call $wnd_send_message
              (local.get $filter_cb) (i32.const 0x0147) ;; CB_GETCURSEL
              (i32.const 0) (i32.const 0)))
            (if (i32.ge_s (local.get $filter_sel) (i32.const 0))
              (then
                (i32.store offset=24 (local.get $ofn_w)
                  (i32.add (local.get $filter_sel) (i32.const 1)))))))
        (call $modal_done (i32.const 1))
        (return (i32.const 0))))

    ;; ---- Upload (id 0x443) ----
    ;; Trigger native file picker. The dialog stays open; on pick the JS
    ;; side writes the file into VFS and calls $opendlg_refresh_listbox
    ;; (exported below) to repopulate.
    (if (i32.eq (local.get $cmd) (i32.const 0x443))
      (then
        (call $host_pick_file_upload (local.get $hwnd) (global.get $opendlg_current_dir))
        (return (i32.const 0))))

    ;; ---- Download (id 0x444) ----
    ;; Read filename edit, build "C:\<name>", trigger Blob download.
    (if (i32.eq (local.get $cmd) (i32.const 0x444))
      (then
        (call $opendlg_trigger_download (local.get $hwnd))
        (return (i32.const 0))))

    ;; ---- Listbox notifications: id 0x441, LBN_SELCHANGE / LBN_DBLCLK ----
    (if (i32.eq (local.get $cmd) (i32.const 0x441))
      (then
        (if (i32.eq (local.get $notif) (i32.const 2))   ;; LBN_DBLCLK
          (then
            ;; If selection is a directory ([NAME]) or "..", navigate
            ;; instead of triggering IDOK. $opendlg_try_navigate returns
            ;; 1 when it consumed the dblclk by changing dirs.
            (if (i32.eqz (call $opendlg_try_navigate (local.get $hwnd)))
              (then
                (call $opendlg_copy_listbox_to_edit (local.get $hwnd))
                (drop (call $wnd_send_message (local.get $hwnd) (i32.const 0x0111) (i32.const 1) (i32.const 0)))))
            (return (i32.const 0))))
        ;; Plain selection change → copy item text into filename edit.
        (call $opendlg_copy_listbox_to_edit (local.get $hwnd))
        (return (i32.const 0))))

    (i32.const 0))

  ;; Helper: read the listbox's currently-selected item and write it into
  ;; the filename edit (id 0x442). Strips '[' / ']' from directory entries.
  ;; Used by both LBN_SELCHANGE and the IDOK preview.
  (func $opendlg_copy_listbox_to_edit (param $dlg i32)
    (local $lb i32) (local $edit i32) (local $sel i32) (local $buf_g i32)
    (local $buf_w i32) (local $n i32) (local $start i32)
    (local.set $lb   (call $ctrl_find_by_id (local.get $dlg) (i32.const 0x441)))
    (local.set $edit (call $ctrl_find_by_id (local.get $dlg) (i32.const 0x442)))
    (if (i32.or (i32.eqz (local.get $lb)) (i32.eqz (local.get $edit))) (then (return)))
    (local.set $sel (call $wnd_send_message (local.get $lb) (i32.const 0x0188) (i32.const 0) (i32.const 0)))
    (if (i32.lt_s (local.get $sel) (i32.const 0)) (then (return)))
    (local.set $buf_g (call $heap_alloc (i32.const 280)))
    (local.set $buf_w (call $g2w (local.get $buf_g)))
    (local.set $n (call $wnd_send_message (local.get $lb) (i32.const 0x0189)
                    (local.get $sel) (local.get $buf_g)))
    ;; Strip "[...]" wrapper for directory entries
    (local.set $start (local.get $buf_w))
    (if (i32.eq (i32.load8_u (local.get $buf_w)) (i32.const 0x5B))
      (then
        (local.set $start (i32.add (local.get $buf_w) (i32.const 1)))
        (if (i32.gt_u (local.get $n) (i32.const 1))
          (then (i32.store8 (i32.add (local.get $buf_w) (i32.sub (local.get $n) (i32.const 1)))
                            (i32.const 0))))))
    ;; Drop the edit's old text and reload via WM_SETTEXT — pass the
    ;; (possibly start-shifted) buffer as a guest ptr.
    (drop (call $wnd_send_message (local.get $edit) (i32.const 0x000C)
            (i32.const 0)
            (i32.add (local.get $buf_g) (i32.sub (local.get $start) (local.get $buf_w)))))
    (call $heap_free (local.get $buf_g)))

  ;; If the current listbox selection is "[name]" (a directory) or "..",
  ;; navigate the dialog into / out of that directory by updating
  ;; $opendlg_current_dir + repopulating the listbox. Returns 1 if it
  ;; navigated, 0 otherwise (e.g. selection is a regular file).
  (func $opendlg_try_navigate (param $dlg i32) (result i32)
    (local $lb i32) (local $sel i32) (local $buf_g i32) (local $buf_w i32)
    (local $n i32) (local $cur_g i32) (local $cur_w i32) (local $cur_len i32)
    (local $new_g i32) (local $new_w i32) (local $name_len i32) (local $i i32)
    (local.set $lb (call $ctrl_find_by_id (local.get $dlg) (i32.const 0x441)))
    (if (i32.eqz (local.get $lb)) (then (return (i32.const 0))))
    (local.set $sel (call $wnd_send_message (local.get $lb) (i32.const 0x0188) (i32.const 0) (i32.const 0)))
    (if (i32.lt_s (local.get $sel) (i32.const 0)) (then (return (i32.const 0))))
    (local.set $buf_g (call $heap_alloc (i32.const 280)))
    (local.set $buf_w (call $g2w (local.get $buf_g)))
    (local.set $n (call $wnd_send_message (local.get $lb) (i32.const 0x0189) (local.get $sel) (local.get $buf_g)))
    (local.set $cur_g (global.get $opendlg_current_dir))
    (local.set $cur_w (call $g2w (local.get $cur_g)))
    (local.set $cur_len (call $strlen (local.get $cur_w)))
    ;; Case 1: ".." → strip last component (if any). At "C:\" we already
    ;; suppress this entry, so we don't need a special root guard here.
    (if (i32.and (i32.eq (i32.load8_u (local.get $buf_w)) (i32.const 0x2E))
                 (i32.eq (i32.load8_u offset=1 (local.get $buf_w)) (i32.const 0x2E)))
      (then
        ;; Walk back from end past trailing '\\', then strip until next '\\'.
        (local.set $i (i32.sub (local.get $cur_len) (i32.const 1)))
        (if (i32.and (i32.gt_s (local.get $i) (i32.const 0))
                     (i32.eq (i32.load8_u (i32.add (local.get $cur_w) (local.get $i))) (i32.const 0x5C)))
          (then (local.set $i (i32.sub (local.get $i) (i32.const 1)))))
        (block $found (loop $scan
          (br_if $found (i32.le_s (local.get $i) (i32.const 0)))
          (br_if $found (i32.eq (i32.load8_u (i32.add (local.get $cur_w) (local.get $i))) (i32.const 0x5C)))
          (local.set $i (i32.sub (local.get $i) (i32.const 1)))
          (br $scan)))
        ;; Build new dir = cur[0..i+1]   (keep the trailing '\\')
        (local.set $new_g (call $heap_alloc (i32.add (local.get $i) (i32.const 2))))
        (local.set $new_w (call $g2w (local.get $new_g)))
        (call $memcpy (local.get $new_w) (local.get $cur_w) (i32.add (local.get $i) (i32.const 1)))
        (i32.store8 (i32.add (local.get $new_w) (i32.add (local.get $i) (i32.const 1))) (i32.const 0))
        (call $opendlg_set_dir (local.get $dlg) (local.get $new_g))
        (call $heap_free (local.get $new_g))
        (call $heap_free (local.get $buf_g))
        (return (i32.const 1))))
    ;; Case 2: "[name]" → enter subdir. Strip brackets, append "<name>\\".
    (if (i32.eq (i32.load8_u (local.get $buf_w)) (i32.const 0x5B))
      (then
        ;; Trim trailing ']' (n was the count returned from LB_GETTEXT)
        (local.set $name_len (i32.sub (local.get $n) (i32.const 2)))
        ;; New dir = cur + ("\\" if !ends_with_slash) + name + "\\"
        (local.set $new_g (call $heap_alloc (i32.add (i32.add (local.get $cur_len) (local.get $name_len)) (i32.const 3))))
        (local.set $new_w (call $g2w (local.get $new_g)))
        (call $memcpy (local.get $new_w) (local.get $cur_w) (local.get $cur_len))
        (local.set $i (local.get $cur_len))
        (if (i32.ne (i32.load8_u (i32.add (local.get $cur_w) (i32.sub (local.get $cur_len) (i32.const 1)))) (i32.const 0x5C))
          (then
            (i32.store8 (i32.add (local.get $new_w) (local.get $i)) (i32.const 0x5C))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))))
        (call $memcpy (i32.add (local.get $new_w) (local.get $i))
                      (i32.add (local.get $buf_w) (i32.const 1))
                      (local.get $name_len))
        (local.set $i (i32.add (local.get $i) (local.get $name_len)))
        (i32.store8 (i32.add (local.get $new_w) (local.get $i)) (i32.const 0x5C))
        (i32.store8 (i32.add (local.get $new_w) (i32.add (local.get $i) (i32.const 1))) (i32.const 0))
        (call $opendlg_set_dir (local.get $dlg) (local.get $new_g))
        (call $heap_free (local.get $new_g))
        (call $heap_free (local.get $buf_g))
        (return (i32.const 1))))
    (call $heap_free (local.get $buf_g))
    (i32.const 0))

  ;; Set $opendlg_current_dir to a new heap-allocated copy of the
  ;; given guest string, freeing the old one. Updates the path edit
  ;; (id 0x440) and re-populates the listbox via the "<dir>\*" pattern.
  ;; Caller is responsible for the source string lifetime — we copy.
  (func $opendlg_set_dir (param $dlg i32) (param $new_dir_g i32)
    (local $len i32) (local $buf_g i32) (local $buf_w i32)
    (local $pat_g i32) (local $pat_w i32)
    (local $path_edit i32) (local $lb i32)
    (local.set $len (call $strlen (call $g2w (local.get $new_dir_g))))
    (local.set $buf_g (call $guest_strdup (local.get $new_dir_g)))
    (local.set $buf_w (call $g2w (local.get $buf_g)))
    (call $heap_free (global.get $opendlg_current_dir))
    (global.set $opendlg_current_dir (local.get $buf_g))
    ;; Update path edit
    (local.set $path_edit (call $ctrl_find_by_id (local.get $dlg) (i32.const 0x440)))
    (if (local.get $path_edit)
      (then (drop (call $wnd_send_message (local.get $path_edit) (i32.const 0x000C)
              (i32.const 0) (local.get $buf_g)))))
    ;; Build "<dir>\*" pattern for fs_find_first_file. If dir already ends
    ;; with '\\' (root), just append '*'; else append "\\*".
    (local.set $pat_g (call $heap_alloc (i32.add (local.get $len) (i32.const 4))))
    (local.set $pat_w (call $g2w (local.get $pat_g)))
    (call $memcpy (local.get $pat_w) (local.get $buf_w) (local.get $len))
    (if (i32.eq (i32.load8_u (i32.add (local.get $buf_w) (i32.sub (local.get $len) (i32.const 1))))
                (i32.const 0x5C))   ;; ends with '\\'
      (then
        (i32.store8 (i32.add (local.get $pat_w) (local.get $len)) (i32.const 0x2A))   ;; '*'
        (i32.store8 (i32.add (local.get $pat_w) (i32.add (local.get $len) (i32.const 1))) (i32.const 0)))
      (else
        (i32.store8 (i32.add (local.get $pat_w) (local.get $len)) (i32.const 0x5C))   ;; '\\'
        (i32.store8 (i32.add (local.get $pat_w) (i32.add (local.get $len) (i32.const 1))) (i32.const 0x2A))   ;; '*'
        (i32.store8 (i32.add (local.get $pat_w) (i32.add (local.get $len) (i32.const 2))) (i32.const 0))))
    (local.set $lb (call $ctrl_find_by_id (local.get $dlg) (i32.const 0x441)))
    (if (local.get $lb)
      (then (call $opendlg_populate_listbox (local.get $lb) (local.get $pat_g))))
    (call $heap_free (local.get $pat_g))
    (call $invalidate_hwnd (local.get $dlg)))

  ;; Trigger a Blob download for the current filename edit value (if any).
  ;; Builds "C:\<filename>" in a heap buffer and hands the WASM addr to
  ;; $host_file_download which reads the VFS bytes + creates the Blob.
  (func $opendlg_trigger_download (param $dlg i32)
    (local $edit i32) (local $state i32) (local $sw ptr<EditState>)
    (local $name_len i32) (local $name_src_w i32)
    (local $path_g i32) (local $path_w i32)
    (local.set $edit (call $ctrl_find_by_id (local.get $dlg) (i32.const 0x442)))
    (if (i32.eqz (local.get $edit)) (then (return)))
    (local.set $state (call $wnd_get_state_ptr (local.get $edit)))
    (if (i32.eqz (local.get $state)) (then (return)))
    (local.set $sw (cast ptr<EditState> (call $g2w (local.get $state))))
    (local.set $name_len (load.field.memarg EditState text_len (local.get $sw)))
    (if (i32.eqz (local.get $name_len)) (then (return)))
    (local.set $name_src_w (call $g2w (load.field EditState text_buf_ptr (local.get $sw))))
    ;; Buffer = "C:\" + name + "\0"
    (local.set $path_g (call $heap_alloc (i32.add (local.get $name_len) (i32.const 4))))
    (local.set $path_w (call $g2w (local.get $path_g)))
    (i32.store8        (local.get $path_w) (i32.const 0x43))                  ;; 'C'
    (i32.store8 offset=1 (local.get $path_w) (i32.const 0x3A))                 ;; ':'
    (i32.store8 offset=2 (local.get $path_w) (i32.const 0x5C))                 ;; '\\'
    (call $memcpy (i32.add (local.get $path_w) (i32.const 3)) (local.get $name_src_w) (local.get $name_len))
    (i32.store8 (i32.add (local.get $path_w) (i32.add (local.get $name_len) (i32.const 3))) (i32.const 0))
    (call $host_file_download (local.get $path_w))
    (call $heap_free (local.get $path_g)))

  ;; ---- Build the open/save dialog ----
  ;;
  ;;   $kind: 0 = Open, 1 = Save As (controls title + IDOK button label)
  ;;   $ofn:  guest ptr to OPENFILENAME — stashed in dialog userdata so the
  ;;          OK handler can write back lpstrFile.
  (func $create_open_dialog (param $dlg i32) (param $owner i32) (param $kind i32) (param $ofn i32)
    (local $w i32) (local $h i32) (local $title_wa i32) (local $btn_g i32)
    (local $lb i32) (local $ofn_w i32) (local $filter_g i32) (local $filter_cb i32)
    (local.set $w (i32.const 360))
    (local.set $h (i32.const 240))
    ;; Title goes to JS (WASM offset). Button text goes through
    ;; $wat_str_to_heap → guest ptr that ctrl_create_child stores in
    ;; CREATESTRUCT.lpszName for $button_wndproc to read in WM_CREATE.
    (if (i32.eq (local.get $kind) (i32.const 1))
      (then
        (local.set $title_wa (region.addr $USER_DIALOG_STRINGS 0x3C))                                    ;; "Save As"
        (local.set $btn_g   (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x44) (i32.const 4))))  ;; "Save"
      (else
        (local.set $title_wa (region.addr $USER_DIALOG_STRINGS 0x37))                                    ;; "Open"
        (local.set $btn_g   (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x37) (i32.const 4))))) ;; "Open"
    (call $host_register_dialog_frame
      (local.get $dlg) (local.get $owner)
      (local.get $title_wa)
      (local.get $w) (local.get $h)
      (i32.const 1))  ;; isAboutDialog flag (modal indicator) — reused for now
    (call $wnd_table_set (local.get $dlg) (global.get $WNDPROC_CTRL_NATIVE))
    (call $title_table_set (local.get $dlg) (local.get $title_wa)
      (call $strlen (local.get $title_wa)))
    (call $wnd_set_owner (local.get $dlg) (local.get $owner))
    (drop (call $wnd_set_style (local.get $dlg) (i32.const 0x90C80000)))
    (call $ctrl_table_set (call $wnd_table_find (local.get $dlg))
      (i32.const 12) (i32.const 0))
    ;; Match USER's create order: establish the dialog frame/client rect before
    ;; painting the client area or any child controls. Otherwise child-control
    ;; DCs see a zero client offset and draw into the title bar.
    (call $defwndproc_do_nccalcsize (local.get $dlg))
    (call $defwndproc_do_ncpaint (local.get $dlg))
    (call $nc_flags_set (local.get $dlg) (i32.const 3))
    (call $dlg_fill_bkgnd (local.get $dlg))
    ;; Stash the OFN pointer and its A/W spelling in shared window memory. Guest
    ;; pointers live below 0x80000000, so the high bit is a collision-free tag
    ;; that a renderer shadow sees without another fixed memory-map region.
    (drop (call $wnd_set_userdata (local.get $dlg)
      (i32.or (local.get $ofn)
        (i32.shl (global.get $opendlg_wide) (i32.const 31)))))

    ;; "Look in:" static
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 3) (i32.const 0xFFFF)
            (i32.const 12) (i32.const 10) (i32.const 60) (i32.const 16)
            (i32.const 0x50000000)
            (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x54) (i32.const 8))))
    ;; Current directory display (read-only-ish edit at id 0x440)
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 2) (i32.const 0x440)
            (i32.const 76) (i32.const 8) (i32.const 200) (i32.const 18)
            (i32.const 0x50810000)
            (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x62) (i32.const 3))))  ;; "C:\"
    ;; File listbox (id 0x441) — WS_VSCROLL so the scrollbar strip renders.
    (local.set $lb (call $ctrl_create_child (local.get $dlg) (i32.const 4) (i32.const 0x441)
                     (i32.const 12) (i32.const 32) (i32.const 264) (i32.const 130)
                     (i32.const 0x50A10001) (i32.const 0)))
    ;; "File name:" static
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 3) (i32.const 0xFFFF)
            (i32.const 12) (i32.const 168) (i32.const 60) (i32.const 16)
            (i32.const 0x50000000)
            (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x49) (i32.const 10))))
    ;; Filename edit (id 0x442)
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 2) (i32.const 0x442)
            (i32.const 76) (i32.const 166) (i32.const 200) (i32.const 18)
            (i32.const 0x50810000) (i32.const 0)))
    (if (local.get $ofn)
      (then
        (local.set $ofn_w (call $g2w (local.get $ofn)))
        (local.set $filter_g (i32.load offset=12 (local.get $ofn_w)))))
    (if (local.get $filter_g)
      (then
        ;; "Files of type:" static + dropdownlist populated from OFN.lpstrFilter.
        (drop (call $ctrl_create_child (local.get $dlg) (i32.const 3) (i32.const 0xFFFF)
                (i32.const 12) (i32.const 194) (i32.const 80) (i32.const 16)
                (i32.const 0x50000000)
                (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x7C) (i32.const 14))))
        (local.set $filter_cb
          (call $ctrl_create_child (local.get $dlg) (i32.const 5) (i32.const 0x445)
            (i32.const 96) (i32.const 190) (i32.const 180) (i32.const 72)
            (i32.const 0x50010003) (i32.const 0)))
        (call $opendlg_populate_filter_combo (local.get $filter_cb) (local.get $ofn))))
    ;; Open / Save button (id IDOK = 1)
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 1) (i32.const 1)
            (i32.const 286) (i32.const 8) (i32.const 64) (i32.const 22)
            (i32.const 0x50010001)
            (local.get $btn_g)))
    ;; Cancel button (id IDCANCEL = 2)
    (drop (call $ctrl_create_child (local.get $dlg) (i32.const 1) (i32.const 2)
            (i32.const 286) (i32.const 36) (i32.const 64) (i32.const 22)
            (i32.const 0x50010000)
            (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x3) (i32.const 6))))   ;; "Cancel"
    ;; Upload (Open) / Download (Save As) button — only in browser mode.
    ;; Open  → "Upload..." (id 0x443) which triggers a <input type="file">
    ;;         picker, writes the chosen bytes into VFS, refreshes the listbox.
    ;; Save  → "Download" (id 0x444) which writes the VFS bytes for the
    ;;         filename to a Blob and clicks an <a download> link.
    (if (call $host_has_dom)
      (then
        (if (i32.eq (local.get $kind) (i32.const 1))
          (then
            (drop (call $ctrl_create_child (local.get $dlg) (i32.const 1) (i32.const 0x444)
                    (i32.const 286) (i32.const 80) (i32.const 64) (i32.const 22)
                    (i32.const 0x50010000)
                    (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x73) (i32.const 8)))))   ;; "Download"
          (else
            (drop (call $ctrl_create_child (local.get $dlg) (i32.const 1) (i32.const 0x443)
                    (i32.const 286) (i32.const 80) (i32.const 64) (i32.const 22)
                    (i32.const 0x50010000)
                    (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x69) (i32.const 9))))))))   ;; "Upload..."

    ;; Initialize current dir to "C:\\" and populate the listbox via
    ;; $opendlg_set_dir which builds the pattern + path edit too.
    (call $heap_free (global.get $opendlg_current_dir))
    (global.set $opendlg_current_dir (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x62) (i32.const 3)))
    (call $opendlg_populate_listbox (local.get $lb)
      (call $wat_str_to_heap (region.addr $USER_DIALOG_STRINGS 0x5D) (i32.const 4))))
