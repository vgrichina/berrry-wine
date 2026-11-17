# Authenticated ordinary launcher-to-child observation

Evidence: `scratch/runs/20261117-neverhood-authentic-child-handoff-room/`.

`test/run.js` now supports a one-shot child observation capability through
`lib/cli-child-observation.js`. The controller arms it against a verified full
native review before Play. It binds the actual input owner, epoch, identity,
nonce, parent USER actor, expected installed executable path and SHA-256,
module, runner, bridge and sealed source inventory. Ordinary VFS CreateProcess
records the real OS fork and PID start identity synchronously. Unrelated,
modified, repeated, late or wrong-actor launches fail the observation capability
without replacing the guest's ordinary process behavior.

The child validates its actual parent, loaded executable, module and source
identity. It publishes its own readiness only when its listener is listening.
The controller checks the child PID/start token/boot ID and listener inode
ownership before requesting authenticated child USER readiness. The child's
ordinary actor must pass the existing native readiness and complete capture
predicates. Launcher exit must independently be zero. A parent receipt never
stands in for the child's scene or input owner.

After the armed Play, the controller sends no launcher snapshot. A retired
launcher admits only the already prearmed independent physical release until
its original 1750 ms deadline, then closes its endpoint. This does not execute
more guest code. Child observation and capture must finish within Play's
original 3000 ms deadline. Child input gets a distinct, permanently bound
child controller after a new personal image review. An UNKNOWN latch prevents
all subsequent transport, including cleanup, child adoption and rebinding.

Child native Quit requires the child's own guest exit record after independent
UP, its actual OS wait, and both pipe EOFs. Host cancellation and runner errors
publish a failure marker even if a guest zero-exit record already exists.
Host cleanup therefore cannot qualify as Quit. The existing 500/1750/3000 ms
deadlines and 15/30 second image freshness, focus, modal, generation, actor,
target and nonce predicates remain in force.

The authored fixture uses a real native dialog button, ordinary CreateProcess,
launcher ExitProcess(0), and a surviving child with two native dialogs. Its
controller authenticates the child's own module/source/process/USER identity,
captures the public child scene, consumes child input with independent UP,
and proves native child Quit zero with actual waits and both EOFs. Negative
tests cover foreign/unrelated children, source mismatch, dead/reused PIDs,
wrong actor/owner/nonce, late transitions, parent failure, child cancellation
and permanent UNKNOWN with zero later transport. The new observation path
prevents the former parent-exit/in-flight-snapshot race by never issuing that
snapshot after the prearmed Play.

The preparation continues to select the qualified published module and CLI
components through exact Git plus explicit owned binary patches. Foreign
guest-thread-host, NE bridge, CLI Edit and GL working changes are excluded.
No source archives, media bundles, frame series, boxes, workers or public
deployment are used.

Qualification uses the retained published module and exact sealed component
inventory. The new runner, bridge and controller are exercised by real native
handoff, child input/UP/Quit, parent failure, child cancellation, inherited ISO
and permanent refusal cases. Unchanged historical core libraries are reused
only after byte comparison; the qualification explicitly does not claim a fresh
full historical native-suite pass. Earlier broad fixture failures and a later
three-second deadline refusal remain in the evidence, without pass credit.
Concurrent parent/child failure publication preserves the first terminal record
and removes its temporary file; eight real OS publishers exercise that race.
