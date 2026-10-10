  ;; =====================================================================
  ;; Virtual LAN Winsock core — docs/virtual-lan-party.md, Slices 1-2
  ;;
  ;; A room-scoped socket switch. Guest AF_INET/SOCK_STREAM sockets are
  ;; genuine byte streams, and SOCK_DGRAM sockets preserve one UDP datagram
  ;; per wire frame. Two sockets inside one process meet directly in
  ;; VSOCK_TABLE; a socket whose peer lives in another process meets it
  ;; over the frame wire further down this file. No host socket or TAP
  ;; device is involved either way, and addresses live only inside the
  ;; room, so a guest cannot reach the player's real LAN or the Internet
  ;; through these handlers.
  ;;
  ;; A blocking call that cannot complete parks the whole API call with the
  ;; net_wait yield (reason 8) instead of pretending it would block: EIP
  ;; still points at the thunk, so the host re-enters the same handler once
  ;; the wire has moved.
  ;;
  ;; Record layout (128 bytes at VSOCK_TABLE + index * 128):
  ;;   +0   state       0 free / 1 created / 2 bound / 3 listening
  ;;                    4 connected / 5 closed / 6 connecting (SYN sent,
  ;;                    waiting for the remote process to answer)
  ;;   +4   family      AF_INET
  ;;   +8   type        SOCK_STREAM or SOCK_DGRAM
  ;;   +12  proto       0, IPPROTO_TCP, or IPPROTO_UDP
  ;;   +16  local_ip    host byte order, 0 = INADDR_ANY
  ;;   +20  local_port  host byte order
  ;;   +24  remote_ip   host byte order
  ;;   +28  remote_port host byte order
  ;;   +32  peer        peer record index, -1 when unconnected,
  ;;                    -2 when the peer lives in another process (the
  ;;                    connection is then identified by remote_ip:port)
  ;;   +36  mode        0 blocking / 1 nonblocking (FIONBIO)
  ;;   +40  rx_buf      guest pointer to the receive ring, 0 when unallocated
  ;;   +44  rx_cap      ring capacity in bytes
  ;;   +48  rx_head     read offset into the ring
  ;;   +52  rx_len      bytes currently readable
  ;;   +56  flags       bit0 read half closed (FIN seen)
  ;;                    bit1 write half closed (FIN sent)
  ;;                    bit2 reset (peer aborted)
  ;;                    bit3 a connect is outstanding and its result has
  ;;                         not been reported to the guest yet
  ;;                    bit4 that connect failed for want of an answer
  ;;                         (WSAETIMEDOUT), not by refusal
  ;;                    bit5 FD_READ has been posted and not yet re-enabled
  ;;                         by a recv/recvfrom (Winsock's re-enabling rule)
  ;;   +60  backlog     listener backlog, clamped to 1..13; while a socket
  ;;                    is connecting (state 6), its connect deadline in
  ;;                    host ticks instead
  ;;   +64  acc_count   queued accepts
  ;;   +68  acc_queue   13 × i32 child record indexes (ends at +120)
  ;;   +120 tx_inflight a wire stream's send window in use: every DATA frame
  ;;                    sent and not yet credited back, each charged
  ;;                    max(length, VSOCK_FRAME_CHARGE) (see "flow control")
  ;;   +124 rx_credit   what this end owes its sender: bytes the guest has
  ;;                    read plus the overhead of frames already taken off
  ;;                    the wire, not yet returned in a WINDOW frame
  ;;
  ;; The table above is now DECLARED, not just described: the (layout VSock ...)
  ;; below is the single source of every offset in it, and each field access
  ;; goes through (load.field VSock <name> ptr) / (store.field ...). The comment
  ;; survives because a layout carries the offsets and the types but not the
  ;; MEANINGS — what state 6 is, which bit of flags is which. Wave 1 of
  ;; docs/watx-layout-migration-design.md.
  ;;
  ;; Adding a raw (i32.add rec (i32.const N)) field access back into this file is
  ;; a BUILD FAILURE — tools/layout-migrate.js --gate says so, from build.sh.
  ;; =====================================================================

  (layout VSock
    (field state       i32)      ;; +0    0 free / 1 created / 2 bound / 3 listening
                                 ;;       4 connected / 5 closed / 6 connecting
    (field family      i32)      ;; +4    AF_INET
    (field type        i32)      ;; +8    SOCK_STREAM or SOCK_DGRAM
    (field proto       i32)      ;; +12   0, IPPROTO_TCP, or IPPROTO_UDP
    (field local_ip    i32)      ;; +16   host byte order, 0 = INADDR_ANY
    (field local_port  i32)      ;; +20   host byte order
    (field remote_ip   i32)      ;; +24   host byte order
    (field remote_port i32)      ;; +28   host byte order
    (field peer        i32)      ;; +32   peer index, -1 unconnected, -2 out-of-process
    (field mode        i32)      ;; +36   0 blocking / 1 nonblocking (FIONBIO)
    (field rx_buf      i32)      ;; +40   guest pointer to the receive ring
    (field rx_cap      i32)      ;; +44   ring capacity in bytes
    (field rx_head     i32)      ;; +48   read offset into the ring
    (field rx_len      i32)      ;; +52   bytes currently readable
    (field flags       i32)      ;; +56   bit0 read-closed, bit1 write-closed,
                                 ;;       bit2 reset, bit3 connect result unreported
    (field backlog     i32)      ;; +60   listener backlog, clamped 1..13;
                                 ;;       connect deadline while state 6
    (field acc_count   i32)      ;; +64   queued accepts
    (field acc_queue   i32 13)   ;; +68   13 child record indexes, ends at +120
    (field tx_inflight i32)      ;; +120  wire send window in use
    (field rx_credit   i32))     ;; +124  credit owed to the wire sender

  (global $VSOCK_MAX i32 (i32.const 128))
  (global $VSOCK_REC_SIZE i32 (i32.const 128))
  (global $VSOCK_RX_CAP i32 (i32.const 16384))
  ;; A SOCK_DGRAM socket's ring is a queue of records, each
  ;; [payload length][source ip][source port] then the payload, so packet
  ;; boundaries and every sender survive queuing.
  (global $VSOCK_DGRAM_HDR i32 (i32.const 12))
  ;; At most this many datagrams wait per socket; later ones are dropped on
  ;; arrival, as a full receive buffer drops them. The bound is a count, not
  ;; only bytes, because a game can be written against a small real backlog:
  ;; Atomic Bomberman's IPX reader pulls up to 64 datagrams per poll into a
  ;; 64-slot ring, and exactly 64 laps the ring and reads as empty. A join
  ;; request is sent on every pass of a one-second wait loop, so the queue
  ;; would otherwise fill with hundreds of copies of it.
  (global $VSOCK_DGRAM_MAX i32 (i32.const 32))
  ;; ...and in at most this many bytes. A stream ring only has to hold what
  ;; the peer's send window put in flight, but datagrams that do not fit are
  ;; lost: Quake II's signon arrives as a burst of ~1400-byte packets, and a
  ;; 16KB ring dropped enough of them that the client never entered the world.
  (global $VSOCK_DGRAM_RX_CAP i32 (i32.const 65536))
  ;; A connect to a room seat whose machine never answers gives up after
  ;; this long (host wall-clock ms, $host_real_time_ms) with WSAETIMEDOUT, as a SYN nobody acknowledges
  ;; does. The owner answers a SYN for an empty seat with a reset
  ;; (lib/vlan-star.js), so this is for a peer that is there but mute.
  (global $VSOCK_CONNECT_TIMEOUT_MS i32 (i32.const 20000))
  ;; The earliest deadline of any connect in flight, 0 when none: the wire
  ;; drain checks it so an idle process scans nothing.
  (global $vsock_connect_next (mut i32) (i32.const 0))
  (global $VSOCK_HANDLE_TAG i32 (i32.const 0x53000000))

  ;; Room addressing. The host of the room owns 10.0.0.1 and every other
  ;; member takes the next free seat, .2 and .3, so the address a person has
  ;; to type into a game's host-IP box is always the same four characters:
  ;; "10.1", which inet_addr widens to 10.0.0.1.
  ;;
  ;; This deliberately overlaps the range a real home LAN often uses. It
  ;; cannot collide with one: $vsock_addr_in_room below refuses every address
  ;; outside the room and loopback, so no guest packet reaches a real 10.0.0.x
  ;; machine whatever the guest asks for. The only cost is that a log line
  ;; naming 10.0.0.2 reads like a real host, and an address a person can say
  ;; out loud is worth that.
  (global $vsock_local_ip (mut i32) (i32.const 0x0A000001))  ;; 10.0.0.1
  ;; The ephemeral-port cursor is at $VSOCK_NEXT_PORT_SHARED — process-wide, not
  ;; per instance. See $vsock_alloc_port.
  (global $wsa_last_error (mut i32) (i32.const 0))
  (global $wsa_started (mut i32) (i32.const 0))
  ;; Win16 DDEML shares the virtual-LAN wire reader with Winsock. Keeping an
  ;; explicit user count lets ordinary GUI message pumps avoid a host wire
  ;; poll when neither subsystem can consume a frame.
  (global $win16_dde_users (mut i32) (i32.const 0))
  (global $vsock_ntoa_buf (mut i32) (i32.const 0))
  (global $vsock_hostent (mut i32) (i32.const 0))
  (global $vsock_servent (mut i32) (i32.const 0))
  (global $vsock_protoent (mut i32) (i32.const 0))

  ;; ---- helpers --------------------------------------------------------

  (func $vsock_rec (param $idx i32) (result i32)
    (i32.add (global.get $VSOCK_TABLE)
      (i32.mul (local.get $idx) (global.get $VSOCK_REC_SIZE))))

  (func $vsock_set_error (param $err i32)
    (global.set $wsa_last_error (local.get $err)))

  ;; Guest SOCKET handle → record index, or -1 when the handle is not a
  ;; live socket. Handles are tagged so they cannot be confused with file,
  ;; thread, or GDI handles.
  (func $vsock_index (param $handle i32) (result i32)
    (local $idx i32)
    (if (i32.ne (i32.and (local.get $handle) (i32.const 0xFF000000))
                (global.get $VSOCK_HANDLE_TAG))
      (then (return (i32.const -1))))
    (local.set $idx (i32.and (local.get $handle) (i32.const 0xFFFFFF)))
    (if (i32.ge_u (local.get $idx) (global.get $VSOCK_MAX))
      (then (return (i32.const -1))))
    (if (i32.eqz (load.field VSock state (call $vsock_rec (local.get $idx))))
      (then (return (i32.const -1))))
    (local.get $idx))

  (func $vsock_handle (param $idx i32) (result i32)
    (i32.or (global.get $VSOCK_HANDLE_TAG) (local.get $idx)))

  ;; Allocate a zeroed record. Returns the index, or -1 when the table is
  ;; full (WSAEMFILE).
  ;; Serialised on $LOCK_SOCKET. Liquid War opens its connection from a worker
  ;; thread while the UI thread is still in the menu, so "two threads in socket()
  ;; at once" is the normal case here rather than a corner one — and the scan
  ;; below claims a record only after finding it free.
  ;;
  ;; Only the claim is locked, never a send or a receive: those call host imports,
  ;; and a worker parked in Atomics.wait while holding a lock the main thread is
  ;; spinning for deadlocks both (see $lock_acquire).
  (func $vsock_alloc (result i32)
    (local $r i32)
    (call $lock_acquire (global.get $LOCK_SOCKET))
    (local.set $r (call $vsock_alloc_locked))
    (call $lock_release (global.get $LOCK_SOCKET))
    (local.get $r))

  (func $vsock_alloc_locked (result i32)
    (local $i i32) (local $rec i32)
    (local.set $i (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $VSOCK_MAX)))
      (local.set $rec (call $vsock_rec (local.get $i)))
      (if (i32.eqz (load.field VSock state (local.get $rec)))
        (then
          (memory.fill (local.get $rec) (i32.const 0) (global.get $VSOCK_REC_SIZE))
          (store.field VSock peer (local.get $rec) (i32.const -1))
          ;; Claim the record before releasing the lock. Every caller overwrites
          ;; this state a few instructions later, but "free until the caller gets
          ;; around to it" is exactly the window in which a second thread picks
          ;; the same record. 1 = created-but-unbound, the least surprising state
          ;; to be caught in.
          (store.field VSock state (local.get $rec) (i32.const 1))
          (return (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const -1))

  (func $bswap16 (param $v i32) (result i32)
    (i32.or
      (i32.shl (i32.and (local.get $v) (i32.const 0xFF)) (i32.const 8))
      (i32.and (i32.shr_u (local.get $v) (i32.const 8)) (i32.const 0xFF))))

  (func $bswap32 (param $v i32) (result i32)
    (i32.or
      (i32.or
        (i32.shl (i32.and (local.get $v) (i32.const 0xFF)) (i32.const 24))
        (i32.shl (i32.and (local.get $v) (i32.const 0xFF00)) (i32.const 8)))
      (i32.or
        (i32.and (i32.shr_u (local.get $v) (i32.const 8)) (i32.const 0xFF00))
        (i32.and (i32.shr_u (local.get $v) (i32.const 24)) (i32.const 0xFF)))))

  ;; A destination is inside the room when it is the room /24 or loopback.
  ;; Everything else is refused so the guest cannot reach the host LAN.
  (func $vsock_addr_in_room (param $ip i32) (result i32)
    (if (i32.eq (i32.and (local.get $ip) (i32.const 0xFFFFFF00))
                (i32.const 0x0A000000))                      ;; 10.0.0.0/24
      (then (return (i32.const 1))))
    (if (i32.eq (i32.and (local.get $ip) (i32.const 0xFF000000))
                (i32.const 0x7F000000))
      (then (return (i32.const 1))))
    (i32.const 0))

  ;; Read a guest sockaddr_in into locals. Returns 1 on success, 0 when the
  ;; family is not AF_INET or the length is too small.
  ;; Results land in the caller-visible globals below to keep the WAT flat.
  (global $vsock_sa_ip (mut i32) (i32.const 0))
  (global $vsock_sa_port (mut i32) (i32.const 0))

  ;; `$family` is the socket's own: an address of any other family is refused.
  (func $vsock_read_sockaddr (param $addr_ga i32) (param $len i32) (param $family i32)
                             (result i32)
    (local $wa i32)
    (if (i32.eqz (local.get $addr_ga)) (then (return (i32.const 0))))
    (if (i32.lt_s (local.get $len) (i32.const 8)) (then (return (i32.const 0))))
    (local.set $wa (call $g2w (local.get $addr_ga)))
    (if (i32.ne (i32.load16_u (local.get $wa)) (local.get $family))
      (then (return (i32.const 0))))
    (if (i32.eq (local.get $family) (i32.const 6))          ;; AF_IPX
      (then (return (call $vsock_read_sockaddr_ipx (local.get $wa) (local.get $len)))))
    (if (i32.ne (local.get $family) (i32.const 2))
      (then (return (i32.const 0))))
    (global.set $vsock_sa_port
      (call $bswap16 (i32.load16_u (i32.add (local.get $wa) (i32.const 2)))))
    (global.set $vsock_sa_ip
      (call $bswap32 (i32.load (i32.add (local.get $wa) (i32.const 4)))))
    (i32.const 1))

  ;; Write a sockaddr_in for accept/getpeername style out-parameters.
  (func $vsock_write_sockaddr (param $addr_ga i32) (param $len_ga i32)
                              (param $ip i32) (param $port i32)
    (local $wa i32) (local $len_wa i32) (local $cap i32) (local $i i32)
    (if (i32.eqz (local.get $addr_ga)) (then (return)))
    (local.set $cap (i32.const 16))
    (if (local.get $len_ga)
      (then
        (local.set $len_wa (call $g2w (local.get $len_ga)))
        (local.set $cap (i32.load (local.get $len_wa)))))
    (if (i32.lt_s (local.get $cap) (i32.const 16)) (then (return)))
    (local.set $wa (call $g2w (local.get $addr_ga)))
    (i32.store16 (local.get $wa) (i32.const 2))
    (i32.store16 (i32.add (local.get $wa) (i32.const 2))
      (call $bswap16 (local.get $port)))
    (i32.store (i32.add (local.get $wa) (i32.const 4))
      (call $bswap32 (local.get $ip)))
    ;; sin_zero[8]
    (memory.fill (i32.add (local.get $wa) (i32.const 8)) (i32.const 0) (i32.const 8))
    (if (local.get $len_ga)
      (then (i32.store (local.get $len_wa) (i32.const 16)))))

  ;; THIPX32.DLL (Westwood's Win95 IPX layer, Red Alert) is a flat thunk to
  ;; THIPX16 and the real-mode IPX driver, which this machine does not have.
  ;; Its _IPX_Initialise is a constant-FALSE stub row in api_table.json: the
  ;; answer Red Alert gets on a Win98 box without the IPX protocol, after
  ;; which it disables IPX play. The other _IPX_* exports are only reached
  ;; after a successful initialise and stay unimplemented.

  ;; ---- AF_IPX ---------------------------------------------------------
  ;;
  ;; An IPX datagram socket is a room UDP socket under another address
  ;; family, so IPX games (Atomic Bomberman's ipx95.c) join a room with no
  ;; second wire format. SOCKADDR_IPX is 14 bytes:
  ;;   +0 sa_family (6)  +2 sa_netnum[4]  +6 sa_nodenum[6]  +12 sa_socket (BE)
  ;; The node carries the room address as 00 00 a b c d, the way Windows'
  ;; IPX-over-IP shims derive a node from an IPv4 one, and the socket number
  ;; is the port. Node FF FF FF FF FF FF is IPX broadcast, which is the room's
  ;; limited broadcast (-1). Every room machine sits on network 0, the "this
  ;; network" number IPX lets a sender use before it has learned its own.

  (func $vsock_read_sockaddr_ipx (param $wa i32) (param $len i32) (result i32)
    (if (i32.lt_s (local.get $len) (i32.const 14)) (then (return (i32.const 0))))
    (global.set $vsock_sa_port
      (call $bswap16 (i32.load16_u (i32.add (local.get $wa) (i32.const 12)))))
    (if (i32.and
          (i32.eq (i32.load16_u (i32.add (local.get $wa) (i32.const 6))) (i32.const 0xFFFF))
          (i32.eq (i32.load (i32.add (local.get $wa) (i32.const 8))) (i32.const -1)))
      (then
        (global.set $vsock_sa_ip (i32.const -1))
        (return (i32.const 1))))
    ;; A node whose top two bytes are not zero names no room machine; it can
    ;; only be a real Ethernet MAC, which this network has none of.
    (if (i32.load16_u (i32.add (local.get $wa) (i32.const 6)))
      (then (return (i32.const 0))))
    (global.set $vsock_sa_ip
      (call $bswap32 (i32.load (i32.add (local.get $wa) (i32.const 8)))))
    (i32.const 1))

  (func $vsock_write_sockaddr_ipx (param $addr_ga i32) (param $len_ga i32)
                                  (param $ip i32) (param $port i32)
    (local $wa i32) (local $len_wa i32) (local $cap i32)
    (if (i32.eqz (local.get $addr_ga)) (then (return)))
    (local.set $cap (i32.const 14))
    (if (local.get $len_ga)
      (then
        (local.set $len_wa (call $g2w (local.get $len_ga)))
        (local.set $cap (i32.load (local.get $len_wa)))))
    (if (i32.lt_s (local.get $cap) (i32.const 14)) (then (return)))
    (local.set $wa (call $g2w (local.get $addr_ga)))
    (i32.store16 (local.get $wa) (i32.const 6))
    (i32.store (i32.add (local.get $wa) (i32.const 2)) (i32.const 0))
    (i32.store16 (i32.add (local.get $wa) (i32.const 6)) (i32.const 0))
    (i32.store (i32.add (local.get $wa) (i32.const 8)) (call $bswap32 (local.get $ip)))
    (i32.store16 (i32.add (local.get $wa) (i32.const 12)) (call $bswap16 (local.get $port)))
    (if (local.get $len_ga)
      (then (i32.store (local.get $len_wa) (i32.const 14)))))

  ;; Out-parameter address in the socket's own family.
  (func $vsock_write_sockaddr_for (param $rec i32) (param $addr_ga i32) (param $len_ga i32)
                                  (param $ip i32) (param $port i32)
    (if (i32.eq (load.field VSock family (local.get $rec)) (i32.const 6))
      (then
        (call $vsock_write_sockaddr_ipx (local.get $addr_ga) (local.get $len_ga)
          (local.get $ip) (local.get $port))
        (return)))
    (call $vsock_write_sockaddr (local.get $addr_ga) (local.get $len_ga)
      (local.get $ip) (local.get $port)))

  ;; Is any live record already bound to this ip/port pair?
  ;; $type is the asking socket's SOCK_STREAM/SOCK_DGRAM: TCP and UDP ports
  ;; are separate spaces, so a stream socket may bind the port a datagram
  ;; socket holds (Jazz Jackrabbit 2's server takes UDP and TCP 10052, and
  ;; WSAEADDRINUSE on the second put up "Could not start Server"). IPX rides
  ;; the UDP mapping, so it shares the datagram space. -1 asks about both,
  ;; for the ephemeral allocator.
  (func $vsock_port_taken (param $ip i32) (param $port i32) (param $type i32) (result i32)
    (local $i i32) (local $rec i32) (local $st i32)
    (local.set $i (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $VSOCK_MAX)))
      (local.set $rec (call $vsock_rec (local.get $i)))
      (local.set $st (load.field VSock state (local.get $rec)))
      ;; States 2..4 own their local port, and so does 6 (connecting).
      (if (i32.or (i32.and (i32.ge_u (local.get $st) (i32.const 2))
                           (i32.le_u (local.get $st) (i32.const 4)))
                  (i32.eq (local.get $st) (i32.const 6)))
        (then
          (if (i32.and
                (i32.eq (load.field VSock local_port (local.get $rec)) (local.get $port))
                (i32.or (i32.eq (local.get $type) (i32.const -1))
                        (i32.eq (load.field VSock type (local.get $rec)) (local.get $type))))
            (then
              ;; INADDR_ANY on either side collides with every address.
              (if (i32.or
                    (i32.or (i32.eqz (local.get $ip))
                            (i32.eqz (load.field VSock local_ip (local.get $rec))))
                    (i32.eq (load.field VSock local_ip (local.get $rec))
                            (local.get $ip)))
                (then (return (i32.const 1))))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  ;; The cursor is process-wide (shared memory) and the pick-then-test is under
  ;; the socket lock, so two threads calling connect() at the same moment get
  ;; different ephemeral ports instead of racing for one.
  (func $vsock_alloc_port (result i32)
    (local $r i32)
    (call $lock_acquire (global.get $LOCK_SOCKET))
    (local.set $r (call $vsock_alloc_port_locked))
    (call $lock_release (global.get $LOCK_SOCKET))
    (local.get $r))

  (func $vsock_alloc_port_locked (result i32)
    (local $tries i32) (local $port i32) (local $next i32)
    (local.set $tries (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $tries) (i32.const 16384)))
      (local.set $port (i32.load (global.get $VSOCK_NEXT_PORT_SHARED)))
      (if (i32.lt_u (local.get $port) (i32.const 49152))
        (then (local.set $port (i32.const 49152))))
      (local.set $next (i32.add (local.get $port) (i32.const 1)))
      (if (i32.gt_u (local.get $next) (i32.const 65535))
        (then (local.set $next (i32.const 49152))))
      (i32.store (global.get $VSOCK_NEXT_PORT_SHARED) (local.get $next))
      (if (i32.eqz (call $vsock_port_taken (global.get $vsock_local_ip) (local.get $port) (i32.const -1)))
        (then (return (local.get $port))))
      (local.set $tries (i32.add (local.get $tries) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  ;; Find a listening record that would accept a connection to ip:port.
  (func $vsock_find_listener (param $ip i32) (param $port i32) (result i32)
    (local $i i32) (local $rec i32) (local $lip i32)
    (local.set $i (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $VSOCK_MAX)))
      (local.set $rec (call $vsock_rec (local.get $i)))
      (if (i32.eq (load.field VSock state (local.get $rec)) (i32.const 3))
        (then
          (if (i32.eq (load.field VSock local_port (local.get $rec)) (local.get $port))
            (then
              (local.set $lip (load.field VSock local_ip (local.get $rec)))
              (if (i32.or (i32.eqz (local.get $lip)) (i32.eq (local.get $lip) (local.get $ip)))
                (then (return (local.get $i))))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const -1))

;; Is this machine's game SERVING on `port` -- a TCP socket listening there,
  ;; whatever address it bound (0 = any port)? The shell asks this to mark a
  ;; room hosting (lib/vlan-star.js, hostProbe protocol 'serving'), because
  ;; nothing on the wire says so: a listener sends nothing until somebody
  ;; connects, and probing it with a SYN would hand the game a phantom player.
  (func (export "net_listening") (param $port i32) (result i32)
    (local $i i32) (local $rec i32)
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $VSOCK_MAX)))
      (local.set $rec (call $vsock_rec (local.get $i)))
      (if (i32.and
            (i32.eq (load.field VSock state (local.get $rec)) (i32.const 3))
            (i32.or (i32.eqz (local.get $port))
                    (i32.eq (load.field VSock local_port (local.get $rec)) (local.get $port))))
        (then (return (i32.const 1))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  (func $vsock_alloc_ring (param $idx i32) (result i32)
    (local $rec i32) (local $buf i32) (local $cap i32)
    (local.set $rec (call $vsock_rec (local.get $idx)))
    (if (load.field VSock rx_buf (local.get $rec))
      (then (return (i32.const 1))))
    (local.set $cap (select (global.get $VSOCK_DGRAM_RX_CAP) (global.get $VSOCK_RX_CAP)
      (i32.eq (load.field VSock type (local.get $rec)) (i32.const 2))))
    (local.set $buf (call $heap_alloc (local.get $cap)))
    (if (i32.eqz (local.get $buf)) (then (return (i32.const 0))))
    (store.field VSock rx_buf (local.get $rec) (local.get $buf))
    (store.field VSock rx_cap (local.get $rec) (local.get $cap))
    (store.field VSock rx_head (local.get $rec) (i32.const 0))
    (store.field VSock rx_len (local.get $rec) (i32.const 0))
    (i32.const 1))

  ;; Bytes this record can still accept into its receive ring.
  (func $vsock_rx_space (param $idx i32) (result i32)
    (local $rec i32)
    (local.set $rec (call $vsock_rec (local.get $idx)))
    (i32.sub (load.field VSock rx_cap (local.get $rec))
             (load.field VSock rx_len (local.get $rec))))

  ;; Append n bytes of guest memory at src_ga into idx's receive ring.
  (func $vsock_ring_write (param $idx i32) (param $src_ga i32) (param $n i32)
    (local $rec i32) (local $buf i32) (local $cap i32) (local $head i32)
    (local $len i32) (local $pos i32) (local $i i32)
    (local.set $rec (call $vsock_rec (local.get $idx)))
    (local.set $buf (call $g2w (load.field VSock rx_buf (local.get $rec))))
    (local.set $cap (load.field VSock rx_cap (local.get $rec)))
    (local.set $head (load.field VSock rx_head (local.get $rec)))
    (local.set $len (load.field VSock rx_len (local.get $rec)))
    (local.set $i (i32.const 0))
    (block $done (loop $copy
      (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
      (local.set $pos (i32.add (local.get $head) (i32.add (local.get $len) (local.get $i))))
      (local.set $pos (i32.rem_u (local.get $pos) (local.get $cap)))
      (i32.store8 (i32.add (local.get $buf) (local.get $pos))
        (i32.load8_u (call $g2w (i32.add (local.get $src_ga) (local.get $i)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $copy)))
    (store.field VSock rx_len (local.get $rec) (i32.add (local.get $len) (local.get $n))))

  ;; Remove up to n bytes from idx's ring into guest memory at dst_ga.
  (func $vsock_ring_read (param $idx i32) (param $dst_ga i32) (param $n i32) (result i32)
    (local $rec i32) (local $buf i32) (local $cap i32) (local $head i32)
    (local $len i32) (local $i i32)
    (local.set $rec (call $vsock_rec (local.get $idx)))
    (local.set $len (load.field VSock rx_len (local.get $rec)))
    (if (i32.lt_u (local.get $len) (local.get $n))
      (then (local.set $n (local.get $len))))
    (if (i32.eqz (local.get $n)) (then (return (i32.const 0))))
    (local.set $buf (call $g2w (load.field VSock rx_buf (local.get $rec))))
    (local.set $cap (load.field VSock rx_cap (local.get $rec)))
    (local.set $head (load.field VSock rx_head (local.get $rec)))
    (local.set $i (i32.const 0))
    (block $done (loop $copy
      (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
      (i32.store8 (call $g2w (i32.add (local.get $dst_ga) (local.get $i)))
        (i32.load8_u (i32.add (local.get $buf)
          (i32.rem_u (i32.add (local.get $head) (local.get $i)) (local.get $cap)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $copy)))
    (store.field VSock rx_head (local.get $rec) (i32.rem_u (i32.add (local.get $head) (local.get $n)) (local.get $cap)))
    (store.field VSock rx_len (local.get $rec) (i32.sub (local.get $len) (local.get $n)))
    (local.get $n))

  ;; ---- datagram records (see $VSOCK_DGRAM_HDR) --------------------------

  ;; Append one little-endian dword to idx's ring. The caller checked space.
  (func $vsock_ring_put32 (param $idx i32) (param $v i32)
    (local $rec i32) (local $buf i32) (local $cap i32) (local $end i32) (local $i i32)
    (local.set $rec (call $vsock_rec (local.get $idx)))
    (local.set $buf (call $g2w (load.field VSock rx_buf (local.get $rec))))
    (local.set $cap (load.field VSock rx_cap (local.get $rec)))
    (local.set $end (i32.add (load.field VSock rx_head (local.get $rec))
                             (load.field VSock rx_len (local.get $rec))))
    (local.set $i (i32.const 0))
    (block $done (loop $byte
      (br_if $done (i32.ge_u (local.get $i) (i32.const 4)))
      (i32.store8 (i32.add (local.get $buf)
                    (i32.rem_u (i32.add (local.get $end) (local.get $i)) (local.get $cap)))
        (i32.shr_u (local.get $v) (i32.shl (local.get $i) (i32.const 3))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $byte)))
    (store.field VSock rx_len (local.get $rec)
      (i32.add (load.field VSock rx_len (local.get $rec)) (i32.const 4))))

  ;; The dword `off` bytes past idx's read head, without consuming it.
  (func $vsock_ring_get32 (param $idx i32) (param $off i32) (result i32)
    (local $rec i32) (local $buf i32) (local $cap i32) (local $at i32)
    (local $i i32) (local $v i32)
    (local.set $rec (call $vsock_rec (local.get $idx)))
    (local.set $buf (call $g2w (load.field VSock rx_buf (local.get $rec))))
    (local.set $cap (load.field VSock rx_cap (local.get $rec)))
    (local.set $at (i32.add (load.field VSock rx_head (local.get $rec)) (local.get $off)))
    (local.set $i (i32.const 0))
    (block $done (loop $byte
      (br_if $done (i32.ge_u (local.get $i) (i32.const 4)))
      (local.set $v (i32.or (local.get $v)
        (i32.shl
          (i32.load8_u (i32.add (local.get $buf)
            (i32.rem_u (i32.add (local.get $at) (local.get $i)) (local.get $cap))))
          (i32.shl (local.get $i) (i32.const 3)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $byte)))
    (local.get $v))

  ;; Discard n bytes at idx's read head.
  (func $vsock_ring_skip (param $idx i32) (param $n i32)
    (local $rec i32)
    (local.set $rec (call $vsock_rec (local.get $idx)))
    (store.field VSock rx_head (local.get $rec)
      (i32.rem_u (i32.add (load.field VSock rx_head (local.get $rec)) (local.get $n))
                 (load.field VSock rx_cap (local.get $rec))))
    (store.field VSock rx_len (local.get $rec)
      (i32.sub (load.field VSock rx_len (local.get $rec)) (local.get $n))))

  ;; Walk idx's queued datagram records. Returns the record count, or with
  ;; $payload set the total payload bytes (what FIONREAD reports).
  (func $vsock_dgram_walk (param $idx i32) (param $payload i32) (result i32)
    (local $rec i32) (local $len i32) (local $off i32) (local $n i32)
    (local $sum i32) (local $plen i32)
    (local.set $rec (call $vsock_rec (local.get $idx)))
    (local.set $len (load.field VSock rx_len (local.get $rec)))
    (block $done (loop $next
      (br_if $done (i32.ge_u (local.get $off) (local.get $len)))
      (local.set $plen (call $vsock_ring_get32 (local.get $idx) (local.get $off)))
      (local.set $n (i32.add (local.get $n) (i32.const 1)))
      (local.set $sum (i32.add (local.get $sum) (local.get $plen)))
      (local.set $off (i32.add (local.get $off)
        (i32.add (global.get $VSOCK_DGRAM_HDR) (local.get $plen))))
      (br $next)))
    (select (local.get $sum) (local.get $n) (local.get $payload)))

  (func $vsock_dgram_count (param $idx i32) (result i32)
    (call $vsock_dgram_walk (local.get $idx) (i32.const 0)))

  ;; Release a record and notify its peer. graceful=0 delivers a reset.
  (func $vsock_destroy (param $idx i32) (param $graceful i32)
    (local $rec i32) (local $peer i32) (local $prec i32) (local $buf i32)
    (local $i i32) (local $child i32)
    (local.set $rec (call $vsock_rec (local.get $idx)))
    (if (i32.eqz (load.field VSock state (local.get $rec))) (then (return)))
    ;; A listener drops every connection still waiting in its backlog.
    (if (i32.eq (load.field VSock state (local.get $rec)) (i32.const 3))
      (then
        (local.set $i (i32.const 0))
        (block $ad (loop $al
          (br_if $ad (i32.ge_u (local.get $i) (load.field VSock acc_count (local.get $rec))))
          (local.set $child (load.field-elem VSock acc_queue (local.get $rec) (local.get $i)))
          (call $vsock_destroy (local.get $child) (i32.const 0))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $al)))
        (store.field VSock acc_count (local.get $rec) (i32.const 0))))
    (local.set $peer (load.field VSock peer (local.get $rec)))
    ;; A peer in another process learns about the close from the wire. The
    ;; same graceful/abortive split applies: FIN after shutdown, RST when
    ;; the write half was still open.
    (if (i32.eq (local.get $peer) (i32.const -2))
      (then
        (drop (call $vsock_emit_from (local.get $idx)
          (if (result i32) (local.get $graceful) (then (i32.const 4)) (else (i32.const 5)))
          (i32.const 0) (i32.const 0)))))
    (if (i32.ge_s (local.get $peer) (i32.const 0))
      (then
        (local.set $prec (call $vsock_rec (local.get $peer)))
        (if (load.field VSock state (local.get $prec))
          (then
            (store.field VSock peer (local.get $prec) (i32.const -1))
            (store.field VSock flags (local.get $prec) (i32.or (load.field VSock flags (local.get $prec))
                (if (result i32) (local.get $graceful)
                  (then (i32.const 1))     ;; orderly EOF for the reader
                  (else (i32.const 5)))))))))  ;; read-closed + reset
    (local.set $buf (load.field VSock rx_buf (local.get $rec)))
    (if (local.get $buf) (then (call $heap_free (local.get $buf))))
    (store.field VSock state (local.get $rec) (i32.const 0))
    (store.field VSock rx_buf (local.get $rec) (i32.const 0))
    (store.field VSock peer (local.get $rec) (i32.const -1)))

  ;; ---- readiness ------------------------------------------------------

  ;; Read-ready: queued bytes, an orderly EOF, a reset, or a listener with
  ;; a nonempty accept queue.
  (func $vsock_read_ready (param $idx i32) (result i32)
    (local $rec i32) (local $st i32)
    (local.set $rec (call $vsock_rec (local.get $idx)))
    (local.set $st (load.field VSock state (local.get $rec)))
    (if (i32.eq (local.get $st) (i32.const 3))
      (then (return (i32.gt_u (load.field VSock acc_count (local.get $rec)) (i32.const 0)))))
    (if (i32.gt_u (load.field VSock rx_len (local.get $rec)) (i32.const 0))
      (then (return (i32.const 1))))
    (i32.ne (i32.and (load.field VSock flags (local.get $rec)) (i32.const 5))
            (i32.const 0)))

  ;; Write-ready: a connected stream whose write half is open and whose
  ;; peer can still take bytes.
  (func $vsock_write_ready (param $idx i32) (result i32)
    (local $rec i32) (local $peer i32)
    (local.set $rec (call $vsock_rec (local.get $idx)))
    (if (i32.eq (load.field VSock type (local.get $rec)) (i32.const 2))
      (then (return (i32.or
        (i32.eq (load.field VSock state (local.get $rec)) (i32.const 1))
        (i32.eq (load.field VSock state (local.get $rec)) (i32.const 2))))))
    (if (i32.ne (load.field VSock state (local.get $rec)) (i32.const 4))
      (then (return (i32.const 0))))
    (if (i32.and (load.field VSock flags (local.get $rec)) (i32.const 2))
      (then (return (i32.const 0))))
    (local.set $peer (load.field VSock peer (local.get $rec)))
    ;; A remote peer's ring is not visible here; the send window stands in
    ;; for it (see "flow control" below).
    (if (i32.eq (local.get $peer) (i32.const -2))
      (then (return (i32.lt_s (load.field VSock tx_inflight (local.get $rec))
                              (global.get $VSOCK_WINDOW)))))
    (if (i32.lt_s (local.get $peer) (i32.const 0)) (then (return (i32.const 0))))
    (i32.gt_u (call $vsock_rx_space (local.get $peer)) (i32.const 0)))

  (func $vsock_except_ready (param $idx i32) (result i32)
    (i32.ne (i32.and (load.field VSock flags (call $vsock_rec (local.get $idx)))
                     (i32.const 4))
            (i32.const 0)))

  ;; ---- the wire -------------------------------------------------------
  ;;
  ;; Everything above is one process's half of the room. A second process
  ;; has its own table at its own address, so the two halves meet over a
  ;; frame wire that the host merely carries — the host never inspects a
  ;; port, tracks a connection, or decides a route. Frames are broadcast to
  ;; the room and each process keeps only what is addressed to it, which is
  ;; how a LAN segment behaves and keeps the routing decision in WAT.
  ;;
  ;; Frame layout (28-byte header, then payload):
  ;;   +0  magic 'VLN1'   +4  type   +8  src_ip   +12 src_port
  ;;   +16 dst_ip         +20 dst_port           +24 payload length
  ;;
  ;; Types: 1 SYN (open), 2 SYNACK (accepted), 3 DATA, 4 FIN (orderly write
  ;; close), 5 RST (refused or aborted), 6 DGRAM, 7 GONE, and 8 WINDOW.
  ;;
  ;; GONE is never sent by a guest. The host puts it into its own inbox when
  ;; the link to a room address closes (Wire.peerGone in lib/vlan-wire.js):
  ;; src_ip is the address that left, or -1 when every remote address left
  ;; at once (a member whose one link, to the owner, closed). Without it a
  ;; closed tab is silence, and silence is forever: a blocking recv, a
  ;; connect in flight and a DirectPlay session all wait on a peer that will
  ;; never answer.
  ;;
  ;; Flow control. A stream frame that does not fit its socket's ring cannot
  ;; be dropped, and while it waits at the head of the wire nothing behind it
  ;; moves -- not the other connections, not DirectPlay, not a datagram. So a
  ;; sender never puts more in flight than the far ring is guaranteed to take:
  ;; VSOCK_WINDOW bytes, the size of every stream ring. Each DATA frame is
  ;; charged max(length, VSOCK_FRAME_CHARGE) against it, which also bounds the
  ;; frames in flight (a flood of 1-byte sends is 256 frames, not 16384) for
  ;; the wire's inbox. The receiver hands the charge back in type 8 WINDOW
  ;; frames, a 4-byte payload of credit: the frame overhead as soon as the
  ;; frame is in the ring, the bytes once the guest has read them, batched to
  ;; VSOCK_CREDIT_STEP. A sender at zero window blocks, or reports
  ;; WSAEWOULDBLOCK and gets FD_WRITE when credit returns. That cannot
  ;; deadlock: a zero window means the whole charge is sitting in the far
  ;; ring or its credit, so once the reader drains the ring the credit owed
  ;; is the whole window, past the step.

  ;; Must equal VSOCK_RX_CAP: the window is the far ring's guaranteed room.
  (global $VSOCK_WINDOW i32 (i32.const 16384))
  (global $VSOCK_FRAME_CHARGE i32 (i32.const 64))
  (global $VSOCK_CREDIT_STEP i32 (i32.const 4096))
  ;; Some record owes credit it could not send yet (the wire was full, or a
  ;; frame was being delivered); the next pump retries.
  (global $vsock_credit_due (mut i32) (i32.const 0))

  (global $VLN_MAGIC i32 (i32.const 0x314E4C56))
  (global $VLN_HDR i32 (i32.const 28))
  (global $VLN_MAX_PAYLOAD i32 (i32.const 4096))
  (global $vsock_frame_buf (mut i32) (i32.const 0))

  ;; Scratch frame buffer, allocated once. Returns its WASM address, or 0
  ;; when the heap is exhausted.
  (func $vsock_frame_wa (result i32)
    (if (i32.eqz (global.get $vsock_frame_buf))
      (then (global.set $vsock_frame_buf (call $heap_alloc
        (i32.add (global.get $VLN_HDR) (global.get $VLN_MAX_PAYLOAD))))))
    (if (i32.eqz (global.get $vsock_frame_buf)) (then (return (i32.const 0))))
    (call $g2w (global.get $vsock_frame_buf)))

  ;; An address this process answers for: its own room address, loopback,
  ;; or the unspecified address.
  (func $vsock_is_local_addr (param $ip i32) (result i32)
    (if (i32.eqz (local.get $ip)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $ip) (global.get $vsock_local_ip)) (then (return (i32.const 1))))
    (i32.eq (i32.and (local.get $ip) (i32.const 0xFF000000)) (i32.const 0x7F000000)))

  ;; Build a frame and hand it to the wire. Returns 1 when the wire took it,
  ;; 0 when its queue is full (the caller must retry, never drop).
  (func $vsock_emit (param $type i32) (param $src_ip i32) (param $src_port i32)
                    (param $dst_ip i32) (param $dst_port i32)
                    (param $payload_ga i32) (param $len i32) (result i32)
    (local $wa i32) (local $i i32)
    (local.set $wa (call $vsock_frame_wa))
    (if (i32.eqz (local.get $wa)) (then (return (i32.const 0))))
    (if (i32.gt_u (local.get $len) (global.get $VLN_MAX_PAYLOAD))
      (then (local.set $len (global.get $VLN_MAX_PAYLOAD))))
    (i32.store (local.get $wa) (global.get $VLN_MAGIC))
    (i32.store (i32.add (local.get $wa) (i32.const 4))  (local.get $type))
    (i32.store (i32.add (local.get $wa) (i32.const 8))  (local.get $src_ip))
    (i32.store (i32.add (local.get $wa) (i32.const 12)) (local.get $src_port))
    (i32.store (i32.add (local.get $wa) (i32.const 16)) (local.get $dst_ip))
    (i32.store (i32.add (local.get $wa) (i32.const 20)) (local.get $dst_port))
    (i32.store (i32.add (local.get $wa) (i32.const 24)) (local.get $len))
    (local.set $i (i32.const 0))
    (block $done (loop $copy
      (br_if $done (i32.ge_u (local.get $i) (local.get $len)))
      (i32.store8 (i32.add (local.get $wa) (i32.add (global.get $VLN_HDR) (local.get $i)))
        (i32.load8_u (call $g2w (i32.add (local.get $payload_ga) (local.get $i)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $copy)))
    (call $host_net_frame_send (local.get $wa)
      (i32.add (global.get $VLN_HDR) (local.get $len))))

  ;; Emit a frame from a record's own endpoints.
  (func $vsock_emit_from (param $idx i32) (param $type i32)
                         (param $payload_ga i32) (param $len i32) (result i32)
    (local $rec i32)
    (local.set $rec (call $vsock_rec (local.get $idx)))
    (call $vsock_emit (local.get $type)
      (load.field VSock local_ip (local.get $rec))
      (load.field VSock local_port (local.get $rec))
      (load.field VSock remote_ip (local.get $rec))
      (load.field VSock remote_port (local.get $rec))
      (local.get $payload_ga) (local.get $len)))

  ;; What one DATA frame of n bytes costs the send window.
  (func $vsock_frame_charge (param $n i32) (result i32)
    (select (local.get $n) (global.get $VSOCK_FRAME_CHARGE)
      (i32.gt_u (local.get $n) (global.get $VSOCK_FRAME_CHARGE))))

  ;; Owe record idx's wire sender n more units of credit, and send it once a
  ;; step has built up. now=0 only records the debt: while a frame is being
  ;; delivered the scratch buffer still holds it, so the pump sends later.
  (func $vsock_owe_credit (param $idx i32) (param $n i32) (param $now i32)
    (local $rec i32) (local $c i32)
    (local.set $rec (call $vsock_rec (local.get $idx)))
    (local.set $c (i32.add (load.field VSock rx_credit (local.get $rec)) (local.get $n)))
    (store.field VSock rx_credit (local.get $rec) (local.get $c))
    (if (i32.lt_u (local.get $c) (global.get $VSOCK_CREDIT_STEP)) (then (return)))
    (if (local.get $now)
      (then (if (call $vsock_send_credit (local.get $idx)) (then (return)))))
    (global.set $vsock_credit_due (i32.const 1)))

  ;; Return everything record idx owes in one WINDOW frame. 1 when sent or
  ;; nothing was owed, 0 when the wire refused it.
  (func $vsock_send_credit (param $idx i32) (result i32)
    (local $rec i32) (local $wa i32)
    (local.set $rec (call $vsock_rec (local.get $idx)))
    (if (i32.eqz (load.field VSock rx_credit (local.get $rec))) (then (return (i32.const 1))))
    (local.set $wa (call $vsock_frame_wa))
    (if (i32.eqz (local.get $wa)) (then (return (i32.const 0))))
    ;; The payload is written where $vsock_emit copies it to, so its copy
    ;; moves nothing.
    (i32.store (i32.add (local.get $wa) (global.get $VLN_HDR))
      (load.field VSock rx_credit (local.get $rec)))
    (if (i32.eqz (call $vsock_emit_from (local.get $idx) (i32.const 8)
          (i32.add (global.get $vsock_frame_buf) (global.get $VLN_HDR)) (i32.const 4)))
      (then (return (i32.const 0))))
    (store.field VSock rx_credit (local.get $rec) (i32.const 0))
    (i32.const 1))

  ;; Send every debt that a full wire or a delivery in progress deferred.
  (func $vsock_flush_credit
    (local $i i32) (local $rec i32)
    (if (i32.eqz (global.get $vsock_credit_due)) (then (return)))
    (global.set $vsock_credit_due (i32.const 0))
    (local.set $i (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $VSOCK_MAX)))
      (local.set $rec (call $vsock_rec (local.get $i)))
      (if (i32.and
            (i32.eq (load.field VSock state (local.get $rec)) (i32.const 4))
            (i32.and
              (i32.eq (load.field VSock peer (local.get $rec)) (i32.const -2))
              (i32.ge_u (load.field VSock rx_credit (local.get $rec))
                        (global.get $VSOCK_CREDIT_STEP))))
        (then
          (if (i32.eqz (call $vsock_send_credit (local.get $i)))
            (then (global.set $vsock_credit_due (i32.const 1))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan))))

  ;; Find a record in the given state whose remote endpoint and local port
  ;; match an inbound frame. Only remote-peered records are candidates.
  (func $vsock_find_conn (param $state i32) (param $lport i32)
                         (param $rip i32) (param $rport i32) (result i32)
    (local $i i32) (local $rec i32)
    (local.set $i (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $VSOCK_MAX)))
      (local.set $rec (call $vsock_rec (local.get $i)))
      (if (i32.and
            (i32.eq (load.field VSock state (local.get $rec)) (local.get $state))
            (i32.eq (load.field VSock peer (local.get $rec)) (i32.const -2)))
        (then
          (if (i32.and
                (i32.eq (load.field VSock local_port (local.get $rec)) (local.get $lport))
                (i32.and
                  (i32.eq (load.field VSock remote_ip (local.get $rec)) (local.get $rip))
                  (i32.eq (load.field VSock remote_port (local.get $rec)) (local.get $rport))))
            (then (return (local.get $i))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const -1))

  ;; Find the datagram socket that owns an inbound destination. UDP has no
  ;; connection record: each queued datagram carries its own sender in its
  ;; ring record (see $VSOCK_DGRAM_HDR).
  (func $vsock_find_udp (param $dip i32) (param $dport i32) (result i32)
    (local $i i32) (local $rec i32) (local $lip i32)
    (local.set $i (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $VSOCK_MAX)))
      (local.set $rec (call $vsock_rec (local.get $i)))
      (if (i32.and
            (i32.and
              (i32.eq (load.field VSock state (local.get $rec)) (i32.const 2))
              (i32.eq (load.field VSock type (local.get $rec)) (i32.const 2)))
            (i32.eq (load.field VSock local_port (local.get $rec)) (local.get $dport)))
        (then
          (local.set $lip (load.field VSock local_ip (local.get $rec)))
          (if (i32.or
                (i32.eq (local.get $dip) (i32.const -1))
                (i32.or (i32.eqz (local.get $lip))
                        (i32.eq (local.get $lip) (local.get $dip))))
            (then (return (local.get $i))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const -1))

  ;; Accept an inbound SYN into the matching listener's backlog.
  ;; Returns 1 once the frame has been consumed, either by opening a
  ;; connection or by refusing it.
  (func $vsock_deliver_syn (param $sip i32) (param $sport i32)
                           (param $dip i32) (param $dport i32) (result i32)
    (local $lis i32) (local $lrec i32) (local $child i32) (local $crec i32)
    (local.set $lis (call $vsock_find_listener (local.get $dip) (local.get $dport)))
    (if (i32.lt_s (local.get $lis) (i32.const 0))
      (then
        (drop (call $vsock_emit (i32.const 5) (local.get $dip) (local.get $dport)
                (local.get $sip) (local.get $sport) (i32.const 0) (i32.const 0)))
        (return (i32.const 1))))
    (local.set $lrec (call $vsock_rec (local.get $lis)))
    (if (i32.ge_u (load.field VSock acc_count (local.get $lrec))
                  (load.field VSock backlog (local.get $lrec)))
      (then
        ;; Backlog full. A real stack drops the SYN and lets the peer retry;
        ;; here the wire is lossless, so refuse explicitly instead.
        (drop (call $vsock_emit (i32.const 5) (local.get $dip) (local.get $dport)
                (local.get $sip) (local.get $sport) (i32.const 0) (i32.const 0)))
        (return (i32.const 1))))
    (local.set $child (call $vsock_alloc))
    (if (i32.lt_s (local.get $child) (i32.const 0))
      (then
        (drop (call $vsock_emit (i32.const 5) (local.get $dip) (local.get $dport)
                (local.get $sip) (local.get $sport) (i32.const 0) (i32.const 0)))
        (return (i32.const 1))))
    (local.set $crec (call $vsock_rec (local.get $child)))
    (store.field VSock state (local.get $crec) (i32.const 4))
    (store.field VSock family (local.get $crec) (i32.const 2))
    (store.field VSock type (local.get $crec) (i32.const 1))
    (store.field VSock local_ip (local.get $crec) (local.get $dip))
    (store.field VSock local_port (local.get $crec) (local.get $dport))
    (store.field VSock remote_ip (local.get $crec) (local.get $sip))
    (store.field VSock remote_port (local.get $crec) (local.get $sport))
    (store.field VSock peer (local.get $crec) (i32.const -2))
    (if (i32.eqz (call $vsock_alloc_ring (local.get $child)))
      (then
        (store.field VSock state (local.get $crec) (i32.const 0))
        (drop (call $vsock_emit (i32.const 5) (local.get $dip) (local.get $dport)
                (local.get $sip) (local.get $sport) (i32.const 0) (i32.const 0)))
        (return (i32.const 1))))
    (store.field-elem VSock acc_queue (local.get $lrec)
      (load.field VSock acc_count (local.get $lrec)) (local.get $child))
    (store.field VSock acc_count (local.get $lrec) (i32.add (load.field VSock acc_count (local.get $lrec)) (i32.const 1)))
    (drop (call $vsock_emit (i32.const 2) (local.get $dip) (local.get $dport)
            (local.get $sip) (local.get $sport) (i32.const 0) (i32.const 0)))
    ;; FD_ACCEPT on the LISTENER, not the new connection. A server written to
    ;; the message model never polls: it calls accept only when told a
    ;; connection is waiting, so without this edge the backlog fills silently
    ;; and the peer sits in a connection that was answered but never taken up.
    (call $vsock_async_post (local.get $lis) (i32.const 0x08) (i32.const 0))
    (i32.const 1))

  ;; A connection that will never hear from its peer again: an RST, a GONE, or
  ;; a connect that timed out. The guest finds out the way Winsock tells it --
  ;; the next recv/send fails with $err, a parked connect returns it, and a
  ;; WSAAsyncSelect app gets FD_CONNECT(err) or FD_CLOSE(err).
  (func $vsock_abort (param $idx i32) (param $err i32)
    (local $rec i32)
    (local.set $rec (call $vsock_rec (local.get $idx)))
    (store.field VSock flags (local.get $rec)
      (i32.or (load.field VSock flags (local.get $rec))
        (select (i32.const 0x15) (i32.const 5) (i32.eq (local.get $err) (i32.const 10060)))))
    (store.field VSock peer (local.get $rec) (i32.const -1))
    ;; A failure before the connection came up is a failed connect, and the
    ;; app learns the reason from the error half of lParam rather than from a
    ;; close it never opened.
    (if (i32.eq (load.field VSock state (local.get $rec)) (i32.const 6))
      (then (call $vsock_async_post (local.get $idx) (i32.const 0x10) (local.get $err)))
      (else (call $vsock_async_post (local.get $idx) (i32.const 0x20) (local.get $err)))))

  ;; GONE: every live connection to $ip (-1: to any remote address) loses its
  ;; peer, and so does the DirectPlay session. Connected sockets read
  ;; WSAECONNRESET; connects in flight fail with WSAETIMEDOUT, the answer a
  ;; SYN into a dead link would eventually get.
  (func $vsock_peer_gone (param $ip i32)
    (local $i i32) (local $rec i32) (local $state i32)
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $VSOCK_MAX)))
      (local.set $rec (call $vsock_rec (local.get $i)))
      (local.set $state (load.field VSock state (local.get $rec)))
      (if (i32.and
            (i32.eq (load.field VSock peer (local.get $rec)) (i32.const -2))
            (i32.or (i32.eq (local.get $state) (i32.const 4))
                    (i32.eq (local.get $state) (i32.const 6))))
        (then
          (if (i32.or (i32.eq (local.get $ip) (i32.const -1))
                      (i32.eq (load.field VSock remote_ip (local.get $rec)) (local.get $ip)))
            (then
              (call $vsock_abort (local.get $i)
                (select (i32.const 10060) (i32.const 10054)
                  (i32.eq (local.get $state) (i32.const 6))))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (call $dpn_peer_gone (local.get $ip)))

  ;; Start a connecting record's clock (see $VSOCK_CONNECT_TIMEOUT_MS).
  (func $vsock_arm_connect_deadline (param $rec i32)
    (local $due i32)
    ;; Wall time, not the guest clock: the wait is on another machine (or
    ;; process) answering, and test/run.js's guest clock is 200 ms a batch --
    ;; a client idling in its message loop burned the 20 s in milliseconds,
    ;; gave up, and reset the server's freshly accepted socket (TetriNET's
    ;; and Liquid War's servers then read WSAECONNRESET and dropped it).
    (local.set $due (i32.add (call $host_real_time_ms) (global.get $VSOCK_CONNECT_TIMEOUT_MS)))
    (store.field VSock backlog (local.get $rec) (local.get $due))
    (if (i32.or (i32.eqz (global.get $vsock_connect_next))
                (i32.lt_s (i32.sub (local.get $due) (global.get $vsock_connect_next)) (i32.const 0)))
      (then (global.set $vsock_connect_next
        ;; 0 means "none in flight", so a deadline that lands on 0 moves by 1.
        (select (local.get $due) (i32.const 1) (local.get $due))))))

  ;; Fail every connect whose deadline has passed. Cheap when nothing is in
  ;; flight: $vsock_connect_next is 0 then, and nothing is scanned.
  (func $vsock_expire_connects
    (local $now i32) (local $i i32) (local $rec i32) (local $due i32) (local $next i32)
    (if (i32.eqz (global.get $vsock_connect_next)) (then (return)))
    (local.set $now (call $host_real_time_ms))
    ;; Signed difference so a tick counter that wraps still expires.
    (if (i32.lt_s (i32.sub (local.get $now) (global.get $vsock_connect_next)) (i32.const 0))
      (then (return)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $VSOCK_MAX)))
      (local.set $rec (call $vsock_rec (local.get $i)))
      (if (i32.and
            (i32.eq (load.field VSock state (local.get $rec)) (i32.const 6))
            (i32.eq (load.field VSock peer (local.get $rec)) (i32.const -2)))
        (then
          (local.set $due (load.field VSock backlog (local.get $rec)))
          (if (i32.ge_s (i32.sub (local.get $now) (local.get $due)) (i32.const 0))
            (then
              ;; Tell the far end too, in case it answers late: a SYNACK for
              ;; a socket we gave up on would otherwise open a connection
              ;; there that nobody here will ever use.
              (drop (call $vsock_emit_from (local.get $i) (i32.const 5) (i32.const 0) (i32.const 0)))
              (call $vsock_abort (local.get $i) (i32.const 10060)))
            (else
              (if (i32.or (i32.eqz (local.get $next))
                          (i32.lt_s (i32.sub (local.get $due) (local.get $next)) (i32.const 0)))
                (then (local.set $next (local.get $due))))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (global.set $vsock_connect_next (local.get $next)))

  ;; Apply one inbound frame. Returns 1 when the frame has been consumed and
  ;; 0 when it must stay queued because the destination ring is full — a
  ;; byte stream may reorder nothing and lose nothing.
  (func $vsock_deliver (param $type i32) (param $sip i32) (param $sport i32)
                       (param $dip i32) (param $dport i32) (param $plen i32) (result i32)
    (local $idx i32) (local $rec i32) (local $fl i32)
    ;; GONE comes from this process's own host, never from the segment, so it
    ;; carries no destination to check.
    (if (i32.eq (local.get $type) (i32.const 7))
      (then (call $vsock_peer_gone (local.get $sip)) (return (i32.const 1))))
    ;; Not ours: the wire is a broadcast segment, so silently ignore. Limited
    ;; broadcast is meaningful only for datagrams and is accepted below.
    (if (i32.and
          (i32.ne (local.get $type) (i32.const 6))
          (i32.eqz (call $vsock_is_local_addr (local.get $dip))))
      (then (return (i32.const 1))))
    (if (i32.eq (local.get $type) (i32.const 6))
      (then
        (if (i32.and
              (i32.ne (local.get $dip) (i32.const -1))
              (i32.eqz (call $vsock_is_local_addr (local.get $dip))))
          (then (return (i32.const 1))))
        (local.set $idx (call $vsock_find_udp (local.get $dip) (local.get $dport)))
        ;; UDP silently discards a datagram for an unopened port...
        (if (i32.lt_s (local.get $idx) (i32.const 0))
          (then (return (i32.const 1))))
        ;; ...and for a socket whose receive queue is full, which is what a
        ;; real stack does. A datagram is therefore always consumed here and
        ;; never holds up the frames behind it on the wire, whether or not
        ;; anybody ever reads this socket (every Quake II client binds the
        ;; server port and reads it only when it hosts).
        (if (i32.eqz (call $vsock_alloc_ring (local.get $idx)))
          (then (return (i32.const 1))))
        (if (i32.or
              (i32.ge_u (call $vsock_dgram_count (local.get $idx))
                        (global.get $VSOCK_DGRAM_MAX))
              (i32.lt_u (call $vsock_rx_space (local.get $idx))
                        (i32.add (local.get $plen) (global.get $VSOCK_DGRAM_HDR))))
          (then (return (i32.const 1))))
        (call $vsock_ring_put32 (local.get $idx) (local.get $plen))
        (call $vsock_ring_put32 (local.get $idx) (local.get $sip))
        (call $vsock_ring_put32 (local.get $idx) (local.get $sport))
        (call $vsock_ring_write (local.get $idx)
          (i32.add (global.get $vsock_frame_buf) (global.get $VLN_HDR))
          (local.get $plen))
        (call $vsock_async_post (local.get $idx) (i32.const 0x01) (i32.const 0))
        (return (i32.const 1))))
    (if (i32.eq (local.get $type) (i32.const 1))
      (then (return (call $vsock_deliver_syn (local.get $sip) (local.get $sport)
                      (local.get $dip) (local.get $dport)))))
    (if (i32.eq (local.get $type) (i32.const 2))
      (then
        (local.set $idx (call $vsock_find_conn (i32.const 6) (local.get $dport)
                          (local.get $sip) (local.get $sport)))
        (if (i32.ge_s (local.get $idx) (i32.const 0))
          (then
            (store.field VSock state (call $vsock_rec (local.get $idx)) (i32.const 4))
            (store.field VSock backlog (call $vsock_rec (local.get $idx)) (i32.const 0))
            ;; The connection completed. Winsock reports FD_WRITE alongside
            ;; FD_CONNECT, because a freshly connected socket is writable and
            ;; that first edge is the only one an app will ever get.
            (call $vsock_async_post (local.get $idx) (i32.const 0x10) (i32.const 0))
            (call $vsock_async_post (local.get $idx) (i32.const 0x02) (i32.const 0))))
        (return (i32.const 1))))
    ;; WINDOW returns send credit. One for a connection that is already gone
    ;; is stale news, not a stray segment, so it is never answered.
    (if (i32.eq (local.get $type) (i32.const 8))
      (then
        (local.set $idx (call $vsock_find_conn (i32.const 4) (local.get $dport)
                          (local.get $sip) (local.get $sport)))
        (if (i32.and (i32.ge_s (local.get $idx) (i32.const 0))
                     (i32.eq (local.get $plen) (i32.const 4)))
          (then
            (local.set $rec (call $vsock_rec (local.get $idx)))
            (local.set $fl (load.field VSock tx_inflight (local.get $rec)))
            (store.field VSock tx_inflight (local.get $rec)
              (select (i32.const 0)
                (i32.sub (local.get $fl)
                  (i32.load (i32.add (call $vsock_frame_wa) (global.get $VLN_HDR))))
                (i32.lt_s
                  (i32.sub (local.get $fl)
                    (i32.load (i32.add (call $vsock_frame_wa) (global.get $VLN_HDR))))
                  (i32.const 0))))
            ;; A closed window is where a nonblocking send failed with
            ;; WSAEWOULDBLOCK, and FD_WRITE is the edge that answers it.
            (if (i32.ge_s (local.get $fl) (global.get $VSOCK_WINDOW))
              (then (call $vsock_async_post (local.get $idx) (i32.const 0x02) (i32.const 0))))))
        (return (i32.const 1))))
    ;; DATA/FIN/RST target an established connection. A refusal can also
    ;; arrive while the local half is still in the connecting state, which
    ;; is how `connect` learns it was rejected.
    (local.set $idx (call $vsock_find_conn (i32.const 4) (local.get $dport)
                      (local.get $sip) (local.get $sport)))
    (if (i32.lt_s (local.get $idx) (i32.const 0))
      (then (local.set $idx (call $vsock_find_conn (i32.const 6) (local.get $dport)
                              (local.get $sip) (local.get $sport)))))
    (if (i32.lt_s (local.get $idx) (i32.const 0))
      (then
        ;; Unknown connection. A stray reset is already the terminal state;
        ;; anything else is addressed to a socket that no longer exists, and
        ;; TCP answers that with a reset rather than silence.
        (if (i32.ne (local.get $type) (i32.const 5))
          (then
            (drop (call $vsock_emit (i32.const 5) (local.get $dip) (local.get $dport)
                    (local.get $sip) (local.get $sport) (i32.const 0) (i32.const 0)))))
        (return (i32.const 1))))
    (local.set $rec (call $vsock_rec (local.get $idx)))
    (if (i32.eq (local.get $type) (i32.const 3))
      (then
        (if (i32.lt_u (call $vsock_rx_space (local.get $idx)) (local.get $plen))
          (then (return (i32.const 0))))
        (call $vsock_ring_write (local.get $idx)
          (i32.add (global.get $vsock_frame_buf) (global.get $VLN_HDR))
          (local.get $plen))
        ;; The frame is off the wire: its overhead goes back now, its bytes
        ;; once the guest reads them.
        (call $vsock_owe_credit (local.get $idx)
          (i32.sub (call $vsock_frame_charge (local.get $plen)) (local.get $plen))
          (i32.const 0))
        (call $vsock_async_post (local.get $idx) (i32.const 0x01) (i32.const 0))
        (return (i32.const 1))))
    (if (i32.eq (local.get $type) (i32.const 4))
      (then
        (store.field VSock flags (local.get $rec) (i32.or (load.field VSock flags (local.get $rec)) (i32.const 1)))
        (call $vsock_async_post (local.get $idx) (i32.const 0x20) (i32.const 0))
        (return (i32.const 1))))
    (if (i32.eq (local.get $type) (i32.const 5))
      (then
        (call $vsock_abort (local.get $idx)
          (select (i32.const 10061) (i32.const 10054)
            (i32.eq (load.field VSock state (local.get $rec)) (i32.const 6))))
        (return (i32.const 1))))
    (i32.const 1))

  ;; Drain the wire into this process's sockets. Safe to call on every
  ;; socket entry point: an empty wire costs one host call.
  (func $vsock_pump
    (if (i32.and (i32.eqz (global.get $wsa_started))
          (i32.and (i32.eqz (global.get $win16_dde_users))
                   (i32.eqz (call $dpn_pumps_here))))
      (then (return)))
    (call $vsock_pump_now))

  ;; The pump without the "does this process use the wire at all" gate. An
  ;; anonymous pipe whose other end is in another process (09d7-pipes.wat)
  ;; calls this directly: a redirected console child such as GNUChess never
  ;; calls WSAStartup, and gating its stdin on Winsock left every byte its
  ;; parent wrote sitting in the wire inbox while ReadFile waited.
  (func $vsock_pump_now
    (local $wa i32) (local $n i32) (local $guard i32)
    (call $vsock_expire_connects)
    (local.set $wa (call $vsock_frame_wa))
    (if (i32.eqz (local.get $wa)) (then (return)))
    (local.set $guard (i32.const 0))
    (block $done (loop $next
      (br_if $done (i32.ge_u (local.get $guard) (i32.const 256)))
      (local.set $guard (i32.add (local.get $guard) (i32.const 1)))
      (local.set $n (call $host_net_frame_peek (local.get $wa)
        (i32.add (global.get $VLN_HDR) (global.get $VLN_MAX_PAYLOAD))))
      (br_if $done (i32.eqz (local.get $n)))
      ;; This is the room's only reader, so a frame under someone else's magic
      ;; has to be handed over rather than dropped — DDEML shares the wire, and
      ;; discarding what we did not recognise silently ate every conversation.
      ;; Leaving it on the queue instead is not an option either: nothing else
      ;; drains, so the socket stream would stall behind it.
      (if (i32.and
            (i32.ge_u (local.get $n) (global.get $DDE_HDR))
            (i32.eq (i32.load (local.get $wa)) (global.get $DDE_MAGIC)))
        (then
          (call $win16_dde_deliver (local.get $wa) (local.get $n))
          (call $host_net_frame_commit)
          (br $next)))
      ;; DirectPlay sessions (09d4-dplay-net.wat) share the wire the same way.
      (if (i32.and
            (i32.ge_u (local.get $n) (global.get $DPL_HDR))
            (i32.eq (i32.load (local.get $wa)) (global.get $DPL_MAGIC)))
        (then
          (call $dpn_deliver (local.get $n))
          (call $host_net_frame_commit)
          (br $next)))
      ;; Fail closed on anything that is not a well-formed vln/1 frame:
      ;; too short, too long for the buffer, or wrong magic.
      (if (i32.or
            (i32.lt_s (local.get $n) (i32.const 0))
            (i32.or
              (i32.lt_u (local.get $n) (global.get $VLN_HDR))
              (i32.ne (i32.load (local.get $wa)) (global.get $VLN_MAGIC))))
        (then (call $host_net_frame_commit) (br $next)))
      (if (i32.ne (i32.load (i32.add (local.get $wa) (i32.const 24)))
                  (i32.sub (local.get $n) (global.get $VLN_HDR)))
        (then (call $host_net_frame_commit) (br $next)))
      (if (i32.eqz (call $vsock_deliver
            (i32.load (i32.add (local.get $wa) (i32.const 4)))
            (i32.load (i32.add (local.get $wa) (i32.const 8)))
            (i32.load (i32.add (local.get $wa) (i32.const 12)))
            (i32.load (i32.add (local.get $wa) (i32.const 16)))
            (i32.load (i32.add (local.get $wa) (i32.const 20)))
            (i32.load (i32.add (local.get $wa) (i32.const 24)))))
        ;; Undeliverable for now — leave it at the head of the wire so the
        ;; stream keeps its order once the reader drains its ring.
        (then (br $done)))
      (call $host_net_frame_commit)
      (br $next)))
    (call $vsock_flush_credit))

  ;; Park the current API call. The handler has already dropped its stdcall
  ;; frame, so put those bytes back: EIP still points at the thunk, and the
  ;; host re-enters this same handler with the same arguments once the wire
  ;; has moved.
  ;;
  ;; $handler_set_eip is what keeps that true. $run's thunk-zone auto-pop fires
  ;; whenever a handler leaves EIP alone — yield or no yield — and sets
  ;; EIP = [ESP], splicing the call out: the guest resumes past its own connect
  ;; or recv with the arguments still on the stack, having never made the call,
  ;; and drifts by $unpop bytes every park. Every re-entering thunk raises this;
  ;; see the CACA000x continuations and $cs_block, where the same omission cost a
  ;; session before it was found.
  (func $vsock_block (param $unpop i32)
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (local.get $unpop)))
    (global.set $handler_set_eip (i32.const 1))
    ;; And re-enter the CALL rather than the block that made it: an API call
    ;; dispatched inline from inside a decoded block leaves EIP naming that
    ;; block's first instruction, so a park that does not set EIP resumes by
    ;; re-executing the argument pushes. See the same line in $cs_block, where
    ;; that cost 8 bytes of stack per park and a wild jump much later.
    (global.set $eip (global.get $current_thunk_eip))
    (global.set $yield_reason (i32.const 8))
    (global.set $yield_flag (i32.const 1))
    (global.set $steps (i32.const 0)))

  ;; ---- handlers -------------------------------------------------------

  ;; socket(af, type, protocol)
  (func $handle_socket (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                       (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $idx i32) (local $rec i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    (if (i32.eq (local.get $arg0) (i32.const 6))          ;; AF_IPX
      (then
        ;; IPX datagrams only (see $vsock_read_sockaddr_ipx). The protocol is
        ;; NSPROTO_IPX plus the packet type to send, 1000..1255; SPX
        ;; (NSPROTO_SPX 1256, SOCK_SEQPACKET) is a stream this switch does
        ;; not carry.
        (if (i32.ne (local.get $arg1) (i32.const 2))
          (then
            (call $vsock_set_error (i32.const 10044))      ;; WSAESOCKTNOSUPPORT
            (i32.store offset=0 (global.get $reg_base) (i32.const -1))
            (return)))
        (if (i32.gt_u (i32.sub (local.get $arg2) (i32.const 1000)) (i32.const 255))
          (then
            (call $vsock_set_error (i32.const 10043))      ;; WSAEPROTONOSUPPORT
            (i32.store offset=0 (global.get $reg_base) (i32.const -1))
            (return))))
      (else
        (if (i32.ne (local.get $arg0) (i32.const 2))      ;; AF_INET
          (then
            (call $vsock_set_error (i32.const 10047))      ;; WSAEAFNOSUPPORT
            (i32.store offset=0 (global.get $reg_base) (i32.const -1))
            (return)))
        (if (i32.and (i32.ne (local.get $arg1) (i32.const 1))
                     (i32.ne (local.get $arg1) (i32.const 2)))
          (then
            (call $vsock_set_error (i32.const 10044))      ;; WSAESOCKTNOSUPPORT
            (i32.store offset=0 (global.get $reg_base) (i32.const -1))
            (return)))
        (if (i32.and
              (i32.ne (local.get $arg2) (i32.const 0))
              (i32.ne (local.get $arg2)
                (if (result i32) (i32.eq (local.get $arg1) (i32.const 2))
                  (then (i32.const 17))                   ;; IPPROTO_UDP
                  (else (i32.const 6)))))                 ;; IPPROTO_TCP
          (then
            (call $vsock_set_error (i32.const 10043))      ;; WSAEPROTONOSUPPORT
            (i32.store offset=0 (global.get $reg_base) (i32.const -1))
            (return)))))
    ;; A socket is the first moment a Winsock game needs the room, the way
    ;; DPOPEN is for a DirectPlay one, so a host that asks the person which
    ;; room gets to ask here. Quake II is the case: WSAStartup runs at boot for
    ;; every launch, but socket() only once a player picks multiplayer, so this
    ;; keeps the lobby out of every solo game. Checked after the argument
    ;; tests, so a refused IPX probe asks nothing. Every host without a lobby
    ;; answers 1 at once.
    (if (i32.eqz (call $host_net_link_open (i32.const 1)))
      (then (call $vsock_block (i32.const 16)) (return)))
    (local.set $idx (call $vsock_alloc))
    (if (i32.lt_s (local.get $idx) (i32.const 0))
      (then
        (call $vsock_set_error (i32.const 10024))          ;; WSAEMFILE
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    (local.set $rec (call $vsock_rec (local.get $idx)))
    (store.field VSock state (local.get $rec) (i32.const 1))
    (store.field VSock family (local.get $rec) (local.get $arg0))
    (store.field VSock type (local.get $rec) (local.get $arg1))
    (store.field VSock proto (local.get $rec) (local.get $arg2))
    (i32.store offset=0 (global.get $reg_base) (call $vsock_handle (local.get $idx))))

  ;; bind(s, name, namelen)
  (func $handle_bind (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                     (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $idx i32) (local $rec i32) (local $ip i32) (local $port i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    (local.set $idx (call $vsock_index (local.get $arg0)))
    (if (i32.lt_s (local.get $idx) (i32.const 0))
      (then
        (call $vsock_set_error (i32.const 10038))          ;; WSAENOTSOCK
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    (local.set $rec (call $vsock_rec (local.get $idx)))
    (if (i32.ne (load.field VSock state (local.get $rec)) (i32.const 1))
      (then
        (call $vsock_set_error (i32.const 10022))          ;; WSAEINVAL
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    (if (i32.eqz (call $vsock_read_sockaddr (local.get $arg1) (local.get $arg2)
          (load.field VSock family (local.get $rec))))
      (then
        (call $vsock_set_error (i32.const 10047))          ;; WSAEAFNOSUPPORT
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    (local.set $ip (global.get $vsock_sa_ip))
    (local.set $port (global.get $vsock_sa_port))
    ;; INADDR_ANY binds the room address; anything else must be in-room.
    (if (i32.and (i32.ne (local.get $ip) (i32.const 0))
                 (i32.eqz (call $vsock_addr_in_room (local.get $ip))))
      (then
        (call $vsock_set_error (i32.const 10049))          ;; WSAEADDRNOTAVAIL
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    ;; Resolve INADDR_ANY now, not at send time. A process owns exactly one
    ;; room address, so "any" is that address — and every later step compares
    ;; against a concrete one: the port-in-use check, the destination match in
    ;; $vsock_deliver, and the source address of every frame this socket
    ;; emits. Leaving the 0 in place makes a listener unreachable and makes a
    ;; connector send from 0.0.0.0, which no peer can answer.
    (if (i32.eqz (local.get $ip))
      (then (local.set $ip (global.get $vsock_local_ip))))
    (if (i32.eqz (local.get $port))
      (then (local.set $port (call $vsock_alloc_port)))
      (else
        (if (call $vsock_port_taken (local.get $ip) (local.get $port)
              (load.field VSock type (local.get $rec)))
          (then
            (call $vsock_set_error (i32.const 10048))      ;; WSAEADDRINUSE
            (i32.store offset=0 (global.get $reg_base) (i32.const -1))
            (return)))))
    (store.field VSock local_ip (local.get $rec) (local.get $ip))
    (store.field VSock local_port (local.get $rec) (local.get $port))
    (store.field VSock state (local.get $rec) (i32.const 2))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  ;; listen(s, backlog)
  (func $handle_listen (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                       (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $idx i32) (local $rec i32) (local $bl i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
    (local.set $idx (call $vsock_index (local.get $arg0)))
    (if (i32.lt_s (local.get $idx) (i32.const 0))
      (then
        (call $vsock_set_error (i32.const 10038))
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    (local.set $rec (call $vsock_rec (local.get $idx)))
    ;; A listener must already own an address.
    (if (i32.ne (load.field VSock state (local.get $rec)) (i32.const 2))
      (then
        (call $vsock_set_error (i32.const 10022))
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    (local.set $bl (local.get $arg1))
    (if (i32.lt_s (local.get $bl) (i32.const 1)) (then (local.set $bl (i32.const 1))))
    ;; Win98's own stack caps it at 5 (SOMAXCONN); 13 is the queue's size.
    (if (i32.gt_s (local.get $bl) (i32.const 13)) (then (local.set $bl (i32.const 13))))
    (store.field VSock backlog (local.get $rec) (local.get $bl))
    (store.field VSock state (local.get $rec) (i32.const 3))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  ;; connect(s, name, namelen)
  (func $handle_connect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                        (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $idx i32) (local $rec i32) (local $ip i32) (local $port i32)
    (local $lis i32) (local $lrec i32) (local $child i32) (local $crec i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    (local.set $idx (call $vsock_index (local.get $arg0)))
    (if (i32.lt_s (local.get $idx) (i32.const 0))
      (then
        (call $vsock_set_error (i32.const 10038))
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    (local.set $rec (call $vsock_rec (local.get $idx)))
    (call $vsock_pump)
    ;; Re-entry: a SYN is already outstanding for this socket, either
    ;; because a blocking connect parked here or because a nonblocking one
    ;; is being polled.
    (if (i32.and (load.field VSock flags (local.get $rec)) (i32.const 8))
      (then
        (if (i32.eq (load.field VSock state (local.get $rec)) (i32.const 4))
          (then
            (store.field VSock flags (local.get $rec) (i32.and (load.field VSock flags (local.get $rec)) (i32.const -9)))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (return)))
        (if (i32.and (load.field VSock flags (local.get $rec)) (i32.const 4))
          (then
            ;; Refused, or nobody answered. Put the socket back where it was
            ;; so the guest can bind or connect it again.
            (call $vsock_set_error
              (select (i32.const 10060) (i32.const 10061)       ;; WSAETIMEDOUT / WSAECONNREFUSED
                (i32.ne (i32.and (load.field VSock flags (local.get $rec)) (i32.const 0x10))
                        (i32.const 0))))
            (store.field VSock flags (local.get $rec) (i32.const 0))
            (store.field VSock backlog (local.get $rec) (i32.const 0))
            (store.field VSock peer (local.get $rec) (i32.const -1))
            (store.field VSock remote_ip (local.get $rec) (i32.const 0))
            (store.field VSock remote_port (local.get $rec) (i32.const 0))
            (store.field VSock state (local.get $rec) (i32.const 2))
            (i32.store offset=0 (global.get $reg_base) (i32.const -1))
            (return)))
        (if (load.field VSock mode (local.get $rec))
          (then
            (call $vsock_set_error (i32.const 10037))      ;; WSAEALREADY
            (i32.store offset=0 (global.get $reg_base) (i32.const -1))
            (return)))
        (call $vsock_block (i32.const 16))
        (return)))
    (if (i32.eq (load.field VSock state (local.get $rec)) (i32.const 4))
      (then
        (call $vsock_set_error (i32.const 10056))          ;; WSAEISCONN
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    (if (i32.gt_u (load.field VSock state (local.get $rec)) (i32.const 2))
      (then
        (call $vsock_set_error (i32.const 10022))
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    (if (i32.eqz (call $vsock_read_sockaddr (local.get $arg1) (local.get $arg2)
          (load.field VSock family (local.get $rec))))
      (then
        (call $vsock_set_error (i32.const 10047))
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    (local.set $ip (global.get $vsock_sa_ip))
    (local.set $port (global.get $vsock_sa_port))
    ;; Isolation boundary: only room addresses are routable.
    (if (i32.eqz (call $vsock_addr_in_room (local.get $ip)))
      (then
        (call $vsock_set_error (i32.const 10051))          ;; WSAENETUNREACH
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    ;; An unbound connector picks up an ephemeral room address before the
    ;; route is chosen, because either path needs a source endpoint.
    (if (i32.eq (load.field VSock state (local.get $rec)) (i32.const 1))
      (then
        (store.field VSock local_ip (local.get $rec) (global.get $vsock_local_ip))
        (store.field VSock local_port (local.get $rec) (call $vsock_alloc_port))))
    ;; A destination this process does not answer for goes out on the wire.
    (if (i32.eqz (call $vsock_is_local_addr (local.get $ip)))
      (then
        (store.field VSock remote_ip (local.get $rec) (local.get $ip))
        (store.field VSock remote_port (local.get $rec) (local.get $port))
        (store.field VSock peer (local.get $rec) (i32.const -2))
        (if (i32.eqz (call $vsock_alloc_ring (local.get $idx)))
          (then
            (store.field VSock remote_ip (local.get $rec) (i32.const 0))
            (store.field VSock remote_port (local.get $rec) (i32.const 0))
            (store.field VSock peer (local.get $rec) (i32.const -1))
            (call $vsock_set_error (i32.const 10055))      ;; WSAENOBUFS
            (i32.store offset=0 (global.get $reg_base) (i32.const -1))
            (return)))
        (if (i32.eqz (call $vsock_emit_from (local.get $idx) (i32.const 1)
                       (i32.const 0) (i32.const 0)))
          (then
            ;; The wire could not take the SYN. Roll the socket back so the
            ;; retry emits a fresh one rather than waiting on a lost frame.
            (store.field VSock remote_ip (local.get $rec) (i32.const 0))
            (store.field VSock remote_port (local.get $rec) (i32.const 0))
            (store.field VSock peer (local.get $rec) (i32.const -1))
            (if (load.field VSock mode (local.get $rec))
              (then
                (call $vsock_set_error (i32.const 10035))  ;; WSAEWOULDBLOCK
                (i32.store offset=0 (global.get $reg_base) (i32.const -1))
                (return)))
            (call $vsock_block (i32.const 16))
            (return)))
        (store.field VSock state (local.get $rec) (i32.const 6))
        (store.field VSock flags (local.get $rec) (i32.or (load.field VSock flags (local.get $rec)) (i32.const 8)))
        (call $vsock_arm_connect_deadline (local.get $rec))
        (if (load.field VSock mode (local.get $rec))
          (then
            (call $vsock_set_error (i32.const 10035))      ;; WSAEWOULDBLOCK
            (i32.store offset=0 (global.get $reg_base) (i32.const -1))
            (return)))
        (call $vsock_block (i32.const 16))
        (return)))
    (local.set $lis (call $vsock_find_listener (local.get $ip) (local.get $port)))
    (if (i32.lt_s (local.get $lis) (i32.const 0))
      (then
        (call $vsock_set_error (i32.const 10061))          ;; WSAECONNREFUSED
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    (local.set $lrec (call $vsock_rec (local.get $lis)))
    (if (i32.ge_u (load.field VSock acc_count (local.get $lrec))
                  (load.field VSock backlog (local.get $lrec)))
      (then
        (call $vsock_set_error (i32.const 10061))          ;; backlog full
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    (local.set $child (call $vsock_alloc))
    (if (i32.lt_s (local.get $child) (i32.const 0))
      (then
        (call $vsock_set_error (i32.const 10024))
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    (local.set $crec (call $vsock_rec (local.get $child)))
    ;; Server half: inherits the listener's address, points back at the
    ;; connector.
    (store.field VSock state (local.get $crec) (i32.const 4))
    (store.field VSock family (local.get $crec) (i32.const 2))
    (store.field VSock type (local.get $crec) (i32.const 1))
    (store.field VSock local_ip (local.get $crec) (local.get $ip))
    (store.field VSock local_port (local.get $crec) (local.get $port))
    (store.field VSock remote_ip (local.get $crec) (load.field VSock local_ip (local.get $rec)))
    (store.field VSock remote_port (local.get $crec) (load.field VSock local_port (local.get $rec)))
    (store.field VSock peer (local.get $crec) (local.get $idx))
    ;; Client half.
    (store.field VSock remote_ip (local.get $rec) (local.get $ip))
    (store.field VSock remote_port (local.get $rec) (local.get $port))
    (store.field VSock peer (local.get $rec) (local.get $child))
    (store.field VSock state (local.get $rec) (i32.const 4))
    (if (i32.eqz (i32.and (call $vsock_alloc_ring (local.get $idx))
                          (call $vsock_alloc_ring (local.get $child))))
      (then
        (call $vsock_destroy (local.get $child) (i32.const 0))
        (store.field VSock peer (local.get $rec) (i32.const -1))
        (store.field VSock state (local.get $rec) (i32.const 2))
        (call $vsock_set_error (i32.const 10055))          ;; WSAENOBUFS
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    ;; OPEN_OK: the connection is in the backlog, not yet accepted.
    (store.field-elem VSock acc_queue (local.get $lrec)
      (load.field VSock acc_count (local.get $lrec)) (local.get $child))
    (store.field VSock acc_count (local.get $lrec) (i32.add (load.field VSock acc_count (local.get $lrec)) (i32.const 1)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  ;; accept(s, addr, addrlen)
  (func $handle_accept (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                       (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $idx i32) (local $rec i32) (local $child i32) (local $crec i32)
    (local $arec i32) (local $carec i32)
    (local $i i32) (local $n i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    (local.set $idx (call $vsock_index (local.get $arg0)))
    (if (i32.lt_s (local.get $idx) (i32.const 0))
      (then
        (call $vsock_set_error (i32.const 10038))
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    (local.set $rec (call $vsock_rec (local.get $idx)))
    (if (i32.ne (load.field VSock state (local.get $rec)) (i32.const 3))
      (then
        (call $vsock_set_error (i32.const 10022))
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    (call $vsock_pump)
    (local.set $n (load.field VSock acc_count (local.get $rec)))
    (if (i32.eqz (local.get $n))
      (then
        ;; A blocking accept parks until the wire delivers a SYN.
        (if (i32.eqz (load.field VSock mode (local.get $rec)))
          (then (call $vsock_block (i32.const 16)) (return)))
        (call $vsock_set_error (i32.const 10035))          ;; WSAEWOULDBLOCK
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    (local.set $child (load.field-elem VSock acc_queue (local.get $rec) (i32.const 0)))
    ;; Shift the remaining backlog down one slot.
    (local.set $i (i32.const 1))
    (block $sd (loop $sh
      (br_if $sd (i32.ge_u (local.get $i) (local.get $n)))
      (store.field-elem VSock acc_queue (local.get $rec)
        (i32.sub (local.get $i) (i32.const 1))
        (load.field-elem VSock acc_queue (local.get $rec) (local.get $i)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $sh)))
    (store.field VSock acc_count (local.get $rec) (i32.sub (local.get $n) (i32.const 1)))
    ;; A socket from accept inherits the listener's WSAAsyncSelect registration
    ;; -- window, message and event mask alike. Without that the server is told
    ;; about the connection and then never hears another thing from it: the
    ;; peer's first packet lands in the ring, no FD_READ is posted for it, and
    ;; an accepted session goes silent instead of failing.
    (local.set $arec (call $vsock_async_rec (local.get $idx)))
    (local.set $carec (call $vsock_async_rec (local.get $child)))
    (if (i32.and
          (i32.ne (local.get $arec) (i32.const 0))
          (i32.ne (local.get $carec) (i32.const 0)))
      (then
        (local.set $arec (call $g2w (local.get $arec)))
        (local.set $carec (call $g2w (local.get $carec)))
        (i32.store (local.get $carec) (i32.load (local.get $arec)))
        (i32.store offset=4 (local.get $carec) (i32.load offset=4 (local.get $arec)))
        (i32.store offset=8 (local.get $carec) (i32.load offset=8 (local.get $arec)))))
    (local.set $crec (call $vsock_rec (local.get $child)))
    (call $vsock_write_sockaddr (local.get $arg1) (local.get $arg2)
      (load.field VSock remote_ip (local.get $crec))
      (load.field VSock remote_port (local.get $crec)))
    ;; Anything the peer sent between the SYN and this accept is already in the
    ;; ring, and its FD_READ went to a socket that did not exist yet. Report the
    ;; edge now, or that first packet waits for a second one to announce it.
    (if (call $vsock_read_ready (local.get $child))
      (then (call $vsock_async_post (local.get $child) (i32.const 0x01) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (call $vsock_handle (local.get $child))))

  ;; getpeername(s, name, namelen) — the address of the far end.
  ;;
  ;; A server learns who connected from the socket accept handed it, not from
  ;; accept's own out-parameter, which plenty of code passes as NULL. TetriNET
  ;; asks here for the address it shows in its player list, so an unimplemented
  ;; stub took down the whole session one call after a successful accept.
  (func $handle_getpeername (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                            (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $idx i32) (local $rec i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    (local.set $idx (call $vsock_index (local.get $arg0)))
    (if (i32.lt_s (local.get $idx) (i32.const 0))
      (then
        (call $vsock_set_error (i32.const 10038))          ;; WSAENOTSOCK
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    (local.set $rec (call $vsock_rec (local.get $idx)))
    ;; Only an established connection has a peer. A listener or a half-open
    ;; connect reports WSAENOTCONN rather than inventing an address.
    (if (i32.ne (load.field VSock state (local.get $rec)) (i32.const 4))
      (then
        (call $vsock_set_error (i32.const 10057))          ;; WSAENOTCONN
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    (call $vsock_write_sockaddr (local.get $arg1) (local.get $arg2)
      (load.field VSock remote_ip (local.get $rec))
      (load.field VSock remote_port (local.get $rec)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  ;; getsockname(s, name, namelen) — the socket's bound room address.
  (func $handle_getsockname (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                            (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $idx i32) (local $rec i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    (local.set $idx (call $vsock_index (local.get $arg0)))
    (if (i32.lt_s (local.get $idx) (i32.const 0))
      (then
        (call $vsock_set_error (i32.const 10038))          ;; WSAENOTSOCK
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    (local.set $rec (call $vsock_rec (local.get $idx)))
    (call $vsock_write_sockaddr_for (local.get $rec) (local.get $arg1) (local.get $arg2)
      (load.field VSock local_ip (local.get $rec))
      (load.field VSock local_port (local.get $rec)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  ;; send(s, buf, len, flags) — a partial count is a legal TCP result.
  (func $handle_send (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                     (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $idx i32) (local $rec i32) (local $peer i32) (local $space i32) (local $n i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
    (local.set $idx (call $vsock_index (local.get $arg0)))
    (if (i32.lt_s (local.get $idx) (i32.const 0))
      (then
        (call $vsock_set_error (i32.const 10038))
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    (local.set $rec (call $vsock_rec (local.get $idx)))
    (call $vsock_pump)
    (if (i32.ne (load.field VSock state (local.get $rec)) (i32.const 4))
      (then
        (call $vsock_set_error (i32.const 10057))          ;; WSAENOTCONN
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    (if (i32.and (load.field VSock flags (local.get $rec)) (i32.const 2))
      (then
        (call $vsock_set_error (i32.const 10058))          ;; WSAESHUTDOWN
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    (local.set $peer (load.field VSock peer (local.get $rec)))
    ;; A peer in another process takes bytes as wire frames. One send
    ;; produces at most one frame and never more than the send window has
    ;; room for, so a large write returns a partial count — which a stream
    ;; socket is always allowed to do.
    (if (i32.eq (local.get $peer) (i32.const -2))
      (then
        (if (i32.eqz (local.get $arg2))
          (then (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
        (local.set $n (local.get $arg2))
        (if (i32.gt_u (local.get $n) (global.get $VLN_MAX_PAYLOAD))
          (then (local.set $n (global.get $VLN_MAX_PAYLOAD))))
        (local.set $space (i32.sub (global.get $VSOCK_WINDOW)
          (load.field VSock tx_inflight (local.get $rec))))
        (block $sent
          (if (i32.gt_s (local.get $space) (i32.const 0))
            (then
              (if (i32.gt_u (local.get $n) (local.get $space))
                (then (local.set $n (local.get $space))))
              (br_if $sent (call $vsock_emit_from (local.get $idx) (i32.const 3)
                             (local.get $arg1) (local.get $n)))))
          ;; The window is closed or the wire is full.
          (if (i32.eqz (load.field VSock mode (local.get $rec)))
            (then (call $vsock_block (i32.const 20)) (return)))
          (call $vsock_set_error (i32.const 10035))
          (i32.store offset=0 (global.get $reg_base) (i32.const -1))
          (return))
        (store.field VSock tx_inflight (local.get $rec)
          (i32.add (load.field VSock tx_inflight (local.get $rec))
                   (call $vsock_frame_charge (local.get $n))))
        (i32.store offset=0 (global.get $reg_base) (local.get $n))
        (return)))
    (if (i32.lt_s (local.get $peer) (i32.const 0))
      (then
        (call $vsock_set_error (i32.const 10054))          ;; WSAECONNRESET
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    (if (i32.eqz (local.get $arg2))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (local.set $space (call $vsock_rx_space (local.get $peer)))
    (if (i32.eqz (local.get $space))
      (then
        ;; The peer's ring is full; a blocking send waits for it to drain.
        (if (i32.eqz (load.field VSock mode (local.get $rec)))
          (then (call $vsock_block (i32.const 20)) (return)))
        (call $vsock_set_error (i32.const 10035))
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    (local.set $n (local.get $arg2))
    (if (i32.gt_u (local.get $n) (local.get $space)) (then (local.set $n (local.get $space))))
    (call $vsock_ring_write (local.get $peer) (local.get $arg1) (local.get $n))
    (i32.store offset=0 (global.get $reg_base) (local.get $n)))

  ;; The datagram send behind sendto and WSASendTo. $unpop is the caller's
  ;; stdcall frame (already popped), handed to $vsock_block when a blocking
  ;; socket has to wait. Returns the byte count, -1 with the WSA error set, or
  ;; -2 when the call parked and the caller must leave EAX alone.
  (func $vsock_sendto_core (param $s i32) (param $buf i32) (param $len i32)
      (param $to i32) (param $to_len i32) (param $unpop i32) (result i32)
    (local $idx i32) (local $rec i32) (local $dip i32) (local $dport i32)
    (local.set $idx (call $vsock_index (local.get $s)))
    (if (i32.lt_s (local.get $idx) (i32.const 0))
      (then (call $vsock_set_error (i32.const 10038)) (return (i32.const -1))))
    (local.set $rec (call $vsock_rec (local.get $idx)))
    (if (i32.ne (load.field VSock type (local.get $rec)) (i32.const 2))
      (then (call $vsock_set_error (i32.const 10044)) (return (i32.const -1))))
    (if (i32.eqz (call $vsock_read_sockaddr (local.get $to) (local.get $to_len)
          (load.field VSock family (local.get $rec))))
      (then (call $vsock_set_error (i32.const 10047)) (return (i32.const -1))))
    (local.set $dip (global.get $vsock_sa_ip))
    (local.set $dport (global.get $vsock_sa_port))
    (if (i32.and (i32.ne (local.get $dip) (i32.const -1))
                 (i32.eqz (call $vsock_addr_in_room (local.get $dip))))
      (then (call $vsock_set_error (i32.const 10051)) (return (i32.const -1))))
    (if (i32.gt_u (local.get $len) (global.get $VLN_MAX_PAYLOAD))
      (then (call $vsock_set_error (i32.const 10040)) (return (i32.const -1)))) ;; WSAEMSGSIZE
    ;; Winsock implicitly binds an unbound datagram socket on its first send.
    (if (i32.eq (load.field VSock state (local.get $rec)) (i32.const 1))
      (then
        (store.field VSock local_ip (local.get $rec) (global.get $vsock_local_ip))
        (store.field VSock local_port (local.get $rec) (call $vsock_alloc_port))
        (store.field VSock state (local.get $rec) (i32.const 2))))
    (if (i32.ne (load.field VSock state (local.get $rec)) (i32.const 2))
      (then (call $vsock_set_error (i32.const 10022)) (return (i32.const -1))))
    (if (i32.eqz (call $vsock_emit (i32.const 6)
          (load.field VSock local_ip (local.get $rec))
          (load.field VSock local_port (local.get $rec))
          (local.get $dip) (local.get $dport)
          (local.get $buf) (local.get $len)))
      (then
        (if (i32.eqz (load.field VSock mode (local.get $rec)))
          (then (call $vsock_block (local.get $unpop)) (return (i32.const -2))))
        (call $vsock_set_error (i32.const 10035))
        (return (i32.const -1))))
    (local.get $len))

  ;; A receive call re-enables FD_READ; if data is still queued after it,
  ;; Winsock posts a fresh FD_READ at once.
  (func $vsock_read_reenable (param $idx i32)
    (local $rec i32)
    (local.set $rec (call $vsock_rec (local.get $idx)))
    (store.field VSock flags (local.get $rec)
      (i32.and (load.field VSock flags (local.get $rec)) (i32.const -33))))
  (func $vsock_read_rearm (param $idx i32)
    (if (load.field VSock rx_len (call $vsock_rec (local.get $idx)))
      (then (call $vsock_async_post (local.get $idx) (i32.const 0x01) (i32.const 0)))))

  ;; sendto(s, buf, len, flags, to, tolen) — one UDP datagram is one frame.
  ;; The dispatcher supplies five named arguments; the sixth remains at
  ;; [ESP+24] until this handler performs the six-argument stdcall cleanup.
  (func $handle_sendto (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                       (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $to_len i32) (local $r i32)
    (local.set $to_len (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
    (local.set $r (call $vsock_sendto_core (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg4) (local.get $to_len) (i32.const 28)))
    (if (i32.ne (local.get $r) (i32.const -2))
      (then (i32.store offset=0 (global.get $reg_base) (local.get $r)))))

  ;; The datagram receive behind recvfrom and WSARecvFrom: consume exactly one
  ;; frame. Same return convention as $vsock_sendto_core.
  (func $vsock_recvfrom_core (param $s i32) (param $buf i32) (param $len i32)
      (param $from i32) (param $from_len i32) (param $unpop i32) (result i32)
    (local $idx i32) (local $rec i32) (local $available i32) (local $n i32)
    (local.set $idx (call $vsock_index (local.get $s)))
    (if (i32.lt_s (local.get $idx) (i32.const 0))
      (then (call $vsock_set_error (i32.const 10038)) (return (i32.const -1))))
    (local.set $rec (call $vsock_rec (local.get $idx)))
    (if (i32.ne (load.field VSock type (local.get $rec)) (i32.const 2))
      (then (call $vsock_set_error (i32.const 10044)) (return (i32.const -1))))
    (call $vsock_read_reenable (local.get $idx))
    (call $vsock_pump)
    (if (load.field VSock rx_len (local.get $rec))
      (then
        ;; The head record: [payload length][source ip][source port].
        (local.set $available (call $vsock_ring_get32 (local.get $idx) (i32.const 0)))
        (call $vsock_write_sockaddr_for (local.get $rec) (local.get $from) (local.get $from_len)
          (call $vsock_ring_get32 (local.get $idx) (i32.const 4))
          (call $vsock_ring_get32 (local.get $idx) (i32.const 8)))
        (call $vsock_ring_skip (local.get $idx) (global.get $VSOCK_DGRAM_HDR))
        (local.set $n (local.get $available))
        (if (i32.gt_u (local.get $n) (local.get $len))
          (then (local.set $n (local.get $len))))
        (drop (call $vsock_ring_read (local.get $idx) (local.get $buf) (local.get $n)))
        ;; A short receive discards the rest of this datagram, never exposes it
        ;; as a second packet. Winsock reports WSAEMSGSIZE in that case.
        (if (i32.lt_u (local.get $n) (local.get $available))
          (then
            (call $vsock_ring_skip (local.get $idx)
              (i32.sub (local.get $available) (local.get $n)))
            (call $vsock_set_error (i32.const 10040))
            (call $vsock_read_rearm (local.get $idx))
            (return (i32.const -1))))
        (call $vsock_read_rearm (local.get $idx))
        (return (local.get $n))))
    (if (i32.eqz (load.field VSock mode (local.get $rec)))
      (then (call $vsock_block (local.get $unpop)) (return (i32.const -2))))
    (call $vsock_set_error (i32.const 10035))
    (i32.const -1))

  ;; recvfrom(s, buf, len, flags, from, fromlen) — consume exactly one frame.
  (func $handle_recvfrom (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                         (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $from_len i32) (local $r i32)
    (local.set $from_len (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
    (local.set $r (call $vsock_recvfrom_core (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg4) (local.get $from_len) (i32.const 28)))
    (if (i32.ne (local.get $r) (i32.const -2))
      (then (i32.store offset=0 (global.get $reg_base) (local.get $r)))))

  ;; WSASendTo(s, lpBuffers, dwBufferCount, lpNumberOfBytesSent, dwFlags, lpTo,
  ;; iTolen, lpOverlapped, lpCompletionRoutine) and its receive twin. Pocket
  ;; Tanks imports both by name from WS2_32; with no handler, the call returned
  ;; without its nine-argument stdcall cleanup and the game ran into its own
  ;; stack. The buffers of one call form one datagram (gathered for a send,
  ;; scattered for a receive). Overlapped I/O and completion routines are not
  ;; implemented and fail loudly.
  (func $handle_WSASendTo (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                          (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $sp i32) (local $to i32) (local $to_len i32) (local $buf i32) (local $len i32)
    (local $i i32) (local $part i32) (local $r i32) (local $owned i32)
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (local.set $to (call $gl32 (i32.add (local.get $sp) (i32.const 24))))
    (local.set $to_len (call $gl32 (i32.add (local.get $sp) (i32.const 28))))
    (if (i32.or (i32.ne (call $gl32 (i32.add (local.get $sp) (i32.const 32))) (i32.const 0))
                (i32.ne (call $gl32 (i32.add (local.get $sp) (i32.const 36))) (i32.const 0)))
      (then (call $crash_unimplemented (local.get $name_ptr))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (local.get $sp) (i32.const 40)))
    (if (i32.or (i32.eqz (local.get $arg1)) (i32.eqz (local.get $arg2)))
      (then (call $vsock_set_error (i32.const 10014))  ;; WSAEFAULT
        (i32.store offset=0 (global.get $reg_base) (i32.const -1)) (return)))
    ;; WSABUF is {ULONG len; CHAR FAR *buf}.
    (if (i32.eq (local.get $arg2) (i32.const 1))
      (then
        (local.set $len (call $gl32 (local.get $arg1)))
        (local.set $buf (call $gl32 (i32.add (local.get $arg1) (i32.const 4)))))
      (else
        (local.set $i (i32.const 0))
        (block $sized (loop $size
          (br_if $sized (i32.ge_u (local.get $i) (local.get $arg2)))
          (local.set $len (i32.add (local.get $len)
            (call $gl32 (i32.add (local.get $arg1) (i32.shl (local.get $i) (i32.const 3))))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $size)))
        (if (i32.gt_u (local.get $len) (global.get $VLN_MAX_PAYLOAD))
          (then (call $vsock_set_error (i32.const 10040))
            (i32.store offset=0 (global.get $reg_base) (i32.const -1)) (return)))
        (local.set $buf (call $heap_alloc (i32.add (local.get $len) (i32.const 1))))
        (if (i32.eqz (local.get $buf))
          (then (call $vsock_set_error (i32.const 10055))   ;; WSAENOBUFS
            (i32.store offset=0 (global.get $reg_base) (i32.const -1)) (return)))
        (local.set $owned (i32.const 1))
        (local.set $i (i32.const 0))
        (local.set $part (i32.const 0))
        (block $copied (loop $copy
          (br_if $copied (i32.ge_u (local.get $i) (local.get $arg2)))
          (call $guest_memmove (i32.add (local.get $buf) (local.get $part))
            (call $gl32 (i32.add (i32.add (local.get $arg1) (i32.shl (local.get $i) (i32.const 3))) (i32.const 4)))
            (call $gl32 (i32.add (local.get $arg1) (i32.shl (local.get $i) (i32.const 3)))))
          (local.set $part (i32.add (local.get $part)
            (call $gl32 (i32.add (local.get $arg1) (i32.shl (local.get $i) (i32.const 3))))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $copy)))))
    (local.set $r (call $vsock_sendto_core (local.get $arg0) (local.get $buf) (local.get $len)
      (local.get $to) (local.get $to_len) (i32.const 40)))
    (if (local.get $owned) (then (call $heap_free (local.get $buf))))
    (if (i32.eq (local.get $r) (i32.const -2)) (then (return)))
    (if (i32.lt_s (local.get $r) (i32.const 0))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const -1)) (return)))
    (if (local.get $arg3) (then (call $gs32 (local.get $arg3) (local.get $r))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  ;; WSARecvFrom(s, lpBuffers, dwBufferCount, lpNumberOfBytesRecvd, lpFlags,
  ;; lpFrom, lpFromlen, lpOverlapped, lpCompletionRoutine).
  (func $handle_WSARecvFrom (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                            (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $sp i32) (local $from i32) (local $from_len i32) (local $buf i32) (local $len i32)
    (local $i i32) (local $part i32) (local $n i32) (local $r i32) (local $owned i32)
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (local.set $from (call $gl32 (i32.add (local.get $sp) (i32.const 24))))
    (local.set $from_len (call $gl32 (i32.add (local.get $sp) (i32.const 28))))
    (if (i32.or (i32.ne (call $gl32 (i32.add (local.get $sp) (i32.const 32))) (i32.const 0))
                (i32.ne (call $gl32 (i32.add (local.get $sp) (i32.const 36))) (i32.const 0)))
      (then (call $crash_unimplemented (local.get $name_ptr))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (local.get $sp) (i32.const 40)))
    (if (i32.or (i32.eqz (local.get $arg1)) (i32.eqz (local.get $arg2)))
      (then (call $vsock_set_error (i32.const 10014))
        (i32.store offset=0 (global.get $reg_base) (i32.const -1)) (return)))
    (if (i32.eq (local.get $arg2) (i32.const 1))
      (then
        (local.set $len (call $gl32 (local.get $arg1)))
        (local.set $buf (call $gl32 (i32.add (local.get $arg1) (i32.const 4)))))
      (else
        (local.set $i (i32.const 0))
        (block $sized (loop $size
          (br_if $sized (i32.ge_u (local.get $i) (local.get $arg2)))
          (local.set $len (i32.add (local.get $len)
            (call $gl32 (i32.add (local.get $arg1) (i32.shl (local.get $i) (i32.const 3))))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $size)))
        (local.set $buf (call $heap_alloc (i32.add (local.get $len) (i32.const 1))))
        (if (i32.eqz (local.get $buf))
          (then (call $vsock_set_error (i32.const 10055))
            (i32.store offset=0 (global.get $reg_base) (i32.const -1)) (return)))
        (local.set $owned (i32.const 1))))
    (local.set $r (call $vsock_recvfrom_core (local.get $arg0) (local.get $buf) (local.get $len)
      (local.get $from) (local.get $from_len) (i32.const 40)))
    (if (local.get $owned)
      (then
        ;; Scatter what arrived across the caller's buffers, in order.
        (if (i32.gt_s (local.get $r) (i32.const 0))
          (then
            (local.set $i (i32.const 0))
            (block $scattered (loop $scatter
              (br_if $scattered (i32.or (i32.ge_u (local.get $i) (local.get $arg2))
                                        (i32.ge_u (local.get $part) (local.get $r))))
              (local.set $n (call $gl32 (i32.add (local.get $arg1) (i32.shl (local.get $i) (i32.const 3)))))
              (if (i32.gt_u (local.get $n) (i32.sub (local.get $r) (local.get $part)))
                (then (local.set $n (i32.sub (local.get $r) (local.get $part)))))
              (call $guest_memmove
                (call $gl32 (i32.add (i32.add (local.get $arg1) (i32.shl (local.get $i) (i32.const 3))) (i32.const 4)))
                (i32.add (local.get $buf) (local.get $part)) (local.get $n))
              (local.set $part (i32.add (local.get $part) (local.get $n)))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $scatter)))))
        (call $heap_free (local.get $buf))))
    (if (i32.eq (local.get $r) (i32.const -2)) (then (return)))
    (if (i32.lt_s (local.get $r) (i32.const 0))
      (then (i32.store offset=0 (global.get $reg_base) (i32.const -1)) (return)))
    (if (local.get $arg3) (then (call $gs32 (local.get $arg3) (local.get $r))))
    (if (local.get $arg4) (then (call $gs32 (local.get $arg4) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  ;; recv(s, buf, len, flags) — returns any available prefix, 0 at EOF.
  (func $handle_recv (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                     (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $idx i32) (local $rec i32) (local $flags i32) (local $n i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
    (local.set $idx (call $vsock_index (local.get $arg0)))
    (if (i32.lt_s (local.get $idx) (i32.const 0))
      (then
        (call $vsock_set_error (i32.const 10038))
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    (local.set $rec (call $vsock_rec (local.get $idx)))
    (call $vsock_read_reenable (local.get $idx))
    (call $vsock_pump)
    (if (i32.ne (load.field VSock state (local.get $rec)) (i32.const 4))
      (then
        (call $vsock_set_error (i32.const 10057))
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    (if (i32.gt_u (load.field VSock rx_len (local.get $rec)) (i32.const 0))
      (then
        (local.set $n (call $vsock_ring_read (local.get $idx) (local.get $arg1) (local.get $arg2)))
        ;; Bytes read are ring space the wire sender may use again.
        (if (i32.eq (load.field VSock peer (local.get $rec)) (i32.const -2))
          (then (call $vsock_owe_credit (local.get $idx) (local.get $n) (i32.const 1))))
        (i32.store offset=0 (global.get $reg_base) (local.get $n))
        (call $vsock_read_rearm (local.get $idx))
        (return)))
    (local.set $flags (load.field VSock flags (local.get $rec)))
    ;; A reset outranks an orderly EOF once the buffer has drained.
    (if (i32.and (local.get $flags) (i32.const 4))
      (then
        (call $vsock_set_error (i32.const 10054))
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    (if (i32.and (local.get $flags) (i32.const 1))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    ;; Nothing buffered and neither half closed: a blocking recv waits.
    (if (i32.eqz (load.field VSock mode (local.get $rec)))
      (then (call $vsock_block (i32.const 20)) (return)))
    (call $vsock_set_error (i32.const 10035))
    (i32.store offset=0 (global.get $reg_base) (i32.const -1)))

  ;; shutdown(s, how) — 0 SD_RECEIVE, 1 SD_SEND, 2 SD_BOTH
  (func $handle_shutdown (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                         (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $idx i32) (local $rec i32) (local $peer i32) (local $prec i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
    (local.set $idx (call $vsock_index (local.get $arg0)))
    (if (i32.lt_s (local.get $idx) (i32.const 0))
      (then
        (call $vsock_set_error (i32.const 10038))
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    (local.set $rec (call $vsock_rec (local.get $idx)))
    (if (i32.ne (load.field VSock state (local.get $rec)) (i32.const 4))
      (then
        (call $vsock_set_error (i32.const 10057))
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    (if (i32.ne (local.get $arg1) (i32.const 0))
      (then
        ;; SD_SEND / SD_BOTH close the write half and deliver FIN.
        (store.field VSock flags (local.get $rec) (i32.or (load.field VSock flags (local.get $rec)) (i32.const 2)))
        (local.set $peer (load.field VSock peer (local.get $rec)))
        (if (i32.eq (local.get $peer) (i32.const -2))
          (then (drop (call $vsock_emit_from (local.get $idx) (i32.const 4)
                        (i32.const 0) (i32.const 0)))))
        (if (i32.ge_s (local.get $peer) (i32.const 0))
          (then
            (local.set $prec (call $vsock_rec (local.get $peer)))
            (store.field VSock flags (local.get $prec) (i32.or (load.field VSock flags (local.get $prec)) (i32.const 1)))))))
    (if (i32.ne (local.get $arg1) (i32.const 1))
      (then
        (store.field VSock flags (local.get $rec) (i32.or (load.field VSock flags (local.get $rec)) (i32.const 1)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  ;; closesocket(s)
  (func $handle_closesocket (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                            (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $idx i32) (local $rec i32) (local $graceful i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
    (local.set $idx (call $vsock_index (local.get $arg0)))
    (if (i32.lt_s (local.get $idx) (i32.const 0))
      (then
        (call $vsock_set_error (i32.const 10038))
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    (local.set $rec (call $vsock_rec (local.get $idx)))
    ;; Closing after shutdown(SD_SEND) is orderly; closing with the write
    ;; half still open aborts, matching TCP's RST-on-unread-close behavior.
    (local.set $graceful
      (i32.ne (i32.and (load.field VSock flags (local.get $rec)) (i32.const 2))
              (i32.const 0)))
    (call $vsock_destroy (local.get $idx) (local.get $graceful))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  ;; select(nfds, readfds, writefds, exceptfds, timeout)
  ;;
  ;; Counting and rewriting are separate passes. A select that is about to
  ;; block must leave the guest's fd_sets untouched, because the same call
  ;; is re-entered after the yield and would otherwise find the sets it had
  ;; already emptied.
  (func $vsock_filter_set (param $set_ga i32) (param $kind i32) (param $apply i32) (result i32)
    (local $wa i32) (local $count i32) (local $i i32) (local $out i32)
    (local $h i32) (local $idx i32) (local $ready i32)
    (if (i32.eqz (local.get $set_ga)) (then (return (i32.const 0))))
    (local.set $wa (call $g2w (local.get $set_ga)))
    (local.set $count (i32.load (local.get $wa)))
    (if (i32.gt_u (local.get $count) (i32.const 64)) (then (local.set $count (i32.const 64))))
    (local.set $i (i32.const 0))
    (local.set $out (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $h (i32.load (i32.add (local.get $wa)
        (i32.add (i32.const 4) (i32.mul (local.get $i) (i32.const 4))))))
      (local.set $idx (call $vsock_index (local.get $h)))
      (local.set $ready (i32.const 0))
      (if (i32.ge_s (local.get $idx) (i32.const 0))
        (then
          (if (i32.eqz (local.get $kind))
            (then (local.set $ready (call $vsock_read_ready (local.get $idx)))))
          (if (i32.eq (local.get $kind) (i32.const 1))
            (then (local.set $ready (call $vsock_write_ready (local.get $idx)))))
          (if (i32.eq (local.get $kind) (i32.const 2))
            (then (local.set $ready (call $vsock_except_ready (local.get $idx)))))))
      (if (local.get $ready)
        (then
          (if (local.get $apply)
            (then
              (i32.store (i32.add (local.get $wa)
                (i32.add (i32.const 4) (i32.mul (local.get $out) (i32.const 4))))
                (local.get $h))))
          (local.set $out (i32.add (local.get $out) (i32.const 1)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (if (local.get $apply) (then (i32.store (local.get $wa) (local.get $out))))
    (local.get $out))

  ;; Milliseconds in a guest timeval, clamped to a day.
  (func $vsock_timeval_ms (param $tv_ga i32) (result i32)
    (local $wa i32) (local $sec i32) (local $usec i32)
    (local.set $wa (call $g2w (local.get $tv_ga)))
    (local.set $sec (i32.load (local.get $wa)))
    (local.set $usec (i32.load (i32.add (local.get $wa) (i32.const 4))))
    (if (i32.lt_s (local.get $sec) (i32.const 0)) (then (local.set $sec (i32.const 0))))
    (if (i32.lt_s (local.get $usec) (i32.const 0)) (then (local.set $usec (i32.const 0))))
    (if (i32.gt_u (local.get $sec) (i32.const 86400)) (then (local.set $sec (i32.const 86400))))
    (i32.add (i32.mul (local.get $sec) (i32.const 1000))
             (i32.div_u (local.get $usec) (i32.const 1000))))

  ;; A select waiting out a finite timeout. Only one can be outstanding,
  ;; because the guest thread is inside the call while it waits.
  (global $vsock_sel_waiting (mut i32) (i32.const 0))
  (global $vsock_sel_deadline (mut i32) (i32.const 0))

  (func $handle_select (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                       (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $total i32) (local $ms i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
    (call $vsock_pump)
    (local.set $total (call $vsock_filter_set (local.get $arg1) (i32.const 0) (i32.const 0)))
    (local.set $total (i32.add (local.get $total)
      (call $vsock_filter_set (local.get $arg2) (i32.const 1) (i32.const 0))))
    (local.set $total (i32.add (local.get $total)
      (call $vsock_filter_set (local.get $arg3) (i32.const 2) (i32.const 0))))
    (if (i32.eqz (local.get $total))
      (then
        ;; A NULL timeval waits until something becomes ready.
        (if (i32.eqz (local.get $arg4))
          (then (call $vsock_block (i32.const 24)) (return)))
        (local.set $ms (call $vsock_timeval_ms (local.get $arg4)))
        (if (local.get $ms)
          (then
            (if (i32.eqz (global.get $vsock_sel_waiting))
              (then
                (global.set $vsock_sel_waiting (i32.const 1))
                (global.set $vsock_sel_deadline
                  (i32.add (call $host_get_ticks) (local.get $ms)))))
            ;; Signed difference so a tick counter that wraps still expires.
            (if (i32.lt_s (i32.sub (call $host_get_ticks) (global.get $vsock_sel_deadline))
                          (i32.const 0))
              (then (call $vsock_block (i32.const 24)) (return)))))))
    ;; Returning for real: rewrite the guest's fd_sets to the ready members,
    ;; which on a timeout means emptying all three.
    (global.set $vsock_sel_waiting (i32.const 0))
    (drop (call $vsock_filter_set (local.get $arg1) (i32.const 0) (i32.const 1)))
    (drop (call $vsock_filter_set (local.get $arg2) (i32.const 1) (i32.const 1)))
    (drop (call $vsock_filter_set (local.get $arg3) (i32.const 2) (i32.const 1)))
    (i32.store offset=0 (global.get $reg_base) (local.get $total)))

  ;; __WSAFDIsSet(s, set)
  (func $handle___WSAFDIsSet (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                             (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32) (local $count i32) (local $i i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (if (i32.eqz (local.get $arg1)) (then (return)))
    (local.set $wa (call $g2w (local.get $arg1)))
    (local.set $count (i32.load (local.get $wa)))
    (if (i32.gt_u (local.get $count) (i32.const 64)) (then (local.set $count (i32.const 64))))
    (local.set $i (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (if (i32.eq (i32.load (i32.add (local.get $wa)
            (i32.add (i32.const 4) (i32.mul (local.get $i) (i32.const 4)))))
          (local.get $arg0))
        (then
          (i32.store offset=0 (global.get $reg_base) (i32.const 1))
          (return)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan))))

  ;; ioctlsocket(s, cmd, argp)
  (func $handle_ioctlsocket (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                            (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $idx i32) (local $rec i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 16)))
    (local.set $idx (call $vsock_index (local.get $arg0)))
    (if (i32.lt_s (local.get $idx) (i32.const 0))
      (then
        (call $vsock_set_error (i32.const 10038))
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    (local.set $rec (call $vsock_rec (local.get $idx)))
    (if (i32.eq (local.get $arg1) (i32.const 0x8004667E))  ;; FIONBIO
      (then
        (store.field VSock mode (local.get $rec) (i32.ne (i32.load (call $g2w (local.get $arg2))) (i32.const 0)))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (if (i32.eq (local.get $arg1) (i32.const 0x4004667F))  ;; FIONREAD
      (then
        ;; FIONREAD is a poll, like select: a real stack has been receiving
        ;; in the background, so move the wire before answering. Atomic
        ;; Bomberman's join waits one second on sendto + FIONREAD alone,
        ;; never taking a message, and saw every reply only after giving up.
        (call $vsock_pump)
        ;; A datagram socket reports every queued payload byte, not the
        ;; first datagram's size and not the record headers.
        (i32.store (call $g2w (local.get $arg2))
          (if (result i32) (i32.eq (load.field VSock type (local.get $rec)) (i32.const 2))
            (then (call $vsock_dgram_walk (local.get $idx) (i32.const 1)))
            (else (load.field VSock rx_len (local.get $rec)))))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (call $vsock_set_error (i32.const 10022))
    (i32.store offset=0 (global.get $reg_base) (i32.const -1)))

  ;; getsockopt(s, level, optname, optval, optlen). Buffer sizes report the
  ;; switch's effective bounded capacities; callers such as Unreal read these
  ;; back after requesting a larger kernel buffer.
  (func $handle_getsockopt (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                           (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $idx i32) (local $need i32) (local $value i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
    (local.set $idx (call $vsock_index (local.get $arg0)))
    (if (i32.lt_s (local.get $idx) (i32.const 0))
      (then
        (call $vsock_set_error (i32.const 10038))
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    (if (i32.or (i32.eqz (local.get $arg3)) (i32.eqz (local.get $arg4)))
      (then
        (call $vsock_set_error (i32.const 10014))           ;; WSAEFAULT
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    (local.set $need (i32.const 4))
    (if (i32.eq (local.get $arg1) (i32.const 0xFFFF))       ;; SOL_SOCKET
      (then
        (if (i32.eq (local.get $arg2) (i32.const 0x1002))   ;; SO_RCVBUF
          (then (local.set $value (global.get $VSOCK_RX_CAP)))
          (else
            (if (i32.eq (local.get $arg2) (i32.const 0x1001)) ;; SO_SNDBUF
              (then (local.set $value (global.get $VLN_MAX_PAYLOAD)))
              (else
                (if (i32.or
                      (i32.eq (local.get $arg2) (i32.const 0x0020)) ;; SO_BROADCAST
                      (i32.eq (local.get $arg2) (i32.const 0x0004))) ;; SO_REUSEADDR
                  (then (local.set $value (i32.const 1)))
                  (else
                    (call $vsock_set_error (i32.const 10042))
                    (i32.store offset=0 (global.get $reg_base) (i32.const -1))
                    (return))))))))
      (else
        (call $vsock_set_error (i32.const 10042))           ;; WSAENOPROTOOPT
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    (if (i32.lt_u (i32.load (call $g2w (local.get $arg4))) (local.get $need))
      (then
        (i32.store (call $g2w (local.get $arg4)) (local.get $need))
        (call $vsock_set_error (i32.const 10014))
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    (i32.store (call $g2w (local.get $arg3)) (local.get $value))
    (i32.store (call $g2w (local.get $arg4)) (local.get $need))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  ;; setsockopt(s, level, optname, optval, optlen)
  (func $handle_setsockopt (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                           (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $idx i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
    (local.set $idx (call $vsock_index (local.get $arg0)))
    (if (i32.lt_s (local.get $idx) (i32.const 0))
      (then
        (call $vsock_set_error (i32.const 10038))
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    ;; SOL_SOCKET options the switch can honor by construction: the room
    ;; switch has no TIME_WAIT and no kernel buffers to resize.
    (if (i32.eq (local.get $arg1) (i32.const 0xFFFF))      ;; SOL_SOCKET
      (then
        (if (i32.or
              (i32.eq (local.get $arg2) (i32.const 0x0020))           ;; SO_BROADCAST
              (i32.or
                (i32.or (i32.eq (local.get $arg2) (i32.const 0x0004)) ;; SO_REUSEADDR
                        (i32.eq (local.get $arg2) (i32.const 0x1001))) ;; SO_SNDBUF
                (i32.or (i32.eq (local.get $arg2) (i32.const 0x1002)) ;; SO_RCVBUF
                        (i32.eq (local.get $arg2) (i32.const 0x0080))))) ;; SO_LINGER
          (then
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (return)))))
    (if (i32.eq (local.get $arg1) (i32.const 6))           ;; IPPROTO_TCP
      (then
        (if (i32.eq (local.get $arg2) (i32.const 1))       ;; TCP_NODELAY
          (then
            ;; The switch never coalesces, so Nagle is already off.
            (i32.store offset=0 (global.get $reg_base) (i32.const 0))
            (return)))))
    (call $vsock_set_error (i32.const 10042))              ;; WSAENOPROTOOPT
    (i32.store offset=0 (global.get $reg_base) (i32.const -1)))

  ;; htons / ntohs — identical 16-bit swap on a little-endian guest.
  (func $handle_htons (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                      (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $bswap16 (i32.and (local.get $arg0) (i32.const 0xFFFF))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  (func $handle_ntohs (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                      (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; Intel host order is little-endian and TCP/IP order is big-endian, so
    ;; both directions are the same involutive 16-bit byte swap.
    (call $handle_htons
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)
      (local.get $arg4) (local.get $name_ptr)))

  (func $handle_ntohl (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                      (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=0 (global.get $reg_base) (call $bswap32 (local.get $arg0)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8))))

  ;; ---- WsControl: the Win95/98 TDI query interface -------------------------
  ;; winipcfg reads the whole adapter configuration through WSOCK32 ordinal
  ;; 1001, not through the registry: it asks for the entity list, then the type
  ;; of each entity, then the IP address table, interface entry and route
  ;; table. We answer for the one adapter the virtual LAN actually has, so what
  ;; the tool displays is the address $vsock_local_ip binds to.
  ;;
  ;; The request buffer is a TDIObjectID: tei_entity, tei_instance, toi_class,
  ;; toi_type, toi_id. Addresses in the responses are network byte order,
  ;; matching what the caller passes to inet_ntoa.
  ;; Store one response and set *pcbResponseInfoLen. Returns the WsControl
  ;; status: 0 when it fit, ERROR_INSUFFICIENT_BUFFER (122) when it did not.
  ;; The needed size is reported either way, which is how callers size a second
  ;; call.
  (func $wsctl_need (param $resp_len_ga i32) (param $cap i32) (param $need i32) (result i32)
    (if (local.get $resp_len_ga)
      (then (i32.store (call $g2w (local.get $resp_len_ga)) (local.get $need))))
    (if (i32.lt_u (local.get $cap) (local.get $need))
      (then (return (i32.const 122))))
    (i32.const 0))

  ;; Zero-fill a guest range. $guest_memset does the page chunking this used to
  ;; get for free from one $g2w per byte, and a memory.fill per contiguous run.
  (func $wsctl_zero (param $ga i32) (param $len i32)
    (call $guest_memset (local.get $ga) (i32.const 0) (local.get $len)))

  ;; Copy a NUL-terminated linear-memory string into a guest buffer.
  (func $wsctl_copy_str (param $dest_ga i32) (param $src_wa i32)
    (local $i i32) (local $ch i32)
    (block $done (loop $c
      (local.set $ch (i32.load8_u (i32.add (local.get $src_wa) (local.get $i))))
      (i32.store8 (call $g2w (i32.add (local.get $dest_ga) (local.get $i))) (local.get $ch))
      (br_if $done (i32.eqz (local.get $ch)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $c))))

  (func $handle_WsControl (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                          (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $resp_len_ga i32) (local $cap i32) (local $need i32)
    (local $entity i32) (local $class i32) (local $id i32) (local $descr i32)
    ;; Every response field is written with $gs8/$gs32 on the guest address.
    ;; The buffer is the caller's and up to 92 bytes plus a description, so it
    ;; can straddle two sparse guest pages that are not adjacent in WASM
    ;; memory; one $g2w up front would have put the tail somewhere else.
    ;; arg0=protocol arg1=action arg2=pRequestInfo arg3=pcbRequestInfoLen
    ;; arg4=pResponseInfo, and the sixth argument is still on the guest stack.
    (local.set $resp_len_ga (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 50))  ;; ERROR_NOT_SUPPORTED
    (block $done
      ;; Only WSCNTL_TCPIP_QUERY_INFORMATION is answered.
      (br_if $done (i32.ne (local.get $arg1) (i32.const 0)))
      (br_if $done (i32.eqz (local.get $arg2)))
      (local.set $entity (call $gl32 (local.get $arg2)))
      (local.set $class  (call $gl32 (i32.add (local.get $arg2) (i32.const 8))))
      (local.set $id     (call $gl32 (i32.add (local.get $arg2) (i32.const 16))))
      (if (local.get $resp_len_ga)
        (then (local.set $cap (call $gl32 (local.get $resp_len_ga)))))

      ;; INFO_CLASS_GENERIC / ENTITY_LIST_ID — which entities exist.
      (if (i32.and (i32.eq (local.get $class) (i32.const 0x100))
                   (i32.eqz (local.get $id)))
        (then
          (local.set $need (i32.const 16))
          (i32.store offset=0 (global.get $reg_base) (call $wsctl_need
            (local.get $resp_len_ga) (local.get $cap) (local.get $need)))
          (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
            (then
              ;; IF_ENTITY instance 0, then CL_NL_ENTITY instance 0.
              (call $gs32 (local.get $arg4) (i32.const 0x200))
              (call $gs32 (i32.add (local.get $arg4) (i32.const 4)) (i32.const 0))
              (call $gs32 (i32.add (local.get $arg4) (i32.const 8)) (i32.const 0x301))
              (call $gs32 (i32.add (local.get $arg4) (i32.const 12)) (i32.const 0))))
          (br $done)))

      ;; INFO_CLASS_GENERIC / ENTITY_TYPE_ID — what kind of entity this is.
      (if (i32.and (i32.eq (local.get $class) (i32.const 0x100))
                   (i32.eq (local.get $id) (i32.const 1)))
        (then
          (i32.store offset=0 (global.get $reg_base) (call $wsctl_need
            (local.get $resp_len_ga) (local.get $cap) (i32.const 4)))
          (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
            (then
              (local.set $need (i32.const 0))
              (if (i32.eq (local.get $entity) (i32.const 0x200))
                (then (local.set $need (i32.const 0x202))))   ;; IF_MIB
              (if (i32.eq (local.get $entity) (i32.const 0x301))
                (then (local.set $need (i32.const 0x303))))   ;; CL_NL_IP
              (call $gs32 (local.get $arg4) (local.get $need))))
          (br $done)))

      ;; Everything below is INFO_CLASS_PROTOCOL.
      (br_if $done (i32.ne (local.get $class) (i32.const 0x200)))

      ;; IP entity: statistics — the counts that size the tables that follow.
      (if (i32.and (i32.eq (local.get $entity) (i32.const 0x301))
                   (i32.eq (local.get $id) (i32.const 1)))
        (then
          (i32.store offset=0 (global.get $reg_base) (call $wsctl_need
            (local.get $resp_len_ga) (local.get $cap) (i32.const 92)))
          (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
            (then
              (call $wsctl_zero (local.get $arg4) (i32.const 92))
              (call $gs32 (local.get $arg4) (i32.const 2))          ;; not forwarding
              (call $gs32 (i32.add (local.get $arg4) (i32.const 4)) (i32.const 128)) ;; default TTL
              (call $gs32 (i32.add (local.get $arg4) (i32.const 80)) (i32.const 1))  ;; numif
              (call $gs32 (i32.add (local.get $arg4) (i32.const 84)) (i32.const 1))  ;; numaddr
              (call $gs32 (i32.add (local.get $arg4) (i32.const 88)) (i32.const 1))));; numroutes
          (br $done)))

      ;; IP entity: the address table — one IPAddrEntry for our adapter.
      (if (i32.and (i32.eq (local.get $entity) (i32.const 0x301))
                   (i32.eq (local.get $id) (i32.const 0x102)))
        (then
          (i32.store offset=0 (global.get $reg_base) (call $wsctl_need
            (local.get $resp_len_ga) (local.get $cap) (i32.const 24)))
          (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
            (then
              (call $wsctl_zero (local.get $arg4) (i32.const 24))
              (call $gs32 (local.get $arg4)
                (call $bswap32 (global.get $vsock_local_ip)))
              (call $gs32 (i32.add (local.get $arg4) (i32.const 4)) (i32.const 1))
              (call $gs32 (i32.add (local.get $arg4) (i32.const 8))
                (call $bswap32 (global.get $wsctl_mask)))
              (call $gs32 (i32.add (local.get $arg4) (i32.const 12)) (i32.const 1))
              (call $gs32 (i32.add (local.get $arg4) (i32.const 16)) (i32.const 65535))))
          (br $done)))

      ;; IP entity: the route table — one default route through the room host.
      ;; The Win98 IPRouteEntry is 48 bytes, one ULONG shorter than the NT one:
      ;; winipcfg strides its route buffer by 0x30 (0x404ea8) and sizes it as
      ;; numroutes * 0x30 (0x404dde), so 52 here makes every query fail with
      ;; ERROR_INSUFFICIENT_BUFFER no matter how the caller reallocates.
      (if (i32.and (i32.eq (local.get $entity) (i32.const 0x301))
                   (i32.eq (local.get $id) (i32.const 0x101)))
        (then
          (i32.store offset=0 (global.get $reg_base) (call $wsctl_need
            (local.get $resp_len_ga) (local.get $cap) (i32.const 48)))
          (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
            (then
              (call $wsctl_zero (local.get $arg4) (i32.const 48))
              (call $gs32 (i32.add (local.get $arg4) (i32.const 4)) (i32.const 1))  ;; index
              (call $gs32 (i32.add (local.get $arg4) (i32.const 8)) (i32.const 1))  ;; metric1
              (call $gs32 (i32.add (local.get $arg4) (i32.const 24))
                (call $bswap32 (global.get $wsctl_gateway)))                                   ;; nexthop
              (call $gs32 (i32.add (local.get $arg4) (i32.const 28)) (i32.const 4)) ;; indirect
              (call $gs32 (i32.add (local.get $arg4) (i32.const 32)) (i32.const 3))));; proto
          (br $done)))

      ;; Interface entity: the adapter itself, ending in its description.
      (if (i32.and (i32.eq (local.get $entity) (i32.const 0x200))
                   (i32.eq (local.get $id) (i32.const 1)))
        (then
          (local.set $descr (call $strlen (region.addr $RESERVED_PAGE_STRINGS 0x10)))
          (local.set $need (i32.add (i32.const 92) (i32.add (local.get $descr) (i32.const 1))))
          (i32.store offset=0 (global.get $reg_base) (call $wsctl_need
            (local.get $resp_len_ga) (local.get $cap) (local.get $need)))
          (if (i32.eqz (i32.load offset=0 (global.get $reg_base)))
            (then
              (call $wsctl_zero (local.get $arg4) (local.get $need))
              (call $gs32 (local.get $arg4) (i32.const 1))            ;; if_index
              (call $gs32 (i32.add (local.get $arg4) (i32.const 4)) (i32.const 6))        ;; ethernet
              (call $gs32 (i32.add (local.get $arg4) (i32.const 8)) (i32.const 1500))     ;; mtu
              (call $gs32 (i32.add (local.get $arg4) (i32.const 12)) (i32.const 10000000));; speed
              (call $gs32 (i32.add (local.get $arg4) (i32.const 16)) (i32.const 6))       ;; physaddrlen
              ;; Locally-administered MAC, fixed so the tool shows the same
              ;; adapter address on every run.
              (call $gs8 (i32.add (local.get $arg4) (i32.const 20)) (i32.const 0x02))
              (call $gs8 (i32.add (local.get $arg4) (i32.const 21)) (i32.const 0x57))
              (call $gs8 (i32.add (local.get $arg4) (i32.const 22)) (i32.const 0x41))
              (call $gs8 (i32.add (local.get $arg4) (i32.const 23)) (i32.const 0x53))
              (call $gs8 (i32.add (local.get $arg4) (i32.const 24)) (i32.const 0x4D))
              (call $gs8 (i32.add (local.get $arg4) (i32.const 25)) (i32.const 0x01))
              (call $gs32 (i32.add (local.get $arg4) (i32.const 28)) (i32.const 1))  ;; admin up
              (call $gs32 (i32.add (local.get $arg4) (i32.const 32)) (i32.const 1))  ;; oper up
              (call $gs32 (i32.add (local.get $arg4) (i32.const 88)) (local.get $descr))
              (call $wsctl_copy_str
                (i32.add (local.get $arg4) (i32.const 92)) (region.addr $RESERVED_PAGE_STRINGS 0x10))))
          (br $done)))
    )
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))

  ;; Parse an IPv4 address at a guest pointer. Returns host byte order, or -1
  ;; when the text is not an address.
  ;;
  ;; Winsock's inet_addr takes FOUR forms, not just the dotted quad, and the
  ;; short ones are the whole reason a person can type an address into a
  ;; game's "host IP" box at all:
  ;;
  ;;   "a.b.c.d"   four octets                    10.0.0.1 -> 10.0.0.1
  ;;   "a.b.c"     last part is the low 16 bits   10.0.1   -> 10.0.0.1
  ;;   "a.b"       last part is the low 24 bits   10.1     -> 10.0.0.1
  ;;
  ;; So the room's host, at 10.0.0.1, is reachable by typing "10.1" — four
  ;; characters into a Win98 dialog on a phone keyboard, and a number that
  ;; survives being said out loud. We rejected every one of those short forms
  ;; before, which real Windows accepts, so an app that offered the shorthand
  ;; got INADDR_NONE here and "could not connect" with nothing to point at.
  ;;
  ;; Two of real inet_addr's behaviours are deliberately NOT here, because
  ;; both are ambiguity rather than convenience: the bare "a" form (a whole
  ;; 32-bit number with no dots), and C-style radix prefixes, where a leading
  ;; 0 means octal, so "010.1" is 8.0.0.1 and "08.1" is not an address at
  ;; all. Nothing types those on purpose. They parse as invalid here rather
  ;; than as some other address, which is the safe direction to be wrong in:
  ;; a refusal is visible, a silently different peer is not.
  (func $vsock_parse_ipv4 (param $ga i32) (result i32)
    (local $wa i32) (local $ch i32) (local $val i32) (local $nparts i32)
    (local $digits i32)
    (local $p0 i32) (local $p1 i32) (local $p2 i32) (local $p3 i32)
    (if (i32.eqz (local.get $ga)) (then (return (i32.const -1))))
    (local.set $wa (call $g2w (local.get $ga)))
    (local.set $nparts (i32.const 0))
    (local.set $val (i32.const 0))
    (local.set $digits (i32.const 0))
    (block $done (loop $scan
      (local.set $ch (i32.load8_u (local.get $wa)))
      (if (i32.and (i32.ge_u (local.get $ch) (i32.const 0x30))
                   (i32.le_u (local.get $ch) (i32.const 0x39)))
        (then
          (local.set $val (i32.add (i32.mul (local.get $val) (i32.const 10))
            (i32.sub (local.get $ch) (i32.const 0x30))))
          (local.set $digits (i32.add (local.get $digits) (i32.const 1)))
          ;; 24 bits is the widest any part may be (the last one of "a.b"),
          ;; and checking here also keeps the running value far from an i32
          ;; overflow however many digits are thrown at it.
          (if (i32.gt_u (local.get $val) (i32.const 0xFFFFFF))
            (then (return (i32.const -1)))))
        (else
          (if (i32.or (i32.eq (local.get $ch) (i32.const 0x2E)) (i32.eqz (local.get $ch)))
            (then
              (if (i32.eqz (local.get $digits)) (then (return (i32.const -1))))
              (if (i32.ge_u (local.get $nparts) (i32.const 4))
                (then (return (i32.const -1))))
              (if (i32.eqz (local.get $nparts)) (then (local.set $p0 (local.get $val))))
              (if (i32.eq (local.get $nparts) (i32.const 1)) (then (local.set $p1 (local.get $val))))
              (if (i32.eq (local.get $nparts) (i32.const 2)) (then (local.set $p2 (local.get $val))))
              (if (i32.eq (local.get $nparts) (i32.const 3)) (then (local.set $p3 (local.get $val))))
              (local.set $nparts (i32.add (local.get $nparts) (i32.const 1)))
              (local.set $val (i32.const 0))
              (local.set $digits (i32.const 0))
              (br_if $done (i32.eqz (local.get $ch))))
            (else (return (i32.const -1))))))
      (local.set $wa (i32.add (local.get $wa) (i32.const 1)))
      (br $scan)))
    ;; Every leading part is one octet; only the last part is widened, and by
    ;; exactly the number of octets the missing parts would have filled.
    (if (i32.eq (local.get $nparts) (i32.const 4))
      (then
        (if (i32.or (i32.or (i32.gt_u (local.get $p0) (i32.const 255))
                            (i32.gt_u (local.get $p1) (i32.const 255)))
                    (i32.or (i32.gt_u (local.get $p2) (i32.const 255))
                            (i32.gt_u (local.get $p3) (i32.const 255))))
          (then (return (i32.const -1))))
        (return (i32.or (i32.or (i32.shl (local.get $p0) (i32.const 24))
                                (i32.shl (local.get $p1) (i32.const 16)))
                        (i32.or (i32.shl (local.get $p2) (i32.const 8))
                                (local.get $p3))))))
    (if (i32.eq (local.get $nparts) (i32.const 3))
      (then
        (if (i32.or (i32.or (i32.gt_u (local.get $p0) (i32.const 255))
                            (i32.gt_u (local.get $p1) (i32.const 255)))
                    (i32.gt_u (local.get $p2) (i32.const 0xFFFF)))
          (then (return (i32.const -1))))
        (return (i32.or (i32.or (i32.shl (local.get $p0) (i32.const 24))
                                (i32.shl (local.get $p1) (i32.const 16)))
                        (local.get $p2)))))
    (if (i32.eq (local.get $nparts) (i32.const 2))
      (then
        (if (i32.or (i32.gt_u (local.get $p0) (i32.const 255))
                    (i32.gt_u (local.get $p1) (i32.const 0xFFFFFF)))
          (then (return (i32.const -1))))
        (return (i32.or (i32.shl (local.get $p0) (i32.const 24)) (local.get $p1)))))
    (i32.const -1))

  ;; inet_addr(cp) — returns network byte order, INADDR_NONE on failure.
  (func $handle_inet_addr (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                          (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ip i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
    (local.set $ip (call $vsock_parse_ipv4 (local.get $arg0)))
    (if (i32.lt_s (local.get $ip) (i32.const 0))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))                   ;; INADDR_NONE
        (return)))
    (i32.store offset=0 (global.get $reg_base) (call $bswap32 (local.get $ip))))

  ;; Write "a.b.c.d" (host byte order input) at a guest pointer; returns the
  ;; byte count written, excluding the terminator.
  (func $vsock_format_ipv4 (param $ga i32) (param $ip i32) (result i32)
    (local $i i32) (local $b i32) (local $pos i32) (local $d i32) (local $started i32)
    (local.set $pos (i32.const 0))
    (local.set $i (i32.const 0))
    (block $od (loop $oct
      (br_if $od (i32.ge_u (local.get $i) (i32.const 4)))
      (local.set $b (i32.and
        (i32.shr_u (local.get $ip) (i32.mul (i32.sub (i32.const 3) (local.get $i)) (i32.const 8)))
        (i32.const 0xFF)))
      (local.set $started (i32.const 0))
      (local.set $d (i32.const 100))
      (block $dd (loop $dig
        (br_if $dd (i32.eqz (local.get $d)))
        (if (i32.or (local.get $started) (i32.or (i32.ge_u (local.get $b) (local.get $d))
                                                 (i32.eq (local.get $d) (i32.const 1))))
          (then
            (i32.store8 (call $g2w (i32.add (local.get $ga) (local.get $pos)))
              (i32.add (i32.const 0x30) (i32.div_u (local.get $b) (local.get $d))))
            (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
            (local.set $started (i32.const 1))
            (local.set $b (i32.rem_u (local.get $b) (local.get $d)))))
        (local.set $d (i32.div_u (local.get $d) (i32.const 10)))
        (br $dig)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (if (i32.lt_u (local.get $i) (i32.const 4))
        (then
          (i32.store8 (call $g2w (i32.add (local.get $ga) (local.get $pos))) (i32.const 0x2E))
          (local.set $pos (i32.add (local.get $pos) (i32.const 1)))))
      (br $oct)))
    (i32.store8 (call $g2w (i32.add (local.get $ga) (local.get $pos))) (i32.const 0))
    (local.get $pos))

  ;; inet_ntoa(in) — takes a network-order in_addr by value, returns a
  ;; pointer to a per-process static buffer, as WinSock does.
  (func $handle_inet_ntoa (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                          (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
    (if (i32.eqz (global.get $vsock_ntoa_buf))
      (then (global.set $vsock_ntoa_buf (call $heap_alloc (i32.const 32)))))
    (if (i32.eqz (global.get $vsock_ntoa_buf))
      (then
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (drop (call $vsock_format_ipv4 (global.get $vsock_ntoa_buf)
      (call $bswap32 (local.get $arg0))))
    (i32.store offset=0 (global.get $reg_base) (global.get $vsock_ntoa_buf)))

  ;; Is this the name of the machine we are running on? Compared without
  ;; regard to case, as the resolver on a real box does. The name itself is
  ;; "PC" because that is what GetComputerNameA already answers: winsock and
  ;; the Win32 computer name are one string on a Win98 box, and an app that
  ;; asks both must not be told two different things.
  (func $vsock_is_own_name (param $ga i32) (result i32)
    (local $wa i32)
    (local.set $wa (call $g2w (local.get $ga)))
    (i32.and
      (i32.eq
        (i32.or (i32.load16_u (local.get $wa)) (i32.const 0x2020))
        (i32.const 0x6370))                                ;; "pc"
      (i32.eqz (i32.load8_u offset=2 (local.get $wa)))))

  ;; gethostname(name, namelen) — the local machine's name.
  ;;
  ;; The idiom this exists for is gethostname followed immediately by
  ;; gethostbyname on the result: that is how an app discovers its own
  ;; address, and TetriNET's server does it to show the address players
  ;; should connect to. Answering here is only half the job -- the name has
  ;; to resolve too, or the app falls back to printing 0.0.0.0.
  (func $handle_gethostname (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                            (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $name_wa i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
    (if (i32.or (i32.eqz (local.get $arg0)) (i32.lt_s (local.get $arg1) (i32.const 3)))
      (then
        (call $vsock_set_error (i32.const 10014))          ;; WSAEFAULT
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    (local.set $name_wa (call $g2w (local.get $arg0)))
    (i32.store8 offset=0 (local.get $name_wa) (i32.const 0x50))  ;; 'P'
    (i32.store8 offset=1 (local.get $name_wa) (i32.const 0x43))  ;; 'C'
    (i32.store8 offset=2 (local.get $name_wa) (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  ;; gethostbyname(name) — version 1 resolves numeric room addresses only.
  ;; Layout: hostent at +0 (16 bytes), addr-list pointer array at +16,
  ;; the in_addr at +32, and the name copy at +40.
  (func $handle_gethostbyname (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                              (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ip i32) (local $base i32) (local $base_wa i32) (local $i i32) (local $ch i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
    (local.set $ip (call $vsock_parse_ipv4 (local.get $arg0)))
    ;; Our own name resolves to our room address. Without this the
    ;; gethostname/gethostbyname pair an app uses to find its own address
    ;; fails, and the app reports 0.0.0.0 rather than the address anyone
    ;; could actually reach it on.
    (if (i32.and (i32.lt_s (local.get $ip) (i32.const 0))
                 (call $vsock_is_own_name (local.get $arg0)))
      (then (local.set $ip (global.get $vsock_local_ip))))
    (if (i32.lt_s (local.get $ip) (i32.const 0))
      (then
        (call $vsock_set_error (i32.const 11001))          ;; WSAHOST_NOT_FOUND
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (if (i32.eqz (global.get $vsock_hostent))
      (then (global.set $vsock_hostent (call $heap_alloc (i32.const 128)))))
    (local.set $base (global.get $vsock_hostent))
    (if (i32.eqz (local.get $base))
      (then
        (call $vsock_set_error (i32.const 11001))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (local.set $base_wa (call $g2w (local.get $base)))
    ;; Copy the queried name so h_name stays valid after the call.
    (local.set $i (i32.const 0))
    (block $nd (loop $nc
      (br_if $nd (i32.ge_u (local.get $i) (i32.const 63)))
      (local.set $ch (i32.load8_u (call $g2w (i32.add (local.get $arg0) (local.get $i)))))
      (i32.store8 (i32.add (local.get $base_wa) (i32.add (i32.const 40) (local.get $i)))
        (local.get $ch))
      (br_if $nd (i32.eqz (local.get $ch)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $nc)))
    (i32.store offset=32 (local.get $base_wa)
      (call $bswap32 (local.get $ip)))
    (i32.store offset=16 (local.get $base_wa)
      (i32.add (local.get $base) (i32.const 32)))
    (i32.store offset=20 (local.get $base_wa) (i32.const 0))
    (i32.store (local.get $base_wa)
      (i32.add (local.get $base) (i32.const 40)))          ;; h_name
    (i32.store offset=4 (local.get $base_wa) (i32.const 0)) ;; h_aliases
    (i32.store16 offset=8 (local.get $base_wa) (i32.const 2)) ;; AF_INET
    (i32.store16 offset=10 (local.get $base_wa) (i32.const 4))
    (i32.store offset=12 (local.get $base_wa)
      (i32.add (local.get $base) (i32.const 16)))          ;; h_addr_list
    (i32.store offset=0 (global.get $reg_base) (local.get $base)))

  ;; Copy a NUL-terminated guest string into a guest buffer, bounded.
  (func $vsock_copy_cstr (param $dst i32) (param $src i32) (param $max i32)
    (local $i i32) (local $ch i32)
    (block $done (loop $next
      (br_if $done (i32.ge_u (local.get $i) (local.get $max)))
      (local.set $ch (i32.load8_u (call $g2w (i32.add (local.get $src) (local.get $i)))))
      (i32.store8 (call $g2w (i32.add (local.get $dst) (local.get $i))) (local.get $ch))
      (br_if $done (i32.eqz (local.get $ch)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $next))))

  ;; The TCP services a Win98 box knows without being told. Matched with the
  ;; lowercase-dword idiom used elsewhere; the trailing NUL becomes 0x20 under
  ;; the same OR, which is why the constants carry it.
  (func $vsock_service_port (param $name i32) (result i32)
    (local $d0 i32) (local $name_wa i32)
    (local.set $name_wa (call $g2w (local.get $name)))
    (local.set $d0 (i32.or (i32.load (local.get $name_wa)) (i32.const 0x20202020)))
    (if (i32.eq (local.get $d0) (i32.const 0x20707466)) (then (return (i32.const 21))))   ;; ftp
    (if (i32.and (i32.eq (local.get $d0) (i32.const 0x6e6c6574))
          (i32.and
            (i32.eq (i32.or (i32.load16_u offset=4 (local.get $name_wa))
                            (i32.const 0x2020)) (i32.const 0x7465))
            (i32.eqz (i32.load8_u offset=6 (local.get $name_wa)))))
      (then (return (i32.const 23))))                                                     ;; telnet
    (if (i32.and (i32.eq (local.get $d0) (i32.const 0x706d7473))
                 (i32.eqz (i32.load8_u offset=4 (local.get $name_wa))))
      (then (return (i32.const 25))))                                                     ;; smtp
    (if (i32.and (i32.eq (local.get $d0) (i32.const 0x70747468))
                 (i32.eqz (i32.load8_u offset=4 (local.get $name_wa))))
      (then (return (i32.const 80))))                                                     ;; http
    (if (i32.and (i32.eq (local.get $d0) (i32.const 0x33706f70))
                 (i32.eqz (i32.load8_u offset=4 (local.get $name_wa))))
      (then (return (i32.const 110))))                                                    ;; pop3
    (if (i32.and (i32.eq (local.get $d0) (i32.const 0x70746e6e))
                 (i32.eqz (i32.load8_u offset=4 (local.get $name_wa))))
      (then (return (i32.const 119))))                                                    ;; nntp
    (i32.const 0))

  ;; getservbyname(name, proto) → struct servent* (NULL when unknown)
  ;;
  ;; A miss is the normal, correct answer for anything not in the services
  ;; file: an app that names its own protocol looks it up, gets NULL, and
  ;; falls back to its built-in port. TetriNET does exactly that on its way to
  ;; port 31457, so the value here is answering at all rather than trapping.
  (func $handle_getservbyname (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                              (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $port i32) (local $base i32) (local $base_wa i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
    (if (i32.eqz (local.get $arg0))
      (then
        (call $vsock_set_error (i32.const 11004))          ;; WSANO_DATA
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (local.set $port (call $vsock_service_port (local.get $arg0)))
    (if (i32.eqz (local.get $port))
      (then
        (call $vsock_set_error (i32.const 11004))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (if (i32.eqz (global.get $vsock_servent))
      (then (global.set $vsock_servent (call $heap_alloc (i32.const 96)))))
    (local.set $base (global.get $vsock_servent))
    (if (i32.eqz (local.get $base))
      (then
        (call $vsock_set_error (i32.const 11004))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (local.set $base_wa (call $g2w (local.get $base)))
    ;; Keep our own copies: the caller's buffers may be stack temporaries.
    (call $vsock_copy_cstr (i32.add (local.get $base) (i32.const 16))
      (local.get $arg0) (i32.const 31))
    (if (local.get $arg1)
      (then (call $vsock_copy_cstr (i32.add (local.get $base) (i32.const 48))
              (local.get $arg1) (i32.const 31)))
      (else (i32.store8 offset=48 (local.get $base_wa)
              (i32.const 0))))
    (i32.store offset=88 (local.get $base_wa) (i32.const 0))
    (i32.store (local.get $base_wa)
      (i32.add (local.get $base) (i32.const 16)))          ;; s_name
    (i32.store offset=4 (local.get $base_wa)
      (i32.add (local.get $base) (i32.const 88)))          ;; s_aliases → {NULL}
    ;; s_port is network byte order, unlike everything around it.
    (i32.store16 offset=8 (local.get $base_wa)
      (i32.or (i32.shl (i32.and (local.get $port) (i32.const 0xFF)) (i32.const 8))
              (i32.shr_u (local.get $port) (i32.const 8))))
    (i32.store offset=12 (local.get $base_wa)
      (i32.add (local.get $base) (i32.const 48)))          ;; s_proto
    (i32.store offset=0 (global.get $reg_base) (local.get $base)))

  ;; ---- WSAAsyncSelect: sockets that report themselves as window messages --
  ;;
  ;; The other half of Winsock. select() asks "is anything ready yet"; this
  ;; says "tell my window when something happens" and then never polls. Apps
  ;; built around a message pump use it exclusively -- TetriNET and Win98's
  ;; own telnet both do -- so without it a socket connects and the app never
  ;; finds out.
  ;;
  ;; The registration lives beside the socket table rather than inside it:
  ;; VSOCK_TABLE is 128 records of exactly 128 bytes in a 16KB region with no
  ;; room left, and widening the record would mean moving a memory-map
  ;; boundary for three fields.
  ;; One table per process, found through $VSOCK_ASYNC_SHARED. Each guest
  ;; thread is a separate WASM instance, and a per-instance table (the old
  ;; global) meant a listener registered on one thread and accepted on another
  ;; lost its registration, and an event the wire raised in one instance was
  ;; checked against another instance's empty table: Jazz Jackrabbit 2 listens
  ;; on its main thread, accepts on its network thread, and never heard
  ;; FD_READ for the client's first packet. Returns a guest address.
  (global $VSOCK_ASYNC_REC i32 (i32.const 12))

  (func $vsock_async_rec (param $idx i32) (result i32)
    (local $i i32) (local $base i32) (local $won i32)
    (if (i32.ge_u (local.get $idx) (global.get $VSOCK_MAX)) (then (return (i32.const 0))))
    (local.set $base (i32.atomic.load (global.get $VSOCK_ASYNC_SHARED)))
    (if (i32.eqz (local.get $base))
      (then
        (local.set $base (call $heap_alloc
          (i32.mul (global.get $VSOCK_MAX) (global.get $VSOCK_ASYNC_REC))))
        (if (i32.eqz (local.get $base)) (then (return (i32.const 0))))
        (block $zdone (loop $z
          (br_if $zdone (i32.ge_u (local.get $i)
            (i32.mul (global.get $VSOCK_MAX) (global.get $VSOCK_ASYNC_REC))))
          (call $gs32 (i32.add (local.get $base) (local.get $i)) (i32.const 0))
          (local.set $i (i32.add (local.get $i) (i32.const 4)))
          (br $z)))
        ;; Two instances may race to make it; the first published table wins
        ;; and the loser's allocation is returned.
        (local.set $won (i32.atomic.rmw.cmpxchg (global.get $VSOCK_ASYNC_SHARED)
          (i32.const 0) (local.get $base)))
        (if (local.get $won)
          (then (call $heap_free (local.get $base)) (local.set $base (local.get $won))))))
    (i32.add (local.get $base)
      (i32.mul (local.get $idx) (global.get $VSOCK_ASYNC_REC))))

  ;; Report one event to the window that asked for it. lParam packs the event
  ;; and the error the way WSAMAKESELECTREPLY does; wParam is the handle.
  (func $vsock_async_post (param $idx i32) (param $event i32) (param $error i32)
    (local $rec i32) (local $w i32) (local $tid i32) (local $sock i32)
    (local.set $rec (call $vsock_async_rec (local.get $idx)))
    (if (i32.eqz (local.get $rec)) (then (return)))
    (local.set $w (call $g2w (local.get $rec)))
    (if (i32.eqz (i32.load (local.get $w))) (then (return)))          ;; no window
    (if (i32.eqz (i32.and (i32.load offset=8 (local.get $w)) (local.get $event)))
      (then (return)))                                               ;; not requested
    ;; FD_READ is re-enabling: once posted, Winsock posts no other until the
    ;; app calls recv/recvfrom (which re-arms it if data is still queued).
    ;; One post per arriving frame instead handed Delphi's ScktComp an
    ;; FD_READ with nothing to read; its ReceiveText then returns the
    ;; uninitialized receive buffer, and TetriNET prefixed that garbage to
    ;; its next command and disconnected (two copies in one browser tab,
    ;; where newgame and the first field record arrive in one pump).
    (if (i32.eq (local.get $event) (i32.const 0x01))
      (then
        (local.set $sock (call $vsock_rec (local.get $idx)))
        (if (i32.and (load.field VSock flags (local.get $sock)) (i32.const 0x20))
          (then (return)))
        (store.field VSock flags (local.get $sock)
          (i32.or (load.field VSock flags (local.get $sock)) (i32.const 0x20)))))
    ;; To the window's own thread, as PostMessage delivers. The wire is pumped
    ;; from whichever thread is running (GetMessage/PeekMessage, or the host
    ;; between batches), and the current thread's queue is not necessarily the
    ;; owner's: Jazz Jackrabbit 2 runs its sockets from a network thread that
    ;; owns the notification window, and FD_READ for the client's first packet
    ;; went to the main thread's queue, so the server never read it and the
    ;; client timed out.
    (local.set $tid (call $wnd_get_thread (i32.load (local.get $w))))
    (if (i32.and (i32.ne (local.get $tid) (i32.const 0))
                 (i32.ne (local.get $tid) (global.get $current_thread_id)))
      (then
        (drop (call $shared_post_queue_enqueue
          (i32.load (local.get $w))
          (i32.load offset=4 (local.get $w))
          (call $vsock_handle (local.get $idx))
          (i32.or (i32.shl (local.get $error) (i32.const 16)) (local.get $event))))
        (return)))
    (drop (call $post_queue_push
      (i32.load (local.get $w))
      (i32.load offset=4 (local.get $w))
      (call $vsock_handle (local.get $idx))
      (i32.or (i32.shl (local.get $error) (i32.const 16)) (local.get $event)))))

  ;; WSAAsyncSelect(s, hWnd, wMsg, lEvent) → 0 on success
  (func $handle_WSAAsyncSelect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                               (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $idx i32) (local $rec i32) (local $w i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
    (local.set $idx (call $vsock_index (local.get $arg0)))
    (if (i32.lt_s (local.get $idx) (i32.const 0))
      (then
        (call $vsock_set_error (i32.const 10038))          ;; WSAENOTSOCK
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    (local.set $rec (call $vsock_async_rec (local.get $idx)))
    (if (i32.eqz (local.get $rec))
      (then
        (call $vsock_set_error (i32.const 10055))          ;; WSAENOBUFS
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    (local.set $w (call $g2w (local.get $rec)))
    (i32.store        (local.get $w) (local.get $arg1))    ;; hWnd
    (i32.store offset=4 (local.get $w) (local.get $arg2))  ;; wMsg
    (i32.store offset=8 (local.get $w) (local.get $arg3))  ;; lEvent
    ;; Documented side effect: the socket becomes non-blocking, and stays that
    ;; way even if the registration is later cancelled with lEvent = 0.
    (store.field VSock mode (call $vsock_rec (local.get $idx)) (i32.const 1))
    ;; Registering is level-triggered for what is already true: data waiting
    ;; posts FD_READ, a connected socket posts FD_WRITE, a queued connection
    ;; posts FD_ACCEPT. SimCity 2000 Network Edition's server accepts with the
    ;; listener's FD_ACCEPT-only mask and only then asks for FD_READ; the
    ;; client's login is already in the ring by then, and without this
    ;; re-announcement the server never reads it and drops the player.
    (call $vsock_read_reenable (local.get $idx))
    (if (call $vsock_read_ready (local.get $idx))
      (then (call $vsock_async_post (local.get $idx) (i32.const 0x01) (i32.const 0))))
    (if (i32.eq (load.field VSock state (call $vsock_rec (local.get $idx))) (i32.const 4))
      (then (call $vsock_async_post (local.get $idx) (i32.const 0x02) (i32.const 0))))
    (if (i32.gt_u (load.field VSock acc_count (call $vsock_rec (local.get $idx))) (i32.const 0))
      (then (call $vsock_async_post (local.get $idx) (i32.const 0x08) (i32.const 0))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  ;; getprotobyname(name) → struct protoent* (NULL when unknown)
  ;;
  ;; Apps call this to turn "tcp" into the 6 they pass to socket(). The four
  ;; protocols below are the ones a Win98 protocol file lists that anything
  ;; here could ask for; anything else is genuinely unknown.
  (func $handle_getprotobyname (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                               (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $d0 i32) (local $proto i32) (local $base i32) (local $base_wa i32) (local $n i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
    (if (i32.eqz (local.get $arg0))
      (then
        (call $vsock_set_error (i32.const 11004))          ;; WSANO_DATA
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (local.set $n (call $g2w (local.get $arg0)))
    (local.set $d0 (i32.or (i32.load (local.get $n)) (i32.const 0x20202020)))
    (local.set $proto (i32.const -1))
    (if (i32.eq (local.get $d0) (i32.const 0x20706374))
      (then (local.set $proto (i32.const 6))))            ;; tcp
    (if (i32.eq (local.get $d0) (i32.const 0x20706475))
      (then (local.set $proto (i32.const 17))))           ;; udp
    (if (i32.and (i32.eq (local.get $d0) (i32.const 0x706d6369))
                 (i32.eqz (i32.load8_u offset=4 (local.get $n))))
      (then (local.set $proto (i32.const 1))))            ;; icmp
    (if (i32.and (i32.eq (i32.or (i32.load16_u (local.get $n)) (i32.const 0x2020))
                         (i32.const 0x7069))
                 (i32.eqz (i32.load8_u offset=2 (local.get $n))))
      (then (local.set $proto (i32.const 0))))            ;; ip
    (if (i32.lt_s (local.get $proto) (i32.const 0))
      (then
        (call $vsock_set_error (i32.const 11004))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (if (i32.eqz (global.get $vsock_protoent))
      (then (global.set $vsock_protoent (call $heap_alloc (i32.const 64)))))
    (local.set $base (global.get $vsock_protoent))
    (if (i32.eqz (local.get $base))
      (then
        (call $vsock_set_error (i32.const 11004))
        (i32.store offset=0 (global.get $reg_base) (i32.const 0))
        (return)))
    (local.set $base_wa (call $g2w (local.get $base)))
    (call $vsock_copy_cstr (i32.add (local.get $base) (i32.const 16))
      (local.get $arg0) (i32.const 31))
    (i32.store offset=56 (local.get $base_wa) (i32.const 0))
    (i32.store (local.get $base_wa)
      (i32.add (local.get $base) (i32.const 16)))          ;; p_name
    (i32.store offset=4 (local.get $base_wa)
      (i32.add (local.get $base) (i32.const 56)))          ;; p_aliases → {NULL}
    ;; p_proto is a plain int, in host order — unlike servent's s_port.
    (i32.store offset=8 (local.get $base_wa) (local.get $proto))
    (i32.store offset=0 (global.get $reg_base) (local.get $base)))

  ;; WSAStartup(wVersionRequested, lpWSAData)
  (func $handle_WSAStartup (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                           (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
    ;; 400 bytes crosses a guest page boundary from most addresses, and two
    ;; adjacent sparse guest pages need not be adjacent in WASM memory, so the
    ;; record is gathered and written back instead of filled through one $g2w.
    (local.set $wa (call $guest_span_in (local.get $arg1) (i32.const 400)))
    ;; Win32 WSADATA is 400 bytes. Clear the character arrays, alignment
    ;; padding, and provider pointer before publishing the fields supported by
    ;; this virtual provider. MFC's AfxSocketInit reads iMaxSockets at +390;
    ;; leaving it zero makes Half-Life Uplink report an insufficient-sockets
    ;; warning even though the actual table below has 128 slots. SimCity 2000
    ;; Network Edition's server refuses to start below 65 (64 players plus
    ;; its listener), which is why the table is not 64.
    (memory.fill (local.get $wa) (i32.const 0) (i32.const 400))
    ;; wVersion is the negotiated request; wHighVersion is the provider
    ;; ceiling. WinSock 1.1 clients reject a success that reports 2.2 here.
    (i32.store16 (local.get $wa) (i32.and (local.get $arg0) (i32.const 0xFFFF)))
    (i32.store16 (i32.add (local.get $wa) (i32.const 2)) (i32.const 0x0202))
    ;; Stream and datagram sockets share the same 128-record table.
    (i32.store16 (i32.add (local.get $wa) (i32.const 390))
      (global.get $VSOCK_MAX))                                  ;; iMaxSockets
    (i32.store16 (i32.add (local.get $wa) (i32.const 392))
      (global.get $VLN_MAX_PAYLOAD))                            ;; iMaxUdpDg
    (i32.store (i32.add (local.get $wa) (i32.const 396)) (i32.const 0))
                                                               ;; lpVendorInfo
    (call $guest_span_writeback (local.get $arg1) (local.get $wa) (i32.const 400))
    (global.set $wsa_started (i32.add (global.get $wsa_started) (i32.const 1)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  ;; WSACleanup() — the last matching call tears the room switch down.
  (func $handle_WSACleanup (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                           (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $i i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (if (i32.eqz (global.get $wsa_started))
      (then
        (call $vsock_set_error (i32.const 10093))          ;; WSANOTINITIALISED
        (i32.store offset=0 (global.get $reg_base) (i32.const -1))
        (return)))
    (global.set $wsa_started (i32.sub (global.get $wsa_started) (i32.const 1)))
    (if (i32.eqz (global.get $wsa_started))
      (then
        (local.set $i (i32.const 0))
        (block $done (loop $scan
          (br_if $done (i32.ge_u (local.get $i) (global.get $VSOCK_MAX)))
          (call $vsock_destroy (local.get $i) (i32.const 0))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $scan)))))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  (func $handle_WSAGetLastError (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                                (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (i32.store offset=0 (global.get $reg_base) (global.get $wsa_last_error)))

  ;; WSAIsBlocking() -- Winsock 1.x asks whether a blocking hook call is in
  ;; progress. Socket waits here yield cooperatively back to the host instead
  ;; of running a nested blocking hook, so applications should see FALSE.
  (func $handle_WSAIsBlocking (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                              (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))

  ;; WSACancelBlockingCall() -- Winsock 1.1, WSOCK32 ordinal 113. With no
  ;; blocking call ever in progress (see WSAIsBlocking) there is nothing to
  ;; cancel, which the 1.1 spec answers with SOCKET_ERROR / WSAEINVAL, or
  ;; WSANOTINITIALISED before WSAStartup. Descent 3 imports it by ordinal.
  (func $handle_WSACancelBlockingCall (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                                      (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $vsock_set_error
      (select (i32.const 10022) (i32.const 10093) (global.get $wsa_started))) ;; WSAEINVAL / WSANOTINITIALISED
    (i32.store offset=0 (global.get $reg_base) (i32.const -1)))

  (func $handle_WSASetLastError (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
                                (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
    (global.set $wsa_last_error (local.get $arg0)))
