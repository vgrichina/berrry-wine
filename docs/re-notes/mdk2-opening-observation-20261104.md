# MDK2 opening observation — 2026-11-04

The run-only selector now permits bounded observation of a truthfully identified
opening animation. Selection still requires fresh readable highlighted New Game
and, separately, Medium, both with `transitioning:false`. The original runtime
reached both inspected selections and the Hectic loading screen in one browser.
**Tutorial remained unreached when the bounded attempt stopped for recovery.**

The ignored evidence directory is
`scratch/runs/20261104-mdk2-opening-observation/`. This follows published
`2b7c8a1ff`, the inspection integration at `4454bdf5f`, and the selector at
`632639d35`. Only this note is committed; executable helper changes, tests,
patches and actual captures stay in the owned run directory.

The distinction follows original `level0.lua`: Select requires `Level.freeze`
cleared (223–248); the opening callback sets the selection message and clears
freeze (441–446). ButtonOnTimer starts the opening animation (452–458).
Therefore visible opening is a reason for one no-input observation quantum,
not selection readiness. The original decoded reference hashes and selected
lines remain in the predecessor's `original-menu-references.json`; media was
read in place rather than copied.

For `observe`, `screen:"title"` and `selection:"none"` remain mandatory.
A true transition now additionally requires `visualTransition:"opening"`,
`openingAnimationVisible:true`, `controllerIconHighlighted:false` and
`newGameLabelVisible:false`. Unknown transitions or other scenes fail.
The action remains state → exactly 16 steps → fresh capture, without tick,
Enter, Escape or click. All other phases retain the false-transition gate.
New Game additionally requires its readable label, highlighted controller and
absent legal overlay; Medium requires its separately highlighted difficulty
dialog after New Game. Opening readiness is a named human attestation tied
to actual pixels, not software image recognition or a live Lua flag read.

Before Chrome, **42 selector tests passed**, preserving the original 25 and
adding 17 cases. They execute the helper against an independent receipt peer:
known opening produces only state/16-step/shot; open, New Game, Medium, click
and Enter attempts reject; unknown/wrong scene/missing identification,
missing inspection/stale review/pending ACK/active input reject before command
submission. Step, command and deadline exhaustion reject. Readable New Game
and Medium also reject true transitions. All **six inspection-barrier tests**
and actual-driver `inputSnapshot` integration passed, as did ACK negatives and
independent per-command transport tests. No production file changed or build
was required for this note and ignored helpers.

The capture-awaiting-inspection barrier is unchanged: exact PNG SHA, steps,
session and contiguous matching successful ACK prefix are mandatory; each
capture invalidates the previous approval. Every live capture is personally
VIEWed in a completed separate tool call before approval or dependent advance.
The unnecessary automatic pre-launch toolbar screenshot was removed so there
is no unreviewed capture followed by automatic launch. Startup screenshots and
all native captures retain the barrier.

Fresh preflight verified assigned `bx_wnjq4738` RUNNING/API idle, health ok,
hydrated, original 432 pins, imports and previous driver/Chrome absence. A small
file upload/download probe passed. Only small helpers and manifests were
uploaded; staged runtime, media, modules and configurations were reused.
No allocation, lifecycle action, reload or second browser occurred.

The single driver launched at **04:19:35.909Z**. The first title capture was
3,072 steps at **04:21:09.233Z**, within startup's 4,096-step/180-second cap.
All requests were sequential, matching-ACK commands of at most 64 steps.
Startup batches stopped immediately at that personally inspected title.

| Inspected steps | Pixels and action authorized afterward |
| --- | --- |
| 3,072 | Legal title, closed wells, no controller; one conditional Escape envelope. |
| 3,120–3,152 | Title without selection; individual 16-step observations. |
| 3,168–3,264 | Visibly opening wells and emerging icons, without highlighted readable New Game; truthful true-transition reviews permit only individual 16-step observations. |
| 3,280 | Readable New Game, red highlighted controller, legal overlay absent, opening finished; first Enter envelope. |
| 3,328 | Separate Select Difficulty dialog with Medium highlighted; second Enter envelope. |
| 3,376 | Difficulty gone, title fading; selector phase finished. |
| 4,912 | Original Hectic comic LOADING visible after acknowledged no-input loading advancement. |

The selector used **304 steps / 51 commands**, retaining its aggregate maximum
512 steps / 64 commands / 240 seconds and three-minute recovery reserve.
No elapsed step count stood in for visual readiness. The one conditional
Escape used exactly the existing tested legal-title/no-controller/nontransition
predicates; the internal freeze/animation flags were not read. No causal claim
that Escape caused opening is made. New Game and Medium were each authorized
by their own fresh readable nontransition capture, never by ACK alone.
Post-Medium loading advancement is recorded separately from the completed
selector and submits no input while loading remains visible.

Original execution source remains
`1329b1ba6eb00144ff77d4cd92a8513d4fc953ad`.
Canonical SHA-256 remains
`cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee`;
companion remains
`580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3`.
Exact checkout SHA, relevant binary diff and owned new-file patches identify
the work; Git remains the source archive. No source archive or media evidence
copy was created.

The post-selection continuation reached actual comic panels at **15,152** steps,
then further naturally advancing panels at 15,664 and **15,920**. The final image
was personally VIEWed and approved before orderly quit. No additional Escape,
Enter, click or gameplay input followed Medium. The attempt stopped before the
three-minute recovery reserve: Chrome closed normally at **04:31:11.610Z**,
**695.701 seconds** after launch. Tutorial remains **unreached**, rather than
failed or proved unreachable. No target, movement, aim, fire, pickup, cheat,
console, guest write or configuration edit is claimed or attempted. There was
no live setup/ACK/input/inspection exception; the first limiting boundary was
the finite browser/recovery window. No production defect is inferred.

Validation confirms **312 matching successful ACKs**, contiguous receipt order,
**260 step commands / 15,920 steps**, maximum request 64. All **29 captures**
were personally VIEWed in completed separate tool calls; their exact full SHA
and steps match approvals, and each dependent command follows its approval.
The selector completed in **162.191 seconds**, within its unchanged aggregate
bounds. Two trusted toolbar events and six trusted native events (one balanced
Escape and two balanced Enter envelopes) are recorded. All inspected queues
are empty, active input null and mouse mask zero. No driver/browser failure
was logged; all **200 served-file pin checks** match. The retained validator
checks these actual events, not a generic browser success flag.

Chrome **21016** and driver **20994** are absent and private HTTP port **33221** is
closed, verified after normal closure. Two identical post-close full-hash
inventories passed; **984 unique recovered files / 21,261,194 bytes**, including
both actual modules, match their full SHA-256 and size. All **432 pins** remain
unchanged. Recovery completed before 04:49Z. The companion was retained and
hashed, without a second execution. No source or media archive was made.

Hand back **bx_wnjq4738 / RUNNING, API idle, health ok, hydrated / expiry
2026-11-04T04:59:39.962Z** to **shutdownOwner=coordinator**. No lifecycle action
was taken. The observation-policy change and both original menu selections
are tested; tutorial continuation is the unresolved boundary. This single task
stops here, without a successor, public deployment or another game.

The dashboard evidence check reports no containment errors, missing artifacts
or invalid record for this run. Existing unrelated global errors are retained
in its output and were not edited.
