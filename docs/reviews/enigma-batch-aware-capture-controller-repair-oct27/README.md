# Enigma frozen controller: checkpoints before admitted ceilings

The retained production invocation initialized successfully, then the old controller
requested 256 batches at batch 19,969 with only 31 of its admitted 20,000 left.
Its first capture was scheduled at 35 wall seconds; production ended after
4.525983 seconds. This is a controller scheduling failure, not evidence of a game
fault. Preserve the original run, its 79 raw ACK/following frozen-zero pairs and
all passed DLL initializer/main-entry evidence. Do not replay its uncertain request.

The new `tools/enigma-frozen-gameplay-controller.py` attaches to an **already
supervised** frozen production runner. It does not launch a guest, build anything,
change runner semantics or replace resource supervision. Both CLI and imported
use call the same `Controller.drive()` scheduling path. Input is disabled by
default: absent a matching reviewed-frame decision, it captures and requests
ordinary control-channel quit without sending a click/key.

## Contract and reserves

Supply a JSON config using the names in `test/fixtures/enigma-controller/test_controller.py`
(`FakeProduction.config` is the complete schema/example). Production values must
come from the actual admitted command and supervisor receipt, never fresh
allowances calculated when this client starts:

- `url`, `evidence_dir`, `terminal_path`, `pid`, `process_start_ticks` identify the
  local frozen runner and one exclusive invocation. Obtain the Linux start ticks
  with `process_identity(pid)`. The evidence directory must not already exist.
- `started_at` and `deadline_at` are the original aggregate Unix timestamps,
  including startup. No controller operation resets them. The interval cannot
  exceed the retained 110-second guest allowance. `max_batches` is the runner's
  absolute admitted batch ceiling (20,000 in the incident), not a fresh allowance
  beyond the first snapshot's batch.
- `checkpoint_batches` bounds progress from the completed initialization step;
  `checkpoint_seconds` is measured from the original aggregate start. Capture
  follows whichever checkpoint is reached first, at a completed frozen step.
  A request already in progress can take up to its supplied timeout before that
  checkpoint can be observed. No concurrent step or cancellation/replay is used.
- `after_action_batches`, `after_action_seconds`, `cleanup_batches` and
  `cleanup_seconds` reserve the remaining action/evidence/cleanup work. Every
  issued step is clipped to the batch checkpoint and available batch credits.
  The runner stays strictly below its terminal batch ceiling, even before
  cleanup. If reserves cannot fit, the outcome says `exhausted-budget`.
- `request_timeout` is positive and at most the original 3 seconds. Before a
  step, reserve two socket budgets for ACK and matching snapshot, plus the
  remaining phase. Before capture/action, reserve their socket budgets and
  after-action evidence/cleanup. An unexpectedly slow/broken transport can still
  make evidence unavailable; the controller then stops with uncertainty and
  relies on the unchanged outer supervisor. Socket timeouts are per network
  operation; the outer aggregate wall limit remains authoritative.
- `max_captures` is 2..8; `capture_bytes` is at most 2 MiB per image. `width` and
  `height` pin expected dimensions (640x480 for this production invocation).
  Initial capture reserves a second capture even when no input is yet authorized.
- `supervisor_limits` describes the **existing enforced** CPU/wall/physical/file/
  output limits. These declarations are validated ceilings, not enforcement by
  this client. Keep the admitted supervisor running throughout: tree CPU90s,
  wall120s (guest deadline110s), original physical ceiling, file24MiB and
  output2MiB. Its terminal receipt must be published at `terminal_path`. Keep
  captures and controller evidence in its admitted output/storage accounting.

Each request persists intent before HTTP and retains the raw response. Steps
require exact `ran`, `steps`, `batch`, `frozen:true` and then a distinct matching
snapshot with `credits:0`, `recording:false`, no guest quit. Terminal receipt or
PID/start mismatch refuses before sending. Transport uncertainty, bad completion
or evidence rejection latches failure; no cleanup/input/retry follows it. The
exclusive directory also refuses CLI restart, including after a crash. Do not
delete/rename the latch or supply a new directory to retry the same guest.

Optional `decision_path`/`review_seconds` permits bounded human review within the
original deadline. A decision must contain `safeStartGame:true`, `reviewed:true`,
the captured `frameSHA256`, exact `batch`, and in-frame integer `x`,`y`. A stale
or incomplete decision refuses. The controller refreshes frozen-zero immediately
before the one click, checks the queued ACK, completes at least one serial step,
captures after-action evidence and requests quit. Queued ACK is not proof of
visible guest gameplay. There is no automatic click, Escape, decision generation,
or replay after uncertain action.

## Offline acceptance and recovery

Run the affected suite using the repository's admitted light-execution-pool and
existing supervisor (one slot, physical128MiB, CPU90/wall120/file24MiB/output2MiB,
excerpt8192). The inner test command is:

```sh
python3 test/fixtures/enigma-controller/test_controller.py
```

The original source fixture is byte-for-byte SHA256
`61c62560161fbe7f5ed4850eb9f66cf84b74e76b6e0ded27495c533ae3cb8f58`.
The deliberately failing unchanged regression can be selected with
`test_controller.py BeforeRegression`; it must fail with 79 completions at
19,969, next request256, zero captures. Its functions and 35-second loop execute
directly from the unchanged AST, with only the clock/process/evidence environment
and HTTP destination injected. No top-level guest launch code executes.

The first acceptance boundary rehashed the pinned controller and exact production
`test/run.js` SHA256
`55be42cbcaedee9d7f56f578cd7d36841bba86861b38bf5d61a7a0415a880c2e`,
and reread every original raw ACK/frozen-zero pair. The unchanged original fails;
the repaired actual HTTP driver captures at batch4,097 against a simulated
5,000 batches/second runner (20,000 fit4s). Last31 credits with a two-batch
action reserve capture at19,996; reviewed action captures again at19,998,
strictly below20,000 with cleanup reserved. The actual CLI captures at512 for
a configured511-batch progress checkpoint. Synthetic black PNGs are test data.

Fifteen test groups cover fast and genuinely delayed HTTP, progress/time
checkpoints, original aggregate age, last31/zero/one credits, action/capture/time
reserves, mismatched ACK/snapshot/frozen state, terminal refusal, stale review,
uncertain step and click without replay, dimensions, and default safe CLI use.
Six omission controls reject missing checkpoint, batch reserve, exact ACK,
frozen-zero, matching snapshot and reviewed-frame hash checks. Retained HTTP
traces cover default fast driver, reviewed near-ceiling action and actual CLI.
See `manifest.json`, `final-tests.json`, `final-tests.log`, `mutations.json` and
`http-evidence/`. The final source/test hashes are in `final-tests.json`.

Durable external recovery checkpoint:
`/tmp/enigma-batch-aware-capture-controller-repair-oct27/ops/checkpoint.json`.
Retain the task repo and external ops; reuse passing receipts only while their
source/test/tool pins match. Git uses two execution permits, then the production
Git lock, trusted pinned SSH, child-only DATA512MiB/physical256MiB, no force push.
The donor base is evidence commit `bea289a957c91a9e4eada72d1c253815893e14b4`;
only the new controller, focused fixtures and this review directory are owned.
Unrelated donor tree entries remain unchanged. No main integration is authorized.

The original run remains at
`scratch/runs/enigma-exact-production-initialization-gameplay-oct27/` and its
read-only donor `/tmp/enigma-exact-production-initialization-gameplay-oct27`.
The original failing initialization/controller evidence is not rewritten.
An independent source acceptance/integration gate remains, followed by a separately
admitted exact-production initializer/ACK/frozen-zero/menu/reviewed-action runtime
test using this controller. Gameplay, returned MSG behavior, native/browser/worker/
WebGL acceptance and normal guest quit remain unqualified. No emulator invocation,
native corpus replay, rebuild, public deploy or Boat operation occurred here.
`bx_c7m7bu48` is coordinator-owned, reported snapshot-stopped00:50:47Z; its retained
former expiry is01:22:31.959Z. This worker does not resume/query/stop it.
