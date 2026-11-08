# Q3 retained driver readiness and close composition — 2026-11-08

Offline only; BoxNONE. No Chrome, browser, guest, game, original retry, remote
runtime, agent, deployment, or peer source edits. SuperTux2301 retains the next
heavy runtime slot. This work does not qualify Q3 WebGL or reproduce gameplay.

`tools/q3-native-driver-composition.cjs` composes the genuine retained
`scratch/runs/20261108-q3-gl-readiness-gameplay/browser-run.cjs` through the exact
2248 adapter in isolation, verifying pinned PATH/SHA providers. It never writes
back into either historical directory. The adapter had selected terminal close
but left the original 100×100ms startup poll. The new composition selects the
published `supertux-native-lifecycle.cjs` readiness wrapper at that actual launch
site. Its accepted 120s startup ceiling remains subordinate to the immutable
runtime deadline; it neither relaunches nor retries Chrome.

The actual close call sites share one promise. The selected lifecycle wrapper
retains its existing 20s/5s/5s close phases and 30s total cap. Actual terminal exit,
stdio EOF, pending CDP settlement, command ACK, and supervisor custody remain
distinct. Pending CDP requests are explicitly rejected as UNKNOWN during cleanup;
an error or timer is never converted into successful completion. Profile removal
and local cleanup publication require actual terminal/drain and compressed-stream
EOF. Failed drain preserves the profile, records the receipt, and withholds quit
ACK. Kernel custody remains separately owned by the existing supervisor; its
dec33253c provider is hash checked, not rerun or replaced. No local receipt
establishes historical lineage, untraced-clone or nonleader completeness.

Production invocation, after the existing final provider/startup barrier:

```sh
Q3_NATIVE_COMPOSITION=1 \
Q3_EXECUTION_BOUNDARY_OUT=/absolute/unique/run/execution.jsonl.gz \
node --require ./tools/q3-native-driver-composition.cjs \
     --require ./tools/q3-execution-boundary.cjs \
     ./scratch/runs/20261108-q3-gl-readiness-gameplay/browser-run.cjs
```

Retain the original finite `BROWSER_DEADLINE`, independent deadline watchdog,
native kernel supervisor, provider manifest, and unique `CASE_TAG`. Select this
composition **instead of** the 2248 adapter preload; do not load both. Include
this new tool and its dependency providers in the next final startup barrier.
The execution preload must run after composition installation and before the
consumer compiles. Missing preload, changed hashes, absent/nonunique call sites,
or missing GL configuration fail closed. No launch command was executed here.

The retained GL preload still invokes `configureDiagnostics` at actual
`GLRenderHost` assignment before host-import construction. Focused controls
compile the composed driver, execute that exact preload against a minimal module
assignment/import fixture, verify order, and run the genuine execution preload.
Those are syntax and call-site controls, not observed native GL arming or GPU
completion. The owner-directed disk guard is 1,500,000,000B, with no RAM gate.

The focused test executes the composed retained command consumer and its real
numbered transport with Node-owned child/stdio fixtures. Browser launch, CDP,
server and game boundaries are explicitly local protocol stubs; lifecycle
readiness and terminal/EOF receipts use real processes, files and promises, with
no injected readiness/drain/custody success flags. The old selection fails with
DevToolsActivePort ENOENT before an actual Node child publishes it at 11s. The
composed consumer waits past 10s, reaches the real command loop, and completes
quit only after actual close/EOF. Additional cases cover terminal exit7 before
readiness, missing execution preload before launch, a genuinely pending CDP
close, escalation, and an inherited pipe writer surviving leader exit past30s.
Linux fixture subreapers actually wait adopted pipe writers; these receipts
carry no native game/kernel custody inference. Fixture/watchdog children are
terminated when necessary and actually awaited.

Two bounded limits are intentionally preserved. Escalation can exceed the
retained transport's 20s command work deadline: that command stays UNKNOWN and
gets no ACK even if local cleanup subsequently drains. An inherited writer that
outlives the unchanged30s lifecycle cap yields drained:false, normal:false even
with actual leader exit0. Later writer completion/custody never retroactively
turns that failure into a normal close. A future original encountering either
condition must stop and preserve evidence; this offline composition does not
claim to repair an unidentified inherited native pipe holder.

Evidence: `scratch/runs/20261108-q3-readiness-drain-integration-2305/`.
Focused controls and `flock /tmp/wine-build.lock bash tools/build.sh` are recorded
with gzip logs from the first stored byte; final focused suite and final locked
build both PASS. Early control failures (historical
5GB guard masking startup, then expectations incorrectly treating command/CDP
timeouts as pending/successful) remain retained. Exact Git SHA plus small own
patches provide source recovery; existing artifacts are PATHHASH references.
Exhaustive regular-file inventory independently checks stored/original SHA,
sizes and gzip CRC. The board watcher has an observable1800s deadline and a
same-shell EXIT trap recording actual tail/pipeline waits and gzip EOF.

BoxNONE: not created; final state NOT_CREATED, expiry null, stop receipt N/A.
Next: a separately authorized original may select this composition after final
provider verification and the independent supervisor/watchdog barrier. Q3
gameplay, GL ownership/arming and native pipe-holder cause remain UNKNOWN.
