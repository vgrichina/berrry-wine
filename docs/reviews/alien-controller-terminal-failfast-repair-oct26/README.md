# Alien control sequence: offline fail-fast repair

The tracked `test/alien-gameplay-sequence.py` entry point owns a complete list of
real `test/run.js --control` commands. It uses the same single-command JSON POST
to `/ctl` as the actual run's `ctl.py`, with a repository-owned durable controller
in `test/helpers/alien-control-sequence.py`. No guest/renderer semantics change.

Before each send the controller fsyncs an uncertain dispatch record, then sends
once. Transport errors, HTTP failures/redirects, oversized/truncated/invalid JSON,
non-ok responses, incomplete step ACKs, unconfirmed frozen state, or known guest
termination latch failure and stop the entire sequence. A supervisor terminal
receipt means terminal even with exit code0. Every existing ledger is one-shot:
complete, running, uncertain, terminal, and corrupt ledgers cannot reconnect or
replay in another OS process. No reset, retry, or automatic recovery exists.
An exclusive ledger lock serializes concurrent callers. Atomic replacement and
file/directory fsync retain the latch through process failure; deleting/replacing
the ledger externally is outside this guarantee and must never be used to resume
an uncertain guest. All control for an assigned invocation must use this entry.

Steps require an exact `ran`, `steps`, and batch delta, followed by a frozen
zero-credit snapshot before any other action. Input ACKs mean queued input, not
executed gameplay. Last acknowledged and last frozen batches remain separate
from observed terminal partial progress. Bounded per-command receipts contain
response hashes, byte lengths and256-byte excerpts; commands<=128, response<=8192
bytes, ledger<=256KiB. An explicit final quit ACK closes sends; it establishes no
gameplay or normal guest-exit acceptance.

## Interface and future use

Offline evidence collection remains available after terminal state and constructs
no transport:

```sh
python3 test/alien-gameplay-sequence.py --collect /retained/ledger.json /retained/guest-terminal.json
```

For a **separately authorized new invocation only**, the coordinator supplies a
fresh run identity, ledger path, explicit loopback endpoint, supervisor terminal
file path, and a bounded JSON plan `{"commands":[...]}`. The terminal file should
be absent while that guest is running and appear when the owning supervisor ends
it. This entry neither starts a guest nor grants runtime authorization:

```sh
python3 test/alien-gameplay-sequence.py --allow-control \
  --plan /assigned/new-plan.json --ledger /assigned/new-invocation.json \
  --run-id NEW_ASSIGNED_INVOCATION --endpoint http://127.0.0.1:18129/ctl \
  --terminal-file /assigned/guest/terminal.json
```

Each step is bracketed by `{"action":"snapshot"}` commands. Actual supported
wire shapes include `{"action":"step","n":50}`, `{"cmd":"dlg-click:1"}`,
`{"cmd":"keypress:13"}`, `{"action":"png","path":"/assigned/frame.png"}`,
`{"action":"eval","code":"ctx.renderWaitAttribution"}`, and a final
`{"action":"quit"}`. Input is restricted to the explicitly supported input
prefixes; native `run/resume` aliases cannot bypass the step gate. Successful eval
may return JSON null, matching the production interface. Capture readback is
separate retained-file evidence work, never a cleanup control action after failure.
Historical/offline-only fixture plans are refused by the CLI.

## Historical run remains exhausted and unqualified

Actual donor commit `fa30c996480567c5433e237e5288ed41e9c03246` on
`task/alien-accepted-opt-in-menu-gameplay-oct26` reached configuration/title/backdrop,
not menu/mission/gameplay/normal Quit. Its last confirmed frozen ACK was4650.
Final step256 had **no ACK**; terminal4754 shows only104 additional batches and
must never be treated as completion or replayed. One invocation used118.199626s
wall and78.24s aggregate CPU. The shell subsequently attempted PNG/eval/quit;
all failed after guest termination. That incident, full outcome, exhausted ledger,
initial connection refusal, source-map executable omission, and original resource
and API bookkeeping incidents are preserved in unchanged `historical-*` receipts.
No budget, ledger, source pin, denial, or historical qualification was reset.

The evidence-only parent lacks some runner blobs. Exact local immutable runner
source was verified from the supplied603-closure recovery map: runner SHA256
`6dc104b3c10db701c0b1aec5954dd00cc29a7b6009970a5876ccc27426e7fa9e`.
The actual production `lib/control-server.js` SHA256
`d83da28c64b9eafdb55eb4525711c4efdcc9bc7a9c4ed7177326acab6e83ad7b`
matches current remote-main's Git blob and is unchanged. No unavailable blob
was retried, and no runner/assets were broadly checked out.

## Offline evidence and limits

First behavioral group uses that exact production HTTP server with an injected
callback, the unchanged historical4650 response, and a timed-out256 step. The
tracked CLI issues only snapshot/step; later PNG/eval/input/quit and a subsequent
OS process send nothing. Normal success executes the same entry/parser/HTTP code
in-process to keep the harness small; the historical case separately tests a real
CLI subprocess and restarts. No guest initializer, execution, or gameplay is tested.

Focused groups:3 production-interface tests;8 boundary tests, including120
boundary/failure combinations,13 partial/malformed completion cases,10 known
terminal positions, abrupt process exit after durable intent, terminal partial
progress separation, complete-ledger reuse, invalid plans, and offline collection.
Four actual control omissions (existing ledger guard, pre-dispatch journal,
`ran` ACK validation, tracked recipe wiring) are rejected by the unchanged test
methods. Mutation FAIL/ERROR output is intentional rejecting evidence, not a
candidate acceptance failure. Candidate groups must exit0 with natural cleanup.

Run with the task-prescribed external pool and physical supervisor; the test
entry accepts `--group production`, `--group unit`, or `--group mutations`.
`candidate-*.json`, `*-execution.json`, output logs, and `checkpoint.json` bind
exact source/fixture hashes. Existing accepted renderer/default-off/schedule
groups remain unchanged and are reused from the historical publication; none are
claimed as new runtime acceptance.

Exact installed Node24.18.1/heap64 startup is retained, with DATA/AS inherited
unlimited; the historical24.22.1 path was remote-only and locally failed ENOENT
before execution. The stored local donor parser did not match its historical
remote hash; that mismatch is retained instead of reusing a stale receipt. The
exact pinned canonical parser was used on this task's actual empty mount argv
before checkout. There are no intended runtime mount files in this offline task.

An overconservative admission charged all standing WAL bytes and stopped before
tests. Task and earlier donor baseline allocations proved identical; correction
counts positive WAL allocation growth once. Three production harness attempts and
one mutation harness attempt hit the enforced128MiB physical limit. Their original
measurements are retained. Idle harness parents were replaced via exec, the
successful sequence uses the same CLI main in-process, and HTTP imports are lazy;
no physical/CPU/wall/output limit was raised and no blocked guest was retried.
Passing receipts contain actual sampled whole-process-tree RSS, supervisor/pool
ownership, CPU, and wall. Sampling cannot prove absence of sub-sample RSS spikes.

All focused tests use pool1, Git pool2 before the exclusive Git mutex; physical
limits128/256MiB include supervisors/descendants, Git DATA512MiB applies only to
Git children, Node heap64MiB is separate. CPU90/wall120/file24MiB/output2MiB/
excerpt8192 controls remain. Local64MiB projection includes selective Git/source,
outputs/publication, launcher/session, positive WAL once, future16MiB and reserve8MiB.
Readonly standing source/tools are separately identified. Host floor768MiB plus
shared256MiB child pool and future64MiB per resident client are retained; actual
RSS is already deducted from MemAvailable, with no individual128/320MiB client cap.

Publication is the own task branch only. Independent controller acceptance remains
required before integration. Future guest qualification requires a separate
coordinator assignment, immutable closure/module validation, fresh complete
resource/readiness/lifecycle admission, a genuinely new allowed invocation and
the step-ACK/frozen-zero gate before input; menu/mission/gameplay and normal guest
Quit remain unqualified. No main integration is authorized here. No guest, browser,
Wasm compile, Boat API/SSH/resume/create, lifecycle, service or public deployment
operation occurred. No test box is assigned to this offline task. Readonly
coordinator receipt reports former bx_nfacjvy7 snapshot-verified stopped at
2026-10-26T23:29:00.905126Z, original expiry2026-10-27T00:10:48.669Z; lifecycle
ownership stays with the coordinator and was not queried or changed by this worker.
