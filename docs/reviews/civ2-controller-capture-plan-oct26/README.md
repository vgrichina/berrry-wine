# CivII serial capture/time reserve repair

This is an offline controller repair, branching from the published evidence-only
predecessor `9c0e73f7e0c79c75e87e610c9f8f91fdd4704373`. No emulator, runner,
module, fixture, save, guest or browser execution was changed or repeated.
Rome founding and movement remain passed historical gates. Production city-screen
inspection and normal guest quit remain **unverified**.

`tools/civ2-serial-controller.js` is the reusable replacement for the actual pinned
predecessor controller (SHA256 `2f0f8784099332d7ba75539f5b484d1b6180a211ed3186c3d51b149df609edea`).
It retains the predecessor's setup choices, batch counts, pixel rectangles and
intro signature. Output/reference paths, serial session namespace and deadlines
are task parameters. The only injected boundaries are clock, transport, capture
reading/decoding and receipt writing for offline tests. Production transport is
the original append-only control stream and exact-ID ACK log, with single-request
ownership, no replay, full step acknowledgments and frozen-zero snapshots.

`tools/civ2-capture-plan.js` is wired into production `start`, every capture,
every input and every control request. `launchController(config, {launch, ...deps})`
admits the plan **before** invoking the caller's guest launcher. The standalone
controller also admits before its first step. A launcher that starts the guest
separately must first run the read-only `--preflight` command or use that API;
starting an older controller does not acquire this protection automatically.

The unchanged route requires this minimum capture plan:

| Phase | Captures | Required evidence |
| --- | ---: | --- |
| Setup | 16 | language through gameplay-before, including intro |
| Acceptance | 5 | Orders, name, founding notice, first-city tutorial, production screen |
| Cleanup | 1 | presented quit-confirmation content before any confirmation input |
| Total minimum | **22** | additional dialogs/actions may require more |

The original twentieth image is the tutorial, despite its `rome-city-screen`
filename. The replacement names tutorial and production separately. Twenty
captures are rejected before launch/input with this exact lower bound and the
reserved stages. This refusal does not complete gameplay. There is no automatic
tutorial dismissal or confirmation coordinate: decisions must match the current
presented pixels. An unknown dialog stops. An extra inspected dialog needs an
explicit route entry and count/byte allocation before launch. A step invalidates
the prior image; geometry, titles, old captures or `stop` never certify acceptance.

The explicit `config` contains:

- `outputDir`, `referenceDir`: absolute task paths; `sessionId`: unique serial ID prefix.
- `plan.allocationId`: future task's authorized allocation identity.
- `plan.totalCaptures`, `perImageBytes`, `totalCaptureBytes`, `retainedBytes`:
  independent lifetime count/bytes and retained-byte ceilings. Preflight requires
  both byte allocations to cover the configured count at the per-image ceiling.
- `plan.width`, `height`: expected dimensions (CivII evidence is 640x480).
- `plan.setupMs`, `acceptanceMs`, `cleanupMs`, `totalMs`: explicit task time budgets.
  These are planning bounds, not a new timing measurement or execution permission.
- `plan.cutoff`: absolute UTC epoch milliseconds; `ackTimeoutMs`: maximum time per
  request, no larger than a phase budget. The effective end is the earlier of
  cutoff and start plus totalMs. Setup and acceptance stop before their successors'
  reserved durations; every request must fit entirely before its phase deadline.
- Optional `plan.route`: known stages in order, with additional explicitly
  allocated acceptance evidence inserted after setup and before quit-confirmation.

For a future authorized task, read-only preflight is
`node --max-old-space-size=64 tools/civ2-serial-controller.js TASK.json --preflight`.
The caller then uses `launchController` and `controller.run()`, or starts the
standalone controller once in the admitted serial-launch recipe. Preflight
does not create a ledger. Live start refuses existing ledgers/control streams,
preventing a process restart from resetting counters or replaying input. A new
session ID alone never grants another task allowance.

Capture attempts are permanently charged before the request. Success records
actual bytes; rejected oversized/malformed output is still accounted. Unknown
retention after a transport failure remains explicit and conservatively charged
at the per-image ceiling. No evidence is deleted to recover count or byte credit.
Failure poisons the serial controller. Its durable receipt records remaining
stages and cumulative attempts, successes, charged/retained bytes and uncertainties.

22 images at the predecessor's 2 MiB ceiling require **44 MiB just for captures**.
This offline task's complete 48 MiB allocation cannot authorize that runtime
footprint plus its session/source/Git/future/reserve costs. A future gameplay
assignment needs a separately admitted allocation and lifecycle, measured timing,
personally inspected production/confirmation references, and a normal-exit gate.
Nothing here raises an enforced count, byte, time or host limit.

## Offline acceptance and recovery

Use the standing Node executable and dependencies in place. In the isolated repo:

```sh
python3 /home/user/wine-assembly/scratch/usage-watch/light-execution-pool-oct26.py --slots 1 -- \
  python3 /tmp/civ2-controller-acceptance-capture-reserve-repair-oct26/ops/run.py test \
  /home/user/.nvm/versions/node/v24.18.1/bin/node --max-old-space-size=64 \
  test/test-civ2-capture-plan.js
```

The exact supervised startup receipt, executable, environment, inherited limits,
physical peaks, outputs and all test groups are in `acceptance.json` and the
atomic per-group checkpoints. `supervise.py` preserves the task's complete
accounting/admission and descendant supervision recipe; restoring it must not
waive fresh admission or substitute paths without review. Installed inputs and
standing read-only evidence are excluded from new task materialization, while
selective Git objects, source, outputs, publication, launcher events, the actual
session, positive WAL growth once, 24 MiB future and 8 MiB reserve are included.
No symlinks or hardlinks hide task bytes. The pool reserves capacity; the Python
supervisor separately enforces actual descendant RSS/CPU/wall/file/output limits.

Tests use small in-memory synthetic image/control fixtures. The unchanged pinned
predecessor is executed in a VM with offline transport: its real main reaches the
twentieth tutorial image and rejects the production capture. The first new test
enters the real production launch/run boundary with the same 20-image allowance
and requires zero launches/requests. `--omit-planning-guard --through=1` removes
that exact production guard in memory and must fail with `Missing expected rejection`.
This negative control does not edit or publish a disabled guard. Remaining groups
cover sufficient configuration, extra/unknown dialogs, failed/uncertain ACKs,
capture failures, deadlines, byte/count saturation, output conservation, pixel
freshness, zero credits, overlap and persistent-ledger reset refusal. The historical
controller fixture is never invoked as a real guest client.

Resource limits: tests 128 MiB physical aggregate including supervisor/descendants;
Node old-space 64 MiB is separate. Git 256 MiB physical aggregate, with 512 MiB
RLIMIT_DATA on Git only. Both use CPU 90s, wall 120s, file 24 MiB, output 2 MiB,
excerpt 8192 bytes. Node DATA/address space remain unlimited, as verified at startup.
Each Git command takes pool slots=2 before `/tmp/wine-ops-production-git.lock`;
each test takes slots=1. Trusted SSH retains the supplied key, known-hosts file,
BatchMode, IdentitiesOnly and strict host checking. No mount is executed by this
offline task; unchanged historical canonical enumeration (338 files including
10 comma-bearing names) is bound in the retained configuration receipt.

Durable task-local operations, root-ref digest reuse, complete pin/configuration
receipt and accounting are under
`/tmp/civ2-controller-acceptance-capture-reserve-repair-oct26/ops/`.
Launcher/session evidence remains at the recorded standing paths. Prior individual
128 MiB client-admission rejections remain historical errors; current admission
uses MemAvailable plus host768/shared execution256/resident future64 MiB per client,
without double-charging actual resident RSS or retaining the ended guest reservation.
Publication is to this task branch only. No main integration, service changes,
worker launches, Boat/SSH runtime, guest replay or lifecycle action was performed.
No box was assigned; coordinator shutdown ownership is unchanged.
