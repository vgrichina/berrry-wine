# Endpoint fixture reconciliation — 2026-10-20

**BLOCKED: partial fixture correction, not qualified for integration.**
Qualification stopped at the first unexpected regression failure, as directed.
No production defect was demonstrated and no production code was rewritten.

The exact assembled prerequisite tree is
`7f31dd6f5970fb0b0b58325bf20e3624f4006401`, on main
`f3698d8827aa048af14e0f0cbaa733bb96801949`.
Candidate prerequisite commit `f2afd75169dd898f0dd6001440f76af8f7773f8b`
preserves that exact tree with main as its parent: the reviewed skipped-child
change `ee129daa`, endpoint repair `3bfe9166`, and acceptance `3d452dfb`
are the prerequisites, not new production changes by this task.
Only the task branch was targeted for publication; main integration belongs
to the coordinator. Publication failed with Git exit128:
`fatal: could not read Username for 'https://github.com': No such device or address`.
The candidate is local only, not remotely backed up. No remote verification
was possible in this attempt.

## Corrected mismatch and passing evidence

`process-alias-boundary-fix-20261020.js` supplied a `LoopbackSegment`
whose `attach()` returned `{}`. The assembled `process_spawn` owns a child
endpoint and invokes `childWire.close()` on completion. The fixture therefore
failed before evaluating its existing completion assertions.

The helper now evaluates the complete production `lib/vlan-wire.js` module.
It exercises real endpoint membership, queue disposal, callback release,
closed-wire refusal and GONE frames. There is no silent `close` substitute.
The predecessor now reads the corrected checkout helper instead of pinning
the historical helper blob. All previous assertions remain unchanged.

On the exact assembled production source:

- Corrected predecessor: 17 groups pass, including its internal rejected
  old-shell pending-handle control.
- Independent endpoint acceptance: 13 groups pass (216 retirements and
  180009 later frames with live siblings).
- Submitted endpoint suite: 17 groups pass.
- New fixture lifecycle suite: skip, normal exit, cancellation and failure
  pass. It checks real queue and callback cleanup, caller/sibling survival,
  later traffic, closed-wire refusal, exit codes and exactly one GONE.
- Removing exactly one production `childWire.close()` call rejects at
  `completed child endpoint must leave segment`. This assertion is checked
  internally and by a separately recorded failing-control invocation.

## Remaining blocker

Reproducer, from the isolated candidate repository:

```sh
SOURCE_REV=7f31dd6f5970fb0b0b58325bf20e3624f4006401 node docs/reviews/shell-skipped-child-lifetime-20261020.js --regression
```

Exit status 1. The nested `process-alias-correct-port-20261020.js`
test `actual onExit callback merges once including exit259; close does not
own callback` extracts from the callback declaration to
`      const ok = shell.launchVfsExe`.
The predecessor adapter already updates the start marker to
`const onExit = (child, outcome) => {`, but the assembled host has
`let ok;` followed by `try { ok = shell.launchVfsExe(...) }`.
The missing end marker triggers `between()`'s assertion before the callback
can execute. The nested fixture also does not bind the new `childWire`
free variable; that is a source inspection finding, not a second executed
failure. No further adaptation or test execution followed this failure.

The planned external baseline and endpoint mutation replays after this step
remain unrun. The full compiled process regression is not claimed to pass.
The new lifecycle control and predecessor internal baseline are the only
negative controls completed in this task before stopping.

## Recovery and boundaries

Evidence: `scratch/runs/20261020-shell-endpoint-fixture-reconcile-oct20/`.
Each test JSON preserves command, source revision, exit status, stdout and
stderr. `regression.json` contains the exact failure. `receipt.json`,
`source-seals.json`, `preserved.json`, `validation.json`, `push.json`,
`change.patch` and `SHA256SUMS.json` record publication and preservation.

Fresh isolated exact sparse patterns preceded checkout; the target tree was
verified before materialization. Object alternates were flattened
dependencies-first and only read. The supplied assembled repository and
shared HEAD/index/config are sealed and unchanged. No unrelated worktree,
laptop Heroes II, Warcraft III, main, runtime, Boat, browser, full build,
deployment, Claude or worker/refill operations were used.
The 8 MiB cap and conservative 2277507072-byte prewrite floor were enforced
(the latter reserves the entire cap rather than only its remainder).

This is source-slice fixture evidence, not game, full VM, browser, Worker,
guest EOF, heap or runtime qualification. The branch is a blocked review
candidate; the coordinator must assign any further fixture work.
