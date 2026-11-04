# MDK2 native grenade approach — 2026-11-04

The approach and pickup remain **untested**. This attempt stopped at a concrete
control sequencing failure before any requested gameplay steps or native game
inputs. It demonstrates no tutorial transition defect and justifies no
production change. Evidence is in
`scratch/runs/20261104-mdk2-native-grenade-approach/` (ignored).

Read the transition analysis at `28cc1fe46` and the retained left-target report
before runtime. Dummy disappearance and arrow loss do not establish animation
callback credits or tutorial state. The intended ordinary-control route was
New Game → Medium → aimed chaingun → released fire → short forward approach,
with instruction and inventory captures around pickup. None of that route ran.

Assigned box `bx_zv998agm` was verified RUNNING/API idle, health ok, hydrated,
and acknowledged before use. Expiry is `2026-11-04T03:47:02.868Z`;
shutdownOwner remains coordinator. No allocation, resume, stop or delete ran.

Execution source was pinned to
`1329b1ba6eb00144ff77d4cd92a8513d4fc953ad`, with the retained empty
`accepted-to-execution-source.patch`. Both modules were recovered from the
predecessor's retained inventory and checked before staging:

| Module | SHA-256 |
| --- | --- |
| Canonical | `cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee` |
| Companion | `580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3` |

Staged 432 individually hashed runtime files: pinned Git blobs, original media
at its recorded existing paths, and the two retained modules. No source files,
source/media archive, media evidence copy, build, guest write, configuration or
check change was made. The local checkout baseline was
`3c8642dd4567bcebb85d043e3a28d4a8733cc685`; relevant production binary diff
was empty. Owned new-file patches and the exact source identity are retained.

Preflight passed Python compilation, JavaScript syntax, Puppeteer/static-server
imports, Chrome/display availability, all 432 runtime hashes and an actual
recovered export probe before Chrome. Puppeteer 24.31.0 was installed only in
the assigned runtime with browser download disabled. The unavailable local
`boat-dev` executable was replaced by the available predecessor `boat` CLI.

The operator issued startup capture command 0, then prematurely issued a
64-step request before command 0's receipt had arrived. At
`03:09:16.103Z`, the inherited control helper rejected that request with
`missing prior reply: no retry`, before creating a command file. This was an
operator sequencing error, not a game or production failure. Command 0 later
acknowledged at `03:09:18.128Z`. No retry or further advance was attempted;
the only following browser command was orderly quit, acknowledged successfully.
The exact failure is retained in `first-failure.json` and
`remote-commands.jsonl`.

Personally inspected `review/startup.png`: the registered MDK2 launch is at
frozen step 0, displaying the runtime log, with no native game scene or
instruction. Final observation also reports zero steps and an empty input
queue. The page observer records canonical compilation/instantiation with
2,261 exports and module sending; a guest worker records instantiation. The
companion was retained and hashed, without a second execution. No gameplay
renderer ownership, callback/state, dummy defeat, pickup, inventory, throwing,
full game, FPS, save, or guest-exit result is claimed.

All 21 recovered unique artifacts, totaling 4,591,168 bytes, match their full
SHA-256 inventory, including both modules. All 432 staged pins remained
unchanged. Chrome 9324 exited normally with code 0 at
`03:09:29.580Z`; driver 9282 and Chrome were absent and port 46643 closed
on the subsequent check. Driver launch at `03:09:02.883Z` through browser
close at `03:09:29.580Z` bounds the whole browser segment to at most
26.697 seconds, within 20 minutes; recovery completed before 03:37Z.

Hand back **bx_zv998agm / RUNNING, API idle, health ok, hydrated / expiry
2026-11-04T03:47:02.868Z** to the coordinator, with browser/helpers closed.
The ordinary post-shooting approach remains the next unperformed action, but
requires a separate assignment. This single bounded task ends at its first
control blocker; no successor was launched.
