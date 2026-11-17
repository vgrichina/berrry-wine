# AoWII black-ground upload boundary, 2026-11-17

Evidence: `scratch/runs/20261117-aow2-black-ground-render-owner-repair/`.

No production repair is justified by this run. One fresh original reached
Julia's map. The selected visible black ground point, native [600,300], is
already opaque black in a native D3DIM GPU-stream UPLOAD before WebGL consumes
it. The earlier CPU DIB writer, its API/caller and why that source is black
remain UNKNOWN. This is a narrower causal boundary, not full terrain parity
or proof that the game's intended terrain is black.

## Observed producer and current image

The actual process is 1000, displayed window 65538. Its live process render
Worker has endpoint 1, generation 1, API `d3dim-gps`, requested backend WebGL;
the executing instance reports `webgl1`. CDP bytecode extraction binds that
render Worker to standard module SHA-256
`87ef39648a61ed6f54ca4ab8de1926de02c651eb2d99655015dc7e5de5407009`.
The driver preserves the predecessor's exact immutable source/module/media
reconstruction and published 81ad thread manager. Current shared-tree foreign
overlays were neither served indiscriminately nor edited.

A bounded on-demand recorder uses the existing GPU-stream DumpWriter and
DumpReader/replay. It copies naturally consumed records and their arena inputs;
it never calls guest exports, flushes a batch or requests a guest pump. Target
sample readbacks restore the actual GL framebuffer binding. The initial probe
read every draw's sample and reached its two-second limit after 27 draws; it
does not represent a whole frame. Its UPLOAD sequence 227392 changes target 9
at the point from [26,26,22,255] to [0,0,0,255]. The retained input RGBA bytes
are [0,0,0,255], agreeing with the completed WebGL pixel.

The first probe's exact intermediate observer source was not pinned at
installation and remains UNKNOWN; it is supporting raw evidence only. The
refined observer has an exact final source hash and retained installed-method
identity.

The refined probe restricts draw sample reads to POSITIONT bounding boxes
containing the selected point, and stops at a natural READBACK. It records
2,304 commands, including 1,239 DRAW_UPs, ending at READBACK sequence 405841:
target 9, x/y 0/0, width/height 1024/512, RGBA format 15, pitch 4096. The
selected point is inside that actual readback. Its completed pixel is opaque
black. The whole 1024x768 target image is captured at that boundary and was
personally reviewed alongside the later ordinary browser image. The latter
is a later composition, not asserted to be the identical frame.

The refined input upload at sequence 403538 contains the same opaque black
sample. `ground-upload-input.png` shows the actual retained CPU-source band,
including terrain-edge details over black. No captured draw's POSITIONT bounds
contain [600,300]. Therefore no captured triangle's texture, palette, UV,
blend or depth state is the writer of this point. The raw vertex, shader,
sampler, raster and binding records are retained, without guessing a missing
ground draw or suppressing any draw. RGBA UPLOAD replaces the target bytes;
its selected sample has no sampler, palette, UV, blend or depth operation.

This identifies the immediate native stream producer and executor boundary.
It does not identify the earlier GDI/DirectDraw/raw guest writer of the CPU
DIB. The static lowering lives in `src/09abg-d3dim-gps.wat`; the retained
record does not distinguish its several upload callers. No source file was
claimed for a speculative repair. The older picker and stale page-side
bridge counters are not used to establish execution ownership.

## Validation and limits

Focused run-local checks cover disabled/invalid/duplicate observer requests,
framebuffer restoration, record copying/replay, unsuppressed real executor
errors and disposal. Exact retained-record and arena-reference replay checks
both captures and verifies uploaded RGBA against completed WebGL samples.
This is not a standalone full resource-content replay: initial resource state
is metadata. No matched software/WebGL/public-native pixel disagreement was
proved, and no semantics patch, build or code regression pass is claimed.

The read-only inspector initially connected with Puppeteer's default viewport,
changing the page from 1280x900 to 800x600. One attempted menu click hit the
host taskbar and provides no game-response evidence. The inspector now uses
`defaultViewport:null`; the original viewport was explicitly restored and its
live canvas geometry checked before fresh reviewed input. Initial local mock
and analysis-harness errors are retained/corrected, not emulator failures.

Historical DLL cancellation and keeper-wait UNKNOWNs remain unchanged. No
audio, package or lifecycle requalification was performed. The unchanged strict
required-body guard remains active for this original. No private guest calls,
forced pump, guest clock/config/media/save edits, old endpoint replay, source
archives, media copies, boxes, workers or deployment were used.

Ordinary Escape opened the save prompt; No returned to the menu; Quit,
Next and Exit reached native `ExitProcess(0)` at 1794950331832 milliseconds,
before the independent deadline 1794950333.825 seconds. The earlier
`native-exit.png` was captured before native completion and is not an exited
Ready screenshot. The watchdog then closed the browser runtime. Actual
Chrome -15, driver 124, watchdog 0 and supervisor 143 waits with both pipe
EOFs and empty process scopes are retained. The external helper ended 143
without its keeper-wait receipt: that actual keeper wait remains UNKNOWN,
not inferred from absence. Custody was retrieved and hash-verified before
removing the owned tmpfs profile. Box ID null, state NOT_CREATED, expiry
null, stop receipt NOT_APPLICABLE.

The run result records final custody, exact tested pins and selected images.
Next: bind the already-black CPU DIB sample to its earlier natural writer;
only a demonstrated valid-case error warrants a repair and affected-original
before/after validation.
