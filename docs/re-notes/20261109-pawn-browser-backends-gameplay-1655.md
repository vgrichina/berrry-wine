# Pawn browser backends: first original failure

Run `20261109-pawn-browser-backends-gameplay-1655` preserves a **browser
startup NULL call, before any chess input**. No gameplay qualification is
added to GLD3D-CORPUS-27. No production code changed.

| Browser arm | Result |
|---|---|
| Software requested | Pawn creates its windows, then the main worker reaches EIP zero. Reviewed raw startup and board captures both show an empty desktop; no move or reply. |
| WebGL | Not attempted after the first original failure. Actual owning WebGL context and gameplay remain unverified. |

The original used the production direct route
`index.html?app=pawn&debug&threads&d3d9-renderer=software`, Chrome
151.0.7922.108, viewport 1024×768. The resulting debug desktop canvas was
684×570. All six registered media files and the declared DLL closure were
pinned and served correctly; the original media remained unchanged. OLE32
and SHELL32 named imports used the browser's existing built-in fallback.
The guest and render workers both loaded module
`3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18`.
Their targets detached before capture: actual endpoint options/context are
**unverified**. Source recovery is Git base
`f30074132e799518492fb1103234c043310ecf0a`, empty relevant tracked-source
diff, the retained Wininit patch and small run-input patches; no source/media
archive or media copy.

The page reports “Program exited (worker)” at 17:12:36.492Z. A read-only
inspection of the retained stopped `WineAssembly` object recovered owning
slice 38: EIP=0, yield=0, `trapped=null`, previous block `0x0041c100`,
previous-previous block `0x00410501`, EAX=0 and ESP=`0x074fffc8`.
The page's printed all-zero register values came from its separate instance
and did not describe that worker slice.

Disassembly: `0x00410506` calls `0x0041c100`, which loads
`[0x004240c0]` into EAX and calls
`[eax+0x20]` at `0x0041c10a`. The preceding initialization wrapper
`0x0041c0b4` contains a zero-result path through HeapFree/TlsSetValue that
clears `0x004240c0`. **Why initialization takes that path is unknown.**
No trace establishes GetDC failure or synchronous-send abandonment; the
historical same-address failure does not establish this cause. Next:
investigate that initializer's callback/result and pointer lifetime in the
owning worker. No speculative emulator repair or replay was made.

Validation: both complete driver branches passed offline CDP stand-in controls
for startup, four captures, balanced drag, ordinary close and first-error
preservation. Native empty-production-desktop capture/input preflight passed
without a guest. Existing CLI software success in [pawn.md](pawn.md) was
reused without rerunning it; it remains separate from browser evidence.

An initial read-only drain assertion incorrectly expected the receipt's
historical `owned` list to be empty, and the shell continued to the original
launch despite that assertion. Both the failed check and correction are
retained: the preflight had already completed all 148 kernel reaps, had no
remaining/unreaped tasks, and its parent had actually waited with status 0
before the original launch. No original input followed the failure discovery.

Evidence: `scratch/runs/20261109-pawn-browser-backends-gameplay-1655/`,
including reviewed `retrieved/software/startup.png`, `review/software/board.png`,
`software-readonly-retained-slice.json`, disassembly, raw CDP/HTTP/console logs
and process waits. No original moved/reply images exist. All 65 recovered
paths passed SHA/size, decoded hashes/gzip CRC and independent reread.
Browser.close returned exit 0 for both browsers; custody reaped 148 preflight
and 347 original tasks. Four ports closed; profiles and exact-root process/FD
holders were absent. No guest/config/clock changes, workers or deployment.

The single fresh UUID-bound box `bx_ggbqpgz9` was allocated only after
Redline-1648 and Q3-1648 final published releases and independently verified
shutdown/evidence. Its independent immutable 25-minute watchdog was observed
before allocation and actually joined 0 after shutdown. Initial expiry:
`2026-11-09T17:36:29.881Z`. After retrieval, normal unforced
`stop_be4a64aafac495ba` completed `2026-11-09T17:15:58.664Z`.
Final API state: **ARCHIVED**, archiveAfter null, expiresAt not returned.
Free `/home` remained above the owner's 1.5 GB floor. This single task stops
with the first original failure preserved.
