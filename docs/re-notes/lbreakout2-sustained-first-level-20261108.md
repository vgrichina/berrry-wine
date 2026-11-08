# LBreakout2 2.5.1 sustained first-level play, 2026-11-08

Current original gameplay now goes beyond prelaunch paddle movement and Space
release: reviewed evidence shows ordinary steering while the ball is live,
repeated returns during one launch, removed bricks, and score progress to **2000**.
**Late At Night (1/25) was not cleared.** Both all-lives-lost screens and the
ordinary continue between them are retained. FPS, audio, full playability and GL
coverage remain open; this original SDL path renders through Canvas 2D.

Evidence: `scratch/runs/20261108-lbreakout2-sustained-first-level/`.

## Original route and tested identity

ROOT released the recovered canonical fixture at 02:33:55Z before allocation.
The worker reran `node tools/verify-lbreakout2-251.js` before allocation and after
play: 220 original client files, 219 exact companion mappings, authentic CRT.
`media-refs.json` records existing media paths and SHA-256 values; no source tree
or repeated game archive was copied into evidence. The official 3,322,804-byte
ZIP remains in the separate ROOT recovery run, SHA-256
`a152c0867abf9bc39563db932ebcd0797ed3e35d20f21c2dca2a81e321313675`.
The verifier pins the complete original 230-file / 5,606,025-byte inventory.

Tested source HEAD: `0b106e5d36d8fe10a84a97c95bd0531ab8edaa24`, branch `main`.
`runtime-pins.json` records 809 staged files, unchanged in remote postflight.
Relevant tracked and untracked source patches and owned harness patches are
retained alongside the exact executing module recovered through CDP:
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.
All 220 original client HTTP responses and authentic CRT matched their pins.

One fresh UUID box and one Chrome 151.0.7922.108 browser used the existing
registered `lbreakout2_251` app: `C:\LBREAKOUT` cwd, empty arguments, original
bundled DLLs and authentic MSVCRT. The browser ran headless with native CDP key
delivery and captured the actual visible framebuffer. Threads were enabled;
clock, game settings, bindings and guest state were unmodified. The page's WebGL
selector does not make this SDL 2D game GL coverage.

## Personally reviewed transitions and consequences

`review/main-menu.png`, `local-selected.png`, `local-menu.png`,
`resume-selected.png`, `original-selected.png` and `level-start.png` retain each
short-route transition: Down / Enter to Local Game, two separate Downs to Start
Original Set, Enter. Help/Controls were not repeated. `level-start.png` shows
Late At Night (1/25), score 0, fixed bricks and an attached ball.

The first screenshot-paced helper released the ball and moved right while it
was live. It stopped when it could no longer locate the paddle; the subsequent
capture shows a lost life and an attached ball. This is retained rather than
counted as sustained success. A faster observer then read only framebuffer
pixels and sent ordinary arrow/Space pulses. That session reached score 100,
removed a brick, and lost all remaining lives (`review/all-lives-lost.png`).
Its automatic rebound count includes relaunches and is not accepted as an exact
return count.

The original loss modal offered a continue for 100% of the score. Ordinary `y`
accepted it; `review/second-fast-0000.png` shows score reset to 0 and replenished
lives while the damaged board persists. The revised framebuffer helper projected
landing positions sooner, using observed ball motion and the visible lower brick
row; it never accessed private game variables or changed timing.

During that continued session, the first two reviewed bottom reversals occur
before its second Space press, so they are repeated returns during one launch:

- At 02:42:12.524Z, ball approximately (620.7, 618.4), paddle center 604.5;
  at 02:42:12.554Z ball (623.7, 613.4), subsequently y590.4 and y585.4.
- At 02:42:14.352Z, ball approximately (554.7, 620.4), paddle center 566.5;
  at 02:42:14.378Z ball (550.7, 612.4), subsequently y592.4 and y582.4.

These are full-page pixel coordinates. `reviewed-live-returns.json` preserves
the surrounding observations and launch separation; native arrow receipts show
the accompanying live paddle corrections. Detection summaries are observations,
not a direct read of game physics. The helper's later six-event count is retained
without promoting it to an exact gameplay oracle; falling bonuses and overlaps
can confuse its color classifier.

Personally reviewed `review/second-fast-0002.png` shows score 500, a separate
live ball and the paddle at the right; `0003.png` shows 950, further removed
bricks and a different paddle position; `0004.png` shows 1400 and a substantially
opened lower-right board. Lives are lower across these captures, so they are not
claimed to be one uninterrupted life. `review/final-all-lives-lost.png` shows
score **2000**, remaining bricks and another all-lives-lost modal. There is no
level-clear or second-level claim. Remaining lives and imperfect visual tracking
limited this run; no emulator API failure was established.

## Input, evidence and shutdown checks

Before allocation, actual production guest/render Worker controls qualified
exact Left/Right/Space 250 and 500 ms native pulses. The generated control also
checked stale scenes, every owner-identity field, actual wrapper replacement,
module mismatch, delayed/rejected/pending acknowledgements, deadline release,
and independently scheduled UP. Generated controls are separate from original
gameplay. No production game input had an UNKNOWN outcome or was replayed.

Original run validation: 17 exact numbered command ACKs, 114 trusted native
DOWN/UP pairs and 114 independent release receipts; final held-key set empty.
`final-audit.json` also records 67 PNG references decoded with CRC checking,
actual module identity, HTTP media pins and remote postflight. No emulator code
changed, so the locked code-build gate was not applicable to this docs-only
commit. Preparation errors (relative manifest path and transport wrapper), the
first visual helper's refusal, a read-only status path typo, and an initial
cleanup inventory race remain in the run. A later settled read established
normal cleanup; none of those commands replayed game input.

508 remote artifact references / 19,142,981 reference bytes were retrieved and
SHA-256/size verified before normal box stop (444 distinct content hashes).
Chrome exited 0; owned browser/controller PIDs were absent, HTTP/debug ports
closed, profile/writer removed, keys UP. Both visual observers were stopped only
after reviewing loss modals with no active pulse. The independent detached
25-minute watchdog was armed before allocation; normal/watchdog delegates exited
0 and the supervisor ended with no children. The 5 GB floor was preserved; no
RAM admission gate, resume, deletion, archive bundling or public deployment.

Box `bx_mb3w3u2m` is **archived**, current expiry `null` (initial expiry
03:01:21.449Z). Normal stop receipt `stop_b0438070b78a5ddb` completed
02:44:34.000Z, `forced: false`; stoppedAt 02:44:33.980Z. The worker owns no
remaining live runtime.

Next work is a separate original first-level-clear attempt with better
framebuffer discrimination of ball versus falling bonuses. Preserve this earned
control/brick/score result and the losses; FPS/audio/full playability stay open.
