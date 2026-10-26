  ;; ============================================================
  ;; DEVICE I/O CONTROL
  ;; ============================================================

  ;; DeviceIoControl is imported by WinRAR 3.10, Far 1.70 and 7zFM.  Their
  ;; call sites do not issue ordinary file reads or writes:
  ;;
  ;;   WinRAR/Far  0x00000001/06   Win9x \\.\vwin32 DOS register requests
  ;;   7zFM        0x00074004      IOCTL_DISK_GET_PARTITION_INFO
  ;;               0x00070000      IOCTL_DISK_GET_DRIVE_GEOMETRY
  ;;               0x0002404c      IOCTL_CDROM_GET_DRIVE_GEOMETRY
  ;;   Far         0x002d0c04      IOCTL_STORAGE_GET_MEDIA_TYPES_EX
  ;;               0x0004d004      IOCTL_SCSI_PASS_THROUGH
  ;;               0x002d1400      IOCTL_STORAGE_QUERY_PROPERTY
  ;;               0x00090018/1c   FSCTL_LOCK_VOLUME/UNLOCK_VOLUME
  ;;               0x002d4800/04   EJECT_MEDIA/MEDIA_REMOVAL
  ;;               0x002d4808/0c   LOAD_MEDIA/RESERVE
  ;;               0x0009c040      FSCTL_SET_COMPRESSION
  ;;               0x000900a4/a8/ac SET/GET/DELETE_REPARSE_POINT
  ;;
  ;; The browser VFS has files and directories, but no device-driver handles,
  ;; physical geometry, removable media, volume locks, per-file compression,
  ;; or reparse points.  Microsoft documents these controls as operations on
  ;; the corresponding device/volume/file-system facilities.  Claiming any of
  ;; them succeeded would fabricate state.  Keep the API callable so all three
  ;; programs can take their own documented failure paths, and distinguish a
  ;; recognized-but-unavailable request (ERROR_NOT_SUPPORTED) from an unknown
  ;; control code (ERROR_INVALID_FUNCTION).
  (func $device_io_known_control (param $code i32) (result i32)
    (if (i32.eq (local.get $code) (i32.const 0x00000001)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $code) (i32.const 0x00000006)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $code) (i32.const 0x00074004)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $code) (i32.const 0x00070000)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $code) (i32.const 0x0002404c)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $code) (i32.const 0x002d0c04)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $code) (i32.const 0x0004d004)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $code) (i32.const 0x002d1400)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $code) (i32.const 0x00090018)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $code) (i32.const 0x0009001c)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $code) (i32.const 0x002d4800)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $code) (i32.const 0x002d4804)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $code) (i32.const 0x002d4808)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $code) (i32.const 0x002d480c)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $code) (i32.const 0x0009c040)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $code) (i32.const 0x000900a4)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $code) (i32.const 0x000900a8)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $code) (i32.const 0x000900ac)) (then (return (i32.const 1))))
    (i32.const 0))

  (func $device_io_guest_range (param $ptr i32) (param $size i32) (result i32)
    (if (i32.eqz (local.get $size)) (then (return (i32.const 1))))
    (if (i32.eqz (local.get $ptr)) (then (return (i32.const 0))))
    (i32.ne
      (call $g2w_affine_span (local.get $ptr) (local.get $size))
      (global.get $NULL_SENTINEL)))

  (func $device_io_error
      (param $handle i32) (param $code i32)
      (param $in i32) (param $in_size i32)
      (param $out i32) (param $out_size i32)
      (param $bytes_returned i32) (param $overlapped i32) (result i32)
    ;; Only an extant browser-VFS file handle is representable here.  Console,
    ;; process, synchronization, device-name, and unknown handles fail before
    ;; any guest output is inspected or changed.
    (if (i32.eq (call $host_fs_get_file_size (local.get $handle)) (i32.const -1))
      (then (return (i32.const 6)))) ;; ERROR_INVALID_HANDLE
    ;; Every target call is synchronous.  The VFS does not retain the
    ;; FILE_FLAG_OVERLAPPED bit or an asynchronous device queue.
    (if (local.get $overlapped)
      (then (return (i32.const 50)))) ;; ERROR_NOT_SUPPORTED
    ;; Microsoft requires lpBytesReturned for a synchronous request.  Validate
    ;; every complete span before dispatch.  No path below stores through any
    ;; of them, preserving all caller buffers atomically on failure.
    (if (i32.or
          (i32.eqz (call $device_io_guest_range
            (local.get $bytes_returned) (i32.const 4)))
          (i32.or
            (i32.eqz (call $device_io_guest_range
              (local.get $in) (local.get $in_size)))
            (i32.eqz (call $device_io_guest_range
              (local.get $out) (local.get $out_size)))))
      (then (return (i32.const 87)))) ;; ERROR_INVALID_PARAMETER
    (select
      (i32.const 50) ;; ERROR_NOT_SUPPORTED
      (i32.const 1)  ;; ERROR_INVALID_FUNCTION
      (call $device_io_known_control (local.get $code))))

;; ============================================================
  ;; QUARTZ.VXD -- the Win98 DirectShow ring-buffer device
  ;; ============================================================
  ;;
  ;; Win98 quartz.dll opens \\.\QUARTZ.VXD and asks it for a double-mapped ring:
  ;; ioctl 1 takes a page count N and returns a base where [base, base+N) is
  ;; committed and [base+N, base+2N) is a second view of the same pages, so a
  ;; parser can read across the wrap without copying. ioctl 2 frees it. Without
  ;; the VxD quartz falls back to MapViewOfFileEx at a fixed base, which the
  ;; Win98 section model (one address per section) cannot honour, and every
  ;; filter graph Pause/Run then fails with E_OUTOFMEMORY -- Morrowind rebuilt
  ;; its music graph every frame until the guest heap ran out.
  ;;
  ;; The sparse page table makes the alias exact: the second half's PTEs name
  ;; the first half's backing page by page, and cross-page accesses already
  ;; gather through per-page translation. One device handle serves every open,
  ;; as the VxD does; closing it frees nothing.
  (global $QUARTZ_VXD_HANDLE i32 (i32.const 0xF9000001))

  (func $quartz_vxd_name (param $name i32) (param $wide i32) (result i32)
    (local $lit i32) (local $i i32) (local $a i32) (local $b i32)
    (local.set $lit "\\\\.\\quartz.vxd")
    (block $no (loop $scan
      (local.set $a (call $tolower (call $load_char
        (i32.add (local.get $name)
          (i32.shl (local.get $i) (local.get $wide))) (local.get $wide))))
      (local.set $b (i32.load8_u (i32.add (local.get $lit) (local.get $i))))
      (br_if $no (i32.ne (local.get $a) (local.get $b)))
      (if (i32.eqz (local.get $a)) (then (return (i32.const 1))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  ;; ioctl 1: in = DWORD page count, out = DWORD base. Returns a Win32 error.
  (func $quartz_vxd_ring_alloc
      (param $in i32) (param $in_size i32) (param $out i32) (param $out_size i32)
      (param $bytes_returned i32) (result i32)
    (local $pages i32) (local $size i32) (local $base i32) (local $off i32)
    (local $back i32) (local $ok i32)
    (if (i32.or (i32.lt_u (local.get $in_size) (i32.const 4))
          (i32.lt_u (local.get $out_size) (i32.const 4)))
      (then (return (i32.const 87)))) ;; ERROR_INVALID_PARAMETER
    (if (i32.eqz (call $device_io_guest_range (local.get $in) (i32.const 4)))
      (then (return (i32.const 87))))
    (if (i32.eqz (call $device_io_guest_range (local.get $out) (i32.const 4)))
      (then (return (i32.const 87))))
    (local.set $pages (call $gl32 (local.get $in)))
    ;; quartz asks for its ring size / 4KB; 64MB is far past any ring it sizes
    (if (i32.or (i32.eqz (local.get $pages))
          (i32.gt_u (local.get $pages) (i32.const 0x4000)))
      (then (return (i32.const 87))))
    (local.set $size (i32.shl (local.get $pages) (i32.const 12)))
    (local.set $base (call $virtual_reserve_down (i32.shl (local.get $size) (i32.const 1))))
    (if (i32.eqz (local.get $base)) (then (return (i32.const 8)))) ;; NOT_ENOUGH_MEMORY
    (call $virtual_reserve_record (local.get $base)
      (i32.shl (local.get $size) (i32.const 1)) (i32.const 0x04))
    (if (i32.eqz (call $virtual_map_commit_protect
          (local.get $base) (local.get $size) (i32.const 0x04)))
      (then
        (drop (call $virtual_map_release (local.get $base)))
        (return (i32.const 8))))
    (local.set $ok (i32.const 1))
    (call $lock_acquire (global.get $LOCK_VIRTUAL_MAP))
    (block $done (loop $alias
      (br_if $done (i32.ge_u (local.get $off) (local.get $size)))
      (local.set $back (call $guest_page_translate
        (i32.add (local.get $base) (local.get $off))))
      (if (i32.eq (local.get $back) (global.get $NULL_SENTINEL))
        (then (local.set $ok (i32.const 0)) (br $done)))
      (if (i32.eqz (call $guest_page_publish_range
            (i32.add (i32.add (local.get $base) (local.get $size)) (local.get $off))
            (i32.const 0x1000) (local.get $back) (i32.const 0x04)))
        (then (local.set $ok (i32.const 0)) (br $done)))
      (local.set $off (i32.add (local.get $off) (i32.const 0x1000)))
      (br $alias)))
    (call $lock_release (global.get $LOCK_VIRTUAL_MAP))
    (if (i32.eqz (local.get $ok))
      (then
        (call $guest_page_clear_range
          (i32.add (local.get $base) (local.get $size)) (local.get $size))
        (drop (call $virtual_map_release (local.get $base)))
        (return (i32.const 8))))
    (call $gs32 (local.get $out) (local.get $base))
    (if (local.get $bytes_returned)
      (then (call $gs32 (local.get $bytes_returned) (i32.const 4))))
    (i32.const 0))

  ;; The size of the reservation starting exactly at $base, or 0.
  (func $quartz_vxd_reserve_size (param $base i32) (result i32)
    (local $count i32) (local $i i32) (local $ent i32) (local $size i32)
    (call $lock_acquire (global.get $LOCK_VIRTUAL_MAP))
    (local.set $count (i32.load offset=16 (global.get $VIRTUAL_MAP_STATE)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $ent (i32.add (global.get $VIRTUAL_RESERVE_TABLE)
        (i32.shl (local.get $i) (i32.const 3))))
      (if (i32.eq (i32.and (i32.load (local.get $ent)) (i32.const 0xFFFFF000))
            (local.get $base))
        (then (local.set $size (i32.load offset=4 (local.get $ent))) (br $done)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (call $lock_release (global.get $LOCK_VIRTUAL_MAP))
    (local.get $size))

  ;; ioctl 2: in = DWORD base from ioctl 1. Only a ring this device made is
  ;; freed: the reservation must start there and its upper half must alias
  ;; its lower half.
  (func $quartz_vxd_ring_free
      (param $in i32) (param $in_size i32) (param $bytes_returned i32) (result i32)
    (local $base i32) (local $half i32) (local $back i32)
    (if (i32.lt_u (local.get $in_size) (i32.const 4)) (then (return (i32.const 87))))
    (if (i32.eqz (call $device_io_guest_range (local.get $in) (i32.const 4)))
      (then (return (i32.const 87))))
    (local.set $base (call $gl32 (local.get $in)))
    (if (i32.or (i32.eqz (local.get $base))
          (i32.ne (i32.and (local.get $base) (i32.const 0xFFFF)) (i32.const 0)))
      (then (return (i32.const 87))))
    (local.set $half (i32.shr_u (call $quartz_vxd_reserve_size (local.get $base)) (i32.const 1)))
    (if (i32.or (i32.eqz (local.get $half))
          (i32.ne (i32.and (local.get $half) (i32.const 0xFFF)) (i32.const 0)))
      (then (return (i32.const 87))))
    (local.set $back (call $guest_page_translate (local.get $base)))
    (if (i32.or (i32.eq (local.get $back) (global.get $NULL_SENTINEL))
          (i32.ne (local.get $back)
            (call $guest_page_translate (i32.add (local.get $base) (local.get $half)))))
      (then (return (i32.const 87))))
    (call $guest_page_clear_range
      (i32.add (local.get $base) (local.get $half)) (local.get $half))
    (drop (call $virtual_map_release (local.get $base)))
    (if (local.get $bytes_returned)
      (then (call $gs32 (local.get $bytes_returned) (i32.const 0))))
    (i32.const 0))

  (func $quartz_vxd_ioctl
      (param $code i32) (param $in i32) (param $in_size i32)
      (param $out i32) (param $out_size i32)
      (param $bytes_returned i32) (param $overlapped i32) (result i32)
    (if (local.get $overlapped) (then (return (i32.const 50))))
    (if (i32.eq (local.get $code) (i32.const 1))
      (then (return (call $quartz_vxd_ring_alloc
        (local.get $in) (local.get $in_size) (local.get $out) (local.get $out_size)
        (local.get $bytes_returned)))))
    (if (i32.eq (local.get $code) (i32.const 2))
      (then (return (call $quartz_vxd_ring_free
        (local.get $in) (local.get $in_size) (local.get $bytes_returned)))))
    (i32.const 1)) ;; ERROR_INVALID_FUNCTION

  ;; BOOL DeviceIoControl(hDevice, code, in, inSize, out, outSize,
  ;;                      bytesReturned, overlapped) -- eight-argument stdcall.
  ;; The dispatcher passes the first five arguments directly.  The remaining
  ;; three are still on the guest stack at +24/+28/+32 from the return slot.
  (func $handle_DeviceIoControl
      (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
      (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $out_size i32) (local $bytes_returned i32) (local $overlapped i32)
    (local.set $out_size (call $gl32
      (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (local.set $bytes_returned (call $gl32
      (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
    (local.set $overlapped (call $gl32
      (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32))))

    (if (i32.eq (local.get $arg0) (global.get $QUARTZ_VXD_HANDLE))
      (then
        (global.set $last_error (call $quartz_vxd_ioctl
          (local.get $arg1) (local.get $arg2) (local.get $arg3)
          (local.get $arg4) (local.get $out_size)
          (local.get $bytes_returned) (local.get $overlapped)))
        (i32.store offset=0 (global.get $reg_base)
          (i32.eqz (global.get $last_error)))
        (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36)))
        (return)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (global.set $last_error
      (call $device_io_error
        (local.get $arg0) (local.get $arg1)
        (local.get $arg2) (local.get $arg3)
        (local.get $arg4) (local.get $out_size)
        (local.get $bytes_returned) (local.get $overlapped)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36))))
