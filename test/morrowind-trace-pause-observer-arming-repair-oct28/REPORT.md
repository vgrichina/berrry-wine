# Trace pause consumer arbitration repair

Candidate parent: `e627e71ed960c4ba4905bd6ac9ff9496daad8a3d`.
Original base: `efa0f32e9dbe7fac2c863737810755473cb458c6`.
Independent rejection: `47a82d1b32098b347397f68ed0705bd1fb0a0b67`.
The canonical predecessor receipt and coordinator review in
`scratch/usage-watch/morrowind-quiet-arming-independent-accept-oct28/` remain
authoritative for their 123 verified payloads. The separate correlation acceptance
`207632c52a1352f1b7b0d41460d135f67b6d2716` remains UNIT/SOURCE only; its unchanged
49 cases were not rerun.

## Demonstrated cause and correction

The production `trace-api` control used the user's `on` value directly for
`apiLogOff`, main/cooperative worker setters, and inherited future-instance state.
Pausing therefore disabled installed observer hooks and other required consumers.

`test/run.js` now shares the original consumer policy between startup and control
transitions. The policy retains nonquiet logging, counts, critical/input dispatch,
ESP diagnostics/audit, breakpoints, observer hooks and standalone memory tracing.
Memory tracing coupled to an API trace follows that trace's pause state.
There is no unconditional forced logging. Both initial logger resets and the
inherited startup reset continue to use `apiLogOff`.

An independent `traceApiOn` state gates detailed main and cooperative worker trace
output, memory dumps and pending returns. A pause flushes deduplication before its
response and clears trace-only pending metadata. WAT counter folding follows actual
logger transitions, preserving one count per call when another consumer keeps the
logger active. Other diagnostic marker routes and legacy nonquiet API lines remain.
Control flag validation, optional exports and thrown setter failures retain their
existing behavior. Observer implementation, source pins and install failures are
unchanged.

## Evidence and reproducibility

Before editing the runner, `predecessor-acceptance.js` was copied byte-for-byte from
the independent acceptance repository and executed against unchanged production
source SHA256 `d06dbc85f92e1e9e8516f726f848204256460dd2d2553a4abee8ea2fa08ed7de`.
Its exit 0 means REJECTION demonstrated: exact argv
`--quiet-api --observe-morrowind-name --trace-api --trace-api-paused`, followed by
`{action:"trace-api",on:false}`, produces `[1,0]` with the observer installed and
inherited setter 0. `predecessor-counterexample.json` is also unchanged.

`source-pins.json` seals the corrected production runner, actual original EXE and
unchanged source/helper dependencies. `acceptance.js` executes exact production
CLI parsing/trace flags, startup state/arbitration, observer import/attachment,
both logger resets in source order, inherited reset, trace control, API entry/exit
hooks and cooperative worker logging callbacks. Only isolation by existing probe
markers, synthetic-host injection and returning the probe context transform the
fixture scaffold; hashes are in `targeted-results.json`.

34 targeted cases PASS, including the earliest rejection boundary, all 16
quiet/observer/trace/paused startup combinations, repeated pause/resume, six other
required consumers, memory tracing, counter continuity, actual observer poll
entry/completion/return callbacks, trace output suppression/resumption, filtered
worker output and pending worker returns, pending main returns, deduplication,
histograms/independent diagnostic markers, and fatal/optional setter behavior.
Three rejecting mutations restore the old control's `on` arbitration, remove the
observer consumer, or remove the trace entry visibility gate. Each exposes the
corresponding failure. Runner syntax and `git diff --check` pass.

Run from the task repository:

```sh
node --max-old-space-size=320 test/morrowind-trace-pause-observer-arming-repair-oct28/acceptance.js /path/to/original/Morrowind.exe
```

Original EXE: 3,907,584 bytes, SHA256
`f48300e194c6917cd98d235d259ebc3ab5d7c2071e9b41d798b996a8ce4d0676`.
Use the canonical predecessor archive for recovery of inherited evidence/inputs;
do not rerun its wrapper in the donor directory. The unchanged predecessor script
requires the rejected runner pin, so replay it in a separate checkout of its parent.

## Qualification and next gate

This is a SOURCE repair candidate for fresh independent acceptance. Synthetic host
tests execute exact production statements, rather than a helper-only model, but do
not execute the complete runner, DLL/guest initializers, WAT/module, game, browser,
or runtime. No gameplay, arbitrary writer, causal or resource-incident acceptance
is claimed. Historical resource failures remain rejected/unqualified.

Resource evidence retains exact Node startup executable/heap flags/environment,
inherited limits, CWD, mount-free argv and canonical parser tree control enumerating
`comma,bearing.txt`. Git DATA 256MiB applies only to Git children. Guarded operations
retain separate stdout/stderr from creation, exit and cleanup/reaping receipts,
fresh aggregate RAM/disk admission and full current shared WAL charged once.
The initial policy read exceeded the terminal capture cap; bounded setup/reads
outside the operation supervisor also prevent a blanket whole-task compliance
claim. Early test-harness ordering, synthetic-stack and cross-realm assertion
failures are retained in the durable operation evidence and were corrected in the
same task; no production rejection was hidden.

Only the isolated repository was modified, apart from append-only messageboard
coordination and this task's durable output. No root/donor index or refs were
modified, and no integration/deployment/worker/Boat/build was performed. No boxes
were assigned; lifecycle ownership remains with the coordinator. The canonical
task receipt records exact publication identity, final allocation and cleanup.
Next decision: fresh independent acceptance of this candidate's changed source
and rejecting controls before integration or separately authorized full-runner/
initializer/runtime qualification.
