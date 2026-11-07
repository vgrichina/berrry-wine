# Dungeon Keeper repaired Canvas2D original attempt, 7 November 2026

The first exact runtime blocker is **missing staged Node dependency `pngjs`**.
The original game passed the published Canvas2D binding, but its first
owner-scoped capture failed at PNG encoding before publication or review.
No native input was admitted. Menu, dungeon, digging, building, persistent
consequence, FPS, audio and parity remain untested. There is no screenshot
from this attempt and no claim of visually reviewed original pixels.

Evidence is in
`scratch/runs/20261107-dungeon-keeper-repaired-canvas-gameplay/`.
The predecessor binding repair `c790ca544` was published and released before
allocation. The retained original browser was adapted only to import
`tools/dungeon-keeper-canvas-binding.cjs`; its original registered route,
numbered ACK transport, independently scheduled UP, freshness checks and
sticky UNKNOWN closure were preserved. Accepted fixture matrices were not
repeated. No guest, installed asset, configuration, clock or handler changed.

`recovered/original/renderer-readiness.json` records successful readiness in
three samples: registered `dungeon_keeper_demo`, process 1000, guest endpoint
1/slot 0, actual page Canvas2D HWND 98305, stable page/window/canvas/context
owners, and advancing natural publication. Page and guest executing modules
both match SHA-256
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`.
No D3D endpoint existed or was requested. `startup-state.json` records the
live Win98Renderer/CanvasRenderingContext2D, 640×480 output, empty native
events and empty input queue. These are runtime observations, not pixel review.

At **14:19:37.952Z**, `first-browser-failure.json` records
`Cannot find module 'pngjs'`, required by the tracked binding at line 196.
That require occurs after immutable owner readback and identity/publication
validation, before PNG encoding and capture persistence. The 619-file staged
manifest omitted `node_modules/pngjs`; the helper resolves it locally from
the checkout's `node_modules`, which concealed this runtime staging dependency.
This is a capture-tool staging failure, not evidence of an emulator defect.
The chain closed and the browser terminated normally. No capture or held-input
lane was retried, and no second original runtime was started.

The staged source SHA is
`bb6509322426db9cade7503b07ce6a08e15f28a2` plus the relevant tracked and
untracked-source binary patches recorded in `source.json`. Runtime pins
identify the exact served inputs and existing media paths. The executing
module was recovered separately; no fresh-build claim follows from the source
SHA. Installed original/media pins matched the predecessor and all 619 staged
files matched again at shutdown. The original EXE remains SHA-256
`4d3cd6a7866520f360288b08440e0f20379b4b39216a9576c388e42fcdf72c84`.
There is no source/media archive or retained media copy in this evidence run.

One fresh UUID-idempotent POST created `bx_eezuc5en`, originally expiring
**14:58:59.250Z**. The immutable 25-minute deadline was set at
14:19:26.345Z to **14:44:26.345Z**; the browser started at 14:19:26.698Z
and ended early on the first terminal failure. The local one-second disk
monitor recorded no 2 GB floor violation: minimum 2,853,281,792 bytes and
final 2,873,413,632 bytes in `disk-monitor-final.json`. The runtime also
retained its 2 GB guard.

`retrieval-verified.json` verifies SHA-256 and length for **25 unique
artifacts, 2,326,514 bytes**, including the module, logs, readiness and cleanup.
Both owned PIDs were absent, HTTP/CDP ports closed, profile and writer lock
absent, held input empty, and native event count zero. Chrome exited normally
with code 0 at 14:19:38.793Z. Under the explicit shutdown delegation, normal
stop was requested at 14:20:07Z after recovery. `boat-archive-state.json`
confirms **ARCHIVED**, stop completed at 14:20:09.947Z, `forced: false`,
and no current expiry. No old box was resumed, stopped or deleted; no runtime
lifecycle ownership remains to hand back.

No production source changed, so no emulator regression or locked build was
needed. Checks cover driver syntax, unchanged staged/media pins, recovered
SHA/length, cleanup, owned JSON/evidence containment and documentation
whitespace. Dungeon Keeper has no candidate-corpus entry; evidence stays in
this investigation note instead of being attached to an unrelated candidate.
The global evidence checker reports the preexisting unrelated Alice containment
error and historical missing artifacts, with no error for this run.

Next: complete and pin the binding's Node encoding dependency closure in the
runtime staging recipe, with a focused isolated dependency-resolution check.
Then a separately authorized fresh original attempt can review immutable
pixels and use ordinary native input toward consequential dungeon action.
This bounded attempt is finished at its first exact runtime blocker.
