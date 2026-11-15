# StarCraft rebel-base combat follow-through (2026-11-15)

**Partial mission result: personally commanded Attack and its separate enemy
target were consumed; enemy damage and rebel-base progress were not proven.
Native Exit Program and guest/process exit 0 were proven. Two launching outer
wait/EOF receipts are missing.** This follows the existing registered mission,
not a new title. The original is closed and was not replayed.

Evidence: `scratch/runs/20261115-starcraft-rebel-base-combat/result.json`.
The route was published on main as
`826547148f8f2980e468ec83408fe4f85e0cc08a` before the original.

## Actual mission and personally commanded combat

The current native briefing showed Chau Sara and **Destroy the rebel base**.
Magistrate Collins identified the Sons of Korhal and assigned Alpha Squadron.
The unchanged registered `starcraft_shareware` entry and its existing
`ophelia terran1` arguments selected STRONGARM. Initial native mission HUD:
250 minerals, 200 gas, supply 12/42. No worker production, gathering or
construction command was issued in this attempt.

After separate mission admission and selected-unit reviews, ordinary Move
commands scouted the eastern platform and road. The first forward Marine was
selected at 40/40, Kills 0. It took damage and disappeared before an Attack
order; this is a friendly loss, with no enemy credit.

A second platform Marine was separately selected at **40/40, Kills 0**. After
moving to the road, a current portrait navigation exposed a red enemy Marine
on the dirt to the east. A separately reviewed native Attack command was
consumed. A new complete scene showed **Select Target**, Cancel-only command
card, the selected Marine still at 40/40/Kills 0, and the red enemy. One
personally chosen click on that enemy was consumed as `attack-enemy-two`.
The earlier expired target preparation sent nothing; it was replaced by a
new current scene and new intent.

The following complete observation showed red remains at two locations, an
empty friendly selection, supply 10/42, and a surviving red enemy Marine.
No selected kill-counter increase or enemy HP comparison was captured.
Consequently neither the remains nor the consumed target establish enemy
harm attributable to this command. The attacking friendly was lost.

A third Marine selected in the base already had **24/40, Kills 1** before any
order to it. That ambient kill receives no commanded credit. Its subsequent
Move approach also ended in a friendly loss while a red enemy remained visible.
Final supply was 7/42; two other supply losses were unassigned. Later complete
scenes showed empty selection and the fogged battlefield. The separately
attested after/persistent result is `unproven`, with objective-progress and
mission-completion claims false. No native victory or objective-change screen
was observed; the rebel-base objective remains incomplete.

## Route and validation

The finite controller already supported manual selection, minimap/portrait
navigation, Move, Attack and native Quit. This change adds a distinct
`enemy-consequence` result: the consumed Attack target's before scene, freshly
attested after scene, and separate fresh persistent scene must describe the
same visible damage/destruction. Native counter/HP evidence, selected-unit
identity and other-shooter review are required. Enemy consequence stays
separate from objective progress and native mission completion. The actual
original did not qualify for a positive consequence record.

Before publication/original: **48 policy, 16 actual HTTP and 10 actual CLI
controls**, plus `flock /tmp/wine-build.lock bash tools/build.sh`, passed.
Actual controls exercised separate Attack/target and Move/target clicks,
consumer dequeue, permanent identity, late/dropped/foreign ACK, sticky UNKNOWN,
independent release, actual parent-death subreaper wait/EOF and real-tick
progress. Synthetic assertions and fault injection remained in isolated
fixtures, never the original. Initial synthetic result-fixture errors were
corrected and retained with the passing reruns.

The original contained **29 consumed finite left clicks**, each 400 ms, with
unique nonces and an independently prearmed 1750 ms UP fallback. All original
physical releases were acknowledged. No captures or thinking occurred while
held. The route retains 80–1499 ms; inherited 1500 ms midpress capture remains
refused. Gameplay scenes expire after five seconds, menus after thirty.
Expired preparations sent no input and were replaced by fresh reviews/new
intents. No original input UNKNOWN, replay or rebind occurred. Native pause
was never observed or asserted; real ticks/default 1000/cooperative execution
remained unchanged. No tracking, OCR, solver, strategy script, action queue,
private game-state read, frozen runner, configuration/AI/seed/clock write,
cheat or console input was used.

## Native Quit and incomplete outer proof

Quit began irreversibly before the 1020-second gameplay cutoff. Separate native
reviews followed **MENU → End Mission → Exit Program → “Are you sure you want
to exit Starcraft?” → Exit Program**. Restart Mission and Quit Mission were
not selected. Final physical UP was acknowledged. Guest `[Exit] code=0` and
actual native process wait 0 occurred after **935.088 seconds**. The independent
1220-second watchdog exited unfired; the native limit was 1200 seconds. There
was no original cancellation request or host Quit.

Native, watchdog and supervisor-child waits each returned 0 with both EOFs;
the supervisor explicitly released the heavy lock. The evidence audit found
**326 available actual waits with both EOFs and 328 recorded PIDs absent**.
The board tail separately records its regular stdout file closed and stderr
EOF, rather than inventing a stdout pipe EOF.

The long original launching tool session returned **143** before its launcher
wrote `actual-outer-wait.json`. The detached outer process did write its actual
successful supervisor-child wait, but its own wait and EOF receipt cannot be
recovered from absence. The ancillary board-watch launching session likewise
returned tool status 143 without collecting its detached outer wait. Its
native watcher, tail, watchdog and supervisor-child did shut down with their
own actual records. Both gaps are explicitly retained in
`original-launch-wrapper-missing-proof.json` and
`board-wrapper-missing-proof.json`. `runtime-release.json` sets
`allRuntimeWaitsComplete: false` and `bothEOF: false`, while distinguishing the
available positive records. Tool status 143 is not asserted as either outer
process's exit code. No retry or complete outer-closure claim was made.

Native shutdown logs retain **37 parked Enter(s) ABANDONED** and final T2 active
at EIP 0x7ab2d1; T1/T3 are exited at EIP 0. Historical Storm EIP0/26 abandoned
Enter diagnostics remain unresolved. No application-specific suppression,
engine shutdown repair or all-threads-clean claim was introduced.

## Exact closure and selected evidence

Sims USER281 released source/build/runtime at 04:17:39Z and Q3 visibility at
04:29:24Z. Their 29 and 34 actual wait records, both EOFs, and respectively
87 and 50 absent PIDs were personally verified before heavy qualification.

The actual shared WASM was **2,203,481 bytes**, SHA-256
`eb1669a7d065664f8c3f0b3ae5649d9d222721b6c9903c125ef22aa5c21160ea`.
No old 6872 module was substituted. Preflight checked **8,237 pins**, including
then-current source/WASM, unchanged registered EXE/MPQ/DLL/import graph,
TLB/fonts, resolved PATH Node/Python and mapped native host/controller closure.
The existing missing shell32 builtin fallback remained unchanged. Postflight
found only three foreign light changes: the Q3 visibility controller/test and
the Sims thunk test. Their binary/new-file patches are retained separately;
runtime source, WASM, registered media and native dependencies were unchanged.
Foreign WIP was recorded, not adopted as this worker's fix.

Git SHA plus `uncommitted-before.patch`, owned route/report patches and
`postflight-foreign.patch` provide source recovery. No source tree, media,
module or frame bundle was archived. All 103 original/copy PNGs passed
CRC/inflate/800×600 validation before pruning. Twelve selected result-named
images remain; `selected-copy-map.json` records byte-identical origins and
hashes for renamed selections. They show the current briefing, mission,
selected attacker, separate Attack/target, enemy survival/friendly loss,
uncredited ambient-kill baseline, final loss, after/persistent observations,
and native exit confirmation. No screenshot was sent through Telegram in this
task. Available waits, missing proofs and visual conclusions remain distinct.

No box or worker was created. Final box state **NOT_CREATED**, ID/expiry/stop
receipt null. No deployment occurred; /home remained above 1.5 GB without a
RAM gate. Runtime/source/build release was explicitly posted, with the outer
proof gaps disclosed. The bounded task stops after this report's publication;
no further original is authorized by this result.
