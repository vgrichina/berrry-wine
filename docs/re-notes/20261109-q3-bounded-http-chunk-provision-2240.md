# Q3 bounded HTTP provisioning: live transfer passes; fixture review orchestration fails

Evidence: `scratch/runs/20261109-q3-bounded-http-chunk-provision-2240/`.
Transfer code commit: `5cc350b5e20fbdd38e1083161d1f131baee6880d`, published on main
with the required strict SSH Git pull/push. No Boat SSH was attempted and no
credentials were requested.

The production provision consumer now uses authorized upload URLs for raw
ranges of at most 4 MiB. Each PUT retains its original absolute 30-second cap;
there is no retry/resume after ambiguous effects. Large files use one bounded
local temporary range at a time, never a source/media bundle. The original
source descriptor is checked for mutation and hashed through exact ordered
coverage. Small files retain bounded streaming PUTs and connection reuse.

Remote streaming assembly rejects missing/extra/duplicate, out-of-order,
truncated, swapped, corrupt or mutated chunks. It checks every range SHA/size
and whole-file SHA/size, fsyncs the temporary file, atomically publishes it,
fsyncs its directory, and independently reopens the published file. A separate
remote descriptor reread checks every provider before either phase barrier.
No transfer success alone admits a native phase.

The actual 46,853,694-byte pak passed local actual-consumer tests and the sole
live transfer in 12 raw chunks. Whole-file SHA-256 is
`e77abad2466f45a0a7ea018445528f9b95a0fe7789fa1abc1a7718bbf0754b08`.
Live chunk PUTs took 0.083–0.230 seconds each. Remote assembly, the final
provider rereads and both mandatory remote prelaunch barriers passed. The
945-provider phase manifest is
`bbeaf7e01aea53d718d7ea3dc28460cd33ed69da978cd1f79876480a7814ef11`.
All phase pins and five staged manifests were independently reread before
allocation. Source recovery is exact Git plus relevant small patches;
existing binaries/media are referenced by path, size and hash.

Focused tests cover the real owning provision function with the actual pak,
missing, duplicate, truncated, swapped and corrupt chunks, invalid order and
coverage, held writer, HTTP refusal, cancellation, a real owning pipe EOF,
source mutation, source mismatch and wrong final acknowledgement. Failures
admit zero phase barriers and perform no replay. Existing HTTP/TLS, pipe-peer,
controller EOF, durable every-CONT prefix, first-unlinked EXIT and current
terminal-cleanup tests pass. The older startup-autoattach test now expects
native termination with separate EOFs and zero post-terminal `Browser.close`.
The required locked build passes; no local Chrome was started.

The native outcome is **fixture review orchestration failure**. The sole
changed fixture reached current startup admission and produced a capture at
22:42:09.981 UTC. The task-local observer incorrectly watched historical output
paths and looked for review readiness under `prepared/runtime` instead of
`prepared`. The actual gate correctly withheld its first input. The unchanged
owning checkpoint deadline expired at 22:42:55.837 UTC, making the failure
terminal. The first-terminal record was preserved; no later guest protocol,
input, capture, retry, quit, original launch or guard extension occurred.
The actual transport log contains zero Input requests and zero Browser.close.
All 161 native owned tasks were reaped; all three parent receipts have actual
waits and separate stdout/stderr EOFs. The recovered image was separately
reviewed after terminal: a red stepped fixture triangle on black, with white
page surroundings. It establishes no original-game progress. Alive arena,
firing and displacement remain **unverified**.

The corrected paths for a separately authorized future run are
`cancellation/prepared/input-service-review-ready.json` and
`cancellation/prepared/runtime/fixture-startup.png`, relative to that run's base.
No second box or retry is authorized by this run.

Before shutdown, independent rereads verified 57 unique native artifacts,
317 gzip streams and the PNG CRC, with no integrity errors. Exactly one
delegated normal stop archived `bx_7w69crw8`, UUID
`936e79bd-c818-4b71-be45-372fd9667e9b`, at
2026-11-09T22:44:05.713Z. Receipt `stop_ee40498d68c811b1` is completed,
forced false, error null. Initial expiry was 2026-11-09T23:05:39.088Z;
final archiveAfter is null. The independently observed immutable watchdog
had deadline 2026-11-09T23:05:39.703Z; its actual parent wait returned 0 with
separate EOFs, and its config hash remained unchanged. No owned box remains
live. Free disk remains above 1.5 GB. Single-task worker releases STOP.
