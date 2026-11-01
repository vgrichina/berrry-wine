# Dark Reign 2 demo

Source: [Internet Archive demo](https://archive.org/details/DarkReign2Demo),
`DarkReign2.zip`, 34,477,173 bytes, SHA-1
`0e58ef5409e5ba006e072633083b2354b7e8e1a8`.
The game log identifies build 873, dated August 16, 2000.
Distinct from the registered first Dark Reign game; not yet registered here.

Static extraction uses `7z x DarkReign2.zip`, then
`unshield -d extracted x archive/data1.cab`. The InstallShield set includes
`data1.hdr` and `data2.cab`; keep them beside `data1.cab`. The game's root is
`extracted/Files`, containing `dr2.exe`, Bink/Miles DLLs, and the mission,
world, side and base `.zwp` packs. The installer is not executed.

The bundled licence grants personal use and restricts distribution and
disassembly. Keep this an ignored private compatibility fixture; do not
publish assets. This investigation uses runtime logs/API observations only.

## Initial startup gate

On main `274902b02`, boat `bx_k7xdfrq9`:

```sh
node test/run.js --exe=/home/user/dark-reign2-demo-preflight/extracted/Files/dr2.exe \
  '--vfs-include=**/*' --quiet-api --batch-size=100000 \
  --max-seconds=20 --max-batches=30 \
  --save-vfs=/home/user/dark-reign2-demo-preflight/saved --save-vfs-suffix=.log
```

The final `dr2.log` is more useful than the secondary NULL-call crash after
the error handler exits. It rejects HAL and RGB devices for lacking floating
point transformed vertices; RGB also lacks the DrawPrimitive capability.
It then raises `0xe0000002` with “Can't start hardware accelerated DirectX 7.0.”
No menu or gameplay is reached. Exporting the log at batch 7 is too early;
use the final VFS export above.

The advertised HAL mask `0x8aea0` omits `D3DDEVCAPS_FLOATTLVERTEX` (`0x1`).
HEL mask `0x2a50` also omits `D3DDEVCAPS_DRAWPRIMTLVERTEX` (`0x400`), despite
the existing float-TL DrawPrimitive implementation. The constants are in
[Wine's Direct3D caps header](https://github.com/wine-mirror/wine/blob/master/include/d3dcaps.h).
Descriptor correction adds only those supported capability bits: HAL becomes
`0x8aea1`, HEL `0x2e51`, across legacy enumeration, D3D7 enumeration and device
GetCaps. The extended enumeration regression fails old code and passes the
fix, including nested callbacks and allocation/stack lifetime checks. Full
build, real vertex-buffer rasterization (900 indexed pixels), and the twelve
DrawPrimitive handler-arity checks pass on the temporary boat.

The fixed ordinary launch passes the hardware gate, initializes digital
audio services, finds three missions and logs in the default user. It then
shows a fatal dialog because `GetProcAddress(ws2_32, "WSAConnect")` fails.
This is the next actionable API implementation; no menu/gameplay claim.
The final game log captures the primary error. A Miles worker later exits
through NULL during shutdown; do not mistake that secondary event for the
startup blocker.

Evidence: `scratch/runs/20261011T2102Z-dark-reign2-preflight/`. The title has
no manifest candidate yet, so no result is attached to another game's card.
The first fixture also lacks `test/binaries/dlls/shell32.dll` and
`test/binaries/dlls/msvcrt.dll`; dbghelp reports failed symbol initialization.
The explicit device-rejection log is the current primary lead.

## WSAConnect implemented; event notification is next

The virtual TCP provider now exposes `WSAConnect`, sharing the existing
connection implementation with `connect`. Each entrypoint supplies its own
stack-frame size, so blocking retries preserve all seven WSAConnect arguments.
Successful TCP connections report zero callee-data bytes. Unsupported connection
data and QoS requests return provider errors; reserved group QoS is rejected.
Datagram connect is not implemented by this TCP path and returns an unsupported
operation error. This is not a claim of complete Winsock 2 support.

The old tree fails the name-resolution regression; the fixed full build and
all 50 Winsock checks pass, including TCP establishment, already-connected
errors, provider errors and three consecutive blocking retry stack checks.
Existing fragmented session and async-select tests also pass.

Ordinary replay now resolves WSAConnect and stops at the next missing symbol:
`WSAEnumNetworkEvents` in `ws2_32.dll` (`win32_socket.cpp:1796`). The fatal dialog
and final game log are recorded in
`scratch/runs/20261011T2115Z-dark-reign2-wsaconnect/`. Implement event selection,
latched network-event/error reporting and event reset semantics together;
do not add a silent empty-events stub to get past the lookup. No menu or
gameplay is qualified yet.

## Notification lifetime prerequisite

The event API audit found that `closesocket` freed the socket slot but left
its process-shared WSAAsyncSelect registration behind. A new TCP socket using
that index could post FD_READ to the previous owner's window after a partial
receive. The regression exercises close, slot reuse, a new TCP connection,
send and partial receive: the control posts an unwanted message; the fix
clears the registration before publishing the slot as free. A subsequent new
registration still announces the buffered data correctly. No notification table
is allocated merely to close a socket.

The full build and all 51 Winsock checks pass on boat `bx_k7xdfrq9`.
Evidence: `scratch/runs/20261011T2124Z-winsock-notification-lifetime/`.
This is a general notification-lifetime fix, not the missing event API itself;
Dark Reign 2 remains at the previously reviewed WSAEnumNetworkEvents blocker.

The next implementation must preserve the
[WSAEnumNetworkEvents contract](https://learn.microsoft.com/en-us/windows/win32/api/winsock2/nf-winsock2-wsaenumnetworkevents):
copy selected latched events and their error slots, clear the record and reset
the optional event atomically; on failure retain both the record and event.
Keep shared-thread state and notification cancellation/reuse in the tests.

## Process-wide Winsock startup prerequisite

The event-path audit found WSAStartup's reference count in a mutable WASM
global, private to each guest-thread instance. A second instance's WSACleanup
therefore returned WSANOTINITIALISED despite two successful main-thread startups.
The count now lives in a declared shared LOCK_TABLE cell. Startup increments
atomically; cleanup uses compare-and-swap to reject zero without underflow and
only the caller releasing the final reference tears down sockets. The existing
network-pump and blocking-cancel initialization checks read the same shared cell.

A two-instance/shared-memory regression fails on the old source and passes
with the fix: one cleanup preserves a socket, final cleanup closes it, excess
cleanup fails, and startup on the other instance works afterward. All52 Winsock
checks and the full build pass. Memory-map ownership aliases were added for
the new shared cell. Evidence: scratch/runs/20261011T2155Z-winsock-process-startup/.
This is an initialization prerequisite; WSAEnumNetworkEvents/WSAEventSelect and
the event-object entrypoints remain unimplemented, and gameplay is not qualified.

## WSACreateEvent prerequisite

WSACreateEvent now resolves through the append-only API table and delegates to
the common Win32 event provider: unnamed, manual-reset, initially nonsignaled.
It requires process-wide WSAStartup and reports WSANOTINITIALISED (10093) or
WSA_NOT_ENOUGH_MEMORY (8) on creation failure. This follows the
[Microsoft contract](https://learn.microsoft.com/en-us/windows/win32/api/winsock2/nf-winsock2-wsacreateevent).

The regression checks real host wait/set/reset behavior, distinct handles,
manual-reset persistence, startup from a sibling instance, failure injection,
and zero-argument stdcall stack cleanup. The old-source control fails API
lookup; the implementation passes all 53 Winsock checks. Evidence:
scratch/runs/20261011T2204Z-winsock-create-event/. This does not yet implement
WSAEventSelect/WSAEnumNetworkEvents or qualify Dark Reign 2 gameplay.

## Event signaling and reset

WSASetEvent/WSAResetEvent use the same host events as WSACreateEvent, preserving
manual-reset behavior and the scheduler wakeup used by Win32 SetEvent. Both
require process startup, return FALSE with WSA_INVALID_HANDLE (6) for invalid
or stale objects, and reject the private high-bit ReleaseMutex tag. The host
fallback and ThreadManager previously returned success for invalid events;
they now reject missing and wrong-type handles. Valid mutex release behavior
through its own API is unchanged. Contracts:
[WSASetEvent](https://learn.microsoft.com/en-us/windows/win32/api/winsock2/nf-winsock2-wsasetevent),
[WSAResetEvent](https://learn.microsoft.com/en-us/windows/win32/api/winsock2/nf-winsock2-wsaresetevent).

Evidence: scratch/runs/20261011T2212Z-winsock-event-change/. Old controls fail
missing API lookup and invalid-event acceptance. The new Winsock test exercises
startup/error/stack cleanup, manual reset, wrong-type and stale handles; the
ThreadManager regression checks the scheduler provider directly.

Next: WSAEventSelect/WSAEnumNetworkEvents must latch requested socket events and
reset atomically with their recorded errors. Do not hold a WAT spinlock across
a host call: a worker RPC can wait for main while main spins on that lock.
The generic fs_close_handle accepts unknown non-file handles, so event close
needs the typed provider path described below. Dark Reign 2 has not been rerun or qualified from these changes.

## Typed event close

WSACloseEvent now checks process startup and calls a typed close_event host
import rather than the permissive filesystem CloseHandle fallback. Both the
headless provider and ThreadManager verify the live object is an event before
releasing it; unknown, closed, and wrong-type handles fail with
WSA_INVALID_HANDLE (6). Browser and CLI install the same provider operation;
worker import inheritance and generated RPC signatures include it.

Evidence: scratch/runs/20261011T2219Z-winsock-event-close/. Old API lookup and
missing-provider controls fail. The regression covers startup
precondition, one-argument close stack cleanup, successful release, double
close, rejected mutex close, and inability to signal the closed object.
All 55 Winsock checks and the ThreadManager/mutex checks pass. The remaining
Dark Reign 2 blocker is still WSAEnumNetworkEvents/WSAEventSelect, not this
lifecycle prerequisite; no fresh gameplay or screenshot claim.

## Shared event-record transaction prerequisite

The host now owns one socketEventRecords map per process, inherited together
with the event validator and signal/reset callbacks. socket_event operations
are: 0 select (socket index, event, mask), 1 post (index, FD bit, error),
2 enumerate (index, optional reset event, reserved, contiguous output WASM
address), 3 cancel, 4 inherit (child index, parent index), 5 selected mask.
Supported selection bits are READ/WRITE/ACCEPT/CONNECT/CLOSE (0x3b); unsupported
bits fail with WSAEINVAL. Enum validates the 44-byte span and event first, then
resets, copies only nominated error slots, and clears the record in one
synchronous host call. No guest callback or await occurs during that operation.
Errors retain the record and leave the output untouched; NULL event skips reset.

This is a host-side prerequisite, not a newly exposed Winsock API. WAT does
not yet import socket_event, and no real worker RPC or game replay is claimed.
Next wire it through the generated import signature and public EventSelect/Enum
handlers; connect socket destroy, accept inheritance and AsyncSelect cancellation
to it. Audit local TCP close/shutdown notification paths as well as wire events.
Use existing read re-enable flags, preserve nonblocking side effects, and check
actual socket readiness through API tests before an ordinary DR2 replay.

The old control fails because no broker exists. Evidence:
scratch/runs/20261011T2225Z-winsock-event-record/. All 56 Winsock checks, worker
context inheritance, ThreadManager tests and full build pass. The new test
uses two host-import contexts sharing one process record and real event objects:
selection filtering, recorded errors, untouched unreported error slots, invalid
output/event failure preservation, clear/reset, next-event signaling, optional
reset, accept inheritance, cancellation and invalid masks are covered.

## Network event APIs and next ordinary blocker

WSAEventSelect/WSAEnumNetworkEvents now resolve through the append-only API
table and call the process host broker. Selection makes the socket nonblocking,
replaces async-window notification ownership, and reports current readiness.
Enumeration copies the record and optionally resets its event; unreported error
slots remain untouched. Accept inherits selection/nonblocking mode, and close
or AsyncSelect cancels it before socket-slot reuse. READ re-enables through
recv; WRITE re-enables after a would-block send; ACCEPT re-enables on accept.
Local TCP connect/send/close/shutdown paths now report the same events as wire
paths. The host import and its generated RPC signature are included.

All 59 Winsock checks and the full build pass, including real TCP read/write/
reset events across WASM instances, partial reads, write-buffer exhaustion and
recovery, accepted-socket inheritance/initial write, cancellation, and slot reuse.
This is not a real browser-worker concurrency or multiplayer qualification.
Unsupported event masks (outside READ/WRITE/ACCEPT/CONNECT/CLOSE) fail explicitly.

An ordinary CLI replay passes the old WSAEnumNetworkEvents lookup, then stops
at missing **WSAEnumProtocols** in ws2_32.dll, win32_socket.cpp:1799. The reviewed
640x480 error screenshot agrees with dr2.log. No menu or gameplay yet. Replay
uses the version before the final accepted-socket initial-WRITE correction;
the final build and regression logs are separate from that replay build log.
The boat was missing stdole2.tlb; copied the existing local 15,088-byte fixture
to test/binaries/tlbs/stdole2.tlb before the successful replay. shell32.dll is
still absent on the boat, and the runner reports that separately.

Evidence: scratch/runs/20261011T2233Z-dark-reign2-network-events/. Next implement
truthful protocol enumeration for the virtual TCP/UDP provider, then replay;
never return an invented empty protocol list to bypass this check.

## Protocol catalog (2026-10-11 22:46Z)

WSAEnumProtocolsA/W (and the legacy unsuffixed ANSI lookup) enumerate the
virtual TCP, UDP and IPX datagram providers, with stable catalog identities,
real address/socket/protocol attributes, terminated protocol filters, ANSI or
UTF-16 names, and complete-buffer size negotiation. IPX covers packet types
1000..1255; it does not claim protocol-zero matching. Datagram size uses the
same VLN_MAX_PAYLOAD limit as sendto. No native interfaces, QoS, multicast or
IFS handles are advertised.

Contract references: [enumeration](https://learn.microsoft.com/en-us/windows/win32/api/winsock2/nf-winsock2-wsaenumprotocolsa)
and [record layout](https://learn.microsoft.com/en-us/windows/win32/api/winsock2/ns-winsock2-wsaprotocol_infoa).
The existing Winsock suite passes 60/60 checks including short-buffer
nonmutation, filter deduplication/ranges, usable IPv4 socket tuples, UTF-16,
startup and invalid-pointer errors. Full boat build passes (1,774,919 bytes).

Ordinary replay on bx_euq6n9pm with the final built tree gets beyond the
protocol export lookup and now fails on missing WSARecv, win32_socket.cpp:1805.
The game loads its socket exports before calling them: this does not prove it
has exercised enumeration itself. Reviewed fatal-dialog capture, logs, patch
and exact module hash: scratch/runs/20261011T2246Z-dark-reign2-protocol-enum/.
Still no menu, controlled gameplay, FPS or audio qualification. Next implement
real WSARecv scatter/gather, including correct blocking/overlapped semantics;
do not disguise an unimplemented mode with success.

## Non-overlapped WSARecv (2026-10-11 22:55Z)

WSARecv now implements flags-zero, non-overlapped stream and datagram receive:
validated scatter buffers, partial stream reads, datagram boundaries/truncated
prefixes, nonblocking errors, EOF and whole-frame blocking retry. The shared
recv core takes the caller's unwind size, so a parked seven-argument WSARecv
restores 32 bytes rather than recv's 20. Temporary buffers are released before
parking. Completion-routine/overlapped and nonzero flag modes remain explicit
unimplemented traps, not successful queued operations. This is scoped support,
not complete overlapped Winsock. [API contract](https://learn.microsoft.com/en-us/windows/win32/api/winsock2/nf-winsock2-wsarecv).

62/62 Winsock checks and full build PASS (1,775,476-byte WASM). A deliberate
20-byte unwind mutant fails the new full-frame assertion. Reviewed ordinary
replay now fails the next export lookup: WSASend, win32_socket.cpp:1811.
The game has not yet exercised the receive API itself. Evidence and exact
module hash: scratch/runs/20261011T2255Z-dark-reign2-wsarecv/.
No menu/gameplay/FPS/audio claim. New boat bx_gyugsep2 retains fixtures until
23:51Z; stdole2.tlb needed copying again after the fork and is now restored.

## Non-overlapped TCP WSASend (2026-10-11 23:03Z)

Flags-zero TCP WSASend gathers validated WSABUFs. Nonblocking sockets report
the accepted prefix. Blocking sockets retain scalar progress in the calling
thread's WASM instance across parking and return success only once all buffers
are consumed; temporary heap storage is released before every yield. No changes
to the caller's WSABUF descriptors. The shared stream primitive accepts the
caller's unwind size (20 for send,32 for WSASend). Flags, overlapped/completion
and connected-datagram modes remain fail-fast. [API contract](https://learn.microsoft.com/en-us/windows/win32/api/winsock2/nf-winsock2-wsasend).

64/64 Winsock checks and full build PASS. The new test sends 100,008 distinct
bytes across two buffers and repeated park/drain/retry cycles, checks exact
ordering/no duplicates, partial nonblocking results, call reuse and validation
before transmission. A progress-reset mutant fails completion. Reviewed ordinary
replay clears WSASend export lookup and now stops at missing WSASocket,
win32_socket.cpp:1817. It has not exercised the new send API itself yet.
Evidence, module hash and capture: scratch/runs/20261011T2303Z-dark-reign2-wsasend/.
No gameplay/FPS/audio qualification. Next WSASocket protocol-info/creation semantics.

## Held WSASocket candidate (2026-10-11 23:21Z)

Not ready for integration. A/W/plain exports and a shared socket-creation core
pass 65 Winsock checks and the full build; a wrong frame-unwind control fails.
The candidate currently rejects every nonzero creation flag. That is incomplete:
WSA_FLAG_OVERLAPPED (1) is a valid attribute, and nonoverlapped I/O is also allowed
on such sockets. [Microsoft contract](https://learn.microsoft.com/en-us/windows/win32/api/winsock2/nf-winsock2-wsasocketw).

Ordinary DR2 calls WSASocketA(2,3,1,NULL,0,1): an IPv4 raw ICMP socket with that
attribute. The candidate returns 10022. The guest then formats its 446-byte
fatal-error explanation through a 256-byte buffer and crashes at 0x0078678a in
its Sprintf error string. This is not evidence of a layout/compiler regression.
Earlier filtered traces omitted the final buffered batch; the API breakpoint
captures the actual request and WSAGetLastError result.

Matched parent exits without that crash. Keeping the new implementation while
removing only its three API registrations also avoids it. Next: correct creation
attribute handling and raw-socket capability/error semantics, with regression
coverage for this request, before another ordinary replay. Do not fake success
for raw ICMP or overlapped I/O. No new menu/gameplay screenshot was produced.
Evidence: scratch/runs/20261011T2311Z-dark-reign2-wsasocket/ (source patch, build,
unit/negative control, A/B logs, error-buffer trace and API breakpoint).

## Socket capability validation correction (2026-10-11 23:26Z)

The follow-up separates side-effect-free transport validation from allocation
and applies it before the unsupported OVERLAPPED creation path. The raw ICMP
request now correctly returns WSAESOCKTNOSUPPORT (10044): this virtual network
has no raw-socket transport. Valid OVERLAPPED creation on a supported transport
now fails fast instead of misreporting it as an invalid parameter or silently
creating a different socket. Ordinary flags-zero TCP/UDP/IPX creation and
protocol-info selection remain implemented. Raw ICMP and overlapped I/O are
still not implemented; this is an API prerequisite, not a game fix.

65/65 Winsock checks and full build pass. A/W actual raw-call cases assert10044,
unsupported family asserts10047, valid unimplemented creation traps, and none
opens the lobby. Ordinary replay now produces a reviewed fatal dialog:
"WSASocket: The specified socket type is not supported in this address family."
The previous Sprintf crash is gone. There is still no menu/gameplay/FPS result.
Evidence: scratch/runs/20261011T2326Z-dark-reign2-socket-capability/.
Next work requires real raw ICMP packet semantics and overlapped socket state;
do not turn either into success solely to get past startup.

## ICMP packet prerequisite (2026-10-11 23:33Z)

Static disassembly at 0x0051e289..0x0051e2a5 shows the socket wrapper requests
flag1 for all three branches: raw ICMP, UDP and TCP. Adding raw allocation alone
would leave the common creation-attribute requirement unresolved.

Added internal WAT Internet-checksum and IPv4 echo-reply helpers. They validate
both checksums, complete lengths, IPv4 header shape, protocol, TTL, ICMP type/code
and unsupported fragmentation/options before writing. Replies reverse addresses,
use caller-supplied IP identification, preserve ICMP identifier/sequence/payload,
and recompute both checksums. These operate on validated host-owned buffer spans;
the eventual caller must enforce room destination ownership. They do not assert
that an arbitrary destination exists or generate a reply for an absent peer.
[Packet contract: RFC792](https://www.rfc-editor.org/rfc/rfc792.html).

66/66 Winsock checks and full build pass, including an independent checksum
oracle, fixed known vector, odd/even payloads through maximum IPv4 size,
in-place operation, output guards and malformed-packet no-write checks.
These helpers are not wired to public sockets: no API capability change and no
new ordinary-run screenshot. Next: raw-packet receive queues/room frame routing,
read readiness, send/recv handlers and overlapped creation/operation state.
Evidence: scratch/runs/20261011T2333Z-dark-reign2-icmp-packet/.

## Raw receive queue prerequisite (2026-10-11 23:39Z)

Internal raw ingress validates a complete IPv4/ICMP packet, rejects foreign
destinations, and fans out to matching live AF_INET/SOCK_RAW/IPPROTO_ICMP
records. Wildcard/bound local addresses and connected remote addresses filter
independently. UDP sockets never receive these packets. Each queue preserves
the complete IP header, source address and packet boundary; readiness follows
queued bytes. Queue count and byte capacity bound delivery, so one full reader
does not prevent delivery to another. Raw rings use the datagram capacity;
stream rings retain their separate send-hold allocation.

67/67 Winsock checks and full build pass, including local/peer/type filtering,
in-place echo regression, receive-ring wraparound, queue count limits, drop
isolation, checksum corruption, foreign destination and post-close behavior.
This still uses internal seeded records in tests: public raw socket allocation,
wire routing, send/recv entry points and overlapped operation state are not
enabled. No new game replay or gameplay claim.
Evidence: scratch/runs/20261011T2339Z-dark-reign2-icmp-ingress/.

## Room wire ingress (2026-10-11 23:46Z)

VLN1 type9 carries a complete IPv4 ICMP packet with zero port fields. The room
pump checks that inner IPv4 source/destination match the outer frame identity
before passing it to the raw receive queues. Bad packets and full raw queues
are consumed without holding up later wire frames. The host wire classifies
type9 as a datagram (512-frame queue bound/drop policy) and names it ICMP in
traces. Existing TCP/UDP framing is unchanged.

Winsock tests exercise actual loopback wire endpoints and the WAT pump, including
payload preservation, identity mismatch, nonzero ports, truncation, 514-frame
queue saturation and receiver saturation. The broader wire suite exposed an
old test assumption, reproduced on the parent: accepted sockets inherit the
nonblocking listener mode. That blocking-recv test now explicitly switches its
accepted socket to blocking before asserting net_wait.

This is still only receive transport: raw creation/send/recv public handlers,
echo response routing and overlapped state remain pending. No ordinary game
replay or gameplay screenshot. Evidence:
scratch/runs/20261011T2346Z-dark-reign2-icmp-wire/.

### Raw receive core (2026-10-11)

The datagram receive core now accepts internal raw ICMP records and returns the
whole IPv4 packet, with source address and port zero. It validates the receive
buffer and optional sockaddr before consuming a packet. A short buffer receives
the prefix, discards the remainder of that one packet and reports WSAEMSGSIZE;
invalid pointers or negative lengths preserve the queue. FIONREAD excludes the
private record headers and sums queued IP packet bytes.

This is tested using seeded internal raw records, not public socket creation.
Raw creation, send routing, recv/WSARecv stream-path delegation, receive flags
and overlapped state remain unfinished; the ordinary game still stops at the
unsupported raw socket dialog. No new gameplay capture is implied. Evidence:
scratch/runs/20261011T2357Z-dark-reign2-raw-receive/.

### Raw receive dispatch (2026-10-12)

recv now delegates internal raw records to the datagram core rather than
requiring a connected stream and reading private queue headers. WSARecv inherits
that route, including multi-buffer scatter, truncated-prefix delivery and
restoring its entire 32-byte call frame on a blocking wait. recv and recvfrom
now fail fast for unsupported nonzero flags before consuming data, matching
WSARecv's existing policy; MSG_PEEK must not silently drain the queue.

Regression cases use the real recv/recvfrom dispatch wrappers and WSARecv API
dispatch with seeded raw records. Raw creation, send/echo routing, WSARecvFrom
flag/scatter validation and overlapped completion remain pending. No new game
replay. Evidence: scratch/runs/20261012T0001Z-dark-reign2-recv-dispatch/.

### WSARecvFrom validation and scatter (2026-10-12)

WSARecvFrom now checks startup/socket identity, result pointers, flags, the
entire WSABUF array and its destination spans, aggregate length overflow and
optional source-address storage before consuming data. Allocation is bounded
by the receive capacity. A truncated datagram scatters the copied prefix before
returning WSAEMSGSIZE. Unsupported flags/completion modes fail fast, and a
blocking retry restores all 40 bytes of the call frame.

Raw-record regression cases cover invalid later buffers, short source-address
storage, unsupported flags and overlapped mode without consumption, scatter,
truncation, source address and frame restoration. Public raw creation and
send/echo/overlapped implementation still remain before ordinary DR2 replay.
Evidence: scratch/runs/20261012T0007Z-dark-reign2-wsarecvfrom/.

### Raw send transport (2026-10-12)

sendto on an internal raw record now wraps the caller's ICMP message in an
IPv4 header (TTL64, DF, protocol1, valid header checksum) and emits VLN1 type9
with zero port fields. The caller's ICMP checksum and payload are preserved.
The 4096-byte frame payload leaves 4076 bytes for the ICMP message; larger
messages fail with WSAEMSGSIZE rather than silently truncating. Bad spans,
short messages, addresses outside the virtual room and shutdown sends fail.
The temporary packet is freed before either returning or parking on wire
backpressure. Nonzero sendto flags fail fast.

Tests use real sendto dispatch and two loopback endpoints, checking the complete
wire/header identity, header checksum, unchanged ICMP payload, maximum-size
boundary, invalid arguments, full-wire nonblocking error and blocking retry.
Public raw socket creation remains gated; echo response routing, connected
send/WSASend and overlapped semantics are not complete. No ordinary game replay.
Evidence: scratch/runs/20261012T0013Z-dark-reign2-raw-send/.

### Echo routing (2026-10-12)

Valid echo requests addressed to a local IP now produce a real stack reply.
Room ingress delivers the original packet to matching raw queues first, then
builds the reply in its private frame buffer and sends it back to the source.
Malformed checksums, foreign destinations and non-request ICMP do not generate
responses. A full outbound datagram queue can drop an echo reply without
stalling ingress. No absent remote host is synthesized.

Raw sendto to loopback or the process's own room address directly delivers the
request and reply locally; no wire endpoint is required. Tests verify both
routes, checksums, unchanged queued request/payload and no reply loop. Raw
creation, connected send/WSASend and overlapped semantics still gate DR2 replay.
Evidence: scratch/runs/20261012T0016Z-dark-reign2-echo/.

### Connected raw send (2026-10-12)

Raw connect now selects a room destination and receive-source filter without
sending TCP SYN or assigning a stream peer. Reconnect updates the destination;
a rejected address leaves the prior destination intact. send delegates to the
raw packet transport, and non-overlapped WSASend gathers one complete packet.
An oversized gather fails before sending, never splits into stream chunks.
Temporary address/packet buffers are freed before a blocking retry. Raw
shutdown has no stream peer and sends no TCP FIN.

Regression cases check unconnected send, peer address, connect/reconnect,
gathered payload, oversize rejection, full-frame retry and shutdown. Public
raw allocation and OVERLAPPED socket/operation state remain unfinished; no
ordinary DR2 replay yet. Evidence:
scratch/runs/20261012T0022Z-dark-reign2-connected-raw/.

### Raw binding and readiness (2026-10-12)

Raw bind is an address filter: port numbers are ignored and multiple raw
sockets may bind the same address. INADDR_ANY remains a wildcard for receive;
explicit sources must be owned by this process. Raw listen returns
WSAEOPNOTSUPP. Write readiness accepts open unbound/bound/connected raw sockets
without requiring a stream peer, and clears after send shutdown.

Tests exercise bind collisions, wildcard getsockname, foreign-source rejection,
listen rejection and select before/after connect and shutdown. This matches
the existing datagram readiness model; host wire backpressure can still cause
an individual send to wait. Public raw allocation and overlapped state remain
pending. Evidence: scratch/runs/20261012T0027Z-dark-reign2-raw-bind/.

### Synchronous raw allocation (2026-10-12)

AF_INET/SOCK_RAW/IPPROTO_ICMP is now accepted by the transport validator, so
WSASocketA/W with flags zero can create real raw records. Other raw protocols
remain rejected with WSAEPROTONOSUPPORT. Tests create both A/W sockets, bind,
connect, send an echo request and receive the full IPv4 request/reply through
public dispatch, without seeding records.

This does not enable OVERLAPPED creation: the exact DR2 flags=1 call still
fails fast at that capability check, now after successful transport validation.
No ordinary replay or gameplay claim. Evidence:
scratch/runs/20261012T0033Z-dark-reign2-raw-allocation/.

### OVERLAPPED implementation audit (2026-10-12)

The remaining creation gate is in `$vsock_wsasocket`: after successful
transport validation, any nonzero accepted flags call `$crash_unimplemented`.
The DR2 request is flags=1. Creating a socket and submitting an asynchronous
operation are separate steps; the next implementation should retain the
creation attribute and explicitly distinguish supported operation modes,
rather than changing that check into untracked success.

Existing infrastructure inspected:

- `$iocp_complete_overlapped` in `09a7-handlers-dispatch.wat` only completes
  handles already associated with an IOCP. It writes Internal/InternalHigh
  and queues a port entry; it does not maintain pending socket receives or
  signal an OVERLAPPED event when no port is associated. It cannot simply
  replace the socket handlers' current fail-fast branches.
- `socket_event` in `lib/host-imports.js` serializes FD notification records
  through the host/RPC boundary. Those records belong to WSAEventSelect and
  must remain separate from per-operation OVERLAPPED completion.
- Socket flags currently use bits0..5. Any creation attribute added there
  must survive connect retry/reset and accept inheritance, and clear on
  destruction/reuse. Socket creation alone must not signal completion.
- `WSAGetOverlappedResult` is absent from this branch's API table. Add it
  append-only if the implemented completion route needs it; do not reuse a
  stale numeric API id from these notes.

The next runtime-backed slice needs an explicit operation lifetime: validated
guest OVERLAPPED/output spans, immediate completion versus queued receive,
bounded pending records shared across guest threads, exactly-once delivery,
event/IOCP publication after output writes, and cancellation on socket close.
Unsupported completion-routine modes must still fail fast. Tests must cover
empty receive followed by arrival, immediate receive/send, invalid pointers,
close/reuse, two threads observing one completion, and no duplicate delivery
after retry. Preserve the original synchronous tests as controls.

No async implementation or runtime result is claimed by this audit. Runtime
is currently handed to launch-ux for Oni's first-level input diagnosis on
bx_y429vzbh; the DR2 source worktree remains clean after this documentation
commit, ready for the next tested implementation slice.

### Socket creation attribute and ordinary replay (2026-10-12)

WSASocketA/W now retain WSA_FLAG_OVERLAPPED in socket flags bit6 while
allocating the real transport. Connect failure preserves it, accepted sockets
inherit it, and destruction/reuse clears it. Creation submits no I/O; non-null
OVERLAPPED/completion-routine operation paths still fail fast. This supersedes
the creation gate described in the preceding audit, not its pending-I/O work.

69/69 Winsock tests, 34/34 wire tests and full build pass on bx_y429vzbh;
the new tests fail on the prior source. Tests exercise real raw echo with
flags1, A/W allocation, slot reuse, listener inheritance and unsupported I/O.

The first replay lacked test/binaries/tlbs/stdole2.tlb; restored the exact
local fixture and reran. Ordinary DR2 then passes Trying RawSocket, enters
Intro/Shell and loads missions/system/shell through SimInit to Sim. A bounded
30-second run completed 1130 batches without a trap. This is the shell world,
not a played mission; ordinary input and gameplay remain to validate.
shell32.dll is still absent from the test checkout (logged warning).
Evidence: scratch/runs/20261012T0045Z-dark-reign2-socket-attribute/.
Built module SHA256: 9e835f75dfe5d2fcfb91f592641e945f91baadcd20f6751460777f4dba888cd6.

### Accepted-main native mission check (2026-11-01)

Current registration is `dark_reign2_demo`, corpus candidate `dark-reign2-demo`,
with local root `test/binaries/candidates/dark-reign2-demo/extracted/Files`.
The registry's CLI gameplay comment has historical support beyond the shell-only
record above: commits `e7a031da3` and `fe71f8d83` report Demo Mission 1, box
selection and left-button movement against a right-button cancellation control.
Later commits also report browser/mixed-touch results. Those commits are outside
this tested main's ancestry; their referenced October 12 run and PNG/log artifacts
are absent locally. Their text is retained in this run as historical reports,
not newly reviewed gameplay evidence. No later accepted local result was found.

The named predecessor `20261101-redline-upload-internal-cause` had fresh final
records and the 06:01:14 UTC runtime/source/build release before this launch.
Tested main: `149286afdd9607776d8611d066164a72253f14e6`. All 4,389 accepted
source inputs, the prior 126 actual-read identities, region-map mirror and
module matched the predecessor's final repaired build; its locked build was
reused. Actual loaded module SHA-256:
`330b120d64cfd4aebdd945c99a95022dbd97db7ee6962d7ec534c24da466011b`.

Pinned original `dr2.exe` SHA-256:
`6aa93ded56537ff9ceb6f47d0bbe2de74b5b2b83c6932d61eb98e69d797756ed`.
Local file-manifest SHA-256:
`a01d2d77518bb1627077f474ee6ee99731df4dce404a2bb8be92a1b4b97d2e7a`.
All 29 local original/manifest files were hashed before and after; all 27
manifest entries exist with their declared sizes. Originals/configs are unchanged.
No installer or new licence acceptance was performed.

One ordinary local CLI invocation used `--app=dark_reign2_demo --no-build
--wasm=build/wine-assembly.wasm --batch-size=100000 --control-stdin --frozen`,
with quiet logging, VFS log export and a final PNG. Exact arguments are in
`command.json`. After ping, a request to step 550 batches ended at batch 10:
the guest exited with code `-536870910` (`0xe0000002`); the Node harness itself
returned zero. This is a guest failure, not a successful 550-batch replay.

**First concrete blocker:** `dr2.log`, `vid_enumdx:1164`, rejects both Direct3D
HAL and RGB Emulation with "doesn't support mip mapping." It then reports no
hardware D3D devices and raises "Can't start hardware accelerated DirectX 7.0."
The reviewed `final.png` is a solid teal 640x480 frame, with no menu or mission.
The missing-shell32/symbol warning is separate from that explicit device rejection.
No menu input, mission transition, selection or movement was reached. No second
invocation, capability inflation, generic repair or alternate backend was tried.

Identity-only observation passed actual synchronous/asynchronous WASM execution,
shared 512 MB whole-memory read-only comparison and bounded retention through
10,001 late records before the original. All 124 actual-read identities and the
actual compiled-module receipt match after execution. Runtime took 4.714 seconds;
minimum sampled free disk was 2,306,859,008 bytes, above the required floor.
Evidence: `scratch/runs/20261101-dark-reign2-native-mission/` (compressed runtime
log, saved guest log, capture, command, identities and verification).

Next bounded action: review this exact mipmapping capability rejection against
the supported native renderer contract before authorizing any implementation or
backend change. No played mission, current control response, FPS, audio or
backend parity is qualified by this run. No test box was acquired.
