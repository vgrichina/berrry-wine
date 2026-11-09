# Drakan current flight 0618: current CPU fails the published observer identity gate

The separately authorized fresh run stopped during offline preparation with a
concrete causal blocker. The requested current CPU is
`a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`,
2,185,596 bytes. The published ordinary-browser Drakan observer accepts only
`4b45bda53a90b665896cf3b85d9a157b7c3703563c88b6666e4ee2e4b346bcc3`,
2,184,500 bytes. Actual `host.js` compile/start execution rejects a320 with
**Drakan selected module SHA-256 mismatch**, before creating the owning Worker.
There is no eligible browser observer owner for the requested combination.

Evidence: `scratch/runs/20261109-drakan-current-flight-0618/`.
`composed-result.json` records the failure and controls. `source-base.json`
identifies the exact published Git base and SHA/size of every tested provider;
all tested production providers equal their published Git blobs, and their
relevant uncommitted diff is empty. No production source was changed.

The offline harness references the accepted 2140 test's realm/start helpers in
memory and executes the actual current `WineAssembly.getWasmModule()` and
`_maybeStartGuestWorker()` methods. Boolean opt-in is established before compile.
The ordinary artifact path makes one module fetch, compiles the actual selected
a320 bytes, then fails its private compile-record digest gate. Explicit source
selection and artifact-failure/source-fallback controls reach the same rejection.
Source compilation boundaries are synthetic and supply those same a320 bytes;
this is not a source-compiler or real-browser execution claim. No supplied Module,
canonical-byte substitution, extra canonical refetch or historical pointer is
used. The source-fallback control is offline only.

For each of these three paths, calling the real browser observer method fails
as unavailable. Its synthetic delayed release remains pending until settlement,
then its live releasePromise joins and retains the synthetic release rejection.
This is release-error control evidence, not physical input evidence. Two further
controls confirm that late opt-in cannot recover missing compile provenance by
refetching, and shared mutable source bytes are rejected. No original actor,
keyboard FIFO, guest instruction execution, native input, Chrome or guest Worker
was started. The first original attempt was never reached.

The exact current custody provider is
`5ec810c4d4704ff86afc367b38f7335edf1214e3450ebb98a62ce3df6386b5fe`.
Its lineage repairs do not alter the independent Drakan module gate. The same
4b45 identity also remains in `lib/drakan-observer-worker.js`, the owning
GuestThreadHost request and the guest Worker's byte verification. Changing only
the run manifest cannot admit a320 while preserving those barriers.

The 2140/2105/2127 retained inventories and current 0545 custody/build proof
references were independently reread by SHA/size; compressed entries also passed
Python decompression and independent GNU gzip CRC/decode checks. These retain
their original scope: the older Drakan completion tests qualify 4b45, not a320.
They cannot be relabeled current-CPU acceptance. No identical production test or
build was rerun. The new focused composed preflight passed its five expected
refusal/release controls. Its parent records actual exit 0 and separate stdout
and stderr EOF. Earlier evidence-verifier schema/compressed-path/current-compat
assumptions failed and remain retained; the corrected verification passed.

`candidate-dependencies.json` regenerates the predecessor's dependency inventory
with current published providers and actual existing module hashes, entirely by
reference. Legacy physical helpers remain identified by their existing paths.
This is not an admitted, staged or qualified runnable closure: the selected-CPU
barrier failed first. No source tree, media, module copy or archive was made.
Run-specific source recovery uses small patches plus Git, and logs are gzip from
their first stored byte.

Quake2's exact 0600 ARCHIVED PHYSICAL_DRAINED board release was observed.
Warcraft0615 subsequently acquired its own runtime and posted its exact ARCHIVED
PHYSICAL_DRAINED release at 06:21:08Z, with stop `stop_407013aed3cf9a58`.
That peer report explicitly retains incomplete kernel custody and missing waits;
it does not turn absence into wait proof. This task never acquired a slot, called
its runtime or edited its providers. The required drain was never bypassed.
Since admission already failed
offline, no watchdog/create was attempted. Box ID **NULL**, state **NOT_CREATED**,
UUID/expiry/stop receipt **NULL**. There are no owned or adopted remote processes,
ports, profile, input or runtime locks to drain. Local offline children have
actual waits and separately drained streams; absence is not substituted for a
wait. Free `/home` exceeded 1.5 GB at verification.

No T, Up, heading, attack, capture, rearm or retry occurred. Takeoff, native
down-active completion and onward flight remain unqualified. Exact32, native
CALL/RET, strict owner/preCPU/preDLLmain checks, deadlines, workACK and freshness
caps were left unchanged. Next work needs a separately qualified current-CPU
Drakan observer admission across the browser and owning Worker, with its native
completion/release controls, before another separately authorized original.
Single-task STOP after publication.
