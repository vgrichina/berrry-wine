# IsDBCSLeadByteEx import checkpoint

The root's retained `20261019-madbomber-beep-retry` advances past Beep lookup
to API 288 resolving `IsDBCSLeadByteEx` to NULL on KERNEL32 handle `00db7e54`.
This source change adds API 4578 and explicit native export ordinal 587.
All earlier API IDs and export ordinals remain unchanged. It does not modify
the original guest or establish that its next startup attempt will succeed.

[Microsoft's contract](https://learn.microsoft.com/en-us/windows/win32/api/winnls/nf-winnls-isdbcsleadbyteex)
classifies a BYTE as a potential lead byte in five DBCS pages; it does not
validate a trail byte. The existing shared helper implements their ranges.
The new handler uses that helper and validates its page first. Both true and
valid false results preserve LastError; an unavailable page returns false
with ERROR_INVALID_PARAMETER (87), consistent with the code-page table lookup
in [Wine's implementation](https://github.com/wine-mirror/wine/blob/master/dlls/kernelbase/locale.c).

Runtime-supported pages are 437, 1252, 932, 936, 949, 950 and 1361. For this
classification operation, Macintosh 10000 and Unicode UTF-7/UTF-8 (65000/65001)
also correctly have no DBCS lead bytes. Other unavailable pages fail explicitly;
this is not a claim of general installed Windows NLS coverage or conversion
support for those three additional pages. CP_MACCP selects the default US
Macintosh page. CP_ACP uses process ANSI state. CP_OEMCP matches GetOEMCP's
system default 437, regardless of SetConsoleOutputCP. The new API deliberately
does not reuse the older shared resolver's console-dependent OEM alias.

CP_THREAD_ACP reads the calling thread's retained LCID through the existing
host_get_thread_locale(current_thread_id) import. ThreadManager stores it on
the calling thread record, and host.js and Worker routing already expose that
identity. Supported LCIDs (ignoring the sort-ID high word) are en-US 0409
(1252), Japanese 0411 (932), Korean 0412 (949), Chinese mainland/Singapore
0804/1004 (936), and Chinese Taiwan/Hong Kong/Macao 0404/0C04/1404 (950).
Other LCIDs explicitly fail with 87; complete Windows locale coverage remains
unimplemented. The process ACP does not substitute for a thread locale.

`test/test-dbcs-lead-byte-ex-production.js` authors actual guest calls through
the production PE static IAT and dynamically resolved KERNEL32 EAT, including
ordinal identity, stdcall ESP, all 256 bytes for every supported explicit page,
ACP changes, stable system OEM despite console changes, default Mac alias,
guest SetThreadLocale/GetThreadLocale backed by production ThreadManager
records, supported locale mappings independent of process ACP, BYTE narrowing,
invalid pages/locales, LastError preservation and recovery. These locale calls
exercise the main thread record; they do not establish concurrent Worker
coverage. Run it normally and with `--no-tail-calls` under an
exclusive runtime grant. No original retry has been run for this checkpoint.

## Compiled validation, 2026-10-19

Reviewed source `bb4ab74da6cfc1782fb3b92e7b9d58bb6d9594b8`, including main
`a53f43dba`, passes the production PE fixture in both dispatch modes. The
normal build and existing `test-codepage-dbcs.js` (12 assertions) and
`test-file-api-codepage.js` also pass. There were no behavioral fixes during
validation. Normal module SHA-256 is
`93818216116a49fbc2b52074a80254d5f8aebdef753b7f22b34d90be84c323c6`
(1,870,999 bytes); compatibility module SHA-256 is
`a9986d44cb21d6cdbe919b39af9b435dee87bba0dd8d1deab868fef28ce07fdc`.

Evidence is retained in the isolated worktree
`/tmp/wa-madbomber-dbcs-oct19/scratch/runs/20261019-dbcs-validation/`:
five logs and guard receipts, exact sparse closure/preflight, 1,032 unchanged
source pins, artifact hashes and prior canonical module/combined source.
All five process groups were independently absent after completion; no guard
fired. The original canonical `da72a16f…` remained unchanged. Platform snapshot
activity coincided with fluctuating free space; execution paused between the
dual fixtures and build until space recovered. Minimum sampled free space
was 2,264,346,624 bytes, above the unchanged 2 GiB + 64 MiB stop threshold.
Fresh command admission required 2 GiB + 128 MiB; limits were 180 seconds
and 8 MiB per log. No original game, visual output or startup success is claimed.

Recovery: restore the tracked closure with `git sparse-checkout add --stdin`
from the retained `build-closure-paths.txt`, use existing dependencies via
`NODE_PATH=/tmp/wa-local-runtime-deps/node_modules`, and run the five commands
listed in `preflight.json` under the retained `guard.js` in a fresh evidence
directory with new admission checks. Compiled artifacts remain ignored;
the remote task branch preserves source and this recipe, not those binaries.
