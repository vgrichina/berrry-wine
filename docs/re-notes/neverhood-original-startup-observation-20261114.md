# Neverhood original startup observation — 2026-11-14

The fresh canonical original-CD route stops **before SETUP95's entry point and launcher dialog 115**: the selected real `COMCTL32.DLL` initializer calls **ThunkConnect32**. An observation guard throws before the existing unconditional TRUE handler executes. This is an observed unsupported dependency boundary, not a launcher screenshot, completed installation, or gameplay result. No Install input was sent.

Evidence: `scratch/runs/20261114-neverhood-first-frame/result.json`. Read this together with the [first-dialog notes](neverhood-original-setup95-first-dialog-20261113.md), [installed asset contract](neverhood-original-installed-asset-contract-20261113.md), and [thunk boundary](neverhood-thunk-kernel-loader-boundary-20261113.md). Unlike the earlier static analyses, this task executed original dependency instructions in the emulator.

## Original media and route

The authorized complete image was downloaded with finite curl limits and an independent supervising deadline to reusable `scratch/media/neverhood-original.iso`, outside the run directory. Its size is **651438080** and full SHA-256 is **94de724bb47eb2aa588ac4eff28ddc6fd10edebcf2be4dd131ef76875ef5ffd3**, matching the owner pin. Recovery is the original URL `https://archive.org/download/neverhood_202508/Neverhood.iso`, followed by exact size/full-hash admission. No other package or demo was used. `media-members.json` records independently read full hashes for SETUP95, NHC, matching Smackw32, DSETUP, DSETUPE and DSETUP6E; the established original hashes agree. No extracted media tree is retained.

The CLI command is retained verbatim in `launcher-watchdog.json` and `boundary-confirm-watchdog.json`. Its core is:

```sh
node -r ./scratch/runs/20261114-neverhood-first-frame/stop-before-stubs.cjs \
  test/run.js --iso=scratch/media/neverhood-original.iso --iso-drive=D \
  --iso-exe=SETUP95.EXE \
  --overlay-dir=scratch/runs/20261114-neverhood-first-frame/guest-overlay \
  --no-build --no-close --spawn-processes --quiet-api \
  --trace-api=ThunkConnect32,DirectXSetup,LoadLibraryA,GetProcAddress,CreateDialogParamA,DialogBoxParamA \
  --control=18114 --frozen --max-seconds=30 --max-batches=10000 --batch-size=10000
```

The first attempt had a 180-second CLI guard and 480-second independent deadline; confirmation had 30/90 seconds. Both exited in under one second. The canonical ISO route selected the original `setup95.exe` bytes, reporting PE entry **0x0040d090**. Import initialization failed before the later VFS ISO-mount/controller stages. Thus **D: was requested independently but its live mount was not reached**, and the isolated writable overlay was never created. No registry, installed HD.BLB, OS version, original instructions, or dependency return was seeded or patched. The matching Smacker remains on the complete original CD, unused at this early boundary.

## Actual first boundary

The normal DLL registry selected `test/binaries/dlls/comctl32.dll` (577808 bytes; exact SHA-256 in `additional-inputs.json`). Runtime loaded it at **0x00535000**, original preferred base **0xbfc00000**, and called DllMain at **0x0054f1cd**. During that initializer, **ThunkConnect32** was invoked with EIP **0x005615d2**, ESP **0x074fffcc**, and EAX **0**. The confirmation records the entry stack in `unsupported-boundary.json`, including return address **0x0054f1e6**, module argument **0x00535000**, and process-attach reason **1**.

The adapter wraps the existing WebAssembly host `log` import before instantiation. WAT normal API dispatch calls that import before loading arguments and dispatching the handler. On exact `ThunkConnect32` or unsuffixed `DirectXSetup`, it records the boundary and throws; it never writes guest memory or return registers. API tracing keeps that import enabled. This deliberately exposes the missing operation instead of allowing the known TRUE/zero success stubs. The thrown observation error is therefore **not** an original installer error dialog or a demonstrated unguarded emulator trap. The loader subsequently reports `DLL initializer did not return: module=0x535000` and exits 1.

This boundary is earlier than the previously decoded original DSETUP/DSETUPE Install path. No bypass using a forced host COMCTL32 replacement was attempted. The log also warns that configured real `shell32.dll` and `ole32.dll` are absent locally; those remain separate unresolved dependencies, not the first observed failure. Neither installer code nor DSETUP was reached.

**No PNG exists.** The planned `launcher115.png`, `after-install.png`, and `first-boundary.png` were declared in the early result metadata, but rendering/control setup and even the final PNG path were not reached after import-initialization failure. No synthetic error image was substituted. Launcher, installation, first room, input and gameplay remain unobserved.

## Build and shared WIP

The canonical source build passed using both required locks: `flock /tmp/wine-heavy-runtime.lock flock /tmp/wine-build.lock bash tools/build.sh`; see `build-integrated.log` and exit 0. Tested Git revision was **4c181f3bc0787518c350b94a26d6ea890bd41a96**, plus the retained WIP patches. The wasm SHA-256 was **a0ca1445a9c46f4ae1721ca2610c56276d4bacb6132c543000dbc060500208bd**. `build-identity.json` pins Node, runner, region map, module and relevant host/census inputs. Concurrent intervening commits were documentation-only for these inputs.

Initial full builds exposed stale callback census hashes, three SDK `.x` file sizes, and two DOS browser bundles. Exact paths were claimed before editing. Complete existing host shutdown/startup and thread-exit diffs were reviewed; census hashes/reasons were updated while retaining `ownership: pending`. Three actual file sizes were refreshed, and the existing public DOS bundler regenerated both outputs. Focused host lifecycle/census, thread-exit, DOS FCB/flags/palette/CD/MZ-loader/floppy/runner/browser-bundle, and app-size regressions passed under the heavy lock where appropriate. Logs and explicit exits are retained; an initial focused invocation failed against the old census and its subsequent invocation passed after reconciliation.

These **four build-dependency paths remain uncommitted WIP**: `tools/callback-ownership-census.json`, `lib/app-file-sizes.generated.js`, `docs/dos-corpus/live/toyvm-bundle.js`, and `docs/dos-corpus/live/toyvm-jit-bundle.js`. Their production inputs include other workers' uncommitted and new source files. This task publishes only this observation note; publishing the generated outputs independently would detach them from their source changes. Existing WIP is preserved. Relevant tracked changes are in `tested-source.patch`; required new source/test files are recoverable from `relevant-new-files.patch`. Generated bundles are recovered by the recorded bundler command and pinned hashes, without retaining their large one-line diffs, wasm dumps, or source archives.

## Exit and next work

Confirmation child **3150133** was actually waited with exit **1**, both stdout/stderr pipes reached EOF, and its 90-second independent watchdog did not fire. The initial child **3148153** also exited 1 and was waited. The separate watchdog control actually terminated/reaped a sleeping child at its deadline (exit -15). All task-observed child PIDs are absent; port 18114 is closed. Both automatically staged `/tmp/wine-iso-*` original EXEs were hash-verified before removal. `cleanup.json` records no overlay, no screenshots, and more than 15 GB free at cleanup. No box was created: ID none, state NOT_CREATED, expiry null, stop receipt N/A.

Next work is real ThunkConnect32 behavior for the **actual canonical COMCTL32 process-attach caller**, with its original companion/lifecycle obligations and focused tests. Existing Win9x/NE gaps must remain explicit. After that, repeat the same original ISO route, review fresh dialog115 pixels/focus, and only then send a balanced ordinary Install click. Do not promote this pre-entry boundary to installer UI or gameplay.
