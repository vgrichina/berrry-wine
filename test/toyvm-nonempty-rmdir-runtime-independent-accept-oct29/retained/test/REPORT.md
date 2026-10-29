# Failed nonempty RMDIR runtime acceptance

SCOPED_ACTUAL_RUNTIME_ACCEPTED on candidate `5a88ca099b962e946160afd2d4d71a950bf46db3`, with all five production sources unchanged. Exactly one production CLI invocation ran through supported Boat API exec.

The unchanged fixture created D/E, observed inode identities 2/3, and received actual ENOTEMPTY (39) from rmdir(D). Both remained directories with the same identities. CLI exit 0, accepted true, stopReason null and filesystem failure null. Post-reap live and peak were 12288, written 0, inodes 3 and openHandles 0. These counters do not assert instantaneous observations.

The pinned observer confirmed its sampled PID/start identities were absent or reused, matched production-owned identities, and found no remaining FUSE mount. Production cleanup completed; external 8-second safety cleanup did not run. No additional runtime invocation, oracle adjustment, production repair or browser execution occurred.

Boat bx_27q3w7ee was snapshot-stopped under explicit task delegation and verified stopped, with a new verified snapshot after the stop request. Original expiry was 2026-10-29T06:00:38.936Z. See canonical.json and raw API lifecycle evidence.

Source/fixture/offline gate and dispatch preflight receipts were reused unchanged. All nine staged text files were reverified at their actual remote execution paths before the attempt. Staging used Boat new --file; there were no filename-bearing guest mount arguments. The observer also verified production source and installed executable identities at execution. The supplied quota and resource limits were unchanged. Per-operation local admissions retained parent soft DATA128/original hard, Python128/Git256 child limits and the task supervisor controls.

Original allocation parser failure is retained: Boat new emits JSONL, and the local whole-document parser rejected it after allocation succeeded. The recorded response supplied the box ID without any provider retry. The driver now parses that same JSONL format. Git status exited zero with alternate-store nesting warnings; original diagnostics are retained. Neither incident changes the runtime oracle.

See raw-manifest.json for bounded raw API, CLI, identity, mount, admission and lifecycle evidence; canonical.json binds outcome and pins. Publication remains task-branch only. Coordinator owns the oversized root messageboard append using the owned coordinator-note.json. This is scoped filesystem acceptance, with independent integration review still required.
