# SDL coordinate arrival and modal Quit repair

This task adopts the released SDL and modal repairs documented in
[the SDL investigation](lmarbles-sdl-selection-20261114.md) and
[the modal investigation](forsaken-native-exit-repair-20261114.md).
Evidence: `scratch/runs/20261114-lmarbles-sdl-modal-gameplay/`.

The SDL producer preserves a separate pointer-arrival pump before a coordinate
button press. The real original SDL public consumer distinguishes the failed
queue-only control from motion, button down and button up across pumps. The
CLI scope regression retains its original main/Worker scope assertions.
The modal pump ends its owning wait on explicit PostQuitMessage marker 2 and
leaves WM_QUIT pending for its caller; ordinary dialogs and marker 1 retain
their previous behavior. The public synthetic x86 regression covers A/W
MessageBox, stdcall unwind and outer PeekMessage retrieval.

Publication uses the exact HEAD census text with only the two reviewed owned
rows replaced. The full shared WIP census is preserved as bytes, SHA256 and
Git patch, checked before mutation and restored immediately after the explicit
path commit under the same heavy lock. Foreign sources and reviews are not
adopted. Duplicate keys outside those rows remain byte-for-byte from HEAD.

The earlier failed controls, two mistaken transitional-scene reviews and
baseline extraction failures remain in their original run directories. They
are not reclassified as successful native gameplay.

Repair commit: `a56ebeec0a1a650fdbaea1eeabc9ee44beb7d9f4` on main.
The full build passed under both heavy and build locks; all 18 focused suites
passed. A committed-HEAD check read 301 sources from Git in memory and passed;
the restored shared census passed its 437-boundary gate. The preserved full
WIP census SHA256 is
`627682051de576d62c0dcaa6abba3417fad6e511f5cecc2a1b254be0854f4220`.
Only the six adopted source/test paths and the exact census path were committed.

The first queued tool was interrupted with SIGTERM before acquiring the lock,
building or launching an original. Its interruption is retained. Detached jobs
then performed actual child waits and separate EOF checks. Initial pull output
still named HTTPS despite a remote URL config override; a subsequent explicit
URL rewrite forced pinned SSH pull, followed by pinned SSH push and direct
remote-main hash verification. Those actual transport logs are retained.

The sole fresh original ran after Forsaken, with native `lmarbles_108`, real
ticks, actual Workers 1 and 2, and unchanged 87 media pins (86 manifest entries
plus authentic CRT). The setup was Normal / Original / Michael / Puzzle 7.
The fixed 900-second limit and independent prearmed 920-second watchdog were
not extended. No box was created, resumed or deleted.

The first native marble selected directly, without selector reentry or a
separate hover action: before pressing, the game had selection 0 and last motion
(568,359); after the direct blue (3,6) press, selection was 1, selected tile was
(3,6), and SDL/game motion both reached (171,287). `select01.png` shows its ring.
The public regression and original therefore both prove coordinate arrival.

The inherited 22-slide manual suggestion list had the two left target arms
reversed. It did not clear Puzzle 7; `after22.png` preserves that failure.
A corrected offline solver printed eleven further suggestions, which were
executed manually after individual fresh scene reviews. It had no connection
to the runtime or input producer. After 33 slides total, Puzzle 7 cleared with
15 moves left (`move33.png`); the native tally showed total score 1750
(`tally.png`). Native continuation entered the fully settled Puzzle 8, score
1750 and 96 moves (`puzzle8settled.png`). No Puzzle 8 gameplay or full27 claim.

Native Quit remains unproved because I failed to reserve enough time. Escape
and Y left Puzzle 8 for the complete native setup. The final setup Escape was
requested at 893.43 seconds, with 6.57 seconds left. The controller requires
an eight-second operation window including its safety margin and refused it
before independent arm or DOWN: `operation exceeds fixed runtime`. Its sticky
terminal state was preserved, with no replay, rebind, deadline extension or
further input. This is a run-planning failure, not evidence that the modal repair
failed. Native stdout records max-seconds termination at 899.996 seconds;
exit status 0 is not native Quit.

All consumed inputs had unique nonces, personally reviewed scenes at most 30
seconds old, a permanent production owner, independently prearmed UP, actual
release wait 0 with separate stdout/stderr EOF, and post-release progress.
The audit checked every pulse against its requested duration (all within
100 ms), including the final 100 ms Y. There were no guest memory, state,
score, save or configuration writes and no autoplay.

Native, watchdog, supervisor, outer child and invoking-job waits completed with
status 0 and separate EOF; the watchdog remained unfired. No owned native PID
or control listener remains. All source/media/module postflight hashes matched;
free disk remained above 12 GB. Nine result-named screenshots were CRC checked,
inflated and SHA256 verified; other screenshots and full observation streams
were removed after compact, hash-labelled logs were saved. Recovery uses the
Git commit and retained binary patches, without module/media/source archives.

The repair is tested and published. The bounded original proves first-click
selection, Puzzle 7 clear, tally and Puzzle 8 entry. Native Quit and full27
remain unproved. Any further original run requires a new owner authorization;
this task stops without another launch.
