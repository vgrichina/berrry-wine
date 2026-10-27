# Frozen input consumption observation

The CLI's existing `--trace-input-dispatch` now also enables a read-only control
request, with a fresh caller-owned observation ID:

```json
{"action":"input-state","id":"space-down-after-step-5002"}
```

Send through the existing control stdin or HTTP channel only when the runner is
frozen with zero run credits. The response echoes `requestId` exactly and the
current batch. No option is added to ordinary `snapshot` output. Without the
trace flag the request fails; malformed IDs/options and nonzero credits fail
before inspecting state. This is a concrete diagnostic invocation, not an
authorization to run Airstrike. Runtime requires a later assignment.

For a future authorized diagnostic, retain the input ACK and completed step,
then send this request at each frozen boundary before further input. Compare
the scheduled and renderer queue heads and cumulative dequeue/route/dispatch
counters between observations. Queue ACKs alone establish no consumption.
`last.dequeue` identifies the actual `check_input` return and queue source;
`last.route` refers to that dequeue observation. A DispatchMessage trace is an
observed API entry, not proof of callback completion or SDL consumption.
Dispatch correlation remains `unavailable`: matching message values do not
prove provenance. Renderer key-handler enqueues do not pass through the raw
enqueue hook, so `enqueued` counts only that existing instrumented hook.
`scheduled` counts scheduled actions processed by the existing trace hook,
not accepted control commands. Counters cover the existing runner hooks;
worker-side consumption outside these hooks is unobserved.

Observation contains up to sixteen heads per host queue and sixteen secondary
threads; counts and truncation are separate. Keys are limited to Shift, Ctrl,
Alt and Space, reading stored physical, async-down and async-pressed maps.
It never calls key getters that consume a press bit. Missing maps are unknown.
Guest post queues and SDL consumption are explicitly unknown.

Thread fields are stored host state plus pure exports for EIP, yield reason,
wait handle and timeout. The pinned export definitions are `global.get` only.
Stored sleep deadlines are reported without comparing clocks; `sleepActive`
is unknown. Missing getters or worker-owned exports are unknown. No scheduler,
wait polling, queue drain, clear-on-read `get_sleep_yielded`, guest clock read,
clock publication, credits or wake call occurs. A worker host record is not a
coherent snapshot of another OS thread's registers.

Counters saturate at 4294967295 and retain only one last observation per stage.
IDs stop being unique at saturation and become `unavailable`. The existing
1000-line trace cap remains; counters continue after log suppression. No
unbounded history is retained. Request IDs are printable ASCII, 1..128 bytes;
unknown options are rejected. Each response is detached from internal state.

Focused source-only acceptance:

```sh
node --max-old-space-size=512 test/test-input-consumption-state.js
node --max-old-space-size=512 test/test-input-consumption-state.js --remaining
node --max-old-space-size=512 test/test-input-consumption-clock-domain.js
```

Use the assigned execution pool and resource supervisor on this host. These
tests execute byte-exact production initialization/control/input/dispatch
regions with host fixtures; they load no guest, game, compiler or module.
The original `--gap` mode was run against the unchanged pinned runner before
repair and is retained as a pre-repair rejecting checkpoint, not a candidate
passing mode. Rejecting controls cover detached production wiring, a clock
probe, queue draining and the existing clock-domain mutations. A test fixture
syntax error and its corrected successful result are both retained.

Historical Airstrike evidence used runner b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a,
not the current base 1e4fdb06f64e5f14ddec582111dfe7ecb71df6ba. Queued Space at
batches 5001/5002 and unchanged frozen 5003 do not establish lost keys, wrong
focus, a sleep, deadlock or a required hold duration. This change does not alter
keyboard routing, guest scheduling, memory, clocks or hold duration and claims
no causal game fix. Independent acceptance and fresh runtime admission remain.
