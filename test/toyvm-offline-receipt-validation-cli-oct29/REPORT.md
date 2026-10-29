# Supported offline backend-result receipt validation

Task: toyvm-offline-receipt-validation-cli-oct29
Session: 01a1857c-b02f-7f33-b4a4-bdcdd6bd2398
Base: 7e07875383031bc000b1e9417c39e86300ab2a3b
Repaired candidate: 5a88ca099b962e946160afd2d4d71a950bf46db3
Branch: task/toyvm-offline-receipt-validation-cli-oct29

Final parent: 7e07875383031bc000b1e9417c39e86300ab2a3b

## Behavior and supported input

The separate command `test/toyvm-bounded24-caller-wiring-oct28/validate_receipt_offline.py`
reads a retained backend-result JSON object and explicitly supplied limits. It
hash-checks and imports the exact existing caller, then invokes its production
`evaluate(result, limits)` without loading or invoking a backend. The production
`filesystem_clean` predicate remains inside that evaluator. There is no second
cleanup validator. The live caller file, argv parser, loader and runtime path
are unchanged.

The saved object's `output` uses the existing evaluator's retained representation:
`{"encoding":"base64","data":"b2sK"}`. Only that representation is decoded to
bytes before evaluation. Missing/malformed output encoding, non-object top-level
input, invalid/duplicate/nonfinite JSON, excessive input, invalid limits and
missing arguments fail closed. Input is bounded at 1 MiB and output at 4096 bytes.
The decision omits the arbitrary backend payload. Exit 0 means the supplied
receipt was accepted offline; 1 means evaluation rejected it; 2 means malformed
input, unsupported limits, argument failure or changed caller identity.

Every JSON decision, including errors, says `offlineValidationOnly=true`,
`runtimeQualified=false` and `offline validation only`. Help also identifies the
scope. `cleanupComplete` in a positive decision describes only the supplied data;
it is not fresh mount, process, or cleanup evidence.

Example (use a retained backendReceipt object as saved-result.json):

```sh
python3 -B test/toyvm-bounded24-caller-wiring-oct28/validate_receipt_offline.py \
  --result-json saved-result.json \
  --live-limit 32768 --write-limit 65536 --file-limit 16384 \
  --rss-limit 134217728 --cpu-limit 1.25 --wall-limit 2.5 --output-limit 4096
```

## New acceptance only

`evidence/cli-test-results.json` records 52 real Python CLI child invocations,
with actual argv, file input, bounded stdout/stderr and exit receipts. The first
behavioral checkpoint is the unchanged `unmountExit=False` counterexample: the
supported offline child exits 1 and rejects cleanup. Two legitimate cleanup
controls exit 0. Malformed cleanup fields, boolean/integer confusion, missing
fields, filesystem and child booleans, and output quota rejection fail closed.
Valid-shaped fixtures match the exact production evaluator's decision fields.
Invalid JSON/top-level shapes/output encodings, duplicate/nonfinite JSON, all
seven omitted limit arguments and invalid limits exit 2.

The accept-all mutant is a temporary offline command, not a replaced backend.
The same first counterexample causes that child to exit 0 with accepted=true;
the unchanged test expectation rejects it and the runner exits 1. The mutant
is retained as non-executable text in `evidence/accept-all-mutant.txt`, with the
result in `evidence/mutation-verdict.json`. No backend injection, sitecustomize,
monkeypatch, browser, FUSE, game, guest, download or installer ran.

Prior 32 fixture results are reused by exact REPORT/manifest pins in
`evidence/input-pins.json`; no prior group was rerun. Those prior cases were
in-process adapter tests and do not establish an external live CLI boundary.
**Original live CLI/FUSE/browser acceptance gap remains OPEN. This task does
not qualify execution or reset any runtime allowance.**

## Supervisor, resources and preservation

`supervisor.py` is new task-owned code. Every subprocess requires keyword-only
cwd with no default, validates the resolved directory beneath this task's own
repository, and rejects omitted/root/donor/outside before spawning. Positive
sentinel and negative-control receipts are retained. Git commands use explicit
owned `-C` and validate toplevel/absolute-git-dir before each mutation; init was
restricted to this owned directory. Donor objects are process-local read-only
alternates, without donor configuration or ref writes. Trusted SSH is explicit.

Physical RSS uses current /proc resident pages for supervisor and descendants,
including descendant sessions, never historical inherited getrusage ru_maxrss.
The historical failed predecessor sentinel is preserved separately. Actual
Python DATA/RSS 128 MiB, Git-only DATA 256 MiB, group physical RSS 512 MiB,
CPU 90 s, wall 120 s, file 12 MiB, capture 2 MiB and aggregate evidence 1 MiB
controls remain. Child process groups/observed descendants are killed/reaped at
operation end; their remaining-process receipts are retained. Startup records
session path, initial shared WAL baseline once, inherited limits and the exact
24 MiB allocation. Fresh admission receipts include task/session/events/positive
WAL growth, device, timestamp, f_bavail, block size, aggregate, projections,
free bytes and MemAvailable. Allocation remains retained through coordinator
closeout. No resource admission failed in this task.

The canonical empty mount-argv parser receipt was reused only after verifying
its exact current parser SHA and unchanged empty argv/files. That verification
occurred after isolated checkout; no mount/runtime operation occurred. Initial
read-only policy/dispatch tool output exceeded the requested terminal bound;
subsequent inspection and production output were kept small. No limits were
increased to recover either historical evidence or that inspection output.

There is no assigned test box. Runtime lifecycle remains coordinator-owned.
The shared root/index/refs, predecessor sources/evidence/media and messageboard
were not modified. Root ref identity reuses the standard launcher receipt.
Final task commit, exact remote SHA, cleanup and the canonical completion receipt
are recorded in task-owned `publication-note.txt` / `canonical-receipt.json` for
coordinator delivery; no board append, main push or public deployment is allowed.

The real-child acceptance recipe (from the assigned owned repository) is:

```sh
PYTHONPATH=test/toyvm-offline-receipt-validation-cli-oct29 python3 -B - <<'PY'
import supervisor as s
s.run(['/usr/bin/python3', '-B', str(s.OWN/'test_offline_cli.py')],
      cwd=s.ROOT, name='offline-cli-acceptance')
PY
```

A prepublication history-inspection command could not complete because an
unneeded ancestor object was unavailable (including an alternate nesting
diagnostic). This is retained in evidence/base-candidate-ancestry.*; no ancestry
conclusion is claimed. Checkout of the assigned base succeeded. Both the base
and repaired candidate contain the exact same pinned caller bytes, so the final
branch is based directly on the assigned base and the unchanged evaluator tests
are reused. No alternate configuration was changed or object fetch attempted.
