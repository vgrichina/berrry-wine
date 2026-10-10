  ;; =====================================================================
  ;; Anonymous pipes (CreatePipe) — phase 1 of docs/design-anonymous-pipes.md
  ;; =====================================================================
  ;;
  ;; A pipe is a connected pair of the virtual-LAN stream records in
  ;; $VSOCK_TABLE (09d-winsock.wat), the way socketpair() is two sockets:
  ;; the read end's record owns the receive ring and the write end's record
  ;; names it as its peer. That buys the ring, ordered partial reads, and the
  ;; close semantics without a second implementation of any of them —
  ;; destroying the write record gives the reader an orderly EOF (flags bit 0)
  ;; and destroying the read record leaves the writer with no peer. It is also
  ;; what phase 2 needs: an end inherited by a child in another instance
  ;; becomes a record whose peer is across the wire (peer = -2).
  ;;
  ;; The guest never sees a SOCKET. It sees pipe HANDLEs tagged 0x0033xxxx,
  ;; several per record: DuplicateHandle opens another handle on the same
  ;; record, and the record is destroyed only when its last handle closes.
  ;; Every Win32 file API that takes a handle asks $pipe_slot first, before
  ;; the VFS fallback.
  ;;
  ;; Records are claimed under $LOCK_SOCKET by $vsock_alloc; handles are
  ;; opened and closed under the same lock here. Reads and writes are not locked, the
  ;; same rule 09d-winsock.wat follows: one reader and one writer per ring.

  (global $PIPE_HANDLE_TAG i32 (i32.const 0x00330000))
  ;; VSock.proto of a record that is a pipe end, never a real protocol number.
  (global $PIPE_PROTO i32 (i32.const 0x45504950))  ;; 'PIPE'
  ;; Open handles per end: acc_queue[0..9]; [10..12] hold a parked write.
  (global $PIPE_HANDLES_PER_END i32 (i32.const 10))

  ;; No region of its own — the map below 0x08000000 is at its shake ceiling
  ;; (tools/region-alloc.js --shake-all). A pipe record has no address and is
  ;; never a listener, so fields a socket needs are free here:
  ;;   proto        $PIPE_PROTO, so a reused socket record is never misread
  ;;   backlog      which end: 0 read, 1 write
  ;;   acc_queue[k] handle k's flags (k < 10): bit0 open, bit1 inherit
  ;;   acc_queue[10..12]  a parked WriteFile's (buffer, length, bytes done)
  ;;   local_ip/port, remote_ip/port  only for an end whose peer is in
  ;;                another instance (phase 2): the wire addresses
  ;; A handle value is TAG | sock << 4 | k.

  ;; A parked WriteFile's progress, kept in its write record. One writer per
  ;; record at a time, the same rule the ring follows.
  (func $pipe_wprog_get (param $sock i32) (param $buf i32) (param $n i32) (result i32)
    (local $rec i32)
    (local.set $rec (call $vsock_rec (local.get $sock)))
    (if (result i32)
        (i32.and (i32.eq (load.field-elem VSock acc_queue (local.get $rec) (i32.const 10)) (local.get $buf))
                 (i32.eq (load.field-elem VSock acc_queue (local.get $rec) (i32.const 11)) (local.get $n)))
      (then (load.field-elem VSock acc_queue (local.get $rec) (i32.const 12)))
      (else (i32.const 0))))
  (func $pipe_wprog_set (param $sock i32) (param $buf i32) (param $n i32) (param $done i32)
    (local $rec i32)
    (local.set $rec (call $vsock_rec (local.get $sock)))
    (store.field-elem VSock acc_queue (local.get $rec) (i32.const 10) (local.get $buf))
    (store.field-elem VSock acc_queue (local.get $rec) (i32.const 11) (local.get $n))
    (store.field-elem VSock acc_queue (local.get $rec) (i32.const 12) (local.get $done)))

  (func $pipe_h_sock (param $h i32) (result i32)
    (i32.and (i32.shr_u (local.get $h) (i32.const 4)) (i32.const 0xFFF)))
  (func $pipe_h_k (param $h i32) (result i32)
    (i32.and (local.get $h) (i32.const 0xF)))

  ;; Nonzero (the record address) when $h is an open pipe handle, else 0.
  (func $pipe_slot (param $h i32) (result i32)
    (local $sock i32) (local $k i32) (local $rec i32)
    (if (i32.ne (i32.and (local.get $h) (i32.const 0xFFFF0000))
                (global.get $PIPE_HANDLE_TAG))
      (then (return (i32.const 0))))
    (local.set $sock (call $pipe_h_sock (local.get $h)))
    (local.set $k (call $pipe_h_k (local.get $h)))
    (if (i32.or (i32.ge_u (local.get $sock) (global.get $VSOCK_MAX))
                (i32.ge_u (local.get $k) (global.get $PIPE_HANDLES_PER_END)))
      (then (return (i32.const 0))))
    (local.set $rec (call $vsock_rec (local.get $sock)))
    (if (i32.or (i32.eqz (load.field VSock state (local.get $rec)))
                (i32.ne (load.field VSock proto (local.get $rec)) (global.get $PIPE_PROTO)))
      (then (return (i32.const 0))))
    (if (i32.eqz (i32.and (load.field-elem VSock acc_queue (local.get $rec) (local.get $k))
                          (i32.const 1)))
      (then (return (i32.const 0))))
    (local.get $rec))

  ;; Which end $h is (call only after $pipe_slot said yes): 0 read, 1 write.
  (func $pipe_end (param $h i32) (result i32)
    (load.field VSock backlog (call $vsock_rec (call $pipe_h_sock (local.get $h)))))

  ;; Open a new handle on record $sock. Returns the handle value or 0.
  (func $pipe_handle_new (param $sock i32) (param $inherit i32) (result i32)
    (local $rec i32) (local $k i32) (local $h i32)
    (local.set $rec (call $vsock_rec (local.get $sock)))
    (call $lock_acquire (global.get $LOCK_SOCKET))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $k) (global.get $PIPE_HANDLES_PER_END)))
      (if (i32.eqz (load.field-elem VSock acc_queue (local.get $rec) (local.get $k)))
        (then
          (store.field-elem VSock acc_queue (local.get $rec) (local.get $k)
            (i32.or (i32.const 1)
              (select (i32.const 2) (i32.const 0) (i32.ne (local.get $inherit) (i32.const 0)))))
          (local.set $h (i32.or (global.get $PIPE_HANDLE_TAG)
            (i32.or (i32.shl (local.get $sock) (i32.const 4)) (local.get $k))))
          (br $done)))
      (local.set $k (i32.add (local.get $k) (i32.const 1)))
      (br $scan)))
    (call $lock_release (global.get $LOCK_SOCKET))
    (local.get $h))

  ;; Open handles on record $sock (caller holds $LOCK_SOCKET).
  (func $pipe_refs_locked (param $sock i32) (result i32)
    (local $rec i32) (local $k i32) (local $n i32)
    (local.set $rec (call $vsock_rec (local.get $sock)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $k) (global.get $PIPE_HANDLES_PER_END)))
      (if (i32.and (load.field-elem VSock acc_queue (local.get $rec) (local.get $k)) (i32.const 1))
        (then (local.set $n (i32.add (local.get $n) (i32.const 1)))))
      (local.set $k (i32.add (local.get $k) (i32.const 1)))
      (br $scan)))
    (local.get $n))

  ;; Close one pipe handle: -1 when $h is not a pipe handle, 0 when it carries
  ;; the pipe tag but is not open (already closed: ERROR_INVALID_HANDLE, not a
  ;; fall-through to the VFS), else 1. The
  ;; record goes when its last handle does, and that is what the other end
  ;; observes: EOF for a reader whose writers are all gone, ERROR_NO_DATA for
  ;; a writer whose reader is.
  (func $pipe_close (param $h i32) (result i32)
    (local $rec i32) (local $sock i32) (local $last i32)
    (local.set $rec (call $pipe_slot (local.get $h)))
    (if (i32.eqz (local.get $rec))
      (then (return (select (i32.const 0) (i32.const -1)
        (i32.eq (i32.and (local.get $h) (i32.const 0xFFFF0000)) (global.get $PIPE_HANDLE_TAG))))))
    (local.set $sock (call $pipe_h_sock (local.get $h)))
    (call $lock_acquire (global.get $LOCK_SOCKET))
    (store.field-elem VSock acc_queue (local.get $rec) (call $pipe_h_k (local.get $h)) (i32.const 0))
    (local.set $last (i32.eqz (call $pipe_refs_locked (local.get $sock))))
    (call $lock_release (global.get $LOCK_SOCKET))
    (if (local.get $last)
      (then (call $vsock_destroy (local.get $sock) (i32.const 1))))
    (i32.const 1))

  ;; Duplicate a pipe handle into this process. 0 when $h is not one or the
  ;; end already has $PIPE_HANDLES_PER_END open handles.
  (func $pipe_duplicate (param $h i32) (param $inherit i32) (result i32)
    (if (i32.eqz (call $pipe_slot (local.get $h))) (then (return (i32.const 0))))
    (call $pipe_handle_new (call $pipe_h_sock (local.get $h)) (local.get $inherit)))

  ;; Copy up to $n queued bytes from record $sock's ring to guest $dst
  ;; without consuming them (PeekNamedPipe).
  (func $pipe_peek_copy (param $sock i32) (param $dst i32) (param $n i32) (result i32)
    (local $rec i32) (local $buf i32) (local $cap i32) (local $head i32) (local $i i32)
    (local.set $rec (call $vsock_rec (local.get $sock)))
    (if (i32.gt_u (local.get $n) (load.field VSock rx_len (local.get $rec)))
      (then (local.set $n (load.field VSock rx_len (local.get $rec)))))
    (if (i32.eqz (local.get $n)) (then (return (i32.const 0))))
    (local.set $buf (call $g2w (load.field VSock rx_buf (local.get $rec))))
    (local.set $cap (load.field VSock rx_cap (local.get $rec)))
    (local.set $head (load.field VSock rx_head (local.get $rec)))
    (block $done (loop $copy
      (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
      (i32.store8 (call $g2w (i32.add (local.get $dst) (local.get $i)))
        (i32.load8_u (i32.add (local.get $buf)
          (i32.rem_u (i32.add (local.get $head) (local.get $i)) (local.get $cap)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $copy)))
    (local.get $n))

  ;; True while some writer can still add bytes to read record $sock. A
  ;; writer in another instance (phase 2, peer = -2) counts until its FIN.
  (func $pipe_writer_alive (param $sock i32) (result i32)
    (local $rec i32)
    (local.set $rec (call $vsock_rec (local.get $sock)))
    (i32.and
      (i32.eqz (i32.and (load.field VSock flags (local.get $rec)) (i32.const 1)))
      (i32.ne (load.field VSock peer (local.get $rec)) (i32.const -1))))

  ;; Finish an API: BOOL in EAX, last error when FALSE, pop $pop bytes.
  (func $pipe_ret (param $ok i32) (param $err i32) (param $pop i32)
    (i32.store offset=0 (global.get $reg_base) (local.get $ok))
    (if (i32.eqz (local.get $ok)) (then (global.set $last_error (local.get $err))))
    (i32.store offset=16 (global.get $reg_base)
      (i32.add (i32.load offset=16 (global.get $reg_base)) (local.get $pop))))

  ;; ReadFile on a pipe handle. Returns 0 when $h is not one, so the caller
  ;; falls through to its other handle kinds; otherwise the call is finished
  ;; (or parked) and the caller returns. The stdcall frame is still unpopped.
  (func $pipe_read_file (param $h i32) (param $buf i32) (param $n i32) (param $pread i32)
                        (result i32)
    (local $slot i32) (local $sock i32) (local $got i32)
    (local.set $slot (call $pipe_slot (local.get $h)))
    (if (i32.eqz (local.get $slot)) (then (return (i32.const 0))))
    (if (call $pipe_end (local.get $h))
      (then
        (if (local.get $pread) (then (call $gs32 (local.get $pread) (i32.const 0))))
        (call $pipe_ret (i32.const 0) (i32.const 5) (i32.const 24)) ;; ERROR_ACCESS_DENIED
        (return (i32.const 1))))
    (local.set $sock (call $pipe_h_sock (local.get $h)))
    ;; A writer in another instance delivers through the wire.
    (if (i32.eq (load.field VSock peer (call $vsock_rec (local.get $sock))) (i32.const -2))
      (then (call $vsock_pump_now)))
    (if (i32.gt_u (load.field VSock rx_len (call $vsock_rec (local.get $sock))) (i32.const 0))
      (then
        ;; Any available prefix satisfies the read: pipe reads are partial.
        (local.set $got (call $vsock_ring_read (local.get $sock) (local.get $buf) (local.get $n)))
        ;; Ring space read is window the remote writer may use again.
        (if (i32.eq (load.field VSock peer (call $vsock_rec (local.get $sock))) (i32.const -2))
          (then (call $vsock_owe_credit (local.get $sock) (local.get $got) (i32.const 1))))
        (if (local.get $pread) (then (call $gs32 (local.get $pread) (local.get $got))))
        (call $pipe_ret (i32.const 1) (i32.const 0) (i32.const 24))
        (return (i32.const 1))))
    (if (i32.eqz (local.get $n))
      (then
        (if (local.get $pread) (then (call $gs32 (local.get $pread) (i32.const 0))))
        (call $pipe_ret (i32.const 1) (i32.const 0) (i32.const 24))
        (return (i32.const 1))))
    (if (i32.eqz (call $pipe_writer_alive (local.get $sock)))
      (then
        (if (local.get $pread) (then (call $gs32 (local.get $pread) (i32.const 0))))
        (call $pipe_ret (i32.const 0) (i32.const 109) (i32.const 24)) ;; ERROR_BROKEN_PIPE
        (return (i32.const 1))))
    ;; Empty with a live writer: wait for it, re-entering this same call.
    (call $vsock_block (i32.const 0))
    (i32.const 1))

  ;; WriteFile on a pipe handle; same contract as $pipe_read_file. A blocking
  ;; pipe write returns only once every byte is in the pipe, so a write larger
  ;; than the free space parks part way and resumes where it stopped: the
  ;; slot remembers (buffer, length, done) for the re-entry.
  (func $pipe_write_file (param $h i32) (param $buf i32) (param $n i32) (param $pwritten i32)
                         (result i32)
    (local $slot i32) (local $sock i32) (local $peer i32) (local $done i32)
    (local $space i32) (local $chunk i32) (local $rec i32)
    (local.set $slot (call $pipe_slot (local.get $h)))
    (if (i32.eqz (local.get $slot)) (then (return (i32.const 0))))
    (if (i32.eqz (call $pipe_end (local.get $h)))
      (then
        (if (local.get $pwritten) (then (call $gs32 (local.get $pwritten) (i32.const 0))))
        (call $pipe_ret (i32.const 0) (i32.const 5) (i32.const 24)) ;; ERROR_ACCESS_DENIED
        (return (i32.const 1))))
    (local.set $sock (call $pipe_h_sock (local.get $h)))
    (local.set $peer (load.field VSock peer (call $vsock_rec (local.get $sock))))
    ;; A re-entry of the same parked call picks up its progress.
    (local.set $done (call $pipe_wprog_get (local.get $sock) (local.get $buf) (local.get $n)))
    (call $pipe_wprog_set (local.get $sock) (i32.const 0) (i32.const 0) (i32.const 0))
    ;; -1: the reader is gone. (-2 is a reader in another instance.)
    (if (i32.eq (local.get $peer) (i32.const -1))
      (then
        (if (local.get $pwritten) (then (call $gs32 (local.get $pwritten) (local.get $done))))
        (call $pipe_ret (i32.const 0) (i32.const 232) (i32.const 24)) ;; ERROR_NO_DATA
        (return (i32.const 1))))
    (if (i32.eq (local.get $peer) (i32.const -2))
      (then
        ;; The reader is in another instance: DATA frames within the send
        ;; window, as many as fit now; a WINDOW credit from the reader's
        ;; reads re-opens it for the parked remainder.
        (call $vsock_pump_now)
        (local.set $rec (call $vsock_rec (local.get $sock)))
        (block $full (loop $send
          (br_if $full (i32.ge_u (local.get $done) (local.get $n)))
          (local.set $space (i32.sub (global.get $VSOCK_WINDOW)
            (load.field VSock tx_inflight (local.get $rec))))
          (br_if $full (i32.le_s (local.get $space) (i32.const 0)))
          (local.set $chunk (i32.sub (local.get $n) (local.get $done)))
          (if (i32.gt_u (local.get $chunk) (global.get $VLN_MAX_PAYLOAD))
            (then (local.set $chunk (global.get $VLN_MAX_PAYLOAD))))
          (if (i32.gt_u (local.get $chunk) (local.get $space))
            (then (local.set $chunk (local.get $space))))
          (br_if $full (i32.eqz (call $vsock_emit_from (local.get $sock) (i32.const 3)
            (i32.add (local.get $buf) (local.get $done)) (local.get $chunk))))
          (store.field VSock tx_inflight (local.get $rec)
            (i32.add (load.field VSock tx_inflight (local.get $rec))
                     (call $vsock_frame_charge (local.get $chunk))))
          (local.set $done (i32.add (local.get $done) (local.get $chunk)))
          (br $send)))
        (if (i32.lt_u (local.get $done) (local.get $n))
          (then
            (call $pipe_wprog_set (local.get $sock) (local.get $buf) (local.get $n) (local.get $done))
            (call $vsock_block (i32.const 0))
            (return (i32.const 1))))
        (if (local.get $pwritten) (then (call $gs32 (local.get $pwritten) (local.get $n))))
        (call $pipe_ret (i32.const 1) (i32.const 0) (i32.const 24))
        (return (i32.const 1))))
    (if (i32.eqz (call $vsock_alloc_ring (local.get $peer)))
      (then
        (call $pipe_ret (i32.const 0) (i32.const 8) (i32.const 24)) ;; ERROR_NOT_ENOUGH_MEMORY
        (return (i32.const 1))))
    (local.set $space (call $vsock_rx_space (local.get $peer)))
    (local.set $chunk (i32.sub (local.get $n) (local.get $done)))
    (if (i32.gt_u (local.get $chunk) (local.get $space))
      (then (local.set $chunk (local.get $space))))
    (if (local.get $chunk)
      (then
        (call $vsock_ring_write (local.get $peer)
          (i32.add (local.get $buf) (local.get $done)) (local.get $chunk))
        (local.set $done (i32.add (local.get $done) (local.get $chunk)))))
    (if (i32.lt_u (local.get $done) (local.get $n))
      (then
        (call $pipe_wprog_set (local.get $sock) (local.get $buf) (local.get $n) (local.get $done))
        (call $vsock_block (i32.const 0))
        (return (i32.const 1))))
    (if (local.get $pwritten) (then (call $gs32 (local.get $pwritten) (local.get $n))))
    (call $pipe_ret (i32.const 1) (i32.const 0) (i32.const 24))
    (i32.const 1))

  ;; CreatePipe(PHANDLE hReadPipe, PHANDLE hWritePipe,
  ;;            LPSECURITY_ATTRIBUTES lpPipeAttributes, DWORD nSize) → BOOL
  ;; nSize is advisory on Windows too; the ring is the stream record's.
  (func $handle_CreatePipe (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $r i32) (local $w i32) (local $inherit i32) (local $hr i32) (local $hw i32)
    (if (i32.or (i32.eqz (local.get $arg0)) (i32.eqz (local.get $arg1)))
      (then (call $pipe_ret (i32.const 0) (i32.const 87) (i32.const 20)) (return))) ;; ERROR_INVALID_PARAMETER
    (if (local.get $arg2)
      (then (local.set $inherit (i32.ne (call $gl32 (i32.add (local.get $arg2) (i32.const 8)))
                                        (i32.const 0)))))
    (local.set $r (call $vsock_alloc))
    (if (i32.lt_s (local.get $r) (i32.const 0))
      (then (call $pipe_ret (i32.const 0) (i32.const 4) (i32.const 20)) (return))) ;; ERROR_TOO_MANY_OPEN_FILES
    (local.set $w (call $vsock_alloc))
    (if (i32.lt_s (local.get $w) (i32.const 0))
      (then
        (call $vsock_destroy (local.get $r) (i32.const 1))
        (call $pipe_ret (i32.const 0) (i32.const 4) (i32.const 20)) (return)))
    (if (i32.eqz (call $vsock_alloc_ring (local.get $r)))
      (then
        (call $vsock_destroy (local.get $w) (i32.const 1))
        (call $vsock_destroy (local.get $r) (i32.const 1))
        (call $pipe_ret (i32.const 0) (i32.const 8) (i32.const 20)) (return)))
    ;; Two connected stream records, each the other's peer. Neither has an
    ;; address: they are never found by a wire frame or a listener.
    (store.field VSock family (call $vsock_rec (local.get $r)) (i32.const 2))
    (store.field VSock type (call $vsock_rec (local.get $r)) (i32.const 1))
    (store.field VSock peer (call $vsock_rec (local.get $r)) (local.get $w))
    (store.field VSock state (call $vsock_rec (local.get $r)) (i32.const 4))
    (store.field VSock family (call $vsock_rec (local.get $w)) (i32.const 2))
    (store.field VSock type (call $vsock_rec (local.get $w)) (i32.const 1))
    (store.field VSock peer (call $vsock_rec (local.get $w)) (local.get $r))
    (store.field VSock state (call $vsock_rec (local.get $w)) (i32.const 4))
    (store.field VSock proto (call $vsock_rec (local.get $r)) (global.get $PIPE_PROTO))
    (store.field VSock backlog (call $vsock_rec (local.get $r)) (i32.const 0))
    (store.field VSock proto (call $vsock_rec (local.get $w)) (global.get $PIPE_PROTO))
    (store.field VSock backlog (call $vsock_rec (local.get $w)) (i32.const 1))
    (local.set $hr (call $pipe_handle_new (local.get $r) (local.get $inherit)))
    (local.set $hw (call $pipe_handle_new (local.get $w) (local.get $inherit)))
    (if (i32.or (i32.eqz (local.get $hr)) (i32.eqz (local.get $hw)))
      (then
        (if (local.get $hr) (then (drop (call $pipe_close (local.get $hr)))))
        (if (local.get $hw) (then (drop (call $pipe_close (local.get $hw)))))
        (call $pipe_ret (i32.const 0) (i32.const 4) (i32.const 20)) (return)))
    (call $gs32 (local.get $arg0) (local.get $hr))
    (call $gs32 (local.get $arg1) (local.get $hw))
    (call $pipe_ret (i32.const 1) (i32.const 0) (i32.const 20)))

  ;; PeekNamedPipe(hPipe, lpBuffer, nBufferSize, lpBytesRead,
  ;;               lpTotalBytesAvail, lpBytesLeftThisMessage) → BOOL
  ;; Six arguments: the sixth is still on the stack at [ESP+24]. Never blocks
  ;; and never consumes. A drained pipe whose writers are all gone is
  ;; ERROR_BROKEN_PIPE, which is how a polling reader learns about EOF.
  (func $handle_PeekNamedPipe (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $left_ga i32) (local $slot i32) (local $sock i32) (local $avail i32) (local $got i32)
    (local.set $left_ga (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (local.set $slot (call $pipe_slot (local.get $arg0)))
    (if (i32.eqz (local.get $slot))
      (then (call $pipe_ret (i32.const 0) (i32.const 6) (i32.const 28)) (return))) ;; ERROR_INVALID_HANDLE
    (if (call $pipe_end (local.get $arg0))
      (then (call $pipe_ret (i32.const 0) (i32.const 5) (i32.const 28)) (return))) ;; ERROR_ACCESS_DENIED
    (local.set $sock (call $pipe_h_sock (local.get $arg0)))
    (if (i32.eq (load.field VSock peer (call $vsock_rec (local.get $sock))) (i32.const -2))
      (then (call $vsock_pump_now)))
    (local.set $avail (load.field VSock rx_len (call $vsock_rec (local.get $sock))))
    (if (i32.and (i32.eqz (local.get $avail))
                 (i32.eqz (call $pipe_writer_alive (local.get $sock))))
      (then (call $pipe_ret (i32.const 0) (i32.const 109) (i32.const 28)) (return))) ;; ERROR_BROKEN_PIPE
    (if (i32.and (i32.ne (local.get $arg1) (i32.const 0)) (i32.ne (local.get $arg2) (i32.const 0)))
      (then (local.set $got (call $pipe_peek_copy (local.get $sock) (local.get $arg1) (local.get $arg2)))))
    (if (local.get $arg3) (then (call $gs32 (local.get $arg3) (local.get $got))))
    (if (local.get $arg4) (then (call $gs32 (local.get $arg4) (local.get $avail))))
    (if (local.get $left_ga) (then (call $gs32 (local.get $left_ga) (i32.const 0))))
    (call $pipe_ret (i32.const 1) (i32.const 0) (i32.const 28)))

  ;; True when $h is an open pipe handle flagged HANDLE_FLAG_INHERIT.
  (func $pipe_inheritable (param $h i32) (result i32)
    (local $rec i32)
    (local.set $rec (call $pipe_slot (local.get $h)))
    (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
    (i32.ne (i32.and (load.field-elem VSock acc_queue (local.get $rec) (call $pipe_h_k (local.get $h)))
                     (i32.const 2))
            (i32.const 0)))

  ;; ---- phase 2: ends whose peer is in another instance -------------------
  ;;
  ;; A child process is a separate instance with its own memory, so the two
  ;; ends of an inherited pipe live in two record tables and meet over the
  ;; virtual-LAN wire as one pre-connected stream (no SYN: both sides are
  ;; created connected, at addresses the parent chose). DATA, WINDOW and FIN
  ;; frames then move bytes, credit and EOF exactly as for a socket.

  ;; Child side: a new pipe end ($end 0 read, 1 write) at local port $lport,
  ;; connected to $rip:$rport. Returns its handle, 0 when out of records.
  (func $pipe_open_remote (export "pipe_open_remote")
        (param $end i32) (param $lport i32) (param $rip i32) (param $rport i32) (result i32)
    (local $x i32) (local $rec i32) (local $h i32)
    (local.set $x (call $vsock_alloc))
    (if (i32.lt_s (local.get $x) (i32.const 0)) (then (return (i32.const 0))))
    (local.set $rec (call $vsock_rec (local.get $x)))
    (if (i32.eqz (local.get $end))
      (then (if (i32.eqz (call $vsock_alloc_ring (local.get $x)))
        (then (call $vsock_destroy (local.get $x) (i32.const 1)) (return (i32.const 0))))))
    (store.field VSock family (local.get $rec) (i32.const 2))
    (store.field VSock type (local.get $rec) (i32.const 1))
    (store.field VSock proto (local.get $rec) (global.get $PIPE_PROTO))
    (store.field VSock backlog (local.get $rec) (local.get $end))
    (store.field VSock local_ip (local.get $rec) (global.get $vsock_local_ip))
    (store.field VSock local_port (local.get $rec) (local.get $lport))
    (store.field VSock remote_ip (local.get $rec) (local.get $rip))
    (store.field VSock remote_port (local.get $rec) (local.get $rport))
    (store.field VSock peer (local.get $rec) (i32.const -2))
    (store.field VSock state (local.get $rec) (i32.const 4))
    (local.set $h (call $pipe_handle_new (local.get $x) (i32.const 0)))
    (if (i32.eqz (local.get $h))
      (then (call $vsock_destroy (local.get $x) (i32.const 1))))
    (local.get $h))

  ;; Parent side, at CreateProcess: handle $h's end goes to the child, which
  ;; will open it with $pipe_open_remote(end, $child_port, parent ip,
  ;; $parent_port). The end that stays here becomes remote-facing at
  ;; $parent_port; $h's own record is detached, so closing the parent's copy
  ;; (which every redirecting parent does next) no longer touches the pipe.
  ;; Returns the moved end (0 read, 1 write), or -1 when $h cannot move.
  ;; Bytes already queued in a moved read end stay behind: a parent writes to
  ;; a child's stdin after starting it, not before.
  (func $pipe_move_to_child (export "pipe_move_to_child")
        (param $h i32) (param $child_ip i32) (param $child_port i32) (param $parent_port i32)
        (result i32)
    (local $x i32) (local $y i32) (local $xrec i32) (local $yrec i32)
    (if (i32.eqz (call $pipe_slot (local.get $h))) (then (return (i32.const -1))))
    (local.set $x (call $pipe_h_sock (local.get $h)))
    (local.set $xrec (call $vsock_rec (local.get $x)))
    (local.set $y (load.field VSock peer (local.get $xrec)))
    (if (i32.lt_s (local.get $y) (i32.const 0)) (then (return (i32.const -1))))
    (local.set $yrec (call $vsock_rec (local.get $y)))
    (store.field VSock local_ip (local.get $yrec) (global.get $vsock_local_ip))
    (store.field VSock local_port (local.get $yrec) (local.get $parent_port))
    (store.field VSock remote_ip (local.get $yrec) (local.get $child_ip))
    (store.field VSock remote_port (local.get $yrec) (local.get $child_port))
    (store.field VSock peer (local.get $yrec) (i32.const -2))
    (store.field VSock peer (local.get $xrec) (i32.const -1))
    (load.field VSock backlog (local.get $xrec)))

  ;; Child side, before the entry point runs: open the inherited end and make
  ;; it standard handle $which (-10 input, -11 output, -12 error). Returns
  ;; the handle, 0 on failure.
  (func (export "pipe_attach_std")
        (param $which i32) (param $end i32) (param $lport i32) (param $rip i32) (param $rport i32)
        (result i32)
    (local $h i32)
    (local.set $h (call $pipe_open_remote (local.get $end) (local.get $lport)
      (local.get $rip) (local.get $rport)))
    (if (local.get $h)
      (then (drop (call $console_std_handle_set (local.get $which) (local.get $h)))))
    (local.get $h))

  ;; Child room addresses handed out by this process, 10.0.0.2 upward in
  ;; the parent's /24. Per instance, which is per process for CreateProcess
  ;; callers in practice (a redirecting parent spawns from one thread).
  (global $pipe_spawned (mut i32) (i32.const 0))

  ;; The first of STARTUPINFO's std handle slots 0..$i naming the same pipe
  ;; record as slot $i (slot $i itself when none earlier does). WinBoard and
  ;; most redirecting parents pass one write end as both hStdOutput and
  ;; hStdError: that is one end, moved once, at one pair of ports, and the
  ;; host gives the child one handle in both slots.
  (func $pipe_std_owner (param $si i32) (param $i i32) (result i32)
    (local $j i32) (local $sock i32) (local $hj i32)
    (local.set $sock (call $pipe_h_sock (call $gl32 (i32.add (local.get $si)
      (i32.add (i32.const 56) (i32.shl (local.get $i) (i32.const 2)))))))
    (block $found (loop $scan
      (br_if $found (i32.ge_u (local.get $j) (local.get $i)))
      (local.set $hj (call $gl32 (i32.add (local.get $si)
        (i32.add (i32.const 56) (i32.shl (local.get $j) (i32.const 2))))))
      (if (i32.and (i32.ne (call $pipe_inheritable (local.get $hj)) (i32.const 0))
                   (i32.eq (call $pipe_h_sock (local.get $hj)) (local.get $sock)))
        (then (return (local.get $j))))
      (local.set $j (i32.add (local.get $j) (i32.const 1)))
      (br $scan)))
    (local.get $i))

  ;; The one string the host launches from: the command line, except that a
  ;; separate lpApplicationName names the executable and the command line's
  ;; argv[0] is then only a label. msiinst.exe runs CreateProcessA(
  ;; "MsiExec.exe", "C:\...\msiinst.exe /i instmsi.msi ...") and means
  ;; msiexec with those arguments, so the result is `"app" <args>`. A guest
  ;; heap string; the caller frees it.
  (func $pipe_launch_line (param $app i32) (param $cmd i32) (result i32)
    (local $p i32) (local $c i32) (local $out i32) (local $n i32) (local $alen i32) (local $rlen i32)
    (if (i32.eqz (local.get $app)) (then
      (local.set $n (call $guest_strlen (local.get $cmd)))
      (local.set $out (call $heap_alloc (i32.add (local.get $n) (i32.const 1))))
      (if (i32.eqz (local.get $out)) (then (return (i32.const 0))))
      (call $guest_memmove (local.get $out) (local.get $cmd) (i32.add (local.get $n) (i32.const 1)))
      (return (local.get $out))))
    ;; Skip argv[0]: leading blanks, then a quoted run or a run of non-blanks.
    (if (local.get $cmd) (then
      (local.set $p (local.get $cmd))
      (block $lead (loop $sp
        (local.set $c (call $gl8 (local.get $p)))
        (br_if $lead (i32.and (i32.ne (local.get $c) (i32.const 32)) (i32.ne (local.get $c) (i32.const 9))))
        (local.set $p (i32.add (local.get $p) (i32.const 1)))
        (br $sp)))
      (if (i32.eq (call $gl8 (local.get $p)) (i32.const 34))
        (then
          (local.set $p (i32.add (local.get $p) (i32.const 1)))
          (block $q (loop $scan
            (local.set $c (call $gl8 (local.get $p)))
            (br_if $q (i32.eqz (local.get $c)))
            (local.set $p (i32.add (local.get $p) (i32.const 1)))
            (br_if $q (i32.eq (local.get $c) (i32.const 34)))
            (br $scan))))
        (else
          (block $w (loop $scan
            (local.set $c (call $gl8 (local.get $p)))
            (br_if $w (i32.or (i32.eqz (local.get $c))
              (i32.or (i32.eq (local.get $c) (i32.const 32)) (i32.eq (local.get $c) (i32.const 9)))))
            (local.set $p (i32.add (local.get $p) (i32.const 1)))
            (br $scan)))))
      (local.set $rlen (call $guest_strlen (local.get $p)))))
    (local.set $alen (call $guest_strlen (local.get $app)))
    ;; '"' app '"' rest NUL
    (local.set $out (call $heap_alloc (i32.add (i32.add (local.get $alen) (local.get $rlen)) (i32.const 3))))
    (if (i32.eqz (local.get $out)) (then (return (i32.const 0))))
    (call $gs8 (local.get $out) (i32.const 34))
    (call $guest_memmove (i32.add (local.get $out) (i32.const 1)) (local.get $app) (local.get $alen))
    (call $gs8 (i32.add (local.get $out) (i32.add (local.get $alen) (i32.const 1))) (i32.const 34))
    (if (local.get $rlen)
      (then (call $guest_memmove (i32.add (local.get $out) (i32.add (local.get $alen) (i32.const 2)))
        (local.get $p) (local.get $rlen))))
    (call $gs8 (i32.add (local.get $out) (i32.add (i32.add (local.get $alen) (local.get $rlen)) (i32.const 2)))
      (i32.const 0))
    (local.get $out))

  ;; CreateProcessA through a host child process. $si is the guest
  ;; STARTUPINFOA or 0, $app/$cmd the guest lpApplicationName and
  ;; lpCommandLine (either may be 0), $inherit bInheritHandles, $dir the guest
  ;; current directory or 0, $pi the guest PROCESS_INFORMATION or 0. With
  ;; redirected std handles (bInheritHandles + STARTF_USESTDHANDLES naming
  ;; inheritable pipe ends) the child gets them; otherwise it is an ordinary
  ;; child, which the host starts only when it runs children for every
  ;; CreateProcess. Returns 1 when a child was started (the caller then
  ;; returns TRUE), 0 when the host cannot or will not start one (the caller
  ;; falls back to its old path).
  (func $pipe_create_process (param $si i32) (param $app i32) (param $cmd i32) (param $inherit i32)
                             (param $dir i32) (param $pi i32) (result i32)
    (local $launch i32) (local $r i32)
    (local.set $launch (call $pipe_launch_line (local.get $app) (local.get $cmd)))
    (if (i32.eqz (local.get $launch)) (then (return (i32.const 0))))
    (local.set $r (call $pipe_spawn_child (local.get $si) (local.get $launch) (local.get $inherit)
      (local.get $dir) (local.get $pi)))
    (call $heap_free (local.get $launch))
    (local.get $r))

  (func $pipe_spawn_child (param $si i32) (param $launch i32) (param $inherit i32) (param $dir i32) (param $pi i32)
                          (result i32)
    (local $spec i32) (local $spec_wa i32) (local $i i32) (local $h i32) (local $count i32)
    (local $child_ip i32) (local $pid i32) (local $e i32) (local $base_port i32) (local $own i32)
    (local $redirect i32)
    ;; STARTUPINFOA.dwFlags (+44) & STARTF_USESTDHANDLES; hStdInput +56,
    ;; hStdOutput +60, hStdError +64.
    (if (i32.and (i32.ne (local.get $si) (i32.const 0)) (i32.ne (local.get $inherit) (i32.const 0)))
      (then (local.set $redirect (i32.ne (i32.and (call $gl32 (i32.add (local.get $si) (i32.const 44)))
        (i32.const 0x100)) (i32.const 0)))))
    (local.set $spec (call $heap_alloc (i32.const 48)))
    (if (i32.eqz (local.get $spec)) (then (return (i32.const 0))))
    (local.set $spec_wa (call $g2w (local.get $spec)))
    (local.set $child_ip (i32.or
      (i32.and (global.get $vsock_local_ip) (i32.const 0xFFFFFF00))
      (i32.add (i32.const 2) (i32.and (global.get $pipe_spawned) (i32.const 0x7F)))))
    ;; Ports on both sides are chosen here, in a range the guests' own
    ;; sockets do not hand out, so a child that also uses Winsock cannot
    ;; collide with its own stdio.
    (local.set $base_port (i32.add (i32.const 52000)
      (i32.mul (i32.and (global.get $pipe_spawned) (i32.const 0x7F)) (i32.const 8))))
    (block $done (loop $each
      (br_if $done (i32.eqz (local.get $redirect)))
      (br_if $done (i32.ge_u (local.get $i) (i32.const 3)))
      (local.set $h (call $gl32 (i32.add (local.get $si)
        (i32.add (i32.const 56) (i32.shl (local.get $i) (i32.const 2))))))
      (if (call $pipe_inheritable (local.get $h))
        (then
          (local.set $own (call $pipe_std_owner (local.get $si) (local.get $i)))
          (local.set $e (i32.add (local.get $spec_wa) (i32.shl (local.get $count) (i32.const 4))))
          (i32.store (local.get $e) (i32.sub (i32.const -10) (local.get $i)))
          (i32.store offset=4 (local.get $e) (call $pipe_end (local.get $h)))
          (i32.store offset=8 (local.get $e)
            (i32.add (local.get $base_port) (i32.shl (local.get $own) (i32.const 1))))
          (i32.store offset=12 (local.get $e)
            (i32.add (local.get $base_port) (i32.add (i32.shl (local.get $own) (i32.const 1)) (i32.const 1))))
          (local.set $count (i32.add (local.get $count) (i32.const 1)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $each)))
    ;; No inheritable pipe end among them: an ordinary child (count 0).
    (local.set $pid (call $host_process_spawn
      (call $g2w (local.get $launch))
      (if (result i32) (local.get $dir) (then (call $g2w (local.get $dir))) (else (i32.const 0)))
      (local.get $child_ip) (local.get $spec_wa) (local.get $count)
      (i32.const 0) (i32.const 1)))
    (if (i32.eqz (local.get $pid))
      (then (call $heap_free (local.get $spec)) (return (i32.const 0))))
    (global.set $pipe_spawned (i32.add (global.get $pipe_spawned) (i32.const 1)))
    ;; The child exists: hand it its ends. The spec entries are in handle
    ;; order (input, output, error), the same walk as above.
    (local.set $i (i32.const 0))
    (block $moved (loop $move
      (br_if $moved (i32.eqz (local.get $count)))
      (br_if $moved (i32.ge_u (local.get $i) (i32.const 3)))
      (local.set $h (call $gl32 (i32.add (local.get $si)
        (i32.add (i32.const 56) (i32.shl (local.get $i) (i32.const 2))))))
      (if (i32.and (i32.ne (call $pipe_inheritable (local.get $h)) (i32.const 0))
                   (i32.eq (call $pipe_std_owner (local.get $si) (local.get $i)) (local.get $i)))
        (then (drop (call $pipe_move_to_child (local.get $h) (local.get $child_ip)
          (i32.add (local.get $base_port) (i32.shl (local.get $i) (i32.const 1)))
          (i32.add (local.get $base_port) (i32.add (i32.shl (local.get $i) (i32.const 1)) (i32.const 1)))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $move)))
    (call $heap_free (local.get $spec))
    (if (local.get $pi)
      (then
        (call $gs32 (local.get $pi) (call $pipe_child_process_handle (local.get $pid)))
        (call $gs32 (i32.add (local.get $pi) (i32.const 4))
          (i32.or (i32.const 0x00E50000) (i32.and (local.get $pid) (i32.const 0xFFFF))))
        (call $gs32 (i32.add (local.get $pi) (i32.const 8)) (local.get $pid))
        (call $gs32 (i32.add (local.get $pi) (i32.const 12)) (i32.add (local.get $pid) (i32.const 1)))))
    (i32.const 1))

  ;; Child side: a second std slot naming an end already attached (hStdError
  ;; sharing hStdOutput's pipe). The same handle, as Windows would hand it.
  (func (export "pipe_set_std") (param $which i32) (param $h i32) (result i32)
    (call $console_std_handle_set (local.get $which) (local.get $h)))

  ;; ---- phase 3: the child's process object -------------------------------
  ;; hProcess = 0x00E40000 | pid and hThread = 0x00E50000 | pid for a child
  ;; process_spawn started; the host answers for its state (process_ctl).
  ;; Waits on hProcess are answered by lib/thread-manager.js waitSingle.

  (func $pipe_child_process_handle (param $pid i32) (result i32)
    (i32.or (i32.const 0x00E40000) (i32.and (local.get $pid) (i32.const 0xFFFF))))

  ;; The child pid an hProcess names, or 0 when $h is not a child handle.
  (func $pipe_child_pid (param $h i32) (result i32)
    (if (result i32) (i32.eq (i32.and (local.get $h) (i32.const 0xFFFF0000)) (i32.const 0x00E40000))
      (then (i32.and (local.get $h) (i32.const 0xFFFF)))
      (else (i32.const 0))))

  ;; Child side: a DETACHED_PROCESS-style child has no console, so its CUI
  ;; image must not open a console window on first output (09a2's
  ;; attachment word, 2 = detached). Its std handles are pipes anyway.
  (func (export "pipe_detach_console")
    (i32.atomic.store (region.addr $CONSOLE_INPUT 0xC10) (i32.const 2)))
