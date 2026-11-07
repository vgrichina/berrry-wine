# Graphics Worker readiness repair and native captures, 7 November 2026

The CDP harness now returns a boolean at the readiness boundary and rejects a
readiness timeout before capture. The exact repaired driver passed locally
against generated public-COM input on production guest/render Workers before
one fresh box ran the four requested original configurations. All twelve full
compositor captures were inspected at their native viewport. Tunnel software
Worker, Tunnel WebGL Worker and Twist WebGL Worker show clear object motion.
Boids WebGL Worker shows moving cyan terrain boundaries and one blue triangular
object; a recognizable multi-bird flock is not established. No emulator defect
or production implementation change was demonstrated.

Evidence and the reusable run-local harness are in
`scratch/runs/20261107-graphics-worker-readiness/`. This closes the predecessor's
serialization/capture harness failure. It does not resolve cooperative WebGL
Boids frustum classification, reference parity or historical27 coverage.

## Readiness repair and local proof

The predecessor returned `wine.guestWorker` through
`Runtime.evaluate({returnByValue:true})`, producing `Object reference chain is
too long` before its first original capture. `readiness.cjs` now evaluates:

```js
!!(typeof runningApps !== 'undefined' &&
   runningApps.find(a => a.name === selectedApp)?.wine?.guestWorker)
```

The actual helper inserts a JSON-quoted app ID into that expression. Every
evaluation must return a boolean. Exhausting 150 polls throws a specific
readiness timeout; it cannot fall through into capture.

The final `browser-run-fixed.cjs` ran its native keyboard/type/combo preflight,
then the actual readiness loop and all three final `capture()` calls locally.
Its generated page uses the existing public-COM fixture with real
`GuestWorkerLink`, `RenderWorker.Manager`, guest Worker and render Worker on
the pinned standard module. The generated page wrapper exposes those real
owners to the same capture identity chain used by originals. No guest module
or Worker target was replaced with a mock. This fixture qualifies the harness,
not original-game pixels or autonomous guest gameplay.

The exact expression returns false for an absent app and for an app whose
Worker is not ready; both cases must exhaust the same readiness function and
reject. Restoring the live production owner returns true. The old expression
returns an object in this smaller fixture, failing the scalar contract; it
does not reproduce the original controller's deep-graph CDP error. An initial
local attempt incorrectly required that exact error string and failed; that
attempt is preserved. The corrected final fixture independently passes the
negative controls, stable actual-owner/module checks and three full captures.
All three labeled generated images were inspected.

The inherited staged producer/publisher/consumer, exact ACK, trusted native
key/combo delivery, independent release and reason-specific sticky closure
controls passed unchanged. The actual original-app prelaunch branch passed
with zero guest launches. The complete final prefix rejected missing and
corrupt versions of all 622 pinned inputs and invalid deadlines. Three
`ops/browser-native-input.test.cjs` tests and `test/test-d3dim-draw-trace.js`
passed. No diagnostic observer was installed on an original. The predecessor's
passing production image-base/guest-translation fixture remains separate;
no guessed `moduleMap`, new fences, flushes or guest export probes were used.

## Original observations and actual owners

Each configuration launched once through its ordinary registered route, with
the host's Worker/backend settings. There were no original guest input events,
camera/configuration edits, clock changes or substituted media. The cold
native input checks ran on a blank document before original selection.
Captures occur approximately 15, 30 and 45 seconds after navigation while
execution continues. Counters are passive interval observations, not pixel,
frame-alignment or FPS oracles.

| Configuration | Reviewed full compositor observations | Host slice sequence; owning WebGL draws |
| --- | --- | --- |
| Tunnel software / guest Worker | Gray textured tunnel rotates; yellow/black radiation signs change position, size and orientation inside a fixed window. | 94 → 254 → 464; direct software draw counts unavailable. |
| Tunnel WebGL / guest Worker | Tunnel opening, gray walls and warning signs change position and orientation. | 756 → 1545 → 2272; 2032 → 4066 → 6223. |
| Twist WebGL / guest Worker | Textured blue/gray body changes silhouette and visible face; its round end and warning band rotate into view. | 893 → 1873 → 2832; 1568 → 3294 → 4937. |
| Boids WebGL / guest Worker | Cyan terrain edges shift and one blue triangular object remains visible with a small pose/shape change. No recognizable multi-bird flock in this interval. | 32 → 43 → 55; 34 → 66 → 102. |

All four actual guest owners are endpoint 1, slot 0. CDP recovers the live
guest module and checks its bytes around every capture. Software Tunnel has
no owning GPU/render endpoint; its observed execution is guest-owned software,
with no independent direct software completion counter. Each WebGL case has
one actual legacy render endpoint 1 on a separately identified production
render Worker. Recovered guest/render modules match. Each WebGL endpoint
reports ready, zero errors/fallbacks, zero direct software draws and zero
fallback software draws. Per-case target IDs, object/instance epochs, module
hashes and stable capture bindings are retained in `coverage-ledger.json` and
the capture receipts.

Native inner geometry stays 1024×712, outer 1024×855, with no emulated viewport
or secondary viewport-changing observer. Tunnel/Twist compositor canvases
stay 684×514. Boids naturally selects its ordinary full-page 640×480 canvas,
displayed at 684×480 beneath the app banner; that geometry stays fixed across
its three captures. All original native-input recorders and sampled input
queues remain empty, with no held buttons or recorded escaped trap. These
bounded windows do not establish unrestricted crash freedom.

The environment is Node 24.22.1 and Chrome 151.0.7922.108 / BetterChromium.
Owning WebGL receipts report WebGL 2 and an ANGLE Intel/Mesa UHD 620 string.
The actual launcher forces `--use-gl=angle --use-angle=swiftshader`, and
`/dev/dri` is absent. This is software WebGL execution; the renderer string
is not physical-GPU evidence.

## Provenance, retrieval and cleanup

Runtime source is main `38b9f7d3191a0d2e839bc8694e38de9f395e9643` plus
`relevant-source.patch`, `untracked-inputs.patch` and the small run-helper
`owned-inputs.patch`. All 315 checked source inputs reconstruct from Git and
patches. All 40 original input files and the complete three registered
manifest objects match their retained pins. All 622 staged inputs match before
each original launch and again at terminal inspection. Git is the source
archive; no source/media archive or original-media evidence copy was created.

The actual live standard module is 2,182,493 bytes, SHA-256
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`.
The staged compatibility module is 2,185,139 bytes, SHA-256
`04acbb89f66ad9814836b5e2c34de659b518f4e1994f50c4ee8069c991f02f72`;
it is recovered but not identified as live. This task did not rebuild modules
or change production code. It does not equate the JS/source snapshot commit
with the modules' compilation commit; earlier graphics findings retain build
provenance.

One UUID-idempotent box, `bx_88fguqk8`, was created at 10:28:38 UTC with an
inclusive 35-minute deadline/expiry of 11:03:38 UTC. One original browser ran
at a time, without replay or resuming an old box. Local free disk was initially
below 2 GB, so no runtime began until it recovered. Shared disk growth later
briefly crossed the guard again; the next launch waited until recovery above
2 GB. Recorded guards and the limitation are in `disk-guards.json`.

One read-only Boids retrieval probe ran while Chrome cleanup was still
finishing and correctly refused to inventory a nonterminal case. Its failed
receipt remains intact. A later distinct terminal observation confirmed normal
cleanup, with no action or guest replay. All 151 remote artifact paths,
representing 112 unique files and 6,890,199 bytes, including both modules,
were retrieved and SHA-256 verified before the explicitly delegated normal
nonforced stop. All eight controller/Chrome PIDs are absent, all eight
HTTP/DevTools ports refuse connections, and profiles, profile processes,
writer locks and command files are clear. All four Chrome exits are zero.

The box is confirmed archived at 10:34:41.196 UTC, expiry null, stop completed
with `forced:false`, well within the inclusive 35-minute bound. Final
publication and terminal local disk observations are recorded in run metadata.
Box custody returns to the coordinator; do not resume it. Full flock rendering,
cooperative Boids classification, FPS, audio, reference/backend parity and
historical27 membership/completion remain unqualified. No nested worker or
public deployment was used. `result.json` is published last.
