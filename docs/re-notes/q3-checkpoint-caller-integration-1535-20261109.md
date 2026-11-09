# Q3 owning checkpoint caller integration, 1535

Run: `scratch/runs/20261109-q3-checkpoint-caller-integration-1535/`.
Offline only. Historical1475 cause and browser EOF remain **UNKNOWN**.
No native qualification, browser readiness receipt, or native retry is claimed.

## Production change

`tools/q3-current-module.cjs` now has the explicit version
`q3-checkpoint-b993419a5-v1`. It authenticates the published b993419a54d732a67696851d8f2dc50b574b625b
observer, separate-stream helper, and owning launch client against Git bytes
and requires that publication in both HEAD and origin/main. Only this version
accepts the new literal Q3 prelaunch SHA. CPU, modules, custody, HTTP providers,
startup admission, and every other existing provider retain their prior pins.
The original default migration literals remain intact: unversioned preparation
refuses changed prelaunch bytes instead of silently refreshing a frozen pinset.
No observer feature is selected by default.

The preparer generates `q3-checkpoint-caller.py` beside the run's input files.
It accepts only the exact retained1475 phase caller SHA
`5b52e6438e2ec3f9676d11584dd52c5a435b1b17412c4ac2d5c1dec33301bb1e`.
It changes that actual caller's binder to the published observer's
`bind_remote`, and its cancellation checkpoint branch to
`observe_checkpoint(task, session, session.remote)`. It waits for the existing
owning launch to start before admitting that observation. The original
physical proof gate, cancellation request, original-command branch, and
postlaunch evidence checks remain present. Historical callers are unchanged.

The generated caller, its explicit source input, and the run's `control.py`,
`physical_gate.py`, and `cancellation_gate.py` must all be in the pinset. The
observer's transitive Python dependencies are also included. Prelaunch checks
the explicit version, literal provider hashes and lengths, generated caller
and run-local dependency membership, compiles the caller, and actually imports
all three Python providers, including the stream helper's deferred client.
All this happens before the runtime spawn. Default-off prelaunch retains its
existing execution path and separate stream drain.

Example preparation, with small run-specific inputs already in an owned run
directory (this is preparation only, never allocation or launch):

```sh
node tools/q3-current-module.cjs --prepare scratch/runs/OWNED/prepared \
  --checkpoint-observer-version q3-checkpoint-b993419a5-v1 \
  --caller scratch/runs/OWNED/phase-input.py \
  --input scratch/runs/OWNED/phase-input.py \
  --input scratch/runs/OWNED/control.py \
  --input scratch/runs/OWNED/physical_gate.py \
  --input scratch/runs/OWNED/cancellation_gate.py
```

Additional runtime/run inputs still require explicit `--input` entries. This
does not authorize a native attempt or reuse historical success evidence.

## Verification

`production-cap-final.log` records the production CLI preparing the pinset and
caller, an executable import of the **entire generated caller**, executable
prelaunch checks, and the generated phase's actual `launch()` function with
the real owning Session, actual generated parent and actual prelaunch. Only
the outer transport and runtime are inert. No Boat, browser, game, or native
custody supervisor is run.

Six actual caller cases pass: partial checkpoint, damaged checkpoint, prior
failure with a valid checkpoint, cancellation with a valid checkpoint,
diagnostic journal cap, and a valid checkpoint reaching the unchanged physical
gate. The offline physical gate deliberately refuses native proof. There are
no guest commands or successful native cancellation receipts. All created
local transport children are actually waited; stdout and stderr EOF remain
separate. Started runtime cases have nested actual waits; the cap case uses
the helper's explicit `diagnostic-failed-after-actual-wait` journal record, not
a fabricated normal receipt. The normal prelaunch-child receipt is absent in
that case. The final subreaper sweep has zero orphan children. The independent
120-second sibling watchdog was observable before tested children, did not
fire, and was actually waited separately.

Nine executable prelaunch cases cover success/default-off and refusal of a
missing/stale observer, missing stream helper/client, missing generated caller,
missing caller-local dependency, and unknown version. Production preparation
also refuses six stale/missing provider read substitutions, a missing caller
dependency, and changed caller source before producing outputs.

`observer-final.log` passes the retained1525 actual generated-parent controls:
spawn failure, missing/partial/damaged checkpoint publications, prior failure
and cancellation wins, absolute deadline expiry, journal cap cancellation,
FIFO/symlink/size/gzip refusals, and real separate stream waits. Its retained1475
exists-only poll still demonstrates old false-ready behavior for partial JSON
and a prior failure. This does not identify the historical native cause.
The observer retains the same 60-second observation and 70-second transport
cap. Browser startup deadlines and cleanup budgets are unchanged.

Focused existing controls pass: native launch client; actual stream EOF and
inherited-writer cases; prelaunch import/barrier controls; Q3 startup; original
current-module controls against frozen prelaunch bytes. The old stream test
initially refused its missing current-module input; `stream-fixture.patch`
records the sole in-memory addition required by its fixture, with all original
assertions retained. Existing test files were not edited. Earlier failed test
iterations are preserved, including a transport-wrapper cleanup failure and
an overstrict normal-receipt assertion for diagnostic-cap failure. Neither is
promoted to success. The final transport makes Session directly own the
generated parent; it does not extend a timeout.

The final locked build is `build-final.log`. Evidence records the exact Git
base plus the small owned patch; no source tree, media, or module copies were
made. Large owned JSON evidence was losslessly gzip-compressed with verified
SHA/length mappings in `lossless-json-storage.json`.

## Ownership and lifecycle

Existing providers remained frozen until Q21495's final published RELEASE STOP
at 14:18:04Z, commit f017d680e24167b7e95e824ddbc993278b404fd6, after its exact
UUID fcb86e70-6cdf-4166-8a5c-c03951aa45fc archive and physical drain. Fresh OWN
for these two Q3 providers followed at 14:18:46Z. Q2, custody, CPU, WAT, host,
Redline1515, observer, launch client, stream helper, and startup files were not
edited. No new worker, deployment, Heroes II or CLAUDE change occurred.

New box ID/state/expiry/stop receipt: **NOT_CREATED / N/A / N/A / N/A**.
Inherited boxes were not contacted. A future native attempt needs separate
authorization and fresh versioned preparation; historical browser EOF and
historical1475 cause remain UNKNOWN.
