# HeidiSQL 10.0 portable (Delphi)

Binaries: `test/binaries/candidates/delphi-heidisql-10.0-portable/`. Run with `'--vfs-include=*'`. Evidence: runs 20261125-delphi-corpus-fixes, 20261126-delphi-corpus-fixes-2 (`heidisql/`).

- **Packed (`extracted/heidisql.exe`):** the unpacker stub resolves every
  KERNEL32 import with `GetProcAddress` and calls `ExitProcess(0)` on the
  first NULL. That is the "exits with code 0" in the sweep.
  - Needs `--max-batches=600000`: decompression alone takes ~236k batches of
    the default 1000 blocks (the loop at 0x00fa33xx). The 200-batch default
    stops inside it and looks like a hang.
  - The KERNEL32 named surface is the explicit manifest
    `src/kernel32-exports.json`; API ids not listed there are invisible to
    `GetProcAddress`, even when implemented.
  - Since 2026-11-26 the KERNEL32 image holds 2048 exports (it was capped at
    512), and `gen-kernel32-image.js --check` refuses any implemented API that
    Wine's kernel32.spec owns but the manifest omits
    (`tools/kernel32-export-census.js`, names in `tools/kernel32-wine-names.json`).
  - GetCPInfoExW (ordinal 630) and EnumSystemLocalesW (650, implemented
    2026-11-26) were the first two misses. Both resolve now.
  - The next miss is `SystemTimeToTzSpecificLocalTime` (API #470, then
    ExitProcess). The unpacked import table lists every name the stub will ask
    for. 12 of its 204 KERNEL32 names have **no API id at all**:
    EnumCalendarInfoW, EnumResourceNamesW, GetDateFormatW,
    GetFileAttributesExW, GetOverlappedResult, GetThreadContext,
    QueryDosDeviceW, ReadDirectoryChangesW, SetNamedPipeHandleState,
    SwitchToThread, SystemTimeToTzSpecificLocalTime,
    TzSpecificLocalTimeToSystemTime. Cheap: the two TZ conversions (apply
    `$tz_bias_minutes`, as GetTimeZoneInformation does), SwitchToThread,
    and the W twins of GetDateFormatA / EnumResourceNamesA / QueryDosDeviceA.
    Not cheap: named pipes, overlapped I/O, ReadDirectoryChangesW and
    GetThreadContext.
  - Because SetNamedPipeHandleState is in that list, the packed route cannot
    get further than the unpacked one until named pipes exist. Do not export
    a fail-fast stub to get past the stub's NULL check: apps that probe
    GetProcAddress for optional APIs fall back on NULL and would crash instead.
- **Unpacked:** gets past CreateFileMappingW. It stops on
  `SetNamedPipeHandleState` at batch 110 (`=== UNIMPLEMENTED API ===`), so it
  needs real named-pipe semantics, which are not small.
