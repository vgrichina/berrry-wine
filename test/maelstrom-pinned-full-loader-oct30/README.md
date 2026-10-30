# Complete Maelstrom loader launch contract

`qualify.cjs` validates inputs and invokes the unchanged production `test/run.js`.
It never constructs host imports or guest registers, stack, threads or DLL state.
The runner owns `createHostImports`, `stageAndLoadPe`, `loadDlls` and guest
initialization; `lib/process-boot.js` and `lib/dll-loader.js` retain their mapping
and DllMain responsibilities. The five loader/observer source files and CLAUDE
entry point are pinned to main `a5bc63b1f393aa1fd28b82b8408643a7b30e25e9`.

The complete Wasm must be **1,886,773 bytes**, SHA256
`f37c0db9862159111bf38e104b163a5faf08d10dc38f8e3e28f2d85a2c45e49e`.
There is no build, fallback artifact or historical runner transplant. The
source-derived CLI flags are `--no-build`, `--wasm`, `--exe`, `--dlls`,
`--vfs-tree`, `--max-seconds`, `--max-batches`, `--memory-mb`, `--no-renderer`,
`--quiet-api` and `--quiet-blocks`. See pinned `test/run.js` option parsing and
its explicit DLL split. All bound options are finite; outer wall supervision
also covers initialization before the runner enters its batch loop.

## Contract tests (offline)

From the repository root, under the assigned resource supervisor:

```sh
python3 /tmp/maelstrom-pinned-full-loader-harness-oct30/ops.py contract-tests /usr/local/bin/node --max-old-space-size=192 test/maelstrom-pinned-full-loader-oct30/contract.test.cjs
```

Tests use temporary tiny files and an injected child executable receiving the
real wrapper argv. `main(argv, {pins})` is a contract-control API; any use of
this injection is permanently labeled `contract-control-only` in its receipt.
The public CLI cannot override the immutable production pins. `parse` and
`buildArgv` are available for offline launch review; `assertInvocation` checks
the final production runner, exact Wasm path and mandatory no-build flag.
Tests execute `main`, the real CLI rejection path and mutated wrapper modules,
including pin removal and no-build removal. They do not compile/instantiate
Wasm, execute run.js, initialize the guest, or qualify kernel/browser/gameplay.

## Later, separately admitted runtime recipe — DO NOT execute in this task

The complete artifact remains in stopped Boat `bx_ssjeeb8p`, snapshot directory
`/tmp/maelbuild`. Resume was denied with `api_key_action_forbidden403`. This task
does not resume, fork, create, mount, recover media or use an alternative route.
A coordinator must admit a later runtime task and provide accessible exact
inputs, a complete production dependency checkout, and a suitable runtime box.
No test depends on snapshot access.

1. Verify `pins.json`, the complete-build receipt SHA256
   `802e4bd2f4c8dea841f3e1f7a7ea0e1af8fed785512497b2ddc0cfaf8a831b5a`,
   and its artifact identity. Keep the runner source closure unchanged.
2. Obtain expected original EXE, SDL.dll, SDL_net.dll, msvcrt.dll and game tree
   identities from trusted original-media evidence. Do not auto-bless whatever
   is present on disk. Supply the exact Node executable identity as well.
3. Create an absolute-path manifest with this schema (replace placeholders with
   trusted SHA256 and byte counts; placeholders are intentionally unusable):

```json
{
  "schema": "maelstrom-loader-inputs/v1",
  "inputs": {
    "node": {"path":"/absolute/node","bytes":0,"sha256":"REQUIRED"},
    "runner": {"path":"/absolute/repo/test/run.js","bytes":692809,"sha256":"f96e9bb924700ee571e2904e097f80742ff55638399898ae1dc32454af05b02d"},
    "wasm": {"path":"/absolute/full.wasm","bytes":1886773,"sha256":"f37c0db9862159111bf38e104b163a5faf08d10dc38f8e3e28f2d85a2c45e49e"},
    "exe": {"path":"/absolute/media/Maelstrom.exe","bytes":0,"sha256":"REQUIRED"},
    "sdl": {"path":"/absolute/media/SDL.dll","bytes":0,"sha256":"REQUIRED"},
    "sdl-net": {"path":"/absolute/media/SDL_net.dll","bytes":0,"sha256":"REQUIRED"},
    "msvcrt": {"path":"/absolute/media/msvcrt.dll","bytes":0,"sha256":"REQUIRED"}
  },
  "tree": {"path":"/absolute/game","files":[{"path":"relative/file","bytes":0,"sha256":"REQUIRED"}]}
}
```

Every regular tree file must appear once. Symlinks and unlisted files are
rejected; empty directories are permitted. Limits: 4096 files, 8192 total
entries, depth 32, 512 MiB tree content, 1 MiB manifest. Streamed file hashing
uses 64 KiB buffers. Media are never copied by the wrapper. DLL and tree root
paths containing commas or outer whitespace are rejected because the runner
splits lists; comma-bearing filenames **within** the tree are preserved by
the single `--vfs-tree` argument. This launch has no mounts. Review this same
actual argv with the canonical mount parser if a later task adds any mounts.

4. Run the following only under the later task's admitted process/resource
   supervisor, after its exact-Node startup and source/path/mount checkpoints.
   Use canonical absolute executable paths (regular files, no symlinks), keep
   inputs immutable during preflight and execution, and use a fresh output dir:

```sh
/absolute/node --max-old-space-size=192 /absolute/repo/test/maelstrom-pinned-full-loader-oct30/qualify.cjs \
  --node=/absolute/node --runner=/absolute/repo/test/run.js \
  --wasm=/absolute/full.wasm --exe=/absolute/media/Maelstrom.exe \
  --sdl=/absolute/media/SDL.dll --sdl-net=/absolute/media/SDL_net.dll \
  --msvcrt=/absolute/media/msvcrt.dll --tree=/absolute/game \
  --manifest=/absolute/inputs.json --out=/absolute/new-result \
  --max-seconds=10 --max-batches=200 --memory-mb=512 \
  --wall-seconds=20 --output-bytes=131072
```

The wrapper forwards no arbitrary options. It sets a 192 MiB V8 old-space
flag; that is not a total RSS bound. The outer supervisor must retain task
CPU, file size, aggregate RSS, parent RSS and disk admission limits. The
wrapper itself bounds wall time (at most 90s), stored combined stdout/stderr
(at most 256 KiB), and receipt size (32 KiB). It starts a process group and
SIGKILLs that group on wall/output excess, parent SIGTERM/SIGINT, and child
exit to clean up surviving descendants. Use the outer supervisor for crashes
or SIGKILL of the wrapper itself. No shell evaluates user paths.

## Evidence semantics

`child.log` preserves bounded raw bytes. `receipt.json` records the exact
argv, manifest hash, exit/signal, supervision reasons and status:

- `invocation_failure`: validation/spawn failure or a supervision limit/signal.
- `loader_or_diagnostic_rejection`: nonzero child exit, child signal, or a
  conservative error/rejected/disabled/trap/failed marker in captured output.
- `runtime_observations_unqualified`: child exit zero with no such marker.

Nonzero child codes propagate through the CLI; other failures exit 2. Exit 0
only means bounded launch completed without a detected error. Log-marker
classification is conservative text triage, not an authenticated observer
oracle. A disabled frozen-record adapter or initialization error is a rejection
even if the child later exits zero. Missing diagnostic events remain
unqualified. Event-schema text is reported for inspection; even present text
cannot qualify select/native-return/errno. The pinned runner has no Maelstrom
adapter wiring, so authentic observer qualification is still OPEN and may
require a separately authorized production change. No acceptance can be
inferred from absent diagnostics, arbitrary JSON, or a clean child exit.

The receipt's `guestAcceptance` is always false and `runtimeQualification`
always OPEN. This source task does not claim real loader initialization,
native-return, select, errno, browser, kernel or gameplay acceptance.
