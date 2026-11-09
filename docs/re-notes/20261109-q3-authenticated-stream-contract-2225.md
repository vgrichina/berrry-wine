# Q3 CLI stream diagnostics and preallocation refusal — 2026-11-09

Evidence: `scratch/runs/20261109-q3-authenticated-stream-contract-2225/`.

The authenticated integration goal is **not established**. Before any fresh
allocation, the installed Boat 1.0.96 CLI was invoked with piped binary stdin,
separate stdout/stderr, a small remote Python SHA/size command and a 15-second
control bound. The target was `self`; this environment has no `BOAT_ID`.
The CLI refused locally, returned status 1, and printed this JSON on stdout:

    {"error":"self can only be used inside a sandbox shell where BOAT_ID is set","event":"error"}

The exact argv, response, stderr, actual wait and both EOF observations are in
`actual-cli-contract.json`. No SSH session or authenticated remote command was
established. This control was a poor target choice: it establishes a local CLI
error envelope, not authentication behavior or remote stdin framing. Per the
task's first-refusal rule, no later remote protocol, allocation, fixture,
original game, input, capture, retry or quit followed. No box was created;
box ID/state/expiry, watchdog wait and stop receipt are all not applicable.
There are no returned images. Arena entry, alive play, firing and displacement
remain untested. The prior first-pin refusal's cause remains unknown.

## Local candidate

The owning uploader now uses the documented argument-vector form
`boat --no-update ssh ID -- python3 -B -c RECEIVER ROOT`. The installed help
and a retained copy of `https://docs.boat.dev/cli-reference` document command
arguments, `--`, piped stdin and non-TTY command execution. That documentation
does not substitute for successful authenticated integration.

The receiver emits an exact versioned readiness greeting before reading any
pin. The sender requires it before sending a header or body. CLI error JSON,
an exec-style stdout/status wrapper and arbitrary JSON cannot satisfy it.
Malformed or refused pin acknowledgements remain terminal. The final evidence
row now retains the last reply (up to 4096 bytes), remaining stdout (up to
4096 bytes), separate stderr (up to 65536 bytes), truncation flag, phase,
actual exit status and both pipe EOFs. The actual provision consumer flushes
and fsyncs terminal diagnostic rows. This repairs the lost-diagnostics path;
it is not a demonstrated fix for the historical authenticated refusal.

Each file's original absolute 30-second bound, streaming pin verification,
descriptor mutation check, final independent remote SHA/size reread, session
seal and both phase-prelaunch barriers remain required. The greeting has its
own bounded connection phase; no file timer was increased. Every-CONT full
prefix durability, both EXIT paths, first-unlinked EXIT, sticky bounds,
native input guards, shared providers and other lanes were unchanged.

## Validation and next step

`python3 tools/q3-provider-upload.test.py` passes. Its actual provision
function control executes the production argument construction, real OS pipes
and real receiver against a generated 46,853,694-byte payload. Four pins and
both barriers pass only in the successful case. Thirteen negative cases cover
held writer, held readiness, command refusal, CLI error envelope, stdout/status
wrapper, oversized stdout, oversized stderr, malformed acknowledgement,
wrong acknowledgement, nonzero final exit, descriptor mutation, cancellation
and premature EOF. Every negative case admits zero phase barriers and reaps
the sole child with separate EOFs. These peers replace Popen's argv; they do
not run an authenticated Boat SSH session. Existing HTTP/TLS tests also pass.
The required `flock /tmp/wine-build.lock bash tools/build.sh` passes.

Git is the source archive: the run records the exact base commit and small
owned-path patch, with no source or media archives. Evidence is independently
SHA/size reread. No media was copied and no live PUT or unchanged SSH transfer
was replayed. Free disk remains above 1.5 GB.

Next work needs a separately assigned preallocation CLI control with an
explicit, authorized running sandbox ID, then authenticated stdin/stdout/status
integration. A fresh task must seal and independently reread all phase pins
before its sole allocation, arm and independently observe its immutable
25-minute UUID watchdog, and admit one changed fixture before any original
gameplay. This task releases STOP with the concrete CLI target-resolution
blocker and no owned live box.
