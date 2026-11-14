# SuperTux: first menu pulse expired; gameplay not reached

Evidence: `scratch/runs/20261114-supertux-enemy-level/`.

This single bounded task did **not** advance beyond the predecessor. The fresh
original reached a personally reviewed title menu, but its first menu Down
choice used a **60 ms operation deadline**. That window was too short: the
production guard returned `CANCELLED`, `queued=false`, `consumed=false`,
`consumedAt=null`, reason `immutable deadline expired`, and `noReplay=true`.
The native log contains zero input-dequeue or dispatch-input entries.
Review age at intent creation was **5.549 seconds**, within the unchanged
12-second cap; the failed limit was the 60 ms operation window.

The controller retained its terminal input-failure record. This was not a
positively `NOT_SENT` rejection with a `VALID` lease, so the authorized fresh
capture/new-intent recovery did not apply. No failure was cleared, owner rebound,
old intent reissued, deadline extended or second original launched. The native
guard receipt was CANCELLED; a production guard UNKNOWN is **not** claimed.

There is **no fresh level baseline**, keyboard-options review, story/level entry,
movement, jump, new terrain/enemy consequence, level completion or native Quit.
The predecessor's 100/4 → 150/6 counters are not attributed to this run. Full27
remains unproved. The blocker is the worker's insufficient first operation
window, not a demonstrated gameplay or emulator failure.

The prepared controller preserves permanent ownership, the 12-second review cap,
independent release before DOWN, immutable finite operation deadlines,
postrelease guest progress and sticky UNKNOWN/no replay. An expired choice
can only be replaced after a positively NOT_SENT result with a VALID lease,
then a fresh capture, personal review, new intent and new nonce.

Independent UP was armed before the attempted DOWN. It returned release ACK,
and its child was actually waited **0**, with separate stdout/stderr EOF. No
DOWN was consumed, so no postrelease gameplay-progress result is claimed.

After the terminal failure, `cancel-request.json` caused the supervisor to send
SIGTERM. The native log explicitly records `SIGTERM requested orderly shutdown`.
Native runtime statistics report **69.045 seconds**. This orderly harness
shutdown is distinct from selecting the native Quit menu.

The native process, independent watchdog and supervisor child were each
actually waited **0**, all with separate stdout/stderr EOF. The watchdog armed
before native creation with a fixed **1,220-second** deadline; the native CLI
limit and controller runtime deadline were fixed at **1,200 seconds**. Neither
was extended. The watchdog exited on the actual native-wait receipt and did
not fire. The supervisor released the heavy-runtime lock. These waits come
from receipts, not missing PIDs. The detached outer parent's own exit status
was not externally waited; its supervisor-child wait is recorded explicitly.

All 30 recorded child identities checked in cleanup are absent, the outer
parent is absent, and control port 8465 is closed. These absence checks support
cleanup and do not replace the actual waits. No boxes were created: box ID
none, state `NOT_CREATED`, expiry null, stop receipt not applicable.

Launch source HEAD was `043f96fdad495aecfb97a397be11fa521106bd39`.
Module SHA-256:
`dcf6e8f0ca9d361c10fa556fb30835d34cf5bfe4089f84d298cb57fd170dbd42`.
The accepted 317-file source closure and compiled module matched under the
heavy-runtime lock after TIM construction and Hexen II. The accepted full build
was reused; postflight found zero source/module/media drift. No production code
or foreign WIP was changed. Git SHA, relevant binary diffs and owned new-file
patches retain source provenance; no source/media archive was made.

All 787 original media files, the authentic standing CRT and 786 manifest
mappings passed verification. The registered `--sdl --datadir data` route and
guest cwd C:\\ remained unchanged. Native logs show the six original bundled
DLLs and CRT, and `clock=real` from the explicitly authorized `--real-ticks`.
No profile, settings, state, physics or clock edits occurred.

Fresh real shared-WASM UI-owner, 22 guarded CLI and clock-control checks passed.
The controller fixture proved expired-review zero DOWN, fresh nonce admission,
independent release and sticky transport UNKNOWN refusal. Supervision fixtures
passed normal exit, launcher loss, parent SIGTERM and deadline handling. A
receipt-read race appeared in the first supervision run: a reader saw an empty
JSON before its writer finished. Atomic receipt publication in this run's new
helper fixed it; the four checks then passed. A separate fixture passed actual
native/watchdog/supervisor waits and separate EOF with the 20-second watchdog
grace. The failed first fixture log remains preserved. None of these fixture
passes establish original gameplay.

One selected personally viewed title PNG passed CRC, inflate, size and SHA-256
checks; the black startup PNG was removed with metadata retained. Compact logs,
JSON and patches preserve the bounded failure. No downloads or deployment
occurred. The evidence checker found zero containment, missing-file or schema
issues for this run; its global exit 1 reflects older foreign records, summarized
in `evidence-check-summary.json` and left untouched.
A separately assigned future task can choose a practical first menu
operation window; this terminal run cannot be resumed. This worker stops after
publishing this note, without another launch.
