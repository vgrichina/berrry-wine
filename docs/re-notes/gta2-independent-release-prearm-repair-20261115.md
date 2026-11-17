# Independent release prearm investigation — 2026-11-15

The retained 500 ms release-child readiness failure has not reproduced on the
unchanged current native path. Fresh untraced, syscall-traced and import-profiled
two-MessageBox runs pass their semantic transition and focus-refusal tests.
Explicit late-start, startup-failure and late-ACK controls correctly close
without qualifying a late arm. These controls establish refusal behavior, not
the cause of the retained timeout. No necessary production repair is proved,
and no original GTA2 or browser renderer arm is authorized or launched.

Evidence: `scratch/runs/20261115-gta2-independent-release-prearm-repair/`.
Both current predecessors released before native execution: ReVolt release
`201be716f7517f5023e07a856d9f6a42927d347e75d146bf6e1eed5663704ac0` and Sims
release `5a8709ed18f64ff565c138e430e95df274b1216a1b64606848878a8bc6dcb132`.
Personal checks verified six top-level hashes each, 131 + 122 sealed actual
waits with both EOFs, 163 + 123 absent recorded PIDs/groups, both free locks,
and more than 1.5 GB free on `/home`. Historical ancillary UNKNOWN stays
explicitly excluded. The preceding light phase changed only these new notes
and the new focused test.

## Retained failure

The predecessor published DirectMusic module registration on main at
`cb30b2c6a0c0bc7bb57e074e0221f0f4ec90d6c2`. Its explicit runtime release hashes
to `67f6e10d396adf4b01343444524d2a3496c56a6622aeb095936ec4226d5ed54f`.
That release does not reopen any failed endpoint.

The generated two-MessageBox x86 fixture reached the first modal scene.
`tools/sims-install-controller.py:306` timed out in the parent's 500 ms
`select` before sending DOWN. There is no `press0-receipt.json`.
The child subsequently printed `armed: true`, and its actual wait records
exit 0 and both EOFs. Its UP receipt explicitly says `reason: parent EOF`.
It is not a consumed pulse and does not qualify the timed-out prearm.

The intent was created at `1794765246.5323713`. The release fired at
`1794765247.3189824`, 786.611 ms later; its UP ACK arrived at
`1794765247.3764133`, 844.042 ms after intent creation. The fallback deadline
was `1794765248.2823713`. These are wall-clock differences, not measured
child-startup time: two durable parent writes precede `Popen`, and the
retained arm line contains no publication timestamp. The retained evidence
alone cannot distinguish scheduling, interpreter/import startup, or readiness
publication delay. In particular, the child's eventual flushed line is not
evidence that the parent saw it within 500 ms.

A newly authored standard-library import control ran during the light phase,
without importing or executing repository helpers. It completed in 99.121 ms,
with its measured import loop taking 63.902 ms (`urllib.request`: 54.468 ms).
Its actual wait has both EOFs. This single control neither reproduces the
native failure nor qualifies prearm; it prevents attributing the retained
timeout to an assumed inherently greater-than-500-ms import cost. Evidence:
`authored-stdlib-startup.json` in this task's run directory. The actual native
baseline and diagnostics below subsequently ran after both lane releases.

Static browser-controller review also found different admission waits:
`tools/gta2-paired-controller.cjs` allows 1000 ms in the original arm and
1500 ms in its blank-page key controls. Neither establishes this assignment's
500 ms prearm bound. They must be brought within the same bound and qualified
before any conditional original. The current browser release configuration
contains the permanent page owner but does not carry the manual gesture nonce
or reviewed scene hash. These are source observations, not executed failures;
they do not establish why the Python/native parent timed out.

The production child imports the whole controller before reading its intent,
then publishes a flushed JSON line before its input/fallback loop. The parent
waits for readability, reads that line, checks target/fallback and liveness,
then dispatches DOWN. This is the actual native path measured below.
Timing must include launch, import completion,
intent acquisition, arm publication and parent acceptance; merely reducing a
synthetic pipe latency would not establish the cause.

## Current actual native measurements

The new focused test generates recipes for the existing authored x86
two-MessageBox fixture and existing native-context suite. It does not copy
original instructions or change production source. The supervisor arms an
observable independent deadline watchdog before each suite. Native, watchdog,
supervisor and release-child waits retain both EOFs.

| Source/path | Result |
| --- | --- |
| Unchanged shared module, untraced | Both modal consumptions and focus-change refusal pass |
| Same path, syscall diagnostic | Both semantic tests pass; actual parent and release-child syscalls retained |
| Same path, import diagnostic | Both semantic tests pass; actual release child's import timings retained |
| Real native late-start intervention | Parent times out before DOWN; eventual child arm/EOF UP remains unqualified |
| Real native startup exit 73 intervention | No DOWN, no UP claim, endpoint permanently closed |
| Real native 500 ms ACK-delay intervention | One real consumed request, late-ACK refusal, independent UP, no completed pulse |
| HEAD plus whole owned files | Both semantic native tests pass after its full locked build |

Each injected-fault test attempts capture, bind and lease after permanent
failure and observes zero additional transport requests. These interventions
are explicitly labelled faults and do not explain the historical failure.
No response is fabricated, no source guard is bypassed, and neither a timeout
nor a late UP becomes success.

The untraced successful holds acknowledge UP 434.515 and 431.949 ms after
consumption. In the syscall diagnostic, child exec-to-arm-write takes
382.148 and 387.144 ms. The parent's original 500 ms `pselect6` returns
readable after 380.432 and 384.541 ms; actual DOWN consumption follows the
arm write in both cases. UP follows consumption by 523.395 and 618.237 ms.
Tracing changes scheduling and costs time; these values are diagnostic,
not an uninstrumented performance comparison. Only the parent and two actual
release-child syscall logs are retained; string buffers were never recorded.
The import-profile run reports 27.549 ms cumulative for `urllib.request` in
the first release child. None of these runs reproduces the old timeout.

I personally inspected the two named full 800×600 untraced screenshots:
`baseline-native/native-context/test_transition/choice0.png` visibly shows
the authored first dialog; `choice1.png` is blank teal. The native metadata
and automated second consumption alone do not prove a visibly reviewable
second dialog. The fixture test uses public USER geometry, explicitly for
authored controls; that is not an authorized original-game input method.
This capture limitation is recorded without attributing it to the prearm
timeout or claiming a renderer repair.

The exact remaining blocker is **NECESSARY_PREARM_REPAIR_UNPROVED**: the
retained failed run has no child-start/arm-publication timestamps, while fresh
unchanged actual-native measurements admit within 500 ms. A guessed import
optimization, a larger timeout, or a successful fresh endpoint would not repair
or qualify the failed endpoint. Production source remains unchanged. The
separate static browser admission/identity gaps above also remain unqualified.
There is no claimed baseline-to-fixed comparison and no current browser Worker
prearm qualification. The next causal step is to retain an actual uninstrumented
failure's launch/import/publication/parent-read scheduling without relaxing
500 ms, 1750 ms or the three-second operation limit.

The full locked shared build, full locked HEAD-plus-whole-owned build, and final
shared restoration build all passed. The tested HEAD was
`c34237add43fd3b3c53e720a318ba033819aace9`; its module SHA-256 was
`ed7abcb17bc968d876e8d5ca598f4cb947c6a020dc9039c99ec31f86277c2bf6`.
The restored shared module SHA-256 is
`878e49103bdeff048d0685ecc47a23d4f769310d66776a7e9fdbb2e884c9d7dc`.
The native-scene unit, Python controller policy, paired-controller protocol,
and aggregate operation-limit controls passed under independent supervisors.
Protocol controls do not establish the stricter browser prearm bound. Only the
two new files are published; all production source and foreign code remain
unchanged. The run's publication and direct-closure records identify the final
commit and personally waited children.

## Qualification requirements

Keep prearm at 500 ms, physical UP at most 1750 ms, manual holds 80–1400 ms,
and each operation at most three seconds. Admission needs a genuine child arm
before DOWN, bound to the current source/helper, endpoint, PID/start token,
owner/epoch, intent nonce and reviewed native scene. A stale binding cannot
be prearmed. Do not fabricate a successful receipt, widen a deadline, or retry
the old failed endpoint.

Exercise the authored actual x86 two-MessageBox fixture through real native
window generations and context, including main/Worker paths where supported.
Check modal transition, changed-focus refusal, startup failure, parent EOF,
cancel, late ACK and permanent UNKNOWN with zero subsequent requests. Seal
all personally created native/watchdog/supervisor/release children with actual
wait and both EOFs, then verify their recorded PIDs/groups absent and locks
free. Historical ancillary UNKNOWN stays unchanged.

Only a tested and published repair plus current native/source/input/capture
qualification can authorize the separately bounded original software attempt.
Walking, vehicle entry, manual driving, visible consequence and native Quit
are all currently unobserved by this task. A software success with direct
closure is required before any separate WebGL attempt. No boxes or workers
have been created.
