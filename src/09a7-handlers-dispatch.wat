  ;; ============================================================
  ;; SUB-DISPATCHERS & MISC LATE-ADDED HANDLERS
  ;; ============================================================

  ;; 702: SetRectEmpty — zeroes out RECT
  (func $handle_SetRectEmpty (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32)
    (local.set $wa (call $g2w (local.get $arg0)))
    ;; Zero out RECT at arg0: left, top, right, bottom = 0
    (i32.store (local.get $wa) (i32.const 0))
    (i32.store offset=4 (local.get $wa) (i32.const 0))
    (i32.store offset=8 (local.get $wa) (i32.const 0))
    (i32.store offset=12 (local.get $wa) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))) ;; stdcall 1 param
  )

  ;; 703: SetRect — stores left, top, right, bottom into RECT
  (func $handle_SetRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32)
    (local.set $wa (call $g2w (local.get $arg0)))
    ;; Store left, top, right, bottom into RECT at arg0
    (i32.store (local.get $wa) (local.get $arg1))
    (i32.store offset=4 (local.get $wa) (local.get $arg2))
    (i32.store offset=8 (local.get $wa) (local.get $arg3))
    (i32.store offset=12 (local.get $wa) (local.get $arg4))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))) ;; stdcall 5 params
  )

  ;; 704: RegisterClipboardFormatA — returns registered clipboard format ID
  (func $handle_RegisterClipboardFormatA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (drop (local.get $arg1))
    (drop (local.get $arg2))
    (drop (local.get $arg3))
    (drop (local.get $arg4))
    (drop (local.get $name_ptr))
    (i32.store offset=0 (global.get $reg_base) (call $clipboard_register_format (local.get $arg0) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))) ;; stdcall 1 param
  )

  ;; 707: AboutWEP(hwnd, hInstance, szCaption, nUnused)
  ;; Entertainment Pack about dialog — same shape as ShellAboutA but the
  ;; caption is in arg2 (no separate "other stuff" arg). Pass arg2 as the
  ;; appname slot, NULL for the second line.
  (func $handle_AboutWEP (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dlg i32)
    (local.set $dlg (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (drop (call $host_shell_about
      (local.get $dlg) (local.get $arg0) (call $g2w (local.get $arg2))))
    (call $create_about_dialog
      (local.get $dlg) (local.get $arg0)
      (local.get $arg2) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; LR_LOADFROMFILE: `name` is a path, not a resource id. Read the .bmp
  ;; through the VFS and build the bitmap from its BITMAPFILEHEADER + DIB, so
  ;; the caller gets the file's real pixels at the file's real size. Returns 0
  ;; when the file is missing or is not a BMP, leaving the resource path to
  ;; decide what to do next, and -2 when the file is streamed (lazy) and its
  ;; bytes are not resident yet: the caller parks on IO_WAIT and is re-run
  ;; once the host has them, as _lread is.
  ;; LR_CREATEDIBSECTION asks for a DIB section rather than a DDB, and the
  ;; difference is visible to the guest: GetObject reports bmBits for a section
  ;; and NULL for a DDB, because a DDB's pixels live in device storage the app
  ;; may not touch. Black & White 2 loads its land-picker thumbnails with
  ;; LoadImageA(NULL, path, IMAGE_BITMAP, 0, 0, LR_LOADFROMFILE|LR_CREATEDIBSECTION)
  ;; and then blits row by row straight out of bmBits, so a DDB here sends it
  ;; reading from address 0.
  (func $load_image_bitmap_file (param $path_wa i32) (param $dib_section i32) (result i32)
    (local $handle i32) (local $size i32) (local $buf_ga i32) (local $buf_wa i32)
    (local $read_ga i32) (local $read_wa i32) (local $off i32) (local $hdr i32) (local $bmp i32)
    (local $ok i32)
    (call $lazy_park_release)
    (local.set $handle (call $host_fs_create_file
      (local.get $path_wa) (i32.const 0x80000000)
      (i32.const 3) (i32.const 0x80) (i32.const 0)))
    (if (i32.eq (local.get $handle) (i32.const -1)) (then (return (i32.const 0))))
    (local.set $size (call $host_fs_get_file_size (local.get $handle)))
    ;; 54 = BITMAPFILEHEADER + BITMAPINFOHEADER, the smallest legal BMP.
    (if (i32.or (i32.lt_u (local.get $size) (i32.const 54))
                (i32.gt_u (local.get $size) (i32.const 0x2000000)))
      (then
        (drop (call $host_fs_close_handle (local.get $handle)))
        (return (i32.const 0))))
    (local.set $buf_ga (call $heap_alloc (local.get $size)))
    (local.set $read_ga (call $heap_alloc (i32.const 4)))
    (if (i32.or (i32.eqz (local.get $buf_ga)) (i32.eqz (local.get $read_ga)))
      (then
        (drop (call $host_fs_close_handle (local.get $handle)))
        (if (local.get $buf_ga) (then (call $heap_free (local.get $buf_ga))))
        (if (local.get $read_ga) (then (call $heap_free (local.get $read_ga))))
        (return (i32.const 0))))
    (local.set $read_wa (call $g2w (local.get $read_ga))) (i32.store (local.get $read_wa) (i32.const 0))
    (local.set $ok (call $host_fs_read_file
      (local.get $handle) (local.get $buf_ga) (local.get $size) (local.get $read_ga)))
    ;; Ask before any close, which clears the pending-read state.
    (if (i32.eqz (local.get $ok))
      (then
        (if (i32.eq (call $host_fs_read_pending) (i32.const 1))
          (then
            ;; Held open, not closed: see $lazy_park_hold.
            (call $lazy_park_hold (local.get $handle))
            (call $heap_free (local.get $read_ga))
            (call $heap_free (local.get $buf_ga))
            (return (i32.const -2))))))
    (drop (call $host_fs_close_handle (local.get $handle)))
    (local.set $size (i32.load (local.get $read_wa)))
    (call $heap_free (local.get $read_ga))
    (local.set $buf_wa (call $g2w (local.get $buf_ga)))
    ;; 0x4D42 = 'BM'
    (if (i32.or (i32.lt_u (local.get $size) (i32.const 54))
                (i32.ne (i32.load16_u (local.get $buf_wa)) (i32.const 0x4D42)))
      (then
        (call $heap_free (local.get $buf_ga))
        (return (i32.const 0))))
    (local.set $hdr (i32.add (local.get $buf_wa) (i32.const 14)))
    (local.set $off (i32.load offset=10 (local.get $buf_wa)))  ;; bfOffBits
    ;; A wrong bfOffBits is common in hand-built files; fall back to the header
    ;; size, which is what GDI itself uses when the offset is not plausible.
    (if (i32.or (i32.lt_u (local.get $off) (i32.const 54))
                (i32.ge_u (local.get $off) (local.get $size)))
      (then (local.set $off (i32.add (i32.const 14) (i32.load (local.get $hdr))))))
    (if (i32.ge_u (local.get $off) (local.get $size))
      (then
        (call $heap_free (local.get $buf_ga))
        (return (i32.const 0))))
    (if (local.get $dib_section)
      (then
        (if (call $gdi_bitmap_plan_info (local.get $hdr) (global.get $GDI_BITMAP_PLAN))
          (then (local.set $bmp (call $gdi_bitmap_create_owned
            (global.get $GDI_BITMAP_PLAN)
            (i32.add (local.get $buf_wa) (local.get $off))
            (i32.const 1) (i32.const 1) (i32.const 1)
            (i32.const 0) (i32.const 0))))))
      (else
        (local.set $bmp (call $gdi_bitmap_create_dibitmap
          (i32.const 0) (local.get $hdr)
          (i32.add (local.get $buf_wa) (local.get $off))
          (i32.const 1) (i32.const 0)))))
    (call $heap_free (local.get $buf_ga))
    (local.get $bmp))

  ;; 711: LoadImageA(hInst, name, type, cx, cy, fuLoad) — delegate to LoadIcon/LoadCursor/LoadBitmap
  (func $handle_LoadImageA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $tmp i32)
    ;; arg0=hInst, arg1=name, arg2=type, arg3=cx, arg4=cy, [esp+24]=fuLoad
    ;; IMAGE_BITMAP (0): load from PE resources via host.
    ;; arg1 may be MAKEINTRESOURCE (<=0xFFFF) or a string pointer (named resource).
    (if (i32.eqz (local.get $arg2))
      (then
        ;; LR_LOADFROMFILE (0x10) — name is a path; the resource walker has
        ;; nothing to find. Pawn loads its two board squares this way.
        (if (i32.and
              (i32.ne (i32.and (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
                               (i32.const 0x10)) (i32.const 0))
              (i32.gt_u (local.get $arg1) (i32.const 0xFFFF)))
          (then
            (local.set $tmp (call $load_image_bitmap_file (call $g2w (local.get $arg1))
              (i32.ne (i32.and (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
                               (i32.const 0x2000)) (i32.const 0))))
            ;; A file load that failed must report failure. The 32x32 stand-in
            ;; below exists for a resource id the walker cannot find, where a
            ;; caller usually just draws nothing; handing it back for a missing
            ;; *file* is actively harmful, because LR_LOADFROMFILE callers test
            ;; the handle and branch on it. Black & White 2 walks three
            ;; candidate paths for each land thumbnail and gives up with a
            ;; message if all three fail -- but our stand-in passed its first
            ;; `test eax,eax`, so it went on to blit from the bitmap's bmBits,
            ;; which for a device-dependent stand-in is 0.
            (i32.store offset=0 (global.get $reg_base) (local.get $tmp))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
            (if (i32.eq (local.get $tmp) (i32.const -2))
              (then (call $io_block (i32.const 28))))
            (return)))
        (local.set $tmp (call $gdi_native_load_bitmap (local.get $arg0)
          (if (result i32) (i32.gt_u (local.get $arg1) (i32.const 0xFFFF))
            (then (local.get $arg1))
            (else (i32.and (local.get $arg1) (i32.const 0xFFFF))))))
        ;; A resource that is not there is NULL with ERROR_RESOURCE_NAME_NOT_FOUND,
        ;; as in Windows -- not a blank stand-in bitmap. DDLoadBitmap-style
        ;; loaders try the resource first and fall back to LR_LOADFROMFILE only
        ;; on NULL: Dark Colony asks for "cursor/cursor%d.bmp" that way, took
        ;; the stand-in for success, and drew its whole mouse cursor from 24
        ;; empty 32x32 frames, so the pointer was invisible everywhere.
        (if (i32.eqz (local.get $tmp))
          (then (global.set $last_error (i32.const 1814))))
        (i32.store offset=0 (global.get $reg_base) (local.get $tmp))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))) (return)))
    ;; IMAGE_ICON (1): intern the resource so DrawIconEx can find its pixels
    ;; later — same handle space as LoadIconA. Named resources keep the old
    ;; opaque handle, since the RT_GROUP_ICON walker addresses by ordinal.
    (if (i32.eq (local.get $arg2) (i32.const 1))
      (then
        (if (i32.and (i32.ne (local.get $arg0) (i32.const 0))
                     (i32.le_u (local.get $arg1) (i32.const 0xFFFF)))
          (then (local.set $tmp (call $icon_intern (local.get $arg0) (local.get $arg1))))
          (else (local.set $tmp (i32.const 0))))
        (if (i32.eqz (local.get $tmp)) (then (local.set $tmp (i32.const 0x60001))))
        (i32.store offset=0 (global.get $reg_base) (local.get $tmp))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))) (return)))
    ;; IMAGE_CURSOR (2): return cursor handle (same encoding as LoadCursorA)
    (if (i32.eq (local.get $arg2) (i32.const 2))
      (then
        (if (i32.and (i32.eqz (local.get $arg0))
                     (i32.lt_u (local.get $arg1) (i32.const 0x10000)))
          (then (i32.store offset=0 (global.get $reg_base) (i32.or (i32.const 0x60000)
                                         (i32.and (local.get $arg1) (i32.const 0xFFFF)))))
          (else
            (if (i32.lt_u (local.get $arg1) (i32.const 0x10000))
              (then (i32.store offset=0 (global.get $reg_base) (i32.or (i32.const 0x680000)
                                             (i32.and (local.get $arg1) (i32.const 0xFFFF)))))
              (else (i32.store offset=0 (global.get $reg_base) (i32.const 0x67F00))))))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))) (return)))
    ;; Unknown type: return NULL
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))  ;; stdcall, 6 args
  )

  ;; LoadImageW has identical resource-id semantics for the integer resources
  ;; used by Win98 Media Player. Named bitmap resources are uncommon here; the
  ;; host resource lookup accepts the same guest pointer for either variant.
  (func $handle_LoadImageW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_LoadImageA
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; LoadCursorFromFileA(lpFileName). File-backed cursor pixels are not yet
  ;; decoded, but the existing opaque custom-cursor handle preserves the
  ;; application's non-system cursor selection without aborting.
  (func $handle_LoadCursorFromFileA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg0)
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x67F00))
        (global.set $last_error (i32.const 0)))
      (else
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (global.set $last_error (i32.const 87))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; Invoke the current LineDDA point callback, or finish the original API.
  (func $line_dda_abs (param $value i32) (result i32)
    (select (i32.sub (i32.const 0) (local.get $value)) (local.get $value)
      (i32.lt_s (local.get $value) (i32.const 0))))

  (func $line_dda_continue
    (local $e2 i32)
    ;; Endpoint is excluded, matching GDI's line convention and LineDDA docs.
    (if (i32.and (i32.eq (global.get $line_dda_x) (global.get $line_dda_end_x))
          (i32.eq (global.get $line_dda_y) (global.get $line_dda_end_y)))
      (then
        (global.set $eip (global.get $line_dda_ret))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))
        (return)))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $line_dda_data))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $line_dda_y))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $line_dda_x))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $line_dda_ret_thunk))
    (global.set $eip (global.get $line_dda_callback))
    (global.set $steps (i32.const 0)))

  (func $line_dda_advance
    (local $e2 i32)
    (local.set $e2 (i32.shl (global.get $line_dda_err) (i32.const 1)))
    (if (i32.ge_s (local.get $e2) (global.get $line_dda_dy))
      (then
        (global.set $line_dda_err
          (i32.add (global.get $line_dda_err) (global.get $line_dda_dy)))
        (global.set $line_dda_x
          (i32.add (global.get $line_dda_x) (global.get $line_dda_sx)))))
    (if (i32.le_s (local.get $e2) (global.get $line_dda_dx))
      (then
        (global.set $line_dda_err
          (i32.add (global.get $line_dda_err) (global.get $line_dda_dx)))
        (global.set $line_dda_y
          (i32.add (global.get $line_dda_y) (global.get $line_dda_sy)))))
    (call $line_dda_continue))

  ;; 712: LineDDA(xStart, yStart, xEnd, yEnd, lpProc, lParam).
  (func $handle_LineDDA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (local.get $arg4))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
        (return)))
    (global.set $line_dda_ret (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (global.set $line_dda_callback (local.get $arg4))
    (global.set $line_dda_data (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (global.set $line_dda_x (local.get $arg0))
    (global.set $line_dda_y (local.get $arg1))
    (global.set $line_dda_end_x (local.get $arg2))
    (global.set $line_dda_end_y (local.get $arg3))
    (global.set $line_dda_dx (call $line_dda_abs (i32.sub (local.get $arg2) (local.get $arg0))))
    (global.set $line_dda_dy (i32.sub (i32.const 0)
      (call $line_dda_abs (i32.sub (local.get $arg3) (local.get $arg1)))))
    (global.set $line_dda_sx (select (i32.const 1) (i32.const -1)
      (i32.lt_s (local.get $arg0) (local.get $arg2))))
    (global.set $line_dda_sy (select (i32.const 1) (i32.const -1)
      (i32.lt_s (local.get $arg1) (local.get $arg3))))
    (global.set $line_dda_err (i32.add (global.get $line_dda_dx) (global.get $line_dda_dy)))
    ;; Discard the original stdcall frame before entering the first callback.
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
    (call $line_dda_continue)
  )

  ;; 713: OpenFile(lpFileName, lpReOpenBuff, uStyle) — delegate to host_fs_create_file
  ;; arg0=lpFileName, arg1=lpReOpenBuff (OFSTRUCT), arg2=uStyle
  (func $handle_OpenFile (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $handle i32) (local $buf_wa i32) (local $i i32) (local $ch i32) (local $path_wa i32)
    (local $access i32) (local $creation i32)
    ;; OF_READ=0, OF_WRITE=1, OF_READWRITE=2. OF_CREATE=0x1000 creates or
    ;; truncates the destination; InstallShield combines it with READWRITE
    ;; while creating its temporary stage files. OF_CREATE alone (access bits
    ;; OF_READ=0) is DOS create, INT 21h AH=3Ch, which always opens the new
    ;; file read/write: InstallShield 3's Win16 SETUP.EXE creates its engine
    ;; stage file with style 0x1000 and then _lwrites into it.
    (local.set $access
      (if (result i32) (i32.ne (i32.and (local.get $arg2) (i32.const 0x1000)) (i32.const 0))
        (then (i32.const 0xC0000000)) ;; GENERIC_READ | GENERIC_WRITE
        (else
      (if (result i32) (i32.eq (i32.and (local.get $arg2) (i32.const 3)) (i32.const 1))
        (then (i32.const 0x40000000)) ;; GENERIC_WRITE
        (else
          (if (result i32) (i32.eq (i32.and (local.get $arg2) (i32.const 3)) (i32.const 2))
            (then (i32.const 0xC0000000)) ;; GENERIC_READ | GENERIC_WRITE
            (else (i32.const 0x80000000)))))))) ;; GENERIC_READ
    (local.set $creation
      (select (i32.const 2) (i32.const 3)
        (i32.ne (i32.and (local.get $arg2) (i32.const 0x1000)) (i32.const 0))))
    (local.set $path_wa (call $g2w (local.get $arg0)))
    (local.set $handle (call $host_fs_create_file
      (local.get $path_wa)
      (local.get $access)
      (local.get $creation)
      (i32.const 0x80)        ;; FILE_ATTRIBUTE_NORMAL
      (i32.const 0)))         ;; isWide=0
    ;; Fill OFSTRUCT if provided
    (if (local.get $arg1)
      (then
        (local.set $buf_wa (call $g2w (local.get $arg1)))
        (i32.store8 (local.get $buf_wa) (i32.const 136))  ;; cBytes
        ;; fFixedDisk, and the file's time and date where DOS puts them. There
        ;; is one drive here and it is not removable, and the timestamp is the
        ;; same fixed one INT 21h AH=57h reports — this filesystem keeps none,
        ;; and answering with a different invented value each call would be
        ;; worse than answering with one.
        (i32.store8 (i32.add (local.get $buf_wa) (i32.const 1)) (i32.const 1))
        (i32.store16 (i32.add (local.get $buf_wa) (i32.const 4)) (i32.const 0))
        (i32.store16 (i32.add (local.get $buf_wa) (i32.const 6)) (i32.const 0x2421))
        (if (i32.eq (local.get $handle) (i32.const -1))
          (then (i32.store16 (i32.add (local.get $buf_wa) (i32.const 2)) (i32.const 2)))  ;; nErrCode=FILE_NOT_FOUND
          (else (i32.store16 (i32.add (local.get $buf_wa) (i32.const 2)) (i32.const 0))))
        ;; szPathName at +8: the name the file was opened under. Callers read
        ;; the file back out of here rather than keeping their own copy —
        ;; Visual Basic opens a custom control with OpenFile and then hands
        ;; this field to LoadLibrary, which was being given 128 bytes of zero.
        (local.set $i (i32.const 0))
        (block $named (loop $chars
          (br_if $named (i32.ge_u (local.get $i) (i32.const 127)))
          (local.set $ch (i32.load8_u (i32.add (local.get $path_wa) (local.get $i))))
          ;; DOS reports the path in upper case and callers compare it.
          (if (i32.and (i32.ge_u (local.get $ch) (i32.const 0x61))
                       (i32.le_u (local.get $ch) (i32.const 0x7A)))
            (then (local.set $ch (i32.sub (local.get $ch) (i32.const 0x20)))))
          (i32.store8 (i32.add (i32.add (local.get $buf_wa) (i32.const 8)) (local.get $i))
            (local.get $ch))
          (br_if $named (i32.eqz (local.get $ch)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $chars)))
        (i32.store8 (i32.add (i32.add (local.get $buf_wa) (i32.const 8)) (i32.const 127))
          (i32.const 0))))
    ;; OF_EXIST (0x4000): check existence only, close handle
    (if (i32.and (local.get $arg2) (i32.const 0x4000))
      (then
        (if (i32.ne (local.get $handle) (i32.const -1))
          (then
            (drop (call $host_fs_close_handle (local.get $handle)))
            (local.set $handle (i32.const 1))))))
    (i32.store offset=0 (global.get $reg_base) (local.get $handle))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))  ;; stdcall, 3 args
  )

  ;; 714: OutputDebugStringA(lpOutputString) — deliver bounded ANSI text to
  ;; the host debugger/log sink. NULL is explicitly optional; an inaccessible
  ;; or non-contiguous guest range is ignored rather than letting diagnostics
  ;; crash the process that produced them.
  (func $handle_OutputDebugStringA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $length i32) (local $wa i32)
    (if (local.get $arg0)
      (then
        (local.set $length (call $guest_strlen (local.get $arg0)))
        (if (local.get $length)
          (then
            (local.set $wa
              (call $g2w_affine_span (local.get $arg0) (local.get $length)))
            (if (i32.ne (local.get $wa) (global.get $NULL_SENTINEL))
              (then (call $host_log (local.get $wa) (local.get $length))))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; FatalAppExitA(uAction, lpMessageText) — the message, then process exit
  ;; (as Wine: MessageBox, then ExitProcess(0)). The text goes to the same log
  ;; sink as OutputDebugStringA rather than a modal box, since nothing runs
  ;; after it. Carmageddon 2's BRender driver loader resolves it by name.
  (func $handle_FatalAppExitA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $length i32) (local $wa i32)
    (if (local.get $arg1)
      (then
        (local.set $length (call $guest_strlen (local.get $arg1)))
        (if (local.get $length)
          (then
            (local.set $wa (call $g2w_affine_span (local.get $arg1) (local.get $length)))
            (if (i32.ne (local.get $wa) (global.get $NULL_SENTINEL))
              (then (call $host_log (local.get $wa) (local.get $length))))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))  ;; stdcall, 2 args
    (call $host_exit (i32.const 0)) (global.set $eip (i32.const 0)) (global.set $steps (i32.const 0)))

  ;; 715: AdjustWindowRect(lpRect, dwStyle, bMenu) — adjust rect for window chrome
  (func $handle_AdjustWindowRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32) (local $border i32) (local $caption i32) (local $frame i32)
    ;; Match the existing non-client fixed/sizing frame. Bottom chrome keeps
    ;; its established four-pixel extent; only side/top frame varies.
    (local.set $frame
      (select (call $defwndproc_style_frame_width (local.get $arg1)) (i32.const 4)
        (i32.eq (i32.and (local.get $arg1) (i32.const 0x00C00000)) (i32.const 0x00C00000))))
    (local.set $wa (call $g2w (local.get $arg0)))
    (local.set $border (i32.ne (i32.and (local.get $arg1) (i32.const 0x00CC0000)) (i32.const 0)))
    (local.set $caption (i32.eq (i32.and (local.get $arg1) (i32.const 0x00C00000)) (i32.const 0x00C00000)))
    (if (i32.or (local.get $border) (local.get $caption)) (then
      (i32.store (local.get $wa) (i32.sub (i32.load (local.get $wa)) (local.get $frame)))
      (i32.store offset=4 (local.get $wa)
        (i32.sub (i32.load offset=4 (local.get $wa))
          (i32.add (local.get $frame)
            (i32.add (select (i32.const 20) (i32.const 0) (local.get $caption))
                     (select (i32.const 18) (i32.const 0) (local.get $arg2))))))
      (i32.store offset=8 (local.get $wa) (i32.add (i32.load offset=8 (local.get $wa)) (local.get $frame)))
      (i32.store offset=12 (local.get $wa) (i32.add (i32.load offset=12 (local.get $wa)) (i32.const 4)))
    ))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))  ;; stdcall, 3 args
  )

  ;; 717: GetDCOrgEx(hdc, lppt) — final device origin in screen coordinates.
  ;; Memory, DirectDraw, printer, and screen DCs have no USER window binding
  ;; and therefore retain the device origin (0,0). Window DC bindings live in
  ;; the canonical DC record: positive hwnd for client DCs, sign-bit hwnd for
  ;; whole-window DCs.
  (func $handle_GetDCOrgEx (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32) (local $dc i32) (local $binding i32) (local $hwnd i32)
    (local $x i32) (local $y i32)
    (local.set $dc (call $gdi_dc_state_entry (local.get $arg0) (i32.const 0)))
    (if (i32.or (i32.eqz (local.get $dc)) (i32.eqz (local.get $arg1)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (local.set $binding (i32.load offset=92 (local.get $dc)))
    (if (local.get $binding)
      (then
        (local.set $hwnd (i32.and (local.get $binding) (i32.const 0x7FFFFFFF)))
        (if (i32.eq (call $wnd_table_find (local.get $hwnd)) (i32.const -1))
          (then
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
            (return)))
        (if (i32.lt_s (local.get $binding) (i32.const 0))
          (then
            (local.set $x (call $wnd_window_screen_x (local.get $hwnd)))
            (local.set $y (call $wnd_window_screen_y (local.get $hwnd))))
          (else
            (local.set $x (call $wnd_client_screen_x (local.get $hwnd)))
            (local.set $y (call $wnd_client_screen_y (local.get $hwnd)))))))
    (local.set $wa (call $g2w (local.get $arg1)))
    (store.field Point x (local.get $wa) (local.get $x))
    (store.field Point y (local.get $wa) (local.get $y))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))  ;; stdcall, 2 args
  )

  ;; 741: QueryPerformanceCounter(lpPerformanceCount) — tie to wall clock.
  ;; Frequency is 1MHz (see below), so one tick = 1µs. host_get_ticks() is ms,
  ;; multiply by 1000. Consecutive calls within one ms must still differ (some
  ;; apps busy-wait on QPC), so a reading never repeats the last one.
  ;;
  ;; "The last one" is process-wide, in $QPC_SHARED: the count is
  ;; max(ticks*1000, last+1), published by CAS. It used to add a per-instance
  ;; call counter instead, which made every guest thread its own clock -- a
  ;; thread that polls QPC a million times runs a second ahead of one that
  ;; does not -- so a reading taken on another thread could go BACKWARDS.
  ;; Descent: FreeSpace treats a backwards QPC as a reset of its time base;
  ;; its frame limiter then computed "now - last frame" as minus 2550 seconds
  ;; and called Sleep for 2.5 million ms, which froze the mission in flight.
  ;;
  ;; A QPC frame limiter is a clock spin like any timeGetTime one, so it goes
  ;; through the same detector keyed on the MILLISECOND the count is built
  ;; from. The returned count itself can never repeat ($qpc_next moves
  ;; every call), but the clock under it does, and that is what the guest is
  ;; waiting on. Parked before the counter bump and the store, so the re-run
  ;; on wake is the whole call again.
  (func $handle_QueryPerformanceCounter (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32) (local $val i64)
    (global.set $tick_count (call $host_get_ticks))
    (if (call $clock_spin_step (global.get $tick_count))
      (then
        (if (call $clock_spin_arm (global.get $tick_count)) (then (return)))))
    (local.set $wa (call $g2w (local.get $arg0)))
    (local.set $val (call $qpc_next
      (i64.mul (i64.extend_i32_u (global.get $tick_count)) (i64.const 1000))))
    ;; LARGE_INTEGER is one 64-bit count: neither multiplication nor the
    ;; sub-millisecond adjustment may discard the carry into its high DWORD.
    (i64.store (local.get $wa) (local.get $val))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; The next process-wide QPC count for a clock reading of $now µs: $now if
  ;; that is past every count handed out so far, else one past the last.
  (func $qpc_next (param $now i64) (result i64)
    (local $last i64) (local $next i64)
    (block $done (loop $retry
      (local.set $last (i64.atomic.load (global.get $QPC_SHARED)))
      (local.set $next
        (select (local.get $now) (i64.add (local.get $last) (i64.const 1))
          (i64.gt_u (local.get $now) (local.get $last))))
      (br_if $done (i64.eq (local.get $last)
        (i64.atomic.rmw.cmpxchg (global.get $QPC_SHARED) (local.get $last) (local.get $next))))
      (br $retry)))
    (local.get $next))

  ;; 742: QueryPerformanceFrequency(lpFrequency) — 1MHz
  (func $handle_QueryPerformanceFrequency (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32)
    (local.set $wa (call $g2w (local.get $arg0)))
    (i32.store (local.get $wa) (i32.const 1000000))
    (i32.store (i32.add (local.get $wa) (i32.const 4)) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; 743: SetClassLongA(hWnd, nIndex, dwNewLong) — return old value (0)
  (func $handle_SetClassLongA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; SetClassLongA(hwnd, nIndex, dwNewLong) -> previous value. Writes the
    ;; hwnd's own class record, so the change is visible to every window of
    ;; that class -- which is the whole point of the call.
    (i32.store offset=0 (global.get $reg_base) (call $class_long_set (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))  ;; stdcall, 3 args
  )

  ;; 744: RtlZeroMemory(Destination, Length) — zero fill memory
  (func $handle_RtlZeroMemory (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $zero_memory (call $g2w (local.get $arg0)) (local.get $arg1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))  ;; stdcall, 2 args
  )

  ;; 745: time(timer) — UTC seconds since 1970, from the same calendar clock
  ;; GetSystemTime reads (not the guest tick counter, which starts near zero).
  (func $handle_time (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $t i32)
    (local.set $t (call $wall_clock_time_t))
    (i32.store offset=0 (global.get $reg_base) (local.get $t))
    (if (local.get $arg0)
      (then (call $gs32 (local.get $arg0) (local.get $t))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; 746: atol(str) — convert ASCII string to long integer
  (func $handle_atol (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ptr i32) (local $val i32) (local $ch i32) (local $neg i32)
    (local.set $ptr (call $g2w (local.get $arg0)))
    ;; Skip whitespace
    (block $ws_done (loop $ws
      (local.set $ch (i32.load8_u (local.get $ptr)))
      (br_if $ws_done (i32.ne (local.get $ch) (i32.const 32)))
      (local.set $ptr (i32.add (local.get $ptr) (i32.const 1)))
      (br $ws)))
    ;; Check sign
    (if (i32.eq (i32.load8_u (local.get $ptr)) (i32.const 45))  ;; '-'
      (then (local.set $neg (i32.const 1))
            (local.set $ptr (i32.add (local.get $ptr) (i32.const 1)))))
    (if (i32.eq (i32.load8_u (local.get $ptr)) (i32.const 43))  ;; '+'
      (then (local.set $ptr (i32.add (local.get $ptr) (i32.const 1)))))
    ;; Parse digits
    (block $done (loop $digits
      (local.set $ch (i32.load8_u (local.get $ptr)))
      (br_if $done (i32.lt_u (local.get $ch) (i32.const 48)))
      (br_if $done (i32.gt_u (local.get $ch) (i32.const 57)))
      (local.set $val (i32.add (i32.mul (local.get $val) (i32.const 10))
                                (i32.sub (local.get $ch) (i32.const 48))))
      (local.set $ptr (i32.add (local.get $ptr) (i32.const 1)))
      (br $digits)))
    (if (local.get $neg)
      (then (local.set $val (i32.sub (i32.const 0) (local.get $val)))))
    (i32.store offset=0 (global.get $reg_base) (local.get $val))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))  ;; cdecl
  )

  ;; __GetMainArgs(argc, argv, envp) — CRT init, 3-arg variant
  (func $handle___GetMainArgs (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (global.get $fake_cmdline_addr))
      (then (call $store_fake_cmdline)))
    (call $gs32 (local.get $arg0)
      (call $gl32 (i32.add (global.get $fake_cmdline_addr) (i32.const 508))))
    (call $gs32 (local.get $arg1)
      (i32.add (global.get $fake_cmdline_addr) (i32.const 1024)))
    (call $gs32 (local.get $arg2)
      (i32.add (global.get $fake_cmdline_addr) (i32.const 1532)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))  ;; cdecl
  )

  ;; 752: SetWindowsHookW(idHook, lpfn) — code pointers need no widening.
  (func $handle_SetWindowsHookW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_SetWindowsHookA
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; SetWindowsHookA(idHook, lpfn) — legacy spelling of the process-local
  ;; hook install. It shares the Ex path's supported classes and handles.
  (func $handle_SetWindowsHookA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $install_supported_hook (local.get $arg0) (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))  ;; stdcall, 2 args
  )

  ;; 753: RegisterPenApp(style, fRegister) — no-op, pen input not supported
  (func $handle_RegisterPenApp (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))  ;; stdcall, 2 args
  )

  ;; Look up dwMessageId in the active module's RT_MESSAGETABLE (type 11) and
  ;; write it to $out_wa as ANSI. Returns the length written, or -1 when the
  ;; module has no message table or the id is not in it.
  ;;
  ;; MESSAGE_RESOURCE_DATA is a count followed by that many blocks of
  ;; {LowId, HighId, OffsetToEntries}; the entries a block points at are
  ;; variable-length {Length, Flags, text...} records walked in id order.
  ;; Flags bit 0 means the text is UTF-16, which is the common case.
  (func $message_table_lookup (param $id i32) (param $out_wa i32) (result i32)
    (local $data_entry i32) (local $table i32) (local $blocks i32) (local $i i32)
    (local $blk i32) (local $lo i32) (local $hi i32) (local $entry i32)
    (local $skip i32) (local $len i32) (local $flags i32) (local $n i32)
    (local $ch i32)
    (local.set $data_entry (call $find_resource (i32.const 11) (i32.const 1)))
    (if (i32.eqz (local.get $data_entry)) (then (return (i32.const -1))))
    (local.set $table (call $g2w (i32.add (call $r_base)
      (call $gl32 (i32.add (call $r_base) (local.get $data_entry))))))
    (local.set $blocks (i32.load (local.get $table)))
    (block $found (block $missing
      (loop $scan
        (br_if $missing (i32.ge_u (local.get $i) (local.get $blocks)))
        (local.set $blk (i32.add (local.get $table)
          (i32.add (i32.const 4) (i32.mul (local.get $i) (i32.const 12)))))
        (local.set $lo (i32.load (local.get $blk)))
        (local.set $hi (i32.load offset=4 (local.get $blk)))
        (if (i32.and (i32.ge_u (local.get $id) (local.get $lo))
                     (i32.le_u (local.get $id) (local.get $hi)))
          (then
            (local.set $entry (i32.add (local.get $table) (i32.load offset=8 (local.get $blk))))
            (local.set $skip (i32.sub (local.get $id) (local.get $lo)))
            (br $found)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $scan))
      )
      (return (i32.const -1)))
    ;; Walk to the requested entry — records are variable length.
    (block $at (loop $next
      (br_if $at (i32.eqz (local.get $skip)))
      (local.set $entry (i32.add (local.get $entry) (i32.load16_u (local.get $entry))))
      (local.set $skip (i32.sub (local.get $skip) (i32.const 1)))
      (br $next)))
    (local.set $len (i32.load16_u (local.get $entry)))
    (local.set $flags (i32.load16_u offset=2 (local.get $entry)))
    (local.set $entry (i32.add (local.get $entry) (i32.const 4)))
    (local.set $len (i32.sub (local.get $len) (i32.const 4)))
    (local.set $n (i32.const 0))
    (if (i32.and (local.get $flags) (i32.const 1))
      (then
        ;; UTF-16 text: keep the low byte of each unit, which is all a Win98
        ;; message table for an ANSI caller ever holds.
        (block $done (loop $w
          (br_if $done (i32.ge_u (i32.mul (local.get $n) (i32.const 2)) (local.get $len)))
          (local.set $ch (i32.load16_u
            (i32.add (local.get $entry) (i32.mul (local.get $n) (i32.const 2)))))
          (br_if $done (i32.eqz (local.get $ch)))
          (i32.store8 (i32.add (local.get $out_wa) (local.get $n))
            (i32.and (local.get $ch) (i32.const 0xFF)))
          (local.set $n (i32.add (local.get $n) (i32.const 1)))
          (br $w))))
      (else
        (block $done (loop $a
          (br_if $done (i32.ge_u (local.get $n) (local.get $len)))
          (local.set $ch (i32.load8_u (i32.add (local.get $entry) (local.get $n))))
          (br_if $done (i32.eqz (local.get $ch)))
          (i32.store8 (i32.add (local.get $out_wa) (local.get $n)) (local.get $ch))
          (local.set $n (i32.add (local.get $n) (i32.const 1)))
          (br $a)))))
    ;; "%0" ends the message text without a newline. winipcfg depends on it:
    ;; its adapter-type entries read "Ethernet %0\r\n" and the visible label is
    ;; the part before the %0, concatenated with text from the dialog template.
    (local.set $i (i32.const 0))
    (block $scanned (loop $pct
      (br_if $scanned (i32.ge_u (i32.add (local.get $i) (i32.const 1)) (local.get $n)))
      (if (i32.and
            (i32.eq (i32.load8_u (i32.add (local.get $out_wa) (local.get $i)))
                    (i32.const 37))
            (i32.eq (i32.load8_u
                      (i32.add (local.get $out_wa) (i32.add (local.get $i) (i32.const 1))))
                    (i32.const 48)))
        (then (local.set $n (local.get $i)) (br $scanned)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $pct)))
    ;; Message-table text is stored with its trailing CRLF; callers that place
    ;; it in a dialog label want the line, not the terminator.
    (block $trimmed (loop $trim
      (br_if $trimmed (i32.eqz (local.get $n)))
      (local.set $ch (i32.load8_u
        (i32.add (local.get $out_wa) (i32.sub (local.get $n) (i32.const 1)))))
      (br_if $trimmed (i32.and (i32.ne (local.get $ch) (i32.const 13))
                               (i32.ne (local.get $ch) (i32.const 10))))
      (local.set $n (i32.sub (local.get $n) (i32.const 1)))
      (br $trim)))
    (i32.store8 (i32.add (local.get $out_wa) (local.get $n)) (i32.const 0))
    (local.get $n))

  ;; One output byte of $format_message_expand. $dst == 0 means "measure only",
  ;; which is how the ALLOCATE_BUFFER path learns the size before it allocates.
  ;; $max counts the NUL, so the last writable index is $max - 2.
  (func $fmsg_put (param $dst i32) (param $o i32) (param $max i32) (param $ch i32) (result i32)
    (if (i32.and (i32.ne (local.get $dst) (i32.const 0))
                 (i32.or (i32.eqz (local.get $max))
                         (i32.lt_u (local.get $o) (i32.sub (local.get $max) (i32.const 1)))))
      (then (i32.store8 (i32.add (local.get $dst) (local.get $o)) (local.get $ch))))
    (i32.add (local.get $o) (i32.const 1)))

  ;; Write $val in base $base, no buffer of its own — the digits go straight
  ;; out through $fmsg_put, so this works in measure mode too.
  (func $fmsg_put_num (param $dst i32) (param $o i32) (param $max i32)
                      (param $val i32) (param $base i32) (param $signed i32) (result i32)
    (local $div i32) (local $d i32)
    (if (i32.and (local.get $signed) (i32.lt_s (local.get $val) (i32.const 0)))
      (then
        (local.set $o (call $fmsg_put (local.get $dst) (local.get $o) (local.get $max) (i32.const 45)))
        (local.set $val (i32.sub (i32.const 0) (local.get $val)))))
    (local.set $div (i32.const 1))
    (block $sized (loop $grow
      (br_if $sized (i32.lt_u (i32.div_u (local.get $val) (local.get $div)) (local.get $base)))
      ;; Stop before $div overflows: 10 digits is already the whole i32 range.
      (br_if $sized (i32.gt_u (local.get $div) (i32.const 0x19999999)))
      (local.set $div (i32.mul (local.get $div) (local.get $base)))
      (br $grow)))
    (block $done (loop $emit
      (local.set $d (i32.rem_u (i32.div_u (local.get $val) (local.get $div)) (local.get $base)))
      (local.set $o (call $fmsg_put (local.get $dst) (local.get $o) (local.get $max)
        (select (i32.add (local.get $d) (i32.const 87))     ;; 'a'..'f'
                (i32.add (local.get $d) (i32.const 48))     ;; '0'..'9'
                (i32.gt_u (local.get $d) (i32.const 9)))))
      (br_if $done (i32.eq (local.get $div) (i32.const 1)))
      (local.set $div (i32.div_u (local.get $div) (local.get $base)))
      (br $emit)))
    (local.get $o))

  ;; Expand a message template's inserts. Everything here is the documented
  ;; FormatMessage syntax, which is not printf: %1..%99 name the Arguments
  ;; entries positionally, and the escapes are their own small language.
  ;;
  ;;   %%      a literal percent          %.  a literal period
  ;;   %!      a literal exclamation      %b  a space
  ;;   %r      a carriage return          %n  a hard line break
  ;;   %0      ends the message here, with no trailing newline
  ;;   %N      Arguments[N-1] as a string (the default when no spec follows)
  ;;   %N!spec!  the same argument through a printf-style spec; a spec ending
  ;;             in s is a string, d/i/u/x/X are numbers, anything else is
  ;;             treated as a string because that is the safer guess.
  ;;
  ;; $src and $dst are WASM addresses; the Arguments array is a guest pointer
  ;; to DWORDs (a va_list on x86 is exactly that, so ARGUMENT_ARRAY needs no
  ;; separate path). Returns the length not counting the NUL, which is what
  ;; FormatMessage returns, and is the true length even when the output was
  ;; truncated to $max.
  (func $format_message_expand
      (param $src i32) (param $dst i32) (param $max i32) (param $args_g i32) (result i32)
    (local $i i32) (local $o i32) (local $ch i32) (local $nxt i32)
    (local $n i32) (local $base i32) (local $as_int i32) (local $spec i32)
    (local $argv i32) (local $p i32)
    (block $done (loop $scan
      (local.set $ch (i32.load8_u (i32.add (local.get $src) (local.get $i))))
      (br_if $done (i32.eqz (local.get $ch)))
      (if (i32.ne (local.get $ch) (i32.const 37))   ;; '%'
        (then
          (local.set $o (call $fmsg_put (local.get $dst) (local.get $o) (local.get $max) (local.get $ch)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $scan)))
      (local.set $nxt (i32.load8_u (i32.add (local.get $src) (i32.add (local.get $i) (i32.const 1)))))
      ;; A trailing '%' is just a '%'.
      (if (i32.eqz (local.get $nxt))
        (then
          (local.set $o (call $fmsg_put (local.get $dst) (local.get $o) (local.get $max) (i32.const 37)))
          (br $done)))
      (if (i32.or (i32.lt_u (local.get $nxt) (i32.const 48))
                  (i32.gt_u (local.get $nxt) (i32.const 57)))
        (then
          ;; Not a digit — one of the escapes, or an unknown sequence that is
          ;; safest passed through unchanged.
          (local.set $i (i32.add (local.get $i) (i32.const 2)))
          (if (i32.eq (local.get $nxt) (i32.const 98))        ;; 'b'
            (then (local.set $o (call $fmsg_put (local.get $dst) (local.get $o) (local.get $max) (i32.const 32))) (br $scan)))
          (if (i32.eq (local.get $nxt) (i32.const 114))       ;; 'r'
            (then (local.set $o (call $fmsg_put (local.get $dst) (local.get $o) (local.get $max) (i32.const 13))) (br $scan)))
          (if (i32.eq (local.get $nxt) (i32.const 110))       ;; 'n'
            (then
              (local.set $o (call $fmsg_put (local.get $dst) (local.get $o) (local.get $max) (i32.const 13)))
              (local.set $o (call $fmsg_put (local.get $dst) (local.get $o) (local.get $max) (i32.const 10)))
              (br $scan)))
          (if (i32.or (i32.eq (local.get $nxt) (i32.const 37))     ;; '%'
                (i32.or (i32.eq (local.get $nxt) (i32.const 46))   ;; '.'
                        (i32.eq (local.get $nxt) (i32.const 33)))) ;; '!'
            (then (local.set $o (call $fmsg_put (local.get $dst) (local.get $o) (local.get $max) (local.get $nxt))) (br $scan)))
          (local.set $o (call $fmsg_put (local.get $dst) (local.get $o) (local.get $max) (i32.const 37)))
          (local.set $o (call $fmsg_put (local.get $dst) (local.get $o) (local.get $max) (local.get $nxt)))
          (br $scan)))
      ;; %N — read the index, which is one or two digits.
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (local.set $n (i32.const 0))
      (block $num_done (loop $num
        (local.set $ch (i32.load8_u (i32.add (local.get $src) (local.get $i))))
        (br_if $num_done (i32.or (i32.lt_u (local.get $ch) (i32.const 48))
                                 (i32.gt_u (local.get $ch) (i32.const 57))))
        (local.set $n (i32.add (i32.mul (local.get $n) (i32.const 10))
                               (i32.sub (local.get $ch) (i32.const 48))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $num)))
      ;; %0 ends the message.
      (br_if $done (i32.eqz (local.get $n)))
      (local.set $as_int (i32.const 0))
      (local.set $base (i32.const 10))
      ;; An optional !printf-spec! follows the number. Only its last letter
      ;; decides how the argument is read; width and flags are dropped, which
      ;; costs padding and never costs the value itself.
      (if (i32.eq (i32.load8_u (i32.add (local.get $src) (local.get $i))) (i32.const 33))
        (then
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (local.set $spec (i32.const 0))
          (block $spec_done (loop $spec_scan
            (local.set $ch (i32.load8_u (i32.add (local.get $src) (local.get $i))))
            (br_if $spec_done (i32.eqz (local.get $ch)))
            (if (i32.eq (local.get $ch) (i32.const 33))
              (then (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $spec_done)))
            (local.set $spec (local.get $ch))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $spec_scan)))
          (if (i32.or (i32.eq (local.get $spec) (i32.const 100))     ;; 'd'
                (i32.or (i32.eq (local.get $spec) (i32.const 105))   ;; 'i'
                        (i32.eq (local.get $spec) (i32.const 117)))) ;; 'u'
            (then (local.set $as_int (i32.const 1))))
          (if (i32.or (i32.eq (local.get $spec) (i32.const 120))     ;; 'x'
                      (i32.eq (local.get $spec) (i32.const 88)))     ;; 'X'
            (then (local.set $as_int (i32.const 1)) (local.set $base (i32.const 16))))))
      ;; With no Arguments there is nothing to substitute; leaving the insert
      ;; visible beats inventing a value.
      (if (i32.eqz (local.get $args_g))
        (then
          (local.set $o (call $fmsg_put (local.get $dst) (local.get $o) (local.get $max) (i32.const 37)))
          (local.set $o (call $fmsg_put_num (local.get $dst) (local.get $o) (local.get $max)
            (local.get $n) (i32.const 10) (i32.const 0)))
          (br $scan)))
      (local.set $argv (i32.load (call $g2w
        (i32.add (local.get $args_g) (i32.shl (i32.sub (local.get $n) (i32.const 1)) (i32.const 2))))))
      (if (local.get $as_int)
        (then
          (local.set $o (call $fmsg_put_num (local.get $dst) (local.get $o) (local.get $max)
            (local.get $argv) (local.get $base)
            (i32.eq (local.get $spec) (i32.const 100))))
          (br $scan)))
      (if (i32.eqz (local.get $argv)) (then (br $scan)))
      (local.set $p (call $g2w (local.get $argv)))
      (block $str_done (loop $str
        (local.set $ch (i32.load8_u (local.get $p)))
        (br_if $str_done (i32.eqz (local.get $ch)))
        (local.set $o (call $fmsg_put (local.get $dst) (local.get $o) (local.get $max) (local.get $ch)))
        (local.set $p (i32.add (local.get $p) (i32.const 1)))
        (br $str)))
      (br $scan)))
    (if (i32.ne (local.get $dst) (i32.const 0))
      (then
        (if (i32.and (i32.ne (local.get $max) (i32.const 0))
                     (i32.ge_u (local.get $o) (local.get $max)))
          (then (i32.store8 (i32.add (local.get $dst) (i32.sub (local.get $max) (i32.const 1))) (i32.const 0)))
          (else (i32.store8 (i32.add (local.get $dst) (local.get $o)) (i32.const 0))))))
    (local.get $o))

  ;; FORMAT_MESSAGE_FROM_SYSTEM text for a Win32 error code: the template
  ;; (WASM address) as the system's message table has it, CRLF and all, or 0
  ;; when the code is not one we carry. The common file/handle/memory errors
  ;; and the Windows Installer results msiexec reports as system messages (a
  ;; 1619 used to reach the user as "Err"). Every literal lands in the 4 KB
  ;; $WATX_STRING_POOL, which the full memory map cannot grow, so this is the
  ;; short list rather than the whole table.
  (func $system_message_text (param $id i32) (result i32)
    (if (i32.eqz (local.get $id)) (then (return "The operation completed successfully.\r\n")))
    (if (i32.eq (local.get $id) (i32.const 1)) (then (return "Incorrect function.\r\n")))
    (if (i32.eq (local.get $id) (i32.const 2)) (then (return "The system cannot find the file specified.\r\n")))
    (if (i32.eq (local.get $id) (i32.const 3)) (then (return "The system cannot find the path specified.\r\n")))
    (if (i32.eq (local.get $id) (i32.const 5)) (then (return "Access is denied.\r\n")))
    (if (i32.eq (local.get $id) (i32.const 6)) (then (return "The handle is invalid.\r\n")))
    (if (i32.eq (local.get $id) (i32.const 8)) (then (return "Not enough storage is available to process this command.\r\n")))
    (if (i32.eq (local.get $id) (i32.const 87)) (then (return "The parameter is incorrect.\r\n")))
    (if (i32.eq (local.get $id) (i32.const 112)) (then (return "There is not enough space on the disk.\r\n")))
    (if (i32.eq (local.get $id) (i32.const 126)) (then (return "The specified module could not be found.\r\n")))
    (if (i32.eq (local.get $id) (i32.const 127)) (then (return "The specified procedure could not be found.\r\n")))
    (if (i32.eq (local.get $id) (i32.const 183)) (then (return "Cannot create a file when that file already exists.\r\n")))
    (if (i32.eq (local.get $id) (i32.const 1602)) (then (return "User cancelled installation.\r\n")))
    (if (i32.eq (local.get $id) (i32.const 1603)) (then (return "Fatal error during installation.\r\n")))
    (if (i32.eq (local.get $id) (i32.const 1618)) (then (return "Another installation is already in progress.\r\n")))
    (if (i32.eq (local.get $id) (i32.const 1619)) (then (return "This installation package could not be opened.\r\n")))
    (if (i32.eq (local.get $id) (i32.const 1639)) (then (return "Invalid command line argument.\r\n")))
    (i32.const 0))

  ;; Find the message this call names and expand it, as ANSI, into $dst — $max
  ;; bytes, or a measuring pass that writes nothing when $dst is 0. Every
  ;; decision FormatMessage makes is here, so both spellings make it the same
  ;; way; all that differs between them is the encoding on either side.
  ;;
  ;; $fmt_wa is the FORMAT_MESSAGE_FROM_STRING template as a WASM address,
  ;; already ANSI — FormatMessageW narrows the caller's UTF-16 copy before it
  ;; gets here. $source is lpSource as passed, which for FROM_HMODULE names
  ;; the module whose RT_MESSAGETABLE holds the text. Returns the length not
  ;; counting the NUL, which is the true length even when the output was
  ;; truncated to $max.
  (func $format_message_ansi
      (param $flags i32) (param $fmt_wa i32) (param $source i32) (param $msg_id i32)
      (param $args_g i32) (param $dst i32) (param $max i32) (result i32)
    (local $len i32) (local $o i32)
    ;; FORMAT_MESSAGE_FROM_STRING: the caller supplied the template.
    ;; RegEdit uses this for resource strings before CreateWindowEx.
    (if (i32.and (local.get $flags) (i32.const 0x400))
      (then
        (return (call $format_message_expand
          (local.get $fmt_wa) (local.get $dst) (local.get $max) (local.get $args_g)))))
    ;; FORMAT_MESSAGE_FROM_HMODULE: the text lives in the module's
    ;; RT_MESSAGETABLE. winipcfg keeps every label and caption there and asks
    ;; for them one id at a time, so without this its whole UI reads "Error".
    ;; A message-table entry carries inserts too, so it goes through the same
    ;; expansion.
    (if (i32.and (local.get $flags) (i32.const 0x800))
      (then
        (call $push_rsrc_ctx (local.get $source))
        (local.set $len (call $message_table_lookup
          (local.get $msg_id) (global.get $TEXT_SCRATCH)))
        (call $pop_rsrc_ctx)
        (if (i32.ne (local.get $len) (i32.const -1))
          (then
            (return (call $format_message_expand
              (global.get $TEXT_SCRATCH) (local.get $dst) (local.get $max)
              (local.get $args_g)))))))
    ;; FORMAT_MESSAGE_FROM_SYSTEM (also the fallback after a module miss when
    ;; both are given, as in Windows): the system message table.
    (if (i32.and (local.get $flags) (i32.const 0x1000))
      (then
        (local.set $len (call $system_message_text (local.get $msg_id)))
        (if (local.get $len)
          (then
            (return (call $format_message_expand
              (local.get $len) (local.get $dst) (local.get $max) (local.get $args_g)))))))
    ;; Nothing named a message we have: a generic one, written through the same
    ;; bounds-checked put as everything else so a measuring pass stays a
    ;; measuring pass.
    (local.set $o (call $fmsg_put (local.get $dst) (i32.const 0) (local.get $max) (i32.const 69)))   ;; 'E'
    (local.set $o (call $fmsg_put (local.get $dst) (local.get $o) (local.get $max) (i32.const 114))) ;; 'r'
    (local.set $o (call $fmsg_put (local.get $dst) (local.get $o) (local.get $max) (i32.const 114))) ;; 'r'
    (local.set $o (call $fmsg_put (local.get $dst) (local.get $o) (local.get $max) (i32.const 111))) ;; 'o'
    (local.set $o (call $fmsg_put (local.get $dst) (local.get $o) (local.get $max) (i32.const 114))) ;; 'r'
    (if (local.get $dst)
      (then
        (if (i32.and (i32.ne (local.get $max) (i32.const 0))
                     (i32.ge_u (local.get $o) (local.get $max)))
          (then (i32.store8 (i32.add (local.get $dst) (i32.sub (local.get $max) (i32.const 1))) (i32.const 0)))
          (else (i32.store8 (i32.add (local.get $dst) (local.get $o)) (i32.const 0))))))
    (local.get $o))

  ;; 754: FormatMessageA(dwFlags, lpSource, dwMessageId, dwLanguageId, lpBuffer, nSize, Arguments)
  (func $handle_FormatMessageA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32) (local $buf_ga i32) (local $len i32) (local $nSize i32)
    (local $args_g i32) (local $fmt_wa i32)
    ;; dwFlags=arg0, lpSource=arg1, dwMessageId=arg2, dwLangId=arg3, lpBuffer=arg4
    (local.set $nSize (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    ;; Arguments is the 7th parameter. FORMAT_MESSAGE_IGNORE_INSERTS (0x200)
    ;; says to leave %1 and the escapes exactly as they are, and is expressed
    ;; here as "there are no arguments" — which is also what a caller that
    ;; passes none gets, insert text and all. RegEdit's "Cannot create key:
    ;; Error while opening the key %1." used to reach the user with the %1
    ;; still in it, because nothing ever looked at this pointer.
    (local.set $args_g (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
    (if (i32.and (local.get $arg0) (i32.const 0x200))
      (then (local.set $args_g (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))  ;; stdcall, 7 args
    (if (i32.and (local.get $arg0) (i32.const 0x400))
      (then
        ;; FROM_STRING with no string is the one call with nothing to say.
        (if (i32.eqz (local.get $arg1))
          (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
        (local.set $fmt_wa (call $g2w (local.get $arg1)))))
    ;; Measured first, since ALLOCATE_BUFFER has to size the buffer before it
    ;; writes into it.
    (local.set $len (call $format_message_ansi (local.get $arg0) (local.get $fmt_wa)
      (local.get $arg1) (local.get $arg2) (local.get $args_g) (i32.const 0) (i32.const 0)))
    (if (i32.and (local.get $arg0) (i32.const 0x100))
      (then
        (local.set $buf_ga (call $heap_alloc (i32.add (local.get $len) (i32.const 1))))
        (i32.store (call $g2w (local.get $arg4)) (local.get $buf_ga))
        (local.set $wa (call $g2w (local.get $buf_ga)))
        (local.set $nSize (i32.add (local.get $len) (i32.const 1))))
      (else
        (local.set $wa (call $g2w (local.get $arg4)))))
    (drop (call $format_message_ansi (local.get $arg0) (local.get $fmt_wa)
      (local.get $arg1) (local.get $arg2) (local.get $args_g)
      (local.get $wa) (local.get $nSize)))
    (i32.store offset=0 (global.get $reg_base) (local.get $len))
  )

  ;; 755: RegOpenKeyExW(hKey, lpSubKey, ulOptions, samDesired, phkResult) — wide string version
  (func $handle_RegOpenKeyExW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; Use host registry with isWide=1
    (local $result i32)
    (local.set $result (call $host_reg_open_key (local.get $arg0) (call $g2w (local.get $arg1)) (i32.const 1)))
    (if (local.get $result)
      (then
        ;; Store the opened key handle in *phkResult
        (i32.store (call $g2w (local.get $arg4)) (local.get $result))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0)))  ;; ERROR_SUCCESS
      (else
        (i32.store offset=0 (global.get $reg_base) (i32.const 2))))  ;; ERROR_FILE_NOT_FOUND
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))  ;; stdcall, 5 args
  )

  ;; 756: GetShellWindow() — USER's process-wide registered shell owner.
  (func $handle_GetShellWindow (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (global.get $shell_hwnd))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))  ;; stdcall, 0 args
  )

  ;; SetShellWindow(hwndShell) is the Win9x USER32 registration used by the
  ;; stock desktop browser after it creates Program Manager and its shell-view
  ;; children. USER permits the first registration (and an idempotent repeat),
  ;; but does not let an unrelated window silently replace the active shell.
  (func $handle_SetShellWindow (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.or (i32.eqz (global.get $shell_hwnd))
                (i32.eq (global.get $shell_hwnd) (local.get $arg0)))
      (then
        (global.set $shell_hwnd (local.get $arg0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1)))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; PaintDesktop(hdc) is USER's desktop-background painter. The stock Win98
  ;; shell calls it from Program Manager's WM_PAINT handler after registering
  ;; itself with SetShellWindow. A system-color brush is encoded as index+1;
  ;; COLOR_DESKTOP/COLOR_BACKGROUND is index 1, hence brush handle 2.
  (func $handle_PaintDesktop (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $screen i32)
    (local.set $screen (call $host_get_screen_size))
    (i32.store offset=0 (global.get $reg_base) (call $gdi_native_fill_rect
      (local.get $arg0)
      (i32.const 0) (i32.const 0)
      (i32.and (local.get $screen) (i32.const 0xFFFF))
      (i32.shr_u (local.get $screen) (i32.const 16))
      (i32.const 2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )
  ;; Filesystem PIDLs are opaque to applications, but they still obey the
  ;; documented ITEMIDLIST byte contract: one SHITEMID whose cb includes the
  ;; two-byte header, followed by a zero-cb terminator.  Shell namespace
  ;; providers own the bytes in abID; use a private "WAFP" tag plus the ANSI
  ;; filesystem path so SHGetPathFromIDListA can distinguish our filesystem
  ;; items from non-filesystem/foreign PIDLs without guessing a path.
  (func $shell_filesystem_pidl_from_path (param $path i32) (result i32)
    (local $path_wa i32) (local $len i32) (local $cb i32)
    (local $pidl i32) (local $pidl_wa i32)
    (if (i32.eqz (local.get $path)) (then (return (i32.const 0))))
    (local.set $path_wa (call $g2w (local.get $path)))
    (local.set $len (call $strlen (local.get $path_wa)))
    ;; SHGetPathFromIDListA's output contract is MAX_PATH.  Refuse an empty or
    ;; oversized filesystem identity rather than create a PIDL it cannot decode.
    (if (i32.or (i32.eqz (local.get $len))
                (i32.ge_u (local.get $len) (i32.const 260)))
      (then (return (i32.const 0))))
    ;; cb = USHORT header + four-byte provider tag + path including NUL.
    (local.set $cb (i32.add (local.get $len) (i32.const 7)))
    (local.set $pidl (call $heap_alloc (i32.add (local.get $cb) (i32.const 2))))
    (if (i32.eqz (local.get $pidl)) (then (return (i32.const 0))))
    (local.set $pidl_wa (call $g2w (local.get $pidl)))
    (i32.store16 (local.get $pidl_wa) (local.get $cb))
    (i32.store offset=2 align=1 (local.get $pidl_wa) (i32.const 0x50464157)) ;; WAFP
    (call $memcpy
      (i32.add (local.get $pidl_wa) (i32.const 6))
      (local.get $path_wa)
      (i32.add (local.get $len) (i32.const 1)))
    (i32.store16 (i32.add (local.get $pidl_wa) (local.get $cb)) (i32.const 0))
    (local.get $pidl))

  ;; Desktop, My Computer and Network Neighborhood are namespace roots rather
  ;; than filesystem directories.  Give them valid opaque PIDLs too, but a
  ;; different provider tag: SHGetPathFromIDListA must reject these identities.
  (func $shell_virtual_pidl_from_csidl (param $csidl i32) (result i32)
    (local $pidl i32) (local $pidl_wa i32)
    (local.set $pidl (call $heap_alloc (i32.const 12)))
    (if (i32.eqz (local.get $pidl)) (then (return (i32.const 0))))
    (local.set $pidl_wa (call $g2w (local.get $pidl)))
    (i32.store16 (local.get $pidl_wa) (i32.const 10))
    (i32.store offset=2 align=1 (local.get $pidl_wa) (i32.const 0x50564157)) ;; WAVP
    (i32.store offset=6 align=1 (local.get $pidl_wa) (local.get $csidl))
    (i32.store16 offset=10 (local.get $pidl_wa) (i32.const 0))
    (local.get $pidl))

  (func $shell_filesystem_pidl_copy_path
    (param $pidl i32) (param $path i32) (result i32)
    (local $pidl_wa i32) (local $path_wa i32) (local $cb i32)
    (local $capacity i32) (local $len i32) (local $ch i32)
    (if (i32.or (i32.eqz (local.get $pidl)) (i32.eqz (local.get $path)))
      (then (return (i32.const 0))))
    (local.set $pidl_wa (call $g2w (local.get $pidl)))
    (local.set $path_wa (call $g2w (local.get $path)))
    (i32.store8 (local.get $path_wa) (i32.const 0))
    (local.set $cb (i32.load16_u (local.get $pidl_wa)))
    ;; Minimum useful item is cb + tag + one path byte + NUL; cap at the
    ;; largest single item our MAX_PATH representation can produce.
    (if (i32.or (i32.lt_u (local.get $cb) (i32.const 8))
                (i32.gt_u (local.get $cb) (i32.const 266)))
      (then (return (i32.const 0))))
    (if (i32.ne (i32.load offset=2 align=1 (local.get $pidl_wa))
                (i32.const 0x50464157))
      (then (return (i32.const 0))))
    ;; An ITEMIDLIST ends with a zero-sized SHITEMID after the final item.
    (if (i32.ne (i32.load16_u (i32.add (local.get $pidl_wa) (local.get $cb)))
                (i32.const 0))
      (then (return (i32.const 0))))
    (local.set $capacity (i32.sub (local.get $cb) (i32.const 6)))
    (local.set $len (i32.const 0))
    (block $terminated
      (loop $scan
        (br_if $terminated (i32.ge_u (local.get $len) (local.get $capacity)))
        (local.set $ch
          (i32.load8_u
            (i32.add (i32.add (local.get $pidl_wa) (i32.const 6))
                     (local.get $len))))
        (if (i32.eqz (local.get $ch))
          (then
            (if (i32.eqz (local.get $len)) (then (return (i32.const 0))))
            (call $memcpy (local.get $path_wa)
              (i32.add (local.get $pidl_wa) (i32.const 6))
              (i32.add (local.get $len) (i32.const 1)))
            (return (i32.const 1))))
        (local.set $len (i32.add (local.get $len) (i32.const 1)))
        (br $scan)))
    (i32.const 0))

  ;; 758: SHGetSpecialFolderLocation(hwndOwner, nFolder, ppidl)
  (func $handle_SHGetSpecialFolderLocation (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $saved_esp i32) (local $path i32) (local $pidl i32) (local $folder i32)
    (if (i32.eqz (local.get $arg2))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)) ;; E_POINTER
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (call $gs32 (local.get $arg2) (i32.const 0))
    (local.set $folder (i32.and (local.get $arg1) (i32.const 0x00ff)))
    ;; WinRAR asks for all three while building its "Look in" namespace:
    ;; CSIDL_DESKTOP (0), CSIDL_DRIVES (0x11), CSIDL_NETWORK (0x12).
    (if (i32.or
          (i32.eqz (local.get $folder))
          (i32.or (i32.eq (local.get $folder) (i32.const 0x11))
                  (i32.eq (local.get $folder) (i32.const 0x12))))
      (then
        (local.set $pidl (call $shell_virtual_pidl_from_csidl (local.get $folder)))
        (if (i32.eqz (local.get $pidl))
          (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000E))) ;; E_OUTOFMEMORY
          (else
            (call $gs32 (local.get $arg2) (local.get $pidl))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0)))) ;; S_OK
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (local.set $path (call $heap_alloc (i32.const 260)))
    (if (i32.eqz (local.get $path))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000E)) ;; E_OUTOFMEMORY
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    ;; Share the established CSIDL mapping instead of maintaining a second,
    ;; inevitably divergent special-folder table.  Restore the outer stdcall
    ;; frame after invoking the ANSI path handler directly.
    (local.set $saved_esp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_SHGetSpecialFolderPathA
      (local.get $arg0) (local.get $path) (local.get $arg1) (i32.const 0)
      (i32.const 0) (local.get $name_ptr))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved_esp))
    (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
      (then
        (call $heap_free (local.get $path))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070002)) ;; HRESULT_FROM_WIN32(ERROR_FILE_NOT_FOUND)
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (local.set $pidl (call $shell_filesystem_pidl_from_path (local.get $path)))
    (call $heap_free (local.get $path))
    (if (i32.eqz (local.get $pidl))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000E)) ;; E_OUTOFMEMORY
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (call $gs32 (local.get $arg2) (local.get $pidl))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))  ;; S_OK
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))  ;; stdcall, 3 args
  )

  ;; SHGetDesktopFolder(ppshf) — bounded desktop namespace shim.  The folder
  ;; exposes only the virtual roots for which this runtime has canonical PIDL,
  ;; name and attribute support: My Computer and Network Neighborhood.
  (func $handle_SHGetDesktopFolder (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $vtbl i32) (local $obj i32)
    (if (i32.eqz (local.get $arg0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)) ;; E_POINTER
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (local.set $vtbl (call $init_com_vtable (i32.const 2482) (i32.const 13)))
    (local.set $obj (call $dx_create_com_obj (i32.const 32) (local.get $vtbl)))
    (call $gs32 (local.get $arg0) (local.get $obj))
    (i32.store offset=0 (global.get $reg_base) (select (i32.const 0) (i32.const 0x8007000E) (i32.ne (local.get $obj) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; SHChangeNotify(wEventId, uFlags, dwItem1, dwItem2) broadcasts a shell
  ;; namespace change and returns no value. WineAssembly has no Explorer
  ;; process or registered shell notification sinks in an app instance, so
  ;; delivery has no observers. SHCNF_FLUSH is therefore already satisfied
  ;; when this handler returns. In particular, SHCNE_MKDIR is only a notice:
  ;; the caller remains responsible for creating the directory itself.
  (func $handle_SHChangeNotify (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  (func $handle_IShellFolder_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; IID_IShellFolder {000214E6-0000-0000-C000-000000000046}.
    (i32.store offset=0 (global.get $reg_base) (call $dx_query_interface_single
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (i32.const 0x000214E6) (i32.const 0)
      (i32.const 0x000000C0) (i32.const 0x46000000)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))
  (func $handle_IShellFolder_AddRef (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_dx_com_addref
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))
  (func $handle_IShellFolder_Release (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_dx_com_release_basic
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; Shell callers hand these methods pointers rather than sizes. Prove every
  ;; fixed-size field is one mapped affine span before touching it; $g2w's
  ;; unmapped sentinel is otherwise readable and would turn a bad out pointer
  ;; into a plausible successful result.
  (func $shell_guest_range_mapped (param $ptr i32) (param $size i32) (result i32)
    (if (i32.or (i32.eqz (local.get $ptr)) (i32.eqz (local.get $size)))
      (then (return (i32.const 0))))
    (i32.ne
      (call $g2w_affine_span (local.get $ptr) (local.get $size))
      (global.get $NULL_SENTINEL)))

  ;; A private filesystem item must fit SHGetPathFromIDList's MAX_PATH
  ;; contract. Return -2 for an unmapped input and -1 for a name that does not
  ;; terminate within MAX_PATH.
  (func $shell_wide_name_length (param $name i32) (result i32)
    (local $i i32) (local $p i32)
    (if (i32.eqz (local.get $name)) (then (return (i32.const -2))))
    (block $too_long
      (loop $scan
        (br_if $too_long (i32.ge_u (local.get $i) (i32.const 260)))
        (local.set $p
          (i32.add (local.get $name) (i32.shl (local.get $i) (i32.const 1))))
        (if (i32.eqz (call $shell_guest_range_mapped (local.get $p) (i32.const 2)))
          (then (return (i32.const -2))))
        (if (i32.eqz (call $gl16 (local.get $p)))
          (then (return (local.get $i))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $scan)))
    (i32.const -1))

  (func $shell_guid_hex_part
      (param $name i32) (param $start i32) (param $count i32) (result i32)
    (local $i i32) (local $ch i32) (local $digit i32) (local $value i32)
    (block $done
      (loop $digits
        (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
        (local.set $ch
          (call $gl16
            (i32.add (local.get $name)
              (i32.shl (i32.add (local.get $start) (local.get $i)) (i32.const 1)))))
        (if (i32.and (i32.ge_u (local.get $ch) (i32.const 0x30))
                     (i32.le_u (local.get $ch) (i32.const 0x39)))
          (then (local.set $digit (i32.sub (local.get $ch) (i32.const 0x30))))
          (else
            (local.set $ch (i32.or (local.get $ch) (i32.const 0x20)))
            (if (i32.and (i32.ge_u (local.get $ch) (i32.const 0x61))
                         (i32.le_u (local.get $ch) (i32.const 0x66)))
              (then (local.set $digit (i32.sub (local.get $ch) (i32.const 0x57))))
              (else (return (i32.const -1))))))
        (local.set $value
          (i32.or (i32.shl (local.get $value) (i32.const 4)) (local.get $digit)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $digits)))
    (local.get $value))

  ;; Parse exactly the desktop namespace syntax documented for virtual folder
  ;; CLSIDs. The result is CSIDL+1 so CSIDL_DESKTOP remains distinguishable
  ;; from malformed syntax.
  (func $shell_virtual_csidl_from_wide (param $name i32) (param $len i32) (result i32)
    (local $d1 i32) (local $d2 i32) (local $d3 i32)
    (local $d4a i32) (local $d4b i32) (local $d4c i32)
    (if (i32.ne (local.get $len) (i32.const 40))
      (then (return (i32.const 0))))
    (if (i32.or
          (i32.or
            (i32.ne (call $gl16 (local.get $name)) (i32.const 58))
            (i32.ne (call $gl16 (i32.add (local.get $name) (i32.const 2))) (i32.const 58)))
          (i32.or
            (i32.ne (call $gl16 (i32.add (local.get $name) (i32.const 4))) (i32.const 123))
            (i32.ne (call $gl16 (i32.add (local.get $name) (i32.const 78))) (i32.const 125))))
      (then (return (i32.const 0))))
    ;; Hyphens after 8-4-4-4 hexadecimal digits.
    (if (i32.or
          (i32.or
            (i32.ne (call $gl16 (i32.add (local.get $name) (i32.const 22))) (i32.const 45))
            (i32.ne (call $gl16 (i32.add (local.get $name) (i32.const 32))) (i32.const 45)))
          (i32.or
            (i32.ne (call $gl16 (i32.add (local.get $name) (i32.const 42))) (i32.const 45))
            (i32.ne (call $gl16 (i32.add (local.get $name) (i32.const 52))) (i32.const 45))))
      (then (return (i32.const 0))))
    (local.set $d1 (call $shell_guid_hex_part (local.get $name) (i32.const 3) (i32.const 8)))
    (local.set $d2 (call $shell_guid_hex_part (local.get $name) (i32.const 12) (i32.const 4)))
    (local.set $d3 (call $shell_guid_hex_part (local.get $name) (i32.const 17) (i32.const 4)))
    (local.set $d4a (call $shell_guid_hex_part (local.get $name) (i32.const 22) (i32.const 4)))
    (local.set $d4b (call $shell_guid_hex_part (local.get $name) (i32.const 27) (i32.const 4)))
    (local.set $d4c (call $shell_guid_hex_part (local.get $name) (i32.const 31) (i32.const 8)))
    (if (i32.and
          (i32.and (i32.eq (local.get $d1) (i32.const 0x00021400))
                   (i32.eqz (local.get $d2)))
          (i32.and
            (i32.and (i32.eqz (local.get $d3))
                     (i32.eq (local.get $d4a) (i32.const 0xC000)))
            (i32.and (i32.eqz (local.get $d4b))
                     (i32.eq (local.get $d4c) (i32.const 0x00000046)))))
      (then (return (i32.const 1)))) ;; CSIDL_DESKTOP + 1
    (if (i32.and
          (i32.and (i32.eq (local.get $d2) (i32.const 0x3AEA))
                   (i32.eq (local.get $d3) (i32.const 0x1069)))
          (i32.and (i32.eq (local.get $d4b) (i32.const 0x0800))
                   (i32.eq (local.get $d4c) (i32.const 0x2B30309D))))
      (then
        (if (i32.and
              (i32.eq (local.get $d1) (i32.const 0x20D04FE0))
              (i32.eq (local.get $d4a) (i32.const 0xA2D8)))
          (then (return (i32.const 0x12)))) ;; CSIDL_DRIVES + 1
        (if (i32.and
              (i32.eq (local.get $d1) (i32.const 0x208D2C60))
              (i32.eq (local.get $d4a) (i32.const 0xA2D7)))
          (then (return (i32.const 0x13)))))) ;; CSIDL_NETWORK + 1
    (i32.const 0))

  (func $shell_ansi_path_is_absolute (param $path i32) (param $len i32) (result i32)
    (local $c0 i32)
    (if (i32.ge_u (local.get $len) (i32.const 3))
      (then
        (local.set $c0 (i32.or (call $gl8 (local.get $path)) (i32.const 0x20)))
        (if (i32.and
              (i32.and (i32.ge_u (local.get $c0) (i32.const 0x61))
                       (i32.le_u (local.get $c0) (i32.const 0x7A)))
              (i32.and
                (i32.eq (call $gl8 (i32.add (local.get $path) (i32.const 1))) (i32.const 58))
                (i32.or
                  (i32.eq (call $gl8 (i32.add (local.get $path) (i32.const 2))) (i32.const 47))
                  (i32.eq (call $gl8 (i32.add (local.get $path) (i32.const 2))) (i32.const 92)))))
          (then (return (i32.const 1))))))
    ;; A UNC name needs two separators and at least one server-name byte.
    (if (i32.ge_u (local.get $len) (i32.const 3))
      (then
        (if (i32.and
              (i32.or (i32.eq (call $gl8 (local.get $path)) (i32.const 47))
                      (i32.eq (call $gl8 (local.get $path)) (i32.const 92)))
              (i32.and
                (i32.or
                  (i32.eq (call $gl8 (i32.add (local.get $path) (i32.const 1))) (i32.const 47))
                  (i32.eq (call $gl8 (i32.add (local.get $path) (i32.const 1))) (i32.const 92)))
                (i32.ne (call $gl8 (i32.add (local.get $path) (i32.const 2))) (i32.const 0))))
          (then (return (i32.const 1))))))
    (i32.const 0))

  (func $handle_IShellFolder_ParseDisplayName (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ppidl i32) (local $attributes_ptr i32) (local $attributes i32)
    (local $len i32) (local $virtual i32) (local $pidl i32)
    (local $narrow i32) (local $file_attrs i32) (local $actual i32)
    ;; this, hwnd, pbc, pszDisplayName, pchEaten are in arg0..arg4;
    ;; ppidl and pdwAttributes are the sixth and seventh COM arguments.
    (local.set $ppidl (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (local.set $attributes_ptr (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
    (if (i32.eqz (call $shell_guest_range_mapped (local.get $ppidl) (i32.const 4)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)) (return))) ;; E_POINTER
    (call $gs32 (local.get $ppidl) (i32.const 0))
    (if (local.get $arg4)
      (then
        (if (i32.eqz (call $shell_guest_range_mapped (local.get $arg4) (i32.const 4)))
          (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)) (return)))
        (call $gs32 (local.get $arg4) (i32.const 0))))
    (if (local.get $attributes_ptr)
      (then
        (if (i32.eqz
              (call $shell_guest_range_mapped (local.get $attributes_ptr) (i32.const 4)))
          (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)) (return)))
        (local.set $attributes (call $gl32 (local.get $attributes_ptr)))))
    (local.set $len (call $shell_wide_name_length (local.get $arg3)))
    (if (i32.eq (local.get $len) (i32.const -2))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)) (return))) ;; E_POINTER
    (if (i32.le_s (local.get $len) (i32.const 0))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) (return))) ;; E_INVALIDARG
    (local.set $virtual
      (call $shell_virtual_csidl_from_wide (local.get $arg3) (local.get $len)))
    (if (local.get $virtual)
      (then
        (local.set $pidl
          (call $shell_virtual_pidl_from_csidl
            (i32.sub (local.get $virtual) (i32.const 1))))
        (if (i32.eqz (local.get $pidl))
          (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000E)) (return))) ;; E_OUTOFMEMORY
        (local.set $actual
          (call $shell_private_pidl_sfgao (local.get $pidl))))
      (else
        (local.set $narrow (call $heap_alloc (i32.add (local.get $len) (i32.const 1))))
        (if (i32.eqz (local.get $narrow))
          (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000E)) (return)))
        ;; The private PIDL is ANSI. Reject code points the runtime's one-byte
        ;; Win98 code-page model cannot preserve instead of aliasing a name by
        ;; silently discarding its high byte.
        (local.set $file_attrs (i32.const 0))
        (block $converted
          (loop $narrow_chars
            (if (i32.ge_u (local.get $file_attrs) (local.get $len))
              (then (br $converted)))
            (if (i32.gt_u
                  (call $gl16
                    (i32.add (local.get $arg3)
                      (i32.shl (local.get $file_attrs) (i32.const 1))))
                  (i32.const 0xFF))
              (then
                (call $heap_free (local.get $narrow))
                (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070459)) ;; ERROR_NO_UNICODE_TRANSLATION
                (return)))
            (call $gs8
              (i32.add (local.get $narrow) (local.get $file_attrs))
              (call $gl16
                (i32.add (local.get $arg3)
                  (i32.shl (local.get $file_attrs) (i32.const 1)))))
            (local.set $file_attrs (i32.add (local.get $file_attrs) (i32.const 1)))
            (br $narrow_chars)))
        (call $gs8 (i32.add (local.get $narrow) (local.get $len)) (i32.const 0))
        (if (i32.eqz
              (call $shell_ansi_path_is_absolute (local.get $narrow) (local.get $len)))
          (then
            (call $heap_free (local.get $narrow))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057))
            (return)))
        ;; ParseDisplayName validates the object unless a bind-context
        ;; extension says otherwise; this bounded folder supports no such
        ;; extensions.
        (local.set $file_attrs
          (call $host_fs_get_file_attributes (call $g2w (local.get $narrow)) (i32.const 0)))
        (if (i32.eq (local.get $file_attrs) (i32.const -1))
          (then
            (call $heap_free (local.get $narrow))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070002))
            (return)))
        (local.set $pidl (call $shell_filesystem_pidl_from_path (local.get $narrow)))
        (call $heap_free (local.get $narrow))
        (if (i32.eqz (local.get $pidl))
          (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000E)) (return)))
        (local.set $actual
          (i32.and
            (call $sh_file_sfgao
              (call $g2w (i32.add (local.get $pidl) (i32.const 6)))
              (local.get $file_attrs))
            (i32.const 0x70080000)))))
    (call $gs32 (local.get $ppidl) (local.get $pidl))
    (if (local.get $arg4) (then (call $gs32 (local.get $arg4) (local.get $len))))
    (if (local.get $attributes_ptr)
      (then
        (call $gs32 (local.get $attributes_ptr)
          (i32.and (local.get $attributes) (local.get $actual)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))) ;; S_OK
  (func $handle_IShellFolder_EnumObjects (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $vtbl i32) (local $obj i32) (local $entry i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
    (if (i32.eqz (call $shell_guest_range_mapped (local.get $arg3) (i32.const 4)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003))
        (return)))
    (call $gs32 (local.get $arg3) (i32.const 0))
    ;; EnumObjects is a method on the one desktop-folder object kind.  Reject a
    ;; stale/cross-interface pointer before $dx_from_this can turn its wrapper
    ;; slot into plausible enumeration state.
    (if (i32.eqz (call $shell_guest_range_mapped (local.get $arg0) (i32.const 8)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) (return)))
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (if (i32.ne (load.field DxObject type (local.get $entry)) (i32.const 32))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) (return)))
    (local.set $vtbl (call $init_com_vtable (i32.const 2495) (i32.const 7)))
    (local.set $obj (call $dx_create_com_obj (i32.const 33) (local.get $vtbl)))
    (if (i32.eqz (local.get $obj))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000E)) (return)))
    ;; Type-33 owns these two fields: misc0 is the requested SHCONTF word and
    ;; misc1 is the next supported desktop child (0..2).  Each EnumObjects call
    ;; therefore has an independent cursor even when callers interleave them.
    (local.set $entry (call $dx_from_this (local.get $obj)))
    (store.field DxObject misc0 (local.get $entry) (local.get $arg2))
    (store.field DxObject misc1 (local.get $entry) (i32.const 0))
    (call $gs32 (local.get $arg3) (local.get $obj))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
  (func $handle_IShellFolder_BindToObject (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg4) (then (call $gs32 (local.get $arg4) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
  (func $handle_IShellFolder_BindToStorage (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg4) (then (call $gs32 (local.get $arg4) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
  ;; Validate the single-item private PIDLs created above. Return 1 for a
  ;; filesystem path, 2 for a virtual CSIDL root, or 0 for a foreign/malformed
  ;; ITEMIDLIST. Besides protecting the comparison, checking the terminating
  ;; zero-sized SHITEMID means equality covers the complete list we own.
  (func $shell_private_pidl_kind (param $pidl i32) (result i32)
    (local $wa i32) (local $cb i32) (local $tag i32) (local $csidl i32)
    (local $capacity i32) (local $i i32)
    (if (i32.eqz (call $shell_guest_range_mapped (local.get $pidl) (i32.const 6)))
      (then (return (i32.const 0))))
    (local.set $wa (call $g2w (local.get $pidl)))
    (local.set $cb (i32.load16_u (local.get $wa)))
    (local.set $tag (i32.load offset=2 align=1 (local.get $wa)))
    (if (i32.and
          (i32.eq (local.get $tag) (i32.const 0x50564157)) ;; WAVP
          (i32.eq (local.get $cb) (i32.const 10)))
      (then
        (if (i32.eqz
              (call $shell_guest_range_mapped (local.get $pidl) (i32.const 12)))
          (then (return (i32.const 0))))
        (local.set $csidl (i32.load offset=6 align=1 (local.get $wa)))
        (if (i32.and
              (i32.eqz (i32.load16_u offset=10 (local.get $wa)))
              (i32.or
                (i32.eqz (local.get $csidl))
                (i32.or (i32.eq (local.get $csidl) (i32.const 0x11))
                        (i32.eq (local.get $csidl) (i32.const 0x12)))))
          (then (return (i32.const 2))))))
    (if (i32.or
          (i32.ne (local.get $tag) (i32.const 0x50464157)) ;; WAFP
          (i32.or (i32.lt_u (local.get $cb) (i32.const 8))
                  (i32.gt_u (local.get $cb) (i32.const 266))))
      (then (return (i32.const 0))))
    (if (i32.eqz
          (call $shell_guest_range_mapped
            (local.get $pidl) (i32.add (local.get $cb) (i32.const 2))))
      (then (return (i32.const 0))))
    (if (i32.ne (i32.load16_u (i32.add (local.get $wa) (local.get $cb)))
                (i32.const 0))
      (then (return (i32.const 0))))
    (local.set $capacity (i32.sub (local.get $cb) (i32.const 6)))
    (block $invalid
      (loop $scan
        (br_if $invalid (i32.ge_u (local.get $i) (local.get $capacity)))
        (if (i32.eqz
              (i32.load8_u
                (i32.add (i32.add (local.get $wa) (i32.const 6)) (local.get $i))))
          (then
            (if (local.get $i) (then (return (i32.const 1))))
            (return (i32.const 0))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $scan)))
    (i32.const 0))

  ;; Return this folder's established SFGAO view, 0 for a stale filesystem
  ;; item, or -1 for a foreign/malformed PIDL.
  (func $shell_private_pidl_sfgao (param $pidl i32) (result i32)
    (local $kind i32) (local $attrs i32)
    (local.set $kind (call $shell_private_pidl_kind (local.get $pidl)))
    (if (i32.eqz (local.get $kind)) (then (return (i32.const -1))))
    (if (i32.eq (local.get $kind) (i32.const 2))
      (then
        (return
          (i32.and (call $sh_file_sfgao (i32.const 0) (i32.const 0x10))
            (i32.const 0x70080000)))))
    (local.set $attrs
      (call $host_fs_get_file_attributes
        (call $g2w (i32.add (local.get $pidl) (i32.const 6))) (i32.const 0)))
    (if (i32.eq (local.get $attrs) (i32.const -1))
      (then (return (i32.const 0))))
    ;; This IShellFolder's GetUIObjectOf and mutation methods remain
    ;; unsupported. Do not advertise capability or DROPTARGET bits merely
    ;; because the shared SHGetFileInfo classifier exposes them elsewhere.
    (i32.and
      (call $sh_file_sfgao
        (call $g2w (i32.add (local.get $pidl) (i32.const 6)))
        (local.get $attrs))
      (i32.const 0x70080000)))

  ;; CompareIDs returns the ordering as a signed value in HRESULT_CODE. The
  ;; Win98 desktop folder's default rule is name order. Our relative PIDLs
  ;; contain either a case-insensitive Win32 filesystem path or a stable CSIDL
  ;; identity, so those private fields are the canonical names to compare.
  (func $handle_IShellFolder_CompareIDs (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $left_kind i32) (local $right_kind i32) (local $cmp i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
    ;; This minimal folder defines only column zero (name). Upper SHCIDS flags
    ;; do not change the canonical comparison of our one-field PIDLs.
    (if (i32.ne (i32.and (local.get $arg1) (i32.const 0xFFFF)) (i32.const 0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) ;; E_INVALIDARG
        (return)))
    (local.set $left_kind (call $shell_private_pidl_kind (local.get $arg2)))
    (local.set $right_kind (call $shell_private_pidl_kind (local.get $arg3)))
    (if (i32.or (i32.eqz (local.get $left_kind)) (i32.eqz (local.get $right_kind)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) ;; E_INVALIDARG
        (return)))
    (if (i32.ne (local.get $left_kind) (local.get $right_kind))
      (then
        ;; Namespace roots sort before filesystem children.
        (i32.store offset=0 (global.get $reg_base) (select (i32.const 0x0000FFFF) (i32.const 1)
            (i32.gt_u (local.get $left_kind) (local.get $right_kind))))
        (return)))
    (if (i32.eq (local.get $left_kind) (i32.const 1))
      (then
        (local.set $cmp
          (call $guest_stricmp
            (i32.add (local.get $arg2) (i32.const 6))
            (i32.add (local.get $arg3) (i32.const 6)))))
      (else
        (local.set $cmp
          (i32.sub
            (i32.load offset=6 align=1 (call $g2w (local.get $arg2)))
            (i32.load offset=6 align=1 (call $g2w (local.get $arg3)))))))
    (i32.store offset=0 (global.get $reg_base) (if (result i32) (i32.lt_s (local.get $cmp) (i32.const 0))
        (then (i32.const 0x0000FFFF))
        (else (i32.gt_s (local.get $cmp) (i32.const 0))))))
  (func $handle_IShellFolder_CreateViewObject (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg3) (then (call $gs32 (local.get $arg3) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))
  (func $handle_IShellFolder_GetAttributesOf (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $i i32) (local $pidl i32) (local $actual i32) (local $common i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
    (if (i32.eqz (call $shell_guest_range_mapped (local.get $arg3) (i32.const 4)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)) (return))) ;; E_POINTER
    (local.set $common (call $gl32 (local.get $arg3)))
    ;; cidl==0 is the documented cache-refresh form. This folder caches no
    ;; attributes, so the refresh is complete and has no item flags to return.
    (if (i32.eqz (local.get $arg1))
      (then
        (call $gs32 (local.get $arg3) (i32.const 0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (if (i32.eqz (local.get $arg2))
      (then
        (call $gs32 (local.get $arg3) (i32.const 0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003))
        (return)))
    (if (i32.gt_u (local.get $arg1) (i32.const 0x3FFFFFFF))
      (then
        (call $gs32 (local.get $arg3) (i32.const 0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057))
        (return)))
    (if (i32.eqz
          (call $shell_guest_range_mapped
            (local.get $arg2) (i32.shl (local.get $arg1) (i32.const 2))))
      (then
        (call $gs32 (local.get $arg3) (i32.const 0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003))
        (return)))
    (block $done
      (loop $items
        (br_if $done (i32.ge_u (local.get $i) (local.get $arg1)))
        (if (i32.eqz
              (call $shell_guest_range_mapped
                (i32.add (local.get $arg2) (i32.shl (local.get $i) (i32.const 2)))
                (i32.const 4)))
          (then
            (call $gs32 (local.get $arg3) (i32.const 0))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003))
            (return)))
        (local.set $pidl
          (call $gl32
            (i32.add (local.get $arg2) (i32.shl (local.get $i) (i32.const 2)))))
        (local.set $actual (call $shell_private_pidl_sfgao (local.get $pidl)))
        (if (i32.eq (local.get $actual) (i32.const -1))
          (then
            (call $gs32 (local.get $arg3) (i32.const 0))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) ;; E_INVALIDARG
            (return)))
        (if (i32.eqz (local.get $actual))
          (then
            (call $gs32 (local.get $arg3) (i32.const 0))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070002)) ;; stale item
            (return)))
        ;; The in/out word is both the query mask and the intersection across
        ;; every requested child. Never manufacture an unspecified flag.
        (local.set $common (i32.and (local.get $common) (local.get $actual)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $items)))
    (call $gs32 (local.get $arg3) (local.get $common))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
  (func $handle_IShellFolder_GetUIObjectOf (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32))))

  ;; Write one of the three Win98 desktop namespace names into STRRET.cStr.
  ;; STRRET_CSTR keeps ownership entirely in the caller's 264-byte structure,
  ;; which is the native pre-Unicode shell form and needs no hidden allocation.
  (func $shell_virtual_strret_cstr
      (param $strret i32) (param $csidl i32) (param $parsing i32)
    (local $dst i32)
    (local.set $dst (i32.add (local.get $strret) (i32.const 4)))
    (call $gs32 (local.get $strret) (i32.const 2)) ;; STRRET_CSTR
    (if (local.get $parsing)
      (then
        (if (i32.eqz (local.get $csidl))
          (then
            ;; ::{00021400-0000-0000-C000-000000000046}
            (call $gs32 (local.get $dst) (i32.const 0x307B3A3A))
            (call $gs32 (i32.add (local.get $dst) (i32.const 4)) (i32.const 0x31323030))
            (call $gs32 (i32.add (local.get $dst) (i32.const 8)) (i32.const 0x2D303034))
            (call $gs32 (i32.add (local.get $dst) (i32.const 12)) (i32.const 0x30303030))
            (call $gs32 (i32.add (local.get $dst) (i32.const 16)) (i32.const 0x3030302D))
            (call $gs32 (i32.add (local.get $dst) (i32.const 20)) (i32.const 0x30432D30))
            (call $gs32 (i32.add (local.get $dst) (i32.const 24)) (i32.const 0x302D3030))
            (call $gs32 (i32.add (local.get $dst) (i32.const 28)) (i32.const 0x30303030))
            (call $gs32 (i32.add (local.get $dst) (i32.const 32)) (i32.const 0x30303030))
            (call $gs32 (i32.add (local.get $dst) (i32.const 36)) (i32.const 0x7D363430))
            (call $gs8 (i32.add (local.get $dst) (i32.const 40)) (i32.const 0))
            (return)))
        (if (i32.eq (local.get $csidl) (i32.const 0x11))
          (then
            ;; ::{20D04FE0-3AEA-1069-A2D8-08002B30309D}
            (call $gs32 (local.get $dst) (i32.const 0x327B3A3A))
            (call $gs32 (i32.add (local.get $dst) (i32.const 4)) (i32.const 0x34304430))
            (call $gs32 (i32.add (local.get $dst) (i32.const 8)) (i32.const 0x2D304546))
            (call $gs32 (i32.add (local.get $dst) (i32.const 12)) (i32.const 0x41454133))
            (call $gs32 (i32.add (local.get $dst) (i32.const 16)) (i32.const 0x3630312D))
            (call $gs32 (i32.add (local.get $dst) (i32.const 20)) (i32.const 0x32412D39))
            (call $gs32 (i32.add (local.get $dst) (i32.const 24)) (i32.const 0x302D3844))
            (call $gs32 (i32.add (local.get $dst) (i32.const 28)) (i32.const 0x32303038))
            (call $gs32 (i32.add (local.get $dst) (i32.const 32)) (i32.const 0x33303342))
            (call $gs32 (i32.add (local.get $dst) (i32.const 36)) (i32.const 0x7D443930))
            (call $gs8 (i32.add (local.get $dst) (i32.const 40)) (i32.const 0))
            (return)))
        ;; ::{208D2C60-3AEA-1069-A2D7-08002B30309D}
        (call $gs32 (local.get $dst) (i32.const 0x327B3A3A))
        (call $gs32 (i32.add (local.get $dst) (i32.const 4)) (i32.const 0x32443830))
        (call $gs32 (i32.add (local.get $dst) (i32.const 8)) (i32.const 0x2D303643))
        (call $gs32 (i32.add (local.get $dst) (i32.const 12)) (i32.const 0x41454133))
        (call $gs32 (i32.add (local.get $dst) (i32.const 16)) (i32.const 0x3630312D))
        (call $gs32 (i32.add (local.get $dst) (i32.const 20)) (i32.const 0x32412D39))
        (call $gs32 (i32.add (local.get $dst) (i32.const 24)) (i32.const 0x302D3744))
        (call $gs32 (i32.add (local.get $dst) (i32.const 28)) (i32.const 0x32303038))
        (call $gs32 (i32.add (local.get $dst) (i32.const 32)) (i32.const 0x33303342))
        (call $gs32 (i32.add (local.get $dst) (i32.const 36)) (i32.const 0x7D443930))
        (call $gs8 (i32.add (local.get $dst) (i32.const 40)) (i32.const 0))
        (return)))
    (if (i32.eqz (local.get $csidl))
      (then
        (call $gs32 (local.get $dst) (i32.const 0x6B736544)) ;; Desk
        (call $gs32 (i32.add (local.get $dst) (i32.const 4))
          (i32.const 0x00706F74)) ;; top\0
        (return)))
    (if (i32.eq (local.get $csidl) (i32.const 0x11))
      (then
        (call $gs32 (local.get $dst) (i32.const 0x4320794D)) ;; My C
        (call $gs32 (i32.add (local.get $dst) (i32.const 4))
          (i32.const 0x75706D6F)) ;; ompu
        (call $gs32 (i32.add (local.get $dst) (i32.const 8))
          (i32.const 0x00726574)) ;; ter\0
        (return)))
    (call $gs32 (local.get $dst) (i32.const 0x7774654E)) ;; Netw
    (call $gs32 (i32.add (local.get $dst) (i32.const 4))
      (i32.const 0x206B726F)) ;; ork_
    (call $gs32 (i32.add (local.get $dst) (i32.const 8))
      (i32.const 0x6769654E)) ;; Neig
    (call $gs32 (i32.add (local.get $dst) (i32.const 12))
      (i32.const 0x726F6268)) ;; hbor
    (call $gs32 (i32.add (local.get $dst) (i32.const 16))
      (i32.const 0x646F6F68)) ;; hood
    (call $gs8 (i32.add (local.get $dst) (i32.const 20)) (i32.const 0)))

  (func $handle_IShellFolder_GetDisplayNameOf (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $kind i32) (local $offset i32) (local $scan i32) (local $ch i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
    (if (i32.eqz
          (call $shell_guest_range_mapped (local.get $arg3) (i32.const 264)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)) (return))) ;; E_POINTER
    ;; Leave a valid empty STRRET_CSTR on every item-validation failure.
    (call $gs32 (local.get $arg3) (i32.const 2))
    (call $gs8 (i32.add (local.get $arg3) (i32.const 4)) (i32.const 0))
    (local.set $kind (call $shell_private_pidl_kind (local.get $arg1)))
    (if (i32.eqz (local.get $kind))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) (return))) ;; E_INVALIDARG
    (if (i32.eq (local.get $kind) (i32.const 2))
      (then
        (call $shell_virtual_strret_cstr
          (local.get $arg3)
          (i32.load offset=6 align=1 (call $g2w (local.get $arg1)))
          (i32.and
            (i32.ne (i32.and (local.get $arg2) (i32.const 0x8000)) (i32.const 0))
            (i32.eqz (i32.and (local.get $arg2) (i32.const 1)))))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    ;; Filesystem bytes already live inside the caller-owned PIDL. STRRET_OFFSET
    ;; exposes either the absolute parsing path or its final display component
    ;; without allocating a second buffer.
    (local.set $offset (i32.const 6))
    (if (i32.eqz
          (i32.and
            (i32.ne (i32.and (local.get $arg2) (i32.const 0x8000)) (i32.const 0))
            (i32.eqz (i32.and (local.get $arg2) (i32.const 1)))))
      (then
        (local.set $scan (i32.add (local.get $arg1) (i32.const 6)))
        (block $basename_done
          (loop $basename
            (local.set $ch (call $gl8 (local.get $scan)))
            (br_if $basename_done (i32.eqz (local.get $ch)))
            (if (i32.and
                  (i32.or (i32.eq (local.get $ch) (i32.const 47))
                          (i32.eq (local.get $ch) (i32.const 92)))
                  (i32.ne (call $gl8 (i32.add (local.get $scan) (i32.const 1)))
                          (i32.const 0)))
              (then
                (local.set $offset
                  (i32.sub (i32.add (local.get $scan) (i32.const 1))
                           (local.get $arg1)))))
            (local.set $scan (i32.add (local.get $scan) (i32.const 1)))
            (br $basename)))))
    (call $gs32 (local.get $arg3) (i32.const 1)) ;; STRRET_OFFSET
    (call $gs32 (i32.add (local.get $arg3) (i32.const 4)) (local.get $offset))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
  (func $handle_IShellFolder_SetNameOf (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))

  (func $handle_IEnumIDList_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; IID_IEnumIDList {000214F2-0000-0000-C000-000000000046}.
    (i32.store offset=0 (global.get $reg_base) (call $dx_query_interface_single
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (i32.const 0x000214F2) (i32.const 0)
      (i32.const 0x000000C0) (i32.const 0x46000000)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))
  (func $handle_IEnumIDList_AddRef (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_dx_com_addref
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))
  (func $handle_IEnumIDList_Release (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_dx_com_release_basic
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))
  (func $shell_enum_entry (param $object i32) (result i32)
    (local $entry i32)
    (if (i32.eqz (call $shell_guest_range_mapped (local.get $object) (i32.const 8)))
      (then (return (i32.const 0))))
    (local.set $entry (call $dx_from_this (local.get $object)))
    (if (i32.ne (load.field DxObject type (local.get $entry)) (i32.const 33))
      (then (return (i32.const 0))))
    (local.get $entry))
  (func $handle_IEnumIDList_Next (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $cursor i32) (local $start i32)
    (local $fetched i32) (local $pidl i32) (local $i i32) (local $slot i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
    (local.set $entry (call $shell_enum_entry (local.get $arg0)))
    (if (i32.eqz (local.get $entry))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) (return)))
    ;; pceltFetched may be NULL only for the one-element convenience form.
    (if (local.get $arg3)
      (then
        (if (i32.eqz
              (call $shell_guest_range_mapped (local.get $arg3) (i32.const 4)))
          (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)) (return)))
        (call $gs32 (local.get $arg3) (i32.const 0)))
      (else
        (if (i32.ne (local.get $arg1) (i32.const 1))
          (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)) (return)))))
    ;; A zero request retrieves its full requested count (zero) and needs no
    ;; rgelt storage.  This also avoids treating a zero-length affine span as a
    ;; pointer failure.
    (if (i32.eqz (local.get $arg1))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (if (i32.or
          (i32.gt_u (local.get $arg1) (i32.const 0x3fffffff))
          (i32.eqz
            (call $shell_guest_range_mapped
              (local.get $arg2) (i32.shl (local.get $arg1) (i32.const 2)))))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)) (return)))
    (local.set $cursor (load.field DxObject misc1 (local.get $entry)))
    (if (i32.gt_u (local.get $cursor) (i32.const 2))
      (then (local.set $cursor (i32.const 2))))
    (local.set $start (local.get $cursor))
    ;; SHCONTF_FOLDERS (0x20) is the only class represented by the two virtual
    ;; roots.  NONFOLDERS and unrelated flags truthfully enumerate no items.
    (if (i32.ne
          (i32.and (load.field DxObject misc0 (local.get $entry)) (i32.const 0x20))
          (i32.const 0))
      (then
        (block $complete
          (loop $items
            (br_if $complete (i32.ge_u (local.get $fetched) (local.get $arg1)))
            (br_if $complete (i32.ge_u (local.get $cursor) (i32.const 2)))
            (local.set $pidl
              (call $shell_virtual_pidl_from_csidl
                (select (i32.const 0x11) (i32.const 0x12)
                  (i32.eqz (local.get $cursor)))))
            (if (i32.eqz (local.get $pidl))
              (then
                ;; A failed COM call publishes no valid entries.  Roll back
                ;; every PIDL allocated by this call and leave the cursor at
                ;; its entry value so the caller can retry.
                (local.set $i (i32.const 0))
                (block $rolled_back
                  (loop $rollback
                    (br_if $rolled_back (i32.ge_u (local.get $i) (local.get $fetched)))
                    (local.set $slot
                      (i32.add (local.get $arg2)
                        (i32.shl (local.get $i) (i32.const 2))))
                    (call $heap_free (call $gl32 (local.get $slot)))
                    (call $gs32 (local.get $slot) (i32.const 0))
                    (local.set $i (i32.add (local.get $i) (i32.const 1)))
                    (br $rollback)))
                (if (local.get $arg3)
                  (then (call $gs32 (local.get $arg3) (i32.const 0))))
                (store.field DxObject misc1 (local.get $entry) (local.get $start))
                (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000E))
                (return)))
            (call $gs32
              (i32.add (local.get $arg2)
                (i32.shl (local.get $fetched) (i32.const 2)))
              (local.get $pidl))
            (local.set $fetched (i32.add (local.get $fetched) (i32.const 1)))
            (local.set $cursor (i32.add (local.get $cursor) (i32.const 1)))
            (br $items)))))
    (store.field DxObject misc1 (local.get $entry) (local.get $cursor))
    (if (local.get $arg3)
      (then (call $gs32 (local.get $arg3) (local.get $fetched))))
    ;; S_OK is reserved for the full requested count.  A non-empty partial
    ;; result remains owned by the caller but reports end-of-enumeration.
    (i32.store offset=0 (global.get $reg_base) (select (i32.const 0) (i32.const 1)
        (i32.eq (local.get $fetched) (local.get $arg1)))))
  (func $handle_IEnumIDList_Skip (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $cursor i32) (local $remaining i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
    (local.set $entry (call $shell_enum_entry (local.get $arg0)))
    (if (i32.eqz (local.get $entry))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) (return)))
    (if (i32.eqz (local.get $arg1))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (local.set $cursor (load.field DxObject misc1 (local.get $entry)))
    (if (i32.gt_u (local.get $cursor) (i32.const 2))
      (then (local.set $cursor (i32.const 2))))
    (if (i32.eqz
          (i32.and (load.field DxObject misc0 (local.get $entry)) (i32.const 0x20)))
      (then
        (store.field DxObject misc1 (local.get $entry) (local.get $cursor))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))
        (return)))
    (local.set $remaining (i32.sub (i32.const 2) (local.get $cursor)))
    (if (i32.le_u (local.get $arg1) (local.get $remaining))
      (then
        (store.field DxObject misc1 (local.get $entry)
          (i32.add (local.get $cursor) (local.get $arg1)))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (else
        (store.field DxObject misc1 (local.get $entry) (i32.const 2))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1)))))
  (func $handle_IEnumIDList_Reset (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
    (local.set $entry (call $shell_enum_entry (local.get $arg0)))
    (if (i32.eqz (local.get $entry))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) (return)))
    (store.field DxObject misc1 (local.get $entry) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
  (func $handle_IEnumIDList_Clone (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg1) (then (call $gs32 (local.get $arg1) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

;; 762: GetWindowLongA(hWnd, nIndex)
  (func $handle_GetWindowLongA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eq (local.get $arg1) (i32.const -12))  ;; GWL_ID
      (then
        (i32.store offset=0 (global.get $reg_base) (call $ctrl_table_get_id (local.get $arg0)))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))) (return)))
    (if (i32.eq (local.get $arg1) (i32.const -21))  ;; GWL_USERDATA
      (then
        (i32.store offset=0 (global.get $reg_base) (call $wnd_get_userdata (local.get $arg0)))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))) (return)))
    (if (i32.eq (local.get $arg1) (i32.const -4))   ;; GWL_WNDPROC
      (then
        (i32.store offset=0 (global.get $reg_base)
          (call $wndproc_public (local.get $arg0) (call $wnd_table_get (local.get $arg0))))
        ;; If WNDPROC_BUILTIN sentinel, return 0 (no real wndproc)
        (if (i32.eq (i32.load offset=0 (global.get $reg_base)) (global.get $WNDPROC_BUILTIN))
          (then (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))) (return)))
    (if (i32.eq (local.get $arg1) (i32.const -6))   ;; GWL_HINSTANCE
      (then
        (i32.store offset=0 (global.get $reg_base) (call $wnd_get_hinstance (local.get $arg0)))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))) (return)))
    ;; GWL_HWNDPARENT: the parent for a child, the owner for a top-level. VCL's
    ;; TWinControl.UpdateBounds asks for this and only calls ScreenToClient when
    ;; it comes back non-zero -- returning 0 made it store the screen rect as the
    ;; control's parent-relative bounds, so every SetBounds round trip shifted
    ;; the control by the parent's client origin again (Tetravex's tiles walked
    ;; off the form: 0 -> 124 -> 248 -> ...).
    (if (i32.eq (local.get $arg1) (i32.const -8))   ;; GWL_HWNDPARENT
      (then
        (i32.store offset=0 (global.get $reg_base) (call $wnd_get_parent (local.get $arg0)))
        (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
          (then (i32.store offset=0 (global.get $reg_base) (call $wnd_get_owner (local.get $arg0)))))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))) (return)))
    (if (i32.eq (local.get $arg1) (i32.const -16))  ;; GWL_STYLE
      (then
        (i32.store offset=0 (global.get $reg_base) (if (result i32) (i32.ge_s (call $wnd_table_find (local.get $arg0)) (i32.const 0))
            (then (call $wnd_get_style (local.get $arg0)))
            (else (call $host_get_window_info (local.get $arg0) (i32.const 0)))))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))) (return)))
    ;; GWL_EXSTYLE: CreateWindowExA and $dlg_load both record dwExStyle per
    ;; window, so answer from that rather than reporting 0 for every window.
    ;; Apps read this to decide whether they already own a style bit before
    ;; OR-ing another one in; a hardcoded 0 makes every such read-modify-write
    ;; drop the bits the window was created with.
    (if (i32.eq (local.get $arg1) (i32.const -20))  ;; GWL_EXSTYLE
      (then
        (i32.store offset=0 (global.get $reg_base) (call $ctrl_get_ex_style (local.get $arg0)))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))) (return)))
    (if (i32.ge_s (local.get $arg1) (i32.const 0))
      (then
        (if (call $dialog_proc_get (local.get $arg0))
          (then
            (i32.store offset=0 (global.get $reg_base) (call $dialog_extra_get
              (local.get $arg0) (local.get $arg1))))
          (else
            (i32.store offset=0 (global.get $reg_base) (call $wnd_extra_get
              (local.get $arg0) (local.get $arg1)))))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))) (return)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))  ;; stdcall, 2 args
  )

  ;; 763: waveOutMessage(hwo, uMsg, dw1, dw2) — return MMSYSERR_NOERROR
  (func $handle_waveOutMessage (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))  ;; MMSYSERR_NOERROR
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))  ;; stdcall, 4 args
  )

  ;; 764: GetUserDefaultLCID — already implemented at ID 413, this is a duplicate entry
  ;; (handled by dispatch to same function)

  ;; 765: wcsrchr(str, ch) — find last occurrence of wide char.
  ;; Walks GUEST addresses, one $gl16 per character: a string on the heap or
  ;; the stack of a large app lives in the sparse backing window, where one
  ;; $g2w is good for one page and "wa - GUEST_BASE + image_base" is not the
  ;; inverse of it. The terminator itself matches when ch is 0, as in the CRT.
  (func $handle_wcsrchr (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ga i32) (local $last i32) (local $ch i32) (local $want i32)
    (local.set $ga (local.get $arg0))
    (local.set $want (i32.and (local.get $arg1) (i32.const 0xFFFF)))
    (block $done (loop $scan
      (local.set $ch (call $gl16 (local.get $ga)))
      (if (i32.eq (local.get $ch) (local.get $want))
        (then (local.set $last (local.get $ga))))
      (br_if $done (i32.eqz (local.get $ch)))
      (local.set $ga (i32.add (local.get $ga) (i32.const 2)))
      (br $scan)))
    (i32.store offset=0 (global.get $reg_base) (local.get $last))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))  ;; cdecl
  )

  ;; 4472: wcschr(str, ch) — first occurrence of a wide char, or NULL. As
  ;; wcsrchr above: guest addresses throughout, and ch == 0 finds the
  ;; terminator. Deus Ex's Core.dll calls it at startup through MSVCRT.
  (func $handle_wcschr (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ga i32) (local $ch i32) (local $want i32) (local $found i32)
    (local.set $ga (local.get $arg0))
    (local.set $want (i32.and (local.get $arg1) (i32.const 0xFFFF)))
    (block $done (loop $scan
      (local.set $ch (call $gl16 (local.get $ga)))
      (if (i32.eq (local.get $ch) (local.get $want))
        (then (local.set $found (local.get $ga)) (br $done)))
      (br_if $done (i32.eqz (local.get $ch)))
      (local.set $ga (i32.add (local.get $ga) (i32.const 2)))
      (br $scan)))
    (i32.store offset=0 (global.get $reg_base) (local.get $found))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))  ;; cdecl
  )

  ;; Shared A/W implementation. USER only removes application classes owned by
  ;; the supplied module, and refuses while any window of that class survives.
  (func $unregister_class_core
      (param $class_name i32) (param $hinstance i32) (param $wide i32) (result i32)
    (local $key i32) (local $error i32)
    (local.set $key
      (if (result i32) (local.get $wide)
        (then (call $class_wide_name_key (local.get $class_name)))
        (else (call $class_name_key (local.get $class_name)))))
    (local.set $error
      (call $class_table_unregister (local.get $key) (local.get $hinstance)))
    (if (local.get $error)
      (then
        (global.set $last_error (local.get $error))
        (return (i32.const 0))))
    (i32.const 1))

  ;; 766: UnregisterClassA(lpClassName, hInstance)
  (func $handle_UnregisterClassA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $unregister_class_core
        (local.get $arg0) (local.get $arg1) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))  ;; stdcall, 2 args
  )

  ;; Host registry imports require contiguous buffers. Query size into owned
  ;; metadata first, then read only the required bytes into owned storage and
  ;; scatter through guest_memmove. Caller strings/metadata/data may straddle
  ;; unrelated sparse backing pages; never pass those directly to the host.
  (func $shreg_us_query (param $key i32) (param $name_wa i32)
      (param $type i32) (param $data i32) (param $size i32) (param $capacity i32) (result i32)
    (local $meta i32) (local $buffer i32) (local $needed i32) (local $result i32)
    (local.set $meta (call $heap_alloc (i32.const 8)))
    (if (i32.eqz (local.get $meta)) (then (return (i32.const 8))))
    (call $gs32 (local.get $meta) (local.get $capacity))
    (call $gs32 (i32.add (local.get $meta) (i32.const 4)) (i32.const 0))
    (local.set $result (call $host_reg_query_value (local.get $key) (local.get $name_wa)
      (i32.add (local.get $meta) (i32.const 4)) (i32.const 0) (local.get $meta) (i32.const 0)))
    (local.set $needed (call $gl32 (local.get $meta)))
    (if (i32.and (i32.eqz (local.get $result)) (i32.ne (local.get $data) (i32.const 0))) (then
      (if (i32.gt_u (local.get $needed) (local.get $capacity))
        (then (local.set $result (i32.const 234)))
        (else (if (local.get $needed) (then
          (local.set $buffer (call $heap_alloc (local.get $needed)))
          (if (i32.eqz (local.get $buffer))
            (then (local.set $result (i32.const 8)))
            (else
              ;; Registry host calls are synchronous; no guest callback or
              ;; yield can change the value between the size and data reads.
              (local.set $result (call $host_reg_query_value (local.get $key) (local.get $name_wa)
                (i32.add (local.get $meta) (i32.const 4)) (local.get $buffer) (local.get $meta) (i32.const 0)))
              (if (i32.eqz (local.get $result)) (then
                (call $guest_memmove (local.get $data) (local.get $buffer) (call $gl32 (local.get $meta)))))
              (call $heap_free (local.get $buffer))))))))))
    (if (local.get $type) (then
      (call $gs32 (local.get $type) (call $gl32 (i32.add (local.get $meta) (i32.const 4))))))
    (call $gs32 (local.get $size) (call $gl32 (local.get $meta)))
    (call $heap_free (local.get $meta))
    (local.get $result))

  (func $shreg_get_us_value (param $path i32) (param $name i32)
      (param $type i32) (param $data i32) (param $size i32)
      (param $ignore_user i32) (param $fallback i32) (param $fallback_size i32) (result i32)
    (local $path_copy i32) (local $name_copy i32) (local $name_wa i32)
    (local $capacity i32) (local $attempt i32) (local $key i32) (local $result i32)
    (if (i32.or (i32.eqz (local.get $path)) (i32.eqz (local.get $size)))
      (then (return (i32.const 87))))
    (local.set $path_copy (call $guest_strdup (local.get $path)))
    (if (i32.eqz (local.get $path_copy)) (then (return (i32.const 8))))
    (if (local.get $name) (then
      (local.set $name_copy (call $guest_strdup (local.get $name)))
      (if (i32.eqz (local.get $name_copy)) (then
        (call $heap_free (local.get $path_copy)) (return (i32.const 8))))
      (local.set $name_wa (call $g2w (local.get $name_copy)))))
    (local.set $capacity (call $gl32 (local.get $size)))
    (local.set $attempt (i32.ne (local.get $ignore_user) (i32.const 0)))
    (block $done (loop $lookup
      (local.set $key (call $host_reg_open_key
        (i32.add (i32.const 0x80000001) (local.get $attempt))
        (call $g2w (local.get $path_copy)) (i32.const 0)))
      (local.set $result (i32.const 2))
      (if (local.get $key) (then
        (local.set $result (call $shreg_us_query (local.get $key) (local.get $name_wa)
          (local.get $type) (local.get $data) (local.get $size) (local.get $capacity)))
        (drop (call $host_reg_close_key (local.get $key)))))
      (br_if $done (i32.eqz (local.get $result)))
      (local.set $attempt (i32.add (local.get $attempt) (i32.const 1)))
      (br_if $lookup (i32.lt_u (local.get $attempt) (i32.const 2)))))
    (if (i32.and (i32.ne (local.get $result) (i32.const 0))
      (i32.and (i32.ne (local.get $fallback) (i32.const 0)) (i32.ne (local.get $data) (i32.const 0)))) (then
      (if (i32.and (i32.ne (local.get $fallback_size) (i32.const 0))
        (i32.le_u (local.get $fallback_size) (local.get $capacity))) (then
        (call $guest_memmove (local.get $data) (local.get $fallback) (local.get $fallback_size))
        (call $gs32 (local.get $size) (local.get $fallback_size))
        (local.set $result (i32.const 0))))))
    (if (local.get $name_copy) (then (call $heap_free (local.get $name_copy))))
    (call $heap_free (local.get $path_copy))
    (local.get $result))

  ;; Eight arguments, including ignore-HKCU and the default payload pair.
  (func $handle_SHRegGetUSValueA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $shreg_get_us_value
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4)
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36)))  ;; stdcall, 8 args
  )

  ;; 768: SHGetPathFromIDListA(pidl, pszPath)
  (func $handle_SHGetPathFromIDListA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $shell_filesystem_pidl_copy_path (local.get $arg0) (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))  ;; stdcall, 2 args
  )

  ;; 769: GetVersionExW(lpVersionInfo) — the same OSVERSIONINFO the A spelling
  ;; fills, read from $winver rather than hardcoded to Windows 98. The shared
  ;; numeric prefix is encoding-neutral and this runtime reports an empty
  ;; szCSDVersion, whose two zero bytes terminate both CHAR and WCHAR arrays;
  ;; delegate so the reported platform cannot drift again.
  (func $handle_GetVersionExW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_GetVersionExA
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; ---- In-proc activation as guest calls ----------------------------------
  ;; A class factory's CreateInstance is free to create threads and wait on
  ;; them (quartz's filter graph does), which a nested host-driven run cannot
  ;; survive: the wait yields, the nested run gives up, and the activation
  ;; reads as E_FAIL. So CoCreateInstance calls DllGetClassObject,
  ;; CreateInstance and Release through return thunks, with every piece of
  ;; state in a frame on the guest stack — activations nest, since a
  ;; constructor may itself call CoCreateInstance.
  ;;
  ;; E = ESP at entry: [E] return address, [E+4..E+20] rclsid, pUnkOuter,
  ;; dwClsContext, riid, ppv. The frame F = E-20 holds the factory pointer at
  ;; F and IID_IClassFactory at F+4 (reused for the CreateInstance HRESULT).
  ;; Each callee is stdcall, so ESP is back at F whenever a thunk runs.
  (func $com_cont_thunk (param $marker i32) (result i32)
    (local $wa i32) (local $guest i32)
    (global.set $num_thunks (call $thunk_reserve))
    (local.set $wa (i32.add (global.get $THUNK_BASE) (i32.mul (global.get $num_thunks) (i32.const 8))))
    (i32.store (local.get $wa) (local.get $marker))
    (i32.store offset=4 (local.get $wa) (i32.const 0))
    (local.set $guest (i32.add (i32.sub (local.get $wa) (global.get $GUEST_BASE)) (global.get $image_base)))
    (global.set $num_thunks (i32.add (global.get $num_thunks) (i32.const 1)))
    (call $update_thunk_end)
    (local.get $guest))

  (func $com_jump (param $target i32)
    (global.set $eip (local.get $target))
    (global.set $handler_set_eip (i32.const 1))
    (global.set $steps (i32.const 0)))

  (func $com_activate_frame_begin (param $ppv i32) (result i32)
    (local $f i32)
    (if (i32.eqz (global.get $com_gco_thunk))
      (then
        (global.set $com_gco_thunk (call $com_cont_thunk (i32.const 0xCACA0033)))
        (global.set $com_create_thunk (call $com_cont_thunk (i32.const 0xCACA0034)))
        (global.set $com_release_thunk (call $com_cont_thunk (i32.const 0xCACA0035)))))
    (call $gs32 (local.get $ppv) (i32.const 0))
    (local.set $f (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
    (call $gs32 (local.get $f) (i32.const 0))
    ;; IID_IClassFactory {00000001-0000-0000-C000-000000000046}
    (call $gs32 (i32.add (local.get $f) (i32.const 4)) (i32.const 1))
    (call $gs32 (i32.add (local.get $f) (i32.const 8)) (i32.const 0))
    (call $gs32 (i32.add (local.get $f) (i32.const 12)) (i32.const 0xC0))
    (call $gs32 (i32.add (local.get $f) (i32.const 16)) (i32.const 0x46000000))
    (i32.store offset=16 (global.get $reg_base) (local.get $f))
    (local.get $f))

  (func $com_activate_begin (param $gco i32) (param $rclsid i32) (param $ppv i32)
      (param $class_only i32) (param $requested_iid i32)
    (local $f i32)
    (local.set $f (call $com_activate_frame_begin (local.get $ppv)))
    (call $io_apc_push (local.get $f))
    ;; Per-call mode tag at F+4: 1 is the normal IID_IClassFactory.Data1;
    ;; 0 means factory-only and that unused IID buffer is NOT passed to GCO.
    ;; GCO writes only F, so nested activations cannot change this frame's tag.
    (if (local.get $class_only)
      (then
        (call $gs32 (i32.add (local.get $f) (i32.const 4)) (i32.const 0))
        (call $io_apc_push (local.get $requested_iid)))
      (else (call $io_apc_push (i32.add (local.get $f) (i32.const 4)))))
    (call $io_apc_push (local.get $rclsid))
    (call $io_apc_push (global.get $com_gco_thunk))
    (call $com_jump (local.get $gco)))

  ;; A registered factory is borrowed from the process table, rather than
  ;; returned with a reference by DllGetClassObject. Retain it on this CPU,
  ;; then reuse the ordinary CreateInstance/Release continuation and frame.
  (func $com_activate_registered_begin (param $factory i32) (param $ppv i32)
    (local $f i32)
    (local.set $f (call $com_activate_frame_begin (local.get $ppv)))
    (call $gs32 (local.get $f) (local.get $factory))
    ;; Distinguish AddRef's unsigned count from DllGetClassObject's HRESULT.
    (call $gs32 (i32.add (local.get $f) (i32.const 4)) (i32.const -1))
    (call $io_apc_push (local.get $factory))
    (call $io_apc_push (global.get $com_gco_thunk))
    (call $com_jump (call $gl32 (i32.add (call $gl32 (local.get $factory)) (i32.const 4)))))

  (func $com_activate_finish (param $hr i32)
    (local $e i32)
    (local.set $e (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
    (if (i32.and (i32.lt_s (local.get $hr) (i32.const 0))
                 (i32.ne (call $gl32 (i32.add (local.get $e) (i32.const 20))) (i32.const 0)))
      (then (call $gs32 (call $gl32 (i32.add (local.get $e) (i32.const 20))) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (local.get $hr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (local.get $e) (i32.const 24)))
    (call $com_jump (call $gl32 (local.get $e))))

  ;; CACA0033: DllGetClassObject returned.
  (func $com_activate_after_gco
    (local $f i32) (local $e i32) (local $pf i32)
    (local.set $f (i32.load offset=16 (global.get $reg_base)))
    (local.set $e (i32.add (local.get $f) (i32.const 20)))
    (local.set $pf (call $gl32 (local.get $f)))
    (if (i32.eq (call $gl32 (i32.add (local.get $f) (i32.const 4))) (i32.const -1))
      (then
        ;; IUnknown::AddRef returns ULONG, including valid high-bit counts.
        ;; Only the following CreateInstance return is an HRESULT.
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (call $gs32 (i32.add (local.get $f) (i32.const 4)) (i32.const 1))))
    ;; F+4 mode tag is read before normal CreateInstance may reuse it for HR.
    (if (i32.eqz (call $gl32 (i32.add (local.get $f) (i32.const 4))))
      (then
        ;; Preserve CoGetClassObject's nonzero-HR/null-factory normalization.
        ;; Caller output was zeroed at begin; GCO's temporary output is F.
        (if (i32.load offset=0 (global.get $reg_base))
          (then (call $com_activate_finish (i32.load offset=0 (global.get $reg_base))) (return)))
        (if (i32.eqz (local.get $pf))
          (then (call $com_activate_finish (i32.const 0x80004005)) (return)))
        (call $gs32 (call $gl32 (i32.add (local.get $e) (i32.const 20))) (local.get $pf))
        (call $com_activate_finish (i32.const 0))
        (return)))
    (if (i32.lt_s (i32.load offset=0 (global.get $reg_base)) (i32.const 0))
      (then (call $com_activate_finish (i32.load offset=0 (global.get $reg_base))) (return)))
    (if (i32.eqz (local.get $pf))
      (then (call $com_activate_finish (i32.const 0x80004002)) (return))) ;; E_NOINTERFACE
    (call $io_apc_push (call $gl32 (i32.add (local.get $e) (i32.const 20)))) ;; ppv
    (call $io_apc_push (call $gl32 (i32.add (local.get $e) (i32.const 16)))) ;; riid
    (call $io_apc_push (call $gl32 (i32.add (local.get $e) (i32.const 8))))  ;; pUnkOuter
    (call $io_apc_push (local.get $pf))
    (call $io_apc_push (global.get $com_create_thunk))
    (call $com_jump (call $gl32 (i32.add (call $gl32 (local.get $pf)) (i32.const 12)))))

  ;; CACA0034: IClassFactory::CreateInstance returned; release the factory.
  (func $com_activate_after_create
    (local $f i32) (local $pf i32)
    (local.set $f (i32.load offset=16 (global.get $reg_base)))
    (local.set $pf (call $gl32 (local.get $f)))
    (call $gs32 (i32.add (local.get $f) (i32.const 4)) (i32.load offset=0 (global.get $reg_base)))
    (call $io_apc_push (local.get $pf))
    (call $io_apc_push (global.get $com_release_thunk))
    (call $com_jump (call $gl32 (i32.add (call $gl32 (local.get $pf)) (i32.const 8)))))

  ;; CACA0035: IClassFactory::Release returned; hand CreateInstance's result
  ;; back to the CoCreateInstance caller.
  (func $com_activate_after_release
    (call $com_activate_finish (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))))

  ;; Park a COM activation at its import thunk while JS loads an in-proc
  ;; server. Keeping the stdcall frame untouched lets the normal handler retry
  ;; once the DLL exists, without re-executing the guest PUSH/CALL block and
  ;; walking ESP downward inside the same run slice.
  (func $com_dll_block
    (if (global.get $current_thunk_eip)
      (then (global.set $eip (global.get $current_thunk_eip))))
    (global.set $handler_set_eip (i32.const 1))
    (global.set $yield_reason (i32.const 3))
    (global.set $yield_flag (i32.const 1))
    (global.set $steps (i32.const 0)))

  ;; Built-in class factory for the standard VB6 Common Dialog control. The
  ;; actual COMDLG32.OCX is not shipped in the corpus; its non-visual OLE host
  ;; surface can use the bounded static OLE object already used by OleLoad.
  ;; Factory layout: vtbl, refcount, CLSID[16].
  (func $common_dialog_factory_create (param $clsid i32) (result i32)
    (local $obj i32) (local $vtbl i32)
    (local.set $vtbl (call $init_com_vtable (i32.const 2512) (i32.const 5)))
    (if (i32.eqz (local.get $vtbl)) (then (return (i32.const 0))))
    (local.set $obj (call $heap_alloc (i32.const 24)))
    (if (i32.eqz (local.get $obj)) (then (return (i32.const 0))))
    (call $zero_memory (call $g2w (local.get $obj)) (i32.const 24))
    (call $gs32 (local.get $obj) (local.get $vtbl))
    (call $gs32 (i32.add (local.get $obj) (i32.const 4)) (i32.const 1))
    (memory.copy (call $g2w (i32.add (local.get $obj) (i32.const 8)))
      (call $g2w (local.get $clsid)) (i32.const 16))
    (local.get $obj))

  (func $handle_IClassFactory_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $iid_d1 i32)
    (if (i32.eqz (local.get $arg2))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)))
      (else
        (local.set $iid_d1 (call $gl32 (local.get $arg1)))
        (if (i32.or (i32.eqz (local.get $iid_d1)) (i32.eq (local.get $iid_d1) (i32.const 1)))
          (then
            (call $gs32 (local.get $arg2) (local.get $arg0))
            (call $gs32 (i32.add (local.get $arg0) (i32.const 4))
              (i32.add (call $gl32 (i32.add (local.get $arg0) (i32.const 4))) (i32.const 1)))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
          (else
            (call $gs32 (local.get $arg2) (i32.const 0))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004002))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_IClassFactory_AddRef (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.add (call $gl32 (i32.add (local.get $arg0) (i32.const 4))) (i32.const 1)))
    (call $gs32 (i32.add (local.get $arg0) (i32.const 4)) (i32.load offset=0 (global.get $reg_base)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_IClassFactory_Release (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $rc i32)
    (local.set $rc (call $gl32 (i32.add (local.get $arg0) (i32.const 4))))
    (if (local.get $rc) (then (local.set $rc (i32.sub (local.get $rc) (i32.const 1)))))
    (call $gs32 (i32.add (local.get $arg0) (i32.const 4)) (local.get $rc))
    (i32.store offset=0 (global.get $reg_base) (local.get $rc))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_IClassFactory_CreateInstance (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $obj i32) (local $hr i32)
    (if (i32.eqz (local.get $arg3))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)))
      (else
        (call $gs32 (local.get $arg3) (i32.const 0))
        (if (local.get $arg1)
          (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80040110)))
          (else
            (local.set $obj (call $ole_create_static_handler (i32.add (local.get $arg0) (i32.const 8))))
            (if (i32.eqz (local.get $obj))
              (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000E)))
              (else
                (local.set $hr (call $ole_static_query_interface
                  (local.get $obj) (local.get $arg2) (local.get $arg3)))
                (drop (call $ole_obj_release (local.get $obj)))
                (i32.store offset=0 (global.get $reg_base) (local.get $hr))))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  (func $handle_IClassFactory_LockServer (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; IDirectMusic root object. GTA2 and its InstallShield DxCheck helper only
  ;; use this interface as an availability/version probe: create it, accept
  ;; IUnknown/IDirectMusic QueryInterface, then release it.
  (func $guid_words_equal (param $wa i32) (param $d0 i32)
        (param $d1 i32) (param $d2 i32) (param $d3 i32) (result i32)
    (i32.and
      (i32.and
        (i32.eq (i32.load (local.get $wa)) (local.get $d0))
        (i32.eq (i32.load offset=4 (local.get $wa)) (local.get $d1)))
      (i32.and
        (i32.eq (i32.load offset=8 (local.get $wa)) (local.get $d2))
        (i32.eq (i32.load offset=12 (local.get $wa)) (local.get $d3)))))

  ;; Complete a QueryInterface after the caller has translated and classified
  ;; the IID. Keeping output/lifetime mechanics here lets interfaces with
  ;; different identity sets share the COM contract without re-reading riid.
  (func $dx_query_interface_result (param $obj i32) (param $out i32)
        (param $supported i32) (result i32)
    (local $entry i32)
    (call $gs32 (local.get $out) (i32.const 0))
    (if (i32.eqz (local.get $supported))
      (then (return (i32.const 0x80004002)))) ;; E_NOINTERFACE
    (local.set $entry (call $dx_from_this (local.get $obj)))
    (if (i32.eqz (local.get $entry))
      (then (return (i32.const 0x80004002))))
    (store.field DxObject refcount (local.get $entry)
      (i32.add (load.field DxObject refcount (local.get $entry)) (i32.const 1)))
    (call $gs32 (local.get $out) (local.get $obj))
    (i32.const 0))

  (func $dx_query_interface_single_wa (param $obj i32) (param $iid_wa i32)
        (param $out i32) (param $d0 i32) (param $d1 i32)
        (param $d2 i32) (param $d3 i32) (result i32)
    (if (i32.eqz (local.get $out))
      (then (return (i32.const 0x80004003)))) ;; E_POINTER
    (if (i32.eqz (local.get $iid_wa))
      (then
        (return (call $dx_query_interface_result
          (local.get $obj) (local.get $out) (i32.const 0)))))
    (call $dx_query_interface_result
      (local.get $obj) (local.get $out)
      (i32.or
        (call $guid_words_equal (local.get $iid_wa)
          (i32.const 0) (i32.const 0) (i32.const 0x000000C0) (i32.const 0x46000000))
        (call $guid_words_equal (local.get $iid_wa)
          (local.get $d0) (local.get $d1) (local.get $d2) (local.get $d3)))))

  (func $dx_query_interface_single (param $obj i32) (param $iid i32)
        (param $out i32) (param $d0 i32) (param $d1 i32)
        (param $d2 i32) (param $d3 i32) (result i32)
    (local $iid_wa i32)
    ;; Translate riid exactly once, then compare all four GUID words in-place.
    (if (local.get $iid)
      (then (local.set $iid_wa (call $g2w (local.get $iid)))))
    (call $dx_query_interface_single_wa
      (local.get $obj) (local.get $iid_wa) (local.get $out)
      (local.get $d0) (local.get $d1) (local.get $d2) (local.get $d3)))

  ;; IDirectMusic has twelve slots even when no rendering ports exist.
  ;; The first three API ids predate the append-only nine-method tail.
  (func $directmusic_vtable (result i32)
    (local $v i32) (local $slot i32)
    (local.set $v (call $init_com_vtable (i32.const 3076) (i32.const 12)))
    (local.set $slot (i32.const 3))
    (loop $tail
      (call $set_com_vtable_slot_api_id (local.get $v) (local.get $slot)
        (i32.add (global.get $API_ID_IDirectMusic_EnumPort) (i32.sub (local.get $slot) (i32.const 3))))
      (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
      (br_if $tail (i32.lt_u (local.get $slot) (i32.const 12))))
    (local.get $v))

  ;; No DirectMusic synth/MIDI port is implemented. S_FALSE is the SDK's
  ;; enumeration terminator, not a fictitious successful port descriptor.
  (func $handle_IDirectMusic_EnumPort
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $hr i32)
    (local.set $hr (i32.const 1))
    (if (i32.eqz (local.get $arg2))
      (then (local.set $hr (i32.const 0x80004003))))
    (i32.store (global.get $reg_base) (local.get $hr))
    (i32.store offset=16 (global.get $reg_base)
      (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; SetDirectSound(pDirectSound, hWnd): which DirectSound object the ports'
  ;; output goes to. DirectMusic only records it here -- it matters when a
  ;; port is created and activated, and none can be (EnumPort above) -- so
  ;; accepting it is the whole of the call, a NULL included (it means "make
  ;; your own"). Croc 2's ads.dll sets it right after creating the object.
  (func $handle_IDirectMusic_SetDirectSound
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base)
      (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; Activate(fEnable): turns every port of this DirectMusic object on or
  ;; off. There are no ports, so there is nothing to switch and both
  ;; directions succeed; Croc 2's ads.dll deactivates in its teardown.
  (func $handle_IDirectMusic_Activate
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base)
      (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IDirectMusic_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; IID_IDirectMusic {6536115A-7B2D-11D2-BA18-0000F875AC12}.
    (i32.store offset=0 (global.get $reg_base) (call $dx_query_interface_single
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (i32.const 0x6536115A) (i32.const 0x11D27B2D)
      (i32.const 0x000018BA) (i32.const 0x12AC75F8)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))
  ;; IAMMultiMediaStream is the legacy DirectX Media/DirectShow container.
  ;; Darkstone's demo payload has no movie files, but treats failure to create
  ;; this optional-video object as fatal before its D3D game startup. Expose a
  ;; no-media implementation: object lifecycle and control calls succeed,
  ;; while queries for an actual stream or filter report no interface.
  (func $amstream_finish (param $hr i32) (param $stack_bytes i32)
    (i32.store offset=0 (global.get $reg_base) (local.get $hr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (local.get $stack_bytes))))

  (func $handle_IAMMultiMediaStream_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; IID_IAMMultiMediaStream {BEBE595C-9A6F-11D0-8FDE-00C04FD9189D}.
    (i32.store offset=0 (global.get $reg_base) (call $dx_query_interface_single
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (i32.const 0xBEBE595C) (i32.const 0x11D09A6F)
      (i32.const 0xC000DE8F) (i32.const 0x9D18D94F)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))
  (func $handle_IAMMultiMediaStream_GetInformation (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg1) (then (call $gs32 (local.get $arg1) (i32.const 0))))
    (if (local.get $arg2) (then (call $gs32 (local.get $arg2) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_IAMMultiMediaStream_GetMediaStream (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg2) (then (call $gs32 (local.get $arg2) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004002)) ;; E_NOINTERFACE: no media payload
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_IAMMultiMediaStream_EnumMediaStreams (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg2) (then (call $gs32 (local.get $arg2) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x00000001)) ;; S_FALSE: no streams
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_IAMMultiMediaStream_GetState (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg1) (then (call $gs32 (local.get $arg1) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IAMMultiMediaStream_SetState (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $amstream_finish (i32.const 0) (i32.const 12)))

  (func $handle_IAMMultiMediaStream_GetTime (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg1) (then
      (call $gs32 (local.get $arg1) (i32.const 0))
      (call $gs32 (i32.add (local.get $arg1) (i32.const 4)) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IAMMultiMediaStream_GetDuration (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IAMMultiMediaStream_GetTime
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $handle_IAMMultiMediaStream_Seek (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $amstream_finish (i32.const 0) (i32.const 12)))

  (func $handle_IAMMultiMediaStream_GetEndOfStreamEventHandle (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg1) (then (call $gs32 (local.get $arg1) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IAMMultiMediaStream_Initialize (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $amstream_finish (i32.const 0) (i32.const 20)))

  (func $handle_IAMMultiMediaStream_GetFilterGraph (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg1) (then (call $gs32 (local.get $arg1) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004002))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IAMMultiMediaStream_GetFilter (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IAMMultiMediaStream_GetFilterGraph
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $handle_IAMMultiMediaStream_AddMediaStream (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg4) (then (call $gs32 (local.get $arg4) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  (func $handle_IAMMultiMediaStream_OpenFile (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $amstream_finish (i32.const 0x80004005) (i32.const 16))) ;; no decoder

  (func $handle_IAMMultiMediaStream_OpenMoniker (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $amstream_finish (i32.const 0x80004005) (i32.const 20)))

  (func $handle_IAMMultiMediaStream_Render (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $amstream_finish (i32.const 0) (i32.const 12)))

  ;; IDirectDrawGammaControl is a view onto an existing surface slot. GTA2
  ;; snapshots the current ramp and installs its own during video startup.
  (func $ddraw_gamma_control_valid (param $this i32) (result i32)
    (local $entry i32)
    (local.set $entry (call $dx_from_this (local.get $this)))
    (if (i32.eqz (local.get $entry)) (then (return (i32.const 0))))
    (i32.and
      (i32.eq (load.field DxObject type (local.get $entry)) (i32.const 2))
      (i32.ne (i32.and (load.field DxObject flags (local.get $entry))
        (i32.const 1)) (i32.const 0))))

  (func $handle_IDirectDrawGammaControl_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; IID_IDirectDrawGammaControl {69C11C3E-B46B-11D1-AD7A-00C04FC29B4E}.
    (i32.store offset=0 (global.get $reg_base) (call $dx_query_interface_single
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (i32.const 0x69C11C3E) (i32.const 0x11D1B46B)
      (i32.const 0xC0007AAD) (i32.const 0x4E9BC24F)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))
  (func $handle_IDirectDrawGammaControl_GetGammaRamp (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ramp i32)
    (if (i32.eqz (call $ddraw_gamma_control_valid (local.get $arg0)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x88760082))) ;; DDERR_INVALIDOBJECT
      (else (if (i32.or (local.get $arg1) (i32.eqz (local.get $arg2)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)))
      (else
        ;; A DDGAMMARAMP is 1536 bytes and always crosses a guest page
        ;; boundary, whose two halves need not be adjacent in WASM memory, so
        ;; the caller's buffer is gathered and written back.
        (local.set $ramp (call $guest_span_in (local.get $arg2) (i32.const 1536)))
        (call $gamma_ramp_load (local.get $ramp))
        (call $guest_span_writeback (local.get $arg2) (local.get $ramp) (i32.const 1536))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; The ramp is the display's (src/10f $gamma_ramp_store): the host applies it
  ;; when it presents the primary, which is why the driver caps can offer
  ;; DDCAPS2_PRIMARYGAMMA.
  (func $handle_IDirectDrawGammaControl_SetGammaRamp (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ramp i32)
    (if (i32.eqz (call $ddraw_gamma_control_valid (local.get $arg0)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x88760082))) ;; DDERR_INVALIDOBJECT
      (else (if (i32.or
          (i32.gt_u (local.get $arg1) (i32.const 1))
          (i32.eqz (local.get $arg2)))
        (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057))) ;; DDERR_INVALIDPARAMS
        (else
          ;; The caller's 1536-byte ramp can straddle two sparse guest pages
          ;; that are not adjacent in WASM memory; gather it before copying.
          (local.set $ramp (call $guest_span_in (local.get $arg2) (i32.const 1536)))
          (i32.store offset=0 (global.get $reg_base)
            (select (i32.const 0) (i32.const 0x8007000E) ;; DD_OK / DDERR_OUTOFMEMORY
              (call $gamma_ramp_store (local.get $ramp))))
          (call $guest_span_release (local.get $ramp) (i32.const 1536))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; CLSID_ShellLink's Win98 interfaces. Inno Setup configures IShellLinkA,
  ;; queries IPersistFile, then saves a .lnk. The browser does not consume the
  ;; shortcut, but Save still creates a valid minimal Shell Link Header in the
  ;; VFS so success means persistence actually happened.
  (global $SHELL_LINK_VTBL (mut i32) (i32.const 0))
  (global $PERSIST_FILE_VTBL (mut i32) (i32.const 0))

  (func $shell_link_init_vtables
    (if (i32.eqz (global.get $SHELL_LINK_VTBL))
      (then
        (global.set $SHELL_LINK_VTBL
          (call $init_com_vtable (global.get $API_ID_IShellLinkA_BASE) (i32.const 21)))
        (global.set $PERSIST_FILE_VTBL
          (call $init_com_vtable (global.get $API_ID_IPersistFile_BASE) (i32.const 9))))))

  (func $shell_link_mark (param $this i32) (param $bit i32)
    (local $entry i32)
    (local.set $entry (call $dx_from_this (local.get $this)))
    (store.field DxObject flags (local.get $entry)
      (i32.or (load.field DxObject flags (local.get $entry)) (local.get $bit))))

  (func $shell_link_query_interface_wa (param $this i32) (param $iid_wa i32)
      (param $out i32) (result i32)
    (local $entry i32) (local $wrapper i32)
    (if (i32.eqz (local.get $out))
      (then (return (i32.const 0x80004003)))) ;; E_POINTER
    (call $gs32 (local.get $out) (i32.const 0))
    (if (i32.eqz (local.get $iid_wa))
      (then (return (i32.const 0x80004003))))
    (call $shell_link_init_vtables)
    (local.set $entry (call $dx_from_this (local.get $this)))
    ;; IPersistFile inherits IPersist and its wrapper begins with the complete
    ;; IPersist vtable, so both identities resolve to the same interface.
    (if (i32.or
          ;; IID_IPersistFile {0000010B-0000-0000-C000-000000000046}.
          (call $guid_words_equal (local.get $iid_wa)
            (i32.const 0x0000010B) (i32.const 0)
            (i32.const 0x000000C0) (i32.const 0x46000000))
          ;; IID_IPersist {0000010C-0000-0000-C000-000000000046}.
          (call $guid_words_equal (local.get $iid_wa)
            (i32.const 0x0000010C) (i32.const 0)
            (i32.const 0x000000C0) (i32.const 0x46000000)))
      (then
        (local.set $wrapper (call $dx_get_wrapper_for_vtbl
          (call $dx_slot_of (local.get $entry)) (global.get $PERSIST_FILE_VTBL))))
      (else
        ;; IUnknown or IID_IShellLinkA
        ;; {000214EE-0000-0000-C000-000000000046}.
        (if (i32.or
              (call $guid_words_equal (local.get $iid_wa)
                (i32.const 0) (i32.const 0)
                (i32.const 0x000000C0) (i32.const 0x46000000))
              (call $guid_words_equal (local.get $iid_wa)
                (i32.const 0x000214EE) (i32.const 0)
                (i32.const 0x000000C0) (i32.const 0x46000000)))
          (then
            (local.set $wrapper (call $dx_get_wrapper_for_vtbl
              (call $dx_slot_of (local.get $entry)) (global.get $SHELL_LINK_VTBL)))))))
    (if (i32.eqz (local.get $wrapper))
      (then (return (i32.const 0x80004002)))) ;; E_NOINTERFACE
    (drop (call $dx_com_addref (local.get $this)))
    (call $gs32 (local.get $out) (local.get $wrapper))
    (i32.const 0))

  (func $shell_link_query_interface (param $this i32) (param $iid i32)
      (param $out i32) (result i32)
    (local $iid_wa i32)
    ;; Translate riid exactly once, then compare all four GUID words in-place.
    (if (local.get $iid)
      (then (local.set $iid_wa (call $g2w (local.get $iid)))))
    (call $shell_link_query_interface_wa
      (local.get $this) (local.get $iid_wa) (local.get $out)))

  (func $shell_link_empty_a (param $buffer i32) (param $chars i32)
    (if (i32.and (local.get $buffer) (local.get $chars))
      (then (i32.store8 (call $g2w (local.get $buffer)) (i32.const 0)))))

  ;; Shell-link string state is object-owned. Callers commonly build these
  ;; values in temporary setup buffers, so retaining their pointer makes a
  ;; later Get* observe overwritten memory. Allocate the replacement before
  ;; releasing the old value so an allocation failure leaves state intact.
  ;; selector: 0=path/misc0, 1=arguments/misc1, 2=working directory/misc2.
  (func $shell_link_set_string (param $this i32) (param $source i32)
      (param $selector i32) (param $dirty_bit i32) (result i32)
    (local $entry i32) (local $copy i32) (local $old i32)
    (if (i32.eqz (local.get $source))
      (then
        ;; SetPath historically rejects NULL; the two optional strings retain
        ;; their existing NULL-as-clear behavior.
        (if (i32.eqz (local.get $selector))
          (then (return (i32.const 0x80070057)))) ;; E_INVALIDARG
        (local.set $entry (call $dx_from_this (local.get $this)))
        (if (i32.eq (local.get $selector) (i32.const 1))
          (then
            (local.set $old (load.field DxObject misc1 (local.get $entry)))
            (store.field DxObject misc1 (local.get $entry) (i32.const 0)))
          (else
            (local.set $old (load.field DxObject misc2 (local.get $entry)))
            (store.field DxObject misc2 (local.get $entry) (i32.const 0))))
        (if (local.get $old) (then (call $heap_free (local.get $old))))
        (store.field DxObject flags (local.get $entry)
          (i32.or (load.field DxObject flags (local.get $entry)) (local.get $dirty_bit)))
        (return (i32.const 0))))
    (local.set $copy (call $guest_strdup (local.get $source)))
    (if (i32.eqz (local.get $copy))
      (then (return (i32.const 0x8007000E)))) ;; E_OUTOFMEMORY
    (local.set $entry (call $dx_from_this (local.get $this)))
    (if (i32.eqz (local.get $selector))
      (then
        (local.set $old (load.field DxObject misc0 (local.get $entry)))
        (store.field DxObject misc0 (local.get $entry) (local.get $copy)))
      (else
        (if (i32.eq (local.get $selector) (i32.const 1))
          (then
            (local.set $old (load.field DxObject misc1 (local.get $entry)))
            (store.field DxObject misc1 (local.get $entry) (local.get $copy)))
          (else
            (local.set $old (load.field DxObject misc2 (local.get $entry)))
            (store.field DxObject misc2 (local.get $entry) (local.get $copy))))))
    (if (local.get $old) (then (call $heap_free (local.get $old))))
    (store.field DxObject flags (local.get $entry)
      (i32.or (load.field DxObject flags (local.get $entry)) (local.get $dirty_bit)))
    (i32.const 0))

  ;; Copy at most cch-1 bytes and always terminate when a non-empty output
  ;; buffer is supplied. The return value is the stored pointer so GetPath can
  ;; distinguish its documented S_OK (path retrieved) from S_FALSE (no path).
  (func $shell_link_get_string (param $this i32) (param $buffer i32)
      (param $chars i32) (param $selector i32) (result i32)
    (local $entry i32) (local $stored i32)
    (local.set $entry (call $dx_from_this (local.get $this)))
    (if (i32.eqz (local.get $selector))
      (then (local.set $stored (load.field DxObject misc0 (local.get $entry))))
      (else
        (if (i32.eq (local.get $selector) (i32.const 1))
          (then (local.set $stored (load.field DxObject misc1 (local.get $entry))))
          (else (local.set $stored (load.field DxObject misc2 (local.get $entry)))))))
    (if (local.get $buffer)
      (then
        (if (i32.gt_s (local.get $chars) (i32.const 0))
          (then
            (if (local.get $stored)
              (then (call $guest_strncpy
                (local.get $buffer) (local.get $stored) (local.get $chars)))
              (else (call $gs8 (local.get $buffer) (i32.const 0))))))))
    (local.get $stored))

  ;; The description and icon location do not fit the DxObject's three string
  ;; slots, so they live in a 12-byte block the object points at from +16 (the
  ;; bpp/pitch words, unused by a shell link): +0 icon path, +4 icon index,
  ;; +8 description. Allocated on first use; $dx_alloc_locked zeroes +16.
  ;; InstallShield gives a shortcut its icon this way when the target exe has
  ;; none of its own (Need for Speed II SE's Nfs2SEn.ico).
  (func $shell_link_ext (param $entry i32) (param $create i32) (result i32)
    (local $ext i32)
    (local.set $ext (i32.load offset=16 (local.get $entry)))
    (if (i32.and (i32.eqz (local.get $ext)) (i32.ne (local.get $create) (i32.const 0)))
      (then
        (local.set $ext (call $heap_alloc (i32.const 12)))
        (if (local.get $ext)
          (then
            (call $gs32 (local.get $ext) (i32.const 0))
            (call $gs32 (i32.add (local.get $ext) (i32.const 4)) (i32.const 0))
            (call $gs32 (i32.add (local.get $ext) (i32.const 8)) (i32.const 0))
            (i32.store offset=16 (local.get $entry) (local.get $ext))))))
    (local.get $ext))

  ;; Replace the string at ext+$field (0 icon path, 8 description) with a copy
  ;; of $source; NULL clears it. Returns an HRESULT.
  (func $shell_link_set_ext_string (param $this i32) (param $source i32)
      (param $field i32) (param $dirty_bit i32) (result i32)
    (local $entry i32) (local $ext i32) (local $copy i32) (local $slot i32) (local $old i32)
    (local.set $entry (call $dx_from_this (local.get $this)))
    (if (local.get $source)
      (then
        (local.set $copy (call $guest_strdup (local.get $source)))
        (if (i32.eqz (local.get $copy))
          (then (return (i32.const 0x8007000E))))))
    (local.set $ext (call $shell_link_ext (local.get $entry) (i32.const 1)))
    (if (i32.eqz (local.get $ext))
      (then
        (if (local.get $copy) (then (call $heap_free (local.get $copy))))
        (return (i32.const 0x8007000E))))
    (local.set $slot (i32.add (local.get $ext) (local.get $field)))
    (local.set $old (call $gl32 (local.get $slot)))
    (call $gs32 (local.get $slot) (local.get $copy))
    (if (local.get $old) (then (call $heap_free (local.get $old))))
    (call $shell_link_mark (local.get $this) (local.get $dirty_bit))
    (i32.const 0))

  (func $shell_link_ext_field (param $this i32) (param $field i32) (result i32)
    (local $ext i32)
    (local.set $ext (call $shell_link_ext (call $dx_from_this (local.get $this)) (i32.const 0)))
    (if (result i32) (local.get $ext)
      (then (call $gl32 (i32.add (local.get $ext) (local.get $field))))
      (else (i32.const 0))))

  (func $shell_link_get_ext_string (param $this i32) (param $buffer i32)
      (param $chars i32) (param $field i32)
    (local $stored i32)
    (local.set $stored (call $shell_link_ext_field (local.get $this) (local.get $field)))
    (if (i32.and (i32.ne (local.get $buffer) (i32.const 0)) (i32.gt_s (local.get $chars) (i32.const 0)))
      (then
        (if (local.get $stored)
          (then (call $guest_strncpy (local.get $buffer) (local.get $stored) (local.get $chars)))
          (else (call $gs8 (local.get $buffer) (i32.const 0)))))))

  ;; IShellLinkA and IPersistFile are wrappers around one DxObject and share
  ;; its reference count. Only the final Release retires their three owned
  ;; strings; non-final releases leave state available through every wrapper.
  (func $shell_link_release (param $this i32) (result i32)
    (local $entry i32) (local $rc i32) (local $owned i32)
    (local.set $entry (call $dx_from_this (local.get $this)))
    (local.set $rc
      (i32.sub (load.field DxObject refcount (local.get $entry)) (i32.const 1)))
    (store.field DxObject refcount (local.get $entry) (local.get $rc))
    (if (i32.le_s (local.get $rc) (i32.const 0))
      (then
        (local.set $owned (load.field DxObject misc0 (local.get $entry)))
        (if (local.get $owned) (then (call $heap_free (local.get $owned))))
        (local.set $owned (load.field DxObject misc1 (local.get $entry)))
        (if (local.get $owned) (then (call $heap_free (local.get $owned))))
        (local.set $owned (load.field DxObject misc2 (local.get $entry)))
        (if (local.get $owned) (then (call $heap_free (local.get $owned))))
        (store.field DxObject misc0 (local.get $entry) (i32.const 0))
        (store.field DxObject misc1 (local.get $entry) (i32.const 0))
        (store.field DxObject misc2 (local.get $entry) (i32.const 0))
        (local.set $owned (call $shell_link_ext (local.get $entry) (i32.const 0)))
        (if (local.get $owned)
          (then
            (if (call $gl32 (local.get $owned))
              (then (call $heap_free (call $gl32 (local.get $owned)))))
            (if (call $gl32 (i32.add (local.get $owned) (i32.const 8)))
              (then (call $heap_free (call $gl32 (i32.add (local.get $owned) (i32.const 8))))))
            (call $heap_free (local.get $owned))
            (i32.store offset=16 (local.get $entry) (i32.const 0))))
        (call $dx_free (local.get $entry))
        (return (i32.const 0))))
    (local.get $rc))

  (func $handle_IShellLinkA_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $shell_link_query_interface
      (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))
  (func $handle_IShellLinkA_AddRef (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_dx_com_addref (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))
  (func $handle_IShellLinkA_Release (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $shell_link_release (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))
  (func $handle_IShellLinkA_GetPath (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $stored i32)
    (local.set $stored (call $shell_link_get_string
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 0)))
    (if (local.get $arg3) (then (call $zero_memory (call $g2w (local.get $arg3)) (i32.const 320))))
    ;; S_FALSE is reserved for a link which has no target path.
    (i32.store offset=0 (global.get $reg_base) (select (i32.const 0) (i32.const 1) (i32.ne (local.get $stored) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
  (func $handle_IShellLinkA_GetIDList (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg1) (then (call $gs32 (local.get $arg1) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (select (i32.const 1) (i32.const 0x80004003) (i32.ne (local.get $arg1) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))
  (func $handle_IShellLinkA_SetIDList (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $shell_link_mark (local.get $arg0) (i32.const 1))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))
  (func $handle_IShellLinkA_GetDescription (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $shell_link_get_ext_string (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 8))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))
  (func $handle_IShellLinkA_SetDescription (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $shell_link_set_ext_string
      (local.get $arg0) (local.get $arg1) (i32.const 8) (i32.const 2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))
  (func $handle_IShellLinkA_GetWorkingDirectory (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (drop (call $shell_link_get_string
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 2)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))
  (func $handle_IShellLinkA_SetWorkingDirectory (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $shell_link_set_string
      (local.get $arg0) (local.get $arg1) (i32.const 2) (i32.const 4)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))
  (func $handle_IShellLinkA_GetArguments (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (drop (call $shell_link_get_string
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 1)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))
  (func $handle_IShellLinkA_SetArguments (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $shell_link_set_string
      (local.get $arg0) (local.get $arg1) (i32.const 1) (i32.const 8)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))
  (func $handle_IShellLinkA_GetHotkey (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg1) (then (call $gs16 (local.get $arg1) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (select (i32.const 0) (i32.const 0x80004003) (i32.ne (local.get $arg1) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))
  (func $handle_IShellLinkA_SetHotkey (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $shell_link_mark (local.get $arg0) (i32.const 16))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))
  (func $handle_IShellLinkA_GetShowCmd (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg1) (then (call $gs32 (local.get $arg1) (i32.const 1))))
    (i32.store offset=0 (global.get $reg_base) (select (i32.const 0) (i32.const 0x80004003) (i32.ne (local.get $arg1) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))
  (func $handle_IShellLinkA_SetShowCmd (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (store.field DxObject width (call $dx_from_this (local.get $arg0)) (local.get $arg1))
    (call $shell_link_mark (local.get $arg0) (i32.const 32))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))
  (func $handle_IShellLinkA_GetIconLocation (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $shell_link_get_ext_string (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 0))
    (if (local.get $arg3)
      (then (call $gs32 (local.get $arg3) (call $shell_link_ext_field (local.get $arg0) (i32.const 4)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))
  (func $handle_IShellLinkA_SetIconLocation (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $hr i32)
    (local.set $hr (call $shell_link_set_ext_string
      (local.get $arg0) (local.get $arg1) (i32.const 0) (i32.const 64)))
    (if (i32.eqz (local.get $hr))
      (then (call $gs32 (i32.add (call $shell_link_ext (call $dx_from_this (local.get $arg0)) (i32.const 0))
        (i32.const 4)) (local.get $arg2))))
    (i32.store offset=0 (global.get $reg_base) (local.get $hr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))
  (func $handle_IShellLinkA_SetRelativePath (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $shell_link_mark (local.get $arg0) (i32.const 128))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))
  (func $handle_IShellLinkA_Resolve (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $shell_link_mark (local.get $arg0) (i32.const 256))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))
  (func $handle_IShellLinkA_SetPath (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $shell_link_set_string
      (local.get $arg0) (local.get $arg1) (i32.const 0) (i32.const 512)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_IPersistFile_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $shell_link_query_interface
      (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))
  (func $handle_IPersistFile_AddRef (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_dx_com_addref (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))
  (func $handle_IPersistFile_Release (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $shell_link_release (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))
  (func $handle_IPersistFile_GetClassID (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg1)
      (then
        (call $gs32 (local.get $arg1) (i32.const 0x00021401))
        (call $gs32 (i32.add (local.get $arg1) (i32.const 4)) (i32.const 0))
        (call $gs32 (i32.add (local.get $arg1) (i32.const 8)) (i32.const 0x000000C0))
        (call $gs32 (i32.add (local.get $arg1) (i32.const 12)) (i32.const 0x46000000))))
    (i32.store offset=0 (global.get $reg_base) (select (i32.const 0) (i32.const 0x80004003) (i32.ne (local.get $arg1) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))
  (func $handle_IPersistFile_IsDirty (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (select (i32.const 0) (i32.const 1)
      (i32.ne (load.field DxObject flags (call $dx_from_this (local.get $arg0))) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))
  (func $handle_IPersistFile_Load (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (local.get $arg1))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057))) ;; E_INVALIDARG
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001)))) ;; output-only host
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))
  ;; Copy at most 259 bytes of a guest string into a link under construction,
  ;; NUL-terminated or as counted ANSI StringData. Returns the next offset.
  (func $shell_link_put_chars (param $buf i32) (param $at i32) (param $src i32)
      (param $counted i32) (result i32)
    (local $len i32) (local $i i32)
    (local.set $len (call $guest_strlen (local.get $src)))
    (if (i32.gt_u (local.get $len) (i32.const 259))
      (then (local.set $len (i32.const 259))))
    (if (local.get $counted)
      (then
        (call $gs16 (i32.add (local.get $buf) (local.get $at)) (local.get $len))
        (local.set $at (i32.add (local.get $at) (i32.const 2)))))
    (block $done (loop $copy
      (br_if $done (i32.ge_u (local.get $i) (local.get $len)))
      (call $gs8 (i32.add (local.get $buf) (i32.add (local.get $at) (local.get $i)))
        (call $gl8 (i32.add (local.get $src) (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $copy)))
    (local.set $at (i32.add (local.get $at) (local.get $len)))
    (if (i32.eqz (local.get $counted))
      (then
        (call $gs8 (i32.add (local.get $buf) (local.get $at)) (i32.const 0))
        (local.set $at (i32.add (local.get $at) (i32.const 1)))))
    (local.get $at))

  ;; The saved file is a real MS-SHLLINK shortcut: the header, then a LinkInfo
  ;; whose LocalBasePath is the SetPath target, then the working directory and
  ;; arguments as StringData, with the description (NAME) ahead of them and
  ;; the icon location after, IconIndex in the header. A header-only file named nothing, so anything
  ;; that later reads the shortcut -- the browser desktop putting an installed
  ;; game's icon up, or a guest resolving it -- had no target to find.
  (func $handle_IPersistFile_Save (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $entry i32) (local $icon i32) (local $ok i32)
    (if (i32.eqz (local.get $arg1))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (local.set $entry (call $dx_from_this (local.get $arg0)))
    (local.set $icon (call $shell_link_ext_field (local.get $arg0) (i32.const 0)))
    (local.set $ok (call $shell_link_write
      (call $g2w (local.get $arg1)) (i32.const 1)
      (load.field DxObject misc0 (local.get $entry))
      (load.field DxObject misc1 (local.get $entry))
      (load.field DxObject misc2 (local.get $entry))
      (call $shell_link_ext_field (local.get $arg0) (i32.const 8))
      (local.get $icon)
      (select (call $shell_link_ext_field (local.get $arg0) (i32.const 4)) (i32.const 0)
        (i32.ne (local.get $icon) (i32.const 0)))))
    (if (i32.eq (local.get $ok) (i32.const 1))
      (then
        (store.field DxObject flags (local.get $entry) (i32.const 0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (else
        (i32.store offset=0 (global.get $reg_base)
          (select (i32.const 0x8007000E) (i32.const 0x80004005) (i32.eq (local.get $ok) (i32.const 2))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; Write an MS-SHLLINK shortcut at the path $lnk_wa (a WASM address, ANSI or
  ;; wide per $lnk_wide). $path/$args/$work/$desc/$icon are guest ANSI strings
  ;; or 0. Used by IPersistFile::Save on an IShellLink and by the virtual
  ;; Program Manager's [AddItem]. Returns 1 written, 0 I/O failure, 2 no memory.
  (func $shell_link_write (param $lnk_wa i32) (param $lnk_wide i32)
      (param $path i32) (param $args i32) (param $work i32) (param $desc i32)
      (param $icon i32) (param $icon_index i32) (result i32)
    (local $link i32) (local $written i32) (local $handle i32)
    (local $flags i32) (local $at i32) (local $info i32) (local $ok i32)
    (local.set $link (call $heap_alloc (i32.const 1536)))
    (local.set $written (call $heap_alloc (i32.const 4)))
    (if (i32.or (i32.eqz (local.get $link)) (i32.eqz (local.get $written)))
      (then
        (if (local.get $link) (then (call $heap_free (local.get $link))))
        (if (local.get $written) (then (call $heap_free (local.get $written))))
        (return (i32.const 2))))
    (call $zero_memory (call $g2w (local.get $link)) (i32.const 1536))
    (if (local.get $path) (then (local.set $flags (i32.const 0x02))))       ;; HasLinkInfo
    (if (local.get $desc)
      (then (local.set $flags (i32.or (local.get $flags) (i32.const 0x04))))) ;; HasName
    (if (local.get $icon)
      (then (local.set $flags (i32.or (local.get $flags) (i32.const 0x40))))) ;; HasIconLocation
    (if (local.get $work)
      (then (local.set $flags (i32.or (local.get $flags) (i32.const 0x10))))) ;; HasWorkingDir
    (if (local.get $args)
      (then (local.set $flags (i32.or (local.get $flags) (i32.const 0x20))))) ;; HasArguments
    (call $gs32 (local.get $link) (i32.const 0x4C))
    (call $gs32 (i32.add (local.get $link) (i32.const 4)) (i32.const 0x00021401))
    (call $gs32 (i32.add (local.get $link) (i32.const 12)) (i32.const 0x000000C0))
    (call $gs32 (i32.add (local.get $link) (i32.const 16)) (i32.const 0x46000000))
    (call $gs32 (i32.add (local.get $link) (i32.const 20)) (local.get $flags))
    (if (local.get $icon)
      (then (call $gs32 (i32.add (local.get $link) (i32.const 56)) (local.get $icon_index))))
    (call $gs32 (i32.add (local.get $link) (i32.const 60)) (i32.const 1)) ;; SW_SHOWNORMAL
    (local.set $at (i32.const 0x4C))
    (if (local.get $path)
      (then
        (local.set $info (i32.add (local.get $link) (local.get $at)))
        (call $gs32 (i32.add (local.get $info) (i32.const 4)) (i32.const 0x1C))
        (call $gs32 (i32.add (local.get $info) (i32.const 8)) (i32.const 1)) ;; VolumeIDAndLocalBasePath
        (call $gs32 (i32.add (local.get $info) (i32.const 12)) (i32.const 0x1C))
        (call $gs32 (i32.add (local.get $info) (i32.const 16)) (i32.const 0x2D))
        (call $gs32 (i32.add (local.get $info) (i32.const 0x1C)) (i32.const 0x11))
        (call $gs32 (i32.add (local.get $info) (i32.const 0x20)) (i32.const 3)) ;; DRIVE_FIXED
        (call $gs32 (i32.add (local.get $info) (i32.const 0x28)) (i32.const 0x10))
        (local.set $at (call $shell_link_put_chars
          (local.get $info) (i32.const 0x2D) (local.get $path) (i32.const 0)))
        (call $gs32 (i32.add (local.get $info) (i32.const 24)) (local.get $at))
        (local.set $at (i32.add (local.get $at) (i32.const 1)))
        (call $gs32 (local.get $info) (local.get $at))
        (local.set $at (i32.add (i32.const 0x4C) (local.get $at)))))
    (if (local.get $desc)
      (then (local.set $at (call $shell_link_put_chars
        (local.get $link) (local.get $at) (local.get $desc) (i32.const 1)))))
    (if (local.get $work)
      (then (local.set $at (call $shell_link_put_chars
        (local.get $link) (local.get $at) (local.get $work) (i32.const 1)))))
    (if (local.get $args)
      (then (local.set $at (call $shell_link_put_chars
        (local.get $link) (local.get $at) (local.get $args) (i32.const 1)))))
    (if (local.get $icon)
      (then (local.set $at (call $shell_link_put_chars
        (local.get $link) (local.get $at) (local.get $icon) (i32.const 1)))))
    (local.set $at (i32.add (local.get $at) (i32.const 4))) ;; TerminalBlock
    (local.set $handle (call $host_fs_create_file
      (local.get $lnk_wa) (i32.const 0x40000000)
      (i32.const 2) (i32.const 0x80) (local.get $lnk_wide)))
    (if (i32.ne (local.get $handle) (i32.const -1))
      (then
        (local.set $ok (i32.and
          (i32.ne (call $host_fs_write_file (local.get $handle) (local.get $link)
            (local.get $at) (local.get $written)) (i32.const 0))
          (i32.eq (call $gl32 (local.get $written)) (local.get $at))))
        (drop (call $host_fs_close_handle (local.get $handle)))))
    (call $heap_free (local.get $link))
    (call $heap_free (local.get $written))
    (local.get $ok))
  (func $handle_IPersistFile_SaveCompleted (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $shell_link_mark (local.get $arg0) (i32.const 1024))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))
  (func $handle_IPersistFile_GetCurFile (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg1) (then (call $gs32 (local.get $arg1) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004001))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; 769: CoCreateInstance(rclsid, pUnkOuter, dwClsContext, riid, ppv) — 5 args stdcall
  (func $handle_CoCreateInstance (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $hr i32) (local $clsid_d1 i32) (local $obj_guest i32)
    (local $clsid_wa i32) (local $iid_wa i32) (local $local_class i32)
    ;; Short-circuit CLSID_DirectDrawFactory {4FD2A832-86C8-11D0-8FCA-00C04FD9189D}
    ;; from ddrawex.dll. Used by CORBIS/FASHION/HORROR/WOTRAVEL screensavers; we
    ;; manufacture an IDirectDrawFactory directly so the guest never needs the DLL.
    ;; Translate each input GUID once. The host fallback below receives these
    ;; same addresses; local classes compare all 128 bits in-place.
    (if (local.get $arg0)
      (then (local.set $clsid_wa (call $g2w (local.get $arg0)))))
    (if (local.get $arg3)
      (then (local.set $iid_wa (call $g2w (local.get $arg3)))))
    (if (local.get $clsid_wa)
      (then (local.set $clsid_d1 (i32.load (local.get $clsid_wa)))))

    ;; The eight Win98-era classes below have complete local
    ;; QueryInterface contracts. Classify by full CLSID, manufacture one
    ;; factory-owned reference, query the requested interface, then release
    ;; that temporary reference on both success and failure.
    ;; CLSID_DirectPlay {D1EB6D20-8923-11D0-9D97-00A0C90A43CB}.
    (if (local.get $clsid_wa) (then
      (if (call $guid_words_equal (local.get $clsid_wa)
            (i32.const 0xD1EB6D20) (i32.const 0x11D08923)
            (i32.const 0xA000979D) (i32.const 0xCB430AC9))
        (then (local.set $local_class (i32.const 1))))
      ;; CLSID_DirectMusic {636B9F10-0C7D-11D1-95B2-0020AFDC7421}.
      (if (call $guid_words_equal (local.get $clsid_wa)
            (i32.const 0x636B9F10) (i32.const 0x11D10C7D)
            (i32.const 0x2000B295) (i32.const 0x2174DCAF))
        (then (local.set $local_class (i32.const 2))))
      ;; CLSID_AMMultiMediaStream {49C47CE5-9BA4-11D0-8212-00C04FC32C45}.
      (if (call $guid_words_equal (local.get $clsid_wa)
            (i32.const 0x49C47CE5) (i32.const 0x11D09BA4)
            (i32.const 0xC0001282) (i32.const 0x452CC34F))
        (then (local.set $local_class (i32.const 3))))
      ;; CLSID_DirectPlayLobby {2FE8F810-B2A5-11D0-A787-0000F803ABFC}.
      (if (call $guid_words_equal (local.get $clsid_wa)
            (i32.const 0x2FE8F810) (i32.const 0x11D0B2A5)
            (i32.const 0x000087A7) (i32.const 0xFCAB03F8))
        (then (local.set $local_class (i32.const 4))))
      ;; CLSID_DirectSound {47D4D946-62E8-11CF-93BC-444553540000}.
      (if (call $guid_words_equal (local.get $clsid_wa)
            (i32.const 0x47D4D946) (i32.const 0x11CF62E8)
            (i32.const 0x4544BC93) (i32.const 0x00005453))
        (then (local.set $local_class (i32.const 5))))
      ;; CLSID_DirectSound8 {3901CC3F-84B5-4FA4-BA35-AA8172B8A09B}.
      (if (call $guid_words_equal (local.get $clsid_wa)
            (i32.const 0x3901CC3F) (i32.const 0x4FA484B5)
            (i32.const 0x81AA35BA) (i32.const 0x9BA0B872))
        (then (local.set $local_class (i32.const 10))))
      ;; CLSID_ShellLink {00021401-0000-0000-C000-000000000046}.
      (if (call $guid_words_equal (local.get $clsid_wa)
            (i32.const 0x00021401) (i32.const 0)
            (i32.const 0x000000C0) (i32.const 0x46000000))
        (then (local.set $local_class (i32.const 6))))
      ;; CLSID_DirectX7 {E1211353-8E94-11D1-8808-00C04FC2C602}.
      (if (call $guid_words_equal (local.get $clsid_wa)
            (i32.const 0xE1211353) (i32.const 0x11D18E94)
            (i32.const 0xC0000888) (i32.const 0x02C6C24F))
        (then (local.set $local_class (i32.const 7))))
      ;; CLSID_DirectDrawFactory {4FD2A832-86C8-11D0-8FCA-00C04FD9189D}.
      (if (call $guid_words_equal (local.get $clsid_wa)
            (i32.const 0x4FD2A832) (i32.const 0x11D086C8)
            (i32.const 0xC000CA8F) (i32.const 0x9D18D94F))
        (then (local.set $local_class (i32.const 8))))
      ;; CLSID_DirectDraw {D7B70EE0-4340-11CF-B063-0020AFC2CD35}. Half-Life's
      ;; hw.dll builds its DirectDraw this way rather than through
      ;; DirectDrawCreate, then calls IDirectDraw::Initialize; failing the
      ;; activation is what made the engine report "The selected D3D mode is
      ;; not supported by your video card" and unload the hardware renderer.
      (if (call $guid_words_equal (local.get $clsid_wa)
            (i32.const 0xD7B70EE0) (i32.const 0x11CF4340)
            (i32.const 0x200063B0) (i32.const 0x35CDC2AF))
        (then (local.set $local_class (i32.const 9))))))

    (if (local.get $local_class) (then
      (if (i32.eqz (local.get $arg4))
        (then
          (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)) ;; E_POINTER
          (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
          (return)))
      (call $gs32 (local.get $arg4) (i32.const 0))
      (if (local.get $arg1)
        (then
          (i32.store offset=0 (global.get $reg_base) (i32.const 0x80040110)) ;; CLASS_E_NOAGGREGATION
          (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
          (return)))
      (if (i32.eq (local.get $local_class) (i32.const 1))
        (then (local.set $obj_guest
          (call $dx_create_com_obj (i32.const 26) (global.get $DX_VTBL_DPLAY3)))))
      (if (i32.eq (local.get $local_class) (i32.const 2))
        (then (local.set $obj_guest (call $dx_create_com_obj
          (i32.const 35) (call $directmusic_vtable)))))
      (if (i32.eq (local.get $local_class) (i32.const 3))
        (then (local.set $obj_guest (call $dx_create_com_obj
          (i32.const 36) (call $init_com_vtable
            (global.get $API_ID_IAMMultiMediaStream_BASE) (i32.const 19))))))
      (if (i32.eq (local.get $local_class) (i32.const 4))
        (then (local.set $obj_guest (call $dx_create_com_obj
          (i32.const 27) (global.get $DX_VTBL_DPLAYLOBBY2)))))
      (if (i32.eq (local.get $local_class) (i32.const 5))
        (then (local.set $obj_guest (call $dx_create_com_obj
          (i32.const 4) (global.get $DX_VTBL_DSOUND)))))
      ;; COM activation leaves Initialize to the caller, unlike DirectSoundCreate8.
      (if (i32.eq (local.get $local_class) (i32.const 10))
        (then (local.set $obj_guest (call $dx_create_com_obj
          (i32.const 4) (global.get $DX_VTBL_DSOUND8)))))
      (if (i32.eq (local.get $local_class) (i32.const 6))
        (then
          (call $shell_link_init_vtables)
          (local.set $obj_guest (call $dx_create_com_obj
            (i32.const 36) (global.get $SHELL_LINK_VTBL)))))
      (if (i32.eq (local.get $local_class) (i32.const 7))
        (then (local.set $obj_guest (call $dx_create_com_obj
          (i32.const 32) (call $init_com_vtable (global.get $API_ID_IVBDirectX7_BASE) (i32.const 58))))))
      (if (i32.eq (local.get $local_class) (i32.const 8))
        (then (local.set $obj_guest (call $dx_create_com_obj
          (i32.const 10) (global.get $DX_VTBL_DDFACTORY)))))
      (if (i32.eq (local.get $local_class) (i32.const 9))
        (then
          (local.set $obj_guest (call $dx_create_com_obj
            (i32.const 1) (global.get $DX_VTBL_DDRAW)))
          (if (local.get $obj_guest)
            (then
              (global.set $dx_ddraw_this (local.get $obj_guest))
              (call $dx_coop_hwnd_set (i32.const 0))))))
      (if (i32.eqz (local.get $obj_guest))
        (then
          (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000E)) ;; E_OUTOFMEMORY
          (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
          (return)))
      (if (i32.eq (local.get $local_class) (i32.const 1))
        (then (local.set $hr (call $dplay_query_interface
          (local.get $obj_guest) (local.get $arg3) (local.get $arg4) (i32.const 0)))))
      (if (i32.eq (local.get $local_class) (i32.const 2))
        (then (local.set $hr (call $dx_query_interface_single_wa
          (local.get $obj_guest) (local.get $iid_wa) (local.get $arg4)
          (i32.const 0x6536115A) (i32.const 0x11D27B2D)
          (i32.const 0x000018BA) (i32.const 0x12AC75F8)))))
      (if (i32.eq (local.get $local_class) (i32.const 3))
        (then (local.set $hr (call $dx_query_interface_single_wa
          (local.get $obj_guest) (local.get $iid_wa) (local.get $arg4)
          (i32.const 0xBEBE595C) (i32.const 0x11D09A6F)
          (i32.const 0xC000DE8F) (i32.const 0x9D18D94F)))))
      (if (i32.eq (local.get $local_class) (i32.const 4))
        (then (local.set $hr (call $dplay_query_interface_wa
          (local.get $obj_guest) (local.get $iid_wa) (local.get $arg4) (i32.const 1)))))
      (if (i32.eq (local.get $local_class) (i32.const 5))
        (then (local.set $hr (call $dx_query_interface_single_wa
          (local.get $obj_guest) (local.get $iid_wa) (local.get $arg4)
          (i32.const 0x279AFA83) (i32.const 0x11CE4981)
          (i32.const 0x200021A5) (i32.const 0x60E50BAF)))))
      (if (i32.eq (local.get $local_class) (i32.const 10))
        (then
          (if (if (result i32) (local.get $iid_wa)
                (then (call $guid_words_equal (local.get $iid_wa)
                  (i32.const 0xC50A7E93) (i32.const 0x4834F395)
                  (i32.const 0xA97FF69E) (i32.const 0x6609E59D)))
                (else (i32.const 0)))
            (then (local.set $hr (call $dx_query_interface_result
              (local.get $obj_guest) (local.get $arg4) (i32.const 1))))
            (else (local.set $hr (call $dx_query_interface_single_wa
              (local.get $obj_guest) (local.get $iid_wa) (local.get $arg4)
              (i32.const 0x279AFA83) (i32.const 0x11CE4981)
              (i32.const 0x200021A5) (i32.const 0x60E50BAF)))))))
      (if (i32.eq (local.get $local_class) (i32.const 6))
        (then (local.set $hr (call $shell_link_query_interface_wa
          (local.get $obj_guest) (local.get $iid_wa) (local.get $arg4)))))
      (if (i32.eq (local.get $local_class) (i32.const 7))
        (then (local.set $hr (call $directx7_query_interface_wa
          (local.get $obj_guest) (local.get $iid_wa) (local.get $arg4)))))
      (if (i32.eq (local.get $local_class) (i32.const 8))
        (then (local.set $hr (call $dx_query_interface_single_wa
          (local.get $obj_guest) (local.get $iid_wa) (local.get $arg4)
          (i32.const 0x4FD2A833) (i32.const 0x11D086C8)
          (i32.const 0xC000CA8F) (i32.const 0x9D18D94F)))))
      (if (i32.eq (local.get $local_class) (i32.const 9))
        (then (local.set $hr (call $ddraw_cocreate_query_wa
          (local.get $obj_guest) (local.get $iid_wa) (local.get $arg4)))))
      (drop (call $dx_com_release_basic (local.get $obj_guest)))
      (i32.store offset=0 (global.get $reg_base) (local.get $hr))
      (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
      (return)))

    ;; Minimal DirectAnimation Automation placeholders for the Plus!98 MFC
    ;; screensavers. CLSIDFromProgID below writes private sentinel CLSIDs for
    ;; DAView/DAStatics; these objects expose IDispatch enough for tracing and
    ;; graceful fallback without loading danim.dll.
    (if (i32.eq (local.get $clsid_d1) (i32.const 0xDA51DA01))
      (then
        (local.set $obj_guest (call $dx_create_com_obj (i32.const 28) (global.get $DX_VTBL_DA_VIEW)))
        (if (i32.eqz (local.get $obj_guest))
          (then
            (call $gs32 (local.get $arg4) (i32.const 0))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004005))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
            (return)))
        (call $gs32 (local.get $arg4) (local.get $obj_guest))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    (if (i32.eq (local.get $clsid_d1) (i32.const 0xDA57A71C))
      (then
        (local.set $obj_guest (call $dx_create_com_obj (i32.const 29) (global.get $DX_VTBL_DA_STATICS)))
        (if (i32.eqz (local.get $obj_guest))
          (then
            (call $gs32 (local.get $arg4) (i32.const 0))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004005))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
            (return)))
        (call $gs32 (local.get $arg4) (local.get $obj_guest))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    ;; The private 0x40000000 CLSCTX bit asks the host only to resolve an
    ;; in-proc server: it answers COM_RESOLVED_INPROC with DllGetClassObject's
    ;; address in *ppv, and the activation then runs as ordinary guest calls
    ;; ($com_activate_begin) instead of a nested run the guest cannot block in.
    (local.set $hr (call $host_com_create_instance
      (local.get $clsid_wa)           ;; rclsid → WASM addr
      (local.get $arg1)               ;; pUnkOuter (guest addr, usually NULL)
      (i32.or (local.get $arg2) (i32.const 0x40000000)) ;; dwClsContext
      (local.get $iid_wa)             ;; riid → WASM addr
      (local.get $arg4)))             ;; ppv (guest addr)
    (if (i32.eq (local.get $hr) (i32.const 2)) ;; COM_RESOLVED_INPROC
      (then
        (call $com_activate_begin (call $gl32 (local.get $arg4)) (local.get $arg0) (local.get $arg4) (i32.const 0) (i32.const 0))
        (return)))
    (if (i32.eq (local.get $hr) (i32.const 3)) ;; COM_RESOLVED_REGISTERED_FACTORY
      (then
        (call $com_activate_registered_begin (call $gl32 (local.get $arg4)) (local.get $arg4))
        (return)))
    ;; Check if we need async DLL load (host returns 0x800401F0 = CO_E_DLLNOTFOUND)
    (if (i32.eq (local.get $hr) (i32.const 0x800401F0))
      (then
        ;; Save COM state for resume after DLL fetch
        (global.set $com_clsid_ptr (local.get $arg0))
        (global.set $com_iid_ptr (local.get $arg3))
        (global.set $com_ppv_ptr (local.get $arg4))
        (global.set $com_unk_outer (local.get $arg1))
        (global.set $com_cls_ctx (local.get $arg2))
        (global.set $com_dll_name (call $host_com_get_pending_dll))
        ;; Yield to JS for async DLL fetch — DON'T advance ESP yet
        ;; JS will load DLL, then re-call com_create_instance
        (call $com_dll_block)
        (return)))
    ;; Synchronous success or error — zero *ppv on failure per COM spec
    (if (local.get $hr)
      (then (call $gs32 (local.get $arg4) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (local.get $hr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))  ;; stdcall, 5 args
  )

  ;; CoGetClassObject(rclsid, dwClsContext, pvReserved, riid, ppv) — 5 args.
  ;; The host COM bridge already performs registry lookup, async in-proc DLL
  ;; loading and DllGetClassObject reentry. Its private high CLSCTX bit asks it
  ;; to return the requested class-factory interface directly.
  (func $handle_CoGetClassObject (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $hr i32) (local $host_ctx i32) (local $factory i32)
    ;; CLSID_CommonDialog {F9043C85-F6F2-101A-A3C9-08002B2F49FB}.
    (if (i32.eq (call $gl32 (local.get $arg0)) (i32.const 0xF9043C85))
      (then
        (if (i32.eqz (local.get $arg4))
          (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003)))
          (else
            (local.set $factory (call $common_dialog_factory_create (local.get $arg0)))
            (call $gs32 (local.get $arg4) (local.get $factory))
            (i32.store offset=0 (global.get $reg_base) (select (i32.const 0) (i32.const 0x8007000E)
                (i32.ne (local.get $factory) (i32.const 0))))))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    ;; Resolve on the host; guest factory code must execute on this CPU/stack.
    ;; 0x80000000 preserves class-factory lookup; 0x40000000 resolves only.
    (if (i32.eqz (local.get $arg4))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    (local.set $host_ctx (i32.or (local.get $arg1) (i32.const 0xC0000000)))
    (local.set $hr (call $host_com_create_instance
      (call $g2w (local.get $arg0))
      (local.get $arg2)
      (local.get $host_ctx)
      (call $g2w (local.get $arg3))
      (local.get $arg4)))
    (if (i32.eq (local.get $hr) (i32.const 2))
      (then
        (call $com_activate_begin (call $gl32 (local.get $arg4)) (local.get $arg0) (local.get $arg4) (i32.const 1) (local.get $arg3))
        (return)))
    (if (i32.eq (local.get $hr) (i32.const 0x800401F0))
      (then
        (global.set $com_clsid_ptr (local.get $arg0))
        (global.set $com_iid_ptr (local.get $arg3))
        (global.set $com_ppv_ptr (local.get $arg4))
        (global.set $com_unk_outer (local.get $arg2))
        (global.set $com_cls_ctx (local.get $host_ctx))
        (global.set $com_dll_name (call $host_com_get_pending_dll))
        (call $com_dll_block)
        (return)))
    (if (local.get $hr)
      (then (call $gs32 (local.get $arg4) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (local.get $hr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
  )

  ;; OLEAUT32 BSTR support. BSTR layout:
  ;;   [ptr-4..ptr-1] = byte length (not char count, not including null)
  ;;   [ptr..ptr+len-1] = UTF-16 LE data
  ;;   [ptr+len..ptr+len+1] = null terminator (always present)
  ;; We allocate (len+6) bytes via $heap_alloc; the 4-byte length prefix lives
  ;; at the start of the allocation, so BSTR = alloc+4 and SysFreeString can
  ;; free(alloc) = free(bstr-4).

  ;; SysAllocString(psz: PCOLESTR) → BSTR
  (func $handle_SysAllocString (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $nchars i32) (local $nbytes i32) (local $alloc i32) (local $bstr i32)
    (local $src_w i32) (local $dst_w i32)
    (if (i32.eqz (local.get $arg0))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))) (return)))
    (local.set $nchars (call $guest_wcslen (local.get $arg0)))
    (local.set $nbytes (i32.shl (local.get $nchars) (i32.const 1)))
    (local.set $alloc (call $heap_alloc (i32.add (local.get $nbytes) (i32.const 6))))
    (if (i32.eqz (local.get $alloc))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))) (return)))
    (local.set $bstr (i32.add (local.get $alloc) (i32.const 4)))
    ;; Write length prefix at alloc+0
    (call $gs32 (local.get $alloc) (local.get $nbytes))
    ;; Copy the UTF-16 payload + null terminator via WASM addrs
    (local.set $src_w (call $g2w (local.get $arg0)))
    (local.set $dst_w (call $g2w (local.get $bstr)))
    (memory.copy (local.get $dst_w) (local.get $src_w) (i32.add (local.get $nbytes) (i32.const 2)))
    (i32.store offset=0 (global.get $reg_base) (local.get $bstr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; SysAllocStringLen(psz: PCOLESTR, cch: UINT) → BSTR. psz may be NULL (then uninit'd).
  (func $handle_SysAllocStringLen (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $nbytes i32) (local $alloc i32) (local $bstr i32)
    (local.set $nbytes (i32.shl (local.get $arg1) (i32.const 1)))
    (local.set $alloc (call $heap_alloc (i32.add (local.get $nbytes) (i32.const 6))))
    (if (i32.eqz (local.get $alloc))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))) (return)))
    (local.set $bstr (i32.add (local.get $alloc) (i32.const 4)))
    (call $gs32 (local.get $alloc) (local.get $nbytes))
    (if (local.get $arg0)
      (then (memory.copy
        (call $g2w (local.get $bstr))
        (call $g2w (local.get $arg0))
        (local.get $nbytes))))
    ;; Always null-terminate
    (call $gs16 (i32.add (local.get $bstr) (local.get $nbytes)) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (local.get $bstr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; SysReAllocStringLen(pbstr, psz, cch) replaces a counted UTF-16 string.
  ;; Copy before freeing: psz may alias the old BSTR, including an interior
  ;; slice. Allocation failure must leave both *pbstr and its contents intact.
  (func $handle_SysReAllocStringLen (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $old i32) (local $nbytes i32) (local $alloc i32) (local $bstr i32)
    ;; NULL pbstr is an invalid caller pointer, not a successful no-op.
    (if (i32.eqz (local.get $arg0)) (then (unreachable)))
    (local.set $old (call $gl32 (local.get $arg0)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    ;; heap_alloc's maximum request is 0x7FFFFFF0. Guard before doubling
    ;; cch or adding the four-byte prefix and two-byte terminator.
    (if (i32.le_u (local.get $arg2) (i32.const 0x3FFFFFF5))
      (then
        (local.set $nbytes (i32.shl (local.get $arg2) (i32.const 1)))
        (local.set $alloc (call $heap_alloc (i32.add (local.get $nbytes) (i32.const 6))))
        (if (local.get $alloc)
          (then
            (local.set $bstr (i32.add (local.get $alloc) (i32.const 4)))
            (call $gs32 (local.get $alloc) (local.get $nbytes))
            (if (i32.and (i32.ne (local.get $arg1) (i32.const 0))
                         (i32.ne (local.get $nbytes) (i32.const 0)))
              (then (memory.copy (call $g2w (local.get $bstr))
                (call $g2w (local.get $arg1)) (local.get $nbytes))))
            (call $gs16 (i32.add (local.get $bstr) (local.get $nbytes)) (i32.const 0))
            (if (local.get $old)
              (then (call $heap_free (i32.sub (local.get $old) (i32.const 4)))))
            (call $gs32 (local.get $arg0) (local.get $bstr))
            (i32.store offset=0 (global.get $reg_base) (i32.const 1))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; SysAllocStringByteLen(psz: LPCSTR, len: UINT) creates a BSTR whose payload
  ;; is an exact byte slice. It is deliberately not an ANSI-to-UTF16 conversion:
  ;; callers use the byte form for binary/odd-length automation strings too.
  (func $handle_SysAllocStringByteLen (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $alloc i32) (local $bstr i32)
    (local.set $alloc (call $heap_alloc (i32.add (local.get $arg1) (i32.const 6))))
    (if (i32.eqz (local.get $alloc))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (local.set $bstr (i32.add (local.get $alloc) (i32.const 4)))
    (call $gs32 (local.get $alloc) (local.get $arg1))
    (if (i32.and (i32.ne (local.get $arg0) (i32.const 0))
                  (i32.ne (local.get $arg1) (i32.const 0)))
      (then (memory.copy
        (call $g2w (local.get $bstr))
        (call $g2w (local.get $arg0))
        (local.get $arg1))))
    (call $gs16 (i32.add (local.get $bstr) (local.get $arg1)) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (local.get $bstr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; SysFreeString(bstr: BSTR). No-op on NULL.
  (func $handle_SysFreeString (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg0)
      (then (call $heap_free (i32.sub (local.get $arg0) (i32.const 4)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; SysStringLen(bstr: BSTR) → UINT char count (length prefix / 2).
  (func $handle_SysStringLen (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (local.get $arg0))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))) (return)))
    (i32.store offset=0 (global.get $reg_base) (i32.shr_u
      (call $gl32 (i32.sub (local.get $arg0) (i32.const 4)))
      (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; SysStringByteLen(bstr: BSTR) returns the stored byte count unchanged.
  (func $handle_SysStringByteLen (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; `select` eagerly evaluates both values in Wasm, so it cannot guard the
    ;; length-prefix read for a NULL BSTR.
    (if (i32.eqz (local.get $arg0))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (else
        (i32.store offset=0 (global.get $reg_base) (call $gl32 (i32.sub (local.get $arg0) (i32.const 4))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; VariantClear(pvarg: VARIANTARG*) → HRESULT. Full impl would free BSTR/dispatch
  ;; fields based on vt, but Spider stores only simple VT_I4/VT_BOOL variants, and
  ;; any cached BSTR leaks are bounded. A by-value VT_ARRAY owns its SAFEARRAY
  ;; (devenum's FilterData is VT_UI1|VT_ARRAY), so that one is destroyed. Zero
  ;; the whole 16-byte VARIANT so callers don't re-read stale tagged pointers.
  (func $handle_VariantClear (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $vt i32)
    (if (local.get $arg0)
      (then
        (local.set $vt (call $gl16 (local.get $arg0)))
        (if (i32.eq (i32.and (local.get $vt) (i32.const 0x6000)) (i32.const 0x2000)) ;; VT_ARRAY, not VT_BYREF
          (then (drop (call $safearray_destroy (call $gl32 (i32.add (local.get $arg0) (i32.const 8)))))))
        (call $zero_memory (call $g2w (local.get $arg0)) (i32.const 16))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))  ;; S_OK
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; VariantInit(pvarg) — mark the VARIANT as VT_EMPTY. Unlike VariantClear
  ;; this must NOT release anything: the struct is assumed to hold garbage.
  ;; Zeroing all 16 bytes both sets VT_EMPTY and leaves the union clean.
  (func $handle_VariantInit (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg0)
      (then (call $zero_memory (call $g2w (local.get $arg0)) (i32.const 16))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; VariantCopy(pvargDest, pvargSrc) → HRESULT. Release the destination, then
  ;; take a copy of the source. A BSTR has to be duplicated rather than
  ;; aliased, since both variants are independently owned and either may be
  ;; cleared first; every other type in a VARIANT is inline.
  (func $handle_VariantCopy (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $vt i32) (local $src_bstr i32) (local $len i32) (local $copy i32) (local $dst_wa i32)
    (if (i32.or (i32.eqz (local.get $arg0)) (i32.eqz (local.get $arg1)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057))  ;; E_INVALIDARG
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (local.set $dst_wa (call $g2w (local.get $arg0)))
    (call $zero_memory (local.get $dst_wa) (i32.const 16))
    (memory.copy (local.get $dst_wa) (call $g2w (local.get $arg1)) (i32.const 16))
    (local.set $vt (call $gl16 (local.get $arg1)))
    (if (i32.eq (local.get $vt) (i32.const 8))    ;; VT_BSTR
      (then
        (local.set $src_bstr (call $gl32 (i32.add (local.get $arg1) (i32.const 8))))
        (if (local.get $src_bstr)
          (then
            ;; A BSTR stores its byte length in the dword before the data.
            (local.set $len (call $gl32 (i32.sub (local.get $src_bstr) (i32.const 4))))
            (local.set $copy (call $heap_alloc (i32.add (local.get $len) (i32.const 6))))
            (if (local.get $copy)
              (then
                (local.set $copy (i32.add (local.get $copy) (i32.const 4)))
                (call $gs32 (i32.sub (local.get $copy) (i32.const 4)) (local.get $len))
                (memory.copy (call $g2w (local.get $copy)) (call $g2w (local.get $src_bstr))
                  (i32.add (local.get $len) (i32.const 2)))))
            (call $gs32 (i32.add (local.get $arg0) (i32.const 8)) (local.get $copy))))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))  ;; S_OK
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; LoadTypeLib(szFile: LPCOLESTR, pptlib: ITypeLib**) → HRESULT. We don't
  ;; implement type libraries; return TYPE_E_CANTLOADLIBRARY (0x80029C4A) so the
  ;; caller can take its "no typelib" fallback path. Zero out *pptlib.
  (func $handle_LoadTypeLib (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg1)
      (then (call $gs32 (local.get $arg1) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80029C4A))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; SAFEARRAY: USHORT cDims +0, USHORT fFeatures +2, ULONG cbElements +4,
  ;; ULONG cLocks +8, PVOID pvData +12, SAFEARRAYBOUND[cDims] +16 as
  ;; {cElements, lLbound}. OLEAUT32 keeps the VARTYPE in the dword before the
  ;; descriptor and flags that with FADF_HAVEVARTYPE; this layout matches.
  ;; Only element types that own nothing are supported: an array of BSTRs,
  ;; VARIANTs or interfaces would need its elements released on destroy.
  (func $safearray_elem_size (param $vt i32) (result i32)
    (if (i32.or (i32.eq (local.get $vt) (i32.const 16)) (i32.eq (local.get $vt) (i32.const 17))) ;; I1 UI1
      (then (return (i32.const 1))))
    (if (i32.or (i32.eq (local.get $vt) (i32.const 2))
          (i32.or (i32.eq (local.get $vt) (i32.const 18)) (i32.eq (local.get $vt) (i32.const 11)))) ;; I2 UI2 BOOL
      (then (return (i32.const 2))))
    (if (i32.or (i32.or (i32.eq (local.get $vt) (i32.const 3)) (i32.eq (local.get $vt) (i32.const 4)))    ;; I4 R4
          (i32.or (i32.or (i32.eq (local.get $vt) (i32.const 19)) (i32.eq (local.get $vt) (i32.const 10))) ;; UI4 ERROR
                  (i32.or (i32.eq (local.get $vt) (i32.const 22)) (i32.eq (local.get $vt) (i32.const 23))))) ;; INT UINT
      (then (return (i32.const 4))))
    (if (i32.or (i32.or (i32.eq (local.get $vt) (i32.const 5)) (i32.eq (local.get $vt) (i32.const 6)))    ;; R8 CY
          (i32.or (i32.eq (local.get $vt) (i32.const 7))                                                   ;; DATE
                  (i32.or (i32.eq (local.get $vt) (i32.const 20)) (i32.eq (local.get $vt) (i32.const 21))))) ;; I8 UI8
      (then (return (i32.const 8))))
    (i32.const 0))

  ;; SafeArrayCreate(vt, cDims, rgsabound) → SAFEARRAY*, NULL on failure.
  (func $handle_SafeArrayCreate (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $cb i32) (local $i i32) (local $count i64) (local $block i32) (local $sa i32) (local $data i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (local.set $cb (call $safearray_elem_size (i32.and (local.get $arg0) (i32.const 0xFFFF))))
    (if (i32.eqz (local.get $cb))
      (then (call $crash_unimplemented (local.get $name_ptr))))
    (if (i32.or (i32.eqz (local.get $arg2))
          (i32.or (i32.eqz (local.get $arg1)) (i32.gt_u (local.get $arg1) (i32.const 64))))
      (then (return)))
    (local.set $count (i64.const 1))
    (block $done (loop $dims
      (br_if $done (i32.ge_u (local.get $i) (local.get $arg1)))
      (local.set $count (i64.mul (local.get $count)
        (i64.extend_i32_u (call $gl32 (i32.add (local.get $arg2) (i32.shl (local.get $i) (i32.const 3)))))))
      (if (i64.gt_u (local.get $count) (i64.const 0x10000000)) (then (return)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $dims)))
    (local.set $block (call $heap_alloc (i32.add (i32.const 20) (i32.shl (local.get $arg1) (i32.const 3)))))
    (if (i32.eqz (local.get $block)) (then (return)))
    (local.set $sa (i32.add (local.get $block) (i32.const 4)))
    (call $gs32 (local.get $block) (i32.and (local.get $arg0) (i32.const 0xFFFF)))
    (call $gs16 (local.get $sa) (local.get $arg1))
    (call $gs16 (i32.add (local.get $sa) (i32.const 2)) (i32.const 0x80)) ;; FADF_HAVEVARTYPE
    (call $gs32 (i32.add (local.get $sa) (i32.const 4)) (local.get $cb))
    (call $gs32 (i32.add (local.get $sa) (i32.const 8)) (i32.const 0))
    ;; OLEAUT32 stores the bounds in reverse order of the caller's array.
    (local.set $i (i32.const 0))
    (block $bd (loop $bl
      (br_if $bd (i32.ge_u (local.get $i) (local.get $arg1)))
      (call $gs32 (i32.add (local.get $sa) (i32.add (i32.const 16) (i32.shl (local.get $i) (i32.const 3))))
        (call $gl32 (i32.add (local.get $arg2)
          (i32.shl (i32.sub (i32.sub (local.get $arg1) (i32.const 1)) (local.get $i)) (i32.const 3)))))
      (call $gs32 (i32.add (local.get $sa) (i32.add (i32.const 20) (i32.shl (local.get $i) (i32.const 3))))
        (call $gl32 (i32.add (local.get $arg2)
          (i32.add (i32.shl (i32.sub (i32.sub (local.get $arg1) (i32.const 1)) (local.get $i)) (i32.const 3))
                   (i32.const 4)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $bl)))
    (local.set $count (i64.mul (local.get $count) (i64.extend_i32_u (local.get $cb))))
    (if (i64.ne (local.get $count) (i64.const 0))
      (then
        (local.set $data (call $heap_alloc (i32.wrap_i64 (local.get $count))))
        (if (i32.eqz (local.get $data))
          (then (call $heap_free (local.get $block)) (return)))
        (call $zero_memory (call $g2w (local.get $data)) (i32.wrap_i64 (local.get $count)))))
    (call $gs32 (i32.add (local.get $sa) (i32.const 12)) (local.get $data))
    (i32.store offset=0 (global.get $reg_base) (local.get $sa)))

  ;; Shared by SafeArrayDestroy and VariantClear. A locked array is not freed.
  (func $safearray_destroy (param $sa i32) (result i32)
    (local $data i32)
    (if (i32.eqz (local.get $sa)) (then (return (i32.const 0))))
    (if (call $gl32 (i32.add (local.get $sa) (i32.const 8)))
      (then (return (i32.const 0x8002000D)))) ;; DISP_E_ARRAYISLOCKED
    (local.set $data (call $gl32 (i32.add (local.get $sa) (i32.const 12))))
    (if (local.get $data) (then (call $heap_free (local.get $data))))
    (call $heap_free (i32.sub (local.get $sa) (i32.const 4)))
    (i32.const 0))

  (func $handle_SafeArrayDestroy (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
    (i32.store offset=0 (global.get $reg_base) (call $safearray_destroy (local.get $arg0))))

  ;; SafeArrayAccessData(psa, ppvData) takes a lock and hands out pvData.
  (func $handle_SafeArrayAccessData (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
    (if (i32.or (i32.eqz (local.get $arg0)) (i32.eqz (local.get $arg1)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) (return))) ;; E_INVALIDARG
    (call $gs32 (i32.add (local.get $arg0) (i32.const 8))
      (i32.add (call $gl32 (i32.add (local.get $arg0) (i32.const 8))) (i32.const 1)))
    (call $gs32 (local.get $arg1) (call $gl32 (i32.add (local.get $arg0) (i32.const 12))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $handle_SafeArrayUnaccessData (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $locks i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
    (if (i32.eqz (local.get $arg0))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) (return)))
    (local.set $locks (call $gl32 (i32.add (local.get $arg0) (i32.const 8))))
    (if (i32.eqz (local.get $locks))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x8000FFFF)) (return))) ;; E_UNEXPECTED
    (call $gs32 (i32.add (local.get $arg0) (i32.const 8)) (i32.sub (local.get $locks) (i32.const 1)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  ;; VarI4FromStr(strIn, lcid, dwFlags, plOut). Surrounding blanks, a sign,
  ;; decimal digits and an optional fraction rounded half-to-even, which is
  ;; how OLEAUT32 coerces a numeric string. Anything else is a type mismatch;
  ;; a value outside LONG is DISP_E_OVERFLOW.
  (func $handle_VarI4FromStr (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $p i32) (local $ch i32) (local $neg i32) (local $v i64) (local $digits i32)
    (local $first i32) (local $sticky i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x80020005)) ;; DISP_E_TYPEMISMATCH
    (if (i32.or (i32.eqz (local.get $arg0)) (i32.eqz (local.get $arg3)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) (return)))
    (local.set $p (local.get $arg0))
    (block $b (loop $l
      (local.set $ch (call $gl16 (local.get $p)))
      (br_if $b (i32.and (i32.ne (local.get $ch) (i32.const 32)) (i32.ne (local.get $ch) (i32.const 9))))
      (local.set $p (i32.add (local.get $p) (i32.const 2)))
      (br $l)))
    (if (i32.or (i32.eq (local.get $ch) (i32.const 45)) (i32.eq (local.get $ch) (i32.const 43)))
      (then
        (local.set $neg (i32.eq (local.get $ch) (i32.const 45)))
        (local.set $p (i32.add (local.get $p) (i32.const 2)))
        (local.set $ch (call $gl16 (local.get $p)))))
    (block $b (loop $l
      (br_if $b (i32.gt_u (i32.sub (local.get $ch) (i32.const 48)) (i32.const 9)))
      (local.set $v (i64.add (i64.mul (local.get $v) (i64.const 10))
        (i64.extend_i32_u (i32.sub (local.get $ch) (i32.const 48)))))
      (if (i64.gt_u (local.get $v) (i64.const 0x80000000))
        (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x8002000A)) (return))) ;; DISP_E_OVERFLOW
      (local.set $digits (i32.add (local.get $digits) (i32.const 1)))
      (local.set $p (i32.add (local.get $p) (i32.const 2)))
      (local.set $ch (call $gl16 (local.get $p)))
      (br $l)))
    (if (i32.eq (local.get $ch) (i32.const 46))
      (then
        (local.set $p (i32.add (local.get $p) (i32.const 2)))
        (local.set $ch (call $gl16 (local.get $p)))
        (local.set $first (i32.const -1))
        (block $b (loop $l
          (br_if $b (i32.gt_u (i32.sub (local.get $ch) (i32.const 48)) (i32.const 9)))
          (if (i32.lt_s (local.get $first) (i32.const 0))
            (then (local.set $first (i32.sub (local.get $ch) (i32.const 48))))
            (else (if (i32.ne (local.get $ch) (i32.const 48)) (then (local.set $sticky (i32.const 1))))))
          (local.set $digits (i32.add (local.get $digits) (i32.const 1)))
          (local.set $p (i32.add (local.get $p) (i32.const 2)))
          (local.set $ch (call $gl16 (local.get $p)))
          (br $l)))
        (if (i32.or (i32.gt_s (local.get $first) (i32.const 5))
              (i32.and (i32.eq (local.get $first) (i32.const 5))
                (i32.or (local.get $sticky) (i32.wrap_i64 (i64.and (local.get $v) (i64.const 1))))))
          (then (local.set $v (i64.add (local.get $v) (i64.const 1)))))))
    (block $b (loop $l
      (br_if $b (i32.and (i32.ne (local.get $ch) (i32.const 32)) (i32.ne (local.get $ch) (i32.const 9))))
      (local.set $p (i32.add (local.get $p) (i32.const 2)))
      (local.set $ch (call $gl16 (local.get $p)))
      (br $l)))
    (if (i32.or (i32.eqz (local.get $digits)) (i32.ne (local.get $ch) (i32.const 0))) (then (return)))
    (if (local.get $neg) (then (local.set $v (i64.sub (i64.const 0) (local.get $v)))))
    (if (i32.or (i64.gt_s (local.get $v) (i64.const 0x7FFFFFFF)) (i64.lt_s (local.get $v) (i64.const -0x80000000)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x8002000A)) (return)))
    (call $gs32 (local.get $arg3) (i32.wrap_i64 (local.get $v)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  ;; Real OLEAUT32 provides these automation helpers. Without that DLL, keep
  ;; unsupported behavior explicit rather than forging registration/results.
  (func $handle_LoadRegTypeLib (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr))
  )

  (func $handle_QueryPathOfRegTypeLib (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr))
  )

  (func $handle_RegisterTypeLib (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr))
  )

  (func $handle_DispGetIDsOfNames (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr))
  )

  ;; 770: CoTaskMemAlloc(cb) — 1 arg stdcall, allocate from heap
  (func $handle_CoTaskMemAlloc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $heap_alloc (local.get $arg0)))
    (if (i32.load offset=0 (global.get $reg_base))
      (then (call $zero_memory (call $g2w (i32.load offset=0 (global.get $reg_base))) (local.get $arg0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; 771: StringFromGUID2(rguid, lpsz, cchMax) — 3 args stdcall
  ;; Formats GUID as "{xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx}" into wide buffer
  (func $handle_StringFromGUID2 (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $src i32) (local $dst i32) (local $i i32)
    (local $d1 i32) (local $d2 i32) (local $d3 i32)
    ;; Need 39 chars: "{xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx}\0"
    (if (i32.lt_u (local.get $arg2) (i32.const 39))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))) (return)))
    ;; Both buffers are the caller's: a 16-byte GUID in and 39 wide chars out.
    ;; Either can sit across a guest page boundary, and two adjacent sparse
    ;; pages need not be adjacent in WASM memory, so neither is safe to walk
    ;; through a single translation.
    (local.set $src (call $guest_span_in (local.get $arg0) (i32.const 16)))
    (local.set $dst (call $guest_span_in (local.get $arg1) (i32.const 78)))
    ;; Read GUID fields: Data1(4) Data2(2) Data3(2) Data4(8)
    (local.set $d1 (i32.load (local.get $src)))
    (local.set $d2 (i32.load16_u (i32.add (local.get $src) (i32.const 4))))
    (local.set $d3 (i32.load16_u (i32.add (local.get $src) (i32.const 6))))
    ;; Write '{' as wide char
    (i32.store16 (local.get $dst) (i32.const 0x7B))
    ;; Format Data1 (8 hex digits)
    (call $guid_hex32 (i32.add (local.get $dst) (i32.const 2)) (local.get $d1) (i32.const 8))
    ;; '-'
    (i32.store16 (i32.add (local.get $dst) (i32.const 18)) (i32.const 0x2D))
    ;; Format Data2 (4 hex digits)
    (call $guid_hex32 (i32.add (local.get $dst) (i32.const 20)) (local.get $d2) (i32.const 4))
    ;; '-'
    (i32.store16 (i32.add (local.get $dst) (i32.const 28)) (i32.const 0x2D))
    ;; Format Data3 (4 hex digits)
    (call $guid_hex32 (i32.add (local.get $dst) (i32.const 30)) (local.get $d3) (i32.const 4))
    ;; '-'
    (i32.store16 (i32.add (local.get $dst) (i32.const 38)) (i32.const 0x2D))
    ;; Format Data4[0..1] (4 hex digits)
    (call $guid_hex8 (i32.add (local.get $dst) (i32.const 40)) (i32.load8_u (i32.add (local.get $src) (i32.const 8))))
    (call $guid_hex8 (i32.add (local.get $dst) (i32.const 44)) (i32.load8_u (i32.add (local.get $src) (i32.const 9))))
    ;; '-'
    (i32.store16 (i32.add (local.get $dst) (i32.const 48)) (i32.const 0x2D))
    ;; Format Data4[2..7] (12 hex digits)
    (local.set $i (i32.const 0))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $i) (i32.const 6)))
      (call $guid_hex8
        (i32.add (local.get $dst) (i32.add (i32.const 50) (i32.mul (local.get $i) (i32.const 4))))
        (i32.load8_u (i32.add (local.get $src) (i32.add (i32.const 10) (local.get $i)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp)))
    ;; '}'
    (i32.store16 (i32.add (local.get $dst) (i32.const 74)) (i32.const 0x7D))
    ;; null terminator
    (i32.store16 (i32.add (local.get $dst) (i32.const 76)) (i32.const 0))
    ;; Release in reverse order of acquisition.
    (call $guest_span_writeback (local.get $arg1) (local.get $dst) (i32.const 78))
    (call $guest_span_release (local.get $src) (i32.const 16))
    (i32.store offset=0 (global.get $reg_base) (i32.const 39))  ;; chars written including NUL
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))  ;; stdcall, 3 args
  )

  ;; Helper: write N hex digits (wide) for a 32-bit value, big-endian order
  (func $guid_hex32 (param $dst i32) (param $val i32) (param $ndigits i32)
    (local $i i32) (local $shift i32) (local $nibble i32)
    (local.set $shift (i32.mul (i32.sub (local.get $ndigits) (i32.const 1)) (i32.const 4)))
    (local.set $i (i32.const 0))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $i) (local.get $ndigits)))
      (local.set $nibble (i32.and (i32.shr_u (local.get $val) (local.get $shift)) (i32.const 0xF)))
      (i32.store16 (i32.add (local.get $dst) (i32.mul (local.get $i) (i32.const 2)))
        (if (result i32) (i32.le_u (local.get $nibble) (i32.const 9))
          (then (i32.add (local.get $nibble) (i32.const 0x30)))
          (else (i32.add (local.get $nibble) (i32.const 0x57)))))  ;; 'a' - 10
      (local.set $shift (i32.sub (local.get $shift) (i32.const 4)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp))))

  ;; Helper: write 2 hex digits (wide) for a byte
  (func $guid_hex8 (param $dst i32) (param $byte i32)
    (call $guid_hex32 (local.get $dst) (local.get $byte) (i32.const 2)))

  ;; 772: CLSIDFromString(lpsz, pclsid) — 2 args stdcall
  ;; A braced GUID is parsed strictly: exactly "{8-4-4-4-12}" and nothing
  ;; after it. Anything else is a ProgID and resolves through HKCR, the way
  ;; ole32 does it. An unregistered name is CO_E_CLASSSTRING, never S_OK —
  ;; VB5 loads every "Begin VB.PropertyPage" through this call and treats a
  ;; success as an external designer to instantiate, so the old anything-parses
  ;; version made every sample with a property page fail to load.
  (func $handle_CLSIDFromString (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $hr i32)
    (if (i32.eqz (local.get $arg1))
      (then (local.set $hr (i32.const 0x80004003)))  ;; E_POINTER
      (else (if (i32.eqz (local.get $arg0))
        (then  ;; NULL string: CLSID_NULL
          (call $gs32 (local.get $arg1) (i32.const 0))
          (call $gs32 (i32.add (local.get $arg1) (i32.const 4)) (i32.const 0))
          (call $gs32 (i32.add (local.get $arg1) (i32.const 8)) (i32.const 0))
          (call $gs32 (i32.add (local.get $arg1) (i32.const 12)) (i32.const 0)))
        (else (local.set $hr (call $clsid_from_string_g (local.get $arg0) (local.get $arg1)))))))
    (i32.store offset=0 (global.get $reg_base) (local.get $hr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))  ;; stdcall, 2 args
  )

  ;; IIDFromString(lpsz, lpiid) — 2 args stdcall. Braced form only, no
  ;; ProgID lookup; NULL is IID_NULL.
  (func $handle_IIDFromString (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $hr i32)
    (if (i32.eqz (local.get $arg0))
      (then
        (call $gs32 (local.get $arg1) (i32.const 0))
        (call $gs32 (i32.add (local.get $arg1) (i32.const 4)) (i32.const 0))
        (call $gs32 (i32.add (local.get $arg1) (i32.const 8)) (i32.const 0))
        (call $gs32 (i32.add (local.get $arg1) (i32.const 12)) (i32.const 0)))
      (else (if (i32.eqz (call $clsid_parse_braced_g (local.get $arg0) (local.get $arg1)))
        (then (local.set $hr (i32.const 0x800401F4))))))  ;; CO_E_IIDSTRING
    (i32.store offset=0 (global.get $reg_base) (local.get $hr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; Wide string at guest $src → CLSID at guest $dst: braced GUID or ProgID.
  (func $clsid_from_string_g (param $src i32) (param $dst i32) (result i32)
    (if (i32.eq (call $gl16 (local.get $src)) (i32.const 0x7B))
      (then (return (select (i32.const 0) (i32.const 0x800401F3)  ;; CO_E_CLASSSTRING
        (call $clsid_parse_braced_g (local.get $src) (local.get $dst))))))
    (call $progid_to_clsid_g (local.get $src) (local.get $dst)))

  ;; One UTF-16 hex digit's value, or -1.
  (func $hex_digit_wide (param $ch i32) (result i32)
    (if (i32.and (i32.ge_u (local.get $ch) (i32.const 0x30)) (i32.le_u (local.get $ch) (i32.const 0x39)))
      (then (return (i32.sub (local.get $ch) (i32.const 0x30)))))
    (local.set $ch (i32.or (local.get $ch) (i32.const 0x20)))
    (if (i32.and (i32.ge_u (local.get $ch) (i32.const 0x61)) (i32.le_u (local.get $ch) (i32.const 0x66)))
      (then (return (i32.sub (local.get $ch) (i32.const 0x57)))))
    (i32.const -1))

  ;; "{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}" + NUL at guest $src. Writes the
  ;; CLSID only when the whole string is well-formed; returns 1/0.
  (func $clsid_parse_braced_g (param $src i32) (param $dst i32) (result i32)
    (local $i i32) (local $ch i32) (local $v i32) (local $n i32)
    (local $d1 i32) (local $d2 i32) (local $d3 i32) (local $cur i32) (local $q i64)
    (if (i32.ne (call $gl16 (local.get $src)) (i32.const 0x7B)) (then (return (i32.const 0))))
    (local.set $i (i32.const 1))
    (block $done (loop $lp
      (br_if $done (i32.gt_u (local.get $i) (i32.const 36)))
      (local.set $ch (call $gl16 (i32.add (local.get $src) (i32.shl (local.get $i) (i32.const 1)))))
      (if (i32.or (i32.or (i32.eq (local.get $i) (i32.const 9)) (i32.eq (local.get $i) (i32.const 14)))
                  (i32.or (i32.eq (local.get $i) (i32.const 19)) (i32.eq (local.get $i) (i32.const 24))))
        (then (if (i32.ne (local.get $ch) (i32.const 0x2D)) (then (return (i32.const 0)))))
        (else
          (local.set $v (call $hex_digit_wide (local.get $ch)))
          (if (i32.lt_s (local.get $v) (i32.const 0)) (then (return (i32.const 0))))
          (if (i32.lt_u (local.get $n) (i32.const 8))
            (then (local.set $d1 (i32.or (i32.shl (local.get $d1) (i32.const 4)) (local.get $v))))
          (else (if (i32.lt_u (local.get $n) (i32.const 12))
            (then (local.set $d2 (i32.or (i32.shl (local.get $d2) (i32.const 4)) (local.get $v))))
          (else (if (i32.lt_u (local.get $n) (i32.const 16))
            (then (local.set $d3 (i32.or (i32.shl (local.get $d3) (i32.const 4)) (local.get $v))))
          (else
            ;; Data4: bytes in text order, stored in memory order.
            (if (i32.and (local.get $n) (i32.const 1))
              (then
                (local.set $q (i64.or (local.get $q)
                  (i64.shl (i64.extend_i32_u (i32.or (local.get $cur) (local.get $v)))
                           (i64.extend_i32_u (i32.shl (i32.shr_u (i32.sub (local.get $n) (i32.const 16)) (i32.const 1))
                                                      (i32.const 3)))))))
              (else (local.set $cur (i32.shl (local.get $v) (i32.const 4)))))))))))
          (local.set $n (i32.add (local.get $n) (i32.const 1)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp)))
    (if (i32.ne (call $gl16 (i32.add (local.get $src) (i32.const 74))) (i32.const 0x7D)) (then (return (i32.const 0))))
    (if (i32.ne (call $gl16 (i32.add (local.get $src) (i32.const 76))) (i32.const 0)) (then (return (i32.const 0))))
    (call $gs32 (local.get $dst) (local.get $d1))
    (call $gs32 (i32.add (local.get $dst) (i32.const 4))
      (i32.or (local.get $d2) (i32.shl (local.get $d3) (i32.const 16))))
    (call $gs32 (i32.add (local.get $dst) (i32.const 8)) (i32.wrap_i64 (local.get $q)))
    (call $gs32 (i32.add (local.get $dst) (i32.const 12))
      (i32.wrap_i64 (i64.shr_u (local.get $q) (i64.const 32))))
    (i32.const 1))

  ;; ProgID (wide, guest) → CLSID through HKCR\<ProgID>\CLSID's default
  ;; value. S_OK or CO_E_CLASSSTRING, as ole32 answers for an unknown name.
  (func $progid_to_clsid_g (param $src i32) (param $dst i32) (result i32)
    (local $len i32) (local $key i32) (local $buf i32) (local $cb i32) (local $i i32) (local $hr i32)
    (local.set $hr (i32.const 0x800401F3))
    (block $n (loop $l
      (br_if $n (i32.eqz (call $gl16 (i32.add (local.get $src) (i32.shl (local.get $len) (i32.const 1))))))
      (local.set $len (i32.add (local.get $len) (i32.const 1)))
      (br_if $n (i32.ge_u (local.get $len) (i32.const 256)))
      (br $l)))
    ;; ProgIDs are at most 39 characters; anything longer is no ProgID.
    (if (i32.or (i32.eqz (local.get $len)) (i32.gt_u (local.get $len) (i32.const 39)))
      (then (return (local.get $hr))))
    (local.set $key (call $heap_alloc (i32.const 112)))   ;; name + "\CLSID" + NUL, wide
    (local.set $buf (call $heap_alloc (i32.const 84)))    ;; 40 wide chars + cb
    (if (i32.or (i32.eqz (local.get $key)) (i32.eqz (local.get $buf)))
      (then (if (local.get $key) (then (call $heap_free (local.get $key))))
            (if (local.get $buf) (then (call $heap_free (local.get $buf))))
            (return (i32.const 0x8007000E))))  ;; E_OUTOFMEMORY
    (block $c (loop $l
      (br_if $c (i32.ge_u (local.get $i) (local.get $len)))
      (call $gs16 (i32.add (local.get $key) (i32.shl (local.get $i) (i32.const 1)))
        (call $gl16 (i32.add (local.get $src) (i32.shl (local.get $i) (i32.const 1)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $l)))
    (call $gs32 (i32.add (local.get $key) (i32.shl (local.get $len) (i32.const 1))) (i32.const 0x0043005C)) ;; "\C"
    (call $gs32 (i32.add (local.get $key) (i32.add (i32.shl (local.get $len) (i32.const 1)) (i32.const 4))) (i32.const 0x0053004C)) ;; "LS"
    (call $gs32 (i32.add (local.get $key) (i32.add (i32.shl (local.get $len) (i32.const 1)) (i32.const 8))) (i32.const 0x00440049)) ;; "ID"
    (call $gs16 (i32.add (local.get $key) (i32.add (i32.shl (local.get $len) (i32.const 1)) (i32.const 12))) (i32.const 0))
    (call $gs32 (i32.add (local.get $buf) (i32.const 80)) (i32.const 80))
    (if (i32.eqz (call $reg_query_value (i32.const 0x80000000) (local.get $key)
                   (local.get $buf) (i32.add (local.get $buf) (i32.const 80)) (i32.const 1)))
      (then (if (call $clsid_parse_braced_g (local.get $buf) (local.get $dst))
        (then (local.set $hr (i32.const 0))))))
    (call $heap_free (local.get $key))
    (call $heap_free (local.get $buf))
    (local.get $hr))

  ;; CLSIDFromProgID(lpszProgID, pclsid) — 2 args stdcall
  ;; Wide ProgID string → CLSID. The DirectAnimation ProgIDs used by the
  ;; Plus!98 MFC screensavers map to private sentinel CLSIDs that
  ;; $handle_CoCreateInstance consumes above; every other name resolves
  ;; through HKCR, so a component an installer registered is found.
  (func $handle_CLSIDFromProgID (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $src i32) (local $dst i32)
    (if (i32.or (i32.eqz (local.get $arg0)) (i32.eqz (local.get $arg1)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004003))  ;; E_POINTER
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (local.set $src (call $g2w (local.get $arg0)))
    (local.set $dst (call $g2w (local.get $arg1)))
    (if (call $wide_ascii_eq (local.get $src) (region.addr $CLASS_NAME_STRINGS 0x80))
      (then
        (i32.store (local.get $dst) (i32.const 0xDA51DA01))
        (i64.store (i32.add (local.get $dst) (i32.const 4)) (i64.const 0))
        (i32.store (i32.add (local.get $dst) (i32.const 12)) (i32.const 0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (if (call $wide_ascii_eq (local.get $src) (region.addr $CLASS_NAME_STRINGS 0xA0))
      (then
        (i32.store (local.get $dst) (i32.const 0xDA57A71C))
        (i64.store (i32.add (local.get $dst) (i32.const 4)) (i64.const 0))
        (i32.store (i32.add (local.get $dst) (i32.const 12)) (i32.const 0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    ;; Every other ProgID is whatever HKCR says it is.
    (i32.store offset=0 (global.get $reg_base)
      (call $progid_to_clsid_g (local.get $arg0) (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))  ;; ret + 2 args
  )

  ;; 773: GetTempPathA(nBufferLength, lpBuffer) — 2 args stdcall
  (func $handle_GetTempPathA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_fs_get_temp_path
      (local.get $arg0) (local.get $arg1) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 774: CopyFileA(lpExistingFileName, lpNewFileName, bFailIfExists) — 3 args
  (func $handle_CopyFileA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_fs_copy_file
      (call $g2w (local.get $arg0)) (call $g2w (local.get $arg1)) (local.get $arg2) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 775: MoveFileExA(lpExistingFileName, lpNewFileName, dwFlags) — 3 args
  (func $handle_MoveFileExA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg1)
      (then (i32.store offset=0 (global.get $reg_base) (call $host_fs_move_file
        (call $g2w (local.get $arg0)) (call $g2w (local.get $arg1)) (i32.const 0))))
      (else
        ;; lpNewFileName==NULL means delete on reboot — just delete now
        (i32.store offset=0 (global.get $reg_base) (call $host_fs_delete_file (call $g2w (local.get $arg0)) (i32.const 0)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 776: GetTempFileNameA(lpPathName, lpPrefixString, uUnique, lpTempFileName) — 4 args
  (func $handle_GetTempFileNameA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_fs_get_temp_file_name
      (call $g2w (local.get $arg0)) (call $g2w (local.get $arg1)) (local.get $arg2) (local.get $arg3) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; 777: CreateFileMappingA(hFile, lpAttr, flProtect, dwMaxHi, dwMaxLo, lpName) — 6 args
  (func $handle_CreateFileMappingA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $section i32)
    ;; lpName is the sixth argument, past the five in registers.
    (local.set $section (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (global.set $last_error (call $host_fs_create_file_mapping_result
      (local.get $arg0) (local.get $arg2) (local.get $arg3) (local.get $arg4)
      (if (result i32) (local.get $section)
        (then (call $g2w (local.get $section))) (else (i32.const 0)))
      (global.get $reg_base)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))  ;; 6 args
  )

  ;; OpenFileMappingA/W(dwDesiredAccess, bInheritHandle, lpName) — 3 args.
  ;; Returns 0 when nothing created that section, which is the honest answer
  ;; for a name another process would have published: Kodak Imaging opens
  ;; "EastManSoftwarePrvFile" purely to find out whether its Preview
  ;; counterpart is already live, and copes fine with being told it is not.
  (func $handle_open_file_mapping (param $access i32) (param $inherit i32) (param $name i32) (param $wide i32)
    (local $error i32)
    (local.set $error (call $host_fs_open_file_mapping_result
      (if (result i32) (local.get $name)
        (then (call $g2w (local.get $name))) (else (i32.const 0)))
      (local.get $access) (local.get $inherit) (local.get $wide) (global.get $reg_base)))
    (if (local.get $error) (then (global.set $last_error (local.get $error))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  (func $handle_OpenFileMappingA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_open_file_mapping (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 0)))

  ;; Decode UTF-16 directly; no lossy narrowing allocation or atom scratch.
  (func $handle_OpenFileMappingW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_open_file_mapping (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 1)))

  ;; 778: MapViewOfFile(hMapping, dwAccess, dwOffsetHi, dwOffsetLo, dwSize) — 5 args
  (func $handle_MapViewOfFile (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_map_view_complete (call $host_fs_map_view_of_file_result
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4)
      (global.get $reg_base) (global.get $current_thread_id))
      (i32.const 24))
  )

  ;; MapViewOfFileEx has the same mapping semantics plus a sixth preferred
  ;; base-address argument. NULL explicitly lets Windows choose the address,
  ;; which is the path used by stock Win98 OLE32. A fixed placement cannot be
  ;; represented by the current mapping allocator, so fail it honestly rather
  ;; than returning a view at a different address.
  (func $handle_MapViewOfFileEx (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $base i32)
    (local.set $base (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (call $handle_map_view_complete
      (if (result i32) (local.get $base)
        (then (i32.const 50)) ;; fixed placement is not supported yet
        (else (call $host_fs_map_view_of_file_result
          (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4)
          (global.get $reg_base) (global.get $current_thread_id))))
      (i32.const 28))
  )

  ;; 779: UnmapViewOfFile(lpBaseAddress) — 1 arg
  (func $handle_UnmapViewOfFile (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_fs_unmap_view (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))  ;; 1 arg
  )

  ;; FlushViewOfFile(lpBaseAddress, dwNumberOfBytesToFlush) — 2 args. Writes
  ;; the view's bytes back to whatever backs the section while the view stays
  ;; mapped. Kodak Imaging calls it right after MapViewOfFile on its thumbnail
  ;; cache and dies on the spot if the call is missing.
  (func $handle_FlushViewOfFile (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_fs_flush_view (local.get $arg0) (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))  ;; 2 args
  )

  ;; 782: MoveFileExW(lpExistingFileName, lpNewFileName, dwFlags) — 3 args
  (func $handle_MoveFileExW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg1)
      (then (i32.store offset=0 (global.get $reg_base) (call $host_fs_move_file
        (call $g2w (local.get $arg0)) (call $g2w (local.get $arg1)) (i32.const 1))))
      (else (i32.store offset=0 (global.get $reg_base) (call $host_fs_delete_file (call $g2w (local.get $arg0)) (i32.const 1)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 784: ThunkConnect32 — Win9x 16/32-bit thunking, no-op in pure 32-bit
  (func $handle_ThunkConnect32 (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
  )

  ;; IsTextUnicode(lpv, iSize, lpiResult) — SetupAPI sniffs every INF with it.
  ;; Implements the byte-order-mark tests and the ASCII16/statistics tests
  ;; (every 16-bit unit has a zero high byte and a nonzero low byte). lpiResult,
  ;; when given, is the mask of tests to run on entry and the passing subset on
  ;; return; the call succeeds when a Unicode-positive test passed.
  (func $handle_IsTextUnicode (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $flags i32) (local $mask i32) (local $units i32) (local $i i32)
    (local $lo i32) (local $hi i32) (local $plain i32)
    (local.set $mask (i32.const -1))
    (if (local.get $arg2) (then (local.set $mask (call $gl32 (local.get $arg2)))))
    (local.set $units (i32.shr_s (local.get $arg1) (i32.const 1)))
    (if (i32.and (i32.gt_s (local.get $units) (i32.const 0)) (i32.ne (local.get $arg0) (i32.const 0)))
      (then
        (if (i32.eq (call $gl16 (local.get $arg0)) (i32.const 0xFEFF))
          (then (local.set $flags (i32.or (local.get $flags) (i32.const 0x8)))))    ;; SIGNATURE
        (if (i32.eq (call $gl16 (local.get $arg0)) (i32.const 0xFFFE))
          (then (local.set $flags (i32.or (local.get $flags) (i32.const 0x80)))))   ;; REVERSE_SIGNATURE
        (local.set $plain (i32.const 1))
        (block $done (loop $scan
          (br_if $done (i32.ge_s (local.get $i) (local.get $units)))
          (local.set $lo (call $gl8 (i32.add (local.get $arg0) (i32.shl (local.get $i) (i32.const 1)))))
          (local.set $hi (call $gl8 (i32.add (local.get $arg0) (i32.add (i32.shl (local.get $i) (i32.const 1)) (i32.const 1)))))
          (if (i32.or (i32.ne (local.get $hi) (i32.const 0)) (i32.eqz (local.get $lo)))
            (then (local.set $plain (i32.const 0)) (br $done)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $scan)))
        (if (local.get $plain)
          (then (local.set $flags (i32.or (local.get $flags) (i32.const 0x3)))))))  ;; ASCII16 | STATISTICS
    (local.set $flags (i32.and (local.get $flags) (local.get $mask)))
    (if (local.get $arg2) (then (call $gs32 (local.get $arg2) (local.get $flags))))
    (i32.store offset=0 (global.get $reg_base)
      (i32.ne (i32.and (local.get $flags) (i32.const 0xB)) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 1503: VkKeyScanW(WCHAR ch) → SHORT — low byte = vkey, high byte = shift state.
  ;; ASCII letters/digits map cleanly; uppercase letters set the SHIFT bit (0x100).
  ;; Anything else returns -1 (0xFFFF), the documented "no translation" sentinel.
  (func $handle_VkKeyScanW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $vk_key_scan (i32.and (local.get $arg0) (i32.const 0xFFFF))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))  ;; stdcall, 1 arg

  ;; VK->scancode lookup table for letters A..Z (vk 0x41..0x5A → table[vk-0x41]).
  ;; Real PS/2 set-1 scancodes; the previous (uCode-0x20) approximation produced
  ;; bogus values (e.g. Z=0x3A) that GetKeyNameTextA couldn't decode, so the
  ;; Pinball Player Controls dialog rendered "?" for the default flipper keys.
  ;; VK_SCAN_TABLES — the two MapVirtualKey lookup tables, +0x00 vkey->scan
  ;; for 'A'..'Z' and +0x20 scan->vkey for scan 0x00..0x58. Byte arrays, not
  ;; strings, which is why they are their own region rather than a tail on
  ;; STRING_CONSTANTS.
  (global $VK_SCAN_TABLES i32 (region.addr $VK_SCAN_TABLES 0))
  (global $VK_SCAN_TABLES_SIZE i32 (region.size $VK_SCAN_TABLES))
  (data (region.addr $VK_SCAN_TABLES 0x00)
    "\1e\30\2e\20\12\21\22\23\17\24\25\26\32\31\18\19\10\13\1f\14\16\2f\11\2d\15\2c")

  ;; Reverse table: PS/2 set-1 scancode → VK (uMapType=1). Indexed by scancode
  ;; 0x00..0x58 (89 bytes). Pinball's Player Controls dialog walks scan 0..0xFF
  ;; calling MapVirtualKey(scan,1) to populate its key-binding combobox; without
  ;; this table every entry collapses to vk=0. Numpad scancodes (0x47..0x53)
  ;; map to VK_NUMPAD*/_DECIMAL/_ADD/_SUBTRACT/_MULTIPLY/_DIVIDE — the arrow
  ;; vkeys come from extended (0xE0-prefixed) scancodes, not the base table.
  (data (region.addr $VK_SCAN_TABLES 0x20)
    "\00\1b\31\32\33\34\35\36\37\38"   ;; 0x00..0x09
    "\39\30\bd\bb\08\09\51\57\45\52"   ;; 0x0a..0x13
    "\54\59\55\49\4f\50\db\dd\0d\11"   ;; 0x14..0x1d
    "\41\53\44\46\47\48\4a\4b\4c\ba"   ;; 0x1e..0x27
    "\de\c0\10\dc\5a\58\43\56\42\4e"   ;; 0x28..0x31
    "\4d\bc\be\bf\10\6a\12\20\14\70"   ;; 0x32..0x3b
    "\71\72\73\74\75\76\77\78\79\90"   ;; 0x3c..0x45
    "\91\67\26\69\6d\25\65\27\6b\61"   ;; 0x46..0x4f (4B/4D/48 favor arrow VKs)
    "\28\63\60\6e\00\00\00\7a\7b")     ;; 0x50..0x58 (50 favors VK_DOWN over NP2)

  ;; 785: MapVirtualKeyA — translate between vkeys, scan codes, and characters
  (func $handle_MapVirtualKeyA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $uCode i32)
    (local $uMapType i32)
    (local $result i32)
    ;; arg0=uCode, arg1=uMapType (stdcall, 2 args)
    (local.set $uCode (local.get $arg0))
    (local.set $uMapType (local.get $arg1))
    (local.set $result (i32.const 0))
    (block $done
      ;; Type 0: vkey -> scan code
      (if (i32.eqz (local.get $uMapType))
        (then
          (block $vk0_done
            ;; Letters A-Z: vkeys 0x41-0x5A -> real PS/2 set-1 scancodes via table
            (if (i32.and (i32.ge_u (local.get $uCode) (i32.const 0x41)) (i32.le_u (local.get $uCode) (i32.const 0x5A)))
              (then
                (local.set $result (i32.load8_u (i32.add (region.addr $VK_SCAN_TABLES 0x00) (i32.sub (local.get $uCode) (i32.const 0x41)))))
                (br $vk0_done)
              )
            )
            ;; OEM punctuation
            (if (i32.eq (local.get $uCode) (i32.const 0xBA)) (then (local.set $result (i32.const 0x27)) (br $vk0_done))) ;; ;:
            (if (i32.eq (local.get $uCode) (i32.const 0xBB)) (then (local.set $result (i32.const 0x0D)) (br $vk0_done))) ;; =+
            (if (i32.eq (local.get $uCode) (i32.const 0xBC)) (then (local.set $result (i32.const 0x33)) (br $vk0_done))) ;; ,<
            (if (i32.eq (local.get $uCode) (i32.const 0xBD)) (then (local.set $result (i32.const 0x0C)) (br $vk0_done))) ;; -_
            (if (i32.eq (local.get $uCode) (i32.const 0xBE)) (then (local.set $result (i32.const 0x34)) (br $vk0_done))) ;; .>
            (if (i32.eq (local.get $uCode) (i32.const 0xBF)) (then (local.set $result (i32.const 0x35)) (br $vk0_done))) ;; /?
            (if (i32.eq (local.get $uCode) (i32.const 0xC0)) (then (local.set $result (i32.const 0x29)) (br $vk0_done))) ;; `~
            (if (i32.eq (local.get $uCode) (i32.const 0xDB)) (then (local.set $result (i32.const 0x1A)) (br $vk0_done))) ;; [{
            (if (i32.eq (local.get $uCode) (i32.const 0xDC)) (then (local.set $result (i32.const 0x2B)) (br $vk0_done))) ;; \|
            (if (i32.eq (local.get $uCode) (i32.const 0xDD)) (then (local.set $result (i32.const 0x1B)) (br $vk0_done))) ;; ]}
            (if (i32.eq (local.get $uCode) (i32.const 0xDE)) (then (local.set $result (i32.const 0x28)) (br $vk0_done))) ;; '"
            ;; Numbers 0-9: vkeys 0x30-0x39 -> scancodes 0x0B,0x02-0x0A
            (if (i32.and (i32.ge_u (local.get $uCode) (i32.const 0x30)) (i32.le_u (local.get $uCode) (i32.const 0x39)))
              (then
                (if (i32.eq (local.get $uCode) (i32.const 0x30))
                  (then (local.set $result (i32.const 0x0B)))
                  (else (local.set $result (i32.sub (local.get $uCode) (i32.const 0x2E))))
                )
                (br $vk0_done)
              )
            )
            ;; Space=0x39, Enter=0x1C, Escape=0x01, Tab=0x0F
            (if (i32.eq (local.get $uCode) (i32.const 0x20)) (then (local.set $result (i32.const 0x39)) (br $vk0_done)))
            (if (i32.eq (local.get $uCode) (i32.const 0x0D)) (then (local.set $result (i32.const 0x1C)) (br $vk0_done)))
            (if (i32.eq (local.get $uCode) (i32.const 0x1B)) (then (local.set $result (i32.const 0x01)) (br $vk0_done)))
            (if (i32.eq (local.get $uCode) (i32.const 0x09)) (then (local.set $result (i32.const 0x0F)) (br $vk0_done)))
            ;; Shift=0x2A, Ctrl=0x1D, Alt=0x38
            (if (i32.eq (local.get $uCode) (i32.const 0x10)) (then (local.set $result (i32.const 0x2A)) (br $vk0_done)))
            (if (i32.eq (local.get $uCode) (i32.const 0x11)) (then (local.set $result (i32.const 0x1D)) (br $vk0_done)))
            (if (i32.eq (local.get $uCode) (i32.const 0x12)) (then (local.set $result (i32.const 0x38)) (br $vk0_done)))
            ;; Arrow keys: Left=0x4B, Up=0x48, Right=0x4D, Down=0x50
            (if (i32.eq (local.get $uCode) (i32.const 0x25)) (then (local.set $result (i32.const 0x4B)) (br $vk0_done)))
            (if (i32.eq (local.get $uCode) (i32.const 0x26)) (then (local.set $result (i32.const 0x48)) (br $vk0_done)))
            (if (i32.eq (local.get $uCode) (i32.const 0x27)) (then (local.set $result (i32.const 0x4D)) (br $vk0_done)))
            (if (i32.eq (local.get $uCode) (i32.const 0x28)) (then (local.set $result (i32.const 0x50)) (br $vk0_done)))
            ;; F1-F12: vkeys 0x70-0x7B -> scancodes 0x3B-0x46,0x57,0x58
            (if (i32.and (i32.ge_u (local.get $uCode) (i32.const 0x70)) (i32.le_u (local.get $uCode) (i32.const 0x7B)))
              (then
                (if (i32.le_u (local.get $uCode) (i32.const 0x79))
                  (then (local.set $result (i32.add (i32.const 0x3B) (i32.sub (local.get $uCode) (i32.const 0x70)))))
                  (else (local.set $result (i32.add (i32.const 0x57) (i32.sub (local.get $uCode) (i32.const 0x7A)))))
                )
                (br $vk0_done)
              )
            )
          )
          (br $done)
        )
      )
      ;; Type 1: scan code -> vkey (reverse table at VK_SCAN_TABLES+0x20, scan 0x00..0x58).
      ;; Pinball walks scan 0..0xFF at dialog init and pairs each with
      ;; GetKeyNameTextA to build the Player Controls combobox.
      (if (i32.eq (local.get $uMapType) (i32.const 1))
        (then
          (if (i32.le_u (local.get $uCode) (i32.const 0x58))
            (then (local.set $result (i32.load8_u (i32.add (region.addr $VK_SCAN_TABLES 0x20) (local.get $uCode))))))
          (br $done)
        )
      )
      ;; Type 2: vkey -> unshifted char.
      ;; Pinball's combobox-populator at 0x1005c2d walks vk 0x80..0xFF asking
      ;; MapVirtualKey(vk,2) to find the OEM vkey that produces a target glyph
      ;; (e.g. '/' for the right flipper). Without OEM coverage here every
      ;; punctuation slot in the dialog would silently skip.
      (if (i32.eq (local.get $uMapType) (i32.const 2))
        (then
          ;; Letters: return uppercase ASCII (real Windows returns uppercase
          ;; for type 2; Pinball's compare uses the low byte either way).
          (if (i32.and (i32.ge_u (local.get $uCode) (i32.const 0x41)) (i32.le_u (local.get $uCode) (i32.const 0x5A)))
            (then (local.set $result (local.get $uCode)))
          )
          ;; Numbers: return ASCII digit
          (if (i32.and (i32.ge_u (local.get $uCode) (i32.const 0x30)) (i32.le_u (local.get $uCode) (i32.const 0x39)))
            (then (local.set $result (local.get $uCode)))
          )
          (if (i32.eq (local.get $uCode) (i32.const 0x20)) (then (local.set $result (i32.const 0x20))))
          ;; OEM punctuation (US layout, unshifted glyph)
          (if (i32.eq (local.get $uCode) (i32.const 0xBA)) (then (local.set $result (i32.const 0x3B)))) ;; ;
          (if (i32.eq (local.get $uCode) (i32.const 0xBB)) (then (local.set $result (i32.const 0x3D)))) ;; =
          (if (i32.eq (local.get $uCode) (i32.const 0xBC)) (then (local.set $result (i32.const 0x2C)))) ;; ,
          (if (i32.eq (local.get $uCode) (i32.const 0xBD)) (then (local.set $result (i32.const 0x2D)))) ;; -
          (if (i32.eq (local.get $uCode) (i32.const 0xBE)) (then (local.set $result (i32.const 0x2E)))) ;; .
          (if (i32.eq (local.get $uCode) (i32.const 0xBF)) (then (local.set $result (i32.const 0x2F)))) ;; /
          (if (i32.eq (local.get $uCode) (i32.const 0xC0)) (then (local.set $result (i32.const 0x60)))) ;; `
          (if (i32.eq (local.get $uCode) (i32.const 0xDB)) (then (local.set $result (i32.const 0x5B)))) ;; [
          (if (i32.eq (local.get $uCode) (i32.const 0xDC)) (then (local.set $result (i32.const 0x5C)))) ;; \
          (if (i32.eq (local.get $uCode) (i32.const 0xDD)) (then (local.set $result (i32.const 0x5D)))) ;; ]
          (if (i32.eq (local.get $uCode) (i32.const 0xDE)) (then (local.set $result (i32.const 0x27)))) ;; '
          (br $done)
        )
      )
      ;; Type 3: scan code -> vkey (with left/right) — return 0
    )
    (i32.store offset=0 (global.get $reg_base) (local.get $result))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; MapVirtualKeyW(uCode, uMapType) → UINT — same semantics as MapVirtualKeyA
  ;; for the codepoints we care about, since both ASCII letters/digits and the
  ;; vkey/scancode tables fit in the BMP. Delegate to keep one implementation.
  (func $handle_MapVirtualKeyW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_MapVirtualKeyA (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; MapVirtualKeyExA(uCode, uMapType, dwhkl) → UINT — ignore the locale handle
  ;; and delegate. MapVirtualKeyA pops 12 bytes (ret+2 args); we need 16 (ret+3),
  ;; so add the extra 4 after.
  (func $handle_MapVirtualKeyExA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_MapVirtualKeyA (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  ;; 786: DisableThreadLibraryCalls(hModule) — suppress this loaded DLL's
  ;; DLL_THREAD_ATTACH/DETACH notifications. Static-TLS and invalid modules
  ;; fail with ERROR_INVALID_PARAMETER rather than reporting fake success.
  (func $handle_DisableThreadLibraryCalls (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $dll_disable_thread_notifications (local.get $arg0)))
    (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
      (then (global.set $last_error (i32.const 87)))) ;; ERROR_INVALID_PARAMETER
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 787: ReinitializeCriticalSection(ptr) — no-op. Deliberately still a no-op
  ;; now that sections really exclude: resetting the lock word here would release
  ;; a section its owner is inside, and nothing has been seen to need it.
  (func $handle_ReinitializeCriticalSection (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; ============================================================
  ;; ATOM TABLES (AddAtom* / GlobalAddAtom* / FindAtom* / DeleteAtom / *GetAtomName*)
  ;; ============================================================
  ;; Atoms are a string-interning service: adding the same name twice must
  ;; return the *same* atom with a bumped reference count, and FindAtom must
  ;; return it. Apps use that identity, not just the number — Delphi's VCL
  ;; (Tetravex, Runenlegen) registers a per-window-class atom at startup and
  ;; calls GlobalFindAtomA on every window activation to recover it.

  ;; An integer atom is a MAKEINTATOM value: the "string" pointer is really a
  ;; 16-bit number, i.e. HIWORD(lpString) == 0. It is its own atom and never
  ;; consumes a table slot.
  (func $atom_is_int (param $s i32) (result i32)
    (i32.eqz (i32.shr_u (local.get $s) (i32.const 16))))

  ;; Slot index of $name in $table, or -1. Atom names are case-insensitive.
  (func $atom_slot_of_name (param $table i32) (param $name i32) (result i32)
    (local $i i32) (local $e i32)
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $ATOM_TABLE_SLOTS)))
      (local.set $e (i32.add (local.get $table) (i32.mul (local.get $i) (i32.const 8))))
      (if (i32.and (i32.ne (i32.load (local.get $e)) (i32.const 0))
                   (i32.eqz (call $guest_stricmp (i32.load (local.get $e)) (local.get $name))))
        (then (return (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const -1))

  ;; Add $name to $table. Returns the atom, or 0 when the table is full.
  (func $atom_add (param $table i32) (param $name i32) (result i32)
    (local $i i32) (local $e i32) (local $copy i32)
    (if (call $atom_is_int (local.get $name))
      (then (return (local.get $name))))
    (if (i32.eqz (local.get $name)) (then (return (i32.const 0))))
    (local.set $i (call $atom_slot_of_name (local.get $table) (local.get $name)))
    (if (i32.ge_s (local.get $i) (i32.const 0))
      (then
        (local.set $e (i32.add (local.get $table) (i32.mul (local.get $i) (i32.const 8))))
        (i32.store offset=4 (local.get $e) (i32.add (i32.load offset=4 (local.get $e)) (i32.const 1)))
        (return (i32.add (global.get $ATOM_FIRST) (local.get $i)))))
    ;; Not present — claim the first free slot and take a private copy of the
    ;; name, since the caller's buffer is free to change after the call.
    (local.set $i (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $ATOM_TABLE_SLOTS)))
      (local.set $e (i32.add (local.get $table) (i32.mul (local.get $i) (i32.const 8))))
      (if (i32.eqz (i32.load (local.get $e)))
        (then
          (local.set $copy (call $guest_strdup (local.get $name)))
          (if (i32.eqz (local.get $copy)) (then (return (i32.const 0))))
          (i32.store (local.get $e) (local.get $copy))
          (i32.store offset=4 (local.get $e) (i32.const 1))
          (return (i32.add (global.get $ATOM_FIRST) (local.get $i)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  ;; Look up $name in $table without adding it. Returns the atom, or 0.
  (func $atom_find (param $table i32) (param $name i32) (result i32)
    (local $i i32)
    (if (call $atom_is_int (local.get $name))
      (then (return (local.get $name))))
    (if (i32.eqz (local.get $name)) (then (return (i32.const 0))))
    (local.set $i (call $atom_slot_of_name (local.get $table) (local.get $name)))
    (if (i32.lt_s (local.get $i) (i32.const 0)) (then (return (i32.const 0))))
    (i32.add (global.get $ATOM_FIRST) (local.get $i)))

  ;; Entry address for a live string atom, or 0 when $atom is an integer atom,
  ;; out of range, or names a free slot.
  (func $atom_entry (param $table i32) (param $atom i32) (result i32)
    (local $i i32) (local $e i32)
    (if (i32.lt_u (local.get $atom) (global.get $ATOM_FIRST)) (then (return (i32.const 0))))
    (local.set $i (i32.sub (local.get $atom) (global.get $ATOM_FIRST)))
    (if (i32.ge_u (local.get $i) (global.get $ATOM_TABLE_SLOTS)) (then (return (i32.const 0))))
    (local.set $e (i32.add (local.get $table) (i32.mul (local.get $i) (i32.const 8))))
    (if (i32.eqz (i32.load (local.get $e))) (then (return (i32.const 0))))
    (local.get $e))

  ;; Drop one reference; free the slot when the last one goes. Returns 0 on
  ;; success (both Win32 delete entry points report success as zero).
  ;; Note: $atom_is_int must NOT be used here. It classifies a *name* argument
  ;; (HIWORD == 0 means MAKEINTATOM), and every string atom value is itself
  ;; below 0x10000, so applying it to an atom makes every delete a no-op.
  ;; $atom_entry's "below 0xC000" test is the correct integer-atom guard.
  (func $atom_delete (param $table i32) (param $atom i32) (result i32)
    (local $e i32)
    (local.set $e (call $atom_entry (local.get $table) (local.get $atom)))
    (if (i32.eqz (local.get $e)) (then (return (i32.const 0))))
    (i32.store offset=4 (local.get $e) (i32.sub (i32.load offset=4 (local.get $e)) (i32.const 1)))
    (if (i32.le_s (i32.load offset=4 (local.get $e)) (i32.const 0))
      (then
        (call $heap_free (i32.load (local.get $e)))
        (i32.store (local.get $e) (i32.const 0))
        (i32.store offset=4 (local.get $e) (i32.const 0))))
    (i32.const 0))

  ;; Copy the name of $atom into the guest buffer $buf, which holds $size
  ;; characters including the terminator. Returns characters copied (0 = no
  ;; such atom), matching GlobalGetAtomName. The table stores ANSI names, so
  ;; the only thing $wide changes is the stride of the write.
  (func $atom_get_name (param $table i32) (param $atom i32) (param $buf i32)
                       (param $size i32) (param $wide i32) (result i32)
    (local $e i32) (local $src i32) (local $n i32) (local $i i32) (local $step i32)
    (if (i32.or (i32.eqz (local.get $buf)) (i32.le_s (local.get $size) (i32.const 0)))
      (then (return (i32.const 0))))
    (local.set $e (call $atom_entry (local.get $table) (local.get $atom)))
    (if (i32.eqz (local.get $e)) (then (return (i32.const 0))))
    (local.set $src (i32.load (local.get $e)))
    (local.set $n (call $guest_strlen (local.get $src)))
    (if (i32.gt_u (local.get $n) (i32.sub (local.get $size) (i32.const 1)))
      (then (local.set $n (i32.sub (local.get $size) (i32.const 1)))))
    (local.set $step (select (i32.const 2) (i32.const 1) (local.get $wide)))
    (block $done (loop $copy
      (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
      (call $store_char (i32.add (local.get $buf) (i32.mul (local.get $i) (local.get $step)))
                        (call $gl8 (i32.add (local.get $src) (local.get $i)))
                        (local.get $wide))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $copy)))
    (call $store_char (i32.add (local.get $buf) (i32.mul (local.get $n) (local.get $step)))
                      (i32.const 0) (local.get $wide))
    (local.get $n))

  ;; Narrow a UTF-16 atom name into a temporary guest ANSI buffer so the W
  ;; entry points share one table with the A ones — an atom added as W must be
  ;; findable as A. Caller frees. Integer atoms pass through untouched.
  (func $atom_narrow_w (param $ws i32) (result i32)
    (local $len i32) (local $buf i32) (local $i i32) (local $ch i32)
    (if (call $atom_is_int (local.get $ws)) (then (return (local.get $ws))))
    (if (i32.eqz (local.get $ws)) (then (return (i32.const 0))))
    (block $d (loop $l
      (br_if $d (i32.eqz (call $gl16 (i32.add (local.get $ws) (i32.mul (local.get $len) (i32.const 2))))))
      (local.set $len (i32.add (local.get $len) (i32.const 1)))
      (br_if $d (i32.ge_u (local.get $len) (i32.const 512)))
      (br $l)))
    (local.set $buf (call $heap_alloc (i32.add (local.get $len) (i32.const 1))))
    (if (i32.eqz (local.get $buf)) (then (return (i32.const 0))))
    (block $d2 (loop $l2
      (br_if $d2 (i32.ge_u (local.get $i) (local.get $len)))
      (local.set $ch (call $gl16 (i32.add (local.get $ws) (i32.mul (local.get $i) (i32.const 2)))))
      (call $gs8 (i32.add (local.get $buf) (local.get $i))
        (select (i32.const 0x3F) (local.get $ch) (i32.gt_u (local.get $ch) (i32.const 0xFF))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $l2)))
    (call $gs8 (i32.add (local.get $buf) (local.get $len)) (i32.const 0))
    (local.get $buf))

  ;; Release a buffer handed back by $atom_narrow_w. Integer atoms were passed
  ;; through rather than allocated, so they must not be freed.
  (func $atom_narrow_free (param $ws i32) (param $buf i32)
    (if (i32.and (i32.ne (local.get $buf) (i32.const 0))
                 (i32.eqz (call $atom_is_int (local.get $ws))))
      (then (call $heap_free (local.get $buf)))))

  ;; 788: GlobalAddAtomA(lpString)
  (func $handle_GlobalAddAtomA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $atom_add (global.get $ATOM_GLOBAL_TABLE) (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; GlobalFindAtomA(lpString) — 0 when the name was never added.
  (func $handle_GlobalFindAtomA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $atom_find (global.get $ATOM_GLOBAL_TABLE) (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; GlobalGetAtomNameA(nAtom, lpBuffer, nSize)
  (func $handle_GlobalGetAtomNameA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $atom_get_name (global.get $ATOM_GLOBAL_TABLE)
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; AddAtomA(lpString) — process-local namespace, separate from the global one.
  (func $handle_AddAtomA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $atom_add (global.get $ATOM_LOCAL_TABLE) (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; AddAtomW(lpString)
  (func $handle_AddAtomW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $narrow i32)
    (local.set $narrow (call $atom_narrow_w (local.get $arg0)))
    (i32.store offset=0 (global.get $reg_base) (call $atom_add (global.get $ATOM_LOCAL_TABLE) (local.get $narrow)))
    (call $atom_narrow_free (local.get $arg0) (local.get $narrow))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; GetAtomNameA(nAtom, lpBuffer, nSize)
  (func $handle_GetAtomNameA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $atom_get_name (global.get $ATOM_LOCAL_TABLE)
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; GetAtomNameW(nAtom, lpBuffer, nSize)
  (func $handle_GetAtomNameW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $atom_get_name (global.get $ATOM_LOCAL_TABLE)
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; DeleteAtom(nAtom) — release one process-local reference.
  (func $handle_DeleteAtom (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $atom_delete (global.get $ATOM_LOCAL_TABLE) (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 790: GetKeyNameTextA(lParam, lpString, cchSize) — write key name from scan code
  ;; The emulated keyboard currently uses the ANSI handler's US names. Convert
  ;; those through private scratch because that legacy formatter writes whole
  ;; names; no unbounded write is allowed into the caller's UTF-16 buffer.
  (func $handle_GetKeyNameTextW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $scratch i32) (local $length i32) (local $i i32)
    (if (i32.or (i32.eqz (local.get $arg1)) (i32.le_s (local.get $arg2) (i32.const 0)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))) (return)))
    (local.set $scratch (call $heap_alloc (i32.const 64)))
    (if (i32.eqz (local.get $scratch))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))) (return)))
    (call $handle_GetKeyNameTextA (local.get $arg0) (local.get $scratch) (i32.const 64)
      (i32.const 0) (i32.const 0) (local.get $name_ptr))
    (local.set $length (i32.load offset=0 (global.get $reg_base)))
    (if (i32.ge_u (local.get $length) (local.get $arg2))
      (then (local.set $length (i32.sub (local.get $arg2) (i32.const 1)))))
    (block $done (loop $copy
      (br_if $done (i32.ge_u (local.get $i) (local.get $length)))
      (call $gs16 (i32.add (local.get $arg1) (i32.mul (local.get $i) (i32.const 2)))
        (call $gl8 (i32.add (local.get $scratch) (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $copy)))
    (call $gs16 (i32.add (local.get $arg1) (i32.mul (local.get $length) (i32.const 2))) (i32.const 0))
    (call $heap_free (local.get $scratch))
    (i32.store offset=0 (global.get $reg_base) (local.get $length)))

  (func $handle_GetKeyNameTextA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; arg0=lParam (scan code in bits 16-23), arg1=lpString, arg2=cchSize
    (local $scan i32) (local $buf i32) (local $len i32) (local $ch i32)
    (local.set $scan (i32.and (i32.shr_u (local.get $arg0) (i32.const 16)) (i32.const 0xFF)))
    (local.set $buf (call $g2w (local.get $arg1)))
    (local.set $len (i32.const 0))
    (block $done
      ;; Esc (0x01)
      (if (i32.eq (local.get $scan) (i32.const 0x01)) (then
        (i32.store (local.get $buf) (i32.const 0x00637345)) ;; "Esc\0"
        (local.set $len (i32.const 3)) (br $done)))
      ;; Backspace (0x0E)
      (if (i32.eq (local.get $scan) (i32.const 0x0E)) (then
        (i32.store (local.get $buf) (i32.const 0x6B636142)) ;; "Back"
        (i32.store (i32.add (local.get $buf) (i32.const 4)) (i32.const 0x63617073)) ;; "spac"
        (i32.store16 (i32.add (local.get $buf) (i32.const 8)) (i32.const 0x0065)) ;; "e\0"
        (local.set $len (i32.const 9)) (br $done)))
      ;; Caps Lock (0x3A)
      (if (i32.eq (local.get $scan) (i32.const 0x3A)) (then
        (i32.store (local.get $buf) (i32.const 0x73706143)) ;; "Caps"
        (i32.store (i32.add (local.get $buf) (i32.const 4)) (i32.const 0x636F4C20)) ;; " Loc"
        (i32.store16 (i32.add (local.get $buf) (i32.const 8)) (i32.const 0x006B)) ;; "k\0"
        (local.set $len (i32.const 9)) (br $done)))
      ;; Num Lock (0x45)
      (if (i32.eq (local.get $scan) (i32.const 0x45)) (then
        (i32.store (local.get $buf) (i32.const 0x206D754E)) ;; "Num "
        (i32.store (i32.add (local.get $buf) (i32.const 4)) (i32.const 0x6B636F4C)) ;; "Lock"
        (i32.store8 (i32.add (local.get $buf) (i32.const 8)) (i32.const 0))
        (local.set $len (i32.const 8)) (br $done)))
      ;; Scroll Lock (0x46)
      (if (i32.eq (local.get $scan) (i32.const 0x46)) (then
        (i32.store (local.get $buf) (i32.const 0x6F726353)) ;; "Scro"
        (i32.store (i32.add (local.get $buf) (i32.const 4)) (i32.const 0x4C206C6C)) ;; "ll L"
        (i32.store (i32.add (local.get $buf) (i32.const 8)) (i32.const 0x006B636F)) ;; "ock\0"
        (local.set $len (i32.const 11)) (br $done)))
      ;; Numpad scancodes 0x37 (*), 0x47..0x53. Render as "Num <glyph>".
      ;; 0x47-0x49=NP7-9, 0x4A=-, 0x4B-0x4D=NP4-6, 0x4E=+, 0x4F-0x51=NP1-3,
      ;; 0x52=NP0, 0x53=. — match Windows' "Num 7" / "Num *" naming.
      (local.set $ch (i32.const 0))
      (if (i32.eq (local.get $scan) (i32.const 0x37)) (then (local.set $ch (i32.const 0x2A)))) ;; *
      (if (i32.eq (local.get $scan) (i32.const 0x47)) (then (local.set $ch (i32.const 0x37)))) ;; 7
      (if (i32.eq (local.get $scan) (i32.const 0x48)) (then (local.set $ch (i32.const 0x38)))) ;; 8
      (if (i32.eq (local.get $scan) (i32.const 0x49)) (then (local.set $ch (i32.const 0x39)))) ;; 9
      (if (i32.eq (local.get $scan) (i32.const 0x4A)) (then (local.set $ch (i32.const 0x2D)))) ;; -
      (if (i32.eq (local.get $scan) (i32.const 0x4B)) (then (local.set $ch (i32.const 0x34)))) ;; 4
      (if (i32.eq (local.get $scan) (i32.const 0x4C)) (then (local.set $ch (i32.const 0x35)))) ;; 5
      (if (i32.eq (local.get $scan) (i32.const 0x4D)) (then (local.set $ch (i32.const 0x36)))) ;; 6
      (if (i32.eq (local.get $scan) (i32.const 0x4E)) (then (local.set $ch (i32.const 0x2B)))) ;; +
      (if (i32.eq (local.get $scan) (i32.const 0x4F)) (then (local.set $ch (i32.const 0x31)))) ;; 1
      (if (i32.eq (local.get $scan) (i32.const 0x50)) (then (local.set $ch (i32.const 0x32)))) ;; 2  (overrides arrow Down)
      (if (i32.eq (local.get $scan) (i32.const 0x51)) (then (local.set $ch (i32.const 0x33)))) ;; 3
      (if (i32.eq (local.get $scan) (i32.const 0x52)) (then (local.set $ch (i32.const 0x30)))) ;; 0
      (if (i32.eq (local.get $scan) (i32.const 0x53)) (then (local.set $ch (i32.const 0x2E)))) ;; .
      (if (local.get $ch) (then
        (i32.store (local.get $buf) (i32.const 0x206D754E)) ;; "Num "
        (i32.store8 (i32.add (local.get $buf) (i32.const 4)) (local.get $ch))
        (i32.store8 (i32.add (local.get $buf) (i32.const 5)) (i32.const 0))
        (local.set $len (i32.const 5)) (br $done)))
      ;; Number row: 0x02-0x0A = '1'-'9', 0x0B = '0'
      (if (i32.and (i32.ge_u (local.get $scan) (i32.const 0x02)) (i32.le_u (local.get $scan) (i32.const 0x0A)))
        (then (i32.store16 (local.get $buf) (i32.add (i32.const 0x30) (i32.sub (local.get $scan) (i32.const 1))))
              (local.set $len (i32.const 1)) (br $done)))
      (if (i32.eq (local.get $scan) (i32.const 0x0B)) (then
        (i32.store16 (local.get $buf) (i32.const 0x30)) (local.set $len (i32.const 1)) (br $done)))
      ;; Tab (0x0F)
      (if (i32.eq (local.get $scan) (i32.const 0x0F)) (then
        (i32.store (local.get $buf) (i32.const 0x00626154)) ;; "Tab\0"
        (local.set $len (i32.const 3)) (br $done)))
      ;; QWERTYUIOP: scancodes 0x10-0x19
      (local.set $ch (i32.const 0))
      (if (i32.eq (local.get $scan) (i32.const 0x10)) (then (local.set $ch (i32.const 0x51))))
      (if (i32.eq (local.get $scan) (i32.const 0x11)) (then (local.set $ch (i32.const 0x57))))
      (if (i32.eq (local.get $scan) (i32.const 0x12)) (then (local.set $ch (i32.const 0x45))))
      (if (i32.eq (local.get $scan) (i32.const 0x13)) (then (local.set $ch (i32.const 0x52))))
      (if (i32.eq (local.get $scan) (i32.const 0x14)) (then (local.set $ch (i32.const 0x54))))
      (if (i32.eq (local.get $scan) (i32.const 0x15)) (then (local.set $ch (i32.const 0x59))))
      (if (i32.eq (local.get $scan) (i32.const 0x16)) (then (local.set $ch (i32.const 0x55))))
      (if (i32.eq (local.get $scan) (i32.const 0x17)) (then (local.set $ch (i32.const 0x49))))
      (if (i32.eq (local.get $scan) (i32.const 0x18)) (then (local.set $ch (i32.const 0x4F))))
      (if (i32.eq (local.get $scan) (i32.const 0x19)) (then (local.set $ch (i32.const 0x50))))
      ;; Enter (0x1C)
      (if (i32.eq (local.get $scan) (i32.const 0x1C)) (then
        (i32.store (local.get $buf) (i32.const 0x65746E45)) ;; "Ente"
        (i32.store16 (i32.add (local.get $buf) (i32.const 4)) (i32.const 0x0072)) ;; "r\0"
        (local.set $len (i32.const 5)) (br $done)))
      ;; Ctrl (0x1D)
      (if (i32.eq (local.get $scan) (i32.const 0x1D)) (then
        (i32.store (local.get $buf) (i32.const 0x6C727443)) ;; "Ctrl"
        (i32.store8 (i32.add (local.get $buf) (i32.const 4)) (i32.const 0))
        (local.set $len (i32.const 4)) (br $done)))
      ;; ASDFGHJKL: scancodes 0x1E-0x26
      (if (i32.eq (local.get $scan) (i32.const 0x1E)) (then (local.set $ch (i32.const 0x41))))
      (if (i32.eq (local.get $scan) (i32.const 0x1F)) (then (local.set $ch (i32.const 0x53))))
      (if (i32.eq (local.get $scan) (i32.const 0x20)) (then (local.set $ch (i32.const 0x44))))
      (if (i32.eq (local.get $scan) (i32.const 0x21)) (then (local.set $ch (i32.const 0x46))))
      (if (i32.eq (local.get $scan) (i32.const 0x22)) (then (local.set $ch (i32.const 0x47))))
      (if (i32.eq (local.get $scan) (i32.const 0x23)) (then (local.set $ch (i32.const 0x48))))
      (if (i32.eq (local.get $scan) (i32.const 0x24)) (then (local.set $ch (i32.const 0x4A))))
      (if (i32.eq (local.get $scan) (i32.const 0x25)) (then (local.set $ch (i32.const 0x4B))))
      (if (i32.eq (local.get $scan) (i32.const 0x26)) (then (local.set $ch (i32.const 0x4C))))
      ;; Shift (0x2A, 0x36)
      (if (i32.or (i32.eq (local.get $scan) (i32.const 0x2A)) (i32.eq (local.get $scan) (i32.const 0x36))) (then
        (i32.store (local.get $buf) (i32.const 0x66696853)) ;; "Shif"
        (i32.store16 (i32.add (local.get $buf) (i32.const 4)) (i32.const 0x0074)) ;; "t\0"
        (local.set $len (i32.const 5)) (br $done)))
      ;; ZXCVBNM: scancodes 0x2C-0x32
      (if (i32.eq (local.get $scan) (i32.const 0x2C)) (then (local.set $ch (i32.const 0x5A))))
      (if (i32.eq (local.get $scan) (i32.const 0x2D)) (then (local.set $ch (i32.const 0x58))))
      (if (i32.eq (local.get $scan) (i32.const 0x2E)) (then (local.set $ch (i32.const 0x43))))
      (if (i32.eq (local.get $scan) (i32.const 0x2F)) (then (local.set $ch (i32.const 0x56))))
      (if (i32.eq (local.get $scan) (i32.const 0x30)) (then (local.set $ch (i32.const 0x42))))
      (if (i32.eq (local.get $scan) (i32.const 0x31)) (then (local.set $ch (i32.const 0x4E))))
      (if (i32.eq (local.get $scan) (i32.const 0x32)) (then (local.set $ch (i32.const 0x4D))))
      ;; If a letter was matched, write it
      (if (local.get $ch) (then
        (i32.store8 (local.get $buf) (local.get $ch))
        (i32.store8 (i32.add (local.get $buf) (i32.const 1)) (i32.const 0))
        (local.set $len (i32.const 1)) (br $done)))
      ;; Alt (0x38)
      (if (i32.eq (local.get $scan) (i32.const 0x38)) (then
        (i32.store (local.get $buf) (i32.const 0x00746C41)) ;; "Alt\0"
        (local.set $len (i32.const 3)) (br $done)))
      ;; Space (0x39)
      (if (i32.eq (local.get $scan) (i32.const 0x39)) (then
        (i32.store (local.get $buf) (i32.const 0x63617053)) ;; "Spac"
        (i32.store16 (i32.add (local.get $buf) (i32.const 4)) (i32.const 0x0065)) ;; "e\0"
        (local.set $len (i32.const 5)) (br $done)))
      ;; F1-F10: scan 0x3B-0x44
      (if (i32.and (i32.ge_u (local.get $scan) (i32.const 0x3B)) (i32.le_u (local.get $scan) (i32.const 0x44)))
        (then
          (i32.store8 (local.get $buf) (i32.const 0x46))  ;; 'F'
          (local.set $ch (i32.sub (local.get $scan) (i32.const 0x3A)))
          (if (i32.le_u (local.get $ch) (i32.const 9))
            (then (i32.store8 (i32.add (local.get $buf) (i32.const 1)) (i32.add (i32.const 0x30) (local.get $ch)))
                  (i32.store8 (i32.add (local.get $buf) (i32.const 2)) (i32.const 0))
                  (local.set $len (i32.const 2)))
            (else (i32.store8 (i32.add (local.get $buf) (i32.const 1)) (i32.const 0x31))
                  (i32.store8 (i32.add (local.get $buf) (i32.const 2)) (i32.const 0x30))
                  (i32.store8 (i32.add (local.get $buf) (i32.const 3)) (i32.const 0))
                  (local.set $len (i32.const 3))))
          (br $done)))
      ;; Arrow keys: Up=0x48, Left=0x4B, Right=0x4D, Down=0x50
      (if (i32.eq (local.get $scan) (i32.const 0x48)) (then
        (i32.store (local.get $buf) (i32.const 0x00007055)) ;; "Up\0"
        (local.set $len (i32.const 2)) (br $done)))
      (if (i32.eq (local.get $scan) (i32.const 0x4B)) (then
        (i32.store (local.get $buf) (i32.const 0x7466654C)) ;; "Left"
        (i32.store8 (i32.add (local.get $buf) (i32.const 4)) (i32.const 0))
        (local.set $len (i32.const 4)) (br $done)))
      (if (i32.eq (local.get $scan) (i32.const 0x4D)) (then
        (i32.store (local.get $buf) (i32.const 0x68676952)) ;; "Righ"
        (i32.store16 (i32.add (local.get $buf) (i32.const 4)) (i32.const 0x0074)) ;; "t\0"
        (local.set $len (i32.const 5)) (br $done)))
      (if (i32.eq (local.get $scan) (i32.const 0x50)) (then
        (i32.store (local.get $buf) (i32.const 0x6E776F44)) ;; "Down"
        (i32.store8 (i32.add (local.get $buf) (i32.const 4)) (i32.const 0))
        (local.set $len (i32.const 4)) (br $done)))
      ;; F11-F12
      (if (i32.eq (local.get $scan) (i32.const 0x57)) (then
        (i32.store (local.get $buf) (i32.const 0x00313146)) ;; "F11\0"
        (local.set $len (i32.const 3)) (br $done)))
      (if (i32.eq (local.get $scan) (i32.const 0x58)) (then
        (i32.store (local.get $buf) (i32.const 0x00323146)) ;; "F12\0"
        (local.set $len (i32.const 3)) (br $done)))
      ;; OEM punctuation — render the unshifted glyph as a 1-char name.
      (local.set $ch (i32.const 0))
      (if (i32.eq (local.get $scan) (i32.const 0x0C)) (then (local.set $ch (i32.const 0x2D)))) ;; -
      (if (i32.eq (local.get $scan) (i32.const 0x0D)) (then (local.set $ch (i32.const 0x3D)))) ;; =
      (if (i32.eq (local.get $scan) (i32.const 0x1A)) (then (local.set $ch (i32.const 0x5B)))) ;; [
      (if (i32.eq (local.get $scan) (i32.const 0x1B)) (then (local.set $ch (i32.const 0x5D)))) ;; ]
      (if (i32.eq (local.get $scan) (i32.const 0x27)) (then (local.set $ch (i32.const 0x3B)))) ;; ;
      (if (i32.eq (local.get $scan) (i32.const 0x28)) (then (local.set $ch (i32.const 0x27)))) ;; '
      (if (i32.eq (local.get $scan) (i32.const 0x29)) (then (local.set $ch (i32.const 0x60)))) ;; `
      (if (i32.eq (local.get $scan) (i32.const 0x2B)) (then (local.set $ch (i32.const 0x5C)))) ;; \
      (if (i32.eq (local.get $scan) (i32.const 0x33)) (then (local.set $ch (i32.const 0x2C)))) ;; ,
      (if (i32.eq (local.get $scan) (i32.const 0x34)) (then (local.set $ch (i32.const 0x2E)))) ;; .
      (if (i32.eq (local.get $scan) (i32.const 0x35)) (then (local.set $ch (i32.const 0x2F)))) ;; /
      (if (local.get $ch) (then
        (i32.store8 (local.get $buf) (local.get $ch))
        (i32.store8 (i32.add (local.get $buf) (i32.const 1)) (i32.const 0))
        (local.set $len (i32.const 1)) (br $done)))
      ;; Unknown: write "?"
      (i32.store16 (local.get $buf) (i32.const 0x003F))
      (local.set $len (i32.const 1))
    )
    (i32.store offset=0 (global.get $reg_base) (local.get $len))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 789: SetObjectOwner — obsolete GDI function, no-op
  (func $handle_SetObjectOwner (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 792: timeGetTime — same as GetTickCount, returns ms
  (func $handle_timeGetTime (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $tick_count (call $host_get_ticks))
    ;; Same spin park as GetTickCount — timeGetTime is the one the DirectX-era
    ;; frame limiters actually call, and Abe's Oddysee alone makes 1.77 million
    ;; of these calls in three guest seconds. See $clock_spin_step in
    ;; src/09a-handlers.wat. Parking before $midi_stream_service is deliberate:
    ;; the service is idempotent in the millisecond, and re-running it on every
    ;; spin iteration is part of what the spin costs.
    (if (call $clock_spin_step (global.get $tick_count))
      (then
        (if (call $clock_spin_arm (global.get $tick_count)) (then (return)))))
    (call $midi_stream_service (global.get $tick_count))
    (i32.store offset=0 (global.get $reg_base) (global.get $tick_count))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; timeGetSystemTime(pmmt, cbmmt) — the system time as an MMTIME in
  ;; milliseconds: wType = TIME_MS (1), u.ms = the timeGetTime clock. A buffer
  ;; smaller than the 12-byte MMTIME is TIMERR_STRUCT (129), as on Win98.
  (func $handle_timeGetSystemTime (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.lt_u (local.get $arg1) (i32.const 12))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 129)))
      (else
        (global.set $tick_count (call $host_get_ticks))
        (i32.store (call $g2w (local.get $arg0)) (i32.const 1))
        (i32.store (call $g2w (i32.add (local.get $arg0) (i32.const 4))) (global.get $tick_count))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; timeBeginPeriod(uPeriod) — browser scheduling has no host timer quantum
  ;; to change, but the request must still be inside the range advertised by
  ;; timeGetDevCaps. DirectX-era games normally request the 1 ms minimum.
  (func $winmm_timer_period_valid (param $period i32) (result i32)
    (i32.and
      (i32.ge_u (local.get $period) (i32.const 1))
      (i32.le_u (local.get $period) (i32.const 1000000))))

  (func $handle_timeBeginPeriod (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (call $winmm_timer_period_valid (local.get $arg0)))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 97))) ;; TIMERR_NOCANDO
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 0)))) ;; TIMERR_NOERROR
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))
  ;; timeEndPeriod is a host no-op for a valid matching resolution request,
  ;; but still rejects values outside the device's advertised range. Microsoft
  ;; specifies the same one-UINT ABI and range result for Begin and End, so the
  ;; no-host-quantum model has one canonical implementation for both front
  ;; doors. The delegated handler performs the one stdcall cleanup.
  (func $handle_timeEndPeriod (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_timeBeginPeriod
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; timeGetDevCaps(lptc, cbtc) — fills TIMECAPS { wPeriodMin, wPeriodMax }.
  ;; We claim 1 ms min resolution and ~1000 s max, matching what real NT returns.
  (func $handle_timeGetDevCaps (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ptr i32)
    (if (i32.and (i32.ne (local.get $arg0) (i32.const 0))
                 (i32.ge_u (local.get $arg1) (i32.const 8)))
      (then
        (local.set $ptr (call $g2w (local.get $arg0)))
        (i32.store (local.get $ptr) (i32.const 1))
        (i32.store offset=4 (local.get $ptr) (i32.const 1000000))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; 814: PathFindFileNameA(lpszPath) → pointer to filename component
  ;; Walks backwards from end of path string, returns pointer after last '\' or '/'
  (func $handle_PathFindFileNameA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $base i32) (local $ptr i32) (local $last i32) (local $ch i32)
    (local.set $base (call $g2w (local.get $arg0)))
    (local.set $ptr (local.get $base))
    (local.set $last (local.get $ptr))
    (block $done (loop $scan
      (local.set $ch (i32.load8_u (local.get $ptr)))
      (br_if $done (i32.eqz (local.get $ch)))
      (if (i32.or (i32.eq (local.get $ch) (i32.const 0x5C))    ;; backslash
                  (i32.eq (local.get $ch) (i32.const 0x2F)))    ;; forward slash
        (then (local.set $last (i32.add (local.get $ptr) (i32.const 1)))))
      (local.set $ptr (i32.add (local.get $ptr) (i32.const 1)))
      (br $scan)))
    ;; Convert WASM pointer back to guest address
    (i32.store offset=0 (global.get $reg_base) (i32.add (i32.sub (local.get $last) (local.get $base)) (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; 815: StrStrIA(lpFirst, lpSrch) → pointer to match or NULL
  ;; Case-insensitive substring search using byte-by-byte comparison
  (func $handle_StrStrIA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $hay_base i32) (local $hay i32) (local $ndl i32) (local $hi i32) (local $ni i32)
    (local $hc i32) (local $nc i32) (local $ndl_len i32)
    ;; Get needle length
    (local.set $ndl (call $g2w (local.get $arg1)))
    (local.set $ndl_len (call $strlen (local.get $ndl)))
    (if (i32.eqz (local.get $ndl_len))
      (then (i32.store offset=0 (global.get $reg_base) (local.get $arg0))
             (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))) (return)))
    (local.set $hay_base (call $g2w (local.get $arg0)))
    (local.set $hay (local.get $hay_base))
    ;; Outer loop: try each position in haystack
    (block $not_found (loop $outer
      (br_if $not_found (i32.eqz (i32.load8_u (local.get $hay))))
      ;; Inner loop: compare needle at current position
      (local.set $hi (local.get $hay))
      (local.set $ni (local.get $ndl))
      (block $mismatch (loop $inner
        (local.set $nc (i32.load8_u (local.get $ni)))
        (if (i32.eqz (local.get $nc))
          (then ;; needle exhausted = match found
            (i32.store offset=0 (global.get $reg_base) (i32.add (i32.sub (local.get $hay) (local.get $hay_base)) (local.get $arg0)))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))) (return)))
        (local.set $hc (i32.load8_u (local.get $hi)))
        (br_if $mismatch (i32.eqz (local.get $hc)))
        ;; Lowercase both chars for comparison (ASCII a-z/A-Z only)
        (if (i32.and (i32.ge_u (local.get $hc) (i32.const 0x41)) (i32.le_u (local.get $hc) (i32.const 0x5A)))
          (then (local.set $hc (i32.or (local.get $hc) (i32.const 0x20)))))
        (if (i32.and (i32.ge_u (local.get $nc) (i32.const 0x41)) (i32.le_u (local.get $nc) (i32.const 0x5A)))
          (then (local.set $nc (i32.or (local.get $nc) (i32.const 0x20)))))
        (br_if $mismatch (i32.ne (local.get $hc) (local.get $nc)))
        (local.set $hi (i32.add (local.get $hi) (i32.const 1)))
        (local.set $ni (i32.add (local.get $ni) (i32.const 1)))
        (br $inner)))
      (local.set $hay (i32.add (local.get $hay) (i32.const 1)))
      (br $outer)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; ---- PROP_TABLE helpers ----
  ;; Linear scan is fine — most apps have a handful of live props. Name
  ;; normalisation happens in $prop_key: an ATOM passes through as itself, a
  ;; string is FNV-1a hashed.
  (func $prop_find (param $hwnd i32) (param $key i32) (result i32)
    (local $i i32) (local $p i32)
    (local.set $i (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $MAX_PROPS)))
      (local.set $p (i32.add (global.get $PROP_TABLE)
                     (i32.mul (local.get $i) (i32.const 12))))
      (if (i32.and (i32.eq (i32.load (local.get $p)) (local.get $hwnd))
                   (i32.eq (i32.load offset=4 (local.get $p)) (local.get $key)))
        (then (return (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const -1))

  ;; Turn a prop name into a table key. The name is either a pointer to a
  ;; string or an ATOM -- a small integer smuggled through the same argument,
  ;; which is what MAKEINTATOM and every RegisterWindowMessage-style atom is.
  ;;
  ;; The test has to happen on the guest value, before g2w. An ATOM like
  ;; 0xC000 is far below the image base, so translating it first wraps it to
  ;; an address nowhere near the guest, $class_name_hash no longer recognises
  ;; it as an atom, and it hashes whatever bytes happen to live there. Those
  ;; bytes were zero, so every atom hashed to the FNV basis and collided:
  ;; comctl32 asking hwnd for its own 0xC000 prop was handed back the object
  ;; VCL had stored under 0xC001, and passed that straight to LocalReAlloc.
  ;;
  ;; USER keys a window property by ATOM: SetProp with a string adds that
  ;; string as a global atom, and GetProp/RemoveProp with either the string or
  ;; the atom find the same entry. Visual Basic depends on that -- its drag
  ;; subclass is stored with SetPropA(hwnd, "<name>") and looked up with
  ;; GetPropA(hwnd, 0xC000); a string key that was only hashed missed, VB
  ;; re-subclassed the window over itself, and Tetravex's dragged tile stopped
  ;; following the mouse after one step. A string with no global atom (only
  ;; possible for a lookup that SetProp never stored) keeps the hash as its
  ;; key, so it can still match nothing but itself.
  (func $prop_key (param $ga i32) (result i32)
    (local $atom i32)
    (if (i32.lt_u (local.get $ga) (i32.const 0x10000))
      (then (return (local.get $ga))))
    (local.set $atom (call $atom_find (global.get $ATOM_GLOBAL_TABLE) (local.get $ga)))
    (if (local.get $atom) (then (return (local.get $atom))))
    (call $class_name_hash (call $g2w (local.get $ga))))

  ;; SetProp's key: a string is added to the global atom table first, as USER
  ;; does, so a later lookup by that atom finds it.
  (func $prop_key_store (param $ga i32) (result i32)
    (local $atom i32)
    (if (i32.lt_u (local.get $ga) (i32.const 0x10000))
      (then (return (local.get $ga))))
    (local.set $atom (call $atom_find (global.get $ATOM_GLOBAL_TABLE) (local.get $ga)))
    (if (i32.eqz (local.get $atom))
      (then (local.set $atom (call $atom_add (global.get $ATOM_GLOBAL_TABLE) (local.get $ga)))))
    (if (local.get $atom) (then (return (local.get $atom))))
    (call $class_name_hash (call $g2w (local.get $ga))))

  (func $prop_empty_slot (result i32)
    (local $i i32) (local $p i32)
    (local.set $i (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $MAX_PROPS)))
      (local.set $p (i32.add (global.get $PROP_TABLE)
                     (i32.mul (local.get $i) (i32.const 12))))
      (if (i32.eqz (i32.load (local.get $p))) (then (return (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const -1))

  ;; 816: GetPropA(hwnd, lpString) → HANDLE
  (func $handle_GetPropA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $idx i32)
    (local.set $idx (call $prop_find (local.get $arg0)
                     (call $prop_key (local.get $arg1))))
    (if (i32.lt_s (local.get $idx) (i32.const 0))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (else (i32.store offset=0 (global.get $reg_base) (i32.load offset=8 (i32.add (global.get $PROP_TABLE)
                                  (i32.mul (local.get $idx) (i32.const 12)))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; 817: SetPropA(hwnd, lpString, hData) → BOOL
  (func $handle_SetPropA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $key i32) (local $idx i32) (local $p i32)
    (local.set $key (call $prop_key_store (local.get $arg1)))
    (local.set $idx (call $prop_find (local.get $arg0) (local.get $key)))
    (if (i32.lt_s (local.get $idx) (i32.const 0))
      (then (local.set $idx (call $prop_empty_slot))))
    (if (i32.ge_s (local.get $idx) (i32.const 0))
      (then
        (local.set $p (i32.add (global.get $PROP_TABLE)
                       (i32.mul (local.get $idx) (i32.const 12))))
        (i32.store         (local.get $p) (local.get $arg0))
        (i32.store offset=4  (local.get $p) (local.get $key))
        (i32.store offset=8  (local.get $p) (local.get $arg2))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1)))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; GetSystemInfo(lpSystemInfo) — fill SYSTEM_INFO struct (36 bytes)
  (func $handle_GetSystemInfo (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32)
    (local.set $wa (call $g2w (local.get $arg0)))
    (call $zero_memory (local.get $wa) (i32.const 36))
    ;; wProcessorArchitecture=0 (x86), wReserved=0 → already zero
    (i32.store offset=4  (local.get $wa) (i32.const 4096))        ;; dwPageSize
    (i32.store offset=8  (local.get $wa) (i32.const 0x00010000))  ;; lpMinimumApplicationAddress
    (i32.store offset=12 (local.get $wa) (i32.const 0x7FFEFFFF))  ;; lpMaximumApplicationAddress
    (i32.store offset=16 (local.get $wa) (i32.const 1))           ;; dwActiveProcessorMask
    (i32.store offset=20 (local.get $wa) (i32.const 1))           ;; dwNumberOfProcessors
    (i32.store offset=24 (local.get $wa) (i32.const 586))         ;; dwProcessorType (PROCESSOR_INTEL_PENTIUM)
    (i32.store offset=28 (local.get $wa) (i32.const 0x10000))     ;; dwAllocationGranularity = 64K
    (i32.store16 offset=32 (local.get $wa) (i32.const 6))         ;; wProcessorLevel
    ;; wProcessorRevision=0 → already zero
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; GetUserName reports its size including the NUL on both success and
  ;; insufficient-buffer failure. A/W differ only in the destination width.
  (func $get_user_name (param $buf_g i32) (param $size_g i32)
        (param $wide i32) (result i32)
    (local $buf_wa i32) (local $size_wa i32)
    (if (i32.eqz (local.get $size_g))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (return (i32.const 0))))
    (local.set $size_wa (call $g2w (local.get $size_g)))
    (if (i32.or (i32.eqz (local.get $buf_g))
                (i32.lt_u (i32.load (local.get $size_wa)) (i32.const 5)))
      (then
        (i32.store (local.get $size_wa) (i32.const 5))
        (global.set $last_error (i32.const 122)) ;; ERROR_INSUFFICIENT_BUFFER
        (return (i32.const 0))))
    (local.set $buf_wa (call $g2w (local.get $buf_g)))
    (if (local.get $wide)
      (then
        (i32.store16 offset=0 (local.get $buf_wa) (i32.const 117)) ;; 'u'
        (i32.store16 offset=2 (local.get $buf_wa) (i32.const 115)) ;; 's'
        (i32.store16 offset=4 (local.get $buf_wa) (i32.const 101)) ;; 'e'
        (i32.store16 offset=6 (local.get $buf_wa) (i32.const 114)) ;; 'r'
        (i32.store16 offset=8 (local.get $buf_wa) (i32.const 0)))
      (else
        (i32.store8 offset=0 (local.get $buf_wa) (i32.const 117)) ;; 'u'
        (i32.store8 offset=1 (local.get $buf_wa) (i32.const 115)) ;; 's'
        (i32.store8 offset=2 (local.get $buf_wa) (i32.const 101)) ;; 'e'
        (i32.store8 offset=3 (local.get $buf_wa) (i32.const 114)) ;; 'r'
        (i32.store8 offset=4 (local.get $buf_wa) (i32.const 0))))
    (i32.store (local.get $size_wa) (i32.const 5))
    (global.set $last_error (i32.const 0))
    (i32.const 1))

  (func $handle_GetUserNameA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $get_user_name (local.get $arg0) (local.get $arg1) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_GetUserNameW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $get_user_name (local.get $arg0) (local.get $arg1) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; GetComputerName reports the required size including NUL on overflow,
  ;; but the copied character count excluding NUL on success.
  (func $get_computer_name (param $buf_g i32) (param $size_g i32)
        (param $wide i32) (result i32)
    (local $buf_wa i32) (local $size_wa i32)
    (if (i32.eqz (local.get $size_g))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (return (i32.const 0))))
    (local.set $size_wa (call $g2w (local.get $size_g)))
    (if (i32.or (i32.eqz (local.get $buf_g))
                (i32.lt_u (i32.load (local.get $size_wa)) (i32.const 3)))
      (then
        (i32.store (local.get $size_wa) (i32.const 3))
        (global.set $last_error (i32.const 111)) ;; ERROR_BUFFER_OVERFLOW
        (return (i32.const 0))))
    (local.set $buf_wa (call $g2w (local.get $buf_g)))
    (if (local.get $wide)
      (then
        (i32.store16 offset=0 (local.get $buf_wa) (i32.const 80)) ;; 'P'
        (i32.store16 offset=2 (local.get $buf_wa) (i32.const 67)) ;; 'C'
        (i32.store16 offset=4 (local.get $buf_wa) (i32.const 0)))
      (else
        (i32.store8 offset=0 (local.get $buf_wa) (i32.const 80)) ;; 'P'
        (i32.store8 offset=1 (local.get $buf_wa) (i32.const 67)) ;; 'C'
        (i32.store8 offset=2 (local.get $buf_wa) (i32.const 0))))
    (i32.store (local.get $size_wa) (i32.const 2))
    (global.set $last_error (i32.const 0))
    (i32.const 1))

  (func $handle_GetComputerNameA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $get_computer_name (local.get $arg0) (local.get $arg1) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_GetComputerNameW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $get_computer_name (local.get $arg0) (local.get $arg1) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; DirectPlayCreate(lpGUIDSP, lplpDP, pUnk) — the pre-COM entry point into
  ;; DirectPlay, which apps reach via LoadLibrary("DPlayX.dll") rather than
  ;; the import table. Hands back the same object CoCreateInstance(
  ;; CLSID_DirectPlay) builds: callers immediately QueryInterface it up to
  ;; IDirectPlay3/4, and our vtable answers to all of them.
  (func $handle_DirectPlayCreate (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $obj_guest i32)
    (local.set $obj_guest (call $dx_create_com_obj (i32.const 26) (global.get $DX_VTBL_DPLAY3)))
    (if (i32.eqz (local.get $obj_guest))
      (then
        (if (local.get $arg1) (then (call $gs32 (local.get $arg1) (i32.const 0))))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004005))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (if (local.get $arg1) (then (call $gs32 (local.get $arg1) (local.get $obj_guest))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))
  ;; DirectPlayEnumerate[A](lpEnumCallback, lpContext) predates the COM
  ;; DirectPlay interfaces. Win98 applications use it to choose a registered
  ;; service provider before DirectPlayCreate, so failing here hides the TCP/IP
  ;; transport that the browser virtual LAN already implements.
  ;;
  ;; LPDPENUMDPCALLBACKA receives provider GUID, ANSI display name, provider
  ;; major/minor version, and caller context. Win98's providers report version
  ;; 6.0; expose the one transport this runtime can actually connect through.

  (func $dplay_enum_provider_init (result i32)
    (if (i32.and
          (i32.ne (i32.load offset=0 (global.get $DP_SHARED)) (i32.const 0))
          (i32.ne (i32.load offset=4 (global.get $DP_SHARED)) (i32.const 0)))
      (then (return (i32.const 1))))
    (i32.store offset=0 (global.get $DP_SHARED) (call $heap_alloc (i32.const 16)))
    (i32.store offset=4 (global.get $DP_SHARED) (call $heap_alloc (i32.const 44)))
    (if (i32.or
          (i32.eqz (i32.load offset=0 (global.get $DP_SHARED)))
          (i32.eqz (i32.load offset=4 (global.get $DP_SHARED))))
      (then
        (if (i32.load offset=4 (global.get $DP_SHARED))
          (then (call $heap_free (i32.load offset=4 (global.get $DP_SHARED)))))
        (if (i32.load offset=0 (global.get $DP_SHARED))
          (then (call $heap_free (i32.load offset=0 (global.get $DP_SHARED)))))
        (i32.store offset=0 (global.get $DP_SHARED) (i32.const 0))
        (i32.store offset=4 (global.get $DP_SHARED) (i32.const 0))
        (return (i32.const 0))))
    ;; DPSPGUID_TCPIP {36E95EE0-8577-11cf-960C-0080C7534E82}.
    (call $gs32 (i32.load offset=0 (global.get $DP_SHARED)) (i32.const 0x36E95EE0))
    (call $gs32 (i32.add (i32.load offset=0 (global.get $DP_SHARED)) (i32.const 4))
      (i32.const 0x11CF8577))
    (call $gs32 (i32.add (i32.load offset=0 (global.get $DP_SHARED)) (i32.const 8))
      (i32.const 0x80000C96))
    (call $gs32 (i32.add (i32.load offset=0 (global.get $DP_SHARED)) (i32.const 12))
      (i32.const 0x824E53C7))
    ;; "Internet TCP/IP Connection For DirectPlay\0"
    (call $gs32 (i32.load offset=4 (global.get $DP_SHARED)) (i32.const 0x65746E49))
    (call $gs32 (i32.add (i32.load offset=4 (global.get $DP_SHARED)) (i32.const 4))
      (i32.const 0x74656E72))
    (call $gs32 (i32.add (i32.load offset=4 (global.get $DP_SHARED)) (i32.const 8))
      (i32.const 0x50435420))
    (call $gs32 (i32.add (i32.load offset=4 (global.get $DP_SHARED)) (i32.const 12))
      (i32.const 0x2050492F))
    (call $gs32 (i32.add (i32.load offset=4 (global.get $DP_SHARED)) (i32.const 16))
      (i32.const 0x6E6E6F43))
    (call $gs32 (i32.add (i32.load offset=4 (global.get $DP_SHARED)) (i32.const 20))
      (i32.const 0x69746365))
    (call $gs32 (i32.add (i32.load offset=4 (global.get $DP_SHARED)) (i32.const 24))
      (i32.const 0x46206E6F))
    (call $gs32 (i32.add (i32.load offset=4 (global.get $DP_SHARED)) (i32.const 28))
      (i32.const 0x4420726F))
    (call $gs32 (i32.add (i32.load offset=4 (global.get $DP_SHARED)) (i32.const 32))
      (i32.const 0x63657269))
    (call $gs32 (i32.add (i32.load offset=4 (global.get $DP_SHARED)) (i32.const 36))
      (i32.const 0x616C5074))
    (call $gs32 (i32.add (i32.load offset=4 (global.get $DP_SHARED)) (i32.const 40))
      (i32.const 0x00000079))
    (i32.const 1))

  (func $directplay_enumerate_ansi
      (param $callback i32) (param $context i32) (param $ret_addr i32)
    (if (i32.eqz (local.get $callback))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) ;; DPERR_INVALIDPARAMS
        (return)))
    (if (i32.eqz (call $dplay_enum_provider_init))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000E)) ;; DPERR_OUTOFMEMORY
        (return)))
    ;; Saved API return, then callback args right-to-left: context, minor,
    ;; major, provider name, provider GUID.
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $ret_addr))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $context))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 6))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.load offset=4 (global.get $DP_SHARED)))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.load offset=0 (global.get $DP_SHARED)))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $ddenum_ret_thunk))
    (global.set $eip (local.get $callback))
    (global.set $steps (i32.const 0)))

  ;; The unsuffixed ordinal is the legacy ANSI export on Win98.  It is the
  ;; same two-argument ABI as DirectPlayEnumerateA, so the A handler is the
  ;; canonical front door and owns the single stdcall cleanup.
  (func $handle_DirectPlayEnumerate (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_DirectPlayEnumerateA
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))
  (func $handle_DirectPlayEnumerateA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret_addr i32)
    (local.set $ret_addr (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
    (call $directplay_enumerate_ansi
      (local.get $arg0) (local.get $arg1) (local.get $ret_addr)))
  (func $handle_DirectPlayLobbyCreateA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $obj_guest i32)
    (local.set $obj_guest (call $dx_create_com_obj (i32.const 27) (global.get $DX_VTBL_DPLAYLOBBY2)))
    (if (i32.eqz (local.get $obj_guest))
      (then
        (if (local.get $arg1) (then (call $gs32 (local.get $arg1) (i32.const 0))))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0x80004005))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    (if (local.get $arg1) (then (call $gs32 (local.get $arg1) (local.get $obj_guest))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
  ;; DirectSound enumerates the default alias and our actual software output.
  ;; DSES frame (112 bytes) lives on the invoking guest stack, so nested
  ;; enumerations own their callback strings, phase and caller independently.
  ;; 0 tag,4 return,8 callback,12 context,16 phase;32 GUID;48 device;
  ;; 72 module;88 default description. Callback strings expire on return.
  (func $dsound_enum_invoke (param $frame i32)
    (local $sp i32) (local $concrete i32)
    (local.set $concrete (call $gl32 (i32.add (local.get $frame) (i32.const 16))))
    (local.set $sp (i32.sub (local.get $frame) (i32.const 20)))
    (call $gs32 (local.get $sp) (global.get $ddenum_ret_thunk))
    (call $gs32 (i32.add (local.get $sp) (i32.const 4))
      (select (i32.add (local.get $frame) (i32.const 32)) (i32.const 0) (local.get $concrete)))
    (call $gs32 (i32.add (local.get $sp) (i32.const 8))
      (i32.add (local.get $frame) (select (i32.const 48) (i32.const 88) (local.get $concrete))))
    (call $gs32 (i32.add (local.get $sp) (i32.const 12))
      (i32.add (local.get $frame) (select (i32.const 72) (i32.const 84) (local.get $concrete))))
    (call $gs32 (i32.add (local.get $sp) (i32.const 16))
      (call $gl32 (i32.add (local.get $frame) (i32.const 12))))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (global.set $eip (call $gl32 (i32.add (local.get $frame) (i32.const 8))))
    (global.set $steps (i32.const 0)))

  (func $dsound_enum_continue
    (local $frame i32)
    (local.set $frame (i32.load offset=16 (global.get $reg_base)))
    (if (i32.and (i32.ne (i32.load (global.get $reg_base)) (i32.const 0))
          (i32.eqz (call $gl32 (i32.add (local.get $frame) (i32.const 16)))))
      (then
        (call $gs32 (i32.add (local.get $frame) (i32.const 16)) (i32.const 1))
        (call $dsound_enum_invoke (local.get $frame))
        (return)))
    (global.set $eip (call $gl32 (i32.add (local.get $frame) (i32.const 4))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (local.get $frame) (i32.const 112)))
    (i32.store (global.get $reg_base) (i32.const 0)))

  (func $handle_DirectSoundEnumerateA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $frame i32) (local $ret i32)
    (if (i32.eqz (local.get $arg0))
      (then
        (i32.store (global.get $reg_base) (i32.const 0x80070057))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (local.set $ret (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (local.set $frame (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 100)))
    (call $gs32 (local.get $frame) (i32.const 0x53455344))
    (call $gs32 (i32.add (local.get $frame) (i32.const 4)) (local.get $ret))
    (call $gs32 (i32.add (local.get $frame) (i32.const 8)) (local.get $arg0))
    (call $gs32 (i32.add (local.get $frame) (i32.const 12)) (local.get $arg1))
    (call $gs32 (i32.add (local.get $frame) (i32.const 16)) (i32.const 0))
    ;; Stable identity for the implemented software playback endpoint.
    (call $gs32 (i32.add (local.get $frame) (i32.const 32)) (i32.const 0x57415344))
    (call $gs32 (i32.add (local.get $frame) (i32.const 36)) (i32.const 0x4a714d31))
    (call $gs32 (i32.add (local.get $frame) (i32.const 40)) (i32.const 0x82476a91))
    (call $gs32 (i32.add (local.get $frame) (i32.const 44)) (i32.const 0x01000000))
    (call $gs32 (i32.add (local.get $frame) (i32.const 48)) (i32.const 0x656e6957))
    (call $gs32 (i32.add (local.get $frame) (i32.const 52)) (i32.const 0x73734120))
    (call $gs32 (i32.add (local.get $frame) (i32.const 56)) (i32.const 0x6c626d65))
    (call $gs32 (i32.add (local.get $frame) (i32.const 60)) (i32.const 0x75412079))
    (call $gs32 (i32.add (local.get $frame) (i32.const 64)) (i32.const 0x6f6964))
    (call $gs32 (i32.add (local.get $frame) (i32.const 72)) (i32.const 0x756f7364))
    (call $gs32 (i32.add (local.get $frame) (i32.const 76)) (i32.const 0x642e646e))
    (call $gs32 (i32.add (local.get $frame) (i32.const 80)) (i32.const 0x6c6c))
    (call $gs32 (i32.add (local.get $frame) (i32.const 84)) (i32.const 0))
    (call $gs32 (i32.add (local.get $frame) (i32.const 88)) (i32.const 0x6d697250))
    (call $gs32 (i32.add (local.get $frame) (i32.const 92)) (i32.const 0x20797261))
    (call $gs32 (i32.add (local.get $frame) (i32.const 96)) (i32.const 0x6e756f53))
    (call $gs32 (i32.add (local.get $frame) (i32.const 100)) (i32.const 0x72442064))
    (call $gs32 (i32.add (local.get $frame) (i32.const 104)) (i32.const 0x72657669))
    (call $gs32 (i32.add (local.get $frame) (i32.const 108)) (i32.const 0x0))
    (call $dsound_enum_invoke (local.get $frame)))
  ;; Both entry points share one host MCI parser. cchReturn is a character
  ;; count, so W uses an equally-sized ANSI staging buffer and widens the
  ;; bounded result at the API boundary.
  ;; The MCIAVI device (09a7h) sees each command first; it answers
  ;; $MCIAVI_PARKED for a "play ... wait" still running, and the caller then
  ;; parks on its thunk without popping the frame.
  (func $mci_send_string (param $cmd_g i32) (param $ret_g i32)
        (param $ret_chars i32) (param $wide i32) (param $cb_hwnd i32) (result i32)
    (local $cmd_work_g i32) (local $cmd_wa i32) (local $cmd_len i32)
    (local $ret_work_g i32) (local $ret_wa i32) (local $err i32)
    (if (local.get $cmd_g)
      (then
        (if (local.get $wide)
          (then
            (local.set $cmd_len (call $guest_wcslen (local.get $cmd_g)))
            (local.set $cmd_work_g
              (call $heap_alloc (i32.add (local.get $cmd_len) (i32.const 1))))
            (if (i32.eqz (local.get $cmd_work_g))
              (then (return (i32.const 0x109)))) ;; MCIERR_OUT_OF_MEMORY
            (drop (call $wide_to_ansi (local.get $cmd_g) (local.get $cmd_work_g)
              (i32.add (local.get $cmd_len) (i32.const 1)))))
          (else (local.set $cmd_work_g (local.get $cmd_g))))
        (local.set $cmd_wa (call $g2w (local.get $cmd_work_g)))))
    (if (i32.and (i32.ne (local.get $ret_g) (i32.const 0))
                 (i32.ne (local.get $ret_chars) (i32.const 0)))
      (then
        (if (local.get $wide)
          (then
            (local.set $ret_work_g (call $heap_alloc (local.get $ret_chars)))
            (if (i32.eqz (local.get $ret_work_g))
              (then
                (if (local.get $cmd_work_g) (then (call $heap_free (local.get $cmd_work_g))))
                (return (i32.const 0x109))))) ;; MCIERR_OUT_OF_MEMORY
          (else (local.set $ret_work_g (local.get $ret_g))))
        (local.set $ret_wa (call $g2w (local.get $ret_work_g)))
        (i32.store8 (local.get $ret_wa) (i32.const 0))))
    (local.set $err (call $mciavi_string (local.get $cmd_wa) (local.get $ret_wa)
      (local.get $ret_chars) (local.get $cb_hwnd)))
    (if (i32.eq (local.get $err) (global.get $MCIAVI_NOT_MINE))
      (then
        (local.set $err
          (call $host_mci_string (local.get $cmd_wa) (local.get $ret_wa)
            (local.get $ret_chars)))))
    (if (i32.and (i32.ne (local.get $wide) (i32.const 0))
                 (i32.ne (local.get $ret_work_g) (i32.const 0)))
      (then
        (drop (call $ansi_to_wide (local.get $ret_work_g) (local.get $ret_g)
          (local.get $ret_chars)))
        (call $heap_free (local.get $ret_work_g))))
    (if (i32.and (i32.ne (local.get $wide) (i32.const 0))
                 (i32.ne (local.get $cmd_work_g) (i32.const 0)))
      (then (call $heap_free (local.get $cmd_work_g))))
    (local.get $err))

  ;; mciSendStringA(cmd, retbuf, retlen, hCallback) → MCIERR (0 = no error)
  (func $handle_mciSendStringA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $err i32)
    (local.set $err (call $mci_send_string (local.get $arg0) (local.get $arg1)
        (local.get $arg2) (i32.const 0) (local.get $arg3)))
    (if (i32.eq (local.get $err) (global.get $MCIAVI_PARKED))
      (then (call $mciavi_park) (return)))
    (global.set $handler_set_eip (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (local.get $err))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; mciSendStringW(cmd, retbuf, retlen, hCallback) → MCIERR
  (func $handle_mciSendStringW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $err i32)
    (local.set $err (call $mci_send_string (local.get $arg0) (local.get $arg1)
        (local.get $arg2) (i32.const 1) (local.get $arg3)))
    (if (i32.eq (local.get $err) (global.get $MCIAVI_PARKED))
      (then (call $mciavi_park) (return)))
    (global.set $handler_set_eip (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (local.get $err))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; 862: GlobalMemoryStatus(lpBuffer) — fill MEMORYSTATUS struct
  (func $handle_GlobalMemoryStatus (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32)
    (local.set $wa (call $g2w (local.get $arg0)))
    (call $zero_memory (local.get $wa) (i32.const 32))
    (i32.store (local.get $wa) (i32.const 32))             ;; dwLength
    (i32.store offset=4 (local.get $wa) (i32.const 50))    ;; dwMemoryLoad = 50%
    (i32.store offset=8 (local.get $wa) (i32.const 0x04000000))  ;; dwTotalPhys = 64MB
    (i32.store offset=12 (local.get $wa) (i32.const 0x02000000)) ;; dwAvailPhys = 32MB
    (i32.store offset=16 (local.get $wa) (i32.const 0x10000000)) ;; dwTotalPageFile = 256MB
    (i32.store offset=20 (local.get $wa) (i32.const 0x08000000)) ;; dwAvailPageFile = 128MB
    (i32.store offset=24 (local.get $wa) (i32.const 0x7FFE0000)) ;; dwTotalVirtual
    (i32.store offset=28 (local.get $wa) (i32.const 0x7FFC0000)) ;; dwAvailVirtual
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; 852: RemovePropA(hwnd, lpString) → HANDLE (removed value)
  (func $handle_RemovePropA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $idx i32) (local $p i32)
    (local.set $idx (call $prop_find (local.get $arg0)
                     (call $prop_key (local.get $arg1))))
    (if (i32.lt_s (local.get $idx) (i32.const 0))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (else
        (local.set $p (i32.add (global.get $PROP_TABLE)
                       (i32.mul (local.get $idx) (i32.const 12))))
        (i32.store offset=0 (global.get $reg_base) (i32.load offset=8 (local.get $p)))
        (i32.store         (local.get $p) (i32.const 0))
        (i32.store offset=4  (local.get $p) (i32.const 0))
        (i32.store offset=8  (local.get $p) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; 824: GetConsoleOutputCP() → UINT. The page belongs to the console
  ;; associated with this process, so a detached process fails with zero.
  (func $handle_GetConsoleOutputCP (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (select (global.get $console_output_cp) (i32.const 0)
        (call $console_is_attached)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  ;; SetupAPI/device notifications are optional for sndvol32, but an empty
  ;; device-information set is still a real owned object.  Keep these records
  ;; in emulator-private shared memory: an HDEVINFO is opaque to the guest, a
  ;; Worker may destroy a set created by another Worker, and caller-controlled
  ;; heap bytes must never be forgeable into allocator ownership.
  ;;
  ;; SetupDiInfoSet (32 bytes, 32 process-shared records):
  ;;   +0 published handle/claim  +4 generation  +8 has class GUID
  ;;   +12 class GUID[16]                         +28 parent HWND
  (global $SETUPDI_INFO_SETS i32 (region.addr $SETUPDI_INFO_SETS 0))
  (global $SETUPDI_INFO_SETS_SIZE i32 (region.size $SETUPDI_INFO_SETS))
  (global $SETUPDI_INFO_SET_COUNT i32 (i32.const 32))

  (func $setupdi_record_addr (param $slot i32) (result i32)
    (i32.add (global.get $SETUPDI_INFO_SETS)
      (i32.shl (local.get $slot) (i32.const 5))))

  (func $setupdi_handle_value (param $slot i32) (param $generation i32) (result i32)
    ;; 0xFC is disjoint from VFS 0x70..0x7F, access tokens 0xFA and file
    ;; mappings 0xFB. Bits 5..23 carry the nonzero generation.
    (i32.or (i32.const 0xFC000000)
      (i32.or
        (i32.shl
          (i32.and (local.get $generation) (i32.const 0x0007FFFF))
          (i32.const 5))
        (i32.and (local.get $slot) (i32.const 31)))))

  (func $setupdi_record_from_handle (param $handle i32) (result i32)
    (local $rec i32)
    (if (i32.ne
          (i32.and (local.get $handle) (i32.const 0xFF000000))
          (i32.const 0xFC000000))
      (then (return (i32.const 0))))
    (local.set $rec
      (call $setupdi_record_addr
        (i32.and (local.get $handle) (i32.const 31))))
    (if (i32.ne (i32.atomic.load (local.get $rec)) (local.get $handle))
      (then (return (i32.const 0))))
    (local.get $rec))

  ;; A 16-byte GUID can cross at most one page boundary.  Its endpoint bytes
  ;; being mapped proves both pages exist without demanding that their WASM
  ;; backing be affine; $gl32 then gathers each dword page-safely.
  (func $setupdi_guid_span_valid (param $guid i32) (result i32)
    (local $last i32)
    (if (i32.eqz (local.get $guid)) (then (return (i32.const 0))))
    (local.set $last (i32.add (local.get $guid) (i32.const 15)))
    (if (i32.lt_u (local.get $last) (local.get $guid))
      (then (return (i32.const 0))))
    (i32.and
      (i32.ne
        (call $g2w_affine_span (local.get $guid) (i32.const 1))
        (global.get $NULL_SENTINEL))
      (i32.ne
        (call $g2w_affine_span (local.get $last) (i32.const 1))
        (global.get $NULL_SENTINEL))))

  (func $setupdi_allocate_record
      (param $has_guid i32) (param $g0 i32) (param $g1 i32)
      (param $g2 i32) (param $g3 i32) (param $parent i32) (result i32)
    (local $slot i32) (local $rec i32) (local $generation i32)
    (local $handle i32)
    (block $full (loop $scan
      (br_if $full
        (i32.ge_u (local.get $slot) (global.get $SETUPDI_INFO_SET_COUNT)))
      (local.set $rec (call $setupdi_record_addr (local.get $slot)))
      (if (i32.eqz
            (i32.atomic.rmw.cmpxchg (local.get $rec)
              (i32.const 0) (i32.const -1)))
        (then
          (local.set $generation
            (i32.and
              (i32.add
                (i32.atomic.rmw.add offset=4 (local.get $rec) (i32.const 1))
                (i32.const 1))
              (i32.const 0x0007FFFF)))
          (if (i32.eqz (local.get $generation))
            (then (local.set $generation (i32.const 1))))
          (i32.atomic.store offset=4 (local.get $rec) (local.get $generation))
          (local.set $handle
            (call $setupdi_handle_value (local.get $slot) (local.get $generation)))
          (i32.atomic.store offset=8 (local.get $rec) (local.get $has_guid))
          (i32.atomic.store offset=12 (local.get $rec) (local.get $g0))
          (i32.atomic.store offset=16 (local.get $rec) (local.get $g1))
          (i32.atomic.store offset=20 (local.get $rec) (local.get $g2))
          (i32.atomic.store offset=24 (local.get $rec) (local.get $g3))
          (i32.atomic.store offset=28 (local.get $rec) (local.get $parent))
          ;; Publish only after every field is initialized.
          (i32.atomic.store (local.get $rec) (local.get $handle))
          (return (local.get $handle))))
      (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  (func $handle_SetupDiCreateDeviceInfoList (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $set i32) (local $slot i32) (local $style i32)
    (local $g0 i32) (local $g1 i32) (local $g2 i32) (local $g3 i32)
    ;; hwndParent is optional, but when present it must name a live top-level
    ;; window.  The desktop and renderer-owned windows from another process do
    ;; not have a local WND_RECORDS slot, so use USER's canonical HWND domains
    ;; and ask the renderer for style only on that non-local path.
    (if (local.get $arg1)
      (then
        (if (i32.eqz (call $window_handle_valid (local.get $arg1)))
          (then
            (global.set $last_error (i32.const 1400)) ;; ERROR_INVALID_WINDOW_HANDLE
            (i32.store offset=0 (global.get $reg_base) (i32.const 0xFFFFFFFF))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
            (return)))
        (local.set $slot (call $wnd_table_find (local.get $arg1)))
        (local.set $style
          (if (result i32) (i32.ge_s (local.get $slot) (i32.const 0))
            (then (call $wnd_get_style (local.get $arg1)))
            (else (call $host_get_window_info (local.get $arg1) (i32.const 0)))))
        (if (i32.and (local.get $style) (i32.const 0x40000000)) ;; WS_CHILD
          (then
            (global.set $last_error (i32.const 1400)) ;; ERROR_INVALID_WINDOW_HANDLE
            (i32.store offset=0 (global.get $reg_base) (i32.const 0xFFFFFFFF))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
            (return)))))
    (if (local.get $arg0)
      (then
        (if (i32.eqz (call $setupdi_guid_span_valid (local.get $arg0)))
          (then
            (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
            (i32.store offset=0 (global.get $reg_base) (i32.const 0xFFFFFFFF))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
            (return)))
        (local.set $g0 (call $gl32 (local.get $arg0)))
        (local.set $g1 (call $gl32 (i32.add (local.get $arg0) (i32.const 4))))
        (local.set $g2 (call $gl32 (i32.add (local.get $arg0) (i32.const 8))))
        (local.set $g3 (call $gl32 (i32.add (local.get $arg0) (i32.const 12))))))
    (local.set $set (call $setupdi_allocate_record
      (i32.ne (local.get $arg0) (i32.const 0))
      (local.get $g0) (local.get $g1) (local.get $g2) (local.get $g3)
      (local.get $arg1)))
    (if (i32.eqz (local.get $set))
      (then
        (global.set $last_error (i32.const 8)) ;; ERROR_NOT_ENOUGH_MEMORY
        (i32.store offset=0 (global.get $reg_base) (i32.const 0xFFFFFFFF))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (i32.store offset=0 (global.get $reg_base) (local.get $set))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_SetupDiDestroyDeviceInfoList (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $rec i32)
    (local.set $rec (call $setupdi_record_from_handle (local.get $arg0)))
    (if (i32.eqz (local.get $rec))
      (then
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    ;; Atomically consume the exact published generation. A stale or racing
    ;; destroy cannot claim the slot that now belongs to another HDEVINFO.
    (if (i32.ne
          (i32.atomic.rmw.cmpxchg (local.get $rec)
            (local.get $arg0) (i32.const -1))
          (local.get $arg0))
      (then
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (i32.atomic.store offset=8 (local.get $rec) (i32.const 0))
    (i32.atomic.store offset=12 (local.get $rec) (i32.const 0))
    (i32.atomic.store offset=16 (local.get $rec) (i32.const 0))
    (i32.atomic.store offset=20 (local.get $rec) (i32.const 0))
    (i32.atomic.store offset=24 (local.get $rec) (i32.const 0))
    (i32.atomic.store offset=28 (local.get $rec) (i32.const 0))
    (i32.atomic.store (local.get $rec) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_SetupDiOpenDeviceInterfaceW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  (func $handle_SetupDiGetDeviceInterfaceDetailW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))

  (func $handle_SetupDiOpenDevRegKey (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0xffffffff))  ;; INVALID_HANDLE_VALUE
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))

  ;; Window device-interface registrations are process objects even when the
  ;; registering window belongs to a Worker-owned thread.  The public handle
  ;; is generation tagged, while its filter is copied into emulator-private
  ;; shared state so changing or freeing the caller's stack filter cannot alter
  ;; a live subscription.
  ;;
  ;; DeviceNotifyRecord (48 bytes, 32 process-shared records):
  ;;   +0 published handle/claim  +4 generation  +8 recipient HWND  +12 flags
  ;;   +16 interface class GUID[16]                         +32..47 reserved
  ;; DEVICE_NOTIFY_PAYLOADS holds one 32-byte guest-readable
  ;; DEV_BROADCAST_DEVICEINTERFACE_W per matching record.
  (global $DEVICE_NOTIFY_RECORDS i32 (region.addr $DEVICE_NOTIFY_RECORDS 0))
  (global $DEVICE_NOTIFY_RECORDS_SIZE i32 (region.size $DEVICE_NOTIFY_RECORDS))
  (global $DEVICE_NOTIFY_PAYLOADS i32 (region.addr $DEVICE_NOTIFY_PAYLOADS 0))
  (global $DEVICE_NOTIFY_PAYLOADS_SIZE i32 (region.size $DEVICE_NOTIFY_PAYLOADS))
  (global $DEVICE_NOTIFY_RECORD_COUNT i32 (i32.const 32))

  (func $device_notify_record_addr (param $slot i32) (result i32)
    (i32.add (global.get $DEVICE_NOTIFY_RECORDS)
      (i32.mul (local.get $slot) (i32.const 48))))

  (func $device_notify_payload_addr (param $slot i32) (result i32)
    (i32.add (global.get $DEVICE_NOTIFY_PAYLOADS)
      (i32.shl (local.get $slot) (i32.const 5))))

  (func $device_notify_handle_value
      (param $slot i32) (param $generation i32) (result i32)
    ;; 0xFD is disjoint from SetupAPI's 0xFC namespace and the VFS/token/file
    ;; handle ranges. Bits 5..23 carry the nonzero generation.
    (i32.or (i32.const 0xFD000000)
      (i32.or
        (i32.shl
          (i32.and (local.get $generation) (i32.const 0x0007FFFF))
          (i32.const 5))
        (i32.and (local.get $slot) (i32.const 31)))))

  (func $device_notify_record_from_handle (param $handle i32) (result i32)
    (local $rec i32)
    (if (i32.ne
          (i32.and (local.get $handle) (i32.const 0xFF000000))
          (i32.const 0xFD000000))
      (then (return (i32.const 0))))
    (local.set $rec
      (call $device_notify_record_addr
        (i32.and (local.get $handle) (i32.const 31))))
    (if (i32.ne (i32.atomic.load (local.get $rec)) (local.get $handle))
      (then (return (i32.const 0))))
    (local.get $rec))

  ;; The fixed DEVICEINTERFACE header is 32 bytes on 32-bit Windows.  Endpoint
  ;; validation plus page-safe $gl32 gathers accepts sparse adjacent guest
  ;; pages even when their WASM backing pages are not affine.
  (func $device_notify_filter_span_valid (param $filter i32) (result i32)
    (local $last i32)
    (if (i32.eqz (local.get $filter)) (then (return (i32.const 0))))
    (local.set $last (i32.add (local.get $filter) (i32.const 31)))
    (if (i32.lt_u (local.get $last) (local.get $filter))
      (then (return (i32.const 0))))
    (i32.and
      (i32.ne
        (call $g2w_affine_span (local.get $filter) (i32.const 1))
        (global.get $NULL_SENTINEL))
      (i32.ne
        (call $g2w_affine_span (local.get $last) (i32.const 1))
        (global.get $NULL_SENTINEL))))

  (func $device_notify_write_audio_payload (param $slot i32) (result i32)
    (local $payload i32)
    (local.set $payload (call $device_notify_payload_addr (local.get $slot)))
    (i32.atomic.store          (local.get $payload) (i32.const 32)) ;; dbcc_size
    (i32.atomic.store offset=4 (local.get $payload) (i32.const 5))  ;; DBT_DEVTYP_DEVICEINTERFACE
    (i32.atomic.store offset=8 (local.get $payload) (i32.const 0))
    ;; KSCATEGORY_AUDIO {6994AD04-93EF-11D0-A3CC-00A0C9223196}.
    (i32.atomic.store offset=12 (local.get $payload) (i32.const 0x6994AD04))
    (i32.atomic.store offset=16 (local.get $payload) (i32.const 0x11D093EF))
    (i32.atomic.store offset=20 (local.get $payload) (i32.const 0xA000CCA3))
    (i32.atomic.store offset=24 (local.get $payload) (i32.const 0x963122C9))
    (i32.atomic.store offset=28 (local.get $payload) (i32.const 0)) ;; empty dbcc_name
    (call $w2g (local.get $payload)))

  (func $device_notify_allocate_record
      (param $hwnd i32) (param $flags i32)
      (param $g0 i32) (param $g1 i32) (param $g2 i32) (param $g3 i32)
      (result i32)
    (local $slot i32) (local $rec i32) (local $generation i32)
    (local $handle i32)
    (block $full (loop $scan
      (br_if $full
        (i32.ge_u (local.get $slot) (global.get $DEVICE_NOTIFY_RECORD_COUNT)))
      (local.set $rec (call $device_notify_record_addr (local.get $slot)))
      (if (i32.eqz
            (i32.atomic.rmw.cmpxchg (local.get $rec)
              (i32.const 0) (i32.const -1)))
        (then
          (local.set $generation
            (i32.and
              (i32.add
                (i32.atomic.rmw.add offset=4 (local.get $rec) (i32.const 1))
                (i32.const 1))
              (i32.const 0x0007FFFF)))
          (if (i32.eqz (local.get $generation))
            (then (local.set $generation (i32.const 1))))
          (i32.atomic.store offset=4 (local.get $rec) (local.get $generation))
          (local.set $handle
            (call $device_notify_handle_value
              (local.get $slot) (local.get $generation)))
          (i32.atomic.store offset=8 (local.get $rec) (local.get $hwnd))
          (i32.atomic.store offset=12 (local.get $rec) (local.get $flags))
          (i32.atomic.store offset=16 (local.get $rec) (local.get $g0))
          (i32.atomic.store offset=20 (local.get $rec) (local.get $g1))
          (i32.atomic.store offset=24 (local.get $rec) (local.get $g2))
          (i32.atomic.store offset=28 (local.get $rec) (local.get $g3))
          (drop (call $device_notify_write_audio_payload (local.get $slot)))
          ;; Publish only after filter and event payload are complete.
          (i32.atomic.store (local.get $rec) (local.get $handle))
          (return (local.get $handle))))
      (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  (func $handle_RegisterDeviceNotificationW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $handle i32)
    (local $g0 i32) (local $g1 i32) (local $g2 i32) (local $g3 i32)
    ;; DEVICE_NOTIFY_SERVICE_HANDLE and future flag bits are not modeled.  The
    ;; documented ALL_INTERFACE_CLASSES bit is valid only with this supported
    ;; DEVICEINTERFACE filter type.
    (if (i32.or
          (i32.eqz (call $window_handle_valid (local.get $arg0)))
          (i32.ne (i32.and (local.get $arg2) (i32.const 0xFFFFFFFB))
                  (i32.const 0)))
      (then
        (global.set $last_error
          (select (i32.const 1400) (i32.const 87)
            (i32.eqz (call $window_handle_valid (local.get $arg0)))))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (if (i32.eqz (call $device_notify_filter_span_valid (local.get $arg1)))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (if (i32.or
          (i32.lt_u (call $gl32 (local.get $arg1)) (i32.const 32))
          (i32.ne (call $gl32 (i32.add (local.get $arg1) (i32.const 4)))
                  (i32.const 5)))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (local.set $g0 (call $gl32 (i32.add (local.get $arg1) (i32.const 12))))
    (local.set $g1 (call $gl32 (i32.add (local.get $arg1) (i32.const 16))))
    (local.set $g2 (call $gl32 (i32.add (local.get $arg1) (i32.const 20))))
    (local.set $g3 (call $gl32 (i32.add (local.get $arg1) (i32.const 24))))
    (local.set $handle
      (call $device_notify_allocate_record
        (local.get $arg0) (local.get $arg2)
        (local.get $g0) (local.get $g1) (local.get $g2) (local.get $g3)))
    (if (i32.eqz (local.get $handle))
      (then (global.set $last_error (i32.const 8)))) ;; ERROR_NOT_ENOUGH_MEMORY
    (i32.store offset=0 (global.get $reg_base) (local.get $handle))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  (func $handle_UnregisterDeviceNotification (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $rec i32)
    (local.set $rec (call $device_notify_record_from_handle (local.get $arg0)))
    (if (i32.eqz (local.get $rec))
      (then
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (if (i32.ne
          (i32.atomic.rmw.cmpxchg (local.get $rec)
            (local.get $arg0) (i32.const -1))
          (local.get $arg0))
      (then
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (i32.atomic.store offset=8 (local.get $rec) (i32.const 0))
    (i32.atomic.store offset=12 (local.get $rec) (i32.const 0))
    (i32.atomic.store offset=16 (local.get $rec) (i32.const 0))
    (i32.atomic.store offset=20 (local.get $rec) (i32.const 0))
    (i32.atomic.store offset=24 (local.get $rec) (i32.const 0))
    (i32.atomic.store offset=28 (local.get $rec) (i32.const 0))
    ;; Do not clear the guest-visible payload: a WM_DEVICECHANGE already in a
    ;; thread queue keeps its lParam valid even if another thread unregisters
    ;; before the recipient pumps that message. Slot reuse rewrites the same
    ;; fixed KSCATEGORY_AUDIO payload before publishing the next generation.
    (i32.atomic.store (local.get $rec) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; Browser host bridge for audio input/output topology changes.  event is a
  ;; documented WM_DEVICECHANGE wParam (DBT_DEVICEARRIVAL or
  ;; DBT_DEVICEREMOVECOMPLETE).  Return the number of recipient queues that
  ;; accepted the message; callers do not synthesize an initial arrival.
  (func $device_notify_broadcast_audio (param $event i32) (result i32)
    (local $slot i32) (local $rec i32) (local $handle i32)
    (local $flags i32) (local $matches i32) (local $posted i32)
    (if (i32.and
          (i32.ne (local.get $event) (i32.const 0x8000))
          (i32.ne (local.get $event) (i32.const 0x8004)))
      (then (return (i32.const 0))))
    (block $done (loop $scan
      (br_if $done
        (i32.ge_u (local.get $slot) (global.get $DEVICE_NOTIFY_RECORD_COUNT)))
      (local.set $rec (call $device_notify_record_addr (local.get $slot)))
      (local.set $handle (i32.atomic.load (local.get $rec)))
      (if (i32.and
            (i32.ne (local.get $handle) (i32.const 0))
            (i32.ne (local.get $handle) (i32.const -1)))
        (then
          (local.set $flags (i32.atomic.load offset=12 (local.get $rec)))
          (local.set $matches
            (i32.or
              (i32.ne (i32.and (local.get $flags) (i32.const 4)) (i32.const 0))
              (i32.and
                (i32.eq (i32.atomic.load offset=16 (local.get $rec))
                        (i32.const 0x6994AD04))
                (i32.and
                  (i32.eq (i32.atomic.load offset=20 (local.get $rec))
                          (i32.const 0x11D093EF))
                  (i32.and
                    (i32.eq (i32.atomic.load offset=24 (local.get $rec))
                            (i32.const 0xA000CCA3))
                    (i32.eq (i32.atomic.load offset=28 (local.get $rec))
                            (i32.const 0x963122C9)))))))
          (if (i32.and
                (i32.ne (local.get $matches) (i32.const 0))
                (i32.eq (i32.atomic.load (local.get $rec)) (local.get $handle)))
            (then
              (local.set $posted
                (i32.add (local.get $posted)
                  (call $post_queue_push
                    (i32.atomic.load offset=8 (local.get $rec))
                    (i32.const 0x0219) ;; WM_DEVICECHANGE
                    (local.get $event)
                    (call $device_notify_write_audio_payload (local.get $slot)))))))))
      (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
      (br $scan)))
    (local.get $posted))

  ;; 826: mixerGetNumDevs() -> UINT
  (func $handle_mixerGetNumDevs (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4))))

  ;; 827: CreateConsoleScreenBuffer(dwDesiredAccess, dwShareMode, lpSecurityAttributes, dwFlags, lpScreenBufferData) → HANDLE
  ;; Create a distinct text-mode output buffer. The record and its cells live
  ;; in shared linear memory, so browser Workers observe the same handle state.
  (func $handle_CreateConsoleScreenBuffer (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.or (i32.ne (local.get $arg3) (i32.const 1)) ;; CONSOLE_TEXTMODE_BUFFER
          (i32.ne (local.get $arg4) (i32.const 0)))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (i32.store offset=0 (global.get $reg_base) (i32.const 0xFFFFFFFF)))
      (else
        (i32.store offset=0 (global.get $reg_base) (call $console_buffer_create))
        (if (i32.eq (i32.load offset=0 (global.get $reg_base)) (i32.const 0xFFFFFFFF))
          (then (global.set $last_error (i32.const 8))) ;; ERROR_NOT_ENOUGH_MEMORY
          (else (global.set $last_error (i32.const 0))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  ;; 821: mixerGetID(hmxobj, puMxId, fdwId) -> MMRESULT
  (func $handle_mixerGetID (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg1)
      (then (i32.store (call $g2w (local.get $arg1)) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; 822: CreateDialogParamW(hInstance, lpTemplateName, hWndParent, lpDialogFunc, dwInitParam)
  ;; RT_DIALOG templates have the same binary layout for A/W callers. Reuse
  ;; the A path so W dialogs get the same WAT-side registration, auto-show, and
  ;; seeded painting behavior. UTF-16 template-name strings remain limited by
  ;; the shared $find_resource implementation, which primarily handles int IDs.
  (func $handle_CreateDialogParamW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $hwnd i32)
    (local.set $hwnd (global.get $next_hwnd))
    (call $handle_CreateDialogParamA
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
    (call $wnd_unicode_set (local.get $hwnd) (i32.const 1)))


  ;; SHLWAPI PathGetCharType: Win98 native 5.x DLL exports #485/#486.
  ;; Character classification only, not full filename validation. In particular
  ;; '+' '=' '[' ']' and high characters retain SHORTCHAR in this adapter.
  (func $path_get_char_type (param $ch i32) (result i32)
    (if (i32.or (i32.le_u (local.get $ch) (i32.const 31))
          (i32.or (i32.eq (local.get $ch) (i32.const 34))
            (i32.or (i32.eq (local.get $ch) (i32.const 60))
              (i32.or (i32.eq (local.get $ch) (i32.const 62))
                (i32.eq (local.get $ch) (i32.const 124))))))
      (then (return (i32.const 0))))
    (if (i32.or (i32.eq (local.get $ch) (i32.const 42))
          (i32.eq (local.get $ch) (i32.const 63)))
      (then (return (i32.const 4))))
    (if (i32.or (i32.eq (local.get $ch) (i32.const 47))
          (i32.or (i32.eq (local.get $ch) (i32.const 58))
            (i32.eq (local.get $ch) (i32.const 92))))
      (then (return (i32.const 8))))
    (if (i32.or (i32.eq (local.get $ch) (i32.const 32))
          (i32.or (i32.eq (local.get $ch) (i32.const 44))
            (i32.eq (local.get $ch) (i32.const 59))))
      (then (return (i32.const 1))))
    (i32.const 3))

  (func $handle_PathGetCharTypeA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $path_get_char_type (i32.and (local.get $arg0) (i32.const 255))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_PathGetCharTypeW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $path_get_char_type (i32.and (local.get $arg0) (i32.const 65535))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; 820: PathGetArgsA(pszPath) → pointer to args after first unquoted space
  (func $handle_PathGetArgsA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $base i32) (local $ptr i32) (local $ch i32) (local $in_quote i32)
    (local.set $base (call $g2w (local.get $arg0)))
    (local.set $ptr (local.get $base))
    (block $done (loop $scan
      (local.set $ch (i32.load8_u (local.get $ptr)))
      (br_if $done (i32.eqz (local.get $ch)))
      (if (i32.eq (local.get $ch) (i32.const 0x22))  ;; quote
        (then (local.set $in_quote (i32.xor (local.get $in_quote) (i32.const 1)))))
      (if (i32.and (i32.eq (local.get $ch) (i32.const 0x20)) (i32.eqz (local.get $in_quote)))
        (then
          ;; Skip spaces
          (local.set $ptr (i32.add (local.get $ptr) (i32.const 1)))
          (block $end_sp (loop $sp
            (br_if $end_sp (i32.ne (i32.load8_u (local.get $ptr)) (i32.const 0x20)))
            (local.set $ptr (i32.add (local.get $ptr) (i32.const 1)))
            (br $sp)))
          (i32.store offset=0 (global.get $reg_base) (i32.add (i32.sub (local.get $ptr) (local.get $base)) (local.get $arg0)))
          (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))) (return)))
      (local.set $ptr (i32.add (local.get $ptr) (i32.const 1)))
      (br $scan)))
    ;; No args found, return pointer to NUL terminator
    (i32.store offset=0 (global.get $reg_base) (i32.add (i32.sub (local.get $ptr) (local.get $base)) (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; 818: FindResourceExA(hModule, lpType, lpName, wLanguage) → HRSRC
  ;; Same as FindResourceA but with explicit language (we use first lang match)
  (func $handle_FindResourceExA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; FindResourceExA: arg1=type, arg2=name (reversed from FindResourceA)
    (call $push_rsrc_ctx (local.get $arg0))
    (i32.store offset=0 (global.get $reg_base) (call $find_resource (local.get $arg1) (local.get $arg2)))
    (call $pop_rsrc_ctx)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; 819: StrChrA(lpStart, wMatch) → pointer to first occurrence or NULL
  (func $handle_StrChrA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $base i32) (local $ptr i32) (local $ch i32)
    (local.set $base (call $g2w (local.get $arg0)))
    (local.set $ptr (local.get $base))
    (block $not_found (loop $scan
      (local.set $ch (i32.load8_u (local.get $ptr)))
      (br_if $not_found (i32.eqz (local.get $ch)))
      (if (i32.eq (local.get $ch) (i32.and (local.get $arg1) (i32.const 0xFF)))
        (then
          (i32.store offset=0 (global.get $reg_base) (i32.add (i32.sub (local.get $ptr) (local.get $base)) (local.get $arg0)))
          (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))) (return)))
      (local.set $ptr (i32.add (local.get $ptr) (i32.const 1)))
      (br $scan)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; GetNumberFormatA(Locale, dwFlags, lpValue, lpFormat, lpNumberStr,
  ;; cchNumber). The default-locale form accepts an invariant numeric string
  ;; and, for the en-US Win98 personality, preserves its existing decimal
  ;; spelling. This is also the form used by the Jazz Jackrabbit 2 installer.
  ;; Keep the size-query and bounded-copy behavior exact: successful return
  ;; values include the terminating NUL and a short destination is untouched.
  ;; A caller-supplied NUMBERFMTA requests locale-aware regrouping/rounding we
  ;; do not yet implement, so fail it explicitly instead of silently returning
  ;; a plausibly formatted but wrong number.
  (func $handle_GetNumberFormatA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $cch i32) (local $required i32) (local $value_wa i32)
    (local.set $cch (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (if (i32.eqz (local.get $arg2))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
        (return)))
    (if (local.get $arg3)
      (then
        (global.set $last_error (i32.const 120)) ;; ERROR_CALL_NOT_IMPLEMENTED
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
        (return)))
    (local.set $value_wa (call $g2w (local.get $arg2)))
    (local.set $required
      (i32.add (call $strlen_a (local.get $value_wa)) (i32.const 1)))
    (if (i32.eqz (local.get $cch))
      (then (i32.store offset=0 (global.get $reg_base) (local.get $required)))
      (else
        (if (i32.or
              (i32.eqz (local.get $arg4))
              (i32.lt_u (local.get $cch) (local.get $required)))
          (then (global.set $last_error (i32.const 122))) ;; ERROR_INSUFFICIENT_BUFFER
          (else
            (call $memcpy
              (call $g2w (local.get $arg4))
              (local.get $value_wa)
              (local.get $required))
            (i32.store offset=0 (global.get $reg_base) (local.get $required))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))

  ;; GetFileSecurityA(lpFileName, RequestedInformation, pSecurityDescriptor,
  ;; nLength, lpnLengthNeeded) — 5 args stdcall.
  ;;
  ;; This is a Windows NT API. On the Windows 98 we emulate there is no
  ;; security descriptor on a file at all, and ADVAPI32 answers every call
  ;; with FALSE / ERROR_CALL_NOT_IMPLEMENTED — which is exactly what MFC's
  ;; CFile save-with-backup path expects to see before it skips the ACL copy.
  ;; The export still has to exist: MSPaint reaches it through GetProcAddress,
  ;; and a NULL there turned into RaiseException 0xC06D007F + ExitProcess in
  ;; the middle of File > Save (mfc42 6.00).
  (func $handle_GetFileSecurityA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $file_security_not_supported (local.get $arg4))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  (func $handle_GetFileSecurityW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; Win98 rejects both encodings before inspecting lpFileName, so the
    ;; five-argument ABI and all failure outputs are exactly the ANSI path.
    (call $handle_GetFileSecurityA
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)
      (local.get $arg4) (local.get $name_ptr)))

  ;; CommandLineToArgvW — already handled above as crash stub replacement

  ;; _MyGetFreeSystemResources32@4(dwResType) — 1 arg stdcall, RSRC32.DLL.
  ;;
  ;; The number behind Resource Meter (rsrcmtr.exe) and the Win98 System
  ;; Monitor "System Resources" readout: a percentage, 0..100, of the free
  ;; space in the 16-bit GDI and USER local heaps. dwResType selects which
  ;; heap: 0 = system (Windows reports the lower of the two), 1 = GDI,
  ;; 2 = USER.
  ;;
  ;; We have no 64KB local heaps, but we do have the two fixed-size tables
  ;; those heaps stood for, so report the free share of them. The value then
  ;; moves for the same reason the real one did — objects and windows being
  ;; created and destroyed — instead of being a frozen constant that makes
  ;; every bar in Resource Meter look identical.
  (func $handle__MyGetFreeSystemResources32@4 (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $i i32) (local $used i32) (local $gdi i32) (local $user i32)
    ;; GDI: free share of the GDI object table.
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $GDI_OBJECT_COUNT)))
      (if (i32.load (i32.add (global.get $GDI_OBJECT_TABLE)
            (i32.mul (local.get $i) (global.get $GDI_OBJECT_STRIDE))))
        (then (local.set $used (i32.add (local.get $used) (i32.const 1)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (local.set $gdi (i32.div_u
      (i32.mul (i32.sub (global.get $GDI_OBJECT_COUNT) (local.get $used))
               (i32.const 100))
      (global.get $GDI_OBJECT_COUNT)))
    ;; USER: free share of the window table.
    (local.set $i (i32.const 0))
    (local.set $used (i32.const 0))
    (block $done2 (loop $scan2
      (br_if $done2 (i32.ge_u (local.get $i) (global.get $MAX_WINDOWS)))
      (if (call $wnd_slot_hwnd (local.get $i))
        (then (local.set $used (i32.add (local.get $used) (i32.const 1)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan2)))
    (local.set $user (i32.div_u
      (i32.mul (i32.sub (global.get $MAX_WINDOWS) (local.get $used))
               (i32.const 100))
      (global.get $MAX_WINDOWS)))
    (i32.store offset=0 (global.get $reg_base) (if (result i32) (i32.eq (local.get $arg0) (i32.const 1))
        (then (local.get $gdi))
        (else (if (result i32) (i32.eq (local.get $arg0) (i32.const 2))
          (then (local.get $user))
          (else (select (local.get $gdi) (local.get $user)
                        (i32.lt_u (local.get $gdi) (local.get $user))))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; Complete a mapping immediately, or park an async provider-backed view
  ;; with its original stdcall frame intact and retry it after the host fill.
  (func $handle_map_view_complete (param $error i32) (param $unpop i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (local.get $unpop)))
    (if (local.get $error)
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (if (i32.eq (local.get $error) (i32.const 997))
          (then (call $io_block (local.get $unpop)))
          (else (global.set $last_error (local.get $error)))))))

  ;; ============================================================
  ;; I/O completion ports
  ;; ============================================================
  ;; Warcraft III runs its job system on one: the main thread creates a port
  ;; with no file attached, posts work to it, and 2*NumberOfProcessors worker
  ;; threads block in GetQueuedCompletionStatus. That is a plain concurrent
  ;; queue, which is what this implements. Ports attached to a file handle are
  ;; a different feature -- they need overlapped file I/O to complete into the
  ;; queue, and nothing here does that -- so those fail loudly instead of
  ;; handing back a port nothing will ever post to.
  ;;
  ;; Layout: eight 16-byte headers {handle, head, tail, count} followed by
  ;; eight 256-entry queues of {bytes, key, OVERLAPPED*}.
  (global $IOCP_MAX_PORTS i32 (i32.const 8))
  (global $IOCP_QUEUE_CAP i32 (i32.const 256))
  ;; A port handle is its slot, tagged so it cannot be confused with the
  ;; ThreadManager's synchronization handles or a VFS file handle.
  (global $IOCP_HANDLE_TAG i32 (i32.const 0x1C0C0000))

  (func $iocp_header (param $idx i32) (result i32)
    (i32.add (global.get $IOCP_TABLE) (i32.mul (local.get $idx) (i32.const 16))))

  (func $iocp_queue (param $idx i32) (result i32)
    (i32.add (global.get $IOCP_TABLE)
      (i32.add (i32.const 128)
        (i32.mul (local.get $idx)
          (i32.mul (global.get $IOCP_QUEUE_CAP) (i32.const 12))))))

  ;; Slot index for a port handle, or -1 when the handle names no live port.
  (func $iocp_slot (param $handle i32) (result i32)
    (local $idx i32)
    (if (i32.ne (i32.and (local.get $handle) (i32.const 0xFFFF0000))
                (global.get $IOCP_HANDLE_TAG))
      (then (return (i32.const -1))))
    (local.set $idx (i32.and (local.get $handle) (i32.const 0xFFFF)))
    (if (i32.ge_u (local.get $idx) (global.get $IOCP_MAX_PORTS))
      (then (return (i32.const -1))))
    (if (i32.ne (i32.load (call $iocp_header (local.get $idx))) (local.get $handle))
      (then (return (i32.const -1))))
    (local.get $idx))

  (func $iocp_create (result i32)
    (local $idx i32) (local $hdr i32) (local $handle i32)
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $idx) (global.get $IOCP_MAX_PORTS)))
      (if (i32.eqz (i32.load (call $iocp_header (local.get $idx))))
        (then
          (local.set $hdr (call $iocp_header (local.get $idx)))
          (local.set $handle (i32.or (global.get $IOCP_HANDLE_TAG) (local.get $idx)))
          (i32.store (i32.add (local.get $hdr) (i32.const 4)) (i32.const 0))
          (i32.store (i32.add (local.get $hdr) (i32.const 8)) (i32.const 0))
          (i32.store (i32.add (local.get $hdr) (i32.const 12)) (i32.const 0))
          (i32.store (local.get $hdr) (local.get $handle))
          (return (local.get $handle))))
      (local.set $idx (i32.add (local.get $idx) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  ;; Close a port handle. Returns 1 when this was a port, 0 when it was not,
  ;; so CloseHandle can go on to try the other handle namespaces.
  (func $iocp_close (param $handle i32) (result i32)
    (local $idx i32)
    (local.set $idx (call $iocp_slot (local.get $handle)))
    (if (i32.lt_s (local.get $idx) (i32.const 0))
      (then (return (i32.const 0))))
    (i32.store (call $iocp_header (local.get $idx)) (i32.const 0))
    (i32.const 1))

  (func $iocp_push (param $idx i32) (param $bytes i32) (param $key i32)
      (param $overlapped i32) (result i32)
    (local $hdr i32) (local $tail i32) (local $queue_entry i32)
    (local.set $hdr (call $iocp_header (local.get $idx)))
    (if (i32.ge_u (i32.load (i32.add (local.get $hdr) (i32.const 12)))
                  (global.get $IOCP_QUEUE_CAP))
      (then (return (i32.const 0))))
    (local.set $tail (i32.load (i32.add (local.get $hdr) (i32.const 8))))
    (local.set $queue_entry (i32.add (call $iocp_queue (local.get $idx))
      (i32.mul (local.get $tail) (i32.const 12))))
    (i32.store (local.get $queue_entry) (local.get $bytes))
    (i32.store (i32.add (local.get $queue_entry) (i32.const 4)) (local.get $key))
    (i32.store (i32.add (local.get $queue_entry) (i32.const 8)) (local.get $overlapped))
    (i32.store (i32.add (local.get $hdr) (i32.const 8))
      (i32.rem_u (i32.add (local.get $tail) (i32.const 1)) (global.get $IOCP_QUEUE_CAP)))
    (i32.store (i32.add (local.get $hdr) (i32.const 12))
      (i32.add (i32.load (i32.add (local.get $hdr) (i32.const 12))) (i32.const 1)))
    (i32.const 1))

  ;; ---- file-handle associations ------------------------------------------
  ;; A port with a file attached is the other half of the feature, and
  ;; Warcraft III needs it: its asynchronous file layer binds each open file to
  ;; the job port with CompletionKey = the file object, then submits reads and
  ;; writes with an OVERLAPPED and waits for the completion to come back
  ;; through GetQueuedCompletionStatus. Measured at 0x00418522
  ;;
  ;;   00418514  mov eax,[esi+0x6c]         ; the file handle
  ;;   00418517  push 0 / push esi / push edx / push eax
  ;;   00418522  call [0x00444214]          ; CreateIoCompletionPort
  ;;
  ;; and its submit side one function later at 0x00418603, WriteFile with
  ;; lpNumberOfBytesWritten = NULL and lpOverlapped = edi+8, testing
  ;; GetLastError() == 997 for the pending case. Refusing the association was
  ;; a deadlock, not a safety net: runDA had the main thread parked forever in
  ;; WaitForSingleObject at 0x00403440 and two worker threads parked forever in
  ;; GetQueuedCompletionStatus on a port whose count never left zero.
  ;;
  ;; Our file I/O is synchronous, so an overlapped request is served in place
  ;; and its completion is pushed onto the port before the call returns. The
  ;; guest cannot tell that apart from a very fast device: it gets FALSE plus
  ;; ERROR_IO_PENDING, and the completion is already queued for whichever
  ;; thread reaches GetQueuedCompletionStatus first.
  ;;
  ;; The table lives in the tail of $IOCP_TABLE, after the eight headers (128
  ;; bytes) and the eight 256-entry queues (8*256*12 = 24576), so it starts at
  ;; 24704 and its 64 twelve-byte entries end at 25472, inside the region's
  ;; 0x8000. Entry: {fileHandle, portSlot+1, completionKey}; a zero slot field
  ;; is a free entry, which is why the slot is stored biased by one.
  (global $IOCP_ASSOC_OFF i32 (i32.const 24704))
  (global $IOCP_ASSOC_MAX i32 (i32.const 64))

  (func $iocp_assoc_entry (param $i i32) (result i32)
    (i32.add (global.get $IOCP_TABLE)
      (i32.add (global.get $IOCP_ASSOC_OFF) (i32.mul (local.get $i) (i32.const 12)))))

  ;; The entry for a file handle, or 0 when that handle is bound to no port.
  (func $iocp_assoc_find (param $handle i32) (result i32)
    (local $i i32) (local $e i32)
    (if (i32.eqz (local.get $handle)) (then (return (i32.const 0))))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $IOCP_ASSOC_MAX)))
      (local.set $e (call $iocp_assoc_entry (local.get $i)))
      (if (i32.and
            (i32.ne (i32.load (i32.add (local.get $e) (i32.const 4))) (i32.const 0))
            (i32.eq (i32.load (local.get $e)) (local.get $handle)))
        (then (return (local.get $e))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  ;; Bind a file handle to a port slot. Re-binding an already-bound handle
  ;; overwrites its key, which is what a second CreateIoCompletionPort on the
  ;; same file means.
  (func $iocp_assoc_add (param $handle i32) (param $idx i32) (param $key i32) (result i32)
    (local $i i32) (local $e i32)
    (local.set $e (call $iocp_assoc_find (local.get $handle)))
    (if (i32.eqz (local.get $e))
      (then
        (block $done (loop $scan
          (br_if $done (i32.ge_u (local.get $i) (global.get $IOCP_ASSOC_MAX)))
          (if (i32.eqz (i32.load (i32.add (call $iocp_assoc_entry (local.get $i)) (i32.const 4))))
            (then
              (local.set $e (call $iocp_assoc_entry (local.get $i)))
              (br $done)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $scan)))))
    (if (i32.eqz (local.get $e)) (then (return (i32.const 0))))
    (i32.store (local.get $e) (local.get $handle))
    (i32.store (i32.add (local.get $e) (i32.const 4)) (i32.add (local.get $idx) (i32.const 1)))
    (i32.store (i32.add (local.get $e) (i32.const 8)) (local.get $key))
    (i32.const 1))

  ;; Release a file handle's binding. Safe to call for any handle, so
  ;; CloseHandle can call it without first asking whether it was ever bound.
  (func $iocp_assoc_drop (param $handle i32)
    (local $e i32)
    (local.set $e (call $iocp_assoc_find (local.get $handle)))
    (if (local.get $e)
      (then (i32.store (i32.add (local.get $e) (i32.const 4)) (i32.const 0)))))

  ;; Finish one overlapped request on a bound file handle: publish the byte
  ;; count into the OVERLAPPED the guest supplied and queue the completion.
  ;; Returns 1 when a completion was queued, 0 when this handle is bound to no
  ;; port (in which case the caller must complete the call synchronously, as
  ;; Win32 does for a file opened without FILE_FLAG_OVERLAPPED).
  ;;
  ;; $status is the NTSTATUS written to OVERLAPPED.Internal: 0 for success,
  ;; 0xC0000011 (STATUS_END_OF_FILE) for a short read at EOF.
  (func $iocp_complete_overlapped (param $handle i32) (param $overlapped i32)
      (param $bytes i32) (param $status i32) (result i32)
    (local $e i32) (local $idx i32)
    (local.set $e (call $iocp_assoc_find (local.get $handle)))
    (if (i32.eqz (local.get $e)) (then (return (i32.const 0))))
    (local.set $idx (i32.sub (i32.load (i32.add (local.get $e) (i32.const 4))) (i32.const 1)))
    ;; The port may have been closed while a file stayed bound to it.
    (if (i32.ne (i32.load (call $iocp_header (local.get $idx)))
                (i32.or (global.get $IOCP_HANDLE_TAG) (local.get $idx)))
      (then
        (i32.store (i32.add (local.get $e) (i32.const 4)) (i32.const 0))
        (return (i32.const 0))))
    (if (local.get $overlapped)
      (then
        (call $gs32 (local.get $overlapped) (local.get $status))
        (call $gs32 (i32.add (local.get $overlapped) (i32.const 4)) (local.get $bytes))))
    (drop (call $iocp_push (local.get $idx) (local.get $bytes)
      (i32.load (i32.add (local.get $e) (i32.const 8))) (local.get $overlapped)))
    (i32.const 1))

  ;; CreateIoCompletionPort(FileHandle, ExistingCompletionPort, CompletionKey,
  ;;                        NumberOfConcurrentThreads) -> HANDLE
  (func $handle_CreateIoCompletionPort (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $idx i32)
    (if (i32.eq (local.get $arg0) (i32.const -1))
      (then
        ;; INVALID_HANDLE_VALUE with an existing port is the one combination
        ;; Win32 itself rejects: there is nothing to attach.
        (if (local.get $arg1)
          (then
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
            (return)))
        (i32.store offset=0 (global.get $reg_base) (call $iocp_create))
        (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
          (then (global.set $last_error (i32.const 8)))) ;; ERROR_NOT_ENOUGH_MEMORY
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    ;; Attaching a file. Without an existing port the call creates one and
    ;; attaches to it in a single step.
    (local.set $idx (i32.const -1))
    (if (local.get $arg1)
      (then (local.set $idx (call $iocp_slot (local.get $arg1))))
      (else
        (i32.store offset=0 (global.get $reg_base) (call $iocp_create))
        (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
          (then
            (global.set $last_error (i32.const 8))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
            (return)))
        (local.set $arg1 (i32.load offset=0 (global.get $reg_base)))
        (local.set $idx (call $iocp_slot (local.get $arg1)))))
    (if (i32.lt_s (local.get $idx) (i32.const 0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (if (call $iocp_assoc_add (local.get $arg0) (local.get $idx) (local.get $arg2))
      (then (i32.store offset=0 (global.get $reg_base) (local.get $arg1)))
      (else
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (global.set $last_error (i32.const 8)))) ;; ERROR_NOT_ENOUGH_MEMORY
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; PostQueuedCompletionStatus(port, bytes, key, lpOverlapped) -> BOOL
  (func $handle_PostQueuedCompletionStatus (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $idx i32)
    (local.set $idx (call $iocp_slot (local.get $arg0)))
    (if (i32.lt_s (local.get $idx) (i32.const 0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
        (return)))
    (i32.store offset=0 (global.get $reg_base) (call $iocp_push (local.get $idx)
      (local.get $arg1) (local.get $arg2) (local.get $arg3)))
    (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
      (then (global.set $last_error (i32.const 298)))) ;; ERROR_TOO_MANY_POSTS
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; GetQueuedCompletionStatus(port, lpBytes, lpKey, lpOverlapped, dwMilliseconds)
  ;; -> BOOL. An empty queue parks the calling thread on its own import thunk
  ;; (the $cs_block pattern) so other guest threads run and can post; the call
  ;; re-enters from the top when this thread is scheduled again.
  (func $handle_GetQueuedCompletionStatus (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $idx i32) (local $hdr i32) (local $head i32) (local $queue_entry i32)
    (local $now i32)
    (local.set $idx (call $iocp_slot (local.get $arg0)))
    (if (i32.lt_s (local.get $idx) (i32.const 0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (return)))
    (local.set $hdr (call $iocp_header (local.get $idx)))
    (if (i32.eqz (i32.load (i32.add (local.get $hdr) (i32.const 12))))
      (then
        ;; Nothing queued. A zero timeout is an immediate poll.
        (if (i32.eqz (local.get $arg4))
          (then
            (global.set $iocp_wait_port (i32.const 0))
            (call $iocp_fail_empty (local.get $arg1) (local.get $arg2) (local.get $arg3))
            (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
            (return)))
        (if (i32.ne (local.get $arg4) (i32.const -1))
          (then
            (local.set $now (call $host_get_ticks))
            ;; First park of this bounded wait: start its clock. Later ones
            ;; compare against the deadline that park recorded.
            (if (i32.ne (global.get $iocp_wait_port) (local.get $arg0))
              (then
                (global.set $iocp_wait_port (local.get $arg0))
                (global.set $iocp_wait_deadline
                  (i32.add (local.get $now) (local.get $arg4))))
              (else
                (if (i32.ge_u (local.get $now) (global.get $iocp_wait_deadline))
                  (then
                    (global.set $iocp_wait_port (i32.const 0))
                    (call $iocp_fail_empty
                      (local.get $arg1) (local.get $arg2) (local.get $arg3))
                    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
                    (return)))))))
        (call $iocp_block)
        (return)))
    ;; A completion is available: this call owns its frame again.
    (global.set $handler_set_eip (i32.const 0))
    (global.set $iocp_wait_port (i32.const 0))
    (local.set $head (i32.load (i32.add (local.get $hdr) (i32.const 4))))
    (local.set $queue_entry (i32.add (call $iocp_queue (local.get $idx))
      (i32.mul (local.get $head) (i32.const 12))))
    (if (local.get $arg1)
      (then (call $gs32 (local.get $arg1) (i32.load (local.get $queue_entry)))))
    (if (local.get $arg2)
      (then (call $gs32 (local.get $arg2)
        (i32.load (i32.add (local.get $queue_entry) (i32.const 4))))))
    (if (local.get $arg3)
      (then (call $gs32 (local.get $arg3)
        (i32.load (i32.add (local.get $queue_entry) (i32.const 8))))))
    (i32.store (i32.add (local.get $hdr) (i32.const 4))
      (i32.rem_u (i32.add (local.get $head) (i32.const 1)) (global.get $IOCP_QUEUE_CAP)))
    (i32.store (i32.add (local.get $hdr) (i32.const 12))
      (i32.sub (i32.load (i32.add (local.get $hdr) (i32.const 12))) (i32.const 1)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))

  ;; A dequeue that found nothing: WAIT_TIMEOUT with the out parameters
  ;; cleared, which is what a caller checks before touching lpOverlapped.
  (func $iocp_fail_empty (param $pbytes i32) (param $pkey i32) (param $poverlapped i32)
    (global.set $handler_set_eip (i32.const 0))
    (if (local.get $pbytes) (then (call $gs32 (local.get $pbytes) (i32.const 0))))
    (if (local.get $pkey) (then (call $gs32 (local.get $pkey) (i32.const 0))))
    (if (local.get $poverlapped)
      (then (call $gs32 (local.get $poverlapped) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (global.set $last_error (i32.const 258))) ;; WAIT_TIMEOUT

  ;; Park on the import thunk without consuming the stdcall frame, exactly as
  ;; $cs_block and $console_input_block do. ESP must not move: the re-entry
  ;; finds its own arguments where the call left them.
  (func $iocp_block
    (if (global.get $current_thunk_eip)
      (then (global.set $eip (global.get $current_thunk_eip))))
    (global.set $handler_set_eip (i32.const 1))
    (global.set $yield_reason (i32.const 9))
    (global.set $yield_flag (i32.const 1))
    (global.set $steps (i32.const 0)))
