# Supervised frozen gameplay

Existing-guest attachment is retired: `enigma-frozen-gameplay-controller.py
--config …` refuses before reading the file, HTTP, claims or evidence creation.
Start a **new** guest with `python3 tools/enigma-supervised-gameplay.py
--launch-config /absolute/new-launch.json`.

The production launcher refactors the Popen/monitor/cleanup pattern from the
immutable `original-operate.py`; it does not execute that archived recipe or
hardcode its old host, box, deadline or paths. It accepts an absolute executable
and explicit argv/cwd, fixed numeric loopback `/ctl` endpoint, new launch
directory, finite cutoff/duration/readiness, controller schedule and limits.
There are no existing PID, authority-file, UUID or inherited-FD attach options.

Example shape (replace all paths, port, cutoff, command and actual allowance
with the separately admitted new-launch recipe; this is not runtime admission):

```json
{
  "command": ["/absolute/node", "--max-old-space-size=2048", "test/run.js", "...actual production arguments..."],
  "cwd": "/absolute/runner",
  "url": "http://127.0.0.1:18127/ctl",
  "launch_dir": "/absolute/new-evidence/guest",
  "cutoff_at": 0,
  "duration_seconds": 110,
  "ready_seconds": 8,
  "limits": {"cpu": 90, "wall": 120, "physical": 3221225472, "file": 25165824, "output": 2097152},
  "controller": {
    "max_batches": 20000, "checkpoint_batches": 4096,
    "after_action_batches": 256, "cleanup_batches": 1,
    "max_captures": 8, "capture_bytes": 2097152,
    "width": 640, "height": 480,
    "checkpoint_seconds": 35, "after_action_seconds": 8,
    "review_seconds": 20, "request_timeout": 3, "cleanup_seconds": 1,
    "decision_path": "/absolute/new-evidence/review.json"
  }
}
```

The deliberately expired example cutoff must be replaced. The real Node argv
must retain its production freeze/control/guest/batch/mount arguments; this
launcher never substitutes a fixture or changes the JS HTTP protocol. Node
startup preflight uses the same executable, explicit `--flag=value` interpreter
flags, environment and limits, before the script. It records inherited limits
and refuses conflicting DATA/AS limits. No Node startup or guest was executed
in this implementation task; that branch still needs separately admitted
runtime qualification.

One original supervisor process creates at most one runtime. It snapshots the
schedule before launch, holds the Popen handle and original ticks, and consumes
one delegation durably in `authority.jsonl` before constructing the controller.
The private in-process adapter is an implementation detail, not an attachment
API. Terminal/delegation state survives controller exceptions and evidence
failure in that lifetime, and the supervisor cleans up its own child tree.
Neither editing launch JSON nor changing output/URL/PID/timing can renew it.
A later successful launch is a new supervisor and **new child**, never reconnect.

The controller retains serial intent-before-send, all-batch ACK then matching
frozen-zero snapshot, exact reviewed-frame binding, capture/input/batch/time
reserves and normal quit. Supervisor accounting includes its own Python process
and observed child descendants, conservative retained CPU, physical RSS, wall,
file/output ceilings and the host memory reserve. CPU/file rlimits only lower
inherited limits; DATA/AS are untouched. Linux subreaping and identity-checked
pidfds limit cleanup to observed owned descendants. Resource and listener checks
are sampled; there is no atomic procfs check-and-send or protection from arbitrary
same-UID memory/file/internal-code forgery. The endpoint bind check is not an
atomic port reservation.

Loading review now permits bounded serial progress through several checkpoints.
Each capture has a unique path and a `phase.json` frame hash/batch. Inspect the
complete current image and atomically replace `decision_path` with exactly one
of these decisions (fill in the actual hash/batch):

```json
{"reviewed":true,"frameSHA256":"actual hash","batch":123,"continueLoading":true}
```

```json
{"reviewed":true,"frameSHA256":"actual menu hash","batch":456,"safeStartGame":true,"x":100,"y":200}
```

`continueLoading` never queues input. Only a separately reviewed actual menu
permits `safeStartGame`; loading text or a title is insufficient. The previous
consumed decision can remain on disk while a new frame is inspected; it cannot
authorize that frame. New stale or conflicting decisions refuse input. Missing
review stops without input. Images are not automatically classified as menus.

The optional controller `progress` object may set `max_checkpoints`,
`total_seconds`, `cpu_reserve`, `api_bytes`, and `capture_total_bytes`.
Defaults use at most `max_captures - 1` candidate images, the original launch
wall allowance, `min(15, supervisor CPU / 3)` CPU seconds for action/cleanup,
1 MiB cumulative control request/response bytes, and the original total capture
allowance. `total_seconds` is an absolute limit from original launch start,
including startup/review; no checkpoint renews it. Progress windows divide the
remaining original wall budget while preserving menu, action and cleanup socket
reserves; `checkpoint_seconds` bounds an individual window. `review_seconds` is
one cumulative allowance shared by all frames. `budget-plan.json` records the
explicit totals and reserves. For the historical four-capture/110-second recipe,
three candidates and one after-action image fit the unchanged ceilings; actual
available CPU/time and human review may stop it earlier.

Every window keeps the serial <=256-batch protocol and frozen-zero gate.
Continuation also requires fresh original listener identity, measured cumulative
CPU from the original supervisor, batch headroom, capture count/byte headroom,
API bytes and action/cleanup time. One after-action capture always remains
reserved. Normal loading exhaustion sends quit; a pending/uncertain request or
failed identity never sends another command and returns cleanup to the original
supervisor. CPU observations remain sampled, rather than a guarantee of future
guest throughput. These offline tests do not qualify actual Enigma startup,
menu rendering, gameplay or ordinary Quit.

Run `python3 -m unittest test_progressive` under the required resource wrapper.
Its first method exercises the actual production Python new-launch entry with
the full unchanged JS runner pin and controlled loading-to-menu transport state;
it executes no Node engine or guest. The retained pre-repair failure and repaired
passes distinguish this entry test from private scheduler unit tests.

`test_supervised.py` invokes the actual production CLI or its new-launch API.
`child_server.py` is an offline Python transport child that actually serves its
own state, including an alternate listener with the same handler/state and a
sleeping inherited holder. These are controlled production-entry tests, not real
Enigma execution or independent acceptance. Distinct children run sequentially
to fit the whole-test 128 MiB cap. `test_controller.py` keeps scheduler rejection
oracles through a clearly private unit harness; it does not manufacture trusted
production authority. Listener/ownership tests now assert refusal of the retired
public contract, rather than silently skipping old positive-attach cases.

Run the focused groups under the task's required execution/resource wrapper:

```sh
python3 -m unittest test_supervised.SupervisedTests
python3 -m unittest test_controller.ControllerTests test_ownership.OwnershipTests test_listener.ListenerTests
```

`BeforeRegression` preserves the historical rejecting original-supervisor
oracle and is not a passing acceptance group. Earlier failure artifacts remain
unchanged in `/tmp/enigma-listener-retained-independent-publication-oct27/ops`
and `/tmp/enigma-original-authority-binding-repair-oct27/ops`. In particular,
`inherited-identity-outcome.json` records the seven-HTTP renewal failure; old
24-test and native 120-pair receipts do not establish the new producer contract.

Current evidence: `/tmp/enigma-supervisor-owned-controller-implementation-oct27/ops/`
(`result.json`, `checkpoint.json`, `evidence-manifest.json`, per-group pins,
execution receipts and retained child wire/journals). Independent acceptance,
integration and separately admitted actual Enigma runtime remain required.
