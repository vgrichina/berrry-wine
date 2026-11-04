# MDK2 shooting tutorial onward — 2026-11-04

Ordinary browser chaingun fire defeated the **right tutorial dummy**. The
left dummy remains; the next grenade instruction and full tutorial completion
are not claimed. This bounded follow-up extends the ordinary browser result
`6eb8729a295815c57827feb285f13a68d038baac`. Evidence is in
`scratch/runs/20261104-mdk2-tutorial-target-onward/` (ignored).

Original `scripts.zip` was decoded in memory, read-only, before runtime.
Its SHA-256 is
`cfdae6e7d02b1823a59d0b85aa8eaca2f057dbb27e7b86d9a7199fc069f642d8`;
decoded `level1.lua` is
`7d7de7b115b6fb1deb6290791c222e59c2726c607324095d3ba4c6136d9c08fe`.
Lines 4554–4571 increment each dummy's counter on **damage**, destroy it
at ten hits, and otherwise invoke its normal damage reaction. Holding fire
without hitting is insufficient. Lines 4544–4550 count completed death
animations; state 4 requires both dummies (2219). State 5 then gives the
grenade instruction (2271–2279). The default controls bind left mouse to
shoot, mouse axes to aim, Up to forward, and Left/Right to strafe.
Selected original lines and decoded hashes are retained in
`original-script-references.json`; no media was extracted into evidence.

The runtime preserves committed source
`1329b1ba6eb00144ff77d4cd92a8513d4fc953ad`, with foreign shared-tree WIP
excluded, and the accepted modules:

| Module | Full SHA-256 |
| --- | --- |
| canonical | `cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee` |
| compatibility | `580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3` |

Fresh box `bx_kbzzavgf` was created from named snapshot
`mdk2-browser-jump-fire-20261104`, TTL 3600, expiry
**2026-11-04T03:06:56.554Z**, shutdownOwner=coordinator, recorded before
execution. No old box was resumed, stopped or deleted. The snapshot omitted
generated icons, game inputs, modules and Node dependencies. Preflight
preserved missing-icon and missing-Puppeteer failures before any browser
launch; existing path/hash inputs and `npm ci` restored these prerequisites.
The standard `stdole2.tlb` allowlist and persistent trusted CDP pointer/button
bookkeeping were fixed in run inputs before launch. No production change was
needed for these harness issues.

The canonical module was compiled with the full hash above, sent to each
guest worker and the render worker, and each received module was actually
instantiated with 2,261 exports. The owning `lib/d3d-render-worker.js?v=dev`
created an OffscreenCanvas WebGL1 context. Its provider is
`ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6 (Core Profile) Mesa 23.2.1)`.
Compatibility was staged and hash checked, without a second execution.
This is evidence for the observed WebGL1 provider, with no FPS claim.

The selector → Launch → New Game → Medium route was preserved. Tick 16 ms
was used through the menu, then 20 ms. The learned logo, comic, dialogue,
falling and doorway progression was followed. The room was reached at
27,312 batches. One Up hold of 64 batches satisfied the center dependency;
no jump or sniper check was repeated. Captures below are PNG/JSON pairs
under `review/` and also recovered from the runtime's `browser/` directory.

| Batches | Capture | Inspected result |
| --- | --- | --- |
| 27,312 | `tutorial-entry-27312` | Original instruction to stand at the center arrow |
| 27,888 / 28,016 | `shooting-ready-27888`, `targets-before-28016` | Two original dummies spawn under red arrows |
| 28,080–28,336 | `fire-28080` through `fire-28336` | First 320-batch left hold; reactions/casings, both dummies remain |
| 28,400 | `fire-released-28400` | Button released, queue drained, neither defeat inferred from this burst |
| 28,416 | `aim-right-28416` | Ordinary mouse movement from (440,500) to (490,500) visibly turns the camera right |
| 28,480 / 28,544 | `aimed-fire-28480`, `aimed-fire-28544` | Second 128-batch hold; right impact and breakup begin |
| 28,608 | `target-settle-28608` | Fire released; right dummy breaks into pieces/smoke |
| 28,736 / 28,864 | `target-after-28736`, `right-dummy-defeated-28864` | Right debris falls and disappears; left dummy remains upright |

Gameplay stopped on that objective. At 28,864 the input queue was empty,
active input null and mouse mask zero, with health 100. The original script's
ten-damage threshold explains the destruction, but the live counter was not
read and ten individual hits were not separately counted. Both arrows remain
because state 4 waits for both death animations. No guest-memory, game,
configuration or check writes, cheats, or production changes were used.

One prelaunch capture-helper fault is retained in
`prelaunch-control-failure.json`: a waiter crossed the preflight directory
move, saw a new browser's command-0 receipt, then failed to retrieve its own
unexecuted `startup-before` capture (HTTP 404). That receipt does not
acknowledge the old request. The actual browser command 0 was
`first-before-steps`. No gameplay step or input was retried.

All 538 actual browser commands have successful final receipts; the 475
sequential guest-step requests sum to 29,392 batches, each at most 64, with
no missing gameplay acknowledgements. All 36 observed DOM key/button events
were trusted and balanced. Final keys/buttons were released, queue empty,
active input null and mouse mask zero. JavaScript syntax and Python compile
checks passed for the run inputs. All 569 runtime pins and 29 local original
media references matched after execution. All 1,662 recovered files
(18,753,018 bytes), including **both full-SHA modules**, matched the runtime
inventory. Git commit plus binary diffs record source identity; no source,
scratch, docs or media archive was created. No production build was needed.

One browser segment ran **02:09:47.124–02:25:52.459Z** (965.335 seconds),
within 25 minutes. Pause → Quit → Yes was personally inspected, followed by
a black transition at 29,392. Menu return and guest process exit are
**unconfirmed**. Normal `browser.close()` exited Chrome with code 0.
Driver PID 10913 and Chrome PID 10929 were absent, and port 32925 was closed.
After recovery, the API reported healthy `idle` (the box remains running).
Box **`bx_kbzzavgf` / RUNNING, API idle / expiry 2026-11-04T03:06:56.554Z**
is handed back to **shutdownOwner=coordinator** for snapshot/normal STOP.
The worker did not stop, delete or resume it. This single task ends here.
