# Independent acceptance: publication rejected

Exact candidate: `7e3d2fb6859c5190f71f535ff5ea31988f890ed8`, branch
`task/blocker-distinct-task-count-repair-oct26`.
Remote main reviewed: `62b15e94e8898bc5d855392cf7ff639229177e7d`.
Rejected merged production tree: `2cca38b8995e8ce231a6cbcde6d429e322f5990c`.

The four-file delta applied cleanly. Main's duplicate-status display and overview
filtering in `ops/app.js` were retained; reader/runtime fixes and every other
production path remained unchanged. This evidence-only branch restores all four
production paths to main. No main publication or deployment occurred.

The donor's 10 passing tests are reused for its exact source revision. Independent
challenges on the reconciled tree passed 26 ordering/reversal cases, frozen-input
checks, hostile HTML escaping, blocked/done conflicts, case/whitespace/prototype-like
IDs, anonymous rows, dependency evidence, filtered-view ambiguity retention,
denied-review messaging, and disabled edit controls. Six existing parser/status/
dashboard/watchdog regressions passed. Browser checks used an inert DOM VM only.

The exact saved private snapshot was read without copying or modification. Its
SHA-256 is `2956d87a3e730bb3c94dce672fff4846f230b1d2a4524ee3baf1eb5619709ac2`.
It reproduced 77 distinct nonempty blocked IDs, 91 blocked rows, 14 duplicate-ID
blocked rows and zero anonymous blocked rows; 15 repeated groups, two conflicting
groups and one status conflict remained exposed. Raw rows and conflicting recorded
status/reasons/dependencies were retained across CommonJS/browser VM/Telegram.
No private task text or snapshot is included here.

## Unchanged rejecting reproducer

The existing mocked Telegram command regression failed at `ops/telegram.test.js:60`:

```text
node --max-old-space-size=192 --test --test-name-pattern=^/blockers ops/telegram.test.js
expected: /1 live approvals · 2 primary blockers · 1 dependent tasks/
actual:    1 live approvals · 2 primary blocker rows · 1 dependent rows
result: 1 passed, 1 failed
```

The candidate intentionally changes those labels to distinguish rows from IDs,
but does not update this existing assertion. The first failure and its source are
preserved unchanged. This is a stale affected regression expectation, not evidence
of a permission bypass or an incorrect 77/91 count. Claiming all affected tests
pass would be false. Production publication is rejected because the merged-tree
behavioral checks are not green. No oracle was weakened or edited.

Repair scope: update the wording expectation at `ops/telegram.test.js:60`, retain
the read-only/authorization assertions, and rerun that affected group against the
accepted production delta. That fifth ops path is outside this task's authorized
four-file integration scope, so no repair was made. No further worker was launched.

Reproduce in a clean isolated tree at the main revision above by applying
the decompressed `candidate.patch.gz` (the captured Git alternate-depth warning
prefix is ignored by Git apply), then running the command above. The first-failure
log is retained byte-exact in `merged-telegram.log.gz`. `challenge.js REPO_PATH` reproduces
the independent challenges using the saved private snapshot at its original
read-only host path. Source/fixture identities and results are in the JSON files.

## Controls and limits

Resource receipts cover checkout, testing and evidence publication. CPU 90 seconds,
wall 120 seconds per child, file size 24 MiB, capture 2 MiB and Node old space
192 MiB were retained. Git alone received DATA 512 MiB. Node startup succeeded
with inherited limits recorded; its heap flag is not a total-process cap.
Standing donors and installed executables were read in place. Positive WAL growth,
launcher output, future growth and an 8 MiB reserve are included in the 64 MiB
allocation. Strict dedicated SSH identity/known-host verification was used.
No mount argv, runtime, native/browser execution, service restart, boxes or
deployment was authorized or attempted. Live-browser and deployment gates remain.

Incidents: early policy/source excerpts exceeded the requested excerpt budget;
later excerpts were bounded. `python` was absent and corrected to installed
`python3`. The main commit object was absent from the first standing donor;
the existing main-publication donor supplied it read-only without a fetch or
full history. Its inherited alternate chain emits a nesting-depth warning;
required objects, clean patch application and exact tree identities succeeded.
A source-equality assertion correctly detected that merged `app.js` retains main
fixes absent from the candidate; this was recorded without changing production.
The evidence whitespace check initially flagged literal patch context and blank
lines in the failure log. Those artifacts were archived losslessly as gzip rather
than editing the unchanged reproducer or its output.

No box was assigned or contacted (state/expiry N/A); lifecycle remains with the
coordinator. Claude stayed idle. This task stops after evidence publication and
ownership release.
