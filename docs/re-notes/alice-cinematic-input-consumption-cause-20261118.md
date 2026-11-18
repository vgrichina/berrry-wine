# Alice cinematic input consumption: bounded diagnostic

Run: `scratch/runs/20261118-alice-cinematic-input-consumption-cause/`.
Predecessor: [prepared player control](alice-prepared-player-control-20261118.md).

The startup Escape reached the native input handler and entered its queue, but
the original made no USER dequeue attempt during the five-second intent. The
same queue edge remained until cancellation. There was no renderer input poll,
native dequeue candidate, or native return candidate; the armed native USER
observation sequence remained zero. The bounded trace dropped no rows. This is
a polling gap, rather than evidence of a PM_NOREMOVE, target, or receipt
validator defect. The independent physical release was acknowledged promptly,
so synchronous control-event-loop starvation is not supported by this trace.
UNKNOWN closed that scope; there were no subsequent endpoint requests or replay.

A fresh launch selected passive startup before its timer began. Without Escape,
the authentic original reached its main menu after approximately 244 seconds.
Reviewed Enter selected New Game, then reviewed Enter selected Easy. Both were
consumed by the real owning USER PeekMessage return (hwnd 65543, thread 1,
PM_NOREMOVE), in approximately 850 and 980 milliseconds, with independent UP
acknowledgements. Thus the unchanged native path can deliver ordinary original
menu input once the guest polls. No presentation-count threshold was used as
readiness.

Pandemonium loading subsequently progressed to the Cheshire Cat loading screen,
then remained there through the selected gameplay cutoff. Read-only observations
showed changing execution addresses around 0x468f01–0x46910d and an unchanged
rendering bridge (474 presents). During the Quit reserve the scene eventually
advanced to autonomous floating alphabet blocks. Reviewed ordinary Escape then
consumed normally and the captured consequence was an Alice title frame. It
did not establish a Quit confirmation. The retained registers and stack identify a
concrete next investigation: guest work during level loading, including the
byte/bit decoding loop around those addresses. No causal player W, jump, attack,
or ordinary Quit was demonstrated. Harness cancellation or deadline termination
is not ordinary Quit. The original lifetime, independent watchdog, and 180-second
Quit reserve were fixed before launch; they were not extended.

No Alice runtime patch is justified by these observations, and no Alice runtime
or controller code was changed. In particular, increasing an input timeout would not repair a
guest that is not polling. A browser-versus-native original comparison and
DirectInput/GetAsyncKeyState timing remain unproved; the general consumer trace
exhausted its detailed budget before the relevant interval. Its later USER
samples must not be presented as continuous DirectInput tracing.

Evidence limits: the first Escape's scene annotation incorrectly anticipated
Rogue; the actual reviewed file showed the EA Games cinematic. Viewing and
dispatch had been batched, so personal review did not precede that dispatch.
`original-diagnostic/review-correction.json` preserves this error. It does not
invalidate the physical queue trace, but that dispatch is not reviewed gameplay
evidence. Diagnostic trace identity fields based on the hidden first console
also must not be treated as the actual game target; readiness and input snapshots
identify the real game window. Two passive observation subprocesses ended with
SIGTERM; retained partial observations are not complete observation intervals.

The run-local `check-cause.cjs` regression checks unchanged queued Escape,
absence of dequeue observations, UNKNOWN closure, and the same original's exact
native menu/Easy receipts plus independent releases. The three focused Alice
helper tests passed. This is evidence validation, not a synthetic guest-poll
reproducer or an assertion that player control works.

The required full build initially detected a stale generated
`lib/gl-gps-declines.generated.js` after an incoming GLGPS change. Regenerating
that file reconciles reason 10's explanatory text with its existing source and
JSON mirror. This separate build repair changes diagnostic text, not Alice's
polling behavior. Its generator check and the final locked build are retained.

Recovery uses Git, the predecessor's retained exact module, and the existing
authentic media package. Module SHA-256:
`46c9b8e4af91a8770d454ff529e21d6a17553c31ad57aea30ca4a8aa6bf3e311`.
Base runtime Git: `2b8ba1b675a6fc0ce286d48a6261dc04acef62dd`.
Committed override revision: `5732320bb39c4b7f7327f51e30c6ed1d07e26074`;
the exact three override hashes and frozen graph inventory are retained in
`initial-git.json` and each scope's `runtime-inputs.json`. Both observed source
graphs and all 16 media pins passed `verify-inputs.cjs`. No foreign WIP or media
copy was adopted. `recovery-reference.json`, `publication.json`, and `result.json`
record recovery paths, final actual waits, and the final outcome. No box was
created.
