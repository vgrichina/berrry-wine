# MDK2 acknowledged grenade route — 2026-11-04

Startup acknowledgement sequencing passed, but the ordinary post-shooting
approach/pickup remains **untested**. This attempt stopped during the native
intro comic when a run-only transport deadline expired. No production runtime
defect, tutorial callback/state, dummy defeat, grenade inventory, pickup or
throwing instruction is established. Evidence is retained in
`scratch/runs/20261104-mdk2-acknowledged-grenade-route/` (ignored).

Before Chrome, a delayed-startup mock verified that command 1 was not published
until receipt 0 arrived. Mismatched, failed and absent receipts were rejected.
The helper blocks on every matching prior receipt, atomically publishes each
command, then waits for its matching successful receipt. Live validation passed
284 commands, including 259 step requests totaling 16,320 steps (maximum 64),
with every command timestamp following the prior receipt. All 12 observed DOM
key/button events were trusted and balanced; final input queue was empty,
active input null and mouse mask zero. Startup capture 0 acknowledged at
03:16:27.958Z before the first advance. Capture names are labels: the early
`boot-3072` capture actually shows step 2,304; `loaded-3072` shows step 3,072.

Personally inspected the title/menu sequence, highlighted Medium difficulty,
loading comic and final native comic. New Game/Medium was selected through
ordinary controls. A balanced Escape occurred during loading. The final
`review/timeout-final.png` shows the comic at 16,320 steps, not gameplay.
There was no movement, aiming or chaingun firing. Dummy disappearance and arrow
loss would not prove callback credits; pickup gates the later state 6 throwing
panel, as explained in the predecessor transition analysis at `28cc1fe46`.

The first failure is preserved in `first-failure.json` and the complete
`remote-commands.jsonl`. At 03:23:37.136Z, Boat terminated control batch
`cmd_hoy9piamqufs` with SIGTERM/exit 143 after its 85-second transport timeout.
This batch requested 32 separate 64-step commands; it had published commands
259–281 before termination. Receipts through 280 were returned in its stdout.
Command 281 subsequently acknowledged successfully. The browser reported no
failed game command. No gameplay retry or further advance followed; only an
acknowledged final capture and orderly quit ran.

The batch-wide deadline was a helper error: an 85-second transport enclosing
many individually acknowledged commands can expire despite successful command
receipts. The executed helper is retained as `control.executed.py`. Offline,
`control.py` was changed to use one transport/deadline per command. Mock tests
passed independent command deadlines and stopping on the first failure. This
repair was not tested with further gameplay; its only subsequent live action
was orderly quit. Python compilation and JavaScript syntax checks passed.

All 432 prepared runtime pins passed before Chrome and after cleanup. There
was no source restaging, substitution, production change, build, media copy,
archive, guest write, console, configuration/check change or second launch.
Execution source remains `1329b1ba6eb00144ff77d4cd92a8513d4fc953ad`, with the
retained empty `accepted-to-execution-source.patch`. The exact local checkout
SHA is in `checkout-head.txt`; relevant production binary diff is empty.
Owned new-file patches record the run-only helpers and this note.

| Module | SHA-256 |
| --- | --- |
| Canonical | `cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee` |
| Companion | `580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3` |

The canonical compiled module was sent to both guest workers and the owning
render worker; all recorded instantiations expose 2,261 exports. The render
worker used OffscreenCanvas WebGL1 with Intel/Mesa ANGLE. The companion was
retained and hashed, without a second execution. No FPS, full-game, save or
guest-exit result is claimed.

Read-only artifact recovery first encountered a TLS EOF; the retry reused
already verified files and completed successfully. All 881 recovered unique
artifacts, totaling 12,799,137 bytes, match the full SHA-256 inventory, including
both modules. Browser/helper recovery and cleanup completed before 03:37Z.
Driver launch at 03:16:18.265Z through Chrome's normal exit at
03:24:20.582Z bounds the browser segment to 482.317 seconds, below 18 minutes.
Chrome 13872 and driver 13860 are absent, and port 35409 is closed. No lifecycle
action ran. Evidence containment passes for this run; unrelated existing
global evidence errors were left untouched.

Hand back **bx_zv998agm / RUNNING, API idle, health ok, hydrated / expiry
2026-11-04T03:47:02.868Z** to **shutdownOwner=coordinator**, with owned browser
and helpers closed. The requested tutorial-room approach remains unperformed.
This single task ends at the retained live transport failure; no successor was
launched.
