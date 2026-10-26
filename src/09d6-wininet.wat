  ;; =====================================================================
  ;; Win32 Internet Extensions (WININET.DLL)
  ;;
  ;; This machine has no internet connection. WinInet itself works offline:
  ;; InternetOpen, InternetConnect and HttpOpenRequest only build handle
  ;; objects and touch no network, so they succeed here with real, typed
  ;; handles. The first call that needs the wire, HttpSendRequest, fails the
  ;; way an unplugged machine does: the server name cannot be resolved.
  ;; A request that was never sent has nothing to read.
  ;;
  ;; A handle is a 12-byte guest heap object:
  ;;   +0 magic 'HINT'   +4 type (1 session, 2 connect, 3 request)   +8 parent
  ;; InternetCloseHandle clears the magic before freeing, so a stale handle
  ;; fails validation instead of aliasing a live one.
  ;; =====================================================================

  (global $WININET_MAGIC i32 (i32.const 0x544e4948))  ;; 'HINT'
  (global $WININET_SESSION i32 (i32.const 1))
  (global $WININET_CONNECT i32 (i32.const 2))
  (global $WININET_REQUEST i32 (i32.const 3))

  ;; winerror.h / wininet.h values used below.
  (global $WININET_ERROR_INVALID_HANDLE i32 (i32.const 6))
  (global $WININET_ERROR_NOT_ENOUGH_MEMORY i32 (i32.const 8))
  (global $WININET_ERROR_NAME_NOT_RESOLVED i32 (i32.const 12007))
  (global $WININET_ERROR_INCORRECT_HANDLE_TYPE i32 (i32.const 12018))
  (global $WININET_ERROR_INCORRECT_HANDLE_STATE i32 (i32.const 12019))

  ;; Handle type, or 0 when $h is not a live WinInet handle.
  (func $wininet_handle_type (param $h i32) (result i32)
    (if (i32.lt_u (local.get $h) (i32.const 0x10000))
      (then (return (i32.const 0))))
    (if (i32.ne (call $gl32 (local.get $h)) (global.get $WININET_MAGIC))
      (then (return (i32.const 0))))
    (call $gl32 (i32.add (local.get $h) (i32.const 4))))

  ;; Allocate a handle of $type under $parent; 0 when the heap is exhausted.
  (func $wininet_handle_new (param $type i32) (param $parent i32) (result i32)
    (local $h i32)
    (local.set $h (call $heap_alloc (i32.const 12)))
    (if (i32.eqz (local.get $h)) (then (return (i32.const 0))))
    (call $gs32 (local.get $h) (global.get $WININET_MAGIC))
    (call $gs32 (i32.add (local.get $h) (i32.const 4)) (local.get $type))
    (call $gs32 (i32.add (local.get $h) (i32.const 8)) (local.get $parent))
    (local.get $h))

  ;; Return $ret, set the thread's last error to $err when $err is nonzero,
  ;; and pop $pop bytes (return address included).
  (func $sub_wininet_return (param $ret i32) (param $err i32) (param $pop i32)
    (if (local.get $err) (then (global.set $last_error (local.get $err))))
    (i32.store offset=0 (global.get $reg_base) (local.get $ret))
    (i32.store offset=16 (global.get $reg_base)
      (i32.add (i32.load offset=16 (global.get $reg_base)) (local.get $pop))))

  ;; Create a child handle of $type when $parent has type $parent_type.
  (func $sub_wininet_open_child (param $parent i32) (param $parent_type i32)
                                (param $type i32) (param $pop i32)
    (local $kind i32) (local $h i32)
    (local.set $kind (call $wininet_handle_type (local.get $parent)))
    (if (i32.eqz (local.get $kind))
      (then (return (call $sub_wininet_return (i32.const 0)
        (global.get $WININET_ERROR_INVALID_HANDLE) (local.get $pop)))))
    (if (i32.ne (local.get $kind) (local.get $parent_type))
      (then (return (call $sub_wininet_return (i32.const 0)
        (global.get $WININET_ERROR_INCORRECT_HANDLE_TYPE) (local.get $pop)))))
    (local.set $h (call $wininet_handle_new (local.get $type) (local.get $parent)))
    (if (i32.eqz (local.get $h))
      (then (return (call $sub_wininet_return (i32.const 0)
        (global.get $WININET_ERROR_NOT_ENOUGH_MEMORY) (local.get $pop)))))
    (call $sub_wininet_return (local.get $h) (i32.const 0) (local.get $pop)))

  ;; InternetOpenA(lpszAgent, dwAccessType, lpszProxy, lpszProxyBypass, dwFlags)
  (func $handle_InternetOpenA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                              (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $h i32)
    (local.set $h (call $wininet_handle_new (global.get $WININET_SESSION) (i32.const 0)))
    (call $sub_wininet_return (local.get $h)
      (select (i32.const 0) (global.get $WININET_ERROR_NOT_ENOUGH_MEMORY) (local.get $h))
      (i32.const 24)))

  ;; InternetConnectA(hInternet, lpszServerName, nServerPort, lpszUserName,
  ;;                  lpszPassword, dwService, dwFlags, dwContext)
  (func $handle_InternetConnectA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                                 (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $sub_wininet_open_child (local.get $arg0) (global.get $WININET_SESSION)
      (global.get $WININET_CONNECT) (i32.const 36)))

  ;; HttpOpenRequestA(hConnect, lpszVerb, lpszObjectName, lpszVersion,
  ;;                  lpszReferrer, lplpszAcceptTypes, dwFlags, dwContext)
  (func $handle_HttpOpenRequestA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                                 (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $sub_wininet_open_child (local.get $arg0) (global.get $WININET_CONNECT)
      (global.get $WININET_REQUEST) (i32.const 36)))

  ;; HttpSendRequestA(hRequest, lpszHeaders, dwHeadersLength, lpOptional,
  ;;                  dwOptionalLength)
  (func $handle_HttpSendRequestA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                                 (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $kind i32)
    (local.set $kind (call $wininet_handle_type (local.get $arg0)))
    (if (i32.eqz (local.get $kind))
      (then (return (call $sub_wininet_return (i32.const 0)
        (global.get $WININET_ERROR_INVALID_HANDLE) (i32.const 24)))))
    (if (i32.ne (local.get $kind) (global.get $WININET_REQUEST))
      (then (return (call $sub_wininet_return (i32.const 0)
        (global.get $WININET_ERROR_INCORRECT_HANDLE_TYPE) (i32.const 24)))))
    (call $sub_wininet_return (i32.const 0)
      (global.get $WININET_ERROR_NAME_NOT_RESOLVED) (i32.const 24)))

  ;; InternetReadFile(hFile, lpBuffer, dwNumberOfBytesToRead,
  ;;                  lpdwNumberOfBytesRead)
  ;; No request is ever sent successfully, so a request handle has no
  ;; response to read; session and connect handles are the wrong type.
  (func $handle_InternetReadFile (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                                 (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $kind i32)
    (local.set $kind (call $wininet_handle_type (local.get $arg0)))
    (if (i32.eqz (local.get $kind))
      (then (return (call $sub_wininet_return (i32.const 0)
        (global.get $WININET_ERROR_INVALID_HANDLE) (i32.const 20)))))
    (if (i32.ne (local.get $kind) (global.get $WININET_REQUEST))
      (then (return (call $sub_wininet_return (i32.const 0)
        (global.get $WININET_ERROR_INCORRECT_HANDLE_TYPE) (i32.const 20)))))
    (call $sub_wininet_return (i32.const 0)
      (global.get $WININET_ERROR_INCORRECT_HANDLE_STATE) (i32.const 20)))

  ;; InternetCloseHandle(hInternet)
  (func $handle_InternetCloseHandle (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                                    (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (call $wininet_handle_type (local.get $arg0)))
      (then (return (call $sub_wininet_return (i32.const 0)
        (global.get $WININET_ERROR_INVALID_HANDLE) (i32.const 8)))))
    (call $gs32 (local.get $arg0) (i32.const 0))
    (call $heap_free (local.get $arg0))
    (call $sub_wininet_return (i32.const 1) (i32.const 0) (i32.const 8)))
