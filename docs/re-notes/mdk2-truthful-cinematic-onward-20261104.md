# MDK2 truthful cinematic observer: tested repair, live menu readiness rejection

Run `scratch/runs/20261104-mdk2-truthful-cinematic-onward/` fixes the demonstrated
controller gap from `5c9ff166c0545345917877263ff67e86c7dac048`: an accurate
postcancel 3D-cinematic review can authorize input-free observation without
pretending the comic remains visible or declaring playable readiness. The actual
controller passes captured positive/negative offline cases. Live qualification
is **not achieved**: this run stopped at an earlier native menu readiness
rejection. New Game, Medium, comic cancel, cinematic continuation, movement and
fire were not reached in this browser. No guest-engine defect is claimed.

## Narrow controller repair

`tools/mdk2-cinematic-review.cjs` validates only `observe-post-cancel` with
`screen=postcancel-cinematic`, `originalScene=level1-intro-a-cinematic`, visible
cinematic, absent comic/loading/tutorial/unsupported scene, no transition or
selection, and explicitly **false** playable readiness. The run-owned actual
`comic-control.cjs` invokes its byte-identical staged copy from a single new scene
branch. `controller.patch` records the exact change from the predecessor.
The branch cannot authorize skip, movement, fire or any playable action.

All existing input-history, identity, ACK, fault latch, exclusive ownership,
native empty-list/rest, cancel-witness, readiness and finite-budget checks remain
unchanged. The 540-second aggregate deadline and its construction anchor are
unchanged, as are the 16 postcancel quanta, step and command caps. This live run
never reached construction, so no aggregate continuation anchor was created,
reset or extended.

`test-captured-cinematic.cjs` passes 28 cases using the predecessor's retained
actual 3D-dialogue snapshot and native cancel receipts. The predecessor actual
controller rejects that accurate review; the repaired actual controller and
extracted actual driver command function admit exactly state/step64/shot with
unchanged input history, cancel witness and anchor. Page execution in this replay
is an offline peer, not new engine execution or fresh game pixels. Negative
cases reject playable claims, conflicting scene flags, skip/unknown actions,
history, native list, queue, active input, mouse, callback/pause identity, source,
module, Medium prerequisite, ACK, approval, session, deadline, budget, ownership
and an existing fault. No callback execution or cancel causality is inferred.

## Live failure and correction

The sole Chrome session opened09:55:21.748Z. Startup reached the original legal
title at3072; the first menu controller call explicitly fixed allowance113.
Balanced title Escape led to native menu animation. At3200, fresh capture
`recovered/browser/native-selector-76.png`, SHA-256
`bf84aef1ee6da6ea4701c0d63f0c6a2fef5f96a01ba50104ecd374116b2b5bfd`,
shows menu icons but **no readable New Game label**. Native `Level.freeze`
remained `{tag:-1,value:1}`, selected0, current`lang`, applied scheme`title`,
pending scheme nil, Enter raw/previous/active all0.

I incorrectly submitted the historical New Game review template for these fresh
pixels. Its label/highlight/readiness assertions were inaccurate.
`review-correction.json` explicitly supersedes that review; the original rejected
submission is preserved. At09:58:01.851Z, unchanged `nativeReady` rejected
“native opening callback/selection not ready” **before any phase state, key or
step command**. The next command was quit79. Chrome closed normally09:58:08.312Z.
This is an operator/template failure contained by native readiness, not evidence
of a game failure, a successful menu selection or cinematic continuation.

Offline, the owned route now requires a separately authored
`input-review-<fresh-capture>.json` for New Game, Medium and cancel. It checks
the fresh capture identity and actual native readiness locally before remote
approval. `test-input-preflight.cjs` passes actual predecessor New Game/Medium/
cancel positives and this run's premature-menu negative, conflicting review
negatives, route ordering and the tracked/staged helper byte comparison. This
route repair was not retried live. A fresh run must wait for readable New Game
and native readiness together; elapsed slice counts are not readiness.

## Verification, provenance and custody

Before Chrome: candidate90/90, predecessor177/177, redirected177/177,
postcomic actual-controller/driver50/50, captured press12/12, actual snapshot
witness15/15, captured cinematic controls and locked full build passed. The
assigned-runtime suite206/206, actual Puppeteer24.31.0 CJS/ESM imports,
432 exact source/module/media pins, isolated HTTP hashes and page98/worker12
cache references passed. An unchanged second prebrowser test run hit one150ms
synthetic ACK timeout; the unchanged rerun passed206/206 before Chrome.
The final locked build also passed after adding the production helper.
Final focused verification passed116/116, covering captured cinematic, native
press/release, postcomic controller/driver and offline input-review admission.

`validation.json` checks 80 contiguous successful ACKs,3200 completed slices
(maximum64 per step),13 personally viewed captures, exact balanced title-only
input and all200 served hashes. The inaccurate final menu review is explicitly
excluded from readiness claims. All269 closed artifacts/6,097,111 bytes were
recovered and SHA-checked before10:22Z. Chrome13189 and driver13177 are absent;
HTTP43593 is closed. All432 pins and35 hashed inputs remain unchanged.

Runtime source is `1329b1ba6eb00144ff77d4cd92a8513d4fc953ad`; canonical wasm
`cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee`, compat
`580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3`.
The local build and other workers' uncommitted D3D changes were not substituted
into this pinned runtime. `local-head.txt`, `relevant.diff`, small owned-input
patches and `seal.json` preserve provenance. Git is the source archive; no source
archives or module/media copies were staged.

Browser deadline10:10:21.748Z, hard close10:17Z and recovery10:22Z were preserved.
`bx_dmq33y4w` is left **RUNNING** (API idle, healthy/hydrated), expiry
2026-11-04T10:27:13.933Z, shutdownOwner **coordinator**, custody returned.
No second browser/reload, lifecycle/allocation/source-box access, local Chrome or
heavy guest runtime, subworker/successor, HeroesII or deployment occurred.
Own-path commit and the single strict publication attempt are recorded in the
run's final handoff; publication must not be inferred from a local commit.
