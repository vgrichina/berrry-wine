# TR2 pending-source native progress — 2026-11-08

One fresh original ran with both published production repairs, CLEAR
`0ac9414c6` and transient-writer accounting `f8a4241c7`, pinned through
`de96a87c752c580a2f485d2d265eb2e5c2baeb71`. It produced no qualified
source/canonical/display join. No Up, Space or Control was sent. The new
substantive production repair preserves immutable pending sources through an
unsupported scene without admitting that scene or its cached proof. Original
movement and weapon consequence remain open; there was no second original.

Evidence: `scratch/runs/20261108-tr2-pending-source-native-progress/`.

Before allocation, 596 pins, 558 published tracked blobs, eight HTTP pins,
helper dependency closure, syntax and media hashes passed. Only
`lib/render-worker.js` differs from the preceding accepted runtime closure.
Peer WIP is excluded by retrieving tracked blobs from the exact commit.
Accepted real-WAT/canonical CLEAR and transient-writer results, actualWorker
4096/queue/identity/retirement/cost controls, native 500 ms preflight and delayed
Chrome readiness controls were reused without standalone reruns. The driver
preflight started neither browser nor game. Git SHA, relevant binary diff,
small owned-file patches and existing media path/size/hash references provide
recovery; no source or repeated-media archives were made.

The sole UUID-idempotent box is **bx_a92t8xhv**, identified idle before runtime.
Independent observable normal-stop and 25-minute watchdog delegates were
armed before creation. Initial expiry is **11:08:18.258 UTC**; the watchdog
uses the earlier immutable local creation-attempt deadline. Launch disk had
12.45 GB free. Remote runtime held its own lock. Local wine-runtime.lock was
held only during actual local focused fixtures and released before remote
provisioning, supervision and retrieval.

All six native blank-page 500 ms key preflight holds passed. Reviewed Graphics
showed Hardware 3D Acceleration and focused default OK. Enter admission age
was **8,554 ms**, below the unchanged 12,000 ms guard, and independently
released at **500 ms**. The next capture visibly shows Lara in Venice. The
owning render Worker and endpoint, separately observed WebGL2 context and CPU
and render module hashes agree with the pinned module
`6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`.
The adapter wrapper's null context field is not treated as context proof.

A first client arm request omitted waitMs and was rejected by transport budget
validation before any ID/numbered command was queued or observation ran. The
failure is retained. A distinct valid request with explicit waitMs=0 armed the
full 4096-record journal and received command 1's exact ACK. This is a known
zero-effect validation error, not UNKNOWN or replay. Four actual numbered
commands have exact successful ACKs: Graphics Enter, arm, passive capture,
quit. No gameplay command, guest-memory write, private handler, forced scene,
configuration/clock/seed change or replay occurred.

Before observation, original raw/qualified/discarded are null/unobserved. At
the first observed capture, **27 raw = 0 qualified + 27 discarded**. At normal
retirement, **94 raw = 0 qualified + 94 discarded**: 61 overlapping/poisoned
source-writer, 20 uncovered-scene-publication, ten source-version-overwritten,
three coalesced-before-publication. One scene-discarded source has a sealed
page proof with no versionRejected. These counts are observations, not FPS.
Read-only live CDP inspection confirms exactly one visible top-level window,
its DirectX frame layer present, no caret/menu/animated overlay. The layer
remains outside the supported scene gate.

The first newly isolated defect is *destructive scene accounting*: publication
used an unsupported scene as a permanent discard reason for every pending
source, even if its source proof remained immutable. A later supported scene
could never qualify that source through a fresh canonical read. This is
distinct from legitimate source overlap and from adding support for DirectX
layers. The preceding report already listed scene coverage as open; this run
isolates the incorrect pending-source lifetime within that limitation.

`lib/render-worker.js` now accounts only concrete overwrite/rejection/
supersession while a scene is unsupported. It also records the current cache
serial ceiling, so a cached decode from that unsupported scene cannot later
qualify. A partial refresh cannot rehabilitate that blocked cache either;
recovery requires a fresh full canonical read. Only that new read in a supported scene can pass the unchanged
owner/request/page/host/transfer/publication checks. The scene predicate is
unchanged. Retirement still closes every pending source.

`test/test-d3dim-publication-transient-scene.js` uses the actual production
dispatcher, real WAT swaps/page watches and canonical renderer. Reconstructed
old behavior qualifies zero rows; repaired production qualifies one only after
a fresh canonical read following layer removal. Cached republish remains
unqualified, including a partial refresh of the blocked cache. Actual source-page write, host invalidation, poisoned epoch and
retirement each reject and close raw1=qualified0+discard1. The existing identity
regression now expects pending lifetime instead of immediate scene discard;
its scene refusal remains asserted. The callback ownership census digest and
review cover only this synchronous host accounting/cache admission change.
Focused tests and the required locked full build are recorded in the run.

Initial immediate drain inspection found the launcher/controller still exiting;
that failure is retained. A later distinct read-only custody check confirms
all known owned PIDs absent, Chrome exit 0, HTTP 45321 and DevTools 34405 closed,
profile/writer absent, no matching owned process and all 596 pins unchanged.
All **75 artifact references, 69 unique hashes, 8,416,828 bytes** were retrieved
and independently reread for size and SHA-256 before normal stop.

Normal stop **stop_3f76267d05f86fc4** completed **10:45:43.911 UTC**,
forced=false, error=null. Final box state **archived**, stopped
**10:45:43.892 UTC**, active expiry **null**. The first archive notification
still showed stop pending; a subsequent read-only inspection confirms completed.
Both lifecycle delegates exit cleanly and the supervisor has no children.

Next: native DirectX-layer coverage and remaining source overlap need further
production investigation before a separately authorized original can qualify
and admit reviewed movement/weapon input. Full27, parity, audio, game FPS and
simulation FPS remain open.
