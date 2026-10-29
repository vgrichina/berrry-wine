# Integrated combined backend: mounted CLI counterexample

**Qualification failed; stop after case 1.** On 2026-10-29, the exact production
`qualify_accounted.py` CLI at candidate `dcbe956bb403509f531b059c6822a1dcacd9fa59`
mounted the integrated pinned backend on task Boat `bx_pfvpxxu2`. The prescribed
1024-byte positive fixture did not execute: child Python reported
`can't open file '/tmp/tvcm/fixture.py': [Errno 1] Operation not permitted`.
CLI exit was 1, child exit was 2, `accepted=false`, and the marker was absent.
No repair or second behavioral invocation was attempted.

The independent observer captured `/tmp/tvcm/work/domain` as
`fuse.toyvm-accounting`. The authoritative backend reported `failure=null`,
`written=0`, `live=4096`, `peak=4096`, and no open handles. These are startup
observations, not successful payload accounting or quota rejection evidence.
The caller reported complete cleanup, unmount exit 0, no remaining mounts,
and server exit -15. The observer found no surviving observed process identities
or remaining mounts after CLI exit.

All five accepted source hashes and the immutable cancellation receipt and
fixture hashes matched remotely before execution. Python's executable hash also
matched. `/dev/fuse`, libfuse3, fusermount3, Landlock ABI 4, seccomp query and
required proc facilities were available. Exact CLI argv, authoritative receipt,
decoded child output, process observations and mount evidence are retained in
`case1-result.json` and the untruncated API envelope `case1-api.json`.

The attempted limits were live/write/file 8192 bytes, RSS 67108864 bytes,
CPU 10 seconds, wall 20 seconds and output 8192 bytes, using the original receipt
and an absolute fixture and domain target. Independent short socket paths and
fresh empty absolute work directories were checked. The original receipt was
unchanged after the invocation.

Case 2 (COUNT 9000) is **not run**, following the required stop on the first failed
case. Successful mounted CLI acceptance, intended quota rejection, payload
accounting, and marker execution remain unqualified. The exact cause of the
fixture-open denial was not diagnosed here. No exact quota errno or simultaneous
measurement is inferred. No browser, game, guest, retained acceptance group,
source repair, main integration or deployment was performed.

`recipe.json` preserves the actual supported Boat API command arrays, including
the seven exact file transfers, production invocation observer and its resource
controls. It is a record, not an instruction to retry the denied fixture.
`verify_evidence.py` checks the retained counterexample without mounting or
executing any workload. One preparation-only AST display failed because
`MAX_LIMITS` is a `dict(...)` call; changing the display to `ast.unparse` completed
preflight without executing production behavior. That first sample is retained.
The unchanged empty game mount argv receipt was revalidated against the canonical
parser excerpt; native FUSE is mounted by the pinned backend, not that parser.

The task explicitly delegated snapshot-stop to this worker. See `lifecycle.json`
and `boat-stop-status.json` for the verified closeout. Raw operation records remain
separately under `/tmp/toyvm-integrated-combined-mounted-cli-oct29/e/`.

Procedural limitation: initial read-only policy and parser-location discovery
used direct shell tools, with explicit cwd omitted on some reads. All Git,
Boat and behavioral operations used the prescribed task supervisor and owned
repository cwd. No Git operation ran in the shared root or a donor.
