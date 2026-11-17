# GLTron original USER/render phases, 2026-11-17

Evidence: `scratch/runs/20261117-gltron-original-render-user-phase-cause/result.json`.

One fresh original per backend was used; neither may be repeated in this
assignment. No production repair, reviewed live turn, round consequence or
original native Quit is established. The WebGL attempt isolates an unresolved
444 ms interval before the owning Worker's next USER import. The recorded
623.46 ms render drain starts **after** cancellation and cannot explain it.

## Review failure and qualification limits

The software original's first Enter was incorrectly written in the same tool
call that requested its image, before the returned image was personally
inspected. Its review text also incorrectly described a title prompt; the
actual initial whole image was black during initialization. This violates the
required review ordering. Input stopped after recognizing the mistake. Its
63 ms native return and subsequent visible main menu are diagnostic evidence,
not reviewed gameplay qualification. There was no second software original.
The same ordering error invalidates reviewed-input claims for preliminary
`authored-software-v2` and `authored-final`; explicit correction records remain.

Before the WebGL original, `authored-reviewed-webgl` used separate image-view
and subsequent intent tool calls. Reviewed Enter returned through real owning
USER in 67 ms with independent physical UP, and the next whole image showed
the red background. Reviewed Escape subsequently cancelled at token zero and
scene age 331 ms; input stopped. This validates the observer and cancellation
path, not native Quit or equivalence to the original workload. Existing
active/parked, context-loss, future-request, stale-owner, noDown and parent-stall
proofs remain unchanged predecessor proofs; they are not newly requalified by
the overloaded diagnostic fixture.

## Original WebGL phases

The initial black image received only an observation request. The next whole
image showed GAME highlighted. After separate personal review, Enter returned
through owning USER in 136 ms. A later whole image showed START GAME in the
GAME submenu. The separately reviewed Enter for that selection cancelled.

| Phase | Wall timestamp, ms | Meaning |
| --- | ---: | --- |
| Last owning USER import entry/post | 1794923174330 | Slot 0, pinned guest Worker |
| Page observes native context | 1794923174332 | Authentic observation |
| Owning USER import returns | 1794923174333 | Empty native poll |
| Physical DOWN applied | 1794923174361 | Observation age 29 ms; CDP round trip 11 ms |
| Last early status | 1794923174399 | DELIVERY_PENDING, token 0 |
| Next status cancels | 1794923174772 | Scene age 440 ms, token 0 |
| Next owning USER entry/post | 1794923174777 | 444 ms after prior API return |
| Page observes that poll | 1794923174780 | 3 ms after Worker post |
| Next owning USER returns | 1794923174783 | Cancelled DOWN absent; no token allocated to it |
| Later synchronous GPU drain begins | 1794923174952 | After the cancellation |
| Later GPU drain returns | 1794923175575 | 623.46 ms elapsed |
| Independent trusted physical UP | 1794923175762 | 1401 ms after DOWN |

The gap between two status calls also includes roughly 373 ms of elapsed
time. That does not establish page CPU time or a specific stalled function.
The observer does not fully bracket `gpu_gl_call`/GL batch waits, guest
execution, OS runnable delay or browser scheduling. There is no demonstrated
cause for the 444 ms interval, and the authored software render-wait example
does not supply one. No speculative production edit or old/fixed claim follows.

Both original display sources retain the default 800×600 dimensions. Public
GPU record counts are retained per complete frame: the last WebGL menu frame
before cancellation has 30 DRAW_UP and 30 BIND records, two CLEAR, two RASTER,
and one each TARGETS, MARK and PRESENT. Later frames have a different mix.
Only the first 64 records retain full fields/input bytes, capped at 16 KiB;
subsequent per-frame mixes and slow-call timings remain available. Raw GL
batch mix and later dynamic renderer input bytes are missing. This is not a
faithful replayable original workload, and elapsed renderer calls include any
scheduler delay. Remaining work is attribution of the pre-USER interval and
complete renderer-workload capture under a separately authorized assignment.

## Source, bounds and closure

Diagnostic observer commit: `051d8f1b621a7d2b0cc4e0315f320786fadad90f`.
Both originals serve the unchanged immutable
`60371e9f3bf83f1fbcfab790f1e34977b06e9ec7` runtime graph. Its complete
host/lib/WAT graph matches the retained predecessor runtime; the sole earlier
helper difference adds authored fixture options. Both real Workers receive
the retained `6de8753b667362e909292536a340219ccbf90eedccb2b8405c31975193f5e78e`
module, pinned before execution. No foreign WIP is served. Per-run exact Git,
relevant binary patches, helper pins, all 359 media SHA references and actual
Worker module hashes are retained. Media and source trees were not copied.

Freshness 250 ms, delivery 500 ms, independent UP 1750 ms and complete capture
3000 ms remain unchanged. There is no forced pump, restamping, guest timer,
configuration or EXE change, private game read, OCR, solver or guest mutation.
The WebGL cancellation has zero subsequent main-controller requests. Later
passive console events come from the prearmed observer while independent UP
and process joins finish; they do not reopen the endpoint.

All six run scopes have actual native/browser/outer-owner/watchdog waits with
both EOFs and empty owned scopes, including failed and review-invalid runs.
Cancellation cleanup is browser termination, not original native Quit.
The selected whole host PNGs remain directly viewable. Supporting PNGs and
closed verbose logs are individually compressed with exact-byte SHA-verified
recovery recipes; no source archive, frame bundle or duplicate media is made.
Temporary profiles and Chrome temporary files were isolated on tmpfs and
removed after scope closure. Shared disk-floor crossings stopped the first
authored run before input. Launch checks required more than 1.5 GB free;
the final shared-disk sample fell below that floor after all task runs stopped.
No box was created: ID/expiry null, state NOT_CREATED, stop NOT_APPLICABLE.

The 18 focused native-input/capture/GPS/observer tests and canonical
`flock /tmp/wine-build.lock bash tools/build.sh` passed. No new code was changed
after those checks. The task stops with the explicit attribution gap, the
software review failure and both original allowances exhausted.
