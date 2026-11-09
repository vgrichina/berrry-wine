# Q3 bounded SSH provisioning candidate — 2026-11-09

Code: `ac33d7246fb4cb25e51f19307e6b603a671c048a`, main, strict SSH pull/push passed.
Evidence: `scratch/runs/20261109-q3-large-provider-stream-repair-2215/`.

The Q3 provision consumer now calls `provision_ssh_files` in
`tools/q3-provider-upload.py`. It invokes the sandbox CLI's documented
non-interactive `boat --no-update ssh ID COMMAND` path. The stream contains
individual JSON pin headers and exact file bodies, followed by a session seal;
it is not a source or media archive. The receiver verifies streamed SHA/size,
fsyncs and publishes the file, then independently rereads its final descriptor
before acknowledging the pin. Existing independent remote phase-prelaunch
checks remain mandatory. No unchanged live PUT was replayed.

Local pins are verified before the command starts, on the sending descriptor,
and during streaming, with descriptor metadata mutation detection. Each file
retains an absolute maximum of 30 seconds, including its acknowledgement.
Cancellation, refusal, EOF, mutation and deadlines terminate the process group,
drain stdout/stderr and actually wait. There is one session and no replay.
The prior PUT implementation remains available for its offline regression
controls; production Q3 provision uses the SSH candidate.

## Tests and seal

The actual provision function, extracted from the owning tracked consumer,
passes a **46,853,694-byte generated payload** through real OS pipes and the
actual receiver. Its traced peak allocation is **181,570 bytes**. Both phase
barriers occur only on success. Held-writer, command refusal, sending-descriptor
mutation, cancellation and premature EOF controls each stop after the first
pin, admit neither barrier, reap the sole child and observe both pipe EOFs.
These controls inject the command argv; they do **not** establish authenticated
Boat CLI integration or successful transfer of the real media pin.

The existing HTTP/TLS uploader controls also pass. Generated terminal-consumer
controls pass, including baseline violation reproduction, held screenshot
deadlines, refusal, late reply, planned cancellation and ordinary close, with
actual kernel reaps and separate EOF. Phase-staging controls pass two actual
local prelaunches, five independently reread manifests and five mutation
refusals. Controller pipe/EOF controls pass. The required locked build passes.
Initial invocations of three ancillary tests omitted their required output
arguments; the corrected commands pass and both logs are retained.

Final seal: `fcf6d25263294aa15c7359172102de877591dae5429a5ba58563d98a9718103a`.
Every one of **945 pins in each of five manifests** was independently SHA/size
reread in a separate process before allocation. The real media remains at
`test/binaries/candidates/quake-3-arena-demo-installer/installed/demoq3/pak0.pk3`,
46,853,694 bytes, SHA256
`e77abad2466f45a0a7ea018445528f9b95a0fe7789fa1abc1a7718bbf0754b08`.
It was referenced and verified locally, not copied into evidence.

The durable every-CONT full-prefix barrier, both EXIT paths outside ESRCH,
sticky failure bounds, original timers and native input guards were unchanged.
Shared providers, Nox and Redline were read-only.

## Sole authenticated attempt: terminal CLI integration refusal

The first file is `build/nfs2se-browser.json`, 9,322 bytes. The sender completes
its local body writes, then fails in `remote-sha-size` because the JSON received
from the command does not equal the required exact pin acknowledgement. The
process actually exits with status 1, with separate stdout/stderr EOF. These
local writes do not establish remote acceptance. The task-local remote recovery
inventory and attempted final file inspection return no files or runtime
outputs.

The returned JSON and stderr text were not retained by this candidate, so the
underlying CLI/authentication/framing cause is **unknown**. The evidence does
not prove which component refused the command or whether stdin reached the
receiver. Do not interpret the pipe tests as an authenticated large-media
transfer success. A future repair needs bounded diagnostics and an actual
Boat CLI contract control before another separately authorized attempt.

This first failure was terminal. No retry, PUT fallback, remote admission
check, native fixture, original game, Chrome, CDP, guest input, capture or quit
followed. There are no images requiring model review. Arena entry, alive play,
fire and displacement remain untested. The requested live large-file fix is
**not established**; the concrete blocker is the authenticated command's first
pin acknowledgement refusal.

## Lifecycle and recovery

Sole box: **`bx_bgp3wa57`**, UUID
**`4b7fc471-e145-476f-845a-3024b0bc7991`**. Initial expiry:
**2026-11-09T22:40:32.139Z**. An independent observable watchdog was armed
before allocation, with immutable UUID/configuration, PID/start identity,
fresh heartbeat and deadline **22:40:32.846075Z**. Separate observation verified
its identity and configuration before provision.

Before stop, a separate verifier reread **444 evidence files**, validated
**138 complete gzip streams**, zero PNGs and the remote inventory. The single
malformed gzip is the expected staging corruption control. Zero unique remote
outputs needed retrieval. Exactly one delegated normal stop followed this
verification: **`stop_df60715ecd3f4bfc`**, completed **unforced
22:16:49.168Z**. Independent API observation confirms **archived**,
archiveAfter=null. No replacement expiry was returned. The allocator joined
with status 0; the actual watchdog wait returned **0** with separate stdout and
stderr EOF and unchanged configuration. No owned live box remains.

Git is the source archive. The run records exact Git SHA, a small code patch,
small materialized-input patches, prepare command, seal and recovery recipe.
There is no source/media archive. Next work requires a separately assigned
authenticated CLI integration repair; this worker releases STOP.
