  ;; ============================================================
  ;; COMCTL32 Common Controls handlers
  ;; ============================================================

;; StrToIntA(lpSrc) — 1 arg, returns integer value
  (func $handle_StrToIntA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ptr i32) (local $result i32) (local $neg i32) (local $ch i32)
    (local.set $ptr (call $g2w (local.get $arg0)))
    (local.set $result (i32.const 0))
    (local.set $neg (i32.const 0))
    ;; Skip leading whitespace
    (block $ws_done (loop $ws
      (local.set $ch (i32.load8_u (local.get $ptr)))
      (br_if $ws_done (i32.ne (local.get $ch) (i32.const 0x20))) ;; space
      (local.set $ptr (i32.add (local.get $ptr) (i32.const 1)))
      (br $ws)))
    ;; Check for sign
    (if (i32.eq (i32.load8_u (local.get $ptr)) (i32.const 0x2D)) ;; '-'
      (then (local.set $neg (i32.const 1))
            (local.set $ptr (i32.add (local.get $ptr) (i32.const 1)))))
    (if (i32.eq (i32.load8_u (local.get $ptr)) (i32.const 0x2B)) ;; '+'
      (then (local.set $ptr (i32.add (local.get $ptr) (i32.const 1)))))
    ;; Parse digits
    (block $done (loop $digits
      (local.set $ch (i32.load8_u (local.get $ptr)))
      (br_if $done (i32.lt_u (local.get $ch) (i32.const 0x30)))
      (br_if $done (i32.gt_u (local.get $ch) (i32.const 0x39)))
      (local.set $result (i32.add (i32.mul (local.get $result) (i32.const 10))
        (i32.sub (local.get $ch) (i32.const 0x30))))
      (local.set $ptr (i32.add (local.get $ptr) (i32.const 1)))
      (br $digits)))
    (if (local.get $neg)
      (then (local.set $result (i32.sub (i32.const 0) (local.get $result)))))
    (i32.store offset=0 (global.get $reg_base) (local.get $result))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; Winsock handlers (socket, bind, listen, accept, connect, send, recv,
  ;; select, shutdown, ioctlsocket, setsockopt, the byte-order and address
  ;; helpers, and the WSA* lifecycle) live in 09d-winsock.wat, which owns
  ;; the virtual LAN socket switch described in docs/virtual-lan-party.md.

  ;; 921: SetWindowRgn(hwnd, hRgn, bRedraw) — 3 args stdcall
  (func $handle_SetWindowRgn (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $rect i32) (local $w i32) (local $h i32)
    (if (i32.eq (call $wnd_table_find (local.get $arg0)) (i32.const -1))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    (if (i32.and
          (i32.ne (local.get $arg1) (i32.const 0))
          (i32.eqz (call $gdi_rgn_record (local.get $arg1))))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
        (return)))
    ;; This is the only consumer of the JS-side region mirror, so it is the
    ;; place that pays for it. Regions do not push their bands across on
    ;; creation any more (see $gdi_rgn_sync_mirror in 10-helpers.wat); prime
    ;; this one now, and from here on its mutations propagate.
    (if (local.get $arg1)
      (then (drop (call $gdi_rgn_mirror_ensure (local.get $arg1)))))
    (i32.store offset=0 (global.get $reg_base) (call $host_gdi_set_window_rgn
      (local.get $arg0) (call $gdi_rgn_host_handle (local.get $arg1)) (local.get $arg2)))
    (if (i32.load offset=0 (global.get $reg_base))
      (then
        (call $wnd_region_set
          (local.get $arg0)
          (local.get $arg1))
        ;; Regioned skin windows draw and route input over the whole shaped
        ;; surface. Keep WAT client-origin exports aligned with that surface.
        (if (local.get $arg1)
          (then
            (local.set $rect (call $paint_scratch_take))
            (call $host_get_window_rect (local.get $arg0) (local.get $rect))
            (local.set $w (i32.sub
              (load.field.memarg PaintRect right (local.get $rect))
              (load.field PaintRect left (local.get $rect))))
            (local.set $h (i32.sub
              (load.field.memarg PaintRect bottom (local.get $rect))
              (load.field.memarg PaintRect top (local.get $rect))))
            (if (i32.and
                  (i32.gt_s (local.get $w) (i32.const 0))
                  (i32.gt_s (local.get $h) (i32.const 0)))
              (then
                (call $client_rect_set
                  (local.get $arg0)
                  (i32.const 0) (i32.const 0)
                  (local.get $w) (local.get $h)))))
          (else
            (call $defwndproc_do_nccalcsize (local.get $arg0))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; 922: GetWindowRgn(hwnd, hRgn) — 2 args stdcall. Copy the installed
  ;; window-relative shape into the caller's existing region and return its
  ;; NULLREGION/SIMPLEREGION/COMPLEXREGION classification.
  (func $handle_GetWindowRgn (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $source i32)
    (local.set $source (call $wnd_region_handle_get (local.get $arg0)))
    (if (i32.and
          (i32.ne (local.get $source) (i32.const 0))
          (i32.ne (call $gdi_rgn_record (local.get $arg1)) (i32.const 0)))
      (then
        (i32.store offset=0 (global.get $reg_base) (call $gdi_rgn_combine
          (local.get $arg1) (local.get $source) (i32.const 0) (i32.const 5))))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; The browser exposes one primary monitor. The selection APIs still have
  ;; observable Win32 behavior: DEFAULTTONULL returns NULL for an off-screen
  ;; point/rectangle/window, while DEFAULTTOPRIMARY and DEFAULTTONEAREST return
  ;; the monitor. An object that intersects [0,width)x[0,height) always selects
  ;; it regardless of the fallback flag.
  (func $single_monitor_fallback (param $flags i32) (result i32)
    (select (i32.const 0x00010000) (i32.const 0)
      (i32.or (i32.eq (local.get $flags) (i32.const 1))
              (i32.eq (local.get $flags) (i32.const 2)))))

  (func $single_monitor_rect
      (param $left i32) (param $top i32) (param $right i32) (param $bottom i32)
      (param $flags i32) (result i32)
    (local $width i32) (local $height i32)
    (local.set $width (call $screen_metric_w))
    (local.set $height (call $screen_metric_h))
    (if (i32.and
          (i32.and
            (i32.lt_s (local.get $left) (local.get $right))
            (i32.lt_s (local.get $top) (local.get $bottom)))
          (i32.and
            (i32.and (i32.lt_s (local.get $left) (local.get $width))
                     (i32.gt_s (local.get $right) (i32.const 0)))
            (i32.and (i32.lt_s (local.get $top) (local.get $height))
                     (i32.gt_s (local.get $bottom) (i32.const 0)))))
      (then (return (i32.const 0x00010000))))
    (call $single_monitor_fallback (local.get $flags)))

  ;; 918: MonitorFromRect(lprc, dwFlags) — 2 args stdcall
  (func $handle_MonitorFromRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $rect i32)
    (if (i32.eqz (local.get $arg0))
      (then
        (i32.store offset=0 (global.get $reg_base) (call $single_monitor_fallback (local.get $arg1)))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (local.set $rect (call $g2w (local.get $arg0)))
    (i32.store offset=0 (global.get $reg_base) (call $single_monitor_rect
      (load.field Rect left (local.get $rect))
      (load.field.memarg Rect top (local.get $rect))
      (load.field.memarg Rect right (local.get $rect))
      (load.field.memarg Rect bottom (local.get $rect))
      (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 919: GetMonitorInfoA(hMonitor, lpmi) — 2 args stdcall
  ;; Fill MONITORINFO/MONITORINFOEXA for the one live primary monitor.
  (func $handle_GetMonitorInfoA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32) (local $width i32) (local $height i32) (local $size i32)
    (if (i32.ne (local.get $arg0) (i32.const 0x00010000))
      (then
        (global.set $last_error (i32.const 1461)) ;; ERROR_INVALID_MONITOR_HANDLE
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (if (i32.eqz (local.get $arg1))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (local.set $wa (call $g2w (local.get $arg1)))
    (local.set $size (i32.load (local.get $wa)))
    (if (i32.and (i32.ne (local.get $size) (i32.const 40))
                 (i32.ne (local.get $size) (i32.const 72)))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (local.set $width (call $screen_metric_w))
    (local.set $height (call $screen_metric_h))
    ;; MONITORINFO: cbSize(4), rcMonitor(16), rcWork(16), dwFlags(4) = 40 bytes
    ;; rcMonitor: left=0, top=0, right=screenW, bottom=screenH
    (i32.store (i32.add (local.get $wa) (i32.const 4)) (i32.const 0))   ;; left
    (i32.store (i32.add (local.get $wa) (i32.const 8)) (i32.const 0))   ;; top
    (i32.store (i32.add (local.get $wa) (i32.const 12)) (local.get $width)) ;; right
    (i32.store (i32.add (local.get $wa) (i32.const 16)) (local.get $height)) ;; bottom
    ;; rcWork excludes the classic 28px taskbar already reported by
    ;; SHAppBarMessage and therefore agrees with SPI_GETWORKAREA.
    (i32.store (i32.add (local.get $wa) (i32.const 20)) (i32.const 0))
    (i32.store (i32.add (local.get $wa) (i32.const 24)) (i32.const 0))
    (i32.store (i32.add (local.get $wa) (i32.const 28)) (local.get $width))
    (i32.store (i32.add (local.get $wa) (i32.const 32)) (call $screen_work_bottom))
    ;; dwFlags: MONITORINFOF_PRIMARY = 1
    (i32.store (i32.add (local.get $wa) (i32.const 36)) (i32.const 1))
    (if (i32.eq (local.get $size) (i32.const 72))
      (then
        ;; MONITORINFOEXA.szDevice = "\\\\.\\DISPLAY1".
        (memory.fill (i32.add (local.get $wa) (i32.const 40)) (i32.const 0) (i32.const 32))
        (i32.store offset=40 (local.get $wa) (i32.const 0x5C2E5C5C))
        (i32.store offset=44 (local.get $wa) (i32.const 0x50534944))
        (i32.store offset=48 (local.get $wa) (i32.const 0x3159414C))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))  ;; success
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 920: MonitorFromWindow(hwnd, dwFlags) — 2 args stdcall
  (func $handle_MonitorFromWindow (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $rect i32)
    (if (i32.eqz (call $window_handle_valid (local.get $arg0)))
      (then
        (i32.store offset=0 (global.get $reg_base) (call $single_monitor_fallback (local.get $arg1)))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (local.set $rect (call $paint_scratch_take))
    (call $host_get_window_rect (local.get $arg0) (local.get $rect))
    (i32.store offset=0 (global.get $reg_base) (call $single_monitor_rect
      (load.field PaintRect left (local.get $rect))
      (load.field.memarg PaintRect top (local.get $rect))
      (load.field.memarg PaintRect right (local.get $rect))
      (load.field.memarg PaintRect bottom (local.get $rect))
      (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; MonitorFromPoint(pt.x, pt.y, dwFlags) — POINT passed by value (2 dwords) + dwFlags = 3 args stdcall
  (func $handle_MonitorFromPoint (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $width i32) (local $height i32)
    (local.set $width (call $screen_metric_w))
    (local.set $height (call $screen_metric_h))
    (i32.store offset=0 (global.get $reg_base) (if (result i32)
          (i32.and
            (i32.and (i32.ge_s (local.get $arg0) (i32.const 0))
                     (i32.lt_s (local.get $arg0) (local.get $width)))
            (i32.and (i32.ge_s (local.get $arg1) (i32.const 0))
                     (i32.lt_s (local.get $arg1) (local.get $height))))
        (then (i32.const 0x00010000))
        (else (call $single_monitor_fallback (local.get $arg2)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
  )

  ;; Win98's profile decoder is intentionally not a strict hex parser. Native
  ;; printable-ASCII probes show decimal digits map normally, every other byte
  ;; uses (ch - 'A' + 10) & 15. Do not reuse the strict GUID hex validator.
  (func $profile_struct_nibble (param $ch i32) (result i32)
    (i32.and (i32.sub (local.get $ch)
      (select (i32.const 48) (i32.const 55)
        (i32.and (i32.ge_u (local.get $ch) (i32.const 48))
                 (i32.le_u (local.get $ch) (i32.const 57))))) (i32.const 15)))

  (func $ini_get_struct (param $app i32) (param $key i32) (param $out i32)
      (param $size i32) (param $file i32) (result i32)
    (local $encoded i32) (local $buffer i32) (local $i i32)
    (local $value i32) (local $sum i32) (local $result i32)
    (if (i32.or (i32.eqz (local.get $app)) (i32.eqz (local.get $key)))
      (then (return (i32.const 0))))
    (if (i32.or (i32.eqz (local.get $out))
                 (i32.gt_u (local.get $size) (i32.const 0x3ffffffd)))
      (then (return (i32.const 0))))
    ;; Two hex digits per byte, two checksum digits, NUL, and one extra byte
    ;; so a truncated longer value cannot masquerade as an exact-length value.
    (local.set $encoded (i32.add (i32.shl (local.get $size) (i32.const 1)) (i32.const 2)))
    (local.set $buffer (call $heap_alloc (i32.add (local.get $encoded) (i32.const 2))))
    (if (i32.eqz (local.get $buffer)) (then (return (i32.const 0))))
    (if (i32.eq (call $ini_get_string (local.get $app) (local.get $key) (i32.const 0)
        (local.get $buffer) (i32.add (local.get $encoded) (i32.const 2))
        (local.get $file) (i32.const 0)) (local.get $encoded))
      (then
        (loop $decode
          (local.set $value (i32.or
            (i32.shl (call $profile_struct_nibble
              (call $gl8 (i32.add (local.get $buffer) (i32.shl (local.get $i) (i32.const 1))))) (i32.const 4))
            (call $profile_struct_nibble (call $gl8 (i32.add (local.get $buffer)
              (i32.add (i32.shl (local.get $i) (i32.const 1)) (i32.const 1)))))))
          (if (i32.eq (local.get $i) (local.get $size))
            (then (local.set $result
              (i32.eq (local.get $value) (i32.and (local.get $sum) (i32.const 255)))))
            (else
              ;; Native publishes decoded bytes even when the checksum fails.
              (call $gs8 (i32.add (local.get $out) (local.get $i)) (local.get $value))
              (local.set $sum (i32.add (local.get $sum) (local.get $value)))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $decode))))))
    (call $heap_free (local.get $buffer))
    (local.get $result))

  ;; GetPrivateProfileStructA(appName, keyName, lpStruct, nSize, fileName) — 5 args stdcall
  (func $handle_GetPrivateProfileStructA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $ini_get_struct
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
  )

  ;; 917: CoCreateGuid(pguid) — 1 arg stdcall
  ;; Write a deterministic GUID based on a counter, return S_OK
  (func $handle_CoCreateGuid (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32)
    (local.set $wa (call $g2w (local.get $arg0)))
    (global.set $guid_counter (i32.add (global.get $guid_counter) (i32.const 1)))
    (i32.store (local.get $wa) (global.get $guid_counter))
    (i32.store (i32.add (local.get $wa) (i32.const 4)) (i32.const 0x0000CAFE))
    (i32.store (i32.add (local.get $wa) (i32.const 8)) (i32.const 0xDEAD0040))
    (i32.store (i32.add (local.get $wa) (i32.const 12)) (i32.const 0xBEEF0000))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))  ;; S_OK
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; UuidCreate(UUID *uuid) has the same 16-byte output and success contract
  ;; as CoCreateGuid for this process-local deterministic UUID source.
  (func $handle_UuidCreate (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_CoCreateGuid
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; 916: RasEnumConnectionsA(lpRasConn, lpcb, lpcConnections) — 3 args stdcall
  ;; Return 0 (SUCCESS) with *lpcConnections = 0 (no dial-up connections)
  (func $handle_RasEnumConnectionsA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store (call $g2w (local.get $arg2)) (i32.const 0)) ;; *lpcConnections = 0
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))  ;; SUCCESS
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))  ;; stdcall, 3 args
  )

  ;; 941: GetClassLongA(hwnd, nIndex) — 2 args stdcall
  ;; GCL_HICON=-14, GCL_HICONSM=-34, GCL_HCURSOR=-12, GCL_HBRBACKGROUND=-10
  ;; GCL_STYLE=-26, GCL_WNDPROC=-24, GCL_CBWNDEXTRA=-18, GCL_CBCLSEXTRA=-20
  (func $handle_GetClassLongA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $class_long_get (local.get $arg0) (local.get $arg1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 942: CopyIcon(hIcon) — return an independently owned icon handle.
  (func $handle_CopyIcon (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $icon_copy_handle (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 953: PrintDlgA(lppd) — default printer data plus interactive form
  (func $handle_PrintDlgA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dlg i32) (local $owner i32) (local $flags i32)
    (local $devmode i32) (local $devnames i32) (local $devnames_wa i32)
    (local $error i32)
    (global.set $common_dialog_error (i32.const 0))
    (local.set $error (call $common_dialog_validate_struct
      (local.get $arg0) (i32.const 66) (i32.const 0)))
    (if (local.get $error)
      (then (call $common_dialog_fail (local.get $error)) (return)))
    (local.set $flags (call $gl32 (i32.add (local.get $arg0) (i32.const 20))))
    (if (i32.and
          (i32.ne (i32.and (local.get $flags) (i32.const 0x00000400)) (i32.const 0))
          (i32.or
            (i32.ne (call $gl32 (i32.add (local.get $arg0) (i32.const 8))) (i32.const 0))
            (i32.ne (call $gl32 (i32.add (local.get $arg0) (i32.const 12))) (i32.const 0))))
      (then (call $common_dialog_fail (i32.const 0x1003)) (return)))
    (call $modal_capture_nonvolatile)
    ;; Stable DEVMODEA/DEVNAMES handles. Global handles are direct guest heap
    ;; pointers in this runtime, so GlobalLock remains identity as MFC expects.
    ;; Both are HGLOBALs the caller will GlobalLock and GlobalFree, so they
    ;; carry the Global* provenance mark; unmarked, GlobalLock refuses them and
    ;; MFC's AfxCreateDC gives up (Paint's Print Preview closed instantly).
    (local.set $devmode (call $heap_alloc (i32.const 156)))
    (call $heap_global_mark (local.get $devmode))
    (memory.fill (call $g2w (local.get $devmode)) (i32.const 0) (i32.const 156))
    (call $gs16 (i32.add (local.get $devmode) (i32.const 36)) (i32.const 156)) ;; dmSize
    (call $gs32 (i32.add (local.get $devmode) (i32.const 40)) (i32.const 0x00000F03)) ;; orientation/paper/copies/quality
    (call $gs16 (i32.add (local.get $devmode) (i32.const 44)) (i32.const 1))   ;; portrait
    (call $gs16 (i32.add (local.get $devmode) (i32.const 46)) (i32.const 1))   ;; Letter
    (call $gs16 (i32.add (local.get $devmode) (i32.const 48)) (i32.const 2794)) ;; 11in in 0.1mm
    (call $gs16 (i32.add (local.get $devmode) (i32.const 50)) (i32.const 2159)) ;; 8.5in
    (call $gs16 (i32.add (local.get $devmode) (i32.const 54)) (i32.const 1))   ;; copies
    (call $gs16 (i32.add (local.get $devmode) (i32.const 58)) (i32.const 300)) ;; print quality
    (local.set $devnames (call $heap_alloc (i32.const 32)))
    (call $heap_global_mark (local.get $devnames))
    (local.set $devnames_wa (call $g2w (local.get $devnames))) (memory.fill (local.get $devnames_wa) (i32.const 0) (i32.const 32))
    (call $gs16 (local.get $devnames) (i32.const 8))
    (call $gs16 (i32.add (local.get $devnames) (i32.const 2)) (i32.const 16))
    (call $gs16 (i32.add (local.get $devnames) (i32.const 4)) (i32.const 28))
    (call $gs16 (i32.add (local.get $devnames) (i32.const 6)) (i32.const 0))
    (call $memcpy (i32.add (local.get $devnames_wa) (i32.const 8)) (region.addr $USER_DIALOG_STRINGS 0x220) (i32.const 8)) ;; WINSPOOL
    (call $memcpy (i32.add (local.get $devnames_wa) (i32.const 16)) (region.addr $USER_DIALOG_STRINGS 0x229) (i32.const 12)) ;; Web Printer
    (call $gs32 (i32.add (local.get $arg0) (i32.const 8)) (local.get $devmode))
    (call $gs32 (i32.add (local.get $arg0) (i32.const 12)) (local.get $devnames))
    (global.set $printer_hdc (call $gdi_printer_dc_alloc))
    (call $gs32 (i32.add (local.get $arg0) (i32.const 16)) (global.get $printer_hdc))
    (call $gs16 (i32.add (local.get $arg0) (i32.const 24)) (i32.const 1))
    (call $gs16 (i32.add (local.get $arg0) (i32.const 26)) (i32.const 1))
    (call $gs16 (i32.add (local.get $arg0) (i32.const 28)) (i32.const 1))
    (call $gs16 (i32.add (local.get $arg0) (i32.const 30)) (i32.const 9999))
    (call $gs16 (i32.add (local.get $arg0) (i32.const 32)) (i32.const 1))
    ;; PD_RETURNDEFAULT (0x400) is a noninteractive default-printer probe.
    (if (i32.and (local.get $flags) (i32.const 0x00000400))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (local.set $dlg (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (local.set $owner (call $gl32 (i32.add (local.get $arg0) (i32.const 4))))
    (global.set $common_dialog_kind (i32.const 2))
    (global.set $common_dialog_struct (local.get $arg0))
    (call $create_print_dialog (local.get $dlg) (local.get $owner))
    (call $modal_begin (local.get $dlg) (i32.const 8)))

  ;; PrintDlgW(lppd) — the wide twin of PrintDlgA.
  ;;
  ;; NT Paint delay-loads this, so a failed GetProcAddress does not return an
  ;; error to the app: the delay-load helper raises 0xC06D007F, nothing handles
  ;; it, and the process exits. File > Print, Page Setup and Print Preview all
  ;; killed Paint outright rather than doing nothing.
  ;;
  ;; PRINTDLG itself has the same layout in both flavours; DEVMODE does not.
  ;; DEVMODEW's dmDeviceName is 32 WCHARs rather than 32 chars, so every field
  ;; after it sits 32 bytes further along and the struct is 220 bytes, not 156.
  ;; DEVNAMES offsets are counted in characters, so those move too.
  (func $handle_PrintDlgW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dlg i32) (local $owner i32) (local $flags i32)
    (local $devmode i32) (local $devnames i32) (local $dn_w i32)
    (local $error i32)
    (global.set $common_dialog_error (i32.const 0))
    (local.set $error (call $common_dialog_validate_struct
      (local.get $arg0) (i32.const 66) (i32.const 0)))
    (if (local.get $error)
      (then (call $common_dialog_fail (local.get $error)) (return)))
    (local.set $flags (call $gl32 (i32.add (local.get $arg0) (i32.const 20))))
    (if (i32.and
          (i32.ne (i32.and (local.get $flags) (i32.const 0x00000400)) (i32.const 0))
          (i32.or
            (i32.ne (call $gl32 (i32.add (local.get $arg0) (i32.const 8))) (i32.const 0))
            (i32.ne (call $gl32 (i32.add (local.get $arg0) (i32.const 12))) (i32.const 0))))
      (then (call $common_dialog_fail (i32.const 0x1003)) (return)))
    (call $modal_capture_nonvolatile)
    (local.set $devmode (call $heap_alloc (i32.const 220)))
    (call $heap_global_mark (local.get $devmode))
    (memory.fill (call $g2w (local.get $devmode)) (i32.const 0) (i32.const 220))
    (call $gs16 (i32.add (local.get $devmode) (i32.const 68)) (i32.const 220)) ;; dmSize
    (call $gs32 (i32.add (local.get $devmode) (i32.const 72)) (i32.const 0x00000F03)) ;; dmFields
    (call $gs16 (i32.add (local.get $devmode) (i32.const 76)) (i32.const 1))    ;; portrait
    (call $gs16 (i32.add (local.get $devmode) (i32.const 78)) (i32.const 1))    ;; Letter
    (call $gs16 (i32.add (local.get $devmode) (i32.const 80)) (i32.const 2794)) ;; 11in in 0.1mm
    (call $gs16 (i32.add (local.get $devmode) (i32.const 82)) (i32.const 2159)) ;; 8.5in
    (call $gs16 (i32.add (local.get $devmode) (i32.const 86)) (i32.const 1))    ;; copies
    (call $gs16 (i32.add (local.get $devmode) (i32.const 90)) (i32.const 300))  ;; quality
    ;; DEVNAMES: 8-byte header, then the strings. The offsets are in
    ;; characters, so byte 8 is character 4 here rather than character 8.
    (local.set $devnames (call $heap_alloc (i32.const 64)))
    (call $heap_global_mark (local.get $devnames))
    (local.set $dn_w (call $g2w (local.get $devnames)))
    (memory.fill (local.get $dn_w) (i32.const 0) (i32.const 64))
    (call $gs16 (local.get $devnames) (i32.const 4))                              ;; wDriverOffset
    (call $gs16 (i32.add (local.get $devnames) (i32.const 2)) (i32.const 13))     ;; wDeviceOffset
    (call $gs16 (i32.add (local.get $devnames) (i32.const 4)) (i32.const 25))     ;; wOutputOffset
    (call $gs16 (i32.add (local.get $devnames) (i32.const 6)) (i32.const 0))      ;; wDefault
    (call $memcpy (i32.add (local.get $dn_w) (i32.const 8)) (region.addr $USER_DIALOG_STRINGS 0x220) (i32.const 8))
    (call $acm_widen_in_place (i32.add (local.get $devnames) (i32.const 8)) (i32.const 8))
    (call $memcpy (i32.add (local.get $dn_w) (i32.const 26)) (region.addr $USER_DIALOG_STRINGS 0x229) (i32.const 11))
    (call $acm_widen_in_place (i32.add (local.get $devnames) (i32.const 26)) (i32.const 11))
    (call $gs32 (i32.add (local.get $arg0) (i32.const 8)) (local.get $devmode))
    (call $gs32 (i32.add (local.get $arg0) (i32.const 12)) (local.get $devnames))
    (global.set $printer_hdc (call $gdi_printer_dc_alloc))
    (call $gs32 (i32.add (local.get $arg0) (i32.const 16)) (global.get $printer_hdc))
    (call $gs16 (i32.add (local.get $arg0) (i32.const 24)) (i32.const 1))
    (call $gs16 (i32.add (local.get $arg0) (i32.const 26)) (i32.const 1))
    (call $gs16 (i32.add (local.get $arg0) (i32.const 28)) (i32.const 1))
    (call $gs16 (i32.add (local.get $arg0) (i32.const 30)) (i32.const 9999))
    (call $gs16 (i32.add (local.get $arg0) (i32.const 32)) (i32.const 1))
    (if (i32.and (local.get $flags) (i32.const 0x00000400))   ;; PD_RETURNDEFAULT
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (local.set $dlg (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (local.set $owner (call $gl32 (i32.add (local.get $arg0) (i32.const 4))))
    (global.set $common_dialog_kind (i32.const 2))
    (global.set $common_dialog_struct (local.get $arg0))
    (call $create_print_dialog (local.get $dlg) (local.get $owner))
    (call $modal_begin (local.get $dlg) (i32.const 8)))

  ;; 954: CoFreeUnusedLibraries() — no args, no-op
  (func $handle_CoFreeUnusedLibraries (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
  )

  ;; 952: CoRevokeClassObject(dwRegister) — 1 arg stdcall.
  (func $handle_CoRevokeClassObject (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_com_revoke_class_object (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 951: CoRegisterClassObject(rclsid, pUnk, dwClsContext, flags, lpdwRegister)
  ;; 5 args stdcall. Retain the process-local class factory so a later
  ;; CoCreateInstance can call IClassFactory::CreateInstance on the same guest
  ;; object, including when registration and activation occur on different
  ;; cooperative WASM thread instances.
  (func $handle_CoRegisterClassObject (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg4)
      (then (call $gs32 (local.get $arg4)
        (call $host_com_register_class_object
          (call $g2w (local.get $arg0)) (local.get $arg1)
          (local.get $arg2) (local.get $arg3)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))  ;; S_OK
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
  )

  ;; 950: DrawFrameControl(hdc, lprc, uType, uState) — 4 args stdcall
  ;; Draw the frame as a raised edge (BDR_RAISEDOUTER|BDR_RAISEDINNER=5, BF_RECT=15)
  (func $handle_DrawFrameControl (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $rc i32) (local $desc i32)
    (local.set $rc (call $g2w (local.get $arg1)))
    (local.set $desc (global.get $GDI_LINE_DESC))
    (if (call $gdi_surface_descriptor (local.get $arg0) (local.get $desc))
      (then (i32.store offset=0 (global.get $reg_base) (call $gdi_draw_edge_desc
        (local.get $arg0) (local.get $desc)
        (load.field Rect left (local.get $rc)) (load.field.memarg Rect top (local.get $rc))
        (load.field.memarg Rect right (local.get $rc)) (load.field.memarg Rect bottom (local.get $rc))
        (i32.const 5) (i32.const 15) (local.get $rc))))
      (else (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; DrawCaptionTempA(hwnd, hdc, rect, font, icon, text, flags).  Explorer's
  ;; shell thread uses DC_INBUTTON|DC_ICON|DC_TEXT|DC_NC to render a caption
  ;; into an offscreen task-button bitmap before the desktop is exposed.
  (func $handle_DrawCaptionTempA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $esp_w i32) (local $rc i32) (local $text_g i32) (local $flags i32)
    (local $left i32) (local $top i32) (local $right i32) (local $bottom i32)
    (local $text_left i32) (local $old_font i32) (local $old_bk i32) (local $old_color i32)
    (local.set $esp_w (call $g2w (i32.load offset=16 (global.get $reg_base))))
    (local.set $text_g (i32.load offset=24 (local.get $esp_w)))
    (local.set $flags (i32.load offset=28 (local.get $esp_w)))
    (if (i32.or (i32.eqz (local.get $arg1)) (i32.eqz (local.get $arg2)))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
        (return)))
    (local.set $rc (call $g2w (local.get $arg2)))
    (local.set $left (load.field Rect left (local.get $rc)))
    (local.set $top (load.field.memarg Rect top (local.get $rc)))
    (local.set $right (load.field.memarg Rect right (local.get $rc)))
    (local.set $bottom (load.field.memarg Rect bottom (local.get $rc)))

    ;; DC_INBUTTON uses classic button face/edge chrome.  Ordinary captions
    ;; use Win98's active/inactive caption colors and optional gradient.
    (if (i32.ne (i32.and (local.get $flags) (i32.const 0x10)) (i32.const 0))
      (then
        (drop (call $gdi_native_fill_rect (local.get $arg1)
          (local.get $left) (local.get $top) (local.get $right) (local.get $bottom)
          (i32.const 0x30011)))
        (drop (call $gdi_native_draw_edge (local.get $arg1)
          (local.get $left) (local.get $top) (local.get $right) (local.get $bottom)
          (i32.const 0x05) (i32.const 0x0F))))
      (else
        (if (i32.ne (i32.and (local.get $flags) (i32.const 1)) (i32.const 0))
          (then
            (drop (call $gdi_native_gradient_fill_h (local.get $arg1)
              (local.get $left) (local.get $top) (local.get $right) (local.get $bottom)
              (i32.const 0x800000) (i32.const 0xD08410))))
          (else
            (drop (call $gdi_native_fill_rect (local.get $arg1)
              (local.get $left) (local.get $top) (local.get $right) (local.get $bottom)
              (i32.const 0xC0C0C0)))))))

    (local.set $text_left (i32.add (local.get $left) (i32.const 4)))
    (if (i32.and
          (i32.ne (i32.and (local.get $flags) (i32.const 0x04)) (i32.const 0))
          (i32.ne (local.get $arg4) (i32.const 0)))
      (then
        (drop (call $icon_draw_handle (local.get $arg4) (local.get $arg1)
          (i32.add (local.get $left) (i32.const 2))
          (i32.add (local.get $top) (i32.const 1))
          (i32.const 16) (i32.const 16) (global.get $DI_NORMAL)))
        (local.set $text_left (i32.add (local.get $left) (i32.const 20)))))

    (if (i32.and
          (i32.ne (i32.and (local.get $flags) (i32.const 0x08)) (i32.const 0))
          (i32.ne (local.get $text_g) (i32.const 0)))
      (then
        (if (local.get $arg3)
          (then (local.set $old_font
            (call $gdi_native_select_object (local.get $arg1) (local.get $arg3)))))
        (local.set $old_bk (call $gdi_native_set_bk_mode (local.get $arg1) (i32.const 1)))
        (local.set $old_color (call $gdi_native_set_text_color (local.get $arg1)
          (select (i32.const 0x000000) (i32.const 0xFFFFFF)
            (i32.ne (i32.and (local.get $flags) (i32.const 0x10)) (i32.const 0)))))
        (drop (call $gdi_native_draw_text (local.get $arg1)
          (call $g2w (local.get $text_g)) (call $lstr_len (local.get $text_g) (i32.const 0))
          (call $paint_rect (local.get $text_left) (local.get $top)
            (i32.sub (local.get $right) (i32.const 4)) (local.get $bottom))
          (i32.const 0x8824) (i32.const 0))) ;; VCENTER|SINGLELINE|NOPREFIX|END_ELLIPSIS
        (drop (call $gdi_native_set_text_color (local.get $arg1) (local.get $old_color)))
        (drop (call $gdi_native_set_bk_mode (local.get $arg1) (local.get $old_bk)))
        (if (local.get $arg3)
          (then (drop (call $gdi_native_select_object (local.get $arg1) (local.get $old_font)))))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
  )

;; 948: RegEnumKeyA(hKey, dwIndex, lpName, cchName) — 4 args stdcall
  (func $handle_RegEnumKeyA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $host_reg_enum_key
      (local.get $arg0)                    ;; hKey
      (local.get $arg1)                    ;; dwIndex
      (local.get $arg2)                    ;; lpName guest pointer
      (local.get $arg3)                    ;; cchName
      (i32.const 0)))                      ;; isWide = false
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
  )

  ;; RegEnumKeyExA(hKey, index, name, &nameChars, reserved, class,
  ;;               &classChars, &lastWriteTime) — 8 args stdcall.
  ;; The storage backend already owns immediate-child ordering and ANSI copy
  ;; semantics for RegEnumKeyA. Ex adds pointer-sized metadata around that same
  ;; enumeration; Win9x's in-memory registry has no meaningful last-write time
  ;; or class string here, so return deterministic empty values for both.
  (func $handle_RegEnumKeyExA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa_esp i32) (local $res i32) (local $class_g i32)
    (local $class_len_g i32) (local $filetime_g i32)
    (local.set $wa_esp (call $g2w (i32.load offset=16 (global.get $reg_base))))
    (local.set $class_g (i32.load offset=24 (local.get $wa_esp)))
    (local.set $class_len_g (i32.load offset=28 (local.get $wa_esp)))
    (local.set $filetime_g (i32.load offset=32 (local.get $wa_esp)))
    (local.set $res (i32.const 87)) ;; ERROR_INVALID_PARAMETER
    (if (i32.and (i32.eqz (local.get $arg4))
          (i32.and (i32.ne (local.get $arg2) (i32.const 0))
                   (i32.ne (local.get $arg3) (i32.const 0))))
      (then
        (local.set $res (call $host_reg_enum_key
          (local.get $arg0) (local.get $arg1) (local.get $arg2)
          (call $gl32 (local.get $arg3)) (i32.const 0)))
        (if (i32.eqz (local.get $res))
          (then
            (call $gs32 (local.get $arg3)
              (call $lstr_len (local.get $arg2) (i32.const 0)))
            (if (local.get $class_len_g)
              (then
                (if (i32.and (local.get $class_g)
                             (call $gl32 (local.get $class_len_g)))
                  (then (call $gs8 (local.get $class_g) (i32.const 0))))
                (call $gs32 (local.get $class_len_g) (i32.const 0))))
            (if (local.get $filetime_g)
              (then
                (call $gs32 (local.get $filetime_g) (i32.const 0))
                (call $gs32 (i32.add (local.get $filetime_g) (i32.const 4))
                  (i32.const 0))))))))
    (i32.store offset=0 (global.get $reg_base) (local.get $res))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36)))
  )

  ;; RegEnumValueA/W have eight arguments; args 5-7 are loaded from the guest stack.
  (func $handle_RegEnumValueA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa_esp i32)
    (local.set $wa_esp (call $g2w (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=0 (global.get $reg_base) (call $host_reg_enum_value
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)
      (i32.load offset=24 (local.get $wa_esp))
      (i32.load offset=28 (local.get $wa_esp))
      (i32.load offset=32 (local.get $wa_esp))
      (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36))))

  (func $handle_RegEnumValueW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa_esp i32)
    (local.set $wa_esp (call $g2w (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=0 (global.get $reg_base) (call $host_reg_enum_value
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)
      (i32.load offset=24 (local.get $wa_esp))
      (i32.load offset=28 (local.get $wa_esp))
      (i32.load offset=32 (local.get $wa_esp))
      (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36))))

  (func $handle_RegQueryInfoKeyA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa_esp i32)
    (local.set $wa_esp (call $g2w (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=0 (global.get $reg_base) (call $host_reg_query_info
      (local.get $arg0)
      (local.get $arg4)
      (i32.load offset=24 (local.get $wa_esp))
      (i32.load offset=32 (local.get $wa_esp))
      (i32.load offset=36 (local.get $wa_esp))
      (i32.load offset=40 (local.get $wa_esp))
      (i32.const 0)))
    (if (local.get $arg2) (then (call $gs32 (local.get $arg2) (i32.const 0))))
    (if (i32.load offset=28 (local.get $wa_esp))
      (then (call $gs32 (i32.load offset=28 (local.get $wa_esp)) (i32.const 0))))
    (if (i32.load offset=44 (local.get $wa_esp))
      (then (call $gs32 (i32.load offset=44 (local.get $wa_esp)) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 52))))

  (func $handle_RegQueryInfoKeyW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa_esp i32)
    (local.set $wa_esp (call $g2w (i32.load offset=16 (global.get $reg_base))))
    (i32.store offset=0 (global.get $reg_base) (call $host_reg_query_info
      (local.get $arg0)
      (local.get $arg4)
      (i32.load offset=24 (local.get $wa_esp))
      (i32.load offset=32 (local.get $wa_esp))
      (i32.load offset=36 (local.get $wa_esp))
      (i32.load offset=40 (local.get $wa_esp))
      (i32.const 1)))
    (if (local.get $arg2) (then (call $gs32 (local.get $arg2) (i32.const 0))))
    (if (i32.load offset=28 (local.get $wa_esp))
      (then (call $gs32 (i32.load offset=28 (local.get $wa_esp)) (i32.const 0))))
    (if (i32.load offset=44 (local.get $wa_esp))
      (then (call $gs32 (i32.load offset=44 (local.get $wa_esp)) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 52))))

;; 946: CopyImage(hImage, uType, cx, cy, flags) — create an owned sized image.
  (func $handle_CopyImage (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $copy_image_handle (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
  )

  ;; 945: CreateIconIndirect(piconinfo) — 1 arg stdcall, returns an HICON that
  ;; keeps the ICONINFO. Win32 copies the caller's bitmaps into the icon, so
  ;; the clones are what CURSOR_TABLE owns and DestroyIcon releases.
  (func $handle_CreateIconIndirect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $info i32) (local $mask i32) (local $color i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
    (if (i32.eqz (local.get $arg0))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (local.set $info (call $g2w (local.get $arg0)))
    (local.set $mask (call $gdi_bitmap_clone_owned (i32.load offset=12 (local.get $info))))
    (if (i32.eqz (local.get $mask))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (if (i32.load offset=16 (local.get $info))
      (then
        (local.set $color (call $gdi_bitmap_clone_owned (i32.load offset=16 (local.get $info))))
        (if (i32.eqz (local.get $color))
          (then
            (drop (call $gdi_object_delete_full (local.get $mask)))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (return)))))
    (i32.store offset=0 (global.get $reg_base) (call $cursor_intern
      (i32.ne (i32.load (local.get $info)) (i32.const 0))
      (i32.load offset=4 (local.get $info))
      (i32.load offset=8 (local.get $info))
      (local.get $mask) (local.get $color)))
    (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
      (then
        (drop (call $gdi_object_delete_full (local.get $mask)))
        (if (local.get $color)
          (then (drop (call $gdi_object_delete_full (local.get $color)))))))
  )

  ;; Stack two 1-bpp planes into the single mask bitmap CURSOR_TABLE stores.
  ;; Storage rows run bottom-up for a DDB, so the XOR plane — the lower half
  ;; of the picture's mask in Win32's top-down description — comes first in
  ;; memory, and the AND plane follows. Both planes share a stride, since both
  ;; are `width` bits wide.
  (func $cursor_stack_planes (param $width i32) (param $height i32)
        (param $and_bits i32) (param $xor_bits i32) (result i32)
    (local $stride i32) (local $plane i32) (local $ga i32) (local $wa i32)
    (local $handle i32)
    (if (i32.or (i32.le_s (local.get $width) (i32.const 0))
          (i32.or (i32.le_s (local.get $height) (i32.const 0))
            (i32.or (i32.eqz (local.get $and_bits)) (i32.eqz (local.get $xor_bits)))))
      (then (return (i32.const 0))))
    (local.set $stride (i32.shl
      (i32.shr_u (i32.add (local.get $width) (i32.const 15)) (i32.const 4))
      (i32.const 1)))
    (local.set $plane (i32.mul (local.get $stride) (local.get $height)))
    (local.set $ga (call $dib_alloc (i32.shl (local.get $plane) (i32.const 1))))
    (if (i32.eqz (local.get $ga)) (then (return (i32.const 0))))
    (local.set $wa (call $g2w (local.get $ga)))
    (memory.copy (local.get $wa) (call $g2w (local.get $xor_bits)) (local.get $plane))
    (memory.copy (i32.add (local.get $wa) (local.get $plane))
      (call $g2w (local.get $and_bits)) (local.get $plane))
    (local.set $handle (call $gdi_bitmap_create_bitmap
      (local.get $width) (i32.shl (local.get $height) (i32.const 1))
      (i32.const 1) (i32.const 1) (local.get $wa)))
    (call $dib_free_wasm (local.get $wa))
    (local.get $handle))

  ;; CreateIcon(hInst, nWidth, nHeight, cPlanes, cBitsPixel, lpbANDbits, lpbXORbits)
  ;; — 7 args stdcall. The AND plane is always monochrome; the XOR plane is a
  ;; colour bitmap unless cPlanes and cBitsPixel are both 1, in which case the
  ;; two planes stack into one mask exactly as CreateCursor's do.
  (func $handle_CreateIcon (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $and_bits i32) (local $xor_bits i32) (local $mask i32) (local $color i32)
    (local $planes i32) (local $bits_pixel i32)
    (local.set $and_bits (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (local.set $xor_bits (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
    ;; These are BYTE parameters in USER32's ABI. Win9x OLEAUT loads cPlanes
    ;; from a packed BITMAP with a dword read, so the high word can contain
    ;; cBitsPixel as well (32bpp arrives as 0x00200001). A native callee reads
    ;; only the declared low byte; treating the entire stack slot as planes
    ;; makes the bitmap allocation fail and VB6 reports "Unexpected error".
    (local.set $planes (i32.and (local.get $arg3) (i32.const 0xFF)))
    (local.set $bits_pixel (i32.and (local.get $arg4) (i32.const 0xFF)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))  ;; ret + 7 args
    (if (i32.and (i32.le_u (local.get $planes) (i32.const 1))
                 (i32.le_u (local.get $bits_pixel) (i32.const 1)))
      (then
        (local.set $mask (call $cursor_stack_planes
          (local.get $arg1) (local.get $arg2)
          (local.get $and_bits) (local.get $xor_bits))))
      (else
        (local.set $mask (call $gdi_bitmap_create_bitmap
          (local.get $arg1) (local.get $arg2) (i32.const 1) (i32.const 1)
          (select (call $g2w (local.get $and_bits)) (i32.const 0)
            (i32.ne (local.get $and_bits) (i32.const 0)))))
        (if (local.get $mask)
          (then
            (local.set $color (call $gdi_bitmap_create_bitmap
              (local.get $arg1) (local.get $arg2) (local.get $planes) (local.get $bits_pixel)
              (select (call $g2w (local.get $xor_bits)) (i32.const 0)
                (i32.ne (local.get $xor_bits) (i32.const 0)))))
            (if (i32.eqz (local.get $color))
              (then
                (drop (call $gdi_object_delete_full (local.get $mask)))
                (local.set $mask (i32.const 0))))))))
    (if (i32.eqz (local.get $mask))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    ;; An icon's hotspot is its centre, which is what GetIconInfo reports.
    (i32.store offset=0 (global.get $reg_base) (call $cursor_intern (i32.const 1)
      (i32.shr_u (local.get $arg1) (i32.const 1))
      (i32.shr_u (local.get $arg2) (i32.const 1))
      (local.get $mask) (local.get $color)))
    (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
      (then
        (drop (call $gdi_object_delete_full (local.get $mask)))
        (if (local.get $color)
          (then (drop (call $gdi_object_delete_full (local.get $color)))))))
  )

  ;; CreateCursor(hInst, xHotspot, yHotspot, width, height, ANDbits, XORbits)
  ;; — 7 args stdcall. Both planes are monochrome, so the cursor is stored the
  ;; same way CreateIconIndirect stores a monochrome one.
  (func $handle_CreateCursor (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $mask i32)
    (local.set $mask (call $cursor_stack_planes
      (local.get $arg3) (local.get $arg4)
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))  ;; ret + 7 args
    (if (i32.eqz (local.get $mask))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
    (i32.store offset=0 (global.get $reg_base) (call $cursor_intern (i32.const 0)
      (local.get $arg1) (local.get $arg2) (local.get $mask) (i32.const 0)))
    (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
      (then (drop (call $gdi_object_delete_full (local.get $mask)))))
  )

  ;; GetQueueStatus(flags). The high word reports requested categories that
  ;; are currently queued. We do not yet maintain USER's separate per-category
  ;; "changed since last call" latch, so the low word remains clear.
  (func $handle_GetQueueStatus (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $bits i32) (local $msg i32)
    ;; Posted messages satisfy both QS_POSTMESSAGE and QS_ALLPOSTMESSAGE.
    (if (i32.or
          (i32.gt_u (call $post_queue_total_count) (i32.const 0))
          (i32.gt_u (call $shared_post_queue_total_count) (i32.const 0)))
      (then (local.set $bits (i32.or (local.get $bits) (i32.const 0x0108)))))
    (if (global.get $pending_input_packed)
      (then
        (local.set $msg (i32.and (global.get $pending_input_packed) (i32.const 0xFFFF)))
        (if (i32.and (i32.ge_u (local.get $msg) (i32.const 0x0100))
                     (i32.le_u (local.get $msg) (i32.const 0x0109)))
          (then (local.set $bits (i32.or (local.get $bits) (i32.const 0x0001)))))
        (if (i32.eq (local.get $msg) (i32.const 0x0200))
          (then (local.set $bits (i32.or (local.get $bits) (i32.const 0x0002)))))
        (if (i32.and (i32.ge_u (local.get $msg) (i32.const 0x0201))
                     (i32.le_u (local.get $msg) (i32.const 0x020E)))
          (then (local.set $bits (i32.or (local.get $bits) (i32.const 0x0004)))))))
    (if (i32.or
          (i32.or (global.get $paint_pending) (global.get $nc_flags_count))
          (call $paint_flag_any))
      (then (local.set $bits (i32.or (local.get $bits) (i32.const 0x0020)))))
    (i32.store offset=0 (global.get $reg_base) (i32.shl (i32.and (local.get $bits) (local.get $arg0)) (i32.const 16)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
  )

  ;; 944: DrawIconEx(hdc, x, y, hIcon, cx, cy, istep, hbrFlicker, diFlags) — 9 args stdcall
  ;; Only the first five arguments arrive as parameters; the rest are still on
  ;; the guest stack above the return address.
  (func $handle_DrawIconEx (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $flags i32)
    (local.set $flags (i32.load (call $g2w
      (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36)))))  ;; ret + 8 args
    (drop (call $icon_draw_handle
      (local.get $arg3) (local.get $arg0)
      (local.get $arg1) (local.get $arg2)
      (local.get $arg4)
      (i32.load (call $g2w (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
      (local.get $flags)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 40)))  ;; 9 args + ret
  )

  ;; DrawIcon(hdc, x, y, hIcon) — 4 args stdcall. The fixed-size sibling of
  ;; DrawIconEx: always the icon's natural size, always the full composite.
  (func $handle_DrawIcon (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (drop (call $icon_draw_handle
      (local.get $arg3) (local.get $arg0)
      (local.get $arg1) (local.get $arg2)
      (i32.const 0) (i32.const 0) (global.get $DI_NORMAL)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))  ;; ret + 4 args
  )

  ;; 943: GetIconInfo(hIcon, piconinfo) — 2 args stdcall
  ;; ICONINFO: fIcon(4), xHotspot(4), yHotspot(4), hbmMask(4), hbmColor(4)
  (func $handle_GetIconInfo (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ptr i32) (local $rec i32)
    (local.set $ptr (call $g2w (local.get $arg1)))
    ;; A built icon or cursor knows its own ICONINFO. Win32 hands back copies
    ;; of the bitmaps and makes the caller delete them, so cloning here is the
    ;; contract, not caution: returning ours would let the app free them.
    (local.set $rec (call $cursor_record (local.get $arg0)))
    (if (local.get $rec)
      (then
        (i32.store (local.get $ptr) (i32.load (local.get $rec)))
        (i32.store offset=4 (local.get $ptr) (i32.load offset=4 (local.get $rec)))
        (i32.store offset=8 (local.get $ptr) (i32.load offset=8 (local.get $rec)))
        (i32.store offset=12 (local.get $ptr)
          (call $gdi_bitmap_clone_owned (i32.load offset=12 (local.get $rec))))
        (i32.store offset=16 (local.get $ptr)
          (if (result i32) (i32.load offset=16 (local.get $rec))
            (then (call $gdi_bitmap_clone_owned (i32.load offset=16 (local.get $rec))))
            (else (i32.const 0))))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
        (return)))
    (i32.store (local.get $ptr) (i32.const 1))           ;; fIcon = TRUE (it's an icon)
    (i32.store offset=4 (local.get $ptr) (i32.const 0))  ;; xHotspot
    (i32.store offset=8 (local.get $ptr) (i32.const 0))  ;; yHotspot
    (i32.store offset=12 (local.get $ptr) (i32.const 0)) ;; hbmMask = NULL
    (i32.store offset=16 (local.get $ptr) (i32.const 0)) ;; hbmColor = NULL
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))  ;; success
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
  )

  ;; 957: ChooseColorA(lpcc) — show the WAT-driven Color picker with a
  ;; basic-colors swatch grid. On OK, writes chosen COLORREF into
  ;; CHOOSECOLOR.rgbResult at +0x0C.
  (func $handle_ChooseColorA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dlg i32) (local $owner i32) (local $error i32)
    (global.set $common_dialog_error (i32.const 0))
    (local.set $error (call $common_dialog_validate_struct
      (local.get $arg0) (i32.const 36) (i32.const 0)))
    (if (local.get $error)
      (then (call $common_dialog_fail (local.get $error)) (return)))
    (call $modal_capture_nonvolatile)
    (local.set $dlg (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (local.set $owner (call $gl32 (i32.add (local.get $arg0) (i32.const 4))))
    (call $create_color_dialog (local.get $dlg) (local.get $owner) (local.get $arg0))
    (call $modal_begin (local.get $dlg) (i32.const 8)))

  ;; ChooseColorW / PageSetupDlgW — CHOOSECOLOR and PAGESETUPDLG have the same
  ;; layout in both flavours, and the only members that differ are the template
  ;; name pointers, which neither implementation reads. So these are the same
  ;; call, not a reimplementation.
  ;;
  ;; They are worth registering rather than leaving absent because NT Paint
  ;; delay-loads them: a failed GetProcAddress does not come back as an error,
  ;; it raises 0xC06D007F and takes the process down. Options > Edit Colors...
  ;; and File > Page Setup... each killed Paint outright.
  (func $handle_ChooseColorW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_ChooseColorA (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  (func $handle_PageSetupDlgW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_PageSetupDlgA (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; === VERSION.DLL APIs ===

  ;; Both encodings read the named file's RT_VERSION. A static module name
  ;; alone supplies no file version, and must not shadow an installed file.
  (func $handle_GetFileVersionInfoSizeA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $file_version_info_size_named
      (local.get $arg0) (local.get $arg1) (i32.const 0) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_GetFileVersionInfoA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $file_version_info_named
      (local.get $arg0) (local.get $arg2) (local.get $arg3) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; The VERSION resource itself is encoding-neutral; only the path width
  ;; differs. Wide callers therefore share the parser while retaining their
  ;; UTF-16 filename instead of treating its low bytes as an ANSI path.
  (func $handle_GetFileVersionInfoSizeW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $file_version_info_size_named
      (local.get $arg0) (local.get $arg1) (i32.const 1) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  (func $handle_GetFileVersionInfoW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $file_version_info_named
      (local.get $arg0) (local.get $arg2) (local.get $arg3) (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; VERSION nodes are word-length-prefixed, with UTF-16 keys and dword
  ;; padding relative to the resource start. Walk real keys: returning one
  ;; canned ProductName for every string query rejects NFS III's FileVersion.
  ;; Offsets and reads stay guest-relative, including across sparse pages.
  ;; Original Win16 VERSION nodes have two WORD lengths and ANSI keys;
  ;; Win32 nodes add wType and encode keys as UTF-16. Detect only the exact
  ;; bounded root key, never infer format from a child value.
  (func $version_is_ne (param $block i32) (result i32)
    (if (i32.lt_u (call $gl16 (local.get $block)) (i32.const 20))
      (then (return (i32.const 0))))
    (i32.eqz (i32.or
      (i32.or
        (i32.xor (call $gl32 (i32.add (local.get $block) (i32.const 4))) (i32.const 0x565F5356))
        (i32.xor (call $gl32 (i32.add (local.get $block) (i32.const 8))) (i32.const 0x49535245)))
      (i32.or
        (i32.xor (call $gl32 (i32.add (local.get $block) (i32.const 12))) (i32.const 0x495F4E4F))
        (i32.xor (call $gl32 (i32.add (local.get $block) (i32.const 16))) (i32.const 0x004F464E))))))

  (func $version_value_offset (param $block i32) (param $node i32) (param $limit i32) (result i32)
    (local $end i32) (local $p i32) (local $bytes i32)
    (local $ne i32) (local $header i32) (local $step i32)
    (local.set $ne (call $version_is_ne (local.get $block)))
    (local.set $header (select (i32.const 4) (i32.const 6) (local.get $ne)))
    (local.set $step (select (i32.const 1) (i32.const 2) (local.get $ne)))
    (if (i32.gt_u (i32.add (local.get $node) (local.get $header)) (local.get $limit))
      (then (return (i32.const 0))))
    (local.set $end (i32.add (local.get $node) (call $gl16 (i32.add (local.get $block) (local.get $node)))))
    (if (i32.or (i32.gt_u (local.get $end) (local.get $limit))
          (i32.lt_u (local.get $end) (i32.add (local.get $node) (i32.add (local.get $header) (local.get $step)))))
      (then (return (i32.const 0))))
    (local.set $p (i32.add (local.get $node) (local.get $header)))
    (block $key_done (loop $key
      (if (i32.gt_u (i32.add (local.get $p) (local.get $step)) (local.get $end))
        (then (return (i32.const 0))))
      (local.set $p (i32.add (local.get $p) (local.get $step)))
      (br_if $key_done (i32.eqz (call $fmt_get
        (i32.add (local.get $block) (i32.sub (local.get $p) (local.get $step))) (i32.eqz (local.get $ne)))))
      (br $key)))
    (local.set $p (i32.and (i32.add (local.get $p) (i32.const 3)) (i32.const -4)))
    ;; A text value may start exactly at the node end (empty value), but
    ;; its declared length is not trusted past it: see $version_value_bytes.
    (if (i32.gt_u (local.get $p) (local.get $end))
      (then (return (i32.const 0))))
    (local.set $bytes (call $gl16 (i32.add (local.get $block) (i32.add (local.get $node) (i32.const 2)))))
    (if (i32.and (i32.eqz (local.get $ne)) (i32.eq (call $gl16 (i32.add (local.get $block) (i32.add (local.get $node) (i32.const 4)))) (i32.const 1)))
      (then (return (local.get $p))))
    (if (i32.gt_u (i32.add (local.get $p) (local.get $bytes)) (local.get $end))
      (then (return (i32.const 0))))
    (local.get $p))

  ;; Byte size of a node's value. wValueLength counts UTF-16 units for a text
  ;; node (wType 1) — except that VB5/VB6's resource compiler writes it in
  ;; BYTES (JigSawedME: ProductName "JigSawedME" has wValueLength 0x16 = 22).
  ;; Windows bounds the value by the node, not by that field, so doubling a
  ;; byte count past wLength must not reject the node: clamp it to the node end.
  (func $version_value_bytes (param $block i32) (param $node i32) (param $value i32) (result i32)
    (local $end i32) (local $bytes i32)
    (local.set $end (i32.add (local.get $node) (call $gl16 (i32.add (local.get $block) (local.get $node)))))
    (local.set $bytes (call $gl16 (i32.add (local.get $block) (i32.add (local.get $node) (i32.const 2)))))
    (if (i32.and (i32.eqz (call $version_is_ne (local.get $block)))
          (i32.eq (call $gl16 (i32.add (local.get $block) (i32.add (local.get $node) (i32.const 4)))) (i32.const 1)))
      (then (local.set $bytes (i32.shl (local.get $bytes) (i32.const 1)))))
    (if (i32.gt_u (i32.add (local.get $value) (local.get $bytes)) (local.get $end))
      (then (local.set $bytes (i32.sub (local.get $end) (local.get $value)))))
    (local.get $bytes))

  (func $version_find_node (param $block i32) (param $path i32) (param $wide i32) (result i32)
    (local $node i32) (local $limit i32) (local $value i32) (local $child i32)
    (local $end i32) (local $bytes i32) (local $chars i32) (local $i i32)
    (local $step i32) (local $match i32) (local $c i32)
    (local $ne i32) (local $key_header i32) (local $key_step i32)
    (local.set $ne (call $version_is_ne (local.get $block)))
    (local.set $key_header (select (i32.const 4) (i32.const 6) (local.get $ne)))
    (local.set $key_step (select (i32.const 1) (i32.const 2) (local.get $ne)))
    (local.set $limit (call $gl16 (local.get $block)))
    (local.set $step (i32.add (local.get $wide) (i32.const 1)))
    (if (i32.eq (call $fmt_get (local.get $path) (local.get $wide)) (i32.const 92))
      (then (local.set $path (i32.add (local.get $path) (local.get $step)))))
    (loop $component
      (local.set $value (call $version_value_offset (local.get $block) (local.get $node) (local.get $limit)))
      (if (i32.eqz (local.get $value)) (then (return (i32.const 0))))
      (if (i32.eqz (call $fmt_get (local.get $path) (local.get $wide)))
        (then (return (i32.add (local.get $block) (local.get $node)))))
      (local.set $chars (i32.const 0))
      (block $segment_done (loop $segment
        (local.set $c (call $fmt_get
          (i32.add (local.get $path) (i32.mul (local.get $chars) (local.get $step))) (local.get $wide)))
        (br_if $segment_done (i32.or (i32.eqz (local.get $c)) (i32.eq (local.get $c) (i32.const 92))))
        (local.set $chars (i32.add (local.get $chars) (i32.const 1)))
        (if (i32.gt_u (local.get $chars) (i32.const 1024)) (then (return (i32.const 0))))
        (br $segment)))
      (if (i32.eqz (local.get $chars)) (then (return (i32.const 0))))
      (local.set $end (i32.add (local.get $node) (call $gl16 (i32.add (local.get $block) (local.get $node)))))
      (local.set $bytes (call $version_value_bytes (local.get $block) (local.get $node) (local.get $value)))
      (local.set $child (i32.and (i32.add (i32.add (local.get $value) (local.get $bytes)) (i32.const 3)) (i32.const -4)))
      (block $found (loop $siblings
        (local.set $value (call $version_value_offset (local.get $block) (local.get $child) (local.get $end)))
        (if (i32.eqz (local.get $value)) (then (return (i32.const 0))))
        (local.set $match (i32.const 1))
        (local.set $i (i32.const 0))
        (block $compared (loop $compare
          (if (i32.ge_u (i32.add (local.get $child) (i32.add (local.get $key_header) (i32.mul (local.get $i) (local.get $key_step)))) (local.get $value))
            (then (local.set $match (i32.const 0)) (br $compared)))
          (local.set $c (call $fmt_get (i32.add (local.get $block)
            (i32.add (local.get $child) (i32.add (local.get $key_header) (i32.mul (local.get $i) (local.get $key_step))))) (i32.eqz (local.get $ne))))
          (if (i32.eq (local.get $i) (local.get $chars))
            (then (local.set $match (i32.eqz (local.get $c))) (br $compared)))
          (if (i32.ne (call $tolower (local.get $c)) (call $tolower (call $fmt_get
                (i32.add (local.get $path) (i32.mul (local.get $i) (local.get $step))) (local.get $wide))))
            (then (local.set $match (i32.const 0)) (br $compared)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $compare)))
        (br_if $found (local.get $match))
        (local.set $child (i32.and (i32.add (i32.add (local.get $child)
          (call $gl16 (i32.add (local.get $block) (local.get $child)))) (i32.const 3)) (i32.const -4)))
        (br $siblings)))
      (local.set $node (local.get $child))
      (local.set $limit (local.get $end))
      (local.set $path (i32.add (local.get $path) (i32.mul (local.get $chars) (local.get $step))))
      (if (i32.eq (call $fmt_get (local.get $path) (local.get $wide)) (i32.const 92))
        (then (local.set $path (i32.add (local.get $path) (local.get $step)))))
      (br $component))
    (i32.const 0))

  ;; Native-encoding queries and binary values point into the caller's buffer.
  ;; NE wide text uses the caller-owned trailer reserved by the Win32 size
  ;; APIs, so answers from different blocks retain the lifetime of each block.
  ;; Win16 keeps the original resource size and only uses native ANSI queries.
  ;; ANSI nodes have no wType; only StringFileInfo descendants are text.
  (func $version_ne_text_path (param $path i32) (param $wide i32) (result i32)
    (local $i i32) (local $step i32) (local $expected i32)
    (local.set $step (i32.add (local.get $wide) (i32.const 1)))
    (if (i32.eq (call $fmt_get (local.get $path) (local.get $wide)) (i32.const 92))
      (then (local.set $path (i32.add (local.get $path) (local.get $step)))))
    (loop $key
      (if (i32.lt_u (local.get $i) (i32.const 8))
        (then (local.set $expected (i32.and (i32.wrap_i64 (i64.shr_u
          (i64.const 0x6966676e69727473) (i64.extend_i32_u (i32.shl (local.get $i) (i32.const 3))))) (i32.const 255))))
        (else (local.set $expected (i32.and (i32.wrap_i64 (i64.shr_u
          (i64.const 0x6f666e69656c) (i64.extend_i32_u (i32.shl (i32.sub (local.get $i) (i32.const 8)) (i32.const 3))))) (i32.const 255)))))
      (if (i32.ne (call $tolower (call $fmt_get (i32.add (local.get $path)
            (i32.mul (local.get $i) (local.get $step))) (local.get $wide))) (local.get $expected))
        (then (return (i32.const 0))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $key (i32.lt_u (local.get $i) (i32.const 14))))
    (i32.eq (call $fmt_get (i32.add (local.get $path)
      (i32.mul (i32.const 14) (local.get $step))) (local.get $wide)) (i32.const 92)))
  (global $version_query_scratch (mut i32) (i32.const 0))
  (func $version_query (param $block i32) (param $path i32)
      (param $out i32) (param $length i32) (param $wide i32) (result i32)
    (local $node i32) (local $value i32) (local $count i32) (local $i i32)
    (local $off i32) (local $text i32) (local $avail i32) (local $ne i32)
    (if (local.get $length) (then (call $gs32 (local.get $length) (i32.const 0))))
    (if (i32.or (i32.eqz (local.get $block)) (i32.eqz (local.get $path)))
      (then (return (i32.const 0))))
    (local.set $node (call $version_find_node (local.get $block) (local.get $path) (local.get $wide)))
    (if (i32.eqz (local.get $node)) (then (return (i32.const 0))))
    (local.set $count (call $gl16 (i32.add (local.get $node) (i32.const 2))))
    (local.set $off (call $version_value_offset
      (local.get $block) (i32.sub (local.get $node) (local.get $block)) (call $gl16 (local.get $block))))
    (local.set $value (i32.add (local.get $block) (local.get $off)))
    (local.set $ne (call $version_is_ne (local.get $block)))
    (if (local.get $ne)
      (then (local.set $text (call $version_ne_text_path (local.get $path) (local.get $wide))))
      (else (local.set $text (i32.eq (call $gl16 (i32.add (local.get $node) (i32.const 4))) (i32.const 1)))))
    (if (local.get $ne)
      (then
        (local.set $avail (call $version_value_bytes (local.get $block)
          (i32.sub (local.get $node) (local.get $block)) (local.get $off)))
        (if (i32.gt_u (local.get $count) (local.get $avail))
          (then (return (i32.const 0))))
        (if (i32.and (local.get $text) (local.get $wide))
          (then
            (block $ansi_nul (loop $ansi_scan
              (br_if $ansi_nul (i32.ge_u (local.get $i) (local.get $count)))
              (if (i32.eqz (call $gl8 (i32.add (local.get $value) (local.get $i))))
                (then (local.set $count (i32.add (local.get $i) (i32.const 1))) (br $ansi_nul)))
              (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $ansi_scan)))
            (if (local.get $wide)
              (then
                (local.set $text (i32.add (i32.add (local.get $block) (call $gl16 (local.get $block)))
                  (i32.shl (local.get $off) (i32.const 1))))
                (local.set $i (i32.const 0))
                (block $ansi_copied (loop $ansi_copy
                  (br_if $ansi_copied (i32.ge_u (local.get $i) (local.get $count)))
                  (call $gs16 (i32.add (local.get $text) (i32.shl (local.get $i) (i32.const 1)))
                    (call $tt_cp1252_to_unicode (call $gl8 (i32.add (local.get $value) (local.get $i)))))
                  (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $ansi_copy)))
                (local.set $value (local.get $text))))))
        (call $gs32 (local.get $out) (local.get $value))
        (call $gs32 (local.get $length) (local.get $count))
        (return (i32.const 1))))
    (if (local.get $text)
      (then
        ;; Report characters through the terminating NUL, bounded by the node:
        ;; the declared count may be a VB-written byte count (see above).
        (local.set $avail (i32.shr_u (call $version_value_bytes (local.get $block)
          (i32.sub (local.get $node) (local.get $block)) (local.get $off)) (i32.const 1)))
        (if (i32.gt_u (local.get $count) (local.get $avail))
          (then (local.set $count (local.get $avail))))
        (block $nul_found (loop $nul
          (br_if $nul_found (i32.ge_u (local.get $i) (local.get $count)))
          (if (i32.eqz (call $gl16 (i32.add (local.get $value) (i32.shl (local.get $i) (i32.const 1)))))
            (then (local.set $count (i32.add (local.get $i) (i32.const 1))) (br $nul_found)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $nul)))
        (local.set $i (i32.const 0))))
    (if (i32.and (i32.eqz (local.get $wide)) (local.get $text))
      (then
        ;; wLength bounds the whole resource to 65535 bytes; a string can
        ;; contain at most 32767 UTF-16 code units. Reserve one bounded area.
        (if (i32.eqz (global.get $version_query_scratch))
          (then (global.set $version_query_scratch (call $heap_alloc (i32.const 32768)))))
        (if (i32.eqz (global.get $version_query_scratch)) (then (return (i32.const 0))))
        ;; Each string gets its own slot at half its UTF-16 offset, so the
        ;; slots of one block are as disjoint as the values themselves: a
        ;; caller may hold several answers at once. Crusaders of Might and
        ;; Magic queries FileVersion, then CompanyName, then compares the
        ;; first, and a shared slot gave it "Info-ZIP" where "5.4" belonged.
        (local.set $text (i32.add (global.get $version_query_scratch)
          (i32.shr_u (local.get $off) (i32.const 1))))
        (block $copied (loop $copy
          (br_if $copied (i32.ge_u (local.get $i) (local.get $count)))
          (call $gs8 (i32.add (local.get $text) (local.get $i))
            (call $gl16 (i32.add (local.get $value) (i32.shl (local.get $i) (i32.const 1)))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $copy)))
        (local.set $value (local.get $text))))
    (call $gs32 (local.get $out) (local.get $value))
    (call $gs32 (local.get $length) (local.get $count))
    (i32.const 1))

  (func $handle_VerQueryValueA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $version_query
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (i32.const 0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  (func $handle_VerQueryValueW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $version_query
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  ;; GetWindowTextLengthA(hwnd) → length in chars (no NUL).
  (func $handle_GetWindowTextLengthA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (call $ctrl_table_get_class (local.get $arg0))
      (then
        (i32.store offset=0 (global.get $reg_base) (call $control_wndproc_dispatch
            (local.get $arg0) (i32.const 0x000E)
            (i32.const 0) (i32.const 0)))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (return)))
    (i32.store offset=0 (global.get $reg_base) (call $host_get_window_text_length (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))  ;; ret + 1 arg
  )

  (func $handle_GetCharWidth32W (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $gdi_font_char_widths
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (if (result i32) (local.get $arg3)
        (then (call $g2w (local.get $arg3))) (else (i32.const 0)))
      (i32.const 1)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20))))

  (func $handle_GetCharacterPlacementW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $gdi_character_placement_w
      (local.get $arg0)
      (if (result i32) (local.get $arg1)
        (then (call $g2w (local.get $arg1))) (else (i32.const 0)))
      (local.get $arg2) (local.get $arg3)
      (if (result i32) (local.get $arg4)
        (then (call $g2w (local.get $arg4))) (else (i32.const 0)))
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))

  ;; Join an ANSI directory and leaf name and ask the VFS whether the result
  ;; exists. VerFindFileA searches a small, fixed set of directories, so a
  ;; temporary guest string keeps that lookup inside the same filesystem path
  ;; normalization used by CreateFile/GetFileAttributes.
  (func $ver_file_exists_a (param $dir i32) (param $file i32) (result i32)
    (local $dir_len i32) (local $file_len i32) (local $path i32)
    (local $attrs i32)
    (if (i32.or (i32.eqz (local.get $dir)) (i32.eqz (local.get $file)))
      (then (return (i32.const 0))))
    (local.set $dir_len (call $guest_strlen (local.get $dir)))
    (local.set $file_len (call $guest_strlen (local.get $file)))
    (if (i32.or (i32.eqz (local.get $dir_len)) (i32.eqz (local.get $file_len)))
      (then (return (i32.const 0))))
    (local.set $path (call $heap_alloc
      (i32.add (i32.add (local.get $dir_len) (local.get $file_len)) (i32.const 2))))
    (if (i32.eqz (local.get $path)) (then (return (i32.const 0))))
    (call $guest_strcpy (local.get $path) (local.get $dir))
    (if (i32.ne (call $gl8 (i32.add (local.get $path)
                     (i32.sub (local.get $dir_len) (i32.const 1)))) (i32.const 0x5c))
      (then
        (call $gs8 (i32.add (local.get $path) (local.get $dir_len)) (i32.const 0x5c))
        (local.set $dir_len (i32.add (local.get $dir_len) (i32.const 1)))))
    (call $guest_strcpy (i32.add (local.get $path) (local.get $dir_len)) (local.get $file))
    (local.set $attrs (call $host_fs_get_file_attributes
      (call $g2w (local.get $path)) (i32.const 0)))
    (call $heap_free (local.get $path))
    (i32.ne (local.get $attrs) (i32.const -1)))

  ;; Allocate an ANSI "directory\\leaf" guest path. VERSION.DLL passes the
  ;; directory and bare filename separately to both VerFindFile and
  ;; VerInstallFile; using one join helper keeps their VFS normalization
  ;; identical.
  (func $ver_join_path_a (param $dir i32) (param $file i32) (result i32)
    (local $dir_len i32) (local $file_len i32) (local $path i32)
    (if (i32.or (i32.eqz (local.get $dir)) (i32.eqz (local.get $file)))
      (then (return (i32.const 0))))
    (local.set $dir_len (call $guest_strlen (local.get $dir)))
    (local.set $file_len (call $guest_strlen (local.get $file)))
    (if (i32.eqz (local.get $file_len)) (then (return (i32.const 0))))
    (local.set $path (call $heap_alloc
      (i32.add (i32.add (local.get $dir_len) (local.get $file_len)) (i32.const 2))))
    (if (i32.eqz (local.get $path)) (then (return (i32.const 0))))
    (call $guest_strcpy (local.get $path) (local.get $dir))
    (if (i32.and (i32.ne (local.get $dir_len) (i32.const 0))
          (i32.ne (call $gl8 (i32.add (local.get $path)
                    (i32.sub (local.get $dir_len) (i32.const 1)))) (i32.const 0x5c)))
      (then
        (call $gs8 (i32.add (local.get $path) (local.get $dir_len)) (i32.const 0x5c))
        (local.set $dir_len (i32.add (local.get $dir_len) (i32.const 1)))))
    (call $guest_strcpy (i32.add (local.get $path) (local.get $dir_len)) (local.get $file))
    (local.get $path))

  ;; VerFindFileA(uFlags, file, winDir, appDir, curDir, curLen, destDir,
  ;;              destLen) -> VFF_* bitmask.
  ;;
  ;; Match the Win9x-relevant search order: private files prefer the app,
  ;; Windows, then system directories; shared files prefer SYSTEM and fall
  ;; back to the app only when locating an existing copy. The VFS has no
  ;; cross-process sharing locks, so VFF_FILEINUSE is never raised.
  (func $handle_VerFindFileA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $cur_len_ptr i32) (local $dest_ptr i32) (local $dest_len_ptr i32)
    (local $scratch i32) (local $system_dir i32) (local $windows_dir i32)
    (local $empty i32) (local $cur_dir i32) (local $dest_dir i32)
    (local $required i32) (local $capacity i32) (local $retval i32)
    (local.set $cur_len_ptr (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (local.set $dest_ptr (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
    (local.set $dest_len_ptr (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32))))
    (local.set $scratch (call $heap_alloc (i32.const 64)))
    (if (i32.eqz (local.get $scratch))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 4)) ;; VFF_BUFFTOOSMALL is the closest defined failure
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36)))
        (return)))
    (local.set $system_dir (local.get $scratch))
    (local.set $windows_dir (i32.add (local.get $scratch) (i32.const 24)))
    (local.set $empty (i32.add (local.get $scratch) (i32.const 40)))
    ;; "C:\\WINDOWS\\SYSTEM" and "C:\\WINDOWS".
    (call $gs32 (local.get $system_dir) (i32.const 0x575c3a43))
    (call $gs32 (i32.add (local.get $system_dir) (i32.const 4)) (i32.const 0x4f444e49))
    (call $gs32 (i32.add (local.get $system_dir) (i32.const 8)) (i32.const 0x535c5357))
    (call $gs32 (i32.add (local.get $system_dir) (i32.const 12)) (i32.const 0x45545359))
    (call $gs16 (i32.add (local.get $system_dir) (i32.const 16)) (i32.const 0x004d))
    (call $gs32 (local.get $windows_dir) (i32.const 0x575c3a43))
    (call $gs32 (i32.add (local.get $windows_dir) (i32.const 4)) (i32.const 0x4f444e49))
    (call $gs16 (i32.add (local.get $windows_dir) (i32.const 8)) (i32.const 0x5357))
    (call $gs8 (i32.add (local.get $windows_dir) (i32.const 10)) (i32.const 0))
    (call $gs8 (local.get $empty) (i32.const 0))
    (local.set $cur_dir (local.get $empty))

    (if (i32.and (local.get $arg0) (i32.const 1)) ;; VFFF_ISSHAREDFILE
      (then
        (local.set $dest_dir (local.get $system_dir))
        (if (local.get $arg1)
          (then
            (if (call $ver_file_exists_a (local.get $dest_dir) (local.get $arg1))
              (then (local.set $cur_dir (local.get $dest_dir)))
              (else
                (if (call $ver_file_exists_a (local.get $arg3) (local.get $arg1))
                  (then (local.set $cur_dir (local.get $arg3))))
                (local.set $retval (i32.or (local.get $retval) (i32.const 1))))))))
      (else
        (local.set $dest_dir (select (local.get $arg3) (local.get $empty)
          (i32.ne (local.get $arg3) (i32.const 0))))
        (if (local.get $arg1)
          (then
            (if (call $ver_file_exists_a (local.get $dest_dir) (local.get $arg1))
              (then (local.set $cur_dir (local.get $dest_dir)))
              (else
                (if (call $ver_file_exists_a (local.get $windows_dir) (local.get $arg1))
                  (then (local.set $cur_dir (local.get $windows_dir)))
                  (else
                    (if (call $ver_file_exists_a (local.get $system_dir) (local.get $arg1))
                      (then (local.set $cur_dir (local.get $system_dir))))))))
            (if (i32.and
                  (i32.and (i32.ne (local.get $arg3) (i32.const 0))
                           (i32.ne (call $guest_strlen (local.get $arg3)) (i32.const 0)))
                  (i32.eqz (call $ver_file_exists_a (local.get $arg3) (local.get $arg1))))
              (then (local.set $retval (i32.or (local.get $retval) (i32.const 1)))))))))

    ;; Both length outputs include the trailing NUL. lstrcpynA-compatible
    ;; truncation makes it possible for callers to identify the short buffer.
    (if (i32.and (i32.ne (local.get $dest_len_ptr) (i32.const 0))
                 (i32.ne (local.get $dest_ptr) (i32.const 0)))
      (then
        (local.set $required (i32.add (call $guest_strlen (local.get $dest_dir)) (i32.const 1)))
        (local.set $capacity (call $gl32 (local.get $dest_len_ptr)))
        (if (i32.lt_u (local.get $capacity) (local.get $required))
          (then (local.set $retval (i32.or (local.get $retval) (i32.const 4)))))
        (call $guest_strncpy (local.get $dest_ptr) (local.get $dest_dir) (local.get $capacity))
        (call $gs32 (local.get $dest_len_ptr) (local.get $required))))
    (if (i32.and (i32.ne (local.get $cur_len_ptr) (i32.const 0))
                 (i32.ne (local.get $arg4) (i32.const 0)))
      (then
        (local.set $required (i32.add (call $guest_strlen (local.get $cur_dir)) (i32.const 1)))
        (local.set $capacity (call $gl32 (local.get $cur_len_ptr)))
        (if (i32.lt_u (local.get $capacity) (local.get $required))
          (then (local.set $retval (i32.or (local.get $retval) (i32.const 4)))))
        (call $guest_strncpy (local.get $arg4) (local.get $cur_dir) (local.get $capacity))
        (call $gs32 (local.get $cur_len_ptr) (local.get $required))))
    (call $heap_free (local.get $scratch))
    (i32.store offset=0 (global.get $reg_base) (local.get $retval))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36))))

  ;; VerInstallFileA(flags, srcFile, destFile, srcDir, destDir, curDir,
  ;;                 tmpFile, tmpFileLen) -> VIF_* bitmask.
  ;;
  ;; The Win9x InstallShield path exercised here has already selected the
  ;; destination with VerFindFileA. Install the staged source atomically into
  ;; that destination. VERSION also expands Microsoft Compress SZDD mode-A
  ;; sources: InstallShield 11 writes setup.dl_N.tmp in that form and expects
  ;; VerInstallFileA to turn it into a loadable setup.dll.

  ;; Read one byte through the VFS, returning -1 on EOF/error.
  (func $szdd_read_byte (param $handle i32) (param $byte_ga i32)
                        (param $count_ga i32) (param $count_wa i32) (result i32)
    (i32.store (local.get $count_wa) (i32.const 0))
    (if (i32.eqz (call $host_fs_read_file
          (local.get $handle) (local.get $byte_ga) (i32.const 1) (local.get $count_ga)))
      (then (return (i32.const -1))))
    (if (i32.ne (i32.load (local.get $count_wa)) (i32.const 1))
      (then (return (i32.const -1))))
    (call $gl8 (local.get $byte_ga)))

  ;; Expand an SZDD mode-A source into dest. Returns 1 only when the source
  ;; had a valid header and the declared byte count was fully produced. A
  ;; zero return leaves ordinary files to VerInstallFileA's direct move path.
  (func $szdd_expand_file_a (param $src_wa i32) (param $dest_wa i32) (result i32)
    (local $src i32) (local $dest i32) (local $scratch i32) (local $scratch_wa i32)
    (local $count_ga i32) (local $count_wa i32) (local $byte_ga i32)
    (local $window_ga i32) (local $out_ga i32)
    (local $expected i32) (local $produced i32) (local $window_pos i32) (local $out_pos i32)
    (local $flags i32) (local $bit i32) (local $value i32)
    (local $low i32) (local $packed i32) (local $match i32) (local $length i32) (local $i i32)
    (local $success i32)
    (local.set $src (call $host_fs_create_file
      (local.get $src_wa) (i32.const 0x80000000) (i32.const 3) (i32.const 0x80) (i32.const 0)))
    (if (i32.eq (local.get $src) (i32.const -1))
      (then (return (i32.const 0))))
    ;; header(14), count(4), byte scratch, 4 KiB window, 4 KiB output
    (local.set $scratch (call $heap_alloc (i32.const 8240)))
    (local.set $scratch_wa (call $g2w (local.get $scratch)))
    (local.set $count_ga (i32.add (local.get $scratch) (i32.const 16)))
    (local.set $count_wa (i32.add (local.get $scratch_wa) (i32.const 16)))
    (local.set $byte_ga (i32.add (local.get $scratch) (i32.const 20)))
    (local.set $window_ga (i32.add (local.get $scratch) (i32.const 32)))
    (local.set $out_ga (i32.add (local.get $scratch) (i32.const 4128)))
    (i32.store (local.get $count_wa) (i32.const 0))
    (if (i32.eqz (call $host_fs_read_file
          (local.get $src) (local.get $scratch) (i32.const 14) (local.get $count_ga)))
      (then
        (drop (call $host_fs_close_handle (local.get $src)))
        (call $heap_free (local.get $scratch))
        (return (i32.const 0))))
    (if (i32.or
          (i32.ne (i32.load (local.get $count_wa)) (i32.const 14))
          (i32.or
            (i32.ne (call $gl32 (local.get $scratch)) (i32.const 0x44445A53))
            (i32.or
              (i32.ne (call $gl32 (i32.add (local.get $scratch) (i32.const 4)))
                      (i32.const 0x3327F088))
              (i32.ne (call $gl8 (i32.add (local.get $scratch) (i32.const 8)))
                      (i32.const 0x41)))))
      (then
        (drop (call $host_fs_close_handle (local.get $src)))
        (call $heap_free (local.get $scratch))
        (return (i32.const 0))))
    (local.set $expected (call $gl32 (i32.add (local.get $scratch) (i32.const 10))))
    (if (i32.eqz (local.get $expected))
      (then
        (drop (call $host_fs_close_handle (local.get $src)))
        (call $heap_free (local.get $scratch))
        (return (i32.const 0))))
    (local.set $dest (call $host_fs_create_file
      (local.get $dest_wa) (i32.const 0x40000000) (i32.const 2) (i32.const 0x80) (i32.const 0)))
    (if (i32.eq (local.get $dest) (i32.const -1))
      (then
        (drop (call $host_fs_close_handle (local.get $src)))
        (call $heap_free (local.get $scratch))
        (return (i32.const 0))))
    (memory.fill (call $g2w (local.get $window_ga)) (i32.const 0x20) (i32.const 4096))
    (local.set $window_pos (i32.const 0xFF0))
    (block $failed
      (block $decoded
        (loop $groups
          (br_if $decoded (i32.ge_u (local.get $produced) (local.get $expected)))
          (local.set $flags (call $szdd_read_byte
            (local.get $src) (local.get $byte_ga) (local.get $count_ga) (local.get $count_wa)))
          (br_if $failed (i32.lt_s (local.get $flags) (i32.const 0)))
          (local.set $bit (i32.const 0))
          (loop $bits
            (br_if $decoded (i32.ge_u (local.get $produced) (local.get $expected)))
            (if (i32.ne
                  (i32.and (local.get $flags) (i32.shl (i32.const 1) (local.get $bit)))
                  (i32.const 0))
              (then
                (local.set $value (call $szdd_read_byte
                  (local.get $src) (local.get $byte_ga) (local.get $count_ga) (local.get $count_wa)))
                (br_if $failed (i32.lt_s (local.get $value) (i32.const 0)))
                (call $gs8 (i32.add (local.get $out_ga) (local.get $out_pos)) (local.get $value))
                (local.set $out_pos (i32.add (local.get $out_pos) (i32.const 1)))
                (call $gs8 (i32.add (local.get $window_ga) (local.get $window_pos)) (local.get $value))
                (local.set $window_pos
                  (i32.and (i32.add (local.get $window_pos) (i32.const 1)) (i32.const 0xFFF)))
                (local.set $produced (i32.add (local.get $produced) (i32.const 1))))
              (else
                (local.set $low (call $szdd_read_byte
                  (local.get $src) (local.get $byte_ga) (local.get $count_ga) (local.get $count_wa)))
                (local.set $packed (call $szdd_read_byte
                  (local.get $src) (local.get $byte_ga) (local.get $count_ga) (local.get $count_wa)))
                (br_if $failed (i32.or
                  (i32.lt_s (local.get $low) (i32.const 0))
                  (i32.lt_s (local.get $packed) (i32.const 0))))
                (local.set $match (i32.or (local.get $low)
                  (i32.shl (i32.and (local.get $packed) (i32.const 0xF0)) (i32.const 4))))
                (local.set $length
                  (i32.add (i32.and (local.get $packed) (i32.const 0x0F)) (i32.const 3)))
                (local.set $i (i32.const 0))
                (block $match_done (loop $match_copy
                  (br_if $match_done (i32.ge_u (local.get $i) (local.get $length)))
                  (br_if $match_done (i32.ge_u (local.get $produced) (local.get $expected)))
                  (local.set $value (call $gl8 (i32.add (local.get $window_ga)
                    (i32.and (i32.add (local.get $match) (local.get $i)) (i32.const 0xFFF)))))
                  (call $gs8 (i32.add (local.get $out_ga) (local.get $out_pos)) (local.get $value))
                  (local.set $out_pos (i32.add (local.get $out_pos) (i32.const 1)))
                  (call $gs8 (i32.add (local.get $window_ga) (local.get $window_pos)) (local.get $value))
                  (local.set $window_pos
                    (i32.and (i32.add (local.get $window_pos) (i32.const 1)) (i32.const 0xFFF)))
                  (local.set $produced (i32.add (local.get $produced) (i32.const 1)))
                  ;; A match can straddle the 4 KiB staging boundary. Flush
                  ;; per emitted byte so the longest (18-byte) token cannot
                  ;; overrun the scratch block before the token-level check.
                  (if (i32.eq (local.get $out_pos) (i32.const 4096))
                    (then
                      (i32.store (local.get $count_wa) (i32.const 0))
                      (br_if $failed (i32.eqz (call $host_fs_write_file
                        (local.get $dest) (local.get $out_ga)
                        (local.get $out_pos) (local.get $count_ga))))
                      (br_if $failed
                        (i32.ne (i32.load (local.get $count_wa)) (local.get $out_pos)))
                      (local.set $out_pos (i32.const 0))))
                  (local.set $i (i32.add (local.get $i) (i32.const 1)))
                  (br $match_copy)))))
            (if (i32.eq (local.get $out_pos) (i32.const 4096))
              (then
                (i32.store (local.get $count_wa) (i32.const 0))
                (br_if $failed (i32.eqz (call $host_fs_write_file
                  (local.get $dest) (local.get $out_ga) (local.get $out_pos) (local.get $count_ga))))
                (br_if $failed (i32.ne (i32.load (local.get $count_wa)) (local.get $out_pos)))
                (local.set $out_pos (i32.const 0))))
            (local.set $bit (i32.add (local.get $bit) (i32.const 1)))
            (br_if $bits (i32.lt_u (local.get $bit) (i32.const 8))))
          (br $groups)))
      (if (local.get $out_pos)
        (then
          (i32.store (local.get $count_wa) (i32.const 0))
          (br_if $failed (i32.eqz (call $host_fs_write_file
            (local.get $dest) (local.get $out_ga) (local.get $out_pos) (local.get $count_ga))))
          (br_if $failed (i32.ne (i32.load (local.get $count_wa)) (local.get $out_pos)))))
      (local.set $success (i32.const 1)))
    (drop (call $host_fs_close_handle (local.get $src)))
    (drop (call $host_fs_close_handle (local.get $dest)))
    (if (local.get $success)
      (then (drop (call $host_fs_delete_file (local.get $src_wa) (i32.const 0))))
      (else (drop (call $host_fs_delete_file (local.get $dest_wa) (i32.const 0)))))
    (call $heap_free (local.get $scratch))
    (local.get $success))

  ;; The in-memory VFS has neither sharing locks nor disk exhaustion, so only
  ;; observable read-source / generic-create failures remain; success is zero.
  (func $handle_VerInstallFileA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $tmp_file i32) (local $tmp_len_ptr i32)
    (local $src_path i32) (local $dest_path i32) (local $retval i32) (local $src_wa i32) (local $dest_wa i32)
    (local.set $tmp_file (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
    (local.set $tmp_len_ptr (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32))))
    ;; No temporary file is left behind on the direct-install path.
    (if (local.get $tmp_file) (then (call $gs8 (local.get $tmp_file) (i32.const 0))))
    (if (local.get $tmp_len_ptr) (then (call $gs32 (local.get $tmp_len_ptr) (i32.const 1))))
    (local.set $src_path (call $ver_join_path_a (local.get $arg3) (local.get $arg1)))
    (local.set $dest_path (call $ver_join_path_a (local.get $arg4) (local.get $arg2)))
    (if (i32.or (i32.eqz (local.get $src_path))
                (i32.eqz (local.get $dest_path)))
      (then (local.set $retval (i32.const 0x8000))) ;; VIF_OUTOFMEMORY
      (else (local.set $src_wa (call $g2w (local.get $src_path))) (local.set $dest_wa (call $g2w (local.get $dest_path)))
        (if (i32.eq
              (call $host_fs_get_file_attributes
                (local.get $src_wa) (i32.const 0))
              (i32.const -1))
          (then (local.set $retval (i32.const 0x10000))) ;; VIF_CANNOTREADSRC
          (else
            (if (i32.eqz (call $szdd_expand_file_a
                  (local.get $src_wa) (local.get $dest_wa)))
              (then
                (if (i32.eqz (call $host_fs_move_file
                      (local.get $src_wa)
                      (local.get $dest_wa) (i32.const 0)))
                  (then (local.set $retval (i32.const 0x800)))))))))) ;; VIF_CANNOTCREATE
    (if (local.get $src_path) (then (call $heap_free (local.get $src_path))))
    (if (local.get $dest_path) (then (call $heap_free (local.get $dest_path))))
    (i32.store offset=0 (global.get $reg_base) (local.get $retval))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36))))

  ;; Resolve an ordinal requested from a pseudo handle returned for a
  ;; statically dispatched system DLL. Returns one when the handle/ordinal
  ;; pair was consumed, including an unsupported ordinal whose Win32 result is
  ;; NULL. Heaven Seven uses this path for DSOUND.#1 (DirectSoundCreate).
  (func $resolve_static_module_ordinal (param $module i32) (param $ordinal i32) (result i32)
    (local $idx i32) (local $dll_name_wa i32) (local $api_id i32) (local $thunk_wa i32)
    (if (i32.ge_u (local.get $ordinal) (i32.const 0x10000))
      (then (return (i32.const 0))))
    (local.set $idx (call $static_sys_dll_from_handle (local.get $module)))
    (if (i32.eqz (local.get $idx)) (then (return (i32.const 0))))
    (local.set $dll_name_wa (call $static_sys_dll_name_at
      (i32.sub (local.get $idx) (i32.const 1))))
    (local.set $api_id (call $resolve_import_ordinal
      (call $w2g (local.get $dll_name_wa)) (local.get $dll_name_wa) (local.get $ordinal)))
    (if (i32.ne (local.get $api_id) (i32.const -1))
      (then
        ;; GetProcAddress runs on any thread: reserve the index process-wide.
        (global.set $num_thunks (call $thunk_reserve))
        (local.set $thunk_wa (i32.add (global.get $THUNK_BASE)
          (i32.mul (global.get $num_thunks) (i32.const 8))))
        (i32.store (local.get $thunk_wa)
          (i32.or (i32.const 0x80000000) (local.get $ordinal)))
        (i32.store offset=4 (local.get $thunk_wa) (local.get $api_id))
        (i32.store offset=0 (global.get $reg_base) (i32.add
          (i32.sub (local.get $thunk_wa) (global.get $GUEST_BASE))
          (global.get $image_base)))
        (global.set $num_thunks (i32.add (global.get $num_thunks) (i32.const 1)))
        (call $update_thunk_end)))
    (i32.const 1))

  ;; CopyIcon creates a private handle even when the source came from a shared
  ;; module resource. ICON_TABLE's high resource-id bit marks those private
  ;; slots; real Win9x resource ids are 16-bit integers. Built icons/cursors
  ;; instead clone their owned bitmap planes into an independent CURSOR_TABLE
  ;; record. Opaque system handles get a private wrapper so identity/lifetime
  ;; are still correct even though this renderer has no pixels for them.
  (func $icon_table_record (param $handle i32) (result i32)
    (local $slot i32) (local $record i32)
    (if (i32.ne (i32.and (local.get $handle) (i32.const 0xFFFF0000))
                (global.get $ICON_HANDLE_TAG))
      (then (return (i32.const 0))))
    (local.set $slot (i32.and (local.get $handle) (i32.const 0xFFFF)))
    (if (i32.ge_u (local.get $slot) (global.get $MAX_ICONS))
      (then (return (i32.const 0))))
    (local.set $record (i32.add (global.get $ICON_TABLE)
      (i32.mul (local.get $slot) (i32.const 8))))
    (if (i32.eqz (i32.load offset=4 (local.get $record)))
      (then (return (i32.const 0))))
    (local.get $record))

  (func $icon_copy_handle (param $handle i32) (result i32)
    (local $record i32) (local $mask i32) (local $color i32)
    (local $hinst i32) (local $resid i32) (local $copy i32)
    (if (i32.eqz (local.get $handle)) (then (return (i32.const 0))))
    (local.set $record (call $cursor_record (local.get $handle)))
    (if (local.get $record)
      (then
        (local.set $mask
          (call $gdi_bitmap_clone_owned (i32.load offset=12 (local.get $record))))
        (if (i32.eqz (local.get $mask)) (then (return (i32.const 0))))
        (if (i32.load offset=16 (local.get $record))
          (then
            (local.set $color (call $gdi_bitmap_clone_owned
              (i32.load offset=16 (local.get $record))))
            (if (i32.eqz (local.get $color))
              (then
                (drop (call $gdi_object_delete_full (local.get $mask)))
                (return (i32.const 0))))))
        (local.set $copy (call $cursor_intern
          (i32.load (local.get $record))
          (i32.load offset=4 (local.get $record))
          (i32.load offset=8 (local.get $record))
          (local.get $mask) (local.get $color)))
        (if (i32.eqz (local.get $copy))
          (then
            (drop (call $gdi_object_delete_full (local.get $mask)))
            (if (local.get $color)
              (then (drop (call $gdi_object_delete_full (local.get $color)))))))
        (return (local.get $copy))))
    (local.set $record (call $icon_table_record (local.get $handle)))
    (if (local.get $record)
      (then
        (local.set $hinst (i32.load (local.get $record)))
        (local.set $resid (i32.and (i32.load offset=4 (local.get $record))
          (i32.const 0x7FFFFFFF))))
      (else
        ;; Do not resurrect a stale handle from either private table.
        (if (i32.or
              (i32.eq (i32.and (local.get $handle) (i32.const 0xFFFF0000))
                (global.get $ICON_HANDLE_TAG))
              (i32.eq (i32.and (local.get $handle) (i32.const 0xFFFF0000))
                (global.get $CURSOR_HANDLE_TAG)))
          (then (return (i32.const 0))))
        (local.set $hinst (global.get $ICON_FROM_OPAQUE))
        (local.set $resid (local.get $handle))))
    (if (i32.eq (local.get $hinst) (global.get $ICON_FROM_BITMAP))
      (then
        (local.set $resid (call $gdi_bitmap_clone_owned (local.get $resid)))
        (if (i32.eqz (local.get $resid)) (then (return (i32.const 0))))))
    (call $icon_private_slot (local.get $hinst) (local.get $resid)))

  (func $icon_destroy_handle (param $handle i32) (result i32)
    (local $record i32) (local $resid i32)
    (if (i32.eq
          (i32.and (local.get $handle) (i32.const 0xFFFF0000))
          (global.get $CURSOR_HANDLE_TAG))
      (then (return (call $cursor_destroy (local.get $handle)))))
    (if (i32.eq
          (i32.and (local.get $handle) (i32.const 0xFFFF0000))
          (global.get $ICON_HANDLE_TAG))
      (then
        (local.set $record (call $icon_table_record (local.get $handle)))
        (if (i32.eqz (local.get $record)) (then (return (i32.const 0))))
        (local.set $resid (i32.load offset=4 (local.get $record)))
        ;; A loaded icon is shared and remains valid; a copied slot is private.
        (if (i32.and (local.get $resid) (i32.const 0x80000000))
          (then
            (if (i32.eq (i32.load (local.get $record))
                        (global.get $ICON_FROM_BITMAP))
              (then (drop (call $gdi_object_delete_full
                (i32.and (local.get $resid) (i32.const 0x7FFFFFFF))))))
            (memory.fill (local.get $record) (i32.const 0) (i32.const 8))))
        (return (i32.const 1))))
    ;; Preserve the historical no-op success for shared opaque handles.
    (i32.ne (local.get $handle) (i32.const 0)))

  ;; Allocate a private ICON_TABLE slot. The resource-id high bit is ownership,
  ;; never part of a Win9x integer resource id or one of this runtime's compact
  ;; GDI/opaque handles. Bitmap wrappers transfer their cloned bitmap to the
  ;; slot; failure releases it here so callers have one ownership rule.
  (func $icon_private_slot (param $hinst i32) (param $resid i32) (result i32)
    (local $i i32) (local $record i32)
    (block $found (loop $scan
      (br_if $found (i32.ge_u (local.get $i) (global.get $MAX_ICONS)))
      (local.set $record (i32.add (global.get $ICON_TABLE)
        (i32.mul (local.get $i) (i32.const 8))))
      (if (i32.eqz (i32.load offset=4 (local.get $record)))
        (then
          (i32.store (local.get $record) (local.get $hinst))
          (i32.store offset=4 (local.get $record)
            (i32.or (local.get $resid) (i32.const 0x80000000)))
          (return (i32.or (global.get $ICON_HANDLE_TAG) (local.get $i)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (if (i32.eq (local.get $hinst) (global.get $ICON_FROM_BITMAP))
      (then (drop (call $gdi_object_delete_full (local.get $resid)))))
    (i32.const 0))

  ;; CopyImage's private wrapper for a shared LoadCursor handle must remain
  ;; visually identical when SetCursor reaches the browser. Unwrap only the
  ;; cursor marker; an ordinary copied icon is not a cursor by accident.
  (func $icon_opaque_cursor_source (param $handle i32) (result i32)
    (local $record i32)
    (local.set $record (call $icon_table_record (local.get $handle)))
    (if (i32.and (i32.ne (local.get $record) (i32.const 0))
          (i32.eq (i32.load (local.get $record))
            (i32.add (global.get $ICON_FROM_OPAQUE) (i32.const 1))))
      (then (return (i32.and (i32.load offset=4 (local.get $record))
        (i32.const 0x7FFFFFFF)))))
    (local.get $handle))

  ;; Allocate and resample a bitmap into a new DDB, or a DIB section when
  ;; LR_CREATEDIBSECTION requests one. This is the common IMAGE_BITMAP copy
  ;; path: the source is never consumed here, so LR_COPYDELETEORG can delete it
  ;; only after the new object and its pixels exist.
  (func $copy_image_bitmap (param $handle i32) (param $want_w i32)
        (param $want_h i32) (param $flags i32) (result i32)
    (local $record i32) (local $src_w i32) (local $src_h i32)
    (local $src_bpp i32) (local $dst_bpp i32) (local $src_flags i32)
    (local $stride i32) (local $copy i32) (local $src i32) (local $dst i32)
    (local $row_bits i64) (local $stride64 i64) (local $size64 i64)
    (local.set $record (call $gdi_object_record (local.get $handle)))
    (if (i32.eqz (call $gdi_bitmap_record_valid (local.get $record)))
      (then (return (i32.const 0))))
    (local.set $src_w (load.field.memarg GdiBitmap width (local.get $record)))
    (local.set $src_h (load.field.memarg GdiBitmap height (local.get $record)))
    (local.set $src_bpp (load.field.memarg GdiBitmap bpp (local.get $record)))
    (local.set $src_flags (load.field.memarg GdiBitmap flags (local.get $record)))
    (if (i32.eqz (local.get $want_w)) (then (local.set $want_w (local.get $src_w))))
    (if (i32.eqz (local.get $want_h)) (then (local.set $want_h (local.get $src_h))))
    (if (i32.or (i32.le_s (local.get $want_w) (i32.const 0))
          (i32.le_s (local.get $want_h) (i32.const 0)))
      (then (return (i32.const 0))))
    (local.set $dst_bpp (select (i32.const 1) (local.get $src_bpp)
      (i32.ne (i32.and (local.get $flags) (i32.const 0x0001)) (i32.const 0))))
    ;; LR_COPYRETURNORG is about whether the existing object already satisfies
    ;; the requested dimensions/depth. LR_COPYDELETEORG is explicitly ignored
    ;; on this branch by USER.
    (if (i32.and
          (i32.ne (i32.and (local.get $flags) (i32.const 0x0004)) (i32.const 0))
          (i32.and
            (i32.and (i32.eq (local.get $want_w) (local.get $src_w))
              (i32.eq (local.get $want_h) (local.get $src_h)))
            (i32.and (i32.eq (local.get $dst_bpp) (local.get $src_bpp))
              (i32.or
                (i32.eqz (i32.and (local.get $flags) (i32.const 0x2000)))
                (i32.ne (i32.and (local.get $src_flags) (i32.const 1))
                  (i32.const 0))))))
      (then (return (local.get $handle))))
    (local.set $row_bits (i64.mul (i64.extend_i32_u (local.get $want_w))
      (i64.extend_i32_u (local.get $dst_bpp))))
    (local.set $stride64 (i64.shl
      (i64.shr_u (i64.add (local.get $row_bits) (i64.const 31)) (i64.const 5))
      (i64.const 2)))
    (local.set $size64 (i64.mul (local.get $stride64)
      (i64.extend_i32_u (local.get $want_h))))
    (if (i32.or (i64.eqz (local.get $size64))
          (i64.gt_u (local.get $size64)
            (i64.extend_i32_u (global.get $DIB_BACKING_BASE_SIZE))))
      (then (return (i32.const 0))))
    (local.set $stride (i32.wrap_i64 (local.get $stride64)))
    (memory.fill (global.get $GDI_BITMAP_PLAN) (i32.const 0) (i32.const 48))
    (i32.store (global.get $GDI_BITMAP_PLAN) (local.get $want_w))
    (i32.store offset=4 (global.get $GDI_BITMAP_PLAN) (local.get $want_h))
    (i32.store offset=8 (global.get $GDI_BITMAP_PLAN) (local.get $dst_bpp))
    (i32.store offset=12 (global.get $GDI_BITMAP_PLAN)
      (i32.and (local.get $src_flags) (i32.const 2)))
    (i32.store offset=16 (global.get $GDI_BITMAP_PLAN) (local.get $stride))
    (if (i32.eq (local.get $dst_bpp) (local.get $src_bpp))
      (then
        (i32.store offset=20 (global.get $GDI_BITMAP_PLAN)
          (load.field.memarg GdiBitmap palette (local.get $record)))
        (i32.store offset=24 (global.get $GDI_BITMAP_PLAN)
          (load.field.memarg GdiBitmap palette_count (local.get $record)))))
    (i32.store offset=32 (global.get $GDI_BITMAP_PLAN) (i32.wrap_i64 (local.get $size64)))
    (local.set $copy (call $gdi_bitmap_create_owned (global.get $GDI_BITMAP_PLAN)
      (i32.const 0) (i32.const 0)
      (i32.and (i32.eq (local.get $dst_bpp) (local.get $src_bpp))
        (i32.ne (load.field.memarg GdiBitmap palette_count (local.get $record))
          (i32.const 0)))
      (select (i32.const 1) (i32.const 0)
        (i32.ne (i32.and (local.get $flags) (i32.const 0x2000)) (i32.const 0)))
      (select (i32.const 3) (i32.const 0)
        (i32.ne (i32.and (local.get $src_flags) (i32.const 0x10)) (i32.const 0)))
      (i32.const 0)))
    (if (i32.eqz (local.get $copy)) (then (return (i32.const 0))))
    (local.set $src (global.get $GDI_BLIT_SRC_DESC))
    (local.set $dst (global.get $GDI_BLIT_DST_DESC))
    (if (i32.or
          (i32.eqz (call $gdi_raster_desc_from_bitmap (local.get $handle) (local.get $src)))
          (i32.eqz (call $gdi_raster_desc_from_bitmap (local.get $copy) (local.get $dst))))
      (then
        (drop (call $gdi_object_delete_full (local.get $copy)))
        (return (i32.const 0))))
    (if (i32.eqz (call $gdi_raster_stretch_blt
          (i32.const 0) (i32.const 0) (local.get $dst)
          (i32.const 0) (i32.const 0) (local.get $want_w) (local.get $want_h)
          (local.get $src) (i32.const 0) (i32.const 0)
          (local.get $src_w) (local.get $src_h)
          (i32.const 0) (i32.const 0x00CC0020)))
      (then
        (drop (call $gdi_object_delete_full (local.get $copy)))
        (return (i32.const 0))))
    (if (i32.and (local.get $flags) (i32.const 0x0008))
      (then (drop (call $gdi_object_delete_full (local.get $handle)))))
    (local.get $copy))

  ;; Convert a color icon/cursor to the two stacked 1-bpp AND/XOR planes USER
  ;; exposes for a monochrome image. Nearest-neighbour source selection matches
  ;; the ordinary CopyImage stretch; a luminance split chooses black/white for
  ;; opaque color pixels while the original AND mask retains transparency.
  (func $copy_image_monochrome_planes (param $record i32) (param $want_w i32)
        (param $want_h i32) (result i32)
    (local $src_w i32) (local $src_h i32) (local $stride i32)
    (local $mask_handle i32) (local $color_handle i32) (local $copy i32)
    (local $mask i32) (local $color i32) (local $dst i32)
    (local $x i32) (local $y i32) (local $sx i32) (local $sy i32)
    (local $and_bit i32) (local $xor_bit i32) (local $rgb i32) (local $luma i32)
    (local.set $src_w (call $cursor_width (local.get $record)))
    (local.set $src_h (call $cursor_height (local.get $record)))
    (local.set $mask_handle (i32.load offset=12 (local.get $record)))
    (local.set $color_handle (i32.load offset=16 (local.get $record)))
    (local.set $stride (i32.shl
      (i32.shr_u (i32.add (local.get $want_w) (i32.const 31)) (i32.const 5))
      (i32.const 2)))
    (memory.fill (global.get $GDI_BITMAP_PLAN) (i32.const 0) (i32.const 48))
    (i32.store (global.get $GDI_BITMAP_PLAN) (local.get $want_w))
    (i32.store offset=4 (global.get $GDI_BITMAP_PLAN)
      (i32.shl (local.get $want_h) (i32.const 1)))
    (i32.store offset=8 (global.get $GDI_BITMAP_PLAN) (i32.const 1))
    (i32.store offset=12 (global.get $GDI_BITMAP_PLAN) (i32.const 2)) ;; top-down
    (i32.store offset=16 (global.get $GDI_BITMAP_PLAN) (local.get $stride))
    (i32.store offset=32 (global.get $GDI_BITMAP_PLAN)
      (i32.mul (local.get $stride) (i32.shl (local.get $want_h) (i32.const 1))))
    (local.set $copy (call $gdi_bitmap_create_owned (global.get $GDI_BITMAP_PLAN)
      (i32.const 0) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0)))
    (if (i32.eqz (local.get $copy)) (then (return (i32.const 0))))
    (local.set $mask (global.get $CURSOR_MASK_DESC))
    (local.set $color (global.get $CURSOR_COLOR_DESC))
    (local.set $dst (global.get $GDI_BLIT_DST_DESC))
    (if (i32.or
          (i32.eqz (call $gdi_raster_desc_from_bitmap
            (local.get $mask_handle) (local.get $mask)))
          (i32.or
            (i32.eqz (call $gdi_raster_desc_from_bitmap (local.get $copy) (local.get $dst)))
            (i32.and (i32.ne (local.get $color_handle) (i32.const 0))
              (i32.eqz (call $gdi_raster_desc_from_bitmap
                (local.get $color_handle) (local.get $color))))))
      (then
        (drop (call $gdi_object_delete_full (local.get $copy)))
        (return (i32.const 0))))
    (block $rows_done (loop $rows
      (br_if $rows_done (i32.ge_u (local.get $y) (local.get $want_h)))
      (local.set $sy (i32.div_u (i32.mul (local.get $y) (local.get $src_h))
        (local.get $want_h)))
      (local.set $x (i32.const 0))
      (block $cols_done (loop $cols
        (br_if $cols_done (i32.ge_u (local.get $x) (local.get $want_w)))
        (local.set $sx (i32.div_u (i32.mul (local.get $x) (local.get $src_w))
          (local.get $want_w)))
        (local.set $and_bit (call $gdi_raster_read_index (local.get $mask)
          (local.get $sx) (call $cursor_plane_row (local.get $mask_handle)
            (local.get $mask) (local.get $sy))))
        (if (i32.lt_s (local.get $and_bit) (i32.const 0))
          (then (local.set $and_bit (i32.const 1))))
        (local.set $xor_bit (i32.const 0))
        (if (local.get $color_handle)
          (then
            (if (i32.eqz (local.get $and_bit))
              (then
                (local.set $rgb (call $gdi_raster_read (local.get $color)
                  (local.get $sx) (call $cursor_plane_row (local.get $color_handle)
                    (local.get $color) (local.get $sy))))
                (if (i32.ge_s (local.get $rgb) (i32.const 0))
                  (then
                    (local.set $luma (i32.add
                      (i32.mul (i32.and (i32.shr_u (local.get $rgb) (i32.const 16))
                        (i32.const 255)) (i32.const 30))
                      (i32.add
                        (i32.mul (i32.and (i32.shr_u (local.get $rgb) (i32.const 8))
                          (i32.const 255)) (i32.const 59))
                        (i32.mul (i32.and (local.get $rgb) (i32.const 255))
                          (i32.const 11)))))
                    (local.set $xor_bit
                      (i32.ge_u (local.get $luma) (i32.const 12800))))))))
          (else
            (local.set $xor_bit (call $gdi_raster_read_index (local.get $mask)
              (local.get $sx) (call $cursor_plane_row (local.get $mask_handle)
                (local.get $mask) (i32.add (local.get $sy) (local.get $src_h)))))
            (if (i32.lt_s (local.get $xor_bit) (i32.const 0))
              (then (local.set $xor_bit (i32.const 0))))))
        (drop (call $gdi_raster_write_index (local.get $dst)
          (local.get $x) (local.get $y) (local.get $and_bit)))
        (drop (call $gdi_raster_write_index (local.get $dst)
          (local.get $x) (i32.add (local.get $y) (local.get $want_h))
          (local.get $xor_bit)))
        (local.set $x (i32.add (local.get $x) (i32.const 1)))
        (br $cols)))
      (local.set $y (i32.add (local.get $y) (i32.const 1)))
      (br $rows)))
    (local.get $copy))

  ;; Materialize an ICON_TABLE module resource into CURSOR_TABLE bitmap planes.
  ;; LoadIcon's current image is the first RT_GROUP_ICON entry. Ordinary
  ;; CopyImage stretches that image; LR_COPYFROMRESOURCE instead starts from
  ;; the entry whose native dimensions are closest to the requested size.
  (func $copy_image_resource_icon (param $handle i32) (param $record i32)
        (param $want_w i32) (param $want_h i32) (param $flags i32) (result i32)
    (local $hinst i32) (local $resid i32) (local $group i32) (local $group_size i32)
    (local $count i32) (local $entry i32) (local $selected i32) (local $i i32)
    (local $entry_w i32) (local $entry_h i32) (local $current_w i32)
    (local $current_h i32) (local $current_bpp i32) (local $score i32)
    (local $best_score i32) (local $image i32) (local $image_size i32)
    (local $image_id i32) (local $copy i32) (local $mono i32)
    (local.set $hinst (i32.load (local.get $record)))
    (local.set $resid (i32.and (i32.load offset=4 (local.get $record))
      (i32.const 0x7FFFFFFF)))
    (if (i32.or
          (i32.or (i32.eq (local.get $hinst) (global.get $ICON_FROM_BITMAP))
            (i32.eq (local.get $hinst) (global.get $ICON_FROM_OPAQUE)))
          (i32.or
            (i32.eq (local.get $hinst)
              (i32.add (global.get $ICON_FROM_OPAQUE) (i32.const 1)))
            (i32.eq (i32.and (local.get $hinst) (i32.const 0xFF000000))
              (global.get $ICON_FROM_WIN16))))
      (then (return (i32.const 0))))
    (call $push_rsrc_ctx (local.get $hinst))
    (block $done
      (local.set $group (call $rsrc_find_data_wa (i32.const 14) (local.get $resid)))
      (local.set $group_size (global.get $rsrc_last_size))
      (br_if $done (i32.or (i32.eqz (local.get $group))
        (i32.lt_u (local.get $group_size) (i32.const 20))))
      (local.set $count (i32.load16_u offset=4 (local.get $group)))
      (br_if $done (i32.or (i32.eqz (local.get $count))
        (i32.gt_u (local.get $count) (i32.const 256))))
      (br_if $done (i32.gt_u
        (i32.add (i32.const 6) (i32.mul (local.get $count) (i32.const 14)))
        (local.get $group_size)))
      (local.set $entry (i32.add (local.get $group) (i32.const 6)))
      (local.set $selected (local.get $entry))
      (local.set $current_w (i32.load8_u (local.get $entry)))
      (local.set $current_h (i32.load8_u offset=1 (local.get $entry)))
      (local.set $current_bpp (i32.load16_u offset=6 (local.get $entry)))
      (if (i32.eqz (local.get $current_w)) (then (local.set $current_w (i32.const 256))))
      (if (i32.eqz (local.get $current_h)) (then (local.set $current_h (i32.const 256))))
      (if (i32.eqz (local.get $want_w))
        (then (local.set $want_w (select (i32.const 32) (local.get $current_w)
          (i32.ne (i32.and (local.get $flags) (i32.const 0x0040)) (i32.const 0))))))
      (if (i32.eqz (local.get $want_h))
        (then (local.set $want_h (select (i32.const 32) (local.get $current_h)
          (i32.ne (i32.and (local.get $flags) (i32.const 0x0040)) (i32.const 0))))))
      (br_if $done (i32.or
        (i32.or (i32.le_s (local.get $want_w) (i32.const 0))
          (i32.gt_s (local.get $want_w) (i32.const 256)))
        (i32.or (i32.le_s (local.get $want_h) (i32.const 0))
          (i32.gt_s (local.get $want_h) (i32.const 256)))))
      (if (i32.and
            (i32.ne (i32.and (local.get $flags) (i32.const 0x0004)) (i32.const 0))
            (i32.and
              (i32.and (i32.eq (local.get $want_w) (local.get $current_w))
                (i32.eq (local.get $want_h) (local.get $current_h)))
              (i32.or (i32.eqz (i32.and (local.get $flags) (i32.const 0x0001)))
                (i32.le_u (local.get $current_bpp) (i32.const 1)))))
        (then
          (local.set $copy (local.get $handle))
          (br $done)))
      (if (i32.and (local.get $flags) (i32.const 0x4000))
        (then
          (local.set $best_score (i32.const 0x7FFFFFFF))
          (local.set $i (i32.const 0))
          (block $entries_done (loop $entries
            (br_if $entries_done (i32.ge_u (local.get $i) (local.get $count)))
            (local.set $entry (i32.add (i32.add (local.get $group) (i32.const 6))
              (i32.mul (local.get $i) (i32.const 14))))
            (local.set $entry_w (i32.load8_u (local.get $entry)))
            (local.set $entry_h (i32.load8_u offset=1 (local.get $entry)))
            (if (i32.eqz (local.get $entry_w)) (then (local.set $entry_w (i32.const 256))))
            (if (i32.eqz (local.get $entry_h)) (then (local.set $entry_h (i32.const 256))))
            (local.set $score (i32.add
              (select (i32.sub (local.get $entry_w) (local.get $want_w))
                (i32.sub (local.get $want_w) (local.get $entry_w))
                (i32.gt_u (local.get $entry_w) (local.get $want_w)))
              (select (i32.sub (local.get $entry_h) (local.get $want_h))
                (i32.sub (local.get $want_h) (local.get $entry_h))
                (i32.gt_u (local.get $entry_h) (local.get $want_h)))))
            (if (i32.lt_u (local.get $score) (local.get $best_score))
              (then
                (local.set $best_score (local.get $score))
                (local.set $selected (local.get $entry))))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $entries)))))
      (local.set $image_id (i32.load16_u offset=12 (local.get $selected)))
      (local.set $image (call $rsrc_find_data_wa (i32.const 3) (local.get $image_id)))
      (local.set $image_size (global.get $rsrc_last_size))
      (br_if $done (i32.or (i32.eqz (local.get $image))
        (i32.lt_u (local.get $image_size) (i32.const 12))))
      (local.set $copy (call $cursor_create_from_resource
        (call $w2g (local.get $image)) (local.get $image_size) (i32.const 1)
        (i32.const 0x00030000) (local.get $want_w) (local.get $want_h)
        (i32.const 0))))
    (call $pop_rsrc_ctx)
    (if (i32.and
          (i32.and (i32.ne (local.get $copy) (i32.const 0))
            (i32.ne (local.get $copy) (local.get $handle)))
          (i32.ne (i32.and (local.get $flags) (i32.const 0x0001)) (i32.const 0)))
      (then
        ;; The resource decoder preserves native color. Convert that private
        ;; intermediate through the same plane path, consuming it on success.
        (local.set $mono (call $copy_image_icon_cursor (local.get $copy)
          (i32.const 1) (local.get $want_w) (local.get $want_h)
          (i32.const 0x0009)))
        (if (local.get $mono)
          (then (local.set $copy (local.get $mono)))
          (else
            (drop (call $icon_destroy_handle (local.get $copy)))
            (local.set $copy (i32.const 0))))))
    (local.get $copy))

  (func $copy_image_icon_cursor (param $handle i32) (param $type i32)
        (param $want_w i32) (param $want_h i32) (param $flags i32) (result i32)
    (local $record i32) (local $table_record i32) (local $src_w i32) (local $src_h i32)
    (local $mask i32) (local $color i32) (local $copy i32)
    (local $is_icon i32) (local $xhot i32) (local $yhot i32)
    (local.set $is_icon (i32.eq (local.get $type) (i32.const 1)))
    (local.set $record (call $cursor_record (local.get $handle)))
    (if (local.get $record)
      (then
        (if (i32.ne (i32.ne (i32.load (local.get $record)) (i32.const 0))
              (local.get $is_icon))
          (then (return (i32.const 0))))
        (local.set $src_w (call $cursor_width (local.get $record)))
        (local.set $src_h (call $cursor_height (local.get $record)))
        (if (i32.eqz (local.get $want_w))
          (then (local.set $want_w (select (i32.const 32) (local.get $src_w)
            (i32.ne (i32.and (local.get $flags) (i32.const 0x0040)) (i32.const 0))))))
        (if (i32.eqz (local.get $want_h))
          (then (local.set $want_h (select (i32.const 32) (local.get $src_h)
            (i32.ne (i32.and (local.get $flags) (i32.const 0x0040)) (i32.const 0))))))
        (if (i32.or (i32.le_s (local.get $want_w) (i32.const 0))
              (i32.or (i32.gt_s (local.get $want_w) (i32.const 256))
                (i32.or (i32.le_s (local.get $want_h) (i32.const 0))
                  (i32.gt_s (local.get $want_h) (i32.const 256)))))
          (then (return (i32.const 0))))
        (if (i32.and
              (i32.ne (i32.and (local.get $flags) (i32.const 0x0004)) (i32.const 0))
              (i32.and
                (i32.and (i32.eq (local.get $want_w) (local.get $src_w))
                  (i32.eq (local.get $want_h) (local.get $src_h)))
                (i32.or (i32.eqz (i32.and (local.get $flags) (i32.const 0x0001)))
                  (i32.eqz (i32.load offset=16 (local.get $record))))))
          (then (return (local.get $handle))))
        (if (i32.and (i32.and (local.get $flags) (i32.const 0x0001))
              (i32.ne (i32.load offset=16 (local.get $record)) (i32.const 0)))
          (then
            (local.set $mask (call $copy_image_monochrome_planes
              (local.get $record) (local.get $want_w) (local.get $want_h))))
          (else
            (if (i32.load offset=16 (local.get $record))
              (then
                (local.set $color (call $gdi_bitmap_clone_owned
                  (i32.load offset=16 (local.get $record))))
                (if (local.get $color)
                  (then (local.set $color (call $cursor_scale_bitmap
                    (local.get $color) (local.get $want_w) (local.get $want_h)))))))
            (if (i32.or (i32.eqz (i32.load offset=16 (local.get $record)))
                  (local.get $color))
              (then
                (local.set $mask (call $gdi_bitmap_clone_owned
                  (i32.load offset=12 (local.get $record))))
                (if (local.get $mask)
                  (then (local.set $mask (call $cursor_scale_bitmap
                    (local.get $mask) (local.get $want_w)
                    (select (i32.shl (local.get $want_h) (i32.const 1))
                      (local.get $want_h) (i32.eqz (local.get $color)))))))))))
        (if (i32.eqz (local.get $mask))
          (then
            (if (local.get $color)
              (then (drop (call $gdi_object_delete_full (local.get $color)))))
            (return (i32.const 0))))
        (if (local.get $is_icon)
          (then
            (local.set $xhot (i32.shr_u (local.get $want_w) (i32.const 1)))
            (local.set $yhot (i32.shr_u (local.get $want_h) (i32.const 1))))
          (else
            (local.set $xhot (i32.wrap_i64 (i64.div_u
              (i64.mul (i64.extend_i32_u (i32.load offset=4 (local.get $record)))
                (i64.extend_i32_u (local.get $want_w)))
              (i64.extend_i32_u (local.get $src_w)))))
            (local.set $yhot (i32.wrap_i64 (i64.div_u
              (i64.mul (i64.extend_i32_u (i32.load offset=8 (local.get $record)))
                (i64.extend_i32_u (local.get $want_h)))
              (i64.extend_i32_u (local.get $src_h)))))))
        (local.set $copy (call $cursor_intern (local.get $is_icon)
          (local.get $xhot) (local.get $yhot) (local.get $mask) (local.get $color)))
        (if (i32.eqz (local.get $copy))
          (then
            (drop (call $gdi_object_delete_full (local.get $mask)))
            (if (local.get $color)
              (then (drop (call $gdi_object_delete_full (local.get $color)))))
            (return (i32.const 0))))
        (if (i32.and (local.get $flags) (i32.const 0x0008))
          (then (drop (call $icon_destroy_handle (local.get $handle)))))
        (return (local.get $copy))))
    ;; LoadIcon/LoadCursor sources are shared opaque/resource handles in this
    ;; runtime. Their Win98 default extent is 32x32. Never claim a differently
    ;; sized or monochrome result without pixels to back it; exact copies still
    ;; get independent ownership and cursor wrappers unwrap on presentation.
    (if (i32.eqz (local.get $handle)) (then (return (i32.const 0))))
    (local.set $table_record (call $icon_table_record (local.get $handle)))
    (if (local.get $table_record)
      (then
        (if (i32.eq (local.get $is_icon)
              (i32.eq (i32.load (local.get $table_record))
                (i32.add (global.get $ICON_FROM_OPAQUE) (i32.const 1))))
          (then (return (i32.const 0))))
        (if (local.get $is_icon)
          (then
            (local.set $copy (call $copy_image_resource_icon
              (local.get $handle) (local.get $table_record)
              (local.get $want_w) (local.get $want_h) (local.get $flags)))
            (if (local.get $copy)
              (then
                (if (i32.and (i32.ne (local.get $copy) (local.get $handle))
                      (i32.ne (i32.and (local.get $flags) (i32.const 0x0008))
                        (i32.const 0)))
                  (then (drop (call $icon_destroy_handle (local.get $handle)))))
                (return (local.get $copy)))))))
      (else
        (if (i32.or
              (i32.eq (i32.and (local.get $handle) (i32.const 0xFFFF0000))
                (global.get $ICON_HANDLE_TAG))
              (i32.eq (i32.and (local.get $handle) (i32.const 0xFFFF0000))
                (global.get $CURSOR_HANDLE_TAG)))
          (then (return (i32.const 0))))))
    (if (i32.eqz (local.get $want_w)) (then (local.set $want_w (i32.const 32))))
    (if (i32.eqz (local.get $want_h)) (then (local.set $want_h (i32.const 32))))
    (if (i32.or
          (i32.ne (i32.and (local.get $flags) (i32.const 0x0001)) (i32.const 0))
          (i32.or (i32.ne (local.get $want_w) (i32.const 32))
            (i32.ne (local.get $want_h) (i32.const 32))))
      (then (return (i32.const 0))))
    (if (i32.and (local.get $flags) (i32.const 0x0004))
      (then (return (local.get $handle))))
    (if (local.get $is_icon)
      (then (local.set $copy (call $icon_copy_handle (local.get $handle))))
      (else
        (local.set $copy (call $icon_private_slot
          (i32.add (global.get $ICON_FROM_OPAQUE) (i32.const 1))
          (call $icon_opaque_cursor_source (local.get $handle))))))
    (if (i32.and (i32.ne (local.get $copy) (i32.const 0))
          (i32.ne (i32.and (local.get $flags) (i32.const 0x0008)) (i32.const 0)))
      (then (drop (call $icon_destroy_handle (local.get $handle)))))
    (local.get $copy))

  (func $copy_image_handle (param $handle i32) (param $type i32)
        (param $want_w i32) (param $want_h i32) (param $flags i32) (result i32)
    (if (i32.eq (local.get $type) (i32.const 0))
      (then (return (call $copy_image_bitmap (local.get $handle)
        (local.get $want_w) (local.get $want_h) (local.get $flags)))))
    (if (i32.or (i32.eq (local.get $type) (i32.const 1))
          (i32.eq (local.get $type) (i32.const 2)))
      (then (return (call $copy_image_icon_cursor (local.get $handle)
        (local.get $type) (local.get $want_w) (local.get $want_h)
        (local.get $flags)))))
    (i32.const 0))

  ;; USER stores the last-active relation on the owner, not the popup. Entries
  ;; are indexed by the owner's live WND_RECORDS slot. A stale entry is harmless:
  ;; the getter validates both the remembered HWND and its direct owner before
  ;; returning it, so slot reuse falls back to the new owner itself.
  (func $wnd_last_active_popup_addr_for_slot (param $slot i32) (result i32)
    (i32.add (global.get $LAST_ACTIVE_POPUP_TABLE)
      (i32.mul (local.get $slot) (i32.const 4))))

  (func $wnd_last_active_popup_get (param $owner i32) (result i32)
    (local $slot i32)
    (local.set $slot (call $wnd_table_find (local.get $owner)))
    (if (i32.lt_s (local.get $slot) (i32.const 0))
      (then (return (i32.const 0))))
    (i32.load (call $wnd_last_active_popup_addr_for_slot (local.get $slot))))

  (func $wnd_last_active_popup_set (param $owner i32) (param $popup i32)
    (local $slot i32)
    (local.set $slot (call $wnd_table_find (local.get $owner)))
    (if (i32.ge_s (local.get $slot) (i32.const 0))
      (then
        (i32.store (call $wnd_last_active_popup_addr_for_slot (local.get $slot))
          (local.get $popup)))))

  ;; GetLastActivePopup only walks an owner window's direct popup group. The
  ;; supplied HWND itself is the documented result for child windows, windows
  ;; that are themselves owned, empty groups, and stale remembered popups.
  (func $wnd_get_last_active_popup (param $hwnd i32) (result i32)
    (local $popup i32)
    (if (i32.or
          (i32.lt_s (call $wnd_table_find (local.get $hwnd)) (i32.const 0))
          (i32.or
            (i32.ne (i32.and (call $wnd_get_style (local.get $hwnd))
                             (i32.const 0x40000000)) (i32.const 0))
            (i32.ne (call $wnd_get_owner (local.get $hwnd)) (i32.const 0))))
      (then (return (local.get $hwnd))))
    (local.set $popup (call $wnd_last_active_popup_get (local.get $hwnd)))
    (if (i32.and
          (i32.ne (local.get $popup) (local.get $hwnd))
          (i32.and
            (i32.ge_s (call $wnd_table_find (local.get $popup)) (i32.const 0))
            (i32.eq (call $wnd_get_owner (local.get $popup)) (local.get $hwnd))))
      (then (return (local.get $popup))))
    (local.get $hwnd))

  ;; Record activation against the direct owner group. Activating the owner
  ;; itself makes the owner the last-active member; activating an owned popup
  ;; publishes that popup on its owner. Child windows never enter this table.
  (func $wnd_note_active_popup (param $hwnd i32)
    (local $owner i32)
    (if (i32.lt_s (call $wnd_table_find (local.get $hwnd)) (i32.const 0))
      (then (return)))
    (if (i32.ne (i32.and (call $wnd_get_style (local.get $hwnd))
                         (i32.const 0x40000000)) (i32.const 0))
      (then (return)))
    (local.set $owner (call $wnd_get_owner (local.get $hwnd)))
    (if (local.get $owner)
      (then (call $wnd_last_active_popup_set (local.get $owner) (local.get $hwnd)))
      (else (call $wnd_last_active_popup_set (local.get $hwnd) (local.get $hwnd)))))

  ;; ACCEL contains no encoded text. Keep the ANSI export as a thin alias of
  ;; the already-bounded Unicode implementation instead of growing a second
  ;; copy/query path that can drift.
  (func $handle_CopyAcceleratorTableA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_CopyAcceleratorTableW
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; The clipboard sequence belongs to the window station, not one guest
  ;; thread's WASM instance. A zero-filled fresh process is exposed as serial
  ;; 1; atomically publishing that initial value keeps every Worker instance
  ;; on the same generation before the first clipboard mutation.
  (func $clipboard_sequence_get (result i32)
    (drop (i32.atomic.rmw.cmpxchg
      (global.get $CLIPBOARD_SEQUENCE) (i32.const 0) (i32.const 1)))
    (i32.atomic.load (global.get $CLIPBOARD_SEQUENCE)))

  (func $clipboard_sequence_bump
    (drop (call $clipboard_sequence_get))
    (drop (i32.atomic.rmw.add
      (global.get $CLIPBOARD_SEQUENCE) (i32.const 1))))

  ;; Read an exact range from a VFS file without disturbing guest stack data.
  (func $version_read_exact (param $handle i32) (param $offset i32)
      (param $size i32) (param $dest_g i32) (param $count_g i32) (result i32)
    (if (i32.ne (call $host_fs_set_file_pointer
          (local.get $handle) (local.get $offset) (i32.const 0))
        (local.get $offset))
      (then (return (i32.const 0))))
    (call $gs32 (local.get $count_g) (i32.const 0))
    (if (i32.eqz (call $host_fs_read_file
          (local.get $handle) (local.get $dest_g)
          (local.get $size) (local.get $count_g)))
      (then (return (i32.const 0))))
    (i32.eq (call $gl32 (local.get $count_g)) (local.get $size)))

  ;; Return the child dword for an ID in a resource directory, or -1. With
  ;; any=1, return the first entry. Every offset is relative to resource root.
  (func $version_rsrc_child (param $root_g i32) (param $root_size i32)
      (param $dir_off i32) (param $want_id i32) (param $any i32) (result i32)
    (local $count i32) (local $entry i32) (local $i i32) (local $id i32)
    (if (i32.or
          (i32.gt_u (local.get $dir_off) (local.get $root_size))
          (i32.lt_u (i32.sub (local.get $root_size) (local.get $dir_off))
            (i32.const 16)))
      (then (return (i32.const -1))))
    (local.set $count (i32.add
      (call $gl16 (i32.add (local.get $root_g)
        (i32.add (local.get $dir_off) (i32.const 12))))
      (call $gl16 (i32.add (local.get $root_g)
        (i32.add (local.get $dir_off) (i32.const 14))))))
    (if (i32.gt_u (local.get $count)
          (i32.div_u
            (i32.sub (i32.sub (local.get $root_size) (local.get $dir_off))
              (i32.const 16))
            (i32.const 8)))
      (then (return (i32.const -1))))
    (local.set $entry (i32.add (local.get $dir_off) (i32.const 16)))
    (block $not_found
      (loop $scan
        (br_if $not_found (i32.ge_u (local.get $i) (local.get $count)))
        (local.set $id (call $gl32
          (i32.add (local.get $root_g) (local.get $entry))))
        (if (i32.or (local.get $any)
              (i32.and
                (i32.eqz (i32.and (local.get $id) (i32.const 0x80000000)))
                (i32.eq (local.get $id) (local.get $want_id))))
          (then (return (call $gl32
            (i32.add (local.get $root_g)
              (i32.add (local.get $entry) (i32.const 4)))))))
        (local.set $entry (i32.add (local.get $entry) (i32.const 8)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $scan)))
    (i32.const -1))

  ;; Load the named PE's RT_VERSION blob into a temporary guest allocation.
  ;; The parser reads only headers, the resource section, and the final blob.
  ;; NE resources use a bounded table of shifted file ranges, not PE RVAs.
  ;; Return the original ANSI VERSION bytes: Win16 callers also inspect the
  ;; fixed-info structure directly, so converting this blob would break them.
  (func $version_ne_resource (param $handle i32) (param $file_size i32)
      (param $ne_off i32) (param $count_g i32) (param $size_out_wa i32) (result i32)
    (local $header i32) (local $table i32) (local $blob i32)
    (local $start i32) (local $end i32) (local $size i32) (local $shift i32)
    (local $p i32) (local $type i32) (local $count i32)
    (local $offset64 i64) (local $size64 i64) (local $ok i32)
    (block $done
      (br_if $done (i32.gt_u (local.get $ne_off) (local.get $file_size)))
      (br_if $done (i32.lt_u (i32.sub (local.get $file_size) (local.get $ne_off)) (i32.const 64)))
      (local.set $header (call $heap_alloc (i32.const 64)))
      (br_if $done (i32.eqz (local.get $header)))
      (br_if $done (i32.eqz (call $version_read_exact (local.get $handle)
        (local.get $ne_off) (i32.const 64) (local.get $header) (local.get $count_g))))
      (local.set $start (call $gl16 (i32.add (local.get $header) (i32.const 0x24))))
      (local.set $end (call $gl16 (i32.add (local.get $header) (i32.const 0x26))))
      (br_if $done (i32.lt_u (local.get $start) (i32.const 64)))
      (br_if $done (i32.le_u (local.get $end) (local.get $start)))
      (br_if $done (i32.gt_u (local.get $end)
        (i32.sub (local.get $file_size) (local.get $ne_off))))
      (local.set $size (i32.sub (local.get $end) (local.get $start)))
      (br_if $done (i32.lt_u (local.get $size) (i32.const 4)))
      (local.set $table (call $heap_alloc (local.get $size)))
      (br_if $done (i32.eqz (local.get $table)))
      (br_if $done (i32.eqz (call $version_read_exact (local.get $handle)
        (i32.add (local.get $ne_off) (local.get $start)) (local.get $size)
        (local.get $table) (local.get $count_g))))
      (local.set $shift (call $gl16 (local.get $table)))
      (br_if $done (i32.gt_u (local.get $shift) (i32.const 31)))
      (local.set $p (i32.const 2))
      (loop $types
        (br_if $done (i32.gt_u (i32.add (local.get $p) (i32.const 2)) (local.get $size)))
        (local.set $type (call $gl16 (i32.add (local.get $table) (local.get $p))))
        (br_if $done (i32.eqz (local.get $type)))
        (br_if $done (i32.gt_u (i32.add (local.get $p) (i32.const 8)) (local.get $size)))
        (local.set $count (call $gl16 (i32.add (local.get $table)
          (i32.add (local.get $p) (i32.const 2)))))
        (local.set $p (i32.add (local.get $p) (i32.const 8)))
        (br_if $done (i32.gt_u (local.get $count)
          (i32.div_u (i32.sub (local.get $size) (local.get $p)) (i32.const 12))))
        (if (i32.and (i32.eq (local.get $type) (i32.const 0x8010))
                     (i32.ne (local.get $count) (i32.const 0)))
          (then
            (local.set $offset64 (i64.shl (i64.extend_i32_u (call $gl16
              (i32.add (local.get $table) (local.get $p)))) (i64.extend_i32_u (local.get $shift))))
            (local.set $size64 (i64.shl (i64.extend_i32_u (call $gl16
              (i32.add (local.get $table) (i32.add (local.get $p) (i32.const 2)))))
              (i64.extend_i32_u (local.get $shift))))
            (br_if $done (i64.eqz (local.get $size64)))
            (br_if $done (i64.gt_u (i64.add (local.get $offset64) (local.get $size64))
              (i64.extend_i32_u (local.get $file_size))))
            (local.set $blob (call $heap_alloc (i32.wrap_i64 (local.get $size64))))
            (br_if $done (i32.eqz (local.get $blob)))
            (br_if $done (i32.eqz (call $version_read_exact (local.get $handle)
              (i32.wrap_i64 (local.get $offset64)) (i32.wrap_i64 (local.get $size64))
              (local.get $blob) (local.get $count_g))))
            (i32.store (local.get $size_out_wa) (i32.wrap_i64 (local.get $size64)))
            (local.set $ok (i32.const 1))
            (br $done)))
        (local.set $p (i32.add (local.get $p) (i32.mul (local.get $count) (i32.const 12))))
        (br $types)))
    (call $heap_free (local.get $header))
    (call $heap_free (local.get $table))
    (if (i32.eqz (local.get $ok))
      (then (call $heap_free (local.get $blob)) (return (i32.const 0))))
    (local.get $blob))

  (func $file_version_resource (param $filename_g i32) (param $wide i32)
      (param $size_out_wa i32) (result i32)
    (local $handle i32) (local $file_size i32) (local $count_g i32)
    (local $headers_g i32) (local $headers_size i32) (local $pe_off i32)
    (local $num_sections i32) (local $opt_size i32) (local $section_table i32)
    (local $rsrc_rva i32) (local $rsrc_size i32) (local $rsrc_g i32)
    (local $section i32) (local $section_rva i32) (local $section_vsize i32)
    (local $section_raw i32) (local $section_raw_size i32) (local $span i32)
    (local $root_off i32) (local $root_size i32) (local $root_g i32)
    (local $type_child i32) (local $name_child i32) (local $lang_child i32)
    (local $data_entry i32) (local $data_rva i32) (local $data_size i32)
    (local $data_raw i32) (local $delta i32) (local $blob_g i32)
    (local $i i32) (local $found i32) (local $ok i32)
    (i32.store (local.get $size_out_wa) (i32.const 0))
    (local.set $handle (i32.const -1))
    (block $load
      (br_if $load (i32.eqz (local.get $filename_g)))
      (local.set $handle (call $host_fs_create_file
        (call $g2w (local.get $filename_g))
        (i32.const 0x80000000) (i32.const 3) (i32.const 0x80)
        (local.get $wide)))
      (br_if $load (i32.eq (local.get $handle) (i32.const -1)))
      (local.set $file_size (call $host_fs_get_file_size (local.get $handle)))
      (br_if $load (i32.lt_u (local.get $file_size) (i32.const 64)))
      (local.set $count_g (call $heap_alloc (i32.const 4)))
      (local.set $headers_g (call $heap_alloc (i32.const 64)))
      (br_if $load (i32.or
        (i32.eqz (local.get $count_g)) (i32.eqz (local.get $headers_g))))
      (br_if $load (i32.eqz (call $version_read_exact
        (local.get $handle) (i32.const 0) (i32.const 64)
        (local.get $headers_g) (local.get $count_g))))
      (br_if $load (i32.ne (call $gl16 (local.get $headers_g)) (i32.const 0x5A4D)))
      (local.set $pe_off (call $gl32
        (i32.add (local.get $headers_g) (i32.const 0x3C))))
      (br_if $load (i32.or
        (i32.gt_u (local.get $pe_off) (local.get $file_size))
        (i32.lt_u (i32.sub (local.get $file_size) (local.get $pe_off))
          (i32.const 24))))
      (call $heap_free (local.get $headers_g))
      (local.set $headers_g (call $heap_alloc (i32.const 24)))
      (br_if $load (i32.eqz (local.get $headers_g)))
      (br_if $load (i32.eqz (call $version_read_exact
        (local.get $handle) (local.get $pe_off) (i32.const 24)
        (local.get $headers_g) (local.get $count_g))))
      (if (i32.eq (call $gl16 (local.get $headers_g)) (i32.const 0x454E))
        (then
          (local.set $blob_g (call $version_ne_resource (local.get $handle)
            (local.get $file_size) (local.get $pe_off) (local.get $count_g) (local.get $size_out_wa)))
          (local.set $ok (i32.ne (local.get $blob_g) (i32.const 0)))
          (br $load)))
      (br_if $load (i32.ne (call $gl32 (local.get $headers_g))
        (i32.const 0x00004550)))
      (local.set $num_sections (call $gl16
        (i32.add (local.get $headers_g) (i32.const 6))))
      (local.set $opt_size (call $gl16
        (i32.add (local.get $headers_g) (i32.const 20))))
      (br_if $load (i32.or
        (i32.or (i32.eqz (local.get $num_sections))
          (i32.gt_u (local.get $num_sections) (i32.const 96)))
        (i32.lt_u (local.get $opt_size) (i32.const 120))))
      (local.set $headers_size (i32.add
        (i32.add (i32.const 24) (local.get $opt_size))
        (i32.mul (local.get $num_sections) (i32.const 40))))
      (br_if $load (i32.gt_u (local.get $headers_size)
        (i32.sub (local.get $file_size) (local.get $pe_off))))
      (call $heap_free (local.get $headers_g))
      (local.set $headers_g (call $heap_alloc (local.get $headers_size)))
      (br_if $load (i32.eqz (local.get $headers_g)))
      (br_if $load (i32.eqz (call $version_read_exact
        (local.get $handle) (local.get $pe_off) (local.get $headers_size)
        (local.get $headers_g) (local.get $count_g))))
      (br_if $load (i32.ne (call $gl16
        (i32.add (local.get $headers_g) (i32.const 24))) (i32.const 0x010B)))
      (br_if $load (i32.lt_u (call $gl32
        (i32.add (local.get $headers_g) (i32.const 116))) (i32.const 3)))
      (local.set $rsrc_rva (call $gl32
        (i32.add (local.get $headers_g) (i32.const 136))))
      (local.set $rsrc_size (call $gl32
        (i32.add (local.get $headers_g) (i32.const 140))))
      (br_if $load (i32.or
        (i32.eqz (local.get $rsrc_rva)) (i32.eqz (local.get $rsrc_size))))
      (local.set $section_table (i32.add (i32.const 24) (local.get $opt_size)))
      (block $rsrc_section_done
        (loop $rsrc_section_scan
          (br_if $rsrc_section_done
            (i32.ge_u (local.get $i) (local.get $num_sections)))
          (local.set $section (i32.add (local.get $headers_g)
            (i32.add (local.get $section_table)
              (i32.mul (local.get $i) (i32.const 40)))))
          (local.set $section_vsize (call $gl32
            (i32.add (local.get $section) (i32.const 8))))
          (local.set $section_rva (call $gl32
            (i32.add (local.get $section) (i32.const 12))))
          (local.set $section_raw_size (call $gl32
            (i32.add (local.get $section) (i32.const 16))))
          (local.set $span (local.get $section_raw_size))
          (if (i32.gt_u (local.get $section_vsize) (local.get $span))
            (then (local.set $span (local.get $section_vsize))))
          (if (i32.and
                (i32.ge_u (local.get $rsrc_rva) (local.get $section_rva))
                (i32.lt_u (i32.sub (local.get $rsrc_rva) (local.get $section_rva))
                  (local.get $span)))
            (then
              (local.set $section_raw (call $gl32
                (i32.add (local.get $section) (i32.const 20))))
              (local.set $found (i32.const 1))
              (br $rsrc_section_done)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $rsrc_section_scan)))
      (br_if $load (i32.eqz (local.get $found)))
      (local.set $root_off (i32.sub (local.get $rsrc_rva) (local.get $section_rva)))
      (br_if $load (i32.or
        (i32.ge_u (local.get $root_off) (local.get $section_raw_size))
        (i32.or
          (i32.gt_u (local.get $section_raw) (local.get $file_size))
          (i32.gt_u (local.get $section_raw_size)
            (i32.sub (local.get $file_size) (local.get $section_raw))))))
      (local.set $rsrc_g (call $heap_alloc (local.get $section_raw_size)))
      (br_if $load (i32.eqz (local.get $rsrc_g)))
      (br_if $load (i32.eqz (call $version_read_exact
        (local.get $handle) (local.get $section_raw)
        (local.get $section_raw_size) (local.get $rsrc_g) (local.get $count_g))))
      (local.set $root_g (i32.add (local.get $rsrc_g) (local.get $root_off)))
      (local.set $root_size (i32.sub
        (local.get $section_raw_size) (local.get $root_off)))
      (local.set $type_child (call $version_rsrc_child
        (local.get $root_g) (local.get $root_size) (i32.const 0)
        (i32.const 16) (i32.const 0)))
      (br_if $load (i32.eqz
        (i32.and (local.get $type_child) (i32.const 0x80000000))))
      (local.set $name_child (call $version_rsrc_child
        (local.get $root_g) (local.get $root_size)
        (i32.and (local.get $type_child) (i32.const 0x7FFFFFFF))
        (i32.const 0) (i32.const 1)))
      (br_if $load (i32.eqz
        (i32.and (local.get $name_child) (i32.const 0x80000000))))
      (local.set $lang_child (call $version_rsrc_child
        (local.get $root_g) (local.get $root_size)
        (i32.and (local.get $name_child) (i32.const 0x7FFFFFFF))
        (i32.const 0) (i32.const 1)))
      (br_if $load (i32.ne
        (i32.and (local.get $lang_child) (i32.const 0x80000000)) (i32.const 0)))
      (local.set $data_entry
        (i32.and (local.get $lang_child) (i32.const 0x7FFFFFFF)))
      (br_if $load (i32.or
        (i32.gt_u (local.get $data_entry) (local.get $root_size))
        (i32.lt_u (i32.sub (local.get $root_size) (local.get $data_entry))
          (i32.const 16))))
      (local.set $data_rva (call $gl32
        (i32.add (local.get $root_g) (local.get $data_entry))))
      (local.set $data_size (call $gl32
        (i32.add (local.get $root_g)
          (i32.add (local.get $data_entry) (i32.const 4)))))
      (br_if $load (i32.eqz (local.get $data_size)))
      (local.set $i (i32.const 0))
      (local.set $found (i32.const 0))
      (block $data_section_done
        (loop $data_section_scan
          (br_if $data_section_done
            (i32.ge_u (local.get $i) (local.get $num_sections)))
          (local.set $section (i32.add (local.get $headers_g)
            (i32.add (local.get $section_table)
              (i32.mul (local.get $i) (i32.const 40)))))
          (local.set $section_rva (call $gl32
            (i32.add (local.get $section) (i32.const 12))))
          (local.set $section_raw_size (call $gl32
            (i32.add (local.get $section) (i32.const 16))))
          (if (i32.ge_u (local.get $data_rva) (local.get $section_rva))
            (then
              (local.set $delta
                (i32.sub (local.get $data_rva) (local.get $section_rva)))
              (if (i32.and
                    (i32.le_u (local.get $delta) (local.get $section_raw_size))
                    (i32.le_u (local.get $data_size)
                      (i32.sub (local.get $section_raw_size) (local.get $delta))))
                (then
                  (local.set $section_raw (call $gl32
                    (i32.add (local.get $section) (i32.const 20))))
                  (local.set $data_raw
                    (i32.add (local.get $section_raw) (local.get $delta)))
                  (local.set $found (i32.const 1))
                  (br $data_section_done)))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $data_section_scan)))
      (br_if $load (i32.eqz (local.get $found)))
      (br_if $load (i32.or
        (i32.gt_u (local.get $data_raw) (local.get $file_size))
        (i32.gt_u (local.get $data_size)
          (i32.sub (local.get $file_size) (local.get $data_raw)))))
      (local.set $blob_g (call $heap_alloc (local.get $data_size)))
      (br_if $load (i32.eqz (local.get $blob_g)))
      (br_if $load (i32.eqz (call $version_read_exact
        (local.get $handle) (local.get $data_raw) (local.get $data_size)
        (local.get $blob_g) (local.get $count_g))))
      (i32.store (local.get $size_out_wa) (local.get $data_size))
      (local.set $ok (i32.const 1)))
    (if (i32.ne (local.get $handle) (i32.const -1))
      (then (drop (call $host_fs_close_handle (local.get $handle)))))
    (call $heap_free (local.get $rsrc_g))
    (call $heap_free (local.get $headers_g))
    (call $heap_free (local.get $count_g))
    (if (i32.eqz (local.get $ok))
      (then
        (call $heap_free (local.get $blob_g))
        (return (i32.const 0))))
    (local.get $blob_g))

  (func $file_version_info_size_named
      (param $filename_g i32) (param $handle_out_g i32) (param $wide i32) (param $reserve_wide i32)
    (local $scratch_g i32) (local $blob_g i32) (local $size i32) (local $wide_size i32)
    (if (local.get $handle_out_g)
      (then (call $gs32 (local.get $handle_out_g) (i32.const 0))))
    (local.set $scratch_g (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (local.get $scratch_g) (i32.const 0))
    (local.set $blob_g (call $file_version_resource
      (local.get $filename_g) (local.get $wide) (call $g2w (local.get $scratch_g))))
    (local.set $size (call $gl32 (local.get $scratch_g)))
    ;; A WORD bounds the NE tree. Reserve a disjoint UTF-16 slot at twice
    ;; each byte offset after it; the original (possibly padded) size bounds
    ;; the tree and the total reservation without changing the resource bytes.
    (if (i32.and (i32.and (i32.ne (local.get $blob_g) (i32.const 0)) (local.get $reserve_wide))
          (i32.ge_u (local.get $size) (i32.const 20)))
      (then (if (call $version_is_ne (local.get $blob_g))
        (then
          (local.set $wide_size (i32.mul (call $gl16 (local.get $blob_g)) (i32.const 3)))
          (if (i32.gt_u (local.get $wide_size) (local.get $size))
            (then (local.set $size (local.get $wide_size))))))))
    (i32.store offset=0 (global.get $reg_base) (local.get $size))
    (call $heap_free (local.get $blob_g)))

  (func $file_version_info_named
      (param $filename_g i32) (param $capacity i32)
      (param $data_g i32) (param $wide i32)
    (local $scratch_g i32) (local $blob_g i32) (local $size i32)
    (local.set $scratch_g (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (local.get $scratch_g) (i32.const 0))
    (local.set $blob_g (call $file_version_resource
      (local.get $filename_g) (local.get $wide) (call $g2w (local.get $scratch_g))))
    (if (i32.eqz (local.get $blob_g))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (local.set $size (call $gl32 (local.get $scratch_g)))
    (if (i32.gt_u (local.get $size) (local.get $capacity))
      (then (local.set $size (local.get $capacity))))
    (if (i32.and
          (i32.ne (local.get $size) (i32.const 0))
          (i32.ne (local.get $data_g) (i32.const 0)))
      (then (memory.copy
        (call $g2w (local.get $data_g))
        (call $g2w (local.get $blob_g)) (local.get $size))))
    (call $heap_free (local.get $blob_g))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1)))

  ;; SHAppBarMessage. ABM_GETTASKBARPOS asks only for APPBARDATA.cbSize and
  ;; writes the taskbar's screen-coordinate RECT at +16. The browser desktop
  ;; presents the Win98 taskbar at the bottom edge with the classic 28px size.
  (func $handle_SHAppBarMessage
      (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
      (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $data i32) (local $width i32) (local $height i32)
    (if (i32.ne (local.get $arg0) (i32.const 5)) ;; ABM_GETTASKBARPOS
      (then (call $crash_unimplemented (local.get $name_ptr))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (if (local.get $arg1)
      (then
        (local.set $data (call $g2w (local.get $arg1)))
        (if (i32.ge_u (i32.load (local.get $data)) (i32.const 36))
          (then
            (local.set $width (call $screen_metric_w))
            (local.set $height (call $screen_metric_h))
            (i32.store offset=16 (local.get $data) (i32.const 0))
            (i32.store offset=20 (local.get $data) (call $screen_work_bottom))
            (i32.store offset=24 (local.get $data) (local.get $width))
            (i32.store offset=28 (local.get $data) (local.get $height))
            (i32.store offset=0 (global.get $reg_base) (i32.const 1))))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12))))

  ;; The emulated desktop has mains power and no battery. SYSTEM_POWER_STATUS
  ;; is 12 bytes: four byte fields, then two DWORD lifetime estimates.
  ;; https://learn.microsoft.com/windows/win32/api/winbase/ns-winbase-system_power_status
  (func $handle_GetSystemPowerStatus
      (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
      (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg0)
      (then
        (call $gs32 (local.get $arg0) (i32.const 0x00FF8001))
        (call $gs32 (i32.add (local.get $arg0) (i32.const 4)) (i32.const -1))
        (call $gs32 (i32.add (local.get $arg0) (i32.const 8)) (i32.const -1))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1)))
      (else
        (global.set $last_error (i32.const 87))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; MEMORYSTATUSEX reports this VM's bounded memory, not the host computer's
  ;; RAM. Available capacity is conservative: the remaining sparse backing
  ;; excludes emulator-private storage and arenas already assigned to heaps.
  (func $handle_GlobalMemoryStatusEx
      (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
      (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $total i32) (local $cursor i32) (local $avail i32) (local $i i32)
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (block $done
      (if (i32.eqz (local.get $arg0)) (then (br $done)))
      (if (i32.ne (call $gl32 (local.get $arg0)) (i32.const 64)) (then (br $done)))
      ;; The physical total is the sparse backing pool, not the whole linear
      ;; memory: everything else in it is emulator-private and no guest commit
      ;; can ever reach it. Black & White 2 reads this total, subtracts 50MB
      ;; and hands the rest to SetProcessWorkingSetSize -- with the old answer
      ;; it budgeted 462MB against a pool that holds 316MB.
      (local.set $total (call $virtual_backing_capacity))
      (local.set $avail (call $virtual_backing_available))
      (local.set $i (i32.const 4))
      (loop $clear
        (call $gs32 (i32.add (local.get $arg0) (local.get $i)) (i32.const 0))
        (local.set $i (i32.add (local.get $i) (i32.const 4)))
        (br_if $clear (i32.lt_u (local.get $i) (i32.const 64))))
      (call $gs32 (i32.add (local.get $arg0) (i32.const 4))
        (i32.wrap_i64 (i64.div_u
          (i64.mul (i64.extend_i32_u (i32.sub (local.get $total) (local.get $avail))) (i64.const 100))
          (i64.extend_i32_u (local.get $total)))))
      (call $gs32 (i32.add (local.get $arg0) (i32.const 8)) (local.get $total))
      (call $gs32 (i32.add (local.get $arg0) (i32.const 16)) (local.get $avail))
      (call $gs32 (i32.add (local.get $arg0) (i32.const 24)) (local.get $total))
      (call $gs32 (i32.add (local.get $arg0) (i32.const 32)) (local.get $avail))
      (call $gs32 (i32.add (local.get $arg0) (i32.const 40)) (i32.const 0x7FFE0000))
      (call $gs32 (i32.add (local.get $arg0) (i32.const 48)) (local.get $avail))
      (i32.store offset=0 (global.get $reg_base) (i32.const 1)))
    (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
      (then (global.set $last_error (i32.const 87))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))
