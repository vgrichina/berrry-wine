  ;; ======================================================================
  ;; DirectPlay over the virtual LAN (dpl/1)
  ;; ======================================================================
  ;;
  ;; The IDirectPlay3/4 object in 09a8 keeps a process-local name table and
  ;; message queue. This file is the service provider that joins two of those
  ;; tables across the room's frame wire, the way the TCP/IP provider joins
  ;; two Win98 machines: sessions are discovered by broadcast, a join is a
  ;; request/acknowledge with the host, every player is announced to every
  ;; peer, and Send to a player that lives elsewhere becomes one frame to
  ;; that machine's address.
  ;;
  ;; Frames share the wire with vln/1 and dde/1 under their own magic:
  ;;   +0 'DPL1'  +4 type  +8 src_ip  +12 dst_ip (-1 broadcast)
  ;;   +16 a      +20 b    +24 payload length   +28 payload
  ;;
  ;;   1 ENUM_REQ     payload guidApplication (zero = any)
  ;;   2 ENUM_REPLY   payload session record (see $DPN_SESSION_*)
  ;;   3 JOIN_REQ     payload guidInstance
  ;;   4 JOIN_ACK     a = 0
  ;;   5 PLAYER_ADD   a = dpId, b = 1 when part of the join snapshot,
  ;;                  payload +0 player flags, +4 NUL-terminated short name,
  ;;                  then optionally the IDirectPlay4W short name as raw
  ;;                  UTF-16 units ending in a 16-bit NUL
  ;;   6 PLAYER_DEL   a = dpId
  ;;   7 DATA         a = from dpId, b = to dpId (0 = everyone), payload bytes
  ;;   8 LEAVE        the sender's session is gone
  ;;   9 PLAYER_DATA  a = dpId, b = 1 when part of the join snapshot,
  ;;                  payload the player's shared (non-DPSET_LOCAL) data
  ;;
  ;; guidInstance is {host_ip, 'DPNS', counter, 0}, so a joiner can read the
  ;; host's address straight out of the session it was handed.
  ;;
  ;; Everything here is per wasm instance, like the name table it extends:
  ;; the guest thread that owns the DirectPlay object is the one that pumps.
  ;; Data is unguaranteed and dropped when the local queue is full; the wire
  ;; itself does not lose frames.

  ;; DirectPlay's mutable state lives in $DP_SHARED so every guest-thread
  ;; instance shares one session. Layout (offset, former global):
  ;;   +0 $dplay_enum_tcpip_guid
  ;;   +4 $dplay_enum_tcpip_name
  ;;   +8 $dp_entity_table
  ;;   +12 $dp_entity_next_id (stored minus 256)
  ;;   +16 $dp_message_table
  ;;   +20 $dp_message_next_id (stored minus 1)
  ;;   +24 $dp_message_bytes
  ;;   +28 $dpw_names
  ;;   +32 $dpw_provider
  ;;   +36 $dp_net_users
  ;;   +40 $dpn_state
  ;;   +44 $dpn_owner
  ;;   +48 $dpn_host_ip
  ;;   +52 $dpn_deadline
  ;;   +56 $dpn_enum_active
  ;;   +60 $dpn_enum_async
  ;;   +64 $dpn_open_parked
  ;;   +68 $dpn_instance_counter
  ;;   +72 $dpn_tx_buf
  ;;   +76 $dpn_peers
  ;;   +80 $dpn_session
  ;;   +84 $dpn_found
  ;;   +88 $dpn_enum_desc
  ;;   +92 $dpn_enum_timeout
  ;;   +96 thread id that owns the wire for DirectPlay ($dpn_pumps_here)
  ;;   +100 last message ID handed out by an asynchronous SendEx
  (global $DP_SHARED i32 (region.addr $DP_SHARED 0))
  (global $DP_SHARED_SIZE i32 (i32.const 0x80))

  (global $DPL_MAGIC i32 (i32.const 0x314C5044)) ;; 'DPL1'
  (global $DPL_HDR i32 (i32.const 28))
  (global $DPL_MAX_PAYLOAD i32 (i32.const 4096))
  (global $DPN_GUID_TAG i32 (i32.const 0x534E5044)) ;; 'DPNS'

  ;; Nonzero once this instance has a networked DirectPlay session or search,
  ;; which is what makes $vsock_pump read the wire for it.
  ;; 0 none, 1 hosting, 2 join requested, 3 joined.
  ;; A DPENUMSESSIONS_ASYNC search is running: replies keep filling the found
  ;; table between the app's polling calls until DPENUMSESSIONS_STOPASYNC.
  ;; Set while an Open(JOIN) is parked. The host pumps the wire between a
  ;; park and the re-entry (thread-manager's vlan_pump), so the ACK may have
  ;; already moved $dpn_state on: re-entry must be told apart by this, not
  ;; by the state it left behind.
  (global $DPN_PEER_MAX i32 (i32.const 8))
  ;; Hosted session record, laid out exactly as the ENUM_REPLY payload:
  ;; +0 guidInstance, +16 guidApplication, +32 max players, +36 current
  ;; players, +40 session flags, +44 name (32 bytes, NUL-terminated), +76 the
  ;; name an IDirectPlay4W host gave, as its own UTF-16 units (64 bytes,
  ;; 16-bit NUL; empty for an ANSI host). Narrowing a W name to 1252 is lossy,
  ;; so a W reader takes +76 when it is there. A sender of the original 76-byte
  ;; record still reads correctly: the missing tail is an empty W name.
  (global $DPN_SESSION_SIZE i32 (i32.const 140))
  (global $DPN_SESSION_NARROW i32 (i32.const 76))
  (global $DPN_SESSION_WNAME i32 (i32.const 76))
  ;; Sessions heard during a search, one record each plus a live word.
  (global $DPN_FOUND_MAX i32 (i32.const 8))
  (global $DPN_FOUND_LIVE i32 (i32.const 140))
  (global $DPN_FOUND_STRIDE i32 (i32.const 144))
  ;; DPSESSIONDESC2 handed to the EnumSessions callback, reused per session.

  (func $dpn_alloc_zero (param $size i32) (result i32)
    (local $p i32)
    (local.set $p (call $heap_alloc (local.get $size)))
    (if (local.get $p)
      (then (call $zero_memory (call $g2w (local.get $p)) (local.get $size))))
    (local.get $p))

  ;; Allocate the provider's buffers and give this machine's player ids their
  ;; own range, so ids minted on two machines never collide in one table.
  (func $dpn_activate (param $owner i32) (result i32)
    (if (i32.eqz (i32.load offset=72 (global.get $DP_SHARED)))
      (then (i32.store offset=72 (global.get $DP_SHARED) (call $dpn_alloc_zero
        (i32.add (global.get $DPL_HDR) (global.get $DPL_MAX_PAYLOAD))))))
    (if (i32.eqz (i32.load offset=76 (global.get $DP_SHARED)))
      (then (i32.store offset=76 (global.get $DP_SHARED) (call $dpn_alloc_zero
        (i32.shl (global.get $DPN_PEER_MAX) (i32.const 2))))))
    (if (i32.eqz (i32.load offset=80 (global.get $DP_SHARED)))
      (then (i32.store offset=80 (global.get $DP_SHARED) (call $dpn_alloc_zero (global.get $DPN_SESSION_SIZE)))))
    (if (i32.eqz (i32.load offset=84 (global.get $DP_SHARED)))
      (then (i32.store offset=84 (global.get $DP_SHARED) (call $dpn_alloc_zero
        (i32.mul (global.get $DPN_FOUND_MAX) (global.get $DPN_FOUND_STRIDE))))))
    (if (i32.eqz (i32.load offset=88 (global.get $DP_SHARED)))
      ;; 80-byte DPSESSIONDESC2, then room for a 31-character UTF-16 session
      ;; name at +80 for an IDirectPlay4W enumeration.
      (then (i32.store offset=88 (global.get $DP_SHARED) (call $dpn_alloc_zero (i32.const 144)))))
    (if (i32.eqz (i32.load offset=92 (global.get $DP_SHARED)))
      (then (i32.store offset=92 (global.get $DP_SHARED) (call $dpn_alloc_zero (i32.const 4)))))
    (if (i32.or
          (i32.or (i32.eqz (i32.load offset=72 (global.get $DP_SHARED))) (i32.eqz (i32.load offset=76 (global.get $DP_SHARED))))
          (i32.or
            (i32.or (i32.eqz (i32.load offset=80 (global.get $DP_SHARED))) (i32.eqz (i32.load offset=84 (global.get $DP_SHARED))))
            (i32.or (i32.eqz (i32.load offset=88 (global.get $DP_SHARED)))
              (i32.eqz (i32.load offset=92 (global.get $DP_SHARED))))))
      (then (return (i32.const 0))))
    (if (i32.lt_u (i32.add (i32.load offset=12 (global.get $DP_SHARED)) (i32.const 256)) (i32.const 0x10000))
      (then (i32.store offset=12 (global.get $DP_SHARED) (i32.sub (i32.add (i32.add (i32.load offset=12 (global.get $DP_SHARED)) (i32.const 256))
          (i32.shl (i32.add (i32.and (global.get $vsock_local_ip) (i32.const 0xFF))
            (i32.const 1)) (i32.const 16))) (i32.const 256)))))
    ;; The thread that brings networking up owns the wire for DirectPlay:
    ;; only it pumps (see $dpn_pumps_here).
    (if (i32.eqz (i32.load offset=36 (global.get $DP_SHARED)))
      (then (i32.store offset=96 (global.get $DP_SHARED) (global.get $current_thread_id))))
    (i32.store offset=36 (global.get $DP_SHARED) (i32.const 1))
    (if (local.get $owner) (then (i32.store offset=44 (global.get $DP_SHARED) (local.get $owner))))
    (i32.const 1))

  ;; Read the wire before answering a question about it.
  ;; Nonzero when this thread should read the wire for DirectPlay. The session
  ;; state is shared, but each guest thread runs its own module instance with
  ;; its own socket globals, and a parked Open waits for its own thread to see
  ;; the reply: a second thread pumping (MCM receives on one) drained the
  ;; JOIN_ACK the main thread was parked on. Other threads read the shared
  ;; message table that the owning thread fills, woken by the player event.
  (func $dpn_pumps_here (result i32)
    (i32.and
      (i32.ne (i32.load offset=36 (global.get $DP_SHARED)) (i32.const 0))
      (i32.eq (i32.load offset=96 (global.get $DP_SHARED)) (global.get $current_thread_id))))

  (func $dpn_poll
    (if (call $dpn_pumps_here) (then (call $vsock_pump))))

  (func $dpn_deadline_passed (result i32)
    (i32.ge_s (i32.sub (call $host_get_ticks) (i32.load offset=52 (global.get $DP_SHARED))) (i32.const 0)))

  ;; ---- sending ----------------------------------------------------------

  ;; Payload is written by the caller at $dpn_tx_buf + $DPL_HDR first.
  (func $dpn_send (param $type i32) (param $dst i32) (param $a i32) (param $b i32)
      (param $len i32)
    (local $wa i32)
    (if (i32.eqz (i32.load offset=72 (global.get $DP_SHARED))) (then (return)))
    (if (i32.gt_u (local.get $len) (global.get $DPL_MAX_PAYLOAD)) (then (return)))
    (local.set $wa (call $g2w (i32.load offset=72 (global.get $DP_SHARED))))
    (i32.store (local.get $wa) (global.get $DPL_MAGIC))
    (i32.store offset=4 (local.get $wa) (local.get $type))
    (i32.store offset=8 (local.get $wa) (global.get $vsock_local_ip))
    (i32.store offset=12 (local.get $wa) (local.get $dst))
    (i32.store offset=16 (local.get $wa) (local.get $a))
    (i32.store offset=20 (local.get $wa) (local.get $b))
    (i32.store offset=24 (local.get $wa) (local.get $len))
    ;; A full wire is a lost datagram, which is what the app asked for.
    (drop (call $host_net_frame_send (local.get $wa)
      (i32.add (global.get $DPL_HDR) (local.get $len)))))

  (func $dpn_payload (result i32)
    (i32.add (i32.load offset=72 (global.get $DP_SHARED)) (global.get $DPL_HDR)))

  (func $dpn_send_peers (param $type i32) (param $a i32) (param $b i32) (param $len i32)
    (local $i i32) (local $ip i32)
    (if (i32.eqz (i32.load offset=76 (global.get $DP_SHARED))) (then (return)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $DPN_PEER_MAX)))
      (local.set $ip (call $gl32 (i32.add (i32.load offset=76 (global.get $DP_SHARED))
        (i32.shl (local.get $i) (i32.const 2)))))
      (if (local.get $ip)
        (then (call $dpn_send (local.get $type) (local.get $ip)
          (local.get $a) (local.get $b) (local.get $len))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan))))

  ;; ---- peers --------------------------------------------------------------

  (func $dpn_peer_slot (param $ip i32) (result i32)
    (local $i i32) (local $slot i32)
    (if (i32.eqz (i32.load offset=76 (global.get $DP_SHARED))) (then (return (i32.const 0))))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $DPN_PEER_MAX)))
      (local.set $slot (i32.add (i32.load offset=76 (global.get $DP_SHARED)) (i32.shl (local.get $i) (i32.const 2))))
      (if (i32.eq (call $gl32 (local.get $slot)) (local.get $ip))
        (then (return (local.get $slot))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  (func $dpn_peer_add (param $ip i32)
    (local $slot i32)
    (if (i32.eqz (local.get $ip)) (then (return)))
    (if (call $dpn_peer_slot (local.get $ip)) (then (return)))
    (local.set $slot (call $dpn_peer_slot (i32.const 0)))
    (if (local.get $slot) (then (call $gs32 (local.get $slot) (local.get $ip)))))

  (func $dpn_peers_clear
    (if (i32.load offset=76 (global.get $DP_SHARED))
      (then (call $zero_memory (call $g2w (i32.load offset=76 (global.get $DP_SHARED)))
        (i32.shl (global.get $DPN_PEER_MAX) (i32.const 2))))))

  ;; ---- name table ---------------------------------------------------------

  (func $dpn_entry (param $i i32) (result i32)
    (i32.add (i32.load offset=8 (global.get $DP_SHARED))
      (i32.mul (local.get $i) (global.get $DP_ENTITY_STRIDE))))

  (func $dpn_is_remote (param $entry i32) (result i32)
    (i32.ne (call $gl32 (i32.add (local.get $entry) (i32.const 52))) (i32.const 0)))

  (func $dpn_player_count (result i32)
    (local $i i32) (local $entry i32) (local $n i32)
    (if (i32.eqz (i32.load offset=8 (global.get $DP_SHARED))) (then (return (i32.const 0))))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $DP_ENTITY_MAX)))
      (local.set $entry (call $dpn_entry (local.get $i)))
      (if (i32.and
            (i32.ne (call $gl32 (i32.add (local.get $entry) (i32.const 20))) (i32.const 0))
            (i32.eq (call $gl32 (i32.add (local.get $entry) (i32.const 4))) (i32.const 1)))
        (then (local.set $n (i32.add (local.get $n) (i32.const 1)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (local.get $n))

  ;; Hand a received message to the session's local players: every one of them
  ;; when $to is zero, otherwise just $to if it lives here.
  (func $dpn_deliver_local (param $from i32) (param $to i32) (param $data i32) (param $size i32)
    (local $i i32) (local $entry i32) (local $event i32)
    (if (i32.eqz (i32.load offset=8 (global.get $DP_SHARED))) (then (return)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $DP_ENTITY_MAX)))
      (local.set $entry (call $dpn_entry (local.get $i)))
      (if (i32.and
            (i32.and
              (i32.ne (call $gl32 (i32.add (local.get $entry) (i32.const 20))) (i32.const 0))
              (i32.eq (call $gl32 (i32.add (local.get $entry) (i32.const 4))) (i32.const 1)))
            (i32.and
              (i32.and
                (i32.eqz (call $dpn_is_remote (local.get $entry)))
                (i32.eq (call $gl32 (i32.add (local.get $entry) (i32.const 44)))
                  (i32.load offset=44 (global.get $DP_SHARED))))
              (i32.or (i32.eqz (local.get $to))
                (i32.eq (call $gl32 (local.get $entry)) (local.get $to)))))
        (then
          (if (call $dp_message_enqueue (i32.load offset=44 (global.get $DP_SHARED)) (local.get $from)
                (call $gl32 (local.get $entry)) (local.get $data) (local.get $size)
                (i32.const 0) (i32.const 1))
            (then
              (local.set $event (call $gl32 (i32.add (local.get $entry) (i32.const 48))))
              (if (local.get $event)
                (then (drop (call $host_set_event (local.get $event)))))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan))))

  ;; DPMSG_CREATEPLAYERORGROUP (48 bytes) from DPID_SYSMSG. The DPNAME points
  ;; into the new entity's own copy of the name, which outlives the message.
  ;; A PLAYER_ADD that carries the owner's IDirectPlay4W short name after the
  ;; 1252 one becomes the remote entity's UTF-16 DPNAME, exactly as stored.
  ;; Without it $dpw_mirror widens the 1252 name on first use.
  (func $dpn_remote_wide_name (param $entry i32) (param $payload i32) (param $len i32)
    (local $w i32) (local $rest i32) (local $tmp i32) (local $name i32) (local $slot i32)
    (local.set $w (i32.add (local.get $payload)
      (i32.add (i32.const 5) (call $guest_strlen (i32.add (local.get $payload) (i32.const 4))))))
    (local.set $rest (i32.sub (i32.add (local.get $payload) (local.get $len)) (local.get $w)))
    (if (i32.or (i32.lt_s (local.get $rest) (i32.const 2))
          (i32.or (i32.and (local.get $rest) (i32.const 1))
            (i32.ne (call $gl16 (i32.sub (i32.add (local.get $payload) (local.get $len)) (i32.const 2)))
              (i32.const 0))))
      (then (return)))
    (local.set $tmp (call $dpn_alloc_zero (i32.const 16)))
    (if (i32.eqz (local.get $tmp)) (then (return)))
    (call $gs32 (local.get $tmp) (i32.const 16))
    (call $gs32 (i32.add (local.get $tmp) (i32.const 8)) (local.get $w))
    (local.set $name (call $dpw_clone_name (local.get $tmp) (i32.const 1)))
    (call $heap_free (local.get $tmp))
    (if (i32.eqz (local.get $name)) (then (return)))
    (call $dpw_forget (local.get $entry))
    (local.set $slot (call $dpw_side (local.get $entry) (i32.const 1)))
    (if (local.get $slot)
      (then (call $gs32 (local.get $slot) (local.get $name)))
      (else (call $dp_free_name (local.get $name)))))

  (func $dpn_sysmsg_create (param $entry i32)
    (local $msg i32) (local $wa i32) (local $name i32)
    (local.set $msg (call $dpn_alloc_zero (i32.const 48)))
    (if (i32.eqz (local.get $msg)) (then (return)))
    (local.set $wa (call $g2w (local.get $msg)))
    (local.set $name (call $gl32 (i32.add (local.get $entry) (i32.const 8))))
    (i32.store (local.get $wa) (i32.const 3))           ;; DPSYS_CREATEPLAYERORGROUP
    (i32.store offset=4 (local.get $wa) (i32.const 1))  ;; DPPLAYERTYPE_PLAYER
    (i32.store offset=8 (local.get $wa) (call $gl32 (local.get $entry)))
    (i32.store offset=12 (local.get $wa) (call $dpn_player_count))
    (i32.store offset=24 (local.get $wa) (i32.const 16))
    (if (local.get $name)
      (then
        (i32.store offset=32 (local.get $wa) (call $gl32 (i32.add (local.get $name) (i32.const 8))))
        (i32.store offset=36 (local.get $wa) (call $gl32 (i32.add (local.get $name) (i32.const 12))))))
    (call $dpn_deliver_local (i32.const 0) (i32.const 0) (local.get $msg) (i32.const 48))
    (call $heap_free (local.get $msg)))

  ;; DPMSG_DESTROYPLAYERORGROUP (52 bytes). The entity is gone by the time
  ;; anyone reads this, so its name pointers are left empty.
  (func $dpn_sysmsg_destroy (param $id i32)
    (local $msg i32) (local $wa i32)
    (local.set $msg (call $dpn_alloc_zero (i32.const 52)))
    (if (i32.eqz (local.get $msg)) (then (return)))
    (local.set $wa (call $g2w (local.get $msg)))
    (i32.store (local.get $wa) (i32.const 5))           ;; DPSYS_DESTROYPLAYERORGROUP
    (i32.store offset=4 (local.get $wa) (i32.const 1))
    (i32.store offset=8 (local.get $wa) (local.get $id))
    (i32.store offset=28 (local.get $wa) (i32.const 16))
    (call $dpn_deliver_local (i32.const 0) (i32.const 0) (local.get $msg) (i32.const 52))
    (call $heap_free (local.get $msg)))

  (func $dpn_sysmsg_session_lost
    (local $msg i32)
    (local.set $msg (call $dpn_alloc_zero (i32.const 4)))
    (if (i32.eqz (local.get $msg)) (then (return)))
    (call $gs32 (local.get $msg) (i32.const 0x31))     ;; DPSYS_SESSIONLOST
    (call $dpn_deliver_local (i32.const 0) (i32.const 0) (local.get $msg) (i32.const 4))
    (call $heap_free (local.get $msg)))

  ;; Enter a player that lives on $ip into the local name table under its own
  ;; id. It belongs to the session object but is not DPPLAYER_LOCAL.
  (func $dpn_add_remote (param $id i32) (param $flags i32) (param $name_str i32)
      (param $ip i32) (result i32)
    (local $dpname i32) (local $entry i32)
    (if (call $dp_find_entity (local.get $id) (i32.const -1)) (then (return (i32.const 0))))
    (local.set $dpname (call $dpn_alloc_zero (i32.const 16)))
    (if (i32.eqz (local.get $dpname)) (then (return (i32.const 0))))
    (call $gs32 (local.get $dpname) (i32.const 16))
    (call $gs32 (i32.add (local.get $dpname) (i32.const 8)) (local.get $name_str))
    (call $gs32 (i32.add (local.get $dpname) (i32.const 12)) (local.get $name_str))
    (local.set $entry (call $dp_alloc_entity (i32.const 1) (local.get $dpname) (i32.const 0)))
    (call $heap_free (local.get $dpname))
    (if (i32.eqz (local.get $entry)) (then (return (i32.const 0))))
    (call $gs32 (local.get $entry) (local.get $id))
    (call $gs32 (i32.add (local.get $entry) (i32.const 12))
      (i32.and (local.get $flags) (i32.const 0xFFFFFFF7)))
    (call $gs32 (i32.add (local.get $entry) (i32.const 44)) (i32.load offset=44 (global.get $DP_SHARED)))
    (call $gs32 (i32.add (local.get $entry) (i32.const 52)) (local.get $ip))
    (local.get $entry))

  (func $dpn_drop_remote (param $id i32) (param $ip i32)
    (local $entry i32)
    (local.set $entry (call $dp_find_entity (local.get $id) (i32.const 1)))
    (if (i32.eqz (local.get $entry)) (then (return)))
    (if (i32.ne (call $gl32 (i32.add (local.get $entry) (i32.const 52))) (local.get $ip))
      (then (return)))
    (drop (call $dp_destroy_entity (local.get $id) (i32.const 1)))
    (call $dpn_sysmsg_destroy (local.get $id)))

  (func $dpn_drop_peer (param $ip i32)
    (local $i i32) (local $entry i32) (local $slot i32)
    (if (i32.load offset=8 (global.get $DP_SHARED))
      (then
        (block $done (loop $scan
          (br_if $done (i32.ge_u (local.get $i) (global.get $DP_ENTITY_MAX)))
          (local.set $entry (call $dpn_entry (local.get $i)))
          (if (i32.and
                (i32.ne (call $gl32 (i32.add (local.get $entry) (i32.const 20))) (i32.const 0))
                (i32.eq (call $gl32 (i32.add (local.get $entry) (i32.const 52))) (local.get $ip)))
            (then (call $dpn_drop_remote (call $gl32 (local.get $entry)) (local.get $ip))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $scan)))))
    (local.set $slot (call $dpn_peer_slot (local.get $ip)))
    (if (local.get $slot) (then (call $gs32 (local.get $slot) (i32.const 0)))))

  ;; PLAYER_ADD for one entity, to one address or (dst 0) every peer.
  (func $dpn_announce (param $entry i32) (param $dst i32) (param $snapshot i32)
    (local $p i32) (local $name i32) (local $str i32) (local $len i32) (local $wlen i32)
    (local.set $p (call $dpn_payload))
    (call $gs32 (local.get $p) (call $gl32 (i32.add (local.get $entry) (i32.const 12))))
    (local.set $name (call $gl32 (i32.add (local.get $entry) (i32.const 8))))
    (if (local.get $name)
      (then (local.set $str (call $gl32 (i32.add (local.get $name) (i32.const 8))))))
    (if (local.get $str)
      (then (local.set $len (call $guest_strlen (local.get $str)))))
    (if (i32.gt_u (local.get $len) (i32.const 255)) (then (local.set $len (i32.const 255))))
    (if (local.get $len)
      (then (call $guest_memmove (i32.add (local.get $p) (i32.const 4)) (local.get $str) (local.get $len))))
    (i32.store8 (call $g2w (i32.add (local.get $p) (i32.add (i32.const 4) (local.get $len)))) (i32.const 0))
    (local.set $len (i32.add (local.get $len) (i32.const 5)))
    ;; A name set through IDirectPlay4W rides along verbatim after the 1252
    ;; one: narrowing is lossy, and a Unicode peer must read back the same
    ;; code units the owner stored (AoE II puts 1252 bytes in its W fields).
    (local.set $str (i32.const 0))
    (local.set $name (call $dpw_side (local.get $entry) (i32.const 0)))
    (if (local.get $name) (then (local.set $name (call $gl32 (local.get $name)))))
    (if (local.get $name)
      (then (local.set $str (call $gl32 (i32.add (local.get $name) (i32.const 8))))))
    (if (local.get $str)
      (then
        (local.set $wlen (i32.mul (call $guest_wcslen (local.get $str)) (i32.const 2)))
        (if (i32.gt_u (local.get $wlen) (i32.const 510)) (then (local.set $wlen (i32.const 510))))
        (call $guest_memmove (i32.add (local.get $p) (local.get $len)) (local.get $str) (local.get $wlen))
        (local.set $len (i32.add (local.get $len) (local.get $wlen)))
        (i32.store16 (call $g2w (i32.add (local.get $p) (local.get $len))) (i32.const 0))
        (local.set $len (i32.add (local.get $len) (i32.const 2)))))
    (if (local.get $dst)
      (then (call $dpn_send (i32.const 5) (local.get $dst)
        (call $gl32 (local.get $entry)) (local.get $snapshot) (local.get $len)))
      (else (call $dpn_send_peers (i32.const 5)
        (call $gl32 (local.get $entry)) (local.get $snapshot) (local.get $len)))))

  ;; ---- hooks called from the IDirectPlay methods ----------------------------

  ;; CreatePlayer succeeded: tell the rest of the session.
  (func $dpn_player_created (param $owner i32) (param $id i32)
    (local $entry i32)
    (if (i32.or (i32.eqz (i32.load offset=40 (global.get $DP_SHARED)))
          (i32.ne (local.get $owner) (i32.load offset=44 (global.get $DP_SHARED))))
      (then (return)))
    (local.set $entry (call $dp_find_entity (local.get $id) (i32.const 1)))
    (if (local.get $entry)
      (then (call $dpn_announce (local.get $entry) (i32.const 0) (i32.const 0)))))

  (func $dpn_player_destroyed (param $owner i32) (param $id i32)
    (if (i32.or (i32.eqz (i32.load offset=40 (global.get $DP_SHARED)))
          (i32.ne (local.get $owner) (i32.load offset=44 (global.get $DP_SHARED))))
      (then (return)))
    (call $dpn_send_peers (i32.const 6) (local.get $id) (i32.const 0) (i32.const 0)))

  ;; PLAYER_DATA: an entity's shared data, to one address or (dst 0) every
  ;; peer. Data past one frame's payload is not sent; DirectPlay's own limit
  ;; is the same order (AoE's lobby record is 740 bytes).
  (func $dpn_send_player_data (param $entry i32) (param $dst i32) (param $snapshot i32)
    (local $data i32) (local $size i32)
    (local.set $data (call $gl32 (i32.add (local.get $entry) (i32.const 24))))
    (local.set $size (call $gl32 (i32.add (local.get $entry) (i32.const 28))))
    (if (i32.or (i32.eqz (local.get $size)) (i32.gt_u (local.get $size) (global.get $DPL_MAX_PAYLOAD)))
      (then (return)))
    (call $guest_memmove (call $dpn_payload) (local.get $data) (local.get $size))
    (if (local.get $dst)
      (then (call $dpn_send (i32.const 9) (local.get $dst)
        (call $gl32 (local.get $entry)) (local.get $snapshot) (local.get $size)))
      (else (call $dpn_send_peers (i32.const 9)
        (call $gl32 (local.get $entry)) (local.get $snapshot) (local.get $size)))))

  ;; SetPlayerData without DPSET_LOCAL on a player of this machine.
  (func $dpn_player_data_changed (param $owner i32) (param $id i32)
    (local $entry i32)
    (if (i32.or (i32.eqz (i32.load offset=40 (global.get $DP_SHARED)))
          (i32.ne (local.get $owner) (i32.load offset=44 (global.get $DP_SHARED))))
      (then (return)))
    (local.set $entry (call $dp_find_entity (local.get $id) (i32.const 1)))
    (if (i32.and (i32.ne (local.get $entry) (i32.const 0))
          (i32.eqz (call $dpn_is_remote (local.get $entry))))
      (then (call $dpn_send_player_data (local.get $entry) (i32.const 0) (i32.const 0)))))

  ;; A remote player's shared data arrived: GetPlayerData reads it from now on,
  ;; and unless it came with the join snapshot (which, as on Win98, is learned
  ;; by reading, not announced) the local players get
  ;; DPMSG_SETPLAYERORGROUPDATA {dwType 0x102, dwPlayerType, dpId, lpData,
  ;; dwDataSize} from DPID_SYSMSG, the data inline after it.
  (func $dpn_receive_player_data (param $id i32) (param $snapshot i32) (param $data i32) (param $size i32)
    (local $entry i32) (local $msg i32) (local $wa i32)
    (local.set $entry (call $dp_find_entity (local.get $id) (i32.const 1)))
    (if (i32.or (i32.eqz (local.get $entry)) (i32.eqz (call $dpn_is_remote (local.get $entry))))
      (then (return)))
    (if (call $dp_replace_data (local.get $entry) (local.get $data) (local.get $size) (i32.const 0))
      (then (return)))
    (if (local.get $snapshot) (then (return)))
    (local.set $msg (call $dpn_alloc_zero (i32.add (i32.const 20) (local.get $size))))
    (if (i32.eqz (local.get $msg)) (then (return)))
    (local.set $wa (call $g2w (local.get $msg)))
    (i32.store (local.get $wa) (i32.const 0x102))        ;; DPSYS_SETPLAYERORGROUPDATA
    (i32.store offset=4 (local.get $wa) (i32.const 1))   ;; DPPLAYERTYPE_PLAYER
    (i32.store offset=8 (local.get $wa) (local.get $id))
    (i32.store offset=16 (local.get $wa) (local.get $size))
    (if (local.get $size)
      (then (call $guest_memmove (i32.add (local.get $msg) (i32.const 20)) (local.get $data) (local.get $size))))
    (call $dpn_deliver_local (i32.const 0) (i32.const 0) (local.get $msg) (i32.add (i32.const 20) (local.get $size)))
    (call $heap_free (local.get $msg)))

  ;; Send from a local player to a player elsewhere, or to everyone (to = 0).
  ;; Returns 1 when the send was fully handled here (remote recipient).
  (func $dpn_send_data (param $owner i32) (param $from i32) (param $to i32)
      (param $data i32) (param $size i32) (result i32)
    (local $target i32)
    (if (i32.or (i32.eqz (i32.load offset=40 (global.get $DP_SHARED)))
          (i32.ne (local.get $owner) (i32.load offset=44 (global.get $DP_SHARED))))
      (then (return (i32.const 0))))
    (if (i32.gt_u (local.get $size) (global.get $DPL_MAX_PAYLOAD))
      (then (return (i32.const 0))))
    (if (local.get $to)
      (then
        (local.set $target (call $dp_find_entity (local.get $to) (i32.const 1)))
        (if (i32.or (i32.eqz (local.get $target))
              (i32.eqz (call $dpn_is_remote (local.get $target))))
          (then (return (i32.const 0))))))
    (if (local.get $size)
      (then (call $guest_memmove (call $dpn_payload) (local.get $data) (local.get $size))))
    (if (local.get $target)
      (then
        (call $dpn_send (i32.const 7)
          (call $gl32 (i32.add (local.get $target) (i32.const 52)))
          (local.get $from) (local.get $to) (local.get $size))
        (return (i32.const 1))))
    (call $dpn_send_peers (i32.const 7) (local.get $from) (i32.const 0) (local.get $size))
    (i32.const 0))

  ;; Close or final Release of the session object.
  (func $dpn_close (param $owner i32)
    (if (i32.or (i32.eqz (i32.load offset=40 (global.get $DP_SHARED)))
          (i32.ne (local.get $owner) (i32.load offset=44 (global.get $DP_SHARED))))
      (then (return)))
    (call $dpn_send_peers (i32.const 8) (i32.const 0) (i32.const 0) (i32.const 0))
    (call $dpn_peers_clear)
    (i32.store offset=40 (global.get $DP_SHARED) (i32.const 0))
    (i32.store offset=48 (global.get $DP_SHARED) (i32.const 0)))

  ;; ---- receiving -----------------------------------------------------------

  ;; One dpl/1 frame, sitting in $vsock_frame_buf. Called from $vsock_pump,
  ;; which commits it afterwards whatever happens here.
  (func $dpn_deliver (param $n i32)
    (local $wa i32) (local $ga i32) (local $type i32) (local $src i32) (local $dst i32)
    (local $a i32) (local $b i32) (local $len i32) (local $payload i32)
    (local $i i32) (local $entry i32) (local $slot i32) (local $free i32)
    (local.set $ga (global.get $vsock_frame_buf))
    (local.set $wa (call $g2w (local.get $ga)))
    (local.set $len (i32.load offset=24 (local.get $wa)))
    (if (i32.ne (local.get $len) (i32.sub (local.get $n) (global.get $DPL_HDR)))
      (then (return)))
    (local.set $type (i32.load offset=4 (local.get $wa)))
    (local.set $src (i32.load offset=8 (local.get $wa)))
    (local.set $dst (i32.load offset=12 (local.get $wa)))
    (local.set $a (i32.load offset=16 (local.get $wa)))
    (local.set $b (i32.load offset=20 (local.get $wa)))
    (local.set $payload (i32.add (local.get $ga) (global.get $DPL_HDR)))
    (if (i32.eq (local.get $src) (global.get $vsock_local_ip)) (then (return)))
    (if (i32.and (i32.ne (local.get $dst) (i32.const -1))
          (i32.ne (local.get $dst) (global.get $vsock_local_ip)))
      (then (return)))

    ;; ENUM_REQ: a host answers for its session.
    (if (i32.eq (local.get $type) (i32.const 1))
      (then
        (if (i32.ne (i32.load offset=40 (global.get $DP_SHARED)) (i32.const 1)) (then (return)))
        (if (i32.ge_u (local.get $len) (i32.const 16))
          (then
            (if (i32.or
                  (i32.or (call $gl32 (local.get $payload))
                    (call $gl32 (i32.add (local.get $payload) (i32.const 4))))
                  (i32.or (call $gl32 (i32.add (local.get $payload) (i32.const 8)))
                    (call $gl32 (i32.add (local.get $payload) (i32.const 12)))))
              (then
                (local.set $i (i32.const 0))
                (block $mismatch (loop $cmp
                  (br_if $mismatch (i32.ge_u (local.get $i) (i32.const 16)))
                  (if (i32.ne (call $gl32 (i32.add (local.get $payload) (local.get $i)))
                        (call $gl32 (i32.add (i32.load offset=80 (global.get $DP_SHARED))
                          (i32.add (i32.const 16) (local.get $i)))))
                    (then (return)))
                  (local.set $i (i32.add (local.get $i) (i32.const 4)))
                  (br $cmp)))))))
        (call $gs32 (i32.add (i32.load offset=80 (global.get $DP_SHARED)) (i32.const 36)) (call $dpn_player_count))
        (call $guest_memmove (call $dpn_payload) (i32.load offset=80 (global.get $DP_SHARED))
          (global.get $DPN_SESSION_SIZE))
        (call $dpn_send (i32.const 2) (local.get $src) (i32.const 0) (i32.const 0)
          (global.get $DPN_SESSION_SIZE))
        (return)))

    ;; ENUM_REPLY: remember the session while a search is running, blocking
    ;; or DPENUMSESSIONS_ASYNC.
    (if (i32.eq (local.get $type) (i32.const 2))
      (then
        (if (i32.eqz (i32.or (i32.load offset=56 (global.get $DP_SHARED)) (i32.load offset=60 (global.get $DP_SHARED)))) (then (return)))
        (if (i32.lt_u (local.get $len) (global.get $DPN_SESSION_NARROW)) (then (return)))
        (if (i32.gt_u (local.get $len) (global.get $DPN_SESSION_SIZE))
          (then (local.set $len (global.get $DPN_SESSION_SIZE))))
        (local.set $i (i32.const 0))
        (block $done (loop $scan
          (br_if $done (i32.ge_u (local.get $i) (global.get $DPN_FOUND_MAX)))
          (local.set $entry (i32.add (i32.load offset=84 (global.get $DP_SHARED))
            (i32.mul (local.get $i) (global.get $DPN_FOUND_STRIDE))))
          (if (call $gl32 (i32.add (local.get $entry) (global.get $DPN_FOUND_LIVE)))
            (then
              (if (i32.and
                    (i32.eq (call $gl32 (local.get $entry)) (call $gl32 (local.get $payload)))
                    (i32.eq (call $gl32 (i32.add (local.get $entry) (i32.const 8)))
                      (call $gl32 (i32.add (local.get $payload) (i32.const 8)))))
                (then (local.set $slot (local.get $entry)))))
            (else (if (i32.eqz (local.get $free)) (then (local.set $free (local.get $entry))))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $scan)))
        (if (i32.eqz (local.get $slot)) (then (local.set $slot (local.get $free))))
        (if (i32.eqz (local.get $slot)) (then (return)))
        (call $zero_memory (call $g2w (local.get $slot)) (global.get $DPN_SESSION_SIZE))
        (call $guest_memmove (local.get $slot) (local.get $payload) (local.get $len))
        ;; The names are ours to terminate, whatever the sender put there.
        (i32.store8 (call $g2w (i32.add (local.get $slot) (i32.const 75))) (i32.const 0))
        (i32.store16 (call $g2w (i32.add (local.get $slot)
          (i32.sub (global.get $DPN_SESSION_SIZE) (i32.const 2)))) (i32.const 0))
        (call $gs32 (i32.add (local.get $slot) (global.get $DPN_FOUND_LIVE)) (i32.const 1))
        (return)))

    ;; JOIN_REQ: admit the peer and send it the name table.
    (if (i32.eq (local.get $type) (i32.const 3))
      (then
        (if (i32.ne (i32.load offset=40 (global.get $DP_SHARED)) (i32.const 1)) (then (return)))
        (if (i32.lt_u (local.get $len) (i32.const 16)) (then (return)))
        (if (i32.or
              (i32.ne (call $gl32 (local.get $payload)) (call $gl32 (i32.load offset=80 (global.get $DP_SHARED))))
              (i32.ne (call $gl32 (i32.add (local.get $payload) (i32.const 8)))
                (call $gl32 (i32.add (i32.load offset=80 (global.get $DP_SHARED)) (i32.const 8)))))
          (then (return)))
        (call $dpn_peer_add (local.get $src))
        (call $dpn_send (i32.const 4) (local.get $src) (i32.const 0) (i32.const 0) (i32.const 0))
        (if (i32.eqz (i32.load offset=8 (global.get $DP_SHARED))) (then (return)))
        (local.set $i (i32.const 0))
        (block $done (loop $scan
          (br_if $done (i32.ge_u (local.get $i) (global.get $DP_ENTITY_MAX)))
          (local.set $entry (call $dpn_entry (local.get $i)))
          (if (i32.and
                (i32.and
                  (i32.ne (call $gl32 (i32.add (local.get $entry) (i32.const 20))) (i32.const 0))
                  (i32.eq (call $gl32 (i32.add (local.get $entry) (i32.const 4))) (i32.const 1)))
                (i32.ne (call $gl32 (i32.add (local.get $entry) (i32.const 52))) (local.get $src)))
            (then
              (call $dpn_announce (local.get $entry) (local.get $src) (i32.const 1))
              (call $dpn_send_player_data (local.get $entry) (local.get $src) (i32.const 1))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $scan)))
        (return)))

    ;; JOIN_ACK: the parked Open can return.
    (if (i32.eq (local.get $type) (i32.const 4))
      (then
        (if (i32.and (i32.eq (i32.load offset=40 (global.get $DP_SHARED)) (i32.const 2))
              (i32.eq (local.get $src) (i32.load offset=48 (global.get $DP_SHARED))))
          (then
            (call $dpn_peer_add (local.get $src))
            (i32.store offset=40 (global.get $DP_SHARED) (i32.const 3))))
        (return)))

    ;; Everything below belongs to an established session with this peer.
    (if (i32.or (i32.lt_u (i32.load offset=40 (global.get $DP_SHARED)) (i32.const 1))
          (i32.eqz (call $dpn_peer_slot (local.get $src))))
      (then (return)))

    (if (i32.eq (local.get $type) (i32.const 5))
      (then
        (if (i32.lt_u (local.get $len) (i32.const 5)) (then (return)))
        (i32.store8 (i32.add (local.get $wa) (i32.sub (local.get $n) (i32.const 1))) (i32.const 0))
        (local.set $entry (call $dpn_add_remote (local.get $a)
          (call $gl32 (local.get $payload))
          (i32.add (local.get $payload) (i32.const 4)) (local.get $src)))
        (if (local.get $entry)
          (then (call $dpn_remote_wide_name (local.get $entry) (local.get $payload) (local.get $len))))
        ;; Players already in the session when we joined are learned by
        ;; enumeration, as on Win98; only arrivals are announced.
        (if (i32.and (i32.ne (local.get $entry) (i32.const 0)) (i32.eqz (local.get $b)))
          (then (call $dpn_sysmsg_create (local.get $entry))))
        (return)))

    (if (i32.eq (local.get $type) (i32.const 6))
      (then (call $dpn_drop_remote (local.get $a) (local.get $src)) (return)))

    (if (i32.eq (local.get $type) (i32.const 9))
      (then
        (call $dpn_receive_player_data (local.get $a) (local.get $b)
          (local.get $payload) (local.get $len))
        (return)))

    (if (i32.eq (local.get $type) (i32.const 7))
      (then
        (call $dpn_deliver_local (local.get $a) (local.get $b)
          (select (local.get $payload) (i32.const 0) (local.get $len)) (local.get $len))
        (return)))

    (if (i32.eq (local.get $type) (i32.const 8))
      (then (call $dpn_peer_gone (local.get $src)) (return))))

  ;; A peer's session is gone: it said LEAVE, or its link closed without a
  ;; word (a vln/1 GONE frame, 09d-winsock.wat; $ip -1 means every remote
  ;; address at once). Its players leave the name table, and a joiner whose
  ;; host was among them has lost the session.
  (func $dpn_peer_gone (param $ip i32)
    (local $i i32) (local $peer i32)
    (if (i32.eqz (i32.load offset=36 (global.get $DP_SHARED))) (then (return)))
    (if (i32.eq (local.get $ip) (i32.const -1))
      (then
        (if (i32.load offset=76 (global.get $DP_SHARED))
          (then
            (block $done (loop $scan
              (br_if $done (i32.ge_u (local.get $i) (global.get $DPN_PEER_MAX)))
              (local.set $peer (call $gl32 (i32.add (i32.load offset=76 (global.get $DP_SHARED))
                (i32.shl (local.get $i) (i32.const 2)))))
              (if (local.get $peer) (then (call $dpn_drop_peer (local.get $peer))))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $scan)))))
        (if (i32.load offset=48 (global.get $DP_SHARED)) (then (call $dpn_drop_peer (i32.load offset=48 (global.get $DP_SHARED))))))
      (else (call $dpn_drop_peer (local.get $ip))))
    (if (i32.and (i32.eq (i32.load offset=40 (global.get $DP_SHARED)) (i32.const 3))
          (i32.or (i32.eq (local.get $ip) (i32.const -1))
                  (i32.eq (local.get $ip) (i32.load offset=48 (global.get $DP_SHARED)))))
      (then
        (call $dpn_sysmsg_session_lost)
        (i32.store offset=40 (global.get $DP_SHARED) (i32.const 0)))))

  ;; ---- Open ----------------------------------------------------------------

  ;; Open(lpsd, dwFlags): the stdcall frame is already popped. Returns the
  ;; HRESULT, or -1 when the call parked and must not write EAX. $wide: the
  ;; caller is IDirectPlay4W, so lpsd->lpszSessionName is UTF-16; the session
  ;; table and the wire keep the established 1252 bytes either way.
  (func $dpn_open (param $owner i32) (param $desc i32) (param $flags i32) (param $wide i32) (result i32)
    (local $session i32) (local $name i32) (local $len i32) (local $i i32) (local $c i32)
    (if (i32.eqz (local.get $desc)) (then (return (i32.const 0x80070057))))
    ;; Re-entry of a parked join.
    (if (i32.load offset=64 (global.get $DP_SHARED))
      (then
        (call $dpn_poll)
        (if (i32.eq (i32.load offset=40 (global.get $DP_SHARED)) (i32.const 3))
          (then (i32.store offset=64 (global.get $DP_SHARED) (i32.const 0)) (return (i32.const 0))))
        (if (i32.or (i32.ne (i32.load offset=40 (global.get $DP_SHARED)) (i32.const 2)) (call $dpn_deadline_passed))
          (then
            (i32.store offset=64 (global.get $DP_SHARED) (i32.const 0))
            (i32.store offset=40 (global.get $DP_SHARED) (i32.const 0))
            (call $dpn_peers_clear)
            (return (i32.const 0x887700AA)))) ;; DPERR_NOCONNECTION
        (call $vsock_block (i32.const 16))
        (return (i32.const -1))))
    ;; Hosting or joining is the first moment this app needs the room, so it
    ;; is where a host that asks the person which room to join gets to ask.
    (if (i32.eqz (call $host_net_link_open
          (select (i32.const 2) (i32.const 3) (i32.and (local.get $flags) (i32.const 2))))) ;; DPOPEN_CREATE
      (then (call $vsock_block (i32.const 16)) (return (i32.const -1))))
    (if (i32.eqz (call $dpn_activate (local.get $owner)))
      (then (return (i32.const 0x8007000E))))
    (local.set $session (i32.load offset=80 (global.get $DP_SHARED)))
    (if (i32.and (local.get $flags) (i32.const 2)) ;; DPOPEN_CREATE
      (then
        (call $zero_memory (call $g2w (local.get $session)) (global.get $DPN_SESSION_SIZE))
        (i32.store offset=68 (global.get $DP_SHARED) (i32.add (i32.load offset=68 (global.get $DP_SHARED)) (i32.const 1)))
        (call $gs32 (local.get $session) (global.get $vsock_local_ip))
        (call $gs32 (i32.add (local.get $session) (i32.const 4)) (global.get $DPN_GUID_TAG))
        (call $gs32 (i32.add (local.get $session) (i32.const 8)) (i32.load offset=68 (global.get $DP_SHARED)))
        (call $guest_memmove (i32.add (local.get $session) (i32.const 16))
          (i32.add (local.get $desc) (i32.const 24)) (i32.const 16))
        (call $gs32 (i32.add (local.get $session) (i32.const 32))
          (call $gl32 (i32.add (local.get $desc) (i32.const 40))))
        (call $gs32 (i32.add (local.get $session) (i32.const 40))
          (call $gl32 (i32.add (local.get $desc) (i32.const 4))))
        (local.set $name (call $gl32 (i32.add (local.get $desc) (i32.const 48))))
        (if (i32.and (i32.ne (local.get $name) (i32.const 0)) (i32.eqz (local.get $wide)))
          (then
            (local.set $len (call $guest_strlen (local.get $name)))
            (if (i32.gt_u (local.get $len) (i32.const 31)) (then (local.set $len (i32.const 31))))
            (call $guest_memmove (i32.add (local.get $session) (i32.const 44))
              (local.get $name) (local.get $len))))
        (if (i32.and (i32.ne (local.get $name) (i32.const 0)) (i32.ne (local.get $wide) (i32.const 0)))
          (then
            (block $narrowed (loop $narrow
              (br_if $narrowed (i32.ge_u (local.get $i) (i32.const 31)))
              (local.set $c (call $gl16 (i32.add (local.get $name) (i32.shl (local.get $i) (i32.const 1)))))
              (br_if $narrowed (i32.eqz (local.get $c)))
              (call $gs8 (i32.add (i32.add (local.get $session) (i32.const 44)) (local.get $i))
                (call $dpw_encode1252 (local.get $c)))
              (call $gs16 (i32.add (i32.add (local.get $session) (global.get $DPN_SESSION_WNAME))
                (i32.shl (local.get $i) (i32.const 1))) (local.get $c))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $narrow)))))
        ;; The app reads its own session back through the descriptor.
        (call $guest_memmove (i32.add (local.get $desc) (i32.const 8)) (local.get $session)
          (i32.const 16))
        (call $dpn_peers_clear)
        (i32.store offset=44 (global.get $DP_SHARED) (local.get $owner))
        (i32.store offset=40 (global.get $DP_SHARED) (i32.const 1))
        (return (i32.const 0))))
    ;; DPOPEN_JOIN: only sessions this provider handed out can be joined.
    (if (i32.ne (call $gl32 (i32.add (local.get $desc) (i32.const 12)))
          (global.get $DPN_GUID_TAG))
      (then (return (i32.const 0x887700AA))))
    (call $guest_memmove (local.get $session) (i32.add (local.get $desc) (i32.const 8))
      (i32.const 16))
    ;; Keep the whole record the search heard (name, limits, flags), so the
    ;; joined side's GetSessionDesc describes the same session as the host's.
    (local.set $i (i32.const 0))
    (block $found (loop $look
      (br_if $found (i32.ge_u (local.get $i) (global.get $DPN_FOUND_MAX)))
      (local.set $c (i32.add (i32.load offset=84 (global.get $DP_SHARED)) (i32.mul (local.get $i) (global.get $DPN_FOUND_STRIDE))))
      (if (i32.and
            (i32.and (i32.ne (call $gl32 (i32.add (local.get $c) (global.get $DPN_FOUND_LIVE))) (i32.const 0))
              (i32.eq (call $gl32 (local.get $c)) (call $gl32 (local.get $session))))
            (i32.eq (call $gl32 (i32.add (local.get $c) (i32.const 8)))
              (call $gl32 (i32.add (local.get $session) (i32.const 8)))))
        (then
          (call $guest_memmove (local.get $session) (local.get $c) (global.get $DPN_SESSION_SIZE))
          (br $found)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $look)))
    (call $dpn_peers_clear)
    (i32.store offset=44 (global.get $DP_SHARED) (local.get $owner))
    (i32.store offset=48 (global.get $DP_SHARED) (call $gl32 (i32.add (local.get $desc) (i32.const 8))))
    (i32.store offset=40 (global.get $DP_SHARED) (i32.const 2))
    (i32.store offset=52 (global.get $DP_SHARED) (i32.add (call $host_get_ticks) (i32.const 10000)))
    (call $guest_memmove (call $dpn_payload) (local.get $session) (i32.const 16))
    (call $dpn_send (i32.const 3) (i32.load offset=48 (global.get $DP_SHARED)) (i32.const 0) (i32.const 0)
      (i32.const 16))
    (i32.store offset=64 (global.get $DP_SHARED) (i32.const 1))
    (call $vsock_block (i32.const 16))
    (i32.const -1))

  ;; ---- GetSessionDesc --------------------------------------------------------

  ;; GetSessionDesc(lpData, lpdwDataSize): the session this instance hosts or
  ;; joined, as a DPSESSIONDESC2 with its name stored right after it (1252
  ;; bytes, or UTF-16 for IDirectPlay4W). A NULL or short buffer gets the size
  ;; it needs and DPERR_BUFFERTOOSMALL -- the size probe Age of Empires II
  ;; allocates from, so a size left unwritten became a SmartHeap out-of-memory.
  ;; Units in a session record's own UTF-16 name; 0 when an ANSI host made it.
  (func $dpn_wname_len (param $record i32) (result i32)
    (local $n i32)
    (block $done (loop $count
      (br_if $done (i32.ge_u (local.get $n) (i32.const 31)))
      (br_if $done (i32.eqz (call $gl16 (i32.add (i32.add (local.get $record) (global.get $DPN_SESSION_WNAME))
        (i32.shl (local.get $n) (i32.const 1))))))
      (local.set $n (i32.add (local.get $n) (i32.const 1)))
      (br $count)))
    (local.get $n))

  ;; A session record's name as UTF-16 at $out (32 units of room): the host's
  ;; own units when it gave them, else the 1252 name widened.
  (func $dpn_put_wname (param $record i32) (param $out i32)
    (local $n i32) (local $j i32) (local $c i32)
    (local.set $n (call $dpn_wname_len (local.get $record)))
    (block $copied (loop $copy
      (br_if $copied (i32.ge_u (local.get $j) (i32.const 31)))
      (local.set $c (if (result i32) (local.get $n)
        (then (if (result i32) (i32.lt_u (local.get $j) (local.get $n))
          (then (call $gl16 (i32.add (i32.add (local.get $record) (global.get $DPN_SESSION_WNAME))
            (i32.shl (local.get $j) (i32.const 1)))))
          (else (i32.const 0))))
        (else (call $dpw_decode1252 (call $gl8 (i32.add (i32.add (local.get $record) (i32.const 44)) (local.get $j)))))))
      (br_if $copied (i32.eqz (local.get $c)))
      (call $gs16 (i32.add (local.get $out) (i32.shl (local.get $j) (i32.const 1))) (local.get $c))
      (local.set $j (i32.add (local.get $j) (i32.const 1)))
      (br $copy)))
    (call $gs16 (i32.add (local.get $out) (i32.shl (local.get $j) (i32.const 1))) (i32.const 0)))

  (func $dpn_get_session_desc (param $data i32) (param $size_ptr i32) (param $wide i32) (result i32)
    (local $session i32) (local $len i32) (local $need i32) (local $i i32) (local $c i32) (local $name i32)
    (if (i32.eqz (local.get $size_ptr)) (then (return (i32.const 0x80070057))))
    (if (i32.or (i32.eqz (i32.load offset=80 (global.get $DP_SHARED)))
          (i32.and (i32.ne (i32.load offset=40 (global.get $DP_SHARED)) (i32.const 1)) (i32.ne (i32.load offset=40 (global.get $DP_SHARED)) (i32.const 3))))
      (then (return (i32.const 0x887700AA)))) ;; DPERR_NOCONNECTION
    (local.set $session (i32.load offset=80 (global.get $DP_SHARED)))
    (local.set $len (i32.const 0))
    (block $measured (loop $measure
      (br_if $measured (i32.ge_u (local.get $len) (i32.const 31)))
      (br_if $measured (i32.eqz (call $gl8 (i32.add (i32.add (local.get $session) (i32.const 44)) (local.get $len)))))
      (local.set $len (i32.add (local.get $len) (i32.const 1)))
      (br $measure)))
    (if (i32.and (i32.ne (local.get $wide) (i32.const 0))
          (i32.ne (call $dpn_wname_len (local.get $session)) (i32.const 0)))
      (then (local.set $len (call $dpn_wname_len (local.get $session)))))
    (local.set $need (i32.add (i32.const 80)
      (i32.shl (i32.add (local.get $len) (i32.const 1)) (select (i32.const 1) (i32.const 0) (local.get $wide)))))
    (if (i32.or (i32.eqz (local.get $data)) (i32.lt_u (call $gl32 (local.get $size_ptr)) (local.get $need)))
      (then (call $gs32 (local.get $size_ptr) (local.get $need)) (return (i32.const 0x8877001E)))) ;; DPERR_BUFFERTOOSMALL
    (call $gs32 (local.get $size_ptr) (local.get $need))
    (call $zero_memory (call $g2w (local.get $data)) (i32.const 80))
    (call $gs32 (local.get $data) (i32.const 80))
    (call $gs32 (i32.add (local.get $data) (i32.const 4)) (call $gl32 (i32.add (local.get $session) (i32.const 40))))
    (call $guest_memmove (i32.add (local.get $data) (i32.const 8)) (local.get $session) (i32.const 32))
    (call $gs32 (i32.add (local.get $data) (i32.const 40)) (call $gl32 (i32.add (local.get $session) (i32.const 32))))
    (call $gs32 (i32.add (local.get $data) (i32.const 44)) (call $dpn_player_count))
    (local.set $name (i32.add (local.get $data) (i32.const 80)))
    (call $gs32 (i32.add (local.get $data) (i32.const 48)) (local.get $name))
    (if (local.get $wide)
      (then (call $dpn_put_wname (local.get $session) (local.get $name)) (return (i32.const 0))))
    (block $copied (loop $copy
      (local.set $c (if (result i32) (i32.lt_u (local.get $i) (local.get $len))
        (then (call $gl8 (i32.add (i32.add (local.get $session) (i32.const 44)) (local.get $i))))
        (else (i32.const 0))))
      (call $gs8 (i32.add (local.get $name) (local.get $i)) (local.get $c))
      (br_if $copied (i32.ge_u (local.get $i) (local.get $len)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $copy)))
    (i32.const 0))

  ;; ---- EnumSessions ----------------------------------------------------------

  ;; Stack frame left under the callback, found by CACA0011 at ESP on return:
  ;; +0 'DPES', +4 caller return, +8 callback, +12 context, +16 next index
  ;; (0x100 once the DPESC_TIMEDOUT call has been made), +20 nonzero when the
  ;; caller is IDirectPlay4W and wants UTF-16 session names.
  (global $DPES_FRAME i32 (i32.const 32))

  ;; EnumSessions(lpsd, dwTimeout, callback, context, dwFlags). The stdcall
  ;; frame (28 bytes) is still on the stack. Broadcasts, parks until the
  ;; timeout, then calls back once per session heard and once more with
  ;; DPESC_TIMEDOUT, as the Win98 provider does.
  (func $dpn_enum_sessions (param $desc i32) (param $timeout i32) (param $callback i32)
      (param $context i32) (param $flags i32) (param $wide i32)
    (local $ret_addr i32) (local $frame i32)
    (local.set $ret_addr (call $gl32 (i32.load offset=16 (global.get $reg_base))))
    (if (i32.eqz (i32.load offset=56 (global.get $DP_SHARED)))
      (then
        (i32.store offset=16 (global.get $reg_base)
          (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
        ;; DPENUMSESSIONS_STOPASYNC is 0x20 (dplay.h: AVAILABLE 1, ALL 2,
        ;; ASYNC 0x10, STOPASYNC 0x20, PASSWORDREQUIRED 0x40, RETURNSTATUS
        ;; 0x80). It was tested as 0x4, a bit no caller sets, so a real stop
        ;; fell through to a synchronous search -- and with the NULL callback
        ;; a stop passes, came back E_INVALIDARG.
        (if (i32.and (local.get $flags) (i32.const 0x20))
          (then
            (i32.store offset=60 (global.get $DP_SHARED) (i32.const 0))
            (i32.store offset=0 (global.get $reg_base) (i32.const 0)) (return)))
        (if (i32.eqz (local.get $callback))
          (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x80070057)) (return)))
        ;; Same as the Open path: searching for a game is a networked act, and
        ;; the host may still be asking the person which room to search.
        (if (i32.eqz (call $host_net_link_open (i32.const 4)))
          (then (call $vsock_block (i32.const 28)) (return)))
        (if (i32.eqz (call $dpn_activate (i32.const 0)))
          (then (i32.store offset=0 (global.get $reg_base) (i32.const 0x8007000E)) (return)))
        ;; DPENUMSESSIONS_ASYNC: return at once, reporting the sessions heard
        ;; so far, while the search goes on. Age of Empires II polls this way
        ;; from its UI loop; blocking each call for its timeout and wiping the
        ;; cache every time left its LAN game list at "Looking for games...".
        (if (i32.and (local.get $flags) (i32.const 0x10))
          (then
            (if (i32.eqz (i32.load offset=60 (global.get $DP_SHARED)))
              (then
                (call $zero_memory (call $g2w (i32.load offset=84 (global.get $DP_SHARED)))
                  (i32.mul (global.get $DPN_FOUND_MAX) (global.get $DPN_FOUND_STRIDE)))
                (i32.store offset=60 (global.get $DP_SHARED) (i32.const 1))))
            (call $zero_memory (call $g2w (call $dpn_payload)) (i32.const 16))
            (if (local.get $desc)
              (then (call $guest_memmove (call $dpn_payload)
                (i32.add (local.get $desc) (i32.const 24)) (i32.const 16))))
            (call $dpn_send (i32.const 1) (i32.const -1) (i32.const 0) (i32.const 0) (i32.const 16))
            (call $vsock_pump)
            (if (i32.or (i32.eqz (local.get $timeout)) (i32.gt_u (local.get $timeout) (i32.const 5000)))
              (then (local.set $timeout (i32.const 1500))))
            (call $gs32 (i32.load offset=92 (global.get $DP_SHARED)) (local.get $timeout))
            (call $dpn_enum_report (local.get $ret_addr) (local.get $callback) (local.get $context) (local.get $wide))
            (return)))
        (call $zero_memory (call $g2w (i32.load offset=84 (global.get $DP_SHARED)))
          (i32.mul (global.get $DPN_FOUND_MAX) (global.get $DPN_FOUND_STRIDE)))
        (call $zero_memory (call $g2w (call $dpn_payload)) (i32.const 16))
        (if (local.get $desc)
          (then (call $guest_memmove (call $dpn_payload)
            (i32.add (local.get $desc) (i32.const 24)) (i32.const 16))))
        (call $dpn_send (i32.const 1) (i32.const -1) (i32.const 0) (i32.const 0) (i32.const 16))
        (i32.store offset=56 (global.get $DP_SHARED) (i32.const 1))
        ;; Zero asks for the provider default; a few seconds is plenty on a
        ;; wire whose round trip is one host event-loop turn.
        (if (i32.or (i32.eqz (local.get $timeout)) (i32.gt_u (local.get $timeout) (i32.const 5000)))
          (then (local.set $timeout (i32.const 1500))))
        (i32.store offset=52 (global.get $DP_SHARED) (i32.add (call $host_get_ticks) (local.get $timeout)))
        (call $gs32 (i32.load offset=92 (global.get $DP_SHARED)) (local.get $timeout))
        (call $vsock_block (i32.const 28))
        (return)))
    (call $vsock_pump)
    (if (i32.eqz (call $dpn_deadline_passed))
      (then (call $vsock_block (i32.const 0)) (return)))
    (i32.store offset=56 (global.get $DP_SHARED) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base)
      (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)))
    (call $dpn_enum_report (local.get $ret_addr) (local.get $callback) (local.get $context) (local.get $wide)))

  ;; Report the found-session table to the caller's callback (one call per
  ;; session, then DPESC_TIMEDOUT) from a DPES frame under the popped stdcall
  ;; frame. Shared by the synchronous path at its deadline and by ASYNC.
  (func $dpn_enum_report (param $ret_addr i32) (param $callback i32) (param $context i32) (param $wide i32)
    (local $frame i32)
    (local.set $frame (i32.sub (i32.load offset=16 (global.get $reg_base)) (global.get $DPES_FRAME)))
    (call $zero_memory (call $g2w (local.get $frame)) (global.get $DPES_FRAME))
    (call $gs32 (local.get $frame) (i32.const 0x53455044)) ;; 'DPES'
    (call $gs32 (i32.add (local.get $frame) (i32.const 4)) (local.get $ret_addr))
    (call $gs32 (i32.add (local.get $frame) (i32.const 8)) (local.get $callback))
    (call $gs32 (i32.add (local.get $frame) (i32.const 12)) (local.get $context))
    (call $gs32 (i32.add (local.get $frame) (i32.const 20)) (local.get $wide))
    (i32.store offset=16 (global.get $reg_base) (local.get $frame))
    (i32.store offset=0 (global.get $reg_base) (i32.const 1))
    (call $dpn_enum_sessions_continue))

  (func $dpn_enum_sessions_call (param $frame i32) (param $desc i32) (param $flags i32)
    (local $sp i32)
    ;; callback(lpThisSD, lpdwTimeOut, dwFlags, lpContext), right-to-left.
    (local.set $sp (i32.sub (local.get $frame) (i32.const 20)))
    (call $gs32 (local.get $sp) (global.get $font_enum_ret_thunk))
    (call $gs32 (i32.add (local.get $sp) (i32.const 4)) (local.get $desc))
    (call $gs32 (i32.add (local.get $sp) (i32.const 8)) (i32.load offset=92 (global.get $DP_SHARED)))
    (call $gs32 (i32.add (local.get $sp) (i32.const 12)) (local.get $flags))
    (call $gs32 (i32.add (local.get $sp) (i32.const 16))
      (call $gl32 (i32.add (local.get $frame) (i32.const 12))))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (global.set $eip (call $gl32 (i32.add (local.get $frame) (i32.const 8))))
    (global.set $steps (i32.const 0)))

  (func $dpn_enum_sessions_continue
    (local $frame i32) (local $i i32) (local $entry i32) (local $desc i32)
    (local.set $frame (i32.load offset=16 (global.get $reg_base)))
    (local.set $i (call $gl32 (i32.add (local.get $frame) (i32.const 16))))
    (if (i32.and (i32.ne (i32.load offset=0 (global.get $reg_base)) (i32.const 0))
          (i32.lt_u (local.get $i) (i32.const 0x100)))
      (then
        (block $done (loop $scan
          (br_if $done (i32.ge_u (local.get $i) (global.get $DPN_FOUND_MAX)))
          (local.set $entry (i32.add (i32.load offset=84 (global.get $DP_SHARED))
            (i32.mul (local.get $i) (global.get $DPN_FOUND_STRIDE))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (call $gs32 (i32.add (local.get $frame) (i32.const 16)) (local.get $i))
          (if (call $gl32 (i32.add (local.get $entry) (global.get $DPN_FOUND_LIVE)))
            (then
              (local.set $desc (i32.load offset=88 (global.get $DP_SHARED)))
              (call $zero_memory (call $g2w (local.get $desc)) (i32.const 80))
              (call $gs32 (local.get $desc) (i32.const 80))
              (call $gs32 (i32.add (local.get $desc) (i32.const 4))
                (call $gl32 (i32.add (local.get $entry) (i32.const 40))))
              (call $guest_memmove (i32.add (local.get $desc) (i32.const 8))
                (local.get $entry) (i32.const 32))
              (call $gs32 (i32.add (local.get $desc) (i32.const 40))
                (call $gl32 (i32.add (local.get $entry) (i32.const 32))))
              (call $gs32 (i32.add (local.get $desc) (i32.const 44))
                (call $gl32 (i32.add (local.get $entry) (i32.const 36))))
              (call $gs32 (i32.add (local.get $desc) (i32.const 48))
                (i32.add (local.get $entry) (i32.const 44)))
              (if (call $gl32 (i32.add (local.get $frame) (i32.const 20)))
                (then
                  ;; IDirectPlay4W: hand the callback a UTF-16 copy of the name.
                  (call $dpn_put_wname (local.get $entry) (i32.add (local.get $desc) (i32.const 80)))
                  (call $gs32 (i32.add (local.get $desc) (i32.const 48))
                    (i32.add (local.get $desc) (i32.const 80)))))
              (call $dpn_enum_sessions_call (local.get $frame) (local.get $desc) (i32.const 0))
              (return)))
          (br $scan)))
        ;; Every session reported: the closing DPESC_TIMEDOUT call.
        (call $gs32 (i32.add (local.get $frame) (i32.const 16)) (i32.const 0x100))
        (call $dpn_enum_sessions_call (local.get $frame) (i32.const 0) (i32.const 1))
        (return)))
    (global.set $eip (call $gl32 (i32.add (local.get $frame) (i32.const 4))))
    (i32.store offset=16 (global.get $reg_base)
      (i32.add (local.get $frame) (global.get $DPES_FRAME)))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0)))
