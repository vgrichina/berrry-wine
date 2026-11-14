# GLTron startup readiness, 2026-11-14

The browser helper now waits passively for startup display readiness before its
first capture ticket. The tested change is published as
`f6931d34b7ada7386d335624fe77f41803a2ea4f`. The sole fresh original reached the
rendered GLTron title/menu, then refused prebind output visibility. Its diagnostic
shows the HTML fullscreen-consent strip overlapping the game. No ticket, personal
binding or input was admitted. Two intact-cycle corners, a natural round outcome
and native Quit remain **unproved**. There was no retry or second original.

Evidence: `scratch/runs/20261114-gltron-startup-readiness/result.json`.

## Scope and admission

This is a startup-readiness change in `tools/gltron-browser-binding.cjs` and
`tools/gltron-browser-controller.cjs`, with focused controls in
`test/gltron-browser-controller.test.cjs`. It does not change `host.js`,
`lib/renderer.js`, the current-display API, or callback census rows. The distinct
idle-capture fix in `9baf6cec8122baa5698e1934240db8abe1617f84` and its final report
`bbceb4df42e84fef18dca1e80125c93417327251` retain their own scope.

Startup observes the first identifiable owner and keeps its process, worker,
module, renderer, window and instance references fixed. A context/first clear/
present is insufficient: actual frontend draw/present and backend draw/transfer
observations must exist. These observations are necessary conditions, not a
gameplay or nonblack-scene certificate. Personal review still precedes permanent
input binding.

The passive gate requires an actual ordinary complete-display receipt, the same
owner, visible contained output, no pending host publication, no held/in-flight
paint and no pending ordinary damage. It calls the production receipt validator
with an ephemeral local owner request. The validator only marks that local
request selected; no renderer state, ticket, pixel bytes, guest operation or
repaint is produced. Poll pacing is not evidence of readiness. The existing
90-second startup bound and mechanical 180-second Quit reserve remain fixed.

Before an ordinary display exists, output choice is unknown: the normal
compositor can select direct or filtered presentation. Output identity is selected
once from the first valid unheld receipt, then checked through full worker/module
validation and pinned permanently. A later output or owner replacement refuses.
The initial output selection is not a rebind of a captured or closed session.

Capture rechecks owner/output/paint state in the same JavaScript turn as its
ticket request. A known busy refusal has code `CAPTURE_PRECONDITION_REFUSED` and
input state `NOT_SENT`; it is not UNKNOWN input. Every failed capture closes the
chain. Cancellation and transport UNKNOWN remain terminal, including after late
replies. Ordinary damage that arrives after startup can still use the existing
current-display ticket's ordinary-publication path. The 3,000 ms capture limit,
5/30-second gesture freshness, one-use nonces, finite 1,500 ms pulses and
independent 1,750 ms UP remain unchanged. No forced repaint/swap, hold release,
raw slot read, guest clock/configuration change, solver or action loop was added.

## HTML overlay boundary

Canvas bytes do not depict HTML overlays. Admission now scans intersecting
painted light-DOM element boxes, including elements with `pointer-events:none`.
It conservatively refuses them even when their stacking order might put them
behind the opaque canvas. Empty transparent structural containers do not count
as painted merely because Chrome reports an outline width with style `none`.

The Chrome control adds a real red HTML sibling over the output canvas and
demonstrates admission refusal. This is separate from native-window overlap
tests. This guard is a conservative light-DOM bounding-box check, not a general
CSS/shadow-DOM raster-occlusion certificate. Canvas-only evidence must retain
that qualification; the original's browser diagnostic is explicitly different
from an admitted canvas scene.

## Validation

Final production Chrome 151/WebGL2 control, synthetic producer, ordinary
production compositor (`real-chrome-v8/report.json`):

| Check | Result |
| --- | --- |
| Exact predecessor helper during startup hold | Premature ticket at producer frame 0; held-paint refusal |
| New passive wait through ordinary producer completion | No new ticket/input; producer ended at frame 20; first new ticket unheld |
| Complete startup display capture | 262 ms; full gradient window personally reviewed |
| Idle current display | 46 ms; publication 19 unchanged; exact output and Chrome compositor pixels |
| Old next-publication idle ticket | Still pending after its fixed 3-second budget; cancelled |
| Default CDP screenshot | 41 ms; historical stall not reproduced |
| Late hold | Known `NOT_SENT` refusal before ticket creation; hold unchanged |
| Actual startup timeout | 128 ms with a 125 ms control bound; no ticket |
| Owner/output changes, hidden/clipped output, cancellation | Refused; late publication cannot revive cancelled capture |
| HTML sibling overlay, pointer events disabled | Admission refused |
| Actual CDP deadline and late reply | 3-second UNKNOWN; still closed at 3,251 ms; later input calls refused |

Four selected synthetic PNGs were personally reviewed. They show complete
gradients and the exclusive presentation's actual black bands; they are not game
proof. No fixture input occurred. Seven preceding synthetic development controls
are retained, including the initial conservative DOM false positive, normal
output selection transition, a report-serialization bug and an overstrict
ordinary-damage capture guard. These were closed controls, never originals or
reopened sessions. Intermediate diagnostic controls v2/v4 lack independent full
source pins; final v8 has exact Git SHA, source hashes and relevant binary patches.

Final focused controller/loopback/actual-child tests pass, covering passive
readiness, actual timeout, owner replacement, output selection, terminal late
holds, replacement/UNKNOWN/cancellation/no replay, 5/30-second ages and the
irreversible Quit cutoff. Five focused renderer files pass (20 entries, including
16 endpoint cases). Final-source `flock /tmp/wine-build.lock bash tools/build.sh`
passed in 28.37 seconds. Real Chrome blank-page trusted DOWN/UP controls passed
for every allowed key, a 1,500 ms pulse and independent 1,750 ms EOF fallback.
Final code was committed and strict pull/push completed before the original.

## Sole original and custody

The original launched at 21:33:07 UTC with its independent 600+20-second watchdog
already armed, after Minesweeper's native/watchdog/supervisor/outer actual waits,
both EOFs and heavy release. Its exact 677 input pins include all 92 existing
media files, without copies/downloads, plus Git SHA and relevant dirty patches.
Actual recovered guest and renderer module SHA-256:
`c94ccf1b179f18bd4b47867445afed8cef2f1393b19aabfd259c7f3b94a7be09`.
The actual host used 1,000 blocks per slice and normal real clock.

The early owner observation already reported output visibility false. Startup
waited until actual frontend draws rose to 2 (backend draws 3, present/transfer 1),
then the prebind output check refused before the first ticket. The personally
reviewed full-browser diagnostic shows the rendered GLTron title/menu and an
HTML fullscreen-consent strip across its top. This corroborates an unsupported
canvas-only visibility condition; no exact live DOM refusal-reason inventory was
retained, so the strip is not claimed as the sole evaluated failing clause.
No admitted gameplay scene, known human identity, corner, natural outcome or
native Quit is established. Browser close is host teardown.

Native controller exit 1, Chrome exit 0, watchdog exit 0 (unfired), outer child
exit 0 and outer caller exit 0 all have actual waits and both EOFs. Supervisor
zero means successful custody, not game success. The heavy lock is released,
all four recorded runtime/browser/supervisor/outer PIDs are absent, HTTP port is
closed and profile removed. All 677 source/media pins remain unchanged. The
closed direct predecessor's 356 files and current-display predecessor's 260 files
retain their exact names, sizes and SHA-256 values. Neither was reopened.
The ancillary board watcher uses tool-managed pipes; separate pipe EOF evidence
is unavailable and is not included in the runtime wait claims. Intermediate
synthetic v2's tool-managed outer caller also has unavailable separate EOF flags;
its native/watchdog/supervisor waits are recorded independently.

Only five selected PNGs remain in this run; three byte-identical unselected
development copies were removed with exact recovery hashes/paths recorded.
No source/media/WASM archive, frame series or box was created. Box ID/expiry are
null, state `NOT_CREATED`, stop receipt `N/A`. No full-27, FPS, audio, parity or
physical-GPU claim is made. This bounded task ends with a tested published
startup fix and the precise missing gameplay proof above.
