# Q3 phase manifests repaired; native fixture reaches input, 2105

The missing phase-manifest staging is repaired and tested. The single native
fixture passed request 6, reached the rendered WebGL fixture, then failed its
ordinary Enter-key input: **`input delivery exceeded hold bound; DOWN reply
UNKNOWN`**. The original was never launched. Alive Q3 arena, native fire
consequence and displacement remain unverified.

Code on main: `4e802126b`. Evidence:
`scratch/runs/20261109-q3-phase-manifest-native-arena-2105/`.
Exact Git identities, relevant dirty-pin diff and small run-input/code patches
are retained there. No source tree or game-media archive was made.

## Tested staging repair

`tools/q3-phase-manifest.py` validates existence, complete gzip CRC, the sealed
manifest digest, every provider's SHA/size, and both generated runtime pins
before creating either phase directory. It refuses any phase-directory
collision. It places the identical manifest in **each actual phase prepared
directory** and each separate check-only directory. It then executes the actual
`q3-native-prelaunch.py --check-only` for both phases and independently rereads
all five manifest locations, leaving the actual launch barrier paths unused.

The regression exercises both actual generated prelaunch paths and five
pre-mutation refusal controls: missing manifest, damaged gzip footer, seal
mismatch, changed runtime closure, and an original-phase directory collision.
No runtime or browser is spawned by this staging test.

Before allocating the box, a separate Python process independently reread all
five locations and every one of the **943 provider SHA/size pins at each
location**. The sealed raw manifest SHA is
`f6f349593032424a4bb98fbf983fc1163e72a23c87dda1a8dc1f09d7429170e9`.
Both remote actual phase manifests were independently reread again, alongside
the remote master and check-only copies. Both remote prelaunch checks passed
before the sole launch. There were no launch-directory collisions.

The runtime retains published custody batching `02e95626d`, real input-wire
composition seam `c43c85981`, stdin repair `2b945315a`, the pinned CPU module
`3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18`,
the unchanged 20,000-ms CDP deadlines, and existing 100-ms input guard.
Shared custody and RF/Nox providers were not edited.

## New failed boundary

The retained actual Node startup records match request 6's session-scoped
`Target.setAutoAttach` response and resolved promise. The elapsed interval on
that same Node monotonic clock is **3,003.255 ms**. This single changed run
does not establish the cause or causal repair of the earlier request-6 failure.

Startup admission released the native fixture. Its retrieved, CRC-checked
`fixture-startup.png` was model-reviewed in a separate image-tool call: red
stepped geometry on a black canvas at the upper left of a white page. This is
the fixture, not Q3 gameplay. No ambiguous presentation or dependent input
followed that review.

The real input-wire hook records socket-send entry and synchronous return for
DOWN request **314** and UP request **315**, both on the exact page session.
No matching raw reply was recorded before terminal failure; the observer
reports no lost events, dropped records or sink errors. Socket-send return
does not prove wire emission or browser service. Browser/application time and
the actual held interval remain UNKNOWN.

The retained delivery receipt attempted only Enter. UP was attempted at
**100.207 ms**, before the first terminal failure at **101.072 ms**; both
promises rejected around 102.5–102.7 ms. There are no physical-state samples.
No input, capture, quit, replay or original was requested after failure.

The actual custody journal records a consumed ptrace stop for PID **7532**,
start **22593**, at epoch 1794258400.206045, and its next CONT return at
1794258400.6175268: a **411.482-ms observed wait-to-CONT-return interval**
spanning the input guard window. The syscall entry/release inside this
interval was not timestamped. The specific process's Chromium role and its
dependency on the input reply are UNKNOWN. This interval is not a measured
fsync or browser-service duration.

The tracer's own bounded Journal.write observer retained 362 writes, summed
elapsed time 24,142.805 ms, maximum 764.474 ms across the whole run/cleanup.
Those measurements include service and scheduling; they neither isolate fsync
nor establish that storage caused the input failure.

The independent passive loopback/proc observer retained 423 packet observations
(including loopback copies), 87 role snapshots and 24 PID/start role identities.
It reached its fixed 512-record sequence cap before the failed input. Thus it
supplies startup role/packet evidence, **no packet or role coverage of that
input**, and no role identification for newly created PID 7532. Its actual
wait completed 0 with separate stdout/stderr EOF. No observer bound was
extended or replacement observer armed.

## Verification and lifecycle

Passed: new staging/refusal regression; whole sealed generated Node caller
under real ptrace custody, durable-CONT/sticky-error/backpressure controls and
installed real input-wire hook; current capture test including real-hook
composition regression and actual 20-second refusal; generated prelaunch and
custody for both phases; GL closure/observer controls; foreign closure with 27
refusal controls; current generated local controller including stdin repair;
and `flock /tmp/wine-build.lock bash tools/build.sh`.

Two offline invocation errors are retained: an omitted GL-test output argument
(corrected invocation passed), and the historical standalone input-wire test
rejecting its obsolete shared-provider pin. That historical route was not
weakened or used to launch; current generated real-hook coverage passed.
No local Chrome ran.

All **67 unique retrieved artifacts** passed a separate independent SHA/size,
gzip CRC and PNG-chunk CRC reread before exactly one delegated normal stop.
All 163 owned tasks were reaped, with no unreaped identities. The generated
parent, prelaunch child and runtime parent each actually joined with separate
stdout/stderr EOF. Drain checks found closed ports, absent profile, no runtime
FD holders, and released input/runtime locks. Normal Chrome close is UNKNOWN;
kernel reaping is separately established.

Box **`bx_npkwz444`**, UUID **`4e4d66c9-1c02-4ac1-a09b-bd01ef9269cb`**,
is independently API-confirmed **ARCHIVED**. Unforced completed stop
**`stop_92c096e0a23d210c`** ended at **21:07:16.058 UTC**. Initial expiry
was **21:29:45.651 UTC**; final archiveAfter is null. The independent immutable
UUID watchdog was observed before creation, deadline **21:29:46.284155 UTC**,
and actually joined 0 with separate stdout/stderr EOF. Its allocating parent
also joined 0. No second stop, resume or delete was issued. Free /home stayed
above 1.5 GB.

Next separately assigned work: investigate the fixture's unchanged 100-ms
input reply boundary with actual process-role/dependency coverage during that
interval. The native prerequisite failed here, so original gameplay remains
gated. This task is stopped.
