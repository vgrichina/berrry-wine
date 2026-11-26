# HeidiSQL 10.0 portable (Delphi)

Binaries: `test/binaries/candidates/delphi-heidisql-10.0-portable/`. Run with `'--vfs-include=*'`. Evidence: run 20261125-delphi-corpus-fixes.

- **Packed (`extracted/heidisql.exe`):** the unpacker stub resolves every
  KERNEL32 import with `GetProcAddress` and calls `ExitProcess(0)` on the
  first NULL. That is the "exits with code 0" in the sweep.
  - The KERNEL32 named surface is the explicit manifest
    `src/kernel32-exports.json`; API ids not listed there are invisible to
    `GetProcAddress`, even when implemented.
  - GetCPInfoExW was the first miss: implemented and exported at ordinal 630.
  - The next miss is `EnumSystemLocalesW`, which is neither implemented nor
    exported.
  - `tools/gen-kernel32-image.js` caps the export image at 512 entries, and
    507 are used. Finishing this route means adding EnumSystemLocalesW and
    any later misses, and probably enlarging the export regions first.
- **Unpacked:** gets past CreateFileMappingW. It stops on
  `SetNamedPipeHandleState` at batch 110, so it needs real named-pipe
  semantics, which are not small.
