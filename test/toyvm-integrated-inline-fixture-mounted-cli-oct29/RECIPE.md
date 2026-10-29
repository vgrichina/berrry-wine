# Exact bounded recipe (not authorization to replay)

Use the five production files identified by `source-pins.json`, retaining their
relative paths beneath `/tmp/tvic/repo`; verify every hash and the Python pin
from `preflight.json`. Supply the original cancellation receipt with SHA256
`543b076948699e1607179782b472f4863125064cdfa3a4632351e8a1f6ed7870`
at `/tmp/tvic/cancellation-receipt.json`. Preserve the 170-byte `fixture.py`
without edits. The observer stores the actual argv and receipt.

The original task used its provided local `ops.py` for all post-bootstrap
subprocess operations, admission/limits and trusted Git configuration. Boat
creation used ttl1800 and supported `--file` transfers; remote execution used
`boat exec BOX --timeout 40 -- /usr/bin/python3 -B /tmp/tvic/observer.py preflight`.
Only after preflight succeeded, the same supported API ran observer `case1`
with timeout60. The observer's `case()` builds the exact pinned production CLI
argv, using `fixture.read_text()` as ONE value after `-c`, without shell
interpolation. Work was fresh and empty, socket path 26 bytes.

Case 1: live/write/file limits 8192, RSS67108864, CPU10, wall20, output8192;
target `/tmp/tvic/work/domain/f1024`, count1024. Require accepted=true,
completion marker and authoritative cleanup. The real run failed this oracle.

Case 2 was conditional on case 1 passing: same limits, new empty
`/tmp/tvic/reject`, target `/tmp/tvic/reject/domain/f9000`, count9000. Require
intended authoritative quota rejection and cleanup. It was never executed.

On the first unexpected result, retain the counterexample, stop runtime work,
snapshot-stop the explicitly delegated task box and verify stopped/snapshot
state through `boat info`. No unchanged replay, repaired source or altered
limits are part of this recipe. See REPORT.md for the concrete blocker.
