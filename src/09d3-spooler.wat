  ;; =====================================================================
  ;; Windows 98 print spooler surface (WINSPOOL.DRV)
  ;;
  ;; This browser machine has no installed local printer and no remembered
  ;; printer connection.  Enumeration therefore succeeds with an empty set,
  ;; while opening a printer cannot manufacture a device or spool handle.
  ;; Every job API consequently rejects its handle before reading document or
  ;; data pointers, and every failure leaves caller-owned output bytes intact.
  ;; =====================================================================

  (global $SPOOL_ERROR_INVALID_HANDLE i32 (i32.const 6))
  (global $SPOOL_ERROR_INVALID_PARAMETER i32 (i32.const 87))
  (global $SPOOL_ERROR_INVALID_LEVEL i32 (i32.const 124))
  (global $SPOOL_ERROR_INVALID_FLAGS i32 (i32.const 1004))
  (global $SPOOL_ERROR_INVALID_USER_BUFFER i32 (i32.const 1784))
  (global $SPOOL_ERROR_INVALID_PRINTER_NAME i32 (i32.const 1801))

  ;; Common result for operations that require a handle returned by
  ;; OpenPrinter/AddPrinter.  This model creates no such handles.
  (func $sub_spool_invalid_handle (param $stack_pop i32)
    (global.set $last_error (global.get $SPOOL_ERROR_INVALID_HANDLE))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (local.get $stack_pop))))

  ;; BOOL EnumPrintersA(Flags, Name, Level, pPrinterEnum, cbBuf,
  ;;                    pcbNeeded, pcReturned)
  ;;
  ;; PRINTER_ENUM_LOCAL (2) and PRINTER_ENUM_CONNECTIONS (4) are the two
  ;; installed-printer sources exposed by this Win98/browser environment.
  ;; With neither source containing an entry, every supported information
  ;; level needs zero bytes and returns zero structures.  Validate all required
  ;; pointers before publishing either output so a failure is transactional.
  (func $handle_EnumPrintersA (param $arg0 i32) (param $arg1 i32)
                              (param $arg2 i32) (param $arg3 i32)
                              (param $arg4 i32) (param $name_ptr i32)
    (local $needed i32) (local $returned i32) (local $error i32)
    (local.set $needed
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (local.set $returned
      (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))

    (if (i32.or (i32.eqz (local.get $needed))
                (i32.eqz (local.get $returned)))
      (then (local.set $error (global.get $SPOOL_ERROR_INVALID_PARAMETER))))
    (if (i32.and (i32.eqz (local.get $error))
          (i32.eqz
            (i32.or
              (i32.or (i32.eq (local.get $arg2) (i32.const 1))
                      (i32.eq (local.get $arg2) (i32.const 2)))
              (i32.or (i32.eq (local.get $arg2) (i32.const 4))
                      (i32.eq (local.get $arg2) (i32.const 5))))))
      (then (local.set $error (global.get $SPOOL_ERROR_INVALID_LEVEL))))
    ;; At least one source must be named and no unsupported enumeration source
    ;; can be represented by this no-provider/no-printer machine.
    (if (i32.and (i32.eqz (local.get $error))
          (i32.or
            (i32.eqz (i32.and (local.get $arg0) (i32.const 6)))
            (i32.ne (i32.and (local.get $arg0) (i32.const -7))
                    (i32.const 0))))
      (then (local.set $error (global.get $SPOOL_ERROR_INVALID_FLAGS))))
    ;; Microsoft permits a NULL buffer only for the size-query shape cbBuf=0.
    (if (i32.and
          (i32.and (i32.eqz (local.get $error))
                   (i32.eqz (local.get $arg3)))
          (i32.ne (local.get $arg4) (i32.const 0)))
      (then (local.set $error (global.get $SPOOL_ERROR_INVALID_USER_BUFFER))))
    ;; Level 4 always queries the local computer and documents Name as NULL.
    (if (i32.and
          (i32.and (i32.eqz (local.get $error))
                   (i32.eq (local.get $arg2) (i32.const 4)))
          (i32.ne (local.get $arg1) (i32.const 0)))
      (then (local.set $error (global.get $SPOOL_ERROR_INVALID_PARAMETER))))

    (if (local.get $error)
      (then
        (global.set $last_error (local.get $error))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
      (else
        (call $gs32 (local.get $needed) (i32.const 0))
        (call $gs32 (local.get $returned) (i32.const 0))
        (i32.store offset=0 (global.get $reg_base) (i32.const 1))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32))))

  ;; BOOL OpenPrinterA(pPrinterName, phPrinter, pDefault).  A NULL name can
  ;; denote the local print server on a configured system, but there is no
  ;; spool object or server handle in this browser model.  Never alter the
  ;; caller's handle slot on failure.
  (func $handle_OpenPrinterA (param $arg0 i32) (param $arg1 i32)
                             (param $arg2 i32) (param $arg3 i32)
                             (param $arg4 i32) (param $name_ptr i32)
    (global.set $last_error
      (select
        (global.get $SPOOL_ERROR_INVALID_PRINTER_NAME)
        (global.get $SPOOL_ERROR_INVALID_PARAMETER)
        (i32.ne (local.get $arg1) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16))))

  ;; BOOL ClosePrinter(HANDLE)
  (func $handle_ClosePrinter (param $arg0 i32) (param $arg1 i32)
                             (param $arg2 i32) (param $arg3 i32)
                             (param $arg4 i32) (param $name_ptr i32)
    (call $sub_spool_invalid_handle (i32.const 8)))

  ;; DWORD StartDocPrinterA(HANDLE, DWORD Level, LPBYTE pDocInfo)
  (func $handle_StartDocPrinterA (param $arg0 i32) (param $arg1 i32)
                                 (param $arg2 i32) (param $arg3 i32)
                                 (param $arg4 i32) (param $name_ptr i32)
    (call $sub_spool_invalid_handle (i32.const 16)))

  ;; BOOL EndDocPrinter(HANDLE)
  (func $handle_EndDocPrinter (param $arg0 i32) (param $arg1 i32)
                              (param $arg2 i32) (param $arg3 i32)
                              (param $arg4 i32) (param $name_ptr i32)
    (call $handle_ClosePrinter
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; BOOL WritePrinter(HANDLE, LPVOID pBuf, DWORD cbBuf, LPDWORD pcWritten).
  ;; An invalid handle is rejected before pBuf or pcWritten can be read or
  ;; written, preserving both buffers exactly.
  (func $handle_WritePrinter (param $arg0 i32) (param $arg1 i32)
                             (param $arg2 i32) (param $arg3 i32)
                             (param $arg4 i32) (param $name_ptr i32)
    (call $sub_spool_invalid_handle (i32.const 20)))
