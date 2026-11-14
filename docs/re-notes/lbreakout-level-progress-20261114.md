# Original LBreakout2 fresh level: visible action, incomplete native quit

Evidence: `scratch/runs/20261114-lbreakout-level-progress/result.json` (ignored).
The fresh registered standard CLI run visibly reached Local Game, selected
**Start Original Set**, and started the original first board. Right moved the
paddle center from about x400 to x472. Separate Space detached the ball.
One bottom-row tile at screen `(360,369,40,20)` subsequently darkened; brick
destruction is **not** established. Score stayed **0**. Level clear and next
level were not reached.

The original main menu initially had no selected item. The first balanced
Enter did not change its pixels. A separate Down visibly selected Local Game;
only then did a new Enter open its submenu. Individually reviewed Down inputs
selected Resume Last Game and then Start Original Set; Resume was never
activated and no old state was imported. No fixture or historical gameplay is
promoted as current evidence.

All input pulses had independent UP processes armed before DOWN, unique
nonreplayed tokens, reviewed image hash/age checks, and actual current visible
LBreakout2 main-window focus checks. Every UP was acknowledged, actually waited,
and followed by advancing guest batches. Right held 120ms visibly displaced
the native paddle. Two separate 120ms Space serves produced ball/life/board
changes. The initial score-zero board and subsequent stable darkened tile were
reviewed in full images; an offline PNG region comparison confirms its RGB
mean changed from 138.10 to 67.79 while the board remained present.
No tracking, solver, guest-state/config/clock/score/physics edits occurred.

A separate 100ms P was followed by an immediate gameplay image with no Pause
overlay. After a subsequent independently reviewed Escape, the next image
showed Pause. Thus **P-only pause consumption is not proven**. A separate P
removed the visible overlay. A later Escape eventually showed the actual
**Quit Game? y/n** prompt, after an additional real wait; its immediate image
still showed gameplay. Reviewed Y returned toward the original menu background.
The immutable **240-second CLI guard** then stopped the runtime before a
reviewed application Quit item or guestExit. This is **not nativeQuit** and is
not a successful task completion. No control-quit, deadline extension, UNKNOWN
replay, additional original run, or speculative production repair followed.

The precise observed limitation is incomplete native application quit within
this bounded attempt, with captures sometimes preceding visible guest effects.
No causal emulator defect or permanent input-consumption failure is established.
A fresh authorized continuation should reserve time for menu fade/completion
and application Quit, and review actual results before dependent inputs.
This worker stops after publishing this result.

The pinned verifier passed all **220 original client files, 219 exact companion
mappings, and authentic CRT** before launch and again after termination. PE
imports of the EXE and all six native DLLs were inspected. Executable size is
884491 and SHA256 `cc1fd5c3d229cc1d4f910e658f5abefa80ef8ebf4b5e47801648f0be0e1ca244`.
The unchanged registered cwd is `C:\LBREAKOUT`; original profile/defaults were
preserved in a fresh CLI VFS. No download or media copies were needed.

Actual runtime source SHA was
`4afebb5f46ea44927c5fa5b3dabd6de8d4528eb5`, with relevant binary dirty/new
patches retained. Actual module SHA256 was
`c7f5bada4da4b4ed95b235add0aa1c9843176805d29d5b1ee79359752a19d348`
(2199488 bytes). All 320 runtime pins and 221 media/manifest/EXE/CRT pins were
unchanged afterward. Git plus patches is the source archive; no source tree or
Wasm dump was archived. Production source and foreign WIP were untouched.

Eight focused native-key/pulse controls passed. Two independent watchdog
controls tested deadline termination and normal completion. The full build
actually passed while holding both `wine-heavy-runtime.lock` and
`wine-build.lock`; this report adopts no foreign build result. The original
runtime held the heavy lock for one finite turn, default1000-block slices,
real ticks, no secondary host Workers, 800x600 host screen. An initial queued
supervisor was cancelled before lock acquisition or runtime launch to correct
an unsuitable browser-only test selection; its metadata is preserved.

Actual launcher wait was **0**, both stdout/stderr reached EOF, and no residual
process group was killed. That zero status accompanies `[max-seconds] stopping
after 240s`, not guestExit. Runtime statistics report 239.997s and 249257
batches. The independent **265-second watchdog** was armed before launch,
never fired, and was actually waited with status0/both EOF. All 17 recorded
runtime/watchdog/input/queued process IDs are absent; heavy lock was released
before finalization. Free disk remained about14GB.

Only eleven selected, individually inspected PNGs remain, all named in
`result.json`; intermediate/duplicate PNGs were removed with compact hash
metadata retained. Box ID **none**, state **NOT_CREATED**, expiry **null**;
stop receipt **not applicable**. No box was created, resumed, deleted or left
billing. No public deployment or other worker was launched. The scoped evidence schema,
containment and reference check passes; the global checker reports unrelated
foreign records with escaping/missing paths or invalid schemas.
