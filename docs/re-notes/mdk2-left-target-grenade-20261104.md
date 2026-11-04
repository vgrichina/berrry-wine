# MDK2 left target to grenade instruction — 2026-11-04

This bounded follow-up uses retained box `bx_kbzzavgf`, verified healthy
RUNNING/API-idle before use, expiry `2026-11-04T03:06:56.554Z`,
shutdownOwner=coordinator. Runtime and recovery deadline is 03:00Z; one
browser segment is limited to 20 minutes. No allocation or lifecycle change
is authorized. Evidence is in
`scratch/runs/20261104-mdk2-left-target-grenade/` (ignored).

The execution source remains `1329b1ba6eb00144ff77d4cd92a8513d4fc953ad`.
Canonical module SHA-256 is
`cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee`;
compatibility module SHA-256 is
`580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3`.
Current shared-tree modules are not substituted. Git commit and relevant
binary patches record source identity; game media is referenced by existing
path and SHA-256, without copying or archiving source or media.

Preflight checked all 569 predecessor runtime pins, helper syntax, Puppeteer,
static-server dependencies, Chrome availability and display. A small file
export probe passed before Chrome. Capture uses the predecessor screenshot
and state helper. No native gameplay save/export is used; filesystem staging
does not preserve an in-progress game. The learned selector → Launch →
New Game → Medium route is retained.

Original control and script references were read before runtime. Left mouse
fires and mouse axes aim. `level1.lua:4554–4571` requires ten damage hits per
dummy; `4544–4550` counts completed death animations, and state 4 waits for
both. State 5 gives the grenade instruction. The original scripts remain
read-only. Predecessor `8f9ff6d4c602e58627d94c586ab572f4520f95ad`
verified the right dummy only.

Ordinary aimed chaingun fire defeated the **left dummy**, then the right
dummy in this fresh game. Both disappeared and their arrows faded. The
**grenade instruction remains unverified**: captures through 37,360 steps
showed no dialogue panel or grenade arrow. No browser error was logged.
The cause of this transition gap was not established; no full tutorial,
grenade use, native save, guest exit, or FPS result is claimed.

The predecessor worker was interrupted without a final result. Recovery
found no orphan local control loop or remote advance helper. The original
driver PID 28217 and Chrome PID 28246 were still alive. Request 239 had
completed successfully at 14,464 steps (02:40:41.791Z), with no pending
request. Recovery verified the healthy RUNNING/API-idle box before use and
continued that same browser; no second launch or loading restart occurred.
The browser directory had no standalone `events.jsonl`; the event evidence
was in state observations and `commands.jsonl`. First-attempt files and
launcher evidence were preserved. No cause for the worker interruption is
asserted.

Personally inspected captures under `review/` record the sequence:

| Steps | Capture | Observation |
| --- | --- | --- |
| 14,464 | `recovery-14464` | Original comic screen |
| 15,120 | `recovery-after-comic` | Comic continued after balanced Escape |
| 19,232 | `recovery-19232` | Doctor dialogue scene |
| 21,280 | `recovery-doorway-21280` | Jim Dandy title transition |
| 25,392 | `recovery-25392` | Falling sequence |
| 27,312 / 29,360 | `recovery-entry-27312`, `recovery-entry-29360` | Minecrawler title; timing differs from predecessor |
| 29,888 | `recovery-title-dismiss-29888` | Black transition after balanced Escape |
| 33,984 | `recovery-after-title-33984` | Kurt, center arrow, health 100 |
| 34,560 | `targets-before-34560` | Both dummies after one 64-step forward hold |
| 34,576 | `aim-left-34576` | Mouse moved from (440,500) to (390,500), left dummy centered |
| 34,704 / 34,832 | `left-fire-34704`, `left-fire-34832` | Ordinary left-button hold, casings and target reaction |
| 34,960 | `left-settle-34960` | Released fire; left dummy pieces and smoke, right remains |
| 34,976 | `aim-right-34976` | Mouse moved to (490,500), right dummy centered |
| 35,232 | `right-fire-35232` | Second 256-step firing hold, right target breakup |
| 35,488 | `targets-settle-35488` | Released fire; both targets absent, arrows fading |
| 35,744–37,360 | `grenade-check-*`, `grenade-center-37360` | Arrows absent; grenade dialogue not visible, health 100 |

Both firing holds lasted 256 steps, each composed of four acknowledged
64-step requests. No live hit counters were read and ten individual impacts
were not counted. Original read-only `level1.lua` associates both arrow
death animations with state 4 ending, followed by state 5's grenade dialogue
and item creation. The disappearing arrows are consistent with that
transition, but do not substitute for inspecting the requested instruction.
The last capture followed 1,872 further steps after the first capture with
both dummies absent. Ordinary recentering also left no visible instruction.
This observation gap is the precise remaining blocker.

All 643 browser commands have successful receipts. The 591 sequential step
requests sum to 37,360, each at most 64; there are no missing gameplay
acknowledgements. All 22 observed DOM key/button events were trusted and
balanced. Final input queue was empty, active input null, mouse mask zero.
The canonical module was compiled, sent to both guest workers and the
render worker, and instantiated with 2,261 exports. The owning render
worker used OffscreenCanvas WebGL1 with the recorded Intel/Mesa ANGLE
provider. Compatibility was retained and hashed, without a second execution.

Python compile and JavaScript syntax checks passed for all run helpers.
All 569 runtime pins were unchanged. All 1,978 recovered files
(18,707,939 bytes), including both full-SHA modules, matched the runtime
inventory. Evidence includes source Git identity and binary patches, media
path/hash references, captures, command receipts and final observations.
No source/media archive, guest-state/config/check edit, cheat, or production
change was made; a production build was not required.

The single browser segment ran **02:36:03.051–02:53:19.639Z**
(1,036.588 seconds), within 20 minutes. The operator closed the owned
browser normally after preserving the transition evidence; Chrome exited
with code 0. Driver 28217 and Chrome 28246 were absent, port 39989 closed,
and recovery finished before 03:00Z. Box **bx_kbzzavgf / RUNNING, API idle,
health ok / expiry 2026-11-04T03:06:56.554Z** is handed back to
**shutdownOwner=coordinator**. No box stop, delete, resume, or allocation was
performed. Any follow-up needs a separately authorized bounded investigation
of the unobserved grenade transition; this worker stops here.
