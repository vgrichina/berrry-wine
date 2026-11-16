# Original Win32 Pegged gesture investigation

Run: `scratch/runs/20261114-pegged-native-gesture/`.

The registered original uses a captured left-button drag. A click at the
source followed by release at that same source does not establish a persistent
selection for a second click. The previous closed run's unchanged pixels were
therefore insufficient to authorize its destination, and are not replayed here.

The executable remains `test/binaries/entertainment-pack/pegged.exe`, 43,792
bytes, SHA-256
`bb5a4e90b71363cb7df5f818fc9a2de9841dbdfcb8a74498756b2c11438fe4c1`.
Static evidence comes from this file, without executing another puzzle or
reading live guest board state. Its window-procedure dispatch table maps
WM_MOUSEMOVE (0x200) to 0x010044ad, WM_LBUTTONDOWN (0x201) to 0x0100403b,
and WM_LBUTTONUP (0x202) to 0x01004b28. DOWN tests an occupied source and
sets the drag-active flag at 0x01004268, then calls SetCapture at 0x01004276.
UP requires that active flag, converts its own lParam into the destination,
calls ReleaseCapture and the orthogonal distance-two/midpoint check at
0x01006680, and checks an empty destination before committing the move. The
active flag is cleared at 0x010056df. The board window procedure has no
WM_KEYDOWN or WM_CHAR board handler. Native menu accelerators are separate.
The Help command names `pegged.hlp`, absent from this original's directory;
no visible Help contents are claimed or substituted from the Win16 version.
Focused disassembly excerpts and the decoded dispatch map are in the run.

`tools/pegged-native-controller.py` adds one fixed source-to-destination drag
using existing supported `guarded-input` pointer edges. It accepts a personally
reviewed source, occupied jumped neighbor, empty destination, legal reason,
count and exact source/destination centers from one fresh complete scene. It
contains no board reader, solver, move generator, waypoint loop, raw-input
bypass or arbitrary action list. Public input and renderer code stay unchanged.

Before DOWN, an independent child acknowledges that its immutable 1750 ms
fallback is armed. Normal destination UP is authorized only by consumed,
identity-matched DOWN and MOVE receipts, and occurs on the fixed schedule.
The complete gesture has a 1500 ms deadline including movement; preparation
that cannot fit is refused before DOWN. Parent EOF, cancellation, late ACK or
uncertainty releases at the original source, without attempting a destination.
Every physical effect uses the guarded public endpoint. Source cleanup also
runs after normal destination UP. The original clears its active flag after
the first UP, so cleanup cannot create a second jump. No capture, model call
or durable evidence write occurs while the button is held. Audit follows
physical release and actual child wait with both EOFs. UNKNOWN closes input
without retry or rebinding.

Bootstrap and actual default-board admission remain separate. Native Start
is available once; no pattern change, reset or second puzzle is allowed.
Each completed drag blocks further gameplay until a separate personal pixel
review verifies source and jumped neighbor empty, destination occupied, and
an actual peg count reduced by one. A consumed receipt is not removal proof.
Natural win/no-moves requires actual UI evidence or a personal legal-absence
review. The final 180 seconds are reserved irreversibly for reviewed native
Quit. Host shutdown alone is never native Exit.

**Blocked before heavy checks and before the fresh original.** The coordinator
confirmed GL-visible → StarCraft-combat → Pegged at 21:58:09 UTC. GL-visible's
four actual waits and both EOFs are retained. StarCraft-combat's native,
watchdog and outer-child waits returned 0 with both EOFs, and its supervisor
released the heavy lock. Its `original/outer-wait.json`, however, explicitly
records `actualWait: false`, `stdoutEOF: false`, `stderrEOF: false` and
`missingProof: true`: launching tool session 39536 returned 143, and the outer
PID was absent without producing its wait record. PID absence cannot recover
the missing actual wait or separate EOFs. The requested four-wait gate therefore
has not passed. `predecessor-blocker.json` preserves the exact records.

Light validation passed: **14 policy tests and 9 fixed-drag HTTP controls**, plus
the released **23 policy and 12 HTTP controls**. The controls cover fixed edges,
1750 ms fallback, cancellation/UNKNOWN, late ACK, slow prearm persistence
refusing DOWN, slow postrelease audit, parent death/EOF, stale identity/image,
scene reuse, incomplete reviews and unchanged-count refusal. Synthetic fixture
reviews are explicitly labeled and do not prove native gameplay. Eight actual
CLI controls and the full locked build are prepared but **not run**. Consequently
the derivative controller and its tests remain uncommitted WIP in the shared
tree, preserved as Git patches in this run. No public input or renderer file
was edited. Only this report is published.

No fresh Pegged process was launched, no puzzle was started, and no selection,
jump, count decrease, natural end or native Exit is claimed for this run. The
previous original stays closed. The runtime recipe is prepared for one
900-second original/default1000/real-ticks run with an independent 920-second
watchdog and irreversible 180-second Quit reserve; that watchdog was never
started because launch was withheld. No box or worker was created: box ID and
expiry are null, state `NOT_CREATED`, stop receipt `NOT_APPLICABLE`.

Next: recover the actual missing outer-wait/EOF proof or obtain an explicit
owner instruction changing that prerequisite, then claim the retained WIP,
run the prepared actual CLI controls and locked build, and attempt one fresh
default puzzle. Do not reconstruct a fourth successful wait from the three
successful child waits or from a closed endpoint. This task stops at the
concrete blocker without replaying either original.
