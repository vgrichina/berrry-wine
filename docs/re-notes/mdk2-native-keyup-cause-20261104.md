# MDK2 Medium keyup: decoder progress and trace feedback

Input: `116f2c134f16b7cfe34a8d2a9a3ba9c573ca6019` and
[the retained Medium attempt](mdk2-medium-release-gameplay-20261104.md).
Evidence: `scratch/runs/20261104-mdk2-native-keyup-cause/` (RUN).
This is a concrete offline diagnosis, not a release-consumption repair or a
gameplay result. No Chrome, shared runtime lock, box API, deployment or new
original attempt was used. Box ID/state/expiry are NA; shutdown remains with
the coordinator.

The queued release is behind unfinished native decoding. From step 3712
through 4128, all 27 checkpoints end inside `0x47cea0..0x47e100`, with exactly
16000 observed boundaries per 16 host steps. The final PC is `0x47d9c8`, ESP
`0x074ffcd8`. Original disassembly at that PC reads a decoded dword, shifts it
and writes a 16-bit output sample. Other checkpoints visit its bit-unpacking
and transform routines. The request remains the already completed type-1
`pointer` resource, with active/pending zero; this is not evidence of an
unfinished level1 file-worker request. At step 4128 the original WM_KEYUP is
still queued, Enter raw/previous remain 1/1 and `menu.current` remains `diff`.
The retained 464 rest steps therefore did not establish another native input
poll, the Medium callback, or level construction.

The exact runtime dependency matters. The immutable resolver serves
`lib/guest-rpc.js` from runtime Git
`1329b1ba6eb00144ff77d4cd92a8513d4fc953ad`, not today's checkout.
That original bridge forwards every `log_block` synchronously even when guest
logs are disabled. Thus `d223b191` does not repair MDK2 merely by being on main.
The owning observer calls that original import after its own checks at every
boundary. The pinned host then feeds the Worker's measured slice wall time
back into its next native budget:

`max(1000, min(configuredSteps, round((ranBlocks * 12 / ranMs) / 1000) * 1000))`.

Only a sufficiently spent, non-input-burst slice updates this budget. The
configured budget is 100000; the retained late progress matches the 1000
minimum. Logging and observation costs can therefore reduce native work per
16ms host step, not merely make the same step take longer. A fixed selector
step count cannot be interpreted as a fixed amount of native execution.

The new both-module discriminator executes the unchanged original decoder
at `0x47cea0` through the pinned Worker/dependency closure and the actual
serialized binding/observer. Its explicit fixture bitstream/table requests
65536 output words; it does not reconstruct the game's missing decoder state.
Three arms isolate the original bridge, the exact one-line quiet candidate
applied in memory, and quiet tracing without the construction observer.
Both retained modules take 156 fixed 1000-boundary slices. The original arm
makes 156000 brokered block-log calls; both quiet arms make zero. Guest-region
bytes, registers/lazy flags, output, queued commands and subsequent native trap
state match. The quiet candidate is never installed into the runtime resolver.

Measured timings are diagnostic, without machine-speed assertions. The
quiet observer arm remains substantially slower than quiet tracing alone.
The test executes the exact pinned host feedback statements on the returned
slice timings and saves the resulting next budgets. This identifies two costs:
the synchronous bridge roundtrip and the observer's per-boundary validation.
Removing the observer would discard required continuous safety checks and is
not a proposed repair. Removing only RPC is proved to remove overhead, not
proved to finish this game's decoder and consume the release within 544 steps.

The exact remaining dependency is the owning main thread's live decoder
state/input and caller context at `0x47d9c8`, together with its adaptive slice
budget. Post-release trace samples retain PC/ESP and resource/Level summaries,
but not the decoder object's bit reservoir, input cursor, output counters,
callee arguments or complete calling stack. The separate full main-register
sidecar is from step 3648, before the Medium press, so it cannot supply those
later values. Existing EXE/media/module bytes alone cannot reconstruct that
live state. The native fixture proves the bridge bottleneck and separates
observer cost; it cannot prove this decoder's remaining workload or a later
input poll/callback. Further causal repair needs a bounded discriminator for
that decoder-return-to-input path with its real state, preserving the existing
guards. No additional runtime attempt is authorized by this diagnosis.

Validation adds a SHA-checked retained-checkpoint regression and two original
native discriminator tests to the existing integration suite. The retained
JSON is read directly from gzip where archived and checked against
`released-headroom-2209.jsonl` / `released-headroom-2230.jsonl`; three small
never-archived readbacks have explicit hash/size pins. No historical evidence
tree was expanded. Original guest/code/configuration, 16ms runtime pacing,
512/544 selector limits, native deadline/boundary/record limits and continuous
input/ACK/ownership/history guards are unchanged.

Final validation passed all 146 integration tests, 42 local-runtime tests,
both-module observer parity and `flock /tmp/wine-build.lock bash tools/build.sh`.
The exact retained command/native-prefix replay also passed, including rejection
before another command at 544 steps. In the final native discriminator, median
1000-boundary slice times were 19.061/17.813ms with the pinned bridge,
5.327/5.753ms with quiet observer, and 0.057/0.076ms with quiet tracing alone
(canonical/compat). Median next budgets from the pinned feedback code were
1000, 2000 and 100000 respectively. These local timings do not substitute for
the missing original decoder-return/input witness.

RUN preserves the tested Git SHA, relevant binary diff/new-note patch, bounded
diagnostic logs and original disassembly. Existing media/modules remain path
and SHA references; no source snapshots, tars, media/module copies, npm or
subworkers were used. Initial diagnostic assertion/setup failures are retained
alongside the corrected passing results. Large released diagnostics are gzip
roundtrip checked with a recovery mapping.
