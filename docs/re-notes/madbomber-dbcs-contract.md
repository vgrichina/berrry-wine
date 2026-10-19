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
exclusive runtime grant. No build, compiled fixture or original retry has
been run for this source checkpoint.
