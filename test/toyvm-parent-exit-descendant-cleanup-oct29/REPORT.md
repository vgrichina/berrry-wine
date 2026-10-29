# Parent-exit descendant cleanup: blocked before runtime

The requested distinct-session fixture cannot run under candidate
`5a88ca099b962e946160afd2d4d71a950bf46db3` with its unchanged confinement policy.
The CLI uses the synchronous FUSE adapter, which runs `confine.py` before executing
the fixture. That x86-64 seccomp allowlist excludes `setsid` (syscall 112), and its
default action returns EPERM. It also excludes `getsid` (124) and `getpgid` (121).
The local system syscall header establishes these syscall numbers; the test reads
that header and parses the exact pinned policy without importing/executing it.

Immediate descendant cleanup on parent exit is accepted as the supported contract.
This finding does not challenge that decision. It is a separate prerequisite:
the required child cannot first establish its distinct ordinary session.

Stopped at this first decisive source-contract blocker. No source repair, fake
backend, confinement bypass, alternate fixture, or production invocation occurred.
No Boat was allocated; no lifecycle resource needs shutdown. The one production
invocation remains unconsumed. Browser allowance remains CPU 35.353183 seconds,
wall 101.495550694 seconds, one capture. Prior passing runtime cases were not repeated.

No lifecycle acceptance is claimed: actual CLI exit/reason, workload truncation,
authoritative final FUSE receipt, descendant termination/reap and final connected
mount/PID-start absence are all unobserved in this task. Full-game, browser, and
whole-invocation controls remain outside acceptance. An authorized follow-up needs
a source/fixture contract permitting the requested session transition; this task
does not authorize that implementation change or consume runtime to demonstrate
an already decisive static denial.

Validation: `python3 -B test/toyvm-parent-exit-descendant-cleanup-oct29/check_contract.py`
from the task-owned repository. Canonical receipt and bounded per-operation records
are retained in the task-owned `e/` directory. Allocation remains reserved through
coordinator closeout. Publication-note.txt is for coordinator board delivery.

Procedural limits: early read-only policy inspection used shell DATA/CPU/file caps,
before the task-owned physical-RSS/subprocess supervisor was installed. One combined
inspection exceeded the 8192-byte terminal target, and one mistaken binary excerpt
was rendered/truncated by the tool. These are retained limitations, not compliant
whole-invocation control evidence. Later supervised operations record physical RSS,
120-second wall, 2 MiB capture and fresh aggregate disk/RAM admission. No acceptance
claim relies on those initial inspections.
