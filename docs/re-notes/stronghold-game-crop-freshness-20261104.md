# Stronghold menu freshness uses the qualified game presentation

The runnable successor to the title-release driver now compares the **entire qualified canvas rectangle, (10,194)–(870,862), at DPR 1**, when revalidating the reviewed main menu and Crusader hover. It retains full-desktop PNGs and their SHA-256 values for personal review. The retained hover pair with **53 changed taskbar-clock pixels and zero changed game pixels** passes the actual successor mailbox offline; a single changed game pixel rejects before mouse-down. This repairs the run-specific automation contract. No production renderer or guest defect was established, and no production file changed.

Evidence and runnable helpers: `scratch/runs/20261104-stronghold-game-crop-freshness/`. Preparation main SHA: **65438de076e5a16458c9bc3b88db7512314b57dd**. `owned-new-helpers.patch` recovers the five run-specific CJS files; `owned-new-note.patch` recovers this note. `relevant-uncommitted.patch`, `exact-git-sha.txt`, `dependencies.json` and the final artifact manifest record the source boundary and relevant file hashes. Git remains the source archive; captures, modules and media were referenced in place without copies.

## Actual integration and safeguards

`browser-driver.cjs` is the predecessor's real registered-launch/mailbox driver. Its `menu-crusader` action now constructs the local `MenuDriver` with `qualifiedIO`; both original full-image menu freshness comparisons use the qualified presentation identity. It still uses `EvidenceBoundary.run`, the existing page adapter, strict main-menu/ChooseType recognizers, internally projected **native (304,144)**, and the exact owned DOM move / NCHITTEST-plus-down / up sequences. Each event requires complete per-guest ACKs and explicit input drainage. Budgets, balanced cleanup and single-attempt enforcement remain in force. Route, native Start and ordinary-world freshness policies remain unchanged.

`presentation.cjs` runs its inspection function in the page before and after each menu capture. Qualification requires the supported geometry, visible focused unscrolled 1200×900 document, DPR 1 and unzoomed visual viewport, connected logical/presentation canvases with identical rectangles, and the original visible 800×600 guest client rectangle. It rejects unrelated visible DOM rectangles intersecting the canvas, including pointer-events-none overlays, as well as transformed/filtered/clipped presentation ancestors and painted pseudo-elements. Input hit tests must reach the logical canvas. The rectangle policy is conservative: even a visible unrelated element behind the canvas rejects; unsupported layouts require investigation.

The identity combines every opaque RGBA pixel in that rectangle, geometry, frozen execution state, window/canvas census, renderer state, worker census, document URL/time origin, page session token, host/renderer/canvas object identities, source version and script URLs. Missing qualification rejects. A changed document, renderer, version, HWND or client rectangle cannot borrow the earlier crop hash. Inspection changes during capture reject. Fresh full PNG review receipts still require the exact full-image SHA, scene, `personallyViewed:true` and an observation. `menu-presentation-captures.jsonl` records the full-image SHA, qualification and crop identity for each accepted capture.

The successor also replaces the predecessor's expired literal deadline with a required fresh `runtime-release.json` closeBy, bounded by the finite expiry minus a five-minute reserve. It requires its own authorization label and coordinator shutdown ownership. No release file was supplied or browser entrypoint invoked in this offline task.

## Offline validation

Run from the shared checkout:

```sh
node scratch/runs/20261104-stronghold-game-crop-freshness/actual-driver.test.cjs
node scratch/runs/20261104-stronghold-game-crop-freshness/title.test.cjs
node scratch/runs/20261104-stronghold-balanced-menu-route/route-dom.test.cjs
node docs/re-notes/stronghold-native-start-boundary-20261104.test.cjs
```

The changed actual mailbox integration passes **111 checks / 25 modes**. It executes the actual DOM inspection callback in a modeled document and uses real production renderer mouse handlers, coordinate mapping and host `check_input`; ACK execution and scene changes are modeled. It reads both retained hover PNGs directly and verifies 53 external differences, zero within the qualified rectangle. Clock-only change is accepted through balanced Crusader activation, strict ChooseType, the existing route handoff and installation of the unchanged native Start guard, with **zero native Start executions**. Game-pixel changes during main-menu or hover review, capture races, geometry/DPR, occlusion including pointer-events-none, session/time-origin, renderer/canvas replacement, version loss/change, HWND/clientrect, scroll/viewport/visibility, worker attachment, missing telemetry, invalid ACK and rejected personal review all stop before a press. A second menu attempt rejects.

The successor's actual title mailbox passes **20 checks**, including the real production DOM keyboard bridge and delayed release consumption. Existing route DOM tests pass **eight negatives**; the strict native suite passes unchanged. Logs are `focused.log`, `title-tests.log`, `route-tests.log`, and `native-tests.log`. Only run helpers and this note changed; no production-code build gate applies. No browser, box access, game execution or heavy runtime was used.

## Exact remaining game boundary

I personally inspected the retained hover PNG: it shows the axe beside Crusader and the skirmish description. This is historical evidence, not a new game run. The last actual original run remains **step 10432, drained Crusader hover, before any mouse-down**. The new DOM qualification and freshness policy still need validation in an explicitly authorized original browser run, followed by the balanced native304144 press/release and a freshly recognized ChooseType. Route installation, Zephyr, native Start, world entry and ordinary gameplay remain unexecuted in that run.

**bx_87cqdcba is reference only, STOPPED with verified snapshot 07:29:38 per the assignment.** Its former expiry was 2026-11-04T07:43:10.325Z; current state/expiry were not queried. No runtime custody or lifecycle action was taken; shutdown and any future runtime authorization remain with the coordinator. This task launched no workers or successors and performed no deployment.
