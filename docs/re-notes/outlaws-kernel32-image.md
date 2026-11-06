# Readable native KERNEL32 image

## October 18 restoration

Restored against `dddfa4d6a86bd5ce2cb849808e523abf34d3868f`, after reviewing
historical implementation `5069c3f18`, guest hint/name correction `12708f0c4`,
file-count correction `c384183ec`, and validation receipt `fb37ac0c5`.
Historical runtime receipts do **not** validate this restored source.

`GetModuleHandleA(NULL)` retains the EXE identity. Native KERNEL32 has its own
process-owned heap image, published under `DLL_LOAD_LOCK` only after all PE
headers, export tables, names and executable JMP entries are initialized.
`GetProcAddress` resolves that same image, so an EAT walker and a named lookup
receive the same entry. Export thunk records hold guest RVAs pointing to a
two-byte hint followed by the complete API name, including in sparse memory.
Explicit loads have independently counted references; draining those refs
does not unmap the process module. Loading a new PE clears the old identity.
Real mapped DLL precedence and missing-private-path rejection are preserved.

The 458-entry ownership manifest is the historical explicit surface, not a
new claim that every process API belongs to KERNEL32. Its named ordinals are
emulator ABI; legacy ordinals retain their explicit assignments. The generator
resolves IDs against **current** `api_table.json`. The region mirror is freshly
generated for current declarations. The image builder and generated section
live in `08-pe-loader.wat` to preserve the compiler's source-file budget.

Ordinals 35/36/37 and `QT_Thunk` remain absent. No silent success handlers,
guest LoadLibrary16 wiring, NE lifecycle adapter, or QT register/stack ABI is
added. Original PMPRO62F requires those later stages. The 31 original
payload records are not needed for the deterministic tests below; acquisition
and verification are owned by a separate task.

## Validation status and next commands

Source-only checks passed: generator regeneration/staleness and five invalid
manifest controls, JavaScript syntax, WAT balance/labels, manifest membership,
region declarations/owners/mirror, raw-address and embedded-WAT gates, and
`git diff --check`. No canonical build, Wasm test, guest or browser has run for
this checkpoint. The tiny tests also instantiate Wasm and remain deferred.

After an explicit runtime grant and independent idle/disk preflight, run in
the candidate checkout, retaining logs and module/map hashes in a fresh run
directory. These are the next test commands, not an admission controller:

```sh
timeout --kill-after=5s 180s bash tools/build.sh
timeout --kill-after=5s 60s node test/test-kernel32-image.js
timeout --kill-after=5s 60s node test/test-kernel32-image.js --sparse
```

Generate a deterministic fixture (pure JS) into the fresh evidence directory:

```sh
node -e 'require("fs").writeFileSync(process.argv[1], require("./tools/kernel32-native-fixture").makeFixture())' /ABS/RUN/kernel32-fixture.exe
sha256sum /ABS/RUN/kernel32-fixture.exe build/wine-assembly.wasm lib/region-map.generated.js
```

Then substitute the observed fixture hash and run each arm separately:

```sh
timeout --kill-after=5s 75s node test/test-kernel32-image-candidate.js --wasm=build/wine-assembly.wasm --fixture=/ABS/RUN/kernel32-fixture.exe --fixture-sha256=HASH
timeout --kill-after=5s 75s node test/test-kernel32-image-candidate.js --wasm=build/wine-assembly.wasm --fixture=/ABS/RUN/kernel32-fixture.exe --fixture-sha256=HASH --sparse
timeout --kill-after=5s 180s node test/test-process-memory-hooks.js
timeout --kill-after=5s 180s node test/test-dll-lifecycle-real-pe.js
```

The full-module tests cover simultaneous publication, 64 balanced references,
actual EAT-JMP native execution and complete dispatch names, stdcall cleanup,
EXE exports, system/private paths, and process reload. The hook test covers
both readable PE entries and native thunk descriptors. The historical native
controller is deliberately not restored: it pins obsolete external modules
and unrelated historical paths. A current admitted run must seal its actual
inputs and retain process cleanup evidence. Browser behavior, original game
launch, gameplay, audio and FPS remain unvalidated.

## October 18 granted runtime result

Source `22422c7940b278633e0bcd9aa27439d276e9dd18` passed the canonical build,
both tiny direct/sparse tests, both full-module concurrent direct/sparse tests,
the process-memory hook suite, and all four real-PE lifecycle cases
(`no-threads-final`, `no-threads-outstanding`, `threads-final`,
`threads-outstanding`). No production fix or test relaxation was needed.
The first build attempt stopped because the sparse checkout omitted tracked
fonts; adding `fonts` to that checkout made the second build pass.

Tested module SHA-256:
`05a194de503daa160a5ee69053c8614ddee4a1ae09e11a2bb950e44843de72ca`.
Matching map SHA-256:
`8a27d3ea0da7fbfcb6f96c91ef590a2a20a568a68aa068594322026b3b203478`.
Evidence is retained in `scratch/runs/20261018-outlaws-kernel32-restored/` in
the shared repository: `receipt.json`, both build logs, all test logs/statuses,
four lifecycle case logs/results, exact fixture, candidate module/map, physical
source hashes and before/after process inventories. Rebuild from the source
commit with its tracked fonts and `/tmp/wa-outlaws-local-deps/node_modules`
dependencies; the deterministic fixture recipe above reproduces its bytes.

Postflight verified every prior source/preserved integration-module/original
payload pin unchanged, all lifecycle child PIDs absent, only the six exact
pre-existing infrastructure Node processes present, and 2,672,689,152 bytes
free (above the 2 GiB floor). The dependency symlink was removed and the
worktree was clean before recording this receipt. No original game, browser,
main merge or deployment ran. This validates the readable-image stage only;
guest LoadLibrary16/GetProcAddress16/FreeLibrary16 and QT remain separate work.

## Root causes found during the October 15 attempts

(Recovered from branch commit fb37ac0c5, Oct 2026.)

- **Name-pointer hint offset.** `win32_dispatch` reads a thunk's name at
  `image_base + record + 2` then `g2w`s it. The first builder copied the
  dynamic GetProcAddress backing-offset idiom without the two-byte hint, so
  `_hread` decoded as `read`, and sparse backing would have been translated
  twice. Fixed by writing a zero hint before each name and storing a guest RVA;
  `test-kernel32-image.js --sparse` is the negative control. The generic
  GetProcAddress backing-offset path was not audited.
- **Worker fixture exiting early.** A Node Worker awaiting only an
  `Atomics.waitAsync` callback has no live event-loop handle and exits 0
  mid-operation; the fixture keeps an interval alive until done.
- **Cooperative FreeLibraryAndExitThread exit code (may be stale; all four
  lifecycle cases passed on Oct 18).** The CLI serviced yield 5 via async
  `handleLoadLibraryYield` outside `runSlice`; `finishDllUnload` →
  `exit_thread_after_dll_unload(73)` → `ThreadManager.exitThread` records the
  code only for `_runningThreadHandle`, which is 0 outside the scheduler, so the
  thread exited 0. The same failure reproduced on the historical module.
