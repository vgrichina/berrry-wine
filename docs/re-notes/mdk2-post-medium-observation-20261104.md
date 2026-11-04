# MDK2 bounded post-Medium observation

Implemented run-owned helpers in
`scratch/runs/20261104-mdk2-post-medium-observation/`, based on
`5a5a2e480a3a80cc6f55ed846312a14a5ce551ca` and its recovered controls. No generic
production defect is demonstrated; no tracked runtime code changed. This is an
implementation for the next original gameplay run, with offline tests only.

The actual retained 3328/3344 states have startscreen/menu, pending scheme=nil,
freeze=1, showmenu=0, Level table levelnumber=0/checkpoint=0, empty native input,
and consumed Enter/Escape release. They are **pending transition**, not rejected
construction. The retained3344 image was personally VIEWED in this task: black
with version1.000, no comic/loading/playable content. That historical view grants
no permission for a new run; no runtime review was authored from it.

`transition-evidence.cjs` validates worker/backend, native observer versions,
command identities/rest, native list, resource flags/retry boundary, frozen host,
and drained/balanced input. Its exact pending branch returns before importing or
calling `scene-transition.identity`. Only positively observed game/game schemes
invoke the unchanged strict construction probe. Applied game/nil plus the
unchanged native movie predicate distinguishes a movie target from an applied
scene without a target. A movie target still needs freshly viewed comic or
cinematic pixels; it is not comic proof alone. An applied game without target is
explicitly `applied-game-unproved-playable`, with no input permission. The current
observer has no native playable predicate, so this implementation cannot prove
playability or authorize movement/fire. Unknown or contradictory evidence rejects.

`pending-control.cjs observe-pending DIR REVIEW` accepts only an explicit
`post-medium-pending` observation review: originalScene=`unproved`, selection=none,
transitioning=true, playableReadiness=false, visualTransition=`medium-fade` or
`black-version`; constructionBlackVisible/loadingVisible/comicPanelsVisible/
tutorialVisible/unsupportedSceneVisible must all be false. The construction flag
means a claimed phase, not the presence of black pixels. The helper uses unchanged
checkedReview, InspectionGuard, Spool and ACK/history checks. It emits exactly
state, step16, shot, never input/tick. It compares current native evidence and
history against the inspected capture before stepping. The new shot invalidates
approval and is classified without authoring another review.

Each invocation reserves 16 slices/three commands before submission. At most32
pending quanta (512 slices/96 commands) are allowed. These consume the existing
construction ledger's12288-slice/576-command/192-quantum allowance; they are not
free credits. Its540000ms startedAt is shared with construction/comic, persisted
unchanged, and inherits an existing comic anchor if present. The unchanged browser,
Spool, per-call60s, recovery reserve and phase-specific caps can stop earlier.
Neither a new review nor a new process resets the ledger. Exhaustion is a hard
stop, not proof of an engine fault. Failed ACK/step, actual driver first-failures,
bootstrap failure, controller rejection and contradictory native facts all stop;
no retry route clears a fault. A latched driver fault remains a stop even before
the controller creates its own error file. Only quit/recovery follows rejection.

The run-owned `next.py` routes **fade and pending** to this helper instead of the
menu/construction helpers. Its separate exact capture/hash/steps/inspector review
requirement remains. `control.py` runs `phase-gate.cjs` against the actual captured
native state before InspectionGuard approval and phase action. Premature stronger
routes latch the existing comic-control first-error file. Construction/loading/
comic/cinematic actions retain their original phase helpers and guards; this new
gate supplies an additional prerequisite, never a replacement. Input review and
native preflight remain separate. Directly invoking old helpers bypasses the new
routing and is not the supported next-run procedure.

## Offline verification

Run from the checkout root:

```
node --test scratch/runs/20261104-mdk2-post-medium-observation/test-pending.cjs
python3 scratch/runs/20261104-mdk2-post-medium-observation/test-route.py
node --test scratch/runs/20261104-mdk2-adequate-lifetime-menu/test-scene-transition.cjs
```

30 new controller controls, five executed Python routing controls and18 unchanged
scene/native controls pass. New tests replay actual captured3328/3344 JSON and a
retained actual cinematic JSON; fixture screenshots/ACKs for command transport are
explicitly synthetic, not fresh runtime evidence. Negatives cover wrong worker/
backend, native input, unknown/contradictory schemes/levels, resource retry boundary,
missing observation, source/module/Medium prerequisites, stale capture/approval,
wrong/missing/failed ACK, incomplete/timed-out execution, changed input/steps,
actual driver fault file, budget exhaustion, deadlines and attempted reuse after
rejection. Two fresh reviews preserve startedAt and consume cumulative budgets.
Serialized native observer plus classifier leave every fixture memory byte
unchanged. Original menu/difficulty captures remain rejected as pending. No live
WASM/game, Chrome, remote API/exec, box operation or local full build was used.
Full build is not applicable to this documentation and ignored run-helper change;
the other worker retains sole local heavy CLI/build ownership.

## Exact next runtime route and prerequisites

The next owner must supply a **fresh authorized** runtime_io/release adapter and
browser output directory, stage the small changed helpers next to next.py/control.py,
and retain the hash-verified prior37-input driver closure. The helpers deliberately
reference the existing sibling adequate-lifetime-menu native/ACK/phase modules;
verify those references and hashes before staging, do not silently replace them.
The launch driver must target the fresh run directory (its RUN is __dirname),
never the old closed browser directory. Do not launch this run without rebinding
and staging that unchanged closure. No runtime_io or release authorization is
provided here; no past box authorization is reused. Source, wasm, compat and cache
pins remain those in the predecessor note, and require actual next-run CJS/ESM,
HTTP/cache/worker/source/module/dependency preflight before Chrome. Offline tests
here make no claim about that live integration.

After fresh separately VIEWED New Game and Medium and their separately authored
input reviews/native preflights, use `python3 next.py pending` (or fade) **only
after** first viewing the latest capture, then authoring its own exact
`observation-review-CAPTURE.json` on a later call. Every step ends at another VIEW
barrier. If current native evidence qualifies construction, author a new truthful
construction review and use next.py construction; if qualified loading, use
loading. Comic cancel requires separately viewed comic, a separate input review,
and unchanged native movie/input preflight. Post-cancel cinematic remains an
observation phase. Stop on pending512-slice cap, deadline, unknown evidence, actual
fault or rejection; do not stretch budgets or relabel pixels. No elapsed-slice
threshold is a readiness criterion. No historical review may authorize input.

Assigned `bx_8g2vpazy` expiry is2026-11-04T11:04:40.606Z; coordinator owns lifecycle.
The unchanged ten-minute launch TTL requires launch **before10:54:40.606Z** for
that box, additionally before the selected six-minute browser deadline can fit
its hardclose/recovery bounds. Prior task hardclose10:55/recover10:59 would require
starting a full six-minute window before10:49, or an explicitly shorter driver
window under unchanged deadline calculation. RecoveryEnd uses the earlier release
recoverBy minus120000ms or identity deadline minus180000ms; no reserve may shrink.
The coordinator's11:00 shutdown checkpoint is unchanged. If these prerequisites
cannot fit, obtain a separately authorized adequate lifetime; do not use expiry
as permission to resume/extend/allocate. This worker has made no API query and has
no fresh box state observation: last predecessor state RUNNING, idle/healthy/
hydrated. Custody and shutdown remain with the coordinator; box untouched.

Evidence is local: tests, exact Git base SHA, relevant binary diff, referenced-file
hashes, and small new helper/document patches plus SHA seal. Git remains the source
archive; no source snapshot, game media, module or capture copy was created. The
patches recover ignored helpers with `git apply` from the checkout root. Publication
result is in the run handoff. No gameplay/construction/comic/playable success is
claimed. Stop after the documentation commit and single strict publication attempt.
