# LMarbles controller completion and original Puzzle8 progress

Published controller change `ac58d9074` removes the unconditional 1.2-second
post-release sleep. It changes no input, ownership, readiness, release,
freshness, observation, operation or aggregate deadline. The original historical
queued-capture timeout remains unattributed; this optimization is independently
authorized and does not claim to repair its unknown cause.

The sleep was a settling heuristic, not a completion check. Before it, the
controller already waits for the independent physical-UP acknowledgement and a
later native batch. The ordinary live `png:` command then runs through
`test/run.js`'s scheduled action queue. Its capture hook forces dirty DirectDraw
upload, composites the whole desktop, encodes losslessly and writes the PNG
before `settleLiveInput` resolves the HTTP operation. That completed presentation
is the evidence required for capture. Elapsed sleep cannot prove it. This does
not assert that a game's future animation has finished: transition images were
followed by a fresh personally reviewed settled scene before another intention.

The new focused test runs the entire final Python controller, its independently
armed release child and the actual production queued snapshot/PNG route against
an authored native SDL consumer, using the authentic SHA-pinned SDL DLL and
normal threaded guest scheduling. Both the original's 640x480 game client and
512x384 title client sizes were exercised on a whole 1024x712 desktop. The
DirectDraw-backed fixture uses authored hardware/fullscreen/double-buffer flags;
it does not alter the original's settings. Bounded public phase records show the
real forced dirty upload before composite/encode/write/queued completion, with
the expected black-to-green visible client consequence. The ordinary WinDIB
route also passes. Complete positive operations took 0.28–0.60 seconds in the
final cases. No private game memory, payload or disassembly was inspected.

Full queued-route late response, refused presentation and native guard refusal
cases pass on both SDL routes and at the title-sized DirectDraw surface. The
late case retains real DOWN consumption and independent UP, but closes on the
unchanged operation deadline. Presentation failure cannot produce an accepted
PNG; native refusal cannot claim consumption. Each terminal context remains
closed. Existing nine completion-budget and eleven reserve tests pass, as does
the canonical locked build. The preexisting slow-capture regression is adjusted
to delay 3.05 seconds directly; its former 1.8-second fault relied on the deleted
sleep to exceed three seconds. That affected native slow-operation test and the
near-expiry DOWN/later-UP test both pass with actual release and lifecycle waits.
Direct encoder/whole-pixel and loader proofs are
hash-referenced from the prior runs rather than repeated.

Earlier authored-only failures are preserved separately. One admission was
locally NOT_SENT during concurrent build work. The first input-holder invocation ended with exit 143 and the holder process
was gone; the signal sender was not recorded. Subsequent launches refused before
creating native or watchdog children. The run-specific holder repair records TERM/HUP/INT while
retaining its sealed descriptors until explicit stop. A DirectDraw software-mode
probe produced gray pixels and was rejected; it is not counted as a positive
visual proof. The hardware-backed authored cases supply that proof.

Exactly one fresh ordinary original was launched after controller publication.
It reused source `a00eb35bebb621ebb3f2b42b6af18f1bd874b9f6` plus the published
`ad27fc08f` source-view loader, module
`83703369cc49c3e16077a4abd43def27262487f83dd52583d1b433adf7095f5f`, unchanged
media and the existing SDL/selection controls. Normal / Original / Puzzle1,
ordinary level-eight selector confirmation and Puzzle8 with 96 moves were
personally reviewed. Thirteen manual slides left Puzzle8 at 83 moves. Across all
20 original input operations, every DOWN was CONSUMED, every independent UP was
ACK, the maximum dispatch-to-UP interval was 231.78 ms and the maximum complete
operation was 0.852 seconds. No original capture exceeded three seconds.

Reviews that expired before DOWN were locally NOT_SENT and replaced by fresh
captures/new intentions. One-action run helpers shortened the review invocation;
they contain no solver or future move queue. Whole-image equality checks could
only submit a manually chosen edge when a new actual capture exactly matched a
personally viewed complete PNG; differences refused before intention. No masked
comparison, OCR, board-state extraction, imported solution, save/config, clock
or guest-pump changes were used. The original game kept its own ordinary setup.

At 23:57 UTC the prearmed independent watchdog stopped the original. Its receipt
says `deadline-or-disk`; its recorded firing time is roughly 2,837 seconds before
the immutable watchdog deadline, so the supervisor code identifies the disk-floor
branch, not a runtime timeout. The exact free-byte sample was not recorded.
Native logs show orderly SIGTERM, actual exit 0 and both EOFs. This is host cleanup,
**not ordinary native Quit**. The next local capture refused on the already
recorded native wait before making any endpoint request. No later endpoint,
replay or second original was used. Puzzle8 clear, tally, Puzzle9 and ordinary
Quit remain OPEN; the concrete blocker is the shared-disk watchdog termination.

All created native/release/watchdog/supervisor/parent processes were actually
waited with EOF evidence. Sealed descriptors were hash-verified before explicit
holder stop. No box was created: ID null, state NOT_CREATED, expiry null, stop
receipt N/A. No workers, source archives, media copies, deployment or held-scope
queries were made. Foreign WIP was preserved. Nonselected captures and display
derivatives were removed; selected named whole lossless PNGs remain.

Evidence: `scratch/runs/20261117-lmarbles-controller-settle-capture-gameplay/result.json`.
It records exact Git and relevant binary diffs, module/source/media hashes,
selected images, bounded phase records, actual waits and the final storage audit.
The next gameplay attempt requires fresh authorization after restoring stable
shared disk headroom; this task does not reopen its closed original.
