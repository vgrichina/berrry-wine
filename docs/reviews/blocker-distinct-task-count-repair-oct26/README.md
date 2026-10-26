# Distinct blocked task counts

Base: `6aaf65235f367beb610931be83b4b1268ef35ad7`. Branch: `task/blocker-distinct-task-count-repair-oct26`.

The dashboard blocker heading and Telegram's first line use the same model formatter. The saved snapshot reports **77 distinct blocked task IDs, 91 blocked rows, 14 duplicate-ID blocked rows, zero anonymous blocked rows**. The old 89 primary blockers are 89 primary **rows**, with two dependent rows. The new output labels these secondary counts as rows. These are observations about recorded data, not scheduling eligibility.

`counts.distinctBlockedTaskIds` counts exact nonempty IDs among blocked records. Null, absent, empty and whitespace-only IDs are anonymous; each remains a separate row. `duplicateBlockedRows = rawBlockedRows - anonymousBlockedRows - distinctBlockedTaskIds`. This is the number of excess blocked records sharing IDs, not the number of repeated groups. No IDs are normalized, records removed, statuses chosen, or rows merged. Existing row arrays, approval filtering, actor rules, dependency root ordering and cycle fallback remain. Empty IDs no longer create phantom dependency edges from empty waitingOn strings.

The repeated-ID section includes *all* records sharing a blocked ID, including nonblocked records. It flags disagreement in status, title, blocker, waitingOn, needs, next, owner or dependencies, then exposes each record's line and recorded values. In this reproduction there are 15 repeated groups, two ambiguous groups, and one status-conflicting group. Neither a completed row nor an agent classification overrides a blocked row or review denial. Rendering escapes conflict evidence in HTML. Editable/reply permissions stay untouched; duplicate editing controls remain disabled when the supplied record disallows editing.

## Verification

Run installed Node with the recorded supervisor limits (CPU 60 seconds, file 24 MiB, wall 90 seconds, output <=128 KiB; Git alone receives DATA 192 MiB). Node uses `--max-old-space-size=192`; this is a heap setting, not a total RSS bound. The startup receipt records actual inherited limits and environment fingerprint. No DATA/address-space cap is applied to Node.

```
node --max-old-space-size=192 --test ops/blocker-model.test.js
node --max-old-space-size=192 docs/reviews/blocker-distinct-task-count-repair-oct26/reproduce-snapshot.js /home/user/wine-assembly/scratch/telegram/blocker-state-121-122.json
```

Ten behavioral tests pass: exact duplicates; anonymous identities; conflicting statuses/reasons/owners; dependency duplicates and cycles; retained denials and editing guards; browser/CommonJS/model/Telegram parity; HTML escaping; full-snapshot counts and conflict visibility under filtering. The snapshot probe verifies byte identity before/after and emits only a digest, aggregate counts and parity results. No private task text or snapshot is included. `tests.tap`, `snapshot-summary.json`, `source-hashes.json`, `pins.json` and `checkpoint.json` retain the completed groups and their exact inputs. The VM exercises browser JavaScript with an inert DOM; this is not a browser/native/runtime or gameplay test.

Local diff review checked count arithmetic, status conflicts across the entire snapshot, anonymous dependency handling, output escaping, unchanged permission/classification logic and the four-file ownership boundary. `git diff --check` passes. Immutable pure-test dependencies are included in the source manifest and remain unchanged. Independent acceptance is still required; no main integration, deployment, service action, runtime or boxes were authorized or performed. Coordinator retains box lifecycle ownership; this task has no assigned box or expiry.

Resource projection is 60 MiB within the hard 64 MiB task allocation, including focused Git/checkout, logs/events, incremental shared WAL attribution, future growth and 8 MiB reserve. Node and donor objects are standing read-only inputs. Publication gate measures actual aggregate Codex client RSS and host free space; evidence is retained beside the task checkout. Initial bounded-output and test-fixture incidents are recorded in the checkpoint. No platform denial occurred or was bypassed.
