# Alien Shooter reviewed menu controller

Run the tracked production entry point on the control host, inside the **existing**
supervisor-owned guest invocation. It starts no guest and creates no time allowance:

```sh
python3 tools/alien-menu-gameplay-controller.py \
  --invocation /absolute/existing-invocation \
  --endpoint http://127.0.0.1:18129/ctl \
  --terminal-file /absolute/existing-invocation/terminal.json \
  --after-batches 128 --approve-new-game
```

The supervisor supplies `budget.json` in that directory. Epoch seconds and capture
counts describe the whole invocation, including startup and earlier captures:

```json
{
  "runId": "unique-supervisor-invocation",
  "startedAt": 1800000000,
  "deadline": 1800000120,
  "startupMaximum": 75,
  "actionReserve": 30,
  "cleanupReserve": 10,
  "captureLimit": 8,
  "capturesUsed": 5
}
```

Those timestamps are examples, not a runnable admission. The deadline must be no
more than 120 seconds after the original start; startup is at most 75 seconds,
action/evidence reserve at least 30 seconds and cleanup at least 10 seconds.
Smaller admitted windows and larger reserves are supported when they fit. The
first approved attempt seals the supplied budget, including a refused attempt.
No relative timeout, resume, ledger override or allowance-renewal option exists.

Also supply `process.json` identifying the actual existing local control server:

```json
{
  "pid": 12345,
  "startTicks": "actual-proc-pid-stat-field-22",
  "endpoint": "http://127.0.0.1:18129/ctl"
}
```

The supervisor supplies the PID and start ticks of the existing control server.
The CLI verifies that process owns the loopback listener through readonly procfs,
then checks its identity again at each socket send. Missing/inaccessible identity
stops control. A persistent flock and receipt under
`/tmp/wine-ops-alien-menu-owners-UID/` bind boot ID, PID, start ticks and canonical
endpoint. Alternate evidence directories, run IDs, terminal paths and endpoint
spellings cannot obtain a second owner for that listener. Preserve these receipts
with invocation evidence; do not delete them to retry.

After a real frozen menu capture, the supervisor stores `menu-frame.json`:

```json
{
  "runId": "unique-supervisor-invocation",
  "batch": 4722,
  "path": "/absolute/existing-invocation/reviewed-menu.png",
  "sha256": "actual-full-image-sha256"
}
```

Only after a person reviews that exact image and approves the New Game target,
store `approval.json` and pass `--approve-new-game`:

```json
{
  "runId": "unique-supervisor-invocation",
  "batch": 4722,
  "frameSHA256": "actual-full-image-sha256",
  "humanReviewed": true,
  "reviewId": "human-review-record",
  "action": "New Game",
  "command": "click:98:296"
}
```

The current explicit target is the reviewed 640×480 Alien Shooter main menu.
There is no image recognition, default approval or automatic coordinate selection.
Review, capture path/hash, run identity and the first frozen response batch must
match. Any other approved target requires a separately reviewed code change.

On admission, the CLI immediately sends a frozen snapshot followed by **one**
New Game click, using the accepted `test/alien-gameplay-sequence.py` controller
and `HttpTransport`. There is no 1024-batch menu settling or duplicate menu PNG.
Two bounded, snapshot-bracketed post-action steps produce response and subsequent
observation PNG receipts; a third capture immediately precedes the final `quit`.
`--after-batches` is explicit and bounded to 1..1024 per observation. Three capture
credits must remain before any control. A receipt name does not prove mission or
gameplay state. The supervisor must collect and visually inspect the actual images.

Budget and durable-terminal checks run at the accepted socket-send boundary,
including after connection establishment and before header/body writes. Every
operation preserves the cleanup reserve; input also requires the full action
reserve and startup bound at that boundary. HTTP timeouts are bounded by remaining
time outside cleanup (Quit may use cleanup time). Time/capture blockers include
the measured remaining quantity and required reserve. Wall-clock rollback cannot
extend this process's deadline. External supervisor wall/CPU/capture enforcement
remains necessary: future latency and HTTP response chunks are not predictable.

One supervisor-owned directory belongs to one guest invocation and one controller
owner; do not edit/reset receipts, use the old
phase wrapper concurrently, or point another controller at that guest. The owner
flock covers the entire CLI. `owner.json`, the process owner and sequence ledger survive
process exit; a repeated invocation cannot issue another input. Capture and input
intent are charged before potentially delivered bytes and never refunded after
uncertainty. Preserve the directory on failure. The accepted transport's WAL,
matching full-step ACKs, following frozen zero-credit snapshots, terminal latch
and no-replay/no-reconnect behavior are unchanged. A later failure stops the
sequence; there is no automatic cleanup reconnect after uncertain control. The
supervisor retains lifecycle ownership and must end a stalled invocation within
its original allowance. Socket observations are not atomic with an external
terminal writer or changes by unauthorized external control clients.

Offline verification, under the task's prescribed pool and physical supervisor:

```sh
python3 test/fixtures/alien-menu-controller/historical_reproduction.py /new/evidence/before
python3 test/fixtures/alien-menu-controller/test_controller.py /new/evidence/after
```

The first command runs byte-identical archived `drive.py`, `phase.py` and
`newgame.py` against a local production-compatible HTTP server, modeling the
recorded 19.6748-second redundant phase. Remote APIs/image fetching are replaced
by offline boundaries. `package.py` is retained byte-identical as the historical
incident record. The second command starts actual CLI subprocesses and supplies
a controlled clock through the fixture-only `sitecustomize.py` in **only those
subprocesses**. Production has no fake-clock option. Never add this fixture
directory to a live controller's `PYTHONPATH`. These tests load no guest, game
assets, Wasm, browser, native game code or Boat. They establish orchestration
behavior, not gameplay acceptance.
