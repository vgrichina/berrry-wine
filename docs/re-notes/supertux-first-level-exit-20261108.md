# SuperTux first-level exit attempt, 2026-11-08

**Not cleared. No next-node progression.** The observed blocker was repeated
enemy-contact deaths during live visual-review gaps. This run does not add an
exit claim to prior `9b1ab25cd`'s movement, jump, coin, or stomp evidence.

Evidence: `scratch/runs/20261108-supertux-first-level-exit/`.
Tested main SHA: `6138f2546f6d8b7b1d2f2ebaf8ff274acbb67297`.
Executing Worker module recovered through CDP and independently hash-checked:
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.
No emulator or control-driver repair, media change, or source archive.

## Native route and outcome

One fresh box/browser reused the qualified Arrow/Space/LeftControl driver,
independent releases, exact ACKs, and process/Worker/module/canvas ownership
checks. Unchanged controls were not requalified. Canonical verification passed
before and after: 787 originals, authentic CRT, 786 manifest mappings. HTTP
responses also matched all 787 original file hashes and the CRT.

Personally reviewed Start Game → Slot 1 Free → story → native Escape story
skip → world map → Down → red **Welcome to Antarctica** node → Enter.
The first life crossed the opening rows and snow pillars and reached the lower
platform before the tall ice platform. It did not pass the tall platform or
reach the exit. The following deaths are retained in the passive sequence and
six reviewed `review/death-*.png` sheets:

| UTC | Boundary |
| --- | --- |
| 03:27:08–12 | Enemy approaches Tux near the tall ice platform, contact/death animation, then Tux × 3 introduction. |
| 03:27:35–40 | Enemy reaches idle Tux before the opening pillars; next life has two lives. `life-two-pillars` was sent after this death. |
| 03:27:54–59 | Another pillar-area death, then Tux × 1 introduction. `life-three-enemy` was sent after this death. |
| 03:28:33–37 | Enemy contact before the pillars; death and native Game Over, score 350 / coins 14. `life-four-pillar` does not prove a pillar crossing. |
| 03:29:55–58 | After native Slot 1 reload, enemy contact beneath the second block row; Tux × 3 introduction. |
| 03:31:15–20 | Enemy reaches Tux near that row after a backstep; death and Tux × 2 introduction. `a2l2-on-row` ends at the respawn, not on the intended row. |

The first Game Over returned to the native slot screen showing
**Slot 1 — Icyisland — 0/26**. Enter reloaded its ordinary map with four lives,
score 0 and coins 0; Enter at the same first node began the second attempt.
No evidence across these deaths or the reload is joined into one life.

The concrete limitation was reaction latency: full captures commonly occurred
about 6–10 seconds apart while the game continued running. Enemies visibly
closed the distance during those gaps. Exact input ACKs do not establish that
a planned jump preceded enemy contact. Attempts to stop on raised surfaces
also sometimes ended on lower ground or beyond an edge; they are not accepted
as safe landings. This is an observed gameplay/control-loop blocker, not a
demonstrated emulator mismatch.

At 03:31:33Z native Escape opened the visibly reviewed **Pause** menu.
Its timer remained 286 through subsequent menu captures. Native Down → Down
selected **Abort Level**, then Enter returned to the map. `abort-level.png`
and `next-node-locked.png` show Tux still on **Welcome to Antarctica**, the
first node still red, and the next node below still red. A native Down pulse
did not advance Tux or change the label. No exit/result screen was observed.
The pause was used only to conclude the attempt, not hidden between moves.

## Evidence and shutdown

The unchanged driver produced 58 exact command ACKs, 44 input pulses,
92 balanced trusted DOWN/UP pairs, zero UNKNOWN outcomes and no held keys.
There are 1,478 timestamped passive frames. Its inherited fixed crop sometimes
loses the HUD after layout changes; full command captures retain the relevant
HUD and menu boundaries. All named full captures and six death sheets were
personally reviewed. PNG CRC checks passed for 1,542 retained/derived images.

2,102 remote references, 215,903,736 bytes, and 1,152 distinct hashes were
retrieved and independently rehashed **before** normal box stop. All 1,377
runtime pins remained unchanged. Chrome exited 0; browser/controller PIDs,
both ports, profile and writer lock were absent, with no held inputs or owned
live runtime. The retrieval checker used exact process names rather than the
previous run's ambiguous substring cleanup predicate.

Fresh UUID-idempotent box `bx_uj9bw37c` had an independently observable
25-minute watchdog armed before allocation. It was normally stopped at
**03:33:05.072Z**, state **archived**, current expiry **null**, initial expiry
**03:49:53.050Z**. Receipt `stop_03bb93206abf7585` completed at
03:33:05.096Z, `forced=false`. Normal/watchdog delegates exited 0; supervisor
has no remaining children. Disk stayed above 5 GB; no RAM gate was used.

The run records Git SHA, relevant patches, owned-input patches, runtime pins,
module bytes/hash and existing media recovery references. No private guest
variables, level edits, state injection, clock/scheduler changes, reinstall,
media archive, old-box resume/delete, deployment or nested worker was used.

Next work should address the measured review/reaction gap on the exact native
driver, with a locally verified and visibly documented native-pause sequence
if used, before another original-level attempt. SDL Canvas2D is not GL
evidence; FPS, audio quality and full-game playability remain open.
