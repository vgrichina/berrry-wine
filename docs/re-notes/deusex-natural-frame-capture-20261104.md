# Deus Ex natural frame capture: missing engine-to-readback endpoint

**Stopped at the requested proof boundary. A full bounded capture mechanism
cannot be supported by the retained backend endpoints. No capture mechanism
was installed, no production code changed, and no gameplay or qualification
claim follows.** The executable full-link fixture fails with `MISSING_ENDPOINT`.
Natural host composition and display-method return do not establish completed
engine rendering, the viewport's player actor, or immutable backend output.

This follows [the publication contract](deusex-capture-publication-contract-20261104.md)
at `7c33087cda2f170eb871824c06491b5f34e3d45e`. Evidence and executable fixtures:
`scratch/runs/20261104-deusex-natural-frame-capture/`.
Historical production source is Git
`a504fa248caaecbbb042b65e9ae5384a340ade26` plus the existing
`scratch/runs/20261104-deusex-supported-stack/historical-source.patch`
(SHA256 `9415aea6dbced13143b9dcdceb9d2d3594219a467263f7b3cf2bb623da36c796`).
Seven historical JavaScript files, including the actual presentation filter,
match the original provision manifest; that patch does not change them.
The retained executable module is referenced in place and rehashed:
`scratch/runs/20261104-deusex-owned-publication-pulse/recovered-modules/wine-assembly.wasm`,
SHA256 `8459597c8d66e098d727fb4ab53e1cf46332241dc7eef2e158f3c475a78b1676`.

## What the actual endpoints support

Line numbers here refer to that historical source.

| Boundary | Actual behavior | Missing proof |
| --- | --- | --- |
| `host.js:5789–5817` Worker rendezvous | Releases publication hold after main and sibling slice promises settle | A slice return is not an owning engine render-finished event; no viewport-player binding accompanies it |
| `lib/renderer.js:3815–3965` composition | Selects the presentation stack, draws window and DX/child surfaces, may build a separate exclusive source | The observer enumerates windows after drawing; it does not retain the selected stack/layers/source as one render transaction |
| `lib/renderer.js:1351–1363` display | Chooses exclusive source or logical canvas; direct mode changes CSS visibility; otherwise calls the filter | Returns no selected-source record, output bytes, backend readback identifier or engine identity |
| `lib/presentation-filter.js:595–631,973` filter | Returns Boolean success/failure; may issue Canvas2D work or WebGL draws | No correlated immutable readback; WebGL submission is not readback completion or browser compositor completion |
| Actual `capture-boundary.cjs` | Sequential actor/page samples around a CDP screenshot | Screenshot transport has no frame identity shared with engine, composition or selected source |

The retained 735→736 record has a separate exclusive source and a connected
presentation canvas. Its Boolean `exclusiveSource:true` cannot identify that
source's bytes or exact filter path. The record does not establish which
filter backend actually executed. A logical Canvas2D snapshot would therefore
not automatically represent the displayed output. This offline task executed
no browser or GPU backend; VM canvas/transport fixtures establish control flow,
not successful backend readback.

An additional display limitation is executable: actual `PresentationFilter.present`
returns `false` when its context is unavailable. Actual `_presentDisplayCanvas`
discards that result, and actual `repaint` returns normally. The repaired
observer can increment `published` and the settled qualifier can accept that
fixture. This differs from the predecessor's throwing-display failure, whose
same-transaction repair remains intact. Neither failure is established in the
retained game capture. No production fix was attempted: even propagating the
Boolean would not supply engine/actor/readback linkage.

## Executable obstruction and preserved guards

`test-natural.cjs` executes the real helper capture path, historical renderer
methods and actual filter failure branch. Its 24 named cases include wrong
window/process/Worker/thread; wrong actor, viewport-player and selected source;
crossed source/publication; all eight pending flags; queue/physical/async input;
stale PNG/readback metadata; settled completion; and non-throwing display
failure. It also exercises throwing display cleanup and direct-mode bypass.
Fixture transport serves no real PNG pixels.

Existing guards reject wrong window/process/Worker/thread, crossed publication,
pending and active input. The settled helper legitimately accepts its original
weaker contract. Wrong actor/source and stale readback fixtures are **accepted
by that same helper**, demonstrating missing checks rather than successful
full-contract negatives. Extra actor/source/frame fields are adversarial
fixture data; they are not invented production endpoints. In particular,
slot 0/tid 1 plus `latest` actor existence does not verify viewport ownership.

The required full-link invocation deliberately exits 1 after the fixture cases:

```sh
node scratch/runs/20261104-deusex-natural-frame-capture/test-natural.cjs --require-full-link
```

It fails because the actual capture result has neither engine completion nor
immutable readback. No synthetic token, stable counter or global-idle sample
is accepted in their place. The required missing endpoint is a completed
owning render record linking Worker/slice and verified viewport→player actor,
the actual selected composition stack/layers/source, and immutable backend
readback bytes/encoded PNG from that completion. None of the observed return
values provides this record. A future bounded recorder needs that backend
contract demonstrated before implementation can claim full capture support.

The original 735→736 capture remains rejected for pending/held publication and
also crosses publication. Predecessor helpers and demonstrated fixes were
copied byte-for-byte, including active-input checks, driver-held checks,
approval resampling, failed-capture invalidation and throwing-display
transaction pairing. Tests pass: predecessor 60 contract assertions/24 transport
shots, 33 observer assertions, 6 queue tests, 14 timing/readiness cases and 2
actual staging-preflight negatives. The driver integration tests retain stale
PNG name/hash and absent-inspection rejection. These are offline fixture
checks, not new game captures.

Reproduce and verify all expected results with:

```sh
python3 scratch/runs/20261104-deusex-natural-frame-capture/verify.py
```

`verification.json` records commands, expected exits, exact source/module
hashes and the empty relevant production diff. `evidence-sha256.json` seals
run files. For recovery, copy the five named unchanged helpers/tests from the
predecessor contract run, then apply this run's new-file patches for
`test-natural.cjs` and `verify.py`; referenced predecessor queue/timing/staging
fixtures remain at their existing paths. Git is the source archive. No source
tree, media or module was copied into this run. An initial fixture cleanup
mistake (presentation canvas left null before an exception assertion) was
corrected; it did not indicate a backend failure.

No forced repaint, freeze, stepping, guest write, configuration/timing change,
input-guard relaxation, screenshot retry or gameplay pulse occurred. Calls to
renderer methods in tests come only from simulated normal callers in offline
VM fixtures. No build was required for the note and ignored fixtures. No box
was allocated, assigned or accessed: ID/state/expiry are not applicable. No
runtime lifecycle action, browser, game, heavy CLI, subworker, deployment or
successor task ran. This single task stops with the concrete missing endpoint.
