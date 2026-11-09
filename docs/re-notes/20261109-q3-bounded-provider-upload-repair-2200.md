# Q3 bounded provider upload service — 2026-11-09

Q3 now provisions pinned files through its own two-lane streaming PUT service,
`tools/q3-provider-upload.py`, composed by the actual provision function in
`tools/q3-native-inputs/control.py`. Each lane reuses a healthy connection for
its origin, sends 64 KiB chunks, and retains a **30s absolute PUT deadline**.
The first error closes dispatch and shuts down active sockets; every worker and
request timer joins before the function raises. Ambiguous PUTs are never replayed.
Responses are limited to 64 KiB. Local pins are verified before any authorization,
on the sending descriptor, and while sending. Remote phase hash barriers remain
mandatory after all uploads. The generated native closure now seals the Q3
uploader itself. Shared providers, Nox and Redline were read-only.

Code on main: `289eaf86aef67471f48dd174e82168a0cfc5117b`.
Evidence: `scratch/runs/20261109-q3-bounded-provider-upload-repair-2200/`.
Git is the source archive: exact SHA, small binary patches and recovery recipe
are retained. There is no source/media archive or copied game media in this run.

## Causal controls

The retained previous provisioning traceback identifies an HTTPS body-write
timeout in `urllib.request.urlopen(timeout=90)`, with 590 ordered receipts. Its
next unreturned ordered pin is the 46,853,694-byte `demoq3/pak0.pk3` (SHA256
`e77abad2466f45a0a7ea018445528f9b95a0fe7789fa1abc1a7718bbf0754b08`). An ordered
receipt boundary does not identify other in-flight effects or the peer's cause.

Ten actual uploader/peer controls pass, including verified TLS blocked writers,
held response sockets, refusal with a blocked sibling, redirect refusal, local
pin refusal, exact streaming and connection reuse. A 32 MiB sparse test input
uses about 303 KB traced peak memory; the retained actual uploader uses
33,719,183 bytes and fails the same memory contract. Under refusal the old pool
issues 16 requests; the candidate stops within its two admitted lanes. The
actual Q3 provision function reaches both remote prelaunch barriers only on
success and reaches neither after failure. A one-lane control sends 20 distinct
files over one accepted connection, without replay. TLS peer disconnect traces
in the negative-control log are expected; all ten tests pass.

The sealed generated consumer also passes baseline post-terminal-close
reproduction, candidate work/CDP deadlines and explicit refusal with zero later
protocol admission, late reply rejection, planned cancellation and ordinary
close. All **115/115** tasks are actually reaped, with separate stdout/stderr
EOF. Actual generated controller pipe/EOF controls pass. Staging passes two
actual local phase prelaunches, five independently reread manifests and five
mutation refusals. The initial staging command used an incorrect `.cjs` suffix;
the corrected Python command passes and both logs remain. Locked builds pass,
including the final build after transport instrumentation.

The Q3 durable every-CONT custody adapter, including first unlinked EXIT outside
ESRCH, was unchanged. Input guards, terminal admission and native deadlines were
unchanged. No native runtime guard was extended.

## Sole fresh attempt: first service failure

Final manifest SHA256:
`c78b293438557db6ad0e402684c265cca05516d712d2382bbf38b55f0aa6eb93`.
All **945** pins in each of five staged manifests were independently SHA/size
reread in a separate process before allocation. Both local phase prelaunches
passed. No sealed candidate changed after allocation.

The fresh attempt uses the tested changed transport. It retains 791 starts,
789 successful completions and two terminal errors. Of those starts, 789 reuse
connections. The large `pak0.pk3` PUT reaches its absolute deadline while still
in **body-write**, at **22:05:53.332Z**, elapsed **30.000835s**, after
**12,320,768 bytes of completed local chunk sends**. Those bytes are not a claim
of remote acceptance or persistence. The timer raises `TimeoutError: PUT
deadline; remote effects UNKNOWN; no retry`; the interrupted writer reports
TLS EOF. Its sibling, already awaiting response headers after sending 5,632
bytes, is interrupted and reports closed connection. All workers settle; no
new dispatch, replay or remote prelaunch follows.

This discriminates a still-incomplete body send from a completed-body response
stall. It does not identify the provider's internal cause or establish that a
larger deadline would succeed. The concrete repair provides bounded memory,
connection reuse, terminal queue cancellation and phase/byte evidence; the
large-upload service remains unresolved. There is **no fixture/original native
launch, Chrome, CDP, guest input, capture, retry or quit** in this fresh attempt.
Arena entry, fire and displacement remain untested.

## Lifecycle and evidence

Sole box: **`bx_aunrfgqy`**, UUID
**`3d88e527-e92e-4a42-ba8b-3c62074eb5d5`**. Initial expiry:
**2026-11-09T22:28:51.042Z**. Before allocation an independent watchdog was
observably armed with PID/start identity and a fresh heartbeat, bound to the
UUID, read-only configuration SHA256 and immutable 25-minute deadline
**22:28:51.776Z**. A separate process observed that identity and configuration.

Before stop, a separate verifier independently reread 589 evidence files,
176 completed gzip streams and the remote inventory. The sole malformed gzip
is the expected staging corruption negative control. Eight remote task files
all match sealed pins; there are zero unique runtime outputs to retrieve.
Exactly one delegated normal stop followed verified evidence:
**`stop_f2202bbcf8537f51`**, completed **unforced 22:07:01.286Z**. Separate API
reads confirm **archived**, archiveAfter=null; the CLI uses the **stopped** alias.
No replacement expiry was returned. The actual watchdog wait returns **0** with
separate stdout and stderr EOF; its configuration hash is unchanged. The
allocator session also joined0. No owned live box remains; /home has over 6 GB
free.

Next work, if separately assigned, should address the large-body service
boundary using this byte/phase evidence before another native attempt. This
single-task worker releases STOP.
