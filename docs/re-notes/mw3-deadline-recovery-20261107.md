# MW3 capture deadline recovery — 2026-11-07

The capture repair is published on main as `53e1139dd`; encounter followthrough
reached named enemy selection but stopped at a partial native aiming sweep.
No firing, visible world enemy, hit, damage or mission completion was confirmed.
No second original is authorized by this task.

The interrupted worker's repair is recovered in `tools/mw3-run-transport.cjs`.
A passive capture now reserves its requested wait, 20 seconds of bounded work,
2 seconds for ACK delivery and 30 seconds for cleanup inside the existing
browser deadline. A 30-second passive wait therefore has a 52-second ACK budget.
Commands that cannot fit are rejected before publication. Run deadlines are
never extended. First UNKNOWN remains sticky after late ACK; IDs cannot replay.
The consumer checks the exact run deadline and bounds work before dispatch.
Independent release remains scheduled before DOWN and survives a missing ACK.

Evidence is retained in `scratch/runs/20261107-mw3-deadline-recovery/`, with
SHA/patch references to the untouched unique predecessor evidence in
`scratch/runs/20261107-mw3-capture-deadline/`. No source archive or media bundle
was made. The predecessor's generated production Worker composition completed
its 30-second capture in 31,110 ms, delivered the correct ACK, acknowledged quit,
and exited Chromium with code 0 / no signal. Its build log reached both module
outputs and the data-overlap check. These surviving outcomes were verified,
rather than inferred from the last streamed event.

Worker 2152 never allocated or booted an original: its complete retained event
stream contains no allocation invocation, its run has no create UUID/attempt,
allocation, lifecycle-arm or boot records, and the authoritative box listing
has no allocation from its lifetime. Its launcher, generated supervisor and
Chromium PIDs are absent; both recorded ports are closed. Recovery removed the
remaining generated Chrome profile and terminated only its exactly identified
orphaned board watcher. SIGTERM/143 is reported by the coordinator; no surviving
record identifies the sender or cause. No UNKNOWN command was replayed.

Eight focused regressions cover the actual numbered ACK path, timing, bounded
work, late ACK/no resend, zero-effect stale-scene refusal, ACK identity, changed
immutable deadline and expired dispatch. The retained independent-UP regression
also passes. A fresh locked build initially stopped at the concurrent AVP2
worker's renderer-input ownership seal; its owner refreshed that seal. The
fresh mandatory locked build then passed, and repair publication completed
before allocation. Its resulting module remains 2,182,500 bytes, SHA-256
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.

The documented demo controls are E (next enemy), 1 (zero throttle), Enter (cycle
weapons), Space (fire), numeric throttle and arrows. Retained readme path and
SHA-256 are recorded in `documented-controls.json`. Heat and ACK are not hit
evidence.

## Single original and encounter blocker

Exactly one UUID-idempotent box, **bx_pv7xay46**, was allocated at approximately
**22:02:52Z**, after the predecessor audit, successful tests/build and immediate
pull/push. All **315/315** submitted uploads drained successfully and all remote
sizes/hashes passed before boot. The executable Node closure is **67 files /
313 pins**. The concurrent AVP2 physical GetAsyncKeyState repair in
`lib/renderer-input.js` is explicitly hash-pinned and retained as a relevant
uncommitted patch; this run does not claim byte-identical renderer input to the
older composition. The actual executing module matches the hash above.

Reviewed images show the main menu, pilot `a`, unchanged default Bushwacker /
Operation 1A / Battle Progression / Wave 1, and operation map. The first launch
click left the map visible; its icon was dim in the preceding capture and bright
later. One **30,000 ms passive capture** then succeeded through the repaired
transport on the original, without timeout or replay. A fresh click on the
reviewed bright launch icon reached the cockpit. No assertion is made about
why the earlier click did not transition.

Ordinary E selected **Gunner Kappa / Firefly primary**, with an enemy status
panel and displayed range **882 m**. Numeric 5, right arrow and another E were
used. Terrain/heading changed and the OP Able distance decreased
**449 → 442 → 430 → 408 → 379 m**. Firefly range increased through
**883 / 889 / 943 m**, so a successful approach to that enemy is not claimed.
The later capture shows **Gunner Delta / Owens alternate_c, 886 m**. Numeric 1
was sent, but the capture did not establish that motion had stopped. Enemy
status-panel models are not evidence of an enemy silhouette in the world.

At **22:10:05.276Z**, command 18, `aim-left-one`, failed the existing native
motion helper's **five-second immutable motion deadline**, after **11 of 32**
requested trusted mouse moves had acknowledged. Per-step identity/geometry
reads under cockpit rendering consumed the bounded sweep budget. The command
had partial effects and no successful ACK; first UNKNOWN permanently closed
admission. It was not replayed, no later input or protocol command was sent,
and no further original was allocated. This is a concrete driver boundary,
not evidence of a guest crash or of a capture-budget regression. The enclosing
capture command's work/ACK budget had not expired. Enter and Space were never
sent on this original; weapon impact remains unverified.

There are **18 successful ACKs**, **13 balanced input pulses**, independently
armed UP before each DOWN, and **78 native events**, none after the first fault.
No observer was armed. No guest setting, binding, clock or private-handler
change was made. Two historical command review strings are corrected in
`review-corrections.json`: the listed-pilot image shows kill/wave statistics,
and the first E image already shows the Firefly target label. The image review
above is authoritative; the incorrect strings are preserved.

## Custody and delegated shutdown

The detached supervisor, independent watchdog and separate normal-stop delegate
were armed and checked alive before allocation. The immutable watchdog cap was
**22:27:52.699Z**, with a 25-minute cloud TTL as an additional limit. More than
5 GB was free before launch. Heartbeats and supervised child exit records are
retained, using the previously demonstrated detached lifecycle helper unchanged.

Chromium closed automatically after the first fault at **22:10:05.838Z**, code 0,
signal null. Both recorded PIDs (6301/6308) are absent; ports **37369/35769** are
closed; profile, writer lock and held inputs are absent. All **313 pins** remain
unchanged. **249 remote references / 228 unique artifacts / 10,551,284 unique
bytes** were recovered and SHA-256/size verified before normal box stop.
Repeated content is hash-deduplicated within recovery. Unique logs, receipts,
native input and the actual module are retained; existing media is path/hash
referenced rather than bundled.

Delegated normal stop **stop_157ead5ceefd50df** completed **22:11:26.679Z**,
`forced:false`. Final box state is **archived**, `archiveAfter:null`; initial
expiry was **22:27:52.537Z**, retained-data expiry unknown. Both lifecycle
delegates exited code 0 and the supervisor recorded no remaining children.
Local owned watchers are closed. Box custody returns to the coordinator.

Git SHA, relevant tracked/new/helper/document patches and module/media hashes
provide recovery without archives. No public deployment was made. Future
encounter work needs separately authorized original execution and a locally
tested shorter native aiming composition that fits the existing motion deadline;
it must not resume or replay this partial command. This bounded task is stopped.
