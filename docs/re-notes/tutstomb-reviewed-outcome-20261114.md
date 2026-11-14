# Tut’s Tomb: reviewed original deal, 2026-11-14

Evidence directory: `scratch/runs/20261114-tutstomb-reviewed-outcome/`.
One registered original default deal produced thirteen visibly verified removal
events: ten pairs and three single Kings. It ended through native Game → Exit
with fifteen pyramid cards remaining. This is a partial result, not a native
win, loss, or exhausted-deal claim. Final review identified a missed legal
10D + waste 3H pairing; the original was not restarted.

The route uses registered `wep16_tutstomb`, the existing local
`test/binaries/wep16/WEP2/TUTSTOMB.EXE`, its help file, imported CARDS, and
runtime WEPUTIL. No downloaded or substituted executable is involved.
The original’s module-reference table names win87em, KERNEL, GDI, USER,
SOUND and CARDS. CARDS and WEPUTIL each import KERNEL, GDI and USER.
The runner handles the system modules and win87em internally; CARDS is a
real local NE DLL. A registered manifest alone is insufficient to establish
the media closure. Before-launch pins and actual module logs must agree;
an unexpected unpinned dynamic module remains unknown. The earlier
TicTactics MSVCRT before-hash omission remains a gap in that separate run.

The native notes identify the important input behavior: WM_LBUTTONDOWN
acts on the card remembered by WM_MOUSEMOVE, not the DOWN coordinates.
The existing coordinate-press path in `lib/renderer-input.js`, enabled by
`test/run.js`, supplies pointer arrival and a separate 30ms hover pump before
DOWN. The controller chooses one coordinate press, never a hidden second
click or raw native-message bypass. Transport acknowledgements establish
neither selection highlighting nor actual card removal.

`tools/tutstomb-controller.py` requires a personally reviewed complete
default pyramid before permanent PID/start/window binding and admission.
Gameplay reviews expire after five seconds; menu reviews after thirty.
Each first pair member requires a personally chosen visible partner. A
second member requires a separate current scene showing the first selection,
its earlier action, and visible ranks totaling thirteen. A King is single.
Stock actions require a visible legal target and personal justification;
recycling additionally requires the visible draw-three rule. There is no
Start, Deal, New session, undo, solver, card reader or move generator route.

Every gesture independently prearms its 1750ms fallback UP and has a finite
1500ms limit, unique nonce and no replay. UNKNOWN, mixed identity, cancelled
input, late acknowledgement and release-child failure close gameplay.
The fixed runtime reserves an irreversible final 180 seconds for native Quit.
Native UI Exit and host teardown are recorded separately. A normal native
wait can justify OWNER_EXITED when final physical UP has no acknowledgement;
it cannot turn that absence into a physical UP claim.

## Rules and controls reviewed before launch

The built WAT help parser decoded all eleven topics of the existing local
TUTSTOMB.HLP. The native rules define a free card as one with no card above
it, pairs totaling thirteen, Ace one, Jack eleven, Queen twelve and King
thirteen. Kings are removed singly. Only the top turned-over stock card can
be played. Clicking the face-down stock turns one or three cards according
to the untouched options; the green-circle recycle is allowed only for
draw-three. Winning means removing the whole pyramid. The help explicitly
says the first selected card is highlighted, then a successful pair moves
to the upper-right corner. The Casino score is +13 per match, -28 per deal,
-1 per flipped stock card, -1 per ten seconds and -5 per recycle. No Options
control is used to change the original default.

Twenty-five policy tests, nine HTTP controls and eleven actual CLI controls
passed. The latter use a separate Solitaire fixture, establishing transport
behavior without claiming Tut’s Tomb gameplay. Actual renderer dequeues and
native DispatchMessage traces show hover at 1794699467810ms and DOWN at
1794699467840ms: separate pumps thirty milliseconds apart. One native menu
control opened the fixture's first menu. The full build passed under both
the heavy-runtime lock and `/tmp/wine-build.lock` in 49.081 seconds.
The controls cover UNKNOWN after a consumed click and dropped reply, window
replacement, cancellation, late ACK, release-child death before DOWN,
independent fallback, parent death and capture after UP. All eleven native,
watchdog, supervisor and outer fixture waits have actual EOF evidence;
orphan release-child waits after parent death remain unknown.

The initial light policy test caught a missing diagnostic; the initial HTTP
parent-death check raced the release child's terminal-audit write. Both were
corrected and their failed logs retained. The older JavaScript HLP helpers
did not decode this help format correctly; the built native parser above
provides the complete readable rules instead.


## Actual original and visible evidence

The published controller/test route was commit
`69a3e19980fbc6fdbfe7bf7307a378a1620d5a65` before launch. The original ran
once, with real ticks, default 1000 batch size, 800×600 screen, fixed
1200-second limit and independently prearmed 1220-second watchdog. Its native
runtime was 809.740 seconds. No configuration, clock, private card memory,
seed, solver, undo, Deal or New session was used. The untouched original
showed draw-three and Casino scoring. The complete actual board was reviewed
and permanently bound to PID 4159762/start token 274682277/main HWND 0x10001
before the first card action. Each actual pair first selection was separately
reviewed as visibly inverted before its second member was chosen. Freshness
refusals happened before sending input and required a new personal scene.

Selected before/result PNGs are named by action in `selected-captures.json`;
the second-member before images show the actual first selection. Removal
claims come from the visible cards disappearing and the native score, never
from a transport ACK. Every pair below totals thirteen, and each King is
single. A net +12 reflects the native timer crossing a ten-second boundary.

| Event | Removed | Native score before → after | Newly free pyramid cards |
| --- | --- | --- | --- |
| king1 | KC | -38 → -25 | — |
| pair1 | 10C + 3S | -44 → -32 | 4H |
| king2 | KS, top waste | -33 → -21 | — |
| pair2 | AH + QD | -29 → -17 | JD |
| king3 | KH, top waste | -17 → -4 | — |
| pair3 | JD + 2H | -7 → 6 | JC |
| pair4 | JC + 2S | -3 → 10 | — |
| pair5 | 8D + 5H | 8 → 21 | — |
| pair6 | 4H + 9C | 12 → 24 | 10H, 6C |
| pair7 | 6C + 7H | 4 → 17 | — |
| pair8 | 10H + 3C | -4 → 9 | 3D |
| pair9 | 3D + 10S | 8 → 20 | 7C, 10D |
| pair10 | 7C + 6S | 8 → 21 | JH |

The sixth removal event was pair3. Total removed cards were 23; thirteen
came from the pyramid, leaving fifteen there. Nineteen ordinary stock-draw
clicks and three visible green-circle recycles occurred. Native help permits
reuse in draw-three mode. After the third recycle the stock was face-down
and the waste empty; no further draw occurred before Quit. The last visible
native score was -23 at time 804 in `native-exit-visible.png`.

The help documents -5 per recycle. The actual selected recycle images show
-10, apart from timer deductions: 15 → 5 on the first recycle, 19 → 8 on
the second (one timer point), and -9 → -19 on the third. This discrepancy is
unresolved; the observed UI values take precedence over an assumed formula.

This was not exhaustive play. At scene s54 the top waste was 3H and 10D
was already exposed by pair9. I overlooked that legal pair and drew again,
incorrectly recording that no ten was free. The transient s54 PNG was pruned
before this final review; its original capture metadata/hash remains, and
selected pair9/final-board PNGs show the exposed 10D. The third recycle also
occurred before deciding to stop. No native outcome dialog appeared. The
result therefore preserves the missed opportunity and partial status rather
than claiming an unwinnable or completed deal.

## Closure, provenance and shutdown

Imports and runner auto-resolution were inspected before launch. The actual
native module log loaded CARDS and registered WEPUTIL for LoadLibrary; no
unexpected external dynamic module appeared. System modules and win87em are
implemented internally. Exact complete known media sizes/SHA-256 values below
were equal before and after; the HLP is included as a registered dependency.

| Existing local WEP2 media | Bytes | SHA-256 before = after |
| --- | ---: | --- |
| TUTSTOMB.EXE | 101472 | d02dd9ce2e6bbead9e9464691b6db08c20a4158b09b93be5a414606f9d1476e8 |
| TUTSTOMB.HLP | 15527 | 7616f28c70beb61d94128eb8284e8154b44b00e5b0a5837440bdb54b173f0b0b |
| WEPUTIL.DLL | 19200 | 7bd426e4d1ca0afea88e5ad22d9add44d4df79432cdc4b5cb165c10c6023e6bd |
| CARDS.DLL | 148528 | bcc968e7c8b376eae9dc91dad9dc43a40502fd91df1663c6dc82fb6c50b10a0f |

`launch-pins.json` records 361 exact source/runtime/built-artifact and local
WEP2 candidate-media hashes. `release-pins.json` verified all 361 unchanged
before releasing the runtime slot. Git commit plus the 58821-byte
`relevant-uncommitted.patch` preserves relevant uncommitted source hunks,
including new files. No source tree, WASM, game media or frame bundle was
copied into evidence. Thirty-five selected decision/result PNGs remain;
redundant transient PNGs were removed with their hashes recorded.

Q2 then JezzBall predecessor actual native/watchdog/supervisor waits, both
EOF, heavy release and absent PIDs were personally checked before this run;
their ancillary outer UNKNOWN fields remain unchanged. On this run, the
personally reviewed native Game menu showed Exit. Selecting it produced
`[Exit] code=0`, native actual wait 0 with both EOF, watchdog actual wait 0,
and supervisor actual wait 0 with both EOF and `heavyReleased=true`. All
four original lifecycle PIDs were absent and port 8633 closed. There was no
host-close gesture. Final transport completion itself claims neither removal
nor native Quit; actual UI choice plus native termination establishes Quit.
The ancillary caller tool ended 143 before writing its own wrapper receipt,
so that wrapper's actual wait/EOF remain UNKNOWN. No restart or rebind was
made. Runtime release was announced immediately; all later work was report
and evidence cleanup. No box was created: ID/expiry null, state NOT_CREATED,
stop receipt not applicable. Free disk was 12 GB, above the 1.5 GB floor.

Machine-readable removal/exposure/score/stock/partial/nativeQuit evidence is
`scratch/runs/20261114-tutstomb-reviewed-outcome/result.json`. No browser,
FPS, audio, deployment, full-27 or new-title-win claim is made. The earlier
TicTactics MSVCRT before-hash gap is not repaired by this run.
