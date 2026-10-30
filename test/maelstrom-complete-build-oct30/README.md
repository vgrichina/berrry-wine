# Complete transformed historical Maelstrom module

PASS: the full `src/main.watx` include closure was freshly transformed, compiled
by the supplied vendored WATX compiler, and instantiated in Node v24.22.1
(V8 13.6.233.17-node.58) on dedicated Boat `bx_ssjeeb8p`.

All 158 manifest inputs (22,208,514 bytes: 140 original source files, 12 compiler
dependencies, three integrated helpers, three original binaries) were verified
remotely before transformation. Historical source is
`55f9724ef127100c3bb54aebca73e5cda5472c5f`; helpers are
`f8fbf6576390008ecfe974f8754e2a321ce020ef`. The 13-fragment helper input map
produced six changed fragments. No old transformed overlays were used. The VFS
retained the production include order and fresh output overrode only those
fragments. Compilation used production/standardWat, strict declarations,
tail calls, and no runtime builtins or debug artifacts.

The complete module is 1,886,773 bytes, SHA-256
`f37c0db9862159111bf38e104b163a5faf08d10dc38f8e3e28f2d85a2c45e49e`.
Its 291 imports and 2,280 exports, region layout, transformed fragments and exact
engine identity are hashed in `result.json`. Shared imported memory is 512 MiB.
Host functions throw on invocation; zero were called during instantiation.

This acceptance does not execute guest initialization, PE loading, select,
native CALL/RET or gameplay. Live select/native-return needs production loader
initialization and valid binary mappings, thread/register state, stack and host
services. Calling diagnostic exports or fabricating that state would not close
that remaining execution gap. No production code was repaired.

Measured runtime was 3.896 seconds, peak sampled group RSS 378,372,096 bytes,
supervisor RSS 190,513,152 bytes, and remote allocated disk 41,000,960 bytes
including its physical 16 MiB reserve. Runtime admission recorded over 14 GiB
available RAM against a 4,352 MiB peak projection plus a 2 GiB floor. Node heap
was 3,072 MiB; sampled physical group limit 4,096 MiB; parent 256 MiB; CPU
180 seconds; wall 300 seconds; file 64 MiB; combined output 64 KiB. DATA and AS
were unlimited for Node. Startup was too brief for the 100 ms RSS sampler;
its zero sampled peak means unsampled, not zero physical use.

The initial detached-launch CLI request combined mutually exclusive
`--timeout` and `--detach`. The CLI rejected it before remote execution. The
owned launcher was corrected to omit `--timeout`; the remote supervisor still
enforced 300 seconds. The original rejection is retained in `evidence/`.
There was exactly one transform/compile/instantiate invocation, which passed.

`boat stop` snapshots data by default. Actual state was independently verified
as stopped, snapshot completed and verified at 2026-10-30T01:10:03.333Z, stop
completed 01:10:03.966Z. No forced stop or public deployment occurred. The large
module, original inputs, complete import/export report and region map remain
in `/tmp/maelbuild` in that snapshot. Lifecycle returns to the coordinator.
The original workload cutoff was 01:25Z, handback 01:28Z, stop deadline 01:30Z,
TTL expiry 2026-10-30T01:34:00Z. Default stopped snapshot retention is 14 days.

## Recovery recipe

Do not resume or rerun the stopped Boat without a new coordinator assignment.
To recover evidence, use supported Boat API execution after an authorized
resume/fork, read `/tmp/maelbuild/complete.wasm`, `result.json`, `regions.json`,
`runtime-receipt.json`, `runtime-preflight.json`, `startup.stdout` and
`startup-receipt.json`, and verify the hashes in the committed compact report.
The complete remote `result.json` is 208,127 bytes with SHA-256
`78a0a3e4d5dcdc9637f9225f60851208ceaca36ac874b7a533eb3d324e9f1e45`.
Do not fetch that whole report or module into this task's capped local evidence.

For reproduction on a newly assigned dedicated box, preserve all task limits
and change the explicit Boat ID only under coordinator authorization. Reuse
the pinned manifest and verified standing inputs; no installation is needed.
`stage.py` runs directly under the original uncapped launch parent, imports the
task-owned `ops.py`/`limit_contract.py`, and validates owned CWD before every
subprocess. Its `stage` action validates every source pin, streams compressed
chunks directly to remote files, and verifies every reconstructed file. It
does not write a local source archive. Keep the physical 8 MiB local reserve
and 16 MiB remote reserve through publication/closeout. All commands use an
explicit owned repo working directory.

```
python3 -B test/maelstrom-complete-build-oct30/stage.py stage
python3 -B test/maelstrom-complete-build-oct30/stage.py startup
python3 -B test/maelstrom-complete-build-oct30/stage.py build
```

The startup action must pass before build. The `--detach` response is only a
launch acknowledgment; read its actual process status and the remote runtime
receipt before claiming completion. The supervisor's preflight records the
installed executable SHA-256, RAM floor and disk allocation; its child runs
the exact full-module `build.cjs`. Stop at the first genuine policy or runtime
failure and preserve diagnostics. No guest mounts are passed in this task;
`launch-configuration.json` records the empty mount argv and actual direct
staging approach. Git uses only the trusted strict SSH configuration recorded
there. `ops.py` permits the Boat CLI and Node to inherit original DATA limits
while retaining CPU, file, wall, capture, disk and physical RSS checks; Git's
256 MiB DATA cap applies only to Git subprocesses.

The committed supervisor files are recovery copies. Their ROOT is derived
from their own location; restore them to the assigned owned root alongside
`repo/`, `e/` and the existing aggregate admission file before running the
above recipe. Never import an old mutable donor supervisor or relax a guard.
Coordinator board publication remains pending via `messageboard-note.txt`;
the worker does not access the oversized shared board or release allocation.
