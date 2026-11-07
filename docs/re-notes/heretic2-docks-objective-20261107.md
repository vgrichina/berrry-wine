# Heretic II docks objective attempt, 2026-11-07

The first concrete blocker was local disk space before sandbox allocation.
At 10:35:18 UTC `/home` had 1,423,228,928 bytes free; a second check returned
1,423,192,064 bytes. Both are below the owner's 1.5 GB floor and the task's
2 GB guard. The owned run contained only small verification records, with no
disposable data sufficient to recover the guard. Other workers' files were left
alone. No sandbox, Chromium, heavy runtime or original game was launched, and
no input was dispatched. Box ID/state/expiry: none/not allocated/not applicable.
No shutdown, PID, port, profile or held-input cleanup was necessary.

Run: `scratch/runs/20261107-heretic2-docks-objective/`.
The documented October 31 recovery evidence was used to compare the retained
installed tree, without extraction or acquisition. All 1,825 original files
(63,842,666 bytes) match their retained SHA-256 pins, with no missing, changed
or extra installed files. The browser manifest retains SHA-256
`b9b1e85ceeb2daedb056f6299a057be4ef2c8601f0e999ab98ddaa467cfd2e3a`;
all 1,824 manifest entries exist with matching sizes. The run records the
original pins, verification results, exact checkout commit and relevant binary
diff. Git remains the source archive; no source or media archive was made.

`CLAUDE.md`, the sandbox skill, the ops capture workflow and
`docs/re-notes/heretic2-demo.md` were read. Existing localOnly registration,
arguments, clock, media, configuration and saves were untouched. No guest code
inspection or modification occurred. The November 1 crate route remains a
navigation obstruction, not an established emulator mismatch. This attempt
adds no hit, objective, renderer, module, FPS, audio or parity claim; exact staged
Chromium transport validation was not reached and predecessor tests are not
claimed as this run's tests.

Next: restore sufficient disk through the owning workers' safe cleanup, then
start a separately authorized fresh run. Validate that run's exact staged
native input driver and independent release in real Chromium before launching
the original. Explore the route from fresh inspected screens rather than
replaying the failed crate sequence.
