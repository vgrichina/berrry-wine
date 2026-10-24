        (if (i32.eq (local.get $ordinal) (i32.const 115)) (then (return (call $lookup_api_id "WSAStartup"))))
        (if (i32.eq (local.get $ordinal) (i32.const 116)) (then (return (call $lookup_api_id "WSACleanup"))))
        (if (i32.eq (local.get $ordinal) (i32.const 111)) (then (return (call $lookup_api_id "WSAGetLastError"))))
        (if (i32.eq (local.get $ordinal) (i32.const 23))  (then (return (call $lookup_api_id "socket"))))
        (if (i32.eq (local.get $ordinal) (i32.const 3))   (then (return (call $lookup_api_id "closesocket"))))
        (if (i32.eq (local.get $ordinal) (i32.const 4))   (then (return (call $lookup_api_id "connect"))))
        (if (i32.eq (local.get $ordinal) (i32.const 5))   (then (return (call $lookup_api_id "getpeername"))))
        (if (i32.eq (local.get $ordinal) (i32.const 6))   (then (return (call $lookup_api_id "getsockname"))))
        (if (i32.eq (local.get $ordinal) (i32.const 7))   (then (return (call $lookup_api_id "getsockopt"))))
        ;; htonl and ntohl are the same byte swap on this little-endian guest.
        (if (i32.eq (local.get $ordinal) (i32.const 8))   (then (return (call $lookup_api_id "ntohl"))))
        (if (i32.eq (local.get $ordinal) (i32.const 19))  (then (return (call $lookup_api_id "send"))))
        (if (i32.eq (local.get $ordinal) (i32.const 16))  (then (return (call $lookup_api_id "recv"))))
        (if (i32.eq (local.get $ordinal) (i32.const 20))  (then (return (call $lookup_api_id "sendto"))))
        (if (i32.eq (local.get $ordinal) (i32.const 17))  (then (return (call $lookup_api_id "recvfrom"))))
        (if (i32.eq (local.get $ordinal) (i32.const 52))  (then (return (call $lookup_api_id "gethostbyname"))))
        (if (i32.eq (local.get $ordinal) (i32.const 9))   (then (return (call $lookup_api_id "htons"))))
        ;; WS2_32 renumbered three exports relative to WSOCK32: 10 is ioctlsocket,
        ;; 11 inet_addr and 12 inet_ntoa (WSOCK32: 10 inet_addr, 11 inet_ntoa,
        ;; 12 ioctlsocket). Pocket Tanks imports WS2_32 by ordinal; resolving its
        ;; ioctlsocket (3 args) as inet_addr (1 arg) left 8 bytes on the stack
        ;; and its return ran into the stack.
        (if (call $guest_name_is_ws2_32_ci (local.get $dll_name_ga))
          (then
            (if (i32.eq (local.get $ordinal) (i32.const 10)) (then (return (call $lookup_api_id "ioctlsocket"))))
            (if (i32.eq (local.get $ordinal) (i32.const 11)) (then (return (call $lookup_api_id "inet_addr"))))
            (if (i32.eq (local.get $ordinal) (i32.const 12)) (then (return (call $lookup_api_id "inet_ntoa"))))))
        (if (i32.eq (local.get $ordinal) (i32.const 10))  (then (return (call $lookup_api_id "inet_addr"))))
        (if (i32.eq (local.get $ordinal) (i32.const 11))  (then (return (call $lookup_api_id "inet_ntoa"))))
        (if (i32.eq (local.get $ordinal) (i32.const 18))  (then (return (call $lookup_api_id "select"))))
        (if (i32.eq (local.get $ordinal) (i32.const 21))  (then (return (call $lookup_api_id "setsockopt"))))
        (if (i32.eq (local.get $ordinal) (i32.const 12))  (then (return (call $lookup_api_id "ioctlsocket"))))
        (if (i32.eq (local.get $ordinal) (i32.const 1))   (then (return (call $lookup_api_id "accept"))))
