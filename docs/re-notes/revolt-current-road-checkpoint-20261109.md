# Re-Volt current caller and first visual failure, 9 November 2026

No fresh driving, checkpoint or lap transition was established. The original
reached its textured main menu, but the image returned after the sole focus
click had a black game area. This run also **failed the strict first-failure
rule**: after reviewing that image, the worker erroneously requested one passive
capture. It returned the main menu. This is not evidence of a persistent renderer
failure, and the run is not accepted for continued gameplay.

Evidence: `scratch/runs/20261109-revolt-current-road-checkpoint-2320/`.
The accepted Home recovery in `revolt-native-recovery-20261108.md` remains the
last established native recovery; it was not repeated here.

## Caller corrections and offline validation

Only released run-local helpers were adapted. The inherited numbered transport
allowed a fresh capture after a stale-scene refusal, and the browser exception
path performed diagnostic protocol reads and `Browser.close`. For this task,
refusals became sticky failures and a terminal latch blocked later protocol,
input, capture and quit requests. An unknown pulse ACK closes admission
immediately; its later independently scheduled release cannot send after closure.
Native cancellation handles termination. No emulator production source changed.

Before allocation, the actual generated browser consumer passed a no-Chrome VM
test of terminal protocol/input/capture/quit rejection, sticky stale refusal,
balanced pulses and unknown-ACK closure. Short reverse, separate left/right,
Up+Left and Up+Right passed through the actual helper, current renderer, host RPC
and compiled production DirectInput fragments. That fixture is not a full-module
or trusted-browser proof; the retained accepted trusted-input proof was read,
not rerun. Current focused tests passed:

- `test/test-worker-input-event-slots.js`
- `test/test-worker-input-slice-wake.js`
- `test/test-directinput-independent-contract-oct27.js`
- `test/test-directinput-independent-worker-acquire-oct27.js` (actual OS Worker)
- `test/test-renderer-initial-input-state.js`

`flock /tmp/wine-build.lock bash tools/build.sh` passed. The selected current
source SHA was `f80090c3bc5580a8a4c57e2ceaebd6931d8fbf50`; guest and renderer
module observations both identified
`3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18`.
All 1,063 runtime pins, including 444 unchanged original-media references, were
verified before allocation and remained unchanged at terminal retrieval.

## Actual original sequence and limitation

The initial loading image was black. One passive startup capture then showed
the textured shop main menu with Start Race highlighted, personally model-reviewed
before the sole ordinary focus click. The 100 ms click had both DOWN and
independently armed UP ACKs. Its returned `focused-menu.png`, completed at
23:24:52.688 UTC, showed a black game area and the host UI.

The erroneous post-review passive command was `menu-settle`, command number 2;
its image completed at 23:25:17.597 UTC and showed the menu again. Both the command
and image are retained, not excluded from the result. No keyboard input, race
selection, controller wizard, Home/End qualification, guest memory/clock/config
edit, private handler, quit or further browser protocol was requested afterward.
The worker then sent native SIGTERM to the owned Node and Chrome PIDs. The Node
parent recorded actual wait status -15 and separate stdout/stderr EOF.

The offline protocol-failure latch does not detect semantically unusable images.
The operational error was continuing after visually identifying that boundary.
The next task needs to enforce that visual stop decision before any subsequent
capture; capture publication versus a transient cleared frame is still unproved.
Do not infer an emulator correctness defect from this run, or resume its box.

## Retrieval and shutdown

All 56 selected remote artifacts (49 unique contents) were downloaded and
independently reread for SHA-256 and size before the sole delegated normal stop.
`retrieval-verified.json` was independently checked again by the lifecycle
delegate. Exact Git SHA, relevant binary diffs, a 63,197-byte patch for the owned
helpers, current module observations and original-media path/hash references are
retained. No source or media archive was made.

One box was created: `bx_zepqx523`, lifecycle UUID
`ed273314-fd19-4736-914d-f0397cc0d0ca`. The independent observable watchdog was
armed before allocation with immutable deadline 23:47:48.920 UTC; initial API
expiry was 23:47:48.808 UTC. Its supervisor recorded actual watchdog wait status
0 with separate stdout/stderr EOF, and the immutable configuration did not change.

Normal unforced stop `stop_637ed7be0270259c` completed at 23:26:15.985 UTC.
An independent API reread confirmed `archived`, expiry `null`, `forced:false`.
No second box, extension, resume, delete or explicit archive action occurred.
Free space on `/home` remained about 5.7 GiB. The single task is stopped.
