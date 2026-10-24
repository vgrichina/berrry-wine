# Enigma: quiet filesystem diagnostics without hiding failures

The runner now supports `--quiet-fs`. Combined with `--trace-api`, it disables
the incidental per-ReadFile diagnostic in both the main and process-scoped
contexts. `--trace-fs` still requests those records explicitly. Default behavior,
verbose filesystem messages, API failures, unimplemented traps and output guards
are unchanged. No console method is replaced and no output budget is enlarged.

The exact logger is `lib/filesystem.js`'s `fs_read_file_result`: it logs when
`ctx._debugReadFile` or the explicit `fs` trace category is set. `test/run.js`
previously set `_debugReadFile: TRACE_API` in both contexts, independent of
the API-name filter and the existing preload's 16-record cap. This explains
the previously observed output guard during `gfx32/fl-concrete.png` reads.
The option now sets `TRACE_API && !QUIET_FS`; the filesystem module is unchanged.

## Historical runner adapter

The new option is a change based on current-main donor
`9183b84473507ffe7c0598725e080a821c747945`; it did **not** already exist in the
historical Enigma runner. Current-main input runner SHA256 is
`3c59fd034391e069f24a6047cf96cd8dac84a791d7d7591d55e5f7cb6e161a5e`.

`tools/enigma-quiet-filesystem.cjs` is the reusable adapter for the retained
historical runner. It **replaces**, rather than chains with, the earlier
`preload.cjs`, preserving that preload's exact two API-cap transformations and
adding only the two `_debugReadFile: false` substitutions. Both files are
checked before installation, with runner and filesystem identity checked again
when their exact filenames compile. Unrelated modules pass through unchanged.
Missing runner-root configuration rejects preload installation.

Canonical donor `/home/user/wine-assembly-shadow-man-span-static-canonical-oct23`,
revision `d8cd8c54c8d63c107696f1e4ef7a1e229dcadc1e`:

| File | Required SHA256 |
| --- | --- |
| test/run.js | 4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809 |
| lib/filesystem.js | 4c255570c74512262849420c74fe73704fcfe006dc09fb963272c66c9ea0b27e |

The filesystem hash is also identical in current main. The historical runner
hash is not. The adapter rejects current main instead of falsely treating it
as the canonical historical runner. Inputs and prior preload/capture/supervisor
identities are in `enigma-quiet-filesystem-20261024/input-identities.json`.

## Validation

Run `ENIGMA_CANONICAL_RUNNER=/tmp/enigma-quiet-filesystem-runner-oct24/canonical
node --max-old-space-size=256 test/enigma-quiet-filesystem.test.cjs` (join the
line break with a space). The fixture consists only of the two pinned Git blobs.
Without that environment variable, the reusable test covers current-main mode;
historical acceptance in this task used both pinned files.

The real filesystem module and its VirtualFS run in supported browser export
mode with a 4 KiB host ArrayBuffer and identity address translation, without
WASM, guest execution or providers. 2,000 successful reads emit 201,999 bytes
under the old setting and zero with quiet mode. Read bytes/counts stay correct,
invalid-handle error 6 remains intact, and explicit `fs` tracing emits two records.
Both runner context assignments are evaluated from actual source. The adapter's
actual extracted API logger emits exactly 16 of 40 requests. Its installed
compile hook preserves fatal API stdout, unimplemented stderr, and an uncaught
guard exception with exit 1. Mutated runner/filesystem, current-main runner and
missing preload configuration all reject. This is logger qualification, not
an Enigma startup or gameplay run.

The local synthetic output control sets RLIMIT_FSIZE to exactly 131072,
writes that many bytes, then attempts one more: error 27 / exit 1, file length
131072. The temporary payload was deleted after recording the receipt. Existing
guest supervision and guard code remain untouched. Two initial test-fixture
failures are retained: incorrect browser RegionMap injection, then a baseline
read count too small to cross the guard. Corrected fixture uses the real global
name and 2,000 reads; the output limit itself was never changed.

## Next execution, coordinator owned

`enigma-quiet-filesystem-20261024/next-child-command.txt` is the exact child
command; `next-argv.json` and `next-env.json` are its structured equivalent.
It preserves all previous provider, asset-tree, batch/time, memory, count,
input and API-selection arguments. The only argv change replaces the old
preload with this adapter and the original capture preload. Set
`ENIGMA_RUNNER_ROOT=/tmp/enigma-provider-complete-startup-oct24/runner`.
The adapter never automatically loads the capture preload, so both `--require`
arguments in the supplied command are required to preserve capture behavior.

This command is a child argv for the next authorized guarded supervisor run,
not an instruction to launch an unsupervised process. Restore the retained
manifest's canonical runtime files first; they need not exist in this offline
checkout. The coordinator must supply a fresh box/allocation, admission and
exact canonical mount-parser validation, including the unchanged tree mount,
and retain the **131072-byte output guard**, 60-second outer wall limit and
existing capture identity/pixel checks. No mount argv or conditional guest
execution was used in this task; mount validation is therefore not claimed.
No runtime outcome beyond the old batch-11689 output stop is inferred.

## Resources and publication

Initial measured admission projected 50,649,774 bytes including focused
Git/source/temp/evidence, full external session bytes, future history/events,
positive SQLite growth and 8 MiB reserve; host free after projected increment
3,608,044,882 bytes. Limits: 64 MiB total, 24 MiB/file, fresh MemAvailable at
least 805306368, Node heap 256 MiB, CPU/wall at most 60 seconds for cheap tests.
The final test used 0.041 seconds wall. Captures retain a conservative initial
110000-byte charge against 1 MiB; instruction accounting retains 46000 bytes
against 64 KiB. Final measured resource and cleanup receipts accompany this
report. Readonly donors/tools are standing inputs, not copied tool installs.
Alternate-depth Git stderr is retained under the task root, not repeatedly
dumped. Root tracked files/index/refs and all donors remain readonly.

No build, instantiation, guest, browser, acquisition, main merge, public deploy
or box action occurred. No box was assigned. Prior `bx_fvkjwxap` was coordinator
reported snapshot-stopped; lifecycle remains with the coordinator. Only this
task's watcher and temporary output-control payload require cleanup.
