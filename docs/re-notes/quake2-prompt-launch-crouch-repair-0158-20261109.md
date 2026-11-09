# Quake II launch, shutdown and crouch repair, 0158

Production now composes the actual 0105 control caller and browser consumer.
The historical files are read-only, hash-checked providers. The new files are
`tools/quake2-native-launch-client.py`, `quake2-native-driver-composition.cjs`,
`quake2-native-transport.cjs` and `quake2-native-input.cjs`.
Evidence: `scratch/runs/20261109-quake2-prompt-launch-crouch-repair-0158/`.

The launch client reuses the reviewed Q3 owned transport. Its only shared
changes are a configurable launch label and checking already-recorded stream
EOF at admission. A single session owns launch and requests. Actual launch
exit (including zero), signal or either stream EOF becomes sticky before the
next request/review publication. Pending local request children are cancelled
and actually waited; stdout EOF and stderr EOF are separate receipts. Already
dispatched remote effects and remote custody stay UNKNOWN. Local termination
cannot prove remote cancellation. EOF on the session's stdin requests local
cleanup, not successful remote shutdown. Separate control.py invocations do
not acquire these guarantees.

Quit now nests browser close inside the remaining 20-second command-work cap,
leaving 100 ms for completion bookkeeping; its numbered ACK window is 22
seconds even when the old caller asks for a 50-second minimum. The last two
close phases retain up to five seconds each. Independent cleanup retains its
original 20+5+5 = 30-second cap. Neither close ACK nor exit zero after TERM/KILL
is normal success. Missing EOF at the cap remains UNKNOWN, with no quit ACK or
profile-retirement success. The consumer validates the exact issued command
work budget and preserves its first failure. Terminal browser/protocol events
cancel pending protocol promises and passive waits and reject later input.

The new explicit native combo is exactly `['ArrowUp','Control']`, 50–2000 ms,
using the existing Ctrl crouch binding. Existing forward/steering choices
remain. Reordered keys, other combinations, a third key and unbounded holds
are refused. A current personally reviewed capture and the existing owning
admission chain are still required. The release timer is independent of a slow
passive sample; every attempted DOWN gets an UP attempt, including failed DOWN
delivery, sampling failure and partial input. Failed UP is reported UNKNOWN;
the other key's release is still attempted. Failed hold receipts are retained.
There is no automatic tunnel route, replay, binding change or guest write.

Use the launch client with `--task fresh/control.py --task-sha256 SHA
--evidence fresh/client` and feed command/review JSON lines. The caller's
remote parent selects the production preload and the retained launch.py
custodian using its existing `--consumer-control` entry. Fresh staged run
inputs supply lifecycle.json and runtime-pins.json; all 19 composition
providers must be included by exact path/hash/size before browser creation.
The old 0105 manifest alone is intentionally insufficient. Original allocation
and runtime admission remain a separate authorization and staging operation.

Validation includes twelve actual retained-caller/real Node sender launch
failure cases (SIGPIPE, SIGTERM, 143, zero, stdout EOF, stderr EOF; pending and
before-next), a successful real numbered ACK, an actual failing Node sender,
and the actual retained run-command wrapper waiting a child that exits 143.
Each failure preserves the first UNKNOWN and rejects later requests before
reading another review. Shared Q3 caller regressions also pass, including
held-pipe EOF remaining false at its cleanup cap.

Eleven actual composed driver cases cover normal quit, reviewed crouch-forward,
partial DOWN with both physical releases, missing review with zero DOWN,
TERM exit zero, KILL, close ACK without exit, leader exit before pipe EOF,
pending capture, pending passive wait and independent 30-second close.
Node-only protocol/process fixtures replace browser creation and game startup;
the real execute/capture/close/transport/input functions run. Additional input
controls cover failed UP, slow sample, late DOWN and allowlist negatives.
Budget controls reject an enlarged command cap before execution. Focused
tests and `flock /tmp/wine-build.lock bash tools/build.sh` pass.

The strict DLL-loader gate, both pre-start observation flags and native CPU
observation semantics are unchanged. CPU SHA-256 remains
`a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`.
Lifetime REVOKED, rejected continuity and all-writers/edict ABA UNKNOWN remain
unchanged. No historical missing wait or EOF is repaired retroactively.

Scope error: an existing startup regression was mistakenly invoked before
checking that it launches local Chromium. It ran a local startup test, with no
box or game original. Its launcher also started its automatic timezone probe.
The test completed normal cleanup before an identity-checked stop attempt
could deliver a signal. The retained report records browser exit zero, no
remaining targets, browser/profile absence, watchdog exit zero and server
closure; `offline-scope-incident.json` records this violation. Do not describe
this task as entirely browser-free. No further browser tests were run. The
new repair's caller and composition tests use local subprocess fixtures.

No box was created: ID/state/expiry/stop receipt are not applicable. No agents,
workers, public deployment, renderer/SuperTux edits or retained evidence edits.
Recovery uses Git SHA and small owned patches, not a source archive. This task
ends after commit and authenticated publication; any original needs separate
authorization and a fresh manifest including these production helpers.
