# Quake II motion-guided upper route, 0728

The first concrete blocker is offline: the exact frozen caller does not stop
on a held `playerMotion.status === 'UNKNOWN'`. It continues to the command's
automatic capture and returns a successful numbered ACK. No Q2 box, Chrome,
guest, original input or fresh gameplay capture was started. Onward-door/guard
progress and a safe upper route remain unestablished.

Evidence: `scratch/runs/20261109-quake2-motion-guided-upper-route-0728/` (ignored).

## Concrete blocker

The unmodified 17-scenario composed regression passes. Its existing negative
motion cases establish that rejected movement yields UNKNOWN without usable
coordinates, but do not test stopping during a movement command.

A small run-local preload changes only authored fixture data and its test
expectations, without changing any production provider. The fixture starts
with a valid published frame17 and motion SNAPSHOT. Its single authored Space
DOWN publishes an invalid frame0; this is an inert renderer/protocol fixture,
not an original Space attempt or a ladder/consumption claim. The actual
serialized reader then returns top-level attack/binding SNAPSHOT and separate
motion UNKNOWN during the physical hold.

The actual composed driver releases the key with ACK, captures `space-result`,
and returns `{ok:true,id:'space-result'}`. The held sample finished at
**2026-11-09T07:29:43.972Z**; the later capture is timestamped
**07:29:44.020Z**. The fixture bytes labeled PNG are deliberately authored
protocol data, not living game pixels and not route evidence.

`held-unknown-confirmed/moveup/held-unknown-blocker.json` records the successful
reproduction. The first reproduction ended at the old test's expected-four-key
event assertion because the fixture was deliberately restricted to one key.
The corrected run-local expectations explicitly check the UNKNOWN, later
capture, successful ACK and actual waits; that test passes. Both attempts are
offline and retained.

In the frozen production path, `tools/quake2-passive-attack.cjs` carries motion
as data through `createChain().progress`; `tools/quake2-native-input.cjs` accepts
that returned object as a sample; the composed execute path saves the hold,
then unconditionally waits/captures. Existing top-level status cannot replace
checking motion status. Stopping locally after fetching a completed command
would already be too late to prevent this capture. I therefore did not start
the original under the required first-UNKNOWN terminal rule, and did not modify
the pinned caller or peer Q2 providers to bypass the requested frozen closure.

A successor needs an authorized terminal check on held motion UNKNOWN before
any dependent capture, tested against this actual composed path, retaining
independent key release/cleanup and all current limits. That repair and any
new runtime are outside this stopped single task.

## Exact offline preparation and verification

Prepared 722-provider closure: previous 0537/0635 recipe except published reader
`5bc5f86f9cbfdca9e2f57bac44d2d23b80969172`, caller
`1473c5952a52d5d2b4546b93a0d462b64fe5c6cd`, custody
`4341b87723a7d56bc98223215cca4cdc878fcae2`. CPU is 2185596 bytes, SHA-256
`a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`.
Five historical providers are read from Git without changing shared files.
All other previous staged providers match their exact hashes. Compiled driver
preflight passes without Chrome or original execution.

Fresh passive-reader, actual composed-driver (17 scenarios), prepared persistent
PIPE/controller (two lifecycle cases), and held-UNKNOWN confirmation tests pass.
The 19 prior accepted references were SHA/size checked during preparation;
0713's 1262 retained rows and 159 gzip streams were independently verified.
Source-matched prior locked-build/reader/composition/launch-client proofs are
referenced without copying modules, media or archives. No production code
changed; no build against a different shared closure is claimed.

Git commit bases, small binary patches for relevant uncommitted/run-specific
inputs, and existing media/module path plus SHA references provide recovery.
Outer logs use gzip drains from first byte, actual waits and separate stdout/
stderr EOF. Existing fixture-internal formats remain those of the accepted
harness. Free /home remained above 1.5 GB; no RAM gate was applied.

## Gameplay and lifecycle limits

I personally viewed retained 0635 `first-scene.png` and 0537
`frame-right-consequence.png`. No prior route was replayed. Last original remains
0635 HP94 then HP0 LOAD GAME: damage cause UNKNOWN, pane traversal and ladder
unestablished in that run. No blind descent/crate-side turn or assumed move-up
ladder action occurred here. Received-frame origin/velocity/raw flags are
SNAPSHOT observations only; no flag names, contact, consumption or damage cause
are inferred. Native lifetime REVOKED; all-writers and edict ABA UNKNOWN.

Redline `redline-admitted-side-door-0724` was still FIRST and had not posted its
required runtime release when this offline blocker was confirmed. Q2 SECOND
reservation was promptly released as **NOT_CREATED STOP**. No create was
attempted, so box ID/UUID/expiry/stop receipt are all null; state NOT_CREATED.
No watchdog was armed because no create was reached. No archive, physical-drain
or absent-process substitute for missing waits is claimed.

Actual offline caller children have wait and separate EOF receipts. The inert
Node browser child has an actual close with stdout/stderr EOF; its driver was
actually waited status0. The board watcher actually waited its tail child -15
with separate EOF. No runtime profile, ports, guest writers or input lock was
created. No peer runtime was touched, no agents/workers were spawned, and no
public deployment occurred. Single-task STOP.
