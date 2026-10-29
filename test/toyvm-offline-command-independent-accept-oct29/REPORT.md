# Independent offline command acceptance: REJECTED

Candidate: `354c5651f6f11bbd430424c3163d7e87e125fc9a`.
Task/session: toyvm-offline-command-independent-accept-oct29 /
01a18589-d8a3-7331-af57-e3fb8fed17e7.

`offlineValidationOnly=true`, `runtimeQualified=false` throughout.
Original live CLI/FUSE/browser acceptance gap remains **OPEN**.

The first actual production-command invocation used the unchanged
`unmountExit=False` fixture from the pinned predecessor recipe. It correctly
exited 1 and rejected cleanup. The legitimate cleanup control exited 0.
All valid-shaped decisions tested against production `evaluate` matched.
The prior 52 cases are reused by exact candidate, source and retained evidence
hashes in `evidence/prior52-reuse.json`; the predecessor supervisor was not run.

Acceptance stopped on the first defect, case 73. A valid receipt with an extra
`"metadata": 1e999` was accepted (exit 0, `accepted=true`). The JSON decoder
converts `1e999` to positive infinity; `parse_constant` does not handle exponent
overflow, and the production evaluator ignores metadata. Literal `NaN` and
`Infinity` in the same field correctly failed with exit 2. The pinned command's
report promises rejection of nonfinite JSON, so this violates its input contract.
This does not demonstrate bypass of a checked resource field: overflowing
`cpuSeconds` was rejected by production evaluation with exit 1.

The unchanged 364-byte input is `evidence/unchanged-reproducer.json`, SHA-256
`0a1537b8c35ac1379d7e4b028b47a1ba0656e692163ccf7b909d1ed08fffa11e`.
`evidence/first-defect.json` binds exact argv, command hash, stdout and exit.
The original argv references the temporary `fixture.json`, removed at stop;
substitute the retained unchanged-reproducer path to replay it. No candidate
file was changed. Candidate integration/publication is rejected; this branch
publishes independent tests and evidence only.

Before the defect, 72 new checks passed: duplicate keys including escaped and
nested duplicates, trailing JSON, invalid UTF-8, excessive nesting, exactly 1 MiB
input and one byte over, bounded argument-error output, changed caller identity,
every required numeric limit omitted/zero/negative/above maximum/nonnumeric,
nonfinite numeric limits, malformed result/output schemas, and resource
nonfinite values. The same unchanged first cleanup oracle rejected an offline
command mutant which changed `accepted` to true. Its source is non-executable
text and its actual child result is in `evidence/mutation-verdict.json`.
No broader tests ran after the defect.

Recipe, from this assigned owned repository only:

```
python3 -B test/toyvm-offline-command-independent-accept-oct29/accept.py
```

This intentionally returns 1 at the preserved defect. It imports the exact
pinned production evaluator for comparison, never a backend or a replacement
validator. Do not execute the pinned predecessor test: it imports its own mutable
supervisor. Sparse source staging used only four explicit `git show COMMIT:PATH`
operations followed by `git read-tree`, without broad checkout.

The fresh supervisor rejects omitted/root/donor/outside CWDs before spawning,
requires explicit Git `-C`, and checks the real toplevel/git-dir before mutations.
Containment negatives and owned sentinel passed. Each operation used fresh
disk/RAM admission and current physical RSS from `/proc`, never `ru_maxrss`.
Child limits were Python DATA 128 MiB, Git DATA 256 MiB only, individual physical
RSS 128 MiB, process-group RSS 512 MiB, CPU 90 seconds, wall 120 seconds,
file 12 MiB and capture 2 MiB. Process groups were killed/reaped at closeout.
The acceptance supervisor's exact original bytes are retained separately.

Limitations of this worker's controls are recorded candidly: early admission
samples measured owned files but did not explicitly itemize session/events/WAL
growth; publication admission adds those counters against the same unchanged
allocation and forecast. The original physical monitor sampled the child group,
not escaped sessions or the parent supervisor. The offline children do not spawn
descendants. The inherited baseline was captured before the Python DATA wrapper
was added; child limits were applied from the first sentinel. Empty mount argv
was recorded but the canonical parser was not independently invoked before
staging; no mount command or runtime operation occurred. Initial read-only policy
and source inspection output exceeded the requested 8192-byte terminal bound.
These limitations do not strengthen any runtime qualification claim.

No backend, browser, guest, game, mount, FUSE, build, download, installer, Boat,
Claude or public deployment ran. Shared root/index/refs and predecessor files
remained read-only. Initial root-ref identity reuses the launcher digest.
No board append or main push occurs. Coordinator receives the bounded publication
note and canonical receipt; the 24 MiB allocation remains held until closeout.
No test box was assigned; box lifecycle ownership remains with the coordinator.
