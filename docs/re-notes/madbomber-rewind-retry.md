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
