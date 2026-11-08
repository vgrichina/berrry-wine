# BG2 jailer-key route: interrupted worker and recovered evidence

Run: `scratch/runs/20261108-bg2-jailer-table-key/`.
The jailer-key pickup and Jaheira release remain unverified. The worker exited
143 without outer `result.json` or `final.txt`; the cause is unknown. This is
not a clean worker pass or a demonstrated emulator defect. No emulator code
was changed or regression/build result added by the coordinator.

The original 645-file fixture and all 1,283 staged runtime pins passed their
recorded checks. Ordinary character creation accepted uppercase naming and
reached the opening prison scene with Imoen joining. Native map inspection and
bounded floor destinations left the selected party beside the prison cages.
The coordinator inspected `original/west-view.png`, `west-floor.png` and
`west-arrival.png`: the party and cages are visible, but no furnished jailer
room, table loot, key acquisition, native save export or cage release is
established. A retained retail map and prior-run room captures were references,
not proof of this fresh run's destination. Read-only cache/resource observations
likewise do not establish room traversal. Further work needs a verified native
route to the table; repeating character creation and a broad corridor survey
does not resolve that boundary.

The coordinator confirmed worker PID 3023384 absent and its tool handle exited
143. The independent watchdog remained live. No further gameplay input was
sent. A unique cleanup-only quit command returned exact successful ACK number
79; all 80 numbered commands have matching successful replies and no recorded
first-failure file. Chrome closed normally at 02:06:35.381Z, code 0, signal null.
The initial immediate terminal audit found cleanup incomplete; a later read-only
audit confirmed controller/Chrome PIDs absent, both ports closed and profile
removed. No original command was replayed.

The existing locked retrieval/stop helper recovered and SHA/size-verified all
883 terminal artifacts, 49,079,049 bytes, before requesting shutdown. See
`terminal-retrieval-verification.json`, `prestop-verification.json`,
`terminal-pins.json` and `cleanup-verification.json`. Normal stop
`stop_da0197d4385d8b1d` completed at 02:08:02.385Z, forced false, error null.
Box `bx_mbxkzvbj` is archived with expiry null. Its watchdog observed that stop
and exited; the orphaned local board watcher was stopped by its exact PID.

Recovery retains runtime/media pins, source references and relevant patches,
the original module, captures and logs in the run directory; no source/media
archive, guest state edit, resume, deletion or public deployment was used.
The missing outer worker reports are intentionally not fabricated. Replaced
the stopped lane with a fresh Redline action worker; this interrupted route
does not block the fleet. FPS, audio, full playability and GL coverage remain
outside this evidence.
