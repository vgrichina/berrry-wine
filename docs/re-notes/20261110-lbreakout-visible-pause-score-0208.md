# Original LBreakout visible pause, resume and launch

Evidence: `scratch/runs/20261110-lbreakout-visible-pause-score-0208/` (ignored).
Code shipped on main as `d33b2fa343767e6873417c560d1d2de75dce0c88` before
the sole original run. Reused targeted initialization `5cbb2a8f4`, zero repeated
module transfers `05af3c36e`, and unchanged accepted fixture `4fc62b7d7`.
No native fixture rerun, second original attempt, or inherited-box operation.

## Repair and offline controls

Pause still used range tracing, which globally disables fast execution even
outside the selected addresses. Its keyboard entry/return, handler entry,
display/state return and caller now use the existing compiled breakpoint
driver. The handler entry moves directly to its expected display/state target;
there is no broad handler range. The same driver already handles initialization.
The unarmed path retains native run and metric function identities. No provider,
module, guest instruction, clock, handler invocation or instruction budget changed.

A separate ordinary P command can request resume state 8 only after identifying
the reviewed pause image. This permits a returned resume image to be individually
reviewed before normal Space launch. The preexisting combined play command was
not used in the live run.

Actual generated-consumer success, wrong command binding, wrong module binding,
incomplete work, observer failure, presentation refusal and foreign immutable
owner controls passed. Completion incurred zero full-module transfers; full byte
validation remains before arming and around capture, with immutable owner and
DLL binding checked during polling. Eleven inspection tests, pause/level-start
observer tests, original SDL input controls and the locked build passed.

The actual compiled-module test now runs original full-screen `surface_gray`
against isolated original SDL surfaces in alternating disabled/range/target
modes. Every output pixel matches, and natural entry/end targets are observed.
Three samples in milliseconds were disabled 541/508/540, range 845/636/640,
target 672/607/524. Only range mode enables the global tier guard. These isolated
samples establish the instrumentation mechanism, not a native two-second promise.
Original background work, complete 25-level parsing, moving targets, conflicts,
restoration, and full generated preload validation also passed. Both pause and
resume preload arms preserve tier guard zero against the actual compiled instance.

## Sole native result and first terminal boundary

Each of ten returned images was individually model-reviewed before dependent
input. The original menu led to Late At Night, level 1/25, Michael score 0,
full brick board, paddle, attached ball and lives. Initial guest presentation
completed at +1383 ms. Ordinary P completed at +1760 ms and returned a usable
image showing the dimmed original board and yellow Pause text.

The separate ordinary P resume completed at +113 ms and returned the colored
board with no Pause overlay. After that image was reviewed, ordinary Space
(300 ms held, independently released) returned an image with the detached ball
airborne above and left of the paddle. Its displayed score was still 0.

The next ordinary P attempted to retain current progress after natural gameplay
during model review. Original handler entry occurred at +26 ms, display/handler
return at +1984 ms, and SDL P release/guest completion at +1986 ms. The unchanged
two-second deadline left 14 ms for presentation; the browser returned
`presentation deadline`, withholding the image. The caller immediately closed
and the worker issued owning cancellation. No later guest protocol, input,
capture, retry, quit or extension occurred. Score and brick progress are
unconfirmed. This is visible pause/resume/launch evidence, not score or clear
acceptance. No remaining live authorization is claimed.

## Evidence and lifecycle

Runtime used exact code commit above and module SHA-256
`3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18`.
All 826 staged runtime pins remained unchanged. Exact Git SHA and relevant
binary diffs, including small owned helper inputs, are retained; no source
archive or game-media copy was made in evidence. Shared providers, Q3 and Nox stayed
read-only; no nested workers or local Chrome were launched.

Only new box `bx_sradnt45`, immutable UUID
`0d11c083-7500-49b8-ae41-f9c9bb55e1f2`, was operated. Its independent watchdog
was observed before allocation, with immutable deadline
`2026-11-10T02:38:30.795687Z`; initial API expiry was
`2026-11-10T02:38:30.174Z`. All 152 artifact references (131 unique) were
retrieved and independently reread for SHA/size; ten PNGs passed CRC and
decompression, with no gzip artifact present. Actual launcher wait (-15) and
separate stdout/stderr EOF were verified before requesting stop.

Exactly one delegated normal unforced stop, `stop_e90213fd85a7f77f`, completed
at `2026-11-10T02:17:53.342Z`. Final state is archived with expiry null. The
watchdog was actually waited and reaped with exit 0 and separate EOF records.
The preexisting `bx_chfab9w3` was untouched.

Next: offline investigation of the original pause drawing cost and remaining
presentation margin, using retained evidence and compiled controls. Another
native attempt requires separate authorization; do not extend this deadline
or infer score from a withheld image.
