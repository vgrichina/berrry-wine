# Recoil Software UTF-8 browser proof and explicit gate, 2026-11-08

Run: `scratch/runs/20261108-recoil-software-utf8/`.

Completed the actual generated-browser owner/source diagnostic and implemented
an explicitly named, tested Software gate in `tools/strict-software-gate.cjs`.
Also repaired supervisor custody before the sole Chrome attempt. This is local
integration evidence, not original-game validation or a gameplay consequence.
No original game, native input, remote box, public deployment or subworker ran.

## Actual browser proof

Read the predecessor notes at `c7e3aea75` and `807e003e2`. Copied the accepted
UTF-8 successor, source-response handler and supervisor into this new run.
The accepted 41-response actual HTTP transport regression, 28 attestor negatives,
production-copy, absent-renderer and prior build evidence were independently
hashed and reused without rerunning them. All 851 retained providers were
independently reread and hashed before runtime. `PREFLIGHT_ONLY=1` and exact
41-wrapper syntax passed; allocation retained `host.dx_trace(21,7,2,0,0)`.
The generated fixture reconstructs its production modules from exact Git
providers in memory; it stages neither a source-tree archive nor game media.

Exactly one generated Chrome attempt passed. `source-response-1.js` through
`source-response-4.js` retain the **complete actual** uncached CDP responses;
`source-responses.ndjson` records their sizes and independently verified hashes.
The recording wrapper retains responses before attestation, including refusals
if any occur. This attempt had four successful responses and no source refusal.

- Decoder: script7, context1, 205,003 UTF-8 bytes each read,
  SHA256 `8697e0a455f43c8045bf6d70283f3207bc7207d9cf86fd9a980daa209591164a`.
- Compositor: script44, context1, 227,980 bytes each read,
  SHA256 `94121a91b28550ee04da6fbd7e56d40bf75703b78c92990d1f0fd1b8a36faa24`.

Both reads share the same actual owner epoch and context; the second copy
advances generation. The actual production destination layer returns pixel
`[255,0,0,255]`. Real `wine.hostCtx` replacement is refused and closes the
attestor; the subsequent read refuses replay. `browser-proof.json` and
`generated-clock-check.json` retain these results and the independently checked
same-host clock bracket. These are JavaScript sources, never renderer WASM.
The original hardware gate stays closed for this route.

## New supervisor repair and lifecycle evidence

The inherited supervisor sampled `/proc` every30ms and recorded adopted exits
only after `waitpid`. The new run-owned supervisor uses kernel ptrace
fork/vfork/clone stop events, including thread clones. Every child is recorded
with PID, `/proc` start identity, PPID/TGID and custody sequence before release.
A child initial-stop can arrive before its parent's fork event: that child
stays parked until the parent event supplies its lineage. Every terminal
status is first peeked with `waitid(WNOWAIT)`, its current identity/custody
fsynced, then consumed with `waitpid(WNOHANG)`. No sampling interval supplies
custody. Unsupported nonleader-exec identity transitions fail closed.

The first fast-fork control exposed that initial-stop/parent-event ordering;
its failure, journal and incomplete initial drain remain retained. The corrected
control independently witnesses38 process identities across50 traced tasks,
including rapid parent-reaped children, orphaned grandchildren,12 threads and
a signaled exit. All50 are registered before reaping and independently absent.
The failed control's discovered PIDs are also independently absent.

The successful Chrome lineage records197 tasks,197 pre-exit stops,197 durable
pre-reap records and197 reaps, with no remaining recorded task. These are
kernel-followed ptrace descendants, not a claim to audit adversarial
`CLONE_UNTRACED` flags; syscall flags were not separately captured. The journal
therefore establishes the recorded kernel lineage and pre-reap custody without
the predecessor's sampled-descendant gap, rather than a universal process-
creation audit. Independent postflight checks additionally find both loopback
ports closed, no process or open FD referring to this run's Chrome profile,
watchdog/supervisor absent and runtime lock free.

An observable independent25-minute GNU timeout plus an inner90-second timeout
is armed before Chrome is allowed to run. Overall and cleanup deadlines are
fixed, and ptrace EXITKILL prevents tracees surviving loss of their supervisor.
Only the actual runtime holds `/tmp/wine-runtime.lock`; it was released before
subsequent code work, tests and build. No input was dispatched or held.
New box ID/state/expiry/stop receipt: **N/A**, local only. Inherited archived
boxes were untouched.

## Explicit Software gate

`createSoftwareGate` has contract
`Software:guest-WASM+actual-decoder-JS+actual-compositor-JS/v1`.
It is a passive gate, separate from the existing hardware gate and native input
driver. It does not dispatch Resume or any key. Its page installation binds
both observations to the exact same actual WineAssembly object in one call.
It requires a live isolated guest endpoint, actual guest Worker instance,
complete uncached WASM bytes matching the explicit guest pin, and the actual
software decoder/compositor function locations, JavaScript hashes and current
execution contexts. None of those JavaScript responses fills a WASM field.

Each probe performs two reads, each with three complete responses: guest WASM
plus decoder/compositor JS. Independent guest/software lanes drain through
`Promise.allSettled`; the software attestor independently drains its two JS
lanes. Owner/instance/endpoint/module identities remain stable across transport,
both reads and final pixels. The final synchronous page evaluation colocates
owner references with actual screen PNG pixels. Retirement during asynchronous
evidence saving is rechecked before return, including the actual guest instance.

The caller must supply independently verified same-host OS-clock status; each
probe also checks an actual target clock bracket against the host wall and
monotonic clocks. All source request ages, native-copy ages, PNG capture,
decode and evidence saving count against250ms. There is an immutable overall
deadline and a maximum5-second transition window. The gate requires exactly
one nonliving `beforeResume` baseline, then a pair of fresh living images with
changed timer-region hashes and pixels changed from that baseline. Nonliving
images reset the pair. Entry, both owner reads, pixels and return evidence
sinks are required. Identity/clock/transport/sink/freshness/concurrency errors
produce sticky UNKNOWN; subsequent calls send no replay. No renderer-WASM
fabrication, observer bypass, guest writes or clock/seed/config changes exist.

Integration uses `install({send,pageSession,ownerExpression})` once on a fresh
page, then `createSoftwareGate` with current worker/script maps, explicit
`guestSha256`/decoder/compositor pins, `deadline`, `inspect` and `save` sinks.
The caller's source-response transport must retain full responses before
returning them, as the successful generated fixture does. Existing native
release/deadline controls remain the caller's responsibility; the gate itself
has no input API. No existing hardware/native driver was modified or bypassed.

## Validation and recovery

The new focused gate test passes46 rejection controls, with real PNG decoding
and **mock CDP** transports. It verifies six uncached responses per probe,
three concurrent source lanes, changed/reset timer pairs, all phase sinks,
250ms/transition expiration, native guest instance replacement, JS owner/context
retirement (including during final evidence saving), malformed/changed bytes,
missing guest targets, live render-route conflict, sink failure, concurrency,
sticky UNKNOWN and no replay. Its mock responses are not additional actual
Chrome evidence. The Software gate has not been exercised against an original
game or a second Chrome run.

`flock /tmp/wine-build.lock bash tools/build.sh` passed after the final code
change. The earlier successful build and intermediate focused results are
retained separately. The old attestor and hardware/native gates are unchanged.
`retrieval-verified.json` independently verifies the artifact manifest, actual
response bytes/hashes, lifecycle sequences and inherited test hashes before
publication. Exact Git SHA, relevant binary diff, small owned new-file patches,
and existing media/provider paths with hashes provide recovery; no source-tree,
media or test-binary archive was created. Peer WIP is excluded from the commit.

Next: separately authorized original Software use of this explicit gate and
existing independent input-release controls, before a reviewed native gameplay
consequence. Full27, parity, audio and FPS remain open.
