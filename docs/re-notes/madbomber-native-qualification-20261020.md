# Mad Bomber native WinMM qualification — 2026-10-20

The canonical build and unchanged public-API fullVM fixture pass on exact
`origin/main` **`ee139a0947c82e3a8eba4920508cb760d99882f5`**, including its merged
JS COM integration. One original Mad Bomber launch confirms that the prior
`waveOutGetErrorTextA` lookup now succeeds and **SDL.dll DllMain returns 1**.
Startup then stops in **SDL_mixer.dll**, whose initializer returns 0 after
`midiStreamStop` resolves to zero. No repair, second launch, gameplay, audio,
SDL_Init success, or screenshot qualification is claimed.

This task changes only this report. Implementation `7fd352855` was already
merged; review `fe540cf2f` and original caller evidence `f75d53311` were read,
not repeated as source review. No production code, WinHelp fixture/source,
JS COM code, shared HEAD/index, laptop Heroes II/Warcraft III, or main branch
was changed.

## Exact native execution

Runtime: `bx_6czhvg6m`, Linux x86-64, Node **24.18.1**, V8
**13.6.233.17-node.50**, default Node compilation tier (not explicitly forced).
Pinned engine path:
`/home/user/.nvm/versions/node/v24.18.1/bin/node`.
Engine and dependency lock SHA-256 values are retained in
`recovered/engine-dependencies.sha256`.

A separate `/home/user/madbomber-native-fullvm` tree contains **6,438** Git
blobs pinned to the tested revision. Unchanged files were copied from
`/home/user/callback-native-fullvm`; eleven changed/new files came from exact
Git objects. Every selected blob was verified before build and after execution.
The prior tree, its builds, and all prior Army/callback/ICM evidence remained
untouched. Dependencies use the existing callback tree's `node_modules`.

Executed once:

```sh
cd /home/user/madbomber-native-fullvm
timeout --kill-after=10s 600s bash tools/build.sh
timeout --kill-after=10s 150s node test/test-wave-error-text-native.js \
  --wasm=build/wine-assembly.wasm \
  --sha256=5e66c75862052b13b73f80bdcbcd67a1a65fd99d3e9e79d33f96548d00cc2a21
```

Both exit **0** (`cmd_6rzgkkjytwh9`, 12:59:01–12:59:24 UTC).
The canonical build ran its normal gates without overrides and produced the
1,875,192-byte tail-call module with the SHA-256 above. It also built a compat
module; **the compat module was not executed**.

The existing fixture uses the exact production module, real host imports,
an x86 PE fixture and public LoadLibraryA/GetProcAddress dispatch. Passing
coverage comprises:

- Distinct A/W exports, stdcall stack cleanup, and unchanged LastError.
- All 26 recognized errors (0–21 and 32–35); matching ANSI/UTF-16 text.
- Capacities 1, 2, 7, 256 and UINT_MAX, truncation, NUL termination and canaries.
- Unknown errors 22, 31, 36, 64 and UINT_MAX returning 9 without buffer mutation;
  non-null zero-capacity calls returning 0.
- Null buffers returning 11, including null/zero precedence.
- ANSI and UTF-16 output crossing deliberately noncontiguous guest backing
  pages allocated through public VirtualAlloc, with successful VirtualFree.

This is actual fullVM execution, not the earlier host/source-only checks.
Arbitrary invalid non-null guest pointers, Windows localization, and audio
device operation remain outside the fixture's claims.

## One original startup observation

The remote closure inventory initially lacked all 141 game/dependency files.
All **140 original release files plus msvcrt.dll** were found locally and
matched the prior caller manifest's SHA-256 values. They were copied into
`/home/user/madbomber-native-assets`, separate from previous artifacts.
All 27 boot assets also matched the prior manifest. Before launch, all
**168 closure pins**, source blobs, build/native exit results, and the module
hash were verified. There were **no missing paths at launch**.

Command `cmd_gbuwwxcab9mu` executed one guarded controller at 13:01:20 UTC.
`recovered/original/launch.json` contains the full exact argument vector:
original EXE and DLLs, explicit VFS mounts, `--no-build`, the tested module,
cooperative scheduling, no player input, API tracing, and
`--max-seconds=10`. The controller retained the prior 15-second graceful /
25-second hard deadlines, a 2-GiB disk floor, 8-MiB log cap, 16-MiB output cap,
exclusive lease, and process-group cleanup.

Reviewed current log evidence:

- SDL.dll loads at `0x00b23000`; DllMain `0x00b5a130` returns **1**.
- API #565 resolves `waveOutGetErrorTextA` to **`0x07504c80`**, returning to
  `0x00b5a275`. The earlier original run resolved that same import to zero.
- SDL_image.dll DllMain also returns 1.
- SDL_mixer.dll loads at `0x009da000`; DllMain `0x00a21b60` returns **0**.
- API #707 resolves **`midiStreamStop` to zero**, returning to `0x00a21cb9`,
  followed by `DLL_PROCESS_ATTACH returned FALSE: module=0x9da000`.

The next concrete blocker is that missing SDL_mixer import. Its causal
instruction sequence was not independently disassembled in this task.
The original child exits **1**, with no guard reason, 331,134 log bytes and
48,170,160,128 minimum free bytes. The controller itself exits 0 because it
successfully records and cleans up the failed child; that is **not** a game pass.
The loader emits multiple initializer lines within this one process; no second
controller/game launch occurred. Startup ended before any PNG was produced.

## Evidence, preservation, and recovery

Self-contained local evidence:
`scratch/runs/20261020-madbomber-native-qualification/`.

- `receipt.json`: final outcome, source/module identity, commit and remote ref.
- `recovered/build.log`, `build.exit`, `native.log`, `native.exit`,
  `environment.json`, `module.sha256`, and `wine-assembly.wasm`.
- `source-manifest.json`, `source-delta.tar.gz`, `prepare.py`,
  `stage-remote.py`, and `execute.sh`: exact-source staging/build recipe.
- `original-assets.tar.gz`, `original-closure-required.json`,
  `local-closure.json`, `prepare-original.py`, `original-once.py` and
  `recovered/original-closure-verified.json`: original recovery recipe and pins.
- `recovered/original/`: exact launch, full log, terminal and pre/postflight.
- `prior-original-*`: clearly labeled historical caller evidence, separate
  from this task's current-main execution.
- `recovered/prior-artifacts.json`, `verification.json`, `SHA256SUMS.json`,
  local `verify-evidence.py` and `SHA256SUMS.local.json`.

The recovered archive has SHA-256
`a1a01b9aa035bca64dff4febd5bb9557c8acc1bd8e8885fe31d00ac29519e511`.
All 25 recovered artifact hashes verified locally. Remote postflight
`cmd_x3ecqjpwmpjl` verified all **13,789 prior files** unchanged, all 6,438
staged source identities, absent child/controller processes and lease.
Runtime was released at **13:01:58 UTC**, left running with its 15:53 UTC TTL.
No further runtime execution occurred.

Recovery does not require ignored binaries from Git: the local evidence
archive retains the actual module; the original-assets archive retains the
verified game closure; `prepare.py` plus its pinned revision/manifest/delta
describe source reconstruction. Reuse dependencies with the recorded lock
hashes and Node version. A fresh attempt is a separately assigned task.

The sparse report-only worktree is `/tmp/wa-madbomber-native-oct20`, branch
`task/madbomber-native-qualification-oct20`. Local task expansion remained
under 20 MiB and free disk above 2 GiB plus the 60-MiB concurrent reserve.
No public deployment, workers, old denied-runtime retry, or merge occurred.
