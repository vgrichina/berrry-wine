# MDK2 per-command deadline validation — 2026-11-04

The run-only deadline fix passed live validation: **349 matching successful
ACKs**, with each transport enclosing one command. The requested original
New Game/Medium tutorial route was **not reached**. The native attract demo
appeared instead; no tutorial, aimed firing, dummy defeat, instruction,
inventory, approach or pickup is established. Evidence is retained in
`scratch/runs/20261104-mdk2-per-command-native-route/` (ignored).

Used the patched predecessor `control.py`, not `control.executed.py`. Delayed
startup ACK, mismatched ACK, failed ACK and absent-ACK timeout mocks passed.
A virtual 150-second sequence passed with three independent 85-second
transports; the first-failure transport mock stops after one call. Live
commands ran across more than six minutes without an outer batch deadline.
All 325 step requests completed, totaling 20,704 steps, maximum 64. Receipt
ordering validates the prior matching ACK before every next command.

Preflight passed Python compilation, JS syntax, Puppeteer/static-server
imports, all 432 prepared hashes, and an actual recovered small-file probe.
The unavailable `boat-dev` prerequisite was replaced with the installed
`boat` CLI before runtime; its failure is preserved. No prepared runtime
source, media or module was rebuilt, substituted or restaged.

Personally inspected the native BioWare/title sequence, loading artwork,
13,200-step attract scene explicitly labeled **Demo**, black transition after
balanced Escape, and subsequent loading artwork through 20,704 steps. The
title click and Enter did not establish visible New Game/Medium selection.
There was no native comic/tutorial confirmation. No blind input replay,
empty-position firing, guest write, console, cheat, configuration/check change,
reload or second browser launch ran. All eight observed DOM button/key events
were trusted and balanced; final input queue was empty, active input null and
mouse mask zero.

A concurrent read-only evidence recovery failed its hash assertion because
`browser/commands.jsonl` grew between inventory creation and download. The
initial inventory and traceback are preserved. This is a run-only recovery
integrity failure, not a demonstrated game or transport defect. A stop attempt
found the already-running 64-command batch had finished; therefore immediate
cessation at the recovery failure was **not achieved**. The only explicitly
issued subsequent browser commands were final capture and orderly quit.
No new gameplay batch, retry or reload followed. The final stable recovery
passed. The run-only recovery helper now refuses to inventory before the
owned browser's cleanup record exists; a temporary-tree regression verifies
rejection before inventory mutation and acceptance after closure.

Execution source remains `1329b1ba6eb00144ff77d4cd92a8513d4fc953ad`.
The exact checkout SHA, relevant binary diff, empty accepted-to-execution
source patch, and owned new-file patches are retained; Git is the source
archive. No source/media archive or media evidence copy was created.

| Module | SHA-256 |
| --- | --- |
| Canonical | `cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee` |
| Companion | `580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3` |

The observer records canonical compilation, instantiation and sending to both
guest workers and the owning render worker. All worker instantiations expose
2,261 exports. Actual rendering uses OffscreenCanvas WebGL1 with Intel/Mesa
ANGLE; this is worker observation, not toolbar inference. Companion execution
was not attempted. No FPS, full-game or tutorial callback/state claim is made.

Final recovery verified **1,079 files / 12,991,209 bytes**, including both
modules, against the full SHA-256 inventory. All 432 runtime pins remain
unchanged. Chrome PID 25130 exited normally at **03:38:41.724Z**; driver
25054 is absent and port 38891 is closed. Driver launch at 03:32:34.415Z
bounds the browser segment to **367.309 seconds**, below ten minutes.
Recovery and own-helper cleanup completed before 03:42Z. No production change
or build was needed; only this completed observation note is committed.

Hand back **bx_zv998agm / RUNNING, API idle, health ok, hydrated / expiry
2026-11-04T03:47:02.868Z** to **shutdownOwner=coordinator**. No allocation,
resume, stop, delete or public deployment ran. The next unresolved work is
ordinary inspected New Game/Medium selection and tutorial entry, with stable
post-close recovery. This single task ends here; no successor is launched.
