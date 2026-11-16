# StarCraft: reviewed mission follow-through (2026-11-15)

One fresh registered original completed production of a new Terran SCV and
ended through native Exit Program. This is an honest partial mission result:
the visible objective, **Destroy the rebel base**, was not completed. No native
victory or objective-change screen was observed. Historical Supply Depot and
enemy-Marine originals remain closed.

Evidence: `scratch/runs/20261115-starcraft-reviewed-mission-objective/result.json`.
Route commit `2e29533606e9d6c4da640f4d7910b447e309c056` was explicitly
published before the original. The run used the unchanged registered
`starcraft_shareware` scenario/arguments: STRONGARM, Confederate Base Camp,
Chau Sara. Its current briefing and complete visible mission controlled the
choices; historical coordinates and private unit state were not authority.

## Visible production and its limits

The selected Command Center initially had no production queue: 250 minerals,
200 gas, supply 12/42. One personally chosen native Build SCV command was
consumed. The actual native card showed Build SCV, cost 50 minerals and one
supply; the Command Center displayed its Building queue. The HUD became
200 minerals, 200 gas, 13/42. That reservation alone was not completion proof.

After the queue cleared, a new worker appeared below-left of the Command
Center where the before scene was empty. The original worker remained near
the minerals. A separate selection identified the new unit as Terran SCV,
60/60, Private, Kills 0; a further current scene showed it persisting.
`original/r-mission-result.json` ties the consumed `train-worker` order
and `train-worker-review` before scene to separately attested `pa` after
and `p2` persistent scenes. This establishes completed production beyond the
earlier construction and incidental-combat evidence.

One separate Gather command and separately reviewed mineral target were sent
to this SCV. It reached the mineral field; a later personally reviewed scene
showed a blue crystal chunk beside the worker near the Command Center.
Subsequent scenes showed an empty return and higher mineral balances. A
single handoff was not isolated, so gathering remains partial: no strict
delivery proof, exact deposit count, or time/score-based attribution is claimed.
No attack command or rebel-base progress was established. By the last whole
mission review the native HUD read 440 minerals, 200 gas, 11/42; the cause of
the supply decrease was not established.

## Finite route and qualification

The new controller extends the released StarCraft transport with manually
chosen ordinary gather, train, build, move and combat orders. It does not
interpret pixels, track units, read private world state, choose strategy, or
queue actions. Selection, active command, target, attributable result and
mission completion require separate current reviews. A complete world and
visible-objective review has a five-second lifetime; menus have thirty seconds.
Expired preparation attempts sent no input and were retained.

The permanent PID/start-token/window binding used the actual bootstrap title.
The eleven actual physical gestures were each one 400 ms left click with
unique nonce and independently prearmed 1750 ms UP fallback. No captures or
thinking occurred while held. The route accepts 80–1499 ms because inherited
1500 ms handling captures while held. UNKNOWN is terminal without replay or
rebind; none occurred in this original. Pause was never observed or asserted,
and real ticks/default batch size 1000 remained unchanged. The final 180-second
Quit reserve is irreversible.

Before publication and the original: 40 policy tests, 15 actual HTTP tests,
10 actual CLI/child controls and the full
`flock /tmp/wine-build.lock bash tools/build.sh` passed. Actual controls
covered consumer dequeue, permanent identity, late/dropped ACK, independent
UP, parent death with actual subreaper wait/EOF, and no-pause real-tick progress.
These isolated fixtures did not load an original. Two initial own HTTP cases
correctly refused a 35-second fixture lacking the mandatory 180-second reserve;
the fixture was corrected to 240 seconds. Fourteen HTTP cases then passed,
followed by the fifteenth actual parent-death/EOF control. Earlier failures
remain in the run. ACKs prove consumption, not game success.

## Native Quit and shutdown diagnostics

Personally reviewed menus followed MENU → End Mission → Exit Program →
“Are you sure you want to exit Starcraft?” → Exit Program. Restart Mission
and Quit Mission were not chosen. The final confirmation PNG is retained.
Guest `[Exit] code=0` and actual native process wait 0 were observed after
712.117 seconds, before the 1020-second gameplay cutoff. The original was
bounded at 1200 seconds with an independent 1220-second watchdog; the watchdog
did not terminate gameplay. This was native Quit, not host close.

The native log still reports **26 parked Enter(s) ABANDONED**. Final T2 remains
active at EIP 0x7ab2d1; T1 and T3 are exited at EIP 0. Historical secondary
Storm-thread EIP=0 diagnostics remain historical unresolved evidence. No
application-specific normal-return suppression or all-threads-clean claim was
introduced.

The evidence audit verified 325 actual waits, both stdout/stderr EOF, and
absence of all 325 recorded native/controller/release/watchdog/outer PIDs.
The board tail used a regular stdout file, separately recorded as closed,
rather than claiming a stdout pipe EOF. Runtime/source/build release was
explicitly posted for the next worker. `runtime-release.json` SHA-256:
`fce3b78468569f4658fc02b61270835af452ef890bde7c5a590903b2a1a62226`.

## Exact inputs and recovery

The current shared WASM was 2,203,094 bytes, SHA-256
`6872c84daf073f76a4c2b7f1a54e2b3f7051129c1bc38d12ed03c145889dcaa4`.
It includes the current Win4 work and preserved foreign WIP. No older module
was substituted. Explicit predecessor source/build/runtime releases were read
and their actual waits, EOFs and absent PIDs personally checked before
qualification: Sims Win4 at 03:37:50Z, then Q3 original at 03:51:02Z.

Preflight verified 8,233 pins: actual registered EXE/MPQ/DLL/import graph,
TLB/fonts, resolved PATH Node/Python, mapped native/controller host closure,
current source and WASM. Existing missing shell32 builtin fallback remained
unchanged. Postflight found only a foreign light edit to
`test/test-win16-system-color-brush.js`; its postflight binary diff is
preserved separately. Runtime source/module and dependency pins were unchanged.

Git SHA plus `uncommitted-before.patch` and the earlier owned-new-file
patches preserve relevant source recovery, including foreign WIP. No source
tree snapshot, media download/copy, game override, frame bundle or WASM bundle
was created. Forty-four transient original PNGs passed signature, CRC,
decompression and 800×600 checks; only nine selected result PNGs remain,
with hashes and pruning metadata. Logs and receipts remain distinct from
visual conclusions. No configuration, seed, AI, trigger, console or clock
write was used. No box or worker was created; box ID, expiry and stop receipt
are not applicable. Free /home disk remained above 1.5 GB without a RAM gate.

The bounded original is closed. Further rebel-base progress would require a
separately authorized fresh attempt; no retry or completion claim is implied.
