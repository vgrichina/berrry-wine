# Original Quake III native GL, 2026-11-14

**Unqualified: no live arena or combat consequence.** Three fresh original
`quake3_demo` runs reached native menus and ordinary local Fight loading, but
the final immutable 600-second run ended displaying `LOADING... MAPS/Q3DM1.BSP`.
This is a bounded loading observation, not proof of a generic renderer/input
bug or a crash. No production repair was justified or made.

Evidence is in ignored `scratch/runs/20261114-quake3-native-gl-arena/`:
`result.json`, `postflight.json`, per-attempt `launch-state.json`,
`launch-source-pins.json`, `launch-source.patch`, `boundaries.jsonl`, queue
receipts and actual terminal/watchdog records. Thirteen result-named key PNGs
were reviewed; redundant stages were removed with hash records. No frame
series, media copy, source archive or Wasm dump was retained. Git SHA plus
binary patches identify the source, including relevant foreign uncommitted
hunks and the untracked runtime helper. Foreign WIP was preserved.

The complete existing closure matches all 307 six-app media path/SHA256
references. Native packages were restored offline using the GLTron predecessor's
recorded npm lock/cache; all 162 installed file hashes matched before use and
again before removal. `native-recovery.json` records the recovery command,
lock hashes and removal of only this run's regenerable node_modules.

All attempts used actual `--headless-gl`, `--real-ticks`, default 1,000-block
batches, `--no-threads`, the registered original and no software fallback.
The loaded 2,199,488-byte module SHA256 was
`c7f5bada4da4b4ed95b235add0aa1c9843176805d29d5b1ee79359752a19d348`.
First launch Git SHA was `2ff51d887e2d5f3f30c6490e47fad0aeb2d066dd`;
final launch SHA was `33f9028c79216d36e4e217a92ae4cf3b9a17570f`.
All 318 pinned runtime sources and 103 actually loaded host files remained
unchanged across the runs. The observer traced existing public context creation,
current binding, draw, swap, native readback and compositor calls; it injected
no draw, swap, readback or forced presentation.

The first immutable 300-second run created/bound owner0/context1 at about 1.3s,
with `gl_sw_enabled=0`. Its gray capture at 18.35s had publication sequence0.
First packed draw occurred at 27.649s, native swap at 29.358s, varied RGB
readback at 29.365s and presentation/compositor at about 29.384s. The reviewed
63s capture showed the main menu. Thus the prior sweep's gray20s ended before
this original's first draw; it remains unqualified, not crashproof or defect
proof. This agrees with the GLTron predecessor's delayed native startup.

The first attempt reached Difficulty, visibly selected I Can Win and entered
Connecting to localhost. A fresh immutable 420-second attempt reached the
actual Q3DM1/Major roster, native pointer-highlighted Fight, Difficulty and
another ordinary Fight click; it also ended in local loading. Immediate stale
menu captures during guest loading did not establish lost input. No UNKNOWN
command was replayed.

The final attempt started at 10:46:21.969Z after the shared heavy lock became
available. It showed the main menu at 133s; one released Enter opened the
Single Player route, with the reviewed Q3DM1/Major roster at 206s. Bounded
relative mouse motion highlighted Fight, then a finite Mouse1 click opened
Difficulty. I Can Win was visibly white at 282s and remained white with the
pointer moved away onto Fight at 293s. Another released menu click entered
local loading at 305s. At 433s the original added `LOADING... MAPS/Q3DM1.BSP`,
`ARENA GATE`, `SINGLE PLAYER`, `FRAGLIMIT 10`. The personally reviewed 582s and
600.675s captures still showed that loading screen. This is levelshot/loading
content, not a live arena. Final native totals were 723,724 draws and 3,736
presents/native readbacks, context1 current for owner0 and `gl_sw_enabled=0`.

No gameplay movement or shot was issued: a live world and readable target
never became available. Controller actions named aimfire were zero-delta
Mouse1 **menu clicks**, not attacks. Each DOWN had an independent UP timer
armed first; all 22 press pairs across the three runs have ACKed UP, and the
final trace consumed the keyboard and Mouse1 releases with no held buttons.
Menu progression and later captures establish effects beyond ACK alone, but
there is no hit, enemy encounter or frag evidence. No console, map command,
guest state/config/clock/AI write, forced call, blind gameplay key or tracking
was used. The new run-local controller is preserved as a Git addition patch.

Five focused finite-input tests (including real dead-child UNKNOWN/no replay)
and three lifecycle tests passed. Native shader/readback preflight passed
using llvmpipe LLVM20.1.2; this is native-package backend evidence, not physical
GPU evidence. The full build passed while holding both wine-heavy-runtime.lock
and wine-build.lock. Its initial file-output wrapper's EOF wording is corrected
explicitly in `prerequisite-supervision-correction.json`; actual build wait0
was observed. All three actual runtimes and their outer supervisors waited0,
consumed stdout/stderr through EOF and joined their prearmed independent
watchdogs. Guards were 300/420/600 seconds, watchdogs 320/440/620 seconds;
none was extended. One lock-queue attempt expired without launching Q3 and
is separately recorded, not counted as runtime coverage. Heavy turns were
serialized with TIM and other workers. No runtime process was left running.

The next useful work is a separately bounded startup investigation or longer
reviewed loading allowance with these exact source/media pins. Current evidence
does not localize a generic defect to repair, and does not satisfy the requested
arena/combat outcome. No 27-app, physical-GPU, pixel-parity, browser, audio or
frame-rate claim is made. No box was created: ID null, state NOT_CREATED,
expiry null, stop receipt N/A. No public deployment occurred.
