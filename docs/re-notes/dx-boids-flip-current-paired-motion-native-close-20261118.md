# Boids and Flip3DTL motion and native close, 18 November 2026

Registered original `dx_boids` and `dx_flip3dtl` visibly animate on actual
software and WebGL browser executors. All four successful ordinary title closes
reach native `ExitProcess(0)` before host cleanup, then retire guest/render
runtimes. Each has separate successful driver, Chrome, Xvfb and openbox actual
waits, null signals and both output EOFs.

Evidence: `scratch/runs/20261118-dx-boids-flip-current-paired-motion-native-close/`.

| Original/backend | Personally reviewed settled whole-frame motion | Completed DRAW_UP / PRESENT | Close to native exit |
|---|---|---|---|
| Boids/software | Magenta bird moves down/right; cyan terrain bends sweep up/right | 9,566→13,802 / 142→205 | 331 ms |
| Boids/WebGL | Magenta bird turns and moves left/down, blue bird rises/left, red bird appears; terrain changes | 6,499→10,251 / 96→152 | 123 ms |
| Flip3DTL/software | Broad red and blue cube faces become a dominant rotated red face and narrow blue upper face | 612→846 / 101→140 | 76 ms |
| Flip3DTL/WebGL | Red upper and blue lower faces rotate into broad red right and green left faces | 1,044→1,422 / 174→237 | 346 ms |

Both selected images per successful scope show settled visible geometry; no
startup black-to-scene transition is used as motion. The retained images are
entire 1280×1024 private-display XGetImage captures. The browser viewport remains
800×600 without resize events. Both originals naturally select a 640×480 guest
display at startup; that backing stays fixed across each pair and before close.
The native client is 634×435. No host viewport change, media/configuration
substitution or input occurs between the paired observations. Ordinary focus
precedes settling and ordinary title close follows review.

Diagnostic comparisons exclude Flip3DTL's changing text: display coordinates
x=30..781, y=300..743 contain 2,962 / 4,082 / 60,512 / 60,957 changed scene
pixels in table order. These support personal scene review, without a parity
or performance interpretation.

The passive observer counts successful returns from the actual render Worker
executor. Software reports native software draws and no GL context. WebGL
reports `webgl1`, a live `WebGLRenderingContext`, 640×480 drawing buffer,
attributes and no context loss. Endpoint ID/epoch stay stable and presenter
counts advance. All four current scopes use completed PRESENTs; Flip3DTL has
zero READBACKs here. Its older readback-only graph is not attributed to this
current graph. Renderer/vendor strings are not hardware evidence.

The coherent in-memory graph reuses the tested base Git
`f6962ba5b1cf2829a66f5cc4d80b293c30719b37`, renderer
`06f27181f9c977cd1aed99270040efddca00ed75`, and owning-Worker unload repair
`1ad9afd9201b40a3985421906436bd0023c73ba4`. Retained module SHA-256
`a6002d5dbcfeb534a0eadd223da616e525aa1542dad2bde381fe54e00ee862f8`
is referenced at its existing path without copying or recompiling. Source
pins, RPC overlay, bounded native-close transform and observer suffixes
reconstruct actual successful HTTP response hashes. Registered inputs and
native DLL hashes remain unchanged before/after. Relevant shared WIP is
recorded as binary diffs and excluded from served bytes.

Boids handles the ordinary close through native `DestroyWindow`,
`PostQuitMessage(0)`, `PeekMessageA` returning WM_QUIT, and `ExitProcess(0)`.
Flip3DTL traces native `DefWindowProcA` WM_CLOSE/WM_DESTROY,
`PostQuitMessage(0)`, `PeekMessageA` WM_QUIT and `ExitProcess(0)`.
Exit stack arguments are zero before host stop. Retirement and process waits
are separate observations. Independent finite supervision finds no leaked
tracked children or deadline termination in successful scopes; all tracked
runtime PIDs are absent. Forced cleanup is never counted as native close.

Two preparation failures remain separate, permanently closed UNKNOWNs. The
first software Boids scope waited on bridge `stats.records`, which stays zero
on the doorbell path although active device records advance. It captures no
frames and reaches its finite deadline. A read-only observation before closure
proved the counter mismatch; the materially corrected fresh scope uses device
records. The first software Flip3DTL scope captures one visible frame, then
rejects the current PRESENT route because its assertion expected historical
READBACKs. Its retained completed counts prove DRAW_UP=870, PRESENT=144 and
READBACK=0. A fresh scope accepts completed PRESENT or READBACK and records
the actual route. The still-unlaunched WebGL scope receives these preparation
corrections before its first launch. Neither failed endpoint receives requests
after closure. The enclosing invoker exits zero even when its supervised driver
exits one; actual driver waits are retained and govern these UNKNOWN records.
No old UNKNOWN is replayed or retrospectively upgraded.

No product defect was proved and no product code changed, so no new build or
broad unchanged qualification was run. The published unload repair and tested
capture/close helpers are reused; dd9 dual-executor regression files remain
byte-identical. Run-local readiness/route corrections, verification, exact
Git/diffs, owned input patches and recovery recipes are retained. Growing
transients use owned tmpfs; unique evidence is retrieved and round-trip hashed
before removal. Successful runtime /home samples exceed 1,500,000,000 bytes,
but a later finalization sample falls to 1,498,841,088 bytes after all originals
are closed and retrieved. The task's continuous disk-floor requirement is not
met; no further original is launched. Shared capacity recovery is separate
from the runtime results.

Foreign WIP and security holds are preserved. No workers, boxes, Wine,
hardware/FPS/Windows-parity or deployment claim. Box ID/state/expiry/stop receipt:
null / NOT_CREATED / null / null. `result.json` is written last. Ownership is
released and the task stops after publication.
