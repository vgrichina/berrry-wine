# Independent rename evidence option acceptance

Candidate: `bacb4b61b85acf9aa148212a122dd024cd13295a`.

Verdict: **PASS for the offline caller/adapter option contract**. Actual mounted
callback evidence remains a separate acceptance gate. This work performs no
mount, workload, guest/browser execution, Boat allocation, or public deployment.

The dispatch's fourteen source pins, supervisor/limit-wrapper pins, canonical
completion-receipt pin and publication SHA were checked before behavioral tests.
The owned branch initially pointed at the exact candidate. Production files and
the backend were unchanged. Each phase rechecks the input pins.

Ten independent tests passed in three behavioral groups, with production enabled
dispatch first (1), remaining acceptance (8), and explicit pin rejection controls
(1). Parameterized cases cover:

- Actual caller API and CLI default, explicit zero, 1, 32 and 64. Enabled dispatch
  first uses 3. The actual caller loader verifies and compiles the adapter, which
  constructs backend argv and confined supervisor argv; a comma-bearing command
  argument is preserved. No evidence option leaks to the supervisor limits.
- Bool, integer-valued floats, nonfinite floats, negative and oversized integers,
  strings, containers and None reject in both APIs before process creation.
  Twelve malformed CLI values reject before qualification.
- The actual backend CLI and constructor retain the newest requested number of
  records from 80 synthetic alternating RENAME/RENAME2 callback invocations. Zero
  omits evidence entirely. The backend bytes are unchanged.
- The adapter's real snapshot reader accepts valid JSON padded to exactly 8192
  bytes and rejects 8193 bytes with `filesystem backend receipt too large`, while
  retaining filesystem cleanup evidence and refusing to assert complete reap.
- Receipt, resource, accounting and cleanup checks remain fail closed. A synthetic
  cancellation receipt is explicitly repinned and validated by the real receipt
  validator; altering its bytes rejects before backend loading. Each backend pin
  and the adapter's supervisor pin reject tampering before compile/spawn.
- An executable adapter mutant removes only the evidence argv append. The fixture
  repins that adapter, keeps the backend unchanged, passes identity/import checks,
  and reaches one backend launch plus one supervisor fixture call. The independent
  oracle rejects it specifically with `enabled adapter omitted backend
  renameEvidence`. This is an oracle rejection; the production qualifier does not
  independently require the presence of requested callback evidence.

The injected boundaries are process creation, sockets, mount/serve, and the
supervisor's workload function after executing its hash-verified source. Callback
records here are synthetic method calls, **not actual mounted dispatch evidence**.
The canonical candidate tests/report were read as inputs; this acceptance is a
new implementation and does not rerun their fixture groups.

`preflight-report.json`, `boundary-report.json`, `remaining-report.json` and
`pins-report.json` contain exact pins and observations. Guarded execution records
are retained in the task root's `e/` directory. All behavior/Git operations use
the unchanged task `ops.py` and its admission, CPU, wall, capture, disk and RSS
guards. No Node execution requires a startup check. No mount argv exists to
validate. The original-parent prelaunch receipt is reused unchanged. An erroneous
nested startup self-test was stopped at its incompatible inherited DATA guard;
it was neither retried nor used as evidence of successful startup. No limit was
raised. The 8 MiB publication reserve remains for coordinator closeout.

Recovery: use the task root's `recovery.patch`, `recovery-recipe.json` and
`completion-receipt.json`. The receipt records the published independent branch
and exact remote SHA. The coordinator appends `messageboard-note.txt`; the worker
does not open the oversized shared board or integrate main. No runtime box was
allocated; lifecycle ownership stays with the coordinator.
