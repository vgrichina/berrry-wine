# ToyVM accounted qualification caller wiring

Source wiring on base `0e2f5f623e77f60f9d774f25dff4449aea8931ad` only.
`qualify_accounted.py` is the maintained caller for the accepted restricted
`supervise_accounted.py` entry. It verifies that adapter, confinement helper,
FUSE backend and immutable supervisor before importing the adapter. It forwards
argv, work directory, synchronous accounting selection and every explicit quota
and resource limit. It neither runs the pinned supervisor as a script nor uses
the historical polling/browser entry. No accepted backend source changed.

The caller requires the exact retained cancellation receipt, SHA-256
`543b076948699e1607179782b472f4863125064cdfa3a4632351e8a1f6ed7870`.
Its historical results remain unchanged. Browser execution is always rejected,
`browserAllowed=false`. Original browser allowance remains **35.353183 CPU
seconds, 101.495550694 wall seconds, one capture**. Fixture limits and execution
do not reset or spend that browser invocation allowance.

Only the explicit `tiny-fixture` domain delegates to the accepted adapter.
The domain is a caller contract, not executable-name inference or permission to
run a browser with a different label. The unchanged tiny-fixture confinement
policy remains mandatory. Live/write/file quotas are each at most 1 MiB;
RSS at most 128 MiB, CPU 90 seconds, wall 120 seconds, retained child output
64 KiB. Each limit must be supplied explicitly and may be smaller. A fresh
empty owned work directory is required. The caller adds no syscall, mmap,
network, descriptor or filesystem policy exception.

Acceptance distinguishes child success, authoritative accounting acceptance,
and cleanup. A zero child exit cannot override a backend failure latch, quota
violation, supervisor stop, incomplete/missing receipt, open handle, failed
unmount, abnormal backend termination or missing child-tree cleanup. Resource
receipts must also be present, finite and within the forwarded limits. Exceptions
retain the backend's filesystem cleanup receipt; an unmount receipt alone does
not establish child-tree reap. Child output bytes are retained as base64 in the
JSON report. The accepted supervisor's child output combines stdout/stderr;
this caller does not claim a new stream-separation guarantee for that backend.
Task operation and injected fixture stdout/stderr were captured separately.

## Verification

Run from this repository with the retained receipt available:

```sh
python3 -B test/toyvm-bounded24-caller-wiring-oct28/test_caller.py \
  /home/user/wine-assembly/scratch/usage-watch/toyvm-capture-cancellation-qualification-oct28/receipt.json
```

25 checks passed. First behavioral check exercised real `main` -> exact pinned
loader -> accepted adapter, stopping at intercepted filesystem-server creation
before any mount or child. Then injected bounded backend/child fixtures verified
exact argv/work/limit forwarding, browser and unknown domain rejection before
backend setup, missing/wrong retained receipt, failure authority over child exit
zero, missing accounting/cleanup/resource receipts, handles/mount/unmount/backend
termination failures, output/resource limits, source-pin rejection and exception
cleanup. Two fixture children ran: one exited zero; the exception fixture child
was terminated and reaped, with stdout/stderr retained. No production child ran.
The mutation removing the filesystem failure latch was detected specifically
by `backend-failure-overrides-child-zero` (exit 1).

The accepted 8 real-kernel checks and inherited 18+13 groups are reused without
replay from canonical integration and cancellation receipts under
`scratch/usage-watch/`. The coordinator verified all 15 accepted source pins and
119589-byte integration evidence archive; its 140 internal members were verified
by the predecessor worker. This task does not claim to rehash that archive.
The new caller's four dependency pins and dispatch's three explicit inputs were
verified here. Changed closure: this caller, its tests, this report and recovery
instructions only. Retained dependency files remain unchanged and sibling-relative.

## Remaining gate

Independent acceptance of this caller delta is required before integration.
Browser runtime qualification remains open: independent production syscall,
descriptor, profile-accounting and lifecycle acceptance is required, preserving
the original cumulative allowance above. Neither fixture injection nor the prior
8 kernel checks qualifies a browser/profile/production workload. No FUSE mount,
browser, guest, build, new Boat, main push or public deployment occurred here.
No box is assigned to this source task; lifecycle ownership remains coordinator's.
The oversized messageboard is not written by this worker. The bounded publication
note and canonical receipt are handed to the coordinator for one append.
