# Stronghold unavailable scene: exact offline diagnosis

The recovered first failure is **the same rendered Custom Game shell as the
earlier genuine setup route**, not the unavailable Arrival trail. No geometry
or native route defect is demonstrated. The precise reason it remained a shell
at the sampled boundary is unknown: this attempt has no native callback history
and no subsequent presentation samples. Do not repair the route or relax its
recognizer on this evidence.

Input is `c01d553802233fa9da46c6186cc5100a4004bc9d` and
`scratch/runs/20261104-stronghold-resolved-binding-native/`. New evidence is
`scratch/runs/20261104-stronghold-unavailable-scene/`. This task is entirely
offline; it does not replay the game, use a browser/HTTP/API, or touch a box.

## Exact pixels, personally inspected

I personally viewed the original attempt's title, main menu, Crusader hover,
Custom Game hover and terminal captures. The terminal image is shield/swords,
“Not available in the demo” and numbered circles 1/2/3, without complete setup
panels. I also viewed the village shell, Zephyr hover and ready captures, and
the explicit-idle run's Arrival trail capture with its map and date labels.

The diagnostic decodes original PNGs and compares **every RGBA byte** of the
complete game rectangle `[10,194,860,668]`, including its opaque borders.
Browser chrome and logging lie outside that rectangle.

| Original capture | Result against current terminal game pixels |
| --- | --- |
| `resolved-binding-native/recovered/browser/route-native-boundary-7.png` | PNG SHA `533a17d42b53e9ea7c2ec7b17734cc9a2219cc4868cc0dbf0d1d31bc14aec4ab` |
| `browser-village/review/custom-skirmish.png` | **0 differing bytes** |
| `explicit-idle-input/review/skirmish-selection.png` (Arrival) | 1,609,810 differing bytes |
| `browser-village/review/zephyr-veryeasy.png` | 1,205,968 differing bytes |
| `browser-village/review/zephyr-ready.png` | 1,149,078 differing bytes |

These suffixes are under `scratch/runs/20261104-stronghold-`. Both shell images
have full-game RGBA SHA-256
`aab7b794070432d2ec1fbbe454218594c71d85129fb9d623af36f81599a5e8f9`.
This is stronger than the recognizer's two patch labels. Historical shell
identity does not establish same-attempt initialization, stability or readiness.

## Ordered input and native source

The exact retained transport files are pinned by full SHA in
`tools/stronghold-unavailable-scene.cjs`. The fixture verifies 174 consecutive
complete 64-step ACKs through 11136 and all per-guest completion values. Commands
5–11 are title Enter, Crusader, install route, review ChooseType, review hover,
Custom Game gesture and natural arrival. No command 12 was uploaded.

| Gesture | Browser point | Actual queued native point | Move/down/up steps |
| --- | --- | --- | --- |
| Crusader | `(337.3375,360.4433333333333)` | `(304,144)` | 10368/10432/10496 |
| Custom Game | `(594,520)` | `(543,292)` | 10560/10624/10688 |

Each down queues ordered WM_NCHITTEST/WM_LBUTTONDOWN; each up queues
WM_LBUTTONUP. HWND65537, masks, wParam and packed lParam all agree. The actual
native point equals the older village `input-202.json` down receipt. The browser
point differs from that older browser's `(595,520)` because geometry must be
mapped per capture. Applying the production browser-input first floor and the
real `Win98Renderer.mapCanvasPoint` inverse to the recovered geometry yields
exactly `(543,292)`. No rounding-induced left-map input appears in these receipts.
Queue, active/last event and mask are drained at the terminal boundary.

Static checks rehash the original installed executable, SHA-256
`9024c533095f2227b0105b7e8a9e4cf28ec4fb206b165629787b2c97cf99f13f`,
and resolve original VAs through its PE sections. Descriptor `0x5bd138` records
right-tower origin `(416,201)`, button2/artwork527. Callback pointer `0x5bd0ac`
is `0x430e10`. Its ID1 branch requests scene57 (trail); its ID2 branch pushes
scene20, calls the scene manager at `0x430e71`, then initialization `0x429100`
and other setup routines. There is no separate demo-disabled choice in that
inspected ID2 branch. Static code proves branch structure, **not its execution
in this attempt**. Original media remains at its existing installed path; no
media/module copies were made.

## Why the unchanged controller stopped

The recovered composition identifies the setup-preset route driver SHA
`bb38b5787c277c94c2913a9ddba72a8663b9fd2fb706a88e320bcb83419633de`.
The diagnostic verifies seven retained route/navigation/geometry helper hashes
against that composition. Its `acceptArrival` accepts only Custom Game hover
or the three previously measured actual scene20 layouts. The historical shell
has a separate label and is intentionally outside that continuation's accepted
set. Thus command11's first natural 256-step sample fails at **11136 navigation /
576 route steps**. Command10 ended at10880/320 with ChooseType hover still visible.

This establishes the concrete stop condition: a valid historical shell image
arrived where this continuation required a different measured layout. It does
not establish whether the shell would persist, naturally initialize later, or
reflect different guest state. The previous 1058 served-pin checks and actual
normal Module `4417305d70322467441aef51e888b0fe66451d9c60da0c734eeb23f5a22c0a6b`
binding remain inherited evidence; they are not rerun here. Native callback
history remains UNKNOWN because the preset observer had not begun. No observer
absence or initialized-state claim follows from the final drained queue.

## Smallest bounded next runtime task

A separately authorized **fresh diagnostic execution**, never resuming closed
`bx_7z5qca2h`, should use the same pinned executable/modules and qualified route.
Before its single balanced Custom Game gesture, install a read-only observer on
the bound owning Worker for callback `0x430e10`, actual argument/branch, the
scene-manager request and return, and completion of that callback's setup path.
Record original current/requested scene values and callback sequence alongside
the actual input receipts; do not force calls or write game state.

Capture at each completed64-step ACK after release, with a total3072-step
arrival cap and existing4096 route/16384 navigation caps and original deadline.
If the exact historical shell appears, preserve that first observation and take
at most **three further256-step input-free samples** within those same caps,
recording presentation identity, ACKs, native state and drained input each time.
This is a separate observation-only diagnostic: existing route readiness/input
authorization remains unchanged, and no shell capture grants preset or Start.
An unrecognized scene, observer error/drop, bad binding/ACK or budget/deadline
ends the attempt immediately. Close after the bounded samples; no preset, Start,
native installation, gameplay gesture or retry belongs in this next task.

That observation distinguishes wrong callback/branch from correct custom scene
with pending initialization, and from completed native initialization with a
persistent shell. Only its actual result can justify a subsequent change.

## Validation and custody

`node test/test-stronghold-unavailable-scene.js` passes exact evidence, independent
whole-game shell comparison, real renderer inverse geometry and native byte
checks, plus **22 negative controls** for event order/coordinates/ownership,
geometry, duplicate gesture, partial or skipped ACK, extra command, undrained
input, missing failure, mutated game regions, opacity/dimensions and changed EXE.
Toolbar-only mutation preserves game equality. These are offline evidence
fixtures, not new live execution or completed setup positives.

`node tools/stronghold-unavailable-scene.cjs scratch/runs/20261104-stronghold-unavailable-scene/diagnosis.json`
reproduces the audit. The locked full build passes; its log is retained. Source
provenance is exact Git SHA, relevant binary diff and owned new-file patches.
No source snapshots/archives or test binary copies were staged. The original
first failure and all unique earlier evidence remain in place by path/hash.

No route helper was claimed or edited. No corpus/dashboard success or gameplay
claim is made. Assigned box ID/state/expiry are **NA (offline)**; closed original
`bx_7z5qca2h` was not accessed or resumed. The coordinator retains all future
allocation and shutdown ownership. This single bounded assignment stops here.
