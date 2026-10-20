# ShellExecuteEx selective reconciliation, 2026-10-20

The retained candidate `1274e1a9a7f8b43c714e8782e9885687b8b4ea1a` is **not
source-equivalent to current main**. Fresh remote main was
`3186dd59ca95e1e684c5c5ceb81c5ac76b11655f` (the P8 integrator had advanced
the supplied `ad171b162eec9419bf97ecaea179879264c1ec19` before admission).
The remaining work is a production source defect, not merely runtime
qualification. No historical branch ancestry is required.

Both main A/W handlers still report success without calling either launch
import. A overwrites `nShow` at +28, mistakes it for `hInstApp` (+32), and
W delegates to that stub. Main's existing W test asserts the same wrong
offset and does not initialize a valid structure. Candidate's dedicated
`test/test-shell-execute-ex.js` is absent on main. All seven production
paths changed by that candidate still lack its specific shell changes:

| Path | Remaining delta |
| --- | --- |
| `src/09a7d-handlers-shell-file.wat` | Shared A/W implementation, validation, argument conversion, actual launch, output/error/stack contract |
| `src/01-header.wat` | Seven-argument `process_spawn` import |
| `src/09d7-pipes.wat` | Ordinary CreateProcess supplies trailing `forceSpawn=0, showCmd=1` |
| `lib/host-import-sigs.generated.json` | Seven argument Worker RPC metadata |
| `lib/host-imports.js` | Matching default unsupported host signature |
| `host.js` | Honor explicit tracked spawn without per-app opt-in and pass hidden state |
| `test/run.js` | Honor explicit tracked spawn in existing VFS child route |

This branch applies only those source deltas and corrects the existing W test.
The four shell functions match the retained candidate exactly (comments
excluded by the comparison); later surrounding production changes remain.
In particular, snapshot-invalidation statements, CLI app-local DLL seeding,
and current shell command parsing remain. The generated signature is changed
by **entry name**, because the historical position-only JSON hunk can match
an unrelated import after newer imports were added.

## Semantics and transport

A valid 60-byte structure supplies hwnd/verb/file/parameters/directory/show
from offsets 8/12/16/20/24/28. W uses the existing UTF-16-to-ANSI helper;
this retains its low-byte conversion and does not establish general Unicode
or code-page support. `hInstApp` is at 32 and `hProcess` at 56.
Null/short structures fail with error 87; null file fails with 2; unsupported
namespace/class masks fail with 120; allocation failures fail with 8.

Without `SEE_MASK_NOCLOSEPROCESS`, the existing `shell_execute` route receives
the arguments. Status >32 succeeds; 0 becomes error 8, other failures retain
the host status. This does not improve the existing host's lenient success
for some unresolved bare names or shell associations.

With bit 0x40 (including observed IW mask 0x440), only default or
case-insensitive `open` is accepted. The handler quotes the executable,
appends parameters, and requests forced tracked spawn. A nonzero returned
pid maps through the existing `pipe_child_process_handle` to
`0x00e40000 | (pid & 0xffff)`. Failed spawn returns false/error 2 with a zero
handle, without a fire-and-forget fallback. Ordinary CreateProcess keeps its
existing opt-in behavior. Process-handle allocation/lifetimes are not redesigned.

Browser `process_spawn` uses the existing command parser and VFS launcher,
passes directory/parameters plus `beforeRun`, `onExit`, `bypassSingleApp`,
and hidden state (pipes or show=0). `launchVfsExe` resolves the file against
workDir, snapshots VFS, preserves parameters in an installed-app entry,
waits only for an in-flight boot and passes the same launch options to
`launchApp`. Its synchronous acceptance is not proof that the later guest
boot succeeds. `process_ctl` supplies STILL_ACTIVE, exit code, and termination;
the existing ThreadManager delegates child-handle waits to it. On normal
exit VFS merge precedes publishing the exit code.

CLI `spawnVfsChild` resolves the original VFS file, exports it and state,
passes `--args`, `--cwd`, DLL seeds and child flags to the existing fork
route, and merges VFS/registry before publishing exit status. CLI has no
window-show behavior. No fork or filesystem export was actually performed
by this review's controlled test.

## Evidence and qualification

Run from repository root:

```sh
node docs/re-notes/shell-launch-selective-review-20261020.js EVIDENCE_DIRECTORY
```

The dedicated test compiles the actual shell handlers, narrowing/string
helpers and process-handle encoder with the current vendored compiler.
Thirty A/W cases cover arguments, offsets, show=0, stack cleanup, canary,
tracked handles, launch failures, invalid structures/verbs/masks, allocation
failure and temporary frees. Baseline, removed force flag and wrong-offset
controls fail. Actual host, CLI and browser VFS launch functions run with
controlled external boundaries; removed host/CLI force checks fail.
These are new differential checks on current source, not repetitions of
historical full builds or game runs.

Sixteen unchanged source gates pass, including canonical generated import
signatures, A/W census, stack/epilogue and logical checks, region rules,
compiler provenance, browser cache graph, and test tier/timeout gates.
The final source comparison also checked remote
`a54049d11955307d06309e146e85c1aca3196657`: all 15 examined source/test/note
paths have the same blobs as the admitted main revision. The task keeps its
original single parent; the unrelated ToyVM integration is not imported.
The first publication attempt stopped at the capacity gate before staging;
fresh capacity recovered and is rechecked at publication. The new remote
commit was fetched only into the isolated repository for blob comparison.

Memory translation/range/heap boundaries are adapters; there is no full
dispatch, full build, Worker RPC execution, actual child, browser, guest,
native conformance, gameplay, audio or performance qualification. The
retained test's intended contracts were inspected; its historical full
render-harness run was not repeated.

Remaining runtime dependencies after integration are exact-build verification
of Worker argument transport and an actual original-child handoff through
both supported transports, including wait/exit/state merge. Historical IW
evidence already located the subsequent problem in cross-process named
sync/send ownership, not missing command-line text; it must not be rerun as
an argument diagnosis. Worms' later CreateProcess/`--spawn-processes` route
is distinct and cannot prove Ex integration. Existing runtime access hold
remains; no access retry was attempted.

Existing limitations include asynchronous browser boot failure, unsupported
verbs/classes/ID lists, lossy W conversion, generic failure codes,
finite pid encoding and existing close/parent-child lifetime behavior.
The browser launcher's special obsolete DirectX installer success shortcut
also cannot establish a real tracked child's lifetime. These are recorded
limits, not authorization for broad process redesign.

Evidence: `scratch/runs/20261020-shell-launch-selective-review-oct20/`.
The task branch is `task/shell-launch-selective-review-oct20`; no main
integration is performed by this worker.
