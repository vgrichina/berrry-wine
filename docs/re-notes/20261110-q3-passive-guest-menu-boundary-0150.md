# Q3 passive guest boundary: implementation and one refused observation

Evidence: `scratch/runs/20261110-q3-passive-guest-menu-boundary-0150/`.
Native implementation commit: `804b5891b`. The subsequent offline repair is
published with this note. Arena gameplay and authentic Q3 menu consumption
remain unobserved; no guest-input defect or gameplay acceptance is claimed.

`tools/q3-menu-consumption.cjs` builds an explicit observation module from the
canonical closure in memory. Shared source providers and startup custody stay
unchanged. An observer-only global defaults to zero. The opt-in module observes
the existing threaded and compiled call/return/branch seams, DispatchMessage,
and existing Worker input-import returns. It does not enable trace ranges,
switch tiers, flush code, split run calls, change guest state/clocks, call guest
handlers, or alter production deadlines. Reads use bounded direct-window
DataView accesses, avoiding fault-servicing guest translators.

The emitted Worker installer verifies observation-module SHA and size before
instantiation. Commands bind the reviewed prior image SHA/label, command ID,
and all nineteen immutable owner fields; the actual Worker endpoint, instance
token and module SHA are checked before arming. Observation is limited to 512
records, 500,000 transfer events, 32 tracked frames and 60 seconds per command.
Failure is sticky. Call intent, actual entry and matching return are separate
records. UI VM binding and selected authentic QVM offsets are passive records,
not an acceptance predicate. Native evidence for those records is still missing.

Offline controls execute the actual generated command body with wrong owner,
incomplete prior frame, successful Enter, and first-failure termination. Every
owner field also refuses independently. The emitted installer runs through the
real execution-boundary transport and instantiates the real generated Wasm;
a synthetic x86 program naturally CALLs, enters and RETurns, with the expected
result and stack restoration. This is expressly synthetic, not Q3 execution.
Additional unarmed controls show zero observer import calls and unchanged
debug-tier guard. Existing page-observer controls and all seven composed
command/screenshot terminal controls pass. Both locked builds pass.

## The single native attempt

The accepted unchanged fixture was reused by SHA references in
`reused-fixture.json`; no fixture or game media was copied. The one original
run used observation module
`a28ebec9aa8f83b4ab71cfbf4bd8d7184df5764ab901aa9bf7de3ea1a625cb82`
(2,186,162 bytes). No first image or game input was produced.

At 02:01:12.040Z `worker-errors.jsonl.gz` recorded `SyntaxError: Unexpected
token ';'`. The existing execution-boundary transport nests matching evaluations
inside an expression; the installer had a trailing statement semicolon.
The original Worker-task catch only logged this error. Startup subsequently
refused at 02:01:31.857Z (`compiled`, not `parked`), then owning cancellation
retired the runtime. This approximately 20-second gap violates the requested
immediate failure termination; it is not described as successful enforcement.
After that observed refusal there was no later game protocol, input, capture,
retry, quit or extension.

The same worker repaired this offline: the installer is expression-safe; its
failure immediately enters the existing sticky terminal path before Worker
resume. A regression reproduces the exact old syntax failure through the
production transport and passes with the correction. Another control exposes
and repairs the next startup guard: canonical page admission remains intact,
while a Q3-only in-memory adapter separately authenticates the actual changed
Worker module and records both identities in its release receipt. Shared
startup/admission providers are unchanged. No second native attempt was made,
so these repairs have offline validation only.

## Evidence and lifecycle

Independent inventories and rereads verified 48 unique artifacts, 1,737,834
bytes, before normal stop. Supplemental verification found one deduplication
alias race: the remote empty `execution-boundary.jsonl.gz` had been aliased to
the then-empty, growing local retrieval stdout. `corrected-retrieval.json`
preserves that original record and restores the uniquely determined empty byte
sequence from its independently inventoried zero size and empty SHA. All other
bytes were preserved. Supplemental finalized gzip verification completed after
stop; it must not be claimed as a completed pre-stop check. No PNG existed.
The kernel receipt accounts for all 161 owned processes, complete fork lineage,
161 reaps, no unreaped processes and command-log EOF. Generated parent,
prelaunch child, runtime parent and local controller each have actual waits
and separate stdout/stderr EOF receipts; their failure statuses remain failures.

Task box: `bx_fkjkaqbj`, UUID `15f6283d-adf8-4b62-8747-62cb3976d7bc`.
The independent watchdog was observed alive before creation with immutable
deadline 02:24:56.273Z; initial API expiry was 02:24:55.593Z. Sole normal
unforced stop `stop_f561cc9da0d9d446` completed at 02:02:37.488Z. Final API
state is `archived` (stopped), expiry null. The watchdog actually exited zero,
was waited separately, and both streams reached EOF. No box was resumed or
deleted, and no other agent's box was touched.

Exact Git bases and small binary diffs/owned-input patches are retained. No
source archive, media copy, local Chrome, nested worker or second box was used;
home free space stayed above 1.5 GB. The concrete next step requires a newly
authorized native observation of the repaired adapter. The current task's
single-attempt authorization is exhausted. Files are released and work stops.
