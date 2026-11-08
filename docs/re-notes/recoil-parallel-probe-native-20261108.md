# Recoil parallel-probe native preparation, 2026-11-08

Run: `scratch/runs/20261108-recoil-parallel-probe-native/`.

**First new generic integration defect reproduced and repaired before allocation:**
the retained remote lock wrapper could report all descendants drained while a
double-forked, session-detached grandchild was still alive. The wrapper reaped
exited direct children but had never enabled Linux child subreaper adoption.
After the intermediate parent exited, a subsequent parent-tree census could not
recover the orphan. This is distinct from the previously repaired direct-child
zombie and mutable artifact alias defects.

The repaired owned `locked-launch-fixed.py` enables and verifies orphan adoption
before executing the launch entry. It retains exact PID/start identities before
calling the accepted WNOHANG reaper, and preserves still-live known identities as
census roots. Adopted descendants remain in the census even after their original
parent exits or they start another session. They must exit and be reaped before
the wrapper reports drained and releases its remote runtime lock. The owned
`launch-original.py` explicitly uploads and invokes this tested wrapper together
with `owned-custody.py` and the unchanged accepted `reap-owned.py`.

No fresh native original or box was allocated. Ordinary M, its visible
consequence, and reviewed movement toward the power-control objective remain
unobserved. This task finishes through the requested tested first-new-integration
repair condition. It does not assert gameplay progress or prove that the
original's unchanged admission gate will pass.

## Focused evidence

`test-orphan-custody.py` runs the actual baseline and repaired wrappers around a
real subprocess which launches a grandchild and exits. The grandchild calls
`setsid()` and waits for an explicit release marker. An outer fixture subreaper
contains the baseline's escaped child so the reproduction itself leaves no
orphan behind.

- Baseline: wrapper exits successfully and writes `custody-drained.json` while
  the detached grandchild is still alive, adopted by the outer fixture.
- Repair: grandchild is adopted by the runtime wrapper; its exact start identity
  is recorded; a competing nonblocking flock fails while the child is alive;
  no drained receipt appears early. After explicit fixture release, the wrapper
  reaps the child, reports drained, exits, and the lock is independently acquired.
- `test-custody-failclosed.py`: unavailable orphan adoption refuses launch before
  the launch entry executes, emits no false drained receipt, and the OS releases
  its lock. The future entry is checked to invoke the tested wrapper and upload
  its dependencies. Identity recording precedes reaping.

The final fixed proof retains the actual census, adoption receipt and waitpid
results. `fixture-drained-independent.json` independently checks recorded fixture
PID/start identities after completion. There is no guest/browser/Chrome fixture,
no local heavy runtime and no `/tmp/wine-runtime.lock` acquisition. The initial
fixture used inherited stdout pipes, so `communicate()` waited for a pipe held
by the escaped child even after wrapper exit. That test-harness failure is
retained in `initial-fixture-failure.json`; the corrected test uses file output
and observes wrapper exit independently. All fixture children are released/reaped.

## Cheap closure and retained admission

Before this new defect was found, `prepare.py` verified all **822 inherited
providers**, composed **838 explicit pins**, and loaded the actual hermetic
preloader, parallel `bound-input.cjs`, compound HUD decoder, visible-pointer
validator and accepted 500 ms Escape helper. The intentionally incorrect ambient
`PIN_FILE` is overridden by the selected composed manifest. The existing 295
remote artifact references and 25 retained control/recovery/result records are
hash-checked. Accepted controls and the seven parallel-probe negatives are reused
by exact hash; there are no standalone control or native fixture reruns.

The parallel repair is preserved unchanged: each HUD probe still retrieves four
complete uncached module responses, two from the actual guest and two from its
owning renderer, with both independent lanes drained by `Promise.allSettled` on
failure. Exact instances/epochs, final co-located owner/pixels, 250 ms freshness,
temporal pair, **gate4500/M500**, late-probe retention and sticky UNKNOWN/no replay
remain in the retained helpers. The earlier actual-CDP fixture timing reduction
364.87 → 271.56 ms is not an original-game gate result. The previous reviewed
459,249 cursor witness is not authority for a future click. A future original
still requires personally reviewing its current exact PNG hash, CRC, dimensions
and guest hotspot inside Resume 380,247–504,279 before clicking.

## Recovery and lifecycle

`source-head.txt` records the checkout Git SHA. `recovery.json` identifies the
selected original source Git `49874a81c5ae180c20a15c6bb169d9041f028cae` and the prior
relevant binary diff, small untracked source patch and existing media path/hash
recovery recipe through the timing handoff. `orphan-custody-repair.patch` isolates
the new wrapper change; `owned-inputs.patch` retains the small new custody,
launcher and focused-test inputs. No source archive, repeated media or peer WIP
is included. Evidence objects are retained through the accepted immutable
collector and independently reread. No production source changed; no full-build
claim is made.

**New box ID/state/expiry/stop receipt: none; no allocation or remote runtime.**
The historical box is only referenced through accepted records: `bx_afvq3a5t`,
archived, expiry null, stop `stop_e067c3dd2575e338` completed 11:07:14.264Z,
forced false, error null. No old box was resumed/deleted. No deployment,
subworker, or worker launch occurred. Free disk exceeded 5 GB at preflight.

Next: use the tested custodian for a separately authorized sole fresh original,
identify its UUID-idempotent allocation and prearm the observable independent
25-minute watchdog, then native Software/user Medium, accepted 500 ms Escape,
current personally reviewed Resume, unchanged qualified ordinary M and observed
visible consequence before reviewed ramp/control movement. Keep loading, MENU
and active intervals separate; attack requires a reviewed living target.
Full27, parity, audio and FPS remain open.
