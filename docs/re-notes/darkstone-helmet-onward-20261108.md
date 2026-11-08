# Darkstone helmet continuation: startup barrier repair

The helmet-bearing pair passed exact size/SHA-256 verification, but this run
did **not reload or advance the game**. A newly reproduced orchestration race
consumed the launch request before provisioning finished. The parent failed
opening the still-absent `launch-locked.py`; Chrome and the original game never
started. The failed request was retained and never replayed. This task ends on
the permitted first new tested generic integration repair.

Evidence: ignored `scratch/runs/20261108-darkstone-helmet-onward/` (R).
Predecessor: [Level 1 helmet and corridor](darkstone-level-one-20261108.md),
`f40be5335`. No new encounter, loot, potion, counter change, native save or
gameplay consequence is claimed.

## Repair and verification

[`tools/native-startup-barrier.py`](../../tools/native-startup-barrier.py)
verifies every staged provider's bytes and SHA-256 before exclusively publishing
a receipt tied to the exact manifest bytes and resolved runtime root. Requiring
the receipt rechecks the files. Missing, incomplete or stale staging fails before
a launch request is created. The run's corrected `queue-launch.py` checks it
before creating the request; corrected `custody.py` checks again before consuming
it. Corrected `provision.py` publishes only after all transfers finish. Those
run-specific integration patches are in R/final-owned-small-patches.patch; the
generic barrier and tests are tracked source. Future runs must include the
barrier tool among their pinned providers. The repair does not start a guest.

- Eleven focused tests pass, including the observed absent-receipt race, missing
  provider, same-size corruption, removed provider, changed manifest, partial
  receipt, duplicate/escaping provider, exclusive receipt/request creation and
  parent recheck before consumption. Log: R/barrier-tests.log.
- Actual remote execution of the corrected queue prefix refused absent proof
  **before request creation**, preserving the consumed failed request. After all
  transfers, publish and require verified **537 files / 59,636,063 bytes** against
  the exact manifest. No second queue or original launch followed.
  R/remote-barrier-proof.json records the helper SHA and manifest SHA.
- `flock /tmp/wine-build.lock bash tools/build.sh` passed; R/build.log.
  No accepted control fixtures were rerun. Seven controls, native hover,
  startup queue and subreaper helpers were hash-checked for reuse before allocation.

The unguarded queue was issued while provisioning remained active. Its parent
consumed it at approximately **14:44:58 UTC**, then exited on `FileNotFoundError`.
The remote lock consequently released while remaining transfers finished. This
is a retained failure, not a claim that the initial provisioning remained locked
throughout. The repaired pre-queue barrier prevents that ordering. No runtime
began, so there was no minute-ten progress save to recover.

## Unchanged recovery checkpoint

Both original artifacts and new staged input copies were verified before
allocation and again after shutdown:

| Native file | Bytes | SHA-256 |
| --- | ---: | --- |
| `characters.lpl` | 1,342,204 | `70fcfbe302a9ff1f1b7452223e67e800371086812d679ba04c03d4adffca036a` |
| `game641d_6af08808.sav` | 3,204,341 | `a4ecb215f5ffab7524cc0524c419c46498eb7ef14a0e3f404c880f72a769f45d` |

Sources remain the predecessor's `final-recovery/` artifacts selected by its
`new-save-recovery.json`. R/checkpoint-provenance.json maps exact native paths.
The new normal composed manifest was derived from actual `provision.bytes`
**before allocation**: **1,238 bytes**, SHA-256
`a72c42f393a72b51763386db5519de4b90bfb3c1b4325433e92761383aadb903`.
HTTP/loadFiles/VFS/native preview were **not reached** in this run.

The predecessor's final PNG was personally reviewed: closed inventory, helmeted
character in the corridor, timber and second opening. There is no current-run
game PNG. The inherited baseline remains **9+0 victories, LIFE 19/35,
MANA 25/25, Gold 1532, Food 49, AC 12**, red quickslot vial retained; those are
predecessor observations, not new measurements.

## Evidence and shutdown

One UUID-idempotent box **bx_2cdvzqsk** was identified before any launch. The
independent observable 25-minute watchdog and normal-stop supervisor were armed
before allocation. Deadlines stayed immutable. No local heavy runtime or local
wine-runtime.lock acquisition, native input, guest write, private handler,
configuration/clock/seed change, old-box resume, deletion, public deployment,
second original or subworker occurred. Launch disk exceeded 5 GB.

R/startup-failure-inspection.json establishes the exact failing path, absent
launcher/original directory and absent custodian PID/start identity. Seven unique
remote lifecycle/custody artifacts were retrieved and independently reread/hash
verified before normal stop. R/recovered/failed-start-drain.json records the full
process census, registered identity absence, no owned open FDs, no Chrome/Node,
no profiles/writers, empty held inputs, no runtime endpoints/ports and free remote
lock. The current read-only API observer exited zero before stop. The inherited
50 ms census/subreaper is not an exhaustive kernel-task history; here the missing
launcher failed before it could execute or create runtime descendants. Local
supervisor/normal/watchdog PIDs are absent and supervisor children empty; their
initial local start ticks were not recorded. These scope limits are explicit.

Normal stop **stop_0aa64dddaada0969** completed **14:47:47.316 UTC**, forced false,
error null. Final state **archived**, stopped **14:47:47.296**, expiry null;
R/stop-receipt.json. Watchdog and normal exited zero. R/final-audit.json passed;
115 owned evidence references were independently reread/hash verified.

R/source-head.txt records the exact checkout SHA. Runtime providers remain pinned
to `90c1fcfee91c4680877083e80498afcb73c9384d` and ignored module `6cf120d0…` via
R/provider-recovery.json. Relevant binary diff, initial and corrected small helper
patches, and existing media path/hash references are retained. No source archive,
repeated media bundle, ignored-binary Git fallback, provider restoration into the
shared build, or peer-WIP execution occurred. The required build produced its
normal shared build outputs.

Next: a separately assigned run should pin the repaired barrier and integration,
restore this unchanged pair through normal HTTP/loadFiles/VFS/native Load a Game,
settle buttons zero and queue EMPTY, then personally review the current PNG and
walk beyond the second opening. Identify exact native object/hostile hovers before
interaction, identify an ordinary potion in native inventory before use, and save
and independently recover progress before minute ten. Final inventory must be
closed. Full27, parity, audio and FPS remain open. Single-task worker stops after
publication.
