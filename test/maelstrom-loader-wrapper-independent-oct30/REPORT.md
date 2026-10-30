# Independent wrapper contract acceptance — 2026-10-30

Result: **SCOPED CONTRACT ACCEPTANCE** of published candidate
`5030b1f7358a542db874f0bd3602a6b6a974cf2d`.
No concrete wrapper defect was reproduced in the independent probes below.
Mounted/full-loader, kernel, browser and gameplay qualification remain **OPEN**.

## Identity and scope

The dispatch's ten staged inputs, limit module, supervisor and canonical
publication receipt matched their byte counts and SHA-256 pins. The candidate
`qualify.cjs` SHA-256 is
`c92c4eebc5d7730fdf8356016d1252532a372695b39e74bea9c48925ffe54162`.
The canonical receipt identifies the same published commit and reports its
thirty prior contract cases. Those cases were inspected, not replayed.

Both independent programs import the actual candidate wrapper. The first
behavioral probe validates its complete pinned production source closure,
including the actual `test/run.js`, process-boot and DLL-loader sources, and
delivers the actual no-build argv to an injected recording executable.
Only the Wasm identity policy is replaced with a tiny synthetic-media pin via
the wrapper's existing explicit contract-control interface. No production
runner execution, Wasm compilation/instantiation or guest execution occurs.
No production files were modified.

Before dispatch, the suite extracts `getArg`/`getArgs` verbatim from the
SHA-verified production runner and evaluates only those parser declarations.
It validates the actual generated filename-bearing argv: exact DLL list,
Wasm and comma-bearing EXE filename, and one tree containing the explicitly
enumerated member `data/comma,name.dat`. This is parser/launch-contract
validation, not evidence that the guest mounted or read that member.

## Independent executable evidence

`accept.test.cjs` passed:

- Exact pinned source/dispatch boundary, exact no-build argv, runner cwd and
  child environment allowlist (the executable shell contributes PWD).
- Eight pre-spawn rejections: duplicate manifest member, missing member,
  traversal member, negative byte count, non-file JSON manifest, JSON null,
  directory depth beyond 32 and same-size incorrect DLL-loader source hash.
  Every rejection asserts that the child recorder was never spawned.
- Spontaneous child SIGTERM is diagnostic/loader rejection with exit code 2,
  never a successful unqualified exit or a wrapper timeout.
- A synthetic `unreachable` diagnostic on stderr with child exit 0 is rejection.
  A source-derived mutant changes `const diagnostic = /.../` to
  `const diagnostic = false && /.../`. The mutant imports successfully,
  validates inputs, reaches the same real synthetic child with exit 0 and no
  spawn error/timeout, then incorrectly returns an unqualified status. The
  unchanged diagnostic oracle rejects that result with an assertion failure.
  The mutation is caught at the intended classification defect.

`cleanup.test.cjs` passed a new inherited-pipe case: a synthetic parent exits 0
while its Node descendant retains stdout/stderr. The wrapper kills the process
group, closes the pipes and returns without the wall timer firing. The
recorded descendant was absent or a nonexecuting zombie; observed elapsed time
was 26 ms, with a 2500 ms assertion below the 3-second wall guard. This
specifically extends the prior orphan test whose child ignored the pipes.

Run from this owned repo through the supplied `ops.py`, with unchanged startup
configuration:

```sh
python3 ../ops.py independent-acceptance /usr/bin/node --max-old-space-size=192 test/maelstrom-loader-wrapper-independent-oct30/accept.test.cjs
python3 ../ops.py inherited-pipe-cleanup /usr/bin/node --max-old-space-size=192 test/maelstrom-loader-wrapper-independent-oct30/cleanup.test.cjs
```

Evidence outside Git: task-root `e/independent-acceptance.{json,stdout,stderr}`,
`e/inherited-pipe-cleanup.{json,stdout,stderr}`, `e/node-startup.*` and
`e/inspect.*`. Both test executions returned 0 with empty stderr. The diagnostic
mutant's rejection is expected test evidence, not a rejection of the candidate.

## Limits and handoff

The synthetic diagnostics are not authentic adapter events. These probes do
not establish select/native-return/errno correctness, PE/DLL loading, guest
initialization ordering, mounted input visibility, browser or gameplay behavior.
Text triage remains conservative and unauthenticated. Process-group cleanup
covers descendants remaining in that group, not deliberately escaped sessions.
Inputs must stay immutable between validation and execution. This is targeted
adversarial evidence, not exhaustive malformed-input or race coverage.

All behavioral and Git commands ran through the task supervisor with original
inherited-parent limit topology. The startup receipt records unlimited Node
DATA/address space, CPU 60 seconds and file limit 12 MiB. Node's 192 MiB
old-space setting is not a total physical-process cap; the supervisor retains
512 MiB child-group RSS / 128 MiB parent RSS, wall, capture, allocation and
aggregate admission gates. An 8 MiB physically allocated publication reserve
remains in the 24 MiB task budget through coordinator closeout; evidence is
below 1 MiB. No runtime/Boat was allocated or acted on. Shutdown ownership
remains with the coordinator. No main integration or public deployment.

Publication SHA, exact remote branch verification, full input pins and recovery
recipe are recorded in task-root `completion-receipt.json`. The coordinator
must append `messageboard-note.txt`; direct board access was excluded by this
task's size restriction.
