# MCM current GPS readiness and original startup boundary

The production MCM capture/admission adapter now identifies the actual
`d3dim-gps` bridge endpoint instead of guessing that a sole render port owns
the scene. Startup readiness waits for endpoint readiness and a current first
PRESENT. Capture and admission independently recheck the actual bridge, port,
window, layer, guest and renderer instances, recovered module inventories,
renderer adapter, executor and context. A requested WebGL backend cannot stand
in for an actual software fallback. Context loss, endpoint/ring errors,
retirement, stale publication and replacement refuse admission.

The small shared change in `lib/gpu-stream-render-worker.js` exposes a passive
identity accessor because actual executor/context objects otherwise live only
inside its closure. It reads existing objects, counters and ring error state;
it performs no drain, fence, export call, GL synchronization or scheduling
change. The owning endpoint and instance scope its object tokens. Only immutable
recovered CDP module bytes are cached. The 12,000-ms age gate, repeated live
checks, independent release and stale pre-effect refusal remain in place.
Identity acquisition failures now close the chain even for direct reads or
captures; a stale pre-effect admission refusal still permits a new capture.

Evidence is `scratch/runs/20261120-mcm-current-gps-readiness-quarry/`.
The supplied parent `RECOVERY.md` and the requested note named
`mcm-worker-service-latency-quarry-control-20261120.md` are absent. The existing
`mcm-worker-service-latency-20261120.md`, parent result, retained latency spans
and November 7 notes were read. No latency fix, promise-flag A/B, artificial
busy work or fixture qualification campaign was attempted.

## Production-path result

The first finite Boids check caught the manager's port publication before the
bridge's asynchronous open completed. It closed with no input; it was never
resumed. The startup predicate was then made explicit. The fresh production
check used unmodified HTTP-served runtime sources and actual guest/owning
renderer Workers, each with the single executing module
`fab7c60e39c079c2972458d30c3a36143c6afd68c80f76d97e9e4a0c2f789d92`.
The legacy `d3dStats.renderEndpointId` remained absent (old readiness fails).
The new full chain captured and admitted a personally reviewed whole frame at
**6,985 ms** (new readiness/admission passes), identifying an actual WebGL
executor and live context. That callback sent no native input. The initially
reviewed frame had aged out and correctly refused with zero effects before
the fresh capture. This is an adapter repair, not a performance result.

`production/boids-fresh.png` shows the whole page and Boids2 window: dark
background, blue wire boundaries, colored triangles and a partially visible
textured globe. Publication/slice/doorbell counters advance naturally. No
static reachability or requested backend is credited as exercised gameplay.
The retained parent's 184-ms renderer / 182.6-ms drains / 166-ms guest sync /
32-ms live validation observations are reused; historical multi-second service
latency was not reproduced or repaired here.

## One fresh original

After full current admission and the final locked build passed, one untouched
registered MCM original launched with all **311** existing input hashes verified
and its normal working directory. The selected whole `original/startup.png`
shows the video-memory test dialog. Full live admission accepted ordinary Enter
at age **9,990 ms**. Its independent UP began **102 ms** after DOWN started;
the completed hold receipt records acknowledged dispatches and passive samples.

The retained console then logs **`ExitProcess(1)`**, followed by program exit.
The next capture refused because no registered app remained. The runtime closed
permanently; no replay or subsequent scene/guest/renderer request was made.
There is no claim about the internal cause of that exit. This startup exit is
the precise dependency before name, Single Player Event, Stunt Quarry,
Practice, T-rific, yellow bike, Start, throttle/turn consequence or ordinary
Quit can be established. No original renderer was created, so its actual
renderer/executor identities remain absent. Browser termination is cleanup,
not ordinary game Quit.

## Validation, resources and recovery

The 12 focused tracked tests cover absent legacy readiness, software fallback,
wrong/unbound/replaced owners, replaced executor, context loss, ring errors,
missing modules, detached renderer and unchanged scene age. The actual
doorbell retirement regression passes. The final required
`flock /tmp/wine-build.lock bash tools/build.sh` passes.

The first build exited 0 but is excluded as a resource-valid build: six 100-ms
samples breached the disk floor (minimum 1,446,711,296 bytes). Its run-local
monitor recorded closure without enforcing cancellation; that monitor defect
is explicitly retained. The corrected final monitor signals only its exact
owned supervisor on a breach, and the final build uses compiler TMPDIR on
tmpfs. Its samples and all three runtime scopes stayed above 1.5 GB. Sampling
does not establish continuous free space. No foreign cleanup or RAM gate was
used.

Finite native supervision, direct parent/child joins and honest stdout/stderr
EOF receipts are retained. All tracked processes are nonlive, supervisors
report no leaks, and owned temporary profiles are removed. Exact Git identity,
relevant binary diff, owned new-file patches, source/media hash references and
unique module recovery references are retained; no source tree snapshot,
media archive or bytecode dump was made. Publication receipts record the actual
commit and strict pull/push outcome. No agents, workers, Python, Wine, public
deployment or box lifecycle action occurred: localhost box ID **null**, state
**NOT_CREATED**, expiry **null**, stop receipt **null**. Coordinator shutdown
ownership is unchanged.

The initial tool-owned board watcher returned exit 143; its signal sender and
enclosing tool-pipe EOF are unknown. This is separate from the directly joined
runtime/watchdog/board children whose pipe EOF is recorded in the run receipts.
