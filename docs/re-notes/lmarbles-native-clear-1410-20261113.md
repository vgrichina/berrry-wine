# LMarbles native Puzzle 2 selector and first move, 2026-11-13

Native Puzzle 2 selection is now demonstrated in a fresh local runtime. Pointer
motion onto the second first-tier button showed `Tier 1, Puzzle 2`; one balanced
click opened the native level-2/chapter-1 confirmation. Ordinary Y entered the
complete Puzzle 2 board with Moves 28 and Score 0. No Tutorial prerequisite or
clear was needed. This UI enters the level directly after confirmation; there
was no additional Start button after selector confirmation.

Selected the lower-right red marble, inspected its ring and the full board and
target, then pressed/released Up once. A later settled capture shows the marble
at the top of its column and Moves **28 → 27**, Score 0. This is fresh native
evidence, separate from the historical browser move with Score 1350. The upper
maroon was then selected and its ring inspected. Its proposed Left move was
refused before any input. **CLEAR and next/tally remain UNKNOWN.**

Evidence is `scratch/runs/20261113-lmarbles-1410/`. Reviewed full captures include
`puzzle2-hover.png`, `puzzle2-selector.png`, `puzzle2-settled.png`,
`select-lower-red.png`, `move01-settled.png`, `select-upper-maroon.png` and
`final.png`. Initial action screenshots can show animation; the settled capture,
not the in-flight image, establishes the move consequence. Eleven action logs
passed actual child wait, return-code and both-EOF checks, including seven
separate button/key UP calls. No replay, automatic move chain, guest state,
profile, configuration or clock edits, or forced presentation occurred.

Observed Outlaws1400's distinct resource phase while worker PID1069388 was
live, without waiting for its entire WebGL task. It reported 28,106,752 bytes
net recovered and 1,518,125,056 bytes free. Independently verified both retained
opaque gzip files' full encoded/raw SHA-256 and sizes in RAM, and absence of the
raw paths. Recovery dependencies were untouched. After WebGL's and Pawn1405's
runtime releases, acquired `/tmp/wine-heavy-runtime.lock`, inventoried actual
children, rechecked published runtime changes and launched above a fresh
**1,513,201,664-byte** floor decision. There was no runtime delta since parent
9cf9d24b1 at launch; source commit was
`65dbc2e75c2844f6ebb10b221aee162d72b2ea82`.

All 311 launch source pins and 86 original media plus CRT hashes passed. Module
SHA-256 was `6888cc5e4ec7693a8a317fe29147994c7f88fe43afe3109fe6ab0e3e349eec9f`,
also unchanged after the run. A concurrent owner edited `lib/d3dim-gpu.js`
after launch; its launch/postflight hashes are recorded separately, so this
run does not claim an unchanged source tree afterward. The registered route
used `lmarbles_108`, real ticks, cooperative execution and a full 1024×712 canvas.
Exact Git SHA, relevant binary diff, media references and owned helper patches
are retained without source/media archives. Four helper syntax checks and all
30 parent artifact seals passed. No production edits or build were needed.

The concrete changed blocker is lost sustained disk headroom after successful
launch and new native progress. Independent watchdog PID1078221 acknowledged
before native PID1078222 existed, then observed 1,499,873,280 bytes free and
sent SIGTERM. The host logged `SIGTERM requested orderly shutdown`, saved the
final capture and exited **0** after 387.770 seconds. Native parent wait and both
gzip EOF/hash checks passed; the guard also exited 0 with both EOFs. The later
move-2 action refused before input at **1,499,463,680 bytes**. No second marble
move was sent. The serialized route parent and outer session52375 completed 0.
Native and guard PIDs were independently absent afterward. Boardwatch parent
wait was -15 with both EOFs; outer session84560 completed 0.

Box ID none, state NOT_CREATED, expiry null, stop receipt N/A. No boxes or
workers were created and no unrelated cleanup was attempted. Next requires
sustainable above-floor headroom for individually reviewed native Puzzle 2
moves through CLEAR and next/tally. The selector is available directly through
the native confirmation, so another Tutorial clear is unnecessary.
