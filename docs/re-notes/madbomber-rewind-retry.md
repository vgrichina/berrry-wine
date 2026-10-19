# Original Mad Bomber diagnostic after rewind

One authorized passive retry on 2026-10-18 used canonical main
`a4ed9f8fa5c92a511ae10300127eb1dcd18f31fe`, module SHA-256
`c3ae99a84199766991055f1d68196af03a9af10eeb118e97c6794f67d3ae7d1a`.
The retained original 140 files, seven original DLL seeds and mandatory shared
MSVCRT (278581 bytes, SHA-256
`887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1`)
were checked before and after. No replacement, unpack modification, input or
compatibility bypass was used.

The 10 guest / 15 host-quit / 25 hard-kill second route exited with code 1
at 23:06:40.411 UTC, after spawning at 23:06:40.208 UTC. The original packed
zlib caller at 0x00c6fcc5 now resolves both `_fdopen` (API 110, 0x07504880)
and `rewind` (API 122, 0x075048e0). Neither function was actually invoked in
this trace. Execution progressed to GetProcAddress API 247 for `Beep`,
called from 0x007b85a9 with module handle 0x00db7e54. Resolution returned zero,
followed by `DLL_PROCESS_ATTACH returned FALSE`. This is the next observed
import blocker; it is not evidence of gameplay or of original-game CRT I/O.

No PNG was emitted. The 104721-byte log remained below its cap and no stop
guard fired. Minimum observed free disk was 2539696128 bytes. Independent
postflight found both child PID 2621705 and controller PID 2621680 absent,
with no process-group survivors. All 3207 physical source/runtime pins,
including the region map, the canonical module, original archive, original
140 files and shared CRT remained unchanged. There was no automatic retry.

Evidence and the exact controller/launch arguments are retained at
`/home/user/wine-assembly/scratch/runs/20261018-madbomber-rewind-retry/`;
preparation, pure guard checks and fresh pin creation are adjacent under
`20261018-madbomber-rewind-retry-prep/`. `review.json` explicitly records an
unregistered blocked diagnostic, not a successful game result. No registry
`result.json` was created. Reproduction requires a new exclusive runtime grant
and fresh canonical pins; the existing output directory cannot be reused.

## Reconciled module-handle provenance

Reading the retained log establishes the named DLL for the failed lookup:
API 159, `LoadLibraryA("KERNEL32.DLL")`, called from `0x007b8594`, returns
`0x00db7e54` (log lines 777–778). API 247 then requests `Beep` using that
same handle and returns zero (lines 1745–1746). Earlier API 103 and 129
loads of KERNEL32 also return that handle. Thus the original caller's DLL
name is established by the original run, rather than inferred from the
synthetic fixture. This does not establish which internal export-lookup
branch ran or prove the new export fixes the original game. The explicit
KERNEL32 export candidate still requires production-route validation and
a fresh original retry. No new game execution was used for this finding.

## Original retry after public Beep export

Run `20261019-madbomber-beep-retry` executed on 2026-10-18 at 23:53 UTC
with main `ea57e62deb74a3750b6b59303ebcd9edb0b32c6e` and module
`203163dda45d61b905a53bfbe2ad0128d006092b087a73d48a776bafd330ead0`.
API 247 now resolves Beep to `0x00db8e94`. It is not invoked. The original
caller progresses to API 288, `IsDBCSLeadByteEx`, using the same KERNEL32
handle; that lookup returns zero and DLL initialization fails. This is an
observed import-resolution improvement, not gameplay or hardware audio.

The single passive run exited 1 with no signal, PNG or player input. Its
131919-byte log and minimum free space 3356229632 stayed within the unchanged
guards. Independent postflight rechecked all 3221 physical source/runtime
pins, 140 original files, archive and shared CRT; controller and owned
process group were absent. The run directory retains launch/controller,
pins, log, terminal, review and independent postflight receipts. No automatic
retry occurred. Next work is real IsDBCSLeadByteEx implementation/export
conformance, followed by another separately pinned original validation.

## Original retry after IsDBCSLeadByteEx

Run `20261019-madbomber-dbcs-retry` at 00:08 UTC uses validated module
`93818216116a49fbc2b52074a80254d5f8aebdef753b7f22b34d90be84c323c6`.
The original now resolves IsDBCSLeadByteEx and proceeds to API 302,
GetProcAddress(KERNEL32, `LockFile`), which returns zero. Classification was
not invoked in this run. No window, PNG, player input or gameplay claim.
Exit1/no signal, 141213 log bytes, minimum free2849677312; independent
postflight verified3224 physical runtime pins,140 originals and shared CRT,
with controller and owned process group absent. Prior failed runs remain
separate; no automatic retry. Real LockFile contract/export is the next
identified import prerequisite.
